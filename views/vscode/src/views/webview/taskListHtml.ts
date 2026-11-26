import * as vscode from 'vscode';
import { Task } from '../../../../../src/core/model/task.js';
import { TaskState } from '../../../../../src/core/model/state.js';
import { TaskListSortBy } from '../../../../../src/core/filter/taskFilter.js';
import {
  GROUP_BY_VALUES,
  GroupBy,
  GroupViewData,
  TaskFilter,
  TaskViewItem,
} from '../../../../../src/core/model/messages.js';
import { getWebviewHtml } from './webviewHelper.js';
import { scriptJson } from './scriptJson.js';
import { escapeAttr, escapeHtml } from './htmlEscape.js';

export interface TaskListPage {
  webview: vscode.Webview;
  groups: GroupViewData[];
  groupBy: string;
  states: TaskState[];
  configTags: string[];
  tasksByState: Map<string, Task[]>;
  filter: TaskFilter;
  sortBy: TaskListSortBy;
  toggledGroups: ReadonlySet<string>;
  parseWarningBanner: string;
}

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  status: 'Status',
  assignee: 'Assignee',
  epic: 'Epic',
  date: 'Date',
  none: 'No grouping',
};

export function welcomeHtml(webview: vscode.Webview): string {
  const body = `
      <div class="welcome">
        <p>No TaskPlanner project found in this workspace.</p>
        <button class="welcome-btn" data-command="taskplanner.init">Initialize Project</button>
        <button class="welcome-btn" data-command="taskplanner.setup">Setup</button>
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

  const script = `
      document.querySelectorAll('[data-command]').forEach((button) => {
        button.addEventListener('click', () => {
          vscode.postMessage({ type: 'command', command: button.dataset.command });
        });
      });
    `;

  return getWebviewHtml(webview, 'Tasks', extraStyles + body, script);
}

export function taskListHtml(page: TaskListPage): string {
  const {
    webview,
    groups,
    groupBy,
    states,
    configTags,
    tasksByState,
    filter,
    sortBy,
    parseWarningBanner,
  } = page;
  const availableTags = collectAvailableTags(configTags, tasksByState);
  const statusFilterItems = [
    { value: '', label: 'All statuses' },
    ...states.map((s) => ({ value: s.name, label: s.name })),
  ]
    .map((o) => {
      const isActive = o.value === '' ? !filter.status : filter.status === o.value;
      return `<div class="popup-item${isActive ? ' active' : ''}" data-action="setStatus" data-value="${escapeAttr(o.value)}">${o.label}</div>`;
    })
    .join('\n');

  const tagFilterItems = [
    { value: '', label: 'All tags' },
    ...availableTags.map((tag) => ({ value: tag, label: tag })),
  ]
    .map((o) => {
      const isActive = o.value === '' ? !filter.tag : filter.tag === o.value;
      return `<div class="popup-item${isActive ? ' active' : ''}" data-action="setTag" data-value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</div>`;
    })
    .join('\n');

  const groupByItems = GROUP_BY_VALUES.map(
    (value) =>
      `<div class="popup-item${groupBy === value ? ' active' : ''}" data-action="setGroupBy" data-value="${value}">${GROUP_BY_LABELS[value]}</div>`,
  ).join('\n');

  const sortByItems = [
    { value: 'priority', label: 'Priority' },
    { value: 'name', label: 'Name' },
    { value: 'id', label: 'ID' },
    { value: 'file', label: 'File order' },
  ]
    .map(
      (o) =>
        `<div class="popup-item${sortBy === o.value ? ' active' : ''}" data-action="setSortBy" data-value="${o.value}">${o.label}</div>`,
    )
    .join('\n');

  const filterBar = `
      <div class="filter-bar">
        <div class="filter-search-row">
          <input type="text" id="queryFilter" placeholder="Search..."
            value="${escapeAttr(filter.query ?? '')}" />
        </div>
        <div class="filter-controls">
          <div class="icon-btn-wrap">
            <button class="icon-btn${groupBy !== 'status' ? ' icon-btn-active' : ''}" id="groupByBtn" title="Group by: ${escapeAttr(groupBy)}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v1H1zm0 4h10v1H1zm0 4h14v1H1zm0-2h10v1H1z"/></svg>
            </button>
            <div class="popup-menu" id="groupByMenu">
              <div class="popup-label">Group by</div>
              ${groupByItems}
            </div>
          </div>
          <div class="icon-btn-wrap">
            <button class="icon-btn${sortBy !== 'priority' ? ' icon-btn-active' : ''}" id="sortByBtn" title="Sort by: ${escapeAttr(sortBy)}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1l3 4H4v6h2l-3 4-3-4h2V5H0l3-4zm6 1h7v2H9V2zm0 4h5v2H9V6zm0 4h3v2H9v-2z"/></svg>
            </button>
            <div class="popup-menu" id="sortByMenu">
              <div class="popup-label">Sort by</div>
              ${sortByItems}
            </div>
          </div>
          <div class="icon-btn-wrap">
            <button class="icon-btn${filter.tag ? ' icon-btn-active' : ''}" id="tagBtn" title="Tag: ${escapeAttr(filter.tag ?? 'All tags')}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h5.5l1 1H14v8.5l-1 1H2V2zm1 1v7h7.8l.7-.7V4.5l-.7-.7H7.5L6.5 3H3zm2.5 2.5a1 1 0 100 2 1 1 0 000-2z"/></svg>
            </button>
            <div class="popup-menu" id="tagMenu">
              <div class="popup-label">Tag</div>
              ${tagFilterItems}
            </div>
          </div>
          <div class="icon-btn-wrap">
            <button class="icon-btn${filter.status ? ' icon-btn-active' : ''}" id="statusBtn" title="Status: ${escapeAttr(filter.status ?? 'All statuses')}">
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

  const sections = groups.map((g) => groupSection(g, page)).join('\n');

  const body = `
      ${filterBar}
      ${parseWarningBanner}
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

      let currentGroupBy = ${scriptJson(groupBy)};
      let currentSortBy = ${scriptJson(sortBy)};
      let currentStatus = ${scriptJson(filter.status ?? '')};
      let currentTag = ${scriptJson(filter.tag ?? '')};
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

  return getWebviewHtml(webview, 'Tasks', extraStyles + body, script);
}

function groupSection(
  group: GroupViewData,
  { groupBy, filter, toggledGroups }: TaskListPage,
): string {
  const userToggled = toggledGroups.has(group.label);
  const isHidden = !!group.collapsed !== userToggled && !filter.query;
  const chevronClass = isHidden ? 'group-chevron collapsed' : 'group-chevron';
  const tasksClass = isHidden ? 'group-tasks hidden' : 'group-tasks';
  const dndByStatus = groupBy === 'status';
  const stateAttr = dndByStatus ? ` data-state-name="${escapeAttr(group.label)}"` : '';

  const cards = group.tasks.map((t) => taskCard(t, dndByStatus)).join('\n');
  const showMore = group.hasMore
    ? `<div class="show-more" data-action="showAll" data-group-label="${escapeAttr(group.label)}">Showing ${group.tasks.length} of ${group.totalCount} — Show all</div>`
    : '';

  const empty =
    group.tasks.length === 0 && !filter.query ? '<div class="empty-state">No tasks</div>' : '';

  const headerDndClass = dndByStatus ? ' group-header-dnd' : '';
  const headerStateAttr = dndByStatus ? ` data-state-name="${escapeAttr(group.label)}"` : '';
  const headerCollapsedAttr = dndByStatus ? ` data-collapsed="${isHidden ? 'true' : 'false'}"` : '';

  return `
      <div class="group-section">
        <div class="group-header${headerDndClass}" data-action="toggleGroup" data-group-label="${escapeAttr(group.label)}"${headerStateAttr}${headerCollapsedAttr}>
          <span class="${chevronClass}">&#9660;</span>
          <h2>${escapeHtml(group.label)} <span class="count-badge">(${group.totalCount})</span></h2>
        </div>
        <div class="${tasksClass}"${stateAttr}>
          ${cards}
          ${empty}
          ${showMore}
        </div>
      </div>
    `;
}

function taskCard(task: TaskViewItem, draggable: boolean): string {
  const tags = task.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  const metaParts: string[] = [];
  if (task.repeats) {
    metaParts.push(
      `<span class="task-meta-item" title="Repeats (UTC)">&#128257; ${escapeHtml(task.repeats)}${task.due ? ' · <strong>due</strong>' : ''}</span>`,
    );
  }
  if (task.assignee) {
    metaParts.push(`<span class="task-meta-item">&#128100; ${escapeHtml(task.assignee)}</span>`);
  }
  if (task.updatedAt) {
    metaParts.push(`<span class="task-meta-item">&#128339; ${escapeHtml(task.updatedAt)}</span>`);
  }
  const metaHtml = metaParts.length > 0 ? `<div class="task-meta">${metaParts.join('')}</div>` : '';

  const dragAttr = draggable ? ' draggable="true"' : '';
  return `
      <div class="task-card" data-action="viewTask" data-task-id="${task.id}"${dragAttr}>
        <div class="priority-bar priority-${task.priority}"></div>
        <div class="task-content">
          <div class="task-header">
            <span class="task-id">${task.id}</span>
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>
          ${tags ? `<div class="task-tags">${tags}</div>` : ''}
          ${metaHtml}
        </div>
        <button type="button" class="card-ai-btn" draggable="false" data-action="implementWithAi" data-task-id="${task.id}" title="Implement with AI"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5Z" fill="#ec4899"/><path d="M12.5 0l.75 2.25L15.5 3l-2.25.75L12.5 6l-.75-2.25L9.5 3l2.25-.75Z" fill="#8b5cf6" opacity="0.8"/></svg></button>
      </div>
    `;
}

function collectAvailableTags(configTags: string[], tasksByState: Map<string, Task[]>): string[] {
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
