#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', 'src');
const EXEMPT_DIRS = [path.join('src', 'test')];
const DIRECTIVE_RE = /^\/[/*]\s*(eslint|ts-|@ts-|prettier-|c8 |v8 |istanbul|#!)/;
const JUSTIFIED_RE = /^\/[/*]+\s*WHY:\s*\S/;

function sourceFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

function isExempt(file) {
  const rel = path.relative(path.join(__dirname, '..'), file);
  return EXEMPT_DIRS.some((dir) => rel.startsWith(dir + path.sep));
}

function commentsIn(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const byPosition = new Map();

  const collect = (ranges) => {
    for (const range of ranges ?? []) {
      byPosition.set(range.pos, {
        text: text.slice(range.pos, range.end),
        line: source.getLineAndCharacterOfPosition(range.pos).line + 1,
      });
    }
  };

  const visit = (node) => {
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    node.forEachChild(visit);
  };

  source.forEachChild(visit);
  collect(ts.getLeadingCommentRanges(text, source.endOfFileToken.getFullStart()));

  return [...byPosition.values()];
}

const offenders = [];
let justified = 0;

for (const file of sourceFiles(ROOT)) {
  if (isExempt(file)) continue;
  const text = fs.readFileSync(file, 'utf-8');
  for (const comment of commentsIn(file, text)) {
    const trimmed = comment.text.trim();
    if (DIRECTIVE_RE.test(trimmed)) continue;
    if (JUSTIFIED_RE.test(trimmed)) {
      justified++;
      continue;
    }
    const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    const preview = trimmed.split('\n')[0].slice(0, 72);
    offenders.push(`${rel}:${comment.line}  ${preview}`);
  }
}

if (offenders.length === 0) {
  const note = justified > 0 ? ` (${justified} justified WHY: comment(s) allowed)` : '';
  console.log(`check-comments: clean${note}`);
  process.exit(0);
}

console.error(`\ncheck-comments: ${offenders.length} comment(s) in production code.\n`);
for (const line of offenders) console.error('  ' + line);
console.error(`
A comment is a signal that the code is not clear enough yet. Rewrite it away:
name the function after the comment, extract the condition into a named
predicate, or split the branch out.

Comments are allowed in src/test/**, and in machine directives
(eslint-disable, @ts-expect-error, prettier-ignore).

For the genuinely non-obvious case, prefix the comment with WHY: and give the
reason -- a workaround for an external bug, a deliberate deviation from an API
contract, or an output format that must match byte-for-byte.
`);
process.exit(1);
