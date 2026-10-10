// LW16 (bible/06-Systems/Living-World-II.md "LW16"): THE WORD TRAVELS - what happens in one town is heard in the next.
// The law (systems/livingWorld/carried.js: the word a visit carries from its town as it stood when it set out, known
// from its coming in for NEWS_DAYS, a courier's one hop further; the character's repute, read and bounded); the town's
// talk of it (lines.js newsScript's CARRIED_SHARE, its opener, a party robbed's words); the living town's half on the
// synthetic town (test/lwTown.mjs: any town's deeds, the word carried in its talk, the repute, a stranger's regard and
// word); the host's seams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown, DEED_KNOWN_MIN } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN, dayPlan, PATRON_LATE_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { patronOf, PATRON_DELAY_DAYS } from '../src/systems/livingWorld/patrons.js';
import { placeKeyOf } from '../src/systems/livingWorld/lives.js';
import { circleLine } from '../src/systems/livingWorld/meetups.js';
import { createRelations, FRIEND_AT, ENEMY_AT } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { NEWS_DAYS, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import {
  carriedNews, reputeOf, reputeKind, regardWithRepute, heardOf, carriedKey, REPUTE, REPUTE_MAX, REPUTE_MIN, HEARD_SHARE, CARRIED_SHARE,
} from '../src/systems/livingWorld/carried.js';
import {
  newsScript, NEWS_SHARE, CARRIED_OPENERS, HEARD_GREETINGS, HELD_NEWS, ROAD_NEWS, LIVING_GREETINGS, fillLine, firstNameOf, TOKEN_FALLBACK,
} from '../src/systems/livingWorld/lines.js';
import { seededRng } from '../src/systems/wind.js';

const A = Object.freeze({ mapId: 1, region: 17, name: 'Wayrest' }), C = Object.freeze({ mapId: 3, region: 18, name: 'Farhold' });
const D = 50 * DAY_MIN;
const road = (id, t, extra = {}) => ({ id, enc: `e${id}`, kind: 'fell', who: 'Ada Lark', foe: 'Orcs', place: 'Ripmarket', t, dive: false, sea: false, ...extra });
const visit = (from, outT0, inT, news, extra = {}) => ({ id: `v${from.mapId}.${inT}`, from, outT0, inT, courier: false, news, ...extra });

test('LW16 the word carried: a visit tells what its town knew when it set out, known here from its coming in for NEWS_DAYS; never the town\'s own; carried by two, from the first in; its town\'s deeds as they stood; a courier\'s the word its town had heard too - one hop, never two (mutants: the window, the set-out, the own, the first, the deeds, the relay, the hop)', () => {
  const v1 = visit(A, D + 600, D + 900, [road('a1', D + 100), road('a2', D + 700)]);
  assert.deepEqual(carriedNews([v1], D + 1000).map((x) => [x.key, x.from, x.t, x.carried, x.who]), [['trip:a1', 'Wayrest', D + 900, true, 'Ada Lark']], 'known before they set out, from their coming in');
  assert.deepEqual(carriedNews([v1], D + 899), [], 'not before they come in');
  assert.equal(carriedNews([v1], D + 899 + NEWS_DAYS * DAY_MIN).length, 1);
  assert.equal(carriedNews([v1], D + 900 + NEWS_DAYS * DAY_MIN).length, 0, 'NEWS_DAYS after');
  assert.deepEqual(carriedNews([v1], D + 1000, { own: [road('a1', D + 100)] }), [], 'the town\'s own is its own');
  // carried by two: from the first in
  const v0 = visit(C, D + 150, D + 300, [road('a1', D + 100)]);
  assert.deepEqual(carriedNews([v1, v0], D + 1000).map((x) => [x.key, x.from, x.t]), [['trip:a1', 'Farhold', D + 300]]);
  assert.deepEqual(carriedNews([v0, v1], D + 1000).map((x) => [x.key, x.from, x.t]), [['trip:a1', 'Farhold', D + 300]]);
  // its town's deeds, as they stood when it set out
  const asked = [];
  const deedsAt = (town, m) => { asked.push([town.name, m]); return town.mapId === 1 ? [{ kind: 'routed', who: 'the Red Hand', foe: '', place: '', t: D + 200, seen: true }, { kind: 'home', who: 'Bo', foe: '', place: '', t: D + 650, seen: true }] : []; };
  const got = carriedNews([v1], D + 1000, { deedsAt });
  assert.deepEqual(asked, [['Wayrest', D + 600]]);
  assert.deepEqual(got.map((x) => [x.kind, x.from]).sort(), [['fell', 'Wayrest'], ['routed', 'Wayrest']], 'a deed known after they left stays behind');
  assert.equal(carriedKey({ kind: 'routed', who: 'the Red Hand', t: D + 200 }), `routed|the Red Hand|${D + 200}`);
  // a courier: the word its own town had heard by the time it set out - from the town it was first told in
  const second = visit(C, D - 900, D - 800, [road('c0', D - 1000)]);
  const heard = visit(C, D - 400, D + 100, [road('c1', D - 500)], { courier: true, relay: [second] });
  const late = visit(C, D + 650, D + 700, [road('c2', D + 640)]);
  const old = visit(C, D + 600 - NEWS_DAYS * DAY_MIN - 10, D + 600 - NEWS_DAYS * DAY_MIN, [road('c3', D + 600 - NEWS_DAYS * DAY_MIN - 20)]);
  const courier = visit(A, D + 600, D + 900, [], { courier: true, relay: [heard, late, old] });
  assert.deepEqual(carriedNews([courier], D + 1000).map((x) => [x.key, x.from, x.t]), [['trip:c1', 'Farhold', D + 900]], 'one hop: heard before it left, within its days');
  assert.deepEqual(carriedNews([{ ...courier, courier: false }], D + 1000), [], 'anyone else: their own town\'s alone');
  // a relayed deed keeps its name: carried direct and relayed, one item
  const both = carriedNews([courier, visit(C, D + 100, D + 950, [road('c1', D - 500)])], D + 1000);
  assert.deepEqual(both.map((x) => [x.key, x.t]), [['trip:c1', D + 900]]);
  const farDeeds = (tn) => (tn.mapId === 3 ? [{ kind: 'home', who: 'Di Fenn', foe: '', place: '', t: D - 700, seen: true }] : []);
  const deedTwice = carriedNews([courier, visit(C, D + 100, D + 950, [])], D + 1000, { deedsAt: farDeeds }).filter((x) => x.kind === 'home');
  assert.deepEqual(deedTwice.map((x) => [x.key, x.from, x.t]), [[`home|Di Fenn|${D - 700}`, 'Farhold', D + 900]], 'a deed relayed and carried: one, by its own minute');
});

test('LW16 the repute: a keepsake carried home, a band routed, a party robbed, one struck down where it was seen, a fight turned - REPUTE each, summed and held short of a friend\'s or an enemy\'s; a stranger\'s regard by it, a known face\'s their own; a stranger who heard speaks of it HEARD_SHARE of their words (mutants: each kind, the bounds, the order, the stranger, the share)', () => {
  assert.deepEqual({ ...REPUTE }, { saved: 4, helped: 2, routed: 5, slain: -8, robbed: -5 });
  assert.deepEqual([REPUTE_MAX, REPUTE_MIN], [FRIEND_AT - 1, ENEMY_AT + 1]);
  const kinds = [{ kind: 'home' }, { kind: 'routed' }, { kind: 'held' }, { kind: 'slain', seen: true }, { kind: 'slain', seen: false }, { kind: 'won', helped: true },
    { kind: 'fell', helped: false }, { kind: 'died' }, { kind: 'killed' }, { kind: 'died', kin: true, helped: true }, null];
  assert.deepEqual(kinds.map(reputeKind), ['saved', 'routed', 'robbed', 'slain', null, 'helped', null, null, null, null, null]);
  const r = reputeOf([{ kind: 'home', t: 5 }, { kind: 'won', helped: true, t: 9 }, { kind: 'slain', seen: true, t: 7 }, { kind: 'slain', seen: false, t: 8 }]);
  assert.deepEqual([r.regard, r.deeds.map((d) => d.t)], [4 + 2 - 8, [9, 7, 5]], 'summed; newest first');
  assert.equal(reputeOf(Array.from({ length: 12 }, (_, i) => ({ kind: 'routed', t: i }))).regard, REPUTE_MAX, 'never a friend');
  assert.equal(reputeOf(Array.from({ length: 12 }, (_, i) => ({ kind: 'slain', seen: true, t: i }))).regard, REPUTE_MIN, 'never an enemy');
  assert.deepEqual(reputeOf([]), { regard: 0, deeds: [] });
  assert.deepEqual([regardWithRepute(true, 12, 30), regardWithRepute(false, 12, 30)], [12, 30]);
  assert.equal(HEARD_SHARE, 0.5);
  assert.equal(heardOf([], 1), null);
  const deeds = [{ t: 2 }, { t: 1 }];
  let n = 0;
  for (let s = 0; s < 4000; s++) { const d = heardOf(deeds, Math.imul(s + 1, 2654435761) >>> 0); if (d) { n++; assert.ok(deeds.includes(d)); } }
  assert.ok(Math.abs(n / 4000 - HEARD_SHARE) < 0.04, `${n} of 4000`);
  assert.equal(heardOf(deeds, 12345), heardOf(deeds, 12345), 'every reader alike');
});

test('LW16 told: the town tells the word carried in CARRIED_SHARE of its news, on a draw of its own - a town with none tells its own as ever; the opener names the town it came from; a party robbed in its own words (mutants: the share, the draw, the opener, the words)', () => {
  assert.equal(CARRIED_SHARE, 0.3);
  const own = [road('o1', 1), road('o2', 2)], carried = [{ ...road('c1', 3), carried: true, from: 'Wayrest' }];
  // own alone: the law before LW16, replayed
  for (let seed = 0; seed < 600; seed++) {
    const rng = seededRng((seed ^ 0x4e455753) >>> 0);
    const got = newsScript(seed, own);
    if (rng() >= NEWS_SHARE) { assert.equal(got, null); continue; }
    const item = own[Math.floor(rng() * own.length)];
    assert.deepEqual([got.item, got.script], [item, ROAD_NEWS.fell[Math.floor(rng() * ROAD_NEWS.fell.length)]]);
  }
  let told = 0, far = 0;
  for (let seed = 0; seed < 6000; seed++) {
    const got = newsScript(seed, [...own, ...carried]);
    if (!got) continue;
    told++;
    if (!got.item.carried) continue;
    far++;
    assert.ok(CARRIED_OPENERS.includes(got.script[0]), 'the opener first');
    assert.ok(ROAD_NEWS.fell.some((s) => s.length === got.script.length - 1 && s.every((x, i) => x === got.script[i + 1])), 'then the news\'s own');
    assert.equal(newsScript(seed, [...own, ...carried]).script, got.script, 'the same script, the same array');
  }
  assert.ok(Math.abs(told / 6000 - NEWS_SHARE) < 0.03, 'the news told as often');
  assert.ok(Math.abs(far / told - CARRIED_SHARE) < 0.04, `${far} of ${told} carried`);
  let alone = 0;
  for (let seed = 0; seed < 2000; seed++) if (newsScript(seed, carried)) alone++;
  assert.ok(Math.abs(alone / 2000 - NEWS_SHARE) < 0.03, 'PIN MOVED (AUDIT LW-II B10): a town with only the word carried tells it as often as another its own');
  assert.equal(fillLine(CARRIED_OPENERS[0], { from: 'Wayrest' }), 'There\'s word from Wayrest.');
  assert.equal(TOKEN_FALLBACK.from, 'the next town');
  let held = 0;
  for (let seed = 0; seed < 200; seed++) { const got = newsScript(seed, [{ kind: 'held', who: 'Cy Moss', t: 1 }]); if (got) { held++; assert.ok(HELD_NEWS.includes(got.script)); } }
  assert.ok(held > 40, 'a party robbed told in its own words');
  assert.deepEqual(Object.keys(HEARD_GREETINGS), ['helped', 'saved', 'routed', 'slain', 'robbed']);
});

const RATE = CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
function makeTown(roads, extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const rel = createRelations();
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => D + 600, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, relations: () => rel, playerName: () => 'Mac', townName: 'Synth', tripsOf: () => roads, ...extra,
  });
  return { town, rel };
}

test('LW16 the living town: any town\'s deeds (the word a visitor carries from theirs); a party robbed and charged told in its region\'s towns; the word carried in its talk; its repute of the character; a stranger\'s regard by it, a known face\'s their own; a stranger who heard greets the character by it (mutants: the town, the held, the talk, the repute, the regard, the word)', () => {
  const roads = { away: new Map(), visitors: [], news: [road('own', D - 30, { helped: true, kind: 'won' })] };
  const day = Math.floor((D + 600 - 240) / DAY_MIN);
  let carried = [];
  const { town, rel } = makeTown(roads, { carriedOf: (d) => (d === day ? carried : null) });   // PIN MOVED (AUDIT LW-II-2 W10): the word through the host's carriedOf, the game's one path (the roads' word carried none - no producer wrote it)
  // any town's deeds
  rel.turn('slain', 'L1.4@3', { t: D + 100, seen: true, who: 'Bo Brine' });
  assert.deepEqual(town.deedNews(D + 1000, A).map((x) => [x.kind, x.who]), [['slain', 'Bo Brine']]);
  assert.deepEqual(town.deedNews(D + 1000), [], 'not this town\'s');
  // a party robbed, charged: its region's towns tell it
  rel.turn('held', `R17.${D + 50}~2`, { t: D + 50, who: 'Cy Moss' });
  assert.deepEqual(town.deedNews(D + 50 + DEED_KNOWN_MIN).map((x) => [x.kind, x.who, x.t]), [['held', 'Cy Moss', D + 50 + DEED_KNOWN_MIN]]);
  assert.deepEqual(town.deedNews(D + 49 + DEED_KNOWN_MIN), [], 'not before it is known');
  assert.deepEqual(town.deedNews(D + 50 + DEED_KNOWN_MIN, C).filter((x) => x.kind === 'held'), [], 'another region\'s towns not');
  assert.deepEqual(town.deedNews(D + 50 + DEED_KNOWN_MIN + NEWS_DAYS * DAY_MIN), [], 'NEWS_DAYS after');
  const lone = makeTown(roads);
  lone.rel.turn('held', `R17.${D + 50}~2`, { t: D + 50, who: 'Cy Moss' });
  assert.equal(lone.town.deedNews(D + 500).length, 1, 'a robbery alone is told');
  // the word carried in: a party from Wayrest come in, its fight the character turned and Bo struck down there
  carried = [visit(A, D + 600, D + 900, [road('a1', D + 100, { kind: 'won', helped: true })])];   // PIN MOVED (AUDIT LW-II-2 W10): the word through the host's carriedOf, the game's one path (the roads' word carried none - no producer wrote it)
  town._roadsOf(day);
  const ctx = town.lineCtx(D + 1000);
  const far = ctx.news.filter((x) => x.carried);
  assert.deepEqual(far.map((x) => [x.kind, x.who, x.from, x.t]).sort(), [['slain', 'Bo Brine', 'Wayrest', D + 900], ['won', 'Ada Lark', 'Wayrest', D + 900]]);
  assert.ok(!town.lineCtx(D + 800).news.some((x) => x.carried), 'not before they came in');
  assert.equal(town.carriedAt(D + 1000), town.carriedAt(D + 1000), 'kept by the minute');
  // the repute: its own fight turned (+2), the robbery charged (-5), and the word carried: a fight turned (+2), Bo (-8)
  const rep = town.reputeAt(D + 1000);
  assert.equal(rep.regard, 2 - 5 + 2 - 8);
  assert.deepEqual(rep.deeds.map((x) => x.kind), ['slain', 'won', 'held', 'won'], 'newest first');
  const [stranger, friend] = town.residents.filter((r) => r.roll === 'h');
  rel.note(friend.id, 'helped', day);
  town._now = D + 1000;
  assert.equal(town.regardOf(stranger), rep.regard, 'a stranger\'s by the repute');
  assert.equal(town.regardOf(friend), rel.regard(friend.id, day), 'a known face\'s their own');
  assert.equal(rel.known(stranger.id), false, 'read, never stored');
  // a stranger who heard greets the character by it, now and then
  const words = new Set(LIVING_GREETINGS.stranger.map((x) => fillLine(x, { player: 'Mac' })));
  const heardWords = new Set(Object.values(HEARD_GREETINGS).flat().flatMap((x) => rep.deeds.map((d) => fillLine(x, { player: 'Mac', who: firstNameOf(d.who), foe: d.foe, place: d.place }))));
  let heard = 0, plain = 0;
  for (let m = 0; m < 300; m++) {
    const w = town.greetingFor(stranger, D + 1000 + m * 7, true);
    if (heardWords.has(w)) heard++;
    else { assert.ok(words.has(w), w); plain++; }
  }
  assert.ok(heard > 60 && plain > 60, `${heard} heard, ${plain} plain`);
  // the host's word (`carriedOf`): none while it is worked, then told
  let ready = null;
  const hosted = makeTown({ away: new Map(), visitors: [], news: [] }, { carriedOf: (d) => (d === day ? ready : null) });
  hosted.town._roadsOf(day);
  assert.deepEqual(hosted.town.carriedAt(D + 1000), [], 'none while it is worked');
  ready = [visit(A, D + 600, D + 900, [road('a9', D + 100)])];
  assert.deepEqual(hosted.town.carriedAt(D + 1000).map((x) => x.key), ['trip:a9'], 'told once done');
  // with nothing known: as ever
  const quiet = makeTown({ away: new Map(), visitors: [], news: [] }, { carriedOf: () => [] });   // PIN MOVED (AUDIT LW-II-2 W10): the word through the host's carriedOf, the game's one path (the roads' word carried none - no producer wrote it)
  quiet.town._roadsOf(day);
  for (let m = 0; m < 100; m++) { const w = quiet.town.greetingFor(stranger, D + 1000 + m * 7, true); assert.ok(words.has(w)); }
  assert.deepEqual(quiet.town.reputeAt(D + 1000), { regard: 0, deeds: [] });
});

test('LW16 the host\'s seams: a town\'s carried word worked a slice a frame (a generator over the visits of these NEWS_DAYS days, each its town\'s news when it set out, a courier\'s the visits its town had had - one hop), the town told it once done; the kept word made again with the roads; a town\'s news at any minute; the talk\'s regard of a stranger by the repute; the talk\'s {from} (mutants: each seam)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /carriedOf: \(day\) => livingCarriedOf\(livingTown, day\),/);
  assert.match(w, /for \(const near of livingTripWorld\.townsNear\(town\.px \?\? 0, town\.py \?\? 0, TRIP_REACH_PX\)\) \{ if \(townTrips\(near, noon, livingTripWorld, o\) === undefined\) out\.partial = true; yield; \}\n\s+const vs = livingVisitorsCached\(town, day - d, o\);\n.*\n\s+yield;/);   // PIN MOVED (AUDIT LW-II B4): a town about still asked: partial;
  assert.match(w, /for \(let b = 0; b <= NEWS_DAYS; b\+\+\) \{ townTrips\(tr\.from, fromNoon - b \* 1440, livingTripWorld, o\); yield; \}/);
  assert.match(w, /const heard = relay && courier \? yield\* livingVisitsGen\(tr\.from, Math\.floor\(\(tr\.outT0 - 240\) \/ 1440\), o, false\) : \[\];/);
  assert.match(w, /const said = livingRoadNewsAt\(tr\.from, tr\.outT0, o\);\n\s+if \(!said\.whole\) out\.partial = true;/);   // PIN MOVED (AUDIT LW-II B4)
  assert.match(w, /whole: _livingToldKept\.get\(k\) === told,/);
  assert.match(w, /const courier = tr\.party\.some\(\(m\) => m\.job === 'courier'\);/);
  assert.match(w, /out\.push\(\{ id: tr\.id, from, inT: tr\.outT1, outT0: tr\.outT0, courier, news: said\.news,/);   // AUDIT LW-II-2 P12: a visit known here from its coming in (its trip's end), from the minute it set out
  assert.match(w, /e = \{ gen: livingVisitsGen\(town, day, \{ mpm: PERSON_MOVE_SPEED \/ livingBaseRate\(\), memo: _livingTripMemo \}, true\), visits: null, at: 0, map: town\.mapId >>> 0 \};/);
  assert.match(w, /return e\.visits \?\? _livingCarriedLast\.get\(town\.mapId >>> 0\) \?\? null;/);   // AUDIT LW-II B11: the last word while the next is worked
  assert.match(w, /if \(_livingWordRel !== livingRelations\) _livingCarriedLast\.clear\(\);/);
  assert.match(w, /if \(livingWorldOn\(\)\) livingCarriedStep\(LIVING_CARRIED_SLICE_MS\);/);
  assert.match(w, /const LIVING_CARRIED_SLICE_MS = 3;/);
  assert.match(w, /try \{ r = e\.gen\.next\(\); \} catch \(err\) \{[^\n]*r = \{ done: true, value: null \}; \}/);   // PIN MOVED (AUDIT LW-II B13): a throw never wedges the slice
  assert.match(w, /if \(r\.done\) \{ e\.visits = r\.value \?\? Object\.assign\(\[\], \{ partial: true \}\); e\.at = performance\.now\(\); _livingCarriedLast\.set\(e\.map, e\.visits\); \}/);   // PIN MOVED (AUDIT LW-II-2 W7): the town's last word kept as its day's is done
  assert.match(w, /if \(vs === undefined\) out\.partial = true;/);
  assert.match(w, /if \(heard\.partial\) out\.partial = true;/);
  assert.match(w, /if \(e\?\.visits\?\.partial && performance\.now\(\) - e\.at > LIVING_CARRIED_RETRY_MS\) e = null;/);
  assert.match(w, /const v = `\$\{livingWays\.generation\}\|\$\{livingRelations\.turnsVersion\(\)\}`;/);
  assert.match(w, /_livingCarried\.clear\(\); _livingVisitorsKept\.clear\(\); _livingToldKept\.clear\(\);/);
  assert.match(w, /livingWordFresh\(\);   \/\/ LW16: the town's news kept with the roads/);
  assert.match(w, /return \{ told, whole: _livingToldKept\.get\(k\) === told, news: newsOf\(told, t\)\.map/);
  assert.match(w, /if \(whole\) \{/);
  assert.match(w, /regard: livingRegardOf\(res, day\), personality:/);
  assert.match(w, /const lt = livingRelations\.known\(res\.id\) \? null : livingTownOfMap\(res\.town\);\n\s+return lt \? lt\.reputeAt\(\)\.regard : livingRelations\.regard\(res\.id, day\);/);
  const m = readFileSync(new URL('../src/systems/livingWorld/meetups.js', import.meta.url), 'utf8');
  assert.match(m, /from: told\?\.item\.from \?\? null,/);
  const lt = readFileSync(new URL('../src/systems/livingWorld/livingTown.js', import.meta.url), 'utf8');
  assert.match(lt, /const visits = this\._roads \? this\.o\.carriedOf\?\.\(this\._roads\.day\) : null;/);   // PIN MOVED (AUDIT LW-II-2 W10): the host's word alone
});

test('AUDIT LW-II LW16: a visit\'s deeds read once, not every minute; a courier\'s relay of the town\'s own word never told back to it, nor its own region\'s tales; the road\'s news counted only once the town knows it; a band named whole in the talk (mutants: B3, B8, B9, B14)', () => {
  const roads = { away: new Map(), visitors: [], news: [road('own', D + 700, { helped: true, kind: 'won' })] };
  const day = Math.floor((D + 600 - 240) / DAY_MIN);
  let carried = [];
  const { town, rel } = makeTown(roads, { carriedOf: (d) => (d === day ? carried : null) });   // PIN MOVED (AUDIT LW-II-2 W10): the word through the host's carriedOf, the game's one path (the roads' word carried none - no producer wrote it)
  rel.turn('slain', 'L1.4@3', { t: D + 100, seen: true, who: 'Bo Brine' });
  carried = [visit(A, D + 600, D + 900, [])];
  town._roadsOf(day);
  // B3: the visit's deeds read once - the next minute's read asks none again
  let reads = 0;
  const deedNews = town.deedNews.bind(town);
  town.deedNews = (t, tn) => { if (tn && tn !== town.o.town) reads++; return deedNews(t, tn); };
  town.carriedAt(D + 1000);
  const first = reads;
  town.carriedAt(D + 1001); town.carriedAt(D + 1002);
  assert.deepEqual([first, reads], [1, 1], 'once, for the visit');
  // B9: the road's news of a fight turned, its party home at D + 700: not before
  assert.ok(!town.reputeAt(D + 650).deeds.some((x) => x.kind === 'won'), 'not known yet');
  assert.ok(town.reputeAt(D + 1000).deeds.some((x) => x.kind === 'won' && !x.carried));
  // B8: this town's own word come back by a courier's relay - never; its own region's tales from a town of it - never
  const here = { mapId: TOWN.mapId, region: 17, name: 'Synth' };
  const back = visit(here, D - 400, D + 100, [road('mine', D - 500)]);
  const courier = visit(C, D + 600, D + 900, [], { courier: true, relay: [back] });
  assert.deepEqual(carriedNews([courier], D + 1000, { here: TOWN.mapId }), [], 'its own word');
  assert.equal(carriedNews([courier], D + 1000).length, 1, 'any other town\'s word comes on');
  const r2 = makeTown({ away: new Map(), visitors: [], news: [] }, { carriedOf: (d) => (d === day ? [visit(A, D + 600, D + 900, [])] : null) });   // PIN MOVED (AUDIT LW-II-2 W10): the word through the host's carriedOf, the game's one path (the roads' word carried none - no producer wrote it)
  r2.rel.turn('routed', `O17.${D + 50}`, { t: D + 50, who: 'the Red Hand' });
  r2.town._roadsOf(day);
  const past = D + 50 + DEED_KNOWN_MIN + NEWS_DAYS * DAY_MIN + 10;   // past its own days, inside the visit's
  assert.ok(!r2.town.deedNews(past).some((x) => x.kind === 'routed'), 'its own days done');
  assert.ok(!r2.town.carriedAt(past).some((x) => x.kind === 'routed'), 'its own region\'s rout not carried in again from a town of the region');
  // B14: a band named whole in the talk
  const ctx = { player: 'Mac', news: [{ kind: 'routed', who: 'the Red Hand', foe: '', place: '', t: 1 }] };
  const circle = { seed: 3, members: [{ id: 'a', name: 'Ann Oak', job: 'smith' }, { id: 'b', name: 'Bo Elm', job: 'smith' }], start: 0, from: 0, end: 1e6 };
  let named = 0;
  for (let k = 0; k < 400 && !named; k++) {
    const c2 = { ...circle, seed: k };
    for (let t = 0; t < 30; t++) { const l = circleLine(c2, t, 1, ctx); if (l && /Red Hand/.test(l.text)) { named++; assert.match(l.text, /the Red Hand/); assert.doesNotMatch(l.text, /routed the,|the are finished/); break; } }
  }
  assert.ok(named, 'the rout told');
});

test('AUDIT LW-II LW15 client: the buyer the day\'s holder of the place - a newcomer where the census\'s own is gone - the Vendor page\'s name the one who walks in; an errand at a stay\'s very minute, or a stay ending within a walk of it, still walked; late, still gone in (mutants: B2, B12)', () => {
  const { town } = makeTown({ away: new Map(), visitors: [], news: [] }, { holderOf: (r, d) => (r.roll === 'h' && r.slot === 3 ? { ...r, id: `${r.id}~1`, name: 'New Comer' } : r) });
  const t = D + 600;
  const people = town.peopleOf(town.dayOf(t) + PATRON_DELAY_DAYS);
  assert.ok(people.some((r) => r.id.endsWith('~1')), 'the newcomer holds it');
  for (let seed = 0; seed < 50; seed++) {
    const b = town.patronOfSale(seed, t);
    assert.equal(b.id, people.find((r) => placeKeyOf(r) === patronOf(seed, town.residents).id).id);   // PIN MOVED (AUDIT LW-II-2 W2): the place dealt over the census (every reader's), named by its holder that day
    assert.ok(!town.residents.some((r) => r.slot === 3 && r.roll === 'h' && r.id === b.id), 'never the gone');
  }
  // B2: the errand an appointment
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const inn = census.find((r) => r.job === 'innkeeper' && r.roll === 'h');
  const house = [...places.doors.values()].find((s) => s.key === 'd1044') ?? [...places.doors.values()].at(-1);
  const d = 300;
  const plain = dayPlan(inn, places, d, { mpm: CALENDAR_MPM });
  const workAt = plain.find((e) => e.kind === 'work');
  const plan = dayPlan(inn, places, d, { mpm: CALENDAR_MPM, errands: [{ at: house, from: workAt.t0 - 16, dur: 25 }] });
  assert.ok(plan.some((e) => e.at === house && e.kind === 'shop'), 'an errand at a stay\'s start: walked');
  // an errand at a stay's very minute (the innkeeper's eleven o'clock, to the far house) - before it, on time
  const atIts = dayPlan(inn, places, d, { mpm: CALENDAR_MPM, errands: [{ at: house, from: d * DAY_MIN + 660, dur: 25 }] }).find((e) => e.at === house && e.kind === 'shop');
  assert.equal(atIts?.t0, d * DAY_MIN + 660, 'on its minute');
  assert.ok(plan.some((e) => e.kind === 'work'), 'and the work after it');
  assert.equal(PATRON_LATE_MIN, 45);
  let missing = 0, total = 0;
  const hh = census.filter((r) => r.roll === 'h' && !r.guard && r.home != null && places.doors.get(r.home));
  const houses = [...places.doors.values()];
  for (let dd = 300; dd < 304; dd++) for (const r of hh) for (let k = 0; k < 30; k++) {
    const h2 = houses[(dd * 7 + r.slot + k) % houses.length];
    if (h2 === places.doors.get(r.home)) continue;
    total++;
    if (!dayPlan(r, places, dd, { mpm: CALENDAR_MPM, errands: [{ at: h2, from: dd * DAY_MIN + 540 + 16 * k, dur: 25 }] }).some((e) => e.at === h2 && e.kind === 'shop')) missing++;
  }
  assert.ok(missing / total < 0.02, `${missing} of ${total} dropped`);
});

test('AUDIT LW-II LW15 client: a town\'s patrons\' word reaches its households\' plans - the dealt one walks to the trader\'s door on the day, made again when the word changes, a browser\'s errand among its traders; and the talk tells the word carried from its town (mutants: LW15-town-errands, LW15-town-replan, LW16-talk-from)', () => {
  let word = null;
  const { town } = makeTown({ away: new Map(), visitors: [], news: [] }, { patronsOf: () => word });
  const day = 120, people = town.peopleOf(day);
  const door = [...town.places.doors.keys()].find((k) => !people.some((r) => r.home === k));
  const at = town.places.doors.get(door);
  const seed = 5, buyer = patronOf(seed, people);
  const sale = (day - PATRON_DELAY_DAYS) * DAY_MIN + 240 + 600;   // two days before, at two in the afternoon
  assert.ok(!town.planOf(buyer, day).some((e) => e.at === at), 'no word: no errand');
  word = { v: 1, told: [{ door, t: sale, seed }], traders: [door] };
  const plan = town.planOf(buyer, day);
  const visit = plan.find((e) => e.at === at && e.kind === 'shop');
  assert.ok(visit, 'the word made the day again: the errand walked');
  // AUDIT LW-II B12: the place's holder that day walks it - a newcomer where the census's own is gone
  const nt = makeTown({ away: new Map(), visitors: [], news: [] }, { patronsOf: () => word, holderOf: (r) => (r.roll === 'h' ? { ...r, id: `${r.id}~1`, name: `New ${r.name}` } : r) });
  const np = nt.town.peopleOf(day), nb = np.find((r) => placeKeyOf(r) === patronOf(seed, nt.town.residents).id);   // PIN MOVED (AUDIT LW-II-2 W2): the place dealt over the census, walked by its holder that day
  assert.ok(nb.id.endsWith('~1'));
  assert.ok(nt.town.planOf(nb, day).some((e) => e.at?.key === at.key && e.kind === 'shop'), 'the newcomer walks in');
  assert.equal(visit.t0, day * DAY_MIN + 240 + 600);
  word = { v: 2, told: [], traders: [door] };
  assert.ok(!town.planOf(buyer, day).some((e) => e.at === at && e.t0 === visit.t0), 'the word changed: made again');
  // the talk tells the word carried, its town named
  const ctx = { player: 'Mac', news: [{ ...road('c1', 3), carried: true, from: 'Wayrest' }] };
  let told = 0;
  for (let k = 0; k < 600 && !told; k++) {
    const c = { seed: k, members: [{ id: 'a', name: 'Ann Oak', job: 'smith' }, { id: 'b', name: 'Bo Elm', job: 'smith' }], start: 0, from: 0, end: 1e6 };
    for (let t = 0; t < 30; t++) { const l = circleLine(c, t, 1, ctx); if (l && /Wayrest/.test(l.text)) { told++; break; } }
  }
  assert.ok(told, 'There\'s word from Wayrest');
});
