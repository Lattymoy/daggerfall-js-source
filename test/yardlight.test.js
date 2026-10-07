// YARD-LIGHT (2026-10-07, Discord through Mac - a lamp post and a torch standing in a yard at night, dark: "i wish lights
// worked outside.."; Mac: "I guess enhanced lighting isnt shown lantern light anymore?"). The town's own lanterns still
// lit; what stood dark was a YARD's lamp. A yard's piece carries no light of its own (net/decorLaw.js decorYardPieceOf -
// "an outdoor lamp is the town's"), and nothing lit it as the town either. Now a TEXTURE.210 flat standing in a yard
// lights as Daggerfall lights every one standing in a town block (RMBLayout.AddLight - world/cityLights.js): the town's
// lantern at the flat's top, in the lanterns' hours, colour and flicker, ranked with the street's own. Pinned through the
// real yard host (scenes/homeYards.js over scenes/decorRoom.js), the room's own law beside it (decor1.test.js holds the
// rest of it), and the world host's own night composition run out of its source over a real Renderer
// (test/yardLightRig.mjs). AUDIT YARD-LIGHT's laws are test/audityardlight.test.js's. `06-Systems/Online-Arc.md`
// YARD-LIGHT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yardLampOf, yardLampSlot, YARD_LAMP, YARD_LAMP_RAISE } from '../src/scenes/homeYards.js';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { CITY_LIGHT_RANGE, CITY_LIGHT_INTENSITY, CITY_LIGHT_COLOR } from '../src/world/cityLights.js';
import { decorYardPieceOf } from '../src/net/decorLaw.js';
import { yardWorld, yardPiece, sized, settle } from './decorFakes.mjs';
import { exteriorFrame, streetColor, same } from './yardLightRig.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const at = (l) => [l.x, l.y, l.z].map(r6);

test('YARD-LIGHT the law: a yard\'s TEXTURE.210 flat gives the town\'s lantern (DaggerfallLight [City] - range 18, intensity 1, white) with its flicker slot, hung where the town hangs its own - the drawn top and YARD_LAMP_RAISE; any other piece, and a lamp whose picture has not stood, gives none; the piece itself still carries no light of its own (mutants: YARDLIGHT-any-flat, YARDLIGHT-at-middle, YARDLIGHT-before-its-picture, YARDLIGHT-not-the-town\'s)', () => {
  assert.deepEqual([CITY_LIGHT_RANGE, CITY_LIGHT_INTENSITY, [...CITY_LIGHT_COLOR]], [18, 1, [1, 1, 1]], 'the [City] prefab\'s');
  assert.deepEqual(YARD_LAMP, { range: CITY_LIGHT_RANGE, intensity: CITY_LIGHT_INTENSITY, color: CITY_LIGHT_COLOR });
  const post = { id: 'lamp', model: null, flat: [210, 29], scale: 1 };
  assert.deepEqual(yardLampOf(post, { w: 0.6, h: 3.2 }), { light: { ...YARD_LAMP, slot: yardLampSlot('lamp') }, lift: 3.2 + YARD_LAMP_RAISE },
    'the town\'s lantern and its flicker slot, at its top and the town\'s raise over it');
  assert.equal(yardLampOf({ id: 'crate', model: null, flat: [211, 3], scale: 1 }, { w: 1, h: 2 }), null, 'any other flat');
  assert.equal(yardLampOf({ id: 'chair', model: 41000, flat: null, scale: 1 }, null), null, 'a model');
  assert.equal(yardLampOf(post, null), null, 'a lamp whose picture has not stood yet');
  assert.equal(yardLampOf(post, { w: 0.6, h: 0 }), null);
  // HOME-YARD's own law stands: a yard's piece is stored with no light - the lamp is the town's, never the piece's
  const lit = { id: 'y1', model: null, flat: [210, 29], pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: { color: [1, 1, 1], range: 5, intensity: 1 }, storage: false, paid: 10 };
  assert.equal(decorYardPieceOf(lit), null, 'no light of its own');
  assert.ok(decorYardPieceOf({ ...lit, light: null }), 'and stood without one');
});

test('YARD-LIGHT the flicker: each lamp\'s slot on the town\'s animator is named by its piece (FNV-1a of its id), so it keeps its own flicker whatever else stands (mutants: YARDLIGHT-slot-basis, YARDLIGHT-slot-prime, YARDLIGHT-slot-signed)', () => {
  assert.deepEqual(['', 'a', 'foobar', 'lamp', 'torch'].map(yardLampSlot), [0x811c9dc5, 0xe40c292c, 0xbf9cf968, 1810951995, 2922681633], 'FNV-1a, 32 bits, unsigned');
  assert.equal(yardLampSlot(undefined), yardLampSlot(''));
});

/** decorRoom's own pool over one TEXTURE.210 and one other flat archive, lit by `lampOf` (a yard's) or not (a room's). */
function pool({ lampOf = null } = {}) {
  const lights = [];
  const origin = [10, 0, 10];
  const tex = { recordCount: 30, getSize: () => ({ width: 24, height: 112 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const room = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels: new Map() },
    renderer: { createBillboardBatch: (a, r, size, centers) => ({ a, r, size, centers }), destroyBillboardBatch() {}, drawMesh() {} },
    getTexture: async (a) => (a === 210 || a === 211 ? tex : null), uploadRecord() {}, uploadRecordFrame() {},
    collider: () => ({ addMesh() {}, removeBucket() {} }), origin: () => origin, roomLights: () => lights,
    ...(lampOf ? { lampOf } : {}),
  });
  return { room, lights, origin };
}

test('YARD-LIGHT the room\'s machinery under the host\'s law: with `lampOf` a lamp\'s light is the law\'s - its fields riding the light the room keeps - mounted once its picture stands, where the law hangs it, the piece\'s own light never asked; without it a room\'s piece gives the light it carries, as ever (mutants: YARDLIGHT-room-law-lost, YARDLIGHT-own-light-asked, YARDLIGHT-lift-ignored)', async () => {
  const yard = pool({ lampOf: yardLampOf });
  const h = sized(24, 112, 1.5).h;
  yard.room.put({ id: 'lamp', model: null, flat: [210, 29], pos: [8, 0, 2], rot: [0, 0, 0], scale: 1.5, light: null, storage: false, paid: 10 });
  // a lit crate no producer mints for a yard (decorYardPieceOf refuses it) - the host's law answers for it all the same
  yard.room.put({ id: 'lit-crate', model: null, flat: [211, 3], pos: [-4, 0, 1], rot: [0, 0, 0], scale: 1, light: { color: [1, 0, 0], range: 6, intensity: 2 }, storage: false, paid: 10 });
  assert.equal(yard.lights.length, 0, 'a lamp waits for its picture');
  await settle(); await settle();
  assert.equal(yard.lights.length, 1, 'the lamp alone - the crate\'s own light is never asked under the host\'s law');
  assert.deepEqual(at(yard.lights[0]), [18, r6(h + YARD_LAMP_RAISE * 1.5), 12], 'at its base, its drawn top and the town\'s raise, its scale with it');
  assert.deepEqual({ ...yard.lights[0], x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, range: 18 * 1.5, intensity: 1, color: [1, 1, 1], decor: 'lamp', slot: yardLampSlot('lamp') });
  yard.room.remove('lamp');
  assert.equal(yard.lights.length, 0, 'taken down with its piece');

  // a room: the piece's own light, where decorLightLift hangs it (decor1.test.js pins the rest)
  const room = pool();
  room.room.put({ id: 'lit-crate', model: null, flat: [211, 3], pos: [-4, 0, 1], rot: [0, 0, 0], scale: 1, light: { color: [1, 0, 0], range: 6, intensity: 2 }, storage: false, paid: 10 });
  room.room.put({ id: 'lamp', model: null, flat: [210, 29], pos: [8, 0, 2], rot: [0, 0, 0], scale: 1.5, light: null, storage: false, paid: 10 });
  await settle(); await settle();
  assert.equal(room.lights.length, 1, 'a room\'s unlit lamp stays unlit - the owner lights it');
  assert.deepEqual(at(room.lights[0]), [6, r6(sized(24, 112).h / 2), 11], 'the crate\'s own, at its middle');
  assert.deepEqual({ ...room.lights[0], x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, range: 6, intensity: 2, color: [1, 0, 0], decor: 'lit-crate' }, 'the piece\'s own light and nothing more');
});

test('YARD-LIGHT the yards\' lamps: a lamp post standing in a yard is a lamp where it stands in the scene - its yard\'s frame, its place, its drawn top and the town\'s raise; any other piece gives none; a recentre moves it in place; a piece taken down takes its lamp, and a pixel gone its yard\'s (mutants: YARDLIGHT-yard-unlit, YARDLIGHT-lamps-unrefilled)', async () => {
  const pieces = [yardPiece({ id: 'lamp', flat: [210, 29], scale: 1.5 }), yardPiece({ id: 'crate', flat: [211, 3], pos: [-8, 0, 2], scale: 1 }), yardPiece({ id: 'bush', pos: [0, 0, -6] })];
  const w = yardWorld({ pieces, sizes: { 210: [24, 112], 211: [20, 30] } });
  await w.run();
  const y = r6(sized(24, 112, 1.5).h + YARD_LAMP_RAISE * 1.5);
  const lamps = w.yards.lamps();
  assert.equal(lamps.length, 1, 'the lamp post - neither the crate nor the bush');
  assert.deepEqual(at(lamps[0]), [18, y, 12], 'its yard\'s frame (10, 0, 10), its place (8, 0, 2), its drawn top and the raise');
  assert.equal(lamps[0].decor, 'lamp');
  assert.equal(w.yards.lamps(), lamps, 'one list, refilled');
  assert.equal(lamps.length, 1, 'refilled, never grown');
  // the world recentres: moved in place, at once (FB1001 YARD-RECENTRE)
  w.shift[0] = -100;
  w.yards.rebase();
  assert.deepEqual(at(w.yards.lamps()[0]), [-82, y, 12]);
  w.shift[0] = 0;
  w.yards.rebase();
  // taken down: the town's answer without it
  w.town.pieces = pieces.filter((p) => p.id !== 'lamp');
  w.clock.t += 61_000;
  await w.run();
  assert.equal(w.yards.lamps().length, 0, 'gone with its piece');
  w.town.pieces = pieces;
  w.clock.t += 61_000;
  await w.run();
  assert.equal(w.yards.lamps().length, 1, 'and back with it');
  w.built.clear();
  await w.run();
  assert.equal(w.yards.lamps().length, 0, 'gone with its pixel');
});

test('YARD-LIGHT the world host lights them as the town\'s own: in the lanterns\' hours (inside its night block, after the animator\'s tick), among the scene lights beside the quays\' lanterns - ranked with the street\'s in the one selection, never the player\'s extras - in the town lanterns\' colour, from its rows refilled in place (mutants: YARDLIGHT-host-unwired, YARDLIGHT-host-by-day, YARDLIGHT-host-white)', () => {
  const s = src('src/scenes/world.js');
  assert.match(s, /import \{ createHomeYards, yardLampRows \} from '\.\/homeYards\.js';/);
  const line = s.split('\n').find((l) => l.includes('yards.lamps()'));
  assert.ok(line, 'the yards\' lamps are asked');
  assert.equal(line.trim(), 'if (yards) yardLampRows(yards.lamps(), _yardRows, worldLightAnimator.ranges, CITY_LIGHT_COLOR_F32, csaLit);');
  const asked = s.indexOf(line), quays = s.indexOf('for (const l of quays?.lights() ?? []) csaLit.push(');
  const night = s.indexOf('    if (lightsOnAt(minute)) {\n      worldLightAnimator.tick(dt);\n');
  const pick = s.indexOf('const wodSel = wodLit || csaLit.length ? _wodSelect(n, _csaFill(wodLit ? _wodFill(n) : n, csaLit)) : null;');
  assert.ok(quays > 0 && night > quays && asked > night && pick > asked, 'in the night block after the tick, after the quays\' lanterns, before the night\'s one selection reads the scene lights');
  assert.equal(s.split('yards.lamps()').length, 2, 'asked once a frame');
  assert.match(s, /\n {2}const _yardRows = \[\];/, 'the rows the host keeps');
});

test('YARD-LIGHT the world host\'s own composition, run: by night a yard\'s lamp reaches the renderer as the street\'s lanterns do - their colour (white on the classic set, the lane\'s flame on the lane), the town\'s flicker at its slot - ranked by distance with them (the classic cap of sixteen keeps the nearest, a far lamp left out); by day it gives no light (mutants: YARDLIGHT-host-unwired, YARDLIGHT-host-by-day, YARDLIGHT-host-white, YARDLIGHT-host-steady)', () => {
  const eye = [0, 1.7, 0];
  const town = Array.from({ length: 20 }, (_, i) => ({ x: Math.cos(i) * (4 + i * 1.4), y: 3, z: Math.sin(i) * (4 + i * 1.4) }));   // 4 to 30.6 m off
  const ranges = new Float32Array(64).fill(18);
  const near = { x: 2.5, y: 4.2, z: 1, decor: 'lamp', slot: yardLampSlot('lamp'), range: 18 }, far = { x: 60, y: 4.2, z: 0, decor: 'far-lamp', slot: yardLampSlot('far-lamp'), range: 18 };
  ranges[near.slot % 64] = 17.2;   // the town's animator, this lamp's slot mid-flicker
  for (const lane of [false, true]) {
    const want = streetColor(lane);
    const lit = exteriorFrame({ lane, night: true, town, lamps: [near, far], eye, ranges });
    const mine = lit.find((l) => same(l.at, [near.x, near.y, near.z]));
    assert.ok(mine, `${lane ? 'lane' : 'classic'}: the yard's lamp reaches the renderer by night`);
    assert.ok(same(mine.color, want), `${lane ? 'lane' : 'classic'}: in the street lanterns' colour, ${mine.color.map((v) => v.toFixed(3))}`);
    assert.ok(Math.abs(mine.range - 17.2) < 1e-6, `${lane ? 'lane' : 'classic'}: on the town's flicker, at its slot (${mine.range})`);
    for (const l of lit) if (l !== mine) assert.ok(same(l.color, want), 'the street keeps its own colour');
    if (!lane) {
      assert.equal(lit.length, 16, 'the classic cap');
      assert.equal(lit.some((l) => same(l.at, [far.x, far.y, far.z])), false, 'a lamp farther than the sixteen nearest is left out - ranked with the street, never ahead of it');
    } else assert.ok(lit.some((l) => same(l.at, [far.x, far.y, far.z])), 'the lane\'s forty-eight hold it');
    const day = exteriorFrame({ lane, night: false, town, lamps: [near, far], eye, ranges });
    assert.equal(day.length, 0, `${lane ? 'lane' : 'classic'}: by day the town's lamps are out, and the yard's with them`);
  }
});
