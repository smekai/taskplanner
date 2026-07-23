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

## TASK-042 — 2026-07-23
**What:** Restored a plan-first, approval-gated “Implement with AI” workflow across providers.
**Decisions:** Used Codex `/plan`, enabled Cursor's best-effort Plan automation by default, and retained `aiPlanRequired: false` as the direct-execution escape hatch.
**Outcome:** All 126 tests, lint, production build, and formatting checks pass.

---

## TASK-041 — 2026-07-23
**What:** Restored the checkmark Activity Bar selector while preserving the branded marketplace logo.
**Decisions:** Reused the historical monochrome SVG and added a manifest regression test to keep the two icon roles separate.
**Outcome:** All 123 tests, lint, and the production build pass.

---

## TASK-040 — 2026-07-21
**What:** Relicensed TaskPlanner to MIT and added version-aware managed-project synchronization, initialization/update skills, and the public Codex skills-only release kit.
**Decisions:** Kept schema and product versions separate, made attribution voluntary, preferred MCP with direct-file fallback, and blocked managed-file downgrades.
**Outcome:** Audit, 122 tests, lint, build, validators, MCP smoke, skills packaging, and VSIX packaging pass for 2.0.0.

---

## TASK-039 — 2026-07-21
**What:** Fixed Codex MCP workspace resolution by passing the active repository root explicitly through every tool and visual-board call.
**Decisions:** Kept MCP roots and environment discovery as compatible fallbacks; explicit per-call roots avoid shared mutable server state.
**Outcome:** Release checks pass, and plugin `1.9.0+codex.20260721131442` was reinstalled and smoke-tested from the Codex cache.

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
