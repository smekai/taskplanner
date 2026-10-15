// src/claude-mod/boardModel.ts
var IN_PROGRESS_STATE = "In Progress";
var COMPLETED_STATES = ["Done", "Rejected"];
var BOARD_FILE_PATTERN = /^(.+\.md|config\.json)$/;
var DEFAULT_TAB_ORDER = [IN_PROGRESS_STATE, "Next", "Backlog"];
var TASKPLANNER_WRITE_TOOL = /__taskplanner_(create|move|update)$/;
var PANE_WRITE_TOOL = /^mcp__.+__taskplanner_(move|create)$/;
var TASK_ID_IN_TEXT = /\b([A-Z][A-Z0-9]*-\d+)\b/;
var PRIORITIES = ["P0", "P1", "P2", "P3", "P4"];
var DEFAULT_NEW_PRIORITY = "P2";
var OWN_PLUGIN = "taskplanner";
var FILE_EDIT_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
var TASKS_DIR_SEGMENT = /(^|[\\/])\.tasks[\\/]/;
var PERMISSION_REFUSAL = /refused|permission|classifier|haven't granted/i;
function resultText(result) {
  return result.content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n").trim();
}
function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function stringField(record, key) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}
function tagsOf(task) {
  return Array.isArray(task.tags) ? task.tags.filter((tag) => typeof tag === "string") : [];
}
function taskBody(task) {
  const sections = [];
  const description = stringField(task, "description");
  if (description) sections.push(description);
  const plan = stringField(task, "plan");
  if (plan) sections.push(`### Plan

${plan}`);
  return sections.join("\n\n");
}
function taskMarkdown(task) {
  const meta = [
    `**Priority:** ${stringField(task, "priority")}`,
    `**State:** ${stringField(task, "state")}`
  ];
  const tags = tagsOf(task);
  if (tags.length > 0) meta.push(`**Tags:** ${tags.join(", ")}`);
  for (const [key, label] of [
    ["epic", "Epic"],
    ["assignee", "Assignee"],
    ["waitingUntil", "Waiting until"],
    ["updatedAt", "Updated"]
  ]) {
    const value = stringField(task, key);
    if (value) meta.push(`**${label}:** ${value}`);
  }
  const sections = [
    `## ${stringField(task, "id")}: ${stringField(task, "title")}`,
    meta.join(" \xB7 ")
  ];
  const body = taskBody(task);
  if (body) sections.push(body);
  return sections.join("\n\n");
}
function boardDigestText(board2) {
  const counts = board2.states.map((state) => `${state.name} ${state.totalCount}`).join(" \xB7 ");
  const lines = [counts];
  for (const name of [IN_PROGRESS_STATE, "Next"]) {
    for (const task of stateNamed(board2, name)?.tasks ?? []) {
      lines.push(`- ${name}: ${task.id} ${task.priority} ${task.title}`);
    }
  }
  return lines.join("\n");
}
function stateNamed(board2, name) {
  return board2.states.find((state) => state.name === name);
}
function pickTab(board2, current) {
  if (current && stateNamed(board2, current)) return current;
  const withTasks = DEFAULT_TAB_ORDER.find(
    (name) => (stateNamed(board2, name)?.totalCount ?? 0) > 0
  );
  if (withTasks) return withTasks;
  const present = DEFAULT_TAB_ORDER.find((name) => stateNamed(board2, name));
  return present ?? board2.states[0]?.name ?? null;
}
function isCompletedState(name) {
  return name !== null && COMPLETED_STATES.includes(name);
}
function moveTargets(board2, currentState) {
  return board2.states.map((state) => state.name).filter((name) => name !== currentState);
}
function moveKey(target) {
  return `move-${slug(target)}`;
}
function moveTargetForKey(board2, currentState, key) {
  return moveTargets(board2, currentState).find((target) => moveKey(target) === key) ?? null;
}
function inProgressTask(board2) {
  return board2 && stateNamed(board2, IN_PROGRESS_STATE)?.tasks[0] || null;
}
function shouldRefreshAfterTool(tool, input) {
  if (TASKPLANNER_WRITE_TOOL.test(tool)) return true;
  if (!FILE_EDIT_TOOLS.has(tool)) return false;
  const target = input.file_path ?? input.notebook_path;
  return typeof target === "string" && TASKS_DIR_SEGMENT.test(target);
}
var TEXT_SCALE_VERSION = [2, 1, 299];
function supportsTextScale(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  for (let index = 0; index < TEXT_SCALE_VERSION.length; index += 1) {
    if (parts[index] !== TEXT_SCALE_VERSION[index]) return parts[index] > TEXT_SCALE_VERSION[index];
  }
  return true;
}
function isOwnPlugin(name) {
  return name === OWN_PLUGIN || name.startsWith(`${OWN_PLUGIN}@`);
}
function isPaneWriteByOwnPlugin(origin, tool) {
  return isOwnPlugin(origin) && PANE_WRITE_TOOL.test(tool);
}
function describeError(message) {
  if (PERMISSION_REFUSAL.test(message)) {
    return {
      title: "Claude Code did not allow the change.",
      detail: `Allow the TaskPlanner move and create tools for this project, then try again. ${message}`
    };
  }
  return { title: "Something went wrong with the board.", detail: message };
}
function newTaskStates(board2) {
  const names = board2?.states.map((state) => state.name) ?? [];
  return names.filter((name) => !isCompletedState(name));
}
function startDraft(board2, activeTab2) {
  const states = newTaskStates(board2);
  const state = activeTab2 && states.includes(activeTab2) ? activeTab2 : states.includes("Backlog") ? "Backlog" : states[0] ?? "Backlog";
  return { title: "", priority: DEFAULT_NEW_PRIORITY, state };
}
function createdTaskId(result) {
  const structured = result.structuredContent;
  if (typeof structured?.task?.id === "string") return structured.task.id;
  const text = resultText(result);
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.task?.id === "string") return parsed.task.id;
  } catch {
    return TASK_ID_IN_TEXT.exec(text)?.[1] ?? null;
  }
  return TASK_ID_IN_TEXT.exec(text)?.[1] ?? null;
}
function editPrompt(task) {
  return `Update ${task.id} (${task.title}): `;
}
function boardSignature(files) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name)).map((file) => `${file.name}:${file.size}:${file.mtimeMs}`).join("|");
}
function joinPath(root, ...parts) {
  return [root.replace(/[\\/]+$/, ""), ...parts].join("/");
}
function startPrompt(task) {
  const verb = task.state === IN_PROGRESS_STATE ? "Continue" : "Work on";
  return `${verb} ${task.id} (${task.title}) following the TaskPlanner workflow.`;
}
function truncate(text, width) {
  if (width <= 1) return text.slice(0, Math.max(0, width));
  return text.length <= width ? text : `${text.slice(0, width - 1)}\u2026`;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/core/model/state.ts
var DEFAULT_STATES = [
  { name: "Backlog", fileName: "BACKLOG.md", order: 0 },
  { name: "Next", fileName: "NEXT.md", order: 1 },
  { name: "In Progress", fileName: "IN_PROGRESS.md", order: 2 },
  { name: "Done", fileName: "DONE.md", order: 3 },
  { name: "Rejected", fileName: "REJECTED.md", order: 4 }
];

// src/core/config/configStates.ts
function isUsableState(value) {
  if (!value || typeof value !== "object") return false;
  const state = value;
  return typeof state.name === "string" && state.name.length > 0 && typeof state.fileName === "string" && state.fileName.length > 0 && typeof state.order === "number" && Number.isFinite(state.order);
}
function normalizeStates(value, report) {
  if (!Array.isArray(value)) {
    report(`"states" must be an array of {name, fileName, order}; using the default board.`);
    return [...DEFAULT_STATES];
  }
  const normalized = [];
  for (const entry of value) {
    if (isUsableState(entry)) {
      normalized.push({ name: entry.name, fileName: entry.fileName, order: entry.order });
      continue;
    }
    const name = typeof entry === "string" ? entry : entry?.name;
    const known = DEFAULT_STATES.find((s) => s.name === name);
    if (known) {
      report(`State "${known.name}" was malformed in config.json; restored from the defaults.`);
      normalized.push({ ...known });
      continue;
    }
    report(
      `Unusable entry in "states": ${JSON.stringify(entry)}. Using the default board instead.`
    );
    return [...DEFAULT_STATES];
  }
  if (normalized.length === 0) {
    report(`"states" was empty; using the default board.`);
    return [...DEFAULT_STATES];
  }
  return normalized;
}

// src/core/filter/taskFilter.ts
var DEFAULT_LIMIT = 50;
function applyLimit(items, totalCount, limit) {
  if (limit === null) {
    return { sliced: items, hasMore: false };
  }
  return { sliced: items.slice(0, limit), hasMore: totalCount > limit };
}
function taskToViewItem(task) {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    tags: [...task.tags],
    epic: task.epic,
    assignee: task.assignee,
    updatedAt: task.updatedAt,
    description: task.description
  };
}
function matchesQuery(task, query) {
  const q = query.toLowerCase();
  return task.id.toLowerCase().includes(q) || task.title.toLowerCase().includes(q) || (task.assignee?.toLowerCase().includes(q) ?? false) || (task.updatedAt?.toLowerCase().includes(q) ?? false) || task.tags.some((tag) => tag.toLowerCase().includes(q));
}
function matchesTag(task, tag) {
  return task.tags.includes(tag);
}
var PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
function compareById(a, b) {
  return a.id.localeCompare(b.id);
}
function sortTasks(tasks, sortBy) {
  if (sortBy === "file") {
    return [...tasks];
  }
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (sortBy) {
      case "priority": {
        const diff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        return diff !== 0 ? diff : compareById(a, b);
      }
      case "name": {
        const diff = a.title.localeCompare(b.title);
        return diff !== 0 ? diff : compareById(a, b);
      }
      case "id":
        return compareById(a, b);
      default:
        return 0;
    }
  });
  return sorted;
}
function filterAndPaginate(tasksByState, states, filter, limit = DEFAULT_LIMIT, sortBy = "priority", stateDisplayCounts) {
  const result = [];
  for (const state of states) {
    if (filter?.status && filter.status !== state.name) {
      continue;
    }
    let tasks = tasksByState.get(state.name) ?? [];
    if (filter?.query) {
      tasks = tasks.filter((t) => matchesQuery(t, filter.query));
    }
    if (filter?.tag) {
      tasks = tasks.filter((t) => matchesTag(t, filter.tag));
    }
    tasks = sortTasks(tasks, sortBy);
    const hasContentFilter = Boolean(filter?.query?.trim()) || Boolean(filter?.tag);
    const totalCount = hasContentFilter ? tasks.length : stateDisplayCounts?.get(state.name) ?? tasks.length;
    const { sliced, hasMore } = applyLimit(tasks, totalCount, limit);
    result.push({
      name: state.name,
      tasks: sliced.map(taskToViewItem),
      totalCount,
      hasMore
    });
  }
  return { states: result, filter };
}

// src/core/model/task.ts
var Priority = /* @__PURE__ */ ((Priority2) => {
  Priority2["P0"] = "P0";
  Priority2["P1"] = "P1";
  Priority2["P2"] = "P2";
  Priority2["P3"] = "P3";
  Priority2["P4"] = "P4";
  return Priority2;
})(Priority || {});

// src/core/parser/grammar.ts
var LINE_BREAK = /\r?\n/;
var TASK_HEADING_RE = /^## ([A-Z]+-\d+):\s*(\S.*)$/;
var SEPARATOR_RE = /^---\s*$/;
var PLAN_HEADING_RE = /^### Plan\s*$/;
var ATTRIBUTE_RE = /^\*\*(.+?):\*\*\s*(.*)$/;
var SEPARATOR_BEFORE_NEXT_FIELD = /\s\|\s(?=\*\*)/;
var BUILT_IN_FIELD_RES = {
  priority: /^\*\*Priority:\*\*\s*(\S*)/,
  tags: /^\*\*Tags?:\*\*\s*(.+)/,
  epic: /^\*\*Epic:\*\*\s*(.+)/,
  assignee: /^\*\*Assignee:\*\*\s*(.+)/,
  updatedAt: /^\*\*Updated:\*\*\s*(.+)/,
  waitingUntil: /^\*\*Waiting until:\*\*\s*(.+)/
};
function taskHeadingOf(line) {
  const match = line.match(TASK_HEADING_RE);
  return match ? { id: match[1], title: match[2].trim() } : void 0;
}
function taskHeadingIdOf(line) {
  return taskHeadingOf(line)?.id;
}
function looksLikeTaskHeading(line) {
  return /^##\s/.test(line) && !/^###/.test(line);
}
function isSectionSeparatorLine(line) {
  return SEPARATOR_RE.test(line);
}
function isPlanHeadingLine(line) {
  return PLAN_HEADING_RE.test(line);
}
function builtInFieldOf(segment) {
  for (const [field, pattern] of Object.entries(BUILT_IN_FIELD_RES)) {
    const match = segment.match(pattern);
    if (match) return { field, value: match[1].trim() };
  }
  return void 0;
}
function attributeOf(segment) {
  const match = segment.match(ATTRIBUTE_RE);
  return match ? { key: match[1].trim(), value: match[2].trim() } : void 0;
}
function splitFieldGroup(line) {
  return line.split(SEPARATOR_BEFORE_NEXT_FIELD).map((segment) => segment.trim());
}
var PRIORITY_VALUES = Object.values(Priority);
function parsePriority(value) {
  const normalized = value.trim().toUpperCase();
  return PRIORITY_VALUES.find((priority) => priority === normalized);
}

// src/core/parser/fileSections.ts
function lineSpans(content) {
  const spans = [];
  let start = 0;
  while (start < content.length) {
    const brk = content.indexOf("\n", start);
    const stop = brk === -1 ? content.length : brk;
    spans.push({
      text: content.slice(start, stop).replace(/\r$/, ""),
      start,
      end: brk === -1 ? content.length : brk + 1
    });
    if (brk === -1) break;
    start = brk + 1;
  }
  return spans;
}
function sectionEnd(spans, from) {
  for (let i = from; i < spans.length; i++) {
    if (isSectionSeparatorLine(spans[i].text)) return i + 1;
    if (i > from && taskHeadingIdOf(spans[i].text) !== void 0) return i;
  }
  return spans.length;
}
function splitSections(content) {
  const spans = lineSpans(content);
  const sections = [];
  const sliceOf = (from, to) => content.slice(spans[from].start, spans[to - 1].end);
  let at = 0;
  let textFrom = 0;
  const flushText = (to) => {
    if (to > textFrom) {
      sections.push({ kind: "text", raw: sliceOf(textFrom, to), line: textFrom + 1 });
    }
  };
  while (at < spans.length) {
    const id = taskHeadingIdOf(spans[at].text);
    if (id === void 0) {
      at++;
      continue;
    }
    flushText(at);
    const end = sectionEnd(spans, at);
    sections.push({ kind: "task", id, raw: sliceOf(at, end), line: at + 1 });
    at = end;
    textFrom = end;
  }
  flushText(spans.length);
  return sections;
}

// src/core/parser/taskSection.ts
var MISSING_PRIORITY = "P4" /* P4 */;
function assign(collected, segment) {
  const builtIn = builtInFieldOf(segment);
  if (builtIn) {
    collected.fields[builtIn.field] = builtIn.value;
    return true;
  }
  const attribute = attributeOf(segment);
  if (attribute) {
    collected.attributes[attribute.key] = attribute.value;
    return true;
  }
  return false;
}
function readFieldOrFieldGroup(collected, line) {
  const segments = splitFieldGroup(line);
  let matched = false;
  for (const segment of segments) {
    if (assign(collected, segment)) matched = true;
  }
  return matched;
}
function tagsOf2(raw) {
  if (raw === void 0) return [];
  return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
}
function priorityOf(raw, line, errors, warnings) {
  if (raw === void 0) {
    warnings.push({ line, message: `No **Priority:** line; read as ${MISSING_PRIORITY}.` });
    return MISSING_PRIORITY;
  }
  const parsed = parsePriority(raw);
  if (parsed) return parsed;
  const valid = PRIORITY_VALUES.join(", ");
  const message = raw.length === 0 ? `**Priority:** has no value; expected one of ${valid}.` : `**Priority:** "${raw}" is not a priority; expected one of ${valid}.`;
  errors.push({ line, message });
  return MISSING_PRIORITY;
}
function parseTaskSection(raw, startLine) {
  const lines = raw.split(LINE_BREAK);
  const errors = [];
  const warnings = [];
  const heading = taskHeadingOf(lines[0]);
  if (!heading) {
    return { errors, warnings };
  }
  const collected = { fields: {}, attributes: {}, description: [], plan: [] };
  let inMetadata = true;
  let inPlan = false;
  let priorityLine = startLine;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionSeparatorLine(line)) break;
    if (inMetadata) {
      if (readFieldOrFieldGroup(collected, line)) {
        if (collected.fields.priority !== void 0 && priorityLine === startLine) {
          priorityLine = startLine + i;
        }
        continue;
      }
      inMetadata = false;
      if (line.trim() === "") continue;
    }
    if (isPlanHeadingLine(line)) {
      inPlan = true;
      continue;
    }
    (inPlan ? collected.plan : collected.description).push(line);
  }
  const plan = collected.plan.join("\n").trim();
  const task = {
    id: heading.id,
    title: heading.title,
    description: collected.description.join("\n").trim(),
    priority: priorityOf(collected.fields.priority, priorityLine, errors, warnings),
    tags: tagsOf2(collected.fields.tags),
    epic: collected.fields.epic,
    assignee: collected.fields.assignee,
    updatedAt: collected.fields.updatedAt,
    waitingUntil: collected.fields.waitingUntil,
    ...plan ? { plan } : {},
    ...Object.keys(collected.attributes).length > 0 ? { attributes: collected.attributes } : {}
  };
  return { task, errors, warnings };
}

// src/core/parser/taskParser.ts
var BOM = "\uFEFF";
function stripBom(content) {
  return content.startsWith(BOM) ? content.slice(1) : content;
}
function brokenHeadings(section) {
  const lines = section.raw.split(LINE_BREAK);
  const starts = lines.map((line, index) => looksLikeTaskHeading(line) ? index : -1).filter((index) => index !== -1);
  return starts.map((start, nth) => ({
    line: section.line + start,
    message: `"${lines[start].trim()}" is not a task heading, so this section was not read as a task. Use "## PREFIX-000: Title" with an uppercase prefix, digits, and a title.`,
    raw: lines.slice(start, starts[nth + 1] ?? lines.length).join("\n")
  }));
}
function parseTasks(rawContent) {
  const content = stripBom(rawContent);
  const tasks = [];
  const errors = [];
  const warnings = [];
  const segments = [];
  if (rawContent.startsWith(BOM)) {
    segments.push({ kind: "text", raw: BOM });
  }
  for (const section of splitSections(content)) {
    if (section.kind === "text") {
      errors.push(...brokenHeadings(section));
      segments.push({ kind: "text", raw: section.raw });
      continue;
    }
    const parsed = parseTaskSection(section.raw, section.line);
    errors.push(...parsed.errors);
    warnings.push(...parsed.warnings);
    if (parsed.task) {
      tasks.push(parsed.task);
      segments.push({ kind: "task", task: parsed.task, raw: section.raw });
      continue;
    }
    errors.push(...brokenHeadings(section));
    segments.push({ kind: "text", raw: section.raw });
  }
  return { tasks, errors, warnings, segments };
}
function headingIds(rawContent) {
  return stripBom(rawContent).split(LINE_BREAK).map(taskHeadingIdOf).filter((id) => id !== void 0);
}
function countTaskHeadings(rawContent) {
  return headingIds(rawContent).length;
}

// src/claude-mod/boardReader.ts
var BOARD_TASK_LIMIT = 50;
function withoutBom(text) {
  return text.charCodeAt(0) === 65279 ? text.slice(1) : text;
}
function readConfigStates(configText) {
  let parsed;
  try {
    parsed = JSON.parse(withoutBom(configText));
  } catch {
    throw new Error(".tasks/config.json is not valid JSON.");
  }
  const states = parsed?.states;
  return states === void 0 ? [...DEFAULT_STATES] : normalizeStates(states, () => void 0);
}
function buildBoard(states, fileTexts, loadCompleted, workspaceRoot) {
  const tasksByState = /* @__PURE__ */ new Map();
  const displayCounts = /* @__PURE__ */ new Map();
  const tasks = /* @__PURE__ */ new Map();
  let issueCount2 = 0;
  for (const state of states) {
    const text = fileTexts.get(state.fileName) ?? "";
    if (isCompletedState(state.name) && !loadCompleted) {
      tasksByState.set(state.name, []);
      displayCounts.set(state.name, countTaskHeadings(text));
      continue;
    }
    const parsed = parseTasks(text);
    issueCount2 += parsed.errors.length;
    tasksByState.set(state.name, parsed.tasks);
    displayCounts.set(state.name, parsed.tasks.length);
    for (const task of parsed.tasks) tasks.set(task.id, { task, state: state.name });
  }
  const view = filterAndPaginate(
    tasksByState,
    [...states],
    void 0,
    BOARD_TASK_LIMIT,
    "priority",
    displayCounts
  );
  return { snapshot: { states: view.states, workspaceRoot }, tasks, issueCount: issueCount2 };
}
function taskDetailOf({ task, state }) {
  const record = { ...task, state };
  return {
    id: task.id,
    title: task.title,
    state,
    priority: task.priority,
    tags: [...task.tags],
    text: taskMarkdown(record),
    body: taskBody(record)
  };
}

// src/claude-mod/paneView.ts
var MAX_DIGIT_HOTKEYS = 9;
var MIN_LABEL_WIDTH = 12;
var BAND_BUTTON_ROOM = 8;
var PRIORITY_COLORS = {
  P0: "error",
  P1: "warning",
  P2: "suggestion",
  P3: "subtle",
  P4: "inactive"
};
function textStyle(style, role) {
  if (!style.hasTextScale) {
    if (role === "title" || role === "heading" || role === "chip") return { bold: true };
    return { dimColor: true };
  }
  switch (role) {
    case "title":
      return { size: "title", weight: "semibold" };
    case "heading":
      return { size: "heading", weight: "semibold" };
    case "chip":
      return { size: "caption", weight: "semibold" };
    case "id":
      return { size: "caption", mono: true, dimColor: true };
    default:
      return { size: "caption", dimColor: true };
  }
}
function digitHotkey(index) {
  return index < MAX_DIGIT_HOTKEYS ? { hotkey: String(index + 1) } : {};
}
function chrome(style) {
  return style.isRich ? {} : { plain: true };
}
function priorityChip(style, priority) {
  return style.el.Text({
    ...textStyle(style, "chip"),
    color: PRIORITY_COLORS[priority] ?? "subtle",
    children: [priority]
  });
}
function caption(style, text) {
  return style.el.Text({ ...textStyle(style, "caption"), wrap: "wrap", children: [text] });
}
function countsLine(board2) {
  return board2.states.map((state) => `${state.totalCount} ${state.name.toLowerCase()}`).join(" \xB7 ");
}
function canWrite(model) {
  return model.surface !== "mobile" && model.board !== null && !model.isMissingBoard;
}
function headerButtons(style, model, actions) {
  const buttons = [
    style.el.Button({
      key: "refresh",
      label: "Refresh",
      hotkey: "r",
      plain: true,
      onPress: actions.refresh
    })
  ];
  if (canWrite(model) && !model.draft) {
    buttons.unshift(
      style.el.Button({
        key: "new-task",
        label: style.isRich ? "+ New task" : "New task",
        hotkey: "n",
        plain: true,
        onPress: actions.newTask
      })
    );
  }
  return buttons;
}
function header(style, model, actions) {
  const buttons = headerButtons(style, model, actions);
  if (!style.isRich) {
    const status = model.isLoading ? " \xB7 loading\u2026" : "";
    return style.el.Box({
      flexDirection: "row",
      columnGap: 2,
      children: [style.el.Text({ bold: true, children: [`TaskPlanner${status}`] }), ...buttons]
    });
  }
  const summary = model.isLoading ? "Refreshing\u2026" : model.board ? countsLine(model.board) : "Markdown tasks in .tasks/";
  return style.el.Box({
    flexDirection: "column",
    children: [
      style.el.Box({
        flexDirection: "row",
        columnGap: 2,
        children: [
          style.el.Text({ ...textStyle(style, "title"), children: ["TaskPlanner"] }),
          ...buttons
        ]
      }),
      caption(style, summary)
    ]
  });
}
function errorBlock(style, message, actions) {
  const summary = describeError(message);
  return style.el.Box({
    flexDirection: "column",
    marginTop: 1,
    children: [
      style.el.Text({ color: "error", bold: true, children: [summary.title] }),
      caption(style, summary.detail),
      style.el.Button({ key: "retry", label: "Retry", ...chrome(style), onPress: actions.refresh })
    ]
  });
}
function tabs(style, board2, active, actions) {
  return style.el.Box({
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: style.isRich ? 1 : 2,
    rowGap: style.isRich ? 1 : 0,
    marginTop: 1,
    children: board2.states.map(
      (state, index) => style.el.Button({
        key: `tab-${slug(state.name)}`,
        label: `${state.name} ${state.totalCount}`,
        ...digitHotkey(index),
        ...chrome(style),
        ...style.isRich ? { variant: state.name === active ? "primary" : "secondary" } : {},
        dimColor: state.name !== active,
        onPress: () => actions.selectTab(state.name)
      })
    )
  });
}
function plainRow(style, task, columns, actions) {
  const label = `${task.id} ${task.priority} ${task.title}`;
  return style.el.Button({
    key: `task-${task.id}`,
    label: truncate(label, Math.max(MIN_LABEL_WIDTH, columns)),
    plain: true,
    onPress: () => actions.openTask(task.id)
  });
}
function card(style, task, actions) {
  const meta = [
    style.el.Text({ ...textStyle(style, "id"), children: [task.id] }),
    priorityChip(style, task.priority)
  ];
  if (task.tags.length > 0) meta.push(caption(style, task.tags.join(", ")));
  if (task.assignee) meta.push(caption(style, `@${task.assignee}`));
  return style.el.Box({
    key: `card-${task.id}`,
    flexDirection: "column",
    borderStyle: "round",
    paddingX: 1,
    children: [
      style.el.Box({ flexDirection: "row", columnGap: 1, children: meta }),
      style.el.Button({
        key: `task-${task.id}`,
        label: task.title,
        plain: true,
        onPress: () => actions.openTask(task.id)
      })
    ]
  });
}
function listView(style, model, board2, actions) {
  const state = stateNamed(board2, model.tab);
  const rows = [];
  if (!state) {
    rows.push(caption(style, "This board has no states."));
  } else if (state.tasks.length === 0) {
    rows.push(caption(style, `No tasks in ${state.name}.`));
  } else {
    rows.push(
      ...state.tasks.map(
        (task) => style.isRich ? card(style, task, actions) : plainRow(style, task, model.columns, actions)
      )
    );
    if (state.hasMore) {
      rows.push(caption(style, `+${state.totalCount - state.tasks.length} more`));
    }
  }
  return [
    tabs(style, board2, model.tab, actions),
    style.el.Box({
      flexDirection: "column",
      rowGap: style.isRich ? 1 : 0,
      marginTop: 1,
      children: rows
    })
  ];
}
function detailHeading(style, detail2) {
  if (!style.isRich) return [];
  const chips = [
    style.el.Text({ ...textStyle(style, "id"), children: [detail2.id] }),
    priorityChip(style, detail2.priority),
    caption(style, detail2.state)
  ];
  if (detail2.tags.length > 0) chips.push(caption(style, detail2.tags.join(", ")));
  return [
    style.el.Text({ ...textStyle(style, "heading"), wrap: "wrap", children: [detail2.title] }),
    style.el.Box({ flexDirection: "row", columnGap: 1, children: chips })
  ];
}
function detailView(style, board2, detail2, canWriteDetail, actions) {
  const commands = [
    style.el.Button({
      key: "back",
      label: "Back",
      hotkey: "b",
      plain: true,
      onPress: actions.back
    })
  ];
  if (!isCompletedState(detail2.state)) {
    commands.push(
      style.el.Button({
        key: "start",
        label: "Start with Claude",
        hotkey: "s",
        ...chrome(style),
        ...style.isRich ? { variant: "primary" } : {},
        onPress: () => actions.start(detail2)
      })
    );
  }
  commands.push(
    style.el.Button({
      key: "edit",
      label: "Edit with Claude",
      hotkey: "e",
      ...chrome(style),
      onPress: () => actions.edit(detail2)
    })
  );
  const targets = board2 && canWriteDetail ? moveTargets(board2, detail2.state) : [];
  const moves = targets.map(
    (target, index) => style.el.Button({
      key: moveKey(target),
      label: target,
      ...digitHotkey(index),
      ...chrome(style),
      onPress: () => actions.move(detail2.id, target)
    })
  );
  const moveSection = moves.length === 0 ? [] : [
    style.el.Box({
      flexDirection: "column",
      children: [
        caption(style, `Move to another state (now ${detail2.state}):`),
        style.el.Box({
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: style.isRich ? 1 : 2,
          rowGap: style.isRich ? 1 : 0,
          children: moves
        })
      ]
    })
  ];
  const body = style.isRich ? detail2.body : detail2.text;
  return [
    style.el.Box({
      flexDirection: "column",
      rowGap: style.isRich ? 1 : 0,
      marginTop: 1,
      children: [
        style.el.Box({ flexDirection: "row", flexWrap: "wrap", columnGap: 2, children: commands }),
        ...detailHeading(style, detail2),
        ...moveSection
      ]
    }),
    style.el.Box({
      flexDirection: "column",
      marginTop: 1,
      children: body ? [style.el.Markdown({ key: "task-markdown", text: body })] : [caption(style, "No description yet.")]
    })
  ];
}
function bodyOf(style, model, actions) {
  if (model.isMissingBoard) {
    return [
      style.el.Text({ children: ["No .tasks/ board in this folder."] }),
      caption(style, "Ask Claude to initialize TaskPlanner here, then run /taskboard again.")
    ];
  }
  if (model.draft && model.board && canWrite(model)) {
    return draftView(style, model.board, model.draft, actions);
  }
  if (model.detail) {
    return detailView(style, model.board, model.detail, canWrite(model), actions);
  }
  if (!model.board) return [caption(style, "Loading the board\u2026")];
  return listView(style, model, model.board, actions);
}
function draftView(style, board2, draft2, actions) {
  const states = newTaskStates(board2);
  return [
    style.el.Box({
      flexDirection: "column",
      rowGap: style.isRich ? 1 : 0,
      marginTop: 1,
      children: [
        style.el.Text({ ...textStyle(style, "heading"), children: ["New task"] }),
        style.el.Input({
          key: "new-title",
          label: "Title",
          placeholder: "What needs doing?",
          value: draft2.title,
          submitLabel: "create",
          autoFocus: true,
          onInput: actions.setDraftTitle,
          onSubmit: (value) => {
            actions.setDraftTitle(value);
            actions.create();
          }
        }),
        style.el.Select({
          key: "new-priority",
          label: "Priority",
          options: PRIORITIES.map((priority) => ({ value: priority, label: priority })),
          value: draft2.priority,
          onSelect: actions.setDraftPriority
        }),
        style.el.Select({
          key: "new-state",
          label: "State",
          options: states.map((state) => ({ value: state, label: state })),
          value: draft2.state,
          onSelect: actions.setDraftState
        }),
        caption(
          style,
          "The server assigns the ID. Add the description afterwards with Edit with Claude."
        ),
        style.el.Box({
          flexDirection: "row",
          columnGap: 2,
          children: [
            style.el.Button({
              key: "create-task",
              label: "Create",
              ...chrome(style),
              ...style.isRich ? { variant: "primary" } : {},
              onPress: actions.create
            }),
            style.el.Button({
              key: "cancel-new",
              label: "Cancel",
              ...chrome(style),
              onPress: actions.cancelNew
            })
          ]
        })
      ]
    })
  ];
}
function renderPane(el, model, actions) {
  const style = {
    el,
    isRich: model.surface === "desktop",
    hasTextScale: model.surface === "desktop" && model.hasTextScale
  };
  const children = [header(style, model, actions)];
  if (model.notice) children.push(caption(style, model.notice));
  if (model.error) children.push(errorBlock(style, model.error, actions));
  if (model.issueCount > 0) {
    children.push(
      caption(
        style,
        `${model.issueCount} part(s) of the board did not parse; ask Claude to check .tasks/.`
      )
    );
  }
  children.push(...bodyOf(style, model, actions));
  return el.Box({ flexDirection: "column", children });
}
function renderBand(el, task, columns, below, onOpen) {
  const label = truncate(
    `\u25B6 ${task.id} \xB7 ${task.title}`,
    Math.max(MIN_LABEL_WIDTH, columns - BAND_BUTTON_ROOM)
  );
  return el.Box({
    flexDirection: "column",
    children: [
      below,
      el.Box({
        flexDirection: "row",
        columnGap: 1,
        children: [
          el.Text({ dimColor: true, children: [label] }),
          el.Button({ key: "taskplanner-board", label: "Board", plain: true, onPress: onOpen })
        ]
      })
    ]
  });
}

// src/claude-mod/register.ts
var PANE_ID = "taskplanner";
var PANE_TITLE = "TaskPlanner";
var SERVER_KEY = "taskplanner";
var POLL_INTERVAL_MS = 5e3;
var MISSING_BOARD_TEXT = "No .tasks/ board in this folder.";
var serverName = null;
var board = null;
var taskIndex = /* @__PURE__ */ new Map();
var issueCount = 0;
var activeTab = null;
var detail = null;
var errorText = null;
var isLoading = false;
var isMissingBoard = false;
var lastSignature = null;
var pollTimer = null;
var isRefreshing = false;
var needsRefresh = false;
var hasTextScale = false;
var draft = null;
var notice = null;
async function connectServer($) {
  if (serverName) return serverName;
  const connection = await $.mcp.connect(SERVER_KEY);
  if (!connection.isConnected) throw new Error(connection.message);
  serverName = connection.server;
  return connection.server;
}
async function callTaskplanner($, tool, args) {
  const server = await connectServer($);
  const root = await $.session.root();
  return $.mcp.call(server, tool, { workspace_root: root, ...args });
}
async function boardExists($) {
  const root = await $.session.root();
  return $.fs.exists(joinPath(root, ".tasks", "config.json"));
}
async function readTextOrEmpty($, path) {
  try {
    return await $.fs.read(path);
  } catch {
    return "";
  }
}
async function readSignature($) {
  const root = await $.session.root();
  const tasksDir = joinPath(root, ".tasks");
  const entries = await $.fs.list(tasksDir);
  const files = [];
  for (const entry of entries) {
    if (entry.kind !== "file" || !BOARD_FILE_PATTERN.test(entry.name)) continue;
    const stat = await $.fs.stat(joinPath(tasksDir, entry.name));
    files.push({ name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  return boardSignature(files);
}
function forgetBoard() {
  board = null;
  taskIndex = /* @__PURE__ */ new Map();
  issueCount = 0;
  detail = null;
  lastSignature = null;
}
function detailFor(id) {
  const indexed = taskIndex.get(id);
  return indexed ? taskDetailOf(indexed) : null;
}
async function loadBoard($) {
  if (!await boardExists($)) {
    isMissingBoard = true;
    forgetBoard();
    return;
  }
  isMissingBoard = false;
  const root = await $.session.root();
  const tasksDir = joinPath(root, ".tasks");
  const signature = await readSignature($);
  const states = readConfigStates(await $.fs.read(joinPath(tasksDir, "config.json")));
  const texts = /* @__PURE__ */ new Map();
  for (const state of states) {
    texts.set(state.fileName, await readTextOrEmpty($, joinPath(tasksDir, state.fileName)));
  }
  const read = buildBoard(states, texts, isCompletedState(activeTab) || detail !== null, root);
  board = read.snapshot;
  taskIndex = read.tasks;
  issueCount = read.issueCount;
  activeTab = pickTab(board, activeTab);
  lastSignature = signature;
  if (detail) detail = detailFor(detail.id);
}
async function refreshBoard($) {
  if (isRefreshing) {
    needsRefresh = true;
    return;
  }
  isRefreshing = true;
  isLoading = true;
  $.ui.invalidate("ui.render");
  try {
    do {
      needsRefresh = false;
      try {
        await loadBoard($);
        errorText = null;
      } catch (error) {
        errorText = errorMessage(error);
      }
    } while (needsRefresh);
  } finally {
    isRefreshing = false;
    isLoading = false;
    $.ui.invalidate("ui.render");
  }
}
async function syncIfChanged($) {
  try {
    if (!await boardExists($)) {
      if (!isMissingBoard || board) {
        isMissingBoard = true;
        forgetBoard();
        $.ui.invalidate("ui.render");
      }
      return;
    }
    if (board && await readSignature($) === lastSignature) return;
  } catch (error) {
    errorText = errorMessage(error);
    $.ui.invalidate("ui.render");
    return;
  }
  await refreshBoard($);
}
function startPolling($) {
  if (pollTimer) return;
  pollTimer = $.clock.every(POLL_INTERVAL_MS, () => {
    void syncIfChanged($);
  });
}
function stopPolling() {
  pollTimer?.cancel();
  pollTimer = null;
}
async function openPane($) {
  await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true, closeOnEscape: true });
  startPolling($);
  await refreshBoard($);
}
async function resumeAfterLoad($) {
  const panes = await $.ui.panes();
  if (panes.some((pane) => pane.id === PANE_ID)) startPolling($);
  await syncIfChanged($);
}
async function selectTab($, state) {
  const needsCompleted = isCompletedState(state) && !isCompletedState(activeTab);
  activeTab = state;
  detail = null;
  $.ui.invalidate("ui.render");
  if (needsCompleted) await refreshBoard($);
}
function openTask($, id) {
  notice = null;
  detail = detailFor(id);
  errorText = detail ? null : `${id} is no longer on the board.`;
  $.ui.invalidate("ui.render");
}
async function moveTask($, id, target) {
  try {
    const result = await callTaskplanner($, "taskplanner_move", {
      task_id: id,
      target_state: target
    });
    if (result.isError) throw new Error(resultText(result));
  } catch (error) {
    errorText = errorMessage(error);
    $.ui.invalidate("ui.render");
    return;
  }
  await refreshBoard($);
}
async function createTask($) {
  if (!draft) return;
  const title = draft.title.trim();
  if (!title) {
    notice = "Give the task a title first.";
    $.ui.invalidate("ui.render");
    return;
  }
  const { priority, state } = draft;
  try {
    const result = await callTaskplanner($, "taskplanner_create", { title, priority, state });
    if (result.isError) throw new Error(resultText(result));
    const id = createdTaskId(result);
    draft = null;
    activeTab = state;
    notice = id ? `Created ${id} in ${state}.` : `Created the task in ${state}.`;
    await refreshBoard($);
    if (id) detail = detailFor(id);
  } catch (error) {
    errorText = errorMessage(error);
  }
  $.ui.invalidate("ui.render");
}
async function editTask($, task) {
  const text = editPrompt(task);
  const filled = await $.prompt.fill({ text });
  notice = filled.isFilled ? "Describe the change in the prompt below and press Enter." : `Ask Claude: "${text}\u2026"`;
  $.ui.invalidate("ui.render");
}
async function boardDigest($) {
  await refreshBoard($);
  if (isMissingBoard) return MISSING_BOARD_TEXT;
  if (!board) return `TaskPlanner: ${errorText ?? "the board could not be read."}`;
  return boardDigestText(board);
}
function paneApproval(origin, tool) {
  return isPaneWriteByOwnPlugin(origin, tool) ? { decision: "allow", reason: "Requested from the TaskPlanner board pane." } : null;
}
async function runBoardCommand($) {
  const surfaces = await $.session.surfaces();
  if (surfaces.length === 0) return { text: await boardDigest($) };
  await openPane($);
  return {};
}
function register(on) {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "taskboard",
      description: "Open the TaskPlanner board pane",
      immediate: true
    }).catch((error) => {
      errorText = errorMessage(error);
    });
    hasTextScale = await $.session.version().then(({ version }) => supportsTextScale(version)).catch(() => false);
    $.clock.after(0, () => {
      void resumeAfterLoad($);
    });
    return next(e);
  });
  on("command.run", { command: "taskboard" }, ($) => runBoardCommand($));
  on("command.run", { command: "taskplanner:board" }, ($) => runBoardCommand($)).catch(
    (_engine, e, next) => next(e)
  );
  on("ui.render", { component: "Pane", requestId: "taskplanner" }, async ($, e) => {
    const elements = $.ui.resolve(e);
    return renderPane(
      elements,
      {
        board,
        tab: activeTab,
        detail,
        draft,
        notice,
        error: errorText,
        issueCount,
        isLoading,
        isMissingBoard,
        columns: e.props.bodyColumns,
        surface: e.surface,
        hasTextScale
      },
      {
        selectTab: (state) => {
          notice = null;
          void selectTab($, state);
        },
        openTask: (id) => openTask($, id),
        back: () => {
          detail = null;
          notice = null;
          $.ui.invalidate("ui.render");
        },
        move: (id, target) => {
          void moveTask($, id, target);
        },
        start: (task) => {
          void $.prompt.submit({ text: startPrompt(task), asUser: true });
        },
        refresh: () => {
          void refreshBoard($);
        },
        edit: (task) => {
          void editTask($, task);
        },
        newTask: () => {
          draft = startDraft(board, activeTab);
          detail = null;
          notice = null;
          $.ui.invalidate("ui.render");
        },
        cancelNew: () => {
          draft = null;
          $.ui.invalidate("ui.render");
        },
        setDraftTitle: (title) => {
          if (draft) draft = { ...draft, title };
        },
        setDraftPriority: (priority) => {
          if (draft) draft = { ...draft, priority };
          $.ui.invalidate("ui.render");
        },
        setDraftState: (state) => {
          if (draft) draft = { ...draft, state };
          $.ui.invalidate("ui.render");
        },
        create: () => {
          void createTask($);
        }
      }
    );
  });
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const task = e.props.hasSurvey ? null : inProgressTask(board);
    if (!task) return next(e);
    const elements = $.ui.resolve(e);
    const below = await next(e);
    return renderBand(elements, task, e.props.bodyColumns, below, () => {
      void openPane($);
    });
  });
  on("ui.press", async ($, e, next) => {
    if (!isOwnPlugin(e.plugin)) return next(e);
    if (e.element === "create-task" && draft) {
      await createTask($);
      return { element: e.element };
    }
    const target = board && detail ? moveTargetForKey(board, detail.state, e.element) : null;
    if (!target || !detail) return next(e);
    await moveTask($, detail.id, target);
    return { element: e.element };
  }).catch((_engine, e, next) => next(e));
  on("ui.input", async ($, e, next) => {
    if (!isOwnPlugin(e.plugin) || e.element !== "new-title" || e.kind !== "submit" || !draft) {
      return next(e);
    }
    draft = { ...draft, title: e.value };
    await createTask($);
    return { element: e.element, value: e.value };
  }).catch((_engine, e, next) => next(e));
  on(
    "tool.check",
    async (_engine, e, next) => paneApproval(next.origin.plugin, e.tool) ?? next(e)
  ).catch((_engine, e, next) => next(e));
  on("tool.call", async ($, e, next) => {
    const result = await next(e);
    if (shouldRefreshAfterTool(e.tool, e)) {
      $.clock.after(0, () => {
        void refreshBoard($);
      });
    }
    return result;
  }).catch((_engine, e, next) => next(e));
  on("ui.close", async (_engine, e, next) => {
    const result = await next(e);
    if (e.id === PANE_ID) {
      detail = null;
      stopPolling();
    }
    return result;
  }).catch((_engine, e, next) => next(e));
  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    $.clock.after(0, () => {
      void syncIfChanged($);
    });
    return result;
  }).catch((_engine, e, next) => next(e));
}
export {
  register
};
