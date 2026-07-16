> 目的：约束 Claude Code 以低 token 方式接手本项目。　目标读者：Claude Code。　如何阅读：会话开始按下列最小读取协议执行；通用项目状态以 `AGENTS.md` 为准。

# WhiteBoard · Claude Code 规则

## 最小读取协议

1. 会话开始只读仓库根 `AGENTS.md`，不预读 `PROJECT_PLAN.md`、完整 Git 历史或其他文档。
2. 确定任务后，根据 `AGENTS.md` 的任务路由，只读 `docs/IMPL_NOTES.md` 的一个对应小节。
3. 使用小节中的文件名和函数名先 `rg`，再用小范围 `sed`/Read；不要完整读取大型单 HTML，也不要输出完整大 diff。
4. 历史只用 `git log --oneline --stat` 按需查询；先看 `git diff --stat`，再查看目标文件的窄 diff。
5. 默认直接处理，不启动 Explore/subagent；只有用户明确要求或任务真正跨目录、可并行且范围不确定时才使用。
6. 默认只跑与改动直接相关的最小测试；跨模块风险、发布前或用户明确要求时才跑全量测试和浏览器验收。

## 状态维护

- 通用状态、硬约束和当前 TODO 写入 `AGENTS.md`；实现陷阱写入 `docs/IMPL_NOTES.md` 对应小节。
- 小改不更新 `PROJECT_PLAN.md`；只有里程碑或产品决策才更新。
- 不在本文件重复项目状态或实现细节，避免 Claude Code 自动加载重复上下文。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-07-16 | 改为 lean-handoff 最小读取协议，禁止默认预读长文档、完整单 HTML 和大型 diff；why：减少 Claude Code 冷启动和探索 token |
| 2026-07-04 | 初始创建并限制不必要的 subagent 使用；why：本项目主要是结构明确的单文件应用 |
