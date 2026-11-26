import * as vscode from 'vscode';
import * as path from 'path';

export function openTaskFileAtLine(tasksDir: string, fileName: string, line: unknown): void {
  const lineNumber = typeof line === 'number' ? line : 1;
  const uri = vscode.Uri.file(path.join(tasksDir, fileName));
  void vscode.workspace.openTextDocument(uri).then((doc) => {
    void vscode.window.showTextDocument(doc, {
      selection: new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0),
    });
  });
}
