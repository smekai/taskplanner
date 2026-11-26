import * as vscode from 'vscode';
import { Task, Priority } from '../../../../../src/core/model/task.js';
import { TaskState } from '../../../../../src/core/model/state.js';
import { getWebviewHtml } from './webviewHelper.js';
import { scriptJson } from './scriptJson.js';
import { escapeAttr, escapeHtml } from './htmlEscape.js';

export interface TaskDetailPage {
  webview: vscode.Webview;
  task: Task;
  stateName: string;
  states: TaskState[];
  parseWarningBanner: string;
}

export function taskDetailHtml({
  webview,
  task,
  stateName,
  states,
  parseWarningBanner,
}: TaskDetailPage): string {
  const stateItems = states
    .map(
      (s) =>
        `<div class="popup-item${s.name === stateName ? ' active' : ''}" data-value="${escapeAttr(s.name)}">${escapeHtml(s.name)}</div>`,
    )
    .join('\n');

  const priorityItems = Object.values(Priority)
    .map(
      (p) =>
        `<div class="popup-item${p === task.priority ? ' active' : ''}" data-value="${p}">${p}</div>`,
    )
    .join('\n');

  const descriptionText = escapeHtml(task.description);

  const body = `
      <div class="detail-view">
        <button class="back-btn" id="backBtn">&#8592; Back</button>
        ${parseWarningBanner}

        <button class="ai-hero-btn" id="aiBtnTop"><svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px;margin-right:6px"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5Z" fill="#fff"/><path d="M12.5 0l.75 2.25L15.5 3l-2.25.75L12.5 6l-.75-2.25L9.5 3l2.25-.75Z" fill="#fff" opacity="0.7"/></svg>Build with AI</button>

        <div class="detail-field">
          <label>ID</label>
          <div class="detail-readonly">${escapeHtml(task.id)}</div>
        </div>

        <div class="detail-field">
          <label>Title</label>
          <input type="text" id="fieldTitle" value="${escapeAttr(task.title)}" />
        </div>

        <div class="detail-row">
          <div class="detail-field detail-field-half">
            <label>Status</label>
            <div class="detail-select-wrap">
              <button type="button" class="detail-select-trigger" id="fieldStatusTrigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="detail-select-label">${escapeHtml(stateName)}</span>
                <span class="detail-select-chevron" aria-hidden="true">▾</span>
              </button>
              <input type="hidden" id="fieldStatus" value="${escapeAttr(stateName)}" />
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
            <input type="text" id="fieldAssignee" value="${escapeAttr(task.assignee ?? '')}" placeholder="Unassigned" />
          </div>
          <div class="detail-field detail-field-half">
            <label>Epic</label>
            <input type="text" id="fieldEpic" value="${escapeAttr(task.epic ?? '')}" placeholder="None" />
          </div>
        </div>

        <div class="detail-field">
          <label>Tags</label>
          <input type="text" id="fieldTags" value="${escapeAttr(task.tags.join(', '))}" placeholder="tag1, tag2" />
        </div>

        <div class="detail-field">
          <label>Repeats (cron, UTC)</label>
          <input type="text" id="fieldRepeats" value="${escapeAttr(task.repeats ?? '')}" placeholder="Not recurring, e.g. 0 7 * * * or @daily" />
        </div>
        ${runHistory(task)}

        <div class="detail-field detail-field-grow">
          <label>Description</label>
          <textarea id="fieldDescription">${descriptionText}</textarea>
        </div>

        ${task.updatedAt ? `<div class="detail-meta">Updated: ${escapeHtml(task.updatedAt)}</div>` : ''}

        <div class="detail-actions">
          <button class="editor-btn" id="backBtnBottom">Back</button>
          <button class="editor-btn" id="editorBtn">Locate in File</button>
        </div>
      </div>
    `;

  const script = `
      const taskId = ${scriptJson(task.id)};
      let debounceTimer = null;

      // Track last-saved values to avoid no-op saves
      let lastSaved = {
        title: ${scriptJson(task.title)},
        priority: ${scriptJson(task.priority)},
        assignee: ${scriptJson(task.assignee ?? '')},
        epic: ${scriptJson(task.epic ?? '')},
        tags: ${scriptJson(task.tags.join(', '))},
        description: ${scriptJson(task.description)}
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
      document.getElementById('fieldRepeats').addEventListener('change', (event) => {
        vscode.postMessage({ type: 'saveTask', taskId, repeats: event.target.value });
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
.detail-runs {
          margin: 2px 0 0;
          padding-left: 18px;
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
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

  return getWebviewHtml(webview, 'Tasks', extraStyles + body, script);
}

function runHistory(task: Task): string {
  const runs = task.runs ?? [];
  if (!task.lastRun && runs.length === 0) return '';
  const lastRun = task.lastRun
    ? `<div class="detail-meta">Last run: ${escapeHtml(task.lastRun)} UTC</div>`
    : '';
  const items = runs.map((run) => `<li>${escapeHtml(run)}</li>`).join('');
  const history = items
    ? `<div class="detail-field"><label>Runs</label><ul class="detail-runs">${items}</ul></div>`
    : '';
  return `${lastRun}${history}`;
}
