# Codex Plugins Directory Submission

TaskPlanner 2.0.1 is prepared as a **Skills only** submission. Upload the directory produced by `npm run package:codex-skills`; do not submit the Git-backed local MCP server because the public package intentionally works through direct repository file operations.

The final listing copy, three starter prompts, release notes, and exactly five positive plus three negative reviewer cases are stored in [`codex-submission/submission.json`](../codex-submission/submission.json). Public legal pages are [`PRIVACY.md`](../PRIVACY.md) and [`TERMS.md`](../TERMS.md).

## Portal checklist

1. Ensure the submitting OpenAI Platform organization grants the submitter **Apps Management: Write** and has verified the `Fedor Novikov` developer identity.
2. Run `npm run release:check` and `npm run package:codex-skills` from the verified `v2.0.1` source.
3. Open the [OpenAI plugin portal](https://platform.openai.com/plugins), create a **Skills only** draft, and copy the listing fields from `submission.json`.
4. Upload the generated `dist/taskplanner-codex-skills-2.0.1` skill tree, add its starter prompts and reviewer cases, and select supported availability.
5. Complete policy attestations, submit for review, and publish only after approval.

The package follows OpenAI's official [plugin build](https://learn.chatgpt.com/docs/build-plugins) and [submission](https://learn.chatgpt.com/docs/submit-plugins) guidance. No test account or credentials are required.
