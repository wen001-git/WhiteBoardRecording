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
- **录屏摄像头体验升级(2026-07-02,仅 index-v2.html)**:①`recConfig` 新增 `cameraPosition('tl|tr|bl|br',默认 br)` 与 `cameraBrightness(100~140,默认 115)`;②`drawScreenFrame` 入镜位置按 cameraPosition 四角化(原硬编码右下;左右/顶边距 3%,**底部边距 6%**——避免头像贴底被播放器控制栏盖住下缘),提亮实现为**头像路径上叠 `screen` 混合白色薄层**(`camBrightAlpha()`,GPU 合成;⚠️ 勿改回 `ctx.filter`——canvas filter 每帧落软件渲染,真机实测录制卡顿),`drawScreenFrame`/`drawRecFrame` 两处均生效;③设置弹窗摄像头段新增「入镜位置」四选 seg(`data-camera-pos`)与「画面提亮」滑杆,预览圆点随位置联动;④录屏「已入镜」提示:`#camCueHint` 顶部提示在点「完成」到授权期间显示、`startScreenRecording` 第一行隐藏(不入镜),取消也隐藏;录制条新增「📷 自检」按钮(`#selfCheckBtn`,仅 screen 源+摄像头开+`PIP_OK` 时显示),点击开关 `documentPictureInPicture` 置顶小窗(实时镜像画面+REC红点+「录整屏会入镜」警示,降级 `camVideo.requestPictureInPicture`),`stopRecording` 自动关闭。⑤**卡顿修复**:录屏合成原先只由屏幕轨帧驱动,录静态窗口时屏幕轨长时间不出帧→头像冻结;现摄像头帧兜底驱动合成(`startCamPump` 里 `lastCompositeTs` 距上次合成 >40ms 才补画,避免双倍绘制)。⑥设置弹窗录屏说明按用户反馈精简为一句话,删除「录屏需用 localhost/https…」提示段;「画面比例」区块加 `.board-only`(录屏是原样录、比例由源决定,该设置只对白板模式生效),`updatePreview` 在 `source==='screen'` 时改用中性 16:9 白卡片预览(不套比例/壁纸装饰)——若未来想让录屏也按比例出片(缩放居中+补底),需改 `startScreenRecording` 的 `screenOut` 与 `drawScreenFrame`,当时评估为方案2未做。⑦无头验证(canvas 假流 mock getUserMedia/getDisplayMedia 全 DOM 驱动端到端):tl/br 两角成品视频抽帧断言摄像头只出现在指定角(含新边距公式)、白板模式出片回归、设置 UI 渲染,全部零 JS 错误。⑧**美颜磨皮 v2**(2026-07-03,v1 柔焦被用户否决——全画面雾面感):`recConfig.cameraSmooth 0~100(默认0=关)` + 设置「美颜(磨皮)」滑杆;实现为**肤色掩膜磨皮**:`skinSmoothInto()` 在固定 200px 工作画布(`willReadFrequently`)上盒式模糊(分离式 O(n),半径6)得柔化层,逐像素按 YCbCr 肤色软掩膜(Cb 77~127 / Cr 133~173,`fxRamp` 软边界)混回——**只平滑皮肤,眼睛/头发/背景保持锐利**;每帧 ~1-3ms CPU,勿改成 ctx.filter。两种录制模式经 `drawCamBeautified()` 共用。**设置弹窗新增实时效果预览**:摄像头段 `#camFxPreview`(180px canvas,rAF 循环,弹窗关闭自动停),走与录制完全相同的 drawCamBeautified+camBrightAlpha 管线(所见即所录),拖提亮/磨皮/形状立即可见。量化验证:上半肤色棋盘/下半蓝白棋盘假摄像头,磨皮100% 肤色区 sd 21.4→0.0、蓝白区 66.4→65.0(边缘保持)。
- ⚠️ 未验证(需真机授权,无头无法授予屏幕/摄像头):录屏裁剪是否准、切 App 是否满帧不冻结、脸在角落、麦克风+系统声音、mp4 可播;以及白板模式真实录制产物。
- **定稿版提升为主版本 + 部署上线(2026-07-04)**:用户真机验收满意后，`git mv index.html index-old.html && git mv index-v2.html index.html`——**上面所有历史记录里提到的 `index-v2.html` 现在就是 `index.html`**（旧稳定版归档为 `index-old.html`，内容同 `backups/index-stable-2026-07-02.html`）。部署到 Render（Static Site，Publish Directory=仓库根，零构建）：根路径 `/` 现在服务的是新版内容，`index-old.html` 仍可通过显式路径访问。https 环境顺带解决了摄像头/屏幕录制需要安全上下文的限制（不再依赖 localhost）。

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
- [x] 用户确认满意，2026-07-04 已用 `git mv` 把定稿版提升为主版本：`index.html`（旧稳定版）→ `index-old.html`，`index-v2.html`（定稿版）→ `index.html`；准备部署到 Render
- [x] 未选中的换肤 demo 已归档至 `backups/*-unselected-2026-07-02.html`；`demo-refine.html`（与 index-v2 内容相同）已删除
- [ ] 真机(Chrome)：录屏中点录制条「📷 自检」→ 画中画小窗弹出且切到其他 App 仍置顶可见 → 再点或停止录制自动关闭；确认设置里「入镜位置/画面提亮」对真实摄像头生效、提亮 115% 观感自然
- [ ] 真机(Safari)：无 documentPictureInPicture 时「自检」降级为 video 画中画或隐藏；无 canvas filter 时提亮自动跳过不报错
- [ ] 真机：文字/形状 label 编辑时选中部分文字改字号，确认只有选区变大变小、其余字不动；无选区改字号确认整体默认变化且不影响已有选区字号；混合字号文字拖角缩放、录制导出画面观感正常
- [ ] 真机：幻灯片面板悬停两张幻灯片之间/最前，确认「+」热区清晰可点；点击后在中间插入空白幻灯片，原有内容和编号顺延正确，且新幻灯片自动进入可编辑视图

## 文件地图
- `index.html` — **全部应用（单文件，当前主版本）**。2026-07-04 起=原 `index-v2.html`（UI 视觉升级定稿版，已用户真机验收），改动主要在这
- `index-old.html` — 2026-07-04 前的旧稳定版（原 `index.html`），仅作历史备用，**勿在其上开发**
- `backups/` — 历史归档，**均为非活跃文件，勿在其上开发**：`index-stable-2026-07-02.html`（定稿前稳定版备份，内容同 `index-old.html`）、`demo-paper-unselected-2026-07-02.html` / `demo-console-unselected-2026-07-02.html`（未选中的换肤方案）
- `docs/PROJECT_PLAN.md` — 需求/功能清单/设计决策/测试清单/里程碑（单一产品文档）
- `README.md` — 运行说明

## 关键实现备忘
- 绘图模型：`scene[]` 对象数组 + `view{x,y,scale}`，每帧重绘；`undoStack/redoStack`。
- **选择/变换/删除**：`selectedIndex` 指向 `scene[]`；`selectObjectAt()` 复用 `hitTest()` 从顶层向下命中；`#selectionBox` 是 DOM 浮层，按对象外接框和 `view` 映射到屏幕并随 `rotation` 旋转；四角手柄缩放对象，顶部圆点旋转对象；实际变换使用 `transformBounds()` 的元素本体框，避免把选中框 padding 或邻近元素算进图片/文字尺寸；`Delete/Backspace` 删除选中对象前 `pushHistory()`。
- **贴图渲染**：工具栏 `image` 按钮触发隐藏文件选择器；`window paste` 读取第一张 `image/*`；载入时先裁掉透明/近白空边，再生成 `pendingImage` 跟随鼠标预览，单击后写入 `scene`。图片以 dataURL 存储，`imageCache` 负责加载和重绘完成后 `render()`。
- **文字样式**：文字对象保存 `{type:'text',text,x,y,color,fontSize,fontFamily,textAlign,opacity,runs}`；形状内文字额外保存 `label/labelColor/labelFontSize/labelFontFamily/labelRuns`；`runs/labelRuns` 记录局部选区的 `color/fontFamily`，可只改编辑框中选中的几个字；`FONT_OPTIONS` 提供离线字体栈与在线增强字体；`drawObject/objectBounds/#textInput` 均按对象字体、局部 runs、对齐和透明度渲染/测量。
- **文字编辑按键提示**：`#textHint` DOM 浮层(不进录制)显示「Shift+Enter 换行 · Enter 完成 · Esc 取消」，`syncTextHint()` 挂在 `render()` 里 + input 事件 + `commitText` 末尾，跟随输入框下方、贴底自动翻上方，输入框隐藏即消失。
- **文字编辑**：`editingTextIndex` 区分新建与编辑；文字编辑层是 `contenteditable`，支持局部富文本选区；文字提交后 `clearSelection()` 隐藏选中框；选择工具下单击只负责选中，拖动负责移动文字；双击命中文字或选中后按 Enter 调 `beginTextEdit()`，提交时替换原对象并进入撤销栈；Esc 调 `cancelTextInput()` 不改原对象。
- **文字编辑样式**：编辑已有文字时，点击左侧字体/字号/颜色/对齐/透明度控件不会触发输入框提前 blur 提交；若编辑框内有选中文本，**字体/颜色/字号**只作用于该选区（runs 模型支持这三项，2026-07-03 起字号纳入选区级）；**对齐/透明度**是整段属性，无论有无选区都作用于整段——`applyTextEditingPatch` 里 `runnable=!!(patch.color||patch.fontFamily||patch.fontSize)` 先判断再走 `wrapTextSelection`，勿去掉（历史教训：曾经任何补丁都先试选区包裹，有选区时字号/对齐点了静默无效）。**runs 混合字号支持**（2026-07-03 里程碑，符合 Word/PPT 式「有选区改选区、无选区改整体」直觉）：`normalizedTextRuns/runStyleAt/textLineChunks` 三件套的 run 结构新增 `fontSize` 字段与颜色/字体同级；新增 `lineMaxFontSize(o,i)`/`textLinesLayout(o)` 两个辅助——每行行高取该行内最大字号，`drawObject`/`objectBounds`/`transformBounds`/`drawShapeLabel`（文字对象与形状 label 共用同一套函数，因 `shapeLabelTextObject` 生成的仍是 `type:'text'` 对象）统一改走 `textLinesLayout`，不再假设行高恒定；`drawRichLine` 内同一行不同字号的字符按「以行内最大字号顶部为基准、小字下沉补差」近似对齐底部（非精确字体度量，但视觉效果接近 Word 的基线对齐，截图验证自然无重叠）；`wrapTextSelection`/`richTextToHtml`/`richTextFromInput` 三处 DOM↔runs 转换同步加 `data-font-size`/`style.font-size`（后者用 `世界单位×state.view.scale` 保证编辑态显示与世界坐标一致）；`applyResizeFromBox` 拖角缩放文本对象时，除顶层 `fontSize` 外也要按同一 `scale` 联动缩放 `runs[].fontSize`（否则局部放大的字和整体比例脱节）——这处最容易在未来重构中被漏掉，务必两处一起改。26 项无头端到端验证覆盖：选区级增删改、无选区回退整体默认、撤销重做、resize 联动、形状 label 独立分支（`editingLabelIndex`），全部通过。
- **手绘渲染**：`mulberry32(seed)` PRNG + `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`；形状对象带 `seed`（创建时随机），重绘按 seed 确定性生成扰动→稳定不闪。pen 为自由手绘，line 为两点直线对象。
- **录制设置**：`RATIOS`（含 `custom`，输出像素）/`BACKGROUNDS`（离线渐变、纯色、纹理、无）/`recConfig{ratio,customW,customH,bgIndex,bgCategory,frame,cardRadius,canvasPadding,showCamera,cameraSize,cameraShape,micDeviceId,cursorHighlight,cursorColor}`；状态机 idle→setup→recording→paused（见 `updateRecUI`）。
- **合成录制**：`recCanvas` 尺寸=`getRatioConfig()`；`drawRecFrame`=填背景→画白卡片(边距+圆角+阴影)→裁剪卡片内 `drawImage(board, 取景框区域→卡片)`→按设置叠加摄像头(镜像圆/方)与光标高亮。`captureStream(30)`+所选麦克风音轨→`MediaRecorder`。
- **取景框** `#recFrame`：setup 状态显示，可拖动+四角缩放并锁定 `ratioVal()`；其 `box-shadow 0 0 0 99999px` 实现外部变暗。
- 坐标：世界坐标 = (屏幕坐标 - view.xy) / view.scale。
- **幻灯片面板滚动**（2026-07-03 修复）：`.slidesList` 曾是 `overflow:auto`（横纵都开），幻灯片一多触发纵向滚动条时，非覆盖式滚动条环境下会把十几像素宽度从横向可用空间里扣掉，而 `.slideItem`/`.slideAddBtn`/`.slideInsertZone` 都是固定宽度，一收窄就溢出触发多余的横向滚动条（连锁反应）；改为 `overflow-y:auto;overflow-x:hidden` 从根上禁掉横向滚动。**注意**：`overflow-x:hidden` 是比参考站 excalicord.com 更稳妥的做法——实测参考站的 `.slide-strip-list` 其实也是 `overflow:auto`（横纵都开）且 14 张幻灯片时同样纵向溢出（`scrollHeight 592 > clientHeight 356`），它"看起来没有滚动条"只是因为测试机是 macOS 覆盖式滚动条（不占宽度）；换成 Windows/Linux 或 macOS「始终显示滚动条」设置，参考站会复现同样的连锁 bug。我们的 `overflow-x:hidden` 不依赖操作系统滚动条样式，更健壮，**不要为了「像参考站」把它改回 `auto`**。**滚动条视觉隐藏**（2026-07-03）：用户实测环境是经典/非覆盖式滚动条（占实际宽度，非 macOS 悬浮样式），在 76px 窄面板里显眼又抢空间；`.slidesList` 加 `scrollbar-width:none`（Firefox）+`-ms-overflow-style:none`（旧 Edge）+`::-webkit-scrollbar{width:0}`（Chrome/Edge/Safari）三件套隐藏滚动条视觉，鼠标滚轮/触控板/程序化 `scrollTop` 滚动能力不受影响（只是不显示滚动条本身）；无头验证 `list.clientWidth` 与无滚动条时的边界宽度完全一致（36px vs 36.0px，证明零宽度占用），滚动后点击缩略图仍正常选中。
- **删除按钮角标化**（2026-07-04）：用户反馈删除「✕」和缩略图数字挤在一起，参考站是清晰探出圆角外的"角标"效果。实测参考站真实定位（`top:-6px;right:-6px` 配合 0.7 缩放，视觉探出约 1.8px）后对齐：`.slideItem .slideDel` 从 `top:3px;right:3px`（内缩，与居中数字重叠）改为 `top:-5px;right:-5px`（探出边界外），加 1.5px 白色描边+阴影使其从背景中"浮起"。**踩坑记录**：负偏移一开始被 `.slidesList{overflow-x:hidden}` 咬掉一块——因为该列表此前为了消除滚动条被收紧到与缩略图等宽（无侧边余量），角标探出去正好撞上裁切边界；参考站没这问题是因为它的列表本来就比缩略图宽（留了余量）。修法：给 `.slidesList` 补 `padding:6px`，让探出的角标有地方待着而不被裁切。这条经验之前 AGENTS 里"以后加子元素宽度不要超过内容区"的提醒需要补充一句：**探出边界的角标类元素，需要检查列表本身是否留了对应方向的 padding 余量**。无头验证：角标探出上/右边界 ≥2px、与数字中心距离 > item 半宽（明显分开）、列表横向零溢出、点击删除仍生效，6/6 通过；截图确认视觉效果和参考站一致。
- **幻灯片面板尺寸**（2026-07-03，对齐 excalicord.com 观感）：用浏览器实测参考站真实盒模型后对齐——面板 `width:76px`（参考站 ~73px，注意上一版本一度改成 88px 是过度修正，已改回贴近参考站的窄尺寸）；`.slideItem`/`.slideAddBtn`/`.slideInsertZone` 从 40px 缩到 **36px**（参考站也是 36px），字号 14px→13px；面板 `gap` 10px→8px。这些数值改动不影响交互，14 张幻灯片端到端回归（选中/删除/插入按钮在变小后仍可点击）全部通过。
- **幻灯片**：`state.slides[{id,x,y,w,h}]`/`state.activeSlide` 是世界坐标矩形列表，与 `state.scene`/`undoStack` 无关（不可撤销，语义上是元数据而非画布内容）；面板编号(`i+1`)和左右方向键导航只看数组顺序、不依赖幻灯片的世界坐标物理位置，这是「插入到中间」功能的关键前提（不需要整体重排即可正确插入）。`addSlide()` 首张放原点、后续接在上一张右侧留 60 世界单位间隙；**`insertSlideAt(targetIndex)`**（2026-07-03 新增，解决用户反馈「插中间必须先删后面幻灯片」的可用性问题）：新幻灯片放在参照幻灯片(`targetIndex-1`，即插入点前一张)正下方（`y+h+60`），不重排任何已有幻灯片坐标；`state.slides.splice(targetIndex,0,slide)` 后若 `activeSlide>=targetIndex` 则整体 `+=1` 保持指向原选中对象，随后 `selectSlide(targetIndex)` 自动跳转选中新幻灯片（对齐 `addSlide()` 的既有习惯）；UI 是 `renderSlidePanel()` 里穿插在每两个 `.slideItem` 之间（含最前）的 `.slideInsertZone` 热区，默认几乎不可见、悬停才显示虚线+「+」，与 `.slideDel` 一样在 `recState!=='idle'` 时通过 `disabled` class 禁用（避免插入导致录制中的目标幻灯片索引错位）。23 项无头端到端验证覆盖：中间插入/最前插入的索引位移正确性、面板编号/选中态、setup 态下禁用、Undo 不受影响（幻灯片非画布内容，既有约定）。`selectSlide(i)` 是唯一的“选中并对焦”入口——内部调 `fitViewToRect()`（把 `state.view` 缩放/平移到让该矩形以 0.86 留白居中于视口）,若 `recState` 处于 setup/recording/paused 还会用 `worldToScreen` 把 `recConfig.frame` 精确设为该矩形的屏幕投影并 `applyFrameStyle()`；`enterSetup()` 有幻灯片时调 `selectSlide()` 取代 `showFrame()`，无幻灯片时行为不变（向后兼容）；`#recFrame` 手动拖拽在有幻灯片时被 guard 掉；比例变化钩子（`buildRatioGrid`/`customW`/`customH`）在有幻灯片时改调 `resizeSlidesToRatio()`（保持每张中心、按新比例重算宽高，同 `showFrame()` 的重适配思路）；`deleteSlide()` 仅 `recState==='idle'` 时可执行；幻灯片边框/序号标签是 `#slideFramesLayer` 内按 `data-slide-id` 增量 diff 的 DOM 浮层（`updateSlideFrames()`，挂在 `render()` 里，紧跟 `updateSelectionBox()`），和 `#selectionBox`/`#recFrame` 一样只在屏幕上叠加显示，从不写入 canvas，因此结构上不会进入 `drawRecFrame()` 的录制输出。

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-04 | 定稿版提升为主版本+准备部署 Render：用户真机验收满意，`git mv` 把 `index-v2.html`→`index.html`（主版本）、旧 `index.html`→`index-old.html`（归档）；同步更新文件地图/TODO 引用；why：让 https 部署的根路径直接是打磨过的新版，且顺带解决摄像头/录屏需要安全上下文的限制 |
| 2026-07-04 | 幻灯片删除按钮改角标样式(仅 index-v2)：对齐参考站——负偏移探出圆角边界外+白描边，与居中数字分开不挤；顺带修复负偏移被 overflow-x:hidden 裁切的问题(列表补 padding 留余量)；6项无头验证通过 |
| 2026-07-03 | 隐藏幻灯片面板滚动条视觉(仅 index-v2)：用户实测环境是经典滚动条（占宽度），在 76px 窄面板里很挤；用 scrollbar-width/-ms-overflow-style/::-webkit-scrollbar 三件套隐藏视觉但保留滚动能力；无头验证 clientWidth 零占用、滚动后交互仍正常 |
| 2026-07-03 | 幻灯片面板对齐 excalicord.com 尺寸(仅 index-v2)：用户反馈面板宽度/按钮显局促，实测参考站真实 CSS(面板~73px、按钮36px)后对齐——面板 88px→76px、按钮 40px→36px；同时发现参考站自己也有同样的纵向溢出（只是 macOS 覆盖式滚动条不可见），确认我们的 overflow-x:hidden 修复比参考站更健壮，予以保留 |
| 2026-07-03 | 修复幻灯片面板多余横向滚动条(仅 index-v2)：`.slidesList` 改 `overflow-x:hidden`（原横纵都 auto，纵向滚动条挤压横向空间导致固定宽子项溢出）；面板加宽 72px→88px 给滚动条留余量；无头验证 12 张幻灯片场景下横向零溢出 |
| 2026-07-03 | 幻灯片支持「插入到中间」(仅 index-v2)：用户反馈原来只能追加到末尾、插中间得先删后面的重做；新增 `insertSlideAt()` + 面板悬停热区，数组 splice 插入不重排世界坐标，23 项无头端到端验证通过 |
| 2026-07-03 | 新增选区级字号支持(仅 index-v2，独立里程碑)：编辑文字/形状 label 时「有选区改选区、无选区改整体」的直觉延伸到字号（此前只有颜色/字体支持），实现同一行内混合字号的测量/渲染/选中框/resize 缩放联动；26 项无头端到端验证全过，含视觉截图确认底部对齐无重叠 |
| 2026-07-03 | 修复编辑框内选中文字后改字号/对齐/透明度静默无效(仅 index-v2)：`wrapTextSelection` 只支持颜色/字体，但任何样式补丁都先被它吞掉；现仅颜色/字体走选区包裹，其余作用整段；颜色选区级行为回归通过 |
| 2026-07-03 | 文字编辑态新增按键提示浮层(仅 index-v2)：用户不知道换行要按 Shift+Enter；编辑时输入框旁显示「Shift+Enter 换行 · Enter 完成 · Esc 取消」，DOM 浮层不入录制 |
| 2026-07-03 | 美颜升级为肤色掩膜磨皮 + 设置内实时效果预览(仅 index-v2)：用户反馈 v1 柔焦是"全画面蒙雾"且无预览要录完才能看效果；v2 用 YCbCr 肤色检测只平滑皮肤(眼睛/头发/背景锐利)，设置弹窗加 180px 实时预览走与录制同一管线；量化验证肤色区 sd 21.4→0、蓝白区 66.4→65 |
| 2026-07-03 | 新增摄像头美颜磨皮(仅 index-v2)：设置滑杆 0~100%，柔焦原理(下采样模糊层按强度叠回)，GPU 友好不用 ctx.filter；量化验证磨皮 100% 纹理标准差 111→37.6 |
| 2026-07-03 | 录屏模式隐藏「画面比例」区块并中性化预览(仅 index-v2)：录屏按源原样录、比例设置本就不生效，UI 显示会误导用户；用户在方案1(诚实隐藏)与方案2(录屏按比例出片)中选了方案1 |
| 2026-07-02 | 真机反馈修复(仅 index-v2)：①头像底部边距 3%→6%，不再贴底被播放器控制栏盖住下缘；②提亮从 ctx.filter 改为 screen 混合白层(canvas filter 每帧软件渲染是卡顿元凶)；③摄像头帧兜底驱动合成，录静态窗口时头像不再冻结；④按用户要求精简录屏设置文案、删除 localhost 提示段；假流端到端回归全部通过 |
| 2026-07-02 | 录屏摄像头体验升级(仅 index-v2)：入镜位置四角可选+画面提亮滑杆(合成时 canvas filter，不改真实摄像头)+录屏「已入镜」提示(开始前顶部提示不入镜、录制中「📷 自检」画中画小窗跨 App 可见)；起因是用户看成品发现头像偏暗且录制中无法感知摄像头已入镜；假流端到端验证四角定位/白板回归全部通过 |
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
