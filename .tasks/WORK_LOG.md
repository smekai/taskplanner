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
