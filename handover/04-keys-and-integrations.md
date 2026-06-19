# Keys And Integrations

## 集成概览

当前项目使用三套核心能力：

1. `OpenRouter`
2. `OpenRouter 视频生成`
3. `BytePlus ModelArk`

另有一个 `MiniMax Coding Plan` 信息存在于外部记录里，但用户明确说：

- 第一个 MiniMax 不用管

所以当前项目没有使用 MiniMax。

## 2026-06-08 正式域名与 HTTPS 状态

- 当前正式域名解析：`main.venusface.com -> 101.47.19.109`，`api.venusface.com -> 101.47.19.109`，`ali.venusface.com -> 101.37.129.164`，`static.venusface.com -> 101.37.129.164`。
- 马来 `main/api` 已通过 certbot nginx 插件签发 Let's Encrypt 证书，证书路径 `/etc/letsencrypt/live/main.venusface.com/`，有效期到 `2026-09-06`。`https://main.venusface.com/` 和 `https://api.venusface.com/api/model-availability` 已测 200。
- 阿里 `ali/static` 因 HTTP-01 验证被公网 `Server: Beaver` 403 拦截，已改用 DNS-01 手动 TXT 验证签发证书。证书名 `flashmuse-ali-static`，路径 `/etc/letsencrypt/live/flashmuse-ali-static/`，有效期到 `2026-09-06`。阿里 Nginx 已配置 443，服务器本机 SNI 测试 `ali/static/dvideo` 都 200。
- 重要提醒：`flashmuse-ali-static` 是手动 DNS-01 证书，不会自动续期。以后要么到期前手动再走 TXT，要么接阿里云 DNS API 自动续期。
- DNS API 自动续期后续做法：创建阿里云 RAM 专用 AccessKey，权限最小化到只管理 `venusface.com` 解析；在阿里服务器安装兼容 certbot 的 Aliyun DNS 插件；凭据放 `/root/.secrets/certbot/aliyun.ini`，权限 `600`；用 DNS 插件重新签 `ali/static`，再跑 `certbot renew --dry-run`。不要使用全局管理员 AccessKey，不要把 Key 写进交接文档或 Git。

## 2026-06-05 线上部署和环境变量

- 第一版线上部署已完成，服务器资料目录：`E:\project\【2】server\马来西亚服务器`，IP：`101.47.19.109`，线上项目目录：`/var/www/flashmuse`。
- 当前访问地址为 HTTP：前台 `http://101.47.19.109`，工作台 `http://101.47.19.109/workspace`，后台 `http://101.47.19.109/admin`。
- 线上基础服务：Nginx 反代 `127.0.0.1:3000`，PM2 进程名 `flashmuse`，PostgreSQL 本地库 `flashmuse`。PM2 已设置开机自启。
- Nginx 直接映射 `/generated/` 到 `/var/www/flashmuse/public/generated/`，因此新生成或上传到服务器的文件能形成公网 HTTP URL。注意：BytePlus 素材审核最终需要 HTTPS，HTTP 只能用于功能测试。
- Nginx 也映射 `/home-assets/` 到 `/var/www/flashmuse/public/home-assets/`。当前线上首页视频为占位小 mp4，完整首页视频尚未补传。
- 线上 `.env.local` 是由本地 `.env` 的 OpenRouter/BytePlus/SMTP/Admin 配置合并后，再覆盖服务器 PostgreSQL `DATABASE_URL` 得到。不要把 `.env` 或 `.env.local` 提交 GitHub。
- 当前 HTTP 测试期开了 `FORCE_INSECURE_AUTH_COOKIE=true`。`src/lib/auth.ts` 和 `src/lib/admin-auth.ts` 都会在该开关开启时去掉生产 Cookie 的 `Secure`，否则浏览器在 HTTP IP 地址下无法保存登录态。配置 HTTPS 后必须关闭该开关。
- 管理员邮箱白名单当前为 `lookxun@163.com`，由 `ADMIN_EMAILS` 控制。后台没有独立账号表，登录仍用邮箱验证码/密码。

## 2026-06-05 线上故障排查结论

- 前台验证码能收到但进不了工作台的根因不是验证码接口。验证码验证成功、用户和 Session 都已写入数据库；真实前端错误是 `crypto.randomUUID is not a function`，因为当前是 HTTP 非安全上下文。已通过 `createClientId()` fallback 修复。
- 后台验证码能收到但进不了后台的根因同样是 HTTP 下 `Secure Cookie` 不保存。已让 `admin-auth.ts` 也支持 `FORCE_INSECURE_AUTH_COOKIE=true`。
- `/api/client-error` 是本轮临时/辅助前端错误采集接口，layout 中也有 `window.onerror` 和 `unhandledrejection` 上报。后续如果进入正式生产且已有更完整监控，可考虑移除或换成正式前端监控。
- `B_8` 生图失败不是部署或保存问题。OpenRouter Gemini 图片模型返回了纯文本场景描述，没有返回图片，因此 `/api/image` 报 `图片平台没有返回图片`。这类失败也见于 `B_5/B_6/B_7`。建议后台先关闭不稳定 Gemini 图片模型，或引导用户使用 `Seedream 4.5 / Seedream 5.0 Lite`。

## BytePlus ModelArk

用途：

1. 文本对话 / Agent 规划 / 意图识别 / 提示词反推和优化
2. 图片生成：`Seedream 4.5 / Seedream 5.0`
3. 视频生成：`Seedance 2.0 Fast / Seedance 2.0`

当前接法：

- API Key 来自 `E:\project\【1】Api key\Byteplus\Byteplus.md`，使用 `ark-...` Data Plane Key。
- Region 固定为 `ap-southeast-1`。
- 文本类接口：`POST https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions`。
- 图片接口：`POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`。
- 视频创建任务：`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`。
- 视频查询任务：`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`。

模型映射：

- `byteplus:conversation-image.seedream-4-5` -> 默认模型名 `seedream-4-5-251128`；后台打开 `解除限制` 后使用 `ep-20260514174622-n9qfb`
- `byteplus:conversation-image.seedream-5-0` -> 默认模型名 `seedream-5-0-260128`；后台打开 `解除限制` 后使用 `ep-20260514142211-p2wdk`
- `byteplus:video.seedance-2-0-fast` -> 默认模型名 `dreamina-seedance-2-0-fast-260128`；后台打开 `解除限制` 后使用 `ep-20260521134040-vf2jf`
- `byteplus:video.seedance-2-0` -> 默认模型名 `dreamina-seedance-2-0-260128`；后台打开 `解除限制` 后使用 `ep-20260521133841-nn8bg`

关键文件：

- `src/lib/system-settings.ts`
- `src/lib/openrouter.ts`
- `src/lib/openrouter-video.ts`
- `src/app/api/model-availability/route.ts`
- `src/app/api/image/route.ts`
- `src/app/api/video/route.ts`
- `src/components/byteplus-icon.tsx`

当前实现说明：

- 后台 `系统设置` 里 OpenRouter 和 BytePlus 模型互斥。前台模型下拉会通过 `/api/model-availability` 同时读取启用的 OpenRouter 与 BytePlus 图片/视频模型。
- 供应商隔离规则：OpenRouter 是当前稳定基线，相关参数、请求体、尺寸显示、扣费 metadata 和后台明细不能被 BytePlus 改动影响。BytePlus 能复用 OpenRouter 规则时先复用；不能复用时必须单独写 BytePlus 分支、尺寸表或适配函数。后续新增任何供应商也按这个规则做 provider 隔离。
- 后台 `BytePlus API` 行右侧有 `解除限制` 开关，保存为 `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS`。关闭时实际请求 `model` 使用模型名；打开时实际请求 `model` 使用 `BYTEPLUS_MODEL_SELECTIONS` 中的 `ep-...` Endpoint ID。前端和后台显示模型名称不随开关变化。
- BytePlus 图标来自用户提供的 BytePlus logo SVG，只使用前置图形，不带文字，颜色继承前端模型图标灰色。
- BytePlus 文本类路由已接入 `sendToOpenRouter()`、`planAgentTask()`、`classifyOpenRouterIntent()`，同样受 `解除限制` 开关影响：关闭时用 Endpoint 对应模型名，打开时用 Endpoint ID。
- BytePlus 图片已支持文生图、单图图生图、多图融合。图片响应读取 `data[].url`，usage 读取 `usage.output_tokens / usage.total_tokens`。对话流专业模式的多张图按张数并发多次单图请求，不使用官方 `max_images` 来保证张数。
- BytePlus 官方多图 `sequential_image_generation: "auto"` 和 `sequential_image_generation_options.max_images` 只表示最多返回几张，实测不保证返回用户选的张数，因此当前普通 `2/3/4张` 不走官方批量。流式 `stream: true` 暂未接入，只记录了 SSE 格式。
- BytePlus 视频已支持创建和查询任务。创建响应只有 `id`；查询成功响应 `status=succeeded`，视频 URL 在 `content.video_url`，usage 在 `usage.completion_tokens / usage.total_tokens`。
- BytePlus 视频参考图片默认使用 `{ type: "image_url", image_url: { url }, role: "reference_image" }`。2026-06-19 最终规则：用户明确说首帧时第一张图 role 为 `first_frame`；明确说首尾帧时第一张图 `first_frame`、第二张图 `last_frame`；单独说尾帧/最后一帧/以这张图结束时不再发 `last_frame`，而是普通 `reference_image`；不明确时仍默认 `reference_image`。参考视频、参考音频、取消任务和删除任务仍未接。
- 2026-06-19 最新修正：BytePlus 官网明确 `Image to video - first frame`、`Image to video - first and last frames`、`Multimodal reference video generation` 是互斥场景，不能混用。当前实现已改为：普通参考图模式最多 9 张，全部 role=`reference_image`；首帧模式只传第 1 张 role=`first_frame`；首尾帧模式只传前 2 张，第 1 张 role=`first_frame`、第 2 张 role=`last_frame`；单独尾帧不再传 `last_frame`，一律普通参考图。多余图片前端提示并忽略，后端 `getBytePlusEffectiveReferenceImages()` 兜底强制裁剪，不能再混传普通参考图。
- 2026-06-19 最新补充：视频诊断日志写入 `.runtime/video-diagnostics-log.jsonl`，实现位于 `src/lib/video-diagnostics-log.ts`。用于追踪 Seedance 创建、首尾帧 role 分配、自动素材审核和轮询错误。日志只记录 URL 摘要、reference kind、role、requestId、model、settings 和错误摘要，不记录完整 prompt 和完整图片 URL。
- 2026-06-04 最新确认：Seedance 2.0 直接上传含真人脸/像真人的 AI 写实角色参考图，可能触发 `InputImageSensitiveContentDetected.PrivacyInformation`。官方 API 参考明确写 `seedance 2.0` 系列不支持直接上传含有真人人脸的参考图/视频；但 `content.image_url.url` 支持素材 ID，格式 `asset://<ASSET_ID>`，用于视频生成的预置素材及虚拟人像，可从 `素材&虚拟人像库` 获取。
- 2026-06-04 最新确认：BytePlus 底层存在素材审核/创建机制。第三方 SeeDance 文档 `E:\project\【1】Api key\三方提供：seedance 2.0\SeeDance接入说明\AI聚合三方素材接口接入文档.pdf` 暴露了类似流程：提交 `originalUrl`、`type=1`、`fileType=1`、`thirdChannel=1` 创建素材，返回 `materialId=asset-xxxx`，轮询 `status=1/2/3`。错误响应中出现官方 `Action=CreateAsset`、`Service=ark`、`Region=cn-beijing`。用户明确不接第三方，只用 BytePlus 第一方；下一个 AI 需要找 BytePlus 获取第一方 `CreateAsset / 查询素材状态` 文档或控制台开通方式。
- 2026-06-04 后续实现要求：先部署公网服务器，因为素材创建接口需要 BytePlus 能下载的 `originalUrl`。部署后把上传图/资产图/生成图保存为公网 HTTPS URL，再提交 BytePlus 素材&虚拟人像库审核；审核完成后保存 `assetId`，视频生成时将审核通过图片改传 `asset://assetId`。这才是处理 AI 写实真人角色图被直接上传拦截的正式方案。
- 2026-06-05 最新补充：下一个 AI 接手后优先做公网部署。部署目标必须包括静态访问 `public/generated/...` 或等效生成文件目录，确保上传图、资产图、生成图能形成 BytePlus 可下载的公网 HTTPS URL。素材审核接口不能使用 `localhost`、内网地址或仅浏览器本地可访问路径。
- 2026-06-05 最新补充：部署后继续接 BytePlus 第一方 `素材&虚拟人像库 / CreateAsset` 机制。第三方 SeeDance 素材文档只用于证明底层流程，不接第三方接口。正式要从 BytePlus 控制台、客服或销售拿第一方创建素材、查询素材状态、素材类型、虚拟人像库权限、IP 白名单和错误码文档。
- 2026-06-05 最新补充：模型开关链路已分入口处理。`/api/model-availability` 返回 `imageModels / assetImageModels / videoModels / agentImageModels / agentVideoModels`；`/api/image` 会按 `metadata.creditSource` 判断是否为 `agent_image_generation`、资产库生成或普通对话流图片；`/api/video` 会按 `agent_video_generation` 判断是否为 Agent 自动视频。BytePlus 请求 key 分别走 `agent-image.* / agent-video.* / conversation-image.* / asset-image.* / video.*`。后续新增模型或部署后切供应商时必须保持这五组入口隔离。
- 2026-06-02 最新确认：BytePlus 视频输出尺寸不传 px `size`，由 `resolution + ratio` 控制。`resolution` 支持 `480p / 720p / 1080p`，其中 `Seedance 2.0 Fast` 不支持 `1080p`；`ratio` 支持 `16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / adaptive`。文档给出像素表：Seedance 2.0 系列 `720p 16:9=1280x720`、`720p 1:1=960x960`、`720p 9:16=720x1280`、`1080p 21:9=2206x946` 等，但请求体只传档位和比例。
- 2026-06-02 最新确认：BytePlus `Seedance 2.0 Fast / Seedance 2.0` 时长支持 `4-15秒` 的任意整数秒，代码已让前端每秒可选，服务端会把异常值 clamp 到 `4-15`。OpenRouter 视频时长规则不受影响。
- 2026-06-02 最新补充：`/api/video` 已增加 BytePlus 视频 timing 日志。创建日志记录 `createMs`，轮询日志记录 `queryMs`，完成日志记录 `queryMs / saveMs / totalMs / savedLocal / saveFailed`。日志不打印完整远程签名 URL。d28 慢视频排查显示一条 15 秒 BytePlus Fast 视频主要慢在远程 mp4 下载保存，非模型生成。
- 2026-06-03 最新补充：远程媒体保存改为 provider 通用异步队列。OpenRouter 图片/视频、BytePlus 图片/视频以及后续其它供应商，只要返回 `http/https` 远程 URL，服务端先返回远程 URL 给前端展示，再由 `src/lib/media-save-queue.ts` 后台下载到 `public/generated/images` 或 `public/generated/videos`。base64 返回继续同步保存，不进入队列。
- 2026-06-03 最新补充：新增 `/api/media-save-status`，前端每 12 秒轮询当前工作区远程媒体保存状态；保存成功后替换为本地 URL。队列状态文件 `.runtime/media-save-jobs.json` 不进 Git。后续正式多实例部署应改成数据库表或队列服务。
- 2026-06-03 最新补充：远程媒体日志统一为 `[media-save] queued / downloading / saved / failed`，包含 `requestId / model / attempts / queuedMs / downloadMs / localUrl / dimensions / host / pathTail`，不输出完整签名 URL。图片生成 timing 也带 `requestId / providerMs / saveQueueMs / totalMs`。
- 2026-06-03 最新补充：视频封面接入 `ffmpeg-static`。远程视频保存成本地后，`src/lib/video-poster.ts` 会从本地 mp4/mov/webm 抽第一帧保存到 `public/generated/video-posters`，`media-save-queue` 会把 `posterUrl` 写入 job 和 `video-manifest.json`，`/api/media-save-status` 会返回 `posterUrl`。注意 `ffmpeg-static` 在 Next/Turbopack build 中会产生一个 NFT tracing warning，但当前 build 通过。

BytePlus 图片尺寸实测：

- 测试脚本：`scripts/test-byteplus-image-size-matrix.mjs`
- 测试结果：`AI-Video-Assistant_Project Planning/test/byteplus-image-size-test-results.md`
- 原始结果：`AI-Video-Assistant_Project Planning/test/byteplus-image-size-test-raw.json`
- `Seedream 4.5 / 5.0` 都不支持 `1K`，都支持 `2K / 4K`。
- `Seedream 4.5` 不支持 `output_format` 参数，正式代码仅对 `Seedream 5.0` 传 `output_format=png`。
- `2K` 稳定尺寸：`16:9 2848x1600`、`9:16 1600x2848`、`1:1 2048x2048`、`4:3 2304x1728`、`3:4 1728x2304`、`21:9 3136x1344`。
- `4K` 稳定尺寸：`16:9 5504x3040`、`9:16 3040x5504`、`1:1 4096x4096`、`4:3 4704x3520`、`3:4 3520x4704`、`21:9 6240x2656`。
- 本轮 `Seedream 5.0` 的部分 4K 非宽高比请求超过 10 分钟超时，详见测试表。前台 BytePlus 图片分辨率应保持只显示 `2K / 4K`，不要显示 `1K`。
- 正式请求时，BytePlus 已知成功尺寸会把 `比例 + K数` 转成具体 `WIDTHxHEIGHT` 写入 `size`，例如 `21:9 / 2K -> 3136x1344`。未知组合回退传 `2K / 4K`，前端显示 `未知`。OpenRouter 仍走自己的 `image_config.aspect_ratio + image_config.image_size`。
- 2026-06-02 最新复测：`Seedream 5.0 Lite` 使用 `output_format=jpeg` 与具体 px `size`，12 个 `2K/4K` 组合全部成功，输出为 `.jpg`。新增脚本 `scripts/test-byteplus-seedream-5-lite-px-matrix.mjs`，测试结果和图片保存在 `AI-Video-Assistant_Project Planning/test`。

## OpenRouter

用途：

1. 聊天理解
2. 上下文延续
3. 提示词优化
4. 意图分类

当前接法：

- 服务端调用 OpenRouter `chat/completions`
- 路由：`/api/chat`
- 意图分类路由：`/api/intent`
- 模型列表路由：`/api/models`

关键文件：

- `src/lib/openrouter.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/intent/route.ts`
- `src/app/api/models/route.ts`

当前实现说明：

- `/api/chat` 根据 `mode` 切换系统提示词
- `agent` 模式用于创作推进、主动追问、剧本、分镜、提示词整理
- `chat` 模式用于普通自然对话，后端仍保留，但当前前端默认不再作为独立模式暴露
- `image` 模式用于结合上下文优化图片提示词
- `video` 模式用于结合上下文优化视频提示词
- `/api/chat` 会把 OpenRouter 返回的实际 `model` 字段带回前端
- `/api/models` 仍保留，但前端标题栏右侧模型下拉已移除
- `/api/intent` 会调用 OpenRouter，按最近上下文分类为 `agent` / `image` / `video` / `prompt` / `clarify`，用于 Agent 模式自动路由
- 2026-05-14 新增 `/api/agent-plan`，用于 Agent 模式的结构化任务规划。它比 `/api/intent` 更重要，会返回 `intent / needsClarification / count / subject / quality / ratio / resolution / duration / prompt / constraints / suggestions`，前端执行器再决定追问、对话、生图或生视频
- 当前对话模型固定为 `bytedance-seed/seed-2.0-lite`
- 当前中文品牌名为 `闪念`，英文名为 `FlashMuse`；OpenRouter 请求头 `X-Title` 使用 `FlashMuse`，Agent 自称、Planner 和意图分类器提示词使用 `闪念`
- 曾误用 `seed/seed-2.0-lite`，OpenRouter 会报 invalid model ID，正确模型 ID 是 `bytedance-seed/seed-2.0-lite`
- `/api/intent` 已做轻量 JSON 结构化输出解析，失败时回退到 `agent`
- AI 回复当前使用轻量标记做排版：`#` / `##` / `###` 标题、`**加粗**`、`[red]...[/red]`、`[blue]...[/blue]`、`---` 分隔线
- Agent 回复已改为结构化 JSON：`content` 为正文，`suggestions` 为独立引导系统按钮；正文不要再输出 `### 下一步调整方向`
- `suggestions` 已升级为对象数组，格式为 `{ label, action, assetTargetType }`；生成角色图用 `character_image`，生成场景图用 `scene_image`，生成图片分镜用 `shot_image`，生成分镜视频 / 做成视频用 `shot_video`
- 引导系统用于影片 / 短剧创作导航：问答阶段延展问题 + 转创作，创作阶段修改当前内容 + 推进下一步
- 当前资产库为本地 `localStorage`：`yinzao-assets-v1`；正式登录系统上线后应迁移到服务端用户资产库
- `@` 引用资产会把对应资产 URL 作为参考图传给图片 / 视频生成链路；当前 `@` 弹窗只允许选择角色图片、场景图片、分镜图片
- 上传图片会保存到 `public/generated/upload_image`，通过 `/api/upload-image` 写入本地文件；本地开发阶段传给 OpenRouter 前会转为 base64，公网部署后应改成传 HTTPS 图片 URL
- 参考图生成链路按用户文本中的 `@` 顺序传图；明确 `@` 时只传被 `@` 的图，没有 `@` 时才传输入框上方图片或最近图片；发送前按 URL 去重
- 提示词优化阶段会带低清预览图理解参考图，最终图片生成默认传原图；只有 OpenRouter 返回 413 时才自动用压缩副本重试
- 生成完成后资产入库优先使用前端任务携带的 `assetTargetType`，再用提示词文本规则兜底；命名逻辑在 `src/components/chat-workbench.tsx`
- 当前右上角用量统计会累计当前会话里 `/api/chat`、`/api/intent`、`/api/image`、`/api/video` 返回的 `usage/cost`。文本接口可用 token 估算费用；图片实测会返回 token 和费用；视频实测通常只返回 `usage.cost`，所以只加金额不加 Token
- Agent Planner 阶段不携带 base64 参考图，只传文字和“本轮带了几张参考图”的提示，避免规划阶段请求体过大；真正生成阶段仍会按参考图链路传图
- 所有前端红字错误和主要 API 错误都应通过 `src/lib/error-message.ts` 的 `toUserErrorMessage` 清洗，避免 HTML、堆栈、代码直接展示给用户
- 公网部署前必须改造参考图传参链路：本地开发阶段 `/generated/...` 图片会转 base64 传给 OpenRouter，正式部署后应先把上传图、资产图、历史参考图保存到可公网访问的 HTTPS 地址，再把 HTTPS URL 传给 OpenRouter。不要继续用 base64 传公网参考图，否则容易触发 `413 Request Entity Too Large`，也会损失原图质量和稳定性。
- 2026-05-18 补充：用户多次提到“红框中的样子 / 参考这张图”，但本地 Planner 阶段为避免 413 默认不携带历史图片，只能用文字猜。部署到公网并具备 HTTPS 图片 URL 后，应让 Planner 在这些明确看图语义下携带最新 1-2 张低清参考图 URL，提升上下文理解。

## OpenRouter 视频生成

用途：

1. 视频生成
2. 首页背景视频素材生成

当前接法：

- `POST /api/video`
  - 如果传 `prompt`：创建 OpenRouter 视频任务
  - 如果传 `taskId`：查询 OpenRouter 视频任务
- 底层接入 OpenRouter 视频接口：
  - 创建：`POST https://openrouter.ai/api/v1/videos`
  - 查询：`GET https://openrouter.ai/api/v1/videos/{jobId}`
  - 当前模型：`google/veo-3.1-lite`

关键文件：

- `src/lib/openrouter-video.ts`
- `src/app/api/video/route.ts`

首页素材补充：

- 2026-05-15 首页背景视频手动通过 OpenRouter 视频接口生成，最终文件已保存进 `public/home-assets/` 并随 GitHub 提交。
- 当前首页轮播 5 个视频：`hero-background.mp4`、`hero-dragon.mp4`、`hero-great-wall.mp4`、`hero-global-human.mp4`、`hero-mecha-robot.mp4`。
- 第一条抽象背景视频使用文本生成；后四条使用对应参考图生成：`hero-dragon-reference.jpg`、`hero-great-wall-reference.jpg`、`hero-global-human-reference.jpg`、`hero-mecha-robot-reference.jpg`。
- 首页视频生成记录在 `public/home-assets/reference-videos-manifest.json`；第一条抽象背景记录在 `manifest.json`。
- 使用模型主要为 `google/veo-3.1`，参数为 `8秒 / 1080p / 16:9 / generate_audio: false`。参考图是脚本里转 base64 作为 `input_references` 传给视频接口。

## OpenRouter 音频 / 音乐模型调研

2026-05-15 记录：

1. `google/lyria-3-pro-preview`：音乐生成，完整歌曲，OpenRouter 页面显示约 `$0.08 / 首`，输入可为文字 / 图片，输出音频。
2. `google/lyria-3-clip-preview`：音乐生成，30 秒片段，OpenRouter 页面显示约 `$0.04 / 30秒片段`。
3. `openai/gpt-audio`：`text/audio -> text/audio`，适合语音回复 / 自然配音；价格按文本 token 和音频 token 计费。
4. `openai/gpt-audio-mini`：GPT Audio 低成本版本，适合先做 MVP 语音测试。
5. `openai/gpt-4o-audio-preview`：页面说明支持音频输入，但当前音频输出暂不支持，更适合音频理解。
6. 当前没有确认 OpenRouter 里有可直接用上传音频做“音色克隆 / 参考音色”的稳定模型；角色固定音色建议后续接 ElevenLabs、MiniMax Speech、火山语音、Fish Audio 等专门 TTS / voice cloning 服务。
7. 调研结果已写成 `AI-Video-Assistant_Project Planning\OpenRouter 音频模型功能和价格.docx`，规划目录未跟踪，不要直接提交。

## 注意事项

### 1. OpenRouter 视频是异步任务模式

不是立即返回视频，而是：

1. 创建任务
2. 返回任务 id
3. 轮询任务状态
4. 成功后拿视频链接

当前轮询策略：

1. 前 2 分钟每 10 秒查一次
2. 2 分钟后每 30 秒查一次
3. 超过约 5 分钟提示重试

注意：OpenRouter 视频任务在 Node `fetch` 查询时遇到过假 `404 Not Found`，同一 URL 用 `curl` 可以正常返回 `completed`。因此 `src/lib/openrouter-video.ts` 里保留了 `curl` 兜底，不要轻易删。

### 2. Seedance 独立接口先暂停

之前从用户给的资料看，接口可能涉及 IP 白名单。

这意味着后续如果线上环境调用失败，需要优先检查：

1. 服务器 IP 是否已加白
2. 接口地址是否可达
3. 请求头鉴权字段是否完整

当前最新结论：

1. 已按 `E:\project\【1】Api\SeeDance接入说明\AI聚合三方接口接入文档.docx` 重接到 `/openApi/generate` 和 `/openApi/queryResult`
2. `.env.local` 当前 `SEEDANCE_BASE_URL` 使用 `http://14.103.147.238:19220`
3. 文档里测试环境写过 `http://8.137.157.96:9220`，但用当前 AK/SK 实测会返回 AK/SK 校验失败
4. 用 `http://14.103.147.238:19220` 实测会返回白名单错误，说明鉴权信息更匹配这个环境
5. 当前先不继续处理白名单，等后续部署服务器时再接 Seedance 独立聚合接口
6. 本地 MVP 阶段优先走 OpenRouter 视频模型

### 3. 图片生成已接入

当前图片生成通过 OpenRouter 图片模型接入。

当前默认图片模型：

1. `bytedance-seed/seedream-4.5`

当前默认视频模型：

1. `bytedance/seedance-2.0-fast`

说明：

1. `图片生成` 专业模式不再通过对话模型优化提示词，用户输入会原样作为提示词传给 `/api/image`
2. `视频生成` 专业模式不再通过对话模型优化提示词，用户输入会原样作为提示词传给 `/api/video`
3. 生成结果会保存到 `public/generated/images`
4. 图片生成请求参数当前按 2026-05-12 最新修正规则执行：传 `image_config.aspect_ratio` + `image_config.image_size`，不要再用旧字段 `size`。`bytedance-seed/seedream-4.5` 使用 `modalities: ["image"]`，Gemini / GPT 图片模型使用 `modalities: ["image", "text"]`。后续改这些接口参数仍必须先问用户。
5. 图片可选模型在 `src/lib/models.ts` 的 `imageGenerationModels`：`bytedance-seed/seedream-4.5`、`google/gemini-3.1-flash-image-preview`、`google/gemini-3-pro-image-preview`、`openai/gpt-5.4-image-2`；`openai/gpt-5-image` 因比例不生效已移除。模型尺寸规则在同文件 `imageModelRules`，项目已取消本地超分增强。
6. 视频可选模型在 `src/lib/models.ts` 的 `videoGenerationModels`：`bytedance/seedance-2.0-fast`、`bytedance/seedance-2.0`、`kwaivgi/kling-v3.0-std`、`kwaivgi/kling-v3.0-pro`、`kwaivgi/kling-video-o1`、`google/veo-3.1`；`openai/sora-2-pro` 已移除
7. 聚合接口文档位置：`E:\project\【1】Api\SeeDance接入说明`
8. OpenRouter 对 base64 图片请求体有限制，遇到 `413 Request Entity Too Large` 时，Agent 生成链路仍会压缩参考图副本重试；专业图片 / 视频模式按用户要求尽量原样传图
9. 公网部署时必须把参考图改为 HTTPS URL 传给 OpenRouter，不再传 base64。需要提前规划对象存储 / CDN / 静态资源服务、URL 持久化、历史本地路径兼容和生成接口传参改造。
10. 当前多参考图一致性仍取决于 `bytedance-seed/seedream-4.5` 的图像编辑能力；如继续跑偏，可考虑切换支持多参考图更稳定的图片编辑模型
11. 本机最新尺寸矩阵实测见根目录 `image-size-test-results.md`，但 2026-05-12 又补测了“只传比例”的原生尺寸，当前以只传比例结果为产品基准：Seedream 4.5 原生为 `2048x2048 / 2560x1440 / 1440x2560 / 3024x1296 / 2304x1728`；Gemini 3.1 Flash 和 Gemini 3 Pro 原生为 `1024x1024 / 1376x768 / 768x1376 / 1584x672 / 1200x896`；GPT-5.4 Image 2 原生为 `1024x1024 / 1280x720 / 720x1280 / 1568x672 / 1152x864`
12. 本机最新实测和 OpenRouter `/api/v1/videos/models` 能力表需要区分“官方支持项”和“实际输出”。当前保留 6 个视频模型。Seedance 2.0 Fast UI 支持 `480p / 720p`；Seedance 2.0 支持 `480p / 720p / 1080p`；Kling Standard / Pro 支持 `720p`；Kling Video O1 虽官方标 `720p`，但实测输出为 1080p 尺寸，UI 显示 `1080p`；Veo 3.1 支持 `720p / 1080p / 4K`。Veo 3.1 支持 `4/6/8秒`，Kling Video O1 支持 `5/10秒`，其它 Seedance / Kling 当前按 `5/10/15秒` 展示。
13. 视频请求不再默认首尾帧，不传 `frame_images`；默认参考图仍按普通参考图处理。2026-06-19 最终规则：明确首帧才切 `first_frame`；明确首尾帧才切 `first_frame + last_frame`；单独尾帧不切 `last_frame`，按普通 `reference_image`。
14. 视频默认尝试有声音，当前保留模型先传 `generate_audio: true`，若音频参数失败自动重试无声音。
15. 图片生成遇到过 Node `fetch` 调 OpenRouter `chat/completions` 偶发假 `500 Internal Server Error`，同请求用 `curl` 成功；当前 `src/lib/openrouter.ts` 已增加 `curlPostJson` 兜底，不要轻易删除
16. 图片返回格式可能是 `choices[0].message.images[].image_url.url` 或 `data:image/jpeg;base64,...`；当前已兼容多种结构并通过 `saveGeneratedAsset` 保存到 `public/generated/images`
17. `src/lib/local-assets.ts` 已补充 `data:` URL 的 MIME 扩展名识别，保存 base64 图片时可生成 `.jpg/.png/.webp` 等正确后缀
18. 图片生成服务端会打印 `[image-generation] OpenRouter request params`，用于确认实际发出的模型、比例、分辨率、`modalities`、`image_config` 和期望尺寸；图片 5xx 会保留同一请求体重试，不应因为重试偷偷去掉用户选择的参数
19. `sharp` 相关本地超分增强已取消。当前项目不再依赖 `sharp`，不再做本地 2 倍放大；前端收到和展示的是模型返回后保存的原图 URL。
20. 视频请求最终已改为不传 `size`，只传 `resolution + aspect_ratio`。原因是实测输出尺寸中有 `992x432 / 960x960` 等非标尺寸，作为 `size` 请求会报 `Unsupported size`；而不传 `size` 时全量复测输出尺寸与此前一致，成功率更稳。
21. 视频能力表写在 `src/lib/models.ts` 的 `videoModelRules`。其中 `sizes` 是 UI/兜底显示用的实测输出尺寸，不是请求尺寸；`nonStandardSizes` 用于显示 `（非标）`。前端比例和分辨率按钮只显示当前模型支持项；视频智能比例固定显示为 `16:9 / 1280x720`，请求传 `resolution: "720p" + aspect_ratio: "16:9"`。
22. OpenRouter / Gemini 3 Pro 可能一次响应返回多张候选图。项目会保存响应里的所有图片并返回给前端，前端按尺寸组和分页进行展示。
23. 图片生成 `/api/image` 当前会把 OpenRouter 响应里的 `usage` 透传给前端。实测 `Seedream 4.5 / 1:1 / 2K / 1张` 返回 `promptTokens: 4`、`completionTokens: 16384`、`totalTokens: 16388`、`usd: 0.04`。
24. 视频生成 `/api/video` 当前会从创建任务和查询任务响应中提取 `usage.cost`。实测已有视频任务 `P14NkUI1MIBIgF3op7KG` 返回 `usd: 0.84`，Token 为 0；前端只累计一次，避免轮询重复计费。
25. 2026-05-15 更新：`/api/video` 创建任务和查询到本地视频后会写 `src/lib/video-manifest.ts` 管理的 `public/generated/videos/manifest.json`，记录 `taskId / prompt / model / settings / localVideoUrl / remoteVideoUrl` 等信息。该 manifest 只用于记录排查，不会自动恢复到聊天对话流。
26. 2026-05-15 注意：曾短暂加入启动时扫描本地 `public/generated/videos` 并自动把未归档视频补回当前对话流的功能，但会误恢复旧测试视频，已按用户要求删除。后续不要再默认自动恢复旧视频，除非用户明确确认恢复范围和目标会话。
27. 2026-05-15 费用估算记录：OpenRouter 当前 `Seedance 2.0` 页面显示 `from $7/M tokens`，video token 公式为 `(height * width * duration * 24) / 1024`。按 100 分钟、`1280x720` 和汇率 `7.2` 算，约 `$907.20` / `¥6532`；`Seedance 2.0 Fast` 当前 `video_tokens: 0.0000056`，同规格约 `¥5225`。费用估算不是固定报价，后续以 OpenRouter 当前价格和真实输出尺寸为准。
28. 2026-05-18 图片模型补充：曾用当前 4 个图片模型尝试生成透明 Logo，结果保存到 `public/home-assets/text/`。结论是模型不能可靠直接输出真实 alpha 透明 PNG，常见结果是棋盘格假透明或绿幕背景，后续 Logo 透明图仍应优先使用设计源文件或生成纯色背景后做后处理抠图。

## 敏感信息说明

当前 `.env.local` 和 `.env` 里已经写入敏感信息。

这只是当前本地开发为了快速推进使用。

2026-05-19 最新补充：

1. `.env` 现在包含本地 PostgreSQL `DATABASE_URL`、`AUTH_SECRET` 和网易邮箱 SMTP 配置。
2. 官方网易邮箱资料和 SMTP 授权码保存在 `AI-Video-Assistant_Project Planning\闪念官方邮箱.txt`，该规划目录仍不应直接提交。
3. SMTP 发信通过 `nodemailer` 和 `src/lib/mailer.ts` 实现；配置项为 `SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / SMTP_FROM`。
4. 本机 Docker Desktop / WSL2 已安装，PostgreSQL 容器服务名为 `postgres`，容器名为 `flashmuse-postgres`，配置见 `docker-compose.yml`。
5. 如果登录时前端显示“请求失败”，优先检查 Docker Desktop 是否启动、`docker compose ps` 是否显示 `flashmuse-postgres` 正在运行、`DATABASE_URL` 是否指向 `localhost:5432/flashmuse`。
6. 认证数据表：`User` 保存邮箱、密码 hash、昵称、手机、头像 URL、语言、提醒开关、自动保存开关、生成图片/视频计数；`Session` 保存登录态 token hash；`EmailVerificationCode` 保存验证码 hash；`UserWorkspaceState` 保存登录用户的工作台 JSON 状态。
7. 2026-05-19 最新补充：用户中心资料不再放在 `UserWorkspaceState.state`，已拆成 `User` 表独立字段。接口 `/api/user-profile` 专门读写用户资料；`/api/auth/me` 也返回完整用户资料。`/api/workspace-state` 会兼容迁移旧 JSON 中的用户资料字段并清理。
8. 2026-05-19 最新补充：头像上传使用 `/api/upload-avatar`，本地开发保存到 `public/generated/user_avatar/`，数据库 `User.avatarUrl` 只保存 URL。普通聊天/资产上传仍走 `/api/upload-image`，保存到 `public/generated/upload_image/`。正式上线如文件系统不持久化，应把 `/api/upload-avatar` 和其它生成文件链路改为对象存储/CDN。
9. 2026-05-19 最新补充：忘记密码流程新增 `/api/auth/check-code` 和 `/api/auth/reset-password`。`check-code` 用于验证码输入满 6 位后先校验；`reset-password` 用当前登录用户邮箱验证码重设密码。
10. 2026-05-19 最新补充：`/api/auth/send-code` 发验证码前会做邮箱域名收信能力校验，逻辑在 `src/lib/auth.ts` 的 `canEmailDomainReceiveMail`：先查 MX，失败再查 A/AAAA。明显不存在的域名返回 `邮箱或域名不存在，请检查后重新输入`，不调用 SMTP 发信。
11. 2026-05-20 最新补充：后台管理员白名单通过 `ADMIN_EMAILS` 配置，`.env.example` 已新增该变量。本地 `.env` 已按用户要求写入管理员邮箱，但 `.env` 不提交，后续不要在公开提交或回复里展开完整环境变量。
12. 2026-05-20 最新补充：后台登录不使用前台 `flashmuse-session`，而是使用独立 Cookie `flashmuse-admin-session`，只作用于 `/admin`，有效期 8 小时。实现位于 `src/lib/admin-auth.ts`，用 `AUTH_SECRET` 派生 HMAC 签名，不写入数据库 `Session` 表。
13. 2026-05-20 最新补充：后台专用接口为 `/api/admin/send-code`、`/api/admin/verify-code`、`/api/admin/login-password`、`/api/admin/logout`。验证码仍复用 `EmailVerificationCode` 表和 SMTP 邮件发送能力，但接口会先校验 `ADMIN_EMAILS` 白名单。

GitHub 同步规则：

1. `.env.local` 不上传 GitHub
2. `.env` 不上传 GitHub
3. `.env.example` 可以上传，只保留变量名和非敏感默认模型配置
4. 换电脑后复制 `.env.example` 为 `.env.local`，再手动填写 `OPENROUTER_API_KEY`
5. 换电脑后还需要准备 `.env` 或等效环境变量，用于数据库、认证密钥、SMTP 和后台 `ADMIN_EMAILS`
6. Seedance 独立聚合接口当前暂停，本地 MVP 阶段不填 Seedance 也可以继续使用 OpenRouter 对话、图片和视频链路

后续建议：

1. 本地继续用 `.env.local`
2. 本地 `.env` 只用于 Prisma / Docker 开发环境，服务器改成真正的环境变量
3. 不要把这些 key、邮箱密码或 SMTP 授权码暴露到前端
