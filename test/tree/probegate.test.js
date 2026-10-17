// AUDIT ANTICHEAT A2 (2026-10-17; #955 picked up) - A PROBE'S SEAM SITS BEHIND THE SHOT GATE.
//
// #955 published the live entity on a `?shot` boot alone and said every other probe seam already stood behind
// `shotMode`. The audit read all 285 install sites in src/ and found three that did not: world.js's `__readyRanged`
// (exterior.js's twin was gated), worldModes.js's `__anim` (a line above the installer it belonged in) and exterior.js's
// `__rig`. None reached the entity and none was a power, but the claim was a hand count, and the next seam is written by
// someone who never read it. So it is a law now: every `window.__X =` in src/ - `globalThis.` and `self.` too, `??=`,
// `||=` and `&&=` too - sits under a test that names the shot gate (`shotMode`, `params.has('shot')`,
// `pageHas('shot')`), or inside one of the two installers whose every call does, or is named below as ALWAYS ON with
// its reason. Counted both ways: a new ungated seam fails, and so does a name left here after its seam was gated.
//
// src/tools/ is the lab pages' (mw-viewer, the paperdoll viewer, the card and sky labs), and is swept only for the
// premise that lets it go: no module outside it imports one inside it, so no played page carries a lab's seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const LABS = join(SRC, 'tools') + sep;
const rel = (/** @type {string} */ p) => relative(ROOT, p).split(sep).join('/');

/** Installed on every boot, each for a reason - none of them the live entity, none of them a power. */
const ALWAYS_ON = {
  'src/player/pointerLock.js :: __daggerRelock': 'ESC-LOCK: the desktop shell\'s relock hook (app/main.cjs dagger:relock)',
  'src/render/shadowPass.js :: __DF_SHADOW_TUNING': 'FLICKER-FIX: the shadows\' comparison knobs - the look alone',
  'src/systems/quest/questReach.js :: __DF_QUEST_REACH': 'the Nearby quests pref\'s comparison door - what Settings already gives',
  'src/scenes/shared.js :: __musicCtx': 'a read of the music\'s environment',
  'src/scenes/shared.js :: __infectionVideos': 'a log of the films played',
  'src/scenes/world.js :: __questVideos': 'a log of the films played',
  'src/scenes/world.js :: __weaponDebug': 'the field report\'s door: a read of the held weapon a player is asked to run',
  'src/scenes/world.js :: __grassStats': 'the grass lab\'s counts',
  'src/ui/enhanced/enhancedChargen.js :: __chargen': 'a read of the window\'s state, as JSON',
  'src/ui/enhanced/enhancedInventory.js :: __pack': 'a read of the window\'s state, as JSON',
  'src/ui/enhanced/enhancedMenu.js :: __menu': 'a read of the window\'s state, as JSON',
  'src/ui/heldMap.js :: __heldMap': 'a read of the window\'s state, as JSON',
  'src/ui/videoPlayer.js :: __vidClips': 'a count of the film\'s audio blocks',
};
const INSTALLERS = new Set(['installShotProbes', 'installTownProbes']);
const ASSIGN = new Set(['=', '??=', '||=', '&&=']);

/** @param {string} dir @param {string[]} [out] */
function sources(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.m?js$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Every surface install, installer call and import in one file, each with whether a shot gate encloses it. */
function sweep(/** @type {string} */ path) {
  const src = readFileSync(path, 'utf8');
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const text = (/** @type {any} */ n) => src.slice(n.start, n.end);
  /** @returns {boolean} */
  const gates = (/** @type {any} */ t) => (t.type === 'Identifier' && t.name === 'shotMode')
    || (t.type === 'CallExpression' && t.arguments[0]?.value === 'shot' && /^(pageHas|[\w.]+\.has)$/.test(text(t.callee)))
    || (t.type === 'LogicalExpression' && t.operator === '&&' && (gates(t.left) || gates(t.right)));
  /** THE CONSOLE'S OWN GATE (CONSOLE-DOOR): `!params.has('online')` - the door stands offline alone, as world.js
   *  carries it. Kept APART from `gates` on purpose: letting the online refusal satisfy the shot gate would excuse
   *  `__playerEntity` - the live entity the shot law exists for - on any offline boot. */
  const refusesOnline = (/** @type {any} */ t) => t?.type === 'UnaryExpression' && t.operator === '!' && t.argument?.type === 'CallExpression'
    && t.argument.arguments[0]?.value === 'online' && /^(pageHas|[\w.]+\.has)$/.test(text(t.argument.callee));
  const surface = (/** @type {any} */ n) => n.type === 'MemberExpression' && n.object.type === 'Identifier'
    && /^(window|globalThis|self)$/.test(n.object.name) && /^__/.test(n.computed ? String(n.property.value) : n.property.name);
  /** A surface the console's installer writes on its `target` parameter - `target.__console = door` names no host, so
   *  the literal-object test above cannot see it. It counts when the assignment sits inside installConsoleProbe's own
   *  body; its CALL SITES are where the law is enforced, and every one of them must carry the online refusal. */
  const doorSurface = (/** @type {any} */ n) => n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'target'
    && /^__/.test(n.computed ? String(n.property.value) : n.property.name);
  const out = { installs: /** @type {{at: string, gated: boolean}[]} */ ([]), calls: /** @type {{at: string, gated: boolean}[]} */ ([]), consoleCalls: /** @type {{at: string, gated: boolean}[]} */ ([]), imports: /** @type {string[]} */ ([]) };
  const walk = (/** @type {any} */ n, /** @type {any[]} */ up) => {
    if (!n || typeof n.type !== 'string') return;
    const gated = () => up.some((p, i) => {
      const c = up[i + 1] ?? n;
      if (p.type === 'IfStatement' || p.type === 'ConditionalExpression') return c === p.consequent && gates(p.test);
      if (p.type === 'LogicalExpression' && p.operator === '&&') return c === p.right && gates(p.left);
      return p.type === 'FunctionDeclaration' && INSTALLERS.has(p.id?.name);
    });
    const offline = () => up.some((p, i) => {
      const c = up[i + 1] ?? n;
      if (p.type === 'IfStatement' || p.type === 'ConditionalExpression') return c === p.consequent && refusesOnline(p.test);
      if (p.type === 'LogicalExpression' && p.operator === '&&') return c === p.right && refusesOnline(p.left);
      return false;
    });
    const inDoor = () => up.some((p) => p.type === 'FunctionDeclaration' && p.id?.name === 'installConsoleProbe');
    if (n.type === 'AssignmentExpression' && ASSIGN.has(n.operator) && (surface(n.left) || (inDoor() && doorSurface(n.left)))) {
      out.installs.push({ at: `${rel(path)} :: ${n.left.computed ? n.left.property.value : n.left.property.name}`, gated: gated() || (inDoor() && doorSurface(n.left)) });
    }
    const callee = n.type === 'CallExpression' ? (n.callee.type === 'MemberExpression' ? n.callee.property.name : n.callee.name) : null;
    if (INSTALLERS.has(callee)) out.calls.push({ at: `${rel(path)}:${n.loc.start.line}`, gated: gated() });
    if (callee === 'installConsoleProbe') out.consoleCalls.push({ at: `${rel(path)}:${n.loc.start.line}`, gated: offline() });
    if ((n.type === 'ImportDeclaration' || n.type === 'ImportExpression') && typeof n.source.value === 'string') out.imports.push(n.source.value);
    up.push(n);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) for (const x of v) walk(x, up);
      else if (v && typeof v.type === 'string') walk(v, up);
    }
    up.pop();
  };
  walk(ast, []);
  return out;
}

const played = sources(SRC).filter((p) => !p.startsWith(LABS)).map((p) => ({ path: p, ...sweep(p) }));

test('AUDIT ANTICHEAT A2: every surface a played page installs stands behind the shot gate, or is named always-on with its reason', () => {
  const installs = played.flatMap((f) => f.installs);
  assert.ok(installs.filter((s) => s.gated).length > 200, `the sweep reads the hosts' probe surfaces (${installs.length} sites)`);
  const ungated = [...new Set(installs.filter((s) => !s.gated).map((s) => s.at))].sort();
  assert.deepEqual(ungated, Object.keys(ALWAYS_ON).sort());
  assert.ok(installs.some((s) => s.at === 'src/characters/playerEntity.js :: __playerEntity' && s.gated), 'the entity\'s own surface reads the gate');
});

test('AUDIT ANTICHEAT A2: the two installers are called behind the shot gate, every time', () => {
  const calls = played.flatMap((f) => f.calls);
  assert.ok(calls.length >= 3, 'world.js calls both, exterior.js the modes\' one');
  assert.deepEqual(calls.filter((c) => !c.gated).map((c) => c.at), []);
});

// CONSOLE-DOOR: the console's installer writes `target.__console`, which names no host - the shot law above cannot see
// it, and its door runs ANY registered verb (world.js's own comment records the mint: giveboat, placeboat, a deed).
// Three hosts called it ungated; world.js alone carried `!params.has('online')`. Now the door's every call site is
// offline-only, and the count is pinned so a fifth host cannot mount it silently.
test('AUDIT ANTICHEAT A2: the console door is installed offline alone - every host, every time', () => {
  const calls = played.flatMap((f) => f.consoleCalls);
  assert.ok(calls.length >= 4, `world.js, exterior.js, interior.js and dungeon.js each mount the door (${calls.length} calls)`);
  assert.deepEqual(calls.filter((c) => !c.gated).map((c) => c.at), []);
});

test('AUDIT ANTICHEAT A2: no played page imports a lab\'s module - the premise that leaves src/tools/ out of the sweep', () => {
  const reach = played.flatMap((f) => f.imports.filter((s) => s.startsWith('.')).map((s) => ({ from: rel(f.path), to: resolve(dirname(f.path), s) })));
  assert.ok(reach.length > 1000, 'the sweep reads the imports');
  assert.deepEqual(reach.filter((r) => r.to.startsWith(LABS)).map((r) => `${r.from} -> ${rel(r.to)}`), []);
});
