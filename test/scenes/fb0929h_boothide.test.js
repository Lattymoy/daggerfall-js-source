// FIELD BUGS 2026-09-29h (BOOT-HIDE) - the Discord's "CRASH (2) ReferenceError: Cannot access 'be' before
// initialization", thrown from HTMLDocument's visibilitychange into world-*.js.
//
// Rebuilt at the release the report ran (its eotbSprite chunk hash matches byte for byte), `be` is `online`, read by
// the realm's page-hide hook: `whenPageHides(document, () => { if (online) onlineCheckpoint(); })`. bootWorld
// registered it at the checkpoint and declared `let online` some 1,900 lines lower - with two awaits between (the quest
// pack, the first pixel's people). A window put away while the boot waited (a phone's home button, the desktop app
// minimised during a load) ran the hook inside `online`'s dead zone. The exit autosave (beforeunload), the saved-soon
// door (PROF-SAVE) and the title exit had the same shape: each reaches `online`, `seatOut` and the duel manager.
//
// BOOTORDER's gate walks what the boot RUNS; a door runs whenever the page says. So this one walks every callback the
// boot hands to a page-lifecycle door and names every binding it can reach that the boot declares only past one of
// its own awaits - the window a door can open into.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

const SRC = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

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
/** every identifier a callback's body can read when it runs - nested closures included (they run later still) */
function readsOf(node) {
  const ids = new Set();
  (function walk(x) {
    if (x.type === 'Identifier') ids.add(x.name);
    for (const [k, c] of kids(x)) {
      if (x.type === 'MemberExpression' && k === 'property' && !x.computed) continue;
      if ((x.type === 'Property' || x.type === 'MethodDefinition' || x.type === 'PropertyDefinition') && k === 'key' && !x.computed) continue;
      walk(c);
    }
  })(node);
  return ids;
}
/** whether a top-level statement suspends the boot (an await outside any nested function) */
function suspends(n) {
  let found = false;
  (function walk(x, depth) {
    if (isFn(x)) depth += 1;
    if (depth === 0 && (x.type === 'AwaitExpression' || (x.type === 'ForOfStatement' && x.await))) found = true;
    for (const [, c] of kids(x)) walk(c, depth);
  })(n, 0);
  return found;
}

/** The page's own doors: what the browser fires with no game input between (a tab put away, the page going), and the
 *  two the game hands the checkpoint to. */
const PAGE_EVENTS = new Set(['beforeunload', 'unload', 'pagehide', 'pageshow', 'visibilitychange', 'freeze', 'resume']);
const REGISTRARS = new Set(['whenPageHides', 'whenPageGoes', 'setBeforeTitleExit']);
const doorOf = (call) => {
  const c = call.callee;
  const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
  if (REGISTRARS.has(name)) return name;
  if (name === 'ready' && c.object?.type === 'Identifier' && c.object.name === 'saveSoon') return 'saveSoon.ready';
  if (name === 'addEventListener' && call.arguments[0]?.type === 'Literal' && PAGE_EVENTS.has(call.arguments[0].value)) return `addEventListener('${call.arguments[0].value}')`;
  return null;
};

/** Every door callback in bootWorld, and every binding it reaches that the boot declares past one of its awaits. */
function lateDoorReads(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const lineOf = (p) => source.slice(0, p).split('\n').length;
  const boot = findFn(ast, 'bootWorld');
  assert.ok(boot, 'world.js no longer declares bootWorld');
  const body = boot.body.body;
  const decl = new Map(), bodies = new Map();
  body.forEach((n, i) => {
    if (n.type === 'VariableDeclaration' && n.kind !== 'var') {
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier') continue;
        if (!decl.has(d.id.name)) decl.set(d.id.name, i);
        if (d.init && isFn(d.init)) bodies.set(d.id.name, d.init);
      }
    } else if (n.type === 'FunctionDeclaration' && n.id) bodies.set(n.id.name, n);
  });
  const awaits = body.map((n, i) => (n.type !== 'FunctionDeclaration' && suspends(n) ? i : -1)).filter((i) => i >= 0);
  const memo = new Map();
  const reach = (fnNode, seen) => {
    const out = new Set();
    for (const id of readsOf(fnNode.body ?? fnNode)) {
      out.add(id);
      const f = bodies.get(id);   // a function of the boot's, called or handed on: what it reads, it reads then
      if (!f || seen.has(id)) continue;
      seen.add(id);
      if (!memo.has(id)) memo.set(id, reach(f, seen));
      for (const x of memo.get(id)) out.add(x);
    }
    return out;
  };
  const doors = [], late = [];
  body.forEach((n, i) => {
    if (n.type === 'FunctionDeclaration') return;
    (function walk(x) {
      if (isFn(x)) return;   // a registration inside a function runs when that function does - not the boot walk's
      if (x.type === 'CallExpression') {
        const door = doorOf(x);
        if (door) {
          for (const arg of x.arguments) {
            const cb = isFn(arg) ? arg : arg.type === 'Identifier' ? bodies.get(arg.name) : null;
            if (!cb) continue;
            doors.push(door);
            for (const nm of reach(cb, new Set())) {
              const d = decl.get(nm);
              if (d === undefined || d <= i) continue;
              const between = awaits.find((a) => a >= i && a < d);
              if (between !== undefined) late.push(`${door} at line ${lineOf(x.start)} reaches ${nm} (declared line ${lineOf(body[d].start)}) across the await at line ${lineOf(body[between].start)}`);
            }
          }
        }
      }
      for (const [, c] of kids(x)) walk(c);
    })(n);
  });
  return { doors, late };
}

test('BOOT-HIDE: no callback the boot hands to a page door reaches a binding the boot declares past one of its awaits (mutant: page-hide-at-the-checkpoint)', () => {
  const { doors, late } = lateDoorReads(SRC);
  assert.deepEqual(late, [], 'a page door can run while the boot is suspended - and read a binding still in its dead zone');
  // not vacuous: the doors the report's crash and its three siblings came through are all walked
  for (const d of ['whenPageHides', 'saveSoon.ready', 'setBeforeTitleExit', "addEventListener('beforeunload')", 'whenPageGoes']) {
    assert.ok(doors.includes(d), `the gate no longer finds the ${d} door`);
  }
});

test('BOOT-HIDE: the gate names the shape the report crashed on', () => {
  // the page-hide hook put back where it stood, at the checkpoint - above the quest pack's await
  const hook = "    whenPageHides(globalThis.document, () => { if (online) onlineCheckpoint(); });\n";
  assert.ok(SRC.includes(hook), 'the page-hide hook is no longer written as the report\'s build had it');
  const anchor = '  /** REALM P1.3: THE REALM\'S CHECKPOINT';
  assert.ok(SRC.includes(anchor), 'the realm checkpoint\'s header moved');
  const before = SRC.replace(hook, '').replace(anchor, `  if (realmSession) {\n${hook}  }\n${anchor}`);
  const { late } = lateDoorReads(before);
  assert.ok(late.some((l) => l.startsWith('whenPageHides') && / reaches online /.test(l)), `the gate missed the crash:\n${late.join('\n')}`);
});

test('BOOT-HIDE: the crash itself - a door that fires while its registrar awaits reads a later let in its dead zone', async () => {
  const page = new EventTarget();
  let thrown = null;
  async function boot() {
    page.addEventListener('visibilitychange', () => { try { void later; } catch (e) { thrown = e; } });
    await new Promise((r) => { setTimeout(r, 0); });
    let later = null;   // eslint-disable-line prefer-const
    return later;
  }
  const booting = boot();
  page.dispatchEvent(new Event('visibilitychange'));   // the window put away while the boot waits
  await booting;
  assert.ok(thrown instanceof ReferenceError, 'the read did not throw');
  assert.match(String(thrown.message), /before initialization/);
});
