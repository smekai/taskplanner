# Changelog

All notable changes to the **Task → Plan → AI** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `endsTaskSection(text)` is exported, so a consumer can ask whether text would end a task section instead of copying the serializer's rule (TASK-067).
- `ConfigManager.isConfigUnreadable()` distinguishes a `config.json` nobody could read from one that was merely migrated, so a consumer can refuse to write defaults over it (TASK-067).

### Fixed

- `npm run package` writes the `.vsix` again: the build no longer deletes the packaged release artifacts under `dist/vscode/` and `dist/codex/` while clearing its own output (TASK-068).
- The published package no longer ships type declarations for modules that were deleted, because the build now clears its output directories first (TASK-067).
- `reloadFromDisk()` no longer keeps reporting a config as unreadable after the file it could not read is gone; a reload with no `config.json` now means the same as a load with none (TASK-067).

### Security

- Dependency audit is clean again: `js-yaml` 4.3.2 (dev-only, GHSA-2883-xcg3-v3hh) and `qs` 6.16.0 (GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g) (TASK-066).

## [2.4.0] - 2026-09-21

### Added

- MCP read tools report parse **errors** and **warnings** (with raw text for unread sections); unknown `**Key:**` attributes round-trip; `parseTasks` returns `segments` and `serializeBoard` is its inverse; `taskIdsIn` exported (TASK-063).

### Changed

- Generated agent instructions are shorter — same tools and workflow, less repeated prose (TASK-065).
- This repository sets `archiveDoneAfterDays: 14` and archives older Done / Work Log under `.tasks/archive/` (TASK-065).
- Allocate task IDs from persisted `nextId` without routine board/archive scans (TASK-061).

### Fixed

- Misspelled priorities are reported instead of becoming P4; board writes preserve unread prose, CRLF, and BOM; single-line fields cannot smuggle a second task; moves write both files or neither (TASK-063).
- CRLF boards parse correctly; MCP reads no longer rewrite `config.json` (TASK-060).

### Removed

- Unused webview message contract and never-posted `ready` handlers (TASK-065).
- Duplicate/obsolete parser tests subsumed by round-trip invariants (TASK-065).

## [2.3.0] - 2026-08-28

### Added

- Completed tasks can be archived out of DONE.md. Set **archiveDoneAfterDays** in .tasks/config.json and anything older moves into dated files under .tasks/archive/, so the board file stays a working document instead of growing without limit. Archiving is off until you set it, archived files stay plain markdown you can grep, and task IDs are never reissued for archived work. Run it on demand from the Setup menu. WORK_LOG.md is archived on the same schedule, since it grows one entry per completed task and had no story of its own (TASK-053).
- Tasks can declare **Waiting until: YYYY-MM-DD** for work blocked on something outside the repository — an external quota, a third-party release. The MCP tools mark such tasks and the generated instructions tell agents to skip them whatever their priority, so a compliant agent no longer picks up a P0 it cannot start. Set it through `taskplanner_create` or `taskplanner_update` (TASK-052).
- This repository now ships a `.mcp.json`, so agents working on TaskPlanner itself use the TaskPlanner tools rather than hand-editing the task board (TASK-056).

### Changed

- Completed tasks and work-log entries archive into **one file per year** — `DONE-2026.md`, `WORK_LOG-2026.md` — instead of half-year buckets. Both kinds of archive now derive their file name and heading from the same place (TASK-058).

- **Waiting until** dates are now compared in UTC, matching the **Updated** stamps written into the same files. Previously the two used different calendars, so near midnight a task could be judged startable on one day and not the other depending on the contributor's timezone (TASK-057).
- A **Waiting until** value with text after the date, such as `2026-09-03 soon`, is no longer accepted. Only `YYYY-MM-DD` and `YYYY-MM-DD HH:MM` parse; anything else leaves the task visible rather than hiding it on a value nobody can read (TASK-057).
- Work-log entries whose heading carries an impossible date archive into `WORK_LOG-undated.md`, the same way undated tasks go to `DONE-undated.md` (TASK-057).
- **Library API:** `isWaiting`'s second argument is now a `Date` rather than a `YYYY-MM-DD` string, and `parseTimestamp` and `daysSince` are exported from `@smekai/taskplanner`. Date handling is one parser and two formatters; every function takes a `Date` and strings appear only at the boundaries (TASK-057).

### Fixed

- Archiving no longer rewrites an archive file it could not fully parse. A file holding a malformed heading or hand-written prose kept only the newly archived task; new sections are now appended to the raw text, so anything already in the file survives (TASK-058).
- An interrupted archive run no longer duplicates work. The archive is written before DONE.md, so a failure in between left a task in both; appends now skip task IDs already in the target file, and every board write goes through a temp file and rename (TASK-058).
- `**Updated:** 2026-08-27 12:99` no longer parses as 13:39, and years `0000`–`0099` no longer land 1900 years off. A timestamp must survive a full round-trip — year, month, day, hour and minute — or it is treated as absent (TASK-058).

- A malformed `.tasks/config.json` no longer breaks TaskPlanner. States given in the wrong shape are repaired from the defaults where the name is recognised, unparseable JSON falls back to defaults, and loading reports what it had to ignore instead of throwing — previously a `states` list of plain strings crashed on `path.join`, which took down MCP tool calls as well as the views. Problems are written to the **TaskPlanner** output channel with a warning, so defaults are never applied silently (TASK-036).

## [2.2.0] - 2026-08-27

### Added

- The MCP server is now published to npm as `@smekai/taskplanner`, so agent hosts outside a VS Code or Cursor install can depend on it instead of pointing at an extension path. Same server as the editor plugin, built from the same sources; spawn it as `node <require.resolve('@smekai/taskplanner/mcp-server')>` and point it at a repository with `TASKPLANNER_WORKSPACE_ROOT` or the `workspace_root` tool input (TASK-046).
- `@smekai/taskplanner` also ships the task board as a library, with TypeScript declarations: `import { parseTasks, TaskStore } from '@smekai/taskplanner'` reads and edits a board directly, with no subprocess and no MCP round-trip. Use it when your own code is the caller; use the MCP server when a model is (TASK-047).
- **Initialize** can now write a repository-level `.mcp.json`, so agents in hosts that read it — Claude Code among them — reach the TaskPlanner tools instead of editing the task markdown by hand. It asks first and remembers the answer, since the file tells an agent what to execute; the Setup menu writes it later if you decline. An existing `.mcp.json` is merged, not replaced, and one that cannot be parsed is left alone (TASK-054).
- Tasks can be grouped by **epic** in the sidebar task list, and `epic` can now be set through `taskplanner_create` and `taskplanner_update`. The field parsed and serialized before but no agent could write it and nothing could group by it, so projects encoded milestones in tags and prose instead. Tasks without an epic collect under a visible "No epic" group (TASK-051).

### Changed

- Generated agent instructions (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`) now name TaskPlanner's MCP tools and tell agents to prefer them over editing the task markdown by hand — which the instructions previously prescribed, leaving agents to cut-and-paste task sections and hand-maintain `nextId`. Hand-editing remains documented as the fallback for hosts that do not expose the tools (TASK-048).
- Generated instructions now say that task order within a file carries no meaning and must never be rewritten to match priority (TASK-050).
- `npm run smoke:mcp-server` now packs and installs the published npm package before exercising it, instead of testing the extension's own bundle (TASK-046).
- The MCP server moved from the package root to the `@smekai/taskplanner/mcp-server` subpath, so the package's main entry is the library and importing it no longer starts a server. Spawn it as `node <require.resolve('@smekai/taskplanner/mcp-server')>` (TASK-047).

### Fixed

- Setting `"aiPlanRequired": false` now genuinely turns planning off. The generated instructions kept a bullet under "Mandatory checklist (do not skip)" that still required a `### Plan` before coding and pointed the reader back at the config file, so agents wrote plans in projects that had switched them off (TASK-049).
- The packaged extension no longer ships build sourcemaps. A stale 814 kB map from an earlier dev build had been committed alongside the bundled MCP server and rode into every VSIX, as did the extension's own map; production builds now clear both, so a release packaged after a `npm run watch` session cannot inherit them (TASK-055).

### Removed

- `sortBy` is gone from `.tasks/config.json`. It was never read — sort order is a view setting and lives in `taskplanner.sortBy` — but sitting beside `insertPosition` it read as a promise about file layout, and agents reordered task files to satisfy it. Existing configs are migrated to schema version 3 on load, which strips the key and leaves everything else alone (TASK-050).

## [2.1.4] - 2026-08-03

- Tag filter, labeled task ID in detail view, stable priority→ID sort (TASK-043–045).

## [2.1.2] - 2026-07-24

- Plan-first Implement with AI; restored checkmark Activity Bar icon (TASK-041–042).

## [2.1.1] - 2026-07-22

- Graphite branding, local plugin testing path, Codex skills packaging fixes.

## [2.0.1] - 2026-07-21

- Every commit must carry a synchronized patch version bump.

## [2.0.0] - 2026-07-21

- MIT license; version-aware project sync and skills; Node 24; Codex workspace_root (TASK-039–040).

## [1.8.0] - 2026-07-20

- Codex plugin, WORK_LOG, MCP Apps board, ID reconcile on create, core cleanup (TASK-020, 033–038).

## [1.4.2] - 2026-04-09

- Bundled Cursor plugin; deferred Done/Rejected load; Task → Plan → AI naming (TASK-024).

## [1.3.0] - 2026-04-02

- AI onboarding, list DnD, parse warnings, Implement with AI providers, changelog (TASK-017, 026, 029–032).

## [1.2.0] - 2026-03-22

- Kanban search, plan persistence, version bump hook, column restructure (TASK-016, 018, 022, 025, 028).

## [1.1.0] - 2026-03-20

- Filtered list, assignee/updated, grouping, duplicate fix, save closes form (TASK-013–015, 027).

## [1.0.0] - 2026-03-18

- Initial release: parser, kanban, list, AI instructions, setup, example board (TASK-001–012).
