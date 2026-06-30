> 目的：让任意 AI 工具/账号无缝接手本项目。　目标读者：下一个接手的 AI 或开发者。　如何阅读：先读本文（定位/运行/当前状态/下一步/文件地图/实现备忘），按需再点开 `docs/PROJECT_PLAN.md`；勿做全量代码扫描。

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
- 录制有两种来源：① 录白板(合成白板+摄像头) ② 录屏幕(`getDisplayMedia` + 取景框裁剪 + 角落摄像头 + 麦克风/系统声音)。两者都合成进**一个**视频。
- 导出 **mp4**：原生 `MediaRecorder` 支持则直接录 mp4；否则录 webm + 按需懒加载 ffmpeg.wasm 转 mp4（仅此一处可联网拉 CDN）。
- 提词器是独立 DOM 浮层，**不能进录像**。

## 持久协作规则
- **会话开始**：先读仓库根 `AGENTS.md`，再按需读它指向的 `docs/PROJECT_PLAN.md` / README；不要默认全量扫描代码库。
- **文档规范**：设计/架构/计划/交接等 `.md` 文档开头保留一句话列出“目的 / 目标读者 / 如何阅读”；结尾保留 `## 变更记录` 表，新增记录放顶部，内容写清 what + why。
- **状态落库**：项目状态、决策、测试结果、下一步 TODO 写进仓库文件，首选 `AGENTS.md`，里程碑级历史写进 `docs/PROJECT_PLAN.md`。
- **阶段收尾**：以 `git diff` 核对实际改动；刷新 `AGENTS.md` 当前状态和 TODO；里程碑更新 `docs/PROJECT_PLAN.md` 变更记录；测试结果如实写入最终回复。
- **测试要求**：每个阶段性修改后做覆盖本次核心路径的自动化或可执行验证；失败则修复后重测。
- **Git/GitHub**：GitHub remote 使用 SSH URL，不用 HTTPS；只有用户明确要求时才提交/推送。

## 当前状态
- `index.html` 已实现 M0~M3 + 迭代二（手绘风格 + 录制比例/背景/取景框）+ 迭代三（绘图样式面板、摄像头可拖拽缩放、更细真实手绘线条、完整录制设置）+ 贴图功能 + 指针选择/Delete 删除对象 + 菱形工具（单文件）。
- 迭代三录制设置已补齐并接入真实合成：比例含 `Custom` 自定义；背景含分类筛选、随机壁纸、离线程序纹理/渐变/纯色/无；白卡片支持圆角半径与画布边距；摄像头支持录制开关、大小、圆形/方形；麦克风下拉由 `populateDevices()` 填充；录制光标高亮支持开关和颜色。
- `drawRecFrame()` 已读取上述 `recConfig` 字段，导出画面会同步设置面板中的背景、白卡片边距/圆角、摄像头形状/大小/开关、光标高亮；提词器仍不入录像。
- 贴图对象保存为 `{type:'image',src,x,y,w,h}`（`src` 为 dataURL），由 `imageCache` 缓存 `HTMLImageElement`；图片对象参与重绘、撤销/重做、橡皮擦命中、缩放平移和录制导出。
- 选择工具 `select` 是默认工具；主工具栏顺序为 hand/select/text/ellipse/rect/diamond/arrow/image/eraser，数字下标从 text 开始为 1~7；点击对象显示 DOM 选中框，按 `Delete/Backspace` 删除选中对象并支持撤销/重做。选中框不画进 canvas，因此不进入录制导出。
- 本轮验证：内联 JS 语法检查通过；本地 `http://localhost:8001/index.html` 打开后，图片按钮与隐藏图片输入存在，录制设置弹窗仍可见且包含 6 个比例、5 个背景分类、18 个背景、圆角/边距/摄像头/麦克风/光标控件；浏览器控制台无 error。
- 录制合成循环：白板模式用 `setInterval(1000/30)`；**录屏模式用屏幕轨 `MediaStreamTrackProcessor` 帧驱动**(Chrome/Edge),切到别的 App 后台仍满帧;无此 API 回退 `setInterval`(后台可能掉帧)。
- **迭代四/五（录屏模式，方案1：原样录）**:`recConfig.source='board'|'screen'`;设置弹窗顶部「录制内容」分段控件,屏幕模式隐藏 `.board-only`(背景/圆角边距/光标)。流程:`录制`/设置「完成」→ `enterScreenSetup`(直接 `getDisplayMedia`,用户选 窗口/整屏/标签页)→ **成功后立即 `startScreenRecording()`**(无快照/取景中间态)→ `drawScreenFrame(src)` 把**整幅** `screenVideo` 画进 `recCanvas`(尺寸=捕获画面、最长边≤1920 偶数)+ 右下角摄像头(`cameraSize/cameraShape` 镜像圆/方)→ `buildMixedAudioTracks` 麦克风+系统声音 WebAudio 混音 → 复用 `onRecStop/showExport`。
- **帧驱动 & 防黑屏**:Chrome `MediaStreamTrackProcessor` 读屏幕轨,`drawScreenFrame(VideoFrame)` 帧到即画(切后台满帧、隐藏 video 也能录);无该 API 回退 `setInterval`。`#screenVideo` 仅取帧源、离屏隐藏。
- **录屏隐藏摄像头气泡**:`startScreenRecording` 设 `camWrap.style.visibility='hidden'`(仍解码可 drawImage,不被整屏录到 → 避免双重人脸),`stopRecording` 恢复。
- 注:`#screenStage`/`#screenSnap`/`computeCrop`/`layoutScreenSnap` 为旧裁剪流程遗留,方案1 已不调用(白板 `#recFrame` 仍正常用)。早期「选整屏无限镜像」「头像静止」均因旧的实时/快照铺满显示舞台,方案1 去掉该阶段后消除。
- 已无头验证:源切换显隐、能力检测(`MediaStreamTrackProcessor`/`getDisplayMedia` 在本机可用)、白板模式状态机回归、无 console error。
- ⚠️ 未验证(需真机授权,无头无法授予屏幕/摄像头):录屏裁剪是否准、切 App 是否满帧不冻结、脸在角落、麦克风+系统声音、mp4 可播;以及白板模式真实录制产物。

## 下一步 TODO
- [ ] 真机：图片按钮选择 PNG/JPG、剪贴板粘贴图片、单击放置、撤销/重做、橡皮擦删除、录制导出包含图片
- [ ] 真机：指针工具点击形状/线条/文字/图片 → 选中框出现 → Delete/Backspace 删除 → 撤销/重做恢复
- [ ] 真机(Chrome)：录屏 → 选屏幕/窗口(勾系统音频) → 拖取景框选区域 → 开始 → 切到别的 App → 停止；确认只录框内区域、切 App 满帧、脸在角落、有麦克风+系统声、mp4 可播
- [ ] 真机(Safari)：确认录屏+麦克风可用,无 `MediaStreamTrackProcessor`/系统音时优雅降级
- [ ] 真机(白板模式)：授权摄像头 → 录制 → 预览 → 下载 mp4；确认含白板+人脸+声音、提词器不入录像
- [ ] 视情况：对象选择/移动工具（v1 仅 hand 平移）

## 文件地图
- `index.html` — 全部应用（单文件）
- `docs/PROJECT_PLAN.md` — 需求/功能清单/设计决策/测试清单/里程碑（单一产品文档）
- `README.md` — 运行说明

## 关键实现备忘
- 绘图模型：`scene[]` 对象数组 + `view{x,y,scale}`，每帧重绘；`undoStack/redoStack`。
- **选择/删除**：`selectedIndex` 指向 `scene[]`；`selectObjectAt()` 复用 `hitTest()` 从顶层向下命中；`#selectionBox` 是 DOM 浮层，按对象外接框和 `view` 映射到屏幕；`Delete/Backspace` 删除选中对象前 `pushHistory()`。
- **贴图渲染**：工具栏 `image` 按钮触发隐藏文件选择器；`window paste` 读取第一张 `image/*`；载入后生成 `pendingImage` 跟随鼠标预览，单击后写入 `scene`。图片以 dataURL 存储，`imageCache` 负责加载和重绘完成后 `render()`。
- **手绘渲染**：`mulberry32(seed)` PRNG + `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`；形状对象带 `seed`（创建时随机），重绘按 seed 确定性生成扰动→稳定不闪。pen 仍为自由手绘（保留 `P` 快捷键）。
- **录制设置**：`RATIOS`（含 `custom`，输出像素）/`BACKGROUNDS`（离线渐变、纯色、纹理、无）/`recConfig{ratio,customW,customH,bgIndex,bgCategory,frame,cardRadius,canvasPadding,showCamera,cameraSize,cameraShape,micDeviceId,cursorHighlight,cursorColor}`；状态机 idle→setup→recording→paused（见 `updateRecUI`）。
- **合成录制**：`recCanvas` 尺寸=`getRatioConfig()`；`drawRecFrame`=填背景→画白卡片(边距+圆角+阴影)→裁剪卡片内 `drawImage(board, 取景框区域→卡片)`→按设置叠加摄像头(镜像圆/方)与光标高亮。`captureStream(30)`+所选麦克风音轨→`MediaRecorder`。
- **取景框** `#recFrame`：setup 状态显示，可拖动+四角缩放并锁定 `ratioVal()`；其 `box-shadow 0 0 0 99999px` 实现外部变暗。
- 坐标：世界坐标 = (屏幕坐标 - view.xy) / view.scale。

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-06-30 | 按截图重排主工具栏：hand/select/text/ellipse/rect/diamond/arrow/image/eraser；数字下标从文字开始 1~7，并新增可绘制/可选中/可删除的菱形工具 |
| 2026-06-30 | 统一工具栏/录制条图标为简洁线性 SVG 风格，指针和箭头按钮对齐 Excalicord 截图风格，移除彩色 emoji 图标 |
| 2026-06-30 | 新增指针选择工具：默认 select，可选中白板对象并用 Delete/Backspace 删除；选中框为 DOM 浮层，不进入录制 |
| 2026-06-30 | 修复贴图放置后的光标状态：图片单击放置或 Esc 取消后自动切回 hand 工具，不再停留在 copy 加号光标 |
| 2026-06-29 | 新增白板贴图功能：工具栏导入/剪贴板粘贴图片，跟随鼠标预览后单击放置，图片参与撤销/橡皮擦/录制导出 |
| 2026-06-29 | 录屏改方案1「窗口/整屏原样录」(去掉快照取景阶段)；录屏时隐藏摄像头气泡避免双重人脸；消除「头像静止」错觉 |
| 2026-06-29 | 修复录屏选「整个屏幕」时的无限镜像递归：取景改用冻结快照、screenVideo 离屏隐藏、帧驱动画 VideoFrame |
| 2026-06-29 | 持久化 Claude 全局规则的兼容部分到 AGENTS.md，确保跨 AI 工具接手时可见并可执行 |
| 2026-06-29 | 按全局新规在开头补「目的/目标读者/如何阅读」；同步迭代四录屏模式状态与 TODO |
| 2026-06-29 | 同步迭代三录制设置实际实现与验证状态，移除已完成的 Custom/麦克风下拉待办，避免跨工具接手时误判 |
