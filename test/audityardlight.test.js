// AUDIT YARD-LIGHT (2026-10-07, Mac: "audit this"; `06-Systems/Online-Arc.md` AUDIT YARD-LIGHT). Three cold reads and
// the author's own over YARD-LIGHT (a yard's TEXTURE.210 flat lights as the town's lantern), each finding fixed here and
// pinned: L1 a yard lights its first YARD_LAMPS_MAX lamps (the densest Daggerfall block stands eight; sixty round one
// lot were nine times its brightest ground); L2 no distance cuts a lamp (a cut at 300 m of the yard's origin put its lamps
// out unfaded beside the street's lit ones); L3 the flicker is read after the animator's tick, as the street's is; L4 the
// rows refilled in place, the slot set at mount (a night frame makes nothing for its lanterns); L5 the light hangs where
// the town hangs its own over a picture (blockFlatsOffsetY sinks the town's flats, never their lights - 0.15 m); L6 a
// scaled lamp is the lamp scaled, reach and all; and the lenses' pin gaps: many lamps in many yards, a recentre on all
// three axes. The rig is world.js's own night composition over a real Renderer (test/yardLightRig.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yardLampOf, yardLampSlot, yardLampRows, YARD_LAMP, YARD_LAMPS_MAX, YARD_LAMP_RAISE } from '../src/scenes/homeYards.js';
import { collectCityLights, CITY_LIGHT_RANGE } from '../src/world/cityLights.js';
import { collectBlockFlats, BLOCK_FLATS_OFFSET_Y } from '../src/world/rmbFlats.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { yardWorld, yardPiece, sized } from './decorFakes.mjs';
import { exteriorFrame, same } from './yardLightRig.mjs';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const at = (l) => [l.x, l.y, l.z].map(r6);
const lamp = (id, x, z = 2, over = {}) => yardPiece({ id, flat: [210, 29], pos: [x, 0, z], scale: 1, ...over });

test('AUDIT YARD-LIGHT L1: a yard lights its first YARD_LAMPS_MAX lamps - eight, the most TEXTURE.210 flats any Daggerfall town block stands - in the order its pieces stand (placed); a lamp past them stands unlit, and lights when one before it is taken down (mutants: AUDITYL-cap-lifted, AUDITYL-cap-unread, AUDITYL-cap-order)', async () => {
  assert.equal(YARD_LAMPS_MAX, 8, 'GRVEAL01, GRVEAS01, GRVEAM01, CUSTAA02 and CUSTAA04 stand eight; no block of the 920 stands more');
  const pieces = Array.from({ length: 10 }, (_, i) => lamp(`l${i}`, -9 + i * 2));
  const w = yardWorld({ pieces, sizes: { 210: [24, 112] } });
  await w.run();
  assert.deepEqual(w.yards.lamps().map((l) => l.decor), ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'], 'the first eight it stands');
  w.town.pieces = pieces.filter((p) => p.id !== 'l3');
  w.clock.t += 61_000;
  await w.run();
  assert.deepEqual(w.yards.lamps().map((l) => l.decor), ['l0', 'l1', 'l2', 'l4', 'l5', 'l6', 'l7', 'l8'], 'one taken down: the ninth lights');
});

test('AUDIT YARD-LIGHT L2: no distance cuts a yard\'s lamp - a yard a kilometre from the eye still hands its lamps, and the night\'s one selection ranks a far lamp with the street\'s: past 300 m of the eye it is lit while the cap holds room, on both lanes (mutant: AUDITYL-distance-cut)', async () => {
  const w = yardWorld({ pieces: [lamp('lamp', 8)], sizes: { 210: [24, 112] } });
  await w.run();
  w.shift[0] = -1000;
  w.yards.rebase();
  assert.equal(w.yards.lamps().length, 1, 'a kilometre off, still the selection\'s to rank');
  const eye = [0, 1.7, 0];
  const town = [{ x: 4, y: 3, z: 0 }, { x: -6, y: 3, z: 2 }, { x: 0, y: 3, z: 9 }];
  const far = { x: 400, y: 4.3, z: 0, decor: 'far', slot: yardLampSlot('far'), range: 18 };
  for (const lane of [false, true]) {
    const lit = exteriorFrame({ lane, night: true, town, lamps: [far], eye, ranges: new Float32Array(64).fill(18) });
    assert.equal(lit.length, 4, `${lane ? 'lane' : 'classic'}: three street lanterns and the far lamp`);
    assert.ok(lit.some((l) => same(l.at, [far.x, far.y, far.z])), `${lane ? 'lane' : 'classic'}: the lamp 400 m off is lit, as a street lantern there would be`);
  }
});

test('AUDIT YARD-LIGHT L3: a yard lamp\'s flicker is read after the town animator\'s tick, as the street\'s lanterns read theirs - never a frame behind (mutant: AUDITYL-before-tick)', () => {
  const eye = [0, 1.7, 0];
  const town = [{ x: 4, y: 3, z: 0 }];
  const l = { x: 2, y: 4.3, z: 1, decor: 'lamp', slot: yardLampSlot('lamp'), range: 18 };
  for (const lane of [false, true]) {
    const lit = exteriorFrame({ lane, night: true, town, lamps: [l], eye, ranges: new Float32Array(64).fill(18), tick: (r) => r.fill(16.8) });
    const mine = lit.find((x) => same(x.at, [l.x, l.y, l.z]));
    const street = lit.find((x) => same(x.at, [4, 3, 0]));
    assert.ok(Math.abs(mine.range - 16.8) < 1e-6 && Math.abs(street.range - 16.8) < 1e-6, `${lane ? 'lane' : 'classic'}: both this frame's tick (${mine.range}, the street ${street.range})`);
  }
});

test('AUDIT YARD-LIGHT L4: the yards\' lamps become the night\'s scene lights through rows refilled in place - the same row objects every frame, none made after the first; each row the lamp\'s place, the town\'s flicker at its slot at the lamp\'s own reach, and the colour handed (mutant: AUDITYL-rows-unpooled)', () => {
  const lamps = [{ x: 1, y: 2, z: 3, slot: 5, range: 18 }, { x: 4, y: 5, z: 6, slot: 70, range: 36 }];
  const ranges = new Float32Array(64).fill(18);
  ranges[5] = 17.2; ranges[70 % 64] = 17.6;
  const rows = [], color = new Float32Array([1, 0.5, 0.25]);
  const first = yardLampRows(lamps, rows, ranges, color, []);
  assert.deepEqual(first.map((e) => [e.x, e.y, e.z, r6(e.range)]), [[1, 2, 3, r6(Math.fround(17.2))], [4, 5, 6, r6(Math.fround(17.6) * 2)]], 'the place, the flicker at the slot, scaled by the lamp\'s reach');
  assert.ok(first.every((e) => e.color === color));
  const out = [{ boat: true }];
  const second = yardLampRows(lamps, rows, ranges, color, out);
  assert.equal(second, out, 'pushed onto the scene lights handed');
  assert.deepEqual([second.length, second[1] === first[0], second[2] === first[1], rows.length], [3, true, true, 2], 'the same rows, the boat\'s light kept ahead of them');
});

test('AUDIT YARD-LIGHT L5: a yard\'s lamp hangs where the town hangs its own over a picture - the real collectors: the town\'s light stands YARD_LAMP_RAISE above its billboard\'s top (blockFlatsOffsetY sinks the flat and not its light), and the yard\'s does the same over its own (mutant: AUDITYL-raise-dropped)', () => {
  assert.equal(BLOCK_FLATS_OFFSET_Y, -6);
  assert.equal(YARD_LAMP_RAISE, 6 * GLOBAL_SCALE);
  const block = { rmbBlock: {
    miscFlatObjectRecords: [{ textureArchive: 210, textureRecord: 29, xPos: 100, yPos: -40, zPos: 200, factionID: 0, flags: 0, position: 0 }],
    misc3dObjectRecords: [], subRecords: [],
    fldHeader: { groundData: { groundScenery: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 0 }))) } },
  } };
  const size = sized(24, 112);
  const [light] = collectCityLights(block, () => size);
  const flat = collectBlockFlats(block, 504).find((f) => f.archive === 210);
  assert.ok(Math.abs(light.y - (flat.y + size.h) - YARD_LAMP_RAISE) < 1e-9, 'the town: its light over its billboard\'s top');
  assert.ok(Math.abs(yardLampOf({ id: 'p', flat: [210, 29], scale: 1 }, size).lift - (size.h + YARD_LAMP_RAISE)) < 1e-9, 'the yard: the same over its own');
});

test('AUDIT YARD-LIGHT L6: a scaled lamp is the lamp scaled - its light\'s height over its foot and its reach alike, so it lights its ground as the town\'s lamp lights its own at every scale; the world host takes the town\'s flicker at the lamp\'s reach (mutants: AUDITYL-reach-unscaled, AUDITYL-raise-unscaled, AUDITYL-reach-unread)', () => {
  const foot = (k) => {
    const law = yardLampOf({ id: 'p', flat: [210, 29], scale: k }, sized(24, 112, k));
    return { range: law.light.range, lift: law.lift, att: (1 - law.lift / law.light.range) ** 2 };
  };
  const one = foot(1);
  assert.equal(one.range, CITY_LIGHT_RANGE);
  for (const k of [0.5, 2, 4]) {
    const f = foot(k);
    assert.ok(Math.abs(f.range - YARD_LAMP.range * k) < 1e-9 && Math.abs(f.lift - one.lift * k) < 1e-9, `scale ${k}: the reach and the height, scaled`);
    assert.ok(Math.abs(f.att - one.att) < 1e-9, `scale ${k}: its foot lit as the town lamp's (${f.att.toFixed(4)})`);
  }
  const l = { x: 2, y: 8.6, z: 1, decor: 'big', slot: yardLampSlot('big'), range: 36 };
  const ranges = new Float32Array(64).fill(18);
  ranges[l.slot % 64] = 17.2;
  const lit = exteriorFrame({ lane: true, night: true, town: [], lamps: [l], eye: [0, 1.7, 0], ranges });
  assert.ok(Math.abs(lit[0].range - 17.2 * 2) < 1e-5, `the town's flicker at twice the reach (${lit[0].range})`);
});

test('AUDIT YARD-LIGHT (the lenses\' gaps): many lamps in many yards - each yard\'s own, in each yard\'s frame; a recentre moves every lamp on all three axes (mutants: AUDITYL-yards-one, AUDITYL-recentre-y, AUDITYL-recentre-z)', async () => {
  const w = yardWorld({
    pieces: [lamp('a1', 6), lamp('a2', -6)],
    neighbours: { 301: { at: [40, 0, 10], box: [36, 0, 7, 44, 6, 13], pieces: [lamp('b1', 5, -1), lamp('b2', -5, 3)] } },
    sizes: { 210: [24, 112] },
  });
  await w.run();
  const y = r6(sized(24, 112).h + YARD_LAMP_RAISE);
  const lamps = w.yards.lamps();
  assert.deepEqual(lamps.map((l) => [l.decor, ...at(l)]), [['a1', 16, y, 12], ['a2', 4, y, 12], ['b1', 45, y, 9], ['b2', 35, y, 13]], 'both yards, both lamps each, each in its own frame');
  w.shift[0] = -100; w.shift[1] = 7; w.shift[2] = 250;
  w.yards.rebase();
  assert.deepEqual(w.yards.lamps().map((l) => [l.decor, ...at(l)]), [['a1', -84, r6(y + 7), 262], ['a2', -96, r6(y + 7), 262], ['b1', -55, r6(y + 7), 259], ['b2', -65, r6(y + 7), 263]], 'moved on x, y and z');
});
