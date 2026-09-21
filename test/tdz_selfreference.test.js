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

// ── THE CROSS-MODULE TDZ (HOTFIX 2026-09-19) ──────────────────────
//
// The guard above catches a module that reads its own `const` too
// early. This one catches the same error thrown ACROSS two modules, by
// a third party who never touched either - the way the site went black
// on 2026-09-19 with "can't access lexical declaration 'yv' before
// initialization" out of a chunk `/play/` loads.
//
// THE SHAPE, and it takes three ingredients that are each harmless:
//   1. Two modules that import each other. `ui/hud.js` and
//      `ui/enhancedHud.js` have for most of this port's life.
//   2. One of them RE-EXPORTING a binding it got from the other
//      (`ui/enhancedHud.js`: `export { compassScroll }`, which is
//      hud.js's const). Also long-standing and, on its own, fine.
//   3. Anyone anywhere asking for a NAMESPACE over that module - a
//      dynamic `import()` or an `import * as`. A namespace object is
//      built by READING EVERY BINDING AT ONCE, so it reaches through
//      the re-export into the other module's `const` while that module
//      is still initialising, and throws.
//
// Nothing in the gate could see it: the module bodies import cleanly
// under node (no namespace is built), the build succeeds, and 9030
// tests passed. Only the BUNDLE throws, and only at boot. The third
// ingredient is the one a slice adds, so the third is what is pinned.
const rel = (p) => p.slice(root.length + 1);
test('TDZ2: nothing takes a NAMESPACE over a module that re-exports a cycle partner’s binding', () => {
  const files = walk(join(root, 'src'));
  // COMMENTS ARE NOT IMPORTS. This pin's own first run flagged the
  // hotfix note that NAMES the bad shape in prose, which would make the
  // guard unable to explain itself.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const cache = new Map();
  const read = (f) => {
    if (!cache.has(f)) cache.set(f, strip(readFileSync(f, 'utf8')));
    return cache.get(f);
  };
  const abs = (from, spec) => {
    if (!spec.startsWith('.')) return null;
    const p = join(dirname(from), spec);
    return files.includes(p) ? p : null;
  };
  /** Every relative module each file imports, by any spelling. */
  const deps = new Map();
  for (const f of files) {
    const t = read(f);
    const out = new Set();
    for (const m of t.matchAll(/(?:^|[\s(=])import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) out.add(m[1]);
    for (const m of t.matchAll(/^\s*(?:import|export)[\s\S]*?from\s*['"](\.[^'"]+)['"]/gm)) out.add(m[1]);
    deps.set(f, [...out].map((s) => abs(f, s)).filter(Boolean));
  }
  /** Does `a` reach `b` through imports? */
  const reaches = (a, b, seen = new Set()) => {
    for (const n of deps.get(a) ?? []) {
      if (n === b) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      if (reaches(n, b, seen)) return true;
    }
    return false;
  };
  // Who is namespace-imported: a dynamic import(), or `import * as`.
  const namespaced = new Set();
  for (const f of files) {
    const t = read(f);
    for (const m of t.matchAll(/(?:^|[\s(=])import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const p = abs(f, m[1]); if (p) namespaced.add(p);
    }
    for (const m of t.matchAll(/^\s*import\s+\*\s+as\s+\w+\s+from\s*['"](\.[^'"]+)['"]/gm)) {
      const p = abs(f, m[1]); if (p) namespaced.add(p);
    }
  }
  const bad = [];
  for (const target of namespaced) {
    const t = read(target);
    // the bare re-export form: `export { a, b };` for names this module IMPORTED
    const imported = new Map();
    for (const m of t.matchAll(/^\s*import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/gm)) {
      const src = abs(target, m[2]); if (!src) continue;
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) imported.set(name, src);
      }
    }
    for (const m of t.matchAll(/^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0]?.trim();
        const src = imported.get(name);
        if (!src) continue;
        if (reaches(src, target)) {
          bad.push(`${rel(target)} re-exports \`${name}\` from ${rel(src)}, which imports it back - and something takes a namespace over ${rel(target)}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], 'a namespace over a cycle re-exporter throws at boot in the BUNDLE, where no node test can see it');
});
