import * as vscode from 'vscode';
import * as path from 'path';
import { TaskStore } from '../../../core/store/taskStore.js';
import { ConfigManager } from '../../../core/config/configManager.js';
import { groupTasks, TaskListSortBy } from '../../../core/filter/taskFilter.js';
import { isDeferredStateName } from '../../../core/store/taskStore.js';
import { Task, Priority } from '../../../core/model/task.js';
import { TaskFilter, GroupViewData, TaskViewItem } from '../../../core/model/messages.js';
import { getWebviewHtml } from './webviewHelper.js';
import {
  getSortBy,
  getGroupBy,
  setSortBy,
  setGroupBy,
  GroupBy,
} from '../../config/extensionConfig.js';

export class TaskListViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'taskplanner.taskView';

  private view?: vscode.WebviewView;
  private filter: TaskFilter = { groupBy: 'status' };
  private sortBy: TaskListSortBy = 'priority';
  private showAllForGroup: Set<string> = new Set();
  private toggledGroups: Set<string> = new Set();
  private activeTaskId: string | null = null;
  private storeDisposable?: { dispose: () => void };
  private parseWarningsDismissed = false;
  private parseWarningsKey = '';

  constructor(
    private taskStore: TaskStore,
    private configManager: ConfigManager,
    private isInitialized: () => boolean,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.update();
      }
    });
    webviewView.onDidDispose(() => {
      this.storeDisposable?.dispose();
      this.storeDisposable = undefined;
      this.view = undefined;
    });

    this.storeDisposable = this.taskStore.onDidChange(() => {
      if (this.view?.visible && !this.activeTaskId) {
        this.update();
      }
    });

    this.syncSettingsFromWorkspace();
    this.update();
  }

  public refresh(): void {
    this.syncSettingsFromWorkspace();
    this.update();
  }

  private syncSettingsFromWorkspace(): void {
    this.sortBy = getSortBy();
    this.filter.groupBy = getGroupBy();
  }

  public showTask(taskId: string): void {
    this.activeTaskId = taskId;
    this.update();
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case 'ready':
        this.update();
        break;
      case 'applyFilter':
        {
          const prevGroupBy = this.filter.groupBy ?? 'status';
          const prevSortBy = this.sortBy;

          this.filter = (msg.filter as TaskFilter) ?? { groupBy: 'status' };
          if (msg.sortBy) {
            this.sortBy = msg.sortBy as TaskListSortBy;
          }

          const nextGroupBy = this.filter.groupBy ?? 'status';
          const nextSortBy = this.sortBy;

          if (nextGroupBy !== prevGroupBy) {
            void setGroupBy(nextGroupBy as GroupBy);
          }

          if (nextSortBy !== prevSortBy) {
            void setSortBy(nextSortBy);
          }
        }
        this.showAllForGroup.clear();
        this.update();
        break;
      case 'showAll':
        if (msg.groupLabel) {
          const gl = msg.groupLabel as string;
          if (isDeferredStateName(gl)) {
            this.taskStore.ensureStateLoaded(gl);
          }
          this.showAllForGroup.add(gl);
        }
        this.update();
        break;
      case 'toggleGroup':
        {
          const label = msg.groupLabel as string;
          const before = this.toggledGroups.has(label);
          if (before) {
            this.toggledGroups.delete(label);
          } else {
            this.toggledGroups.add(label);
          }
          const after = this.toggledGroups.has(label);
          if (!before && after && isDeferredStateName(label)) {
            this.taskStore.ensureStateLoaded(label);
          }
        }
        this.update();
        break;
      case 'expandGroup':
        if (msg.groupLabel) {
          const label = msg.groupLabel as string;
          const before = this.toggledGroups.has(label);
          if (before) {
            this.toggledGroups.delete(label);
          } else {
            this.toggledGroups.add(label);
          }
          const after = this.toggledGroups.has(label);
          if (!before && after && isDeferredStateName(label)) {
            this.taskStore.ensureStateLoaded(label);
          }
        }
        this.update();
        break;
      case 'viewTask':
        this.activeTaskId = msg.taskId as string;
        this.update();
        break;
      case 'backToList':
        this.activeTaskId = null;
        this.update();
        break;
      case 'changeStatus':
        this.taskStore.moveTask(msg.taskId as string, msg.targetState as string);
        break;
      case 'reorderTask':
        this.taskStore.reorderTaskToIndex(msg.taskId as string, msg.newIndex as number);
        break;
      case 'moveTask': {
        const ti = msg.targetIndex;
        this.taskStore.moveTask(
          msg.taskId as string,
          msg.targetState as string,
          typeof ti === 'number' ? ti : undefined,
        );
        break;
      }
      case 'saveTask':
        {
          const taskId = msg.taskId as string;
          const updates: Partial<Omit<Task, 'id'>> = {};
          if (msg.title !== undefined) updates.title = msg.title as string;
          if (msg.description !== undefined) updates.description = msg.description as string;
          if (msg.priority !== undefined) updates.priority = msg.priority as Priority;
          if (msg.tags !== undefined) updates.tags = msg.tags as string[];
          if (msg.assignee !== undefined) updates.assignee = (msg.assignee as string) || undefined;
          if (msg.epic !== undefined) updates.epic = (msg.epic as string) || undefined;
          this.taskStore.updateTask(taskId, updates);
        }
        break;
      case 'openInEditor':
        vscode.commands.executeCommand('taskplanner.openTask', msg.taskId as string);
        break;
      case 'implementWithAi':
        vscode.commands.executeCommand('taskplanner.implementWithAi', msg.taskId as string);
        break;
      case 'command':
        vscode.commands.executeCommand(msg.command as string);
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

  private syncParseWarningDismissState(): void {
    const key = JSON.stringify(this.taskStore.getWarnings());
    if (key !== this.parseWarningsKey) {
      this.parseWarningsKey = key;
      this.parseWarningsDismissed = false;
    }
  }

  private update(): void {
    if (!this.view) return;

    this.syncParseWarningDismissState();

    if (!this.isInitialized()) {
      this.view.webview.html = this.buildWelcomeHtml();
      return;
    }

    if (this.activeTaskId) {
      const found = this.taskStore.findTask(this.activeTaskId);
      if (found) {
        this.view.webview.html = this.buildDetailHtml(found.task, found.stateName);
        return;
      }
      this.activeTaskId = null;
    }

    const config = this.configManager.get();
    const states = config.states;
    const groupBy = this.filter.groupBy ?? 'status';
    const needAllTasks =
      groupBy !== 'status' ||
      this.sortBy === 'file' ||
      Boolean(this.filter.query?.trim()) ||
      Boolean(this.filter.tag);
    if (needAllTasks) {
      this.taskStore.ensureAllDeferredStatesLoaded();
    }
    const allTasks = this.taskStore.getAllTasks();
    const displayCounts = this.taskStore.getStateDisplayCounts();

    const groups = groupTasks(
      allTasks,
      states,
      groupBy,
      this.filter,
      undefined,
      this.sortBy,
      displayCounts,
    );

    if (this.showAllForGroup.size > 0) {
      const unlimitedGroups = groupTasks(
        allTasks,
        states,
        groupBy,
        this.filter,
        null,
        this.sortBy,
        displayCounts,
      );
      for (const group of groups) {
        if (this.showAllForGroup.has(group.label)) {
          const full = unlimitedGroups.find((g) => g.label === group.label);
          if (full) {
            group.tasks = full.tasks;
            group.hasMore = false;
          }
        }
      }
    }

    this.view.webview.html = this.buildListHtml(groups, groupBy);
  }

  // ── Welcome ───────────────────────────────────────────────────────

  private buildWelcomeHtml(): string {
    const body = `
      <div class="welcome">
        <p>No Task → Plan → AI project found in this workspace.</p>
        <button class="welcome-btn" onclick="vscode.postMessage({type:'command',command:'taskplanner.init'})">Initialize Project</button>
        <button class="welcome-btn" onclick="vscode.postMessage({type:'command',command:'taskplanner.setup'})">Setup</button>
      </div>
    `;

    const extraStyles = `
      <style>
        body { padding: 8px; }
        .welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 8px;
          text-align: center;
          color: var(--muted-fg);
        }
        .welcome-btn {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 6px 14px;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: inherit;
        }
        .welcome-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }
      </style>
    `;

    return getWebviewHtml(this.view!.webview, 'Tasks', extraStyles + body, '');
  }

  // ── List view ─────────────────────────────────────────────────────

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

  private buildListHtml(groups: GroupViewData[], groupBy: string): string {
    const config = this.configManager.get();
    const states = config.states;
    const availableTags = this.collectAvailableTags(config.tags, this.taskStore.getAllTasks());
    const statusFilterItems = [
      { value: '', label: 'All statuses' },
      ...states.map((s) => ({ value: s.name, label: s.name })),
    ]
      .map((o) => {
        const isActive = o.value === '' ? !this.filter.status : this.filter.status === o.value;
        return `<div class="popup-item${isActive ? ' active' : ''}" data-action="setStatus" data-value="${this.escapeAttr(o.value)}">${o.label}</div>`;
      })
      .join('\n');

    const tagFilterItems = [
      { value: '', label: 'All tags' },
      ...availableTags.map((tag) => ({ value: tag, label: tag })),
    ]
      .map((o) => {
        const isActive = o.value === '' ? !this.filter.tag : this.filter.tag === o.value;
        return `<div class="popup-item${isActive ? ' active' : ''}" data-action="setTag" data-value="${this.escapeAttr(o.value)}">${this.escapeHtml(o.label)}</div>`;
      })
      .join('\n');

    const groupByItems = [
      { value: 'status', label: 'Status' },
      { value: 'assignee', label: 'Assignee' },
      { value: 'date', label: 'Date' },
      { value: 'none', label: 'No grouping' },
    ]
      .map(
        (o) =>
          `<div class="popup-item${groupBy === o.value ? ' active' : ''}" data-action="setGroupBy" data-value="${o.value}">${o.label}</div>`,
      )
      .join('\n');

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

    const filterBar = `
      <div class="filter-bar">
        <div class="filter-search-row">
          <input type="text" id="queryFilter" placeholder="Search..."
            value="${this.escapeAttr(this.filter.query ?? '')}" />
        </div>
        <div class="filter-controls">
          <div class="icon-btn-wrap">
            <button class="icon-btn${groupBy !== 'status' ? ' icon-btn-active' : ''}" id="groupByBtn" title="Group by: ${this.escapeAttr(groupBy)}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v1H1zm0 4h10v1H1zm0 4h14v1H1zm0-2h10v1H1z"/></svg>
            </button>
            <div class="popup-menu" id="groupByMenu">
              <div class="popup-label">Group by</div>
              ${groupByItems}
            </div>
          </div>
          <div class="icon-btn-wrap">
            <button class="icon-btn${this.sortBy !== 'priority' ? ' icon-btn-active' : ''}" id="sortByBtn" title="Sort by: ${this.escapeAttr(this.sortBy)}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1l3 4H4v6h2l-3 4-3-4h2V5H0l3-4zm6 1h7v2H9V2zm0 4h5v2H9V6zm0 4h3v2H9v-2z"/></svg>
            </button>
            <div class="popup-menu" id="sortByMenu">
              <div class="popup-label">Sort by</div>
              ${sortByItems}
            </div>
          </div>
          <div class="icon-btn-wrap">
            <button class="icon-btn${this.filter.tag ? ' icon-btn-active' : ''}" id="tagBtn" title="Tag: ${this.escapeAttr(this.filter.tag ?? 'All tags')}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h5.5l1 1H14v8.5l-1 1H2V2zm1 1v7h7.8l.7-.7V4.5l-.7-.7H7.5L6.5 3H3zm2.5 2.5a1 1 0 100 2 1 1 0 000-2z"/></svg>
            </button>
            <div class="popup-menu" id="tagMenu">
              <div class="popup-label">Tag</div>
              ${tagFilterItems}
            </div>
          </div>
          <div class="icon-btn-wrap">
            <button class="icon-btn${this.filter.status ? ' icon-btn-active' : ''}" id="statusBtn" title="Status: ${this.escapeAttr(this.filter.status ?? 'All statuses')}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v1l-5 6v5l-2-1V9L2 3V2z"/></svg>
            </button>
            <div class="popup-menu" id="statusMenu">
              <div class="popup-label">Status</div>
              ${statusFilterItems}
            </div>
          </div>
        </div>
      </div>
    `;

    const sections = groups.map((g) => this.buildGroupSection(g, groupBy)).join('\n');

    const body = `
      ${filterBar}
      ${this.buildParseWarningBanner()}
      <div id="taskSections">${sections}</div>
    `;

    const script = `
      const queryEl = document.getElementById('queryFilter');
      const statusBtn = document.getElementById('statusBtn');
      const statusMenu = document.getElementById('statusMenu');
      const tagBtn = document.getElementById('tagBtn');
      const tagMenu = document.getElementById('tagMenu');
      const groupByBtn = document.getElementById('groupByBtn');
      const groupByMenu = document.getElementById('groupByMenu');
      const sortByBtn = document.getElementById('sortByBtn');
      const sortByMenu = document.getElementById('sortByMenu');

      let currentGroupBy = ${JSON.stringify(groupBy)};
      let currentSortBy = ${JSON.stringify(this.sortBy)};
      let currentStatus = ${JSON.stringify(this.filter.status ?? '')};
      let currentTag = ${JSON.stringify(this.filter.tag ?? '')};
      let taskListSuppressClickUntil = 0;

      let debounceTimer;
      function applyFilter() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          vscode.postMessage({
            type: 'applyFilter',
            filter: {
              status: currentStatus || undefined,
              tag: currentTag || undefined,
              query: queryEl.value || undefined,
              groupBy: currentGroupBy
            },
            sortBy: currentSortBy
          });
        }, 200);
      }

      queryEl.addEventListener('input', applyFilter);

      // Restore focus to search when re-rendered with an active query
      if (queryEl.value) {
        requestAnimationFrame(() => {
          queryEl.focus();
          queryEl.setSelectionRange(queryEl.value.length, queryEl.value.length);
        });
      }

      // Popup menu toggle
      function closeAllMenus() {
        document.querySelectorAll('.popup-menu.open').forEach(m => m.classList.remove('open'));
      }

      groupByBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = groupByMenu.classList.contains('open');
        closeAllMenus();
        if (!isOpen) groupByMenu.classList.add('open');
      });

      sortByBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sortByMenu.classList.contains('open');
        closeAllMenus();
        if (!isOpen) sortByMenu.classList.add('open');
      });

      statusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = statusMenu.classList.contains('open');
        closeAllMenus();
        if (!isOpen) statusMenu.classList.add('open');
      });

      tagBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = tagMenu.classList.contains('open');
        closeAllMenus();
        if (!isOpen) tagMenu.classList.add('open');
      });

      document.addEventListener('click', () => closeAllMenus());

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'viewTask') {
          if (Date.now() < taskListSuppressClickUntil) return;
          vscode.postMessage({ type: 'viewTask', taskId: btn.dataset.taskId });
        } else if (action === 'showAll') {
          vscode.postMessage({ type: 'showAll', groupLabel: btn.dataset.groupLabel });
        } else if (action === 'toggleGroup') {
          vscode.postMessage({ type: 'toggleGroup', groupLabel: btn.dataset.groupLabel });
        } else if (action === 'setGroupBy') {
          currentGroupBy = btn.dataset.value;
          closeAllMenus();
          applyFilter();
        } else if (action === 'setSortBy') {
          currentSortBy = btn.dataset.value;
          closeAllMenus();
          applyFilter();
        } else if (action === 'setStatus') {
          currentStatus = btn.dataset.value ?? '';
          closeAllMenus();
          applyFilter();
        } else if (action === 'setTag') {
          currentTag = btn.dataset.value ?? '';
          closeAllMenus();
          applyFilter();
        } else if (action === 'implementWithAi') {
          e.stopPropagation();
          vscode.postMessage({ type: 'implementWithAi', taskId: btn.dataset.taskId });
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
      ${
        groupBy === 'status'
          ? `
      (function () {
        let draggedTaskId = null;
        let dragSourceState = null;

        function getDropZone(el) {
          return el && el.closest('[data-state-name]');
        }

        function isHeaderDropZone(zone) {
          return zone && zone.classList && zone.classList.contains('group-header-dnd');
        }

        function cardsInZone(zone, excludeId) {
          return [...zone.querySelectorAll('.task-card')].filter((c) => c.dataset.taskId !== excludeId);
        }

        const APPEND_INDEX = 999999;

        function insertIndexFromY(zone, clientY, excludeId) {
          const cards = cardsInZone(zone, excludeId);
          for (let i = 0; i < cards.length; i++) {
            const r = cards[i].getBoundingClientRect();
            const mid = r.top + r.height / 2;
            if (clientY < mid) return i;
          }
          return cards.length;
        }

        function effectiveInsertIndex(zone, clientY, excludeId) {
          if (isHeaderDropZone(zone)) return APPEND_INDEX;
          return insertIndexFromY(zone, clientY, excludeId);
        }

        let indicator = document.getElementById('task-list-drop-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.id = 'task-list-drop-indicator';
          indicator.className = 'drop-indicator';
          indicator.style.display = 'none';
          document.body.appendChild(indicator);
        }

        function hideIndicator() {
          indicator.style.display = 'none';
        }

        function showIndicator(zone, insertIdx, excludeId) {
          const cards = cardsInZone(zone, excludeId);
          const zr = zone.getBoundingClientRect();
          let top;
          if (insertIdx >= cards.length) {
            if (cards.length === 0) {
              top = zr.top + 4;
            } else {
              const last = cards[cards.length - 1].getBoundingClientRect();
              top = last.bottom + 2;
            }
          } else {
            const r = cards[insertIdx].getBoundingClientRect();
            top = r.top - 2;
          }
          indicator.style.display = 'block';
          indicator.style.position = 'fixed';
          indicator.style.left = zr.left + 'px';
          indicator.style.width = Math.max(0, zr.width) + 'px';
          indicator.style.top = top + 'px';
          indicator.style.zIndex = '10000';
        }

        function showHeaderAppendIndicator(zone) {
          const zr = zone.getBoundingClientRect();
          indicator.style.display = 'block';
          indicator.style.position = 'fixed';
          indicator.style.left = zr.left + 'px';
          indicator.style.width = Math.max(0, zr.width) + 'px';
          indicator.style.top = zr.bottom - 1 + 'px';
          indicator.style.zIndex = '10000';
        }

        document.addEventListener('dragstart', (e) => {
          const card = e.target.closest('.task-card[draggable="true"]');
          if (!card) return;
          draggedTaskId = card.dataset.taskId;
          const z = getDropZone(card);
          dragSourceState = z ? z.dataset.stateName : null;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedTaskId);
        });

        document.addEventListener('dragend', (e) => {
          const card = e.target.closest('.task-card');
          if (card) card.classList.remove('dragging');
          document.querySelectorAll('[data-state-name].drag-over').forEach((el) => el.classList.remove('drag-over'));
          hideIndicator();
          taskListSuppressClickUntil = Date.now() + 250;
          draggedTaskId = null;
          dragSourceState = null;
        });

        document.addEventListener('dragover', (e) => {
          if (!draggedTaskId) return;
          const zone = getDropZone(e.target);
          if (!zone) {
            document.querySelectorAll('[data-state-name].drag-over').forEach((el) => el.classList.remove('drag-over'));
            hideIndicator();
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          document.querySelectorAll('[data-state-name].drag-over').forEach((el) => el.classList.remove('drag-over'));
          zone.classList.add('drag-over');
          if (isHeaderDropZone(zone)) {
            showHeaderAppendIndicator(zone);
          } else {
            const idx = insertIndexFromY(zone, e.clientY, draggedTaskId);
            showIndicator(zone, idx, draggedTaskId);
          }
        });

        document.addEventListener('dragleave', (e) => {
          const zone = getDropZone(e.target);
          if (zone && !zone.contains(e.relatedTarget)) {
            zone.classList.remove('drag-over');
          }
        });

        document.addEventListener('drop', (e) => {
          if (!draggedTaskId) return;
          e.preventDefault();
          const zone = getDropZone(e.target);
          if (!zone) return;
          zone.classList.remove('drag-over');
          hideIndicator();
          const targetState = zone.dataset.stateName;
          const insertIdx = effectiveInsertIndex(zone, e.clientY, draggedTaskId);
          if (dragSourceState === targetState) {
            vscode.postMessage({ type: 'reorderTask', taskId: draggedTaskId, newIndex: insertIdx });
          } else {
            vscode.postMessage({
              type: 'moveTask',
              taskId: draggedTaskId,
              targetState,
              targetIndex: insertIdx,
            });
          }
          if (isHeaderDropZone(zone) && zone.dataset.collapsed === 'true') {
            vscode.postMessage({ type: 'expandGroup', groupLabel: targetState });
          }
        });
      })();
      `
          : ''
      }
    `;

    const extraStyles = `
      <style>
        body { padding: 8px; }
        .filter-search-row {
          width: 100%;
        }
        .filter-search-row #queryFilter {
          width: 100%;
        }
        .filter-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .filter-bar {
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
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
        .group-section {
          margin-bottom: 8px;
        }
        .group-header {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          user-select: none;
        }
        .group-header:hover {
          background: var(--card-hover);
        }
        .group-header h2 {
          font-size: 0.95em;
          margin: 0;
        }
        .group-chevron {
          font-size: 0.7em;
          transition: transform 0.15s;
          color: var(--muted-fg);
        }
        .group-chevron.collapsed {
          transform: rotate(-90deg);
        }
        .group-tasks {
          margin-top: 2px;
        }
        .group-tasks.hidden {
          display: none;
        }
        [data-state-name].group-tasks {
          border: 2px solid transparent;
          border-radius: 4px;
          padding: 2px;
          transition: border-color 0.15s;
          min-height: 4px;
        }
        [data-state-name].group-tasks.drag-over {
          border-color: var(--accent);
          border-style: dashed;
        }
        .group-header.group-header-dnd[data-state-name] {
          border: 2px solid transparent;
          border-radius: 4px;
          transition: border-color 0.15s;
        }
        .group-header.group-header-dnd[data-state-name].drag-over {
          border-color: var(--accent);
          border-style: dashed;
        }
        .drop-indicator {
          height: 2px;
          background: var(--accent);
          border-radius: 1px;
          margin: 0;
          pointer-events: none;
        }
        .task-card[draggable="true"] {
          cursor: grab;
        }
        .task-card.dragging {
          opacity: 0.4;
        }
        .task-card {
          position: relative;
          padding: 6px 8px;
          margin-bottom: 4px;
          gap: 6px;
          cursor: pointer;
        }
        .card-ai-btn {
          display: none;
          position: absolute;
          top: 4px;
          right: 4px;
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
        .task-card:hover .card-ai-btn {
          display: inline-flex;
        }
        .card-ai-btn:hover {
          opacity: 1;
        }
        .task-content {
          min-width: 0;
          flex: 1;
        }
        .task-header {
          gap: 4px;
        }
        .task-id {
          font-size: 0.8em;
        }
        .task-title {
          font-size: 0.9em;
        }
        .task-meta {
          display: flex;
          gap: 6px;
          margin-top: 2px;
          font-size: 0.75em;
          color: var(--muted-fg);
        }
        .task-meta-item {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .parse-warning-banner {
          border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-border));
          background: var(--vscode-inputValidation-warningBackground, rgba(255, 204, 0, 0.12));
          color: var(--vscode-editorWarning-foreground, var(--vscode-editorWarning-foreground));
          border-radius: 4px;
          padding: 8px 10px;
          margin-bottom: 8px;
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

    return getWebviewHtml(this.view!.webview, 'Tasks', extraStyles + body, script);
  }

  private buildGroupSection(group: GroupViewData, groupBy: string): string {
    const userToggled = this.toggledGroups.has(group.label);
    const isHidden = !!group.collapsed !== userToggled && !this.filter.query;
    const chevronClass = isHidden ? 'group-chevron collapsed' : 'group-chevron';
    const tasksClass = isHidden ? 'group-tasks hidden' : 'group-tasks';
    const dndByStatus = groupBy === 'status';
    const stateAttr = dndByStatus ? ` data-state-name="${this.escapeAttr(group.label)}"` : '';

    const cards = group.tasks.map((t) => this.buildTaskCard(t, dndByStatus)).join('\n');
    const showMore = group.hasMore
      ? `<div class="show-more" data-action="showAll" data-group-label="${this.escapeAttr(group.label)}">Showing ${group.tasks.length} of ${group.totalCount} — Show all</div>`
      : '';

    const empty =
      group.tasks.length === 0 && !this.filter.query
        ? '<div class="empty-state">No tasks</div>'
        : '';

    const headerDndClass = dndByStatus ? ' group-header-dnd' : '';
    const headerStateAttr = dndByStatus ? ` data-state-name="${this.escapeAttr(group.label)}"` : '';
    const headerCollapsedAttr = dndByStatus ? ` data-collapsed="${isHidden ? 'true' : 'false'}"` : '';

    return `
      <div class="group-section">
        <div class="group-header${headerDndClass}" data-action="toggleGroup" data-group-label="${this.escapeAttr(group.label)}"${headerStateAttr}${headerCollapsedAttr}>
          <span class="${chevronClass}">&#9660;</span>
          <h2>${this.escapeHtml(group.label)} <span class="count-badge">(${group.totalCount})</span></h2>
        </div>
        <div class="${tasksClass}"${stateAttr}>
          ${cards}
          ${empty}
          ${showMore}
        </div>
      </div>
    `;
  }

  private buildTaskCard(task: TaskViewItem, draggable: boolean): string {
    const tags = task.tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join('');

    const metaParts: string[] = [];
    if (task.assignee) {
      metaParts.push(
        `<span class="task-meta-item">&#128100; ${this.escapeHtml(task.assignee)}</span>`,
      );
    }
    if (task.updatedAt) {
      metaParts.push(
        `<span class="task-meta-item">&#128339; ${this.escapeHtml(task.updatedAt)}</span>`,
      );
    }
    const metaHtml =
      metaParts.length > 0 ? `<div class="task-meta">${metaParts.join('')}</div>` : '';

    const dragAttr = draggable ? ' draggable="true"' : '';
    return `
      <div class="task-card" data-action="viewTask" data-task-id="${task.id}"${dragAttr}>
        <div class="priority-bar priority-${task.priority}"></div>
        <div class="task-content">
          <div class="task-header">
            <span class="task-id">${task.id}</span>
            <span class="task-title">${this.escapeHtml(task.title)}</span>
          </div>
          ${tags ? `<div class="task-tags">${tags}</div>` : ''}
          ${metaHtml}
        </div>
        <button type="button" class="card-ai-btn" draggable="false" data-action="implementWithAi" data-task-id="${task.id}" title="Implement with AI"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5Z" fill="#ec4899"/><path d="M12.5 0l.75 2.25L15.5 3l-2.25.75L12.5 6l-.75-2.25L9.5 3l2.25-.75Z" fill="#8b5cf6" opacity="0.8"/></svg></button>
      </div>
    `;
  }

  // ── Detail / edit view ────────────────────────────────────────────

  private buildDetailHtml(task: Task, stateName: string): string {
    const states = this.configManager.get().states;
    const stateItems = states
      .map(
        (s) =>
          `<div class="popup-item${s.name === stateName ? ' active' : ''}" data-value="${this.escapeAttr(s.name)}">${this.escapeHtml(s.name)}</div>`,
      )
      .join('\n');

    const priorityItems = Object.values(Priority)
      .map(
        (p) =>
          `<div class="popup-item${p === task.priority ? ' active' : ''}" data-value="${p}">${p}</div>`,
      )
      .join('\n');

    const descriptionText = this.escapeHtml(task.description);

    const body = `
      <div class="detail-view">
        <button class="back-btn" id="backBtn">&#8592; Back</button>
        ${this.buildParseWarningBanner()}

        <button class="ai-hero-btn" id="aiBtnTop"><svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px;margin-right:6px"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5Z" fill="#fff"/><path d="M12.5 0l.75 2.25L15.5 3l-2.25.75L12.5 6l-.75-2.25L9.5 3l2.25-.75Z" fill="#fff" opacity="0.7"/></svg>Build with AI</button>

        <div class="detail-field">
          <label>ID</label>
          <div class="detail-readonly">${this.escapeHtml(task.id)}</div>
        </div>

        <div class="detail-field">
          <label>Title</label>
          <input type="text" id="fieldTitle" value="${this.escapeAttr(task.title)}" />
        </div>

        <div class="detail-row">
          <div class="detail-field detail-field-half">
            <label>Status</label>
            <div class="detail-select-wrap">
              <button type="button" class="detail-select-trigger" id="fieldStatusTrigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="detail-select-label">${this.escapeHtml(stateName)}</span>
                <span class="detail-select-chevron" aria-hidden="true">▾</span>
              </button>
              <input type="hidden" id="fieldStatus" value="${this.escapeAttr(stateName)}" />
              <div class="popup-menu detail-select-menu" id="fieldStatusMenu" role="listbox">${stateItems}</div>
            </div>
          </div>
          <div class="detail-field detail-field-half">
            <label>Priority</label>
            <div class="detail-select-wrap">
              <button type="button" class="detail-select-trigger" id="fieldPriorityTrigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="detail-select-label">${task.priority}</span>
                <span class="detail-select-chevron" aria-hidden="true">▾</span>
              </button>
              <input type="hidden" id="fieldPriority" value="${task.priority}" />
              <div class="popup-menu detail-select-menu" id="fieldPriorityMenu" role="listbox">${priorityItems}</div>
            </div>
          </div>
        </div>

        <div class="detail-row">
          <div class="detail-field detail-field-half">
            <label>Assignee</label>
            <input type="text" id="fieldAssignee" value="${this.escapeAttr(task.assignee ?? '')}" placeholder="Unassigned" />
          </div>
          <div class="detail-field detail-field-half">
            <label>Epic</label>
            <input type="text" id="fieldEpic" value="${this.escapeAttr(task.epic ?? '')}" placeholder="None" />
          </div>
        </div>

        <div class="detail-field">
          <label>Tags</label>
          <input type="text" id="fieldTags" value="${this.escapeAttr(task.tags.join(', '))}" placeholder="tag1, tag2" />
        </div>

        <div class="detail-field detail-field-grow">
          <label>Description</label>
          <textarea id="fieldDescription">${descriptionText}</textarea>
        </div>

        ${task.updatedAt ? `<div class="detail-meta">Updated: ${this.escapeHtml(task.updatedAt)}</div>` : ''}

        <div class="detail-actions">
          <button class="editor-btn" id="backBtnBottom">Back</button>
          <button class="editor-btn" id="editorBtn">Locate in File</button>
        </div>
      </div>
    `;

    const script = `
      const taskId = ${JSON.stringify(task.id)};
      let debounceTimer = null;

      // Track last-saved values to avoid no-op saves
      let lastSaved = {
        title: ${JSON.stringify(task.title)},
        priority: ${JSON.stringify(task.priority)},
        assignee: ${JSON.stringify(task.assignee ?? '')},
        epic: ${JSON.stringify(task.epic ?? '')},
        tags: ${JSON.stringify(task.tags.join(', '))},
        description: ${JSON.stringify(task.description)}
      };

      function collectFields() {
        const tagsRaw = document.getElementById('fieldTags').value;
        return {
          type: 'saveTask',
          taskId,
          title: document.getElementById('fieldTitle').value,
          priority: document.getElementById('fieldPriority').value,
          assignee: document.getElementById('fieldAssignee').value,
          epic: document.getElementById('fieldEpic').value,
          tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
          description: document.getElementById('fieldDescription').value
        };
      }

      function isDirty() {
        return (
          document.getElementById('fieldTitle').value !== lastSaved.title ||
          document.getElementById('fieldPriority').value !== lastSaved.priority ||
          document.getElementById('fieldAssignee').value !== lastSaved.assignee ||
          document.getElementById('fieldEpic').value !== lastSaved.epic ||
          document.getElementById('fieldTags').value !== lastSaved.tags ||
          document.getElementById('fieldDescription').value !== lastSaved.description
        );
      }

      function markClean() {
        lastSaved.title = document.getElementById('fieldTitle').value;
        lastSaved.priority = document.getElementById('fieldPriority').value;
        lastSaved.assignee = document.getElementById('fieldAssignee').value;
        lastSaved.epic = document.getElementById('fieldEpic').value;
        lastSaved.tags = document.getElementById('fieldTags').value;
        lastSaved.description = document.getElementById('fieldDescription').value;
      }

      function saveNow() {
        clearTimeout(debounceTimer);
        if (!isDirty()) return;
        markClean();
        vscode.postMessage(collectFields());
      }

      function debouncedSave() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!isDirty()) return;
          markClean();
          vscode.postMessage(collectFields());
        }, 800);
      }

      // Auto-save: debounced for text inputs, immediate for dropdowns
      ['fieldTitle', 'fieldTags', 'fieldAssignee', 'fieldEpic', 'fieldDescription'].forEach(id => {
        document.getElementById(id).addEventListener('input', debouncedSave);
      });

      function closeAllDetailMenus() {
        document.querySelectorAll('.detail-select-menu.open').forEach((m) => m.classList.remove('open'));
        document.querySelectorAll('.detail-select-trigger').forEach((t) => t.setAttribute('aria-expanded', 'false'));
      }

      function setupDetailSelect(triggerId, menuId, hiddenId, onPick) {
        const trigger = document.getElementById(triggerId);
        const menu = document.getElementById(menuId);
        const hidden = document.getElementById(hiddenId);
        const labelEl = trigger.querySelector('.detail-select-label');

        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = menu.classList.contains('open');
          closeAllDetailMenus();
          if (!isOpen) {
            menu.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
          }
        });

        menu.querySelectorAll('.popup-item').forEach((item) => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = item.dataset.value;
            hidden.value = val;
            labelEl.textContent = val;
            menu.querySelectorAll('.popup-item').forEach((i) => {
              i.classList.toggle('active', i.dataset.value === val);
            });
            closeAllDetailMenus();
            onPick(val);
          });
        });
      }

      document.addEventListener('click', () => closeAllDetailMenus());

      setupDetailSelect('fieldStatusTrigger', 'fieldStatusMenu', 'fieldStatus', (val) => {
        vscode.postMessage({ type: 'changeStatus', taskId, targetState: val });
      });

      setupDetailSelect('fieldPriorityTrigger', 'fieldPriorityMenu', 'fieldPriority', () => {
        saveNow();
      });

      // Back always works — fields are auto-saved
      document.getElementById('backBtn').addEventListener('click', () => {
        saveNow();
        vscode.postMessage({ type: 'backToList' });
      });



      document.getElementById('editorBtn').addEventListener('click', () => {
        vscode.postMessage({ type: 'openInEditor', taskId });
      });

      document.getElementById('aiBtnTop').addEventListener('click', () => {
        vscode.postMessage({ type: 'implementWithAi', taskId });
      });

      document.getElementById('backBtnBottom').addEventListener('click', () => {
        saveNow();
        vscode.postMessage({ type: 'backToList' });
      });

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="openParseWarningFile"], [data-action="dismissParseWarnings"]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'openParseWarningFile') {
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
    `;

    const extraStyles = `
      <style>
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        body {
          padding: 8px;
          display: flex;
          flex-direction: column;
        }
        .detail-view {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-height: 0;
        }
        .back-btn {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.9em;
          padding: 2px 0;
          text-align: left;
          width: fit-content;
        }
        .back-btn:hover {
          text-decoration: underline;
        }
        .detail-field {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .detail-field label {
          font-size: 0.8em;
          font-weight: 500;
          color: var(--muted-fg);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-field input,
        .detail-field select,
        .detail-field textarea {
          width: 100%;
        }
        .detail-field textarea {
          resize: vertical;
          min-height: 80px;
          font-family: inherit;
          font-size: inherit;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border, var(--card-border));
          padding: 4px 8px;
          border-radius: 3px;
        }
        .detail-field textarea:focus {
          outline: 1px solid var(--accent);
        }
        .detail-field-grow {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .detail-field-grow textarea {
          flex: 1;
          min-height: 80px;
        }
        .detail-row {
          display: flex;
          gap: 8px;
        }
        .detail-field-half {
          flex: 1;
          min-width: 0;
        }
        .detail-select-wrap {
          position: relative;
          width: 100%;
        }
        .detail-select-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: var(--vscode-dropdown-background);
          color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
          border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border, var(--card-border)));
          padding: 4px 8px;
          border-radius: 3px;
          font-family: inherit;
          font-size: inherit;
          cursor: pointer;
          text-align: left;
        }
        .detail-select-trigger:hover {
          background: var(--vscode-list-hoverBackground);
        }
        .detail-select-trigger:focus-visible {
          outline: 1px solid var(--accent);
        }
        .detail-select-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .detail-select-chevron {
          flex-shrink: 0;
          opacity: 0.7;
          font-size: 0.85em;
        }
        .popup-menu {
          display: none;
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 1000;
          background: var(--vscode-dropdown-background);
          color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
          border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border, var(--card-border)));
          border-radius: 4px;
          padding: 4px 0;
          font-family: inherit;
          font-size: inherit;
          box-shadow: var(--vscode-widget-shadow, none);
        }
        .popup-menu.open {
          display: block;
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
          background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
          color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
        }
        .detail-meta {
          font-size: 0.8em;
          color: var(--muted-fg);
        }
        .detail-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding-top: 4px;
          border-top: 1px solid var(--card-border);
        }
        .ai-hero-btn {
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95em;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          width: 100%;
          justify-content: center;
          margin-bottom: 4px;
        }
        .ai-hero-btn:hover {
          background: linear-gradient(135deg, #db2777, #7c3aed);
        }
        .editor-btn {
          background: #3c3c3c;
          color: #cccccc;
          border: 1px solid #555;
          padding: 5px 14px;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.85em;
        }
        .editor-btn:hover {
          background: #4a4a4a;
        }
        .detail-readonly {
          font-size: 0.9em;
          color: var(--muted-fg);
          padding: 6px 0 2px;
        }
        .parse-warning-banner {
          border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-border));
          background: var(--vscode-inputValidation-warningBackground, rgba(255, 204, 0, 0.12));
          color: var(--vscode-editorWarning-foreground, var(--vscode-editorWarning-foreground));
          border-radius: 4px;
          padding: 8px 10px;
          margin-bottom: 8px;
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

    return getWebviewHtml(this.view!.webview, 'Tasks', extraStyles + body, script);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private collectAvailableTags(configTags: string[], tasksByState: Map<string, Task[]>): string[] {
    const tags = new Set<string>(configTags);
    for (const tasks of tasksByState.values()) {
      for (const task of tasks) {
        for (const tag of task.tags) {
          tags.add(tag);
        }
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
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
}
