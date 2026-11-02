// DIAL-LOAD (2026-09-28, Mac: "Take that load bug on"): a same-dungeon Load through a door that handed the dungeon
// context no position applier - the HUD dial's Skills arm (openSheetPage), the F5 page and the pack's crossovers -
// restored the character and left them where they stood, autorun latch and all: routeKey's applier was the only way
// a host's placement law reached the context. The hosts hand the context their ONE load law when they build it
// (`placePlayer`), and every load the context runs lands by it unless the door brought its own. Found finishing
// AUDIT 27h; recorded in bible/01-Overview/bugs/Field-Bugs-2026-09-27h.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// audit27h.test.js's live-source runner: the text AS WRITTEN, run in a scope whose unknown names are inert stubs
function literalBody(text, opener) {
  const i = text.indexOf(opener);
  assert.ok(i >= 0, `could not find ${opener}`);
  const open = text.indexOf('{', i + opener.length);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  throw new Error(`unbalanced literal after ${opener}`);
}
const STUB = new Proxy(function stub() {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 'STUB' : STUB), apply: () => STUB });
const scopeOf = (env) => new Proxy({ undefined, ...env }, {   // `undefined` is a name too: the catch-all would stub it
  has: () => true,
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : STUB)),
});
// eslint-disable-next-line no-new-func
const run = (expr, env) => new Function('__scope', `with (__scope) { return (${expr}); }`)(scopeOf(env));
function constOf(text, name, env = {}) {
  const m = new RegExp(`^\\s*const ${name} = (.*);$`, 'm').exec(text);
  assert.ok(m, `could not find const ${name}`);
  return run(m[1], env);
}

const DC = rd('src/scenes/dungeonContext.js');
const RESTORE = 'restoreSaved(extras, setPlayerPos, { session = true, announce = session } = {}) ';
/** The context's restoreSaved (every load's second half), as written, over `env`. */
const restoreSavedOf = (env) => run(`function ${RESTORE}${literalBody(DC, RESTORE)}`, env);

test('DIAL-LOAD: a same-dungeon load whose door handed no applier lands by the host\'s law; a door\'s own still wins', () => {
  const calls = [];
  const law = (p) => calls.push(['law', ...p]);
  const env = { opts: { placePlayer: law }, _locationKey: 'dungeon:7', needsStartWarp: () => false };
  const restoreSaved = restoreSavedOf(env);
  restoreSaved({ position: [1, 2, 3], locationKey: 'dungeon:7' }, null);   // the dial's door: pauseHooks(null) -> quickLoad(null)
  assert.deepEqual(calls, [['law', 1, 2, 3]], 'placed by the host\'s law - before, nothing placed the player at all');
  calls.length = 0;
  restoreSaved({ position: [4, 5, 6], locationKey: 'dungeon:7' }, (p) => calls.push(['own', ...p]));   // the ?load boot's recorder
  assert.deepEqual(calls, [['own', 4, 5, 6]], 'a door that brings its own applier keeps it');
  calls.length = 0;
  restoreSaved({ position: [7, 8, 9], locationKey: 'dungeon:8' }, null);
  assert.deepEqual(calls, [], 'another place\'s save places nothing here - the world host\'s load owns that one');
  // the other-layout warp to the start marker lands by the same law
  const warped = restoreSavedOf({ ...env, needsStartWarp: () => true });
  warped.call({ startSpawn: () => [0, 1, 0] }, { position: [1, 2, 3], locationKey: 'dungeon:7' }, null);
  assert.deepEqual(calls, [['law', 1, 2, 3], ['law', 0, 1, 0]], 'the saved position, then the start marker, both by the law');
  // and a context built with no law (a host that hands none) places nothing rather than throwing
  assert.doesNotThrow(() => restoreSavedOf({ ...env, opts: {} })({ position: [1, 2, 3], locationKey: 'dungeon:7' }, null));
});

test('DIAL-LOAD: the pause bag passes its door\'s applier through; each dungeon host hands its ONE load law at build and uses it at every load', () => {
  // the context's pause bag, as written: the dial's door built it with no applier, and its Load hands that on
  const loads = [];
  const bag = run(literalBody(DC, 'const ctx = this;   // the sibling save verbs on this same context\n      return '), {
    ctx: { quickLoad: (...a) => loads.push(a) }, setPlayerPos: null, opts: {},
  });
  bag.quickLoad();
  bag.loadKey('slot-3');
  assert.deepEqual(loads, [[null], [null, 'slot-3']], 'the Load and the slot window reach quickLoad with the door\'s null - restoreSaved decides');
  const hosts = [
    ['src/scenes/worldModes.js', 'player', 'dungeonCtx = ctx;'],
    ['src/scenes/dungeon.js', '_motorRef', 'relock: () => requestLook(canvas) });'],
  ];
  for (const [file, motorName, callEnd] of hosts) {
    const text = rd(file);
    // the law, run out of the live source: P14's spawn and AUDIT 27h S2's latch
    const calls = [];
    // FALL-KEPT (FIELD BUGS 2026-09-30, PIN MOVED): worldModes' law lands a saved fall after the spawn - none is handed
    // here, and fb0930_fallkept.test.js runs it on the real motor.
    const motor = { spawn: (...p) => calls.push(['spawn', ...p]), stopAutorun: () => calls.push(['stop']), restoreFall: () => {} };
    constOf(text, 'placeLoadedPlayer', { [motorName]: motor })([1, 2, 3]);
    assert.deepEqual(calls, [['spawn', 1, 2, 3], ['stop']], `${file}: the law places the player and drops the latch`);
    // handed to the context at build
    const build = text.slice(text.indexOf('const ctx = await buildDungeonContext('), text.indexOf(callEnd, text.indexOf('const ctx = await buildDungeonContext(')));
    assert.match(build, /\bplacePlayer: placeLoadedPlayer,/, `${file}: the context is built with the host's law`);
    // and it is the one applier every dungeon load site of the host hands over (dungeon.js's ?load boot records
    // instead; worldModes' interior key route hands null, its Load being the world host's, which places by itself)
    const handed = [...text.matchAll(/(?:\.quickLoad\?*\.?\(|\.restoreSaved\(extras, |routeKey\(e, (?:dungeonCtx|ctx), )((?:\(p\) => \{[^}]*\})|[\w$]+)/g)].map((m) => m[1]);
    const expected = file.endsWith('dungeon.js') ? ['(p) => { loadedPos = p ? [...p] : null; }', 'placeLoadedPlayer'] : ['placeLoadedPlayer', 'placeLoadedPlayer', 'placeLoadedPlayer'];
    assert.deepEqual(handed, expected, `${file}: no second copy of the law at a load site`);
  }
});

// AUDIT DISC28 (27h's DIAL-LOAD read, recorded there as its own slice): SaveLoadManager's OnStartLoad reaches the
// HOST's CameraRecoiler (ResetRecoil). The world's load reset the world's reel and the standalone host wraps the
// context's door to reset its own, but a world-hosted dungeon's OWN load (F12, the pause's Load underground) reached
// neither, and a hit's sway ran on over the loaded character. The context raises `onStartLoad` once a load is under
// way - never for a slot that is not there, nor a save the world's load takes over - and the world host hands it the
// reset of its own camera's reel.
test('AUDIT DISC28: a world-hosted dungeon\'s own load resets the camera\'s reel, as the world\'s load does', () => {
  const QL = 'quickLoad(setPlayerPos, key = null) ';
  const quickLoadOf = (env) => run(`function ${QL}${literalBody(DC, QL)}`, env);
  const loads = (snap, worldLoad = undefined) => {
    const started = [];
    const restored = [];
    const env = {
      opts: { onStartLoad: () => started.push('start'), dungeonOnline: () => false, worldLoad },
      loadSlot: () => snap, quickLoadSlot: () => snap, playerEntity: { name: 'Mac' }, spellsByIndex: null,
      restorePlayer: () => ({ position: [1, 2, 3], locationKey: 'dungeon:7' }), _locationKey: 'dungeon:7',
      hudText: { add: () => {} }, Promise: { resolve: () => ({ then: () => {} }) },
    };
    quickLoadOf(env).call({ restoreSaved: (...a) => restored.push(a), discardBeneathDeath() {} }, null);   // PIN MOVED (AUDIT DUPE-LOAD): the load drains what waits under the death screen first
    return { started, restored };
  };
  const same = loads({ locationKey: 'dungeon:7' });
  assert.deepEqual(same.started, ['start'], 'a same-dungeon load raises the load\'s start once');
  assert.equal(same.restored.length, 1, 'and goes on to restore');
  assert.deepEqual(loads(null).started, [], 'no slot, no load - nothing started');
  assert.deepEqual(loads({ locationKey: 'dungeon:8' }, () => {}).started, [], 'another place\'s save is the world\'s load, which resets its own reel');
  // the world host hands the context its own camera's reset, through worldModes' build
  const wm = rd('src/scenes/worldModes.js');
  const build = wm.slice(wm.indexOf('const ctx = await buildDungeonContext('), wm.indexOf('dungeonCtx = ctx;', wm.indexOf('const ctx = await buildDungeonContext(')));
  assert.match(build, /\bonStartLoad: \(\) => host\.cameraRecoilReset\?\.\(\),/, 'worldModes builds the context with the host\'s reel reset');
  const rec = { was: false, reset() { this.was = true; } };
  constOf(rd('src/scenes/world.js').replace(/^(\s*)cameraRecoilReset: (.*),(\s*\/\/.*)?$/m, '$1const cameraRecoilReset = $2;'), 'cameraRecoilReset', { cameraRecoiler: rec })();
  assert.equal(rec.was, true, 'world.js\'s host member resets the world\'s CameraRecoiler');
});
