// AUDIT PRE-MERGE 0928 - THE INPUT LENS (keyboard, pad and touch over the Sea Update): U1, U2, U3, U8.
//
//   U1  the position map took a release it never saw pressed - the Escape that put "According to my instruments..."
//       away on its press put the map away on its release
//   U2  a finger's tap was never Come Sail Away's placing click - a phone could not put a boat in the water
//   U3  the phone's stick pressed Run past 80% of its throw, and the helm's oars read Run + a side as the strafe
//   U8  the position map (PauseGame(true, true)) left the HUD painted under it
//
// The CSA runtime, the townTalk host, the notify door, the touch layer, the edge ring and the registry are the real
// modules. The world host cannot boot here (no ARENA2), so its seams are READ OUT OF THE SHIPPED SOURCE and run: the
// map's window and its key seam (world.js csaMapOpen and its neighbours), mountSpellWindow/closeSpellWindow
// (worldModes.js), the tap hook, the frame's tap countdown and csaUpdate's placing click (world.js), and the stick's
// Run gate the host hands the touch layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTownTalk } from '../../src/scenes/townTalk.js';
import { messageBox, _resetNotifyForTests } from '../../src/systems/notify.js';
import { ActionTextBox } from '../../src/ui/actionText.js';
import { comeSailAwayModels } from '../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat, TRIGGER_MODEL } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_PARTS_TEMPLATE } from '../../src/systems/comeSailAway/comeSailAway.js';
import { keyEdges, noteKeyDown, noteKeyUp, beginInputFrame, released, held, setBindings } from '../../src/ui/input.js';
import { createBindings, resetDefaults, ACTION_GROUPS, DEFAULT_BINDINGS, DEFAULT_SECONDARY_BINDINGS, DEFAULT_SHARES, HIDDEN_ACTIONS } from '../../src/systems/inputActions.js';
import { buttonText } from '../../src/systems/controlsConfig.js';
import { attachTouch } from '../../src/ui/touch/touch.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { hidesHud } from '../../src/ui/windowStack.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const MODES = read('src/scenes/worldModes.js');
const DIR = new URL('../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }), particleRandom: () => 0.5 });
const CANVAS = { width: 320, height: 200, clientWidth: 320, clientHeight: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) };

/** One piece of the shipped source, found by its pattern (group 1), or the pin says what moved. */
function grab(src, re, what) {
  const m = re.exec(src);
  assert.ok(m, `${what} is no longer where this pin reads it`);
  return m[1];
}

/** The runtime's doors, as a scripted scene answers them (test/systems/comeSailAway/csa_map.test.js's and csa_placing's shape). */
function csaDeps(over = {}) {
  const terrain = { mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
  return {
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: () => {} },
    player: () => ({ position: [1, 2, 3], rotation: [0, 0, 0, 1] }), camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 207, Y: 213 }), isPlayerInside: () => false, blockWaterLevel: () => NO_WATER_LEVEL, iliacPuddleNoMore: () => false,
    raycast: () => null, playerTerrain: () => terrain, terrainAt: () => terrain, terrains: () => [terrain],
    heightMapValue: () => 255, worldCompensation: () => [0, 0, 0], hudText: () => {}, midScreenText: () => {}, log: () => {},
    random: { range: (min) => min, rangeFloat: (min) => min }, time: () => 0, hour: () => 12, weatherType: () => 0, dt: () => 0.25,
    persistentDungeonBoats: () => false, packedItems: { serialize: (i) => i, deserialize: (r) => r }, setting: (k) => ({ 'Waves.Enable': false })[k],
    input: { has: () => false, started: () => false, horizontal: () => 0, vertical: () => 0, toggleAutorun: false, keyDown: () => false, keyUp: () => false, key: () => false },
    helm: { setPlayerPosition: () => {}, setFacing: () => {}, turnPlayer: () => {}, freeze: () => {}, frozen: () => false, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false, isOnShip: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [], enemiesNearby: () => false, travelOptionsActive: () => null,
    timeScale: () => 1, setTimeScale: () => {}, soundVolume: () => 1,
    audio: { play: () => {}, stop: () => {}, oneShot: () => {}, dfOneShot: () => {}, dfClipAtPoint: () => {}, uiOneShot: () => {} },
    items: { create: () => ({}), addToPlayer: () => {} },
    messageBox: () => {}, topWindowIsMessageBox: () => false, gamePaused: () => false, map: { open: () => {}, close: () => {} },
    mousePosition: () => [0, 0], screenRect: () => ({ x: 0, y: 0, width: 1920, height: 1080 }), date: () => ({ day: 4, month: 0 }), effects: null,
    terrain,
    ...over,
  };
}

/** The touch layer over test/ui/touch/touchbuttons.test.js's stub document; every key it synthesizes goes to `onKey`. */
function stubEl() {
  return {
    id: '', textContent: '', children: [], _l: new Map(), attrs: {}, style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
function withTouch(hooks, onKey, drive) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { onKey(e); return true; }, prompt: () => null };
  resetPrefs();
  setPref('touchStickAnchor', 'float');
  const canvas = stubEl();
  const layer = attachTouch(canvas, hooks);
  try {
    const ev = (type, x, y, ts, id = 7) => ({ type, timeStamp: ts, preventDefault() {}, stopPropagation() {}, changedTouches: [{ identifier: id, clientX: x, clientY: y }] });
    drive({ canvas, ev });
  } finally {
    layer.dispose();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
    resetPrefs();
  }
}
const defaultBindings = () => { const b = createBindings(); resetDefaults(b); setBindings(b); return b; };

// ── U1 and U8: the position map's window, read out of world.js and run over the real townTalk ─────────────────

/** world.js's map seam - `_csaMapKeys` .. csaMapClose, csaInputFrame and csaInput - over a host's `latch`, `keys` and
 *  `modes`; and worldModes.js's two window doors in the street's arm (townTalk's slot). */
function mapSeam({ latch, keys, townTalk }) {
  const src = [
    grab(WORLD, /\n(\s*const _csaMapKeys = [^\n]*)\n/, 'the map\'s key sets'),
    grab(WORLD, /\n(\s*const csaInputFrame = [^\n]*)\n/, 'csaInputFrame'),
    grab(WORLD, /\n(\s*const csaKeyCode = [^\n]*)\n/, 'csaKeyCode'),
    grab(WORLD, /\n(\s*const csaInput = \{[\s\S]*?\n  \};)\n/, 'csaInput'),
    grab(WORLD, /\n(\s*let _csaMapWindow = null;[\s\S]*?\n  function csaMapClose\(\) \{[\s\S]*?\n  \})\n/, 'csaMapOpen / csaMapClose'),
  ].join('\n');
  const doors = [
    grab(MODES, /\n(  function mountSpellWindow\(win\) \{[\s\S]*?\n  \})\n/, 'mountSpellWindow'),
    grab(MODES, /\n(  function closeSpellWindow\(win\) \{[\s\S]*?\n  \})\n/, 'closeSpellWindow'),
  ].join('\n');
  const modes = new Function('townTalk', 'mode', 'dungeonCtx', 'interiorOverlay', `${doors}\nreturn { mountWindow: (win) => mountSpellWindow(win), closeWindow: (win) => closeSpellWindow(win) };`)(townTalk, 'exterior', null, null);
  // FONT3: the window's dispose takes its words' DOM layer down (ui/enhanced/enhancedTextLayer.js) - the seam's one new free name
  return new Function('latch', 'keys', 'modes', 'csaDrawMap', 'hideEnhancedTextLayer', `${src}\nreturn { csaInputFrame, csaInput, csaMapOpen, csaMapClose, mapWindow: () => _csaMapWindow };`)(latch, keys, modes, () => {}, () => {});
}

/** The street: the real townTalk host (its presenter takes the notify door's boxes), the map seam, the runtime with
 *  the Small Ship (the one hull with a position box), and the world host's two key listeners' lines that matter. */
function streetReading() {
  _resetNotifyForTests();
  const townTalk = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: CANVAS, fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] }, regionIndex: 0,
  });
  const keys = new Set();
  const latch = { edge: keyEdges() };
  const seam = mapSeam({ latch, keys, townTalk });
  const deps = csaDeps({
    input: { has: () => false, started: () => false, horizontal: () => 0, vertical: () => 0, toggleAutorun: false, ...seam.csaInput },
    messageBox: (text) => messageBox([text]),                                                       // world.js: DaggerfallUI.MessageBox
    topWindowIsMessageBox: () => (townTalk.overlay ?? null) instanceof ActionTextBox,                 // the street's top window
    gamePaused: () => townTalk.overlayActive,
    map: { open: () => seam.csaMapOpen(), close: () => seam.csaMapClose() },
  });
  const rt = createComeSailAwayRuntime(deps);
  const boat = rt.PlaceBoat([100, 34, 200], [0, 0, 1], 2, 0, deps.terrain);
  const ev = (code) => ({ code, key: code, repeat: false, target: null, preventDefault() {}, stopPropagation() {} });
  // world.js's keydown: townTalk's rung first, the ring below the overlay gate; its keyup: the ring, then townTalk's
  const keydown = (code) => { const e = ev(code); if (townTalk.keydown(e, keys)) return; keys.add(code); noteKeyDown(latch.edge, code, false); };
  const keyup = (code) => { const e = ev(code); keys.delete(code); noteKeyUp(latch.edge, code); townTalk.keyup(e); };
  const frame = () => { beginInputFrame(latch.edge); seam.csaInputFrame(); rt.endOfFrame(); };   // the frame's top, then the mod's frame's end
  const readPosition = () => rt.activate(TRIGGER_MODEL.position, { root: boat.GameObject, node: boat.PositionTrigger, distance: 1 }, 'grab');
  return { rt, townTalk, seam, keydown, keyup, frame, readPosition };
}

test('AUDIT PRE-MERGE 0928 U1: the Escape that put the instruments\' box away on its press is not the map\'s - the map it opened stays up past that key\'s release', () => {
  const s = streetReading();
  s.readPosition();
  assert.ok(s.townTalk.overlay instanceof ActionTextBox, '"According to my instruments..." is up');
  s.frame(); s.frame();
  s.keydown('Escape');
  assert.ok(!(s.townTalk.overlay instanceof ActionTextBox), 'the box went on the press');
  for (let i = 0; i < 6; i++) s.frame();   // the key held a tenth of a second at 60 fps; the map came up four frames on
  assert.ok(s.rt.state.mapShowing && s.seam.mapWindow(), 'the map is up while the key is still down');
  s.keyup('Escape');
  s.frame(); s.frame();
  assert.equal(s.rt.state.mapShowing, true, 'a release whose press the map never took does not put it away (JAN1\'s law)');
  assert.ok(s.seam.mapWindow() && s.townTalk.overlay === s.seam.mapWindow(), 'the map\'s window still holds the slot');
});

test('AUDIT PRE-MERGE 0928 U1: an Escape pressed and released on the map still puts it away, the slot emptied and the keys let go', () => {
  const s = streetReading();
  s.readPosition();
  s.frame();
  s.keydown('Enter'); s.keyup('Enter');   // the box dismissed another way
  for (let i = 0; i < 5; i++) s.frame();
  assert.ok(s.rt.state.mapShowing && s.seam.mapWindow(), 'the map is up');
  s.keydown('Escape'); s.frame(); s.frame();
  assert.equal(s.rt.state.mapShowing, true, 'the press alone does not put it away (GetKeyUp)');
  s.keyup('Escape'); s.frame();
  assert.equal(s.rt.state.mapShowing, false, 'its own press and release do');
  assert.equal(s.seam.mapWindow(), null);
  assert.equal(s.townTalk.overlay ?? null, null, 'the street\'s slot is free');
});

test('AUDIT PRE-MERGE 0928 U8: the position map takes the HUD away (PauseGame(true, true)) - the street\'s hudHidden, and the building\'s and the dungeon\'s drawHud read the same word', () => {
  const s = streetReading();
  s.readPosition();
  s.frame(); s.keydown('Enter'); s.keyup('Enter');
  for (let i = 0; i < 5; i++) s.frame();
  const win = s.seam.mapWindow();
  assert.ok(win, 'the map is up');
  assert.equal(hidesHud(win), true, 'the window declares it (windowStack.hidesHud: the literal true)');
  assert.equal(s.townTalk.hudHidden, true, 'the street\'s drawHud is told (world.js hudHidden: townTalk.hudHidden) - the large HUD goes too');
  s.keydown('Escape'); s.keyup('Escape'); s.frame();
  assert.equal(s.townTalk.hudHidden, false, 'and it comes back with the map put away');
  // the two slots the map also mounts in (mountSpellWindow's interior and dungeon arms) hand their drawHud the word
  assert.match(MODES, /\n\s*hudHidden: !!townTalk\?\.hudHidden \|\| hidesHud\(interiorOverlay\),/, 'worldModes: the building\'s drawHud asks its slot');
  assert.match(read('src/scenes/dungeonContext.js'), /\n\s*hudHidden: hidesHud\(activeOverlay\),/, 'dungeonContext: the dungeon\'s drawHud asks its slot');
});

// ── U2: the placing click ───────────────────────────────────────────────────────────────────────────────────────

/** world.js's finger: the tap hook (inputHooks.tap), the frame's tap countdown and csaUpdate's placing click, read out of
 *  the source and run over one scope - with the runtime's placing arm under it (test/systems/comeSailAway/csa_placing.test.js's scene). */
function placingRig() {
  const store = defaultBindings();
  let now = 10;
  const terrain = { mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
  const deps = csaDeps({ time: () => now, dt: () => 0, raycast: () => ({ distance: 3, point: [2, 0, 2], name: 'DaggerfallTerrain', terrain, root: null }), playerTerrain: () => terrain, terrainAt: () => terrain, terrains: () => [terrain], currentMapPixel: () => ({ X: 10, Y: 20 }) });
  const rt = createComeSailAwayRuntime(deps);
  const scope = {
    _tapArmed: 0, _tapPoint: null, _tapDir: null, _tapLockOnly: false, _tapClick: false, _lastProj: null, _lastView: null,
    modes: null, yards: null, gatherHost: null, canvas: CANVAS, cam: { pos: [0, 0, 0] }, ndcFromScreen: () => [0, 0], worldViewportRect: () => null, rayDirFromScreen: () => [0, 0, 1],   // HOME-YARD (AUDIT): the hook asks the yards' flight too - none offline; ACT-TOUCH: and the gathering host's act - none here
    released, latch: { edge: keyEdges() }, keys: new Set(),
  };
  const hookSrc = grab(WORLD, /\n    tap: (\(x, y, opts = null\) => \{\n[\s\S]*?\n    \}),\n/, 'the touch layer\'s tap hook');
  const countdownSrc = grab(WORLD, /\n((?:[ \t]*_tapClick = [^\n]*\n)?[ \t]*if \(_tapArmed > 0 && --_tapArmed === 0\) \{\n[^\n]*\n[ \t]*\} else if \(_tapArmed === 0 && _tapPoint\) \{[^\n]*\})/, 'the frame\'s tap countdown');
  const clickSrc = grab(WORLD, /csaRuntime\.lateUpdate\(\{ paused, activateComplete: ([^}]+?) \}\);/, 'csaUpdate\'s placing click');
  const tapHook = new Function('__s', `with (__s) { return (${hookSrc}); }`)(scope);
  const countdown = new Function('__s', `with (__s) { ${countdownSrc} }`);
  const click = new Function('__s', `with (__s) { return (${clickSrc}); }`);
  const parts = { templateIndex: BOAT_PARTS_TEMPLATE, UID: 3, message: 14 };
  rt.StartPlacing(parts, [parts]);
  now = 10.5;   // past the mod's fifth of a second
  let clicks = 0;
  /** `n` frames of the world host's top (the ring rotated, the tap counted down) and the mod's LateUpdate. */
  const frames = (n = 4) => {
    for (let i = 0; i < n; i++) {
      beginInputFrame(scope.latch.edge);
      countdown(scope);
      const activateComplete = !!click(scope);
      if (activateComplete) clicks++;
      rt.lateUpdate({ activateComplete });
      now += 0.02;
    }
  };
  // the host's own listeners: keydown/keyup and mousedown/mouseup note the ring as they note it
  const down = (code) => { scope.keys.add(code); noteKeyDown(scope.latch.edge, code, false); };
  const up = (code) => { scope.keys.delete(code); noteKeyUp(scope.latch.edge, code); };
  return { rt, scope, tapHook, frames, down, up, clicks: () => clicks, placed: () => rt.AllBoats.length, store };
}

test('AUDIT PRE-MERGE 0928 U2: a finger\'s tap is the placing click - the phone puts the boat in the water, and once', () => {
  const r = placingRig();
  withTouch({ look() {}, attack() {}, tap: (x, y, o) => r.tapHook(x, y, o) }, () => {}, ({ canvas, ev }) => {
    canvas.fire('touchstart', ev('touchstart', 700, 300, 0));   // the right half: a still, short touch is a tap
    canvas.fire('touchend', ev('touchend', 700, 300, 60));
  });
  assert.equal(r.scope._tapArmed, 2, 'the tap reached the host\'s hook (the activate gate\'s press)');
  r.frames(4);
  assert.equal(r.placed(), 1, 'the boat is placed on the tap\'s release frame');
  assert.equal(r.clicks(), 1, 'one click, on one frame');
  assert.equal(r.rt.placing, false);
});

test('AUDIT PRE-MERGE 0928 U2: the mouse and the pad still place on their own release, once; the stick\'s lock-only tap, a quick-loot key and E place nothing', () => {
  for (const [who, press] of [['the mouse (Mouse0 on the ring)', (r) => { r.down('Mouse0'); r.up('Mouse0'); }], ['the pad\'s A (LeftClick pressed as the key Mouse0)', (r) => { r.down('Mouse0'); r.up('Mouse0'); }]]) {
    const r = placingRig();
    press(r);
    r.frames(4);
    assert.deepEqual([r.placed(), r.clicks()], [1, 1], `${who}: one boat, one click`);
  }
  const stick = placingRig();
  withTouch({ look() {}, attack() {}, tap: (x, y, o) => stick.tapHook(x, y, o) }, () => {}, ({ canvas, ev }) => {
    canvas.fire('touchstart', ev('touchstart', 200, 400, 0));   // the stick's half: TS1's lock-only tap
    canvas.fire('touchend', ev('touchend', 200, 400, 60));
  });
  assert.equal(stick.scope._tapLockOnly, true, 'the stick\'s tap reached the hook as lock-only');
  stick.frames(4);
  assert.deepEqual([stick.placed(), stick.clicks()], [0, 0], 'a thumb re-placed on the stick is no click (TS1)');
  const loot = placingRig();
  loot.scope._tapArmed = 2;   // QUICK-LOOT B4's key arms the one-frame activate with no finger behind it
  loot.frames(4);
  assert.deepEqual([loot.placed(), loot.clicks()], [0, 0], 'the quick-loot keys are no finger');
  const e = placingRig();
  e.down('KeyE'); e.up('KeyE');
  e.frames(4);
  assert.deepEqual([e.placed(), e.clicks()], [0, 0], 'E is Interact, not ActivateCenterObject - the mod reads the latter (kept 1:1)');
});

// ── U3: the phone's stick at the helm ───────────────────────────────────────────────────────────────────────────

/** The keys the touch layer leaves down for a floating stick pushed `throw01` of its radius along (dx, dy), with the
 *  world host's stick-Run gate - read out of world.js's inputHooks - over a runtime that is or is not at the helm. */
function stickKeys(throw01, [dx, dy], sailing) {
  const m = /\n\s*stickRuns: (\(\) => [^\n]*?),(?:[ \t]*\/\/[^\n]*)?\n/.exec(WORLD);
  const csaRuntime = { isSailing: () => sailing };
  const stickRuns = m ? new Function('csaRuntime', `return (${m[1]});`)(csaRuntime) : undefined;
  const keys = new Set();
  defaultBindings();
  withTouch({ look() {}, attack() {}, tap() {}, ...(stickRuns ? { stickRuns } : {}) }, (e) => { if (e.type === 'keydown') keys.add(e.code); else keys.delete(e.code); }, ({ canvas, ev }) => {
    canvas.fire('touchstart', ev('touchstart', 200, 400, 0));
    const n = Math.hypot(dx, dy), len = 56 * throw01;
    canvas.fire('touchmove', ev('touchmove', 200 + (len * dx) / n, 400 + (len * dy) / n, 50));
  });
  return keys;
}

/** The skiff's helm, every node on water: the oars' targets for one Update over these held keys (the registry's held). */
function helmOver(keys) {
  defaultBindings();
  const has = (a) => held(keys, a);
  const player = { position: [1, 2, 3], frozen: 0 };
  const deps = csaDeps({
    input: { has, started: (a) => has(a), horizontal: () => (has('MoveRight') ? 1 : 0) - (has('MoveLeft') ? 1 : 0), vertical: () => (has('MoveForwards') ? 1 : 0) - (has('MoveBackwards') ? 1 : 0), toggleAutorun: false },
    helm: { setPlayerPosition: (p) => { player.position = [...p]; }, setFacing: () => {}, turnPlayer: () => {}, freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    player: () => ({ position: [...player.position], rotation: [0, 0, 0, 1] }),
  });
  const rt = createComeSailAwayRuntime(deps);
  const boat = rt.PlaceBoat([100, 34, 200], [0, 0, 1], 1, 0, deps.terrain);
  rt.StartSailing(boat);
  rt.state.CurrentBoat.NodeTileMapIndices = [0, 0, 0, 0, 0];
  rt.state.lastBoatPosition = boat.GameObject.position;
  rt.update();
  return { turn: rt.state.TurnTarget, move: [...rt.state.MoveVectorTarget] };
}

test('AUDIT PRE-MERGE 0928 U3: at the helm a phone\'s full push turns the boat - the stick\'s Run stands down while the helm is held', () => {
  const side = stickKeys(1, [1, 0], true);
  assert.ok(side.has('KeyD') && !side.has('ShiftLeft'), `a full push right at the helm is MoveRight alone, got ${[...side]}`);
  assert.deepEqual(helmOver(side), { turn: 1, move: [0, 0, 0] }, 'it turns, as D does - not the half-speed strafe Run + D is');
  const diag = stickKeys(1, [1, -1], true);
  assert.deepEqual(helmOver(diag), { turn: 1, move: [0, 0, 1] }, 'a full forward-right push rows and turns');
  assert.equal(helmOver(stickKeys(0.6, [1, 0], true)).turn, 1, 'a partial push turned before and still does');
});

test('AUDIT PRE-MERGE 0928 U3: off the helm the stick\'s 80% throw is still Run, and a host that hands no gate keeps it', () => {
  assert.ok(stickKeys(1, [0, -1], false).has('ShiftLeft'), 'not sailing: the full throw runs (TI1)');
  assert.ok(!stickKeys(0.6, [0, -1], false).has('ShiftLeft'), 'under the throw: a walk');
  const keys = new Set();
  defaultBindings();
  withTouch({ look() {}, attack() {}, tap() {} }, (e) => { if (e.type === 'keydown') keys.add(e.code); }, ({ canvas, ev }) => {
    canvas.fire('touchstart', ev('touchstart', 200, 400, 0));
    canvas.fire('touchmove', ev('touchmove', 200, 344, 50));
  });
  assert.ok(keys.has('ShiftLeft'), 'the other hosts pass no stickRuns: the layer runs as it did');
});

test('AUDIT PRE-MERGE 0928 D2/U5: Controls.md\'s defaults ARE generated from the registry - every group\'s rows, in order, key and pad and label, and no row the pane does not draw (the Come Sail Away table held two of its nine)', () => {
  const doc = readFileSync(new URL('../../bible/10-UI/Controls.md', import.meta.url), 'utf8').split('\n');
  const hidden = (a) => (HIDDEN_ACTIONS instanceof Set ? HIDDEN_ACTIONS.has(a) : Array.isArray(HIDDEN_ACTIONS) ? HIDDEN_ACTIONS.includes(a) : !!HIDDEN_ACTIONS?.[a]);
  const firstCode = (table, action) => { for (const [code, a] of table) if (a === action) return code; return null; };
  for (const g of ACTION_GROUPS) {
    const at = doc.findIndex((l) => l === `### ${g.title}` || l.startsWith(`### ${g.title} (`));
    assert.ok(at >= 0, `the page has a table for ${g.title}`);
    const rows = [];
    for (let i = at + 1; i < doc.length && !doc[i].startsWith('#'); i++) {
      const m = /^\| `(\w+)` \| (.*?) \| (.*?) \| (.*) \|$/.exec(doc[i]);
      if (m) rows.push([m[1], m[2], m[3], m[4]]);
    }
    const want = g.rows.filter((r) => !hidden(r.action)).map((r) => {
      const key = firstCode(DEFAULT_BINDINGS, r.action) ?? DEFAULT_SHARES.find(([, a]) => a === r.action)?.[0] ?? null, pad = firstCode(DEFAULT_SECONDARY_BINDINGS, r.action);   // HELM-KEYS: a default share's key is its key
      return [r.action, key ? buttonText(key, true) : '(unbound)', pad ? `\`${pad}\`` : '', r.label];
    });
    assert.deepEqual(rows, want, `${g.title}: the page's table is the registry's`);
  }
});
