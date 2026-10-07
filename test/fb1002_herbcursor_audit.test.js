// AUDIT of HERB-CURSOR (FIELD BUGS 2026-10-02 part four; Mac: "Audit this"). Four lenses over the batch as committed
// (8e5dcbe2), each against the base (1d2e8ce8): A the mouse and the lock in a browser, B the gathering host's acts and
// the click, C every other minigame, D the records. Every finding was reproduced red here first; world.js's own lines
// (the pointer seam, the Escape's keyup, the street ladder's act click) are lifted out of the source and run over the
// real pointerLock.js, activateGate.js and gathering host, as test/fb1001_audit.test.js lifts the ladder.
// bible/01-Overview/Field-Bugs-2026-10-02.md, part four's audit.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { holdCursor, cursorHeld, cursorActive, setCursorActive, requestLook, bindCursorToggle } from '../src/player/pointerLock.js';
import { createActivateGate, activateFrame } from '../src/systems/activateGate.js';
import { setForagingHost, createForagingItem, installForaging, _setForagingRandomForTests } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { createGatherHost, aimAt, ACT_POINTER, actPointer } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { createHerbAct } from '../src/systems/herbAct.js';
import { veins, utcDayOfMs } from '../src/net/nodeLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

installForaging({ fetchBytes: async () => new Uint8Array(0) });
const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const RETICLE = readFileSync(new URL('../src/ui/profReticle.js', import.meta.url), 'utf8');

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const NONE = Object.freeze({ held: false, attack: false, choice: false });

/** A canvas whose lock is a flag and a document that holds it (test/fb1002_herbcursor.test.js's). */
function withLockDom(fn) {
  const prev = globalThis.document;
  const canvas = { asked: 0, requestPointerLock() { this.asked++; globalThis.document.pointerLockElement = canvas; } };
  const doc = { pointerLockElement: canvas, exits: 0, exitPointerLock() { this.exits++; this.pointerLockElement = null; }, addEventListener() {} };
  globalThis.document = doc;
  return Promise.resolve().then(() => fn(canvas, doc)).finally(() => { globalThis.document = prev; setCursorActive(false); });
}

/** The gathering host over a Woodlands pixel at noon (fb1002_herbcursor's stage), its `pointer` recorded, its HUD's
 *  frame made to throw on demand, and a plaque that lists the node under the look with its first row lit. */
async function stage() {
  _resetModSettings();
  globalThis.location = { search: '?online=1' };
  const S = { asked: [], pointer: [], input: NONE, throwFrame: false, act: null, label: null };
  S.e = { stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45 }, items: [FT.Basket, FT.Sickle, FT.PickAxe].map((t) => createForagingItem(t)), wagonItems: [], fatigue: 40 * FATIGUE_MULTIPLIER, health: 20, maxHealth: 100, magicka: 5, maxMagicka: 50 };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: (k, h) => S.asked.some((a) => a.node === k && a.kind === h),
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const entry = {
    px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2),
    locationRect: null, batches: [], rocks: law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]),
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  const rad = Math.PI / 180;
  S.lit = null;
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book })],
    hud: {
      setPrompt: () => {}, setMeter: (a, label) => { S.act = a ?? S.act; if (a) S.label = label; }, toast: () => {}, banner: () => {}, setChip: () => {}, dispose: () => {},
      frame: () => { if (S.throwFrame) throw new Error('the HUD fell over'); },
    },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map([[`${PX},${PY}`, entry]]), pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] }),
    view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: (a) => ({ Interact: 'E', ActChoice: 'Up' })[a] ?? '?', input: () => S.input,
    active: () => true, activeDungeon: () => false,
    plaque: () => true, lit: (key) => (S.lit && S.lit.key === key ? S.lit.id : null), choose: () => false, step: () => true,
    pointer: (want) => { S.pointer.push(want); return () => S.pointer.push(`${want} let go`); },
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  _setForagingRandomForTests(() => 0.99);
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  S.face = (n) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  /** The plaque's fold after the frame (world.js worldHoverFrame): the node under the look listed, a new node's first row lit. */
  S.fold = () => {
    const h = S.host.hoverHit(null);
    const named = h ? S.host.hoverName(h.key) : null;
    if (!named) { S.lit = null; return; }
    if (S.lit?.key !== h.key) S.lit = { key: h.key, id: named.actions[named.actionsStart ?? 0].id };
  };
  S.basket = (patch) => { S.face(patch); S.lit = { key: `prof:${patch.key}`, id: 'food' }; return S.host.press(); };
  S.done = () => { S.host.dispose(); _setForagingRandomForTests(null); setForagingHost(null); delete globalThis.location; resetPrefs(); };
  return S;
}

// ─── world.js's own lines, lifted ──────────────────────────────────────

/** The pointer seam handed to createGatherHost, as a function of the names it reads. */
function worldSeam(scope) {
  const m = WORLD.match(/ pointer: (\(want\) => \{[^\n]*?\}; \}),   \/\/ HERB-CURSOR/);
  assert.ok(m, 'world.js hands createGatherHost its pointer seam');
  return new Function('scope', `with (scope) { return (${m[1]}); }`)(scope);
}
/** The keyup listener's Escape arm. */
function worldEscapeUp(scope) {
  const m = WORLD.match(/addEventListener\('keyup', \(e\) => \{[^\n]*?(if \(e\.code === 'Escape' && escRelock\) \{ [^\n]*? \}) if \(e\.code === 'AltLeft'\)/);
  assert.ok(m, 'the keyup listener\'s Escape arm');
  return new Function('scope', 'e', `with (scope) { ${m[1]} }`).bind(null, scope);
}
/** The names the seam reads: every gate open, the Escape up, no pad; `requestLook` the real one over the fake canvas. */
function seamScope(canvas, over = {}) {
  return {
    cursorActive, setCursorActive, requestLook, holdCursor, canvas, gamePaused: () => false, pointerSurfaces: new Set(), modes: null,
    overlayOpen: () => false, travelView: null, controllerLook: () => false, backButtonHeld: false, escRelock: null, ...over,
  };
}

// ─── A: the mouse and the lock ──────────────────────────────────────────

test('AUDIT HERB-CURSOR A1: Escape ending the Basket asks the look back on the Escape\'s keyup, never inside its keydown - a lock taken there is the browser\'s to end on the keyup, and ESC-LOCK then read that loss as a second Escape and opened the pause (mutants: the relock inside the keydown; the keyup never asks)', () => withLockDom((canvas) => {
  const scope = seamScope(canvas);
  const up = worldEscapeUp(scope);
  const release = worldSeam(scope)('cursor');
  assert.equal(cursorHeld(), true);
  canvas.asked = 0;
  scope.backButtonHeld = true;   // the Escape that cancelled the act is down
  release();
  assert.equal(canvas.asked, 0, 'not inside the keydown');
  assert.equal(typeof scope.escRelock, 'function', 'kept for the keyup');
  scope.backButtonHeld = false;
  up({ code: 'Escape' });
  assert.deepEqual([canvas.asked, scope.escRelock], [1, null], 'asked on the keyup, once');
  up({ code: 'Escape' });
  assert.equal(canvas.asked, 1);
  // any other end (the search run out, a walk away): at once
  const again = worldSeam(scope)('cursor');
  again();
  assert.equal(canvas.asked, 2);
}));

test('AUDIT HERB-CURSOR A1: the keyup\'s relock keeps every gate - a window, a surface, the travel view or the player\'s own freed cursor come up by then hold it off (mutant: the keyup ungated)', () => withLockDom((canvas) => {
  for (const over of [{ gamePaused: () => true }, { pointerSurfaces: new Set(['chat']) }, { travelView: { active: true } }, { overlayOpen: () => true }]) {
    const scope = seamScope(canvas);
    const release = worldSeam(scope)('cursor');
    canvas.asked = 0;
    scope.backButtonHeld = true;
    release();
    Object.assign(scope, over);
    scope.backButtonHeld = false;
    worldEscapeUp(scope)({ code: 'Escape' });
    assert.equal(canvas.asked, 0, JSON.stringify(Object.keys(over)));
  }
}));

test('AUDIT HERB-CURSOR A2: FreeMouse pressed while an act holds the cursor is refused - it latched unseen (the cursor was already free) and kept the cursor free after the act, every click\'s relock refused (mutant: the toggle under a hold)', () => withLockDom((canvas) => {
  const prevAdd = globalThis.addEventListener, prevRemove = globalThis.removeEventListener;
  let onKey = null;
  globalThis.addEventListener = (t, f) => { if (t === 'keydown') onKey = f; };
  globalThis.removeEventListener = () => {};
  try {
    const unbind = bindCursorToggle(canvas, () => false, () => ['FreeMouse']);
    const press = () => onKey({ code: 'KeyY', isTrusted: true, preventDefault() {}, target: null });
    const off = holdCursor();
    try {
      press();
      assert.equal(cursorActive(), false, 'refused under the hold');
    } finally { off(); }
    press();
    assert.equal(cursorActive(), true, 'with no hold, the toggle as ever');
    press();
    unbind();
  } finally { globalThis.addEventListener = prevAdd; globalThis.removeEventListener = prevRemove; }
}));

test('AUDIT HERB-CURSOR A3/B1: an act\'s hold is let go at the next frame\'s start even when the HUD throws every frame - world.js swallows the throw, and a hold left standing refused every relock for the session (mutant: the frame\'s start unsynced)', async () => {
  const s = await stage();
  try {
    assert.equal(s.basket(s.nodes('herb')[0]), true);
    s.throwFrame = true;
    let frames = 0;
    for (; frames < 400 && s.host.acting(); frames++) { s.input = s.act?.state?.spot >= 0 ? { ...NONE, attack: true } : NONE; try { s.host.tick(0.05); } catch { /* world.js's catch */ } }
    s.input = NONE;
    assert.equal(s.host.acting(), false, `the search ended (${frames} frames)`);
    try { s.host.tick(0.016); } catch { /* and again */ }
    assert.deepEqual(s.pointer, ['cursor', 'cursor let go'], 'let go, the HUD still throwing');
  } finally { s.throwFrame = false; s.done(); }
});

test('AUDIT HERB-CURSOR A4/B4: a mine or a trace takes back a cursor the player freed, and asks the lock only where nothing holds the mouse - under the friends panel, the F-menu, a window or an overlay the flag goes and the surface\'s close relocks (mutant: the look branch ungated)', () => withLockDom((canvas) => {
  for (const [over, asks] of [[{}, 1], [{ pointerSurfaces: new Set(['friends']) }, 0], [{ gamePaused: () => true }, 0], [{ overlayOpen: () => true }, 0]]) {
    setCursorActive(true);
    canvas.asked = 0;
    const out = worldSeam(seamScope(canvas, over))('look');
    assert.deepEqual([out, cursorActive(), canvas.asked], [null, false, asks], JSON.stringify(Object.keys(over)));
  }
}));

test('AUDIT HERB-CURSOR C8: a pad in hand takes no hold - its trigger strikes, and the lock let go showed the OS pointer mid-screen (mutant: the hold whatever the hand)', () => withLockDom((canvas) => {
  const scope = seamScope(canvas, { controllerLook: () => true });
  assert.equal(worldSeam(scope)('cursor'), null);
  assert.equal(cursorHeld(), false);
}));

// ─── B: the click that ends the act ─────────────────────────────────────

/** The street ladder's act click and node click, lifted in their source order, and its condition. */
function streetLadder() {
  const ask = WORLD.match(/\n(\s*)const _actClick = (gatherHost\?\.clickTaken\(_activateDown\) \?\? false);[^\n]*\n/);
  const node = WORLD.match(/\n\s*const nodeClicked = ([^\n]*?profClickPress\(\));[^\n]*\n/);
  const cond = WORLD.match(/\n\s*if \((\(\(_act\.activate && [^\n]*?\) \|\| \(useEdge && !nodeTook\)\)) && !modes\.transitioning && !_holdFire\) \{/);
  assert.ok(ask && node && cond, 'the street ladder\'s lines');
  assert.ok(ask.index < node.index, 'the act\'s click is asked before the node\'s');
  const nodeFn = new Function('_act', 'gatherHost', 'useEdge', '_holdFire', 'modes', 'naval', 'profClickPress', '_actClick', `return ${node[1]};`);
  const condFn = new Function('_act', 'gatherHost', 'useEdge', 'nodeTook', '_actClick', 'nodeClicked', `return ${cond[1]};`);
  return (gate, host, down, now, profClickPress) => {
    const a = activateFrame(gate, { down, now });
    const actClick = host.clickTaken(down);
    const clicked = nodeFn(a, host, false, false, { transitioning: false }, null, profClickPress, actClick);
    return { clicked, ran: condFn(a, host, false, false, actClick, clicked) };
  };
}

test('AUDIT HERB-CURSOR B2: the release of the click that found the Basket\'s last glint presses nothing - it pressed the patch\'s lit "Pick" row and played a second act nobody asked for, a harvest and a Sickle\'s wear (pre-existing; the dungeon\'s ladder already asked the act\'s click first) (mutants: the node click before the act\'s; the node click ungated)', async () => {
  const s = await stage();
  try {
    const ladder = streetLadder();
    const gate = createActivateGate();
    const press = () => typeof s.lit?.key === 'string' && s.lit.id != null && s.host.press({ click: true });
    const patch = s.nodes('herb')[0];
    assert.equal(s.basket(patch), true);
    s.host.tick(0.016);
    let t = 100, clicks = 0;
    const frame = (down, dt) => { const r = ladder(gate, s.host, down, t += dt, press); s.host.tick(dt); s.input = NONE; s.fold(); return r; };
    for (let i = 0; i < 400 && s.host.acting(); i++) {
      if (s.act?.state?.spot >= 0) {
        s.input = { ...NONE, attack: true };
        const d = frame(true, 0.016);   // the press: the act's strike
        assert.deepEqual(d, { clicked: false, ran: false });
        for (let h = 0; h < 25; h++) frame(true, 0.016);   // held 0.4 s - past the free cursor's 0.3 s click delay
        const u = frame(false, 0.016);   // the release
        assert.deepEqual(u, { clicked: false, ran: false }, `click ${++clicks}'s release: nothing pressed, nothing run`);
      } else frame(false, 0.05);
    }
    assert.equal(s.host.acting(), false);
    assert.deepEqual(s.asked.map((h) => h.kind), ['food'], 'the Basket\'s harvest alone');
    // a click with no act is the node's, as ever
    s.lit = { key: `prof:${patch.key}`, id: 'herbs' };
    frame(true, 0.016);
    assert.equal(frame(false, 0.016).clicked, true, 'the next click presses the lit row');
  } finally { s.done(); }
});

// ─── C: the other minigames ─────────────────────────────────────────────

test('AUDIT HERB-CURSOR C1: the net\'s throw is aimed by the look (the school its release lands in) - the net takes the look as a vein and a body do (mutant: the net unlisted)', () => {
  assert.equal(ACT_POINTER.fish, 'look');
  assert.equal(actPointer({ kind: 'fish' }), 'look');
});

test('AUDIT HERB-CURSOR C2: an act played gently asks nothing of the mouse - its Basket has nothing to click, its vein and its body no aim - but the net\'s gentle throw is aimed still (mutants: gentle unread; the net\'s gentle throw unaimed)', async () => {
  for (const kind of ['basket', 'mine', 'trace']) assert.equal(actPointer({ kind, gentle: true }), null, kind);
  assert.equal(actPointer({ kind: 'fish', gentle: true }), 'look');
  assert.equal(createHerbAct({ kind: 'basket', gentle: true }).state.gentle, true, 'the herb act says it is gentle');
  assert.equal(createHerbAct({ kind: 'basket' }).state.gentle, false);
  const s = await stage();
  try {
    setPref('gentleActs', true);
    assert.equal(s.basket(s.nodes('herb')[0]), true);
    s.host.tick(0.016);
    assert.deepEqual([s.act?.state?.kind, s.act?.state?.gentle], ['basket', true]);
    assert.deepEqual(s.pointer, [], 'the gentle Basket: the mouse as it was');
  } finally { s.done(); }
});

test('AUDIT HERB-CURSOR C3: the Basket says to click the glint - "tap the glint" over a cursor held free told a mouse player nothing; a gentle Basket says it is searching (mutants: the old words; the gentle hint)', async () => {
  const s = await stage();
  try {
    assert.equal(s.basket(s.nodes('herb')[0]), true);
    s.host.tick(0.016);
    assert.equal(s.label, 'click the glint');
  } finally { s.done(); }
  assert.match(RETICLE, /hint: \(st, label\) => \(st\.gentle \? 'searching\.\.\.' : label \|\| 'click the glint'\),/);
});
