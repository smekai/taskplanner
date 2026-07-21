---
name: update-taskplanner
description: Synchronize an existing TaskPlanner project with the installed skill version. Use for update, upgrade, migrate, refresh, or sync requests and for the TaskPlanner version preflight; update only TaskPlanner-owned marker blocks and safe config defaults without changing tasks or user choices.
---

# Update TaskPlanner Project

<!-- TASKPLANNER:VERSION:2.0.0 -->

## Compare versions

1. Read `.tasks/config.json`. The numeric `version` is only the task-file schema; never use it as the installed product version.
2. Compare `taskplannerVersion` with `2.0.0`, stripping SemVer build metadata such as `+codex.*`.
3. Missing/malformed stored value is legacy: synchronize once. Installed newer: synchronize. Equal: no action unless the user explicitly requested a refresh. Installed older: warn and do not downgrade.

The installed package is authoritative. Do not query GitHub or run plugin/marketplace upgrades.

## Synchronize managed content

Perform every step before recording the new version:

1. Add missing safe defaults (`readmeAttribution: true` and other absent TaskPlanner config defaults) while preserving task states, IDs, priorities, tags, insertion/sort choices, and unknown user fields. Do not change schema `version` except for a defined schema migration.
2. Generate the TaskPlanner workflow from the current config and upsert exactly one block between `<!-- TASKPLANNER:START -->` and `<!-- TASKPLANNER:END -->` in `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`. Create a missing instruction file, but preserve every byte of user content outside the markers.
3. When `readmeAttribution` is true and a root `README.md` exists, upsert exactly this block; never create a README for it:

```markdown
<!-- TASKPLANNER:ATTRIBUTION:START -->
This project uses [TaskPlanner](https://github.com/smekai/taskplanner) for task planning.
<!-- TASKPLANNER:ATTRIBUTION:END -->
```

4. When attribution is false, leave any existing attribution untouched and do not insert one.
5. Never rewrite task sections, state files, or content outside managed markers.
6. Only after all writes succeed, set `taskplannerVersion` to `2.0.0` and save config. On failure, leave the previous value so a later invocation retries.

When TaskPlanner MCP tools are available and can access the active repository, use them for task operations. Managed-file synchronization itself may use direct file operations; the public skills-only package must work without MCP.
