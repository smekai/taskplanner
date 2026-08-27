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

## TASK-055 — 2026-08-27
**What:** Removed a tracked 814 kB sourcemap that was four months stale and referenced by nothing,
and stopped production builds from leaving orphaned maps behind.
**Decisions:** Only the maps are ignored — the bundle beside them stays tracked, because the repo
tree is how Codex and the Cursor Marketplace install the plugin. Fixed the mechanism (dev builds
emit maps, production builds did not clean them) rather than only deleting the file.
**Outcome:** The packaged VSIX went from one .map file to zero; dist/extension.js.map was leaking
the same way and is fixed too. Filed retroactively, after the work.

---

## TASK-048 — 2026-08-27
**What:** Generated agent instructions now name the six TaskPlanner MCP tools and prefer them over
editing the task markdown by hand, which they previously prescribed.
**Decisions:** Hand-editing stays documented as the fallback rather than removed — the files are
human-editable by design, and not every host exposes the tools. Split the wiring half (nothing
writes an .mcp.json outside Cursor) into TASK-054 rather than widening this one.
**Outcome:** 133 tests; regenerated this repo's own CLAUDE.md/AGENTS.md/.cursorrules from the new
template. Fixed a pre-existing missing blank line before ### Work Log found while regenerating.

---

## TASK-047 — 2026-08-26
**What:** Added a library entry point to `@smekai/taskplanner`, so consumers can call `parseTasks`/`TaskStore` directly instead of spawning the MCP server to read markdown.
**Decisions:** Re-pointed `.` from the server to the library while nothing is published — the server bundle self-starts on import, which is backwards for a package entry, and the specifier could not be changed after the first publish. Server moved to `./mcp-server`. Shipped `.d.ts` via a declaration-only tsconfig, since an untyped library entry is half a deliverable.
**Outcome:** `release:check` passes; the smoke test now also requires the library from a fresh install and parses the board the MCP tools just edited. ESM named imports verified explicitly.

---

## TASK-046 — 2026-08-26
**What:** Published the MCP server as its own npm package, `@smekai/taskplanner` (`packages/mcp-server/`), so hosts outside an editor install can resolve it as a dependency.
**Decisions:** Build once and copy — esbuild still writes `plugins/taskplanner/dist/mcp-server.js` and the package ships those exact bytes, with `validate-versions` failing on any divergence, so there is still one board parser. Output stays CJS because the bundle reads its board HTML through `__dirname`. Kept a `bin` for `npx` but documented that programmatic consumers must spawn `process.execPath` + `require.resolve`, since a bin name is a `.cmd` shim on Windows.
**Outcome:** `npm run release:check` passes on Windows; the smoke test now packs, installs into an empty temp dir, and exercises both workspace-root paths plus the `**Assignee:**` round-trip. macOS/Linux untested. npm name `taskplanner` was taken, and the `@refined` npm org must be created before the first publish.

---

## TASK-045 — 2026-07-27
**What:** Labeled read-only task ID at the top of the edit detail view.
**Outcome:** Removed redundant footer ID; ID shown above Title with `.detail-readonly` styling.

---

## TASK-044 — 2026-07-27
**What:** Tag filter in sidebar list plus core `TaskFilter.tag` support.
**Outcome:** Tag popup in filter bar; text search also matches tags; unit tests added.

---

## TASK-043 — 2026-07-27
**What:** Stable list sorting by priority then ID within each group.
**Outcome:** Priority and name sorts now tie-break by task ID ascending; tests added.

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
