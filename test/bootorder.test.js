// BOOT-TDZ / BOOT-TDZ2 (2026-09-18, Mac twice over: "boot failed: can't
// access lexical declaration 'yn' before initialization", then the same
// sentence with 'xn') - THE BOOT WALK'S OWN ORDER, GATED.
//
// `bootWorld` is one long function. Its body runs top to bottom, and
// partway down it awaits its own first pixel build:
//
//     const playerPixel = await buildPixel(first.px, first.py);
//
// Everything that build reaches RUNS THEN - while every `const` and
// `let` below it is still in its temporal dead zone. Reading one throws
// `ReferenceError`, and optional chaining is no shield: `a?.b` evaluates
// `a` and throws exactly as `a.b` would. It softens null and undefined,
// which an uninitialised binding is not.
//
// TO1 broke this twice in one slice. First the mod itself: the pixel
// builder's B3 hook said `travelOptions?.initLocationRects(...)` while
// `const travelOptions` sat three and a half thousand lines below. Then,
// with that hoisted, the same line's own test - `px === playerTravelPixel().x`
// - which reads `walkMode`, `player` and `cam`, all declared below the
// build. Both killed the boot of every character whose first pixel
// carries a location, which is every ordinary save; a character in open
// wilderness booted fine, which is why nothing here caught it.
//
// So this is the gate the two fixes deserve: walk the boot's statements
// up to and including that build, follow every call into the functions
// bootWorld declares, and name every binding they can reach that the
// boot walk has not declared yet. The answer is an ALLOW-LIST - eight
// names, each reachable only through a branch that a first build never
// takes - and a ninth fails here rather than in a player's browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
const lineOf = (p) => src.slice(0, p).split('\n').length;
const kids = (n) => {
  const out = [];
  for (const k of Object.keys(n)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && out.push([k, c]));
    else if (v && typeof v.type === 'string') out.push([k, v]);
  }
  return out;
};
const isFn = (n) => /FunctionDeclaration|FunctionExpression|ArrowFunctionExpression/.test(n.type);
const findFn = (n, name) => {
  if (n.type === 'FunctionDeclaration' && n.id?.name === name) return n;
  for (const [, c] of kids(n)) { const r = findFn(c, name); if (r) return r; }
  return null;
};
/** the identifiers a node names, and the functions it calls, OUTSIDE any
 *  nested function body - what running that node touches right now */
function surface(node) {
  const ids = new Set(), calls = new Set();
  (function walk(x, depth) {
    if (isFn(x)) depth += 1;
    if (x.type === 'Identifier' && depth === 0) ids.add(x.name);
    if (x.type === 'CallExpression' && x.callee.type === 'Identifier' && depth === 0) calls.add(x.callee.name);
    for (const [k, c] of kids(x)) {
      if (x.type === 'MemberExpression' && k === 'property' && !x.computed) continue;
      if ((x.type === 'Property' || x.type === 'MethodDefinition' || x.type === 'PropertyDefinition') && k === 'key' && !x.computed) continue;
      walk(c, depth);
    }
  })(node, 0);
  return { ids, calls };
}

// Each name here is reachable from the first build only down a branch a
// FIRST build cannot take, and each predates Travel Options - they are
// the analysis being generous, not the boot being wrong.
const ALLOWED = {
  // buildPixelNow -> destroyPixel, which only runs when a pixel is being
  // REPLACED (the roads retry, a season re-skin); the first build of a
  // key has nothing to tear down.
  droppedLoot: 'destroyPixel, on a rebuild only',
  droppedTorches: 'destroyPixel, on a rebuild only',
  cityGuards: 'destroyPixel, on a rebuild only',
  exteriorFoes: 'destroyPixel, on a rebuild only',
  // buildPixelNow -> standPixelNpcs, whose quest arm is reached only for
  // a pixel a quest has already placed someone on.
  questBridge: 'standPixelNpcs, quest placements only',
  // BOOT-TDZ2: the three playerTravelPixel() reads, now behind the mod's
  // own guard - with no mod there is nothing to initialise and the call
  // never happens. The pin for that guard is in to1_travelOptions.test.js.
  walkMode: 'playerTravelPixel, behind the travelOptions guard',
  player: 'playerTravelPixel, behind the travelOptions guard',
  cam: 'playerTravelPixel, behind the travelOptions guard',
};

test('BOOT-TDZ2: nothing the boot walk runs reads a binding the boot walk has not declared - the gate the two dead-zone crashes deserved (mutants: hook-asks-the-pixel-first, travel-options-declared-late)', () => {
  const boot = findFn(ast, 'bootWorld');
  assert.ok(boot, 'world.js no longer declares bootWorld');
  const body = boot.body.body;

  const decl = new Map(), fns = new Map(), arrows = new Map();
  body.forEach((n, i) => {
    if (n.type === 'VariableDeclaration' && n.kind !== 'var') {
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier') continue;
        if (!decl.has(d.id.name)) decl.set(d.id.name, i);
        if (d.init && isFn(d.init)) arrows.set(d.id.name, d.init);
      }
    } else if (n.type === 'FunctionDeclaration' && n.id) fns.set(n.id.name, n);
  });

  const buildAt = body.findIndex((n) => /const playerPixel = await buildPixel\(first\.px, first\.py\);/.test(src.slice(n.start, n.end)));
  assert.notEqual(buildAt, -1, 'the boot no longer awaits its own first pixel build by that name');
  assert.ok(buildAt > 0 && buildAt < body.length - 1, 'the first build is inside the boot walk');

  const memo = new Map();
  const reach = (name, seen) => {
    if (seen.has(name)) return new Set();
    seen.add(name);
    if (memo.has(name)) return memo.get(name);
    const f = fns.get(name) ?? arrows.get(name);
    if (!f) return new Set();
    const { ids, calls } = surface(f.body);
    const out = new Set(ids);
    for (const c of calls) for (const x of reach(c, seen)) out.add(x);
    memo.set(name, out);
    return out;
  };

  const found = new Map();
  body.slice(0, buildAt + 1).forEach((n, i) => {
    if (n.type === 'FunctionDeclaration') return;                     // hoisted: its body runs when it is called
    if (n.type === 'VariableDeclaration' && n.kind !== 'var' && n.declarations.every((d) => !d.init || isFn(d.init))) return;   // a lambda binding
    const { ids, calls } = surface(n);
    const touched = new Set(ids);
    for (const c of calls) for (const x of reach(c, new Set())) touched.add(x);
    for (const nm of touched) {
      const d = decl.get(nm);
      if (d !== undefined && d > i && !found.has(nm)) found.set(nm, lineOf(n.start));
    }
  });

  const unexpected = [...found].filter(([nm]) => !(nm in ALLOWED))
    .map(([nm, ln]) => `${nm}: reachable from line ${ln}, declared at statement ${decl.get(nm)} of the boot walk`);
  assert.deepEqual(unexpected, [],
    'a binding the boot walk declares LATER is reachable from something it runs EARLIER - that is a temporal dead zone, and `?.` will not save it');

  // and the allow-list stays honest: a name that stops being reachable
  // is a line that moved, and the reason recorded for it is now stale
  const gone = Object.keys(ALLOWED).filter((nm) => !found.has(nm));
  assert.deepEqual(gone, [], 'the allow-list names a binding the boot walk can no longer reach - drop it');
});
