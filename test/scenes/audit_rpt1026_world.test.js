// AUDIT RPT1026 (lane J, the world's fixes of FIELD BUGS 2026-10-26r RPT1026-WORLD), the pins of what the audit proved:
//   J1 DARK-ROOM's law read the room's LIVE light list - the lamps a home's owner places join it (scenes/decor/decorRoom.js
//      roomLights) and a lamp the owner takes out leaves it (scenes/decor/decorBase.js hide) - so one candle set down in a
//      room Daggerfall left unlit put the room back to InteriorAmbientLight's 0.18 (dark but for the candle), and the
//      caravan's lantern taken out lit the caravan at the ambient-only 0.8. The law asks the lamps the room was BUILT
//      with (interiorContext.js `roomLamps`), which nothing a player does in it moves.
//   J2 BANNER-WALL asked the building's BOX alone, and its own pin asked the same box (onTheBox) - so a cloth that hung
//      before no wall inside the box (a door on a vestibule or in a porch, the facade stepped back beside it) passed both.
//      Asked of the building's own faces through the real collider (player/collider.js), 19 of Wildertown's doors hung a
//      cloth before nothing after the fix. The frame carries its models now (scenes/pixelBuild.js `parts`) and a cloth
//      hangs only where a face stands behind it (scenes/hallBanners.js wallBehind).
//   (J3, the sea-brake guard's missing question, is asked in test/systems/naval/rpt1026_world_seabrake.test.js itself.)
// Driven on the real producers: the interior build (scenes/interiorContext.js buildInteriorContext) over the caravan's
// own block (systems/caravanRoom.js caravanRoomBlock, its lantern an archive-210 flat) and over a room with no lamp, the
// owner's take-out through the room's own base (decorBase.js), a placed lamp through the real decor room
// (decorRoom.js createDecorRoom), and the hosts' one statement each by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInteriorContext } from '../../src/scenes/interiorContext.js';
import { createDecorRoom } from '../../src/scenes/decor/decorRoom.js';
import { caravanRoomBlock, CARAVAN_LANTERN_FLAT } from '../../src/systems/caravanRoom.js';
import { CARAVAN_ENTER, CARAVAN_LANTERN } from '../../src/world/caravanRoomModel.js';
import { HAS_ARENA2, bootDoor, classicModels } from '../arena1Data.mjs';
import { layoutLocation } from '../../src/world/locationLayout.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';
import { trs, multiply } from '../../src/world/mat4.js';
import { transformedAabb, localAabb } from '../../src/render/frustum.js';
import { Collider } from '../../src/player/collider.js';
import { doorCornersOf, doorNormalOf, hallBannerAnchors, BANNER_OUT_M, BANNER_TOP_M, BANNER_WALL_BEHIND_M } from '../../src/scenes/hallBanners.js';
import { BANNER_W_M, BANNER_H_M } from '../../src/render/bannerPass.js';
import { roomAmbient, INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_AMBIENT_ONLY, INTERIOR_NIGHT_AMBIENT_ONLY } from '../../src/world/interior/interiorLights.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const settle = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
const tex = { recordCount: 40, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
/** The interior build with nothing drawn: every model the one triangle, every archive the one picture. */
async function build(dfBlock, opts = {}) {
  const cpuModels = new Map();
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, destroyMesh: () => {}, createMesh: () => ({}), destroyBillboardBatch: () => {} };
  const deps = { renderer, getGpuMesh: async (id) => { cpuModels.set(id, model); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const saved = [console.warn, console.log];
  console.warn = console.log = () => {};
  try { return await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, opts); } finally { [console.warn, console.log] = saved; }
}
/** A room of one model and no flat: Daggerfall hangs no lamp in it (the 177 rooms DARK-ROOM names). */
const unlitRoom = () => ({ name: 'UNLIT.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 },
  block3dObjectRecords: [{ modelIdNum: 41000, objectType: 3, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
  blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: [] } }] } });
/** What the world's interior host hands roomAmbient for the room, read off its own statement (worldModes.js's building
 *  arm: `roomAmbient(<the clock's>, interiorCtx.<this>)`) - the behaviour below follows the host's wiring as it stands. */
const HOST_LAMPS = /roomAmbient\(isNight\(skyMinutes\(\) % 1440\) \? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT, interiorCtx\.(\w+)\)/.exec(src('src/scenes/worldModes.js'))?.[1];
const hostLamps = (ctx) => { assert.ok(HOST_LAMPS, 'the host lights its room through roomAmbient'); return ctx[HOST_LAMPS]; };

test('AUDIT RPT1026 J1 DARK-ROOM: the caravan\'s lantern taken out by its owner leaves the room as dark as Daggerfall leaves a lamped room - never lit at the ambient-only level; the lantern put back, the same (mutant: the live list asked)', async () => {
  const ctx = await build(caravanRoomBlock(CARAVAN_ENTER, CARAVAN_LANTERN), { baseEditable: true });
  assert.equal(ctx.lights.length, 1, 'the caravan hangs its one lamp, the lantern');
  const lantern = ctx.base.list().find((p) => p.flat?.[0] === CARAVAN_LANTERN_FLAT[0] && p.flat?.[1] === CARAVAN_LANTERN_FLAT[1]);
  assert.ok(lantern, 'the lantern is a piece of the room its owner may take out');
  assert.equal(roomAmbient(INTERIOR_AMBIENT, hostLamps(ctx)), INTERIOR_AMBIENT, 'lit by its lamp: InteriorAmbientLight');
  assert.equal(ctx.base.hide(lantern.key), true, 'taken out');
  assert.equal(ctx.lights.length, 0, 'its light out of the room\'s live list');
  assert.equal(roomAmbient(INTERIOR_AMBIENT, hostLamps(ctx)), INTERIOR_AMBIENT, 'and the room as dark as its lamp left it - not 0.8');
  assert.equal(roomAmbient(INTERIOR_NIGHT_AMBIENT, hostLamps(ctx)), INTERIOR_NIGHT_AMBIENT, 'by night too');
  ctx.base.show(lantern.key);
  assert.equal(roomAmbient(INTERIOR_AMBIENT, hostLamps(ctx)), INTERIOR_AMBIENT);
  ctx.destroy();
});

test('AUDIT RPT1026 J1 DARK-ROOM: a lamp set down in a room Daggerfall left unlit never darkens it - the room stays at the ambient-only level with the placed lamp burning in it, and goes on so when the lamp is taken up (mutant: the live list asked)', async () => {
  const ctx = await build(unlitRoom(), { baseEditable: true });
  assert.equal(ctx.lights.length, 0, 'no archive-210 flat: no lamp');
  assert.deepEqual([...roomAmbient(INTERIOR_AMBIENT, hostLamps(ctx))], [...INTERIOR_AMBIENT_ONLY], 'lit by ambient alone');
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() },
    renderer: { textures: new Map(), createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, drawMesh: () => {} },
    getTexture: async () => tex, uploadRecord: () => undefined,
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => [0, 0, 0], roomLights: () => ctx.lights,
  });
  pool.put({ id: 'lamp12345678', model: null, flat: [210, 2], pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: { color: [1, 0.85, 0.6], range: 6, intensity: 1 }, storage: false, paid: 0 });
  await settle();
  assert.equal(ctx.lights.length, 1, 'the placed lamp burns in the room\'s list');
  assert.deepEqual([...roomAmbient(INTERIOR_AMBIENT, hostLamps(ctx))], [...INTERIOR_AMBIENT_ONLY], 'and the room is no darker for it');
  assert.deepEqual([...roomAmbient(INTERIOR_NIGHT_AMBIENT, hostLamps(ctx))], [...INTERIOR_NIGHT_AMBIENT_ONLY], 'by night too');
  pool.remove('lamp12345678');
  assert.equal(ctx.lights.length, 0);
  assert.deepEqual([...roomAmbient(INTERIOR_AMBIENT, hostLamps(ctx))], [...INTERIOR_AMBIENT_ONLY]);
  ctx.destroy();
});

test('AUDIT RPT1026 J1 DARK-ROOM by source: both interior hosts light the room by the lamps it was built with (the world\'s building arm, the ?interior bench) - never the live list', () => {
  assert.ok(src('src/scenes/worldModes.js').includes('renderer.setLighting(new Float32Array(roomAmbient(isNight(skyMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT, interiorCtx.roomLamps)), 0);'));
  assert.ok(src('src/scenes/interior.js').includes('renderer.setLighting(new Float32Array(roomAmbient(isNight(skyMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT, ctx.roomLamps)), 0);'));
});

// ─── J2 BANNER-WALL: a wall behind the cloth ─────────────────────────────────────────────────────────────────────────

/** A town's building frames as the pixel build makes them (scenes/pixelBuild.js homeFrames): the box round ALL its
 *  models (pixelBuild unions them - the record's own pin took the first model's alone), its first door's corners and
 *  outward normal, and its models as they stand (`parts`); and the same models on a real collider, one bucket a key. */
async function townFrames(name) {
  const { maps, blocks } = await bootDoor({ packs: true, arena: true });
  const modelOf = classicModels();
  let loc = null;
  for (let r = 0; r < maps.regionCount && !loc; r++) {
    if (!maps.loadRegion(r)) continue;
    const reg = maps._regions[r]?.dfRegion;
    if (reg?.mapNameLookup?.has(name)) loc = maps.getLocation(r, reg.mapNameLookup.get(name));
  }
  const lay = layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true });
  const frames = new Map();
  const col = new Collider(() => -1000);
  for (const b of lay.blocks) {
    const origin = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      if (!Number.isSafeInteger(placed.recordIndex)) continue;
      const cpu = modelOf(placed.modelIdNum);
      if (!cpu) continue;
      const local = multiply(origin, placed.matrix);
      const key = makeBuildingKey(b.x, b.y, placed.recordIndex);
      const box = [...transformedAabb(localAabb(cpu.positions), local)];
      let f = frames.get(key);
      if (!f) frames.set(key, f = { key, model: placed.modelIdNum, box, parts: [[cpu, local]], n: 0 });
      else { for (let i = 0; i < 3; i++) { f.box[i] = Math.min(f.box[i], box[i]); f.box[i + 3] = Math.max(f.box[i + 3], box[i + 3]); } f.parts.push([cpu, local]); }
      if (cpu.doors?.length && !f.door) { f.door = doorCornersOf(cpu.doors[0], local); f.normal = doorNormalOf(cpu.doors[0], local); }
      col.addMesh(`${key}:${f.n++}`, cpu.positions, cpu.indices, local);
    }
  }
  return { frames, col };
}
/** Whether the collider meets one of the building's own faces behind each end of a cloth, at its lower edge and its
 *  middle, within BANNER_WALL_BEHIND_M of the door's plane - its own buckets alone. */
function onItsWall(col, f, a) {
  const only = Array.from({ length: f.n }, (_, i) => `${f.key}:${i}`);
  return [-1, 1].every((e) => [BANNER_TOP_M - BANNER_H_M + 0.1, BANNER_TOP_M - BANNER_H_M / 2].every((dy) => {
    const at = [a.top[0] - a.out[0] * BANNER_OUT_M + a.right[0] * e * BANNER_W_M / 2, a.top[1] - BANNER_TOP_M + dy, a.top[2] - a.out[2] * BANNER_OUT_M + a.right[2] * e * BANNER_W_M / 2];
    const o = [at[0] + a.out[0] * 0.5, at[1], at[2] + a.out[2] * 0.5];
    return col.raycast(o, [-a.out[0], 0, -a.out[2]], 0.5 + BANNER_WALL_BEHIND_M, { only }) <= 0.5 + BANNER_WALL_BEHIND_M;
  }));
}

test('AUDIT RPT1026 J2 BANNER-WALL: Wildertown under the town packs, its frames as the pixel build makes them - every cloth a door hangs has its building\'s own face behind both its ends, met by the real collider; the doors on a vestibule or in a porch hang the one on their wall, none in the air; no door loses both (mutant: the box alone)', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const { frames, col } = await townFrames('Wildertown');
  const kept = [0, 0, 0], boxed = [0, 0, 0];
  const lost = new Map();
  for (const f of frames.values()) {
    if (!f.door) continue;
    const got = hallBannerAnchors(f);
    if (!got) continue;
    kept[got.length]++;
    const alone = hallBannerAnchors({ box: f.box, door: f.door, normal: f.normal });
    boxed[alone.length]++;
    for (const a of got) assert.ok(onItsWall(col, f, a), `key ${f.key} (ARCH3D ${f.model}): a cloth at ${a.top.map((v) => v.toFixed(2))} hangs before no wall`);
    for (const a of alone) if (!onItsWall(col, f, a)) lost.set(f.model, (lost.get(f.model) ?? 0) + 1);
  }
  assert.deepEqual(boxed, [0, 105, 259], 'the box alone (RPT1026-WORLD BANNER-WALL\'s law): 105 doors hang one, 259 two');
  assert.deepEqual(kept, [0, 124, 240], 'with the wall asked: 19 doors more hang one, none hangs none');
  assert.ok((lost.get(326) ?? 0) >= 1 && (lost.get(339) ?? 0) >= 1, `the vestibule's and the porch's doors among them: ${JSON.stringify([...lost])}`);
});

test('AUDIT RPT1026 J2 the law: a door in a flat wall hangs two; one on a vestibule standing out of its facade hangs the one its wall is behind; a frame with no models asks the box alone, as before', () => {
  // a wall along x at z = 0, facing -z, 10 m long and 6 high - one quad, its two triangles
  const quad = (x0, x1, z) => ({ positions: new Float32Array([x0, 0, z, x1, 0, z, x1, 6, z, x0, 6, z]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const door = { a: [4.4, 0, 0], b: [5.6, 2.2, 0] };
  const box = [0, 0, 0, 10, 6, 6];
  assert.equal(hallBannerAnchors({ box, door, normal: [0, 0, -1], parts: [[quad(0, 10, 0), I]] }).length, 2, 'a flat wall: both');
  // the door's own wall a vestibule 2.6 m wide (x 3.7 to 6.3) standing 3 m out of the facade (the facade at z = 3)
  const vestibule = [[quad(3.7, 6.3, 0), I], [quad(0, 10, 3), I]];
  assert.equal(hallBannerAnchors({ box, door, normal: [0, 0, -1], parts: vestibule }).length, 0, 'both cloths reach past the vestibule\'s wall: none');
  const offCentre = { a: [3.8, 0, 0], b: [5.0, 2.2, 0] };   // the door toward its vestibule's west end: the east cloth on the wall
  const one = hallBannerAnchors({ box, door: offCentre, normal: [0, 0, -1], parts: [[quad(3.7, 7.6, 0), I], [quad(0, 10, 3), I]] });
  assert.equal(one.length, 1);
  assert.ok(one[0].top[0] > 5.0, 'the cloth on the wall, east of the door');
  assert.equal(hallBannerAnchors({ box, door, normal: [0, 0, -1] }).length, 2, 'no models: the box alone');
  // a wall a door's frame behind the plane (BANNER_WALL_BEHIND_M) holds the cloth; one further back does not
  assert.equal(hallBannerAnchors({ box, door, normal: [0, 0, -1], parts: [[quad(4.2, 5.8, 0), I], [quad(0, 10, BANNER_WALL_BEHIND_M - 0.05), I]] }).length, 2);
  assert.equal(hallBannerAnchors({ box, door, normal: [0, 0, -1], parts: [[quad(4.2, 5.8, 0), I], [quad(0, 10, BANNER_WALL_BEHIND_M + 0.05), I]] }).length, 0);
});

test('AUDIT RPT1026 J2 by source: the pixel build hands each building frame its models as they stand, the first and every one after', () => {
  const pb = src('src/scenes/pixelBuild.js');
  assert.ok(pb.includes('faction: bd?.factionId ?? 0, parts: [[cpu, local]], terraced: isFabricDoorId(placed.modelIdNum), block: b.blockName, record: placed.recordIndex });'), 'the first model');   // PIN MOVED (AUDIT TAMRIEL-WIDE A1); PIN MOVED (IC-BACKYARD: its block and record)
  assert.ok(pb.includes('f.rects.push(...rects); f.grounds?.push(ground); f.parts?.push([cpu, local]); }'), 'and every one after it');   // PIN MOVED (YARD-DECK, FIELD BUGS 2026-10-30b; AUDIT FB1030 Y1-Y8): its ground in parts beside it
});
