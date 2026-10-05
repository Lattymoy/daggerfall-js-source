// LW6b (2026-10-05, bible/06-Systems/Living-World.md "LW6b", Mac: "You can find them dungeon diving ... explore a
// dynamic world"): THE FALLEN IN THE DEEP - the dead of a dive left in its dungeon to be found: the deep's word of them
// (trips.js fallenIn), the character's mark of what was laid (relations.js `laid`), the layer that lays them where the
// dungeon's own foes stand and tells the player whose they are (scenes/deepRemains.js), the divers' word of who they
// stood, and the dungeon's and the streaming host's parts by source. On the synthetic map's dungeons and mock decks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { fallenIn, CALENDAR_MPM, DEEP_REMAINS_MIN } from '../src/systems/livingWorld/trips.js';
import { createRelations, TURN_KINDS, MARK_KINDS } from '../src/systems/livingWorld/relations.js';
import { createDeepRemains, restAt, DEEP_NOTICE_M, DEEP_LAY_M } from '../src/scenes/deepRemains.js';
import { createDungeonDivers } from '../src/scenes/dungeonDivers.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });

test('LW6b the deep\'s word: the dead of the dives into a dungeon by the towns within reach, each from the minute the deep took them for DEEP_REMAINS_MIN (three days) - none before, none after, none of another dungeon, none of the road, never a hand\'s; each once, by its own key, the oldest first (mutants: the window, the dungeon, the inside, the hand, the days read back, the key, the order)', () => {
  assert.equal(DEEP_REMAINS_MIN, 3 * DAY_MIN);
  const map = livingMap({ dives: true });
  const deadly = partiesOver(map, 350, 460, O()).filter((t) => t.dive && t.fallen?.length);
  assert.ok(deadly.length >= 2, `dives the deep took from (${deadly.length})`);
  for (const D of deadly.slice(0, 4)) {
    const f = D.fallen[0];
    const key = `deep:${f.res.id}:${D.id}`;
    const at = (t, dungeon = D.to) => fallenIn(dungeon, t, map.world, O()).remains.some((r) => r.key === key);
    assert.equal(at(f.t - 1), false, 'not before the deep took them');
    assert.equal(at(f.t), true, 'from that minute');
    assert.equal(at(f.t + DEEP_REMAINS_MIN - 1), true, 'three days on, still');
    assert.equal(at(f.t + DEEP_REMAINS_MIN), false, 'then gone');
    assert.equal(at(f.t + 10, { ...D.to, mapId: D.to.mapId + 77777 }), false, 'another dungeon\'s none');
    const got = fallenIn(D.to, f.t + DAY_MIN * 2.5, map.world, O()).remains.find((r) => r.key === key);
    assert.deepEqual([got.res.id, got.trip.id, got.t], [f.res.id, D.id, f.t]);
  }
  // the inside alone, never a hand's, each once, the oldest first
  const D = deadly[0];
  const [a, b, c] = [D.leader, ...D.party.slice(1), ...map.world.rosterOf(D.from)].filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
  const T = D.fallen[0].t;
  const fate = map.world.fate;
  const world = { ...map.world, fate: (tr) => (tr.id === D.id ? { ...tr, fallen: [{ res: c, t: T + 5, s: 0, inside: true }, { res: a, t: T, s: 0, inside: true }, { res: b, t: T, s: 0, inside: true, hand: true }, { res: { ...b, id: `${b.id}x` }, t: T, s: 0 }] } : fate(tr)) };
  const got = fallenIn(D.to, T + 60, world, O()).remains.filter((r) => r.trip.id === D.id);
  assert.deepEqual(got.map((r) => r.res.id), [a.id, c.id], 'the inside alone, a hand\'s never, the oldest first');
  assert.equal(new Set(fallenIn(D.to, T + 60, world, O()).remains.map((r) => r.key)).size, fallenIn(D.to, T + 60, world, O()).remains.length, 'each once');
  // read back over the days they lie: a dive long done still answers
  const late = fallenIn(D.to, T + DEEP_REMAINS_MIN - 30, world, O()).remains.filter((r) => r.trip.id === D.id);
  assert.deepEqual(late.map((r) => r.res.id), [a.id, c.id], 'days after the dive');
  // the map unread: pending
  assert.equal(fallenIn(D.to, T + 60, { ...map.world, routeOf: () => undefined }, O()).pending, true);
});

test('LW6b the character\'s mark: what the living world laid in this world (`laid`) kept as the turns are - written into the save only once there is one, read back from it; the turns as they were (mutants: the mark, the save, the read, the written-only-once)', () => {
  assert.deepEqual([...MARK_KINDS], ['laid']);
  assert.deepEqual([...TURN_KINDS], ['spared', 'fallen', 'won', 'lost']);
  const rel = createRelations();
  assert.equal(rel.snapshot().turns, undefined, 'nothing yet: no turns written');
  rel.turn('spared', 'L5.t2@3');
  assert.deepEqual(Object.keys(rel.snapshot().turns), ['spared', 'fallen', 'won', 'lost'], 'no mark: none written');
  assert.equal(rel.turn('laid', 'deep:L5.t2:L5.t2:60'), true);
  assert.equal(rel.turn('laid', 'deep:L5.t2:L5.t2:60'), false, 'once');
  assert.ok(rel.turns().laid.has('deep:L5.t2:L5.t2:60'));
  assert.deepEqual(rel.snapshot().turns.laid, ['deep:L5.t2:L5.t2:60']);
  const back = createRelations(JSON.parse(JSON.stringify(rel.snapshot())));
  assert.ok(back.turns().laid.has('deep:L5.t2:L5.t2:60'), 'read back from the save');
  assert.ok(back.turns().spared.has('L5.t2@3'));
  const only = createRelations();
  only.turn('laid', 'deep:x:y');
  assert.deepEqual(only.snapshot().turns.laid, ['deep:x:y'], 'a mark alone is written');
});

/** A remains layer over mock decks: `spots`, a set for the mark, the piles laid, the player's feet. */
function remainsRig({ spots = [[0, 0, 0], [30, 0, 0], [60, 0, 0], [90, 0, 0]], feet = [200, 0, 200], lays = true } = {}) {
  const marks = new Set(), piles = [], said = [];
  const st = { feet, lays };
  const layer = createDeepRemains({
    spots: () => spots,
    laid: (k) => marks.has(k), mark: (k) => marks.add(k),
    lay: (res, at) => { if (!st.lays) return null; const p = { res, at, looted: false }; piles.push(p); return p; },
    there: (at) => piles.some((p) => !p.looted && p.at === at),
    feet: () => st.feet, say: (t) => said.push(t),
    townName: (res) => (res.town === 5 ? 'Wayrest' : ''),
  });
  return { layer, marks, piles, said, st, spots };
}
const R = (i, town = 5) => ({ key: `deep:L${town}.t${i}:L${town}.t${i}:60`, res: { id: `L${town}.t${i}`, name: `Ada${i} Lark`, town } });

test('LW6b laid where the dungeon\'s foes stand: each at the place its key deals - on the way in at once, after it only beyond DEEP_LAY_M of the player; laid once (the mark), a lay that fails tried again; no place, none (mutants: the deal, the way in, the reach, the mark, the retry, the places)', () => {
  assert.equal(DEEP_LAY_M, 15);
  const n = 4;
  for (const r of [R(1), R(2), R(3)]) { const i = restAt(r.key, n); assert.ok(i >= 0 && i < n && i === restAt(r.key, n)); }
  assert.equal(restAt('deep:x', 0), -1);
  assert.ok(new Set(Array.from({ length: 40 }, (_, i) => restAt(R(i).key, n))).size === n, 'the keys deal over every place');
  // the way in: laid at once, even under the player's eyes
  const rig = remainsRig();
  const near = R(1);
  rig.st.feet = [...rig.spots[restAt(near.key, n)]];
  rig.layer.frame([near]);
  assert.equal(rig.piles.length, 1);
  assert.equal(rig.piles[0].at, rig.spots[restAt(near.key, n)], 'at its own place');
  assert.ok(!rig.marks.has(near.key), 'laid, not spent - LW-FIX5: spent once taken from (test/lwfix5_deep.test.js)');
  rig.layer.frame([near]);
  assert.equal(rig.piles.length, 1, 'laid once a visit');
  // after the way in: one the deep takes near the player waits until they are away
  const later = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => R(i + 10)).find((r) => restAt(r.key, n) === restAt(near.key, n));
  rig.layer.frame([near, later]);
  assert.equal(rig.piles.length, 1, 'not under the player\'s eyes');
  rig.st.feet = [rig.spots[restAt(later.key, n)][0] + DEEP_LAY_M + 1, 0, rig.spots[restAt(later.key, n)][2]];
  rig.layer.frame([near, later]);
  assert.equal(rig.piles.length, 2, 'laid where the player is not');
  // a lay that fails is tried again; no place, nothing
  const fail = remainsRig({ lays: false });
  fail.layer.frame([R(2)]);
  assert.equal(fail.marks.size, 0, 'not laid: not marked');
  fail.st.lays = true;
  fail.st.feet = [500, 0, 500];
  fail.layer.frame([R(2)]);
  assert.equal(fail.piles.length, 1, 'tried again');
  const none = remainsRig({ spots: [] });
  none.layer.frame([R(1)]);
  assert.equal(none.piles.length + none.marks.size, 0);
});

test('LW6b found: the player coming within DEEP_NOTICE_M of remains still lying there hears whose they are - by name and town - once a visit; looted, nothing; a new visit tells again (mutants: the reach, the floor, the there, the once, the words, the visit)', () => {
  assert.equal(DEEP_NOTICE_M, 4);
  const rig = remainsRig();
  const r = R(1);
  rig.layer.frame([r]);   // laid on the way in, the player far
  const at = rig.spots[restAt(r.key, 4)];
  assert.deepEqual(rig.said, []);
  rig.st.feet = [at[0] + DEEP_NOTICE_M + 0.5, 0, at[2]];
  rig.layer.frame([r]);
  assert.deepEqual(rig.said, [], 'not yet near');
  rig.st.feet = [at[0], 3.5, at[2]];
  rig.layer.frame([r]);
  assert.deepEqual(rig.said, [], 'another floor');
  rig.st.feet = [at[0] + DEEP_NOTICE_M - 0.5, 0, at[2]];
  rig.layer.frame([r]);
  assert.deepEqual(rig.said, ['The remains of Ada1 Lark, of Wayrest.']);
  rig.layer.frame([r]);
  assert.equal(rig.said.length, 1, 'once a visit');
  assert.deepEqual(rig.layer.told(), [r.key]);
  rig.layer.clear();
  rig.layer.frame([r]);
  assert.equal(rig.said.length, 2, 'a new visit tells again');
  // looted: nothing to tell
  const loot = remainsRig();
  const q = R(2, 9);
  loot.layer.frame([q]);
  loot.piles[0].looted = true;
  const qa = loot.spots[restAt(q.key, 4)];
  loot.st.feet = [qa[0], 0, qa[2]];
  loot.layer.frame([q]);
  assert.deepEqual(loot.said, [], 'gone: nothing');
  loot.piles[0].looted = false;
  loot.layer.frame([q]);
  assert.deepEqual(loot.said, ['The remains of Ada2 Lark.'], 'a town unknown: the name alone');
});

test('LW6b the divers\' word: one of a company stood in the dungeon this time - beside the player or drawn on them - is theirs, its end what happens there; and the company let go, theirs no more (mutants: the company, the member, the drawn)', async () => {
  const pool = new Set();
  const rel = createRelations();
  rel.note('L5.t6', 'slain', 7);   // hostile: drawn on the player
  const spawn = async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {}, ai: {} }; pool.add(rec); return rec; };
  const divers = createDungeonDivers({
    spawn, spawnFoe: spawn,
    remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec),
    leader: () => ({ feet: [10, 0, 10], yaw: 0 }), spot: (from, dx, dz) => [from[0] + dx, from[1], from[2] + dz],
    owner: () => true, relations: () => rel, turnKeyOf: (res) => `${res.id}@K`, dies: () => false, day: () => 7, say: () => {},
  });
  const c = {
    trip: { id: 'L5.t2:60', leader: { id: 'L5.t2', name: 'Ada Lark' }, to: { name: 'Mournoth' }, backT0: 2000, outT0: 100 },
    members: [{ id: 'L5.t2', name: 'Ada Lark', cls: 140, level: 12, sex: 'female' }, { id: 'L5.t6', name: 'Bo Reed', cls: 136, level: 8, sex: 'male' }],
  };
  divers.frame([c], 1000);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(divers.companies()[0].foes.has('L5.t6'), true, 'the hostile drawn on the player');
  assert.equal(divers.stood('L5.t2:60', 'L5.t6'), true, 'drawn: theirs');
  // none hostile: beside the player
  const friendly = createDungeonDivers({
    spawn, remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec),
    leader: () => ({ feet: [10, 0, 10], yaw: 0 }), spot: (from, dx, dz) => [from[0] + dx, from[1], from[2] + dz],
    owner: () => true, relations: () => createRelations(), turnKeyOf: (res) => `${res.id}@K`, dies: () => false, day: () => 7, say: () => {},
  });
  friendly.frame([c], 1000);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(friendly.companies()[0].allies.has('L5.t2'));
  assert.equal(friendly.stood('L5.t2:60', 'L5.t2'), true, 'beside the player: theirs');
  assert.equal(divers.stood('L5.t2:60', 'L5.t9'), false, 'not of the company stood');
  assert.equal(divers.stood('L5.t3:60', 'L5.t6'), false, 'another company');
  divers.clear();
  assert.equal(divers.stood('L5.t2:60', 'L5.t6'), false, 'let go');
});

test('LW6b the dungeon and the streaming host: the dungeon\'s resting places (its random enemy markers, on the floor), its pile for the remains wearing the given picture, whether one lies at a place; the host asks the deep once a second in the dungeon, passing by the fallen beside the player, the spared and any of a company stood there now, lays each with its class\'s corpse picture and what they carried, and lets the layer go with the street (mutants: the places, the pile, the picture, the filters, the step, the street)', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /restingSpots: \(\) => \(_restingSpots \?\?= _layoutEnemies\.filter\(\(e\) => !e\.fixed\)\.map\(\(e\) => floorLanding\(collider, \[e\.x, e\.y \+ 0\.2, e\.z\]\)\)\),/);
  assert.match(dc, /layRemains: \(items, feet, icon\) => droppedLoot\.dropPile\(items, feet, null, icon\),/);
  assert.match(dc, /pileNear: \(feet, r\) => droppedLoot\._piles\.some\(\(p\) => Math\.hypot\(p\.pos\[0\] - feet\[0\], p\.pos\[2\] - feet\[2\]\) <= r && Math\.abs\(p\.pos\[1\] - feet\[1\]\) <= 2\),/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /livingRemainsStep\(now\);   \/\/ LW6b/);
  assert.match(w, /return !turns\.fallen\.has\(key\) && !turns\.spared\.has\(key\) && !turns\.slain\.has\(key\) && !turns\.died\.has\(key\) && !livingDivers\?\.stood\(r\.trip\.id, r\.res\.id\);/);   // LW-FIX1: and the player's own dead
  assert.match(w, /laid: \(key\) => livingRelations\.turns\(\)\.laid\.has\(key\),\n\s+mark: \(key\) => livingRelations\.turn\('laid', key\),/);
  assert.match(w, /return d\.layRemains\(items, feet, \{ archive: corpse\.archive, record: corpse\.record \}\);/);
  assert.match(w, /const items = generateLootItems\(enemyLootTableKey\(res\.cls, look\.basics\.lootTableKey \?\? '-'\), \{ level, gender: res\.sex \?\? 'male' \}, rolls\);/);
  assert.match(w, /for \(const raw of \[createRandomWeapon\(level, rolls\), createRandomArmor\(level, rolls\)\]\)/);
  assert.match(w, /items\.push\(goldStack\(/);
  assert.match(w, /if \(livingRemains\) \{ livingRemains\.clear\(\); livingRemains = null; \}   \/\/ LW6b: \.\.\.and the deep's layer let go with its dungeon/);
});
