# AGENTS.md — 白板录制工具

## 一句话定位
仿 [excalicord.com](https://excalicord.com/) 的**纯前端单 HTML** 白板录制工具：无限白板画画/写字 + 角落摄像头 + 提词器 + 一键录制导出 mp4。**无后端**。

## 运行 / 测试方式
```bash
cd /Users/Zhuanz/Claude/WhiteBoard
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```
> ⚠️ 摄像头/麦克风需要安全上下文（https 或 localhost）。直接 `file://` 双击会被多数浏览器拦摄像头，务必走 localhost 或部署到静态托管。

## 硬约束
- **单个 HTML 文件**（`index.html`），HTML/CSS/JS 全内联，零构建、零依赖。
- 现阶段**不引入后端、不引入框架**。
- 录制走「方案1」：白板 + 角落摄像头合成进**一个**视频。
- 导出 **mp4**：原生 `MediaRecorder` 支持则直接录 mp4；否则录 webm + 按需懒加载 ffmpeg.wasm 转 mp4（仅此一处可联网拉 CDN）。
- 提词器是独立 DOM 浮层，**不能进录像**。

## 当前状态
- `index.html` 已实现 M0~M3 + 迭代二（手绘风格 + 录制比例/背景/取景框）（单文件）。
- 已在无头预览(Chromium)验证：无报错；绘图/撤销重做/橡皮擦/缩放；native mp4(`video/mp4;avc1`)；**手绘形状确定性**(同 seed→同像素，不闪)；**录制设置**(5 比例+11 背景、setup 状态、取景框锁比例)；**合成输出**(1280×720、渐变背景、白卡片、白板内容入卡片)。
- 录制合成循环用 `setInterval(1000/30)`（非 rAF），避免页面切后台黑屏。
- ⚠️ 未验证：摄像头画面、麦克风、真实录制产物、不同比例视觉效果——预览环境 `visibility:hidden` 且无法授权摄像头，**需真实可见浏览器+授权手测**。

## 下一步 TODO
- [ ] 真机(Chrome/Safari)：授权摄像头 → 选不同比例/背景 → 调取景框 → 录制 → 预览 → 下载 mp4；确认输出为对应比例、含渐变背景+白卡片+人脸+声音、提词器不入录像
- [ ] 视情况：Custom 自定义比例（当前 5 个固定预设，UI 已留位）
- [ ] 视情况：摄像头/麦克风设备切换下拉（`populateDevices()` 已预留）
- [ ] 视情况：对象选择/移动工具（v1 仅 hand 平移）

## 文件地图
- `index.html` — 全部应用（单文件）
- `docs/PROJECT_PLAN.md` — 需求/功能清单/设计决策/测试清单/里程碑（单一产品文档）
- `README.md` — 运行说明

## 关键实现备忘
- 绘图模型：`scene[]` 对象数组 + `view{x,y,scale}`，每帧重绘；`undoStack/redoStack`。
- **手绘渲染**：`mulberry32(seed)` PRNG + `roughLine/roughRect/roughEllipse/roughArrow`；形状对象带 `seed`（创建时随机），重绘按 seed 确定性生成扰动→稳定不闪。pen 仍为自由手绘。
- **录制设置**：`RATIOS`（5 预设，输出像素）/`GRADIENTS`（11 背景）/`recConfig{ratio,bgIndex,frame}`；状态机 idle→setup→recording→paused（见 `updateRecUI`）。
- **合成录制**：`recCanvas` 尺寸=`RATIOS[ratio]`；`drawRecFrame`=填背景→画白卡片(留白+圆角+阴影)→裁剪卡片内 `drawImage(board, 取景框区域→卡片)`→摄像头按屏幕相对位置映射进卡片(镜像圆形)。`captureStream(30)`+麦克风音轨→`MediaRecorder`。
- **取景框** `#recFrame`：setup 状态显示，可拖动+四角缩放并锁定 `ratioVal()`；其 `box-shadow 0 0 0 99999px` 实现外部变暗。
- 坐标：世界坐标 = (屏幕坐标 - view.xy) / view.scale。
