---
name: initialize-taskplanner
description: Initialize TaskPlanner in a repository. Use for install, setup, initialize, create-board, or first-time TaskPlanner requests; create the .tasks board, managed agent instructions, version metadata, and optional README attribution without overwriting existing project content.
---

# Initialize TaskPlanner

<!-- TASKPLANNER:VERSION:2.1.1 -->

1. Locate the active repository root. If `.tasks/config.json` already exists, do not replace the board; follow the sibling `update-taskplanner` skill instead.
2. Create `.tasks/` and `config.json` with schema `version: 2`, `taskplannerVersion: "2.1.1"`, `readmeAttribution: true`, `idPrefix: "TASK"`, `nextId: 1`, the five default states, priorities P0-P4, empty tags, top insertion, required AI plans, and priority sorting.
3. Create missing state files with `# <State>` headings and create `WORK_LOG.md` with a short completion-log heading/template. Never overwrite an existing file.
4. Apply the managed synchronization rules from the sibling `update-taskplanner` skill to `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and an existing root README.
5. Verify every required board file exists and the stored `taskplannerVersion` is `2.1.1`.

README attribution is voluntary. Do not create a README solely for it, do not duplicate the managed block, and preserve all content outside TaskPlanner markers.
