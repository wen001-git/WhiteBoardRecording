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
- 图片对象为 `{type:'image',src,x,y,w,h}`，`src` 是 data URL；`imageCache` 缓存解码结果。导入和粘贴先裁透明/近白空边，再走 `beginPendingImage()` 放置流程。

### 富文本

- 文字对象保存 `fontSize/fontFamily/textAlign/opacity/runs`；形状文字保存对应的 `label*` 字段和 `labelRuns`。
- `runs` 可覆盖选区级 `color/fontFamily/fontSize`；对齐和透明度始终是整段属性。`applyTextEditingPatch()` 只让可分段属性进入选区逻辑，不能让所有补丁都被选区分支吞掉。
- DOM selection 的字符偏移必须通过 `serializedInputText(range.cloneContents())` 计算，与 `richTextFromInput()` 对 `<br>`、块元素和零宽字符的处理保持一致；不要改回 `Range.toString()` 或嵌套 span 提取方式。
- 混合字号的测量和绘制统一走 `normalizedTextRuns()`、`textLineChunks()`、`textLinesLayout()`；整体缩放时同时缩放顶层字号和 `runs[].fontSize`。
- 编辑中 Enter 插入换行，点击外部提交，Esc 取消；双击文字或选中后 Enter 调 `beginTextEdit()`。编辑框和 canvas 的行高、宽度测量必须保持一致。

### 手绘与动态线条

- 形状使用 `mulberry32(seed)` 和 `roughLine/roughRect/roughEllipse/roughDiamond/roughArrow`，对象创建时保存稳定 seed，重绘不能重新随机。
- `strokeStyle`、`roughness` 和 `strokeMotion` 相互独立；`strokeMotion:'flow'` 是覆盖层，不替换原线条。
- 仅在存在 flow 对象时启动动画循环；动画帧调用 `render({skipSave:true})`，避免动画持续触发自动保存。

<a id="slides"></a>
## Slides — 幻灯片、比例与 DOM 浮层

- 幻灯片数据是 `state.slides[{id,x,y,w,h,backgroundColor,transition,reveal}]` 与 `state.activeSlide`；`backgroundColor:null` 表示继承 `state.canvasBackground`，`transition:{type,speed,sound,volume}` 保存进入本页的转场，`reveal:{style,autoPlay}` 保存逐页笔迹样式和切入自动播放开关。文档 v6 保存底色、转场、笔迹和提词器。
- `addSlide()` 通过 `createSlideAtSmartPosition()`：当前视野接近 active slide 时在右侧找空位；用户已移动到远处空白时按当前 viewport 中心创建。
- `insertSlideAt()` 通过 `createSlideForDeckInsert()` 和 `shiftSlidesAndContents()` 线性插入；后续幻灯片及中心落在其中的对象必须一起右移，保持面板顺序、世界坐标从左到右顺序和录制顺序一致。
- `selectSlide()` 是选中并对焦的单一入口；setup/recording/paused 时还要同步 `recConfig.frame`。比例修改统一走 `setRecordingRatio()` / `setCustomRecordingRatio()`，已有幻灯片由 `resizeSlidesToRatio()` 保持中心重算。
- 缩略图和左右键以 `{animate:true}` 调用 `selectSlide()`：切换前截取当前 board 合成帧，切换后截取目标页，再由 `drawSlideTransitionOverlay()` 在幻灯片范围内绘制淡化、推入或擦除；方向按页码自动决定，暂停录制时瞬时切页，程序化选页不播放。
- 转场声音由 Web Audio 即时合成，不增加外部音频资源：`page/swish/soft` 分别是翻书、轻柔滑动和柔和提示，音量按页保存。选择声音或音量后重播整套转场，“试听”只播放声音；连续快速切页先用 40ms 淡出旧声音，避免叠音和爆音。
- `#slideFramesLayer`、幻灯片序号、`#slideRevealFloatBtn`、`#minimap` 和比例弹层都是 DOM UI，不得写入 canvas。笔迹播放本身由 `drawSlideRevealOverlay()` 画入 board，才能进入录制。
- 用户通过缩略图或左右键切入开启自动笔迹的页面时，必须先建立笔迹第 0 帧再截取转场目标；转场期间笔迹保持 `waiting`，结束后才启动计时。无转场时立即从第 0 帧播放，暂停录制、文档恢复和程序化定位不触发；主按钮继续手动重播当前页效果。
- 幻灯片动画菜单的“文字逐行”按文字框本体顶部坐标、再按横坐标排序当前页 `type:'text'` 对象；播放期间在正常场景层序内由 `drawTextRevealObject()` 以 650ms 间隔淡入并轻微上移，因此不改对象数据、不改变原图层关系、可重复播放且会随 board 进入录制。形状内标签不参与此顺序。
- `#slideRevealControl` 是“主按钮播放当前效果 + 箭头打开预设”的分体入口；正式预设包括彩铅铺色、水墨晕染、左上到右下的铅笔描绘和“斜线推进”。四种效果共用色彩感知线稿：浅色页使用接近纯黑、高不透明度且不扩边的细墨线；原始黑灰文字、发丝和排线只走墨线通道，边缘通道必须避开它们，防止同一笔画两侧重复描边变粗。高饱和度色块只补没有墨线的强边界，深色页改用浅线。统一约 4.4 秒，前 34% 完整起稿；后 66% 从头上色并用 `.62` 次幂加快前段推进。各自的空间动作不变，选择记忆、固定种子、录制链和减少动态效果处理继续生效。
- 背景渲染顺序固定为全局底色 → 单页覆盖 → 对象；背景改动进入扩展后的对象撤销快照，但不改变幻灯片增删的既有撤销行为。鸟瞰图和笔迹播放必须使用 `effectiveSlideBackground()`，深色页的笔迹提取需排除背景并改用浅色轮廓。
- 层级约束：录制框之上仍需看见幻灯片边框，笔迹按钮再高一层；打开的贴纸工具面板必须继续覆盖二者，避免幻灯片标签、边框或笔迹按钮穿透工具面板。`applyFrameStyle()` 不能为了 UI 按钮缩短最终取景框。
- `.slidesList` 必须保持 `overflow-x:hidden`，否则纵向滚动条会引发横向溢出；删除角标负偏移依赖列表 padding，调整窄面板尺寸时需同时验证二者。

<a id="recording"></a>
## Recording — 媒体、白板录制、录屏与导出

### 白板录制

- `recConfig` 保存比例、背景、白卡片边距/圆角、取景框、摄像头、麦克风、激光笔和文字水印；状态机为 idle → setup → recording → paused。
- `drawRecFrame()` 顺序：背景 → 白卡片 → 裁剪后的 board → 摄像头 → 激光笔 → 用户文字水印 → 计划/免费版强制水印。`#recordingLaserPointer` 与成品圆点共用 `cursorHighlight/cursorColor/pointInRecordingFrame()`，录制中可由 `#recPointerToggle` 即时开关，不得写入白板文档或撤销历史。
- 幻灯片转场必须画入 board canvas、不得使用 DOM 遮罩，因此 `drawRecFrame()` 会自然采集转场，而摄像头、激光笔与水印继续稳定叠在转场之上。
- 白板和录屏录制都通过 `buildRecordingAudioTracks()` 建立 Web Audio `MediaStreamDestination`；麦克风、系统声和转场提示音汇入同一录制音轨。正式录制时转场声同时输出到扬声器供讲解者监听；暂停切页和程序化定位不得把声音写入成品。
- `#recBar` 是设置、媒体、提词器、激光笔/录屏光标、计时和录制状态操作的统一容器；幻灯片浮动按钮避让必须读取整个容器边界，不能只读取设置按钮。
- 画布底色与录制壁纸是两套配置：前者属于文档并已画进 `board`，后者属于 `recConfig` 且只装饰白卡片外层；录制设置预览的卡片应显示当前有效画布底色。
- 可选文字水印使用 `wb_recording_watermark_v1` 本机保存，最多 40 字，支持九宫格预设、预览拖动后的归一化自定义位置、大小与透明度；水印只参与最终合成，不成为白板对象。
- `recConfig.showCamera` 只控制成品是否叠加摄像头；硬件占用由 `enableUserMedia()` / `stopUserMedia()` 和 `#mediaToggle` 管理。硬件关闭时不得偷偷重新请求麦克风。

### 录屏

- `getDisplayMedia()` 后读取 `displaySurface`：browser/window 使用完整来源并直接开始；monitor 或未知来源进入冻结预览和独立区域裁剪。
- 录屏光标开关只使用共享视频轨暴露的 `getCapabilities().cursor` 与 `applyConstraints({cursor})`；缺少 `never` 或可恢复的 `always/motion` 时必须禁用并提示，失败时恢复 UI 状态且继续录制。`drawScreenFrame()` 不得再叠白板激光笔，避免共享源已有光标时出现双影。
- `#screenVideo` 离屏隐藏，仅作 fallback 取帧源；Chrome/Edge 优先用 `MediaStreamTrackProcessor` 的 VideoFrame 驱动 `drawScreenFrame()`，避免页面切后台掉帧。
- 裁剪使用会话级归一化 `screenCropNorm{x,y,w,h}`，不能复用或持久化白板 `recConfig.frame`。`#screenStage/#screenSnap/#screenCropFrame` 都是 DOM，不进入输出。
- `drawScreenFrame()` 与白板录制共用 `drawUserWatermark()`，顺序同样在摄像头合成后、计划/免费版强制水印前；设置预览里的 `#previewWatermark` 是 DOM，不得进入来源画面。
- 录屏时页面摄像头气泡设为不可见但保留解码，防止整屏录制出现双重人脸；摄像头帧泵在屏幕源长期不出帧时补合成，避免头像冻结。
- 停止流程保留 `recStopping/recStopHandled` 一次性守卫、`requestData()` 和 onstop 超时兜底，防止 Chrome “停止分享”丢失完成页或生成两份结果。

### 摄像头效果与导出

- 摄像头位置为四角配置；亮度通过 screen 混合白层实现，不要改回每帧 `ctx.filter`，后者曾导致真实录制卡顿。
- 页面摄像头框的最大边长按当前视口短边动态计算并保留 8px 安全边距；放大触及右/下边界时会自动向左/上收回，录屏合成尺寸也必须限制在输出画布内。
- 美颜通过固定小工作画布、YCbCr 肤色软掩膜和盒式模糊实现，只平滑肤色。设置预览与录制共用 `drawCamBeautified()` 管线。
- 浏览器原生 MP4 支持时直接录制；否则先录 webm，用户请求转码时才加载 ffmpeg.wasm。提词器始终是独立 DOM 浮层，不得进入 `drawRecFrame()` 或 `drawScreenFrame()`。
- 提词器标题栏负责移动，右下角 `#teleResize` 负责同时调整宽高；移动与缩放都必须限制在视口内，缩放下限为 280×300px。右侧 `.slidesPanel` 固定在 `right:14px` 且层级高于提词器，不能再根据提词器显隐移动到其覆盖范围内。
- v6 白板文档的 `teleprompter{text,html,speed,fontSize}` 同时保存纯文本兜底和只允许安全字色标记的富文本；用户选中文字后才应用颜色，播放态复用清理后的富文本。系统颜色面板会夺走编辑焦点，因此必须保存选区 Range 并直接包装各文本节点，不能依赖 `execCommand('foreColor')`。导入或恢复时必须停止播放、回到编辑态并把滚动位置归零，显隐、窗口位置、播放和滚动进度不得持久化。
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

## 维护约定

- 这里只写“当前入口 + 当前红线”。功能历史、旧实现、测试过程和截图结论不写入本文。
- 新增陷阱时放入唯一对应小节并保持简短；若源码已使约束显而易见，则无需重复记录。
- 修改后检查 `AGENTS.md` 的任务路由仍能定位本页锚点。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-07-21 | 增加逐页笔迹样式与切入自动播放，并让转场终帧衔接笔迹第 0 帧后再开始内容揭示；why：避免录制切页时先闪出完整内容再手动重播 |
| 2026-07-21 | 为逐页转场增加程序化声音、音量、试听、快速淡出与录制音轨混合，并升级到 v5；why：无需外部音频资源即可让转场声音稳定进入最终视频 |
| 2026-07-21 | 增加逐页幻灯片转场、三档速度、v4 持久化和 board 内合成约束；why：让编辑预览与录制成品共享同一套简洁转场行为 |
