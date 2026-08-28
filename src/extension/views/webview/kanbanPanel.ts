import * as vscode from 'vscode';
import * as path from 'path';
import { TaskStore } from '../../../core/store/taskStore.js';
import { ConfigManager } from '../../../core/config/configManager.js';
import { TaskListSortBy } from '../../../core/filter/taskFilter.js';
import { buildBoardViewModel } from '../../../core/view/boardViewModel.js';
import { TaskViewData, StateViewData, TaskViewItem } from '../../../core/model/messages.js';
import { getWebviewHtml } from './webviewHelper.js';
import { getSortBy, setSortBy } from '../../config/extensionConfig.js';

export class KanbanPanel {
  private static instance: KanbanPanel | undefined;
  private panel: vscode.WebviewPanel;
  private showAllForState: Set<string> = new Set();
  private sortBy: TaskListSortBy = 'priority';
  private searchQuery: string = '';
  private storeDisposable: { dispose: () => void };
  private parseWarningsDismissed = false;
  private parseWarningsKey = '';

  private constructor(
    private taskStore: TaskStore,
    private configManager: ConfigManager,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'taskplanner.kanban',
      'Tasks: Kanban Board',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false },
    );

    this.panel.iconPath = new vscode.ThemeIcon('project');

    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.panel.onDidDispose(() => this.dispose());
    this.panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.update();
      }
    });

    this.storeDisposable = this.taskStore.onDidChange(() => {
      if (this.panel.visible) {
        this.update();
      }
    });

    this.syncSortFromSettings();
    this.update();
  }

  static createOrShow(taskStore: TaskStore, configManager: ConfigManager): void {
    if (KanbanPanel.instance) {
      KanbanPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    KanbanPanel.instance = new KanbanPanel(taskStore, configManager);
  }

  public static refreshIfOpen(): void {
    if (!KanbanPanel.instance) return;
    KanbanPanel.instance.syncSortFromSettings();
    if (KanbanPanel.instance.panel.visible) {
      KanbanPanel.instance.update();
    }
  }

  private syncSortFromSettings(): void {
    this.sortBy = getSortBy();
  }

  private syncParseWarningDismissState(): void {
    const key = JSON.stringify(this.taskStore.getWarnings());
    if (key !== this.parseWarningsKey) {
      this.parseWarningsKey = key;
      this.parseWarningsDismissed = false;
    }
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case 'ready':
        this.update();
        break;
      case 'showAll':
        if (msg.stateName) {
          this.showAllForState.add(msg.stateName as string);
        }
        this.update();
        break;
      case 'showCompleted':
        this.taskStore.ensureStateLoaded('Done');
        this.taskStore.ensureStateLoaded('Rejected');
        this.showAllForState.add('Done');
        this.showAllForState.add('Rejected');
        this.update();
        break;
      case 'moveTask':
        this.taskStore.moveTask(msg.taskId as string, msg.targetState as string);
        break;
      case 'openTask':
        vscode.commands.executeCommand('taskplanner.viewTask', msg.taskId as string);
        break;
      case 'addTask':
        vscode.commands.executeCommand('taskplanner.createTaskInState', msg.stateName as string);
        break;
      case 'sortBy':
        {
          const nextSortBy = msg.sortBy as TaskListSortBy;
          if (nextSortBy !== this.sortBy) {
            this.sortBy = nextSortBy;
            void setSortBy(nextSortBy);
          }
          this.update();
        }
        break;
      case 'search':
        this.searchQuery = (msg.query as string) ?? '';
        this.update();
        break;
      case 'implementWithAi':
        vscode.commands.executeCommand('taskplanner.implementWithAi', msg.taskId as string);
        break;
      case 'openParseWarningFile': {
        const fileName = msg.fileName as string;
        const line = typeof msg.line === 'number' ? msg.line : 1;
        const dir = this.configManager.getTasksDir();
        const uri = vscode.Uri.file(path.join(dir, fileName));
        void vscode.workspace.openTextDocument(uri).then((doc) => {
          void vscode.window.showTextDocument(doc, {
            selection: new vscode.Range(line - 1, 0, line - 1, 0),
          });
        });
        break;
      }
      case 'dismissParseWarnings':
        this.parseWarningsDismissed = true;
        this.update();
        break;
    }
  }

  private update(): void {
    this.syncParseWarningDismissState();
    const data = buildBoardViewModel(this.taskStore, this.configManager, {
      searchQuery: this.searchQuery,
      sortBy: this.sortBy,
    });

    if (this.showAllForState.size > 0) {
      const unlimitedData = buildBoardViewModel(this.taskStore, this.configManager, {
        searchQuery: this.searchQuery,
        sortBy: this.sortBy,
        limit: null,
      });
      for (const state of data.states) {
        if (this.showAllForState.has(state.name)) {
          const full = unlimitedData.states.find((s) => s.name === state.name);
          if (full) {
            state.tasks = full.tasks;
            state.hasMore = false;
          }
        }
      }
    }

    this.panel.webview.html = this.buildHtml(data);
  }

  private buildParseWarningBanner(): string {
    if (this.parseWarningsDismissed) {
      return '';
    }
    const grouped = this.taskStore.getWarnings();
    if (grouped.length === 0) {
      return '';
    }

    const rows = grouped
      .map(({ fileName, warnings }) => {
        const first = warnings[0];
        const summary =
          warnings.length === 1
            ? `Line ${first.line}: ${this.escapeHtml(first.message)}`
            : `${warnings.length} issues (first at line ${first.line})`;
        return `
      <div class="parse-warning-row">
        <span class="parse-warning-file">${this.escapeHtml(fileName)}</span>
        <span class="parse-warning-msg">${summary}</span>
        <button type="button" class="parse-warning-open" data-action="openParseWarningFile" data-file-name="${this.escapeAttr(fileName)}" data-line="${first.line}">Open</button>
      </div>`;
      })
      .join('');

    return `
      <div class="parse-warning-banner" role="alert">
        <div class="parse-warning-title">Some task markdown could not be parsed</div>
        ${rows}
        <button type="button" class="parse-warning-dismiss" data-action="dismissParseWarnings">Dismiss</button>
      </div>`;
  }

  private buildHtml(data: TaskViewData): string {
    const stateMap = new Map(data.states.map((s) => [s.name, s]));
    const nextState = stateMap.get('Next');
    const backlogState = stateMap.get('Backlog');
    const inProgressState = stateMap.get('In Progress');
    const doneState = stateMap.get('Done');
    const rejectedState = stateMap.get('Rejected');

    const knownNames = new Set(['Next', 'Backlog', 'In Progress', 'Done', 'Rejected']);
    const customStates = data.states.filter((s) => !knownNames.has(s.name));

    let columns = '';
    if (backlogState) {
      columns += this.buildStandardColumn(backlogState, 'backlog');
    }
    if (nextState || inProgressState) {
      columns += this.buildActiveColumn(nextState, inProgressState);
    }
    for (const cs of customStates) {
      const key = `state-${cs.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      columns += this.buildStandardColumn(cs, key);
    }
    if (doneState || rejectedState) {
      columns += this.buildCompletedColumn(doneState, rejectedState);
    }

    const sortByItems = [
      { value: 'priority', label: 'Priority' },
      { value: 'name', label: 'Name' },
      { value: 'id', label: 'ID' },
      { value: 'file', label: 'File order' },
    ]
      .map(
        (o) =>
          `<div class="popup-item${this.sortBy === o.value ? ' active' : ''}" data-action="setSortBy" data-value="${o.value}">${o.label}</div>`,
      )
      .join('\n');

    const body = `
      <h1>Kanban Board</h1>
      ${this.buildParseWarningBanner()}
      <div class="kanban-toolbar">
        <input type="text" id="queryFilter" placeholder="Search..." value="${this.escapeAttr(this.searchQuery)}" />
        <div class="icon-btn-wrap">
          <button class="icon-btn${this.sortBy !== 'priority' ? ' icon-btn-active' : ''}" id="sortByBtn" title="Sort by: ${this.sortBy}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1l3 4H4v6h2l-3 4-3-4h2V5H0l3-4zm6 1h7v2H9V2zm0 4h5v2H9V6zm0 4h3v2H9v-2z"/></svg>
          </button>
          <div class="popup-menu" id="sortByMenu">
            <div class="popup-label">Sort by</div>
            ${sortByItems}
          </div>
        </div>
      </div>
      <div class="kanban-board">${columns}</div>
    `;

    const script = `
      const NARROW_BREAKPOINT = 900;
      const COLLAPSE_STORAGE_KEY = 'taskplanner.kanban.collapsedColumns.v1';
      const boardEl = document.querySelector('.kanban-board');

      function loadCollapsedColumns() {
        try {
          const raw = sessionStorage.getItem(COLLAPSE_STORAGE_KEY);
          if (!raw) return new Set();
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return new Set();
          return new Set(parsed.filter(v => typeof v === 'string'));
        } catch {
          return new Set();
        }
      }

      function saveCollapsedColumns(set) {
        try {
          sessionStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(set)));
        } catch {
          // ignore storage failures
        }
      }

      let collapsedColumns = loadCollapsedColumns();

      function applyColumnCollapseState() {
        const columns = Array.from(document.querySelectorAll('.kanban-column[data-column-key]'));
        columns.forEach((col) => {
          const key = col.dataset.columnKey;
          const isCollapsed = key ? collapsedColumns.has(key) : false;
          col.classList.toggle('collapsed', isCollapsed);
          const indicator = col.querySelector('.column-collapse-indicator');
          if (indicator) {
            const label = indicator.dataset.columnTitle || '';
            const count = indicator.dataset.columnCount || '0';
            indicator.innerHTML = '<span class="column-collapse-chevron' + (isCollapsed ? ' collapsed' : '') + '">▾</span><span class="column-collapse-label">' + label + ' <span class="column-collapse-count">(' + count + ')</span></span>';
            indicator.setAttribute('aria-expanded', String(!isCollapsed));
          }
        });
      }

      function applyCompactLayout() {
        if (!boardEl) return;
        const isCompact = window.innerWidth <= NARROW_BREAKPOINT;
        boardEl.classList.toggle('compact', isCompact);
        if (!isCompact) {
          document.querySelectorAll('.kanban-column').forEach((col) => col.classList.remove('collapsed'));
          return;
        }

        if (collapsedColumns.size === 0) {
          const columns = Array.from(document.querySelectorAll('.kanban-column[data-column-key]'));
          columns.forEach((col) => {
            const key = col.dataset.columnKey;
            if (key && key !== 'active') {
              collapsedColumns.add(key);
            }
          });
          saveCollapsedColumns(collapsedColumns);
        }
        applyColumnCollapseState();
      }

      applyCompactLayout();

      // Search with debounce
      const queryEl = document.getElementById('queryFilter');
      let searchTimer;
      queryEl.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          vscode.postMessage({ type: 'search', query: queryEl.value });
        }, 200);
      });
      if (queryEl.value) {
        requestAnimationFrame(() => {
          queryEl.focus();
          queryEl.setSelectionRange(queryEl.value.length, queryEl.value.length);
        });
      }

      // Drag and drop — drop targets are elements with [data-state-name]
      let draggedTaskId = null;

      document.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.kanban-card');
        if (!card) return;
        draggedTaskId = card.dataset.taskId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
      });

      document.addEventListener('dragend', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card) card.classList.remove('dragging');
        document.querySelectorAll('[data-state-name]').forEach(el => el.classList.remove('drag-over'));
        draggedTaskId = null;
      });

      document.addEventListener('dragover', (e) => {
        const zone = e.target.closest('[data-state-name]');
        if (!zone) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('[data-state-name]').forEach(el => el.classList.remove('drag-over'));
        zone.classList.add('drag-over');
      });

      document.addEventListener('dragleave', (e) => {
        const zone = e.target.closest('[data-state-name]');
        if (zone && !zone.contains(e.relatedTarget)) {
          zone.classList.remove('drag-over');
        }
      });

      document.addEventListener('drop', (e) => {
        e.preventDefault();
        const zone = e.target.closest('[data-state-name]');
        if (!zone || !draggedTaskId) return;
        zone.classList.remove('drag-over');
        const targetState = zone.dataset.stateName;
        vscode.postMessage({ type: 'moveTask', taskId: draggedTaskId, targetState });
        draggedTaskId = null;
      });

      // Popup sort control
      const sortByBtn = document.getElementById('sortByBtn');
      const sortByMenu = document.getElementById('sortByMenu');

      function closeAllMenus() {
        document.querySelectorAll('.popup-menu.open').forEach(m => m.classList.remove('open'));
      }

      sortByBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sortByMenu.classList.contains('open');
        closeAllMenus();
        if (!isOpen) sortByMenu.classList.add('open');
      });

      document.addEventListener('click', () => closeAllMenus());

      // Button actions
      document.addEventListener('click', (e) => {
        const compactHeader = e.target.closest('.kanban-board.compact .column-header[data-column-key]');
        if (compactHeader && !e.target.closest('[data-action="addTask"]')) {
          const key = compactHeader.dataset.columnKey;
          if (key) {
            if (collapsedColumns.has(key)) {
              collapsedColumns.delete(key);
            } else {
              collapsedColumns.add(key);
            }
            saveCollapsedColumns(collapsedColumns);
            applyColumnCollapseState();
            return;
          }
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const taskId = btn.dataset.taskId;

        if (action === 'open') {
          vscode.postMessage({ type: 'openTask', taskId });
        } else if (action === 'showAll') {
          vscode.postMessage({ type: 'showAll', stateName: btn.dataset.stateName });
        } else if (action === 'showCompleted') {
          vscode.postMessage({ type: 'showCompleted' });
        } else if (action === 'addTask') {
          vscode.postMessage({ type: 'addTask', stateName: btn.dataset.stateName });
        } else if (action === 'setSortBy') {
          vscode.postMessage({ type: 'sortBy', sortBy: btn.dataset.value });
        } else if (action === 'implementWithAi') {
          vscode.postMessage({ type: 'implementWithAi', taskId });
        } else if (action === 'openParseWarningFile') {
          e.preventDefault();
          vscode.postMessage({
            type: 'openParseWarningFile',
            fileName: btn.dataset.fileName,
            line: parseInt(btn.dataset.line ?? '1', 10),
          });
        } else if (action === 'dismissParseWarnings') {
          e.preventDefault();
          vscode.postMessage({ type: 'dismissParseWarnings' });
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return;
        if (!active.matches('.kanban-board.compact .column-header[data-column-key]')) return;
        e.preventDefault();
        active.click();
      });

      window.addEventListener('resize', () => {
        applyCompactLayout();
      });
    `;

    const kanbanStyles = `
      <style>
        .kanban-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        #queryFilter {
          flex: 1;
          min-width: 120px;
        }
        .icon-btn-wrap {
          position: relative;
          display: inline-flex;
        }
        .icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 3px;
          color: var(--muted-fg);
          cursor: pointer;
        }
        .icon-btn:hover {
          background: var(--card-hover);
          color: var(--header-fg);
        }
        .icon-btn-active {
          color: var(--accent);
        }
        .popup-menu {
          display: none;
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          background: var(--vscode-dropdown-background);
          color: var(--vscode-foreground);
          border: 1px solid var(--vscode-input-border, var(--card-border));
          border-radius: 4px;
          min-width: 160px;
          padding: 4px 0;
          z-index: 1000;
          font-family: inherit;
          font-size: inherit;
          box-shadow: var(--vscode-widget-shadow, none);
        }
        .popup-menu.open {
          display: block;
        }
        .popup-label {
          padding: 4px 10px;
          color: var(--muted-fg);
          font-size: 0.75em;
          font-family: inherit;
        }
        .popup-item {
          padding: 4px 10px;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          font-size: inherit;
        }
        .popup-item:hover {
          background: var(--vscode-list-hoverBackground);
        }
        .popup-item.active {
          font-weight: 600;
          background: var(--vscode-list-activeSelectionBackground, var(--card-hover));
        }
        .kanban-board {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 12px;
          min-height: calc(100vh - 80px);
          align-items: flex-start;
        }
        .kanban-board.compact {
          gap: 8px;
        }
        .kanban-column {
          flex: 0 0 260px;
          min-width: 220px;
          background: var(--vscode-sideBar-background, var(--card-bg));
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 10px;
          transition: border-color 0.15s;
        }
        .kanban-board.compact .kanban-column {
          flex-basis: 210px;
          min-width: 180px;
          padding: 7px;
        }
        .kanban-board.compact .kanban-column.collapsed {
          flex-basis: 120px;
          min-width: 120px;
          max-width: 120px;
          padding: 6px 5px;
        }
        .kanban-column.collapsed .kanban-column-body {
          display: none;
        }
        [data-state-name].drag-over {
          border-color: var(--accent);
          border-style: dashed;
          border-width: 2px;
          padding: 9px;
        }
        .column-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--card-border);
        }
        .kanban-board.compact .column-header[data-column-key] {
          cursor: pointer;
          user-select: none;
          border-radius: 6px;
          padding-left: 8px;
          padding-right: 8px;
        }
        .kanban-board.compact .column-header[data-column-key]:hover {
          background: var(--card-hover);
        }
        .kanban-board.compact .column-header[data-column-key]:focus-visible {
          outline: 1px solid var(--accent);
          outline-offset: 1px;
        }
        .kanban-column.collapsed .column-header {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          margin-bottom: 0;
          padding: 2px 8px 2px;
          border-bottom: none;
        }
        .column-header-right {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .kanban-column.collapsed .column-title {
          font-size: 11px;
          line-height: 1.2;
          text-align: center;
          word-break: break-word;
        }
        .kanban-column.collapsed .column-header-right {
          display: inline-flex;
          align-items: center;
          gap: 0;
        }
        .kanban-column.collapsed .add-btn {
          display: none;
        }
        .column-title {
          font-weight: 600;
          font-size: 0.95em;
        }
        .column-collapse-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .column-collapse-chevron {
          display: inline-block;
          transition: transform 0.15s ease;
          font-size: 18px;
          line-height: 1;
        }
        .column-collapse-chevron.collapsed {
          transform: rotate(-90deg);
        }
        .column-collapse-count {
          color: var(--muted-fg);
        }
        .kanban-board:not(.compact) .column-collapse-indicator {
          display: none;
        }
        .kanban-column.collapsed .column-collapse-indicator {
          font-size: 11px;
          padding: 0;
          justify-content: flex-start;
        }
        .kanban-column.collapsed .column-collapse-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .kanban-board.compact > .kanban-column > .column-header .column-title,
        .kanban-board.compact > .kanban-column > .column-header .count-badge {
          display: none;
        }
        .kanban-card {
          position: relative;
          padding: 8px;
          margin-bottom: 6px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 4px;
          cursor: grab;
          transition: background 0.1s, opacity 0.15s;
        }
        .kanban-board.compact .kanban-card {
          padding: 6px;
        }
        .kanban-board.compact .task-title {
          font-size: 0.86em;
          line-height: 1.2;
        }
        .kanban-board.compact .task-tags {
          display: none;
        }
        .kanban-card:hover {
          background: var(--card-hover);
        }
        .card-ai-btn {
          display: none;
          position: absolute;
          top: 6px;
          right: 6px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          line-height: 1;
          align-items: center;
          justify-content: center;
          z-index: 2;
          opacity: 0.7;
          transition: opacity 0.15s;
        }
        .kanban-card:hover .card-ai-btn {
          display: inline-flex;
        }
        .card-ai-btn:hover {
          opacity: 1;
        }
        .kanban-card.dragging {
          opacity: 0.4;
        }
        .card-top {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .add-btn {
          background: none;
          border: 1px solid var(--card-border);
          color: var(--vscode-foreground, #ccc);
          border-radius: 4px;
          width: 22px;
          height: 22px;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .add-btn:hover {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
        }
        .sub-zone {
          margin-top: 8px;
          padding: 8px;
          border: 1px solid var(--card-border);
          border-radius: 4px;
          min-height: 36px;
          transition: border-color 0.15s;
        }
        .sub-zone-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .sub-zone-title {
          font-weight: 600;
          font-size: 0.85em;
          color: var(--muted-fg);
        }
        .show-collapsed-btn {
          display: block;
          width: 100%;
          padding: 6px 8px;
          margin-top: 6px;
          background: none;
          border: 1px dashed var(--card-border);
          border-radius: 4px;
          color: var(--muted-fg);
          cursor: pointer;
          font-size: 0.8em;
          text-align: center;
        }
        .show-collapsed-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .parse-warning-banner {
          border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-border));
          background: var(--vscode-inputValidation-warningBackground, rgba(255, 204, 0, 0.12));
          color: var(--vscode-editorWarning-foreground, var(--vscode-editorWarning-foreground));
          border-radius: 4px;
          padding: 8px 10px;
          margin-bottom: 10px;
          font-size: 0.85em;
        }
        .parse-warning-title {
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
        }
        .parse-warning-row {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 4px;
        }
        .parse-warning-file {
          font-weight: 500;
        }
        .parse-warning-msg {
          flex: 1;
          min-width: 120px;
          color: var(--muted-fg);
        }
        .parse-warning-open,
        .parse-warning-dismiss {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          padding: 2px 10px;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: inherit;
        }
        .parse-warning-open:hover,
        .parse-warning-dismiss:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        .parse-warning-dismiss {
          margin-top: 6px;
        }
      </style>
    `;

    const html = getWebviewHtml(
      this.panel.webview,
      'Tasks: Kanban Board',
      kanbanStyles + body,
      script,
    );
    return html;
  }

  private buildStandardColumn(state: StateViewData, columnKey: string, title = state.name): string {
    const cards = state.tasks.map((t) => this.buildCard(t)).join('\n');
    const showMore = state.hasMore
      ? `<div class="show-more" data-action="showAll" data-state-name="${state.name}">Showing ${state.tasks.length} of ${state.totalCount} — Show all</div>`
      : '';
    const empty = state.tasks.length === 0 ? '<div class="empty-state">No tasks</div>' : '';

    return `
      <div class="kanban-column" data-state-name="${state.name}" data-column-key="${columnKey}">
        <div class="column-header" data-column-key="${columnKey}" role="button" tabindex="0">
          <span class="column-title">${title}</span>
          <div class="column-header-right">
            <span class="count-badge">${state.totalCount}</span>
            <button class="add-btn" data-action="addTask" data-state-name="${state.name}" title="Add task to ${state.name}">+</button>
            <span class="column-collapse-indicator" data-column-title="${this.escapeAttr(title)}" data-column-count="${state.totalCount}" aria-expanded="true"><span class="column-collapse-chevron">▾</span><span class="column-collapse-label">${this.escapeHtml(title)} <span class="column-collapse-count">(${state.totalCount})</span></span></span>
          </div>
        </div>
        <div class="kanban-column-body">
          ${cards}
          ${empty}
          ${showMore}
        </div>
      </div>
    `;
  }

  private buildActiveColumn(nextState?: StateViewData, inProgressState?: StateViewData): string {
    const nextCount = nextState?.totalCount ?? 0;
    const inProgressCount = inProgressState?.totalCount ?? 0;
    const totalActive = nextCount + inProgressCount;

    let inProgressHtml = '';
    if (inProgressState) {
      const cards = inProgressState.tasks.map((t) => this.buildCard(t)).join('\n');
      const empty =
        inProgressState.tasks.length === 0 ? '<div class="empty-state">No tasks</div>' : '';
      const showMore = inProgressState.hasMore
        ? `<div class="show-more" data-action="showAll" data-state-name="In Progress">Showing ${inProgressState.tasks.length} of ${inProgressCount} — Show all</div>`
        : '';
      inProgressHtml = `
        <div class="sub-zone" data-state-name="In Progress">
          <div class="sub-zone-header">
            <span class="sub-zone-title">In Progress</span>
            <span class="count-badge">${inProgressCount}</span>
          </div>
          ${cards}${empty}${showMore}
        </div>`;
    }

    let nextHtml = '';
    if (nextState) {
      const cards = nextState.tasks.map((t) => this.buildCard(t)).join('\n');
      const empty = nextState.tasks.length === 0 ? '<div class="empty-state">No tasks</div>' : '';
      const showMore = nextState.hasMore
        ? `<div class="show-more" data-action="showAll" data-state-name="Next">Showing ${nextState.tasks.length} of ${nextCount} — Show all</div>`
        : '';
      nextHtml = `
        <div class="sub-zone" data-state-name="Next">
          <div class="sub-zone-header">
            <span class="sub-zone-title">Next</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="count-badge">${nextCount}</span>
              <button class="add-btn" data-action="addTask" data-state-name="Next" title="Add task to Next">+</button>
            </div>
          </div>
          ${cards}${empty}${showMore}
        </div>`;
    }

    return `
      <div class="kanban-column" data-column-key="active">
        <div class="column-header" data-column-key="active" role="button" tabindex="0">
          <span class="column-title">Active</span>
          <div class="column-header-right">
            <span class="count-badge">${totalActive}</span>
            <span class="column-collapse-indicator" data-column-title="Active" data-column-count="${totalActive}" aria-expanded="true"><span class="column-collapse-chevron">▾</span><span class="column-collapse-label">Active <span class="column-collapse-count">(${totalActive})</span></span></span>
          </div>
        </div>
        <div class="kanban-column-body">
          ${inProgressHtml}
          ${nextHtml}
        </div>
      </div>
    `;
  }

  private buildCompletedColumn(doneState?: StateViewData, rejectedState?: StateViewData): string {
    const doneCount = doneState?.totalCount ?? 0;
    const rejectedCount = rejectedState?.totalCount ?? 0;
    const totalCompleted = doneCount + rejectedCount;
    const isExpanded = this.showAllForState.has('Done') || this.showAllForState.has('Rejected');

    let innerContent: string;

    if (isExpanded) {
      let doneHtml = '';
      if (doneState) {
        const cards = doneState.tasks.map((t) => this.buildCard(t)).join('\n');
        const empty = doneState.tasks.length === 0 ? '<div class="empty-state">No tasks</div>' : '';
        doneHtml = `
          <div class="sub-zone" data-state-name="Done">
            <div class="sub-zone-header">
              <span class="sub-zone-title">Done</span>
              <span class="count-badge">${doneCount}</span>
            </div>
            ${cards}${empty}
          </div>`;
      }

      let rejectedHtml = '';
      if (rejectedState) {
        const cards = rejectedState.tasks.map((t) => this.buildCard(t)).join('\n');
        const empty =
          rejectedState.tasks.length === 0 ? '<div class="empty-state">No tasks</div>' : '';
        rejectedHtml = `
          <div class="sub-zone" data-state-name="Rejected">
            <div class="sub-zone-header">
              <span class="sub-zone-title">Rejected</span>
              <span class="count-badge">${rejectedCount}</span>
            </div>
            ${cards}${empty}
          </div>`;
      }

      innerContent = `${doneHtml}${rejectedHtml}`;
    } else {
      const showButton =
        totalCompleted > 0
          ? `<button class="show-collapsed-btn" data-action="showCompleted">Show ${totalCompleted} completed tasks</button>`
          : '';

      innerContent = `
        <div class="sub-zone" data-state-name="Done">
          <div class="sub-zone-header">
            <span class="sub-zone-title">Done</span>
            <span class="count-badge">${doneCount}</span>
          </div>
        </div>
        <div class="sub-zone" data-state-name="Rejected">
          <div class="sub-zone-header">
            <span class="sub-zone-title">Rejected</span>
            <span class="count-badge">${rejectedCount}</span>
          </div>
        </div>
        ${showButton}`;
    }

    return `
      <div class="kanban-column" data-column-key="completed">
        <div class="column-header" data-column-key="completed" role="button" tabindex="0">
          <span class="column-title">Completed</span>
          <div class="column-header-right">
            <span class="count-badge">${totalCompleted}</span>
            <span class="column-collapse-indicator" data-column-title="Completed" data-column-count="${totalCompleted}" aria-expanded="true"><span class="column-collapse-chevron">▾</span><span class="column-collapse-label">Completed <span class="column-collapse-count">(${totalCompleted})</span></span></span>
          </div>
        </div>
        <div class="kanban-column-body">
          ${innerContent}
        </div>
      </div>
    `;
  }

  private buildCard(task: TaskViewItem): string {
    const tags = task.tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join('');

    const metaParts: string[] = [];
    if (task.assignee) {
      metaParts.push(
        `<span style="font-size:0.8em;color:var(--muted-fg);">&#128100; ${this.escapeHtml(task.assignee)}</span>`,
      );
    }
    if (task.updatedAt) {
      metaParts.push(
        `<span style="font-size:0.8em;color:var(--muted-fg);">&#128339; ${this.escapeHtml(task.updatedAt)}</span>`,
      );
    }
    const metaHtml =
      metaParts.length > 0
        ? `<div style="display:flex;gap:6px;margin-top:3px;flex-wrap:wrap;">${metaParts.join('')}</div>`
        : '';

    return `
      <div class="kanban-card" draggable="true" data-task-id="${task.id}">
        <div class="card-top">
          <div class="priority-bar priority-${task.priority}"></div>
          <div style="flex:1; min-width:0;">
            <div class="task-header">
              <span class="task-id">${task.id}</span>
              <span class="task-title" data-action="open" data-task-id="${task.id}" style="cursor:pointer;">${this.escapeHtml(task.title)}</span>
            </div>
            ${tags ? `<div class="task-tags">${tags}</div>` : ''}
            ${metaHtml}
          </div>
          <button class="card-ai-btn" data-action="implementWithAi" data-task-id="${task.id}" title="Implement with AI"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5Z" fill="#ec4899"/><path d="M12.5 0l.75 2.25L15.5 3l-2.25.75L12.5 6l-.75-2.25L9.5 3l2.25-.75Z" fill="#8b5cf6" opacity="0.8"/></svg></button>
        </div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private dispose(): void {
    this.storeDisposable.dispose();
    KanbanPanel.instance = undefined;
  }
}
