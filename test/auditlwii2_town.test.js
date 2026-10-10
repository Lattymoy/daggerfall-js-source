// AUDIT LW-II-2 (2026-10-10), lane "town": the second audit of THE LIVING WORLD II's patrons' client (LW15) and its
// word carried (LW16) - systems/livingWorld/livingTown.js (the patrons' word in a day's plans, the buyer by the place),
// lines.js (a sentence's capital), and the host's seams in scenes/world.js (the region's read, the carried word's last
// day and its modal frame). Each fix held against the real producers: the census through LivingTown over the synthetic
// town (test/lwTown.mjs), dayPlan, the service's own law, and the host's own source lifted out of world.js and run with
// its seams stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown, DEED_KNOWN_MIN } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN, dayPlan } from '../src/systems/livingWorld/dayPlan.js';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus, travellerRoster, mintResident } from '../src/systems/livingWorld/census.js';
import { patronOf, patronWords, PATRON_DELAY_DAYS, PATRON_STAY_MIN } from '../src/systems/livingWorld/patrons.js';
import { placeKeyOf } from '../src/systems/livingWorld/lives.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { heardOf, HEARD_SHARE } from '../src/systems/livingWorld/carried.js';
import { fillLine, HEARD_GREETINGS, ROUTED_NEWS, ROAD_NEWS, BAND_WARNINGS, ROAD_PASS_WARNINGS } from '../src/systems/livingWorld/lines.js';
import { outlawBandName } from '../src/systems/livingWorld/outlaws.js';
import { patronMinute } from '../src/net/patronLaw.js';
import { skyMinutesPerMsAt, SKY_SEGMENTS } from '../src/net/skyLaw.js';
import { NAV_CELL } from '../src/world/cityNavigation.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const D = 50 * DAY_MIN;
const TOWN = Object.freeze({ mapId: 777, blocks: 9, region: 17, people: 3 });
/** A LivingTown over the synthetic town, its census the real one. @param {any} [o] @param {any} [size] */
function makeTown(o = {}, size = {}) {
  const { nav, buildings, doors } = synthTown(size);
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => D + 600, rate: () => 0.2, mpm: CALENDAR_MPM, ...o,
  });
  return { town, nav, buildings };
}
/** The online pace's walk (TIME1: a real hour a sky day) - the host's livingBaseRate online, off the sky's law. */
const ONLINE_MPM = PERSON_MOVE_SPEED / (skyMinutesPerMsAt(SKY_SEGMENTS.at(-1).fromMs) * 1000);

test('AUDIT LW-II-2 W1: a crew hand\'s plan under a patrons\' word is made once - asked again, and again once the word moves, the same array and the plans\' count unmoved (never signed, it was made again at every read of a town with any word, and the stir and the walks with it) (mutants: W1-asked-alone)', () => {
  const { nav, buildings, doors } = synthTown();
  const far = travellerRoster({ mapId: 888, blocks: 9, region: 17, people: 3, port: true }).find((r) => r.job === 'sailor');
  const crews = [{ res: far, inT: D + 12 * 60, outT: D + 14 * 60 }];
  let word = { v: 1, told: [], traders: [buildings[2].key] };
  const town = new LivingTown(nav, {
    town: { ...TOWN, port: true }, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => D + 13 * 60, rate: () => 0.2, mpm: CALENDAR_MPM, harbour: () => ({ x: -30, z: (nav.height * NAV_CELL) / 2 }),
    ashore: () => null, crews: () => crews, patronsOf: () => word,
  });
  town._crewsNow();
  const day = town.dayOf(D + 13 * 60);
  const plan = town.planOf(far, day), gen = town._planGen;
  assert.ok(plan.length > 0);
  assert.equal(town.planOf(far, day), plan, 'asked again: the same plan');
  word = { v: 2, told: [], traders: [] };
  assert.equal(town.planOf(far, day), plan, 'the word moved: a crew\'s day reads none of it');
  assert.equal(town._planGen, gen, 'no plan made');
});

test('AUDIT LW-II-2 W5: a new sale makes again the day of the one who walks it and no other - one walked two days on leaves every plan of today the same array and the plans\' count unmoved; one walked today makes the buyer\'s day again alone, the errand walked; the traders\' doors moved make every household\'s again (a browser reads them) (it made the whole town\'s day again in one frame: 37 ms on a 12x12 town) (mutants: W5-kept, W5-doors)', () => {
  let word = null;
  const { town } = makeTown({ patronsOf: () => word });
  const day = 120, people = town.peopleOf(day);
  const door = [...town.places.doors.keys()].find((k) => !people.some((r) => r.home === k));
  word = { v: 1, told: [], traders: [door] };
  const plans = new Map(people.map((r) => [r.id, town.planOf(r, day)]));
  const gen = town._planGen;
  // a sale told today: its patron comes two days on
  word = { v: 2, told: [{ door, t: day * DAY_MIN + 240 + 600, seed: 5 }], traders: [door] };
  for (const r of people) assert.equal(town.planOf(r, day), plans.get(r.id), `${r.id}: the same plan`);
  assert.equal(town._planGen, gen, 'no plan made');
  // a sale told two days back: walked today, by its buyer alone
  const buyer = patronOf(7, town.residents);
  word = { v: 3, told: [...word.told, { door, t: (day - PATRON_DELAY_DAYS) * DAY_MIN + 240 + 600, seed: 7 }], traders: [door] };
  assert.deepEqual(people.filter((r) => town.planOf(r, day) !== plans.get(r.id)).map((r) => r.id), [buyer.id], 'the buyer\'s day alone');
  const m = day * DAY_MIN + 240 + 600, at = town.places.doors.get(door);
  assert.ok(town.planOf(buyer, day).some((e) => e.kind === 'shop' && e.at === at && e.t0 <= m && e.t1 >= m + PATRON_STAY_MIN), 'the errand walked, in at its minute');
  // the doors a browser looks in moved: every household's day made again
  const now = new Map(people.map((r) => [r.id, town.planOf(r, day)]));
  word = { v: 4, told: word.told, traders: [] };
  assert.ok(people.every((r) => town.planOf(r, day) !== now.get(r.id)), 'every day that read the doors');
});

test('AUDIT LW-II-2 W2: a sale is dealt to a household\'s PLACE over the census - every reader\'s - and walked and named by whoever holds it that day on this one: a reader whose character struck a householder down agrees with every other on every sale but that place\'s, which it walks with nobody and names "a townsperson of" its town; a newcomer in the place walks it and is named (dealt over the day\'s people, nine in ten of the town\'s sales went to another than every other reader dealt: the pool\'s order moved) (mutants: W2-named-by-place, W2-walked-by-place)', () => {
  const size = { blocksW: 6, blocksH: 6 }, T36 = { ...TOWN, blocks: 36 };
  const today = 500, t = (today - PATRON_DELAY_DAYS) * DAY_MIN + 240 + 600;
  let word = null;
  const peer = makeTown({ town: T36, holderOf: (r) => r, patronsOf: () => word }, size).town;
  const victim = peer.residents.filter((r) => r.roll === 'h' && !r.guard)[3];
  const vacant = makeTown({ town: T36, holderOf: (r) => (r.id === victim.id ? null : r), patronsOf: () => word }, size).town;
  const newcomer = makeTown({ town: T36, holderOf: (r) => (r.id === victim.id ? mintResident(T36, r.roll, r.slot, r.job, { gen: 7, home: r.home, work: r.work }) : r), patronsOf: () => word }, size).town;
  let hit = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const place = patronOf(seed, peer.residents);
    const a = peer.patronOfSale(seed, t), b = vacant.patronOfSale(seed, t), c = newcomer.patronOfSale(seed, t);
    if (place.id !== victim.id) { assert.deepEqual([b?.id, c?.id], [a.id, a.id], `seed ${seed}: every reader alike`); continue; }
    hit++;
    assert.equal(a.id, victim.id);
    assert.equal(b, null, 'vacant here: nobody');
    assert.equal(patronWords(b, 'Synth'), 'a townsperson of Synth');
    assert.deepEqual([placeKeyOf(c), c.id === victim.id, c.name !== victim.name], [victim.id, false, true], 'the newcomer holding it');
  }
  assert.ok(hit >= 3, `${hit} sales dealt to the place`);
  // the day's walks: each sale walked by the same one on every reader - the vacant place's by none, the newcomer's by him
  const door = [...peer.places.doors.keys()].find((k) => !peer.peopleOf(today).some((r) => r.home === k));
  word = { v: 1, told: Array.from({ length: 300 }, (_, i) => ({ door, t: (today - PATRON_DELAY_DAYS) * DAY_MIN + 240 + 2 * i, seed: i + 1 })), traders: [] };
  const walks = (town) => new Map(town.peopleOf(today).map((r) => [r.id, town._patronsFor(r, today).errands?.length ?? 0]).filter(([, n]) => n > 0));
  const p = walks(peer), v = walks(vacant), n = walks(newcomer);
  assert.ok(p.get(victim.id) > 0, 'the place dealt a sale');
  const others = new Map([...p].filter(([id]) => id !== victim.id));
  assert.deepEqual(v, others, 'the vacant place walked by none, every other alike');
  const nc = newcomer.peopleOf(today).find((r) => placeKeyOf(r) === victim.id && r.id !== victim.id);
  assert.equal(n.get(nc.id), p.get(victim.id), 'the newcomer walks the place\'s');
  assert.deepEqual(new Map([...n].filter(([id]) => id !== nc.id)), others, 'every other alike');
  // one wed into the character's line (LEGACY5): their census place the line's - the town's holderOf empties it - and they
  // live here beyond the census as the line's (extraPeople: legacyHost spousesOf, the census's own renamed): they hold it
  const wedId = [...others.keys()].find((id) => id !== victim.id);
  const wed = peer.residents.find((r) => r.id === wedId);
  const extra = [{ ...wed, name: 'Wed Lark', household: 'F1', legacy: { familyId: 1, personId: 2 } }];
  const line = makeTown({ town: T36, holderOf: (r) => (r.id === wed.id ? null : r), extraPeople: () => extra, patronsOf: () => word }, size).town;
  let wedSales = 0;
  for (let seed = 1; seed <= 2000; seed++) if (patronOf(seed, line.residents).id === wed.id) { wedSales++; assert.equal(line.patronOfSale(seed, t), extra[0], 'the one wed in named'); }
  assert.ok(wedSales > 0);
  assert.equal(walks(line).get(wed.id), p.get(wed.id), 'and walks the place\'s');
});

test('AUDIT LW-II-2 W4/H4: the Vendor page names a sale\'s buyer off the households alone - three past days\' sales named ask the host\'s roads nothing and leave the street\'s word for today where it was (each was a whole cold read of the town\'s roads, and two put today\'s out: 191 ms one render); kept by the day; a newcomer holding the place named (AUDIT LW-II B12 holds) (mutants: W4-no-roads, W4-kept)', () => {
  const asked = [];
  let held = 0;
  const { town } = makeTown({
    holderOf: (r) => { held++; return r.roll === 'h' && r.slot === 3 ? { ...r, id: `${r.id}~1`, name: 'New Comer' } : r; },
    tripsOf: (day) => { asked.push(day); return { away: new Map(), visitors: [], holders: new Map(), news: [], places: [] }; },
  });
  const today = 500;
  town.peopleOf(today);
  assert.deepEqual(asked.splice(0), [today]);
  const sales = [today - 5, today - 9, today - 14].map((d) => ({ seed: 12345 + d, t: d * DAY_MIN + 240 + 300 }));
  for (const s of sales) assert.ok(town.patronOfSale(s.seed, s.t)?.name, 'named');
  assert.deepEqual(asked, [], 'the roads asked nothing');
  assert.equal(town._roads.day, today, 'the street\'s word today\'s');
  // kept by the day: named again, the lives not read again
  const was = held;
  for (const s of sales) town.patronOfSale(s.seed, s.t);
  assert.equal(held, was, 'kept');
  // the newcomer holding the place is the one named
  const placed = town.residents.find((r) => r.roll === 'h' && r.slot === 3);
  let named = 0;
  for (let seed = 0; seed < 400; seed++) {
    if (patronOf(seed, town.residents).id !== placed.id) continue;
    named++;
    assert.deepEqual([town.patronOfSale(seed, sales[0].t).id, town.patronOfSale(seed, sales[0].t).name], [`${placed.id}~1`, 'New Comer']);
  }
  assert.ok(named > 0);
});

/** The host's patrons' read (world.js, LW15), lifted whole and run with the market stubbed - its answers settled by hand. */
function liftPatrons({ online = true, built = new Map() } = {}) {
  const a = W.indexOf('  const PATRON_READ_S = 600;');
  const b = W.indexOf('  /** LW15: who of a town a patron\'s sale names');
  assert.ok(a > 0 && b > a, 'the host\'s read found');
  const asked = [], pending = [];
  const marketBook = { vendors: (region) => { asked.push(region); return new Promise((res) => pending.push(res)); } };
  const make = new Function('deps', `const { params, marketBook, skyClassicMinutes, built, LivingTown, playerTravelPixel, maps } = deps;\n${W.slice(a, b)}\nreturn { livingPatronsStep, livingPatronsRegion, _livingPatrons };`);
  const host = make({
    params: new Map(online ? [['online', '1']] : []), marketBook, skyClassicMinutes: (ms) => ms / 2500, built, LivingTown,
    playerTravelPixel: () => ({ x: 207, y: 212 }), maps: { getRegionIndexAt: (x, y) => (x === 207 && y === 212 ? 17 : -1) },
  });
  const answer = (region) => ({ ok: true, data: { rows: [{ map: region * 100, buildingKey: 7, home: { entry: 'public' } }], patrons: [] } });
  /** Settle the oldest read out with `r` (the region's own answer by default), and let its promise run. */
  const settle = async (r) => { pending.shift()(r); for (let i = 0; i < 4; i++) await new Promise((res) => setImmediate(res)); };
  return { ...host, asked, pending, answer, settle };
}

test('AUDIT LW-II-2 W3/H8: each region\'s read its own clock - a step in region 17, then one in region 5 a minute later reads region 5 at once; region 17 again read only PATRON_READ_S on; a region asked while a read is out remembered and read once it settles (ASYNC NEVER DROPS); a failed read asked again PATRON_RETRY_S on, not a whole PATRON_READ_S; offline never (one clock for every region left a region crossed into unread ten real minutes - four living hours online) (mutants: W3-own-clock, W3-remembered, W3-settled, W3-failed, P17 LW15P-read-s)', async () => {
  const h = liftPatrons();
  h.livingPatronsStep(1000, () => 17);
  assert.deepEqual(h.asked, [17]);
  await h.settle(h.answer(17));
  assert.ok(h._livingPatrons.has(1700));
  h.livingPatronsStep(1060, () => 5);
  assert.deepEqual(h.asked, [17, 5], 'region 5 read at once');
  await h.settle(h.answer(5));
  assert.ok(h._livingPatrons.has(500), 'its town known');
  h.livingPatronsStep(1300, () => 17);
  h.livingPatronsStep(1599, () => 17);
  assert.deepEqual(h.asked, [17, 5], 'region 17 read 300 and 599 s ago: not again');
  h.livingPatronsStep(1600, () => 17);
  assert.deepEqual(h.asked, [17, 5, 17], 'PATRON_READ_S on');
  // a region asked while that read is out: remembered, read when it settles
  h.livingPatronsStep(1601, () => 9);
  h.livingPatronsStep(1602, () => 9);
  assert.deepEqual(h.asked, [17, 5, 17], 'one read out at a time');
  await h.settle(h.answer(17));
  assert.deepEqual(h.asked, [17, 5, 17, 9], 'region 9 read once 17\'s settled');
  // that read fails: asked again a minute on, not ten
  await h.settle({ ok: false, error: 'busy' });
  h.livingPatronsStep(1602 + 58, () => 9);
  assert.deepEqual(h.asked, [17, 5, 17, 9]);
  h.livingPatronsStep(1602 + 60, () => 9);
  assert.deepEqual(h.asked, [17, 5, 17, 9, 9], 'a failed read asked again PATRON_RETRY_S on');
  assert.match(W, /const PATRON_RETRY_S = 60;/);
  // offline: never
  const off = liftPatrons({ online: false });
  off.livingPatronsStep(1000, () => 17);
  assert.deepEqual(off.asked, []);
});

test('AUDIT LW-II-2 W11: the patrons\' read runs only while a living town stands - in the wilderness (no built LivingTown, a fixed city\'s pool) its region is none and nothing is read; with one standing, the region the player stands in; the host\'s frame asks it so (a read there was /vendors and up to two hundred of the service\'s statements each PATRON_READ_S, for towns nobody walks) (mutants: W11-a-living-town, W11-the-frame)', async () => {
  const built = new Map([['207,211', { population: { pool: [] } }], ['206,212', { population: null }]]);
  const h = liftPatrons({ built });
  assert.equal(h.livingPatronsRegion(), null, 'the wilderness: none');
  h.livingPatronsStep(1000, h.livingPatronsRegion);
  assert.deepEqual(h.asked, [], 'nothing read');
  built.set('207,212', { population: Object.create(LivingTown.prototype) });
  assert.equal(h.livingPatronsRegion(), 17, 'a living town stands: the region the player stands in');
  h.livingPatronsStep(1001, h.livingPatronsRegion);
  assert.deepEqual(h.asked, [17]);
  assert.match(W, /if \(livingWorldOn\(\) && _mode\(\) === 'exterior'\) livingPatronsStep\(Date\.now\(\) \/ 1000, livingPatronsRegion\);/);
});

/** The host's carried word (world.js, LW16), lifted whole and run with its generator stubbed: each day's word takes three
 *  slices to work, as a town about read cold does. */
function liftCarried() {
  const a = W.indexOf('  const _livingCarried = new Map();');
  const b = W.indexOf('  // LW5: THE BAY\'S SAILORS');
  assert.ok(a > 0 && b > a, 'the host\'s word found');
  const make = new Function('deps', `let { livingMemoFresh, livingTurnsFresh, livingWays, livingRelations, livingVisitsGen, PERSON_MOVE_SPEED, livingBaseRate, _livingTripMemo, _livingVisitorsKept, _livingToldKept } = deps;
${W.slice(a, b)}
return { livingCarriedOf, livingCarriedStep };`);
  const visitsOf = (day) => [{ id: `v${day}`, from: { mapId: 2, name: 'Wayrest' }, inT: day * DAY_MIN + 600, outT0: day * DAY_MIN + 300, news: [] }];
  return make({
    livingMemoFresh() {}, livingTurnsFresh() {}, livingWays: { generation: 1 }, livingRelations: { turnsVersion: () => 0 },
    livingVisitsGen: function* (town, day) { yield; yield; yield; return visitsOf(day); },
    PERSON_MOVE_SPEED, livingBaseRate: () => 0.4, _livingTripMemo: new Map(), _livingVisitorsKept: new Map(), _livingToldKept: new Map(),
  });
}

test('AUDIT LW-II-2 W7: AUDIT LW-II B11 at the day\'s turn - a town whose day\'s word is done tells it while the next day\'s is worked (its strangers\' regard and heard words never blink out: the next day\'s key had none, and the town told nothing for every frame its working took), then the next day\'s own (mutants: W7-last)', () => {
  const h = liftCarried();
  const town = { mapId: 1 };
  assert.equal(h.livingCarriedOf(town, 10), null, 'nothing yet');
  for (let f = 0; f < 4; f++) h.livingCarriedStep(1e9);
  assert.deepEqual(h.livingCarriedOf(town, 10).map((v) => v.id), ['v10']);
  // the day turns: day 11's word worked over frames with no budget left - day 10's told meanwhile
  for (let f = 0; f < 5; f++) { assert.deepEqual(h.livingCarriedOf(town, 11)?.map((v) => v.id), ['v10'], `frame ${f}`); h.livingCarriedStep(0); }
  for (let f = 0; f < 4; f++) h.livingCarriedStep(1e9);
  assert.deepEqual(h.livingCarriedOf(town, 11).map((v) => v.id), ['v11'], 'then its own');
  assert.equal(h.livingCarriedOf({ mapId: 2 }, 11), null, 'another town tells none of it');
});

test('AUDIT LW-II-2 H7: the carried word is worked in the modal frame too, beside the caravans\' step - a town first asked from a room (a save loaded in its tavern, a day begun abed) told none of it all its stay, the open world\'s frame alone working it (mutants: H7-modal)', () => {
  const modal = W.indexOf('    if (modes.frame(dt, now)) {');
  const back = W.indexOf('      requestAnimationFrame(frame);\n      return;\n    }', modal);
  assert.ok(modal > 0 && back > modal, 'the modal frame found');
  const frame = W.slice(modal, back);
  assert.match(frame, /caravanStep\(dt\);[^\n]*\n\s+if \(livingWorldOn\(\)\) livingCarriedStep\(LIVING_CARRIED_SLICE_MS\);/, 'beside the caravans\' step, before the modal frame returns');
  assert.match(W.slice(back), /if \(livingWorldOn\(\)\) livingCarriedStep\(LIVING_CARRIED_SLICE_MS\);   \/\/ LW16/, 'and the open world\'s');
});

test('AUDIT LW-II-2 W8 / C11: a token that opens a sentence opens it with a capital - at the line\'s start, or after a stop and a space - and a band\'s minted "the" with it ("The Hanged Company are finished"); mid-sentence it keeps its case; no line of the band\'s pools opens a sentence in lower case (mutants: W8-start, W8-stop, W8-mid)', () => {
  let band = null;
  for (let i = 0; i < 50 && !band; i++) { const n = outlawBandName(`O17.h${i}~0`, 'Ada Lark'); if (n.startsWith('the ')) band = n; }
  assert.ok(band, 'a band minted "the ..."');
  const Band = band[0].toUpperCase() + band.slice(1);
  assert.equal(fillLine(HEARD_GREETINGS.routed[1], { who: band }), `${Band} are finished, they say - and you're why.`, 'the line\'s start');
  assert.equal(fillLine(BAND_WARNINGS[2], { band }), `Watch the trees. ${Band} have a camp somewhere about.`, 'after a stop');
  assert.equal(fillLine(ROUTED_NEWS[1][0], { who: band, player: 'Mac' }), `Have you heard? ${Band} are finished. Mac saw to it.`, 'after a question');
  assert.equal(fillLine(BAND_WARNINGS[1], { band }), `They say ${band} hide out near here. Keep your purse close.`, 'mid-sentence its own case');
  assert.equal(fillLine(ROAD_NEWS.won[0][0], { who: 'Ada', foe: band, place: 'Wayrest' }), `Ada came through a hard fight with ${band} near Wayrest.`);
  assert.equal(fillLine('{a}! {who} came by.', { a: 'friend', who: band }), `Friend! ${Band} came by.`, 'after an exclamation');
  assert.equal(fillLine('{foe} on the road.', {}), 'Brigands on the road.', 'a token\'s fallback alike');
  const ctx = { who: band, foe: band, band, player: 'Mac', place: 'Wayrest', from: 'Wayrest' };
  const pools = [HEARD_GREETINGS.routed, ROUTED_NEWS.flat(), BAND_WARNINGS, ROAD_PASS_WARNINGS.flat(), ROAD_NEWS.robbed.flat().map((l) => [l, { ...ctx, who: 'Ada' }])];
  let lines = 0;
  for (const pool of pools) for (const l of pool) { const [text, c] = Array.isArray(l) ? l : [l, ctx]; lines++; assert.doesNotMatch(fillLine(text, c), /(^|[.?!]\s+)[a-z]/, text); }
  assert.ok(lines > 10);
});

test('AUDIT LW-II-2 W10: the word carried is the host\'s alone (`carriedOf` - the roads\' read, the host\'s livingTripsOf, hands its away, visitors, holders, news and places, never a word), told once the host has it; and at the ONLINE pace (a real hour a sky day) a patron\'s errand is still walked - 557 of 13,832 dropped (4.03%) where the calendar\'s drops 34 (0.25%) (mutants: LW16-host-word, W10-late-online, W10-leave-online)', () => {
  const visit = { id: 'v1', from: { mapId: 1, region: 17, name: 'Wayrest' }, outT0: D + 600, inT: D + 900, courier: false, news: [{ id: 'a9', enc: 'ea9', kind: 'fell', who: 'Ada Lark', foe: 'Orcs', place: 'Ripmarket', t: D + 100 }] };
  const roads = { away: new Map(), visitors: [], holders: new Map(), news: [], places: [] };
  const day = Math.floor((D + 600 - 240) / DAY_MIN);
  const hosted = makeTown({ tripsOf: () => roads, relations: () => createRelations(), carriedOf: (d) => (d === day ? [visit] : null) }).town;
  hosted._roadsOf(day);
  assert.deepEqual(hosted.carriedAt(D + 1000).map((x) => [x.key, x.from]), [['trip:a9', 'Wayrest']], 'the host\'s told');
  assert.match(W, /return \{ away, visitors, holders, news, places \};/);
  // the online pace: the measure of test/lw16_word.test.js's B2 at the walk a real hour a sky day gives
  assert.equal(ONLINE_MPM, CALENDAR_MPM / 2);
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const hh = census.filter((r) => r.roll === 'h' && !r.guard && r.home != null && places.doors.get(r.home));
  const houses = [...places.doors.values()];
  let missing = 0, total = 0;
  for (let dd = 300; dd < 304; dd++) for (const r of hh) for (let k = 0; k < 30; k++) {
    const h2 = houses[(dd * 7 + r.slot + k) % houses.length];
    if (h2 === places.doors.get(r.home)) continue;
    total++;
    if (!dayPlan(r, places, dd, { mpm: ONLINE_MPM, errands: [{ at: h2, from: dd * DAY_MIN + 540 + 16 * k, dur: PATRON_STAY_MIN }] }).some((e) => e.at === h2 && e.kind === 'shop')) missing++;
  }
  assert.equal(total, 13832);
  assert.ok(missing / total < 0.045, `${missing} of ${total} dropped at the online pace`);
});

test('AUDIT LW-II-2 P17: the laws no pin held - a stranger who heard speaks of ONE OF the deeds known, by their seed (each of three heard); a rout known in its region\'s towns DEED_KNOWN_MIN after (as every deed); a patron comes at any minute of the hour; a browser looks in at any of the town\'s public traders (mutants: LW16P-heard-pick, LW16P-routed-known-min, LW15P-minute-range, LW15P-browse-any-trader)', () => {
  // heardOf: one of the deeds, by the seed
  const deeds = [{ t: 3 }, { t: 2 }, { t: 1 }];
  const told = new Map(deeds.map((d) => [d, 0]));
  let n = 0;
  for (let s = 0; s < 4000; s++) { const d = heardOf(deeds, Math.imul(s + 1, 2654435761) >>> 0); if (d) { n++; told.set(d, told.get(d) + 1); } }
  assert.ok(Math.abs(n / 4000 - HEARD_SHARE) < 0.04);
  for (const [d, k] of told) assert.ok(k > n / 6, `the deed of ${d.t} told ${k} of ${n}`);
  // a rout: known DEED_KNOWN_MIN after, by its minute known
  const rel = createRelations();
  const { town } = makeTown({ relations: () => rel });
  const T = D + 50;
  rel.turn('routed', `O17.${T}`, { t: T, who: 'the Red Hand' });
  assert.deepEqual(town.deedNews(T + DEED_KNOWN_MIN - 1).filter((x) => x.kind === 'routed'), [], 'not before it is known');
  assert.deepEqual(town.deedNews(T + DEED_KNOWN_MIN).filter((x) => x.kind === 'routed').map((x) => [x.who, x.t]), [['the Red Hand', T + DEED_KNOWN_MIN]]);
  // the service's minute of the hour: any of its sixty
  const minutes = new Set();
  for (let l = 0; l < 200; l++) for (let hr = 0; hr < 50; hr++) minutes.add(patronMinute(`listing${l}`, 480000 + hr));
  assert.deepEqual([...minutes].sort((a, b) => a - b), Array.from({ length: 60 }, (_, i) => i));
  // a browser's errand: any of the public traders' houses
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const pair = [...places.doors.values()].slice(-2);
  const looked = pair.map(() => 0);
  for (let d = 200; d < 300; d++) for (const r of census.slice(0, 30)) {
    const plan = dayPlan(r, places, d, { mpm: CALENDAR_MPM, browse: pair });
    pair.forEach((h, i) => { if (plan.some((e) => e.kind === 'shop' && e.at === h && r.home !== h.key)) looked[i]++; });
  }
  assert.ok(looked.every((k) => k > 0), `${looked} looked in`);
});
