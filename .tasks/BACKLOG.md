# Backlog

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
