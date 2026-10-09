// CHAP5b (2026-10-09, Mac: "Continue", the Chapters arc's living world - bible/11-Multiplayer/Chapters-Arc.md section 9):
// THE HALL'S PEOPLE AND THE TOWN'S TALK - the living world reads the chapter sheet as one more input: a guild's evenings
// at its hall go by its chapter's band (one a week Failing, two Steady, three Thriving and Ascendant), and the town talks
// of a chapter not Steady; with no sheet - offline, a chapter the sheet does not name - it is exactly today's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import {
  guildDay, guildHallOf, dayPlan, hallGuildDays, GUILD_DAYS, GUILD_DAY_OFFSETS, GUILD_DAYS_BY_BAND, MAGES_GUILD, FIGHTERS_GUILD, DAY_MIN, DAY_START_MIN,
} from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown, townChapters } from '../src/systems/livingWorld/livingTown.js';
import { CHAPTER_NEWS, CHAPTER_NEWS_DAYS, newsScript, TOKEN_FALLBACK } from '../src/systems/livingWorld/lines.js';
import { circleLine } from '../src/systems/livingWorld/meetups.js';
import { CHAPTER_BANDS } from '../src/net/npcChapterLaw.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MPM = PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 4242, blocks: 36, region: 17, people: 3, port: false });
const ARKAY = 21;

/** The LW-ERRANDS town: the Mages Guild, two halls of the Fighters Guild, the Knights of the Dragon - and a temple. */
function guildTown(halls = { 1006: [B.GuildHall, MAGES_GUILD], 1009: [B.GuildHall, FIGHTERS_GUILD], 1030: [B.GuildHall, FIGHTERS_GUILD], 1014: [B.GuildHall, 368], 1012: [B.Temple, ARKAY], 1010: [B.Library, 0], 1011: [B.Bookseller, 0] }) {
  const fx = synthTown({ blocksW: 6, blocksH: 6 });
  const buildings = fx.buildings.map((b) => (halls[b.key] ? { ...b, type: halls[b.key][0], factionId: halls[b.key][1] } : b));
  const places = townPlaces(fx.nav, fx.doors, buildings);
  const census = townCensus(TOWN, buildings, new Set(places.doors.keys()));
  return { fx, buildings, places, census };
}
const homeOf = (places, r) => (r.home != null ? places.doors.get(r.home) ?? null : null);
const weekOf = (r, days) => { const out = []; for (let d = 700; d < 707; d++) if (guildDay(r, d, days)) out.push(d % 7); return out; };

// ── THE HALL'S PEOPLE ───────────────────────────────────────────────

test('CHAP5b the guild\'s days by the band: two as ever where none is known, one Failing - the first of the two - three Thriving and Ascendant, the two among them; every band of the sheet\'s named (mutants: the offsets, the count, the default)', () => {
  const { census } = guildTown();
  assert.equal(GUILD_DAYS, 2);
  assert.deepEqual([...GUILD_DAY_OFFSETS], [0, 3, 5]);
  assert.deepEqual({ ...GUILD_DAYS_BY_BAND }, { failing: 1, steady: 2, thriving: 3, ascendant: 3 });
  assert.deepEqual(Object.keys(GUILD_DAYS_BY_BAND).sort(), CHAPTER_BANDS.map((b) => b.band).sort(), 'the chapter law\'s bands, each');
  for (const r of census.slice(0, 60)) {
    const two = weekOf(r), one = weekOf(r, 1), three = weekOf(r, 3);
    assert.deepEqual(weekOf(r, GUILD_DAYS), two, 'the default is two');
    assert.deepEqual([two.length, one.length, three.length], [2, 1, 3], r.id);
    assert.ok(two.includes(one[0]), `${r.id}: the one of the two`);
    for (const d of two) assert.ok(three.includes(d), `${r.id}: the two among the three`);
    assert.deepEqual(weekOf(r, 0), [], 'none');
  }
});

test('CHAP5b a hall\'s days: its chapter\'s band by the hall\'s own guild - two with no sheet, no building, a band it does not know (mutants: the faction read, the guards, the table)', () => {
  const { places } = guildTown();
  const hall = places.doors.get(1006), fighters = places.doors.get(1009);
  const asked = [];
  const bandOf = (f) => { asked.push(f); return f === MAGES_GUILD ? 'failing' : f === FIGHTERS_GUILD ? 'thriving' : null; };
  assert.deepEqual([hallGuildDays(places, hall, bandOf), hallGuildDays(places, fighters, bandOf)], [1, 3]);
  assert.deepEqual(asked, [MAGES_GUILD, FIGHTERS_GUILD], 'asked by the hall\'s own guild');
  assert.equal(hallGuildDays(places, places.doors.get(1014), bandOf), 2, 'a chapter the sheet does not name');
  assert.equal(hallGuildDays(places, hall, null), 2, 'no sheet');
  assert.equal(hallGuildDays(places, { ...hall, building: undefined }, () => 'failing'), 2, 'no building');
  assert.equal(hallGuildDays(places, hall, () => 'flourishing'), 2, 'a band it does not know');
  assert.equal(hallGuildDays(places, hall, () => 'ascendant'), 3);
});

test('CHAP5b the town\'s evenings: a member by trade at a Failing chapter\'s hall one evening a week, a Thriving one\'s three, a courtier at its order\'s by its band; with no sheet, every plan exactly today\'s (mutants: the trades\' band, the court\'s band, the plan unchanged)', () => {
  const { places, census } = guildTown();
  const bandOf = (f) => (f === MAGES_GUILD ? 'failing' : f === FIGHTERS_GUILD ? 'thriving' : f === 368 ? 'ascendant' : null);
  const want = { [MAGES_GUILD]: 1, [FIGHTERS_GUILD]: 3, 368: 3 };
  const seen = { trades: new Set(), court: 0 };
  for (const r of census) {
    const home = homeOf(places, r);
    const hall = home ? guildHallOf(r, places, home) : null;
    for (let day = 300; day < 307; day++) assert.deepEqual(dayPlan(r, places, day, { mpm: MPM, bandOf: null }), dayPlan(r, places, day, { mpm: MPM }), `${r.id}: no sheet, today's`);
    if (!hall || !['keeper', 'smith', 'clerk', 'scholar', 'helper', 'courtier'].includes(r.job)) continue;
    const f = places.factions.get(hall.building);
    let evenings = 0;
    for (let day = 300; day < 307; day++) if (dayPlan(r, places, day, { mpm: MPM, bandOf }).some((e) => e.kind === 'guild')) evenings++;
    const days = want[f] ?? 2;
    assert.ok(evenings <= days, `${r.id} at ${f}: ${evenings} evenings, ${days} its band's`);
    let owed = 0;
    for (let day = 300; day < 307; day++) if (guildDay(r, day, days)) owed++;
    assert.equal(owed, days);
    if (evenings === days) { if (r.job === 'courtier') seen.court++; else seen.trades.add(f); }
  }
  assert.ok(seen.trades.has(MAGES_GUILD) && seen.trades.has(FIGHTERS_GUILD), `a Failing hall's one and a Thriving hall's three, kept (${[...seen.trades]})`);
  assert.ok(seen.court > 0, 'a courtier at an Ascendant order\'s three');
});

// ── THE LIVING TOWN ─────────────────────────────────────────────────

/** A living town of the guild town, its clock at `t`, its sheet `chapterOf`. */
function living(t, chapterOf) {
  const { fx, buildings } = guildTown();
  const o = { town: TOWN, buildings, doors: fx.doors, makePerson: () => null, clock: () => t.now, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: MPM };
  return new LivingTown(fx.nav, chapterOf ? { ...o, chapterOf } : o);
}

test('CHAP5b the town\'s chapters: its guild halls\' guilds, each once, in order - its temples\' too for its talk (mutants: the types, the once, the order)', () => {
  const { places } = guildTown();
  assert.deepEqual(townChapters(places), [MAGES_GUILD, FIGHTERS_GUILD, 368]);
  assert.deepEqual(townChapters(places, true), [ARKAY, MAGES_GUILD, FIGHTERS_GUILD, 368]);
  assert.deepEqual(townChapters(guildTown({ 1006: [B.GuildHall, 0] }).places), [], 'a hall of no guild');
});

test('CHAP5b the living town\'s plans: made by the sheet\'s bands, and made again the minute they move - none moved without a sheet (mutants: the band handed, the stamp, the replan)', () => {
  const t = { now: 300 * DAY_MIN + DAY_START_MIN };
  let bands = { [FIGHTERS_GUILD]: 'failing' };
  const lt = living(t, (f) => (bands[f] ? { band: bands[f], name: 'the guild' } : null));
  const plain = living(t, null);
  const res = lt.peopleOf(300).filter((r) => ['keeper', 'smith', 'clerk', 'scholar', 'helper'].includes(r.job) && (() => { const h = guildHallOf(r, lt.places, homeOf(lt.places, r)); return h && lt.places.factions.get(h.building) === FIGHTERS_GUILD; })());
  assert.ok(res.length > 0);
  const evenings = (town, r) => { let n = 0; for (let day = 300; day < 307; day++) if (town.planOf(r, day).some((e) => e.kind === 'guild')) n++; return n; };
  const before = res.map((r) => evenings(lt, r));
  assert.ok(before.every((n) => n <= 1), `Failing: one at most (${before})`);
  bands = { [FIGHTERS_GUILD]: 'thriving' };
  assert.deepEqual(res.map((r) => evenings(lt, r)), before, 'the same clock minute: the plans kept');
  t.now += 1;
  const after = res.map((r) => evenings(lt, r));
  assert.ok(after.some((n, i) => n > before[i]), `the next minute, Thriving: more (${before} -> ${after})`);
  const asIfThriving = living(t, (f) => (f === FIGHTERS_GUILD ? { band: 'thriving', name: 'the guild' } : null));
  assert.deepEqual(res.map((r) => evenings(lt, r)), res.map((r) => evenings(asIfThriving, r)), 'as a reader that read it Thriving from the first');
  // one day asked again, kept in the cache: made again once the bands move
  const guildOn = (town, r, d) => town.planOf(r, d).some((e) => e.kind === 'guild');
  let pick = null;
  for (const r of res) for (let d = 300; d < 307 && !pick; d++) if (!guildDay(r, d, 1) && guildOn(asIfThriving, r, d)) pick = [r, d];
  assert.ok(pick, 'a Thriving evening that is no Failing one');
  const [r0, d0] = pick;
  bands = { [FIGHTERS_GUILD]: 'failing' };
  t.now += 1;
  assert.equal(guildOn(lt, r0, d0), false, 'Failing: not that evening');
  assert.equal(guildOn(lt, r0, d0), false);
  bands = { [FIGHTERS_GUILD]: 'thriving' };
  t.now += 1;
  assert.equal(guildOn(lt, r0, d0), true, 'the same day, made again under the new band');
  const plainRes = plain.peopleOf(300).filter((r) => res.some((x) => x.id === r.id));
  assert.deepEqual(plainRes.map((r) => plain.planOf(r, 300)), plainRes.map((r) => dayPlan(r, plain.places, 300, { mpm: MPM, watch: plain._watchSize })), 'no sheet: today\'s');
  assert.equal(plain._chapterStamp(), '');
});

test('CHAP5b the town\'s talk of its chapters: a chapter not Steady is news on two days of the week - the same days on every reader - its guild named; none Steady, none unnamed, none offline (mutants: the bands, the days, the name, the offline)', () => {
  const t = { now: 300 * DAY_MIN + DAY_START_MIN };
  const sheet = { [FIGHTERS_GUILD]: 'thriving', [MAGES_GUILD]: 'steady', 368: 'failing', [ARKAY]: 'ascendant' };
  const names = { [FIGHTERS_GUILD]: 'the Fighters Guild', 368: 'the Knights of the Dragon', [ARKAY]: 'the Temple of Arkay' };
  const lt = living(t, (f) => (sheet[f] ? { band: sheet[f], name: names[f] ?? 'the Mages Guild' } : null));
  const told = new Map(), on = new Map();
  for (let day = 300; day < 307; day++) {
    for (const n of lt.chapterNews(day * DAY_MIN + DAY_START_MIN + 600)) {
      assert.deepEqual(n, { kind: sheet[Object.keys(names).find((f) => names[f] === n.guild)], chapter: true, guild: n.guild, who: '', foe: '', place: '' });
      told.set(n.guild, (told.get(n.guild) ?? 0) + 1);
      on.set(n.guild, [...(on.get(n.guild) ?? []), day % 7]);
    }
  }
  assert.ok(new Set([...on.values()].map((d) => d.join())).size > 1, `each chapter its own days (${[...on.values()].join(' | ')})`);
  assert.equal(CHAPTER_NEWS_DAYS, 2);
  assert.deepEqual([...told.keys()].sort(), ['the Fighters Guild', 'the Knights of the Dragon', 'the Temple of Arkay'], 'never a Steady chapter');
  for (const [g, n] of told) assert.equal(n, CHAPTER_NEWS_DAYS, `${g}: two days of the week`);
  const again = living(t, (f) => (sheet[f] ? { band: sheet[f], name: names[f] ?? 'the Mages Guild' } : null));
  for (let day = 300; day < 307; day++) assert.deepEqual(again.chapterNews(day * DAY_MIN + 1000), lt.chapterNews(day * DAY_MIN + 1000), 'every reader the same');
  assert.deepEqual(living(t, null).chapterNews(t.now), [], 'offline');
  const day = [300, 301, 302, 303, 304, 305, 306].find((d) => lt.chapterNews(d * DAY_MIN + DAY_START_MIN).length);
  const ctx = lt.lineCtx(day * DAY_MIN + DAY_START_MIN);
  assert.ok(ctx.news.some((n) => n.chapter), 'told beside the town\'s other news');
});

test('CHAP5b the words: a chapter\'s news by its band - none for Steady - its guild in each script, filled by the meeting; its fallback (mutants: the pool, the token)', () => {
  assert.deepEqual(Object.keys(CHAPTER_NEWS).sort(), ['ascendant', 'failing', 'thriving']);
  for (const pool of Object.values(CHAPTER_NEWS)) for (const script of pool) assert.ok(script.join(' ').includes('{guild}'), script.join(' / '));
  assert.equal(TOKEN_FALLBACK.guild, 'the guild');
  const item = { kind: 'failing', chapter: true, guild: 'the Fighters Guild', who: '', foe: '', place: '' };
  let got = null;
  for (let seed = 0; seed < 200 && !got; seed++) got = newsScript(seed, [item]);
  assert.ok(got && CHAPTER_NEWS.failing.includes(got.script), 'a Failing chapter\'s own words');
  assert.match(src('src/systems/livingWorld/meetups.js'), /guild: told\?\.item\.guild \?\? null,/);
  assert.equal(typeof circleLine, 'function');
});

// ── THE WIRING ──────────────────────────────────────────────────────

test('CHAP5b the wiring: the host hands the living town its chapters off the sheet - none offline - in the politic region, banded and named (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /chapterOf: chapterSheet \? \(faction\) => livingChapterOf\(faction\) : undefined,/);
  assert.match(w, /const livingChapterOf = \(\/\*\* @type \{number\} \*\/ faction\) => \{\n\s+const px = playerTravelPixel\(\);\n\s+const region = \(\(\) => \{ try \{ return maps\.getRegionIndexAt\(px\.x, px\.y\); \} catch \{ return null; \} \}\)\(\);\n\s+const strength = Number\.isInteger\(region\) \? chapterSheet\?\.strengthOf\(faction, region\) \?\? null : null;\n\s+return strength == null \? null : \{ band: chapterBandOf\(strength\)\.band, name: `the \$\{hallPosterName\(faction\)\}` \};/);
});
