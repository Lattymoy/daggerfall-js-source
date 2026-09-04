import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// THE SELF-REFERENCE GUARD (2026-08-31). A `const X = { ...X }` is a
// TEMPORAL DEAD ZONE error the moment the module body runs - "can't
// access lexical declaration 'X' before initialization" - and nothing
// in the gate caught one: eslint's no-use-before-define does not look
// inside an initialiser's spread, the build happily minifies it, and
// the biggest hosts cannot be imported under bare node (Vite's
// import.meta.glob), so no test executes their module bodies.
//
// It reached the live site through UI1: a scripted edit replaced the
// WRONG occurrence of a block and left `const useHooks = { ...useHooks
// }`. Two pins passed over it, because both asserted that the text
// `...useHooks` appeared - which it did, inside its own declaration.
//
// This walks every `const NAME = {` initialiser in src/ and fails if it
// spreads or reads NAME before the declaration closes.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
};

/** The object/array literal starting at `from`, to its matching brace. */
function literalEnd(src, from, open, close) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

test('no const/let initialiser reads its own binding (the TDZ that broke boot)', () => {
  const offenders = [];
  for (const file of walk(join(root, 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([[{])/g)) {
      const name = m[1];
      const open = m[2];
      const start = m.index + m[0].length - 1;
      const end = literalEnd(src, start, open, open === '{' ? '}' : ']');
      if (end < 0) continue;
      const body = src.slice(start + 1, end);
      // Only a SPREAD of the binding is flagged. A method body that
      // refers to its own object (`const api = { f() { return api.g; } }`)
      // is legal - it runs after the declaration closes - but
      // `{ ...api }` evaluates DURING initialisation and is always the
      // dead-zone error.
      const re = new RegExp(`\\.\\.\\.\\s*${name}\\b`);
      if (re.test(body)) offenders.push(`${file.slice(root.length + 1)}: ${name}`);
    }
  }
  assert.deepEqual(offenders, [], `self-referential initialisers (TDZ at module load):\n  ${offenders.join('\n  ')}`);
});
