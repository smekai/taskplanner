import { Task, Priority, isPriority } from '../model/task.js';
import { ParseResult, ParseWarning } from '../model/parseResult.js';

const TASK_HEADING_RE = /^## ([A-Z]+-\d+):\s*(.+)$/;
const PRIORITY_RE = /^\*\*Priority:\*\*\s*(\S+)/;
const TAGS_RE = /^\*\*Tags?:\*\*\s*(.+)/;
const EPIC_RE = /^\*\*Epic:\*\*\s*(.+)/;
const ASSIGNEE_RE = /^\*\*Assignee:\*\*\s*(.+)/;
const UPDATED_RE = /^\*\*Updated:\*\*\s*(.+)/;
const WAITING_UNTIL_RE = /^\*\*Waiting until:\*\*\s*(.+)/;
const SEPARATOR_RE = /^---\s*$/;
const PLAN_HEADING_RE = /^### Plan\s*$/;

function stripBom(content: string): string {
  return content.length > 0 && content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function parseTasks(rawContent: string): ParseResult {
  const content = stripBom(rawContent);
  const lines = content.split('\n');
  const tasks: Task[] = [];
  const warnings: ParseWarning[] = [];

  let current: Partial<Task> | null = null;
  let currentHeadingLine = 0;
  let descriptionLines: string[] = [];
  let planLines: string[] = [];
  let inMetadata = true;
  let inPlan = false;

  function flushTask() {
    if (current?.id && current?.title) {
      const plan = planLines.join('\n').trim();
      tasks.push({
        id: current.id,
        title: current.title,
        description: descriptionLines.join('\n').trim(),
        priority: current.priority ?? Priority.P4,
        tags: current.tags ?? [],
        epic: current.epic,
        assignee: current.assignee,
        updatedAt: current.updatedAt,
        waitingUntil: current.waitingUntil,
        ...(plan ? { plan } : {}),
      });
    } else if (current) {
      warnings.push({
        line: currentHeadingLine,
        message: 'Incomplete task section could not be parsed (invalid or empty title)',
      });
    }
    current = null;
    descriptionLines = [];
    planLines = [];
    inMetadata = true;
    inPlan = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const headingMatch = line.match(TASK_HEADING_RE);

    if (headingMatch) {
      flushTask();
      const title = headingMatch[2].trim();
      if (!title) {
        warnings.push({
          line: lineNum,
          message: 'Task heading has no title',
        });
        current = null;
        continue;
      }
      current = {
        id: headingMatch[1],
        title,
        tags: [],
      };
      currentHeadingLine = lineNum;
      inMetadata = true;
      continue;
    }

    if (!current) {
      const t = line.trim();
      if (t === '') continue;
      if (SEPARATOR_RE.test(line)) continue;
      if (/^#\s/.test(line) && !line.startsWith('##')) continue;
      if (/^##\s/.test(line)) {
        warnings.push({
          line: lineNum,
          message:
            'Invalid task heading (use ## PREFIX-NNN: Title with uppercase prefix and digits)',
        });
        continue;
      }
      warnings.push({
        line: lineNum,
        message: 'Content is not part of any task (expected a ## TASK-NNN: Title heading)',
      });
      continue;
    }

    if (SEPARATOR_RE.test(line)) {
      flushTask();
      continue;
    }

    if (inMetadata) {
      const segments = line.includes('|') ? line.split('|').map((s) => s.trim()) : [line];
      let matchedAny = false;

      for (const segment of segments) {
        const priorityMatch = segment.match(PRIORITY_RE);
        if (priorityMatch) {
          const val = priorityMatch[1].trim();
          current.priority = isPriority(val) ? val : Priority.P4;
          matchedAny = true;
          continue;
        }

        const tagsMatch = segment.match(TAGS_RE);
        if (tagsMatch) {
          current.tags = tagsMatch[1]
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
          matchedAny = true;
          continue;
        }

        const epicMatch = segment.match(EPIC_RE);
        if (epicMatch) {
          current.epic = epicMatch[1].trim();
          matchedAny = true;
          continue;
        }

        const assigneeMatch = segment.match(ASSIGNEE_RE);
        if (assigneeMatch) {
          current.assignee = assigneeMatch[1].trim();
          matchedAny = true;
          continue;
        }

        const updatedMatch = segment.match(UPDATED_RE);
        if (updatedMatch) {
          current.updatedAt = updatedMatch[1].trim();
          matchedAny = true;
          continue;
        }

        const waitingMatch = segment.match(WAITING_UNTIL_RE);
        if (waitingMatch) {
          current.waitingUntil = waitingMatch[1].trim();
          matchedAny = true;
          continue;
        }
      }

      if (matchedAny) {
        continue;
      }

      if (line.trim() === '') {
        inMetadata = false;
        continue;
      }

      inMetadata = false;
      descriptionLines.push(line);
    } else if (PLAN_HEADING_RE.test(line)) {
      inPlan = true;
    } else if (inPlan) {
      planLines.push(line);
    } else {
      descriptionLines.push(line);
    }
  }

  flushTask();
  return { tasks, warnings };
}

export function findTaskLineNumber(content: string, taskId: string): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_HEADING_RE);
    if (match && match[1] === taskId) {
      return i + 1;
    }
  }
  return 1;
}

/** Count `## PREFIX-###:` task headings without full parsing (for deferred state loads). */
export function countTaskHeadings(rawContent: string): number {
  const content = stripBom(rawContent);
  let n = 0;
  for (const line of content.split('\n')) {
    if (TASK_HEADING_RE.test(line)) {
      n++;
    }
  }
  return n;
}

/** Highest numeric suffix among `## PREFIX-NNN:` headings in raw markdown, or 0 if none. */
export function maxTaskIdNumber(rawContent: string, prefix: string): number {
  const content = stripBom(rawContent);
  const re = new RegExp(`^## ${prefix}-(\\d+):`);
  let max = 0;
  for (const line of content.split('\n')) {
    const m = line.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) {
        max = n;
      }
    }
  }
  return max;
}
