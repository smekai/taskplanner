import { describe, it, expect } from 'vitest';
import { scriptJson } from '../src/views/webview/scriptJson.js';

// Board text is inlined into a webview <script>; a hand-edited value must not be able to end it.
describe('scriptJson', () => {
  it('cannot close the enclosing script element', () => {
    const inlined = scriptJson('0 7 * * *</script><script>alert(1)</script>');

    expect(inlined).not.toMatch(/<\/script/i);
  });

  it('reads back as the same value in JavaScript', () => {
    const value = { title: 'a < b </script> <!-- c', tags: ['x'] };

    expect(JSON.parse(scriptJson(value))).toEqual(value);
  });
});
