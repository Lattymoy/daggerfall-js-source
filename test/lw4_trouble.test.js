// LW4 (2026-10-04, bible/06-Systems/Living-World.md, Mac: NPCs "can encounter enemies in the overworld"): TROUBLE ON
// THE ROAD - the lives (who holds a traveller's place: the dead, the empty places, the newcomers), the trouble a party
// meets (its foes, its end, the halt, the turn home), what the towns see of it (the away windows, the visitors, the
// news, the fallen on the road), the character's own turns of fate, and the seams that carry them - on the synthetic
// map (test/lwRoads.mjs). No game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthMap, livingMap, partiesOver } from './lwRoads.mjs';
import { synthTown } from './lwTown.mjs';
import { HAZARD, VACANT_CYCLES, fateHits, deathCounted, placeAt, placeKeyOf, turnKey } from '../src/systems/livingWorld/lives.js';
import { troubleOf, troubledTrip, strengthOf, foeStrength, RISK_PER_DAY, GROUND_RISK, RISK_MAX, CAMP_SHARE, HALT_MIN, FIGHT_MIN, FOES_MAX } from '../src/systems/livingWorld/trouble.js';
import {
  townTrips, ownTrip, formCaravans, partyAt, membersAt, awayOf, visitorsOf, newsOf, remainsNear, placeCycle, setsOut, contractOf, cycleOf, wayAt as wayAtOf0,
  walkedMinutes, whenWalked, CALENDAR_MPM, HALT_CATCH_UP, NEWS_DAYS, REMAINS_MIN, TRIP_PACE, TRIP_CHANCE,
} from '../src/systems/livingWorld/trips.js';
import { mintResident, travellerRoster } from '../src/systems/livingWorld/census.js';
import { createRelations, TURN_KINDS, TURNS_MAX } from '../src/systems/livingWorld/relations.js';
import { ROAD_NEWS, NEWS_SHARE, newsScript, foeWord, fillLine } from '../src/systems/livingWorld/lines.js';
import { circleLine } from '../src/systems/livingWorld/meetups.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { lwRoll, lwRng, lwSeed } from '../src/systems/livingWorld/seed.js';
import { seededRng } from '../src/systems/wind.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { createLivingRoads, fightPlaces, foePlaces, corpseLook, partyLabel, FIGHT_RING_N, FOE_RING_N, STRIKE_S } from '../src/scenes/livingRoads.js';
import { createTravellerSprites } from '../src/world/travellerSprites.js';
import { rollGroupComposition } from '../src/systems/campEncounters.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const wayAtOf = (trip, s) => wayAtOf0(trip.way, s);
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });

/** A traveller place with a counted death at some cycle, and the cycles around it. */
function aDeath(job = 'merchant') {
  const { towns, world } = synthMap();
  for (const town of towns) for (const res of world.rosterOf(town)) {
    if (res.job !== job) continue;
    for (let k = 10; k < 400; k++) if (deathCounted(res, k)) return { town, res, k, world };
  }
  throw new Error('no death found');
}

test('LW4 the lives: a place\'s fate rolls once a cycle against its job\'s HAZARD; a death is counted unless another roll fell in the VACANT_CYCLES before; the place stands empty those cycles after, then a newcomer holds it (the census\'s mint with the death\'s cycle: its own name, `~cycle` on the id) - read back to the world\'s first cycle, never through a window; the same for every reader (mutants: the hazard, the vacancy, the newcomer, the window)', () => {
  assert.deepEqual({ ...HAZARD }, { merchant: 0.006, mercenary: 0.01, adventurer: 0.012, pilgrim: 0.006, courier: 0.004, pedlar: 0.004 });
  assert.equal(VACANT_CYCLES, 3);
  const { town, res, k } = aDeath();
  assert.equal(fateHits(res, k), lwRoll(res.town, res.slot, k, 0x46415445) < HAZARD.merchant, 'the slot\'s own dice');
  for (let j = k - VACANT_CYCLES; j < k; j++) assert.equal(fateHits(res, j), false, 'none in the cycles before a counted death');
  const at = placeAt(res, k);
  assert.equal(at.dies, true, 'the holder dies that cycle');
  assert.equal(at.vacant, false);
  for (let j = 1; j <= VACANT_CYCLES; j++) assert.deepEqual(placeAt(res, k + j).vacant, true, `empty ${j} cycle(s) after`);
  const next = placeAt(res, k + VACANT_CYCLES + 1);
  if (!next.vacant) {
    assert.equal(next.holder, k, 'held by the newcomer the death made room for');
    const nu = mintResident(town, 't', res.slot, res.job, { gen: k });
    assert.equal(nu.id, `${res.id}~${k}`);
    assert.notEqual(nu.name, res.name, 'a new name');
    assert.equal(placeKeyOf(nu), res.id, 'the same place');
    assert.deepEqual(mintResident(town, 't', res.slot, res.job, { gen: k }), nu, 'and the same newcomer for every reader');
  }
  // never through a window: a death long ago still holds the place for its newcomer, a hundred cycles and more on
  const { towns: T1, world: W1 } = synthMap();
  let long = null;
  for (const t of T1) { for (const r of W1.rosterOf(t)) { if (r.job !== 'merchant') continue; for (let d = 10; d < 300 && !long; d++) { if (!deathCounted(r, d)) continue; let clear = true; for (let j = d + 1; j <= d + 150; j++) if (deathCounted(r, j)) { clear = false; break; } if (clear) long = { r, d }; else break; } if (long) break; } if (long) break; }
  assert.ok(long, 'a place quiet a hundred and fifty cycles after a death');
  assert.equal(placeAt(long.r, long.d + 150).holder, long.d, 'the newcomer still, 150 cycles on');
  // a roll under the hazard with another in the cycles before it is never counted: nobody is there to die
  const { towns: T2, world: W2 } = synthMap();
  let blocked = null;
  for (const t of T2) { for (const r of W2.rosterOf(t)) { if (!HAZARD[r.job]) continue; for (let j = VACANT_CYCLES; j < 2000 && !blocked; j++) { if (!fateHits(r, j)) continue; for (let i = j - VACANT_CYCLES; i < j; i++) if (fateHits(r, i)) { blocked = { r, j }; break; } } if (blocked) break; } if (blocked) break; }
  assert.ok(blocked, 'two rolls close together somewhere');
  assert.equal(deathCounted(blocked.r, blocked.j), false, 'the second, in the empty place, is no death');
  const fresh = mintResident(town, 't', res.slot, res.job, { gen: 99 });
  assert.notEqual(fresh.name, res.name, 'a newcomer\'s own name');
  assert.equal(fresh.id, `${res.id}~99`);
  const sailor = { id: 'L1.t0', town: 1, slot: 0, job: 'sailor' };
  for (let j = 0; j < 300; j++) assert.equal(fateHits(sailor, j), false, 'the sea is LW5\'s: no road hazard for a sailor');
  // the rate, over the world's places: a town of a dozen travellers loses one a season or so
  const { towns, world } = synthMap();
  let deaths = 0, cycles = 0;
  for (const t of towns) for (const r of world.rosterOf(t)) { if (r.job !== 'merchant') continue; for (let j = 0; j < 200; j++) { cycles++; if (deathCounted(r, j)) deaths++; } }
  assert.ok(deaths / cycles > 0.003 && deaths / cycles < 0.008, `a merchant's deaths a cycle (${(deaths / cycles).toFixed(4)})`);
});

test('LW4 the character\'s turns of fate: a fate SPARED is no death, one FALLEN is - keyed by the place and the cycle (a newcomer\'s place is its census\'s); the record keeps them by kind, the newest TURNS_MAX, rides the save beside the regards, and a record with none reads as before (mutants: the spare, the fall, the key, the trim)', () => {
  const { res, k } = aDeath();
  const spared = new Set([turnKey(res, k)]);
  assert.equal(fateHits(res, k, { spared }), false, 'spared: the death that cycle never comes');
  assert.equal(placeAt(res, k + 1, { spared }).vacant, false, 'and the place is never empty');
  const quiet = (() => { for (let j = 5; j < 300; j++) if (!fateHits(res, j) && !fateHits(res, j - 1) && !fateHits(res, j - 2) && !fateHits(res, j - 3)) return j; return -1; })();
  const fallen = new Set([turnKey({ id: `${res.id}~7` }, quiet)]);
  assert.equal(fateHits(res, quiet, { fallen }), true, 'fallen beside the player: a death, the newcomer\'s key read as its place\'s');
  assert.equal(placeAt(res, quiet + 1, { fallen }).vacant, true);
  assert.equal(placeKeyOf({ id: 'L12.t3~45' }), 'L12.t3');
  assert.deepEqual([...TURN_KINDS], ['spared', 'fallen', 'won', 'lost']);
  const rel = createRelations();
  assert.equal(rel.turnsVersion(), 0);
  assert.equal(rel.turn('spared', 'L1.t2@40'), true);
  assert.equal(rel.turn('spared', 'L1.t2@40'), false, 'once');
  assert.equal(rel.turn('won', 'L1.t2:40:e'), true);
  assert.equal(rel.turnsVersion(), 2);
  assert.deepEqual(createRelations().snapshot(), { v: 1, people: {} }, 'none made: the record as it was');
  const back = createRelations(rel.snapshot());
  assert.deepEqual([...back.turns().spared], ['L1.t2@40']);
  assert.deepEqual([...back.turns().won], ['L1.t2:40:e']);
  for (let i = 0; i < TURNS_MAX + 5; i++) rel.turn('lost', `e${i}`);
  assert.equal(rel.turns().lost.size, TURNS_MAX);
  assert.ok(!rel.turns().lost.has('e0') && rel.turns().lost.has(`e${TURNS_MAX + 4}`), 'the oldest leave first');
});

test('LW4 trouble on the road: at most one encounter a trip, its chance the walk\'s days weighed by the ground (a road the safest, open country the worst) to RISK_MAX; a party carrying a fated death always meets it; the foes the land\'s own (the climate\'s group at the place, at the party\'s level, sized to it); the end the party\'s strength against the foes\', or the lives\' (the leader among the fated: fell; else won at that cost); the same for every reader (mutants: the ground, the fated, the strength, the size)', () => {
  assert.equal(RISK_PER_DAY, 0.09);
  assert.deepEqual({ ...GROUND_RISK }, { road: 0.6, track: 0.9, open: 1.4 });
  assert.equal(RISK_MAX, 0.55);
  assert.equal(FOES_MAX, 6);
  assert.deepEqual({ ...HALT_MIN }, { driven: 25, won: 60, fled: 15, fell: 45 });
  assert.deepEqual({ ...FIGHT_MIN }, { driven: 10, won: 25, fled: 8, fell: 20 });
  assert.ok(strengthOf({ cls: 140, level: 10 }) > strengthOf({ job: 'merchant' }) && strengthOf({ job: 'merchant' }) > strengthOf({ job: 'pedlar' }));
  assert.ok(foeStrength(12) > foeStrength(2));
  const map = livingMap();
  const all = partiesOver(map, 400, 460);
  const hit = all.filter((t) => t.enc);
  const share = hit.length / all.length;
  assert.ok(share > 0.08 && share < 0.3, `a share of the trips meet trouble (${(share * 100).toFixed(1)}%)`);
  for (const t of hit.slice(0, 200)) {
    assert.ok(t.enc.foes.length <= FOES_MAX);
    assert.ok(['driven', 'won', 'fled', 'fell'].includes(t.enc.kind));
    assert.equal(t.enc.t1 - t.enc.t0, HALT_MIN[t.enc.kind]);
    assert.equal(t.enc.fightEnd - t.enc.t0, FIGHT_MIN[t.enc.kind]);
    if (t.enc.dead.length) assert.equal(t.enc.kind, t.enc.dead.includes(t.leader.id) ? 'fell' : 'won', 'a fated end is the lives\'');
  }
  // the ground: the same trips on roads and on open country
  const sample = all.filter((t) => !t.enc && t.party.every((m) => !map.trouble.dies(m, t))).slice(0, 400);
  const on = (kind) => sample.filter((t) => troubleOf({ ...t, way: { ...t.way, kinds: t.way.kinds.map(() => kind) } }, map.trouble)).length;
  assert.ok(on('road') < on('open'), `roads the safer (${on('road')} beset on the road, ${on('open')} across country)`);
  // the fated always meet it
  const fated = all.filter((t) => t.party.some((m) => map.trouble.dies(m, t)));
  assert.ok(fated.length > 0, 'some fated party in the run');
  for (const t of fated) assert.ok(t.enc && t.enc.dead.length, `${t.id}: the road keeps its appointment`);
  // the strength: an armed party beats a lone traveller on the same road
  const lone = sample.find((t) => t.party.length === 1 && t.party[0].cls == null);
  if (lone) {
    const calm = { ...map.trouble, dies: () => false };
    const ends = (party) => { const out = { won: 0, lost: 0 }; for (let i = 0; i < 120; i++) { const e = troubleOf({ ...lone, id: `${lone.id}#${i}`, party, way: { ...lone.way, kinds: lone.way.kinds.map(() => 'open') } }, calm); if (e) out[e.kind === 'fled' ? 'lost' : 'won']++; } return out; };
    const weak = ends(lone.party), strong = ends([0, 1, 2, 3].map((i) => ({ ...lone.party[0], id: `x${i}`, cls: 140, level: 20 })));
    const share = (x) => x.won / Math.max(1, x.won + x.lost);
    assert.ok(share(strong) > 0.65, `four armed veterans hold the road (${JSON.stringify(strong)})`);
    assert.ok(share(weak) < 0.4, `a lone pedlar mostly runs (${JSON.stringify(weak)})`);
  }
  // the character's own turn: a fight won for the party is won; one lost with it, fled
  const fled = hit.find((t) => t.enc.kind === 'fled' && !t.enc.dead.length);
  const won = hit.find((t) => (t.enc.kind === 'won' || t.enc.kind === 'driven') && !t.enc.dead.length);
  assert.ok(fled && won, 'a party that fled and one that won');
  const turnedWorld = (kind, id) => ({ ...map.trouble, turnOf: (x) => (x === id ? kind : null) });
  assert.equal(troubleOf(fled, turnedWorld('won', `${fled.id}:e`)).kind, 'won', 'a fight the player won for the party is won');
  assert.equal(troubleOf(won, turnedWorld('lost', `${won.id}:e`)).kind, 'fled', 'one they lost with it, fled');
  assert.equal(troubleOf(won, turnedWorld('lost', 'another:e')).kind, won.enc.kind, 'another encounter\'s turn is not this one\'s');
  // the same for every reader
  const again = partiesOver(livingMap(), 430, 431).filter((t) => t.enc);
  const firstRun = new Map(all.map((t) => [t.id, t]));
  for (const t of again) assert.deepEqual(t.enc, firstRun.get(t.id)?.enc ?? t.enc, `${t.id}: one trouble for every reader`);
});

test('LW4 where the trouble falls: a seeded stretch of the way out or home - or, a leg its first day does not finish, now and then at that night\'s camp at eleven (CAMP_SHARE); held there its halt (the fight its first minutes), then on at HALT_CATCH_UP again its pace, never faster, with no jump; a party that fled or fell on the way out TURNED home from where it stood once the halt was done - never at its town; the fallen out of the party from the fight\'s middle (mutants: the camp, the halt, the catch-up, the turn, the fall)', () => {
  assert.equal(CAMP_SHARE, 0.3);
  assert.equal(HALT_CATCH_UP, 0.5);
  const map = livingMap();
  const hit = partiesOver(map, 400, 470).filter((t) => t.enc);
  const camps = hit.filter((t) => t.enc.camp);
  assert.ok(camps.length > 0, 'a camp beset');
  for (const t of camps) assert.equal(((t.enc.t0 % DAY_MIN) + DAY_MIN) % DAY_MIN, 23 * 60, 'at eleven');
  let checked = 0;
  for (const t of hit.slice(0, 300)) {
    const e = t.enc;
    const mid = partyAt(t, e.t0 + 1);
    assert.equal(mid.halt, true);
    assert.equal(mid.fight, true, 'the fight first');
    assert.ok(Math.abs(mid.s - e.s) < 1e-6, 'held where it fell');
    assert.equal(partyAt(t, e.fightEnd + 1).fight, false, 'then the wounds bound');
    // no jump, and never faster than the hurry
    const fast = t.pace * (1 + HALT_CATCH_UP) * 5 + 1;
    let prev = null;
    for (let m = t.outT0; m < t.backT1; m += 5) {
      const at = partyAt(t, m);
      if ((at.phase === 'out' || at.phase === 'back') && prev && (prev.phase === 'out' || prev.phase === 'back')) {
        assert.ok(Math.hypot(at.x - prev.x, at.z - prev.z) <= fast, `${t.id}: a step at ${m - e.t0} past the trouble within the hurry`);
        checked++;
      }
      prev = at;
    }
    if (t.turned) {
      assert.equal(e.leg, 'out');
      assert.ok(e.kind === 'fled' || e.kind === 'fell');
      assert.equal(t.outT1, e.t0, 'it never came to its town');
      assert.equal(t.backT0, e.t1, 'home from the halt\'s end');
      assert.equal(t.backT1, whenWalked(e.t1, Math.max(0, e.s - t.trim0) / t.pace), 'the walk home from where it stood');
      const after = partyAt(t, e.t1 + 30);
      if (after.phase === 'back') assert.ok(after.s <= e.s, 'walking home from where it stood');
    } else if (e.leg === 'out') assert.ok(!(e.kind === 'fled' || e.kind === 'fell'), 'only a party that won goes on');
    for (const f of t.fallen) {
      assert.equal(f.t, e.t0 + FIGHT_MIN[e.kind] * 0.6, 'falls in the fight\'s middle');
      assert.ok(membersAt(t, f.t - 1).includes(f.res) && !membersAt(t, f.t + 1).includes(f.res), 'out of the party from then');
    }
  }
  assert.ok(checked > 1000, `steps read (${checked})`);
  // the catch-up's own law on one trip: the lag shrinks at the hurry's rate from the halt's end
  const won = hit.find((t) => !t.turned && t.enc.leg === 'out' && !t.enc.camp && walkedMinutes(t.enc.t0, t.enc.t1) > 0);
  if (won) {
    const plain = { ...won, halt: undefined };
    const owed = won.pace * walkedMinutes(won.enc.t0, won.enc.t1);
    const m = won.enc.t1 + 20;
    if (m < won.outT1) {
      const lag = partyAt(plain, m).s - partyAt(won, m).s;
      assert.ok(Math.abs(lag - Math.max(0, owed - HALT_CATCH_UP * won.pace * walkedMinutes(won.enc.t1, m))) < 1e-6, 'owed less the hurry made up');
    }
  }
});

test('LW4 the towns see the trouble: a turned party never visits; one fallen on the way never arrives; the fallen never walk home (their away window open the cycle); a place standing empty sets out on no trip; a fated holder sets out whatever the cycle\'s chance said (the road keeps its appointment) - a sellsword with its contract merchant whatever the hire (mutants: the turned visit, the fallen visitor, the fallen home, the empty place, the fated going)', () => {
  const map = livingMap();
  const o = O();
  const all = partiesOver(map, 400, 470, o);
  const turned = all.filter((t) => t.turned);
  assert.ok(turned.length > 0, 'some party turned home');
  for (const t of turned.slice(0, 40)) {
    const day = Math.floor((t.enc.t0 - 240) / DAY_MIN);
    for (let d = day; d <= day + 3; d++) assert.ok(!visitorsOf(t.to, d, map.world, o).some((v) => v.trip.id === t.id), `${t.id}: never at ${t.to.name}`);
  }
  const fellOut = all.find((t) => t.fallen?.length && !t.turned && t.enc.leg === 'out');
  if (fellOut) {
    const day = Math.floor((fellOut.outT1 - 240) / DAY_MIN);
    const vis = visitorsOf(fellOut.to, day, map.world, o).filter((v) => v.trip.id === fellOut.id).map((v) => v.res.id);
    for (const f of fellOut.fallen) assert.ok(!vis.includes(f.res.id), 'the fallen never arrive');
  }
  const withFallen = all.find((t) => t.fallen?.length);
  assert.ok(withFallen, 'someone fell in the run');
  const w = awayOf(withFallen.fallen[0].res, [withFallen]);
  assert.equal(w[0].t1, Infinity, 'the road kept them');
  // an empty place: no trip; a fated one: always a trip, whatever its chance said (ownTrip's roll set aside)
  const lm = livingMap();
  let shown = 0;
  for (const town of lm.towns) {
    for (const place of lm.world.rosterOf(town)) {
      const chance = TRIP_CHANCE[place.job];
      if (!(chance > 0)) continue;
      for (let k = 40; k < 140; k++) {
        if (!lm.world.fated(place, k) || !lm.world.holderOf(place, k)) continue;
        const holder = lm.world.holderOf(place, k);
        if (lwRng(holder.town, holder.slot, k, 0x74726970)() < chance) continue;   // its chance would have sent it anyway
        const own = ownTrip(holder, town, k, { ...lm.world, fated: () => false }, O());
        const forced = ownTrip(holder, town, k, lm.world, O());
        assert.equal(own, null, 'its own chance said stay');
        assert.ok(forced, `${holder.id}@${k}: the road keeps its appointment all the same`);
        assert.equal(lm.world.holderOf(place, k + 1), null, 'and the place stands empty after');
        shown++;
      }
    }
  }
  assert.ok(shown > 0, 'a fated holder whose chance said stay');
  // a sellsword's place lives by its contract merchant's cycle, sets out with that merchant's trip, and goes when fated
  const big = lm.towns.find((t) => lm.world.rosterOf(t).filter((r) => r.job === 'mercenary').length >= 1 && lm.world.rosterOf(t).some((r) => r.job === 'merchant'));
  const br = lm.world.rosterOf(big);
  const sword = br.find((r) => r.job === 'mercenary');
  const boss = contractOf(sword, br);
  assert.equal(placeCycle(sword, br, 450, 1), cycleOf(boss, 450, 1).k, 'a sellsword\'s cycle is its merchant\'s');
  for (let k = 40; k < 80; k++) {
    const mh = lm.world.holderOf(boss, k);
    const mt = mh ? ownTrip(mh, big, k, lm.world, O()) : null;
    assert.equal(setsOut(sword, big, k, lm.world, O()), !!mt, `cycle ${k}: the sellsword sets out exactly when its merchant does`);
  }
  const want = (outT0) => (seededRng(lwSeed(boss.town, boss.slot, outT0 | 0, 0x68697265))() * 4) | 0;
  let outT0 = 100 * DAY_MIN + 480;
  while (want(outT0) !== 0) outT0++;
  const mk = (leader, t0) => ({ id: `${leader.id}:9`, k: 9, kind: 'merchant', leader, party: [leader], from: big, to: { mapId: 2, name: 'T' }, way: { pts: [], cum: [], len: 0, kinds: [] }, pace: 1, outT0: t0, outT1: t0 + 10, backT0: t0 + 20, backT1: t0 + 30, trim0: 0, trim1: 0 });
  const trip = mk(boss, outT0);
  const none = formCaravans(big, [trip], br, () => null, 1, (r) => r, () => false)[0];
  const gone = formCaravans(big, [trip], br, () => null, 1, (r) => r, (r) => r.slot === sword.slot)[0];
  assert.ok(!none.party.some((p) => p.slot === sword.slot), 'its merchant hired none this time');
  assert.ok(gone.party.some((p) => p.slot === sword.slot), 'the fated sellsword goes with the train all the same');
  // the fallen lie a day where they fell
  const lying = all.find((t) => t.fallen?.length);
  const f = lying.fallen[0];
  const at = wayAtOf(lying, f.s);
  const px = Math.floor(at.x / 32768), py = 499 - Math.floor(at.z / 32768);
  const near = (m) => remainsNear(px, py, m, map.world, o, 2).remains.some((r) => r.res.id === f.res.id);
  assert.equal(near(f.t - 1), false, 'not before they fell');
  assert.equal(near(f.t + 1), true, 'where they fell');
  assert.equal(near(f.t + REMAINS_MIN - 1), true, 'a day');
  assert.equal(near(f.t + REMAINS_MIN + 1), false, 'and no longer');
});

test('LW4 what the town says: its own parties\' troubles, known from when they were home (none home: when they were due), for NEWS_DAYS, newest first - the fallen first named; a town meeting tells one NEWS_SHARE of the time, the news\'s own script by its end with `{who}`, `{foe}`, `{place}` filled; never on the road; a foe\'s word, many or one (mutants: the knowing, the days, the share, the tokens, the road, the plurals)', () => {
  assert.equal(NEWS_DAYS, 3);
  assert.equal(NEWS_SHARE, 0.4);
  assert.deepEqual(Object.keys(ROAD_NEWS), ['driven', 'won', 'fled', 'fell']);
  const base = { leader: { name: 'Ada Lark' }, to: { name: 'Far' }, party: [] };
  const trips = [
    { ...base, id: 'a', enc: { kind: 'won', foes: [7] }, fallen: [], backT1: 1000 },
    { ...base, id: 'b', enc: { kind: 'won', foes: [9] }, fallen: [{ res: { name: 'Bo Reed' } }], backT1: 2000 },
    { ...base, id: 'c', enc: { kind: 'driven', foes: [] }, fallen: [], backT1: 9000 },
    { ...base, id: 'd', enc: null, fallen: [], backT1: 1500 },
  ];
  const n = newsOf(trips, 2500);
  assert.deepEqual(n.map((x) => x.id), ['b', 'a'], 'known when home, newest first, none not yet home, none with no trouble');
  assert.deepEqual([n[0].kind, n[0].who, n[0].foe, n[0].place], ['fell', 'Bo Reed', 9, 'Far'], 'the fallen first named');
  assert.deepEqual(newsOf(trips, 1000 + NEWS_DAYS * DAY_MIN + 1).map((x) => x.id), ['c', 'b'].filter((id) => id !== 'c' || 9000 <= 1000 + NEWS_DAYS * DAY_MIN + 1), 'forgotten after NEWS_DAYS');
  const news = [{ kind: 'fell', who: 'Bo Reed', foe: 'Orcs', place: 'Far' }];
  let told = 0;
  for (let seed = 0; seed < 2000; seed++) if (newsScript(seed, news)) told++;
  assert.ok(Math.abs(told / 2000 - NEWS_SHARE) < 0.04, `told ${told} of 2000`);
  assert.equal(newsScript(1, []), null);
  let seed = 0;
  while (!newsScript(seed, news)) seed++;
  const s = newsScript(seed, news);
  assert.ok(ROAD_NEWS.fell.includes(s.script));
  const members = [{ id: 'm1', name: 'Cal Ash', job: 'smith' }, { id: 'm2', name: 'Dee Oak', job: 'baker' }];
  const circle = { members, seed, start: 0, end: 100, talks: true, index: 0 };
  const line = circleLine(circle, 0, 2, { news, town: 'Here' });
  assert.equal(line.text, fillLine(s.script[0], { who: 'Bo', foe: 'Orcs', place: 'Far', a: 'Cal', b: 'Dee', town: 'Here' }), 'the news\'s first line, its tokens filled');
  const road = circleLine(circle, 0, 2, { news, road: 'walk' });
  assert.ok(!Object.values(ROAD_NEWS).flat().some((sc) => fillLine(sc[0], { who: 'Bo', foe: 'Orcs', place: 'Far', a: 'Cal', b: 'Dee' }) === road?.text), 'a party on the road tells none');
  assert.deepEqual(['Orc', 'Harpy', 'Werewolf', 'Frost Daedra', 'Lich'].map((x) => foeWord(x, 3)), ['Orcs', 'Harpies', 'Werewolves', 'Frost Daedra', 'Liches']);
  assert.deepEqual([foeWord('Imp', 1), foeWord('Giant', 1)], ['an Imp', 'a Giant']);
});

test('LW4 the town reads the lives: each traveller\'s place as its holder that day - the census\'s own resident while it holds it, a newcomer lodged at the place\'s home, nobody while it stands empty - and its meetings take the day\'s news (mutants: the holder, the home, the empty place, the news)', () => {
  const { nav, buildings, doors } = synthTown();
  const TOWN = { mapId: 12345, blocks: 9, region: 17, people: 3, port: false };
  let roads = null;
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => 5 * DAY_MIN + 720, rate: () => 0.2, mpm: CALENDAR_MPM, tripsOf: () => roads,
  });
  const travellers = town.residents.filter((r) => r.roll === 't');
  assert.ok(travellers.length >= 3, 'travellers in the census');
  const [a, b, c] = travellers;
  const nu = { ...mintResident(TOWN, 't', b.slot, b.job, { gen: 77 }) };
  roads = { away: new Map(), visitors: [], holders: new Map([[a.id, null], [b.id, nu], [c.id, c]]), news: [{ kind: 'won', who: 'Bo Reed', foe: 'Orcs', place: 'Far' }] };
  const people = town.peopleOf(5);
  assert.ok(!people.some((p) => p.id === a.id), 'an empty place: nobody');
  const held = people.find((p) => p.id === nu.id);
  assert.ok(held && held.home === b.home, 'a newcomer, lodged where the place is');
  assert.ok(people.includes(c), 'the census\'s own resident while they hold it');
  assert.equal(town.peopleOf(5), people, 'kept for the day');
  assert.deepEqual(town._roads.news, roads.news, 'the day\'s news for the meetings');
  assert.match(rd('src/systems/livingWorld/livingTown.js'), /const ctx = \{ town: this\.o\.townName, region: this\.o\.regionName, weather: this\.o\.weather\?\.\(\) \?\? null, hour, news: this\._roads\?\.news \?\? null \};/);
});

test('LW4 the road shows its trouble: a beset party in its ring FIGHT_RING_N facing out (the unarmed within), its foes at FOE_RING_N facing in - no talk targets - each fighter striking on its own STRIKE_S beat; no word from a fighter; the fallen lie a day where they fell on their class corpse\'s picture; the Overworld\'s mark `wayfarer fight`, "beset by" what besets it; the sprites strike, keep foes out of the talk, draw the fallen still (mutants: the rings, the foes\' talk, the beat, the corpse, the mark)', () => {
  assert.equal(FIGHT_RING_N, 64);
  assert.equal(FOE_RING_N, 190);
  assert.equal(STRIKE_S, 1.3);
  assert.equal(REMAINS_MIN, DAY_MIN);
  for (let c = 128; c <= 145; c++) assert.deepEqual(corpseLook(), ENEMY_BASICS[c].corpseTexture, 'the human corpse, every class\'s own');
  const trip = { id: 'L1.t1:5', kind: 'merchant', to: { name: 'Far' }, party: [{ id: 'm', cls: null }, { id: 's', cls: 140 }], enc: { id: 'L1.t1:5:e', foes: [7, 7, 7] } };
  const at = { x: 1000, z: 2000 };
  const ring = fightPlaces(trip, at, trip.party);
  const armed = ring.find((p) => p.res.id === 's'), plain = ring.find((p) => p.res.id === 'm');
  assert.ok(Math.abs(Math.hypot(armed.x - at.x, armed.z - at.z) - FIGHT_RING_N) < 1e-6, 'the armed on the ring');
  assert.ok(Math.hypot(plain.x - at.x, plain.z - at.z) < FIGHT_RING_N * 0.6, 'the unarmed within');
  assert.ok(Math.abs(armed.yaw - Math.atan2(armed.x - at.x, armed.z - at.z)) < 1e-9, 'facing out');
  const foes = foePlaces(trip, at);
  assert.equal(foes.length, 3);
  for (const f of foes) {
    assert.ok(Math.abs(Math.hypot(f.x - at.x, f.z - at.z) - FOE_RING_N) < 1e-6);
    assert.ok(Math.abs(f.yaw - Math.atan2(at.x - f.x, at.z - f.z)) < 1e-9, 'facing in');
    assert.equal(f.res.cls, 7, 'its own kind');
  }
  assert.equal(partyLabel(trip, '', 'Orcs'), 'Caravan beset by Orcs');
  // the layer, on the synthetic map, at a party's fight
  const map = livingMap();
  const o = O();
  const beset = partiesOver(map, 400, 470, o).find((t) => t.enc && !t.enc.camp && t.party.length > 1 && t.enc.foes.length);
  assert.ok(beset, 'a party beset by day');
  const m = beset.enc.t0 + 2;
  const atM = partyAt(beset, m);
  const synced = [];
  const sprites = { sync: (list) => { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); }, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => m, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: atM.x, z: atM.z }),
    sprites, memo: o.memo, foeName: (type, n) => foeWord(ENEMY_BASICS[type]?.name ?? 'Foe', n) });
  roads.frame(0.1, [0, 0, 0]);
  const foeBodies = synced.filter((x) => x.key.startsWith(beset.enc.id));
  assert.equal(foeBodies.length, beset.enc.foes.length, 'its foes stood');
  assert.ok(foeBodies.every((x) => x.talk === false), 'no talk target');
  const mark = roads.marks().find((k) => k.key === `party:${beset.id}`);
  assert.ok(/ fight$/.test(mark.kind) && /beset by/.test(mark.label), `the mark says so: ${mark.kind} / ${mark.label}`);
  // the beat: a fighter strikes again STRIKE_S on, not every frame
  let strikes = 0;
  for (let i = 0; i < 40; i++) { roads.frame(0.1, [0, 0, 0]); strikes += synced.filter((x) => x.key === foeBodies[0].key && x.striking).length; }
  assert.ok(strikes >= 2 && strikes <= 4, `about one strike in STRIKE_S over four seconds (${strikes})`);
  // the sprites: a strike is the unit's, a foe no talk target, the fallen still
  const updates = [];
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = { textures: new Map(), createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {} };
  const sp = createTravellerSprites({ renderer, getTexture: async () => tex, uploadRecordFrame() {} });
  const foe = { key: 'f', res: { id: 'f', cls: 7, sex: 'male' }, feet: [0, 0, 0], yaw: 0, moving: false, distM: 5, striking: true, talk: false };
  const dead = { key: 'd', res: { id: 'd', cls: 140 }, feet: [1, 0, 0], yaw: 0, moving: false, distM: 5, talk: false, flat: corpseLook() };
  return (async () => {
    sp.sync([foe, dead]);
    await new Promise((r) => setTimeout(r, 0));
    sp.sync([foe, dead]);
    const fb = sp.bodyOf('f');
    fb.unit.update = (dt, st) => { updates.push(st); return { record: 0, frame: 0, flip: false }; };
    sp.sync([foe, dead]);
    assert.equal(updates[0].striking, true, 'the strike handed to the unit');
    assert.equal(sp.persons().length, 0, 'neither a foe nor the fallen is a talk target');
    assert.equal(sp.bodyOf('d').flat.record, corpseLook().record, 'the fallen on the corpse\'s record');
  })();
});

test('LW4 the streaming host: the trouble\'s world (the climate at the place, the campers\' themed group at the party\'s level, a class foe at the party\'s, the lives at each member\'s own cycle, the character\'s won and lost); the trip world\'s holders, fates and trouble through books made again at each turn of fate; the town\'s holders, away windows by the holder and news; the foe\'s word on the marks; a beset party\'s mark in the bands\' red (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /: rollGroupComposition\(\{ climateIndex, skyMinutes: minute, inLocationRect: false, playerLevel: level, size \}, rolls\)\?\.mobileTypes \?\? null\),/, 'on the land, the campers\' themed group');
  assert.match(w, /foeLevel: \(type, level\) => \(type >= 128 \? level : ENEMY_BASICS\[type\]\?\.level \?\? level\),/);
  assert.match(w, /return livingPlaceOf\(place, placeCycle\(place, roster, Math\.floor\(trip\.outT0 \/ 1440\), livingScale\(\)\)\);/, 'each member at their own place\'s cycle (livingTripPlace)');
  assert.match(w, /dies: \(res, trip\) => \{ const pl = livingTripPlace\(res, trip\); return pl\.dies && pl\.hand == null; \},/, 'LW7: one a hand took first the trouble never takes');
  assert.match(w, /diced: \(res, trip\) => livingTripPlace\(res, trip\)\.diced,/, 'AUDIT-B1: the trouble\'s shape the dice\'s own');
  assert.match(w, /turnOf: \(id\) => \{ const t = livingRelations\.turns\(\); return t\.won\.has\(id\) \? 'won' : t\.lost\.has\(id\) \? 'lost' : null; \},/);
  assert.match(w, /livingTripWorld\.holderOf = \(res, k\) => livingPlaceOf\(res, k\)\.holder;\n\s*livingTripWorld\.fated = \(res, k\) => livingPlaceOf\(res, k\)\.diced;/, 'AUDIT-B1: a fated trip the dice\'s - a spare never takes it away');
  assert.match(w, /if \(!f\) \{\n\s*f = troubledTrip\(trip, troubleOf\(trip, livingTroubleWorld\)\);/);
  assert.match(w, /const holder = pl\.vacant \? null : pl\.holder == null \? res\n\s*: \(town \? mintResident\(town, res\.roll \?\? 't', res\.slot, res\.job, \{ gen: pl\.holder, home: res\.home, work: res\.work, faction: res\.faction \}\) : res\);/, 'LW7: a townsperson\'s newcomer the census\'s own mint too');
  assert.match(w, /_livingPlaces\.clear\(\); _livingFates\.clear\(\); _livingTripMemo\.clear\(\);/, 'a turn of fate, or a load: the books made again');
  assert.match(w, /livingTurnsFresh\(\);   \/\/ LW4: a turn of fate made, or a save loaded/);
  assert.match(w, /const h = pl\.holder && pl\.dies && setsOut\(pl\.holder, town, k, livingTripWorld, o\) === false \? null : pl\.holder;/);
  assert.match(w, /if \(w\.length\) away\.set\(h\.id, w\);/);
  assert.match(w, /return \{ away, visitors, holders, news \};/);
  assert.match(w, /foeName: livingFoeWord,/);
  assert.match(rd('src/ui/travelViewHud.js'), /look === 'wayfarer' \? \(\/\\bfight\\b\/\.test\(m\.kind \?\? ''\) \? C\.band : C\.wayfarer\)/);
  // the pace the trouble reads the lives at is the trips' own
  assert.equal(PERSON_MOVE_SPEED / 0.2, CALENDAR_MPM);
  assert.ok(TRIP_PACE.merchant > 0);
  assert.equal(typeof ResidentWalker, 'function');
  assert.equal(travellerRoster({ mapId: 1, blocks: 1 }).length > 0, true);
});
