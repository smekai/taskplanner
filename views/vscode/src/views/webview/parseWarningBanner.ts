import { ParseIssue } from '../../../../../src/core/model/parseResult.js';
import { escapeAttr, escapeHtml } from './htmlEscape.js';

export interface FileWarnings {
  fileName: string;
  warnings: ParseIssue[];
}

export function parseWarningBanner(grouped: FileWarnings[]): string {
  if (grouped.length === 0) {
    return '';
  }

  const rows = grouped
    .map(({ fileName, warnings }) => {
      const [first] = warnings;
      if (!first) return '';
      const summary =
        warnings.length === 1
          ? `Line ${first.line}: ${escapeHtml(first.message)}`
          : `${warnings.length} issues (first at line ${first.line})`;
      return `
      <div class="parse-warning-row">
        <span class="parse-warning-file">${escapeHtml(fileName)}</span>
        <span class="parse-warning-msg">${summary}</span>
        <button type="button" class="parse-warning-open" data-action="openParseWarningFile" data-file-name="${escapeAttr(fileName)}" data-line="${first.line}">Open</button>
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
