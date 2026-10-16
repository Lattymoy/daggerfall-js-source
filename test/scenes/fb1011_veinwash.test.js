// VEIN-WASH (FIELD BUGS 2026-10-11d #3, the Discord's "Many ore veins look the same.": "Copper/lodestone/moonstone/ebony
// and others all have the same basic texture so its very hard to tell the difference when looking for them"). DFU gives
// five metals a picture of their own and shares two among the rest - Lead, Silver and Platinum record 65; Copper and
// Lodestone record 66, and every new ore borrowed 66 - and PROF2 drew each vein as its metal's picture alone, where
// PROF0 4.8 had said "tinted per ore". Every ore that shares a picture now wears its own wash (scenes/mineHost.js
// ORE_WASH, through ARENA5's batch wash - render/renderer.js uBatchTint), and the gathering host stands each wash as
// its own batch, on the open ground and underground. bible/01-Overview/bugs/Field-Bugs-2026-10-11d.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ORE_WASH, mineWash, mineRecord, mineKind, LODESTONE_RECORD } from '../../src/scenes/mineHost.js';
import { herbKind } from '../../src/scenes/herbHost.js';
import { createGatherHost } from '../../src/scenes/gatherHost.js';
import { METALS, ORES } from '../../src/net/professionLaw.js';
import { veins, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';

const tick = () => new Promise((r) => setImmediate(r));
/** The ores a vein can be: DFU's metals but Brass (smelted, never mined), and the new ores. */
const MINED = [...METALS.filter((m) => m.key !== 'metal:brass'), ...ORES].map((m) => m.key);
const vein = (material) => ({ what: 'vein', material, slot: 0, local: [0, 0, 0] });

test('VEIN-WASH: no two ores that share DFU\'s picture look alike - the first of each shared picture keeps DFU\'s colours, every other wears a wash of its own; an ore with a picture of its own wears none (mutants: a wash dropped; two washes the same; a DFU owner washed)', () => {
  const byLook = new Map();
  for (const key of MINED) {
    const look = `${mineRecord(vein(key))}|${mineWash(vein(key))?.join(',') ?? 'DFU'}`;
    assert.ok(!byLook.has(look), `${key} looks like ${byLook.get(look)} (${look})`);
    byLook.set(look, key);
  }
  // the pictures' owners keep DFU's own colours, and the five with a picture of their own take no wash
  // PIN MOVED (VEIN-HUE, FIELD BUGS 2026-10-12b): Lodestone wears a wash of its own - its picture is the boulder's lump
  for (const key of ['metal:lead', 'metal:mercury', 'metal:gold', 'metal:iron', 'metal:tin', 'metal:sulphur']) assert.equal(mineWash(vein(key)), null, key);
  assert.deepEqual(Object.keys(ORE_WASH).sort(), ['metal:copper', 'metal:lodestone', 'metal:platinum', 'metal:silver', 'ore:adamantium', 'ore:dwarven', 'ore:ebony', 'ore:mithril', 'ore:moonstone', 'ore:orichalcum']);
  for (const [k, w] of Object.entries(ORE_WASH)) assert.ok(w.length === 3 && w.every((c) => c > 0), `${k}: a colour`);
  assert.equal(mineWash({ what: 'boulder', material: 'stone:rough' }), null, 'a boulder\'s loose stone is Lodestone\'s lump as it is');
  assert.deepEqual(mineWash({ what: 'motherlode', material: 'ore:ebony' }), ORE_WASH['ore:ebony'], 'a Motherlode wears its ore\'s');
  const [f] = mineKind({ book: { taken: () => false } }).flatsOf({ ...vein('ore:moonstone'), local: [1, 2, 3] });
  assert.equal(f.record, LODESTONE_RECORD);
  assert.deepEqual(f.tint, ORE_WASH['ore:moonstone'], 'the flats the kind hands the host carry it');
});

test('VEIN-WASH: the gathering host stands a vein\'s flats washed, each wash its own batch - Daggerfall\'s Moonstone beside a Lodestone or a Copper on one picture are two batches, never one (mutants: the wash never set on the batch; the wash left out of the group\'s key)', async () => {
  const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;   // Daggerfall's: a confirmed pixel stands its two Moonstones
  // a day whose witnessed pixel stands a Lodestone or a Copper beside its Moonstone - all three on DFU's record 66
  let day = utcDayOfMs((20500 * 86_400 + 43_200) * 1000), PX = 405, PY = 150, law = [];
  for (let d = 0; d < 60; d++, day++) {
    law = veins({ x: PX, y: PY, day, climate: WOODS, region: GLENUMBRA, confirmed: true });
    if (law.some((v) => v.material === 'ore:moonstone') && law.some((v) => v.material === 'metal:lodestone' || v.material === 'metal:copper')) break;
  }
  assert.ok(law.some((v) => v.material === 'ore:moonstone'), 'the day stands Moonstone');
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'confirmed', climate: WOODS, region: GLENUMBRA }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  const made = [];
  const renderer = { createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, centers }; made.push(b); return b; }, destroyBatch: () => {} };
  const built = new Map([[`${PX},${PY}`, entry]]);
  const host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book })], hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => day * 86_400_000 + 43_200_000,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [], stats: {} }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true, activeDungeon: () => false,
  });
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  const stood = host.nodesOf(PX, PY).filter((n) => n.kind === 'mine' && n.what === 'vein');
  assert.ok(stood.some((n) => n.material === 'ore:moonstone'), 'a Moonstone vein stood');
  const ore = made.filter((b) => b.archive === 254);
  for (const n of stood) {
    const at = n.local.join(',');
    const b = ore.find((x) => x.centers.some((c) => c.join(',') === at));
    assert.ok(b, `${n.material}'s flats stood`);
    assert.deepEqual(b.tint ?? null, ORE_WASH[n.material] ?? null, `${n.material}'s batch wears its wash`);
    for (const m of stood) {
      if (m === n || (ORE_WASH[m.material] ?? null) === (ORE_WASH[n.material] ?? null)) continue;
      assert.ok(!b.centers.some((c) => c.join(',') === m.local.join(',')), `${n.material} and ${m.material} never one batch`);
    }
  }
  host.dispose?.();
});

test('VEIN-WASH: a deep vein wears its ore\'s wash on the dungeon\'s own batch - an unwitnessed dungeon\'s Silver its cold white (mutants: the dungeon\'s batch unwashed)', async () => {
  const WOODS = CLIMATES.Woodlands;
  const NOON = 20500 * 86_400 + 43_200;
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => null, askPixels: async () => [], pump: () => {},
    dungeon: () => ({ state: 'none' }), askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  const host = createGatherHost({
    book, kinds: [mineKind({ book })], hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => null, nowMs: () => NOON * 1000,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [], stats: {} }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => false, activeDungeon: () => true,
  });
  const stoodBatches = [];
  host.enterDungeon({ id: 88, climate: WOODS, region: 59, wall: (m, b) => [Math.sin(b) * 2, 1.2, Math.cos(b) * 2], stand: async (archive, record) => { const b = { archive, record }; stoodBatches.push(b); return b; }, drop: () => {} });
  for (let i = 0; i < 4; i++) await tick();
  assert.ok(stoodBatches.length > 0, 'the dungeon stood its veins');
  for (const b of stoodBatches) assert.deepEqual(b.tint, ORE_WASH['metal:silver'], 'an unwitnessed dungeon\'s deep vein is Silver, in Silver\'s wash');
  host.dispose?.();
});
