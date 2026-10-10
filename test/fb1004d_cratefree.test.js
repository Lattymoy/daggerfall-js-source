// FIELD BUGS 2026-10-04d CRATE-FREE (Discord, 2026-10-04: "Vital quest enemies stuck in dungeon crates. Doing quest for
// knights of the owl and it sent me to a dungeon to kill giants, and there are a few rooms where they are stuck in
// crates"; the screenshot, online in a party: a giant - its bar 'Narve the Greenbiter' - stood INSIDE a wooden crate drawn
// as a solid box, its head over the lid; the tracker on B0B40Y09 "Killing a Giant ... Ruins of Tower Yeomcroft").
//
// A crate is a MODEL (TEXTURE.090's crate faces - systems/searchables.js CRATES; five one-sided faces, no bottom, 0.3 to
// 2.1 m tall), solid in the collider as DFU makes it (RDBLayout.AddModels combines it into the block's mesh collider;
// dungeonContext.js files every placement in its 'dungeon' bucket). The collider's push is facing-blind (centre minus
// the nearest point), so a body whose centre stands inside a closed model is pushed back in by the model's own walls for
// ever; DFU's is not held there (Unity's sweep reads no back face, and its CharacterController depenetrates from what it
// starts in). Two producers stood bodies there: any stand whose point lies in a crate (a layout or quest marker, a save,
// the room's memory) - nothing asked - and SEARCH1-PARTY's spot picker, whose clear line started INSIDE the searched
// object (any object over 0.9 m) so its own skin refused every ring spot, and every foe a search woke stood at the
// unchecked last resort round it: two a player, so a party's sixth in the crate searched. In a Giant Stronghold the
// roster is giants. The real data (ARENA2_PATH, the last four tests): Glenpoint's Ruins of Tower Yeomcroft - a Giant
// Stronghold, B0B40Y09's `remote dungeon13` - lays a random foe's marker inside a 2.1 m crate (41833) in two of its rooms
// (N0000049 and N0000050, object 16070), a Giant at player level 9 (and 6, 11, 15, 17 and up); of every foe and quest
// marker in BLOCKS.BSA those two and N0000048's are the only ones the landing law stands inside a model.
//
// Mounted, not matched: the dungeon's blocks through the real layoutDungeon/layoutRdbBlock, its models through the real
// dfMeshToModel and the collider as dungeonContext.js builds it; the context's own buildFoeAt, spawnLooseFoe,
// spawnQuestFoe, searchFoeSpots and patchFoe and worldModes.js's own dungeon and interior quest adapters sliced out of
// the source (test/disc28_flyer.test.js's harness) over the real EnemyAI; B0B40Y09's own lines through the real Place,
// Foe, PlaceFoe and sceneMount walk; the pool the interiors and the open world stand through the real createExteriorFoes.
// The block and model BYTES are fixtures shaped as BlocksFile and Arch3dFile mint them; with ARENA2_PATH, the game's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { Collider } from '../src/player/collider.js';
import { floorLanding } from '../src/player/enterExit.js';
import { worldAabb } from '../src/player/activate.js';
import { dfMeshToModel, GLOBAL_SCALE } from '../src/world/meshReader.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { layoutRdbBlock } from '../src/world/rdbLayout.js';
import { layoutInterior } from '../src/world/interiorLayout.js';
import { trs, multiply } from '../src/world/mat4.js';
import { RDB_RESOURCE_TYPES, BlocksFile, BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { ClassFile } from '../src/formats/classFile.js';
import { collectDungeonEnemies } from '../src/characters/dungeonEnemies.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { setPref } from '../src/systems/uiPrefs.js';   // BAL4: the switch this file's pins assumed
import { tickTactics, resetTactics } from '../src/ai/tactics.js';   // AUDIT BAL: the brain's clock, ticked as the hosts tick it

import { EnemyAI } from '../src/characters/enemyMotor.js';
import { enemyControllerHeight, flyerStandFeet, keepRebuiltSpawn } from '../src/characters/enemyAnchor.js';
import { lodgedIn, freeLodgedFeet, clearPast, bodyFits, FREE_RINGS } from '../src/characters/foeSpacing.js';
import { searchableKind, SEARCH_FOE_SPACING, SEARCH_DOOR_REACH_M, SEARCH_FOES_PER_PLAYER } from '../src/systems/searchables.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { Place, SITE_TYPES } from '../src/systems/quest/place.js';
import { Foe } from '../src/systems/quest/foe.js';
import { PlaceFoe } from '../src/systems/quest/actions.js';
import { addQuestResourceObjects, markerScenePosition, siteMarkerSpots, standSpot, MARKER_FLOOR_REACH } from '../src/systems/quest/sceneMount.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { effectiveLevel } from '../src/systems/mentorMode.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// ── the models, as Arch3dFile.getMesh hands them and dfMeshToModel builds them ──────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A box's six faces in scene metres, each `{ n, q }`: the side it is drawn on (`out` a prop's, else a room's - seen
 *  from inside) and its corners wound counter-clockwise as seen from that side. */
function boxFaces([x0, y0, z0], [x1, y1, z1], out = true) {
  const s = out ? 1 : -1;
  const faces = [
    [[s, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
    [[-s, 0, 0], [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]],
    [[0, s, 0], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]],
    [[0, -s, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
    [[0, 0, s], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    [[0, 0, -s], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]],
  ];
  return faces.map(([n, q]) => ({ n, q: dot(cross(sub(q[1], q[0]), sub(q[2], q[0])), n) > 0 ? q : [q[0], q[3], q[2], q[1]] }));
}
/** A crate's faces as ARCH3D keeps them: the box's five, no bottom (41815 to 41834, ten triangles each). */
const crateFaces = (lo, hi) => boxFaces(lo, hi).filter((f) => f.n[1] !== -1);
/** The faces as the file stores them: Y down, classic units, the normal it looks along; each plane a fan from its first
 *  point (dfMeshToModel's [shared, vc + 1, vc]), so the scene's counter-clockwise quad is stored q0, q3, q2, q1. */
function dfMesh(faces, textureArchive = 90) {
  const planes = faces.map(({ n, q }) => ({
    points: [q[0], q[3], q[2], q[1]].map((p) => ({ x: p[0] / GLOBAL_SCALE, y: -p[1] / GLOBAL_SCALE, z: p[2] / GLOBAL_SCALE, nx: n[0], ny: -n[1], nz: n[2], u: 0, v: 0 })),
  }));
  return { totalVertices: planes.length * 4, totalTriangles: planes.length * 2, subMeshes: [{ textureArchive, textureRecord: 3, totalTriangles: planes.length * 2, planes }] };
}
const model = (faces, archive) => dfMeshToModel(dfMesh(faces, archive), () => ({ width: 64, height: 64 }));
const CRATE = 41815;   // TEXTURE.090's crate faces (systems/searchables.js CRATES)
const ROOM = 1001;
const CRATE_HALF = 0.6, CRATE_H = 1.2;   // a crate a metre and a fifth each way, its origin at its centre (as ARCH3D centres a model)
const MODELS = new Map([
  [CRATE, model(crateFaces([-CRATE_HALF, -CRATE_H / 2, -CRATE_HALF], [CRATE_HALF, CRATE_H / 2, CRATE_HALF]), 90)],
  [ROOM, model(boxFaces([-6.4, 0, -6.4], [6.4, 4, 6.4], false), 19)],   // a room 12.8 m square and 4 high, drawn from inside
]);

// ── the block, as BlocksFile mints an RDB record (positions in classic units, Y down) ───────────────────────────────
const C = (m) => Math.round(m / GLOBAL_SCALE);
const modelObj = (position, modelIndex, [x, y, z]) => ({
  position, xPos: C(x), yPos: -C(y), zPos: C(z), type: RDB_RESOURCE_TYPES.Model,
  resources: { modelResource: { modelIndex, xRotation: 0, yRotation: 0, zRotation: 0, soundIndex: 0, triggerFlagStartingLock: 0, actionResource: { flags: 0, duration: 0, magnitude: 0, axis: 0, nextObjectOffset: -1, previousObjectOffset: -1 } } },
});
const flatObj = (position, record, [x, y, z], { mobile = 0, flags = 0, archive = 199 } = {}) => ({
  position, xPos: C(x), yPos: -C(y), zPos: C(z), type: RDB_RESOURCE_TYPES.Flat,
  resources: { flatResource: { textureArchive: archive, textureRecord: record, flags, magnitude: 0, soundIndex: 0, factionOrMobileId: mobile, nextObjectOffset: -1, action: 0, position } },
});
// The room's centre is (25.6, 25.6); its floor y 0. Crates: A at the centre with B (+x) and C (+z) hard against it - a
// stack of stores; D in the north-east corner, against both walls.
const AT = { A: [25.6, 25.6], B: [26.8, 25.6], C: [25.6, 26.8], D: [31.4, 31.4] };
const GIANT = 16, BARBARIAN = 143, GIANT_BAT = 3;
const BLOCK_NAME = 'W0000013.RDB', BLOCK_POSITION = 9000;
const BLOCK = {
  position: BLOCK_POSITION,
  rdbBlock: {
    modelReferenceList: [{ modelIdNum: ROOM, description: '' }, { modelIdNum: CRATE, description: '' }],
    objectRootList: [{
      rdbObjects: [
        modelObj(100, 0, [25.6, 0, 25.6]),
        ...Object.entries(AT).map(([, [x, z]], i) => modelObj(200 + i * 10, 1, [x, CRATE_H / 2, z])),
        flatObj(400, 10, [25.6, 0.9, 20.4]),   // the start marker, clear of the stores
        flatObj(410, 16, [25.65, 0.6, 25.62], { mobile: GIANT }),   // a fixed Giant, its marker inside crate A
        flatObj(420, 16, [26.85, 0.6, 25.58], { mobile: BARBARIAN }),   // a fixed Barbarian (a class foe), inside crate B
        flatObj(430, 11, [31.4, 0.6, 31.4]),   // the quest's spawn marker, inside crate D in the corner
      ],
    }, { rdbObjects: null }],
  },
};
const LOCATION = {
  loaded: true, name: 'Ruins of Tower Yeomcroft', regionName: 'Wrothgarian Mountains', regionIndex: 0, locationIndex: 0, hasDungeon: true,
  climate: { worldClimate: 226 }, mapTableData: { mapId: 4242, dungeonType: 13, locationType: 10 },
  exterior: { exteriorData: { locationId: 77 } },
  dungeon: { recordElement: { header: { locationId: 78 } }, blocks: [{ blockName: BLOCK_NAME, x: 0, z: 0, isStartingBlock: true }] },
};
const blocksFile = { getBlockIndex: (n) => (n === BLOCK_NAME ? 0 : -1), getBlock: () => BLOCK };
const LAID = layoutDungeon(LOCATION, blocksFile, (id) => MODELS.get(id));
/** The level's collider as dungeonContext.js builds it: every placement's triangles in the 'dungeon' bucket under its
 *  block's origin. `extra` adds models of the test's own (a second room, more stores) the same way. */
function levelCollider(extra = []) {
  const c = new Collider(() => -Infinity);
  for (const b of LAID.blocks) {
    const origin = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) { const cpu = MODELS.get(p.modelIdNum); c.addMesh('dungeon', cpu.positions, cpu.indices, multiply(origin, p.matrix)); }
  }
  for (const [cpu, matrix] of extra) c.addMesh('dungeon', cpu.positions, cpu.indices, matrix);
  return c;
}
const crateMatrix = ([x, z]) => trs(x, CRATE_H / 2, z, 0, 0, 0);
const inCrate = (feet, [x, z]) => Math.abs(feet[0] - x) < CRATE_HALF && Math.abs(feet[2] - z) < CRATE_HALF && feet[1] < CRATE_H;
const inAnyCrate = (feet) => Object.values(AT).some((at) => inCrate(feet, at));

// BAL4 (bible/05-Combat/Balance-Arc.md section 6): the Enhanced AI ships On now; this file's pins are the classic motor's
// restore and walk, so it says Off outright where it used to read the default (LR5's trap: a pin that leaned on a default
// moves with it) - and AUDIT BAL's restore pin walks the freed giant again with the brain ON, its clock
// (ai/tacticsClock.js, the foes' own time) ticked with the foes' step as every host ticks it
setPref('enhancedAI', false);

// ── the dungeon context's own doors, mounted (test/disc28_flyer.test.js's harness) ──────────────────────────────────
function sliced(path) {
  const S = rd(path);
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const find = (pred) => {
    let hit = null;
    (function walk(n) {
      if (!n || typeof n.type !== 'string' || hit) return;
      if (pred(n)) { hit = n; return; }
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(AST);
    return hit;
  };
  return {
    fnSrc: (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `${path} has function ${name}`); return S.slice(n.start, n.end); },
    declSrc: (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `${path} declares ${name}`); return S.slice(n.start, n.end); },
  };
}
const DC = sliced('src/scenes/dungeonContext.js');
const WM = sliced('src/scenes/worldModes.js');
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : k === 'effectiveLevel' ? effectiveLevel : k === 'applyProgressionScalingTo' ? () => {} : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
/** CLASS15.CFG (the Barbarian), as test/fb0930b_fallhold.test.js crafts a career. */
function classCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
/** The context over `collider`: its real buildFoeAt (both arms, the real EnemyAI and floor landing), spawnLooseFoe,
 *  spawnQuestFoe, searchFoeSpots and patchFoe; the art answers idle sprites `idleH` tall (a giant's), `batH` for a bat. */
function context(collider, { idleH = 3.2, batH = 1, playerFeet = [25.6, 0, 22.4] } = {}) {
  const foes = [], bound = [];
  const state = {
    ENEMY_BASICS, collider, foes, flyerStandFeet, enemyControllerHeight, keepRebuiltSpawn, freeLodgedFeet, clearPast, floorLanding,
    SEARCH_FOE_SPACING, SEARCH_DOOR_REACH_M, lastPlayerFeet: playerFeet, actions: { objects: new Map() }, objectAabb: () => null,
    MobileUnit: class { static resolveGender(g) { return g === 'female' ? 'female' : 'male'; } },
    idleSpriteHeight: (t) => t.idleH,
    getTexture: async (archive) => ({ idleH: archive === ENEMY_BASICS[GIANT_BAT].maleTexture ? batH : idleH, getFrameCount: () => 1 }),
    foeDeps: {
      EnemyAI, EnhancedEnemyAI: EnemyAI, EnemyAttack: class {}, floorLanding, ClassFile,
      loadMonsterCareer: async () => ({}), fetchBytes: async (n) => { if (/^CLASS\d\d\.CFG$/.test(n)) return classCfg(); throw new Error(`no ${n}`); },
      makeEnemyEntity: () => ({ items: [], health: 10, maxHealth: 10 }),
      playerEntity: { level: 1, reflexes: 2 }, hasMagickaToCast: () => false,
    },
    getPref: () => false, enhancedNav: { chf: null, world: null }, liveStat: () => 70, waterSurfaceYAt: () => null,
    isActionDoor: () => false, hasBowAttack: () => false, applyEliteScaling: () => {}, spawnEnemyLoot: () => {}, eliteLootOpts: () => ({}),
    applySpawnAlliance: () => {}, grantEliteLoot: () => {}, asCandidate: (rec) => rec, assignFoeSpells: () => {}, registerFoeDoor: () => {},
    damageFoe: () => {}, canStandFoe: () => true, _layoutStood: false, _ctxDead: false, _lootSeen: new Set(), _lootAt: new Map(), flatGroups: new Map(),
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} }, dropCandidate: () => {}, freeCorpse: () => {},
    bindQuestFoeHost: (f, behaviour) => { bound.push({ f, behaviour }); }, questPoolOps: {},
    console: { error: (...a) => assert.fail(a.join(' ')), warn: () => {}, log: () => {} },
  };
  const doors = mount(`
    ${DC.fnSrc('buildFoeAt')}
    ${DC.fnSrc('spawnLooseFoe')}
    ${DC.fnSrc('spawnQuestFoe')}
    ${DC.fnSrc('searchFoeSpots')}
    ${DC.fnSrc('patchFoe')}
    return { buildFoeAt, spawnLooseFoe, spawnQuestFoe, searchFoeSpots, patchFoe };
  `, state);
  return { ...doors, foes, bound, state };
}
/** The real motor chasing `target`: how far the body got from where it stood. */
function walk(ai, target, secs = 6) {
  const from = [...ai.feet];
  for (let k = 0; k < secs * 60; k++) ai.update(1 / 60, target);
  return Math.hypot(ai.feet[0] - from[0], ai.feet[2] - from[2]);
}

// ── the fixture is what the producers make ───────────────────────────────────────────────────────────────────────────
test('CRATE-FREE fixture: the crate is a searchable crate model, drawn from outside; the room is drawn from inside; the markers stand inside the crates', () => {
  assert.equal(searchableKind(CRATE), 'crate', 'TEXTURE.090\'s crate (systems/searchables.js)');
  for (const [id, cpu] of MODELS) {
    // the file's own facing (DISC22-G) and the winding the collider reads (REST II F4) agree on every triangle
    for (let i = 0; i < cpu.indices.length; i += 3) {
      const v = (k) => [cpu.positions[cpu.indices[i + k] * 3], cpu.positions[cpu.indices[i + k] * 3 + 1], cpu.positions[cpu.indices[i + k] * 3 + 2]];
      const n = [cpu.normals[cpu.indices[i] * 3], cpu.normals[cpu.indices[i] * 3 + 1], cpu.normals[cpu.indices[i] * 3 + 2]];
      assert.ok(dot(cross(sub(v(1), v(0)), sub(v(2), v(0))), n) > 0, `model ${id} triangle ${i / 3}: its winding faces the way the file says`);
    }
  }
  const c = levelCollider();
  assert.equal(c.raycastHit([25.6, 0.5, 25.6], [0, 1, 0], 4).back, true, 'inside crate A the lid is met from behind');
  assert.equal(c.raycastHit([22, 0.5, 22], [0, 1, 0], 6).back, false, 'in the room the ceiling looks down at you');
  const markers = LAID.blocks[0].layout.markers;
  assert.deepEqual(markers.map((m) => m.record), [10, 16, 16, 11]);
  for (const m of markers.slice(1)) assert.ok(inAnyCrate([m.x, 0, m.z]), `marker ${m.record}@${m.position} stands inside a crate`);
});

test('CRATE-FREE root cause: the landing law stands a marker inside a crate on the floor INSIDE it, and the facing-blind collider holds the real motor there', () => {
  const c = levelCollider();
  const [, giant] = LAID.blocks[0].layout.markers;
  const feet = floorLanding(c, [giant.x, giant.y + 0.2, giant.z]);   // buildFoeAt's walker landing, verbatim
  assert.ok(inCrate(feet, AT.A) && Math.abs(feet[1]) < 1e-6, `landed on the floor inside crate A: ${feet}`);
  assert.equal(lodgedIn(c, feet), true, 'a giant there is lodged in the crate');
  const ai = new EnemyAI(c, feet, 0, { liveSpeed: 70, height: 3.2, centreOffset: 1.6 });
  assert.ok(walk(ai, [22, 0, 22]) < CRATE_HALF, 'chasing the player across the room it never leaves the crate (head over the lid, the screenshot)');
  assert.ok(inCrate(ai.feet, AT.A));
});

// ── the dungeon host: every stand through the one build door ────────────────────────────────────────────────────────
test('CRATE-FREE dungeon layout: a fixed Giant whose marker is inside a crate is stood beside it on its floor, and walks; a class foe the same (mutants: either arm\'s free; the lodged law\'s lid and walls)', async () => {
  const c = levelCollider();
  const ctx = context(c);
  const enemies = collectDungeonEnemies(LAID.blocks.map((b) => ({ markers: b.layout.markers, waterLevel: b.layout.waterLevel, originX: b.originX, originZ: b.originZ })), { locationId: 78, dungeonType: 13, playerLevel: 1 });
  assert.deepEqual(enemies.map((e) => e.mobileType), [GIANT, BARBARIAN], 'the layout\'s own fixed foes');
  const giant = await ctx.buildFoeAt(enemies[0]);
  const barbarian = await ctx.buildFoeAt(enemies[1]);
  for (const [name, rec] of [['the giant', giant], ['the barbarian', barbarian]]) {
    assert.ok(rec?.ai, `${name} stood`);
    assert.ok(!inAnyCrate(rec.ai.feet), `${name} stands in no crate: ${rec.ai.feet.map((v) => v.toFixed(2))}`);
    assert.equal(lodgedIn(c, rec.ai.feet), false, `${name} is lodged in nothing`);
    assert.ok(Math.abs(rec.ai.feet[1]) < 1e-6, `${name} on the room's floor`);
    assert.ok(Math.hypot(rec.ai.feet[0] - rec.src.x, rec.ai.feet[2] - rec.src.z) <= FREE_RINGS[FREE_RINGS.length - 1] + 1e-9, `${name} near its marker`);
  }
  assert.ok(walk(giant.ai, [22, 0, 22]) > 2, 'the real motor carries the giant off after the player');
});

test('CRATE-FREE dungeon layout: a stand that is not inside a model is left exactly where DFU stands it; a puppet keeps its owner\'s feet (mutant: the puppet gate)', async () => {
  const c = levelCollider();
  const ctx = context(c);
  const open = await ctx.buildFoeAt({ mobileType: GIANT, gender: 'male', x: 22.3, y: 0.6, z: 22.7, spawnDistanceType: 0 });
  assert.deepEqual(open.ai.feet, floorLanding(c, [22.3, 0.8, 22.7]), 'in the open room: the landing law\'s own feet, untouched');
  const owned = [25.62, 0, 25.61];   // another client's giant, posed by its owner where its owner's build stood it
  const puppet = await ctx.buildFoeAt({ mobileType: GIANT, gender: 'male', x: owned[0], y: owned[1], z: owned[2], spawnDistanceType: 0 }, false, { puppet: true, feetGiven: true });
  assert.ok(inCrate(puppet.ai.feet, AT.A), 'a puppet is its owner\'s - this client moves nothing it does not run');
});

test('CRATE-FREE dungeon layout: a flyer inside a crate is freed at its own height (mutant: the monster arm\'s airborne)', async () => {
  const c = levelCollider();
  const ctx = context(c, { batH: 1 });
  // a Giant Bat whose marker is a metre up inside crate C: it hangs on it (flyerStandFeet), its feet half a metre up
  const bat = await ctx.buildFoeAt({ mobileType: GIANT_BAT, gender: 'male', x: 25.62, y: 1, z: 26.79, spawnDistanceType: 0 });
  assert.equal(ENEMY_BASICS[GIANT_BAT].behaviour, 'Flying');
  assert.ok(!inAnyCrate(bat.ai.feet), `out of the crate: ${bat.ai.feet.map((v) => v.toFixed(2))}`);
  assert.ok(Math.abs(bat.ai.feet[1] - 0.5) < 1e-6, 'and still on the wing where it hung - not dropped to the floor as a walker');
});

test('CRATE-FREE quest foe: B0B40Y09\'s own `place foe _monster_ at _dungeon_` stands its Giant at the quest marker in the corner crate - and the dungeon adapter\'s stand frees it (mutant: the monster arm\'s free)', async () => {
  const SCRIPT = rd('vendor/dfu-quests/Quests/B0B40Y09.txt').split(/\r?\n/).map((l) => l.trim());
  const line = (head) => { const found = SCRIPT.filter((l) => l.startsWith(head)); assert.equal(found.length, 1, `one line begins "${head}"`); return found[0]; };
  const WORLD = {
    currentRegionIndex: () => 0,
    maps: { regionCount: 1, getRegion: () => ({ locationCount: 1, mapTable: [LOCATION.mapTableData] }), getLocation: () => LOCATION },
    getBlock: (name) => (name === BLOCK_NAME ? BLOCK : null),
  };
  const quest = {
    uid: 940, rolls: () => 0, resources: new Map(), hooks: { world: WORLD, hasSiteLink: () => true },
    getResource(s) { return this.resources.get(s?.name) ?? null; },
    getPlace(s) { const r = this.getResource(s); return r?.isPlace ? r : null; },
    getFoe(s) { const r = this.getResource(s); return r?.isFoe ? r : null; },
  };
  const declare = (Ctor, src) => { const r = new Ctor(quest, src); quest.resources.set(r.symbol.name, r); return r; };
  const place = declare(Place, line('Place _dungeon_ '));
  const foe = declare(Foe, line('Foe _monster_ '));
  new PlaceFoe(null).createNew(line('place foe _monster_ '), quest).update();
  assert.equal(place.siteDetails.siteType, SITE_TYPES.Dungeon);
  assert.equal(foe.foeType, GIANT, 'the quest\'s Giant');
  const marker = place.siteDetails.selectedMarker;
  assert.deepEqual(marker.targetResources.map((s) => s.name), [foe.symbol.name], 'the Giant on the selected marker');
  const at = markerScenePosition(marker);
  assert.ok(inCrate([at.x, 0, at.z], AT.D), 'the quest marker the data gives is inside the corner crate');
  // worldModes.js's own dungeon adapter, over this context's spawnQuestFoe
  const c = levelCollider();
  const ctx = context(c);
  const adapterState = { dungeonCtx: { spawnQuestFoe: ctx.spawnQuestFoe }, dungeonFoeStands: [], dungeonQuestFlats: [], questSceneCtx: () => ({ mapId: LOCATION.mapTableData.mapId }), _enemyRestoreInProgress: false, console };
  const adapter = mount(`${WM.declSrc('dungeonSceneBehaviours')}\n${WM.declSrc('dungeonQuestAdapter')}\nreturn dungeonQuestAdapter;`, adapterState);
  const machine = {
    getSiteLinks: (siteType, mapId) => (siteType === SITE_TYPES.Dungeon && mapId === LOCATION.mapTableData.mapId ? [{ questUID: quest.uid, placeSymbol: place.symbol }] : []),
    getQuest: (uid) => (uid === quest.uid ? quest : null),
  };
  addQuestResourceObjects(machine, adapter, SITE_TYPES.Dungeon, 0);
  await settle();
  assert.equal(ctx.bound.length, 1, 'one quest giant stood and bound to its behaviour');
  const rec = ctx.bound[0].f;
  assert.equal(rec.mobileType, GIANT);
  assert.ok(!inCrate(rec.ai.feet, AT.D), `the quest giant stands out of the corner crate: ${rec.ai.feet.map((v) => v.toFixed(2))}`);
  assert.equal(lodgedIn(c, rec.ai.feet), false);
  assert.ok(rec.ai.feet[0] < 32 - 0.3 && rec.ai.feet[2] < 32 - 0.3, 'inside the room - never through its walls');
  assert.ok(walk(rec.ai, [22, 0, 22]) > 2, 'and it comes for the player');
});

test('CRATE-FREE SEARCH1: a party\'s search of a crate in the stores stands every foe it wakes round it, on the floor or a crate\'s top - never in one (mutant: the picker\'s line through the skin it starts in)', async () => {
  const c = levelCollider();
  const ctx = context(c, { playerFeet: [25.6, 0, 22.4] });
  const crateA = MODELS.get(CRATE);
  const sb = { kind: 'crate', aabb: worldAabb(crateA.positions, crateMatrix(AT.A)) };
  const want = SEARCH_FOES_PER_PLAYER * 3;   // a party of three, as in the screenshot
  const spots = ctx.searchFoeSpots(sb, want);
  assert.equal(spots.length, want);
  for (const s of spots) {
    const onTop = s.at[1] >= CRATE_H - 1e-6;
    assert.ok(onTop || !inAnyCrate(s.at), `spot ${s.at.map((v) => v.toFixed(2))} is in no crate`);
    // the ring's own spots, each on a floor within 0.9 of the crate's foot, a line clear from the crate's side
    assert.ok(Math.abs(s.at[1] - 0.05) < 1e-6 || onTop, 'on the floor (+0.05) or on a store');
  }
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    assert.ok(Math.hypot(spots[i].at[0] - spots[j].at[0], spots[i].at[2] - spots[j].at[2]) >= SEARCH_FOE_SPACING - 1e-9, 'the ring keeps them apart - none is the last resort\'s heap');
  }
  for (const s of spots) {
    const f = await ctx.spawnLooseFoe(GIANT, s.at, { yawRad: s.yawRad });
    assert.ok(!inAnyCrate(f.ai.feet) || f.ai.feet[1] >= CRATE_H - 1e-6, 'and the giant stood there is in no crate');
    assert.equal(lodgedIn(c, f.ai.feet), false);
  }
});

test('CRATE-FREE SEARCH1: the picker\'s line passes only the skin it starts in - a wall or another crate past it still refuses the spot', () => {
  const c = levelCollider();
  const from = [25.6, 0.9, 25.6];   // the crate's centre at chest height: inside crate A
  assert.equal(clearPast(c, from, [0, 0, -1], 2), true, 'out of crate A on the open side');
  assert.equal(clearPast(c, from, [1, 0, 0], 2), false, 'crate B beyond A\'s skin faces the line');
  assert.equal(clearPast(c, [22, 0.9, 22], [-1, 0, 0], 5), false, 'from the room, its wall faces the line');
  assert.equal(c.raycast(from, [0, 0, -1], 2) < 1, true, 'the old line met A\'s own skin from behind and refused the spot');
});

// ── the restore: a save, or the room's memory, holding a foe inside a crate ───────────────────────────────────────
test('CRATE-FREE dungeon restore: a save that kept a giant inside a crate stands it free on the load; a body keeps the feet it fell on (mutants: patchFoe\'s free; its dead gate)', async () => {
  const c = levelCollider();
  const ctx = context(c);
  const giant = await ctx.buildFoeAt({ mobileType: GIANT, gender: 'male', x: 22.3, y: 0.6, z: 22.7, spawnDistanceType: 0 });
  const saved = { health: 9, items: [], feet: [25.6, 0, 25.6], yaw: 1, dead: false, anchor: 1 };
  ctx.patchFoe(giant, saved);
  assert.ok(!inAnyCrate(giant.ai.feet), `the load freed it: ${giant.ai.feet.map((v) => v.toFixed(2))}`);
  assert.equal(lodgedIn(c, giant.ai.feet), false);
  assert.ok(walk(giant.ai, [22, 0, 22]) > 2, 'and it walks');
  const body = await ctx.buildFoeAt({ mobileType: GIANT, gender: 'male', x: 22.3, y: 0.6, z: 22.7, spawnDistanceType: 0 });
  body.dead = true;
  ctx.patchFoe(body, { ...saved, dead: true, health: 0 });
  assert.deepEqual(body.ai.feet, [25.6, 0, 25.6], 'a body lies where the save says');
  // a Giant Bat the save kept on the wing inside crate C: freed at its own height (mutant: the restore's airborne)
  const bat = await ctx.buildFoeAt({ mobileType: GIANT_BAT, gender: 'male', x: 22.3, y: 1, z: 22.7, spawnDistanceType: 0 });
  ctx.patchFoe(bat, { ...saved, feet: [25.62, 0.5, 26.79] });
  assert.ok(!inAnyCrate(bat.ai.feet) && Math.abs(bat.ai.feet[1] - 0.5) < 1e-6, `the bat out of the crate, still on the wing: ${bat.ai.feet.map((v) => v.toFixed(2))}`);
});

test('CRATE-FREE dungeon restore (AUDIT BAL, the Enhanced AI on - its default since BAL4): the giant a save kept in a crate is freed on the load and walks under the tactics brain, the brain\'s clock ticked with the foes\' step', async () => {
  setPref('enhancedAI', true); resetTactics();
  try {
    const c = levelCollider();
    const ctx = context(c);
    const giant = await ctx.buildFoeAt({ mobileType: GIANT, gender: 'male', x: 22.3, y: 0.6, z: 22.7, spawnDistanceType: 0 });
    ctx.patchFoe(giant, { health: 9, items: [], feet: [25.6, 0, 25.6], yaw: 1, dead: false, anchor: 1 });
    assert.ok(!inAnyCrate(giant.ai.feet), `the load freed it: ${giant.ai.feet.map((v) => v.toFixed(2))}`);
    const from = [...giant.ai.feet];
    for (let k = 0; k < 6 * 60; k++) { tickTactics(1 / 60); giant.ai.update(1 / 60, [22, 0, 22]); }   // a host's frame: the clock, then the foes
    assert.ok(Math.hypot(giant.ai.feet[0] - from[0], giant.ai.feet[2] - from[2]) > 2, 'and it walks');
  } finally { setPref('enhancedAI', false); resetTactics(); }
});

// ── the interior host: a house's crates are models too ─────────────────────────────────────────────────────────────
const stubTex = { getSize: () => ({ width: 64, height: 128 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
/** The pool every other host stands its foes through (exteriorFoes.js createExteriorFoes: worldModes.js's interiors,
 *  exterior.js and world.js), over `collider`. */
function foePool(collider) {
  return createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {}, textures: new Map() },
    collider,
    fetchBytes: async (name) => { if (name === 'MONSTER.BSA') return Uint8Array.from([0, 0, 0x00, 0x01]); throw new Error(`no ${name}`); },   // no records: every career the defaults (test/rogueimp.test.js)
    getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 1000,
    playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
    audio: null, onPlayerHurt: () => {}, rand: () => 0.5, rolls: () => 0.5,
  });
}
/** A house: a room drawn from inside with a crate in it (the interior parents nothing here - its frame is the scene's). */
function houseCollider() {
  const c = new Collider(() => -Infinity);
  const room = MODELS.get(ROOM), crate = MODELS.get(CRATE);
  c.addMesh('interior', room.positions, room.indices, trs(10, 0, 10, 0, 0, 0));
  c.addMesh('interior', crate.positions, crate.indices, trs(12, CRATE_H / 2, 10, 0, 0, 0));
  return c;
}

test('CRATE-FREE interior: a building\'s quest marker inside a house crate - worldModes.js\'s own marker stand through the real pool - stands its foe beside it; a save that kept one there frees it on the load (mutants: the pool\'s free; its puppet gate; its airborne)', async () => {
  // the marker as Place.EnumerateBuildingQuestMarkers reads it off the building's interior flats (Q4 - a 199/11 flat)
  const SCRIPT = rd('vendor/dfu-quests/Quests/N0B30Y15.txt').split(/\r?\n/).map((l) => l.trim());
  const place = new Place({ uid: 1, rolls: () => 0, resources: new Map(), hooks: {} }, SCRIPT.find((l) => l.startsWith('Place _palace_ ')));
  const record = { interior: { blockFlatObjectRecords: [{ xPos: C(12.05), yPos: 0, zPos: C(9.98), textureArchive: 199, textureRecord: 11, factionID: 0, flags: 0 }] } };
  const { questSpawnMarkers } = place._enumerateBuildingQuestMarkers({ rmbBlock: { subRecords: [record] } }, 0);
  const position = markerScenePosition(questSpawnMarkers[0]);
  const c = houseCollider();
  assert.ok(inCrate([position.x, 0, position.z], [12, 10]), 'the marker is inside the crate');
  const pool = foePool(c);
  const stood = [];
  // INTEGRATION (FIELD BUGS 2026-10-04d, PIN MOVED): QUEST-MARKERS' backstop runs in the same stand - the room's
  // collider (the host's own) and the backstop's spots join the scope; the marker has a floor under it, so it stands
  const state = {
    interiorCtx: { parentPt: (x, y, z) => [x, y, z], collider: c }, interiorFoes: { spawnFoe: (...a) => pool.spawnFoe(...a).then((f) => { stood.push(f); return f; }) }, interiorFoeStands: [], console,
    markerScenePosition, siteMarkerSpots, standSpot, MARKER_FLOOR_REACH,
  };
  const adapter = mount(`${WM.declSrc('INTERIOR_MARKER_FEET_LIFT')}\n${WM.declSrc('interiorStandSpots')}\n${WM.declSrc('questAdapter')}\nreturn questAdapter;`, state);
  adapter.standFoe({ foe: { foeType: GIANT }, gender: 'male', position, behaviour: { bindHost() {}, start() {} } });
  await settle();
  assert.equal(stood.length, 1);
  const giant = stood[0];
  assert.ok(!inCrate(giant.ai.feet, [12, 10]), `out of the house crate: ${giant.ai.feet.map((v) => v.toFixed(2))}`);
  assert.equal(lodgedIn(c, giant.ai.feet), false);
  assert.ok(Math.abs(giant.ai.feet[1]) < 1e-6, 'on the house floor');
  // a flyer (the rogue imp's kind) handed its feet a hair over the floor keeps them; a puppet keeps its owner's
  const imp = await pool.spawnFoe(1, [12.02, 0.1, 10.01], { feetGiven: true });
  assert.ok(!inCrate(imp.ai.feet, [12, 10]) && Math.abs(imp.ai.feet[1] - 0.1) < 1e-6, `the imp freed at its own height: ${imp.ai.feet.map((v) => v.toFixed(2))}`);
  const pup = await pool.spawnFoe(GIANT, [12.01, 0, 10.02], { feetGiven: true, puppet: 'peer', seq: 1 });
  assert.ok(inCrate(pup.ai.feet, [12, 10]), 'a puppet stands where its owner says');
  // the load: restoreWorld hands the saved feet to the same door
  const restored = foePool(c);
  restored.restoreWorld([{ mobileType: GIANT, gender: 'male', nativeX: 11.98, nativeZ: 10.03, y: 0, yaw: 0, health: 20, maxHealth: 20 }], (x, z) => [x, z]);
  await settle();
  const back = restored.foes[0];
  assert.ok(back && !inCrate(back.ai.feet, [12, 10]), `a save's giant inside the crate stands free on the load: ${back?.ai.feet.map((v) => v.toFixed(2))}`);
});

// ── the open world's hosts: the same pool over the terrain ─────────────────────────────────────────────────────────
test('CRATE-FREE open world: a foe exterior.js\'s or world.js\'s pool stands inside a boulder on open ground (ROCK-FREE\'s rock - a closed model) is set on the terrain beside it; one in the open is untouched (mutants: the ground as a floor; the pool\'s free)', async () => {
  const GROUND = 2;
  const c = new Collider(() => GROUND);   // the terrain is the collider's analytic ground: no face under the open grass
  const rock = model(boxFaces([-1.2, GROUND - 0.5, -1.2], [1.2, GROUND + 1.9, 1.2]));   // half sunk, as the WoD pebbles stand
  c.addMesh('world', rock.positions, rock.indices, I4);
  const pool = foePool(c);
  const stuck = await pool.spawnFoe(GIANT, [0.1, GROUND, 0.05]);
  assert.ok(Math.max(Math.abs(stuck.ai.feet[0]), Math.abs(stuck.ai.feet[2])) >= 1.2 + 0.3 && Math.abs(stuck.ai.feet[1] - GROUND) < 1e-9, `on the grass beside the rock: ${stuck.ai.feet.map((v) => v.toFixed(2))}`);
  assert.equal(lodgedIn(c, stuck.ai.feet), false);
  const open = await pool.spawnFoe(GIANT, [5, GROUND, 5]);
  assert.deepEqual([open.ai.feet[0], open.ai.feet[2]], [5, 5], 'in the open: where the encounter put it');
});

// ── the law itself ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A room 12.8 m square drawn from inside, at the origin, and `models` of the test's own ([faces, matrix?]). */
function room(models = []) {
  const c = new Collider(() => -Infinity);
  const r = MODELS.get(ROOM);
  c.addMesh('dungeon', r.positions, r.indices, I4);
  for (const [faces, m = I4] of models) { const cpu = model(faces); c.addMesh('dungeon', cpu.positions, cpu.indices, m); }
  return c;
}
const crateAt = (x, z, h = CRATE_H, s = CRATE_HALF, y = 0) => [crateFaces([x - s, y, z - s], [x + s, y + h, z + s])];

test('CRATE-FREE law: lodged is INSIDE a model however tall - a crate over the body\'s head, a store roomier than the body - and not in the room, on a lid, under a table, nor in a crate lower than a knee (mutants: the lid\'s facing and reach; the walls)', () => {
  assert.equal(lodgedIn(room([crateAt(0, 0)]), [0.1, 0, 0.05]), true, 'in a crate');
  assert.equal(lodgedIn(room([crateAt(0, 0)]), [0, 0, 0]), true, 'at a crate\'s very centre');
  assert.ok(room([crateAt(0, 0)]).penetrationAt([0, 0, 0], 3.2) < 0.03, '...where the resolve moves it not at all (the lid presses it onto the floor that holds it): penetrationAt cannot say it');
  // the real data's crate (41833, a 2.1 m cube): its lid over a man's head, its walls hold him all the same - the
  // collider's push is facing-blind, and Unity's sweep reads no back face (DFU's walks out: collider.js ROCK-FREE's law)
  assert.equal(lodgedIn(room([crateAt(0, 0, 2.1, 1.05)]), [0.2, 0, 0.1]), true, 'in a crate taller than the body');
  assert.equal(lodgedIn(room([crateAt(0, 0, 3, 1.5)]), [0, 0, 0]), true, 'in a store roomier than the body, its lid well over its head');
  assert.equal(lodgedIn(room([crateAt(0, 0)]), [3, 0, 0]), false, 'in the room');
  assert.equal(lodgedIn(room([crateAt(0, 0)]), [0, CRATE_H, 0]), false, 'on the lid');
  assert.equal(lodgedIn(room([[boxFaces([-1, 0.8, -0.6], [1, 0.85, 0.6]).filter((f) => f.n[1] !== -1)]]), [0, 0, 0]), false, 'under a table whose top has no underside: open round it');
  assert.equal(lodgedIn(room([crateAt(0, 0, 0.45)]), [0, 0, 0]), false, 'a lid under the knee is one the lower sphere stands on (PH1)');
  assert.equal(lodgedIn(room([[crateFaces([5.4, 0, 5.4], [6.6, CRATE_H, 6.6])]]), [5.9, 0, 5.9]), true, 'a crate in a corner, into both walls: the room\'s walls are met first on two bearings, its own on the other two');
  assert.equal(lodgedIn({}, [0, 0, 0]), false, 'a collider that cannot answer holds nobody');
  assert.equal(bodyFits(room(), [0, 0, 0], 1.8), true, 'a body resting on its floor fits');
});

test('CRATE-FREE law: freed to the nearest spot of its own floor - out of the open side, never through a wall, into the next crate, off the ledge it stands by, nor across into the next room (mutants: the path; the floor\'s band; the candidate\'s own lodging)', () => {
  const H = 3.2;
  const free = (c, feet, opts = {}) => { const f = [...feet]; const moved = freeLodgedFeet(c, f, { height: H, ...opts }); return { f, moved }; };
  // stores: crates at the centre and on three sides, a hand apart - the only way out is the open one (-z)
  const stores = room([crateAt(0, 0), crateAt(1.25, 0), crateAt(-1.25, 0), crateAt(0, 1.25)]);
  let r = free(stores, [0.1, 0, 0.05]);
  assert.ok(r.moved && r.f[2] < -CRATE_HALF && Math.abs(r.f[1]) < 1e-9, `out of the open side, on the floor: ${r.f}`);
  // against the wall (+x at 6.4): never through it
  r = free(room([crateAt(5.7, 0)]), [5.8, 0, 0]);
  assert.ok(r.moved && r.f[0] < 6.4 - 0.3, `stays in the room: ${r.f}`);
  // a crate at the edge of a dais 1.5 m high: the nearest floor a body fits on is the room's, past the edge - the body
  // keeps the dais it stood on, never the floor below it
  const dais = room([[boxFaces([-3, 0, -3], [0.62, 1.5, 3])], crateAt(0, 0, CRATE_H, CRATE_HALF, 1.5)]);
  r = free(dais, [0.05, 1.5, 0.02]);
  assert.ok(r.moved && Math.abs(r.f[1] - 1.5) < 1e-9 && r.f[0] < 0.62, `on the dais, a step from where it stood: ${r.f}`);
  // a giant in a wide, tall store (2.4 m each way - a 1.8 m body fits in it): out of it, never a step further inside it
  r = free(room([crateAt(0, 0, 2.4, 1.2)]), [0.1, 0, 0.05]);
  assert.ok(r.moved && (Math.abs(r.f[0]) >= 1.2 || Math.abs(r.f[2]) >= 1.2), `out of the tall store: ${r.f}`);
  // the real data's crate (41833): out of it, touching its side at most
  r = free(room([crateAt(0, 0, 2.1, 1.05)]), [0.2, 0, 0.1]);
  assert.ok(r.moved && Math.max(Math.abs(r.f[0]), Math.abs(r.f[2])) >= 1.05 + 0.3 && Math.abs(r.f[1]) < 1e-9, `out of the 2.1 m crate: ${r.f}`);
  // two rooms with a void between (the east wall at 6.4, the next room's west wall at 6.8): a crate against the wall,
  // crates round it on the room's side - the nearest free floor across the wall is NOT this room's
  const pen = room([crateAt(5.7, 0), crateAt(4.45, 0), crateAt(5.7, 1.25), crateAt(5.7, -1.25), crateAt(4.45, 1.25), crateAt(4.45, -1.25), [boxFaces([-6.4, 0, -6.4], [6.4, 4, 6.4], false), trs(13.2, 0, 0, 0, 0, 0)]]);
  r = free(pen, [5.75, 0, 0.02]);
  assert.ok(r.f[0] < 6.4, `never across into the next room: ${r.f}`);
  // a flyer keeps its height; nothing within the rings: it stands where it stood
  r = free(room([crateAt(0, 0)]), [0.1, 0.3, 0.05], { airborne: true });
  assert.ok(r.moved && Math.abs(r.f[1] - 0.3) < 1e-9, 'a flyer on the wing');
  const buried = room([[boxFaces([-5, 0, -5], [5, CRATE_H, 5])]]);
  r = free(buried, [0.1, 0, 0.05]);
  assert.deepEqual([r.moved, r.f], [false, [0.1, 0, 0.05]], 'no spot within the rings: as it stood');
  // the same answer every time (every client of a room frees it alike)
  assert.deepEqual(free(stores, [0.1, 0, 0.05]).f, free(stores, [0.1, 0, 0.05]).f);
});

// ── the real data: with ARENA2_PATH, the dungeon of the report and every block of BLOCKS.BSA ──────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - the real dungeon and blocks skipped' : false;
const TALL_CRATE = 41833;   // TEXTURE.090's tallest crate: a 2.1 m cube, five faces
let real = null;
/** MAPS.BSA, BLOCKS.BSA and ARCH3D.BSA as the game loads them; each model through the real dfMeshToModel, once. */
function realData() {
  if (real) return real;
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile();
  blocks.load(bytes('BLOCKS.BSA'));
  const arch = new Arch3dFile();
  arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const getModel = (id) => {
    if (!models.has(id)) { const i = arch.getRecordIndex(id); models.set(id, i < 0 ? null : dfMeshToModel(arch.getMesh(i), () => ({ width: 64, height: 64 }))); }
    return models.get(id);
  };
  real = { maps, blocks, getModel };
  return real;
}
/** Groups of `[placements, origin]` in a collider as dungeonContext.js builds one, and each placement's box. */
function realCollider(groups, getModel, bucket = 'dungeon') {
  const collider = new Collider(() => -Infinity), boxes = [];
  for (const [placements, origin] of groups) {
    for (const p of placements) {
      const cpu = getModel(p.modelIdNum);
      assert.ok(cpu, `model ${p.modelIdNum} is in ARCH3D.BSA`);
      const m = origin ? multiply(origin, p.matrix) : p.matrix;
      collider.addMesh(bucket, cpu.positions, cpu.indices, m);
      boxes.push({ id: p.modelIdNum, action: !!p.action, aabb: worldAabb(cpu.positions, m) });
    }
  }
  return { collider, boxes };
}
/** Feet standing in a model's box - under its top, no deeper below its foot than a body's lower sphere. */
const inBox = (f, { aabb: b }) => f[0] > b.min[0] && f[0] < b.max[0] && f[2] > b.min[2] && f[2] < b.max[2] && f[1] < b.max[1] && f[1] > b.min[1] - 0.6;
/** Glenpoint's Ruins of Tower Yeomcroft, laid out, in its collider. */
function yeomcroft() {
  const { maps, blocks, getModel } = realData();
  const loc = maps.getLocationByName('Glenpoint', 'Ruins of Tower Yeomcroft');
  assert.equal(loc?.mapTableData?.dungeonType, 13, 'a Giant Stronghold - B0B40Y09\'s `remote dungeon13`');
  const laid = layoutDungeon(loc, blocks, getModel);
  return { loc, laid, ...realCollider(laid.blocks.map((b) => [b.layout.placements, trs(b.originX, 0, b.originZ, 0, 0, 0)]), getModel) };
}

test('CRATE-FREE real data: Ruins of Tower Yeomcroft - a random foe\'s marker in two of its rooms stands inside crate 41833 and rolls a Giant; the landing law stood it in the crate for good, the build stands it beside the crate and it walks; its quest markers stand clear (mutants: the monster arm\'s free; the lid\'s reach)', { skip: skipReal }, async () => {
  const { loc, laid, collider, boxes } = yeomcroft();
  const crates = boxes.filter((b) => b.id === TALL_CRATE);
  const enemies = collectDungeonEnemies(laid.blocks.map((b) => ({ markers: b.layout.markers, waterLevel: b.layout.waterLevel, originX: b.originX, originZ: b.originZ })),
    { locationId: loc.dungeon.recordElement.header.locationId, dungeonType: 13, playerLevel: 9 });
  const caged = enemies.filter((e) => crates.some((b) => inBox([e.x, e.y, e.z], b)));
  assert.deepEqual(caged.map((e) => [laid.blocks[e.blockIndex].name, e.fixed, e.mobileType]), [['N0000050.RDB', false, GIANT], ['N0000049.RDB', false, GIANT]], 'a random marker in each of two rooms, a Giant at level 9');
  const ctx = context(collider);
  for (const e of caged) {
    const crate = crates.find((b) => inBox([e.x, e.y, e.z], b));
    const landed = floorLanding(collider, [e.x, e.y + 0.2, e.z]);   // buildFoeAt's walker landing, verbatim
    assert.ok(inBox(landed, crate) && lodgedIn(collider, landed), `landed on the floor inside the crate, lodged: ${landed.map((v) => v.toFixed(2))}`);
    const held = new EnemyAI(collider, [...landed], 0, { liveSpeed: 70, height: 3.2, centreOffset: 1.6 });
    walk(held, [e.x - 6, 0, e.z]);
    assert.ok(inBox(held.feet, crate), 'the real motor never takes it out (its head over the lid, the screenshot)');
    const rec = await ctx.buildFoeAt(e);
    assert.ok(!inBox(rec.ai.feet, crate) && !lodgedIn(collider, rec.ai.feet), `the build stands it out of the crate: ${rec.ai.feet.map((v) => v.toFixed(2))}`);
    assert.ok(Math.abs(rec.ai.feet[1] - landed[1]) < 1e-6, 'on the floor the crate stands on');
    assert.ok(Math.hypot(rec.ai.feet[0] - e.x, rec.ai.feet[2] - e.z) <= FREE_RINGS[FREE_RINGS.length - 1] + 1e-9, 'beside its marker');
    assert.ok(walk(rec.ai, [rec.ai.feet[0] - 6, 0, rec.ai.feet[2]]) > 2, 'and the real motor carries it off');
  }
  const quest = laid.blocks.flatMap((b) => b.layout.markers.filter((m) => (m.archive ?? 199) === 199 && m.record === 11).map((m) => [m.x + b.originX, m.y, m.z + b.originZ]));
  assert.equal(quest.length, 2);
  for (const [x, y, z] of quest) assert.equal(lodgedIn(collider, floorLanding(collider, [x, y + 0.2, z])), false, 'B0B40Y09\'s giant stands at a quest marker in no model');
});

test('CRATE-FREE real data: SEARCH1 at Ruins of Tower Yeomcroft - from inside each of its twelve crates over 0.9 m the old line met the crate\'s own skin first on every bearing; the picker now stands a party\'s six round each of its searchables, none in a crate (mutant: the picker\'s line)', { skip: skipReal }, () => {
  const { collider, boxes } = yeomcroft();
  const searchables = boxes.filter((b) => !b.action && searchableKind(b.id));
  assert.equal(searchables.length, 18);
  const centre = ({ aabb: b }) => [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
  const halfOf = ({ aabb: b }) => Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2;
  const tall = searchables.filter((b) => b.aabb.max[1] - b.aabb.min[1] > 0.9);
  assert.deepEqual([tall.length, tall.every((b) => searchableKind(b.id) === 'crate')], [12, true]);
  for (const b of tall) {
    const c = centre(b), half = halfOf(b);
    for (let k = 0; k < 12; k++) {
      const hit = collider.raycastHit([c[0], c[1] + 0.9, c[2]], [Math.sin(k * Math.PI / 6), 0, Math.cos(k * Math.PI / 6)], half + 1);
      assert.ok(hit?.back === true && hit.dist < half + 0.6, `crate ${b.id}: the first face short of the nearest ring is its own, from behind`);
    }
  }
  const ctx = context(collider);
  for (const b of searchables) {
    // the searcher: on the floor beside it, where a body fits
    const c = centre(b), half = halfOf(b);
    ctx.state.lastPlayerFeet = null;
    for (let k = 0; k < 16 && !ctx.state.lastPlayerFeet; k++) {
      const g = floorLanding(collider, [c[0] + Math.sin(k * Math.PI / 8) * (half + 0.7), c[1] + 1, c[2] + Math.cos(k * Math.PI / 8) * (half + 0.7)]);
      if (g && Math.abs(g[1] - c[1]) < 0.3 && bodyFits(collider, g) && !lodgedIn(collider, g)) ctx.state.lastPlayerFeet = g;
    }
    assert.ok(ctx.state.lastPlayerFeet, `a searcher beside ${b.id}`);
    const spots = ctx.searchFoeSpots({ aabb: b.aabb }, SEARCH_FOES_PER_PLAYER * 3);
    assert.equal(spots.length, SEARCH_FOES_PER_PLAYER * 3);
    for (const s of spots) {
      const stood = floorLanding(collider, [s.at[0], s.at[1] + 0.2, s.at[2]]);   // a walker's landing at the spot
      assert.ok(!lodgedIn(collider, stood) && !searchables.some((o) => inBox(stood, o)), `${b.id}: a spot in a searchable - ${stood.map((v) => v.toFixed(2))}`);
    }
  }
});

test('CRATE-FREE real data: every RDB block of BLOCKS.BSA - of its 2,563 foe and 144 quest markers the landing law stands three inside a model, the random foe at 16070 of N0000048, N0000049 and N0000050, each in crate 41833; the law frees each and touches no other; the player\'s own 177 start and enter markers stand in none', { skip: skipReal }, () => {
  const { blocks, getModel } = realData();
  let rdb = 0, foes = 0, quests = 0, starts = 0;
  const lodged = [];
  const footprint = ({ aabb: b }) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);
  for (let i = 0; i < blocks.count; i++) {
    if (blocks.getBlockType(i) !== BLOCK_TYPES.Rdb) continue;
    rdb++;
    const layout = layoutRdbBlock(blocks.getBlock(i), i, true, getModel);
    const { collider, boxes } = realCollider([[layout.placements, null]], getModel);
    for (const m of layout.markers) {
      if ((m.archive ?? 199) !== 199) continue;
      // AddFixedEnemies' and AddRandomEnemies' markers (a fixed type 99 skipped, as collectDungeonEnemies skips it), and
      // Place's quest spawn markers
      const foe = m.record === 15 || (m.record === 16 && (m.isCustomData || (m.factionOrMobileId & 0xff) !== 99));
      if (!foe && m.record !== 11) continue;
      if (foe) foes++; else quests++;
      const feet = floorLanding(collider, [m.x, m.y + 0.2, m.z]);
      if (!lodgedIn(collider, feet)) continue;
      const holder = boxes.filter((b) => inBox(feet, b)).sort((a, b) => footprint(a) - footprint(b))[0];
      lodged.push(`${blocks.getBlockName(i)} ${foe ? 'foe' : 'quest'}@${m.position} in ${holder?.id}`);
      const freed = [...feet];
      assert.ok(freeLodgedFeet(collider, freed, { height: 3.2 }) && !lodgedIn(collider, freed) && !inBox(freed, holder), `${lodged.at(-1)}: freed out of it - ${freed.map((v) => v.toFixed(2))}`);
    }
    // the player's own stand (dungeonContext.js startSpawn: the start or enter marker, landed from 1.08 m over it)
    for (const m of [...layout.startMarkers, ...layout.enterMarkers]) {
      starts++;
      const feet = floorLanding(collider, [m.x, m.y + 1.08, m.z]);
      if (feet && lodgedIn(collider, feet)) lodged.push(`${blocks.getBlockName(i)} start/enter at ${feet}`);
    }
  }
  assert.deepEqual([rdb, foes, quests, starts], [187, 2563, 144, 177]);
  assert.deepEqual(lodged, ['N0000048.RDB foe@16070 in 41833', 'N0000049.RDB foe@16070 in 41833', 'N0000050.RDB foe@16070 in 41833']);
});

test('CRATE-FREE real data: every building interior of BLOCKS.BSA - none of its 1,905 quest markers stands its foe inside a model, so the interior host\'s free moves no stand the data gives', { skip: skipReal }, () => {
  const { blocks, getModel } = realData();
  const lift = mount(`${WM.declSrc('INTERIOR_MARKER_FEET_LIFT')}\nreturn INTERIOR_MARKER_FEET_LIFT;`, {});   // worldModes.js's marker feet
  let buildings = 0, markers = 0;
  const lodged = [];
  for (let b = 0; b < blocks.count; b++) {
    if (blocks.getBlockType(b) !== BLOCK_TYPES.Rmb) continue;
    const block = blocks.getBlock(b);
    (block.rmbBlock?.subRecords ?? []).forEach((rec, r) => {
      if (!rec?.interior?.header?.num3dObjectRecords) return;
      const lay = layoutInterior(block, b, r, getModel);
      buildings++;
      const quest = lay.markers.filter((m) => m.type === 11);
      if (!quest.length) return;
      const { collider } = realCollider([[lay.placements, null]], getModel, 'interior');
      for (const m of quest) {
        markers++;
        if (lodgedIn(collider, [m.x, m.y + lift, m.z])) lodged.push(`${blocks.getBlockName(b)} building ${r}`);
      }
    });
  }
  assert.deepEqual([buildings, markers, lodged], [6832, 1905, []]);
});
