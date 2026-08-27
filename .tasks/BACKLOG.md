# Backlog

## TASK-054: initialize writes no MCP config, so hosts outside Cursor never reach the tools
**Priority:** P1 | **Tags:** core, setup | **Epic:** 2.2.x
**Updated:** 2026-08-27 12:05

Split out of TASK-048, which covers the guidance half. This is the wiring half.

**Verified against current code (2.1.14).** `src/core/project/projectSync.ts` writes exactly three
files — `AGENTS.md`, `CLAUDE.md`, `.cursorrules` — plus optional README attribution. Searching
`src/core/` and `src/extension/` for `.mcp.json` or `mcpServers` returns nothing.

**Not universally broken, which is why the original framing was wrong:**

- **Cursor** — works. `src/extension/extension.ts:151` calls `cursor.plugins.registerPath(pluginDir)`,
  and `plugins/taskplanner/mcp.json` points at the bundled server. Tools are reachable.
- **Codex** — works via the repository marketplace at `.agents/plugins/marketplace.json`, though in
  this repo that file is committed by hand, not produced by `initialize`.
- **Claude Code and other hosts that read `.mcp.json`** — no path at all.
- **npm consumers** — install `@smekai/taskplanner` and get nothing wired up; they must hand-write
  the config from `packages/mcp-server/README.md`.

**Observed (isotopy, 2026-08-17, 2.1.4):** the repo had no `.mcp.json`, so no tool was reachable and
the agent hand-edited markdown all session. **This repository has no `.mcp.json` either** — tasks
TASK-048..053 were filed by hand-editing `BACKLOG.md`, the defect reproducing on its own maintainer.

**The open design question, which is why this is not a one-liner:** what command should a generated
`.mcp.json` contain? The extension's own copy of the server sits at an OS- and install-dependent
path, which is exactly what TASK-046 existed to stop consumers depending on. `npx -y
@smekai/taskplanner` is portable and resolves the published package, but adds a first-run download
and assumes npm is present. Writing an `.mcp.json` into a user's repository also means writing a
file that tells their agent to execute something — that should be opt-in, or at least announced,
not a silent side effect of Initialize.

**Done looks like:** a decision recorded on the command form and on consent, then `initialize`
offers or writes the config for hosts that need it, resolving the server the way
`packages/mcp-server/README.md` documents rather than by a path that depends on which editor is
installed.

---

## TASK-049: Generated instructions still demand a Plan when aiPlanRequired is false
**Priority:** P1 | **Tags:** core, docs | **Epic:** 2.2.x
**Updated:** 2026-08-27 11:12

**Observed (isotopy, 2026-08-17, 2.1.4):** the repo sets `"aiPlanRequired": false`, yet its
generated `CLAUDE.md` carried the full Plan section. The agent read the flag, saw `false`, and
wrote a `### Plan` block anyway, because the prose sat under a heading called
**"Mandatory checklist (do not skip)"** and prose outranks a config value.

**Verified against current code (2.1.14): partly fixed, one defect left.** Rendering
`generateAiInstructions({ ...createDefaultConfig(), aiPlanRequired: false })` shows the
`### Planning Requirement` section and the numbered "Write a plan" step are now correctly omitted.
What still renders, verbatim, under *Mandatory checklist (do not skip)*:

> - **Plan:** If this project requires a plan (check the **aiPlanRequired** field in
>   .tasks/config.json), the `### Plan` block must exist in IN_PROGRESS **before** coding, and
>   should be **trimmed to a short done-summary** when you move the task to DONE.

The generator knows the answer and emits a conditional pointing at a file instead. Two incidental
mentions survive too — "trim `### Plan` to a done-summary" in the Done step, and "Detailed steps
belong in the task's `### Plan`" in the Work Log section — both describing an artefact that should
not exist in this configuration.

**File:** `src/core/ai/aiInstructions.ts`; the checklist bullet is the load-bearing one.

**Why it matters:** the flag is the only knob a user has to turn planning off, and it visibly does
not work. Same npm-launch exposure as TASK-048.

**Done looks like:** with `aiPlanRequired: false` the generated instructions contain no instruction
to write, trim, or maintain a `### Plan`, and the checklist bullet is dropped rather than made
conditional-in-prose. A unit test renders both variants and asserts the false one is Plan-free.

---

## TASK-050: sortBy reads as a file-ordering contract but is view-only
**Priority:** P1 | **Tags:** core, docs | **Epic:** 2.2.x
**Updated:** 2026-08-27 11:12

`sortBy` lives in `.tasks/config.json` next to `insertPosition`, which genuinely does affect where a
task lands in the markdown. Nothing signals that one is layout and the other is presentation, and at
a glance `insertPosition: "top"` and `sortBy: "priority"` look like they contradict each other.

**Observed (isotopy, 2026-08-17, 2.1.4):** the agent concluded file order was meant to be
priority-ordered, hand-reordered `BACKLOG.md` to "fix" a P2-sitting-above-P0 ordering that never
mattered to anything, and corrupted the file's encoding while doing it.

**Verified against current code (2.1.14):** still open. `sortBy` is referenced only in
`src/core/filter/taskFilter.ts`, `src/core/view/boardViewModel.ts`, `src/core/model/config.ts` and
the extension's view layer. It appears zero times in `src/core/store/taskStore.ts` and
`src/core/parser/taskSerializer.ts` — nothing ever reorders the markdown.

**Why it matters:** the cost is not a wrong sort order, it is an agent rewriting task files to
satisfy a setting that was never about files. Destructive, and unprompted.

**Done looks like:** the ambiguity is gone — file order is documented as insignificant, in the
generated instructions and in the config reference, and/or view-only settings move out of the file
that describes file layout. Either route, a reader can tell which keys affect bytes on disk and
which affect a panel. Worth deciding at the same time whether `insertPosition` and `sortBy` belong
in the same object at all.

---

## TASK-051: epic is write-only in practice — absent from MCP inputs and from groupBy
**Priority:** P2 | **Tags:** core, feature | **Epic:** 2.2.x
**Updated:** 2026-08-27 11:12

`Task.epic` exists in `src/core/model/task.ts`, parses via `EPIC_RE` in `taskParser.ts`, serializes
as `**Epic:** x` on the meta line in `taskSerializer.ts`, and is editable in the task list webview.
An agent still cannot set it, and nobody can group by it.

**Verified against current code (2.1.14):** the `inputSchema` of `taskplanner_create` accepts
`title`, `priority`, `tags`, `assignee` — no `epic`; `taskplanner_update` accepts the same four.
`groupBy` in `src/core/filter/taskFilter.ts:138` is typed `'status' | 'assignee' | 'date' | 'none'`.

**Observed (isotopy, 2026-08-17, 2.1.4):** the project organises everything around milestones and
encodes them three separate ways because the real field is unusable — a `milestone-f` tag, a prose
scope list inside an epic task, and the unused `epic` field. The prose list drifted: TASK-125 still
described TASK-128 as "the closing dogfood" after TASK-141/142 superseded it, and had to be
corrected by hand. Asked "what milestone are these new defects in?", the answer was "none — the tag
was forgotten". A first-class grouped field makes that visible instead of discoverable by accident.

**Scope:** add `epic` to the `taskplanner_create` and `taskplanner_update` inputs, and add `'epic'`
to `groupBy` — filter, board view model, and the sidebar/kanban surfaces that offer the choice.

**Done looks like:** an agent can set and change `epic` through MCP, the sidebar can group by it,
and a task with no epic groups under a visible "No epic" bucket rather than disappearing.

---

## TASK-052: No way to express "blocked until", so agents pick undoable work
**Priority:** P3 | **Tags:** core, feature | **Epic:** 2.2.x
**Updated:** 2026-08-27 11:12

The generated workflow tells agents to pick the highest-priority task from NEXT. There is nothing a
task can carry to say "not yet".

**Observed (isotopy, 2026-08-17, 2.1.4):** TASK-142 sits in NEXT at P0, hard-blocked on an external
quota reset until 2026-09-03. A compliant agent picks it and cannot do it.

**Related, same root:** priority is global while relevance is per-milestone. After four defects
moved into a not-yet-started milestone at P0, the board interleaves "critical path this month" with
"important, but months away" under one label. Overlaps with TASK-051 — an `epic` that groups would
already separate the two visually.

**Verified against current code (2.1.14):** no `waitingUntil`, `blocked` or equivalent anywhere in
`src/core/` or `src/mcp/`. Default states are Backlog, Next, In Progress, Done, Rejected.

**Deliberately not over-built:** there is exactly one blocked task today, across both repos. The
cheapest sufficient answer wins. Options, roughly ascending in cost: a documented convention (a
`blocked` tag plus a date in the description) that the generated instructions teach agents to
respect; a `waitingUntil` field parsed like `Updated`; a `Blocked` entry in `states[]`. A convention
plus one line in the generated workflow may be the whole task.

**Done looks like:** an agent following the generated instructions does not select a task that
cannot start, and whatever mechanism is chosen is written into those instructions rather than left
as tribal knowledge.

---

## TASK-053: No archiving story for DONE.md
**Priority:** P3 | **Tags:** core, feature | **Epic:** 2.2.x
**Updated:** 2026-08-27 11:12

`DONE.md` is the historical record, so agents grep it and load parts of it constantly, and it only
grows. There is no supported way to archive completed work — per milestone, per release, or by age
— while keeping it findable.

**Observed (isotopy, 2026-08-17, 2.1.4):** `.tasks/DONE.md` is 3,831 lines. For scale, this
repository's own `DONE.md` is 629 lines, so the pain arrives well before a project feels large.

**Verified against current code (2.1.14):** no archive command, tool, or setting.
`src/core/store/taskStore.ts:14` already defers full parsing of large states, with a comment
referring to "large archives" — the read path anticipates this, the write path has no answer.

**Lowest priority of the six.** Annoying, not yet painful; filed so it is not rediscovered from
scratch later.

**Done looks like:** completed tasks can move out of `DONE.md` into a dated or milestone-scoped
archive that stays greppable and parseable, without breaking ID uniqueness or the deferred-load
behaviour, plus a decision on whether archived tasks remain visible in any view.

---

## TASK-036: Harden config.json loading — validate states, log failures to output channel
**Priority:** P1 | **Tags:** core, setup
**Updated:** 2026-07-27 13:35

**Validation (2026-07-27):** Still needed. `ConfigManager.load()` merges parsed JSON with defaults but does not validate `states` entries. Malformed `states` (e.g. plain strings instead of `{name, fileName, order}`) still break `path.join(tasksDir, state.fileName)` in `fileStore.ts`. `migrateConfig()` can still append a `Rejected` object onto a string-array `states` list. A `TaskPlanner` output channel exists in `extension.ts` but is not used for config load failures; no user warning on bad config. No tests for malformed `states`.

**Scope:**
- Validate/normalize `states` on load (map known names to `DEFAULT_STATES` objects; otherwise fall back to `DEFAULT_STATES`).
- Log problems to the `TaskPlanner` output channel and show a warning notification.
- Fix `migrateConfig()` so it does not corrupt string-array configs.
- Add unit tests for malformed `states`.

---

## TASK-023: CI/CD pipeline for extension delivery
**Priority:** P4 | **Tags:** setup, ci
**Updated:** 2026-07-27 13:35

**Validation (2026-07-27):** Partially addressed — not done as originally written.

**Already in place:**
- PR CI workflow (`.github/workflows/ci.yml`): `npm ci`, lint, test, build.
- Manual release path: `npm run release:check`, `npm run package`, CONTRIBUTING publish steps (`vsce` / `ovsx`).
- Extension published on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=refined.taskplanner) and [Open VSX](https://open-vsx.org/extension/refined/taskplanner).
- Cursor/Codex plugin packaging and validation scripts; Cursor marketplace submission documented (see TASK-035 in Done).

**Still missing:**
- Automated publish/release workflow (tag → build → publish VSIX to Marketplace/Open VSX).
- Auto-merge for PRs into `main` after checks pass.
- JetBrains Marketplace exploration (no IntelliJ plugin in repo yet).

**Scope (revised):** Add release/publish automation and optional auto-merge; treat JetBrains as a separate follow-up once TASK-019 exists.

---

## TASK-019: IntelliJ IDEA extension and Julia format support
**Priority:** P3 | **Tags:** feature
**Updated:** 2026-07-27 13:35

**Validation (2026-07-27):** Still needed — no implementation in repo. README lists JetBrains IDEs as planned. `src/core/` has no `vscode` imports and is reused by the MCP server and plugins today, but there is no IntelliJ/Kotlin/Gradle project and no Julia-related code or docs beyond this task title.

**Scope:**
- New IntelliJ plugin that reuses `src/core/` for parse/serialize/store.
- Clarify **Julia format** before implementation (no definition in codebase — confirm whether this means a Julia-language task file format, a person/project name, or something else).

---

## TASK-021: Task date tracking and statistics
**Priority:** P3 | **Tags:** feature, core
**Updated:** 2026-07-27 13:35

**Validation (2026-07-27):** Partially addressed — statistics not done; date tracking is incomplete.

**Already in place:**
- `updatedAt` on `Task`; parsed/serialized as `**Updated:**` in markdown.
- Auto-set on create, update, and move (`taskStore.ts`).
- Shown in list cards, Kanban, detail view, and MCP output.
- List filter: group-by **Date** uses `updatedAt` (day bucket).
- Text search matches `updatedAt`.

**Still missing:**
- `createdAt` and `finishedAt` (or equivalent) fields and markdown metadata.
- Statistics UI or reports (cycle time, throughput, performance metrics).

**Scope (revised):** Add created/finished dates with parser/serializer support; build statistics view or export on top of the date fields. Do not re-implement `updatedAt` or group-by-date.

---
