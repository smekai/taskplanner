# Backlog

## TASK-036: Harden config.json loading — validate states, log failures to output channel
**Priority:** P1 | **Tags:** core, setup
**Updated:** 2026-07-13 00:00

A malformed `.tasks/config.json` (e.g. `states` as plain strings instead of `{name, fileName, order}` objects, as found in the adhd repo) makes every `path.join(tasksDir, state.fileName)` throw and the extension silently fails — the sidebar just shows nothing. `ConfigManager.load()` should validate/normalize `states` (map known string names to their default state objects, otherwise fall back to `DEFAULT_STATES`), log the problem to the "TaskPlanner" output channel, and surface a warning notification instead of dying silently. Note: `migrateConfig()` also corrupts such configs further by appending an object `Rejected` entry to the string array.

---

## TASK-023: CI/CD pipeline for extension delivery
**Priority:** P4 | **Tags:** setup
**Updated:** 2026-03-22 19:15

Automate publishing the extension to VS Code Marketplace and Cursor. Explore JetBrains Marketplace for the future plugin. Set up auto-merge for PRs into master after checks pass.

---

## TASK-019: IntelliJ IDEA extension and Julia format support
**Priority:** P3 | **Tags:** feature
**Updated:** 2026-03-20 00:00

Build an IntelliJ IDEA plugin that reuses the core library for task parsing/serialization. Integrate support for the Julia task format.

---

## TASK-021: Task date tracking and statistics
**Priority:** P3 | **Tags:** feature, core
**Updated:** 2026-03-21 19:01

Add created date, updated date, and finished date fields to tasks. Provide a way to track and display statistics (cycle time, throughput, etc.) for tasks and overall performance.

---
