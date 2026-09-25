// WB3b (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area, a gate
// of oblivion which takes place in a large boss arena"): THE BURNING COURT, DRIVEN. The made level through the port's
// own dungeon layout (world/gateArena.js - a location and a blocks file answering one made block, laid by the real
// layoutDungeon and layoutRdbBlock); the court's geometry (a clear floor facing up, the rune ring the boss keeps
// inside, the lava under it all, the braziers clear of the bridge and after the player's own lights, the way home as
// the level's exit door, the ring the motor keeps a player in); the way home's landing before the gate; the court's art; the client's link to the fight
// (net/gateLink.js - the relay's words folded into one state); and the seams in the dungeon host, the context and the
// world host, by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  gateArenaLocation, gateArenaBlocks, gateArenaBlock, isGateArena, buildCourtModel, courtFloorTris, courtLights, courtBraziers,
  courtExitDoor, withCourtLights, courtRing, courtToDungeon, gateLandingFor, COURT_ARCHIVE, COURT_FLOOR_RECORD, COURT_RUNE_RECORD, COURT_LAVA_RECORD,
  COURT_MEMBRANE_RECORD, COURT_SKY_RECORD, GATE_ARENA_BLOCK, GATE_ARENA_BLOCK_INDEX, GATE_ARENA_LOCATION_ID, GATE_BLOCK_SIDE, ARRIVE_Z, EXIT_Z,
  EXIT_HALF_W, EXIT_H, RUNE_HALF_W, LAVA_Y, LAVA_HALF, COURT_FOG, SKY_R, SKY_TOP, BRAZIER_COLOR, BRAZIER_RANGE, GATE_LANDING_M, COURT_TEXT,
} from '../src/world/gateArena.js';
import { GATE_ARCHIVE } from '../src/world/gateModel.js';
import { doorWorldAabb, doorWorldNormal, doorWorldPosition } from '../src/player/enterExit.js';
import { withPlayerLights } from '../src/scenes/magicCandle.js';
import { courtArt, courtFloorArt, courtLavaArt, courtMembraneArt, courtRuneArt, courtSkyArt, GATE_ART_SIZE } from '../src/world/gateArt.js';
import { COURT_CENTRE, COURT_R, BOSS_REACH_R } from '../src/net/gateBrain.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { RDB_SIDE } from '../src/world/rdbLayout.js';
import { roomKeyFor } from '../src/net/online.js';
import { isWorldRoom, validGateOut } from '../src/net/wire.js';
import { gateYaw, gateRoomKey } from '../src/net/gateLaw.js';
import { createGateLink, foldGate, bossAt, GATE_STATE_EMPTY, GATE_NO_TEXT } from '../src/net/gateLink.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { fellLine } from '../src/systems/gateOmen.js';

const read = (p) => readFileSync(p, 'utf8');
const noModel = () => { throw new Error('the court asks for no model'); };

test('WB3b the made level: the court\'s location and its one block, laid by the port\'s own layoutDungeon - one block at the grid\'s origin, the start marker where the players arrive, no model, no door, no water, no castle; the blocks file answers its one name and passes every other on (mutants: the marker\'s soundIndex or magnitude unset; the made block\'s name missed)', () => {
  const loc = gateArenaLocation({ day: 200, near: 'Copperham', regionIndex: 17, regionName: 'Wrothgarian Mountains' });
  assert.ok(isGateArena(loc));
  assert.equal(loc.gate, 200);
  const laid = layoutDungeon(loc, gateArenaBlocks(null), noModel);
  assert.equal(laid.blocks.length, 1);
  const [b] = laid.blocks;
  assert.equal(b.name, GATE_ARENA_BLOCK);
  assert.deepEqual([b.originX, b.originZ, b.isStartingBlock], [0, 0, true]);
  const [ax, ay, az] = courtToDungeon(0, 0, ARRIVE_Z);
  assert.ok(Math.abs(laid.startMarker.x - ax) < 0.03 && Math.abs(laid.startMarker.z - az) < 0.03 && Math.abs(laid.startMarker.y - ay) < 1e-9, JSON.stringify(laid.startMarker));
  assert.equal(b.layout.placements.length, 0, 'no model');
  assert.equal(b.layout.exitDoors.length, 0, 'no door');
  assert.equal(b.layout.flats.length, 0, 'no flat');
  assert.equal(b.layout.markers.length, 1, 'the start marker alone');
  assert.equal(b.layout.waterLevel, 10000, 'no water');
  assert.equal(b.layout.castleBlock, false, 'no castle');
  const real = { getBlockIndex: (n) => (n === 'N0000001.RDB' ? 7 : -1), getBlock: (i) => (i === 7 ? 'real' : null) };
  const blocks = gateArenaBlocks(real);
  assert.equal(blocks.getBlockIndex(GATE_ARENA_BLOCK), GATE_ARENA_BLOCK_INDEX);
  assert.equal(blocks.getBlockIndex('N0000001.RDB'), 7);
  assert.equal(blocks.getBlock(7), 'real');
  assert.equal(blocks.getBlock(GATE_ARENA_BLOCK_INDEX).name, GATE_ARENA_BLOCK);
  assert.deepEqual(gateArenaBlock().rdbBlock.objectRootList[0].rdbObjects[0].resources.flatResource.soundIndex, 0);
  assert.equal(GATE_BLOCK_SIDE, RDB_SIDE, 'the block\'s side is the layout\'s');
  assert.deepEqual(COURT_CENTRE, [RDB_SIDE / 2, 0, RDB_SIDE / 2], 'the court\'s centre is its block\'s middle - the relay reads poses there');
  assert.equal(isGateArena({ ...loc, gate: undefined }), false);
  assert.equal(isGateArena({ dungeon: { recordElement: { header: { locationId: 5 } } }, gate: 3 }), false, 'a real location is never the court');
  assert.equal(loc.mapTableData.mapId, 0, 'no map id: no dungeon room keys off it');
  assert.equal(isWorldRoom(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: loc.mapTableData.mapId, regionIndex: 17, locationName: loc.name }) ?? ''), false);
  assert.ok(GATE_ARENA_LOCATION_ID > 0xffffff);
});

test('WB3b the court: renderer.createMesh\'s shape; the floor faces up and stands CLEAR - nothing of the court rises from it inside its edge but the way home\'s arch; the rune ring sits on BOSS_REACH_R; the lava lies under it all; the braziers light it, clear of the bridge; the way home is an exit door by the arrival, facing in; the collider\'s floor covers the disc and the motor\'s ring is its edge (mutants: a floor face wound down; a spire stood on the floor; the ring off the boss\'s reach)', () => {
  const m = buildCourtModel();
  const n = m.positions.length / 3;
  assert.equal(m.subMeshes.reduce((s, sm) => s + sm.primitiveCount * 3, 0), n, 'every vertex in a sub-mesh');
  assert.deepEqual([...new Set(m.subMeshes.map((sm) => sm.textureArchive))].sort(), [GATE_ARCHIVE, COURT_ARCHIVE].sort());
  const P = m.positions, N = m.normals;
  const rec = (i) => m.subMeshes.find((sm) => i >= sm.startIndex && i < sm.startIndex + sm.primitiveCount * 3);
  const local = (i) => [P[i * 3] - COURT_CENTRE[0], P[i * 3 + 1] - COURT_CENTRE[1], P[i * 3 + 2] - COURT_CENTRE[2]];
  let floorUp = 0;
  for (let t = 0; t < n; t += 3) {
    const sm = rec(t);
    const vs = [0, 1, 2].map((k) => local(t + k));
    const onFloor = vs.every((v) => Math.abs(v[1]) < 1e-4 && Math.hypot(v[0], v[2]) <= COURT_R + 1e-3);
    if (sm.textureArchive === COURT_ARCHIVE && sm.textureRecord === COURT_FLOOR_RECORD && onFloor) { assert.ok(N[t * 3 + 1] > 0.99, 'a flagstone faces up'); floorUp++; }
    // the clear floor: above it and inside its edge, only the rune ring's hair and the way home
    const isSky = sm.textureArchive === COURT_ARCHIVE && sm.textureRecord === COURT_SKY_RECORD;
    for (const v of vs) {
      if (v[1] <= 0.05 || isSky) continue;   // the sky's shell is no obstacle
      const r = Math.hypot(v[0], v[2]);
      const wayHome = Math.abs(v[0]) <= EXIT_HALF_W + 1.2 && v[2] >= EXIT_Z - 1;
      if (r < COURT_R - 0.5 && !wayHome) assert.fail(`something stands on the floor at ${v.map((x) => x.toFixed(2))} (${sm.textureArchive}/${sm.textureRecord})`);
    }
    if (sm.textureArchive === COURT_ARCHIVE && sm.textureRecord === COURT_RUNE_RECORD) for (const v of vs) {
      const r = Math.hypot(v[0], v[2]);
      assert.ok(r >= BOSS_REACH_R - RUNE_HALF_W - 1e-3 && r <= BOSS_REACH_R + RUNE_HALF_W + 1e-3, `a rune off the ring: ${r}`);
    }
    if (sm.textureArchive === COURT_ARCHIVE && sm.textureRecord === COURT_LAVA_RECORD && vs.every((v) => Math.abs(v[1] - LAVA_Y) < 1e-3)) assert.ok(N[t * 3 + 1] > 0.99, 'the sea of fire faces up');
  }
  assert.ok(floorUp >= 48, `the floor's flagstones: ${floorUp}`);
  assert.ok(LAVA_Y < -20 && LAVA_HALF > 200);
  const tris = courtFloorTris();
  assert.equal(tris.length % 9, 0);
  let area = 0;
  for (let i = 0; i < tris.length; i += 9) {
    const ax = tris[i + 3] - tris[i], az = tris[i + 5] - tris[i + 2], bx = tris[i + 6] - tris[i], bz = tris[i + 8] - tris[i + 2];
    area += Math.abs(ax * bz - az * bx) / 2;
    for (const k of [1, 4, 7]) assert.equal(tris[i + k], COURT_CENTRE[1]);
  }
  assert.ok(Math.abs(area - Math.PI * COURT_R * COURT_R) / (Math.PI * COURT_R * COURT_R) < 0.01, `the collider covers the disc: ${area.toFixed(1)} m²`);
  assert.deepEqual(courtRing(), { centre: [...COURT_CENTRE], radius: COURT_R }, 'the motor\'s ring is the floor\'s edge');
  const lights = courtLights();
  assert.equal(lights.length, courtBraziers().length);
  assert.ok(lights.length >= 4);
  for (const l of lights) {
    assert.deepEqual(l.color, BRAZIER_COLOR); assert.equal(l.range, BRAZIER_RANGE);
    const lz = l.z - COURT_CENTRE[2], lx = l.x - COURT_CENTRE[0];
    assert.ok(Math.hypot(lx, lz) > COURT_R, 'off the floor');
    assert.ok(!(lz > 0 && Math.abs(lx) < 8), 'clear of the bridge');
  }
  const door = courtExitDoor(), box = doorWorldAabb(door);   // the exit family reads it as it reads any exit door
  assert.ok(box.min[2] - COURT_CENTRE[2] > ARRIVE_Z && box.max[1] - box.min[1] >= EXIT_H - 1e-9, 'by the arrival, a body tall');
  assert.ok(box.min[0] - COURT_CENTRE[0] <= -EXIT_HALF_W && box.max[0] - COURT_CENTRE[0] >= EXIT_HALF_W, 'the membrane wide');
  assert.deepEqual(doorWorldPosition(door), courtToDungeon(0, EXIT_H / 2, EXIT_Z));
  assert.deepEqual([door.matrix[12], door.matrix[13], door.matrix[14]], courtToDungeon(0, 0, EXIT_Z), 'the wagon word\'s distance is to the membrane');
  assert.deepEqual(doorWorldNormal(door), [0, 0, -1], 'its face into the court');
  assert.equal(COURT_FOG.mode, 'exp');
  assert.ok(COURT_FOG.color[0] > COURT_FOG.color[1] && COURT_FOG.color[0] > COURT_FOG.color[2], 'the Deadlands\' red');
  // the sky: a shell the fog paints - far enough to be all fog, inside the host's 500 m far plane, facing in
  const sky = m.subMeshes.find((sm) => sm.textureArchive === COURT_ARCHIVE && sm.textureRecord === COURT_SKY_RECORD);
  assert.ok(sky, 'a sky');
  assert.ok(Math.exp(-COURT_FOG.density * SKY_R) < 0.05, 'nine parts in ten fog, and more');
  assert.ok(Math.hypot(SKY_R, SKY_TOP) < 500, 'inside the far plane');
  for (let t = sky.startIndex; t < sky.startIndex + sky.primitiveCount * 3; t += 3) {
    const c = [0, 1, 2].map((k) => local(t + k)).reduce((a, v) => [a[0] + v[0] / 3, a[1] + v[1] / 3, a[2] + v[2] / 3], [0, 0, 0]);
    assert.ok(N[t * 3] * c[0] + N[t * 3 + 1] * (c[1] - 50) + N[t * 3 + 2] * c[2] < 0, 'the shell faces in');
  }
});

test('WB3b the braziers join the frame\'s lights after the player\'s own: the paired shape in and out, the torch keeping its slot and its carried mask (it casts no shadow), the braziers in their own fire\'s colour and none of them carried (mutants: the braziers carried; the torch\'s mask dropped)', () => {
  const base = { data: new Float32Array([5, 1, 5, 8]), colors: new Float32Array([0.8, 0.7, 0.5]) };   // one dungeon light
  const torch = { x: 1, y: 1.4, z: 1, range: 6, color: [1, 0.9, 0.7], carried: true };
  const lit = withPlayerLights(base, torch);
  const out = withCourtLights(lit, courtLights());
  const n = courtLights().length;
  assert.equal(out.data.length, (2 + n) * 4); assert.equal(out.colors.length, (2 + n) * 3);
  assert.deepEqual([...out.data.subarray(0, 8)], [...lit.data], 'the torch and the dungeon\'s light keep their slots');
  assert.deepEqual([...out.colors.subarray(0, 6)], [...lit.colors]);
  assert.equal(out.data.carried, out.carried, 'the mask rides the data, where the renderer lifts it');
  assert.deepEqual([...out.carried], [1, 0, ...Array(n).fill(0)], 'the torch is the hand\'s; no brazier is');
  const l0 = courtLights()[0];
  assert.deepEqual([...out.data.subarray(8, 12)], [l0.x, l0.y, l0.z, l0.range].map(Math.fround));
  assert.deepEqual([...out.colors.subarray(6, 9)], [...BRAZIER_COLOR].map(Math.fround), 'its own fire\'s colour');
  const bare = withCourtLights(base, []);
  assert.deepEqual([...bare.carried], [0], 'a frame with no mask gets an empty one');
});

test('WB3b the way home lands before the gate, on its fire\'s side (the gate\'s own +z turned by its yaw), GATE_LANDING_M off its spot, facing away from it, on the ground there - and nowhere off the built ground (mutants: the landing behind the gate; the spot\'s z read as x)', () => {
  const g = { day: 200, px: 10, py: 20, spot: [400, 300] };
  const t = [1000, 0, 2000];
  const l = gateLandingFor(g, { pixelTranslation: (px, py) => { assert.deepEqual([px, py], [10, 20]); return t; }, heightAt: (x, z) => x * 0 + z * 0 + 7.5 });
  const yaw = gateYaw(200);
  assert.ok(Math.abs(l.pos[0] - (t[0] + 400 + Math.sin(yaw) * GATE_LANDING_M)) < 1e-9);
  assert.ok(Math.abs(l.pos[2] - (t[2] + 300 + Math.cos(yaw) * GATE_LANDING_M)) < 1e-9);
  assert.equal(l.pos[1], 7.5);
  assert.deepEqual(l.normal, [Math.sin(yaw), 0, Math.cos(yaw)]);
  assert.equal(gateLandingFor(g, { pixelTranslation: () => t, heightAt: () => NaN }), null);
  assert.equal(gateLandingFor(null, { pixelTranslation: () => t, heightAt: () => 0 }), null);
});

test('WB3b the court\'s art: 64 square, the same every run, its fire on its emission twin alone - the floor\'s in a few joints, the rune ring\'s in its glyphs, the sea of fire nearly whole, the way home\'s all of it (mutants: every joint burning; the membrane dark)', () => {
  const art = courtArt();
  assert.deepEqual(art.map(([r]) => r), [COURT_FLOOR_RECORD, COURT_RUNE_RECORD, COURT_LAVA_RECORD, COURT_MEMBRANE_RECORD, COURT_SKY_RECORD]);
  assert.deepEqual(courtFloorArt().albedo.colors, courtFloorArt().albedo.colors, 'deterministic');
  const lit = (img) => { let k = 0; for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] + img.colors[i + 1] + img.colors[i + 2] > 0) k++; return k / (img.width * img.height); };
  for (const [, a] of art) { assert.equal(a.albedo.width, GATE_ART_SIZE); assert.equal(a.emission.width, GATE_ART_SIZE); }
  const floor = lit(courtFloorArt().emission), rune = lit(courtRuneArt().emission), lava = lit(courtLavaArt().emission), memb = lit(courtMembraneArt().emission);
  assert.ok(floor > 0 && floor < 0.08, `the floor burns in a few joints: ${floor}`);
  assert.ok(rune > 0.1 && rune < 0.5, `the ring in its glyphs and its edges: ${rune}`);
  assert.ok(lava > 0.6, `the sea of fire nearly whole: ${lava}`);
  assert.equal(memb, 1, 'the way home all of it');
  assert.equal(lit(courtSkyArt().emission), 0, 'nothing of the sky burns - it would glow through the fog');
});

test('WB3b the link: the relay\'s words folded into one state - a whole state starts a fight and nothing else does; a walk, an attack (superseding the one in flight), the health, a phase, the wrath and the kill each move their own; the boss is drawn along his walk between words; a kill is kept by day and said once, a refusal said in words, a receipt kept by the day it names (mutants: a word before the state starting a fight; an attack not superseding; a kill said twice)', async () => {
  const st = validGateOut({ k: 'st', d: 200, b: 'ruhn', ph: 1, h: 900, m: 1000, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 3, fell: null, wrath: null });
  assert.equal(foldGate(GATE_STATE_EMPTY, validGateOut({ k: 'hp', h: 5, m: 10 }), 1), GATE_STATE_EMPTY, 'a word before the state starts nothing');
  let s = foldGate(GATE_STATE_EMPTY, st, 1000);
  assert.deepEqual([s.day, s.boss, s.hp, s.max, s.fighters], [200, 'ruhn', 900, 1000, 3]);
  s = foldGate(s, validGateOut({ k: 'mv', x: 0, z: 0, tx: 0, tz: 10, v: 2, at: 1000 }), 1000);
  assert.deepEqual(bossAt(s, 3000), [0, 4], 'two seconds of his walk');
  assert.deepEqual(bossAt(s, 99999), [0, 10], 'never past its goal');
  s = foldGate(s, validGateOut({ k: 'atk', i: 1, a: 0, at: 5000, x: 0, z: 4, yw: 1, tg: [] }), 3000);
  assert.equal(s.move, null, 'he stops to strike');
  s = foldGate(s, validGateOut({ k: 'atk', i: 2, a: 4, at: 6000, x: 0, z: 4, yw: 1, tg: [] }), 3100);
  assert.equal(s.atk.i, 2, 'the new word supersedes the one in flight');
  s = foldGate(s, validGateOut({ k: 'ph', n: 2, until: 7000 }), 3200);
  assert.deepEqual([s.phase, s.shieldUntil], [2, 7000]);
  s = foldGate(s, validGateOut({ k: 'hp', h: 10, m: 1000 }), 3300);
  s = foldGate(s, validGateOut({ k: 'fell', at: 4000, top: ['Mac'], n: 3, d: 199 }), 3400);
  assert.equal(s.fell, null, 'another day\'s kill is not this fight\'s');
  s = foldGate(s, validGateOut({ k: 'fell', at: 4000, top: ['Mac'], n: 3 }), 3400);
  assert.deepEqual([s.fell.at, s.hp, s.atk], [4000, 0, null]);
  const said = [], fell = [];
  const link = createGateLink({ now: () => 5, say: (t) => said.push(t), onFell: (d, f) => fell.push([d, f.top]) });
  link.word(st);
  link.word(validGateOut({ k: 'no', m: 'the gate is sealed' }));
  assert.deepEqual(said, [GATE_NO_TEXT['the gate is sealed']]);
  link.word(validGateOut({ k: 'fell', at: 4000, top: ['Mac', 'Bran'], n: 2 }));
  link.word(validGateOut({ k: 'fell', at: 4000, top: ['Mac', 'Bran'], n: 2, d: 200 }));
  assert.deepEqual(fell, [[200, ['Mac', 'Bran']]], 'the court\'s word and the hub\'s: one kill, said once');
  assert.equal(link.fellAt(200), 4000); assert.equal(link.fellAt(201), null);
  link.word(validGateOut({ k: 'fell', at: 7000, top: [], n: 1, d: 205 }));
  assert.equal(link.fellAt(205), 7000, 'the hub\'s word of a gate I was nowhere near');
  assert.equal(link.state().day, 200, 'and another day\'s kill moves no court');
  const r = await mintReceipt({ d: 200, b: 'ruhn', s: 'acct-peer-0001', c: 5, x: 'dealt' }, null, { subtle: globalThis.crypto.subtle, nowS: 1_800_000_000 });
  link.word(validGateOut({ k: 'rcpt', r }));
  assert.equal(link.receipt(200), r); assert.equal(link.receipt(199), null);
  link.leave();
  assert.equal(link.state(), GATE_STATE_EMPTY); assert.equal(link.fellAt(200), 4000, 'the falls outlive the court');
  assert.equal(fellLine({ near: 'Copperham', boss: 'Valkynaz Ruhn', top: ['Mac', 'Bran', 'Ysolde'] }), 'Valkynaz Ruhn has fallen at the Oblivion Gate near Copperham - struck down by Mac, Bran and Ysolde. The gate collapses.');
  assert.equal(fellLine({ near: 'X', boss: 'B', top: [] }), 'B has fallen at the Oblivion Gate near X. The gate collapses.');
});

test('WB3b the seams, by source: the dungeon host enters the court through its own transition (the made level whole, its blocks file, the court stood before the marker is read, the way home its exit door and landing before the gate), wears the Deadlands\' air and braziers there, and names its room the gate\'s; the context refuses the map, the rest and the save; the world host opens the door at a relay that runs the room, keys the court\'s room, says the level claim once per welcome, holds the ring, casts a death out before the gate, refuses the mark, and ends the court with its day or with online (mutants: each seam removed)', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /async function enterGateArena\(g\) \{[\s\S]{0,900}return gatedTransition\(\(live\) => dungeonTransition\(hit, \[\], true, live\)\);/);
  assert.match(wm, /const dfLocation = dungeonLocationFor\(hit\.dfLocation, /, 'the court\'s one block passes the sizing law whole');
  assert.match(wm, /dfLocation, hit\.blocksFile \?\? blocks, dfLocation\.climate\.climateType, \{/);
  const stood = wm.indexOf('if (hit.gateArena) standCourt(ctx);'), marker = wm.indexOf('const spawn = ctx.startSpawn({ preferEnterMarker });');
  assert.ok(stood > 0 && stood < marker, 'the court stands before its start marker is read (the spawn lands on its floor)');
  assert.ok(stood < wm.indexOf("ctx.addActivationNamer((key) => (typeof key === 'string' && key.startsWith('exit:') ? staticDoorName('dungeonExit'"), 'and its way home is named before the dungeon exit\'s own namer');
  assert.match(wm, /gate: hit\.gateArena \?\? null,/);
  assert.match(wm, /const returnLanding = \(\) => \(dungeonReturn\.gate \? host\.gateLanding\?\.\(dungeonReturn\.gate\) \?\? null : dungeonEntranceLanding\(/);
  assert.match(wm, /const landing = returnLanding\(\);/);
  assert.match(wm, /if \(isGateArena\(dungeonLoc\)\) applyFog\(renderer, dungeonFog\(!!renderer\.lightingLane, COURT_FOG\)\);/);
  assert.match(wm, /if \(isGateArena\(dungeonLoc\)\) \{ const _court = withCourtLights\(_dgLit, \[\.\.\.courtLights\(\), [^\n]*\]\); renderer\.setPointLights\(_court\.data, null, _court\.colors\); \}/);   // WB4a: the boss's glow joins them
  assert.match(wm, /function standCourt\(ctx\) \{[\s\S]{0,1600}ctx\.exitDoors\.push\(courtExitDoor\(\)\);[^\n]*\n\s*ctx\.addActivationNamer\(\(key\) => \(typeof key === 'string' && key\.startsWith\('exit:'\) \? \{ title: COURT_TEXT\.wayHome \} : null\)\);/, 'the way home is the exit family\'s own door, and named the way home');
  assert.match(wm, /isGateArena\(dungeonLoc\) \? \{ kind: 'gate', day: dungeonLoc\.gate \}/);
  assert.match(wm, /ctx\.collider\.addMesh\(COURT_BUCKET, tris, idx, identity\(\)\);/);
  assert.match(wm, /if \(hit\.gateArena\) cam\.yaw = Math\.PI;/, 'arriving by the bridge, facing him');
  const dc = read('src/scenes/dungeonContext.js');
  for (const [what, re] of [['the map', /toggleAutomap\(\) \{\n\s+if \(activeOverlay\) return;\n\s+if \(isGateArena\(dfLocation\)\) \{ hudText\.add\(COURT_TEXT\.noMap\); return; \}/],
    ['the rest', /toggleRest\(\) \{\n\s+if \(activeOverlay\) return;\n\s+if \(isGateArena\(dfLocation\)\) \{ hudText\.add\(COURT_TEXT\.noRest\); return; \}/],
    ['the save', /if \(isGateArena\(dfLocation\)\) \{ hudText\.add\(COURT_TEXT\.noSave\); return false; \}\n\s+const snap = snapshotPlayer\(/],
    ['the pause\'s save', /savingPrevented: \(\) => isGateArena\(dfLocation\),/]]) assert.match(dc, re, what);
  const w = read('src/scenes/world.js');
  assert.match(w, /ready: \(\) => !!online\?\.gateOk,/);
  assert.match(w, /enter: \(g\) => \{ modes\?\.enterGateArena\?\.\(g\); \},/);
  assert.match(w, /else if \(modes\?\.roomIdentity\?\.\(\)\?\.kind === 'gate'\) key = gateRoomKey\(modes\?\.roomIdentity\?\.\(\)\?\.day\);/);
  assert.match(w, /if \(gateLink && online\.gateOk && isGateRoom\(online\.room\) && online\.welcomes !== _gateInFor && online\.sendGate\(\{ k: 'in', lv: Math\.max\(1, playerEntity\.level \| 0\) \}\)\) _gateInFor = online\.welcomes;/);
  assert.match(w, /online\.onGate = \(g\) => gateLink\?\.word\(g\);/);
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onGate = \(g\) => gateLink\?\.word\(g\);/);
  assert.match(w, /if \(!player\.arena && modes\?\.gateArenaDay\?\.\(\) != null\) player\.arena = courtRing\(\);/, 'the ring in the online frame');
  assert.match(w, /if \(!onlineOn && modes\?\.gateArenaDay\?\.\(\) != null\) ejectFromCourt\(COURT_TEXT\.collapse\);/, 'offline, no court');
  assert.match(w, /if \(courtDay != null && Date\.now\(\) \+ _sharedOffsetMs >= gateTimes\(courtDay\)\.wrathAt \+ GATE_COLLAPSE_MS\) ejectFromCourt\(COURT_TEXT\.collapse\);/);
  assert.match(w, /const courtGate = modes\?\.gateArenaGate\?\.\(\) \?\? null;[\s\S]{0,200}if \(courtGate\) \{\n\s+modes\?\.forceExitToExterior\(\);\n\s+if \(landBeforeGate\(courtGate\)\) \{ townTalk\.showOverlay\(new ActionTextBox\(\[COURT_TEXT\.castOut\]\)\); return; \}/, 'a death in the court is cast out before its gate');
  assert.match(w, /function setRecallAnchor\(\) \{\n\s+if \(modes\?\.gateArenaDay\?\.\(\) != null\) \{ setMidScreenText\(COURT_TEXT\.noMark\); return; \}/);
  assert.match(w, /fellAt: \(day\) => gateLink\?\.fellAt\(day\) \?\? null,/, 'the omen hears the kill');
  assert.equal(gateRoomKey(200), 'gate:200');
  assert.ok(Object.values(COURT_TEXT).every((t) => typeof t === 'string' && t.length > 8));
});
