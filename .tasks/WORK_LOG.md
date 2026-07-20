# Work Log

Top-level trace of completed work and key decisions. One entry per task moved to Done — newest at top. Keep entries short (3–5 lines); detailed steps stay in each task's `### Plan` in `DONE.md`.

**Entry template** (insert after this header, before existing entries):

```markdown
## TASK-### — YYYY-MM-DD
**What:** One-line summary of what was delivered.
**Decisions:** Key choices made and why (skip if none).
**Outcome:** Result or follow-ups (skip if obvious from What).

---
```

---

## TASK-038 — 2026-07-20
**What:** Added an installable shared Cursor/Codex plugin with Codex skills, MCP tools, `AGENTS.md` sync, and Codex task launching.
**Decisions:** Kept the MCP board experimental with structured/text fallback; deferred a standalone web dashboard.
**Outcome:** Release checks pass with 104 tests plus Cursor, Codex, and MCP validation; plugin 1.7.5 is installed and enabled locally.

---

## TASK-037 — 2026-07-15
**What:** Repo-level work log convention at `.tasks/WORK_LOG.md` for top-level decisions and outcomes after each task.
**Decisions:** Convention-only v1 (no MCP/parser); conditional on file existing; seed on project init via `DEFAULT_WORK_LOG_CONTENT`.
**Outcome:** AI instructions, skills, and init flow updated; 101 tests passing.

---

## TASK-032 — 2026-04-01
**What:** AI workflow onboarding — activation prompt when marker blocks missing; stronger generated instructions with mandatory checklist.
**Decisions:** Phase 1 only — defer versioned post-update nudge and MCP tooling.
**Outcome:** Dismissible per-workspace prompt; `contentHasTaskPlannerMarkers` + Vitest; plan guidance in `aiInstructions.ts`.

---

## TASK-033 — 2026-04-22
**What:** Shipped interactive TaskPlanner board inline in Cursor agent chats via MCP Apps.
**Decisions:** Plain `registerTool`/`registerResource` over ext-apps server helpers (CJS/ESM friction); deferred inline edit and real-time updates.
**Outcome:** Drag-to-move and click-for-details working; sidebar placement blocked on Cursor panel API.

---

## TASK-035 — 2026-04-23
**What:** Local Cursor plugin verification and marketplace submission prep for the MCP board.
**Decisions:** Document sideload via symlink + `installed_plugins.json`; bump plugin to 1.1.0; commit build artifacts for `mcp.json` runtime.
**Outcome:** Reviewer checklist and artifact policy documented; manual Cursor UI verification steps captured.

---
