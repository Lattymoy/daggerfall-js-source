import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { topLevelAwaits, importedAwaitingChunks, noImportedTopLevelAwait } from '../../scripts/noTopLevelAwait.mjs';

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

/** The module's top-level awaits (scripts/noTopLevelAwait.mjs - the build's own reader) and its relative specifiers, a
 *  template literal with no expression among them (AUDIT FB1029g TLA-1: main.js imports `./ui/menu/menuPad.js` so). */
function moduleFacts(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const specs = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    const src = (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration' || node.type === 'ImportExpression') ? node.source : null;
    const v = src?.type === 'Literal' ? src.value : src?.type === 'TemplateLiteral' && !src.expressions.length ? src.quasis[0].value.cooked : null;
    if (typeof v === 'string' && v.startsWith('.')) specs.push(v.split('?')[0]);
    for (const k in node) {
      const c = node[k];
      if (Array.isArray(c)) for (const x of c) visit(x);
      else if (c && typeof c.type === 'string') visit(c);
    }
  };
  visit(ast);
  return { awaits: topLevelAwaits(text), specs };
}

test('WEBKIT-TLA: no module the game imports awaits at its top level - only an entry nothing imports may (mutant: firstVisitStore.js awaiting its pins again)', () => {
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'vendor'))];   // The vendor code src imports ships too
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
  assert.ok(files.length > 1000, 'the tree was walked');   // No tie to the entries that happen to await today
});

test('WEBKIT-TLA: the scan sees a top-level await, a top-level for await, and not an await inside a function', () => {
  assert.deepEqual(moduleFacts("const m = await import('./a.js');").awaits, [1]);
  assert.deepEqual(moduleFacts('for await (const x of xs) {}').awaits, [1]);
  assert.deepEqual(moduleFacts('async function f() { await g(); }\nconst h = async () => { await g(); };').awaits, []);
  assert.deepEqual(moduleFacts("import { a } from './a.js?x=1';\nexport * from '../b.js';\nimport('./c.js');\nimport 'node:fs';\nimport(`./d.js`);\nimport(`./${e}.js`);").specs, ['./a.js', '../b.js', './c.js', './d.js'], 'a template literal with no expression is a specifier');
});

test('WEBKIT-TLA (AUDIT FB1029g TLA-1): the build refuses a chunk another imports that awaits at its top level - a page\'s own entry may; the plugin rides the config (mutants: the guard unregistered; an entry refused)', () => {
  const chunk = (fileName, code, isEntry = false) => ({ type: 'chunk', fileName, code, isEntry });
  const bundle = {
    a: chunk('assets/enhancedBook-x.js', 'var o=1;await Promise.resolve();export{o};'),
    b: chunk('assets/world-y.js', 'async function f(){await g()}export{f};'),
    c: chunk('assets/chargen-z.js', 'await import("./a.js");', true),
    d: { type: 'asset', fileName: 'a.css', source: 'await' },
  };
  assert.deepEqual(importedAwaitingChunks(bundle), ['assets/enhancedBook-x.js (line 1)']);
  const plugin = noImportedTopLevelAwait();
  assert.equal(plugin.apply, 'build');
  assert.throws(() => plugin.generateBundle.call({ error: (m) => { throw new Error(m); } }, {}, bundle), /WEBKIT-TLA: a chunk another imports awaits at its top level - assets\/enhancedBook-x\.js \(line 1\)/);
  assert.doesNotThrow(() => plugin.generateBundle.call({ error: (m) => { throw new Error(m); } }, {}, { b: bundle.b, c: bundle.c }));
  const cfg = readFileSync(join(root, 'vite.config.js'), 'utf8');
  assert.match(cfg, /plugins: \[[^\]]*noImportedTopLevelAwait\(\), licenceFiles\(\), leanBundlePlugin\(\)\]/, 'the game\'s build runs it');   // The licences' and the lean bundle's plugins after it
});
