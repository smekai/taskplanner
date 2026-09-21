# In Progress

## TASK-063: Rewrite the parser in layers, with errors separate from warnings
**Priority:** P1 | **Tags:** core, refactor
**Updated:** 2026-09-21 09:35

Supersedes PR #12 (closed). Three rounds of review there landed on one root cause: the grammar lives in several places that disagree, and the parser has no notion of failure — everything degrades silently.

Measured on the current code:

- `**Priority:** p0` silently becomes **P4**, the lowest, with zero warnings. A task an agent is told to prioritise becomes one it never picks up.
- `## TASK 002:` (space instead of a dash) makes the task invisible. A warning exists, but **MCP surfaces no diagnostics at all** — `grep warning src/mcp/server.ts` returns nothing. An agent reads 3 tasks where there are 4 and cannot know.
- Warnings have no severity, so `Invalid task heading` (a task is lost) sits in the same list as `Content is not part of any task` (that is the file heading, it is fine).

Full rewrite is approved: back-compat is held by behaviour, not by code.

## Parser architecture

Layered, each layer tested on its own:

    src/core/parser/
      grammar.ts        the format vocabulary, one place
      boardSections.ts  layer 1-2: raw text to sections
      taskSection.ts    layer 3-4: one section to Task + diagnostics
      taskParser.ts     orchestration, public parseTasks
      taskSerializer.ts Task to markdown, sections + tasks to a file

**`grammar.ts`** owns the heading, separator, attribute and `### Plan` patterns plus `taskHeadingIdOf`, `isSectionSeparatorLine`, `isReservedAttributeKey` and `parsePriority`. The serializer asks the same module — a guard drifting from the grammar it protects is what produced the P1 in PR #12.

**`boardSections.ts`** — `splitSections(raw)` returning `task` or `text` sections. A section ends at its separator, **the next task heading**, or EOF. The middle case is not optional: without it a task missing its closing `---` has no end, and an edit reaches into its neighbour. Invariant: concatenating the sections returns the input byte for byte.

**`taskSection.ts`** — splits one section into heading / metadata / body / plan, with `parseAttributeLine(line)` handling one attribute or a pipe-joined group.

**Both metadata layouts are read; the grouped line is always written.** No setting.

**Narrow the group delimiter.** Splitting on every `|` is why `**Source:** a | b` loses its tail and why PR #12 had to forbid `|` in values. Verified against the 60 pipe-joined lines in this repository's own board: `/\s\|\s(?=\*\*)/` splits real groups identically and leaves `a | b` intact. The value restriction goes; the reserved-name restriction stays.

## Diagnostics

    export interface ParseIssue { line: number; message: string; raw?: string }
    export interface ParseResult {
      tasks: Task[];
      errors: ParseIssue[];
      warnings: ParseIssue[];
      segments: BoardSegment[];
    }

Two lists, no severity field, no info level.

| case | today | after |
| --- | --- | --- |
| `## TASK 002:` looks like a task but is not | warning, task invisible | **error carrying the whole section as `raw`** |
| `**Priority:** Critical` | silent P4 | **error** listing the valid values |
| `**Priority:** p0` | silent P4 | **accepted as P0** |
| no `**Priority:**` line | silent P4 | **warning**, P4 kept |
| text outside any task | warning | **nothing** — it is preserved, there is nothing to report |

That last row matters: once text stops being lost, the noisiest warning stops being a problem worth raising.

**Delivery.** `taskplanner_list`, `taskplanner_board`, `taskplanner_board_data` and `taskplanner_get` report errors in their text (`4 tasks; 1 section could not be read, BACKLOG.md:8`) and in `structuredContent` with the raw text, so an agent can repair it. `ConfigDiagnostic` gets the same split.

## Requirements carried from the closed PR

This list is the whole inheritance; anything missing from it is lost when that branch is forgotten.

**Round-trip safety**
1. A newline in `title`, `tags`, `epic`, `assignee`, `updatedAt` or `waitingUntil` must not open a second task — single-line fields collapse to one line.
2. A `description` or `plan` holding a separator line or a real task heading is refused **by field name**, not silently mangled.
3. The refusal guard uses the parser's grammar: `## TASK-999:` with no title is body text, so refusing it would reject a task the parser produced.

**Attributes**
4. An unrecognised `**Key:** value` parses into `Task.attributes` and is written back, both in the grouped line and on its own.
5. A name matching a built-in field is refused. `isReservedAttributeKey` asks the parser's own patterns rather than restating a list of names.

**File integrity**
6. Parsing and writing are inverses: writing an unmodified parse returns the input byte for byte.
7. A task nobody edited is written from its original bytes, so a save produces no diff noise.
8. CRLF is preserved.
9. A section without a closing `---` ends at the next heading.

**Store, independent of the parser — can be done first**
10. `moveTask` and `fixDuplicates` serialize every state **before** any disk write. Otherwise a refusal mid-move leaves the task in neither file; this was reproduced.

**Library**
11. `taskIdsIn` is exported.

**New here**
12. The BOM is preserved on write (dropped today).
13. Priority recognition is case- and whitespace-insensitive.
14. `errors` and `warnings` are separate and reach MCP.

## Tests

Every failure is closed by a decision, never by adjusting an expectation: either it is a corner case that means nothing, and the test is deleted with the reason in the commit, or it is real backward compatibility, and the code is fixed.

Cut: duplicates in `parser.test.ts` that check one field several ways; assertions on exact warning text; cases that have become instances of an invariant.

Add: one test per layer, both invariants property-style over every board file in the repository, and a table of priority spellings.

## Out of scope

A local gitignored config for platform and per-developer settings, holding the line-ending preference and generating `.gitattributes` for `.tasks/`. Separate task.


### Plan

Six steps, each verified before the next. Requirements 1-14 above are the acceptance list.

- **1. Store fix first** (requirement 10). `FileStore.prepareState`/`commitWrites` split serializing from
  writing; `moveTask` and `fixDuplicates` serialize every state before touching disk. Independent of
  the parser, fixes a reproduced data loss, lands as its own commit.
- **2. `grammar.ts`.** Move every pattern and predicate out of `taskParser.ts` into one module:
  heading, separator, attribute, `### Plan`, plus `taskHeadingIdOf`, `isSectionSeparatorLine`,
  `isReservedAttributeKey`, `parsePriority`. Nothing else may hold a pattern.
- **3. `boardSections.ts`.** `splitSections(raw)`. Land the byte-coverage invariant with it — every
  later layer rests on it.
- **4. `taskSection.ts`.** One section to `Task` + diagnostics, with `parseAttributeLine` reading a
  single attribute or a pipe-joined group. Narrow the delimiter to `/\s\|\s(?=\*\*)/` here.
- **5. `taskParser.ts` + diagnostics.** Orchestrate the layers, return `errors`/`warnings` separately.
  Then `taskSerializer.ts` asks `grammar.ts` for its refusal guard, and `serializeBoard` writes
  through the sections.
- **6. MCP delivery.** Errors in the text and in `structuredContent` for `list`, `board`,
  `board_data` and `get`, carrying `raw` so an agent can repair a broken section.

Test review runs alongside, not at the end: each layer's tests replace the `parser.test.ts` cases it
subsumes, and every deletion says in the commit why the case stopped mattering.

---
