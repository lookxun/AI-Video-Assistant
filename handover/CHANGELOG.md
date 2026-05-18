# Changelog

## Current Snapshot

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
- 上传参考图会作为 `frame_images` 传给 OpenRouter 视频接口，首图为 `first_frame`，第二张为 `last_frame`
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
