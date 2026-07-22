> Purpose / 目的：说明白板录制工具的功能与运行方式。　Audience / 目标读者：使用者与开发者。　How to read / 如何阅读：按语言阅读功能、运行与浏览器支持章节。

# Whiteboard Recorder / 白板录制工具

[English](#english) · [中文](#中文)

---

## English

A pure front-end whiteboard recording tool. Draw and write freehand on a multi-slide whiteboard with your camera in the corner, a resizable teleprompter, and per-slide transitions and handwriting presets — record in one click and export an mp4 video. **Single-page front-end, no backend, zero runtime dependencies** (a static account / paywall service is optional).

### Features

#### 🎨 Whiteboard & objects
- Tools: select / pan (hand), pen, rectangle, ellipse, arrow, text, eraser, undo / redo, clear
- Shapes have a **hand-drawn look**: lines wobble and vary in thickness, and each shape is unique (deterministic from a per-shape seed, so re-renders don't flicker)
- Text uses a **handwriting font** (system handwriting / Kai fonts for Chinese, handwriting fonts for Latin)
- Properties panel: stroke color, background fill, stroke width, border style (solid / dashed / dotted), line style (clean / sketch / rough), corners (sharp / round), opacity, text size
- Infinite canvas: pan with the hand tool or space-drag, zoom toward the cursor with the wheel
- **Multi-select** with a drag rectangle from empty space, then move / scale / rotate / delete as a group
- **Z-order controls** for single and multi-selection: bring to front / back, up / down one layer; one undo step per batch
- **Copy / paste / duplicate**: `Ctrl/Cmd+C` → `Ctrl/Cmd+V`, or `Ctrl/Cmd+D` to clone in place; style, relative position, and layer order are preserved; pasting plain text from outside creates a new text frame
- **Sticker panel** with colored-pencil characters (male / female / mixed), joy / praise / like expressions, and a 6-sticker "Meeting" comic (remote meeting, AI notes, real-time translation, detailed minutes, meeting summary, action items)

#### 📜 Teleprompter
- Built-in teleprompter with adjustable font size and scroll speed; play / pause / back-to-top
- **Resizable from the bottom-right corner**, **draggable from the title bar**, both clamped to the viewport
- **Per-character color**: select text first, then pick a color — one script can use multiple colors; selections survive between edit and play
- Visible only to you — it is **never recorded into the video**
- Script, font size, scroll speed, and color selections are saved with the v6 document and the browser draft

#### 📹 Camera + 🎙️ Microphone
- Camera bubble in the corner, draggable; size and **shape (circle / square)** adjustable in recording settings
- Microphone audio, with **input-device selection** in recording settings
- In screen recording the camera is hidden but kept decoded, so a full-screen share does not show two faces

#### 📑 Slides
- Multi-page deck with thumbnails: add / duplicate / delete / reorder pages; left / right keyboard navigation
- Per-page **background color**, with a single page able to override or inherit the global canvas color
- Bird's-eye **minimap** for navigation
- Deck-wide **aspect ratio**: 16:9 YouTube / 4:3 classic / 3:4 Xiaohongshu / 9:16 TikTok / 1:1 / custom width × height
- **Auto re-layout on ratio change**: page 1 stays centered, subsequent pages are evenly spaced; objects whose center lives inside a page move with that page; objects outside any page stay put

#### ⏺️ Recording, transitions & export
- **Per-page transition**: none / fade / push / wipe, with 3 speed levels; plays in edit and is rendered into the recorded video
- **Per-page transition sound**: none / page-turn / soft swipe / soft chime, with per-page volume; plays locally for the speaker and is mixed into the recording's audio track
- **Per-page handwriting preset**: 4 styles — colored-pencil fill, ink wash, top-left pencil, "diagonal advance"; each runs ~4.4 s of black ink line first then full color from frame 0; per-page **auto-play on enter** toggle, plus a master **"play handwriting when a slide starts"** switch
- **Per-page text-by-line reveal**: independent text boxes fade + rise in reading order during slide entry; enters recording
- **Screen-recording crop toolbar** (whole-screen / monitor source): Full / 16:9 / 4:3 / 3:4 / 9:16 / 1:1 / Custom; the default selection follows the deck's aspect ratio, non-Full presets share a 16:9 safe area top + bottom to avoid menus and the Dock, presets are ratio-locked when corner-dragged, and dragging a handle on Full switches to Custom. Tab and window shares are recorded full-frame without a crop UI.
- **Optional text watermark**: up to 40 characters, 9-grid preset position plus free-drag, size + opacity, persisted locally; appears in both board-recording and screen-recording output
- **Compact unified recording control** (top-right): start / pause / pointer / screen-cursor / timer in one panel; auto-drops a row below 1400 px to avoid overlapping the centered tool bar
- Recording: start / pause / resume / stop, with a timer
- Output = the chosen-ratio canvas + gradient background + a centered white card (padding / rounded corners / shadow) holding the framed content + the camera in the corner
- Export to **mp4** (recorded natively when the browser supports it; otherwise webm, with one-click in-browser transcoding to mp4); preview + download after stopping

### Running

The root `index.html` is the public site entry. `whiteboard.html` is the creator's full version (every feature except login), and `whiteboard-pro.html` is the Pro template served to paying users. Drawing, slides, and the teleprompter work from any of them.

**Camera / microphone / recording** require a "secure context": most browsers block camera access under `file://` (double-click). To record, use localhost or https:

```bash
cd WhiteBoard
python3 -m http.server 8000
```
Open <http://localhost:8000> and grant camera / microphone access when prompted.

You can also deploy to any static host (GitHub Pages / Vercel / Netlify) for built-in https.

### Browser support
- Recommended: latest Chrome / Edge / Safari.
- mp4 export: recorded natively when supported; otherwise webm, with an optional "convert to mp4" that transcodes in-browser (downloads the transcoder from a CDN on first use, needs network).
- The handwriting font relies on handwriting / Kai fonts installed on the system; it falls back to a regular Chinese font when missing.
- Screen-cursor hiding uses `MediaStreamTrack.getCapabilities().cursor`; if the browser does not expose it, the recording falls back to the system cursor without failing.

### Docs
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md): requirements, feature list, design decisions, test checklist, milestones.
- [`AGENTS.md`](AGENTS.md): how to run / current status / next steps (entry point for handoff across tools).
- [`docs/IMPL_NOTES.md`](docs/IMPL_NOTES.md): per-area implementation traps (Slides / Recording / Auth / Objects / Stickers).

---

## 中文

纯前端白板录制工具。在多页白板上手绘画画 / 写字，摄像头出现在角落，可调整大小的提词器，每页独立的转场与笔迹预设，一键录制并导出 mp4 视频。**前端单页应用，无后端、零运行时依赖**（可选静态账号 / 付费配置服务）。

### 功能

#### 🎨 白板与对象
- 工具：选择 / 抓手平移、画笔、矩形、圆、箭头、文字、橡皮擦、撤销 / 重做、清空
- 形状为**手绘外观**：线条带随机抖动与逐段粗细变化，每个图形各不相同（按 seed 确定性生成，重绘不闪）
- 文字使用**手写字体**（中文用系统手写体 / 楷体，拉丁用手写体）
- 属性面板：描边色、背景填充色、描边宽度、边框样式（实线 / 虚线 / 点线）、线条风格（规整 / 手绘 / 粗糙）、边角（直角 / 圆角）、透明度、文字字号
- 无限画布：抓手或空格拖拽平移、滚轮以光标为中心缩放
- **多选**：从空白处拖框选中，可整体移动、缩放、旋转、删除
- **图层顺序**：单选与多选均支持置顶 / 置底、上移 / 下移一层，多选只写一次撤销历史
- **复制 / 粘贴 / 直接复制**：`Ctrl/Cmd+C` 后 `Ctrl/Cmd+V` 粘贴，或 `Ctrl/Cmd+D` 原地复制；保留样式、相对位置与图层顺序；外部复制的纯文字会粘贴为新的白板文字框
- **贴纸面板**：男生 / 女生 / 综合彩铅人物，惊喜、表扬、点赞表情，以及 6 张连续“会议场景”漫画（远程会议、AI 实时记录、实时翻译、详细纪要、会议总结、行动计划）

#### 📜 提词器
- 内置提词器，可调字号与滚动速度、播放 / 暂停 / 回顶
- 可从**右下角拖拽调整大小**、从**标题栏拖动位置**，均限制在视口内
- **逐字着色**：先选中文字再选颜色，一份讲稿可使用多种字色；局部颜色在编辑态与播放态保持一致
- 提词器仅你可见，**不会被录进视频**
- 讲稿、字号、滚动速度与选中字色随 v6 白板文档与浏览器草稿保存

#### 📹 摄像头 + 🎙️ 麦克风
- 摄像头角落小窗，可拖动换位；可在录制设置里调**大小**与**形状（圆形 / 方形）**
- 麦克风录音，可在录制设置里**选择输入设备**
- 整屏录制时摄像头隐藏但保留解码，避免整屏分享出现双重人脸

#### 📑 幻灯片
- 多页幻灯片与缩略图：新增 / 复制 / 删除 / 排序，键盘左右键切页
- 每页可设置**底色**，未单独设置的页继承全局画布底色
- 鸟瞰**小地图**导航
- 整本**画面比例**：16:9 YouTube / 4:3 经典 / 3:4 小红书 / 9:16 抖音 / 1:1 / 自定义宽 × 高
- **比例切换自动重排**：第 1 张中心不变，后续页面按固定间距等距排列；对象中心落在某页内则随该页水平移动，页面外对象保持原位

#### ⏺️ 录制、转场与导出
- **逐页转场**：无 / 淡化 / 推入 / 擦除，三档速度；编辑预览与录制成品共用同一套行为
- **逐页转场声音**：无 / 翻书 / 轻柔滑动 / 柔和提示音，可设音量；讲解者可听到，录制时混入成品音轨
- **逐页笔迹预设**：4 种——彩铅铺色 / 水墨晕染 / 左上到右下铅笔 / “斜线推进”；每种都以约 4.4 秒黑色细墨线起笔再立即从头推进原色；支持**逐页切入自动播放**，并提供**“幻灯片开始时自动播放笔迹”**的总开关
- **逐页文字逐行**：当前页独立文字框按从上到下、同高从左到右依次淡入并轻微上移，播放进入白板录制
- **整屏录制裁剪工具栏**（整屏 / 显示器来源）：全屏 / 16:9 / 4:3 / 3:4 / 9:16 / 1:1 / Custom；默认按画面比例生成选区，非全屏预设统一应用 16:9 上下安全边界避开菜单与 Dock，预设拖角锁定比例，全屏拖角自动转为 Custom。标签页与窗口分享仍按完整来源录制，不显示选区。
- **可选文字水印**：最多 40 字，九宫格预设位置 + 预览自由拖动，大小与透明度可调，本机记忆；同时进入白板与录屏成品
- **紧凑统一录制控制框**（右上）：开始 / 暂停 / 激光笔 / 录屏光标 / 计时收进同一面板；视口 < 1400px 自动下移一行，避开居中的绘图工具框
- 录制：开始 / 暂停 / 继续 / 停止，带计时
- 输出 = 选定比例画布 + 渐变背景 + 居中白卡片（留白 / 圆角 / 阴影）承载取景框内容 + 角落摄像头
- 导出 **mp4**（浏览器原生支持时直接录 mp4；否则录 webm，可一键在浏览器内转码为 mp4）；停止后预览 + 下载

### 运行

根 `index.html` 为公共站点入口；`whiteboard.html` 是创作者自用完整版（除登录外全部功能开放），`whiteboard-pro.html` 是面向付费用户的 Pro 模板。绘图、幻灯片与提词器可在任一文件中使用。

**摄像头 / 麦克风 / 录制**需要「安全上下文」：多数浏览器会拦截 `file://`（双击打开）下的摄像头权限。要录制，请用 localhost 或 https：

```bash
cd WhiteBoard
python3 -m http.server 8000
```
浏览器打开 <http://localhost:8000>，再按提示授权摄像头与麦克风即可。

也可部署到任意静态托管（GitHub Pages / Vercel / Netlify），自带 https。

### 浏览器支持
- 推荐最新版 Chrome / Edge / Safari。
- mp4 导出：浏览器原生支持时直接录 mp4；不支持时录 webm，可点「转 mp4」按需在浏览器内转码（首次会从 CDN 下载转码器，需联网）。
- 手写字体依赖系统已安装的中文手写 / 楷体字体；缺失时回退到常规中文字体。
- 录屏光标隐藏使用 `MediaStreamTrack.getCapabilities().cursor`；浏览器不支持时安全降级为系统光标，不会中断录制。

### 文档
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md)：需求、功能清单、设计决策、测试清单、里程碑。
- [`AGENTS.md`](AGENTS.md)：运行 / 当前状态 / 下一步（跨工具接手入口）。
- [`docs/IMPL_NOTES.md`](docs/IMPL_NOTES.md)：按模块整理的实现陷阱（Slides / Recording / Auth / Objects / Stickers）。

---

## Changelog / 变更日志

| Date / 日期 | Changes / 变更内容 |
|------|---------|
| 2026-07-22 | Document slide deck, per-page transitions, handwriting presets and auto-play, screen-crop presets (Full / 16:9 / 4:3 / 3:4 / 9:16 / 1:1 / Custom) with 16:9 safe bounds, teleprompter resize / drag / color / persistence, sticker panel, watermark, multi-select, copy / paste / duplicate, and z-order controls; clarify `index.html` / `whiteboard-pro.html` / `whiteboard.html` roles / 同步幻灯片、逐页转场、笔迹预设与自动播放、整屏录制比例（全屏 / 16:9 / 4:3 / 3:4 / 9:16 / 1:1 / Custom）与 16:9 安全边界、提词器大小 / 拖动 / 字色 / 持久化、贴纸面板、文字水印、多选、复制粘贴与图层顺序，并明确 `index.html` / `whiteboard-pro.html` / `whiteboard.html` 的角色 |
| 2026-07-14 | Updated the default site-entry instructions without documenting internal commercial edition mapping / 更新默认站点入口说明，但不记录内部商业版本映射 |
| 2026-06-29 | English-first bilingual README / 双语 README 改为英文在前 |
| 2026-06-29 | Bilingual README (zh/en); removed the excalicord reference / 双语 README；移除 excalicord 引用 |
| 2026-06-29 | Synced actual features and fixed inaccurate descriptions / 同步实际功能并修正不准确描述 |
| 2026-06-28 | Initial creation / 初始创建 |