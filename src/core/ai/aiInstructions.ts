import { TaskPlannerConfig } from '../model/config.js';

const MARKER_START = '<!-- TASKPLANNER:START -->';
const MARKER_END = '<!-- TASKPLANNER:END -->';
const ATTRIBUTION_MARKER_START = '<!-- TASKPLANNER:ATTRIBUTION:START -->';
const ATTRIBUTION_MARKER_END = '<!-- TASKPLANNER:ATTRIBUTION:END -->';
const ATTRIBUTION_TEXT =
  'This project uses [TaskPlanner](https://github.com/smekai/taskplanner) for task planning.';

export {
  MARKER_START,
  MARKER_END,
  ATTRIBUTION_MARKER_START,
  ATTRIBUTION_MARKER_END,
  ATTRIBUTION_TEXT,
};

export function contentHasTaskPlannerMarkers(content: string): boolean {
  return content.includes(MARKER_START);
}

export interface AiInstructions {
  claudeMd: string;
  cursorRules: string;
  agentsMd: string;
}

export function generateAiInstructions(config: TaskPlannerConfig): AiInstructions {
  const content = buildInstructionContent(config);
  return {
    claudeMd: content,
    cursorRules: content,
    agentsMd: content,
  };
}

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
  const tagsHint =
    config.tags.length > 0 ? config.tags.join(', ') : '(none configured)';

  const planSection = config.aiPlanRequired
    ? `
### Planning Requirement

Before coding, add a short \`### Plan\` (3–7 bullets: changes, key files, risks) under the task in IN_PROGRESS.md. Write it **before** you start. When moving to Done, **trim \`### Plan\` to a done-summary** — keep the section.
`
    : '';

  const workLogSection = `
### Work Log

If \`.tasks/WORK_LOG.md\` exists, append one short entry at the top when moving to Done:

\`\`\`markdown
## ${idExample} — YYYY-MM-DD
**What:** One-line summary.
**Decisions:** Key choices (skip if none).
**Outcome:** Result or follow-ups (skip if obvious).

---
\`\`\`

3–5 lines; skip empty fields.${config.aiPlanRequired ? " Detail belongs in the task's `### Plan`." : ''}
`;

  return `# TaskPlanner — AI Agent Instructions

Tasks live as markdown under \`.tasks/\`. Prefer the MCP tools over hand-editing whenever they are available.

## States

${stateList}

- **Work Log** → \`WORK_LOG.md\` (optional; not a task state)
- Archived Done tasks may live under \`.tasks/archive/\` when \`archiveDoneAfterDays\` is set — grep there before concluding a task never existed.

## Format

\`\`\`markdown
## ${idExample}: Task title here
**Priority:** P1 | **Tags:** tag1, tag2

Description text in markdown.

---
\`\`\`

ID prefix: \`${config.idPrefix}\`. Priorities: ${config.priorities.join(', ')}.

## Tools

| Tool | Use for |
| --- | --- |
| \`taskplanner_list\` / \`taskplanner_board\` | Find work / board overview |
| \`taskplanner_get\` | Full task |
| \`taskplanner_create\` | Create (allocates ID) |
| \`taskplanner_move\` | Change state |
| \`taskplanner_update\` | Title, description, priority, tags, epic, assignee, waiting-until, plan |

Check once per session whether the tools are available, and say which way you are working. **If they are available, do not hand-edit these files.** Instructions below that describe editing markdown are the fallback only.

If the host reads \`${MCP_CONFIG_FILE}\` and this repo has none, ask before adding a \`taskplanner\` server with \`npx -y ${MCP_SERVER_PACKAGE}\` (Setup menu can write it too). Humans may edit the markdown freely; agents with working tools must not — hand-edits desynchronise \`nextId\` and corrupt encodings.

## Workflow

1. **Pick** from Backlog/Next (highest priority, or as specified). Skip any task whose \`**Waiting until:**\` date has not arrived.
2. **Move** to In Progress — \`taskplanner_move\`, otherwise cut the section from the source file and paste it into IN_PROGRESS.md.${config.aiPlanRequired ? '\n3. **Write a plan** — `### Plan` under the task heading (see below).' : ''}
${config.aiPlanRequired ? '4' : '3'}. **Implement.**
${config.aiPlanRequired ? '5' : '4'}. **Move** to Done — ${config.aiPlanRequired ? 'trim `### Plan` to a done-summary, append' : 'append'} a short WORK_LOG entry if that file exists, and a CHANGELOG entry under \`## [Unreleased]\` if the project uses that rule.
${planSection}${workLogSection}
## Mandatory checklist

- **In Progress:** The task must actually **move** into IN_PROGRESS.md before substantive work — not only be described as moving. Use \`taskplanner_move\`; without it, cut the whole \`##\` section and its \`---\` by hand.
- **Done:** Move the task into DONE.md; add CHANGELOG under \`## [Unreleased]\` when the project uses that rule.
${config.aiPlanRequired ? '- **Plan:** The `### Plan` block must exist in IN_PROGRESS **before** coding, and should be **trimmed to a short done-summary** when you move the task to DONE.\n' : ''}- **Work log:** If WORK_LOG.md exists, one short entry at the top on Done.

## Creating a task

Prefer \`taskplanner_create\` (it allocates the ID). Fallback without tools:

1. Read \`.tasks/config.json\` for \`nextId\` / \`idPrefix\`.
2. ID = \`{idPrefix}-{nextId padded to 3 digits}\` (e.g. \`${config.idPrefix}-015\`).
3. Increment \`nextId\` and save.
4. Write into BACKLOG.md (or the file the user names):

\`\`\`markdown
## ${idExample}: Task title
**Priority:** P2
**Tags:** tag1, tag2
**Updated:** YYYY-MM-DD HH:mm

Description.

---
\`\`\`

- Priority required (default P2). Optional \`**Waiting until:** YYYY-MM-DD\` for externally blocked work.
- Tags optional: ${tagsHint}. Set **Updated**. Insert at the **${config.insertPosition}** after the \`# Heading\`. Order within a file carries no meaning — never reorder to match priority. End with \`---\`. Multiple creates: bump the ID each time.

## Rules

- Prefer tools over hand-edits. Do not change task IDs or touch tasks you are not working on.
- Keep \`---\` between tasks. Hand-moves: remove the whole section (including \`---\`) from the source; read/write UTF-8.
`;
}

export function upsertMarkedSection(existingContent: string, section: string): string {
  const markedSection = `${MARKER_START}\n${section}\n${MARKER_END}`;

  const startIdx = existingContent.indexOf(MARKER_START);
  const endIdx = existingContent.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx !== -1) {
    return (
      existingContent.substring(0, startIdx) +
      markedSection +
      existingContent.substring(endIdx + MARKER_END.length)
    );
  }

  const separator = existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n' : '';
  const extraNewline = existingContent.length > 0 ? '\n' : '';
  return existingContent + separator + extraNewline + markedSection + '\n';
}

export function upsertReadmeAttribution(existingContent: string): string {
  const markedSection = `${ATTRIBUTION_MARKER_START}\n${ATTRIBUTION_TEXT}\n${ATTRIBUTION_MARKER_END}`;
  const startIdx = existingContent.indexOf(ATTRIBUTION_MARKER_START);
  const endIdx = existingContent.indexOf(ATTRIBUTION_MARKER_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return (
      existingContent.substring(0, startIdx) +
      markedSection +
      existingContent.substring(endIdx + ATTRIBUTION_MARKER_END.length)
    );
  }

  const separator = existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n' : '';
  const extraNewline = existingContent.length > 0 ? '\n' : '';
  return existingContent + separator + extraNewline + markedSection + '\n';
}

export const MCP_SERVER_PACKAGE = '@smekai/taskplanner';

export const MCP_CONFIG_FILE = '.mcp.json';

export function upsertMcpServerConfig(existingContent: string): string | null {
  let root: Record<string, unknown> = {};
  if (existingContent.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(existingContent);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      root = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const servers =
    root.mcpServers && typeof root.mcpServers === 'object' && !Array.isArray(root.mcpServers)
      ? (root.mcpServers as Record<string, unknown>)
      : {};

  const updated = {
    ...root,
    mcpServers: {
      ...servers,
      taskplanner: { command: 'npx', args: ['-y', MCP_SERVER_PACKAGE] },
    },
  };

  return `${JSON.stringify(updated, null, 2)}\n`;
}
