# Work Log

Top-level trace of completed work and key decisions. One entry per task moved to Done — newest at top. Keep entries short (3–5 lines); detailed steps stay in each task's `### Plan` in `DONE.md`. Older entries live under `.tasks/archive/`.

**Entry template** (insert after this header, before existing entries):

```markdown
## TASK-### — YYYY-MM-DD
**What:** One-line summary of what was delivered.
**Decisions:** Key choices made and why (skip if none).
**Outcome:** Result or follow-ups (skip if obvious from What).

---
```

---

## TASK-070 — 2026-10-15
**What:** Made `plugins/taskplanner/` a Claude Code plugin whose mod opens a live board pane (`/taskplanner:board`, `/taskboard`) in the Desktop Code tab and the terminal. The pane can move tasks, create them, start them with Claude and draft edits in the prompt; a band above the prompt shows the task in progress.
**Decisions:** The mod reads `.tasks/` with the core parser and writes only through the MCP server, from `ui.press`/`ui.input` hooks. A `$.mcp.call` from a timer or `onPress` skips the mod's own `tool.check`, so auto mode refused it. The Desktop type scale is gated on Claude Code ≥ 2.1.299.
**Outcome:** 377 vitest and 16 kit tests pass on three engine versions. No top-bar launcher exists in the mods API. The smoke `counter` case still fails on main (a TASK-069 regression).

---


