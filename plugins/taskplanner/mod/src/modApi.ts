export interface ElementNode {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children?: readonly unknown[];
}

export type ChildNode = ElementNode | string;

export interface BoxProps {
  key?: string;
  flexDirection?: 'row' | 'column';
  flexWrap?: 'nowrap' | 'wrap';
  columnGap?: number;
  rowGap?: number;
  marginTop?: number;
  paddingX?: number;
  borderStyle?: 'round' | 'single';
  children: ChildNode[];
}

export interface TextProps {
  bold?: boolean;
  dimColor?: boolean;
  color?: string;
  wrap?: 'wrap' | 'truncate-end';
  size?: 'caption' | 'footnote' | 'body' | 'heading' | 'title';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  mono?: boolean;
  children: string[];
}

export interface ButtonProps {
  key: string;
  label: string;
  hotkey?: string;
  plain?: true;
  dimColor?: boolean;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
}

export interface MarkdownProps {
  key?: string;
  text: string;
}

export interface InputProps {
  key: string;
  label?: string;
  placeholder?: string;
  value?: string;
  submitLabel?: string;
  autoFocus?: true;
  onInput?: (value: string) => void;
  onSubmit: (value: string) => void;
}

export interface SelectProps {
  key: string;
  label?: string;
  options: readonly { value: string; label: string }[];
  value?: string;
  onSelect: (value: string) => void;
}

export interface Elements {
  Box: (props: BoxProps) => ElementNode;
  Text: (props: TextProps) => ElementNode;
  Button: (props: ButtonProps) => ElementNode;
  Markdown: (props: MarkdownProps) => ElementNode;
  Input: (props: InputProps) => ElementNode;
  Select: (props: SelectProps) => ElementNode;
}

export interface McpContentBlock {
  type: string;
  text?: string;
}

export interface McpToolResult {
  content: McpContentBlock[];
  isError: boolean;
  structuredContent?: unknown;
}

export type McpConnectResult =
  { isConnected: true; server: string } | { isConnected: false; reason: string; message: string };

export interface FsEntry {
  name: string;
  kind: 'file' | 'dir' | 'other';
  size: number;
}

export interface FsStat {
  kind: 'file' | 'dir' | 'other';
  size: number;
  mtimeMs: number;
}

export interface Timer {
  cancel: () => void;
}

export interface PaneRenderProps {
  bodyColumns: number;
}

export interface AbovePromptRenderProps {
  bodyColumns: number;
  hasSurvey: boolean;
}

export interface RenderEvent<P> {
  surface: string;
  component: string;
  requestId: string;
  props: P;
}

export interface CommandRunEvent {
  command: string;
  args: string;
}

export interface CommandRunResult {
  text?: string;
}

export interface ToolCallEvent {
  tool: string;
  [argument: string]: unknown;
}

export interface PaneCloseEvent {
  id: string;
}

export interface UiPressEvent {
  plugin: string;
  element: string;
  component: string;
  surface: string;
}

export interface UiPressResult {
  element: string;
}

export interface UiInputEvent {
  plugin: string;
  element: string;
  kind: 'change' | 'submit';
  value: string;
}

export interface UiInputResult {
  element: string;
  value: string;
}

export interface Engine {
  ui: {
    resolve: (e: RenderEvent<unknown>) => Elements;
    invalidate: (event: 'ui.render') => void;
    open: (pane: {
      id: string;
      title?: string;
      focus?: true;
      closeOnEscape?: true;
    }) => Promise<{ isPlaced: boolean }>;
    panes: () => Promise<readonly { id: string }[]>;
  };
  mcp: {
    call: (server: string, tool: string, args?: Record<string, unknown>) => Promise<McpToolResult>;
    connect: (server: string) => Promise<McpConnectResult>;
  };
  fs: {
    read: (path: string) => Promise<string>;
    exists: (path: string) => Promise<boolean>;
    list: (path?: string) => Promise<FsEntry[]>;
    stat: (path: string) => Promise<FsStat>;
  };
  clock: {
    after: (ms: number, fn: () => void) => Timer;
    every: (ms: number, fn: () => void) => Timer;
  };
  session: {
    root: () => Promise<string>;
    surfaces: () => Promise<readonly string[]>;
    version: () => Promise<{ version: string }>;
  };
  command: {
    register: (spec: { name: string; description: string; immediate?: true }) => Promise<void>;
  };
  prompt: {
    submit: (input: { text: string; asUser?: true }) => Promise<unknown>;
    fill: (input: { text: string; mode?: 'replace' | 'append' | 'insert' }) => Promise<{
      isFilled: boolean;
    }>;
  };
}

export interface ToolCheckEvent {
  tool: string;
  input: unknown;
}

export interface ToolCheckResult {
  decision: 'allow' | 'ask' | 'deny';
  reason?: string;
}

export type Next<E, R> = ((e: E) => Promise<R>) & {
  origin: { plugin: string; tier: string };
  error?: { kind: 'throw' | 'timeout' | 're-entry' };
};

export type Hook<E, R> = ($: Engine, e: E, next: Next<E, R>) => R | Promise<R>;

export interface Registration<E, R> {
  catch: (handler: Hook<E, R>) => void;
}

export interface On {
  (event: 'session.start', hook: Hook<unknown, unknown>): Registration<unknown, unknown>;
  (
    event: 'command.run',
    matcher: { command: string },
    hook: Hook<CommandRunEvent, CommandRunResult>,
  ): Registration<CommandRunEvent, CommandRunResult>;
  (
    event: 'ui.render',
    matcher: { component: 'Pane'; requestId: string },
    hook: Hook<RenderEvent<PaneRenderProps>, ElementNode>,
  ): Registration<RenderEvent<PaneRenderProps>, ElementNode>;
  (
    event: 'ui.render',
    matcher: { component: 'AbovePrompt' },
    hook: Hook<RenderEvent<AbovePromptRenderProps>, ElementNode>,
  ): Registration<RenderEvent<AbovePromptRenderProps>, ElementNode>;
  (event: 'tool.call', hook: Hook<ToolCallEvent, unknown>): Registration<ToolCallEvent, unknown>;
  (
    event: 'tool.check',
    hook: Hook<ToolCheckEvent, ToolCheckResult>,
  ): Registration<ToolCheckEvent, ToolCheckResult>;
  (event: 'ui.close', hook: Hook<PaneCloseEvent, unknown>): Registration<PaneCloseEvent, unknown>;
  (
    event: 'ui.press',
    hook: Hook<UiPressEvent, UiPressResult>,
  ): Registration<UiPressEvent, UiPressResult>;
  (
    event: 'ui.input',
    hook: Hook<UiInputEvent, UiInputResult>,
  ): Registration<UiInputEvent, UiInputResult>;
  (event: 'turn.complete', hook: Hook<unknown, unknown>): Registration<unknown, unknown>;
}
