# Done

## TASK-068: npm run package fails: clean-dist wipes the VSIX destination
**Priority:** P1 | **Tags:** setup, core
**Updated:** 2026-09-22 10:59

`npm run package` always fails with `ENOENT ... dist\vscode\taskplanner-<version>.vsix`. `scripts/package-vsix.js` creates `dist/vscode/` and then calls `createVSIX()`, which runs `vscode:prepublish` -> `npm run build` -> `scripts/clean-dist.js`, which removes the whole root `dist/` including the destination directory just created. vsce then cannot write the artifact.

Regression from TASK-067 (commit 307274e), which added `clean-dist.js`. `npm run release:check` does not cover `npm run package`, so the gate stays green.

Cleaning `packages/mcp-server/dist` is still needed (stale declarations of deleted modules get published through `files: ["dist/"]`), but the root `dist/vscode` and `dist/codex` hold packaged release artifacts, not build output, and `.vscodeignore` already excludes them from the VSIX.

### Plan

Done: `scripts/clean-dist.js` still removes `packages/mcp-server/dist` whole, but in the root `dist/` it now removes only the build output and keeps the packaged-artifact folders `vscode/` and `codex/`. No change to `scripts/package-vsix.js` — `createVSIX()` runs `vscode:prepublish` itself, so there is no point between build and write where the script could recreate the destination.

Verified: `npm run package` writes `dist/vscode/taskplanner-2.4.4.vsix`; a second run with the artifact already present produces a VSIX whose only `dist` entry is `extension/dist/extension.js`; `dist/codex/` output survives a rebuild; a planted `packages/mcp-server/dist/stale-module.d.ts` is still cleared by `npm run build`; `npm run release:check` green.

Follow-up: `release:check` does not run `npm run package`, so a break in the VSIX path stays invisible to the gate.

---
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

**A config nobody could read was indistinguishable from one that was merely migrated.**
`ConfigManager` quarantines an unreadable `config.json` as `config.invalid-<stamp>.json` and carries
on with defaults, which is the right call for the extension and the wrong one for a consumer that is
about to write: it would put a default board where a broken one was, and the only signal was a
diagnostic *message*, which is not something a caller should match on. `isConfigUnreadable()` now
reports it, so a writer can refuse before it writes.

**Review caught the half that made the flag a trap.** `reloadFromDisk()` returned early when
`config.json` was missing, so a manager that had seen broken JSON kept reporting it as unreadable
after the file was deleted — and a writer gating on the flag would have refused forever, because
only `save()` cleared it. The early return was the whole defect: `readFromDisk()` already clears
the flag and already returns defaults when the file is absent, so dropping it makes a reload of a
vanished config mean the same as a load of one.

Evidence: `npm run lint` clean, `npm test` 308 passing, `npm run build` produces a `dist/parser/`
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
