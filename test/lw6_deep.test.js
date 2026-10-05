// LW6 (2026-10-05, bible/06-Systems/Living-World.md, Mac: "You can find them dungeon diving, make friends or enemies"):
// THE DEEP - an adventurer's dives (a dungeon in reach, the hours inside in place of a stay), the deep's fated end (the
// dungeon's own foes, the fallen lying inside, a fallen leader's company out at once), what the town says of a dive,
// who is inside a dungeon now, and the companies met there - on the synthetic map with its dungeons and a mock pool.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthMap, livingMap, partiesOver } from './lwRoads.mjs';
import { ownTrip, diveTrip, diversAt, remainsNear, partyAt, cycleOf, CALENDAR_MPM, DIVE_CHANCE, DIVE_RANGE_PX, DIVE_MIN, TRIP_PACE, NATIVE_PER_M } from '../src/systems/livingWorld/trips.js';
import { troubleOf, troubledTrip, HALT_MIN } from '../src/systems/livingWorld/trouble.js';
import { DIVE_NEWS, ROAD_NEWS, newsScript } from '../src/systems/livingWorld/lines.js';
import { createDungeonDivers, DIVER_STAND_M, DIVER_HEEL_M, DIVER_HEEL_STEP_M } from '../src/scenes/dungeonDivers.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { lwRng } from '../src/systems/livingWorld/seed.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });

test('LW6 the dives: an adventurer\'s cycle a DIVE now and then (DIVE_CHANCE, its own dice) - a dungeon within DIVE_RANGE_PX, the nearer the likelier, its hours inside (DIVE_MIN) in place of a stay and home inside the cycle; a cycle that is no dive the town trip it always was; none but an adventurer dives (mutants: the chance, the reach, the hours, the own dice, the trade)', () => {
  assert.equal(DIVE_CHANCE, 0.55);
  assert.deepEqual([...DIVE_RANGE_PX], [1, 8]);
  assert.deepEqual([...DIVE_MIN], [240, 600]);
  const plain = synthMap(), deep = synthMap({ dives: true });
  let dives = 0, trips = 0, same = 0;
  for (const town of deep.towns) {
    for (const res of deep.world.rosterOf(town)) {
      for (let k = 40; k < 70; k++) {
        const t = ownTrip(res, town, k, deep.world, O());
        if (res.job !== 'adventurer') { assert.ok(!t?.dive, 'none but an adventurer dives'); continue; }
        if (!t) continue;
        trips++;
        const diving = lwRng(res.town, res.slot, k, 0x64697665)() < DIVE_CHANCE;
        if (!t.dive) {
          assert.deepEqual(t, ownTrip(res, town, k, plain.world, O()), 'no dive: the town trip it always was');
          if (!diving) same++;
          continue;
        }
        assert.ok(diving, 'a dive only where its own dice said dive');
        dives++;
        const d = t.to;
        assert.ok(d.dungeon, 'to a dungeon');
        const r = Math.max(Math.abs(d.px - town.px), Math.abs(d.py - town.py));
        assert.ok(r >= DIVE_RANGE_PX[0] && r <= DIVE_RANGE_PX[1], `within reach (${r})`);
        assert.equal(t.dive.t0, t.outT1, 'in on arrival');
        assert.equal(t.dive.t1, t.backT0, 'out when the walk home begins');
        assert.ok(t.backT0 - t.outT1 >= DIVE_MIN[0] && t.backT0 - t.outT1 <= DIVE_MIN[1], 'its hours inside');
        const mine = cycleOf(res, Math.floor(t.outT0 / DAY_MIN), 1);
        assert.equal(mine.k, k, 'it sets out inside its own cycle');
        assert.ok(t.backT1 <= (mine.start + mine.len) * DAY_MIN + 240, 'home inside the cycle');
      }
    }
  }
  assert.ok(dives > 20 && same > 10, `dives and plain trips both (${dives} dives, ${same} plain, of ${trips})`);
  assert.ok(dives / trips > DIVE_CHANCE - 0.15 && dives / trips < DIVE_CHANCE + 0.05, `about DIVE_CHANCE of an adventurer's trips (${(dives / trips).toFixed(2)})`);
  // never a dungeon on the town's own pixel (DIVE_RANGE_PX's floor)
  const own = synthMap({ dives: true });
  const home = own.towns[40];
  const under = { mapId: 9999, px: home.px, py: home.py, blocks: 1, name: 'Under', dungeon: true, dungeonType: 3 };
  const near = own.world.dungeonsNear;
  own.world.dungeonsNear = (px, py, r) => [under, ...near(px, py, r)];
  const hero = own.world.rosterOf(home).find((r) => r.job === 'adventurer');
  for (let k = 0; k < 200; k++) {
    const t = diveTrip(hero, home, k, own.world, { start: 0, len: 30, pace: TRIP_PACE.adventurer * CALENDAR_MPM * NATIVE_PER_M, rng: lwRng(hero.town, hero.slot, k, 0x64697665) });
    assert.notEqual(t?.to?.mapId, 9999, 'never the dungeon under the town itself');
  }
  // the nearer the likelier
  const town = deep.towns[40];
  const adv = deep.world.rosterOf(town).find((r) => r.job === 'adventurer');
  const counts = new Map();
  for (let k = 0; k < 400; k++) {
    const t = diveTrip(adv, town, k, deep.world, { start: 0, len: 30, pace: TRIP_PACE.adventurer * CALENDAR_MPM * NATIVE_PER_M, rng: lwRng(adv.town, adv.slot, k, 0x64697665) });
    if (t) counts.set(t.to.mapId, (counts.get(t.to.mapId) ?? 0) + 1);
  }
  const dist = (id) => { const d = deep.dungeons.find((x) => x.mapId === id); return Math.hypot(d.px - town.px, d.py - town.py); };
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  assert.ok(dist(ranked[0][0]) <= dist(ranked[ranked.length - 1][0]), 'the most dived the nearer');
});

test('LW6 the deep\'s trouble: a dive carrying a fated death meets it INSIDE, at a seeded hour of its time there, among the dungeon\'s own (its type\'s table) - the leader among the fated: the party fell and comes out at once; else won at that cost; the fallen lie inside, never on the road (mutants: the inside, the hour, the dungeon\'s foes, the leader, the way out)', () => {
  const map = livingMap({ dives: true });
  const all = partiesOver(map, 400, 520);
  const deadly = all.filter((t) => t.enc?.leg === 'dive');
  assert.ok(deadly.length > 3, `deaths in the deep (${deadly.length})`);
  for (const t of deadly) {
    const e = t.enc;
    assert.equal(e.inside, true);
    assert.ok(e.dead.length > 0, 'a fated death');
    assert.equal(e.kind, e.dead.includes(t.leader.id) ? 'fell' : 'won');
    assert.ok(t.fallen.every((f) => f.inside), 'the fallen lie inside');
    assert.ok(e.t0 >= t.dive.t0 && e.t0 <= t.dive.t0 + (DIVE_MIN[1] * 0.8) + 1, 'at an hour of its time there');
    if (e.kind === 'fell') {
      assert.equal(t.backT0, Math.min(t.backT0, e.t1), 'out at once');
      assert.equal(t.dive.t1, t.backT0);
      assert.ok(t.backT0 <= e.t0 + HALT_MIN.fell + 1e-6, 'its leader fallen, the company out');
    }
    assert.equal(t.halt, undefined, 'no halt on the road: it was under the ground');
    // the remains are the deep's, not the road's
    const lay = remainsNear(t.to.px, t.to.py, t.fallen[0].t + 5, map.world, O(), 3).remains;
    assert.ok(!lay.some((r) => r.res.id === t.fallen[0].res.id), 'no corpse at the door: they fell inside');
  }
  // the dungeon's own foes: the dive's foesOf asked with its dungeon's type
  const seen = [];
  const spy = { ...map.trouble, foesOf: (q) => { seen.push(q); return [7, 7]; }, dies: (m) => m.id === deadly[0].leader.id };
  const plainTrip = { ...deadly[0], enc: undefined, fallen: undefined, turned: false };
  const e = troubleOf(plainTrip, spy);
  assert.equal(e.leg, 'dive');
  assert.equal(seen[0].dungeonType, deadly[0].to.dungeonType, 'the dungeon\'s own table');
  assert.equal(e.kind, 'fell', 'the leader fated: the party fell');
  const left = troubledTrip(plainTrip, e);
  assert.equal(left.backT0, Math.min(plainTrip.backT0, e.t1));
});

test('LW6 who is inside: the parties of the towns within reach diving a dungeon now (less the fallen) - none before their hours or after; what the town says of a dive is the deep\'s own (mutants: the window, the dungeon, the words)', () => {
  const map = livingMap({ dives: true });
  const o = O();
  const all = partiesOver(map, 400, 520, o);
  const dive = all.find((t) => t.dive && !t.enc);
  assert.ok(dive);
  const mid = (dive.dive.t0 + dive.dive.t1) / 2;
  const at = (m) => diversAt(dive.to, m, map.world, o).divers.some((d) => d.trip.id === dive.id);
  assert.equal(at(mid), true, 'inside, mid-dive');
  assert.equal(at(dive.dive.t0 - 1), false, 'not before');
  assert.equal(at(dive.dive.t1 + 1), false, 'nor after');
  const elsewhere = [...map.dungeons].filter((d) => d.mapId !== dive.to.mapId).sort((a, b) => Math.hypot(a.px - dive.to.px, a.py - dive.to.py) - Math.hypot(b.px - dive.to.px, b.py - dive.to.py))[0];
  assert.ok(!diversAt(elsewhere, mid, map.world, o).divers.some((d) => d.trip.id === dive.id), 'and only in its own dungeon');
  assert.equal(partyAt(dive, mid).phase, 'stay', 'not on the road');
  // the words
  assert.deepEqual(Object.keys(DIVE_NEWS), ['driven', 'won', 'fled', 'fell']);
  let seed = 0;
  const news = [{ kind: 'fell', who: 'Bo Reed', foe: 'Orcs', place: 'Mournoth', dive: true }];
  while (!newsScript(seed, news)) seed++;
  assert.ok(DIVE_NEWS.fell.includes(newsScript(seed, news).script), 'a dive\'s words');
  assert.ok(ROAD_NEWS.fell.includes(newsScript(seed, [{ ...news[0], dive: false }]).script), 'the road\'s for the road');
});

/** A divers' layer over a mock pool. */
function diverRig({ owner = true, fated = () => false } = {}) {
  const pool = new Set(), spawned = [], said = [];
  const rel = createRelations();
  let leader = { feet: [10, 0, 10], yaw: 0 };
  const divers = createDungeonDivers({
    spawn: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {}, ai: {} }; pool.add(rec); spawned.push(rec); return rec; },
    remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec),
    leader: () => leader, spot: (from, dx, dz) => [from[0] + dx, from[1], from[2] + dz],
    owner: () => owner, relations: () => rel, turnKeyOf: (res) => `${res.id}@K`, dies: (res) => fated(res), day: () => 7,
    say: (t) => said.push(t),
    died: (res, t) => rel.turn('died', `${res.id}@K`, { t, who: res.name }),   // AUDIT-C3: the host's hand turn at the minute
  });
  return { divers, pool, spawned, rel, said, setLeader: (l) => { leader = l; } };
}
const company = () => ({
  trip: { id: 'L5.t2:60', leader: { id: 'L5.t2', name: 'Ada Lark' }, to: { name: 'Mournoth' }, backT0: 2000, outT0: 100 },
  members: [{ id: 'L5.t2', name: 'Ada Lark', cls: 140, level: 12, sex: 'female' }, { id: 'L5.t6', name: 'Bo Reed', cls: 136, level: 8, sex: 'male' }],
});
const settle = () => new Promise((r) => setTimeout(r, 0));

test('LW6 the companies met: a company diving the player\'s dungeon, this player the one to stand it, met behind the player (DIVER_STAND_M) as their allies by class, level and name, keeping with them (the motor\'s follow, DIVER_HEEL_M and a pace further each); one cut down fell; their hours done, the fated still standing spared, the survivors\' regard moved, the company gone; a peer\'s to stand, none; clear() forgets them (mutants: the election, the place, the follow, the fallen, the spared, the regard, the leaving)', async () => {
  assert.equal(DIVER_STAND_M, 5);
  assert.equal(DIVER_HEEL_M, 3);
  assert.equal(DIVER_HEEL_STEP_M, 1.2);
  const peer = diverRig({ owner: false });
  peer.divers.frame([company()], 1000);
  await settle();
  assert.equal(peer.spawned.length, 0, 'a peer\'s to stand');
  const rig = diverRig({ fated: (r) => r.id === 'L5.t6' });
  const c = company();
  rig.divers.frame([c], 1000);
  await settle();
  assert.equal(rig.spawned.length, 2);
  assert.match(rig.said[0], /You meet Ada Lark's company, come down into Mournoth\./);
  for (const [i, rec] of rig.spawned.entries()) {
    const m = c.members[i];
    assert.deepEqual([rec.mobileType, rec.o.level, rec.o.gender], [m.cls, m.level, m.sex]);
    assert.equal(rec.shipmate, true);
    assert.equal(rec.entity.name, m.name);
    assert.equal(rec.entity.team, 'PlayerAlly');
    assert.ok(rec.feet[2] < 10, 'behind the player (yaw 0 faces +z)');
    assert.ok(Math.abs(Math.hypot(rec.feet[0] - 10, rec.feet[2] - 10)) >= DIVER_STAND_M - 1e-9);
    assert.deepEqual(rec.ai.follow.feet(), [10, 0, 10], 'keeping with the player');
    assert.equal(rec.ai.follow.stop, DIVER_HEEL_M + i * DIVER_HEEL_STEP_M);
  }
  rig.divers.frame([c], 1001);
  await settle();
  assert.equal(rig.spawned.length, 2, 'met once');
  // the first cut down; their hours done: the fated second spared, regard moved, the company gone
  rig.spawned[0].dead = true;
  rig.divers.frame([c], 1500);
  assert.deepEqual(rig.rel.turns().died.get('L5.t2@K'), { t: 1500, seen: false, who: 'Ada Lark' }, 'cut down beside the player: died at their side, at that minute (AUDIT-C3)');
  rig.divers.frame([c], 2000);
  assert.ok(rig.rel.turns().spared.has('L5.t6@K'), 'the fated, standing: spared');
  assert.deepEqual([rig.rel.regard('L5.t6', 7), rig.rel.regard('L5.t2', 7)], [35, 0], 'saved - and nothing for the fallen');
  assert.deepEqual([...rig.pool], [rig.spawned[0]], 'the company gone to the surface - the one cut down the pool\'s own (AUDIT-C4)');
  assert.match(rig.said[rig.said.length - 1], /make for the surface/);
  assert.equal(rig.divers.size, 0);
  // a company the dive lists no longer goes; clear forgets every one
  const again = diverRig();
  again.divers.frame([company()], 1000);
  await settle();
  again.divers.frame([], 1100);
  assert.equal(again.pool.size, 0, 'no longer listed: gone');
  const cl = diverRig();
  cl.divers.frame([company()], 1000);
  await settle();
  cl.divers.clear();
  assert.equal(cl.pool.size, 0);
});

test('LW6 the streaming host: the dungeons dived (the game\'s own rows of a labyrinth, a keep, a ruin, a graveyard, with their dungeon\'s type), the trip world\'s dungeons, the deep\'s own foes for its trouble, the dungeon the player is in off its context, the divers met in the modal frame through the dungeon\'s own loose stand (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const LIVING_DIVE_TYPES = new Set\(\[LOCATION_TYPES\.DungeonLabyrinth, LOCATION_TYPES\.DungeonKeep, LOCATION_TYPES\.DungeonRuin, LOCATION_TYPES\.Graveyard\]\);/);
  assert.match(w, /blocks: 1, dungeon: true, dungeonType: md\.dungeonType \?\? 0 \};/);
  assert.match(w, /dungeonsNear: livingDungeonsNear,/);
  assert.match(w, /foesOf: \(\{ climateIndex, dungeonType, minute, level, size, rolls \}\) => \(dungeonType != null\n\s*\? Array\.from\(\{ length: size \}, \(\) => chooseRandomEnemy\(\{ dungeonType, playerLevel: level \}, rolls\)\)\.filter\(\(m\) => m >= 0\)/, 'a dive\'s trouble: the deep\'s own');
  assert.match(w, /const loc = modes\?\.dungeonCtx\?\.abyss\?\.location\?\.\(\);/);   // LW-FIX1: the summary is the abyss seam's - the context has no `location` of its own
  assert.ok(!/dungeonCtx\?\.location\?\.\(\)/.test(w), 'never a dungeon location the context does not carry');
  assert.match(rd('src/scenes/dungeonContext.js'), /\n    abyss: \{\n      location: \(\) => \(\{ regionIndex: dfLocation\.regionIndex \?\? -1, locationIndex: dfLocation\.locationIndex \?\? -1 \}\),/, 'the context carries it there');
  assert.match(w, /spawn: \(type, feet, o\) => d\.spawnLooseFoe\(type, feet, \{ yawRad: o\.yaw, allied: true, gender: o\.gender, level: o\.level \}\),/);
  assert.match(w, /livingDiversStep\(now\);   \/\/ LW6: underground, the companies diving here met/);
  assert.match(w, /_livingDiversList = here \? diversAt\(here, skyMinutes\(\), livingTripWorld,/);
});
