# 闪念 FlashMuse

内部测试用的聊天式生图、生视频工作台。

## 启动

双击 `start-project.bat`。

它会后台启动项目，网页可访问后自动打开浏览器。启动失败时会打开 `start-project.log` 显示原因。

## 换电脑继续开发

1. 克隆仓库：`git clone https://github.com/lookxun/AI-Video-Assistant.git`
2. 进入目录：`cd AI-Video-Assistant`
3. 安装依赖：`npm install`
4. 复制 `.env.example` 为 `.env.local`
5. 在 `.env.local` 填入自己的 `OPENROUTER_API_KEY`
6. 启动项目：双击 `start-project.bat`，或运行 `npm run dev`

注意：

1. `.env.local` 不会上传 GitHub，里面是密钥，需要每台电脑单独配置。
2. `node_modules` 不会上传，换电脑后用 `npm install` 重新安装。
3. `.next` 不会上传，启动或构建时会自动生成。
4. `public/generated` 里的本地生成图片 / 视频不会上传，换电脑后重新生成即可。
5. 浏览器历史对话、反馈日志和当前会话保存在本机浏览器 `localStorage`，不会跟随 GitHub 同步。

## 常见问题

如果页面提示 `OpenRouter API Key 无效或已过期`，说明 `.env.local` 里的 `OPENROUTER_API_KEY` 不能用了。换成新的 OpenRouter key 后，需要重新双击 `start-project.bat` 启动。

如果页面提示 `当前模型在你的地区不可用`，说明这个模型被地区限制。当前对话模型是 `bytedance-seed/seed-2.0-lite`，图片模型是 `bytedance-seed/seedream-4.5`，视频模型是 `google/veo-3.1-lite`。

## 当前能力

1. 聊天输入需求
2. 自动整理成更适合生成的提示词
3. 视频模式会通过 OpenRouter 视频接口生成视频并在对话里展示
4. 图片模式会通过 OpenRouter 的 Seedream 生成图片并展示在对话里
5. 会话和结果会保存在本机浏览器里，刷新页面不会丢

## 主要文件

1. `src/components/chat-workbench.tsx`：主页面工作台
2. `src/app/api/chat/route.ts`：聊天接口
3. `src/app/api/video/route.ts`：视频接口
4. `src/app/api/image/route.ts`：图片接口
5. `src/lib/openrouter.ts`：OpenRouter 调用
6. `src/lib/seedance.ts`：Seedance 调用
7. `handover/`：交接文档和更新日志
