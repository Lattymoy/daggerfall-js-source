// FIELD BUGS 2026-10-29 (bible/01-Overview/bugs/Field-Bugs-2026-10-29.md; the Discord, ItMustBeMonday: "someone in Iliac
// bay, can't sail no speed with the wind. Another person next to them can. Tried different ships and all sorts"). Two
// laws stopped every ship one player took, on the real runtime (test/csaScene.mjs, the real SpawnBoat and Animators):
// WIND-FIRST and NO-PIXEL - a boat with no map pixel threw in the boats' visibility, before a door's OnTransition laid the
// outdoors' wind, so the indoors' none stayed on the sea; CARGO-ASHORE - a wagon parked, stabled or following on foot was
// weighed against every hull. HEAVY-HINT: the helm says a load that holds her, while it holds her.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene } from '../../csaScene.mjs';
import { makeWorld } from '../../hccWorld.mjs';
import { WAGON_MODE } from '../../../src/systems/horse/horseCartLaw.js';
import { helmHint, helmHeavyText } from '../../../src/ui/enhanced/enhancedHelm.js';

const mag = (v) => Math.hypot(...v);
const KN = 3600 / 1852;
const mk = () => { const s = scene({ float: Array(80).fill(1.5), int: Array(80).fill(0) }); s.deps.handling = () => 'responsive'; return s; };
/** In through a door and out again, as worldModes.js raises Come Sail Away's OnTransition on each side. */
function door(s) {
  s.world.inside = true; s.rt.OnTransition();
  s.world.inside = false; s.rt.OnTransition();
}
/** Her way (knots) after 10 s under sail from rest. */
function sailed(s, boat) {
  s.helm(boat);
  s.frame();
  s.rt.ToggleSails();
  for (let t = 0; t < 10; t += 0.25) s.frame();
  return s.rt.helmPanelState().way * KN;
}

test('WIND-FIRST + NO-PIXEL the report: a boat of mine with no map pixel, a building entered and left - the door lays the outdoors\' wind and a Small Ship under sail makes way (it held the indoors\' none: 0 knots on every ship)', () => {
  const s = mk();
  const ship = s.place(2, 0);
  const lost = s.place(1, 0, [300, 34, 200]);
  lost.MapPixel = null;
  assert.doesNotThrow(() => door(s), 'the door\'s visibility reads her');
  assert.ok(mag(s.rt.state.windVectorCurrent) > 0.5, `a wind outdoors (${mag(s.rt.state.windVectorCurrent).toFixed(2)})`);
  assert.deepEqual(lost.MapPixel, { X: 10, Y: 20 }, 'NO-PIXEL: she takes the pixel she stands on');
  const kn = sailed(s, ship);
  assert.ok(kn > 2, `under sail at ${kn.toFixed(2)} kn`);
});

test('WIND-FIRST: a door whose boats cannot be read at all still lays its wind first - the throw no longer strands the indoors\' none on the sea', () => {
  const s = mk();
  s.place(2, 0);
  s.world.inside = true; s.rt.OnTransition();
  assert.deepEqual(s.rt.state.windVectorCurrent, [0, 0, 0], 'indoors: none, as the mod\'s');
  s.deps.terrainAt = () => { throw new Error('a pixel the visibility cannot read'); };
  s.world.inside = false;
  assert.throws(() => s.rt.OnTransition(), /cannot read/);
  assert.ok(mag(s.rt.state.windVectorCurrent) > 0.5, 'the wind was laid before the boats were asked');
});

test('WIND-FIRST + NO-PIXEL a load: a save made indoors with a boat of no pixel loads outdoors - the restore stands her where she lies and SAIL-WIND\'s check lays a wind before the boats are shown', () => {
  const a = mk();
  const b = a.place(1, 0, [300, 34, 200]);
  b.MapPixel = null;
  a.world.inside = true; a.rt.OnTransition();
  const save = JSON.parse(JSON.stringify(a.rt.getSaveData()));
  assert.deepEqual([save.placedBoats[0].MapPixel, save.windVector], [null, { x: 0, y: 0, z: 0 }], 'the record: no pixel, the indoors\' none');
  const s = mk();
  assert.doesNotThrow(() => { s.rt.restoreSaveData(JSON.parse(JSON.stringify(save))); s.rt.OnLoad(); });
  assert.deepEqual(s.rt.AllBoats[0].MapPixel, { X: 10, Y: 20 });
  assert.ok(mag(s.rt.state.windVectorCurrent) > 0.5, 'a wind outdoors');
  // and a load whose boats cannot be read still lays it (SAIL-WIND's check is OnLoad's first)
  const t = mk();
  t.deps.terrainAt = () => { throw new Error('a pixel the visibility cannot read'); };
  t.rt.restoreSaveData(JSON.parse(JSON.stringify({ ...save, placedBoats: [] })));
  t.place(1, 0);
  assert.throws(() => t.rt.OnLoad(), /cannot read/);
  assert.ok(mag(t.rt.state.windVectorCurrent) > 0.5, 'laid before the boats');
});

/** CARGO-ASHORE: the world host's own word for the wagon's load (world.js, Come Sail Away's `entity.wagonWeight`), read off
 *  its source and run over a stand-in Horse Cart and Cargo - the line the game runs, not a copy of it. */
function hostWagonWeight({ hcc, withPlayer, kg }) {
  const src = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const at = src.indexOf('wagonWeight: () => ', src.indexOf('createComeSailAwayRuntime({'));
  const line = src.slice(at + 'wagonWeight: () => '.length, src.indexOf('\n', at)).replace(/,\s*(\/\/.*)?$/, '');
  // eslint-disable-next-line no-new-func
  const run = new Function('hccOn', 'hccRuntime', 'totalWeight', 'playerEntity', `return ${line};`);
  return run(() => hcc, { wagonWithPlayer: () => withPlayer }, (items) => items.reduce((a, it) => a + it.kg, 0), { wagonItems: [{ kg }] });
}

test('CARGO-ASHORE: the host weighs a loaded Open Wagon (1,500 kg) on her only while it is in its owner\'s keeping, or with Horse Cart and Cargo off - ashore the Large Boat and the Small Ship sail, aboard the Large Boat lies dead (the mod\'s law)', () => {
  assert.deepEqual([hostWagonWeight({ hcc: true, withPlayer: true, kg: 1500 }), hostWagonWeight({ hcc: true, withPlayer: false, kg: 1500 }), hostWagonWeight({ hcc: false, withPlayer: false, kg: 1500 })], [1500, 0, 1500]);
  const run = (hull, withPlayer) => {
    const s = mk();
    s.deps.entity.wagonWeight = () => hostWagonWeight({ hcc: true, withPlayer, kg: 1500 });
    s.deps.entity.carriedWeight = () => 120;
    return sailed(s, s.place(hull, 0));
  };
  assert.ok(run(1, false) > 4, 'ashore: the Large Boat makes way');
  assert.ok(run(2, false) > 15, 'ashore: the Small Ship makes her whole way');
  assert.equal(run(1, true), 0, 'aboard: the Large Boat lies dead, the mod\'s law');
  assert.ok(run(2, true) < 5, 'aboard: the Small Ship at a fifth of her way');
});

test('CARGO-ASHORE: the wagon is in its owner\'s keeping only on foot beside them (WithPlayer) - parked at a door, or sent to the stable, it stays ashore (Horse Cart and Cargo\'s own record)', () => {
  const h = makeWorld();
  h.step();
  assert.equal(h.rt.wagonWithPlayer(), true, 'beside its owner');
  h.rt.handlePreTransition({ type: 'ToBuildingInterior', door: [h.w.pos[0], 0, h.w.pos[2] + 2] });
  h.w.mode = 0; h.w.inside = true; h.w.building = true;
  h.rt.handleSuccessfulInteriorTransition({ type: 'ToBuildingInterior', buildingKey: 7 });
  h.step();
  assert.equal(h.state().Mode, WAGON_MODE.Deployed);
  assert.equal(h.rt.wagonWithPlayer(), false, 'parked at the door');
  const st = makeWorld();
  st.step();
  assert.equal(st.rt.sendTransportAway().ok, true);
  assert.deepEqual([st.state().Mode, st.state().WagonStabled], [WAGON_MODE.WithPlayer, true]);
  assert.equal(st.rt.wagonWithPlayer(), false, 'stabled');
});

test('HEAVY-HINT: a load that holds her to half her way or less is said on the helm\'s line while it holds her - in irons first, and a light load leaves the keys\' line', () => {
  const s = mk();
  s.deps.entity.wagonWeight = () => 1500;
  s.helm(s.place(1, 0));
  const h = s.rt.helmPanelState();
  assert.equal(h.heavy, true);
  assert.equal(helmHint(h, { keyOf: () => 'W' }), helmHeavyText());
  assert.equal(helmHint(h, { touch: true }), helmHeavyText(), 'on a touch screen too');
  assert.match(helmHint({ ...h, inIrons: true }, {}), /^In irons/);
  const light = mk();
  light.helm(light.place(1, 0));
  const l = light.rt.helmPanelState();
  assert.equal(l.heavy, false);
  assert.notEqual(helmHint(l, { keyOf: () => 'W' }), helmHeavyText());
});
