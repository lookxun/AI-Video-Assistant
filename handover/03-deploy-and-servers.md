# Deploy And Servers

## Malaysia Main Server

- Role: main Next.js app, API, PostgreSQL, generated media source.
- IP: `101.47.19.109`.
- Project path: `/var/www/flashmuse`.
- PM2 process: `flashmuse`.
- Standard deploy script: `/usr/local/bin/deploy-flashmuse-production.sh`.
- Login key path on local machine: `E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem`.
- Safe login command: `ssh -i "E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem" root@101.47.19.109`.

Current notes:

- `/var/www/flashmuse` did not show a usable Git worktree during rebuild, so Git status on the server is not reliable.
- Source file hashes for key local files matched the Malaysia server deployment during rebuild.
- PM2 was online during rebuild.
- Recent deployment backup names included `20260620202220-asset-dedupe-ui-fix`.
- Latest deployment backups from 2026-06-21 Seedance reference media work include `20260621053806-seedance-av-upload`, `20260621055453-media-mention-preview-fix`, `20260621060108-media-duration-epsilon`, `20260621061058-media-input-mention-click`, `20260621061807-media-prompt-inline-render`, `20260621062457-assistant-uploaded-files-fix`, `20260621063426-byteplus-review-notice-once`, `20260621064500-review-notice-per-request`, `20260621065215-replay-media-references`, `20260621065646-admin-upload-rules-text`, and `20260621065952-admin-upload-rules-columns`.
- Later 2026-06-21 deploy backups include `20260621-admin-credit-last-change-sort`, `20260621-admin-upload-rules-image-reference`, `20260621-asset-category-preserve`, `20260621-asset-sidebar-group-counts`, `20260621-asset-page-size-loading`, `20260621-asset-pagination-loop-fix`, `20260621-upload-image-fallback`, `20260621-upload-image-conversion-timeout`, `20260621-upload-diagnostics`, and `20260621-same-origin-image-upload`.
- BytePlus video diagnostics are under `/var/www/flashmuse/.runtime/video-diagnostics-log.jsonl`. Use this to verify whether requests include only `reference_image` or also `reference_video` / `reference_audio`.
- Latest 2026-06-23 deployment uploaded the full local source snapshot, backed up production source to `.deploy-backups/20260623-full-local-deploy/source-before-deploy.tgz`, then ran `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT warnings; PM2 stayed online; Ali `_next/static` synced and cache cleared. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was confirmed disabled/unset.
- Latest protected deployment after that used pre/post asset snapshots. Before deploy snapshot: `.runtime/deploy-checks/20260623-before-risk-deploy.json`; after deploy snapshot: `.runtime/deploy-checks/20260623-after-risk-deploy.json`; hotfix snapshot: `.runtime/deploy-checks/20260623-after-hotfix.json`. Snapshot comparison returned `ok: true` with unchanged totals, per-user assets, per-category assets, and `assetListHash=ff9ef4f9f85ff233`.
- Latest protected deployment backups: `.deploy-backups/20260623-risk-flow/source-before-deploy.tgz` and `.deploy-backups/20260623-workspace-crash-hotfix/source-before-hotfix.tgz`.
- Latest 2026-06-24 deploy uploaded local source archive `/tmp/flashmuse-20260624-workflow-input-deploy.tgz`, backed up production source to `.deploy-backups/20260624-workflow-input-deploy/source-before-deploy.tgz`, applied Prisma migration `20260624090000_workflow_media_names`, ran `npx prisma generate`, then `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT warnings, PM2 stayed online, and Ali `_next/static` synced. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was confirmed disabled/unset before deploy.
- Latest 2026-06-24 deploy guard files: before snapshot `.runtime/deploy-checks/20260624-before-workflow-input-deploy.json`, after snapshot `.runtime/deploy-checks/20260624-after-workflow-input-deploy.json`. Compare returned `ok: true`; `stableMissingInNewTable=0`, `fallbackUsers=0`, and `assetListHash=81ece40e2d3c6134` stayed unchanged.
- Latest 2026-06-26 app deploy was a narrow error-message-only deploy. Only `src/lib/error-message.ts` was copied to production, with backup `/var/www/flashmuse/.deploy-backups/20260626-error-message-audio-sensitive/error-message.ts.before`, then `/usr/local/bin/deploy-flashmuse-production.sh` ran. Build passed with existing Turbopack/NFT warnings; PM2 stayed online; Ali `_next/static` synced; `/workspace`, `/admin`, and `/api/model-availability` returned 200. Local tldraw/workflow work was intentionally not deployed.
- `scripts/prod-deploy-snapshot.mjs` is the reusable deploy guard. Production copy: `.runtime/deploy-checks/prod-deploy-snapshot.mjs`. Use it before risky deploys: `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot LABEL`, then compare with `node .runtime/deploy-checks/prod-deploy-snapshot.mjs compare BEFORE.json AFTER.json`.
- For database changes on production, set `DATABASE_URL` from the running PM2 process if `.env.local` cannot be sourced directly. Working pattern used: `export DATABASE_URL="$(pm2 env 0 | grep ^DATABASE_URL | cut -c15-)"`, then run `npx prisma migrate deploy` and `npx prisma generate` before the standard deploy script.
- On 2026-06-21, upload failures around 1MB were traced to `/etc/nginx/conf.d/flashmuse.conf`: missing semicolons after `server_name main.venusface.com api.venusface.com` caused `client_max_body_size` to be parsed incorrectly. Fixed config backup: `/etc/nginx/conf.d/flashmuse.conf.bak.20260621025418-upload-size-fix`.
- Current intended upload limit for `main/api` HTTPS server block is `client_max_body_size 20m;`. Verify with `nginx -T | grep -n 'server_name main.venusface.com api.venusface.com\|client_max_body_size'` if upload 413 returns.
- Client-side upload diagnostics are logged through `/api/client-error` with `source="client-diagnostic"`. Use PM2 logs and Nginx access logs together when diagnosing upload failures. If users see only generic `上传失败`, check for nearby `client-diagnostic` entries first.

## Ali Static Server

- Role: static mirror for `_next/static`, generated files, and home assets.
- IP: `101.37.129.164`.
- Static root: `/var/www/flashmuse-static`.
- Local server info file exists outside the repo under `E:\project\【2】server\阿里服务器\阿里服务器.txt`. Do not copy passwords into Git or handover docs.
- Malaysia deploy script uses `/root/.ssh/flashmuse_to_ali_ed25519` internally to sync Ali static assets.

Observed during rebuild:

- Nginx service on Ali was active.
- `/var/www/flashmuse-static/_next/static` had timestamp `2026-06-20 20:22`, matching the latest deploy window.
- Ali local SNI checks returned 200 for one real `_next/static` file.
- 2026-06-26 after domain review passed, public HTTP/HTTPS access for `ali.venusface.com` and `static.venusface.com` was fixed and verified. HTTP now redirects to HTTPS for those hosts while `/.well-known/acme-challenge/` is served from `/var/www/letsencrypt`. HTTPS returns 200 for `https://ali.venusface.com/`, `https://static.venusface.com/flashmuse-cache-health`, a real `_next/static` file, and a known generated video.
- Ali certificate `flashmuse-ali-static` was reissued via HTTP-01 webroot and expires on `2026-09-24`. Renewal config uses `authenticator = webroot`; `certbot.timer` exists; deploy hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` runs `nginx -t` and reloads Nginx after renewal; `certbot renew --dry-run --cert-name flashmuse-ali-static --no-random-sleep-on-renew` passed.

## Public Domains

- Main app: `https://main.venusface.com`.
- API: `https://api.venusface.com`.
- Ali fast entry and static domains: `https://ali.venusface.com`, `https://static.venusface.com`.

Verified during rebuild:

- `https://main.venusface.com/workspace` -> 200.
- `https://api.venusface.com/api/model-availability` -> 200.
- `https://main.venusface.com/admin` -> 200.

## Deployment Rules

- Before deploying, inspect local `git status` and `git diff`.
- Do not overwrite unrelated local changes.
- For database changes, run Prisma migration deploy and generate on the server before app build when needed. Use the PM2 environment pattern above if direct env loading fails.
- Use the standard Malaysia deploy script unless there is a specific reason not to.
- The deploy script builds, restarts PM2, saves PM2 state, and syncs `_next/static` to Ali.
- Keep `.env`, `.env.local`, keys, SMTP credentials, and server passwords out of Git and handover docs.
- Deployment decision rule: if the change is low-risk and should not meaningfully affect current frontend users, the AI may deploy directly after local verification and then report the result.
- If deployment may interrupt active users, running generation tasks, database migrations, auth/session behavior, payment/credits, media persistence, or server availability, do not deploy first. Explain the risk to the user and ask for approval before deploying.
- Do not keep old blanket rules that say every deployment must be approved first. The current rule is risk-based: low-impact deploys can proceed; risky deploys require user confirmation.
- Nginx config changes are allowed when they fix a clear production issue, but always back up the config, run `nginx -t`, and reload rather than restart the server.
- For risky deploys that may affect workspace or asset display, run a before snapshot and after snapshot with `prod-deploy-snapshot.mjs`; do not rely only on HTTP 200 checks.

## Useful Production Checks

Run from local:

```powershell
ssh -i "E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem" root@101.47.19.109
```

Run on Malaysia:

```bash
cd /var/www/flashmuse
pm2 status
curl -I https://main.venusface.com/workspace
curl -I https://api.venusface.com/api/model-availability
ls -1 .deploy-backups | tail
ls -1 .runtime/media-migration-logs | tail
node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot manual-check
```
