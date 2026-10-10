// LW12 (bible/06-Systems/Living-World-II.md "LW12"): THE OUTLAWS - a region's bands and their hideouts off its roads,
// their generations (the dice's routs and the character's), their people and names, the hold-up on the dice (a band's
// share of a trouble near its hideout; robbed below the ratio, no blood), the take, the news; the hideout stood (tents,
// fire, people, chest), the rout, the chest looted, heard of and its rumoured ring; a robbed caravan's counter. Pure and
// synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bandCount, hideoutsOf, routOfEra, genAt, outlawBandAt as bandAt, outlawBandName as bandName, bandPeople, bandTrouble, takeOf, pixelNative, BAND_TOWNS_PER, BANDS_MAX,
  BAND_LEG_PX, BAND_TOWN_BLOCKS, HIDEOUT_OFF_PX, OUTLAW_REACH_PX, BAND_SHARE, ROB_RATIO, BAND_ERA_DAYS, ROUT_CHANCE, BAND_VACANT_DAYS,
  COURT_BLOCKS, BAND_SIZE, OUTLAW_CLASSES, TAKE_DAYS, TAKE_PURSE_SHARE, ROB_GOLD, TAKE_GOODS, TAKE_GOODS_MAX,
} from '../src/systems/livingWorld/outlaws.js';
import { troubleOf, troubledTrip, HALT_MIN, FIGHT_MIN, ROB_RATIO as TROUBLE_ROB_RATIO } from '../src/systems/livingWorld/trouble.js';
import { townTrips, newsOf, partyAt, CALENDAR_MPM, NATIVE_PIXEL, NATIVE_PER_M } from '../src/systems/livingWorld/trips.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { cargoOf, CARGO_ROBBED } from '../src/systems/livingWorld/wagons.js';
import { createRelations, MARK_KINDS, TALE_KINDS } from '../src/systems/livingWorld/relations.js';
import { ROAD_NEWS, ROUTED_NEWS, BAND_WARNINGS, newsScript, fillLine } from '../src/systems/livingWorld/lines.js';
import { createHideouts, createHideoutBook, standingAt, rumourAt, tentsFor, killed, BAND_LIVE_M, BAND_KEEP_M, HIDEOUT_DAY_H, HEARD_PX, RUMOUR_OFF_N, HIDEOUTS_ASK_MS } from '../src/scenes/hideouts.js';
import { createCaravanHost, bandTook } from '../src/scenes/caravanHost.js';
import { purseOf, CARAVAN_QUALITY } from '../src/systems/livingWorld/caravanDoor.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const T = (mapId, px, py, blocks, region = 17) => ({ mapId, px, py, blocks, type: 0, region, people: 3, name: `T${mapId}`, port: false });
const straightRoute = (a, b) => {
  const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
  const pixels = [];
  for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
  return { pixels, kinds: pixels.slice(1).map(() => 'road') };
};
function miniWorld(towns, { dry = () => true, routeOf = straightRoute } = {}) {
  const rosters = new Map();
  return {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf,
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
    dryAt: dry,
    townsIn: (region) => towns.filter((t) => t.region === region),
  };
}
const T0 = 405 * 360 * DAY_MIN;   // a minute of the game's own years
/** A region whose band's leg is the road the trips of 903 and 904 walk. */
const leg = () => [T(901, 100, 100, 24), T(902, 108, 100, 20), T(903, 104, 106, 6), T(904, 112, 104, 8)];

test('LW12 the bands: a region of n towns keeps 1 + n / BAND_TOWNS_PER of them to BANDS_MAX (none for a lone town); each hideout 1-2 px off the middle of the road between two of its towns of BAND_TOWN_BLOCKS within BAND_LEG_PX, on dry ground, on no town; none while a road it needs is unplanned; the same for every reader (mutants: the count, the leg, the off, the dry, the town, the pending)', () => {
  assert.deepEqual([BAND_TOWNS_PER, BANDS_MAX, BAND_TOWN_BLOCKS, OUTLAW_REACH_PX], [40, 4, 4, 2]);
  assert.deepEqual([...BAND_LEG_PX], [3, 14]);
  assert.deepEqual([...HIDEOUT_OFF_PX], [1, 2]);
  assert.deepEqual([0, 1, 2, 39, 40, 79, 80, 120, 400].map(bandCount), [0, 0, 1, 1, 2, 2, 3, 4, 4]);
  const towns = leg();
  const world = miniWorld(towns);
  const hs = hideoutsOf(17, world);
  assert.equal(hs.length, 1);
  const h = hs[0];
  assert.equal(h.key, 'O17.0');
  assert.deepEqual(hideoutsOf(17, miniWorld(leg())), hs, 'every reader the same');
  const plan = straightRoute(towns.find((t) => t.mapId === h.a), towns.find((t) => t.mapId === h.b));
  const d = Math.min(...plan.pixels.map((p) => Math.max(Math.abs(p.x - h.px), Math.abs(p.y - h.py))));
  assert.ok(d >= HIDEOUT_OFF_PX[0] && d <= HIDEOUT_OFF_PX[1], 'off its road');
  const mid = plan.pixels[Math.floor(plan.pixels.length / 2)];
  assert.ok(Math.max(Math.abs(mid.x - h.px), Math.abs(mid.y - h.py)) <= HIDEOUT_OFF_PX[1] + 2, 'by its middle');
  assert.ok(!world.townsNear(h.px, h.py, 0).length, 'on no town');
  assert.deepEqual({ x: h.x, z: h.z }, pixelNative(h.px, h.py));
  assert.equal(h.patrolled, true, 'a town of 24 blocks keeps a court');
  assert.equal(COURT_BLOCKS, 16);
  // a leg's towns: each BAND_TOWN_BLOCKS, BAND_LEG_PX apart
  for (const t of [h.a, h.b]) assert.ok(towns.find((x) => x.mapId === t).blocks >= BAND_TOWN_BLOCKS);
  assert.deepEqual(hideoutsOf(17, miniWorld([T(1, 0, 0, 3), T(2, 5, 0, 3)])), [], 'hamlets keep no road for a band');
  assert.deepEqual(hideoutsOf(17, miniWorld([T(1, 0, 0, 8), T(2, 2, 0, 8)])), [], 'too near');
  assert.deepEqual(hideoutsOf(17, miniWorld([T(1, 0, 0, 8), T(2, 15, 0, 8)])), [], 'too far');
  assert.equal(hideoutsOf(17, miniWorld(leg(), { routeOf: () => undefined })), undefined, 'a road unplanned: asked again');
  // wet ground: the next candidate
  const wet = (nx, nz) => !(nx === h.x && nz === h.z);
  const h2 = hideoutsOf(17, miniWorld(leg(), { dry: wet }))[0];
  assert.ok(h2 && (h2.px !== h.px || h2.py !== h.py), 'never on the wet');
  // a town on the spot: another
  const h3 = hideoutsOf(17, miniWorld([...leg(), T(950, h.px, h.py, 1)]))[0];
  assert.ok(h3 && (h3.px !== h.px || h3.py !== h.py), 'never on a town');
  // a big region: more bands, each its own leg
  const many = [];
  for (let i = 0; i < 80; i++) many.push(T(2000 + i, 100 + (i % 10) * 4, 100 + Math.floor(i / 10) * 4, 6));
  const hm = hideoutsOf(17, miniWorld(many));
  assert.equal(hm.length, 3);
  assert.equal(new Set(hm.map((x) => `${x.a}-${x.b}`)).size, 3, 'each its own leg');
  // two bands, two legs: never the same leg twice, whichever the seeds pick
  const two = [T(1, 100, 100, 8), T(2, 105, 100, 8), T(3, 110, 100, 8)];
  for (let i = 0; i < 37; i++) two.push(T(100 + i, 100 + i, 120, 1));
  for (let r = 1; r <= 12; r++) {
    const hr = hideoutsOf(r, miniWorld(two.map((t) => ({ ...t, region: r }))));
    assert.equal(hr.length, 2, `region ${r}`);
    assert.notEqual(`${hr[0].a}-${hr[0].b}`, `${hr[1].a}-${hr[1].b}`, `region ${r}: each its own leg`);
  }
});

test('LW12 its lives: each BAND_ERA_DAYS the dice may rout a band (ROUT_CHANCE - a region with a court\'s city the likelier) and its hideout stands empty BAND_VACANT_DAYS; then the next generation forms - walked once, the same at every minute asked (mutants: the chance, the vacancy, the count)', () => {
  assert.equal(BAND_ERA_DAYS, 60); assert.equal(BAND_VACANT_DAYS, 20);
  assert.deepEqual({ ...ROUT_CHANCE }, { patrolled: 0.45, wild: 0.15 });
  const h = hideoutsOf(17, miniWorld(leg()))[0];
  const wild = { ...h, key: 'O99.0', patrolled: false };
  let pr = 0, wr = 0;
  for (let e = 0; e < 2000; e++) { if (routOfEra(h, e) != null) pr++; if (routOfEra(wild, e) != null) wr++; }
  assert.ok(Math.abs(pr / 2000 - 0.45) < 0.05 && Math.abs(wr / 2000 - 0.15) < 0.04, `${pr} ${wr}`);
  const era = BAND_ERA_DAYS * DAY_MIN, vac = BAND_VACANT_DAYS * DAY_MIN;
  // across a year of eras: the generation is the routs whose vacancy has ended; empty within a vacancy
  const k0 = Math.floor(T0 / era);
  const before = genAt(h, (k0 - 1) * era - 1).gen;
  for (let e = k0 - 1; e < k0 + 6; e++) {
    const r = routOfEra(h, e);
    if (r == null) continue;
    assert.equal(genAt(h, r - 1).vacant, false);
    assert.equal(genAt(h, r + 1).vacant, true, 'empty from the rout');
    assert.equal(genAt(h, r + vac - 1).vacant, true);
    const after = genAt(h, r + vac + 1);
    assert.equal(after.vacant, false, 'the next band formed');
    assert.equal(after.gen, genAt(h, r - 1).gen + 1);
    assert.ok(Math.abs(after.formedT - (r + vac)) < 1e-6);
    assert.equal(bandAt(h, r + 1), null);
  }
  assert.ok(genAt(h, (k0 + 6) * era).gen >= before);
  // asked out of order: the same answers
  const t = T0 + 37 * DAY_MIN;
  const a = genAt(h, t);
  genAt(h, T0 + 400 * DAY_MIN);
  assert.deepEqual(genAt(h, t), a);
});

test('LW12 its people and name: BAND_SIZE of the thieves\' run and the fighters\' rough end, the leader the strongest, levels by the region\'s greatest town, ids `O<region>.<band>~<gen>.<i>`; named "the <word> <band>" or "<leader>\'s <band>"; a character\'s rout empties it BAND_VACANT_DAYS for them, then its heir forms - new people, a new name (mutants: the size, the classes, the leader, the level, the heir)', () => {
  assert.deepEqual([...BAND_SIZE], [4, 8]);
  assert.deepEqual([...OUTLAW_CLASSES], [MOBILE_TYPES.Thief, MOBILE_TYPES.Rogue, MOBILE_TYPES.Burglar, MOBILE_TYPES.Nightblade, MOBILE_TYPES.Barbarian, MOBILE_TYPES.Archer]);
  const h = hideoutsOf(17, miniWorld(leg()))[0];
  let t = T0;
  for (let i = 0; i < 2000 && !bandAt(h, t); i++) t += DAY_MIN;
  const band = bandAt(h, t);
  assert.ok(band.people.length >= 4 && band.people.length <= 8);
  assert.ok(band.people.every((p) => OUTLAW_CLASSES.includes(p.cls)));
  assert.ok(band.people.every((p, i) => p.id === `O17.0~${band.gen}.${i}`));
  assert.ok(band.people.slice(1).every((p) => p.level <= band.people[0].level), 'the leader the strongest');
  const base = 2 + Math.floor(24 / 6);
  assert.equal(band.people[0].level, base + 3);
  assert.equal(band.level, band.people[0].level);
  assert.deepEqual(bandAt(h, t + 60), band, 'the same all its generation');
  assert.match(band.name, /^(the \w+ \w+|\w+'s \w+)$/);
  const names = new Set();
  for (let g = 0; g < 60; g++) names.add(bandName(`O1.0~${g}`, 'Ada Lark'));
  assert.ok([...names].some((n) => n.startsWith('Ada\'s ')) && [...names].some((n) => n.startsWith('the ')), 'both forms');
  const small = bandPeople({ ...h, top: 1 }, 'O1.0~1');
  assert.equal(small[0].level, 2 + 3, 'a small region\'s outlaws are green');
  // the character's rout: empty for them, then the heir
  const routs = new Map([[`${h.key}@${band.gen}.0`, { t: t + 10 }]]);
  assert.deepEqual(bandAt(h, t + 5, routs), band, 'a rout to come is none yet');
  assert.equal(bandAt(h, t + 11, routs), null);
  assert.equal(bandAt(h, t + 10 + BAND_VACANT_DAYS * DAY_MIN - 1, routs), null);
  const heir = bandAt(h, t + 10 + BAND_VACANT_DAYS * DAY_MIN + 1, routs);
  if (heir && heir.gen === band.gen) {
    assert.equal(heir.heir, 1);
    assert.equal(heir.key, `${h.key}~${band.gen}h1`);
    assert.notEqual(heir.people[0].name, band.people[0].name);
  }
});

/** The trips of the leg's towns, troubled with the band's hold-ups. */
function legTrips(days = 120, extra = {}) {
  const towns = leg();
  const world = miniWorld(towns);
  const hs = hideoutsOf(17, world);
  const tw = { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10), bandAt: (trip, px, py, t) => bandTrouble(trip, px, py, t, hs), ...extra };
  world.fate = (trip) => troubledTrip(trip, troubleOf(trip, tw));
  const got = new Map();
  for (let day = 0; day < days; day++) for (const town of [towns[2], towns[3]]) for (const tr of townTrips(town, T0 + day * DAY_MIN + 720, world, { mpm: CALENDAR_MPM, memo: new Map() }) ?? []) got.set(tr.id, tr);
  return { hs, tw, trips: [...got.values()] };
}

test('LW12 the hold-up on the dice: a trouble within OUTLAW_REACH_PX of a hideout is the band\'s in BAND_SHARE of them (the trip\'s own draw) - its people the foes at their levels, its name on the encounter; a party under ROB_RATIO of the band yields, ROBBED: no blood, held HALT_MIN.robbed, on without its goods (its cargo a quarter); a stronger fights; a fight the player won for it, won; every other trouble the land\'s as it was (mutants: the reach, the share, the ratio, the robbed, the stream)', () => {
  assert.equal(BAND_SHARE, 0.6); assert.equal(ROB_RATIO, 0.6); assert.equal(TROUBLE_ROB_RATIO, ROB_RATIO);
  assert.equal(HALT_MIN.robbed, 30); assert.equal(FIGHT_MIN.robbed, 10);
  const { hs, trips } = legTrips();
  const band = trips.filter((tr) => tr.enc?.band);
  assert.ok(band.length >= 3, `${band.length} hold-ups`);
  for (const tr of band) {
    const b = bandAt(hs[0], tr.enc.t0);
    assert.equal(tr.enc.band, b.key);
    assert.equal(tr.enc.bandName, b.name);
    assert.deepEqual(tr.enc.foes, b.people.slice(0, 6).map((p) => p.cls));
    assert.equal(tr.enc.level, Math.round(b.people.slice(0, 6).reduce((a, p) => a + p.level, 0) / Math.min(6, b.people.length)), 'at their own levels');
    assert.ok(Math.max(Math.abs(tr.enc.px - hs[0].px), Math.abs(tr.enc.py - hs[0].py)) <= OUTLAW_REACH_PX);
  }
  const robbed = band.filter((tr) => tr.enc.kind === 'robbed');
  assert.ok(robbed.length >= 1);
  for (const tr of robbed) {
    assert.equal(tr.enc.t1 - tr.enc.t0, HALT_MIN.robbed);
    assert.equal(tr.enc.fightEnd - tr.enc.t0, FIGHT_MIN.robbed);
    assert.deepEqual(tr.fallen, [], 'no blood');
    assert.equal(tr.turned, false, 'it walks on');
    assert.deepEqual(tr.robbed, { t: tr.enc.t0, by: tr.enc.band });
    assert.equal(cargoOf(tr, tr.enc.t0 + 1), CARGO_ROBBED);
    assert.ok(cargoOf(tr, tr.enc.t0 - 1) !== CARGO_ROBBED);
  }
  // the share: of troubles near a hideout standing a band, BAND_SHARE the band's (the trip's own draw)
  let tb = T0;
  for (let i = 0; i < 2000 && !bandAt(hs[0], tb); i++) tb += DAY_MIN;
  assert.ok(bandAt(hs[0], tb));
  let theirs = 0;
  for (let i = 0; i < 3000; i++) if (bandTrouble({ id: `L903.t${i}:1` }, hs[0].px, hs[0].py + 1, tb, hs)) theirs++;
  assert.ok(Math.abs(theirs / 3000 - BAND_SHARE) < 0.03, `${theirs / 3000}`);
  assert.equal(bandTrouble({ id: 'x' }, hs[0].px + OUTLAW_REACH_PX + 1, hs[0].py, tb, hs), null, 'beyond its reach');
  let tv = T0;
  for (let i = 0; i < 2000 && !genAt(hs[0], tv).vacant; i++) tv += DAY_MIN;
  assert.ok(genAt(hs[0], tv).vacant, 'a rout in five years');
  assert.ok([...Array(200)].every((_, i) => bandTrouble({ id: `L903.t${i}:1` }, hs[0].px, hs[0].py, tv, hs) == null), 'an empty hideout robs nobody');
  // two hideouts in reach, the nearer empty: the other's band
  const far2 = { ...hs[0], key: 'O17.9', px: hs[0].px + 1 };
  let tw2 = tv;
  for (let i = 0; i < 4000 && !(genAt(hs[0], tw2).vacant && !genAt(far2, tw2).vacant); i++) tw2 += DAY_MIN;
  const ids = [...Array(50)].map((_, i) => `L903.t${i}:2`);
  const got2 = ids.map((id) => bandTrouble({ id }, hs[0].px, hs[0].py, tw2, [hs[0], far2])).filter(Boolean);
  assert.ok(got2.length > 0 && got2.every((g) => g.band.hideout.key === 'O17.9'), 'the next band in reach');
  // with no band about, the trouble is the land's as it was - the dice's stream untouched. AUDIT LW-II (the tests): over
  // the same 120 days as the bands' (40 against 120 compared three trips)
  const { trips: plain } = legTrips(120, { bandAt: () => null });
  const { trips: none } = legTrips(120, { bandAt: undefined });
  assert.deepEqual(plain.map((tr) => tr.enc ?? null), none.map((tr) => tr.enc ?? null));
  const sameNone = new Map(none.map((tr) => [tr.id, tr]));
  const other = trips.filter((tr) => tr.enc && !tr.enc.band);
  assert.ok(other.length >= 10 && other.every((tr) => sameNone.has(tr.id)), `${other.length} of the land's troubles, each compared`);
  for (const tr of other) assert.deepEqual(tr.enc, sameNone.get(tr.id).enc);
  // ... and a band's falls where and when the land's did: its own draw, never the stream's
  for (const tr of band) assert.deepEqual([tr.enc.id, tr.enc.leg, tr.enc.t0, tr.enc.s], [sameNone.get(tr.id)?.enc?.id, sameNone.get(tr.id)?.enc?.leg, sameNone.get(tr.id)?.enc?.t0, sameNone.get(tr.id)?.enc?.s]);
  // the player's fight for a robbed party: won
  const r0 = robbed[0];
  const { trips: turned } = legTrips(120, { turnOf: (id) => (id === r0.enc.id ? 'won' : null) });
  const again = turned.find((tr) => tr.id === r0.id);
  assert.equal(again.enc.kind, 'won');
  assert.equal(again.robbed, undefined, 'nothing taken');
});

test('LW12 the take: the parties the band robbed since it formed and within TAKE_DAYS - each its share of a counter\'s purse (TAKE_PURSE_SHARE; else ROB_GOLD) and TAKE_GOODS of its goods, to TAKE_GOODS_MAX; another band\'s not its own (mutants: the window, the share, the goods)', () => {
  assert.deepEqual([TAKE_DAYS, TAKE_PURSE_SHARE, ROB_GOLD, TAKE_GOODS, TAKE_GOODS_MAX], [14, 0.25, 40, 2, 16]);
  const band = { key: 'O1.0~3', formedT: 1000 };
  const r = (id, kind, t0, b = 'O1.0~3', blocks = 8) => ({ id, kind, from: { blocks }, enc: { kind: 'robbed', band: b, t0 } });
  const t = 1000 + 20 * DAY_MIN;
  const trips = [
    r('a', 'merchant', t - 1), r('b', 'pilgrim', t - 2), r('a', 'merchant', t - 1),
    r('c', 'pedlar', t - TAKE_DAYS * DAY_MIN - 5), r('d', 'merchant', t - 3, 'O1.1~0'), r('e', 'courier', t + 5),
    { id: 'f', kind: 'merchant', enc: { kind: 'won', band: 'O1.0~3', t0: t - 4 } },
  ];
  const take = takeOf(band, trips, t);
  assert.deepEqual(take.robbed.map((x) => x.id), ['a', 'b']);
  assert.equal(take.gold, Math.round(purseOf(CARAVAN_QUALITY({ from: { blocks: 8 } })) * TAKE_PURSE_SHARE) + ROB_GOLD);
  assert.equal(take.goods, 2 * TAKE_GOODS);
  const lots = Array.from({ length: 20 }, (_, i) => r(`x${i}`, 'pilgrim', t - i));
  assert.equal(takeOf(band, lots, t).goods, TAKE_GOODS_MAX);
  assert.equal(takeOf({ ...band, formedT: t - 3 }, trips, t).robbed.length, 2, 'since it formed');
  assert.equal(takeOf({ ...band, formedT: t }, trips, t).robbed.length, 0);
});

test('LW12 heard of and told: the road\'s news of a hold-up names the band; a town of its region tells of a rout by the player; the routed tale, the heard and looted marks ride the save as add-only kinds (mutants: the band named, the region, the kinds)', () => {
  assert.deepEqual([...TALE_KINDS], ['home', 'routed', 'held']);   // PIN MOVED (LW16): a party robbed, charged
  assert.deepEqual([...MARK_KINDS], ['laid', 'heard', 'looted']);
  const trip = { id: 'L1.t0:3', leader: { name: 'Ada Lark' }, to: { name: 'Wayrest' }, backT1: 100, enc: { id: 'L1.t0:3:e', kind: 'robbed', foes: [138], band: 'O1.0~2', bandName: 'the Black Hand' } };
  const n = newsOf([trip], 200);
  assert.equal(n[0].band, 'the Black Hand');
  assert.equal(n[0].kind, 'robbed');
  assert.equal(ROAD_NEWS.robbed.length, 3);
  assert.ok(ROAD_NEWS.robbed.some((sc) => fillLine(sc[0], { who: 'Ada', foe: 'the Black Hand', place: 'Wayrest' }).includes('the Black Hand')));
  let routed = null;
  for (let s = 0; s < 200 && !routed; s++) routed = newsScript(s, [{ kind: 'routed', who: 'the Black Hand' }]);
  assert.ok(routed && ROUTED_NEWS.includes(routed.script));
  const rel = createRelations();
  rel.turn('routed', 'O17.0@3.0', { t: 500, who: 'the Black Hand' });
  rel.turn('heard', 'O17.0~3');
  rel.turn('looted', 'O17.0~3');
  const back = createRelations(JSON.parse(JSON.stringify(rel.snapshot())));
  assert.equal(back.turns().routed.get('O17.0@3.0').who, 'the Black Hand');
  assert.ok(back.turns().heard.has('O17.0~3') && back.turns().looted.has('O17.0~3'));
  const lt = readFileSync(new URL('../src/systems/livingWorld/livingTown.js', import.meta.url), 'utf8');
  assert.match(lt, /const region = `O\$\{\(town\.region \?\? -1\) >>> 0\}\.`;/);   // PIN MOVED (LW16): any town's deeds (the word a visitor carries)
  assert.match(lt, /if \(!key\.startsWith\(region\) \|\| known > t \|\| t - known >= NEWS_DAYS \* DAY_MIN \|\| !h\.who\) continue;\n\s*out\.push\(\{ kind: 'routed',/);
});

/** A hideouts host over one hideout and its band, its deps recorded. */
function hostOver({ band = null, here = null, t = 12 * 60, owner = true, looted = false, robbed = [], items = () => [{ name: 'Rope' }, { name: 'Gold' }] } = {}) {
  const h = { key: 'O17.0', x: 0, z: 0, region: 17 };
  const rel = createRelations();
  if (looted && band) rel.turn('looted', band.key);
  const log = { spawned: [], removed: [], said: [], piles: [], removedPiles: [] };
  const clock = { t, here: here ?? { x: 50 * NATIVE_PER_M, z: 0 } };
  const deps = {
    hideoutsNear: () => [h], bandAt: () => band, clock: () => clock.t, here: () => clock.here, ready: () => true, owner: () => owner,
    sceneOf: (nx, nz) => [nx / NATIVE_PER_M, 0, nz / NATIVE_PER_M],
    spawn: (type, feet, o) => { const rec = { type, feet, o, dead: false, entity: {} }; log.spawned.push(rec); return Promise.resolve(rec); },
    remove: (rec) => log.removed.push(rec), inPool: (rec) => log.spawned.includes(rec) && !log.removed.includes(rec),
    relations: () => rel, say: (s) => log.said.push(s),
    chest: () => ({ items: items(), robbed }),
    dropPile: (items) => { const pile = { items: [...items] }; log.piles.push(pile); return pile; },
    removePile: (p) => log.removedPiles.push(p),
  };
  return { host: createHideouts(deps), log, clock, rel, h, deps };
}
const tick = async (host, n = 1) => { for (let i = 0; i < n; i++) { host.frame(1.01); await new Promise((r) => setImmediate(r)); } };
const someBand = () => ({ key: 'O17.0~3', gen: 3, heir: 0, name: 'the Black Hand', people: [0, 1, 2, 3, 4].map((i) => ({ id: `O17.0~3.${i}`, name: `Out ${i}`, cls: 138, level: 5 + i, sex: 'male' })) });

test('LW12 the hideout stood: on foot within BAND_LIVE_M, the one standing it - its tents about a fire, its people as the pool\'s foes by name and level (by night half), its chest of its take; an empty hideout its tents alone; let go past BAND_KEEP_M - the living taken out, a chest taken from looted for the character (mutants: the reach, the night, the chest, the looted, the let-go)', async () => {
  assert.deepEqual([BAND_LIVE_M, BAND_KEEP_M], [200, 280]);
  assert.deepEqual([...HIDEOUT_DAY_H], [6, 20]);
  const band = someBand();
  assert.equal(standingAt(band, 12 * 60).length, 5);
  assert.equal(standingAt(band, 23 * 60).length, 3, 'by night half, the rest on the road');
  assert.equal(standingAt(band, 5 * 60).length, 3);
  assert.equal(tentsFor(1), 2); assert.equal(tentsFor(3), 2); assert.equal(tentsFor(5), 2); assert.equal(tentsFor(8), 3);
  const far = hostOver({ band, here: { x: (BAND_LIVE_M + 5) * NATIVE_PER_M, z: 0 } });
  await tick(far.host);
  assert.equal(far.host.shown(), null, 'beyond its reach');
  const no = hostOver({ band, owner: false });
  await tick(no.host);
  // PIN MOVED (AUDIT LW-II C11b): another player stands its people - its camp and its chest every reader's own
  assert.deepEqual(no.host.shown(), { key: 'O17.0', band: band.key, foes: 0, tents: 2, pile: true, routed: false }, 'another player stands its people');
  assert.equal(no.log.spawned.length, 0);
  const { host, log, clock, rel } = hostOver({ band });
  await tick(host);
  assert.deepEqual(host.shown(), { key: 'O17.0', band: band.key, foes: 5, tents: 2, pile: true, routed: false });
  assert.deepEqual(log.spawned.map((r) => r.o.level), [5, 6, 7, 8, 9]);
  assert.ok(log.spawned.every((r, i) => r.entity.name === `Out ${i}` && r.o.allied === false));
  assert.ok(log.spawned.every((r) => { const d = Math.hypot(r.feet[0], r.feet[2]); return d >= 3 - 1e-6 && d <= 9 + 1e-6; }));
  // taken from, then left: looted for them
  log.piles[0].items.pop();
  clock.here = { x: (BAND_KEEP_M + 5) * NATIVE_PER_M, z: 0 };
  await tick(host);
  assert.equal(host.shown(), null);
  assert.equal(log.removed.length, 5, 'the living taken out');
  assert.equal(log.removedPiles.length, 1);
  assert.ok(rel.turns().looted.has(band.key));
  // looted: no chest again
  const again = hostOver({ band, looted: true });
  await tick(again.host);
  assert.equal(again.host.shown().pile, false);
  // by night
  const night = hostOver({ band, t: 23 * 60 });
  await tick(night.host);
  assert.equal(night.host.shown().foes, 3);
  // an empty hideout: its tents, nobody, no chest
  const empty = hostOver({ band: null });
  await tick(empty.host);
  assert.deepEqual(empty.host.shown(), { key: 'O17.0', band: null, foes: 0, tents: 2, pile: false, routed: false });
  // a chest left untouched is not looted
  const left = hostOver({ band });
  await tick(left.host);
  left.clock.here = { x: 1e9, z: 0 };
  await tick(left.host);
  assert.equal(left.rel.turns().looted.has(band.key), false);
});

test('LW12 routed: every one of its people down - the character\'s tale (`routed`, by its hideout and generation, its name), the thanks of the parties it robbed of late, the word; once (mutants: the rout, the key, the thanks)', async () => {
  const band = { ...someBand(), heir: 1 };
  const robbed = [{ party: [{ id: 'L903.t1' }, { id: 'L903.t2' }] }];
  const { host, log, rel } = hostOver({ band, robbed });
  await tick(host);
  log.spawned.slice(0, 4).forEach((r) => { r.dead = true; r.corpse = true; });   // PIN MOVED (AUDIT LW-II C3): killed as the pool kills - a body
  await tick(host);
  assert.equal(host.shown().routed, false, 'one stands');
  log.spawned[4].dead = true; log.spawned[4].corpse = true;
  await tick(host, 2);
  assert.equal(host.shown().routed, true);
  assert.equal(rel.turns().routed.get('O17.0@3.1')?.who, 'the Black Hand', 'by its hideout, generation and heir');
  assert.ok(rel.regard('L903.t1', 0) > 0 && rel.regard('L903.t2', 0) > 0, 'the robbed thank the player');
  assert.deepEqual(log.said.filter((s) => /routed/.test(s)), ['You have routed the Black Hand.']);
});

test('LW12 heard of: a band near the player not yet heard of is warned of in a traveller\'s greeting and kept (`heard`); a heard band\'s hideout marked on the Overworld as a ring about a point near it, "Hideout of ... (rumoured)" (mutants: the near, the heard, the ring)', async () => {
  assert.equal(HEARD_PX, 3);
  assert.equal(RUMOUR_OFF_N, NATIVE_PIXEL / 2);
  const band = someBand();
  const { host, rel, h } = hostOver({ band });
  assert.equal(host.unheardNear(0, 0, 0)?.key, band.key);
  assert.equal(host.unheardNear(HEARD_PX * NATIVE_PIXEL + 1, 0, 0), null, 'too far to have heard');
  assert.deepEqual(host.marks(0, 0, 0), [], 'none heard');
  rel.turn('heard', 'O99.0~1');
  assert.deepEqual(host.marks(0, 0, 0), [], 'another band heard of');
  host.heard(band);
  assert.ok(rel.turns().heard.has(band.key));
  assert.equal(host.unheardNear(0, 0, 0), null, 'heard once');
  const m = host.marks(0, 0, 0);
  assert.equal(m.length, 1);
  assert.equal(m[0].label, 'Hideout of the Black Hand (rumoured)');
  assert.equal(m[0].kind, 'wayfarer hideout');
  const p = rumourAt(h, band.key);
  assert.ok(Math.hypot(p.x - h.x, p.z - h.z) <= RUMOUR_OFF_N + 1e-6);
  assert.deepEqual(m[0].at, [p.x / NATIVE_PER_M, 0, p.z / NATIVE_PER_M]);
  assert.ok(BAND_WARNINGS.every((w) => fillLine(w, { band: 'the Black Hand' }).includes('the Black Hand')));
  const roads = readFileSync(new URL('../src/scenes/livingRoads.js', import.meta.url), 'utf8');
  assert.match(roads, /const band = standing === 'enemy' \|\| standing === 'hostile' \? null : deps\.unheard\?\.\(t\) \?\? null;/);
  assert.match(roads, /if \(band\) \{ text = `\$\{text\} \$\{fillLine\(BAND_WARNINGS\[[^\]]+\], \{ band: band\.name \}\)\}`; deps\.heard\?\.\(band\); \}/);
  assert.match(roads, /const foe = pair\.warned \? \(pair\.warned\.trip\.enc\.bandName \?\? deps\.foeName/);
  assert.match(roads, /const beset = foes\.length \? \(p\.trip\.enc\?\.bandName \?\? deps\.foeName/);
  const hud = readFileSync(new URL('../src/ui/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /\} else if \(look === 'wayfarer' && \/\\bhideout\\b\/\.test\(m\.kind \?\? ''\)\) \{[^\n]*\n\s*g\.beginPath\(\); g\.arc\(x, y, TV_HIDEOUT_R, 0, Math\.PI \* 2\);/);
});

test('LW12 a caravan the outlaws held up: its purse theirs (a sale refused), half its goods gone - the band\'s, never the character\'s (mutants: the purse, the half, the band\'s)', () => {
  const lead = { id: 'L903.t1', name: 'Ada Lark', cls: null };
  const trip = { id: 'L903.t1:4', kind: 'merchant', from: { blocks: 8 }, leader: lead, party: [lead], robbed: { t: 100, by: 'O17.0~3' } };
  assert.equal(bandTook(trip, 99), false);
  assert.equal(bandTook(trip, 100), true);
  assert.equal(bandTook({ ...trip, robbed: { t: 100, by: null } }, 200), false, 'the character\'s own robbery is LW11\'s');
  const rel = createRelations();
  const said = [];
  let opened = null;
  const host = createCaravanHost({
    relations: () => rel, clock: () => 200, day: () => 0, roads: () => null, findTrip: () => trip, tripById: () => trip, resOf: () => lead,
    stock: () => [0, 1, 2, 3, 4, 5].map((i) => ({ name: `W${i}` })), openTrade: (o) => { opened = o; return true; }, openLoot: () => true,
    choose: () => {}, say: (s) => said.push(s), regionAt: () => 17, charge: () => {}, deadAt: () => false, here: () => null, level: () => 1,
    pay: () => {}, goldItem: (n) => n, online: () => false,
  });
  assert.deepEqual(host.shelfOf(trip).items.map((it) => it.name), ['W0', 'W2', 'W4']);
  host.step();
  assert.equal(rel.wares(trip.id), null, 'the band\'s take is never the character\'s gone');
  host.shelfOf(trip).items.splice(0, 1);
  host.step();
  assert.deepEqual([...rel.wares(trip.id).gone], [0], 'what the character took, and only that');
  const before = { ...trip, robbed: undefined, id: 'L903.t1:5' };
  assert.equal(host.shelfOf(before).items.length, 6);
  // the counter opened on a caravan the band held up, on the road after: a sale refused, a purchase the player's
  const { trips } = legTrips();
  const held = trips.find((tr) => tr.enc?.kind === 'robbed' && tr.kind === 'merchant');
  assert.ok(held, 'a merchant held up');
  let at = null;
  for (let x = Math.ceil(held.enc.t1) + 1; x < held.backT1 && at == null; x += 5) {
    const p = partyAt(held, x);
    if ((p.phase === 'out' || p.phase === 'back') && !p.camp && !p.halt) at = x;
  }
  assert.ok(at != null);
  const h2 = createCaravanHost({
    relations: () => rel, clock: () => at, day: () => 0, roads: () => null, findTrip: () => held, tripById: () => held, resOf: () => held.leader,
    stock: () => [{ name: 'W0' }, { name: 'W1' }], openTrade: (o) => { opened = o; return true; }, openLoot: () => true,
    choose: (lines, options) => options.find((o) => o.code === 'KeyS')?.action(), say: (s) => said.push(s), regionAt: () => 17, charge: () => {},
    deadAt: () => false, here: () => null, level: () => 1, pay: () => {}, goldItem: (n) => n, online: () => false,
  });
  assert.equal(h2.offers({ living: { res: held.leader } }, () => {}), true);
  assert.ok(opened);
  assert.deepEqual(opened.shelf.items.map((it) => it.name), ['W0'], 'half its goods');
  assert.equal(opened.allow('Sell', [], 1), false);
  assert.match(said.at(-1), /outlaws took every septim/);
  assert.equal(opened.allow('Buy', [], 1), true);
});

test('LW12 the host\'s wiring: the trouble world\'s bands over the trip\'s two regions and the character\'s routs, a region\'s towns, the hideouts kept by the network\'s generation, the host stood in the open world and freed indoors, its tents drawn, its rumoured marks, the news by the band\'s name (mutants: each wire)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /bandAt: \(trip, px, py, t\) => bandTrouble\(trip, px, py, t, \[\.\.\.livingHideoutsOf\(trip\.from\?\.region\), \.\.\.\(trip\.to\?\.region != null && trip\.to\.region !== trip\.from\?\.region \? livingHideoutsOf\(trip\.to\.region\) : \[\]\)\], livingRouts\(\)\),/);
  assert.match(w, /townsIn: \(region\) => livingTownsOfRegion\(region\),/);
  // PIN MOVED (AUDIT LW-II C8): the hideouts kept by hideouts.js createHideoutBook - by the network's generation, a
  // region waiting asked again now and then, the troubles read band-less made again once its bands are found
  assert.match(w, /const livingHideoutsOf = createHideoutBook\(\{\n\s*of: \(region\) => hideoutsOf\(region, livingTripWorld\),\n\s*generation: \(\) => livingWays\.generation,\n\s*resolved: \(\) => \{ _livingFates\.clear\(\); _livingTripMemo\.clear\(\); \},\n\s*\}\);/);
  assert.match(w, /const livingRouts = \(\) => livingRelations\.turns\(\)\.routed;/);
  assert.match(w, /if \(livingWorldOn\(\) && _mode\(\) === 'exterior' && !tvf\) \{ livingHideoutsHostOf\(\)\.frame\(dt\); livePersonBatches\.push\(\.\.\.livingHideoutsHostOf\(\)\.batches\(\)\); \}/);
  assert.match(w, /\n\s*else _livingHideoutsHost\?\.clear\(\);/);
  assert.match(w, /_livingHideoutsHost\?\.draw\(renderer\);   \/\/ LW12/);
  assert.match(w, /for \(const m of livingHideoutsHostOf\(\)\.marks\(hereN\.x, hereN\.z, skyMinutes\(\)\)\) if \(markShown\(\{ kind: m\.kind \}\)\) marks\.push\(/);
  assert.match(w, /foe: n\.band \?\? \(n\.foe != null \? livingFoeWord\(n\.foe, 2\) : ''\)/);
  assert.match(w, /spawn: \(type, feet, o\) => exteriorFoes\.spawnFoe\(type, feet, \{ yaw: o\.yaw, gender: o\.gender, level: o\.level, allied: false, loose: true, transient: true, managed: true \}\),/);   // PIN MOVED (AUDIT LW-II C3): managed - the host owns their lives
  // AUDIT LW-II C3: the pool's relevance cull passes a managed foe by (DW-E4's own law), and marks a kill with its body
  const foes = readFileSync(new URL('../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  assert.match(foes, /if \(!f\.placed && !f\.managed && _playerDist > _cullAt/);
  assert.match(foes, /f\.dead = true;\n[^\n]*\n[^\n]*\n\s*f\.corpse = true;/);
  assert.match(w, /dropPile: \(items, feet\) => droppedLoot\.seedPile\(items, feet, \{ archive: TREASURE_PILE_ARCHIVE, record: 0 \}, null, null, \{ unsaved: true, owner: 'lw-hideout' \}\),/);
  assert.match(w, /unheard: \(t\) => \{ const h = livingHideoutsHostOf\(\), here = playerSpawned \? state\.worldCoords\(player\.pos\) : null; return here \? h\.unheardNear\(here\.x, here\.z, t\) : null; \},/);
});

// ═══════════════════════════════════════════════════════════════════
// AUDIT LW-II (2026-10-10): THE OUTLAWS, AUDITED - each finding reproduced, fixed, and pinned below.

test('AUDIT LW-II C2: a hand in the chest is `looted` the frame it shows - a piece taken and another put in its place, before any let-go; a save made while it stands carries it, and the chest stands empty from that save (mutants: the frame, the pieces, the counts)', async () => {
  const band = someBand();
  // a piece swapped: the count the same
  const { host, log, rel } = hostOver({ band });
  await tick(host);
  const pile = log.piles[0];
  assert.equal(rel.turns().looted.has(band.key), false, 'untouched');
  host.frame(0.01);
  assert.equal(rel.turns().looted.has(band.key), false, 'a frame untouched keeps nothing');
  const gold = pile.items.findIndex((it) => it.name === 'Gold');
  pile.items.splice(gold, 1, { name: 'Rag' });
  host.frame(0.01);   // the next frame - within the second, no let-go
  assert.ok(host.shown(), 'still stood');
  assert.ok(rel.turns().looted.has(band.key), 'looted the frame it showed');
  // saved while it stood, loaded: no chest
  const save = JSON.parse(JSON.stringify(rel.snapshot()));
  assert.ok(save.turns.looted.includes(band.key));
  const back = hostOver({ band });
  const loaded = createRelations(save);
  const h2 = createHideouts({ ...back.deps, relations: () => loaded });
  await tick(h2);
  assert.equal(h2.shown().pile, false, 'the loaded character took from it');
  // a stack split: the pieces the same, a count less
  const split = hostOver({ band, items: () => [{ name: 'Rope' }, { name: 'Gold', stackCount: 900 }] });
  await tick(split.host);
  split.log.piles[0].items[1].stackCount = 400;
  split.host.frame(0.01);
  assert.ok(split.rel.turns().looted.has(band.key), 'a handful of its gold taken');
});

test('AUDIT LW-II C3: a band routed by blows alone - every one stood killed (dead with a body, or executed); one the cull took, one escaped, one taken out beat nobody (mutants: the kill, the cull, the latch)', async () => {
  assert.equal(killed({ dead: true, corpse: true }), true);
  assert.equal(killed({ dead: true, executed: true }), true, 'executed');
  assert.equal(killed({ dead: true }), false, 'the cull\'s: no body');
  assert.equal(killed({ dead: true, escaped: true }), false, 'escaped');
  assert.equal(killed({ dead: false, corpse: true }), false);
  const band = someBand();
  // walked up to: the cull took them all, a frame after they stood
  const culled = hostOver({ band });
  await tick(culled.host);
  culled.log.spawned.forEach((r) => { r.dead = true; });
  await tick(culled.host, 2);
  assert.deepEqual([culled.host.shown().routed, culled.rel.turns().routed.size], [false, 0], 'never routed by walking up');
  // gone from the pool (taken out by another layer): none
  const out = hostOver({ band });
  await tick(out.host);
  out.log.removed.push(...out.log.spawned);
  await tick(out.host, 2);
  assert.equal(out.host.shown().routed, false, 'gone from the pool beat nobody');
  // killed, each latched as it fell (its body later collected), the last executed: routed
  const won = hostOver({ band });
  await tick(won.host);
  won.log.spawned.slice(0, 4).forEach((r) => { r.dead = true; r.corpse = true; });
  await tick(won.host);
  won.log.spawned.slice(0, 4).forEach((r) => { r.corpse = false; });
  won.log.spawned[4].dead = true; won.log.spawned[4].executed = true;
  await tick(won.host);
  assert.equal(won.host.shown().routed, true);
  // a band whose chest the character emptied before: its robbed thank the player all the same
  const robbed = [{ party: [{ id: 'L903.t7' }] }];
  const emptied = hostOver({ band, robbed, looted: true });
  await tick(emptied.host);
  assert.equal(emptied.host.shown().pile, false);
  emptied.log.spawned.forEach((r) => { r.dead = true; r.corpse = true; });
  await tick(emptied.host);
  assert.ok(emptied.rel.regard('L903.t7', 0) > 0, 'looted or not, its robbed are the rout\'s');
});

test('AUDIT LW-II C8: the hideouts kept - a region waiting on its roads answers none and is asked again no sooner than HIDEOUTS_ASK_MS; its bands found are told once (only when it waited); a new network asks again; and two readers whose roads were planned apart read every trouble the same (mutants: the ask, the told, the generation, the books made again)', () => {
  assert.equal(HIDEOUTS_ASK_MS, 100);
  let ms = 0, gen = 0, planned = false, asks = 0;
  const told = [];
  const h = { key: 'O17.0' };
  const book = createHideoutBook({ of: (r) => { asks++; return planned ? (r === 17 ? [h] : []) : undefined; }, generation: () => gen, now: () => ms, resolved: (r) => told.push(r) });
  assert.deepEqual(book(17), []);
  assert.deepEqual([book(17), book(17), asks], [[], [], 1], 'waiting: a look-up, never its legs again');
  ms += HIDEOUTS_ASK_MS - 1;
  book(17);
  assert.equal(asks, 1);
  ms += 1;
  book(17);
  assert.equal(asks, 2, 'asked again');
  planned = true;
  ms += HIDEOUTS_ASK_MS;
  assert.deepEqual(book(17), [h]);
  assert.deepEqual(book(17), [h]);
  assert.deepEqual([told, asks], [[17], 3], 'told once, kept');
  assert.deepEqual(book(18), []);
  assert.deepEqual(told, [17], 'found at its first asking (and none): nothing to make again');
  assert.deepEqual([book(null), book(NaN)], [[], []]);
  gen++;
  assert.deepEqual(book(17), [h]);
  assert.equal(asks, 5, 'a new network: asked again');
  assert.deepEqual(told, [17], 'found at once there: nothing to make again');
  // two readers, the second's band legs planned ten askings later (r10): every trip's trouble the same
  const client = (plannedAfter, resolved = true) => {
    const towns = leg();
    const world = miniWorld(towns);
    let n = 0, now = 0;
    const legWorld = { ...world, routeOf: (a, b) => (n < plannedAfter ? undefined : straightRoute(a, b)) };
    const fates = new Map(), memo = new Map();
    const hideouts = createHideoutBook({ of: (r) => { n++; return hideoutsOf(r, legWorld); }, generation: () => 0, now: () => (now += HIDEOUTS_ASK_MS), resolved: resolved ? () => { fates.clear(); memo.clear(); } : undefined });
    const tw = { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10), bandAt: (trip, px, py, t) => bandTrouble(trip, px, py, t, hideouts(17)) };
    world.fate = (trip) => { let f = fates.get(trip.id); if (!f) { f = troubledTrip(trip, troubleOf(trip, tw)); fates.set(trip.id, f); } return f; };
    const got = new Map();
    for (let pass = 0; pass < 2; pass++) for (let day = 0; day < 120; day++) for (const town of [towns[2], towns[3]]) for (const tr of townTrips(town, T0 + day * DAY_MIN + 720, world, { mpm: CALENDAR_MPM, memo }) ?? []) got.set(tr.id, tr);
    return got;
  };
  const kindOf = (tr) => (tr.enc ? `${tr.enc.kind}${tr.enc.band ? '@band' : ''}` : 'none');
  const differ = (A, B) => [...A].filter(([id, a]) => B.has(id) && kindOf(a) !== kindOf(B.get(id))).length;
  const A = client(0);
  assert.ok([...A.values()].some((tr) => tr.enc?.band), 'the band holds the road up');
  assert.equal(differ(A, client(10)), 0, 'the late reader\'s troubles the same');
  assert.ok(differ(A, client(10, false)) > 0, 'kept band-less, they were not');
});

test('AUDIT LW-II C9: a hold-up near the leg\'s end - its halt past the arrival - still leaves the party robbed, out or home (mutants: the halt past the end)', () => {
  const lead = { id: 'L1.t1', cls: null };
  const trip = { id: 'L1.t1:3', kind: 'merchant', from: { blocks: 24 }, party: [lead], leader: lead, outT0: 1000, outT1: 1100, backT0: 3000, backT1: 3100, trim0: 0, trim1: 0, pace: 1, way: { len: 100 } };
  const enc = (t0, leg = 'out') => ({ id: `${trip.id}:e`, leg, camp: false, t0, t1: t0 + HALT_MIN.robbed, fightEnd: t0 + FIGHT_MIN.robbed, s: 50, x: 0, z: 0, px: 0, py: 0, foes: [1], level: 5, kind: 'robbed', shape: 'robbed', dead: [], band: 'O17.0~0', bandName: 'the Black Hand' });
  assert.deepEqual(troubledTrip(trip, enc(1050)).robbed, { t: 1050, by: 'O17.0~0' }, 'well short of the town');
  const late = troubledTrip(trip, enc(1085));
  assert.deepEqual([late.robbed, late.outT1], [{ t: 1085, by: 'O17.0~0' }, 1115], 'its halt past the arrival: robbed, and in late');
  const home = troubledTrip(trip, enc(3085, 'back'));
  assert.deepEqual([home.robbed, home.backT1], [{ t: 3085, by: 'O17.0~0' }, 3115], 'on the way home too');
  assert.equal(troubledTrip(trip, { ...enc(1085), kind: 'won' }).robbed, undefined, 'a fight won: nothing taken');
});

test('AUDIT LW-II C11b/C11c: online the camp is every reader\'s and its people the one standing it\'s - taken up when it falls to this player; another character\'s records (a load) let the hideout go with nothing of it written into theirs (mutants: the camp, the take-up, the load)', async () => {
  const band = someBand();
  let mine = false;
  const { log, deps } = hostOver({ band });
  const h = createHideouts({ ...deps, owner: () => mine });
  await tick(h);
  assert.deepEqual([h.shown().foes, h.shown().tents, h.shown().pile, log.spawned.length], [0, 2, true, 0], 'the camp, not its people');
  mine = true;
  await tick(h);
  assert.equal(h.shown().foes, 5, 'fallen to this player: its people stood');
  await tick(h, 2);
  assert.equal(log.spawned.length, 5, 'once');
  // a load while it stood: the chest touched in the same frame - let go, the loaded character untouched
  const l = hostOver({ band });
  let now = l.rel;
  const lh = createHideouts({ ...l.deps, relations: () => now });
  await tick(lh);
  l.log.piles[0].items.pop();
  now = createRelations();
  lh.frame(0.01);
  assert.equal(lh.shown(), null, 'let go');
  assert.equal(now.turns().looted.has(band.key), false, 'nothing of it the loaded character\'s');
  assert.equal(l.log.removedPiles.length, 1, 'its chest taken up');
  assert.ok(l.log.removed.length === 5, 'its people taken out');
  await tick(lh);
  assert.equal(lh.shown()?.pile, true, 'stood again for the loaded character, its chest theirs');
});
