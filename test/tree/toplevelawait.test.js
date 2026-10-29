import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

// WEBKIT-TLA (2026-10-29, Discord: "Game fails to load on mobile website client" - iPhone, Safari and Chrome:
// "undefined is not a constructor (evaluating 'new YKt({woods:Dt,woodsBytes:pt})')"). A top-level await makes every
// graph that imports its module async, and WebKit before Safari 27 resolves a second import() of an async graph before
// it has run (WebKit bug 242740). The menu's warm-up and Play both import the world, so bootWorld - a hoisted function -
// ran before the chunk's body had made TerrainGenClient. Only a page's own entry, which nothing imports, may await.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
};

/** The module's top-level awaits (an `await` or a `for await` outside every function) and its relative specifiers. */
function moduleFacts(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const awaits = [], specs = [];
  const visit = (node, inFn) => {
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type) || node.type === 'StaticBlock') inFn = true;
    if (!inFn && (node.type === 'AwaitExpression' || (node.type === 'ForOfStatement' && node.await))) awaits.push(node.loc.start.line);
    const src = (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration' || node.type === 'ImportExpression') ? node.source : null;
    if (src?.type === 'Literal' && typeof src.value === 'string' && src.value.startsWith('.')) specs.push(src.value.split('?')[0]);
    for (const k in node) {
      const v = node[k];
      if (Array.isArray(v)) for (const c of v) visit(c, inFn);
      else if (v && typeof v.type === 'string') visit(v, inFn);
    }
  };
  visit(ast, false);
  return { awaits, specs };
}

test('WEBKIT-TLA: no module the game imports awaits at its top level - only an entry nothing imports may (mutant: firstVisitStore.js awaiting its pins again)', () => {
  const files = walk(join(root, 'src'));
  const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
  const facts = (f) => moduleFacts(text.get(f));
  // only a file that says `await` can await, and only one that names an awaiting file's name can import it
  const awaiting = new Map(files.filter((f) => /\bawait\b/.test(text.get(f))).map((f) => [f, facts(f).awaits]).filter(([, a]) => a.length));
  const names = [...awaiting.keys()].map((f) => f.slice(f.lastIndexOf(sep) + 1));
  const bad = [];
  for (const f of files.filter((g) => names.some((n) => text.get(g).includes(n)))) {
    for (const s of facts(f).specs) {
      const target = resolve(dirname(f), s);
      if (awaiting.has(target)) bad.push(`${relative(root, f).split(sep).join('/')} imports ${relative(root, target).split(sep).join('/')}, which awaits at line ${awaiting.get(target)[0]}`);
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(files.length > 1000 && awaiting.size >= 1, 'the tree was walked, and the entries that await were found');
});

test('WEBKIT-TLA: the scan sees a top-level await, a top-level for await, and not an await inside a function', () => {
  assert.deepEqual(moduleFacts("const m = await import('./a.js');").awaits, [1]);
  assert.deepEqual(moduleFacts('for await (const x of xs) {}').awaits, [1]);
  assert.deepEqual(moduleFacts('async function f() { await g(); }\nconst h = async () => { await g(); };').awaits, []);
  assert.deepEqual(moduleFacts("import { a } from './a.js?x=1';\nexport * from '../b.js';\nimport('./c.js');\nimport 'node:fs';").specs, ['./a.js', '../b.js', './c.js']);
});
