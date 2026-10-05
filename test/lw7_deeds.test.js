// LW7 (2026-10-05, bible/06-Systems/Living-World.md "LW7"): THE DEEDS - a resident struck down by the player is dead
// for good (a hand's death: the lives take the place from its minute, the road keeps its day), their own turn hostile and
// every one who saw it counts it a crime; one of the watch struck remembers the blow; a word's tone moves a regard once a
// day; the town talks of its dead and of the fights the player turned. The town is the synthetic one (test/lwTown.mjs),
// the roads the synthetic map (test/lwRoads.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { LivingTown, WITNESS_M, DEED_KNOWN_MIN, LINE_RANGE } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { createRelations, EVENTS, HOSTILE_AT, HAND_KINDS, HAND_NAME_MAX, TURNS_MAX, EASE_PER_DAY } from '../src/systems/livingWorld/relations.js';
import { placeAt, handDeath, roadHits, fateHits, deathCounted, turnKey, HAZARD } from '../src/systems/livingWorld/lives.js';
import { handsOn, membersAt, newsOf, remainsNear, awayOf, partyAt, placeCycle, CALENDAR_MPM, NEWS_DAYS } from '../src/systems/livingWorld/trips.js';
import { newsScript, SLAIN_NEWS, DIED_NEWS, HELPED_NEWS, ROAD_NEWS, fillLine } from '../src/systems/livingWorld/lines.js';
import { circleLine } from '../src/systems/livingWorld/meetups.js';
import { createLivingRoads } from '../src/scenes/livingRoads.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
const SQUARE = [96 * 1.6 + 0.8, 0, 96 * 1.6 + 0.8];
const DAY = 100;

function makeTown({ minute = DAY * DAY_MIN + 10 * 60, relations = createRelations(), ...extra } = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: minute };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM, relations: () => relations, playerName: () => 'Mac', townName: 'Synth', regionName: 'Daggerfall',
    ...extra,
  });
  return { town, clock, relations };
}
/** Where a party is at a minute (on the road). */
const partyAtOf = (trip, t) => partyAt(trip, t);
/** Run `seconds` at 30 frames a second, the player at the square. */
function run(t, seconds) {
  const dt = 1 / 30;
  let seats = [];
  for (let i = 0; i < Math.round(seconds * 30); i++) { t.clock.t += dt * RATE; seats = t.town.update(dt, SQUARE, 0, SQUARE, true); }
  return seats;
}

test('LW7 the regards keep the deeds: a hand\'s death (HAND_KINDS - `slain` by the player, `died` at their side) a turn with its minute, whether it was seen and the name (to HAND_NAME_MAX), once, kept to TURNS_MAX and through the save as [key, t, seen, who] - a record of the old kinds alone written as LW4 wrote it; one of their own slain turns a stranger HOSTILE; each tone of word counts once a day (mutants: the minute unasked, a turn twice, the name, the seen, the record, the cap, the tone\'s day)', () => {
  assert.deepEqual([...HAND_KINDS], ['slain', 'died']);
  assert.equal(EVENTS.slain, -75);
  assert.ok(EVENTS.slain <= HOSTILE_AT, 'one of their own slain: hostile from nothing');
  const rel = createRelations();
  assert.equal(rel.turn('died', 'L1.t2@40'), false, 'a hand\'s death needs its minute');
  assert.equal(rel.turn('slain', 'L1.3@40', { t: 60000, seen: true, who: 'Ada Reed' }), true);
  assert.equal(rel.turn('slain', 'L1.3@40', { t: 61000 }), false, 'once');
  assert.equal(rel.turn('died', 'L1.t2@40', { t: 60500 }), true);
  assert.deepEqual(rel.turns().slain.get('L1.3@40'), { t: 60000, seen: true, who: 'Ada Reed' });
  assert.deepEqual(rel.turns().died.get('L1.t2@40'), { t: 60500, seen: false, who: '' });
  const v = rel.turnsVersion();
  rel.turn('slain', 'L1.4@40', { t: 1, who: 'x'.repeat(90) });
  assert.equal(rel.turnsVersion(), v + 1, 'a new turn: the books made again');
  assert.equal(rel.turns().slain.get('L1.4@40').who.length, HAND_NAME_MAX);
  const snap = rel.snapshot();
  assert.deepEqual(snap.turns.slain[0], ['L1.3@40', 60000, 1, 'Ada Reed']);
  assert.deepEqual(snap.turns.died, [['L1.t2@40', 60500, 0, '']]);
  const back = createRelations(JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.turns().slain.get('L1.3@40'), { t: 60000, seen: true, who: 'Ada Reed' });
  assert.deepEqual(back.turns().died.get('L1.t2@40'), { t: 60500, seen: false, who: '' });
  const old = createRelations();
  old.turn('won', 'e1');
  assert.deepEqual(Object.keys(old.snapshot().turns), ['spared', 'fallen', 'won', 'lost'], 'the old kinds alone: the record as LW4 wrote it');
  const many = createRelations();
  for (let i = 0; i < TURNS_MAX + 3; i++) many.turn('slain', `L1.${i}@1`, { t: i });
  assert.equal(many.turns().slain.size, TURNS_MAX);
  assert.ok(!many.turns().slain.has('L1.0@1') && many.turns().slain.has(`L1.${TURNS_MAX + 2}@1`), 'the oldest leave first');
  assert.equal(createRelations({ v: 1, people: {}, turns: { slain: [['', 5], ['L1.1@1', 'x'], 'L1.2@1'] } }).turns().slain.size, 0, 'a bad record: nothing');
  // a word's tone, once a day each
  const r2 = createRelations();
  r2.note('L1.9', 'polite', 10);
  r2.note('L1.9', 'polite', 10);
  assert.equal(r2.regard('L1.9', 10), EVENTS.polite, 'a courteous word once a day');
  r2.note('L1.9', 'insulted', 10);
  r2.note('L1.9', 'insulted', 10);
  assert.equal(r2.regard('L1.9', 10), EVENTS.polite + EVENTS.insulted, 'a blunt one once a day, beside it');
  r2.note('L1.9', 'polite', 11);
  assert.equal(r2.regard('L1.9', 11), EVENTS.polite + EVENTS.insulted + EASE_PER_DAY + EVENTS.polite, 'the next day again (a day\'s ease between)');
  const s2 = r2.snapshot();
  assert.equal(s2.people['L1.9'].polite, 11);
  assert.equal(s2.people['L1.9'].blunt, 10);
  const b2 = createRelations(JSON.parse(JSON.stringify(s2)));
  b2.note('L1.9', 'polite', 11);
  assert.equal(b2.regard('L1.9', 11), r2.regard('L1.9', 11), 'the day kept through the save');
  const r3 = createRelations();
  r3.note('L1.8', 'talk', 3);
  assert.deepEqual(Object.keys(r3.snapshot().people['L1.8']), ['r', 'met', 'seen', 'talked'], 'no tone yet: none written');
});

test('LW7 the lives take a hand\'s dead from its minute: `handDeath` the minute (slain or died) in its cycle; a townsperson the road never takes empties as any place does - held to the minute, empty VACANT_CYCLES, a newcomer after; the road\'s fate (`dies`) stays the dice\'s and the fights\' own beside a hand\'s death; and a turn the character made always counts - a newcomer struck down after an uncounted roll empties the place (mutants: the hand unread, died unread, the hand made the road\'s, the turn uncounted)', () => {
  const res = { id: 'L7.3', town: 7, slot: 3, job: 'farmer', roll: 'h' };
  assert.equal(HAZARD.farmer, undefined, 'no hazard for a townsperson');
  assert.deepEqual(placeAt(res, 50, {}), { vacant: false, holder: null, dies: false, diced: false, since: null, hand: null }, 'the road never takes them');
  const turns = { slain: new Map([['L7.3@50', { t: 72000 }]]) };
  assert.equal(handDeath(res, 50, turns), 72000);
  assert.equal(handDeath(res, 51, turns), null);
  assert.equal(handDeath(res, 50, { died: new Map([['L7.3@50', { t: 5 }]]) }), 5, 'died at the player\'s side: a hand\'s too');
  const at50 = placeAt(res, 50, turns);
  assert.equal(at50.hand, 72000);
  assert.equal(at50.dies, false, 'not the road\'s');
  assert.equal(at50.vacant, false, 'held until the minute');
  for (const k of [51, 52, 53]) assert.equal(placeAt(res, k, turns).vacant, true, `empty in ${k}`);
  const at54 = placeAt(res, 54, turns);
  assert.equal(at54.vacant, false);
  assert.equal(at54.holder, 50, 'the newcomer after it');
  assert.equal(roadHits(res, 50, turns), false);
  assert.equal(fateHits(res, 50, turns), true);
  // a traveller the road takes in cycle 37 (its dice) - and a hand too: the road's fate stands beside the hand's minute
  const adv = { id: 'L7.t1', town: 7, slot: 1, job: 'adventurer', roll: 't' };
  assert.equal(placeAt(adv, 37, {}).dies, true, 'the dice: cycle 37');
  const both = placeAt(adv, 37, { slain: new Map([['L7.t1@37', { t: 9 }]]) });
  assert.equal(both.dies, true, 'the road\'s fate unmoved by the hand');
  assert.equal(both.hand, 9);
  // slot 115: the road takes it in 30 (counted), rolls again in 32 (the place empty: uncounted); the newcomer from 34
  const nu = { id: 'L7.t115', town: 7, slot: 115, job: 'adventurer', roll: 't' };
  assert.ok(roadHits(nu, 30, {}) && roadHits(nu, 32, {}) && ![27, 28, 29, 31, 33, 34, 35, 36, 37, 38].some((k) => roadHits(nu, k, {})), 'the dice as claimed');
  assert.equal(deathCounted(nu, 32, {}), false, 'a roll on an empty place is no death');
  assert.equal(placeAt(nu, 34, {}).holder, 30, 'the newcomer holds it from 34');
  const struck = { slain: new Map([['L7.t115@34', { t: 1 }]]) };
  assert.equal(deathCounted(nu, 34, struck), true, 'a turn the character made counts, an uncounted roll before it or not');
  assert.equal(placeAt(nu, 35, struck).vacant, true, 'the place empty after the newcomer struck down');
  const cut = { fallen: new Set(['L7.t115@34']) };
  assert.equal(deathCounted(nu, 34, cut), true, 'one cut down beside the player counts too');
  assert.equal(placeAt(nu, 34, cut).dies, true, 'and is the road\'s fate that cycle');
});

test('LW7 a trip\'s hand deaths (`handsOn`): each member a hand took before the trip was done is gone from the party from that minute (`fallen`, `hand`), the trip itself as the road made it; one taken after it is the town\'s; a hand\'s dead leave no remains of the road\'s and are not its news; and they never walk home (mutants: the trip\'s end, the hand mark, the remains, the news)', () => {
  const party = [{ id: 'a', name: 'Al Fen' }, { id: 'b', name: 'Bo Reed' }, { id: 'c', name: 'Cy Moss' }];
  const way = { pts: [[0, 0], [100000, 0]], cum: [0, 100000], len: 100000 };
  const trip = { id: 'T', kind: 'merchant', leader: party[0], party, way, pace: 50, outT0: 1000, outT1: 3000, backT0: 4000, backT1: 6000, trim0: 0, trim1: 0,
    enc: { id: 'T:e', kind: 'won', foes: [7], t0: 1500, t1: 1600 }, to: { name: 'Far' } };
  assert.equal(handsOn(trip, () => null), trip, 'no hand: the same trip');
  assert.equal(handsOn(trip, (m) => (m.id === 'b' ? 6000 : null)), trip, 'a death after the trip is the town\'s');
  const h = handsOn(trip, (m) => (m.id === 'b' ? 2000 : null));
  assert.notEqual(h, trip);
  assert.deepEqual(h.fallen, [{ res: party[1], t: 2000, s: 0, hand: true }]);
  assert.deepEqual(membersAt(h, 1999).map((m) => m.id), ['a', 'b', 'c']);
  assert.deepEqual(membersAt(h, 2000).map((m) => m.id), ['a', 'c'], 'gone from the minute');
  assert.equal(h.outT1, trip.outT1, 'the trip as the road made it');
  assert.equal(awayOf(party[1], [h])[0].t1, Infinity, 'never home');
  assert.equal(awayOf(party[0], [h])[0].t1, 6000);
  const news = newsOf([h], 6000);
  assert.equal(news[0].kind, 'won', 'not the road\'s fallen');
  assert.equal(news[0].who, 'Al Fen');
  assert.equal(news[0].enc, 'T:e', 'the encounter named (the character\'s turn of it)');
  // on the synthetic map: a party the road thinned, and one of its living struck down early on the way - the road's dead
  // lie where they fell, the hand's do not
  const map0 = livingMap();
  const T = partiesOver(map0, 400, 470).find((tr) => tr.fallen?.length && !tr.dive && tr.party.some((m) => !tr.fallen.some((f) => f.res.id === m.id)));
  assert.ok(T, 'a party the road thinned');
  const M = T.party.find((m) => !T.fallen.some((f) => f.res.id === m.id));
  const roster = map0.world.rosterOf(map0.byId.get(M.town));
  const place = roster.find((r) => r.slot === M.slot) ?? M;
  const key = turnKey(place, placeCycle(place, roster, Math.floor(T.outT0 / DAY_MIN), 1));
  const f0 = T.fallen[0];
  const map1 = livingMap({ turns: { slain: new Map([[key, { t: f0.t - 1 }]]) } });   // a minute before the road's: both lie fresh
  const T1 = partiesOver(map1, 400, 470).find((tr) => tr.id === T.id);
  assert.ok(T1.fallen.some((f) => f.res.id === M.id && f.hand), 'the hand\'s dead on the trip');
  assert.deepEqual(T1.fallen.find((f) => !f.hand), f0, 'the road\'s fallen as they were');
  const near = remainsNear(T1.from.px, T1.from.py, f0.t + 1, map1.world, { mpm: CALENDAR_MPM, memo: new Map() }, 40).remains.filter((r) => r.trip.id === T1.id).map((r) => r.res.id);
  assert.ok(near.includes(f0.res.id), 'the road\'s dead lie');
  assert.ok(!near.includes(M.id), 'the hand\'s do not');
});

test('LW7 the town\'s deeds: a resident struck down (`slain`) is dead for good from that minute (`o.slay` - seen when anyone saw it), their household turned against the player (`slain`) and every resident on the street within WITNESS_M with a clear line (`o.sees`) noting the crime - and taken off the street; one of the watch struck (`struck`) remembers the blow, a caught hand is seen by all near (`caught`); a word\'s tone (`toned`); a party\'s visitor\'s own are their party, a crew\'s their packet\'s (`kinOf`); the street skips a resident a hand took (`o.deadAt`) and reads a townsperson\'s place by the lives (`o.holderOf`) (mutants: each)', () => {
  assert.equal(WITNESS_M, LINE_RANGE);
  const slays = [];
  const t = makeTown({ slay: (res, at, seen) => slays.push({ res, at, seen }) });
  const seats = run(t, 6);
  const day = Math.floor((t.clock.t - 240) / DAY_MIN);
  // a victim with a household, and the street about them
  const victim = seats.find(({ person }) => {
    const r = person.living.res;
    return r.home != null && t.town.residents.some((o) => o.id !== r.id && o.home === r.home)
      && seats.some((o) => o.person !== person && Math.hypot(o.person.pos[0] - person.pos[0], o.person.pos[2] - person.pos[2]) <= WITNESS_M);
  });
  assert.ok(victim, 'a resident with a household, seen by the street');
  const res = victim.person.living.res;
  const kin = t.town.kinOf(res);
  assert.ok(kin.length > 0 && kin.every((k) => k.home === res.home && k.id !== res.id), 'their own: the household they live in');
  const near = seats.filter((o) => o.person !== victim.person && Math.hypot(o.person.pos[0] - victim.person.pos[0], o.person.pos[2] - victim.person.pos[2]) <= WITNESS_M).map((o) => o.person.living.id);
  const far = seats.filter((o) => Math.hypot(o.person.pos[0] - victim.person.pos[0], o.person.pos[2] - victim.person.pos[2]) > WITNESS_M).map((o) => o.person.living.id);
  assert.deepEqual(t.town.witnesses(victim.person.pos, res.id).map((w) => w.id).sort(), [...near].sort(), 'the witnesses: the street within WITNESS_M');
  assert.equal(t.town.slain(victim.person), res.id);
  assert.equal(slays.length, 1);
  assert.equal(slays[0].res, res);
  assert.equal(slays[0].at, t.clock.t, 'at this minute');
  assert.equal(slays[0].seen, true, 'seen');
  for (const k of kin) assert.ok(t.relations.regard(k.id, day) <= EVENTS.slain, `${k.id}: one of theirs slain`);
  for (const id of near) if (!kin.some((k) => k.id === id)) assert.equal(t.relations.regard(id, day), EVENTS.crime, `${id} saw it`);
  for (const id of far) if (!kin.some((k) => k.id === id)) assert.equal(t.relations.regard(id, day), 0, `${id} did not`);
  assert.equal(t.relations.regard(res.id, day), 0, 'the dead regard nothing');
  assert.ok(!run(t, 1).some(({ person }) => person.living.id === res.id), 'off the street');
  assert.equal(t.town.slain({ pos: [0, 0, 0], living: { id: 'x', res: { id: 'x' }, town: {} } }), null, 'another town\'s body: not this one\'s deed');
  // walls between: nobody saw
  const blind = makeTown({ slay: (r, at, seen) => slays.push({ r, seen }), sees: () => false });
  const bseats = run(blind, 6);
  const bv = bseats[0].person;
  assert.deepEqual(blind.town.witnesses(bv.pos, bv.living.id), []);
  blind.town.slain(bv);
  assert.equal(slays[slays.length - 1].seen, false, 'unseen');
  // the sees asked from a witness's eyes to the deed
  const asked = [];
  const eyes = makeTown({ sees: (a, b) => { asked.push([a, b]); return true; } });
  const eseats = run(eyes, 6);
  eyes.town.witnesses(eseats[0].person.pos, null);
  assert.ok(asked.length > 0 && asked.every(([a, b]) => Math.abs(a[1] - 1.6) < 1e-9 && Math.abs(b[1] - 1) < 1e-9), 'eye to body');
  // the watch struck, a caught hand, a word's tone
  const s = makeTown();
  const sseats = run(s, 6);
  const sday = Math.floor((s.clock.t - 240) / DAY_MIN);
  const g = sseats[0].person;
  const gNear = s.town.witnesses(g.pos, g.living.id).map((w) => w.id);
  assert.ok(gNear.length > 0, 'someone near the blow');
  assert.equal(s.town.struck(g), g.living.id);
  assert.equal(s.relations.regard(g.living.id, sday), EVENTS.struck, 'the blow remembered');
  for (const id of gNear) assert.equal(s.relations.regard(id, sday), EVENTS.crime, `${id} saw the blow`);
  const c = makeTown();
  const cseats = run(c, 6);
  const cday = Math.floor((c.clock.t - 240) / DAY_MIN);
  const v = cseats[0].person;
  const cNear = c.town.witnesses(v.pos, v.living.id).map((w) => w.id);
  assert.ok(cNear.length > 0, 'someone near the hand');
  c.town.caught(v);
  assert.equal(c.relations.regard(v.living.id, cday), EVENTS.crime, 'the purse\'s own');
  for (const id of cNear) assert.equal(c.relations.regard(id, cday), EVENTS.crime, `${id} saw the hand`);
  const w = cseats.find((x) => x.person !== v && !cNear.includes(x.person.living.id)).person;   // one who did not see the hand
  assert.equal(c.town.toned(w, 1), null, 'a plain word: nothing');
  c.town.toned(w, 0);
  assert.equal(c.relations.regard(w.living.id, cday), EVENTS.polite);
  c.town.toned(w, 2);
  assert.equal(c.relations.regard(w.living.id, cday), EVENTS.polite + EVENTS.insulted);
  // a visitor's own, a crew's own
  const V = { id: 'L9.t1', name: 'Vi Ash', town: 9, slot: 1, roll: 't', job: 'merchant', home: null };
  const W = { ...V, id: 'L9.t2', slot: 2 };
  const vt = makeTown({ tripsOf: () => ({ away: new Map(), visitors: [{ res: V, inT: 0, outT: 1e9, yaw: 0, trip: { party: [V, W] } }] }) });
  vt.town.peopleOf(DAY);
  assert.deepEqual(vt.town.kinOf(V).map((r) => r.id), ['L9.t2'], 'a visitor\'s own: the party they came with');
  const C1 = { ...V, id: 'L9.t5', job: 'sailor' }, C2 = { ...V, id: 'L9.t6', job: 'sailor' }, C3 = { ...V, id: 'L9.t7', job: 'sailor' };
  const lane = { key: 'a' };
  const ct = makeTown({ crews: () => [{ res: C1, inT: 0, outT: 1e9, berth: { lane, k: 0 } }, { res: C2, inT: 0, outT: 1e9, berth: { lane, k: 0 } }, { res: C3, inT: 0, outT: 1e9, berth: { lane, k: 1 } }] });
  ct.town._crewsNow();
  assert.deepEqual(ct.town.kinOf(C1).map((r) => r.id), ['L9.t6'], 'a crew\'s own: their packet\'s');
  // the street skips a resident a hand took, and reads a townsperson's place by the lives
  const gone = sseats[2].person.living.id;
  const d = makeTown({ deadAt: (r, tm) => r.id === gone && tm > 0 });
  const dseats = run(d, 6);
  assert.ok(dseats.length > 0 && !dseats.some(({ person }) => person.living.id === gone), 'a hand\'s dead: never on the street');
  const asks = [];
  const h0 = makeTown().town;
  const [x, y] = h0.residents.filter((r) => r.roll === 'h');
  const nu = { ...y, id: `${y.id}~50`, name: 'New Comer', home: -1 };
  const ht = makeTown({ holderOf: (r, dd) => { asks.push([r.roll, dd]); return r.id === x.id ? null : r.id === y.id ? nu : r; } });
  const people = ht.town.peopleOf(DAY);
  assert.ok(!people.some((r) => r.id === x.id), 'an empty place: nobody');
  const held = people.find((r) => r.id === nu.id);
  assert.ok(held && held.home === y.home, 'a newcomer, lodged where the place is');
  assert.ok(asks.length > 0 && asks.every(([roll, dd]) => roll !== 't' && dd === DAY), 'the townsfolk asked of the lives for the day; the travellers are the roads\'');
});

test('LW7 the town talks of the deeds (`deedNews`): each of its own the player struck down, known DEED_KNOWN_MIN after, for NEWS_DAYS - by name, seen or not - and each who died at the player\'s side; another town\'s dead are not its talk; the words: SLAIN_NEWS (seen, the player named; unseen), DIED_NEWS, HELPED_NEWS for a fight the player turned (else the road\'s), the character\'s name filled (mutants: the known minute, the window, the town, the pools, the name)', () => {
  const rel = createRelations();
  const t = makeTown({ relations: rel });
  run(t, 1);
  const now = t.clock.t;
  const r0 = t.town.residents[0];
  rel.turn('slain', `L${TOWN.mapId}.${r0.slot}@3`, { t: now - DEED_KNOWN_MIN - 5, seen: true, who: 'Ada Reed' });
  rel.turn('slain', `L${TOWN.mapId}.w0@3`, { t: now - DEED_KNOWN_MIN + 5, seen: false, who: 'Not Yet' });
  rel.turn('slain', `L${TOWN.mapId}.5@3`, { t: now - NEWS_DAYS * DAY_MIN - DEED_KNOWN_MIN - 1, who: 'Long Gone' });
  rel.turn('slain', 'L999.1@3', { t: now - 100, who: 'Far Away' });
  rel.turn('died', `L${TOWN.mapId}.t1@3`, { t: now - DEED_KNOWN_MIN - 50, who: 'Bo Brave' });
  rel.turn('slain', `L${TOWN.mapId}.${t.town.residents[1].slot}@3`, { t: now - DEED_KNOWN_MIN - 70 });
  const news = t.town.deedNews();
  assert.deepEqual(news.map((n) => [n.kind, n.who, n.seen]), [['slain', 'Ada Reed', true], ['died', 'Bo Brave', false], ['slain', t.town.residents[1].name, false]],
    'known an hour after, for the news days, its own - newest first, a nameless record by the census');
  // the words
  const pick = (item, pool) => { for (let seed = 1; seed < 4000; seed++) { const n = newsScript(seed, [item]); if (n) return pool.includes(n.script); } return false; };
  assert.ok(pick({ kind: 'slain', who: 'A', seen: true }, SLAIN_NEWS.seen), 'seen: the player named');
  assert.ok(pick({ kind: 'slain', who: 'A', seen: false }, SLAIN_NEWS.unseen));
  assert.ok(pick({ kind: 'died', who: 'A' }, DIED_NEWS));
  assert.ok(pick({ kind: 'won', who: 'A', helped: true }, HELPED_NEWS.won), 'a fight the player turned');
  assert.ok(pick({ kind: 'fell', who: 'A', helped: true }, HELPED_NEWS.fell));
  assert.ok(pick({ kind: 'driven', who: 'A', helped: true }, ROAD_NEWS.driven), 'no words of its own: the road\'s');
  assert.ok(pick({ kind: 'won', who: 'A' }, ROAD_NEWS.won), 'not turned: the road\'s');
  const lt = rd('src/systems/livingWorld/livingTown.js');
  assert.match(lt, /if \(deeds\.length\) ctx\.news = \[\.\.\.\(ctx\.news \?\? \[\]\), \.\.\.deeds\];/, 'the street\'s meetings tell the deeds beside the road\'s news');
  assert.match(lt, /ctx\.player = this\.o\.playerName\?\.\(\) \?\? '';/);
  assert.ok(SLAIN_NEWS.seen.every((sc) => sc.some((l) => l.includes('{player}'))), 'seen, the player named');
  assert.ok(SLAIN_NEWS.unseen.every((sc) => !sc.some((l) => l.includes('{player}'))), 'unseen, not');
  // the circle fills the player's name
  let filled = null;
  for (let seed = 1; seed < 20000 && !filled; seed++) {
    const told = newsScript(seed, [{ kind: 'slain', who: 'Ada Reed', seen: true, foe: '', place: '' }]);
    if (told?.script !== SLAIN_NEWS.seen[1]) continue;
    filled = circleLine({ members: [{ id: 'p', name: 'Bo Reed', job: 'farmer' }, { id: 'q', name: 'Cy Moss', job: 'farmer' }], seed, start: 0, end: 1e6, talks: true, index: 0 }, 0, 10,
      { news: [{ kind: 'slain', who: 'Ada Reed', seen: true, foe: '', place: '' }], player: 'Mac' });
  }
  assert.equal(filled?.text, fillLine(SLAIN_NEWS.seen[1][0], { player: 'Mac', who: 'Ada' }));
});

test('LW7 the road\'s deeds: a traveller struck down (`slain`) - the hand\'s turn, seen (their party stood by), at the clock\'s minute; their party\'s living turned against the player (`slain`); the parties read again at once; a word\'s tone on the road; a party nobody is left of shows no mark (mutants: the slay, the party, the refresh, the tone, the empty mark)', () => {
  const map = livingMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const trips = partiesOver(map, 400, 470, o);
  const T = trips.find((tr) => tr.party.length >= 3 && !tr.dive && !tr.enc);
  assert.ok(T, 'a party of three or more, untroubled');
  const m = Math.floor((T.outT0 + T.outT1) / 2);
  const at = partyAtOf(T, m);
  const rel = createRelations();
  const slays = [];
  const sprites = { sync() {}, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => m, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: at.x, z: at.z }),
    sprites, memo: o.memo, relations: () => rel, slay: (res, tm, seen) => slays.push({ res, tm, seen }) });
  roads.frame(0.1, [0, 0, 0]);
  assert.ok(roads.parties().some((p) => p.trip.id === T.id), 'the party read');
  const victim = T.party[1];
  assert.equal(roads.slain({ living: { id: victim.id, res: victim } }), victim.id);
  assert.deepEqual(slays, [{ res: victim, tm: m, seen: true }]);
  const day = Math.floor((m - 240) / DAY_MIN);
  for (const p of T.party) assert.equal(rel.regard(p.id, day), p.id === victim.id ? 0 : EVENTS.slain, `${p.id}`);
  const before = roads.parties();
  roads.frame(0.001, [0, 0, 0]);
  assert.notEqual(roads.parties(), before, 'read again at once');
  assert.equal(roads.slain({ living: null }), null);
  roads.toned({ living: { id: T.party[0].id } }, 0);
  assert.equal(rel.regard(T.party[0].id, day), EVENTS.slain + EVENTS.polite, 'a courteous word on the road');
  // a lone traveller struck down: no mark walks on for them
  const solo = trips.find((tr) => tr.party.length === 1 && !tr.dive && !tr.enc);
  assert.ok(solo, 'a lone traveller');
  const sm = Math.floor((solo.outT0 + solo.outT1) / 2);
  const sat = partyAtOf(solo, sm);
  const lone = solo.party[0];
  const roster = map.world.rosterOf(map.byId.get(lone.town));
  const place = roster.find((r) => r.slot === lone.slot) ?? lone;
  const key = turnKey(place, placeCycle(place, roster, Math.floor(solo.outT0 / DAY_MIN), 1));
  const marksAt = (turns) => {
    const mp = livingMap({ turns });
    const rr = createLivingRoads({ world: mp.world, mpm: CALENDAR_MPM, clock: () => sm, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: sat.x, z: sat.z }),
      sprites, memo: new Map() });
    rr.frame(0.1, [0, 0, 0]);
    return rr.marks().map((k) => k.key);
  };
  assert.ok(marksAt(null).includes(`party:${solo.id}`), 'walking, a mark');
  assert.ok(!marksAt({ slain: new Map([[key, { t: solo.outT0 + 5 }]]) }).includes(`party:${solo.id}`), 'struck down on the way: none');
});

test('LW7 the streaming host: every resident\'s place by the lives (`livingCycleOf` - a traveller\'s placeCycle, a townsperson\'s own cycleOf; the newcomer the census\'s own mint with their home), a hand\'s death and the player\'s (`livingDeadAt`, `livingSlay`), the trouble never taking a hand\'s dead, a trip\'s hand deaths, the news of fights the player turned, a crew\'s holders; the town\'s options; the swing\'s civilian pool through the deeds (`livingStruckPool` - the watch struck, anyone else struck down; the guard it stands watched), the trample\'s too, a swing at the road\'s travellers (`livingStrikeRoad` - reach, a wall, the blood, the Brotherhood\'s five, the racial hit); a question\'s tone through `livingTone` (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(res\.roll !== 't'\) return cycleOf\(res, day, livingScale\(\)\)\.k;/, 'a townsperson\'s own cycle');
  assert.match(w, /return placeCycle\(roster\.find\(\(r\) => r\.slot === res\.slot\) \?\? res, roster, day, livingScale\(\)\);/, 'a traveller\'s place cycle');
  assert.match(w, /if \(!turns\.slain\.size && !turns\.died\.size\) return false;\n\s*const h = livingPlaceOf\(res, livingCycleOf\(res, Math\.floor\(\(t - 240\) \/ 1440\)\)\)\.hand;\n\s*return h != null && h <= t;/);
  assert.match(w, /const livingSlay = \(res, t, seen\) => \{ livingRelations\.turn\('slain', turnKey\(res, livingCycleOf\(res, Math\.floor\(\(t - 240\) \/ 1440\)\)\), \{ t, seen, who: res\.name \}\); \};/);
  assert.match(w, /got = \{ holder, dies: !pl\.vacant && pl\.dies, hand: pl\.hand \};/);
  assert.match(w, /return pl\.dies && pl\.hand == null; \},   \/\/ LW7/);
  assert.match(w, /f = handsOn\(f, \(m\) => livingPlaceOf\(m, livingCycleOf\(m, Math\.floor\(\(trip\.outT0 - 240\) \/ 1440\)\)\)\.hand\);/);
  assert.match(w, /helped: won\.has\(n\.enc\) \}\)\);/);
  assert.match(w, /const res = livingPlaceOf\(c\.res, livingCycleOf\(c\.res, day\)\)\.holder;/);
  assert.match(w, /holderOf: \(res, day\) => livingPlaceOf\(res, livingCycleOf\(res, day\)\)\.holder, deadAt: livingDeadAt, slay: livingSlay,/);
  assert.match(w, /const hit = collider\.raycast\(\[a\[0\] \+ locOrigin\[0\] \+ tr\[0\], a\[1\] \+ tr\[1\], a\[2\] \+ locOrigin\[2\] \+ tr\[2\]\], \[d\[0\] \/ len, d\[1\] \/ len, d\[2\] \/ len\], len\);\n\s*return !\(Number\.isFinite\(hit\) && hit < len - 0\.25\);/, 'the town\'s line of sight, the collider\'s');
  // the street's seams
  assert.match(w, /pos, fwdYaw: person\.facingYaw, guard: person\.guard, person,/);
  assert.match(w, /cityGuards\.resolveCivilianHit\(weaponRig\.playerWeapon, cam\.pos, lookFwd, player\.pos, livingStruckPool\(_guardPool\(\)\),/);
  assert.match(w, /const livingStruckPool = \(pool\) => \(livingWorldOn\(\) \? pool\.map\(\(e\) => \(\{ \.\.\.e, disable: \(\) => \{ livingDeedOf\(e\.person, e\.pos\); e\.disable\(\); \} \}\)\) : pool\);/);
  assert.match(w, /if \(!person\.guard\) \{ town\.slain\(person\); return; \}\n\s*if \(town\.struck\(person\)\) _livingWatchTurned\.push\(/);
  assert.match(w, /retire: \(person\) => \{ livingDeedOf\(person\); for \(const p of built\.values\(\)\) if \(p\.population\?\.retire\(person\)\) break; \},/);
  // LW-FIX2: the guard found by the conversion's own mark, and cut down the town's whole deed (test/lwfix2_watch.test.js)
  assert.match(w, /const livingWatchStep = \(\) => watchStep\(_livingWatchTurned, cityGuards\.guards\);/);
  assert.match(w, /if \(_livingWatchTurned\.length\) livingWatchStep\(\);/);
  assert.match(w, /else if \(!r\?\.spared && livingStrikeRoad\(cam\.pos, lookFwd\)\) surfacePlayer\(\);/);
  assert.match(w, /const near = nearestPerson\(eye, dir, livingRoads\.talkSeats\(\)\);[^\n]*\n\s*if \(!near \|\| near\.distance > WEAPON_REACH\) return false;\n\s*const wall = collider\.raycast\(eye, dir, near\.distance\);\n\s*if \(Number\.isFinite\(wall\) && wall < near\.distance - 1e-3\) return false;\n\s*if \(!livingRoads\.slain\(near\.entry\.person\)\) return false;/);
  assert.match(w, /tallyCrimeGuildRequirements\(playerEntity, false, 5\);\n\s*playerWeaponHitEntity\(playerEntity, \{ health: 0 \}, \{ isCivilian: true \}\);/);
  assert.match(w, /livingTone: \(person, tone\) => person\?\.living\?\.town\?\.toned\?\.\(person, tone\),/);
  assert.match(w, /_livingRoadsDoor\.toned = \(p, tone\) => livingRoads\?\.toned\(p, tone\) \?\? null;/);
  assert.match(w, /slay: livingSlay,   \/\/ LW7: a traveller struck down/);
  const tt = rd('src/scenes/townTalk.js');
  assert.match(tt, /const _toneHeard = \(\) => \{ if \(_toneTarget\) livingTone\?\.\(_toneTarget, tone\); \};/);
  assert.match(tt, /_toneTarget = _toneNext;   \/\/ LW7[^\n]*\n\s*_toneNext = null;/, 'the window takes the door\'s resident, and every other door leaves nobody');
  assert.match(tt, /livingTalk\?\.talked\?\.\(target\.person\);[^\n]*\n\s*_toneNext = target\.person\.living \? target\.person : null;/, 'the mobile door names its resident');
  assert.match(tt, /_toneHeard\(\);   \/\/ LW7: the question's tone/);
  assert.match(tt, /askWork: \(\) => \(_toneHeard\(\), eng\.pipeline\.getAnswerText\(workListItem\(\), \{/);
});
