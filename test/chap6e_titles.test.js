// @ts-nocheck
// CHAP6e (2026-10-09, Mac: "continue", the Chapters arc's sixth slice - bible/11-Multiplayer/Chapters-Arc.md 6 and 7):
// THE SEASON'S TWO TITLES. A Master in its chapter's Ascendancy is its High Master for the Season - signed in the
// Master's place, never worn on its own - and a Master who held the seat a whole Season keeps "Master of the Fighters
// Guild, Anticlere, Season 3" for good. Two generic ids more on the token, the seats' claim beside each; the relay
// carrying them (world182, grown in place - undeployed); the client wording them; the service deriving them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAPTER_TITLES, SEAT_TITLES, TITLES, titleClaimed, claimsValid } from '../src/net/identityToken.js';
import { badged, readBadge, RELAY_VERSION } from '../src/net/wire.js';
import { chapterTitleText, chapterTitlesOf, meritWeekOf } from '../src/net/npcChapterLaw.js';
import { titleBadge, TITLE_TEXT, TITLE_RGBA } from '../src/ui/playerBadge.js';
import { chapterTitlesOfAccount } from '../server-account/src/npcChapters.js';
import { standService, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FIGHTERS = 41, MAGES = 40, THIEVES = 42, ANTICLERE = 21, DAGGERFALL = 17, BETONY = 19;
const DAY = 86_400;
const NOW = T0 + 30 * 7 * DAY;   // late enough that Season 3 has a Season 0 to count from
const WEEK = meritWeekOf(NOW);
/** Season 3 from WEEK - 1 (Season 0 four weeks, each after it eight). */
const ZERO = WEEK - 21;

// ── THE VOCABULARY AND THE RELAY ────────────────────────────────────

test('CHAP6e the vocabulary: a High Master and a Season\'s Master, last in the closed list, each riding with the seats\' claim; the relay stamps and reads it back (mutants: an id dropped, the claim\'s law)', () => {
  assert.deepEqual([...CHAPTER_TITLES], ['chaptermaster', 'chapterofficer', 'formermaster', 'highmaster', 'seasonmaster']);
  assert.deepEqual(TITLES.slice(-2), ['highmaster', 'seasonmaster']);
  assert.deepEqual([...TITLES.filter(titleClaimed)], [...SEAT_TITLES, ...CHAPTER_TITLES]);
  const base = { v: 1, s: 'acct-c6e', n: 'Alda', k: 'linked', i: 1000, e: 1060 };
  assert.equal(claimsValid({ ...base, t: 'highmaster', ts: [4121, 3] }), true);
  assert.equal(claimsValid({ ...base, t: 'seasonmaster', ts: [4121, 3] }), true);
  assert.equal(claimsValid({ ...base, t: 'seasonmaster' }), false, 'no claim');
  assert.equal(claimsValid({ ...base, t: 'highmaster', ts: [4121, 10000] }), false, 'past its bounds');
  for (const t of ['highmaster', 'seasonmaster']) {
    const row = {};
    badged(row, { title: t, ts: [4017, 2] });
    assert.deepEqual(row.ts, [4017, 2], `${t}: stamped`);
    assert.deepEqual(readBadge({ title: t, ts: [4017, 2], glyphs: [] }).ts, [4017, 2], `${t}: read back`);
  }
  assert.equal(RELAY_VERSION, 'world188');   // PIN MOVED: world185, INT7-INT10 (the INTEGRITY arc's lane 2 - world183, then world184, on its branch, renumbered past CHAP4c's world183 and PERF-RELAY1's world184 at the merges); PIN MOVED: world183 - past CARDS10's world182 at the merge of main
});

// ── THE WORDS ───────────────────────────────────────────────────────

test('CHAP6e the words: "High Master of the Fighters Guild, Anticlere"; "Master of the Mages Guild, Daggerfall, Season 3" - never a Season 0, never past the claim\'s bound, never a hidden guild\'s; the plain words, the colours (mutants: the words, the Season\'s guard, each colour)', () => {
  assert.equal(chapterTitleText('highmaster', [4121, 3]), 'High Master of the Fighters Guild, Anticlere');
  assert.equal(chapterTitleText('seasonmaster', [4017, 3]), 'Master of the Mages Guild, Daggerfall, Season 3');
  assert.equal(chapterTitleText('seasonmaster', [4017, 1]), 'Master of the Mages Guild, Daggerfall, Season 1');
  assert.equal(chapterTitleText('seasonmaster', [4017, 9999]), 'Master of the Mages Guild, Daggerfall, Season 9999');
  assert.deepEqual([chapterTitleText('seasonmaster', [4017, 0]), chapterTitleText('seasonmaster', [4017, 10000]), chapterTitleText('seasonmaster', [4017, 2.5]),
    chapterTitleText('seasonmaster', [4017]), chapterTitleText('seasonmaster', [4221, 3]), chapterTitleText('highmaster', [4221, 3])], [null, null, null, null, null, null]);
  assert.equal(chapterTitleText('chaptermaster', [4121, 3]), 'Master of the Fighters Guild, Anticlere', 'the Master\'s own, unchanged');
  assert.equal(titleBadge({ title: 'seasonmaster', ts: [4017, 2] }).text, 'Master of the Mages Guild, Daggerfall, Season 2');
  assert.equal(titleBadge({ title: 'highmaster', ts: [4121, 3] }).text, 'High Master of the Fighters Guild, Anticlere');
  assert.equal(titleBadge({ title: 'seasonmaster', ts: [4017, 0] }).text, 'Season Master', 'a claim it cannot word: the plain word');
  assert.deepEqual([TITLE_TEXT.highmaster, TITLE_TEXT.seasonmaster], ['High Master', 'Season Master']);
  const hex = (t) => TITLE_RGBA[t].slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  assert.deepEqual(['highmaster', 'seasonmaster'].map(hex), ['5d9cec', '6f8fb8']);
});

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP6e the titles a character\'s seats and Seasons give it: a Master\'s seat in an Ascendancy marked high and first among the Masters\'; an officer\'s never high; each Season held whole, last, newest first, once - never a Season 0, a hidden guild\'s, or a Season it cannot read (mutants: the mark, the order, each guard)', () => {
  const seats = [{ f: MAGES, region: DAGGERFALL, seat: 'master' }, { f: FIGHTERS, region: ANTICLERE, seat: 'master', high: true }, { f: MAGES, region: ANTICLERE, seat: 'officer', high: true },
    { f: FIGHTERS, region: DAGGERFALL, seat: 'master', high: 'yes' }];
  const kept = [{ f: FIGHTERS, region: ANTICLERE, season: 1 }, { f: MAGES, region: BETONY, season: 1 }, { f: MAGES, region: DAGGERFALL, season: 2 },
    { f: MAGES, region: DAGGERFALL, season: 2 }, { f: THIEVES, region: ANTICLERE, season: 2 }, { f: FIGHTERS, region: DAGGERFALL, season: 0 }, { f: FIGHTERS, region: DAGGERFALL, season: NaN }];
  assert.deepEqual(chapterTitlesOf(seats, [], 3, kept), [
    { title: 'chaptermaster', ts: [4121, 3], high: true },
    { title: 'chaptermaster', ts: [4017, 3] }, { title: 'chaptermaster', ts: [4117, 3] },
    { title: 'chapterofficer', ts: [4021, 3] },
    { title: 'seasonmaster', ts: [4017, 2] }, { title: 'seasonmaster', ts: [4019, 1] }, { title: 'seasonmaster', ts: [4121, 1] },
  ]);
  assert.deepEqual(chapterTitlesOf([], [], 3, [{ f: FIGHTERS, region: ANTICLERE, season: 4 }]), [{ title: 'seasonmaster', ts: [4121, 4] }], 'a Season\'s title with no seat now');
  assert.deepEqual(chapterTitlesOf([{ f: FIGHTERS, region: ANTICLERE, seat: 'master' }], [], 3), [{ title: 'chaptermaster', ts: [4121, 3] }], 'none kept: CHAP4c\'s own');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** A service with the Chapters open, CHAPTER_TITLES `titles` and Season 3 counted; a registered account with realm
 *  characters `R` and `other`. */
async function stand(t, { titles = 'on', zero = ZERO } = {}) {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const svc = await standService({ CHAPTERS_OPEN: 'on', CHAPTER_TITLES: titles, ...(zero == null ? {} : { SEASON_ZERO_WEEK: String(zero) }) });
  const raw = svc.env.DB._raw;
  confirmChapters(raw, [DAGGERFALL, ANTICLERE]);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 1);
  const who = await svc.registered('Alda');
  const R = await seatRealm(svc.env, who.secret, 'Alda');
  const other = await seatRealm(svc.env, who.secret, 'Bryn');
  const seat = (char, f, region, s) => raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(f, region, char, who.id, s, WEEK, WEEK, NOW);
  const event = (f, region, ev, season) => raw.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at, event, event_season, event_data) VALUES (?, ?, 50, ?, 0, 0, ?, ?, '{}')
    ON CONFLICT (faction, region) DO UPDATE SET event = excluded.event, event_season = excluded.event_season`).run(f, region, WEEK - 1, ev, season);
  const held = (char, f, region, data) => raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'season', ?, ?, ?)").run(f, region, WEEK - 2, char, typeof data === 'string' ? data : JSON.stringify(data), NOW);
  const mint = async (character) => (await svc.call('/v1/auth/token', { character }, who.secret)).body;
  const titlesOf = async (character = null) => (await chapterTitlesOfAccount(svc.env.DB, who.id, NOW, zero, character)).map((x) => [x.char === R.id ? 'R' : 'other', x.title, x.ts, x.high ?? false]);
  return { svc, raw, who, R, other, seat, event, held, mint, titlesOf };
}

test('CHAP6e a High Master: a Master\'s seat at a chapter whose Ascendancy is this Season\'s is signed "highmaster" in the Master\'s place - its claim the Master\'s; never worn on its own; never another Season\'s Ascendancy, another event, an officer, or with no Season counted (mutants: the event, its Season, the counted Season, the seat, the mint)', async (t) => {
  const s = await stand(t);
  s.seat(s.R.id, MAGES, DAGGERFALL, 'master');
  s.seat(s.R.id, FIGHTERS, ANTICLERE, 'master');
  s.seat(s.other.id, MAGES, ANTICLERE, 'officer');
  s.event(FIGHTERS, ANTICLERE, 'ascendancy', 3);
  s.event(MAGES, ANTICLERE, 'ascendancy', 3);
  s.event(MAGES, DAGGERFALL, 'decline', 3);
  assert.deepEqual(await s.titlesOf(s.R.id), [['R', 'chaptermaster', [4121, 3], true], ['R', 'chaptermaster', [4017, 3], false]]);
  assert.deepEqual(await s.titlesOf(s.other.id), [['other', 'chapterofficer', [4021, 3], false]], 'an officer\'s in an Ascendancy: an officer\'s');
  assert.equal((await s.svc.call('/v1/account/title', { title: 'highmaster' }, s.who.secret)).status, 403, 'never worn on its own');
  const equip = await s.svc.call('/v1/account/title', { title: 'chaptermaster' }, s.who.secret);
  assert.equal(equip.status, 200, JSON.stringify(equip.body));
  assert.ok(!equip.body.titles.includes('highmaster'));
  const m = await s.mint(s.R.id);
  assert.deepEqual([m.title, m.ts], ['highmaster', [4121, 3]], 'the Ascendancy\'s seat first, signed High');
  const claims = JSON.parse(Buffer.from(m.token.split('.')[1], 'base64url').toString());
  assert.deepEqual([claims.t, claims.ts], ['highmaster', [4121, 3]], 'in the signed claims');
  s.event(FIGHTERS, ANTICLERE, 'ascendancy', 2);
  assert.deepEqual([(await s.mint(s.R.id)).title, (await s.titlesOf(s.R.id)).map((x) => x[3])], ['chaptermaster', [false, false]], 'the Season before\'s Ascendancy: a Master');
  s.event(FIGHTERS, ANTICLERE, 'rivalry', 3);
  assert.deepEqual((await s.titlesOf(s.R.id)).map((x) => x[3]), [false, false], 'another event');
  const none = await stand(t, { zero: null });
  none.seat(none.R.id, FIGHTERS, ANTICLERE, 'master');
  none.event(FIGHTERS, ANTICLERE, 'ascendancy', 0);
  assert.deepEqual(await none.titlesOf(none.R.id), [['R', 'chaptermaster', [4121, 0], false]], 'no Season counted: every chapter Calm');
});

test('CHAP6e a Season\'s Master: every Season a character held a Master\'s seat whole titles it for good - with no seat now, at a chapter struck since; its newest signed; never a hidden guild\'s, a dead character\'s, another character\'s, a row it cannot read, nor with the titles shut (mutants: the rows read, the kept chapter, the order, the switch)', async (t) => {
  const shut = await stand(t, { titles: 'off' });
  shut.held(shut.R.id, FIGHTERS, ANTICLERE, { season: 1 });
  assert.equal((await shut.svc.call('/v1/account/title', { title: 'seasonmaster' }, shut.who.secret)).status, 403, 'shut: not held');
  const s = await stand(t);
  assert.equal((await s.svc.call('/v1/account/title', { title: 'seasonmaster' }, s.who.secret)).status, 403, 'none yet');
  s.held(s.R.id, FIGHTERS, ANTICLERE, { season: 1 });
  s.held(s.R.id, MAGES, DAGGERFALL, { season: 2 });
  s.held(s.R.id, MAGES, BETONY, { season: 1 });   // a region whose chapters are not confirmed now
  s.held(s.R.id, THIEVES, ANTICLERE, { season: 2 });   // a hidden guild's
  s.held(s.R.id, FIGHTERS, DAGGERFALL, 'not json');
  s.held(s.other.id, FIGHTERS, DAGGERFALL, { season: 2 });
  assert.deepEqual(await s.titlesOf(s.R.id), [['R', 'seasonmaster', [4017, 2], false], ['R', 'seasonmaster', [4019, 1], false], ['R', 'seasonmaster', [4121, 1], false]]);
  const equip = await s.svc.call('/v1/account/title', { title: 'seasonmaster' }, s.who.secret);
  assert.equal(equip.status, 200, JSON.stringify(equip.body));
  assert.ok(equip.body.titles.includes('seasonmaster') && !equip.body.titles.includes('chaptermaster'));
  const m = await s.mint(s.R.id);
  assert.deepEqual([m.title, m.ts], ['seasonmaster', [4017, 2]], 'the newest Season signed');
  assert.deepEqual([(await s.mint(s.other.id)).ts], [[4117, 2]], 'the other character its own');
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(NOW, s.R.id);
  assert.deepEqual(await s.titlesOf(s.R.id), [], 'a dead character holds nothing');
});

test('CHAP6e the wiring: the relay\'s world182 re-hashed in place, undeployed; the mint signs a High Master in the Master\'s place; the service reads the Chronicle\'s Season rows (mutants: each seam)', () => {
  assert.match(rd('test/relayversion.test.js'), /\n  world183: '[0-9a-f]{64}',   \/\/ CHAP4c \(world182 on its branch[^\n]*\(re-hashed in place, undeployed - bytes 3012337d\.\.\. before it: CHAP6e /)   // PIN MOVED: world183 - past CARDS10's world182 at the merge of main;
  assert.match(rd('server-account/src/index.js'), /: CHAPTER_TITLES\.includes\(wornT\) \? \(chapterT \? \{ t: chapterT\.high \? 'highmaster' : wornT, ts: chapterT\.ts \} : \{\}\)/);
  assert.match(rd('server-account/src/npcChapters.js'), /SELECT x\.char_id, x\.faction, x\.region, x\.data FROM npc_chapter_history x \$\{who\}\n\s+AND x\.kind = 'season'`\)/);
  assert.match(rd('server-account/wrangler.toml'), /\nCHAPTER_TITLES = "off"\n/);
});
