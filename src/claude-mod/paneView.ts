import type { TaskViewItem } from '../core/model/messages.js';
import type { ChildNode, ElementNode, Elements, TextProps } from './modApi.js';
import {
  BoardSnapshot,
  PRIORITIES,
  TaskDetail,
  TaskDraft,
  describeError,
  isCompletedState,
  moveKey,
  moveTargets,
  newTaskStates,
  slug,
  stateNamed,
  truncate,
} from './boardModel.js';

export { slug } from './boardModel.js';

export interface PaneModel {
  board: BoardSnapshot | null;
  tab: string | null;
  detail: TaskDetail | null;
  draft: TaskDraft | null;
  notice: string | null;
  error: string | null;
  issueCount: number;
  isLoading: boolean;
  isMissingBoard: boolean;
  columns: number;
  surface: string;
  hasTextScale: boolean;
}

export interface PaneActions {
  selectTab: (state: string) => void;
  openTask: (id: string) => void;
  back: () => void;
  move: (id: string, target: string) => void;
  start: (task: TaskDetail) => void;
  edit: (task: TaskDetail) => void;
  refresh: () => void;
  newTask: () => void;
  cancelNew: () => void;
  setDraftTitle: (title: string) => void;
  setDraftPriority: (priority: string) => void;
  setDraftState: (state: string) => void;
  create: () => void;
}

const MAX_DIGIT_HOTKEYS = 9;
const MIN_LABEL_WIDTH = 12;
const BAND_BUTTON_ROOM = 8;
const PRIORITY_COLORS: Record<string, string> = {
  P0: 'error',
  P1: 'warning',
  P2: 'suggestion',
  P3: 'subtle',
  P4: 'inactive',
};

interface Style {
  el: Elements;
  isRich: boolean;
  hasTextScale: boolean;
}

type TextRole = 'title' | 'heading' | 'caption' | 'chip' | 'id';

function textStyle(style: Style, role: TextRole): Omit<TextProps, 'children'> {
  if (!style.hasTextScale) {
    if (role === 'title' || role === 'heading' || role === 'chip') return { bold: true };
    return { dimColor: true };
  }
  switch (role) {
    case 'title':
      return { size: 'title', weight: 'semibold' };
    case 'heading':
      return { size: 'heading', weight: 'semibold' };
    case 'chip':
      return { size: 'caption', weight: 'semibold' };
    case 'id':
      return { size: 'caption', mono: true, dimColor: true };
    default:
      return { size: 'caption', dimColor: true };
  }
}

function digitHotkey(index: number): { hotkey?: string } {
  return index < MAX_DIGIT_HOTKEYS ? { hotkey: String(index + 1) } : {};
}

function chrome(style: Style): { plain?: true } {
  return style.isRich ? {} : { plain: true };
}

function priorityChip(style: Style, priority: string): ElementNode {
  return style.el.Text({
    ...textStyle(style, 'chip'),
    color: PRIORITY_COLORS[priority] ?? 'subtle',
    children: [priority],
  });
}

function caption(style: Style, text: string): ElementNode {
  return style.el.Text({ ...textStyle(style, 'caption'), wrap: 'wrap', children: [text] });
}

function countsLine(board: BoardSnapshot): string {
  return board.states.map((state) => `${state.totalCount} ${state.name.toLowerCase()}`).join(' · ');
}

function canWrite(model: PaneModel): boolean {
  return model.surface !== 'mobile' && model.board !== null && !model.isMissingBoard;
}

function headerButtons(style: Style, model: PaneModel, actions: PaneActions): ElementNode[] {
  const buttons = [
    style.el.Button({
      key: 'refresh',
      label: 'Refresh',
      hotkey: 'r',
      plain: true,
      onPress: actions.refresh,
    }),
  ];
  if (canWrite(model) && !model.draft) {
    buttons.unshift(
      style.el.Button({
        key: 'new-task',
        label: style.isRich ? '+ New task' : 'New task',
        hotkey: 'n',
        plain: true,
        onPress: actions.newTask,
      }),
    );
  }
  return buttons;
}

function header(style: Style, model: PaneModel, actions: PaneActions): ElementNode {
  const buttons = headerButtons(style, model, actions);
  if (!style.isRich) {
    const status = model.isLoading ? ' · loading…' : '';
    return style.el.Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [style.el.Text({ bold: true, children: [`TaskPlanner${status}`] }), ...buttons],
    });
  }
  const summary = model.isLoading
    ? 'Refreshing…'
    : model.board
      ? countsLine(model.board)
      : 'Markdown tasks in .tasks/';
  return style.el.Box({
    flexDirection: 'column',
    children: [
      style.el.Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          style.el.Text({ ...textStyle(style, 'title'), children: ['TaskPlanner'] }),
          ...buttons,
        ],
      }),
      caption(style, summary),
    ],
  });
}

function errorBlock(style: Style, message: string, actions: PaneActions): ElementNode {
  const summary = describeError(message);
  return style.el.Box({
    flexDirection: 'column',
    marginTop: 1,
    children: [
      style.el.Text({ color: 'error', bold: true, children: [summary.title] }),
      caption(style, summary.detail),
      style.el.Button({ key: 'retry', label: 'Retry', ...chrome(style), onPress: actions.refresh }),
    ],
  });
}

function tabs(
  style: Style,
  board: BoardSnapshot,
  active: string | null,
  actions: PaneActions,
): ElementNode {
  return style.el.Box({
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: style.isRich ? 1 : 2,
    rowGap: style.isRich ? 1 : 0,
    marginTop: 1,
    children: board.states.map((state, index) =>
      style.el.Button({
        key: `tab-${slug(state.name)}`,
        label: `${state.name} ${state.totalCount}`,
        ...digitHotkey(index),
        ...chrome(style),
        ...(style.isRich ? { variant: state.name === active ? 'primary' : 'secondary' } : {}),
        dimColor: state.name !== active,
        onPress: () => actions.selectTab(state.name),
      }),
    ),
  });
}

function plainRow(
  style: Style,
  task: TaskViewItem,
  columns: number,
  actions: PaneActions,
): ElementNode {
  const label = `${task.id} ${task.priority} ${task.title}`;
  return style.el.Button({
    key: `task-${task.id}`,
    label: truncate(label, Math.max(MIN_LABEL_WIDTH, columns)),
    plain: true,
    onPress: () => actions.openTask(task.id),
  });
}

function card(style: Style, task: TaskViewItem, actions: PaneActions): ElementNode {
  const meta: ChildNode[] = [
    style.el.Text({ ...textStyle(style, 'id'), children: [task.id] }),
    priorityChip(style, task.priority),
  ];
  if (task.tags.length > 0) meta.push(caption(style, task.tags.join(', ')));
  if (task.assignee) meta.push(caption(style, `@${task.assignee}`));
  return style.el.Box({
    key: `card-${task.id}`,
    flexDirection: 'column',
    borderStyle: 'round',
    paddingX: 1,
    children: [
      style.el.Box({ flexDirection: 'row', columnGap: 1, children: meta }),
      style.el.Button({
        key: `task-${task.id}`,
        label: task.title,
        plain: true,
        onPress: () => actions.openTask(task.id),
      }),
    ],
  });
}

function listView(
  style: Style,
  model: PaneModel,
  board: BoardSnapshot,
  actions: PaneActions,
): ChildNode[] {
  const state = stateNamed(board, model.tab);
  const rows: ChildNode[] = [];
  if (!state) {
    rows.push(caption(style, 'This board has no states.'));
  } else if (state.tasks.length === 0) {
    rows.push(caption(style, `No tasks in ${state.name}.`));
  } else {
    rows.push(
      ...state.tasks.map((task) =>
        style.isRich ? card(style, task, actions) : plainRow(style, task, model.columns, actions),
      ),
    );
    if (state.hasMore) {
      rows.push(caption(style, `+${state.totalCount - state.tasks.length} more`));
    }
  }
  return [
    tabs(style, board, model.tab, actions),
    style.el.Box({
      flexDirection: 'column',
      rowGap: style.isRich ? 1 : 0,
      marginTop: 1,
      children: rows,
    }),
  ];
}

function detailHeading(style: Style, detail: TaskDetail): ChildNode[] {
  if (!style.isRich) return [];
  const chips: ChildNode[] = [
    style.el.Text({ ...textStyle(style, 'id'), children: [detail.id] }),
    priorityChip(style, detail.priority),
    caption(style, detail.state),
  ];
  if (detail.tags.length > 0) chips.push(caption(style, detail.tags.join(', ')));
  return [
    style.el.Text({ ...textStyle(style, 'heading'), wrap: 'wrap', children: [detail.title] }),
    style.el.Box({ flexDirection: 'row', columnGap: 1, children: chips }),
  ];
}

function detailView(
  style: Style,
  board: BoardSnapshot | null,
  detail: TaskDetail,
  canWriteDetail: boolean,
  actions: PaneActions,
): ChildNode[] {
  const commands: ChildNode[] = [
    style.el.Button({
      key: 'back',
      label: 'Back',
      hotkey: 'b',
      plain: true,
      onPress: actions.back,
    }),
  ];
  if (!isCompletedState(detail.state)) {
    commands.push(
      style.el.Button({
        key: 'start',
        label: 'Start with Claude',
        hotkey: 's',
        ...chrome(style),
        ...(style.isRich ? { variant: 'primary' as const } : {}),
        onPress: () => actions.start(detail),
      }),
    );
  }
  commands.push(
    style.el.Button({
      key: 'edit',
      label: 'Edit with Claude',
      hotkey: 'e',
      ...chrome(style),
      onPress: () => actions.edit(detail),
    }),
  );
  const targets = board && canWriteDetail ? moveTargets(board, detail.state) : [];
  const moves = targets.map((target, index) =>
    style.el.Button({
      key: moveKey(target),
      label: target,
      ...digitHotkey(index),
      ...chrome(style),
      onPress: () => actions.move(detail.id, target),
    }),
  );
  const moveSection: ChildNode[] =
    moves.length === 0
      ? []
      : [
          style.el.Box({
            flexDirection: 'column',
            children: [
              caption(style, `Move to another state (now ${detail.state}):`),
              style.el.Box({
                flexDirection: 'row',
                flexWrap: 'wrap',
                columnGap: style.isRich ? 1 : 2,
                rowGap: style.isRich ? 1 : 0,
                children: moves,
              }),
            ],
          }),
        ];
  const body = style.isRich ? detail.body : detail.text;
  return [
    style.el.Box({
      flexDirection: 'column',
      rowGap: style.isRich ? 1 : 0,
      marginTop: 1,
      children: [
        style.el.Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: commands }),
        ...detailHeading(style, detail),
        ...moveSection,
      ],
    }),
    style.el.Box({
      flexDirection: 'column',
      marginTop: 1,
      children: body
        ? [style.el.Markdown({ key: 'task-markdown', text: body })]
        : [caption(style, 'No description yet.')],
    }),
  ];
}

function bodyOf(style: Style, model: PaneModel, actions: PaneActions): ChildNode[] {
  if (model.isMissingBoard) {
    return [
      style.el.Text({ children: ['No .tasks/ board in this folder.'] }),
      caption(style, 'Ask Claude to initialize TaskPlanner here, then run /taskboard again.'),
    ];
  }
  if (model.draft && model.board && canWrite(model)) {
    return draftView(style, model.board, model.draft, actions);
  }
  if (model.detail) {
    return detailView(style, model.board, model.detail, canWrite(model), actions);
  }
  if (!model.board) return [caption(style, 'Loading the board…')];
  return listView(style, model, model.board, actions);
}

function draftView(
  style: Style,
  board: BoardSnapshot,
  draft: TaskDraft,
  actions: PaneActions,
): ChildNode[] {
  const states = newTaskStates(board);
  return [
    style.el.Box({
      flexDirection: 'column',
      rowGap: style.isRich ? 1 : 0,
      marginTop: 1,
      children: [
        style.el.Text({ ...textStyle(style, 'heading'), children: ['New task'] }),
        style.el.Input({
          key: 'new-title',
          label: 'Title',
          placeholder: 'What needs doing?',
          value: draft.title,
          submitLabel: 'create',
          autoFocus: true,
          onInput: actions.setDraftTitle,
          onSubmit: (value) => {
            actions.setDraftTitle(value);
            actions.create();
          },
        }),
        style.el.Select({
          key: 'new-priority',
          label: 'Priority',
          options: PRIORITIES.map((priority) => ({ value: priority, label: priority })),
          value: draft.priority,
          onSelect: actions.setDraftPriority,
        }),
        style.el.Select({
          key: 'new-state',
          label: 'State',
          options: states.map((state) => ({ value: state, label: state })),
          value: draft.state,
          onSelect: actions.setDraftState,
        }),
        caption(
          style,
          'The server assigns the ID. Add the description afterwards with Edit with Claude.',
        ),
        style.el.Box({
          flexDirection: 'row',
          columnGap: 2,
          children: [
            style.el.Button({
              key: 'create-task',
              label: 'Create',
              ...chrome(style),
              ...(style.isRich ? { variant: 'primary' as const } : {}),
              onPress: actions.create,
            }),
            style.el.Button({
              key: 'cancel-new',
              label: 'Cancel',
              ...chrome(style),
              onPress: actions.cancelNew,
            }),
          ],
        }),
      ],
    }),
  ];
}

export function renderPane(el: Elements, model: PaneModel, actions: PaneActions): ElementNode {
  const style: Style = {
    el,
    isRich: model.surface === 'desktop',
    hasTextScale: model.surface === 'desktop' && model.hasTextScale,
  };
  const children: ChildNode[] = [header(style, model, actions)];
  if (model.notice) children.push(caption(style, model.notice));
  if (model.error) children.push(errorBlock(style, model.error, actions));
  if (model.issueCount > 0) {
    children.push(
      caption(
        style,
        `${model.issueCount} part(s) of the board did not parse; ask Claude to check .tasks/.`,
      ),
    );
  }
  children.push(...bodyOf(style, model, actions));
  return el.Box({ flexDirection: 'column', children });
}

export function renderBand(
  el: Elements,
  task: TaskViewItem,
  columns: number,
  below: ElementNode,
  onOpen: () => void,
): ElementNode {
  const label = truncate(
    `▶ ${task.id} · ${task.title}`,
    Math.max(MIN_LABEL_WIDTH, columns - BAND_BUTTON_ROOM),
  );
  return el.Box({
    flexDirection: 'column',
    children: [
      below,
      el.Box({
        flexDirection: 'row',
        columnGap: 1,
        children: [
          el.Text({ dimColor: true, children: [label] }),
          el.Button({ key: 'taskplanner-board', label: 'Board', plain: true, onPress: onOpen }),
        ],
      }),
    ],
  });
}
