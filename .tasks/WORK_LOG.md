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

## TASK-075 — 2026-10-30
**What:** Fixed the two known defects. A failed move could lose a task, and MCP create read the whole board again.
**Decisions:** A move writes the destination first, so a failure leaves a duplicate rather than a loss. Each write gets its own temp file, and EPERM/EBUSY/EACCES renames are retried. `openBoard({ loadAllStates: false })` restores TASK-061's targeted create.
**Outcome:** `release:check` fully green for the first time since TASK-069. A concurrent read-modify-write can still lose one update (TASK-064).

---

## TASK-072 — 2026-10-29
**What:** The Claude Code band shows the next task (Next, then Backlog, skipping waiting) when nothing is in progress, and offers Set up where there is no board.
**Decisions:** The setup band shows in every repository without a board, so a fresh install is visible; the band picks from full lists, not the pane's 50-task view (PR #19 review).
**Outcome:** Merged as PR #19 (admin merge). First step of 3.0 (TASK-071); not yet checked by hand in Claude Desktop.

---


