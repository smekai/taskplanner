# In Progress

## TASK-091: 3.1 phase D: the daily release watch records its runs on the board
**Priority:** P1 | **Tags:** setup | **Epic:** 3.1
**Updated:** 2026-11-25 20:31

Phase D of TASK-088: dogfooding. Starts after TASK-087 and phase B (the `taskplanner_record_run` tool).

- Create a recurring task "Daily store-status watch" in this repo's Recurring state with `Repeats: 0 8 * * *` (UTC). The scheduled task runs at `0 10 * * *` local time: 09:00 UTC in winter (UTC+1) and 08:00 UTC in summer (UTC+2). A UTC schedule of 08:00 fires at or before the run all year, so a finished check is never shown as due.
- Where the run is recorded (decided 2026-11-25): in the watch's own worktree `C:\Development\smekai\taskplanner-readme-stats`, committed to the daily "README stats" PR. The main checkout and the user's branches stay untouched, and board changes still go through a PR. Accepted cost: `main` shows the watch as due until that PR is merged, and only runs from merged PRs stay in `main`'s history (`history.jsonl` keeps every run).
- Change the `taskplanner-release-watch` scheduled task prompt (`~/.claude/scheduled-tasks/taskplanner-release-watch/SKILL.md`, outside the repo) to record the run with `taskplanner_record_run` and a one-line result, with a by-hand fallback.
- After a few days, check that the board shows the watch as not due after each run and as due when a run is missed.

### Plan

- Board, through a PR: create "Daily store-status watch" with `repeats: 0 8 * * *`, P2, tag `ci`. Without a state it lands in Recurring. Merge before the prompt changes, because the watch's worktree is rebuilt from `origin/main`.
- Scheduled prompt, step 5:
  - after the README stats script, `taskplanner_record_run` in the stats worktree, with a by-hand fallback;
  - stage and compare `.tasks/RECURRING.md` too;
  - commit message and PR title mention the run;
  - the run is still recorded when the README marker is missing.
- Report: one line on whether the run was recorded and how.
- Verify with one manual run (after asking): the stats PR carries the run, and the watch is not due in the worktree.
- Risk: the scheduled session may lack the MCP tool or permission for it. The by-hand fallback covers that; an allow rule is added only with the user's OK.

---
