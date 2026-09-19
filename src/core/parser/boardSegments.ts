import { isSectionSeparatorLine, taskHeadingIdOf } from './taskParser.js';

export interface RawSegment {
  kind: 'text' | 'task';
  id?: string;
  raw: string;
}

interface LineSpan {
  text: string;
  start: number;
  end: number;
}

function lineSpans(content: string): LineSpan[] {
  const spans: LineSpan[] = [];
  let start = 0;
  while (start < content.length) {
    const brk = content.indexOf('\n', start);
    const stop = brk === -1 ? content.length : brk;
    spans.push({
      text: content.slice(start, stop).replace(/\r$/, ''),
      start,
      end: brk === -1 ? content.length : brk + 1,
    });
    if (brk === -1) break;
    start = brk + 1;
  }
  return spans;
}

// WHY: an unterminated section ends where the next task begins, the boundary parseTasks uses, so segmenting never reaches into a neighbour.
function sectionEnd(spans: LineSpan[], from: number): number {
  for (let i = from; i < spans.length; i++) {
    if (isSectionSeparatorLine(spans[i].text)) return i + 1;
    if (i > from && taskHeadingIdOf(spans[i].text) !== undefined) return i;
  }
  return spans.length;
}

export function segmentBoard(content: string): RawSegment[] {
  const spans = lineSpans(content);
  const segments: RawSegment[] = [];
  const sliceOf = (from: number, to: number) => content.slice(spans[from].start, spans[to - 1].end);

  let at = 0;
  let textFrom = 0;
  const flushText = (to: number) => {
    if (to > textFrom) segments.push({ kind: 'text', raw: sliceOf(textFrom, to) });
  };

  while (at < spans.length) {
    const id = taskHeadingIdOf(spans[at].text);
    if (id === undefined) {
      at++;
      continue;
    }
    flushText(at);
    const end = sectionEnd(spans, at);
    segments.push({ kind: 'task', id, raw: sliceOf(at, end) });
    at = end;
    textFrom = end;
  }
  flushText(spans.length);

  return segments;
}
