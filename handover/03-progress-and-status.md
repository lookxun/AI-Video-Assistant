# Progress And Status

## 当前已完成内容

### 2026-06-01 本轮最新更新：后台生成记录和积分扣费开关

- 后台积分管理 `选择积分消耗项` 已新增 `反推/优化提示词` 开关。四个开关已做实：`对话/规划` 控制 Agent/对话模型扣分，`图片` 控制所有图片生成扣分，`视频` 控制所有视频生成扣分，`反推/优化提示词` 控制所有反推和优化提示词扣分。关闭开关时不扣对应积分，但仍写 0 分流水；后台明细显示 `0（扣分关闭）`。
- 数据库 `CreditSetting` 新增 `chargePromptTool` 字段，迁移为 `20260601120000_credit_prompt_tool_switch`。已运行 `npx prisma generate` 和 `npx prisma migrate deploy`。
- 后台 `生成记录` 页面已做实，新增 `src/app/admin/admin-records-panel.tsx`。顶部卡片显示历史对话、图片生成、视频生成、上传图片、上传文件总数。主表显示 ID、用户和五类数量，且按五类记录最新时间排序。
- 生成记录展开区现在四列：第一列为 `对话流图片 / 对话流视频 / 资产库图片 / 历史对话 / 工作区保存`；第二列为 `对话流生成图片列表 / 对话流生成视频列表 / 资产库生成图片列表`；第三列为 `对话流上传图片列表 / 对话流上传文件列表 / 资产库上传图片列表`；第四列复用积分管理里的三类消耗明细。
- `对话流图片` 包含对话流生成图片和对话流上传图片；`资产库图片` 包含资产库生成图片和资产库上传图片。用户管理里的对应文案也已同步。`对话流图片` 和 `资产库图片` 打开的是大图预览弹窗，右侧缩略图不再悬停显示全图。
- 第二列三个生成列表已合并为同一个 `生成列表` 弹窗，左侧三分类，点哪个按钮默认定位哪个分类。第三列三个上传列表已合并为同一个 `上传记录` 弹窗，左侧三分类，点哪个按钮默认定位哪个分类。
- 中间两列列表弹窗的表格列已从 `生成内容 / 积分扣除 / 消耗美元 / 折算人民币` 改为 `生成内容 / 积分扣除 / 复制提示词`。有提示词才显示复制按钮；生成提示词和反推提示词都可复制。
- 本轮重新确认后台记录准则：生成记录必须以 workspace 真实记录为准，用户生成和上传过的内容都要显示；扣分异常只影响扣分显示，后续需要显示为 `0（扣分异常）`，不能影响记录是否出现。旧数据不强行追平，只保证后续新记录遵守。
- 本轮验证：多次 `npm run lint` 通过，仅剩原有两个 warning；多次 `npm run build` 通过。

### 1. 项目初始化

目录：`E:\project\AI-Video-Assistant`

已使用 `create-next-app` 初始化。

### 2. 首页工作台

已实现一个改版后的聊天工作台：

- 左侧固定侧栏
- 右侧主聊天区
- 顶部对话模型选择已移除
- 默认 `Agent 模式`
- 输入模式为 `Agent 模式` / `图片模式` / `视频模式`
- 输入框
- 发送按钮
- 图片和视频结果直接显示在对话流里
- 输入框固定在底部
- 左侧增加模式选项卡占位：对话模式 / 工作流模式 / 资产管理
- 右侧顶部 60px 固定标题栏，显示当前对话名称
- 标题栏支持当前会话重命名
- 标题栏支持收起 / 展开左侧栏
- 输入框下方工具栏支持 `+` 上传入口、模式自定义上弹菜单、参数按钮、发送按钮
- `+` 按钮可选择本地图片，并在输入框上方以约 100x100 预览
- 输入框支持粘贴图片，上传和粘贴图片最多 5 张，超过时显示黑色提示“最多上传五张图片”
- Agent 模式不显示生成参数
- 图片模式显示普通图片模型占位、比例、分辨率、风格参数
- 视频模式显示普通视频模型占位、比例、分辨率、风格、时长参数
- 参数按钮统一为 12px 字体，菜单向上弹出
- 参数菜单向上弹出，宽度跟随按钮
- 输入框外层为 ChatGPT 风格白色胶囊、灰色描边和轻阴影
- 输入框提示当前为 `输入文字，上传图片或@资产，描述生成内容...`，其中 `@` 为蓝色可点击；输入文字为 14px
- 输入框支持 Enter 发送，Shift + Enter 换行
- AI 回复支持富文本排版：标题、分段、列表、加粗、淡红 / 淡蓝提示块、灰色分隔线
- Agent 正文不再输出“下一步调整方向”；`/api/chat` 的 Agent 回复返回 `content + suggestions`，前端将 `suggestions` 渲染为独立“引导系统”按钮
- 每个历史会话拥有独立输入草稿、上传图片和生成状态
- 不同历史会话可以并发生成；同一历史会话内也可以并发生成，最多同时挂起 `10` 个任务
- AI 新回复支持逐字打字机效果，按字数控制在 1-8 秒内，旧历史消息不重新打字
- 左侧历史会话生成中会在标题前显示光环扩散动画，“正在认真思考”前也显示同款动画
- AI 头像统一为左上角同款圆角方形 MoonStar 风格
- 用户消息气泡和图片 / 视频卡片圆角统一为 12px
- AI 回复底部有反馈操作区：复制、重新生成、喜欢、不喜欢、回答不对 / 要图给视频或要视频给图、更多
- 反馈按钮悬停显示黑底白字 tooltip；复制成功显示 1 秒对勾，失败显示 1 秒 X 和“无法复制”
- 反馈区更多菜单支持“复制文字”和“删除”，菜单样式与左侧三点菜单一致
- 反馈区末尾显示 12px 灰字“感谢反馈 + 消息时间”，格式如 `2026/4/29 20:10`
- 上传 / 粘贴图片会随用户消息进入对话流，Agent 可做图片理解，图片模式可参考图生图，视频模式可按首帧 / 视觉参考生视频
- 用户说“刚才那张图、图中、让它动起来、首帧”等，会自动取最近对话图片作为参考
- Agent 自动路由已收紧，“看看 / 分析 / 点评 / 识别图片”不会误触发生图
- 发送后用户消息会立即显示，输入框立即清空，按钮显示 `发送中...`，避免用户误以为卡住重复点击
- 同一会话发送中会防重复，同一请求回复会防重复，避免一条用户消息出现多条 AI 回复
- Agent 简单问候走本地短回复，Agent 提示词已收紧为默认一问一答，不随便分段和输出多个追问
- 左侧栏品牌文案已改为“闪念 / AI影片助手”，Logo 底色 `#6667ff`、图标白色
- 左侧“开启新对话”已改成“新建对话”，使用 `Plus` 图标，文字居中且图标在居中文字左侧
- 左侧历史选中态多次尝试后已按用户要求回到最初灰色 `#ececec`
- 图片 / 视频生成请求发出后会立即显示状态卡片，不再等提示词优化或任务创建完成
- 图片 / 视频生成中状态卡片为 400x400、12px 圆角、蓝紫青渐变随机运动动画，左上角显示生成 / 渲染中百分比，底部显示状态和已等待时间
- 图片 / 视频生成中不再额外显示“正在认真思考”
- 视频生成完成后会直接在对话流中显示内嵌视频卡片，不再显示“打开视频”按钮
- 视频卡片按比例缩小展示，最大高度约 520px，保留播放器控件；鼠标悬停自动播放，移开自动暂停
- 刷新浏览器后会恢复刷新前所在历史对话，当前会话 ID 保存在 `yinzao-active-session-v1`
- Agent 模式在意图识别阶段会立即显示“正在认真思考”，避免等待 `/api/intent` 时页面无反馈；识别到图片 / 视频后再显示对应等待卡片
- 引导系统按钮位于 AI 反馈图标下方，按钮样式参考豆包：浅灰底、右侧箭头、文字当前 14px、圆角 8px；点击后作为下一条 Agent 消息发送
- Agent 引导规则已更新为影片 / 短剧创作流程导航：问答阶段给问题延展 + 转创作，创作阶段给当前内容修改 + 下一步创作
- Agent 引导按钮已升级为 `{ label, action, assetTargetType }` 对象；前端兼容旧字符串 suggestions，生成类按钮会携带 `assetTargetType`
- 引导系统只在最后一条 AI 回复下显示；用户点击引导按钮或发送新消息后旧引导消失；用户只是在输入框打字时引导不消失
- 资产管理已开放，点击左侧“资产管理”后，历史对话列表区域切换为“我的资产”分类：全部资产、角色图片、场景图片、分镜图片、分镜视频、其它
- 资产管理右侧为网格缩略图：所有小图正方形、直角、无圆角，大屏 5 列时约 195x195；底部有黑色渐变，左下显示名称
- 资产卡片右上角文件夹图标用于修改分类；右下角三点菜单用于重命名和删除；小菜单点击空白处都会关闭
- 图片资产左下显示 `@资产名`，点击名称可引用；视频资产不显示 `@`，也没有引用功能
- `@` 引用弹窗可由输入 `@`、点击 placeholder 蓝色 `@`、点击输入框工具栏 Agent 模式后的 `@` 按钮触发
- `@` 弹窗只展示角色图片、场景图片、分镜图片三个标签按钮及数量；没有资产的标签不可点；选择资产后输入框插入 `@资产名`
- 输入框内 `@资产名` 以蓝色显示；由于 textarea 不能局部上色，当前使用透明 textarea + overlay 实现
- `@` 按钮现在在 Agent / 图片 / 视频三种模式都显示；`@` 弹窗点击空白区域会关闭，点击弹窗内部不会关闭
- 输入框上方参考图缩略图统一展示上传图和 `@资产` 图：`100x100`、圆角、灰边框、底部黑渐变显示 `@名称`；普通上传图不自动插入 `@文件名`，`@资产` 会插入文字并加入缩略图
- 输入框最多 5 张参考图，上传、`@资产`、资产管理引用、资产预览引用、历史用户消息缩略图再引用共用上限，超过时提示“最多上传五张图片”
- 发送后的用户消息下方会横排显示本次参考图缩略图，点击可继续引用；用户消息文字中的有效 `@名称` 后会显示小图缩略图
- 上传图片发送前保存到 `public/generated/upload_image`，按内容 hash 去重，刷新后用户消息缩略图不丢；上传图会按原文件名自动入库资产管理，已存在同 URL 则不重复入库
- 参考图解析现在严格按用户文本中的 `@` 顺序传图；明确 `@` 时只传被引用图片，没有明确 `@` 才传本次上传图或最近图片；最终发送前按 URL 去重
- 图片 / 视频生成前的提示词优化阶段会带低清预览图（`512px / 0.72`）理解参考图，若请求体 413 则退回纯文本；最终图片生成先传原图，只有 413 时才用 `1280px / 0.85`、`1024px / 0.78` 两级压缩副本重试
- 资产入库优先使用生成任务的 `assetTargetType` 分类，不再单靠提示词猜角色 / 场景 / 分镜
- 资产命名规则已更新：角色 / 场景优先用剧本或提示词中的名字，否则 `角色1`、`场景1`；分镜用 `剧名_分镜01_1`，无剧名用 `无名剧01_分镜01_1`；普通图片 / 视频用 `image01` / `video01`；多版本追加 `_2`、`_3`
- 动物 / 植物主体会从提示词或上下文提取贴切名称，如 `小狗`、`彩色荧光猫`、`科幻兔`；当前还不是看图识别
- AI 正文排版已增强：`- 小标题：内容` 和 `1. 小标题：内容` 会转成圆点列表，冒号前文字加粗，避免正文里出现生硬短横线
- “正在认真思考”和左侧历史对话运行中动画已统一为 3x3 点阵，淡蓝底常驻，深蓝随机闪烁，周期 `3.14s`；左侧历史动画现在会跟意图识别阶段同步出现
- 修复 React/Next dev 红色错误：同一条消息里重复图片 URL 时，图片列表 key 改为 `message.id + url + index`，避免 duplicate key 报错
- 工作流模式已开放为可点击占位页：左侧图标未选中 `git-pull-request-line`、选中 `git-merge-line`，顶部“未开放”保留，右侧当前为空的灰色网格背景
- 工作流模式左侧二级列表已独立：标题改为“我的工作流”，按钮改为“新建工作流”；新建名称按 `工作流_01`、`工作流_02`、`工作流_03` 递增，本地保存到 `yinzao-workflows-v1`
- 工作流项右侧三点菜单已和历史对话对齐，支持置顶、重命名、删除；当前点击工作流本体不触发右侧内容变化，仍保持占位
- 左侧“我的资产”分类图标已更新并统一到一级菜单大小：角色图片 `account-box-line`、场景图片 `landscape-line`、分镜图片 `multi-image-line`、分镜视频 `film-line`
- 左侧“其它”分类文案已改为“待分类”；右侧对应分组标题改为“待分类图片”和“待分类视频”
- 资产管理已新增“回收站”分类；删除资产时不再直接移除，而是进入回收站，保留 30 天
- 回收站右侧顶部显示红字提示“回收站中的内容将在30天后删除，不可恢复。”；回收站资产右上角不再显示改分类按钮，改为倒计时角标，按剩余时间自动显示“天 / 小时 / 分钟”
- 回收站资产右下角三点菜单里的“删除”已改为“恢复”；回收站到期后会自动从本地资产列表移除，并通过新增 `/api/asset-delete` 删除 `public/generated/...` 下本地图片 / 视频文件
- 资产分类菜单已按媒体类型收紧：图片资产只能改到“角色图片 / 场景图片 / 分镜图片 / 待分类”，视频资产只能改到“分镜视频 / 待分类”，图片和视频不能互相改进对方分类
- 所有资产分类在当前没有内容时，右侧中间显示灰字“当前没有内容”；仅在整个资产库为空时继续显示原始全局空状态说明
- 输入框工具栏按钮颜色已继续细调：除模式选择按钮外，其它按钮文字和图标统一改成更浅灰色，`+` 上传和底部 `@` 也同步变灰；placeholder 文案整体也再降了两档灰度，蓝色 `@` 保持不变
- 输入框相关弹窗已统一：同一时间只允许出现一个，切换另一个弹窗或点击输入框空白区域时上一个会关闭；弹窗主圆角统一 `12px`，内部卡片约 `8px`，外层灰色描边已去掉，仅保留白底和阴影
- 输入框模式菜单、参数菜单和 `@` 资产菜单的字体、图标、圆角和间距都已继续放大和统一；模式菜单当前项仍保持蓝色，其它按钮文案统一显示当前选择
- 画面设置弹窗已按参考样式重做：标题为“选择比例 / 选择分辨率 / 尺寸”，比例和分辨率都改成浅灰底板 + 选中白卡浮起结构；比例顺序改为 `智能比例`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`
- 画面设置弹窗底部新增尺寸展示区：`W × H PX` 会根据当前比例和分辨率自动联动变化；当前是前端映射展示，不代表后端真实返回尺寸
- 画面设置内的分辨率图标已细化：图片 `1K / 2K / 4K` 与视频 `HD / FHD` 都已做成独立图形样式
- 三种创作模式的参数状态已拆开：`Agent / 图片生成 / 视频生成` 的比例、分辨率、时长、图片数量互相独立，切换模式后按钮显示会立即刷新为该模式自己的值
- 图片模式新增“同时生成数量”按钮，选项为 `1张 / 2张 / 3张 / 4张`；当前仅完成前端按钮和独立状态，尚未把数量真正接到 `/api/image`
- 模型按钮图标已不再依赖 `react-icons` 的可用导出，当前直接使用用户指定 CDN 中 `ai-generate-3d-line` 的原始 SVG，本地内联到组件中，避免图标库缺失导致编译失败
- 图片 / 视频模型选择已做实，模型按钮显示当前模型全名并传给后端；模型菜单和按钮按厂商显示图标：OpenAI `openai-fill`、Google `google-fill`、字节 `tiktok-fill`、其它用本地 `ai-generate-3d-line`
- 图片可选模型：`Seedream 4.5`、`Gemini 3.1 Flash Image Preview`、`Gemini 3 Pro Image Preview`、`GPT-5 Image`、`GPT-5.4 Image 2`；本机实测只有 `Seedream 4.5` 可用，Google / GPT 图片模型返回地区不可用 `403`
- 视频可选模型：`Seedance 2.0 Fast`、`Seedance 2.0`、`Kling v3.0 Standard`、`Kling v3.0 Pro`、`Kling Video O1`、`Veo 3.1`、`Sora 2 Pro`；本机实测均可创建并完成任务
- 图片 / 视频专业模式不再优化提示词，不显示右侧用户气泡，用户输入作为左侧生成结果上方提示词直接显示；专业模式提示词不走打字机，`Agent 模式`保持不变
- 图片 / 视频结果下方不再显示引导按钮，引导系统只属于 `Agent 模式` 最后一条 AI 回复
- 图片同时生成数量已接入 `/api/image`，后端按 `1-4` 张顺序生成；遇到空返回、OpenRouter 5xx 或参数错误会重试，尽量补齐数量
- 视频时长会按模型动态变化：Seedance / Kling 为 `5/10/15秒`，Veo 为 `4/6/8秒`，Sora 为 `4/8/12/16/20秒`；后端会按模型支持值传参
- 视频参考图已取消默认首尾帧规则，不再传 `frame_images`，只传 `input_references`；默认尝试有声音，音频参数失败再自动退回无声音
- 媒体结果区最大宽度改为 `1006px`；图片结果和图片等待卡固定 `250x250px`，四张横排间隔 `2px`，图片完整居中不裁切
- 输入框当前模式、模型、比例、分辨率、视频时长、图片数量会保存到 `yinzao-input-settings-v1`，刷新后保持当前选择
- 图片 / 视频结果上方的提示词区已继续重做：默认只显示 `2` 行，末尾右侧渐隐；鼠标悬停后会在原位上方展开白色毛玻璃浮层查看完整提示词，不会把下面内容顶下去
- 提示词下方新增本次生成参数行：左对齐灰字显示模型、比例、尺寸；图片分辨率图标 `1K / 2K / 4K` 和视频 `HD / FHD` 图标均放在尺寸后方，视频图标颜色已调成与参数文字一致的灰色
- 提示词区新增“复制提示词”按钮：默认状态下为灰色按钮、约 `22px` 高，跟在提示词最后；悬停展开的毛玻璃浮层中同按钮会切换成黑色毛玻璃样式、约 `26px` 高；按钮文字字号需写在内部 `span` 上才会生效
- 图片 / 视频两批生成结果之间的上下间距已继续拉开；提示词、参数行与生成出的图片 / 视频之间间距也已多轮压缩，避免媒体结果离提示词过远
- 图片生成重试逻辑已修复：普通 5xx 或空返回重试时继续保留用户选择的比例和尺寸参数；只有平台明确报 `image_config / aspect_ratio / size` 不支持时才去掉这些参数，避免四张图里某一张因为重试丢尺寸
- 反馈区“复制”按钮显示规则已收紧：只在 `Agent 模式` 的纯文字回复下显示；只要该条消息携带图片或视频结果，就不再显示这个复制按钮
- 输入框与聊天内容区已正式拆成两层：聊天消息留在滚动层，输入框本体作为独立悬浮层固定在底部上方；输入框本体样式基本保留，只去掉外层承托白底
- 输入框本体当前已调整为白色毛玻璃效果：半透明白底、白色弱边框、毛玻璃模糊、原有圆角和阴影保留；右侧页面和聊天滚动区底色保持白色，不再显示底部“AI 可能会出错”及对话 / 图片 / 视频模型测试字样
- 聊天区底部安全区已增加到约 `360px`，滚动到底时最后一条内容会停在输入框上方，尽量避免被遮挡；“回到底端”按钮已提升到更高层级并补上 `pointer-events-auto`，与图片重叠时仍可优先点击
- 本轮补充：图片 / 视频专业模式中，用户手动选择的模式优先级最高，不能因为提示词里写“视频 / 一段 / 图片 / 海报”等词而自动切模式；图片模式要把视频化表达理解成单帧图片，视频模式要把静态图表达补成视频描述
- 本轮补充：专业模式生成中不再显示“我已经开始生成图片 / 视频，结果出来后会直接显示在这里。”；成功和失败都必须显示该批任务自己的提示词，失败只在红字错误区域显示真实错误
- 本轮补充：视频结果参数行已显示真实时长；取当前消息的 `generationMeta.settings.duration`，不要取当前面板临时值
- 本轮补充：图片生成已增加 OpenRouter `curl` 兜底。直接 `fetch` 偶发返回 `Internal Server Error`，但同请求用 `curl` 可以成功；现在图片请求失败后会自动用 `curlPostJson` 重试
- 本轮补充：OpenRouter 图片返回解析已兼容多种结构，并且本地保存 `data:image/...;base64,...` 已补 MIME 扩展名识别
- 本轮补充：明确比例时图片生成不再同时传固定正方形 `size`，避免 `aspect_ratio` 与 `size` 冲突；参数失败或 5xx 重试会去掉 `image_config`
- 本轮补充：`Sora 2 Pro` 长视频轮询上限已按时长放宽，尤其 `20秒` 不再过快停止；停止自动等待的文案不再称为失败
- 本轮补充：提示词区的“复制提示词”已改成“使用提示词”，图标 `t-box-line`，功能是把当前提示词填入输入框并聚焦；完整提示词浮层里的按钮单独成行、右对齐
- 本轮补充：提示词区只在真实 DOM 渲染超过两行时才出现渐隐和 hover 完整框；两行内能完整显示时不触发完整框；完整框的前两行文字位置要与默认状态重合，只向下展开
- 本轮补充：图片 / 视频结果的“重新生成”必须绑定当前这条 assistant 媒体结果自己的 `generationMeta.originalPrompt` 或 `message.content`；不再依赖上一条用户消息，不插入用户气泡，不串 Agent；Agent 重新生成仍依赖上一条用户消息
- 本轮补充：输入框本体最终恢复为 `bg-white/78 + backdrop-blur-[18px]`，默认淡灰描边 `#f1f2f2`、无阴影，`focus-within` 后白色描边和外阴影；工具按钮使用 `.yinzao-tool-button` 毛玻璃样式，上传按钮额外 `.yinzao-tool-button-round` 保持圆形
- 本轮后续更新：输入框已从 `textarea + DraftInputOverlay` 双层模拟改为单层 `contenteditable`；有效 `@资产名` 直接在同一层文字中变蓝，减少选中重影和两层字问题
- 本轮后续更新：`@` 逻辑已按当前光标位置生效。先输入文字后再输入 `@`、点击底部 `@` 按钮、点击缩略图或资产选择，都应插入到光标处；选择资产会替换光标前正在输入的 `@xxx`
- 本轮后续更新：输入框文字上限从 `1000字` 改为 `2000字`；超过后复用黑色自动消失提示框显示“最多输入2000字”；复制 / 粘贴大段文字后，输入框内部滚动条自动滚到底部跟随最后文字
- 本轮后续更新：输入框宽度策略为默认优先 `800px`，当底部按钮组合、模型名或长文本需要更多空间时才逐步加宽，最高约 `1006px`；底部按钮必须一排显示，文字不换行，按钮不重叠；不要给工具栏外层加会裁剪菜单的 `overflow-x-auto`
- 本轮后续更新：长提示词 hover 展开框限制最大高度 `250px`；顶部标题行固定，不参与滚动；左侧灰字“当前使用的提示词”加信息图标，右侧同一行是“使用提示词”按钮；正文在标题行下方单独滚动
- 本轮后续更新：新对话默认第一句已删除，初始 `messages` 为空；模式切换会插入 `role: "system"` 的灰色系统提示消息，使用对应模式图标，“当前已切换到XX模式”加粗，说明文字同一行跟在后面；只有系统提示、无用户输入的会话仍算空会话，不应产生多个有效历史
- 本轮后续更新：图片生成失败卡使用成功图片同款灰底，每张 `250x250`，按用户选择数量显示；左上显示 `emotion-sad-line + 图片生成失败`；红色真实错误文案恢复显示在卡片下方
- 本轮后续更新：视频等待 / 成功 / 失败展示已按图片样式统一为单个 `640x360` 灰底区域；等待卡只显示进度和已等待时间；失败卡左上显示 `emotion-sad-line + 视频生成失败`；红色真实错误文案显示在卡片下方
- 本轮排查：一次视频创建失败的真实 OpenRouter 错误为 `InputImageSensitiveContentDetected.PrivacyInformation`，提示 `input image may contain real person`，说明参考图可能包含真人隐私信息被平台拒绝；这不是已确认的比例 / 时长参数组合问题
- 本轮继续更新：视频轮询自动停止上限已移除。此前普通 Seedance / Kling 实际只轮询 `12` 次、约 `2` 分钟就显示“已停止自动等待”，与文档写的约 5 分钟不一致；现在只要平台没有返回失败 / 过期状态，就会一直等待。前 2 分钟每 10 秒查一次，之后每 30 秒查一次
- 本轮继续更新：同一会话允许并发发送任务，不再因为已有任务生成中就禁用发送。当前每个会话最多同时挂起 `10` 个任务，超过后发送按钮显示“任务已满”；任意任务完成或失败后释放名额
- 本轮继续更新：会话状态从单个 `pendingRequest` 扩展为 `pendingRequests` 队列，并兼容旧 `pendingRequest` 字段；页面会恢复并继续运行队列里未完成的任务，媒体等待卡按各自 `requestId` 判断和更新
- 本轮最新更新：图片 / 视频预览页已重做为全屏结构。点击图片缩略图或视频结果会打开预览页，顶部留空，左侧为毛玻璃底媒体预览区，右侧为固定提示词区；左侧主媒体不加滤镜、不加圆角
- 本轮最新更新：图片默认 `适合尺寸`，可点 `实际尺寸` 回到真实像素 `100%`；滚轮和 `+ / -` 会从当前可见比例继续缩放，范围 `10% - 250%`，缩放后不显示滚动条，可拖拽移动图片
- 本轮最新更新：视频也接入预览页，按适合尺寸完整显示；当前媒体是视频时，左上缩放工具按钮保持透明禁用态，右侧缩略图列表里视频缩略图左上显示视频图标
- 本轮最新更新：右侧预览信息区文件名下显示参数，分辨率使用 `CompactResolutionIcon`；提示词标题统一为“图片提示词”，右侧黑色“使用提示词”按钮会填入输入框并关闭预览页
- 本轮最新更新：当前对话媒体超过 `2` 个时，左侧右边出现浮层缩略图列表，`50x50`、`5px` 圆角、`2px` 描边，选中蓝色 `#367cee`；打开预览会自动定位到当前缩略图，列表能完整显示时不显示上下按钮，需要滚动时才显示上下按钮，滚动条隐藏
- 本轮最新更新：已把这些代码提交并推送到 GitHub `main`，提交 `2094e9f Update media generation workspace`；换电脑时按 `00-README.md` 执行 `git clone`、`npm install`、配置 `.env.local`、`npm run dev`
- 2026-05-26 后续更新：角色图片生成界面右侧继续细调为竖版输入框式 UI。当前顶部控件为比例下拉、风格下拉、模型下拉和 K 数下拉；参数行只显示比例、尺寸和分辨率图标；提示词输入框和生成按钮按用户要求调整了边距、高度、圆角、聚焦描边和按钮位置。
- 2026-05-26 后续更新：角色生成界面默认独立为 `GPT-5.4 Image 2` + `2K`，K 数按该界面当前模型支持项动态显示。该设置不再跟随对话流图片生成模型当前选择。
- 2026-05-26 后续更新：资产库预览已加 `previewMeta` 回填，优先通过资产的 `sessionId / messageId / url` 反查原 assistant 消息，并标准化 URL 后匹配。旧资产如果历史消息里没有对应生成消息，仍可能没有参数。
- 2026-05-11 更新：本地 OpenRouter API key 已改用 `E:\project\【1】Api\api key.txt` 中的公用 key，项目中不再使用原个人 key；`.env.local` 仍不上传 GitHub。
- 2026-05-11 更新：图片 / 视频任务并发规则已升级。多批任务之间并发；单批图片内部也并发，`1-4` 张同时发起单图请求；哪张先完成哪张先显示，未完成位置继续等待，失败位置显示失败卡。
- 2026-05-11 更新：图片结果支持部分成功和部分失败。成功图、等待卡、失败卡可在同一批里混排；如果部分失败，红字显示失败数量，其它已完成图片保留。
- 2026-05-11 更新：图片文件保存后浏览器渲染慢时，图片卡片左上角显示“正在加载中”与跳动点。当前只是保底提示，后续可考虑生成缩略图缓存提高加载速度。
- 2026-05-11 更新：专业模式点击“重新生成”会保留 `@资产` 引用和参考图；新消息保存 `imageReferences`，旧消息可从提示词里的 `@名称` 反查资产库 / 对话引用。
- 2026-05-11 更新：用户消息和图片 / 视频专业模式提示词中的有效 `@资产名` 会在 `@名称` 前显示小缩略图，显示顺序统一为“小图 + @名称”。
- 2026-05-11 更新：当前模式再次点击不再重复插入系统提示；只有模式真正变化时才插入切换系统消息。
- 2026-05-11 待定：`GPT-5.4 Image 2` 和部分模型的真实输出尺寸可能与前端选择尺寸不一致；当前页面仍显示用户选择 / 前端映射尺寸，后端继续传 `image_config.size`，真实尺寸展示和模型能力限制后续待确认。
- 2026-05-11 待定：OpenRouter 图片 `modalities` 参数当前按用户要求保持 `['image']`；此前尝试过非 Seedream 改 `['image','text']`，已撤回。后续任何接口参数修改必须先问用户。
- 2026-05-11 更新：用户要求将项目规则整理为普通人能看懂的文档，已在 `AI-Video-Assistant_Project Planning` 新增 `00-rules-index.md` 到 `12-ui-style-rules.md`，并生成同名 `.docx`。`.docx` 用真实字号层级，便于用户后续用红字标规则改动；该规划文件夹 README 明确要求内容不准删除。
- 2026-05-11 更新：图片结果加载提示去掉白色圆角底，只保留“正在加载中”和跳动点。
- 2026-05-11 更新：图片和视频结果参数显示改为真实媒体参数优先。图片生成保存后会读取本地真实像素；旧图片在缩略图或预览页加载后也会补真实尺寸。视频在对话流或预览页加载 metadata 后会补真实宽高。对话流和预览页参数行会按真实宽高显示比例、尺寸和 `1K / 2K / 4K` 或 `HD / FHD` 图标。
- 2026-05-11 更新：图片模型尺寸规则已拆成模型配置，主要在 `src/lib/models.ts`。`Seedream 4.5` 只开放 `2K / 4K`；`GPT-5.4 Image 2` 只开放 `1K / 2K`；Gemini 3.1 Flash、Gemini 3 Pro、GPT-5 Image 开放 `1K / 2K / 4K`。切换模型后，如果当前分辨率不支持，会自动回落到该模型默认可用档位。
- 2026-05-11 更新：图片请求参数按模型分开。Seedream 继续 `modalities: ["image"]` 并按官方映射传像素尺寸；Gemini / GPT 系列改为 `modalities: ["image", "text"]`，并传 `size: "1K" / "2K" / "4K"` + `aspect_ratio`。`src/lib/openrouter.ts` 会打印 `[image-generation] OpenRouter request params`，用于核对实际发给 OpenRouter 的参数。
- 2026-05-11 更新：“智能比例”临时规则：选择当前模型最小可用分辨率的 `16:9`。选择智能比例后，分辨率按钮和尺寸区域淡化，分辨率按钮不可点；底部按钮显示也会同步为真实执行档位，例如 Seedream `智能比例 / 2K`、GPT-5.4 Image 2 `智能比例 / 1K`。
- 2026-05-11 测试：新增 `scripts/test-image-size-matrix.mjs`，用于逐模型 / 档位 / 比例生成一张图并记录申请参数和真实尺寸；结果写入 `image-size-test-results.md`。脚本首次直接 fetch 时大量遇到假 500，后续加 `curl` 兜底后完成完整矩阵。
- 2026-05-11 测试结论：Seedream 4.5 的 `2K` 五个比例全部与申请尺寸一致；Seedream 4.5 的 `4K` 五个比例全部退回对应 `2K` 尺寸。Gemini 3.1 Flash 和 Gemini 3 Pro 比例基本生效，但 `1K / 2K / 4K` 档位都输出同一组偏大的 1K 尺寸：16:9 为 `1376x768`，4:3 为 `1200x896`，1:1 为 `1024x1024`，3:4 为 `896x1200`，9:16 为 `768x1376`。
- 2026-05-11 测试结论：GPT-5 Image 基本只输出 `1024x1024`，比例参数基本未生效。GPT-5.4 Image 2 比例生效，但 `1K / 2K` 档位都输出同一组约 1K 尺寸：16:9 为 `1280x720`，4:3 为 `1152x864`，1:1 为 `1024x1024`，3:4 为 `864x1152`，9:16 为 `720x1280`。因此当前 OpenRouter 链路下不能承诺 GPT-5.4 Image 2 真正出 2K。
- 2026-05-12 测试：按用户要求重新测试 5 个图片模型，只传 `aspect_ratio`，不传尺寸和几K；比例为 `1:1 / 16:9 / 9:16 / 21:9 / 4:3`。结果被用户确认为“原生尺寸”基准。
- 2026-05-12 测试结论：Seedream 4.5 原生为 `2048x2048 / 2560x1440 / 1440x2560 / 3024x1296 / 2304x1728`；Gemini 3.1 Flash 和 Gemini 3 Pro 原生为 `1024x1024 / 1376x768 / 768x1376 / 1584x672 / 1200x896`；GPT-5 Image 原生全部为 `1024x1024` 且比例不生效；GPT-5.4 Image 2 原生为 `1024x1024 / 1280x720 / 720x1280 / 1568x672 / 1152x864`。
- 2026-05-12 更新：`GPT-5 Image` 已从图片模型列表移除；图片比例新增 `21:9`，并放在 `智能比例` 后；`21:9` 不走超分，Seedream 显示 `高清2K`，其它图片模型显示 `高清1K`，单个分辨率按钮横向占满。
- 2026-05-12 更新：图片分辨率按钮规则改为每个模型只保留两个常规档位：Seedream 4.5 为 `高清2K / 增强4K`，其它图片模型为 `高清1K / 增强2K`。原生档位不打增强标签，增强档位金色显示。
- 2026-05-12 更新：图片请求参数改为只传 `image_config.aspect_ratio`，不再传 `size / 1K / 2K / 4K`；服务端日志仍会打印真实请求参数和是否需要超分。此规则只作用于图片生成，不影响视频生成。
- 2026-05-12 更新：已新增 `sharp` 依赖并在 `src/lib/local-assets.ts` 加 `upscaleGeneratedImageAsset`。选择增强档位时，生成原生图后用 `sharp` 按原生尺寸 `x2` 放大，保存增强图并删除原生临时图，前端只展示增强图。
- 2026-05-12 更新：对话流和预览页参数行中，增强结果会在普通分辨率图标后显示金色 `增强2K / 增强4K`；按钮上也显示金色增强文案。最终尺寸以本地真实文件尺寸为准。
- 2026-05-12 后续更新：重新实测确认 OpenRouter 图片尺寸字段应使用 `image_config.image_size`，不是旧字段 `size`。图片请求现在传 `image_config: { aspect_ratio, image_size }`。
- 2026-05-12 后续更新：本地 `sharp` 超分增强已全部移除，项目不再进行任何本地超分 / resize 放大，最终图片只保存模型原始返回结果并读取真实尺寸。
- 2026-05-12 后续更新：图片模型档位改为实测开放。`Seedream 4.5` 为 `2K / 4K`；`Gemini 3.1 Flash` 为 `1K / 2K / 4K`；`Gemini 3 Pro` 为 `1K / 2K / 4K`；`GPT-5.4 Image 2` 为 `1K / 2K`。
- 2026-05-12 后续更新：`4K` UI 文案改为金色 `超清4K`。对话流和预览页参数行中，只有当前显示结果为 `4K` 时在普通分辨率图标后显示金色 `超清4K`，其它档位不显示额外标签。
- 2026-05-12 后续更新：OpenRouter / Gemini 3 Pro 可能一次返回多张候选图，同一响应里可同时有 1K 和 2K。项目现在不丢弃多余返回图，全部保存、全部入资产库，并在同一批结果里展示。
- 2026-05-12 后续更新：同一批图片如果存在多个尺寸，会按尺寸分组。参数行右侧显示 `< 1/2 >` 切换尺寸组，切换后参数行的比例、尺寸、分辨率图标会跟随当前组变化。默认显示最接近目标尺寸的一组。
- 2026-05-12 后续更新：同一尺寸组内最多显示四张图片，超过四张时使用图片区域右下角 `< 1/2 >` 分页切换，不再使用横向滚动条。
- 2026-05-12 后续更新：长提示词完整浮层只由提示词正文区域触发，不再覆盖参数行，避免挡住尺寸组切换按钮。
- 2026-05-12 后续更新：修复 `start-project.bat` 启动不稳定问题。`scripts/start-project.ps1` 增加 mutex 防重复 worker，健康检查用 `127.0.0.1:3000`，打开网页用 `explorer.exe`，等待时间增加到 5 分钟。
- 2026-05-12 后续更新：已生成尺寸表文档，桌面有 `图片模型尺寸测试表.docx`，规划文件夹内有 `图片模型尺寸测试表.md`。

主要文件：

- `src/app/page.tsx`
- `src/components/chat-workbench.tsx`
- `src/app/globals.css`
- `src/app/api/asset-delete/route.ts`
- `src/app/api/upload-image/route.ts`
- `src/lib/local-assets.ts`
- `src/lib/models.ts`
- `src/lib/openrouter.ts`
- `package.json`

### 2.1 首页和登录占位

2026-05-15 已新增：

- `/` 已改为首页，不再直接进入聊天工作台。
- 原聊天工作台迁移到 `/workspace`，文件为 `src/app/workspace/page.tsx`。
- 首页文件为 `src/app/page.tsx`，是 Client Component，负责视频轮播、登录弹窗状态和跳转。
- 首页视觉：全屏视频背景、黑色遮罩、左侧大标题、顶部极简导航、右上登录按钮、底部轮播小点。
- 登录弹窗：邮箱、验证码、获取验证码、登录并进入；目前全是假登录 / 占位逻辑，不接真实认证。
- 首页轮播视频来自 `public/home-assets/`，当前数组顺序：`hero-background.mp4`、`hero-dragon.mp4`、`hero-great-wall.mp4`、`hero-global-human.mp4`、`hero-mecha-robot.mp4`。
- 视频切换逻辑：使用 `<video key={activeVideo}>` 加 `onEnded`，当前视频播完后 `setActiveVideoIndex` 到下一条；不再使用定时器强切。
- 之前曾尝试 `poster` 和右下角预览卡片，均已移除。原因：`poster` 会在切换时闪出静态图；`next/image` 本地图片带 `?v=` 会触发 Next `images.localPatterns` 报错。
- 当前首页资源说明和提示词记录见 `public/home-assets/manifest.json`、`reference-images-manifest.json`、`reference-videos-manifest.json`。
- 已生成 Word 说明：`AI-Video-Assistant_Project Planning\首页视频和参考图提示词记录.docx`。

### 3. OpenRouter 接入

已完成：

- 服务端封装 OpenRouter 请求
- 前端发送消息后调用 `/api/chat`
- `/api/chat` 支持 `agent` / `chat` / `image` / `video` 四种模式
- Agent 模式返回创作推进、追问、剧本 / 分镜 / 提示词建议
- 普通 `chat` 模式仍保留在后端，但当前前端默认不再作为独立模式暴露
- 图片 / 视频模式返回优化后的提示词文本
- `/api/chat` 会返回 OpenRouter 响应里的实际 `model` 字段
- 新增 `/api/models` 拉取 OpenRouter 文本模型列表，但当前前端已移除顶部模型下拉
- 新增 `/api/intent`，使用 OpenRouter 做结构化意图分类，返回 `agent` / `image` / `video` / `prompt` / `clarify`
- 对话模型固定为 `bytedance-seed/seed-2.0-lite`
- 修复过错误模型 ID：`seed/seed-2.0-lite` 无效，OpenRouter 正确前缀是 `bytedance-seed/`
- Agent 模式会先走本地硬规则，再走本地纠错记忆，再走 `/api/intent` 分类；明确生图 / 生视频时自动切到对应生成流程
- 图片 / 视频模式现在不再获取优化提示词，用户输入会原样作为提示词进入生成；Agent 自动路由到图片 / 视频时仍可由 Agent 链路先整理提示词

相关文件：

- `src/lib/openrouter.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/intent/route.ts`

### 4. 视频任务接入

已完成：

- 服务端 OpenRouter 视频创建任务
- 服务端 OpenRouter 视频查询任务状态
- 前端在“视频模式”下提交视频任务
- 前端轮询任务状态
- 对话流里显示视频任务状态和视频链接
- 当前已切到 OpenRouter 视频接口
- 创建接口：`POST /api/v1/videos`
- 查询接口：`GET /api/v1/videos/{jobId}`
- 默认请求模型：`bytedance/seedance-2.0-fast`
- 请求结构：`model`、`prompt`、`duration`、`resolution`、`aspect_ratio`、`input_references`；不再默认传 `frame_images`
- 状态映射：`pending=queued`、`in_progress=running`、`completed=succeeded`、`failed=failed`
- Seedance 独立聚合接口因白名单和后续部署问题先暂停
- 当前视频生成已切到 OpenRouter 视频接口 `/api/v1/videos`
- 默认视频模型已改为 `bytedance/seedance-2.0-fast`
- OpenRouter 视频接口是异步任务模式：创建任务后轮询 `GET /api/v1/videos/{jobId}`，完成后取 `unsigned_urls` 保存到本地
- 视频生成不再强制 4 秒；时长按模型支持列表动态传参，分辨率仍由用户选 `720p / 1080p`
- 视频专业模式不再由 `/api/chat` 扩写提示词；用户提示词原样传入，Agent 自动路由场景除外
- 视频轮询策略：前 2 分钟每 10 秒查询一次，之后每 30 秒查询一次；最新已移除前端自动停止上限，只要平台没有返回 `failed / error / expired`，就继续等待
- 重要技术坑：OpenRouter 视频任务直接用 Node `fetch` 查询时可能返回假 `404 Not Found`，但 `curl` 能查到 `completed`；当前 `getOpenRouterVideoTask` 已加 `curl` 兜底
- OpenRouter 返回的 `unsigned_urls` 内容地址需要鉴权；当前保存视频时如果 Node `fetch` 失败，会用 `curl` 带 OpenRouter headers 兜底下载
- 非 Sora 视频模型默认传 `generate_audio: true`，如果音频字段导致失败则自动重试 `generate_audio: false`；`Sora 2 Pro` 不传 `generate_audio`

相关文件：

- `src/lib/openrouter-video.ts`
- `src/app/api/video/route.ts`
- `src/components/chat-workbench.tsx`

### 5. 图片生成和本地历史

已完成：

- 新增 `/api/image`
- 新增 `/api/upload-image`，用于把用户上传的 data URL 图片保存到 `public/generated/upload_image`，以便刷新后用户消息参考图仍能显示
- 图片模式会调用 OpenRouter 图片模型生成图片
- 图片结果改为直接显示在对话流里
- 左侧会话列表改为真实会话
- 会话、聊天内容、图片结果、视频任务状态保存到浏览器本地
- 图片专业模式现在会把比例、分辨率和同时生成数量直接传给 `/api/image`；不再传给提示词优化阶段
- 图片生成请求已从 `modalities: ["image", "text"]` 改为 `modalities: ["image"]`，避免 `bytedance-seed/seedream-4.5` 报不支持 `image, text` 输出
- 当前图片 / 视频专业模型选择已接入真实 OpenRouter 模型 ID，并传给后端生成接口
- 本地反馈日志保存在 `localStorage` 的 `yinzao-feedback-log-v1`
- 本地意图纠错记忆保存在 `localStorage` 的 `yinzao-intent-memory-v1`
- 当前所在历史对话保存在 `localStorage` 的 `yinzao-active-session-v1`
- 本地资产库保存在 `localStorage` 的 `yinzao-assets-v1`
- 页面加载时会扫描所有历史会话消息里的 `images` 和 `videoUrl`，把旧历史中已生成的图片 / 视频按 URL 去重后自动加入资产库
- 新生成图片 / 视频完成后也会自动入库，分类规则为：分镜 > 角色 > 场景 > 其它；无法明确分类的一律进入其它
- 资产分类支持手动修改，手动改过分类的资产会写入 `lockedType`，刷新后不再被自动分类规则覆盖
- 新生成图片 / 视频完成后入库时会优先使用 `assetTargetType`，再结合提示词文本规则和命名规则生成资产名
- 上传图片也会自动入库资产管理：同 URL 去重，名称使用上传文件名，分类根据文件名 + 本次用户文本判断
- 本地图片传给 OpenRouter 时仍会转 base64；专业模式默认原图，413 压缩重试目前只保留在 Agent 生成链路，公网部署后应改成传 HTTPS URL

相关文件：

- `src/app/api/image/route.ts`
- `src/app/api/upload-image/route.ts`
- `src/lib/openrouter.ts`
- `src/lib/local-assets.ts`
- `src/components/chat-workbench.tsx`

### 6. 环境变量

已创建：

- `.env.local`

当前已写入：

- OpenRouter key
- Seedance base url
- Seedance projectCode
- Seedance access key
- Seedance secret key

注意：

- 这属于敏感信息
- 后续正式部署时应迁移到服务器环境变量或安全存储

### 7. 启动脚本

当前只保留一个根目录启动脚本：

- `start-project.bat`

用户反馈：

- `vbs` 版本不稳定，已弃用
- `start-project-hidden.bat` 和 `start-project-no-window.bat` 已删除
- 当前推荐双击 `start-project.bat`
- 项目目录曾短暂改为带空格的 `AI Video Assistant`，导致 PowerShell 二次启动路径解析问题；已改为无空格目录 `AI-Video-Assistant`
- `scripts/start-project.ps1` 已对脚本路径加引号处理，避免路径含特殊字符时启动失败

## 当前待完成内容

## 2026-06-02 本轮继续：BytePlus 开关落实、费用计算和前端显示修正

本轮完成：

1. 后台系统设置里的 `OpenRouter API / BytePlus API` 输入框临时改成明文显示，方便核对 Key。只改 UI 显示，不改保存和调用逻辑。
2. 修复视频等待卡尺寸：专业视频成功/等待/失败卡固定 `640x360`；Agent 自动视频仍保留两列紧凑布局。图片生成卡不受影响。
3. 去掉对话流主视频播放器的 `muted`，模型返回有声音时可以播放；缩略图和首页背景仍静音。
4. `Seedream 5.0` 显示名统一改为 `Seedream 5.0 Lite`，模型 ID 和 Endpoint 不变。
5. `Seedream 5.0 Lite` 当前 `output_format` 按用户测试要求从 `png` 改为 `jpg` 后又改为 `jpeg`。如果后续 `jpeg` 仍返回参数不支持，应回退为 `png` 或不传该参数。
6. `Seedream 5.0 Lite` 尺寸表已和 `Seedream 4.5` 对齐，`2K / 4K` 六个比例全部传具体 px，不再显示未知。
7. 资产库图片生成开关已真正接入前端和服务端。`/api/model-availability` 返回 `assetImageModels`；资产生成页模型菜单按后台 `资产库图片生成` 开关过滤；`/api/image` 会按 `creditSource` 区分对话流图片开关和资产库图片开关。
8. BytePlus 资产库图片生成会使用 `asset-image.seedream-4-5 / asset-image.seedream-5-0` 的 Endpoint 配置；对话流图片继续使用 `conversation-image.*` 配置。
9. 后台 BytePlus 文本模型下拉在该行 BytePlus 启用时会灰掉不可点，需先关闭 BytePlus 才能切换下拉模型。
10. 后台 `Agent 自动生成策略` 里 `高质图片` 右侧 `Seedream 5.0 Lite` 已去除，只保留左侧 `GPT-5.4 Image 2`。
11. 前端所有图片模型下拉顺序统一：`Seedream 4.5` 第一、`Seedream 5.0 Lite` 第二，其它模型排后面；对话流图片和资产库图片都走同一排序。
12. 后台明细模型显示已识别 BytePlus 图片/视频模型，不再显示 `byteplus:...` 原始 ID。
13. 取消模型信息查询的前端拼接回答。用户问当前模型时走正常 Agent 回答，不再由前端生成带 AI 图标的假助手消息。
14. BytePlus 费用计算已接入：文本按 token 单价，图片按成功输出张数，视频按 `completion_tokens`。前端和后台展示结构不改，仍沿用现有 usage / usd / cny / credits 字段。
15. BytePlus 文本价格：`seed-2-0-lite-260428` 输入 `$0.25/M`、输出 `$2.00/M`；`seed-2-0-pro-260328` 输入 `$0.50/M`、输出 `$3.00/M`；`glm-4-7-251222` 输入 `$0.60/M`、输出 `$2.20/M`。`seed-2-0-lite/pro` 超过 `128K` prompt tokens 按第二档翻倍。
16. BytePlus 图片价格：`seedream-4-5-251128` 为 `$0.04 / 张`，`seedream-5-0-260128` 为 `$0.035 / 张`。
17. BytePlus 视频价格：`dreamina-seedance-2-0-fast-260128` 为 `$5.60/M tokens`；`dreamina-seedance-2-0-260128` 为 `480p/720p $7.00/M tokens`、`1080p $7.70/M tokens`。
18. OpenRouter 计费逻辑未改，供应商隔离继续保持。
19. 本轮多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

后续待做：

1. 如果用户继续使用 `Seedream 5.0 Lite + output_format=jpeg` 测试失败，优先回退为 `png` 或不传 `output_format`。
2. 后台 `Agent 自动生成策略` 的媒体模型开关仍需后续单独接入执行策略，目前 Agent 自动媒体模型仍主要由代码策略和当前前台选择决定。
3. 继续测试 BytePlus `Seedance 2.0 Fast / Seedance 2.0` 的比例、分辨率和秒数能力。

主要文件：

- `src/lib/openrouter.ts`
- `src/app/api/image/route.ts`
- `src/app/api/video/route.ts`
- `src/lib/openrouter-video.ts`
- `src/lib/system-settings.ts`
- `src/lib/models.ts`
- `src/app/api/model-availability/route.ts`
- `src/app/admin/admin-system-settings-panel.tsx`
- `src/app/admin/page.tsx`
- `src/components/chat-workbench.tsx`

## 2026-06-02 本轮追加：BytePlus 图片/视频真实接口、前台模型显示和图片尺寸测试

本轮完成：

0. 本轮后续继续补齐 BytePlus 图片参数和调用策略。供应商隔离规则已确认：OpenRouter 稳定逻辑不能被 BytePlus 改动影响；BytePlus 能复用 OpenRouter 规则则复用，不能复用时必须单独拆规则。

1. 后台系统设置顶部 API 输入区宽度已调整。`OpenRouter API / BytePlus API` 所在区域改为 `min-w-[860px]`，内部宽度 `960px`，低于下方模型列表 `min-w-[1180px]`。
2. 新增 `src/components/byteplus-icon.tsx`。BytePlus 图标取用户提供 SVG 的前置图形，不带文字。后台 BytePlus 模型列和前台 BytePlus 模型按钮都使用该图标，颜色保持和原模型图标一致的灰色。
3. 修复 `.env.local` JSON 配置解析问题。`MODEL_PROVIDER_PREFERENCES` 和 `BYTEPLUS_MODEL_SELECTIONS` 如果被 `JSON.stringify()` 包了一层引号，现在能正确反解析，解决 BytePlus 对话模型下拉保存后弹回默认值的问题。
4. 前台 `/api/model-availability` 已改为同时返回启用的 OpenRouter 和 BytePlus 图片/视频模型。新增 BytePlus 前台模型 ID：`byteplus:conversation-image.seedream-4-5`、`byteplus:conversation-image.seedream-5-0`、`byteplus:video.seedance-2-0-fast`、`byteplus:video.seedance-2-0`。工作台模型下拉会显示后台启用的 BytePlus 模型，并以 BytePlus 图标区分。`byteplus:video.seedance-2-0` 也按金色模型显示。
5. BytePlus 图片生成已接真实 API。接口为 `POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`。默认使用模型名 `seedream-4-5-251128 / seedream-5-0-260128`；后台 `解除限制` 开关打开后使用对应 `ep-...` Endpoint ID。返回 `data[].url` 会保存到本地，`usage.output_tokens / total_tokens` 会写入 usage。
6. BytePlus 图片参考图规则已按文档接入。无参考图不传 `image`；一张参考图传字符串；多张参考图传数组。官方 `sequential_image_generation: "auto" + max_images` 只表示最多返回几张，不保证用户选几张就返回几张；因此当前对话流专业图片模式已恢复为按用户选择数量并发发起多个单图请求，每次 `/api/image` 传 `count: 1`。
7. BytePlus 图片流式返回暂未接。已记录格式：`stream: true` 后 SSE 事件 `image_generation.partial_succeeded` 返回单张图片 URL，`image_generation.completed` 返回 usage，最后 `data: [DONE]`。后续如果要一张张显示，应基于该流式格式重新设计 `/api/image` 推送。
8. BytePlus 视频生成已接创建和查询任务。创建：`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`；查询：`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`。`Seedance 2.0 Fast` 使用 `dreamina-seedance-2-0-fast-260128`，`Seedance 2.0` 使用 `dreamina-seedance-2-0-260128`。查询成功读取 `content.video_url`，保存到本地并写视频扣费 metadata。
9. BytePlus 视频参考图已按文档使用 `role: "reference_image"`。当前只接文字和图片参考，未接参考视频、参考音频、首尾帧严格模式或 `return_last_frame`。
10. 新增脚本 `scripts/test-byteplus-image-size-matrix.mjs`，结果写入 `AI-Video-Assistant_Project Planning/test/byteplus-image-size-test-results.md` 和 `byteplus-image-size-test-raw.json`。测试覆盖两个 BytePlus 图片模型、六个提示比例和 `1K / 2K / 4K`。
11. BytePlus 图片尺寸实测结论：`Seedream 4.5 / 5.0` 都不支持 `1K`；两者支持 `2K / 4K`。`Seedream 4.5` 不支持 `output_format`，正式代码已改为只有 `Seedream 5.0` 传 `output_format=png`。`2K` 稳定尺寸为 `16:9 2848x1600`、`9:16 1600x2848`、`1:1 2048x2048`、`4:3 2304x1728`、`3:4 1728x2304`、`21:9 3136x1344`。`4K` 稳定尺寸为 `16:9 5504x3040`、`9:16 3040x5504`、`1:1 4096x4096`、`4:3 4704x3520`、`3:4 3520x4704`、`21:9 6240x2656`；但 `Seedream 5.0` 的部分 4K 非宽高比请求本轮超时。
12. BytePlus 图片 `size` 字段已改为独立方案：已知成功尺寸传具体像素 `WIDTHxHEIGHT`，例如 `21:9 / 2K -> 3136x1344`；未知/超时组合回退传 `2K / 4K` 并在前端尺寸位置显示 `未知`。不额外给用户提示词加比例前缀。
13. 已新增后台 `BytePlus API` 行右侧 `解除限制` 开关，写入 `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS`。关闭时请求使用模型名；打开时请求使用 `BYTEPLUS_MODEL_SELECTIONS` 中的 Endpoint ID。显示名称不变。
14. 已保留 BytePlus 图片耗时日志 `[image-generation] BytePlus timing`，用于区分 `providerMs` 生成/返回耗时、`saveMs` 远程图片 URL 下载保存耗时、`dimensionsMs` 读尺寸耗时。d26 最近测试中模型返回多为 `7-15秒`，下载保存可能 `40-75秒`，说明慢经常卡在远程图片下载。
15. 本轮验证：多次 `npm run lint` 通过，仅剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

后续待做：

1. 继续测试 BytePlus `Seedance 2.0 Fast / Seedance 2.0` 的比例、分辨率、秒数能力，并把测试结果写入 `AI-Video-Assistant_Project Planning/test`。
2. 根据 BytePlus 视频实测结果调整 `src/lib/models.ts` 中 BytePlus 视频模型能力表。
3. 继续观察 BytePlus `解除限制` 开关打开后，图片/视频用 Endpoint ID 是否解除尺寸或调用限制。
4. 如果用户要求 BytePlus 图片官方单请求流式，再单独接 `stream: true` SSE；但普通“生成 N 张”当前不要用官方 `max_images` 批量模式，因为它不保证返回 N 张。

主要文件：

- `src/components/byteplus-icon.tsx`
- `src/app/admin/admin-system-settings-panel.tsx`
- `src/app/api/model-availability/route.ts`
- `src/app/api/image/route.ts`
- `src/app/api/video/route.ts`
- `src/lib/models.ts`
- `src/lib/openrouter.ts`
- `src/lib/openrouter-video.ts`
- `src/lib/system-settings.ts`
- `src/components/chat-workbench.tsx`
- `scripts/test-byteplus-image-size-matrix.mjs`

## 2026-06-01 本轮追加：后台系统设置、BytePlus 接入和模型开关

本轮完成：

1. 后台 `系统设置` 页面已从占位继续做实。顶部现在是左右并排的 `OpenRouter API` 和 `BytePlus API` 输入框，二者宽度和上下位置对齐。两个输入框都遵守同一规则：关闭开关时可编辑，打开开关时保存并启用当前 Key；状态 `已启用 / 已关闭` 显示在输入框右侧内部。
2. `BytePlus API` 已接入后台配置。Region 固定为 `ap-southeast-1`，界面不再展示 Region 下拉。配置写入 `.env.local`：`BYTEPLUS_API_KEY / BYTEPLUS_API_KEY_ENABLED / BYTEPLUS_REGION / MODEL_PROVIDER_PREFERENCES / BYTEPLUS_MODEL_SELECTIONS`。后续如果要改 Region，再改 `src/lib/system-settings.ts` 和后台 UI。
3. BytePlus 的 Key 和 Endpoint ID 来源是 `E:\project\【1】Api key\Byteplus\Byteplus.md`。其中 Data Plane Key 是 `ark-...`，Endpoint ID 包括 `Seed 2.0 Lite / Pro / GLM-4.7 / Seedream 4.5 / Seedream 5.0 / Seedance 2.0 Fast / Seedance 2.0` 等。
4. 后台模型使用表已改为四列：`使用位置 / OpenRouter / 说明 / BytePlus`。OpenRouter 列不在每个模型框内重复显示 OpenRouter；`普通 / 高级 / 优先 / 第二 / 第三 / 默认图片 / 高质图片 / 快速图片 / 默认视频 / 高质视频 / 4K视频` 等说明统一放在中间说明列。左右无对应模型时显示空灰底，保证两列对齐。
5. OpenRouter 左列所有模型都加了开关。BytePlus 右列所有模型也加了图标和开关。左右两边有对应关系时互斥：打开 OpenRouter 会关闭同一行 BytePlus，打开 BytePlus 会关闭同一行 OpenRouter。`Seedream 5.0` 是 BytePlus 单独新增模型，左侧 OpenRouter 为空灰底；打开它就是额外启用该模型。
6. BytePlus 对话模型下拉只保留三个选项：`Seed 2.0 Lite / Seed 2.0 Pro / GLM-4.7`。`对话 / Agent 规划 / 意图识别` 的 `普通 / 高级` 都有 BytePlus 对话模型下拉；`反推提示词 / 优化提示词` 的 `优先 / 第二 / 第三` 也都有 BytePlus 对话模型下拉。选择 BytePlus 后，文本路由会用对应 Endpoint ID。
7. BytePlus 图片/视频不再用下拉。`Seedream 4.5` 对应 OpenRouter `Seedream 4.5`；`Seedream 5.0` 单独显示；`Seedance 2.0 Fast / Seedance 2.0` 分别对应 OpenRouter 同名视频模型。`Agent 自动生成策略` 里 `高质图片` 左侧 `GPT-5.4 Image 2` 和右侧 `Seedream 5.0` 已互斥。
8. 文本类 BytePlus 路由已接入 `src/lib/openrouter.ts`。`sendToOpenRouter()`、`planAgentTask()`、`classifyOpenRouterIntent()` 会按后台 `MODEL_PROVIDER_PREFERENCES` 判断走 OpenRouter 还是 BytePlus。选择 BytePlus 时请求 `https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions`，Header 为 `Authorization: Bearer <BYTEPLUS_API_KEY>`，`model` 使用后台选择的 Endpoint ID。
9. 前端模型可用性接口新增 `/api/model-availability`。工作台加载后会读取可用图片/视频模型，关闭的 OpenRouter 模型不会显示在对话流图片/视频模型下拉里。如果一类模型全关，下拉显示 `暂无可用模型`；用户发送时对话流插入红字系统消息 `连接不到模型，请联系管理员！`。
10. `/api/image` 和 `/api/video` 服务端也做了模型开关兜底校验，关闭模型不能绕过前端调用。注意：目前 BytePlus 图片/视频只完成后台配置和开关展示，实际生成调用仍未切到 BytePlus 图片/视频专用 API；后续需要继续接 BytePlus Image generation API 和 Video generation API 的真实请求/轮询/保存/扣费链路。
11. 本轮多次 `npm run lint` 通过，只剩 `chat-workbench.tsx` 原有两个 warning；多次 `npm run build` 通过。

主要文件：

- `src/app/admin/admin-system-settings-panel.tsx`
- `src/app/admin/api/system-settings/route.ts`
- `src/app/api/model-availability/route.ts`
- `src/app/api/image/route.ts`
- `src/app/api/video/route.ts`
- `src/lib/system-settings.ts`
- `src/lib/openrouter.ts`
- `src/components/chat-workbench.tsx`

## 2026-06-01 本轮追加：后台积分明细规则收敛、反推/优化闭环、删除/上传记录

本轮完成：

1. 后台积分明细顶部汇总已重做。`对话流消耗积分详细` 显示 `生成图片 / 生成视频 / 上传图片 / 上传文件`；`资产库消耗积分详细` 显示 `生成图片 / 生成视频 / 上传图片`；`反推提示词` 显示 `反推图片`；`优化提示词` 显示 `优化次数 / 消耗Token`。
2. `对话流消耗积分详细` 已加入 0 分上传记录。对话流上传图片显示缩略图和名称，参数为 `对话流上传`；上传文件显示文件占位和文件名，参数为 `对话流上传文件`。上传类行的积分、美元、人民币都显示 `--`。
3. `资产库消耗积分详细` 已加入 0 分资产库上传图记录。按角色/场景/分镜分类显示图片和名称，参数为 `资产库上传`，积分、美元、人民币显示 `--`。
4. 后台所有图片缩略图已支持悬停大图预览，新增 `src/app/admin/admin-hover-image-preview.tsx`。预览层按浏览器尺寸和鼠标位置自动避让边界，尽量大且不出界。
5. 前端删除图片、资产或对话后，后台不删除积分流水。后台明细保留记录，文件名/图片名照常显示，后面追加红字 `用户已删除 删除时间`，参数行照常显示。资产回收站使用真实 `deletedAt`；对话流单图删除没有独立删除时间时用扣费/生成时间兜底。
6. 用户管理也同步删除态。历史对话、对话流生成图片/视频、资产库生成图片如果用户已删除，仍显示记录并标红 `用户已删除`，缩略图底部也显示 `用户已删除`。
7. 修复资产恢复逻辑。删除时写 `previousType`；恢复时优先恢复原分类。旧资产没有 `previousType` 时按 `systemName` 兜底。已修复本机 `角色57` 从 `other` 回到 `character_image`。
8. 资产生成任务状态持久化。`assetGenerateJobs` 写入 workspace，刷新后失败卡恢复；刷新中的生成任务会恢复为失败卡。删除某个成功生成资产时，同 URL 的成功任务卡会同步清除，避免角色页残留。
9. 图片生成多返图策略已改。每个子请求只返回一张最匹配当前参数比例/尺寸的图片；模型额外返回图不再全部展示。多返图选择会写后端日志。
10. 图片生成无图错误已加强。OpenRouter 返回成功但没有图片时，后端记录 `message.content / refusal / finish_reason / native_finish_reason / responseId / model`，前端生成页显示真实原因；资产库外部失败卡不显示原因。
11. 反推提示词规则重做。只有上传图显示反推按钮；生成图不显示。成功后不再显示反推按钮，改为正常提示词、复制、使用提示词。每张上传图只能成功反推一次。三轮模型都失败时写 0 分失败流水并前端红字 `服务器繁忙，请稍候再试！`。
12. 反推模型兜底顺序固定为 `openai/gpt-5.5 -> openai/gpt-5.4 -> bytedance-seed/seed-2.0-lite`。前两轮失败不写流水，全部失败才写一条失败流水；成功只显示一条成功记录。
13. 优化提示词规则做实。优化可以多次成功，每次成功扣分并写 `outputPrompt`；每次模型尝试失败写 0 分失败流水。前端优化失败不弹提示，只结束 loading；后台显示成功提示词或失败原因。
14. 反推/优化明细不再猜旧数据。反推只显示有精确 `mediaUrls` 且有 `outputPrompt` 或失败原因的新数据；优化只显示有 `outputPrompt` 的成功记录或有失败原因的失败记录。旧的缺字段流水不再显示。
15. 本轮多次 `npm run build` 通过，多次 `npm run lint` 通过；当前仅剩 `chat-workbench.tsx` 原有两个 warning。

主要文件：

- `src/app/admin/page.tsx`
- `src/app/admin/admin-credits-panel.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/admin/admin-hover-image-preview.tsx`
- `src/app/api/chat/route.ts`
- `src/app/api/image/route.ts`
- `src/lib/credits.ts`
- `src/lib/openrouter.ts`
- `src/lib/error-message.ts`
- `src/components/chat-workbench.tsx`

## 2026-06-01 本轮追加：后台积分明细弹窗、媒体绑定和额外返回图展示

本轮完成：

1. 后台 `对话流消耗积分详细` 弹窗继续完善。左侧对话名称前显示 `【d编号】`；右侧改为表格，列为 `生成内容 / 积分扣除 / 消耗美元 / 折算人民币`。表格上方显示图片数量、视频数量和右侧居右的 `积分扣除` 汇总。
2. 对话流明细中的图片/视频名称改为优先显示系统名；如果用户改名，显示 `系统名 / 用户改名`。图片失败行左侧灰框显示 `生成失败`，右侧用红字显示真实失败原因，下一行只显示时间。成功媒体参数行按前端同款格式显示：`模型 | 比例 | 尺寸 分辨率 | 时长`。
3. 对话流明细修复旧流水误挂问题。旧流水如果是明确 `requestId:image:序号` 但找不到对应 URL，不再退回挂到同批第一张图，避免一张图显示多笔扣费。
4. `/api/image` 扣费 metadata 已加强。现在写入 `mediaUrls / allMediaUrls / extraMediaUrls / requestedImageCount / returnedImageCount / billableImageCount / delivered`。对话流图片生成不丢弃模型额外返回图，全部显示并分页；额外不计费图片显示 `-0 / $0.0000 / ¥0.00`。资产库生成只保留最匹配当前比例/尺寸的一张，额外图不进入资产库也不显示。
5. 后台 `资产库消耗积分详细` 已做实。左侧分类固定为 `角色 / 场景 / 分镜`，右侧同款表格。新数据优先按流水 `metadata.mediaUrls` 显示图片；旧数据没有 URL 时，按同用户、同分类、生成时间最接近的资产图兜底。参数从资产 `previewMeta` 读取。
6. 后台 `反推/优化提示词消耗积分详细` 已做实。左侧分类为 `反推提示词 / 优化提示词`。反推提示词显示图片；新数据按 `metadata.mediaUrls` 精确匹配，旧数据按时间就近匹配且避免同一弹窗内重复使用同一张图。
7. `/api/chat` 扣费 metadata 已加强。现在会写入 `outputPrompt`；反推提示词请求会带 `mediaUrls`；优化提示词请求会带 `originalPrompt`。后台反推/优化明细主标题优先显示输出提示词，旧反推数据可用图片 `sourcePrompt` 兜底。
8. 后台反推/优化明细 UI 已调整。长提示词在当前列宽内换行，缩略图保持现有大小并与提示词顶部对齐；下方信息行前面显示使用模型名称，后面显示时间。
9. 本轮多次 `npm run build` 通过，多次 `npm run lint` 通过；仍只有原有两个 warning。

主要文件：

- `src/app/admin/page.tsx`
- `src/app/admin/admin-credits-panel.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/api/image/route.ts`
- `src/app/api/chat/route.ts`
- `src/components/chat-workbench.tsx`

## 2026-05-29 本轮追加：对话流媒体命名、资产库预览一致性和 d22 修复

本轮完成：

1. 工作台会话新增稳定编号 `conversationCode`，格式为 `d1 / d2 / d3...`。旧会话按 `updatedAt` 从早到晚补编号；删除会话后编号不复用。工作区状态新增 `nextConversationNumber`，用于后续新会话继续分配编号。
2. 对话流模型生成图片/视频新增消息级永久系统名 `mediaSystemNames`。图片命名为 `image_序号_d编号`，例如 `image_1_d22`；视频命名为 `video_序号_d编号`。同一对话内按已有最大编号继续递增，重试失败图也先扫描已有编号并跳过，避免重复。
3. 资产新增 `systemName`。模型生成资产初始显示名 `name` 等于 `systemName`；用户后续重命名只改 `name`，`systemName` 保留给后台和排查。资产库生成继续使用中文系统名 `角色1 / 场景1 / 分镜1`，并写入 `systemName`。
4. 上传图不使用 `image_... / video_...` 编号。对话流上传图和资产库上传图都保留上传时名字；预览参数位置显示 `对话流上传` 或 `资产库上传`，提示词区显示 `暂无提示词`，显示蓝色 `反推提示词` 按钮。
5. 预览数据源已收敛。对话流和资产库点开同一张图片/视频时，名称、参数和提示词必须一致。名称优先读资产库当前记录，没有资产记录才读 `mediaSystemNames`；提示词和参数统一通过 URL 回查对话流 assistant 消息，不再优先读资产对象里可能过期的 `sourcePrompt / previewMeta`。
6. 图片预览缩略图列表改为按 `imageResultSlots` 顺序构建，避免 `message.images` 顺序和对话流卡片顺序不一致导致切图后名称、提示词或参数错位。
7. 图片结果分页规则改为只对 `Gemini 3 Pro Image Preview` 生效。其它图片模型不显示参数分页。Gemini 3 Pro 如果多返回图，第一页先显示用户选择数量内的图片，额外多出的第 5 张及以后进入后续页。图片区域右下角旧分页已移除，只保留参数行分页。
8. 临时修复本地用户 `ID_779117` 的 `d22` 会话：数据库里该会话原先只保存 1 张图，但 `public/generated/images` 最后 4 张是同一批生成图。已补回 d22 的 `images`、`imageResultSlots`、`mediaSystemNames` 和资产记录，命名为 `image_1_d22` 到 `image_4_d22`。
9. 当前验证：多次 `npm run lint` 通过，仅剩原有两个 warning；`npm run build` 多次通过。中途出现过 Google Fonts `Geist Mono` 拉取失败导致 build 失败，这是网络问题，不是代码错误。

主要文件：

- `src/components/chat-workbench.tsx`

## 2026-05-29 本轮继续：后台用户管理、积分管理和弹窗细化

本轮完成：

1. 后台用户管理媒体预览弹窗已调整。`对话流生成图片 / 对话流生成视频 / 资产库生成图片` 三类弹窗左侧大图区域下方改为先显示参数，再显示完整提示词；提示词不再截断，内容过长时走弹窗内滚动。
2. 后台资产库生成图片预览中，无生成参数的上传图参数位置显示 `资产库上传`。如果上传图的提示词是反推出来的，提示词前增加蓝色描边标识 `反推提示词`，带 `RiQuillPenAiLine` 图标。
3. 新增通用 `useBodyScrollLock`。打开弹窗时锁住页面 `body` 滚动，并给主要遮罩加 `overscroll-contain`，避免鼠标滚轮影响弹窗背后的页面。已接入首页登录抽屉、工作台资产上传/资产生成/用户中心/重命名/媒体预览/文档预览、后台用户管理历史/媒体弹窗、后台积分调积分浮层。
4. 后台积分管理用户行支持多项同时展开，和用户管理一致，不再互斥。用户管理和积分管理的展开三角都统一移动到列表最前面，后面列宽让出小列给三角。
5. 后台积分管理表头 `最后活跃时间` 改为 `最后积分变动时间`。该时间按用户最新一条 `CreditLedger` 计算，包含模型消耗、注册送积分、后台加分、后台减分以及后续充值/活动等所有积分流水变动。
6. 后台用户管理的 `最后登录时间` 显示和排序已修正。显示取 `User.lastLoginAt` 与最新 `Session.lastSeenAt` 中更晚的值；排序改为 `lastLoginAt / Session.lastSeenAt / workspace.updatedAt / createdAt` 的最大时间，确保最新用户排最前。
7. 后台积分管理展开区改为三列灰底横条。第一列显示 `当前积分 / 已赠送积分 / - 注册送积分 / - 后台调整赠送积分`；第二列显示 `已消耗积分 / - 对话流消耗积分详细 / - 资产库消耗积分详细 / - 反推/优化提示词消耗积分详细`；第三列显示 `消耗Token / 消耗美元 / 折算人民币`。
8. 后台积分管理展开区中，明细前统一用加粗 `-` 标识层级；可点击文字保留下划线，但 `-` 本身不加下划线。展开区所有数值使用普通颜色，不再把消耗明细标红，主表仍按原规则显示红/绿。
9. 后台积分数据新增拆分：`signup` 汇总为 `注册送积分`，`admin_adjust` 汇总为 `后台调整赠送积分`，两者共同组成 `已赠送积分` 净值。对话流、资产库生成、反推/优化提示词三类消耗也分别聚合显示。
10. `对话流消耗积分详细` 已做成真实弹窗。弹窗大小和左侧列表结构与用户管理里的历史对话弹窗一致；左侧按当前工作区 `sessions` 顺序和标题显示，只展示有对话流积分流水的会话。旧本地历史或未接积分流水时期的对话不会显示，这是正常现象。
11. `对话流消耗积分详细` 右侧列表规则：第一条显示 `对话积分` 汇总，第二条显示 `规划积分` 汇总，下面逐条显示该对话流里的图片/视频积分记录。数据来自 `CreditLedger`，并排除资产库生成、反推提示词、优化提示词来源。
12. 对话流积分明细右侧的图片/视频记录已尝试直接显示缩略图。匹配逻辑会按工作区 assistant 消息的 `requestId` 生成索引，支持精确 `requestId:image:序号 / requestId:video:序号`、基础 `requestId`、`requestId:image / requestId:video` 兜底。部分旧数据如果没有足够 `requestId` 或媒体 URL，仍可能只能显示文字。
13. 对话流积分明细已补失败图片占位。对于工作区消息里有 `failedImageCount` / `imageResultSlots` 的多图部分失败任务，失败项会显示同缩略图尺寸的灰框，中间写 `生成失败`，扣分显示真实值，失败项为 `0`。
14. 当前已确认所有新的对话流扣费接口都会带 `conversationId` 和 `conversationTitle`：`/api/agent-plan`、`/api/chat`、`/api/image`、`/api/video`。以后新产生的对话流积分应能匹配到当前工作区历史对话；不显示的主要是旧数据或非对话流来源。
15. 本轮验证：多次 `npm run lint` 通过，无错误；仍有项目原有 `chat-workbench.tsx` 的 `Unused eslint-disable directive` warning，以及后台积分明细缩略图使用 `<img>` 的 Next warning。本轮未运行 `npm run build`。

主要文件：

- `src/app/admin/page.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/admin/admin-credits-panel.tsx`
- `src/app/page.tsx`
- `src/components/chat-workbench.tsx`
- `src/components/use-body-scroll-lock.ts`

## 2026-05-28 本轮继续：后台积分设置保护、tooltip 统一和用户中心积分流水显示

本轮完成：

1. 后台积分管理设置区布局继续调整。`美元汇率 / 1人民币兑换积分 / 注册送积分` 三项的开关已移到输入框同一行右侧；每个输入框固定变窄，设置项总宽度保持不变；整条设置栏强制同一行不换行。
2. `选择积分消耗项` 下方三项文案去掉 `扣` 字，改为 `对话/规划 / 图片 / 视频`。开关去掉固定最小宽度和 `justify-between`，改为紧跟文字后面；第一项左内边距去掉，保证下面一行与上方小标题左对齐。
3. 后台积分设置新增有效值保护。`美元汇率` 只接受 `1.00-20.00` 且不支持负数；`1人民币兑换积分` 只接受 `10 / 100 / 1000 / 10000` 四个整数；`注册送积分` 按当前兑换比例折算价值不能超过 `200人民币`。
4. 三个设置项的“有效值”定义为上一次点击启用并保存成功的值。输入无效值后点击启用，会恢复上一次启用过的有效值；输入过程中经过的中间值不会被记为有效值。后端 `src/lib/credits.ts` 的 `updateCreditSettings()` 也做同样保护，绕过前端提交无效值不会写库。
5. 后台积分设置三项后面已加说明图标，悬停显示各自规则。说明框继续使用黑色样式，并增加左右边缘检测，靠近浏览器右侧时向左展开，靠近左侧时向右展开。
6. 前台通用黑框 tooltip 已增加边缘检测。新增/调整 `BlackHoverTooltip`：默认居中，左右空间不足时改为左/右对齐；顶部空间不足时可向下显示。文档预览复制/下载、AI 反馈按钮、预览页 `实际尺寸 / 适合尺寸` 等都走黑框。
7. 用户反馈模型按钮和缩略图不需要悬停说明，已移除这些位置的 tooltip：对话流图片/视频模型按钮、资产生成模型按钮、对话/资产参考图缩略图、输入框上传图缩略图、资产生成引用图缩略图。保留原本点击和显示功能。
8. 用户中心 `我的积分` 表已改为同时显示增加和扣除。表头 `积分消耗来源` 改为 `积分来源`，`扣除` 改为 `积分变动`；增加积分显示绿色 `+数字`，扣除积分显示红色 `-数字`。
9. `/api/credits/me` 现在会返回增加流水。注册送积分和后台正向调积分会逐条显示，不合并；后台调积分在前台显示名改为 `赠送积分`。后台负向调积分仍写数据库并影响余额和净赠送积分，但不显示在前台明细表。
10. 用户中心上方 `已赠送积分` 改为净赠送积分，统计所有 `CreditLedger.direction = "increase"`，包括注册送分、后台加分和后台减分的负值。也就是说后台减分会被记录并体现在净值里，但不会作为明细行展示。
11. 后台积分管理统计卡文案 `消耗积分` 改为 `消耗积分总数`。
12. 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 `Unused eslint-disable directive` warning；涉及 tooltip/积分流水的中间版本跑过 `npm run build` 通过，最后统计卡文案小改只跑了 lint。

主要文件：

- `src/app/admin/admin-credits-panel.tsx`
- `src/lib/credits.ts`
- `src/app/api/credits/me/route.ts`
- `src/components/chat-workbench.tsx`

## 2026-05-28 本轮追加：资产生成规则、积分显示、后台积分/用户管理和禁用拦截

本轮完成：

1. 资产库 `角色生成 > 单人9:16` 强规则已加强。必须生成单人站立正面全身角色设定图，纯白背景，正面朝镜头，头到脚完整，脚不能裁切；禁止室内外场景、环境、建筑、家具、道具堆叠、复杂背景、半身、头像、特写、侧身、背身、3/4侧身、坐姿、躺姿、多人。
2. 资产库生成规则对 `Seedream 4.5` 单独强化。角色单人、角色三视图、场景单图、场景四宫格、分镜图都有 Seedream 专用规则。该改动只作用于资产库生成，不影响对话流图片/视频、Agent 自动生成或对话流优化。
3. 资产库生成命名固定为 `角色1 / 角色2...`、`场景1 / 场景2...`、`分镜1 / 分镜2...`。不再从提示词提取名称，不再出现 `角色三视图`、`场景多角度`。对话流命名和上传图命名不变。
4. 等待卡百分比改为非线性显示：`0-30秒` 到约 `45%`，`30-90秒` 到约 `75%`，`90-180秒` 到约 `95%`，`3分钟后` 固定停在 `95%-99%` 之间。只改显示，不改轮询和真实任务状态。
5. 用户中心 `我的积分` 来源文案改为 `资产库_角色图片 / 资产库_场景图片 / 资产库_分镜图片`。这三项图标统一为资产库第一态 `RiFolderLine`；普通对话图标改为 `RiChat3Line`；反推提示词和优化提示词不变。
6. 后台用户管理每页显示 `15` 条。排序改为最近活跃优先：`lastLoginAt`、最近 Session、工作区更新时间、注册时间依次兜底。
7. 后台用户管理展开区中 `生成图片 / 生成视频` 改为 `对话流生成图片 / 对话流生成视频`，新增 `资产库生成图片`。点击资产库生成图片会打开媒体预览弹窗，右侧顶部三按钮切换 `角色 / 场景 / 分镜`，数据来自 workspace assets 中 `librarySource: "asset_generation"` 的图片。
8. 后台 `禁用 / 启用` 按钮已做实。新增 `/admin/api/users/disabled`，按钮点击更新 `User.disabled`，并阻止行展开。禁用时会删除该用户所有前台 Session。
9. 禁用用户前台拦截已做实。`getCurrentUser()` 会清理禁用用户 Session 和 Cookie；登录检查、密码登录、验证码登录遇到禁用用户返回 `用户名错误！请联系管理员！`；工作台每 `5秒` 和窗口聚焦检查 `/api/auth/me`，禁用后会退回首页。模型接口没有有效登录用户会禁止调用。
10. 后台积分管理改为按单个用户显示，每页 `15` 条。列为 `ID号 / 用户 / 当前积分 / 已赠送积分 / 已消耗积分 / 最后活跃时间 / 调积分`。最后活跃时间为积分流水最后变化时间。
11. 后台积分统计卡调整：`赠送积分总数`、`消耗美元/折算人民币` 合并卡、数值下对齐、卡片高度降到 `98px`。
12. 后台调积分已做实。新增 `/admin/api/credits/adjust`，点击每行 `调积分` 在按钮左侧弹小计算器浮层，无黑底遮罩，点击其它区域关闭，支持负数。后台调积分只影响赠送积分，正负都写 `CreditLedger.direction = "increase"`，负数写负值，不写消耗流水。
13. 后台积分设置区重做。去掉保存按钮和白底，四段竖线分隔。`美元汇率 / 1人民币兑换积分 / 注册送积分` 各自开关控制输入框是否可编辑，重新开启时立即保存；`扣对话/规划 / 扣图片 / 扣视频` 三个独立开关点击即保存。`选择积分消耗项` 后有 `RiInformation2Line` 悬停说明。
14. 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 warning；本轮未重新运行 `npm run build`。

主要文件：

- `src/components/chat-workbench.tsx`
- `src/lib/auth.ts`
- `src/lib/credits.ts`
- `src/app/api/auth/check-email/route.ts`
- `src/app/api/auth/login-password/route.ts`
- `src/app/api/auth/verify-code/route.ts`
- `src/app/admin/page.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/admin/admin-credits-panel.tsx`
- `src/app/admin/api/users/disabled/route.ts`
- `src/app/admin/api/credits/adjust/route.ts`

## 2026-05-28 本轮补充：优化/反推体验、积分来源和预览缩略图分页

本轮完成：

1. 我的积分新增统一来源 `优化提示词`。新增 `prompt_optimization` 来源，资产生成优化提示词、对话流图片/视频专业模式优化提示词全部聚合到这一条。该来源使用 `RiQuillPenAiLine` 图标，`图片/视频` 显示为 `--/--`。
2. `/api/credits/me` 已识别 `prompt_optimization`，前端 `UserCreditSource` 也已加入该来源。优化提示词请求写入 `metadata: { creditSource: "prompt_optimization" }`。
3. 对话流图片/视频专业模式优化中，整个主输入框禁用并变淡，包括正文、上传、`@`、模式、模型、比例、数量/时长、发送和清空输入框。曾修复 `isThinking` 初始化顺序导致的运行时错误。
4. 资产生成页优化中，右侧设置栏全部禁用：比例、风格、模型、K 数、引用资产、优化、清空、输入框、参考图移除/点击、生成按钮。优化开始时关闭已打开菜单。无输入文字时，资产生成里的 `清空输入框` 也禁用。
5. 新增通用 `LoadingSpinner`。实现采用 `radial-gradient + conic-gradient + mask`，蓝色为 `#367cee`，用于以后通用 loading。优化提示词和反推提示词的输入/右侧区域中间都使用该组件。
6. 反推提示词时，预览页右侧整体禁用、变淡，并显示通用 Loading；复制、使用提示词、反推按钮不可点。曾尝试外部资产卡禁用和 loading，但用户要求先撤回，当前外部资产库缩略图反推时不显示 loading 或禁用态。
7. 资产库打开预览时，右侧缩略图只显示资产库当前分类/来源，不再混入对话流缩略图。对话流打开预览时仍显示当前对话流媒体缩略图。注意判断资产库预览只能用资产 `id`，不要用 URL，否则对话流图片已入库时会被误判。
8. 预览页缩略图从自由滚动列表改成分页列表。当前页只渲染一屏缩略图；鼠标滚轮只移动蓝色选中框；越过当前页边界才整页切换；第一张往上和最后一张往下不再循环。上下按钮也改为整页翻页。
9. 缩略图整列区域都接管滚轮，包括上下按钮、缩略图之间空隙和列表区域，避免空隙处触发主图缩放。
10. 预览缩略图增加分布式预加载：DOM 只渲染当前页；打开预览时预加载前两页；翻到后续页时继续预加载后两页；已加载 URL 不重复加载。视频缩略图不额外预加载。
11. 预览主图滚轮切图尺寸错乱已多轮修复。处理包括：切图前重置预览状态；主图加 `key` 强制重新挂载；`onLoad` 校验当前图，避免旧图加载回调覆盖当前图；缓存图切换后主动读取真实尺寸并重新计算适合比例。
12. `适合尺寸` 现在按真实图片尺寸乘以 `previewFitScale` 渲染，能把 512 小图放大到适合窗口。此前尝试 `max-width/max-height` 只能缩小不能放大，已撤回。
13. 点击已选中的缩略图不再做任何事，避免第二次点击触发重置导致图片异常放大。预览区和缩略图区也额外拦截了双击默认行为。
14. 预览页左上 `实际尺寸` 和 `适合尺寸` 按钮增加 tooltip：`显示图片的实际尺寸`、`显示适合屏幕的完整图片`。
15. 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 warning；`npm run build` 通过。

主要文件：

- `src/components/chat-workbench.tsx`
- `src/app/api/credits/me/route.ts`
- `handover/00-README.md`
- `handover/03-progress-and-status.md`
- `handover/05-chat-history-highlights.md`
- `handover/CHANGELOG.md`

## 2026-05-27 本轮后续补充：分镜生成做实、资产生成并发、输入框优化和使用量 UI

本轮完成：

1. `资产生成 > 分镜图片` 已做实，新增固定入口 `分镜生成`，点击后复用角色/场景同款全屏生成页。成功图写入 `资产生成 > 分镜图片`，带 `librarySource: "asset_generation"`、`type: "shot_image"`、`lockedType: true` 和预览参数。
2. 分镜生成强规则：结果必须像电影或电视剧单帧截图；不是角色设定图、场景设定图、海报、漫画格、分镜表或拼贴图；不能出现字幕、文字、Logo、水印、UI、二维码、边框、分割线、网格、多宫格、画中画、海报标题或说明标签。
3. 分镜比例菜单为 `竖屏分镜9:16 / 横屏分镜16:9`，默认 `竖屏分镜9:16`。参数行沿用资产生成规则，生成页不显示模型，资产预览页显示完整参数。
4. 分镜图片命名规则改为简单递增：`分镜1 / 分镜2 / 分镜3...`。此规则只影响 `shot_image`，`shot_video` 仍保留旧剧名/镜头编号命名规则。
5. 资产生成页顶部 `角色生成 / 场景生成 / 分镜生成` 按钮已做实，点击等同对应虚线入口；按钮图标跟左侧分类一致，颜色加深，避免看起来像不可点。
6. 资产生成任务支持并发。点击虚线框或顶部生成按钮会打开新生成界面，不会抢占旧任务；只有点击某个等待卡才回到该任务自己的生成页。关闭生成页不停止任务。
7. 资产生成任务卡原位更新：生成中显示通用蓝色动态等待卡，左上角显示百分比、左下角显示已等待时间；成功后原地变图片卡；失败后原地变失败卡。
8. 失败卡不会无声消失。失败卡右上角有关闭按钮可手动清除，点击中间可回到失败页。重试失败任务时失败卡会原地变等待卡；成功后同类型旧失败卡会被清理。
9. 成功后的原位图片卡已补齐普通资产卡功能：左下角 `@资产名`，右下角三点菜单，支持 `重命名 / 移动到 / 删除`。同时隐藏下方资产列表里同 URL 的重复卡，避免成功图出现两次。
10. 资产卡右下三点菜单新增浏览器边缘判断。靠右时一级菜单向左展开，`移动到` 二级菜单也向左展开，避免被浏览器右边裁切。
11. 资产生成页生成中允许点击右上角关闭和遮罩关闭。生成完成绿色提醒层级调到 `z-[9999]`，不会被全屏生成页挡住。
12. 对话流图片/视频专业模式输入框上方新增 `优化提示词` 按钮，放在 `清空输入框` 前。两者同规格并使用通用蓝色。仅当当前模式为图片/视频且输入框有文字时显示。
13. 对话流专业模式优化提示词接真实 `/api/chat`，模型兜底顺序为 `openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。图片模式按图片提示词优化，视频模式按视频提示词优化；成功后替换输入框内容并聚焦。
14. 对话流右上角使用量浮窗已调整：`Token` 改为 `Tk`；美元和人民币改用 `RiMoneyDollarCircleLine / RiMoneyCnyCircleLine` 图标，不再显示 `$ / ¥` 字符；顶部按钮图标改为 `RiCopperDiamondLine`，尺寸 `22px`，和左侧收起按钮一致。
15. 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 warning；多次 `npm run build` 通过。

主要文件：

- `src/components/chat-workbench.tsx`
- `handover/00-README.md`
- `handover/03-progress-and-status.md`
- `handover/05-chat-history-highlights.md`
- `handover/CHANGELOG.md`

## 2026-05-27 本轮后续补充：场景生成、资产预览反推和积分表调整

本轮完成：

1. `资产生成 > 场景图片` 已新增固定入口 `场景生成`，点击后打开和角色生成共用的全屏生成界面。成功图写入 `资产生成 > 场景图片`，带 `librarySource: "asset_generation"`、`type: "scene_image"`、`lockedType: true` 和预览参数。
2. 资产生成分类筛选已修复，场景页不会再显示角色图。资产生成分类必须同时匹配 `librarySource: "asset_generation"` 和当前分类 `type`。
3. 角色入口和生成页标题已从 `角色图片生成` 改为 `角色生成`。媒体预览页右侧栏已改为始终显示，固定 `360px`，整体最小宽度 `920px`。
4. 场景生成比例菜单为 `单场景9:16 / 单场景16:9 / 四宫格16:9`。四宫格必须是一张 `16:9` 横图，四格分别为同一场景的正面、45度侧面、俯视、仰视。
5. 场景生成强规则：必须是纯场景，绝对不能有人、人物、角色、人形、剪影、人群、脸、手脚；不能有文字、Logo、水印、UI、二维码、边框、分割线、海报排版等。用户提示词里的人物信息必须忽略。
6. 资产生成输入框关闭后会保留提示词草稿和参数选择。角色生成和场景生成分别保存提示词，互不覆盖；重新打开只清空生成结果、缩放、下载和菜单状态。
7. 资产生成输入框里的有效 `@资产` 会在提示词上方显示同对话流输入框风格的一行缩略图，超出有左右按钮和渐隐，点击 `X` 会移除对应 `@资产名`。
8. 资产生成参数行规则改为：生成页不显示模型，只显示 `类型+比例 | 尺寸 + K数 | 风格`；资产库预览页显示 `模型 | 类型+比例 | 尺寸 + K数 | 风格`。对话流参数显示不改。
9. 资产生成风格强绑定已加强。优化提示词返回后和最终生图前都会本地清理冲突风格词，并强行加当前风格前缀。写实/2D/3D 三种互斥，以菜单选择为准。
10. 资产生成 `优化提示词` 模型顺序改为三级兜底：`openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。`/api/chat` 已允许特殊模型 `openai/gpt-5.5`。
11. 上传图资产预览页显示来源：无生成参数的图片会在参数行位置显示 `资产库上传` 或 `对话流上传`，提示词区显示 `暂无提示词`。
12. 上传图预览页新增 `反推提示词`：按钮为通用蓝底，图标 `RiQuillPenAiLine`。点击后用图片调用 `/api/chat`，模型顺序同上：`openai/gpt-5.5` -> `openai/gpt-5.4` -> `bytedance-seed/seed-2.0-lite`。成功后写回资产 `sourcePrompt` 并显示在提示词区。
13. 资产预览页提示词标题栏新增无底复制图标按钮。复制成功后显示灰色较大对勾，失败显示红叉。
14. 我的积分表已重构为按 `积分消耗来源` 聚合。角色图片生成、场景图片生成、分镜图片生成和图片反推提示词各自聚合为单独来源；普通对话仍按历史对话名聚合。来源写在 `CreditLedger.metadata.creditSource`，旧数据无法可靠拆分。
15. 我的积分新增 `对话Token` 列，普通对话优先读取工作区 `usageSummary.totalTokens`，没有再用流水 token。普通对话扣除积分也用工作区 `usageSummary.credits` 兜底，避免旧数据出现 Token 很多但扣除 `-0`。
16. 我的积分 `图片` 和 `视频` 合并为 `图片/视频` 一列，如 `22/0`、`9/--`、`--/--`。`最后活跃` 显示规则：24小时内显示时分，超过24小时显示月日，超过一年只显示年份；列宽降到 `72px` 且不换行。
17. 当前我的积分表格列间临时显示浅灰竖线，用于继续观察和调整列宽。
18. 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 warning；多次 `npm run build` 通过。

主要文件：

- `src/components/chat-workbench.tsx`
- `src/app/api/chat/route.ts`
- `src/app/api/credits/me/route.ts`
- `handover/00-README.md`
- `handover/03-progress-and-status.md`
- `handover/05-chat-history-highlights.md`
- `handover/CHANGELOG.md`

## 2026-05-26 本轮后续补充：角色图片生成做实、规则增强、资产菜单调整

本轮完成：

1. `资产生成 > 角色图片` 的虚线入口文案已改为 `角色图片生成`。
2. 角色图片生成界面改成真正全屏，去掉顶部留空和顶部圆角；右侧设置栏固定 `360px`，始终显示，整体最小宽度 `920px`。
3. 右侧设置栏顶部新增 `RiAccountBoxLine + 角色图片生成` 标题。
4. 重新打开角色生成界面时，只保留四个菜单上一次选择；输入框、生成结果、缩放/下载状态、`@` 菜单、优化状态全部清空。
5. 角色输入框已复用 `PlainMentionEditor`，支持蓝色 `@资产名`；正文为 `13px / 22px`；滚动条靠右贴边。
6. 角色输入框顶部按钮为 `@ 引用资产 / 优化提示词 / 清空输入框`，蓝色无底。`优化提示词` 已接真实 `/api/chat`，并按内部角色优化规则只保留角色相关内容。
7. 角色生成页的 `@` 菜单向左展开，宽 `380px`，右对齐输入框；打开逻辑已稳定化，点 `@ 引用资产` 不再先插入 `@`，手动输入 `@` 也会打开，选择资产会替换光标前 `@xxx` 或插入到当前光标。
8. `@` 菜单数据源按新资产库结构重做：`角色图片 / 场景图片 / 分镜图片` 只显示 `asset_generation` 图片，`对话流图片` 显示非 `asset_generation` 图片；不显示待分类、回收站或视频。
9. 角色生成已接 `/api/image`。生成中左侧显示等待卡；成功后在当前生成页显示图片，不可点击进入预览；失败显示同尺寸失败卡并可原地重试。
10. 成功图顶部缩放、实际尺寸、适合尺寸、下载按钮可用；实际尺寸可拖拽平移，滚轮可缩放。未生成前这些按钮禁用。
11. 生成中右侧全部禁用：四个菜单、`@`、优化、清空、输入框、生成按钮、顶部关闭按钮和点击遮罩关闭。
12. 角色生成成功后写入 `资产生成 > 角色图片`，显示在入口按钮后面；写入 `librarySource: "asset_generation"`、`type: "character_image"`、`lockedType: true` 和预览参数。
13. 角色生成内部强规则已接入且不显示到输入框。`单人9:16` 强制纯白背景、单人全身站立、头脚完整；`三视图16:9` 强制纯白背景和四视图角色参考。
14. 风格菜单已强绑定：写实、2D、3D 互斥；用户提示词和风格冲突时以菜单选择为准。
15. 三视图规则按模型拆分。`GPT-5.4 Image 2` 和 `Gemini 3.1 Flash` 当前相对可用；`Gemini 3 Pro` 和 `Seedream 4.5` 不稳定。`Seedream 4.5` 已改为纯正向描述，避免反向触发分隔线。
16. 左侧 `分镜图片（首帧）` 文案统一改为 `分镜图片`，内部类型仍是 `shot_image`。
17. 删除资产后普通分类不再显示回收状态资产，只有回收站显示倒计时资产。
18. 图片资产右上角文件夹移动菜单已移除。移动功能合并到右下角三点菜单，顺序为 `重命名 / 移动到 > / 删除`；只有鼠标悬停 `移动到` 才显示二级菜单。对话流视频和回收站资产没有 `移动到`。
19. 移动二级菜单内容为 `角色图片 / 场景图片 / 分镜图片 / 对话流图片`，标题 `移动位置`，宽 `168px`；图标 `16px`、文字 `13px`、行高 `36px`。右下角三点操作菜单图标、文字和行高同步统一。
20. 本轮验证：多次 `npm run lint` 通过，仅剩项目原有 warning；角色生成做实后曾跑过 `npm run build` 通过。

主要文件：

- `src/components/chat-workbench.tsx`
- `handover/00-README.md`
- `handover/03-progress-and-status.md`
- `handover/05-chat-history-highlights.md`
- `handover/CHANGELOG.md`

## 2026-05-26 本轮补充：去除游客模式、资产库重构和角色图片生成界面

本轮完成：

1. 首页右上角去掉游客入口。未登录只显示 `登录`；已登录显示 `进入工作台` 和用户头像。`进入工作台` 按钮样式大小颜色与登录按钮一致。
2. 工作台游客模式入口已移除。`/workspace?guest=1` 不再生效；`src/app/workspace/page.tsx` 不再读取 `guest` 参数；`ChatWorkbench` 已移除 `forceGuestMode` props。
3. 未登录或认证失败进入 `/workspace` 时，不再读取本地游客工作区，而是直接回首页。登录用户仍读取数据库 `/api/workspace-state`。
4. 游客本地保存逻辑已移除：不再把会话、资产、工作流、输入设置、意图记忆、反馈日志写入旧 `yinzao-*` localStorage key。旧 key 未主动清除，但代码不再用它们作为工作台数据源。
5. `src/app/workspace/page.tsx` 加了 `export const dynamic = "force-dynamic";`，解决构建时预渲染工作台触发 `window is not defined` 的问题。
6. 后台里旧文案 `游客模式开关：下一版接入` 改成 `访问控制：下一版接入`。
7. 左侧主菜单 `资产管理` 改为 `资产库`；顶部标题也改为 `资产库`。点击主菜单资产库会自动切到 `角色图片`，不再进入 `全部资产` 页面。
8. 资产库二级结构改为三组：`资产生成`、`对话流资产`、`回收资产30天删除`。每组小标题前有圆点，所有数量列统一右对齐。
9. `资产生成` 分类包含 `角色图片 / 场景图片 / 分镜图片`。该区域只显示 `librarySource: "asset_generation"` 的图片。
10. `对话流资产` 分类包含 `对话流图片 / 对话流视频`。旧资产和后续对话流生成的图片/视频默认都进入这里，即没有 `librarySource: "asset_generation"` 的非回收站资产。
11. `AssetItem` 新增前端字段 `librarySource?: "asset_generation" | "conversation"`。资产库上传会写 `asset_generation`；对话流提取和生成写 `conversation`；旧资产未带字段时按对话流资产处理。
12. 回收站为两个分类共用，删除/恢复/30 天删除规则保持不变。
13. 后续对话流资产命名规则改为随机数字：图片 `image_随机5-10位数字`，视频 `video_随机5-10位数字`。旧资产不批量重命名。
14. 对话流视频右上角分类按钮已去除。对话流图片右上角分类按钮已做实，支持在 `角色图片 / 场景图片 / 分镜图片 / 对话流图片` 之间切换。
15. 对话流图片切到角色/场景/分镜后，会移动到 `资产生成` 对应分类；切回 `对话流图片` 会回到 `对话流资产`。
16. `对话流视频` 页面卡片改为横向矩形，默认 `16:9`，大屏一行显示 4 个。其它图片分类仍为正方形网格。
17. 所有媒体预览页的 `使用提示词` 按钮已改：填入输入框、关闭预览页，并自动切回 `对话模式` 工作台。
18. `资产生成 > 角色图片` 网格第一个固定显示虚线 `生成角色` 按钮，图标为 Remix `add-large-line`，文字为 `生成角色`。没有角色图时仍显示该按钮，不再显示空状态。
19. 点击 `生成角色` 打开角色图片生成界面。界面使用和媒体预览页同款全屏底、顶部留空、毛玻璃左侧生成区和右侧设置区。
20. 角色图片生成界面左侧为生成区，当前为空白占位，不要虚线底框。左上缩放、实际尺寸、适合尺寸按钮和右上下载按钮在没有生成图片前禁用。
21. 角色图片生成界面右侧为输入区，上方参数按钮目前是占位：模型占位、比例占位、分辨率占位、数量占位；下方是提示词输入框；生成按钮当前禁用。
22. 注意：角色图片生成界面当前只做 UI 占位，未接真实生成。下一步如果继续做，需要在该界面调用 `/api/image`，成功后把图片写入 `资产生成 > 角色图片`，并显示在 `生成角色` 按钮后面。
23. 本轮验证：`npm run lint` 和 `npm run build` 均通过。

主要文件：

- `src/app/page.tsx`
- `src/app/workspace/page.tsx`
- `src/components/chat-workbench.tsx`
- `src/app/admin/page.tsx`

公网部署重点待办：上传图、资产图、历史参考图当前在本地开发阶段会转 base64 传给 OpenRouter，容易触发 `413 Request Entity Too Large`。正式部署前必须改成先保存到可公网访问的 HTTPS 地址（对象存储 / CDN / 静态资源服务），再把 HTTPS URL 传给 OpenRouter，不再传 base64；同时要处理 URL 持久化、旧本地路径兼容和生成接口传参。

已完成：文档读取解析 + Agent 激活第一版。`.md / .txt / .csv` 前端读取文本，读取中保留细进度条；发送时把已读取文本带给 `/api/agent-plan` 和 `/api/chat`。智能体规则 / 工作流说明类文档可通过“激活这个智能体”触发 `XXX已激活` 回复并进入文档规则上下文。`pdf/docx/xlsx/pptx` 仍只展示附件，后续再接服务端解析库。

当前后续待办：文档原件正式部署时要走对象存储 + CDN；Agent 不应每次直接读 CDN 原文件，应由服务端解析文本/分块入库后读取。后续还需支持 `pdf/docx/xlsx/pptx` 服务端解析、文档文本入库、检索和长期上下文管理。

## 2026-05-25 本轮后续补充：文档解析、文档预览、滚动条和用户中心积分页

本轮完成：

1. `.md / .txt / .csv` 文档读取已接入。上传后前端读取文本并保存到文档对象，发送 Agent 时会把已读取文本拼进最新用户消息上下文。只上传文档不输入文字也允许发送；读取中发送提示 `文件读取中`。
2. 文档卡片底部显示规则改为始终显示 `文档类型 · 文件大小`，不显示 `已读取 / 读取中 / 读取失败` 文字；读取中仍有底部细进度条。输入框文件卡片和发送后的用户消息文件卡片都可点击预览。
3. Agent 文档激活规则已写入 `src/lib/openrouter.ts`。如果文档像智能体规则/工作流说明，用户说“激活这个智能体”时，Agent 用普通长回复排版，首行如 `XXX已激活`，并按文档规则继续。激活类回复前置图标改为 `RiTerminalWindowFill`。
4. 右侧文档预览面板已完成。`.md` 用现有 `FormattedMessage` 渲染标题、加粗、列表和分隔线；`.txt/.csv` 保留换行显示；未解析文件提示暂不支持预览。标题栏显示文档名、类型和大小，右侧有复制全文、下载文档、关闭三个图标；复制成功显示对勾。
5. 文档预览不再覆盖对话流，而是并列分栏。默认对话流 : 文档预览为 `5:4`；中间分隔线可拖动，拖动后保留用户宽度。分隔线默认浅灰，中间有小竖向胶囊，hover 时轻微变深。文档预览层级降为 `z-40`，不会盖住用户中心黑色遮罩。
6. 新增全局滚动条控制组件 `src/components/global-scrollbar-controller.tsx`。全局滚动条默认透明隐藏，滚动时显示原灰色滚动条，停止 `2秒` 后消失；`yinzao-hidden-scrollbar` 和 `yinzao-upload-row-scroll` 仍强制永不显示。左侧历史/工作流列表增加 `yinzao-scrollbar-hover`，鼠标移入也显示滚动条。
7. 用户中心右侧结构统一：标题和关闭按钮同一行，关闭按钮放大并改为圆角矩形底；右侧整体下移 `12px`。覆盖用户信息、我的积分、帐号安全、设置四页。
8. 左下角 `个人免费版` 按钮现在打开用户中心 `我的积分`。我的积分页新增免费套餐概览卡：标签 `免费套餐`、标题 `个人免费版 + RiLeafLine`、说明文案 `当前为免费版本，暂无升级套餐功能。如有疑问请联系管理员！`、真实总积分和 `已赠送积分`。
9. `/api/credits/me` 新增 `giftedCredits`，统计当前用户 `CreditLedger.direction = "increase"` 的积分总和。后续后台手动加分只要使用 `grantCredits(..., "admin_adjust")` 或写入 `direction: increase`，就会显示到已赠送积分。
10. 新增 `/api/credits/conversation-title`。用户重命名对话时会同步更新当前用户该 `conversationId` 下的 `CreditLedger.conversationTitle`；删除对话不删除积分流水，因此我的积分扣费记录仍保留。
11. 我的积分表格 UI 细调：外框圆角改为 `5px`；分页按钮常态无边框，颜色与关闭按钮一致，hover 淡灰底，带左右箭头，禁用态淡化。
12. 本轮验证：多次 `npm run lint` 和 `npm run build` 均通过。

主要文件：

- `src/components/chat-workbench.tsx`
- `src/lib/openrouter.ts`
- `src/app/globals.css`
- `src/components/global-scrollbar-controller.tsx`
- `src/app/layout.tsx`
- `src/app/api/credits/me/route.ts`
- `src/app/api/credits/conversation-title/route.ts`

## 2026-05-25 本轮补充：后台积分增强、首页登录态和拖拽上传

本轮完成：

1. 后台左侧五个大菜单已加 Remix 图标，`积分管理` 图标已统一为前台同款 `RiVipDiamondLine`。
2. 后台积分管理统计卡已从 4 个改为 6 个：总积分、增加积分总数、消耗积分、消耗 Token、消耗美元、消耗人民币。增加积分绿色；消耗类红色，不显示负号。
3. `CreditLedger` 新增 `direction` 字段，迁移目录为 `prisma/migrations/20260522143000_credit_ledger_direction`。迁移会给现有用户回填 `signup + increase` 增加流水，数值为当前积分余额加历史消耗积分。
4. `src/lib/credits.ts` 新增 `grantCredits()`。注册送积分现在先创建用户 `credits = 0`，再调用 `grantCredits(user.id, signupCredits, "signup")` 写增加流水。涉及 `/api/auth/verify-code` 和 `/api/admin/verify-code`。
5. 模型扣费继续通过 `chargeCredits()` 写 `direction: consume`；后台统计、后台用户详情消耗数据、前台我的积分页都已按真实流水方向统计。
6. 首页 `/` 已接入前台登录态。已登录时右上角显示用户头像，点击头像显示用户信息、我的积分、帐号安全、设置、退出登录；点前四项会跳到 `/workspace` 并打开对应用户中心页。
7. 首页输入框已做实。已登录空输入点发送直接进工作台；未登录空输入点发送弹登录框；已登录有输入点发送会在工作台新建对话并自动按 Agent 发送进入思考。
8. 工作台右侧对话流已支持拖拽上传。拖拽文件时出现白色半透明遮罩、背景模糊、虚线边框、中间 `在此处拖放文件`、文件类型提示和绿色圆形箭头图标。跟随鼠标的小白框已删除。
9. 拖拽和输入框 `+` 支持图片和文档：`pdf, txt, csv, docx, doc, xlsx, xls, pptx, ppt, md`。图片上限 `10` 张，文档上限 `8` 个。电子书格式 `mobi/epub` 已删除。
10. 输入框附件显示重做：文档单独一行在上，图片单独一行在下，文档和图片可同时存在。两行超出宽度时显示左右按钮，滚动条隐藏，左右边缘渐隐。
11. 输入框图片缩略图统一为 `80x80px`。文档卡片约 `200x54`，右上角可删除，左侧类型小标为淡色底、2px 描边、3px 圆角正方形字母卡。
12. 发送后的用户消息附件显示已同步。文档在文字下方，图片在文档下方，图片为 `80x80px`。如果用户只上传附件没输入文字，不再显示内部默认句子；默认句只给 Agent 内部使用。
13. 本轮排查 `@`：确认 `@` 正常传图，`/api/image` 收到参考图且本地文件存在。`src/lib/openrouter.ts` 增加非敏感调试日志，打印 `reference_count`、参考图类型和本地文件是否存在。用户要求 `@` 问题先放下。
14. 关于文档上传正式部署：原文件以后走对象存储 + CDN；Agent 不应直接读 CDN 原文件，而应读服务端解析后的文本/分块内容。
15. 本轮验证：`npx prisma migrate deploy` 成功；`npx prisma generate` 成功；多次 `npm run lint` 和 `npm run build` 通过。

主要文件：

- `prisma/schema.prisma`
- `prisma/migrations/20260522143000_credit_ledger_direction/migration.sql`
- `src/lib/credits.ts`
- `src/lib/openrouter.ts`
- `src/app/page.tsx`
- `src/components/chat-workbench.tsx`
- `src/app/globals.css`
- `src/app/api/auth/verify-code/route.ts`
- `src/app/api/admin/verify-code/route.ts`
- `src/app/api/credits/me/route.ts`
- `src/app/admin/page.tsx`
- `src/app/admin/admin-credits-panel.tsx`

## 2026-05-22 本轮补充：积分系统第一版和后台细调

本轮完成：

1. Agent 回复清洗：修复结构化 JSON 返回内容中把 `\n\n` 直接显示到页面的问题。`src/lib/openrouter.ts` 新增模型文本清洗，处理字面 `\n / \t / \"` 和 JSON 代码块残留；`parseStructuredAgentReply()` 和 `parseAgentPlan()` 解析出的正文、displayText、clarifyQuestion、prompt、items、constraints、suggestions 都会清洗。
2. Agent 短回复换行优化：`在，我在。\n\n如果你愿意...` 这类“短开场句 + 普通正文”会自动合并成一段；长回答、列表、剧本、分镜、知识讲解保留换行。Agent finalInstruction 已明确普通短聊天不要分段，只有长回答/列表/剧本/分镜/知识讲解才换行。
3. 前端和后台显示层兜底：`src/components/chat-workbench.tsx` 的 `sanitizeMessageContentForDisplay()`、`ReferencedTextContent()` 以及后台 `AdminFormattedMessage()` 都会把旧历史中的字面 `\n` 转成正常显示。
4. 新增积分配置表 `CreditSetting` 和积分流水表 `CreditLedger`，迁移目录为 `prisma/migrations/20260522120000_credit_system`。已执行 `npx prisma migrate deploy`。
5. `CreditSetting` 字段：`usdToCnyRate`、`creditsPerCny`、`signupCredits`、`chargeText`、`chargeImage`、`chargeVideo`。默认值为汇率 `7.2`、`1人民币=10积分`、注册送 `1500`、三类扣费都开启。
6. `CreditLedger` 字段记录：用户、对话 ID、对话标题、请求 ID、类型、标签、模型、扣除积分、prompt/completion/total token、美元、人民币、图片数、视频数、元数据和创建时间。`requestId + kind` 做唯一约束，避免同一请求重复扣同类费用。
7. 积分规则：OpenRouter 返回美元费用后，按后台汇率换算人民币，再按兑换比换算积分；积分只保存整数，扣分使用四舍五入；失败不扣；余额为 `0` 禁止继续使用模型；余额大于 `0` 可以生成最后一次，最多扣到 `0`，不会负分。
8. 注册送积分改为读取后台 `CreditSetting.signupCredits`。涉及 `/api/auth/verify-code` 和 `/api/admin/verify-code`。
9. 扣分接入点：`/api/agent-plan` 成功后扣文本规划；`/api/chat` 成功后扣文本回复/提示词整理；`/api/image` 成功后扣图片；`/api/video` 创建任务不立即扣，轮询成功拿到视频地址后扣视频。游客模式无登录用户，当前不写数据库扣分。
10. 前端 `CurrentUserProfile` 增加 `credits`，`/api/auth/me` 和 `/api/user-profile` 返回余额后，左下角积分卡实时显示真实余额。每次扣分后接口返回 `credit.balance`，前端立即刷新左下角余额。
11. 前端会话 `usageSummary` 增加 `credits`。右上角当前会话使用量浮窗新增积分图标和扣除数，只显示图标和数字，不显示“积分”二字。
12. 用户菜单新增 `我的积分`，用户中心左侧也新增 `我的积分` 标签页。右侧显示 `我的积分：xxxx`，下面按历史对话聚合：对话名称、扣除积分红字、图片数量、视频数量、最后活跃时间，支持分页。
13. 新增 `/api/credits/me`，返回当前登录用户余额、积分设置摘要和按对话聚合的积分记录。
14. 新增后台积分设置接口 `/api/admin/credits`，但浏览器后台保存实际改用 `/admin/api/credits`。原因是后台登录 Cookie `flashmuse-admin-session` 只作用 `/admin`，请求 `/api/admin/credits` 不会携带后台 Cookie，保存会无权限并刷新回旧值。
15. 后台 `积分管理` 页面做实，新增 `src/app/admin/admin-credits-panel.tsx`。顶部标题 + 右侧搜索；设置区可改美元汇率、积分兑换比、注册送积分、文本/图片/视频是否扣分；统计卡显示总扣积分、总 Token、总美元、总人民币。
16. 后台积分列表按对话流聚合显示：用户/对话、积分、Token、美元/人民币、图片数、视频数、最后活跃、展开三角。列表圆角统一为用户管理规格 `10px`，默认不展开，点整行或末尾三角都能展开。展开后明细按文本规划/回复、图片批次、视频任务分开显示。
17. 后台美元汇率输入改为文本输入，允许小数点和最多两位小数；输入 `7` 后失焦显示 `7.00`，输入 `7.` 不会被浏览器吞掉。当前本地数据库曾查到保存值 `6.8`，说明保存链路可用。
18. 后台用户详情展开区里 `历史对话 / 生成图片 / 生成视频` 可点击字段名下划线标识，右侧数值不加下划线、不变蓝。
19. 后台历史对话弹窗和生成图片/生成视频预览弹窗标题栏改为跨整个弹窗宽度，标题栏下方再分左右列表/内容区。
20. 后台左侧栏改为固定在浏览器视口内，当前管理员块贴在左侧栏底部，滚动页面不会消失。
21. 后台搜索框统一：用户管理和积分管理顶部搜索框图标都放右侧，输入文字居左，图标居右。
22. 后台用户管理列表改为点整行也可展开/收起，右侧三角仍可点，三角点击会阻止冒泡避免重复触发。
23. 本轮验证：`npx prisma migrate deploy` 成功；`npx prisma generate` 成功；多次 `npm run lint` 和 `npm run build` 均通过。
24. 注意：`npx prisma generate` 第一次仍遇到 Windows `query_engine-windows.dll.node` 被端口 `3000` dev server 占用，已停止端口 `3000` 的 Node 进程后重试成功。当前 dev server 可能已被停掉，需要预览时重新启动。

主要文件：

- `prisma/schema.prisma`
- `prisma/migrations/20260522120000_credit_system/migration.sql`
- `src/lib/credits.ts`
- `src/lib/openrouter.ts`
- `src/components/chat-workbench.tsx`
- `src/app/api/agent-plan/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/image/route.ts`
- `src/app/api/video/route.ts`
- `src/app/api/credits/me/route.ts`
- `src/app/api/admin/credits/route.ts`
- `src/app/admin/api/credits/route.ts`
- `src/app/admin/admin-credits-panel.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/admin/page.tsx`

## 2026-05-21 本轮后续补充：后台用户详情、历史对话弹窗和媒体预览

本轮完成：

1. 后台登录页新增历史管理员邮箱下拉。登录成功后保存到 `localStorage` 的 `flashmuse-admin-login-history-v1`，最多 `5` 条；点击或聚焦邮箱输入框时可选择历史账号。该功能只在后台登录页使用，和前台首页登录历史 key 不混用。
2. 后台用户管理表头和文案细调：`最后登录` 改为 `最后登录时间`；状态筛选里的 `已禁用` 和状态标签里的 `已禁用` 改为 `禁用`。
3. 后台假用户 `testuser001@flashmuse.test` 到 `testuser100@flashmuse.test` 会按序号生成稳定模拟 IP 和归属地，用于调试列宽；真实用户仍显示 `待接入`。当前没有新增 `Session.ipAddress` 等真实字段。
4. 用户展开详情区已重做。去掉原白色圆角卡片和三列小标题，改成四列灰底直角信息条，列间距 `5px`，条目之间 `1px`，每条名称居左、值居右。
5. 展开区第一列为账号资料：登录帐号、昵称、手机号、密码、语言、注册时间、资料更新时间。第二列为登录和设置：最近登录 IP、最近登录归属地、Session 数、Session 活跃、生成完成提醒、自动收入资产库、预览滚轮。第三列为工作区使用：历史对话、生成图片、生成视频、工作区保存。第四列为积分消耗：积分、已消耗积分、已消耗Token、已消耗金额。
6. 用户询问 `Session 数` 含义，已确认它是数据库当前保留的登录态数量，不是历史对话数，也不是总登录次数。`Session 活跃` 是最近一次使用该登录态的时间，区别于真正登录成功的 `最后登录时间`。
7. `工作区保存` 只显示最后保存时间，不再加 `已保存，` 前缀；未保存显示 `未保存`。
8. `生成图片 / 生成视频` 数量现在优先从 `UserWorkspaceState.state` 中实际 assistant 媒体消息统计，避免用户已经生成过但 `User.generatedImageCount / generatedVideoCount` 字段仍为 0 时后台显示不准。`已消耗Token / 已消耗金额` 从各会话 `usageSummary` 汇总，金额显示 `$ / ¥`，汇率使用 `defaultUsdToCnyRate`。`已消耗积分` 暂按 `1500 - credits` 计算。
9. `历史对话` 详情项可点击打开只读历史对话弹窗。弹窗大小与媒体弹窗一致，圆角 `10px`；左侧显示 `XXX历史对话` 和历史会话列表，右侧显示对话内容，没有输入框。左侧未选中项不显示时间且高度更低，选中项灰底 `#ececec` 并显示时间。
10. 历史对话弹窗会渲染 AI 文案轻量 Markdown，支持标题、加粗、分隔线、列表，避免露出 `# / ## / ** / ---` 等符号。用户消息为右侧灰色气泡；图片和视频会只读展示。
11. `生成图片` 和 `生成视频` 详情项可点击打开媒体预览弹窗。弹窗左侧是大图片/视频预览，右侧是缩略图列表，布局与历史对话左右相反。缩略图选中态是蓝色边框。
12. 媒体预览弹窗底部参数已按工作台媒体结果样式显示：提示词一行，下方 `模型 | 比例 | 尺寸 + 分辨率图标 | 时长`。图片分辨率图标和 `超清4K` 金色标签、视频 `SD / HD / FHD / 4K` 黑底图标都在后台复刻。模型名通过 `src/lib/models.ts` 的 `imageGenerationModels / videoGenerationModels` 转成展示名。
13. 后台历史对话、媒体预览、生成数量、Token 和金额统计均从 `UserWorkspaceState.state` 读取，没有新增数据库表或迁移。后续如要做真正生成记录和积分扣费，仍应新增独立 `GenerationJob / CreditLedger` 等表。
14. 本轮验证：`npm run lint` 和 `npm run build` 均通过。

主要文件：

- `src/app/admin/admin-login-form.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/app/admin/page.tsx`

## 2026-05-21 本轮对话补充：后台用户管理页、用户 ID 规则和用户中心 ID 显示

本轮完成：

1. 后台左侧菜单从锚点跳转改成分类页切换。`/admin` 默认是概览；`/admin?tab=users` 是用户管理；`/admin?tab=credits`、`/admin?tab=records`、`/admin?tab=settings` 分别是积分管理、生成记录、系统设置占位页。
2. 概览恢复为最初结构：顶部四个统计卡，下面三块占位卡，分别是积分管理、生成记录、系统设置。用户管理表不再显示在概览里。
3. 后台所有分类页结构统一：标题在上方，标题下不显示小灰字说明，下面是内容区。`积分管理 / 生成记录 / 系统设置` 目前仍是占位卡。
4. 新增 `src/app/admin/admin-users-panel.tsx`，用户管理从 `page.tsx` 拆出为客户端组件，负责搜索、筛选、分页、展开详情等交互。
5. 用户管理顶部右侧为短搜索框和状态筛选。搜索框使用 `RiSearchLine` 图标，提示为 `ID / 邮箱 / 昵称 / 手机`；状态筛选为 `全部 / 正常 / 已禁用`。
6. 用户管理统计卡显示：总用户、今日新增、正常用户、禁用用户、总积分余额。该排卡片高度已压缩，上下内边距 `10px`，数字 `22px` 加粗。外部上下间距也已压缩。
7. 用户列表固定最小宽度 `1180px`，后台整体最小宽度 `1464px`，浏览器再窄时不继续压缩表格。用户列表外框圆角为 `10px`，内部横向滚动层已去掉。
8. 用户列表每页显示 `10` 条，底部分页显示总条数、当前范围、上一页/下一页、当前页码/总页数。分页条外层白底、边框、阴影已去掉。
9. 用户列表主行字段已调整为：用户ID、用户（头像/账号/昵称）、积分 + `调积分` 按钮、最近登录 IP / 归属地、最近登录时间、状态 + `禁用/启用` 按钮、三角展开按钮。`查看` 按钮已删除。
10. 最近登录 IP 和归属地目前没有数据库字段，后台主行和展开区都先显示 `待接入`。后续如果做真实功能，应在 `Session` 表新增 `ipAddress / ipCountry / ipRegion / ipCity / userAgent` 等字段，并在登录创建 Session 时记录。
11. 用户行三角展开后会在当前行下方下推显示隐藏详情块，宽度跟表格一致。隐藏区分三列：账号信息、使用数据、登录和工作区。真实显示的内容包括手机号、语言、密码是否设置、注册时间、资料更新时间、生成图片数、生成视频数、生成完成提醒、自动收入资产库、预览滚轮设置、Session 数、最近 Session 活跃时间、工作区保存状态。
12. 本地 PostgreSQL 已插入 `100` 个测试用户用于后台测试，邮箱为 `testuser001@flashmuse.test` 到 `testuser100@flashmuse.test`。这些测试用户含昵称、部分手机号、积分、图片数、视频数、注册时间、最后登录时间、禁用状态等模拟数据。
13. 后台假用户头像规则：邮箱以 `@flashmuse.test` 结尾且没有头像时，统一显示 `?`；真实用户仍显示头像或默认首字符。
14. 用户 ID 规则已改为 `ID_六位随机数字`，例如 `ID_178523`。`prisma/schema.prisma` 中 `User.id` 已从 `@default(cuid())` 改为手动生成；`src/lib/auth.ts` 新增 `generateUserId()`，注册和后台验证码创建用户时都会写入该 ID。
15. 本地已有 `102` 个用户已从旧 ID 迁移为 `ID_` 格式。迁移时直接更新 `User.id`，关联的 `Session.userId` 和 `UserWorkspaceState.userId` 因外键级联更新保持正常。
16. 用户中心头像下方已新增用户 ID 显示，只显示数据库原值，例如 `ID_779117`，不额外加 `ID：` 前缀。字号最后调为 `14px`，颜色稍深。下面的信息行整体下移一点。
17. `/api/auth/me` 和 `/api/user-profile` 返回的用户资料里现在包含 `id`。`src/lib/user-profile.ts` 的 `getUserProfileFromUser()` 会返回 `id`。
18. 用户昵称上限已统一为 `8` 个字。前端用户中心昵称输入框会截断到 8 个字符，后端 `normalizeUserProfileInput()` 也会按字符截断到 8，避免绕过前端。
19. 本轮 `npx prisma generate` 第一次因为 Windows `query_engine-windows.dll.node` 被端口 `3000` dev server 占用失败，已停止端口 `3000` 的 Node 进程后重新生成成功。注意当前开发服务器可能已停，需要重新启动。
20. 本轮多次验证：`npm run lint` 和 `npm run build` 均通过。

主要文件：

- `src/app/admin/page.tsx`
- `src/app/admin/admin-users-panel.tsx`
- `src/components/chat-workbench.tsx`
- `src/lib/auth.ts`
- `src/lib/user-profile.ts`
- `src/app/api/auth/verify-code/route.ts`
- `src/app/api/admin/verify-code/route.ts`
- `prisma/schema.prisma`

## 2026-05-19 本轮对话补充：登录系统、数据库、SMTP 和用户工作区存储

本轮完成：

1. 已接入 `PostgreSQL + Prisma`。新增 `prisma/schema.prisma`、`docker-compose.yml`、`src/lib/prisma.ts` 和本地 `.env` 数据库配置；本机 Docker Desktop / WSL2 已安装并可运行 `flashmuse-postgres` 容器。
2. 已执行数据库迁移：`init_auth` 和 `user_workspace_state`。当前数据库表为 `User`、`Session`、`EmailVerificationCode`、`UserWorkspaceState`。
3. 登录 Session 使用 `HttpOnly Cookie`，Cookie 名为 `flashmuse-session`；服务端只保存 session token hash，不保存明文 token。
4. 登录流程已从占位改成可用：邮箱回车后调用 `/api/auth/check-email`；未注册或未设置密码时走验证码登录；验证码校验通过即注册 / 登录；已设置密码账号可用密码登录。
5. 新增认证接口：`/api/auth/check-email`、`/api/auth/send-code`、`/api/auth/verify-code`、`/api/auth/login-password`、`/api/auth/me`、`/api/auth/logout`、`/api/auth/set-password`、`/api/auth/change-password`。
6. 已接入网易个人邮箱 SMTP 发验证码，发信封装在 `src/lib/mailer.ts`，依赖 `nodemailer`。SMTP 配置写在本地 `.env`，来自 `AI-Video-Assistant_Project Planning\闪念官方邮箱.txt`。该 txt 和 `.env` 都含敏感信息，不要提交。
7. 验证码接口逻辑：SMTP 配置完整时真实发邮件；SMTP 未配置时回退到终端打印验证码，便于本地开发。SMTP 连通性已用官方网易邮箱自发自收测试通过。
8. 首页登录抽屉 UI 继续微调：`密码登录 / 验证码登录` 字号因全局 `button { font: inherit; }` 改为内部 `span style={{ fontSize: 13 }}`；邮箱输入 placeholder 改为 `请输入邮箱，如 name@email.com`；输入框文字为 `16px`。
9. 工作台左下角用户邮箱现在读取 `/api/auth/me` 的真实邮箱；退出登录调用 `/api/auth/logout` 并回到首页。
10. 用户中心弹窗已新增：左下角菜单中的 `用户信息 / 帐号安全 / 设置` 会打开同一个居中白色弹窗。弹窗参考用户给的设置弹窗图，左侧为选项卡，右侧为具体内容，右上角关闭，点击遮罩关闭。
11. `用户信息` 页显示头像占位、登录邮箱、积分、生成图片数、生成视频数、已使用积分，统计项目前均为占位。`帐号安全` 页可设置密码或修改密码。`设置` 页放语言、默认进入页面、生成完成提醒、自动保存历史、本地缓存、版本信息等占位。
12. 工作台存储策略已改成双模式：未登录 / 首页 `进入工作台` 仍用浏览器原 `localStorage`，保留当前测试内容；邮箱登录后使用数据库 `UserWorkspaceState.state`，新账号初始为空，后续会话、资产、工作流、输入设置、反馈和纠错记忆都会写数据库。
13. 新增 `/api/workspace-state`：`GET` 读取当前登录用户工作区 JSON，`PUT` 保存当前登录用户工作区 JSON。当前是整份 JSON 保存，后续正式运营可拆成独立的对话、资产、生成任务、积分流水表。
14. 本轮遇到 Prisma Client 生成失败 `EPERM rename query_engine-windows.dll.node`，原因是 `npm run dev` 的 Node 进程占用 DLL；已停止相关 Node 进程后重新 `npx prisma generate` 成功。
15. 本轮验证：`npx prisma migrate dev --name user_workspace_state` 成功，`npm run lint` 通过，`npm run build` 通过。

本轮继续完成：

16. 用户中心资料已拆成 `User` 表独立字段并完成迁移：`nickname / phone / avatarUrl / language / notifyOnGenerationComplete / autoSaveHistory / generatedImageCount / generatedVideoCount`。新增 Prisma 迁移 `20260519132218_user_profile_fields`，`npx prisma migrate dev --name user_profile_fields` 已应用。
17. 新增 `/api/user-profile`，用于独立读取和保存用户资料；`/api/auth/me` 返回完整用户资料；`/api/workspace-state` 只保存工作台状态，并会把旧 `UserWorkspaceState.state` 中的 `userNickname / userAvatarUrl / userPhone / userLanguage / notifyOnGenerationComplete / autoSaveHistory` 自动迁移到 `User` 字段后从 JSON 清理。
18. 用户中心 `用户信息` 页重排：头像居中，信息行统一 490px 灰底圆角；昵称、邮箱、手机、生成图片、生成视频依次显示。昵称和手机可编辑，左下角用户区显示头像、昵称和邮箱，并随昵称更新。
19. 默认头像按邮箱稳定生成淡色背景和首字符。用户头像上传已独立到 `/api/upload-avatar`，头像文件保存到 `public/generated/user_avatar/`；普通聊天上传仍走 `/api/upload-image` 和 `public/generated/upload_image/`。此前曾短暂把两个接口写反，已修复。
20. 帐号安全页重做：已设置密码时显示 `*********** / 密码已设置` 灰底行；提供 `修改密码 / 忘记密码` 文字按钮。修改密码走当前密码 + 新密码 + 确认密码；忘记密码会发送当前登录邮箱验证码，6 个方形输入框满 6 位自动验证，验证成功后进入重设密码界面。新增 `/api/auth/check-code` 和 `/api/auth/reset-password`。
21. 设置页已按用户要求调整：语言选择做实，支持 `简体中文 / 繁體中文`；语言名称在菜单中永远用自身语言显示。`生成完成提醒 / 自动保存历史` 改为通用蓝滑块；`默认进入页面` 移除；版本信息改为 `v0.1.0 内测版`。
22. 当前简繁切换实现是前端 DOM 转换层，不是完整 i18n。选择繁体后会转换工作台可见中文、placeholder、title、aria-label、alt；切回简体会反向转换。转换层跳过输入框、textarea、contenteditable、script/style 和 `data-no-translate="true"`。曾出现 MutationObserver 重复写 DOM 导致页面不可点，已加防重复写入保护。
23. 首页登录抽屉默认优先密码登录。邮箱输入框有内容时显示 `corner-down-left-line` 图标按钮，点击等同回车；邮箱提交后先查账号是否有密码，有密码进入密码输入，无密码或新账号自动切验证码登录。密码输入框不显示该图标，仍使用下方蓝色登录按钮。
24. 本轮再次遇到 Prisma Client 生成 DLL 被 dev server 占用，已停止端口 3000 的 Node 进程后重新 `npx prisma generate` 成功。最终验证：`npm run lint` 和 `npm run build` 均通过。

本轮继续补充：

25. 登录流程继续按用户要求细化：用户主动选择 `验证码登录` 后，邮箱回车直接发送验证码，不再检查是否有密码；只有默认 `密码登录` 模式才先查账号密码状态。
26. 验证码发送中状态已补齐。选择验证码登录并提交邮箱时，邮箱框下方显示蓝色 `正在发送验证码...`；三个点有逐个出现/消失动画。发送完成后切换到 6 位验证码输入框。
27. 登录提示清理规则已统一。邮箱、密码、验证码输入框只要继续输入、删除或删空，已有红字错误和灰字提示都会立即清空，避免空输入框下方继续挂着错误文案。
28. 邮箱输入示例已改为 `请输入邮箱，如 name@email.com`。`/api/auth/send-code` 已新增邮箱域名收信能力校验，先查 MX，失败再查 A/AAAA；明显不存在的域名不发验证码，错误文案为 `邮箱或域名不存在，请检查后重新输入`。
29. 登录验证码 6 个输入框圆角从 `16px` 改为 `12px`。
30. 默认头像增加 `1px` 稍深描边，颜色基于同一邮箱 hash 的 HSL 淡色生成；上传头像不加这圈默认描边。用户中心弹窗遮罩保留黑色半透明底，并给底层页面加 `backdrop-blur-[6px]` 模糊。
31. 工作台新对话空白页已改为参考图式的居中欢迎区。标题为 `hi~把你的闪念跟我聊一聊！`，下面固定三行快捷按钮，每行 `3-5` 个，行上下对齐、列可不齐。
32. 空白页快捷按钮池包含生图、生视频、故事梗概、分镜、提示词扩写、角色/场景创作等入口。按钮顺序和每行数量按当前会话 ID 打散，新建对话会变化。按钮为淡彩色随机底、无描边，按钮文字为内部 `span style={{ fontSize: 13 }}`。
33. 空白页快捷按钮点击后不再填入输入框，而是自动切换底部输入框到 `Agent 模式` 并直接发送该快捷请求。
34. `正在认真思考` 动画已放慢：文字走光从 `1.65s` 改为 `2.4s`，三点动画从 `0.95s` 改为 `1.45s`。
35. 本轮这些 UI/登录改动后多次运行 `npm run lint` 通过；邮箱域名校验加入后也运行过 `npm run build` 通过。

## 2026-05-20 本轮对话补充：左下角积分占位和后台管理第一版

本轮完成：

1. 用户中心头像上传按钮图标居中修复。`RiCameraLine` 原来带 `translate-x-px -translate-y-px`，导致按钮虽然 `flex items-center justify-center` 但视觉偏移；现已去掉偏移。
2. 工作台左下角用户区新增积分占位卡：第一行 `RiVipDiamondLine + 积分：1,500`，第二行为米色底 `RiVipCrown2Line + 个人免费版`。第二行图标和文字整体居中，图标 `18px`，文字 `12px` 写在内部 `span style`，避免全局 `button { font: inherit; }` 覆盖。
3. 左下角用户区整体高度已加高并多轮微调。当前底部模块 `min-h-[148px]`，内部 `flex flex-col justify-center`，积分卡和头像区作为整体上下居中；头像 hover 灰底高 `h-11`；积分卡宽度比侧栏内容少 `2px`，使用 `mx-[7px]`。
4. 左下角用户区分隔线向上移 `6px`，同时加不透明背景遮罩，避免历史列表文字从分隔线下方透出。底部用户模块为 `relative z-20`，背景遮罩覆盖 `top-[-6px]` 到底部，积分和头像内容为 `z-10`。
5. 左下角头像菜单改为在头像上方弹出，并允许压住积分块。最终定位：`bottom-[60px]`，水平 `left-[calc(50%-1px)]`。
6. 设置图标已统一从 `RiSettings3Line` 改为官方 `RiSettingsLine`，覆盖左下角用户菜单和用户中心左侧导航。
7. 新增独立后台页面 `/admin`，浏览器标题为 `闪念后台 Management`。后台登录页白底居中，标题为 Logo + `闪念后台`，Logo `30px`，标题下显示 `管理员白名单登录`。
8. 根目录新增后台启动入口 `start-admin.bat`，对应脚本 `scripts/start-admin.ps1`。启动后打开 `http://localhost:3000/admin`，复用端口 `3000` 和同一个 dev server。
9. 后台白名单使用环境变量 `ADMIN_EMAILS`，`.env.example` 已新增该项。用户指定的管理员邮箱已写入本地 `.env`，但 `.env` 不提交，不要公开展开真实敏感配置。
10. 后台登录已从共用前台登录 Cookie 改为独立后台 Cookie。前台仍用 `flashmuse-session`；后台使用 `flashmuse-admin-session`，`path: "/admin"`，有效期 8 小时。后台登录/退出不影响前台工作台登录状态。
11. 新增后台专用接口：`/api/admin/send-code`、`/api/admin/verify-code`、`/api/admin/login-password`、`/api/admin/logout`。后台支持密码登录和验证码登录，验证码登录适合管理员账号未设置密码的情况。后台接口会先检查邮箱是否在 `ADMIN_EMAILS` 白名单中。
12. 新增 `src/lib/admin.ts`，用于读取管理员白名单和默认美元人民币汇率 `7.2`；新增 `src/lib/admin-auth.ts`，用 HMAC 签名的 Cookie 保存后台登录态，不写入 `Session` 表。
13. 后台第一版内容已可用：概览真实显示总用户数、今日新增、总生成图片数、总生成视频数、用户积分余额；用户管理表真实读取最近 50 个 `User`；积分管理、生成记录、系统设置目前为占位。
14. 后台左侧栏底部显示当前管理员邮箱，并新增白底 `退出后台` 按钮。退出调用 `/api/admin/logout`，只清 `flashmuse-admin-session`。
15. Prisma 新增字段：`User.credits Int @default(1500)`、`User.disabled Boolean @default(false)`。迁移为 `20260520120000_admin_credits_fields`，已执行 `npx prisma migrate dev --name admin_credits_fields`。
16. 迁移后 Prisma Client 生成曾因 Windows `query_engine-windows.dll.node` 被 3000 端口 dev server 占用而失败；停掉端口 3000 的 Node 进程后 `npx prisma generate` 成功。
17. 当前后台未完成项：积分手动加减、积分流水表、生成记录表、生成成功扣积分、用户禁用拦截、后台设置可编辑、生成图片/视频计数自动累计。现在是可进入、可看真实用户数据的后台雏形。
18. 本轮验证：`npm run lint` 和 `npm run build` 均通过。

主要文件：

- `src/components/chat-workbench.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/admin-login-form.tsx`
- `src/app/admin/admin-logout-button.tsx`
- `src/app/api/admin/send-code/route.ts`
- `src/app/api/admin/verify-code/route.ts`
- `src/app/api/admin/login-password/route.ts`
- `src/app/api/admin/logout/route.ts`
- `src/lib/admin.ts`
- `src/lib/admin-auth.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260520120000_admin_credits_fields/migration.sql`
- `start-admin.bat`
- `scripts/start-admin.ps1`
- `.env.example`

## 2026-05-20 本轮对话补充：游客模式、登录历史、设置做实、预览页和 Agent 媒体体验

本轮完成：

1. 首页测试入口改名为 `游客模式`，链接为 `/workspace?guest=1`。工作台收到 `forceGuestMode` 后跳过登录态检查，强制读取浏览器 `localStorage` 游客数据；邮箱登录成功仍进入 `/workspace` 读取数据库用户工作区。上线只需隐藏/删除 `游客模式` 按钮。
2. 工作台加载兜底改安全：`/api/auth/me` 或数据库失败时优先读取游客 `localStorage`，不再直接写空会话覆盖旧数据。用户本机旧游客历史已被覆盖为空，当前无法从 `yinzao-sessions-v2` 恢复。
3. 首页 `游客模式` 和 `登录` 按钮高度、字号统一：按钮高 `h-9`，内部 `span` 字号 `13px`。
4. 首页登录抽屉新增最近登录邮箱下拉菜单。登录成功后写入 `localStorage` 的 `flashmuse-login-history-v1`，最多 5 条；点击邮箱输入框时弹出，竖排、最高 `250px`、超出滚动；点邮箱填入并收起，自己输入或点其它区域也收起。
5. 登录发送验证码文案区分来源。手动选择验证码登录时显示 `正在发送验证码...`；默认密码登录下系统判断首次登录或未设置密码时显示 `首次登录或未设置密码，正在发送验证码...`。
6. 图片生成失败卡兜底修复。多图并发时如果平台返回 500 或无图，所有剩余等待卡会在批次结束/总异常时变成失败卡，避免长期停在 `99%生成中`。红字错误继续保留真实原因。
7. `正在认真思考` 前置动画改成轻量 `GridLoader` 3x3 点阵，尺寸 `16px`，左侧历史运行中也复用；文字和后三个点改为灰白慢动画。已加 `prefers-reduced-motion` 静态降级。
8. Agent 正文内联 Markdown 兜底修复。列表小标题中出现 `**阿宁**：` 这类格式时，标签也会走 `renderInlineFormatting()`，不再露出 `**`。
9. Agent 自动生图/生视频结果会显示引导系统。媒体消息写入 `suggestions`，优先使用 Planner 返回值，没有则使用前端默认建议；专业模式媒体结果仍不显示引导。
10. 预览页缩略图导航统一按当前对话媒体总数判断。图片和视频总数超过 1 个就显示右侧缩略图导航，Agent 多图、多视频、专业多图和混合媒体都生效。
11. 用户中心 `图片/视频生成完成提醒` 做实，默认开启。任意会话生成图片/视频完成时，当前页面顶部绿色提醒 `图片生成已完成` / `视频生成已完成`；关闭后不显示；同一批任务只提醒一次。
12. 用户中心 `生成图片/视频自动收入资产管理库` 做实，默认开启。关闭后生成图片/视频不会自动入资产库，但文件仍保留，对话流仍正常显示。内部沿用 `autoSaveHistory` 字段。
13. 设置页移除 `本地缓存` 占位。用户生成文件、对话流和资产都属于用户数据，不应自动清理。
14. 设置页新增 `预览页鼠标放在图片上滚轮有缩放功能` 和 `预览页鼠标放在缩略图区域滚轮有翻页功能`，默认都开启，互不排斥。主预览区滚轮缩放图片；缩略图区域滚轮翻页；视频主预览区不缩放，缩略图区可翻页。
15. 新增 Prisma 字段 `previewWheelZoom / previewWheelFlip` 并执行迁移 `20260520074200_preview_wheel_settings`、`20260520081205_preview_wheel_zoom_default_on`。`npx prisma generate` 遇到 Windows DLL 占用时，停掉 3000 端口 Node 进程后重试。
16. 设置页图标改用官方 `react-icons/ri` 导出：`RiNotification2Line`、`RiZoomInLine`、`RiArrowUpDownLine`。不要再用本轮曾临时写的本地 SVG。
17. 本轮多次验证：`npm run lint` 和 `npm run build` 均通过。

主要文件：

- `src/app/page.tsx`
- `src/components/chat-workbench.tsx`
- `src/app/globals.css`
- `src/lib/user-profile.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260520074200_preview_wheel_settings/migration.sql`
- `prisma/migrations/20260520081205_preview_wheel_zoom_default_on/migration.sql`

## 2026-05-18 本轮对话补充：首页登录抽屉和工作台用户区

本轮完成：

1. 首页顶部简化：移除顶部中间导航、说明文案、首页小标签和首页 CTA；右上角新增临时白色按钮 `进入工作台`，跳转 `/workspace`，旁边保留 `登录`。
2. 首页广告语和输入框重排：广告语改为中文 `方寸之间 · 大有可为`，英文 `Small Space Big Ideas`；整体和输入框一起居中。中文字号 `100px`，透明度 `0.9`，字体栈为现代中文无衬线；英文使用微软雅黑体系。
3. 首页简化输入框已加：展示版，不接真实生成。宽度 `700px`，圆角 `16px`，placeholder `灵感一闪，创意即生...`，右侧黑色发送按钮使用工作台同款形态。玻璃底使用内联 style 控制；若后续要更强毛玻璃，应加额外伪层/绝对定位模糊底，而不是只加 `backdrop-filter`。
4. 首页 Logo 继续修：图形 Logo `50x50`；首页文字 Logo 高度 `30px` 并强制反白；工作台文字 Logo 高度 `26px`。标签页图标已用当前 Logo 重新生成 `src/app/favicon.ico`，并新增 `src/app/icon.png`。
5. 首页右侧登录抽屉已替换原黑色居中弹窗。打开时白色面板从右侧滑入，底层视频和页面内容向左推并模糊；关闭时恢复。
6. 登录抽屉内容精简：顶部关闭按钮为 CSS 细线 X，hover 旋转；中部为横排 Logo；下面是 `密码登录 / 验证码登录` 无底按钮，中间竖线；再下面只保留邮箱输入框。底部协议提示为 `登录即代表同意《用户协议》和《隐私政策》`。
7. 登录邮箱输入框高 `64px`，最大宽 `380px`，灰底；hover 边框淡蓝，focus 边框项目通用蓝 `#367cee`，底色不变。
8. 工作台左侧栏底部新增用户占位区。上方分隔线需要顶到侧栏两端，因父级 `aside` 有 `px-3`，分隔线用绝对定位 `left: -12px; right: -12px` 抵消内边距。用户区高度约 `64px`，显示圆形头像占位、`用户头像` 和 `user@example.com`。
9. 工作台用户菜单已完成占位：点击用户区弹出，点其它空白关闭，点菜单内部不关闭。菜单宽 `222px`，居中弹出；包含 `用户信息 / 用户安全 / 设置 / 退出登录`，都有前置图标。前三项高 `44px`，hover 是内缩圆角灰框；`退出登录` 是底部整块浅灰，高 `56px`。
10. `next.config.ts` 已配置 `devIndicators.position: "bottom-right"`，把 Next dev 黑色 `N` 从左下移到右下。改这个配置需要重启开发服务器才生效。
11. 本轮多次遇到样式没变化，原因主要是 Tailwind 任意值 class 未实际生成或全局 `button { font: inherit; }` 覆盖按钮字号。后续精细 UI 调整应先检查实际 DOM/CSS，必要时用内联 style 或把字号写到按钮内部 `span`。

## 2026-05-18 本轮对话补充：输入框、Agent、品牌和 Logo

本轮完成：

1. Agent 回复排版规则调整。后端仍可让 Agent 使用有限内部标记，但前端会把 `# / ## / ### / ** / --- / -` 渲染成网页标题、加粗、分隔线和列表，不应把 Markdown 符号直接露给用户。
2. Agent 长回复打字时不再持续滚到底。此前每个打字机 tick 都会 `scrollIntoView`，现在 Agent 文字回复只在消息出现时定位，长回复增长时用户保持当前位置。
3. 输入框空值识别修复。浏览器在空 `contenteditable` 里自动插入的 `<br>` 不再被当成真实换行，删除最后一个字后会恢复 placeholder。
4. 输入框光标乱跳修复。普通输入和删除不再每次 `replaceChildren()` 重建 DOM，粘贴文本、`Shift+Enter` 和超长截断等需要代码接管的场景才同步 DOM。
5. 粘贴截图/图片修复。图片粘贴时会阻止浏览器默认插入图片节点，图片只进入输入框上方参考图缩略图，不再在文字区域出现破图图标。
6. 输入框内部滚动修复。长文本中用户回到前面或中间插字时，不再被强制拉到底部；只有光标位于文本末尾时才自动滚到底。
7. Agent 图片 prompt 默认禁令已移除。执行层不再默认给每张图追加“禁止拼图、合集、九宫格...”这类负向词；只有用户明确要求不要拼图或纠错时才加短约束。
8. Agent “合并到一张”识别已收窄。只有用户原话明确要求合并/同一画面/放在一张图上时，才强制单张；Planner 自己写“展示图”不会再把“七张”误改成一张。
9. Agent 自动生图数量已修复。模型一次请求返回多候选图时，Agent 只取第一张，避免目标 6 张却显示 12 张；专业图片模式仍保留多候选图逻辑。
10. 明确部署后参考图 URL 方案。正式部署服务器后，要把本地上传图、资产图、历史参考图改为公网 HTTPS URL，Planner 才能在用户说“红框里的样子/参考这张”时稳定看图；单纯部署代码不自动解决，必须做对象存储/CDN 链路。
11. 品牌名补齐为中文 `闪念`、英文 `FlashMuse`。浏览器标题为 `闪念 FlashMuse`，OpenRouter `X-Title` 为 `FlashMuse`，包名为 `flashmuse`，内部 `yinzao-*` key/CSS 保留。
12. Logo 接入更新。首页和工作台左上角直接用普通 `<img src="/home-assets/logo.png">`，避免 `next/image` 同名文件缓存。图形 logo 显示尺寸为 `50x50`。
13. Logo 素材处理。`public/home-assets/logo.png` 为当前使用图；`logo-original.png` 是原白底备份；`logo-transparent-1024*.png` 是工具抠透明测试；`public/home-assets/text/` 下保存了 4 个图片模型生成的 logo 候选和 `summary.json`。
14. 从 `AI-Video-Assistant_Project Planning\Brand&logo Design\生成图片2.jpg` 提取中文“闪念”文字为 `public/home-assets/logo-text.png`。首页将其转白显示，工作台黑色显示；工作台副标题 `AI影片助手` 位于文字图下方一行。
15. 本轮验证：多次 `npm run lint` 均通过。

## 2026-05-15 本轮对话补充：资产管理上传、分批加载和提醒消息统一

本轮完成：

1. 资产管理页新增直接上传图片功能。入口位于资产管理内容标题右侧，不在顶部标题栏；按钮为蓝色无底样式，图标使用 Remix `upload-2-line`，文案为 `上传图片`。
2. 上传弹窗支持最多 `8` 张图片。弹窗内只保留一个 `80x80` 上传按钮，初始在第一个位置；用户选择图片后该位置变为图片缩略图，上传按钮自动移动到下一个位置。支持一次多选，多选超过上限时提醒 `最多同时上传8张`。
3. 上传缩略图为 `80x80` 直角，图片完整显示不裁切；右上角删除按钮为圆形；底部增加黑色渐变并显示真实图片尺寸。尺寸在前端读取本地 data URL 的 `naturalWidth / naturalHeight`。
4. 上传弹窗下方显示当前选中图片的文件名和分类。文件名标签为 `文件名(支持改名)`，输入框右侧有灰底 `X` 可清空当前文件名。清空后如果不重新输入，失焦或点到其它图片时会恢复原文件名；上传时也会用原文件名兜底。
5. 分类滑块支持 `角色图片 / 场景图片 / 分镜图片`。上传成功后资产写入 `yinzao-assets-v1`，保存 `type / name / url / sourcePrompt / sessionId / lockedType / createdAt`，其中 `lockedType: true` 防止后续自动分类覆盖。
6. 上传逻辑复用 `/api/upload-image` 和 `saveUploadedImageAsset()`，图片保存到 `public/generated/upload_image`，服务端按图片内容 hash 去重。资产库前端继续按 URL 去重，已存在的同图不重复添加。
7. 重复图片处理已细化。全部重复时弹窗不关闭，重复图缩略图保留并显示红色边框，提醒 `图片已存在，无需要重复添加`。新图和重复图混合时，新图正常入库并从弹窗消失，弹窗只保留重复图红框。
8. 成功上传时显示绿色提醒 `成功上传X张图片`，成功图标使用 `checkbox-circle-line`，成功底色为 `#75d06a`。如果全部上传成功，弹窗立即关闭，成功提醒显示在页面上方；如果混合重复，弹窗不关闭，先显示成功提醒，再显示重复提醒。
9. 项目内自动消失的提示统一命名为“提醒消息”，当前已统一输入框提醒和上传相关提醒。提醒消息高度统一 `40px`；普通黑底，成功绿底；出现动画 `0.1秒` 从上往下，停留 `2秒`，消失动画 `0.1秒` 从下往上；相同文案显示期间不重复入队，不同文案按顺序排队。
10. 资产管理列表已改成分批渲染。初始只渲染约 `30` 个资产，滚动接近底部再追加 `30` 个；进入资产管理或切换资产分类时，右侧滚动层自动回到顶部并重置加载数量，避免资产多时卡顿和首次定位到中间。
11. 本轮曾出现浏览器左下角 Next `N` 长时间停在 `Compiling...`。排查后 `npm run lint` 和 `npm run build` 均通过，判断为 Next dev 进程 / `.next` 缓存卡住。已停止旧端口 `3000` Node 进程、清理 `.next` 并重新启动 dev server。
12. 本轮涉及文件主要为 `src/components/chat-workbench.tsx`、`src/app/globals.css` 和多个 `handover/*.md`。本轮验证：`npm run lint` 通过，`npm run build` 通过；曾遇到 `.next/dev/types/routes.d.ts` 缓存错误，清 `.next` 后通过。

## 2026-05-15 本轮对话补充：输入框、@资产、Agent 图标和费用估算

本轮完成：

1. 修复 `contenteditable` 输入框对拼音输入法不兼容的问题。新增 composition 保护，拼音组合期间不重绘 DOM；结束后再同步文本和 `@` 高亮。输入框同时加 `translate="no"`、`spellCheck={false}`、`autoCorrect="off"`、`autoCapitalize="off"` 和 Grammarly 禁用属性。
2. `@` 资产弹窗新增 `待分类`，只显示待分类图片；视频资产仍不显示、不能引用。分类按钮改成 `角色图片(29)` 格式，每个分类全部显示，不再只显示 8 张；弹窗加宽到 `380px` 并强制按钮不换行。
3. 当没有任何可引用图片时，用户输入 `@` 或点击两个 `@` 入口，会在输入框上方黑框提示 `当前资产库没有图片`。
4. 输入框参考图上限从 `5` 张改为 `10` 张；超限文案统一为 `@或上传最多支持10张图片`。此改动只放宽产品侧上限，不改 URL 上传或模型筛图规则。
5. 输入框上方缩略图中，`@资产` 图显示为 `60x60`，普通上传图继续 `100x100`。
6. 输入框新增透明无底的 `清空输入框` 按钮，带 `format-clear` 图标和 `清空输入框` 文案。点击清空草稿、上传图、`@资产` 参考图和已打开输入弹窗。
7. `正在认真思考` 时，输入框内容区和左侧工具按钮淡化成无效状态；停止按钮保持黑色不淡化并可点击。专业模式模型/参数按钮也补了思考中禁用。
8. `Shift+Enter` 换行已修复为真实多行。换行使用 `<br>` 渲染，读取文本和光标计算都识别 `<br>`；末尾空行用 `data-trailing-break` 视觉占位。
9. Agent 前置图标与输入框 Agent 模式图标都改为 Remix `ri-ai`。因 `react-icons/ri` 没导出 `RiAi`，项目本地新增 `RiAiIcon`，使用用户给的 SVG。Agent 回复图标改为插入首行文本流，兼容普通段落、标题、列表、提示块和媒体说明对齐。
10. 估算 Seedance 2.0 生成 100 分钟视频费用：按 OpenRouter 当前 `$7/M video tokens` 和公式 `宽 × 高 × 秒数 × 24 / 1024`，`1280x720 / 100分钟` 约 `$907.20`，按汇率 `7.2` 约 `¥6532`；`Seedance 2.0 Fast` 同规格约 `¥5225`。
11. 安全检查确认 `handover/` 中没有明文 GitHub 密码、token 或 OpenRouter key；但规划目录 README 有压缩包密码说明。`AI-Video-Assistant_Project Planning/` 当前未跟踪，不要直接上传。
12. GitHub 状态：`cd89681` 和 `5d9aae4` 已推送；本节记录的大部分后续输入框/图标/文档改动仍是本地改动，尚未推送。
13. 本轮验证：相关改动后多次 `npm run lint` 和 `npm run build` 均通过。

## 2026-05-15 本轮对话补充：Agent 多视频、停止思考和失败原地重试

本轮完成：

1. 用户反馈 Agent 把 10 个镜头做成视频时只生成了 1 个视频。排查确认旧数据结构只有单个 `videoUrl?: string`，执行器视频分支也只创建一次 `/api/video`，所以本质是批量视频未实现。
2. Agent 视频已支持批量生成。Planner `items[]` 对视频生效，一镜一段视频；如果 Planner 只给 `count > 1` 没给 items，前端按 count 兜底生成多段视频。
3. 视频消息结构新增/使用 `videos[]`、`videoPrompts`、`videoDimensionsMap`、`pendingVideoCount`、`failedVideoCount`、`generationMeta.itemPrompts` 等字段，支持一条 assistant 消息里同时显示多个视频、等待卡和失败卡。
4. Agent 分镜视频时长规则已加入 Planner 提示词和 `AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md`：分镜/镜头视频按镜头内容和动作复杂度决定时长，只有普通单段视频才默认最低时长。
5. Agent 视频显示已改为同一两列 grid：成功视频、等待卡、失败卡混排；一行 2 个，超过换行；统一高度 `360px`、圆角 `10px`、间距 `2px`。单个视频保持左半宽。
6. 视频失败卡的重新生成已改为原地重试。点击失败卡后不再 append 新 assistant 消息，而是更新原消息的 `requestId`、pending/failed 计数，失败格子原地变等待卡，成功后填回原 grid。
7. 图片多图结果本来已在 `ImageResultStrip` 中将成功图、等待卡、失败卡混排；本轮只同步了失败卡按钮样式。
8. 失败卡“重新生成”按钮改为居中灰色空心按钮，前置 `reset-left-line` 图标。图片和视频失败卡保持一致。
9. 曾临时加 `/api/video-recovery` 自动扫描本地 `public/generated/videos` 以恢复未归档视频，但用户重启后误恢复了早期测试视频。该自动恢复功能已删除，后续不要自动把本地视频塞进对话流。`src/lib/video-manifest.ts` 保留为视频任务 manifest 记录能力。
10. `src/app/api/video/route.ts` 在创建/查询视频任务时写入 video manifest：`taskId / prompt / model / settings / localVideoUrl / remoteVideoUrl / createdAt / updatedAt`。当前 manifest 只用于记录，不做自动恢复。
11. `saveSessions()` 已修正：如果 `localStorage.setItem` 失败，不再删除 `yinzao-sessions-v2`，只保留上一次成功保存的历史并输出 warning。
12. 输入框发送按钮改为正方形图标按钮：普通状态是 `arrow-up-line`；Agent 思考中是黑色 `stop-fill`，带走光，可点击中断 Agent 思考。
13. 点击停止会 abort 当前 Agent 请求，移除 Agent pending，并追加系统消息 `已中断思考`。非红字系统消息顶部显示灰色横线，红字错误系统消息不加。
14. 修复部分 Next dev 红色 `N` 中的 `next/image` 尺寸 warning：给若干 `h-full w-full object-cover` 的 `<Image>` 补 `style={{ width: "100%", height: "100%" }}`。
15. 本轮中途已推送 GitHub：`89723bf Update agent media generation flow`。注意：该提交之后又继续做了停止按钮、视频 grid、失败原地重试和本文档更新，下一次同步 GitHub 需要再提交。
16. 本轮验证：多次 `npm run lint` 和 `npm run build` 均通过。

## 2026-05-14 本轮对话补充：Agent Planner、模型调用规则、错误中文化

本轮完成：

1. 用户确认 `AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md` 是后续优先规则文档。以后用户要求先看文档时，AI 必须先读该文件，对照当前实现列出更新点，再等用户决定是否修改。
2. 新增 Agent Planner：`src/app/api/agent-plan/route.ts` 调用 `src/lib/openrouter.ts` 的 `planAgentTask`。Planner 返回结构化执行计划，而不是靠硬规则直接执行。
3. Planner 字段包括：`intent`、`needsClarification`、`clarifyQuestion`、`displayText`、`count`、`subject`、`quality`、`ratio`、`resolution`、`duration`、`prompt`、`constraints`、`items`、`suggestions`。
4. Planner 原则：能从上下文和默认规则推断就不追问；只有目标不清、图片/视频都可能、缺失信息会明显导致错、用户要求冲突或成本规格明显过高时才追问。
5. Agent 不再使用本地问候直回。所有 Agent 输入都会进入 pending 队列并显示 `正在认真思考`，最少显示 `2000ms`。
6. `正在认真思考` 文案和后面三个点已加明显走光/跳动动画；该思考状态写入 `pendingRequests`，刷新浏览器后会恢复并继续执行。
7. Agent 自动生图/生视频显示规则已改：左侧只显示 Planner 的简短执行说明 + 媒体结果，不重复用户原话，不显示专业模式的模型/比例/尺寸参数行。
8. Agent 生图一行 4 个，超过 4 个换行显示，不分页；Agent 媒体等待卡、失败卡和结果底框使用 `10px` 圆角。
9. Agent 媒体失败卡内新增“重新生成”按钮，点击后用同一段提示词重新申请该失败项。
10. Agent 图片数量识别支持中文数字，如 `一张 / 七张 / 十张`。Planner 会把“生成数量”和“单张图片内容”分开，避免“七张美女图”被模型理解成一张合集图。
11. Agent 模型调用规则已调整：普通 Agent 固定图片 `Seedream 4.5`、视频 `Seedance 2.0 Fast`；高级 Agent 默认优先当前专业模式选中模型，不因用户说“高品质/高清/精细”立即切贵模型。
12. 高级 Agent 只有用户多次不满意才升质量，用户多次抱怨慢才换快稳；总体优先便宜。`Veo 3.1` 只在用户明确要求 4K 视频输出规格时调用。
13. 规则文档中已加入模型排序表，并按用户要求改成定宽 Markdown 表格，避免在编辑器中列不对齐。
14. Agent Planner 阶段不再携带 base64 参考图，只传文字和“本轮带了几张参考图”的提示，避免请求体过大导致 413；真正生成阶段仍使用参考图。
15. 新增统一错误清洗 `src/lib/error-message.ts`。前端红字错误和主要 API catch 都使用 `toUserErrorMessage`，避免 HTML、代码、堆栈直接展示。
16. 常见错误中文化：请求体太大、API Key 无效、地区不可用、频率/额度限制、平台 500、敏感/真人隐私图、参数不支持、无 endpoint 等。
17. 系统提示和错误系统提示图标已改为与第一行文字顶部对齐。
18. 本轮继续更新：Agent 多图生成已支持 `items[]`。每张图片用自己的独立 prompt 请求，真实 prompt 按 URL 保存到 `message.imagePrompts`，预览页和 Agent 媒体提示词条都优先显示单图真实 prompt。
19. 本轮继续更新：Agent 自动媒体结果新增淡灰色提示词折叠条，放在 Agent 文案下方、图片/视频上方。点击展开后同一灰色面板内显示完整提示词，最高约 `180px`，超出滚动；多图不同 prompt 时显示 `<1/5>` 分页和“使用提示词”。
20. 本轮继续更新：Agent 展示文案自然化，默认不再说“单张独立、不做拼图或合集”；这些只作为内部执行约束。只有用户明确提到不要拼图/合集或纠错时才显示相关说明。
21. 本轮继续更新：Agent 已增加“只要场景不要人物”硬规则。Planner 和执行层都会清理人物词并追加无人物约束，避免用户明确要场景时仍生成带人物的画面。
22. 本轮继续更新：Agent 文本回复上下文已瘦身，历史图片不再默认带入 `/api/chat`；只在本轮明确参考图时保留最新用户图片。若仍触发 413，会自动纯文本重试。
23. 本轮继续更新：用户可见错误提示去掉 `OpenRouter` 字样，统一为平台/请求/图片生成/视频任务等通用表述。
24. 本轮涉及文件主要为：`src/components/chat-workbench.tsx`、`src/lib/openrouter.ts`、`src/lib/openrouter-video.ts`、`src/lib/error-message.ts`、`src/app/api/video/route.ts`、多个 `handover/*.md`、`AI-Video-Assistant_Project Planning\对话流三种模式基础规则.md`。
25. 本轮验证：`npm run lint` 通过，`npm run build` 通过。

## 2026-05-13 本轮对话补充：品牌更名、用量统计扩展和浮窗微调

本轮完成：

1. 2026-05-18 用户确认平台中文名为 `闪念`，英文名为 `FlashMuse`。
2. 页面左侧品牌名已改为 `闪念`。
3. 浏览器标题已改为 `闪念 FlashMuse`。
4. OpenRouter 请求头 `X-Title` 已改为 `FlashMuse`，涉及文本/图片和视频接口。
5. Agent 系统提示、Planner 和意图分类器提示词里的自称已改为 `闪念`。
6. 为避免本地数据丢失，`localStorage` key 里的 `yinzao-*` 暂不改；CSS class/keyframes 里的 `yinzao-*` 也暂不改。
7. 右上角用量浮窗已压缩底框、内边距和行距；顶部新增灰色小标题 `使用量`，标题字号为 `11px`。
8. 人民币显示从 `约 ¥0.00` 改为 `¥0.00 约`，计算逻辑不变，汇率仍固定 `7.2`。
9. 当前会话用量统计已扩展到图片和视频。`/api/image` 会透传并累加 OpenRouter 图片响应中的 `usage`；`/api/video` 会提取视频任务创建/查询响应中的 `usage.cost`。
10. 图片实测确认会返回 Token 和费用：本轮测试 `Seedream 4.5 / 1:1 / 2K / 1张` 返回 `promptTokens: 4`、`completionTokens: 16384`、`totalTokens: 16388`、`usd: 0.04`。
11. 视频实测确认通常只返回费用不返回 Token：查询已有任务 `P14NkUI1MIBIgF3op7KG` 返回 `usd: 0.84`，Token 均为 `0`。
12. 代码涉及：`src/lib/openrouter.ts`、`src/app/api/video/route.ts`、`src/components/chat-workbench.tsx`、`src/lib/openrouter-video.ts`、`src/app/layout.tsx`、`handover/00-README.md`、`handover/CHANGELOG.md`、`handover/03-progress-and-status.md`。
13. 本轮验证：`npm run lint` 通过，`npm run build` 通过。

## 2026-05-13 Agent、预览页、费用统计和输入禁用更新

本轮完成：

1. Agent `/api/chat` 和 `/api/intent` 增加 OpenRouter `curl` 兜底。`fetch` 非 2xx 时会用同请求体通过 `curl.exe` 重试，解决本机实测的偶发 `Internal Server Error`。
2. Agent 请求失败不再渲染成带反馈按钮的 assistant 消息，而是作为系统消息显示。错误系统消息用红字和 `RiErrorWarningLine` 图标，只展示错误文本。
3. Agent 工具栏新增 `普通 / 高级` 滑块。普通模型为 `bytedance-seed/seed-2.0-lite`，高级模型为 `openai/gpt-5.4`。该设置保存到本地输入设置，Agent 对话、意图识别和 Agent 重新生成都会使用当前档位。
4. 切换普通/高级会在对话流插入灰色系统消息：`当前已切换至普通模式` 或 `当前已切换至高级模式`。
5. 文案更新：思考提示改为 `正在认真思考`；反馈区末尾改为 `感谢反馈`；空会话标题改为 `今天你有什么想做的？`。
6. 正在认真思考期间，当前输入框禁用：不能输入、粘贴、上传、点 `@`、切模式、切普通/高级或发送，输入弹窗会自动关闭。
7. 顶部标题栏右侧新增当前会话用量统计图标。hover 黑底白字显示 Token、美元、人民币估算，人民币固定按 `7.2` 汇率。后续本轮对话已扩展到图片/视频 usage，详见上方“本轮对话补充”。
8. 预览页视频下载按钮恢复。图片和视频预览右上角都有下载按钮，文件名会自动补后缀。
9. 图片预览缩放逻辑改为用原生 `<img>` 和真实像素计算，避免 `next/image` 的 `width=2000` 影响实际尺寸。实际尺寸目标为真实像素 100%，适合尺寸目标为随预览容器变化实时适配。用户最后仍反馈适合尺寸视觉未达预期，后续需继续修。
10. 预览页右侧缩略图自动定位修复：打开预览时先按 `id` 找当前缩略图，找不到则按 URL 找。
11. 用户反馈输入框内中文正在输入时突然变英文。代码未发现自动翻译逻辑，判断更可能是浏览器翻译、翻译插件或输入法 AI 对 `contenteditable` 做了替换。建议后续给输入框加禁翻译/禁拼写改写属性。
12. 本轮中途已推送 GitHub 提交 `5855bc4 Update media workspace interactions`。该提交之后又继续做了缩略图定位、费用统计、思考中禁用和文档更新，后续如需同步需再提交。
13. 本轮验证：`npm run lint` 和 `npm run build` 通过。

## 2026-05-13 视频生成请求最终规则和实测尺寸显示规则

本轮完成：

1. 用户要求按当前 UI 中所有视频模型、分辨率和比例，并发全量测试，统一使用最低时长，不测智能比例。
2. `scripts/test-video-models.mjs` 已覆盖当前 6 个视频模型共 `49` 组，结果输出到 `AI-Video-Assistant_Project Planning\test\video-model-test-results.md` 和 `video-model-test-raw.json`。
3. 全量测试结果：`45/49` 成功，`4` 个失败全部是 Seedance 系列 `9:21`，上游返回比例参数不合法。因此项目已移除所有视频 `9:21` 支持项。
4. 实测尺寸已写入 `src/lib/models.ts` 的 `videoModelRules.sizes`，这些是 UI 和兜底显示用尺寸，不再作为请求尺寸。
5. 非标尺寸标记写入 `videoModelRules.nonStandardSizes`，设置弹窗显示 `尺寸（非标）`，对话流和预览页尺寸后显示 `（非标）`。
6. 单独测试 `Seedance 2.0 Fast` 只传 `resolution + aspect_ratio`、不传 `size`，输出尺寸与此前传 `size` 的实测尺寸一致。
7. 新增 `scripts/test-video-models-no-size.mjs`，继续测试其它 5 个模型所有 UI 支持组合，不传 `size`，共 `33/33` 成功，尺寸全部与上一轮实测一致。
8. 最终视频创建请求已改为不传 `size`。当前 `src/lib/openrouter-video.ts` 只传 `resolution`、`aspect_ratio`、`duration`、`generate_audio` 和可选 `input_references`。
9. `src/lib/models.ts` 已删除 `requestSizes / requestSize`，避免后续误把非标显示尺寸作为请求尺寸。
10. `Kling Video O1` 官方元数据只标 `720p`，但实测输出为 `1920x1080 / 1440x1440 / 1080x1920`，所以项目 UI 中该模型分辨率显示为 `全高清1080p`。
11. 图片和视频画面设置弹窗宽度统一为 `420px`；视频比例和分辨率按钮仍保持单行。
12. 图片模型 `GPT-5.4 Image 2` 和视频模型 `Seedance 2.0` 菜单文字改为金色，选中后工具栏模型名也同步金色。
13. 提示词区 `使用提示词` 按钮显示逻辑修复：按钮可见时不再同时显示 hover 完整浮层；只有按钮被截掉时才触发展开。
14. Word 文档已更新到规划文件夹：`视频模型测试结果表.docx`、`图片模型尺寸测试表.docx`、`openrouter 视频模型支持比例和分辨率.docx`，表格均为只有横线的样式。
15. 本轮验证：`npm run lint` 通过且无 warning，`npm run build` 通过。

当前视频请求规则必须记住：

- 不传 `size`。
- 传 `resolution + aspect_ratio`。
- UI 显示用 `models.ts` 中的实测输出尺寸。
- 非标输出只显示 `（非标）`，不要作为请求参数。

当前项目视频 UI 支持项：

| 模型 | UI 分辨率 | UI 比例 |
|---|---|---|
| Seedance 2.0 Fast | `480p / 720p` | `21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16` |
| Seedance 2.0 | `480p / 720p / 1080p` | `21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16` |
| Kling v3.0 Standard | `720p` | `16:9 / 1:1 / 9:16` |
| Kling v3.0 Pro | `720p` | `16:9 / 1:1 / 9:16` |
| Kling Video O1 | `1080p` | `16:9 / 1:1 / 9:16` |
| Veo 3.1 | `720p / 1080p / 4K` | `16:9 / 9:16` |

## 2026-05-12 视频模型尺寸和参数规则更新

注意：本节是 2026-05-12 当时记录，已被上方 2026-05-13 最新规则修正。当前视频请求最终规则是不传 `size`，只传 `resolution + aspect_ratio`；视频 `9:21` 已从项目 UI 移除。

本轮完成：

1. 新增 `scripts/test-video-models.mjs`，用于并发测试 OpenRouter 视频模型，输出视频文件和结果表到 `AI-Video-Assistant_Project Planning\test`。
2. 已输出 `video-model-test-results.md`，并把测试样片按 `模型名_比例_720p/1080p.mp4` 命名保存。
3. 本轮测试覆盖过 `16:9 / 9:16 / 1:1 / 21:9 / 3:4 / 4:3`、`720p / 1080p`，后续又按官方能力表修正。
4. 测试结论：之前大量失败主要不是字段名完全错误，而是模型官方能力限制：Kling 系列只支持 `16:9 / 9:16 / 1:1`，Veo 只支持 `16:9 / 9:16`，Seedance Fast 不支持 `1080p`。
5. 已查 OpenRouter `openapi.json`：视频生成请求支持 `size` 字段，定义为 `WIDTHxHEIGHT` 精确尺寸，且可与 `resolution + aspect_ratio` 互换。
6. 已查 OpenRouter `/api/v1/videos/models`：当前视频能力表已写入 `src/lib/models.ts` 的 `videoModelRules`。
7. 视频生成后端 `src/lib/openrouter-video.ts` 已改为传 `size`，不再传 `resolution + aspect_ratio`。
8. `Sora 2 Pro` 已从视频模型列表移除；当前保留 Seedance 2.0 Fast、Seedance 2.0、Kling v3.0 Standard、Kling v3.0 Pro、Kling Video O1、Veo 3.1。
9. 前端视频模式会根据当前模型动态显示支持的比例和分辨率，切换模型或分辨率时会自动回落到支持项。
10. 视频“智能比例”保留，固定执行 `16:9 / 1280x720`，也就是传 `size: "1280x720"`。
11. 视频画面设置弹窗要求：比例区永远单行显示，顺序为 `智能比例 -> 21:9 -> 16:9 -> 4:3 -> 1:1 -> 3:4 -> 9:16 -> 9:21`，只显示当前模型支持项。
12. 视频分辨率文案和图标：`标清480p / 高清720p / 全高清1080p / 4K`，图标统一黑底白字 `SD / HD / FHD / 4K`。
13. 视频对话流和预览页参数显示修正为：有真实 metadata 时显示真实比例、真实尺寸和对应图标；未读到 metadata 时显示本次实际请求的官方 `size`。
14. 本轮验证：`npm run lint` 通过但仍有旧 warning：`scripts/create-image-size-docx.mjs` 的 `existsSync` 未使用；`npm run build` 通过。

官方能力表摘要：

| 模型 | 支持分辨率 | 支持比例 | 精确尺寸规则 |
|---|---|---|---|
| Seedance 2.0 Fast | `480p / 720p` | `1:1 / 3:4 / 9:16 / 4:3 / 16:9 / 21:9 / 9:21` | 480p 和 720p 官方尺寸 |
| Seedance 2.0 | `480p / 720p / 1080p` | 同 Fast | Fast 全部尺寸 + `1080x1080 / 1080x1440 / 1080x1920 / 1440x1080 / 1920x1080 / 2520x1080` |
| Kling v3.0 Standard | `720p` | `16:9 / 9:16 / 1:1` | `1280x720 / 720x1280 / 720x720` |
| Kling v3.0 Pro | `720p` | `16:9 / 9:16 / 1:1` | `1280x720 / 720x1280 / 720x720` |
| Kling Video O1 | `720p` | `16:9 / 9:16 / 1:1` | `1280x720 / 720x1280 / 720x720` |
| Veo 3.1 | `720p / 1080p / 4K` | `16:9 / 9:16` | `1280x720 / 720x1280 / 1920x1080 / 1080x1920 / 3840x2160 / 2160x3840` |

优先级最高：

1. 继续完善 Agent 多轮创作执行流：故事概念 -> 扩展故事 -> 文字分镜 -> 角色 / 场景图 -> 图片分镜 -> 视频
2. 继续完善图片 / 视频模式：按模型细化比例、分辨率、参考图和音频支持，优化错误提示、失败重试和成本控制
3. 实测 OpenRouter 视频生成完整成功链路，并继续完善视频参数和模型选择
4. 增加并发生成的队列、限流、失败重试和错误提示优化
5. 服务端数据库持久化和登录后的用户资产库
6. 完善反馈系统：不喜欢 / 回答不对 / 模式错了弹窗收集原因，反馈日志查看页，自动总结反馈规则
7. 后续可接 AI 看图分类 / 识别，让动物植物和复杂场景命名不只依赖提示词
8. 后续如更换 OpenRouter key、地区或部署环境，需要重新实测 Google / GPT 图片模型是否可用

第二优先级：

1. UI 继续细抠到更接近 ChatGPT 风格参考页
2. 会话删除和重命名继续细化
3. 工作流模式占位改成功能页

第三优先级：

1. 登录系统
2. 正式部署
3. AI 看图分类和用户手动分类修正规则学习

## 服务器部署和启动性能记录

2026-05-12 记录：

1. 用户反馈本地项目每次重启后第一次打开很慢。
2. 当前判断：主要是本地 `npm run dev` 开发模式冷启动导致，包括 Next.js 开发服务器启动、首次访问即时编译、`.next/dev` 缓存生成、Windows 文件扫描 / 杀毒影响，以及当前 `src/components/chat-workbench.tsx` 体积较大。
3. 这不等于正式部署后网页也会同样慢。线上应使用 `npm run build` + `npm run start` 或平台预构建部署，不应使用 `npm run dev`。
4. 生产模式会提前编译页面、路由和 API，用户访问时不需要像本地 dev 一样临时编译，首屏通常会快很多。
5. 如果使用 Serverless 平台，API 可能有冷启动；如果使用常驻 Node 进程，冷启动影响会小很多。
6. 图片 / 视频生成慢主要来自 OpenRouter / 模型排队，不属于网页首屏加载慢。
7. 服务器部署前建议优化：拆分 `chat-workbench.tsx`，减少首页首包；将媒体预览、资产管理、输入框、生成结果等逻辑组件化；能延迟加载的模块尽量延迟加载。
8. 服务器部署前还应规划：生成文件 `public/generated` 的持久化方案、对象存储 / CDN、API 超时、任务队列、失败重试、并发限流、日志监控和环境变量管理。

## 当前测试方式

推荐启动方式：

- 双击 `start-project.bat`
- 当前项目目录为 `E:\project\AI-Video-Assistant`

如果改了这些内容，建议重启项目再测：

1. `.env.local`
2. `api` 路由
3. 服务端逻辑

如果只是改页面样式，通常刷新即可。
