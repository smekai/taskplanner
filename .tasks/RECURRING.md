# Recurring

## TASK-095: Daily store-status watch
**Priority:** P2 | **Tags:** ci
**Updated:** 2026-11-27 09:06
**Repeats:** 0 8 * * *
**Last run:** 2026-11-27 09:06

Checks every day which TaskPlanner version is live on each store: npm `@smekai/taskplanner`, the VS Code Marketplace, Open VSX, the Cursor Marketplace, Anthropic's Claude plugin directory and the Codex plugin directory, plus downloads, installs and GitHub numbers with deltas. It reports in Russian and keeps the "README stats" PR up to date.

- **Runs as** the Claude scheduled task `taskplanner-release-watch`, at 10:00 local time (09:00 UTC in winter, 08:00 UTC in summer). Prompt: `~/.claude/scheduled-tasks/taskplanner-release-watch/SKILL.md`; history: `history.jsonl` beside it.
- **Records each run** with `taskplanner_record_run` in its own worktree `C:\Development\smekai\taskplanner-readme-stats`, committed to the open "README stats" PR (branch `feature/readme-stats`). `main` shows a run once that PR is merged, so until then this task can read as due.
- **Set up by** TASK-091.

### Runs

- 2026-11-27 09:06 — npm 3.0.12 ✅ · VS Code 3.0.12 ✅ · Open VSX 3.0.12 ✅ · Cursor ❌ · Claude ❌ · Codex 3.0.18 ✅ (expected 3.0.63)

---
