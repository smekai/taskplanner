# The testing standard (AAAAA), applied to TaskPlanner

From the Isotopy testing standard. It applies to every test written or changed in the improvement phase, and the analysis reports existing tests that break it.

## The phases

1. **Arrange** — initial state: a temp board, a config, a task.
2. **Anticipate** — every external interaction and the input it must receive, declared up front. Here that is rare (the MCP smoke test's server, a VS Code API fake); a test with none has no banner for it.
3. **Act** — one action.
4. **Assert** — return value, the markdown on disk, side effects.
5. **AI** — not a block: the declarative shape is what lets a model read and extend a test without loading the suite.

Mark the phases with `// Arrange`, `// Act`, `// Assert` banners in tests that go through the store, the config or the server. A short test of a pure function (parser, cron, `isDue`) is exempt: banners on a two-line assertion are noise. The hard rules below apply everywhere.

## The rules

- **One action per test.** If a second action is the point, that is a second test.
- **No logic in a test body** — no `if`, `for`, `while`, `try`. A test states *what holds*; loops and polling go in a helper below the tests (`function` declarations hoist), and a table goes in `it.each`.
- **The name states the behavioural rule**, in a sentence, ideally with the reason: "keeps only the latest MAX_RUNS entries" beats "test runs".
- **Assert, never throw.** A guard is an `expect` with a message; narrowing is an `assert` that types the value.

## Fixtures

- **Generators, not flag-driven factories.** A builder takes a partial and fills each field (`task({ repeats: '@daily' })` in `roundTrip.test.ts` is the shape). A factory that grows booleans grows untested branching.
- **Duplication is a boundary, not a smell.** Two tests that arrange almost the same state say so twice rather than share a helper that branches. Share generators and the harness (temp dirs, the smoke client); keep "arrange this exact scenario" inline.
- **An elaborate fixture is a symptom.** A test that arranges something it never asserts on loses the arrangement.
- **Setup every test in a file shares** goes in `beforeEach`; setup for some of them goes in a `describe` with its own.

## Which level

- **Component first:** through the real store, config and files in a temp directory (`taskStore.test.ts`, `configManager.test.ts`), and through the real server over stdio (`scripts/smoke-test-mcp-server.js`). That is where a rule's bug shows.
- **A pure test only for intricate logic** a component test would not localise: the parser, the serializer's byte identity, the cron evaluator. A pure test over a small predicate is converted to a component test.
- Tests live in `test/` (and each view's `test/`), never beside the source.
- A test never touches the developer's real board: always a temp directory, removed with `maxRetries`.

## A test must be able to fail for a real reason

If you cannot name the bug a test would catch, it is not a test. Worthless shapes:

| Anti-pattern | Why |
| --- | --- |
| Asserting a constant back | Fails when a value legitimately changes, never when behaviour breaks |
| Asserting on prose | Assert the value a message names (the task id, the state), not the sentence |
| Covering a one-line delegation | No room for a bug the compiler does not already catch |
| Asserting that two lists agree | Derive one from the other and let the compiler hold it |

A migration keeps its test: it protects boards users already have.

**Mutation check.** For every guard a test claims to cover, break the guard in `src/` and run that subject's tests: one must go red. A test that survives the mutation is not coverage. Deleting a worthless test is a legitimate outcome; weakening an assertion to get green is not.
