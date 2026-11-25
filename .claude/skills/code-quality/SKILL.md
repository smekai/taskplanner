---
name: code-quality
description: TaskPlanner's code standard and its quality pass. The standard - simplicity first (smallest correct change, replace don't accumulate), the A1-A9 code rules (comments as a smell, SOLID, fat domain and thin edges, named shapes, strict types, evidence in Markdown) and the AAAAA testing rules - applies whenever code or tests are written, refactored or reviewed in this repository. The pass measures the code against it, ranks findings and fixes them in small behaviour-preserving steps; use it before a release, for a tech-debt review, or when asked to analyse, clean up or improve the code.
---

# TaskPlanner code standard and quality pass

One standard, used two ways:

- **Writing or reviewing code and tests:** follow Part 1 and Part 2. Every change should trace to a rule there.
- **A quality pass** (before a release, a tech-debt review): Part 3 measures the code against Parts 1 and 2, ranks the findings and fixes the accepted ones.

The rule ids (A1–A9) and the testing rules come from the Isotopy standard and keep their numbers, so a finding reads the same in both repositories.

## Part 1 — The code standard

Each rule says what it means here and where to look.

### Simplicity first

These two govern every other rule, in analysis and in fixes:

- **Smallest correct change.** Solve exactly what the finding needs and bring the code you touch up to the standard. No repo-wide rewrite, no speculative abstraction, no option nobody asked for. A rule that would need a framework to satisfy is a finding to report, not a framework to build.
- **Replace, don't accumulate.** A new approach deletes the old one in the same change: its code, its tests and its docs. A `new ?? old` fallback, an adapter between two models, or an `A | B` parameter with a cast is the alarm that two things should have been one. Before calling a change done, look at its net line count: a capability may add lines, a *replacement* that adds lines means the old thing is still there.

### A1 — Comments are a smell

A function that needs a comment is badly named or badly factored: rename or extract first. Source files carry almost no comments (`npm run lint` already fails on them outside tests). The survivors are `WHY:` lines, and a `WHY:` must point at intricate *local* logic right at the line (a regex, a platform quirk, cron's day-field rule). A design rationale is not a `WHY:` — it goes to A8. Tests may explain themselves freely. The detailed keep/remove list is the `comment-hygiene` skill.

### A2 — SOLID; depend on interfaces

One reason to change per module. Receive a dependency rather than importing a concretion where a seam exists: `TaskStore` receives `ConfigManager` and `FileStore` — copy that shape. A module doing two jobs is split along the axis that changes independently. No barrel files beyond the public entry `src/core/index.ts`; callers import the file they need.

### A3 — Fat domain, thin edges

`src/core/` is the domain; the harnesses (`mcp/`, `views/*`) are edges.

- **Pure core:** `model/`, `parser/`, `util/`, `filter/`, `view/`, `ai/` — no I/O.
- **I/O core:** `store/`, `config/` — reading and writing files, nothing else to decide.
- **Edges map, they don't decide.** An MCP tool handler, a webview message handler or a mod hook turns input into a core call and a result into output. A rule about tasks (which state a new task goes to, when a task is due, what a valid schedule is) in a harness is a finding: it belongs in core, where every harness gets it and a test can reach it.

Placement test: does the file name a TaskPlanner concept (task, state, board, run)? If it would make as much sense in another product, it is a util.

### A4 — Long-running work is a workflow

Not applicable today: TaskPlanner has no long-running work. Recurring tasks are deliberately *not* this — an external scheduler runs them and records the result through `taskplanner_record_run`. If a change starts to run, wait for or retry work inside TaskPlanner, stop and raise it.

### A5 — Classes where there is state or a lifecycle

Free functions threading the same mutable state want to be a class that owns it (`TaskStore`, `ConfigManager`). A class with no state is a namespace and should be functions.

### A6 — Name the shapes

Inline object literals that carry structure get a name: a message payload, an options bag, a config blob, a style block in a webview. A literal repeated twice exists once, named — this includes state names (`'Done'`, `'Recurring'`, …) and file names (`'RECURRING.md'`).

### A7 — Lean on the types

- Discriminated unions over stringly-typed state; exhaustive `switch` closed with a `never` assertion.
- No `as` that papers over a real gap, no `as unknown as` in logic. Casting to silence the compiler is the commonest way this rule gets faked.
- Untrusted input is parsed once at a boundary into typed values: `config.json` in `ConfigManager`, board markdown in the parser, MCP input by its zod schema. Code past the boundary does not re-traverse raw records.
- `strict` is on. `noUncheckedIndexedAccess` is not: turning it on is a finding to weigh (cost: every index read narrows), not a silent change.

### A8 — Evidence lives in Markdown

The *why* of a decision goes where it can be read without opening the source: the task's `### Plan` done-summary and the `**Decisions:**` line of its WORK_LOG entry, and for something lasting, the folder's `CLAUDE.md` or `docs/`. If a change needed explaining in the PR description, that explanation belongs there too.

### A9 — Judge a change by its tier

- **Backend** (`src/core/`, `mcp/`): the layering of A3.
- **Frontend** (`views/vscode/src/views/webview/`, `views/mcp-app/`, the Claude pane in `views/claude/mod/`): rendering apart from state and messaging, one module per surface that talks to the host, named payload types, pure view helpers separate from stateful code. Webviews render HTML strings — a 1000-line panel that mixes markup, state and messages is the tier's main finding.

### Errors and cross-platform

- **A `catch` reports or is the answer.** It may stay silent only when the fallback *is* the result (a missing file, a probe that found nothing), narrowed to the expected error. Anything else reaches the user: an MCP `isError`, a VS Code message, a board diagnostic.
- **Windows and macOS:** paths built with `path.join`/`path.resolve`; file names compared case-insensitively where the file system ignores case; no shell-specific syntax in scripts both run; deletes in teardown use `maxRetries` (a closing handle shows up as `EBUSY`).

## Part 2 — The testing standard

It applies to every test written or changed, and a quality pass reports existing tests that break it.

### The phases

1. **Arrange** — initial state: a temp board, a config, a task.
2. **Anticipate** — every external interaction and the input it must receive, declared up front. Here that is rare (the MCP smoke test's server, a VS Code API fake); a test with none has no banner for it.
3. **Act** — one action.
4. **Assert** — return value, the markdown on disk, side effects.
5. **AI** — not a block: the declarative shape is what lets a model read and extend a test without loading the suite.

Mark the phases with `// Arrange`, `// Act`, `// Assert` banners in tests that go through the store, the config or the server. A short test of a pure function (parser, cron, `isDue`) is exempt: banners on a two-line assertion are noise. The hard rules below apply everywhere.

### The rules

- **One action per test.** If a second action is the point, that is a second test.
- **No logic in a test body** — no `if`, `for`, `while`, `try`. A test states *what holds*; loops and polling go in a helper below the tests (`function` declarations hoist), and a table goes in `it.each`.
- **The name states the behavioural rule**, in a sentence, ideally with the reason: "keeps only the latest MAX_RUNS entries" beats "test runs".
- **Assert, never throw.** A guard is an `expect` with a message; narrowing is an `assert` that types the value.

### Fixtures

- **Generators, not flag-driven factories.** A builder takes a partial and fills each field (`task({ repeats: '@daily' })` in `roundTrip.test.ts` is the shape). A factory that grows booleans grows untested branching.
- **Duplication is a boundary, not a smell.** Two tests that arrange almost the same state say so twice rather than share a helper that branches. Share generators and the harness (temp dirs, the smoke client); keep "arrange this exact scenario" inline.
- **An elaborate fixture is a symptom.** A test that arranges something it never asserts on loses the arrangement.
- **Setup every test in a file shares** goes in `beforeEach`; setup for some of them goes in a `describe` with its own.

### Which level

- **Component first:** through the real store, config and files in a temp directory (`taskStore.test.ts`, `configManager.test.ts`), and through the real server over stdio (`scripts/smoke-test-mcp-server.js`). That is where a rule's bug shows.
- **A pure test only for intricate logic** a component test would not localise: the parser, the serializer's byte identity, the cron evaluator. A pure test over a small predicate is converted to a component test.
- Tests live in `test/` (and each view's `test/`), never beside the source.
- A test never touches the developer's real board: always a temp directory, removed with `maxRetries`.

### A test must be able to fail for a real reason

If you cannot name the bug a test would catch, it is not a test. Worthless shapes:

| Anti-pattern | Why |
| --- | --- |
| Asserting a constant back | Fails when a value legitimately changes, never when behaviour breaks |
| Asserting on prose | Assert the value a message names (the task id, the state), not the sentence |
| Covering a one-line delegation | No room for a bug the compiler does not already catch |
| Asserting that two lists agree | Derive one from the other and let the compiler hold it |

A migration keeps its test: it protects boards users already have.

**Mutation check.** For every guard a test claims to cover, break the guard in `src/` and run that subject's tests: one must go red. A test that survives the mutation is not coverage. Deleting a worthless test is a legitimate outcome; weakening an assertion to get green is not.

## Part 3 — The quality pass

Two phases with a checkpoint between them: **analyse** (read-only, ends in a ranked report), then **improve** (only what the user accepted, behaviour unchanged). Never mix them: a report written while editing hides what was found. Every finding names the rule it breaks (`A3 mcp/src/server.ts:430 — …`, `T: one action`, `simplicity`), so the report reads as a standard applied rather than a list of opinions.

Scope by default is everything since the last release tag (`git describe --tags --abbrev=0`), plus any hotspot the measurements point at. Built files are never in scope: `dist/`, `mcp/dist/`, `views/*/dist/`, `views/claude/hooks/register.js`, `views/*/ui/`.

### Rules that are not findings

These are deliberate in this repo. Do not report them, and do not "fix" them:

- **Duplication between harnesses** (`mcp/`, `views/vscode/`, `views/mcp-app/`, `views/claude/mod/`): a harness imports only `src/core/` and itself, and copying is the accepted price. Only duplication *inside* one harness or inside core counts.
- **Exports from `src/core/index.ts`** are the public API of `@smekai/taskplanner`. An export with no caller in the repo is not dead code.
- **No comments** in `src/`, `mcp/src/`, `views/vscode/src/`, `views/mcp-app/`, `views/claude/mod/src/`, except `WHY:` lines; tests may comment. Follow `comment-hygiene`.
- **The hand-written date and cron code** (`src/core/util/time.ts`, `cron.ts`) was chosen over libraries for bundle size (TASK-087); TASK-059 owns the Luxon question.

### Phase 1: analyse

Phase 1 changes no tracked file. Never run `npm run build` in the working tree here: `esbuild.js` rewrites committed files (the plugin bundles in `views/*/dist/`, their `ui/`, and `views/claude/hooks/register.js`). The analysis covers committed `HEAD`, so commit or stash first.

#### 1. Baseline (stop if red)

These only read the tree:

```bash
npm run typecheck && npm test && npm run lint
```

Record the test count, and the bundle sizes from a build in a throwaway worktree of `HEAD`, so phase 2 can prove it did not grow them:

```bash
base="$(mktemp -d)/baseline"
git worktree add --detach "$base" HEAD
(cd "$base" && npm ci && npm run build && wc -c dist/extension.js mcp/dist/mcp-server.js views/claude/hooks/register.js)
git worktree remove --force "$base"
```

#### 2. Measure

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

#### 3. Check the project invariants

Read the code; grep finds the candidates:

- **Dates are UTC and only `src/core/util/time.ts` formats or parses them.** `git grep -nE "toISOString|getHours|getDate\(|toLocale|Date\.parse" -- src mcp/src views` outside `time.ts` and `cron.ts`. A `now = new Date()` default parameter is fine.
- **Board files are written atomically.** `git grep -n "writeFileSync" -- src/core` outside `atomicWrite.ts`: each must be a config or a first-time file, never a state file.
- **Byte identity.** Any parser or serializer change keeps `test/core/roundTrip.test.ts` passing, and a new task field is in `sameTask` (`taskSerializer.ts`).
- **State names hard-coded** (`'Done'`, `'Rejected'`, `'Backlog'`, `'In Progress'`, `'Recurring'`): `git grep -nE "'(Done|Rejected|Backlog|Next|In Progress|Recurring)'" -- src mcp/src views ":!**/dist/**"`. A literal repeated across a file or a harness should be one constant; custom state lists must still work.
- **Harness boundaries** are enforced by lint; also check that `src/core/` has no `process.env`, console output, or host-specific paths.
- **Errors reach the user.** A `catch` that swallows silently in a write path is a finding.

#### 4. Read the code against the standard

The measurements find candidates; this pass finds what no tool sees. Go through the diff since the last tag, then the hotspots, and answer each rule of Parts 1 and 2 for them. Typical findings here:

- **A1:** a `WHY:` that explains a design choice instead of local logic, so it moves to the task's Plan or a `CLAUDE.md`; a comment that a rename would make redundant. List them with `git grep -n "WHY:" -- src mcp/src views ":!**/dist/**"`.
- **A3:** a rule about tasks decided in a harness (MCP handler, webview, mod) instead of core.
- **A6:** a repeated literal, an unnamed payload or options shape.
- **A7:** a cast past a real gap; a boundary parsed twice.
- **Simplicity:** an abstraction with one caller, an option nobody uses, an old path left beside its replacement.
- **Tests:** a loop or `if` in a test body, several actions in one test, a flag-driven fixture, a test that survives breaking the rule it names.

#### 5. Review the release diff for behaviour

Run `/code-review` on `git diff <last tag>...HEAD` for correctness. It only reports unless given `--fix`, so never pass that here. Take its findings into the same report. Simplification candidates come from step 4, not from `/simplify`: that command applies its fixes, so it belongs to phase 2.

#### 6. Report

Write the ranked findings into the task's `### Plan` (TaskPlanner tools), most valuable first. One line each: **rule, file:line, what, why it costs, proposed fix, effort S/M/L**. Group them as:

1. **Fix before release:** correctness risks, invariant breaks, a domain rule in an edge (A3), cycles, untested core branches.
2. **Worth it now:** dead code, an old path beside its replacement, duplication inside a harness, a hotspot that is both large and churning, tests that break the testing rules in code this release touched.
3. **Later:** becomes a Backlog task (`taskplanner_create`, epic left empty), not silently dropped. Large reshapes (splitting a 1600-line webview, a lint rule against logic in test bodies) usually land here.

Stop here and ask the user which groups to do.

### Phase 2: improve

- One finding (or one tight group) per commit. The commit message says what got simpler, not "refactor".
- Smallest correct change, and replace rather than accumulate: a fix that moves logic deletes it from where it was, with its now-redundant tests. Account for the net line count of each commit.
- Behaviour stays the same: no new features, no board format change, no public API change in `src/core/index.ts` (a removal there is a breaking change and needs its own task).
- Before refactoring code with no test, add one written to Part 2 and mutation-check it. A test you touch is brought up to that standard.
- `/simplify` may run here, on the diff of an accepted fix. Its edits are reviewed like any other change and stay within the accepted finding.
- After each commit: `npm run build && npm run typecheck && npm test && npm run lint`, plus `npm run smoke:mcp-server` when `mcp/` or core changed. Here the build belongs in the working tree: the regenerated bundles are committed with the change.
- At the end, compare with the baseline: the same or more meaningful tests (a deleted worthless test is fine; say which), bundle sizes not larger (say so if one is), lint warnings not more.
- A decision worth defending later goes to the task's Plan and the WORK_LOG `**Decisions:**` line (A8), not into a comment.
- Trim the task's `### Plan` to what was done and what was deferred (with the task IDs created for it), and add a CHANGELOG line only if users notice something (for example a smaller bundle or a fixed edge case).
