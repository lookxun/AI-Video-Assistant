# Changelog

## Current Snapshot

### 2026-06-20 线上追加：其它账号资产新表迁移完成并整理正式脚本

- 新增正式迁移脚本 `scripts/migrate-user-media-assets.mjs`，单账号按固定顺序执行：`rebuild-media-asset-registry`、远程/本地重复合并、字段补全、缩略图/封面补全、数量/成本/重复校验。新增 `scripts/migrate-selected-media-users.mjs`，用于多个账号逐个执行并把完整日志写到 `.runtime/media-migration-logs/`。
- 新增审计脚本 `scripts/audit-visible-duplicate-media.mjs` 和 `scripts/audit-user-media-cost-gaps.mjs`，分别检查可见媒体是否仍有重复、媒体扣费流水是否能匹配到媒体。新增 `scripts/README-media-assets.md` 记录使用方式和验收条件。
- 本地验证：`npx tsc --noEmit` 通过；已迁移本地 `ID_113219` 和 `ID_779117` 两个有媒体账号，最终可见重复均为 0。`ID_779117` 本地可见媒体 `574`、归档重复 `17`；本地旧流水成本缺口来自缺少 `mediaUrls`，未做不安全猜测。
- 线上已迁移除试点账号 `ID_636611` 外的全部 20 个有媒体账号：`ID_973447 / ID_294338 / ID_316782 / ID_911584 / ID_415958 / ID_963115 / ID_868181 / ID_315163 / ID_947011 / ID_193006 / ID_554897 / ID_332396 / ID_262993 / ID_379461 / ID_955937 / ID_847338 / ID_673536 / ID_686996 / ID_852101 / ID_953031`。3 个无媒体账号 `ID_778841 / ID_476875 / ID_164561` 无需迁移。
- 线上结果：所有 20 个账号迁移成功，完整日志在 `/var/www/flashmuse/.runtime/media-migration-logs/`；最终 `visibleDuplicateGroups=0` 且 `unmatchedLedgers=0`。`ID_636611` 保持此前试点结果。
- `.gitignore` 新增 `/tmp/*.tgz`，避免部署压缩包误提交；`tmp/` 中迁移相关 JS 脚本仍保留，暂不删除。

### 2026-06-20 线上追加：ID_636611 新媒体表试点、资产库分页、成本平摊、重复合并和数据补全

- 本轮继续大量线上直接部署，未提交/推送 GitHub。核心目标是先把 `ID_636611 / 12424740@qq.com` 的图片/视频迁移到新表并验证迁移方法，确认后再迁其它账号。新增迁移 `202606200100_media_asset_cost_fields`，给 `MediaAsset` 增加每媒体成本字段；新增迁移 `202606200200_media_asset_archive_fields`，给 `MediaAsset/UserAssetState` 增加归档/隐藏字段。线上已执行 `prisma migrate deploy` 和 `prisma generate`。
- 性能优化：`/api/workspace-state?summary=1&panel=chat` 曾对 `ID_636611` 返回约 `306KB`，原因是消息 JSON 重复携带整会话媒体索引；`src/lib/workspace-sessions.ts` 已裁剪返回消息字段，首屏降到约 `21KB`。资产库改成按分类分页读取，接口为 `/api/workspace-state?assetsOnly=1&assetFilter=...&assetOffset=...&assetLimit=60`，返回 `assetCounts / assetsHasMore / assetsNextOffset`。刷新资产库不再先跳对话模式，前端初始 activePanel 读取本地 UI 状态。
- 资产分类口径修正：当前用户资产库只保留 `character_image / scene_image / shot_image` 三类；对话流为 `conversation_uploads / conversation_images / conversation_videos`；未来工作流预留 `workflow_uploads / workflow_images / workflow_videos`。旧 `shot_video / other` 不再作为用户资产分类。服务端排序改为最新优先：`MediaAsset.firstSeenAt desc, createdAt desc, id desc`。
- 媒体成本规则落地：图片/视频费用平摊到每个 `MediaAsset`；优化提示词 token、反推提示词 token、普通对话 token 独立在 `CreditLedger`，不摊到媒体。`ID_636611` 可见媒体成本总和与媒体流水完全对齐：`usd=133.152183`、`cny=937.906716`、`credits=8779`、`promptTokens=244638`、`completionTokens=14212458`、`totalTokens=14457096`。
- 远程/本地重复媒体合并：`ID_636611` 有 156 组“远程临时 URL + 本地 /generated URL”重复。新增 `tmp/merge-duplicate-media.js` 并执行：保留本地 URL 记录，合并远程记录成本/流水/参数/提示词，远程记录设置 `archivedAt/archiveReason=duplicate_remote_url/duplicateOfMediaAssetId`，对应用户状态设置 `hiddenAt/hiddenReason=duplicate_remote_url`。可见媒体变为 263，归档重复项 156。
- 数据补全：新增 `tmp/enrich-media-assets-from-sources.js` 并对 `ID_636611` 执行。补全优先级为 `WorkspaceMessage` > `CreditLedger` > 旧 `state.assets`，并做远程/本地 URL 归一。真实补全 `223` 条媒体：补模型 39、比例 104、分辨率 104、图片尺寸 64、视频时长 40、generationSettings 205、messageId 54、宽高 41、creditLedgerId 14、提示词 99、requestId 3。接口现在返回模型展示名而非 provider ID。
- 缩略图/封面：新增 `tmp/enrich-media-thumbnails.js` 并对 `ID_636611` 执行，补 `thumbnailUrl` 177 个、`posterUrl` 13 个。`src/components/chat-workbench.tsx` 的 `AssetItem` 增加 `thumbnailUrl`，资产卡片优先使用新表缩略图。`src/app/api/workspace-state/route.ts` 返回 `thumbnailUrl/posterUrl`。
- 修复对话流上传分类：左侧数量按 `/upload_image/` 统计，右侧也改为按 `mediaAsset.url contains /upload_image/` 查询；`conversation_images` 排除 `/upload_image/`。解决对话流上传图片数量为 6 但右侧随机 0/2/5 的问题。
- 其它账号迁移顺序已确定，必须逐账号执行并每步 dry-run：1）`rebuild-media-asset-registry.mjs --dry-run --user=USER_ID` 后真实跑；2）`tmp/merge-duplicate-media.js --dry-run --user=USER_ID` 后真实跑；3）`tmp/enrich-media-assets-from-sources.js --dry-run --user=USER_ID` 后真实跑；4）`tmp/enrich-media-thumbnails.js --dry-run --user=USER_ID` 后真实跑；5）用 `verify-visible-media-after-merge.js`、`verify-media-costs.js`、`count-user-media-breakdown.js`、`audit-duplicate-media-summary.js` 核对数量、成本、重复和分类。不要直接全量。
- 本轮线上备份目录包括 `202606200005-asset-load-stability`、`202606200011-asset-panel-initial-state`、`202606200030-chat-assets-paging`、`202606200100-media-cost-fields`、`202606200120-current-asset-categories`、`202606200135-asset-pagination-preview-fix`、`202606200142-asset-render-limit-fix`、`202606200150-asset-newest-first`、`202606200205-duplicate-media-merge`、`202606200230-media-enrichment-display`、`202606200245-upload-filter-fix`、`202606200300-thumbnail-poster-fields`。构建均通过，仅既有 Turbopack/NFT tracing warning，PM2 online，阿里静态已同步。

### 2026-06-19 线上追加：媒体主表/用户资产状态表、资产库独立加载和待继续修复的资产库显示问题

- 本轮继续围绕工作台历史和资产库做大量线上直接部署，仍未提交/推送 GitHub。新增数据库表 `MediaAsset` 和 `UserAssetState`，迁移目录 `prisma/migrations/20260619223000_media_asset_registry/`；本地与线上都执行了 `prisma migrate deploy` 和 `prisma generate`。新增脚本 `scripts/rebuild-media-asset-registry.mjs`，线上已 dry-run 并真实写入新表。
- 媒体主表设计按用户要求落地：`MediaAsset` 保存固定事实，包括媒体唯一 ID、用户、图片/视频 URL、normalizedUrl、poster/thumbnail、媒体类型、来源、提示词、反推提示词、模型、比例、分辨率、尺寸、参数 JSON、原始文件名、系统名、会话/消息/流水/requestId、未来 `workflowId/workflowNodeId` 等。`UserAssetState` 保存用户可变状态，包括当前名、当前分类、原始/上一分类、是否用户改名/改分类、排序、软删除、火山素材审核状态、旧资产 JSON。来源字段预留未来 `workflow_generation / workflow_upload`。
- 历史分页修复：`/api/workspace-state?summary=1&historyOnly=1&offset=...&limit=5` 改为轻量分页，不再带 workspace assets；刷新对话页改请求 `/api/workspace-state?summary=1&panel=chat`，避免刷新对话时把资产库整包拉下来。服务端排序为 `updatedAt desc + sessionId desc`，前端 `historyNextOffset` 只使用后端返回值。
- 资产库独立加载第一版：进入/点击资产库时请求 `/api/workspace-state?assetsOnly=1`；资产右侧未加载时显示 `加载中...` 和蓝色进度条；输入框 `@` 引用资产时如果 assets 未加载，会自动拉资产并先显示 `加载中...`。服务端 `assetsOnly=1` 优先从新表 `UserAssetState + MediaAsset` 返回 legacy `AssetItem`，没有新表数据才回退旧 `UserWorkspaceState.state.assets`。
- 资产缩水事故和止血：拆分加载后，前端保存 payload 不带 assets，而服务端旧 PUT 未保留缺失字段，导致 `ID_636611` 的 `state.assets` 一度缩水到 13。已修 `mergeWorkspaceAssets()`：如果 payload 缺 `assets / assetGenerateJobs`，保留现有 state。已用可靠来源恢复到 106，并备份恢复前状态 `.runtime/migration-backups/2026-06-19T14-19-29-710Z-ID_636611-before-reliable-asset-restore.json`。
- 线上新表盘查结果：24 个账号有媒体数据。`ID_636611 / 12424740@qq.com` 旧 assets 106，新表发现 408 个媒体：`character_image=36`、`scene_image=11`、`shot_image=18`、`shot_video=104`、`other=239`。这些数量来自旧资产 JSON、WorkspaceMessage、imageReferences、CreditLedger metadata 合并去重。`other` 数量大是因为不确定分类不再硬猜。
- 新表接口兼容修复：第一次上线后用户看到资产库 0，经排查不是数据库 0，而是旧前端分类依赖 `librarySource === "asset_generation"`。已修：新表返回的角色/场景/分镜/分镜视频都强制 `librarySource="asset_generation"`；并返回 `lockedType: true`，避免前端 `normalizeStoredAssets()` 按提示词二次猜分类。
- 当前仍未完成：用户最后反馈资产库“终于加载出来”，但很多封面/缩略图不显示；一次加载整个资产库慢；“工作流生成视频”数量先为 6，打字时变为 7，可能仍未加载全；再次点击资产库会重新加载。当前点击资产库会强制 `loadWorkspaceAssets(true)`，这只是绕过旧空状态，不是最终方案。下一步应做分类级分页/按需加载：左侧只读计数，右侧按当前分类分页加载媒体，避免一次拉 408+。
- 重点排查方向：查 `assetsOnly=1` 请求是否真正发出、响应大小/耗时、前端是否用最新静态 JS、是否有 `/api/client-error` 或 PM2 错误、缩略图/封面是否因 `posterUrl`、`getMediaThumbnailUrl()`、阿里静态 `image-thumbnails` 或 `/api/media-thumbnail` 缺失导致。不要再凭感觉修。
- 本轮主要文件：`prisma/schema.prisma`、`prisma/migrations/20260619223000_media_asset_registry/migration.sql`、`scripts/rebuild-media-asset-registry.mjs`、`src/app/api/workspace-state/route.ts`、`src/components/chat-workbench.tsx`。线上备份目录包括 `20260619210659-history-load-more`、`20260619212823-history-only-slim`、`20260619215614-split-panel-loading`、`20260619221531-preserve-assets-on-shell-save`、`20260619222351-mention-lazy-assets`、`20260619230959-media-registry`、`20260619232439-lock-registry-asset-types`、`20260619233125-asset-library-source-fix`、`20260619233936-force-load-assets-button`。

### 2026-06-19 线上追加：后台按需加载、历史防覆盖、资产库防缩水和待继续排查的资产库异常

- 本轮有大量线上直接部署，未提交/推送 GitHub。工作流模式继续保持线上禁用，未设置 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true`。多次执行 `/usr/local/bin/deploy-flashmuse-production.sh`，线上 build 通过，PM2 `flashmuse` online，阿里 `_next/static` 已同步并清缓存。
- 后台概览新增在线相关统计：`当前在线人数` 为最近 60 秒 `Session.activeWorkspaceSeenAt` 去重用户；灰字 `30分钟活跃` 为最近 30 分钟 `Session.lastSeenAt` 去重用户。修正 DAU/WAU/MAU 口径：此前把 `workspace.updatedAt` 算入活跃，导致线上 `workspaceUpdatedToday=23` 时 DAU 虚高为 23；现在只按 `Session.lastSeenAt`。同时把近 30 日活跃趋势和最近活跃用户 Top 10 改成同一口径。
- 后台概览 UI 调整：`当前总积分余额` 放到第二行第一个；`资产保存总数` 灰字合并显示 `图片：数量，视频：数量`。后台生成记录表显示调整：删除数用英文半角括号 `(n)`，删除数为 0 不显示括号。
- 生成记录大表修复：此前总数和删除数口径不一致，导致删除数可能大于总数。已改为历史对话总数使用实际 `user.conversations.length`，图片生成总数使用实际 `对话流图片 + 资产生成图片`，删除数仍按 `isDeleted`。部署后 `/admin?tab=records` 200。
- 后台性能优化：`设置` 页早返回，不再加载用户/历史/流水大数据；`生成记录` 首屏只传摘要 `AdminRecordSummary[]`，展开行再请求新增接口 `/admin/api/records/user-detail?userId=...`；`用户管理` 和 `积分管理` 也改为首屏摘要，展开时复用该详情接口加载完整信息。新增文件 `src/app/admin/api/records/user-detail/route.ts`，使用后台 Cookie 权限，未登录/无权限返回 403。相关文件：`src/app/admin/page.tsx`、`admin-users-panel.tsx`、`admin-credits-panel.tsx`、`admin-records-panel.tsx`。
- 工作台历史加载问题修复：线上历史没有丢，问题是加载失败时仍自动保存默认新对话。已软删除 `ID_636611` 的误创建新对话 `e7f8c21a-3999-4f3d-821a-b1d8825f2615`，恢复 active 到 `3f8f3022-3ca9-4aa2-a291-64f7751ab6b9`。`src/components/chat-workbench.tsx` 中初始化 `/api/workspace-state?summary=1` 超时从 8 秒放宽到 30 秒，并且保存 workspace 的 effect 只有 `workspaceLoadStatus === "loaded"` 时才允许 PUT。
- 资产库问题防护：已在 `src/app/api/workspace-state/route.ts` 增加 `mergeWorkspaceAssets()`。PUT 保存时会读取已有 workspace state，避免前端用缩水的 `assets` 覆盖数据库；如果已有资产是 `asset_generation` 或明确的 `character_image / scene_image / shot_image`，而新 payload 退成 `conversation / other`，服务端保留旧分类、名称、来源、lockedType；用户主动删到 `trash` 仍允许。
- 资产库数据修复尝试：针对 `ID_636611` 先后从历史消息、旧 workspace 备份 `.runtime/migration-backups/2026-06-06T18-48-45-483Z-user-workspaces.json`、`WorkspaceMessage.imageReferences`、`CreditLedger.metadata.creditSource` 恢复和修正资产。后来按可靠来源全量审计所有账号，发现 8 个账号有可靠资产缺失/错分类并批量修复。最后一次可靠来源一致性检查结果为 `problemUsers: 0`。
- 重要未完成：用户最后仍反馈资产库“数量、顺序、提示词、分类”不对，尤其当前账号里角色/场景仍不符合原先状态，且之前曾有对话流图片混入资产库。下一个接手者必须继续查，不要认为资产库问题已解决。应追查是哪一步代码或部署导致 `state.assets` 被缩水/错分类保存，并找更准确的事故前 `assets` 状态进行恢复；不要再靠提示词推断分类。
- 当前资产库排查建议：对比 `UserWorkspaceState.state.assets` 历史备份、`CreditLedger.metadata` 中的 `creditSource / mediaUrls / originalPrompt / settings / assetName / systemName`、`WorkspaceMessage.imageReferences`、`.runtime/media-save-jobs.json` 的远程到本地 URL 映射，以及 Nginx/PM2 日志中异常 `PUT /api/workspace-state` 时段。需要分清 `asset_generation` 资产库图片与 `conversation` 对话流图片，避免再次混淆。

### 2026-06-19 本地追加：历史加载重试、软删除体系和后台拆表统计修复

- 本轮继续只改本地，未部署、未提交、未推送。修复工作台开机恢复页面后历史列表可能长时间不出现的问题：`src/components/chat-workbench.tsx` 的 `fetchJsonWithRetry()` 增加默认 10 秒超时，初始化 `/api/workspace-state?summary=1` 单次 8 秒超时并最多自动重试 5 次；左侧历史区域增加 `历史加载中...` 灰色状态，最终失败显示通用蓝色 `重新加载历史` 按钮。
- 线上只读排查 `B_107`：PM2 日志为 `[B_107] video task polling failed Error: Video generation completed with no output (content may have been filtered)`，任务 `cgt-20260619032158-hjgsh`，模型 `byteplus:video.seedance-2-0`。结论是平台完成但无视频输出，内容可能被过滤；不是首尾帧参数，也不是真人审核。`src/lib/error-message.ts` 本地新增文案映射：`输出视频被平台过滤，未返回视频。重新生成有可能会成功。`
- 按用户最终规则实现全平台软删除：用户删除对话/图片/视频只影响用户侧可见性；服务器文件和数据库记录必须保留，后台只加删除标识。`src/app/api/asset-delete/route.ts` 改为 no-op，不再调用 `deleteLocalGeneratedAsset()`；资产回收站到期不再请求删除接口、不从 workspace 真移除，只在前端隐藏。回收站文案仍保持“删除/30天后删除”给用户看。
- 对话删除升级为数据库字段软删除。`prisma/schema.prisma` 的 `WorkspaceSession` 新增 `deletedAt DateTime?` 和索引 `@@index([userId, deletedAt, updatedAt])`；新增迁移 `prisma/migrations/20260619002000_workspace_session_deleted_at/`。前端删除对话只写 `deletedAt`；用户侧 `/api/workspace-state` 和 `/api/workspace-session` 只查询 `deletedAt: null`；后台读取全部对话并标红 `用户已删除`。
- 修复后台拆表后统计错误。线上后台大表仍读旧 `user.workspace.state.sessions`，而历史已迁到 `WorkspaceSession`/`WorkspaceMessage`，导致历史对话和视频生成显示 0。`src/app/admin/page.tsx` 本地改为构造 `adminWorkspaceState`：保留 `UserWorkspaceState.state` 中资产/设置，同时用 `workspaceSessions/workspaceMessages` 作为真实会话和消息来源；用户管理、生成记录、积分管理共用该状态。
- 后台生成记录大表五列 `历史对话 / 图片生成 / 视频生成 / 上传图片 / 上传文件` 现在显示 `总数（删除数）`，括号红色；删除图片/视频在主图和缩略图左上角显示 `已删除`，删除对话标题最前显示 `用户已删除`。修正 `对话流图片` 统计不再包含上传图片；概览图片/视频总数使用拆表工作区统计兜底，不只依赖 `User.generatedImageCount/generatedVideoCount`。
- 为以后用户误删后客服恢复做准备，新图片流水 metadata 增加 `originalPrompt`，新视频流水 metadata 增加 `settings / ratio / resolution / duration / originalPrompt`。后台在 workspace 媒体详情缺失时，会尝试从流水 metadata 和参数串恢复模型、比例、分辨率、时长、提示词。旧数据若历史上没有保存提示词，无法凭空恢复。
- 本轮验证：`npx prisma generate` 通过；`npx prisma migrate deploy` 已在本地应用 `20260619002000_workspace_session_deleted_at`；多次 `npx tsc --noEmit` 通过。为处理 Prisma DLL 文件锁，曾停止本项目本地 `next dev` Node 进程，继续测试前需重新启动本地服务。

### 2026-06-19 线上追加：Seedance 尾帧降级普通参考图、B106 排查和部署

- 用户要求调整 Seedance 图生视频参考图模式。最终规则：明确 `首帧 / 第一帧 / 从这张图开始 / 以这张图开始` 才触发首帧模式，使用第 1 张参考图并发送 role=`first_frame`；明确 `首尾帧 / 首帧和尾帧 / 第一帧和最后一帧` 才触发首尾帧模式，第 1 张 role=`first_frame`、第 2 张 role=`last_frame`，少于 2 张阻止并提示 `首尾帧生视频需要至少两张参考图`，且不清空输入框；单独 `尾帧 / 最后一帧 / 以这张图结束` 不再触发尾帧模式，不管有几张图都按普通参考图 role=`reference_image` 发；其它情况也按普通参考图处理，最多使用前 9 张。
- 修复首尾帧不足两张时输入框被清空的问题。此前专业视频模式在首尾帧数量校验前已经统一清空 `draftInput / uploadedImages`；现在校验提前到清空之前。阻止后只显示输入框上方提醒，不发请求，不清空输入框和参考图。
- 线上排查 `B_106`：对话 `f7f6be5e-8ee4-4fb0-a9f3-45c723e6f7f7`，模型 `byteplus:video.seedance-2-0`，请求 `e4e747e2-45a1-47bf-9504-d531e3f70de9:video:0`，`referenceMode=last_frame`，1 张参考图 role=`last_frame`，火山创建阶段返回 `last frame image content cannot be mixed with first frame or reference image content`。同一对话用户点重新生成后成功，诊断日志显示成功请求 `04374970-62a4-4298-9c13-e20353434e4c:video:0` 按普通 `reference_image` 发并生成成功。因此确认单独 `last_frame` 不应再使用。
- 本轮短暂尝试过“单独尾帧提示需要同时提供首帧和尾帧图片”的规则，但用户明确改为“说尾帧不管有几张图都按普通参考图发”。最终代码已按用户最终要求落地，接手后不要恢复单独尾帧提示或 `last_frame`。
- 修改文件：`src/components/chat-workbench.tsx`、`src/app/api/video/route.ts`、`src/lib/openrouter-video.ts`。本地 `npx tsc --noEmit` 通过；已多次部署线上，线上 `npm run build` 通过，仅有既有 Turbopack/NFT tracing warning；PM2 `flashmuse` online；阿里 `_next/static` 已同步并清缓存；`https://main.venusface.com/workspace` 和 `https://api.venusface.com/api/model-availability` 均 200。没有提交或推送 GitHub。

### 2026-06-19 文档同步：本对话交接记录

- 用户要求把本对话框内所有做的内容更新到交接文档和更新日志，确保下一个接手的 AI 能保留记忆并继续工作。
- 本轮只更新文档，没有业务代码改动、没有数据库改动、没有部署、没有提交/推送，也没有运行类型检查或构建。
- 更新文件：`handover/00-README.md`、`handover/03-progress-and-status.md`、`handover/05-chat-history-highlights.md`、`handover/CHANGELOG.md`。
- 状态提醒：本轮文档更新前工作区已包含大量既有未提交改动。下一个 AI 接手时先检查 `git status` 和完整 diff，不要覆盖或回退非本轮改动。

### 2026-06-19 线上追加：非工作流功能上线、工作流线上禁用、Seedance 模式校准和视频诊断日志

- 本轮按用户要求先把“除工作流模式相关内容外”的改动部署线上。实际部署后又按用户确认改为：完整代码可以上线，但线上生产环境必须禁用工作流入口，用户不能进入未完成工作流；本地开发必须保持工作流可用。当前 `src/components/chat-workbench.tsx` 使用 `WORKFLOW_MODE_ENABLED`：若设置 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` 则按该值；否则 `NODE_ENV !== "production"` 时开启，本地 dev 默认开启，线上 production 默认关闭。线上左侧工作流按钮禁用并显示 `未开放`，若旧本地状态保存 `activePanel: "workflow"` 会自动回到 `chat`。
- 已部署历史拆表和消息拆表到线上：应用迁移 `20260617000000_workspace_sessions`、`20260617001000_workspace_messages`；执行 `node scripts/migrate-workspace-sessions.mjs --dry-run` 显示 23 个用户 60 条会话，真实迁移完成；执行 `node scripts/migrate-workspace-messages.mjs --dry-run` 显示 57 个会话 650 条消息，真实迁移完成；二次 dry-run 均为 0。部署后 `/workspace`、`/admin`、`/api/model-availability` 均 200，PM2 online，阿里 `_next/static` 已同步并清缓存。
- 已部署非工作流 UI 和后端功能：左侧栏 80px 折叠态、折叠历史弹层、历史加载更多、消息加载更早、火山视频真人参考图自动审核兜底、后台用户详情移除 `登录设备`、全局按钮黑色 focus outline 去除。注意工作流画布代码也已在服务器代码中，但线上按钮禁用，用户无法进入。
- 后台用户管理排序已修：此前按“最近活跃时间”排序，包含 workspace `updatedAt`，导致保存工作区的用户排到前面；现在用户管理表按 `getUserLatestLoginActivity()` 排序，即 `lastLoginAt / Session.lastSeenAt` 的最近时间倒序，没登录记录再按创建时间兜底。已部署，`/admin` 200。
- 对话流右上角“使用量”浮层已改：隐藏美元和人民币；显示顺序为 `Tk`、积分、淡横线、图片数、视频数。积分放在 Tk 下方，横线左右缩进不顶到边，颜色用和“使用量”文字一致的 `#8f8f8f` 但 40% 透明度。已部署。
- 视频版权风控错误文案已改：`输出视频可能涉及版权限制，平台拒绝生成。重新生成有可能会成功。`。原因是 B_103/B_104 排查显示这类错误是火山输出视频审核阶段的随机风控，同 prompt 重新生成可能成功。
- 新增 `src/lib/video-diagnostics-log.ts` 和 `.runtime/video-diagnostics-log.jsonl` 诊断日志。日志记录 BytePlus/Seedance 创建请求、首帧/尾帧/首尾帧模式、参考图 role 分配、自动审核开始/公网 URL 解析/素材创建/素材 Active/失败/完成、创建成功、创建错误、轮询成功、轮询错误、完成但无 URL。日志不写完整图片 URL 和完整 prompt，只写 requestId、conversationId/title、模型、参数、referenceMode、图片数量、引用类型摘要、host/pathTail、错误 message/stack 头部等。已部署。
- 线上排查 `B_103`：任务 `cgt-20260619030625-cdl79`，模型 `byteplus:video.seedance-2-0`，创建成功 `2026-06-18T19:06:25.704Z`，约 8 分钟后 `2026-06-18T19:14:27.554Z` 在轮询阶段返回 `output video may be related to copyright restrictions`。这是输出视频版权风控，不是创建阶段错误，平台生成/审核后才返回，所以用户会等较久。
- 线上排查 `B_104`：任务 `cgt-20260619032158-hjgsh`，模型 `byteplus:video.seedance-2-0`，提示词为 `@角色24 生成一段在很多人的大街上走的视频。突然天空中出现外星飞船...`，实际发给火山的 prompt 中没有 `<system-reminder>`，创建成功后约 4 分钟在轮询阶段返回同类输出版权风控。用户点重新生成后成功，说明该风控有随机性，取决于输出画面而非 prompt 必然违规。
- 线上排查 `video_4_d20`：文件 `/generated/users/ID_636611/videos/1781811347630-ce51e20b-8817-48ab-b4b5-1944eeb3e42c.mp4`，任务 `cgt-20260619033138-t9mjp`，提示词 `@场景5 作为第一帧开始...`，诊断日志确认 `referenceMode: "first_frame"`，参考图 role 为 `first_frame`，是首帧模式生成成功。
- 重要修正：根据 BytePlus 官网文档，`Image to video - first frame`、`Image to video - first and last frames`、`Multimodal reference video generation` 是互斥场景，不能混用。当前已改代码：普通参考图模式最多使用前 9 张且全部 `reference_image`；首帧模式只传第 1 张且 role=`first_frame`；首尾帧模式只传前 2 张，第一张 `first_frame`、第二张 `last_frame`；单独尾帧不再传 `last_frame`，而是普通参考图；多余图片前端会提示但不阻止生成，后端也强制裁剪，避免绕过前端混传。已部署。
- 本轮所有线上改动均已通过本地 `npx tsc --noEmit` 和线上 `npm run build`；线上构建仍只有既有 Turbopack/NFT tracing warning。没有提交 GitHub。当前本地工作区仍 dirty，包含已部署改动、工作流本地代码、交接文档更新等；提交前必须完整检查 `git status` 和 diff。

### 2026-06-19 本地追加：工作流画布第一版和画布基础操作

- 本轮继续只改本地，未部署、未提交、未推送。用户要求参考另一个项目 `E:\project\clean_project_code` 的工作流代码，但明确先不要导演台，颜色必须用本项目自己的浅灰/白/蓝风格，不能影响其它功能，积分扣除必须走本项目自己的积分链路。
- 已新增 `src/components/workflow-canvas.tsx`，作为当前项目工作流第一版画布。不引入 ReactFlow/three/slate，不使用对方项目的黑色 `cf-*` 主题、不使用其 FastAPI/计费/上传链路。画布只在 `activePanel === "workflow"` 时挂载。
- `WorkflowItem` 已扩展 `canvas` 和 `activeWorkflowId` 相关状态。工作流画布数据跟随现有 `/api/workspace-state` 保存：`workflowItems[].canvas = { nodes, edges, viewport }`。没有新增数据库表或迁移。
- 第一版节点：文本节点、图片生成节点、视频占位节点。图片节点会读取连入文本节点内容并拼接自身提示词，调用本项目 `/api/image` 生成图片；后端扣费仍走 `chargeCredits()`。工作流图片生成后的余额只刷新左下积分数字，不写入任何聊天会话用量，避免污染对话历史。
- 画布基础交互已完成：添加节点、拖拽节点、连线、允许节点拖到负坐标。节点坐标不因缩放变化而被破坏。
- 左下工具栏已完成：鼠标选择、手型移动、缩小、缩放百分比、放大、定位全部节点。快捷键：`V` 切回鼠标选择；按住 `空格` 临时手型移动画布；`F` 定位全部节点。鼠标滚轮直接缩放，不用按 `Ctrl`；缩放接近 `100%` 自动吸附到 `100%`。
- “定位全部节点”会按所有节点边界居中找回，最多放大到 `100%`，节点太分散时自动缩小。没有节点时重置到原点和 `100%`。
- 每个工作流独立保存画布视口 `x/y/zoom`。切到对话或资产再回到工作流，会恢复最后离开时的画布位置和缩放；切换不同工作流也会恢复各自定位。
- 左侧“工作流模式”已去掉 `未开放` 标签，颜色从禁用灰改成正常入口灰。全局 `button` 和 `[role="button"]` 默认黑色 focus outline 已去掉，解决按空格时出现粗黑描边。后台用户详情移除了 `登录设备` 展示项。
- 本轮验证：`npx tsc --noEmit` 通过。`npm run build` 曾失败于 Google Fonts `Geist Mono` 拉取失败，非本轮代码问题；仍有既有 `video-poster` NFT tracing warning。

### 2026-06-18 本地追加：折叠侧栏、工作流网格工作区和 Seedance 首尾帧图生视频

- 本轮继续只改本地，未部署、未提交、未推送。用户要求先不测试火山自动审核，火山审核完整链路仍作为部署后重点测试项。本轮主要改工作台基础 UI、工作流模式第一版和 Seedance 图生视频模式。
- 工作台左侧栏折叠态从完全隐藏改为保留 `80px` 宽度。折叠后 Logo 只显示图片 Logo；三个模式按钮只显示图标；模式区下方有同宽横线；`新建对话 / 新建工作流` 为正方形虚线框并只显示居中 `+`；资产库分类只显示图标；底部积分只显示积分图标和数量；底部用户区只显示头像。
- 折叠态历史对话改为一个历史图标按钮，点击后右侧弹出历史菜单。菜单保留历史切换、加载更多、运行中光环、每条三点菜单以及置顶/重命名/删除。三点二级菜单已改成独立 `portal` 浮层，避免被滚动容器裁切遮挡。
- 折叠态底部细节已修：积分卡和头像都收在 `80px` 竖线内；积分卡点击打开用户中心 `我的积分`；头像菜单功能保留，菜单左边和头像按钮左边对齐，不再被浏览器边缘裁掉。
- 工作台 Logo 功能已调整：工作台内 Logo 不再切换线路，展开态点击收起侧边栏，折叠态点击展开侧边栏；首页 Logo 切换线路功能保留，不受影响。
- 工作流模式右侧已隐藏标题栏，整个右侧区域作为工作区；聊天内容区内边距在工作流模式下取消；工作流背景改为铺满全区域的细网格 + 大网格叠加，颜色保持当前浅灰体系。
- Seedance 图生视频当时新增明确参考模式：默认仍是普通参考图 `reference_image`；用户明确说首帧时第一张参考图 role 为 `first_frame`；当时单独尾帧会传 `last_frame`；明确首尾帧时第一张图 `first_frame`、第二张图 `last_frame`。注意此条已被 2026-06-19 最终规则覆盖：单独尾帧现在一律普通参考图，不再传 `last_frame`。
- 该 Seedance 首尾帧接线覆盖专业视频、通用/Agent 自动视频和重新生成。注意：BytePlus 文档页直接抓取不到 role 字段完整说明，当前按现有 `content[].role` 结构接入，最终需要部署后真实调用 Seedance 2.0 / Fast 校准。
- 本轮验证：多次 `npx tsc --noEmit` 通过。核心改动：`src/components/chat-workbench.tsx`、`src/app/api/video/route.ts`、`src/lib/openrouter-video.ts`。

### 2026-06-18 本地追加：火山视频真人参考图自动审核和自动重试

- 本轮只改本地，未部署、未提交、未推送。按用户要求取消显式“火山素材审核”用户入口，改成 BytePlus 火山视频模型的自动兜底流程，仅作用于 `byteplus:video.seedance-2-0-fast` 和 `byteplus:video.seedance-2-0` 生视频。
- 旧逻辑是：火山返回真人/隐私参考图错误后，前端显示失败并结束任务。新逻辑是：首次创建视频任务如果返回真人/隐私参考图错误，后端先返回 `status: "reviewing"`；前端追加一条蓝色、无横线的特殊系统提示 `系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....`，然后带 `autoBytePlusAssetReview: true` 重新请求；后端自动提交本次参考图到 BytePlus 一方素材库，审核通过后用 `asset://{id}` 自动重试创建视频任务。
- 多张参考图时无法准确知道哪一张触发真人限制，因为平台错误一般不返回具体索引或 URL。当前会审核本次视频任务用到的全部参考图，避免一张一张猜测导致多轮失败。
- 自动审核会写回 workspace 资产字段：`bytePlusAssetId / bytePlusAssetGroupId / bytePlusAssetStatus / bytePlusAssetUpdatedAt`。已有 `Active` 素材继续在视频生成前自动替换为 `asset://{id}`。
- 本地 B159/B160/B161 排查：失败不是自动审核流程没进，而是提交审核时参考图 URL 是供应商临时 TOS 地址，BytePlus 素材库下载时报 `Failed to download media / fetch object not found`。已改为自动审核前优先查询 `.runtime/media-save-jobs.json`，能找到本地 `/generated/...` 副本就转公网地址提交；找不到本地副本则停止审核并返回通用错误，不向用户暴露“临时地址失效”。
- 重要后续：该功能必须部署线上后重点测试。本地没有公网 HTTPS 文件服务，无法完整验证 `CreateAsset -> GetAsset Active -> asset:// 重试 -> 视频继续生成`。线上测试应使用已保存在马来服务器、可通过 `https://main.venusface.com/generated/...` 访问的真人/写实参考图，分别测试 `Seedance 2.0 Fast` 和 `Seedance 2.0`。
- 本轮验证：`npx tsc --noEmit` 通过。核心改动在 `src/app/api/video/route.ts` 和 `src/components/chat-workbench.tsx`。

### 2026-06-17 本地追加：启动脚本优化和 Docker 慢启动排查

- 本轮只做本地，未部署、未提交、未推送。排查本地启动慢发现根因是 Docker Desktop/Engine 异常：`docker compose up -d` 对 `postgres:16-alpine` 返回 Docker API 500，`Docker Desktop Service` 和 WSL `docker-desktop` 为 `Stopped`，本地 `5432/3000` 均未监听。
- `scripts/start-project.ps1` 已优化：健康检查超时从 2 秒降为 1 秒；新增 `5432` TCP 检测，数据库已启动时跳过 Docker；新增 Docker ready 检测；Docker 不 ready 时尝试打开 Docker Desktop，但只等待 5 秒；Prisma 迁移优先用 `node_modules\.bin\prisma.cmd migrate deploy`，减少 `npx` 开销。
- 结论：脚本现在会更快失败并提示 Docker 问题，但无法修复 Docker Desktop 自身 500。遇到同类问题优先让用户重启 Docker Desktop、执行 `wsl --shutdown` 或重启电脑。
- 本轮为运行 `npx prisma generate` 曾停止本项目本地 `npm run dev / next dev` Node 进程释放 Prisma DLL 文件锁；继续本地测试前需要重新启动服务。

### 2026-06-17 本地追加：WorkspaceMessage 消息拆表和历史消息分页

- 本轮只做本地，未部署、未提交、未推送。新增 `WorkspaceMessage` 表、迁移 `20260617001000_workspace_messages` 和脚本 `scripts/migrate-workspace-messages.mjs`。
- 历史消息已从 `WorkspaceSession.messagesJson` 继续拆到 `WorkspaceMessage`。点击历史时只加载最近 50 条消息；如果还有更早消息，消息区顶部显示 `加载更早消息`，每次向前追加 50 条。
- `/api/workspace-state?summary=1` 初始激活会话和 `/api/workspace-session?id=...` 都从 `WorkspaceMessage` 读取消息，不再返回整条会话的全部消息 JSON。`historyOnly=1&before=...` 用于更早消息分页。
- 线上部署规则：必须先跑 `node scripts/migrate-workspace-sessions.mjs`，再跑 `node scripts/migrate-workspace-messages.mjs --dry-run` 和 `node scripts/migrate-workspace-messages.mjs`。不要在用户请求里迁移消息。
- 本地已应用迁移并完成消息迁移：44 个 session、375 条消息，迁移后再次 dry-run 为 0。`npx prisma generate` 和 `npx tsc --noEmit` 均通过。
- 第三步其它项暂不做，仅记录后续：媒体拆表、资产拆表、生成记录拆表、老历史归档、后台生成记录/积分流水直接关联真实表。

### 2026-06-17 本地追加：历史对话拆表和手动迁移脚本

- 本轮只改本地，未部署、未提交、未推送。新增 `WorkspaceSession` 表、迁移 `20260617000000_workspace_sessions` 和脚本 `scripts/migrate-workspace-sessions.mjs`，用于把旧 `UserWorkspaceState.state.sessions` 拆成每个历史对话一行。
- 线上部署规则已明确：不要让用户首次打开工作台触发旧历史迁移。部署时先执行 `node scripts/migrate-workspace-sessions.mjs --dry-run` 看待迁移用户和会话数，再执行 `node scripts/migrate-workspace-sessions.mjs`，迁移完成后再开放新版工作台。
- 接口已改为不在用户请求中自动迁移。`/api/workspace-state?summary=1` 只从 `WorkspaceSession` 分页读历史，初始 10 条；`historyOnly=1&offset=...&limit=5` 读取更多；`/api/workspace-session?id=...` 按 `sessionId` 读取单条完整消息。
- 前端左侧历史列表初始显示 10 条，底部灰色左对齐 `加载更多`，每次追加 5 条；历史滚动区底部加留白，避免最后一项显示不全。
- 本地已应用迁移并运行脚本：dry-run 显示 `ID_113219` 有 14 条会话，真实迁移后再次 dry-run 为 0。`npx prisma generate` 和 `npx tsc --noEmit` 均通过。

### 2026-06-15 本轮追加：预览下载等待、本地清理、线上部署和 GitHub 推送

- 修复预览页右上角下载按钮对远程临时 URL 的不稳定行为。`src/components/chat-workbench.tsx` 现在会判断当前预览媒体是否仍是 `http/https` 远程 URL；如果是，下载按钮禁用并显示 `下载准备中...`；只有媒体替换为本地 `/generated/...` 后才启用下载。该规则同时覆盖图片和视频。
- 修复视频预览对象不跟随后台保存结果更新的问题。预览同步 effect 不再跳过视频，会同步最新 `url/posterUrl/sourcePrompt/previewMeta/sessionId/messageId`；视频标签增加基于 `id-url` 的 `key`，URL 更新后自动重新加载，避免下载按钮继续使用旧临时 URL。
- 线上只读核查 `12424740@qq.com / ID_636611` 的 d19 对话：共 6 个视频，全部已保存到马来 `/generated/users/ID_636611/videos/...mp4`，封面也存在。`video_1_d19`、`video_2_d19`、`video_5_d19` 的 `aliSynced=true`，其余 3 个当时为 `false`，但马来文件已存在。
- 本地磁盘清理：删除 `.next`、`tsconfig.tsbuildinfo`、依赖缓存、旧部署包/HTML 快照、旧 `restore-chat` 备份；按本地数据库引用关系删除 `public/generated` 未引用媒体 737 个，释放约 1.65GB。清理后项目约 2.47GB，`public/generated` 约 1.39GB，复扫未引用媒体为 0。该清理只影响本地，不影响线上。
- 新增工作规则并写入交接：以后所有临时生成文件、调试快照、部署中间包都必须放在项目目录内，例如 `E:\project\AI-Video-Assistant\tmp\...`；不要放到 `E:\project` 或项目文件夹外。
- 已部署线上：上传运行相关文件到马来 `/var/www/flashmuse`，执行 `npx prisma migrate deploy`、`npx prisma generate`、`/usr/local/bin/deploy-flashmuse-production.sh`；构建通过，仅有既有 Turbopack tracing warning；PM2 `flashmuse` online；阿里 `/_next/static` 已同步并清缓存。验证 `https://main.venusface.com/workspace`、`https://api.venusface.com/api/model-availability`、`https://main.venusface.com/admin` 均 200。
- 已提交并推送 GitHub：`5629ac2 Fix text billing and preview downloads`。提交包含 6 月 15 已部署但未提交的文本计费累计、工作台误退首页、`@` 弹窗、`text-cleanup.ts`，以及本轮预览下载修复、迁移和交接文档更新。`.gitignore` 已新增 `/AI-Video-Assistant_Project Planning/`，避免敏感规划资料误传。

### 2026-06-15 本轮追加：退首页修复、通用文本累计扣费、@ 弹窗修复和线上部署

- 修复阿里入口工作台偶发退回首页但未退出登录的问题。`src/components/chat-workbench.tsx` 初始登录检查只在明确 `401` 或确认无用户时退首页；`/api/workspace-state?summary=1` 临时失败不再退，只保留页面并 warning。工作台实例锁只有当前页面已经成功 `claim` 后再检测到 `active:false` 才认为被新工作台抢占；未成功 claim 时会重试 claim，不再误踢。
- 修复通用模式文本对话只累计 Tk、不扣人民币/积分的问题。`src/lib/openrouter.ts` 的 `getUsageMeta()` 现在只把 `usage.cost > 0` 当作真实美元成本；如果 `cost=0` 或缺失但有 token，会按 OpenRouter 文本价格表反推美元。新增兜底模型：`Seed 2.0 Lite`、`DeepSeek V4 Pro`、`DeepSeek R1 0528`、`Gemini 3 Flash Preview`、`Gemini 3.1 Pro Preview`、`GPT-4o`、`GPT-5.4`、`GPT-5.5`。
- 调整文本扣积分规则为后台小数累计。`prisma/schema.prisma` 给 `User` 新增 `textCreditRemainder Float @default(0)`，新增迁移 `20260612000000_user_text_credit_remainder`。`src/lib/credits.ts` 中图片/视频仍按次 `美元 -> 人民币 -> 积分` 并在人民币转积分时四舍五入；文本类则把每次成本折算为小数积分累计到 `textCreditRemainder`，累计满 1 分才扣整数积分并保留余数。
- 修复输入框下方 `@` 按钮在复制长提示词后点不开资产引用弹窗。此前底部按钮/placeholder 蓝色 `@` 先插入裸 `@` 再依赖 `activeAtQuery` 展示列表，复制长文本后光标或长度限制会导致裸 `@` 没形成查询。现在 `isAtAssetMenuOpen` 时也会生成资产分组；底部和 placeholder 的 `@` 只打开弹窗，不再先插入裸 `@`；选择资产时再插入完整 `@资产名`。手动输入 `@` 的筛选逻辑不变。
- 本地打不开排查结论：一键启动脚本卡在 `docker compose up -d`，Docker Desktop Service 为 `Stopped` 且 Docker CLI 卡住；PostgreSQL 5432 实际可用。停止卡住进程后直接独立 PowerShell 窗口 `npm run dev` 可启动，本地 `http://localhost:3000/` 和 `/workspace` 均 200。该排查未改代码。
- 第一批线上部署：备份 `/var/www/flashmuse/.deploy-backups/20260612000139/`，上传 `chat-workbench.tsx/openrouter.ts/credits.ts/text-cleanup.ts/schema.prisma` 和迁移 SQL，线上应用 `20260612000000_user_text_credit_remainder` 并 `prisma generate`，随后执行 `/usr/local/bin/deploy-flashmuse-production.sh`。构建通过、PM2 online、阿里 `/_next/static` 同步清缓存。
- 第二批线上部署：备份 `/var/www/flashmuse/.deploy-backups/20260615034553/`，只上传 `src/components/chat-workbench.tsx`，执行 `/usr/local/bin/deploy-flashmuse-production.sh`。构建通过，仅剩既有 `next.config.ts`/`video-poster` tracing warning；PM2 online，阿里静态同步清缓存。`https://main.venusface.com/workspace` 返回 200。
- Git 状态：本轮没有提交或推送。当前本地仍有未提交/未跟踪内容，包括本轮代码和迁移、交接文档更新、`src/lib/text-cleanup.ts`、`AI-Video-Assistant_Project Planning/` 等。后续提交前必须先检查 `git status` 和完整 diff。

### 2026-06-11 本轮追加：通用模式正式升级、长期记忆、权限开关、日志和线上修复

- 通用模式产品身份统一为 `闪念通用 Agent`。底层对话模型可切换，但回答能力按闪念系统整体能力，不按 DeepSeek/Gemini/GPT 裸模型能力。身份问题分层回答：问“你是谁”答闪念通用 Agent；问“你是什么模型”答闪念通用 Agent + 当前对话模型。
- 通用模式所有发送先走当前对话模型规划，不再用硬规则直接调用图片/视频模型。规划不足时追问并列出比例、分辨率、时长等选项；用户授权“随便/你自己定/以后不要问我”后自动补参数。实际生成调用通用模式里用户选的图片/视频模型。
- 修复 B_158 规划失败：`planAgentTask()` 现在在 `mode=general` 时走 `getTextProviderConfig(model, "general")`，不再误用 Agent 模型开关；`/api/agent-plan` 错误日志增加 `mode/model/requestId`。
- 修复 d49 类能力误答：用户问“能不能生图/做视频/支持视频吗”时，通用规划器将其视为潜在生成需求，返回 clarify 追问要生成什么；普通回复也禁止回答“不支持生图/生视频”。
- 通用对话模型顺序调整为 `Seed 2.0 Lite`、`Seed 2.0 Pro`、其它厂商；`/api/model-availability` 新增 `generalModelProviders`，前端按实际 provider 显示 BytePlus/OpenRouter/DeepSeek/Google/OpenAI 图标，通用回复前图标也跟随实际 provider。
- 后台用户管理新增通用模式权限开关。迁移 `20260611000000_user_general_mode_enabled` 给 `User` 增加 `generalModeEnabled` 默认 false；新增 `/admin/api/users/general-mode`；前台 `/api/auth/me` 返回该字段，未开启用户不显示通用模式，服务端绕过请求也 403。
- 新增每会话长期记忆摘要。超过约 20k tokens 首次生成摘要，之后每新增约 12k tokens 更新；请求上下文为摘要 + 最近 12 轮原文。新增接口 `/api/conversation-memory`，流水标签 `长期记忆摘要`。
- 通用/Agent 回复风格放松：轻松场景可多用表情和语气词；清单/步骤/能力列表可用 `✅/🎯/📝/💡/⚠️/📌` 等符号图标。通用模式回复按任务类型选格式：问答、交付物、方案、创作、追问。
- 后台系统设置上传规则表新增第一行 `通用模式`：图片最多 5 张、单张 ≤5MB、格式 `jpg/jpeg/png/webp`；文件最多 5 个、单个 ≤10MB、格式 `pdf/txt/csv/docx/doc/xlsx/xls/pptx/ppt/md`；视频/音频当前不支持。
- 新增 `.runtime/general-task-log.jsonl` 和 `.runtime/upload-rule-feedback-log.jsonl`。前者记录通用模式任务 intent，后者记录带上传/参考图时模型端真实错误，用于后续校准上传限制。日志不记录图片 URL、文档正文或完整用户内容。
- 用户消息下方新增 hover 时间和复制图标；历史 AI 文字切换/刷新后不再重复打字，只有本轮新生成文本打字。打字机按 grapheme 切分，避免 emoji/符号被拆开显示。
- 新增 `src/lib/text-cleanup.ts`，后端保存前和前端显示时尝试修复 UTF-8/Latin-1 mojibake，并删除 `<system-reminder>...</system-reminder>`。该修复已直接部署线上；旧历史若不可逆只能部分恢复。
- 本轮已完整部署线上并同步阿里静态，PM2 online。已提交并推送 GitHub `eee77a5 Add general mode controls and memory handling`；之后的文本清洗修复和本交接文档更新尚未提交。

### 2026-06-10 本轮追加：本地通用模式、通用对话模型后台开关和 DeepSeek 历史图片处理

- 本轮只做本地，未部署、未提交、未推送。先修本地登录失败：本地数据库缺 `User.lastLoginIp`，应用迁移 `20260610000000_user_login_audit` 后恢复；`scripts/start-project.ps1` 已新增启动前 `docker compose up -d` 和 `npx prisma migrate deploy`，避免本地迁移落后导致登录接口 500。
- 新增工作台 `通用模式`，位于 `Agent 模式` 上方。通用模式不是剧作 Agent，普通聊天走 `/api/chat mode=general`；明确生图/生视频时调用通用模式选择的图片/视频模型。通用模式工具栏有对话/图片/视频三个模型选择，等宽且不撑出输入框，文字不足用省略号。通用入口和回复图标使用用户给的 `ai-agent-line` SVG。
- 通用对话模型列表已扩展为 `Seed 2.0 Lite`、`DeepSeek V4 Pro`、`DeepSeek R1 0528`、`Gemini 3 Flash Preview`、`Gemini 3.1 Pro Preview`、`GPT-4o`、`GPT-5.4`、`GPT-5.5`；`GPT-5.5` 金色显示。DeepSeek 图标使用用户给的 SVG；对话模型按钮按厂商显示图标。
- 后台系统设置新增 `通用模式 / Agent 规划 / 意图识别` 分组。OpenRouter 列显示所有通用对话模型；`Seed 2.0 Lite` 与 BytePlus `Seed 2.0 Lite` 互斥，使用 `general.seed-2-0-lite`；另有 BytePlus `Seed 2.0 Pro` 独立一行独立开关，使用 `general.seed-2-0-pro`。`/api/model-availability` 返回 `generalModels`，前端按该列表过滤通用对话模型。
- 修通用模式 provider 链路：旧配置 `chat.seed-2-0-lite=byteplus` 曾导致通用模式里选 GPT/Seed 等仍可能映射到火山 Seed，模型自称 Seed。现在 `mode=general` 用 `general.*` key；除用户在后台打开的 BytePlus 通用模型外，其它通用对话模型直连 OpenRouter。
- 修通用模式模型身份污染：不再隔离不同模型的 assistant 历史，保留完整对话连续性。仅当用户问模型身份时，追加隐藏约束说明当前实际模型名和 ID，让模型按当前身份回答，不沿用历史中其它模型自称。
- 修 DeepSeek 纯文本模型请求：`DeepSeek V4 Pro` 和 `DeepSeek R1 0528` 在通用模式下只打包文字历史，不带历史图片字段；当前请求若带图片或 `@资产` 仍提示切换支持图片的模型。该修复针对 `B_145/B_146/B_147/B_151/B_152` 一类 `no endpoints found`。
- 已生成桌面文件 `C:\Users\ASUS\Desktop\OpenRouter对话模型清单.md`，包含 OpenRouter 当前 339 个对话模型的分类表格，未加入项目。

### 2026-06-10 本轮追加：后台生成记录媒体 URL、BytePlus 图片固定计费和扣分文案

- 修复后台生成记录、积分明细、历史媒体弹窗里的裂图问题。新增 `src/app/admin/admin-media-url.ts`，统一处理后台媒体 URL；新增 `src/app/admin/api/media-url/route.ts`，用后台登录态解析远程签名 URL 到本地保存副本。注意接口必须是 `/admin/api/media-url`，因为后台 Cookie path 是 `/admin`；此前放 `/api/admin/media-url` 时图片请求不带 Cookie 导致 401。
- 线上排查确认：`/generated` 文件未丢，采样中 `541` 个 generated 文件全部存在；裂图主要是 `197` 条旧远程签名 URL，包括 BytePlus TOS 和 OpenRouter content URL。后台现在对远程 URL 先查 `.runtime/media-save-jobs.json`，能找到保存任务就跳本地 `localUrl / thumbnailUrl / posterUrl`。
- `/admin/api/media-url` 支持 `variant=original|thumb`。左侧主图、悬停大图使用 `variant=original` 返回原图；右侧列表缩略图使用 `variant=thumb` 返回缩略图。曾排查 `37376543` 账号，右侧能显示但左侧显示小图，原因是接口默认返回缩略图；已改为主图返回原图。
- `37376543` 排查记录：线上用户为 `373765430@qq.com / ID_868181`。其生成图远程 BytePlus URL 已在保存队列落地：原图 `/generated/users/ID_868181/images/1780890311109-e52c9ea3-bfd9-4e5e-8cfd-8201adc5df64.jpg`，缩略图 `/generated/users/ID_868181/image-thumbnails/images/1780890311109-e52c9ea3-bfd9-4e5e-8cfd-8201adc5df64.jpg`。接口验证 `variant=original` 307 到原图，`variant=thumb` 307 到缩略图。
- BytePlus 图片费用兜底已改。历史统计：BytePlus 图片流水 147 条，84 条有费用、63 条为 0；有费用样本为 Seedream 4.5 `$0.04/张`、Seedream 5.0 `$0.035/张`。`src/lib/openrouter.ts` 现在在 BytePlus 图片 usage 缺失或返回 0 时按固定单价补算；如果响应中 `usage.usd/cost > 0` 仍优先使用响应值。
- 新图片流水会在 `src/app/api/image/route.ts` 写入 `settings / ratio / resolution / size / sizes`，用于后续按 2K/4K 或真实尺寸重新核算。此前旧流水大多没有分辨率字段，所以无法回溯判断 2K 和 4K 是否同价。
- 后台扣分文案拆分：`0（未返回成本）` 表示有流水但平台/旧逻辑没给成本；`0（扣分异常）` 表示 workspace 媒体完全匹配不到流水；`0（扣分关闭）` 表示后台关闭扣费；余额不足仍显示 `-实扣 / 应扣xxx`。生成记录从 workspace 补出来的无流水媒体会带 `isCreditMissing`，有 0 成本流水的媒体会带 `isCostUnavailable`。
- 本轮已按用户要求部署线上：本地和线上 build 均通过，仅剩既有 Turbopack/ffmpeg tracing warning；PM2 `flashmuse` online；阿里 `/_next/static` 已同步并清缓存。没有提交或推送 GitHub。

### 2026-06-10 本轮追加：公网素材审核、视频兜底、后台入口和后台表格

- 线上火山素材审核入口已按用户要求重新打开：`NEXT_PUBLIC_ENABLE_BYTEPLUS_ASSET_REVIEW=true`。该入口用于真人/写实人物参考图审核，当前只在资产当前分类为 `角色图片`、`分镜图片`、`上传图片` 时显示；`场景图片`、生成图片、其它分类不显示。逻辑在 `chat-workbench.tsx` 的 `canReviewBytePlusAsset`，上传图如果被移动到场景分类则不显示。
- 角色22 审核状态已在数据库确认：`bytePlusAssetId=asset-20260609180613-qc9g5`、`bytePlusAssetStatus=Active`。此前 B_31 是因为视频生成时仍传普通图片 URL，已在服务端 `/api/video` 加 `resolveBytePlusVideoReferenceImages()`，BytePlus 视频模型会从用户 workspace 资产中匹配 `Active` 素材并替换为 `asset://...`。该兜底覆盖前端状态没同步、重新生成、失败重试等场景。
- 已加视频请求日志：替换成功时输出 `[video-generation] BytePlus asset references applied`，创建成功日志带 `assetReferenceCount`。排查时优先看 PM2 日志 `/root/.pm2/logs/flashmuse-out.log`。
- B_33/B_35/B_36 是火山轮询阶段输出版权风控：`output video may be related to copyright restrictions`。已更新 `src/lib/error-message.ts`，用户红字显示 `输出视频可能涉及版权限制，平台拒绝生成。`，不再显示“平台服务临时异常”。不要添加非模型真实原因的建议句。
- 视频提示词中的 `@资产名` 已在发给模型前清洗为 `参考图中的主体`，参考图 hint 只写 `参考图1/2`，不再包含 `@角色22` 这类资产名。
- 阿里入口偶发把用户踢回首页已修：登录态和工作台实例锁检查不再因一次网络失败/5xx 就跳首页，只在明确未登录或实例失效时跳。初始工作台加载对 `auth/me`、`workspace-state` 加了轻量重试。
- 输入框 mention 已改为原子块。完整 `@图片名称` 蓝色，后续输入黑色；Backspace/Delete 一次删除整个 mention；普通黑字逐字删除。核心函数：`getEditorMentionRanges()`、`getMentionRangeForDeletion()`、`renderEditorContent()`。
- 后台打不开已修：`getCurrentAdminEmail()` 不再在 Server Component 渲染阶段补写 Cookie，避免 Next 16 抛 `Cookies can only be modified in a Server Action or Route Handler`。登录/登出 API 继续设置和清理 Cookie。
- 前台工作台左下用户菜单新增 `后台管理`：`/api/auth/me` 返回 `isAdmin`，只有 `ADMIN_EMAILS` 白名单用户显示。点击新开 `/admin` 标签页，不跳走当前工作台。
- 后台用户管理接入最近登录 IP/归属地：新增迁移 `20260610000000_user_login_audit`，`User` 新增 `lastLoginIp / lastLoginLocation / lastLoginUserAgent`；前台/后台密码登录和验证码登录均记录。IP 优先取 `x-forwarded-for` 第一个公网 IP。归属地查 `ipwho.is`，失败查 `ip-api.com`。中国地址显示省市，如 `浙江 杭州`；国外显示国家城市。老用户未重新登录显示 `未记录`。
- 后台表格 UI 已调整：用户管理中用户列固定宽度、积分列左移；积分管理用户列新增头像；积分管理和生成记录中用户列后面的列全部左对齐，左边距统一。
- 部署和数据库注意：线上 `.env.local` 存在两条 `DATABASE_URL`，第 1 条可用，第 2 条不可用；本轮执行 `npx prisma migrate deploy` 时用 Node 脚本读取第 1 条注入环境。不要在聊天或文档写出密码。一次误传 API route 到父目录导致构建多出 `/api/auth`、`/api/admin`，已删除；以后 scp route 文件必须指定完整目标 `.../login-password/route.ts`。

### 2026-06-09 本轮追加：工作规则更新

- 用户明确要求：后续任务默认只在本地代码里完成和验证，禁止自动部署服务器，禁止自动提交或推送 GitHub。
- 只有用户明确说“部署”“上线”“提交”“推送”等要求时，才允许操作线上服务器或 GitHub。
- 后续 AI 接手时，应先本地实现并汇报验证结果，等待用户决定是否部署。

### 2026-06-09 本轮追加：BytePlus 一方素材库审核接入和当前调试状态

- 已确认当前需求是 BytePlus 一方 Private asset library 的素材审核，不是 `Add real-human assets to asset library` 的真人扫码授权流程。
- 官方页面 `https://docs.byteplus.com/en/docs/ModelArk/1520757` 的路由数据里隐藏了 Private asset library API reference。直接文档编号：`2318270 CreateAssetGroup`、`2318271 CreateAsset`、`2318273 ListAssets`、`2318274 GetAsset`。
- `CreateAsset` 接口：`POST https://ark.ap-southeast-1.byteplusapi.com/?Action=CreateAsset&Version=2024-01-01`。该 API 只支持 AK/SK 签名，不支持 `ARK_API_KEY` Bearer 鉴权。服务 `ark`，Region `ap-southeast-1`，签名示例为 `HMAC-SHA256 Credential=AK.../yyyymmdd/ap-southeast-1/ark/request`。
- 新增 `src/lib/byteplus-assets.ts`：读取 `BYTEPLUS_ACCESS_KEY / BYTEPLUS_SECRET_KEY` 等环境变量，生成 `X-Date / X-Content-Sha256 / Authorization`，调用 `CreateAssetGroup / CreateAsset / GetAsset`。素材组 ID 会缓存到 `.runtime/byteplus-asset-group.json`，也可通过 `BYTEPLUS_ASSET_GROUP_ID` 固定。
- 新增 `src/app/api/byteplus-assets/route.ts`：登录用户才能调用；`POST` 把 `/generated/...` 转成 `NEXT_PUBLIC_PRIMARY_BASE_URL` 下的公网 URL 并提交图片素材；`GET?id=...` 查询素材状态。
- 修改 `src/components/chat-workbench.tsx`：资产对象新增 BytePlus 素材字段；资产预览右侧新增“火山素材审核”卡片；审核状态为 `Active` 后，BytePlus 视频生成会将模型参考图替换为 `asset://{bytePlusAssetId}`。
- 新增前端构建开关 `NEXT_PUBLIC_ENABLE_BYTEPLUS_ASSET_REVIEW`。默认不是 `false` 时显示入口。本地默认显示，线上已设置 `NEXT_PUBLIC_ENABLE_BYTEPLUS_ASSET_REVIEW=false` 隐藏入口，功能代码保留。
- 本地已补 `BYTEPLUS_ACCESS_KEY / BYTEPLUS_SECRET_KEY` 到 `.env.local`，不要提交密钥。线上也曾设置过对应变量，但后续按用户新规则不要再默认部署。
- 本地登录失败已修：本地数据库缺 `Session.activeWorkspaceInstanceId` 列，已执行 `npx prisma migrate deploy` 应用迁移。
- 当前待排查：本地提交审核仍显示通用失败；已给 `/api/byteplus-assets` 加本地错误日志。下一步查看 `start-project.log` 的 `[byteplus-assets] create failed`，判断是公网 URL 下载失败、素材库未签授权/未启用、AK/SK 权限问题还是签名问题。

### 2026-06-09 本轮追加：用量/积分显示修复、应扣积分和工作台单实例锁

- 修复右上角“使用量”里积分和人民币对不齐的问题。旧逻辑中前台 `UsageSummaryButton` 用 workspace 保存的 `session.usageSummary`，人民币由写死汇率 `7.2` 乘美元计算；真实扣费在 `src/lib/credits.ts` 中按后台 `CreditSetting.usdToCnyRate / creditsPerCny` 写入 `CreditLedger`。因此后台设置变动、历史 `usageSummary` 漏记或 workspace 被旧状态覆盖时，显示会不准。
- `src/components/chat-workbench.tsx` 的 `UsageSummary` 增加 `cny` 字段，删除前端固定汇率常量。右上角人民币直接显示真实流水折算的实际人民币，前台只展示用户实际扣分和实际人民币，不展示应扣积分。
- `src/app/api/workspace-state/route.ts` 新增 `applyLedgerUsageSummaries()`。工作区 GET 和 PUT 都会按当前用户 `CreditLedger` 真实流水重写会话 `usageSummary`，避免旧 workspace 汇总继续污染右上角显示。该逻辑还会把旧流水按当前 `creditsPerCny` 用 `credits / creditsPerCny` 反推实际人民币。
- `src/app/api/credits/me/route.ts` 已停止用 workspace `usageSummary.credits` 覆盖真实流水积分。现在“我的积分”消费积分只按 `CreditLedger`，workspace 只继续用于图片/视频数量和 token 兜底。
- `src/lib/credits.ts` 的 `chargeCredits()` 现在返回并写入流水 metadata：`expectedCredits`、`chargedCredits`、`chargedCny`、`chargedUsd`、`usdToCnyRate`、`creditsPerCny`。如果用户余额不足，实际扣分仍为 `Math.min(user.credits, expectedCredits)`，不会扣成负数；同时保留应扣积分用于后台审计。
- `/api/chat`、`/api/agent-plan`、`/api/image`、`/api/video` 返回给前台的 `usage.usd/cny` 已改为实际扣分口径。`usage` 不返回 `credits`，避免前端 `addSessionUsage(data.usage)` 和 `applyCreditResult(data.credit)` 重复累加积分。
- 后台积分明细已显示“实际扣分 / 应扣积分”。`AdminCreditFlowItem` 增加 `expectedCredits`；`CreditFlowRow` 在 `expectedCredits > credits` 时显示 `-100 / 应扣127`。对话积分、规划积分、对话流图片/视频、资产库图片、反推/优化提示词都已接入。旧流水没有 `expectedCredits` metadata 时，后台用 `item.cny * creditSettings.creditsPerCny` 反推。
- 新增工作台单页面实例锁，解决“同一浏览器多标签共享最新 Cookie，旧标签不会被单 session 踢掉”的问题。`prisma/schema.prisma` 的 `Session` 增加 `activeWorkspaceInstanceId` 和 `activeWorkspaceSeenAt`，新增迁移 `20260609000000_session_workspace_instance`。
- 新增 `src/app/api/auth/workspace-instance/route.ts`。工作台页面使用 `instanceId` 声明和检查唯一有效实例；`claim=true` 会把当前页面写入 Session，后续检查只有匹配该实例才返回 active。未登录、session 过期、用户禁用或实例不匹配都会返回 inactive。
- `src/components/chat-workbench.tsx` 进入工作台后会生成页面级 `workspaceInstanceId`，加载完成后先 claim 当前实例，再每 2 秒和窗口 focus 时检查。若不是当前实例，执行 `window.location.replace("/")` 回首页。首页登录状态仍保留，因为不会清除 Cookie。
- 已部署线上启用：同步本地改动到马来 `/var/www/flashmuse`，停 PM2，执行 `npx prisma migrate deploy`，应用迁移 `20260609000000_session_workspace_instance`，执行 `npx prisma generate` 和 `npm run build`，再 `pm2 restart flashmuse --update-env`、`pm2 save`，最后执行 `/usr/local/bin/sync-flashmuse-next-static.sh --clear-cache` 同步阿里静态并清缓存。
- 部署中发现线上 `.env.local` 的 `DATABASE_URL` 带双引号且不能直接 `source`。Prisma CLI 需要通过 Node 读取并剥掉首尾引号后设置环境变量。还发现 PostgreSQL 用户 `flashmuse` 当前密码与 `.env.local` 不一致，已把数据库用户密码重置为 `.env.local` 中的值；不要把密码写入文档、聊天或 Git。
- 验证结果：线上 `npm run build` 通过，仅有既有 `ffmpeg-static`/Turbopack tracing warning；PM2 `flashmuse` online；`https://main.venusface.com/` 返回 200；`https://api.venusface.com/api/model-availability` 返回 200；阿里 `/_next/static` 已同步。接口 `/api/auth/workspace-instance` 已出现在 Next build 路由列表。

### 2026-06-09 本轮追加：Logo 切换、上传图无提示词和马来缩略图回退

- 首页 Logo 切换已完成。`src/app/page.tsx` 新增马来/阿里站点识别：马来首页点击左上角图形 Logo 或文字 Logo 跳 `https://ali.venusface.com/`；阿里首页点击跳 `https://main.venusface.com/`。马来首页文字 Logo 右侧显示短标 `Intl.`，字体调为 `13px` 并下对齐；阿里首页不显示该标识。
- 工作台 Logo 切换已完成。`src/components/chat-workbench.tsx` 新增 `WorkspaceSite` 判断，马来工作台点击左侧 Logo 跳 `https://ali.venusface.com/workspace`，阿里工作台点击跳 `https://main.venusface.com/workspace`。马来工作台显示 `Intl.`，阿里不显示。
- 修复工作台 Logo 切换后看似退出账号：不是同账号单会话导致，真实原因是 `flashmuse-session` 以前是 host-only Cookie，不能从 `main.venusface.com` 带到 `ali.venusface.com`。已新增线上 `AUTH_COOKIE_DOMAIN=.venusface.com`，并修改 `src/lib/auth.ts` 与 `src/lib/admin-auth.ts`，设置和清除 Cookie 都带 Domain；`/api/auth/me` 会在旧 host-only Cookie 有效时补写新的域名 Cookie。验证 `Set-Cookie` 已包含 `Domain=.venusface.com`。
- 风险记录：`.venusface.com` 域 Cookie 会随请求发送到同主域子域名，包括 `dvideo.venusface.com`。Cookie 是 `HttpOnly + Secure + SameSite=Lax`，前端 JS 读不到。内部项目当前可接受；未来正式对外如要严格隔离，应改一次性跨域登录转移 token，而不是共享父域 Cookie。
- 工作台副标题统一为 `AI视频助手`。此前代码里仍有硬编码 `AI影片助手`，切换时服务端/新包先显示旧文案，客户端再变回 `AI视频助手`，导致闪一下；已统一。
- 对话流上传图提示词规则已改为“上传图永远无提示词”。`addUploadedImagesToAssets()` 不再把发送时的用户文字 `contextText` 写入上传图 `sourcePrompt`，而是固定 `sourcePrompt: "资产库上传"`、`promptSource: "upload"`。预览上传图默认显示 `暂无提示词` 和 `反推提示词` 按钮。反推成功后才写 `sourcePrompt: nextPrompt`、`promptSource: "reverse"`；生成图入库写 `promptSource: "generated"`。
- 后台也同步上传图无提示词规则。`src/app/admin/page.tsx` 对 `/generated/(users/{id}/)?upload_image/` URL 不再用 `generationMeta.originalPrompt` 或消息内容作为 prompt 兜底，只读 `imagePrompts[url]`。这样后台不会把用户输入文字误当作上传图提示词。
- 修复马来入口资产库缩略图大量不显示。根因是 `getMediaThumbnailUrl()` 在马来入口也直接拼 `/generated/.../image-thumbnails/...jpg`，很多旧资产缺静态缩略图会 404。现在马来主站/上传 API host 下返回 `/api/media-thumbnail?url=...&v=thumb256-20260606`，由马来按需生成缩略图并失败回退原图；阿里入口继续走 `https://static.venusface.com/generated/.../image-thumbnails/...jpg`，保持静态速度。已验证马来 `/api/media-thumbnail` 对用户图片返回 `200 image/jpeg`。
- 本轮相关部署均使用 `/usr/local/bin/deploy-flashmuse-production.sh`，确认马来 build 通过，仅有既有 Turbopack tracing warning；PM2 重启保存；阿里 `_next/static` 同步并清缓存。相关 GitHub 提交包括：`39edc73 Add homepage region switch logo`、`d7a156a Shorten homepage international label`、`a2fc64f Add workspace region switch logo`、`7636d90 Share auth cookies across Venusface domains`、`091afd9 Unify workspace assistant subtitle`、`edb8211 Treat uploaded chat images as promptless`、`93597bd Use thumbnail API on Malaysia entry`。

### 2026-06-08 本轮追加：跨马来/阿里工作台共享登录 Cookie

- 用户反馈工作台点击 Logo 从马来切到阿里后被跳回首页。确认不是同账号单会话导致：单会话删除只在 `createUserSession()` 新登录时触发，Logo 切换只是跨子域跳转，不会创建新 session。
- 根因是前台登录 Cookie `flashmuse-session` 之前没有设置 `Domain`，属于 host-only Cookie。用户在 `main.venusface.com` 登录后，浏览器不会把该 Cookie 发给 `ali.venusface.com`，阿里工作台请求 `/api/auth/me` 无 Cookie，就按未登录跳首页。
- 已新增线上环境变量 `AUTH_COOKIE_DOMAIN=.venusface.com`。`src/lib/auth.ts` 的用户 Cookie 和 `src/lib/admin-auth.ts` 的后台 Cookie 都会在设置/清除时带 `Domain=.venusface.com`。`/api/auth/me` 在识别到旧 host-only Cookie 仍有效时，会自动补写新的域名 Cookie，减少用户重新登录需求。
- 已部署到马来并通过部署脚本同步阿里静态。验证：`POST https://main.venusface.com/api/auth/logout` 和 `POST https://api.venusface.com/api/auth/logout` 的 `Set-Cookie` 已带 `Domain=.venusface.com`。如果用户当前页面仍加载旧 JS 或旧 Cookie，刷新一次原工作台；如仍不行，重新登录一次即可拿到共享 Cookie。
- 风险说明：`.venusface.com` 域 Cookie 会随请求发送到同主域下子域名，包括 `main/api/ali/static`，以及同主域下其它服务如 `dvideo`。Cookie 为 `HttpOnly + Secure + SameSite=Lax`，前端 JS 读不到；但其它子域服务的服务器侧可能在请求头中看到该 Cookie。当前为内部项目可接受。若未来正式对外并要求更严格隔离，应改为一次性跨域登录转移 token，而不是共享父域 Cookie。

### 2026-06-08 本轮追加：阿里 `_next/static` 自动同步脚本

- 新增 `scripts/sync-flashmuse-next-static.sh`。该脚本用于在马来服务器主动同步 `.next/static/` 到阿里 `/var/www/flashmuse-static/_next/static/`，默认参数为：`FLASHMUSE_APP_ROOT=/var/www/flashmuse`、`ALI_SYNC_HOST=101.37.129.164`、`ALI_SYNC_SSH_KEY=/root/.ssh/flashmuse_to_ali_ed25519`、`ALI_NEXT_STATIC_DEST=/var/www/flashmuse-static/_next/static/`。脚本支持 `--dry-run` 和 `--clear-cache`，并用 `/tmp/flashmuse-next-static-sync.lock` 防止并发同步。
- 新增 `scripts/deploy-flashmuse-production.sh`。该脚本是马来线上前端部署入口，流程为：`npm run build` -> `pm2 restart flashmuse --update-env` -> `pm2 save` -> `/usr/local/bin/sync-flashmuse-next-static.sh --clear-cache`。以后线上改前端优先跑这个脚本，避免忘记同步阿里 `/_next/static` 或忘记清阿里首页缓存。
- 两个脚本已上传到马来 `/usr/local/bin/` 并 `chmod +x`。已验证 `bash -n` 通过；已运行 `sync-flashmuse-next-static.sh --dry-run` 成功；已运行真实 `sync-flashmuse-next-static.sh --clear-cache` 成功，阿里 Nginx cache 已清并 reload。阿里本机验证 `https://ali.venusface.com/` 返回 200。

### 2026-06-08 本轮追加：正式域名 HTTPS、阿里 DNS-01 证书和自动续期提醒

- 本轮继续完成应用层正式域名切换。马来 `/var/www/flashmuse/.env.local` 已备份为 `.env.local.bak.20260608-domain-switch`，并将 `NEXT_PUBLIC_UPLOAD_BASE_URL` 改为 `https://api.venusface.com`，`NEXT_PUBLIC_STATIC_BASE_URL` 改为 `https://static.venusface.com`，新增/设置 `NEXT_PUBLIC_PRIMARY_BASE_URL=https://main.venusface.com`，`UPLOAD_CORS_ORIGINS=https://main.venusface.com,https://ali.venusface.com,https://static.venusface.com`，`FORCE_INSECURE_AUTH_COOKIE=false`。
- `src/components/chat-workbench.tsx` 已补正式域名逻辑：`main.venusface.com` 作为马来主站不应被阿里静态同步状态卡住，因此当前 host 等于 `NEXT_PUBLIC_PRIMARY_BASE_URL` 或 `NEXT_PUBLIC_UPLOAD_BASE_URL` 时，`/generated` 保持同源/马来源站；阿里入口才使用 `NEXT_PUBLIC_STATIC_BASE_URL=https://static.venusface.com`。同时 `toLocalGeneratedUrl()` 已把 `main/api/ali/static.venusface.com` 的 absolute generated URL 归一为相对路径。
- 已在马来重新 `npm run build`，通过，仅剩既有 Turbopack tracing warning；已 `pm2 restart flashmuse --update-env`、`pm2 save`；已同步马来 `.next/static/` 到阿里 `/var/www/flashmuse-static/_next/static/`；已清理阿里 `/var/cache/nginx/flashmuse_static/*` 并 reload Nginx，避免首页缓存旧构建。
- 验证通过：`https://main.venusface.com/` 返回 200，HTML 已使用 `https://static.venusface.com/home-assets/...`；`https://api.venusface.com/api/model-availability` 返回 200；`OPTIONS https://api.venusface.com/api/asset-upload-temp` 对 `Origin: https://main.venusface.com` 和 `Origin: https://ali.venusface.com` 均返回 204；阿里服务器本机 SNI 验证 `https://ali.venusface.com/` 返回新首页 200，`https://static.venusface.com/flashmuse-cache-health` 返回 200。
- 正式域名 DNS 已确认：`main.venusface.com -> 101.47.19.109`，`api.venusface.com -> 101.47.19.109`，`ali.venusface.com -> 101.37.129.164`，`static.venusface.com -> 101.37.129.164`。
- 马来服务器 `main.venusface.com`、`api.venusface.com` 已通过 certbot nginx 插件签发 Let's Encrypt 证书，证书路径 `/etc/letsencrypt/live/main.venusface.com/`，有效期至 `2026-09-06`。已验证 `https://main.venusface.com/` 返回 200，`https://api.venusface.com/api/model-availability` 返回 200，HTTP 会跳转 HTTPS。
- certbot 曾把马来 HTTP 配置改成域名跳 HTTPS、其它返回 404，导致 `101.47.19.109` IP 入口可能坏掉。已新增 `/etc/nginx/conf.d/flashmuse-ip.conf`，并让 FlashMuse IP 站点成为 80 默认站，恢复 `http://101.47.19.109/` 返回 FlashMuse 首页，保证阿里继续能用 IP 回源马来。
- 阿里 `ali.venusface.com`、`static.venusface.com` 起初 HTTP-01 验证失败，公网访问 HTTP 返回 `Server: Beaver` 403，Let’s Encrypt 无法访问 `.well-known/acme-challenge`。后改用 DNS-01 手动 TXT 验证，用户在 DNS 后台添加 `_acme-challenge.ali` 和 `_acme-challenge.static` 后成功签发证书。
- 阿里证书名为 `flashmuse-ali-static`，包含 `ali.venusface.com static.venusface.com`，证书路径 `/etc/letsencrypt/live/flashmuse-ali-static/`，有效期至 `2026-09-06`。阿里 Nginx `/etc/nginx/sites-available/flashmuse-static-ip` 已新增 443 server，保留本地静态镜像、`/generated` 本地优先和动态反代马来的原规则。服务器本机 SNI 验证 `https://ali.venusface.com/`、`https://static.venusface.com/flashmuse-cache-health`、`https://dvideo.venusface.com/` 均 200。
- 当前本机外网直连阿里 443 会 `Connection reset`，原 `dvideo.venusface.com` 也一样；服务器本机 HTTPS 路由正常。后续需要用用户浏览器或国内网络确认 `https://ali.venusface.com/` 和 `https://static.venusface.com/flashmuse-cache-health` 是否实际可打开。
- 重要后续提醒：`flashmuse-ali-static` 是手动 DNS-01 证书，certbot 提示不会自动续期。以后到期前需要手动再走 TXT，或接入 DNS API 自动续期。自动续期建议以后再做：创建阿里云 RAM 最小权限 AccessKey，仅允许管理 `venusface.com` DNS；安装兼容 certbot 的 Aliyun DNS 插件；凭据放 `/root/.secrets/certbot/aliyun.ini` 并 `chmod 600`；用 DNS 插件重签证书并执行 `certbot renew --dry-run`。不要使用全局管理员 AccessKey，不要把 Key 写入文档、聊天或 Git。

### 2026-06-08 本轮追加：马来主站优先、媒体处理完成后主动同步阿里

- 用户明确确认后续架构原则：马来是主站，阿里是副站/国内加速节点。以后所有媒体、上传、生成、保存流程都必须先保证马来正确和速度，再保证阿里的同步、速度和正确性。马来直连访问不能因为阿里未同步而卡住；阿里入口访问才使用阿里静态资源并等待阿里同步确认。
- 新增 `src/lib/ali-sync.ts`，让马来在媒体处理完成后主动 rsync 单组文件到阿里 `/var/www/flashmuse-static/generated`。马来服务器已生成专用 SSH key `/root/.ssh/flashmuse_to_ali_ed25519`，阿里已追加对应公钥到 `authorized_keys`。马来 `.env.local` 已新增 `ALI_SYNC_GENERATED_ENABLED=true`、`ALI_SYNC_HOST=101.37.129.164`、`ALI_SYNC_USER=root`、`ALI_SYNC_PORT=22`、`ALI_SYNC_SSH_KEY=/root/.ssh/flashmuse_to_ali_ed25519`、`ALI_SYNC_DEST_ROOT=/var/www/flashmuse-static/generated`。
- 图片远程 URL 保存流程已改完整：供应商临时 URL 先显示；马来后台下载；保存层统一 JPG；马来立刻生成 256px JPG 缩略图；马来主动同步原图和缩略图到阿里；`/api/media-save-status` 返回 `localUrl / thumbnailUrl / aliSynced / aliSyncedAt / aliSyncError`；前端在阿里入口等 `aliSynced === true` 且阿里静态资源预加载成功后替换。旧 saved job 没有 `thumbnailUrl` 时，状态查询会懒补生成并写回 job。
- GPT-5.4 Image 2、Gemini 等部分模型可能返回 `data/base64` 或 inline 图片，不走远程临时 URL 队列。此前 inline 图片保存为马来 JPG 后直接返回，没有生成缩略图，也没有主动同步阿里，导致阿里入口缩略图慢/裂图。本轮已补：inline 图片保存后会生成缩略图并主动同步阿里，然后再返回本地 URL。
- 视频远程 URL 保存流程已改完整：供应商临时视频先显示；马来后台下载视频；马来抽 640px 封面；马来生成封面 256px 缩略图；马来主动同步视频、封面、封面缩略图到阿里；`/api/media-save-status` 返回 `localUrl / posterUrl / posterThumbnailUrl / aliSynced`。旧 saved 视频如缺 `posterThumbnailUrl` 会在状态查询时懒补。
- 前端媒体显示逻辑已按“马来主站”调整。`getStaticMediaUrl()` 在当前浏览器访问马来 `101.47.19.109` 或当前 host 等于上传 API host 时，不再把 `/generated` 强制转成阿里静态地址，而是用马来本机 `/generated`。阿里入口或未来静态域名才走 `NEXT_PUBLIC_STATIC_BASE_URL`。`preloadSavedMediaBeforeReplace()` 也只在需要走阿里静态时等待 `aliSynced`。
- 阿里原有每分钟 `/generated` cron 保留，定位改为兜底修复；实时替换链路不再依赖 cron。若主动同步失败，`aliSyncError` 会写入 job，后续状态查询会继续尝试同步。
- 资产库上传卡 `6%` 已修。`6%` 是前端选择图片后写入槽位的初始进度，线上曾因为旧 JS 或上传启动依赖回调内临时数组导致真实 XHR 没启动。当前 `AssetUploadSlot` 带 `uploadFile`，有 effect 自动扫描 `uploading + uploadFile` 的槽位并启动临时上传。`uploadTemporaryAssetImage()` 会在拿 token 前显示 `8%`、拿到 token 后显示 `12%`、XHR 上传阶段最低 `15%`，并设置 token 请求 20 秒超时和 XHR 10 分钟超时。资产库和对话流上传链路现在同样走马来 `/api/asset-upload-temp`。
- 专业图片/视频模式的提示词参考图显示已按用户要求修正。若提示词文本中已有 `@文件名`，图片小缩略图与 `@文件名` 显示在原文位置，且同一图不再额外重复；若没有 `@`，参考图小缩略图显示在提示词最前面。小图和悬停预览改为直接用原图静态地址，避免因缩略图未生成导致 18px 小图裂开。
- 预览页下载按钮已修。此前马来入口打开预览页时下载按钮可能因为 `href` 被转成阿里静态跨域地址而被浏览器当作普通跳转。现在下载链接使用同源 `/generated/...`；`toLocalGeneratedUrl()` 已把 `http://101.47.19.109/generated/...` 和 `http://101.37.129.164/generated/...` 都归一为相对路径。
- 对话流图片卡缩略图缺失兜底已补：卡片先加载静态缩略图，如果缩略图 `onError`，自动回退加载原图静态地址，避免 Gemini/GPT 旧图因缩略图缺失一直“正在加载中”。主链路仍要求马来保存时生成缩略图并主动同步阿里。
- 域名结论：`.cn` 可以申请，不必须 `.com`。关键不是后缀，而是是否解析到中国大陆服务器；主站如果走阿里国内 IP，通常需要 ICP 备案。推荐正式结构为主域名或 `app.xxx.com` 指向阿里，`static.xxx.com` 指向阿里，`api.xxx.com` 指向马来。当前 `http://101.47.19.109/admin?tab=records` 是直连马来后台；阿里后台入口为 `http://101.37.129.164/admin`。
- 部署验证：本地 `npx tsc --noEmit` 通过；相关 ESLint 无错误，仅既有 `chat-workbench.tsx` warning；马来 `npm run build` 通过，PM2 已重启并保存；马来主动推送 `/_next/static` 到阿里并 reload Nginx；马来主动推送 `/generated/sync-test/final-active-sync-check.txt` 到阿里验证成功，输出 `active-sync-ok`。

### 2026-06-08 本轮追加：直传马来上传、临时文件确认提交、JPG 落盘和阿里静态缩略图

- 本轮先排查用户反馈“首页很快，但资产页/对话流 generated 媒体很慢”。确认阿里 `/generated` 原图和视频本地命中，响应头 `X-FlashMuse-Generated-Source: local`。阿里升配后下载已正常：943KB JPG 约 `0.10s`，7.9MB PNG 约 `2.24s`，13.6MB 视频约 `2.51s`。因此后续慢点不再是阿里下载带宽本身。
- 缩略图慢的根因是前端仍请求 `/api/media-thumbnail?url=...`，阿里该接口走反代缓存，首次 `MISS` 需要回源马来生成/读取，每张可达 `0.4s-2.7s`。已把 `getMediaThumbnailUrl()` 改为直接读静态缩略图：`/generated/.../image-thumbnails/...jpg`，由阿里本地 `/generated` 直接提供，避免换资产标签时大量 API 回源。
- 阿里新增脚本 `/usr/local/bin/generate-flashmuse-thumbnails.sh`，用 ffmpeg 为 `/var/www/flashmuse-static/generated` 下图片补 256px JPG 缩略图。本轮手动运行生成 57 个缺失缩略图。脚本已追加进 `/usr/local/bin/sync-flashmuse-generated.sh`，每分钟从马来 rsync 后会自动补缩略图，日志 `/var/log/flashmuse-generated-thumbnails.log`。注意 `/api/media-thumbnail` 仍保留作为兼容接口，但前台主要缩略图不再依赖它。
- 排查“不是之前已经改 JPG 了吗”：BytePlus Seedream 新图基本是 JPG；仍产生 PNG 的主要是 OpenRouter `openai/gpt-5.4-image-2`，少量 Gemini。通过工作区 JSON 统计，PNG 图片模型来源大致为 GPT-5.4 Image 2 23 张、Gemini 3.1 Flash 3 张、Gemini 3 Pro 1 张；文件系统还有约 50 个旧 PNG。`metadata.model` 很多旧流水为空，模型更多依赖 `message.generationMeta.model` 反查。
- `src/lib/local-assets.ts` 已改：所有生成图 `saveGeneratedAsset(source, "image")` 统一转成 JPG 再落盘。data URL、远程 URL、OpenRouter base64 PNG、Gemini PNG 等都会用 `ffmpeg-static` 转成 `.jpg`。上传图也已改为 JPG 逻辑，但旧 PNG 不批量转换。上传图透明区域会变白底。
- 对话流上传最初改成进输入框即上传后，发现卡在 95%。原因是旧上传路径 `/api/upload-image` 走阿里同源反代到马来，并且旧方案用 base64 JSON，浏览器上传完成后仍要等阿里把大请求体转发马来并等响应。实测旧链路：1MB `90.55s`、2MB `144.59s`、3MB `173.94s`、4MB `463.14s`、5MB 超过 `600s` 超时。
- 改成 `multipart/form-data` 二进制后继续测试，发现直传马来 1MB 约 `3.24s`，走阿里入口 1MB 仍约 `61.99s`，说明真正瓶颈是阿里反代上传到马来这一跳，不是马来保存，也不是二进制本身。因此采用临时“方案 B”：同源拿 token，浏览器直传马来。
- 新增 `src/lib/upload-token.ts`：使用 `AUTH_SECRET` HMAC 签发 5 分钟 token，payload 包含 `userId`、`purpose=upload-image`、`exp`。新增 `/api/upload-token`：前端在阿里同源下带正常 Cookie 请求该接口，拿到 token 后再直传马来。token 不建表，不依赖跨 IP Cookie。HTTP 阶段 token 明文传输，正式 HTTPS 后自然解决。
- `/api/upload-image` 已支持 `multipart/form-data`、Bearer 上传 token、CORS 和 OPTIONS，同时保留旧 base64 JSON 兼容。没有有效登录态且没有有效 token 会 401。CORS 当前允许 `http://101.37.129.164`、`http://101.47.19.109`，以及 `UPLOAD_CORS_ORIGINS` 中的额外来源。马来 `.env.local` 已新增/设置 `NEXT_PUBLIC_UPLOAD_BASE_URL=http://101.47.19.109`，前端构建后会直传马来。
- 新增 `/api/asset-upload-temp` 专门用于临时上传：`POST` 上传到马来 `.runtime/asset-upload-temp/users/{userId}/...jpg`，`PATCH` 将临时文件提交到正式 `/generated/users/{userId}/upload_image/*.jpg`，`DELETE` 删除临时文件，`OPTIONS` 支持 CORS 预检。相关本地资产函数：`saveTemporaryUploadedImageBuffer()`、`commitTemporaryUploadedImage()`、`deleteTemporaryUploadedImage()`。
- 对话流上传图片最终流程：用户选择/粘贴/拖拽图片后，前端先用 canvas 转 JPG，质量 `0.95`、不缩尺寸、透明背景铺白底；输入框立即显示本地 dataURL 预览和圆形百分比；图片直传马来临时区；用户移除图片或点“清空输入框”会 abort 正在上传的 XHR 并删除临时文件；用户点击发送时，前端先 `PATCH /api/asset-upload-temp` 提交临时文件到正式目录，再把正式 URL 写入用户消息和后续生成链路。发送前如有上传失败图片，会提示删除重传。
- 资产库上传图片最终流程：打开上传弹窗，选择图片后立即转 JPG 并直传马来临时区，卡片显示百分比遮罩；点取消或移除图片会删除临时文件；点“确定上传”才提交到正式 `upload_image` 目录并加入资产库。若有上传中或失败项，确定按钮禁用并提示。这样用户取消不会污染正式 `/generated`。
- 输入框缩略图裂图问题已修：上传完成后输入框仍使用本地 `previewUrl` dataURL 显示，不再立刻切到阿里静态缩略图；真正发送时才提交并使用正式 `/generated/...` URL。`previewUrl` 不会持久化到 workspace，`getPersistableSessions()` 仍会清空 `uploadedImages`。
- 关键改动文件：`src/components/chat-workbench.tsx`、`src/lib/local-assets.ts`、`src/lib/upload-token.ts`、`src/app/api/upload-token/route.ts`、`src/app/api/upload-image/route.ts`、`src/app/api/asset-upload-temp/route.ts`。阿里脚本：`/usr/local/bin/generate-flashmuse-thumbnails.sh`、`/usr/local/bin/sync-flashmuse-generated.sh`。
- 本轮验证与部署：本地 `npx eslint` 目标文件无错误，仅既有 warning；`npx tsc --noEmit` 通过；马来多次 `npm run build` 通过，仅既有 Turbopack tracing warning；PM2 多次重启并 `pm2 save`；阿里 `/_next/static` 每次构建后已手动 rsync。马来 `/api/asset-upload-temp` CORS 预检 204，未授权上传 401。直传马来 token 上传实测：1MB `1.79s`、2MB `5.60s`、3MB `5.21s`、4MB `3.70s`、5MB `5.34s`。
- 后续注意：当前“方案 B：阿里同源拿上传 token -> 浏览器直传马来 IP”只是 HTTP/IP 阶段临时方案。正式域名/HTTPS 后迁到“方案 D”建议为：`https://app.xxx.com` 指向阿里入口/应用，`https://api.xxx.com` 指向马来 API，`https://static.xxx.com` 指向阿里静态。届时将 `NEXT_PUBLIC_UPLOAD_BASE_URL` 改为 `https://api.xxx.com`，将 `NEXT_PUBLIC_STATIC_BASE_URL` 改为 `https://static.xxx.com` 或正式静态域名，把 CORS allowlist / `UPLOAD_CORS_ORIGINS` 收敛为 `https://app.xxx.com`，关闭 `FORCE_INSECURE_AUTH_COOKIE`。上传 token 机制建议继续保留，不必改成跨域 Cookie；HTTPS 后 token 不再明文传输，也方便未来接对象存储/CDN。
- 后续注意：建议后续加 cron 清理 `.runtime/asset-upload-temp` 中超过 1 小时的残留临时文件。旧 PNG -> JPG 迁移未做，若做必须同步更新 workspace、ledger 和阿里镜像。

### 2026-06-07 本轮追加：阿里本地静态镜像、/generated 增量同步、历史包瘦身和单会话懒加载

- 本轮用户说明当前架构约束：马来服务器必须保留，因为部分模型不支持国内访问，国内完全部署也可能有合规风险；马来服务器由 BytePlus 提供，调用马来/BytePlus 模型更快。当前暂不接正式 CDN，域名后面再申请，先用 IP。基于此，最终采用“马来继续做源站和模型调用，阿里做国内入口、本地静态镜像和同源动态反代”的临时最优方案。
- 本轮排查首页和工作台慢，确认首页慢的主因是阿里 `/_next/static` 曾经走反代缓存且受马来上游 `Cache-Control: no-store` 干扰；后来首页变快，但工作台仍慢，进一步确认动态历史加载和工作台 JS/CSS 首次回源仍是瓶颈。最终不再继续把阿里当“全站反代 CDN”，而改成阿里本地直接读取前端静态文件。
- 阿里 Nginx 已改成本地静态镜像：`/_next/static/` 通过 `alias /var/www/flashmuse-static/_next/static/` 读取，`/home-assets/` 通过 `alias /var/www/flashmuse-static/home-assets/` 读取，均返回 `Cache-Control: public, max-age=2592000, immutable` 和 `Access-Control-Allow-Origin: *`。响应头可看到 `X-FlashMuse-Local-Static: next-static` 或 `home-assets`。
- 阿里 `/generated/` 已改成本地优先、马来兜底。Nginx 使用 `root /var/www/flashmuse-static; try_files $uri @generated_proxy;`。本地命中响应头为 `X-FlashMuse-Generated-Source: local`；缺失回源马来时为 `X-FlashMuse-Generated-Source: malaysia-proxy`，并使用 `flashmuse_static` 缓存。已验证 `video_2_d7` 对应 `/generated/users/ID_636611/videos/1780780189077-2ac3cc31-a379-4a56-9448-84ba91cb88d3.mp4` 和封面都从阿里本地读取。
- 阿里 `/generated` 已首次同步约 `511MB`。新增脚本 `/usr/local/bin/sync-flashmuse-generated.sh`，内容为 rsync 马来 `/var/www/flashmuse/public/generated/` 到阿里 `/var/www/flashmuse-static/generated/`。root crontab 每分钟执行一次，并用 `flock -n /tmp/flashmuse-generated-sync.lock` 防重入，日志写 `/var/log/flashmuse-generated-sync.log`。阿里生成了专用 key `/root/.ssh/flashmuse_malaysia_sync_ed25519`，公钥已加入马来 root `authorized_keys`。
- 阿里 Nginx 已新增慢请求日志格式 `flashmuse_timing`，配置在 `/etc/nginx/conf.d/flashmuse-timing-log.conf`。`/var/log/nginx/flashmuse-static-access.log` 现在包含 `rt / urt / uct / uht / cache / gzip` 字段。后续如果用户反馈慢，优先看阿里 access log 中该请求的 `rt` 和 `urt`，判断是浏览器到阿里慢、阿里本地发送慢，还是阿里回源马来慢。
- 阿里 Nginx 相关备份：`/etc/nginx/sites-available/flashmuse-static-ip.bak.20260607184458`、`/etc/nginx/sites-available/flashmuse-static-ip.gzip.bak.20260607191419`、`/etc/nginx/sites-available/flashmuse-static-ip.local-static.bak.20260607201518`。阿里旧项目 `dvideo.venusface.com` 未删除未改坏，仍按 Host 路由到 `127.0.0.1:3001`。
- 本轮曾尝试开启阿里 gzip 动态压缩，确认 `/api/workspace-state` 从 489KB 压到约 37KB，但用户实际仍觉得慢。随后进一步排查发现慢点不只是传输，而是工作台首次拿完整历史和前端处理历史，因而继续做历史包瘦身和接口拆分。
- 新增 `src/lib/workspace-state-cleanup.ts`，抽出工作区清理逻辑：`replaceLegacyMediaUrls()`、`compactWorkspaceState()`、`summarizeWorkspaceState()`、`mergeUnloadedSessions()`。它统一处理旧媒体 URL 替换、消息内重复媒体映射瘦身、summary 模式生成，以及未加载会话保存时与数据库原始完整会话合并。
- `/api/workspace-state` 已支持 `?summary=1`。summary 模式只返回会话列表和当前 active 会话的完整消息，其它会话返回 `messages: []` 和 `messagesLoaded: false`。GET 会自动 compact workspace；PUT 会先 `mergeUnloadedSessions()`，确保未加载会话不会被前端空 messages 覆盖。
- 新增 `/api/workspace-session?id=xxx`，用户点击某条历史对话时才返回该会话完整内容，并标记 `messagesLoaded: true`。该接口也会复用 compact 逻辑，如果发现数据库仍有未瘦身状态，会先写回瘦身后的 workspace。
- 前端 `src/components/chat-workbench.tsx` 已改为初始并行请求 `/api/auth/me` 和 `/api/workspace-state?summary=1`。账号信息返回后先显示；当前会话和历史列表来自 summary；点击 `messagesLoaded:false` 的历史项时，调用 `/api/workspace-session?id=...` 补拉详情。
- 历史未加载时的右侧 UI 已按用户要求改为白底加载态：不再显示“hi~把你的闪念跟我聊一聊！”新对话首页，而是显示 `加载中...0%` 起步，下面是约 `100px` 宽、`4px` 高、直角细蓝色进度条；进度随时间增长，最高到 `96%`，加载完成后替换为该会话内容。用户最初举例 `18%`，后明确要求能正确就从 `0%` 开始，已按 `0%` 起步实现。
- 已对线上 `12424740@qq.com` 的 workspace 做一次手动瘦身。清理前数据库 `UserWorkspaceState.state` 为约 `503KB / 515413 bytes`；清理后约 `151KB / 154571 bytes`。主要移除很多消息里重复携带的 `videoPosters / imageDimensions / mediaSystemNames / imagePrompts / videoPrompts / videoDimensionsMap`，只保留当前消息实际媒体 URL 相关映射。后续保存和读取都会自动继续 compact。
- 媒体预加载逻辑已优化。此前 `preloadSavedMediaBeforeReplace()` 对视频会 `fetch()` 完整 mp4 并 `arrayBuffer()`，例如 8MB 视频会占用几十秒传输，容易拖慢工作台。现在视频只用 `Range: bytes=0-0` 做可读性检查，浏览器日志为 `[media-preload] video-range`。图片仍预加载原图和缩略图。
- 阿里本地静态同步注意事项：`/generated` 已有每分钟 cron 自动同步；但 `/_next/static` 目前不是自动的。每次马来执行 `npm run build` 后，都必须从马来 `/var/www/flashmuse/.next/static/` rsync 到阿里 `/var/www/flashmuse-static/_next/static/`，否则阿里会继续服务旧前端 JS。当前本轮每次构建后都已手动同步过最新静态 chunk。
- 本轮部署和验证：多次本地 `npm run build` 通过；多次马来线上 `npm run build` 通过；PM2 多次重启并 `pm2 save`；阿里 Nginx 多次 `nginx -t` 通过并 reload。当前仍只有既有 Turbopack warning：`local-assets.ts` 动态 generated 路径、`ffmpeg-static` tracing / `next.config.ts` unexpected file in NFT list，均非阻断。
- 本轮临时工具：为操作阿里密码 SSH，下载了 PuTTY `plink.exe` 和 `pscp.exe` 到 `C:\Users\ASUS\AppData\Local\Temp\opencode`。没有放进项目。阿里 SSH 指纹为 `SHA256:swmcHkH3QmccAOKZFuU7kLJ6RWCQmCbAAtfug4O8apA`。
- 后续建议：如果历史和资产继续增大，下一步把资产库也拆成 `/api/workspace-assets`，初始 summary 只带资产数量和当前会话必要资产，点资产库时再加载完整 assets。另建议给阿里加 `sync-flashmuse-next-static.sh`，避免每次马来 build 后忘记同步 `/_next/static`。

### 2026-06-07 本轮追加：阿里单节点缓存、媒体用户目录隔离、旧数据迁移、预加载策略和单会话登录

- 本轮用户继续要求后续回答简单直接，并要求把当前对话框内所有重要改动写入交接文档和更新日志，方便下一个 AI 继续接手。当前本地代码与马来线上关键运行代码已多次通过 SHA256/构建确认同步，但这些改动尚未提交 GitHub。
- 新增阿里服务器作为国内快速入口和单节点静态缓存。阿里服务器资料在 `E:\project\【2】server\阿里服务器`，IP 为 `101.37.129.164`，系统 Ubuntu 22.04，已有旧项目 `dvideo.venusface.com` 运行在 `127.0.0.1:3001`。本轮没有删除或改坏旧项目：本机 Nginx Host 路由验证 `Host: dvideo.venusface.com` 仍 301 到 HTTPS。阿里 IP 当前可作为 FlashMuse 国内入口访问：`http://101.37.129.164`。
- 阿里 Nginx 新增 `flashmuse-static-ip` 默认站点：`/` 反代马来首页并缓存 30 分钟；`/home-assets/`、`/generated/`、`/_next/static/`、`/api/media-thumbnail` 走 `proxy_cache flashmuse_static`；`/api/*`、`/workspace`、`/admin` 等动态路径不缓存，实时反代马来，避免登录和生成接口缓存污染。阿里缓存目录为 `/var/cache/nginx/flashmuse_static`。
- 阿里代理曾因 `proxy_hide_header Set-Cookie` 放在 server 级别导致登录成功后 Cookie 被吃掉、读账号信息又回到未登录；已修复为只在缓存首页 `/` 时隐藏 Cookie，动态接口放行 `Set-Cookie`。已用 `POST /api/auth/logout` 验证 `Set-Cookie: flashmuse-session=...` 能穿过阿里代理。
- 马来服务器 `.env.local` 已配置 `NEXT_PUBLIC_STATIC_BASE_URL=http://101.37.129.164`，首页图片/视频/Logo 和工作台显示层里的 `/generated/...` 媒体会优先转成阿里地址显示。注意当前仍是 HTTP；后续有域名和 HTTPS 后，把该变量替换为 `https://static.xxx.com` 或正式静态域名即可。
- 首页完整素材已上传到马来和阿里缓存链路，随后因原视频/图片太大已压缩为 `*-lite` 资源。首页 5 个轻量视频总量约 `5.8MB`，首屏图片约 `120KB-243KB/张`。首页逻辑为先显示图片轮播，后台原生 video preload；第一个视频可播放后立即切视频并写 `flashmuse-home-videos-ready-home-lite-carousel-20260605` 标记。若本地或浏览器旧缓存导致视频不切，需强刷或清对应 localStorage key。
- 首页最初国内访问白屏约 11 秒，根因是首页 HTML 首包仍从马来跨境加载。现在阿里 IP 也代理并短缓存首页 HTML，因此国内入口应使用 `http://101.37.129.164`，马来入口 `http://101.47.19.109` 仍保留但国内首屏较慢。首页 `<main>` 也加了内联黑底，避免 CSS 未加载时白屏。
- 图片缩略图规则已从最长边 `512px` 改为 `256px`，仍不裁切、不拉伸，输出 jpg，接口 `/api/media-thumbnail`。视频封面抽第一帧后最长边限制为 `640px`，质量参数 `q=3`。已清马来旧 `image-thumbnails` 和 `video-posters` 并重建线上视频封面；阿里缓存也清过一次。前端缩略图版本为 `thumb256-20260606`，视频封面版本为 `poster640-20260606`，避免浏览器继续用旧缓存。
- 前端显示媒体 URL 已统一：旧 `http://101.47.19.109/generated/...` 会显示时归一为 `/generated/...`，再转为 `NEXT_PUBLIC_STATIC_BASE_URL + /generated/...`。预览页左侧主图/主视频、下载链接、悬停原图、对话流/资产库卡片、预览右侧缩略图、视频封面等都已优先走阿里静态地址。旧数据中的马来绝对地址不会再直接绕过阿里显示。
- 媒体远程 URL 替换策略已改。生成成功后先显示供应商远程 URL；马来后台异步下载落盘；前端轮询 `/api/media-save-status` 发现保存成功后，不再立即替换为 `/generated/...`。现在必须先预加载阿里资源成功：图片需要阿里原图 + 256 缩略图；视频需要阿里原视频完整 `fetch` + 640 封面 + 封面 256 缩略图。全部成功后才替换 URL。若超时/失败，不替换，下一轮 12 秒轮询继续尝试，供应商临时 URL 继续显示。
- 媒体预加载已加浏览器控制台日志，前缀 `[media-preload]`。会记录单个 image/fetch 的 `loaded/error/timeout`、耗时 `ms`、字节数、URL 尾部，以及整组媒体 `ready` 和 `results`。以后测试生成图/视频时打开浏览器控制台搜 `media-preload`，可据此调整图片 60 秒、视频原文件 180 秒、封面 60 秒的等待时间。
- 用户媒体目录隔离已完成第一阶段并已迁移旧文件。新结构为 `/generated/users/{userId}/images/`、`videos/`、`upload_image/`、`files/`、`video-posters/`、`image-thumbnails/`。`local-assets.ts`、`media-save-queue.ts`、`video-poster.ts`、`media-thumbnail`、上传/生图/生视频 API、前端上传图识别、后台视频封面兜底都已兼容新旧路径。新上传文件也新增 `/api/upload-file`，会保存到 `/generated/users/{userId}/files/`，同时前端仍读取文本供 Agent 使用。
- 旧媒体迁移脚本为 `scripts/migrate-generated-media-to-user-dirs.mjs`，默认 dry-run，`--apply` 执行。迁移策略是复制旧文件到用户目录，不删除旧文件；同步更新 `UserWorkspaceState.state` 和 `CreditLedger.metadata` 中的媒体 URL；旧路径仍保留兜底。脚本会备份到 `.runtime/migration-backups/`。本地迁移结果：`users=102`、`usersWithMappings=2`、`mappings=516`、`copiedFiles=516`、`missingFiles=0`、`updatedWorkspaces=2`、`updatedLedgers=286`。线上迁移结果：`users=3`、`usersWithMappings=3`、`mappings=79`、`copiedFiles=79`、`missingFiles=0`、`updatedWorkspaces=3`、`updatedLedgers=86`。
- 已验证线上用户 `12424740@qq.com` 对应 `userId=ID_636611`。其新上传图、生图、视频、视频封面、缩略图都进入 `/generated/users/ID_636611/...`。示例：`/generated/users/ID_636611/upload_image/52ad11c22480ea20398e2103.png`、`/generated/users/ID_636611/videos/1780768012580-e5597961-4c92-4a54-9d13-0983f94235b1.mp4`。阿里访问这些新用户目录资源均返回 200 且带 `Cache-Control: public, max-age=2592000, immutable`。
- Agent 自动生成模型策略已按用户要求重写。普通 Agent 生图优先 `Seedream 4.5`（BytePlus 开着优先 BytePlus，OpenRouter 开着用 OpenRouter）；高级 Agent 生图优先 `GPT-5.4 Image 2`；普通 Agent 生视频优先 `Seedance 2.0 Fast`；高级 Agent 生视频优先 `Seedance 2.0`。只要首选模型在后台开启且可连，就必须使用；首选不可用才用后台打开的备选模型。移除了“用户说高质量/多次不满意/4K 就自动切贵模型”的旧逻辑。
- 后台 `系统设置 -> Agent 自动生成策略` 已重排：顶部为 `普通图片 / 高级图片 / 普通视频 / 高级视频`；下面为 `备选图片 / 备选视频`。左侧 OpenRouter 的其它图片/视频模型都显示为备选并有开关。服务端 `isAgentImageModelEnabled` / `isAgentVideoModelEnabled` 和 `/api/model-availability` 已按新 badge 兼容。
- Agent 视频卡布局修复：用户最终要求 Agent 自动视频无论几个都固定一行两个，每个半宽；单视频也只占半行，但外层必须有 `w-full max-w-[1006px]`，避免之前被父级压到“半宽还更窄”。Agent 媒体提示词面板保持整行宽度。预览页主视频初始变小问题已修：主视频 `preload="metadata"` 且 `h-full w-full object-contain`，避免点播放后才知道尺寸、突然变大。
- 登录策略已改为同账号单会话。`createUserSession()` 现在在事务里先 `deleteMany({ userId })` 删除旧 session，再创建新 session。后登录会踢掉前登录；旧电脑工作台已有每 5 秒 `/api/auth/me` 检查和 focus 检查，检测到失效会 `window.location.replace('/')` 回首页非登录状态。
- 本地曾出现登录接口 404、前端显示“请求失败”，根因是本地 3000 的 Next dev 进程状态坏了，不是代码逻辑。已杀掉占用 3000 的旧进程并重启 `npm run dev` 后恢复。若本地再出现 `/api/auth/check-email` 404，优先重启本地 dev server。
- 本轮多次本地 `npm run build` 和马来线上 `npm run build` 通过，仅剩既有 Turbopack tracing warning（`local-assets.ts` 动态 generated 路径、`ffmpeg-static`）。马来 PM2 多次重启并在线。注意本轮改动很多，本地 Git 工作区仍是 dirty，尚未提交/推送。

### 2026-06-05 本轮追加：马来西亚服务器部署、HTTP 登录修复、工作台兼容和前台细节

- 用户要求先阅读交接文档和更新日志，并要求后续回答简单直接。本轮随后开始做公网部署。服务器资料目录为 `E:\project\【2】server\马来西亚服务器`，IP 为 `101.47.19.109`，SSH 私钥 `ByteplusVPS.pem`。最初本机私钥权限过宽，SSH 拒绝使用，已用 `icacls` 收紧权限后成功以 `root` 登录。
- 服务器为 `CentOS Stream 8`。初始缺 Node/npm/Git/Nginx/PM2。已安装 Node.js `22.22.3`、Git、Nginx、PostgreSQL、PM2；初始化 PostgreSQL；创建 `flashmuse` 数据库；部署目录 `/var/www/flashmuse`；PM2 进程名 `flashmuse` 并已开机自启；Nginx 反代 `127.0.0.1:3000`。
- 因本地 `public/generated` 约 `1.7GB`、首页视频约 `123MB`，正式部署包排除了这些大文件。线上只上传代码、Logo 和必要 manifest；首页 5 个视频路径用服务器 `ffmpeg-static` 生成极小黑色视频占位，避免资源 404。后续如要完整首页视觉，需要补传 `public/home-assets` 完整视频或改用 CDN。
- Nginx 已直接映射 `/generated/` 到 `/var/www/flashmuse/public/generated/`，并验证 `http://101.47.19.109/generated/deploy-check.txt` 可公网访问。`/home-assets/` 也由 Nginx 直接映射。当前仍是 HTTP，不能作为 BytePlus 素材审核最终 URL。
- 线上 SMTP 最初没生效，验证码只打印到 PM2 日志。根因是部署时只上传了 `.env.local`，而 SMTP/管理员白名单在本地 `.env`。已把 `.env` 中 OpenRouter/BytePlus/SMTP/Admin 配置合并到线上 `.env.local`，并覆盖线上 PostgreSQL `DATABASE_URL`。前台和后台验证码发送已恢复。
- 线上前台验证码登录后进不了工作台，先误判为 Cookie/RSC/缓存问题，后通过临时 `/api/client-error` 捕获真实浏览器错误：`crypto.randomUUID is not a function`。原因是当前访问 `http://IP`，不是安全上下文。已新增 `createClientId()` fallback，并替换 `chat-workbench.tsx` 所有前端 `crypto.randomUUID()` 调用。
- 前台和后台登录 Cookie 默认生产环境 `secure: true`，HTTP 下浏览器不会保存。已新增/使用 `FORCE_INSECURE_AUTH_COOKIE=true` 测试开关，`src/lib/auth.ts` 和 `src/lib/admin-auth.ts` 在该开关开启时不写 `Secure`。后续绑定域名并配好 HTTPS 后必须关闭该开关。
- 为降低 Next 客户端软跳转/RSC 状态问题，首页进入工作台、前台密码登录和验证码登录成功后都改为 `window.location.assign('/workspace?fresh=...')`。Nginx 临时让 `/_next/static/` 返回 `Cache-Control: no-store`，方便 HTTP/IP 测试期不吃旧 chunk。
- 后台账号机制确认：后台没有独立账号表，由 `.env.local` 的 `ADMIN_EMAILS` 控制。当前管理员为 `lookxun@163.com`。线上用户表已有 `lookxun@163.com` 和 `12424740@qq.com`。
- `B_8` 生图失败已排查：请求模型是 `google/gemini-3-pro-image-preview`，OpenRouter 返回的是一大段中文场景描述文本，没有返回图片 URL/base64，因此 `/api/image` 报 `图片平台没有返回图片`。这不是部署或保存问题；同类错误有 `B_5/B_6/B_7`。建议临时使用 BytePlus `Seedream 4.5 / Seedream 5.0 Lite`，或后台关闭不稳定 Gemini 图片模型。
- Agent 引导按钮不消失问题已修。旧逻辑找最后一条 assistant 消息，用户点击引导发送后旧 assistant 仍被命中。现在只有最后一条消息本身是 assistant 才显示引导，且发送任意消息时会清掉旧消息 `suggestions`。
- 视频时长弹窗分列规则已修。只有 BytePlus `Seedance 2.0 Fast / Seedance 2.0` 因 `4-15秒` 选项多保持两列；其它视频模型恢复一列。
- 资产库空状态文案已按分类修正：`上传图片` 显示 `在对话流上传的图片会出现在这里。`，`生成图片` 显示 `对话流生成的图片会出现在这里。`，`生成视频` 显示 `对话流生成的视频会出现在这里。`，`回收站` 显示 `删除的资产会出现在这里。`。
- 本轮验证：多次本地 `npm run build` 通过，多次服务器 `npm run build` 通过；仅剩既有 `local-assets.ts` 动态 generated 路径和 `ffmpeg-static` Turbopack tracing warning。PM2 已重启并保存。
- 后续第一优先级：绑定域名到 `101.47.19.109` 并配置 HTTPS；HTTPS 完成后关闭 `FORCE_INSECURE_AUTH_COOKIE`；然后把 `/generated/...` 的最终公网地址作为 HTTPS URL，继续接 BytePlus 第一方 `素材&虚拟人像库 / CreateAsset` 审核流程。

### 2026-06-05 本轮追加：前后台 UI 修正、模型开关链路修复和部署交接

- 本轮用户继续要求后续回答简单直接，并在本轮结束时要求把当前对话框内所有重要内容写入交接文档和更新日志，尤其提醒下一个 AI 开始做公网部署。
- 下一个 AI 首要任务：开始做公网部署。部署目的包括让服务器上的 `/generated/...`、用户上传图、资产图、生成图都能通过公网 HTTPS URL 访问。BytePlus 第一方素材审核接口需要可下载的 `originalUrl`，本地 `localhost` 或本地路径不能用。
- 公网部署完成后继续接 BytePlus 第一方 `素材&虚拟人像库 / CreateAsset` 审核机制。正式流程：图片保存到公网 HTTPS URL -> 调 BytePlus 第一方素材创建/审核接口 -> 轮询状态 -> 保存 `assetId/materialId` -> Seedance 2.0 视频生成时传 `asset://assetId` 作为参考图。该流程用于处理写实真人/数字人角色图直接传普通 URL/base64 时触发 `InputImageSensitiveContentDetected.PrivacyInformation` 的问题。
- 用户明确不接第三方 SeeDance 素材接口。第三方文档只证明 BytePlus 底层存在类似 `CreateAsset` 能力。下一个 AI 需要从 BytePlus 控制台、客服或销售拿第一方 `CreateAsset / 查询素材状态` 文档、开通方式、素材&虚拟人像库权限和 IP 白名单要求。
- 前台资产库调整：`对话流资产` 下新增 `上传图片` 分类，只展示 `/generated/upload_image/...`；`生成图片` 只展示对话流生成图片；`生成视频` 展示对话流视频。`上传图片` 图标使用用户提供的本地 SVG，不能直接导入 `RiImageUploadLine`，因为当前 `react-icons/ri` 没有该导出，曾导致页面打不开。
- `@引用资产` 弹窗调整：去掉旧 `对话流图片` 分类，新增 `上传图片` 分类且只展示上传图；角色图片、场景图片、分镜图片保留。
- 资产库右侧体验修复：切左侧分类时强制回到顶部，不再恢复每个分类历史滚动位置；标题区固定高度，避免不同分类标题/说明导致内容上下跳动。右侧主内容保持居中。生成视频保持大屏一行 4 个，网格总宽与其它分类一致。
- 后台历史对话弹窗排序修复：不再使用会被 workspace 保存污染的 `session.updatedAt`，改为按该对话内最后一条消息 `createdAt` 排序和显示时间；无消息时才回退 `session.createdAt / session.updatedAt`。
- 后台媒体弹窗修复：`对话流图片 / 对话流视频 / 资产库图片` 左侧主图不再用缩略图，改用原图；右侧列表继续用缩略图；文件名不再叠在主图左上角，改为显示在参数行最前面。文件名为黑色，和后面灰色参数同一行但不用竖线分隔；参数之间继续用竖线。资产库图片参数最后追加风格。
- 后台入口文案按用户最终要求保留为 `对话流图片 / 对话流视频 / 资产库图片`，不再单独增加 `对话流上传图片` 入口；上传图仍包含在 `对话流图片` 内。
- 后台模型开关链路全面修复：`/api/model-availability` 现在返回 `imageModels / assetImageModels / videoModels / agentImageModels / agentVideoModels` 五组列表。前端分别用于图片生成模式、资产库生成、视频生成模式、Agent 自动生图、Agent 自动生视频。
- 服务端最终校验同步拆分：`/api/image` 按 `metadata.creditSource` 区分 `agent_image_generation`、资产库生成和普通对话流图片；`/api/video` 按 `agent_video_generation` 区分 Agent 自动视频和普通对话流视频。BytePlus provider key 也分为 `agent-image.* / agent-video.* / conversation-image.* / asset-image.* / video.*`。
- 修复普通 Agent 自动生图提示 `连接不到模型，请联系管理员！` 的根因：以前普通 Agent 固定拿 OpenRouter `DEFAULT_IMAGE_MODEL`，后台切到 BytePlus 后会被服务端互斥拦截。现在 Agent 自动生图/生视频会按后台 Agent 自动生成策略可用列表选择和兜底。
- 首页 UI 调整：简化输入框保持原尺寸，当前为深色玻璃平底，无上下渐变、无边框渐变；首页发送按钮常态/hover 与右上角 `进入工作台 / 登录` 一致，`进入工作台 / 登录` 去掉描边。
- 本轮验证：多次 `npm run lint` 通过，仅剩 `src/components/chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过，仅剩既有 `local-assets.ts` 动态路径和 `ffmpeg-static` Turbopack tracing warning。一次 build 因 Google Fonts 网络请求失败，重跑通过，非代码错误。

### 2026-06-04 本轮追加：BytePlus 图片误判修复、视频错误编号、素材&虚拟人像库和公网部署后续

- 本轮用户继续要求回答简单直接，并要求把当前对话框内所有重要改动写入交接文档和更新日志，方便下一个 AI 继续接手。
- BytePlus 图片模型直连测试结果：`Seedream 4.5` 和 `Seedream 5.0 Lite` API 本身都能通，均能返回图片。直连最小请求 `seedream-4-5-251128 / 2048x2048` 成功约 `6.6s`，`seedream-5-0-260128 / output_format=jpeg / 2048x2048` 成功约 `12.8s`。因此“连不上”不是 Key、网络或 BytePlus API 不可用。
- BytePlus 图片前台失败根因已修：BytePlus 返回的是远程临时 URL，项目先展示远程 URL、后台异步落盘；刚返回时 `imageDimensions` 可能为空。`/api/image` 之前按目标尺寸精确过滤，尺寸为空时把成功返回的远程图过滤成 `0` 张，触发 `image-generation empty delivery`。现在 `pickRequestedImages()` 如果没有尺寸匹配但 `images.length > 0`，会回退交付原始返回图片，不再把 BytePlus 成功图误判失败。
- 本轮说明 OpenRouter 与 BytePlus 图片返回链路差异：OpenRouter 聚合层可能返回 `choices.message.images[].image_url.url`、根级 `images[].url`、`data[].url` 或 `b64_json`，项目都兼容；base64/data URL 会同步保存并读尺寸。BytePlus `Seedream 4.5 / 5.0 Lite` 当前基本返回 `data[].url` 远程 URL，所以更依赖异步落盘链路，不能因为临时无尺寸判失败。
- 视频红字编号丢失已修两处。第一处：`/api/video` 创建任务失败已有 `B_数字`，但轮询任务后平台返回失败时直接透传 `error.message`，没有走 `createCodedApiError()`；现在轮询失败分支也会生成编号。第二处：`toUserErrorMessage()` 对 `sensitive / privacy / real person / 隐私 / 敏感` 会重新映射中文固定文案，曾把已有 `(B_数字)` 丢掉；现在所有固定映射都会保留已有编号。
- 用户这次视频失败红字为 `参考图可能包含真人或隐私敏感信息，平台拒绝生成`，对应 BytePlus/火山错误码 `InputImageSensitiveContentDetected.PrivacyInformation`。官方 API 参考写明：`seedance 2.0` 系列不支持直接上传含有真人人脸的参考图/视频；视频生成 `content.image_url.url` 支持普通 URL、base64 和素材 ID，素材 ID 格式为 `asset://<ASSET_ID>`，用于预置素材及虚拟人像，可从 `素材&虚拟人像库` 获取。
- 本轮查官网和第三方资料后确认：BytePlus 第一方确实存在 `素材&虚拟人像库`/素材审核入库机制。第三方文档 `E:\project\【1】Api key\三方提供：seedance 2.0\SeeDance接入说明\AI聚合三方素材接口接入文档.pdf` 里 `/openApi/material/create` 会提交 `originalUrl`、`type=1`、`fileType=1`、`thirdChannel=1`，返回 `materialId: asset-xxxx` 和 `status=1`；`/openApi/material/pageList` 查询 `status=1 处理中 / 2 已完成 / 3 处理失败`。更关键的是第三方错误响应暴露官方底层 `Action=CreateAsset`、`Service=ark`、`Region=cn-beijing`，说明 BytePlus 底层有 `CreateAsset` 能力。
- 用户明确：不要接第三方，只接 BytePlus 第一方。第三方文档仅用于证明流程。下一个 AI 应从 BytePlus 控制台或客服/销售获取第一方 `CreateAsset / 查询素材状态` 文档、开通方式、IP 白名单要求和 `素材&虚拟人像库` 使用权限；不要把第三方 AK/SK 接入正式项目。
- 重要后续顺序已定：下一步先做公网部署。原因是 BytePlus 素材创建/审核接口要求 `originalUrl` 是可访问图片资源地址；本地 `localhost` 或本地 `/generated/...` 不能被 BytePlus 访问。项目部署到公网服务器后，必须让用户上传图、资产图、生成图能通过公网 HTTPS URL 访问；若 BytePlus 素材接口需要白名单，提交服务器公网出口 IP。
- 部署后继续做 BytePlus 素材审核机制：图片保存到服务器公开 URL -> 调 BytePlus 第一方素材创建接口 -> 保存 `assetId/materialId` 和状态 -> 轮询状态到完成 -> 在资产库中标记 BytePlus 审核通过 -> 视频生成时对这类审核通过的角色图传 `asset://asset-xxxx`，而不是普通 URL/base64。这样可用于 AI 生成的写实真人/数字人角色图，减少直接上传参考图触发隐私/真人拦截。
- 当前不应尝试用提示词绕过 `PrivacyInformation` 拦截，也不应把 Content Pre-filter 当作可关闭解决方案。官方规则即使关闭内容预过滤仍有基础安全策略；合规做法是走素材/虚拟人像库审核后使用 `asset://...`。
- 关键文件：`src/app/api/image/route.ts`、`src/app/api/video/route.ts`、`src/lib/error-message.ts`、`src/lib/openrouter-video.ts`、`src/lib/upload-rules.ts`、`src/lib/media-save-queue.ts`、`handover/04-keys-and-integrations.md`。
- 本轮验证：`npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning。

### 2026-06-04 本轮追加：对话流/资产库缩略图稳定、资产命名、资产库刷新位置和使用量统计

- 本轮用户继续要求回答简单直接，并要求把当前对话框内所有重要改动写入交接文档和更新日志，方便下一个 AI 继续接手。
- 后台生成记录里最新视频显示 `0（扣分异常）` 的根因已查明并修复：视频扣费流水写的是远程签名 URL，工作区后来异步落盘替换成本地 `/generated/videos/...mp4`，后台原先只按 URL 回填扣费导致匹配失败。现在后台媒体项带 `requestId`，生成列表扣费回填优先按 `requestId` 匹配；后台从流水构造明细时也优先用同 `requestId` 的本地 workspace URL，避免同一视频出现“远程扣费项 + 本地 0 分占位项”。
- 后台媒体名称显示规则重新统一。前端用户改名后只显示用户改的名；后台显示 `系统名 / 用户改名`，没改名时只显示系统名。对话流生成媒体读 `message.mediaSystemNames`，资产库媒体读资产 `systemName + userName/name`，删除对话恢复出的媒体也带原名称。
- 资产命名已改成更稳定的双字段规则：`systemName` 是系统名，生成/上传/入库后不可被用户改名覆盖；`userName` 是用户改名，默认空；`name` 作为兼容显示字段，始终等于 `userName || systemName`。用户改名只写 `userName`，系统同步逻辑只更新 `systemName`。旧数据如果已有 `systemName` 且 `name !== systemName`，会自动把旧 `name` 识别为 `userName`，避免过段时间又变回系统名。
- 对话流图片卡、预览页右侧图片缩略图、视频封面缩略图、输入框上方参考图、用户消息参考图、`@资产` 菜单小图、文本内联 `@资产` 小图、资产生成页右侧引用图、后台列表/明细缩略图都改为走 `/api/media-thumbnail` 的 512px 等比缩略图。主预览图、资产生成页左侧主图、后台悬停大图仍用原图。
- `/api/media-thumbnail` 缩略图规则保持：最长边不超过 512px，`scale=512:512:force_original_aspect_ratio=decrease`，不裁切、不拉伸，输出 jpg 缓存到 `public/generated/image-thumbnails/...`。卡片上如果用 `object-cover`，视觉可能裁切，但缩略图文件本身比例不变。
- 对话流图片改缩略图后曾出现成功图显示失败卡。根因是缩略图 `512x288/512x283` 被 `onLoad` 写回 `imageDimensions`，前端尺寸过滤把成功图误判为不匹配并补失败卡。已修：缩略图加载不再写回原图尺寸；`512` 缩略图尺寸不算可信真实尺寸；前端不再因为尺寸过滤把成功图合成失败卡，固定槽位只尊重真实 `image/pending/failed` 状态。
- 图片生成固定槽位规则继续收紧。生成几张就固定几个槽位，槽位永远显示 `image / pending / failed` 之一，不能空白。此前一张完成后其它 pending 槽位会暂时消失，原因是尺寸分页逻辑只拿成功图的 `slotIndexes`，漏掉 pending 槽位；现在固定槽位直接按原数组渲染，不再被尺寸分页截掉。等待卡百分比也按槽位编号加稳定小偏移，同批 1/2/3/4 不再完全同步。
- 前台小图新增悬停原图预览：输入框上方参考图、用户消息参考图、`@资产` 菜单小图、文本内联小图、资产生成页右侧引用图都会显示缩略图，鼠标悬停用 portal 挂到 `document.body` 展示原图。浮层会按浏览器边界判断左右/上下位置，图片加载后按真实宽高比例重算显示尺寸，横图不会离鼠标太远，竖图也会在可视区内收缩。
- 右上角使用量浮窗新增当前对话流生成媒体数量。在 `Tk` 下方插入图片图标 + 当前对话流成功图片数、视频图标 + 当前对话流成功视频数；上传参考图不计入。顺序为 `Tk / 图片数 / 视频数 / 积分 / 美元 / 人民币约`。
- 资产库刷新定位已修。新增本地 UI 状态 `flashmuse-workspace-ui-state-v1`，立即保存当前一级面板、资产库标签和每个标签的滚动位置；刷新时优先读本地 UI 状态，避免服务端工作区 500ms 防抖未写入导致回到旧标签。点击一级“资产库”只进入资产库，不再强制切回 `角色图片` 或滚到顶部。滚动位置恢复只在进入资产库或切换标签时执行，不在滚动过程中反复 `scrollTo`，避免右侧滚动条抖动。
- 点击资产库或资产库分类时会自动关闭右侧文档预览面板；点击资产卡进入资产预览时也会关闭文档预览，避免文档预览残留在右侧遮挡资产库。
- 关键文件：`src/components/chat-workbench.tsx`、`src/app/admin/page.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/app/admin/admin-records-panel.tsx`、`src/app/admin/admin-credits-panel.tsx`。
- 本轮验证：多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。当前 build 仍有既有 `ffmpeg-static`/Turbopack tracing warning，另有 `local-assets.ts` 动态 generated 路径 tracing warning，均非阻断。

### 2026-06-04 本轮追加：资产库性能、视频封面、后台删除规则、积分显示和错误编号补齐

- 本轮用户继续要求回答简单直接，并要求把本对话框内所有重要改动写入交接文档和更新日志，方便下一个 AI 继续接手。
- 资产库分类加载慢已优化第一轮。新增 `/api/media-thumbnail`，本地 `/generated/...` 图片首次请求会用 `ffmpeg-static` 生成 512px 缩略图，缓存到 `public/generated/image-thumbnails/...`；资产库图片卡改为加载缩略图并 `loading="lazy"`。分类过滤改为 `useMemo`，初始分批渲染从 30 调到 24。
- 资产库视频卡不再批量加载真实 `<video preload="metadata">`。有 `asset.posterUrl` 或同名 `/generated/video-posters/xxx.jpg` 时显示封面缩略图；没有封面时显示轻量灰色视频占位。这样切到 `对话流视频` 不会一次性读取所有视频 metadata。
- 本轮手动给所有旧本地视频补封面。`public/generated/videos` 下共 22 个视频，原有 2 个封面，本轮新建 20 个封面，最终 `public/generated/video-posters` 下有 22 个 `.jpg`；`public/generated/videos/manifest.json` 已补 `posterUrl`。后续新视频仍由 `media-save-queue` 落盘后自动调用 `video-poster.ts` 抽帧。
- 视频封面视觉统一：对话流视频封面和资产库视频封面都只保留中央 `RiPlayLargeFill / play-large-fill` 播放按钮；此前左上角视频图标已按用户要求去掉。无封面灰底占位仍保留基础电影图标作为兜底。
- 预览页右侧缩略图上下按钮闪烁已修。旧逻辑用 `previewThumbsNeedScroll` 状态和当前页高度判断，滚轮切到最后一页时当前页缩略图数量变少，按钮会一会消失一会出现。现在按钮显示直接由 `previewMediaOptions.length > previewThumbPageSize` 决定，缩略图列表高度固定为一页容量。
- 后台 `用户已删除` 规则重新统一：用户删除对用户来说是删除；对后台来说只是用户操作，不是真删除。后台必须保留原内容、图片、视频、提示词、参数、积分，只追加红色 `用户已删除` 标识。删除标识不能覆盖原提示词或参数。
- 后台删除误判已修。此前把“扣费流水有 URL，但当前 workspace 媒体索引没匹配到”当成用户已删除，导致很多前端未删除的图片被标红。现在只有 workspace 明确 `trash/deletedAt` 或整条对话已删除，才显示删除标识。
- 后台媒体弹窗已修：`AdminMediaDialog` 不再用 `用户已删除` 替换参数和提示词；参数照常显示，提示词照常显示，只在参数下方追加红色 `用户已删除 时间`。右侧缩略图保留红色删除条。
- 后台历史对话删除态已修：删除整条对话后，左侧保留原标题并追加红色 `用户已删除`；右侧顶部追加红色 `用户已删除 时间`；不再用一条空系统消息覆盖内容。能从 `CreditLedger` 恢复出的图片、视频和提示词继续显示。
- 删除对话排序和媒体恢复已修：删除算最后操作时间，删除对话按 `updatedAtTs` 排在前面；删除对话内部媒体按原生成时间正序显示。删除对话里的图片/视频也会补回后台 `对话流图片 / 对话流视频` 列表并按 URL 去重。
- 后台生成记录重复项已修。此前同一张资产库图可能同时来自真实资产和 deleted ledger 补记录，出现两条同 URL 记录；现在不再额外拼接 deleted ledger 媒体，删除状态在真实记录上追加红字即可。
- 删除不再等于失败。后台之前把删除媒体 `status` 设为 `failed`，导致生成数量和积分统计少算。现在删除只通过 `errorText: "用户已删除"` 展示红字，`status` 保持原成功状态；真正生成失败才是 `failed`。
- 后台生成记录的积分扣除显示已修。`admin-records-panel.tsx` 原来把 workspace 媒体转成生成列表时固定 `credits: 0`，导致很多生成图片显示 `-0`；现在按媒体 URL 从 `conversationCreditDetails / assetGenerationCreditDetails` 回填真实扣费、美元、人民币、Token 和模型。
- 积分显示规则：上传类显示 `--`；扣分关闭显示 `0（扣分关闭）`；生成记录里确实找不到绑定流水的旧媒体显示 `0（扣分异常）`，记录仍保留。`0（扣分异常）` 多半是旧数据 URL 与旧流水没有精确绑定，不代表当前新链路没扣费。
- 错误编号兜底已补。此前前端在 `/api/image` 成功响应但 `images` 为空时自己抛 `服务器繁忙，请稍候再试.....`，没有 `B_数字`。现在 `/api/image` 对 `deliveredImages.length === 0` 直接返回 `createCodedApiError()`；`/api/video` 对任务完成但没有视频 URL 也返回带编号错误。
- 最新 BytePlus 生图失败排查：`byteplus:conversation-image.seedream-4-5` 有 BytePlus timing，但服务端得到 `image-generation empty delivery`，说明平台响应流程完成但没有可交付图片，也没有真实原因。现在日志会有 `[B_124]` 等编号，用户端显示 `(B_124) 服务器繁忙，请稍候再试.....`。
- 关键文件：`src/app/api/media-thumbnail/route.ts`、`src/components/chat-workbench.tsx`、`src/app/admin/page.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/app/admin/admin-records-panel.tsx`、`src/app/admin/admin-credits-panel.tsx`、`src/app/api/image/route.ts`、`src/app/api/video/route.ts`、`public/generated/videos/manifest.json`、`public/generated/video-posters/`。
- 本轮验证：多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过，仅剩既有 `ffmpeg-static` Turbopack NFT tracing warning。

### 2026-06-03 本轮追加：主题入口临时禁用、模型上传规则校验和后台上传规则表

- 本轮用户继续要求回答简单直接，并要求把当前对话框内所有重要改动写入交接文档和更新日志，方便下一个 AI 继续接手。
- 前台用户菜单里的主题入口已临时置灰禁用。现状：按钮显示当前主题文案和图标，但 `disabled`、不可点击、鼠标移入也不会打开主题二级菜单。主题功能代码、`flashmuse-workspace-theme-v1`、深色模式 token 和二级菜单代码都保留，后续如果继续调深色模式可以恢复入口。
- 本轮先去 OpenRouter 和 BytePlus 官方页面/本机 BytePlus 官方文档副本核对当前模型输入能力。确认 BytePlus 图片规则最完整：Seedream 4.5/5.0 Lite 支持文本、单图、多图，图片 URL 或 base64，参考图最多 14 张，单图最大 30MB，单图最大 3600 万像素，输入格式含 `jpeg/png/webp/bmp/tiff/gif/heic/heif`；批量输出最多 15 张且“输入参考图 + 输出图 <= 15”。
- 确认 BytePlus 视频 Seedance 2.0 系列官方规则：支持文本、图片、视频、音频混合参考；图片 1-9 张，单图 <=30MB；视频 0-3 个，mp4/mov，单个 <=50MB，2-15 秒，总时长 <=15 秒；音频 0-3 个，mp3/wav，单个 <=15MB，2-15 秒，总时长 <=15 秒；音频不能单独输入，必须同时有图片或视频；请求体 <=64MB；参考视频只支持 URL，不支持 base64 视频。
- 当前项目上传链路确认：用户上传图片先保存到本地 `/generated/upload_image/...` URL；生成时服务端会把本地 `/generated/...` 读成 `data:image/...base64` 发给 OpenRouter/BytePlus。本地没有公网 URL 也能继续用原来的 base64 打包方案测试多图，但大图/多图更容易 413。普通文档上传目前是前端读取文本并拼进 prompt，不是模型真实 file 输入。
- 新增 `src/lib/upload-rules.ts`，建立按 `mode + modelId + transportMode` 的统一上传规则。前端和后端共用这套规则，不要在后台另写一份规则。当前 `transportMode` 有 `local-base64` 和 `server-url`，后续用户明确说“不会有对象存储，未来方案是上传到服务器本地，然后生成服务器 URL 传给模型”。
- 对话流上传已接入模型规则：`addFilesToInput()` 会按当前模式/模型动态校验文件类型、格式、数量和单文件大小。`accept` 和拖拽提示也按当前规则动态显示。视频/音频在当前本地 base64 链路下只识别并提示：如果当前模型支持但需要服务器 URL，会提示“参考视频/音频需要服务器公网链接，当前本地环境暂不支持”；如果模型不支持则提示“当前模型不支持上传视频/音频”。
- 对话流 `@资产` 引用、资产库卡片“使用资产”、历史消息缩略图再次引用都已计入同一个参考图数量限制。例：当前模型最多 3 张，用户上传 2 张再 @ 1 张可以；再上传或再 @ 第 4 张会弹 `当前模型最多支持 3 张参考图，不能上传更多图片`。发送前也会兜底拦截手动输入过多 `@资产名` 的情况，不再静默截断。
- 资产库角色/场景/分镜生成页的 `@引用资产` 已接入当前资产生成模型的上传规则。点击引用和发送生成前都会校验引用图数量，超限提示同样是 `当前模型最多支持 X 张参考图，不能上传更多图片`。资产生成页仍不支持直接粘贴图片，保留原提示。
- 后端 `/api/image` 和 `/api/video` 已加参考图数量兜底校验，防止绕过前端直接提交超量参考图。`/api/image` 会按对话流图片或资产库图片区分 `mode: image / asset-image`；`/api/video` 按 `mode: video` 校验。
- 当前规则摘要：Agent 模式图片最多 5 张、文档最多 5 个；OpenRouter 图片模型最多 3 张图；OpenRouter Seedance 视频最多 3 张图；OpenRouter Kling/Veo 最多 2 张图；BytePlus 图片本地 base64 先限制 6 张，未来服务器 URL 可放到官方 14 张；BytePlus 视频图片最多 9 张，视频/音频规则已记录但当前未真正开放上传给模型。
- 后台 `系统设置` 底部新增“上传规则”表格，直接读取 `src/lib/upload-rules.ts` 展示。表格列为 `使用场景 / 模型范围 / 图片 / 文件 / 视频 / 音频`，说明文字已移到“使用场景”单元格下方灰字显示，格式长时会自动换行，整体宽度控制在 `1180px` 内。
- 后台上传规则表中未完全做实的能力已用红字标出：GPT 文件输入未做实（当前文档仅读文本拼 prompt）；BytePlus 特殊图片格式 `heic/heif/tiff/bmp/gif` 浏览器预览链路未完整做实；服务器 URL 传模型链路未做实；BytePlus 参考视频上传未做实；BytePlus 参考音频上传未做实。
- 重要后续提醒：下一个 AI 要继续做“上传功能做实”。优先事项：1）实现上传到服务器后生成公网/服务器 URL 并优先传 URL 给模型，保留本地 base64 兜底；2）接 `referenceVideos / referenceAudios` 前后端状态和 UI；3）BytePlus Seedance 2.0 视频/音频参考按官方数量、时长、大小校验并真正传给模型；4）特殊图片格式预览/识别链路补齐或明确转码；5）OpenRouter GPT-5.4 Image 2 如要支持真实 file 输入，需要单独接 OpenRouter 文件/Responses 能力，不要继续只在表格里显示为已完成。
- 关键文件：`src/lib/upload-rules.ts`、`src/components/chat-workbench.tsx`、`src/app/api/image/route.ts`、`src/app/api/video/route.ts`、`src/app/admin/admin-system-settings-panel.tsx`。
- 本轮验证：多次 `npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过，只剩既有 `ffmpeg-static` / Turbopack NFT tracing 非阻断 warning。

### 2026-06-03 本轮追加：对话流媒体性能、视频封面、主题菜单和深色模式细化

- 本轮用户继续要求回答简单直接，并要求把本对话框内所有重要改动写入交接文档和更新日志，方便下一个 AI 直接接手。
- 对话流媒体卡顿问题已处理第一轮。原因确认：工作台只渲染当前对话，切换对话会卸载旧 DOM；重新进入媒体很多的对话时图片/视频会重新挂载和解码。图片卡原来 `loading="eager" + fetchPriority="high"`，视频卡和预览缩略图原来会大量 `preload="metadata"`，导致卡顿。
- 图片卡已改为懒加载；对话流图片/视频结果区域新增 `LazyMediaMount`，只有滚动到视口附近才挂载媒体 DOM。后续不要改成“所有对话 DOM 常驻缓存”，那会明显增加内存占用。
- 视频封面链路已落地。新增 `src/lib/video-poster.ts`，新增依赖 `ffmpeg-static`。远程视频后台落盘到本地后会抽第一帧，保存到 `public/generated/video-posters`，并把 `posterUrl` 写入 media save job 和 `public/generated/videos/manifest.json`。
- `/api/media-save-status` 已返回 `posterUrl`。前端新增 `Message.videoPosters` 和 `AssetItem.posterUrl`，保存状态轮询成功后会把 `posterUrl` 写入对话流、资产库和预览媒体项。旧本地视频还支持同名封面兜底：`/generated/videos/xxx.mp4 -> /generated/video-posters/xxx.jpg`。
- 远程 URL 阶段视频展示保持旧体验不变：仍直接显示真实 `<video>`，鼠标悬停可播放，点击可预览。只有本地保存并有封面后，才先显示封面，鼠标移入再加载真实视频，用户侧应尽量无感。
- 已手动为 d28 两个视频抽帧并写 manifest：`video_1_d28` 的封面为 `/generated/video-posters/1780404101729-1970df97-a38f-44bd-9094-82da87ba04a2.jpg`；`video_2_d28` 的封面为 `/generated/video-posters/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.jpg`。
- 前台用户菜单新增主题二级菜单，支持 `浅色模式 / 深色模式 / 跟随系统`。配置保存在 `localStorage` key `flashmuse-workspace-theme-v1`，跟随系统会监听 `prefers-color-scheme: dark`。点击任一主题后一级和二级菜单都会关闭。
- 深色模式改为 token 化色板，核心在 `src/app/globals.css`：`--fm-bg / --fm-sidebar / --fm-panel / --fm-control / --fm-hover / --fm-selected / --fm-border-subtle / --fm-border / --fm-border-strong / --fm-text / --fm-text-muted / --fm-text-subtle / --fm-brand / --fm-brand-hover`。后续调深色优先改 token，不要到处散写硬编码。
- 深色模式左侧栏按用户截图修正：未选中按钮透明，选中才显示底；Logo 文字图反白；底部分隔线、积分卡、个人免费版底色、用户菜单圆角和二级菜单层级都已调整。注意左侧栏整体层级只能保持普通 `z-10`，不能再提到 `z-[9998]`，否则会盖住资产生成页和预览页。
- 对话流媒体卡底色规则已统一。图片/视频成功卡和失败卡都用 `--flashmuse-media-surface`；深色模式下该变量为 `--fm-control`。资产库外部失败卡也接入同一变量。不要再让成功卡透明，也不要给失败卡单独更亮底。
- 反馈按钮规则已定：对话流下方复制/重新生成/赞踩/回答不对/更多按钮常态透明，hover 时才显示底色；`感谢反馈 时间` 文案要更淡。
- 预览页规则已定：左侧舞台和工具按钮保持浅色模式视觉；右侧信息栏为较浅黑 `#2a303c`；缩略图普通边框 `#d8d8d8`、hover `#bdbdbd`、选中 `#367cee`。缩略图中间容器按当前页内容高度收缩，底部翻页按钮和最后一张缩略图距离与顶部一致。
- 资产生成页规则已定：左侧舞台保持浅色毛玻璃视觉；右侧栏使用和预览页一致的 `#2a303c`；右侧输入框深色下使用 `--fm-panel` 混合底；生成图片按钮浅色模式不变，深色模式可用态纯蓝 `--fm-brand`，禁用态淡蓝 `#1f3454 / #6f9fe8`；中间空状态颜色按浅色模式灰色 `#9a9a9a`。
- 本轮反复踩坑：深色模式不要用过宽的 `[class*="bg-[#..."]`、`[class*="border..."]` 去覆盖所有元素，容易误伤 hover 类、成功/失败媒体卡、预览页缩略图和生成页右侧按钮。后续新增深色样式优先加专用 class，再用 token 覆盖。
- 关键文件：`src/components/chat-workbench.tsx`、`src/app/globals.css`、`src/lib/video-poster.ts`、`src/lib/media-save-queue.ts`、`src/app/api/media-save-status/route.ts`、`src/app/api/video/route.ts`、`src/lib/video-manifest.ts`、`package.json`、`next.config.ts`。
- 本轮验证：多次 `npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。`ffmpeg-static` 会导致 Turbopack `Encountered unexpected file in NFT list` 非阻断 warning，当前不影响 build。

### 2026-06-03 本轮继续：远程媒体先展示后落盘、媒体保存队列、错误红字规则和日志补齐

- 本轮用户要求继续保持回答简单直接，并要求把当前对话内所有重要改动写入交接文档和更新日志，方便下一个 AI 直接接手。
- 媒体保存流程已调整为“远程 URL 先展示，后台异步下载落盘”。只要模型/供应商返回的是 `http/https` 图片或视频 URL，接口会先把远程 URL 返回给前端展示，同时服务端创建后台下载任务；下载成功后前端轮询 `/api/media-save-status` 并把对话流、资产库、生成任务里的远程 URL 自动替换成本地 `/generated/...` URL。`data:image/...base64` 或本地 `/generated/...` 不走异步队列，仍按原逻辑同步保存或直接使用。
- 新增 `src/lib/media-save-queue.ts` 和 `/api/media-save-status`。队列状态持久化在 `.runtime/media-save-jobs.json`，按远程 URL hash 去重，记录 `pending / downloading / saved / failed / expired`、`attempts`、`expiresAt`、`localUrl`、`dimensions`、`requestId`、`model` 等。下载失败按退避重试；`downloading` 中任务不会重复启动，除非超过 30 分钟被视为僵尸任务。
- 远程媒体日志已补齐。生成接口日志记录 `requestId / model / providerMs / saveQueueMs / totalMs`；保存队列日志记录 `[media-save] queued remote asset / downloading remote asset / saved remote asset / remote asset save failed`，包含 `requestId / model / attempts / queuedMs / downloadMs / localUrl / dimensions / host / pathTail`。日志不打印完整签名 URL。base64 同步保存会记录 `[media-save] saved inline asset`。
- 视频接口 `/api/video` 成功轮询到远程视频后不再同步等待 `saveGeneratedAsset()`，而是入队后台保存并立即返回远程 URL。`CreditLedger.metadata` 会写 `remoteMediaUrls / delivered / savedLocal / localSaveStatus / mediaSaveJobId`。`video-manifest.json` 后续由保存队列在落盘成功时更新为本地 URL。
- 图片接口 `/api/image` 也已覆盖所有供应商和模型的远程 URL。OpenRouter 图片、BytePlus 图片、后续其它 provider 只要返回远程 URL，都会先展示再后台下载；只有 base64 保持同步保存。此前资产库 `candidateMode="best"` 曾保留同步下载以按尺寸筛图，本轮按用户要求已取消该例外。
- 本轮排查 `video_2_d28` 和 `video_1_d29`：`video_2_d28` 曾因旧下载任务重复调度保存出两个相同 mp4，已用 SHA256 确认重复并删除孤儿文件 `1780454968504-21fb484e-7894-45cb-b730-63c475ee71f2.mp4`。`video_1_d29` 实际已保存为 `/generated/videos/1780455861980-3d512beb-cddc-4f54-b7a6-2dc4c0725fb1.mp4`，完成时间约 `2026-06-03 11:08:09.233`。
- 本轮排查 `image_1_d29` 到 `image_4_d29`：这组为 `openai/gpt-5.4-image-2 / 16:9 / 1K / 4张`，不是 BytePlus，且生成时已经同步保存为本地 png；4 张落盘时间约 `2026-06-03 11:13:25.975`、`11:13:26.572`、`11:13:27.674`、`11:13:30.076`。当时还没有远程媒体异步保存队列记录。
- 图片供应商请求已加 `5分钟` 超时，避免模型商连接不返回导致对话流永远 pending。`Unexpected end of JSON input`、响应不完整、5xx 等临时错误会重试一次；模型拒绝、内容过滤、没有返回图片不再重试，避免拒绝类错误拖到 7-9 分钟。本轮手动清理了本地用户 `ID_779117` 的旧挂起请求 `1243c1a8-531a-4330-abe7-32d547a08bdc`，把 4 个槽位标记失败并移除 pending。
- 对话流错误红字规则已统一：优先显示模型/提供商返回的真实中文原因；没有真实原因时显示通用原因 `服务器繁忙，请稍候再试.....`；所有生成错误都保留 `B_数字` 错误编号，便于后续查日志。用户端不显示供应商名称，不显示 `OpenRouter / BytePlus / ModelArk / OpenAI / Gemini / Google`，不显示 `<system-reminder>`、`finish_reason`、`native_finish_reason`、HTML、堆栈或其它内部英文技术内容。后端日志仍保留原始错误用于排查。
- 对话流多张图片/多个视频失败时，每个失败原因写入 `message.mediaErrorReasons`，红字上方显示 `<1/4>` 这类翻页控件。超过一个错误才显示翻页；默认定位到第一条真实原因，如果前几条是通用原因、后面有真实原因，会自动显示真实原因所在页。整批失败原因会在前端日志中记录 `[media-generation] image failure reasons` 或 `[media-generation] video failure reasons`，包含 `requestId / model / successCount / failureCount / reasons`。
- 资产库生成错误规则保持：资产库外部失败卡只显示“图片生成失败 / 查看失败”，不在外部卡片展示原因；真实原因只显示在全屏资产生成页。资产库失败原因同样经过中文清洗和供应商名过滤。
- 本轮后续修复开发浮层 `5 Issues`。`lint/build` 本身没有错误，dev 日志真实错误是预览页 `Maximum update depth exceeded`。已给预览图片尺寸、缩略图分页和预览资产同步加“相同值不重复 setState”保护；生成图片缩略图改为 `Image fill + object-contain`，减少 Next 图片宽高比例 warning。
- 对话流图片生成展示规则重新对齐为“固定槽位”。用户请求几张就固定几个槽位，最多 4 个；每个槽位只允许 `pending / image / failed`。成功、失败、失败卡重试都只替换对应槽位，不允许追加第 5、第 6 个等待卡或失败卡。
- 本轮反复修正失败卡规则。正确规则：失败卡数量只来自固定槽位里的 `failed` 状态，不能用 `mediaErrorReasons.length` 推断。全失败请求 4 张显示 4 个失败卡；3 成功 1 失败显示 3 图 + 1 失败卡；红字 `<1/4>` 只对应当前仍失败的槽位。后续不要再按失败原因数量补卡，否则会出现 5 张失败卡。
- 对话流图片额外返回规则已改。模型多返回图片不再显示、不再分页；服务端 `/api/image` 会优先按用户请求尺寸筛图，例如请求 4K 只返回真实 4K 图，1K/2K/非请求尺寸不展示、不绑定为本次交付媒体。旧对话流前端也按该规则过滤展示，但必须保留 pending/failed 槽位。
- 绿色成功提醒规则已对齐。图片专业模式同一批任意一个槽位成功即可弹一次 `图片生成已完成`；全失败不能弹绿色成功。提醒只在单槽成功分支触发，并由 `notifyGenerationCompleteOnce(requestId, ...)` 去重。曾短暂改成整批结束后再弹，已按用户要求撤回。
- 再次修复 `video_2_d28`。本地用户 `ID_779117` 的工作区曾被打开的旧浏览器状态覆盖回已删除 URL `/generated/videos/1780454968504-21fb484e-7894-45cb-b730-63c475ee71f2.mp4`，导致视频卡和预览 404。已替换为有效文件 `/generated/videos/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.mp4`，最终验证数据库 `old 0 / new 6`。`/api/workspace-state` GET/PUT 和工作台加载都加了旧 URL 替换兜底，防止旧浏览器状态再次覆盖。
- `public/generated/videos/manifest.json` 中 BytePlus Fast 任务 `cgt-20260602204634-97h8d` 的 `localVideoUrl` 已改成有效本地文件。`src/lib/media-save-queue.ts` 增加 saved job 后补 `videoTaskId` 时回写 `video-manifest.json` 的逻辑，避免 manifest 继续指向远程或旧地址。
- 错误清洗补漏：`图片平台没有返回图片，且没有返回可用原因。`、`没有返回可用原因`、`没有返回原因` 等无真实原因文本现在会显示通用 `服务器繁忙，请稍候再试.....`，但模型返回真实中文拒绝原因仍显示。
- 本轮讨论了媒体多时卡顿的后续优化方向：对话流视频默认不挂载真实 `<video>`，只点开/悬停时加载；预览右侧视频缩略图不用 `<video preload="metadata">`；历史图片懒加载或使用缩略图缓存。尚未全面实现，只做了部分图片缩略图加载修复。
- 关键文件：`src/lib/media-save-queue.ts`、`src/app/api/media-save-status/route.ts`、`src/app/api/workspace-state/route.ts`、`src/app/api/video/route.ts`、`src/app/api/image/route.ts`、`src/lib/openrouter.ts`、`src/lib/error-message.ts`、`src/lib/error-code.ts`、`src/components/chat-workbench.tsx`、`src/app/admin/page.tsx`、`public/generated/videos/manifest.json`。
- 本轮多次验证：`npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过。

### 2026-06-02 本轮继续：后台概览看板、BytePlus 视频时长、日志、积分弹窗和 GitHub 同步

- 本轮开始先阅读 `handover/` 交接文档和更新日志，确认当前重点是 BytePlus 接入、后台系统设置、费用计算、视频能力测试和后台管理继续完善。用户要求后续回答简单直接。
- 复测并确认 BytePlus `Seedream 5.0 Lite` 当前 `output_format=jpeg` 不报错，且输出确实为 `.jpg` 图片。新增专用测试脚本 `scripts/test-byteplus-seedream-5-lite-px-matrix.mjs`，只测 `seedream-5-0-260128 + output_format=jpeg + size=WIDTHxHEIGHT px`。
- `Seedream 5.0 Lite` 的 12 个尺寸组合全部成功，结果写入 `AI-Video-Assistant_Project Planning/test/byteplus-seedream-5-lite-px-size-test-results.md` 和 `byteplus-seedream-5-lite-px-size-test-raw.json`，图片保存到 `AI-Video-Assistant_Project Planning/test/byteplus-seedream-5-lite-px-images/`。成功尺寸：`16:9 2K=2848x1600 / 4K=5504x3040`、`9:16 2K=1600x2848 / 4K=3040x5504`、`1:1 2K=2048x2048 / 4K=4096x4096`、`4:3 2K=2304x1728 / 4K=4704x3520`、`3:4 2K=1728x2304 / 4K=3520x4704`、`21:9 2K=3136x1344 / 4K=6240x2656`。
- 排查 d28 对话流预览右侧缩略图不显示“全部图片”的问题。结论：d28 实际成功图片为 17 张；另有两条 assistant 消息各有 4 个 `imageResultSlots` 但没有图片 URL，属于失败/空槽，预览不会显示。右侧缩略图本身是分页渲染，不是一次性渲染全部；如果翻页也看不到成功图片才算 bug。
- 统一图片/视频分辨率图标规则。图片 K 数标识 `1K / 2K / 4K` 一律空心边框；视频分辨率 `SD / HD / FHD / 4K` 才使用黑底实心。修复图片设置菜单里 `4K` 被误渲染成视频黑底图标的问题，移除不再使用的 `Ri4kLine`。
- 查阅 BytePlus 视频文档 `E:\project\【1】Api key\Byteplus\创建视频生成任务说明.md` 和 `Seedance 2.0接口文档.md`。确认 BytePlus 视频尺寸由 `resolution + ratio` 控制，不传 `size=WIDTHxHEIGHT`。字段包括 `model / content / resolution / ratio / duration / generate_audio / watermark / seed / return_last_frame / priority / callback_url`。`Seedance 2.0 Fast` 不支持 `1080p`，`Seedance 2.0` 支持 `480p / 720p / 1080p`。
- BytePlus 两个视频模型的时长能力已改为文档规则 `4-15秒` 每秒可选，只影响 `byteplus:video.seedance-2-0-fast` 和 `byteplus:video.seedance-2-0`。OpenRouter Seedance/Kling/Veo 时长保持原规则。服务端 `getDuration()` 对 BytePlus 增加 `4-15` 秒兜底，异常时长会 clamp 到合法范围。
- 视频时长菜单已改为两列显示。当前视觉顺序为左列从上到下 `15秒 / 14秒 / 13秒 / 12秒 / 11秒 / 10秒`，右列从上到下 `9秒 / 8秒 / 7秒 / 6秒 / 5秒 / 4秒`，也就是每列从下往上递增。
- 排查 d28 最后两个 BytePlus 视频任务慢的问题。当前之前没有视频分段 timing 日志，只能从 manifest 和 dev log 反推。任务 `cgt-20260602203824-qf5tz`（Seedance 2.0，480p/16:9/5秒）总耗时约 4分09秒，成功保存本地；任务 `cgt-20260602204634-97h8d`（Seedance 2.0 Fast，720p/16:9/15秒）总耗时约 13分55秒，远程 URL 约 2 分多钟已生成，最后 `localVideoUrl` 仍是远程 URL，说明主要卡在远程 mp4 下载保存而不是模型生成。
- `/api/video` 已新增非敏感 timing 日志：`[video-generation] BytePlus created` 记录 `createMs / model / taskId / ratio / resolution / duration / referenceCount`；`[video-generation] BytePlus polling` 记录 `queryMs / status / hasVideoUrl`；`[video-generation] BytePlus completed` 记录 `queryMs / saveMs / totalMs / savedLocal / saveFailed / saveError`。不打印完整远程签名 URL。
- 后台 `系统设置` 顶部 API 输入框宽度继续调整。OpenRouter 输入区加长到 `620px`；BytePlus 输入区加长到 `450px`；顶部 API 区总宽 `1090px`，仍低于下方模型表 `1180px`。只改 UI 宽度，不改保存逻辑。
- 后台 `积分管理` 展开区里的 `当前积分` 已可点击，新增 `当前积分变动明细` 弹窗。弹窗按时间最新排序，三列表格显示 `变动原因 / 积分变动 / 变动后剩余积分`；每条 `CreditLedger` 都展示，包括注册送积分、后台调积分、对话/规划、图片、视频、资产库图片、反推/优化提示词。余额通过当前余额倒推每条流水后的余额。
- 后台 `概览` 页已从占位升级为运营看板。新增核心卡、近 30 日活跃/新增折线图、近 7 日积分/美元消耗折线图、近 7 日生成柱状图、1/3/7 日留存、系统状态、模型使用 Top 8、供应商使用占比、失败原因 Top 10、最近活跃用户 Top 10、消耗积分用户 Top 10。图表用轻量 SVG/CSS 实现，未引入新依赖。数据来自 `User / Session.lastSeenAt / UserWorkspaceState / CreditLedger / systemSettings / creditSettings`。
- 本轮确认两个 lint warning 暂不需要处理：`chat-workbench.tsx` 的 `Unused eslint-disable directive` 和 `showInputTip` hook dependency warning，当前不影响运行和 build，后续可单独清理。
- 本轮验证：多次 `npm run lint` 通过，仅剩上述两个原有 warning；`npm run build` 通过。
- 已将业务代码、后台/API、Prisma、脚本和交接文档提交并推送到 GitHub `origin/main`，提交为 `a538b32 Update admin dashboard and BytePlus integrations`。推送前做过暂存区敏感信息扫描，未提交 `.env / .env.local`，也未提交 `AI-Video-Assistant_Project Planning/`。注意：本条交接文档更新发生在该提交之后，如需 GitHub 也包含本次交接更新，需要再单独提交推送。

### 2026-06-02 本轮继续：BytePlus 开关落实、费用计算、视频显示和交互修正

- 后台 `系统设置` 顶部 `OpenRouter API / BytePlus API` 输入框已临时改为明文显示，方便用户核对当前 Key。只改输入框 `type`，不改保存逻辑。后续如用户确认安全要求，可再改回密码显示。
- 修复对话流视频等待卡尺寸被提示词区压窄的问题。专业视频生成的成功卡、等待卡、失败卡统一恢复固定 `640x360`；Agent 自动视频保留原两列紧凑布局，避免多段 Agent 视频变成单列。图片卡逻辑未改，仍为 `250x250`。
- 修复对话流视频主播放器强制静音问题。`InlineVideoResult` 已移除 `muted`，模型返回有音轨时前端可播放声音；缩略图和首页背景视频仍保留静音。
- BytePlus `Seedream 5.0` 显示名已统一改为 `Seedream 5.0 Lite`。模型 ID 仍为 `byteplus:conversation-image.seedream-5-0`，实际模型仍映射 `seedream-5-0-260128 / ep-20260514142211-p2wdk`。
- BytePlus `Seedream 5.0 Lite` 的 `output_format` 当前按用户测试要求改为 `jpeg`。此前尝试过 `jpg`，BytePlus 返回 `参数不支持`；如果后续 `jpeg` 仍报错，应回退为 `png` 或取消该参数。`Seedream 4.5` 仍不传 `output_format`。
- BytePlus `Seedream 5.0 Lite` 图片尺寸表已和 `Seedream 4.5` 对齐。`2K / 4K` 六个比例都传对应 px，不再显示 `未知`，也不再回退传 `2K / 4K`。
- 后台系统设置的 `资产库图片生成` 开关已落实到前端和服务端。`/api/model-availability` 新增 `assetImageModels`；资产库角色/场景/分镜生成模型菜单按后台 `资产库图片生成` 开关过滤；服务端 `/api/image` 会按 `metadata.creditSource` 区分对话流图片和资产库图片的模型开关。
- BytePlus 资产库图片生成现在按 `asset-image.seedream-4-5 / asset-image.seedream-5-0` 读取 Endpoint 配置；对话流图片仍按 `conversation-image.*` 读取，避免后台资产库 Endpoint 修改不生效。
- 后台 BytePlus 文本模型行如果已启用 BytePlus 且该行有下拉菜单，则下拉会灰掉不可点。必须先关闭 BytePlus，才能修改该行的 BytePlus 下拉模型。
- 后台 `Agent 自动生成策略` 中 `高质图片` 右侧的 `Seedream 5.0 Lite` 已按用户要求去除，只保留左侧 `GPT-5.4 Image 2`。默认图片 `Seedream 4.5` 和视频两项仍保留左右切换配置。
- 前端所有图片模型下拉排序已统一：`Seedream 4.5`、`Seedream 5.0 Lite` 固定排前两位，其它图片模型排后面。对话流图片和资产库图片都使用同一排序；后台开关导致默认回退时也按这个顺序。
- 后台生成/积分明细的模型名称识别已补 BytePlus 图片/视频模型，避免显示 `byteplus:...` 原始 ID。现在会显示 `Seedream 4.5 / Seedream 5.0 Lite / Seedance 2.0 Fast / Seedance 2.0`。
- 取消“模型信息查询”的前端假回答。用户问“现在用什么模型”时，不再由前端拼 `前端入口 / 后台实际模型` 这种带 AI 图标的系统文本，而是走正常 Agent 对话，让模型自己回答。`isModelInfoQuestion()` 当前直接返回 `false`。
- BytePlus 费用计算已接入服务端 usage，不改前端/后台展示结构。文本按 token 计费，图片按成功输出张数计费，视频按返回的 `completion_tokens` 计费，之后继续走现有美元 -> 人民币 -> 积分换算。
- BytePlus 文本价格来自 `E:\project\【1】Api key\Byteplus\pricing.md`：`seed-2-0-lite-260428` 输入 `$0.25/M`、输出 `$2.00/M`；`seed-2-0-pro-260328` 输入 `$0.50/M`、输出 `$3.00/M`；`glm-4-7-251222` 输入 `$0.60/M`、输出 `$2.20/M`。`seed-2-0-lite/pro` 超过 `128K` prompt tokens 时按第二档翻倍价格。
- BytePlus 图片价格来自 `pricing.md`：`seedream-4-5-251128` 为 `$0.04 / 张`，`seedream-5-0-260128` 为 `$0.035 / 张`。代码保留 token 显示，但扣费金额按成功本地保存图片张数计算。
- BytePlus 视频价格来自 `pricing.md`：`dreamina-seedance-2-0-fast-260128` 无视频输入时 `$5.60/M tokens`；`dreamina-seedance-2-0-260128` 无视频输入时 `480p/720p = $7.00/M tokens`、`1080p = $7.70/M tokens`。费用按成功查询返回的 `usage.completion_tokens` 计算。
- OpenRouter 计费路径未改：OpenRouter 文本继续按返回 `usage.cost` 或 OpenRouter 价格估算；OpenRouter 图片/视频继续按供应商返回 usage/cost 走。
- 仍需后续注意：后台 `Agent 自动生成策略` 的媒体模型开关还不是完整执行策略。Agent 自动媒体生成当前仍主要按代码策略和当前前台选择模型决定；如要完全按后台策略接管，需要单独设计和实现。
- 本轮验证：多次 `npm run lint` 通过，仅剩 `src/components/chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

### 2026-06-02 本轮追加：BytePlus 参数隔离、尺寸规则、并发策略和解除限制开关

- 本轮确认供应商隔离硬规则：OpenRouter 是当前稳定基线，任何 BytePlus 或其它供应商改动都不能影响 OpenRouter 已跑通的参数、请求体、展示尺寸、扣费 metadata 和后台记录。BytePlus 能复用 OpenRouter 规则时先复用；接口不支持或实测表现不同的地方，必须写独立 provider 分支、独立参数表或独立适配函数。后台可能随时切回 OpenRouter。
- BytePlus 图片尺寸规则已进一步确认。BytePlus 图片接口没有单独 `aspect_ratio` 字段，尺寸控制核心只有 `size`。`size` 可以传档位 `2K / 3K / 4K`，也可以传具体像素 `WIDTHxHEIGHT`，但只能二选一。只传 `2K / 4K` 时比例主要靠提示词，可能默认出 `1:1`；要稳定控制比例，应把前台 `比例 + K数` 映射为具体像素写入 `size`，不额外改用户提示词。
- BytePlus 图片参数已独立于 OpenRouter。`OpenRouter` 仍使用 `image_config.aspect_ratio + image_config.image_size`；`BytePlus` 使用独立尺寸表，已知成功尺寸传 `WIDTHxHEIGHT`，未知/未测成功组合回退传 `2K / 4K`。OpenRouter 请求逻辑不变。
- `src/lib/models.ts` 已为 BytePlus 图片建立独立尺寸表。`Seedream 4.5` 的 `2K / 4K` 六个比例都写入成功实测 px；`Seedream 5.0` 只写入成功实测的组合，未成功/超时组合显示 `未知`，不再用 OpenRouter 尺寸兜底。前端尺寸面板遇到未知尺寸显示 `未知`。
- BytePlus `21:9` 返回 `1:1` 的根因已查明：此前后端只传 `size: "2K"`，没有单独比例字段，用户提示词又没写比例，所以 BytePlus 默认出了 `1:1`。现在已知成功组合会传具体 px，例如 `21:9 / 2K -> 3136x1344`、`16:9 / 2K -> 2848x1600`。
- BytePlus 图片多图策略已反复确认并最终恢复为“用户要几张就请求几次”。原因：官方 `sequential_image_generation: "auto" + max_images` 只表示最多几张，不保证返回指定张数；实测一次请求 4 张可能只返回 1 张，不符合产品“用户选 4 张就尽量生成 4 张”的规则。因此对话流专业图片模式下，BytePlus 和 OpenRouter 一样按槽位并发请求，每个 `/api/image` 请求 `count: 1`，谁先完成谁先显示。Agent 多图本来就可能每张提示词不同，也继续按单图请求执行。
- BytePlus 官方批量多图能力保留在后端 `generateBytePlusImage()` 中，但前端对话流不再用它来满足普通 `2/3/4张` 生成。以后只有用户明确需要“一组相关连续图”或后续专门接 `stream: true` SSE 时，再考虑启用官方批量模式。
- BytePlus 批量部分失败原因处理已补过：后端会解析 `data[].error.message` 到 `failureReasons`。但如果 BytePlus 只返回成功图片、不返回失败项原因，则前端按用户要求只显示通用 `图片生成失败，请稍后再试。`，不显示供应商名，也不显示“只返回 1/4 张”这类技术说明。
- 为排查慢的问题，`src/lib/openrouter.ts` 保留了 `[image-generation] BytePlus timing` 日志，包含 `providerMs / saveMs / dimensionsMs / totalMs`。近期 d26 实测显示，BytePlus 生成/返回通常约 `7-15秒`，但远程图片 URL 下载保存可能达到 `40-75秒`，因此慢经常卡在下载保存 `saveMs`，不一定是模型生成慢。
- 后台 `系统设置` 的 `BytePlus API` 行右侧新增 `解除限制` 开关，配置写入 `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS`。关闭时，BytePlus 实际调用使用模型名，如 `seedream-4-5-251128`、`dreamina-seedance-2-0-fast-260128`；打开时，实际调用使用后台保存的 Endpoint ID，如 `ep-20260514174622-n9qfb`、`ep-20260521134040-vf2jf`。前端和后台显示模型名称不变，仅改变服务端请求里的 `model` 值。
- `BYTEPLUS_MODEL_SELECTIONS` 中已配置这些 Endpoint ID：`conversation-image.seedream-4-5 -> ep-20260514174622-n9qfb`、`conversation-image.seedream-5-0 -> ep-20260514142211-p2wdk`、`video.seedance-2-0-fast -> ep-20260521134040-vf2jf`、`video.seedance-2-0 -> ep-20260521133841-nn8bg`，文本模型也继续使用对应 Endpoint ID。`getBytePlusModelForRequest()` 会按 `BYTEPLUS_UNLOCK_LIMITS` 在模型名和 Endpoint ID 之间切换。
- 本轮验证：多次 `npm run lint` 通过，仅剩 `src/components/chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

### 2026-06-02 本轮追加：BytePlus 图片/视频前台显示、真实接口接入和图片尺寸测试

- 后台 `系统设置` 顶部 `OpenRouter API / BytePlus API` 两个输入框区域宽度已调整。顶部 API 区为 `min-w-[860px]`、内容宽 `960px`，低于下方模型列表 `min-w-[1180px]`，避免 API 输入区比模型表更宽。
- 新增 `src/components/byteplus-icon.tsx`，从用户提供的 BytePlus SVG 中只取前面的图形，不带文字。后台 BytePlus 列所有模型图标已从抖音图标换成 BytePlus 图形，颜色继承原模型图标灰色。前台模型按钮也支持 `byteplus:` / `byteplus/` / `ep-` 模型 ID 显示 BytePlus 图标。
- 修复 `.env.local` 中 JSON 配置被双引号包裹时解析失败的问题。`src/lib/system-settings.ts` 的 `parseEnvValue()` 现在会先尝试 `JSON.parse()` 外层字符串，避免 `MODEL_PROVIDER_PREFERENCES / BYTEPLUS_MODEL_SELECTIONS` 保存后读回失败，导致 BytePlus 模型下拉看起来无法切换。
- 前台模型可用性已从“只隐藏关闭的 OpenRouter 模型”改为同时返回已启用的 BytePlus 图片/视频模型。新增前台模型 ID：`byteplus:conversation-image.seedream-4-5`、`byteplus:conversation-image.seedream-5-0`、`byteplus:video.seedance-2-0-fast`、`byteplus:video.seedance-2-0`。工作台图片/视频模型下拉现在会显示后台启用的 BytePlus 模型，并用 BytePlus 图标区分供应商。
- BytePlus `Seedance 2.0` 在前台模型按钮/菜单中已和 OpenRouter `Seedance 2.0` 一样使用金色文字。对应模型 ID 为 `byteplus:video.seedance-2-0`。
- BytePlus 图片生成已接真实接口：`POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`。`Seedream 4.5` 默认映射到 `seedream-4-5-251128`，`Seedream 5.0` 默认映射到 `seedream-5-0-260128`；若后台打开 `解除限制`，实际请求会改用对应 Endpoint ID。支持文生图、单图图生图、多图融合。返回 `data[].url` 会保存到本地，`usage.output_tokens / usage.total_tokens` 会写入 usage。
- BytePlus 图片参考图规则已按文档接入。无参考图时不传 `image`；一张参考图时传字符串 `image`；多张参考图时传数组 `image`。注意：官方连续多图参数 `sequential_image_generation: "auto"` 和 `max_images` 只表示最多返回几张，不保证返回用户选择的张数；当前对话流专业模式已恢复为按用户选择张数并发发起多个单图请求，每个请求 `count: 1`。
- BytePlus 图片流式返回暂未接入，但已记录方案。流式请求需要 `stream: true`，SSE 中 `image_generation.partial_succeeded` 返回单张图片 URL，`image_generation.completed` 返回 usage，最后 `data: [DONE]`。后续如果要做“一张张跳出来”，应基于该 SSE 格式重构 `/api/image` 的服务端推送和前端槽位更新。
- BytePlus 视频生成已接创建任务和查询任务。创建任务：`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`；查询任务：`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`。`Seedance 2.0 Fast` 映射到 `dreamina-seedance-2-0-fast-260128`，`Seedance 2.0` 映射到 `dreamina-seedance-2-0-260128`。请求体包含 `content / resolution / ratio / duration / generate_audio / watermark`。查询成功后读取 `content.video_url`，保存视频并写扣费 metadata。
- BytePlus 视频参考图按文档使用 `content` 数组，图片项格式为 `{ type: "image_url", image_url: { url }, role: "reference_image" }`。本地 `/generated/...` 会转成 data URL。当前未接参考视频和参考音频输入，只接文字和参考图片。
- 新增 BytePlus 图片尺寸测试脚本 `scripts/test-byteplus-image-size-matrix.mjs`。测试结果写入 `AI-Video-Assistant_Project Planning/test/byteplus-image-size-test-results.md` 和 `byteplus-image-size-test-raw.json`。测试覆盖 `Seedream 4.5 / Seedream 5.0`，比例为 `16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 21:9`，size 为 `1K / 2K / 4K`。测试只传 `model / prompt / size / watermark`，`Seedream 5.0` 额外传 `output_format=png`；比例只写入提示词，因为 BytePlus 图片接口没有单独比例字段。
- BytePlus 图片尺寸实测结论：`Seedream 4.5` 和 `Seedream 5.0` 都不支持 `1K`；两个模型都支持 `2K / 4K`。`Seedream 4.5` 不支持 `output_format` 参数，正式代码已改为只有 `Seedream 5.0` 传 `output_format=png`。`Seedream 5.0` 部分大尺寸请求本轮超过 10 分钟超时，已在测试表中记录。
- BytePlus 图片稳定实测尺寸：`2K` 下 `16:9=2848x1600`、`9:16=1600x2848`、`1:1=2048x2048`、`4:3=2304x1728`、`3:4=1728x2304`、`21:9=3136x1344`。`4K` 下 `16:9=5504x3040`、`9:16=3040x5504`、`1:1=4096x4096`、`4:3=4704x3520`、`3:4=3520x4704`、`21:9=6240x2656`，其中 4:3/3:4/21:9 的 4K 对 `Seedream 5.0` 本轮部分超时，`Seedream 4.5` 成功。
- 本轮验证：多次 `npm run lint` 通过，仅剩 `src/components/chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。一次 build 因 `body.output_format` 类型推断失败，已通过把 BytePlus 图片请求体标记为 `Record<string, unknown>` 修复。

后续接手重点：继续测试 BytePlus `Seedance 2.0 Fast / Seedance 2.0` 视频模型的比例、分辨率和秒数；按测试结果调整 `src/lib/models.ts` 里的 BytePlus 视频能力表。继续观察 BytePlus 图片 `providerMs/saveMs`，判断是否需要优化远程图片下载保存或引入缩略图缓存。

### 2026-06-01 本轮追加：BytePlus 接入入口和模型提供商互斥配置

- 后台 `系统设置` 新增并完善 `BytePlus API` 输入框和启用开关。BytePlus Region 固定为 `ap-southeast-1`，不再展示 Region 下拉。配置写入 `.env.local`：`BYTEPLUS_API_KEY / BYTEPLUS_API_KEY_ENABLED / BYTEPLUS_REGION / MODEL_PROVIDER_PREFERENCES / BYTEPLUS_MODEL_SELECTIONS`。现有 OpenRouter API 输入框保留并与 BytePlus 左右对齐。
- 后台模型使用表最终为四列：`使用位置 / OpenRouter / 说明 / BytePlus`。OpenRouter 和 BytePlus 每个模型都有灰底框、模型名前有图标；左右无对应模型的位置显示空灰底，保证两列对齐。`普通 / 高级 / 优先 / 第二 / 第三 / 默认图片 / 高质图片 / 快速图片 / 默认视频 / 高质视频 / 4K视频` 等文字放在中间说明列。
- 当前 BytePlus 对话模型下拉只保留 `Seed 2.0 Lite / Seed 2.0 Pro / GLM-4.7`。`对话 / Agent 规划 / 意图识别` 的 `普通 / 高级` 都有该下拉；`反推提示词 / 优化提示词` 的 `优先 / 第二 / 第三` 也都有该下拉。Endpoint ID 来自 `E:\project\【1】Api key\Byteplus\Byteplus.md`。
- BytePlus 图片/视频模型不再使用下拉：`Seedream 4.5` 对应 OpenRouter `Seedream 4.5`；`Seedream 5.0` 单独显示，左侧 OpenRouter 为空灰底；`Seedance 2.0 Fast / Seedance 2.0` 分别对应 OpenRouter 同名视频模型。`Agent 自动生成策略` 的 `高质图片` 是左侧 `GPT-5.4 Image 2` 与右侧 `Seedream 5.0` 互斥。
- 模型开关规则已做实。OpenRouter 左列所有模型都有开关；BytePlus 右列所有模型也有开关。左右同一行互斥：打开 OpenRouter 会关闭同一行 BytePlus，打开 BytePlus 会关闭同一行 OpenRouter。BytePlus 独有模型如 `Seedream 5.0` 打开即额外启用，关闭即禁用。
- 文本类调用已接 BytePlus 路由：`sendToOpenRouter()`、`planAgentTask()`、`classifyOpenRouterIntent()` 会读取后台 `MODEL_PROVIDER_PREFERENCES`。选择 BytePlus 时调用 `https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions`，`model` 使用后台选择的 Endpoint ID。图片/视频 BytePlus 专用生成接口已有后台配置入口，但实际生成路由尚未切到 BytePlus 专用 API。
- 新增 `/api/model-availability`，前端工作台根据后台开关过滤对话流图片/视频模型下拉。关闭模型不显示；全关时下拉显示 `暂无可用模型`，发送时对话流红字提示 `连接不到模型，请联系管理员！`。`/api/image` 和 `/api/video` 服务端也做了关闭模型兜底校验。
- 本轮验证：`npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过。

### 2026-06-01 本轮追加：后台系统设置接入 OpenRouter API Key

- 后台 `系统设置` 页面已从纯占位开始做实，顶部新增 `OpenRouter API` 输入框和开关。交互规则和积分设置类似：关闭开关时输入框可编辑；打开开关时保存当前输入并启用。
- 新增后台接口 `/admin/api/system-settings`，仅管理员可读写。接口会读写 `.env.local` 中的 `OPENROUTER_API_KEY` 和 `OPENROUTER_API_KEY_ENABLED`。打开开关但 Key 为空时返回 `请输入 OpenRouter API Key`。
- 新增 `src/lib/system-settings.ts`。OpenRouter 文本、图片、视频调用都改为通过 `getConfiguredOpenRouterApiKey()` 读取启用状态；`OPENROUTER_API_KEY_ENABLED=false` 时会视为缺少 API Key。
- 新增组件 `src/app/admin/admin-system-settings-panel.tsx`，当前保留管理员白名单、访问控制、更多系统项的占位卡。
- 本轮验证：`npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过。

### 2026-06-01 本轮追加：后台生成记录做实、扣费开关补齐和记录口径统一

- 后台积分管理 `选择积分消耗项` 新增第四个开关 `反推/优化提示词`。数据库新增 `CreditSetting.chargePromptTool`，迁移 `20260601120000_credit_prompt_tool_switch` 已执行。`/admin/api/credits` 和 `/api/admin/credits` 已读写该字段。
- 四个扣费开关已重新对齐并做实：`对话/规划` 控制 Agent 和所有对话模型扣分；`图片` 控制平台所有生成图片扣分；`视频` 控制平台所有生成视频扣分；`反推/优化提示词` 控制平台所有图片反推和提示词优化扣分。开关关闭时允许余额为 0 的用户继续使用对应功能，不扣余额，但仍写 `CreditLedger` 流水，metadata 写 `creditChargeDisabled: true`，后台积分列显示 `0（扣分关闭）`。
- `/api/chat` 调 `assertUserCanUseCredits(user, "text", metadata)`，因此反推/优化按 `metadata.creditSource = image_prompt_reverse / prompt_optimization` 走独立开关，不再被 `chargeText` 混管。`/api/agent-plan`、`/api/image`、`/api/video` 也已按对应 kind 校验开关。`chargeCredits()` 仍会记录 usage、美元、人民币和 0 分流水。
- 后台 `生成记录` 页面已从占位做实，组件为 `src/app/admin/admin-records-panel.tsx`。页面样式、统计卡、搜索、分页、展开区和弹窗规格与用户管理/积分管理保持一致。顶部五张卡：`历史对话总数 / 图片生成总数 / 视频生成总数 / 上传图片总数 / 上传文件总数`。主表列：`ID号 / 用户 / 历史对话 / 图片生成 / 视频生成 / 上传图片 / 上传文件`。
- 生成记录主表排序已改为按五类记录最新时间排序：历史对话、图片生成、视频生成、上传图片、上传文件。只要任一类有新数据，该用户就排前面。
- 生成记录展开区为四列。第一列：`对话流图片 / 对话流视频 / 资产库图片 / 历史对话 / 工作区保存`。其中 `对话流图片` 包含对话流生成图片和对话流上传图片；`资产库图片` 包含资产库生成图片和资产库上传图片。用户管理中对应文案也统一为 `对话流图片 / 对话流视频 / 资产库图片`。
- 生成记录第二列为生成列表：`对话流生成图片列表 / 对话流生成视频列表 / 资产库生成图片列表`。这三个列表已合并为同一个 `生成列表` 弹窗，左侧三分类，点哪个按钮就默认定位哪个分类。记录来源改为 workspace 真实媒体和资产，不再依赖积分流水，确保后台记录完整；扣分是否正常只影响扣分显示，不影响记录是否出现。
- 生成记录第三列为上传列表：`对话流上传图片列表 / 对话流上传文件列表 / 资产库上传图片列表`。这三个列表已合并为同一个 `上传记录` 弹窗，左侧三分类，点哪个按钮就默认定位哪个分类。顶部汇总显示 `对话流上传图片 / 对话流上传文件 / 资产库上传图片`，不再显示生成图片/视频。
- 生成记录中间两列的列表弹窗右侧表格去掉 `消耗美元 / 折算人民币`，改为 `复制提示词` 列。有提示词才显示 `复制提示词` 按钮，点击后显示 `已复制`。生成媒体显示普通 `提示词`；上传图如果已反推提示词，显示蓝色 `反推提示词` 标识和反推内容，也支持复制。无提示词显示 `--`。
- 生成记录大图弹窗入口 `对话流图片`、`资产库图片` 已包含上传图和生成图。由于该弹窗左侧已经显示大图，右侧缩略图取消悬停大图预览；后台其它明细缩略图悬停预览仍保留。删除标识继续一致显示 `用户已删除 删除时间`。
- 本轮确认后台记录总原则：后台生成记录必须全，只要用户生成或上传过，后台就要显示；记录来源以 workspace 真实历史、媒体、资产、上传为准。扣分流水只做附加数据。若后续出现扣分异常，应只在扣分列显示 `0（扣分异常）`，不能让生成/上传记录消失。旧记录不强行修复，只保证后续新记录遵守该准则。
- 本轮验证：多次 `npm run lint` 通过，只剩 `src/components/chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。期间因 Prisma DLL 被本机 3000 端口 dev server 占用，停止该进程后 `npx prisma generate` 成功，`npx prisma migrate deploy` 已应用新迁移。

### 2026-06-01 本轮追加：后台积分明细规则收敛、反推/优化闭环、删除/上传记录

- 后台积分管理三类明细继续收敛为“新数据精确绑定，旧数据不猜”。`对话流消耗积分详细` 顶部汇总改为 `生成图片 / 生成视频 / 上传图片 / 上传文件`；`资产库消耗积分详细` 顶部汇总改为 `生成图片 / 生成视频 / 上传图片`；`反推提示词` 顶部只显示 `反推图片`；`优化提示词` 顶部显示 `优化次数 / 消耗Token`。
- `对话流消耗积分详细` 新增 0 分上传记录。用户消息里的 `/generated/upload_image/...` 会显示为上传图片，`uploadedFiles` 会显示为上传文件；上传类行的 `积分扣除 / 消耗美元 / 折算人民币` 统一显示 `--`，参数显示 `对话流上传` 或 `对话流上传文件`。
- `资产库消耗积分详细` 新增 0 分资产库上传图片记录，按 `角色 / 场景 / 分镜` 分类显示图片、图片名称、`资产库上传` 参数；上传类行的积分/美元/人民币也统一显示 `--`。
- 后台所有图片缩略图新增悬停大图预览组件 `src/app/admin/admin-hover-image-preview.tsx`。悬停时按浏览器边界自动定位，尽量大且不出边界。已接后台积分明细、用户管理媒体列表、历史对话图片缩略图。
- 用户删除前端图片、资产或对话后，后端积分流水不删除。后台明细会保留对应记录：文件名/图片名照常显示，后面追加红字 `用户已删除 删除时间`，参数行照常显示。资产进入回收站时使用真实 `deletedAt`；对话流单图删除目前没有独立 `deletedAt` 时用扣费/生成时间兜底。
- 修复资产恢复逻辑。删除资产时写入 `previousType`；从回收站恢复时优先恢复原分类。旧数据没有 `previousType` 时按 `systemName` 兜底：`角色xx -> character_image`、`场景xx -> scene_image`、`分镜xx -> shot_image`。本机已修复 `角色57` 从 `other` 回到 `character_image`。
- 资产生成失败卡和任务卡持久化已加强。`assetGenerateJobs` 会写入 workspace，刷新后失败卡恢复；刷新中的生成任务会显示为失败卡并提示刷新中断。删除某个成功生成资产时，同 URL 的成功任务卡也会清掉，避免删除后角色页仍残留图片。
- 图片模型额外返回图规则已按场景拆分。对话流图片生成会把模型额外返回图全部返回前端、写入工作区并分页显示；额外图不计费。资产库生成会在同一响应多图中只选一张最匹配当前目标比例/尺寸的图片，后端日志打印 `multiple images returned, selected best match`，额外图不进入资产库也不显示。
- 图片生成“成功响应但无图片”时，后端会记录真实原因：`message.content / refusal / finish_reason / native_finish_reason / responseId / model`。前端错误会包含 `图片平台没有返回图片：真实原因...`。资产生成外部失败卡不显示原因，点进生成页才显示完整原因。
- 反推提示词规则已重新定实。只有上传图才显示 `反推提示词` 按钮，包括资产库上传和对话流上传；生成图不显示。上传图名称使用图片本身名称或用户上传时改的名称。反推成功后该图不再显示反推按钮，改为正常提示词显示、复制、使用提示词。每张上传图只能成功反推一次。
- 反推提示词模型兜底顺序为 `openai/gpt-5.5 -> openai/gpt-5.4 -> bytedance-seed/seed-2.0-lite`。前两轮失败不写失败流水；三轮都失败时写一条 0 分失败流水，前端预览页红字显示 `服务器繁忙，请稍候再试！`，后台显示图片、图片名称和红字失败原因。
- 优化提示词规则已做实。优化提示词可成功多次，每次成功都正常扣分并写 `outputPrompt`；每次模型尝试失败都写 0 分失败流水。前端优化失败不弹提示，只结束 loading；后台 `优化提示词` 明细显示成功提示词或失败原因，旧的缺 `outputPrompt` 的推测数据不再显示。
- `反推/优化提示词消耗积分详细` 左侧顺序固定为上 `反推提示词`、下 `优化提示词`。反推明细只显示有精确 `mediaUrls` 且有 `outputPrompt` 或失败原因的新数据；旧的无 URL/无 outputPrompt 反推流水不再按时间猜图。优化明细只显示有 `outputPrompt` 的成功记录或有 `failureReason/status=failed` 的失败记录。
- 后台用户管理同步删除状态。用户管理里的历史对话、对话流生成图片/视频、资产库生成图片，如果用户已删除，仍保留记录并红字显示 `用户已删除`；缩略图底部也显示 `用户已删除`。
- 本轮验证：多次 `npm run build` 通过，多次 `npm run lint` 通过；当前只剩 `src/components/chat-workbench.tsx` 原有两个 warning：`Unused eslint-disable directive` 和 `showInputTip` 依赖提示。

### 2026-06-01 本轮追加：后台积分明细三类弹窗和媒体扣费绑定规则

- 后台积分管理的 `对话流消耗积分详细` 继续细化。左侧对话标题前显示稳定对话编号，例如 `【d23】生成一个机器人`。右侧改为表格：`生成内容 / 积分扣除 / 消耗美元 / 折算人民币`。表格上方显示 `图片数量 / 视频数量`，右侧显示 `积分扣除` 汇总。
- `对话流消耗积分详细` 右侧媒体行显示系统名；如果用户改过名，显示为 `系统名 / 用户改名`。媒体参数行按前端同款结构显示：`模型 | 比例 | 尺寸 分辨率 | 时长`，时间跟在参数后面。失败项左侧灰框显示 `生成失败`，右侧红字显示真实失败原因，下面只显示时间。
- `对话流消耗积分详细` 修复旧流水误挂问题。旧流水如果是明确的 `requestId:image:序号`，但找不到对应媒体 URL，不再退回挂到同批第一张图，避免一张图看起来被多次扣费。新数据优先按 `CreditLedger.metadata.mediaUrls / allMediaUrls / extraMediaUrls` 精确绑定媒体。
- 图片生成链路规则已固化：`/api/image` 成功后会把 `mediaUrls`（计费媒体）、`allMediaUrls`（实际交付全部媒体）、`extraMediaUrls`（额外返回但不计费媒体）、`requestedImageCount / returnedImageCount / billableImageCount / delivered` 写入扣费流水 metadata。对话流图片生成不丢弃模型额外返回图，前端和后台都应显示，额外不计费图显示 `-0 / $0.0000 / ¥0.00`；资产库生成只显示最匹配的一张。
- 后台积分管理的 `资产库消耗积分详细` 已做实。左侧分类固定顺序为 `角色 / 场景 / 分镜`。右侧复用同款表格和汇总行。新数据优先用扣费流水 URL 精确匹配资产图；旧数据没有 URL 时，按同用户、同分类、生成时间最接近的资产图兜底匹配。资产参数从资产 `previewMeta` 取，显示模型、比例、尺寸、分辨率。
- 后台积分管理的 `反推/优化提示词消耗积分详细` 已做实。左侧分类为 `反推提示词 / 优化提示词`。反推提示词行会显示对应图片；新数据优先用 `metadata.mediaUrls` 精确匹配，旧数据按时间就近匹配但同一弹窗内不会重复使用同一张图片。
- `/api/chat` 现在会把模型输出的整理后提示词写入扣费 metadata 的 `outputPrompt`。反推提示词请求会写 `metadata.mediaUrls`，优化提示词请求会写 `metadata.originalPrompt`。后台反推/优化明细主标题优先显示 `outputPrompt`；旧反推数据没有 outputPrompt 时，用匹配图片的 `sourcePrompt` 兜底。长提示词在当前列宽内换行，缩略图与文字顶部对齐。
- 注意：旧 `CreditLedger` 里很多资产库生成、反推提示词、优化提示词流水只有 `creditSource`，没有媒体 URL 或输出提示词。后台已做兜底匹配，但旧数据不能保证 100% 精确；新数据应依赖服务端写入的 metadata 精确绑定。
- 本轮验证：多次 `npm run build` 通过，多次 `npm run lint` 通过。仍只剩原有两个 warning：后台积分明细 `<img>` 的 Next warning，以及 `chat-workbench.tsx` 原有 `Unused eslint-disable directive`。

### 2026-05-29 本轮追加：生成扣费闭环和错误编码

- 新增错误编码工具 `src/lib/error-code.ts`。主生成接口失败会返回类似 `（B_1）网络连接异常，请稍后重试。`，后端日志使用同一个 `[B_1]` 编码并脱敏 API Key，方便用户反馈编码后快速定位问题。编码保存在本地 `.runtime/error-code-counter.txt`，该目录已加入 `.gitignore`。
- 错误编码计数器在同一 Node 进程内通过 Promise 队列串行递增，避免并发失败时撞码。注意该计数器是本地运行时文件，不进 Git；换机器后从 `B_1` 重新开始是可接受的本地排查行为。
- 生成扣费规则重新确认：重要信息必须由服务端处理，前端只负责展示。供应商返回 usage/cost 才扣积分；只要扣积分，必须把费用、积分、媒体结果绑定写入数据库；后台明细应优先读取扣费流水里绑定的媒体 URL。
- 安全开发总规则已确认：凡是涉及数据库写入、积分/扣费、用户状态、权限、禁用、资产归属、生成记录、后台管理、供应商返回结果等重要信息，必须由服务端验证、计算和写入；前端不能作为可信来源，只负责展示服务端结果和发起用户操作。后续新增功能必须先设计服务端接口和服务端校验，不允许只在前端改 local state 后再同步关键数据。
- `/api/image` 恢复为服务端扣费闭环：后端生成并保存图片成功后才调用 `chargeCredits()`；扣费流水 `metadata` 会写入 `mediaUrls`、`requestedImageCount`、`returnedImageCount`、`billableImageCount` 和 `delivered`。Gemini 额外返回图可展示，但 `billableImageCount` 不超过本次请求数量，避免额外图把图片数量和扣分算高。前端已移除临时的 `/api/credits/charge-generation` 生成后主动扣费方案。
- `/api/video` 在轮询成功并得到视频 URL 后，扣费流水 `metadata` 写入 `mediaUrls`、`remoteMediaUrls` 和 `delivered`。本地保存失败时仍可用远程 URL 作为交付 URL。
- 前端已移除“生成后再主动扣费”的临时方案，避免前端参与关键扣费逻辑。前端继续只接收接口返回的 `credit` 用于刷新余额和会话用量。
- 后台 `对话流消耗积分详细` 优先读取 `CreditLedger.metadata.mediaUrls` 显示媒体，旧流水没有绑定媒体且当前工作区也匹配不到 `requestId` 的孤儿图片/视频扣费不再混入媒体明细。
- 用户中心 `/api/credits/me` 的普通对话图片/视频数量优先按工作区当前 assistant 消息真实成功媒体 URL 去重统计：图片读 `imageResultSlots` 中 `type=image` 的 URL，视频读 `videos / videoUrl`。这修复了 d23 用户中心显示 `15/0` 但实际只有 `12/0` 的问题。资产库三类生成数量也优先按工作区 `assets` 中 `librarySource: asset_generation` 的真实资产数量统计。
- 修复失败红字规则。单张图片/单个视频失败时立即更新 `message.error` 并显示红字，不再等整批任务全部结束。没有真实原因时只显示 `图片生成失败，请稍后再试。` 或 `视频生成失败，请稍后再试。`；不再显示 `有 X 张图片生成失败。`。全部失败项都点重新生成时红字隐藏；只重试部分失败项时旧红字保留；重试失败会显示最新原因。资产库生成页和资产库外部失败任务卡同步了该清洗逻辑。
- 内部技术错误清洗规则已调整。`Maximum call stack size exceeded / RangeError / TypeError / ReferenceError / stack / trace / HTML` 等不展示给用户，统一显示 `任务失败，请联系管理员！`；后端日志保留原始错误。`curl / schannel / closed abruptly / command failed` 这类传输错误显示为 `网络连接异常，请稍后重试。`。
- 修复 data URL 保存栈溢出：`src/lib/local-assets.ts` 的 `saveDataUrlAsset()` 和 `saveUploadedImageAsset()` 不再用正则匹配整段超长 base64，改为按逗号切分 data URL，避免大图保存时触发 `Maximum call stack size exceeded`。
- 左侧运行态动画位置已按用户要求调整。对话生成中时，具体历史对话行右侧三点按钮临时隐藏，三点位置显示蓝色九宫格动画；切到资产库或工作流导致历史二级列表不可见时，动画显示在一级菜单 `对话模式` 右侧。资产库生成中时，对应分类右侧数量临时隐藏并显示动画；切出资产库时，动画显示在一级菜单 `资产库` 右侧。
- d22 等待卡问题已修复。失败槽位残留 `retryingStartedAt` 时，如果没有对应运行中的 pending request，不再显示等待卡；任务归档会清理失败槽位里的 `retryingStartedAt`。本机已清理 `ID_779117` 的 d22 残留失败槽位。
- d23 排查结论：`Gemini 3.1 Flash` 生成机器人那批实际只发 4 次请求，数据库也只有 4 条对应流水；模型额外返回导致旧界面显示 7 张，额外 3 张没有单独扣费证据。另一批 `GPT-5.4 Image 2` 孤儿流水前缀为 `7c8517bb...`，3 笔共 54 分，数据库有 usage/usd/token，说明当时按供应商返回费用扣过分，但当前工作区没有对应媒体消息。后台明细已隐藏这种无法绑定媒体的孤儿图片流水，但全局消耗总数仍包含真实历史流水。
- 本轮验证：`npm run lint` 通过，仅剩原有两个 warning：后台积分明细 `<img>` 的 Next warning，以及 `chat-workbench.tsx` 原有 `Unused eslint-disable directive`。

### 2026-05-29 本轮追加：对话流媒体命名、Gemini 多图分页和预览一致性

- 工作台历史会话新增稳定对话编号 `conversationCode`，格式为 `d1 / d2 / d3...`。旧会话会按 `updatedAt` 从早到晚补编号；删除会话后编号不复用。工作区状态新增 `nextConversationNumber`，用于继续分配下一个编号。
- 对话流模型生成的图片/视频新增永久系统名映射 `mediaSystemNames`，保存在 assistant 消息里，按当前对话编号递增：图片为 `image_1_d22 / image_2_d22...`，视频为 `video_1_d22 / video_2_d22...`。生成/重试时会先扫描当前对话已有 `mediaSystemNames`，跳过已占用编号，避免重名。
- 资产新增可选字段 `systemName`。模型生成资产初始 `name = systemName`；用户后续重命名只应改 `name`，`systemName` 用于后台和排查。资产库生成仍使用中文系统名 `角色1 / 场景1 / 分镜1`，并写入 `systemName`。
- 上传图不参与 `image_... / video_...` 系统编号。对话流上传图和资产库上传图都保留上传时的名字；预览参数位置显示 `对话流上传` 或 `资产库上传`，提示词区显示 `暂无提示词`，显示蓝色 `反推提示词` 按钮。
- 已移除/收敛多套预览数据来源。现在同一张媒体的预览规则为：名称优先读资产库当前记录，资产库没有时读消息 `mediaSystemNames`；提示词和参数统一按 URL 回查对话流 assistant 消息，图片读 `imagePrompts[url]`，视频读 `videoPrompts[url]`，参数读 `getPreviewMediaMeta()`。目标是对话流预览和资产库预览同图完全一致。
- 图片结果分页规则已调整：`Gemini 3.1 Flash Image Preview` 和 `Gemini 3 Pro Image Preview` 允许出现额外多图分页。用户选 `4张` 时第一页固定显示用户选择数量内的前 4 张，模型额外返回的第 5 张及以后放后续页。其它模型每个单图子请求只保留第一张，不显示参数页分页。图片区域底部旧分页已移除，只保留参数行分页。
- 预览缩略图列表已改为按 `imageResultSlots` 顺序构建，避免 `message.images` 顺序和对话流实际卡片顺序不一致导致切图时名称/提示词错位。
- 本轮临时修复了本地数据库用户 `ID_779117` 的 `d22` 会话：该会话原本只有 1 张图写入工作区，实际最后 4 张文件在 `public/generated/images` 中。已把这 4 张补回 d22 的 `images`、`imageResultSlots`、`mediaSystemNames` 和资产库记录，名字为 `image_1_d22` 到 `image_4_d22`。
- 本轮多次 `npm run lint` 通过，仍只有两个原有 warning：后台积分明细 `<img>` 的 Next warning，以及 `chat-workbench.tsx` 原有 `Unused eslint-disable directive`。`npm run build` 多次通过；其中有两次因 Google Fonts `Geist Mono` 网络请求失败而失败，不是代码错误。

主要文件：`src/components/chat-workbench.tsx`。

### 2026-05-29 本轮继续：后台用户/积分管理、弹窗滚轮隔离和对话流积分明细

- 后台用户管理媒体预览弹窗已统一调整：`对话流生成图片 / 对话流生成视频 / 资产库生成图片` 左侧媒体下方先显示参数，再完整显示提示词。提示词不再两行截断，内容过长时滚动弹窗内部。
- 资产库生成图片弹窗中，无生成参数的上传图参数位置显示 `资产库上传`。如果上传图通过反推得到提示词，则提示词前加蓝色描边 `反推提示词` 标识，带 `RiQuillPenAiLine` 图标。
- 新增通用 `useBodyScrollLock`。打开弹窗时锁住页面 body 滚动，并给主要遮罩加 `overscroll-contain`，避免鼠标滚轮穿透到弹窗背后的页面。已接首页登录抽屉、工作台资产上传、资产生成、用户中心、重命名、媒体预览、文档预览、后台用户历史/媒体弹窗和后台调积分浮层。
- 后台用户管理 `最后登录时间` 改为显示 `User.lastLoginAt` 与最新 `Session.lastSeenAt` 中更晚的值。用户管理排序同步改为取 `lastLoginAt / Session.lastSeenAt / workspace.updatedAt / createdAt` 的最大时间，保证最新活跃用户排前面。
- 用户管理和积分管理展开三角统一移动到列表最前面。积分管理行展开改为可多个同时展开，不再互斥。
- 积分管理表头 `最后活跃时间` 改为 `最后积分变动时间`。该时间取用户最新一条 `CreditLedger`，包括模型消耗、注册送积分、后台加分、后台减分和后续其它积分流水。
- 积分管理展开区重排为三列灰底横条。第一列为 `当前积分 / 已赠送积分 / - 注册送积分 / - 后台调整赠送积分`；第二列为 `已消耗积分 / - 对话流消耗积分详细 / - 资产库消耗积分详细 / - 反推/优化提示词消耗积分详细`；第三列为 `消耗Token / 消耗美元 / 折算人民币`。
- 展开区明细前统一用加粗 `-` 标识层级；可点击项文字保留下划线，但 `-` 不带下划线。展开区数值统一普通颜色，主表红绿颜色不变。
- 后台积分数据新增拆分字段：`signup` 汇总为注册送积分，`admin_adjust` 汇总为后台调整赠送积分；对话流、资产库生成、反推/优化提示词三类消耗分别聚合。
- `对话流消耗积分详细` 已接真实弹窗。弹窗尺寸和左侧列表结构复用用户管理历史对话弹窗。左侧以当前工作区 `sessions` 为准，按前端历史列表标题和顺序显示，只展示有对话流积分流水的会话。
- 对话流积分详细右侧显示：第一条 `对话积分`，第二条 `规划积分`，下面是该对话流的图片/视频积分列表。资产库生成、反推、优化提示词不进入该弹窗。
- 对话流积分详细里的图片/视频积分项会尝试显示缩略图。后台从工作区 assistant 消息的 `requestId` 建媒体 URL 索引，支持 `requestId:image:序号`、`requestId:video:序号`、基础 `requestId`、`requestId:image`、`requestId:video` 兜底。
- 多图部分失败任务会在对话流积分详细里补失败占位。若工作区消息有 `failedImageCount` / `imageResultSlots`，失败项显示同缩略图尺寸的灰框，中间写 `生成失败`，扣分显示真实值，失败项为 `0`。
- 已确认所有新的对话流扣费接口都会带 `conversationId` 和 `conversationTitle`：`/api/agent-plan`、`/api/chat`、`/api/image`、`/api/video`。以后新对话流积分应能匹配当前工作区历史；旧历史或未接积分流水时期的数据不会补显示。
- 本轮验证：多次 `npm run lint` 通过，无错误。仍有两个 warning：`chat-workbench.tsx` 原有 `Unused eslint-disable directive`，以及后台积分明细缩略图使用原生 `<img>` 的 Next warning。本轮未运行 `npm run build`。

主要文件：`src/app/admin/page.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/app/admin/admin-credits-panel.tsx`、`src/app/page.tsx`、`src/components/chat-workbench.tsx`、`src/components/use-body-scroll-lock.ts`。

### 2026-05-28 本轮继续：后台积分设置保护、tooltip 统一和用户中心积分明细

- 后台积分管理设置区布局继续调整。`美元汇率 / 1人民币兑换积分 / 注册送积分` 三项的开关已移到输入框同一行右侧；输入框固定变窄，设置项总宽度保持不变；整条设置栏强制同一行不换行。
- `选择积分消耗项` 下方三项文案去掉 `扣` 字，改为 `对话/规划 / 图片 / 视频`。按钮容器去掉固定最小宽度和 `justify-between`，开关直接跟在文字后面；第一项左内边距去掉，保证和上方小标题左对齐。
- 后台积分设置新增有效值保护。`美元汇率` 只接受 `1.00-20.00` 且不支持负数；`1人民币兑换积分` 只接受 `10 / 100 / 1000 / 10000` 四个整数值；`注册送积分` 按当前兑换比例折算价值不能超过 `200人民币`。
- 三个设置项都按“上一次启用过的有效值”回退。只有点击启用且输入合法才会成为新的有效值；无效值点击启用会回到上一次启用过的有效值。修复过输入 `500` 先经过 `5` 导致错误回退到 `5.00` 的问题。
- 后端 `src/lib/credits.ts` 的 `updateCreditSettings()` 也增加同样保护：无效汇率、无效兑换比例、超额注册送积分不会写入数据库，会保留当前数据库有效值或安全默认值。
- 后台积分设置三项后面新增信息图标和黑色说明框，分别说明汇率范围、兑换比例允许值、注册送积分上限规则。`选择积分消耗项` 的说明框也保留。
- 前台新增/调整通用 `BlackHoverTooltip`，统一黑色说明框样式，并增加浏览器边缘检测：左右空间不足时自动左/右对齐；顶部空间不足时可向下显示。AI 反馈按钮、文档预览复制/下载、预览页 `实际尺寸 / 适合尺寸` 等使用该黑框。
- 按用户要求，以下位置已去除悬停说明：对话流图片/视频模型按钮、资产生成模型按钮、参考图缩略图、输入框上传图缩略图、资产生成引用图缩略图。保留原本点击、插入和显示功能。
- 用户中心 `我的积分` 表改为同时支持增加和扣除。表头 `积分消耗来源` 改为 `积分来源`，`扣除` 改为 `积分变动`。增加积分绿色 `+数字`，扣除积分红色 `-数字`。
- `/api/credits/me` 现在会返回增加流水。注册送积分和后台正向调积分会逐条显示，不合并；后台调积分在前台显示文案改为 `赠送积分`。
- 后台负向调积分仍记录进 `CreditLedger.direction = "increase"` 的负值流水，并影响余额和上方 `已赠送积分` 净值，但不会显示在用户中心积分明细表。`已赠送积分` 现在统计所有增加方向流水的净值，即注册送分 + 后台加分 - 后台减分。
- 后台积分管理统计卡文案 `消耗积分` 改为 `消耗积分总数`。
- 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning；涉及 tooltip/积分流水的中间版本跑过 `npm run build` 通过，最后统计卡小文案改动只跑了 lint。

### 2026-05-28 本轮追加：资产生成规则强化、我的积分显示、后台用户/积分管理和禁用拦截

- 资产库生成里的 `单人9:16` 角色规则已强化：必须生成单人站立正面全身角色设定图，纯白背景，正面朝镜头，从头顶到脚底完整，脚不能裁切；禁止场景、房间、街道、家具、道具堆叠、复杂背景、半身、头像、侧身、背身、3/4 侧身、坐姿、躺姿、多人。
- 资产库生成规则对 `bytedance-seed/seedream-4.5` 增加专用分支。只影响资产库 `角色生成 / 场景生成 / 分镜生成`，不影响对话流图片/视频和 Agent 自动生成。Seedream 角色单人更强制纯白全身正面；角色三视图继续用纯正向规则；场景单图和四宫格更强制纯场景、无人物；分镜更强制影视单帧截图，避免变成设定图、海报、拼贴、多宫格。
- 资产库生成命名规则已改为固定递增：角色生成永远 `角色1 / 角色2...`，场景生成永远 `场景1 / 场景2...`，分镜生成永远 `分镜1 / 分镜2...`。不再从提示词提取角色名、动物名、场景名，也不再出现 `角色三视图`、`场景多角度` 等名字。该改动只影响资产库生成，不影响对话流资产命名，也不影响资产库上传图片命名。
- 所有等待卡左上百分比显示已改为非线性进度：`0-30秒` 快速到约 `45%`，`30-90秒` 到约 `75%`，`90-180秒` 到约 `95%`，`3分钟后` 固定停在 `95%-99%` 之间的一个数。只改显示进度，不改真实轮询、任务状态或完成逻辑。
- 用户中心 `我的积分` 来源显示已调整：资产库三类生成显示为 `资产库_角色图片 / 资产库_场景图片 / 资产库_分镜图片`，三者图标统一用资产库第一态 `RiFolderLine`；普通对话来源图标改为对话第一态 `RiChat3Line`；`图片反推提示词` 和 `优化提示词` 保持不变。
- 后台用户管理每页从 `10` 条改为 `15` 条。用户管理排序已改为最近活跃优先，顺序为 `lastLoginAt` -> 最近 `Session.lastSeenAt` -> `workspace.updatedAt` -> `createdAt`，避免测试假用户因创建时间新一直排第一。
- 后台用户管理展开区文案调整：`生成图片 / 生成视频` 改为 `对话流生成图片 / 对话流生成视频`，并新增 `资产库生成图片`。点击 `资产库生成图片` 打开媒体预览弹窗，右侧顶部用三按钮切换 `角色 / 场景 / 分镜`，不显示原 `图片列表` 标题；数据从 workspace JSON 的 `assets` 中读取，只取 `librarySource: "asset_generation"` 的角色/场景/分镜图片。
- 后台用户管理 `禁用 / 启用` 按钮已做实。新增 `/admin/api/users/disabled`，点击按钮会更新 `User.disabled` 并阻止事件冒泡，不再触发展开行。禁用用户时会删除该用户所有前台 Session。
- 禁用账号前台拦截已做实。`getCurrentUser()` 遇到 `User.disabled` 会删除该用户所有 Session 并清 Cookie；`/api/auth/check-email`、`/api/auth/login-password`、`/api/auth/verify-code` 遇到禁用用户统一返回红字错误 `用户名错误！请联系管理员！`。工作台会每 `5秒` 和窗口聚焦时检查 `/api/auth/me`，用户被禁用后会退回首页。模型接口现在没有有效登录用户会直接禁止调用，不再把禁用后的 `null` 用户当游客放行。
- 后台积分管理页已从按对话聚合改为按用户聚合，每页 `15` 条。表格列为 `ID号 / 用户 / 当前积分 / 已赠送积分 / 已消耗积分 / 最后活跃时间 / 调积分`。`最后活跃时间` 指该用户积分流水最后变化时间。三列积分宽度统一调到 `200px`，并尽量压缩用户列。
- 后台积分管理统计卡调整：`增加积分总数` 改为 `赠送积分总数`；`消耗美元` 和 `消耗人民币` 合并成一张卡，标题为 `消耗美元/折算人民币`，数值上下两行显示；统计卡高度降到 `98px`，数值下对齐。
- 后台 `调积分` 已做实。新增 `/admin/api/credits/adjust`。点击每行 `调积分` 会在按钮左侧弹出无黑底遮罩的小计算器浮层，约 `230x280`，点击其它区域关闭，支持数字、负号和退格。正数加积分，负数减积分，最低扣到 `0`。后台调积分只影响 `赠送积分`：无论正负都写 `CreditLedger.direction = "increase"`，负数写负值；不写 `consume`，所以不影响 `已消耗积分`。前端模型调用扣费才会影响消耗积分。
- 后台积分设置区已重做：去掉白底和保存按钮，分成四段并用竖线分隔。`美元汇率 / 1人民币兑换积分 / 注册送积分` 各自带开关，关闭时输入框亮起可编辑，开启后输入框灰掉并立即保存当前值。`扣对话/规划 / 扣图片 / 扣视频` 各自独立开关，打开代表扣积分，关闭代表不扣，点击后立即保存。扣费说明区标题为 `选择积分消耗项`，后面有 `RiInformation2Line` 图标，悬停显示黑底说明框。
- 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning。本轮未重新运行 `npm run build`。

### 2026-05-28 本轮对话：优化/反推积分来源、输入禁用、通用 Loading、预览缩略图分页和预览尺寸修复

- 用户要求后续继续简单直接。本轮主要围绕优化提示词、反推提示词、预览页缩略图和预览尺寸体验修复。
- 我的积分新增统一来源 `优化提示词`。新增 `CreditLedger.metadata.creditSource = "prompt_optimization"`，资产生成里的优化提示词、对话流图片/视频专业模式里的优化提示词全部聚合到这一条，不再散到普通对话或角色/场景/分镜生成来源里。该来源为纯文本来源，图片/视频列显示 `--/--`。
- `src/app/api/credits/me/route.ts` 已识别 `prompt_optimization` 并显示为 `优化提示词`；用户中心积分来源图标使用 `RiQuillPenAiLine`。
- 对话流图片/视频专业模式优化提示词时，整个主输入框禁用：正文、上传、`@`、模式、模型、比例、数量/时长、发送、清空输入框均不可用；输入框整体变淡。修复过一次 `Cannot access 'isThinking' before initialization`，最终把 `isMainInputDisabled` 放到 `isThinking` 定义之后。
- 资产生成页优化提示词时，右侧整体禁用：比例、风格、模型、K 数、引用资产、优化提示词、清空输入框、输入框、参考图移除/点击、生成图片全部不可用；优化开始时会关闭已打开的 `@` 菜单和参数菜单。资产生成输入框没有文字时，`清空输入框` 也会像 `优化提示词` 一样禁用。
- 新增通用 `LoadingSpinner`，基于 `radial-gradient + conic-gradient + mask`，颜色为项目蓝 `#367cee`。当前用于优化提示词和反推提示词中间加载。用户给过参考 CSS：头部圆点 + 长渐变尾巴 + mask 挖空圆环；后续其它 loading 应复用该组件。
- 优化提示词中，对话流输入框和资产生成输入框中间都会显示通用 `LoadingSpinner`。
- 反推提示词时，预览页右侧整体禁用、变淡，并在右侧中间显示通用 `LoadingSpinner`；复制、使用提示词、反推按钮不可点。曾尝试让外部资产库缩略图也禁用并显示 Loading，但用户反馈未稳定实现，已按用户要求撤回：外部资产库缩略图反推时不再显示禁用态或 Loading。
- 预览页从资产库打开图片时，右侧缩略图只显示资产库当前分类/来源，不再混入当前对话流缩略图。修复过一次误判：不能用 URL 判断是否资产库预览，因为对话流图片也可能已入库；现在只用真实资产库 `id` 判断。
- 预览页缩略图区域滚轮逻辑已重做为分页缩略图。缩略图列表不再自由滚动，不再用 `scrollBy` 一点点移动；当前页只渲染一屏缩略图。滚轮只移动蓝色选中框，越过当前页最后/第一张时才整页切换；第一张继续向上不动，最后一张继续向下不动，不再首尾循环。上下按钮也改为整页翻，不再小幅滚动。
- 预览页缩略图整列都算缩略图区：上按钮、下按钮、缩略图之间空隙和缩略图列表区域的滚轮都会用于上下选图，不会落到主图缩放。
- 预览页缩略图增加分布式预加载。DOM 仍只渲染当前页；打开预览时后台预加载前两页图片缩略图，翻到后续页时继续预加载后两页；已预加载 URL 会记录，不重复加载。视频缩略图不额外预加载。
- 预览页主图切换尺寸问题经过多轮修复。滚轮切图曾出现固定异常比例、百分比 `100%` 但视觉不是适合尺寸、实际/适合按钮失效等问题。最终处理包括：切图时重置 `fit`、scale、pan、naturalSize、fitScale；给主图加 `key={id-url}` 强制重新挂载；给 `onLoad` 加当前图校验，避免旧图加载回调覆盖当前图；缓存图切换后主动读取当前 `<img>` 的 `naturalWidth/naturalHeight` 并重新计算适合比例。
- 预览页 `适合尺寸` 渲染最终恢复为按真实尺寸乘以 `previewFitScale` 渲染。曾短暂改成 `max-width/max-height`，但它只能缩小不能放大 512 小图，导致百分比显示正确但视觉不放大；已修复。现在小图也会按当前窗口适合比例放大。
- 预览页缩略图点击逻辑修复：点击已选中的缩略图不再做任何事，避免第二次点击触发重置导致图片异常放大。曾误以为是双击问题，已额外拦截预览区/缩略图区双击默认行为，但核心修复是“已选中再点不重置”。
- 预览页左上 `实际尺寸` / `适合尺寸` 按钮新增浏览器 tooltip：`显示图片的实际尺寸`、`显示适合屏幕的完整图片`。
- 本轮多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning；`npm run build` 通过。

### 2026-05-27 本轮后续：分镜生成、资产生成并发、专业模式优化提示词和使用量 UI

- `资产生成 > 分镜图片` 已做实，新增固定虚线入口 `分镜生成`，复用角色/场景同款全屏生成页，成功后写入 `资产生成 > 分镜图片`。
- 分镜生成内部强规则已接入：必须生成像电影/电视剧单帧截图的画面，不是角色设定图、场景设定图、海报、漫画格、分镜表或拼贴图；禁止字幕、文字、Logo、水印、UI、二维码、边框、分割线、网格、多宫格、画中画、海报标题和说明标签。
- 分镜比例菜单改为 `竖屏分镜9:16 / 横屏分镜16:9`，默认 `竖屏分镜9:16`。生成页参数行显示 `类型+比例 | 尺寸 + K数 | 风格`，资产预览页显示完整模型和参数。
- 分镜图片命名规则改为 `分镜1 / 分镜2 / 分镜3...`。只影响 `shot_image`；`shot_video` 仍保留旧剧名/分镜编号规则。
- 资产生成页顶部 `角色生成 / 场景生成 / 分镜生成` 按钮已做实，点击等同对应虚线入口。图标跟左侧分类一致，按钮颜色加深，避免像禁用态。
- 资产生成任务已支持同分类并发。点击虚线框或顶部生成按钮会打开新的生成界面，只保留该类型草稿和参数；点击等待卡才回到对应那一次生成任务。关闭生成页不会停止任务。
- 资产生成任务卡会原位更新：生成中显示通用蓝色动态等待卡，左上角百分比、左下角已等待时间；成功后原地变图片卡；失败后原地变失败卡。失败卡右上角有关闭按钮可手动清除，中间可点击回失败页重试。
- 重试失败任务时，失败卡会原地变回等待卡；成功后同类型旧失败卡会被清掉。成功图会按任务自己的类型、提示词、参数和预览信息入库，不受用户后来打开的新生成界面影响。
- 成功后的原位图片卡补齐普通资产卡能力：左下角 `@资产名`，右下角三点菜单，支持 `重命名 / 移动到 / 删除`。同 URL 的普通资产列表卡会隐藏，避免重复显示。
- 资产卡三点菜单新增浏览器边缘判断。靠右边时一级菜单向左展开，`移动到` 二级菜单也向左展开，避免菜单被右边裁掉。
- 资产生成页生成中允许点右上角关闭和遮罩关闭。绿色 `图片生成已完成` 提醒层级提高到 `z-[9999]`，避免被全屏生成页遮挡。
- 对话流图片/视频专业模式输入框上方新增 `优化提示词` 按钮，放在 `清空输入框` 前，同规格且都使用通用蓝色。只在图片/视频模式且输入框有文字时显示。
- 专业模式 `优化提示词` 接真实 `/api/chat`，模型兜底顺序为 `openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。图片模式按图片提示词优化，视频模式按视频提示词优化，成功后替换输入框内容并聚焦。
- 右上角会话使用量浮窗已调整：`Token` 改为 `Tk`；美元和人民币使用 `money-dollar-circle-line`、`money-cny-circle-line` 图标，不再显示 `$ / ¥` 字符；顶部使用量按钮图标改为 `copper-diamond-line`，尺寸 `22px`，与左侧收起按钮一致。
- 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning；多次 `npm run build` 通过。

### 2026-05-27 本轮后续：资产生成扩展、资产预览反推、积分表重构

- 资产库 `资产生成 > 场景图片` 已做实，新增固定虚线入口 `场景生成`。点击后复用角色生成同款全屏生成页：左侧生成区、右侧 `360px` 固定设置栏，浏览器变窄不隐藏。
- 角色入口和右侧标题已统一从 `角色图片生成` 改为 `角色生成`。媒体预览页右侧栏也已取消 `xl` 隐藏，固定 `360px`，整体最小宽度 `920px`，和资产生成页一致。
- 资产生成页现在按当前生成类型复用同一套状态：角色生成写入 `资产生成 > 角色图片`，场景生成写入 `资产生成 > 场景图片`。曾修复场景页误显示角色图的问题：资产生成分类筛选必须同时匹配 `librarySource: "asset_generation"` 和当前 `type`。
- 场景生成规则已独立：单场景必须是纯场景，绝对不能出现人、人物、角色、人形、剪影、人群、脸、手脚；不能出现文字、Logo、水印、UI、二维码、边框、相框、分割线、海报排版等。若用户提示词提到人物，生成规则必须忽略人物，只保留场景信息。
- 场景生成比例菜单单独显示为 `单场景9:16`、`单场景16:9`、`四宫格16:9`。四宫格规则为一张 `16:9` 横图平均分四格，必须是同一场景的四个角度：正面、45度侧面、俯视、仰视；四格不能变成四个不同场景。
- 资产库生成界面的输入框提示词现在按生成类型保留草稿。关闭再打开会保留对应类型的提示词和上方参数选择，但仍清空上次生成结果、缩放、下载状态和菜单状态。角色生成和场景生成提示词互不覆盖。
- 资产库生成输入框中的 `@资产` 会像对话流输入框一样，在提示词上方显示一行图片缩略图。超出时出现左右按钮，两端渐隐；点击缩略图右上角 `X` 会移除对应 `@资产名`。角色生成、场景生成均生效。
- 资产库生成页参数行规则已改：生成页不显示模型，只显示 `类型+比例 | 尺寸 + K数 | 风格`，例如 `单人9:16 | 1440 × 2560 2K | 写实风格`、`四宫格16:9 | 2560 × 1440 2K | 3D风格`。资产库预览页显示完整参数：`模型 | 类型+比例 | 尺寸 + K数 | 风格`。对话流参数显示保持不变。
- 资产生成的风格强绑定已加硬清洗。优化提示词返回后、本地最终生图前都会清理与当前菜单风格冲突的词，并加当前风格前缀。写实会清掉 `Moebius / Jean Giraud / 吉卜力 / 宫崎骏 / 新海诚 / 皮克斯 / 迪士尼 / 2D / 动漫 / 插画 / 漫画 / 卡通 / 3D / CG / 虚幻 / Blender / Octane / V-Ray` 等；2D 和 3D 也会清掉相反风格词。
- 资产库生成里的 `优化提示词` 改成三级兜底：先用 `openai/gpt-5.5`，没返回或失败再用高级对话模型 `openai/gpt-5.4`，最后用普通对话模型 `bytedance-seed/seed-2.0-lite`。`/api/chat` 已允许 `openai/gpt-5.5` 作为特殊反推/优化模型。
- 上传图片或对话流上传图片的资产预览页已调整：右侧参数行位置显示 `资产库上传` 或 `对话流上传`，提示词区显示 `暂无提示词`。原 `使用提示词` 按钮改为通用蓝底 `反推提示词`，图标为 `RiQuillPenAiLine`。
- 图片反推提示词已接真实 `/api/chat` 看图请求，模型兜底顺序同优化提示词：`openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。反推成功后会把 `暂无提示词` 替换成反推结果，并写回当前资产；积分来源记为 `image_prompt_reverse / 图片反推提示词`。
- 资产预览页提示词标题栏新增无底复制图标按钮，放在 `使用提示词` 前面。点击复制当前提示词，成功后短暂显示灰色较大对勾，失败显示红色叉。
- 我的积分表格已重构：表头 `对话名称` 改为 `积分消耗来源`，第一列显示图标 + 来源。普通对话用对话图标 + 历史对话名；角色/场景/分镜生成分别聚合为单独一条；图片反推提示词单独聚合并使用 `RiQuillPenAiLine`。
- 积分流水来源用 `CreditLedger.metadata.creditSource` 标记：`character_image_generation`、`scene_image_generation`、`shot_image_generation`、`image_prompt_reverse`。旧数据没有来源标记，不能可靠拆分，保留在原对话记录里。
- 我的积分表格新增 `对话Token` 列。普通对话 Token 优先读取工作区 `UserWorkspaceState.state.sessions[].usageSummary.totalTokens`，没有再用 `CreditLedger.totalTokens`，没有则显示 `--`。普通对话扣除积分也用工作区 `usageSummary.credits` 兜底，避免旧数据出现 Token 很大但扣除 `-0`。
- 我的积分表格把 `图片` 和 `视频` 合并为一列 `图片/视频`，显示如 `22/0`、`9/--`、`--/--`。图片生成类来源视频为 0 时显示 `--`；图片反推提示词的图片/视频都显示 `--`。
- 我的积分 `最后活跃` 显示规则已改：24 小时内只显示时分；超过 24 小时且同一年显示月日；超过一年只显示年份。该列宽度已压到 `72px` 并强制不换行，多出的宽度给 `积分消耗来源`。当前表格列间已临时显示浅灰竖线，方便继续调列宽。
- 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning；多次 `npm run build` 通过。

### 2026-05-26 本轮后续：角色图片生成做实、角色规则、资产菜单和 @ 菜单重构

- `资产生成 > 角色图片` 的虚线入口文案已从 `生成角色` 改为 `角色图片生成`。
- 角色图片生成界面已改成真正全屏：不再保留顶部空白，不再有顶部圆角；右侧设置栏始终显示，固定 `360px`，浏览器变窄时不消失，整体最小宽度 `920px`。
- 右侧设置栏顶部新增左对齐标题 `角色图片生成`，前置图标使用和左侧 `角色图片` 一致的 `RiAccountBoxLine`，图标大小 `20px`。
- 角色生成界面打开规则已调整：每次点击 `角色图片生成` 都清空输入框、左侧生成结果、缩放/下载状态、`@` 菜单和优化状态；但四个菜单选择会保留上一次的值（比例、风格、模型、K 数）。
- 角色生成输入框已从 textarea 改成复用对话流的 `PlainMentionEditor`，支持有效 `@资产名` 蓝色显示、光标插入、手动输入 `@` 弹菜单。输入框正文使用 `13px / 22px`，左侧与上方按钮对齐，滚动条靠右贴边。
- 角色生成输入框顶部按钮为蓝色无底：`@ 引用资产`、`优化提示词`、`清空输入框`。`清空输入框` 会清空当前角色提示词；生成中这三个按钮全部禁用。
- 角色生成页的 `@` 菜单已改为向左展开，宽度 `380px`，右侧对齐输入框右边，避免被右侧栏限制；只影响角色生成页，不影响对话流输入框。
- 角色生成页的 `@` 菜单逻辑已稳定化：点击 `@ 引用资产` 直接打开菜单，不再先插入 `@`；手动输入 `@` 也会打开；选择资产时若光标前有 `@xxx` 则替换，否则插入到当前光标位置。
- 全局 `@` 菜单已按新资产库结构重做：`角色图片` 只显示 `资产生成 > 角色图片`，`场景图片` 只显示 `资产生成 > 场景图片`，`分镜图片` 只显示 `资产生成 > 分镜图片`，`对话流图片` 只显示 `对话流资产 > 对话流图片`。不再显示 `待分类` 标签，不显示回收站和视频。
- 角色生成已接真实 `/api/image`。点击 `生成图片` 后左侧显示单张等待卡；成功后在当前生成页显示图片，不跳预览；失败后显示同尺寸失败卡并可原地重新生成。
- 角色生成成功后，左侧顶部按钮全部按预览页逻辑生效：`- / +` 缩放、百分比显示、`实际尺寸`、`适合尺寸`、下载。成功图不能点击，不进入预览页；实际尺寸模式下可拖拽平移，滚轮可缩放。
- 角色生成中右侧全部禁用：四个菜单、`@ 引用资产`、`优化提示词`、`清空输入框`、输入框、生成按钮；顶部关闭按钮和点击遮罩关闭也禁用。生成开始时会自动关闭已打开的菜单。
- 角色生成成功后会写入 `资产生成 > 角色图片`，并显示在 `角色图片生成` 按钮后面。资产对象写入 `librarySource: "asset_generation"`、`type: "character_image"`、`lockedType: true` 和预览参数。
- 角色生成 `优化提示词` 已接真实 `/api/chat` 的图片优化链路，但带有内部角色优化规则：只保留和优化角色相关信息，删除场景、剧情、镜头、视频、动作分镜、复杂背景、非角色主体等无关内容；优化结果会替换输入框内容。
- 角色生成内部强规则已接入，不显示在输入框：`单人9:16` 强制纯白背景、单人、全身站立、头到脚完整；`三视图16:9` 强制纯白背景和同一角色四视图。用户提示词与这些规则冲突时，以内部强规则为准。
- 角色生成风格已强绑定：`写实风格` 强制写实摄影感并禁止 2D/动漫/插画/卡通/3D/CG；`2D风格` 强制 2D/插画/动漫并禁止写实摄影/3D/CG；`3D风格` 强制 3D/CG/三维渲染并禁止写实摄影/2D/动漫/插画。该规则只内部拼接，不回写输入框。
- 三视图规则按模型拆分。`GPT-5.4 Image 2` 和 `Gemini 3.1 Flash` 使用严格参考板规则；`Gemini 3 Pro` 使用带负向约束的自然横排规则；`Seedream 4.5` 使用纯正向描述，去掉 `分隔线/边框/表格线/网格线/四宫格/no divider` 等容易反向触发的词，改为“一整张连续的16:9横向纯白摄影棚角色参考照，白色背景连续贯通，四个同一角色自然横向并排”。
- 当前模型实测结论：`GPT-5.4 Image 2` 和 `Gemini 3.1 Flash` 对三视图规则较稳定；`Gemini 3 Pro` 和 `Seedream 4.5` 对四视图、全身不裁切、侧面不转头和无分隔线的服从度较弱，后续仍需继续观察并微调 prompt。
- 左侧 `资产生成` 分类里的 `分镜图片（首帧）` 已统一改为 `分镜图片`。代码与 handover 文档里的相关用户可见文案已同步更新；内部类型仍是 `shot_image`。
- 删除资产后普通分类不再继续显示回收状态资产。删除逻辑仍把资产改为回收站状态并显示 30 天倒计时；只有 `回收站` 页面显示这些资产。
- 资产卡片右上角文件夹分类按钮已移除。图片资产的移动分类功能合并到右下角三点菜单：一级菜单顺序为 `重命名`、`移动到 >`、`删除`；鼠标悬停 `移动到` 才在右侧显示二级菜单。对话流视频和回收站资产不显示 `移动到`。
- `移动到` 二级菜单保留原功能，内容为 `角色图片 / 场景图片 / 分镜图片 / 对话流图片`，并带标题 `移动位置`。分类菜单图标为 `16px`、文字为 `13px`、菜单项高 `36px`、宽度 `168px`。右下角三点操作菜单的图标/文字/行高也统一到相同规格，但宽度保持原样。
- 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning。中途在角色生成做实后跑过 `npm run build` 通过；后续 UI/文案小改动未重新跑 build。

### 2026-05-26 本轮对话：去除游客模式、资产库重构和角色图片生成界面占位

- 首页右上角已调整：未登录只显示 `登录`；已登录显示 `进入工作台` + 用户头像。`进入工作台` 的高度、字号、颜色、毛玻璃样式与登录按钮一致。
- 游客模式已从代码入口移除。`/workspace?guest=1` 不再强制游客模式，`src/app/workspace/page.tsx` 不再读取 `guest` 参数，`ChatWorkbench` 不再接收 `forceGuestMode`。未登录或认证失败时直接回首页，不再读取本地游客 `localStorage` 工作区。
- 因移除游客本地模式，工作台已删除游客模式下保存本地 `yinzao-sessions-v2 / yinzao-assets-v1 / yinzao-workflows-v1 / yinzao-input-settings-v1 / yinzao-intent-memory-v1 / yinzao-feedback-log-v1` 的效果逻辑和 `saveSessions()`。登录用户仍走 `/api/workspace-state` 数据库存储。
- `src/app/workspace/page.tsx` 已加 `export const dynamic = "force-dynamic";`，避免 Next 构建时预渲染工作台触发 `window is not defined`。
- 后台系统设置里的旧占位文案 `游客模式开关：下一版接入` 已改为 `访问控制：下一版接入`。
- 左侧主菜单 `资产管理` 改为 `资产库`。点击 `资产库` 会直接定位到 `资产生成 > 角色图片`，`全部资产` 页面已去掉。
- 资产库左侧二级结构重做为三组：`资产生成`、`对话流资产`、`回收资产30天删除`。小标题前都有圆点，右侧总数和子分类数量统一右对齐。
- `资产生成` 下有 `角色图片 / 场景图片 / 分镜图片`。这里只显示 `librarySource: "asset_generation"` 的图片，资产库上传图片会写入这个来源。
- `对话流资产` 下有 `对话流图片 / 对话流视频`。旧资产和后续对话流生成的图片/视频默认都属于这里，即没有 `librarySource: "asset_generation"` 的非回收站资产。
- 回收站仍共用。删除的所有资产都进入回收站，30 天删除和恢复规则保持不变。
- 后续对话流资产命名规则已改：图片为 `image_随机5-10位数字`，视频为 `video_随机5-10位数字`。旧资产不批量改名，避免影响历史 `@资产名` 引用。
- 对话流视频卡片右上角分类按钮已去除。对话流图片右上角分类按钮已做实，菜单为 `角色图片 / 场景图片 / 分镜图片 / 对话流图片`；切到前三项会移动到资产生成对应分类，切回对话流图片会回到对话流资产。
- `对话流视频` 页面卡片改为横向矩形，默认 `16:9`，大屏一行显示 4 个；其它图片和资产分类仍使用原正方形网格。
- 预览页 `使用提示词` 已统一：点击后把当前提示词填入输入框，关闭预览页，并自动切回 `对话模式` 工作台。
- `资产生成 > 角色图片` 页面第一个卡片固定为虚线 `生成角色` 按钮，图标使用 Remix `add-large-line`，下面文字为 `生成角色`，按钮永远显示在第一个。没有角色图时也显示该按钮，不再被空状态挡住。
- 点击 `生成角色` 会打开角色图片生成界面。界面仍是媒体预览页同款全屏底：左侧为生成区，右侧为竖版输入框式生成设置区。左侧缩放、实际尺寸、适合尺寸和下载按钮在未生成前禁用。
- 角色图片生成界面右侧已按“竖版对话流输入框”重做，不再有外部标题。右侧内容区左右边距为 `10px`，上方控件、参数显示、提示词输入框和生成按钮统一占满宽度。提示词输入框默认 `1px` 灰色描边，聚焦后淡蓝 `#c8dbff`，无阴影，圆角与按钮一致为 `8px`。
- 角色图片生成界面右侧控件当前布局为：第一行 `比例下拉` 占 2 格 + `风格下拉` 占 1 格；第二行 `模型下拉` 占 2 格 + `K 数下拉` 占 1 格；下面是一行无底框参数显示，只显示 `比例 | 尺寸 + 分辨率图标`，不显示模型；再下面是提示词输入框和 `生成图片` 按钮。
- 角色生成比例下拉目前有 `单人9:16` 和 `三视图16:9`，带竖版/横版小图标；风格下拉有 `写实风格 / 2D风格 / 3D风格`；模型下拉复用图片生成模型列表；K 数下拉会根据当前角色生成模型支持项动态显示。
- 角色生成界面当前默认模型和 K 数已独立为 `GPT-5.4 Image 2` + `2K`，不再跟随对话流输入框里的图片模型当前选择。角色生成界面的 `4K` 文案不使用金色显示；这只影响角色生成界面，不改变对话流原有 4K 显示规则。
- 角色生成单选/下拉按钮使用 `.yinzao-tool-button`，选中态通过新增 `.yinzao-character-option-active` 强制把边框改成通用蓝 `#367cee`，因为 `.yinzao-tool-button` 的默认边框有 `!important`。
- 角色生成 `生成图片` 按钮目前仍禁用，样式为 `h-12`、底部外框边距 `10px`、与输入框间距 `10px`。重要：该界面当前仍只做 UI，占位没有接真实生图流程。下一任接手如果继续做，应在这个全屏界面里接 `/api/image`，生成成功后写入 `资产生成 > 角色图片`，显示在 `生成角色` 按钮后面。
- 资产库打开图片预览时，已补一层参数回填逻辑：如果资产对象没有 `previewMeta`，会通过 `sessionId / messageId / url` 回查原 assistant 消息，并使用标准化 URL 匹配补回模型、比例、尺寸等预览参数；预览渲染时还会再兜底实时反查一次。旧资产如果历史消息里已经找不到对应生成消息，仍可能无法恢复参数。
- 视频参数弹窗里的 `非标` 规则没有改动，仍只在视频参数设置弹窗的 `尺寸（非标）` 标题处显示。曾短暂尝试在尺寸行右侧 `PX` 后加 `（非标）`，但已按用户要求撤回。
- 本轮验证：`npm run lint` 和 `npm run build` 均通过。

### 2026-05-25 本轮后续：文档解析激活、文档预览分栏、滚动条和用户中心积分页细调

- 已完成“文档读取解析 + Agent 激活”第一版。`.md / .txt / .csv` 上传后前端直接读取文本，读取中的文件会保留底部细进度条；发送时如果没有输入文字但有文件，也允许发送，并把已读取文本拼进最新用户消息上下文传给 `/api/agent-plan` 和 `/api/chat`。`pdf / docx / xlsx / pptx` 仍只展示附件，不做真实解析，后续接服务端解析库。
- 文件卡片底部仍显示 `文档类型 · 文件大小`，不显示 `已读取 / 读取中 / 读取失败` 文案。读取状态只用于内部发送判断和读取中进度条。只上传文档时发送按钮可用，读取中发送会提示 `文件读取中`。
- Agent 文档激活规则已调整。上传类似智能体规则 / 工作流说明的 `.md/.txt/.csv` 后说“激活这个智能体”，Agent 应按普通长回复排版：标题、自然短段、分隔线、短列表，不再强制“核心规则不少于 6 条”这类硬规则。激活类首行如 `POV互动影游导演系统已激活` 前的图标改为 Remix `RiTerminalWindowFill`，普通 Agent 仍用原 AI 图标。
- 输入框里的文档卡片和已发送用户消息里的文档卡片都可点击预览。右侧会打开文档预览面板，`.md` 用现有轻量 Markdown 渲染标题、加粗、分隔线、列表；`.txt/.csv` 保留换行显示；未解析文件显示暂不支持预览。标题栏显示 `文档类型 · 文件大小`，不显示读取状态。
- 文档预览面板已改成右侧并列分栏，不再覆盖对话流。打开后左侧对话流和右侧文档预览默认按 `5:4` 分配宽度；中间分隔线可拖动，拖过后保留用户宽度。关闭文档预览后恢复单栏。分隔线默认很浅，中间有小竖向胶囊把手，hover 时线和胶囊轻微变深。
- 文档预览标题栏右侧新增纯图标按钮：复制全文、下载文档、关闭。复制成功后复制图标短暂变成对勾。当前 `.md/.txt/.csv` 有文本时可复制/下载；未解析文件禁用复制和下载。文档预览层级已降到 `z-40`，打开用户中心等遮罩弹窗时不会盖在黑底遮罩上方。
- 全局滚动条规则已调整：默认透明隐藏，滚动时显示原来的灰色滚动条，停止 `2秒` 后消失。原来明确隐藏滚动条的区域，如附件横向滚动条、预览缩略图滚动区，仍永不显示。左侧历史对话/工作流列表额外支持鼠标移入时显示滚动条。
- 用户中心右侧标题统一上移到和关闭按钮同一行，关闭按钮放大并改成圆角矩形底；随后整体右侧头部和内容再下移 `12px`。四个页签 `用户信息 / 我的积分 / 帐号安全 / 设置` 都走同一头部结构。
- 左下角 `个人免费版` 按钮现在可直接打开用户中心 `我的积分` 页。我的积分页新增免费套餐概览卡：左侧为 `免费套餐`、`个人免费版 + leaf-line 图标`、说明文案 `当前为免费版本，暂无升级套餐功能。如有疑问请联系管理员！`；右侧显示真实 `总积分` 和灰色小字 `已赠送积分：xxxx`。
- `/api/credits/me` 新增 `giftedCredits`，统计当前用户 `CreditLedger.direction = "increase"` 的积分总和。注册赠送积分已包含；后续后台手动加分只要通过 `grantCredits(..., "admin_adjust")` 或写 `direction: increase` 流水，就会自动显示到 `已赠送积分`。
- 我的积分扣费表来自数据库 `CreditLedger`，删除工作台历史对话不会删除积分流水。新增 `/api/credits/conversation-title`，用户重命名对话时会同步更新当前用户该 `conversationId` 下的 `CreditLedger.conversationTitle`，所以积分表里的扣费来源会随对话改名。该接口只更新当前登录用户自己的流水。
- 我的积分表格 UI 细调：表格外框圆角为 `5px`；分页按钮常态无边框、文字颜色与关闭按钮一致，hover 出淡灰底，`上一页` 前有左箭头，`下一页` 后有右箭头，禁用态淡化。
- 本轮新增/涉及主要文件：`src/components/chat-workbench.tsx`、`src/lib/openrouter.ts`、`src/app/globals.css`、`src/components/global-scrollbar-controller.tsx`、`src/app/layout.tsx`、`src/app/api/credits/me/route.ts`、`src/app/api/credits/conversation-title/route.ts`。
- 本轮验证：多次 `npm run lint` 和 `npm run build` 均通过。

### 2026-05-25 本轮对话：后台积分流水增强、首页登录态、拖拽上传和文档解析待办

- 后台左侧五个大菜单已加图标：概览、用户管理、积分管理、生成记录、系统设置。`积分管理` 图标改为和前台一致的 `RiVipDiamondLine` 钻石图标。
- 后台积分管理统计卡从 4 个改成 6 个：`总积分 / 增加积分总数 / 消耗积分 / 消耗 Token / 消耗美元 / 消耗人民币`。增加积分绿色显示；消耗类数值红色显示，不带负号。列表表头同步改为消耗积分、消耗 Token、消耗金额。
- 数据库 `CreditLedger` 新增 `direction String @default("consume")`，新增迁移 `20260522143000_credit_ledger_direction`。迁移中给现有用户回填 `signup + increase` 增加流水，数值为 `当前余额 + 已消耗积分`。
- `src/lib/credits.ts` 新增 `grantCredits()`，用于写增加积分流水。前台验证码注册和后台验证码创建用户不再直接创建 `credits = signupCredits`，而是先创建 `credits = 0`，再调用 `grantCredits(user.id, signupCredits, "signup")`。模型扣费继续通过 `chargeCredits()` 写 `direction: consume`。
- 后台积分统计和用户详情里的已消耗积分、Token、金额已改为按 `CreditLedger.direction === "consume"` 真实流水统计；前台 `/api/credits/me` 只读取消耗流水，注册送积分不会显示成消费记录。
- 首页 `/` 已接入 `/api/auth/me` 判断前台登录态。已登录时右上角不再显示 `登录`，改为用户头像；头像菜单复刻工作台用户菜单：用户信息、我的积分、帐号安全、设置、退出登录。点前四项会把目标 tab 写入 `sessionStorage` 的 `flashmuse-workspace-user-dialog-v1`，再跳转 `/workspace` 并打开对应用户中心页。
- 首页输入框已做实：空输入时，已登录直接跳 `/workspace`，未登录弹登录抽屉；有输入时，已登录会把内容写入 `sessionStorage` 的 `flashmuse-home-prompt-v1`，进入工作台后新建对话并按 Agent 发送进入思考状态；未登录则弹登录框，登录成功后进入工作台并消费该 prompt。
- 工作台支持拖拽上传。用户拖拽文件到右侧对话流时，会显示白色半透明遮罩、背景模糊、虚线边框、中间 `在此处拖放文件`、文件类型提示，以及绿色圆形 2px 描边 `arrow-down-fill` 图标。跟随鼠标的小白框已按用户要求删除。
- 拖拽和输入框 `+` 支持图片与文档格式：`pdf, txt, csv, docx, doc, xlsx, xls, pptx, ppt, md`。图片上限仍为 `10` 张；文档文件上限已改为 `8` 个。文档当前只是附件展示，还没有读取内容给 Agent。
- 输入框附件显示已重做：文档单独一行在上，图片单独一行在下；文件和图片可以同时存在。两行超出宽度时显示左右按钮，滚动条隐藏，左右两端有渐隐。图片缩略图统一为 `80x80px`；文档卡片右上角有关闭按钮。
- 文档卡片样式经过多轮细调：卡片尺寸约 `200x54`；左侧类型小标是淡色底、2px 描边、3px 圆角正方形字母卡；Word/PPT/Excel/PDF/Markdown/txt 按类型使用不同颜色；底部显示类型和大小，例如 `PPT · 29KB`。
- 发送后的用户消息附件显示已同步：文档显示在用户文字下方第一行，图片显示在文档下方第二行；图片尺寸 `80x80px`。如果用户只上传附件没有输入文字，对话流不再显示内部默认句子 `请分析这张图片，并告诉我可以怎么继续创作。`，该句只作为内部发送给 Agent 的默认 prompt。
- 本轮排查 `@` 引用问题：日志确认 `@` 解析正常，`/api/image` 收到 2 张参考图，两个 `/generated/upload_image/...` 文件都存在。当前跑偏不是 `@` 没传，而是 Seedream 4.5 对多参考图、四视图角色图 + 场景图 + 第一人称构图重组不稳定。`src/lib/openrouter.ts` 增加了非敏感调试日志：`reference_count`、参考图类型、本地文件是否存在，不打印 base64。
- 用户要求 `@` 问题先放一放。下一任 AI 不要继续深挖 `@`，除非用户重新提出。
- 下一任 AI 最高优先级：马上做“文档读取解析 + Agent 激活”。第一版只做 `.md / .txt / .csv` 前端读取文本即可；文件卡片需要显示 `读取中 / 已读取 / 读取失败` 状态和细进度条；文件未读取完成时建议禁用发送或提示 `文件读取中`；发送时把已读取文本带给 `/api/agent-plan` 和 `/api/chat`；如果 `.md` 像智能体规则，Agent 应回复类似 `XXX 智能体已激活`。
- 后续服务器部署方案：文档原件应上传对象存储并通过 CDN 访问，但 Agent 不应每次直接读 CDN 原文件。应在服务端解析文档文本，文本/分块内容入库，Agent 读取解析后的文本片段。`pdf/docx/xlsx/pptx` 后续再接服务端解析库，当前先展示附件。
- 本轮验证：多次 `npm run lint` 和 `npm run build` 通过；新增 Prisma 迁移已执行 `npx prisma migrate deploy`，`npx prisma generate` 通过。期间因 Windows Prisma DLL 被 dev server 占用，曾停止端口 `3000` 的 Node 进程，预览可能需要重新启动 dev server。

### 2026-05-22 本轮对话：积分系统第一版、后台交互细调和 Agent 换行清洗

- Agent 回复中曾出现字面量 `\n\n`。根因是结构化 JSON 的 `content` 里模型返回了转义换行，前端只识别真实换行。已在 `src/lib/openrouter.ts` 新增模型文本清洗，处理 `\n / \t / \"` 和 JSON 代码块残留；`parseStructuredAgentReply()`、`parseAgentPlan()`、suggestions、items、constraints 等字段都会清洗。
- 为避免“在，我在。\n\n如果你愿意...”这类短回复被拆成两段，新增短开场合并规则：只有“短开场句 + 普通正文”会自动合并；长回答、列表、剧本、分镜和知识讲解仍保留换行。Agent 提示词也补了“普通短聊天不要分段，只有长回答/列表/剧本/分镜/知识讲解才换行”。
- 前端 `sanitizeMessageContentForDisplay()` 和 `ReferencedTextContent()` 增加显示兜底，旧历史里的字面 `\n` 也会正常处理；后台历史对话 `AdminFormattedMessage()` 同步处理旧消息。
- 新增积分系统第一版。数据库新增 `CreditSetting` 和 `CreditLedger`，迁移为 `20260522120000_credit_system`。`CreditSetting` 保存美元汇率、`1人民币=多少积分`、注册送积分、文本/图片/视频是否扣分；`CreditLedger` 记录用户、对话、请求、类型、模型、扣除积分、Token、美元、人民币、图片数、视频数和明细元数据。
- 积分规则已按用户确认落地：OpenRouter 返回美元费用，后台汇率换算成人民币，人民币按兑换比换算积分；积分只保存整数，扣分使用四舍五入。积分为 `0` 时禁止继续调用模型；积分大于 `0` 时允许最后一次任务，扣到 `0` 但不会出现负数。失败请求不扣分。
- 扣分节点：`/api/agent-plan` 和 `/api/chat` 成功后按文本/规划扣；`/api/image` 成功后按图片扣；`/api/video` 在视频任务成功返回视频地址后按视频扣。游客模式没有登录用户，当前不扣数据库积分。
- 注册送积分改为读取 `CreditSetting.signupCredits`。`/api/auth/me` 和 `/api/user-profile` 返回用户资料时带 `credits`，前端左下角积分余额会随扣分立即刷新。
- 工作台右上角当前会话用量浮窗新增积分显示：只显示积分图标和数值，不写“积分”两个字。会话 `usageSummary` 现在除 Token / 美元外还累计 `credits`。
- 左下角用户菜单新增 `我的积分`。用户中心左侧新增 `我的积分` 标签；右侧显示 `我的积分：xxxx`，下面按历史对话聚合显示：对话名称、扣除积分红字、图片数量、视频数量、最后活跃时间，条数多时分页。
- 后台 `积分管理` 页面已做实，新增客户端组件 `src/app/admin/admin-credits-panel.tsx`。顶部标题右侧搜索框；设置区可改美元汇率、积分兑换比、注册送积分，以及勾选是否扣文本/图片/视频；统计卡显示总扣积分、总 Token、总美元、总人民币；下面按对话流显示扣分列表。
- 后台积分管理的对话列表可展开查看明细。主行显示用户/对话、积分、Token、美元/人民币、图片数、视频数、最后活跃；最后一列为展开三角。默认不展开，点整行或三角都能展开；明细里文本规划/回复、图片批次、视频任务分别显示。
- 后台积分设置保存接口最初放在 `/api/admin/credits`，但后台 Cookie `flashmuse-admin-session` 只作用 `/admin`，导致保存不带 Cookie、刷新后又回到旧值。已新增 `/admin/api/credits` 重新导出同一接口，前端保存改为请求 `/admin/api/credits`。当前数据库中可查到汇率已保存过 `6.8`。
- 后台美元汇率输入已改为文本输入，允许输入小数点，最多两位小数；输入 `7` 后失焦会显示 `7.00`，输入 `7.` 时不会被浏览器吞掉。
- 后台 UI 细调：用户详情展开区里 `历史对话 / 生成图片 / 生成视频` 可点击字段名只给文字加下划线，右侧数值不加；三个弹窗的标题栏改为跨整个弹窗宽度，不再只占左侧或右侧；后台左侧栏改为 `sticky top-0 h-screen`，当前管理员块固定在浏览器底部。
- 后台搜索框统一：用户管理和积分管理搜索框图标都放到输入框右侧，输入文字居左，图标居右。
- 后台用户管理大列表现在点整行也能展开/收起，点右侧三角也能展开/收起，三角点击会阻止冒泡避免重复触发。
- 本轮执行过 `npx prisma migrate deploy`、`npx prisma generate`、多次 `npm run lint`、多次 `npm run build`，均已通过。`npx prisma generate` 曾因 Windows Prisma DLL 被端口 `3000` dev server 占用失败，已停止端口 `3000` 的 Node 进程后重新生成成功，因此当前 dev server 可能已被停掉，需要预览时请重新启动。
- 本轮主要涉及文件：`prisma/schema.prisma`、`prisma/migrations/20260522120000_credit_system/migration.sql`、`src/lib/credits.ts`、`src/lib/openrouter.ts`、`src/components/chat-workbench.tsx`、`src/app/api/agent-plan/route.ts`、`src/app/api/chat/route.ts`、`src/app/api/image/route.ts`、`src/app/api/video/route.ts`、`src/app/api/credits/me/route.ts`、`src/app/api/admin/credits/route.ts`、`src/app/admin/api/credits/route.ts`、`src/app/admin/admin-credits-panel.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/app/admin/page.tsx`。
- 上线前提醒：后台登录 Cookie `flashmuse-admin-session` 当前有效期为 `8` 小时；用户要求上线前提醒他确认是否改成关闭浏览器即失效。

### 2026-05-21 本轮后续：后台用户详情、历史对话弹窗、媒体预览弹窗和后台登录历史

- 后台登录页新增管理员邮箱历史下拉。登录成功后会把邮箱保存到浏览器 `localStorage` 的 `flashmuse-admin-login-history-v1`，最多 `5` 条；点击或聚焦后台登录邮箱输入框时显示历史菜单，点击历史邮箱可填入。该历史只用于后台登录，不与前台 `flashmuse-login-history-v1` 混用。
- 后台用户管理表头继续细调：`最后登录` 改为 `最后登录时间`；状态筛选和状态标签中的 `已禁用` 改为 `禁用`；主行仍保留状态旁边的 `禁用 / 启用` 操作按钮。
- 后台假用户 `testuser001@flashmuse.test` 到 `testuser100@flashmuse.test` 现在会按邮箱序号显示模拟 `最近登录 IP / 归属地`，用于测试表格列宽；真实用户仍显示 `待接入 / 待接入`。这些 IP/归属地只是前端临时模拟，不是数据库真实字段。
- 用户展开区 UI 已重做。去掉原来的白色圆角卡片和小标题；改为灰底展开区域上的四列直角灰底横条，列间距 `5px`，名称居左、值居右。四列大致为：账号资料、登录/设置、工作区使用数据、积分/消耗数据。
- 展开区第一列新增 `登录帐号 / 昵称`，并调整顺序为登录帐号、昵称、手机号、密码、语言、注册时间、资料更新时间；`Session 数` 和 `Session 活跃` 被移到第二列，放在 `最近登录 IP / 最近登录归属地` 下方。`最近 Session 活跃` 文案已改为 `Session 活跃`。
- 展开区第三列新增 `历史对话`，显示工作区 JSON 中的历史会话数量。`生成图片 / 生成视频` 现在优先从用户工作区 JSON 里实际 assistant 媒体消息统计，解决 `User.generatedImageCount / generatedVideoCount` 尚未自动累加导致后台显示 0 的问题。
- 展开区第四列新增消耗数据：`积分 / 已消耗积分 / 已消耗Token / 已消耗金额`。`已消耗积分` 暂按 `1500 - 当前积分` 计算；`已消耗Token / 已消耗金额` 从用户工作区每个会话的 `usageSummary` 汇总，金额显示为 `$ / ¥`，汇率仍用后台默认 `7.2`。
- `工作区保存` 的值已改为只显示最后保存时间，不再显示 `已保存，` 前缀；未保存仍显示 `未保存`。
- `历史对话` 现在可点击。点击后打开只读历史对话弹窗，大小和后续媒体弹窗一致，圆角 `10px`。左侧为该用户历史会话列表，左上显示 `XXX历史对话`；右侧为对话内容，不显示输入框。左侧未选中项不显示时间且高度更低，选中项灰底 `#ececec` 并显示时间。
- 后台历史对话弹窗会渲染 AI 文案里的轻量 Markdown，支持标题、加粗、分隔线、无序/有序列表，不再直接露出 `# / ## / ** / ---` 等符号。用户消息仍保持气泡样式；图片和视频会在对话中只读展示。
- `生成图片` 和 `生成视频` 也可点击。点击后打开媒体预览弹窗，尺寸与历史对话弹窗一致，但左右结构互换：左侧大区域显示选中的图片或视频，右侧显示缩略图列表。缩略图选中态为蓝色边框。
- 媒体预览弹窗底部参数显示已改成和项目工作台一致的紧凑格式：提示词一行，下方为 `模型 | 比例 | 尺寸 + 分辨率图标 | 时长`。图片分辨率图标和 `超清4K` 金色标签、视频 `SD / HD / FHD / 4K` 黑底图标都按工作台样式复刻；模型名使用 `src/lib/models.ts` 中的展示名，不直接显示模型 ID。
- 后台从 `UserWorkspaceState.state` 中提取只读会话、媒体、usage 统计。主要新增类型和逻辑集中在 `src/app/admin/admin-users-panel.tsx` 与 `src/app/admin/page.tsx`，没有新增数据库表。
- 本轮验证通过：多次 `npm run lint`、多次 `npm run build`。

### 2026-05-21 本轮对话：后台用户管理页、用户 ID 规则和用户中心 ID 显示

- 后台左侧菜单已改为分类页切换。`/admin` 默认显示概览；`/admin?tab=users` 显示用户管理；`/admin?tab=credits`、`/admin?tab=records`、`/admin?tab=settings` 显示对应占位页。
- 概览恢复成最初结构：顶部四个统计卡，下面三块占位卡。用户管理表不再显示在概览里。
- 后台所有分类页标题结构统一：只显示大标题，标题下方小灰字说明已全部去除。用户后续要求：小 UI 调整可以直接改；功能逻辑、接口、数据结构或较大改动时再确认。
- 新增 `src/app/admin/admin-users-panel.tsx`，用户管理页改为独立客户端组件。顶部右侧放短搜索框和状态筛选，搜索支持 `ID / 邮箱 / 昵称 / 手机`，筛选为 `全部 / 正常 / 已禁用`。
- 用户管理统计卡显示总用户、今日新增、正常用户、禁用用户、总积分余额。卡片高度压缩：上下内边距 `10px`，数字 `22px` 加粗，外部上下间距也已压缩。
- 用户列表每页 `10` 条，底部分页显示总条数、当前显示范围、上一页/下一页、当前页码/总页数。分页条外层底框已去除。
- 用户列表外框圆角改为 `10px`。用户列表固定最小宽度 `1180px`，后台整体最小宽度 `1464px`，去掉内部横向滚动层，浏览器变窄时表格不继续压缩。
- 用户列表主行字段调整为：用户ID、用户（头像/账号/昵称）、积分 + `调积分`、最近登录 IP / 归属地、最近登录时间、状态 + `禁用/启用`、三角展开。`查看` 按钮已删除。
- 最近登录 IP 和归属地现在没有真实数据，主行和展开区先显示 `待接入`。后续可在 `Session` 表增加 `ipAddress / ipCountry / ipRegion / ipCity / userAgent`。
- 点击用户行尾三角会下推展开隐藏详情块，展示账号信息、使用数据、登录和工作区：手机号、语言、密码状态、注册时间、资料更新时间、图片/视频数、提醒开关、自动入库开关、预览滚轮设置、Session 数、最近 Session 活跃、工作区保存状态等。
- 本地数据库新增 100 个测试用户用于后台测试，邮箱为 `testuser001@flashmuse.test` 到 `testuser100@flashmuse.test`。测试用户带模拟积分、生成数量、注册时间、最后登录、禁用状态等。假用户无头像时后台统一显示 `?`。
- 用户 ID 规则改为 `ID_六位随机数字`，例如 `ID_178523`。`User.id` 已从 Prisma 默认 `cuid()` 改为手动生成，`src/lib/auth.ts` 新增 `generateUserId()`。
- 前台验证码注册和后台验证码创建用户都已接入 `generateUserId()`。涉及 `src/app/api/auth/verify-code/route.ts` 和 `src/app/api/admin/verify-code/route.ts`。
- 本地已有 102 个用户已迁移到 `ID_` 格式。此前短暂使用过 `ID.`，后按用户要求改成下划线；当前本地数据库 `ID.` 剩余为 0。
- 用户中心头像下方显示用户 ID，只显示原始值，如 `ID_779117`，不再显示 `ID：ID_...`。字号调到 `14px`，颜色稍深；下方信息行整体下移一点。
- `/api/auth/me` 和 `/api/user-profile` 返回用户资料时包含 `id`，`src/lib/user-profile.ts` 的 `getUserProfileFromUser()` 已返回 `id`，`CurrentUserProfile` 类型已加 `id?: string`。
- 用户昵称上限统一为 8 个字。前端用户中心输入框会截断到 8 个字符，后端 `normalizeUserProfileInput()` 也会截断到 8。
- 本轮运行 `npx prisma generate` 时遇到 Windows Prisma DLL 被端口 3000 dev server 占用，已停止该 Node 进程后重新生成成功。需要预览时请重新启动 dev server。
- 本轮验证通过：`npx prisma generate`、多次 `npm run lint`、多次 `npm run build`。
- 本轮涉及主要文件：`src/app/admin/page.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/components/chat-workbench.tsx`、`src/lib/auth.ts`、`src/lib/user-profile.ts`、`src/app/api/auth/verify-code/route.ts`、`src/app/api/admin/verify-code/route.ts`、`prisma/schema.prisma`。

### 2026-05-20 本轮对话：左下角积分占位、后台管理第一版和独立后台登录

- 用户要求后续回答继续简单直接；本轮主要围绕工作台左下角用户区和后台管理页推进。
- 用户中心头像上传按钮图标不居中已修：去掉 `RiCameraLine` 上的 `translate-x-px -translate-y-px`，让按钮自身 `flex items-center justify-center` 生效。
- 工作台左下角用户区新增积分占位卡。当前 UI 显示 `vip-diamond-line + 积分：1,500` 和米色底 `vip-crown-2-line + 个人免费版`；文字字号因全局 `button { font: inherit; }` 必须写到内部 `span` 或更内层元素才稳定。
- 左下角用户区整体高度和位置经过多轮细调：底部模块 `min-h-[148px]`，积分卡和头像块整体上下居中；积分卡和头像之间加间距；头像 hover 灰底高 `h-11`；顶部全宽分隔线向上移 `6px`。
- 修复左侧历史列表文字从底部分隔线下透出的问题：底部用户模块加 `z-20` 和不透明 `bg-[#f9f9f9]` 背景遮罩，积分卡和头像按钮用 `z-10` 保持在上层。
- 左下角用户菜单改为从头像区域上方弹出，可压住积分块；最终定位为 `bottom-[60px]`，水平位置 `left-[calc(50%-1px)]`。菜单设置图标从 `RiSettings3Line` 统一替换为官方 `RiSettingsLine`。
- 新增后台管理第一版，地址 `/admin`，浏览器标题为 `闪念后台 Management`。后台是独立页面，不出现在首页导航；根目录新增 `start-admin.bat`，脚本为 `scripts/start-admin.ps1`，会打开 `http://localhost:3000/admin`。
- 后台登录页为白底中间登录框，标题区为 Logo + `闪念后台` 居中，Logo 当前 `30px`。登录支持密码登录和验证码登录；验证码登录用于管理员账号未设置密码的情况。
- 后台权限使用 `ADMIN_EMAILS` 邮箱白名单。`.env.example` 已新增 `ADMIN_EMAILS=`。本地 `.env` 已按用户要求加入管理员邮箱，但 `.env` 不提交，不要在公开文档或提交里展开敏感配置。
- 后台登录已改为独立 Cookie，不再共用前台 `flashmuse-session`。新增后台 Cookie `flashmuse-admin-session`，只作用于 `/admin` 路径，8 小时有效；后台登录/退出不影响前台工作台登录状态。
- 新增后台专用接口：`/api/admin/send-code`、`/api/admin/verify-code`、`/api/admin/login-password`、`/api/admin/logout`。这些接口都会先校验邮箱是否在 `ADMIN_EMAILS` 白名单中。
- 新增 `src/lib/admin.ts` 和 `src/lib/admin-auth.ts`。`admin.ts` 处理白名单和默认汇率 `7.2`；`admin-auth.ts` 用 HMAC 签名的独立后台 Cookie 保存后台登录态，不写数据库 `Session` 表。
- 后台第一版内容：概览真实读取用户数、今日新增、图片数、视频数、积分余额；用户管理表真实读取 `User` 最近 50 个用户；积分管理、生成记录、系统设置目前是占位区。
- 数据库新增用户字段 `credits Int @default(1500)` 和 `disabled Boolean @default(false)`，迁移为 `20260520120000_admin_credits_fields`。已执行 `npx prisma migrate dev --name admin_credits_fields`；生成 Prisma Client 时再次遇到 Windows DLL 占用，停掉端口 `3000` 的 Node 进程后 `npx prisma generate` 成功。
- 后台左侧栏底部显示当前管理员邮箱和白底 `退出后台` 按钮。退出只清 `flashmuse-admin-session`，不清前台登录 Cookie。
- 当前后台尚未完全做实：积分加减、积分流水、生成记录表、生成扣积分、后台设置可编辑、禁用用户拦截、生成图片/视频计数自动累计都还没接上。现在是“可进入、可看真实用户数据的后台雏形”。
- 本轮验证通过：`npm run lint`、`npm run build`。涉及主要文件：`src/components/chat-workbench.tsx`、`src/app/admin/*`、`src/app/api/admin/*`、`src/lib/admin.ts`、`src/lib/admin-auth.ts`、`prisma/schema.prisma`、`prisma/migrations/20260520120000_admin_credits_fields/migration.sql`、`start-admin.bat`、`scripts/start-admin.ps1`、`.env.example`。

### 2026-05-20 本轮对话：游客入口、登录历史、用户中心设置、预览页和 Agent 媒体引导

- 用户再次强调：后续工作说明必须用中文，不能夹英文工作说明，回答要简单直接。
- 首页右上测试入口从 `进入工作台` 改为 `游客模式`，链接改为 `/workspace?guest=1`。`/workspace?guest=1` 会强制游客模式，跳过 `/api/auth/me`，永远读取浏览器 `localStorage` 测试数据；邮箱登录成功仍进入 `/workspace`，走数据库用户工作区。上线时只要隐藏/删除 `游客模式` 按钮即可。
- 工作台加载逻辑安全兜底已修：如果认证接口或数据库异常，会优先读取本机游客数据，不再直接创建空游客会话覆盖 `yinzao-sessions-v2`。本轮确认旧游客历史已经被空会话覆盖，无法从当前 `localStorage` 恢复，但后续游客模式会继续保存新测试数据。
- 首页 `游客模式` 与 `登录` 两个按钮高度和字号统一：按钮高 `h-9`，文字放内部 `span`，字号 `13px`，避免全局 `button { font: inherit; }` 影响。
- 图片生成失败状态修复。此前多图并发中若平台已返回 500/无图，部分等待卡仍停在 `99%生成中`。现在单张失败和整批收尾都会把剩余 `pendingImageCount` 清零，并补成 `图片生成失败` 卡；红字错误保留真实原因。成功图不受影响。
- `正在认真思考` 前置动画替换为轻量 `GridLoader` 3x3 点阵，不加依赖，支持 `prefers-reduced-motion`。尺寸最终为 `16px`，左侧历史运行中也复用该组件。文字和后三个点去掉蓝色，改成灰白动画；文字动画 `3.2s`，三点动画 `2.1s`。前置 GridLoader 保持蓝色。
- Agent 正文 Markdown 兜底修复。列表里 `- **阿宁**：...` 这类标签现在会继续解析内联格式，不再把 `**` 原样露给用户。
- Agent 自动生图/生视频完成后恢复引导系统。媒体结果消息会保存 `suggestions`，优先用 Planner 返回值，没有则使用前端兜底建议；专业模式图片/视频结果仍不显示引导按钮。最后一条 assistant 如果是 Agent 媒体消息，也会显示引导按钮。
- 预览页右侧缩略图导航规则已统一：只要当前对话内图片+视频总数大于 1，就显示缩略图导航，不再区分 Agent / 专业模式、图片 / 视频。显示条件从 `> 2` 改为 `> 1`，Agent 多图、多视频和混合媒体都可切换。
- 用户中心 `图片/视频生成完成提醒` 做实并默认开启。任意会话中的图片/视频生成完成，都会在当前页面顶部弹绿色提醒 `图片生成已完成` 或 `视频生成已完成`，不受当前选中会话影响；关闭开关后不弹。同一批任务只提醒一次。
- 用户中心 `生成图片/视频自动收入资产管理库` 做实并默认开启。开启时生成的图片/视频自动入资产管理库；关闭时不再自动入库，但文件仍保存在服务器/本地生成目录，对话流仍正常显示、预览、下载和重生成。内部仍沿用原 `autoSaveHistory` 字段，未改字段名。
- 用户中心设置新增两个独立开关，默认都开启：`预览页鼠标放在图片上滚轮有缩放功能` 和 `预览页鼠标放在缩略图区域滚轮有翻页功能`。两个开关不互斥。鼠标在主预览区滚轮缩放图片；鼠标在右侧缩略图区域滚轮切上一张/下一张。视频主预览区不缩放，但缩略图区仍可滚轮切换视频。
- 上述预览滚轮设置已加入用户资料字段：`previewWheelZoom / previewWheelFlip`。已执行 Prisma 迁移 `20260520074200_preview_wheel_settings` 和 `20260520081205_preview_wheel_zoom_default_on`；生成 Prisma Client 时如遇 Windows `query_engine-windows.dll.node` 被占用，停掉端口 `3000` 的 Node dev 进程后重新 `npx prisma generate`。
- 设置页 `本地缓存` 占位项已删除。当前不应提供“一键清理缓存”误删用户图片、视频、对话和资产；这些都属于用户数据，不能自动清理，除非用户主动删除。
- 设置页图标更新：`图片/视频生成完成提醒` 使用官方 Remix `RiNotification2Line`；预览缩放使用官方 `RiZoomInLine`；缩略图翻页使用官方 `RiArrowUpDownLine`。本轮先写过本地 SVG，后查到 `react-icons/ri` 已导出官方图标并替换。
- 首页登录抽屉新增本机最近登录邮箱菜单。登录成功后把邮箱写入 `localStorage` 的 `flashmuse-login-history-v1`，最多 5 条。点击邮箱输入框时以下拉菜单显示，竖排，最高 `250px`，超出滚动；点邮箱填入并收起；用户自己输入时收起；点击登录抽屉其它区域也会收起。
- 登录发送验证码文案区分来源：用户主动选择 `验证码登录` 时显示 `正在发送验证码...`；默认密码登录下系统判断为首次登录或未设置密码而自动切验证码时显示 `首次登录或未设置密码，正在发送验证码...`。
- 本轮多次验证通过：`npm run lint`、`npm run build`。涉及文件主要为 `src/app/page.tsx`、`src/components/chat-workbench.tsx`、`src/app/globals.css`、`src/lib/user-profile.ts`、`prisma/schema.prisma` 和新增 Prisma migration 目录。

### 2026-05-19 本轮对话：登录细节、用户中心遮罩、新对话快捷入口和思考动画

- 首页登录抽屉继续细调。用户主动选择 `验证码登录` 后，邮箱回车直接调用 `/api/auth/send-code` 发送验证码，不再先查账号是否有密码；默认 `密码登录` 时仍保留“查账号 -> 有密码进密码输入 -> 无密码/新账号自动验证码”的流程。
- 验证码发送中状态已加。验证码登录提交邮箱后，在邮箱输入框下方显示蓝色 `正在发送验证码...`，三个点逐个出现/消失；发送完成后切到 6 位验证码输入框。
- 登录输入提示优化：邮箱 placeholder 改为 `请输入邮箱，如 name@email.com`。邮箱、密码、验证码输入框只要继续编辑或删空，就清除已有红字错误和灰字提示。验证码 6 个输入框圆角从 `16px` 改为 `12px`。
- `/api/auth/send-code` 新增邮箱域名收信能力校验。服务端先查邮箱域名 MX，失败再查 A/AAAA；明显不存在的邮箱域名不再发送验证码，返回文案 `邮箱或域名不存在，请检查后重新输入`。
- 默认头像加描边。没有上传头像时，邮箱 hash 生成的淡色默认头像会加 `1px` 更深一点的同色系描边；用户上传头像不受影响。
- 用户中心弹窗遮罩更新：保留黑色半透明底，同时加 `backdrop-blur-[6px]`，弹窗后面的工作台内容模糊显示。
- 工作台新对话空白页重做。标题改为 `hi~把你的闪念跟我聊一聊！`，下方为三行快捷按钮。每次固定三行，每行 `3-5` 个；行上下对齐，列可以不齐；内容和每行数量按会话 ID 打散，新建对话会变化。
- 新对话快捷按钮为淡彩色随机底、无描边；文字为 `13px`，写在内部 `span` 上避免全局 `button { font: inherit; }` 覆盖。按钮池包括生图、生视频、故事梗概、文字分镜、提示词扩写、角色小传、场景参考图等。
- 快捷按钮点击行为改为直接发送：点击后先把底部输入模式切到 `Agent 模式`，再把该快捷文案作为 Agent 消息发送，不再先填入输入框。
- `正在认真思考` 动画放慢：文字走光从 `1.65s` 改为 `2.4s`，三个点动画从 `0.95s` 改为 `1.45s`。
- 本轮涉及主要文件：`src/app/page.tsx`、`src/app/api/auth/send-code/route.ts`、`src/lib/auth.ts`、`src/components/chat-workbench.tsx`、`src/app/globals.css`。
- 本轮验证：多次 `npm run lint` 通过；邮箱域名校验加入后 `npm run build` 通过。

### 2026-05-19 本轮对话：用户中心完善、资料独立入库、头像目录、语言切换和登录体验

- 用户中心继续按用户截图细调。左上角使用闪念图片 Logo；右侧大标题改为正常字重，标题下灰色说明文字删除。用户信息页改为头像居中、下方统一灰底信息行，信息行宽度为 490px，圆角 10px，左侧图标和标签为灰色，右侧值保持深色；邮箱右侧值为灰色。
- 默认头像按邮箱稳定生成淡色背景，圆形内显示邮箱首字符。用户中心头像加大到 92px，右下角有白底灰描边相机按钮；上传头像后左下角用户区和用户中心同步显示上传图。左下角用户区第一行从固定 `用户头像` 改为当前昵称，第二行显示邮箱。
- 头像上传链路独立。新增 `/api/upload-avatar`，头像文件保存到 `public/generated/user_avatar/`；普通聊天上传仍走 `/api/upload-image` 并保存到 `public/generated/upload_image/`。数据库 `User.avatarUrl` 只保存 URL。曾短暂把头像和普通上传接口写反，已修复。
- 用户中心资料已从工作区 JSON 拆成 `User` 表独立字段，新增字段：`nickname / phone / avatarUrl / language / notifyOnGenerationComplete / autoSaveHistory / generatedImageCount / generatedVideoCount`。新增迁移 `20260519132218_user_profile_fields`，新增 `src/lib/user-profile.ts` 和 `/api/user-profile`。`/api/auth/me` 现在返回完整用户资料；`/api/workspace-state` 兼容迁移旧 JSON 中用户资料并清理旧字段。
- 用户信息页新增手机行，手机和昵称都可点 `edit-box-line` 编辑。昵称默认等于当前登录邮箱，新注册用户创建时 `nickname=email`。生成图片/生成视频计数字段已建在 `User` 表中，但目前还没有在生成成功后自动累加，后续做统计/积分时需要接上。
- 帐号安全页重做。已设置密码时显示灰底行：`lock-password-line + ***********`，右侧灰字 `密码已设置`；下方是无底通用蓝文字按钮 `修改密码 / 忘记密码`。修改密码显示当前密码、新密码、确认密码三行；忘记密码会发当前登录邮箱验证码，显示 6 个 44x44 灰底灰描边验证码框，满 6 位自动校验。新增 `/api/auth/check-code` 和 `/api/auth/reset-password`。
- 密码设置/修改成功改为用户中心窗口外上方居中的绿色提醒消息，不再在页面内显示绿色文字；用户中心提醒停留 3 秒。忘记密码发送验证码时显示黑色提醒 `验证码已发送到您当前登录的邮箱中`，位置同样在用户中心窗口外上方。
- 设置页更新。语言选择做实，支持 `简体中文 / 繁體中文`；语言菜单加宽、行高加大、点空白可关闭，菜单里的语言名称永远用自身语言显示。`生成完成提醒 / 自动保存历史` 改成滑块按钮，开启状态使用通用蓝 `#367cee`；`默认进入页面` 移除；版本信息显示 `v0.1.0 内测版`。
- 全工作台简繁切换已接入，但当前实现是前端 DOM 转换层，不是真正 key-based i18n。转换范围包括可见中文、placeholder、title、aria-label、alt；跳过输入框、textarea、contenteditable、script/style 和 `data-no-translate="true"`。曾出现转换后页面无法点击，原因是 MutationObserver 重复写回 DOM，已加防重复写入；曾出现用户中心切回简体不同步，已加繁转简兜底。
- 所有弹出菜单互斥处理：历史对话菜单、工作流菜单、用户菜单、反馈更多菜单、资产菜单、输入框模式/模型/参数/`@` 菜单打开任一项时会关闭其它菜单，避免多个菜单同时存在。
- 首页登录抽屉默认优先密码登录。邮箱输入框有内容时右侧显示 `corner-down-left-line` 图标按钮，点击等同回车；邮箱提交先查是否注册/是否有密码，有密码进入密码输入，无密码或新账号自动切验证码登录。密码输入框不显示该图标，仍使用下方登录按钮。登录 placeholder 内边距已调整，避免未输入时显示不全；后续 placeholder 已改为 `请输入邮箱，如 name@email.com`。
- 本轮涉及主要文件：`src/components/chat-workbench.tsx`、`src/app/page.tsx`、`src/app/api/user-profile/route.ts`、`src/app/api/upload-avatar/route.ts`、`src/app/api/auth/check-code/route.ts`、`src/app/api/auth/reset-password/route.ts`、`src/app/api/workspace-state/route.ts`、`src/app/api/auth/me/route.ts`、`src/app/api/auth/verify-code/route.ts`、`src/lib/user-profile.ts`、`src/lib/local-assets.ts`、`prisma/schema.prisma`。
- 本轮验证：`npx prisma migrate dev --name user_profile_fields` 成功，`npx prisma generate` 成功，`npm run lint` 通过，`npm run build` 通过。Prisma generate 在 Windows 上如果报 `EPERM query_engine-windows.dll.node`，先停掉占用 3000 的 Node dev 进程再重试。

### 2026-05-19 本轮对话：正式登录底座、PostgreSQL、SMTP 验证码和用户工作区入库

- 登录系统从占位升级为可用版本。首页右上 `登录` 打开邮箱登录抽屉；首页 `进入工作台` 保持游客入口，直接进入 `/workspace` 并继续使用浏览器本地测试数据。
- 登录流程按用户规则实现：`密码登录 / 验证码登录` 可切换；邮箱输入完整后回车先检查是否注册；未注册直接进入验证码登录并在校验成功后注册；已注册但未设置密码也强制走验证码登录；已设置密码的账号可显示密码输入框和蓝色登录按钮。
- 验证码登录 UI 已实现：发码后邮箱输入框替换为 6 个横排数字输入框，整体宽度约等于邮箱输入框；验证码填满后自动校验。邮箱 placeholder 后续已改为 `请输入邮箱，如 name@email.com`。登录方式文字因全局 `button { font: inherit; }` 改为内部 `span` 内联 `13px`。
- 新增 `PostgreSQL + Prisma`。新增 `prisma/schema.prisma`、`docker-compose.yml`、`src/lib/prisma.ts`、本地 `.env` 数据库配置和 `package.json` Prisma scripts。已通过 Docker Desktop / WSL2 启动本地 `flashmuse-postgres` 容器。
- 已执行两次数据库迁移：`init_auth` 和 `user_workspace_state`。当前表为 `User`、`Session`、`EmailVerificationCode`、`UserWorkspaceState`。`Session` 使用 `HttpOnly Cookie` + token hash；验证码只存 hash，不存明文。
- 新增认证 API：`/api/auth/check-email`、`/api/auth/send-code`、`/api/auth/verify-code`、`/api/auth/login-password`、`/api/auth/me`、`/api/auth/logout`、`/api/auth/set-password`、`/api/auth/change-password`。
- 邮箱验证码已接通网易个人邮箱 SMTP。新增 `nodemailer` 和 `src/lib/mailer.ts`；SMTP 配置项写入 `.env.example`，本地真实值在 `.env`，来源为 `AI-Video-Assistant_Project Planning\闪念官方邮箱.txt`。该 txt 和 `.env` 含敏感信息，不得提交。SMTP 未配置时仍回退终端打印验证码。
- 工作台左下角用户菜单改为 `用户信息 / 帐号安全 / 设置 / 退出登录`。前三项打开同一个用户中心弹窗，弹窗为白色大圆角左右结构，左侧选项卡，右侧内容；样式参考用户提供的设置弹窗截图。
- 用户中心弹窗内容：`用户信息` 显示头像、登录邮箱、积分、生成图片数、生成视频数、已使用积分，占位值为 0；`帐号安全` 支持设置密码 / 修改密码并接后端接口；`设置` 放语言、默认进入页面、生成完成提醒、自动保存历史、本地缓存和版本信息占位。
- 新增 `/api/workspace-state`。登录用户工作台数据现在保存到 PostgreSQL 的 `UserWorkspaceState.state` JSON 中，包括历史对话、当前会话 ID、资产库、工作流、输入设置、反馈日志和意图纠错记忆。游客仍保存到原 `localStorage`。
- 工作台加载 / 保存策略已分流：访问 `/workspace` 时先调 `/api/auth/me`；如果已登录，读取数据库工作区，新账号初始为空；如果未登录，读取旧 `yinzao-*` localStorage，保留当前本机测试内容。登录用户后续数据用 500ms debounce 写回 `/api/workspace-state`。
- 排查记录：登录页显示“请求失败”时，根因是 Docker Desktop 未启动，数据库连不上导致认证接口 500。处理方式是启动 Docker Desktop，确认 `docker info` 正常，再执行 `docker compose up -d`。
- 排查记录：`npx prisma generate` 曾因 `query_engine-windows.dll.node` 被 dev server 占用而 `EPERM`；停止本项目 Node dev 进程后重新生成成功。
- 本轮验证：SMTP 自发自收测试通过；`npx prisma migrate dev --name user_workspace_state` 成功；`npm run lint` 通过；`npm run build` 通过。

### 2026-05-18 本轮对话：首页视觉、登录抽屉、工作台侧栏用户区和 GitHub 同步

- 首页继续重做。顶部中间导航、左侧英文小标签、说明文字和首页 CTA 已移除；右上角保留“登录”，并在其左侧新增临时白色按钮“进入工作台”，跳转 `/workspace`。
- 首页 Logo 细调：图形 Logo 保持 `50x50`；首页文字 Logo 高度改为 `30px`，用 `filter: brightness(0) invert(1)` 强制显示白色；工作台左上文字 Logo 从 `30px` 缩小到 `26px`。多次遇到 Tailwind 任意值 class 不生效，Logo 高度/定位等关键值优先用内联 style。
- 浏览器标签页图标已处理：项目里旧 `src/app/favicon.ico` 会覆盖 metadata 里的图标链接，因此已用 `public/home-assets/logo.png` 重新生成 `src/app/favicon.ico`，并新增 `src/app/icon.png`。`layout.tsx` 也保留 icon 链接。Next dev 黑色 `N` 按钮通过 `next.config.ts` 的 `devIndicators.position = "bottom-right"` 移到右下角，改配置后必须重启 dev server。
- 首页主视觉改为居中广告语和简化输入框。中文为 `方寸之间 · 大有可为`，英文为 `Small Space Big Ideas`；中文使用 `HarmonyOS Sans SC / PingFang SC / Microsoft YaHei UI / Microsoft YaHei / Noto Sans SC` 字体栈，字号 `100px`、透明度 `0.9`、正常字距；英文使用微软雅黑体系，字号 `40px`、字重 `300`。中文和输入框整体用 `top: 50%` + `translate(-50%, -50%)` 上下居中。
- 首页简化输入框为展示占位，不接生成逻辑。宽度 `700px`，圆角 `16px`，placeholder 为 `灵感一闪，创意即生...`，文字 `15px`，右侧发送按钮沿用工作台同款黑底 `36x36 / 10px` 圆角。输入框玻璃底已用内联 `backdropFilter`、渐变背景和阴影实现，但注意 `backdrop-filter` 只模糊框内背后内容，若要更明显的框下毛玻璃，需要额外加独立模糊底层。
- 首页登录交互从居中黑色弹窗改成右侧白色抽屉。打开时抽屉从右侧滑入，宽度 `min(33.333vw, 560px)`、最小 `420px`；底下首页视频和内容会向左推 `8vw` 并加 `blur(8px)`。关闭时恢复。关闭按钮改为 CSS 画的细 X，位置和尺寸用内联 style 控制，hover 旋转一圈。
- 登录抽屉内容已精简为占位：中间横排图形 Logo + 文字 Logo；下面是无底按钮 `密码登录 | 验证码登录`，中间竖线分隔；再下面只保留邮箱输入框。输入框高度 `64px`，最大宽度 `380px`，灰底；hover 边框淡蓝，focus 边框通用蓝 `#367cee`，底色不变。底部有协议提示 `登录即代表同意《用户协议》和《隐私政策》`。
- 工作台左侧栏底部新增用户占位区：上方全宽灰色分隔线，头像圆形占位、文字 `用户头像` 和邮箱 `user@example.com`。用户区总高度约 `64px`，内部按钮高 `44px`，内容用 `translateY(4px)` 微调居中。
- 点击工作台左侧底部用户区会弹出用户菜单，占位项为 `用户信息 / 用户安全 / 设置 / 退出登录`，每项前置图标。菜单宽度 `222px`，在左侧栏内居中，白底圆角细边框轻阴影；前三项高度 `44px`，hover 是内缩圆角灰色框；`退出登录` 区域为底部整块浅灰，高 `56px`，上方分隔线。菜单已支持点击其它空白区域关闭，点击菜单内部不关闭。
- 本轮发现并记录：项目全局有 `button { font: inherit; }`，按钮文字字号写在按钮 class 上经常不生效，必须写到内部 `span` 或内联 `style` 才稳定。后续改首页/侧栏这类 UI 时，也要优先检查 Tailwind 任意值 class 是否实际生成。

### 2026-05-18 本轮对话：输入框、Agent 规则、品牌 Logo 和交接更新

- Agent 回复显示已从“直接露出 Markdown 符号”改为“内部标记由网页渲染”。`src/lib/openrouter.ts` 仍允许 Agent 使用有限内部排版标记，前端 `FormattedMessage` 会渲染标题、加粗、分隔线、列表、红/蓝提示块；`####` 或更多级标题会兜底按三级标题处理，用户不应看到原始 `####` 或未闭合 `**`。
- Agent 长回复打字滚动已调整。此前 `TypewriterFormattedMessage` 每一帧都调用 `scrollIntoView`，长回复会把用户持续拉到底；现在 Agent 文字回复打字时不再持续跟随滚动，用户停留在原位置，图片/视频流程原有滚动不受影响。
- 输入框继续修复。`getEditableText()` 会把浏览器为保持 `contenteditable` 可编辑而自动插入的孤立 `<br>` 视为空字符串，删除最后一个字后能回到初始 placeholder 状态；普通输入/删除不再每次调用 `renderEditorContent()->replaceChildren()` 重建 DOM，只在粘贴文本、`Shift+Enter`、超长截断或外部值同步时重绘，减少光标乱跳。
- 输入框粘贴图片已修复。以前图片会同时进入上方缩略图和浏览器默认插入到 `contenteditable` 中，导致输入区域出现破图/图片小图标；现在图片粘贴分支会 `event.preventDefault()`，图片只进入上方参考图缩略图。
- 输入框长文本中间编辑已修复。之前 `activeInput` 每次变化都会强制 `editor.scrollTop = editor.scrollHeight`，导致用户回到前文插字也被拉到底部；现在只有光标在文本末尾时才自动滚到底，中间编辑保持当前位置。
- Agent 图片 prompt 规则已修正。`buildAgentSingleImagePrompt()` 不再默认追加“只生成一张独立照片 / 禁止拼图、合集、九宫格、多宫格、分屏、多张照片排版、照片墙 / 禁止把多张图片内容放进同一画面”等内部禁令，避免展示给用户并污染模型。只有用户明确要求不要拼图/合集或纠错时，才追加很短的“不要拼图或合集”。
- Agent 已新增“合并到一张”意图识别。只有用户原话明确包含 `合并到一张 / 放在一张图上 / 同一画面 / 多款放一起 / 多个方案在同一张` 等表达时，执行层才强制 `imageCount=1`。模型或 Planner 自己写的“展示图”不会再误触发单张模式，避免用户说“七张”却只生成 1 张。
- Agent 自动生图计数已修复。部分图片模型一次请求可能返回多张候选图，之前 Agent 发 6 次请求、每次返回 2 张时会显示 12 张；现在 Agent 自动生图每次请求只取第一张结果，保证“说 6 张就显示 6 张”。专业图片模式仍保留多候选图展示能力。
- 用户反馈 Agent 上下文理解“红框中的样子”不够稳定。当前根因仍是本地开发阶段参考图会转 base64，Planner 阶段为避免 413 默认不携带历史图片，只能从文字猜。后续服务器部署时应把上传图、资产图、历史参考图迁移为公网 HTTPS URL，再让 Planner 在用户说“红框 / 这个样子 / 参考这张 / 按图里”时携带最新 1-2 张低清参考图 URL。
- 品牌已继续细化为中文 `闪念`、英文 `FlashMuse`。页面左侧用中文，浏览器标题为 `闪念 FlashMuse`，OpenRouter `X-Title` 为 `FlashMuse`，包名为 `flashmuse`，内部 `yinzao-*` localStorage/CSS 命名仍保留。
- 首页和工作台 Logo 已改为直接使用普通 `<img src="/home-assets/logo.png">`，避免 `next/image` 在同名文件替换后继续显示旧优化缓存。当前图形 logo 显示尺寸为 `50x50`。
- Logo 素材处理记录：用户替换了 `public/home-assets/logo.png` 为新的图形 logo；此前生成的 `logo-original.png` 是白底备份，`logo-transparent-1024.png` / `logo-transparent-1024-v2.png` 是工具抠透明测试图，`public/home-assets/text/` 下是 4 个图片模型生成的候选图和 `summary.json`。模型不能可靠直接输出真实 alpha 透明 PNG，通常会生成棋盘格或绿幕，需要后处理。
- 从 `AI-Video-Assistant_Project Planning\Brand&logo Design\生成图片2.jpg` 提取了中文“闪念”文字，保存为 `public/home-assets/logo-text.png`。首页黑底视频上用 CSS `brightness-0 invert` 显示为白色，当前高度 `30px`；工作台浅底上保持黑色，当前高度 `26px`。工作台左上角结构为图形 logo + 右侧文字图，下方一行 `AI影片助手`。
- 本轮多次运行 `npm run lint`，均通过。

### 2026-05-18 平台更名为闪念

- 用户确认平台中文名为 `闪念`，英文名为 `FlashMuse`。
- 已更新页面左侧品牌名为 `闪念`，浏览器标题为 `闪念 FlashMuse`，OpenRouter `X-Title` 为 `FlashMuse`，Agent 系统提示自称、Planner 和意图分类器提示词为 `闪念`。
- `package.json` / `package-lock.json` 包名从 `yinzao` 改为 `flashmuse`。
- 内部 `localStorage` key、CSS class 和 keyframes 仍保留 `yinzao-*`，避免旧历史、资产、输入设置和样式失效。

### 2026-05-15 首页、邮箱登录占位、首页视频素材和 GitHub 同步

- 本轮新增独立首页：`/` 现在是全屏视频背景主页，顶部极简导航，右上角“登录”，主 CTA 为“邮箱登录”和“先进入工作台”。原聊天工作台迁移到 `/workspace`，避免首页和工作台耦合。
- 登录弹窗目前是假登录：只有邮箱和验证码输入框、获取验证码按钮和“登录并进入”按钮；不校验邮箱、不发送验证码，点击“登录并进入”直接跳 `/workspace`。用户明确表示功能先不用做，先做页面和弹窗交互。
- 首页视频素材统一放入 `public/home-assets/` 并已推送 GitHub。当前首页轮播 5 个视频：`hero-background.mp4`、`hero-dragon.mp4`、`hero-great-wall.mp4`、`hero-global-human.mp4`、`hero-mecha-robot.mp4`。播放逻辑为当前视频播放结束 `onEnded` 后再切下一条，底部 5 个小点可手动切换。
- 用户一开始要求类似 Kling / 即梦 / 通义万相 / 商汤 seko 的大气首页，后续明确希望背景视频风格为黑底、高对比、彩色流体 / 粉末爆发、动物 / 场景 / 人物 / 机器人同一视觉体系。曾生成过 `hero-animal / hero-landscape / hero-human / hero-robot`，用户删除了不要的旧素材；后续应以 `public/home-assets` 当前实际文件为准。
- 首页视频切换时曾用 `poster="/home-assets/hero-poster.jpg?v=..."` 导致静态图闪出；右下角预览图曾用 `next/image` 带查询参数导致 Next 报错 `images.localPatterns`。当前已去掉视频 `poster`，也去掉右下角预览卡片。
- 四张参考图生成并保存在同一目录：`hero-dragon-reference.jpg`、`hero-great-wall-reference.jpg`、`hero-global-human-reference.jpg`、`hero-mecha-robot-reference.jpg`。其中龙图多次重生，用户最终要求龙头大、朝左、只露头和少量脖子；提示词不要反复强调“不要文字”，否则模型反而容易在四角生成文字。
- 用参考图生成了 4 条视频：`hero-dragon.mp4`、`hero-great-wall.mp4`、`hero-global-human.mp4`、`hero-mecha-robot.mp4`。生成记录在 `public/home-assets/reference-videos-manifest.json`，参考图记录在 `reference-images-manifest.json`，第一条抽象背景记录在 `manifest.json`。
- 本轮还完成失败卡重试交互调整：图片 / 视频失败卡“重新生成”改为纯文字蓝色按钮，无底无边框；任意模式下点击哪个失败格子就原地变等待卡，等待计时从重试点击时重新开始，成功后填回原失败位置，不追加到末尾。
- 本轮调研 OpenRouter 音频模型：`google/lyria-3-pro-preview` / `google/lyria-3-clip-preview` 可用于歌曲 / 音乐生成，`openai/gpt-audio` / `openai/gpt-audio-mini` 可用于语音 / 自然配音，`openai/gpt-4o-audio-preview` 页面说明当前音频输出暂不支持，更适合音频输入理解。结论：可做“歌曲 -> MV”工作流，但角色固定音色仍需单独接音色克隆 TTS。
- 已生成 Word 文档：`AI-Video-Assistant_Project Planning\OpenRouter 音频模型功能和价格.docx`、`AI-Video-Assistant_Project Planning\首页视频和参考图提示词记录.docx`。规划目录仍未跟踪且含敏感压缩包密码说明，不要直接提交。
- 本轮按用户要求提交并推送 GitHub：`0c20e28 Update homepage media workspace` 到 `origin/main`。该提交包含首页、工作台路由、首页视频素材、失败重试逻辑和此前未推送的本地交互改动。推送后 `npm run build` 通过。注意：本条交接文档更新是在 `0c20e28` 之后追加，尚未再次提交。
- 本轮验证：多次 `npm run lint` 通过；推送后 `npm run build` 通过。

### 2026-05-15 资产管理上传、分批加载和提醒消息统一

- 资产管理页新增直接上传图片能力。入口在资产管理内容标题右侧，蓝色无底按钮，图标使用 Remix `upload-2-line`，文案为 `上传图片`。此前曾短暂放到顶部标题栏最右侧，后按用户要求恢复到内容标题右侧。
- 上传图片弹窗支持最多 `8` 张图片。弹窗内只显示一个 `80x80` 上传入口，用户选图后该位置变成缩略图，上传入口自动移动到下一个位置。支持一次多选；超过剩余上限时弹窗上方提醒 `最多同时上传8张`。
- 上传缩略图为 `80x80` 直角，图片使用 `object-contain` 完整显示不裁切；右上角删除按钮改为圆形并微调到更靠右上；底部加黑色渐变条，显示前端读取到的真实图片尺寸。
- 上传弹窗下方显示当前选中图片的文件名和分类。文件名标签改为 `文件名(支持改名)`，输入框右侧加灰底 `X` 清除按钮。用户清空后如果不重新输入，失焦或切换图片时恢复原文件名；上传时也用原文件名兜底。
- 分类滑块支持 `角色图片 / 场景图片 / 分镜图片`。上传后写入 `yinzao-assets-v1`，新资产带 `lockedType: true`，避免后续自动分类覆盖。上传接口复用 `/api/upload-image`，服务端保存到 `public/generated/upload_image` 并按内容 hash 去重。
- 重复图处理已完善：同 URL 已在资产库中时不重复添加。全部重复时弹窗不关闭，重复缩略图保留且边框变红，提醒 `图片已存在，无需要重复添加`。如果同一批既有新图又有重复图，新图先正常入库并从弹窗消失，弹窗只留下重复图红框。
- 成功上传新增绿色提醒消息：`成功上传X张图片`，前置图标为 `checkbox-circle-line`，绿色底色为 `#75d06a`。全部成功时弹窗立即关闭，成功提醒显示在页面上方；混合重复时弹窗不关闭，成功提醒和重复提醒按顺序显示。
- 项目中自动消失的提示统一命名为“提醒消息”。当前已统一输入框上方提醒和资产上传提醒：高度 `40px`，普通黑底，成功绿底；出现动画 `0.1s` 从上往下，停留 `2s`，消失动画 `0.1s` 从下往上；同一提醒显示期间相同文案不重复入队，不同文案按顺序排队。
- 资产管理列表改为分批渲染。初始渲染约 `30` 个资产，滚动接近底部再追加 `30` 个；进入资产管理和切换资产分类时滚动层自动回到顶部，避免资产多时卡顿和进入页面定位到中间。
- 本轮排查 Next dev 左下角 `N` 长时间停在 `Compiling...`：`npm run lint` 和 `npm run build` 均通过，确认代码无误，问题来自 dev 进程 / `.next` 缓存。已停止旧 `3000` 端口 Node 进程、清理 `.next` 后重启开发服务器。之后遇到 `.next/dev/types/routes.d.ts` 类型缓存错误，也通过清 `.next` 解决。
- 本轮主要涉及文件：`src/components/chat-workbench.tsx`、`src/app/globals.css`、多个 `handover/*.md`。验证：`npm run lint` 通过，清理 `.next` 后 `npm run build` 通过。

### 2026-05-15 输入框、@资产、Agent 图标和本地交互细调

- 本轮先确认 GitHub 状态：`cd89681 Fix Chinese IME input handling` 与 `5d9aae4 Update asset mention picker` 已推送到 `origin/main`。当前本地在 `5d9aae4` 之后继续有 `src/components/chat-workbench.tsx` 和交接文档改动，尚未再次推送。`AI-Video-Assistant_Project Planning/` 仍为未跟踪目录，不应直接上传。
- 修复其它电脑拼音输入法在 `contenteditable` 输入框中只能输入英文/拼音的问题。原因是输入法 composition 期间 `onInput -> renderEditorContent -> replaceChildren()` 会打断拼音候选。现在用 `isComposingRef` 保护 `compositionstart / compositionend`，composition 期间不重绘 DOM，结束后再同步文本和 `@` 高亮；同时加 `translate="no"`、`spellCheck={false}`、`autoCorrect="off"`、`autoCapitalize="off"` 和 Grammarly 禁用属性。
- `@` 资产弹窗增加 `待分类` 标签，只显示待分类里的图片；视频仍不显示也不能引用。弹窗分类改为 `角色图片 / 场景图片 / 分镜图片 / 待分类`，每类全部显示，不再 `slice(0, 8)` 限制。分类按钮文案改为 `角色图片(数量)`，弹窗加宽到 `380px` 并加 `whitespace-nowrap`，避免数量被挤到下一行。
- 如果当前资产库没有任何可引用图片，输入 `@`、点击 placeholder 里的 `@` 或底部 `@` 按钮时，统一在输入框上方黑色提示框显示 `当前资产库没有图片`，不打开空弹窗。
- 输入框可引用/上传参考图上限从 `5` 张改为 `10` 张。所有超限黑色提示统一为 `@或上传最多支持10张图片`，覆盖上传、`@资产`、资产管理引用和历史缩略图再引用。
- 输入框上方缩略图区区分来源：`@资产` 缩略图改为 `60x60`，普通上传图继续 `100x100`。
- 输入框新增透明无底的 `清空输入框` 按钮。只有当前输入框有文字、上传图或 `@资产` 时显示在输入框外右上方，图标为 `format-clear`，点击会清空草稿、上传图、`@资产` 参考图并关闭输入相关弹窗。因全局 `button { font: inherit; }`，按钮文字字号写在内部 `span` 上。
- `正在认真思考` 期间输入框视觉改为禁用态：输入内容区和左侧工具按钮整体淡化且不可点；黑色 `stop-fill` 停止按钮保持不淡化、可点击。顺手给专业模式模型/参数按钮补了 `disabled={isThinking}`。
- 修复 `Shift+Enter` 换行。旧实现虽然拦截了 `Shift+Enter`，但 `contenteditable` 中纯文本 `\n` 与浏览器 `<br>` 显示/光标不一致，导致多次换行后打字回到第二行。现在渲染时把换行变成 `<br>`，读取文本和计算光标偏移时都把 `<br>` 当作 `\n`，末尾空行用 `data-trailing-break` 视觉占位但不计入文本。
- Agent 回复图标改为 Remix `ri-ai`。`react-icons/ri` 没有导出 `RiAi`，所以项目内新增本地 `RiAiIcon`，SVG 来自用户指定的 `https://cdn.jsdelivr.net/npm/remixicon@4.9.1/icons/Editor/ai.svg`。输入框模式按钮里的 `Agent 模式` 图标也改为同一个 `RiAiIcon`。
- Agent 回复前置图标从左侧独立 flex 改成插入首行文本流的 `InlineAgentIcon`，解决普通段落、Markdown 标题、加粗标题、列表、提示块、Agent 自动媒体说明之间无法同时对齐的问题。专业 `图片生成 / 视频生成` 提示词块不加该图标。
- 本轮查了 OpenRouter 当前 `Seedance 2.0` 价格：页面说明为 `$7/M video tokens`，token 公式 `width * height * duration * 24 / 1024`。按 `100分钟=6000秒` 和项目汇率 `7.2` 估算：`1280x720` 约 `$907.20` / `¥6532`；`Seedance 2.0 Fast` 当前约 `$5.6/M video tokens`，同规格约 `¥5225`。费用会随真实输出尺寸和模型计费变化。
- 安全检查：`handover/` 中未发现 GitHub 密码、token 或 OpenRouter key 明文；但 `AI-Video-Assistant_Project Planning\README.md` 内有压缩包密码说明。该规划目录未跟踪，后续不要直接提交原目录。
- 本轮验证：多次 `npm run lint` 与 `npm run build` 均通过。

### 2026-05-15 Agent 多视频、停止思考、失败原地重试和视频恢复撤回

- 本轮用户反馈：Agent 按 10 个镜头生成分镜视频时理论应生成 10 个视频，但旧实现只生成 1 个；重启后该 1 个视频文件已落盘到 `public/generated/videos/...mp4`，但对话流里对应用户消息和视频结果消失。排查结论：视频文件保存发生在服务端，聊天历史保存在浏览器 `localStorage`，两者不是事务；旧代码视频消息结构只有 `videoUrl?: string`，也没有批量视频结构。
- Agent 视频生成已扩展为批量执行：Planner `items[]` 现在对视频也生效，一镜一段视频并发创建 `/api/video` 任务；若 Planner 只返回 `count > 1` 但没返回 items，会按 count 兜底创建多段视频任务，避免再次只生成 1 个。
- Agent 分镜视频时长规则已加入 Planner 和规则文档：把文字分镜、图片分镜或多个镜头做成视频时，`count` 必须等于镜头数，`items[]` 必须一镜一段；每段 `duration` 应按该镜头分镜内容、动作复杂度或剧本时长判断，不能默认全部用最低秒数。只有用户随便要求生成一个普通单段视频且没有分镜/镜头上下文时，才使用当前模型最低时长。
- Agent 视频消息结构已支持多视频：新增 `videos[] / videoPrompts / videoDimensionsMap / pendingVideoCount / failedVideoCount` 等字段。成功视频、等待卡、失败卡现在合并在同一个两列 grid 中渲染，一行 2 个，超过自动换行；单个视频保持左半宽。视频等待卡、成功卡、失败卡统一 `360px` 高度、`10px` 圆角和相同间距。
- Agent 视频失败卡的“重新生成”已改为原地重试：点击失败卡后，当前失败格子原地变等待卡，成功后填回同一条消息的同一组 grid，不再在下方新增一条新的 assistant 视频消息。图片失败卡本来已在同一个 `ImageResultStrip` 中混排；本轮也统一了图片/视频失败卡按钮样式。
- 失败卡中的“重新生成”按钮改为居中显示，图标为 `reset-left-line`，按钮为灰色空心样式：透明底、灰色边框、灰色文字和图标。
- 本轮曾临时加入 `/api/video-recovery` 和启动时扫描 `public/generated/videos` 的自动恢复逻辑，用于把未写入对话流的本地视频补回当前对话。用户重启后发现该逻辑恢复了更早的测试视频，因此已撤回：删除 `/api/video-recovery`，前端不再自动扫描和恢复旧视频。`src/lib/video-manifest.ts` 仍保留，用于 `/api/video` 保存任务 manifest，但目前只记录，不自动写回聊天。
- `saveSessions()` 的危险兜底已修正：旧逻辑在两次 `localStorage.setItem` 都失败时会 `removeItem(STORAGE_KEY)`，可能导致历史整体丢失；现在失败时只 `console.warn`，保留上一次成功保存的历史。
- 输入框发送按钮已改成正方形 `36x36`，圆角保持 `10px`；默认用 `arrow-up-line` 图标，不显示“发送”文字。Agent 正在思考时，输入框其它控件仍禁用，但发送按钮变为黑色可点击的 `stop-fill` 停止按钮，并带走光动画。
- 点击停止按钮会中断当前 Agent 思考请求，清掉当前 Agent pending，并在对话流插入系统消息 `已中断思考`。非红字系统消息顶部新增灰色横线；红字错误系统消息不加横线。
- 修复多处 Next dev 红色 `N` 里的图片尺寸 warning：部分 `next/image` 使用 `h-full w-full object-cover` 时补充 `style={{ width: "100%", height: "100%" }}`，避免只改宽高一边的提示。
- 本轮中途按用户要求已提交并推送 GitHub：`89723bf Update agent media generation flow` 到 `origin/main`。注意：该提交之后又继续做了停止按钮、视频 grid、失败原地重试和本文档更新；如果需要同步 GitHub，需要再次提交推送。
- 本轮涉及文件主要包括：`src/components/chat-workbench.tsx`、`src/app/globals.css`、`src/app/api/video/route.ts`、`src/lib/openrouter.ts`、`src/lib/video-manifest.ts`、`AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md`、多个 `handover/*.md`。
- 本轮验证：多次运行 `npm run lint` 和 `npm run build`，最终均通过。

### 2026-05-14 Agent 意图理解、逐图提示词、上下文瘦身和提示词 UI 更新

- 本轮重点围绕 Agent 模式的真实意图理解和最终行为修正。用户明确要求：后续所有 Agent 对话逻辑都必须优先保证“像人一样自然对话”，这条规则高于其它执行细节；内部执行约束不能机械复读给用户。
- Agent 多图生成已进一步拆分。Planner 支持可选 `items[]`，每个 item 是单张图片/单段视频自己的干净执行 prompt。多图任务优先按 `items[index].prompt` 请求，不再把用户原话、Agent 理解说明、跨图规则和真实提示词混在一起发给图片模型。
- 多图提示词规则更新：用户说“生成 N 张图片”只代表生成数量；用户说“每张不同人物/国家/性别/时代”时，差异必须拆到每个 item 的独立 prompt 中。跨图规则如“每张都要不同”“10张图片必须彼此不同”不能进入单张图片 prompt。
- Agent 图片结果现在按图片 URL 保存真实发送提示词：`message.imagePrompts[url] = itemPrompt`。预览页优先展示当前图片自己的真实 prompt；旧图没有 `imagePrompts` 时才显示清洗后的 fallback，避免继续把中文理解说明当作提示词展示。
- Agent 自动生成图片/视频结果下方新增可点击提示词折叠条，位置在 Agent 文案下面、媒体结果上面。折叠态为淡灰底、灰字、右侧下三角；展开后上下连成一个淡灰面板，顶部显示“图片提示词/视频提示词”、分页 `<1/5>`、`使用提示词` 和上三角，正文区域最高约 `180px`，超出滚动。
- Agent 多张图片若每张提示词不同，展开面板显示分页；分页按钮无底色，并与 `使用提示词` 保持较大间距。点击 `使用提示词` 会把当前页提示词填入输入框。专业图片/视频模式原有提示词展示不受影响。
- Agent 展示文案已改自然化。默认只说类似“我会生成 6 张美女图 / 我会生成 10 张不同设定的人物图 / 我会生成 6 张场景图”，不再默认暴露“单张独立、不做拼图或合集”等内部约束。只有用户明确要求不要拼图/合集或反馈上次生成错了，才自然补充相关说明。
- Agent “只要场景，不要人物”场景已做成硬规则。Planner 被要求以最新用户纠错覆盖旧上下文；执行层会清理 `person / portrait / character / human / figure / silhouette / 人物 / 角色 / 行人 / 剪影` 等人物词，并追加无人物场景约束，包括英文 `no people, no person, no human, no character, no figure, no silhouette`。
- Agent 文本回复阶段已修复 413 根因：以前 `toChatPayloadMessages` 会把历史 assistant 消息中的图片带进 `/api/chat`，本地图再转 base64，历史图多时触发 `Request Entity Too Large`。现在 Agent 使用 `toAgentPayloadMessages`，默认移除历史图片载荷，只在本轮明确上传图或引用资产时保留最新用户消息里的参考图。
- Agent `/api/chat` 已增加 413 纯文本重试：如果文本回复或提示词整理阶段仍因请求体过大失败，会自动改用纯文本上下文重试。真正生图/生视频阶段的参考图链路不受影响。
- 用户要求所有用户可见提示里去掉 `OpenRouter` 字样。当前已把前端/接口返回给用户的错误文案改为“请求失败 / 图片生成失败 / 视频任务创建失败 / 平台服务临时异常”等通用表述，`toUserErrorMessage` 也会把底层错误里的 `OpenRouter` 替换为“平台”。内部函数名、日志和技术文档不改。
- 公网部署提醒已写入交接文档：上传图、资产图、历史参考图正式部署前必须改为 HTTPS URL 传给 OpenRouter，不再传 base64，以减少 413 并保留原图质量。
- 本轮主要涉及文件：`src/components/chat-workbench.tsx`、`src/lib/openrouter.ts`、`src/lib/openrouter-video.ts`、`src/lib/error-message.ts`、`src/app/api/video/route.ts`、`handover/00-README.md`、`handover/02-product-decisions.md`、`handover/03-progress-and-status.md`、`handover/05-chat-history-highlights.md`、`handover/CHANGELOG.md`。
- 本轮验证：多次运行 `npm run lint` 和 `npm run build`，最终均通过。

### 2026-05-14 Agent Planner、Agent 生成规则、错误中文化和规则文档更新

- 本轮用户要求后续先看 `AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md`。该文件会持续更新；接手 AI 应先读该文档，对照当前实现列出变化项，再让用户决定是否改。
- Agent 模式已从硬规则/简单意图分类升级为结构化 Planner。新增 `/api/agent-plan`，服务端入口为 `src/app/api/agent-plan/route.ts`，核心逻辑在 `src/lib/openrouter.ts` 的 `planAgentTask`。Planner 返回 `intent / needsClarification / clarifyQuestion / displayText / count / subject / quality / ratio / resolution / duration / prompt / constraints / suggestions`。
- Agent Planner 的目标不是每次追问所有参数，而是“能判断就直接干，不确定才问”。如果目标不清、图片/视频都可能、缺失信息会明显导致错、用户要求冲突或规格成本过高，才用 `needsClarification` 追问。
- Agent 自动生图/生视频现在把“数量”和“单张/单段 prompt”拆开。比如“七张，每张只要一个美女，高品质”应拆成 `count=7`、每张单人、禁止拼图/合集/多人同框，不再把“七张”塞进单张图片 prompt。
- Agent 不再本地问候直回；所有 Agent 输入都进入思考流程。`正在认真思考` 最少显示 `2000ms`，文字和后面三个点已有走光/跳动动画。Agent 意图/规划阶段写入 `pendingRequests`，刷新浏览器后会恢复并继续执行。
- Agent 自动生成媒体结果显示规则已按用户文档调整：不显示专业模式提示词参数行，只显示简短执行说明 + 图片/视频结果，不重复用户原话。图片一行 4 个，超过换行不分页；Agent 媒体等待卡、失败卡和显示底框使用 `10px` 圆角；失败卡内有“重新生成”。
- Agent 生成模型调用规则已重定：普通 Agent 固定图片 `Seedream 4.5`、视频 `Seedance 2.0 Fast`。高级 Agent 默认优先当前专业模式选择模型，不因“高品质/高清/精细/质量好一点”直接换贵模型；用户多次不满意才升质量，多次抱怨慢才切快稳；整体优先便宜。
- `Veo 3.1` 的调用规则很严格：只在用户明确要求“4K 视频 / 视频要 4K / 输出 4K 分辨率视频”等视频输出规格时调用。`4K画质 / 4K质感 / 高清 / 高品质 / 电影感` 不算明确 4K 视频要求，不触发 Veo。
- 用户确认模型排序表：价格/质量按用户指定顺序，不按 OpenRouter 官方价格自动推断。`对话流三种模式基础规则.md` 中已放入定宽 Markdown 表格，避免编辑器列不对齐。
- Agent Planner 阶段不再携带 base64 图片，只传文字和“本轮带了几张参考图”的提示，避免 `/api/agent-plan` 请求体过大导致 `413 Request Entity Too Large`。真正图片/视频生成阶段仍按原参考图链路处理。
- 红字错误显示已统一中文化。新增 `src/lib/error-message.ts`，前端 `readJson` 和主要 API catch 都使用 `toUserErrorMessage` 清洗错误，避免 HTML、代码、堆栈直接显示给用户。常见 413、401、403、429、500、敏感图、参数不支持等都会转成中文可读提示。
- 系统提示 UI 已修正：普通系统提示和错误系统提示的图标都与第一行文字顶部对齐，不再多行文本中垂直居中。
- 本轮涉及文件主要包括：`src/components/chat-workbench.tsx`、`src/lib/openrouter.ts`、`src/lib/error-message.ts`、`src/app/api/agent-plan/route.ts`、多个 `src/app/api/*/route.ts`、`AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md`。
- 本轮验证：相关改动后多次运行 `npm run lint` 和 `npm run build`，最终均通过。

### 2026-05-13 本轮对话补充：用量统计扩展到图片/视频、浮窗微调、品牌更名

- 用户要求右上角当前会话用量必须累计当前对话流里的所有 Token 和费用，包括对话、意图识别、图片和视频。当前已把 `/api/image` 返回的 `usage` 透传到前端，并在多图并发时按每张图返回的 usage 累加；`/api/video` 会从视频创建/查询响应里提取 `usage.cost` 并返回给前端。
- 前端 `src/components/chat-workbench.tsx` 已在图片生成成功后调用 `addSessionUsage(sessionId, imageResult.usage)`，视频任务创建返回 usage 时立即累计；如果创建时没有 usage，则在最终成功或失败查询返回 usage 时累计一次，避免轮询重复加钱。
- `src/lib/openrouter.ts` 的 `getUsageMeta` 已允许只有 `usage.cost`、没有 token 的响应进入统计；图片生成 `createOne` 会返回 `usage`，最终 `generateOpenRouterImage` 会把多次结果的 usage 汇总后返回。
- `src/app/api/video/route.ts` 新增 `getUsageMeta`，兼容 `usage.cost / cost / usd / totalCost / total_cost / amount` 等字段；本轮确认 OpenRouter 视频任务返回结构为 `usage: { cost, is_byok }`，视频通常不返回 `prompt_tokens / completion_tokens / total_tokens`。
- 本轮实测 `/api/image` 生成 1 张 `Seedream 4.5 / 1:1 / 2K` 图片，返回 `usage: { promptTokens: 4, completionTokens: 16384, totalTokens: 16388, usd: 0.04 }`。说明图片返回 Token 和费用，右上角应同时加 Token 和金额。
- 本轮用已有视频任务 `https://openrouter.ai/api/v1/videos/P14NkUI1MIBIgF3op7KG` 查询 `/api/video`，返回 `usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, usd: 0.84 }`。说明视频只加费用，不加 Token。
- 右上角用量浮窗 UI 已继续微调：黑色底框缩小，三行数字行距压紧，顶部新增灰色小标题 `使用量`，标题字号缩小到 `11px`；人民币文案从 `约 ¥0.00` 改为 `¥0.00 约`。
- 用户曾确认阶段性品牌名，并替换页面左侧品牌名、浏览器标题、OpenRouter `X-Title`、Agent 系统提示自称和意图分类器提示词；2026-05-18 已进一步改为 `闪念 / FlashMuse`。`localStorage` key 里的 `yinzao-*` 和 CSS class/keyframes 里的 `yinzao-*` 暂不改，避免旧历史、资产、输入设置和样式失效。
- 本轮验证：`npm run lint` 通过，`npm run build` 通过。

### 2026-05-13 品牌名阶段性更新

- 用户曾确认阶段性品牌名。当前品牌已在 2026-05-18 改为 `闪念 / FlashMuse`，页面左侧品牌名以 `闪念` 为准，浏览器标题为 `闪念 FlashMuse`，OpenRouter `X-Title` 以 `FlashMuse` 为准。
- 为避免本地历史对话、资产库、输入设置和反馈日志丢失，`localStorage` key 里的 `yinzao-*` 暂不更名；CSS class / animation 内部技术命名也暂不更名。

### 2026-05-13 Agent 高级/普通、错误系统消息、预览页、费用统计和输入禁用

- 本轮围绕 Agent 可用性、输入框、预览页和会话费用统计继续调整。用户反馈 Agent 模式连续出现 `OpenRouter 请求失败：Internal Server Error`。排查确认不是前端断连，而是 OpenRouter `chat/completions` 偶发 500；此前图片和视频查询已实测过 Node `fetch` 偶发假 500/404，而同请求 `curl.exe` 可成功。
- `src/lib/openrouter.ts` 已给 `/api/chat` 对话请求和 `/api/intent` 意图识别请求加 `curlPostJson` 兜底：先用 `fetch`，非 2xx 时用相同 URL、headers 和 body 调 `curl.exe` 重试；两边都失败才返回错误。用户确认后实测 Agent 又能正常连上。
- Agent 请求失败展示规则已改：失败不再生成 `assistant` 回复，不再显示反馈按钮、重新生成、喜欢/不喜欢等，而是追加/兼容渲染为 `system` 消息。错误系统消息继续用红字，只显示原始错误，如 `OpenRouter 请求失败：Internal Server Error`。
- 错误系统消息图标改为 `RiErrorWarningLine`。普通系统消息如果没有指定模式切换文案，也会按系统消息文字直接显示，不再误套“当前已切换到 Agent 模式”说明。
- Agent 工具栏在 `@` 按钮后新增 `普通 / 高级` 滑块按钮：`普通` 使用 `bytedance-seed/seed-2.0-lite`，`高级` 使用 `openai/gpt-5.4`。该选择保存到 `yinzao-input-settings-v1`，刷新后保留；Agent 对话、意图识别、Agent 重新生成都会跟随该选择。
- 切换 `普通 / 高级` 时会插入灰色系统消息：`当前已切换至普通模式` 或 `当前已切换至高级模式`。重复点击当前档位不重复插入消息。
- 文案微调：思考提示改为 `正在认真思考`；反馈文案改为 `感谢反馈`；空会话标题改为 `今天你有什么想做的？`。
- 用户反馈正在输入中文时突然变成英文。排查代码后确认项目没有边输入边翻译逻辑，最可能是浏览器网页翻译、翻译插件、输入法/AI 写作助手对 `contenteditable` 输入框做了 DOM 文本替换。建议后续给输入框增加 `translate="no"`、`spellCheck={false}`、`autoCorrect="off"`、`autoCapitalize="off"`、Grammarly 相关禁用属性。
- 预览页视频右上角下载按钮已加回：图片和视频预览都显示黑色 `下载` 按钮，视频会使用当前本地视频 URL 下载，文件名会自动补 `.mp4`，图片自动补图片后缀。
- 图片预览页缩放逻辑多轮修正：改用原生 `<img>` 获取真实 `naturalWidth / naturalHeight`，避免 `next/image width={2000}` 参与预览尺寸；`实际尺寸` 应按图片真实像素 `100%` 显示，浏览器拉大缩小不改变实际尺寸显示；`适合尺寸` 按左侧预览容器实时计算比例，窗口变化时重新计算；滚轮和 `+ / -` 范围仍为 `10% - 250%`。注意：用户最后仍反馈适合尺寸看起来没有撑满期望区域，下一任 AI 需继续按用户视觉要求核对 contain/cover 预期。
- 预览页右侧缩略图列表自动定位修复：打开预览时先按 `id` 定位当前缩略图，找不到再按图片 URL 定位；缩略图按钮新增 `data-preview-thumb-url`。
- 顶部标题栏右侧新增会话级用量图标，鼠标悬停显示黑底白字浮层。当前显示灰色小标题 `使用量`，下方三行：`Token x,xxx`、`$0.0000`、`¥0.00 约`，人民币固定按 `1 USD = 7.2 CNY`。没有用量时显示 `暂无用量`。
- 费用统计当前已接入文本、图片和视频：`/api/chat`、`/api/intent`、`/api/image` 和 `/api/video` 会把 OpenRouter 返回的 `usage/cost` 带回前端，累加到当前 `WorkSession.usageSummary` 并保存进本地历史。文本和图片可能返回 Token + 费用；视频通常只返回 `cost`，所以只累计金额不累计 Token。
- 正在认真思考期间，当前会话输入框整体进入禁用状态：`contenteditable=false`、不可输入/粘贴/Enter 发送，发送按钮禁用，上传、`@`、模式切换、普通/高级按钮禁用，已打开的输入相关弹窗会关闭。思考结束后恢复。
- 本轮中途已按用户要求把当时最新代码推送到 GitHub：提交 `5855bc4 Update media workspace interactions` 到 `origin/main`。注意：后续本轮继续做的预览缩略图定位、会话费用统计、思考中输入禁用、文档更新等改动尚未在该提交中，下一次推送需重新提交。
- 本轮多次验证：相关改动后的 `npm run lint` 和 `npm run build` 通过。

### 2026-05-13 视频生成最终改为不传 size、实测尺寸 UI 做实、文档更新

- 本轮继续围绕视频模型尺寸和参数排查。用户先要求按当前 UI 中接入的 6 个视频模型、所有支持分辨率和比例、最低时长并发测试，不包含智能比例。`scripts/test-video-models.mjs` 已调整为按当前模型支持项测试，共 `49` 次，测试结果输出到 `AI-Video-Assistant_Project Planning\test\video-model-test-results.md` 和 `video-model-test-raw.json`。
- 全量测试结论：成功 `45/49`，失败 `4`。失败全部为 Seedance 系列 `9:21`：`Seedance 2.0 Fast 480p/720p 9:21`、`Seedance 2.0 480p/720p 9:21`，OpenRouter / 上游返回 `the parameter ratio specified in the request is not valid`。因此项目端已从视频 UI 和 `src/lib/models.ts` 中移除所有 `9:21` 支持项。
- 全量测试显示大量模型会返回非官方标准尺寸。当前 UI 显示尺寸按实测实际输出写入 `src/lib/models.ts` 的 `videoModelRules.sizes`：Seedance 2.0 Fast / Seedance 2.0 的 `21:9 / 4:3 / 1:1 / 3:4` 多数为非标，`480p 16:9 / 9:16` 也有轻微非标；Kling Standard / Pro 的 `1:1` 实际为 `960x960`；Kling Video O1 实际输出为 `1920x1080 / 1440x1440 / 1080x1920`。
- 根据实测，`Kling Video O1` 虽 OpenRouter 官方只标 `720p`，但实际输出为 1080p 尺寸，所以项目 UI 中该模型分辨率按钮显示为 `全高清1080p`，时长仍为 `5秒 / 10秒`。
- 用户发现把实测非标尺寸如 `992x432`、`960x960` 作为请求 `size` 会报 `Unsupported size`。随后单独测试 `Seedance 2.0 Fast` 只传 `resolution + aspect_ratio`、不传 `size`，输出尺寸与之前传 `size` 的实测尺寸一致。
- 继续按用户要求测试其它所有模型的所有当前支持比例和分辨率，不传 `size`，只传 `resolution + aspect_ratio`。新增 `scripts/test-video-models-no-size.mjs`，测试结果输出到 `AI-Video-Assistant_Project Planning\test\video-model-no-size-test-results.md` 和 `video-model-no-size-test-raw.json`。其它 5 个模型共 `33` 次，成功 `33/33`，全部与上一轮实测尺寸一致。
- 最终项目视频创建请求已改为不传 `size`。当前 `src/lib/openrouter-video.ts` 只传 `resolution`、`aspect_ratio`、`duration`、`generate_audio` 和可选 `input_references`。`src/lib/models.ts` 中已移除 `requestSizes / requestSize` 这套容易误用的请求尺寸逻辑，只保留 UI/显示用的实测输出尺寸和 `nonStandardSizes` 标记。
- 视频参数弹窗、对话流、预览页已统一：非标准实际尺寸在“尺寸”标题或尺寸文本后显示 `（非标）`；结果流和预览页仍优先使用真实 video metadata，未读到 metadata 时使用 `models.ts` 中的实测尺寸兜底。视频 `4K` 参数图标修正为显示 `4K`，不再误显示 `HD`。
- 图片和视频的参数弹窗宽度统一为 `420px`；视频比例/分辨率按钮保持单行。`9:21` 图标修正后又因该比例从 UI 移除，当前项目内已无 `9:21` 视频比例支持项。
- 图片模型菜单中的 `GPT-5.4 Image 2` 和视频模型菜单中的 `Seedance 2.0` 文字改为金色；对应模型被选中后，工具栏按钮上的模型名也显示金色。
- 结果提示词区 hover 展开逻辑反复调整后，当前规则为：如果 `使用提示词` 按钮已经在正文后可见，则不显示 hover 展开层；只有按钮也被截掉、正文确实放不下时才显示完整浮层。`ReferencedTextContent` 外层从 `inline-flex` 改成普通 inline 文本流，避免按钮错误换行或重复出现。
- 本轮新增/更新 Word 文档：`AI-Video-Assistant_Project Planning\视频模型测试结果表.docx`、`图片模型尺寸测试表.docx`、`openrouter 视频模型支持比例和分辨率.docx`。三个文档均改为只有横线分隔的表格样式，青绿色强调参数文字；视频测试结果表中失败/不一致项保留红字。
- 本轮新增/更新脚本：`scripts/create-video-test-docx.mjs`、`scripts/create-image-size-docx.mjs`、`scripts/create-openrouter-video-support-docx.mjs`、`scripts/test-video-models-no-size.mjs`，并更新 `scripts/test-video-models.mjs` 为不传 `size` 的视频测试方式。
- 本轮验证：`npm run lint` 通过且无 warning；`npm run build` 通过。

### 2026-05-12 视频模型官方 size 参数、能力表、测试脚本和 UI 做实

- 本轮用户要求系统测试视频模型质量和尺寸比例，并明确要求排查是否又像图片生成一样传错字段。新增 `scripts/test-video-models.mjs`，并把测试视频和结果输出到 `AI-Video-Assistant_Project Planning\test`，结果表为 `video-model-test-results.md`。
- 首轮视频测试按模型并发请求，后续根据用户要求改为最低秒数并发测试，并为 `9:16 / 1:1 / 21:9 / 3:4 / 4:3` 各自使用不同提示词。视频文件按 `模型名_比例_720p/1080p.mp4` 命名。
- 测试结论显示大量失败和尺寸不一致：`Seedance 2.0 Fast` 不支持 `1080p`，Kling 系列不支持 `21:9 / 3:4 / 4:3`，Veo 只支持 `16:9 / 9:16`，`Kling Video O1` 会返回比请求更高的尺寸。后续查官方能力表后确认这些大多是模型能力限制。
- 用户要求移除 `Sora 2 Pro`，当前 `src/lib/models.ts` 的 `videoGenerationModels` 已删除 `openai/sora-2-pro`，`src/lib/openrouter-video.ts` 也删除了 Sora 专用时长、比例和音频参数逻辑。
- 查 OpenRouter `openapi.json` 确认视频生成接口 `POST /api/v1/videos` 的请求 schema 支持 `size` 字段，含义是精确像素尺寸 `WIDTHxHEIGHT`，官方说明可与 `resolution + aspect_ratio` 互换。
- 查 OpenRouter `/api/v1/videos/models` 后，把官方视频能力表写入 `src/lib/models.ts` 的 `videoModelRules`：Seedance Fast 为 `480p / 720p`，Seedance 2.0 为 `480p / 720p / 1080p`，Kling Standard / Pro / O1 为 `720p`，Veo 3.1 为 `720p / 1080p / 4K`。
- 视频生成后端 `src/lib/openrouter-video.ts` 已改为传官方精确 `size`，例如 `1280x720`、`1080x1920`、`2520x1080`，不再依赖 `resolution + aspect_ratio` 让 OpenRouter 换算，避免字段歧义。
- 视频模型菜单和画面设置 UI 已按官方支持项动态显示：切换模型后，比例、分辨率、时长都会自动回落到当前模型支持值。Kling Video O1 的时长只显示 `5秒 / 10秒`。
- 视频“智能比例”已保留，规则固定为所有当前保留模型都支持的 `16:9 / 1280x720`，实际请求传 `size: "1280x720"`；选择智能比例时分辨率区淡化并禁用。
- 视频比例按钮顺序调整为 `智能比例 -> 21:9 -> 16:9 -> 4:3 -> 1:1 -> 3:4 -> 9:16 -> 9:21`，实际只显示当前模型支持项；比例区域已改成 `grid-flow-col + auto-cols-fr`，无论 7 / 8 / 9 个比例都强制单行显示。
- 视频分辨率按钮文案改为 `标清480p / 高清720p / 全高清1080p / 4K`，按钮前置图标统一为黑底白字 `SD / HD / FHD / 4K`。对话流和预览页的视频参数图标也改为同规格黑底白字。
- 视频对话流和预览页参数显示已修正为“生成什么显示什么”：读到视频 metadata 后显示真实比例、真实尺寸和对应 `SD / HD / FHD / 4K`；未读到 metadata 时先显示本次实际请求的官方 `size`。智能比例不会再显示为“智能比例”，而是显示实际执行的 `16:9 / 1280 x 720 / HD`。
- 本轮验证：`npm run lint` 通过，仍有旧 warning：`scripts/create-image-size-docx.mjs` 中 `existsSync` 未使用；`npm run build` 通过。

### 2026-05-12 图片尺寸参数纠正、去超分、多返回图切换和启动脚本修复

- 本轮重新核对图片尺寸能力后确认：旧结论“Gemini / GPT 只能出 1K、Seedream 4K 不行”是错误结论，根因是此前使用了不生效的字段 `size` 或只传 `aspect_ratio`。当前 OpenRouter 实测生效字段为 `image_config.image_size`。
- 当前图片请求参数已改为 `image_config: { aspect_ratio, image_size }`。服务端日志会打印 `[image-generation] OpenRouter request params`，其中包括模型、比例、分辨率、`modalities`、`image_config` 和期望尺寸。
- 本地超分增强链路已全部移除。`sharp` 依赖已从 `package.json` 删除；`src/lib/local-assets.ts` 中的 `upscaleGeneratedImageAsset` 已删除；`src/lib/openrouter.ts` 保存模型返回图片后只读取真实尺寸，不再 resize / upscale。
- 最新图片档位规则：`Seedream 4.5` 开放 `2K / 4K`；`Gemini 3.1 Flash Image Preview` 开放 `1K / 2K / 4K`；`Gemini 3 Pro Image Preview` 按用户要求开放 `1K / 2K / 4K`；`GPT-5.4 Image 2` 只开放 `1K / 2K`，`4K` 报错 `image_size: Invalid option: expected one of "1K"|"2K"`。
- 最新尺寸表已整理成 `AI-Video-Assistant_Project Planning\图片模型尺寸测试表.md`，并在桌面生成 Word 文档 `C:\Users\ASUS\Desktop\图片模型尺寸测试表.docx`。Word 文档使用原生表格，列对齐。
- `4K` 显示规则已调整：按钮和菜单中显示金色 `超清4K`；对话流和预览页参数行中，尺寸后先显示普通 `4K` 图标，图标后只在 4K 时显示金色 `超清4K`；`1K / 2K` 不显示额外标签。
- OpenRouter / Gemini 3 Pro 可能一次响应返回多张候选图。实测出现同一请求同时返回 `1376×768` 和 `2752×1536`，项目端不是超分。当前逻辑改为全部保存、全部入库、同一批展示。
- 多返回图显示规则已更新：同一批里如果出现不同尺寸，按尺寸分组；参数行右侧显示 `< 1/2 >` 尺寸组切换，切换后模型 / 比例 / 尺寸 / 分辨率图标会跟随当前组变化；默认第一页为最接近目标尺寸的组。
- 同一尺寸组内最多显示 `4` 张图，超过 `4` 张时在图片区域右下角显示 `< 1/2 >` 分页切换，不再出现横向滚动条。
- 长提示词完整浮层的 hover 触发区域已限制在提示词正文区域，不再覆盖参数行，避免挡住尺寸组切换按钮。
- 根目录启动脚本已修复：`scripts/start-project.ps1` 增加 mutex 防重复 worker，健康检查改为 `127.0.0.1:3000`，打开网页改用 `explorer.exe http://localhost:3000`，等待时间加到 5 分钟。排查时发现旧的 `.next/dev` 缓存损坏会导致 `build-manifest.json` 缺失，处理方式是停旧项目进程、删除 `.next` 后重启。
- 本轮验证：多次 `npm run lint` 和 `npm run build` 通过。

### 2026-05-12 本地启动慢原因和服务器部署优化记录

- 用户反馈本地项目重启后第一次打开很慢。已记录原因：本地 `npm run dev` 是开发模式，会启动开发服务器、生成 `.next/dev` 缓存、首次访问即时编译页面和 API；Windows 文件扫描 / 杀毒、`node_modules` 文件量和当前 `chat-workbench.tsx` 体积较大也会放大冷启动时间。
- 已确认这不代表正式部署后网页也会同样慢。线上应使用 `npm run build` + `npm run start` 或等价预构建部署，不要用 `npm run dev` 跑线上；生产模式会提前编译，首屏通常明显快于本地开发模式。
- 后续服务器部署优化待办：拆分 `src/components/chat-workbench.tsx`，把输入框、媒体结果、预览页、资产管理、工作流等拆成独立组件；减少首页首包，必要时做动态加载。
- 后续部署还需规划：常驻 Node 进程或预构建平台、API 冷启动、生成任务队列、超时 / 重试、并发限流、日志监控、环境变量管理、`public/generated` 持久化、对象存储和 CDN。
- 注意区分：网页首屏慢与图片 / 视频生成慢不是一类问题。图片 / 视频生成耗时主要来自 OpenRouter / 模型排队和生成任务本身。

### 2026-05-12 图片原生尺寸基准、21:9、增强超分和参数显示规则

- 本轮先按用户要求重测 5 个图片模型，只传 `image_config.aspect_ratio`，不传 `size`、不传 `1K / 2K / 4K`。测试比例为 `1:1 / 16:9 / 9:16 / 21:9 / 4:3`。
- 用户确认这组只传比例的结果作为图片模型“原生尺寸”基准：Seedream 4.5 为 `2048x2048 / 2560x1440 / 1440x2560 / 3024x1296 / 2304x1728`；Gemini 3.1 Flash 为 `1024x1024 / 1376x768 / 768x1376 / 1584x672 / 1200x896`；Gemini 3 Pro 与 Gemini 3.1 Flash 相同；GPT-5.4 Image 2 为 `1024x1024 / 1280x720 / 720x1280 / 1568x672 / 1152x864`。
- `GPT-5 Image` 在只传比例测试中全部输出 `1024x1024`，比例基本不生效，已从 `imageGenerationModels` 移除。
- 图片比例新增 `21:9`，并按用户要求放在 `智能比例` 后面。`21:9` 不做超分，只显示一个原生分辨率按钮：Seedream 4.5 显示 `高清2K`，其它图片模型显示 `高清1K`；当分辨率区域只有一个按钮时，按钮会横向占满整行。
- 图片分辨率按钮规则已改成原生 + 增强两档：Seedream 4.5 为 `高清2K / 增强4K`；Gemini 3.1 Flash、Gemini 3 Pro、GPT-5.4 Image 2 为 `高清1K / 增强2K`。原生档位不加增强标签，增强档位使用金色显示。
- 图片请求参数已改为只向 OpenRouter 传 `aspect_ratio`，不再传 `size / 1K / 2K / 4K`。服务端仍按模型保留 `modalities`：Seedream 为 `['image']`，Gemini / GPT 系列为 `['image','text']`。此规则只作用于图片生成，不同步到视频生成。
- 已新增 `sharp` 依赖，使用本地 `sharp` 做增强超分：选择 `增强2K / 增强4K` 时，先生成原生图，再将图片按原生尺寸 `x2` 放大，保存增强图到 `public/generated/images`。超分完成后删除原生临时图，前端只拿到增强图 URL。
- 对话流和预览页参数行已更新：增强结果在普通 `1K / 2K / 4K` 图标后额外显示金色 `增强2K / 增强4K`；最终比例和尺寸仍以真实本地图片文件为准。
- 主要改动文件：`src/lib/models.ts`、`src/lib/openrouter.ts`、`src/lib/local-assets.ts`、`src/components/chat-workbench.tsx`、`package.json`、`package-lock.json`。
- 验证：本轮核心改动后 `npm run lint` 和 `npm run build` 通过；后续微调 `21:9` 顺序、单按钮占满、增强后删除原生临时图后再次 `npm run lint` 通过。

### 2026-05-11 规则文档、图片模型尺寸规则、真实参数显示和尺寸矩阵实测

- 用户要求把项目现有规则整理到 `AI-Video-Assistant_Project Planning`。已新增 `00-rules-index.md` 到 `12-ui-style-rules.md`，按模式、输入、Agent、图片生成、视频生成、媒体显示、资产、历史并发、反馈、接口、协作和 UI 样式拆分；同时生成同名 `.docx`，用于直接查看字号层级和后续用红字改规则。注意该文件夹 README 规定内容不能删除，上传 GitHub 前必须整体加密压缩。
- 图片结果的“正在加载中”提示已去掉白色圆角底，只保留文字和跳动点。
- 图片 / 视频媒体结果参数显示改为真实媒体文件优先：图片保存后服务端读取真实像素，旧图在缩略图或预览页加载后也会补真实尺寸；视频在对话流或预览页加载 metadata 后补真实宽高。对话流和预览页都会按真实宽高显示比例、尺寸和 `1K / 2K / 4K` 或 `HD / FHD` 图标，不再只显示按钮选择值。
- 图片模型尺寸规则已配置化到 `src/lib/models.ts`：`Seedream 4.5` 只开放 `2K / 4K`；`GPT-5.4 Image 2` 只开放 `1K / 2K`；`Gemini 3.1 Flash Image Preview`、`Gemini 3 Pro Image Preview`、`GPT-5 Image` 开放 `1K / 2K / 4K`。切换模型后如果当前分辨率不支持，会自动回落到该模型默认档位。
- 图片设置面板的尺寸显示改为按“当前模型 + 当前比例 + 当前分辨率”计算。`Seedream 4.5` 使用官方映射尺寸，如 `2K 16:9 = 2560x1440`，`4K 16:9 = 5120x2880`；Gemini / GPT 系列按大边 `1024 / 2048 / 4096` 计算。
- “智能比例”临时规则已确定为当前模型最小可用分辨率的 `16:9`。选择智能比例时，分辨率按钮和尺寸区域会淡化，分辨率按钮不可点；底部按钮显示也会同步为实际执行档位，如 Seedream 为 `智能比例 / 2K`，GPT-5.4 Image 2 为 `智能比例 / 1K`。
- OpenRouter 图片请求参数按模型拆分：Seedream 继续用 `modalities: ["image"]` 并传像素尺寸；Gemini / GPT 系列改为 `modalities: ["image", "text"]`，并传 `size: "1K" / "2K" / "4K"` + `aspect_ratio`。服务端现在会打印 `[image-generation] OpenRouter request params`，用于核对真实请求体。
- 新增 `scripts/test-image-size-matrix.mjs`，逐模型 / 档位 / 比例生成一张测试图，记录申请参数、申请尺寸、真实尺寸和一致性，结果写入根目录 `image-size-test-results.md`。首次直接 Node `fetch` 测试大量假 `500 Internal Server Error`，脚本已加 `curl` 兜底后完成全量测试。
- 图片尺寸矩阵实测共 70 组。Seedream 4.5 的 `2K` 五个比例全部一致：`16:9 2560x1440`、`4:3 2304x1728`、`1:1 2048x2048`、`3:4 1728x2304`、`9:16 1440x2560`。
- Seedream 4.5 的 `4K` 五个比例全部退回对应 2K 尺寸，例如申请 `5120x2880` 实际为 `2560x1440`。当前 OpenRouter 链路下不能承诺 Seedream 真 4K。
- Gemini 3.1 Flash 和 Gemini 3 Pro 比例基本生效，但 `1K / 2K / 4K` 档位均没有按申请变化，实测固定在偏大的 1K 档：`16:9 1376x768`、`4:3 1200x896`、`1:1 1024x1024`、`3:4 896x1200`、`9:16 768x1376`。
- GPT-5 Image 基本只输出 `1024x1024`，比例参数基本未生效。GPT-5.4 Image 2 比例生效，但 `1K / 2K` 都输出同一组约 1K 尺寸：`16:9 1280x720`、`4:3 1152x864`、`1:1 1024x1024`、`3:4 864x1152`、`9:16 720x1280`。
- 本轮验证 `npm run lint` 和 `npm run build` 均通过。

### 2026-05-11 公用 OpenRouter key、并发出图、@ 重生成修复和协作规则

- 本轮先读取了 `E:\project\【1】Api\api key.txt`，确认用户新增 OpenRouter 公用 key，并把本地 `.env.local` 的 `OPENROUTER_API_KEY` 从个人 key 切到公用 key；旧个人 key 已不再出现在项目目录中。注意 `.env.local` 不提交 GitHub，换电脑仍需手动配置。
- 用户明确要求后续所有 AI 在修改功能逻辑、接口参数、模型参数、UI 显示、错误提示和交互规则前必须先问用户确认；排查可以读文件 / 看日志 / 说明原因，但动代码前必须确认。这个规则已同步到 `00-README.md` 和 `05-chat-history-highlights.md`，后续接手 AI 必须遵守。
- 图片 / 视频并发规则调整：同一会话仍最多 `10` 批 pending 任务；多批任务同时跑；单批图片内部也改为并发生成，选 `4张` 会同时发起 4 个单图请求；哪张先完成就先显示，未完成位置继续显示等待卡。
- 图片结果显示支持部分成功 / 部分失败：成功图片、等待卡、失败卡可混排在同一批里；单张失败只显示该位置“图片生成失败”，不阻塞其它图片；整批或部分失败时红字显示真实错误或“有 X 张图片生成失败，其它图片已完成。”
- `/api/image` 内部多图生成也从顺序改为并发；前端 `runGeneration` 对图片任务改为每张 `count: 1` 并发请求，完成后通过当前 assistant 消息的 `requestId` 逐张追加到 `images`。
- 生成图片文件已经保存但浏览器缩略图还没渲染出来时，图片卡片左上角显示“正在加载中”加跳动点作为保底提示；后续如仍慢，建议做 250px 缩略图缓存，对话流显示缩略图，预览页再加载原图。
- 用户发现 `GPT-5.4 Image 2` 在 OpenRouter 下选 `16:9 / 2K` 仍可能输出 `1280x720`，而 Seedream 也出现真实文件 `2560x1440` 与页面显示 `1344x756 / 1K` 不一致。当前先保持页面显示用户选择 / 前端映射尺寸，后端继续传 `image_config.size`；真实像素显示、模型能力差异和后处理放大方案均待定。
- 曾临时尝试把非 Seedream 图片模型的 `modalities` 改成 `["image", "text"]`，用户要求撤回。当前已恢复为所有图片模型仍传 `modalities: ["image"]`，后续不要自行改该接口参数，必须先问。
- 修复专业模式结果点击“重新生成”时 `@资产` 失效的问题：新生成的图片 / 视频 assistant 消息会保存本次 `imageReferences`；重新生成优先读取当前结果自己的引用，旧消息没有引用时会从提示词中的 `@名称` 反查资产库 / 对话引用，并把参考图重新传给 `/api/image` 或 `/api/video`。
- 提示词里的有效 `@资产名` 显示已统一：用户消息和图片 / 视频专业模式结果提示词都会在 `@名称` 前显示一个接近文字大小的小缩略图；旧消息如果能从资产库或对话引用中匹配到 `@名称`，也会按同样方式显示。
- 模式切换系统消息规则已修复：如果当前已经是 `图片生成 / 视频生成 / Agent 模式`，再次点击同一模式只关闭菜单，不再插入重复的“当前已切换到...”系统消息；只有真正从 A 模式切到 B 模式才插入系统提示。
- 当前图片生成模式规则已重新梳理给用户：专业模式不走 Agent、不优化提示词、不显示右侧用户气泡；用户输入即最终提示词；手动选择图片模式最高优先级；`@` 明确引用时只按文本顺序传被引用图片；单批多图并发并逐张显示。
- 本轮涉及代码主要在 `src/components/chat-workbench.tsx` 和 `src/lib/openrouter.ts`；已多次验证 `npm run lint` 和 `npm run build` 通过，并按需重启本地 dev server。

### 2026-05-09 媒体预览页重做、视频预览接入和 GitHub 同步

- 本轮按用户给的即梦参考图重做了图片 / 视频预览页，入口仍在 `src/components/chat-workbench.tsx`：点击生成图片缩略图会打开全屏预览层，顶部留空、左右和底部贴边，下层为透明黑色遮罩
- 预览页左侧为独立媒体预览区，右侧为固定提示词区；左侧底层使用毛玻璃背景，图片 / 视频本体放在上层，不加滤镜、不加圆角，图片直角显示
- 顶部工具栏左侧提供缩放控制：`-`、当前百分比、`+`、`实际尺寸`、`适合尺寸`；按钮尺寸 / 圆角按输入框工具按钮体系，只有 `下载` 是黑色主按钮，关闭按钮为浅色
- 图片预览默认打开为 `适合尺寸`，百分比显示当前真实适配比例；点 `实际尺寸` 后显示 `100%` 并按原图真实像素显示；滚轮和 `+ / -` 会从当前可见比例继续缩放，范围限制 `10% - 250%`
- 图片放大后不显示滚动条，鼠标进入预览区为小手，按住可拖动图片；切换 `实际尺寸 / 适合尺寸` 或重新打开预览会重置拖动位置
- 预览页右侧文件名下方显示该媒体参数：模型、比例、尺寸、分辨率图标和视频时长；`1K / 2K / 4K` 继续使用 `CompactResolutionIcon`，不是普通文本
- 右侧提示词区标题统一为“图片提示词”，前置 `RiInformationLine` 图标；同一行右侧是黑色小号“使用提示词”按钮，点击会把提示词填入输入框、聚焦并关闭预览页
- 对话流里点击视频也会打开同一个预览页，视频在左侧按适合尺寸完整显示；当当前预览是视频时，左上角缩放相关按钮显示为透明禁用态、不可点击
- 当前对话流内媒体数量超过 `2` 个时，左侧预览区右边显示浮层缩略图列表，不占布局、不影响主图最大显示区域；缩略图为 `50x50`、`5px` 圆角、`2px` 描边，选中描边为 `#367cee`
- 缩略图列表包含当前对话内所有生成图片和视频；视频缩略图左上角显示 `RiFilmLine` 视频图标，图片缩略图不显示图标；打开预览或切换媒体时，列表会自动滚动定位到当前选中项
- 如果缩略图列表内容可全部显示，则不显示上下滚动按钮；只有实际需要滚动时才显示 `50x50` 上 / 下按钮，列表滚动条通过 `.yinzao-hidden-scrollbar` 隐藏，仍可滚轮滚动
- 本轮多次验证 `npm run build` 通过；最终已提交并推送到 GitHub `main`：提交 `2094e9f Update media generation workspace`
- 交接给下一个 AI：从 GitHub 下载后代码会一致，但 `.env.local`、`node_modules`、`.next`、`public/generated` 和浏览器 `localStorage` 里的历史对话 / 资产库不会同步，需要按 `00-README.md` 的步骤重新配置和启动

### 2026-05-09 视频轮询不限时、同会话最多 10 个并发任务

- 用户反馈视频任务明明只等了 2 分多钟就显示“已停止自动等待”，与交接文档里“约 5 分钟停止”不一致
- 排查 `src/components/chat-workbench.tsx` 后确认真实代码为：普通 Seedance / Kling 等模型 `getVideoPollAttemptLimit` 返回 `12`，每次间隔 `10秒`，所以实际约 `120秒` 就停；Veo 约 `140秒`；Sora 按时长更久
- 已删除前端视频轮询最大次数限制：只要 OpenRouter / 模型没有返回 `failed / error / expired`，前端就继续等待，不再因为排队久自动写入失败 / 停止文案
- 当前视频轮询节奏为：前 `12` 次每 `10秒` 查一次，之后每 `30秒` 查一次；成功显示视频，失败显示真实错误
- 已移除“这个任务排队较久，已停止自动等待。你可以稍后点重新生成继续查询，或直接重试。”相关逻辑；`npm run lint` 通过
- 用户询问 OpenRouter 和模型官网是否公开并发数。已查 OpenRouter Limits、Video Generation、Video Cookbook、视频模型 API、模型 endpoint 元数据；结论是 OpenRouter 支持并发请求 / 异步视频任务，但没有公开每个模型固定并发数，模型元数据也没有并发字段
- 用户要求先不实测并发上限，直接放开同一会话并发：现在同一会话在上条任务没返回时也可以继续发送任务
- 会话状态已从单个 `pendingRequest` 扩展为 `pendingRequests` 队列，并兼容旧 `pendingRequest` 字段；本地历史里的旧单任务数据会被合并进新队列读取和持久化
- 每个会话最多同时挂起 `10` 个任务；未满 10 个时发送按钮保持可用，达到 10 个时按钮显示“任务已满”，任意任务完成 / 失败后释放名额
- 媒体等待卡现在按每条 assistant 消息自己的 `requestId` 匹配对应 pending task，不再只认当前会话唯一 pending task；多个同会话图片 / 视频等待卡可同时正确显示和更新
- 左侧历史运行中状态改为读取 `pendingRequests` 队列数量；空会话判断也会把未完成 pending 队列算作非空，避免有任务的空标题会话被清理
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-05-09 输入框富文本重构、系统提示、媒体失败卡和视频风控排查交接

- 输入框已从原来的 `textarea + DraftInputOverlay` 双层模拟，改成单层 `contenteditable` 输入框；有效 `@资产名` 现在直接在同一层文字中变蓝，不再依赖透明 textarea 和 overlay 叠字
- `contenteditable` 输入框保留了原有核心交互：输入 `@` 弹资产菜单、点击底部 `@` 按钮插入、选择资产插入 `@资产名`、粘贴图片、Enter 发送、Shift+Enter 换行、发送解析仍按文本里的 `@顺序` 走
- 已修复 `@` 资产菜单只在末尾有效的问题：现在会按当前光标位置判断 `@xxx`，不管前面是否已有文字，都能在光标处输入 `@` 并弹出资产选择
- 已修复底部 `@` 按钮和缩略图 / 资产插入总是追加到末尾的问题：现在会读取当前编辑器真实选区，把 `@` 或 `@资产名` 插入到光标停留位置；选择资产会替换当前光标前正在输入的 `@xxx`
- 输入框文字上限已从 `1000字` 调整到 `2000字`；超过时会截断并复用原“最多上传五张图片”的黑色自动消失提示框，显示“最多输入2000字”
- 输入框复制 / 粘贴大段文字后，内部滚动条会自动滚到最底部，优先跟随最后输入的文字
- 输入框宽度策略已调整：默认仍优先 `800px`；如果底部工具栏按钮组合、模型名或输入内容需要更多宽度，会按需求逐步加宽，最高约 `1006px`；按钮强制单行、文字强制单行、按钮 `shrink-0`，不得重叠或换成两行
- 注意：曾给底部工具栏加 `overflow-x-auto`，会导致上弹菜单被裁掉，已去掉；后续不要再用会裁剪菜单的 overflow 包住工具栏
- 图片 / 视频结果上方长提示词 hover 展开框已限制最大高度 `250px`；顶部标题行固定，不参与滚动；标题行左侧显示 `RiInformationLine` 图标和灰字“当前使用的提示词”，右侧同一行显示“使用提示词”按钮；正文在标题下方单独滚动，不能滚到标题上方
- `使用提示词` 仍是把当前媒体提示词填入输入框并聚焦，不是复制到剪贴板
- 新对话默认欢迎语已删除；新建会话初始 `messages` 为空
- 模式切换会在对话流中插入一条 `role: "system"` 的系统提示消息，样式为灰色文字，前置图标使用对应模式按钮图标；“当前已切换到XX模式”加粗，后面同一行接该模式功能说明，不再换行
- 系统提示消息现在是真正的消息流内容：切换后再发送对话 / 生图 / 生视频，会显示在系统提示下面；不再固定在对话流底部
- 只有系统提示、没有用户输入的会话仍视为空会话；只切换模式不会产生新的有效历史对话，历史列表会通过 `isEmptySession` 只保留一个空的新对话
- Agent 模式系统提示说明使用“Agent会帮你理解需求”
- 图片生成失败显示已重做：失败时仍显示该批任务自己的提示词和参数；失败卡使用和成功图一致的灰色底，每张 `250x250`；用户选择几张就显示几张失败卡；卡片左上显示 `emotion-sad-line` 图标 + “图片生成失败”；红色真实错误文案恢复显示在失败卡下方
- 视频生成等待卡、成功显示和失败卡已改成接近图片结果样式：单个 `640x360` 灰底区域；等待卡只显示百分比和已等待时间，不再显示“视频排队中，通常需要 1-5 分钟”；成功视频在灰底框中 `object-contain` 完整显示；失败卡左上显示 `emotion-sad-line` 图标 + “视频生成失败”；红色真实错误文案显示在卡片下方
- 本轮排查到一次视频生成失败真实原因：OpenRouter 返回 `InputImageSensitiveContentDetected.PrivacyInformation`，英文原文为 `The request failed because the input image may contain real person.`；说明参考图被平台判定可能包含真实人物 / 隐私敏感信息，拒绝创建视频任务，不是此前猜测的参数组合问题
- 后续如果继续优化失败提示，建议保留红色原始错误，同时可在前端对该错误增加中文解释：“参考图可能包含真人隐私信息，平台拒绝生成视频”
- 本轮多次验证 `npm run lint` 和 `npm run build` 通过；lint 仍有旧 warning：`MAX_VIDEO_POLL_ATTEMPTS` 未使用，另外去掉视频等待文案后 `statusText` 在 `MediaWaitingCard` 中暂时未使用过一次 warning，后续可顺手清理

### 2026-05-09 图片生成稳定性、重新生成逻辑、提示词区和输入框后续方案交接

- 图片 / 视频专业模式原则已再次确认：除 `Agent 模式` 外，用户手动选择的模式最高优先级；`图片生成` 一定走图片链路，`视频生成` 一定走视频链路；提示词里出现“视频 / 一段 / 动起来”等词时，图片模式应按单帧画面理解，不能反向切到视频；视频模式同理不能因“海报 / 一张图”切回图片
- 专业模式下生成前的“我已经开始生成图片 / 视频，结果出来后会直接显示在这里。”提示已去掉；等待卡直接显示在结果流中
- 视频结果参数行已补上真实选择的时长，取自该条消息自己的 `generationMeta.settings.duration`，避免跟随当前面板临时值显示错
- 图片生成失败排查后确认不是 OpenRouter 不通：`/api/v1/models` 可返回 `200`，同请求用 `curl` 直连 OpenRouter 可成功；根因是 Node `fetch` 调 OpenRouter 图片接口会偶发假 `500 Internal Server Error`，已给 `src/lib/openrouter.ts` 的图片生成增加 `curlPostJson` 兜底，和此前视频查询 / 下载的 `curl` 兜底思路一致
- OpenRouter 图片返回格式已增强兼容：支持 `choices[0].message.images[].image_url.url`、`choices[0].message.images[].url`、`images[].url`、`data[].url`；本地保存 `data:image/...;base64,...` 时也已在 `src/lib/local-assets.ts` 补充 data URL MIME 扩展名识别
- 图片生成参数冲突已修复：当选择明确比例如 `16:9` 时，后端不再同时传固定正方形 `size: 1024x1024`，避免 `aspect_ratio` 与 `size` 冲突；重试时会去掉整套 `image_config`
- Sora 视频等待策略已放宽：`Sora 2 Pro` 按时长增加轮询次数，尤其 `12 / 16 / 20秒` 不再快速判超时；超时文案改为“已停止自动等待”，不再误导成生成失败
- 图片 / 视频生成失败和成功时，提示词都必须保留显示；已去掉“这次图片生成没有成功。”这类替代正文，失败只在红字错误区显示真实错误
- `使用提示词` 按钮已替代原“复制提示词”：图标改为 `t-box-line`，功能改为把当前提示词填入输入框并聚焦；悬浮完整提示词框中的按钮单独成行，右侧对齐
- 提示词区逻辑已改为真实 DOM 高度判断：`提示词 + 使用提示词按钮` 两行内能完整显示时，不显示渐隐、不触发完整框；真实超过两行时才截断、右侧渐隐、hover 展开；完整框文字起点要与默认前两行重合，只是向下展开内容
- 图片 / 视频结果下方“重新生成”逻辑已修复方向：专业模式下点哪一批结果，就只用该条 assistant 媒体结果自己的 `generationMeta.originalPrompt` / `message.content` 重新生成，不再强依赖上一条用户气泡，不再插入用户气泡，不再串到 Agent；Agent 模式仍按上一条用户消息重跑 Agent 回复
- 输入框工具按钮尝试改为毛玻璃：最终保留当前输入框本体 `bg-white/78 + backdrop-blur-[18px]` 的正确效果，默认淡灰描边 `#f1f2f2`，`focus-within` 时白色描边和外阴影；工具按钮使用 `.yinzao-tool-button` / `.yinzao-tool-button-active` 全局 CSS，上传 `+` 按钮额外加 `.yinzao-tool-button-round` 保持圆形
- 输入框内 `@资产名` 蓝色目前仍使用 `textarea + DraftInputOverlay` 双层模拟；本轮尝试修选中文字重影时发现该方案天然会出现双层字 / 选区错位风险，已确认根因是原生 `textarea` 不支持局部上色
- 即梦方案已调研并需交接给下一任 AI：即梦红框内 `@名` 变色和带图标大概率不是 textarea，而是类似 `Slate.js / contenteditable` 的富文本编辑器，`@名` 是 inline mention 节点；抓取资源中 CSS/JS 有 `slate` 迹象。下一个 AI 接手时应优先把“是否重构为 Slate/contenteditable mention 输入框”方案拿出来给用户确认
- 富文本输入框重构的建议：如果要彻底解决输入框双层字并保留 `@资产名` 变色 / 胶囊 / 图标，推荐单独开任务把 textarea 替换为 `Slate.js` 或类似富文本编辑器；普通文本和 `@资产名` 分别作为 text node 与 inline mention node。代价是需要重做 Enter/Shift+Enter、中文输入法、粘贴图片、撤销、光标、草稿序列化和发送解析，工程量约 `0.5-1.5天+`
- 已验证 `npm run build` 多次通过

### 2026-05-08 输入框悬浮分层、提示词区重做和底部交互修复

- 输入框区域与聊天内容区已正式拆成两层：聊天消息继续留在滚动层，输入框改成底部独立悬浮层；输入框本体样式和内部结构尽量保持不变，只去掉外层承托白底
- 右侧页面和聊天滚动区底色最终保持白色；中途曾误改成淡蓝，现已修正回白色，不再影响用户对“整页仍是白底，但输入框单独悬浮”的预期
- 输入框本体已改成白色毛玻璃效果：半透明白底、弱白边框、`backdrop-blur` 模糊、原有圆角与阴影保留
- 聊天区底部安全区已增加到约 `360px`，滚动到底时最后一条内容会停在输入框上方，减少媒体结果被悬浮输入框遮挡的问题
- “回到底端”按钮层级已提高到媒体内容上方；同时修复因为父层 `pointer-events-none` 导致按钮完全点不了的问题，现已补上 `pointer-events-auto`
- 图片 / 视频结果上方的提示词区已重做：默认最多显示 `2` 行，尾部右侧渐隐；长提示词悬停时会显示完整白色毛玻璃浮层，不会把下面内容顶下去
- 提示词区新增本次生成参数行：显示模型、比例、尺寸；图片 `1K / 2K / 4K` 与视频 `HD / FHD` 图标统一放在尺寸后方，视频图标颜色也已改成和参数文字一致的灰色
- “复制提示词”按钮已分成两套样式：默认状态下是灰色按钮，悬浮毛玻璃浮层里是黑色毛玻璃按钮；普通状态高度约 `22px`，浮层内高度约 `26px`
- 受全局 `button { font: inherit; }` 影响，复制提示词按钮的字号必须写在内部 `span` 上才会生效；本轮已按这个规则修正
- 反馈区第一个“复制”按钮显示规则已收紧：只在 `Agent 模式` 的纯文字回复下显示；只要该条消息里有图片或视频结果，就不再显示
- 图片生成重试策略已修复：普通平台 5xx 或空返回重试时继续保留用户选择的比例和尺寸参数；只有平台明确报 `image_config / aspect_ratio / size` 不支持时，才会降级去掉这些参数，避免四张图里个别重试图片尺寸跑偏
- 已移除输入框下方原先的“AI 可能会出错。请核查重要信息。”以及对话 / 图片 / 视频模型测试文案

### 2026-05-08 图片 / 视频专业模式做实、模型选择、媒体结果显示和实测

- `图片生成` / `视频生成` 模式已改为专业执行模式：用户输入默认就是提示词，不再先走 `/api/chat` 优化，也不再做多余对话引导；上传图和 `@资产` 图片会按原样作为参考图传给生成接口
- 专业模式下用户输入不再显示为右侧用户气泡，而是作为左侧生成结果上方的提示词显示；提示词直接显示，不走打字机效果；`Agent 模式` 仍保持原对话形式和打字机效果
- 图片 / 视频生成结果下方不再显示引导按钮；引导系统现在只显示在 `Agent 模式` 的最后一条 AI 回复下
- 图片模型选择已接入：`Seedream 4.5`、`Gemini 3.1 Flash Image Preview`、`Gemini 3 Pro Image Preview`、`GPT-5 Image`、`GPT-5.4 Image 2`
- 视频模型选择已接入：`Seedance 2.0 Fast`、`Seedance 2.0`、`Kling v3.0 Standard`、`Kling v3.0 Pro`、`Kling Video O1`、`Veo 3.1`、`Sora 2 Pro`
- 模型选择按钮会显示当前模型全名，模型名过长时按钮和输入框跟随变宽；浏览器窄到放不下时才隐藏文字只留图标；刷新后模式、模型、比例、分辨率、时长、图片数量会保存到 `yinzao-input-settings-v1`
- 模型菜单和模型按钮图标会跟随厂商变化：OpenAI 用 `openai-fill`，Google 用 `google-fill`，字节用 `tiktok-fill`，可灵等其它模型使用本地 `ai-generate-3d-line` SVG
- 视频时长选项会跟随模型变化：Seedance / Kling 为 `5秒 / 10秒 / 15秒`，`Veo 3.1` 为 `4秒 / 6秒 / 8秒`，`Sora 2 Pro` 为 `4秒 / 8秒 / 12秒 / 16秒 / 20秒`，后端也按模型支持值传参
- 视频生成默认请求有声音：非 Sora 模型先传 `generate_audio: true`，若因音频参数失败会自动重试无声音版本；`Sora 2 Pro` 不传 `generate_audio` 字段
- 视频参考图已取消默认首尾帧规则，不再传 `frame_images`；上传图和 `@资产` 只作为普通 `input_references`，是否首帧 / 尾帧完全交给用户提示词和模型理解
- 图片“同时生成数量”已做实：`1张 / 2张 / 3张 / 4张` 会真实顺序生成对应数量；如果某张返回空图或 OpenRouter 5xx，会自动重试补齐，减少选四张只出三张的问题
- 对话内容主容器最大宽度改为 `1006px`；图片结果缩略图区为 `250x250px`，四张横排间隔 `2px`，直角显示；图片使用 `object-contain` 居中显示完整比例，能看出横图 / 竖图；图片等待卡同为 `250x250px`
- 对话框里 AI 消息前的小 logo 已去掉，左侧栏 Logo 保留；这样媒体结果可更接近 1006px 宽度，避免横向滚动条
- 图片 / 视频专业模式下的上传图和 `@资产` 已确认有效：明确 `@` 时按文本顺序传被引用图片，未 `@` 时传本次上传图，之后才取最近图片；图片模型走 `/api/image`，视频模型走 `/api/video`
- 本机 OpenRouter 实测结果：图片模型中只有 `Seedream 4.5` 可用且参数可用；Google / GPT 图片模型均返回 `403 This model is not available in your region`
- 本机 OpenRouter 实测结果：`Seedance 2.0 Fast`、`Seedance 2.0`、`Kling v3.0 Standard`、`Kling v3.0 Pro`、`Kling Video O1`、`Veo 3.1`、`Sora 2 Pro` 均可创建并完成视频任务；`Veo 3.1` / `Sora 2 Pro` 需要按支持时长和比例做兼容
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-05-08 工作流占位页、资产回收站和输入框参数面板重做

- 工作流模式已从禁用占位改为可点击占位页：左侧图标未选中 `git-pull-request-line`、选中 `git-merge-line`，右侧为灰色网格背景空白页，顶部“未开放”标签保留
- 工作流模式左侧二级列表已独立：标题为“我的工作流”，按钮为“新建工作流”，名称按 `工作流_01`、`工作流_02` 递增，本地保存到 `yinzao-workflows-v1`
- 工作流项右侧三点菜单已与历史对话对齐，支持置顶、重命名、删除；当前点击工作流本体暂不触发右侧内容变化
- 左侧“我的资产”分类图标已更新并统一到一级菜单大小：角色图片 `account-box-line`、场景图片 `landscape-line`、分镜图片 `multi-image-line`、分镜视频 `film-line`
- 左侧分类和历史 / 工作流列表间距已统一为 `3px`
- 资产分类文案已调整：左侧“其它”改为“待分类”，右侧对应分组改为“待分类图片”和“待分类视频”
- 资产管理已新增“回收站”分类；删除资产时不再立刻移除，而是进入回收站并保留 30 天
- 新增 `/api/asset-delete` 和 `deleteLocalGeneratedAsset`：回收站到期时会自动从本地资产列表移除，并同步删除 `public/generated/...` 下真实图片 / 视频文件
- 回收站顶部显示红字提示“回收站中的内容将在30天后删除，不可恢复。”；回收站资产右上角不再显示改分类按钮，改为倒计时角标，按剩余时间自动显示“天 / 小时 / 分钟”
- 回收站资产右下角菜单里的“删除”已改为“恢复”；恢复后当前回到“待分类”
- 资产分类菜单已按媒体类型拆开：图片资产只能改到“角色图片 / 场景图片 / 分镜图片 / 待分类”，视频资产只能改到“分镜视频 / 待分类”
- 所有资产分类在当前无内容时，右侧中间显示灰字“当前没有内容”；仅在整个资产库为空时继续显示原始全局空状态说明
- 输入框工具栏按钮颜色已继续细调：除模式选择按钮外，其它按钮文字和图标统一改成更浅灰色，`+` 上传和底部 `@` 也同步变灰；placeholder 文案整体再降灰度，蓝色 `@` 保持不变
- 输入框相关弹窗已统一：模式菜单、画面设置、时长、同时生成数量、`@` 资产弹窗同一时间只允许出现一个；切换另一个或点击输入框空白区域时，上一个自动关闭
- 输入框相关弹窗主圆角统一为 `12px`，内部选项卡片约 `8px`，外层灰色描边已去掉，仅保留白底和阴影
- 画面设置弹窗已按参考样式重做：标题为“选择比例 / 选择分辨率 / 尺寸”，比例和分辨率都改成浅灰底板 + 选中白卡浮起结构；比例顺序改为 `智能比例`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`
- 画面设置弹窗底部新增尺寸展示区：`W × H PX` 会根据当前比例和分辨率自动联动变化；当前属于前端映射展示，不代表后端真实返回尺寸
- 图片分辨率图标已细化为 `1K / 2K / 4K` 的独立样式；视频分辨率图标已细化为 `HD / FHD` 黑底白字样式
- 三种创作模式的参数状态已拆开：`Agent / 图片生成 / 视频生成` 的比例、分辨率、时长、图片数量互相独立，切换模式后按钮显示会立即刷新为该模式自己的值
- 图片模式新增“同时生成数量”按钮，选项为 `1张 / 2张 / 3张 / 4张`；当前仅完成前端按钮和独立状态，尚未把数量真正接到 `/api/image`
- 模型按钮图标当前不再依赖 `react-icons` 可用导出，已直接接入用户给的 CDN `ai-generate-3d-line` 原始 SVG 到本地组件，避免图标库缺失导致编译失败
- 输入框相关图标继续调整：Agent 模式 `robot-2-line`、图片生成 `image-ai-line`、视频生成 `film-ai-line`、视频时长 `time-line`、复制统一 `checkbox-multiple-blank-line`
- 本轮多次因图标名不存在导致编译失败，现已全部修复，并再次验证 `npm run build` 通过

### 2026-05-07 输入框工具栏 UI 细调、模式原则确认和 Remix Icon 替换

- 输入框外框改为默认 `2px #f1f2f2`，默认无阴影；聚焦后边框加深并出现阴影
- 输入框底部工具栏按钮继续细调：除上传按钮外，其它按钮统一白底、`8px` 圆角、hover 浅灰；按钮高度、内边距和视觉重量已重新统一
- 上传按钮也已改成白底；发送按钮圆角从全圆改为更接近工具按钮体系的 `10px`
- 模式菜单按钮已升级：按钮前带图标、文字蓝色 `#367cee`、右侧下拉箭头；展开菜单更大，顶部标题为“创作类型”，选中项右侧有对勾
- 模式名称已从 `图片模式 / 视频模式` 改为 `图片生成 / 视频生成`
- 再次确认产品原则：`Agent 模式` 是智能傻瓜式，不开放比例 / 分辨率 / 时长这类专业参数；`图片生成`、`视频生成` 面向更专业用户，才开放这些参数 UI
- 图片和视频模式都已去掉“风格”按钮；图片模式当前保留模型 + 画面设置，视频模式保留模型 + 画面设置 + 时长
- 比例和分辨率按钮已合并成“画面设置”弹层，按钮直接显示当前选择；弹层排版已调整为更规整的网格布局
- 比例选项新增 `智能比例`、`3:4`、`4:3`，并把默认比例改成 `智能比例`
- 图片分辨率当前为 `1K / 2K / 4K`；视频分辨率当前为 `720p / 1080p`
- placeholder 里的 `@` 和底部 `@` 按钮都已改成 Remix Icon 的 `at-sign` 图标；placeholder 里的 `@` 保持蓝色 `#367cee`，底部单独 `@` 按钮为黑色
- 左侧栏“对话模式 / 工作流模式 / 资产管理”颜色规则已统一：选中深色、未选中统一灰色、禁用更浅灰
- 左侧栏图标按用户要求替换：对话模式未选中 `chat-3-line`、选中 `chat-smile-ai-line`；资产管理未选中 `folder-line`、选中 `folder-open-line`
- 本轮将主界面图标从 `lucide-react` 切到 Remix Icon：已新增 `react-icons`，当前 `src` 下旧的 `lucide-react` 引用已清空
- 图标替换过程中曾导致项目编译失败，当前已修复，`npm run build` 再次通过
- 反馈区图标已统一成 Remix Icon 的线框 / 实心切换：喜欢 `thumb-up-line/fill`，不喜欢 `thumb-down-line/fill`，回答错误 `chat-delete-line/fill`，模式错误 `emotion-unhappy-line/fill`

### 2026-05-07 上传 / @ 参考图链路、输入框缩略图和 413 降级策略

- 图片 / 视频模式和 Agent 自动路由都已统一使用上传图与 `@` 资产引用，`@` 按钮在 Agent / 图片 / 视频三种模式都显示
- 输入框上方的待发送图片缩略图统一为 `100x100`、圆角、灰色边框、底部黑色渐变条，内部显示 `@文件名` / `@资产名`；上传图和 `@资产` 图不再用不同边框区分
- 普通上传图片只显示缩略图，不再自动往文字输入区插入 `@文件名`；`@资产`、资产管理插入、资产预览插入、历史用户消息缩略图再引用会同时加入缩略图并在输入框插入 `@资产名`
- 输入框内 `@xxx` 只有匹配真实上传图、资产图或历史用户消息参考图时才显示蓝色；随便输入无效 `@xxx` 不会蓝色高亮
- `@` 资产弹窗支持点击空白区域关闭，点击弹窗内部不关闭；输入 `@`、点击 placeholder 的 `@`、点击工具栏 `@` 都会打开弹窗
- 输入框最多保留 5 张参考图；上传超过 5 张或继续 `@资产` / 插入历史缩略图超过 5 张时，统一提示“最多上传五张图片”；重复引用同 URL 不重复占名额
- 用户发送后，上传图 / `@` 图会在用户消息下方以横排 `100x100` 缩略图展示，图内显示 `@名称`，没有关闭按钮；点击这些已发送缩略图可重新引用到输入框
- 用户消息文字里的有效 `@名称` 后会显示一个约文字大小的小图缩略图，帮助用户确认引用对象
- 上传图片发送前保存到 `public/generated/upload_image`，文件名使用图片内容 hash 去重；同一张图重复上传会复用同 URL，刷新后用户消息缩略图仍可显示
- 上传图进入资产库：如果资产库已有同 URL 不重复加入；如果没有，用上传文件名作为资产名，并根据文件名 + 本次用户文本判断分类，无法判断则进“其它”
- 参考图发送逻辑已重写：如果用户明确写了 `@`，只按用户文本中的 `@顺序` 传这些图；如果没写 `@`，才传输入框上方全部图片或最近图片；最终发给模型前按 URL 去重
- 为提升参考图一致性，提示词优化 `/api/chat` 会接收低清预览图（`512px / 0.72`）理解人物 / 场景并写进 prompt；如果这一步 413，再退回纯文本提示词优化
- 最终 `/api/image` 生图阶段默认先传原图；只有 OpenRouter 返回 `413 Request Entity Too Large` 时，才自动用压缩副本重试：先 `1280px / 0.85`，仍失败再 `1024px / 0.78`
- 当前仍需关注：`bytedance-seed/seedream-4.5` 多参考图人物 / 场景一致性可能不稳定；如果用户继续反馈完全不参考图，下一步优先增加调试日志显示实际传图数量 / 顺序 / prompt，或评估换图像编辑模型
- 后续公网部署后，优先改为把上传图 / 资产图变成公网 HTTPS URL 直接传 OpenRouter，不再把本地图片转 base64；这应显著降低 413 并保留原图质量
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-05-07 参考图请求体优化和上传图保存策略

- 上传图片保存到 `public/generated/upload_image`，资产库保存原图 URL，上传资产按文件名命名并按文件名 + 本次文本判断分类
- 图片生成参考图现在先按用户明确 `@` 的图片传；如果用户没有 `@`，才传本次上传图或最近图片；发送前会按 URL 去重，避免同一张图重复传给 OpenRouter
- 不再上传时强制压缩图片；图片生成先尝试原图，只有 OpenRouter 返回 `413 Request Entity Too Large` 时才自动用压缩副本重试，先 `1280px / 0.85`，仍失败再 `1024px / 0.78`
- 后续公网部署后，优先改成向 OpenRouter 传公网 HTTPS 图片 URL，不再把本地图片转 base64；这会减少请求体并尽量保留原图质量

### 2026-05-07 引导按钮对象化、资产命名和运行中动画细化

- Agent `suggestions` 已从字符串升级为对象 `{ label, action, assetTargetType }`，前端仍兼容旧字符串
- `/api/chat` 的 Agent 系统提示词已要求生成类引导按钮携带 `assetTargetType`：角色图 `character_image`、场景图 `scene_image`、图片分镜 `shot_image`、分镜视频 / 做成视频 `shot_video`
- 前端点击引导按钮后会把 `assetTargetType` 带入 `PendingGeneration`，图片 / 视频生成完成后入库优先按该类型分类，不再只靠提示词猜分类
- 引导系统显示规则更新：只显示在最后一条 AI 回复下方；用户点击引导或发送新消息后旧引导消失；用户只是在输入框打字时不消失
- 新增资产命名规则：角色 / 场景有名字时用名字，否则用 `角色1`、`场景1`；分镜用 `剧名_分镜01_1`，无剧名用 `无名剧01_分镜01_1`；普通图片 / 视频用 `image01` / `video01`；多版本追加 `_2`、`_3`
- 动物 / 植物主体且无剧中名字时，会从提示词和上下文提取更贴切名称，如 `小狗`、`彩色荧光猫`、`科幻兔`；当前还不是生成后看图识别
- 资产管理卡片交互调整：右上角三点改为文件夹图标，功能仍是改分类；右下角改为三点菜单，包含重命名、删除
- 图片资产左下显示 `@资产名`，点击名称即可引用到输入框；视频资产不显示 `@`，也没有引用功能
- 所有小菜单点击空白区域都会自动关闭；删除资产只从本地资产库移除，不删除历史对话里的原图片 / 视频
- 资产网格缩略图当前是正方形自适应尺寸，大屏 5 列时约 195x195；`Image width={240} height={240}` 只是参考尺寸
- 修复同一条消息中重复图片 URL 导致 React duplicate key 报错的问题，图片列表 key 改为 `message.id + url + index`
- AI 正文排版增强：`- 小标题：内容` 和 `1. 小标题：内容` 会渲染为圆点列表，并把冒号前文字加粗
- “正在认真思考”和左侧历史会话运行中动画统一为 3x3 点阵：淡蓝底常驻，深蓝随机闪烁，周期 `3.14s`
- 左侧历史运行中动画现在也监听意图识别状态，和右侧“正在认真思考”同步出现
- 点阵动画样式在 `src/app/globals.css`，组件入口是 `HaloPulseIndicator`；用户可能继续微调大小、颜色、闪烁频率
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-05-06 Agent 引导系统、资产管理和 @ 引用

- Agent 回复从单纯文本改为结构化 `content + suggestions`，正文不再输出“下一步调整方向”
- 前端把 `suggestions` 渲染成独立“引导系统”按钮，显示在反馈操作区下方，不属于正文，也不参与反馈
- 引导系统规则改为影片 / 短剧创作导航：问答阶段给当前问题延展 + 转创作按钮，创作阶段给当前内容修改 + 下一步创作按钮
- 明确当前创作流程：故事概念 -> 扩展故事 -> 改成文字分镜 -> 生成主角图片 -> 生成场景图片 -> 做成图片分镜 -> 做成视频
- 明确文字分镜到图片分镜必须“一镜一图”，不能多个镜头只生成一张；建议逐镜生成
- 明确角色图后续要引导生成三视图，场景图后续要引导生成多角度参考，多版本资产通过 `@资产名` 指定
- 引导按钮样式按豆包参考调整：浅灰底、右侧箭头、反馈图标下方显示，点击后作为下一条 Agent 消息发送
- 新增本地资产库 `yinzao-assets-v1`，页面加载时扫描所有历史对话里的 `images` 和 `videoUrl`，按 URL 去重后自动入库
- 新生成图片 / 视频完成后也会自动入库资产管理
- 左侧“资产管理”已开放，点击后左侧历史对话区切换为“我的资产”分类列表
- 资产分类调整为：全部资产、角色图片、场景图片、分镜图片、分镜视频、其它
- 删除“视频资产”分类；明确分镜视频进入“分镜视频”，无法分类的图片 / 视频进入“其它”
- 资产分类规则调整为：分镜 > 角色 > 场景 > 其它，避免分镜因包含男主 / 场景词被误归类
- 资产卡片改为正方形直角缩略图，无圆角；底部使用黑色渐变条，左下角显示资产名
- 点击资产名可重命名；右上角三点菜单可改分类，菜单项带对应图标和当前勾选，菜单会自动向上 / 向下弹避免出画面
- 右下角新增 `@` 按钮，点击后回到对话输入框并插入 `@资产名`
- 大图 / 视频预览保留“插入 @资产名”按钮
- 输入框提示语改为“输入文字，上传图片或@资产，描述生成内容...”，其中 `@` 为蓝色可点击
- Agent 模式按钮后新增 `@` 按钮，点击会弹出资产选择
- 输入框中的 `@资产名` 使用蓝色显示；当前通过透明 textarea + overlay 实现，因为原生 textarea 不支持局部上色
- `@` 资产弹窗改为标签筛选：只显示角色图片、场景图片、分镜图片三个标签按钮和数量；没有资产的标签不可点；不显示全部、其它、视频
- `@` 选择资产后，发送时会把该资产 URL 作为参考图传给图片 / 视频生成流程
- 手动改过分类的资产会写入 `lockedType`，刷新后不会再被自动分类规则覆盖
- 后续更新：引导按钮已在 2026-05-07 升级为 `{ label, action, assetTargetType }`，生成任务会携带目标资产类型，减少仅靠提示词分类的误判
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-04-30 GitHub 仓库同步和换电脑开发准备

- 准备将项目推送到 GitHub 仓库：`https://github.com/lookxun/AI-Video-Assistant.git`
- 已初始化本地 Git 仓库，主分支为 `main`
- 已完成首次推送到 GitHub：`https://github.com/lookxun/AI-Video-Assistant.git`
- 新增 `.env.example`，只保留环境变量名和默认非敏感模型配置，不包含真实 key
- `.gitignore` 明确忽略 `.env.local`、`node_modules`、`.next`、`public/generated` 和 `start-project.log`
- `public/generated` 下的本地生成图片 / 视频不上传，换电脑后由生成流程自动创建目录和文件
- `README.md` 已补充换电脑继续开发步骤：`git clone`、`npm install`、复制 `.env.example` 为 `.env.local`、填写 `OPENROUTER_API_KEY`、启动项目
- 已说明浏览器历史对话、反馈日志和当前会话保存在本机 `localStorage`，不会通过 GitHub 同步
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-04-30 OpenRouter 视频链路修复、图片生成修复和生成中 UI 统一

- 默认视频模型从 `bytedance/seedance-2.0-fast` 改为 `google/veo-3.1-lite`
- 视频生成强制 4 秒、720p，优先保证本地测试成功率和速度
- 视频模式下短提示词会被强制扩写成完整视频提示词；`/api/chat` 会扩写一次，`src/lib/openrouter-video.ts` 还有兜底扩写
- 视频轮询策略改为前 2 分钟每 10 秒查询一次，2 分钟后每 30 秒查询一次，超过约 5 分钟提示“这个任务排队太久，建议重试。”
- 修复视频状态一直排队的问题：OpenRouter 视频任务用 Node `fetch` 查询时遇到假 `404 Not Found`，同一 URL 用 `curl` 可返回 `completed`，因此 `getOpenRouterVideoTask` 增加 `curl` 兜底
- 修复视频完成后无法保存的问题：OpenRouter `unsigned_urls` 内容地址需要鉴权，保存远程视频时增加带 headers 的 `curl` 下载兜底
- 已用 `A cute cat walking slowly on a sunny wooden floor` 实测 OpenRouter 视频接口，约 42 秒返回 `completed`
- 已用本地 `/api/video` 验证旧任务可返回 `status: succeeded`，并保存到 `public/generated/videos`
- 修复图片生成报错：`bytedance-seed/seedream-4.5` 不支持同时输出 `image + text`，图片生成请求已从 `modalities: ["image", "text"]` 改为 `modalities: ["image"]`
- 已本地测试 `/api/image`，成功生成并保存图片到 `public/generated/images`
- 图片 / 视频生成请求发出后会立即显示状态卡，不再等待提示词优化或任务创建完成
- 图片 / 视频生成中状态卡统一为 400x400、12px 圆角、蓝紫青随机运动动画背景，左上角显示生成 / 渲染中百分比，底部显示状态和已等待时间
- 图片 / 视频生成中不再额外显示“正在认真思考”
- 视频生成完成后不再只显示“打开视频”按钮，已改为像图片一样直接在对话流里显示内嵌视频卡片
- 视频卡片按比例缩小展示，最大高度约 520px，不用原尺寸撑大对话框；保留播放器控件
- 鼠标悬停视频会自动播放，移开后自动暂停，方便像即梦一样快速预览
- 修复刷新页面后历史对话总是跳回第一条的问题：新增本地键 `yinzao-active-session-v1`，刷新后恢复用户当前所在会话；如果会话已删除才回第一条
- 修复发送后等待反馈太慢的问题：Agent 模式在意图识别期间会立即显示“正在认真思考”，识别为图片 / 视频后再切换为对应生成等待卡片；图片模式 / 视频模式继续立即显示等待卡片
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-04-30 视频生成切到 OpenRouter 视频模型

- Seedance 独立聚合接口因 IP 白名单和后续部署问题先暂停，等部署服务器时再继续做
- 确认 OpenRouter 当前有 13 个视频输出模型，可通过 `https://openrouter.ai/api/v1/models?output_modalities=video` 查询
- 新增 `src/lib/openrouter-video.ts`，接入 OpenRouter 视频异步接口
- 视频创建改为 `POST https://openrouter.ai/api/v1/videos`
- 视频查询改为 `GET https://openrouter.ai/api/v1/videos/{jobId}`
- 当时默认视频模型改为 `bytedance/seedance-2.0-fast`，后续又改为 `google/veo-3.1-lite`
- `/api/video` 保持前端调用方式不变，内部从 Seedance 独立接口切到 OpenRouter
- 旧记录：当时上传参考图会作为 `frame_images` 传给 OpenRouter 视频接口，首图为 `first_frame`，第二张为 `last_frame`。后续视频链路已改为普通 `input_references / reference_image`；2026-06-18 又在 BytePlus Seedance 本地追加明确首帧/尾帧/首尾帧接线。
- OpenRouter 完成后读取 `unsigned_urls` 并保存到 `public/generated/videos`
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-04-30 Seedance 聚合接口重接、发送体验和 UI 微调

- 按 `E:\project\【1】Api\SeeDance接入说明` 重新核对视频接入，确认此前接错了接口路径
- 视频创建从旧的 `/openApi/v1/contents/generations/tasks` 改为聚合文档里的 `POST /openApi/generate`
- 视频查询从旧的 `GET /openApi/v1/contents/generations/tasks/{id}` 改为聚合文档里的 `POST /openApi/queryResult`
- 视频模型从 `seedance-2.0` 改为真实文档模型 `doubao-seedance-2-0-260128`
- 视频请求体改为 `modelId`、`abilityType: VIDEO`、`prompt`、`payload.resources`、`payload.params` 结构
- 聚合接口状态映射已接入：`0=queued`、`1=running`、`2=succeeded`、`3=failed`、`4=cancelled`
- 当前本机实测创建视频接口已到达聚合服务，但被白名单拦截：`请求 IP 地址 122.233.177.239 不在项目 JTvHbTmS4RZjP63t 的白名单中`
- 结论：视频代码链路已按文档重接，下一步必须把 `122.233.177.239` 加入 Seedance / AI 聚合项目白名单后再测
- 修复视频错误显示：聚合接口返回 `success: false` 时不再误当任务 ID，会在前端红字显示真实错误
- 视频生成中 UI 调整：不再额外显示“正在认真思考”，而是在“正在创建视频任务 / 视频生成中”状态卡片后显示三个点动画
- 发送体验修复：按回车 / 点发送后，用户消息立即出现在对话流、输入框立即清空、按钮显示 `发送中...`，避免用户误以为卡住而重复点击
- 增加同会话发送防重和同请求回复防重，避免一次用户输入触发多条 AI 回复
- Agent 简单问候走本地短回复，避免“你好”也输出大段引导
- Agent 提示词收紧：默认一问一答，简单问题只问 1 个关键问题，不随便分段和输出“下一步方向”
- 意图识别收紧：单独“来一段 / 写一段 / 搞一段”不再判定为视频，只有明确说视频、镜头、动画、动起来、图生视频等才走视频
- 左侧栏 UI 微调：logo 底色改 `#6667ff`，图标白色；品牌文案当前为“闪念 / AI影片助手”
- 左侧“开启新对话”改为“新建对话”，使用 `Plus` 图标，文字居中且图标放在居中文字左侧
- 左侧历史选中态尝试过 `#6667ff`、`#e3e3ff`、`#efefff`、`#1fa7e1`，最后按用户要求改回最初灰色 `#ececec`
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-04-30 上传图片理解、参考图和 Agent 执行策略增强

- 用户上传 / 粘贴的图片现在会随用户消息进入对话流展示，不再只停留在输入框预览
- `/api/chat` 和 OpenRouter 请求已支持图片消息，Agent 可基于上传图片做图片理解、分析和创作建议
- 图片模式生成时会把上传图片作为参考图传给 `/api/image` 和 OpenRouter 图片模型
- 视频模式生成时会把上传图片作为首帧 / 视觉参考传给 `/api/video` 和 Seedance 创建任务
- 用户未重新上传图片但说“刚才那张图、图中、让它动起来、首帧”等，会自动取最近对话里的图片作为参考
- 本地生成图片 `/generated/...` 在发给 OpenRouter / Seedance 前会转为 data URL，避免外部平台无法访问本地相对路径
- Agent 自动路由策略收紧：上传图片后说“看看 / 分析 / 点评 / 识别”不会误触发生图，会先走图片理解和追问
- 图片 / 视频生成仍然只在明确生成意图下自动执行；模糊需求继续交给 Agent 追问或给方案
- 已验证 `npm run lint` 和 `npm run build` 通过

### 2026-04-30 项目目录改名和启动脚本修复

- 项目目录已从 `E:\project\yinzao` 迁移到 `E:\project\AI-Video-Assistant`
- 原 `E:\project\yinzao` 文件夹保留为空目录
- 中途短暂使用过 `E:\project\AI Video Assistant`，因路径包含空格导致 `start-project.bat` 双击后黑窗闪退 / 页面未启动
- 已修复 `scripts/start-project.ps1` 中 PowerShell 二次启动脚本路径未加引号的问题
- 最终目录采用无空格命名 `AI-Video-Assistant`，后续文件夹命名避免使用空格
- 已验证 `npm run lint`、`npm run build` 和 `start-project.bat` 启动均正常，`http://localhost:3000` 返回 `200`

### 2026-04-29 反馈系统、意图分类和交互增强

- AI 新回复改为逐字显示，按字数控制在 1-8 秒内，旧历史回复不重新打字
- 左侧历史对话运行中动画改为光环扩散，“正在认真思考”前也显示同款动画
- AI 头像统一为 MoonStar 圆角方形，并调整到和正文视觉对齐
- “下一步调整方向”不再每次强制输出，改为由 AI 根据用户是否犹豫 / 反复修改 / 需要选择来判断，数量为 2-5 个，最多不超过 5 个
- 前端已移除“下一步调整方向”的额外按钮，只保留 AI 原文
- Agent 模式下明确生图 / 生视频请求会自动路由到图片 / 视频生成流程，不再只输出提示词
- 生图识别加强：支持生图、出图、做图、画图、生成图片、来一张、人物 / 角色 / 男女主 / 海报 / 封面 / 插画等表达
- 生视频识别加强：支持生视频、图生视频、首帧生视频、动起来、镜头、运镜、来一段、短片、动画等表达
- 图和视频意图同时出现时优先视频，修复“用图中人物生成镜头”误走生图的问题
- 新增 `/api/intent`，使用 OpenRouter 对最近上下文做意图分类，返回 `agent` / `image` / `video` / `prompt` / `clarify`
- 前端路由策略改为硬规则 + 本地纠错记忆 + AI 意图分类
- 新增本地意图纠错记忆 `yinzao-intent-memory-v1`，用户纠正“不是，我要视频 / 是生图”或点击模式错了后会沉淀规则
- 图片 / 视频模式获取优化提示词后不再先展示提示词，而是直接进入生成
- 新增 AI 回复底部反馈操作区：复制、重新生成、喜欢、不喜欢、回答不对、要图给视频或要视频给图、更多
- 文字回复只显示“回答不对”，图片 / 视频结果只显示“要图给视频或要视频给图”
- 喜欢 / 不喜欢二选一，选中后图标保持灰色实心，再点可取消
- 回答不对和模式错了选中后使用 20px 实心图标，保持图标内部细节可见
- 复制成功显示 1 秒对勾，失败显示 1 秒 X 和“无法复制”，视频复制走失败反馈
- 反馈按钮悬停显示黑底白字 tooltip，三点更多按钮 tooltip 为“更多”
- 更多菜单支持“复制文字”和“删除”，样式与左侧三点菜单一致
- 反馈区末尾显示 12px 灰字“感谢反馈 + 时间”，格式如 `2026/4/29 20:10`
- 反馈日志写入本地 `yinzao-feedback-log-v1`，记录反馈类型、上下文、消息类型、执行模式、当前模式和纠错规则
- 输入框支持上传和粘贴图片预览，图片以约 100x100 显示，最多 5 张
- 超过 5 张图片时显示黑色提示“最多上传五张图片”
- 输入框图片删除按钮改为一直显示
- 输入框用户文字和 placeholder 强制为 14px
- 用户消息气泡、图片和视频卡片圆角统一为 12px
- 后续需提醒用户继续加强反馈系统：不喜欢原因弹窗、回答不对原因弹窗、模式错了目标模式选择、反馈日志查看页、自动总结反馈规则

### 2026-04-29 交接文档同步补充

- 已将反馈系统、意图分类、逐字输出、上传图片预览、运行中动画和最新 UI 细节同步到交接文档
- 已补充本地存储键：`yinzao-feedback-log-v1`、`yinzao-intent-memory-v1`
- 已补充后续重点：反馈原因收集、反馈日志查看页、自动总结反馈规则、图片理解 / 参考图 / 首帧生视频

### 2026-04-29 交接文档同步

- 已将最新 Agent / 图片 / 视频三模式规划同步到 `01-project-summary.md`、`02-product-decisions.md`、`03-progress-and-status.md`、`04-keys-and-integrations.md`、`05-chat-history-highlights.md`
- 已补充当前固定模型：对话 `bytedance-seed/seed-2.0-lite`、图片 `bytedance-seed/seedream-4.5`、视频 `seedance-2.0`
- 已补充输入框工具栏、上传入口、富文本回复、三个调整方向按钮、独立会话草稿和并发生成状态说明

### 2026-04-29 模式和模型策略调整

- 修复历史对话草稿串话：输入框草稿改为每个会话独立保存，未发送内容不会出现在其它历史对话中
- 修复全局生成锁：发送按钮只受当前会话生成状态影响，不再因为其它会话正在生成而禁用
- 上传图片文件名也改为按会话独立保存，避免切换历史对话时串到其它会话
- AI 回复新增基础富文本排版：空行分段、`**加粗**`、列表、`[red]红色[/red]`、`[blue]蓝色[/blue]`
- AI 回复新增标题排版：`## 大标题` 显示为 17px，`### 小标题` 显示为 15px
- AI 标题样式加大差异：支持 `#` / `##` / `###`，分别显示为 22px / 19px / 16px，单独一行加粗短文本也按小标题处理
- 修复标题必须单独成段才会生效的问题，现在同一段里的 `##` / `###` 行也会被识别并放大
- `[red]` / `[blue]` 不再直接改文字颜色，改为灰色 14px 加粗文字，并分别使用淡红 / 淡蓝底色
- `[red]` / `[blue]` 底色内文字改回对应深红 / 深蓝，保持比底色更深
- `[red]` / `[blue]` 文字颜色调浅，只比底色略深，降低视觉重量
- 新增 `---` 分隔线渲染，明显分段时显示灰色横线
- Agent 回复要求最后输出 `### 下一步调整方向`，并提供 1 / 2 / 3 三个可选调整方向
- 前端会把下一步调整方向解析成三个可点击按钮，点击后填入输入框等待用户确认发送
- 系统提示词要求超过 3 段的回答必须使用标题，提升排版可见度
- 对话 / Agent / 提示词优化系统提示词增加输出排版规则
- 输入框工具栏改为 `+` 上传入口 + 模式下拉 + 模式参数 + 发送按钮
- 模式选择从原生 select 改为与参数按钮一致的自定义上弹菜单
- 输入框支持按 Enter 发送，Shift + Enter 继续换行
- 默认模式从普通对话改为 `Agent 模式`
- 模式下拉新增 `Agent 模式`、`图片模式`、`视频模式`
- Agent 模式下不展示比例、分辨率、风格、时长参数
- 图片模式下展示普通图片模型占位、比例、分辨率、风格参数
- 视频模式下展示普通视频模型占位、比例、分辨率、风格、时长参数
- `+` 按钮现在可选择本地图片，并在输入框内显示已选图片文件名，后续再接入真实图片理解 / 参考图流程
- 顶部右侧对话模型下拉已移除
- 对话模型暂时固定为 OpenRouter 有效模型 ID：`bytedance-seed/seed-2.0-lite`
- 修复 `seed/seed-2.0-lite is not a valid model ID`，原因是 OpenRouter 上的正确前缀是 `bytedance-seed/`
- `/api/chat` 支持 `agent` 模式，并为 Agent 增加创作推进、追问、剧本和分镜方向的系统提示词
- 右下角新增灰色测试信息，显示当前对话、图片、视频模型
- “AI 可能会出错。请核查重要信息。”和当前模型测试信息移动到右侧内容区左上角、收起按钮下方
- 当前模型测试信息改为对话、图片、视频各一行显示
- 当前模型测试信息从右侧内容区左上角移动到同一左侧位置的底部
- 当前模型测试信息左侧位置调整为与输入框外侧边距平齐
- 当前模型测试信息移动到输入框底部区域，与输入框下边缘对齐
- 视频模型配置集中使用 `DEFAULT_VIDEO_MODEL`

### 2026-04-29 UI 细节二次打磨

- “开启新对话”从左侧功能区移到历史对话区域顶部，作为历史列表第一个固定入口
- “开启新对话”固定入口增加灰色虚线边框
- 对话模式图标从 `MessageSquare` 换为 `MessageSquareMore`
- 左上角品牌图标、空状态标签和 AI 头像换为 `BotMessageSquare`
- 资产管理图标换为 `FolderOpen`，视频相关图标换为 `Film`，回到底部图标改为 `ArrowDownToLine`
- 左侧栏收起图标从 `PanelLeftClose` 换为 `PanelLeftDashed`
- 左侧栏展开回来图标从 `PanelLeftOpen` 换为 `PanelLeft`
- 左侧栏收起 / 展开按钮内图标尺寸从 20px 调整为 24px，按钮尺寸不变
- 左侧栏收起 / 展开图标尺寸从 24px 调整为 22px，颜色与重命名图标保持一致
- 两处重命名图标统一从 `PencilLine` 换为 `SquarePen`
- “开启新对话”图标从 `SquarePen` 换为 `SquarePlus`
- 左上角 logo 图标换为 `MoonStar`，外框加大并改为淡紫色
- 左上角 logo 图标尺寸从 20px 调整为 24px，外框尺寸不变
- 其它出现 logo / AI 标识的位置统一为 `MoonStar` 与淡紫色方案，包括空状态标签和 AI 头像
- 右侧顶部可改名会话标题字号从 15px 调整为 18px
- 右侧顶部可改名会话标题改为与左侧历史文字一致的 13px、`font-medium`
- 微调右侧顶部标题行高和标题 / 重命名图标间距，让文字与图标垂直对齐
- 右侧顶部标题和重命名图标下对齐尝试后已还原为居中对齐
- 根据用户提供的 ChatGPT 截图，整体色彩从蓝色科技风改为 ChatGPT 式黑白灰中性色
- 左侧栏宽度调整为 262px，背景改为浅灰，历史选中态改为灰底
- 顶部栏高度调整为 56px，去掉蓝色和模糊渐变，改为简洁白底细分割线
- 右侧主背景去掉淡蓝径向背景，恢复大面积白底
- 快捷卡片、模式按钮、参数菜单、状态卡片统一改为灰白体系
- 输入框改为 ChatGPT 近似的白色圆角胶囊、灰色描边和轻阴影
- 用户消息气泡改为浅灰底，发送按钮改为黑色
- 底部新增类似 ChatGPT 的小字免责声明
- 左侧栏 logo 区改为图标 + 标题组合，增强品牌识别
- 左侧背景、分割线、选中态、历史对话项阴影和圆角继续细化
- 工作流模式和资产管理占位增加“未开放”标记
- 历史对话标题旁新增数量显示
- 右侧主区域增加淡蓝径向背景，顶部标题栏增加半透明和模糊质感
- 空会话欢迎页增加胶囊标签和更精致的快捷创作卡片
- 快捷创作卡片改为标题 + 说明文字，并增加图片 / 视频图标
- AI 消息左侧新增渐变头像，用户消息气泡改为更轻的蓝色底
- 输入框容器阴影、聚焦态、圆角和透明度继续细化
- 图片 / 视频模式按钮增加对应图标，发送按钮增强阴影

### 2026-04-28 右侧对话标题栏

- 输入框模式改为默认普通对话，不再默认选中图片或视频
- 图片 / 视频按钮移到输入框下方、发送按钮前方，并支持再次点击取消选择回到普通对话
- 普通对话模式只调用对话模型自然回答，不触发图片或视频生成
- 图片模式新增比例、分辨率、风格参数选择，并会带入提示词优化上下文
- 视频模式新增比例、分辨率、风格、时长参数选择，并会带入提示词优化上下文
- 输入框下方按钮文字统一为 12px，未调整文本输入区尺寸
- 输入框下方“普通对话”假按钮已移除
- 图片 / 视频按钮和参数按钮宽度统一为 80px
- 图片 / 视频按钮和参数按钮圆角统一为 5px
- 参数菜单改为自定义上弹菜单，不再使用原生 select 下拉
- 参数菜单宽度跟随按钮，当前为 80px
- 参数菜单文字强制单行显示
- 输入框外层圆角从 28px 改为 20px
- 输入框 placeholder 改为“发送消息...”
- 当前 textarea 字号为 15px，输入框下方按钮字号为 12px
- 右侧对话区顶部新增 60px 固定标题栏
- 标题栏底部增加灰色分割线
- 标题栏居中显示当前对话名称，与左侧历史对话名称一致
- 对话名称后新增灰色重命名图标，可打开原有重命名弹窗
- 标题栏最左侧新增左侧栏收起 / 展开按钮，可隐藏或恢复左侧区域
- 新增 `lucide-react` 图标库，并替换顶部收起 / 展开和重命名图标
- 项目内手写 SVG 图标统一替换为 `lucide-react`，包括侧栏功能、三点菜单、置顶、删除、回到底部和关闭按钮
- 识别“当前用什么模型”等模型信息问题，直接回答当前模型配置，不再触发图片或视频生成
- `/api/chat` 现在会返回 OpenRouter 响应里的 `model` 字段，模型信息问题会显示本次实际路由模型
- 新增 `/api/models`，从 OpenRouter 拉取文本对话模型列表
- 右侧顶部标题栏右侧新增对话模型下拉框，默认保留 `openrouter/auto`
- 对话模型选择只影响提示词优化聊天，不影响图片模型和视频模型
- 对话模型下拉改为只显示 Qwen、DeepSeek、字节 Seed 文本模型，并保留默认 `openrouter/auto`
- 对话模型下拉中每个厂商最多显示前 3 个模型，避免列表过长

### 2026-04-28 左侧栏和对话体验细化

- 左侧栏宽度从 300px 调整为 280px
- 左侧功能区统一为 40px 高度，四个入口间距统一为 5px
- 左侧功能区字体、图标、底色、圆角、选中态多轮微调
- 左侧历史对话项统一 40px 高度，不再显示时间
- 历史对话选中态改为白底淡阴影，文字改为灰色
- 历史对话列表滚动条改成细滚动条，并向右贴近侧栏边缘
- 左侧历史对话新增三点菜单
- 三点菜单支持置顶、重命名、删除
- 三点菜单支持点击空白处关闭
- 三点菜单会根据剩余空间自动向上或向下展开，避免底部遮挡
- 删除菜单项改为红色图标和红色文字
- 重命名由浏览器原生 prompt 改为自定义弹窗
- 自定义重命名弹窗增加黑色半透明遮罩、12px 圆角、500px 宽度、右上角关闭按钮、取消按钮灰色边框
- 重命名输入框增加 hover 淡蓝描边，focus 保持深蓝描边

### 2026-04-28 响应式和对话区优化

- 窄屏时左侧栏自动隐藏，只保留右侧对话区居中展示
- 修复浏览器变窄后右侧对话区掉到下方并被隐藏的问题
- 输入框最大宽度从 768px 调整为 800px
- 对话气泡圆角从 24px 调整为 12px
- 图片展示圆角同步为 12px
- 用户消息底色改为浅灰，与原 AI 气泡底色一致
- AI 回复去掉气泡底色，直接显示文本
- 对话内容最底部增加 30px 空白
- 切换历史对话后会自动滚动到该对话最底部
- 对话区向上滚动后，输入框上方会出现“回到底部”按钮，回到底部后自动隐藏

### 2026-04-28 生成状态和本地测试存储

- 新增 AI 思考动画，用户发送后会显示“正在认真思考”和循环点动画
- 思考动画下方预留约 300px 空白，并强制靠上显示
- 修复全局生成状态导致切换任意历史对话都显示思考动画的问题
- 生成任务新增 `pendingRequest` 状态，刷新页面后可恢复未完成的生成流程
- 发送按钮在有未完成任务时显示“生成中...”，避免并发提交多个生成任务
- 修复图片 base64 写入 localStorage 导致 `QuotaExceededError` 的问题
- 保存历史时不再持久化 `data:` 开头的大体积 base64 图片
- 本地最多持久化最近 30 个会话，避免浏览器本地存储持续膨胀
- 新增 `public/generated/images` 和 `public/generated/videos` 作为本地测试资源目录
- 新增 `src/lib/local-assets.ts`，用于把生成的图片或视频保存到本地项目目录
- 图片生成完成后会保存到 `public/generated/images`，并返回 `/generated/images/...` 地址给前端
- 视频生成成功后会保存到 `public/generated/videos`，并返回 `/generated/videos/...` 地址给前端

### 2026-04-28 对话页 UI 结构重做

- 页面从左中右三栏改为左右结构
- 去掉顶部独立横条，logo 放回左侧顶部
- 左侧改为固定侧栏风格
- 左侧新增模式选项卡：对话模式 / 工作流模式 / 资产管理
- 当前只启用对话模式，另外两个先做占位
- 图片、视频、文字结果统一改成对话流展示
- 去掉单独的右侧结果栏
- 输入框固定在底部
- 输入框改为初始较矮、内容增多时自动长高、最高 300px
- 右侧对话区滚动条改细
- 底部虚化效果尝试后已按用户要求移除

### 2026-04-28 OpenRouter 模型地区限制修复

- 确认 `API key.txt` 里的 OpenRouter key 与 `.env.local` 一致，且 key 本身可用
- 发现原 GPT-5.4 系列模型在当前地区不可用
- 聊天模型改为 `openrouter/auto`，让 OpenRouter 自动选择可用模型
- 图片模型改为当前可用的 `bytedance-seed/seedream-4.5`
- 图片生成请求改为图片模型需要的 `modalities: ["image"]`
- 增加地区不可用时的中文提示
- 本地开发时优先读取 `.env.local` 里的 OpenRouter key，避免系统环境变量覆盖导致继续报错

### 2026-04-28 OpenRouter 错误提示优化

- 将 OpenRouter 的 `User not found / 401` 错误改成中文提示
- 明确提示需要更新 `.env.local` 里的 `OPENROUTER_API_KEY` 并重启项目

### 2026-04-28 启动脚本优化

- 根目录只保留一个启动文件：`start-project.bat`
- 删除重复的 `start-project-hidden.bat` 和 `start-project-no-window.bat`
- 启动脚本改为后台启动，不保留黑窗
- 如果服务已经在运行，会直接打开网页
- 如果服务未运行，会启动后每 250 毫秒检测一次，页面可访问后马上打开
- 启动失败会打开 `start-project.log`，方便查看原因

### 2026-04-28 图片和历史记录接入

- 新增 `/api/image`，图片模式会通过 OpenRouter 图片模型生成图片
- 右侧结果区可以直接展示生成图片
- 左侧会话列表改为真实会话，不再是固定假数据
- 会话、聊天内容、图片结果、视频任务状态会保存到浏览器本地
- 新建会话按钮可用，刷新页面后历史记录仍保留
- 新增默认图片模型：`google/gemini-2.5-flash-image`
- 如需更换图片模型，可在环境变量里设置 `OPENROUTER_IMAGE_MODEL`

### 2026-04-28 小范围优化

- 补充 `README.md`，让非技术人员能快速看懂启动方式和项目结构
- `/api/chat` 增加模型和模式校验，避免前端传错值后继续请求模型平台
- `/api/video` 增加提示词和任务 id 的空格处理，并修正返回缩进
- `Seedance` 配置读取集中到一个函数，减少重复代码
- 前端错误提示更清楚，视频任务状态改为中文展示
- 图片结果区明确提示“图片生成还未接入”，避免误以为功能已完成

### 项目初始化

- 新建项目目录 `E:\project\AI-Video-Assistant`
- 使用 Next.js 初始化项目

### 页面搭建

- 替换默认首页模板
- 建立聊天式工作台布局
- 加入会话区、聊天区、结果区
- 加入模式切换和模型选择

### 交互修复

- 修复首页没有真正挂载聊天组件的问题
- 修复发送按钮点击无反应的问题

### OpenRouter 接入

- 新增 `src/lib/openrouter.ts`
- 新增 `/api/chat`
- 前端发送消息后会请求后端聊天接口

### 视频任务接入

- 新增 `src/lib/seedance.ts`
- 新增 `/api/video`
- 在视频模式下自动创建视频任务
- 前端轮询视频任务状态
- 右侧结果区展示任务状态和视频链接

### 配置

- 新增 `.env.local`
- 写入 OpenRouter 和 Seedance 的开发配置

### 启动脚本

- 新增 `start-project.bat`
- 新增 `start-project-hidden.bat`
- 新增 `start-project-no-window.bat`
- 删除不稳定的 `vbs` 启动方式

### 文档

- 新建 `handover` 文件夹
- 增加项目总结、决策、进度、集成说明、对话重点、更新日志

## Next Suggested Changes

1. 接图片生成
2. 历史记录持久化
3. 会话列表真实化
4. 优化结果区显示
5. 补登录系统
