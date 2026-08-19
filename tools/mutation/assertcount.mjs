// Preload (via NODE_OPTIONS=--import): counts every assert.* invocation and
// attributes it to the test/*.test.js call site. Written out at process exit.
import assertStrict from 'node:assert/strict';
import assertLoose from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.ASSERT_COUNT_OUT;
const counts = new Map();

function note() {
  const e = {};
  Error.captureStackTrace(e, note);
  const lines = String(e.stack).split('\n');
  let inner = null, outer = null;
  for (const l of lines) {
    const m = l.match(/\(?((?:file:\/\/)?\/[^\s()]*\/test\/[^\s():]*\.test\.js):(\d+):(\d+)\)?/);
    if (m) { const k = path.basename(m[1]) + ':' + m[2]; if (!inner) inner = k; outer = k; }
  }
  if (!outer) { counts.set('<no-test-frame>', (counts.get('<no-test-frame>') || 0) + 1); return; }
  // attribute to the OUTERMOST test-file frame (the test body), so local
  // helpers like `approx()` do not absorb the count.
  counts.set(outer, (counts.get(outer) || 0) + 1);
  if (inner !== outer) counts.set('SITE ' + inner, (counts.get('SITE ' + inner) || 0) + 1);
}

const names = ['ok', 'equal', 'strictEqual', 'notEqual', 'notStrictEqual', 'deepEqual',
  'deepStrictEqual', 'notDeepEqual', 'notDeepStrictEqual', 'throws', 'doesNotThrow',
  'rejects', 'doesNotReject', 'match', 'doesNotMatch', 'fail', 'ifError', 'partialDeepStrictEqual'];
for (const target of [assertStrict, assertLoose]) {
  for (const n of names) {
    const orig = target[n];
    if (typeof orig !== 'function') continue;
    Object.defineProperty(target, n, {
      configurable: true, writable: true, enumerable: false,
      value: function (...a) { note(); return orig.apply(this, a); },
    });
  }
}

process.on('exit', () => {
  if (!OUT) return;
  const rows = [...counts.entries()].map(([k, v]) => k + '\t' + v).join('\n');
  if (rows) fs.appendFileSync(OUT, rows + '\n');
});
