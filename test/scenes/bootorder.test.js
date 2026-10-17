// BOOT-TDZ / BOOT-TDZ2 (2026-09-18, Mac twice over: "boot failed: can't
// access lexical declaration 'yn' before initialization", then the same
// sentence with 'xn') - THE BOOT WALK'S OWN ORDER, GATED.
//
// `bootWorld` is one long function. Its body runs top to bottom, and
// partway down it awaits its own first pixel build:
//
//     const playerPixel = await awaitedBuild(first.px, first.py);
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
import { hostText, movedOutOf } from '../hostText.mjs';   // HOST-SPLIT 2: the modules moved out of the host

const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
// HOST-SPLIT 2: a module moved out of bootWorld (tools/hostMove.mjs) runs where its code stood, and reads the host's
// live names at their use as `host.<name>` - the same reads, at the same moment. So the walk follows a call into a
// moved module's functions as into the host's own, and reads `host.<name>` there as `<name>`: the gate sees the build
// whole, wherever its code now lives.
const MOVED = movedOutOf('src/scenes/world.js').map((p) => {
  const text = hostText(p);
  const tree = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const ctor = tree.body.find((n) => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'FunctionDeclaration')?.declaration;
  return { file: p, ctor, handle: ctor?.params[0]?.name };
});
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
function surface(node, handle = null) {
  const ids = new Set(), calls = new Set();
  const live = (x) => (handle && x.type === 'MemberExpression' && !x.computed && x.object.type === 'Identifier' && x.object.name === handle ? x.property.name : null);
  (function walk(x, depth) {
    if (isFn(x)) depth += 1;
    if (live(x)) { if (depth === 0) ids.add(live(x)); return; }   // a moved module's `host.<name>`: the host's <name>, read here
    if (x.type === 'Identifier' && depth === 0) ids.add(x.name);
    if (x.type === 'CallExpression' && x.callee.type === 'Identifier' && depth === 0) calls.add(x.callee.name);
    if (x.type === 'CallExpression' && live(x.callee) && depth === 0) calls.add(live(x.callee));
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
//
// AUDIT-FIELD F6: AND EVERY REASON NAMES A GUARD THAT MUST STILL BE
// THERE. A name alone is a permanent blind spot: this gate passed on the
// exact line that produced Mac's second crash, because `walkMode` was
// allow-listed and the walker cannot see that the fix moved the read
// behind a guard. `questBridge` was allow-listed on a reason that was
// simply FALSE - "quest placements only", where the real guard is
// `entry.npcs.length` - and a third dead zone sat behind that sentence
// until AUDIT-FIELD went looking. So each entry carries the source the
// claim rests on, and the claim fails with it.
//
// AUDIT LANDFORMS II K1: AND EVERY EXCUSE IS ITS OWN FUNCTION'S. The third
// field names the functions whose reads the excuse covers - a read of the
// same name anywhere else on the first build's path is a new read, and no
// excuse. The list once blessed a name down every function: the publish
// came to read `droppedLoot` itself (the rides on a rebuilt pixel's ground)
// and this gate passed, while the boot died on it whenever the network
// landed inside the first build - every boot on a fast connection.
const ALLOWED = {
  // buildPixelNow -> destroyPixel. NOT "on a rebuild only": :1458's ROADS
  // 25a arm tears down during the FIRST build whenever the road network
  // lands mid-build, which on a fast connection is every boot. What makes
  // these four safe is that every read of them is behind `if (collectLoose)`
  // and that call site passes it false.
  droppedLoot: ['destroyPixel, and only under collectLoose - and standWodPile, which stands only the piles an unload carried (collectLoose); the sweep carries none', 'collectLoose: false', ['destroyPixel', 'standWodPile']],
  droppedTorches: ['destroyPixel, and only under collectLoose', 'collectLoose: false', ['destroyPixel']],
  cityGuards: ['destroyPixel, and only under collectLoose', 'collectLoose: false', ['destroyPixel']],
  exteriorFoes: ['destroyPixel, and only under collectLoose', 'collectLoose: false', ['destroyPixel']],
  // BOOT-TDZ2: the playerTravelPixel() reads, behind the mod's own guard -
  // with no mod there is nothing to initialise and the call never happens.
  walkMode: ['playerTravelPixel, behind the travelOptions guard', 'if (host.travelOptions && dfLocation) {', ['playerTravelPixel']],
  player: ['playerTravelPixel, behind the travelOptions guard', 'if (host.travelOptions && dfLocation) {', ['playerTravelPixel']],
  cam: ['playerTravelPixel, behind the travelOptions guard', 'if (host.travelOptions && dfLocation) {', ['playerTravelPixel']],
};

test('BOOT-TDZ2: nothing the boot walk runs reads a binding the boot walk has not declared - the gate the two dead-zone crashes deserved (mutants: hook-asks-the-pixel-first, travel-options-declared-late)', () => {
  const boot = findFn(ast, 'bootWorld');
  assert.ok(boot, 'world.js no longer declares bootWorld');
  const body = boot.body.body;

  // AUDIT HOST-SPLIT 2 (the second read): A DESTRUCTURED BINDING HAS A DEAD ZONE TOO. Every slice turns a hoisted
  // function into `const { buildPixelNow } = createPixelBuild(...)`, and the walk skipped every declarator that was
  // not a bare name - so a build reached above its construction read a binding the gate never knew was declared there
  // (mutant: BOOT-TDZ2-the-build-taken-before-its-construction)
  const bound = (p) => (p.type === 'Identifier' ? [p.name]
    : p.type === 'ObjectPattern' ? p.properties.flatMap((q) => bound(q.type === 'RestElement' ? q.argument : q.value))
    : p.type === 'ArrayPattern' ? p.elements.filter(Boolean).flatMap(bound)
    : p.type === 'AssignmentPattern' ? bound(p.left)
    : p.type === 'RestElement' ? bound(p.argument) : []);
  const decl = new Map(), fns = new Map(), arrows = new Map();
  body.forEach((n, i) => {
    if (n.type === 'VariableDeclaration' && n.kind !== 'var') {
      for (const d of n.declarations) {
        for (const nm of bound(d.id)) if (!decl.has(nm)) decl.set(nm, i);
        if (d.id.type === 'Identifier' && d.init && isFn(d.init)) arrows.set(d.id.name, d.init);
      }
    } else if (n.type === 'FunctionDeclaration' && n.id) fns.set(n.id.name, n);
  });
  // the moved modules' own functions, walked as the host's (HOST-SPLIT 2) - each read through its handle
  const handleOf = new Map();
  for (const m of MOVED) {
    assert.ok(m.ctor && m.handle, `${m.file}: its constructor and its handle`);
    for (const n of m.ctor.body.body) {
      if (n.type === 'FunctionDeclaration' && n.id && !fns.has(n.id.name)) { fns.set(n.id.name, n); handleOf.set(n, m.handle); }
      if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier' && d.init && isFn(d.init) && !arrows.has(d.id.name)) { arrows.set(d.id.name, d.init); handleOf.set(d.init, m.handle); }
    }
  }
  assert.ok(fns.has('buildPixelNow'), 'the walk reaches the pixel build, wherever it stands');

  const buildAt = body.findIndex((n) => /const playerPixel = await awaitedBuild\(first\.px, first\.py\);/.test(src.slice(n.start, n.end)));
  assert.notEqual(buildAt, -1, 'the boot no longer awaits its own first pixel build by that name');
  assert.ok(buildAt > 0 && buildAt < body.length - 1, 'the first build is inside the boot walk');

  const memo = new Map();
  const reach = (name, seen) => {
    if (seen.has(name)) return new Set();
    seen.add(name);
    if (memo.has(name)) return memo.get(name);
    const f = fns.get(name) ?? arrows.get(name);
    if (!f) return new Set();
    const { ids, calls } = surface(f.body, handleOf.get(f));
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

  // AUDIT-FIELD F6: AND EVERY EXCUSE CARRIES ITS GUARD. The walker cannot
  // see conditions - it walks both arms of every `if` - so a name on this
  // list is blessed down EVERY path, which is how this gate came to pass
  // on the exact line that produced the second crash. Each entry names
  // the source the excuse rests on; delete the guard and the excuse goes
  // with it, whatever the walker still thinks it can reach.
  const builder = hostText('src/scenes/pixelBuild.js');   // HOST-SPLIT 2: the pixel builder, moved whole into its module
  for (const [nm, [why, guard]] of Object.entries(ALLOWED)) {
    assert.ok(builder.includes(guard),
      `${nm} is excused as "${why}", and the guard that excuse rests on (${guard}) is no longer in the pixel builder`);
  }

  // AUDIT LANDFORMS II K1: and each excused name is read only where its
  // excuse was written - every function the first build can reach, and the
  // boot walk's own statements before it, asked who reads it
  const readers = new Map();
  const note = (nm, where) => { if (!(nm in ALLOWED)) return; if (!readers.has(nm)) readers.set(nm, new Set()); readers.get(nm).add(where); };
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const f = fns.get(name) ?? arrows.get(name);
    if (!f) return;
    const { ids, calls } = surface(f.body, handleOf.get(f));
    for (const nm of ids) note(nm, name);
    for (const c of calls) visit(c);
  };
  body.slice(0, buildAt + 1).forEach((n) => {
    if (n.type === 'FunctionDeclaration') return;
    if (n.type === 'VariableDeclaration' && n.kind !== 'var' && n.declarations.every((d) => !d.init || isFn(d.init))) return;
    const { ids, calls } = surface(n);
    for (const nm of ids) note(nm, `the boot walk (line ${lineOf(n.start)})`);
    for (const c of calls) visit(c);
  });
  const stray = [];
  for (const [nm, where] of readers) for (const w of where) if (!ALLOWED[nm][2].includes(w)) stray.push(`${nm}: read in ${w}, excused in ${ALLOWED[nm][2].join(', ')} alone`);
  assert.deepEqual(stray, [], 'an excused name read where its excuse does not reach - a dead zone the allow-list would have blessed');
});
