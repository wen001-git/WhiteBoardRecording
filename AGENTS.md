> 目的：让任意 AI 工具/账号无缝接手本项目。　目标读者：下一个接手的 AI 或开发者。　如何阅读：先读本文（定位/运行/当前状态/下一步/文件地图/实现备忘），按需再点开 `docs/PROJECT_PLAN.md`；勿做全量代码扫描。

# AGENTS.md — 白板录制工具

## 一句话定位
白板录制工具：核心编辑器保持可独立运行的单 HTML，实现无限白板、幻灯片、角落摄像头、提词器和录制导出；商业化边界由轻量 Node 账号服务与 Neon 持久数据库承载。

## 运行 / 测试方式
```bash
cd /Users/Zhuanz/Claude/WhiteBoard
npm install
npm test
npm run build:static

# 仅测试静态入口/白板
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000

# 测试账号 API（先按 .env.example 配置环境变量）
npm start
```
> ⚠️ 摄像头/麦克风需要安全上下文（https 或 localhost）。直接 `file://` 双击会被多数浏览器拦摄像头，务必走 localhost 或部署到静态托管。

## 硬约束
- 白板编辑器继续保持为**独立单 HTML 应用**，HTML/CSS/JS 全内联、无前端构建依赖；账号服务不得侵入绘图/录制核心。
- 账号与设备授权只通过 `server/` 下的 Node API 和 Neon 实现；不得把账号、密码、数据库连接串、Cookie 密钥或管理令牌写入 Git。
- 公共 Static Site 必须由 `npm run build:static` 生成发布白名单，不能直接发布仓库根目录；受保护应用不能出现在公共发布目录。
- 仓库文档不记录独立 HTML 文件的商业版本归属。
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
- **商业化 MVP(2026-07-14)**：已完成静态登录/购买入口、统一 entitlement 层、30 秒录制限制与多水印、最多 3 张幻灯片、整屏裁剪/动态流动线条/幻灯片笔迹/完整贴纸分组等权限控制；已完成 Node + Neon 账号/设备服务、受保护应用响应和管理后台。账号默认 3 台设备，测试账号可设为 1 台；密码、停用、清空设备都会使旧会话失效。公共发布使用白名单构建，受保护内容不进入 Static Site。18 项自动测试已通过。
- **静态 Pro 账号临时方案(2026-07-15)**：按用户要求新增独立于 Neon/Node 的 `accounts.json` 静态登录链路；`index.html` 与 `whiteboard-pro.html` 可用 hash 账号登录解锁 Pro 且不限制设备数；新增 `account-admin1.html` 用于生成/合并/验证 `accounts.json`，不改 `account-admin.html` 后端管理页。10 个初始 Pro 账号已写入 `accounts.json`，明文清单保存在 `docs/STATIC_PRO_ACCOUNTS.md`。
- `whiteboard.html` 与初始 `whiteboard-pro.html` 已实现 M0~M3 + 迭代二（手绘风格 + 录制比例/背景/取景框）+ 迭代三（绘图样式面板、摄像头可拖拽缩放、更细真实手绘线条、完整录制设置）+ 贴图功能 + 指针选择/Delete 删除对象 + 菱形/直线工具 + 丰富文本样式 + 对象缩放/旋转（各自为独立单文件应用）。
- 迭代三录制设置已补齐并接入真实合成：比例含 `Custom` 自定义；背景含分类筛选、随机壁纸、离线程序纹理/渐变/纯色/无；白卡片支持圆角半径与画布边距；摄像头支持录制开关、大小、圆形/方形；麦克风下拉由 `populateDevices()` 填充；录制光标高亮支持开关和颜色。
- `drawRecFrame()` 已读取上述 `recConfig` 字段，导出画面会同步设置面板中的背景、白卡片边距/圆角、摄像头形状/大小/开关、光标高亮；提词器仍不入录像。
- 贴图对象保存为 `{type:'image',src,x,y,w,h}`（`src` 为 dataURL），导入/粘贴时会自动裁掉透明/近白空边；由 `imageCache` 缓存 `HTMLImageElement`；图片对象参与重绘、撤销/重做、橡皮擦命中、缩放平移和录制导出。
- **彩铅小人贴纸(2026-07-11~13)**：顶部工具栏图片按钮旁 `#stickerBtn` 弹出 `#stickerPopover`，贴纸数据为 `STICKER_GROUPS` 三分组：`男生` 14 个固定真实短发角色表情/动作、`女生` 14 个自然中长发低辫角色表情/动作、`综合` 保留第一版 8 个原创透明 PNG（无所不能、开心、疑惑、焦虑、灵感、低落、专注、庆祝）。女生组是独立女性角色结构：圆润脸型、自然侧分额发、后脑与低辫连贯，禁止用“男生短发加辫子”的改装方式；辫子可见性必须服从人物视角，正脸/近正脸显示左右两个低辫子，侧脸、转头或低头时只显示实际可见的一侧，不能把整组固定成单辫或机械对称双辫。嘴型/眼型按情绪分别设计，不统一张嘴，`喜极而泣` 也保持小眼睛而非大眼 anime 风。男生/女生新增表情含哭泣、笑着哭、喜极而泣、期待、失落、愣住、奔跑等；衣服颜色/款式允许变化以保留第一版的视觉丰富度，但发型/脸型保持角色一致；`女生·低落` 保留右侧三道漫画竖线，这是该情绪的关键视觉符号。女生新素材去色键后以透明高质量 WebP 内联，其他素材仍可为透明 PNG；均不新增外部运行时文件，保持单 HTML。点击贴纸仍调用 `beginPendingImage(sticker.src,sticker.w||240,sticker.h||240)`，复用现有图片对象流程，因此可在画布单击放置、拖动、缩放、删除、撤销/重做，并进入录制导出。贴纸弹窗与普通工具按钮高亮互斥：`openStickerPopover()` 会临时清掉 `.tool[data-tool]` 高亮，点击空白关闭时恢复 `state.tool` 对应高亮，点击普通工具时先隐藏贴纸弹窗再切工具，避免小人和铅笔等同时显示选中态。
- 选择工具 `select` 是默认工具；主工具栏顺序为 hand/select/text/ellipse/rect/diamond/arrow/line/pen/image/sticker/eraser，数字下标从 text 开始为 1~9（sticker 不占数字快捷键）；点击对象显示 DOM 选中框，可拖动对象、拖四角缩放、拖顶部圆点旋转，按 `Delete/Backspace` 删除选中对象并支持撤销/重做。选中框不画进 canvas，因此不进入录制导出。
- **动态流动线条(2026-07-11)**：左侧绘图属性面板新增「动态效果」组，`strokeMotion:'none'|'flow'` 与 `strokeStyle`（实线/虚线/点线）和 `roughness`（规整/手绘/粗糙）正交，可组合出“手绘 + 动态流动”“箭头 + 动态流动”“圆圈 + 动态流动”等效果；flow 按钮图标本身也是 SVG 动态虚线箭头（CSS `flowIconDash`，尊重 `prefers-reduced-motion`）。渲染时先画原始线条，再用 `drawFlowOverlay()` 叠一层按 `lineDashOffset` 移动的虚线高亮；只有存在 flow 对象时才用 `requestAnimationFrame` 持续重绘，动画帧调用 `render({skipSave:true})`，避免自动保存被动画刷屏。它画在 `board` canvas 内，白板录制会自然捕获；旧对象缺字段时默认静态。验证：内联 JS 语法通过；无头 Chromium 断言通过（动态效果面板显示、点击 flow 后状态/新对象字段为 `flow`、按钮图标动画生效、动画循环启动、无 console error）。
- 文字工具支持新建文字时设置字体、字号、左/中/右对齐和透明度；字体采用离线系统字体栈为主，网络可用时加载 Nunito / Lilita One / Comic Neue 增强；文字对象保存 `fontFamily/textAlign/opacity`，旧对象缺字段会 fallback。文字编辑态的 `#textInput` 无边框，提交后不自动保留选中框；选择工具下点选文字后可拖动移动，双击文字或选中后按 Enter 可重新编辑；Esc 取消编辑，清空提交会删除该文字。
- **文字编辑排版一致性修复(2026-07-10)**：双击已有文字进入编辑态时，`#textInput` 会用 canvas 同款 `measureRichLine()` 计算最长行宽并临时取消 `max-width:420px`，避免 DOM `contenteditable` 自动窄栏换行导致“未编辑/编辑中”排版不一致；编辑框行高同步为 canvas 的 `1.24`。新建文字仍保留原来的最大宽度约束；形状 label 编辑也会重置/同步输入框宽度，避免复用 DOM 元素时状态残留。验证：内联 JS 语法检查通过；无头 Chromium 页面断言通过（长文本 canvas 宽约 1210px，编辑态输入框宽约 1220px，`maxWidth:none`，保持 1 行）。
- 本轮自动验证：内联 JS 语法检查通过；文字编辑无边框、对象缩放/旋转关键标记检查通过；图片变换已改用元素本体框而不是带 padding 的选中框；录屏核心函数 diff 无命中。按用户反馈，已移除强制浏览器 review 规则，后续是否打开浏览器预览按改动风险和用户要求决定。
- 新增「幻灯片」多页录制功能：右侧常驻面板（同现有左侧样式面板视觉语言）可新增/删除/切换幻灯片；每张幻灯片是世界坐标矩形（`state.slides[]`，尺寸=创建时 `getRatioConfig()` 输出分辨率），录制时 `enterSetup()`/`selectSlide()` 会把 `state.view` 对焦到选中幻灯片并把 `recConfig.frame` 精确设为其屏幕投影矩形；录制/setup/paused 期间可用左右方向键或点击面板瞬间切换（无动画），空闲态方向键仅平移视图不影响 `recConfig.frame`（向后兼容无幻灯片场景）；比例设置变化时所有幻灯片按 `showFrame()` 同款“保持中心、按新比例重适配”逻辑联动；删除仅在 `recState==='idle'` 时允许（面板 ✕ 按钮同步禁用）；幻灯片边框/序号是 `#slideFramesLayer` 下的 `position:fixed` DOM 浮层（照抄 `#selectionBox` 模式），不进入 `state.scene`、结构上不可能被 `drawRecFrame()` 采样到；`state.slides`/`state.activeSlide` 已接入 `currentDoc()`/`applyDoc()` 持久化，旧文档缺字段时安全回退为空。
- **智能新增幻灯片 + 鸟瞰图(2026-07-10/11)**：`addSlide()` 先 `commitText()`，再用 `createSlideAtSmartPosition()` 创建幻灯片：无幻灯片或用户移动到远处空白区域时按当前 viewport 中心创建；连续点击新增、当前视野仍在 active slide 附近时，自动放到 active slide 右侧并通过 `findFreeSlideSlot()` 循环避开已有幻灯片，防止多张幻灯片叠加。`insertSlideAt(targetIndex)` 不再用智能空位，而是 deck 插入：新页放到前一张右侧，若目标位置已有后续幻灯片，则通过 `shiftSlidesAndContents()` 把目标及之后的幻灯片和中心落在这些幻灯片里的对象整体右移，保证右侧栏顺序、白板从左到右顺序、录制顺序一致。新增左下角 `#minimap` 鸟瞰图（缩放条上方、头像层级更高），显示内容边界/幻灯片/当前视口，点击或拖动只移动 `state.view.x/y`、不改变缩放；可折叠。它是 DOM 浮层，不进入录制，不默认显示坐标。验证：内联 JS 语法通过；无头 Chromium 断言通过（连续新增不重叠并向右排列、active 第 2 张新增到右侧空位、远处空白按当前视野创建、连续在 2/3 之间插入两张后白板标签从左到右为 1~5 且旧第 3 张内容跟随移动、小地图存在且头像层级更高）；静态核对录制路径只采样 `board`。
- **幻灯片绘画笔迹播放(2026-07-11)**：当前激活幻灯片旁新增「笔迹」控制按钮（`#slideRevealFloatBtn`，DOM 控制器不入录像）；点击后启动临时 `slideReveal` 状态，不写入 `currentDoc()`。动画在 `board` canvas 内完成：`render()` 先正常画完整内容，`drawSlideRevealOverlay()` 截取当前幻灯片区域生成彩色层，并用 `makeInkCanvasFromSnapshot()` 从暗色/低饱和像素提取线稿层，然后把幻灯片区域盖白，按左上到右下的斜向遮罩先显现线稿、再滞后显现颜色，最后自动清空状态。因为最终效果写在 `board` canvas 上，白板录制 `drawRecFrame()` 采样时会捕获该动态效果；切换幻灯片会停止旧幻灯片的播放。该方案是前端近似“铅笔逐步展开”，对文字/线条/形状/贴纸/图片都生效；自由画笔对象未来可再升级为真实路径逐笔重放。
- **笔迹按钮与录制框层级(2026-07-12)**：旧的 `.slideFrame` 内部「笔迹」按钮被绿色 `#recFrame`（z-index 56）遮挡，已改为全局 DOM 浮层 `#slideRevealFloatBtn`（z-index 58），由 `positionSlideRevealButton()` 固定在 active slide 右上角外侧；按钮保持原来的白色小按钮样式，不再染成幻灯片标题同色，且按钮右边缘与幻灯片右边框对齐、底部和幻灯片上边框留 4px 间距。`#slideFramesLayer`/`.slideFrame` 提升到 z-index 57，位于录制框之上、笔迹按钮之下；`applyFrameStyle()` 继续完整使用 `recConfig.frame`，不做 UI 偏移或缩短，所以屏幕框和最终视频取景都完整覆盖幻灯片，标题/笔迹按钮仍是 DOM 辅助 UI，不进入 `drawRecFrame()` 输出。窄屏时按钮可压缩为仅图标。
- **幻灯片面板尺寸选择(2026-07-11)**：右侧幻灯片面板标题下新增紧凑尺寸按钮(`#slideRatioBtn`)与弹出比例选择器(`#slideRatioPopover`)，复用录制设置同一份 `RATIOS/recConfig.ratio/customW/customH`；新增 `setRecordingRatio()`/`setCustomRecordingRatio()` 作为单一更新入口，录制设置与幻灯片面板双向同步，已有幻灯片沿用 `resizeSlidesToRatio()` 保持中心缩放。只暴露比例/自定义宽高，不复制背景/摄像头/麦克风等录制细项。弹层已改为 `position:fixed` 并由 `positionSlideRatioPopover()` 按按钮位置实时放到右侧面板左边，`.slidesPanel` 保持 `overflow:visible`、`.slidesList` 自己滚动，避免继承 `.props{overflow:auto}` 后把弹层裁掉导致用户以为点击无响应。验证：内联 JS 语法通过；无头 Chromium 断言通过（幻灯片面板选 9:16 同步录制设置并缩放幻灯片、录制设置选 4:3 回填面板、自定义比例双侧 custom UI 同步、尺寸按钮点击后菜单可见/在屏幕内/选择后收起）；静态核对录制路径仍只采样 `board`。
- **摄像头/麦克风隐私开关(2026-07-11)**：录制条新增紧凑图标按钮 `#mediaToggle`（绿点=硬件开启，灰点+斜杠=关闭），开启时通过 `enableUserMedia()` 请求摄像头+麦克风并显示头像预览，关闭时通过 `stopUserMedia()` 对 `mediaStream`/`recAudioStream` 的 tracks 全部 `stop()`、清空 `camVideo.srcObject`、隐藏头像，让 Mac 摄像头灯熄灭；欢迎页次按钮改为「先不用摄像头和麦克风，仅画板」且不再调用 `startMicOnly()`，因此不会偷偷占用麦克风。`recConfig.showCamera` 仍只表示“录制时是否合成摄像头”，不是硬件开关；硬件关闭时 `getRecordingAudioTracks()` 返回空数组，白板/录屏仍可录制但不合成头像、不混入麦克风。验证：内联 JS 语法通过；无头 Chromium mock 验证欢迎页授权/跳过、媒体开关 stop tracks/重启、权限拒绝保持关闭、媒体关闭时录制音轨为空。
- **录制画布默认边距(2026-07-12)**：`recConfig.canvasPadding` 默认值从 55 调整为 5，设置弹窗初始显示也同步为 `5PX`；why：手机竖屏录制时原默认白卡片外边距占用过多，压缩内容可视区域。用户仍可在录制设置里手动拉大边距。
- **录制条右上布局(2026-07-11)**：`.recbar` 从底部居中移到右上角并在中大屏与顶部工具栏顶边对齐（默认 `top:10px;right:70px`，在提词器按钮左侧），释放幻灯片下方中间写作/讲解空间；外层容器只负责定位/排列，不再绘制底色、边框或阴影，避免形成占面积的大白框；设置、摄像头/麦克风、红色录制按钮各自保留独立可点击视觉。`max-width:1500px` 时右侧留出幻灯片面板空间（`right:104px`），`max-width:1250px` 才降到工具栏下方右侧（`top:60px`）避免和顶部工具栏横向重叠；窄屏只压缩设置/媒体两个图标按钮，不压缩“取消/录制”等文字按钮。验证：内联 JS 语法通过；无头 Chromium 检查 1600×1000 和 1400×900 下录制条顶边对齐且不重叠，1200×850 下自动下移且不与工具栏/幻灯片面板重叠。
- **顶部工具栏紧凑化(2026-07-11)**：主工具栏从 `top:14px + 40px按钮 + 6px padding` 压到 `top:10px + 34px按钮 + 4px padding`，整体高度约 54px→44px，图标 20px→18px、快捷键角标 10px→9px，`#toolHelp` 同步上移；录制条顶边同步为 `top:10px`，小屏下移位置从 72px 调到 60px。验证：内联 JS 语法通过；无头 Chromium 检查 1600/1400/1200 视口下工具栏高度约 44px，录制条仍不与工具栏/幻灯片面板重叠。
- **右侧面板分层对齐(2026-07-11)**：右侧幻灯片面板 `.slidesPanel` 从 `top:80px` 下移到 `top:128px`，避免紧贴上方录制框；提词器面板 `#tele` 也改为 `top:128px;right:104px`，和右侧下方控制区同一条起始线，并避开 76px 宽幻灯片栏；`.slidesList` 的最大高度同步从 `calc(100vh - 305px)` 调到 `calc(100vh - 353px)`。验证：内联 JS 语法通过；静态核对 CSS 对齐值生效。
- 录制合成循环：白板模式用 `setInterval(1000/30)`；**录屏模式用屏幕轨 `MediaStreamTrackProcessor` 帧驱动**(Chrome/Edge),切到别的 App 后台仍满帧;无此 API 回退 `setInterval`(后台可能掉帧)。
- **录屏来源分流 + 隐私裁剪(2026-07-12)**：`enterScreenSetup()` 请求共享后读取 `videoTrack.getSettings().displaySurface`。`browser`（Chrome 标签页）与 `window`（窗口）使用完整源边界并立即调用 `startScreenRecording()`，因为 Chrome 分享后会自动切到目标页面，不能要求用户再返回白板确认；标签页不会包含浏览器栏，窗口则原样包含整个窗口。只有 `monitor`（整个屏幕）或无法识别来源时才进入 `#screenStage/#screenSnap` 冻结预览，用独立 `#screenCropFrame` 拖动/四角缩放后点右上录制条中的「确认区域并开始录制」；底部绿色重复按钮已移除，避免与浏览器共享条/macOS Dock 拥挤并保持唯一主操作。因此“只录某个窗口的一部分”的正确路径是选择整个屏幕后裁剪。裁剪使用会话级归一化 `screenCropNorm{x,y,w,h}`，不复用/不持久化白板 `recConfig.frame`；整屏默认从顶部 12% 以下开始，选区靠近顶部 6% 时显示隐私警告。`drawScreenFrame()` 按源当前尺寸换算像素裁剪，输出最长边≤1920且保持选区比例；预览舞台、绿色框和提示都是 DOM，不进入 `recCanvas`。
- **录屏停止收尾(2026-07-12)**：`stopRecording()` 增加 `recStopping/recStopHandled` 一次性守卫，停止前主动 `requestData()`，并在浏览器因“停止分享”漏发 `MediaRecorder.onstop` 时于 1.8 秒后用已收集 `recChunks` 兜底调用 `onRecStop()`；why：确保 Chrome 标签页/窗口共享结束后仍可靠弹出“录制完成”，同时避免 ended/stop 双重触发生成两次完成页。
- **帧驱动 & 防黑屏**:Chrome `MediaStreamTrackProcessor` 读屏幕轨,`drawScreenFrame(VideoFrame)` 帧到即画(切后台满帧、隐藏 video 也能录);无该 API 回退 `setInterval`。`#screenVideo` 仅取帧源、离屏隐藏。
- **录屏隐藏摄像头气泡**:`startScreenRecording` 设 `camWrap.style.visibility='hidden'`(仍解码可 drawImage,不被整屏录到 → 避免双重人脸),`stopRecording` 恢复。
- `#screenStage/#screenSnap` 现用于授权后的冻结预览，`#screenCropFrame` 是独立 DOM 取景框；不要改成实时铺满 `screenVideo`，否则用户选择当前显示器时会产生无限镜像。白板 `#recFrame` 与屏幕 `screenCropNorm` 必须继续分离。
- 本轮验证：内联 JS 语法、`git diff --check` 通过；本地浏览器确认设置源切换、隐私文案、裁剪框四角结构正常且无 console error。用户已于 2026-07-12 真机基本验收通过 Chrome 标签页/窗口录制、停止分享与完成页流程，暂未发现问题；整个屏幕裁剪成品抽帧、系统音频等细项仍可继续观察。
- **UI 视觉升级(2026-07-02)**:做了三套可交互换肤 demo(A 纸上工作室/B 导播台/C 精修淡雅)供用户对比,用户选定 **C 精修淡雅**,定稿为 **`index-v2.html`**;`index.html` 保持旧稳定版不动,另有备份 `backups/index-stable-2026-07-02.html`。C 与旧版差异**仅在 `<style>` 块**(JS 无差异):漂移色值归一到 `:root` 变量(选中框 `#6965db`→`var(--accent)`、面板激活 `#1f1b8f/#dedcff`→accent 变量、幻灯片边框 `#5b57d6`→变量)、双层柔和阴影、计时器/缩放百分比/快捷键角标用 `--mono` 等宽栈、`:focus-visible` 焦点环、`prefers-reduced-motion` 支持、工具按压/色块 hover 微交互。无头 Chrome 回归:零 JS 错误、绘制/面板/设置弹窗正常、录制采样像素纯白。两套未选中方案已按用户要求归档为 `backups/demo-*-unselected-2026-07-02.html`(防误用),`demo-refine.html` 因与 index-v2 内容重复已删除;仓库根只保留 `index.html`(旧)与 `index-v2.html`(新)。
- **录屏摄像头体验升级(2026-07-02,仅 index-v2.html)**:①`recConfig` 新增 `cameraPosition('tl|tr|bl|br',默认 br)` 与 `cameraBrightness(100~140,默认 115)`;②`drawScreenFrame` 入镜位置按 cameraPosition 四角化(原硬编码右下;左右/顶边距 3%,**底部边距 6%**——避免头像贴底被播放器控制栏盖住下缘),提亮实现为**头像路径上叠 `screen` 混合白色薄层**(`camBrightAlpha()`,GPU 合成;⚠️ 勿改回 `ctx.filter`——canvas filter 每帧落软件渲染,真机实测录制卡顿),`drawScreenFrame`/`drawRecFrame` 两处均生效;③设置弹窗摄像头段新增「入镜位置」四选 seg(`data-camera-pos`)与「画面提亮」滑杆,预览圆点随位置联动;④录屏「已入镜」提示:`#camCueHint` 顶部提示在点「完成」到授权期间显示、`startScreenRecording` 第一行隐藏(不入镜),取消也隐藏;录制条新增「📷 自检」按钮(`#selfCheckBtn`,仅 screen 源+摄像头开+`PIP_OK` 时显示),点击开关 `documentPictureInPicture` 置顶小窗(实时镜像画面+REC红点+「录整屏会入镜」警示,降级 `camVideo.requestPictureInPicture`),`stopRecording` 自动关闭。⑤**卡顿修复**:录屏合成原先只由屏幕轨帧驱动,录静态窗口时屏幕轨长时间不出帧→头像冻结;现摄像头帧兜底驱动合成(`startCamPump` 里 `lastCompositeTs` 距上次合成 >40ms 才补画,避免双倍绘制)。⑥设置弹窗录屏说明按用户反馈精简为一句话,删除「录屏需用 localhost/https…」提示段;「画面比例」区块加 `.board-only`(录屏是原样录、比例由源决定,该设置只对白板模式生效),`updatePreview` 在 `source==='screen'` 时改用中性 16:9 白卡片预览(不套比例/壁纸装饰)——若未来想让录屏也按比例出片(缩放居中+补底),需改 `startScreenRecording` 的 `screenOut` 与 `drawScreenFrame`,当时评估为方案2未做。⑦无头验证(canvas 假流 mock getUserMedia/getDisplayMedia 全 DOM 驱动端到端):tl/br 两角成品视频抽帧断言摄像头只出现在指定角(含新边距公式)、白板模式出片回归、设置 UI 渲染,全部零 JS 错误。⑧**美颜磨皮 v2**(2026-07-03,v1 柔焦被用户否决——全画面雾面感):`recConfig.cameraSmooth 0~100(默认0=关)` + 设置「美颜(磨皮)」滑杆;实现为**肤色掩膜磨皮**:`skinSmoothInto()` 在固定 200px 工作画布(`willReadFrequently`)上盒式模糊(分离式 O(n),半径6)得柔化层,逐像素按 YCbCr 肤色软掩膜(Cb 77~127 / Cr 133~173,`fxRamp` 软边界)混回——**只平滑皮肤,眼睛/头发/背景保持锐利**;每帧 ~1-3ms CPU,勿改成 ctx.filter。两种录制模式经 `drawCamBeautified()` 共用。**设置弹窗新增实时效果预览**:摄像头段 `#camFxPreview`(180px canvas,rAF 循环,弹窗关闭自动停),走与录制完全相同的 drawCamBeautified+camBrightAlpha 管线(所见即所录),拖提亮/磨皮/形状立即可见。量化验证:上半肤色棋盘/下半蓝白棋盘假摄像头,磨皮100% 肤色区 sd 21.4→0.0、蓝白区 66.4→65.0(边缘保持)。
- ⚠️ 未验证(需真机授权,无头无法授予屏幕/摄像头):录屏裁剪是否准、切 App 是否满帧不冻结、脸在角落、麦克风+系统声音、mp4 可播;以及白板模式真实录制产物。
- **定稿版提升为主版本 + 部署上线(2026-07-04)**:用户真机验收满意后，`git mv index.html index-old.html && git mv index-v2.html index.html`——**上面所有历史记录里提到的 `index-v2.html` 现在就是 `index.html`**（旧稳定版归档为 `index-old.html`，内容同 `backups/index-stable-2026-07-02.html`）。部署到 Render（Static Site，Publish Directory=仓库根，零构建）：根路径 `/` 现在服务的是新版内容，`index-old.html` 仍可通过显式路径访问。https 环境顺带解决了摄像头/屏幕录制需要安全上下文的限制（不再依赖 localhost）。

## 下一步 TODO
- [ ] Render Web Service 补齐 `ALLOWED_ORIGINS=https://record.leewen.work,http://localhost:8000`，确认 Node / Oregon / Free / `/health`，首次部署后访问健康检查。
- [ ] 配置 `auth.record.leewen.work` 到账号服务、`record.leewen.work` 到 Static Site；在自定义域名生效后验证 Secure Cookie 登录。
- [ ] 用管理后台创建一个 1 台设备测试账号和一个默认 3 台设备账号，真机验证超限、停用、改密、清空设备及重新登录。
- [ ] 真机验收免费权限：25 秒提醒、30 秒自动完成、多水印、第四张幻灯片及各受限功能统一弹出购买窗口；再用授权账号验证限制全部解除。
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
- 根目录 HTML — 登录/购买入口、管理页与可独立运行的白板应用；不要在文档中标注各应用文件的商业版本归属。
- `accounts.json` / `account-admin1.html` — 临时静态 Pro 账号文件与本地生成工具；只保存哈希，明文账号清单在 `docs/STATIC_PRO_ACCOUNTS.md`，正式付费后应迁回后端账号体系。
- `server/` — Node 账号 API、Neon schema、密码/会话/设备授权。
- `scripts/build-static.mjs` — Static Site 发布白名单构建，产物目录 `.render-static/` 不提交。
- `tests/` — 账号 API、设备限制、权限、发布白名单和内联 JS 自动测试。
- `render.yaml` / `.env.example` — Render Blueprint 与无密钥环境变量模板。
- `index-old.html` — 2026-07-04 前的旧稳定版（原 `index.html`），仅作历史备用，**勿在其上开发**
- `backups/` — 历史归档，**均为非活跃文件，勿在其上开发**：`index-stable-2026-07-02.html`（定稿前稳定版备份，内容同 `index-old.html`）、`demo-paper-unselected-2026-07-02.html` / `demo-console-unselected-2026-07-02.html`（未选中的换肤方案）
- `docs/PROJECT_PLAN.md` — 需求/功能清单/设计决策/测试清单/里程碑（单一产品文档）
- `README.md` — 运行说明

## 关键实现备忘
- 绘图模型：`scene[]` 对象数组 + `view{x,y,scale}`，每帧重绘；`undoStack/redoStack`。
- **选择/变换/删除**：`selectedIndex` 指向 `scene[]`；`selectObjectAt()` 复用 `hitTest()` 从顶层向下命中；`#selectionBox` 是 DOM 浮层，按对象外接框和 `view` 映射到屏幕并随 `rotation` 旋转；四角手柄缩放对象，顶部圆点旋转对象；实际变换使用 `transformBounds()` 的元素本体框，避免把选中框 padding 或邻近元素算进图片/文字尺寸；`Delete/Backspace` 删除选中对象前 `pushHistory()`。
- **贴图渲染**：工具栏 `image` 按钮触发隐藏文件选择器；`window paste` 读取第一张 `image/*`；载入时先裁掉透明/近白空边，再生成 `pendingImage` 跟随鼠标预览，单击后写入 `scene`。图片以 dataURL 存储，`imageCache` 负责加载和重绘完成后 `render()`。
- **文字样式**：文字对象保存 `{type:'text',text,x,y,color,fontSize,fontFamily,textAlign,opacity,runs}`；形状内文字额外保存 `label/labelColor/labelFontSize/labelFontFamily/labelRuns`；`runs/labelRuns` 记录局部选区的 `color/fontFamily`，可只改编辑框中选中的几个字；`FONT_OPTIONS` 提供离线字体栈与在线增强字体；`drawObject/objectBounds/#textInput` 均按对象字体、局部 runs、对齐和透明度渲染/测量。
- **文字编辑按键提示**：`#textHint` DOM 浮层(不进录制)显示「Enter 换行 · 点击外部完成 · Esc 取消」，`syncTextHint()` 挂在 `render()` 里 + input 事件 + `commitText` 末尾，跟随输入框下方、贴底自动翻上方，输入框隐藏即消失。
- **文字编辑**：`editingTextIndex` 区分新建与编辑；文字编辑层是 `contenteditable`，支持局部富文本选区；编辑中 `Enter` 通过 `insertTextInputNewline()` 插入 `<br>` + 零宽光标锚点（提交时 `richTextFromInput()` 清理 `\u200B` 并保留 `\n`），点击编辑框外部提交，Esc 调 `cancelTextInput()` 不改原对象；文字提交后 `clearSelection()` 隐藏选中框；选择工具下单击只负责选中，拖动负责移动文字；双击命中文字或选中后按 Enter 调 `beginTextEdit()`。
- **文字编辑样式**：编辑已有文字时，点击左侧字体/字号/颜色/对齐/透明度控件不会触发输入框提前 blur 提交；若编辑框内有选中文本，**字体/颜色/字号**只作用于该选区（runs 模型支持这三项，2026-07-03 起字号纳入选区级）；**对齐/透明度**是整段属性，无论有无选区都作用于整段——`applyTextEditingPatch` 里 `runnable=!!(patch.color||patch.fontFamily||patch.fontSize)` 先判断再走 `wrapTextSelection`，勿去掉（历史教训：曾经任何补丁都先试选区包裹，有选区时字号/对齐点了静默无效）。`wrapTextSelection()` 现在按 DOM selection 换算字符 offset，再追加覆盖性的 run 并重绘 `#textInput`，同时恢复原选区；offset 计算必须走 `serializedInputText(range.cloneContents())`，与 `richTextFromInput()` 同样处理 `<br>`/`DIV`/`\u200B`，不要改回 `Range.toString()`（历史教训：多行、多 span 文本里会把用户选中的「留给自己」漂移到前面的「代人」）或 `range.extractContents()` + 嵌套 span（历史教训：选中文字改成红色后，再点黄/绿等其他颜色时容易被旧 span/失效 range 吞掉，看起来无法二次改色）。**runs 混合字号支持**（2026-07-03 里程碑，符合 Word/PPT 式「有选区改选区、无选区改整体」直觉）：`normalizedTextRuns/runStyleAt/textLineChunks` 三件套的 run 结构新增 `fontSize` 字段与颜色/字体同级；新增 `lineMaxFontSize(o,i)`/`textLinesLayout(o)` 两个辅助——每行行高取该行内最大字号，`drawObject`/`objectBounds`/`transformBounds`/`drawShapeLabel`（文字对象与形状 label 共用同一套函数，因 `shapeLabelTextObject` 生成的仍是 `type:'text'` 对象）统一改走 `textLinesLayout`，不再假设行高恒定；`drawRichLine` 内同一行不同字号的字符按「以行内最大字号顶部为基准、小字下沉补差」近似对齐底部（非精确字体度量，但视觉效果接近 Word 的基线对齐，截图验证自然无重叠）；`wrapTextSelection`/`richTextToHtml`/`richTextFromInput` 三处 DOM↔runs 转换同步加 `data-font-size`/`style.font-size`（后者用 `世界单位×state.view.scale` 保证编辑态显示与世界坐标一致）；`applyResizeFromBox` 拖角缩放文本对象时，除顶层 `fontSize` 外也要按同一 `scale` 联动缩放 `runs[].fontSize`（否则局部放大的字和整体比例脱节）——这处最容易在未来重构中被漏掉，务必两处一起改。26 项无头端到端验证覆盖：选区级增删改、无选区回退整体默认、撤销重做、resize 联动、形状 label 独立分支（`editingLabelIndex`），全部通过。
- **手绘渲染**：`mulberry32(seed)` PRNG + `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`；形状对象带 `seed`（创建时随机），重绘按 seed 确定性生成扰动→稳定不闪。pen 为自由手绘，line 为两点直线对象。
- **绘图样式**：绘图对象可带 `strokeStyle`（实线/虚线/点线）、`roughness`（规整/手绘/粗糙）和 `strokeMotion`（静态/动态流动）。`strokeMotion:'flow'` 是叠加层，不替代原始线条，因此可以和手绘/虚线/箭头/圆圈组合；`render()` 内的 flow 动画帧必须保持 `skipSave:true`，勿改成普通保存重绘。
- **录制设置**：`RATIOS`（含 `custom`，输出像素）/`BACKGROUNDS`（离线渐变、纯色、纹理、无）/`recConfig{ratio,customW,customH,bgIndex,bgCategory,frame,cardRadius,canvasPadding,showCamera,cameraSize,cameraShape,micDeviceId,cursorHighlight,cursorColor}`；状态机 idle→setup→recording→paused（见 `updateRecUI`）。注意 `recConfig.showCamera` 只控制合成画面是否叠加摄像头，硬件占用由 `#mediaToggle`/`enableUserMedia()`/`stopUserMedia()` 控制。
- **合成录制**：`recCanvas` 尺寸=`getRatioConfig()`；`drawRecFrame`=填背景→画白卡片(边距+圆角+阴影)→裁剪卡片内 `drawImage(board, 取景框区域→卡片)`→按设置叠加摄像头(镜像圆/方)与光标高亮。`captureStream(30)`+`getRecordingAudioTracks()` 返回的麦克风音轨→`MediaRecorder`；若用户通过隐私开关关闭硬件，`getRecordingAudioTracks()` 返回空数组且不会自动重新请求麦克风。
- **取景框** `#recFrame`：setup 状态显示，可拖动+四角缩放并锁定 `ratioVal()`；其 `box-shadow 0 0 0 99999px` 实现外部变暗。
- 坐标：世界坐标 = (屏幕坐标 - view.xy) / view.scale。
- **幻灯片面板滚动**（2026-07-03 修复）：`.slidesList` 曾是 `overflow:auto`（横纵都开），幻灯片一多触发纵向滚动条时，非覆盖式滚动条环境下会把十几像素宽度从横向可用空间里扣掉，而 `.slideItem`/`.slideAddBtn`/`.slideInsertZone` 都是固定宽度，一收窄就溢出触发多余的横向滚动条（连锁反应）；改为 `overflow-y:auto;overflow-x:hidden` 从根上禁掉横向滚动。**注意**：`overflow-x:hidden` 是比参考站 excalicord.com 更稳妥的做法——实测参考站的 `.slide-strip-list` 其实也是 `overflow:auto`（横纵都开）且 14 张幻灯片时同样纵向溢出（`scrollHeight 592 > clientHeight 356`），它"看起来没有滚动条"只是因为测试机是 macOS 覆盖式滚动条（不占宽度）；换成 Windows/Linux 或 macOS「始终显示滚动条」设置，参考站会复现同样的连锁 bug。我们的 `overflow-x:hidden` 不依赖操作系统滚动条样式，更健壮，**不要为了「像参考站」把它改回 `auto`**。**滚动条视觉隐藏**（2026-07-03）：用户实测环境是经典/非覆盖式滚动条（占实际宽度，非 macOS 悬浮样式），在 76px 窄面板里显眼又抢空间；`.slidesList` 加 `scrollbar-width:none`（Firefox）+`-ms-overflow-style:none`（旧 Edge）+`::-webkit-scrollbar{width:0}`（Chrome/Edge/Safari）三件套隐藏滚动条视觉，鼠标滚轮/触控板/程序化 `scrollTop` 滚动能力不受影响（只是不显示滚动条本身）；无头验证 `list.clientWidth` 与无滚动条时的边界宽度完全一致（36px vs 36.0px，证明零宽度占用），滚动后点击缩略图仍正常选中。
- **删除按钮角标化**（2026-07-04）：用户反馈删除「✕」和缩略图数字挤在一起，参考站是清晰探出圆角外的"角标"效果。实测参考站真实定位（`top:-6px;right:-6px` 配合 0.7 缩放，视觉探出约 1.8px）后对齐：`.slideItem .slideDel` 从 `top:3px;right:3px`（内缩，与居中数字重叠）改为 `top:-5px;right:-5px`（探出边界外），加 1.5px 白色描边+阴影使其从背景中"浮起"。**踩坑记录**：负偏移一开始被 `.slidesList{overflow-x:hidden}` 咬掉一块——因为该列表此前为了消除滚动条被收紧到与缩略图等宽（无侧边余量），角标探出去正好撞上裁切边界；参考站没这问题是因为它的列表本来就比缩略图宽（留了余量）。修法：给 `.slidesList` 补 `padding:6px`，让探出的角标有地方待着而不被裁切。这条经验之前 AGENTS 里"以后加子元素宽度不要超过内容区"的提醒需要补充一句：**探出边界的角标类元素，需要检查列表本身是否留了对应方向的 padding 余量**。无头验证：角标探出上/右边界 ≥2px、与数字中心距离 > item 半宽（明显分开）、列表横向零溢出、点击删除仍生效，6/6 通过；截图确认视觉效果和参考站一致。
- **幻灯片面板尺寸**（2026-07-03，对齐 excalicord.com 观感）：用浏览器实测参考站真实盒模型后对齐——面板 `width:76px`（参考站 ~73px，注意上一版本一度改成 88px 是过度修正，已改回贴近参考站的窄尺寸）；`.slideItem`/`.slideAddBtn`/`.slideInsertZone` 从 40px 缩到 **36px**（参考站也是 36px），字号 14px→13px；面板 `gap` 10px→8px。这些数值改动不影响交互，14 张幻灯片端到端回归（选中/删除/插入按钮在变小后仍可点击）全部通过。
- **幻灯片**：`state.slides[{id,x,y,w,h}]`/`state.activeSlide` 是世界坐标矩形列表，与 `state.scene`/`undoStack` 无关（不可撤销，语义上是元数据而非画布内容）；面板编号(`i+1`)和左右方向键导航只看数组顺序。`addSlide()` 通过 `createSlideAtSmartPosition()` 先提交正在编辑的文字：无幻灯片或当前视野远离 active slide 时以 viewport 中心创建；当前视野仍主要覆盖 active slide 时新页排到 active slide 右侧，并用 `rectsOverlap/slideOverlapsAny/findFreeSlideSlot` 自动避开已有幻灯片。`insertSlideAt(targetIndex)` 通过 `createSlideForDeckInsert()` 走线性 deck 插入：新页放到前一张右侧；如果目标位置已有后续幻灯片，则 `shiftSlidesAndContents(startIndex,dx,0)` 会基于移动前的后续幻灯片矩形，把这些幻灯片以及中心落在其中的 `state.scene` 对象一起右移，避免右侧栏编号与白板从左到右编号倒序。右侧面板标题下有 `#slideRatioBtn` 尺寸入口，弹出的 `#slideRatioPopover` 与录制设置比例网格共用 `setRecordingRatio()`/`setCustomRecordingRatio()`，更改比例会同步录制设置并对现有幻灯片执行 `resizeSlidesToRatio()`。UI 是 `renderSlidePanel()` 里穿插在每两个 `.slideItem` 之间（含最前）的 `.slideInsertZone` 热区，默认几乎不可见、悬停才显示虚线+「+」，与 `.slideDel` 一样在 `recState!=='idle'` 时通过 `disabled` class 禁用。`selectSlide(i)` 是唯一的“选中并对焦”入口——内部调 `fitViewToRect()`（把 `state.view` 缩放/平移到让该矩形以 0.86 留白居中于视口）,若 `recState` 处于 setup/recording/paused 还会用 `worldToScreen` 把 `recConfig.frame` 精确设为该矩形的屏幕投影并 `applyFrameStyle()`；`enterSetup()` 有幻灯片时调 `selectSlide()` 取代 `showFrame()`，无幻灯片时行为不变（向后兼容）；`#recFrame` 手动拖拽在有幻灯片时被 guard 掉；比例变化钩子（`buildRatioGrid`/`customW`/`customH`）在有幻灯片时改调 `resizeSlidesToRatio()`（保持每张中心、按新比例重算宽高，同 `showFrame()` 的重适配思路）；`deleteSlide()` 仅 `recState==='idle'` 时可执行；幻灯片边框/序号标签是 `#slideFramesLayer` 内按 `data-slide-id` 增量 diff 的 DOM 浮层（`updateSlideFrames()`，挂在 `render()` 里，紧跟 `updateSelectionBox()`），和 `#selectionBox`/`#recFrame` 一样只在屏幕上叠加显示，从不写入 canvas，因此结构上不会进入 `drawRecFrame()` 的录制输出。

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-15 | 新增静态 Pro 账号临时方案：`accounts.json` 保存 10 个 hash 账号，`account-admin1.html` 管理/生成静态账号，`index.html`/`whiteboard-pro.html` 支持静态登录；why：用户需要立刻发放不限制设备的 Pro 登录账号，且不等待 Neon 后端账号任务完成 |
| 2026-07-14 | 完成商业化 MVP：新增静态登录/购买入口、统一免费权限与水印、Node + Neon 账号设备授权、管理后台、受保护应用响应及 Static Site 发布白名单，并以 18 项自动测试覆盖核心安全和权限路径；why：在保留独立 HTML 编辑器的同时建立可人工售卖、默认 3 台设备的最小付费闭环 |
| 2026-07-14 | 调整站点入口结构：保留两个可独立运行的白板 HTML 文件，新建轻量 `index.html` 处理根路径跳转，并明确不在仓库文档记录文件的商业版本归属；why：支持两份应用独立演进，同时避免公开内部版本映射信息 |
| 2026-07-13 | 按人物视角修正女生 14 张彩铅贴纸的辫子可见性：正脸/近正脸显示左右两个低辫子，侧脸/转头/低头按遮挡只显示可见一侧，并保持原有情绪、衣服及综合组不变；why：修复新版整组固定为单辫、与真实人物视角不符的问题 |
| 2026-07-12 | 整体重绘女生 14 张彩铅情绪贴纸：改为自然中长发侧马尾与独立女性脸型，按情绪设计不同嘴型/眼型，并保留低落三道漫画竖线；素材改为透明高质量 WebP 内联，综合第一版不变；why：修复部分女生看起来像“男生短发加辫子”的不自然角色设计，同时控制单 HTML 体积 |
| 2026-07-12 | 移除整个屏幕裁剪页底部绿色「确认区域并开始录制」重复按钮，只保留右上录制条的红色主按钮并更新操作提示；why：建立唯一明确的下一步操作，同时避免按钮被浏览器共享条或 macOS Dock 挤压遮挡 |
| 2026-07-12 | 记录用户真机基本验收：Chrome 标签页/窗口自动录制及停止分享完成页暂未发现问题；why：让后续接手者区分已经真机跑通的主流程与仍需继续观察的细项 |
| 2026-07-12 | 按共享来源简化录屏流程：Chrome 标签页/窗口分享后自动开始录制，只有整个屏幕保留绿色区域裁剪；why：浏览器分享后会自动切到目标标签页或窗口，用户无法意识到还需返回白板做第二次确认 |
| 2026-07-12 | 修复 Chrome 标签页/窗口停止分享后不弹录制完成页：裁剪页强化“尚未开始/确认开始”提示，setup 阶段停止分享会解释无视频；真正录制后的停止增加 requestData、一次性收尾和 onstop 超时兜底；why：兼容用户从 Chrome 分享条停止录制，并避免误把“已分享”理解成“已开始白板录制” |
| 2026-07-12 | 新增录屏隐私裁剪预览：授权后用独立绿色框确认最终区域，标签页默认全选，窗口/整屏默认避开顶部并在靠近顶部时警告；why：让浏览器标签、网址和系统菜单从源头不进入最终视频，同时不影响白板/幻灯片取景框 |
| 2026-07-12 | 修复笔迹按钮样式与录制框遮挡：按钮保持原白色小按钮并固定在幻灯片右上外侧，右边缘与幻灯片右边框对齐；幻灯片标题层提升到录制框之上，录制框尺寸恢复完整不偏移；why：露出标题/笔迹按钮，同时避免用户误以为幻灯片内容或最终视频取景被裁掉 |
| 2026-07-12 | 调整录制画布默认边距为 5PX：同步修改设置弹窗初始值和 `recConfig.canvasPadding` 默认值；why：减少手机竖屏录制时白卡片外边距占用，让内容区域更大 |
| 2026-07-11 | 新增幻灯片绘画笔迹播放：激活幻灯片边框新增「笔迹」按钮，播放时用 canvas 截图生成线稿层/彩色层并按左上到右下斜向遮罩逐步显现；why：让录制时能一键获得类似铅笔一笔一笔画出内容的动态效果 |
| 2026-07-11 | 扩展彩铅小人贴纸工具箱为分组表情包：保留第一版 8 个「综合」贴纸，同时新增男生/女生各 14 个固定发型角色表情（含哭泣、笑着哭、喜极而泣、期待、失落、愣住、奔跑等）；why：满足“同一角色一套表情”需求，同时不删除用户喜欢的第一版素材 |
| 2026-07-11 | 新增彩铅小人贴纸工具箱：顶部工具栏新增贴纸按钮，内置 8 个由第一版生成图裁切而来的透明 PNG 情绪小人并复用图片放置/缩放/录制流程；why：让用户在白板讲解中快速表达人物情绪和故事状态，同时保持单 HTML 无外部素材依赖 |
| 2026-07-11 | 修复文字选区改色后选区漂移：DOM selection offset 改用与 `richTextFromInput()` 一致的序列化逻辑，不再依赖浏览器 `Range.toString()`；why：避免用户选中后面的文字改色时，系统错误选中前面的字 |
| 2026-07-11 | 修复文字选区连续改色失效：`wrapTextSelection()` 改为按字符区间写入覆盖性 runs 并恢复选区，不再用 DOM 嵌套 span；why：避免文字改成红色后无法再改成黄色/绿色等其他颜色 |
| 2026-07-11 | 去掉录制条外层大框：`.recbar` 外层改为透明无边框无阴影，只保留三个独立按钮本身；why：减少右上区域视觉占用，让白板内容更透气 |
| 2026-07-11 | 压缩顶部工具栏垂直高度：主工具按钮改为 34px、工具栏 padding 改为 4px、整体顶边上移；why：给小屏 Mac 的白板编辑区域多留垂直空间 |
| 2026-07-11 | 统一右侧控制区层级：录制条外壳改为与左侧属性面板一致的矩形浮层，幻灯片面板和提词器面板下移到 128px 起始线；why：减少右上控件拥挤感，让录制/幻灯片/提词器形成清晰的上下层次 |
| 2026-07-11 | 将录制条从底部居中移到右上角并与顶部工具栏对齐：宽屏位于提词器按钮左侧，中等屏保持顶边对齐并给幻灯片面板留空间；why：释放用户主要视野的中下部空间，避免小屏幕上顶部工具栏和底部录制条共同挤压内容 |
| 2026-07-11 | 新增动态流动线条效果：绘图样式增加独立 `strokeMotion:'flow'`，可与手绘/箭头/圆圈等组合，canvas 叠加移动虚线高亮且录制可捕获；why：让箭头方向更明显、圆圈/形状在讲解视频中更能聚焦观众注意 |
| 2026-07-11 | 新增摄像头/麦克风隐私开关并压缩为图标按钮：录制条旁 `#mediaToggle` 可真正停止/重启用户媒体 tracks，欢迎页「仅画板」不再请求麦克风；why：让用户能明确熄灭摄像头灯并停止麦克风占用，同时不占用录制条空间 |
| 2026-07-11 | 调整文字编辑按键习惯：编辑中 `Enter` 改为直接换行，点击编辑框外部完成提交，提示文案同步更新；why：长段文字输入更接近普通用户习惯，避免误按 Enter 导致提前提交 |
| 2026-07-11 | 修复中间插入幻灯片后白板标签空间顺序与右侧栏编号不一致：`insertSlideAt()` 改为 deck 插入，必要时把后续幻灯片和其内部对象整体右移；why：幻灯片是线性页面，用户预期右侧栏顺序、白板从左到右顺序、录制顺序一致 |
| 2026-07-11 | 修复幻灯片尺寸按钮点击看似无响应：弹层改为 fixed 浮层并按按钮实时定位到右侧面板左边，面板本体不再裁切弹层，按钮补充下拉提示和 `aria-expanded`；why：此前弹层会被继承自 `.props` 的 overflow 裁掉，用户点击后看不到菜单 |
| 2026-07-11 | 在幻灯片面板新增尺寸选择入口并与录制比例双向同步：复用 `RATIOS/recConfig`，抽出 `setRecordingRatio()`/`setCustomRecordingRatio()`，已有幻灯片保持中心等比缩放；why：降低新用户学习成本，避免用户忘记去录制设置里选择幻灯片形状 |
| 2026-07-10 | 将幻灯片新增升级为智能防重叠：连续新增时自动排到 active slide 右侧空位，远处空白仍按当前视野创建，插入中间保持数组顺序但不重排旧幻灯片；why：保留“当前位置新增”的直觉，同时解决连续新增多张幻灯片叠加的问题 |
| 2026-07-10 | 修复新增幻灯片位置并新增鸟瞰图：幻灯片新增/插入改为以当前视野中心创建并先提交正在编辑的文字；左下角新增可折叠、可点击/拖动的小地图，显示内容/幻灯片/当前视口且不进入录制；why：避免用户在白板任意位置写完内容后新增幻灯片时视角跳走、内容看似消失，同时提供无限白板的位置感 |
| 2026-07-10 | 修复双击文字进入编辑态后排版变化：编辑已有文字/形状 label 时按 canvas 渲染路径测得的最长行宽设置 `#textInput` 宽度并取消 420px 上限，同时把编辑框行高从 1.2 对齐到 1.24；why：避免 `contenteditable` DOM 自动换行与 canvas 绘制结果不一致，让用户双击编辑时文本位置/换行保持稳定 |
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
