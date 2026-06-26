# Next Actions

## Do First

1. Use `E:\project\FlashMuse_Agent` as the only current local project root. It is the original `AI-Video-Assistant` directory renamed on 2026-06-26, not the smaller temporary copy.
2. The old path `E:\project\AI-Video-Assistant` should no longer exist. If it reappears, treat it as stale/backup until verified.
3. Run `git status --short` and inspect diffs before editing.
4. Remember that the newest 2026-06-23 workflow/media-table work is deployed but not committed or pushed after this deployment. Inspect status/diff carefully before further changes.
5. Do not revert unrelated local/user changes.
6. Run `npx tsc --noEmit` before committing or deploying code changes.
7. For deployment, use the current risk-based rule: low-impact deploys may be done directly; anything that may affect active frontend users or running tasks must be explained to the user first and approved before deployment.
8. For risky workspace/asset deploys, first run production snapshot `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot BEFORE_LABEL`, deploy, run another snapshot, then compare. If compare fails, stop and fix or roll back.

## Highest Priority

- Current local workspace is dirty after local-only tldraw workflow work. Do not deploy this tldraw workflow work to production yet. Before any commit, deploy, or GitHub sync, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`.
- Local root cleanup is complete: the smaller copied `FlashMuse_Agent` folder was deleted, the original `AI-Video-Assistant` folder was renamed to `FlashMuse_Agent`, `.runtime/` was preserved, and `npx tsc --noEmit` passed after the rename.
- The 2026-06-24 workflow/input-scroll work has been deployed with production workflow entry still disabled. Later local-only tldraw work has not been deployed. Important workflow files now include `src/components/workflow-tldraw-canvas.tsx`, `src/components/workflow-tldraw-canvas-inner.tsx`, `src/components/workflow-tldraw-minimal-canvas.tsx`, `src/app/dev/tldraw-test/`, `open-tldraw-test.bat`, `src/components/chat-workbench.tsx`, `src/lib/workspace-workflows.ts`, `src/app/api/media-assets/route.ts`, `src/app/api/workspace-state/route.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`, and `package-lock.json`.
- Latest 2026-06-25 local-only changes added workflow real-size nodes, square card styling, selected-node overlay outside the shape body, mutually exclusive input menus, default image/video settings, non-overlap node creation near the last operated node, dock icon clarity fixes, 1% minimum zoom, text-node native resizing, node geometry persistence, and continued video-node playback experiments. These are not deployed and not GitHub-synced.
- Latest follow-up in the same 2026-06-25 local session fixed workflow video native controls using tldraw official clickable-shape guidance. If tldraw custom-shape interactions break again, check `https://tldraw.dev/` first, especially `Clickable custom shape`: use `pointer-events: all`, stop event propagation on interactive children, and use `editor.markEventAsHandled()` if canvas pointer handling still interferes.
- Continue workflow tldraw integration carefully. Current stable path uses `<Tldraw hideUi shapeUtils={[WorkflowNodeShapeUtil]}>` with client-only dynamic import. Do not reintroduce full `editor.store.listen -> onChange -> ChatWorkbench/workspace autosave` syncing; it previously froze the browser. Current allowed persistence is limited to explicit business changes plus lightweight geometry sync for `nodes[].x/y` and text-node `data.visualSize`; do not save camera/viewport unless the user explicitly reopens that decision.
- Browser-test the current tldraw workflow UI after each change: open `/workspace`, switch to workflow, verify no freeze, add text/image/video nodes, confirm default image is `Seedream 4.5 / 16:9 / 2K` and default video is `Seedance 2.0 / 16:9 / 720p / 8秒`, drag nodes and confirm position persists after switching/refreshing, resize text nodes and confirm `visualSize` persists, select/delete selected nodes with `Delete/Backspace`, switch between workflows and confirm canvas content changes and auto-focuses all nodes, edit input, open model/settings/duration menus and confirm only one menu opens at a time, open left-bottom background/layers/minimap/zoom popovers, generate one image, generate one video and confirm native video controls are clickable, and confirm the bottom dock focus button zooms to selected node(s) when selected and all nodes when nothing is selected.
- Keep `/dev/tldraw-test` and `open-tldraw-test.bat` as diagnostics. `/dev/tldraw-test` is a default tldraw UI page with no workspace coupling; if it freezes, the issue is tldraw/Next/Turbopack/environment. If it is smooth but workflow freezes, the issue is our custom shape/state integration.
- Remember tldraw production licensing. `tldraw@5.1.1` works locally without a key, but production/commercial use requires a valid tldraw license key. Do not open production workflow mode with tldraw until licensing and build behavior are resolved.
- Browser-retest the deployed conversation input box: with long text, scroll upward inside the input, then type, paste, press `Shift+Enter`, delete `@` spans, and insert `@` assets. The view and caret should stay near the user's current scroll area; only bottom-position typing should auto-follow the bottom.
- Retest local workflow generation end-to-end before any deploy: create multiple image nodes in the same workflow, generate from each, verify each node keeps its own result, names increment independently (`image_1_w2`, `image_2_w2`, etc.), failures do not consume numbers, refresh preserves node names/dimensions, and right-side preview thumbnails show only current workflow canvas media.
- Retest workflow remote-to-local media replacement: temporary provider URL should display immediately; when saved local `/generated/...` appears, node `images/videoUrl`, node `mediaSystemNames`, node dimensions/poster, preview asset, and `MediaAsset + UserAssetState` should all remain consistent and should not overwrite system names with `图片生成` / `视频生成`.
- Local data for `12424740@qq.com / ID_779117` was manually repaired during workflow debugging. If results look inconsistent, query `WorkspaceWorkflow.workflowCode in ('w1','w2')`, `canvasJson.nodes[].data.mediaSystemNames`, and `UserAssetState + MediaAsset` workflow rows before making more code changes.
- Hydration warning can still appear when SSR renders chat mode but stored client UI starts in workflow mode. It is recoverable, but future cleanup should make initial client render match SSR or delay active-panel restoration until after hydration.

- Admin navigation split, server-info, workflow foundation code, workflow table persistence, new-table-only asset work, admin idle-timeout, and Agent prompt-detail persistence were deployed on 2026-06-23. Production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false.
- Test `服务器信息` with an authenticated production admin browser session. Local Windows Node can fail to SSH to Malaysia even when manual PowerShell SSH works; production is the intended environment because the Malaysia app can read itself and jump to Ali with `/root/.ssh/flashmuse_to_ali_ed25519`.
- Retest deployed auth idle behavior in production: user action extends session; no action expires after 1 hour even if browser is closed; routine auth/workspace polling does not extend it; active generation keepalive prevents logout during long waits.
- Stabilize and verify the new media table flow end-to-end.
- Confirm asset library category loading, pagination, moving, rename, delete, restore, and `@` reference behavior.
- Specifically retest `上传图片`: asset-library upload, conversation upload, moving generated images into upload category, reference images from `imageReferences`, thumbnail fallback, count/grid consistency, same-origin temporary upload, and fallback upload of unusual JPEG files.
- Retest admin expansion UX on the real heavy account: user management, credits management, generation records, category switching cache, and on-demand dialogs.
- If future BytePlus video errors say `output audio may contain sensitive information`, treat them as generated-output audio moderation failures, not proof that the user uploaded audio. Check `.runtime/video-diagnostics-log.jsonl` `references[]` for `reference_audio` before saying audio was uploaded. Current user-facing text should be `生成结果中的音频可能触发平台敏感内容审核，平台拒绝输出。请调整提示词后重试。`
- Confirm runtime remote/local duplicate canonicalization after new image and video generations.
- Retest the core media chain for both image and video: temporary provider URL displays immediately, preview opens, download button works on the temporary URL, local `/generated/...` save completes, chat/preview/download/assets replace to the local URL, and `MediaAsset.url` stores only the local URL.
- Retest the same remote-to-local replacement after refresh/reopen. If a browser saved a temporary URL before replacement, `/api/media-save-status` should still find the saved job and replace/persist the local URL later.
- When workflow mode is eventually enabled, retest workflow node image/video URLs specifically. Workflow node `images` and `videoUrl` are now included in the same media-save-status polling/replacement path and should persist as `workflow_images` / `workflow_videos`.
- Retest workflow basics locally or in a controlled production session only after workflow entry is explicitly enabled: default `新工作流`, new-workflow reuse, first action renaming to `工作流_01`, non-reuse of deleted numbers, delete-last-workflow fallback, 10-item list limit and 5-item load-more, rename/delete/pin behavior, and persistence after refresh.
- Retest workflow node UI and generation: current tldraw/Lovart-style UI has pure `#cccccc` default background, top-left sidebar toggle + workflow title, bottom dock with text/image/video/zoom/focus controls plus select/hand on the far right, left-bottom background/layers/minimap/zoom controls, no node shadows, and no left/right `+` ports. Nodes are real-size canvas cards; selected-node title/parameters sit above the card; input appears below only before generation. Text/image/video node input should still match conversation generation behavior, menus should remain usable, model menus should show icons, and image/video model lists should honor `/api/model-availability` backend switches.
- Workflow focus control rule: the bottom dock focus icon zooms selected workflow node(s) if any are selected, otherwise all nodes. The left-bottom zoom menu `显示画布所有元素` should continue to zoom all nodes regardless of selection.
- Retest workflow generation chain: text node `/api/chat`, image node `/api/image`, video node `/api/video` create/poll, usage counter update, waiting/failure/success cards, reference text/images from upstream nodes, workflow asset persistence, and remote-to-local replacement.
- Retest deployed login idle behavior: user action extends session; no action expires after 1 hour even if browser is closed; routine auth/workspace polling does not extend it; active generation keepalive prevents logout during long waits.
- Retest BytePlus Seedance 2.0 / Fast video mode with uploaded reference video and audio: fresh send, replay/regenerate, failed-card retry, audio-only blocking, duration tolerance around 15s, input-card `@` insertion, sent prompt inline icons, and preview playback.
- Retest BytePlus automatic human-reference review UI. Each new image review should show the blue system notice once per request, even if the same conversation had previous review notices.
- Retest `video_5_d24` scenario by regenerating a new video with a reference image, `abbbbbb.mp4`-style reference video, and `demo_chinese.mp3`-style audio. Old `video_5_d24` was already generated without video/audio references and cannot be fixed retroactively.
- Latest deployed changes now include the 2026-06-24 workflow/input-scroll deploy. If future deployed local changes accumulate and the user asks for GitHub sync, inspect status/diff/log, run `npx tsc --noEmit`, then commit and push.
- Before any future commit or GitHub sync, review the deployed-but-uncommitted Prisma migrations `20260623043000_workspace_workflows` and `20260623044000_backfill_workspace_workflows`, the new `src/lib/workspace-workflows.ts`, `scripts/prod-deploy-snapshot.mjs`, admin idle files, Agent prompt-detail changes, and all new-table-only asset changes.
- Retest local workflow persistence after browser refresh with `12424740@qq.com` and `lookxun@163.com`. Expected local data: `12424740@qq.com / ID_779117` has `工作流_01` and `工作流_02`; `lookxun@163.com / ID_113219` has `工作流_06` and `工作流_04`.
- Retest production asset library with authenticated real accounts after the new-table-only deploy. Latest snapshot says visible asset counts stayed unchanged and `fallbackUsers=0`, but browser-level category actions still need human validation.
- Retest upload-file paths: uploaded video should write `sourcePrompt="上传视频"`, uploaded audio should write `sourcePrompt="上传音频"`, and uploaded document should write `sourcePrompt="上传文档"` into `MediaAsset + UserAssetState`. These categories are internal for now and not shown in the asset sidebar yet.
- Retest Agent-generated image/video prompt display in admin. Main prompts should be black; Agent hard constraints from `MediaAsset.sourceDetail.agentConstraints` should be gray; multi-image/multi-video prompt-to-asset mapping should not be mixed.

## Specific Checks To Run When Needed

- `npx tsc --noEmit`.
- `npx prisma generate` after applying local migrations or after stopping `next dev` if Prisma engine files are locked on Windows.
- `node scripts/audit-visible-duplicate-media.mjs --user=USER_ID`.
- `node scripts/audit-user-media-cost-gaps.mjs --user=USER_ID`.
- Open production `/workspace` and test asset library actions with a real user account.
- Check PM2 logs and `.runtime/video-diagnostics-log.jsonl` for BytePlus video issues.
- When diagnosing Seedance reference media, check both `WorkspaceMessage.messageJson.uploadedFiles` and `.runtime/video-diagnostics-log.jsonl`; before the replay fix, diagnostics showed only `reference_image` even though the message had uploaded video/audio files.
- Check `.runtime/media-save-jobs.json` when remote/local media duplication appears.
- Check `.runtime/media-url-map.md` when diagnosing a generated item that displayed with a temporary URL but should have replaced to `/generated/...`. Do not commit or paste signed remote URLs from this runtime file into docs.
- For deployment safety, run `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot LABEL` and compare pre/post snapshots. Current baseline files are `20260623-before-risk-deploy.json`, `20260623-after-risk-deploy.json`, and `20260623-after-hotfix.json`.
- Check Nginx access/error logs for upload failures. `413` means body size/config issue; current intended limit is `20m`.
- For upload failures, also check PM2 logs for `[client-error]` entries with `source="client-diagnostic"`. User-facing upload cards intentionally show only generic `上传失败`.

## Known Follow-Ups

- Static domain public access and Ali certificate automation were completed on 2026-06-26. If this regresses, check Ali Nginx `/etc/nginx/sites-available/flashmuse-static-ip`, ACME webroot `/var/www/letsencrypt`, certbot renewal config `flashmuse-ali-static`, and renewal hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`.
- If committing, include deployed uncommitted files such as `src/lib/media-assets.ts`, `src/app/api/media-assets/route.ts`, workflow migrations, `src/lib/workspace-workflows.ts`, admin idle files, and `scripts/prod-deploy-snapshot.mjs`.
- Keep production workflow mode disabled until user explicitly approves opening it.
- If input `@` editing bugs resurface, consider whether the contenteditable mention implementation needs a focused refactor.
- Do not remove `src/app/dev/tldraw-test/` or `open-tldraw-test.bat` until tldraw workflow integration is stable; they are the current minimal tldraw baseline.
- Before production deploy with tldraw, resolve `npm run build` reliability. Earlier local build failed due Google Geist font/Turbopack internal font resolution while `npx tsc --noEmit` passed.
- Before any production workflow rollout, resolve tldraw licensing. The local workflow canvas currently hides the tldraw watermark for internal testing, but this is not a substitute for a production/commercial license decision.
- Upload-rule table is now deployed as standalone backend tab `上传规则` via `src/app/admin/admin-upload-rules-panel.tsx`. Keep it synchronized with `src/lib/upload-rules.ts` when upload limits change.
- Memo tasks are in `handover/06-memo-tasks.md`; update that file, not historical docs, when the user says something is a deferred memo task.

## Avoid

- Do not run broad migrations without dry-run and logs.
- Do not use old handover docs as current truth without checking against code/server state.
- Do not hard-delete generated media or database records under current product rules.
- Do not expose `.env`, API keys, server passwords, SMTP credentials, or private keys in docs or commits.
