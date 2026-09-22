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

## TASK-068 — 2026-09-22
**What:** Fixed `npm run package`, which failed with ENOENT because `clean-dist.js` deleted the whole root `dist/` from `vscode:prepublish`, including the `dist/vscode/` destination vsce was about to write to.
**Decisions:** Kept the clean for `packages/mcp-server/dist` (stale declarations there do get published) and spared the packaged-artifact folders `dist/vscode/` and `dist/codex/`; `.vscodeignore` already keeps them out of the VSIX.
**Outcome:** VSIX and Codex ZIP survive a rebuild, stale `.d.ts` still cleared, `release:check` green. Follow-up: `release:check` does not run `npm run package`, so this class of break stays invisible to the gate.

---

## TASK-066 - 2026-09-21
**What:** Cleared `npm audit` before publishing 2.4.x - `js-yaml` 4.3.2 (dev-only) and `qs` 6.16.0 in the lockfile.
**Decisions:** Plain `npm audit fix`; no `overrides` entry needed since both parents accept the patched ranges.
**Outcome:** 0 vulnerabilities; `npm run release:check` green, including the published-package smoke test.

---

## TASK-065 — 2026-09-21
**What:** Big cleanup for 2.4.0 — archived old Done/Work Log, compressed agent instructions, removed dead code and duplicate tests.
**Decisions:** Archive at 14 days; compress via the generated template (not hand-edits alone); leave TASK-064 and other backlog tasks untouched.
**Outcome:** Version 2.4.0; tests 323 → 293; board markdown ~115 KB → ~31 KB on board (+ archive).

---

## TASK-063 — 2026-09-21
**What:** Layered parser with separate errors/warnings reaching MCP; writing is the inverse of reading.
**Decisions:** All patterns in `grammar.ts`; text outside a task no longer warns; unrecognised priority is an error, `p0` accepted.
**Outcome:** Supersedes PR #12. 210 → 323 tests.

---

## TASK-061 — 2026-09-11
**What:** Allocate from persisted nextId without routine board/archive scans.
**Decisions:** Raise the counter from already observed IDs on writes; manual additions must advance nextId.
**Outcome:** 209 tests; version 2.3.2.

---

## TASK-060 — 2026-09-11
**What:** Fixed CRLF boards parsing empty and MCP reads rewriting config.json.
**Decisions:** Split on `/\r?\n/`; reads use `persistMigration: false`.
**Outcome:** 204 tests; verified over stdio.

---
