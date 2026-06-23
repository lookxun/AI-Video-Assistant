# Current Handover Changelog

## 2026-06-24 Production Deploy With Workflow Disabled, Input Scroll Fix, And GitHub Sync

- User confirmed the previous `@` insertion input-scroll fix worked, but typing could still sometimes move typed text/caret to the bottom. Fixed `PlainMentionEditor` so scroll state is captured before input, restored after browser input/default scrolling, and current caret offset is preserved across editor re-render instead of defaulting to `value.length`. Removed the parent effect that tried to auto-scroll to bottom when the draft cursor was at the end because it could misclassify a user-scrolled editor as bottom. Local `npx tsc --noEmit` passed.
- User asked what was still undeployed. Confirmed undeployed items were the 2026-06-24 workflow stabilization batch, history ordering change, root layout Script warning fix, and the new conversation input scroll/caret fix. User then asked to deploy everything while keeping online workflow mode disabled, do GitHub sync, and update handover/changelog.
- Pre-deploy local checks: `git status --short`, `git diff --stat`, `git log --oneline -10`, and `npx tsc --noEmit`. Local status had 24 modified tracked files and 7 untracked paths before handover update/commit.
- Production pre-deploy snapshot created at `/var/www/flashmuse/.runtime/deploy-checks/20260624-before-workflow-input-deploy.json`: `users=24`, `userAssetStates=1330`, `visibleActiveAssets=1293`, `workspaceMessages=1080`, `workspaceSessions=79`, `activeWorkspaceSessions=73`, `stableMissingInNewTable=0`, `fallbackUsers=0`, category counts `character_image=106`, `conversation_images=513`, `conversation_uploads=180`, `conversation_videos=376`, `shot_image=44`, `scene_image=70`, `conversation_upload_audios=3`, `conversation_upload_videos=1`, and `assetListHash=81ece40e2d3c6134`.
- Created local source archive `C:\Users\ASUS\AppData\Local\Temp\opencode\flashmuse-20260624-workflow-input-deploy.tgz`. First `scp` timed out and produced an incomplete remote file, so it was removed and reuploaded with a longer timeout. Verified remote byte size matched local: `140037540` bytes.
- Production deployment: backed up current source to `/var/www/flashmuse/.deploy-backups/20260624-workflow-input-deploy/source-before-deploy.tgz`, extracted/synced the archive into `/var/www/flashmuse` with rsync excludes for `.env*`, `node_modules`, `.next`, `.runtime`, `.deploy-backups`, `.git`, and `public/generated`. Confirmed `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was disabled/unset before deploy.
- Applied production Prisma migration `20260624090000_workflow_media_names`; `npx prisma migrate deploy` and `npx prisma generate` succeeded. Ran `/usr/local/bin/deploy-flashmuse-production.sh`; Next build passed with only existing Turbopack/NFT broad generated-file warnings, PM2 restarted online, PM2 state saved, Ali `_next/static` synced, and Ali Nginx cache cleared.
- Deployed code includes history ordering by own `updatedAt`, workflow media naming and counters, workflow async stale-state fix, workflow media generated-success persistence, node media metadata preservation on stale saves, workflow preview scoping/parameter display fixes, workflow node drag/input fixes, root layout Next `Script` client-error reporter, and conversation input scroll/caret preservation. Production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false.
- Post-deploy snapshot created at `/var/www/flashmuse/.runtime/deploy-checks/20260624-after-workflow-input-deploy.json`. Snapshot compare against before returned `ok: true`; totals, per-category counts, per-user assets, `stableMissingInNewTable`, fallback users, and `assetListHash` were unchanged.
- Production checks after deploy: PM2 `flashmuse` online; `https://main.venusface.com/workspace`, `https://main.venusface.com/admin`, `https://main.venusface.com/admin?tab=upload-rules`, `https://main.venusface.com/admin?tab=server`, and `https://api.venusface.com/api/model-availability` returned 200. Workflow env flag remained disabled/unset.
- GitHub sync requested by the user is part of this session. Main deployed-change commit: `90ae17d Deploy workflow stabilization and input fixes`. A follow-up handover-only commit may exist after this to record the hash.

## 2026-06-24 Local Workflow Naming, Preview, And Canvas-State Stabilization

- User asked to continue local workflow work and keep replies short/direct. No production deploy was performed in this section.
- Read current `handover/` docs and found local worktree still dirty. Later local changes were made on top of existing uncommitted workflow/media/admin changes.
- Renamed workflow sidebar section label from `我的工作流` to `历史工作流`.
- Confirmed current history ordering. Initially `历史对话` used latest `WorkspaceMessage.createdAt` fallback sorting; changed `getOrderedWorkspaceSessionRows()` so conversation list sorts by `WorkspaceSession.updatedAt desc`, matching user rule that any changed history item moves to top. Frontend display also sorts visible sessions/workflows by `updatedAt desc`.
- Fixed React script warning in `src/app/layout.tsx` by replacing raw `<script dangerouslySetInnerHTML>` with Next `Script id="client-error-reporter" strategy="afterInteractive"`. Local recoverable hydration mismatch remains possible when stored UI panel starts in workflow mode but SSR rendered chat mode.
- Audited online Agent generated media in production. Query found `67` Agent-generated `WorkspaceMessage` rows and `153` unique stable local Agent media URLs (`90` image, `63` video); all were present in `MediaAsset`, so historical Agent generated image/video missing-from-new-table count was `0`.
- Added local workflow naming schema. `WorkspaceWorkflow` gained nullable `workflowCode` and integer `nextImageNumber` / `nextVideoNumber` with default `1`. Added migration `20260624090000_workflow_media_names`, applied locally with `npx prisma migrate deploy`, and regenerated Prisma Client after stopping local dev server that locked the engine file.
- Implemented workflow media naming rules: `工作流_01 -> w1`, `工作流_02 -> w2`; workflow media names are `image_N_wX` / `video_N_wX`; counters are per workflow, successful generations reserve/fix names, failed generations should not consume counters.
- Investigated old project docs under `E:\project\clean_project_code\docs` and React Flow documentation. Relevant conclusions: nodes/edges are controlled state; async updates must apply to latest state; node generation result must write back to the same node for self-preview; connections are upstream data flow; multiple same-type nodes must be independent; asset refresh should not recompute node media names.
- Fixed workflow drag/input issues. Generated image/video media are `draggable={false}` so dragging the node does not drag-download media. Nodes remain draggable in empty/waiting/success/failure states. Workflow prompt box now sends on `Enter` and newlines on `Shift+Enter` while respecting IME composition. Waiting-card center icon experiment was reverted per user.
- Added workflow generated media success callback. `WorkflowCanvas` now calls `onGeneratedMedia` after successful image/video generation with node ID, URLs, model, settings, prompt, dimensions/poster. `ChatWorkbench` immediately reserves workflow media system names, adds local `AssetItem` preview metadata, and persists local saved media through `/api/media-assets`.
- Fixed major stale-closure bug in `WorkflowCanvas`. Async image/video completion now uses a `stateRef` of the latest canvas state before calling `onChange`, preventing one node's completion from overwriting sibling node changes or making a second image node appear to generate nothing.
- Removed the runtime workflow node-scanning/persistence effect from `ChatWorkbench`. It was running on page load before assets were loaded, treating existing node URLs as missing, POSTing `/api/media-assets` again, and causing repeated name drift and counter jumps. Workflow persistence should happen at generation success and remote-to-local replacement only.
- Added `WorkflowNodeData.mediaSystemNames` and preserves it through remote-to-local URL replacement. This mirrors conversation `Message.mediaSystemNames` and lets node preview show `image_N_wX` immediately without waiting for asset table reload.
- Hardened `upsertWorkspaceWorkflows()` so stale client autosaves cannot erase workflow media metadata. When existing server canvas has node media fields and incoming canvas omits them, it preserves `images`, `imageDimensions`, `mediaSystemNames`, `videoUrl`, and `posterUrl`.
- Fixed workflow preview behavior. If previewing workflow media, right-side thumbnail rail is built from current workflow canvas nodes only, not all historical `workflow_images` rows and not other workflows. Preview uses table metadata when loaded, otherwise node metadata. Current URL matching uses normalized URLs so local/remote replacement does not hide the selected thumbnail.
- Fixed workflow parameter display. Preview ratios use actual dimensions when present (`2848 x 1600 -> 16:9`). `mediaStateToLegacyAsset()` now derives ratio/resolution from width/height when table ratio/resolution is missing. Remote-to-local re-persist now includes workflow node model/settings so local table rows do not lose parameters. `/api/media-assets` ignores temporary workflow names `图片生成` / `视频生成` when updating `systemName/currentName`.
- Repaired local workflow data multiple times after earlier buggy numbering. Final checked local state for `12424740@qq.com / ID_779117`: `工作流_01 / w1` has `image_1_w1` and next image number `2`; `工作流_02 / w2` has node media and asset rows `image_1_w2` through `image_6_w2` and next image number `7`. Latest `image_6_w2` has system/current name `image_6_w2`, thumbnail URL, model `byteplus:conversation-image.seedream-4-5`, ratio `智能比例`, resolution `2K`, width `2848`, height `1600`.
- Local validation passed repeatedly with `npx tsc --noEmit`; local `http://localhost:3000/workspace` returned `200`. Local dev server was restarted via `cmd /c npm run dev` during this work; user may close/restart it with `start-project.bat` if desired.

## 2026-06-23 Protected Workflow/New-Table Deploy, Admin Idle, Agent Prompt Details, And Hotfix

- User asked that future task/todo displays use Chinese. This conversation used Chinese task labels after the request.
- User asked whether normal frontend login already logs out after 1 hour idle and whether admin does the same. Found normal user idle was implemented through `/api/auth/activity`, but admin used independent `flashmuse-admin-session` with 8-hour absolute max age. Changed admin max age to 1 hour, added `refreshCurrentAdminActivity()`, new `POST /admin/api/auth/activity`, and `AdminActivityTracker` mounted in the admin shell. Admin activity uses real pointer/keyboard/wheel/touch/scroll events and pings at most once per minute. Local `npx tsc --noEmit` passed.
- User asked whether all generated/uploaded assets are in the new media tables and whether admin reads new tables. Confirmed online/admin main media paths read `UserAssetState + MediaAsset`; historical messages/ledger metadata remain fallback/detail sources. Found Agent-generated media could lose the model-planned prompt detail because only `sourcePrompt` was persisted and constraints were not separately carried by URL.
- Fixed Agent prompt persistence. Added per-URL `imagePromptDetails` / `videoPromptDetails`, kept `MediaAsset.sourcePrompt` as the main prompt, and stored Agent hard constraints in `MediaAsset.sourceDetail` as JSON `{ "agentConstraints": [...] }`. Multi-image and multi-video results map prompts/constraints by returned URL so prompts do not get mixed. Admin user media dialog and credit/generated-record rows show main prompt in black and constraints in gray. Local `npx tsc --noEmit` passed.
- Fixed backend overview card `今日生成任务`. Large number now sums today's generated image count plus today's generated video count from `CreditLedger.imageCount/videoCount`; note text shows today's image/video counts rather than historical totals. Local `npx tsc --noEmit` passed.
- User asked for online-only asset status. Online read-only audit found `MediaAsset` effective rows around `1284` and `UserAssetState` rows `1292`; historical media references are higher because the same URL can appear in messages, references, videos arrays, and old workspace JSON. Stable local media references missing from the new table were only 4 uploaded audio/video file references; remote provider temporary URLs were explicitly confirmed not to belong in `MediaAsset.url/normalizedUrl`. Online `assetsOnly` code already returns new-table assets whenever the user has any `UserAssetState` rows, and audit found `fallbackUsers=0`, so current frontend asset library does not display extra old `state.assets` assets beyond the new table.
- Added reusable production deploy guard script `scripts/prod-deploy-snapshot.mjs`. It creates sanitized snapshots under `.runtime/deploy-checks/`, including user asset totals, active visible assets, category counts, per-user asset counts, stable local media missing from new table, fallback users, and an asset-list hash. It avoids saving signed provider query strings in docs/Git. A copy was uploaded to production as `.runtime/deploy-checks/prod-deploy-snapshot.mjs`.
- Before risky deploy, ran production snapshot `20260623-before-risk-deploy.json`: `userAssetStates=1292`, `visibleActiveAssets=1256`, category counts `character_image=102`, `conversation_images=498`, `conversation_uploads=180`, `conversation_videos=371`, `shot_image=44`, `scene_image=61`, `stableMissingInNewTable=4`, `fallbackUsers=0`, and `assetListHash=ff9ef4f9f85ff233`.
- Deployed current local workflow/new-table/admin changes with production workflow entry disabled. Production backup before deploy: `.deploy-backups/20260623-risk-flow/source-before-deploy.tgz`. Applied Prisma migrations `20260623043000_workspace_workflows` and `20260623044000_backfill_workspace_workflows` on production, ran `npx prisma generate`, then `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT broad-file warnings, PM2 restarted online, PM2 state saved, and Ali `_next/static` synced. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` remained unset/disabled.
- Post-deploy snapshot `20260623-after-risk-deploy.json` matched the before snapshot exactly. `prod-deploy-snapshot.mjs compare` returned `ok: true`; totals, category counts, per-user assets, fallback-user count, stable-missing count, and `assetListHash` were unchanged. Endpoint checks returned 200 for `/workspace`, `/admin`, `/admin?tab=server`, `/admin?tab=upload-rules`, and `/api/model-availability`.
- User then reported browser page failure: `This page couldn’t load`. HTTP `/workspace` still returned 200, but PM2 client diagnostics showed `Cannot read properties of undefined (reading 'some')` from the workspace chunk. Root cause was workflow data with `canvas` present but `canvas.nodes` absent; code used `workflow.canvas?.nodes.some(...)`, which still dereferenced `.some` on undefined. Although workflow UI entry was disabled, global workspace state calculation still ran.
- Hotfixed workflow node optional access in `chat-workbench.tsx`: changed `workflow.canvas?.nodes.forEach`, `.length`, `.some`, and `.map` paths to safe `nodes?.` access. Local `npx tsc --noEmit` passed. Hotfix backup: `.deploy-backups/20260623-workspace-crash-hotfix/source-before-hotfix.tgz`. Redeployed with the standard production script; build passed with existing warnings; PM2 restarted online and Ali static synced.
- Hotfix verification: `https://main.venusface.com/workspace`, `https://main.venusface.com/admin`, and `https://api.venusface.com/api/model-availability` returned 200; PM2 `flashmuse` was online. Hotfix snapshot `20260623-after-hotfix.json` again matched the original before snapshot exactly and compare returned `ok: true`.
- Follow-up production data fix: user asked to backfill the remaining 4 uploaded files that were not in the new media tables. Backed up the missing list to `/var/www/flashmuse/.runtime/manual-fixes/1782216984903-upload-files-mediaasset-backfill.json`, then inserted/upserted 4 `MediaAsset + UserAssetState` rows: `ID_686996` audio `佐藤声音参考.wav`, `ID_636611` video `abbbbbb.mp4`, and `ID_636611` audios `demo_chinese.mp3` / `demo_english.mp3`. Internal categories are `conversation_upload_audios` and `conversation_upload_videos`; `sourcePrompt` values are `上传音频` / `上传视频`. Verification found `remaining=0`; snapshot `20260623-after-upload-file-backfill.json` showed `stableMissingInNewTable=0`. Current deployed `/api/upload-file` already writes future uploaded video/audio/document files into new media tables.
- Important production paths from this work: snapshots under `/var/www/flashmuse/.runtime/deploy-checks/`; source backups `.deploy-backups/20260623-risk-flow/source-before-deploy.tgz` and `.deploy-backups/20260623-workspace-crash-hotfix/source-before-hotfix.tgz`. Do not delete these unless explicitly asked.
- This deployed work has not been committed or pushed to GitHub in this conversation. Before any GitHub sync, inspect `git status`, `git diff`, and `git log --oneline -10`; include `scripts/prod-deploy-snapshot.mjs`, admin idle files, workflow migrations/table code, Agent prompt-detail changes, and handover updates.

## 2026-06-23 Local Workflow Table And New-Table-Only Assets Superseded By Deploy Above

- User clarified all work in this segment is local workflow-mode work only. Do not inspect or modify production for these issues unless explicitly asked. Production workflow entry remains disabled.
- Added local Prisma workflow history foundation: `WorkspaceWorkflow` table, `User.workspaceWorkflows` relation, `workspaceKind` on `WorkspaceSession`, and `workspaceKind/workspaceId` on `CreditLedger` and `MediaAsset`. Migrations applied locally: `20260623043000_workspace_workflows` and `20260623044000_backfill_workspace_workflows`.
- Backfilled local workflow JSON into `WorkspaceWorkflow`. Verified local table rows: `12424740@qq.com / ID_779117` has `工作流_01` with 2 nodes and `工作流_02` with 1 node; `lookxun@163.com / ID_113219` has `工作流_06` with 3 nodes and `工作流_04` with 0 nodes.
- Fixed workflow refresh/list persistence. Workflow deletion is explicit soft deletion via `deletedAt`; `upsertWorkspaceWorkflows()` no longer treats missing items in a partial/stale payload as deletion. UI filters deleted workflows from the visible list.
- Workflow node media now follows conversation display rules. Node cards show generated-image thumbnails and video poster thumbnails. The preview modal uses original media. Because workflow cards are selectable/draggable, successful image/video nodes now open preview through a bottom-right eye button instead of whole-card click.
- Workflow remote-to-local replacement now also writes video `posterUrl` back into workflow nodes when `/api/media-save-status` returns saved jobs. Workflow generated local media persists as `workflow_images` / `workflow_videos` with `workflowId` and `workflowNodeId`.
- Tightened local asset source of truth. `/api/workspace-state?assetsOnly=1...` now reads only `MediaAsset + UserAssetState`; it filters unsupported remote provider URLs and missing local `/generated/...` files. Frontend no longer saves `assets` into workspace JSON. Server save strips legacy `assets`. Local real workspaces had `UserWorkspaceState.state.assets` removed.
- Diagnosed local broken asset cards for `12424740@qq.com`. Root causes were old global `/generated/images` or `/generated/videos` rows, expired TOS URLs, and a few missing local files. Cleaned local data by hiding/archiving 55 duplicate old global-path rows and 7 missing-local-file rows, and backfilled 11 existing video poster URLs. Verified visible conversation image/video bad URL count was `0` afterward.
- Verified old remote TOS URLs in local legacy JSON were all matchable through `MediaAsset.originalUrl` to local keeper rows; none needed to remain as visible asset records. Old JSON assets are now migration/recovery-only.
- Uploaded video/audio/document files now enter new media tables locally. `/api/upload-file` saves files under `/generated/users/{userId}/files/...` and upserts `MediaAsset + UserAssetState` with internal categories `conversation_upload_videos`, `conversation_upload_audios`, and `conversation_upload_documents`. Their `sourcePrompt` values are `上传视频`, `上传音频`, and `上传文档`; uploaded images remain `上传图片` / `conversation_uploads`.
- Frontend upload-file calls now pass `conversationId`, `mediaKind`, `durationSeconds`, and `dimensions`. `/api/media-assets` accepts the upload-file internal categories and recognizes media types `video`, `audio`, and `document`. Asset sidebar UI for uploaded video/audio/document categories was intentionally not added yet.
- Video BytePlus asset review/reference lookup, credits asset-generation counts, and admin media source paths were adjusted locally away from old `state.assets` as source of truth. Historical message parsing remains for conversation detail display and uploaded-file lists.
- Local `npx tsc --noEmit` passed after these changes. `npx prisma generate` succeeded after stopping the local dev server that had locked Prisma engine files on Windows. Local `npm run dev` was restarted and `http://localhost:3000` returned `200`.
- This section records the earlier local-only state at that time. It was later superseded by the protected production deploy documented above. The deployed work is still uncommitted/unpushed after the latest conversation.

## 2026-06-23 Final Cleanup, History Count, And GitHub Sync Prep

- User asked to continue with short direct replies, deploy all local changes while keeping production workflow mode disabled, then clean up the closed `07` remote-video investigation and sync to GitHub.
- Backend `服务器信息` tab was fixed and polished after deployment. Production no longer tries to SSH to Malaysia with a local Windows key path; it reads Malaysia locally and Ali through `/root/.ssh/flashmuse_to_ali_ed25519`. Disk rows now show the existing text plus blue `#367cee` usage progress bars. Entering the tab automatically reads once; the manual refresh button remains.
- Conversation history sidebar count was fixed. The number beside `历史对话` now uses `sessionsTotalCount` returned by `/api/workspace-state`, so it includes conversations that have not been loaded into the sidebar page yet. New/delete local actions update the number optimistically.
- Closed `handover/07-remote-video-url-debug.md` as a confirmed home-network/environment issue. The user retested from the home computer and all local/online test pages displayed normally.
- Removed all direct `07` debug/test artifacts: temporary debug React components, remote-video diagnostic event logging, special `manual-video-6-d27` test rendering, local and production test HTML pages, local desktop test pages, local and production d27 temp scripts, the production test `WorkspaceMessage`, and legacy `UserWorkspaceState.state.assets` residue. `/api/media-proxy` was removed after `getVideoPlaybackUrl()` was changed back to direct provider URLs.
- Important production cleanup backups retained: `.runtime/manual-fixes/1782149819716-remove-manual-video-6-d27-test-message.json` and `.runtime/manual-fixes/1782150671551-remove-07-state-residue.json`. Do not delete runtime or deployment backups unless the user explicitly asks.
- Verified after these changes: local `npx tsc --noEmit` passed repeatedly; production builds passed with only existing Turbopack/NFT warnings; PM2 stayed online; `/workspace`, `/admin?tab=server`, and `/api/model-availability` returned 200. Workflow production entry remained disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false.
- User then requested a GitHub sync and final handover update. Memo `M004 Commit Deployed Local Changes` was marked completed. Main deployed-change commit pushed to GitHub: `17806ea Sync deployed media and workflow updates`. Future deployed local changes should be treated as a new GitHub sync task.

## 2026-06-23 Full Local Deploy With Workflow Disabled

- User requested deploying all current local changes while keeping online workflow mode disabled.
- Confirmed `WORKFLOW_MODE_ENABLED` defaults to disabled in production when `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false. Production `.env.local` did not enable it.
- Local `npx tsc --noEmit` passed.
- Created local deployment archive excluding `.env`, `node_modules`, `.next`, `.git`, `.runtime`, `.deploy-backups`, and `public/generated`; uploaded it to Malaysia and extracted into `/var/www/flashmuse`.
- Production source backup: `/var/www/flashmuse/.deploy-backups/20260623-full-local-deploy/source-before-deploy.tgz`.
- Ran `/usr/local/bin/deploy-flashmuse-production.sh`. Production build passed with only existing Turbopack/NFT broad-file-pattern warnings, PM2 `flashmuse` restarted online, PM2 state was saved, Ali `_next/static` synced, and Ali Nginx cache was cleared.
- Verified production status: workflow env disabled/unset; `https://main.venusface.com/workspace`, `/admin`, `/admin?tab=upload-rules`, `/admin?tab=server`, and `https://api.venusface.com/api/model-availability` all returned 200.
- Deployed content includes the standalone backend `上传规则` tab, standalone `服务器信息` tab, `/admin/api/server-info`, workflow foundation code, workflow asset persistence categories, and 1-hour idle auth/session behavior. Workflow code is present online but the user-facing workflow entry remains disabled.
- Follow-up fixed `服务器信息` production reading. The deployed API was still trying to SSH from Malaysia to Malaysia with the local Windows key path `E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem`, causing all rows to fail. Production Linux now reads Malaysia server info locally with `bash -s` and only SSHes to Ali through `/root/.ssh/flashmuse_to_ali_ed25519`. Local `npx tsc --noEmit` passed; redeployed with the standard production script; PM2 stayed online; `/admin?tab=server` returned 200. Direct Malaysia -> Ali SSH hostname check succeeded.
- User confirmed the temporary remote video black-player issue was caused by yesterday's home network. On 2026-06-23, the home computer could display all test pages correctly. Cleaned up direct debug artifacts: removed `PlainRemoteVideoDebug`, `IframeRemoteVideoDebug`, `StaticPageVideoDebug`, remote video event diagnostics, special `manual-video-6-d27-temp-url-test` rendering, local/production video test HTML pages, desktop test pages, and local/production temporary d27 scripts. Local `npx tsc --noEmit` passed and production deployment passed with only existing Turbopack/NFT warnings; `/workspace` and `/api/model-availability` returned 200.
- Follow-up removed the actual production workspace test message that still showed `临时远程URL测试卡片：video_6_d27` in user `ID_636611`, session `2e45f329-8cd6-4861-9bee-33714c01c59c`. It was backed up to `.runtime/manual-fixes/1782149819716-remove-manual-video-6-d27-test-message.json` and deleted from `WorkspaceMessage`. Verification found no remaining `manual-video-6-d27-temp-url-test` in `WorkspaceMessage` or active workspace JSON; `/workspace` returned 200.
- Final cleanup changed `getVideoPlaybackUrl()` so remote video URLs play directly from the provider URL again, then removed `src/app/api/media-proxy/`. Local `npx tsc --noEmit` passed. Production deploy passed with only existing Turbopack/NFT warnings; the build route list no longer contains `/api/media-proxy`; PM2 stayed online; `/workspace` and `/api/model-availability` returned 200; production source has no `media-proxy` references.
- Final residue audit found one old `UserWorkspaceState.state.assets` entry for `ID_636611` still pointing to `manual-video-6-d27-temp-url-test`. It was backed up to `.runtime/manual-fixes/1782150671551-remove-07-state-residue.json` and removed. Re-audit found no matching `WorkspaceMessage`, active workspace JSON entry, or `MediaAsset`; `/workspace` returned 200. Local one-time audit scripts were deleted after use.
- Condensed `handover/07-remote-video-url-debug.md` into a short closed-issue summary and removed the obsolete next-action reminder to keep retesting the home-network issue.

## 2026-06-22 Local Workflow Foundation And Idle Session Changes

- User asked to continue local workflow mode and clarified workflow mode and conversation mode are two different UIs over the same generation, saving, asset, and billing chain. None of the work in this section has been deployed.
- Fixed a workflow persistence bug: `/api/workspace-state?summary=1&panel=chat` previously returned shell state without `workflowItems`, so the frontend could load an empty workflow list and autosave over workflows such as `工作流_01/02/03`. `getWorkspaceShellState()` now includes `workflowItems` and `nextWorkflowNumber`.
- Workflow state remains stored in `UserWorkspaceState.state.workflowItems`; no workflow table was added. `workflowItems` now have `createdAt`, `updatedAt`, optional `usageSummary`, and `canvas`. `nextWorkflowNumber` is persisted so automatic names never reuse deleted numbers.
- Workflow list behavior now mirrors conversation basics: first load guarantees one untitled `新工作流`; clicking new while a `新工作流` exists reuses it; first real canvas action renames it to `工作流_01`, then `工作流_02`, etc.; deleting a numbered workflow does not free its number; deleting the last workflow creates a new `新工作流`; sidebar initially shows 10 workflows and loads 5 more.
- Clarified that a numbered workflow with all nodes deleted is not considered empty/untitled. Only an actual `新工作流` blocks creating another new workflow.
- Added workflow asset library UI under `对话流资产`: new group `工作流资产` with `生成图片` and `生成视频`. Frontend asset filters now include `workflow_images` and `workflow_videos`; server legacy asset mapping now returns `librarySource="workflow"` for workflow categories so workflow assets do not appear in conversation asset filters.
- Workflow local media persistence was added. Local workflow node images/videos are posted to `/api/media-assets` with `currentCategory="workflow_images"` or `workflow_videos`, `workflowId`, and `workflowNodeId`. Remote-to-local media-save polling already includes workflow nodes and persists saved local URLs.
- Added real workflow node UI/functionality in `src/components/workflow-canvas.tsx`. Text nodes correspond to Agent text generation via `/api/chat`; image nodes correspond to image generation via `/api/image`; video nodes correspond to video generation via `/api/video` create + polling. Nodes can consume upstream text and upstream image outputs.
- Workflow node UI now has display card, waiting card, failed card, success card, selected 1px blue card border, left/right `+` ports, and separate node-bound input. The input was repeatedly adjusted per user feedback to match the conversation input: 680px wide, centered under the display card, same `rounded-[26px]` shell, same `yinzao-tool-button` controls, same black send button with up arrow, same custom model/settings/duration popup menu styling, and popup menus at `z-[10000]` above the connection buttons.
- Workflow model menus now use the same enabled model lists as conversation generation. `ChatWorkbench` passes `enabledGenerationModelIds.image` and `.video` into `WorkflowCanvas`; disabled backend models disappear from workflow image/video nodes just like conversation mode. Saved disabled node models fall back to the first enabled model.
- Added workflow usage button in the top-right of the workflow workbench, using the same `UsageSummaryButton` idea as conversation mode. Text/image/video node usage and charged credits are accumulated into `WorkflowItem.usageSummary`; media counts are computed from workflow node outputs.
- Changed local auth/session behavior. Normal user `flashmuse-session` max age changed from 30 days to 1 hour. `getCurrentSession()` no longer refreshes expiry on routine auth reads. New `POST /api/auth/activity` extends `Session.expiresAt` and cookie max age only for real activity. Homepage and workspace listen to pointer, keyboard, wheel, touch, and scroll events and call this endpoint at most once per minute.
- Background polling no longer extends session idle time. `/api/auth/me`, `/api/auth/workspace-instance`, autosave, model/media polling, and other automatic requests should not refresh expiry. While any conversation generation, asset generation, or workflow node generation is running, the workspace treats the waiting card as activity and calls `/api/auth/activity` every 5 minutes so long model waits do not log users out.
- Local validation after these workflow/auth changes repeatedly passed with `npx tsc --noEmit`. No production deploy was performed.

## 2026-06-22 Local Admin Navigation, Upload Rules, And Server Info

- User clarified `07-remote-video-url-debug.md` should be paused. The temporary remote video problem was found while at home remote-controlling the office PC; tests from the office PC and office network could play the same remote URLs. Future AIs should remind the user to retest from home and treat it as possibly home-network/environment related before making more code changes.
- Added local-only backend `服务器信息` work. New API `src/app/admin/api/server-info/route.ts` collects Ali and Malaysia server info for a three-column table: title, Ali server, Malaysia server. Rows include server hostname/IP, system disk `/`, app directory disk, current network speed, NIC bandwidth, default NIC, CPU cores/load, memory, uptime, and server time. Disk values are formatted in G with three decimals.
- Initial server-info UI was put under system settings, then user corrected that it should be independent. Added standalone `src/app/admin/admin-server-info-panel.tsx` and backend tab `/admin?tab=server` below system settings.
- Local testing showed manual PowerShell SSH to Malaysia works and `Test-NetConnection 101.47.19.109 -Port 22` succeeds, but Node/Next child-process SSH from local Windows can time out. User accepted that server info is intended for online use and should be tested after deployment, where the Malaysia server can read itself and SSH to Ali using `/root/.ssh/flashmuse_to_ali_ed25519`.
- User asked to split upload rules out of system settings and place it between system settings and server info. Added standalone `src/app/admin/admin-upload-rules-panel.tsx`, removed upload-rule table from `src/app/admin/admin-system-settings-panel.tsx`, and added backend tab `/admin?tab=upload-rules` between `系统设置` and `服务器信息`.
- Local validation passed: `npx tsc --noEmit`; local `/admin?tab=settings`, `/admin?tab=upload-rules`, `/admin?tab=server`, and `/workspace` returned 200. These admin navigation/server-info/upload-rule split changes are local only and were not deployed in this step.

## 2026-06-22 Admin Records Model Interaction Sort

- User asked to sort the right-side table in backend `生成记录` by the account's latest model interaction, including image generation, video generation, Agent/chat, reverse prompt, prompt optimization, and recorded failed model requests.
- Changed `src/app/admin/page.tsx` records-tab summary sorting to use the latest `CreditLedger.createdAt` where `direction="consume"` per user, instead of mixing workspace/user update time, asset update time, or credit grant/admin-adjust rows.
- Local `npx tsc --noEmit` passed. Deployed to Malaysia production with backup `.deploy-backups/20260622-admin-records-model-interaction-sort`; production build passed with only existing Turbopack/NFT warnings; PM2 `flashmuse` online; `/admin?tab=records`, `/workspace`, and `/api/model-availability` returned 200.

## 2026-06-22 Main Generated Media URL Fix

- User reported newly generated `video_1_d27` did not display.
- Production DB lookup found workspace message `81f8dcd5-180b-4e4a-bae8-b15e482ec6a7` / session `2e45f329-8cd6-4861-9bee-33714c01c59c` / user `ID_636611` was complete: `pendingVideoCount=0`, `statusText="视频已生成完成"`, `videoUrl=/generated/users/ID_636611/videos/1782061920015-11b34921-31ec-444d-bd91-9440c9847fe1.mp4`, `mediaSystemNames` mapped that URL to `video_1_d27`, and poster URL existed.
- Server files existed: mp4 size `5825456`, poster size `27921`. `https://main.venusface.com/generated/users/ID_636611/videos/1782061920015-11b34921-31ec-444d-bd91-9440c9847fe1.mp4` returned `200 OK` with `Content-Type: video/mp4`.
- Static-domain checks for the same file on `https://static.venusface.com/...` and `https://ali.venusface.com/...` failed TLS/handshake locally. This matched the known memo/static-domain concern and pointed to frontend URL rewriting as the likely display issue.
- Fixed `getStaticMediaUrl()` in `chat-workbench.tsx`: when the current hostname is `main.venusface.com`, `api.venusface.com`, or `101.47.19.109`, do not rewrite generated media to `NEXT_PUBLIC_STATIC_BASE_URL`; use same-origin `/generated/...` paths.
- Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-main-generated-media-url`; production build passed with only existing Turbopack/NFT warnings; PM2 online; Ali `_next/static` synced; `/workspace`, target mp4 URL, and `/api/model-availability` returned 200.
- User clarified the actual issue was before local save: the temporary video stage showed `视频已生成` but only an empty player, then about one minute later local save completed and the poster appeared. Runtime mapping confirmed `video_1_d27` poll success returned a BytePlus/TOS temporary mp4 while media save job `2bdd876987e19e6e91607806` was still `pending`; the next video request `8e641357-a947-476c-a1e3-04c53c692813:video:0` had the same pattern.
- Temporary TOS URLs tested from production returned `206` for `GET` with `Range: bytes=0-1023`, `Content-Type: video/mp4`, and `Accept-Ranges: bytes`, but returned `403` for `HEAD` and had no poster. The frontend was rendering no-poster videos with `preload="metadata"`, which can leave an empty player until local poster replacement.
- Changed `InlineVideoResult` so videos without a poster use `preload="auto"`; poster-backed local videos still use `preload="none"` behind the poster. Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-temp-video-preload-auto`; production build passed with only existing Turbopack/NFT warnings; PM2 online; Ali `_next/static` synced; `/workspace` and `/api/model-availability` returned 200.
- User retested and the temporary stage still showed a black empty player. Added `/api/media-proxy` as a same-origin proxy for whitelisted remote provider media hosts, preserving browser `Range` requests and forwarding `content-type`, `content-length`, `content-range`, and `accept-ranges`. Remote video playback now uses `/api/media-proxy?url=...` until local `/generated/...` replacement; local videos remain direct/static URLs. Production verification against the latest temporary video returned `206`, `Content-Type: video/mp4`, `Content-Range: bytes 0-1023/...`, `Accept-Ranges: bytes`, and 1024 bytes. Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-temp-video-media-proxy`; production build passed with only existing warnings; PM2 online; `/workspace` and `/api/model-availability` returned 200.
- User retested again and the temporary stage still showed a black player. Rechecked historical handover and old committed `InlineVideoResult`: the previous working path used direct provider temporary URLs in `<video src>`, not a same-origin proxy. Production Nginx logs confirmed browser requests to `/api/media-proxy` came through Ali and returned `200` full-stream responses, not browser-originated remote Range behavior. Latest BytePlus mp4 inspection showed `moov` near the end (`moov=1310307`, `mdat=21720`, size `1315537`), so metadata/first frame may not appear until enough data is loaded. Final follow-up reverted remote video playback to direct provider URLs and added `autoPlay` + `muted` only for temporary remote no-poster inline videos. Saved local videos with posters remain non-muted and poster-backed. Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-temp-video-direct-muted-autoplay`; production build passed with only existing warnings; PM2 online; `/workspace` and `/api/model-availability` returned 200.
- User tested the exact latest temporary URL in a local standalone HTML under `C:\Users\ASUS\Desktop\aaa\test-temp-video.html`, and it played successfully. This proved the URL itself was playable. The project markup differed: `InlineVideoResult` nested `<video controls>` inside an outer `<button>`, and the video element only had `max-h/max-w` without `h-full w-full`, giving a small default video control box. Updated `InlineVideoResult` to use an outer `div`; poster state is now a child button, and real videos are no longer inside a button and fill the media card. Double-clicking the video opens preview. Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-video-element-no-button-wrapper`; production build passed with only existing warnings; PM2 online; `/workspace` and `/api/model-availability` returned 200.
- User then modified the local HTML to mimic the original project structure more closely: `button > video`, not full-size video, hover-to-play/mouseleave-pause, default non-muted, and click-to-preview behavior. The temporary URL still played. Per user request, project `InlineVideoResult` was restored to the original shape (`button > video`, `preload="metadata"`, no forced muted/autoplay, no full-size video class) and deployed with backup `.deploy-backups/20260622-video-card-restore-original`; build passed and `/workspace` / `/api/model-availability` returned 200.
- For controlled testing without generating new videos, user `ID_636611` production `video_6_d27` was replaced in `WorkspaceMessage` and active workspace state from local URL `/generated/users/ID_636611/videos/1782066178925-fe4138eb-99a4-4cec-a1d8-04abb16589fd.mp4` to the latest BytePlus temporary URL. Original JSON backup was written to `.runtime/manual-fixes/1782067671244-video_6_d27-replace-url.json`. A temporary helper script `tmp/replace-video-system-name-url.js` was used for this manual test.

## 2026-06-22 Image Upload Retry Reencode Fallback

- User noted image upload now succeeds after the unusual JPEG fix, but the progress UI quickly reaches 95% and waits, making the percentage look fake.
- Confirmed the progress was real browser upload progress capped at 95%; the wait was server-side image ffmpeg re-encoding before the response reached 100%.
- Changed temporary image upload strategy: normal `/api/asset-upload-temp` image upload now uses a fast server write path for JPEG uploads instead of always ffmpeg re-encoding every image. Non-JPEG server inputs and explicit fallback retries still use ffmpeg to produce standard JPG.
- Added `forceReencode=1` support to `/api/asset-upload-temp` POST. When set, the server directly ffmpeg re-encodes the uploaded image before returning a temp token.
- Added blue `重试` action to failed image upload cards in both places: chat/workspace input uploaded images and asset-library upload dialog slots. Retry keeps the original `File`, restarts upload, and sends `forceReencode=1`, so only failed uploads pay the re-encoding cost.
- Local `npx tsc --noEmit` passed. Deployed to Malaysia production after backing up changed production files to `.deploy-backups/20260622-upload-retry-reencode`. Production build passed with only the existing Turbopack/NFT broad-file-pattern warnings; PM2 `flashmuse` stayed online; Ali `_next/static` synced; `/workspace`, `/admin`, and `/api/model-availability` returned 200.
- User retested and found behavior still looked unchanged: uploads still sat at `95%`, and the two unusual JPEGs still succeeded first try. Root cause: frontend image selection still pre-converted uploaded images through canvas before upload, so the server retry fallback was not the only re-encoding path. Follow-up changed chat input and asset-library upload selection to keep the original `File` for first upload and use original data URL only for preview. The progress overlay now displays `处理中` instead of `95%` while waiting for the server response.
- Local `npx tsc --noEmit` passed after the follow-up. Deployed with backup `.deploy-backups/20260622-upload-original-first-followup`; production build passed with only existing Turbopack/NFT warnings; PM2 `flashmuse` stayed online; Ali `_next/static` synced; `/workspace`, `/admin`, and `/api/model-availability` returned 200.
- User then clarified the target behavior again and asked to consult historical handover docs. Historical docs confirmed the older upload flow had intentionally pre-converted uploaded images through canvas before temporary upload; therefore the desired behavior is a new flow, not simply restoring history. Also confirmed the reported unusual JPEGs can be decoded by ffmpeg, and a pure first-write server path would naturally return success because it does not inspect pixels.
- Final correction: progress overlay was restored to numeric percentages, not `处理中`. `saveTemporaryUploadedImageBuffer()` now keeps the first upload as a no-transcode fast path, but rejects JPEGs requiring re-encoding before writing the temp file. The current rule accepts common 4:2:0 JPEG sampling and rejects the two desktop `aaa` JPEGs, which use unusual component sampling (`0x12/0x12/0x12`). Failed cards still show blue `重试`; retry sends `forceReencode=1` and uses ffmpeg re-encoding.
- Local validation showed both `C:\Users\ASUS\Desktop\aaa\微信图片_20260621163735_226_428.jpg` and `微信图片_20260621163713_225_428.jpg` return `FAIL_FIRST_UPLOAD` under the new first-upload rule. Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-upload-first-fail-retry-reencode`; production build passed with only existing Turbopack/NFT warnings; PM2 online; Ali `_next/static` synced; `/workspace`, `/admin`, and `/api/model-availability` returned 200.

## 2026-06-21 Video Completion Chain Hardening

- User reported `312876953@qq.com` / `ID_686996` had a video generation stuck for over 30 minutes with no error.
- Read-only production diagnosis found BytePlus task `cgt-20260621173327-b4t82` for request `23f5c910-dea5-4542-8dbb-79d7525e1eb2:video:0` had already succeeded at `2026-06-21T09:52:28Z`, and media-save job `58c1858f112f0b27dad3043d` saved local video `/generated/users/ID_686996/videos/1782035548330-deeaf7f6-f09f-4f9f-a0a6-378b30bd48e7.mp4` plus poster. The file returned 200 on `main.venusface.com`.
- Root issue was not model generation. The workspace message could remain in `视频生成中` when the frontend success state was not persisted, and `MediaAsset` upserts could fail on data/oversized URLs with Postgres `index row requires ... maximum size is 8191`.
- Production data for that task was verified/restored: workspace message now has local `videoUrl`, `videos`, poster, `mediaSystemNames` entry `video_19_d1`, `pendingVideoCount=0`, and `statusText="视频已生成完成"`. `MediaAsset + UserAssetState` row exists under `conversation_videos` and is not hidden or deleted.
- First hardening attempt in `src/app/api/video/route.ts` briefly waited for `media-save-queue` and returned local `/generated/...` when safe. This was deployed, then superseded in the later `Temporary-URL-First Media Flow Restored` section because the intended product rule is fastest possible temporary URL display followed by background local replacement.
- Added `waitForMediaSaveJob()` in `src/lib/media-save-queue.ts`.
- Hardened `src/lib/media-assets.ts`, `/api/media-assets`, and `workspace-sessions.ts`: data URLs and oversized normalized URLs are skipped instead of inserted into indexed columns; saved remote URLs resolve to local media rows before upsert; workspace message saving catches media-asset sync errors so asset sync failures do not block chat/workspace persistence.
- Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260621-video-completion-chain-fix`; production build passed with only existing Turbopack/NFT broad-file-pattern warnings; PM2 online; `/workspace`, `/admin`, and `/api/model-availability` returned 200. Deployed hashes matched local hashes for the five changed code files.

## 2026-06-21 Temporary-URL-First Media Flow Restored

- User clarified the intended media chain: provider temporary URLs should be shown immediately for speed; backend saves them asynchronously; once local `/generated/...` exists, chat, preview, top-right download, asset list, and asset table should replace/use the local URL. Temporary URLs are not asset-table primary URLs.
- Revised the previous conservative video completion change. `/api/video` now returns the provider URL immediately after provider success while queueing background save, rather than waiting for local download. The response still includes save status/job metadata.
- Tightened `src/lib/media-assets.ts`, `/api/media-assets`, and workspace media sync so unsaved remote provider URLs are skipped for `MediaAsset.url/normalizedUrl`. Own-domain `/generated/...` absolute URLs normalize to path-only `/generated/...`. Saved remote jobs resolve to their local URL before asset upsert.
- `src/components/chat-workbench.tsx` now avoids calling `/api/media-assets` for remote generated URLs. The existing `/api/media-save-status` polling replacement path now also persists the saved local URL to `/api/media-assets` after replacing chat/session media, preview source, download source, assets, and generation jobs. Preview download is available for temporary remote URLs too.
- Added `.runtime/media-url-map.md` append logging from `media-save-queue` when a remote media job saves locally. It records user ID, request ID, type, model, job ID, local URL, poster URL, and remote URL for operational troubleshooting. This runtime file is not for Git or handover docs because signed URLs may be sensitive/temporary.
- Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260621-temp-url-first-media-chain`; production build passed with only existing Turbopack/NFT broad-file-pattern warnings; PM2 online; `/workspace`, `/admin`, and `/api/model-availability` returned 200. Deployed hashes matched local for `media-save-queue.ts`, `media-assets.ts`, `workspace-sessions.ts`, `/api/video`, `/api/media-assets`, and `chat-workbench.tsx`.

## 2026-06-22 Core Media Chain Audit Follow-Up

- User emphasized image/video generation is the core chain and future workflow must reuse the same stable flow.
- Re-audited the temporary URL -> background save -> local URL replacement -> asset persistence path. Found two hardening gaps: local asset persistence was tied to UI preload readiness, and workflow canvas media was not included in the remote URL polling/replacement path.
- Fixed `chat-workbench.tsx` so saved local media is persisted to `/api/media-assets` from all saved jobs even when UI replacement is delayed by preload/static sync readiness. UI replacement still only happens after preload says the local media is safe to display.
- Added workflow coverage in `chat-workbench.tsx`: remote URLs inside workflow canvas node `images` and `videoUrl` are now collected for `/api/media-save-status`, replaced with local URLs when ready, and persisted with `workflow_images` / `workflow_videos` categories. This prepares the current disabled workflow code to use the same core media chain once opened.
- Updated `/api/media-assets` to store `workflowId` and `workflowNodeId` when provided.
- Local `npx tsc --noEmit` passed. Deployed with backup `.deploy-backups/20260622-core-media-chain-audit-fix`; production build passed with only existing Turbopack/NFT broad-file-pattern warnings; PM2 online; `/workspace`, `/admin`, and `/api/model-availability` returned 200. Deployed hashes matched local for `/api/media-assets` and `chat-workbench.tsx`.

## 2026-06-21 Admin, Memo, Asset Stability, And Upload Fixes

- User asked to read current handover first and continue with short direct replies. Current truth remains under `handover/`; archived `historical-handover-docs-last-used-2026-06-20/` is read-only backup only.
- Added active memo task process. New file `handover/06-memo-tasks.md` was created and added to `00-README.md` read order. Current memo tasks use checkbox IDs `M001` etc.; each item has a temporary reason and what to do later. User rule: future “do not do now but maybe later” items go there, and completed/no-longer-needed memo tasks get checked with `[x]`.
- Admin credits list sorting was changed: `后台 -> 积分管理` rows now sort by latest `CreditLedger.createdAt` descending. Deployed with backup `.deploy-backups/20260621-admin-credit-last-change-sort`; build passed and `/admin?tab=credits` returned 200.
- Admin system settings upload-rule table was expanded. BytePlus image model rows now include image-reference full rules and clarify official URL max 14 vs current local/Base64 frontend max 6. Seedance 2.0 video row now includes image-reference rules in the image column: formats, max 9 images, <=30MB each, reference/first-frame/first-last-frame behavior. Confirmed current code has no image width/height limit. Deployed with backup `.deploy-backups/20260621-admin-upload-rules-image-reference`.
- Clarified server-to-provider public URL work as memo `M001`: current server still converts local `/generated/...` references back to base64 for provider requests in `toDataUrlIfLocalPublicAsset()` paths; after domain changes, change this to stable public HTTPS URLs and verify provider reachability.
- Diagnosed asset category rollback for user `312876953@qq.com` / `ID_686996`. Root cause was that ordinary `POST /api/media-assets` could overwrite an existing `UserAssetState.currentCategory`, so later sync/upsert could reset manually moved assets back to `conversation_images`. Fixed `/api/media-assets` so existing states with `userRecategorized` or `lockedCategory` preserve `currentCategory`; explicit `PATCH` still moves assets. Deployed with backup `.deploy-backups/20260621-asset-category-preserve`.
- Stabilized asset category loading. Frontend now reloads current category when not loaded or empty with a server count, but no longer reloads page 1 solely because server count exceeds currently loaded count. This prevents the 30-item pagination loop where `正在加载中...` and images repeatedly jumped. Deployed with backup `.deploy-backups/20260621-asset-pagination-loop-fix`.
- Changed asset pagination to 30 items per page and local render batch to 30. User-triggered scroll-to-bottom loading shows `正在加载中...`; automatic fill-screen loading does not show the bottom text. Deployed with backup `.deploy-backups/20260621-asset-page-size-loading`.
- Removed group-header totals from the asset sidebar for `对话流资产` and `回收资产30天删除`; individual category counts remain. Deployed with backup `.deploy-backups/20260621-asset-sidebar-group-counts`.
- Backfilled six missing upload-image references for `ID_686996` into `MediaAsset + UserAssetState`. Final verified `WorkspaceMessage` media gap for that account is `0`. Backfilled rows preserve current old-workspace positions: `0f7d79ad26f21e3a16753c97`, `image_7_d11`, and `0b24b2d0ddd0f0eb8817fc61` under `character_image`; `加贺号` and `羽黑号` under `scene_image`; `e806dbc65a105af4d0c7580b` as deleted `conversation_uploads`. All use `sourcePrompt="上传图片"` and `promptSource="upload"`.
- Investigated two desktop test JPEGs under `C:\Users\ASUS\Desktop\aaa`: `微信图片_20260621163735_226_428.jpg` and `微信图片_20260621163713_225_428.jpg`. They are small 1280x720 JPEGs but have unusual `Lavc61.3.100`/MJPEG-style encoding. Windows, sharp, and ffmpeg can decode them; server ffmpeg re-encoding succeeds.
- Fixed image upload failures. Initial suspicion was browser canvas conversion, so frontend got a fallback: if canvas JPEG conversion fails or times out after 5s, upload original file. Server `saveUploadedImageBufferAsset()` and `saveTemporaryUploadedImageBuffer()` now always re-encode uploaded image buffers via ffmpeg into standard JPG, even if MIME is JPEG. Final root cause for the user-visible failure was cross-origin temporary upload from `ali.venusface.com` to `api.venusface.com`: browser XHR errored after `/api/upload-token` and before image POST reached the server. Fixed temporary image upload to use same-origin `/api/asset-upload-temp` for POST/PATCH/DELETE instead of `NEXT_PUBLIC_UPLOAD_BASE_URL`. Deployed through backups `.deploy-backups/20260621-upload-image-fallback`, `20260621-upload-image-conversion-timeout`, `20260621-upload-diagnostics`, and final `.deploy-backups/20260621-same-origin-image-upload`.
- User-facing upload failure cards were restored to generic `上传失败`. Detailed browser-side diagnostics remain logged via `/api/client-error` with `source="client-diagnostic"`; do not show raw network/CORS details to users.
- All deployments used `/usr/local/bin/deploy-flashmuse-production.sh`; builds passed with only the existing Turbopack/NFT broad-file-pattern warning; PM2 stayed online; Ali `_next/static` was synced; `/workspace` and `/api/model-availability` returned 200 after final checks.

## 2026-06-21 Seedance Reference Audio/Video And Asset Rule Work

- User clarified product rules: all generated/uploaded images and videos are platform assets; user-facing `@` menu should only list role, scene, shot, and upload-image groups, but manually typed `@` can still resolve conversation references.
- Audited current asset implementation. Key gaps found: uploaded-image reverse prompts were not persisted to new media tables; conversation uploads/generated media relied too much on workspace autosave; upload placeholders were inconsistent; manual typed `@` outside the four menu categories was intentionally kept.
- Fixed uploaded-image reverse prompt persistence: reverse prompt writes to `MediaAsset.reversePrompt`, workspace assets and admin media display prefer it, and uploaded images with reverse prompts no longer show the reverse button.
- Unified upload-image placeholder text to `上传图片`; legacy `资产库上传` and `对话流上传` remain compatibility-only. Conversation uploads no longer infer role/scene/shot types from filename/context.
- Added immediate `/api/media-assets` persistence for conversation uploads and generated conversation images/videos. `/api/media-assets` `PATCH` now supports `reversePrompt`, OR lookup by asset ID/media ID/URL, and fallback row creation by URL for legacy/local-only items.
- Deployed the asset/media-table work. Representative backup: `.deploy-backups/20260621045656-asset-rules-media-table`. Production build passed with the existing Turbopack/NFT warning, PM2 stayed online, and `/workspace`, `/admin`, `/api/model-availability` returned 200.

## 2026-06-21 BytePlus Seedance Audio/Video Reference Uploads

- User asked to support audio and video uploads only under the two BytePlus Seedance video models.
- Reviewed BytePlus docs for Seedance 2.0 video API. `generate_audio` defaults to true; output audio is mono. Reference video uses `type="video_url"`, `role="reference_video"`; reference audio uses `type="audio_url"`, `role="reference_audio"`. Audio cannot be input alone; at least one reference image or video is required.
- `src/lib/upload-rules.ts` already had video/audio rule slots. Kept that structure and implemented actual UI/request handling in `src/components/chat-workbench.tsx`, `/api/video`, and `src/lib/openrouter-video.ts`.
- Current Seedance upload limits implemented: video `mp4/mov`, max 3, each 2-15s and <=50MB, total duration <=15s, aspect ratio 0.4-2.5, dimensions 300-6000px, total pixels 409600-2086876; audio `mp3/wav`, max 3, each 2-15s and <=15MB, total duration <=15s. Browser metadata duration checks allow 0.35s tolerance around exact limits.
- Audio/video uploads use existing `uploadedFiles`, save through `/api/upload-file` under `/generated/users/{userId}/files/`, and pass public URLs to BytePlus. Input cards show file-style rectangles with audio/video icons.
- Input media cards behavior: uploading cards cannot open preview and show `文件上传中`; completed audio/video cards insert `@文件名` when clicked. A small `@` button remains. Sent prompt text should render `@文件名` in blue with a small audio/video icon, and only the icon opens preview playback.
- `/api/video` now accepts `referenceVideos` and `referenceAudios`; `openrouter-video.ts` includes them in BytePlus `content` as `video_url/reference_video` and `audio_url/reference_audio`.
- Deployed initial support and follow-ups. Backups included `.deploy-backups/20260621053806-seedance-av-upload`, `20260621055453-media-mention-preview-fix`, `20260621060108-media-duration-epsilon`, `20260621061058-media-input-mention-click`, `20260621061807-media-prompt-inline-render`, and `20260621062457-assistant-uploaded-files-fix`.
- Important bug found and fixed: `appendAssistantMessage()` originally dropped `payload.uploadedFiles`, so assistant video prompt blocks could not render media-file `@` mentions. Fixed and deployed in `.deploy-backups/20260621062457-assistant-uploaded-files-fix`.
- Important bug found and fixed: replay/regenerate and failed-card retry restored only image references and lost uploaded `referenceVideos/referenceAudios`. `video_5_d24` was diagnosed from production DB: its message had `abbbbbb.mp4` and `demo_chinese.mp3` in `uploadedFiles`, but diagnostics showed the actual BytePlus request only sent one `reference_image`. New replay/retry requests now preserve video/audio references. Deployed in `.deploy-backups/20260621065215-replay-media-references`.

## 2026-06-21 BytePlus Review Notice And Admin Upload Rule Table

- User reported BytePlus automatic image review did not show the blue system notice. Production `.runtime/video-diagnostics-log.jsonl` confirmed backend review events were occurring.
- First fix made review notices show when `autoBytePlusAssetReview.triggered` appeared outside `status="reviewing"`. Deployed in `.deploy-backups/20260621063426-byteplus-review-notice-once`.
- True root cause was then confirmed: review notice de-duplication checked whether any prior message in the whole conversation had the same text, so later reviews in the same conversation were suppressed. Fixed de-duplication to be per request only. Deployed in `.deploy-backups/20260621064500-review-notice-per-request`.
- Rule now: every new image entering automatic BytePlus review should append the blue system notice `系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....`; do not duplicate within the same video request.
- User asked to update the admin system settings upload-rule table. Removed the red unfinished notes for BytePlus Seedance reference video/audio. Added completed video rules to the video column and completed audio rules to the audio column, not under the usage-scenario note. Deployed in `.deploy-backups/20260621065646-admin-upload-rules-text` and corrected column placement in `.deploy-backups/20260621065952-admin-upload-rules-columns`.
- All deployments in these sections used `/usr/local/bin/deploy-flashmuse-production.sh`; builds passed with only the existing Turbopack/NFT warning, PM2 was online, and basic endpoint checks returned 200.

## 2026-06-21 Handover Sync For Current Conversation

- User requested all work from this conversation be written into current handover docs and changelog so the next AI can continue with memory.
- Updated current handover docs with the latest admin optimization, asset sidebar/upload category rules, upload size/Nginx fix, thumbnail fallback, move-target behavior, and image reference sync/backfill notes.
- Historical handover archive remains read-only under `historical-handover-docs-last-used-2026-06-20/`; normal updates continue in active files under `handover/`.
- No business code changes in this specific handover-sync step.

## 2026-06-21 ImageReferences Upload Backfill And Sync Fix

- User reported file `微信图片_20250211232103` should appear in `上传图片` but was missing.
- Production DB check found the file existed on disk at `/generated/users/ID_636611/upload_image/da9136ec7e524ee9bea3bc09.jpg`, and it was referenced in an assistant message `imageReferences`, but it had no `MediaAsset/UserAssetState` row.
- Root cause: `syncWorkspaceMessageMediaAssets()` synced user message uploads and assistant generated images/videos, but did not sync assistant `imageReferences` upload images into the new media tables.
- Fixed `src/lib/workspace-sessions.ts` to also upsert upload-image URLs found in assistant `message.imageReferences` into `MediaAsset + UserAssetState` as `conversation_uploads`, preserving the reference name when available.
- Backfilled the missing production row for `ID_636611`: `currentName="微信图片_20250211232103"`, `currentCategory="conversation_uploads"`, URL `/generated/users/ID_636611/upload_image/da9136ec7e524ee9bea3bc09.jpg`.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `workspace-sessions.ts` to `.deploy-backups/20260621034340-image-references-upload-sync`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified DB row exists with `promptSource="upload"`, `currentCategory="conversation_uploads"`, not hidden/deleted. `/workspace` returned 200.

## 2026-06-21 Upload Category Legacy Mapping Fix

- User still could not see generated images moved into `上传图片`.
- Production DB check for `ID_636611` confirmed generated image rows had `UserAssetState.currentCategory="conversation_uploads"`, but their `MediaAsset.promptSource` remained `generated` and URLs were normal generated image paths.
- Root cause: `/api/workspace-state` converted `conversation_uploads` rows back to legacy assets without preserving the upload category as `promptSource="upload"`. Frontend then filtered them out of `上传图片` because they did not look like uploaded assets.
- Fixed `mediaStateToLegacyAsset()` in `src/app/api/workspace-state/route.ts`: rows with `currentCategory="conversation_uploads"` or `workflow_uploads` now return legacy assets with `promptSource="upload"` while keeping existing prompt text.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `workspace-state/route.ts` to `.deploy-backups/20260621033451-upload-category-legacy-mapping`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local. Authenticated browser verification is still needed by user because assets API requires login cookie.

## 2026-06-21 Upload Category Count/List Mismatch Fix

- User reported after moving two images to `上传图片`, left count showed 19 but right grid showed only 16.
- Root cause 1: uploaded-image category had already been loaded in the frontend, so switching back reused stale cached assets even though server counts had changed.
- Root cause 2: legacy upload filtering originally depended on `/upload_image/` URL paths, while generated images moved into `conversation_uploads` keep generated image URLs.
- Fixed `/api/workspace-state` upload filter to query `currentCategory="conversation_uploads"` OR legacy `/upload_image/` URLs.
- Fixed frontend upload recognition to include conversation assets with `promptSource="upload"` or `sourcePrompt="资产库上传"`, not only upload-image URL paths.
- Fixed frontend conversation image filtering/counting to exclude assets recognized as uploaded by the broader upload rule.
- Added frontend cache refresh guard: when server `assetCounts[filter]` is greater than currently loaded assets for that filter, `loadWorkspaceAssets()` reloads instead of reusing stale loaded filter cache.
- Moving an asset to `上传图片` now also invalidates the `conversation_uploads` loaded-filter flag.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up files to `.deploy-backups/20260621032936-asset-count-cache-refresh`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hashes matched local.

## 2026-06-21 Moved Generated Images Into Upload Filter Fix

- User moved two generated images to `上传图片`, but they did not appear in that category.
- Root cause: both frontend and `/api/workspace-state?assetsOnly=1&assetFilter=conversation_uploads` treated uploaded images as URL-only (`/upload_image/`). Generated image URLs moved into `conversation_uploads` do not contain `/upload_image/`, so they were filtered out despite `UserAssetState.currentCategory="conversation_uploads"`.
- Fixed frontend `isConversationUploadedAsset()` to include conversation assets with `promptSource="upload"` or `sourcePrompt="资产库上传"`, not just upload-image URLs.
- Fixed frontend `conversation_images` filter/count to exclude assets recognized as uploaded by the broader rule.
- Fixed backend `getAssetFilterWhere("conversation_uploads")` to return rows with `currentCategory="conversation_uploads"` OR legacy upload-image URLs.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up files to `.deploy-backups/20260621032202-moved-generated-image-upload-filter`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hashes matched local.

## 2026-06-21 Asset Move Checkmark For Conversation Images

- Fixed asset card `移动到` submenu checkmark behavior.
- Normal conversation generated images are no longer treated as selected under `上传图片`; they show no checkmark, meaning they can be moved to any of the four targets.
- Only actual uploaded images show the checkmark on `上传图片`; role/scene/shot images still show their own selected category.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621031543-asset-move-checkmark-conversation`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Asset Move Target Upload Images

- Updated asset card `三点菜单 -> 移动到` submenu.
- The last move target now displays `上传图片` instead of `对话流图片`, using the upload icon.
- Moving an image to that target now writes `currentCategory="conversation_uploads"` through `/api/media-assets` and updates the local item to conversation upload style (`librarySource="conversation"`, `type="other"`, upload prompt source).
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621030749-asset-move-upload-target`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Upload Size Fix And Client Compression

- User asked whether asset upload failures were caused by large image size and whether logs existed.
- Checked production Nginx logs. Confirmed failures were `413 Request Entity Too Large` from `/api/asset-upload-temp`, with bodies around `1.1MB`, `1.36MB`, and `1.72MB`.
- Root cause: `/etc/nginx/conf.d/flashmuse.conf` was missing semicolons after `server_name main.venusface.com api.venusface.com`, so `client_max_body_size 80m;` was parsed as part of `server_name` and did not take effect. Nginx default 1MB limit was still active.
- Fixed Nginx config by adding the missing semicolons and setting `client_max_body_size 20m;` in the HTTPS `main/api` server block. Backup: `/etc/nginx/conf.d/flashmuse.conf.bak.20260621025418-upload-size-fix`. Ran `nginx -t` and `systemctl reload nginx` successfully.
- Added client-side JPEG upload compression in `src/components/chat-workbench.tsx`: initial max side `2048`, quality downshift, then dimension downscale until roughly below `950KB` when possible.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621025445-asset-upload-compress-and-nginx-size`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified Nginx config now shows `server_name main.venusface.com api.venusface.com;` and `client_max_body_size 20m;`. A 2MB upload test no longer returned 413; Nginx access showed a non-413 application-layer response. `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Asset Upload Failed Item Handling

- User reported failed images in asset upload dialog blocked removal and disabled `确定上传`.
- Root cause: the failure overlay covered the remove button, and submit was disabled if any selected image failed temporary upload.
- Raised the remove button above the failure overlay with `z-30`.
- Changed submit enable logic: `确定上传` is enabled when at least one image has uploaded successfully and no image is still uploading.
- Changed submit logic to upload only successful ready images and skip failed ones.
- Failed image uploads may happen due to per-file temporary upload failure, network interruption, server rejection, or unsupported/oversized image processing. The dialog now lets the user remove or ignore failed items.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621024035-asset-upload-failed-items-skip`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Uploaded Image Thumbnail Fallback

- User reported newly uploaded asset images had no thumbnail and showed broken image cards.
- Root cause: production asset cards normally derive a static thumbnail path under `image-thumbnails`, but upload image flow may not have generated/synced that thumbnail yet.
- Changed `getAssetCardImageUrl()` so uploaded images use `/api/media-thumbnail?url=...` instead of direct static thumbnail derivation when no stored `thumbnailUrl` exists.
- `/api/media-thumbnail` creates the thumbnail on demand and falls back to the original image if thumbnail creation fails, preventing broken cards for freshly uploaded images.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621023345-uploaded-image-thumbnail-api`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Unified Upload Image Category

- Removed the category selector from the asset upload dialog.
- Updated upload dialog helper text: all uploaded images are saved into the `上传图片` category.
- Asset-library uploads now create local `AssetItem` entries as conversation upload media (`librarySource="conversation"`, URL under upload image path) instead of asset-generation role/scene/shot media.
- `/api/media-assets` persistence for asset-library uploads now sends `currentCategory="conversation_uploads"`.
- This aligns current and future product rule: asset library uploads, conversation uploads, and future workflow uploads should all appear under the single `上传图片` category.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621022739-asset-upload-unified-category`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Asset Sidebar Header And Upload Button Placement

- Removed the `资产生成` section header row from the workspace asset sidebar.
- Removed the `上传图片` button from the top-right header of `角色图片 / 场景图片 / 分镜图片` categories.
- Kept the three generation buttons and let them occupy the right-side header action position where the upload button used to sit.
- `上传图片` category is now the only category that shows the top-right `上传图片` button.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621022059-asset-sidebar-upload-button-placement`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Asset Sidebar Upload Group Move

- Updated workspace asset library sidebar structure.
- Moved `上传图片` from the `对话流资产` group into the `资产生成` group, directly below `分镜图片`.
- Added a light gray separator line between the moved `上传图片` item and the `对话流资产` group.
- Updated group counts so `资产生成` includes uploaded images visually grouped there, and `对话流资产` excludes uploaded images.
- The underlying filter remains `conversation_uploads`; only sidebar grouping changed.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `chat-workbench.tsx` to `.deploy-backups/20260621021440-asset-sidebar-upload-group`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/workspace` returned 200 and deployed hash matched local.

## 2026-06-21 Admin Records Expansion Layout

- Updated generation records expanded layout per user request.
- Removed the previous later three detail columns from the expanded row.
- Kept column 1 with `历史对话` and `工作区保存`.
- Moved `资产库图片` to column 2.
- Moved `对话流图片` and `对话流视频` to column 3.
- Added column 4 placeholders `工作流图片` and `工作流视频`, both currently `0`. Future workflow media dialogs should follow the same pattern as conversation image/video dialogs.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up `admin-records-panel.tsx` to `.deploy-backups/20260621020753-admin-records-layout-workflow-placeholders`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/admin?tab=records` returned 200 and deployed hash matched local.

## 2026-06-21 Admin Client Navigation Cache Fix

- User tested and found details still reloaded after switching to another admin category and back.
- Root cause: admin sidebar used plain `<a href>` links, causing full document navigation between admin tabs. This destroyed the `window.__flashmuseAdminDetailCache` memory cache.
- Changed admin navigation in `src/app/admin/page.tsx` from `<a>` to Next `Link`, so switching admin tabs uses client navigation and keeps the browser JS heap/cache alive.
- Manual browser refresh still clears the cache, matching the user requirement.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up to `.deploy-backups/20260621014020-admin-client-nav-cache`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/admin?tab=users` returned 200 and deployed `src/app/admin/page.tsx` hash matched local.

## 2026-06-21 Admin Detail In-Memory Cache

- Added browser in-memory admin detail cache in `src/app/admin/admin-detail-cache.ts`.
- User requirement: during the same login/page session, if a backend detail or full dialog data has been loaded once, switching to other categories/tabs and coming back should not reload it. Refreshing the page clears the cache and all data must be loaded again.
- The cache stores `records` and `full` detail by user ID on `window.__flashmuseAdminDetailCache`; it does not use localStorage/sessionStorage, so a browser refresh clears it naturally.
- User management, credits management, and generation records now reuse cached lightweight and full details where available.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up files to `.deploy-backups/20260621013201-admin-detail-memory-cache`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/admin?tab=users`, `/admin?tab=credits`, and `/admin?tab=records` returned 200. Deployed hashes matched local.

## 2026-06-21 Admin Lazy Dialog Detail Split

- User reported real online timings for the target account: user management expansion about 50s, credits management 25s, generation records 46s.
- Further changed admin detail flow so `mode=records` returns only lightweight expansion summaries, not full media lists, historical message bodies, or detailed credit arrays.
- User management, credits management, and generation records now show expansion summary first. Clicking concrete items such as media lists, generated lists, upload lists, credit details, or history opens a loading modal and fetches full details on demand.
- Kept the loading lock: while one row is loading, other rows in the same table are disabled.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up files to `.deploy-backups/20260621012536-admin-lazy-dialog-details`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/admin?tab=users`, `/admin?tab=credits`, and `/admin?tab=records` returned 200. Deployed hashes matched local.
- Note: true browser-click timing behind admin login must be verified by an authenticated browser session, because API calls require the admin cookie.

## 2026-06-20 Admin Expand Loading UX And Lock

- Optimized all three admin expandable tables: user management, credits management, and generation records.
- User management expansion now requests lightweight detail with `mode=records`; full conversation message bodies are fetched only when opening the historical conversation dialog.
- Credits management expansion now also requests `mode=records` and no longer loads full message bodies unnecessarily.
- Generation records kept the lightweight `mode=records` expansion and on-demand full history loading.
- Added a shared blue spinner before loading text in user management and generation records, plus an equivalent blue spinner in credits management.
- While any one row detail is loading, other rows in the same table are visually disabled and cannot be expanded. This prevents multiple heavy detail requests from running at once.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up panel files to `.deploy-backups/20260620221503-admin-expand-loading-lock`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Verified `/admin?tab=users`, `/admin?tab=credits`, and `/admin?tab=records` returned 200. Deployed file hashes matched local files.

## 2026-06-20 Deployment Decision Rule Update

- User clarified deployment policy: changes that do not meaningfully affect frontend users may be deployed directly after verification.
- If a deploy may affect active users, running generation tasks, database state, auth/session behavior, credits, media persistence, or server availability, the AI must explain the risk and ask before deploying.
- Removed the old blanket assumption that every deployment must be approved first. Current policy is risk-based.

## 2026-06-20 Admin Detail Loading Fix

- Diagnosed admin records expansion stuck at `正在加载详细记录...`.
- Root cause: records expansion called `/admin/api/records/user-detail` and immediately loaded full `WorkspaceMessage.messageJson`, session message JSON, all ledgers, and media states for the user. Heavy accounts returned 700KB+ detail payloads and could make the row appear stuck while waiting.
- Changed `src/app/admin/admin-records-panel.tsx` to request `mode=records`.
- Changed `src/app/admin/api/records/user-detail/route.ts` so `mode=records` skips full workspace message bodies and only loads session metadata, new media table state, and ledgers needed for records expansion.
- Added on-demand full loading for the `历史对话` button in the records expansion. The fast records expansion stays lightweight; full message bodies are fetched only if the admin opens historical conversation details.
- Local `npx tsc --noEmit` passed.
- Deployed to Malaysia production after backing up server files to `.deploy-backups/20260620220118-admin-detail-lite`; production build passed, PM2 `flashmuse` online, Ali `_next/static` synced.
- Deployed a follow-up records panel fix after backing up to `.deploy-backups/20260620220318-admin-record-history-on-demand`; production build passed again and PM2 stayed online.
- Verified `https://main.venusface.com/admin?tab=records` returned 200 and deployed file hashes matched local.

## 2026-06-20 Rebuilt Handover

- Checked local code state, current Prisma schema, key media files, Malaysia main server, and Ali static server.
- Confirmed many old handover notes were obsolete or mixed with current state.
- Archived the old 7-file handover set into `historical-handover-docs-last-used-2026-06-20/`.
- Created a new concise current handover set focused on valid state, data architecture, deployment, product rules, and next actions.
- Recorded the future rule: when current handover grows too long or stale, archive it into `historical-handover-docs-last-used-YYYY-MM-DD` and write a new extracted summary set.
- Noted that local key files match Malaysia server deployment hashes, but Git still has deployed uncommitted changes.
- Noted that Ali local SNI static checks work, but public static domain access needs review.
