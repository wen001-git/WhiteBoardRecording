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
- 新增「幻灯片」多页录制功能：右侧常驻面板（同现有左侧样式面板视觉语言）可新增/删除/切换幻灯片；每张幻灯片是世界坐标矩形（`state.slides[]`，尺寸=创建时 `getRatioConfig()` 输出分辨率），录制时 `enterSetup()`/`selectSlide()` 会把 `state.view` 对焦到选中幻灯片并把 `recConfig.frame` 精确设为其屏幕投影矩形；录制/setup/paused 期间可用左右方向键或点击面板瞬间切换（无动画），空闲态方向键仅平移视图不影响 `recConfig.frame`（向后兼容无幻灯片场景）；比例设置变化时所有幻灯片按 `showFrame()` 同款“保持中心、按新比例重适配”逻辑联动；删除仅在 `recState==='idle'` 时允许（面板 ✕ 按钮同步禁用）；幻灯片边框/序号是 `#slideFramesLayer` 下的 `position:fixed` DOM 浮层（照抄 `#selectionBox` 模式），不进入 `state.scene`、结构上不可能被 `drawRecFrame()` 采样到；`state.slides`/`state.activeSlide` 已接入 `currentDoc()`/`applyDoc()` 持久化，旧文档缺字段时安全回退为空。
- 录制合成循环：白板模式用 `setInterval(1000/30)`；**录屏模式用屏幕轨 `MediaStreamTrackProcessor` 帧驱动**(Chrome/Edge),切到别的 App 后台仍满帧;无此 API 回退 `setInterval`(后台可能掉帧)。
- **迭代四/五（录屏模式，方案1：原样录）**:`recConfig.source='board'|'screen'`;设置弹窗顶部「录制内容」分段控件,屏幕模式隐藏 `.board-only`(背景/圆角边距/光标)。流程:`录制`/设置「完成」→ `enterScreenSetup`(直接 `getDisplayMedia`,用户选 窗口/整屏/标签页)→ **成功后立即 `startScreenRecording()`**(无快照/取景中间态)→ `drawScreenFrame(src)` 把**整幅** `screenVideo` 画进 `recCanvas`(尺寸=捕获画面、最长边≤1920 偶数)+ 右下角摄像头(`cameraSize/cameraShape` 镜像圆/方)→ `buildMixedAudioTracks` 麦克风+系统声音 WebAudio 混音 → 复用 `onRecStop/showExport`。
- **帧驱动 & 防黑屏**:Chrome `MediaStreamTrackProcessor` 读屏幕轨,`drawScreenFrame(VideoFrame)` 帧到即画(切后台满帧、隐藏 video 也能录);无该 API 回退 `setInterval`。`#screenVideo` 仅取帧源、离屏隐藏。
- **录屏隐藏摄像头气泡**:`startScreenRecording` 设 `camWrap.style.visibility='hidden'`(仍解码可 drawImage,不被整屏录到 → 避免双重人脸),`stopRecording` 恢复。
- 注:`#screenStage`/`#screenSnap`/`computeCrop`/`layoutScreenSnap` 为旧裁剪流程遗留,方案1 已不调用(白板 `#recFrame` 仍正常用)。早期「选整屏无限镜像」「头像静止」均因旧的实时/快照铺满显示舞台,方案1 去掉该阶段后消除。
- 已无头验证:源切换显隐、能力检测(`MediaStreamTrackProcessor`/`getDisplayMedia` 在本机可用)、白板模式状态机回归、无 console error。
- **UI 视觉升级(2026-07-02)**:做了三套可交互换肤 demo(A 纸上工作室/B 导播台/C 精修淡雅)供用户对比,用户选定 **C 精修淡雅**,定稿为 **`index-v2.html`**;`index.html` 保持旧稳定版不动,另有备份 `backups/index-stable-2026-07-02.html`。C 与旧版差异**仅在 `<style>` 块**(JS 无差异):漂移色值归一到 `:root` 变量(选中框 `#6965db`→`var(--accent)`、面板激活 `#1f1b8f/#dedcff`→accent 变量、幻灯片边框 `#5b57d6`→变量)、双层柔和阴影、计时器/缩放百分比/快捷键角标用 `--mono` 等宽栈、`:focus-visible` 焦点环、`prefers-reduced-motion` 支持、工具按压/色块 hover 微交互。无头 Chrome 回归:零 JS 错误、绘制/面板/设置弹窗正常、录制采样像素纯白。两套未选中方案已按用户要求归档为 `backups/demo-*-unselected-2026-07-02.html`(防误用),`demo-refine.html` 因与 index-v2 内容重复已删除;仓库根只保留 `index.html`(旧)与 `index-v2.html`(新)。
- ⚠️ 未验证(需真机授权,无头无法授予屏幕/摄像头):录屏裁剪是否准、切 App 是否满帧不冻结、脸在角落、麦克风+系统声音、mp4 可播;以及白板模式真实录制产物。

## 下一步 TODO
- [ ] 真机：图片按钮选择 PNG/JPG、剪贴板粘贴图片、单击放置、撤销/重做、橡皮擦删除、录制导出包含图片
- [ ] 真机：指针工具点击形状/线条/文字/图片 → 选中框出现 → Delete/Backspace 删除 → 撤销/重做恢复
- [ ] 真机：文字工具切换字体/字号/左中右对齐/透明度后新建中英文文字；已选中文字可拖动移动，双击/Enter 重新编辑；确认选中框不压字，撤销/重做正常，录制导出中文字透明度一致
- [ ] 真机(Chrome)：录屏 → 选屏幕/窗口(勾系统音频) → 拖取景框选区域 → 开始 → 切到别的 App → 停止；确认只录框内区域、切 App 满帧、脸在角落、有麦克风+系统声、mp4 可播
- [ ] 真机(Safari)：确认录屏+麦克风可用,无 `MediaStreamTrackProcessor`/系统音时优雅降级
- [ ] 真机(白板模式)：授权摄像头 → 录制 → 预览 → 下载 mp4；确认含白板+人脸+声音、提词器不入录像
- [ ] 视情况：对象选择/移动工具（v1 仅 hand 平移）
- [ ] 真机：幻灯片录制 → 新增多张幻灯片并分别画内容 → 录制过程中用左右键/点击面板切换 → 确认导出视频画面精确对准每张幻灯片、切换瞬间无闪烁/残影、灰色边框和序号标签不会出现在视频里
- [ ] 真机：常见窗口尺寸（1280×800、1440×900）下检查右侧「幻灯片」面板与提词器面板同时打开时不拥挤/不遮挡
- [ ] 用户真机过一遍 `index-v2.html`（新 UI 定稿版）核心流程；确认满意后决定何时用它取代 `index.html`（取代前 `index.html` 已有 `backups/` 备份）
- [x] 未选中的换肤 demo 已归档至 `backups/*-unselected-2026-07-02.html`；`demo-refine.html`（与 index-v2 内容相同）已删除

## 文件地图
- `index.html` — 全部应用（单文件，旧稳定版）
- `index-v2.html` — UI 视觉升级定稿版（=旧版 + 仅 `<style>` 块精修），待用户真机验收
- `backups/` — 历史归档，**均为非活跃文件，勿在其上开发**：`index-stable-2026-07-02.html`（定稿前稳定版备份）、`demo-paper-unselected-2026-07-02.html` / `demo-console-unselected-2026-07-02.html`（未选中的换肤方案）
- `docs/PROJECT_PLAN.md` — 需求/功能清单/设计决策/测试清单/里程碑（单一产品文档）
- `README.md` — 运行说明

## 关键实现备忘
- 绘图模型：`scene[]` 对象数组 + `view{x,y,scale}`，每帧重绘；`undoStack/redoStack`。
- **选择/变换/删除**：`selectedIndex` 指向 `scene[]`；`selectObjectAt()` 复用 `hitTest()` 从顶层向下命中；`#selectionBox` 是 DOM 浮层，按对象外接框和 `view` 映射到屏幕并随 `rotation` 旋转；四角手柄缩放对象，顶部圆点旋转对象；实际变换使用 `transformBounds()` 的元素本体框，避免把选中框 padding 或邻近元素算进图片/文字尺寸；`Delete/Backspace` 删除选中对象前 `pushHistory()`。
- **贴图渲染**：工具栏 `image` 按钮触发隐藏文件选择器；`window paste` 读取第一张 `image/*`；载入时先裁掉透明/近白空边，再生成 `pendingImage` 跟随鼠标预览，单击后写入 `scene`。图片以 dataURL 存储，`imageCache` 负责加载和重绘完成后 `render()`。
- **文字样式**：文字对象保存 `{type:'text',text,x,y,color,fontSize,fontFamily,textAlign,opacity,runs}`；形状内文字额外保存 `label/labelColor/labelFontSize/labelFontFamily/labelRuns`；`runs/labelRuns` 记录局部选区的 `color/fontFamily`，可只改编辑框中选中的几个字；`FONT_OPTIONS` 提供离线字体栈与在线增强字体；`drawObject/objectBounds/#textInput` 均按对象字体、局部 runs、对齐和透明度渲染/测量。
- **文字编辑**：`editingTextIndex` 区分新建与编辑；文字编辑层是 `contenteditable`，支持局部富文本选区；文字提交后 `clearSelection()` 隐藏选中框；选择工具下单击只负责选中，拖动负责移动文字；双击命中文字或选中后按 Enter 调 `beginTextEdit()`，提交时替换原对象并进入撤销栈；Esc 调 `cancelTextInput()` 不改原对象。
- **文字编辑样式**：编辑已有文字时，点击左侧字体/字号/颜色/对齐/透明度控件不会触发输入框提前 blur 提交；若编辑框内有选中文本，字体/颜色只作用于该选区；无选区时才改变当前文字对象/后续输入的默认样式。
- **手绘渲染**：`mulberry32(seed)` PRNG + `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`；形状对象带 `seed`（创建时随机），重绘按 seed 确定性生成扰动→稳定不闪。pen 为自由手绘，line 为两点直线对象。
- **录制设置**：`RATIOS`（含 `custom`，输出像素）/`BACKGROUNDS`（离线渐变、纯色、纹理、无）/`recConfig{ratio,customW,customH,bgIndex,bgCategory,frame,cardRadius,canvasPadding,showCamera,cameraSize,cameraShape,micDeviceId,cursorHighlight,cursorColor}`；状态机 idle→setup→recording→paused（见 `updateRecUI`）。
- **合成录制**：`recCanvas` 尺寸=`getRatioConfig()`；`drawRecFrame`=填背景→画白卡片(边距+圆角+阴影)→裁剪卡片内 `drawImage(board, 取景框区域→卡片)`→按设置叠加摄像头(镜像圆/方)与光标高亮。`captureStream(30)`+所选麦克风音轨→`MediaRecorder`。
- **取景框** `#recFrame`：setup 状态显示，可拖动+四角缩放并锁定 `ratioVal()`；其 `box-shadow 0 0 0 99999px` 实现外部变暗。
- 坐标：世界坐标 = (屏幕坐标 - view.xy) / view.scale。
- **幻灯片**：`state.slides[{id,x,y,w,h}]`/`state.activeSlide` 是世界坐标矩形列表，与 `state.scene`/`undoStack` 无关（不可撤销，语义上是元数据而非画布内容）；`addSlide()` 首张放原点、后续接在上一张右侧留 60 世界单位间隙；`selectSlide(i)` 是唯一的“选中并对焦”入口——内部调 `fitViewToRect()`（把 `state.view` 缩放/平移到让该矩形以 0.86 留白居中于视口）,若 `recState` 处于 setup/recording/paused 还会用 `worldToScreen` 把 `recConfig.frame` 精确设为该矩形的屏幕投影并 `applyFrameStyle()`；`enterSetup()` 有幻灯片时调 `selectSlide()` 取代 `showFrame()`，无幻灯片时行为不变（向后兼容）；`#recFrame` 手动拖拽在有幻灯片时被 guard 掉；比例变化钩子（`buildRatioGrid`/`customW`/`customH`）在有幻灯片时改调 `resizeSlidesToRatio()`（保持每张中心、按新比例重算宽高，同 `showFrame()` 的重适配思路）；`deleteSlide()` 仅 `recState==='idle'` 时可执行；幻灯片边框/序号标签是 `#slideFramesLayer` 内按 `data-slide-id` 增量 diff 的 DOM 浮层（`updateSlideFrames()`，挂在 `render()` 里，紧跟 `updateSelectionBox()`），和 `#selectionBox`/`#recFrame` 一样只在屏幕上叠加显示，从不写入 canvas，因此结构上不会进入 `drawRecFrame()` 的录制输出。

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-02 | 按用户要求归档未选中 demo 到 `backups/*-unselected-*.html`、删除与 index-v2 重复的 demo-refine，仓库根只留新旧两个版本，防止后续 AI 工具误用非活跃文件 |
| 2026-07-02 | UI 视觉升级：先备份旧版到 `backups/`，做三套可交互换肤 demo（纸上工作室/导播台/精修淡雅）供用户实测对比；用户选定「精修淡雅」定稿为 `index-v2.html`（仅 CSS 变更：色值归一/双层阴影/等宽数字/焦点环/微交互），`index.html` 旧版保留不动；无头 Chrome 回归零报错、录制采样纯白 |
| 2026-07-01 | 新增「幻灯片」多页录制功能：右侧常驻面板增删切换幻灯片，每张按录制比例定形；录制/setup/paused 下左右键或点击面板瞬间切换取景，`recConfig.frame` 实时对齐所选幻灯片；比例变化时联动重适配；幻灯片边框为 DOM 浮层不进入录制导出；接入自动存档持久化 |
| 2026-07-01 | 修复形状内文字局部样式提交后丢失：`labelRuns` 持久化并按分段样式渲染；形状文字提交/取消后刷新左侧面板 |
| 2026-07-01 | 升级文字编辑为局部富文本：编辑框内选中文字后可只修改该选区的字体/颜色，提交后 canvas 按 `runs` 分段渲染 |
| 2026-07-01 | 修复编辑已有文字时无法从左侧面板修改字体/字号等样式：点击样式控件不再让输入框提前失焦提交，结束编辑后样式随对象保存 |
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
