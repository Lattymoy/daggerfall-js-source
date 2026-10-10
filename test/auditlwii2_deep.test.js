// AUDIT LW-II-2 (the second audit of THE LIVING WORLD II, lane D: LW14, the deep's own) - the fixes' pins: LEAD ON's
// let-go measured from the company (D1); a load lets the deep's layers go, and a body a load cut is no death (D2); the
// street's talk never asks a company left below (D4 / H5); a rival charges only this player's own take (D5); one dive's
// fallen a pace apart (D6); no clear for the Ocean Holes abyss (D7); a road's trouble takes nothing from the deep (D8);
// a fated minute on the way out at the reach's nearest stop (D9); no start marker, the starting block (D10); the stops'
// markers their one home's (D11); no trim after the deep's fight (D13); and the laws the P lane found unpinned (P10) -
// the fight's pick and shift, the way out's rest, the build's set routed from the entry, LEAD ON's arrival slack - and
// the host's steps wrapped. Fixtures from the real producers: the census's trips (test/lwRoads.mjs livingMap with its
// fate, trips.js fallenIn / divesIn), the dungeon's stops (deepRoute.js stopsOf over markers as a layout lays them), the
// Ocean Holes abyss's own host (oceanHolesAbyss.js tryEnterPit), and world.js's own livingDeepCleared lifted whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  stopsOf, routeOf, stopAt, pointAt, clearedOf, stopOfMinute, deepFightOf, STOP_FOE, STOP_TREASURE, DEEP_RISK, DEEP_FIGHT_MIN,
  DEEP_DETOUR, DEEP_WALK_M, DIVE_CLEAR_MIN,
} from '../src/systems/livingWorld/deepRoute.js';
import { createDungeonDivers, DEEP_KEEP_M, DIVER_ARRIVE_SLACK_M, POACHED_LINE } from '../src/scenes/dungeonDivers.js';
import { createDeepRemains, apartOf, DEEP_APART_M } from '../src/scenes/deepRemains.js';
import { createRelations, EVENTS } from '../src/systems/livingWorld/relations.js';
import { divesIn, fallenIn, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { RANDOM_RECORD } from '../src/characters/dungeonEnemies.js';
import { RANDOM_TREASURE_MARKER_RECORD } from '../src/systems/loot.js';
import { RDB_SIDE } from '../src/world/rdbLayout.js';
import { createOceanHolesAbyss } from '../src/scenes/oceanHolesAbyss.js';
import { mapPixelToLongitudeLatitude, mapPixelToWorldCoord, worldCoordToMapPixel } from '../src/formats/mapsFile.js';
import { enemyRoster } from '../src/world/underwaterEnemies.js';
import { livingMap, partiesOver } from './lwRoads.mjs';

const _read = new Map();
const rd = (p) => { if (!_read.has(p)) _read.set(p, readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')); return _read.get(p); };
const tick = () => new Promise((r) => setImmediate(r));

const SIDE = 100;
/** A block of the grid (gx, gz) with markers [record, x, z] - a layout's own marker shape. */
const block = (gx, gz, marks, extra = {}) => ({ originX: gx * SIDE, originZ: gz * SIDE, ...extra, layout: { markers: marks.map(([record, x, z], i) => ({ record, x, y: 0, z, position: 100 + i, loadID: gx * 1000 + gz * 100 + i })) } });
/** A dungeon of four blocks in an L and one apart (lw14_deep's): its stops in a company's order. */
const dungeon = () => [
  block(0, 0, [[10, 50, 50], [STOP_FOE, 60, 50], [STOP_TREASURE, 90, 90], [16, 55, 55]]),
  block(1, 0, [[STOP_FOE, 30, 50], [STOP_TREASURE, 10, 50]]),
  block(0, 1, [[STOP_FOE, 50, 10]]),
  block(2, 0, [[STOP_FOE, 50, 50]]),
  block(5, 5, [[STOP_TREASURE, 50, 50]]),
];
const ENTRY = { x: 50, z: 50 };
const STOPS = stopsOf(dungeon(), SIDE, ENTRY);
/** A dive met inside its dungeon: a fated trouble is one met INSIDE (trouble.js diveTrouble) - no deep fight of its own. */
const calm = (id, t1 = 600) => routeOf(STOPS, ENTRY, { id, enc: { id: `${id}:e`, inside: true }, dive: { t0: 0, t1 } });

/** The census's dives over four months of the synthetic map, troubled as the host troubles them (read once). */
let _parties = null;
const parties = () => {
  if (_parties) return _parties;
  const map = livingMap({ dives: true });
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  _parties = { map, o, trips: partiesOver(map, 300, 420, o) };
  return _parties;
};

/** A divers host over one company on `route`, its pool and its words recorded. `choose` what the talk's window answers
 *  (world.js: the dungeon's showOverlay - true when it mounted; null: no dungeon standing, its `?.` chain's undefined). */
function company({ route, feet = [0, 0, 0], rel = createRelations(), extra = {}, n = 3, choose = true, dies = () => false } = {}) {
  const members = Array.from({ length: n }, (_, i) => ({ id: `L3.t${i + 1}`, name: `Mem${i} Ash`, cls: 140 + i, level: 5 + i, sex: 'male' }));
  const trip = { id: 'L3.t1:9', leader: members[0], party: members, to: { name: 'Ruin' }, backT0: 1e9, dive: { t0: 0, t1: 1e9 } };
  const st = { feet, pool: [], said: [], died: [], slain: [], chose: null, piles: {} };
  const deps = {
    spawn: (type, f) => { const rec = { type, feet: f, dead: false, ai: { feet: [...f] }, entity: { health: 100, maxHealth: 100 } }; st.pool.push(rec); return Promise.resolve(rec); },
    remove: (rec) => { const i = st.pool.indexOf(rec); if (i >= 0) st.pool.splice(i, 1); rec.removed = true; },
    inPool: (rec) => st.pool.includes(rec),
    leader: () => ({ feet: st.feet, yaw: 0 }), spot: (f, dx, dz) => [f[0] + dx, f[1], f[2] + dz], owner: () => true,
    relations: () => rel, turnKeyOf: (res) => res.id, dies, day: () => 0, say: (s) => st.said.push(s),
    route: () => route, floor: (x, y, z) => [x, 0, z], clearLine: () => true,
    choose: (lines, options) => { st.chose = { lines, options }; return choose ?? undefined; },
    died: (res) => st.died.push(res.id), slay: (res) => st.slain.push(res.id), stopPile: (key) => st.piles[key] ?? null,
  };
  const host = createDungeonDivers({ ...deps, ...extra });
  return { host, st, trip, members, rel, go: (t) => host.frame([{ trip, members }], t) };
}
/** The choice the door opened, by its key. */
const pick = (st, code) => st.chose.options.find((o) => o.code === code).action();

/** dungeonContext.js applyLoot's landing of the room's word in a pile, line for line (the source pin below holds it). */
function roomWord(p, list) {
  const held = p.items;
  held.length = 0;
  for (const it of list) held.push(it);
  p.roomWords = (p.roomWords ?? 0) + 1;
}

/** world.js's own livingDeepCleared, lifted whole and run over the given world (the slice tests' way of a host seam). */
function liftedDeepCleared({ ohAbyss = null, map, tBuild, memo = new Map() }) {
  const w = rd('src/scenes/world.js');
  const m = /  const livingDeepCleared = (\(loc, stops, entry\) => \{\n[\s\S]*?\n  \});\n/.exec(w);
  assert.ok(m, 'world.js livingDeepCleared');
  const byId = new Map(map.dungeons.map((d) => [d.mapId, d]));
  return new Function('livingWorldOn', 'params', 'ohAbyss', 'livingDungeonsIndex', '_livingDungeonById', 'skyMinutes', 'divesIn', 'DIVE_CLEAR_MIN', 'livingTripWorld', 'PERSON_MOVE_SPEED', 'livingBaseRate', '_livingTripMemo', 'deepClearedOf', 'deepRouteOf', `return ${m[1]};`)(
    () => true, { has: () => false }, ohAbyss, () => {}, byId, () => tBuild, divesIn, DIVE_CLEAR_MIN, map.world, CALENDAR_MPM, () => 1, memo, clearedOf, routeOf);
}

test('AUDIT LW-II-2 D1: LEAD ON to a stop 140 m away keeps the company beside the player after a frame - left behind is measured from its nearest standing member, never from where it goes; walked away from, it is let go (mutants: the destination, the farthest)', async () => {
  // a start block with an east and a west neighbour, a random foe in each: breadth first S, E, W - E's stop to W's two blocks
  const blk = (gx, x) => ({ originX: gx * RDB_SIDE, originZ: 0, layout: { markers: [{ record: STOP_FOE, x, y: 0, z: 25, position: 1, loadID: 1 }] } });
  const entry = { x: 20, z: 25 };
  const route = routeOf(stopsOf([blk(0, 25), blk(1, 45), blk(-1, 5)], RDB_SIDE, entry), entry, { id: 'L3.t1:9', enc: { inside: true }, dive: { t0: 0, t1: 600 } });
  const atE = route.legs[1];
  const c = company({ route, feet: [atE.stop.x - 3, 0, 25] });
  c.go(atE.tIn + 1);
  await tick();
  assert.deepEqual([c.host.size, c.st.pool.length], [1, 3], 'met at work at the east stop, beside the player');
  c.host.offers({ living: c.st.pool[0].living }, () => {});
  pick(c.st, 'KeyL');
  const going = c.host.companies()[0].going;
  assert.equal(going.stop, route.legs[2].stop, 'on to the west stop');
  assert.ok(Math.hypot(going.feet[0] - c.st.feet[0], going.feet[2] - c.st.feet[2]) > 2 * DEEP_KEEP_M - 5, 'a stop some 140 m off');
  c.go(atE.tIn + 1.02);
  assert.equal(c.host.size, 1, 'kept: the company is beside the player');
  assert.ok(c.st.pool.length === 3 && c.st.pool.every((r) => !r.removed), 'no body taken out');
  // one lagging a long way back: the NEAREST is beside the player
  c.st.pool[2].ai.feet = [atE.stop.x + 100, 0, 25];
  c.go(atE.tIn + 1.04);
  assert.equal(c.host.size, 1, 'the nearest standing member counts');
  // the player walks off past DEEP_KEEP_M from every one of them: let go
  c.st.feet = [atE.stop.x - 3, 0, 25 + DEEP_KEEP_M + 10];
  c.go(atE.tIn + 1.06);
  assert.equal(c.host.size, 0, 'left behind');
});

test('AUDIT LW-II-2 D2: the bodies a load cut (dead and gone from the pool) write no died, no slain, no had-enough and no spared; one cut down in the pool still dies; the remains a clear forgot write no laid; the load door lets both layers go (mutants: each guard, the size, the clear, the door)', async () => {
  const route = calm('L3.t1:9');
  const first = route.legs[0];
  // three stood, every one fated (a wrong "had enough" would spare them all)
  const c = company({ route, feet: [first.stop.x, 0, first.stop.z + 5], dies: () => true });
  c.go(first.tIn + 1);
  await tick();
  assert.deepEqual([c.host.size, c.st.pool.length], [1, 3]);
  // the load's rewind (dungeonContext.js applyWorld): the tail past the save's count marked dead and cut from the pool
  for (const rec of c.st.pool.splice(1, 2)) rec.dead = true;
  c.go(first.tIn + 2);
  assert.deepEqual(c.st.died, [], 'no death written into the loaded game');
  assert.equal(c.host.size, 1, 'and no "had enough" for two that were never cut down');
  assert.ok(!c.st.said.some((s) => /had enough|make for the surface/.test(s)));
  assert.equal(c.rel.turns().spared.size, 0, 'none spared');
  assert.ok(c.members.every((m) => c.rel.regard(m.id, 0) === 0), 'no regard paid');
  // ...one cut down where it stands, in the pool, still dies at the player's side
  c.st.pool[0].dead = true;
  c.go(first.tIn + 3);
  assert.deepEqual(c.st.died, [c.members[0].id], 'a death in the pool is a death');
  // a hostile one, cut by the load: no slaying
  const h = company({ route, feet: [first.stop.x, 0, first.stop.z + 5], extra: { spawnFoe: (type, f) => { const rec = { type, feet: f, dead: false, ai: { feet: [...f] }, entity: {} }; h.st.pool.push(rec); return Promise.resolve(rec); } } });
  while (h.rel.standing(h.members[0].id, 0) !== 'hostile') h.rel.note(h.members[0].id, 'struck', 0);
  h.go(first.tIn + 1);
  await tick();
  assert.equal(h.st.pool.length, 1, 'the hostile one drew on the player');
  h.st.pool.pop().dead = true;
  h.go(first.tIn + 2);
  assert.deepEqual(h.st.slain, [], 'no slaying written');
  assert.ok(h.members.slice(1).every((m) => h.rel.regard(m.id, 0) === 0), 'its company not turned against the player');
  // the remains: laid after the save, the load wipes the pile - the door's clear forgets what this visit laid
  const { map, o, trips } = parties();
  const tr = trips.find((x) => x.dive && x.enc?.inside && x.fallen?.length);
  const r = fallenIn(map.dungeons.find((x) => x.mapId === tr.to.mapId), tr.fallen[0].t + 1, map.world, o).remains.find((x) => x.trip.id === tr.id);
  assert.ok(r, 'the deep\'s word of them');
  const rel = createRelations();
  let piles = [];
  const rem = createDeepRemains({
    spots: () => [], laid: (k) => rel.turns().laid.has(k), mark: (k) => rel.turn('laid', k),
    lay: (res, feet) => { const p = { feet, items: [1, 2, 3] }; piles.push(p); return p; },
    there: (feet) => piles.some((p) => Math.hypot(p.feet[0] - feet[0], p.feet[2] - feet[2]) <= 0.6),
    count: (p) => p.items.length, feet: () => [0, 0, 0], say: () => {}, townName: () => '', placeOf: () => [40, 0, 40],
  });
  rem.frame([r]);
  assert.equal(piles.length, 1, 'laid on the way in');
  rem.clear();
  piles = [];
  rem.frame([r]);
  assert.equal(rel.turns().laid.has(r.key), false, 'not spent in the loaded game');
  assert.equal(piles.length, 1, 'laid again, as the save\'s world has them');
  // the door: every load passes it, above the frame's indoor return, and it lets both layers go
  const w = rd('src/scenes/world.js');
  const door = /    if \(restoresSoFar\(\) !== _portalRestores\) \{ ([^\n]*?) \}   \/\/ PORTAL1/.exec(w);
  assert.ok(door, 'the load door');
  for (const clear of ['livingDivers?.clear();', 'livingRemains?.clear();', '_livingRemainsPlace.clear();']) assert.ok(door[1].includes(clear), clear);
  assert.ok(w.indexOf(door[0]) < w.indexOf('    if (modes.frame(dt, now)) {'), 'before either layer\'s step');
});

test('AUDIT LW-II-2 D4 / H5: the street\'s talk never asks a company left below - the open world lets the divers go beside the remains, the talk door asks them in the dungeon alone, and a choice that mounted nowhere answers false (mutants: the release, the door, the mounted)', async () => {
  const route = calm('L3.t1:9');
  const first = route.legs[0];
  // world.js's choose with no dungeon standing: modes?.dungeonCtx?.showOverlay?.(...) - undefined
  const up = company({ route, feet: [first.stop.x, 0, first.stop.z + 5], choose: null });
  up.go(first.tIn + 1);
  await tick();
  let talked = 0;
  assert.equal(up.host.offers({ living: up.st.pool[1].living }, () => { talked++; }), false, 'nothing mounted: the talk is the person\'s');
  assert.equal(talked, 0);
  const below = company({ route, feet: [first.stop.x, 0, first.stop.z + 5], choose: true });
  below.go(first.tIn + 1);
  await tick();
  assert.equal(below.host.offers({ living: below.st.pool[1].living }, () => {}), true, 'below, the window stands');
  const w = rd('src/scenes/world.js');
  const release = /\n    if \(livingRemains\) \{ livingRemains\.clear\(\); livingRemains = null; \}[^\n]*\n    if \(livingDivers\) \{ livingDivers\.clear\(\); livingDivers = null; \}/.exec(w);
  assert.ok(release, 'the open world lets the divers go beside the remains');
  const modal = w.indexOf('    if (modes.frame(dt, now)) {');
  assert.ok(release.index > w.indexOf('\n      return;\n    }\n', modal), 'in the open world\'s frame, past the indoor return');
  assert.match(w, /offers: \(person, talk\) => \(livingWorldOn\(\) \? caravanHostOf\(\)\.offers\(person, talk\) \|\| \(_mode\(\) === 'dungeon' && !!livingDivers\?\.offers\(person, talk\)\) : false\) \},/);
});

test('AUDIT LW-II-2 D5: a rival charges only this player\'s own take - a peer\'s take landing through the room\'s word costs nothing, a piece put in and taken back costs nothing; one of the pile\'s own taken still costs each `poached` (mutants: the room\'s word, its count, the own pieces)', async () => {
  const route = calm('L3.t1:9');
  const [first, next] = route.legs;
  assert.equal(next.stop.kind, 'treasure', 'the stop they make for is a find');
  const at = () => { const c = company({ route, feet: [first.stop.x, 0, first.stop.z + 5] }); c.st.piles[next.stop.key] = { stopKey: next.stop.key, items: [{ n: 'gold' }, { n: 'ring' }, { n: 'sword' }] }; return c; };
  const settle = async (c) => { c.go(first.tIn + 1); await tick(); c.st.feet = [next.stop.x, 0, next.stop.z + 1]; c.go(first.tIn + 1.5); };
  // a peer takes two pieces: the room's word lands in the pile while this player stands beside it, taking nothing
  const peer = at();
  await settle(peer);
  const p = peer.st.piles[next.stop.key];
  roomWord(p, [{ n: 'gold' }]);
  peer.go(first.tIn + 2);
  assert.ok(peer.members.every((m) => peer.rel.regard(m.id, 0) === 0), 'a peer\'s take is the room\'s');
  assert.ok(!peer.st.said.some((s) => /ours to find/.test(s)));
  // ...and what the room's word left is the pile's own from there: this player taking it is theirs
  p.items.pop();
  peer.go(first.tIn + 3);
  assert.ok(peer.members.every((m) => peer.rel.regard(m.id, 0) === EVENTS.poached), 'the player\'s own take after it');
  // put in, taken back: nothing of theirs
  const back = at();
  await settle(back);
  const q = back.st.piles[next.stop.key];
  q.items.push({ n: 'my dagger' });
  back.go(first.tIn + 2);
  q.items.pop();
  back.go(first.tIn + 3);
  assert.ok(back.members.every((m) => back.rel.regard(m.id, 0) === 0), 'a piece put in and taken back');
  // one of the pile's own: poached, with the head's word
  q.items.shift();
  back.go(first.tIn + 4);
  assert.ok(back.members.every((m) => back.rel.regard(m.id, 0) === EVENTS.poached));
  assert.deepEqual(back.st.said.slice(-1), [POACHED_LINE('Mem2')]);
  // the room's word counted on the pile where it lands (dungeonContext.js applyLoot)
  assert.match(rd('src/scenes/dungeonContext.js'), /      held\.length = 0;\n      for \(const it of items\) held\.push\(it\);\n      if \(canon\.startsWith\('loot:'\)\) \{ const p = lootPiles\[Number\(canon\.slice\(5\)\)\]; p\.roomWords = \(p\.roomWords \?\? 0\) \+ 1; \}/);
});

test('AUDIT LW-II-2 D6: the fallen of one dive lie a pace apart at their stop (DEEP_APART_M, never within the remains\' own 0.6 m), side by side in the order the deep took them; world.js placeOf walks each out from the stop\'s floor (mutants: the pace, the order, the walk)', () => {
  assert.equal(DEEP_APART_M, 1.5, 'the road\'s pace across the way: 60 native units');
  const { map, o, trips } = parties();
  const multi = trips.filter((x) => x.dive && x.enc?.inside && x.fallen.filter((f) => f.inside && !f.hand).length >= 2);
  assert.ok(multi.length, 'a dive the deep took two of');
  for (const tr of multi) {
    const remains = fallenIn(map.dungeons.find((x) => x.mapId === tr.to.mapId), tr.fallen[0].t + 1, map.world, o).remains.filter((r) => r.trip.id === tr.id);
    assert.ok(remains.length >= 2);
    assert.equal(new Set(remains.map((r) => r.t)).size, 1, 'one minute - one stop');
    const dx = remains.map((r) => apartOf(r));
    for (let i = 0; i < dx.length; i++) for (let j = i + 1; j < dx.length; j++) assert.ok(Math.abs(dx[i] - dx[j]) >= 0.6, `${tr.id}: apart`);
    assert.ok(Math.abs(dx.reduce((a, b) => a + b, 0)) < 1e-9, 'about the stop');
  }
  assert.equal(apartOf({ res: { id: 'x' }, trip: { fallen: [{ res: { id: 'x' }, inside: true }] } }), 0, 'one alone at the stop');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const at = s \? d\.floorAt\?\.\(s\.x, s\.y, s\.z\) \?\? null : null;\n[^\n]*\n[^\n]*\n\s*const dx = at \? deepRemainsApartOf\(r\) : 0;\n\s*if \(dx\) \{ try \{ d\.collider\?\.move\(at, dx, 0, 0, 1\.8\); \} catch \{[^}]*\} \}\n\s*if \(_livingRemainsPlace\.size > 256\) _livingRemainsPlace\.clear\(\);\n\s*_livingRemainsPlace\.set\(r\.key, at\);/);
});

test('AUDIT LW-II-2 D7: no cleared set for an Ocean Holes abyss build - world.js livingDeepCleared answers null while the abyss is being built from its template (whose map table it borrows), and the template\'s own build its dives\' set (mutants: the abyss)', async () => {
  const { map } = parties();
  const d = map.dungeons[0];
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const tr = divesIn(d, 300 * 1440 + 600 - DIVE_CLEAR_MIN, 300 * 1440 + 600, map.world, o).dives[0];
  assert.ok(tr, 'the template dungeon is dived');
  const tBuild = tr.dive.t0 + 150;
  // the abyss's own host over a world of one template (oh_abyss.test.js's): the pit, the swimmer, the door
  const PIT = { x: 392, y: 338 };
  const ll = mapPixelToLongitudeLatitude(100, 100);
  const template = { loaded: true, hasDungeon: true, name: 'Template Crypt', regionIndex: 0, locationIndex: 0, mapTableData: { mapId: d.mapId, longitude: ll.x, latitude: ll.y, dungeonType: 6 }, exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } }, dungeon: { blocks: [0, 1, 2].map((i) => ({ blockName: `B${i}.RDB`, waterLevel: 10000 })) } };
  const corner = mapPixelToWorldCoord(PIT.x, PIT.y);
  const gps = { x: corner.x + 20000, z: corner.y + 12000 };
  let atBuild;
  const abyss = createOceanHolesAbyss({
    settings: () => ({ dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 }),
    maps: { regionCount: 1, locationCount: () => 1, location: () => template },
    siteLinks: () => [], isMainStoryDungeon: () => false,
    gps: { worldX: () => gps.x, worldZ: () => gps.z, currentMapPixel: () => worldCoordToMapPixel(gps.x, gps.z), currentLocation: () => null },
    teleportToWorld: async (x, z) => { gps.x = x; gps.z = z; return true; },
    renameGps: () => {},
    player: { isInside: () => false, isInsideDungeon: () => false, isSwimming: () => true, anchor: () => null, teleportedIntoDungeon: () => false, isRespawning: () => false, loadInProgress: () => false, placeFeet: () => {}, placeCentreY: () => {}, clearFallingDamage: () => {} },
    modes: {
      // worldModes' door: the dungeon's build, where the context asks the outer host its cleared set
      enterAbyss: async (clone) => { atBuild = { clone, set: liftedDeepCleared({ ohAbyss: abyss, map, tBuild })(clone, STOPS, ENTRY) }; return false; },
      dungeon: () => null,
    },
    pitEntrance: (x, y) => (x === PIT.x && y === PIT.y ? { position: [555, -150.175, 588], topY: -150 } : null),
    oceanSurfaceY: () => 34, pitPlacement: () => ({ x: 600, z: 610 }), terrainReady: () => true, hud: () => {},
    roster: () => enemyRoster(), nowSeconds: () => 0, waitFrame: () => Promise.resolve(),
  });
  await abyss.tryEnterPit(PIT.x, PIT.y);
  assert.ok(atBuild, 'the abyss was built');
  assert.equal(atBuild.clone.mapTableData.mapId, d.mapId, 'its map table the template\'s at the build');
  assert.equal(atBuild.set, null, 'no clear: the template\'s dives are not the abyss\'s');
  // the template's own build, the abyss not building: its dives' set
  const own = liftedDeepCleared({ ohAbyss: abyss, map, tBuild })(template, STOPS, ENTRY);
  assert.ok(own instanceof Set && own.size > 0, 'the template dungeon stands cleared where its company passed');
});

test('AUDIT LW-II-2 D8: a road\'s trouble takes nothing from the deep - among the census\'s dives troubled on the road the deep\'s fight comes at DEEP_RISK; a trouble met inside, never (mutants: inside)', () => {
  const { trips } = parties();
  const road = trips.filter((x) => x.dive && x.enc && !x.enc.inside);
  const inside = trips.filter((x) => x.dive && x.enc?.inside);
  assert.ok(road.length >= 80 && inside.length >= 5, `${road.length} road-troubled, ${inside.length} inside`);
  const n = road.filter((x) => deepFightOf(x) != null).length;
  assert.ok(Math.abs(n / road.length - DEEP_RISK) < 0.12, `${n} of ${road.length}`);
  assert.ok(inside.every((x) => deepFightOf(x) == null), 'the fated trouble is the dive\'s own');
});

test('AUDIT LW-II-2 D9: a fated minute on the way out lays the fallen at the reach\'s stop nearest where they are, never the deepest wherever it fell (mutants: the nearest)', () => {
  const r = calm('L3.t1:9');
  const last = r.legs[r.legs.length - 1].stop;
  for (const f of [0.15, 0.5, 0.97]) {
    const t = r.out.t0 + (r.out.t1 - r.out.t0) * f;
    assert.ok(stopAt(r, t).out, 'on the way out');
    const p = pointAt(r, t);
    const want = r.legs.map((l) => l.stop).reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a));
    assert.equal(stopOfMinute(r, t), want, `at ${f} of the way out`);
  }
  const t = r.out.t1 - 0.5;
  assert.notEqual(stopOfMinute(r, t), last, 'near the way in, never the deepest');
  assert.equal(stopOfMinute(r, t), r.legs[0].stop, 'the first, beside the way in');
  assert.equal(stopOfMinute(r, (r.legs[r.legs.length - 1].tOut + r.out.t0) / 2), last, 'resting at the last: the last');
});

test('AUDIT LW-II-2 D10: with no start marker the order starts from the starting block (the dungeon\'s way in), never the list\'s first (mutants: the starting block)', () => {
  const row = [0, 1, 2, 3, 4].map((gx) => block(gx, 0, [[STOP_FOE, 10, 25], [STOP_FOE, 20, 25]], { isStartingBlock: gx === 2 }));
  const order = stopsOf(row, SIDE, null).map((s) => s.block);
  assert.deepEqual(order.slice(0, 2), [2, 2], 'the starting block first');
  assert.deepEqual(order, stopsOf(row, SIDE, { x: 2 * SIDE + SIDE / 2, z: SIDE / 2 }).map((s) => s.block), 'as from its middle');
  assert.deepEqual(stopsOf(row.map((b) => ({ ...b, isStartingBlock: false })), SIDE, null)[0].block, 0, 'none marked: the first');
});

test('AUDIT LW-II-2 D11: the stops\' markers are their one home\'s - STOP_FOE the dungeon\'s foes\' RANDOM_RECORD, STOP_TREASURE the loot\'s RANDOM_TREASURE_MARKER_RECORD - never two literals (mutants: each home)', () => {
  assert.deepEqual([STOP_FOE, STOP_TREASURE], [RANDOM_RECORD, RANDOM_TREASURE_MARKER_RECORD]);
  assert.deepEqual([RANDOM_RECORD, RANDOM_TREASURE_MARKER_RECORD], [15, 19], 'RDBLayout\'s editor records (archive 199)');
  const src = rd('src/systems/livingWorld/deepRoute.js');
  assert.match(src, /\nexport const STOP_FOE = RANDOM_RECORD;\nexport const STOP_TREASURE = RANDOM_TREASURE_MARKER_RECORD;\n/);
  assert.doesNotMatch(src, /STOP_(FOE|TREASURE) = \d/);
  assert.match(rd('src/characters/dungeonEnemies.js'), /\nexport const RANDOM_RECORD = 15;/);
});

test('AUDIT LW-II-2 D13 / P10: the deep\'s fight - at the foe stop of the reach its seed picks, DEEP_FIGHT_MIN more there and every later stop of the reach as much later, none trimmed though the reach then runs past the dive\'s middle (mutants: the pick, the shift, no trim)', () => {
  let picked = 0, notFirst = 0, pastMid = 0;
  for (let i = 0; i < 200; i++) {
    const id = `L1.t${i}:5`;
    const at = deepFightOf({ id });
    if (at == null) continue;
    for (const t1 of [250, 350, 900]) {   // a reach that ends near the middle (the fight then runs it past), and one done early
      const plain = calm(id, t1);
      const fought = routeOf(STOPS, ENTRY, { id, dive: { t0: 0, t1 } });
      const foes = plain.legs.map((l, j) => (l.stop.kind === 'foe' ? j : -1)).filter((j) => j >= 0);
      if (!foes.length) continue;
      const k = foes[Math.min(foes.length - 1, Math.floor(at * foes.length))];
      assert.deepEqual(fought.legs.map((l) => l.stop), plain.legs.map((l) => l.stop), 'the whole reach, none trimmed');
      fought.legs.forEach((l, j) => {
        assert.ok(Math.abs(l.tIn - plain.legs[j].tIn - (j > k ? DEEP_FIGHT_MIN : 0)) < 1e-9, `${id}: in`);
        assert.ok(Math.abs(l.tOut - plain.legs[j].tOut - (j >= k ? DEEP_FIGHT_MIN : 0)) < 1e-9, `${id}: out`);
      });
      picked++;
      if (k !== foes[0]) notFirst++;
      if (k < fought.legs.length - 1 && fought.legs[fought.legs.length - 1].tOut > t1 / 2) pastMid++;
    }
  }
  assert.ok(picked > 50 && notFirst > 10 && pastMid > 5, `${picked} fights, ${notFirst} past the first foe, ${pastMid} past the middle`);
});

test('AUDIT LW-II-2 P10: the way out - resting at the last stop until the walk back fits the dive\'s end, then the way out by it (mutants: the rest)', () => {
  const r = calm('L3.t1:9', 900);
  const last = r.legs[r.legs.length - 1];
  let back = 0;
  for (let i = 1; i < r.out.path.length; i++) back += (Math.hypot(r.out.path[i].x - r.out.path[i - 1].x, r.out.path[i].z - r.out.path[i - 1].z) * DEEP_DETOUR) / DEEP_WALK_M;
  assert.ok(last.tOut < 900 - back, 'a reach done early');
  assert.ok(Math.abs(r.out.t0 - (900 - back)) < 1e-9, 'out when the walk back fits the end');
  const s = stopAt(r, (last.tOut + r.out.t0) / 2);
  assert.deepEqual([s.at, s.resting], [last.stop, true], 'resting at the last');
});

test('AUDIT LW-II-2 P10: the build\'s cleared set routed from the ENTRY, as the divers\' own route is (world.js livingDeepCleared, lifted) - never from the first stop (mutants: the entry)', () => {
  const { map } = parties();
  const d = map.dungeons[0];
  const far = { x: 50, z: 450 };   // a way in 400 m from the first stop: twenty-odd minutes' walk
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const tr = divesIn(d, 300 * 1440 + 600 - DIVE_CLEAR_MIN, 300 * 1440 + 600, map.world, o).dives[0];
  let differed = 0;
  for (let dt = 5; dt < 200; dt += 5) {
    const tBuild = tr.dive.t0 + dt;
    const dives = divesIn(d, tBuild - DIVE_CLEAR_MIN, tBuild, map.world, o).dives;
    const want = clearedOf(dives.map((x) => routeOf(STOPS, far, x)), tBuild);
    const fromFirst = clearedOf(dives.map((x) => routeOf(STOPS, { x: STOPS[0].x, z: STOPS[0].z }, x)), tBuild);
    const got = liftedDeepCleared({ map, tBuild, memo: o.memo })({ mapTableData: { mapId: d.mapId } }, STOPS, far);
    assert.deepEqual([...got].sort(), [...want].sort(), `at ${dt}`);
    if ([...want].sort().join() !== [...fromFirst].sort().join()) differed++;
  }
  assert.ok(differed > 0, 'a way in far off moves what stands cleared');
});

test('AUDIT LW-II-2 P10: LEAD ON\'s arrival - each member within its own follow stop and DIVER_ARRIVE_SLACK_M (2 m) of the stop has arrived, one 2.5 m past it has not (mutants: the slack\'s value)', async () => {
  assert.equal(DIVER_ARRIVE_SLACK_M, 2);
  const route = calm('L3.t1:9');
  const [first, second, third] = route.legs;
  const c = company({ route, feet: [first.stop.x, 0, first.stop.z + 5] });
  c.go(first.tIn + 1);
  await tick();
  c.host.offers({ living: c.st.pool[0].living }, () => {});
  pick(c.st, 'KeyL');
  assert.equal(c.host.companies()[0].going.stop, second.stop);
  for (const r of c.st.pool) r.ai.feet = [second.stop.x + r.ai.follow.stop + 2.5, 0, second.stop.z];
  c.go(first.tIn + 2);
  assert.equal(c.host.companies()[0].going.stop, second.stop, '2.5 m past its stop: not there yet');
  for (const r of c.st.pool) r.ai.feet = [second.stop.x + r.ai.follow.stop + 1.5, 0, second.stop.z];
  c.go(first.tIn + 3);
  assert.equal(c.host.companies()[0].going.stop, third.stop, 'arrived: on to the next');
});

test('AUDIT LW-II-2: the host\'s divers\' and remains\' steps wrapped as their neighbours are - a throw below never kills the frame loop (mutants: each wrap)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /\n      try \{ livingDiversStep\(now\); \} catch \(e\) \{ console\.warn\('\[divers\] step', e\); \}/);
  assert.match(w, /\n      try \{ livingRemainsStep\(now\); \} catch \(e\) \{ console\.warn\('\[remains\] step', e\); \}/);
});
