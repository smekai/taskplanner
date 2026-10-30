# Done

## TASK-075: Fix the known defects before 3.0
**Priority:** P2 | **Tags:** testing | **Epic:** 3.0
**Updated:** 2026-10-30 20:08

Phase D of TASK-071.

- Sweep the Backlog and open GitHub issues for bugs and rough edges; pick what must land in 3.0.
- Fix the smoke `counter` case regression noted in TASK-070 (from TASK-069), so `npm run release:check` is fully green.
- **A failed move loses the task (seen 2026-10-29, Windows).** `taskplanner_update` on TASK-071 and `taskplanner_move` of TASK-072 ran concurrently, both writing `IN_PROGRESS.md`. The move had already removed TASK-072 from `BACKLOG.md`; its rename `IN_PROGRESS.md.tmp` → `IN_PROGRESS.md` then failed with `EPERM`. The task existed only in the leftover `.tmp` until it was renamed by hand. Two fixes to weigh: write the destination before cutting the source (a crash then leaves a duplicate, which the duplicate detector handles, instead of a loss), and retry the rename on `EPERM`/`EBUSY`, which Windows returns while another handle has the file open. Related: `moveAtomicity.test.ts`, TASK-064.

### Plan

Sweep (2026-10-30): two code defects, both fixed. Issue #2 (Codex plugin outdated) and Open VSX at 2.4.4 are publishing gaps → TASK-076.
- **Create read the whole board** (smoke `counter`, `EISDIR`): TASK-068's `openBoard()` always reloaded every state, undoing TASK-061. Added `openBoard({ loadAllStates })`; the MCP server's `freshStore` skips the full load when a target state is given.
- **A failed move lost the task**: `moveTask` now writes the destination first. `src/core/store/atomicWrite.ts` gives each write its own temp file, retries EPERM/EBUSY/EACCES renames and removes the temp file on final failure.
- Tests: `atomicWrite.test.ts`, a second-write-fails case in `moveAtomicity` (fails on the old order), and `openBoard` without loading states. `release:check` fully green, 399 tests.
- Not fixed: two processes writing the same file at once can still lose one update (read-modify-write); that belongs with TASK-064.

---
## TASK-072: Band shows the next task when nothing is in progress, and offers setup when there is no board
**Priority:** P1 | **Tags:** ui, feature | **Epic:** 3.0
**Updated:** 2026-10-29 17:02

Phase A of TASK-071 (3.0 first-run experience).

The Claude Code mod's band above the prompt draws only when a task is In Progress, and a folder without `.tasks/` gets a passive "ask Claude to initialize" line. A freshly installed plugin therefore looks like it does nothing.

- When nothing is In Progress, the band shows the highest-priority Next task; when Next is empty, the highest-priority Backlog task. Tasks whose **Waiting until** has not arrived are skipped. It reads `Next · ID · title` with **Start** and **Board**.
- With no board, the pane and band offer **Set up TaskPlanner**, which runs the `initialize-taskplanner` skill.
- Open, not in this task: whether `taskplanner_create` should initialize `.tasks/` itself on first add.

### Plan

- `focusTask` picks In Progress, else the highest-priority non-waiting Next, else Backlog, from full priority-sorted lists that `buildBoard` hands over (review on PR #19: the 50-task view cap could hide the only runnable task).
- Band: `Next · ID · title` with Start + Board; `TaskPlanner · no board here` with Set up where there is no `.tasks/`. Pane: Set up TaskPlanner button. Both submit a prompt for the `initialize-taskplanner` skill.
- Tests: 392 vitest, 22 kit. Merged as PR #19 (admin merge). Not yet checked by hand in Claude Desktop.

---
