// FIELD BUGS 2026-10-05 SHORE-CAST (Discord, Ilvi: "The sea level hitbox is too high in some places" - "I'm near
// Westhead Moor and walking near the beach", the crosshair on dry sand reading "Open Water / Fishing 2 / Cast the net").
//
// The net's law (foragingLaw.js netHasWater) is the ANGLER's: the Ocean's region 31 answers for a whole 819 m pixel
// (POLITIC.PAK is never dilated - only the climate is), and a shore record's whole tile wades. Measured with the
// player's data through the port's own terrain: the pixel north of Westhead Moor (207,222) is region 31 with 20,321 m2
// of dry ground under it - beach dirt to 78.5 m from the nearest drawn water, grass to 141.9 m - and the cast stood on
// every metre.
// The cast's own point must now be over water the feet would swim in (MAC2's coverage law, the swim's).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fishKind, castAt, CAST_AHEAD_M } from '../src/scenes/fishHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { feetWaterCoverage, SWIM_COVERAGE } from '../src/player/exteriorSurface.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NET = { items: [{ templateIndex: 1603, currentCondition: 50 }] };

/** Fishing's kind on the reported ground: Westhead Moor's coast, the Ocean's region, the feet dry. The water lies past
 *  z = 10 along +z; `eyeZ` is where the angler stands, looking out to sea. */
function beach(eyeZ, { waterAt = ([, , z]) => z > 10 } = {}) {
  const w = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 231, region: 31, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
  const prev = setForagingHost({ world: () => w, entity: () => null });
  const book = { state: { open: true, hauls: 0, caps: { hauls: 40, stores: 5000 } }, taken: () => false, counting: () => false, held: () => 0 };
  const eye = { pos: [0, 1.6, eyeZ], dir: [0, 0, 1] };
  const host = { pixel: () => ({ x: 207, y: 222 }), ground: () => ({ climate: 231, region: 31 }), eye: () => eye, feet: () => [0, 0, eyeZ], hour: () => 12, storm: () => false, climateAt: () => 231, trophy: () => true, day: () => 20731, rand: () => 0.5, busy: () => false, waterAt };
  return { k: fishKind({ book, host }), eye, done: () => setForagingHost(prev) };
}

test('SHORE-CAST: the report - on the sand with the sea ahead, the net\'s law holds (region 31) but the cast lands on the beach: no Open Water; a step to the water\'s edge and it is there', () => {
  const far = beach(0);
  try {
    assert.equal(castAt(far.eye)[2], CAST_AHEAD_M, 'the cast stands 3 m along the look, on the sand');
    assert.deepEqual(far.k.looseNodesOf({ entity: NET, dungeon: false }), [], 'dry sand under the cast: no Open Water');
  } finally { far.done(); }
  const edge = beach(8);
  try {
    assert.equal(edge.k.looseNodesOf({ entity: NET, dungeon: false }).length, 1, 'at the edge the cast lands in the sea (z 11): Open Water');
  } finally { edge.done(); }
});

test('SHORE-CAST: ground not built answers unknown, and unknown is not refused (a deck at sea over a pixel still streaming fishes)', () => {
  const s = beach(0, { waterAt: () => null });
  try { assert.equal(s.k.looseNodesOf({ entity: NET, dungeon: false }).length, 1); } finally { s.done(); }
});

test('SHORE-CAST: a cast already flying is not lost when the look swings onto the bank - but a net still WOUND is not yet cast, and the bank is no target for it (AUDIT FB1005 W3)', () => {
  let wet = true;
  const s = beach(8, { waterAt: () => wet });
  try {
    const [n] = s.k.looseNodesOf({ entity: NET, dungeon: false });
    const plan = s.k.plan(n, { rank: () => 2, entity: NET });
    const started = s.k.start(n, plan, { entity: NET, rank: () => 2, specs: () => ({}), keyLabel: () => 'E' });
    assert.ok(started.act, 'the cast is made');
    assert.equal(started.act.state.phase, 'wind', 'E held: the net wound, not yet thrown');
    wet = false;   // the look turned onto the bank while winding
    assert.deepEqual(s.k.looseNodesOf({ entity: NET, dungeon: false }), [], 'wound over the sand: no target - it would be thrown there');
    wet = true;
    started.act.tick(0.1, { held: false });   // E let go: thrown
    assert.equal(started.act.state.phase, 'fly');
    wet = false;   // the look on the bank now
    assert.equal(s.k.looseNodesOf({ entity: NET, dungeon: false }).length, 1, 'the thrown cast keeps its node');
    started.act.cancel();
    assert.deepEqual(s.k.looseNodesOf({ entity: NET, dungeon: false }), [], 'and once it is done the bank stands no new one');
  } finally { s.done(); }
});

test('SHORE-CAST: the world host asks the swim\'s own coverage at the cast - beach dirt (record 1) is dry, the sea (record 0) wet', () => {
  assert.equal(feetWaterCoverage(1, [0.5, 0.5]) >= SWIM_COVERAGE, false, 'record 1, the beach the report stood on');
  assert.equal(feetWaterCoverage(0, [0.5, 0.5]) >= SWIM_COVERAGE, true, 'record 0, the sea');
  const world = src('src/scenes/world.js');
  assert.match(world, /waterAt: \(pos\) => \{ const g = groundSampleAt\(pos\); const c = g \? feetWaterCoverage\(g\.tile, g\.feet\) : null; return c == null \? null : c >= SWIM_COVERAGE; \},/);
  assert.match(world, /const playerGroundSample = \(\) => groundSampleAt\(walkMode \? player\.pos : cam\.pos\);/);
  // AUDIT FB1005 W4: the read is AT the point it is handed - its pixel, its tile, its fraction - not at the feet
  assert.match(world, /const groundSampleAt = \(pos\) => \{\s*const wc = state\.worldCoords\(pos\);\s*const p = worldCoordToMapPixel\(wc\.x, wc\.z\);[\s\S]{0,700}return \{ tile: built_\.tilemap\[tx \+ ty \* TERRAIN_TILE_DIM\], feet: \[u - tx, v - ty\] \};/);
  assert.match(src('src/scenes/fishHost.js'), /if \(!acting && host\.waterAt\?\.\(castAt\(host\.eye\(\)\)\) === false\) return \[\];/);
});

// ---- AUDIT FB1005 W2: an act the gathering host DROPS is ended ----

test('SHORE-CAST: a cast the gathering host drops - a window, a door, the helm, the pixel\'s edge - is ENDED, so the bank is no target after it (AUDIT FB1005 W2: the drop left it neither done nor cancelled, and the exemption kept the sand a cast)', async () => {
  const { createGatherHost } = await import('../src/scenes/gatherHost.js');
  const { HEIGHTMAP_DIMENSION } = await import('../src/world/terrainSampler.js');
  const PX = 207, PY = 222;
  let active = true, held = true;
  const feet = [400, 0, 8];
  const view = { yaw: 0, pitch: 0 };
  const eye = () => ({ pos: [feet[0], 1.6, feet[2]], dir: [0, 0, 1] });
  const w = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 231, region: 31, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
  const book = { state: { open: true, today: {}, hauls: 0, caps: { harvests: 60, hauls: 40, stores: 5000 } }, stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {}, dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false, track: () => ({ rank: 2, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}) };
  const entity = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, fatigue: 1e9, maxFatigue: 1e9, items: NET.items };
  const fish = fishKind({ book, host: { pixel: () => ({ x: PX, y: PY }), ground: () => ({ climate: 231, region: 31 }), eye, feet: () => feet, hour: () => 12, storm: () => false, climateAt: () => 231, trophy: () => true, day: () => 20731, rand: () => 0.5, busy: () => false, waterAt: ([, , z]) => z > 10 } });
  const entry = { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [] };
  const host = createGatherHost({
    book, kinds: [fish],
    hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map([[`${PX},${PY}`, entry]]), pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: 231, region: 31 }), nowMs: () => 20731 * 86_400_000 + 43_200_000,
    eye, view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => ({ held, attack: false, choice: false }),
    active: () => active, activeDungeon: () => false,
  });
  const prev = setForagingHost({ world: () => w, entity: () => null });
  try {
    host.onBuilt(entry);
    await new Promise((r) => setImmediate(r));
    host.tick(0.016);
    assert.equal(host.target?.node.kind, 'haul', 'at the water\'s edge, the cast');
    host.press(); host.sayNeed();
    assert.equal(host.acting(), true, 'cast');
    held = false;
    host.tick(0.016);   // E let go: the net thrown
    assert.equal(host.acting(), true, 'thrown, in the water');
    active = false;   // the place goes from under it - a window, a door, the helm
    host.tick(0.016);
    assert.equal(host.acting(), false, 'dropped');
    active = true;
    feet[2] = 0;   // up the beach: the cast's point, 3 m on, is the sand
    host.tick(0.016);
    assert.equal(host.target?.node.kind ?? null, null, 'the bank is no target: the dropped cast was ended');
  } finally { host.dispose(); setForagingHost(prev); }
});

