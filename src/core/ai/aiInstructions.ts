import { TaskPlannerConfig } from '../model/config.js';

const MARKER_START = '<!-- TASKPLANNER:START -->';
const MARKER_END = '<!-- TASKPLANNER:END -->';

export { MARKER_START, MARKER_END };

/** True if synced TaskPlanner AI block is present (e.g. after Initialize AI Instructions). */
export function contentHasTaskPlannerMarkers(content: string): boolean {
  return content.includes(MARKER_START);
}

export interface AiInstructions {
  claudeMd: string;
  cursorRules: string;
}

export function generateAiInstructions(config: TaskPlannerConfig): AiInstructions {
  const content = buildInstructionContent(config);
  return {
    claudeMd: content,
    cursorRules: content,
  };
}

/** Default content for `.tasks/WORK_LOG.md` when initializing a new project. */
export const DEFAULT_WORK_LOG_CONTENT = `# Work Log

Top-level trace of completed work and key decisions. One entry per task moved to Done — newest at top. Keep entries short (3–5 lines); detailed steps stay in each task's \`### Plan\` in \`DONE.md\`.

**Entry template** (insert after this header, before existing entries):

\`\`\`markdown
## TASK-### — YYYY-MM-DD
**What:** One-line summary of what was delivered.
**Decisions:** Key choices made and why (skip if none).
**Outcome:** Result or follow-ups (skip if obvious from What).

---
\`\`\`
`;

function buildInstructionContent(config: TaskPlannerConfig): string {
  const stateList = config.states
    .sort((a, b) => a.order - b.order)
    .map((s) => `- **${s.name}** → \`${s.fileName}\``)
    .join('\n');

  const idExample = `${config.idPrefix}-001`;

  const planSection = config.aiPlanRequired
    ? `
### Planning Requirement

Before writing any code, you MUST add a \`### Plan\` subsection under the task heading in IN_PROGRESS.md:

\`\`\`markdown
## ${idExample}: Example task title
**Priority:** P1

Description of the task.

### Plan

- Step 1: ...
- Step 2: ...
- Key files: ...
\`\`\`

Keep the plan **short** (about 3–7 bullets): intended changes, key files or modules, and notable risks or edge cases. Expand only when the task is large.

The plan is free-form markdown. Write it **before** you start coding.

### Plan Persistence

When moving a completed task to DONE.md, **keep the \`### Plan\` section** with a condensed summary of what was done. This preserves the implementation history for future reference.`
    : '';

  const workLogSection = `
### Work Log

When moving a task to DONE.md, if \`.tasks/WORK_LOG.md\` exists, append **one short entry at the top** (after the header, before older entries):

\`\`\`markdown
## ${idExample} — YYYY-MM-DD
**What:** One-line summary of what was delivered.
**Decisions:** Key choices made and why (skip if none).
**Outcome:** Result or follow-ups (skip if obvious from What).

---
\`\`\`

Keep it to 3–5 lines total. Skip empty fields rather than writing "N/A". Detailed steps belong in the task's \`### Plan\`, not here.`;

  return `# TaskPlanner — AI Agent Instructions

This project uses [TaskPlanner](https://github.com/smekai/taskplanner) for task management.
Tasks are stored as markdown files in the \`.tasks/\` directory.

## Task File Structure

Each state has its own file:
${stateList}

Auxiliary file (optional rolling log, not a task state):
- **Work Log** → \`WORK_LOG.md\`

## Task Format

Each task is a \`## \` heading section separated by \`---\`:

\`\`\`markdown
## ${idExample}: Task title here
**Priority:** P1 | **Tags:** tag1, tag2

Description text in markdown.

---
\`\`\`

- **ID prefix:** \`${config.idPrefix}\`
- **Priorities:** ${config.priorities.join(', ')}

## Workflow for Implementing a Task

When asked to implement a task:

1. **Pick the task** from BACKLOG.md or NEXT.md (highest priority first, or as specified by the user).
2. **Move the task** to IN_PROGRESS.md by cutting it from the source file and pasting it into IN_PROGRESS.md.${config.aiPlanRequired ? '\n3. **Write a plan** — add a `### Plan` subsection under the task heading (see below).' : ''}
${config.aiPlanRequired ? '4' : '3'}. **Implement** the task.
${config.aiPlanRequired ? '5' : '4'}. **Move the task** to DONE.md when complete — trim \`### Plan\` to a done-summary, append a short entry to \`.tasks/WORK_LOG.md\` if that file exists, and add a **CHANGELOG.md** entry under \`## [Unreleased]\` if the project uses this changelog rule.
${planSection}${workLogSection}

## Mandatory checklist (do not skip)

These steps are **part of the work**, not optional housekeeping:

- **In Progress:** You must **physically move** the task markdown (the whole \`##\` section and its \`---\`) from BACKLOG/NEXT into **IN_PROGRESS.md** before substantive implementation — not only describe that you will.
- **Done:** When the implementation is finished, **move** the same task section from IN_PROGRESS.md into **DONE.md** and add a **CHANGELOG.md** entry under \`## [Unreleased]\` if the project uses this changelog rule.
- **Plan:** If this project requires a plan (${config.aiPlanRequired ? '**yes for this project** — see above' : 'check the **aiPlanRequired** field in .tasks/config.json'}), the \`### Plan\` block must exist in IN_PROGRESS **before** coding, and should be **trimmed to a short done-summary** when you move the task to DONE.
- **Work log:** If \`.tasks/WORK_LOG.md\` exists, append one short entry at the top when moving a task to Done (see **Work Log** above).

## Creating a New Task

When the user asks you to create a task:

1. **Read** \`.tasks/config.json\` to get the current \`nextId\` and \`idPrefix\`.
2. **Generate the ID** — format: \`{idPrefix}-{nextId padded to 3 digits}\` (e.g. \`${config.idPrefix}-015\`).
3. **Increment \`nextId\`** in \`.tasks/config.json\` and save the file.
4. **Write the task** into \`BACKLOG.md\` (or the file the user specifies) using this format:

\`\`\`markdown
## ${idExample}: Task title
**Priority:** P2
**Tags:** tag1, tag2
**Updated:** YYYY-MM-DD HH:mm

Description of the task in markdown.

---
\`\`\`

Rules for new tasks:
- **Priority** is required. If not specified by the user, default to \`P2\`.
- **Tags** are optional. Pick from the project's tag list if relevant: ${config.tags.length > 0 ? config.tags.join(', ') : '(none configured)'}.
- **Updated** — set to the current date/time.
- Add the task at the **${config.insertPosition}** of the file (after the \`# Heading\` line).
- Always end the task section with a \`---\` separator.
- If the user asks to create multiple tasks at once, increment the ID for each one.

## Important Rules

- Do NOT change task IDs.
- Do NOT modify tasks you are not working on.
- Keep the \`---\` separator between tasks.
- When moving a task, remove it entirely from the source file (including the trailing \`---\`).
`;
}

/**
 * Insert or update the TaskPlanner section in an existing file content.
 * Uses marker comments to make the operation idempotent.
 */
export function upsertMarkedSection(existingContent: string, section: string): string {
  const markedSection = `${MARKER_START}\n${section}\n${MARKER_END}`;

  const startIdx = existingContent.indexOf(MARKER_START);
  const endIdx = existingContent.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    return (
      existingContent.substring(0, startIdx) +
      markedSection +
      existingContent.substring(endIdx + MARKER_END.length)
    );
  }

  // Append to end
  const separator = existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n' : '';
  const extraNewline = existingContent.length > 0 ? '\n' : '';
  return existingContent + separator + extraNewline + markedSection + '\n';
}
