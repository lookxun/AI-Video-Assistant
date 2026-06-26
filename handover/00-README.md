# FlashMuse Handover

Last rebuilt: 2026-06-20

This folder is the current handover entry. The previous long handover set was moved to `historical-handover-docs-last-used-2026-06-20/` because it mixed current facts with outdated May and early June decisions.

Read in this order:

1. `01-current-status.md`
2. `02-architecture-and-data.md`
3. `03-deploy-and-servers.md`
4. `04-product-rules.md`
5. `05-next-actions.md`
6. `06-memo-tasks.md`
7. `07-remote-video-url-debug.md`
8. `CHANGELOG.md`

Project path: `E:\project\FlashMuse_Agent`

Local root note, 2026-06-26:

- The temporary copied folder `E:\project\FlashMuse_Agent` was removed after comparing it with the original `E:\project\AI-Video-Assistant` folder.
- The original `E:\project\AI-Video-Assistant` folder, which had the larger and more complete local state including `.runtime/`, was renamed to `E:\project\FlashMuse_Agent`.
- The old path `E:\project\AI-Video-Assistant` should no longer exist. Continue from `E:\project\FlashMuse_Agent`.
- The internal planning folder was renamed from `AI-Video-Assistant_Project Planning` to `FlashMuse_Agent_Project Planning`.
- Final local validation after the rename: `npx tsc --noEmit` passed.

Product name: `闪念 / FlashMuse`

Stack: `Next.js 16.2.4`, `React 19.2.4`, `Prisma 6.19.3`, `PostgreSQL`, `Tailwind CSS 4`.

Default rule for future handover maintenance:

1. When the current handover docs become too long or start mixing old and current facts, archive the whole current set into a new English folder named like `historical-handover-docs-last-used-YYYY-MM-DD`.
2. Write a new smaller current set by extracting only important, still-valid content.
3. Treat archived docs as backup only. Use them when current docs are insufficient or a difficult bug needs historical context.
4. Do not delete archived handover folders.
5. Archived folders named `historical-handover-docs-last-used-*` are read-only. Do not modify, overwrite, or move files inside them unless the user explicitly asks to reorganize historical backups.
6. Future handover updates must be written to the current files directly under `handover/`, not into archived folders.

Important local state on rebuild:

- Local key source files match the currently deployed Malaysia server source hashes for `src/lib/media-assets.ts`, `src/app/api/media-assets/route.ts`, `src/app/api/workspace-state/route.ts`, and `src/components/chat-workbench.tsx`.
- Local Git still has uncommitted deployed changes. Do not assume GitHub is current.
- Latest local commit seen during rebuild: `508008e Add media asset migration tooling`.
