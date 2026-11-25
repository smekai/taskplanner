---
name: code-quality
description: Analyse and improve TaskPlanner's code against its standard without changing behaviour - the A1-A9 code rules (comments as a smell, SOLID, fat domain and thin edges, named shapes, strict types, evidence in Markdown), simplicity (smallest change, replace don't accumulate), the AAAAA testing rules, measurements and the board invariants; rank findings, then fix them in small verified steps. Use for a quality pass before a release, a tech-debt review, reviewing a diff against the standard, or when asked to analyse, clean up or improve the code of this repository.
---

# Code quality pass for TaskPlanner

Two phases with a checkpoint between them: **analyse** (read-only, ends in a ranked report), then **improve** (only what the user accepted, behaviour unchanged). Never mix them: a report written while editing hides what was found.

The yardstick is two documents next to this file. Read both before analysing:

- [standard.md](standard.md): simplicity first (smallest correct change, replace don't accumulate), then A1–A9: comments are a smell, SOLID and interfaces, fat domain and thin edges, named shapes, strict types, evidence in Markdown, judged by tier; plus errors and cross-platform.
- [testing.md](testing.md): AAAAA phases, one action per test, no logic in a test body, generators over flag factories, component tests first, the mutation check.

Every finding names the rule it breaks (`A3`, `A6`, `T: one action`, `simplicity`), so the report reads as a standard applied rather than a list of opinions.

Scope by default is everything since the last release tag (`git describe --tags --abbrev=0`), plus any hotspot the measurements point at. Built files are never in scope: `dist/`, `mcp/dist/`, `views/*/dist/`, `views/claude/hooks/register.js`, `views/*/ui/`.

## Rules that are not findings

These are deliberate in this repo. Do not report them, and do not "fix" them:

- **Duplication between harnesses** (`mcp/`, `views/vscode/`, `views/mcp-app/`, `views/claude/mod/`): a harness imports only `src/core/` and itself, and copying is the accepted price. Only duplication *inside* one harness or inside core counts.
- **Exports from `src/core/index.ts`** are the public API of `@smekai/taskplanner`. An export with no caller in the repo is not dead code.
- **No comments** in `src/`, `mcp/src/`, `views/vscode/src/`, `views/mcp-app/`, `views/claude/mod/src/`, except `WHY:` lines; tests may comment. Follow `comment-hygiene`.
- **The hand-written date and cron code** (`src/core/util/time.ts`, `cron.ts`) was chosen over libraries for bundle size (TASK-087); TASK-059 owns the Luxon question.

## Phase 1: analyse

### 1. Baseline (stop if red)

```bash
npm run build && npm run typecheck && npm test && npm run lint
```

Record the test count and the bundle sizes, so phase 2 can prove it did not grow them:

```bash
wc -c dist/extension.js mcp/dist/mcp-server.js views/claude/hooks/register.js
```

### 2. Measure

Run these from the repo root in a POSIX shell (Git Bash on Windows). knip, jscpd and madge are not dependencies: `npx -y` downloads them from npm, so ask the user before the first run and skip any they decline (say so in the report). Do not add them to `package.json`.

Unused locals and parameters. Real findings, except `_`-prefixed parameters:

```bash
npx tsc -p tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
```

Unused files, exports and dependencies. Filter out core's public API and the entry points in `esbuild.js`:

```bash
npx -y knip --no-progress
```

Duplication. Keep only clones whose two sides are in the same harness, or both in core:

```bash
npx -y jscpd src mcp/src views --min-lines 8 --ignore "**/dist/**,**/ui/**,**/*.js" --reporters console
```

Complexity. Candidates, not verdicts: a long `switch` can be fine:

```bash
npx eslint src mcp/src views/vscode/src views/claude/mod/src views/mcp-app --ext ts \
  --rule "complexity: [warn, 12]" --rule "max-depth: [warn, 4]" \
  --rule "max-lines-per-function: [warn, 80]" --rule "max-params: [warn, 4]"
```

Import cycles. Every cycle is a finding:

```bash
npx -y madge --circular --extensions ts src mcp/src views/vscode/src views/claude/mod/src
```

Type escapes. Each needs a reason; tests are lenient:

```bash
git grep -nE "as any|: any\b|as unknown as|@ts-(ignore|expect-error)|eslint-disable" -- "*.ts" ":!**/dist/**"
```

Hotspots: large files, and files changed most often. Large and often changed is where debt costs most:

```bash
git ls-files "*.ts" ":!**/dist/**" | xargs wc -l | sort -n | tail -15
git log --since="3 months ago" --name-only --format= -- "*.ts" | sort | uniq -c | sort -rn | head -15
```

Coverage, when the change touched core logic (this also installs a package, so ask first): `npm i --no-save @vitest/coverage-v8@$(node -p "require('vitest/package.json').version")` then `node scripts/run-vitest.js run --coverage --coverage.include=src/core`. Report untested branches in parser, serializer, store and cron, not a percentage.

### 3. Check the project invariants

Read the code; grep finds the candidates:

- **Dates are UTC and only `src/core/util/time.ts` formats or parses them.** `git grep -nE "toISOString|getHours|getDate\(|toLocale|Date\.parse" -- src mcp/src views` outside `time.ts` and `cron.ts`. A `now = new Date()` default parameter is fine.
- **Board files are written atomically.** `git grep -n "writeFileSync" -- src/core` outside `atomicWrite.ts`: each must be a config or a first-time file, never a state file.
- **Byte identity.** Any parser or serializer change keeps `test/core/roundTrip.test.ts` passing, and a new task field is in `sameTask` (`taskSerializer.ts`).
- **State names hard-coded** (`'Done'`, `'Rejected'`, `'Backlog'`, `'In Progress'`, `'Recurring'`): `git grep -nE "'(Done|Rejected|Backlog|Next|In Progress|Recurring)'" -- src mcp/src views ":!**/dist/**"`. A literal repeated across a file or a harness should be one constant; custom state lists must still work.
- **Harness boundaries** are enforced by lint; also check that `src/core/` has no `process.env`, console output, or host-specific paths.
- **Errors reach the user.** A `catch` that swallows silently in a write path is a finding.

### 4. Read the code against the standard

The measurements find candidates; this pass finds what no tool sees. Go through the diff since the last tag, then the hotspots, and answer each rule of [standard.md](standard.md) and [testing.md](testing.md) for them. Typical findings here:

- **A1:** a `WHY:` that explains a design choice instead of local logic, so it moves to the task's Plan or a `CLAUDE.md`; a comment that a rename would make redundant. List them with `git grep -n "WHY:" -- src mcp/src views ":!**/dist/**"`.
- **A3:** a rule about tasks decided in a harness (MCP handler, webview, mod) instead of core.
- **A6:** a repeated literal, an unnamed payload or options shape.
- **A7:** a cast past a real gap; a boundary parsed twice.
- **Simplicity:** an abstraction with one caller, an option nobody uses, an old path left beside its replacement.
- **Tests:** a loop or `if` in a test body, several actions in one test, a flag-driven fixture, a test that survives breaking the rule it names.

### 5. Review the release diff for behaviour

Run `/code-review` on `git diff <last tag>...HEAD` for correctness, and `/simplify` for reuse and simplification candidates. Take their findings into the same report; do not let them edit yet.

### 6. Report

Write the ranked findings into the task's `### Plan` (TaskPlanner tools), most valuable first. One line each: **rule, file:line, what, why it costs, proposed fix, effort S/M/L**. Group them as:

1. **Fix before release:** correctness risks, invariant breaks, a domain rule in an edge (A3), cycles, untested core branches.
2. **Worth it now:** dead code, an old path beside its replacement, duplication inside a harness, a hotspot that is both large and churning, tests that break the testing rules in code this release touched.
3. **Later:** becomes a Backlog task (`taskplanner_create`, epic left empty), not silently dropped. Large reshapes (splitting a 1600-line webview, a lint rule against logic in test bodies) usually land here.

Stop here and ask the user which groups to do.

## Phase 2: improve

- One finding (or one tight group) per commit. The commit message says what got simpler, not "refactor".
- Smallest correct change, and replace rather than accumulate: a fix that moves logic deletes it from where it was, with its now-redundant tests. Account for the net line count of each commit.
- Behaviour stays the same: no new features, no board format change, no public API change in `src/core/index.ts` (a removal there is a breaking change and needs its own task).
- Before refactoring code with no test, add one written to [testing.md](testing.md) and mutation-check it. A test you touch is brought up to that standard.
- After each commit: `npm run build && npm run typecheck && npm test && npm run lint`, plus `npm run smoke:mcp-server` when `mcp/` or core changed.
- At the end, compare with the baseline: the same or more meaningful tests (a deleted worthless test is fine; say which), bundle sizes not larger (say so if one is), lint warnings not more.
- A decision worth defending later goes to the task's Plan and the WORK_LOG `**Decisions:**` line (A8), not into a comment.
- Trim the task's `### Plan` to what was done and what was deferred (with the task IDs created for it), and add a CHANGELOG line only if users notice something (for example a smaller bundle or a fixed edge case).
