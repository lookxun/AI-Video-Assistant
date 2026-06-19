# Chat History Highlights

这个文件用于保留和用户对话中的重要结论，帮助下一个 AI 接手时不丢上下文。

## 2026-06-20 本轮关键交接：其它账号资产新表迁移完成

- 用户要求现在开始“整理并验证资产新表迁移流程，然后逐账号迁移资产库”，随后要求“迁移线上所有其它账号，然后提交 GitHub”。本轮新增正式迁移编排脚本：`scripts/migrate-user-media-assets.mjs` 单账号流程、`scripts/migrate-selected-media-users.mjs` 多账号逐个流程、`scripts/audit-visible-duplicate-media.mjs` 可见重复校验、`scripts/audit-user-media-cost-gaps.mjs` 成本缺口校验，以及 `scripts/README-media-assets.md`。
- 本地先验证流程：`npx tsc --noEmit` 通过；本地 `ID_113219` 和 `ID_779117` 已迁移并核对。`ID_779117` 归档远程重复 17 条，可见重复为 0；本地成本缺口来自旧流水没有 `mediaUrls`，没有安全方式自动摊到媒体。
- 线上已迁移除试点 `ID_636611` 外的所有 20 个有媒体账号：`ID_973447 / ID_294338 / ID_316782 / ID_911584 / ID_415958 / ID_963115 / ID_868181 / ID_315163 / ID_947011 / ID_193006 / ID_554897 / ID_332396 / ID_262993 / ID_379461 / ID_955937 / ID_847338 / ID_673536 / ID_686996 / ID_852101 / ID_953031`。3 个无媒体账号 `ID_778841 / ID_476875 / ID_164561` 无需迁移。
- 线上每个账号完整日志在马来 `/var/www/flashmuse/.runtime/media-migration-logs/`。最终所有 20 个账号 `visibleDuplicateGroups=0`，`unmatchedLedgers=0`。也就是可见媒体没有远程/本地重复，媒体流水成本都能匹配到媒体。
- 注意：`rebuild-media-asset-registry.mjs --dry-run` 后续仍会显示从旧 workspace/message/ledger 来源发现的原始数量，不应把它理解为“又没迁完”。迁移完成状态看 `verify-visible-media-after-merge`、`audit-visible-duplicate-media` 和 `audit-user-media-cost-gaps`。

## 2026-06-20 本轮关键交接：资产新表试点、ID_636611 修复和其它账号迁移方法

- 用户反馈资产库刷新慢、刷新后跳回对话模式、资产库不出来、点对话模式出不来。线上对 `ID_636611` 实测发现数据库查询很快，慢点是接口返回体太大：对话首屏约 `306KB`，因为每条消息重复带整会话 `imageDimensions/videoPosters`；资产全量约 `301KB`。已裁剪消息返回字段并改资产库分类分页，对话首屏降到约 `21KB`，分类资产接口通常几十 KB。
- 用户反馈“资产库刷新后先跳对话模式，再过很久显示资产库”。根因是 `activePanel` 初始硬编码为 `chat`，后端返回后才恢复 `assets`。已改前端初始从 `localStorage` 的 `flashmuse-workspace-ui-state-v1` 读取最后面板、分类和滚动状态。
- 用户反馈“对话流生成视频 113 个但没滚动条、生成图片滚动位置乱蹿”。根因是新表分页后前端仍按旧全量资产逻辑：加载 60 条但只渲染 24 条，且每次追加都按 `createdAt` 全局重排。已改为由服务端按最新生成/上传排序，前端不再全局重排；加载多少渲染多少；内容不足一屏且还有下一页时自动继续拉。
- 用户确认当前资产库分类没有 `分镜视频` 和 `待分类/其它`。新规则：`UserAssetState.currentCategory` 只用当前产品口径，资产库三类 `character_image / scene_image / shot_image`；对话流三类 `conversation_uploads / conversation_images / conversation_videos`；未来工作流三类 `workflow_uploads / workflow_images / workflow_videos`。旧 `shot_video / other` 只能作为旧内部类型或媒体来源事实，不能作为用户资产分类。
- 用户确认成本规则：每张图片/每个视频独立媒体数据，多图费用平摊到每张；优化提示词 token 和反推提示词 token 独立，不算对话流也不算资产库；总扣费 = 每张图片成本 + 每个视频成本 + 对话流 token + 优化提示词 token + 反推提示词 token。文本扣费仍按小数积分累计，累计够 1 分才扣。
- 本轮给 `MediaAsset` 加成本字段，给媒体/用户状态加归档隐藏字段。`ID_636611` 迁移后可见媒体成本和媒体流水完全对齐：`usd=133.152183`、`cny=937.906716`、`credits=8779`、`promptTokens=244638`、`completionTokens=14212458`、`totalTokens=14457096`。
- 用户发现资产库有大量相同图片/视频。只读审计确认不是本地文件重复，而是“远程临时 URL + 本地 /generated URL”被当作两条媒体。`ID_636611` 共 156 组这种重复。已用 `tmp/merge-duplicate-media.js` 合并：保留本地 URL，合并远程条的费用、token、流水、requestId、模型、参数、提示词到本地条；远程条归档隐藏，不真删。之后 `ID_636611` 可见媒体从 419 降为 263，归档重复项 156。
- 用户指出“资产库里参数/名字不对，但去对话流打开同一媒体后再回资产库就对了”。原因是前端 `getCanonicalPreviewAsset()` 会从已加载 `WorkspaceMessage` 临时补全，但没有写回新表。本轮把这套逻辑搬到 `tmp/enrich-media-assets-from-sources.js`：按 URL 归一后，优先用对话流 `WorkspaceMessage` 补提示词/模型/比例/分辨率/尺寸/时长/宽高/messageId，再用 `CreditLedger.metadata`，最后用旧 `state.assets`。禁止写入 `-`、空值、内部强制规则等垃圾字段。
- `ID_636611` 本轮媒体补全结果：可见媒体 263，更新 223；补模型 39、比例 104、分辨率 104、图片尺寸 64、视频时长 40、generationSettings 205、messageId 54、宽高 41、creditLedgerId 14、提示词 99、requestId 3。接口现在能返回如 `GPT-5.4 Image 2 / 16:9 / 2560 × 1440 / 2K / 生成一个美女` 和 `Seedance 2.0 / 720p / 15秒 / @场景5...`。
- 用户要求模型只显示模型名称，不显示提供商 ID。已在 `workspace-state` 接口里把 `byteplus:video.seedance-2-0`、`openai/gpt-5.4-image-2`、`google/veo-3.1` 等映射为 `Seedance 2.0`、`GPT-5.4 Image 2`、`Veo 3.1` 等展示名。数据库仍保留原始模型 ID，前端展示读转换后的 `previewMeta.modelLabel`。
- 用户问缩略图和视频封面是否在新表里。`MediaAsset` 有 `thumbnailUrl` 和 `posterUrl`，但之前未完全填充。本轮用 `tmp/enrich-media-thumbnails.js` 给 `ID_636611` 补齐：图片缩略图 177 个、视频封面 13 个。前端 `AssetItem` 增加 `thumbnailUrl`，资产卡片优先读 `thumbnailUrl`，没有才推导 `/api/media-thumbnail` 或本地缩略图路径。
- 用户反馈对话流上传图片左侧数量 6，但右侧有时 0/2/5。根因是左侧按 URL 包含 `/upload_image/` 统计，右侧分页按 `currentCategory=conversation_uploads` 查；而旧迁移里上传图多是 `currentCategory=conversation_images`。已修：`conversation_uploads` 右侧也按 `mediaAsset.url contains /upload_image/` 查；`conversation_images` 排除 `/upload_image/`。
- 迁移其它账号必须按本轮顺序，一个账号一个账号做。命令模板：`node scripts/rebuild-media-asset-registry.mjs --dry-run --user=USER_ID` -> 真实跑；`node tmp/merge-duplicate-media.js --dry-run --user=USER_ID` -> 真实跑；`node tmp/enrich-media-assets-from-sources.js --dry-run --user=USER_ID` -> 真实跑；`node tmp/enrich-media-thumbnails.js --dry-run --user=USER_ID` -> 真实跑；最后用 `tmp/verify-visible-media-after-merge.js USER_ID`、`tmp/verify-media-costs.js USER_ID`、`tmp/count-user-media-breakdown.js USER_ID`、`tmp/audit-duplicate-media-summary.js USER_ID` 核对。不要直接全量迁移。
- 本轮所有改动已线上部署，未提交/推送 GitHub。接手后先看 `git status` 和 diff。临时脚本现在很多都在 `tmp/`，其中迁移脚本应先整理到正式 `scripts/` 后再迁其它账号，避免丢失。

## 2026-06-19 本轮关键交接：资产库重构、媒体主表、线上恢复和当前卡点

- 用户先反馈历史对话“加载更多”只显示一会 `加载中...` 然后消失。排查发现两个问题：第一，初始 `summary=1` 会额外塞 active session，前端用当前 sessions 长度计算 offset，导致下一页可能重复；第二，`historyOnly=1` 实际返回约 `155KB`，说明还带了 workspace state/assets，不是只查 5 条历史标题。已上线修复：`historyOnly=1` 只查 `WorkspaceSession`；刷新对话页改为 `/api/workspace-state?summary=1&panel=chat`。
- 用户明确三大模式加载规则：对话模式、资产库、以后工作流都要独立刷新。比如资产库左侧和右侧当前分类单独加载，右侧显示统一 `加载中...` 或蓝色进度条；切换角色/场景等分类应读取当前分类内容再展示。已做第一步：资产库通过 `/api/workspace-state?assetsOnly=1` 懒加载；输入框 `@` 资产引用也会触发懒加载。未完成：真正分类级分页还没做，目前仍一次性拉全量资产。
- 本轮出现一次严重资产缩水事故：拆分对话页加载后，前端保存时不带 `assets`，但服务端旧 PUT 没保留缺失 assets 字段，导致线上 `ID_636611` 的 `state.assets` 一度缩水到 13。已上线止血：`mergeWorkspaceAssets()` 如果 payload 没带 `assets / assetGenerateJobs`，保留 existing state。随后从可靠来源恢复到 106，并备份恢复前状态 `.runtime/migration-backups/2026-06-19T14-19-29-710Z-ID_636611-before-reliable-asset-restore.json`。
- 用户提出并确认资产库根本方案：媒体应该有像用户 ID 一样的唯一编号；编号、文件、来源、参数、提示词、出现方式是固定事实，不应随用户分类/改名变化；名称、删除、当前分类、排序是可变用户状态。未来还会有 `工作流生成` 和 `工作流上传`。本轮按这个原理新增 `MediaAsset` 和 `UserAssetState`，迁移 `20260619223000_media_asset_registry`，并预留 `workflowId / workflowNodeId / workflow_generation / workflow_upload`。
- 已新增并线上执行 `scripts/rebuild-media-asset-registry.mjs`。脚本扫描旧 `workspace.state.assets`、`WorkspaceMessage` 中图片/视频和 `imageReferences`、`CreditLedger.metadata` 中 `mediaUrls/originalPrompt/settings/creditSource`。线上 dry-run 和真实写入结果：24 个账号有数据；`ID_636611` 旧 assets 106，新表发现 408 个媒体：角色 36、场景 11、分镜图片 18、分镜视频 104、待分类 239。大量待分类是故意不硬猜。
- 资产库接口已改为新表优先。`assetsOnly=1` 现在查 `UserAssetState + MediaAsset`，映射成旧前端 `AssetItem`。修过 `lockedType` 和 `librarySource` 两个兼容坑：不加 `lockedType` 会被前端按提示词重分类；不把角色/场景/分镜/分镜视频强制映射为 `asset_generation`，左侧会显示 0。
- 当前最后状态：用户说“现在终于加载出来”，但很多封面不显示；一次加载整个资产库慢；“工作流生成视频”数量先显示 6，用户打字期间变成 7，怀疑还没加载全；再次点击资产库按钮又会重新加载。注意当前 `chat-workbench.tsx` 已改为点击资产库按钮强制 `loadWorkspaceAssets(true)`，这可能解决旧空状态，但也会导致重复加载。下个 AI 应把资产库改成分类级分页/懒加载，不要一次性拉 408+ 个。
- 排查提醒：不要再猜。先看 Nginx `access.log` 中有没有 `GET /api/workspace-state?assetsOnly=1`，看返回大小/状态/耗时；看 `/root/.pm2/logs/flashmuse-error.log` 和 `/api/client-error`；确认浏览器是否还在旧 JS 包；确认 `assetsLoadStatus` 和前端是否把返回过滤成空。曾经用户刷新后日志里没有新的 `assetsOnly=1`，说明问题在前端没有触发请求或旧包，不是数据库 0。
- 在线用户备注：本轮查到同一时间两个工作台在线，分别是 `ID_686996 / 312876953@qq.com / 124.240.106.22 广东佛山` 和 `ID_636611 / 12424740@qq.com / 125.120.248.223 浙江杭州`。这是不同账号，不会互相抢 workspace instance；之前误判为同一用户多标签，已更正。
- 本轮所有改动均已线上部署但未提交 GitHub。涉及新迁移、新脚本、工作台和 workspace-state 路由，接手后必须先 `git status` 和完整 diff。临时脚本放在 `tmp/`，线上也上传到 `/var/www/flashmuse/tmp/` 过，包括 `query-history-debug.js`、`audit-asset-sources.js`、`restore-assets-from-reliable-sources.js`、`run-prisma-with-env.js`、`count-media-registry.js`、`count-legacy-assets-from-registry.js`、`active-workspace-sessions.js`。

## 2026-06-19 本轮关键交接：后台优化、历史恢复和资产库未解决问题

- 用户先问项目能否查“当前在线人数”。结论：能查。`Session.lastSeenAt` 表示最近登录态接口访问，`Session.activeWorkspaceSeenAt` 表示工作台页面实例心跳，更适合“当前在线”。已上线后台概览卡片：当前在线人数按最近 60 秒 `activeWorkspaceSeenAt` 去重用户，灰字 `30分钟活跃` 按最近 30 分钟 `lastSeenAt` 去重用户。线上直接查库当时为 `onlineUsers=1`。
- 用户指出后台概览 `今日活跃 DAU` 显示 23，但后台看到今天登录约 5 人。排查线上数据：`currentDau=23` 是因为旧口径取 `lastLoginAt / Session.lastSeenAt / workspace.updatedAt / createdAt` 最大值，且 `workspaceUpdatedToday=23`。已改为 DAU/WAU/MAU 只按 `Session.lastSeenAt`，并同步改近 30 日活跃趋势和最近活跃用户 Top 10。部署后当时新口径为 `dau=4 / wau=19 / mau=22`。
- 用户要求后台概览调整：`当前总积分余额` 卡片放到第二行第一个；`资产保存总数` 灰字合并 `图片：数量，视频：数量`；工作流如果用户不说开放就一直禁用。已部署。线上 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` 未开启，工作流 production 继续 disabled。
- 用户反馈生成记录大表“删除数比总数还大”。根因是总数用旧汇总字段，删除数用实际列表。已改为生成记录表总数也用实际列表：历史对话总数 `user.conversations.length`，图片生成总数 `对话流图片 + 资产生成图片`。删除数括号改为英文半角 `()`，删除数为 0 不显示。已部署。
- 用户要求后台所有页面都按“先显示可见内容，展开再读展开内容，点详情再读详情内容”优化。已做并部署一版：设置页早返回；生成记录首屏只传摘要，展开请求 `/admin/api/records/user-detail?userId=...`；用户管理和积分管理首屏也只传摘要，展开时复用该详情接口加载完整用户详情/积分详情。后台详情接口无 Cookie 返回 403 正常。已验证 `/admin`、`/admin?tab=users`、`/admin?tab=credits`、`/admin?tab=records` 200。
- 用户反馈线上历史对话点 `重新加载历史` 加载不出来，后来只剩一个新对话。排查确认历史没有丢，`ID_636611` 仍有 20 条可见 `WorkspaceSession`。真实问题是历史加载失败/旧页面状态时前端仍自动保存工作区，把默认“新对话”写成 active。已软删除误创建的新对话 `e7f8c21a-3999-4f3d-821a-b1d8825f2615`，恢复 active 到 `3f8f3022-3ca9-4aa2-a291-64f7751ab6b9`，并部署：初始化 workspace-state 超时 `8秒 -> 30秒`，保存 effect 只有 `workspaceLoadStatus === "loaded"` 才允许 PUT。
- 用户随后反馈前端资产库内容消失。查明：不是服务器文件丢失，而是 `UserWorkspaceState.state.assets` 曾被前端异常 PUT 成缩水/错分类状态。对 `ID_636611` 的排查显示当时 `assets` 只剩约 20 个，历史消息里还有大量图片。已经部署服务端 `/api/workspace-state` 保护，防止 `assets` 数组缩水覆盖，且防止已有 `asset_generation / character_image / scene_image / shot_image` 被前端退成 `conversation / other`。但用户最后仍反馈资产数量、顺序、提示词和分类不对。
- 资产库问题的排查尝试很多，必须交接清楚：曾从 `WorkspaceMessage` 历史消息恢复资产、从旧备份 `.runtime/migration-backups/2026-06-06T18-48-45-483Z-user-workspaces.json` 恢复旧资产、从消息 `imageReferences` 恢复 `场景3/4/5/6/8`、从 `CreditLedger.metadata.creditSource` 审计可靠资产。最后一次全量可靠来源检查是 `problemUsers: 0`，并批量修复了 8 个账号。但用户认为仍有错误，尤其是 `ID_636611` 的角色/场景数量、顺序、提示词，以及“对话流图片混进资产库”。下个 AI 不能把这当已解决。
- 资产库后续必须继续查根因和真实旧状态。不要再靠提示词推断分类；要优先找更接近事故前的完整 `state.assets` 数据，或从 `CreditLedger.metadata.assetName/systemName/mediaUrls/originalPrompt/settings`、`WorkspaceMessage.imageReferences`、`.runtime/media-save-jobs.json` 和旧备份组合恢复。用户特别强调重点不是只恢复当前账号，而是查清楚哪一步导致的并更正，否则其它账号也会有问题。
- 本轮所有上述内容都已线上部署但未提交/推送 GitHub。构建均通过，仅有既有 Turbopack/NFT tracing warning。PM2 多次重启后 online，阿里 `_next/static` 已同步清缓存。

## 2026-06-19 本轮关键交接：历史加载、软删除、后台统计修复

- 用户反馈：登录后在工作台关机，开机浏览器恢复工作台，但历史对话长时间不显示；刷新后又等很久才出来。排查结论：拆表接口本身快，问题更像浏览器恢复旧页面时初始化请求挂住/失败，前端没有自动重试。已本地改：`fetchJsonWithRetry()` 加默认 10 秒超时；初始化 `/api/workspace-state?summary=1` 单次 8 秒超时、最多自动重试 5 次；左侧历史区显示 `历史加载中...`，失败后显示蓝色 `重新加载历史` 按钮。未部署。
- 用户问线上 `B_107`。线上 PM2 日志显示：`Video generation completed with no output (content may have been filtered)`，任务是 BytePlus `Seedance 2.0` 的 `cgt-20260619032158-hjgsh`。这是轮询阶段平台完成但没返回视频，内容可能被过滤；不是首尾帧参数问题，不是真人审核问题。已本地改错误文案为 `输出视频被平台过滤，未返回视频。重新生成有可能会成功。`，有 `(B_xxx)` 时保留编号。
- 用户明确删除总原则：平台没有真正删除能力。用户侧删除只是不显示或进回收站，回收站 30 天后也只是用户侧不显示；服务器文件、数据库记录、后台数据全部保留。客服可在后台找回误删内容给用户。前端文案仍可以让用户以为已删除。已本地把 `/api/asset-delete` 改成 no-op，回收站到期不再删除文件、不再移除 workspace 资产，只隐藏。
- 对话删除必须软删除且不能拖慢读取。已本地新增 `WorkspaceSession.deletedAt` 字段和 `[userId, deletedAt, updatedAt]` 索引，迁移 `20260619002000_workspace_session_deleted_at`。用户侧 `/api/workspace-state`、`/api/workspace-session` 只查 `deletedAt: null`，后台读取全部并标识。前端删除对话只写 `deletedAt`，不删 `WorkspaceSession`/`WorkspaceMessage`。
- 用户指出线上后台生成记录大表数据错：历史对话全 0、视频生成全 0。查线上源码确认后台还在读旧 `user.workspace.state`，而线上已拆表。已本地改后台为合并 `UserWorkspaceState.state` 的资产/设置 + `WorkspaceSession` + `WorkspaceMessage` 的真实数据，用户管理、生成记录、积分管理共用同一套后台工作区状态。未部署。
- 生成记录大表按用户要求，`历史对话 / 图片生成 / 视频生成 / 上传图片 / 上传文件` 五列显示为 `总数（删除数）`，括号红色。删除对话在标题最前显示红字 `用户已删除`；删除图片/视频在主图和缩略图左上角显示红色 `已删除`，参数和提示词照常显示。`对话流图片` 计数不再包含上传图片；概览图片/视频总数用拆表统计兜底。
- 本轮还给新图片/视频流水补了恢复字段：图片 metadata 写 `originalPrompt`；视频 metadata 写 `settings / ratio / resolution / duration / originalPrompt`。旧数据如果从未保存提示词，后台无法凭空恢复；新数据以后可恢复。验证：`npx prisma generate`、`npx prisma migrate deploy`、多次 `npx tsc --noEmit` 通过。曾停止本地 dev 进程释放 Prisma DLL，接手后本地页面打不开先重新启动。

## 2026-06-19 本轮关键交接：Seedance 尾帧规则、B106 和部署

- 用户先问 Seedance 生视频几种模式什么情况下阻止/提示。当前最终规则已经改成：只有明确 `首帧 / 第一帧 / 从这张图开始 / 以这张图开始` 触发首帧；只有明确 `首尾帧 / 首帧和尾帧 / 第一帧和最后一帧` 触发首尾帧；单独 `尾帧 / 最后一帧 / 以这张图结束` 不再触发尾帧模式，不管有几张参考图都按普通参考图发；其它都按普通参考图发。
- 用户要求 `首尾帧` 模式但少于 2 张参考图时，阻止后不要清空输入框。已改为前端在清空草稿/上传图之前校验：少于 2 张只提示 `首尾帧生视频需要至少两张参考图`，不发请求，不清空输入框，不清空参考图。
- 用户问线上 `B_106` 原因。诊断日志显示它是 `referenceMode=last_frame`、1 张图 role=`last_frame` 导致火山创建阶段报参数错误：`last frame image content cannot be mixed with first frame or reference image content`，Request id `02178181407673134cac430b5ac258905380d809540adb4b6d5f8`。这不是版权风控，也不是真人审核。
- 用户指出 B106 点重新生成后成功。继续查日志确认成功那次没有发 `last_frame`，而是普通 `reference_image`，任务 `cgt-20260619042134-rj29f` 后续轮询成功。因此最终决定：禁用单独尾帧模式，尾帧词单独出现一律普通参考图，不提示、不阻止。
- 本轮先短暂实现过“单独尾帧提示需要同时提供首帧和尾帧”，但用户随后否定，要求“说尾帧不管有几张图都按普通参考图发”。最终代码已按这个要求部署。接手时不要恢复单独 `last_frame`，也不要再提示尾帧需要补首帧。
- 已部署文件：`src/components/chat-workbench.tsx`、`src/app/api/video/route.ts`、`src/lib/openrouter-video.ts`。线上 build 通过，PM2 online，阿里 `_next/static` 已同步清缓存；本轮没有提交 GitHub。

## 2026-06-19 本轮关键交接：仅同步交接文档和更新日志

- 用户要求把本对话框内所有做的内容写入交接文档和更新日志，目的明确是让下一个 AI 保留记忆并能继续工作。
- 本轮对话中没有新增功能需求、没有代码实现、没有部署、没有提交/推送，也没有运行类型检查或构建。实际完成事项是更新交接文档和更新日志本身。
- 已更新的文档：`handover/00-README.md`、`handover/03-progress-and-status.md`、`handover/05-chat-history-highlights.md`、`handover/CHANGELOG.md`。
- 接手提醒：不要因为看到本轮文档更新就误以为有新的业务代码已验证。本轮之前项目已处于 dirty worktree，继续任何工作前先检查 `git status` 和完整 diff。

## 2026-06-19 本轮关键交接：线上部署、工作流禁用、Seedance 规则和日志

- 用户要求把除工作流模式相关内容外的所有内容部署上线。实际执行中先准备过“不含工作流画布”的临时工作台版本；用户随后指出不用这么麻烦，可以完整部署代码但线上禁用工作流按钮。最终已改为 `WORKFLOW_MODE_ENABLED`：本地开发默认开启，线上 production 默认关闭，可用 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true` 线上开放。线上工作流按钮不可点并显示 `未开放`；旧 `activePanel=workflow` 会回到聊天。
- 线上已部署历史会话/消息拆表并完成迁移：23 个用户、60 条会话迁移到 `WorkspaceSession`，57 个会话、650 条消息迁移到 `WorkspaceMessage`，二次 dry-run 为 0。后续不要再改回请求时迁移。
- 用户问后台用户管理为什么不按最后登录排序。原因是旧代码按最近活跃时间排序，包含 workspace 保存时间。已改为按 `lastLoginAt / Session.lastSeenAt` 最近时间排序，最近登录/访问的用户排最上面。
- 用户要求右上角使用量不再显示美元/人民币。已改为浮层只显示 `Tk`、积分、淡横线、图片数、视频数；积分在 Tk 下面，横线颜色跟“使用量”字一致但更淡，左右有缩进。
- 用户排查 `B_103`：这不是马上能显示的创建阶段错误，而是任务 `cgt-20260619030625-cdl79` 在火山轮询阶段约 8 分钟后返回 `output video may be related to copyright restrictions`。用户排查 `B_104`：任务 `cgt-20260619032158-hjgsh`，约 4 分钟后返回同类输出版权风控；实际 prompt 没有 `<system-reminder>`。用户重生成 B104 成功，说明输出版权风控有随机性，同 prompt 不必然失败。版权错误文案已追加 `重新生成有可能会成功。`
- 已新增 `video-diagnostics-log.jsonl` 专用日志，记录 Seedance 首帧/尾帧/首尾帧、普通参考图、自动火山审核和轮询失败/成功。下次查视频问题优先看 `.runtime/video-diagnostics-log.jsonl`，再看 PM2 日志。注意日志不要写完整 URL 和完整 prompt。
- 用户问 `video_4_d20` 是否首帧生成。线上查询确认：任务 `cgt-20260619033138-t9mjp`，`referenceMode=first_frame`，参考图 role=`first_frame`，提示词 `@场景5 作为第一帧开始...`，生成成功。
- 用户要求按火山官网修正 Seedance 模式。官网明确首帧、首尾帧、普通多参考图互斥，不能混用。当前最终规则：普通参考图最多 9 张；首帧只用第 1 张；首尾帧只用前 2 张；单独尾帧不再发 `last_frame`，一律普通参考图；多余图片前端提示但不阻止，后端强制裁剪。后续不要再把首帧/首尾帧和 `reference_image` 混传。
- 本轮所有改动已部署线上并通过 build/PM2/HTTP 基础验证，但没有提交 GitHub。接手后先 `git status`，注意本地还有工作流开发代码和大量已部署未提交改动。

## 2026-06-19 本轮关键交接：工作流第一版和画布操作

- 用户要求继续制作工作流，并让 AI 先查看 `E:\project\clean_project_code\docs` 下另一个项目的交接文档。阅读结论：另一个项目的工作流是 `Vite + ReactFlow + FastAPI`，有完整节点系统和 3D 导演台，但不能直接整包搬到本项目。能参考思路和部分纯函数/组件，不能照搬黑色 UI、计费、上传或后端链路。
- 用户明确说“导演台也先不要”。因此本轮没有接 `DirectorNode / DirectorStage / DirectorBindingBar`，没有引入 `three`，也没有做 3D 导演台。后续除非用户重新明确要求，否则不要主动开始导演台。
- 用户明确要求：颜色要用我们自己的；不能影响其它任何功能；积分扣除用我们自己的；“只是借鉴他的功能代码，能用就用，不能用就改”。本轮因此选择轻量自研画布，不新增 `@xyflow/react`，避免引入大依赖影响现有工作台。
- 当前工作流第一版：新增 `src/components/workflow-canvas.tsx`。右侧工作流不再只是空网格，而是一个可用画布。支持文本节点、图片生成节点、视频占位节点；文本节点可连到图片节点；图片节点用上游文本 + 自身提示词调用 `/api/image`，积分仍走本项目后端 `chargeCredits()`。
- 工作流数据挂在 `workflowItems[].canvas`，并随现有 `/api/workspace-state` 保存。当前没有独立工作流表，也没有新增迁移。后续如果工作流数据变大，再考虑拆表，不要现在贸然加大改。
- 画布交互细节：左下角有鼠标和手的图标。鼠标模式用于选择/移动节点；手模式用于移动画布。快捷键 `V` 切回鼠标；按住 `空格` 临时切到手型拖动画布；鼠标滚轮直接缩放画布。用户明确要求滚轮不用按 Ctrl。
- 用户发现“无限画布上面有边界，节点无法往上移”，原因是第一版有 `x/y >= 24` 限制。已移除，节点现在可以拖到负坐标。
- 用户担心画布移开后找不到节点。已加左下角“定位全部节点”按钮和快捷键 `F`。它会按节点边界自动居中找回；最多放大到 `100%`，不会自动变 `120%`；滚轮缩放接近 `100%` 会吸附到 `100%`，避免滚不到整百。
- 用户要求切到别的分类再回工作流时保持离开前画布定位。已把每个工作流视口 `viewport: { x, y, zoom }` 存进 `WorkflowCanvasState`，切换对话/资产/工作流都能恢复最后位置。
- 用户要求左侧“工作流模式”的 `未开放` 去掉，并不再灰态。已改为正常入口样式。
- 用户发现点击按钮后按空格会出现很粗黑色描边。一开始只在工作流工具按钮去掉，后来用户说其它地方也有，最终在 `src/app/globals.css` 全局去掉 `button` 和 `[role="button"]` 的默认 focus outline。注意这会牺牲默认键盘焦点可见性，后续若要更规范可设计自定义蓝色 focus ring。
- 用户要求后台去掉“登录设备”这一项。已从 `src/app/admin/admin-users-panel.tsx` 的用户详情中移除 `登录设备` 展示，但 `lastLoginUserAgent` 数据采集和接口字段仍在。
- 本轮多次 `npx tsc --noEmit` 通过。`npm run build` 失败原因是本机拉取 Google Fonts `Geist Mono` 失败，和本轮代码无关。当前仍未部署、未提交、未推送。

## 2026-06-18 本轮关键交接：侧栏折叠、工作流工作区和 Seedance 首尾帧

- 用户先明确本轮不测试火山审核，火山自动审核作为部署后重点测试；当前继续只在本地做基础功能。不要因为看到火山自动审核代码就主动部署或线上测试，除非用户明确要求。
- 用户要求工作台左侧栏点击收起后不要完全消失，而是保留 `80px` 宽度。折叠态需要保留所有入口，只改变显示方式：Logo 只显示图片，三个模式只显示图标，历史标题隐藏，新建对话只保留正方形虚线框和居中 `+`，资产库下方只显示图标，积分只显示积分图标和数量，头像只显示头像。
- 本地已实现折叠态历史菜单：侧栏里只显示一个历史图标按钮，点击后右侧弹出历史对话菜单。菜单固定最大高度，超过内部滚动；保留加载更多、运行中状态、每条三点菜单，以及置顶/重命名/删除。用户发现二级菜单被滚动容器裁切，已改成 `portal` 独立浮层。
- 用户指出折叠态头像菜单一开始被浏览器左侧裁掉，后又偏太右。最终已改为折叠态头像菜单左侧和头像按钮左边对齐，菜单大小不变。折叠态积分卡功能也已补回，点击会打开用户中心 `我的积分`。
- 用户要求工作台 Logo 不再承担“切换线路”功能。当前工作台 Logo 展开态点击收起侧边栏，折叠态点击展开侧边栏；首页 Logo 的切换线路功能保留，不要误改首页。
- 用户要求工作流模式第一版：右侧不要标题栏，整个右侧全部是工作区，网格改成参考图那种大格+小格效果，但颜色不用改。当前本地已隐藏工作流右侧标题栏，取消内容区内边距，网格铺满整个右侧工作区。
- 用户追问图生视频里的模式，最终确认：Seedance 图生视频除了普通参考图，还要支持首帧、尾帧、首尾帧。规则是用户明确说首帧/尾帧/首尾帧才用；不明确说时仍按普通参考图或多参考图处理。
- 当时实现：`首帧 / 第一帧 / 从这张图开始` -> 第一张参考图 role 为 `first_frame`；`尾帧 / 最后一帧 / 以这张图结束` -> 第一张参考图 role 为 `last_frame`；`首尾帧 / 首帧和尾帧` -> 第一张图 `first_frame`、第二张图 `last_frame`。注意此条已被 2026-06-19 最终规则覆盖：单独尾帧现在一律普通参考图，不再传 `last_frame`。
- 重要风险：BytePlus 文档页面直接抓取不到具体 role 字段说明，当前按项目现有 `content[].role` 结构接入 `first_frame / last_frame`。本地已通过类型检查，但必须在线上真实调用 Seedance 2.0 / Fast 后确认字段是否正确；如果 API 报参数错误，优先校准 `src/lib/openrouter-video.ts` 里的 role 字段名，不要回滚默认普通参考图逻辑。
- 本轮验证：多次 `npx tsc --noEmit` 通过。本轮仍未部署、未提交、未推送。本地还有 6 月 17 历史拆表和火山自动审核等未提交改动叠加，接手后先看 `git status` 和完整 diff。

## 2026-06-18 本轮关键交接：火山视频真人参考图自动审核

- 用户反馈显式“火山素材审核”体验不好：入口藏在资产预览里，普通用户不知道是什么，而且这个能力只影响 `Seedance 2.0 Fast / Seedance 2.0` 视频参考图真人限制，不应在资产库作为通用功能长期展示。
- 用户最终确认方案：界面上不要显示审核按钮。用户正常使用火山视频模型生成视频；如果模型返回真人/隐私参考图错误，系统自动接管，把本次参考图提交审核；审核通过后自动用 `asset://` 再次创建视频任务。用户最多看到提示：`系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....`。
- 已本地实现：`/api/video` 首次遇到真人/隐私参考图错误时返回 `status: "reviewing"`；前端收到后追加蓝色、无横线的特殊系统提示，再带 `autoBytePlusAssetReview: true` 重试；后端进入自动审核、轮询 `GetAsset`，`Active` 后用 `asset://{id}` 继续创建视频任务。手动“火山素材审核”UI 已从资产预览隐藏。
- 多参考图时不能可靠知道哪张触发真人限制，因为火山错误不提供图片索引或具体 URL。当前策略是审核本次视频任务用到的全部参考图。
- 本地测试 B159/B160/B161 显示自动审核流程已触发，但 BytePlus 素材库下载供应商临时 TOS 参考图时报 `fetch object not found`。已修为优先把远程临时 URL 映射到本地保存队列里的 `/generated/...` 副本再提交；如果找不到本地副本，就返回通用错误，不给用户显示“临时地址失效”这类技术原因。
- 重点提醒：这个功能本地只能测前端提示和后端分支，完整流程必须上线后测。因为 BytePlus `CreateAsset` 需要公网 HTTPS 图片 URL，本地 `/generated` 或 `localhost` 不可下载。部署后务必用线上 `https://main.venusface.com/generated/...` 真人/写实参考图，分别测 `Seedance 2.0 Fast` 和 `Seedance 2.0`：确认真人错误后提示出现、素材审核成功、资产字段写回、`asset://` 重试、视频任务继续生成。
- 本轮只改本地，未部署、未提交、未推送。`npx tsc --noEmit` 已通过。接手后注意本地还叠加 6 月 17 历史拆表未提交改动，不要直接覆盖。

## 2026-06-15 本轮关键交接：预览下载、本地清理、部署和 GitHub 同步

- 用户反馈预览页右上角下载按钮有些视频下载异常，怀疑“下载来会直接删除掉”。排查结论：下载按钮没有删除逻辑，`/api/asset-delete` 只在回收站过期清理时触发。真正风险是远程临时 URL：供应商链接可能过期、跨域导致浏览器忽略 `download`，或需要鉴权，行为不稳定。
- 用户确认产品逻辑应为：临时 URL 只用于刚生成后的即时展示；后台保存完成后应替换成自己的 `/generated/...`；下载按钮必须优先使用本地服务器地址。若后台还没下载完，下载按钮先禁用并显示 `下载准备中...`，图片和视频都一样。
- 已在本地实现并部署：预览页如果 `previewAsset.url` 仍是 `http/https` 远程 URL，则下载按钮禁用并显示 `下载准备中...`；替换为 `/generated/...` 后显示正常下载按钮。预览对象同步逻辑也从“只同步图片”改为图片/视频都同步 `url/posterUrl`，避免视频预览仍拿旧临时 URL。
- 线上只读查询 `12424740@qq.com / ID_636611` 的 d19 对话：该对话有 6 个视频，马来服务器上 6 个视频和 6 个封面都已存在。说明该用户 d19 的问题不是后台没下载完，而更可能是前端预览/下载链接或阿里同步缓存问题。
- 本轮本地清理空间：删除 `.next`、构建缓存、依赖缓存、旧部署包、旧 HTML 快照；再按本地数据库工作台历史/资产库/头像引用关系清理 `public/generated`，删除未引用媒体 737 个，释放约 1.65GB。清理后 `public/generated` 约 1.39GB，未引用媒体复扫为 0。该操作只清理本地，不影响线上。
- 用户要求并确认新规则：以后不要把临时生成文件放到项目文件夹外面。所有临时生成文件、部署包、调试快照、中间脚本都必须放在项目目录内，例如 `E:\project\AI-Video-Assistant\tmp\...`，不能放在 `E:\project` 根目录。
- 已部署线上并推送 GitHub。部署使用马来 `/usr/local/bin/deploy-flashmuse-production.sh`，PM2 online，阿里静态同步完成。GitHub 最新提交为 `5629ac2 Fix text billing and preview downloads`。`AI-Video-Assistant_Project Planning/` 因含邮箱等敏感资料已加入 `.gitignore`，不要原样上传。

## 2026-06-15 本轮关键交接：线上退首页、通用文本计费和 @ 引用资产按钮

- 用户反馈阿里入口多次出现“登录进工作台后被退回首页，但没有退出登录”。排查发现不是 Cookie 失效，而是前端逻辑误退：初始 `/api/workspace-state?summary=1` 失败会总 catch 退首页；工作台实例锁首次 claim 失败后，下一次检查 `active:false` 也会退首页。已改为只在明确 `401` 或页面已成功 claim 后确认被其它工作台抢占时退首页；网络/5xx/JSON 失败只记录 warning 并保留页面。
- 用户反馈通用模式文本对话只看到 Tk 变化，美元/人民币/积分为 0。结论：前端并不是没接 `usage/credit`，而是部分通用文本模型只返回 token 或返回 `cost=0`，旧代码拿不到美元成本；即使有 token，短文本成本很小，单次四舍五入也容易归 0。
- 用户明确要求“尽量接近真实”，不要为了显示好看强制 `<0.0001`，也不要文本每次最低扣 1 分。最终规则：平台返回 `cost/usd > 0` 就用美元；没美元但有 token 就用模型价格表反推美元；图片/视频这种单次较大的请求按次扣费，只在人民币转积分时四舍五入；文本/通用对话/Agent 规划按小数积分后台累计，累计满 1 分才扣 1 分，余数继续保留，用户右上角仍显示累计 token/美元/人民币。
- 已新增 `User.textCreditRemainder` 和迁移 `20260612000000_user_text_credit_remainder`。`chargeCredits()` 现在对 `kind === "text"` 使用该字段累计小数积分；每条文本流水 metadata 会写 `rawCredits`、`textCreditRemainderBefore`、`textCreditRemainderAfter`、`expectedCredits`、`chargedCredits` 等审计字段。图片/视频不走累计池。
- 已为通用 OpenRouter 文本模型补价格兜底，单价来自当时 OpenRouter `/api/v1/models`：Seed 2.0 Lite、DeepSeek V4 Pro、DeepSeek R1 0528、Gemini 3 Flash、Gemini 3.1 Pro、GPT-4o、GPT-5.4、GPT-5.5。`cost=0` 且有 token 时不再当免费，会按 fallback 价格估算。
- 第一批线上部署细节：备份目录 `/var/www/flashmuse/.deploy-backups/20260612000139/`；上传 `chat-workbench.tsx/openrouter.ts/credits.ts/text-cleanup.ts/schema.prisma` 和迁移 SQL；线上应用迁移和 `prisma generate` 后运行 `/usr/local/bin/deploy-flashmuse-production.sh`，构建通过、PM2 online、阿里静态同步完成。注意线上 `.env.local` 仍有重复 `DATABASE_URL` 坑，迁移时用临时 Node 脚本读取第一条，未暴露密码。
- 本地打不开的问题也排查过：`start-project.log` 卡在 `docker compose up -d`，Docker Desktop Service stopped，Docker CLI 卡住；但 PostgreSQL 5432 通。停止卡住的 `docker compose` 后，直接独立窗口 `npm run dev` 可启动，本地 `/` 和 `/workspace` 均 200。以后本地打不开先看是否又卡在 Docker CLI。
- 用户随后反馈输入框下面 `@` 按钮有时点不开引用资产弹窗，尤其复制提示词到输入框后。根因是弹窗列表依赖 `activeAtQuery`，底部按钮原先通过插入裸 `@` 触发；复制长提示词后光标/选区/字数限制可能让裸 `@` 没成功形成查询。已改成底部 `@` 按钮和 placeholder 蓝色 `@` 直接打开资产列表，不再先插裸 `@`；点资产时再在当前光标插入完整 `@资产名`。手动输入 `@` 搜索仍保留。
- 第二批线上部署细节：备份目录 `/var/www/flashmuse/.deploy-backups/20260615034553/`；只上传 `src/components/chat-workbench.tsx`；运行标准部署脚本后 PM2 online、阿里静态同步完成。`https://main.venusface.com/workspace` 返回 200；阿里域名本机 curl 仍可能 TLS 握手失败，这是此前已记录的阿里外网 TLS/网络问题，不代表本次部署脚本失败。
- 本轮没有提交或推送 GitHub。当前本地还有未提交代码、迁移、交接文档、`src/lib/text-cleanup.ts` 未跟踪和 `AI-Video-Assistant_Project Planning/` 未跟踪。下一个 AI 接手如果要提交，必须先完整审查 `git status` 和 diff。

## 2026-06-11 本轮关键交接：通用模式升级和线上修复

- 用户确认通用模式应类似 OpenCode：底层可切换 DeepSeek/Gemini/GPT/Seed，但产品身份统一为 `闪念通用 Agent`。回答能力问题时按闪念系统整体能力回答，而不是按当前对话模型裸能力回答。即 DeepSeek 负责规划/对话，但通用 Agent 可以调用图片模型生图、视频模型生视频。
- 通用模式身份规则：问“你是谁”答“我是闪念通用 Agent”；问“你是什么模型/当前模型”答“我是闪念通用 Agent，当前对话模型是 XXX”；问“你能做什么/能不能生图生视频”答“可以问答、写作、规划任务，并可调用当前选择的图片/视频模型生成”。不要再出现“DeepSeek 不支持生成视频”这种回答。
- d49 对话排查：用户选 DeepSeek，问“能不能生图”时 DeepSeek 正确追问并最终调用图片模型；后续问“那你能做视频吗？”却回复“不支持生成视频”。根因是这类能力问题被当普通问答，模型按裸能力回答。已在通用规划器和普通回复规则里把“你能生图吗/你能做视频吗/支持视频吗”视为潜在生成需求，返回 clarify 追问要生成什么，并禁止说当前对话模型不支持。
- B_158 排查：通用模式规划失败，是因为 `/api/agent-plan` 传了通用对话模型但后端 `planAgentTask()` 仍走 `agent` provider 配置，没走 `general.*` 开关。已改为通用模式规划用 `getTextProviderConfig(model, "general")`，并给 agent-plan 错误日志加 `mode/model/requestId`。
- 通用模式不再硬规则直调生成。用户每次通用对话都先由当前对话模型规划；信息不够时追问并列出选项；用户说“随便/你自己定/以后不要问我/默认就行”才自动决定参数并调用当前通用图片/视频模型。
- 后台已为通用模式加用户级开关：`User.generalModeEnabled` 默认 false，后台用户管理大表格“状态”前新增“通用模式”开关；未开启的账号前台看不到通用模式，服务端也会拒绝 `mode=general`。
- 通用模式 Seed 模型显示规则：`Seed 2.0 Lite` 下方显示 `Seed 2.0 Pro`，Seed 系列在其它厂商上面。`Seed 2.0 Lite` 如果后台切 BytePlus，前端按钮和回复前图标显示 BytePlus 图标；实际请求也走 BytePlus 的 `general.seed-2-0-lite`。
- 用户要求通用/Agent 回复不要太死。已允许轻松场景多用表情和语气词；清单/能力列表/步骤中可以多用 `✅/🎯/📝/💡/⚠️/📌` 等符号类图标增强可读性。但严肃法律/医疗/财务/政治结论少用或不用。
- 通用模式输出格式协议：问答先结论；写作/翻译/润色/总结/代码/邮件/文案先给 `# 结果`；方案/计划先给 `# 推荐方案`、`## 执行步骤`、`## 注意事项`；创作任务用创作结构；信息不足一次性追问并给选项。
- 每个历史对话新增长期记忆摘要：首次约 20k tokens 生成，后续新增约 12k tokens 更新；请求带摘要 + 最近 12 轮原文。摘要要保留用户偏好、任务目标、设定、生成内容、纠错、未完成事项、资产引用和“以后不要问我/你自己定”的授权。
- 通用模式和上传规则新增日志：`.runtime/general-task-log.jsonl` 记录通用任务类型；`.runtime/upload-rule-feedback-log.jsonl` 记录带图/文档/参考图时模型端真实错误，后续用于校准上传大小和数量。不要把日志提交 Git。
- 修复历史 AI 文本切换/刷新还打字：只有本轮新生成文本进入 `activeTypingMessageIds` 才打字；旧历史直接完整显示。
- 用户发现 DeepSeek 输出 `è¶³å½©...` 乱码和 `<system-reminder>`。已新增 `src/lib/text-cleanup.ts`，后端保存前、前端显示时清洗：尝试修复 mojibake 并删除 `<system-reminder>`。已直接部署线上。旧内容如字节已损坏只能部分恢复。
- 用户消息气泡下方新增 hover 时间和复制图标，复制成功显示勾，不显示“复制”文字。
- 本轮完整功能已部署线上并提交 GitHub `eee77a5`；但最后的文本清洗/乱码修复和本交接文档更新是在 `eee77a5` 之后直接部署的，尚未再次提交。接手后先 `git status`，避免漏提交。

## 2026-06-10 本轮本地通用模式关键交接

- 本轮用户再次强调只做本地，不部署。本轮没有部署服务器，没有提交或推送 GitHub。
- 本地登录“请求失败”原因是本地 PostgreSQL 缺 `20260610000000_user_login_audit` 迁移，`User.lastLoginIp` 列不存在。已执行 `npx prisma migrate deploy`，并改 `scripts/start-project.ps1`：启动前自动 `docker compose up -d` 和 `npx prisma migrate deploy`。以后本地登录 500 先看 `start-project.log` 和迁移状态。
- 新增 `通用模式`：在输入框模式菜单里位于 `Agent 模式` 上方，图标用用户给的 `ai-agent-line` SVG。通用模式普通聊天走 `/api/chat mode=general`，不是影片/短剧 Agent；明确生图/生视频时复用生成链路，调用通用模式选择的图片/视频模型。通用模式回复前的小蓝图标也用 `ai-agent-line`。
- 通用模式工具栏有三个等宽选择框：对话模型、图片模型、视频模型。选择框不显示 `对话/图片/视频` 前缀，只显示模型名；宽度不足自动 `...`，输入框变宽后显示更多。三个框永远在输入框里，不撑出。
- 通用对话模型列表当前顺序：`Seed 2.0 Lite`、`DeepSeek V4 Pro`、`DeepSeek R1 0528`、`Gemini 3 Flash Preview`、`Gemini 3.1 Pro Preview`、`GPT-4o`、`GPT-5.4`、`GPT-5.5`。`GPT-5.5` 金色显示。DeepSeek 图标使用用户给的 SVG。
- 后台系统设置已接通通用对话模型：新增 `通用模式 / Agent 规划 / 意图识别` 分组。OpenRouter 列展示全部通用对话模型；`Seed 2.0 Lite` 可与 BytePlus `Seed 2.0 Lite` 互斥；BytePlus `Seed 2.0 Pro` 独立一行、独立开关、不互斥。新增系统设置 key：`general.seed-2-0-lite`、`general.seed-2-0-pro`。`/api/model-availability` 新增 `generalModels`。
- 重要链路修复：旧本地 `.env.local` 有 `chat.seed-2-0-lite` 配成 `byteplus`，会让旧普通对话链路实际请求火山 Seed，所以用户选其它模型时看到模型自称 Seed。现在 `mode=general` 使用新的 `general.*` key，不再走旧 `chat.*` 映射；除后台打开的 BytePlus 通用模型外，通用对话模型直连 OpenRouter。
- 模型身份污染最终方案：不隔离历史。用户曾担心“每个模型看不到其它模型回复会破坏连续性”，所以已改为完整历史照常发送；只有当用户问“你是谁/什么模型/谁开发/当前模型”等身份问题时，追加隐藏约束，说明当前实际模型名和模型 ID，要求不要沿用历史里其它 assistant 的身份。
- DeepSeek 报错结论：`B_145/B_146/B_147/B_151/B_152` 都是通用模式 DeepSeek 的 `no endpoints found`。直测 OpenRouter，`DeepSeek V4 Pro` 和 `DeepSeek R1 0528` 纯文本多次 200；报错原因主要是历史里带图片字段，而这两个是纯文本模型。已对这两个模型特殊处理：历史图片字段不打包，只传文字历史；如果当前这次用户带图片或 `@资产`，前端提示切换支持图片的模型。
- 本地直测结果：`Seed 2.0 Lite`、`DeepSeek V4 Pro`、`DeepSeek R1 0528` 可用；`Gemini 3 Flash Preview`、`Gemini 3.1 Pro Preview`、`GPT-4o`、`GPT-5.4`、`GPT-5.5` 当前返回 OpenRouter 403 地区不可用。后续用户测试这些模型报地区不可用不是本项目路由错。
- 桌面有 `C:\Users\ASUS\Desktop\OpenRouter对话模型清单.md`，记录 OpenRouter 339 个对话模型，按 53 个厂商分类。该文件不在项目内。

## 2026-06-10 本轮对话关键交接

- 本轮用户要求排查后台生成记录里图片不显示和很多 `扣分异常`。结论：线上 generated 文件没有丢，裂图主要来自过期远程签名 URL。采样显示 generated 文件 `541` 个全部存在，远程 URL `197` 条，主要是 BytePlus TOS 和 OpenRouter content URL。
- 已新增后台媒体 URL 解析：`src/app/admin/admin-media-url.ts` + `src/app/admin/api/media-url/route.ts`。后台遇到远程签名 URL 时走 `/admin/api/media-url`，接口读 `.runtime/media-save-jobs.json`，把远程 URL 映射到本地 `localUrl / thumbnailUrl / posterUrl`。接口必须放 `/admin/api`，不要移到 `/api/admin`，因为后台 Cookie path 是 `/admin`。
- 关键踩坑：第一次接口返回 `http://localhost:3000/generated/...`，导致浏览器打不开；已改成相对 `Location: /generated/...`。第二次发现左侧主图显示小缩略图，已加 `variant=original|thumb`：主图/悬停大图用 `original`，右侧列表小图用 `thumb`。
- `37376543` 账号排查：用户为 `373765430@qq.com / ID_868181`，他只有一张生成图但后台不显示。原因是 workspace 和资产里仍是 BytePlus 远程签名 URL，但保存队列已有本地副本。原图为 `/generated/users/ID_868181/images/1780890311109-e52c9ea3-bfd9-4e5e-8cfd-8201adc5df64.jpg`，缩略图为 `/generated/users/ID_868181/image-thumbnails/images/1780890311109-e52c9ea3-bfd9-4e5e-8cfd-8201adc5df64.jpg`。服务器验证两者 200，接口验证 `original` 返回原图、`thumb` 返回缩略图。
- 用户问 BytePlus 图片是不是每次都返回 0。线上/本地流水统计：不是。BytePlus 图片共 147 条，63 条为 0，84 条有费用。Seedream 4.5 有费用样本是 `$0.04/张`，Seedream 5.0 有费用样本是 `$0.035/张`。用户决定先按这个固定费用扣，后续再按新流水里的分辨率和尺寸核算。
- 已改 `src/lib/openrouter.ts`：BytePlus 图片如果响应 `usage.usd/cost > 0` 就用响应值；如果缺失或为 0，Seedream 4.5 按 `$0.04/张`，Seedream 5.0 按 `$0.035/张`。已改 `src/app/api/image/route.ts`：新流水 metadata 写 `settings / ratio / resolution / size / sizes`，后面可以按 2K/4K 重新算。
- 已改后台扣分文案：`0（未返回成本）` 表示有流水但成本为 0；`0（扣分异常）` 表示完全找不到流水；`0（扣分关闭）` 表示后台扣费关闭；应扣/实扣仍保留。相关字段在 `AdminCreditFlowItem`：`expectedCredits / isCreditMissing / isCostUnavailable`。
- 本轮多次按用户要求直接部署线上，使用马来 `/usr/local/bin/deploy-flashmuse-production.sh`，线上 build 通过，PM2 online，阿里 `_next/static` 同步并清缓存。没有提交/推送 GitHub。
- 用户临时改变规则：火山素材审核功能必须在公网测，相关修复本轮允许直接改完部署。线上火山审核入口已打开。后续若用户继续测试火山审核，可直接部署，但 GitHub 仍不要提交/推送，除非用户明确要求。
- 火山审核入口不是所有图片都显示。最终规则是按当前分类：`角色图片`、`分镜图片`、`上传图片` 显示；`场景图片` 和其它分类不显示。用户强调“上传图如果移动到场景图片分类里，就不显示”。
- 自动识别真人不能做到 100%，所以本轮没有做真人自动检测。当前方案是用户在可能有真人的分类中手动提交审核。
- 角色22 的线上审核状态已确认通过，`asset-20260609180613-qc9g5`。B_31 是没用 asset ID；已在服务端视频接口兜底替换 `asset://`。如果以后用户说“审核通过还真人拦截”，先看 `/root/.pm2/logs/flashmuse-out.log` 是否有 `BytePlus asset references applied` 和 `assetReferenceCount: 1`。
- B_33 这类 `output video may be related to copyright restrictions` 是输出版权风控，不是素材审核失败。用户要求错误红字显示模型真实原因，不要显示“平台服务临时异常”，也不要加不是模型给出的建议句。当前文案：`输出视频可能涉及版权限制，平台拒绝生成。`
- 对 `@角色22 跑步的视频` 这类输入，模型真实 prompt 会清洗成 `参考图中的主体 跑步的视频`，避免资产名进入火山提示词。
- 阿里工作台不稳定导致退出的真实原因：定时 `/api/auth/me` 或 `/api/auth/workspace-instance` 一次失败就跳首页。已改为仅明确未登录/实例失效才跳；网络抖动不踢。
- 输入框 mention 体验已修：只有完整 `@图片名称` 蓝色；后续输入黑色；Backspace/Delete 一次删除整个 mention。若后续出现输入法/光标问题，看 `PlainMentionEditor`。
- 后台页面曾打不开，原因是 Server Component 里写 Cookie。已修 `getCurrentAdminEmail()` 只读 Cookie。以后不要在 Server Component 调 `cookies().set()`。
- 左下用户菜单新增 `后台管理`，只对白名单用户显示，点击新开后台页。实现依赖 `/api/auth/me` 的 `isAdmin` 字段。
- 后台用户管理最近登录 IP 已做。`12424740@qq.com` 当前有 `60.177.136.74 / 浙江 杭州`。如果用户看不到，多半是前端旧包或缓存；确认构建里无 `待接入`，阿里 `_next/static` 已同步。
- 后台表格本轮做了视觉统一：用户管理积分列左移，积分管理用户加头像，积分管理和生成记录后续列左对齐。
- 线上部署坑：`.env.local` 有两条 `DATABASE_URL`，第 1 条可用、第 2 条不可用。Prisma 迁移别直接 source，应用 Node 脚本读取第 1 条。曾误 scp 多 route 文件到父目录生成 `/api/auth` `/api/admin` 多余路由，已删除。

## 2026-06-09 重要工作规则

- 用户明确要求：以后再做任务，默认只在本地完成代码修改和验证，不要直接部署服务器，不要直接提交或推送 GitHub。
- 只有用户明确要求“部署 / 上线 / 提交 / 推送”时，才允许操作线上服务器或 GitHub。
- 后续 AI 做完本地改动后，应先汇报改动和验证结果，等待用户决定下一步。

## 2026-06-09 火山一方素材库审核调试记录

- 用户纠正：要做的不是 BytePlus `Add real-human assets` 真人扫码授权，而是交接文档里说的素材库审核 / 一方 `CreateAsset` 入库流程。
- 已从官方 `https://docs.byteplus.com/en/docs/ModelArk/1520757` 页面 HTML 的 `window._ROUTER_DATA` 里找到隐藏文档：`CreateAssetGroup`、`CreateAsset`、`ListAssets`、`GetAsset`。`CreateAsset` URL 是 `https://ark.ap-southeast-1.byteplusapi.com/?Action=CreateAsset&Version=2024-01-01`，只支持 AK/SK。
- 关键流程：若没有素材组，先 `CreateAssetGroup` 创建 `GroupType=AIGC`；再 `CreateAsset` 提交图片 URL；再 `GetAsset` 轮询；状态 `Active` 后，Seedance 2.0 视频生成的参考图传 `asset://Asset-...`。
- 本地代码已实现一方 API：`src/lib/byteplus-assets.ts`、`src/app/api/byteplus-assets/route.ts`。前端资产预览已加入“火山素材审核”卡片和状态字段；`Active` 后 BytePlus 视频请求会自动用 `asset://`。
- 用户随后要求线上先隐藏这个入口，本地继续做。线上通过 `NEXT_PUBLIC_ENABLE_BYTEPLUS_ASSET_REVIEW=false` 隐藏；本地默认显示。后续不要直接部署，除非用户明确要求。
- 本地登录“请求失败”已排查并修复：本地数据库缺工作台实例锁迁移字段，已执行 `npx prisma migrate deploy`。
- 本地 `.env.local` 已加入素材库 `BYTEPLUS_ACCESS_KEY / BYTEPLUS_SECRET_KEY`。密钥来自外部 `E:\project\【1】Api key\Byteplus\Byteplus api key.md`，不要输出、不要写入文档、不要提交。
- 当前最后状态：用户本地点击“提交审核”仍看到 `请求失败，请稍后再试。`。已在本地 `/api/byteplus-assets` catch 里加 `console.error("[byteplus-assets] create failed", error)`。下一步应让用户再点一次，然后读取 `start-project.log` 查真实错误；先不要部署。

## 2026-06-08 本轮关键交接

### 2026-06-09 本轮追加：用量显示、应扣积分和工作台单实例

- 用户反馈：很多对话流右上角使用量里，积分和人民币对不起来。排查结论：真实扣费大多没错，显示口径有问题。右上角以前读 workspace `session.usageSummary`，人民币还写死用 `7.2` 汇率；真实扣费按后台 `CreditSetting` 和 `CreditLedger`。部分历史会话的 `usageSummary` 还比真实流水少，说明旧 workspace 汇总曾漏记或被旧状态覆盖。
- 已统一口径：真实积分以 `CreditLedger` 为准。`/api/workspace-state` 现在 GET/PUT 都会用真实流水重算每个会话 `usageSummary`。前台右上角显示的积分、美元、人民币都是“实际扣分口径”，人民币不再由前端固定汇率换算。
- 已补应扣积分：`chargeCredits()` 写 `expectedCredits / chargedCredits / chargedCny / chargedUsd` 到流水 metadata。用户余额不足时，真实只扣余额；前台只显示实际扣分，后台行内显示 `-实际扣分 / 应扣xxx`。旧流水没有 metadata 时，后台用 `cny * creditsPerCny` 反推应扣。
- 用户进一步确认：同一个账号不能同时操作多个工作台，即使同一台电脑多标签也不行，否则会互相覆盖输入和 workspace。单 session 只能限制不同登录态；同一浏览器多个标签共享同一个最新 Cookie，因此还需要工作台页面实例锁。
- 已新增工作台单实例锁：`Session` 表新增 `activeWorkspaceInstanceId / activeWorkspaceSeenAt`；新增接口 `/api/auth/workspace-instance`。工作台页面打开后声明自己是唯一有效实例，旧工作台最多 2 秒检测到不是当前实例并回首页。回首页不等于退出登录，首页仍显示登录状态；再次进入工作台会抢占唯一实例。
- 线上部署已完成：迁移 `20260609000000_session_workspace_instance` 已应用，`npx prisma generate`、`npm run build` 通过，PM2 已重启，阿里 `/_next/static` 已同步并清缓存。健康检查：`https://main.venusface.com/` 200，`https://api.venusface.com/api/model-availability` 200。
- 重要部署经验：线上 `.env.local` 不是 shell 可 source 格式，`DATABASE_URL` 带双引号。Prisma CLI 需要用 Node/dotenv 或手动剥离引号注入 `DATABASE_URL`。本轮还发现数据库用户密码与 `.env.local` 不一致，已重置为 `.env.local` 的值；不要暴露密码。

### 本轮追加：Logo 切换、上传图提示词、缩略图回退

- 首页和工作台 Logo 都已支持马来/阿里互切。马来入口显示 `Intl.`，阿里入口不显示；首页跳首页，工作台跳工作台。马来工作台点 Logo 到 `https://ali.venusface.com/workspace`，阿里工作台点 Logo 到 `https://main.venusface.com/workspace`。
- 工作台切换后看似退出账号的问题不是同账号单会话，是 Cookie 子域不共享。已设置 `AUTH_COOKIE_DOMAIN=.venusface.com`，前台/后台 Cookie 都带 Domain，`/api/auth/me` 会补写新域 Cookie。切换入口不会触发新登录，也不会触发单会话踢下线。
- 工作台左侧副标题统一为 `AI视频助手`，修复切换瞬间从 `AI视频助手` 闪成 `AI影片助手` 的问题。
- 对话流上传图现在永远无提示词。用户在任何模式下输入的文字都不能写入上传图 `sourcePrompt`。上传图固定 `sourcePrompt: "资产库上传"`、`promptSource: "upload"`；反推成功后才写 `promptSource: "reverse"` 和真正提示词；生成图写 `promptSource: "generated"`。预览上传图默认显示 `反推提示词` 按钮。
- 后台生成/媒体记录也已同步规则：上传图 URL 匹配 `/generated/(users/{id}/)?upload_image/` 时，不再用用户输入或 generation originalPrompt 兜底当 prompt，避免后台误显示上传图提示词。
- 马来入口资产库缩略图缺失已修：马来走 `/api/media-thumbnail?url=...` 生成/兜底，阿里入口继续走静态 `image-thumbnails`。如果用户说“马来资产库很多缩略图裂了”，优先确认当前前端包是否包含 `getMediaThumbnailUrl()` 的马来 API 回退逻辑。

### 阿里 `_next/static` 自动同步脚本

- 已新增并部署 `scripts/sync-flashmuse-next-static.sh` 和 `scripts/deploy-flashmuse-production.sh`。线上脚本路径在马来 `/usr/local/bin/`。
- 以后线上改前端，优先在马来执行 `/usr/local/bin/deploy-flashmuse-production.sh`。它会自动 `npm run build`、`pm2 restart flashmuse --update-env`、`pm2 save`、同步 `.next/static/` 到阿里 `/var/www/flashmuse-static/_next/static/`，并清阿里 Nginx 缓存。
- 如果只需要补同步阿里静态，执行 `/usr/local/bin/sync-flashmuse-next-static.sh --clear-cache`；如果只想看会同步什么，执行 `/usr/local/bin/sync-flashmuse-next-static.sh --dry-run`。

### 正式域名、HTTPS 和 DNS-01 证书

- 本轮后续已把应用环境变量正式切到域名。马来 `.env.local` 关键项现在是：`NEXT_PUBLIC_UPLOAD_BASE_URL=https://api.venusface.com`、`NEXT_PUBLIC_STATIC_BASE_URL=https://static.venusface.com`、`NEXT_PUBLIC_PRIMARY_BASE_URL=https://main.venusface.com`、`UPLOAD_CORS_ORIGINS=https://main.venusface.com,https://ali.venusface.com,https://static.venusface.com`、`FORCE_INSECURE_AUTH_COOKIE=false`。已重新 build、重启 PM2、同步阿里 `_next/static`，并清阿里 Nginx 缓存。
- 为保证马来主站原则，`chat-workbench.tsx` 已补 `NEXT_PUBLIC_PRIMARY_BASE_URL` 判断：访问 `main.venusface.com` 或 `api.venusface.com` 时不强制把 `/generated` 转阿里静态；访问 `ali.venusface.com` 时才走 `https://static.venusface.com`。`toLocalGeneratedUrl()` 也已兼容 4 个正式域名的 generated 绝对 URL。
- 用户提供正式 DNS：`main.venusface.com`、`api.venusface.com` 指向马来 `101.47.19.109`；`ali.venusface.com`、`static.venusface.com` 指向阿里 `101.37.129.164`。
- 马来 `main/api` 已用 certbot 成功配置 HTTPS，证书在 `/etc/letsencrypt/live/main.venusface.com/`，`https://main.venusface.com/` 与 `https://api.venusface.com/api/model-availability` 已返回 200。certbot 改配置后曾让旧 IP HTTP 404，已新增 `flashmuse-ip.conf` 并让 FlashMuse IP 站点成为 80 默认站，恢复 `http://101.47.19.109/`，避免阿里回源坏掉。
- 阿里 `ali/static` 的 HTTP-01 证书验证被公网 `Server: Beaver` 403 拦截，和 dvideo 当前 HTTP 表现类似；因此改用 DNS-01 手动 TXT 验证。用户添加过两条 TXT：`_acme-challenge.ali` 和 `_acme-challenge.static`，签发成功后可删除。证书名 `flashmuse-ali-static`，路径 `/etc/letsencrypt/live/flashmuse-ali-static/`，有效期到 `2026-09-06`。
- 阿里 Nginx 已给 `ali/static` 配 443，服务器本机测试 `https://ali.venusface.com/`、`https://static.venusface.com/flashmuse-cache-health`、`https://dvideo.venusface.com/` 均 200。本机外网直连阿里 443 会 reset，dvideo 也一样，后续以用户浏览器/国内网络实际打开为准。
- 后续提醒：`flashmuse-ali-static` 是手动 DNS-01 证书，不会自动续期。DNS API 自动续期以后再做，方案是创建阿里云 RAM 最小权限 AccessKey，只允许管理 `venusface.com` DNS；服务器安装 Aliyun DNS certbot 插件；凭据放 `/root/.secrets/certbot/aliyun.ini` 且 `chmod 600`；用 DNS 插件重签并 `certbot renew --dry-run`。不要把 AccessKey 发到聊天、写入文档或提交 Git。

### 架构原则：马来主站，阿里副站

- 用户最终确认：马来服务器是主站，阿里只是国内加速副站。以后所有方案先保证马来正确、稳定、速度快，再保证阿里同步和国内访问速度。马来直连不能因为阿里未同步而卡住。
- 阿里存在的目的：国内用户访问快、静态资源本地读取、入口反代。阿里不是主数据源，不能让马来主站依赖阿里状态才能正常显示。
- 域名建议：主域名或 `app.xxx.com` 指向阿里 `101.37.129.164`，`static.xxx.com` 指向阿里，`api.xxx.com` 指向马来 `101.47.19.109`。简单版可以主域名指阿里、`api` 指马来。`.cn` 可用，不必须 `.com`；主站解析到大陆阿里通常需要 ICP 备案。
- `http://101.47.19.109/admin?tab=records` 是直连马来后台；`http://101.37.129.164/admin` 是阿里入口反代后台。

### 媒体保存和同步新规则

- 图片远程 URL 流程：供应商临时 URL 先显示 -> 马来下载 -> 保存为 JPG -> 马来生成 256px JPG 缩略图 -> 马来主动 rsync 原图和缩略图到阿里 -> `/api/media-save-status` 返回 `localUrl / thumbnailUrl / aliSynced / aliSyncError` -> 阿里入口等同步确认和预加载成功后替换。马来直连优先用马来 `/generated`，不等阿里。
- 视频远程 URL 流程：供应商临时 URL 先显示 -> 马来下载视频 -> 马来抽 640px 封面 -> 马来生成封面 256px 缩略图 -> 马来主动同步视频、封面、封面缩略图到阿里 -> 状态接口返回 `localUrl / posterUrl / posterThumbnailUrl / aliSynced`。
- GPT-5.4 Image 2、Gemini 等可能返回 `data/base64` inline 图片，不走远程临时 URL 队列。此前保存 JPG 后直接返回，缺缩略图和主动同步阿里；本轮已补为保存 JPG 后生成缩略图并主动同步阿里。
- 新增 `src/lib/ali-sync.ts`。马来已生成 `/root/.ssh/flashmuse_to_ali_ed25519`，阿里已加公钥。马来 `.env.local` 已设置 `ALI_SYNC_GENERATED_ENABLED=true`、`ALI_SYNC_HOST=101.37.129.164`、`ALI_SYNC_DEST_ROOT=/var/www/flashmuse-static/generated`。
- 阿里原每分钟 `/generated` cron 保留，但只是兜底。实时链路以后依赖马来主动推送。

### 本轮问题修复

- 资产库上传线上卡 `6%`：`6%` 是选择图片后初始进度，真实上传启动曾依赖同一回调内临时任务数组和线上旧 JS，导致 XHR 没启动。已改为槽位保存 `uploadFile`，effect 自动扫描 `uploading + uploadFile` 并启动上传；上传阶段会显示 `8% / 12% / 15%+`，并加 token 20 秒超时、XHR 10 分钟超时。
- 专业图片/视频模式提示词参考图显示：如果用户文本里写了 `@文件名`，小图和 `@文件名` 在原文位置显示；如果没有 `@`，本次参考图小图显示在提示词最前面；同一图不重复。小图和悬停预览直接用原图静态地址，避免小缩略图裂图。
- 马来预览页下载按钮变跳转：原因是下载链接被转成阿里跨域静态地址，浏览器忽略 `download`。已改为同源 `/generated/...` 下载，马来从马来下载，阿里从阿里下载。
- Gemini/GPT 图片缩略图一直加载：原因是前端只读静态缩略图，旧图或缺缩略图会 404。已加 `onError` 回退原图，且主链路已改为马来保存时就生成缩略图。
- 部署时注意：改前端后必须马来 `npm run build`、`pm2 restart flashmuse --update-env`、`pm2 save`，再同步阿里 `/_next/static`。本轮因阿里拉马来 rsync 曾卡住，改用马来主动推送 `_next/static` 到阿里也验证可行。

## 2026-06-05 本轮关键交接

### 本轮追加：服务器部署、HTTP 登录修复和工作台运行修复

- 用户提供服务器资料目录 `E:\project\【2】server\马来西亚服务器`，其中 `马来服务器.txt` 记录 IP `101.47.19.109`，`ByteplusVPS.pem` 为 SSH 私钥。本轮已修复本机私钥权限并用 `root` 登录服务器。
- 服务器是 `CentOS Stream 8`，最初没有 Node/npm/Git/Nginx/PM2。已安装 Node.js 22、Git、Nginx、PostgreSQL、PM2；创建 PostgreSQL 库和用户；项目部署到 `/var/www/flashmuse`；PM2 进程名 `flashmuse`；Nginx 反代到 `3000`。
- 因上传速度慢，线上没有上传 1.7GB 的 `public/generated` 和 123MB 的完整首页视频。`/generated/` 目录在服务器上新建并由 Nginx 公开映射；`/home-assets/` 只补了 Logo、manifest 和极小占位视频。后续如要完整首页效果，需要补传 `public/home-assets` 下原视频。
- 线上 `http://101.47.19.109/generated/deploy-check.txt` 已验证可访问，但当前只是 HTTP。BytePlus 素材审核必须等域名和 HTTPS 完成后继续。
- 线上验证码最初收不到邮件，根因是部署时只传了 `.env.local`，但 SMTP 配置在本地 `.env`。已把 `.env` 中 SMTP、`AUTH_SECRET`、`ADMIN_EMAILS` 等合并到线上 `.env.local`，同时保留线上数据库连接。
- 前台验证码登录后无法进入工作台，最终通过临时 `/api/client-error` 采集确认真实错误为 `crypto.randomUUID is not a function`。原因是当前用 HTTP IP 访问，不是安全上下文，浏览器不提供 `crypto.randomUUID()`。已新增 `createClientId()` fallback 并替换工作台所有前端 UUID 调用。
- 前台和后台登录 Cookie 在生产环境默认 `secure: true`，HTTP 下浏览器不会保存。已新增/使用 `FORCE_INSECURE_AUTH_COOKIE=true` 作为临时测试开关，让 `auth.ts` 和 `admin-auth.ts` 在 HTTP 测试时不写 `Secure`。后续 HTTPS 配好后必须关闭。
- 为避免 Next RSC 软跳转状态问题，首页进入工作台和登录成功后改为 `window.location.assign('/workspace?fresh=...')`；Nginx 临时对 `/_next/static/` 加 `Cache-Control: no-store`。
- 线上后台账号确认：后台管理员白名单 `ADMIN_EMAILS=lookxun@163.com`，后台没有独立账号表。用户表当前已有 `lookxun@163.com` 和 `12424740@qq.com`。

### 本轮追加：对话流、资产库和模型问题修复

- 用户反馈 Agent 模式点击引导按钮并发送引导语句后，旧引导没有消失。根因是前端找“最后一条 assistant 消息”来显示引导，用户消息发送后旧 assistant 仍被命中。已改为只有“最后一条消息本身是 assistant”才显示引导，并且发送任意消息时会清空旧消息 `suggestions`。
- 视频生成模式时长菜单曾对所有模型都两列显示。已改为只有 BytePlus `Seedance 2.0 Fast / Seedance 2.0` 因支持 `4-15秒` 多选项才两列，其它视频模型恢复一列。
- 资产库空状态文案已按分类改：`上传图片` 为 `在对话流上传的图片会出现在这里。`；`生成图片` 为 `对话流生成的图片会出现在这里。`；`生成视频` 为 `对话流生成的视频会出现在这里。`；`回收站` 为 `删除的资产会出现在这里。`。
- 用户问 `B_8` 为什么生不出来图。日志显示模型为 `google/gemini-3-pro-image-preview`，响应没有图片，只返回大段中文场景描述文本；同类还有 `B_5/B_6/B_7`。结论：这是 Gemini 图片模型在 OpenRouter 链路下退成文本输出，不是服务器或保存失败。建议先用 `Seedream 4.5 / Seedream 5.0 Lite`，或后台关闭 Gemini 图片模型。

### 本轮追加：验证和遗留

- 本轮多次本地 `npm run build` 通过；服务器多次 `npm run build` 通过；PM2 每次重建后已 `pm2 restart flashmuse --update-env` 和 `pm2 save`。
- 当前线上还带临时 `/api/client-error` 和 layout 中前端错误上报，用于继续排查 HTTP 测试期问题。正式生产前可评估保留为简易日志或移除。
- 当前线上仍缺 HTTPS，下一步必须绑定域名、签证书、恢复 Secure Cookie，并将 BytePlus 素材审核所需的 `/generated/...` URL 切成 HTTPS。

### 下一个 AI 首要任务：公网部署 + BytePlus 素材审核

- 用户本轮最后明确要求：把本对话框内所有做的内容写入交接文档和更新日志，重点提醒下一个 AI 接手后开始做公网部署。
- 公网部署不是普通展示上线，而是 BytePlus `素材&虚拟人像库` 审核机制的前置条件。BytePlus 素材创建需要 `originalUrl` 为公网可访问图片 URL，本地 `localhost`、本地 `/generated/...` 或只能浏览器访问的路径都不行。
- 部署完成后要保证服务器上的 `/generated/...`、用户上传图、资产图和生成图都能通过公网 HTTPS URL 访问。若 BytePlus 要求 IP 白名单，需要提交服务器公网出口 IP。
- 部署后继续接 BytePlus 第一方 `素材&虚拟人像库 / CreateAsset` 审核机制。目标流程：图片保存到公网 HTTPS URL -> 调 BytePlus 第一方素材创建/审核接口 -> 轮询状态 -> 审核通过后保存 `assetId/materialId` -> Seedance 2.0 视频生成时传 `asset://assetId` 作为参考图。
- 这个流程用于 AI 生成的写实真人/数字人角色图。现在直接把写实真人/真人脸参考图以普通 URL/base64 传给 Seedance 2.0，容易触发 `InputImageSensitiveContentDetected.PrivacyInformation`。不要尝试绕过安全策略，正确做法是官方素材/虚拟人像库审核。
- 第三方 SeeDance 素材文档仍只作为机制证明。用户明确不接第三方，只接 BytePlus 第一方。下一个 AI 要从 BytePlus 控制台、客服或销售拿第一方 `CreateAsset / 查询素材状态` 文档和开通方式。

### 本轮前台资产库和引用资产调整

- 前台资产库左侧 `对话流资产` 新增 `上传图片` 分类，只显示用户上传到 `/generated/upload_image/...` 的图片。`生成图片` 只显示对话流生成图，排除上传图；`生成视频` 显示对话流视频。
- 上传图片图标使用用户给的 SVG：`M24 19H21V23H19V19H16L20 15L24 19...`。此前尝试直接用 `RiImageUploadLine` 会导致项目打不开，因为当前 `react-icons/ri` 没有这个导出。
- `@引用资产` 弹窗去掉旧 `对话流图片` 分类，新增 `上传图片` 分类，只展示上传图。角色图片、场景图片、分镜图片保留。
- 资产库右侧切左侧分类时，现在直接滚到顶部，不再恢复该分类之前的滚动位置。此前记住每个分类滚动位置会导致切页后右侧内容自动定位到不同高度。
- 资产库右侧标题区已固定高度，减少不同分类标题/说明高度导致内容上下跳动。右侧主内容保持居中。生成视频保持大屏一行 4 个，网格总宽与其它分类一致。

### 本轮模型开关链路修复

- 用户反馈后台模型明明全开，但普通 Agent 仍提示 `连接不到模型，请联系管理员！`。根因是普通 Agent 自动生图固定拿 OpenRouter `DEFAULT_IMAGE_MODEL`，而后台可能已把同名 Seedream 4.5 互斥切到 BytePlus，服务端就把旧 OpenRouter 模型拦了。
- 现在后台模型可用性按入口拆成五组：`imageModels / assetImageModels / videoModels / agentImageModels / agentVideoModels`。
- 前端使用规则：图片生成模式读 `imageModels`；资产库生成读 `assetImageModels`；视频生成模式读 `videoModels`；Agent 自动生图读 `agentImageModels`；Agent 自动生视频读 `agentVideoModels`。
- 前端在专业图片/视频发送前、Agent 自动生成执行前都会重新拉 `/api/model-availability`，避免后台刚改开关时前端还拿旧模型列表。
- 服务端最终校验也分入口：`/api/image` 根据 `metadata.creditSource` 识别 `agent_image_generation`、资产库生成或普通对话流图片；`/api/video` 根据 `agent_video_generation` 识别 Agent 自动视频。BytePlus provider key 分别走 `agent-image.* / agent-video.* / conversation-image.* / asset-image.* / video.*`。
- 后续上线前继续注意：后台开关一定不能只控制前端显示，服务端也必须按入口最终校验，避免用户绕前端直接调接口。

### 本轮后台修复

- 后台历史对话弹窗的时间排序已修。以前用 `session.updatedAt`，会被 workspace 整体保存、同步、恢复污染，导致很多实际没在 6月5日 变动的对话显示为 6月5日。现在按该对话内最后一条消息 `createdAt` 排序和显示；无消息时才回退 `session.createdAt / session.updatedAt`。
- 后台 `对话流图片 / 对话流视频 / 资产库图片` 弹窗左侧主图不再用缩略图，改用原图；右侧列表仍用缩略图。文件名不再叠在主图左上角，改到参数行最前面。
- 参数行样式规则：文件名黑色，和后面参数同一行但不是同一类信息；文件名和参数之间不用竖线；后续参数之间继续用竖线分隔。资产库图片参数最后显示风格。
- 后台入口文案按用户最终要求保持 `对话流图片 / 对话流视频 / 资产库图片`，不再单独增加 `对话流上传图片` 入口。上传图仍包含在 `对话流图片` 中。

### 本轮首页 UI 调整

- 首页简化输入框一开始尝试复用工作台输入框底框，后来用户要求改回深色玻璃风格，但去掉上下渐变和边框渐变。当前底色为纯平半透明深色，边框为普通纯色。
- 首页发送按钮先试过白色、透明，最终按用户要求与右上角 `进入工作台 / 登录` 的常态和 hover 一致：常态 `bg-white/10`，hover `bg-white/18`。
- 首页右上角 `进入工作台 / 登录` 按钮去掉描边，保留背景、hover、阴影和毛玻璃。

### 本轮验证

- 本轮多次 `npm run lint` 通过，仅剩 `src/components/chat-workbench.tsx` 原有两个 warning：未使用 eslint-disable 和 `showInputTip` dependency。
- 本轮多次 `npm run build` 通过，仅剩既有 Turbopack tracing warning。期间一次 build 因 Google Fonts 网络请求失败，重跑后通过，不是代码错误。

## 2026-06-03 本轮关键交接

## 2026-06-04 本轮关键交接

### 本轮继续：BytePlus 图片、视频错误编号、真人/数字人素材审核和公网部署后续

- 用户先要求测试 BytePlus 两个图片模型为什么一直连不上。直连 BytePlus API 已测通：`Seedream 4.5` 和 `Seedream 5.0 Lite` 都能成功返回图片。根因不是 Key/网络/模型，而是项目交付逻辑误判。
- BytePlus 图片失败根因：BytePlus 返回远程临时 URL，项目先返回远程 URL 给前端、后台异步下载落盘；刚返回时没有本地尺寸。`/api/image` 旧逻辑按目标尺寸精确过滤，尺寸为空时把成功图过滤为 `0` 张，触发 `image-generation empty delivery`。已修为没有匹配尺寸但有图时回退交付原图。
- 用户问 OpenRouter 为什么没问题。结论：OpenRouter 聚合层可能返回 `url/image_url.url/b64_json/data URL` 多种形式，项目都兼容；base64/data URL 会同步保存并读尺寸。BytePlus 当前基本返回远程 URL，所以更容易暴露“异步落盘前无尺寸”的问题。
- 用户发现视频失败红字没有 `B_数字`。已修两处：`/api/video` 轮询失败分支也生成编号；`toUserErrorMessage()` 对隐私/敏感/真人错误映射中文文案时保留已有 `(B_数字)`。用户复测确认红字编号已有。
- 视频失败文案 `参考图可能包含真人或隐私敏感信息，平台拒绝生成` 对应官方错误 `InputImageSensitiveContentDetected.PrivacyInformation`。直接把 AI 写实真人图或真实人脸图作为普通 URL/base64 传给 Seedance 2.0 很容易被拦。
- 用户坚持 BytePlus 应该有“AI 生真人/数字人图片审核后可用”的机制。查官方 API 参考后确认：视频生成 `content.image_url.url` 支持素材 ID，格式 `asset://<ASSET_ID>`，用于预置素材及虚拟人像；文档也写 `seedance 2.0` 系列不支持直接上传含真人人脸的参考图/视频，为肖像使用提供一系列解决方案。
- 用户提供第三方 SeeDance 接入说明目录 `E:\project\【1】Api key\三方提供：seedance 2.0\SeeDance接入说明`。其中 `AI聚合三方素材接口接入文档.pdf` 明确有素材创建和查询：`/openApi/material/create` 提交 `name/originalUrl/type/fileType/thirdChannel`，返回 `materialId=asset-xxxx` 和 `status=1`；`/openApi/material/pageList` 查询 `status=1 处理中 / 2 已完成 / 3 处理失败`。限制：图片 URL 可访问、格式 `jpeg/png/webp/bmp/tiff/gif/heic/heif`、宽高比 `(0.4,2.5)`、宽高 `300-6000px`、单张 `<30MB`。
- 第三方文档的错误示例暴露了 BytePlus 官方底层 `Action=CreateAsset`、`Service=ark`、`Region=cn-beijing`、错误码 `InvalidParameter.DownloadFailed`，证明第一方底层有素材审核/入库能力。用户明确：不接第三方，只接 BytePlus 第一方；第三方文档只用来证明流程。
- 关键后续：下一个 AI 应先做公网部署。原因是 BytePlus 素材审核接口需要 `originalUrl` 为公网可访问图片 URL，本地 `localhost` 或本地 `/generated/...` 不能被 BytePlus 下载。部署后图片应能通过 HTTPS 公开访问，如 BytePlus 需要白名单，要提交服务器公网出口 IP。
- 部署后继续接 BytePlus 第一方素材&虚拟人像库审核机制。目标流程：用户上传/生成角色图 -> 服务器保存并生成公网 HTTPS URL -> 调 BytePlus 第一方 `CreateAsset` 或控制台对应接口 -> 轮询状态到通过 -> 保存 `assetId/materialId` 到资产对象 -> 视频生成时如果资产有 BytePlus 审核通过 ID，传 `asset://assetId` 作为 `reference_image`，否则普通参考图仍按原规则传 URL/base64。
- 产品建议：前端资产库可给写实角色图增加 `提交 BytePlus 审核`、`审核中`、`审核通过`、`审核失败` 状态；视频生成遇到隐私/真人拦截时，提示用户先提交素材审核，审核通过后再生成视频。
- 不要尝试绕过 BytePlus 安全机制。关闭 Content Pre-filter 不能保证解决，官方仍保留基础安全策略。正确路径是官方素材/虚拟人像库审核后使用 `asset://...`。
- 本轮代码触及：`src/app/api/image/route.ts`、`src/app/api/video/route.ts`、`src/lib/error-message.ts`。本轮验证：`npm run lint` 通过，只剩原有两个 warning。

### 本轮继续：缩略图、固定槽位、资产命名和资产库状态恢复

- 最新视频在后台生成记录显示 `0（扣分异常）` 的问题已修。真实流水存在并扣了分，但流水绑定远程签名 URL，工作区后来替换成本地 URL，后台 URL 回填失败。现在后台用 `requestId` 匹配扣费，且流水明细优先用同 `requestId` 的本地 workspace URL，避免远程/本地 URL 不一致导致误显示异常。
- 后台媒体名称规则已统一为：没改名显示系统名；用户改名后显示 `系统名 / 用户改名`。前端仍只显示用户改名。对话流生成媒体的系统名来自 `mediaSystemNames`，资产库资产来自 `systemName`。
- 资产命名稳定规则已改：资产对象新增/使用 `userName`。`systemName` 是不可变系统名，`userName` 是用户改名，`name` 只是兼容显示字段并保持为 `userName || systemName`。用户改名只写 `userName`；系统同步、资产恢复、对话流扫描、资产生成系统名重排都不能覆盖 `userName`。旧数据如果已有 `systemName` 且 `name !== systemName`，会把旧 `name` 迁移识别为 `userName`。
- 对话流、预览缩略图、输入参考图、用户消息参考图、`@资产` 菜单、文本内联 `@资产` 小图、资产生成引用图、后台缩略图都改为加载 `/api/media-thumbnail`。主预览图、资产生成页左侧主图和后台悬停大图保留原图。缩略图最长边 512px，等比缩小，不裁切不拉伸。
- 对话流图片显示失败卡的假问题已连续修复。缩略图 `512x288` 曾被写进 `imageDimensions`，导致前端尺寸过滤把成功图误判成失败；现在缩略图尺寸不写回原图尺寸，`512` 尺寸不算可信真实尺寸，前端不再因为尺寸过滤合成失败卡。固定槽位只按真实 `image/pending/failed` 渲染，成功图不会被前端临时替换成失败卡。
- 图片生成固定槽位必须继续保持：请求几张就固定几个位置，每个位置永远有东西，不能空白。单张成功后其它未完成位置仍必须显示等待卡。此前尺寸分页只取成功图 slotIndexes，导致其它 pending 槽位消失，已改为直接渲染固定槽位数组。
- 等待卡百分比不再完全同步。`getVideoWaitProgress()` 支持按槽位 `index` 加稳定小偏移，同一批 1/2/3/4 的百分比会略有差别，但仍限制在合理区间，不超过 99%。
- 前台小图悬停原图预览已加。悬停浮层用 portal 挂到 `document.body`，不受输入框/菜单裁切；按浏览器边界判断左右上下位置，图片加载后用真实宽高比例重算浮层尺寸。内联 `@资产` 的 18px 图片和文字也做了上下居中对齐。
- 右上角使用量浮窗新增当前对话流成功图片数和视频数，位于 `Tk` 与积分之间。统计只看当前对话流 assistant 消息里的成功生成图片/视频 URL，去重；上传参考图不算。
- 资产库刷新位置已修：新增本地 UI 状态 `flashmuse-workspace-ui-state-v1`，立即保存 `activePanel / assetFilter / assetScrollTopByFilter`，刷新时优先恢复。点击一级资产库不再重置到角色图片；切资产标签会即时写本地状态；滚动位置恢复只在进入资产库或切换标签时执行，避免滚动条抖动。
- 点击资产库、切资产分类、点击资产卡预览时会关闭右侧文档预览面板，避免文档预览在资产库右侧残留。
- 本轮多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。build 仍有既有 tracing warning，不影响运行。

### 资产库性能和缩略图

- 用户反馈资产库每个分类加载图片都比较慢。本轮确认资产库卡片原来直接加载原图，切分类时会一次性请求大量大图；视频无封面时还会挂载 `<video preload="metadata">` 批量读取视频 metadata。
- 已新增 `/api/media-thumbnail`。本地 `/generated/...` 图片首次访问会生成 512px 缩略图，缓存到 `public/generated/image-thumbnails/...`。资产库图片卡统一改为走这个缩略图接口并 `loading="lazy"`。
- 资产库 `visibleAssets` 改用 `useMemo`，初始渲染数量从 30 调为 24，滚动到底继续追加。后续如果图片更多，建议继续做真正虚拟列表或在生成/上传阶段预生成缩略图。
- 资产库视频卡不再批量加载视频 metadata。有封面用封面；没有封面用轻量灰色占位。

### 视频封面和播放按钮

- 本轮用户确认：后续新视频应自动有封面，对话流和资产库都显示。当前新视频流程是远程 URL 先展示，后台落盘后用 `ffmpeg-static` 抽第一帧，写入 `posterUrl`，前端轮询后同步到对话流、资产库和预览缩略图。
- 已手动把本地所有旧视频补封面。`public/generated/videos` 下 22 个视频均已有同名 `/generated/video-posters/*.jpg`，本轮新建 20 个，原有 2 个，并补写 `video-manifest.json`。
- 资产库视频卡现在支持同名封面兜底：即使资产对象没有 `posterUrl`，也会从 `/generated/videos/xxx.mp4` 推导 `/generated/video-posters/xxx.jpg`。
- 对话流视频封面和资产库视频封面视觉已统一：中央显示 `play-large-fill` 播放按钮；左上角视频图标已按用户要求去掉。

### 预览页缩略图按钮

- 预览页右侧缩略图上下按钮曾在鼠标滚轮切图时一会出现一会消失。原因是最后一页缩略图数量少，当前页高度变化让 `previewThumbsNeedScroll` 误判不需要翻页。
- 已删除不稳定状态，按钮显示改为 `previewMediaOptions.length > previewThumbPageSize`；缩略图区域高度固定为一页容量，最后一页不再让按钮跳动。

### 后台删除规则

- 用户明确最终规则：用户删除对用户来说是删除；对后台来说只是一个用户操作，不是真删除。后台不能移除内容，不能用 `用户已删除` 覆盖原内容，只能在原结构上追加红色标识。
- 已修后台删除误判。不能再把“流水 URL 匹配不到当前媒体索引”当成删除；只有 workspace 明确 `trash/deletedAt` 或整条对话被删除，才显示 `用户已删除`。
- 后台媒体弹窗、历史对话弹窗、生成记录、积分明细都改成追加红色 `用户已删除`，原图片、视频、提示词、参数、扣费照常显示。
- 删除整条对话后，后台历史对话仍保留原标题并追加红字；删除算最后操作时间，按最新操作排前；能从流水恢复出的图片、视频和提示词继续展示。删除对话里的媒体也会补回 `对话流图片 / 对话流视频` 列表，并按 URL 去重。
- 删除不再等于失败。后台媒体 `status` 保持成功，只有真实生成失败才是 `failed`，避免删除导致生成数量和积分统计少算。

### 后台积分和生成记录

- 生成记录里的生成列表此前从 workspace 媒体直接转成记录，`credits` 固定为 0，导致很多生成图显示 `-0`。现在按媒体 URL 回填 `CreditLedger` 的真实扣分、美元、人民币、Token 和模型。
- 上传类继续显示 `--`；扣费关闭显示 `0（扣分关闭）`；确实找不到绑定流水的旧媒体显示 `0（扣分异常）`。这个异常多数是旧数据没有精确 URL 绑定，不代表新扣费链路异常。
- 以后后台记录要继续坚持：记录完整性以 workspace 真实媒体/资产/上传为准，扣费流水只作为附加显示；扣费异常不能导致记录消失。

### 错误编号和 BytePlus 无图

- 用户发现红字 `服务器繁忙，请稍候再试.....` 没有编号。原因是前端在“API 成功但 images 为空”时自己抛了通用错误，没有经过后端 `createCodedApiError()`。
- 已修：`/api/image` 如果最终没有可交付图片，会在服务端返回带 `B_数字` 的错误；`/api/video` 如果任务完成但无视频 URL，也返回带编号错误。
- 最新 BytePlus 失败排查结论：`byteplus:conversation-image.seedream-4-5` 请求有 timing 日志，但返回结果没有可交付图片，也没有真实原因。现在日志会显示 `[B_124] image-generation empty delivery` 这类编号，用户端显示 `(B_124) 服务器繁忙，请稍候再试.....`。

### 本轮验证

- 本轮多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning：未使用 eslint-disable 和 `showInputTip` dependency。
- 本轮多次 `npm run build` 通过，仅剩既有 `ffmpeg-static` Turbopack NFT tracing warning。

### 上传规则和后续上传功能做实

- 本轮用户先问当前上传图片/文件是否走 URL。结论：当前上传图片会先保存成本地 `/generated/upload_image/...` URL，但生成时服务端会把本地 `/generated/...` 读成 `data:image/...base64` 发给 OpenRouter/BytePlus；普通文档上传当前只是前端读取文本并拼进 prompt，不是模型真实 file 输入；模型返回的远程媒体才走“远程 URL 先展示，后台异步落盘”。
- 用户明确确认：以后不会接对象存储。后续正式方案应是“用户上传文件到服务器本地 -> 生成服务器上的可访问 URL -> 把服务器 URL 传给模型”。本地开发阶段继续使用原来的 base64 打包方案测试。
- 已新增 `src/lib/upload-rules.ts`，集中维护按 `mode + modelId + transportMode` 的上传规则。不要在其它地方再手写一套上传限制。规则当前支持 `local-base64` 和 `server-url` 两种传输模式。
- 对话流上传、粘贴图片、拖拽文件、`@资产` 引用、资产库“使用资产”、历史消息缩略图再次引用、资产库角色/场景/分镜生成页 `@引用资产` 都已接入当前模型规则。上传图片和 `@资产` 都计入同一个参考图数量上限；例如当前模型最多 3 张，用户上传 2 张再 @ 1 张可以，再上传或 @ 第 4 张会提示 `当前模型最多支持 3 张参考图，不能上传更多图片`。
- 对话流发送前和资产生成发送前都有兜底：如果用户手动输入多个 `@资产名` 导致引用图数量超过当前模型上限，会阻止发送并提示，不再静默截断。
- 后端 `/api/image` 和 `/api/video` 已加参考图数量兜底校验。`/api/image` 会按 `metadata.creditSource` 判断是对话流图片还是资产库图片；`/api/video` 用视频规则。
- 当前上传规则摘要：Agent 模式图片最多 5 张、文档最多 5 个；OpenRouter 图片模型最多 3 张；OpenRouter Seedance 视频最多 3 张；OpenRouter Kling/Veo 最多 2 张；BytePlus 图片本地 base64 先限制 6 张，服务器 URL 模式可放到官方 14 张；BytePlus 视频模型图片最多 9 张，视频/音频规则记录了官方限制但当前未真正传给模型。
- 后台 `系统设置` 底部新增 `上传规则` 表格。表格直接读取 `upload-rules.ts` 展示真实规则，列为 `使用场景 / 模型范围 / 图片 / 文件 / 视频 / 音频`；说明文案在“使用场景”下方灰字；长格式自动换行；总宽控制在 `1180px` 内。
- 后台表格里未做实能力已红字标注：GPT 文件输入未做实（当前文档只是读文本拼 prompt）；BytePlus 特殊图片格式 `heic/heif/tiff/bmp/gif` 浏览器预览链路未完整做实；服务器 URL 传模型链路未做实；BytePlus 参考视频上传未做实；BytePlus 参考音频上传未做实。
- 重要：下一个 AI 要继续做上传功能做实。优先接：服务器 URL 传模型、`referenceVideos/referenceAudios` 前后端状态和持久化、BytePlus Seedance 2.0 视频/音频真实参考输入、特殊图片格式处理、OpenRouter GPT-5.4 Image 2 真实 file 输入能力。
- 本轮验证：`npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过，仅剩既有 `ffmpeg-static` Turbopack tracing warning。

### 主题入口临时禁用

- 用户决定深色模式以后再调整，要求“代码都保留，只是灰色禁用掉不弹出二级菜单”。已把用户菜单里的主题入口改成灰色禁用态，点击不切换，鼠标移入不再打开二级菜单。
- 主题功能本身没有删除：`flashmuse-workspace-theme-v1`、主题状态、二级菜单 JSX、深色模式 CSS token 都保留。后续恢复入口时只需要重新启用按钮和 hover/click 打开逻辑。

### 媒体性能和视频封面

- 用户反馈：每次重新点开同一个对话流，里面的图片和视频都会重新加载；如果对话流里媒体多，会很卡。原因确认：当前只渲染当前对话，切换对话会卸载旧对话 DOM，再切回来会重新挂载图片/视频；图片原来 `loading="eager" + fetchPriority="high"`，视频和缩略图 `preload="metadata"` 会抢资源。
- 已做第一轮性能优化：图片卡改为懒加载；对话流图片/视频区域用 `LazyMediaMount`，滚动到视口附近才挂载；不要把所有对话 DOM 缓存在页面里，因为会更吃内存。
- 视频封面规则最终确认：远程 URL 阶段保持旧体验，仍直接显示视频、悬停播放、点击预览；后台异步落盘成功后再用本地视频抽第一帧封面。封面保存到 `/generated/video-posters/...jpg`。之后对话流、资产库和预览页缩略图优先用封面，用户体验应尽量无感。
- 新增 `src/lib/video-poster.ts`，依赖 `ffmpeg-static`。`src/lib/media-save-queue.ts` 会在视频保存成功后调用抽帧，并把 `posterUrl` 写入 `.runtime/media-save-jobs.json` job 和 `public/generated/videos/manifest.json`。`/api/media-save-status` 已返回 `posterUrl`。
- 前端新增 `Message.videoPosters` 和 `AssetItem.posterUrl`。保存状态轮询成功后，前端会把远程 URL 替换为本地 URL，同时把 `posterUrl` 写回消息、资产和预览列表。旧本地视频有同名封面兜底：`/generated/videos/xxx.mp4` 会尝试用 `/generated/video-posters/xxx.jpg`。
- 已手动对 d28 两个视频抽帧测试成功：`video_1_d28` 对应 `/generated/videos/1780404101729-1970df97-a38f-44bd-9094-82da87ba04a2.mp4`，封面 `/generated/video-posters/1780404101729-1970df97-a38f-44bd-9094-82da87ba04a2.jpg`；`video_2_d28` 对应 `/generated/videos/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.mp4`，封面 `/generated/video-posters/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.jpg`。
- 注意：`ffmpeg-static` 能正常加载，但 build 会出现 Turbopack `Encountered unexpected file in NFT list` warning，当前非阻断。后续如果部署严格要求零 warning，需要再研究 Next 16/Turbopack 对 `ffmpeg-static` 的打包策略。

### 深色模式和主题菜单

- 用户要求在前台用户菜单里加主题二级菜单，样式类似截图。已新增 `浅色模式 / 深色模式 / 跟随系统`，配置保存到 `localStorage` key `flashmuse-workspace-theme-v1`。点击主题后会同时关闭一级用户菜单和二级主题菜单。跟随系统监听 `prefers-color-scheme: dark`。
- 深色模式颜色已改为 token 方案，不要继续散落写硬编码。核心变量在 `src/app/globals.css`：`--fm-bg #0f1014`、`--fm-sidebar #151820`、`--fm-panel #1a1d25`、`--fm-control #20242d`、`--fm-hover #272c37`、`--fm-selected #303642`、`--fm-border-subtle #262b35`、`--fm-border #343b48`、`--fm-border-strong #465063`、`--fm-text #f4f6fb`、`--fm-text-muted #a8b0bf`、`--fm-text-subtle #7d8798`、`--fm-brand #367cee`、`--fm-brand-hover #4b8cff`。
- 深色模式已修：左侧未选中按钮透明、选中项才有底；顶部文字 logo 反白；用户菜单二级菜单向右展开，主菜单和二级菜单自身高层级，但左侧栏整体不能高层级，否则会盖住生成页/预览页。
- 对话流媒体卡规则：图片/视频成功卡和失败卡都应有同一个底色，变量为 `--flashmuse-media-surface`，深色下走 `--fm-control`。不要让成功卡透明，也不要给失败卡单独更亮底。资产库外部失败卡也要走同一变量。
- 反馈按钮规则：对话流回复下方的复制/重生/赞踩/更多按钮常态透明，鼠标触碰才显示底色；后面的 `感谢反馈 时间` 文案要更淡。
- 预览页规则：左侧舞台和工具按钮保持浅色模式视觉；右侧信息栏是较浅黑 `#2a303c`；预览页缩略图边框颜色恢复浅色模式：普通 `#d8d8d8`，hover `#bdbdbd`，选中 `#367cee`。缩略图中间容器已改为按当前页缩略图数量自适应高度，底部翻页按钮和最后一张缩略图距离与顶部一致。
- 资产生成页规则：左侧舞台保持浅色毛玻璃视觉；右侧栏和预览页一致 `#2a303c`；右侧输入框深色下用 `--fm-panel` 混合底和 `--fm-border`；生成图片按钮浅色模式不变，深色模式可用态纯 `--fm-brand` 蓝，禁用态淡蓝 `#1f3454 / #6f9fe8`。中间空状态颜色按浅色模式中性灰 `#9a9a9a`。
- 本轮深色模式多次踩坑：过宽的 `[class*="bg-[#..."]` 会误伤 `hover:bg...` 和成功/失败卡；后续新增样式优先加专用 class，如 `flashmuse-feedback-button`、`flashmuse-success-media-card`、`flashmuse-failed-media-card`、`flashmuse-preview-thumb`，不要靠全局猜。

### 远程媒体先展示后落盘

- 用户提出新流程：如果图片/视频供应商返回远程 URL，前端应先展示远程 URL，服务端后台再下载落盘；下载成功后替换成本地 URL；失败则重试直到成功或远程 URL 过期。只排除 base64，base64 继续原同步保存流程。
- 已按该方案实现通用队列。新增 `src/lib/media-save-queue.ts` 和 `src/app/api/media-save-status/route.ts`。所有远程 URL 媒体都先展示后异步下载，不限 OpenRouter / BytePlus，不限图片 / 视频，不限模型。队列按 URL 去重，状态落 `.runtime/media-save-jobs.json`。
- 前端 `chat-workbench.tsx` 会收集当前工作区中的远程图片/视频 URL，调用 `/api/media-save-status`，保存成功后替换对话流消息、`imageResultSlots`、提示词映射、系统名映射、资产库、资产生成任务里的 URL。保存队列返回图片尺寸时同步补 `imageDimensions`。
- 重要：`.runtime/media-save-jobs.json` 是本地运行状态，不提交 Git。正式上线如果多实例部署，应把这个队列迁移到数据库或任务队列，否则多进程之间不共享状态。

### 日志和排查规则

- 后续查“每张图片/每段视频生成时间和下载时间”，优先看 `requestId`。图片接口开始日志为 `[image-generation] api request start`；模型耗时为 `[image-generation] OpenRouter timing / BytePlus timing`；下载队列为 `[media-save] queued remote asset / downloading remote asset / saved remote asset / remote asset save failed`；视频完成为 `[video-generation] ... completed`。
- 日志里必须保留完整可排查信息：`requestId / model / providerMs / saveQueueMs / queuedMs / downloadMs / attempts / localUrl / dimensions / host / pathTail`。不要打印完整远程签名 URL。用户端不显示供应商名，但后端日志可以保留原始错误和供应商信息。
- `video_2_d28` 曾因旧逻辑重复下载出两个相同 mp4，已删除孤儿副本。队列已加固：`downloading` 状态不重复启动，超过 30 分钟才认为僵尸任务可重试。`video_1_d29` 已落盘到 `/generated/videos/1780455861980-3d512beb-cddc-4f54-b7a6-2dc4c0725fb1.mp4`。
- `image_1_d29` 到 `image_4_d29` 是 `openai/gpt-5.4-image-2 / 16:9 / 1K / 4张`，当时是同步保存的本地 png，不在远程保存队列里。四张落盘时间约 `2026-06-03 11:13:25.975 / 11:13:26.572 / 11:13:27.674 / 11:13:30.076`。

### 错误红字规则

- 用户最终确认生成错误红字规则：优先显示模型/供应商返回的真实中文原因；没有真实原因显示通用 `服务器繁忙，请稍候再试.....`；所有生成错误都带 `B_数字` 错误编号，方便按编号查后端日志。
- 用户端不能显示供应商名字，包括 `OpenRouter / BytePlus / ModelArk / OpenAI / Gemini / Google`。也不能显示 `<system-reminder>`、`finish_reason`、`native_finish_reason`、HTML、堆栈、源码路径、内部英文技术提示。`src/lib/error-message.ts` 和 `src/lib/openrouter.ts` 已做清洗。
- 对话流里如果一批图片/视频有多个失败原因，要分页显示 `<1/4>`。默认定位第一条真实原因；如果前几条是通用原因、后面有真实原因，默认显示真实原因页。每个失败原因保存到 `message.mediaErrorReasons`，整批还会写 `[media-generation] image failure reasons / video failure reasons` 日志。
- 资产库外部失败卡不显示真实原因，只显示失败和“查看失败”；用户点进全屏资产生成页后再显示真实原因。资产库也走同一套错误清洗规则。
- 图片供应商请求已加 5 分钟超时，防止一直 pending。响应不完整、JSON 解析失败、5xx 属于临时错误，可重试一次；模型拒绝、内容过滤、没有返回图片不再重试，避免拒绝类错误拖到 7-9 分钟。
- 本轮后续补漏：`图片平台没有返回图片，且没有返回可用原因。` 不是用户可读真实原因，应显示通用 `服务器繁忙，请稍候再试.....`。已在 `src/lib/error-message.ts` 里把 `没有返回可用原因 / 没有返回原因 / 没有可用原因 / 且没有` 这类无真实原因文本映射到 fallback。真实中文拒绝原因仍显示。

### 图片生成固定槽位规则

- 用户重新明确图片生成槽位规则：用户生成几张图就显示几个等待卡，最多 4 个位置；1/2/3/4 号位置固定，不会有第 5、第 6 个位置。每个位置只能显示一种状态：等待卡、成功图片或失败卡。
- 对话流图片生成现在一开始就写固定 `imageResultSlots`，状态为 `pending`。单个请求成功后只把对应槽位替换为 `{ type: "image", url }`；失败后只把对应槽位替换为 `{ type: "failed" }`。不能在数组末尾追加成功图、等待卡或失败卡。
- 失败卡重试规则：点击第 N 个失败卡，只把第 N 个失败槽位改为等待状态。成功后该槽位变图片；再次失败该槽位继续显示失败卡。其它失败槽位和对应红字原因保留。
- 红字分页规则：失败原因只对应当前仍失败的槽位。比如 4 个全失败时显示 `<1/4>`；重试第 3 个成功后，只剩 1/2/4 三个失败原因可切换，不再保留第 3 页；重试第 3 个又失败，则第 3 页替换为新的失败原因。
- 本轮踩坑：曾用 `mediaErrorReasons.length` 推断失败卡数量，导致出现 5 张失败卡，这是错误的。失败卡数量必须来自固定槽位中的 `failed` 状态，不能从错误原因数量推断。
- 本轮踩坑：为过滤非请求尺寸图片时，曾只使用 `selectedImageVariant.slotIndexes`，但该数组只包含图片槽位，导致真实 `failed` 槽位被过滤掉。后续如果按尺寸过滤图片，必须保留 pending/failed 槽位原位显示。

### 图片额外返回和尺寸过滤

- 对话流图片现在不再显示模型额外多返回图片，也不再对额外图分页。用户请求几张就最多展示几张。
- 服务端 `/api/image` 会优先按用户请求尺寸筛选返回图，再按请求数量截断。例如用户请求 `4K`，只返回真实尺寸匹配 4K 的图片；模型额外返回 `1K` 图不显示、不计入本次 `mediaUrls/allMediaUrls`。
- 前端旧对话也按同样规则过滤展示。旧数据中如果已有非请求尺寸图片，会被隐藏；但固定槽位里的等待卡和失败卡仍应保留。
- 如果用户请求 4 张 4K，但模型只返回 3 张真实 4K，正确显示是 3 张图 + 1 张失败卡，而不是显示 1K 图，也不是只显示 3 张。

### 成功提醒规则

- 图片专业模式同一批内任意一个槽位成功，就可以弹一次绿色 `图片生成已完成`。使用 `notifyGenerationCompleteOnce(requestId, ...)` 保证同一批只弹一次。
- 全部失败时不能弹绿色成功。成功提醒只允许在 `resultImages.length > 0` 的成功分支触发；失败分支和整批全失败不能触发。
- 本轮曾短暂改成整批结束后 `successCount > 0` 再弹，用户确认不符合预期，已撤回。

### video_2_d28 数据修复

- `video_2_d28` 对话流引用的旧本地文件 `/generated/videos/1780454968504-21fb484e-7894-45cb-b730-63c475ee71f2.mp4` 被删除后导致对话流和预览 404。有效文件是 `/generated/videos/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.mp4`。
- 本地数据库用户 `ID_779117` 的 `UserWorkspaceState.state` 已把旧 URL 替换为有效 URL，最终验证 `old 0 / new 6`。注意当时浏览器还开着旧工作区状态，曾把数据库又覆盖回旧 URL，所以后续加了兜底。
- `/api/workspace-state` 的 GET/PUT 都会执行旧 URL 替换；工作台加载时也会替换旧 URL。这样即使浏览器旧状态再次保存，也会被服务端修正。
- `public/generated/videos/manifest.json` 中对应 BytePlus Fast 任务 `cgt-20260602204634-97h8d` 的 `localVideoUrl` 已改为有效本地文件。`src/lib/media-save-queue.ts` 也补了：如果 saved job 后来补到 `videoTaskId`，会回写 `video-manifest.json`。

### 预览页和开发浮层修复

- 本轮用户截图显示 Next 开发浮层 `5 Issues`。`npm run lint/build` 没有错误，真实运行时错误在 dev 日志里是 `Maximum update depth exceeded`。
- 根因包括预览图片尺寸 effect 重复 `setPreviewNaturalSize`、缩略图分页重复 `setPreviewThumbPageSize`、预览资产同步重复 `setPreviewAsset`。已加相同值不更新保护。
- 生成图片缩略图从 `width/height + CSS 改尺寸` 改为 Next `Image fill + object-contain`，减少 `Image has either width or height modified` warning。

### 本轮验证

- 本轮多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning：未使用 eslint-disable 和 `showInputTip` hook dependency。
- 本轮多次 `npm run build` 通过。

## 2026-06-02 本轮关键交接

### 本轮继续：后台概览、积分明细、BytePlus 复测、视频时长和日志

- 用户要求把本对话框内所有内容写入交接文档和更新日志，方便下一个 AI 保留记忆继续工作。回答继续保持简单直接。
- `Seedream 5.0 Lite` 的 `output_format=jpeg` 已由用户确认不报错且输出确实是 jpg。本轮新增 `scripts/test-byteplus-seedream-5-lite-px-matrix.mjs`，用 `seedream-5-0-260128 + output_format=jpeg + size=具体 WIDTHxHEIGHT px` 复测 12 个尺寸组合，全部成功。结果在 `AI-Video-Assistant_Project Planning/test/byteplus-seedream-5-lite-px-size-test-results.md`，图片在同目录 `byteplus-seedream-5-lite-px-images/`。规划目录未提交 GitHub。
- d28 预览问题排查结论：d28 成功图片为 17 张；两条早期 assistant 消息各有 4 个槽位但无 URL，属于失败/空槽，预览不会显示。右侧缩略图当前分页渲染，不会一次性显示全部成功图；如果翻页也看不到成功图，才继续查 `previewMediaOptions`。
- 图片/视频分辨率图标规则已定：图片 K 数 `1K / 2K / 4K` 都是空心边框；视频 `SD / HD / FHD / 4K` 才是黑底实心。已修图片设置菜单里 `4K` 黑底的问题。
- BytePlus 视频文档已确认尺寸控制：视频请求不传 px `size`，只传 `resolution + ratio`。`Seedance 2.0 Fast` 支持 `480p / 720p`，不支持 `1080p`；`Seedance 2.0` 支持 `480p / 720p / 1080p`。比例支持 `16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / adaptive`。
- BytePlus 两个视频模型前端时长已改为 `4-15秒` 每秒可选，服务端也 clamp 到 `4-15`。OpenRouter 视频模型时长不变。视频时长菜单两列显示：左列高秒数 `15-10`，右列低秒数 `9-4`，两列从下往上递增。
- d28 最后两个视频任务排查：`Seedance 2.0 480p/16:9/5秒` 总耗时约 4分09秒并保存本地；`Seedance 2.0 Fast 720p/16:9/15秒` 总耗时约 13分55秒，远程视频约 2 分多钟已生成，最后没有保存成本地文件，主要卡在远程 mp4 下载保存。
- `/api/video` 已加 `[video-generation] BytePlus created / polling / completed` 日志。完成日志含 `queryMs / saveMs / totalMs / savedLocal / saveFailed / saveError`，不打印完整远程签名 URL。后续排查视频慢先看 `saveMs`。
- 后台系统设置 API 输入框继续调宽：OpenRouter 区 `620px`，BytePlus 区 `450px`，总宽 `1090px`，低于模型表 `1180px`。
- 后台积分管理展开区 `当前积分` 已可点击，弹窗按时间最新排序显示每次积分变动：`变动原因 / 积分变动 / 变动后剩余积分`。数据来自 `CreditLedger`，余额通过当前余额倒推。
- 后台概览已从占位改为运营看板：核心卡、DAU/WAU/MAU、近 30 日活跃/新增趋势、近 7 日生成趋势、近 7 日积分/美元消耗、1/3/7 日留存、系统状态、模型使用 Top 8、供应商占比、失败原因 Top 10、最近活跃用户和消耗积分用户 Top 10。
- 已把业务代码、后台/API、Prisma、脚本和当时已有交接文档提交并推送到 GitHub：`a538b32 Update admin dashboard and BytePlus integrations`。`.env / .env.local` 和 `AI-Video-Assistant_Project Planning/` 未提交。注意：本次交接文档补写是在该提交之后，如果需要远端也包含这次文档补写，要再提交推送。
- 本轮 `npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过。两个 warning 暂不影响运行：一个是未使用 eslint-disable，一个是 `showInputTip` hook dependency 提示。

### 本轮继续：BytePlus 后台开关、计费、模型显示和交互修正

- 用户要求后续回答简单直接。当前重点仍是 BytePlus 和后台系统设置。用户强调 OpenRouter 稳定逻辑不能被影响，前端后台显示不要乱改，只把后端计费和开关落实。
- 后台系统设置 API Key 输入框已临时明文显示，用于核对 Key；后续如有安全要求可改回密码框。
- 视频等待卡曾被提示词区压窄成竖卡，已修：专业视频成功/等待/失败统一 `640x360`，Agent 自动视频保留两列紧凑布局。对话流主视频播放器去掉 `muted`，返回有音轨时能播放声音。
- BytePlus `Seedream 5.0` 前后台显示名改为 `Seedream 5.0 Lite`。模型 ID 仍为 `byteplus:conversation-image.seedream-5-0`，实际模型名仍为 `seedream-5-0-260128`。
- `Seedream 5.0 Lite` 的 `output_format` 当前为 `jpeg`，这是用户要求继续测试 jpg/jpeg 的结果。此前 `jpg` 导致 BytePlus 返回参数不支持；若 `jpeg` 仍失败，应回退 `png` 或不传。`Seedream 4.5` 不传 `output_format`。
- `Seedream 5.0 Lite` 的尺寸表已和 `Seedream 4.5` 对齐，所有 `2K / 4K` 比例都传具体 px，不再显示 `未知`。
- 资产库图片生成模型开关已补齐：后台 `资产库图片生成` 会影响资产生成页模型菜单和服务端 `/api/image` 校验。资产库 BytePlus 图片请求使用 `asset-image.*` Endpoint 配置，对话流图片请求继续使用 `conversation-image.*`。
- 后台 BytePlus 文本模型行启用 BytePlus 后，下拉菜单会灰掉不可点；必须关闭该行 BytePlus 后才能修改下拉模型。
- 后台 `Agent 自动生成策略` 中 `高质图片` 右侧的 `Seedream 5.0 Lite` 已移除。注意：Agent 自动生成策略的媒体模型开关仍未完整接入执行策略，后续如要严格按后台策略执行，需要单独继续做。
- 前端所有图片模型下拉统一排序：`Seedream 4.5` 第一，`Seedream 5.0 Lite` 第二，其它图片模型排后面。对话流图片和资产库图片都用这个顺序。
- 用户指出带 AI 图标的内容都应视为模型说话，因此原先前端拼接的“当前选择 / 实际路由”模型信息回答已取消。现在问当前模型会走普通 Agent 回答，不再由前端造带 AI 图标的假回答。
- BytePlus 费用计算已按 `E:\project\【1】Api key\Byteplus\pricing.md` 接入。OpenRouter 不受影响。前端和后台显示结构不变，只是后端 usage.usd 会补上。
- BytePlus 文本计费：`seed-2-0-lite-260428` 输入 `$0.25/M`、输出 `$2.00/M`；`seed-2-0-pro-260328` 输入 `$0.50/M`、输出 `$3.00/M`；`glm-4-7-251222` 输入 `$0.60/M`、输出 `$2.20/M`。`seed-2-0-lite/pro` 超过 `128K` prompt tokens 时按第二档翻倍。
- BytePlus 图片计费不是按 token，而是按成功输出图片张数：`seedream-4-5-251128` 为 `$0.04/张`，`seedream-5-0-260128` 为 `$0.035/张`。代码仍保留 token 展示，但扣费金额按成功保存图片数量计算。
- BytePlus 视频计费用返回的 `usage.completion_tokens`：`dreamina-seedance-2-0-fast-260128` 为 `$5.60/M tokens`；`dreamina-seedance-2-0-260128` 为 `480p/720p $7.00/M tokens`、`1080p $7.70/M tokens`。
- 后台明细模型名已补 BytePlus 识别，不再显示 `byteplus:...` 原始 ID。
- 本轮多次 `npm run lint` 和 `npm run build` 通过，仍只有 `chat-workbench.tsx` 原有两个 warning。

### BytePlus 前台显示、真实图片/视频接口和测试结论

- 用户要求后续回答简单直接。本轮主要继续 BytePlus：后台 UI、图标、前台模型显示、BytePlus 图片/视频真实生成接口，以及 BytePlus 图片尺寸测试。
- 用户确认供应商隔离总规则：OpenRouter 已跑通的内容不能被 BytePlus 改动影响，因为后台还可能随时切回 OpenRouter。BytePlus 能按 OpenRouter 规则走的先按一样规则走；不支持或实测不同的，再单独拆 BytePlus 规则。后续涉及 OpenRouter / BytePlus 或其它模型供应商的参数、请求、尺寸、扣费、后台记录，都必须按 provider 独立分支处理。
- 本轮后续又确认 BytePlus 模型名和 Endpoint ID 都能调用，但 Endpoint ID 可能解除部分限制。后台 `BytePlus API` 行最右侧新增 `解除限制` 开关，保存为 `BYTEPLUS_UNLOCK_LIMITS`。关闭时实际调用用前面的模型名；打开时实际调用用后面的 `ep-...` Endpoint ID。前端和后台模型显示名称不变，仅服务端请求 `model` 值切换。文本、图片、视频 BytePlus 调用都按这个开关处理。
- 后台 `OpenRouter API / BytePlus API` 顶部输入区宽度已压小，低于下面模型列表宽度。当前顶部 API 区 `min-w-[860px]`、内容宽 `960px`，下面模型列表仍 `min-w-[1180px]`。
- 用户提供 BytePlus logo SVG 后，已新增 `src/components/byteplus-icon.tsx`，只取前置图形，不带 BytePlus 文字。后台 BytePlus 列和前台 BytePlus 模型都使用该图标。颜色最后按用户要求改成和其它模型图标一致的灰色，使用 `currentColor`。
- 修复 BytePlus 模型下拉无法保存的问题。根因是 `.env.local` 里的 JSON 配置被外层引号包裹，`getJsonEnvValue()` 读到转义字符串后 `JSON.parse()` 失败，导致读回默认值。现在 `parseEnvValue()` 会先尝试解析外层 JSON 字符串。
- 前台模型可用性已补 BytePlus。`/api/model-availability` 现在返回 OpenRouter 和 BytePlus 的可用图片/视频模型。新增前台 BytePlus 模型 ID：`byteplus:conversation-image.seedream-4-5`、`byteplus:conversation-image.seedream-5-0`、`byteplus:video.seedance-2-0-fast`、`byteplus:video.seedance-2-0`。BytePlus `Seedance 2.0` 也金色显示。
- BytePlus 图片接口已接通。接口为 `POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`。默认模型名：`Seedream 4.5 -> seedream-4-5-251128`、`Seedream 5.0 -> seedream-5-0-260128`；`解除限制` 打开后改用 `ep-20260514174622-n9qfb / ep-20260514142211-p2wdk`。返回 `data[].url` 保存本地；`usage.output_tokens` 记为 completionTokens，`usage.total_tokens` 记为 totalTokens。
- BytePlus 图片参考图规则：无参考图不传 `image`；1 张参考图传字符串；多张参考图传数组。用户选多张时当前不要用官方 `max_images` 批量模式，因为它只表示最多几张，不保证一定返回用户要的张数；当前对话流按张数并发多个单图请求，每个请求 `count: 1`。
- BytePlus 图片流式返回已记录但没接。`stream: true` 后返回 SSE：`image_generation.partial_succeeded` 带 `image_index/url/size`，`image_generation.completed` 带 usage，最后 `data: [DONE]`。当前项目仍使用非流式，等完整 JSON 后保存、扣费、显示。如果以后要一张张跳出来，再接 SSE。
- BytePlus 视频接口已接创建和查询。创建：`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`；查询：`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`。成功查询响应里 `status=succeeded`，视频 URL 在 `content.video_url`，usage 为 `completion_tokens / total_tokens`。当前代码会保存视频本地并写 `mediaUrls / remoteMediaUrls / delivered`。
- BytePlus 视频创建请求按文档传 `resolution / ratio / duration / generate_audio / watermark`。参考图当前使用 `role: "reference_image"`，本地 `/generated/...` 图片会转 data URL。还没接参考视频、参考音频、严格首尾帧或取消任务。
- 用户把 BytePlus 文档放在 `E:\project\【1】Api key\Byteplus`。已读取：`Seedream 4.5和5.0接口文档.md`、`Seedance 2.0接口文档.md`、`说明.md`。`说明.md` 是创建视频任务的完整参数说明，用户后续又贴了查询任务响应示例。
- 新增 `scripts/test-byteplus-image-size-matrix.mjs`。结果写在 `AI-Video-Assistant_Project Planning/test/byteplus-image-size-test-results.md` 和 `byteplus-image-size-test-raw.json`。脚本支持续跑，失败或超时会记录到结果文件。
- BytePlus 图片实测结论：`Seedream 4.5 / 5.0` 都不支持 `1K`。两个模型都支持 `2K / 4K`。`Seedream 4.5` 不支持 `output_format`，正式代码已改为只有 `Seedream 5.0` 传 `output_format=png`。`Seedream 5.0` 的若干 4K 非宽高比请求本轮 10 分钟超时。
- BytePlus 图片稳定尺寸：`2K` 为 `16:9 2848x1600`、`9:16 1600x2848`、`1:1 2048x2048`、`4:3 2304x1728`、`3:4 1728x2304`、`21:9 3136x1344`。`4K` 为 `16:9 5504x3040`、`9:16 3040x5504`、`1:1 4096x4096`、`4:3 4704x3520`、`3:4 3520x4704`、`21:9 6240x2656`。4K 的 `4:3 / 3:4 / 21:9` 对 `Seedream 4.5` 成功，对 `Seedream 5.0` 本轮部分超时。
- BytePlus 图片尺寸已从 `只传 2K/4K` 改为已知组合直接传具体 px。BytePlus 没有独立 `aspect_ratio` 字段；`size` 可以是 `2K/4K` 或 `WIDTHxHEIGHT` 二选一。当前不额外给用户提示词加比例前缀，比例和 K 数都通过 `size` 的 px 值承载。未知组合显示 `未知` 并回退传 `2K/4K`。
- 本轮排查 d26 慢的问题：`[image-generation] BytePlus timing` 日志保留。最近一批 `Seedream 4.5 / 16:9 / 2K / 4张` 的 `providerMs` 分别约 `8.1s / 7.5s / 8.0s / 15.5s`，但 `saveMs` 有 `7.4s / 42.6s / 53.0s / 52.0s`，说明近期慢主要是 BytePlus 返回的远程图片 URL 下载保存慢，不一定是模型出图慢。继续观察该日志。
- 失败文案规则：如果 BytePlus 返回真实 `data[].error.message`，前端显示真实原因；如果 BytePlus 只少返回图片但不给失败原因，则只显示通用 `图片生成失败，请稍后再试。`，不带供应商名，不显示技术说明。
- 后续优先事项：继续测试 BytePlus 两个视频模型的比例、分辨率和秒数，把结果写入 `AI-Video-Assistant_Project Planning/test`，然后调整 `src/lib/models.ts` 的 BytePlus 视频能力表；继续观察 `解除限制` 开关打开后是否改善图片尺寸限制、返回数量或下载慢问题。
- 本轮验证：多次 `npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

## 2026-06-01 本轮关键交接

### 本轮继续：系统设置、BytePlus 和模型开关最终规则

- 后台 `系统设置` 页面当前顶部为两个 API 设置块：左侧 `OpenRouter API`，右侧 `BytePlus API`。两块左右并排、上下对齐。BytePlus Region 固定为 `ap-southeast-1`，界面不显示 Region 下拉。
- API Key 开关规则：关闭时输入框可编辑；打开时保存并启用当前 Key；状态 `已启用 / 已关闭` 显示在输入框内部右侧。OpenRouter 配置写 `OPENROUTER_API_KEY / OPENROUTER_API_KEY_ENABLED`；BytePlus 配置写 `BYTEPLUS_API_KEY / BYTEPLUS_API_KEY_ENABLED / BYTEPLUS_REGION`。
- BytePlus 接入资料在 `E:\project\【1】Api key\Byteplus\Byteplus.md`。该文件包含 BytePlus `ark-...` API Key、Region `ap-southeast-1`、AK/SK 以及模型到 Endpoint ID 的映射。当前 Data Plane 走 API Key，不使用 AK/SK。
- 后台模型表现在是 `使用位置 / OpenRouter / 说明 / BytePlus` 四列。模型框内不再放 `普通/高级/优先` 等说明，这些说明统一放中间列。左右没有对应模型时显示空灰底，不显示 `--`，用于保持对齐。
- OpenRouter 左侧所有模型都有开关；BytePlus 右侧所有模型也有图标和开关。左右同一行互斥：开 OpenRouter 会关 BytePlus，开 BytePlus 会关 OpenRouter。BytePlus 单独新增模型，如 `Seedream 5.0`，左侧是空灰底；打开它就是额外启用。
- BytePlus 对话模型下拉只保留三个：`Seed 2.0 Lite / Seed 2.0 Pro / GLM-4.7`。`对话 / Agent 规划 / 意图识别` 的 `普通 / 高级` 都有该下拉；`反推提示词 / 优化提示词` 的 `优先 / 第二 / 第三` 也都有该下拉。
- BytePlus 图片/视频不使用下拉。`Seedream 4.5` 对应左侧 OpenRouter `Seedream 4.5`；`Seedream 5.0` 单独显示；`Seedance 2.0 Fast / Seedance 2.0` 分别对应左侧同名 OpenRouter 视频模型。`Agent 自动生成策略` 的 `高质图片` 是左侧 `GPT-5.4 Image 2` 对右侧 `Seedream 5.0`，两者互斥。
- `src/lib/openrouter.ts` 已把文本类 BytePlus 路由接入。`sendToOpenRouter()`、`planAgentTask()`、`classifyOpenRouterIntent()` 会读取后台 `MODEL_PROVIDER_PREFERENCES`。如果选择 BytePlus，就请求 `https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions`，`model` 使用后台下拉保存的 Endpoint ID。
- `src/app/api/model-availability/route.ts` 已新增。前端工作台通过它获取可用图片/视频模型，关闭的模型从下拉菜单中隐藏。如果所有模型都关闭，下拉显示 `暂无可用模型`，用户发送时对话流红字提示 `连接不到模型，请联系管理员！`。
- `/api/image` 和 `/api/video` 已加服务端模型开关兜底校验，关闭模型不能绕过前端调用。BytePlus 图片/视频生成接口尚未真正接入，下一步要接 BytePlus 图片/视频专用 API，包括请求参数、轮询、保存本地文件、扣费 metadata 和后台明细绑定。
- 本轮验证：`npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；`npm run build` 通过。

### 本轮继续：生成记录页面、扣费开关和后台记录总原则

- 用户最终确认后台记录总原则：后台记录要全。只要用户生成或上传过，后台生成记录都要显示。扣分是否成功、是否关闭扣分、扣分流水是否异常，都只能影响扣分数据显示，不能影响记录是否显示。以后如某条记录扣分有问题，扣分列应显示 `0（扣分异常）`；开关关闭时显示 `0（扣分关闭）`。
- 后台积分管理 `选择积分消耗项` 新增 `反推/优化提示词` 开关，并做实。四个开关定义：`对话/规划` = Agent 和所有对话模型扣分；`图片` = 平台所有生成图片扣分；`视频` = 平台所有生成视频扣分；`反推/优化提示词` = 平台所有反推和优化提示词扣分。关闭对应开关时余额 0 也允许使用该类能力，不扣余额但仍写流水。
- 新增数据库字段 `CreditSetting.chargePromptTool`，迁移目录 `prisma/migrations/20260601120000_credit_prompt_tool_switch`。已执行 `npx prisma generate` 和 `npx prisma migrate deploy`。注意 Windows 下 Prisma DLL 可能被 dev server 占用，必要时只停 3000 端口 Node 后再生成。
- 后台 `生成记录` 页已做实，组件 `src/app/admin/admin-records-panel.tsx`。顶部卡片：`历史对话总数 / 图片生成总数 / 视频生成总数 / 上传图片总数 / 上传文件总数`。主表：`ID号 / 用户 / 历史对话 / 图片生成 / 视频生成 / 上传图片 / 上传文件`。排序按历史对话、图片生成、视频生成、上传图片、上传文件五类的最新时间，只要任意一类有新数据就靠前。
- 生成记录展开区第一列顺序为：`对话流图片 / 对话流视频 / 资产库图片 / 历史对话 / 工作区保存`。`对话流图片` 是对话流生成图片 + 对话流上传图片；`资产库图片` 是资产库生成图片 + 资产库上传图片。用户管理里的文案也同步改为 `对话流图片 / 对话流视频 / 资产库图片`。
- 生成记录展开区第二列为：`对话流生成图片列表 / 对话流生成视频列表 / 资产库生成图片列表`。这三个按钮打开同一个 `生成列表` 弹窗，左侧分类同按钮文案，点哪个按钮默认选中哪个分类。生成列表的数据源已改为 workspace 真实媒体和资产，排除上传项，不再依赖积分流水，避免扣分异常导致记录漏掉。
- 生成记录展开区第三列为：`对话流上传图片列表 / 对话流上传文件列表 / 资产库上传图片列表`。这三个按钮打开同一个 `上传记录` 弹窗，左侧分类同按钮文案，点哪个按钮默认选中哪个分类。上传记录顶部汇总显示 `对话流上传图片 / 对话流上传文件 / 资产库上传图片`。
- 生成记录中间两列列表弹窗右侧表格去掉 `消耗美元 / 折算人民币`，改为 `复制提示词`。有提示词时显示 `复制提示词` 按钮，点击后短暂显示 `已复制`。生成图/视频显示普通 `提示词`；上传图若已反推则显示蓝色描边 `反推提示词` 标识和反推内容，也可复制。
- `对话流图片` 和 `资产库图片` 打开的是大图预览弹窗，右侧缩略图已经有主图展示，因此按用户要求去掉缩略图悬停大图预览。后台其它缩略图悬停大图预览不受影响。
- 删除标识规则继续统一：用户删除前端图片、资产或对话后，后台记录保留并显示红字 `用户已删除 删除时间`。上传图已反推提示词时也要继续显示反推内容。
- 本轮验证：多次 `npm run lint` 通过，仍只剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

### 本轮继续：后台积分明细规则收敛、反推/优化闭环、删除/上传记录

- 后台积分明细现在坚持“新数据精确绑定，旧数据不猜”。不要再按时间随便把旧反推、优化或图片流水挂到相近图片上。旧流水缺 `mediaUrls/outputPrompt/failureReason` 就不显示，保证以后新数据正确。
- `对话流消耗积分详细` 顶部汇总固定为 `生成图片 / 生成视频 / 上传图片 / 上传文件`。右侧表格里对话流上传图片和上传文件都要显示为 0 分上传记录，积分、美元、人民币列都显示 `--`。上传图片参数为 `对话流上传`，上传文件参数为 `对话流上传文件`。
- `资产库消耗积分详细` 顶部汇总固定为 `生成图片 / 生成视频 / 上传图片`。资产库上传图要按 `角色 / 场景 / 分镜` 显示，参数为 `资产库上传`，积分、美元、人民币列显示 `--`。
- `反推/优化提示词消耗积分详细` 左侧顺序固定：上 `反推提示词`，下 `优化提示词`。反推顶部只显示 `反推图片`；优化顶部显示 `优化次数 / 消耗Token`。
- 反推提示词规则：只有上传图显示 `反推提示词` 按钮，包括资产库上传和对话流上传；模型生成图不显示。上传图名称用图片本身名称或用户上传时改的名称。预览页参数位置显示 `资产库上传` 或 `对话流上传`。
- 反推成功后，该图不再显示反推按钮，改为正常提示词、复制按钮、使用提示词按钮。每张上传图只能成功反推一次。反推成功流水必须写 `metadata.mediaUrls` 和 `metadata.outputPrompt`；后台显示图片、图片名称、提示词和扣分。
- 反推模型顺序固定：`openai/gpt-5.5 -> openai/gpt-5.4 -> bytedance-seed/seed-2.0-lite`。前两个模型失败不写失败流水；三轮全失败时写一条 0 分失败流水，metadata 写 `status: failed` 和 `failureReason`。前端红字显示 `服务器繁忙，请稍候再试！`。
- 优化提示词规则：优化可以成功多次，每次成功都正常扣分并写 `outputPrompt`；每次模型尝试失败都写 0 分失败流水。前端优化失败不显示任何提醒，只结束 loading。后台优化明细显示成功提示词或红字失败原因。
- 后台所有图片缩略图都有悬停大图预览，组件为 `src/app/admin/admin-hover-image-preview.tsx`。按浏览器边界自动定位，尽量大且不出界。
- 用户删除前端图片、资产或对话后，不真实删除后端积分流水。后台相应记录保留：文件名/图片名照常显示，后面追加红字 `用户已删除 删除时间`，参数行照常显示。资产回收站有真实 `deletedAt`；对话流单图删除暂无独立删除时间时用扣费/生成时间兜底。
- 用户管理弹窗同步删除状态。历史对话、对话流生成图片/视频、资产库生成图片被删除后，记录仍显示并标红 `用户已删除`，缩略图底部显示 `用户已删除`。
- 资产恢复逻辑已修：删除时写 `previousType`，恢复时优先回原分类。旧数据无 `previousType` 时按 `systemName` 兜底。`角色57` 本机已从错误的 `other` 修回 `character_image`。
- 资产生成任务卡规则：`assetGenerateJobs` 持久化到 workspace，刷新后失败卡恢复；刷新中的任务恢复为失败卡。删除成功生成资产时，同 URL 的成功任务卡同步清掉，避免资产页残留。
- 图片生成接口多返图策略已按入口拆分：对话流里每个子请求如果返回多张候选图，要全部显示并分页；资产库生成里每个子请求只返回一张最匹配当前参数比例/尺寸的图，额外图不进入资产库也不显示。OpenRouter 成功但无图片时会记录真实无图原因，生成页显示真实原因，外部失败卡不显示原因。
- 本轮多次 `npm run build` 和 `npm run lint` 通过。当前只剩 `chat-workbench.tsx` 原有两个 warning：`Unused eslint-disable directive` 和 `showInputTip` dependency。

### 后台积分明细三类弹窗

- `对话流消耗积分详细` 已继续细化。左侧对话名称前显示 `【d编号】`。右侧是表格，列为 `生成内容 / 积分扣除 / 消耗美元 / 折算人民币`。表格上方左侧显示图片数量和视频数量，右侧显示当前窗口的 `积分扣除` 汇总。
- 对话流媒体明细显示系统名；用户改名后显示 `系统名 / 用户改名`。媒体参数显示跟前端一致：`模型 | 比例 | 尺寸 分辨率 | 时长`，时间跟在参数后面。失败行左侧灰框显示 `生成失败`，右侧直接红字显示失败原因，下面只显示时间。
- 资产库消耗积分详细已做实。左侧分类为 `角色 / 场景 / 分镜`，顺序固定，分镜在场景下面。右侧使用同款表格。新流水优先通过 `metadata.mediaUrls` 显示真实图片；旧流水没有 URL 时按同用户、同分类、生成时间最接近的资产图兜底。
- 反推/优化提示词消耗积分详细已做实。左侧分类为 `反推提示词 / 优化提示词`。反推提示词显示图片，新流水通过 `metadata.mediaUrls` 精确匹配；旧流水用时间就近匹配，但同一弹窗内不会重复挂同一张图。
- 反推/优化明细中，主标题优先显示模型输出的提示词文本，不再固定显示 `提示词整理`。长提示词在当前列宽内换行，图片缩略图保持原尺寸并与提示词顶部对齐。参数/时间行前面显示使用的模型名称。

### 图片扣费和额外返回图规则

- `/api/image` 现在会在扣费流水 metadata 中写 `mediaUrls / allMediaUrls / extraMediaUrls / requestedImageCount / returnedImageCount / billableImageCount / delivered`。`mediaUrls` 是计费媒体，`allMediaUrls` 是实际交付全部媒体，`extraMediaUrls` 是模型额外返回但不计费的图片。
- 对话流图片生成不再只保留第一张返回图。只要接口返回了额外候选图，前端应全部显示、写入工作区，并在图片区域分页。超过计费数量的额外图片在后台明细里显示为 `-0 / $0.0000 / ¥0.00`。
- 资产库生成规则不同：如果模型一次返回多张候选图，只保留最匹配当前比例/尺寸的一张，额外图不进入资产库也不显示。
- 后台旧流水匹配已收紧。明确带 `requestId:image:序号` 的旧图片流水，如果找不到对应 URL，不再退回挂到同批第一张图，避免一张图片看起来被多次扣费。

### Metadata 写入要求

- `/api/chat` 会把模型输出写入 `CreditLedger.metadata.outputPrompt`。反推提示词请求会写 `metadata.mediaUrls`。优化提示词请求会写 `metadata.originalPrompt`。后续新增提示词工具扣费时也要继续把可展示内容写入 metadata，避免后台只能显示 `提示词整理`。
- 后续涉及后台明细、扣费、媒体结果、资产归属时，优先从服务端 metadata 和工作区真实媒体 URL 精确绑定，不要只按时间猜。旧数据可以兜底匹配，但新数据必须走精确绑定。

### 本轮验证

- 多次 `npm run build` 通过。
- 多次 `npm run lint` 通过，只剩项目原有两个 warning：后台积分明细 `<img>` 的 Next warning，以及 `chat-workbench.tsx` 的 `Unused eslint-disable directive`。

## 2026-05-29 本轮关键交接

### 本轮继续：扣费安全、错误编码、失败显示和 d23 排查

- 用户确认硬规则：凡是涉及数据库写入、积分/扣费、用户状态、权限、禁用、资产归属、生成记录、后台管理、供应商返回结果等重要信息，必须由服务端验证、计算和写入。前端不能作为可信来源，只负责展示服务端结果和发起用户操作。后续代码必须按这个规则写。
- 生成扣费口径重新确认：供应商（如 OpenRouter）返回 usage/cost 才扣用户积分；只要供应商扣我们费用，我们也要记录费用和扣分；只要有扣费，必须绑定可交付图片/视频结果。如果供应商扣费但媒体未交付，应进入异常账单/日志，不允许静默混在正常明细里。
- `/api/image` 现在仍由服务端闭环处理：生成并保存图片成功后调用 `chargeCredits()`，扣费流水 metadata 写 `mediaUrls / requestedImageCount / returnedImageCount / billableImageCount / delivered`。前端只接收返回的图片和 `credit`，不再主动决定是否扣费。曾短暂新增 `/api/credits/charge-generation` 的前端确认扣费方案，但已撤回并删除，后续不要恢复这种前端关键扣费方案。
- `/api/video` 在轮询到成功视频 URL 后扣费，metadata 写 `mediaUrls / remoteMediaUrls / delivered`。如果本地保存视频失败但远程 URL 可用，仍把远程 URL 作为交付 URL。
- 新增错误编码工具 `src/lib/error-code.ts`。主生成接口失败时，用户红字显示 `（B_数字）中文错误`，后端日志打印同一个 `[B_数字]` 并脱敏 API Key。计数器存在 `.runtime/error-code-counter.txt`，已加入 `.gitignore`。用户只要给编码，就能快速定位日志。
- 红字失败显示规则：只要任意单张图片或单个视频失败，红字立即显示，不等整批结束。优先显示服务端返回中文真实原因；没有真实原因时显示 `图片生成失败，请稍后再试。` 或 `视频生成失败，请稍后再试。`；内部技术错误只显示 `任务失败，请联系管理员！`。全部失败项都点重新生成时红字隐藏，只重试部分失败项时旧红字保留，重试失败后显示最新原因。资产库生成页和资产库失败任务卡也同步。
- 内部技术错误不会直接给用户看。`Maximum call stack size exceeded / RangeError / TypeError / ReferenceError / stack / trace / HTML` 等统一显示 `任务失败，请联系管理员！`，日志保留真实错误；`curl / schannel / closed abruptly / command failed` 等传输错误显示 `网络连接异常，请稍后重试。`
- 修复大图 data URL 保存栈溢出：`saveDataUrlAsset()` 和 `saveUploadedImageAsset()` 不再用正则匹配整段 base64，改成按逗号拆分 data URL。
- d22 一直等待卡根因：失败槽位的 `retryingStartedAt` 残留，但 `pendingRequests` 已空。现在只有真的有对应运行任务时才把失败槽位显示成等待卡，任务结束会清理 `retryingStartedAt`。本机已清理 `ID_779117` 的 d22 数据。
- 左侧运行中动画改位：对话生成中时，历史对话行右侧三点按钮临时隐藏，三点位置显示九宫格动画；切到其它一级面板导致历史二级列表不可见时，动画显示到一级菜单 `对话模式` 右侧。资产库生成中时，资产生成分类右侧数量临时隐藏显示动画；切出资产库时，动画显示到一级菜单 `资产库` 右侧。
- Gemini 额外返回图规则：`Gemini 3.1 Flash Image Preview` 和 `Gemini 3 Pro Image Preview` 都允许保留额外返回图；用户选 4 张时第一页只显示前 4 张，额外图进入后续页，参数行分页和图片页对应。其它模型每个单图子请求只保留第一张。
- d23 排查结论：`Gemini 3.1 Flash` 机器人批次只发了 4 个子请求，对应 4 条流水，模型额外返回导致旧界面显示 7 张；额外 3 张没有单独扣费证据。最后一批 `Gemini 3 Pro` 显示 1 成功 3 失败，但有 3 次成功收费流水，共 29 分，说明扣费与可见结果曾不一致。另有 3 笔 `GPT-5.4 Image 2` 孤儿流水，前缀 `7c8517bb...`，共 54 分，有 usage/usd/token，但当前工作区没有对应媒体消息。
- 用户中心我的积分数量修正：普通对话图片/视频数量优先按工作区真实成功媒体 URL 去重统计，不再直接累加 `CreditLedger.imageCount`。资产库三类生成也优先按工作区真实资产数量统计。后台 `对话流消耗积分详细` 优先读 `CreditLedger.metadata.mediaUrls`，旧流水没有绑定媒体且工作区也匹配不到 requestId 的孤儿媒体扣费不再混进媒体明细；全局消耗总数仍保留真实历史流水，不自动退款。
- 本轮验证：`npm run lint` 通过，仅剩原有两个 warning：后台积分明细原生 `<img>` warning 和 `chat-workbench.tsx` 原有 `Unused eslint-disable directive`。本轮未跑 build。

### 对话流媒体命名和预览一致性

- 本轮用户重点要求：对话流和资产库看到的同一张图片/视频必须保持一致，包括文件名、参数和提示词。不要让对话流读一套数据、资产库读另一套旧数据。
- 会话新增稳定编号 `conversationCode`，格式 `d1 / d2 / d3...`。旧会话按 `updatedAt` 从早到晚补编号，删除后编号不复用。工作区状态保存 `nextConversationNumber`。
- 对话流模型生成媒体的系统名保存在 assistant 消息的 `mediaSystemNames`：图片 `image_序号_d编号`，视频 `video_序号_d编号`。生成和重试前必须扫描当前对话已有系统名，取最大编号继续，不能只信 `nextImageNumber / nextVideoNumber`，否则重试后可能重名。
- 资产新增 `systemName`。模型生成资产初始 `name = systemName`；用户改名只改 `name`，`systemName` 永久保留。资产库生成继续用 `角色1 / 场景1 / 分镜1` 作为系统名和初始显示名。
- 上传图不使用系统编号。对话流上传图和资产库上传图保留上传时名字，不写 `image_...`；预览显示 `对话流上传` 或 `资产库上传`，提示词显示 `暂无提示词`，按钮显示 `反推提示词`。
- 当前预览数据源应按这套规则：名称优先从资产库当前记录读取，资产不存在时读消息 `mediaSystemNames`；提示词和参数统一通过 URL 回查对话流 assistant 消息，图片读 `imagePrompts[url]`，视频读 `videoPrompts[url]`，参数读 `getPreviewMediaMeta()`。不要再让资产库预览优先使用资产对象中过期的 `sourcePrompt / previewMeta`。
- 预览缩略图列表必须按 `imageResultSlots` 顺序构建。d22 曾出现 `message.images` 顺序和 `imageResultSlots` 顺序不一致，导致切图后名称从 `image_10_d22` 跳回 `image_9_d22`。

### Gemini 3 Pro 多图分页

- 分页只对 `Gemini 3 Pro Image Preview` 生效，因为当前只有它实测会一次请求多返回图片。其它模型包括 `Seedream 4.5` 不再显示参数页分页。
- Gemini 3 Pro 如果用户选 `4张`，第一页固定显示用户选择数量内的前 4 张；模型额外多出的第 5 张、第 6 张等进入后续页。图片区域右下角旧分页已移除，只保留参数行分页。
- 曾经按真实尺寸分组导致对话 22 里用户选 4 张但只显示 1 张。后续不要再把用户选择数量内的图片按尺寸拆散。

### d22 临时数据修复

- 本轮临时修复了本地数据库用户 `ID_779117` 的 `d22` 会话。该会话标题为 `生成一个龙`，原工作区只保存 1 张图，但 `public/generated/images` 最后 4 张属于同一批生成结果。
- 已补回 d22 的 `images`、`imageResultSlots`、`mediaSystemNames` 和资产库记录，命名 `image_1_d22` 到 `image_4_d22`。这属于本机数据修复，不是通用迁移脚本。

### 本轮验证补充

- 本轮多次 `npm run lint` 通过，仍只有原有两个 warning：后台积分明细 `<img>` warning 和 `chat-workbench.tsx` 原有 `Unused eslint-disable directive`。
- `npm run build` 多次通过；中间有两次因为 Google Fonts `Geist Mono` 网络请求失败而失败，不是代码错误。

### 后台用户管理媒体弹窗

- 后台用户管理里的 `对话流生成图片 / 对话流生成视频 / 资产库生成图片` 弹窗左侧显示区已改：参数显示在提示词上方，提示词完整显示，超出弹窗高度时只滚动弹窗内部，不影响背后页面。
- 资产库生成图片如果是上传图且没有 `previewMeta`，参数位置显示 `资产库上传`。如果该上传图后来通过反推生成了提示词，则提示词前显示蓝色描边标识 `反推提示词`，带 `RiQuillPenAiLine` 图标。
- 注意资产库上传图是否反推，目前通过 `sourcePrompt` 判断：`sourcePrompt === "资产库上传"` 或空表示无提示词；有非空提示词且没有 `previewMeta` 时认为是反推结果。

### 通用弹窗滚轮隔离

- 新增 `src/components/use-body-scroll-lock.ts`，弹窗打开时锁住 `document.body.style.overflow = "hidden"`，并把 `document.documentElement.style.overscrollBehavior = "none"`。
- 已接入首页登录抽屉、工作台资产上传弹窗、资产生成全屏页、用户中心、重命名弹窗、媒体预览页、文档预览面板、后台用户管理历史/媒体弹窗、后台积分调积分浮层。
- 主要遮罩层同时加了 `overscroll-contain`，目标是鼠标滚轮只作用于当前弹窗，不再带动弹窗背后的页面。

### 后台用户管理排序和显示

- 用户管理 `最后登录时间` 之前只显示 `User.lastLoginAt`，会和已登录用户的实际活跃不一致。现在显示 `lastLoginAt` 和最新 `Session.lastSeenAt` 中更晚的时间。
- 用户管理排序同步改为取 `lastLoginAt / Session.lastSeenAt / workspace.updatedAt / createdAt` 中最大时间排序，保证显示最新的用户排在前面。
- 用户管理和积分管理的展开三角都已移动到列表最前面；用户管理右侧原展开三角列已去掉。

### 后台积分管理展开区

- 积分管理用户行现在可以多个同时展开，和用户管理一致，不互斥。
- 积分管理表头 `最后活跃时间` 改为 `最后积分变动时间`。该时间按最新一条 `CreditLedger` 取值，包含模型消耗、注册送积分、后台加分、后台减分，后续充值/活动等流水也会算。
- 积分管理展开区为三列灰底横条。第一列：`当前积分 / 已赠送积分 / - 注册送积分 / - 后台调整赠送积分`。第二列：`已消耗积分 / - 对话流消耗积分详细 / - 资产库消耗积分详细 / - 反推/优化提示词消耗积分详细`。第三列：`消耗Token / 消耗美元 / 折算人民币`。
- 展开区明细前统一使用加粗 `-` 标识层级；可点击项的文字保留下划线，但 `-` 不加下划线。展开区数值统一普通颜色，不再用红色；主表里的红绿颜色保持原规则。
- `已赠送积分` 是净值：注册送积分 + 后台调整赠送积分。后台调整可能为负数，所以 `后台调整赠送积分` 可能显示负值。

### 对话流消耗积分详细弹窗

- `对话流消耗积分详细` 已接真实弹窗，尺寸和左侧列表结构复用用户管理的历史对话弹窗。左侧不再直接读 `CreditLedger.conversationTitle`，而是以当前工作区 `UserWorkspaceState.state.sessions` 为准，标题和顺序跟前端历史列表一致，再用 `conversationId` 匹配积分流水。
- 旧本地历史或早期还没接 `CreditLedger` 时产生的历史对话不会显示在该弹窗里，这是正常现象。现在所有新对话流扣费接口都带 `conversationId` 和 `conversationTitle`，以后新数据应能匹配。
- 弹窗右侧规则：第一条是 `对话积分` 汇总，第二条是 `规划积分` 汇总，下面是图片/视频积分列表。资产库生成、图片反推、优化提示词不进入这个弹窗，它们归其它来源。
- 图片/视频积分项会尝试显示缩略图。匹配逻辑在后台按工作区 assistant 消息 `requestId` 建 URL 索引，支持 `requestId:image:序号`、`requestId:video:序号`、基础 `requestId`、`requestId:image`、`requestId:video` 等兜底。
- 多图部分失败时，工作区里有 `failedImageCount` / `imageResultSlots` 的失败项会补灰色失败框，尺寸同缩略图，中间写 `生成失败`，扣分显示真实值，失败项为 `0`。仍有少量旧数据可能因为缺少 `requestId` 或媒体 URL 只能显示文字。

### 本轮验证

- 本轮多次 `npm run lint` 通过，没有错误。
- 当前仍有两个 warning：`chat-workbench.tsx` 原有 `Unused eslint-disable directive`，以及后台积分明细缩略图使用原生 `<img>` 的 Next warning。
- 本轮未运行 `npm run build`。

## 2026-05-28 本轮关键交接

### 本轮继续：后台积分设置、tooltip 和我的积分表

- 后台积分管理设置区继续细调：`美元汇率 / 1人民币兑换积分 / 注册送积分` 的开关已移到输入框同一行，输入框变窄，整条设置栏保持同一行。
- `选择积分消耗项` 下方三项去掉 `扣` 字，显示为 `对话/规划 / 图片 / 视频`；开关紧跟文字后面，第一项与上方小标题左对齐。
- 三个设置项现在都有有效值保护。`美元汇率` 只接受 `1.00-20.00`；`1人民币兑换积分` 只接受 `10 / 100 / 1000 / 10000`；`注册送积分` 按当前兑换比例折算价值不能超过 `200人民币`。无效值点启用会恢复上一次启用过的有效值。
- 注意“上一次有效值”的定义：只有点启用且输入合法后才成为新的有效值；输入过程中经过的中间值不算。例如上次启用 `6.80`，关闭后输入 `500` 再启用，会回到 `6.80`。
- 后端 `updateCreditSettings()` 也有同样保护，避免绕过前端写入无效汇率、兑换比例或注册送积分。
- tooltip 统一为黑色说明框，并加边缘检测。前台 `BlackHoverTooltip` 支持左右边缘检测和顶部空间不足时向下弹；后台积分说明图标也加左右边缘检测。
- 按用户要求，以下位置不再有悬停说明：对话流图片/视频模型按钮、资产生成模型按钮、参考图缩略图、输入框上传图缩略图、资产生成引用图缩略图。
- 用户中心 `我的积分` 表现在同时显示增加和扣除。表头改为 `积分来源 / 积分变动`。增加积分绿色 `+数字`，扣除积分红色 `-数字`。
- `注册送积分` 和后台正向调积分会逐条显示，不合并；后台调积分在前台显示为 `赠送积分`。
- 后台负向调积分不在用户中心明细表显示，但会写入数据库，并计入上方 `已赠送积分` 净值。`已赠送积分 = 注册送分 + 后台加分 - 后台减分`。
- 后台积分管理统计卡文案 `消耗积分` 已改为 `消耗积分总数`。
- 本轮多次 `npm run lint` 通过，仅剩项目原有 warning；中途跑过 `npm run build` 通过，最后小文案改动只跑了 lint。

### 本轮追加：资产库生成和后台管理

- 资产库角色生成 `单人9:16` 已强化为单人站立正面全身角色设定图、纯白背景、头到脚完整、脚不能裁切。禁止场景、复杂背景、半身、头像、侧身、背身、坐姿、躺姿、多人。
- `Seedream 4.5` 在资产库生成中增加专用规则，覆盖角色单人、角色三视图、场景单图、场景四宫格、分镜。注意只影响资产库生成，不影响对话流或 Agent 自动生成。
- 资产库生成命名固定为 `角色1 / 场景1 / 分镜1` 这类递增。不要再从提示词里提取角色名、动物名、场景名，也不要再给资产库生成写 `角色三视图`、`场景多角度` 名称。对话流命名保持 `image_随机数 / video_随机数`。
- 所有等待卡进度改为 3 分钟内分段：前 30 秒快到 45%，90 秒到 75%，180 秒到 95%，之后固定停在 95%-99%。只是显示，不代表真实任务进度。
- 用户中心我的积分中，资产库三类来源显示为 `资产库_角色图片 / 资产库_场景图片 / 资产库_分镜图片`，图标统一 `RiFolderLine`。普通对话图标用 `RiChat3Line`。反推和优化来源不变。
- 后台用户管理每页 15 条，排序按最近活跃，不再按创建时间。最近活跃优先级是 `lastLoginAt -> sessions[0].lastSeenAt -> workspace.updatedAt -> createdAt`。
- 后台用户管理展开区新增 `资产库生成图片`，媒体弹窗右侧顶部有 `角色 / 场景 / 分镜` 三个切换按钮。该弹窗读取 workspace assets 中 `librarySource: "asset_generation"` 的图片。
- 后台 `禁用 / 启用` 已做实。禁用会更新 `User.disabled` 并删除该用户所有 Session。前台 `getCurrentUser()` 遇到禁用用户会清 Session 和 Cookie。登录禁用账号会红字显示 `用户名错误！请联系管理员！`。工作台每 5 秒和窗口聚焦时检查登录态，禁用后会退回首页。
- 后台积分管理现在按用户聚合，每页 15 条，列为 ID、用户、当前积分、已赠送积分、已消耗积分、最后活跃时间、调积分。已赠送积分只统计 `direction: increase`，已消耗积分只统计 `direction: consume`。
- 后台调积分弹窗已做实，点每行 `调积分` 在按钮左侧弹出小计算器，无黑底遮罩，点外部关闭，支持负数。后台调积分只影响赠送积分：正负都写 `CreditLedger.direction = "increase"`，负数写负值；不写消耗流水。前端模型调用扣费才影响消耗积分。
- 后台积分设置区已去掉保存按钮和白底，四段用竖线分隔。前三项数值开关关闭可编辑、开启灰掉并保存；扣对话/规划、扣图片、扣视频三个开关点击即保存。信息图标说明扣费项含义。
- 本轮只跑了 `npm run lint`，通过但仍有项目原有 `Unused eslint-disable directive` warning；本轮未跑 build。

### 优化提示词和积分来源

- 用户要求所有优化提示词扣分在用户积分里合并成一条。已新增 `prompt_optimization / 优化提示词` 来源。
- 资产生成优化提示词、对话流图片/视频专业模式优化提示词，都写 `metadata: { creditSource: "prompt_optimization" }`。
- `/api/credits/me` 和用户中心积分表都已识别该来源。该来源为文本类，不显示图片/视频数量，显示 `--/--`。

### 优化中禁用和通用 Loading

- 对话流图片/视频专业模式优化中，整个主输入框禁用并变淡，包含正文、上传、`@`、模式、模型、比例、数量/时长、发送、清空输入框。
- 资产生成页优化中，右侧全部禁用：比例、风格、模型、K 数、引用资产、优化、清空、输入框、参考图移除/点击、生成图片。
- 资产生成里没输入文字时，`清空输入框` 也禁用。
- 优化开始时会关闭已打开的 `@` 菜单和参数菜单。
- 新增通用 `LoadingSpinner`。用户给过参考 CSS：`radial-gradient + conic-gradient + mask` 的圆环，头部圆点，长渐变尾巴。当前颜色为 `#367cee`，后续所有通用 loading 优先复用它。
- 对话流输入框、资产生成输入框优化中会在中间显示 `LoadingSpinner`。

### 反推提示词

- 反推提示词时，预览页右侧整体禁用、变淡，中间显示通用 `LoadingSpinner`；复制、使用提示词、反推按钮不可点。
- 曾尝试让资产库外部缩略图也显示禁用和 loading，但实现和状态匹配不稳定，用户要求先去掉。当前反推中外部资产缩略图不显示 loading，也不禁用；只保留预览页右侧 loading。

### 预览页缩略图来源

- 从资产库打开图片时，预览页右侧缩略图只显示资产库当前分类/来源，不再混入对话流缩略图。
- 从对话流打开图片/视频时，预览页右侧缩略图仍显示当前对话流媒体。
- 注意：判断是不是资产库预览时只能用真实资产 `id`，不能用 URL。因为对话流图片可能已经自动入库，同 URL 会误判成资产库预览。

### 预览页缩略图分页和滚轮

- 缩略图列表已从自由滚动改成分页。当前页只渲染一屏缩略图。
- 鼠标滚轮只移动蓝色选中框，不移动缩略图列表。
- 当前页滚到最后一张后继续往下，才切换到下一页，并选中下一页第一张；当前页第一张继续往上，才切上一页，并选中上一页最后一张。
- 第一张继续往上不动，最后一张继续往下不动，不再首尾循环。
- 上下按钮也改成整页翻页，不再一点点 `scrollBy`。
- 缩略图整列都算缩略图区：上按钮、下按钮、缩略图之间空隙、列表区域滚轮都只用于上下选图，不会触发主图缩放。
- 预览缩略图已加分布式预加载。DOM 只渲染当前页；打开时预加载前两页；翻页后再预加载后两页；已预加载 URL 不重复加载；视频缩略图不额外预加载。

### 预览页尺寸和切图修复

- 用户反馈滚轮选图后主图大小异常、百分比显示不对、实际尺寸/适合尺寸按钮失效。核心原因是滚轮连续切图时图片加载时序和旧图状态容易串。
- 已处理：切图前重置 `fit`、scale、pan、naturalSize、fitScale；主图加 `key={id-url}` 强制重新挂载；`onLoad` 校验当前图，避免旧图加载回调覆盖当前图；缓存图片切换后主动读取 `naturalWidth/naturalHeight` 并重新计算适合比例。
- `适合尺寸` 不能只用 CSS `max-width/max-height`，因为它只能缩小不能放大 512 小图。当前已恢复为真实图片尺寸乘以 `previewFitScale` 渲染，512 小图也会按当前窗口适合比例放大。
- 点击已选中的缩略图第二次不再做任何事，避免触发重置导致异常放大。预览区、缩略图区和主图也拦截了双击默认行为。
- 左上 `实际尺寸` tooltip：`显示图片的实际尺寸`；`适合尺寸` tooltip：`显示适合屏幕的完整图片`。

### 本轮验证

- 多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning。
- `npm run build` 通过。

## 2026-05-27 本轮关键交接

### 本轮后续：分镜生成、资产生成并发和对话流优化按钮

- `资产生成 > 分镜图片` 已做实。入口为 `分镜生成`，打开角色/场景同款全屏页。生成成功写入 `资产生成 > 分镜图片`。
- 分镜生成核心规则：必须像电影/电视剧单帧截图。不要变成角色设定图、场景设定图、海报、漫画格、分镜表、拼贴图。禁止字幕、文字、Logo、水印、UI、二维码、边框、分割线、网格、多宫格、画中画、海报标题和说明标签。
- 分镜比例菜单显示 `竖屏分镜9:16 / 横屏分镜16:9`，默认 `竖屏分镜9:16`。
- 分镜图片新命名规则是简单递增：`分镜1 / 分镜2 / 分镜3...`。不要再对资产生成的分镜图片用 `无名剧01_分镜xx_1`。
- 资产生成顶部按钮已做实：`角色生成 / 场景生成 / 分镜生成` 点击后等同虚线入口；图标使用对应左侧分类图标，颜色已加深。
- 资产生成现在支持并发任务。点虚线框或顶部生成按钮永远打开新的生成页；只有点等待卡才回到对应任务。关闭生成页不停止任务。
- 任务卡必须占住原位置：生成中是通用蓝色动态等待卡；成功后原地变图片卡；失败后原地变失败卡。失败卡右上角可关闭，中间可点回失败页重试。重试同一失败任务时，失败卡要原地变等待卡。
- 成功任务卡要有普通资产卡能力：`@资产名`、右下三点菜单、重命名、移动到、删除。不要因为“任务卡成功分支”漏菜单。同 URL 的普通资产列表卡要隐藏，避免重复。
- 资产卡三点菜单要判断浏览器右边缘。靠右时一级菜单和 `移动到` 二级菜单都向左展开。
- 资产生成中允许关闭全屏页，绿色完成提醒层级为 `z-[9999]`，不能被全屏页挡住。
- 对话流图片/视频专业模式输入框上方新增 `优化提示词`。它在 `清空输入框` 前，同规格，两个按钮都为通用蓝色。优化模型兜底：`openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。
- 右上角使用量浮窗：`Token` 文案改为 `Tk`；美元/人民币改用 `money-dollar-circle-line` 和 `money-cny-circle-line` 图标；顶部按钮改为 `copper-diamond-line`，大小 `22px`。

### 本轮后续验证

- 多次 `npm run lint` 通过，只剩项目原有 `Unused eslint-disable directive` warning。
- 多次 `npm run build` 通过。

### 资产生成页

- 资产库生成页已从单一角色生成扩展为角色/场景共用生成框架。`资产生成 > 角色图片` 入口显示 `角色生成`，`资产生成 > 场景图片` 入口显示 `场景生成`。
- 角色生成和场景生成共用同一个全屏生成组件。右栏固定 `360px`，整体最小宽度 `920px`。关闭再打开会保留当前生成类型的提示词和上方参数选择，但清空生成结果、缩放、下载和菜单状态。
- 场景页曾错误显示角色图，已修：资产生成分类必须同时满足 `librarySource: "asset_generation"` 和当前 `type`。
- 场景生成比例菜单为 `单场景9:16 / 单场景16:9 / 四宫格16:9`。四宫格必须是同一场景四角度：正面、45度侧面、俯视、仰视。
- 场景生成核心规则是纯场景优先：绝对不能有人、人物、角色、人形、剪影、人群、脸、手脚；不能出现文字、Logo、水印、UI、二维码、边框、分割线、海报排版等。用户提示词里的人物要忽略。
- 资产生成输入框中的有效 `@资产` 会在提示词上方显示一行缩略图，和对话流输入框同风格；超出显示左右按钮和渐隐，点 `X` 移除对应 `@资产名`。
- 资产生成参数行：生成页不显示模型，只显示 `类型+比例 | 尺寸 + K数 | 风格`；资产预览页显示 `模型 | 类型+比例 | 尺寸 + K数 | 风格`。对话流参数显示不要改。
- 风格强绑定已做硬清洗。优化提示词返回后和最终生图前都会删除冲突风格词，并加菜单风格前缀。写实会清掉 Moebius、Jean Giraud、吉卜力、宫崎骏、皮克斯、2D、动漫、插画、3D、CG、虚幻、Blender、Octane、V-Ray 等；2D 和 3D 也会清理相反风格词。
- 资产生成 `优化提示词` 现在按模型兜底：`openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。`/api/chat` 已允许 `openai/gpt-5.5`。

### 资产预览和反推

- 图片/视频预览页右侧栏现在和资产生成页一样不随浏览器变窄消失。
- 上传图或对话流上传图没有生成参数时，预览页右侧参数行位置显示 `资产库上传` 或 `对话流上传`；提示词区显示 `暂无提示词`。
- 无提示词的图片预览会显示蓝底 `反推提示词` 按钮，图标 `RiQuillPenAiLine`。反推走 `/api/chat` 看图，模型顺序为 `openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。
- 反推成功后会把提示词写回当前资产的 `sourcePrompt`，预览页立即从 `暂无提示词` 变为反推结果。积分来源记为 `image_prompt_reverse / 图片反推提示词`。
- 预览页提示词标题栏新增无底复制图标按钮，位于 `使用提示词` 前面。复制成功显示灰色大对勾，失败显示红叉。

### 我的积分

- 我的积分表格第一列表头已改为 `积分消耗来源`，以图标 + 名称显示来源。普通对话用对话图标和历史对话名；角色图片生成、场景图片生成、分镜图片生成、图片反推提示词分别单独聚合。
- 新增来源标记写入 `CreditLedger.metadata.creditSource`：`character_image_generation`、`scene_image_generation`、`shot_image_generation`、`image_prompt_reverse`。旧流水没有该字段，无法可靠拆分，只能保留在原对话来源。
- 新增 `对话Token` 列。普通对话优先读 `UserWorkspaceState.state.sessions[].usageSummary.totalTokens`，没有再用 `CreditLedger.totalTokens`；没有则显示 `--`。
- 普通对话扣除积分也用工作区 `usageSummary.credits` 兜底，解决旧数据中右上角显示积分但积分表为 `-0` 的问题。新数据正常会同时写 `CreditLedger` 和 `usageSummary`，应保持一致。
- `图片` 和 `视频` 合并成 `图片/视频` 一列，显示 `22/0`、`9/--` 或 `--/--`。图片生成类来源视频为 0 显示 `--`；图片反推提示词图片/视频都显示 `--`。
- `最后活跃` 显示规则：24 小时内显示时分；超过 24 小时且同一年显示月日；超过一年只显示年份。该列宽度已压到 `72px` 且不换行，多余宽度给 `积分消耗来源`。
- 当前积分表列间临时显示浅灰竖线，是为了继续看列宽；如果用户确认列宽后可去掉。

### 本轮验证

- 本轮多次 `npm run lint` 通过，只剩项目原有 `Unused eslint-disable directive` warning。
- 本轮多次 `npm run build` 通过。

## 2026-05-26 本轮关键交接

### 本轮后续：角色生成做实和资产菜单调整

- `资产生成 > 角色图片` 的入口按钮文案已改为 `角色图片生成`。点击后打开真正全屏角色生成界面，不再是预览页顶部留空样式；右侧栏固定 `360px` 且始终显示。
- 右侧标题为 `RiAccountBoxLine + 角色图片生成`。重新打开生成界面时，只保留四个菜单上一次选择；输入框、生成结果、缩放、下载、`@` 菜单和优化状态全部清空。
- 角色输入框复用 `PlainMentionEditor`，支持蓝色 `@资产名`；顶部有蓝色无底按钮 `@ 引用资产 / 优化提示词 / 清空输入框`。生成中这些按钮、四个菜单、输入框、生成按钮、关闭按钮和遮罩关闭都禁用。
- 角色生成页 `@` 菜单已向左展开，宽 `380px`，右边对齐输入框；数据源按新资产库结构重做：`角色图片 / 场景图片 / 分镜图片` 只取 `asset_generation`，`对话流图片` 只取非 `asset_generation` 图片。不显示待分类、回收站和视频。
- 角色生成已接真实 `/api/image`；优化提示词已接 `/api/chat`。生成成功后图片留在当前生成页，不可点击进预览；顶部缩放、实际尺寸、适合尺寸、下载可用；成功图会写入 `资产生成 > 角色图片`。
- 角色生成内部规则不写回输入框。`单人9:16` 强制纯白背景、单人全身站立、头脚完整；`三视图16:9` 强制纯白背景和四视图角色参考。风格菜单强绑定，写实/2D/3D 互斥，用户提示词冲突时以菜单为准。
- 三视图按模型分 prompt：`GPT-5.4 Image 2` 和 `Gemini 3.1 Flash` 当前较可用；`Gemini 3 Pro` 与 `Seedream 4.5` 不稳定。`Seedream 4.5` 已改为纯正向描述，避免直接写 `不要分隔线/边框/网格/四宫格` 这类容易反向触发的词。
- 资产卡片删除后普通分类立即隐藏，只有回收站显示倒计时。右上角文件夹移动按钮已移除；图片资产的移动功能合并到右下角三点菜单，顺序为 `重命名 / 移动到 > / 删除`，只有悬停 `移动到` 才显示二级菜单。对话流视频和回收站资产没有 `移动到`。
- 本轮多次 `npm run lint` 通过，只剩项目原有 warning；角色生成做实后曾跑过 `npm run build` 通过。

### 首页和游客模式

- 首页右上角现在未登录只显示 `登录`；已登录显示 `进入工作台` + 用户头像。`进入工作台` 样式与登录按钮一致。
- 游客模式已经从代码入口移除。`/workspace?guest=1` 不再强制游客，`ChatWorkbench` 不再有 `forceGuestMode`。未登录或认证失败进入 `/workspace` 会回首页，不再读取本地游客 `localStorage`。
- `src/app/workspace/page.tsx` 设置为 `force-dynamic`，避免构建预渲染时触发 `window`。
- 后台旧占位 `游客模式开关` 已改成 `访问控制`。

### 资产库结构

- 主菜单 `资产管理` 已改为 `资产库`。点击资产库直接定位到 `资产生成 > 角色图片`，`全部资产` 页面已去掉。
- 左侧二级结构为：`资产生成`、`对话流资产`、`回收资产30天删除`。小标题前有圆点，所有数量列右对齐。
- `资产生成` 下有 `角色图片 / 场景图片 / 分镜图片`；`对话流资产` 下有 `对话流图片 / 对话流视频`；回收站共用。
- `AssetItem` 新增 `librarySource?: "asset_generation" | "conversation"`。旧资产和对话流产出默认属于对话流资产；资产库上传/后续资产生成属于资产生成。
- 对话流图片/视频后续命名规则：`image_随机5-10位数字`、`video_随机5-10位数字`。旧资产不批量重命名。
- 对话流视频没有右上角分类按钮。对话流图片可切到 `角色图片 / 场景图片 / 分镜图片 / 对话流图片`，会在资产生成和对话流资产之间移动。
- `对话流视频` 页面改为横向矩形卡片，大屏一行 4 个。

### 预览页和角色生成界面

- 所有媒体预览页点 `使用提示词` 后，会填入输入框、关闭预览页，并切回 `对话模式` 工作台。
- `资产生成 > 角色图片` 第一个卡片固定为虚线 `生成角色` 按钮，图标是 Remix `add-large-line`，下面文字 `生成角色`。没有内容时也必须显示，不要再让空状态挡住。
- 点击 `生成角色` 打开全屏生成界面，底和大小必须与媒体预览页一致：顶部留空、左侧毛玻璃生成区、右侧设置区。
- 左侧生成区当前为空白占位，不要虚线底框；左上缩放/尺寸按钮和右上下载按钮未生成前禁用。
- 右侧已改成竖版输入框式生成区，不再显示外部标题。右侧内容区左右边距是 `10px`，顶部控件、参数显示、提示词输入框和生成按钮都占满宽度。
- 右侧当前布局：第一行 `比例下拉` 占 2 格 + `风格下拉` 占 1 格；第二行 `模型下拉` 占 2 格 + `K 数下拉` 占 1 格；下面无底框参数行只显示 `比例 | 尺寸 + 分辨率图标`，不显示模型；再下面是角色提示词输入框和 `生成图片` 按钮。
- 比例下拉选项为 `单人9:16`、`三视图16:9`，带竖版/横版小图标。风格下拉选项为 `写实风格 / 2D风格 / 3D风格`。K 数下拉按当前角色生成模型支持项动态显示。
- 角色生成默认独立为 `GPT-5.4 Image 2` + `2K`，不跟随对话流输入框图片模型设置。角色生成里的 `4K` 不用金色显示，但对话流原有 4K 显示规则不变。
- 提示词输入框默认 1px 灰色描边，聚焦时淡蓝 `#c8dbff`，无阴影，圆角 `8px`。生成按钮当前 `h-12`，距输入框 `10px`，底部边距 `10px`。
- 新增 `.yinzao-character-option-active` 用于角色生成选中按钮蓝色边框，因为 `.yinzao-tool-button` 默认边框有 `!important`，普通 Tailwind `ring` 不会生效。
- 重要：角色生成界面当前仍只做 UI，占位没有接真实生成。下一步应在这个界面接 `/api/image`，生成成功后写入 `资产生成 > 角色图片`，显示在 `生成角色` 按钮后面。

### 资产预览参数

- 资产库点开图片预览时，已尝试通过 `sessionId / messageId / url` 反查原 assistant 消息补回 `previewMeta`。URL 匹配会去掉域名、query 和 hash 后再比对。
- 预览页渲染时也会再用 `enrichAssetPreviewMeta(previewAsset)` 兜底显示参数。如果旧资产已经找不到对应历史消息，只剩资产对象本身，参数仍可能无法恢复。
- 视频参数弹窗的 `非标` 显示保持原规则，只在 `尺寸（非标）` 标题处显示。不要再把 `（非标）` 加到尺寸行右侧 `PX` 后面，用户已明确要求去除。

### 本轮验证

- 本轮最终 `npm run lint` 和 `npm run build` 均通过。

## 2026-05-25 本轮关键交接

### 后台和积分流水

- 后台左侧五个大菜单已加图标，`积分管理` 图标和前台统一为 `RiVipDiamondLine`。
- 后台积分管理统计卡已改成 6 个：总积分、增加积分总数、消耗积分、消耗 Token、消耗美元、消耗人民币。增加积分绿色；消耗类红色，不显示负号。
- `CreditLedger` 新增 `direction` 字段，迁移为 `20260522143000_credit_ledger_direction`。迁移会给现有用户回填 `signup + increase` 流水，数值为当前余额加历史消耗。
- 注册送积分现在通过 `grantCredits()` 写 `direction: increase` 流水；模型扣费继续通过 `chargeCredits()` 写 `direction: consume`。
- 后台统计、用户详情消耗数据、前台 `/api/credits/me` 已按真实流水方向区分，注册送积分不会出现在前台消费记录里。

### 首页登录态和首页输入框

- 首页已读取前台登录态。已登录时右上角显示头像，未登录时显示 `登录`。
- 首页头像菜单包含用户信息、我的积分、帐号安全、设置、退出登录。点前四项会跳到 `/workspace` 并打开对应用户中心 tab，使用 `sessionStorage` key `flashmuse-workspace-user-dialog-v1`。
- 首页输入框已做实。空输入发送：已登录直接进工作台，未登录弹登录框。有输入发送：已登录把内容写入 `sessionStorage` key `flashmuse-home-prompt-v1`，工作台加载后新建对话并按 Agent 自动发送；未登录弹登录框，登录后进入工作台并消费该 prompt。

### 拖拽上传和附件显示

- 工作台右侧对话流支持拖拽上传。拖拽文件未松开时显示白色半透明遮罩、背景模糊、虚线框、中间 `在此处拖放文件` 和支持文件类型提示。
- 拖拽覆盖层中间图标最终为绿色正圆 2px 描边 + `arrow-down-fill`，颜色 `#75d06a`。用户已要求去掉跟随鼠标的小白框。
- 支持格式当前为：图片、`pdf, txt, csv, docx, doc, xlsx, xls, pptx, ppt, md`。`mobi / epub` 已删除。图片上限 `10` 张；文件上限 `8` 个。
- 输入框附件区：文档单独一行在上，图片单独一行在下，两种可同时存在。行超出时显示左右按钮，滚动条隐藏，左右边缘渐隐。
- 输入框图片缩略图统一为 `80x80px`，不再区分普通上传图和 `@资产` 图。
- 文档卡片尺寸约 `200x54`，右上角有关闭按钮。左侧类型标为淡色底、2px 描边、3px 圆角正方形字母卡；Word/PPT/Excel/PDF/Markdown/txt 各自颜色，底部显示类型和大小。
- 发送后的用户消息附件显示已同步：文档在文字下方第一行，图片在文档下方第二行，图片为 `80x80px`。如果用户没有输入文字只上传附件，不再显示“请分析这张图片，并告诉我可以怎么继续创作。”这句；它只作为内部 Agent prompt。

### @ 引用排查结论

- 本轮用户反馈 `@` 参考图生成跑偏。已确认 `@` 没失效：日志显示 `/api/image` 收到参考图，`reference_count` 正常，本地 `/generated/upload_image/...` 文件存在。
- `src/lib/openrouter.ts` 已加调试日志，只打印参考图数量、类型、本地文件是否存在，不打印 base64 内容。
- 当前跑偏主要是模型能力问题：Seedream 4.5 对多参考图、人物四视图拼图 + 场景图 + 新构图/第一人称视角的组合不稳定。用户要求 `@` 问题先放一放，不要优先继续处理。

### 文档读取解析 + Agent 激活

- 已完成第一版。`.md / .txt / .csv` 会前端读取文本，发送 Agent 时把文本带给 `/api/agent-plan` 和 `/api/chat`。只上传文档也能发送；读取中会提示 `文件读取中`。`pdf / docx / xlsx / pptx` 当前仍只展示，不解析。
- 文件卡片现在不显示 `已读取` 文案，统一显示 `文档类型 · 文件大小`；读取中仅保留底部细进度条。输入框里的文件卡片和发送后的用户消息文件卡片都可点击预览。
- Agent 激活规则已调整：如果文档像智能体规则/工作流说明，用户说“激活这个智能体”时，回复应类似 `POV互动影游导演系统已激活`，但排版要接近普通长回复，使用标题、短段、分隔线、短列表，不要强制罗列过多规则，也不要把大量规则塞进同一个 bullet。激活类回复首行前图标为 `terminal-window-fill`。
- 右侧文档预览已做实：`.md` 用轻量 Markdown 渲染，`.txt/.csv` 保留换行；未解析格式提示暂不支持。标题栏有复制全文、下载文档、关闭按钮；复制成功显示对勾。文档预览与对话流并列，默认 `5:4`，中间分隔线可拖动。
- 正式部署时，文档原件应存对象存储 + CDN；Agent 不应每次直接读 CDN 原件，而是读服务端解析后的文本/分块内容。后续可把解析文本入库，再做关键词或向量检索。

### 本轮后续：滚动条和用户中心积分页

- 全局滚动条已改为默认透明隐藏，滚动时显示原灰色滚动条，停止 `2秒` 后隐藏。原先隐藏滚动条的附件条、缩略图区继续永不显示。左侧历史/工作流列表鼠标移入也显示滚动条。
- 用户中心右侧标题和关闭按钮统一在同一行，关闭按钮放大并改为圆角矩形底；右侧头部和内容整体下移。左下角 `个人免费版` 按钮可打开 `我的积分`。
- 我的积分页新增免费套餐概览卡。左侧显示 `免费套餐`、`个人免费版 + leaf-line`、说明 `当前为免费版本，暂无升级套餐功能。如有疑问请联系管理员！`；右侧显示真实 `总积分` 和灰色 `已赠送积分`。
- `/api/credits/me` 返回 `giftedCredits`，统计 `CreditLedger.direction = "increase"`。后续后台手动加分只要写增加流水，就会显示在 `已赠送积分`。新增 `/api/credits/conversation-title`，对话重命名会同步更新积分流水标题；删除对话不删除流水。
- 我的积分表格圆角为 `5px`；分页按钮无边框，hover 灰底，带左右箭头，禁用态淡化。

### 本轮验证

- 本轮多次 `npm run lint` 和 `npm run build` 均通过。
- 新增 Prisma 迁移已执行 `npx prisma migrate deploy`，`npx prisma generate` 通过。期间曾停止端口 `3000` 的 Node 进程解决 Windows DLL 占用，接手时如页面未运行需重启 dev server。

## 2026-05-22 本轮关键交接

### 积分系统第一版

- 用户要求先做完整积分系统，范围包含规则、前端、后台。本轮已实现第一版可用闭环。
- 新增数据库表 `CreditSetting` 和 `CreditLedger`，迁移为 `20260522120000_credit_system`。已执行 `npx prisma migrate deploy` 和 `npx prisma generate`。
- `CreditSetting` 保存后台可调配置：美元汇率、`1人民币=多少积分`、注册送积分、是否扣文本/规划积分、是否扣图片积分、是否扣视频积分。默认汇率 `7.2`、兑换比 `10`、注册送 `1500`、三类扣分都开启。
- `CreditLedger` 保存每次扣费流水：用户、对话 ID、对话标题、请求 ID、类型、标签、模型、扣除积分、Token、美元、人民币、图片数量、视频数量、元数据、时间。`requestId + kind` 唯一，防止同一请求重复扣同类费用。
- 积分换算规则：OpenRouter 返回美元费用 -> 后台汇率换算人民币 -> 按 `creditsPerCny` 换算积分。积分永远是整数，扣除用四舍五入。不要再用向上取整。
- 扣分时机：成功后扣，失败不扣。`/api/agent-plan` 和 `/api/chat` 成功后扣文本/规划；`/api/image` 成功后扣图片；`/api/video` 创建任务不立即扣，轮询成功拿到视频地址后扣视频。视频创建时如返回 usage，会暂存在前端轮询请求里，成功时一起用于扣分。
- 余额规则：积分为 `0` 时不能调用模型；积分大于 `0` 时允许最后一次任务，即使不够也能生成，最多扣到 `0`，不会出现负分。
- 注册送积分现在读取 `CreditSetting.signupCredits`，涉及前台验证码注册和后台验证码创建管理员用户。
- 游客模式没有登录用户，当前不会写数据库扣分。后续如要游客扣分，需要先决定游客账户或本地积分规则。
- 前端左下角积分卡显示真实 `User.credits`，扣分接口返回 `credit.balance` 后会立即刷新。`/api/auth/me` 和 `/api/user-profile` 已返回 `credits`。
- 右上角当前会话使用量浮窗新增积分显示，只显示积分图标和数值，不写“积分”二字。`usageSummary` 已新增 `credits` 字段。
- 用户菜单新增 `我的积分`，用户中心左侧也新增 `我的积分` 页。右侧显示 `我的积分：xxxx`，下面表格按历史对话聚合显示对话名称、扣分红字、图片数、视频数、最后活跃时间，支持分页。
- 新增 `/api/credits/me` 给前端我的积分页使用。
- 后台 `积分管理` 页面已做实，新增 `src/app/admin/admin-credits-panel.tsx`。可改汇率、兑换比、注册送积分和三类扣费开关；统计卡显示总扣积分、总 Token、总美元、总人民币；下面列表按对话流聚合显示。
- 后台积分列表默认不展开，末尾有三角，点整行或三角都能展开；展开后明细按文本规划/回复、图片批次、视频任务分开显示。
- 后台积分保存必须走 `/admin/api/credits`，不要只用 `/api/admin/credits`。原因是后台 Cookie `flashmuse-admin-session` 的 path 是 `/admin`，请求 `/api/admin/credits` 时浏览器不会带 Cookie，会导致保存失败刷新回旧值。
- 美元汇率输入要求：支持小数点后两位；输入 `7` 失焦显示 `7.00`；输入 `7.` 时不能被吞掉。当前已用文本输入正则限制实现。

### 本轮后台 UI 细调

- 后台左侧栏改为固定在浏览器视口内，当前管理员块固定在左侧底部，页面滚动时不会消失。
- 用户管理和积分管理顶部搜索框统一为右侧搜索图标，输入文本居左、图标居右。
- 用户管理列表现在点整行也能展开/收起，右侧三角仍能展开/收起，并阻止冒泡避免重复触发。
- 积分管理大列表圆角改为和用户管理一致的 `10px`，默认不展开，最后一列是展开三角。
- 用户详情展开区里 `历史对话 / 生成图片 / 生成视频` 三个可点击字段名用下划线标识，右侧数值不加下划线、不变蓝。
- 后台历史对话弹窗、生成图片弹窗、生成视频弹窗的顶部标题栏已改为跨整个弹窗宽度。左右内容区都在标题栏下方，不再出现标题栏只在左侧或右侧的问题。

### Agent 回复清洗

- Agent 的结构化 JSON 回复曾把 `\n\n` 当普通字符显示。现已在 `src/lib/openrouter.ts` 清洗 `content/displayText/clarifyQuestion/prompt/items/constraints/suggestions` 中的字面 `\n / \t / \"` 和 JSON 代码块残留。
- 短开场回复会合并成一段，例如 `在，我在。\n\n如果你愿意...` 会显示为一段。长回答、列表、剧本、分镜和知识讲解仍允许换行。
- 前端和后台历史渲染也加了旧消息兜底，旧历史里的字面 `\n` 不应再直接露出来。
- 本轮验证多次通过 `npm run lint` 和 `npm run build`。`npx prisma generate` 曾因 Windows DLL 被端口 `3000` dev server 占用失败，已停止端口 `3000` 的 Node 进程后成功；接手时如果页面没运行，需要重新启动 dev server。

## 2026-05-21 本轮关键交接

### 后台用户管理页

- 用户要求后台用户管理不要放在概览下面，而是点左侧 `用户管理` 后进入实际页面。现在 `/admin` 是概览，`/admin?tab=users` 是用户管理，其他分类也用 `tab` 切换。
- 概览已恢复为最初样子：四个统计卡 + 三个占位卡。用户管理表不再出现在概览里。
- 后台分类页 UI 统一为：顶部只有大标题，标题下面不再显示小灰字说明；下面是内容区。用户后续明确说小 UI 调整不需要确认，直接改；功能逻辑、接口、数据结构或较大改动再确认。
- 用户管理页顶部右侧有短搜索框和状态筛选。搜索框左侧为放大镜图标，提示为 `ID / 邮箱 / 昵称 / 手机`。筛选为 `全部 / 正常 / 已禁用`。
- 用户管理统计卡一排显示总用户、今日新增、正常用户、禁用用户、总积分余额。该排卡片高度已压缩，数字较小但加粗，上下内边距为 `10px`，外部上下间距也降低。
- 用户列表每页 `10` 条。分页条只保留文字和按钮，外层白底/边框/阴影已去除。
- 用户列表外框圆角为 `10px`。列表固定最小宽度 `1180px`，后台整体最小宽度 `1464px`，浏览器变窄时表格不再继续压缩。内部 `overflow-x-auto` 已去掉。
- 用户列表主行字段顺序：用户ID、用户（头像、账号、昵称）、积分 + 调积分、最近登录 IP / 归属地、最近登录时间、状态 + 禁用/启用、三角展开。
- `查看` 按钮已去除。`调积分` 按钮跟在积分后，`禁用/启用` 按钮跟在状态后。
- 最近登录 IP / 归属地目前没有真实字段，统一显示 `待接入 / 待接入`。后续做真实登录 IP 时建议扩展 `Session` 表，新增 `ipAddress / ipCountry / ipRegion / ipCity / userAgent`。
- 点击三角会在该用户行下方展开隐藏块，显示账号信息、使用数据、登录和工作区。包括手机号、语言、密码状态、注册时间、资料更新时间、生成图片/视频数、用户开关、Session 数、最近 Session 活跃、工作区是否保存等。
- 后台测试数据已插入 100 个假用户，邮箱 `testuser001@flashmuse.test` 到 `testuser100@flashmuse.test`。假用户没有头像时，后台头像统一显示 `?`。

### 本轮后续：后台用户详情、历史对话和媒体预览

- 用户管理主行文案继续细调：表头 `最后登录` 改为 `最后登录时间`；状态筛选和状态标签里的 `已禁用` 改为 `禁用`。
- 假用户现在会显示模拟 `最近登录 IP / 归属地`，按 `testuser001` 这类序号稳定生成；真实用户仍显示 `待接入 / 待接入`。这只是为了测试后台列宽，不是真实登录 IP。
- 展开区已从三列白色卡片改成四列灰底横条。小标题全部去除；白色圆角底框去除；每条为直角灰底框，名称居左、值居右，条目之间 `1px`，四列间距 `5px`。
- 展开区字段当前顺序：第一列为登录帐号、昵称、手机号、密码、语言、注册时间、资料更新时间；第二列为最近登录 IP、最近登录归属地、Session 数、Session 活跃、生成完成提醒、自动收入资产库、预览滚轮；第三列为历史对话、生成图片、生成视频、工作区保存；第四列为积分、已消耗积分、已消耗Token、已消耗金额。
- `Session 数` 的含义已向用户解释：它是数据库里当前保留的登录态数量，不等于历史对话数，也不等于总登录次数。用户觉得普通后台意义不大，暂时放到第二列技术数据区。`最近 Session 活跃` 文案已改成 `Session 活跃`。
- `工作区保存` 只显示最后保存时间，去掉 `已保存，` 前缀；没有工作区时仍显示 `未保存`。
- `生成图片 / 生成视频` 数量现在优先从 `UserWorkspaceState.state` 里的实际 assistant 媒体消息统计，避免数据库字段尚未自动累计时后台显示 0。`已消耗Token / 已消耗金额` 也从每个会话 `usageSummary` 汇总。`已消耗积分` 目前只是 `1500 - 当前积分`。
- `历史对话` 条目可点击。弹窗大小约 `1180px × 820px`，圆角 `10px`，左侧为历史会话列表，左上写 `XXX历史对话`，右侧显示只读对话内容，没有输入框。左侧滚动条贴边，但选中灰底不贴右边；未选中项不显示时间且高度更低，选中项显示时间并用 `#ececec` 灰底。
- 历史对话弹窗中的 AI 文案会渲染轻量 Markdown：`# / ## / ###` 标题、`**加粗**`、`---` 分隔线、`-` 和数字列表，不再把 Markdown 符号直接露给用户。用户消息保持右侧灰底气泡。
- `生成图片` 和 `生成视频` 条目可点击。媒体弹窗尺寸与历史对话弹窗一致，但左右互换：左侧大区域预览当前图片或视频，右侧是缩略图列表。底部参数按工作台媒体结果格式显示：提示词一行，下面 `模型 | 比例 | 尺寸 + 分辨率图标 | 时长`。图片 `4K` 会显示金色 `超清4K`，视频图标为黑底 `SD / HD / FHD / 4K`。
- 后台登录页新增历史邮箱下拉，key 为 `flashmuse-admin-login-history-v1`，最多 5 条；登录成功后保存后台邮箱，点击邮箱输入框可选历史账号。不要和前台 `flashmuse-login-history-v1` 混用。
- 本轮验证：`npm run lint` 和 `npm run build` 均通过。

### 用户 ID 和用户中心

- 用户 ID 规则已改为 `ID_六位随机数字`，例如 `ID_178523`。用户明确要求 ID 唯一、不重复、注册时产生、不可更改，并且后续可通过 ID 搜索用户。
- `User.id` 在 `prisma/schema.prisma` 中已取消 `@default(cuid())`，现在由代码生成。`src/lib/auth.ts` 新增 `generateUserId()`，使用 `crypto.randomInt(100000, 1000000)` 生成，并检查数据库去重。
- 前台验证码注册和后台验证码创建管理员用户都已改为写入 `id: await generateUserId()`。涉及 `/api/auth/verify-code` 和 `/api/admin/verify-code`。
- 本地已有 102 个用户已迁移为 `ID_` 格式。此前先改过 `ID.`，后来按用户要求改为下划线。当前数据库里 `ID.` 格式剩余为 0。
- 用户管理搜索已支持按用户 ID 搜索。
- 用户中心头像下方现在显示用户 ID，只显示原始值如 `ID_779117`，不加 `ID：` 前缀；字号最后调到 `14px`，颜色稍深。
- `/api/auth/me` 和 `/api/user-profile` 返回用户资料时现在带 `id`。`CurrentUserProfile` 类型也已加 `id?: string`。
- 用户昵称上限已统一为 8 个字。用户中心输入时最多 8 个字符，保存时前端和后端都会截断到 8。
- 本轮因 `npx prisma generate` 遇到 Windows Prisma DLL 被 dev server 占用，已停止端口 3000 的 Node 进程后重试成功。接手时如果页面没运行，需要重新启动 dev server。
- 本轮验证：多次 `npm run lint` 和 `npm run build` 均通过。

## 2026-05-20 本轮关键交接

### 左下角积分占位、后台和管理员登录

- 用户要求先做后台第一版，后台应是独立页面，入口为 `/admin`，不放在首页导航里。部署到服务器后第一版建议继续用同域名路径如 `https://域名/admin`，不是另起项目。
- `/admin` 已完成第一版骨架，浏览器标题为 `闪念后台 Management`。根目录新增 `start-admin.bat`，会启动/复用 dev server 并打开 `http://localhost:3000/admin`。
- 后台登录页是白底居中卡片，标题为 Logo + `闪念后台` 居中，Logo `30px`。登录支持密码和验证码。管理员账号没有设置密码时，用验证码登录。
- 后台白名单用 `.env` 的 `ADMIN_EMAILS`，`.env.example` 已新增同名变量。本地 `.env` 已按用户要求加入管理员邮箱；`.env` 不提交，不要在文档或回复中泄露其它环境变量。
- 后台最初复用了前台 `flashmuse-session`，用户指出“后台要么不要加 cookie”。最终改成独立后台 Cookie：`flashmuse-admin-session`，只作用 `/admin`，8 小时有效。后台登录/退出不会影响前台工作台账号。
- 后台专用接口已新增：`/api/admin/send-code`、`/api/admin/verify-code`、`/api/admin/login-password`、`/api/admin/logout`。这些接口都先检查邮箱是否在 `ADMIN_EMAILS` 白名单中。
- 后台第一版真实数据：概览读真实用户数、今日新增、图片数、视频数、积分余额；用户表读最近 50 个 `User`。积分管理、生成记录、系统设置仍是占位，后续要继续做实。
- Prisma 已新增 `User.credits` 默认 `1500` 和 `User.disabled` 默认 `false`，迁移为 `20260520120000_admin_credits_fields`。注意 `credits` 现在只是用户字段和后台展示，未接生成扣费或积分流水。
- 后台左侧栏底部显示当前管理员邮箱，白底 `退出后台` 按钮只清后台 Cookie，不清前台登录态。
- 工作台左下角用户区新增积分占位卡，显示 `RiVipDiamondLine + 积分：1,500` 和 `RiVipCrown2Line + 个人免费版`。第二行米色底，图标/文字用米色底加深色 `#9b8460`。
- 左下角用户区已多轮微调：底部模块 `min-h-[148px]`，积分卡和头像整体上下居中；头像 hover 灰底 `h-11`；分隔线向上移 `6px`；背景遮罩阻止历史文字从分隔线下透出。
- 左下角头像菜单现在从头像上方弹出，可压住积分块，位置为 `bottom-[60px]`、`left-[calc(50%-1px)]`。
- 用户中心头像上传按钮图标已居中：删除了相机图标上的 `translate-x-px -translate-y-px`。
- 设置图标统一使用 `RiSettingsLine`，不要再用 `RiSettings3Line`。
- 本轮最终验证：`npm run lint` 和 `npm run build` 均通过。

### 游客模式、登录入口和本地数据

- 用户明确要求：后续工作说明必须用中文，不要用英文工作描述，回答继续简单直接。
- 首页测试入口已从 `进入工作台` 改为 `游客模式`，链接为 `/workspace?guest=1`。该入口永远强制游客模式，读取浏览器 `localStorage`，不管当前是否有登录态。邮箱登录成功仍跳 `/workspace`，走数据库用户工作区。上线时隐藏/删除 `游客模式` 按钮即可。
- 工作台加载失败兜底已改安全：认证接口或数据库异常时优先读取本机游客数据，避免空会话覆盖 `yinzao-sessions-v2`。本轮用户检查浏览器控制台发现 `yinzao-sessions-v2` 已只剩一条空 `新对话`，旧游客历史无法从当前 key 恢复。
- `游客模式` 和 `登录` 按钮 UI 已统一：高度 `h-9`，字号 `13px` 写在内部 `span`。
- 登录抽屉新增最近登录邮箱菜单：数据存在 `localStorage` 的 `flashmuse-login-history-v1`，最多 5 条。点击邮箱输入框弹出菜单，点邮箱填入并收起；自己输入、点抽屉其它区域或点菜单外都会收起。菜单无标题、无外层灰底，竖排，最高 `250px`，超出滚动。
- 登录发送验证码文案要区分来源：用户主动选验证码登录显示 `正在发送验证码...`；系统自动判断首次登录/未设置密码时显示 `首次登录或未设置密码，正在发送验证码...`。不要重复显示两份“正在发送验证码”。

### 用户中心设置最新状态

- `图片/视频生成完成提醒` 已做实，默认开启。任意会话生成图片或视频完成时，当前页面顶部显示绿色提醒 `图片生成已完成` 或 `视频生成已完成`，不管用户当前在哪个会话。关闭开关后不显示。每一批任务只提醒一次。
- `生成图片/视频自动收入资产管理库` 已做实，默认开启。关闭时，生成图片/视频不会自动写入资产库，但生成文件仍保留，对话流里仍显示，预览、下载、重生成不受影响。内部沿用 `autoSaveHistory` 字段。
- `本地缓存` 设置项已删除。用户生成图片、视频、对话和资产都属于用户数据，不应作为缓存自动清理；只有用户主动删除才删。
- 预览页新增两个设置，默认都开启且不互斥：`预览页鼠标放在图片上滚轮有缩放功能`、`预览页鼠标放在缩略图区域滚轮有翻页功能`。主预览区滚轮缩放图片，缩略图区域滚轮切上一张/下一张；视频主预览区不缩放，但缩略图区可切换视频。
- 预览滚轮设置新增用户资料字段 `previewWheelZoom / previewWheelFlip`，已执行迁移 `20260520074200_preview_wheel_settings` 和 `20260520081205_preview_wheel_zoom_default_on`。如果 `npx prisma generate` 报 DLL 被占用，停掉端口 3000 的 Node 进程再执行。
- 设置页图标必须使用官方 Remix Icon 导出：`RiNotification2Line`、`RiZoomInLine`、`RiArrowUpDownLine`。本轮曾手写 SVG，后已替换成官方 `react-icons/ri` 导出。

### Agent、预览页、图片失败和思考动画

- 图片多图失败兜底已修。平台已返回 500 或无图时，不应留下 `99%生成中` 等待卡。现在批次收尾会清零 `pendingImageCount`，剩余等待卡补成 `图片生成失败`，红字显示真实错误。
- `正在认真思考` 前置动画改为轻量 3x3 `GridLoader`，尺寸 `16px`，左侧历史运行中也用它。文字和后三个点动画改成灰白，不再有蓝色；文字 `3.2s`，三点 `2.1s`。`GridLoader` 支持 `prefers-reduced-motion`。
- Agent 正文列表标签中的 `**加粗**` 已修，不再露出星号。例如 `- **阿宁**：...` 会正常显示为加粗标签。
- Agent 自动生图/生视频结果下方已恢复引导按钮。优先用 Planner 的 `suggestions`，没有则用前端兜底建议；专业图片/视频模式仍不显示引导。
- 预览页缩略图导航改为只看当前对话内媒体总数：图片+视频超过 1 个就显示，不区分 Agent 或专业模式，也不区分图片或视频。条件是 `> 1`，不是旧的 `> 2`。

### 本轮验证

- 本轮相关改动后多次运行 `npm run lint` 和 `npm run build` 均通过。

## 2026-05-19 本轮关键交接

### 本轮后续：登录细节、用户中心遮罩、新对话快捷入口和思考动画

- 用户要求“后面回答简单直接”，本轮已按这个风格沟通。
- 登录抽屉规则最新版本：默认停在 `密码登录`，邮箱回车后检查账号是否有密码；无密码或新账号自动切验证码。用户如果主动点了 `验证码登录`，邮箱回车直接发送验证码，不再检查有没有密码。
- 验证码发送中 UI：验证码登录提交邮箱后，邮箱输入框下方显示蓝色 `正在发送验证码...`，三个点逐个出现/消失。发送成功后进入 6 个验证码输入框。
- 登录邮箱 placeholder 最新为 `请输入邮箱，如 name@email.com`。邮箱、密码、验证码输入框只要继续编辑或删空，旧的红字错误/灰字提示都要立刻消失。
- 邮箱有效性不能只靠前端正则。`/api/auth/send-code` 现在会校验邮箱域名是否能收邮件：先查 MX，失败再查 A/AAAA。明显不存在的域名不发验证码，用户看到 `邮箱或域名不存在，请检查后重新输入`。
- 登录验证码 6 个输入框圆角为 `12px`。
- 默认头像最新规则：没有上传头像时，按邮箱生成淡色圆形头像和首字符，并加 `1px` 比底色稍深的描边；上传头像不加这圈默认描边。
- 用户中心弹窗遮罩最新规则：黑色半透明底保留，同时底层工作台内容要模糊显示。当前外层使用 `bg-black/46` + `backdrop-blur-[6px]`。
- 新对话空白页最新标题为 `hi~把你的闪念跟我聊一聊！`。
- 新对话空白页快捷按钮规则：固定三行，每行 `3-5` 个；每行上下对齐，列可以不齐；每个新对话按会话 ID 打散，按钮内容和行数量组合会变化。按钮为淡彩色随机底、无描边，文字 `13px` 必须写在内部 `span` 上，避免全局 `button { font: inherit; }` 覆盖。
- 快捷按钮点击后不进入输入框，而是先把底部模式切为 `Agent 模式`，再直接作为 Agent 消息发送。快捷按钮内容包括生图、生视频、故事梗概、文字分镜、提示词扩写、角色小传、场景参考图等。
- `正在认真思考` 动画已放慢：文字走光 `2.4s`，三个点动画 `1.45s`。
- 本轮验证：多次 `npm run lint` 通过；邮箱域名校验加入后也跑过 `npm run build` 通过。

### 登录、数据库、邮箱验证码和账号工作区

本轮用户把登录系统从占位推进到可用版本，必须记住：

- 首页右上 `登录` 已是邮箱登录入口；首页 `进入工作台` 仍然直接进 `/workspace`，作为游客/本机测试入口，继续显示当前浏览器 localStorage 里的旧内容。
- 邮箱登录入口按用户规则执行：用户可切换 `密码登录 / 验证码登录`。默认 `密码登录` 下邮箱回车后先查是否注册和是否有密码；未注册直接走验证码登录，验证码登录成功即注册；已注册但没有设置密码也继续走验证码登录；已设置密码才可密码登录。用户主动选择 `验证码登录` 后，邮箱回车直接发验证码，不再查密码状态。
- 登录抽屉 UI 细节：登录方式文字是内部 `span` 写 `13px`，因为全局 `button { font: inherit; }` 会覆盖按钮字号；邮箱/密码输入框文字为 `16px`；邮箱 placeholder 为 `请输入邮箱，如 name@email.com`。
- 数据库已接入 `PostgreSQL + Prisma`，本机通过 Docker Desktop / WSL2 跑 `flashmuse-postgres`。如果 Docker 没启动，登录接口会 500，前端显示“请求失败”。恢复步骤：启动 Docker Desktop -> `docker compose up -d`。
- 数据库表当前为 `User`、`Session`、`EmailVerificationCode`、`UserWorkspaceState`。其中 `UserWorkspaceState.state` 是整份工作区 JSON，不是细表。
- 当前数据库已保存过用户 `12424740@qq.com`，当时查到有 1 个用户、1 个 session、若干验证码记录和 1 个 workspace。以后实际数据以数据库查询为准。
- SMTP 邮箱验证码已接通网易个人邮箱。敏感资料在 `AI-Video-Assistant_Project Planning\闪念官方邮箱.txt`，本地 `.env` 已写 SMTP 配置；不要在回复或提交里泄露授权码。`src/lib/mailer.ts` 使用 `nodemailer`，SMTP 未配置时回退终端打印验证码。
- 工作台用户菜单已改成 `用户信息 / 帐号安全 / 设置 / 退出登录`。`用户信息 / 帐号安全 / 设置` 三项打开同一个用户中心弹窗；弹窗参考用户给的设置页截图，白色大圆角、左侧选项卡、右侧内容。
- 用户中心内容：`用户信息` 显示头像、邮箱、积分、生成图片数、生成视频数、已使用积分，当前都是占位统计；`帐号安全` 支持设置密码和修改密码；`设置` 当前放语言、默认进入页面、生成完成提醒、自动保存历史、本地缓存、版本信息等占位。
- 新增认证接口：`/api/auth/check-email`、`/api/auth/send-code`、`/api/auth/verify-code`、`/api/auth/login-password`、`/api/auth/me`、`/api/auth/logout`、`/api/auth/set-password`、`/api/auth/change-password`。
- 新增工作区接口：`/api/workspace-state`，登录用户 `GET` 读取工作区 JSON，`PUT` 保存工作区 JSON。
- 工作台加载逻辑很重要：先请求 `/api/auth/me`。如果有登录用户，读取数据库 `/api/workspace-state`，新账号为空；如果没有登录用户，读取原浏览器 localStorage。工作台保存逻辑同样分流：登录用户写数据库，游客写 localStorage。
- 后续正式化建议：当前 `UserWorkspaceState.state` 是 JSON 快速方案，便于先做到账号隔离和跨设备保存；正式上线后如果要后台管理、搜索、统计、积分扣费，应拆成 `Conversation / Message / Asset / GenerationJob / CreditLedger` 等独立表。
- 本轮验证：`npx prisma migrate dev --name user_workspace_state` 已应用；`npx prisma generate` 曾因 dev 进程锁 DLL 失败，停掉 Node 后成功；`npm run lint` 和 `npm run build` 均通过。

### 用户中心、资料独立字段、语言切换和登录 UI 细节

- 用户要求用户中心按上线标准处理。已把用户中心资料从 `UserWorkspaceState.state` 拆出到 `User` 独立字段：`nickname / phone / avatarUrl / language / notifyOnGenerationComplete / autoSaveHistory / generatedImageCount / generatedVideoCount`。迁移名为 `20260519132218_user_profile_fields`。
- 新增 `/api/user-profile`。前端修改昵称、手机、头像、语言和开关时，使用 500ms debounce 调该接口保存。`/api/auth/me` 返回完整用户资料。`/api/workspace-state` 只保存会话、资产、工作流、输入设置、反馈、纠错记忆等工作台状态，并会迁移旧 JSON 中的用户资料字段。
- 头像文件独立目录为 `public/generated/user_avatar/`，上传接口 `/api/upload-avatar`。普通上传图仍保存到 `public/generated/upload_image/`。数据库只保存头像 URL，不保存图片二进制。用户问过为什么目录没创建，最终发现头像/普通上传接口曾写反，已修复。
- 默认头像规则：按邮箱 hash 生成稳定淡色背景，圆形内显示邮箱首字符。上传头像后左下角用户区和用户中心大头像都显示上传图。左下角用户区第一行显示昵称，第二行显示邮箱；昵称编辑后同步更新。
- 用户信息页现在是头像居中，下方 490px 灰底信息行：昵称、邮箱（登录帐号）、手机、生成图片、生成视频。昵称/手机右侧有 `edit-box-line` 图标可编辑。生成图片/视频计数字段已建，但还没接生成成功自动累加。
- 帐号安全页已按用户要求重做。已设置密码时只显示灰底行 `锁图标 + ***********`，右侧灰字 `密码已设置`，下方无底蓝色文字按钮 `修改密码 / 忘记密码`。修改密码显示当前密码、新密码、确认密码；忘记密码发送当前登录邮箱验证码，显示 6 个 44x44 方形验证码框，输入满 6 位自动验证，验证通过进入重设密码界面。
- 密码设置/修改成功不在页面内显示绿色文字，而是在用户中心弹窗上方外侧显示提醒消息。用户中心提醒停留时间为 3 秒。验证码发送提示为黑框，文案 `验证码已发送到您当前登录的邮箱中`。
- 设置页：`语言` 已做实，支持 `简体中文 / 繁體中文`；语言菜单中的语言名称永远用自身语言显示，不随当前界面转换。`生成完成提醒 / 自动保存历史` 改为通用蓝滑块按钮；`默认进入页面` 已移除；版本信息为 `v0.1.0 内测版`。
- 简繁切换当前用全局前端 DOM 转换层实现。选择繁体后工作台中文、placeholder、title、aria-label、alt 会转换；输入框、textarea、contenteditable、script/style 和 `data-no-translate="true"` 不转换。切回简体会反向转换。曾因 MutationObserver 重复写入导致页面不可点击，已加防重复写入保护；曾因用户中心新渲染文字切回简体不同步，已加反向转换兜底。
- 首页登录抽屉默认优先 `密码登录`。用户未主动点验证码登录时，邮箱回车后先查账号是否有密码；有密码进入密码输入，无密码/新账号自动切验证码登录。邮箱输入框有内容时右侧显示 `corner-down-left-line` 图标，点击等同回车；密码输入框不显示该图标，仍用下方登录按钮。
- 本轮最终验证：`npx prisma migrate dev --name user_profile_fields` 成功；`npx prisma generate` 成功；`npm run lint` 和 `npm run build` 均通过。注意生成 Prisma Client 时 Windows 可能因 dev server 占用 DLL 报 `EPERM`，需停掉端口 3000 的 Node 进程后再 `npx prisma generate`。

## 2026-05-18 本轮关键交接

### 首页、登录抽屉和工作台用户菜单补充

本轮后半段主要在细抠首页和工作台左侧栏，必须记住：

- 首页已经从“大标题 + 说明 + CTA”改成更极简的结构：左上 Logo，右上 `进入工作台` 临时按钮和 `登录` 按钮，中间是广告语和展示版输入框。
- 首页广告语当前是 `方寸之间 · 大有可为`，下面英文是 `Small Space Big Ideas`。中文使用现代中文无衬线字体栈，字号 `100px`，透明度 `0.9`；英文使用微软雅黑体系，字号 `40px`、细字重。
- 首页简化输入框 placeholder 为 `灵感一闪，创意即生...`，宽 `700px`，圆角 `16px`，发送按钮是工作台同款黑底 `36x36 / 10px` 圆角。该输入框只是首页展示占位，目前不触发生成。
- 首页输入框玻璃效果目前靠内联 `backdropFilter: blur(42px) saturate(210%) brightness(1.08)`、多层渐变和阴影实现。用户觉得“框内毛玻璃不明显”，排查确认样式已进 DOM；原因是 `backdrop-filter` 只模糊框内背后内容，且背景被暗遮罩压低细节。若继续加强，应新增独立绝对定位的模糊底层或伪层。
- 首页登录从黑色居中弹窗改成右侧白色抽屉。打开时白色面板从右进入，同时底层视频和页面内容向左推 `8vw` 并 `blur(8px)`；关闭后恢复。
- 登录抽屉内只保留横排图形 Logo + 文字 Logo、`密码登录 / 验证码登录` 两个无底按钮、一个邮箱输入框和底部协议文案。邮箱输入框高 `64px`，最大宽 `380px`，灰底；hover 淡蓝边框，focus 通用蓝边框。
- 登录抽屉关闭按钮从 Remix 图标改成 CSS 画的 X，因为 `close-large-line` 是填充路径，不吃 `strokeWidth`，无法变细。当前 CSS X 尺寸较大，hover 旋转一圈。
- 工作台左上角文字 Logo 高度当前是 `26px`，图形 Logo 保持 `50x50`。
- 工作台左侧栏底部新增用户头像/邮箱占位区，顶部全宽分隔线必须抵消 `aside px-3`，否则线不会顶到两端。当前分隔线用绝对定位 `left: -12px; right: -12px`。
- 用户菜单当前为白底圆角细边框、轻阴影，宽 `222px`，居中弹出。菜单项：`用户信息`、`用户安全`、`设置`、`退出登录`，图标在文字前。前三项高 `44px`，hover 是内缩圆角灰框；`退出登录` 是底部整块浅灰，高 `56px`。菜单支持点击空白关闭。
- Next dev 黑色 `N` 是 Next 开发工具按钮，不是项目 UI。已在 `next.config.ts` 设置 `devIndicators.position = "bottom-right"`，需要重启 dev server 后生效。
- 后续做 UI 微调前务必先检查是否有固定样式或 class 没生效。这个项目有全局 `button { font: inherit; }`，按钮字号要写到内部 `span` 或内联 style 才稳定；Tailwind 任意值 class 在本轮多次看起来没生效，关键视觉值优先用内联 style。

本轮围绕 Agent 回复、输入框、品牌和 Logo 继续修正。必须记住：

- Agent 回复不要把 Markdown 原始符号直接露给用户，但标题、二级标题、三级标题、加粗、横线分段、列表这些网页排版能力必须保留。当前前端会渲染有限内部标记，`####` 也会兜底当三级标题。
- Agent 长回复不要一直自动滚到底。用户要求“打字很多超出屏幕时对话流定位在原地”，当前 Agent 文字回复打字时不再持续调用滚动到底。
- 输入框 `contenteditable` 的几个坑已修：删除到空不再留下换行；普通输入/删除不再每字重建 DOM；粘贴图片时阻止浏览器默认把图片插进文字区域；长文本中间插字时不再被拉到底。
- Agent 图片 prompt 不应默认显示或发送“禁止拼图、合集、九宫格、多宫格...”这类内部负向词。用户明确要拼图/合集时要尊重；用户明确不要拼图/合集或纠错时才加入短负向约束。
- “合并到一张”只能由用户原话明确触发，比如“合并到一张 / 放在一张图上 / 同一画面 / 多款放一起”。Planner 自己写“展示图”不算，避免用户说“七张”却只生成一张。
- Agent 说几张就应执行几张。因 Gemini 等模型可能一次返回多候选图，Agent 自动生图现在每次请求只取第 1 张，避免 6 次请求显示 12 张；专业图片模式仍显示多候选。
- 用户指出 Agent 对“红框中的样子”理解不稳。当前根因之一是本地参考图需 base64，Planner 为避免 413 默认不看历史图。正式部署后要做公网 HTTPS 图片 URL 链路，再允许 Planner 在“红框/参考这张/按图里”场景携带最新 1-2 张低清 URL。
- 当前品牌：中文 `闪念`，英文 `FlashMuse`。页面侧栏显示中文；浏览器标题为 `闪念 FlashMuse`；OpenRouter `X-Title` 为 `FlashMuse`；包名为 `flashmuse`；`yinzao-*` key/CSS 不改。
- 首页和工作台 Logo 当前直接用普通 `<img>` 读 `/home-assets/logo.png`，不是 `next/image`，避免同名文件替换后被优化缓存卡住。显示尺寸为 `50x50`。
- `public/home-assets/logo-text.png` 是从 `AI-Video-Assistant_Project Planning\Brand&logo Design\生成图片2.jpg` 中提取的“闪念”文字透明 PNG。首页黑底上用 CSS 转白色，工作台上保持黑色；工作台中 `AI影片助手` 放在文字图下方。
- Logo 试验产物：`logo-original.png` 是原白底备份，`logo-transparent-1024.png` / `logo-transparent-1024-v2.png` 是工具抠透明测试，`public/home-assets/text/` 保存了 4 个图片模型生成的候选图和 `summary.json`。模型不能可靠直接输出真正 alpha 透明 PNG，经常生成棋盘格或绿幕，需要后处理。

## 2026-05-15 本轮首页和素材重点

用户要求做一个大气首页，功能先不用真做，重点是视觉和登录弹窗：

- 首页地址为 `/`，原工作台迁移到 `/workspace`。
- 首页不特别展示平台名称；当前中文名为 `闪念`，英文名为 `FlashMuse`。
- 登录为邮箱登录占位，不校验邮箱 / 验证码，点“登录并进入”直接进 `/workspace`。
- 用户给了 Kling、即梦、通义万相、商汤 seko 等网站作为参考，希望首页全屏视频、大气、黑底、高对比、彩色流体、电影感。
- 首页当前轮播 `public/home-assets` 下 5 个视频：`hero-background.mp4`、`hero-dragon.mp4`、`hero-great-wall.mp4`、`hero-global-human.mp4`、`hero-mecha-robot.mp4`。
- 用户明确要求视频轮播“播放完再播放下一段”，不要按 7 秒或 7.5 秒强制跳播。
- 首页不要右下角预览卡片，已删除。
- 首页视频不要 `poster`，否则切换时会闪静态图；用户曾指出像把图片加进轮播了。
- 右下角 `next/image` 本地图片带 `?v=` 曾导致 Next dev 报错，已修。
- 首页素材已随 `0c20e28 Update homepage media workspace` 推送到 GitHub，另一台电脑拉代码可看到相同首页视频。

首页素材生成过程中的重要偏好：

- 动物不要很多，整个画面一个主体即可。
- 龙图要中国龙，龙头大、头朝左、只露头和少量脖子。
- 场景图改成长城。
- 人物要国际感强一些。
- 机器人不要玻璃感，要机械感、高科技感，主体偏右。
- 风格要和第一张抽象流体图保持一致。
- 龙图生成时，如果提示词反复强调“不要文字”，模型反而会在四角生成文字；后续别这样写，改用“纯画面、四角留黑、uninterrupted pure visual artwork”这类正向描述。

本轮还做了两个 Word 文档：

- `AI-Video-Assistant_Project Planning\OpenRouter 音频模型功能和价格.docx`
- `AI-Video-Assistant_Project Planning\首页视频和参考图提示词记录.docx`

注意：`AI-Video-Assistant_Project Planning/` 仍未跟踪且有敏感压缩包密码说明，不要直接提交 GitHub。

## 2026-05-15 本轮失败重试重点

用户调整了图片 / 视频失败卡重试按钮：

- “重新生成”按钮去掉边框和底色，只保留蓝色图标 + 文字。
- 文字最后调为 `14px`，图标保持 `h-3.5 w-3.5`。
- 无论 Agent、图片生成还是视频生成，点击哪个失败格子，就在当前失败格子原地重试。
- 重试格子先变等待卡，等待计时从点击重试那一刻重新开始。
- 图片重试成功后必须填回原失败格子，不能追加到最后。
- 视频重试同理，成功后填回当前消息同一组 grid。

## 2026-05-15 本轮音频和 MV 讨论重点

用户问输入框上传音频是否能让模型按音频里的音色生视频。结论：

- 当前 OpenRouter 视频接口没有确认支持 `voice_reference / audio_reference / reference_audio` 这类音色参考参数。
- 仅让输入框上传音频做附件没有实际生成作用。
- 角色固定音色应拆成“视频画面生成 + 音色克隆 TTS + 音视频合成”，最好接专门 voice cloning 服务。

用户又问 OpenRouter 是否有声音 / 音乐模型。结论：

- Lyria 3 Pro / Clip 可用于音乐 / 歌曲生成。
- GPT Audio / GPT Audio Mini 可用于语音回复和自然声音。
- GPT-4o Audio Preview 更偏音频输入理解，页面说明当前音频输出暂不支持。
- 可以做“歌曲 -> MV”工作流：生成歌曲 -> Agent 拆分镜 -> 视频模型生成镜头 -> ffmpeg 合成 MV。

## 关于模型选择的结论

用户最早问过 GPT-5.4 / Mini / Nano / Pro / 5.5 的区别和价格。

在“用什么模型来写这个网站代码”这个问题上，结论是：

- `GPT-5.4 Mini` 足够做这个项目的第一版
- `Nano` 太弱
- `5.5` 可以作为复杂问题兜底

## 关于产品范围的变化过程

用户一开始提到“短剧、影游平台”，后来明确收敛需求：

- 不按短剧平台做
- 只做即梦那种核心能力
- 聊天式生图、生视频
- 理解上下文
- 优化提示词

所以项目从“内容平台”收缩成“创作工具型 MVP”。

## 关于登录的变化

曾经讨论过邮箱验证码登录。

后来用户明确要求：

- 先去掉登录
- 直接进入主页
- 方便自己内部测试和调整

所以当前版本没有登录。

## 关于命名的过程

命名讨论很多，方向包括：

1. 可爱拟人化
2. 大厂产品感
3. 电影、影像、摄影鼻祖衍生
4. 从卢米埃尔、达盖尔等名字里抽字组合

讨论过的名字包括：

- 卢米达
- 卢米尔
- 卢米盖尔
- 图境
- 影幕
- 帧影
- 豆映
- 豆图
- 果果
- 泡泡

用户后来让助手自己选一个暂定名即可；2026-05-18 用户确认中文名为 `闪念`，英文名为 `FlashMuse`。

最终实际采用：

- 项目目录仍为：`AI-Video-Assistant`
- 中文展示名：`闪念`
- 英文名 / OpenRouter `X-Title`：`FlashMuse`
- 浏览器标题：`闪念 FlashMuse`
- 内部 localStorage key 和 CSS class 仍保留 `yinzao-*`，避免旧历史、资产和设置失效

注意：

- 当前平台名为 `闪念 / FlashMuse`
- 不代表最终品牌名

## 关于启动方式的要求

用户非常在意测试方便性，明确要求：

1. 最好双击就能打开
2. 最好一键启动
3. 最好不要黑窗

因此项目里做过多轮启动脚本调整。

当前根目录只保留：

- `start-project.bat`

最新目录调整：

1. 项目目录已从 `E:\project\yinzao` 迁移到 `E:\project\AI-Video-Assistant`
2. 中途试过 `AI Video Assistant`，因为路径有空格会影响启动脚本，已改为无空格命名
3. 后续新建项目文件夹不要使用空格，优先用短横线连接
4. 原 `E:\project\yinzao` 文件夹保留为空目录

## 关于页面交互和样式的新要求

用户后续明确要求：

1. 页面要往豆包主页面的交互和视觉上继续靠
2. 页面结构不要左中右三栏，要改成左右结构
3. 左侧顶部显示 logo
4. 左侧功能区要有：对话模式、工作流模式、资产管理
5. 当前真正先做的是对话模式
6. 工作流模式和资产管理先放不可点击占位
7. 图片、视频、文字结果都统一放在对话流里展示
8. 输入框固定在底部
9. 输入框初始高度要低，内容增多时自动长高，最高 300px
10. 虚化效果尝试过，但用户当前要求先去掉

## 关于最新输入框和模式交互

用户最新确认后，输入框和模式交互已改成：

1. 默认进入 `Agent 模式`
2. 模式下拉包含 `Agent 模式`、`图片生成`、`视频生成`
3. Agent 模式适合目标不明确的用户，会通过互动推进创作目标
4. Agent 要会理解剧本、生成剧本、生成文字分镜、整理提示词，后续也要能生图、生视频
5. Agent 模式不让用户选择生图 / 生视频模型，系统自动选快且够用的默认模型
6. `图片生成` 和 `视频生成` 面向目标明确、有提示词、愿意自己调参数的更专业用户；`Agent 模式`继续走智能傻瓜式，不能和这两个模式混做
7. 只有 `图片生成` 和 `视频生成` 这两个模式下，才开放比例、分辨率、时长等参数 UI；`Agent 模式`不开放这些参数
8. `图片生成` 当前显示普通图片模型占位和“画面设置”按钮；风格按钮已去掉
9. `视频生成` 当前显示普通视频模型占位、“画面设置”按钮和时长；风格按钮已去掉
10. “画面设置”按钮会直接显示当前选择，比例选项为 `智能比例`、`9:16`、`16:9`、`1:1`、`3:4`、`4:3`；图片分辨率为 `1K/2K/4K`，视频分辨率为 `720p/1080p`
11. 输入框底部按钮 UI 已继续细调：除上传按钮外其它按钮统一白底、`8px` 圆角、hover 浅灰；模式按钮菜单更大、带小标题、带选中对勾
12. 模式选择按钮里的图标和文字使用蓝色 `#367cee`；placeholder 里的 `@` 也改成同色的 `at-sign` 图标；底部单独 `@` 按钮保持黑色
13. 左侧栏“对话模式 / 工作流模式 / 资产管理”颜色规则已统一；对话模式图标未选中 `chat-3-line`、选中 `chat-smile-ai-line`；资产管理未选中 `folder-line`、选中 `folder-open-line`
14. 项目主界面图标已开始整体切到 Remix Icon，期间曾出现编译失败，现已修复并重新 build 通过
15. 反馈区图标已统一成 Remix Icon 的线框 / 实心切换：喜欢、不喜欢、回答错误、模式错误都会在选中后切成 fill 版本
16. 输入框工具栏结构仍为 `+` 上传入口、模式自定义上弹菜单、模式相关参数、发送按钮
17. 全模式都要支持上传图片；当前已完成本地图片选择和粘贴图片预览，最多 5 张，真实理解 / 参考图流程还没接
18. 输入框支持 Enter 发送，Shift + Enter 换行
19. 每个历史对话的未发送草稿、上传图片和生成状态必须独立，不能串话
20. 不同历史对话可以并发生成，不能因为一个历史对话生成中就锁住其它对话
21. 输入框上传图片超过 5 张时显示黑色提示“最多上传五张图片”
22. 输入框文字和 placeholder 当前是 14px
23. 用户反馈“按回车没反应会多点导致多条回复”，已改成发送后立即显示用户消息、清空输入框、按钮显示 `发送中...`
24. 当前已加同会话发送防重和同请求回复防重，避免一次输入触发多条 AI 回复
25. 用户反馈刷新浏览器会从当前历史对话跳到第一条，已新增 `yinzao-active-session-v1` 保存当前会话 ID，刷新后保持原对话
26. 用户反馈发消息后无论说话、生图、生视频都要等很久才有反应，已改成 Agent 意图识别期间立即显示“正在认真思考”，图片 / 视频识别完成后马上切到等待卡片
27. 用户要求 `图片生成` / `视频生成` 两个专业模式做实，当前已接真实模型菜单、真实参数传参和真实数量生成；这两个模式不再做提示词优化，也不再像聊天一样显示右侧用户气泡
28. 专业模式下用户输入默认就是提示词，显示在左侧生成结果上方；系统不说“我已经开始生成...”，提示词直接显示，不走打字机；`Agent 模式`仍保留对话和打字机效果
29. 专业模式下不显示引导按钮；引导系统只属于 `Agent 模式` 的最后一条 AI 回复
30. 模型和参数刷新后要保持，当前保存到 `localStorage` 的 `yinzao-input-settings-v1`

## 关于本轮输入框悬浮层和提示词区细调

本轮用户主要在细抠图片 / 视频结果上方的提示词区，以及输入框和聊天内容区的层级关系。

当前最新结论：

1. 图片 / 视频结果上方的提示词默认最多只显示 `2` 行，末尾右侧要有渐隐效果
2. 如果提示词较短，默认直接显示，不额外出现悬浮底框
3. 如果提示词较长，鼠标悬停时要在原位上方显示完整提示词浮层，而且这个浮层不能把下面内容顶下去，只能覆盖在上面
4. 提示词完整浮层当前已改成白色毛玻璃效果：白色半透明底、毛玻璃模糊、`12px` 圆角
5. 提示词后的“复制提示词”按钮默认状态是灰色按钮；只有在毛玻璃浮层里才是黑色毛玻璃按钮
6. 普通状态下复制提示词按钮高度为 `22px`；毛玻璃浮层里的按钮高度为 `26px`
7. 因为项目里有全局 `button { font: inherit; }`，按钮字号如果要生效，必须把字号写到按钮内部文字 `span` 上，不能只写在 `button` 本身
8. 提示词下方参数行当前显示：模型、比例、尺寸；分辨率图标统一放在尺寸后面，视频 `HD / FHD` 图标颜色也改成与参数文字一致的灰色
9. 反馈区第一个“复制”按钮只允许出现在 `Agent 模式` 的纯文字回复下；只要这条回复里有图片或视频，就不能显示这个按钮
10. 本轮最大的结构调整是：聊天内容区和输入框区已从原来同一层的伪悬浮，改成真正的两层结构
11. 当前聊天消息是滚动层，输入框是独立悬浮层；输入框本体保留原样，只去掉外层承托白底，不再像坐在一整片白面板上
12. 用户明确要求右侧整体底色仍然保持白色，不要改成淡蓝；前一轮曾误改成淡蓝，后来已经改回白色
13. 当前输入框本体也已改成白色毛玻璃效果，但输入框内部结构、按钮、模式菜单和参数菜单本身不要重写
14. 聊天区底部安全区已继续加大到约 `360px`，滚动到底时最后一条内容会停在输入框上方，减少被悬浮输入框遮挡
15. “回到底端”按钮曾因为父层是 `pointer-events-none` 导致完全点不了，后来已通过给按钮补 `pointer-events-auto` 修复；并且按钮层级已提高到媒体结果上方

## 关于 2026-05-09 本轮关键交接

用户本轮主要围绕专业模式、图片生成稳定性、提示词区、重新生成和输入框 `@资产` 高亮持续细调。

当前必须保留的结论：

1. 除 `Agent 模式` 外，用户手动选择的模式绝对优先；`图片生成` 一定出图片，`视频生成` 一定出视频，提示词内容不能反向切模式
2. 用户示例：如果用户在图片模式写“来一段美女跳舞的视频”，正确行为是生成美女跳舞的单帧图片，而不是提示切视频，也不是走视频链路
3. 图片 / 视频专业模式下，生成前不显示“我已经开始生成...”之类提示；成功和失败都显示该批任务自己的提示词，失败只在红字错误区显示真实错误
4. `使用提示词` 按钮不是复制到剪贴板，而是把当前媒体提示词填入输入框并聚焦；图标使用 `t-box-line`
5. 视频结果参数行最后要显示真实选择的秒数，取这条消息自己的 `generationMeta.settings.duration`
6. 图片生成曾长期报 `OpenRouter 图片生成失败：Internal Server Error`，最终确认是 Node `fetch` 偶发假 500；同请求用 `curl` 成功，已给图片生成加 `curlPostJson` 兜底
7. 图片返回可能是 `data:image/jpeg;base64,...`，本地保存 data URL 时必须从 MIME 推断扩展名，否则会保存失败或报错
8. 明确比例时不要同时传正方形 `size`，否则可能与 `aspect_ratio` 冲突；重试时可去掉 `image_config`
9. 图片 / 视频结果的重新生成按钮必须只绑定当前这一批结果自己的提示词和参数；优先使用 `message.generationMeta.originalPrompt`，再退回 `message.content`；不能找其它批次、不能插用户气泡、不能串 Agent
10. 提示词区显示逻辑：`提示词 + 使用提示词按钮` 两行内能完整显示则正常显示、不渐隐、不弹完整框；真实超过两行才截断、右侧渐隐、hover 展开；展开时前两行位置要和默认状态重合
11. 输入框本体样式最终用户认为正确的是：`bg-white/78 + backdrop-blur-[18px]`，默认 `#f1f2f2` 淡灰描边、无阴影，聚焦后白色描边和外阴影
12. 工具按钮尝试做成毛玻璃，使用 `src/app/globals.css` 里的 `.yinzao-tool-button` / `.yinzao-tool-button-active`；第一个 `+` 上传按钮必须额外 `.yinzao-tool-button-round` 保持圆形

## 关于即梦 @ 名实现方式的调研和下一步优先方案

用户给了即梦地址：`https://jimeng.jianying.com/ai-tool/home`，并截图说明即梦输入框内 `@名` 是变色的、带小图标的，而且不会出现两层字。

本轮调研结论：

1. 即梦红框中的 `@名` 很可能不是原生 `textarea` 实现
2. 从抓取资源看，相关 CSS/JS 中有 `slate` 迹象，因此大概率是 `Slate.js` 或类似 `contenteditable` 富文本编辑器
3. 即梦的 `@名` 应该是富文本里的 inline mention 节点，而不是 overlay 模拟
4. 我们当前的 `textarea + DraftInputOverlay` 双层方案是为了在 textarea 里模拟 `@资产名` 蓝色，但天然会出现选中重影、两层字、滚动/换行不同步等问题
5. 原生 `textarea` 不能让中间一段文字单独变蓝，也不能给某段文字加圆角底或图标
6. 如果用户坚持要即梦那种稳定的 `@资产名` 变色 / 胶囊 / 图标体验，应单独重构输入框为 `Slate.js / contenteditable` mention 编辑器
7. 这项重构不是小修，预计至少 `0.5-1.5天+`，要处理中文输入法、Enter/Shift+Enter、粘贴图片、撤销、光标、选中、移动端、草稿持久化、发送解析和资产引用顺序

下一个 AI 接手时，用户明确要求：优先把这个“即梦富文本 mention 方案”重新拿出来给他看一次，再决定是否开始做。

后续实际执行更新：本对话中已先完成输入框重构，把 `textarea + overlay` 改成单层 `contenteditable` 输入框。有效 `@资产名` 现在直接在同一层文字中变蓝；输入 `@`、点击底部 `@`、缩略图引用、资产选择都按当前光标位置插入；选择资产会替换光标前正在输入的 `@xxx`。输入框当前上限为 `2000字`，超过后黑色提示“最多输入2000字”。复制大段文字后输入框内部滚动条会自动跟到最后一行。

## 关于本对话收尾阶段的关键更新

1. 新对话默认欢迎消息已去掉，初始消息为空
2. 切换模式会在对话流中新增一条 `role: "system"` 系统提示消息，不再固定在最底部；用户后续发消息或生成结果应显示在该系统提示下面
3. 系统提示样式：灰色文字，前面是对应模式图标；“当前已切换到XX模式”加粗，说明文字同一行接在后面；`Agent` 说明文案使用“Agent会帮你理解需求”
4. 只有系统提示、没有用户输入的会话仍算空会话，不能因为只切换模式就新增多个历史“新对话”
5. 输入框宽度策略：默认优先 `800px`；如果底部按钮组合 / 长模型名 / 长输入需要更多空间，才逐步加宽到约 `1006px`；按钮必须一排显示，文字不换行，不能重叠；注意不要给工具栏外层加 `overflow-x-auto`，否则上弹菜单会被裁掉
6. 长提示词 hover 展开框最大高度 `250px`；标题行固定不滚动，左侧“当前使用的提示词”+ 信息图标，右侧“使用提示词”按钮；正文在标题下方滚动，不能盖住标题
7. 图片失败卡：灰底、每张 `250x250`、按生成数量显示，左上 `emotion-sad-line + 图片生成失败`，红色真实错误保留在下方
8. 视频等待 / 成功 / 失败卡：单个 `640x360` 灰底区域，等待卡只显示进度和已等待时间；失败卡左上 `emotion-sad-line + 视频生成失败`，红色真实错误保留在下方
9. 最近一次视频失败真实原因为 OpenRouter 风控：`InputImageSensitiveContentDetected.PrivacyInformation`，原文说明参考图可能包含真人，平台拒绝创建视频任务；不要再把这次失败归因成参数组合不支持
10. 用户发现实际视频任务约 2 分钟就停止自动等待，排查后确认代码里普通视频模型只轮询 `12` 次，每次 `10秒`，确实约 `120秒` 停止；文档里“约 5 分钟”是过期描述
11. 用户明确要求：如果模型没有返回失败，就不要自动停掉，继续等待；已移除前端最大轮询次数。现在前 2 分钟每 10 秒查一次，之后每 30 秒查一次，直到成功、失败、过期或接口错误
12. 用户明确要求：同一会话里上一条任务没返回时也可以继续发任务，最多 `10` 个；已把单个 `pendingRequest` 改为 `pendingRequests` 队列，发送按钮只在当前会话挂起任务数达到 10 时显示“任务已满”并禁用
13. OpenRouter / 模型官网没有公开各视频 / 图片模型的固定并发数；只能确认 OpenRouter 支持并发提交，超限时通常会表现为排队、429 或任务创建失败。用户本轮决定先不实测并发上限，先按产品侧同会话最多 10 个任务放开

## 关于图片 / 视频专业模式做实

本轮用户要求把 `图片生成` 和 `视频生成` 作为专业模式做实，而不是 Agent 式问答。

当前关键规则：

1. 用户在 `图片生成` / `视频生成` 模式输入的文字就是最终提示词，不走 `/api/chat` 优化
2. 上传图片和 `@资产` 图片要原样发送给模型；明确 `@` 时只传被引用图片并按文本顺序，未 `@` 时传本次上传图
3. 专业模式不显示右侧用户气泡，提示词显示在左侧生成结果上方
4. 专业模式提示词直接显示，不走逐字打字机
5. 专业模式结果不显示引导按钮
6. `Agent 模式` 不受这些规则影响，仍然可以对话、引导、自动路由生成

模型选择：

1. 图片模型：`Seedream 4.5`、`Gemini 3.1 Flash Image Preview`、`Gemini 3 Pro Image Preview`、`GPT-5 Image`、`GPT-5.4 Image 2`
2. 视频模型：`Seedance 2.0 Fast`、`Seedance 2.0`、`Kling v3.0 Standard`、`Kling v3.0 Pro`、`Kling Video O1`、`Veo 3.1`、`Sora 2 Pro`
3. 模型按钮和菜单图标：OpenAI 用 `openai-fill`，Google 用 `google-fill`，字节用 `tiktok-fill`，可灵等其它使用本地 `ai-generate-3d-line` SVG
4. 模型名较长时按钮自动变长，输入框默认至少 `800px`，需要时跟随变宽；窄屏才隐藏文字只留图标

实测结论：

1. 图片只有 `Seedream 4.5` 在当前本机 OpenRouter key / 地区下可用
2. Google / GPT 图片模型均返回 `403 This model is not available in your region`
3. 视频 7 个模型均能创建并完成任务
4. `Veo 3.1` 只支持 `4 / 6 / 8秒`
5. `Sora 2 Pro` 支持 `4 / 8 / 12 / 16 / 20秒`，不支持 `generate_audio=false`，不支持 `1:1`；代码已兜底成支持值
6. Seedance / Kling 当前按 `5 / 10 / 15秒` 展示和传参

视频参考图规则：

1. 用户明确要求取消默认首尾帧
2. 现在不再传 `frame_images`
3. 所有上传图 / `@资产` 只作为普通 `input_references`
4. 是否首帧、尾帧、参考图怎么用，完全交给用户提示词和模型理解

视频声音规则：

1. 默认尝试生成声音
2. 非 Sora 模型先传 `generate_audio: true`
3. 如果音频参数导致失败，自动重试无声音版本 `generate_audio: false`
4. `Sora 2 Pro` 不传 `generate_audio` 字段

媒体显示规则：

1. 对话内容主容器最大宽度 `1006px`
2. 图片缩略图和图片等待卡固定 `250x250px`
3. 四张图片横排间隔 `2px`，总宽 `1006px`
4. 图片直角显示，内部图片 `object-contain` 完整显示，不裁切，方便看横竖图比例
5. 点击缩略图打开资产管理同款大图预览
6. 图片等待卡内部不显示“正在生成图片...”和三个点动画，只保留进度和已等待时间
7. 对话框里 AI 消息左侧小 logo 已去掉，左侧栏 Logo 保留

## 关于 Agent 和回复排版

用户确认要先做 Agent 模式，后两个模式先能切换，专业功能后续完善。

当前 Agent 规则：

1. 先以对话推进、创作建议、剧本 / 分镜 / 提示词整理为主
2. 不要在没有真正调用生成接口时声称已经生成图片或视频
3. 回答要更容易阅读，支持标题、分段、列表、加粗、提示块和横线
4. `#` / `##` / `###` 会渲染成不同大小标题
5. `[red]...[/red]` 显示为淡红底 + 浅红文字，用于注意、风险、限制
6. `[blue]...[/blue]` 显示为淡蓝底 + 浅蓝文字，用于建议、下一步、推荐方案
7. `---` 显示为灰色横线，用于明显分段
8. Agent 正文不再输出 `### 下一步调整方向`
9. `/api/chat` 的 Agent 回复现在返回结构化 JSON，前端使用 `content` 渲染正文，使用 `suggestions` 渲染独立引导系统按钮
10. 引导系统按钮显示在反馈图标下方，不属于正文，也不参与反馈
11. AI 新回复逐字显示，按字数控制在 1-8 秒，旧历史消息不重新打字
12. 左侧历史会话和“正在认真思考”使用光环扩散动画表示运行中
13. AI 头像已切到 Remix Icon 风格的星形笑脸图标，并已和正文对齐微调
14. 用户不喜欢 Agent 一次给很多段，已收紧为默认短回复、一问一答；简单问候走本地固定回复

## 关于引导系统

引导系统是本轮新增的 Agent 回复后独立按钮区，用户明确要求它不是正文，也不是反馈的一部分。

当前规则：

1. 用户普通聊天时，Agent 简短回答，按钮展示能力入口，引导到影片 / 短剧创作
2. 用户问电影知识、影片制作知识、电影史等问题时，Agent 应详细结构化回答，按钮给 2-3 个当前问题延展 + 1-2 个转创作入口
3. 用户进入创作阶段后，按钮变成 2-3 个当前内容修改 + 1-2 个下一步创作
4. 创作主流程为：故事概念 -> 扩展故事 -> 改成文字分镜 -> 生成主角图片 -> 生成场景图片 -> 做成图片分镜 -> 做成视频
5. 文字分镜转图片分镜必须一镜一图，不能五个镜头只生成一张；建议逐镜生成，先第一镜，再下一镜
6. 角色图生成后应引导生成三视图；场景图生成后应引导生成多角度参考
7. 多版角色 / 场景 / 分镜图后续用于一致性生成时，应提醒用户用 `@资产名` 指定版本
8. 当前按钮已升级为对象 `{ label, action, assetTargetType }`，生成角色图、场景图、分镜图、分镜视频时会携带目标资产类型，生成结果按该类型优先入库
9. 引导系统只显示在最后一条 AI 回复下方；用户点击引导或发送新消息后旧引导消失；用户只是在输入框打字时引导不消失

当前按钮样式细节：

1. 按钮在反馈图标下方
2. 浅灰底，文字灰色，右侧有箭头
3. 当前按钮文字调整为 14px，圆角 8px
4. 点击按钮会直接作为下一条 Agent 消息发送

注意：项目里 `button { font: inherit; }` 全局样式会影响按钮字号，按钮内文字如果需要精确字号，通常要把 `text-[...]` 加到内部 `span` 上才稳定。

## 关于资产管理和 @ 引用

本轮已开放资产管理，并围绕后续登录用户资产库做了本地 MVP。

当前资产分类：

1. 全部资产
2. 角色图片
3. 场景图片
4. 分镜图片
5. 分镜视频
6. 其它

分类规则：

1. 明确镜头 / 分镜 / 第几镜的图片归 `分镜图片`
2. 明确镜头 / 分镜 / 第几镜的视频归 `分镜视频`
3. 明确男主 / 女主 / 角色 / 人物 / 三视图的图片归 `角色图片`
4. 明确场景 / 背景 / 房间 / 街道 / 多角度参考的图片归 `场景图片`
5. 无法明确分类的图片和视频一律归 `其它`
6. 优先级为：分镜 > 角色 > 场景 > 其它
7. 原“视频资产”分类已取消；普通无法判断的视频进入其它

资产管理 UI：

1. 点击左侧“资产管理”后，历史对话列表区域切换为“我的资产”分类列表
2. 左侧“资产管理”主按钮后不显示数量
3. 分类列表里第一个“全部资产”图标不变，其它分类使用对应图标
4. 右侧资产小图统一正方形、直角、无圆角
5. 小图底部使用从黑到透明的渐变底，底部黑色较深，高度较低
6. 图片资产名称显示为 `@资产名`，点击可回到对话输入框并插入 `@资产名`
7. 视频资产名称不显示 `@`，点击名称不触发引用，因为视频没有 `@` 引用功能
8. 右上角文件夹图标用于修改分类，菜单会根据屏幕空间向上或向下弹，避免出画面
9. 分类菜单里有分类图标和当前勾选，文字当前 12px
10. 小图右下角是三点菜单，菜单内有“重命名”和“删除”
11. 删除资产只从本地资产管理移除，不删除历史对话里的原图片 / 视频
12. 所有小菜单点击空白区域都会自动关闭

@ 引用：

1. 输入框提示语是 `输入文字，上传图片或@资产，描述生成内容...`
2. 提示语里的 `@` 为蓝色，可点击，点击后输入 `@` 并弹出资产选择
3. Agent 模式按钮后也有一个 `@` 按钮，功能相同
4. 输入框里 `@资产名` 用蓝色显示；当前通过透明 textarea + overlay 实现
5. `@` 弹窗只显示角色图片、场景图片、分镜图片三个标签按钮，不显示全部、其它、视频
6. 三个标签按钮横向排列，显示数量；数量为 0 时不可点
7. 点选资产后插入 `@资产名`，并把资产图片作为输入框上方缩略图加入本次参考图；发送时会把该资产 URL 作为参考图传给生成流程
8. 输入框上方缩略图是统一参考图入口，上传图和 `@资产` 图样式一致：`100x100`、圆角、灰色边框、底部黑渐变内显示 `@名称`
9. 普通上传图只加入缩略图，不自动插入 `@文件名`；`@资产`、资产管理引用、预览弹窗引用、历史用户消息缩略图再引用会同时插入 `@名称`
10. 输入框最多 5 张参考图，超过时统一显示“最多上传五张图片”提示；同一 URL 重复引用不重复占名额
11. 发送后的用户消息下方会显示横排参考图缩略图，点击可继续引用；用户消息文字中的有效 `@名称` 后会显示小图缩略图
12. 资产库保存在 `localStorage` 的 `yinzao-assets-v1`
13. 页面加载时会扫描所有历史对话里的旧 `images` 和 `videoUrl`，按 URL 去重后自动入库
14. 手动改过分类的资产带 `lockedType`，刷新后不会被自动分类覆盖

资产命名规则：

1. 角色图片：如果剧本或提示词里有名字就用角色名字，没有就用 `角色1`、`角色2`
2. 场景图片：如果剧本或提示词里有场景名就用场景名，如 `医院302号病房`、`海边沙滩`，没有就用 `场景1`、`场景2`
3. 分镜图片 / 分镜视频：优先 `剧名_分镜01_1`、`剧名_分镜02_1`；无剧名用 `无名剧01_分镜01_1`
4. 非剧中普通图片 / 视频：分别用 `image01`、`image02` 或 `video01`、`video02`
5. 多版本统一在后面追加 `_2`、`_3`
6. 动物 / 植物主体且无剧中名字时，优先从提示词 / 上下文提取贴切名字，如 `小狗`、`彩色荧光猫`、`科幻兔`；当前还不是看图识别
7. 用户上传图片入库资产时，名称使用原上传文件名去扩展名；如果同名但不同 URL，使用 `_2`、`_3` 版本号；同 URL 不重复入库
8. 上传图分类根据文件名 + 本次用户文本判断：分镜 / 镜头进分镜图片，角色 / 人物进角色图片，场景 / 背景进场景图片，无法判断进其它

后续建议：

1. 增加 AI 看图分类作为兜底，让动物植物、复杂场景和非剧中图片命名更准确
2. 登录系统上线后，把本地 `yinzao-assets-v1` 迁移为服务端用户资产库

## 关于参考图生成链路和 413 限制

本轮围绕“上传图、`@资产`、历史消息缩略图都要真正作为参考图生效”做了多轮调整。

当前规则：

1. 用户明确输入 `@Soo-ji @林小鹿 @客厅` 这类引用时，前端会按文本里 `@` 出现顺序解析参考图，不再按资产数组顺序传图
2. 如果用户明确 `@` 了图片，只传被 `@` 的图，不额外夹带其它上传图或最近图
3. 如果用户没有 `@`，才传输入框上方的上传图 / 资产图；如果输入框也没有图，但用户说“刚才那张图、图中、让它动起来”等，再取最近用户消息里的图
4. 传给生成链路前会按 URL 去重，避免同一张图重复传给 OpenRouter
5. `/api/chat` 提示词优化阶段会收到低清参考图预览（`512px / 0.72`），用于看懂角色、场景并写进最终 prompt；如果这一步遇到 413，会退回纯文本优化
6. `/api/image` 最终生图阶段默认先传原图；如果 OpenRouter 返回 `413 Request Entity Too Large`，前端自动用压缩副本重试：先 `1280px / 0.85`，还失败再 `1024px / 0.78`
7. 压缩副本只用于本次生成请求，不覆盖资产库原图和用户消息里的原图
8. 本地开发阶段 `/generated/...` 图片会被服务端转 base64 传给 OpenRouter，base64 会放大请求体；公网部署后要改成传 HTTPS 图片 URL

当前风险：

1. `bytedance-seed/seedream-4.5` 多参考图一致性可能仍然不稳定，尤其是同时参考两个人物 + 一个场景时
2. 如果用户继续反馈“完全不参考图”，下一步应优先加前端 / API 调试日志，在页面或控制台显示实际传了几张图、每张图的 `@名称`、URL 和最终 prompt
3. 如果确认传图正确但效果仍差，应评估更适合多参考图编辑的一致性模型，而不是继续只调提示词

## 关于正文排版和运行中动画

本轮调整了两个用户明确指出的细节：

1. AI 正文中类似 `- 陈野：内容`、`1. 追凶段落补全细节：内容` 的小段标题，现在渲染为圆点列表，并把冒号前文字加粗，不再显示原始短横线或数字序号
2. 修复同一条消息中重复图片 URL 导致 React duplicate key 报错的问题；Next.js 左下角红色 `N` 主要来自这个浏览器错误
3. “正在认真思考”和左侧历史对话运行中动画已统一为 3x3 点阵，淡蓝底常驻，深蓝随机闪烁，周期 `3.14s`
4. 左侧历史对话运行中动画现在也监听意图识别状态，和右侧“正在认真思考”前面的动画同步出现
5. 这个点阵动画样式在 `src/app/globals.css`，组件入口是 `HaloPulseIndicator`，用户后续可能继续微调大小、颜色和闪烁节奏

## 关于意图判断和越用越聪明

用户觉得关键词判断太笨，要求做成能逐渐变聪明的机制。

当前已做：

1. 新增 `/api/intent`，让 OpenRouter 做意图分类，只返回 JSON
2. 意图分类可返回 `agent` / `image` / `video` / `prompt` / `clarify`
3. Agent 模式下先用硬规则识别明确生图 / 生视频
4. 硬规则不确定时用本地纠错记忆
5. 仍不确定时调用 `/api/intent` 结合上下文判断
6. 明确生图 / 生视频时自动调用对应接口，不再只给提示词
7. 如果用户说“不是，我要视频 / 不对，是生图”之类纠错，会记录到 `yinzao-intent-memory-v1`
8. “要图给视频或要视频给图”反馈也会沉淀纠错记忆
9. 用户指出“来一段”不应直接判定为视频，已修复：只有明确说视频、镜头、动画、动起来、图生视频等才走视频

后续要提醒用户继续加强：

1. 做反馈日志查看页
2. 点“不喜欢”弹出原因输入框
3. 点“回答不对”弹出哪里不对
4. 点“要图给视频或要视频给图”弹出应该是图片 / 视频 / 文字
5. 定期总结反馈日志，自动生成优化规则

## 关于反馈操作

当前 AI 回复底部反馈区：

1. 复制：文字复制文字，图片复制图片，视频显示无法复制
2. 重新生成：按该条消息原执行模式重新生成
3. 喜欢 / 不喜欢：二选一，选中后同类图标变实心，再点取消
4. 回答不对：只显示在文字回复下，选中后图标变实心
5. 要图给视频或要视频给图：只显示在图片 / 视频结果下，选中后图标变实心
6. 更多：三点图标，悬停显示“更多”，菜单内有复制文字和删除
7. 反馈区末尾显示“感谢反馈 + 时间”，字号 12px
8. 所有反馈写入本地 `yinzao-feedback-log-v1`

## 关于图标和模型下拉

用户要求图标统一，已安装 `lucide-react` 并替换项目内手写 SVG 图标。

当前图标和模型结论：

1. 顶部右侧对话模型下拉已移除
2. 对话模型固定为 `bytedance-seed/seed-2.0-lite`
3. 之前 `seed/seed-2.0-lite` 会报 invalid model ID，正确前缀是 `bytedance-seed/`
4. 默认图片模型是 `bytedance-seed/seedream-4.5`
5. 默认视频模型是 `google/veo-3.1-lite`
6. 当前测试阶段会在页面左下方显示对话、图片、视频模型，方便排查，后续上线可移除
7. 左上角 logo 图标当前用 `moon-star`，底色 `#6667ff`，图标白色
8. 左侧收起图标当前为 `panel-left-dashed`，展开回来图标为 `panel-left`
9. 新建对话图标为 `plus`，重命名图标为 `square-pen`
10. 左上品牌文案当前为 `闪念 / AI影片助手`
11. 左侧“开启新对话”已改成“新建对话”，文字居中，图标放在居中文字左侧
12. 左侧历史选中态尝试过多个蓝紫色，最后按用户要求回到最初灰色 `#ececec`

## 关于 Seedance / 视频接入最新结论

最新更新：Seedance 独立聚合接口先暂停，当前项目视频生成已改走 OpenRouter 视频接口，默认模型为 `google/veo-3.1-lite`。

最新视频生成实测结论：

1. OpenRouter 视频接口本身能跑通，测试提示词 `A cute cat walking slowly on a sunny wooden floor` 约 42 秒完成
2. 本地 `/api/video` 之前一直显示排队，根因是 Node `fetch` 查询 OpenRouter 视频任务时返回假 404，但 `curl` 能查到 completed
3. 已在 `src/lib/openrouter-video.ts` 增加 `curl` 查询兜底
4. OpenRouter `unsigned_urls` 内容下载需要鉴权，已在保存视频时增加带 headers 的 `curl` 下载兜底
5. 当前视频强制 4 秒、720p，短提示词会被扩写，轮询策略为前 2 分钟每 10 秒、之后每 30 秒、超过约 5 分钟提示重试
6. 用户要求视频像即梦一样直接显示在对话框里，不要只显示按钮；当前已改为内嵌视频卡片，按比例缩小，最大高度约 520px，鼠标悬停自动播放，移开暂停，保留播放器控件

最新图片生成实测结论：

1. `bytedance-seed/seedream-4.5` 是 `text+image -> image`
2. 请求 `modalities: ["image", "text"]` 会报 `No endpoints found that support the requested output modalities: image, text`
3. 已改为 `modalities: ["image"]`，本地 `/api/image` 已测试成功生成图片
4. 图片生成中不再额外显示“正在认真思考”，只显示同款生成状态卡

用户提供了本地资料目录：`E:\project\【1】Api\SeeDance接入说明`。

关键文档结论：

1. 主要参考 `AI聚合三方接口接入文档.docx`
2. 创建视频任务接口应为 `POST /openApi/generate`
3. 查询视频结果接口应为 `POST /openApi/queryResult`
4. 请求头需要 `projectCode`、`X-Access-Key`、`X-Secret-Key`、`Content-Type: application/json`
5. 创建视频请求体需要 `modelId`、`abilityType: VIDEO`、`prompt`、`payload`
6. 当前模型 ID 是 `doubao-seedance-2-0-260128`
7. 查询状态数字含义：`0` 任务创建、`1` 进行中、`2` 完成、`3` 失败、`4` 取消

当前代码状态：

1. `src/lib/seedance.ts` 已按上述聚合接口重接
2. `src/app/api/video/route.ts` 已按聚合状态和视频链接字段做解析
3. `.env.local` 当前使用 `SEEDANCE_BASE_URL=http://14.103.147.238:19220`
4. `http://8.137.157.96:9220` 是文档里的测试环境，但当前 AK/SK 实测返回 AK/SK 校验失败
5. `http://14.103.147.238:19220` 实测返回白名单错误，说明更可能是当前密钥对应环境
6. 当前阻塞点：请求 IP `122.233.177.239` 不在项目 `JTvHbTmS4RZjP63t` 白名单
7. 下一步：让接口方加白 `122.233.177.239`，然后重新测试视频生成

## 关于文档要求

用户明确要求：

- 建一个交接文档文件夹
- 把到目前为止的对话重点和项目进度梳理出来
- 让下一个 AI 能接住上下文继续做

所以当前 `handover` 文件夹就是按这个要求建立的。

## 关于后续 AI 协作方式的新规则

用户最新明确要求：后续所有 AI 在动手改代码前必须先问用户确认。

具体规则：

1. 功能逻辑、接口参数、模型参数、UI 显示、错误提示、交互规则都不能自行先改
2. 即使只是小文案、小提示、参数显示、`modalities` / `size` 这类接口参数，也必须先说明准备怎么改，再等用户确认
3. 排查问题可以先读文件、看日志、说明原因；但进入代码修改前必须问
4. 用户特别指出：之前改 UI 显示、改 OpenRouter `modalities` 都应该先问，不要再自行改
5. 后续 AI 接手时要默认遵守“先确认、再修改”的协作方式

## 关于 2026-05-14 本轮关键交接

本轮用户围绕 Agent 理解能力、Planner、模型选择、错误提示和规则文档做了新的产品规则确认。

必须记住的结论：

1. `AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md` 是后续持续更新的核心规则文档。用户让“先看文档”时，应先读该文件，对照当前实现列出是否有更新，再让用户决定改不改。
2. Agent 模式不能只靠关键词或简单正则理解用户。当前已新增 `/api/agent-plan`，由 Agent 模型先输出结构化执行计划，再由前端执行器处理对话、追问、生图或生视频。
3. Agent Planner 不是让 Agent 每次问全参数。规则是：能判断就直接干；只有目标不清、图片/视频都可能、缺失信息会明显导致错、用户要求冲突、成本规格明显过高时才追问。
4. Planner 需要把用户话拆成结构化字段：`intent`、`needsClarification`、`count`、`subject`、`quality`、`ratio`、`resolution`、`duration`、`prompt`、`constraints`、`items`、`suggestions`。
5. 用户举例“再来七张，一张图片上只要一个美女就可以了。我要高品质一点的”。正确理解是：生成 7 张、每张只有一个女性主体、高品质、禁止拼图/合集/多宫格/多人同框；不要把“七张”放进单张图片 prompt。
6. Agent 不再本地问候直回。所有 Agent 输入都先显示 `正在认真思考`，最少 `2000ms`；思考文字和三点有走光/跳动动画。
7. Agent 思考状态已写入 `pendingRequests`，刷新浏览器后仍会恢复并继续执行，不再丢失。
8. Agent 自动生成结果不要重复用户原话。显示文案应由 Planner 给出简短执行说明，例如“我会生成 7 张高品质单人图片，每张只保留一个人物。”，然后显示媒体结果。
9. Agent 生图一行 4 个，超过换行，不分页；Agent 生视频未来目标是一行 2 个，超过换行。当前视频数据结构仍是一条消息一个 `videoUrl`，多视频合并显示还需后续结构改造。
10. Agent 媒体等待卡、失败卡和结果底框使用 `10px` 圆角；失败卡内显示“重新生成”，只重跑对应失败项。
11. Agent 模型调用规则已定：普通 Agent 固定图片 `Seedream 4.5`、视频 `Seedance 2.0 Fast`；高级 Agent 默认先用当前专业模式选择模型，不主动上贵模型。
12. 用户说“高品质/高清/精细/质量好一点”不直接切换模型，只先优化提示词和参数。只有多次不满意结果才升更高质量模型，只有多次抱怨生成慢才换更快更稳模型。
13. `Veo 3.1` 只在用户明确要求“4K 视频 / 视频要 4K / 输出 4K 分辨率视频”等输出规格时调用；“4K画质 / 4K质感 / 高清 / 高品质 / 电影感”不触发 Veo。
14. 用户确认模型“价格/质量”排序按用户给定顺序，不必严格按 OpenRouter 价格实时判断。该排序已写入规则文档中的定宽 Markdown 表格。
15. Agent Planner 阶段不再携带 base64 图片，只告诉模型本轮有几张参考图，避免 413；真正生成时仍按参考图规则传图。
16. 红字错误必须中文化，不能再把 HTML、代码、堆栈直接展示。当前新增 `src/lib/error-message.ts` 并接入前端和主要 API。
17. 系统提示和错误系统提示图标需要与第一行文字顶部对齐。
18. Agent 对话必须优先像人一样自然表达，这条规则高于其它 Agent 执行细节。内部执行约束只用于规划和生成，不要默认暴露给用户；例如“单张独立、不做拼图/合集”不应每次都说，除非用户明确要求或纠错。
19. Agent 多图任务必须优先拆成每张独立 prompt。用户说“生成10张，每张不同国家/性别/时代”时，不能把“不同国家、不同性别、不同时代”整句塞进单张 prompt；应生成 `items[]`，每项只描述当前这一张的具体国家、性别、时代和画面。
20. Agent 结果中的提示词展示规则：Agent 文案下方、媒体结果上方显示淡灰折叠提示词条。默认折叠；点击展开；多图不同 prompt 时显示 `<1/5>` 分页；“使用提示词”填入当前页 prompt。专业图片/视频模式不受影响。
21. Agent 文本回复不能默认携带历史图片。历史生成图转 base64 会导致 413；现在 Agent 上下文默认纯文本，只有本轮明确参考图才带最新用户图片，并且 413 会纯文本重试。
22. 用户明确要求“只要场景、不要人物”时，最新纠错必须覆盖旧上下文。最终 prompt 需要清理人物词并加入无人物/无剪影约束。
23. 用户可见提示里不要出现 `OpenRouter` 字样，统一用“平台 / 请求 / 图片生成 / 视频任务”等通用表达。
24. 本轮验证：`npm run lint` 和 `npm run build` 均通过。

## 关于 2026-05-15 本轮关键交接

本轮用户围绕 Agent 多镜头视频、重启后视频消失、停止思考、失败重试位置和视频布局继续修正。

必须记住的结论：

1. 用户实际流程是：让 Agent 生一个小故事，Agent 给了 10 个镜头文案；用户再让它生成 10 个镜头的图片分镜；最后让它生成相关视频。正确行为是按 10 个镜头生成 10 个视频，不是生成 1 个视频。
2. 旧实现只生成 1 个视频的根因：`Message` 只有 `videoUrl?: string`，`runGeneration` 的视频分支只创建一次 `/api/video`，`items[]` 只用于图片。
3. 当前已支持 Agent 多视频：`Message` 支持 `videos[] / videoPrompts / videoDimensionsMap / pendingVideoCount / failedVideoCount`；`PendingGeneration` 支持 `agentItemPrompts / agentItemSettings`；`generationMeta` 支持 `itemPrompts`。
4. Planner `items[]` 现在对视频也生效。用户要求“10 个镜头做成视频”时，应由 Planner 返回 `count=10` 和 10 个 item；前端按每个 item 并发生成视频。若 Planner 只给 count 没给 items，前端会按 count 兜底创建多段视频任务。
5. 分镜视频时长规则非常重要：把文字分镜、图片分镜或多个镜头做成视频时，每段视频时长应按该镜头分镜内容、动作复杂度和剧本中写的时长判断；不能默认都用最低秒数。只有普通单段视频、没有分镜或镜头上下文时，才用当前模型最低时长。
6. Agent 视频显示规则：成功视频、等待卡、失败卡必须在同一个两列 grid 中混排，一行 2 个，超过换行；统一 `360px` 高、`10px` 圆角、`2px` 间距。单个视频保持左半宽。
7. 失败卡重试必须原地发生。点击失败卡里的“重新生成”后，不得追加新 assistant 消息到下面；应更新原消息，把该失败格子变成等待卡，成功后填回原 grid。
8. 失败卡里的“重新生成”按钮样式：位于卡片正中间，灰色空心，透明底，灰色边框/文字/图标，前置 `reset-left-line` 图标。图片失败卡和视频失败卡一致。
9. 用户指出重启后视频文件已落盘但对话流中用户话和视频都没了。结论：视频文件保存发生在服务端，聊天历史存在浏览器 `localStorage`，不是同一个事务。为避免历史整体丢失，`saveSessions()` 不再在保存失败时删除 `yinzao-sessions-v2`。
10. 曾临时做过“启动时扫描 `public/generated/videos` 自动恢复未归档视频”，但用户重启后误恢复了早期测试视频，已按用户要求撤回。后续不要自动把本地旧视频塞进对话流。`src/lib/video-manifest.ts` 目前只记录视频任务 manifest，不自动恢复。
11. 输入框发送按钮改为正方形图标按钮：默认 `arrow-up-line`，不显示“发送”；Agent 思考中变黑色 `stop-fill` 停止按钮，带走光，仍可点击。
12. 点击停止按钮会中断当前 Agent 思考，移除 Agent pending，并插入系统消息 `已中断思考`。其它输入控件在思考中仍禁用。
13. 非红字系统消息顶部加灰色横线；红字错误系统消息不加横线。
14. 本轮修复了部分 Next dev 红色 `N` 图片尺寸 warning，但如果后续仍出现红色 N，需要打开提示看具体 issue，不要默认归因到视频逻辑。
15. 本轮中途已推送 GitHub 提交 `89723bf Update agent media generation flow`。该提交之后还有停止按钮、视频 grid、失败原地重试和文档更新等本地改动，若用户要求同步 GitHub，需要再次提交推送。
16. 本轮多次验证：`npm run lint` 和 `npm run build` 均通过。

## 关于 2026-05-15 资产管理上传、分批加载和提醒消息交接

本轮围绕资产管理页上传图片、资产多时卡顿、提醒消息规则和 Next dev 卡住继续修正。

必须记住的结论：

1. 资产管理页已支持直接上传图片。入口在资产管理内容标题右侧，不在顶部标题栏；按钮是蓝色无底，图标用 `upload-2-line`，文字为 `上传图片`。
2. 上传弹窗最多支持 `8` 张。只保留一个 `80x80` 上传入口，图片选中后入口依次后移；支持一次多选。多选超限时显示提醒 `最多同时上传8张`。
3. 上传缩略图 `80x80`、直角、完整显示不裁切。右上角删除按钮为圆形，底部黑色渐变显示图片真实尺寸。尺寸由前端读取 data URL 图片的 `naturalWidth / naturalHeight`。
4. 上传弹窗只显示当前选中图片的文件名和分类。文件名标签是 `文件名(支持改名)`，输入框右侧灰底 `X` 可清除。清空后如果不输入，失焦或切换到其它图片时恢复原文件名，上传时也用原文件名兜底。
5. 分类滑块只有 `角色图片 / 场景图片 / 分镜图片`。上传成功后资产直接写入本地资产库 `yinzao-assets-v1`，并带 `lockedType: true`。
6. 上传复用 `/api/upload-image`，服务端按内容 hash 保存到 `public/generated/upload_image`。同一张图重复上传会返回同一 URL，前端按 URL 判断重复，不重复入库。
7. 全部重复图：弹窗不关闭，重复缩略图保留并红框，提醒 `图片已存在，无需要重复添加`。混合新图和重复图：新图先入库并从弹窗消失，弹窗只留下重复图红框。
8. 全部上传成功：弹窗立即关闭，页面上方显示绿色提醒 `成功上传X张图片`。混合重复时，成功提醒和重复提醒按顺序显示。
9. 项目中自动消失的提示统一称为“提醒消息”。提醒消息高度统一 `40px`；普通提醒黑底，成功提醒绿底 `#75d06a`，成功图标 `checkbox-circle-line`；出现 `0.1秒` 从上往下，停留 `2秒`，消失 `0.1秒` 从下往上。
10. 提醒消息排队规则：当前显示期间，相同文案不重复显示也不入队；不同文案按顺序排队。当前已覆盖输入框提醒和资产上传提醒。
11. 资产管理列表已分批渲染：默认约 `30` 个，滚动到底附近再加 `30` 个。点击左侧资产管理或切换资产分类时，右侧滚动层回到顶部并重置加载数量。
12. 本轮出现过 Next dev 左下角 `N` 长时间 `Compiling...`。代码 lint/build 正常，判断是 dev 进程或 `.next` 缓存卡住；处理方式是停旧 Node 进程、清理 `.next`、重启 dev server。
13. 本轮验证：`npm run lint` 通过；`npm run build` 曾被 `.next/dev/types/routes.d.ts` 缓存错误挡住，清 `.next` 后通过。
14. GitHub：本轮这些资产上传、提醒消息和分批加载改动仍是本地改动，尚未确认提交推送。

## 关于 2026-05-15 晚些时候输入框、@资产和 Agent 图标交接

本轮围绕本地输入框细节、其它电脑兼容、`@` 资产弹窗和 Agent 图标继续修正。

必须记住的结论：

1. 其它电脑拼音输入法无法输入中文的根因是 `contenteditable` 输入框在拼音 composition 期间被重绘，打断候选上屏；五笔输入法组合态短，所以本机不容易复现。当前已加 composition 保护和防翻译/拼写插件属性。
2. `@` 资产弹窗需要包含 `待分类`，但待分类里只显示图片；视频不能 `@` 引用。
3. `@` 弹窗分类不再只显示 8 张，全部显示；弹窗可滚动。分类按钮显示 `角色图片(数量)`，弹窗宽度加到 `380px`，按钮不换行。
4. 如果没有任何可引用图片，输入 `@` 或点击 `@` 按钮时，黑框提示 `当前资产库没有图片`。
5. 输入框参考图上限现在是 `10` 张，超限提示是 `@或上传最多支持10张图片`。这只是产品侧上限放宽，未来公网 URL 传图还没做。
6. 输入框上方 `@资产` 缩略图为 `60x60`，普通上传图仍为 `100x100`。
7. 输入框右上方新增 `清空输入框` 透明按钮，图标为 `format-clear`。全局 `button { font: inherit; }` 会影响按钮字号，字号要写在内部 `span` 上。
8. `Shift+Enter` 换行已修：必须用 `<br>` 渲染并同步修正 `getEditableText / getSelectionTextOffset / setSelectionTextOffset`，否则多行后光标会错位，输入会回到第二行。
9. 思考时输入框要淡化，视觉上表示无效；停止按钮不能淡化。
10. Agent 回复和输入框 Agent 模式图标都使用 Remix `ri-ai`。`react-icons/ri` 没有 `RiAi`，所以项目本地实现 `RiAiIcon`，SVG 来自 `https://cdn.jsdelivr.net/npm/remixicon@4.9.1/icons/Editor/ai.svg`。
11. Agent 图标不要用左侧 flex + margin 硬调对齐。因为 AI 回复可能以普通段落、`# / ## / ###` 标题、`**加粗标题**`、列表、提示块或媒体说明开头，硬 margin 会顾此失彼。当前方案是把图标插入首行文本流，作为 `InlineAgentIcon`。
12. 费用估算：OpenRouter 当前 `Seedance 2.0` 是 `$7/M video tokens`，100 分钟 `1280x720` 约 `¥6532`；`Seedance 2.0 Fast` 同规格约 `¥5225`。实际费用取决于真实尺寸和平台价格。
13. 安全检查：`handover/` 没有发现明文 GitHub 密码/token/OpenRouter key；但规划目录 README 有压缩包密码说明，`AI-Video-Assistant_Project Planning/` 不要直接提交。
14. GitHub：当前远端到 `5d9aae4 Update asset mention picker`。之后的输入框上限、清空按钮、思考淡化、换行修复、Agent 图标和文档更新仍未推送。

## 关于 2026-05-11 本轮关键交接

本轮用户围绕公用 key、图片并发、尺寸、`@资产` 重新生成、模式切换提示、规则文档、图片模型尺寸实测和后续协作规则做了多次确认。

必须记住的结论：

1. OpenRouter 已改用公用 key：用户在 `E:\project\【1】Api\api key.txt` 中新增 OpenRouter 公用 key，本地 `.env.local` 已切到该 key；原个人 OpenRouter key 不应再接回项目
2. 后续协作规则最重要：任何功能逻辑、接口参数、模型参数、UI 显示、错误提示、交互规则的修改，都必须先告诉用户准备怎么改，并等用户确认；不能先自行改。排查可以读文件、看日志、说明原因，但动代码前必须问
3. 用户明确指出：之前擅自改 UI 尺寸显示、擅自改 OpenRouter `modalities` 都不符合预期；后续 AI 不能重复这个问题
4. 图片 / 视频任务并发规则已改：多批任务并发；单批多图也并发；同一会话最多 `10` 批任务；图片哪张先完成就先显示，失败只影响单张
5. 图片专业模式仍是用户输入即最终提示词，不走 Agent 优化，不显示右侧用户气泡；手动选择 `图片生成` 优先级最高，即使提示词写视频词也必须按图片执行
6. 生成图片加载慢时当前有“正在加载中”加三个跳动点作为保底提示；真正优化方向是生成 250px 缩略图缓存，但必须先问用户再做
7. 图片结果参数显示已改成真实媒体参数优先：图片生成后读取真实像素，旧图加载后也会补尺寸；视频加载 metadata 后补真实宽高。对话流和预览页的比例、尺寸、分辨率图标都应跟随真实生成文件，而不是只显示按钮选择值
8. OpenRouter 图片 `modalities` 参数已在用户确认后按模型拆开：Seedream 继续 `['image']`；Gemini / GPT 系列使用 `['image','text']`。后续再改接口参数仍必须先问用户
9. `@资产` 重新生成失效已修：专业模式媒体 assistant 消息会保存 `imageReferences`；重新生成优先用当前结果自己的 `imageReferences`，旧消息没有时从提示词中的 `@名称` 反查资产库和对话引用
10. 所有相关位置的有效 `@资产名` 显示规则统一为“小缩略图 + @名称”；用户消息、图片 / 视频专业模式提示词、旧结果可匹配引用时都应这样显示
11. 模式切换系统消息规则已修：当前模式再次点击只关闭菜单，不再插入重复系统提示；只有真正切到其它模式才插入“当前已切换到...”系统消息
12. 最新代码涉及 `src/components/chat-workbench.tsx`、`src/lib/openrouter.ts`、`src/lib/models.ts`、`src/lib/local-assets.ts`、`scripts/test-image-size-matrix.mjs`；本轮多次 `npm run lint` 和 `npm run build` 通过

当前图片生成模式规则摘要：

1. 模式优先级：手动选择 `图片生成` 后必须出图片，不能被提示词内容反向切到视频或 Agent
2. 提示词：用户输入就是最终提示词；不优化、不追问、不打字机、不右侧用户气泡
3. 参考图：明确 `@资产名` 时，只传被 `@` 的图，按文本顺序；无 `@` 时才传上传图或最近图；传图前按 URL 去重
4. 数量：`1-4张`，同批并发生成，逐张显示
5. 失败：单张失败显示单张失败卡；部分失败不影响其它成功图
6. 参数：按钮选择仍用于决定最终生成结果，但不同图片模型使用不同能力规则。旧规则曾是 Seedream `2K / 4K`、GPT-5.4 `1K / 2K`、Gemini / GPT-5 `1K / 2K / 4K`；2026-05-12 已改成以“原生尺寸 + 本地增强”规则为准
7. 显示：结果参数行和预览页显示真实生成文件参数。真实比例、真实尺寸、真实 `1K / 2K / 4K` 图标必须跟媒体文件绑定；视频也按 metadata 显示真实比例、尺寸和 `HD / FHD`

最新图片尺寸测试结论：

1. 已新增 `scripts/test-image-size-matrix.mjs`，生成一张测试图并把申请参数和真实尺寸写入根目录 `image-size-test-results.md`
2. Seedream 4.5 的 `2K` 五个比例全部一致：`16:9 2560x1440`、`4:3 2304x1728`、`1:1 2048x2048`、`3:4 1728x2304`、`9:16 1440x2560`
3. Seedream 4.5 的 `4K` 五个比例全部退回对应 `2K` 尺寸，当前 OpenRouter 链路下不能承诺 4K
4. Gemini 3.1 Flash 和 Gemini 3 Pro 的比例基本生效，但不按 `1K / 2K / 4K` 档位变化，实测固定为：`16:9 1376x768`、`4:3 1200x896`、`1:1 1024x1024`、`3:4 896x1200`、`9:16 768x1376`
5. GPT-5 Image 基本固定输出 `1024x1024`，比例参数基本未生效
6. GPT-5.4 Image 2 比例生效，但 `1K / 2K` 都输出同一组约 1K 尺寸：`16:9 1280x720`、`4:3 1152x864`、`1:1 1024x1024`、`3:4 864x1152`、`9:16 720x1280`
7. 首次矩阵测试直接 Node `fetch` 大量假 500，脚本加 `curl` 兜底后完成测试；后续排查尺寸问题时必须看请求日志和测试表，不要再只凭页面显示判断

## 关于 2026-05-12 图片原生尺寸、21:9 和本地增强超分

本轮用户要求重新测试图片模型：只传比例，不传尺寸、不传几 K。测试完后，用户确认这一组结果作为“原生尺寸”基准，后续所有增强尺寸都基于这组数据 2 倍放大。

必须记住的结论：

1. 原生尺寸表：Seedream 4.5 为 `1:1 2048x2048`、`16:9 2560x1440`、`9:16 1440x2560`、`21:9 3024x1296`、`4:3 2304x1728`
2. 原生尺寸表：Gemini 3.1 Flash 为 `1:1 1024x1024`、`16:9 1376x768`、`9:16 768x1376`、`21:9 1584x672`、`4:3 1200x896`
3. 原生尺寸表：Gemini 3 Pro 与 Gemini 3.1 Flash 相同，为 `1024x1024`、`1376x768`、`768x1376`、`1584x672`、`1200x896`
4. 原生尺寸表：GPT-5.4 Image 2 为 `1:1 1024x1024`、`16:9 1280x720`、`9:16 720x1280`、`21:9 1568x672`、`4:3 1152x864`
5. GPT-5 Image 测得所有比例都输出 `1024x1024`，比例基本不生效，因此已从图片模型列表移除
6. 图片比例新增 `21:9`，并放在 `智能比例` 后面；`21:9` 不做超分，只显示一个原生按钮。Seedream 4.5 显示 `高清2K`，其它图片模型显示 `高清1K`
7. 分辨率按钮规则：Seedream 4.5 显示 `高清2K / 增强4K`；Gemini 3.1 Flash、Gemini 3 Pro、GPT-5.4 Image 2 显示 `高清1K / 增强2K`
8. 增强档位含义：不是 OpenRouter 原生输出，而是先按原生尺寸生成，再用本地 `sharp` 做 2 倍放大。增强后只保留增强图，原生临时图删除
9. UI 显示规则：原生尺寸无需打增强标签；增强按钮上的 `增强2K / 增强4K` 要金色。对话流和预览页参数行中，普通分辨率图标后面再显示金色 `增强2K / 增强4K`
10. 后台请求规则：`/api/image` 通过 `generateOpenRouterImage` 只向 OpenRouter 传 `image_config.aspect_ratio`，不再传 `size / 1K / 2K / 4K`；服务端日志会打印 `upscale` 目标尺寸用于排查
11. 这套原生尺寸和增强超分规则只适用于 `图片生成`，不要同步到 `视频生成`
12. 主要代码涉及 `src/lib/models.ts`、`src/lib/openrouter.ts`、`src/lib/local-assets.ts`、`src/components/chat-workbench.tsx`、`package.json`、`package-lock.json`
13. 本轮验证：`npm run lint` 和 `npm run build` 通过；后续又按用户要求微调 `21:9` 顺序、单按钮占满、增强后删除原生临时图，微调后 `npm run lint` 通过

## 关于 2026-05-12 图片尺寸参数纠正、去超分和多返回图显示

本轮用户拿同事测试结果指出：Gemini / GPT 部分模型可以原生出 2K，项目此前判断“只能 1K”有误。重新测试后确认问题出在字段名。

必须记住的结论：

1. OpenRouter 当前对这些图片模型生效的尺寸字段是 `image_config.image_size`，不是旧的 `size`。
2. 图片请求现在应传 `image_config: { aspect_ratio: "16:9", image_size: "2K" }` 这类结构。
3. 本地 `sharp` 超分增强已全部移除，项目不再进行本地超分 / resize 放大。
4. `Seedream 4.5` 开放 `2K / 4K`。
5. `Gemini 3.1 Flash Image Preview` 开放 `1K / 2K / 4K`。
6. `Gemini 3 Pro Image Preview` 按用户要求开放 `1K / 2K / 4K`，虽然它同参数返回尺寸可能不稳定。
7. `GPT-5.4 Image 2` 只开放 `1K / 2K`，`4K` 会报 `image_size: Invalid option: expected one of "1K"|"2K"`。
8. `4K` 按钮和菜单显示为金色 `超清4K`；对话流和预览页参数行中，只有当前结果为 4K 时在普通 `4K` 图标后显示金色 `超清4K`。
9. OpenRouter / Gemini 3 Pro 可能一次返回多张候选图，同一响应里可同时返回 1K 和 2K。项目端不是超分，不能误判。
10. 如果一次响应返回多张候选图，项目要全部保存、全部入库、全部显示。
11. 同一批结果中如果有不同尺寸，参数行右侧显示 `< 1/2 >` 切换尺寸组，切换时比例、尺寸、分辨率图标跟随当前尺寸组变化。
12. 尺寸组默认第一页必须是最接近目标尺寸的一组，例如目标 `2K / 16:9` 时优先显示 `2752×1536`。
13. 同一尺寸组内最多显示四张图片，超过四张用图片区域右下角 `< 1/2 >` 分页，不出现横向滚动条。
14. 长提示词完整浮层的触发区域已限制在提示词正文，不要覆盖参数行，否则会挡住尺寸组切换按钮。
15. 用户要求把实测尺寸表做成文档，已在桌面生成 `图片模型尺寸测试表.docx`，并在规划文件夹保存 `图片模型尺寸测试表.md`。

## 关于 2026-05-12 启动脚本修复和本地启动慢说明

本轮用户反馈双击 `start-project.bat` 后两分钟没有打开网页，排查发现端口已启动但脚本 worker 和旧进程混乱，同时 `.next/dev` 缓存曾出现 `build-manifest.json` 缺失。

必须记住的结论：

1. `scripts/start-project.ps1` 已增加 mutex，避免重复双击产生多个 worker。
2. 健康检查地址改为 `http://127.0.0.1:3000`。
3. 打开网页改为 `explorer.exe http://localhost:3000`。
4. 等待时间增加到 5 分钟。
5. 如果再次出现启动异常，优先检查是否有旧的 `node / powershell / cmd` 项目进程，再清理 `.next` 缓存后重启。
6. 本地首次启动慢主要是 `npm run dev` 开发模式冷启动、即时编译、Windows 文件扫描和 `chat-workbench.tsx` 体积大导致，不代表服务器正式部署后也会这么慢。

## 关于 2026-05-12 视频模型官方参数、尺寸测试和 UI 做实

本轮用户要求系统测试视频模型质量、尺寸比例是否正确，并强调不要重蹈图片模型字段传错的坑。

必须记住的结论：

1. 已新增视频测试脚本 `scripts/test-video-models.mjs`，测试输出目录为 `AI-Video-Assistant_Project Planning\test`。
2. 测试视频命名规则为 `模型名_比例_720p/1080p.mp4`，结果表为 `video-model-test-results.md`。
3. 首轮测试用统一提示词测 7 个模型的 `16:9 / 720p`，后续又测 `9:16 / 1:1 / 21:9 / 3:4 / 4:3`，并按用户要求让每个比例使用不同提示词。
4. 用户后来要求移除 `Sora 2 Pro`，当前视频模型列表已不包含 Sora。
5. 查 OpenRouter 官方 `openapi.json` 后确认视频请求字段里有 `size`，定义为精确像素尺寸 `WIDTHxHEIGHT`，并说明可与 `resolution + aspect_ratio` 互换。
6. 查 OpenRouter `/api/v1/videos/models` 后确认官方能力表：Seedance Fast 支持 `480p / 720p`；Seedance 2.0 支持 `480p / 720p / 1080p`；Kling 三个模型只支持 `720p` 和 `16:9 / 9:16 / 1:1`；Veo 3.1 支持 `720p / 1080p / 4K` 和 `16:9 / 9:16`。
7. 当时判断：之前很多失败不是字段名完全错误，而是模型官方不支持对应比例或分辨率；当时曾改为传 `size`。注意：此结论已在 2026-05-13 被修正，当前最终规则是不传 `size`，只传 `resolution + aspect_ratio`。
8. `src/lib/models.ts` 新增 `VideoResolution`、`VideoRatio`、`VideoModelRule`、`videoModelRules`、`resolveVideoSettingsForModel` 等配置和方法。
9. 当时 `src/lib/openrouter-video.ts` 曾改为传 `size: "1280x720"` 这类精确尺寸。注意：此做法已在 2026-05-13 撤回，当前不传 `size`。
10. 视频智能比例保留，规则固定为 `16:9 / 1280x720`，所有当前保留模型都支持；选中智能比例时分辨率区域淡化且不可点。
11. 视频画面设置弹窗里，比例和分辨率按钮都要一行展示。比例区域已改为 `grid-flow-col + auto-cols-fr`，即使 7 / 8 / 9 个比例也不换行。
12. 当时视频比例顺序包含 `9:21`。注意：2026-05-13 实测 Seedance 系列 `9:21` 创建失败，当前项目已移除所有视频 `9:21`，顺序为 `智能比例 -> 21:9 -> 16:9 -> 4:3 -> 1:1 -> 3:4 -> 9:16`。
13. 视频分辨率按钮文案为 `标清480p / 高清720p / 全高清1080p / 4K`；前置图标统一为黑底白字 `SD / HD / FHD / 4K`，不要再用灰底或不同规格图标。
14. 对话流和预览页视频参数行必须“生成什么显示什么”：如果已读取视频 metadata，则显示真实比例、真实尺寸、真实 `SD / HD / FHD / 4K`；如果还未读取，则先显示本次实际发送给 OpenRouter 的官方 `size` 对应参数。
15. 本轮代码改动主要涉及 `src/lib/models.ts`、`src/lib/openrouter-video.ts`、`src/components/chat-workbench.tsx` 和 `scripts/test-video-models.mjs`。
16. 本轮验证：`npm run lint` 通过，但仍有旧 warning：`scripts/create-image-size-docx.mjs` 里 `existsSync` 未使用；`npm run build` 通过。

## 关于 2026-05-13 视频不传 size、非标尺寸和文档生成

本轮是在上面 2026-05-12 视频规则基础上的修正，必须以后者为准。

必须记住的结论：

1. 用户要求重新按当前 UI 接入模型全量测试视频，不算智能比例，不按时长分类，全部用最低时长。`scripts/test-video-models.mjs` 运行了 `49` 组。
2. 全量测试结果：成功 `45/49`，失败的 4 组全部是 Seedance 系列 `9:21`，上游返回 `the parameter ratio specified in the request is not valid`。因此项目已移除所有视频 `9:21`。
3. 测试发现很多输出尺寸不是 OpenRouter 官方 `supported_sizes` 里的标准尺寸，但这是模型实际返回结果，不是前端展示错误。
4. 用户追问是否又像图片那样字段错了。查 OpenRouter `/api/v1/videos/models` 后确认视频字段不是 `video_size`，报错 `Unsupported size` 说明 OpenRouter 确实识别 `size` 字段，只是不接受非标尺寸值。
5. 用户要求减少出错率。后续测试证明所有当前保留视频模型只传 `resolution + aspect_ratio`、不传 `size` 时，输出尺寸与传标准 `size` 时一致。
6. 新增 `scripts/test-video-models-no-size.mjs`，除 Seedance 2.0 Fast 外其它 5 个模型全组合共 `33/33` 成功，全部与上一轮实测尺寸一致。结果在 `AI-Video-Assistant_Project Planning\test\video-model-no-size-test-results.md`。
7. 最终项目代码已改为不传视频 `size`。当前 `src/lib/openrouter-video.ts` 的请求体只包含 `model`、`prompt`、`duration`、`resolution`、`aspect_ratio`、`generate_audio`，有参考图时加 `input_references`。
8. `src/lib/models.ts` 中 `videoModelRules.sizes` 现在是 UI 显示和兜底显示用的“实测输出尺寸”，不是请求尺寸。不要再新增 `requestSizes`，也不要把非标尺寸传给 OpenRouter。
9. 非标尺寸统一用 `nonStandardSizes` 标记。设置弹窗标题显示 `尺寸（非标）`；对话流和预览页参数行在尺寸后显示 `（非标）`。
10. `Kling Video O1` 特殊：OpenRouter 官方元数据写的是 `720p`，但本轮不传 `size` 实测用 `resolution: "1080p"` 创建成功，输出为 `1920x1080 / 1440x1440 / 1080x1920`。因此当前模型规则里 UI 分辨率显示 `1080p`，请求也随 `resolveVideoSettingsForModel` 传 `resolution: "1080p"`。后续如遇创建失败，优先重新实测该模型是否仍接受 `1080p`。
11. 当前 UI 支持项：Seedance 2.0 Fast 为 `480p / 720p` + `21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16`；Seedance 2.0 额外支持 `1080p`；Kling Standard / Pro 为 `720p` + `16:9 / 1:1 / 9:16`；Kling Video O1 为 `1080p` + `16:9 / 1:1 / 9:16`；Veo 3.1 为 `720p / 1080p / 4K` + `16:9 / 9:16`。
12. 图片和视频参数弹窗宽度统一为 `420px`。视频比例/分辨率按钮一行显示。
13. 图片模型菜单 `GPT-5.4 Image 2`、视频模型菜单 `Seedance 2.0` 的文字是金色，选中后工具栏按钮上也显示金色。
14. 提示词区 `使用提示词` 按钮修复：如果按钮已经在正文后可见，不再显示 hover 展开；只有按钮也被截掉时才显示完整浮层。
15. 文档生成：`scripts/create-video-test-docx.mjs`、`scripts/create-image-size-docx.mjs`、`scripts/create-openrouter-video-support-docx.mjs` 已生成/更新规划文件夹中的 `视频模型测试结果表.docx`、`图片模型尺寸测试表.docx`、`openrouter 视频模型支持比例和分辨率.docx`。三个 Word 表格都改成只有横线分隔，青绿色强调参数文字；视频测试结果表保留红字错误和不一致。
16. 本轮验证：`npm run lint` 无 warning，`npm run build` 通过。

## 关于 2026-05-13 Agent、费用统计、预览页和输入框最新交接

本轮用户继续围绕 Agent 连接失败、普通/高级模型切换、预览页、费用统计和输入框禁用提出需求。

必须记住的结论：

1. Agent 报 `OpenRouter 请求失败：Internal Server Error` 时，原因不是前端断连，而是 OpenRouter 对话接口偶发 500。项目已给 `/api/chat` 和 `/api/intent` 加 `curl` 兜底，同请求 `fetch` 失败后用 `curl.exe` 重试。
2. `curl` 兜底不能绕过地区限制，也不能代替代理；它只解决 Node `fetch`、TLS、连接复用、网络栈差异导致的偶发错误。明确 `403 region` 仍然是区域/权限问题。
3. Agent 请求失败不能作为 AI 回复显示，也不能带反馈按钮。当前规则是：失败追加红色 `system` 消息，只显示错误文案；图标用 `error-warning-line`。
4. Agent 工具栏 `@` 后有 `普通 / 高级` 滑块。普通走 `bytedance-seed/seed-2.0-lite`，高级走 `openai/gpt-5.4`。切换时插入灰色系统消息，重复点击当前档位不重复插入。
5. 当前思考文案是 `正在认真思考`。思考期间整个输入框禁用，不能输入、粘贴、上传、引用资产、切换模式、切换普通/高级或发送。
6. 空会话标题当前是 `今天你有什么想做的？`；反馈区末尾文案是 `感谢反馈`。
7. 标题栏右侧有当前会话用量图标，hover 黑底白字显示灰色小标题 `使用量`，下方为 `Token x,xxx`、`$0.0000`、`¥0.00 约`。汇率固定 `1 USD = 7.2 CNY`。
8. 当前费用统计已接 OpenRouter 文本、图片和视频接口 usage：Agent 对话、意图识别、图片生成和视频生成都会把返回的 `usage/cost` 累计到当前会话。
9. 文本接口如果返回 `usage.cost`，项目使用真实美元费用；否则从 OpenRouter `/models` 的 `pricing.prompt / pricing.completion` 缓存价格并按 token 估算。图片实测会返回 Token 和费用；视频实测通常只返回费用不返回 Token。
10. 视频预览页右上角下载按钮已恢复；图片和视频都显示下载，下载文件名会按 URL 自动补后缀。
11. 图片预览页缩放规则目标：`实际尺寸` 显示原图真实像素，百分比 100%，浏览器窗口变化不影响实际显示；`适合尺寸` 按当前预览区域重新计算并随窗口变化。代码已改用原生 `<img>` 和 `naturalWidth/naturalHeight`，但用户最后仍反馈“适合尺寸没有撑满预期区域”，后续接手需继续按用户截图调。
12. 预览页右侧缩略图定位已修：打开图片预览时按 `id` 或 URL 自动滚到当前缩略图。
13. 用户反馈输入框里正在打的中文会突然变英文。项目代码没有输入时自动翻译逻辑，判断是浏览器翻译/翻译插件/输入法 AI 对 `contenteditable` 文本做了替换。建议下一步加 `translate="no"`、`spellCheck={false}`、`autoCorrect="off"`、`autoCapitalize="off"`、`data-gramm="false"` 等防护。
14. 本轮后续又做了用量浮窗 UI 微调、图片/视频费用累计、品牌更名和文档更新；这些都在 `5855bc4` 之后，下一次同步 GitHub 要重新提交。

验证状态：

1. 最新代码改动后 `npm run lint` 通过。
2. 最新代码改动后 `npm run build` 通过。
2. 最新代码改动后 `npm run build` 通过。
