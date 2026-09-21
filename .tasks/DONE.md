# Done

## TASK-067: Export the rule a consumer has to duplicate, and stop publishing deleted modules
**Priority:** P1 | **Tags:** core, setup
**Updated:** 2026-09-21 22:20

Both found by Isotopy consuming 2.4.1 as a library rather than as an extension.

**The serializer's rule was private, so a consumer had to copy it.** `serializeTask` throws when a
description or plan holds a line that would end the task section, which is right — but the predicate
behind it was a local function, so a consumer validating model-written text before handing it over
had to re-derive `/^(?:---\s*|## [A-Z]+-\d+:\s*\S.*)$/` from the thrown message. A copy of a
grammar rule drifts the moment the grammar moves, and nothing fails loudly when it does.

`endsTaskSection(text)` now lives in `parser/grammar.ts` beside the predicates it composes, is what
`bodyOrThrow` calls, and is exported from the package. One rule, one owner, and a caller can ask
before it throws.

**The published package carried declarations for modules that no longer exist.** `dist/` is
gitignored and the build only ever overwrote it, so `boardEditor.d.ts`, `boardSections.d.ts` and
`boardSegments.d.ts` — `upsertTask`, `removeTask`, `splitSections`, all deleted in the 2.4 cleanup —
were still in the 2.4.1 tarball, since `files` ships `dist/` wholesale. A consumer reading the types
found an API that was not there. `scripts/clean-dist.js` now clears both output directories before
`build`, and the rebuilt tree no longer contains them.

Evidence: `npm run lint` clean, `npm test` 306 passing, `npm run build` produces a `dist/parser/`
holding only the five modules that exist.

---

## TASK-066: Clear npm audit before publishing 2.4.x
**Priority:** P1 | **Tags:** setup, ci
**Updated:** 2026-09-21 13:47

`npm install` reports 2 vulnerabilities (1 high, 1 moderate) from transitive dependencies:

- **js-yaml 4.3.1** (high, GHSA-2883-xcg3-v3hh) — dev-only, via `eslint` and `@vscode/vsce`.
- **qs 6.15.3** (moderate, GHSA-x5fp-wj9c-mxmx + GHSA-4mjr-xmp4-gh2g) — via `@modelcontextprotocol/ext-apps` → `@modelcontextprotocol/sdk` → `express`; not present in the shipped MCP bundle.

Bring the lockfile to the fixed versions so a release publishes from a clean audit.

### Plan

- `npm audit fix` updated the lockfile only: `js-yaml 4.3.1 → 4.3.2` (dev-only, via eslint and @vscode/vsce), `qs 6.15.3 → 6.16.0` (via @modelcontextprotocol/ext-apps → sdk → express).
- No `overrides` entry was needed — both parents accept the patched ranges, so no direct dependency changed.
- `npm audit` now reports 0 vulnerabilities; `npm run release:check` is green end to end, including the packed-tarball MCP smoke test.
- The `plugins/taskplanner/dist/mcp-server.js` diff is minified-identifier churn from rebuilding against the refreshed tree; both bundle copies stay byte-identical, as `validate:versions` confirms.
- Shipped artifacts were never exposed: `express`/`qs` are not bundled and `js-yaml` is dev tooling.

---

## TASK-065: Big cleanup for 2.4.0: compress board markdown, agent template, dead code and duplicate tests
**Priority:** P1 | **Tags:** refactor, docs, testing
**Updated:** 2026-09-21 13:20

Archive and condense DONE/WORK_LOG, compress the generated agent-instructions template, remove dead code and duplicate tests, then ship as minor 2.4.0. Leave the new backlog tasks (TASK-064 and earlier backlog) unchanged.

### Plan

- Enabled `archiveDoneAfterDays: 14`; archived 55 Done tasks + older work-log entries; condensed remaining DONE/WORK_LOG.
- Compressed `aiInstructions.ts` (~half); regenerated CLAUDE/AGENTS/.cursorrules/example; trimmed CLAUDE/AGENTS front matter and old CHANGELOG sections.
- Removed WebviewMessage, ready/deleteTask, unused exports, unreachable parser branch.
- Dropped duplicate tests (323 → 293). Shipped as 2.4.0.

---

## TASK-063: Rewrite the parser in layers, with errors separate from warnings
**Priority:** P1 | **Tags:** core, refactor
**Updated:** 2026-09-21 10:00

Supersedes closed PR #12. Grammar lived in several places that disagreed; the parser had no notion of failure — everything degraded silently (e.g. `**Priority:** p0` became P4 with no warning; MCP never surfaced diagnostics).

### Plan

- Layered parser: `grammar.ts` → `fileSections.ts` → `taskSection.ts` → `taskParser.ts`; serializer asks the same grammar.
- Errors and warnings are separate; MCP read tools report both, errors carrying the unread section's raw text.
- Writing is the inverse of reading (`serializeBoard`); a task nobody edited keeps its original bytes; CRLF and BOM preserved.
- Move writes both states or neither. Tests 210 → 323.

---

## TASK-061: Allocate task IDs from persisted nextId without routine board scans
**Priority:** P1 | **Tags:** core, refactor, testing
**Updated:** 2026-09-11 09:35

Allocate from `nextId` in config.json; MCP creation loads only its destination state. Manual additions must advance nextId.

### Plan

- Raise nextId from already-observed IDs on writes; remove startup archive reconciliation.
- Verified 209 tests and packed-package MCP smoke; version 2.3.2.

---

## TASK-060: A CRLF board parses as an empty one, and a read rewrites config.json
**Priority:** P0 | **Tags:** core, mcp
**Updated:** 2026-09-11 07:12

Two defects: a CRLF board parsed to zero tasks, and every MCP read rewrote `config.json` via migration-on-load.

### Plan

- Split lines on `/\r?\n/` so headings and metadata values stay clean under Git for Windows defaults.
- `load({ persistMigration: false })` for MCP reads; extension still migrates on open. 204 tests.

---
