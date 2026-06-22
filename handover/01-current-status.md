# Current Status

Last checked: 2026-06-22 China time.

## What Is Current

- The app is a deployed internal MVP for chat-based image and video generation.
- Login, admin, credits, workspace history, media persistence, and asset management are already real features. Old notes saying these are future-only are outdated.
- Workspace history is split into `WorkspaceSession` and `WorkspaceMessage`.
- Media and asset state are split into `MediaAsset` and `UserAssetState`.
- User-facing asset library reads `MediaAsset + UserAssetState` first. Old `UserWorkspaceState.state.assets` is legacy fallback/protection only.
- All user deletes are soft deletes. Do not physically delete generated files or database records unless the user explicitly changes this product rule.
- Workflows have first-version code, but production must stay disabled unless the user explicitly asks to open workflow mode.

## Latest Real Work

- Fixed runtime duplicate media caused by remote temporary URLs and local `/generated/...` URLs both being visible.
- Added `src/lib/media-assets.ts` to canonicalize saved media jobs and merge duplicates.
- Added `/api/media-assets` with `POST` for media upsert and `PATCH` for rename, category move, soft delete, and restore.
- Asset library category switching and pagination now do front-end de-duplication by `mediaId -> normalized URL -> id`.
- Asset moves write timestamp-level `sortOrder`; server only lets timestamp-level sort orders override latest-first ordering.
- Admin record/detail/stat pages now read media from new tables instead of old workspace JSON where possible.
- New media generated or uploaded should be written into new tables through `/api/media-assets` and `upsertWorkspaceMessages()`.
- Admin user/credits/records expanded rows were optimized. Expansions now load lightweight summaries first; concrete dialogs such as history, media lists, upload lists, and credit details load full data on demand. Same-page admin detail requests use a browser memory cache that survives client-side admin tab switches but clears on browser refresh.
- Admin sidebar navigation uses Next `Link` instead of plain `<a>` so switching backend categories does not destroy the in-memory detail cache.
- Workspace asset sidebar was restructured. `上传图片` now appears under the top asset area below `分镜图片`, separated from `对话流资产` by a light gray divider. The `资产生成` label row was removed.
- Asset upload dialog no longer has category selection. All uploads from asset library, conversation flow, and future workflow should go into the unified `上传图片` category.
- Asset card `移动到` menu now offers `上传图片` as the last target. Normal conversation generated images show no checkmark in the move menu; only actual uploaded images show the `上传图片` checkmark.
- Fixed multiple upload-category edge cases: moved generated images now appear in `上传图片`; uploaded images referenced through assistant `imageReferences` are synced/backfilled into the new media tables; freshly uploaded images use `/api/media-thumbnail` fallback to avoid broken thumbnails.
- Upload failures around 1MB were traced to Nginx config. The production `main/api` Nginx server block now has a valid `server_name ...;` and `client_max_body_size 20m;`. Frontend asset upload also compresses large images before temporary upload.
- Media asset rules were clarified: all generated images/videos and uploaded images/videos/audio-like references are assets for platform tracking; user-facing `@` asset menu still only shows role, scene, shot, and upload-image categories, but manually typed `@` can still resolve existing conversation references.
- Upload-image placeholder text is now unified as `上传图片`. Reverse prompt for uploaded images writes to `MediaAsset.reversePrompt`; workspace and admin displays prefer reverse prompts where present.
- Conversation uploads and generated media now write to `/api/media-assets` immediately in addition to workspace-message sync, reducing reliance on delayed workspace autosave.
- BytePlus Seedance 2.0 / Fast now support reference video and reference audio uploads in video mode. Audio/video uploads use the existing `uploadedFiles` structure, save under `/generated/users/{userId}/files/`, render as file cards in the input, and can be referenced with `@文件名`.
- Seedance reference media limits are enforced client-side: videos `mp4/mov`, up to 3, each 2-15s and <=50MB, total video duration <=15s, aspect ratio 0.4-2.5, width/height 300-6000px, total pixels 409600-2086876; audio `mp3/wav`, up to 3, each 2-15s and <=15MB, total audio duration <=15s. A small 0.35s duration tolerance exists for browser metadata rounding. Audio cannot be used alone; it requires at least one reference image or video.
- Fixed Seedance audio/video reference UI details: uploading media cannot open preview, completed input cards insert `@文件名`, sent prompts render `@文件名` in blue with an audio/video icon, and only the icon opens preview playback.
- Fixed replay/retry media-reference loss. `video_5_d24` was diagnosed as having saved `uploadedFiles` for `abbbbbb.mp4` and `demo_chinese.mp3`, but the actual BytePlus request only had one `reference_image` because replay/retry restored only image references. New replay/retry requests now restore `referenceVideos` and `referenceAudios`; old generated videos cannot be retroactively changed.
- BytePlus human-reference review notices now show once per video request, not once per whole conversation. Each new image auto-review should add the blue system notice `系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....`.
- Admin system settings upload-rule table now documents the completed BytePlus Seedance video/audio reference rules in the video/audio columns and no longer marks them as unfinished.
- Admin credits user list now sorts by latest credit-ledger change time descending, not consumed-credit amount.
- Admin system settings upload-rule table now also documents image-reference rules for BytePlus image models and Seedance 2.0 video models. Image reference display rules include formats, count, single-image size, Seedance video reference modes, and the current lack of separate image width/height constraints.
- Active memo task tracking was added in `handover/06-memo-tasks.md`; future deferred tasks should be added there with checkbox IDs, temporary reason, and later action.
- Asset category persistence was hardened. `/api/media-assets` `POST` preserves existing user-recategorized or locked categories; explicit `PATCH` is still used for moves. This prevents assets moved from conversation flow into `角色图片` or `场景图片` from later being reset to `conversation_images`.
- Asset category loading and pagination were stabilized. Asset pages fetch 30 items per page; scrolling loads more. The previous loop that repeatedly reloaded page 1 when server count exceeded loaded count was fixed. Bottom `正在加载中...` is only for user-triggered bottom loading.
- Asset sidebar group header totals were removed for `对话流资产` and `回收资产30天删除`; individual category counts remain.
- Backfilled six missing upload-image references for `312876953@qq.com` / `ID_686996` into `MediaAsset + UserAssetState`. Final verified `WorkspaceMessage` media gap for that account is `0`; all backfilled rows use `sourcePrompt="上传图片"` and `promptSource="upload"` while preserving old current position/deleted state.
- Image upload failures for two small unusual JPEGs were diagnosed. The files were `1280x720` and under 1MB, but had unusual `Lavc61.3.100`/MJPEG-style encoding. Server-side ffmpeg re-encoding succeeds.
- Image upload handling now falls back if browser canvas conversion fails or times out after 5 seconds, and server upload saving always re-encodes uploaded images through ffmpeg into standard JPG.
- Final root cause of the reported upload failure was cross-origin temporary upload from `ali.venusface.com` to `api.venusface.com`: browser XHR errored after `/api/upload-token` before image POST reached the server. Temporary image upload now uses same-origin `/api/asset-upload-temp` for POST/PATCH/DELETE instead of `NEXT_PUBLIC_UPLOAD_BASE_URL`.
- Upload failure cards show only generic `上传失败` to users. Detailed client-side upload diagnostics are still logged through `/api/client-error` with `source="client-diagnostic"`.
- Image temporary upload was adjusted after the 95% progress UX concern. Normal same-origin image upload now uses a fast server write path instead of always ffmpeg re-encoding every image. Failed image cards in both the workspace input and asset-library upload dialog show a blue `重试` action; retry sends `forceReencode=1` to `/api/asset-upload-temp` and uses server ffmpeg re-encoding as the fallback.
- The upload retry/re-encode fallback change was deployed to Malaysia production with backup `.deploy-backups/20260622-upload-retry-reencode`. Production build passed with only existing Turbopack/NFT warnings; PM2 stayed online; `/workspace`, `/admin`, and `/api/model-availability` returned 200.
- Follow-up fixed the remaining old behavior: frontend image selection no longer pre-converts every uploaded image through canvas before temporary upload. JPEG first attempts now upload the original file to the fast server path; failed-card retry is the re-encode fallback. The upload progress overlay shows `处理中` instead of a stuck `95%` while waiting for the server response.
- The upload original-first follow-up was deployed with backup `.deploy-backups/20260622-upload-original-first-followup`. Production build passed with only existing Turbopack/NFT warnings; PM2 stayed online; `/workspace`, `/admin`, and `/api/model-availability` returned 200.
- Final upload retry correction: historical docs showed the old flow pre-converted uploads through canvas, so the new target flow is intentionally different. First upload now keeps the original file and the server fast path rejects JPEGs that are not common 4:2:0 sampling; the two desktop `aaa` JPEGs match this rejection path. Failed cards expose blue `重试`; retry sends `forceReencode=1` and ffmpeg re-encodes. Progress display is numeric again. Deployed with backup `.deploy-backups/20260622-upload-first-fail-retry-reencode`; production build passed and endpoint checks returned 200.
- Diagnosed `video_1_d27` for `ID_636611`: workspace message and files were valid, local mp4 and poster existed, and `https://main.venusface.com/generated/...mp4` returned 200. Static domains `static.venusface.com` and `ali.venusface.com` failed HTTPS checks, so frontend static-base rewriting could make generated videos invisible on the main workspace. `getStaticMediaUrl()` now disables static-base rewriting on `main.venusface.com`, `api.venusface.com`, and `101.47.19.109`, using same-origin `/generated/...` instead. Deployed with backup `.deploy-backups/20260622-main-generated-media-url`.
- Follow-up on temporary video display: `video_1_d27` and the next generated video both received BytePlus/TOS temporary mp4 URLs at poll success while media save status was still `pending`; local save completed later, which is when posters appeared. Temporary TOS URLs returned `206` for ranged GET but `403` for HEAD and had no poster. Frontend now uses `preload="auto"` for inline videos without a poster, so temporary no-poster videos should load the first frame instead of sitting as an empty metadata-only player. Deployed with backup `.deploy-backups/20260622-temp-video-preload-auto`.
- Temporary remote video playback was investigated and later confirmed to be a home-network/environment issue. The temporary `/api/media-proxy` experiment and direct debug artifacts were removed; remote temporary videos now use direct provider URLs again until local `/generated/...` replacement.
- Further investigation showed the old working path used direct provider temporary URLs, not a proxy. The proxy made Ali -> Malaysia -> TOS streaming slower and browser requests appeared as `200` full streams, while BytePlus mp4 files have the `moov` atom at the end. Remote temporary videos are now direct provider URLs again; only the temporary no-poster stage uses `muted autoPlay preload="auto"` so the browser can start loading/playing enough to show frames. Local saved videos with posters keep normal non-muted behavior. Deployed with backup `.deploy-backups/20260622-temp-video-direct-muted-autoplay`.
- Temporary video rendering was adjusted again after a standalone local HTML with the same direct provider URL played correctly. The key difference was project markup: `<video controls>` was nested inside an outer `<button>` and lacked full card sizing, while the standalone test had a normal full-width `<video>`. `InlineVideoResult` now uses an outer `div`; the poster state uses a button, and the actual video element is no longer nested inside a button and uses `h-full w-full`. Double-clicking the video opens preview. Deployed with backup `.deploy-backups/20260622-video-element-no-button-wrapper`.
- User then tested a local HTML modified to mimic the original project structure (`button > video`, hover play/pause, click preview behavior), and the temporary URL still played. Per user request, project `InlineVideoResult` was restored to the original `button > video`, `preload="metadata"`, no forced muted/autoplay behavior, and deployed with backup `.deploy-backups/20260622-video-card-restore-original`. For controlled testing, production `video_6_d27` in user `ID_636611` was replaced from local `/generated/users/ID_636611/videos/1782066178925-fe4138eb-99a4-4cec-a1d8-04abb16589fd.mp4` to the latest BytePlus temporary URL. Original message JSON backup: `.runtime/manual-fixes/1782067671244-video_6_d27-replace-url.json`.
- Diagnosed `312876953@qq.com` / `ID_686996` video request `23f5c910-dea5-4542-8dbb-79d7525e1eb2:video:0`: BytePlus task `cgt-20260621173327-b4t82` had succeeded and local mp4 `/generated/users/ID_686996/videos/1782035548330-deeaf7f6-f09f-4f9f-a0a6-378b30bd48e7.mp4` existed, but the workspace message was still pending until later autosave/recovery. The message and media table now show `video_19_d1`, `pendingVideoCount=0`, and `statusText="视频已生成完成"`.
- Hardened media completion persistence with the intended fast-display flow. Provider temporary image/video URLs may be shown immediately in chat, preview, and download controls. Temporary remote URLs must not become `MediaAsset.url/normalizedUrl`. After `.runtime/media-save-jobs.json` reports a saved local `/generated/...` URL, the frontend replaces chat media, preview source, download source, asset list items, and then persists the local URL into `MediaAsset + UserAssetState`. Workspace message saving no longer fails if media-asset sync hits an asset-only error.
- Remote-to-local media mappings are now also appended to `.runtime/media-url-map.md` on the server for troubleshooting. This runtime file may contain signed provider URLs and must stay outside Git/docs.
- Follow-up audit hardened the core media chain further. Saved local media is now persisted to `MediaAsset` even if UI replacement is delayed by preload/static sync issues. Workflow canvas nodes are included in remote URL polling and replacement so future workflow media uses the same temporary-URL-first then local-URL-persist flow. `/api/media-assets` accepts `workflowId` and `workflowNodeId` for future workflow assets.
- `07-remote-video-url-debug.md` is closed. The temporary remote video display issue was confirmed by the user to be a home-network/environment problem, not an application bug. Test artifacts and `/api/media-proxy` were removed; future similar reports should be treated as a fresh issue and reproduced before code changes.
- Admin `生成记录` right-side table sorting was changed and deployed. Rows now sort by latest model interaction per account using latest `CreditLedger.createdAt` where `direction="consume"`, covering image generation, video generation, Agent/chat, reverse prompt, prompt optimization, and recorded failed model requests. This avoids login, upload, workspace update, credit grant, and admin adjustment changing the generation-record order.
- Backend admin navigation changes are deployed: `上传规则` is now a standalone backend tab between `系统设置` and `服务器信息`; `服务器信息` is also a standalone tab, not part of system settings.
- `服务器信息` is deployed through `/admin/api/server-info` and `AdminServerInfoPanel`. It shows Ali vs Malaysia rows for hostname/IP, disk total/free in G with three decimals, current network speed, NIC bandwidth, default NIC, CPU cores/load, memory, uptime, and server time. It should still be checked with an authenticated admin browser session because local Windows/Node SSH could time out while production is the intended environment.
- `上传规则` split is deployed. The existing upload-rule table moved from `AdminSystemSettingsPanel` to `AdminUploadRulesPanel` without changing the displayed rule content.
- Workflow foundation code is deployed but production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false. Workflow state now saves through `UserWorkspaceState.state.workflowItems` as a first-class workspace area similar to conversations. The summary workspace load now includes `workflowItems` and `nextWorkflowNumber`, fixing the bug where `/api/workspace-state?summary=1&panel=chat` could load an empty workflow list and later autosave over previously created workflows.
- Workflow list rules now mirror conversation basics: first load guarantees one untitled `新工作流`; clicking new while `新工作流` exists reuses it; when the untitled workflow first gets real canvas action it is renamed to `工作流_01`, then `工作流_02`, etc.; deleted numbers are not reused because `nextWorkflowNumber` is persisted; deleting the last workflow creates a new untitled workflow; workflow sidebar initially shows 10 items and loads 5 more at a time.
- Workflow assets were added to the asset sidebar under `对话流资产` as a new `工作流资产` group with `生成图片` and `生成视频`. Frontend asset filtering now distinguishes `librarySource="workflow"` from conversation assets. Workflow generated local media is persisted to `/api/media-assets` as `workflow_images` / `workflow_videos` with `workflowId` and `workflowNodeId`; remote-to-local replacement polling also covers workflow nodes.
- Workflow canvas now has first real text/image/video node UI and generation behavior. Text nodes call `/api/chat` in Agent mode, image nodes call `/api/image`, and video nodes call `/api/video` create + poll. Nodes have display cards, waiting cards, failed cards, selected-state blue 1px card border, left/right `+` connection buttons, and a separate 680px input box visually matching the conversation input. Workflow image/video model menus use the same enabled model lists as conversation mode, so backend model availability switches affect both modes.
- Workflow usage display was added at the top-right of the workflow workbench using the same `UsageSummaryButton` concept as conversation mode. Workflow usage accumulates from node text/image/video calls, and media counts are computed from workflow node outputs.
- Login/session idle behavior is deployed. The normal user session idle timeout changed from 30 days to 1 hour. Ordinary auth checks no longer extend expiry. New `POST /api/auth/activity` extends the session only on real user activity events such as click, keydown, wheel, touch, or scroll. While any generation is running, the workspace sends keepalive every 5 minutes so long image/video waits do not log users out. Closing the browser still lets the idle timer expire after 1 hour.
- Server-info backend tab was polished after deploy: production now reads Malaysia locally and Ali through the server key, hard-disk rows show blue usage bars, and entering the tab automatically loads data once while keeping the refresh button.
- Conversation history sidebar count was fixed. The small number beside `历史对话` now uses the server total count, including conversations not loaded in the sidebar page yet.
- `07-remote-video-url-debug.md` is closed as a confirmed home-network/environment issue. All debug/test code, test pages, test messages, legacy test residue, and `/api/media-proxy` were removed. Remote temporary videos now play directly from provider URLs until local `/generated/...` replacement.
- User requested a GitHub sync after this work; memo `M004 Commit Deployed Local Changes` was marked completed and this handover was updated for the next AI. Main deployed-change commit pushed to GitHub: `17806ea Sync deployed media and workflow updates`.

## Latest 2026-06-23 Deploy

- User requested deploying all current local changes while keeping online workflow mode disabled.
- Local `npx tsc --noEmit` passed.
- Production source backup was created at `/var/www/flashmuse/.deploy-backups/20260623-full-local-deploy/source-before-deploy.tgz`.
- Deployed full local code to Malaysia with `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT broad-file-pattern warnings; PM2 `flashmuse` stayed online; Ali `_next/static` was synced and cache cleared.
- Verified `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was disabled/unset on production, so workflow code is deployed but the user-facing workflow entry remains disabled.
- Verified 200: `https://main.venusface.com/workspace`, `https://main.venusface.com/admin`, `https://main.venusface.com/admin?tab=upload-rules`, `https://main.venusface.com/admin?tab=server`, and `https://api.venusface.com/api/model-availability`.
- Follow-up fixed `服务器信息`: production now reads Malaysia locally instead of SSHing to itself with the local Windows key path; Ali still reads through `/root/.ssh/flashmuse_to_ali_ed25519`. Redeployed successfully and confirmed direct Malaysia -> Ali SSH works.

## Verified During This Rebuild

- Malaysia server project path: `/var/www/flashmuse`.
- Malaysia PM2 process `flashmuse` was online.
- Production endpoints returned 200: `https://main.venusface.com/workspace`, `https://api.venusface.com/api/model-availability`, `https://main.venusface.com/admin`.
- Ali server static root exists at `/var/www/flashmuse-static` and Nginx is active.
- Ali local SNI test for `static.venusface.com` and `ali.venusface.com` returned 200 from the Ali server itself.
- Public/local-machine access to `http://static.venusface.com/...` and `http://ali.venusface.com/...` returned 403, and HTTPS returned curl code 000. This needs later review if static domains are expected to be directly public.
- Latest repeated production deploys on 2026-06-21 were frontend/backend fixes. They used `/usr/local/bin/deploy-flashmuse-production.sh`, builds passed with only the existing Turbopack/NFT warning, PM2 stayed online, and Ali `_next/static` was synced.
- Latest deployment backups from this conversation include `.deploy-backups/20260621053806-seedance-av-upload`, `20260621055453-media-mention-preview-fix`, `20260621060108-media-duration-epsilon`, `20260621061058-media-input-mention-click`, `20260621061807-media-prompt-inline-render`, `20260621062457-assistant-uploaded-files-fix`, `20260621063426-byteplus-review-notice-once`, `20260621064500-review-notice-per-request`, `20260621065215-replay-media-references`, `20260621065646-admin-upload-rules-text`, `20260621065952-admin-upload-rules-columns`, `20260621-admin-credit-last-change-sort`, `20260621-admin-upload-rules-image-reference`, `20260621-asset-category-preserve`, `20260621-asset-sidebar-group-counts`, `20260621-asset-page-size-loading`, `20260621-asset-pagination-loop-fix`, `20260621-upload-image-fallback`, `20260621-upload-image-conversion-timeout`, `20260621-upload-diagnostics`, and `20260621-same-origin-image-upload`.
- Latest deployment backup added after video completion chain hardening: `.deploy-backups/20260621-video-completion-chain-fix`.
- Latest deployment backup after restoring the fast temporary-URL-first flow: `.deploy-backups/20260621-temp-url-first-media-chain`.
- Latest deployment backup after core media chain audit follow-up: `.deploy-backups/20260622-core-media-chain-audit-fix`.

## Git State At Rebuild

Modified files:

- `handover/00-README.md`
- `handover/03-progress-and-status.md`
- `handover/04-keys-and-integrations.md`
- `handover/05-chat-history-highlights.md`
- `handover/CHANGELOG.md`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/admin/api/records/user-detail/route.ts`
- `src/app/admin/page.tsx`
- `src/app/api/media-save-status/route.ts`
- `src/app/api/video/route.ts`
- `src/app/api/workspace-state/route.ts`
- `src/components/chat-workbench.tsx`
- `src/lib/error-message.ts`
- `src/lib/workspace-sessions.ts`

Untracked paths:

- `src/app/api/media-assets/`
- `src/lib/media-assets.ts`

After this handover rebuild, the handover files themselves will also be changed by the archive/rewrite operation.

## Old Docs That Are Now Outdated

- Old notes saying the project has no real login, no credits, no admin, or no persistence are outdated.
- Old notes saying assets are only in `localStorage` are outdated.
- Old notes saying history/media split tables are future work are outdated.
- Old notes saying production is HTTP test-only are partly outdated. Main/API are HTTPS; Ali static domain public access still needs review.
- Old migration instructions that say other accounts still need migration are outdated. The 20 online media accounts were already migrated and audited.
- Old model lists and exact provider availability may be stale. Check current code and `/api/model-availability` before changing models.
