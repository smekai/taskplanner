# Done

## TASK-053: No archiving story for DONE.md
**Priority:** P3 | **Tags:** core, feature | **Epic:** 2.2.x
**Updated:** 2026-08-27 15:59

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

### Plan

**Decisions taken:** age-based `archiveDoneAfterDays`, archiving runs automatically. **Default off** —
an upgrade must not reshuffle an existing `DONE.md`; automatic means automatic once a threshold has
been chosen.

- `archive.ts` holds the policy: `isArchivable`, `archiveFileFor`, `planArchive`. Files are
  `.tasks/archive/DONE-<YYYY>-H<1|2>.md`, bucketed by the task's own date.
- Tasks with no `**Updated:**` are archived too, per the owner's call, but land in
  `DONE-undated.md` rather than being given an invented date.
- `TaskStore.archiveCompleted()` moves sections out of Done and appends to whatever the archive
  already holds. Idempotent — a second run moves nothing.
- **The hazard, fixed and regression-tested:** `getMaxTaskIdNumber()` walked only configured states,
  so archived IDs would have been forgotten and `nextId` would have reissued them. It now scans
  `.tasks/archive/*.md` with `maxTaskIdNumber(raw, prefix)` — raw reads, no full parse, the same
  pair already used for deferred states. Removing that scan makes the test fail with
  `expected 'T-001' to be 'T-003'`, so the guard is real rather than decorative.
- Triggered after a move into Done, so Done stays trimmed as work completes. **Not** on activation:
  merely opening a project should not rewrite task files. A Setup entry runs it explicitly for the
  bulk case, gated on `isInitialized` per the PR #6 review lesson.
- Generated instructions tell agents to grep `.tasks/archive/` before concluding a task never
  existed.

**Verified on this repository's real board** (copied to a temp dir, threshold 90 days): 1055 lines
of `DONE.md` became 629, 32 of 52 tasks moved into `DONE-2026-H1.md` at 426 lines, the next
allocated ID was `TASK-057` with no reuse, and a second run archived nothing.

12 tests. 162 → 174 overall.

**Key files:** `src/core/store/archive.ts`, `src/core/store/taskStore.ts`,
`src/core/store/fileStore.ts`, `src/core/model/config.ts`, `src/extension/commands/setup.ts`.

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

### Plan

**Decision taken:** a `waitingUntil` field rather than a `Blocked` state or a bare convention. A
field is machine-readable so the tools can act on it; a state would have changed the board shape for
every existing project and needed a `states` migration.

- `Task.waitingUntil?: string`, parsed and serialized like `updatedAt` — `WAITING_UNTIL_RE` beside
  `UPDATED_RE`, a branch in the metadata loop, a `**Waiting until:**` line in the serializer.
- `isWaiting(waitingUntil, today)` in `src/core/util/time.ts`, exported from the library entry.
  Date-only string comparison, which avoids timezone drift from parsing into a `Date`. A task
  waiting until today counts as available, and an unparseable value counts as *not* waiting — a typo
  must not hide work forever.
- MCP: `waiting_until` on the `taskplanner_create` / `taskplanner_update` inputs, shown by
  `formatTask` with an explicit "(not startable yet)" when the date is still ahead.
- **Made it mean something rather than only storing it**, which is the mistake `epic` made:
  `structuredTask()` derives a `waiting` boolean for every tool, so no client redoes the date
  comparison, and `taskplanner_board` marks such tasks in its listing.
- Generated instructions tell agents at the pick-a-task step to skip a task whose date has not
  arrived whatever its priority, and document the field when creating tasks.

**Caught while testing:** the parser branch alone was not enough — `flushTask()` builds each `Task`
field by field, so `waitingUntil` was collected and then dropped. The round-trip test is what
surfaced it.

Verified end to end against a real server: create with a future date reports `waiting=true` and a
past date `false`; the value survives a move; `taskplanner_update` changes it and recomputes
`waiting`; the board marks it; the markdown carries `**Waiting until:**`. 157 → 162 tests.

**Key files:** `src/core/model/task.ts`, `src/core/parser/taskParser.ts`,
`src/core/parser/taskSerializer.ts`, `src/core/util/time.ts`, `src/mcp/server.ts`,
`src/core/ai/aiInstructions.ts`.

---

## TASK-056: This repository has no .mcp.json, so its own agents cannot use the tools
**Priority:** P2 | **Tags:** setup, docs | **Epic:** 2.2.x
**Updated:** 2026-08-27 15:10

TASK-054 shipped the ability to write a repository `.mcp.json`, and its done-summary recorded that
this repository did not get one because `npx -y @smekai/taskplanner` could not resolve until the
package was published. It is published now — `@smekai/taskplanner@2.2.0` is in the registry.

Until this lands, TaskPlanner's own maintainers edit the task board by hand — allocating IDs,
moving markdown sections between files — which is exactly the defect TASK-048 and TASK-054 were
filed about. Every task in this backlog, including this one, was created that way.

**Done looks like:** `.mcp.json` exists in the repository root with the `taskplanner` server,
written by the same `upsertMcpServerConfig` shipped in 2.2.0 rather than by hand, the tools resolve
in a fresh session, and further board changes go through them.

### Plan

- Written by `writeMcpServerConfig()` — the helper shipped in 2.2.0 — rather than by hand, so the
  file is proof the feature works and not just a hand-made lookalike.
- Verified end to end by launching exactly what the file specifies: `npx -y @smekai/taskplanner`
  pulls 2.2.0 from the registry, reports 8 tools, and reads this repository's real board
  (Backlog 5, In Progress 1, Done 50).
- That also settles the question left open in TASK-054's plan: `npx @smekai/taskplanner` does
  resolve the `taskplanner-mcp` bin even though its name differs from the package name, so the
  `-p` form is not needed.

**Still hand-editing in this session:** the file is on disk, but an MCP client only reads it at
startup, so the tools are not registered in the session that wrote it. The loop closes for the
next session, not this one.

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

### Plan

- Confirmed the failure before fixing it: with `states: ["Backlog","Next","Done"]`,
  `migrateConfig` finds no `s.name === "Rejected"` on a string and appends an object to a string
  array, then `path.join(tasksDir, state.fileName)` throws
  `TypeError: The "path" argument must be of type string`.
- `load()` no longer throws. Parsing is wrapped, a non-object or empty file falls back to defaults,
  and everything is recorded as a diagnostic instead.
- `normalizeStates()` repairs entries naming a known state from `DEFAULT_STATES` and falls back to
  the whole default board when an entry is unrecognisable — a partial board is worse than the
  default one. `migrateConfig()` now only ever sees a normalized list.
- Diagnostics are returned, not logged, so core stays VS Code-free — same split as
  `mcpConfigPrompt.ts`. `ConfigManager.getDiagnostics()` exposes them.
- The extension writes them to the existing `TaskPlanner` output channel and shows a warning with
  a **Show details** action. The MCP server prints them to stderr, which matters more than it
  looks: `load()` is called from `freshStore`, so a broken config used to fail every tool call
  with an opaque error. Verified end to end — the same config that threw now answers
  `taskplanner_board` correctly and reports three diagnostics.
- Diagnostics stay honest: a file that could not be parsed reports that once, without a second,
  false complaint about `states` the user never wrote.
- Nine tests covering bare-string states, a known state missing a field, an unrecognisable entry,
  truncated JSON, an empty file, a JSON array, a non-array `states`, single-message reporting and
  silence on a clean config. 148 -> 157 tests.
- Key files: `src/core/config/configManager.ts`, `src/extension/extension.ts`, `src/mcp/server.ts`.

---

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

### Plan

**Decisions taken:** command is `npx`, the file is written only after the user agrees, and the
answer is remembered in `.tasks/config.json` so Initialize asks once.

- `upsertMcpServerConfig()` in `src/core/ai/aiInstructions.ts` merges only the
  `mcpServers.taskplanner` key into whatever is already there, preserving other servers and unknown
  top-level fields. It returns null rather than overwriting a file it cannot parse.
- `writeMcpServerConfig()` in `projectSync.ts` does the file I/O and reports
  written/unchanged/unparseable.
- The written command carries **no absolute path** — `.mcp.json` is committed and shared across
  machines, so an install-specific path would break for every other clone:
  `{ "command": "npx", "args": ["-y", "@smekai/taskplanner"] }`. No `TASKPLANNER_WORKSPACE_ROOT`
  either, for the same reason; the host runs with the repo as cwd and the instructions already tell
  agents to pass `workspace_root` per call.
- `TaskPlannerConfig.mcpConfig` records 'written' or 'declined'. Optional, so existing configs
  need no migration and simply count as not-yet-asked.
- The extension asks (`src/extension/commands/mcpConfigPrompt.ts`), core stays VS Code-free. A
  Setup-menu entry writes it later for anyone who declined.
- Generated instructions tell an agent the file can be created and to ask first.
- Verified all four paths on scratch repositories: empty repo writes it; a repeat run reports
  unchanged; a file already holding a different server keeps both; a corrupt file is left untouched.
- Five tests on the merge helper. 138 -> 143 tests.

**Not done here:** this repository gets no `.mcp.json` yet, because `npx -y @smekai/taskplanner`
cannot resolve until the package is published. Worth adding right after the first publish.

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

### Plan

- `epic` added to the inputSchema of `taskplanner_create` and `taskplanner_update`, destructured
  and passed through. `TaskStore.createTask`/`updateTask` already accepted it as part of `Task`,
  so no store changes were needed.
- `'epic'` added to the groupBy union in `taskFilter.ts` and `messages.ts`, with a switch case
  mirroring `assignee`: `entry.task.epic || 'No epic'`.
- Added to the `taskplanner.groupBy` enum in package.json and to the groupBy menu in
  `taskListPanel.ts`. Drag-and-drop stays limited to status grouping, unchanged.
- `formatTask` in the MCP server now shows `Epic:` on the metadata line — the field was invisible
  in tool text output even where it was set.
- Verified end to end against a real server on a scratch board: create with epic -> move -> get ->
  update, epic survives every step and lands in the markdown as `**Epic:** 2.3.x`.
- Two grouping tests (buckets by epic, "No epic" fallback). 136 -> 138 tests.
- Key files: `src/mcp/server.ts`, `src/core/filter/taskFilter.ts`, `src/core/model/messages.ts`,
  `src/extension/views/webview/taskListPanel.ts`, `package.json`.

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

### Plan

- Planning turned up more than ambiguity: `config.sortBy` was **dead**. Zero reads anywhere in
  src/ — both panels take sort order from the VS Code setting through `getSortBy()`, and
  `setSortBy()` writes back there. The field existed only in the type and the default.
- Removed it from `TaskPlannerConfig` and `createDefaultConfig()`; the default schema version is
  now 3.
- Added the v3 migration in `ConfigManager.migrateConfig()`: strips the key from existing files and
  bumps the version, following the v2 pattern. Unknown keys are left alone.
- Generated instructions now state that order within a file carries no meaning and that a file must
  never be reordered to match priority — removing the field alone would have relocated the question,
  since `insertPosition` still sits there and genuinely does affect layout.
- Applied the same change to this repo's own config.json and to the config reference in
  CONTRIBUTING.md. The VS Code setting `taskplanner.sortBy` in README stays: that one works.
- Test asserts the key is dropped from disk, version becomes 3 and unrelated keys survive. 136 tests.
- Key files: `src/core/model/config.ts`, `src/core/config/configManager.ts`,
  `src/core/ai/aiInstructions.ts`.

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

### Plan

- The mandatory-checklist Plan bullet is now dropped entirely when the flag is false, instead of
  becoming a conditional that pointed the reader at .tasks/config.json.
- The two incidental mentions went with it: the Done step no longer says to trim a plan, and the
  Work Log section no longer refers to one.
- With the flag true the text is unchanged in substance, and the bullet reads cleaner: the
  "if this project requires a plan" hedge is gone because the generator already knows.
- Two tests: false renders no `### Plan`, no `Planning Requirement` and no mention of the flag
  name; true keeps all three. 133 -> 135 tests.
- Key file: `src/core/ai/aiInstructions.ts`.

---

## TASK-055: Stop committing and shipping stale build sourcemaps
**Priority:** P2 | **Tags:** setup, ci | **Epic:** 2.2.x
**Updated:** 2026-08-27 13:20

Filed retroactively — the work was done first, in the same PR as TASK-048, after the question came
up of whether `plugins/taskplanner/dist/mcp-server.js` belonged in git at all.

**Observed:** `plugins/taskplanner/dist/mcp-server.js.map` was tracked in git at 814 kB, generated
on 24 April against a bundle rebuilt on 27 August, and referenced by nothing — the production bundle
carries no `sourceMappingURL`, because it is built with `sourcemap: false`. It rode into the VSIX as
well, since `.vscodeignore` deliberately includes the whole plugin dist. `dist/extension.js.map`
(81 kB) was leaking into the VSIX by the same route.

**Root cause, which is why deleting the file was not enough:** dev builds emit sourcemaps
(`sourcemap: !production`) and production builds did not remove them. Any release packaged after a
`npm run watch` session inherited whatever orphans that session left behind. That is how a map from
April survived four months of rebuilds.

**Not changed, deliberately:** the bundle beside it stays tracked. `.agents/plugins/marketplace.json`
installs the plugin from `./plugins/taskplanner`, `plugins/taskplanner/mcp.json` resolves the server
at `${CURSOR_PLUGIN_ROOT}/dist/mcp-server.js`, and the Cursor Marketplace submission is the
repository URL — the repo tree is a distribution channel, so removing the bundle from git would ship
a plugin with no server. Storage was never the argument either way: the entire history of that
directory packs to 2.67 KiB.

### Plan

- Removed the tracked sourcemap and added `plugins/taskplanner/dist/*.map` to `.gitignore`,
  positioned **after** the existing `!plugins/taskplanner/dist/**` negation so it does not swallow
  the bundle. Verified both paths with `git check-ignore`.
- Production builds now delete both `plugins/taskplanner/dist/mcp-server.js.map` and
  `dist/extension.js.map` in `esbuild.js`, so the orphan cannot recur. Dev builds keep their maps.
- Reproduced the mechanism end to end before and after: run a watch build, then a production build,
  and confirm the map is gone and the bundle still matches HEAD.
- The packaged VSIX now contains zero `.map` files, down from one.

**Key files:** `.gitignore`, `esbuild.js`.

---

## TASK-048: Generated instructions prescribe hand-editing and never mention the MCP tools
**Priority:** P1 | **Tags:** core, docs | **Epic:** 2.2.x
**Updated:** 2026-08-27 12:40

`src/mcp/server.ts` exposes `taskplanner_create`, `taskplanner_move`, `taskplanner_update`,
`taskplanner_get`, `taskplanner_list` and `taskplanner_board`, and `ConfigManager.getNextId()`
allocates IDs and bumps `nextId` without anyone touching `config.json`. The instructions TaskPlanner
generated for agents said none of that, and instead told them to edit the markdown by hand:

> 2. **Move the task** to IN_PROGRESS.md by cutting it from the source file and pasting it into
>    IN_PROGRESS.md.

**Observed (isotopy, 2026-08-17, taskplannerVersion 2.1.4):** the agent hand-edited markdown for a
whole session — cutting and pasting sections between NEXT/IN_PROGRESS/DONE, bumping `nextId` by hand
twice (144 → 148 → 151), and corrupting every em-dash in `BACKLOG.md` through a PowerShell
round-trip. It was following these instructions exactly.

The rendered output had zero occurrences of `mcp` or `taskplanner_`, and this was host-independent:
a Cursor user whose tools *are* registered (`src/extension/extension.ts:151` calls
`cursor.plugins.registerPath`) still got instructions prescribing cut-and-paste. The wiring half —
that nothing writes an `.mcp.json` for hosts outside Cursor — was split out as TASK-054.

### Plan

- Added a **Tools** section to the generated instructions listing the six task tools with what each
  is for, stating they are preferred, and telling the agent to check availability once per session
  and say which way it is working.
- Reframed the two hand-editing instructions: workflow step 2 and the mandatory-checklist bullet now
  make the tool call the method and cut-and-paste the fallback, without weakening the requirement
  that the task actually moves.
- **Creating a New Task** now leads with `taskplanner_create` — which allocates the ID and advances
  `nextId` itself — and keeps the four manual steps below it as the fallback.
- Recorded the decision in the generated text: the files stay plain markdown and a human may edit
  them freely; an agent that has working tools does not, because hand-edits are what desynchronise
  `nextId` and corrupt encodings. Added a UTF-8 note to the hand-editing rule for the same reason.
- Two unit tests: one asserts the six tools are named and the preference is stated, one asserts the
  move requirement survives and the old cut-and-paste wording is gone. 131 → 133 tests.
- Fixed a pre-existing template bug found while regenerating: `planSection` and `workLogSection`
  concatenated without a blank line, so `### Work Log` lost its separator.
- Regenerated this repository's own `CLAUDE.md`, `AGENTS.md` and `.cursorrules` from the new
  template, so the fix is dogfooded rather than only shipped.

**Key file:** `src/core/ai/aiInstructions.ts`. This text is embedded in every consumer repo, so the
wording propagates on their next Initialize or update.

---

## TASK-047: Expose the core library as a package entry point, not only the MCP server
**Priority:** P1 | **Tags:** core, refactor
**Updated:** 2026-08-26 14:30

`@smekai/taskplanner` exposed only `dist/mcp-server.js`. A consumer wanting to read the board from
its own code — no model in the loop — had to spawn a Node subprocess and speak JSON-RPC over stdio
to parse a few markdown files. `src/core/` was already VS Code-free and imports nothing but `fs`
and `path`, so a clean library API sat behind a door with no handle.

### Plan

- Added a second esbuild output: `src/core/index.ts` → `packages/mcp-server/dist/index.js` (CJS).
- Added `tsconfig.types.json` (declaration-only) emitting the core `.d.ts` tree next to it, chained
  into `npm run build` as `build:types`. `npm run watch` does not rebuild types; noted in the docs.
- Re-pointed `exports` while nothing was published: `.` → the library (with a `types` condition),
  `./mcp-server` → the server. This was the last free moment — `.` previously resolved to a bundle
  that self-starts a stdio server on import, which is backwards for a package entry point.
- Smoke test resolves the server through the new subpath and gained a library check: requires `.`
  from the fresh install, asserts the expected exports, parses the same board the MCP tools just
  edited, and confirms `index.d.ts` ships. That the test completes at all proves requiring the
  library does not start a server.
- Documented both entry points in the package README, CONTRIBUTING, and the root README.

Verified: `npm run release:check` passes end to end. ESM named imports were checked explicitly
(`import { parseTasks } from '@smekai/taskplanner'`) rather than assumed — cjs-module-lexer does
detect esbuild's `__export` pattern, so the CJS bundle works from ESM. The tarball grew from 5 to
27 files, the added ones being the declaration tree.

The two bundles each embed a copy of `src/core/*`. They are built from one source in one build, so
they cannot drift, and the byte-identity check in `validate-versions.js` stays scoped to
`mcp-server.js`.

---

## TASK-046: The MCP server ships as its own package, not only inside the extension
**Priority:** P1 | **Tags:** core, refactor, ci
**Updated:** 2026-08-26 12:00

The MCP server is `src/mcp/server.ts`, bundled by `esbuild.js` to
`plugins/taskplanner/dist/mcp-server.js` — a path inside a VS Code extension install. That is fine
for the extension and unusable for anything else. Isotopy (`TASK-162`) is the first consumer: it
needs the board as MCP tools resolvable as a dependency, not as an editor- and OS-dependent path.

### Plan

Shipped as `@smekai/taskplanner` (npm `taskplanner` is taken — mcollina's, 2014).

- **One implementation, not a fork.** `esbuild.js` builds `src/mcp/server.ts` once to
  `plugins/taskplanner/dist/mcp-server.js` (unchanged) and *copies* it plus the board UI into
  `packages/mcp-server/`. The two artifacts are byte-identical; `validate-versions.js` fails the
  build if they ever diverge, and `syncMcpPackage()` throws if the bundle format leaves `cjs`.
- **CJS is a decision, not a default.** The bundle reads its board HTML through `__dirname`, so
  the package declares `"type": "commonjs"` and the smoke test runs it under plain `node`.
- **Package layout:** `packages/mcp-server/` holds only the manifest, `bin/taskplanner-mcp.js`, and
  the README; `dist/` and `ui/` are generated and gitignored. `exports` resolves both
  `require.resolve('@smekai/taskplanner')` and the explicit `dist/mcp-server.js` subpath.
- **Both workspace-root paths kept:** `TASKPLANNER_WORKSPACE_ROOT` and the `workspace_root` tool
  input, each walking up from the given directory to `.tasks/`.
- **Smoke test rewritten to run against the published artifact:** packs the package, installs the
  tarball into an empty temp dir, and spawns `process.execPath <resolved path>` from that empty dir
  with the confounding root env vars stripped. Covers the env var, the tool input, tool set and
  annotations, the board UI resource, the `npx` bin launcher, and an `**Assignee:**` round-trip
  (markdown written directly → get → move → get → markdown).
- **Version wiring:** `bump-version.js` and `validate-versions.js` now cover the npm manifest.
  `packages/**` excluded from the VSIX.

Verified on Windows: `npm run release:check` passes end to end, including the smoke test. The
negative case was confirmed too — removing `TASKPLANNER_WORKSPACE_ROOT` makes the test fail with
only two candidate roots, both inside the temp install, so the pass is not coming from an inherited
`cwd`. macOS and Linux are reasoned through (no platform-specific paths: `process.execPath`,
`require.resolve`, `path.join`) but untested — no Mac was used.

---

## TASK-045: Show task ID prominently in the edit detail view
**Priority:** P1 | **Tags:** ui
**Updated:** 2026-07-27 10:01

Add labeled read-only ID field near the top of the task edit/detail webview. Remove redundant footer `.detail-id` if duplicated.

### Plan

- Added labeled read-only ID field above Title in `buildDetailHtml`.
- Removed footer `.detail-id`; styled with `.detail-readonly`.

---

## TASK-044: Filter tasks by tag in the sidebar
**Priority:** P1 | **Tags:** core, ui, feature
**Updated:** 2026-07-27 10:01

Add tag filter to core `TaskFilter` and sidebar list UI. Filter tasks where `task.tags` includes the selected tag. Add Tag control in filter popup.

### Plan

- Added `TaskFilter.tag` and filtering in `filterAndPaginate` / `groupTasks`.
- Extended text search to match tags; added Tag popup in list filter bar.
- Tests for tag, query-on-tag, and combined filters.

---

## TASK-043: Stable list sorting by priority then ID
**Priority:** P1 | **Tags:** core, ui
**Updated:** 2026-07-27 09:59

Change `sortTasks` so non-`file` sorts always use ID ascending as the final tie-breaker. Priority primary = P0→P4. Replace current priority→title tie-break with priority→ID.

### Plan

- Updated `sortTasks` to tie-break priority and name sorts by ID ascending via `compareById`.
- Added unit tests for priority/name ties ordered by ID.

---

## TASK-042: Restore plan-first Implement with AI flow
**Priority:** P1 | **Tags:** feature, ui, testing
**Updated:** 2026-07-23 08:55

When AI planning is enabled, open implementation requests in a real planning phase, require plan review before workspace changes, and only implement after approval. Use Codex `/plan`, enable Cursor's best-effort Plan mode by default, and preserve the planning-disabled direct workflow.

### Plan

- Split generated AI prompts into read-only planning, explicit approval, and post-approval implementation phases; existing plans are reviewed rather than replaced.
- Added Codex deep-link `planMode` support using `/plan`, conditional on `aiPlanRequired`.
- Enabled Cursor Plan-mode automation by default and gated it on both project planning and the existing user setting, including the paste fallback.
- Added coverage for prompt ordering, existing plans, Codex enabled/disabled links, Cursor gating/defaults, and the default project config; 126 tests, lint, build, and formatting pass.

---

## TASK-041: Restore checkmark activity-bar icon
**Priority:** P2 | **Tags:** ui
**Updated:** 2026-07-23 08:45

Use the simple checkmark icon for the TaskPlanner activity-bar selector in VS Code and Cursor while preserving the branded color logo for marketplace listings.

### Plan

- Restored the historical monochrome checkmark in `resources/icons/taskplanner.svg`, used by the VS Code/Cursor activity-bar view container.
- Preserved `resources/icons/taskplanner-color.png` as the top-level marketplace logo.
- Added `extensionBranding.test.ts` to lock the distinct marketplace and activity-bar icon behavior; tests, lint, and production build pass.

---

## TASK-040: Relicense to MIT and add version-aware TaskPlanner skills
**Priority:** P2 | **Tags:** setup, docs
**Updated:** 2026-07-21 20:36

Relicense TaskPlanner to MIT, add voluntary README attribution, introduce version-aware project synchronization and initialize/update skills, and prepare the public Codex skills-only package.

### Plan (done)

- Replaced active GPL declarations with MIT metadata, legal documents, contributor terms, badges, and release documentation.
- Added safe version-aware project synchronization, voluntary README attribution controls, activation/init wiring, and comprehensive unit coverage.
- Added initialize/update skills, MCP-optional task fallbacks, version enforcement, official skill validation, and a public skills-only submission bundle.
- Regenerated and verified extension/plugin artifacts with zero npm vulnerabilities, 122 passing tests, and complete release/package checks.

---

## TASK-039: Fix Codex MCP workspace resolution from installed plugin cache
**Priority:** P1 | **Tags:** core, feature, testing
**Updated:** 2026-07-21 16:17

Codex launches bundled MCP servers from the installed plugin cache and does not currently provide MCP roots, so TaskPlanner searches the plugin directory instead of the active repository. Accept the repository workspace explicitly on every tool call, propagate it through the interactive board, and update skills and smoke coverage so Codex calls always target the current repo.

### Plan (done)

- Added optional `workspace_root` input to all MCP tools and made it the first workspace discovery candidate.
- Propagated the resolved workspace through visual-board loading, refresh, details, and move calls.
- Updated bundled skills, commands, and plugin documentation to always pass the active repository root.
- Extended smoke coverage for cache-directory startup without MCP roots or workspace environment variables; release checks and the installed plugin cache pass.

---

## TASK-038: Add first-class Codex plugin support
**Priority:** P1 | **Tags:** feature, setup, ui
**Updated:** 2026-07-20 12:45

Package TaskPlanner for Codex app and CLI by sharing the existing Cursor agent bundle, hardening MCP host compatibility, generating AGENTS.md instructions, and adding a Codex app launch provider. Keep the interactive board experimental with text and JSON fallbacks; defer a standalone web dashboard.

### Plan (done)

- Consolidated Cursor and Codex assets under `plugins/taskplanner` with host-specific manifests and a repository Codex marketplace.
- Added TaskPlanner, list, next, and continue skills while retaining Cursor rules and slash commands.
- Added MCP roots-based workspace discovery, structured tool results, safety annotations, and experimental-board fallback guidance.
- Added marker-preserving `AGENTS.md` synchronization and a Codex app deep-link provider for “Implement with AI.”
- Added synchronized manifest versioning, Codex validation, expanded smoke coverage, documentation, and release checks; standalone web UI remains deferred.

---

## TASK-037: Work log convention — `.tasks/WORK_LOG.md` for top-level decisions and outcomes
**Priority:** P2 | **Tags:** docs, core
**Updated:** 2026-07-15 10:30

Add a repo-level rolling work log at `.tasks/WORK_LOG.md`. Agents append one short entry (what, key decisions, outcome) when moving a task to Done. Update AI instructions, skills, and project init to seed the file. Convention-only in v1 — no MCP/parser changes.

### Plan (done)

- Added `.tasks/WORK_LOG.md` with header, entry template, and sample entries from TASK-032/033/035.
- Extended `aiInstructions.ts` with auxiliary file listing, `### Work Log` section, workflow step, and mandatory checklist bullet; exported `DEFAULT_WORK_LOG_CONTENT`.
- Synced `.cursorrules`, `CLAUDE.md`, skills, `continue-task.md`, and example AI files.
- `fileStore.initializeStateFiles()` seeds `WORK_LOG.md` on new project init; Vitest coverage for generated instructions.

---

## TASK-035: Test Cursor Agents MCP board adapter and publish plugin to marketplace
**Priority:** P2 | **Tags:** testing, docs, setup
**Updated:** 2026-04-23 18:44

End-to-end verify the `taskplanner_board_visual` MCP App shipped in TASK-033, then prepare the cursor-plugin for Cursor Marketplace submission.

### Part A — Local test in Cursor 2.6+ (Windows)

1. **Sideload the plugin** (symlink into Cursor's local plugin tree):

   ```cmd
   cmd /c mklink /D "%USERPROFILE%\.cursor\plugins\taskplanner" "C:\Development\taskplanner\cursor-plugin"
   ```

2. **Register it** in `%USERPROFILE%\.claude\plugins\installed_plugins.json`:

   ```json
   { "plugins": { "taskplanner@local": [ { "scope": "user", "installPath": "C:\\Users\\novik\\.cursor\\plugins\\taskplanner" } ] } }
   ```

3. **Enable** in `%USERPROFILE%\.claude\settings.json`:

   ```json
   { "enabledPlugins": { "taskplanner@local": true } }
   ```

4. In Cursor **Settings → Features**, enable **"Include third-party Plugins, Skills, and other configs"**, then restart Cursor.
5. Open a workspace with a `.tasks/` folder (this repo works). Ask the agent "open the visual task board" or invoke `taskplanner_board_visual` directly.
6. **Verify**:
   - Iframe renders inline in the agent chat with columns + cards.
   - Drag a card to another column → `taskplanner_move` fires → the `.md` file on disk updates → VS Code Kanban view reflects the change on next reload.
   - Click a card → details drawer shows description and plan.
   - Empty state (all columns empty) renders gracefully.
7. **Fallback** if Cursor's iframe host misbehaves: smoke-test against `@modelcontextprotocol/ext-apps/examples/basic-host` to isolate whether the bug is in our tool or in Cursor.

### Part B — Pre-submission gaps to close

- Bump `cursor-plugin/.cursor-plugin/plugin.json` version `1.0.0` → `1.1.0` (new tools shipped).
- Re-read the new `taskplanner_board_visual` bullet in `cursor-plugin/README.md` — tighten wording if needed.
- Decide build-artifact policy: `mcp.json` runs `node ${CURSOR_PLUGIN_ROOT}/dist/mcp-server.js` and needs `cursor-plugin/ui/board/index.html`. Either commit `cursor-plugin/dist/` and `cursor-plugin/ui/board/` or add a prepublish build step. Check `.gitignore`.
- Confirm `https://github.com/refined/taskplanner` is public and matches `cursor-plugin/.cursor-plugin/plugin.json`.

### Part C — Marketplace submission

- Submit at <https://cursor.com/marketplace/publish> with the GitHub repo URL.
- Reviewer checklist to self-audit first: valid `.cursor-plugin/plugin.json` manifest, unique kebab-case name (`taskplanner` ✓), README present, logo (`assets/logo.svg` ✓), "tested locally" (Part A).
- **Open question**: whether Cursor requires signed/notarized builds or publisher identity verification — public docs don't mention it; confirm in the reviewer queue if they flag it.

### Plan

- Wire local plugin loading on this machine (`mklink`, `installed_plugins.json`, `settings.json`) and capture what can be verified headlessly vs manually in Cursor UI.
- Complete pre-submission edits: bump plugin version, tighten board-visual README wording, and align artifact policy with `mcp.json` runtime expectations.
- Build MCP artifacts so `cursor-plugin/dist/mcp-server.js` and `cursor-plugin/ui/board/index.html` exist and are ready for packaging.
- Run validation checks (build/lint/test scope as needed) and confirm repository URL consistency in plugin metadata.
- Move TASK-035 to `DONE.md` with a condensed done-plan and add a `[Unreleased]` changelog entry.

---

## TASK-033: Visual views for Cursor Agents Window
**Priority:** P3 | **Tags:** feature, ui
**Updated:** 2026-04-22 21:20

Shipped an interactive TaskPlanner board that renders inline in Cursor agent chats via the MCP Apps extension (`_meta.ui.resourceUri` + `ui://` resource). Cursor 3 plugins still cannot contribute to the real Agents Window sidebar; this is the closest surface the plugin API exposes today. Literal "alongside agent chats" placement remains blocked on Cursor to ship a panel contribution API.

### Plan (done)

- Confirmed MCP Apps spec: `_meta.ui.resourceUri` goes on the **tool description** (not response), URI scheme `ui://`, MIME `text/html;profile=mcp-app`, iframe uses `App.callServerTool` from `@modelcontextprotocol/ext-apps`.
- Added pure `buildBoardViewModel()` in [src/core/view/boardViewModel.ts](../src/core/view/boardViewModel.ts); refactored [src/extension/views/webview/kanbanPanel.ts](../src/extension/views/webview/kanbanPanel.ts) to share it — no behavior change for the VS Code kanban.
- [src/mcp/server.ts](../src/mcp/server.ts): new tools `taskplanner_board_data` (returns JSON view-model) and `taskplanner_board_visual` (carries `_meta.ui.resourceUri`, also sets legacy `ui/resourceUri` for older hosts); new resource `ui://taskplanner/board`. Chose plain `server.registerTool`/`registerResource` over `@modelcontextprotocol/ext-apps/server` helpers to avoid CJS/ESM import friction — the helpers just default the MIME and duplicate the legacy `_meta` key, both inlined.
- Authored self-contained iframe UI in [src/mcp/ui/board/](../src/mcp/ui/board/) (TS + CSS + HTML template, ~500 lines). v1 behaviors: columns per state, priority/assignee/tags on cards, drag-to-move (calls `taskplanner_move`), click-to-open details drawer (calls `taskplanner_get`), Esc closes drawer, error banners. Dark/light theme via `prefers-color-scheme`.
- Extended [esbuild.js](../esbuild.js) with a browser-platform IIFE build that inlines bundled JS + CSS into `board.html` → writes `cursor-plugin/ui/board/index.html` (single file, CSP-safe). MCP server reads it lazily with an in-process cache.
- Excluded `src/mcp/ui/**/*.ts` from the main `tsconfig.json` (DOM lib not appropriate for server code); added `src/mcp/ui/tsconfig.json` for editor-time type checking of the browser UI.
- Verified: `npm run lint` clean, `npm test` 100/100, `npm run build` produces the bundle, manual stdio JSON-RPC smoke test confirms tools/list, `_meta.ui.resourceUri`, `resources/list`, resource read (text/html;profile=mcp-app), and board-data JSON shape are all correct.
- Deferred (follow-up tasks): inline edit via `taskplanner_update`, search/filter, drag-reorder within a column, real-time updates.

---

## TASK-020: Technical debt cleanup and code simplification
**Priority:** P2 | **Tags:** refactor
**Updated:** 2026-04-20 18:00

Audit the codebase for duplicated logic, overly complex methods, and inconsistent base styles. Simplify and unify where possible.

### Plan (done)

- Extracted `stripBom()` in `src/core/parser/taskParser.ts` — removed 3 inlined BOM checks.
- Extracted generic `applyLimit<T>()` in `src/core/filter/taskFilter.ts` — removed 3 duplicated `limit !== null` slice pairs.
- Unified `TaskStore.reloadSync()` / `reloadAsync()`: renamed `applyReloadSync` → `reloadSync`, factored `resetReloadState`, `applyDeferredState`, `applyParsedState` helpers so both paths are ~6 lines each.
- Added `src/core/util/time.ts` exporting `currentTimestamp()`; replaced the static `TaskStore.now()` and its 3 call sites. Format preserved (`YYYY-MM-DD HH:MM`).
- Added `src/extension/config/extensionConfig.ts` with typed getters/setters (`getTaskDirectory`, `getAutoInitAiFiles`, `getAiTool`/`setAiTool`, `getClaudeCliCommand`, `getCursorPlanAndSubmitAfterOpen`, `getSortBy`/`setSortBy`, `getGroupBy`/`setGroupBy`). Routed all `extension.ts`, `initProject.ts`, `implementWithAi.ts`, `setup.ts`, `taskListPanel.ts`, `kanbanPanel.ts` callers through it — zero direct `getConfiguration('taskplanner')` calls remain.
- Added missing `ParseWarning` import in `taskParser.ts` (latent type error surfaced while touching imports).
- Verified: `npm run lint` clean, `npm test` 100/100 passing, `npm run build` succeeds.
- Deliberately skipped: deferred-loading internals, parser state machine, FileStore sync/async pair consolidation, and on-disk timestamp format (each is a separate task).

---

## TASK-034: When two users create a task
**Priority:** P1 | **Tags:** consistency
**Updated:** 2026-04-20 12:00

When two users on the same git repo each create a task on their own branch, both read `nextId` from `.tasks/config.json` and allocate the same `TASK-NNN`. On merge, the repo ends up with duplicate IDs and the next allocation collides again. Fixed by treating the actual task files as the source of truth and reconciling `config.nextId` against the highest ID present on disk both on extension activate and immediately before each task creation.

### Plan (done)

- Added `maxTaskIdNumber(rawContent, prefix)` in `src/core/parser/taskParser.ts` — raw-content scan keeps deferred `Done`/`Rejected` files unparsed.
- Added `ConfigManager.reconcileNextId(floor)` and `reloadFromDisk()`.
- Added `TaskStore.getMaxTaskIdNumber()` — loaded states walk in-memory tasks; deferred states scan raw file content via `fileStore.readRawContent`.
- `TaskStore.createTask` now calls `reloadFromDisk` + `reconcileNextId(getMaxTaskIdNumber()+1)` before `idGenerator.next()`.
- Same reconcile call wired into `extension.ts` after `taskStore.reloadAsync()`.
- Vitest coverage: parser scan (BOM, prefix isolation), `reconcileNextId` (bump vs no-op), `reloadFromDisk` (cross-process pickup), `getMaxTaskIdNumber` reading deferred states without forcing a parse, `createTask` allocating past a higher on-disk ID and past a higher on-disk `nextId`.

---

## TASK-024: Performance measurement and scalability limits
**Priority:** P2 | **Tags:** core, testing
**Updated:** 2026-04-01 19:36

Measure performance of the current parser, serializer, and webview rendering with large task sets. Identify limitations and bottlenecks. Propose architectural updates (pagination, lazy loading, indexing) that would allow the system to handle significantly more tasks.
The first ideas for performance:
Use Async instead of Sync on file loads. Do not load Done and Rejected, before clicing on them. The number of tasks there might be stored in meta data.

### Plan

- **Implemented:** `countTaskHeadings()` (regex line scan); Vitest perf smoke tests (`src/test/core/performance/scalability.perf.test.ts`) and deferred-store tests; `FileStore.readStateAsync` / `readRawContentAsync` / `readAllStatesAsync`; `TaskStore.reloadAsync()` plus deferred **Done**/**Rejected** (heading counts in `getStateDisplayCounts`, full parse on `ensureStateLoaded`); `groupTasks` / `filterAndPaginate` optional `stateDisplayCounts`; sidebar expand/show-all and Kanban `showCompleted` load deferred states; `findTask` / `moveTask` / `createTask` / `fixDuplicates` / search-or-non-status grouping loads as needed; duplicate checks and move-without-id pick list call `ensureAllDeferredStatesLoaded()`.
- **Bottlenecks (measurement):** parsing and serializing very large markdown dominates; grouping iterates all in-memory tasks; webviews still rebuild full HTML on each update.
- **Follow-ups (not implemented):** virtualized list or incremental `postMessage` updates; sidecar offsets or streaming parse for huge single files; optional deferral for additional states.

---

## TASK-032: AI workflow onboarding — activation prompt and stronger instructions (Phase 1)
**Priority:** P2 | **Tags:** feature, setup
**Updated:** 2026-04-01

When a workspace has `.tasks/` but root AI files lack TaskPlanner marker sections, prompt (per workspace, dismissible) to run **Initialize AI Instructions**. Strengthen `generateAiInstructions` output: mandatory **In Progress → Done** steps and a short **### Plan** guideline. Defer later phases (e.g. versioned post-update nudge, MCP tools).

### Plan

- **`scheduleAiInstructionSyncPrompt`** on activate when `.tasks/config.json` exists: if neither `CLAUDE.md` nor `.cursorrules` contains `MARKER_START`, show **InformationMessage** with **Sync AI Instructions** / **Don't show again** / **Later**; workspace state key suppresses repeat.
- **`contentHasTaskPlannerMarkers`** in `aiInstructions.ts` for detection; Vitest coverage.
- **`buildInstructionContent`:** short-plan guidance (3–7 bullets); new **Mandatory checklist** section (move to In Progress before coding, Done + CHANGELOG after, plan timing).

---

## TASK-031: Make tasks draggable in the basic Task list view
**Priority:** P2 | **Tags:** ui, feature
**Updated:** 2026-04-01

Allow users to reorder tasks in the basic Task list view by dragging (within a group and/or between groups, consistent with how grouping works). Align drag-and-drop behavior and feedback with the Kanban board where it makes sense.

### Plan

- **Core:** `TaskStore.reorderTaskToIndex`, `moveTask(..., targetIndex?)` for arbitrary positions; Vitest coverage.
- **List webview:** HTML5 DnD when grouped by **Status** only; `.group-tasks` + **group header** drop zones (collapsed sections); dashed `drag-over`, drop line, `expandGroup` after drop on collapsed header; suppress accidental open after drag.
- **Sort:** `taskplanner.sortBy` value **file** (markdown order) so reordered lists stay stable; Kanban/setup pickers updated.
- **Messages:** `reorderTask`, `moveTask.targetIndex`, `expandGroup`.

---

## TASK-017: Invalid data notification and parser test coverage
**Priority:** P1 | **Tags:** ui, testing, core
**Updated:** 2026-04-01

If a task or text cannot be parsed, display a notification banner at the top of the main screen. Add comprehensive tests for different markdown formats — both valid and malformed inputs.

### Plan

- Introduced `ParseResult` / `ParseWarning`; `parseTasks` returns tasks plus per-line warnings (orphan text, invalid `##` headings, empty titles, BOM strip, harmless `---` when no task open).
- `FileStore` / `TaskStore` propagate warnings; `getWarnings()` grouped by state file for the UI.
- Dismissible warning banner in sidebar task list (list + detail) and Kanban, with Open-at-line; dismiss resets when warning set changes.
- File watcher logs reload failures to **TaskPlanner** output channel instead of swallowing errors.
- Extended Vitest parser coverage: assignee/updated, round-trip serialize, malformed inputs, BOM, duplicates.

---

## TASK-030: Cursor sidebar prompt integration
**Priority:** P3 | **Tags:** feature, ui
**Updated:** 2026-04-01 20:45

Update `dispatchCursor()` to use Cursor 2.3+ prompt injection support: try `workbench.action.chat.open` with query, then `composer.newAgentChat` + clipboard paste, then copy-only fallback. When `aiPlanRequired` is true, prepend a plan-mode line to the composed prompt.

### Plan

- Tier 1: `workbench.action.chat.open` with `{ query, isPartialQuery: false }` in `implementWithAi.ts`
- Tier 2: save clipboard, write prompt, `composer.newAgentChat`, delay 150ms, `editor.action.clipboardPasteAction`, restore clipboard
- Tier 3: existing `copyToClipboard` message
- `promptComposer.ts`: prepend "Use plan mode. Read and analyze before making changes." when `aiPlanRequired`
- Extended Vitest coverage for plan-mode line; Claude Code path unchanged

---

## TASK-026: [Claude] Implement with AI button on tasks
**Priority:** P1 | **Tags:** feature, ui
**Updated:** 2026-04-01 12:38

Add an "Implement with AI" action button to task cards/detail view. When clicked, it should open the available AI extension (Cursor AI / Copilot), pass the task context, and start planning the implementation. The AI should then follow the existing task pipeline (move to In Progress, plan, implement, move to Done).

### Plan

- Added `composeImplementationPrompt()` in `src/core/ai/promptComposer.ts` — pure function composing task context into an AI prompt
- Added `taskplanner.implementWithAi` command in `src/extension/commands/implementWithAi.ts` with auto-detection: Cursor Composer, Claude Code URI handler (`vscode://anthropic.claude-code/open?prompt=...`), or clipboard fallback. Sidebar prompt injection pending anthropics/claude-code#42000
- Added `taskplanner.aiTool` setting (auto/cursor/claude-code/clipboard) to `package.json`
- Added "Implement with AI" primary button to task detail view in `taskListPanel.ts`
- Added hover-revealed AI sparkle button to kanban cards in `kanbanPanel.ts`
- Registered command in `extension.ts`
- Unit tests for prompt composition (8 tests)

---

## TASK-029: Changelog for extension marketplace
**Priority:** P1 | **Tags:** docs, setup
**Updated:** 2026-03-22

The VS Code marketplace page shows an empty Changelog tab. Create and maintain a `CHANGELOG.md` at the project root following the [Keep a Changelog](https://keepachangelog.com) format. The changelog should be auto-updated whenever a task is moved to Done — the AI agent completing the task appends an entry under the current `[Unreleased]` section.

### Plan

- Created `CHANGELOG.md` at project root with retrospective entries from all completed tasks, grouped into versions 1.0.0, 1.1.0, 1.2.0
- Added `[Unreleased]` section at top for ongoing entries
- Added changelog update rule to `CLAUDE.md` so AI agents append entries when moving tasks to Done
- Follows [Keep a Changelog](https://keepachangelog.com) format

---

## TASK-028: search on Kanban board
**Priority:** P3 | **Tags:** UI, search | **Assignee:** smekai
**Updated:** 2026-03-22 14:09

I want to have same search abilities as on a List Board. Search field only, we already have sorting, and other "query" functionalities is not applicable to Kanban Board.

### Plan

- Added search input to kanban toolbar with 200ms debounced filtering
- Reused existing `filterAndPaginate` + `matchesQuery` from core
- Removed delete button from kanban (not needed for now)
- Reduced column gap from 12px to 6px
- Added branch naming convention (`feature/TASK-NNN-desc`, `bug/TASK-NNN-desc`) to project CLAUDE.md and generated AI instructions
- Key files: `kanbanPanel.ts`, `aiInstructions.ts`, `CLAUDE.md`

---

## TASK-022: Split README into dev docs and user-facing page
**Priority:** P3 | **Tags:** docs
**Updated:** 2026-03-21

Refocused the GitHub README on development process, technical docs, and contribution guide. Created a separate user-facing page with feature highlights, screenshots, and setup guidelines.

---

## TASK-025: Refactor Kanban board column layout
**Priority:** P2 | **Tags:** ui, refactor
**Updated:** 2026-03-21

Restructured Kanban board columns from Next+Backlog | In Progress | Done+Rejected to Backlog | Active (Next+In Progress) | Completed (Done+Rejected).

### Plan

- Replaced `buildNextBacklogColumn()` with `buildActiveColumn()` merging Next + In Progress as sub-zones
- Backlog now renders as a standalone standard column
- In Progress shown at top of Active column, Next below it
- Completed column unchanged

---

## TASK-016: AI plan persistence in task workflow
**Priority:** P1 | **Tags:** core, feature
**Updated:** 2026-03-21

When AI moves a task to In Progress, the plan is saved as a `### Plan` subsection. When moved to Done, the plan is preserved for history.

### Plan

- Added `plan?: string` field to Task model
- Updated parser to detect `### Plan` heading and capture content separately from description
- Updated serializer to render plan section after description
- Updated AI instruction template with plan persistence convention
- Added parser and serializer tests

---

## TASK-018: Auto-increment package version on commit
**Priority:** P3 | **Tags:** setup
**Updated:** 2026-03-21

Automatically bump the patch version in package.json via a git pre-commit hook. Uses `core.hooksPath` pointing to `.githooks/pre-commit` — no husky dependency. The `prepare` npm script configures the hooks path on `npm install`.

---

## TASK-027: Save button should close form and return to list
**Priority:** P1 | **Tags:** ui, feature
**Updated:** 2026-03-20

After clicking the Save button on the task edit form, the form should close and navigate back to the task list view.

---

## TASK-001: Project scaffolding and initial setup
**Priority:** P1 | **Tags:** core, setup | **Assignee:** smekai
**Updated:** 2026-03-16 00:00

Set up TypeScript project with esbuild bundler, VS Code extension shell, core library structure (models, parser, serializer, store), and Vitest test framework.

---

## TASK-002: Task parser and serializer
**Priority:** P1 | **Tags:** core
**Updated:** 2026-03-16 00:00

Implement regex-based markdown parser that extracts tasks from `## TASK-XXX: Title` headings with priority, tags, epic metadata. Implement serializer that converts Task objects back to markdown format with pipe-separated metadata.

---

## TASK-003: Extension icon and branding
**Priority:** P3 | **Tags:** ui, setup
**Updated:** 2026-03-16 00:00

Create SVG and PNG icons for the TaskPlanner activity bar and marketplace listing.

---

## TASK-004: Kanban board and filtered task list webviews
**Priority:** P1 | **Tags:** ui, feature
**Updated:** 2026-03-16 00:00

Implement Kanban board with drag-and-drop cards between columns (Next+Backlog merged, In Progress, Done+Rejected merged). Implement filtered task list with status dropdown and search-by-ID/title. Both use webview panels with VS Code theme integration.

---

## TASK-005: Task example files and webview polish
**Priority:** P3 | **Tags:** docs, ui
**Updated:** 2026-03-16 00:00

Create example `.tasks/` folder with sample tasks across all states. Polish webview card layout and flow.

---

## TASK-006: AI instruction generation and workflow
**Priority:** P2 | **Tags:** feature, core
**Updated:** 2026-03-16 00:00

Implement auto-generation of `CLAUDE.md` and `.cursorrules` files that teach AI agents the task pickup workflow (read NEXT.md, move to IN_PROGRESS, plan, implement, move to DONE).

---

## TASK-007: Setup menu and configuration options
**Priority:** P2 | **Tags:** ui, feature
**Updated:** 2026-03-18 00:00

Add gear icon setup menu with quick pick: Initialize Project, Initialize AI Instructions, AI Planning toggle, Sort By selection, Open Settings. Add `taskplanner.sortBy` configuration property.

---

## TASK-008: Compact tree view and card layout
**Priority:** P3 | **Tags:** ui
**Updated:** 2026-03-18 00:00

Refine sidebar tree view with priority-colored circle icons, task count badges, and drag-and-drop between states. Compact card layout with full word-wrap titles.

---

## TASK-009: Icon and screenshot updates
**Priority:** P4 | **Tags:** ui, docs
**Updated:** 2026-03-18 00:00

Update activity bar icon design, add overview screenshot for README and marketplace listing.

---

## TASK-010: GitHub community files and CI rules
**Priority:** P3 | **Tags:** setup, docs
**Updated:** 2026-03-18 00:00

Add GitHub repository configuration: community guidelines, contribution rules.

---

## TASK-011: README documentation
**Priority:** P2 | **Tags:** docs
**Updated:** 2026-03-18 00:00

Write comprehensive README with features overview, quick start guide, task format spec, AI agent workflow, views documentation, settings reference, and platform support matrix.

---

## TASK-012: Additional setup options and configuration
**Priority:** P3 | **Tags:** feature, setup
**Updated:** 2026-03-18 00:00

Add Rejected state support, config migration (v1→v2), insert position setting, and additional setup menu entries.

---

## TASK-013: MVP launch preparation
**Priority:** P1 | **Tags:** feature, ui | **Assignee:** smekai
**Updated:** 2026-03-19 00:00

Replace main screen with filtered task list (grouped by status, hiding Backlog/Done/Rejected by default). Add Assignee and Updated datetime fields to tasks. Add grouping controls (by status, assignee, date, or none). Add search across all fields. Update README.

Additionally, polished the sidebar sorting and grouping UX:
- Use standard VS Code fonts for sort/group dropdown/popup controls.
- Render sort/group as icon buttons that open dropdown menus.
- Remove the Delete button from the task detail editor.
- Show a visible save confirmation toast after saving a task.
- Persist sort (and grouping) in workspace settings and keep sorting consistent between the sidebar tree view and the Kanban board.

---

## TASK-015: Fix Cursor sorting and grouping panels
**Priority:** P1
**Updated:** 2026-03-19 00:00

Use VS Code styling for the sorting/grouping popup controls, switch to icon-based dropdown menus, remove the broken Delete action from the sidebar detail panel, add a clear save confirmation, and keep sorting synchronized across the sidebar tree view and the Kanban board.

---

## TASK-014: Conflict resolution
**Priority:** P1
**Updated:** 2026-03-19 01:00

There is a quite an issue. Somtimes is possible because of conflicts on Github we might endup having the same task with same number twice.
In this case I propose to notify user. We can give user select - or make an autofix with taken the latest task (if date is the same or not presented we should take the latest by status) - so user would need only approve.
Please update after resolution the minor version of a package

---
