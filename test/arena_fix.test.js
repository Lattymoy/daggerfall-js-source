// ARENA-FIX (2026-10-02): THE ARENA'S QA ROUND - the visual QA pass and the ARENA2 builder's findings, each fixed and
// pinned here: the stairs walkable (ramps over every run, the collider's alone), one submesh a picture, the seams
// closed, the cell paved and its blind sides furnished, the gate's people by their office, the undercroft as the
// fighters' hall (no random foe, its people, its chained beasts, the training pit's practice bout, the Hall of
// Champions), the fighters' walk to their marks, the misses and the real crits heard, a burning torch carried, the
// court's nobles at their own scale, the player's sprite turned with a placing. bible/11-Multiplayer/Arena.md
// "ARENA-FIX record".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  arenaStairRuns, arenaStairRamps, withStairRamps, nosingHull, sealArenaSeams, buildArenaModel, composeArenaModel,
  STAIR_RISER_MAX, RAMP_BELOW, RAMP_LIFT, T_EPS, SINK_M,
} from '../src/world/arenaModel.js';
import { arenaGroundTiles, arenaBlockJson, ARENA_PAVING, ARENA_PLAZA_FLATS, ARENA_PLAZA_MODELS, arenaGatePersonName, ARENA_GATE_PEOPLE, arenaDrawnModel } from '../src/world/arenaCity.js';
import { undercroftPopulation, chainTag, PIT_MASTER, HALL_KEEPER, UNDERCROFT_PEOPLE, UNDERCROFT_BEASTS, UNDERCROFT_FACTION, PIT_DUMMY, HALL_BRAZIER } from '../src/world/arenaUndercroft.js';
import { boutGate } from '../src/characters/enemyTargets.js';
import { practiceBout, hallOfChampions, newArenaLadder, LADDER_TIERS } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createArenaBouts, YOU, CROWD_SCALE, WALK_PACE, CRIT_SHARE } from '../src/scenes/arenaBouts.js';
import { arenaHudModel } from '../src/ui/arenaHud.js';
import { CROWD_PEOPLE } from '../src/systems/arenaCrowd.js';
import { EnemyAI, WALK_ARRIVE_M } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { calculateAttackDamage, registerAttackResolutionListener } from '../src/combat/formulas.js';
import { droppedLightItem } from '../src/systems/arenaMove.js';
import { createEotbBody, PLACE_JUMP_M } from '../src/player/eotbBody.js';
import { HAS_ARENA2, classicModels, vendorBytes } from './arena1Data.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const idx = JSON.parse(rd('vendor/daggerfall-arena/Models/864102.json'));
const settle = () => new Promise((r) => setTimeout(r, 0));
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A made staircase: `n` risers `rise` high a `tread` apart going up -x, `width` wide in z, each riser two triangles
 *  and each tread two - a model in the meshReader shape, one picture. */
function stair({ n = 6, rise = 0.37, tread = 0.4, width = 4, x0 = 0, y0 = 0 } = {}) {
  const pos = [], idx = [];
  const quad = (a, b, c, d) => { const v = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(v, v + 1, v + 2, v, v + 2, v + 3); };
  for (let i = 0; i < n; i++) {
    const x = x0 - i * tread, y = y0 + i * rise;
    quad([x, y, 0], [x, y + rise, 0], [x, y + rise, width], [x, y, width]);   // the riser (vertical, in the plane x)
    quad([x, y + rise, 0], [x - tread, y + rise, 0], [x - tread, y + rise, width], [x, y + rise, width]);   // its tread
  }
  const nv = pos.length / 3;
  return { positions: Float32Array.from(pos), normals: new Float32Array(nv * 3), uvs: new Float32Array(nv * 2), indices: Uint32Array.from(idx), subMeshes: [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: idx.length / 3 }], doors: [] };
}

test('ARENA-FIX 1: a staircase read off its faces - its risers chained, the way up, its width, its nosings; a lone step and a wall are no stair', () => {
  const runs = arenaStairRuns(stair());
  assert.equal(runs.length, 1);
  const r = runs[0];
  assert.deepEqual(r.up.map((v) => v + 0), [-1, 0], 'the way up is -x');
  assert.equal(r.nosings.length, 6);
  assert.ok(Math.abs(r.t1 - r.t0 - 4) < 1e-6, 'the width the risers share');
  assert.ok(Math.abs(r.foot) < 1e-6);
  assert.equal(arenaStairRuns(stair({ n: 2 })).length, 0, 'two risers are no run');
  assert.equal(arenaStairRuns(stair({ rise: STAIR_RISER_MAX + 0.1 })).length, 0, 'a wall (or a seat) of risers is no stair');
  assert.equal(arenaStairRuns(stair({ tread: 1.2 })).length, 0, 'treads too deep: terraces, not a stair');
  // a zigzag - risers that stand on one another but turn back - is no run: a stair goes one way
  const zig = stair({ n: 2 });
  const zz = stair({ n: 1, x0: 0, y0: 0.74 });
  const both = { ...zig, positions: Float32Array.from([...zig.positions, ...zz.positions]), normals: new Float32Array(zig.normals.length + zz.normals.length), uvs: new Float32Array(zig.uvs.length + zz.uvs.length),
    indices: Uint32Array.from([...zig.indices, ...[...zz.indices].map((i) => i + zig.positions.length / 3)]) };
  both.subMeshes = [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: both.indices.length / 3 }];
  assert.equal(arenaStairRuns(both).length, 0, 'up -x, then back over the first riser: no stair');
});

test('ARENA-FIX 1: the ramp over a run - through the nosings\' upper hull, none above it, run on under the first riser\'s foot, the collider\'s alone', () => {
  const m = stair();
  const { positions, indices } = arenaStairRamps(m);
  assert.ok(indices.length > 0);
  // the ramp's height at s along the way up (x = -s), from its quads
  const ys = []; for (let i = 1; i < positions.length; i += 3) ys.push(positions[i]);
  const lowest = Math.min(...ys), highest = Math.max(...ys);
  assert.ok(Math.abs(lowest - (-RAMP_BELOW + RAMP_LIFT)) < 1e-4, `its foot runs on RAMP_BELOW under the first riser's (${lowest})`);
  assert.ok(Math.abs(highest - (6 * 0.37 + RAMP_LIFT)) < 1e-4, 'its head at the top nosing');
  // the hull of uneven risers: a nosing above the chord is kept, so none stands above the ramp
  const hull = nosingHull([{ s: 0, y: 0 }, { s: 1, y: 0.6 }, { s: 2, y: 0.8 }, { s: 3, y: 1.2 }]);
  assert.deepEqual(hull.map((p) => p.s), [0, 1, 3]);
  const w = withStairRamps(m);
  assert.equal(w.colliderOnlyFrom, m.indices.length, 'the drawn triangles first, unchanged');
  assert.deepEqual([...w.indices.slice(0, m.indices.length)], [...m.indices]);
  assert.equal(w.indices.length, m.indices.length + indices.length);
  const named = w.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0);
  assert.equal(named, m.indices.length, 'no submesh names a ramp: nothing draws it, every collider (the whole list) stands on it');
  assert.equal(w.normals.length, w.positions.length, 'a vertex for every attribute');
  // the collider walks it: a capsule's ray down the middle of the run meets the ramp, never a riser's lip above it
  const col = new Collider(() => -100);
  col.addMesh('m', w.positions, w.indices, I4);
  for (const x of [-0.1, -0.5, -1.0, -1.7]) {
    const d = col.raycast([x, 5, 2], [0, -1, 0], 10);
    const rampY = 0.37 * (1 + -x / 0.4) + RAMP_LIFT;   // the line through the nosings (the first's at x 0, 0.37 up)
    assert.ok(Math.abs((5 - d) - rampY) < 0.05, `at x ${x} the floor is the ramp (${(5 - d).toFixed(3)} vs ${rampY.toFixed(3)})`);
  }
});

test('ARENA-FIX 1 (ARENA2): every stair of 864102 surveyed - the gate\'s two flights, the east twin, the south terrace\'s two', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const m = buildArenaModel(idx, vendorBytes('Models/864102.bin'), classicModels());
  const runs = arenaStairRuns(m).map((r) => ({ up: r.up.map((v) => Math.round(v) + 0), n: r.nosings.length, foot: +r.foot.toFixed(2), top: +r.nosings.at(-1).y.toFixed(2), w: +(r.t1 - r.t0).toFixed(2) }));
  assert.deepEqual(runs.sort((a, b) => a.foot - b.foot || a.up[0] - b.up[0]), [
    { up: [-1, 0], n: 19, foot: -4.8, top: 2.24, w: 7.35 },    // the gate courtyard's flight up (its foot 0.22 m over the city's ground)
    { up: [-1, 0], n: 14, foot: 2.24, top: 7.93, w: 6.9 },    // ...its second flight to the ring
    { up: [1, 0], n: 14, foot: 2.24, top: 7.93, w: 6.9 },     // the east twin
    { up: [-1, 0], n: 10, foot: 7.47, top: 10.66, w: 4.47 },   // the south terrace's two flights
    { up: [1, 0], n: 10, foot: 7.47, top: 10.66, w: 4.47 },
  ]);
  const drawn = arenaDrawnModel(m);
  assert.equal(drawn.stairRuns, 5);
  assert.equal(drawn.subMeshes.length, 23, 'one submesh a picture');
});

test('ARENA-FIX 5 (ARENA2): one submesh a picture - 23 draws for 23 pictures, every triangle of the 5,138 still under its own', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const m = buildArenaModel(idx, vendorBytes('Models/864102.bin'), classicModels());
  assert.equal(m.subMeshes.length, 23);
  assert.equal(new Set(m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`)).size, 23);
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount, 0), 5138);
  let at = 0;
  for (const s of m.subMeshes) { assert.equal(s.startIndex, at, 'end to end, no gap, no overlap'); at += s.primitiveCount * 3; }
  assert.equal(at, m.indices.length);
  // the same triangles as the parts kept side by side (the extraction's exactness - test/arena1_extract - still holds)
  const key = (mm) => { const out = new Map(); for (const s of mm.subMeshes) for (let i = s.startIndex; i < s.startIndex + s.primitiveCount * 3; i += 3) { const k = `${s.textureArchive}_${s.textureRecord}|${[0, 1, 2].map((c) => mm.indices[i + c])}`; out.set(k, (out.get(k) ?? 0) + 1); } return out; };
  const parts = [{ ...m }];
  assert.deepEqual(key(composeArenaModel(parts)), key(m), 'a merge of a merged model is itself');
});

test('ARENA-FIX 6: the seams closed - a T-junction cut at its corner, a coplanar overlap set back, a hair\'s gap welded; the surface and its pictures kept', () => {
  // two quads side by side, the right one halved: the left's long edge carries the right's middle corner
  const P = [0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0, /* right halves */ 1, 0, 0, 2, 0, 0, 2, 1, 0, 1, 1, 0, 1, 2, 0, 2, 2, 0];
  const I = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 7, 6, 9, 7, 9, 8];
  const nv = P.length / 3;
  const m = { positions: Float32Array.from(P), normals: new Float32Array(nv * 3).fill(0), uvs: new Float32Array(nv * 2), indices: Uint32Array.from(I), subMeshes: [{ textureArchive: 9, textureRecord: 0, startIndex: 0, primitiveCount: 6 }] };
  const s = sealArenaSeams(m);
  assert.equal(s.stats.tjunctions, 1, 'the corner (1,1) on the left quad\'s edge');
  assert.equal(s.stats.cut, 1);
  assert.equal(s.subMeshes.length, 1);
  const area = (mm) => { let a = 0; for (let t = 0; t < mm.indices.length; t += 3) { const p = [0, 1, 2].map((k) => [0, 1, 2].map((c) => mm.positions[mm.indices[t + k] * 3 + c])); const e1 = p[1].map((v, i) => v - p[0][i]), e2 = p[2].map((v, i) => v - p[0][i]); a += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2; } return a; };
  assert.ok(Math.abs(area(s) - area(m)) < 1e-6, 'the surface kept');
  assert.equal(sealArenaSeams(s).stats.tjunctions, 0, 'sealed, nothing left to cut');
  // an overlap: two triangles in one plane, two pictures - the plane's lesser picture set back SINK_M
  const O = { positions: Float32Array.from([0, 0, 0, 4, 0, 0, 0, 0, 4, 1, 0, 0.5, 2, 0, 0.5, 1, 0, 1.5]), normals: new Float32Array(18), uvs: new Float32Array(12), indices: Uint32Array.from([0, 2, 1, 3, 5, 4]),
    subMeshes: [{ textureArchive: 1, textureRecord: 0, startIndex: 0, primitiveCount: 1 }, { textureArchive: 1, textureRecord: 1, startIndex: 3, primitiveCount: 1 }] };
  const so = sealArenaSeams(O);
  assert.equal(so.stats.sunk, 1);
  const small = so.subMeshes.find((x) => x.textureRecord === 1);
  const ys = [0, 1, 2].map((k) => so.positions[so.indices[small.startIndex + k] * 3 + 1]);
  assert.ok(ys.every((y) => Math.abs(Math.abs(y) - SINK_M) < 1e-6), 'the patch is set back off the plane');
  // a weld: two corners T_EPS/2 apart are one
  const W = { positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1, 1 + T_EPS / 2, 0, 0, 1, 0, 1, 0, 0, 1]), normals: new Float32Array(18), uvs: new Float32Array(12), indices: Uint32Array.from([0, 2, 1, 3, 5, 4]), subMeshes: [{ textureArchive: 1, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] };
  assert.equal(sealArenaSeams(W).stats.welded, 1);
});

test('ARENA-FIX 6 (ARENA2): the colosseum sealed - its T-junctions cut, its 7 overlaps set back, every picture\'s area kept', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const m = buildArenaModel(idx, vendorBytes('Models/864102.bin'), classicModels());
  const s = sealArenaSeams(m);
  assert.ok(s.stats.tjunctions >= 800, `${s.stats.tjunctions} corners on edges cut`);
  assert.equal(s.stats.sunk, 7, 'the seven same-facing coplanar overlaps');
  assert.equal(s.subMeshes.length, 23);
  assert.ok(sealArenaSeams(s).stats.tjunctions < s.stats.tjunctions / 10, 'a second pass finds almost nothing (slivers under T_EPS)');
});

test('ARENA-FIX 3: the cell paved with the city\'s flagstone in its four lays; the blind sides\' plazas furnished with Daggerfall\'s own street furniture', () => {
  const tiles = arenaGroundTiles();
  assert.equal(tiles.length, 256);
  assert.equal(ARENA_PAVING, 46, 'the climate set\'s flagstone - every street of the city round it');
  assert.ok(tiles.every((t) => t.TextureRecord === ARENA_PAVING && (t.TileBitfield & 0x3f) === ARENA_PAVING));
  assert.equal(new Set(tiles.map((t) => t.TileBitfield)).size, 4, '46, 110, 174, 238 - the four lays');
  assert.deepEqual(tiles, arenaGroundTiles(), 'the same every load');
  const b = arenaBlockJson();
  assert.deepEqual(b.RmbBlock.FldHeader.GroundData.GroundTiles, arenaGroundTiles(), 'the block served is paved');
  assert.equal(b.RmbBlock.FldHeader.GroundData.GroundTiles.length, 256);
  const flats = b.RmbBlock.MiscFlatObjectRecords.slice(35);
  assert.deepEqual(flats.map((f) => `${f.TextureArchive}:${f.TextureRecord}`), ARENA_PLAZA_FLATS.map((f) => `${f.archive}:${f.record}`));
  assert.equal(flats.filter((f) => f.TextureArchive === 210 && f.TextureRecord === 29).length, 6, 'the street lamps: either side of each street\'s end');
  const models = b.RmbBlock.Misc3dObjectRecords.slice(119);
  assert.deepEqual(models.map((m) => m.ModelIdNum), ARENA_PLAZA_MODELS.map((m) => m[0]));
  for (const o of [...flats, ...models]) assert.ok(o.XPos > 0 && o.XPos < 4096 && o.ZPos > -4096 && o.ZPos < 0, 'inside the cell');
  // the vendored block is Kamer's: his grass and dirt
  assert.ok(JSON.parse(rd('vendor/daggerfall-arena/Arena/ARENADAG.RMB.json')).RmbBlock.FldHeader.GroundData.GroundTiles.some((t) => t.TextureRecord === 2));
});

test('ARENA-FIX 2: the gate\'s people named by their office - the plaque, "You see", the talk window', () => {
  const pn = (p) => ({ position: p.position, textureArchive: p.archive, textureRecord: p.record });
  const names = Object.fromEntries(ARENA_GATE_PEOPLE.map((p) => [p.role, arenaGatePersonName(pn(p))]));
  assert.deepEqual(names, { herald: 'The Herald of the Arena', warden: 'Arena Warden', redRecruiter: 'Red Banner Recruiter', blueRecruiter: 'Blue Banner Recruiter', bookmaker: 'The Bookmaker' });
  assert.equal(arenaGatePersonName({ position: 7, textureArchive: 183, textureRecord: 5 }), null, 'anyone else keeps their own');
  const W = rd('src/scenes/worldModes.js');
  assert.match(W, /const officeName = \(pn\) => arenaGatePersonName\(pn\) \?\? /);
  assert.match(W, /const displayName = officeName\(pn\) \?\? npcDisplayName\(staticNpcData\(pn, npcSceneCtx\)\);/, 'Info: "You see ..."');
  assert.match(W, /npcName: officeName\(pn\) \?\? displayName, portrait:/, 'the talk door');
  assert.ok((W.match(/const display = officeName\(pn\) \?\? npcDisplayName\(staticNpcData\(pn, staticNpcSceneCtx\(pn\)\)\);/g) ?? []).length >= 3, 'the plaques (the street, the dungeon, the interior)');
});

test('ARENA-FIX 7: the record says which way the gate faces - north, onto the market (the compass calls +z north)', () => {
  const A = rd('bible/11-Multiplayer/Arena.md');
  assert.match(A, /The gate opens onto the market \(cell 4,4\), to the north/);
  assert.doesNotMatch(A, /cell 4,4, south/);
});

/** The undercroft's markers: a start, then random markers out along x, one block. */
function undercroftBlocks(n = 20) {
  const markers = [{ archive: 199, record: 10, x: 0, y: 1, z: 0 }];
  for (let i = 1; i <= n; i++) markers.push({ archive: 199, record: i % 5 ? 15 : 16, x: i * 3, y: 1, z: (i % 2) * 2 });
  markers.push({ archive: 216, record: 15, x: 1, y: 1, z: 1 });   // a treasure marker - none of the hall's
  return [{ layout: { markers, flats: [] }, originX: 100, originZ: 200 }];
}

test('ARENA-FIX 4: the fighters\' hall laid at the markers - the pit and its master nearest the stair, the Hall and its keeper, the people, the chained beasts, the rest quiet', () => {
  const blocks = undercroftBlocks(20);
  blocks[0].layout.markers = [blocks[0].layout.markers[0], ...blocks[0].layout.markers.slice(1).reverse()];   // the file's order is not the distance's
  const h = undercroftPopulation(blocks);
  const people = h.flats.filter((f) => f.npc);
  assert.deepEqual(people.map((p) => p.role), [PIT_MASTER.role, HALL_KEEPER.role, ...UNDERCROFT_PEOPLE.map((p) => p.role)]);
  assert.ok(people.every((p) => p.factionID === UNDERCROFT_FACTION), 'the People of Daggerfall: they talk as the city does');
  assert.deepEqual([people[0].x, people[0].z], [3, 2], 'the pit at the nearest marker (block frame)');
  assert.deepEqual(h.pit, [103, 1, 202]);
  assert.ok(h.flats.some((f) => f.archive === PIT_DUMMY[0] && f.record === PIT_DUMMY[1]), 'the straw dummy');
  assert.equal(h.flats.filter((f) => f.archive === HALL_BRAZIER[0] && f.record === HALL_BRAZIER[1]).length, 2, 'a brazier at the pit and the Hall');
  assert.deepEqual(h.beasts.map((b) => b.mobileType), [...UNDERCROFT_BEASTS]);
  assert.equal(h.quiet, 20 - 2 - UNDERCROFT_PEOPLE.length - UNDERCROFT_BEASTS.length);
  assert.equal(h.lights.length, 2 + UNDERCROFT_PEOPLE.length, 'every place a person stands is lit');
  assert.ok(h.flats.find((f) => f.archive === 334 && f.record === 18).flags === 32, 'her gender flag');
  assert.equal(new Set(h.flats.map((f) => f.position)).size, h.flats.length, 'each its own identity (the name seed)');
  assert.deepEqual(undercroftPopulation(blocks), h, 'the same every load');
  assert.deepEqual(undercroftPopulation([{ layout: { markers: [] }, originX: 0, originZ: 0 }]).flats, []);
});

test('ARENA-FIX 4: a chained beast - targets nobody, nobody targets it, and the keepers warn a striker', () => {
  let said = 0;
  const tag = chainTag(0, () => said++);
  const beast = { entity: { bout: tag } }, foe = { entity: {} }, fighter = { entity: { bout: { id: 'ex:9', side: 1, out: false, hold: false } } };
  assert.equal(boutGate(beast, foe, false), false);
  assert.equal(boutGate(foe, beast, false), false);
  assert.equal(boutGate(beast, null, true, null), false, 'the player is no target of it');
  assert.equal(boutGate(beast, fighter, false), false);
  const other = { entity: { bout: chainTag(1) } };
  assert.equal(boutGate(beast, other, false), false, 'two chained beasts never fight each other');
  assert.equal(boutGate(other, beast, false), false);
  tag.hooks.intrude();
  assert.equal(said, 1);
  const D = rd('src/scenes/dungeonContext.js');
  assert.match(D, /const _undercroftHall = isArenaUndercroft\(dfLocation\) \? undercroftPopulation\(dungeon\.blocks\) : null;/);
  assert.match(D, /const _hallBeasts = _undercroftHall \? _undercroftHall\.beasts\.map\(/, 'no random foe at any marker - the beasts alone');
  assert.match(D, /: \(_hallBeasts \?\? _layoutEnemies\);/);
  assert.match(D, /const _layoutFoes = foes\.length;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*for \(const f of foes\) \{\n\s*if \(f\.src\?\.arenaChained == null/, 'the chains tagged after the layout\'s run is measured');
  assert.match(D, /for \(let l = 0; l < n && !_undercroftHall; l\+\+\) \{/, 'no rest broken down there');
  assert.match(D, /if \(!_undercroftHall\) markDungeonChampions\(/);
  assert.match(D, /arenaRole: f\.role \?\? null,/);
});

test('ARENA-FIX 4: the stair names the undercroft; the Pit Master and the Keeper of the Hall answer by their office', () => {
  const W = rd('src/scenes/worldModes.js');
  assert.match(W, /if \(entries\[key\]\?\.door\?\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE && entries\[key\]\.dfLocation\?\.arenaUndercroft\) \{\n\s*return staticDoorName\('dungeonEntrance', \{ locationName: ARENA_TEXT\.undercroft\.name, elite: false \}\);/);
  assert.equal(ARENA_TEXT.undercroft.name, 'The Arena Undercroft');
  assert.match(W, /if \(!info && pn\?\.arenaRole === 'pitMaster'\) \{ pitMasterChoice\(\); return; \}/);
  assert.match(W, /if \(!info && pn\?\.arenaRole === 'hallKeeper'\) \{ townTalk\?\.showOverlay\?\.\(new ActionTextBox\(hallOfChampions\(/);
  assert.match(W, /kind: 'pit', gates: false, radius: PIT_RING_R,/);
});

test('ARENA-FIX 4: the Hall of Champions - the stone waits, then a tier champion\'s name, then the Grand Champion\'s', () => {
  const L = newArenaLadder();
  const U = ARENA_TEXT.undercroft;
  assert.deepEqual(hallOfChampions(L, 'Aldo'), [U.hallTitle, '', U.hallIntro, '', U.hallNone]);
  L.champs[0] = true; L.champs[2] = true;
  const two = hallOfChampions(L, 'Aldo');
  assert.deepEqual(two.slice(4), ['Tier 3, Sworn - Aldo, Sworn', 'Tier 1, The Pit - Aldo, Pit Fighter', '', 'Your name is cut here 2 times.']);
  L.champs.fill(true); L.grand = true;
  const all = hallOfChampions(L, 'Aldo');
  assert.equal(all[4], 'Grand Champion of the Arena of Daggerfall - Aldo');
  assert.equal(all.filter((l) => / - Aldo, /.test(l)).length, 9, 'the nine tiers under the Grand Champion\'s line');
});

test('ARENA-FIX 4: the practice bout - a sparring fighter of my tier, no purse, no ladder step, no crowd, no music, its own words', async () => {
  const L = newArenaLadder(); L.tier = 2;
  const next = practiceBout(L);
  assert.equal(next.practice, true);
  assert.equal(next.purse, 0);
  assert.deepEqual(next.opponents, [LADDER_TIERS[2].bouts[0][0]]);
  let t = 1000;
  const log = { say: [], notice: [], pay: [], cues: [], beds: 0, hud: [] };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: L };
  const foes = [];
  const A = createArenaBouts({
    now: () => t, rng: () => 0.99, playerEntity: P, say: (l) => log.say.push(l), notice: (ls) => log.notice.push(...ls), pay: (g) => log.pay.push(g), heal: () => {},
    drawHud: (m) => log.hud.push(m), sound: { cue: (l) => log.cues.push(...l), bed: () => log.beds++, stop: () => {} },
    renderer: { createBillboardBatch: () => { throw new Error('no crowd in the pit'); } }, getTexture: async () => null,
  });
  const stage = { kind: 'pit', gates: false, radius: 6, axis: [0, 1], markScale: 0.5, centre: () => [10, 0, 10],
    spawn: async (mobile, feet, o) => { const f = { mobile, feet, entity: { health: 30, maxHealth: 30, bout: o.bout, items: [1] }, ai: { feet: [...feet] } }; foes.push(f); return f; }, remove: () => {}, heightAt: () => null };
  A.setStage(stage);
  A.ask({ where: 'pit', kind: 'practice', next });
  await settle();
  assert.equal(foes.length, 1);
  assert.deepEqual(foes[0].feet, [10, 0, 13], 'its mark along the pit\'s passage (+6 x half), no gate - it stands on it');
  assert.deepEqual(A.ring().radius, 6);
  assert.equal(A.scoreWant(), null, 'no band in the pit');
  for (let i = 0; i < 200 && A.bout()?.phase !== 'fight'; i++) { t += 100; A.frame(0.1, { playerFeet: [10, 0, 7], sheathed: false }); }
  assert.equal(A.bout().kind, 'practice');
  assert.ok(log.say.includes(ARENA_TEXT.undercroft.practiceCall));
  assert.deepEqual(log.cues, [], 'no crowd to hear it');
  assert.equal(log.beds, 0);
  assert.equal(log.hud.at(-1).crowd, null, 'no crowd meter');
  foes[0].entity.health = 1; foes[0].entity.bout.out = true; foes[0].entity.bout.hooks.floor(foes[0]);
  for (let i = 0; i < 200 && A.bout()?.phase !== 'done'; i++) { t += 100; A.frame(0.1, { playerFeet: [10, 0, 7], sheathed: false }); }
  assert.deepEqual(log.pay, [], 'no purse');
  assert.deepEqual(P.arenaLadder, L, 'the ladder untouched');
  assert.ok(log.notice.includes(ARENA_TEXT.undercroft.practiceWon));
});

/** A fake stage whose bodies have real motors on a flat floor (the walk to the marks is theirs). */
function walkingRig() {
  let t = 1000;
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
  const foes = [];
  const log = { say: [] };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder() };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, say: (l) => log.say.push(l), notice: () => {}, heal: () => {}, drawHud: () => {} });
  const stage = { kind: 'floor', centre: () => [0, 0, 0],
    spawn: async (mobile, feet, o) => { const ai = new EnemyAI(col, [feet[0], 0, feet[2]], o.yaw ?? 0, { liveSpeed: 60, height: 1.8, centreOffset: 0.9 }); const f = { mobile, ai, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => null };
  const step = (ms = 50) => { t += ms; for (const f of foes) f.ai.update(ms / 1000, [-6, 0, 0]); A.frame(ms / 1000, { playerFeet: [-6, 0, 0], sheathed: false }); };
  return { A, P, foes, stage, step, log, now: () => t };
}

test('ARENA-FIX 8: the entrance - each fighter stands at its gate, walks to its mark when the Herald cries its name, and the count waits for it there', async () => {
  const r = walkingRig();
  r.A.setStage(r.stage);
  const ex = { hour: 12, seed: 99, tier: 0, beasts: false, opponents: [{ mobile: 138, level: 1 }, { mobile: 139, level: 1 }] };
  r.A.ask({ where: 'floor', kind: 'exhibition', ex });
  await settle();
  assert.deepEqual(r.foes.map((f) => Math.round(f.ai.feet[0])), [-15, 15], 'at the two gates under the tiers');
  r.step(10);
  assert.ok(r.foes.every((f) => !f.ai.walkGoal), 'nobody walks before the Herald names them');
  for (let i = 0; i < 100 && !r.log.say.some((l) => /^From /.test(l)); i++) r.step();
  assert.equal(r.A.bout().phase, 'call', 'still the call');
  assert.ok(r.foes[0].ai.walkGoal || r.foes[0].ai.moving, 'named, the first walks in at once - during the call');
  let walked = false;
  for (let i = 0; i < 400 && r.A.bout().phase !== 'count'; i++) { r.step(); walked ||= r.foes.some((f) => f.ai.moving); }
  assert.ok(walked, 'they walked - their motors moving');
  assert.equal(r.A.bout().phase, 'count');
  assert.ok(r.A.bout().fighters.every((f) => f.atMark), 'the count started because every fighter reached the mark, not the walk\'s limit');
  for (const f of r.foes) assert.ok(Math.abs(Math.abs(f.ai.feet[0]) - 6) <= 0.6 + WALK_ARRIVE_M, `on its mark (${f.ai.feet[0].toFixed(2)})`);
  assert.ok(r.foes.every((f) => !f.ai.walkGoal), 'the walk is over');
  assert.ok(WALK_PACE > 0 && WALK_PACE < 1, 'a walk, not a charge');
  // the motor's own walk: to the point, then stopped there, said
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
  const ai = new EnemyAI(col, [0, 0, 0], 0, { liveSpeed: 60, height: 1.8, centreOffset: 0.9, isHostile: false });   // a held fighter: it walks because it is told, not because it hunts
  ai.walkTo([0, 0, 5], { pace: 0.5 });
  let n = 0;
  for (; n < 400 && !ai.walkArrived; n++) ai.update(0.05, [50, 0, 50]);
  assert.ok(ai.walkArrived, 'arrived');
  assert.ok(Math.hypot(ai.feet[0], ai.feet[2] - 5) <= WALK_ARRIVE_M + 0.05, `at the point (${ai.feet[2].toFixed(2)})`);
  assert.equal(ai.walkGoal, null);
  assert.equal(ai.moving, false);
  const at = ai.feet[2];
  for (let i = 0; i < 20; i++) ai.update(0.05, [50, 0, 50]);
  assert.ok(Math.abs(ai.feet[2] - at) < 0.01, 'and it stays there');
});

test('ARENA-FIX 9/10: the misses and the real crits - every resolution heard, a swing at nothing a miss, the critical-strike roll the crowd\'s crit', async () => {
  const r = walkingRig();
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: { tier: 0, bout: 0, champion: false, grand: false, opponents: [{ mobile: 138, level: 1 }], free: false, beasts: false, purse: 50, label: 'bout 1 of 3', tierName: 'The Pit' } });
  await settle();
  for (let i = 0; i < 600 && r.A.bout()?.phase !== 'fight'; i++) r.step();
  const f = r.foes[0];
  const me = () => r.A.bout().fighters.find((x) => x.id === YOU), them = () => r.A.bout().fighters.find((x) => x.id === 'f0');
  // a miss of mine (the formula answered 0), a swing at the air, a miss of theirs on me
  r.A.attackResolved({ attacker: r.P, target: f.entity, damage: 0, critical: false });
  r.A.playerSwing(0);
  r.A.playerSwing(1);   // a swing that reached them is the formula's to tell
  r.A.attackResolved({ attacker: f.entity, target: r.P, damage: 0 });
  r.A.attackResolved({ attacker: { stranger: true }, target: f.entity, damage: 0 });
  r.A.attackResolved({ attacker: f.entity, target: f.entity, damage: 0 });   // itself: no one's miss
  assert.equal(me().misses, 2);
  assert.equal(them().misses, 1);
  // a real crit, small: the crowd hears it although it is under CRIT_SHARE
  r.A.attackResolved({ attacker: r.P, target: f.entity, damage: 2, critical: true });
  f.entity.health -= 2; f.entity.bout.hooks.hurt(f, 2, { fromPlayer: true });
  assert.equal(me().crits, 1);
  // a big blow the formula says was no crit: none, whatever its share
  r.A.attackResolved({ attacker: r.P, target: f.entity, damage: 20, critical: false });
  f.entity.health -= 20; f.entity.bout.hooks.hurt(f, 20, { fromPlayer: true });
  assert.equal(me().crits, 1);
  // a blow no resolution told (a spell): the share stands in
  f.entity.health -= 15; f.entity.bout.hooks.hurt(f, 15, { fromPlayer: true });
  assert.equal(me().crits, 2, `CRIT_SHARE ${CRIT_SHARE} the fallback`);
  // the formula's door: every resolution, whoever swung
  const heard = [];
  registerAttackResolutionListener('test', (x) => heard.push(x));
  calculateAttackDamage({ isPlayer: false, level: 1, skills: {}, stats: {} }, { level: 1 }, { rolls: () => 0.999 });
  registerAttackResolutionListener('test', null);
  assert.ok(heard.length === 1 && heard[0].damage === 0 && 'critical' in heard[0], 'a foe\'s miss told, with its critical flag');
  const W = rd('src/scenes/world.js'), PW = rd('src/combat/playerWeapon.js');
  assert.match(W, /registerAttackResolutionListener\('arena', \(r\) => arenaBouts\.attackResolved\(r\)\);/);
  assert.match(W, /registerPlayerSwingListener\('arena', \(n\) => arenaBouts\.playerSwing\(n\)\);/);
  assert.match(PW, /for \(const fn of _swingListeners\.values\(\)\) \{ try \{ fn\(results\.length\); \}/);
});

test('ARENA-FIX 11: a light left burning on the old floor is put out and carried - the item picking it up gives', () => {
  assert.deepEqual(droppedLightItem({ position: [0, 0, 0], time: 41, itemTemplateIndex: 247 }).currentCondition, 3);
  assert.equal(droppedLightItem({ time: 41, itemTemplateIndex: 247 }).group, 'UselessItems2');
  assert.equal(droppedLightItem({ time: 5, itemTemplateIndex: 269 }).group, 'ReligiousItems');
  assert.equal(droppedLightItem({ time: 5, itemTemplateIndex: 0 }), null);
  assert.equal(droppedLightItem(null), null);
});

test('ARENA-FIX 13: the court\'s nobles of TEXTURE.185 seated at TEXTURE.183\'s scale - never 6 m tall', () => {
  assert.equal(CROWD_SCALE[185], -128);
  const nobles = CROWD_PEOPLE.nobles.filter(([a]) => a === 185).map(([, r]) => r);
  assert.deepEqual(nobles, [0, 1, 5, 6, 7, 8], 'the lords and ladies - not the guards nor the knight');
  // the driver sizes them by it: the same picture at +128 and at the crowd's scale
  const B = rd('src/scenes/arenaBouts.js');
  assert.match(B, /const size = sizeOf\(tex, g\.record, CROWD_SCALE\[g\.archive\]\);/);
  const h = (px, k) => (px + Math.trunc(px * (k / 256))) * 0.025;
  assert.ok(h(159, 128) > 5.9 && h(159, CROWD_SCALE[185]) <= 2.0);
});

test('ARENA-FIX 14: the player\'s own sprite (Eye of the Beholder) turned with a placing - a door, a warp, a fighter stood on its mark', () => {
  const b = createEotbBody({ count: 0, urlFor: () => '', decode: async () => null, loadLantern: async () => null });
  assert.equal(typeof b.faceYaw, 'function');
  b.tick(0.016, { feet: [0, 0, 0], yaw: 0 });
  b.tick(0.016, { feet: [PLACE_JUMP_M + 1, 0, 0], yaw: Math.PI / 2 });
  assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [1, 0, 0], 'facing the way the view was placed (yaw a quarter turn: +x)');
  b.tick(0.016, { feet: [PLACE_JUMP_M + 1.5, 0, 0], yaw: 0 });
  assert.deepEqual(b.state().lastMoveDirection.map((v) => Math.round(v)), [1, 0, 0], 'a step is no placing - the facing is the walk\'s');
  const S = rd('src/player/eotbBody.js');
  assert.match(S, /Math\.hypot\(state\.feet\[0\] - was\[0\], state\.feet\[2\] - was\[2\]\) > PLACE_JUMP_M\) faceYaw\(/);
  assert.ok(PLACE_JUMP_M >= 6, 'further than a frame of any walk, fall or gallop');
  // the hud model: a quiet bout has no crowd row
  const bout = { phase: 'fight', fighters: [{ id: 'you', name: 'a', side: 0, health: 1, maxHealth: 1 }, { id: 'f0', name: 'b', side: 1, health: 1, maxHealth: 1 }], fightAt: 0, limitMs: 1000 };
  assert.equal(arenaHudModel(bout, null, 0, { you: 'you', quiet: true }).crowd, null);
  assert.ok(arenaHudModel(bout, null, 0, { you: 'you' }).crowd);
});

test('ARENA-FIX 9: a blow between two of one side (a two-against-one\'s pair) is no one\'s miss', async () => {
  const r = walkingRig();
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: { tier: 8, bout: 0, champion: false, grand: false, opponents: [{ mobile: 138, level: 1 }, { mobile: 139, level: 1 }], free: false, beasts: false, purse: 50, label: 'x', tierName: 'Paragon' } });
  await settle();
  for (let i = 0; i < 600 && r.A.bout()?.phase !== 'fight'; i++) r.step();
  const [a, b] = r.foes;
  r.A.attackResolved({ attacker: a.entity, target: b.entity, damage: 0 });
  assert.deepEqual(r.A.bout().fighters.map((f) => f.misses), [0, 0, 0]);
  r.A.attackResolved({ attacker: a.entity, target: r.P, damage: 0 });
  assert.deepEqual(r.A.bout().fighters.map((f) => f.misses), [0, 1, 0]);
});
