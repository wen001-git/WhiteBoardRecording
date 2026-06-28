# 白板录制工具（Whiteboard Recorder）

仿 [excalicord.com](https://excalicord.com/) 的纯前端白板录制工具。在无限白板上画画/写字，摄像头出现在角落，内置提词器，一键录制并导出 mp4 视频。**单个 HTML 文件，无后端，零依赖。**

## 功能
- 🎨 无限白板：画笔（颜色/粗细）、矩形、圆、箭头、文字、橡皮擦、撤销/重做、平移/缩放
- 📹 摄像头角落小窗（可拖动换角）
- 🎙️ 麦克风录音
- 📜 内置提词器（可调字号/速度，且不会被录进视频）
- ⏺️ 一键录制（开始/暂停/继续/停止），导出 mp4

## 运行
摄像头/麦克风需要安全上下文（https 或 localhost），不能直接双击 `file://` 打开。

```bash
cd WhiteBoard
python3 -m http.server 8000
```
浏览器打开 <http://localhost:8000>，按提示授权摄像头与麦克风即可。

也可部署到任意静态托管（GitHub Pages / Vercel / Netlify），自带 https。

## 浏览器支持
- 推荐最新版 Chrome / Edge / Safari。
- mp4 导出：浏览器原生支持时直接录 mp4；不支持时录 webm，可点「转 mp4」按需在浏览器内转码（首次会从 CDN 下载转码器）。

## 文档
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md)：需求、功能清单、设计决策、测试清单、里程碑。
- [`AGENTS.md`](AGENTS.md)：运行/当前状态/下一步（跨工具接手入口）。

## 变更日志

| 日期 | 变更内容 |
|------|---------|
| 2026-06-28 | 初始创建：项目说明与运行指引 |
