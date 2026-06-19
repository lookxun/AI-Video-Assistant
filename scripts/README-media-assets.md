# Media Asset Migration

Use this flow to migrate one user at a time from legacy workspace assets into `MediaAsset` and `UserAssetState`.

Do not run a blind all-user migration. Always inspect dry-run output first.

## One User Dry Run

```bash
node scripts/migrate-user-media-assets.mjs --user=USER_ID
```

This runs, in order:

1. `scripts/rebuild-media-asset-registry.mjs --dry-run --user=USER_ID`
2. `tmp/merge-duplicate-media.js --dry-run --user=USER_ID`
3. `tmp/enrich-media-assets-from-sources.js --dry-run --user=USER_ID`
4. `tmp/enrich-media-thumbnails.js --dry-run --user=USER_ID`
5. `tmp/verify-visible-media-after-merge.js USER_ID`
6. `tmp/verify-media-costs.js USER_ID`
7. `tmp/count-user-media-breakdown.js USER_ID`
8. `tmp/audit-duplicate-media-summary.js USER_ID`
9. `scripts/audit-visible-duplicate-media.mjs USER_ID`
10. `scripts/audit-user-media-cost-gaps.mjs USER_ID`

## Apply One User

```bash
node scripts/migrate-user-media-assets.mjs --user=USER_ID --apply
```

The apply mode still runs each dry-run immediately before the real write for that step.

## Verify Only

```bash
node scripts/migrate-user-media-assets.mjs --user=USER_ID --verify-only
```

## Selected Users Batch

```bash
node scripts/migrate-selected-media-users.mjs --users=ID_1,ID_2 --apply
```

This still runs the single-user flow per user and writes full logs to `.runtime/media-migration-logs/`.

## Required Checks

Before applying a user, confirm:

1. Duplicate merge keeps `/generated/...` local URLs and archives remote temporary URLs.
2. Enrichment does not write `-`, empty strings, or internal rule text as prompts or parameters.
3. Thumbnail/poster paths look like existing `/generated/...` files when possible.
4. Final media cost sums match media `CreditLedger` sums.
5. User asset categories use current product categories: `character_image`, `scene_image`, `shot_image`, `conversation_uploads`, `conversation_images`, `conversation_videos`, `workflow_uploads`, `workflow_images`, `workflow_videos`, or `trash`.
6. `audit-visible-duplicate-media` returns `visibleDuplicateGroups: 0` after duplicate merge.
7. If `audit-user-media-cost-gaps` reports unmatched ledgers, only accept the result when they have no `mediaUrls`; do not guess cost mapping from prompt text.

Keep the `tmp/` scripts until the migration has been completed and audited for all users.
