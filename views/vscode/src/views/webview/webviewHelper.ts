import * as vscode from 'vscode';
import { randomBytes } from 'crypto';

export function getNonce(): string {
  return randomBytes(16).toString('hex');
}

export function getWebviewHtml(
  webview: vscode.Webview,
  title: string,
  bodyHtml: string,
  scriptJs: string,
): string {
  const nonce = getNonce();
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --card-bg: var(--vscode-editor-background);
      --card-border: var(--vscode-widget-border, var(--vscode-editorGroup-border));
      --card-hover: var(--vscode-list-hoverBackground);
      --header-fg: var(--vscode-foreground);
      --muted-fg: var(--vscode-descriptionForeground);
      --accent: var(--vscode-focusBorder);
      --p0-color: #9b59b6;
      --p1-color: #e74c3c;
      --p2-color: #e67e22;
      --p3-color: #3498db;
      --p4-color: #95a5a6;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
    }

    h1 {
      font-size: 1.4em;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--header-fg);
    }

    h2 {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--header-fg);
    }

    .task-card {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      margin-bottom: 6px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 4px;
      cursor: default;
      transition: background 0.1s;
    }

    .task-card:hover {
      background: var(--card-hover);
    }

    .priority-bar {
      width: 4px;
      min-height: 32px;
      border-radius: 2px;
      flex-shrink: 0;
      align-self: stretch;
    }

    .priority-P0 { background: var(--p0-color); }
    .priority-P1 { background: var(--p1-color); }
    .priority-P2 { background: var(--p2-color); }
    .priority-P3 { background: var(--p3-color); }
    .priority-P4 { background: var(--p4-color); }

    .task-content {
      flex: 1;
      min-width: 0;
    }

    .task-header {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .task-id {
      font-weight: 600;
      font-size: 0.85em;
      color: var(--muted-fg);
    }

    .task-title {
      font-weight: 500;
      word-break: break-word;
    }

    .task-tags {
      display: flex;
      gap: 4px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    .tag {
      font-size: 0.75em;
      padding: 1px 6px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .task-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .task-card:hover .task-actions {
      opacity: 1;
    }

    .action-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.8em;
      cursor: pointer;
    }

    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }


    select, input[type="text"] {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--card-border));
      padding: 4px 8px;
      border-radius: 3px;
      font-family: inherit;
      font-size: inherit;
    }

    select:focus, input[type="text"]:focus {
      outline: 1px solid var(--accent);
    }

    .show-more {
      text-align: center;
      padding: 8px;
      color: var(--accent);
      cursor: pointer;
      font-size: 0.85em;
    }

    .show-more:hover {
      text-decoration: underline;
    }

    .empty-state {
      color: var(--muted-fg);
      font-style: italic;
      padding: 12px 0;
    }

    .count-badge {
      font-size: 0.8em;
      color: var(--muted-fg);
      font-weight: normal;
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    ${scriptJs}
  </script>
</body>
</html>`;
}
