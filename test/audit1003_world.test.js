// AUDIT PRE-MERGE 1003, lens W - the arena in the world and on screen (bible/01-Overview/Audit-PreMerge-0929.md's form;
// bible/11-Multiplayer/Arena.md the design). Each finding pinned by a test that failed on the unfixed tree for the
// finding's reason; the mutants in tools/mutants/audit1003_world.json.
//
//   W1 the floor's instance had no ground where the city's terrain is the colosseum's floor - a watcher who walked down
//      the gate's flight fell for ever, in a level no save is made in;
//   W2 the relay's hour watched in the instance hung no banners;
//   W4 the instance re-skinned the climate-free colosseum with the dungeon's texture table;
//   W5 a seat was any hit in the band - the parapet's coping, a fence top, a stair's collider ramp;
//   W6 the colosseum's seal ran ~0.5 s in one piece inside a streamed pixel's build;
//   W7 the undercroft's stair could pass for a crown city's castle entrance;
//   W8 two comments said a walk back restarts the city's exhibition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor, FIXED_DT } from '../src/player/motor.js';
import { installArena, _resetArena, arenaDrawnModel, arenaGroundTiles, ARENA_PAVING } from '../src/world/arenaCity.js';
import * as AF from '../src/world/arenaFloor.js';
import { ARENA_MODEL_ID, buildArenaModel, sealArenaSeams } from '../src/world/arenaModel.js';
import * as AM from '../src/world/arenaModel.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { customModelFor, emptyModel, registerCustomModel, _resetCustomModels } from '../src/world/customModels.js';
import * as CM from '../src/world/customModels.js';
import { trs, multiply } from '../src/world/mat4.js';
import { GROUND_OFFSET } from '../src/world/rmbLayout.js';
import { getModelMatrix } from '../src/world/rdbLayout.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { exhibitionFor } from '../src/systems/arenaLadder.js';
import { applyTextureTable } from '../src/world/dungeonTextures.js';
import { remapSubMeshes } from '../src/world/texRemap.js';
import { keyResolver } from '../src/render/staticBatch.js';
import { castleEntranceOf } from '../src/systems/siegeField.js';
import IDX from '../vendor/daggerfall-arena/Models/864102.json' with { type: 'json' };

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BIN = new Uint8Array(readFileSync(new URL('../vendor/daggerfall-arena/Models/864102.bin', import.meta.url)));
let _drawn = null;
/** The colosseum as it is drawn and walked (no ARCH3D: Kamer's half, as every headless pin builds it). */
const drawnColosseum = () => (_drawn ??= arenaDrawnModel(buildArenaModel(IDX, BIN, () => null)));
const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };

/** THE MADE LEVEL'S COLLIDER, laid as scenes/dungeonContext.js lays it: world/dungeonLayout.js over the made blocks file,
 *  every placement's model out of the registry installArena fills (the pipeline's door, world/customModels.js), each
 *  added to one 'dungeon' bucket over no terrain at all. */
async function madeLevel(kind = 'watch') {
  _resetCustomModels(); _resetArena();
  await installArena({ readBin: async () => BIN, log: null });
  const getModel = (id) => customModelFor(id, { classicModel: () => null }) ?? emptyModel();
  const dungeon = layoutDungeon(AF.arenaFloorLocation({ kind }), AF.arenaFloorBlocks(null, kind), getModel);
  const col = new Collider(() => -Infinity);
  const ids = [];
  for (const b of dungeon.blocks) for (const p of b.layout.placements) {
    const m = getModel(p.modelIdNum);
    ids.push(p.modelIdNum);
    col.addMesh('dungeon', m.positions, m.indices, multiply(trs(b.originX, 0, b.originZ, 0, 0, 0), p.matrix));
  }
  return { col, ids, getModel };
}
/** A body walked through `way` (floor-frame [x, z] marks) from where it stands: its lowest over the sand, where it ends. */
function walk(m, c, way, seconds = 15) {
  const rel = () => [m.pos[0] - c[0], m.pos[1] - c[1], m.pos[2] - c[2]];
  let low = Infinity;
  const at = [];
  for (const [wx, wz] of way) {
    for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
      const p = rel();
      low = Math.min(low, p[1]);
      if (Math.hypot(wx - p[0], wz - p[2]) < 0.6 || p[1] < -20) break;
      m.update(FIXED_DT, { ...still, forward: 1 }, Math.atan2(wx - p[0], wz - p[2]), 0);
    }
    at.push(rel());
  }
  for (let i = 0; i < Math.round(3 / FIXED_DT); i++) { m.update(FIXED_DT, still, 0, 0); low = Math.min(low, rel()[1]); }
  return { low, at, end: rel(), grounded: m.grounded };
}

test('AUDIT PRE-MERGE 1003 W1: a watcher walks from the terrace round to the gate\'s flight, down it into the courtyard and out along the passage - the city\'s ground under every step, the passage shut at the market with its way out there, the cell\'s edge shut; the ground drawn as the city\'s paving (mutants: AUDIT1003-W1-*)', async () => {
  const { col, ids, getModel } = await madeLevel('watch');
  const c = AF.floorCentre();
  const ground = GROUND_OFFSET * 0.025 - c[1];   // the city's ground over the sand (world/rmbLayout.js GROUND_OFFSET)
  // the walk (the auditor's): from where a watcher arrives, round the west terrace, down the gate's west flight, on east
  // over the courtyard - then north along the gate passage toward the market
  const m = new PlayerMotor(col);
  const a = AF.ARRIVE.watch.at;
  m.spawn(c[0] + a[0], c[1] + a[2] + 0.4, c[2] + a[1]);
  for (let i = 0; i < 30; i++) m.update(FIXED_DT, still, 0, 0);
  const w = walk(m, c, [[-21, -12], [-22, 0], [-21, 12], [-16, 22], [-12, 27], [-11, 30], [-4, 30], [4, 30], [0.4, 40], [0.4, 62]]);
  assert.ok(w.low > -1, `never more than a metre under the sand (lowest ${w.low.toFixed(1)} m; ends ${w.end.map((v) => v.toFixed(1))})`);
  assert.ok(Math.abs(w.at[7][1] - ground) < 0.05, `down the flight onto the courtyard's ground: ${w.at[7].map((v) => v.toFixed(2))}`);
  assert.ok(w.grounded && Math.abs(w.end[1] - ground) < 0.05, `standing at the end: ${w.end.map((v) => v.toFixed(2))}`);
  assert.ok(w.end[2] < 51.94 && w.end[2] > 50, `the passage walked to its mouth and no further (the arch's face at 51.94): z ${w.end[2].toFixed(2)}`);
  // the courtyard at the gate flight's foot: no floor in Kamer's mesh - the city's terrain is its floor
  const d = col.raycast([c[0] + 3, c[1] + 5, c[2] + 30], [0, -1, 0], 50);
  assert.ok(Number.isFinite(d), 'a ray down at the courtyard (3, 30) meets ground');
  assert.ok(Math.abs(5 - d - ground) < 0.01, `at the city's ground: ${(5 - d).toFixed(3)} over the sand, the ground ${ground.toFixed(3)}`);
  // the way out where the passage meets the market (the Herald's side), within an arm of where the walk stopped
  const doors = AF.arenaExitDoors();
  const mouth = doors.find((x) => Math.abs(x.matrix[14] - c[2] - w.end[2]) < 1.5 && Math.abs(x.matrix[12] - c[0] - w.end[0]) < 1.6);
  assert.ok(mouth, 'a way out at the gate passage\'s mouth');
  assert.ok(Math.abs(mouth.matrix[13] - c[1] - ground) < 0.01 && mouth.normal.z < -0.99, 'on the ground, facing back into the floor');
  // a body out on the apron (over a wall, say) walks to the cell's edge and no further
  const o = new PlayerMotor(col);
  o.spawn(c[0] + 0.4, c[1] + ground + 0.4, c[2] + 55);
  for (let i = 0; i < 30; i++) o.update(FIXED_DT, still, 0, 0);
  const e = walk(o, c, [[0.4, 70]], 8);
  assert.ok(e.low > ground - 0.5 && e.grounded && e.end[2] < 102.4 - c[2], `the cell's edge holds: ends ${e.end.map((v) => v.toFixed(2))}`);
  // DRAWN: the made block stands the ground's model, the city's flagstone in its lays over the whole cell, its walls never drawn
  assert.ok(ids.includes(AF.ARENA_GROUND_MODEL), 'the made block places the ground');
  const g = getModel(AF.ARENA_GROUND_MODEL);
  const tiles = arenaGroundTiles();
  assert.deepEqual(g.subMeshes.map((s) => [s.textureArchive, s.textureRecord, s.startIndex, s.primitiveCount]), [[302, ARENA_PAVING, 0, 512]], 'the instance\'s ground archive (302, season 0), the city\'s record 46');
  assert.equal(g.colliderOnlyFrom, 512 * 3, 'the walls past the drawn faces: the collider\'s alone');
  let area = 0;
  for (let t = 0; t < 512 * 3; t += 3) {
    const P = [0, 1, 2].map((k) => [0, 1, 2].map((j) => g.positions[g.indices[t + k] * 3 + j]));
    const u = P[1].map((v, j) => v - P[0][j]), v = P[2].map((x, j) => x - P[0][j]);
    const cy = u[2] * v[0] - u[0] * v[2];
    assert.ok(cy > 0 && P.every((q) => q[1] === 0), 'every paving face up, on the ground');
    area += cy / 2;
  }
  assert.ok(Math.abs(area - 102.4 * 102.4) < 1e-3, `the whole cell: ${area.toFixed(1)} m2`);
  const LAY0 = [[0, -1], [0, 0], [1, 0], [1, -1]];   // the (0, 0) corner's uv under each lay (render/renderer.js ROT/TRANS)
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const k = ty * 16 + tx, t = tiles[(15 - ty) * 16 + tx], lay = (t.IsRotated ? 1 : 0) + (t.IsFlipped ? 2 : 0);
    assert.deepEqual([g.uvs[k * 8], g.uvs[k * 8 + 1]], LAY0[lay], `tile (${tx}, ${ty}) in the city's lay`);
    assert.deepEqual([g.positions[k * 12], g.positions[k * 12 + 2]], [tx * 6.4, ty * 6.4].map((x) => Math.fround(x)));
  }
});

test('AUDIT PRE-MERGE 1003 W2: the relay\'s hour watched in the instance hangs the Red on the west and the Blue on the east, as this screen\'s own exhibition does (mutant: AUDIT1003-W2-RELAY-EX)', () => {
  const mk = () => createArenaBouts({ now: () => 1000, playerEntity: { name: 'Hero', health: 100, maxHealth: 100 }, setPlayerBout: () => {}, say: () => {}, notice: () => {}, pay: () => {}, heal: () => {}, crime: () => {}, drawHud: () => {}, sound: { cue: () => {}, bed: () => {}, stop: () => {} } });
  let ex = null;
  for (let min = 0; min < 60 * 24 * 3 && !ex?.open; min += 5) ex = exhibitionFor(min);
  const hung = (b) => {
    const blk = AF.arenaFloorBlock('watch', undefined, b);
    const idsOf = blk.rdbBlock.objectRootList[0].rdbObjects.filter((o) => o.type === 1).map((o) => blk.rdbBlock.modelReferenceList[o.resources.modelResource.modelIndex].modelIdNum);
    return [idsOf.filter((i) => i === AF.ARENA_BANNER_MODEL.red).length, idsOf.filter((i) => i === AF.ARENA_BANNER_MODEL.blue).length];
  };
  const off = mk();
  off.ask({ where: 'floor', kind: 'exhibition', ex });
  assert.deepEqual(off.floorBanners(), { west: 'red', east: 'blue' }, 'offline: this screen\'s exhibition');
  // online: scenes/arenaOnline.js goTo's ask for the hour's bout from the stands (ARENA4b) - `relayEx`, no `relay`, no `kind`
  const on = mk();
  on.ask({ where: 'floor', relayEx: { o: `x${ex.hour}`, ex } });
  assert.deepEqual(on.floorBanners(), { west: 'red', east: 'blue' }, 'online: the relay\'s - startExhibitionRelay\'s Red against Blue');
  assert.deepEqual(hung(on.floorBanners()), [9, 9], 'nine Red banners on the west, nine Blue on the east');
  // the city's relayEx is no floor's
  const city = mk();
  city.ask({ where: 'city', relayEx: { o: `x${ex.hour}`, ex } });
  assert.deepEqual(city.floorBanners(), { west: null, east: null });
});

test('AUDIT PRE-MERGE 1003 W4: in the floor\'s instance the climate-free colosseum keeps every picture - the level\'s texture table never reaches it, nor its keys the level\'s map; every other model is remapped as before (mutants: AUDIT1003-W4-*)', async () => {
  const DC = await import('../src/scenes/dungeonContext.js');
  const model = drawnColosseum();
  _resetCustomModels();
  registerCustomModel(ARENA_MODEL_ID, () => model, () => true, { climateFree: true });
  const city = { regionIndex: 17, regionName: 'Daggerfall', climate: { worldClimate: 231, climateType: 2 } };
  const dungeon = layoutDungeon(AF.arenaFloorLocation({ kind: 'ladder', city }), AF.arenaFloorBlocks(null, 'ladder'), (id) => (id === ARENA_MODEL_ID ? model : emptyModel()));
  const remap = (archive) => applyTextureTable(archive, dungeon.textureTable, 2);
  assert.ok(model.subMeshes.some((s) => remap(s.textureArchive) !== s.textureArchive), 'the level\'s table would turn some of its pictures (its 122/124 passages)');
  const deps = { getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {} };
  // the context's remap for a placed model (scenes/dungeonContext.js ensureRemap -> levelModelRemap); the unfixed context
  // ran remapSubMeshes for every placed model, the stand-in below
  const levelRemap = DC.levelModelRemap ?? (async (id, subMeshes, texRemap, rm, d) => { await remapSubMeshes(subMeshes, texRemap, rm, d); return texRemap; });
  const texRemap = new Map();
  const drawnBy = await levelRemap(ARENA_MODEL_ID, model.subMeshes, texRemap, remap, deps);
  const key = keyResolver(drawnBy);
  const swapped = model.subMeshes.map((s) => [`${s.textureArchive}_${s.textureRecord}`, key(s.textureArchive, s.textureRecord)]).filter(([a, b]) => a !== b);
  assert.deepEqual(swapped, [], 'no picture of the colosseum swapped');
  assert.equal(texRemap.size, 0, 'no key of its in the level\'s map');
  assert.equal(CM.NO_CLIMATE_REMAP.size, 0);
  // any other model of the level, as before
  const other = new Map();
  assert.equal(await levelRemap(41000, [{ textureArchive: 122, textureRecord: 2 }], other, remap, deps), other);
  assert.equal(other.get('122_2'), `${remap(122)}_2`);
  _resetCustomModels();
  // the host's climate-free arm: the placement takes the answer, the entry carries its own table, the merge resolves by
  // it, and both dungeon hosts draw an unmerged entry by it
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /return levelModelRemap\(id, cpuModels\.get\(id\)\?\.subMeshes, texRemap, \(archive\) => remap\(archive\), deps\);/);
  assert.match(dc, /const climateFree = \(await ensureRemap\(p\.modelIdNum\)\) === NO_CLIMATE_REMAP;/);
  assert.match(dc, /drawList\.push\(\{ mesh: gpu, matrix, key: `\$\{bi\}:\$\{p\.position\}`, aabb, \.\.\.\(climateFree \? \{ texRemap: NO_CLIMATE_REMAP \} : \{\}\) \}\);/);
  assert.match(dc, /staticBuilder\.add\(cpu, matrix, climateFree \? ownTexKey : resolveTexKey\);/);
  assert.match(dc, /const ownTexKey = keyResolver\(NO_CLIMATE_REMAP\);/);
  for (const [f, ctx] of [['src/scenes/worldModes.js', 'dungeonCtx'], ['src/scenes/dungeon.js', 'ctx']]) {
    assert.ok(read(f).includes(`for (const d of ${ctx}.drawList) if (!d._batched) renderer.drawMesh(d.mesh, d.matrix, d.texRemap ?? ${ctx}.texRemap);`), f);
  }
});

test('AUDIT PRE-MERGE 1003 W5: on the colosseum every seat stands on level ground a stride wide, along and across the radius - never on the parapet\'s coping, a fence\'s top or a stair\'s collider ramp; the stands still full (mutants: AUDIT1003-W5-*)', () => {
  const model = drawnColosseum();
  const blk = AF.arenaFloorBlock('watch');
  const obj = blk.rdbBlock.objectRootList[0].rdbObjects.find((o) => o.type === 1 && blk.rdbBlock.modelReferenceList[o.resources.modelResource.modelIndex].modelIdNum === ARENA_MODEL_ID);
  const M = getModelMatrix(obj);   // where the made block stands it (world/rdbLayout.js)
  // the drawn faces and the ramps the collider alone stands on (world/arenaModel.js withStairRamps), in buckets of their own
  const col = new Collider(() => -Infinity);
  col.addMesh('drawn', model.positions, model.indices.slice(0, model.colliderOnlyFrom), M);
  col.addMesh('ramp', model.positions, model.indices.slice(model.colliderOnlyFrom), M);
  const c = AF.floorCentre();
  // the instance's own ground under a seat (scenes/worldModes.js arenaFloorStage heightAt), in the floor's frame
  const heightAt = (x, z) => { const top = c[1] + 24; const d = col.raycast([c[0] + x, top, c[2] + z], [0, -1, 0], 48); return Number.isFinite(d) ? top - d - c[1] : null; };
  const seats = AF.crowdSeats(heightAt);
  assert.ok(seats.length > 1200, `the stands still seat a sold-out crowd several times over: ${seats.length}`);
  const bad = [];
  for (const s of seats) {
    const a = Math.atan2(s.z, s.x), r = [Math.cos(a) * 0.35, Math.sin(a) * 0.35];
    for (const [dx, dz] of [[r[0], r[1]], [-r[0], -r[1]], [-r[1], r[0]], [r[1], -r[0]]]) {
      const g = heightAt(s.x + dx, s.z + dz);
      if (!Number.isFinite(g) || Math.abs(g - s.y) > 0.15) { bad.push(`unlevel at r ${Math.hypot(s.x, s.z).toFixed(1)} y ${s.y.toFixed(2)}`); break; }
    }
    const top = c[1] + 24;
    if (col.raycastHit([c[0] + s.x, top, c[2] + s.z], [0, -1, 0], 48).key === 'ramp') bad.push(`over a ramp at r ${Math.hypot(s.x, s.z).toFixed(1)} y ${s.y.toFixed(2)}`);
  }
  assert.deepEqual(bad.slice(0, 6), [], `${bad.length} seats with no footing`);
});

test('AUDIT PRE-MERGE 1003 W6: the colosseum\'s seal gives the frame back - the same bytes a breath at a time, through the registry\'s door the pipeline asks with the pixel\'s breather (mutants: AUDIT1003-W6-*)', async () => {
  assert.equal(typeof AM.sealArenaSeamsSliced, 'function', 'the seal has a step that gives the frame back (it ran ~0.5 s in one piece)');
  const built = buildArenaModel(IDX, BIN, () => null);
  let breaths = 0;
  const sliced = await AM.sealArenaSeamsSliced(built, async () => { breaths++; });
  assert.ok(breaths > 100, `it breathes: ${breaths} times`);
  const straight = sealArenaSeams(built);
  assert.deepEqual(sliced.stats, straight.stats);
  assert.deepEqual(sliced.subMeshes, straight.subMeshes);
  for (const k of ['positions', 'normals', 'uvs', 'indices']) assert.ok(Buffer.from(sliced[k].buffer).equals(Buffer.from(straight[k].buffer)), `${k}: the bytes sealArenaSeams makes`);
  // the registry's door: a registration's sliced build is handed the breather, and built once
  assert.equal(typeof CM.customModelBuilt, 'function', 'the registry has a door that lets a build breathe');
  _resetCustomModels(); _resetArena();
  await installArena({ readBin: async () => BIN, log: null });
  let n = 0;
  const viaDoor = await CM.customModelBuilt(ARENA_MODEL_ID, { classicModel: () => null }, async () => { n++; });
  assert.ok(n > 100, `installArena's colosseum breathes through it: ${n}`);
  assert.equal(customModelFor(ARENA_MODEL_ID), viaDoor, 'and is the one model built');
  assert.ok(Buffer.from(viaDoor.positions.buffer).equals(Buffer.from(drawnColosseum().positions.buffer)), 'arenaDrawnModel\'s');
  assert.equal(await CM.customModelBuilt(ARENA_MODEL_ID, null, async () => { n += 1000; }), viaDoor);
  assert.ok(n < 1000, 'built once');
  _resetCustomModels(); _resetArena();
  // the pixel's build hands its breather to the pipeline, the pipeline to the registry's door
  assert.match(read('src/scenes/world.js'), /const gpu = await getGpuMesh\(placed\.modelIdNum, \(\) => breather\.breathe\(\)\);/);
  const pipe = read('src/scenes/dataPipeline.js');
  assert.match(pipe, /const getGpuMesh = \(modelIdNum, breathe = null\) => cachedMesh\(modelIdNum, \(\) => buildGpuMesh\(modelIdNum, breathe\)\);/);
  assert.match(pipe, /const custom = await customModelBuilt\(modelIdNum, \{ classicModel: classicModelOf \}, breathe\);/);
});

test('AUDIT PRE-MERGE 1003 W7: a crown city\'s castle entrance is never the arena\'s undercroft stair, however low it stands - the stair stays a door the player takes (mutants: AUDIT1003-W7-*)', () => {
  const box = [60, 0, -20, 100, 30, 20];
  const castle = { door: { a: [60, 0, -1], b: [60, 3, 1] }, box, normal: [-1, 0, 0] };
  const stair = { door: { a: [20, -3, 64], b: [22, -1, 64] }, box: [18, -4, 60, 24, 2, 68], normal: [0, 0, -1], arena: true };
  assert.deepEqual(castleEntranceOf([castle, stair]).door, castle.door, 'the castle\'s, not the lower stair');
  assert.deepEqual(castleEntranceOf([stair, castle]).door, castle.door, 'in either order');
  assert.equal(castleEntranceOf([stair]), null, 'a town whose only low door is the arena\'s has no castle entrance by it');
  assert.deepEqual(castleEntranceOf([{ ...stair, arena: false }, castle]).door, stair.door, 'any other lower door is still the lowest');
  // the city's host marks the arena block's dungeon entrances in the castle's list alone; the doors the player takes are
  // gathered beside it as before (the undercroft's own door: isUndercroftDoor over the host's door list)
  const w = read('src/scenes/world.js');
  assert.match(w, /pixelDungeonDoors\.push\(\{ door: doorCornersOf\(d, local\), box, normal: doorNormalOf\(d, local\), arena: b\.blockName === ARENA_BLOCK \}\);/);
  assert.match(w, /const staticDoors = getStaticDoors\(cpu, b\.dfBlock\.index, placed\.recordIndex, local\);/);
});

test('AUDIT PRE-MERGE 1003 W8: the city\'s schedule says what it does - one start an hour, never again that hour after a walk away or a door (mutant: AUDIT1003-W8-DOC)', () => {
  const w = read('src/scenes/world.js');
  assert.ok(!w.includes('a walk back restarts it'), 'no walk back restarts the hour\'s exhibition');
  assert.ok(!/comes back from its\s+\*\s+call if I return inside its window/.test(w), 'nor brings it back from its call');
  assert.match(w, /`_arenaHourRun` starts each hour's bout once, and nothing clears it/);
  assert.match(w, /if \(ex\?\.open && ex\.hour !== _arenaHourRun\) \{ _arenaHourRun = ex\.hour; arenaBouts\.ask\(\{ where: 'city', kind: 'exhibition', ex \}\); \}/, 'the code it describes');
});
