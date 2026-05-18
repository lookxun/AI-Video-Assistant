# Keys And Integrations

## 集成概览

当前项目使用两套核心能力：

1. `OpenRouter`
2. `OpenRouter 视频生成`

另有一个 `MiniMax Coding Plan` 信息存在于外部记录里，但用户明确说：

- 第一个 MiniMax 不用管

所以当前项目没有使用 MiniMax。

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
13. 视频请求不再默认首尾帧，不传 `frame_images`；参考图只传 `input_references`
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

当前 `.env.local` 里已经写入敏感信息。

这只是当前本地开发为了快速推进使用。

GitHub 同步规则：

1. `.env.local` 不上传 GitHub
2. `.env.example` 可以上传，只保留变量名和非敏感默认模型配置
3. 换电脑后复制 `.env.example` 为 `.env.local`，再手动填写 `OPENROUTER_API_KEY`
4. Seedance 独立聚合接口当前暂停，本地 MVP 阶段不填 Seedance 也可以继续使用 OpenRouter 对话、图片和视频链路

后续建议：

1. 本地继续用 `.env.local`
2. 服务器改成真正的环境变量
3. 不要把这些 key 暴露到前端
