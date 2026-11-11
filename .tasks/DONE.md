# Done

## TASK-083: Claude: dismiss the "no board here" setup band per folder
**Priority:** P2 | **Tags:** ui, feature
**Updated:** 2026-11-11 22:08

In Claude Code the band above the prompt says `TaskPlanner · no board here` with `Set up` in every folder without `.tasks/config.json`, and cannot be closed.

Add a close button; pressing it asks for confirmation that the band will not come back in this folder (`/taskboard` still offers setup). On confirm, remember the folder in the plugin store (`$.store`) and stop drawing the band there. Other platforms have no such band.

### Plan

Done: the setup band has a close button (`role: 'dismiss'`) that switches to "Never show this here again? Ask Claude to bring it back." with Hide / Cancel. Hide sets `setupDismissed:<session root>` to `true` in `$.store`, one key per folder so concurrent sessions and failed reads cannot drop other folders. The mod also registers a `setup_band` tool (`show: boolean`) so Claude can hide the band or bring it back on request. The store is read before the band first draws, so it never flashes. Covered by paneView/boardModel specs and mod kit tests (hide flow, unreadable store, tool hide/show, previously hidden folder).

---
## TASK-082: Clarify the Codex repository plugin and skills-only upload
**Priority:** P2 | **Tags:** docs | **Epic:** 3.0
**Updated:** 2026-11-07 13:30

In PR #33, document the different contents and requirements of the repository-installed Codex plugin and the public skills-only ZIP. Correct the obsolete eight-tool count and remove board_data from the tool inventory. Explain that the public ZIP operates on .tasks files directly unless compatible MCP tools are already available; it does not bundle the MCP server or visual UI.

**Cross-platform:** n/a — documentation only; retained npm/Codex commands apply to PowerShell and POSIX shells. One follow-up commit is planned at shared version 3.0.18 via the repository pre-commit hook.

### Plan

- Done: the Codex README distinguishes the repository plugin from the public skills-only ZIP, lists the seven current tools, and explains MCP/UI availability and runtime requirements.
- Submission documentation references TASK-081 for bundled public MCP support and the OpenAI eligibility requirement.
- Rebuilt the public skills ZIP; both Codex validators and git diff --check passed. One follow-up commit targets shared version 3.0.18.

---
## TASK-080: Codex plugin upload passes the Support URL check
**Priority:** P1 | **Tags:** bug, setup | **Epic:** 3.0
**Updated:** 2026-11-07 12:30

The OpenAI plugin dashboard rejects the Codex upload with "Support URL is required". Per the plugin guidelines the listing URLs live in `interface` of `.codex-plugin/plugin.json` (`websiteURL`, `supportURL`, `privacyPolicyURL`, `termsOfServiceURL`); the packaged manifest only carries privacy and terms.

### Plan
- Done: the packaged Codex manifest takes all four listing URLs (`websiteURL`, `supportURL`, `privacyPolicyURL`, `termsOfServiceURL`) from `submission.json`; the source `plugin.json` carries them too.
- `validate-codex-submission.js` fails when any of them is missing or differs from the submission.
- The OpenAI uploader accepts the rebuilt ZIP with no further complaints.

---

## TASK-078: Upgrade path to 3.0 for existing projects
**Priority:** P1 | **Tags:** docs, setup | **Epic:** 3.0
**Updated:** 2026-11-03 20:08

Before publishing 3.0 (TASK-076), give existing 2.x projects a guided upgrade.

- The `update-taskplanner` skill gets an "Upgrading to 3.0" section:
  - offer to remove a project `.mcp.json` entry that runs `@smekai/taskplanner` when the plugin's tools are already loaded, since they load twice otherwise;
  - point out `taskplanner_board_data` mentions outside the managed markers, and change them only with the user's agreement.
- CHANGELOG gets "Upgrading from 2.x" under `[Unreleased]`.
- Remove this repository's own `.mcp.json`. It duplicated the plugin's tools with the old npm server (2.4.7).
- The managed instructions ask about adding `.mcp.json` only when the TaskPlanner tools are not available.

### Plan

Done.
- Removed the repository's `.mcp.json`; the `.vscodeignore` line stays.
- `update-taskplanner` (identical in all three plugins) gained "Upgrading to 3.0", which runs once when the stored major version is below 3. It offers to remove a duplicate `@smekai/taskplanner` entry from `.mcp.json`, but only when the plugin's tools are loaded. It lists `taskplanner_board_data` mentions outside the markers and edits them only on a yes. The skill text names no literal version, because `validate-versions` allows only the marker.
- The managed-instruction `.mcp.json` hint now applies only when the tools are not available. Regenerated in `CLAUDE.md`, `AGENTS.md`, `.cursorrules` and `example/CLAUDE.md`.
- CHANGELOG: "Upgrading from 2.x" under `[Unreleased]`.

---
## TASK-077: Pre-release fixes from the 3.0 code review
**Priority:** P1 | **Tags:** core, ci, ui | **Epic:** 3.0
**Updated:** 2026-11-03 19:02

Fixes chosen from the high-effort review of `v2.5.0..main` before publishing 3.0 (TASK-076).

- A failed board UI build is swallowed in production, and the stale `mcp/ui/board/index.html` gets synced into all three plugins.
- `npm run watch` does not rebuild the board app when `views/mcp-app/board/*` changes.
- The Claude band labels a Backlog task "Next".
- `buildInstructionContent` sorts `config.states` in place.
- State files are rewritten even when their content is unchanged (TASK-064 part 1).
- `writeFileAtomic` leaves a `.tmp` behind when the temp write itself fails.
- Custom state names are not supported by the band or `include_completed`; document this as a known limitation.

Deferred: custom state names, and the bundle version bump using `replaceAll`, which CI guards.

### Plan

Done: fixed 6 of the 9 review findings. One is documented as a known limit and two are deferred.
- Build: a board UI failure in a one-shot build now fails the build. `clean-dist` removes `mcp/ui`. `npm run watch` watches `views/mcp-app/board/`.
- The band labels the task with its own state, e.g. "Backlog · …". The view spec and the kit test changed to match.
- `aiInstructions` sorts a copy of `config.states`.
- `FileStore.commitWrites` skips a file whose serialized content is byte-identical (`PreparedWrite.isUnchanged`). In practice this saves little, because real edits change `**Updated:**`.
- `writeFileAtomic` removes the temp file when the write itself fails; the write is injectable for the test.
- Known limit: custom state names, noted in README and views/claude/README. Deferred: the bundle bump's `replaceAll`, and moving `.mcp.json` (the user is deciding).

---
## TASK-074: Remove the MCP tools 3.0 does not need
**Priority:** P2 | **Tags:** core, refactor | **Epic:** 3.0
**Updated:** 2026-11-02 16:40

Phase C of TASK-071. Depends on TASK-073 (every view stays, decoupled on one core).

`src/mcp/server.ts` registers 8 tools. Since every view stays, a tool goes only once it is clearly irrelevant, not because of usage numbers (3.0 ships without telemetry, see TASK-073).

Current users of the tools that are candidates to merge or drop:

- `taskplanner_board_data`: the MCP UI app and the `board` skill.
- `taskplanner_board_visual`: the `board` skill.
- `taskplanner_board`: overview for agents; check whether `taskplanner_list` or the digest covers it.
- `taskplanner_get` / `taskplanner_move`: the MCP UI app.
- `taskplanner_move` / `taskplanner_create`: the Claude Code mod's writes.

Removing a tool is a breaking change for `@smekai/taskplanner`. Note it in the 3.0 changelog and update the skills, rules and READMEs that name the tool.

### Plan

Done. Every tool had a user. `taskplanner_board_data` was removed because it duplicated `taskplanner_board_visual`; 7 tools remain.
- `board_visual` takes `query`, `include_completed` and `limit`, and the board app refreshes through it, reading `structuredContent.board`.
- The smoke test checks the exact 7-tool list and the "show more" refresh.
- Skills, the plugin READMEs, the root README, `mcp/README.md`, `views/mcp-app/CLAUDE.md` and the CHANGELOG (Removed, breaking) are updated. Also fixed the repo Cursor skill's tool list, which was one line with literal `\n+`.
- Not verified by hand: the board app refreshing in Cursor or Claude Desktop without opening a second view.

---
## TASK-073: One folder per harness: views/ and mcp/, on a domain-only core
**Priority:** P2 | **Tags:** ui, docs | **Epic:** 3.0
**Updated:** 2026-11-01 20:30

Phase B of TASK-071.

## Decisions (2026-10-30)

- **No telemetry in 3.0.** In the Claude Code mod it is impossible (the mods API has no network access). In the MCP server it would be opt-in only, with no consent UI. Only the VS Code extension could do it properly (`vscode.env.createTelemetryLogger`, honouring `telemetry.telemetryLevel`), and that is the one surface we do not need data for. Revisit after 3.0 only if the public numbers are not enough.
- **Collect the public numbers instead.** GitHub traffic expires after 14 days, so it must be saved regularly or it is lost.
- **Keep every view, rather than choosing which to drop.** Drop a tool only once it is clearly irrelevant.
- **Direction:** one core, with every view a separate client of it. No view depends on another view, or on the MCP server, unless it has to.

## Public numbers, 2026-10-30

| Source | Numbers |
| --- | --- |
| Open VSX (Cursor) | 4268 downloads, ★5 (1); **still at 2.4.4** |
| VS Code Marketplace | 116 installs, 553 downloads, ★5 (1) |
| npm `@smekai/taskplanner` | 103 downloads in the last month |
| GitHub | 23★, 4 forks; 14 days: 153 clones (73 unique), 58 views (33 unique) |

## Coupling today

- **VS Code / Cursor extension** — core only (`TaskStore`, `ConfigManager`, `projectSync`). Touches MCP only to write `.mcp.json` during setup. Already independent.
- **MCP server** — core only.
- **MCP UI app** (`src/mcp/ui/board/`) — goes through the server's `taskplanner_board_data`, `taskplanner_get` and `taskplanner_move`. Coupled to the server by design: it runs inside the MCP host.
- **Claude Code mod** — reads through the core parser. Writes through the server's `taskplanner_move` / `taskplanner_create`: the mod has no node `fs`, and auto-mode approval rides on those calls. It also keeps its own `boardDigestText` beside `core/ai/boardDigest`.
- **`board` skill** — names `taskplanner_board_visual` / `taskplanner_board_data`, so it depends on the server.

## To do

- For each view, list what it re-implements that the core already has (start with the mod's digest versus `core/ai/boardDigest`, and the mod's board model versus `core/view/boardViewModel`), then move the shared parts into core.
- Write down which coupling to the MCP server is required (the mod's writes, the UI app) and which is incidental.
- Feed the list of tools each view needs into TASK-074.
- Optional: a small script or weekly scheduled task that saves the public numbers above.

### Plan

Done 2026-11-01. One folder per harness on a domain-only core, and duplicating code between harnesses is fine.
- Layout:
  - `src/core/`;
  - `mcp/` (server + npm package);
  - `views/vscode` (`src/`, `test/`), `views/mcp-app`;
  - `views/claude` (plus `mod/`), `views/cursor`, `views/codex`, each a separate plugin with its own skills and committed `dist/` and `ui/`.
- Moved with `git mv`, imports rewritten by script. The extension-only modules (`promptComposer`, `planMode`, `codexDeepLink`, `aiInstructions`, `projectSync`) left core; `DEFAULT_WORK_LOG_CONTENT` moved to `core/store/archive.ts`.
- Build:
  - esbuild builds once into `mcp/` and copies to every plugin;
  - `bump-version` / `validate-versions` cover 3 manifests and 9 skill files;
  - each validator checks only its own folder;
  - the marketplace `source` fields point at `views/*`.
- Lint boundaries (`no-restricted-imports` overrides) were each verified with throwaway violations (17 caught).
- Docs: root and per-harness `CLAUDE.md` (the Claude one sits in `mod/`, since `--strict` rejects one at the plugin root), README per plugin, CONTRIBUTING, AGENTS.md.
- Found along the way:
  - the VSIX shipped `.claude/settings.local.json`, `.github/` and dev configs (now excluded; 30 files);
  - `tsc` over `mcp/src/server.ts` has a pre-existing TS2536 that nothing runs.
- `release:check` green: 400 tests, smoke, 22 kit tests. npm `index.d.ts` is unchanged. Not done: a local Claude marketplace install from the branch.

---
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
