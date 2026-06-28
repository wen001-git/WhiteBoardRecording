# 白板录制工具 / Whiteboard Recorder

[中文](#中文) · [English](#english)

---

## 中文

纯前端白板录制工具。在无限白板上手绘画画/写字，摄像头出现在角落，内置提词器，一键录制并导出 mp4 视频。**单个 HTML 文件，无后端，零依赖。**

### 功能

#### 🎨 无限白板（手绘风格）
- 工具：选择/抓手平移、画笔、矩形、圆、箭头、文字、橡皮擦、撤销/重做、清空
- 形状为**手绘外观**：线条带随机抖动与逐段粗细变化，每个图形各不相同（按 seed 确定性生成，重绘不闪）
- 文字使用**手写字体**（中文用系统手写体/楷体，拉丁用手写体）
- 属性面板：描边色、背景填充色、描边宽度、边框样式（实线/虚线/点线）、线条风格（规整/手绘/粗糙）、边角（直角/圆角）、透明度、文字字号
- 无限画布：抓手或空格拖拽平移、滚轮以光标为中心缩放

#### 📹 摄像头 + 🎙️ 麦克风
- 摄像头角落小窗，可拖动换位；可在录制设置里调**大小**与**形状（圆形/方形）**
- 麦克风录音，可在录制设置里**选择输入设备**

#### 📜 提词器
- 内置提词器，可调字号与滚动速度、播放/暂停/回顶
- 提词器仅你可见，**不会被录进视频**

#### ⏺️ 录制与导出
- 录制设置：**画面比例**（16:9 YouTube / 4:3 经典 / 3:4 小红书 / 9:16 抖音 / 1:1 / 自定义）、**背景壁纸**（渐变 / 纯色 / 无）、摄像头大小与形状、麦克风、**录制时光标高亮**开关
- 可拖动/缩放（锁定比例）的**取景框**界定录制区域；录制中以红色边框提示正在录制的范围
- 录制：开始 / 暂停 / 继续 / 停止，带计时
- 输出 = 选定比例画布 + 渐变背景 + 居中白卡片（留白/圆角/阴影）承载取景框内容 + 角落摄像头
- 导出 **mp4**（浏览器原生支持时直接录 mp4；否则录 webm，可一键在浏览器内转码为 mp4）；停止后预览 + 下载

### 运行

绘图、提词器等不需要摄像头的功能，**双击 `index.html` 即可使用**。

但**摄像头 / 麦克风 / 录制**需要「安全上下文」：多数浏览器会拦截 `file://`（双击打开）下的摄像头权限。要录制，请用 localhost 或 https：

```bash
cd WhiteBoard
python3 -m http.server 8000
```
浏览器打开 <http://localhost:8000>，按提示授权摄像头与麦克风即可。

也可部署到任意静态托管（GitHub Pages / Vercel / Netlify），自带 https。

### 浏览器支持
- 推荐最新版 Chrome / Edge / Safari。
- mp4 导出：浏览器原生支持时直接录 mp4；不支持时录 webm，可点「转 mp4」按需在浏览器内转码（首次会从 CDN 下载转码器，需联网）。
- 手写字体依赖系统已安装的中文手写/楷体字体；缺失时回退到常规中文字体。

### 文档
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md)：需求、功能清单、设计决策、测试清单、里程碑。
- [`AGENTS.md`](AGENTS.md)：运行/当前状态/下一步（跨工具接手入口）。

---

## English

A pure front-end whiteboard recording tool. Draw and write freehand on an infinite whiteboard, with your camera in the corner and a built-in teleprompter — record in one click and export an mp4 video. **Single HTML file, no backend, zero dependencies.**

### Features

#### 🎨 Infinite whiteboard (hand-drawn style)
- Tools: select/pan (hand), pen, rectangle, ellipse, arrow, text, eraser, undo/redo, clear
- Shapes have a **hand-drawn look**: lines wobble and vary in thickness, and each shape is unique (deterministic from a per-shape seed, so re-renders don't flicker)
- Text uses a **handwriting font** (system handwriting/Kai fonts for Chinese, handwriting fonts for Latin)
- Properties panel: stroke color, background fill, stroke width, border style (solid/dashed/dotted), line style (clean/sketch/rough), corners (sharp/round), opacity, text size
- Infinite canvas: pan with the hand tool or space-drag, zoom toward the cursor with the wheel

#### 📹 Camera + 🎙️ Microphone
- Camera bubble in the corner, draggable; size and **shape (circle/square)** adjustable in recording settings
- Microphone audio, with **input-device selection** in recording settings

#### 📜 Teleprompter
- Built-in teleprompter with adjustable font size and scroll speed; play/pause/back-to-top
- Visible only to you — it is **never recorded into the video**

#### ⏺️ Recording & export
- Recording settings: **aspect ratio** (16:9 YouTube / 4:3 classic / 3:4 Xiaohongshu / 9:16 TikTok / 1:1 / custom), **background wallpaper** (gradient / solid / none), camera size and shape, microphone, and a **cursor-highlight while recording** toggle
- A draggable/resizable (ratio-locked) **capture frame** defines the recording area; during recording a red border shows what's being captured
- Recording: start / pause / resume / stop, with a timer
- Output = the chosen-ratio canvas + gradient background + a centered white card (padding/rounded corners/shadow) holding the framed content + the camera in the corner
- Export to **mp4** (recorded natively when the browser supports it; otherwise webm, with one-click in-browser transcoding to mp4); preview + download after stopping

### Running

Features that don't need the camera (drawing, teleprompter) work by **just double-clicking `index.html`**.

But **camera / microphone / recording** require a "secure context": most browsers block camera access under `file://` (double-click). To record, use localhost or https:

```bash
cd WhiteBoard
python3 -m http.server 8000
```
Open <http://localhost:8000> and grant camera/microphone access when prompted.

You can also deploy to any static host (GitHub Pages / Vercel / Netlify) for built-in https.

### Browser support
- Recommended: latest Chrome / Edge / Safari.
- mp4 export: recorded natively when supported; otherwise webm, with an optional "convert to mp4" that transcodes in-browser (downloads the transcoder from a CDN on first use, needs network).
- The handwriting font relies on handwriting/Kai fonts installed on the system; it falls back to a regular Chinese font when missing.

### Docs
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md): requirements, feature list, design decisions, test checklist, milestones.
- [`AGENTS.md`](AGENTS.md): how to run / current status / next steps (entry point for handoff across tools).

---

## 变更日志 / Changelog

| 日期 / Date | 变更内容 / Changes |
|------|---------|
| 2026-06-29 | 双语 README（中/英）；移除对 excalicord 的引用 / Bilingual README (zh/en); removed the excalicord reference |
| 2026-06-29 | 同步实际功能并修正不准确描述 / Synced actual features and fixed inaccurate descriptions |
| 2026-06-28 | 初始创建 / Initial creation |
