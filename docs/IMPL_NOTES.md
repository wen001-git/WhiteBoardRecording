> 目的：按子系统保存 WhiteBoard 当前实现入口和不可回退的技术约束。　目标读者：准备修改某一子系统的 AI 或开发者。　如何阅读：先从 `AGENTS.md` 的任务路由进入，只读当前任务对应的小节，再用其中的函数名通过 `rg` 定位源码。

# WhiteBoard 实现备忘（按需读取）

本文不是变更历史，也不要求会话开始时完整读取。历史原因和旧方案使用 `git log --oneline --stat`；产品需求与完整手测清单见 `PROJECT_PLAN.md`。

<a id="auth"></a>
## Auth — 登录、静态账号、Neon 与付费配置

### 入口与数据流

- `index.html` 和 `whiteboard-pro.html` 都实现“本地静态账号优先、Neon 兜底”。静态校验成功必须直接返回，不调用 `/api/login`。
- `index.html` 初始只显示会话检查过渡态：有效 `wb_static_pro_session` 直接进入白板且不请求账号服务；否则以 5 秒上限检查 `/api/session`，有效 Neon Cookie 同样通过 `location.replace()` 进入 `app.html`。只有 401、网络失败或超时才显示登录入口，避免已登录用户看到登录页闪现或后退后循环跳转。
- HTTP(S) 页面优先读取同目录 `accounts.json`；`file://` 页面先用 `localStorage.wb_static_accounts_json`，没有缓存时读取 `https://record.leewen.work/accounts.json`。生产静态站必须为 `/accounts.json` 返回 `Access-Control-Allow-Origin: *`，Node 的 `ALLOWED_ORIGINS` 必须显式包含 `null`，否则本地文件来源仍会被 CORS 拒绝。静态会话键为 `wb_static_pro_session`。
- 静态与 Node/Neon 新账号统一使用 `SHA-256(salt:usernameLowercase:password)`，输出 64 位小写十六进制，盐为 `wb-static-pro-salt-v1`。数据库用 `password_scheme` 区分 `static-sha256-v1` 和旧 `scrypt-v1`；旧账号仅在启用且密码验证成功后自动迁移，迁移不递增 `session_version`，失败登录和停用账号不得迁移。
- 后端入口在 `server/app.mjs`，核心路由为 `/api/login`、`/api/session`、`/api/logout`、`/api/app` 和 `/api/admin/*`；数据库访问在 `server/store.mjs`。密码规则为 4–128 位。
- 服务端会话使用 HttpOnly Cookie；停用账号、改密或清空设备时会递增 `session_version`，旧会话随即失效。静态账号不经过设备限制。

### Neon 会话与账户 UI

- Neon 登录成功后不再请求 `/api/app` 并 `document.write()` 整份 HTML；入口页进入静态 `app.html`，白板通过 `/api/session` 恢复服务端会话。
- `grantServerProSession()` 动态更新 `APP_PLAN/IS_PRO/SERVER_PRO_GRANTED`，`renderAccountEntry()` 同步右下角用户名、Pro 样式和退出菜单。不要恢复整页脚本二次执行，否则会再次触发 `screenVideo` 等全局声明冲突。
- `renderAccountEntry()` 也是已登录联系/推荐入口的唯一显隐开关：免费状态只显示登录；静态或 Neon Pro 恢复后显示“推荐给朋友”和带箭头的账号按钮。账号菜单提供“联系作者 / 推荐给朋友 / 退出登录”，两种入口统一调用 `openContactShareDialog(mode)`；弹窗从当前 `purchaseConfig.wechat` 生成微信号和可编辑推荐语，复用 `PRO_QR_DATA_URL`，首次点击只打开预览，复制或 `navigator.share` 必须由用户再次明确触发。
- 账户入口只绑定一次事件，点击行为根据当前 `IS_PRO` 决定打开登录或菜单；退出同时清理静态 session 并调用 `/api/logout`，避免两种会话叠加。
- `/api/app` 仍保留为服务端兼容接口和授权标记测试，但当前静态入口不依赖它加载页面。
- `account-admin.html` 的账号列表是 Neon `/api/admin/accounts` 与同站点 `accounts.json` 按小写用户名合并后的全集；重叠账号只显示一次，静态独有账号必须标注来源且不能误显示 Neon 的设备上限、改密或登录 IP 操作。
- 管理页只有在成功读取 `accounts.json` 后才开放 Neon 删除：已启用的重叠账号显示“转为静态账号”，Neon 独有账号显示“永久删除”，重叠但 static 已停用时必须先去静态工具启用。两类删除都要求输入完整账号名，调用 `DELETE /api/admin/accounts/:id` 后由数据库级联清理设备与登录事件；API 还要同时校验 id 和规范化用户名。
- Neon 成功登录响应结束后，服务端异步写入 `login_events`（IP、设备、User-Agent、时间）。静态账号校验成功必须先立即放行，再由两个登录页面通过带 `keepalive` 的 `/api/login-audit` 非阻塞审计，避免随后的页面跳转取消请求；后端仅在同名账号也存在于 Neon、密码一致且启用时记录，不绑定或占用 Neon 设备名额。纯本地账号、密码不一致、失败登录和设备超限不记录，审计请求或写入失败也不得拖慢或阻断登录。管理 API 每个账号只返回最近 100 条，`account-admin.html` 对任意 1 小时窗口内至少 2 个不同 IP 给出共享风险提醒；VPN 和移动网络切换可能产生误报。

### 独立购买配置

- 价格和微信只保存在根目录 `paywall.json`：

  ```json
  {
    "version": 1,
    "price": "59",
    "wx": "leewen2017",
    "updatedAt": "ISO-8601 timestamp"
  }
  ```

- `accounts.json` 只保留 `version/app/salt/accounts`；白板和入口读取 `paywall.json`，不再从账号文件兼容读取价格或微信。
- `account-admin1.html` 为两个文件维护独立句柄：账号按钮只保存/下载 `accounts.json`；价格按钮只保存/拉取/下载 `paywall.json`。本机即时预览继续使用 `wb_static_purchase_config` 与 `BroadcastChannel('wb_static_admin_cfg')`。
- 管理页必须明确说明：浏览器生成 JSON 不会自动更新服务器；线上生效需覆盖仓库同名文件并提交、推送，等待 Render 部署。发给客户的是明文用户名和密码，不是哈希。

### 发布与测试入口

- `scripts/build-static.mjs` 是唯一公共发布入口；新增公共配置时同步更新白名单和 `tests/commercial-build.test.mjs` 的精确文件断言。
- 登录顺序和会话恢复测试在 `tests/login-priority.test.mjs`；Node 会话/设备规则在 `tests/auth-api.test.mjs`；授权标记在 `tests/pro-app.test.mjs`。
- 生产域名为 `record.leewen.work`（静态）和 `auth.record.leewen.work`（Node）。跨域请求必须保留 `credentials:'include'`，Render 的 `ALLOWED_ORIGINS`、Cookie domain 和 Secure 配置需成套验证。

<a id="objects"></a>
## Objects — 对象、文字、图片与绘图样式

### 对象和选择

- 白板内容位于 `state.scene[]`；视图为 `state.view{x,y,scale}`。单选主对象由 `selectedIndex` 指向，多选集合由 `selectedIndices` 保存；对象点击与框选都复用 `hitTest()` / `selectionObjectBounds()`。
- `#selectionBox` 与 `#marqueeBox` 都是 DOM 浮层，不写入 canvas，因此不进入录制。多选开放整体移动、删除和图层排序；单选继续开放四角缩放、顶部旋转点和文字编辑。移动、删除或排序前必须且只需 `pushHistory()` 一次。
- 选中对象后，`Ctrl/Cmd+C` 将单选或多选对象深拷贝到白板内部剪贴板，`Ctrl/Cmd+V` 粘贴，`Ctrl/Cmd+D` 直接复制并粘贴；粘贴对象按次数向右下偏移 24px、保持组内相对位置和图层顺序、自动成为新选择，并且每次只写一次撤销历史。输入框和富文本编辑态继续使用浏览器原生剪贴板；外部图片仍走图片导入流程，外部纯文字则在最近画布指针位置（无指针时为视口中央）新建并选中文字对象。
- 图层顺序就是 `state.scene[]` 的绘制顺序：索引越大越靠上。`reorderSelectedLayer()` 支持置底、下移、上移和置顶；多选重排必须保持组内顺序、恢复新的选中索引，并且每次操作只调用一次 `pushHistory()`。
- 缩放/旋转基准使用 `transformBounds()` 的对象本体框，不能使用带 UI padding 的选择框，否则图片和文字尺寸会漂移。
- 移动端画布双指手势由 `canvasTouchPoints/canvasPinchGesture` 管理，以两指中心对应的世界坐标为锚点同时缩放和平移；第二指落下时必须恢复第一指开始前的场景、历史栈、选区、待放图片与视图，取消临时笔迹/框选，手势结束前不得让剩余单指重新进入绘画逻辑。
- 图片对象为 `{type:'image',src,x,y,w,h}`，`src` 是 data URL；`imageCache` 缓存解码结果。导入和粘贴先裁透明/近白空边，再走 `beginPendingImage()` 放置流程。

### 富文本

- 文字对象保存 `fontSize/fontFamily/textAlign/opacity/runs`；形状文字保存对应的 `label*` 字段和 `labelRuns`。
- `runs` 可覆盖选区级 `color/fontFamily/fontSize`；对齐和透明度始终是整段属性。`applyTextEditingPatch()` 只让可分段属性进入选区逻辑，不能让所有补丁都被选区分支吞掉。
- DOM selection 的字符偏移必须通过 `serializedInputText(range.cloneContents())` 计算，与 `richTextFromInput()` 对 `<br>`、块元素和零宽字符的处理保持一致；不要改回 `Range.toString()` 或嵌套 span 提取方式。
- 混合字号的测量和绘制统一走 `normalizedTextRuns()`、`textLineChunks()`、`textLinesLayout()`；整体缩放时同时缩放顶层字号和 `runs[].fontSize`。
- 编辑中 Enter 插入换行，点击外部提交，Esc 取消；双击文字或选中后 Enter 调 `beginTextEdit()`。编辑框和 canvas 的行高、宽度测量必须保持一致。

### 手绘与动态线条

- 新建画笔对象使用 `strokeDynamics:'natural'`、`points[{x,y}]`、`pressures[]`、`simulatePressure` 与 `lastCommittedPoint`。三档基础宽度固定为 `1/2/4`（细/粗/特粗），默认中档；Perfect Freehand 的 `size` 使用 `width*4.25`，并固定 `thinning:.6/smoothing:.5/streamline:.5` 与正弦压力缓动。
- pointerdown 的 `pressure===0.5` 时按相邻点距离渐进模拟压力，否则保存与点一一对应的真实压力；不展开 `getCoalescedEvents()`，也不按事件时间直接计算速度倍率。绘制期间锁定 pointerId，忽略手掌或第二触点。
- 实线必须由 Perfect Freehand 一次生成左右轮廓、急转圆角和首尾圆帽，再以二次曲线闭合填充；不能另画端点圆形。命中和边界使用最终轮廓，缩放坐标时保留点附加字段、压力及完成点。
- v10 继续读取旧固定宽度笔画；实验性 v7 `{x,y,f}` 自然笔画忽略错误的 `f`，仅按旧坐标重新模拟压力，因此不会延续过粗和收尾鼓包。
- 形状使用 `mulberry32(seed)` 和 `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`，对象创建时保存稳定 seed，重绘不能重新随机。
- `strokeStyle`、`roughness` 和 `strokeMotion` 相互独立；`strokeMotion:'flow'` 是覆盖层，不替换原线条。
- 仅在存在 flow 对象时启动动画循环；动画帧调用 `render({skipSave:true})`，避免动画持续触发自动保存。

<a id="slides"></a>
## Slides — 幻灯片、比例与 DOM 浮层

- 幻灯片数据是 `state.slides[{id,x,y,w,h,backgroundColor,transition,reveal,elementCues,elementCueAudio}]` 与 `state.activeSlide`；`backgroundColor:null` 表示继承 `state.canvasBackground`，`transition:{type,speed,sound,volume}` 保存进入本页的转场，`reveal:{style,autoPlay}` 保存逐页笔迹样式和切入自动播放开关，`elementCues[{id,name,objectIds}]` 保存元素操作栏绑定，`elementCueAudio:{sound,volume}` 保存本页统一动作音效。文档 v10 保留稳定 `objectId` 并新增元素音效设置；旧文档缺失该字段时默认无音效、60% 音量。
- `addSlide()` 通过 `createSlideAtSmartPosition()`：当前视野接近 active slide 时在右侧找空位；用户已移动到远处空白时按当前 viewport 中心创建。
- 自动恢复或打开文档后，`syncRecordingRatioToSlide()` 必须从当前幻灯片的真实 `w/h` 反推标准比例或 Custom，并同步右侧幻灯片尺寸与录制设置；不得让未持久化的 `recConfig.ratio` 默认值 16:9 覆盖已恢复的页面比例。切换到历史上尺寸不同的页面时也以当前页为准。
- `insertSlideAt()` 通过 `createSlideForDeckInsert()` 和 `shiftSlidesAndContents()` 线性插入；后续幻灯片及中心落在其中的对象必须一起右移，保持面板顺序、世界坐标从左到右顺序和录制顺序一致。
- `selectSlide()` 是选中并对焦的单一入口；setup/recording/paused 时还要同步 `recConfig.frame`。比例修改统一走 `setRecordingRatio()` / `setCustomRecordingRatio()`；`resizeSlidesToRatio()` 保持第 1 张中心不变，并按列表顺序以 `SLIDE_GAP` 等距重排后续页面。重排前必须按旧页面范围记录对象归属，再让页内对象获得所属页面的水平位移；不得缩放内容或移动页面外对象。比例变化后新增页面必须通过 `currentSlideSize()` 继承当前页实际宽高，插入页面则优先继承相邻页，不能重新使用比例预设的标准像素尺寸。
- 缩略图和左右键以 `{animate:true}` 调用 `selectSlide()`：切换前截取当前 board 合成帧，切换后截取目标页，再由 `drawSlideTransitionOverlay()` 在幻灯片范围内绘制淡化、推入或擦除；方向按页码自动决定，暂停录制时瞬时切页，程序化选页不播放。
- 转场声音由 Web Audio 即时合成，不增加外部音频资源：`page/swish/soft` 分别是翻书、轻柔滑动和柔和提示，音量按页保存。选择声音或音量后重播整套转场，“试听”只播放声音；连续快速切页先用 40ms 淡出旧声音，避免叠音和爆音。
- `#slideFramesLayer`、幻灯片序号、`#slideRevealFloatBtn`、`#minimap` 和比例弹层都是 DOM UI，不得写入 canvas。笔迹播放本身由 `drawSlideRevealOverlay()` 画入 board，才能进入录制。
- 用户通过缩略图或左右键切入开启自动笔迹的页面时，必须先建立笔迹第 0 帧再截取转场目标；转场期间笔迹保持 `waiting`，结束后才启动计时。无转场时立即从第 0 帧播放，暂停录制、文档恢复和程序化定位不触发；主按钮继续手动重播当前页效果。
- 幻灯片动画菜单的“文字逐行”按文字框本体顶部坐标、再按横坐标排序当前页 `type:'text'` 对象；播放期间在正常场景层序内由 `drawTextRevealObject()` 以 650ms 间隔淡入并轻微上移，因此不改对象数据、不改变原图层关系、可重复播放且会随 board 进入录制。形状内标签不参与此顺序。
- 元素操作栏通过 `elementCueHiddenBySlide` 维护仅限当前打开期间的逐页隐藏集合；配置、名称、对象 ID 和 `elementCueAudio` 进入 v10 文档与撤销快照，但显隐状态不得持久化。隐藏对象必须同时退出 canvas、命中、框选、擦除和鸟瞰图；点击主按钮由 `elementCueFades` 在约 200ms 内把 alpha 画入 canvas，因此白板录制能捕获淡入，暂停录制时则只更新最终画面。`playElementCueSound()` 复用转场 Web Audio 调度与 `transitionAudioRoute()`：`recording` 时同时连接扬声器和 `recordingAudioDestination`，`paused` 或编辑态只连接本机预览；主按钮、眼睛显示及“全部显示”仅在存在新揭示对象时各播放一次，隐藏或重复点击不得触发。`positionSlideRevealButton()` 保持“笔迹”按钮紧贴幻灯片上方的原位置，`positionElementCueControl()` 再以其边界为锚点把元素操作栏放在正上方；`#elementCueItems` 必须换行并全部展示，不得改回横向滚动。删除或把对象中心移出所属页时清理绑定，复制对象由唯一性修复生成新 ID 且不继承绑定。
- `#slideRevealControl` 是“主按钮播放当前效果 + 箭头打开预设”的分体入口；正式预设包括彩铅铺色、水墨晕染、左上到右下的铅笔描绘和“斜线推进”。四种效果共用色彩感知线稿：浅色页使用接近纯黑、高不透明度且不扩边的细墨线；原始黑灰文字、发丝和排线只走墨线通道，边缘通道必须避开它们，防止同一笔画两侧重复描边变粗。高饱和度色块只补没有墨线的强边界，深色页改用浅线。统一约 4.4 秒，前 34% 完整起稿；后 66% 从头上色并用 `.62` 次幂加快前段推进。各自的空间动作不变，选择记忆、固定种子、录制链和减少动态效果处理继续生效。
- 背景渲染顺序固定为全局底色 → 单页覆盖 → 对象；背景改动进入扩展后的对象撤销快照，但不改变幻灯片增删的既有撤销行为。鸟瞰图和笔迹播放必须使用 `effectiveSlideBackground()`，深色页的笔迹提取需排除背景并改用浅色轮廓。
- 层级约束：录制框之上仍需看见幻灯片边框，笔迹按钮再高一层；打开的贴纸工具面板必须继续覆盖二者，避免幻灯片标签、边框或笔迹按钮穿透工具面板。`applyFrameStyle()` 不能为了 UI 按钮缩短最终取景框。
- 顶部文件、绘画与录制控件通过 `syncTopControlsLayout()` 按真实矩形避让；电脑与 iPad 的左上角固定为线框主菜单、彩色调色盘和高频保存，画布背景按钮用角落色点显示当前有效底色并一步打开调色板，主菜单展开本机画布管理面板；空间不足时再折叠形状/素材/清空工具并以单行滚动兜底。不得改回彼此无感知的固定定位或按 iPad 用户代理写死偏移；两个 HTML 版本必须同步。
- 左上主菜单现在是本机“画布管理”面板：`boardLibrary` 只保存画布 id、名称、更新时间和轻量预览，完整 v10 文档按 `board:<id>` 分开写入 IndexedDB（不可用时回退 localStorage）。首次打开会把旧 `current` / `whiteboard-doc` 单存档无损迁移为“画布-1”；新建和导入都增加新画布，不覆盖当前内容，切换前必须立即保存当前文档。清空只重置当前画布内容并保留卡片；删除按钮属于各自卡片并按画布 id 操作，不得先切换画布，删除非当前画布时当前内容必须保持不变，删除当前画布才回退相邻画布。只剩一张时不渲染删除按钮，两项危险操作都使用 `#boardConfirmOverlay` 二次确认。录制或取景期间禁止新建、导入、切换、清空和删除。
- `.slidesList` 必须保持 `overflow-x:hidden`，否则纵向滚动条会引发横向溢出；删除角标负偏移依赖列表 padding，调整窄面板尺寸时需同时验证二者。

<a id="recording"></a>
## Recording — 媒体、白板录制、录屏与导出

### 白板录制

- `recConfig` 保存比例、背景、白卡片边距/圆角、取景框、摄像头、麦克风、激光笔和文字水印；状态机为 idle → setup → recording → paused。
- `recConfig.quality` 与幻灯片 `ratio/customW/customH` 解耦，并通过 `wb_recording_quality_v1` 记住本机选择；`recordingOutputSize()` 只在开始白板录制时把当前比例装入 1080p、720p 或 480p 边界并修正为偶数像素，不得因切换清晰度调用 `resizeSlidesToRatio()`。录屏继续使用共享源裁剪尺寸，不读取该清晰度。白板优先使用 `captureStream(0)` 配合 30 FPS 定时合成后逐帧 `requestFrame()`，不支持手动取帧才回退 `captureStream(30)`，避免原生 MP4 把静止画面压成过短时间轴。
- `drawRecFrame()` 顺序：背景 → 白卡片 → 裁剪后的 board → 摄像头 → 激光笔 → 用户文字水印 → 计划/免费版强制水印。`#recordingLaserPointer` 与成品圆点共用 `cursorHighlight/cursorColor/pointInRecordingFrame()`，录制中可由 `#recPointerToggle` 即时开关，不得写入白板文档或撤销历史。
- 幻灯片转场必须画入 board canvas、不得使用 DOM 遮罩，因此 `drawRecFrame()` 会自然采集转场，而摄像头、激光笔与水印继续稳定叠在转场之上。
- 白板和录屏录制都通过 `buildRecordingAudioTracks()` 建立 Web Audio `MediaStreamDestination`；麦克风、系统声和转场提示音汇入同一录制音轨。没有摄像头/麦克风时仍须用约 −80 dB 的非零 `ConstantSourceNode` 保持连续且实际编码的音频时钟，不能改成全零信号（可能被 AAC 优化掉），从而避免 Chrome 原生 MP4 只按降帧后的视频轨推算时长；`AudioContext.resume()` 使用短超时，不能卡住开始录制。正式录制时转场声同时输出到扬声器供讲解者监听；暂停切页和程序化定位不得把声音写入成品。
- `#recBar` 是设置、媒体、提词器、激光笔/录屏光标、计时和录制状态操作的统一容器；`#cameraToggle/#micToggle` 共用紧凑双分段线框胶囊，但分别控制 `cameraStream/microphoneStream`，录制中也可独立开关。幻灯片浮动按钮避让必须读取整个容器边界，不能只读取设置按钮。
- 画布底色与录制壁纸是两套配置：前者属于文档并已画进 `board`，后者属于 `recConfig` 且只装饰白卡片外层；录制设置预览的卡片应显示当前有效画布底色。
- 可选文字水印使用 `wb_recording_watermark_v1` 本机保存，最多 40 字，支持九宫格预设、预览拖动后的归一化自定义位置、大小与透明度；水印只参与最终合成，不成为白板对象。
- 摄像头只有一份用户状态：视频轨开启时页面头像与录制成品同时显示，关闭时同时隐藏；设置页只保留效果参数和复用同一开关的“开启预览”入口，不得重新引入 `recConfig.showCamera`。麦克风设备下拉框只选择设备，启停由顶部麦克风分段控制；切换设备失败必须保留原轨，所选设备不存在时回退系统默认。
- 录制混音保留固定的 `MediaStreamDestination` 输出轨，`syncRecordingMicrophoneSource()` 只动态连接或断开用户麦克风节点，不能重建输出轨或影响录屏系统声。设置页音量条使用独立 `AnalyserNode` 且不得连接扬声器，关闭设置或麦克风时停止刷新并释放分析上下文。

### 录屏

- 支持 Document Picture-in-Picture 时，第一次点“录制”只调用 `documentPictureInPicture.requestWindow()` 打开置顶裁剪器，用户必须在该小窗中第二次点击“选择窗口 / 屏幕”，并立即从 `screenCropPipWin.navigator.mediaDevices` 调用 `getDisplayMedia()`，确保消费的是 PiP 按钮产生的 transient user activation；两个权限入口不能在第一次点击后连续自动弹出。PiP 分支使用同一 Window realm 的 `CaptureController` 并预设 `focus-captured-surface`，让 Chrome 在共享成功后聚焦 ChatGPT 等被录窗口；WhiteBoard 降级分支继续请求 `focus-capturing-application`。
- Chrome 会记住上一轮 Document PiP 的窗口尺寸，而录制控制条会缩至 330×150；每次 `openScreenCropPipLauncher()` 必须以 760×590、`preferInitialWindowPlacement:true` 请求新窗，并在 Promise 返回后同一用户手势链内调用 `resizeTo(760,590)`，防止第二次录制仍得到小型裁剪器。旧版 Chrome 忽略未知 option 时仍由 `resizeTo()` 兜底。
- 共享成功后 PiP 小窗切换为冻结预览、比例按钮和绿色框。确认窗口/标签页录制时不得关闭创建共享流的 PiP 文档，否则后台 `MediaStreamTrackProcessor`/VideoFrame 可能失效并输出持续黑底；应把小窗缩成暂停/停止控制条，录制结束再随 `stopScreenStream()` 关闭。用户在录制中手动关闭控制窗时必须安全停止录制。
- monitor 来源不能直接关闭 PiP 后继续使用原 realm 的轨道。应先逐轨 `clone()`，再由主文档 realm 的 `structuredClone(track,{transfer:[track]})` 接管，成功后停止原轨并设置 `screenStreamDetachedFromPip=true`，之后才能关闭辅助窗而不黑屏；若当前 Chromium 不支持 MediaStreamTrack transfer，则保留紧凑控制窗作为兼容降级，优先保证画面不黑。browser/window 已保留 PiP 创建文档，WhiteBoard 录制不经过此链路。
- Document PiP 不支持、打开失败或用户在裁剪阶段手动关闭时，降级为 WhiteBoard 内的 `#screenStage`。此时 `getDisplayMedia()` 按能力传入会话级 `CaptureController`，并在系统选择器前预设、共享 Promise 返回后首次异步等待前再次请求 `focus-capturing-application`，同时用 `window.focus()` 尽力回焦。browser、window、monitor 与未知来源都必须进入同一裁剪确认流程；PiP 不能与录制中的摄像头自检窗口共用状态。
- 录屏光标开关只使用共享视频轨暴露的 `getCapabilities().cursor` 与 `applyConstraints({cursor})`；缺少 `never` 或可恢复的 `always/motion` 时必须禁用并提示，失败时恢复 UI 状态且继续录制。`drawScreenFrame()` 不得再叠白板激光笔，避免共享源已有光标时出现双影。
- `#screenVideo` 离屏隐藏并作为通用 fallback 取帧源；Chrome/Edge 优先用 `MediaStreamTrackProcessor` 的 VideoFrame 驱动 `drawScreenFrame()`，但构造失败或异步 `reader.read()` 拒绝时都必须只启动一次 30 FPS video 定时取帧，不能静默停泵后让窗口、标签页或整屏成品停在黑帧。
- 裁剪使用会话级归一化 `screenCropNorm{x,y,w,h}`，不能复用或持久化白板 `recConfig.frame`。`#screenStage/#screenSnap/#screenCropFrame` 都是 DOM，不进入输出。
- 所有共享来源进入 `#screenCropModes` 后默认读取 `recConfig.ratio/customW/customH`，提供完整来源、五种标准比例与 Custom；非完整来源预设必须在 `layoutScreenSnap(true)` 后初始化，并统一装入 `screenPresetBounds()` 给出的 16:9 安全边界，避免预览尺寸为 0 时被最小尺寸保护放大成完整来源。标准比例拖角锁定宽高比，完整来源拖角自动转为 Custom，自由裁剪不得反向改写录制设置。
- `drawScreenFrame()` 与白板录制共用 `drawUserWatermark()`，顺序同样在摄像头合成后、计划/免费版强制水印前；设置预览里的 `#previewWatermark` 是 DOM，不得进入来源画面。
- 录屏时页面摄像头气泡设为不可见但保留解码，防止整屏录制出现双重人脸；摄像头帧泵在屏幕源长期不出帧时补合成，避免头像冻结。
- 停止流程保留 `recStopping/recStopHandled` 一次性守卫和 onstop 超时兜底；WebM 可在停止前 `requestData()` 保留已生成分片，原生 MP4 不得提前分片，防止 Chrome “停止分享”丢失完成页、生成两份结果或写出错误时长。

### 摄像头效果与导出

- 摄像头位置为四角配置；亮度通过固定 320px 工作画布内的 gamma 曲线实现，不能改回 screen 白层或每帧 `ctx.filter`：前者会产生雾面，后者曾导致真实录制卡顿。工作画布不能降回 240px，否则放大头像会因二次插值而失去皮肤纹理。
- 页面摄像头框的最大边长按当前视口短边动态计算并保留 8px 安全边距；放大触及右/下边界时会自动向左/上收回，录屏合成尺寸也必须限制在输出画布内。
- 美颜通过固定小工作画布、YCbCr 肤色软掩膜和色度/亮度纹理分离实现：低频层只均匀肤色色斑与泛红，原始亮度纹理继续保留毛孔和五官，亮度层最多轻柔化 22%；黑眼圈/暗沉通过模糊后的邻域肤色掩膜只抬高柔和暗部，眼球、睫毛等硬边缘由 `edgeProtect` 排除；红润只调整肤色掩膜。不得重新直接把原图混入模糊层。原始 `#camVideo` 只负责解码，页面头像显示 `#camFxLive`，设置预览直接复制该共享画布，白板录制与录屏则复用 `drawCamBeautified()`，四处参数必须一致。
- 浏览器原生 MP4 支持时直接录制，并且必须使用无 timeslice 的 `MediaRecorder.start()`、停止前不得调用 `requestData()`，由浏览器一次性写入 MP4 索引和完整时长；不能把每 200ms 产生的 MP4 碎片直接拼 Blob，否则 12 秒录制可能只显示其中约 5 秒。WebM 才保留 200ms 分片和异常停止兜底；需要 MP4 时由用户触发 ffmpeg.wasm 转码。提词器始终是独立 DOM 浮层，不得进入 `drawRecFrame()` 或 `drawScreenFrame()`。
- 提词器标题栏负责移动，右下角 `#teleResize` 负责同时调整宽高；移动与缩放都必须限制在视口内，缩放下限为 280×300px。右侧 `.slidesPanel` 固定在 `right:14px` 且层级高于提词器，不能再根据提词器显隐移动到其覆盖范围内。
- v10 白板文档的 `teleprompter{text,html,speed,fontSize}` 同时保存纯文本兜底和只允许安全字色标记的富文本；用户选中文字后才应用颜色，播放态复用清理后的富文本。系统颜色面板会夺走编辑焦点，因此必须保存选区 Range 并直接包装各文本节点，不能依赖 `execCommand('foreColor')`。导入或恢复时必须停止播放、回到编辑态并把滚动位置归零，显隐、窗口位置、播放和滚动进度不得持久化。
- `wb_teleprompter_text_v1` 继续作为两个版本共用的旧讲稿迁移兜底：只有加载缺少 `teleprompter` 的浏览器旧草稿时才迁入当前文档，不能让它覆盖用户主动打开的旧文件。输入文字、速度和字号都要触发文档防抖自动保存。

<a id="stickers"></a>
## Stickers — 彩铅人物与图片资源

- 贴纸入口为 `#stickerBtn/#stickerPopover`，数据集中在 `STICKER_GROUPS`；点击后复用 `beginPendingImage()`，因此贴纸与普通图片共享放置、移动、缩放、删除、撤销和录制路径。
- 男生、女生各有固定角色表情组，综合组保留第一版原创贴纸。女生角色应保持自然中长发和低辫结构：正脸显示两侧低辫，侧脸/转头/低头只显示真实可见的一侧。
- 男女“表扬”贴纸使用固定角色的条纹上衣、蓝色长裤和白鞋，以正面微笑加清晰竖起大拇指表达肯定；生成源经绿幕边缘去除、透明角验证和 420px 高度优化后，作为相同内联 WebP 同步到两个白板版本。
- 综合“女孩点赞”贴纸保留用户原图的圆形构图、星光和手绘质感，只移除与图片边缘连通的近白背景，避免误删白衣、眼白和圆形白边；成品为 417×420 内联透明 WebP，并在两版中使用相同数据。
- 会议场景组包含远程会议、AI 实时记录、实时翻译、详细纪要、会议总结和行动计划 6 张连续彩铅漫画，两个白板版本使用同一组 480px 内联透明 WebP。
- 素材以内联透明 PNG/WebP 保存，不新增外部运行时文件。优化单 HTML 体积时不得降低透明边缘质量或改变角色一致性。
- 贴纸弹窗和普通绘图工具的选中态互斥；关闭弹窗时恢复 `state.tool`，选择普通工具时先关闭贴纸弹窗。

<a id="i18n"></a>
## I18n — 中英文与单 HTML 同步

- `locales/i18n.js` 是共享运行时，语言优先级为用户保存的 `wb.lang`（`zh-CN` / `en-US`）高于浏览器；`auto` 或无保存值时按 `navigator.languages` 的第一个受支持语言选择，其他语言回退英文。主菜单 `#langSwitch` 提供“跟随浏览器 / 中文 / English”，切换会更新 `<html lang>`、现有 DOM 和后续动态 DOM。
- `locales/zh-CN.js`、`locales/en-US.js` 保存显式键；`locales/whiteboard-phrases.js` 将大单 HTML 中的中文原文与英文放在同一对照表，运行时同时支持完整短语、占位参数和安全的长片段替换。`contenteditable` 用户内容不参与通用翻译；仅 `data-i18n-seed="tele.seed"` 的未编辑提词器示例可随语言切换。
- 两个白板的 `WB_I18N_BUNDLE_START/END` 区域是生成物。修改任一 locale 后运行 `node scripts/sync-whiteboard-i18n.mjs`；`tests/i18n-shared-core.test.mjs` 断言内嵌副本与源文件完全相同，`tests/i18n-whiteboard-coverage.test.mjs` 断言静态中文 UI 均有英文对照且白板不依赖外部 locale 文件。

## 维护约定

- 这里只写“当前入口 + 当前红线”。功能历史、旧实现、测试过程和截图结论不写入本文。
- 新增陷阱时放入唯一对应小节并保持简短；若源码已使约束显而易见，则无需重复记录。
- 修改后检查 `AGENTS.md` 的任务路由仍能定位本页锚点。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-07-30 | 修复第二次录制复用 330×150 PiP 控制窗尺寸；why：Chrome 会记住上一轮窗口大小，新会话必须显式恢复 760×590 裁剪器 |
| 2026-07-30 | 让窗口、标签页与整屏共享统一进入比例裁剪确认页；why：用户选择窗口后也能调整成品范围、位置与标准宽高比 |
| 2026-07-29 | 记录元素动作音效的 v10 逐页设置、播放去重和录制/暂停混流边界；why：保证音效只伴随真实揭示并正确进入成品，不在重录准备或批量显示时产生叠音 |
