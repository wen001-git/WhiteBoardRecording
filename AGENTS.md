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
- `index.html` 已实现 M0~M3 + 迭代二（手绘风格 + 录制比例/背景/取景框）+ 迭代三（绘图样式面板、摄像头可拖拽缩放、更细真实手绘线条、完整录制设置）+ 贴图功能 + 指针选择/Delete 删除对象 + 菱形/直线工具 + 丰富文本样式 + 对象缩放/旋转（单文件）。
- 迭代三录制设置已补齐并接入真实合成：比例含 `Custom` 自定义；背景含分类筛选、随机壁纸、离线程序纹理/渐变/纯色/无；白卡片支持圆角半径与画布边距；摄像头支持录制开关、大小、圆形/方形；麦克风下拉由 `populateDevices()` 填充；录制光标高亮支持开关和颜色。
- `drawRecFrame()` 已读取上述 `recConfig` 字段，导出画面会同步设置面板中的背景、白卡片边距/圆角、摄像头形状/大小/开关、光标高亮；提词器仍不入录像。
- 贴图对象保存为 `{type:'image',src,x,y,w,h}`（`src` 为 dataURL），导入/粘贴时会自动裁掉透明/近白空边；由 `imageCache` 缓存 `HTMLImageElement`；图片对象参与重绘、撤销/重做、橡皮擦命中、缩放平移和录制导出。
- 选择工具 `select` 是默认工具；主工具栏顺序为 hand/select/text/ellipse/rect/diamond/arrow/line/pen/image/eraser，数字下标从 text 开始为 1~9；点击对象显示 DOM 选中框，可拖动对象、拖四角缩放、拖顶部圆点旋转，按 `Delete/Backspace` 删除选中对象并支持撤销/重做。选中框不画进 canvas，因此不进入录制导出。
- 文字工具支持新建文字时设置字体、字号、左/中/右对齐和透明度；字体采用离线系统字体栈为主，网络可用时加载 Nunito / Lilita One / Comic Neue 增强；文字对象保存 `fontFamily/textAlign/opacity`，旧对象缺字段会 fallback。文字编辑态的 `#textInput` 无边框，提交后不自动保留选中框；选择工具下点选文字后可拖动移动，双击文字或选中后按 Enter 可重新编辑；Esc 取消编辑，清空提交会删除该文字。
- 本轮自动验证：内联 JS 语法检查通过；文字编辑无边框、对象缩放/旋转关键标记检查通过；图片变换已改用元素本体框而不是带 padding 的选中框；录屏核心函数 diff 无命中。按用户反馈，已移除强制浏览器 review 规则，后续是否打开浏览器预览按改动风险和用户要求决定。
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
- [ ] 真机：文字工具切换字体/字号/左中右对齐/透明度后新建中英文文字；已选中文字可拖动移动，双击/Enter 重新编辑；确认选中框不压字，撤销/重做正常，录制导出中文字透明度一致
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
- **选择/变换/删除**：`selectedIndex` 指向 `scene[]`；`selectObjectAt()` 复用 `hitTest()` 从顶层向下命中；`#selectionBox` 是 DOM 浮层，按对象外接框和 `view` 映射到屏幕并随 `rotation` 旋转；四角手柄缩放对象，顶部圆点旋转对象；实际变换使用 `transformBounds()` 的元素本体框，避免把选中框 padding 或邻近元素算进图片/文字尺寸；`Delete/Backspace` 删除选中对象前 `pushHistory()`。
- **贴图渲染**：工具栏 `image` 按钮触发隐藏文件选择器；`window paste` 读取第一张 `image/*`；载入时先裁掉透明/近白空边，再生成 `pendingImage` 跟随鼠标预览，单击后写入 `scene`。图片以 dataURL 存储，`imageCache` 负责加载和重绘完成后 `render()`。
- **文字样式**：文字对象保存 `{type:'text',text,x,y,color,fontSize,fontFamily,textAlign,opacity}`；`FONT_OPTIONS` 提供离线字体栈与在线增强字体；`drawObject/objectBounds/#textInput` 均按对象字体、对齐和透明度渲染/测量。
- **文字编辑**：`editingTextIndex` 区分新建与编辑；文字提交后 `clearSelection()` 隐藏选中框；选择工具下单击只负责选中，拖动负责移动文字；双击命中文字或选中后按 Enter 调 `beginTextEdit()`，提交时替换原对象并进入撤销栈；Esc 调 `cancelTextInput()` 不改原对象。
- **手绘渲染**：`mulberry32(seed)` PRNG + `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`；形状对象带 `seed`（创建时随机），重绘按 seed 确定性生成扰动→稳定不闪。pen 为自由手绘，line 为两点直线对象。
- **录制设置**：`RATIOS`（含 `custom`，输出像素）/`BACKGROUNDS`（离线渐变、纯色、纹理、无）/`recConfig{ratio,customW,customH,bgIndex,bgCategory,frame,cardRadius,canvasPadding,showCamera,cameraSize,cameraShape,micDeviceId,cursorHighlight,cursorColor}`；状态机 idle→setup→recording→paused（见 `updateRecUI`）。
- **合成录制**：`recCanvas` 尺寸=`getRatioConfig()`；`drawRecFrame`=填背景→画白卡片(边距+圆角+阴影)→裁剪卡片内 `drawImage(board, 取景框区域→卡片)`→按设置叠加摄像头(镜像圆/方)与光标高亮。`captureStream(30)`+所选麦克风音轨→`MediaRecorder`。
- **取景框** `#recFrame`：setup 状态显示，可拖动+四角缩放并锁定 `ratioVal()`；其 `box-shadow 0 0 0 99999px` 实现外部变暗。
- 坐标：世界坐标 = (屏幕坐标 - view.xy) / view.scale。

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-06-30 | 修复图片选中/缩放框误带邻近元素的观感：图片选中框贴合图片本体，缩放/旋转基准改用 `transformBounds()` 而非带 padding 的 UI 外框 |
| 2026-06-30 | 新增选中对象统一缩放/旋转：形状、线条、画笔、文字、图片均可拖四角缩放、拖顶部圆点旋转，选中框仍不进入录制导出 |
| 2026-06-30 | 调整文字提交后的选中状态：新建/编辑文字完成后自动隐藏选中框，避免文字旁残留蓝色边框 |
| 2026-06-30 | 简化文字编辑态视觉：移除 `#textInput` 蓝色虚线边框，编辑文字时只显示文字与光标 |
| 2026-06-30 | 按反馈移除强制浏览器 review 规则，后续前端检查按改动风险和用户要求选择静态检查或浏览器预览 |
| 2026-06-30 | 修复文字编辑/拖动冲突：选择工具下单击文字只选中、拖动可移动；双击或 Enter 才进入编辑 |
| 2026-06-30 | 优化已创建文字的再次编辑：选择工具下先选中文字，再次单击/双击文字或按 Enter 可重新打开输入框，提交替换原对象并支持撤销/重做 |
| 2026-06-30 | 扩展文字工具样式：新增字体选择、字号快捷按钮、左/中/右对齐和文字透明度；文字对象保存 `fontFamily/textAlign/opacity`，选中框按实际字体和对齐测量 |
| 2026-06-30 | 录制条按钮颜色改为绿色开始、黄色暂停、深灰停止，红色只保留作录制状态提示；移除欢迎页重复音量条，避免和浏览器权限弹窗提示重复 |
| 2026-06-30 | 工具栏在箭头后新增直线和画笔：顺序为 hand/select/text/ellipse/rect/diamond/arrow/line/pen/image/eraser，数字下标更新为 1~9；直线对象支持样式、选择、删除、移动、橡皮擦和录制导出 |
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
