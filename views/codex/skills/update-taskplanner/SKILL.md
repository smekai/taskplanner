---
name: update-taskplanner
description: Synchronize an existing TaskPlanner project with the installed skill version. Use for update, upgrade, migrate, refresh, or sync requests and for the TaskPlanner version preflight; update only TaskPlanner-owned marker blocks and safe config defaults without changing tasks or user choices.
---

# Update TaskPlanner Project

<!-- TASKPLANNER:VERSION:3.0.22 -->

## Compare versions

1. Read `.tasks/config.json`. The numeric `version` is only the task-file schema; never use it as the installed product version.
2. Compare `taskplannerVersion` with the version in this skill's `TASKPLANNER:VERSION` marker, stripping SemVer build metadata such as `+codex.*`.
3. Missing/malformed stored value is legacy: synchronize once. Installed newer: synchronize. Equal: no synchronization unless the user explicitly requested a refresh. Installed older: warn and do not downgrade.
4. Whatever the comparison says, run **Upgrading to 3.0** below when it is still pending. The VS Code/Cursor extension records the new `taskplannerVersion` on its own, without those checks, so the version cannot tell whether they ran.

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
6. Only after all writes succeed, set `taskplannerVersion` to the marker version and save config. On failure, leave the previous value so a later invocation retries.

## Upgrading to 3.0

These checks are tracked on their own, in the `upgradeChecks` array of `.tasks/config.json`, not by `taskplannerVersion`. Run them when that array is missing or does not contain `"3.0"`, and on every explicit update, upgrade or refresh request even when it does. Task files, IDs and the config schema need no change. Change nothing outside the managed markers unless the user agrees.

1. **Duplicate MCP server.** If `.mcp.json` lists a server that runs `@smekai/taskplanner` (for example `npx -y @smekai/taskplanner`), and this session already has TaskPlanner tools from the installed plugin (tool names with a plugin prefix, such as `mcp__plugin_taskplanner_…`), tell the user the tools load twice and offer to remove that one entry. On a yes, remove only that entry and keep the rest of the file; if no servers remain, offer to delete the file. Without the plugin's tools, keep the entry: it is how this host reaches TaskPlanner.
2. **Removed tool.** 3.0 removed `taskplanner_board_data`. Search the instruction files and `.cursor/`, `.claude/` and `.codex/` for it. The managed blocks are regenerated anyway; for mentions outside them, list each place and suggest `taskplanner_board` for a text overview or `taskplanner_board_visual` for the interactive board. Edit them only on a yes.
3. Tell the user what changed and what they chose to keep, in two or three lines. If neither check found anything, say nothing about them.
4. Then add `"3.0"` to `upgradeChecks`, creating the array if needed and keeping every other field, whatever the user chose, so the checks are not offered again unasked.

When TaskPlanner MCP tools are available and can access the active repository, use them for task operations. Managed-file synchronization itself may use direct file operations; the public skills-only package must work without MCP.
