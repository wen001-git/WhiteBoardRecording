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
2. 登录顺序必须是本地 `accounts.json` 优先、Neon `/api/login` 兜底；有效静态账号必须短路后端。修改登录时同步检查 `index.html` 与 `whiteboard-pro.html`。
3. 公共站点只能由 `npm run build:static` 的白名单产物发布；不得发布仓库根目录，不得提交数据库连接串、明文密码、Cookie 密钥或管理令牌。
4. 录制来源只有白板与屏幕两类，摄像头、麦克风和来源画面最终合成一个视频；提词器及选择框、幻灯片边框等 DOM 辅助层不得进入录像。
5. 屏幕裁剪 `screenCropNorm/#screenCropFrame` 与白板取景框 `recConfig.frame/#recFrame` 必须分离；`screenVideo` 只作隐藏取帧源，不能改成实时铺满预览。
6. MP4 优先使用浏览器原生 `MediaRecorder`；不支持时才懒加载 ffmpeg.wasm 转码，这是唯一允许的运行时 CDN 依赖。
7. 保持现有简单、方便的账号架构，不擅自增加复杂安全流程；但任何密钥和明文账号不得进入 Git。
8. 默认不用 subagent；先用 `rg` 定位，再小范围读取。只在用户明确要求或真正跨目录、可并行的开放探索时使用。

## 当前状态（2026-07-16）

- 核心白板、对象变换、富文本、图片/贴纸、幻灯片、白板录制、录屏裁剪、摄像头效果与 MP4 回退已实现，真实媒体细节仍需真机持续验收。
- 商业化 MVP 已具备免费限制、购买弹窗、静态账号、Node + Neon 会话/设备授权、管理后台和公共静态构建。
- 静态账号与 Node/Neon 共用盐值 `wb-static-pro-salt-v1`；静态用 SHA-256，后端用 scrypt；密码最少 4 位。
- 付费配置已拆为独立 `paywall.json`（59 元 / `leewen2017`），`accounts.json` 只保存账号；管理页可分别保存、拉取和部署两个文件。
- Neon 登录不再 `document.write()` 重载白板；当前页会由 `/api/session` 动态提升为 Pro，右下角显示用户名并提供统一退出。

## 下一步 TODO

- [ ] 部署后验证 `record.leewen.work`、`auth.record.leewen.work`、Secure Cookie、`/health` 与 Render 环境变量。
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
| 2026-07-16 | 拆分独立 `paywall.json` 并改为动态恢复 Neon Pro 会话，移除 `document.write()` 整页重载；why：账号与购买配置职责分离，同时修复登录后重复声明和账户按钮不同步 |
| 2026-07-16 | 将 68 KB 接手文档改为精简索引，并把实现细节迁往按需读取的 `IMPL_NOTES.md`；why：显著降低跨 AI 工具冷启动 token，同时保留当前故障和关键红线 |
