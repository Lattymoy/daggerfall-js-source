// CHAP4c (2026-10-08, Mac: "Your call", the Chapters arc's seats - bible/11-Multiplayer/Chapters-Arc.md section 6): THE
// CHAPTERS' TITLES ON THE TOKEN - three generic ids (a chapter's Master, an officer, a Master who lost the seat this
// Season), each with the seats' bounded claim [the chapter's key, the Season]; the relay carrying the claim (world182; AUDIT CHAP4 R12, then past TAVERN-TABLES and TV-BEYOND at the merges);
// the client wording them without gender; the service deriving them from the seats and the Chronicle, behind
// CHAPTER_TITLES (shipped off: the relay goes first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAPTER_TITLES, SEAT_TITLES, TITLES, titleClaimed, claimsValid } from '../src/net/identityToken.js';
import { badged, readBadge, RELAY_VERSION } from '../src/net/wire.js';
import { chapterTitleKey, chapterOfTitleKey, chapterTitleText, chapterTitlesOf, meritWeekOf } from '../src/net/npcChapterLaw.js';
import { titleBadge, TITLE_TEXT, TITLE_RGBA } from '../src/ui/playerBadge.js';
import { chapterTitlesOfAccount, chapterTitlesOpenFor } from '../server-account/src/npcChapters.js';
import { standService, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FIGHTERS = 41, MAGES = 40, THIEVES = 42, ANTICLERE = 21, DAGGERFALL = 17;

// ── THE VOCABULARY AND THE RELAY ────────────────────────────────────

test('CHAP4c the vocabulary: three chapter title ids, last in the closed list; each rides with the seats\' claim and only beside one; the relay stamps and reads it back (mutants: an id dropped, the claim\'s law, the relay\'s carry)', () => {
  assert.deepEqual([...CHAPTER_TITLES].slice(0, 3), ['chaptermaster', 'chapterofficer', 'formermaster']);   // PIN MOVED (CHAP6e): two more after them (test/chap6e_titles.test.js)
  assert.deepEqual(TITLES.slice(-5, -2), ['chaptermaster', 'chapterofficer', 'formermaster']);   // PIN MOVED (CHAP6e): two more after them
  assert.deepEqual([...TITLES.filter(titleClaimed)], [...SEAT_TITLES, ...CHAPTER_TITLES]);
  const base = { v: 1, s: 'acct-c4c', n: 'Alda', k: 'linked', i: 1000, e: 1060 };
  assert.equal(claimsValid({ ...base, t: 'chaptermaster', ts: [4121, 3] }), true);
  assert.equal(claimsValid({ ...base, t: 'formermaster', ts: [0, 0] }), true);
  for (const [why, c] of [['no claim', { t: 'chapterofficer' }], ['a claim past its bounds', { t: 'chaptermaster', ts: [4121, 10000] }],
    ['a claim of one', { t: 'chaptermaster', ts: [4121] }], ['a claim beside a title that rides alone', { t: 'founder', ts: [4121, 3] }]]) {
    assert.equal(claimsValid({ ...base, ...c }), false, why);
  }
  const row = {};
  badged(row, { title: 'chapterofficer', ts: [4121, 2] });
  assert.deepEqual(row.ts, [4121, 2], 'the relay stamps the claim off the token');
  assert.deepEqual(readBadge({ title: 'chapterofficer', ts: [4121, 2], glyphs: [] }).ts, [4121, 2], 'and reads it back');
  assert.equal(readBadge({ title: 'founder', ts: [4121, 2], glyphs: [] }).ts, undefined, 'never beside a title that rides alone');
  assert.equal(RELAY_VERSION, 'world183');   // PIN MOVED: world183, CHAP4c (past CARDS10's world182 at the merge of main); PIN MOVED: world182, CHAP4c (past TV-BEYOND's world181 at the merge of main); PIN MOVED: world181, CHAP4c (past TAVERN-TABLES' world180 at the merge of main); PIN MOVED: world180, CHAP4c (the chapters' seats' titles on the token - past HOURS-FIRST's world179 at the merge of main); PIN MOVED: world177 then world178 on the branch, past main's WROTHGARIAN ZONE and TAVERN CARDS at the merges
});

// ── THE LAW AND THE WORDS ───────────────────────────────────────────

test('CHAP4c a chapter\'s key and its words: guild x 100 + region, worded without gender - a hidden guild\'s, a key naming no chapter: none (mutants: the key, the words, each guard)', () => {
  assert.equal(chapterTitleKey(FIGHTERS, ANTICLERE), 4121);
  assert.deepEqual([chapterOfTitleKey(4121), chapterOfTitleKey(36861), chapterOfTitleKey(-1), chapterOfTitleKey(4.5), chapterOfTitleKey('4121')],
    [{ f: 41, region: 21 }, { f: 368, region: 61 }, null, null, null]);
  assert.deepEqual([
    chapterTitleText('chaptermaster', [4121, 2]), chapterTitleText('chapterofficer', [4017, 0]), chapterTitleText('formermaster', [36817, 1]),
  ], ['Master of the Fighters Guild, Anticlere', 'Officer of the Mages Guild, Daggerfall', 'Former Master of the Knights of the Dragon, Daggerfall']);
  for (const [why, t, ts] of [['a hidden guild', 'chaptermaster', [4221, 0]], ['no guild', 'chaptermaster', [9921, 0]], ['no region', 'chaptermaster', [4199, 0]],
    ['no claim', 'chaptermaster', null], ['a seat title', 'warden', [4121, 0]]]) assert.equal(chapterTitleText(t, ts), null, why);
});

test('CHAP4c the titles a character\'s seats give it: a Master\'s, an officer\'s, a Master\'s seat lost this Season and not held again - best first, each by guild then region; never a hidden guild\'s (mutants: the order, the former\'s guard, the hidden)', () => {
  assert.deepEqual(chapterTitlesOf(
    [{ f: FIGHTERS, region: ANTICLERE, seat: 'officer' }, { f: MAGES, region: DAGGERFALL, seat: 'master' }, { f: THIEVES, region: DAGGERFALL, seat: 'master' }],
    [{ f: FIGHTERS, region: DAGGERFALL }, { f: MAGES, region: DAGGERFALL }, { f: FIGHTERS, region: DAGGERFALL }, { f: THIEVES, region: ANTICLERE }], 3,
  ), [{ title: 'chaptermaster', ts: [4017, 3] }, { title: 'chapterofficer', ts: [4121, 3] }, { title: 'formermaster', ts: [4117, 3] }]);
  assert.deepEqual(chapterTitlesOf([{ f: FIGHTERS, region: DAGGERFALL, seat: 'master' }, { f: MAGES, region: ANTICLERE, seat: 'master' }], [], 1),
    [{ title: 'chaptermaster', ts: [4021, 1] }, { title: 'chaptermaster', ts: [4117, 1] }], 'by guild, then region');
  assert.deepEqual(chapterTitlesOf([], [], 0), []);
  assert.deepEqual(chapterTitlesOf([{ f: FIGHTERS, region: ANTICLERE, seat: 'lord' }], [], 0), []);
});

test('CHAP4c the badge: a chapter title worded off its claim in its own colour; its plain word where the claim names nothing (mutants: the claimed arm, the words, the colours)', () => {
  assert.deepEqual(titleBadge({ title: 'chaptermaster', ts: [4121, 0] }).text, 'Master of the Fighters Guild, Anticlere');
  assert.deepEqual(titleBadge({ title: 'formermaster', ts: [4017, 0] }).text, 'Former Master of the Mages Guild, Daggerfall');
  assert.deepEqual(titleBadge({ title: 'chapterofficer' }).text, 'Chapter Officer');
  assert.deepEqual([TITLE_TEXT.chaptermaster, TITLE_TEXT.chapterofficer, TITLE_TEXT.formermaster], ['Chapter Master', 'Chapter Officer', 'Former Master']);
  const hex = (t) => TITLE_RGBA[t].slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  assert.deepEqual(CHAPTER_TITLES.slice(0, 3).map(hex), ['7fb2e5', 'a8c4dd', '9aa0a8']);   // PIN MOVED (CHAP6e): two more after them
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** A service with the Chapters open and CHAPTER_TITLES `titles`; a registered account with a realm character `R`. */
async function stand(t, titles = 'on') {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ CHAPTERS_OPEN: 'on', CHAPTER_TITLES: titles });
  const raw = svc.env.DB._raw;
  confirmChapters(raw, [17, 21]);   // PIN MOVED (AUDIT CHAP4 E3): the titles only at a chapter confirmed now
  const who = await svc.registered('Alda');
  const R = await seatRealm(svc.env, who.secret, 'Alda');
  const other = await seatRealm(svc.env, who.secret, 'Bryn');
  const week = meritWeekOf(T0);
  const seat = (char, f, region, s) => raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(f, region, char, who.id, s, week, week, T0);
  const lost = (char, f, region, w, to = null) => raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'seat', ?, ?, ?)").run(f, region, w, char, JSON.stringify({ from: 'master', to }), T0);
  const mint = async (character) => (await svc.call('/v1/auth/token', { character }, who.secret)).body;
  return { svc, raw, who, R, other, week, seat, lost, mint };
}

test('CHAP4c the service: shut, no chapter title is held; open, a Master\'s account wears its title and a token for that character signs it with its claim - another character of the account none (mutants: the switch, the wardrobe, the mint\'s character)', async (t) => {
  const shut = await stand(t, 'off');
  shut.seat(shut.R.id, FIGHTERS, ANTICLERE, 'master');
  assert.equal(chapterTitlesOpenFor({ id: shut.who.id }, shut.svc.env), false);
  assert.deepEqual([chapterTitlesOpenFor({ id: 'x' }, { CHAPTERS_OPEN: 'on' }), chapterTitlesOpenFor({ id: 'x' }, { CHAPTERS_OPEN: 'on', CHAPTER_TITLES: 'yes' }),
    chapterTitlesOpenFor({ id: 'x' }, { CHAPTERS_OPEN: 'off', CHAPTER_TITLES: 'on' }), chapterTitlesOpenFor({ id: 'x' }, { CHAPTERS_OPEN: 'on', CHAPTER_TITLES: 'on' })],
  [false, false, false, true], 'on alone, and only where the Chapters are');
  assert.equal((await shut.svc.call('/v1/account/title', { title: 'chaptermaster' }, shut.who.secret)).status, 403, 'shut: not held');
  const s = await stand(t);
  assert.equal((await s.svc.call('/v1/account/title', { title: 'chaptermaster' }, s.who.secret)).status, 403, 'no seat yet');
  s.seat(s.R.id, FIGHTERS, ANTICLERE, 'master');
  const equip = await s.svc.call('/v1/account/title', { title: 'chaptermaster' }, s.who.secret);
  assert.equal(equip.status, 200, JSON.stringify(equip.body));
  assert.ok(equip.body.titles.includes('chaptermaster') && !equip.body.titles.includes('chapterofficer'));
  const m = await s.mint(s.R.id);
  assert.deepEqual([m.title, m.ts], ['chaptermaster', [4121, 0]]);
  const claims = JSON.parse(Buffer.from(m.token.split('.')[1], 'base64url').toString());
  assert.deepEqual([claims.t, claims.ts], ['chaptermaster', [4121, 0]], 'in the signed claims');
  assert.deepEqual([(await s.mint(s.other.id)).title ?? null], [null], 'the account\'s other character holds no seat: no title signed for it');
  // a hidden guild's seat gives none
  s.raw.prepare('DELETE FROM npc_chapter_seats').run();
  s.seat(s.R.id, THIEVES, ANTICLERE, 'master');
  assert.deepEqual(await chapterTitlesOfAccount(s.svc.env.DB, s.who.id, T0), []);
});

test('CHAP4c a Former Master: a Master\'s seat lost this Season titles its character until the Season\'s end - never one lost in a Season before, never while it holds that Master\'s seat again; a dead character\'s nothing (mutants: the Season\'s floor, the from, the held guard, the dead)', async (t) => {
  const s = await stand(t);
  const start = Math.floor(s.week / 8) * 8;   // no Season counted: the eight-week block
  s.lost(s.R.id, FIGHTERS, ANTICLERE, start, 'officer');
  s.seat(s.R.id, FIGHTERS, ANTICLERE, 'officer');
  s.lost(s.R.id, MAGES, DAGGERFALL, start - 1);   // the Season before
  s.lost(s.other.id, MAGES, ANTICLERE, start);
  s.seat(s.other.id, MAGES, ANTICLERE, 'master');   // held again
  s.raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (40, 17, ?, 'seat', ?, ?, ?)").run(start, s.R.id, JSON.stringify({ from: 'officer', to: null }), T0);   // an officer's seat lost: no Former Master
  assert.deepEqual((await chapterTitlesOfAccount(s.svc.env.DB, s.who.id, T0)).map((x) => [x.char === s.R.id ? 'R' : 'other', x.title, x.ts[0]]).sort(), [
    ['R', 'chapterofficer', 4121], ['R', 'formermaster', 4121], ['other', 'chaptermaster', 4021],
  ].sort());
  assert.deepEqual((await chapterTitlesOfAccount(s.svc.env.DB, s.who.id, T0, null, s.R.id)).map((x) => x.title), ['chapterofficer', 'formermaster'], 'one character\'s');
  assert.equal((await s.svc.call('/v1/account/title', { title: 'formermaster' }, s.who.secret)).status, 200);
  assert.deepEqual((await s.mint(s.R.id)).ts, [4121, 0]);
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(T0, s.R.id);
  assert.deepEqual((await chapterTitlesOfAccount(s.svc.env.DB, s.who.id, T0, null, s.R.id)), [], 'a dead character holds nothing');
});

test('CHAP4c the wiring: the relay\'s version is a new one with its law; the toml ships the switch off; the wardrobe and the mint lay the chapters\' titles (mutants: each seam)', () => {
  assert.match(rd('server-account/wrangler.toml'), /\nCHAPTER_TITLES = "off"\n/);
  assert.match(rd('test/relayversion.test.js'), /\n  world183: '[0-9a-f]{64}',   \/\/ CHAP4c /);   // PIN MOVED (the merge of main past CARDS10's world182): world183; PIN MOVED (AUDIT CHAP4 R12): CHAP4c's own row - world179's is HOURS-FIRST's, world180's TAVERN-TABLES' and world181's TV-BEYOND's since the merges of main
  const ix = rd('server-account/src/index.js');
  assert.match(ix, /const withSeatTitles = async \(ctx, player, env\) => withChapterTitles\(ctx, /);
  assert.match(ix, /const worn = await withChapterTitles\(ctx, seats \? /);
  assert.match(ix, /\.find\(\(t\) => t\.title === wornT\) \?\? null : null;/);
  assert.match(rd('server-account/src/titles.js'), /if \(Array\.isArray\(player\?\.chapterTitles\)\) for \(const t of player\.chapterTitles\) if \(CHAPTER_TITLES\.includes\(t\) && !held\.includes\(t\)\) held\.push\(t\);/);
});
