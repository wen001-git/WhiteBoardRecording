# WhiteBoard 项目 Claude Code 规则

跨 AI 工具协作规则见仓库根 `AGENTS.md`（Codex/其他工具也读它，勿把 Claude Code 专属规则写进去）；这里只放 Claude Code 专属、不适合放进 AGENTS.md 的规则。

## Subagent 使用效率

遵循全局规则（`~/.claude/CLAUDE.md`）。本项目补充：`index.html`（当前主版本，2026-07-04 前叫 `index-v2.html`）/`index-old.html`（旧版归档）是结构清晰的单文件应用，`AGENTS.md` 的「文件地图 / 关键实现备忘」通常已经指到具体函数和行号——**默认先读 `AGENTS.md` + 目标文件的相关区域，几乎不需要 Explore 子代理**；确实要用时限定在真正跨文件/跨目录、范围不确定的探索上。

## 变更记录
| 日期 | 变更内容 |
|------|---------|
| 2026-07-04 | 同步文件改名：定稿版提升为 `index.html`，旧版归档为 `index-old.html` |
| 2026-07-03 | 初始创建：落实 subagent 使用经济性规则（用户反馈单会话 token 消耗大头来自子代理密集调用），并补充本项目单文件结构下通常无需 Explore 子代理的具体判断依据 |
