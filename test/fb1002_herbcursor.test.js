// HERB-CURSOR (FIELD BUGS 2026-10-02 part four; #bug-reports, "Herbalism minigame bugged": "Doesn't make mouse appear
// when the minigame starts, so cant click on the targets"; Mac: "Also check the other minigames"). The Basket's glints
// stand about the crosshair (ui/profReticle.js BASKET_SPREAD), where no look reaches them - with the mouse locked to the
// look, moving it toward a glint turned the view and the glint with it. Its act now holds the cursor free while it
// plays (player/pointerLock.js holdCursor - not the player's own FreeMouse toggle) and hands the look back as it ends,
// however it ends. The other acts, checked: a vein's points and a body's line are aimed by the look itself, so a mouse
// the player freed is taken back for them; the ring, the hold and the net need neither. bible/01-Overview/
// Field-Bugs-2026-10-02.md, part four.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { holdCursor, cursorHeld, requestLook, bindCursorToggle, setCursorActive } from '../src/player/pointerLock.js';
import { setForagingHost, createForagingItem, installForaging, _setForagingRandomForTests } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { createGatherHost, aimAt, ACT_POINTER } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { veins, utcDayOfMs } from '../src/net/nodeLaw.js';
import { BASKET_ACT } from '../src/net/professionLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

installForaging({ fetchBytes: async () => new Uint8Array(0) });

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const CLEARING = Object.freeze([400, 0, 400]);
const tick = () => new Promise((r) => setImmediate(r));
const NONE = Object.freeze({ held: false, attack: false, choice: false });

/** A canvas whose lock is a flag, and a document that holds it: what the browser does with a request and a release. */
function withLockDom(fn) {
  const prev = globalThis.document;
  const canvas = { asked: 0, requestPointerLock() { this.asked++; globalThis.document.pointerLockElement = canvas; } };
  const doc = { pointerLockElement: canvas, exits: 0, on: new Map(), exitPointerLock() { this.exits++; this.pointerLockElement = null; }, addEventListener(t, f) { this.on.set(t, f); } };
  globalThis.document = doc;
  return Promise.resolve().then(() => fn(canvas, doc)).finally(() => { globalThis.document = prev; setCursorActive(false); });
}

/** The gathering host over one Woodlands pixel at noon, the Basket, the Sickle and the Pick-Axe in the pack; `pointer`
 *  world.js's seam, recorded - each ask and each release. */
async function stage() {
  _resetModSettings();
  globalThis.location = { search: '?online=1' };
  const S = { asked: [], said: [], meter: null, pointer: [], input: NONE };
  S.e = { stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45 }, items: [FT.Basket, FT.Sickle, FT.PickAxe].map((t) => createForagingItem(t)), wagonItems: [], fatigue: 40 * FATIGUE_MULTIPLIER, health: 20, maxHealth: 100, magicka: 5, maxMagicka: 50 };
  const book = S.book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const entry = {
    px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2),
    locationRect: null, batches: [], rocks: law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]),
  };
  const feet = [...CLEARING];
  const view = { yaw: 0, pitch: 0 };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  S.window = false;
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book })],
    hud: {
      setPrompt: () => {}, setMeter: (a) => { S.meter = a ? a.state.kind : null; S.act = a ?? S.act; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map([[`${PX},${PY}`, entry]]), pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: (a) => ({ Interact: 'E', ActChoice: 'Up' })[a] ?? '?', input: () => S.input,
    active: () => !S.window, activeDungeon: () => false,
    plaque: () => true, lit: () => S.lit ?? null, choose: () => false, step: () => true,
    pointer: (want) => { S.pointer.push(want); return () => S.pointer.push(`${want} let go`); },
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  _setForagingRandomForTests(() => 0.99);
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  /** Stand a metre and a half south of a node and look at it. */
  S.face = (n) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  S.away = () => { feet.splice(0, 3, ...CLEARING); S.host.tick(0.016); };
  /** The Basket's search started at a patch (its row lit, E pressed). */
  S.basket = (patch) => { S.face(patch); S.lit = 'food'; const took = S.host.press(); S.lit = null; return took; };
  S.done = () => { S.host.dispose(); _setForagingRandomForTests(null); setForagingHost(null); delete globalThis.location; };
  return S;
}

test('HERB-CURSOR the law: the Basket holds the cursor free; the acts aimed by the look (a vein, a body, the net\'s throw - AUDIT C1) take the look; the ring, the hand and the steady hold leave the mouse alone (mutants: the Basket unlisted; a look act unlisted)', () => {
  assert.deepEqual({ ...ACT_POINTER }, { basket: 'cursor', mine: 'look', trace: 'look', fish: 'look' });
});

test('HERB-CURSOR the hold: held, no request takes the lock - the release says whether it was the last, once; a host\'s boot clears a hold its last host never let go (mutants: requestLook unguarded; the hold keeping the lock; the late lock kept; the release twice; the boot not clearing)', () => withLockDom((canvas, doc) => {
  const off = holdCursor();
  assert.deepEqual([doc.exits, doc.pointerLockElement, cursorHeld()], [1, null, true], 'the lock let go as the hold is taken: the cursor shows');
  requestLook(canvas);
  assert.equal(canvas.asked, 0, 'a click\'s relock arm, a window\'s close, the look gate: none takes the lock under the hold');
  const second = holdCursor();
  assert.equal(off(), false, 'another still holds it');
  requestLook(canvas);
  assert.equal(canvas.asked, 0);
  assert.equal(second(), true, 'the last let go');
  assert.equal(second(), false, 'once-only');
  assert.equal(cursorHeld(), false);
  requestLook(canvas);
  assert.equal(canvas.asked, 1, 'the look is the host\'s to take back');
  // AUDIT OW5 V1's law: a lock the browser grants late, over a hold taken after it was asked, is let go
  const late = holdCursor();
  const exits = doc.exits;
  doc.pointerLockElement = canvas;
  doc.on.get('pointerlockchange')?.();
  assert.deepEqual([doc.exits, doc.pointerLockElement], [exits + 1, null], 'the late lock let go - the cursor stays');
  late();
  holdCursor();   // never let go - its host gone
  const prevAdd = globalThis.addEventListener;
  globalThis.addEventListener = () => {};
  try { bindCursorToggle(canvas, () => false, () => [])(); } finally { globalThis.addEventListener = prevAdd; }
  assert.equal(cursorHeld(), false, 'PL3\'s law: the bind is the reset');
}));

test('HERB-CURSOR the report, answered: the Basket\'s search frees the cursor as it starts, and the glint clicked finds it; the look is handed back at its end (mutants: no ask; never let go; let go before the end)', async () => {
  const s = await stage();
  try {
    const patch = s.nodes('herb')[0];
    assert.equal(s.basket(patch), true);
    assert.deepEqual(s.pointer, ['cursor'], 'asked in the press\'s own frame - the meter not yet drawn');
    s.host.tick(0.016);
    assert.equal(s.meter, 'basket');
    // the three glints, each clicked as it shows
    for (let i = 0; i < 400 && s.host.acting(); i++) {
      s.input = s.act.state.spot >= 0 ? { ...NONE, attack: true } : NONE;
      s.host.tick(0.05);
      if (s.host.acting()) assert.deepEqual(s.pointer, ['cursor'], 'held through the search');
    }
    s.input = NONE;
    assert.equal(s.host.acting(), false);
    assert.deepEqual(s.pointer, ['cursor', 'cursor let go'], 'the look handed back');
    assert.deepEqual(s.asked.map((h) => [h.node, h.kind, h.act?.finds]), [[patch.key, 'food', BASKET_ACT.finds]], 'every glint clicked was found');
    s.host.tick(0.016);
    assert.deepEqual(s.pointer, ['cursor', 'cursor let go'], 'let go once');
  } finally { s.done(); }
});

test('HERB-CURSOR every end gives the mouse back: Escape, walking off, a window over it, the professions shut, `dispose` (no host calls it yet: a new host\'s boot clears a hold left over, above) (mutants: one end path unsynced)', async () => {
  const ends = {
    escape: (s) => { assert.equal(s.host.cancel(), true); },
    walk: (s) => { s.away(); },
    window: (s) => { s.window = true; s.host.tick(0.016); s.window = false; },
    shut: (s) => { s.book.state.open = false; s.host.tick(0.016); },
    dispose: (s) => { s.host.dispose(); },
  };
  for (const [name, end] of Object.entries(ends)) {
    const s = await stage();
    try {
      assert.equal(s.basket(s.nodes('herb')[0]), true, name);
      s.host.tick(0.016);
      end(s);
      assert.equal(s.host.acting(), false, name);
      assert.deepEqual(s.pointer, ['cursor', 'cursor let go'], `${name}: let go`);
    } finally { if (name !== 'dispose') s.done(); else { _setForagingRandomForTests(null); setForagingHost(null); delete globalThis.location; } }
  }
});

test('HERB-CURSOR the other acts: a vein asks the look (its points are aimed by it); a common herb\'s hand and the Sickle\'s steady hold ask nothing (mutants: the vein\'s ask lost; every act frees the cursor)', async () => {
  const s = await stage();
  try {
    const vein = s.nodes('mine')[0];
    assert.ok(vein, 'a vein stood');
    s.face(vein);
    assert.equal(s.host.press(), true);
    s.host.tick(0.016);
    assert.equal(s.meter, 'mine');
    assert.deepEqual(s.pointer, ['look'], 'the look taken back from a freed mouse');
    s.host.cancel();
    s.pointer.length = 0;
    // a common herb, by hand; then a patch stood again at tier 2 (the host's own list, test/fb0930b_toolsaid's retier): the Sickle
    const [common, other] = s.nodes('herb');
    const list = s.host.nodesOf(PX, PY);
    const sickled = { ...other, tier: 2 };
    list.splice(list.indexOf(other), 1, sickled);
    for (const [patch, kind] of [[common, 'hand'], [sickled, 'steady']]) {
      s.face(patch);
      s.lit = 'herbs';
      assert.equal(s.host.press(), true, kind);
      s.input = { ...NONE, held: true };   // E held, as the steady hold asks
      s.host.tick(0.016);
      s.input = NONE;
      assert.equal(s.meter, kind);
      assert.deepEqual(s.pointer, [], `${kind}: the crosshair's - the mouse as it was`);
      s.host.cancel();
    }
  } finally { s.done(); }
});

test('HERB-CURSOR the world\'s seam, by source: the Basket\'s hold, and the look asked back at its release only where nothing else holds the mouse - the player\'s own freed cursor, a window, a surface, an overlay, the travel view; a look act takes back a cursor the player freed under the same gates (its behaviour, and the Escape\'s keyup, are test/fb1002_herbcursor_audit.test.js\'s) (mutants: the seam unpassed; the relock ungated)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const seam = w.match(/ pointer: \(want\) => \{[^\n]*?\}; \},/)?.[0] ?? '';
  assert.ok(seam, 'createGatherHost is handed the pointer');
  assert.match(seam, /const relock = \(\) => \{ if \(!cursorActive\(\) && !gamePaused\(\) && !pointerSurfaces\.size && !\(modes\?\.modalWindowUp\?\.\(\) \?\? false\) && !overlayOpen\(\) && !travelView\?\.active\) requestLook\(canvas\); \};/);
  assert.match(seam, /if \(want === 'look'\) \{ if \(cursorActive\(\)\) \{ setCursorActive\(false\); relock\(\); \} return null; \}/);
  assert.match(seam, /const off = holdCursor\(\); return \(\) => \{ if \(!off\(\)\) return;/);
});
