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

## TASK-080 — 2026-11-07
**What:** The Codex upload ZIP carries `supportURL` and `websiteURL`; OpenAI no longer rejects it with "Support URL is required".
**Decisions:** `submission.json` stays the single source; the packager copies all four listing URLs and the validator checks them.

---

## TASK-077 — 2026-11-03
**What:** Fixed the pre-release review findings. A failed board UI build now fails the build, watch mode rebuilds the board, the band names the real state, instructions no longer re-sort the config, unchanged files are skipped, and a failed write leaves no `.tmp` behind.
**Decisions:** Custom state names are documented as a known limitation rather than supported in 3.0.
**Outcome:** `release:check` green with 412 tests. Skipping unchanged writes saves less than the review claimed, because a real edit changes `**Updated:**`.

---

## TASK-078 — 2026-11-03
**What:** Added the 2.x → 3.0 upgrade path: an "Upgrading to 3.0" step in `update-taskplanner`, CHANGELOG upgrade notes, and removed this repository's duplicate `.mcp.json`.
**Decisions:** The skill only offers changes outside the managed markers: removing the duplicate `.mcp.json` entry, and only when the plugin's tools are loaded, and replacing `board_data` mentions. It never edits them silently.

---

## TASK-074 — 2026-11-02
**What:** Removed `taskplanner_board_data`; the board app refreshes through `taskplanner_board_visual`, which took over its `query`, `include_completed` and `limit`. 7 MCP tools remain.
**Decisions:** Every other tool has a user. `taskplanner_board` stays as the agents' compact digest, separate from the visual board, so an agent's overview does not open a board view in MCP Apps hosts.
**Outcome:** `release:check` green; the smoke test checks the exact tool list. The board app refresh in a real MCP Apps host has not been checked by hand yet.

---

## TASK-073 — 2026-11-01
**What:** Moved to one folder per harness on a domain-only core: `mcp/`, plus `views/vscode`, `mcp-app`, `claude`, `cursor` and `codex`. The three host plugins became separate folders, each with its own skills.
**Decisions:** Duplicating code between harnesses is fine. Each harness imports only core and itself, and `no-restricted-imports` overrides enforce it. Extension-only modules left core.
**Outcome:** `release:check` green; npm public types unchanged. The VSIX no longer ships repo config such as `.claude/settings.local.json`.

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


