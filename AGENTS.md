> 目的：让任意 AI 工具以最少上下文接手 WhiteBoard。　目标读者：接手开发的 AI 或开发者。　如何阅读：会话开始只读本文；确定任务后，只读 [`docs/IMPL_NOTES.md`](docs/IMPL_NOTES.md) 的对应小节。

# AGENTS.md — WhiteBoard 精简接手索引

> 本文是当前状态索引，不保存长篇实现历史。实现细节按需查 `docs/IMPL_NOTES.md`，产品规划按需查 `docs/PROJECT_PLAN.md`，历史使用 `git log --oneline --stat`。不要预读全部文档、全量扫描代码库或输出大型 HTML 的完整 diff。

## 一句话定位

单 HTML 白板录制工具：浏览器本地完成编辑、幻灯片、摄像头、录屏与导出；静态入口和轻量 Node + Neon 服务提供购买、账号与设备授权。

## 运行与最小测试

```bash
cd /Users/Zhuanz/Claude/WhiteBoard
npm install
npm run build:static                 # 校验公共发布白名单
python3 -m http.server 8000          # 静态页：http://localhost:8000
npm start                            # 账号 API；需先配置 .env
```

- 优先运行与本次修改直接相关的测试；跨模块或发布前才升级为 `npm test`。
- 摄像头、麦克风和录屏必须使用 HTTPS 或 localhost，不能依赖 `file://`。

## 硬约束

1. 白板编辑器继续保持独立单 HTML，账号服务不得侵入绘图和录制核心。
2. 登录顺序必须是本地 `accounts.json` 优先、Neon `/api/login` 兜底；有效静态账号必须立即放行，不得等待后端。允许随后通过 `/api/login-audit` 非阻塞核验重叠 Neon 账号并记录 IP；修改登录时同步检查 `index.html` 与 `whiteboard-pro.html`。
3. 公共站点只能由 `npm run build:static` 的白名单产物发布；不得发布仓库根目录，不得提交数据库连接串、明文密码、Cookie 密钥或管理令牌。
4. 录制来源只有白板与屏幕两类，摄像头、麦克风和来源画面最终合成一个视频；提词器及选择框、幻灯片边框等 DOM 辅助层不得进入录像。
5. 屏幕裁剪 `screenCropNorm/#screenCropFrame` 与白板取景框 `recConfig.frame/#recFrame` 必须分离；`screenVideo` 只作隐藏取帧源，不能改成实时铺满预览。
6. MP4 优先使用浏览器原生 `MediaRecorder`；不支持时才懒加载 ffmpeg.wasm 转码，这是唯一允许的运行时 CDN 依赖。
7. 保持现有简单、方便的账号架构，不擅自增加复杂安全流程；但任何密钥和明文账号不得进入 Git。
8. 默认不用 subagent；先用 `rg` 定位，再小范围读取。只在用户明确要求或真正跨目录、可并行的开放探索时使用。

## 当前状态（2026-07-18）

- 核心白板、对象变换、富文本、图片/贴纸、幻灯片、白板录制、录屏裁剪、摄像头效果与 MP4 回退已实现，真实媒体细节仍需真机持续验收。
- 商业化 MVP 已具备免费限制、购买弹窗、静态账号、Node + Neon 会话/设备授权、管理后台和公共静态构建。
- 静态账号与 Node/Neon 共用盐值 `wb-static-pro-salt-v1`；静态用 SHA-256，后端用 scrypt；密码最少 4 位。
- 付费配置已拆为独立 `paywall.json`（59 元 / `leewen2017`），`accounts.json` 只保存账号；管理页可分别保存、拉取和部署两个文件。
- Neon 登录不再 `document.write()` 重载白板；当前页会由 `/api/session` 动态提升为 Pro，右下角显示用户名并提供统一退出。
- 三个用户登录入口（独立登录页、免费版升级弹窗、Pro 模板弹窗）均使用眼睛/斜线眼睛图标显示或隐藏明文密码，并保持悬停提示与无障碍状态同步。
- 男生、女生与综合彩铅贴纸新增 5 个“惊喜”表情：含同角色无道具版本、发现新事物版本及综合无道具版本，并同步到独立版与 Pro 模板。
- 男生与女生彩铅贴纸均新增“表扬”表情；综合组另加入用户提供的圆形“女孩点赞”贴纸，三张素材均同步到独立版与 Pro 模板。
- 新增“会议场景”彩铅漫画组，以 6 张连续贴纸表现远程会议、AI 实时记录、实时翻译、详细纪要、会议总结与行动计划，并同步到两个白板版本。
- 贴纸工具面板层级高于幻灯片边框、标签和“笔迹”按钮，画布辅助层不再穿透已打开的工具面板。
- 两个白板版本的选择工具均支持从空白处拖框多选，并可整体移动或按 Delete / Backspace 批量删除；单对象缩放、旋转和文字编辑保持不变。
- 提词器可从标题栏拖动且始终限制在视口内；打开或移动提词器不会再把右侧幻灯片选择面板移到其下方遮住。
- 两个白板版本的全部画布对象（含图片、贴纸、文字、图形和笔迹）均可置底、下移一层、上移一层或置顶；多选调整时保持组内相对顺序并只写一次撤销历史。
- 两个白板版本的录制设置均新增可选文字水印：支持 40 字、九宫格定位、预览拖动、大小/透明度和本机记忆，并同时进入白板录制与录屏成品。
- 两个白板版本均可从左上角设置整份白板底色，并允许当前幻灯片单独覆盖或恢复继承；颜色写入 v2 文档、撤销历史、鸟瞰图、笔迹播放和白板录像。
- `file://` 打开两个登录入口时会优先使用本机账号缓存，否则读取已部署的 `https://record.leewen.work/accounts.json`；Render 静态站开放该 JSON 只读跨域，账号 API 允许 `Origin: null` 作为 Neon 兜底。
- Neon 登录以及同时存在于 `accounts.json` 和 Neon 且密码一致的本地登录，会在用户放行后异步记录 IP、设备、浏览器和时间；管理页展示每个账号最近 100 条，并提示任意 1 小时窗口内的多 IP 情况。纯本地账号不记录。
- 账号管理页会合并 Neon 与 `accounts.json` 的全部账号；重叠账号只显示一次，静态独有账号标注来源并跳转到静态账号工具管理。

## 下一步 TODO

- [ ] 部署后验证 `record.leewen.work` 的 `accounts.json` CORS、`auth.record.leewen.work` 的 `Origin: null`、Secure Cookie、`/health`、登录 IP 记录与 Render 环境变量。
- [ ] 真机验证 1/3 台设备限制、停用、改密、清空设备、刷新恢复和退出。
- [ ] 真机验证 Chrome/Safari 的白板录制、整屏裁剪、摄像头/麦克风/系统声与 MP4 成品。

## 任务路由（只读对应小节）

| 任务 | 按需读取 |
|------|----------|
| 登录、账号、Neon、购买配置、发布白名单 | [`IMPL_NOTES · Auth`](docs/IMPL_NOTES.md#auth) |
| 对象、文字、图片、选择/缩放/旋转、绘图样式 | [`IMPL_NOTES · Objects`](docs/IMPL_NOTES.md#objects) |
| 幻灯片、比例、鸟瞰图、DOM 浮层 | [`IMPL_NOTES · Slides`](docs/IMPL_NOTES.md#slides) |
| 摄像头、麦克风、白板录制、录屏、导出 | [`IMPL_NOTES · Recording`](docs/IMPL_NOTES.md#recording) |
| 彩铅人物贴纸和图片资源 | [`IMPL_NOTES · Stickers`](docs/IMPL_NOTES.md#stickers) |
| 产品范围、里程碑、完整手测清单 | 按需读取 [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) |

## 文件地图

- `index.html` / `whiteboard-pro.html` — 公共入口与商业化白板模板；登录改动需成对检查。
- `whiteboard.html` — 独立白板应用；核心录制行为应与商业化模板保持一致。
- `accounts.json` / `paywall.json` / `account-admin1.html` — 静态哈希账号、独立购买配置与离线生成工具。
- `account-admin.html` / `server/` — Neon 管理页与 Node 账号 API。
- `scripts/build-static.mjs` / `tests/` / `render.yaml` — 发布白名单、自动测试与部署配置。
- `docs/IMPL_NOTES.md` — 当前实现细节；`docs/PROJECT_PLAN.md` — 产品与里程碑；历史看 Git。

## 维护规则

- 每次收尾先看 `git diff --stat` 和目标文件窄 diff，再更新“当前状态 / 下一步 TODO”；已完成项立即删除或勾选。
- 小改只更新本索引；里程碑才更新 `PROJECT_PLAN.md`。实现陷阱写入 `IMPL_NOTES.md` 对应小节，不把长历史重新塞回本文。
- 文档开头保留“目的 / 目标读者 / 如何阅读”，结尾保留最多 3 条变更记录；更早历史交给 Git。
- 只有用户明确要求时才 commit/push；GitHub remote 必须使用 SSH。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-07-18 | 账号管理列表合并 Neon 与 accounts.json 的全部账号并区分静态独有账号；why：让未产生 Neon 登录记录的既有静态账号也始终可见 |
| 2026-07-18 | 增加 Neon 与本地/Neon 重叠账号的成功登录 IP 历史和一小时多 IP 提醒，审计均不进入登录等待路径；why：扩大账号共享识别范围且不拖慢本地登录 |
| 2026-07-17 | 增加整份白板底色与当前幻灯片覆盖，并同步保存、撤销、鸟瞰图、笔迹播放和录像；why：让课件编辑和录制成品使用一致的视觉底色 |
