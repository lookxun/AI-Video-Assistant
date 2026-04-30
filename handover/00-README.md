# Yinzao Handover

这个文件夹用于给下一个接手的 AI 或开发者快速接手项目。

建议阅读顺序：

1. `01-project-summary.md`
2. `02-product-decisions.md`
3. `03-progress-and-status.md`
4. `04-keys-and-integrations.md`
5. `05-chat-history-highlights.md`
6. `CHANGELOG.md`

当前项目目录：`E:\project\AI-Video-Assistant`

当前项目暂定英文名：`Yinzao`

网页侧当前展示名：`Yinzao`

定位：

- 内部使用的简化版即梦
- 聊天式生图、生视频
- 能理解上下文
- 帮用户优化提示词
- 当前优先做 MVP，不做支付、不做登录

最新接手重点：

- 项目已同步到 GitHub：`https://github.com/lookxun/AI-Video-Assistant.git`，主分支 `main`
- 换电脑开发时执行 `git clone`、`npm install`，复制 `.env.example` 为 `.env.local` 并填写 `OPENROUTER_API_KEY`
- `.env.local`、`node_modules`、`.next`、`public/generated`、`start-project.log` 不上传 GitHub
- 本地浏览器历史对话、反馈日志和当前会话保存在 `localStorage`，不会随 GitHub 同步
- Seedance 独立聚合接口因白名单 / 部署问题先暂停，后续部署服务器时再接
- 当前视频生成已切到 OpenRouter 视频接口 `/api/v1/videos`
- 当前默认视频模型为 `google/veo-3.1-lite`
- OpenRouter 视频查询在 Node `fetch` 下会偶发假 404，已在 `src/lib/openrouter-video.ts` 加 `curl` 兜底；视频下载保存也已加 `curl` 兜底
- 图片生成已修复：`bytedance-seed/seedream-4.5` 只请求 `modalities: ["image"]`，不要请求 `image + text`
- 图片 / 视频生成中都会立即显示 400x400 动画状态卡，不再额外显示“映造正在思考”
- 视频生成完成后会直接以内嵌视频卡片显示在对话流中，按比例缩小，鼠标悬停自动播放，移开暂停
- 当前会话 ID 会保存到 `yinzao-active-session-v1`，刷新浏览器后保持在原历史对话，不再跳到第一条
- Agent 模式意图识别期间会立即显示“映造正在思考”，避免用户发送后长时间无反馈
