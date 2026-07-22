# Codex Plugins Directory Submission

TaskPlanner 2.1.1 is prepared as a **Skills only** submission. `npm run package:codex-skills` copies the existing skill tree into one public plugin root with `.codex-plugin/plugin.json`, the referenced brand asset, and no MCP declaration. Do not submit the Git-backed local MCP server because the public package intentionally works through direct repository file operations.

The final listing copy, three starter prompts, release notes, and exactly five positive plus three negative reviewer cases are stored beside the Codex manifest in [`plugins/taskplanner/.codex-plugin/submission.json`](../plugins/taskplanner/.codex-plugin/submission.json). Public legal pages are [`PRIVACY.md`](../PRIVACY.md) and [`TERMS.md`](../TERMS.md).

## Portal checklist

1. Ensure the submitting OpenAI Platform organization grants the submitter **Apps Management: Write** and has verified the `Fedor Novikov` developer identity.
2. Run `npm run release:check` from the verified `v2.1.1` source. The release check packages and validates the public plugin root.
3. Open the [OpenAI plugin portal](https://platform.openai.com/plugins), create a **Skills only** draft, and copy the listing fields from `submission.json`.
4. Compress the contents of `dist/codex/taskplanner-codex-skills-2.1.1` into a ZIP so `.codex-plugin/`, `skills/`, and `assets/` are at the archive root. Upload the ZIP, add its starter prompts and reviewer cases, and select supported availability.
5. Complete policy attestations, submit for review, and publish only after approval.

On Windows, create the upload without adding an extra parent directory:

```powershell
Compress-Archive -Path 'dist\codex\taskplanner-codex-skills-2.1.1\*' -DestinationPath 'dist\codex\taskplanner-codex-skills-2.1.1.zip' -Force
```

The package follows OpenAI's official [plugin build](https://learn.chatgpt.com/docs/build-plugins) and [submission](https://learn.chatgpt.com/docs/submit-plugins) guidance. No test account or credentials are required.
