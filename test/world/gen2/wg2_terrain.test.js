// WG2 PHASE 2 (bible/03-World/World-2-Arc.md): THE GENERATOR'S LAWS on small regions - one by the Dragontails past the
// Bay's east edge and one in Skyrim - each baked whole: the same spec makes the same bytes; every river's surface falls
// or holds from source to end; a closed lake keeps its water; the rocks run on across two regions' seam; every pixel's
// byte and climate are the readers' own. Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeRegion } from '../../../src/world/gen2/regionBake.js';
import { encodeBake, decodeBake, bakePrint } from '../../../src/world/gen2/bakeCodec.js';
import { canonGrid, geology } from '../../../src/world/gen2/geology.js';
import { worldManifest } from '../../../src/world/gen2/manifest.js';
import { BIOME_TABLE } from '../../../src/world/gen2/tables.js';
import { SHORE_BYTE } from '../../../src/world/tamriel/tamrielGround.js';
import { canonReady } from '../../../src/world/gen2/canon.js';

await canonReady();

const m = worldManifest(), base = { seed: m.worldSeed, fit: m.fit, springs: [], erosion: { steps: 30 } };
const HAMMERFELL = { ...base, id: 'law-hammerfell', rect: { x: 1060, y: 380, w: 40, h: 40 }, res: 1 };
const SKYRIM = { ...base, id: 'law-skyrim', rect: { x: 1880, y: -280, w: 40, h: 40 }, res: 1 };
const baked = new Map();
const bake = (spec) => { if (!baked.has(spec.id)) baked.set(spec.id, bakeRegion(spec)); return baked.get(spec.id); };

test('WG2 DETERMINISM: one spec, one bake - the same bytes twice, a print that moves with the seed; the codec keeps every plane to its step (mutants: a seed unread, a plane\'s step)', () => {
  const a = encodeBake(bake(HAMMERFELL)), b = encodeBake(bakeRegion(HAMMERFELL));
  assert.equal(bakePrint(a), bakePrint(b));
  assert.notEqual(bakePrint(a), bakePrint(encodeBake(bakeRegion({ ...HAMMERFELL, seed: m.worldSeed + 1 }))));
  const d = decodeBake(a), src = bake(HAMMERFELL).fields;
  for (let k = 0; k < src.elev.data.length; k += 97) assert.ok(Math.abs(d.fields.elev.data[k] - src.elev.data[k]) <= 0.1 + 1e-9, 'elevation to 0.2 m');
  assert.deepEqual([...d.fields.biome.data], [...src.biome.data]);
  assert.equal(d.header.id, 'law-hammerfell');
});

for (const spec of [HAMMERFELL, SKYRIM]) {
  test(`WG2 WATER (${spec.id}): every river's surface falls or holds downstream, ends where it says, and lies at or under its ground; a closed lake keeps its water (mutants: the surface's min, a course's end, the balance)`, () => {
    const b = bake(spec), ids = new Set(b.rivers.map((r) => r.id)), lakes = new Set(b.lakes.map((l) => l.id));
    for (const r of b.rivers) {
      for (let i = 1; i < r.raw.length; i++) assert.ok(r.raw[i].s <= r.raw[i - 1].s, `river ${r.id} rises at ${i}`);
      for (let i = 1; i < r.pts.length; i++) assert.ok(r.pts[i].s <= r.pts[i - 1].s + 1e-9, `course ${r.id} rises at ${i}`);
      const [kind, id] = r.into.split(':');
      if (kind === 'river') assert.ok(ids.has(Number(id)), r.into);
      else if (kind === 'lake') assert.ok(lakes.has(Number(id)), r.into);
      else assert.ok(['edge', 'sink'].includes(kind), r.into);
      for (const p of r.raw) assert.ok(p.s <= b.fields.elev.at(p.x, p.y) + 0.5 + 1e-6, 'under its ground');
    }
    for (const l of b.lakes) { if (l.kind === 'terminal') assert.equal(l.outflow, 0); assert.ok(l.level >= l.floor - 1e-9); }
  });
}

test('WG2 GROUND\'S READERS (both regions): every pixel past the sea stands at or over the shore byte and wears a biome\'s Daggerfall climate; Skyrim\'s air is colder than the Hammerfell desert\'s and its ground no desert (mutants: the byte\'s law, the climate\'s vote, the lapse)', () => {
  for (const spec of [HAMMERFELL, SKYRIM]) {
    const b = bake(spec), climates = new Set(BIOME_TABLE.map((x) => x.climate));
    for (const v of b.bytes) assert.ok(v >= SHORE_BYTE, `${spec.id} byte ${v}`);
    for (const c of b.climates) assert.ok(climates.has(c), `${spec.id} climate ${c}`);
  }
  const mean = (f) => f.data.reduce((a, v) => a + v, 0) / f.data.length;
  assert.ok(mean(bake(SKYRIM).fields.temp) < mean(bake(HAMMERFELL).fields.temp) - 5);
  const desert = new Set(['dunes', 'rockDesert', 'saltFlat'].map((k) => BIOME_TABLE.findIndex((x) => x.key === k)));
  assert.ok([...bake(SKYRIM).fields.biome.data].every((v) => !desert.has(v)), 'no desert in Skyrim');
  assert.ok([...bake(HAMMERFELL).fields.biome.data].filter((v) => desert.has(v)).length > 0.3 * 1600, 'Hammerfell is dry');
});

test('WG2 SEAMS: the rocks and the canon run on across two regions\' shared ground - a terrane is one lattice over the world (mutants: a region-relative lattice, a region-relative warp)', () => {
  const a = { ...HAMMERFELL, id: 'a' }, b = { ...HAMMERFELL, id: 'b', rect: { x: 1080, y: 390, w: 40, h: 40 } };
  const ca = canonGrid(a), cb = canonGrid(b), ga = geology(a, ca), gb = geology(b, cb);
  let n = 0;
  for (let y = 390; y < 420; y++) for (let x = 1080; x < 1100; x++) {
    const ia = (y - 380) * 40 + (x - 1060), ib = (y - 390) * 40 + (x - 1080);
    assert.equal(ga.rock.data[ia], gb.rock.data[ib], `rock at ${x},${y}`);
    assert.equal(ca.relief.data[ia], cb.relief.data[ib]);
    assert.equal(ca.lift.data[ia], cb.lift.data[ib]);
    n++;
  }
  assert.equal(n, 600);
});
