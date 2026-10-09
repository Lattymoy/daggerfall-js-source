// @ts-nocheck
// CHAP7a (2026-10-09, Mac: "continue", the Chapters arc's last slice - bible/11-Multiplayer/Chapters-Arc.md section 8,
// CALL 6): THE PATRONS ON THE SERVICE. A player guild's guildmaster bids silver from the guild's treasury for a chapter's
// patronage in the Season after this one, held in escrow and raised, never lowered; at the Turning that opens that Season
// the highest bid wins and is burnt, every other goes home (burnt where its guild is gone or full); the chapter keeps its
// patron for the Season, the Chronicle names it, the sheet and the board carry it. Never a hidden guild's chapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAPTER_PATRON_MIN, patronBidOk, patronEscrowId, patronWinnerOf, chapterPatronOf, chapterPatronLine, chapterChronicleLine, meritWeekOf,
} from '../src/net/npcChapterLaw.js';
import { MARKS_KINDS, MARKS_MAX, utcDay } from '../src/net/marksLaw.js';
import { GUILD_FOUND_RENOWN } from '../src/net/guildLaw.js';
import { seatWeekStartMs } from '../src/net/townSeatLaw.js';
import { settleChaptersDue, CHAPTER_TURNING_GRACE_S } from '../server-account/src/npcChapters.js';
import { standService, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, ANTICLERE = 21, DAGGERFALL = 17, BETONY = 19, FIGHTERS = 41, MAGES = 40, THIEVES = 42;
const NOW = T0 + 30 * 7 * DAY;
const WEEK = meritWeekOf(NOW);
/** Season 1 from WEEK - 1 (Season 0 four weeks): NOW is its second week; its last Turning, the one that opens Season 2,
 *  closes WEEK + 6. */
const ZERO = WEEK - 5;
const LAST = WEEK + 6;
const turnOf = (w) => seatWeekStartMs(w + 1) / 1000 + CHAPTER_TURNING_GRACE_S + 1;
let n = 0;
const rid = () => `pat-${String(++n).padStart(6, '0')}`;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP7a the law: the least bid, a bid more than it stood at under the cap; the escrow\'s id; the winner - the highest, at a tie the first to stand at it, then the lower guild; the ledger\'s three kinds (mutants: each bound, the order, the kinds)', () => {
  assert.equal(CHAPTER_PATRON_MIN, 1000);
  assert.deepEqual([patronBidOk(1000), patronBidOk(999), patronBidOk(1000.5), patronBidOk('1500'), patronBidOk(MARKS_MAX), patronBidOk(MARKS_MAX + 1)], [true, false, false, false, true, false]);
  assert.deepEqual([patronBidOk(1500, 1500), patronBidOk(1501, 1500), patronBidOk(1200, 1500)], [false, true, false], 'more than it stood at');
  assert.equal(patronEscrowId(2, FIGHTERS, ANTICLERE, 'gabcdefghij'), 'patron:2:4121:gabcdefghij');
  const b = (guild, amount, at) => ({ guild, amount, at });
  assert.equal(patronWinnerOf([]), null);
  assert.deepEqual(patronWinnerOf([b('ga', 1000, 5), b('gb', 1500, 9), b('gc', 1200, 1)]), b('gb', 1500, 9), 'the highest');
  assert.deepEqual(patronWinnerOf([b('gb', 1500, 9), b('ga', 1500, 4)]), b('ga', 1500, 4), 'a tie: the first to stand at it');
  assert.deepEqual(patronWinnerOf([b('gz', 1500, 4), b('ga', 1500, 4)]), b('ga', 1500, 4), 'then the lower guild');
  assert.deepEqual(patronWinnerOf([null, b(7, 9000, 1), b('ga', 1.5, 1), b('gb', 1000, 2)]), b('gb', 1000, 2), 'a malformed bid is none');
  assert.deepEqual(['patron-escrow', 'patron', 'patron-return'].map((k) => MARKS_KINDS[k]), ['move', 'burn', 'move']);
});

test('CHAP7a the words: a patron as the sheet says it, each field checked; the Chronicle\'s line - "For the Season of First Seed, the Iron Wolves took the patronage of the Fighters Guild." - never a hidden guild\'s, a Season it cannot name, or no name (mutants: each guard, the words)', () => {
  assert.deepEqual(chapterPatronOf({ id: 'gabcdefghij', name: ' The Iron Wolves ', tag: 'IWLF', heraldry: {} }), { id: 'gabcdefghij', name: 'The Iron Wolves', tag: 'IWLF' });
  assert.deepEqual(chapterPatronOf({ id: 'gabcdefghij', name: 'x'.repeat(40), tag: 'iw' }), { id: 'gabcdefghij', name: 'x'.repeat(32), tag: '' }, 'the name\'s cap; a tag the law refuses dropped');
  assert.deepEqual([chapterPatronOf(null), chapterPatronOf({ id: 'nope', name: 'A' }), chapterPatronOf({ id: 'gabcdefghij', name: '  ' }), chapterPatronOf({ id: 'gabcdefghij' })], [null, null, null, null]);
  const row = { kind: 'patron', faction: FIGHTERS, week: 40, data: { season: 1, guild: 'gabcdefghij', name: 'the Iron Wolves', tag: 'IWLF' } };
  const line = chapterPatronLine(row);
  assert.match(line, /^For the Season of [A-Z][a-z]+( [A-Z][a-z]+)*, the Iron Wolves took the patronage of the Fighters Guild\.$/);
  assert.equal(chapterChronicleLine(row, 0), line, 'the Hall of Records reads it');
  assert.deepEqual([chapterPatronLine({ ...row, faction: THIEVES }), chapterPatronLine({ ...row, data: { ...row.data, season: -1 } }), chapterPatronLine({ ...row, data: { ...row.data, name: ' ' } }),
    chapterPatronLine({ ...row, kind: 'event' })], [null, null, null, null]);
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** Minted - burnt = held, the escrow's open lines counted as held. */
function ledgerAddsUp(raw) {
  const sum = (sql) => Number(raw.prepare(sql).get().s);
  const minted = sum("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE src_kind = 'mint'");
  const burnt = sum("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE dst_kind = 'burn'");
  const escrow = sum("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE dst_kind = 'escrow'") - sum("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE src_kind = 'escrow'");
  return minted - burnt === sum('SELECT COALESCE(SUM(balance), 0) AS s FROM marks') + sum('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks') + escrow;
}

/** A service with the Chapters and Marks open and Season 1 counted; `guild(handle, name, tag, marks)` founds a player
 *  guild whose treasury holds `marks`. */
async function stand(t, { zero = ZERO, marksOpen = 'on' } = {}) {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const svc = await standService({ CHAPTERS_OPEN: 'on', MARKS_OPEN: marksOpen, ...(zero == null ? {} : { SEASON_ZERO_WEEK: String(zero) }) });
  const raw = svc.env.DB._raw;
  confirmChapters(raw, [DAGGERFALL, ANTICLERE]);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 1);
  const guild = async (handle, name, tag, marks) => {
    const who = await svc.registered(handle, { renown: GUILD_FOUND_RENOWN });
    const r = await svc.found(who, { name, tag });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const id = r.body.guild.id;
    if (marks) raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(id, marks, `seed-${id}`);
    return { who, id };
  };
  const bid = (g, faction, region, marks, r = rid()) => svc.call('/v1/chapters/patron', { character: g.who.character, faction, region, marks, rid: r }, g.who.secret);
  const treasury = (g) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(g.id)?.balance ?? 0);
  return { svc, raw, guild, bid, treasury };
}

test('CHAP7a a bid: the guildmaster\'s, from the guild\'s treasury into escrow for the Season after this one; raised by the difference, never lowered; a request made twice made once; refused for no Season, a hidden or unconfirmed chapter, a guild\'s other rank, too little, more than one move, a spent request id, a short or empty treasury, past the cap, a raise another raise beat, the Marks shut, and once the Season has opened (mutants: each door, the difference, the guards)', async (t) => {
  const s = await stand(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 5000);
  let r = await s.bid(a, FIGHTERS, ANTICLERE, 1500);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.season, r.body.marks, r.body.guildMarks], [2, 1500, 3500]);
  const esc = patronEscrowId(2, FIGHTERS, ANTICLERE, a.id);
  assert.deepEqual(s.raw.prepare("SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = 'patron-escrow'").all().map((x) => ({ ...x })),
    [{ src_kind: 'guild', src_id: a.id, dst_kind: 'escrow', dst_id: esc, amount: 1500 }]);
  const same = rid();
  r = await s.bid(a, FIGHTERS, ANTICLERE, 2000, same);
  assert.deepEqual([r.status, r.body.marks, s.treasury(a)], [200, 2000, 3000], 'raised: the 500 more alone');
  r = await s.bid(a, FIGHTERS, ANTICLERE, 2000, same);
  assert.deepEqual([r.status, r.body.repeat, s.treasury(a)], [200, true, 3000], 'the same request: made once');
  assert.deepEqual([(await s.bid(a, FIGHTERS, ANTICLERE, 2000)).body.error, (await s.bid(a, FIGHTERS, ANTICLERE, 1800)).body.error, (await s.bid(a, MAGES, ANTICLERE, 999)).body.error],
    ['patron-low', 'patron-low', 'patron-low'], 'never lowered; never under the least');
  assert.deepEqual((await s.bid(a, MAGES, ANTICLERE, 3001)), { status: 409, body: { error: 'guild-marks-short' } });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM npc_chapter_patron_bids WHERE faction = ?").get(MAGES).n, 0, 'nothing held for it');
  assert.deepEqual([(await s.bid(a, THIEVES, ANTICLERE, 1500)).status, (await s.bid(a, FIGHTERS, BETONY, 1500)).body.error], [404, 'no-chapter'], 'a hidden guild\'s chapter; one not confirmed');
  assert.deepEqual([(await s.bid(a, FIGHTERS, ANTICLERE, 1.5)).body.error, (await s.bid(a, FIGHTERS, ANTICLERE, MARKS_MAX + 1)).body.error], ['bad-marks', 'bad-marks']);
  assert.deepEqual((await s.bid(a, MAGES, DAGGERFALL, 1_002_000)).body.error, 'bad-marks', 'more than one move holds at once');
  // a request id another of the account's acts spent
  const spent = rid();
  s.svc.seedMarks(a.who, 100);
  assert.equal((await s.svc.call('/v1/marks/guild/deposit', { character: a.who.character, marks: 100, rid: spent }, a.who.secret)).status, 200);
  assert.deepEqual(await s.bid(a, MAGES, DAGGERFALL, 1500, spent), { status: 400, body: { error: 'marks-rid' } });
  // a guild whose treasury never held a Mark (no row at all)
  const poor = await s.guild('Eda', 'Empty Purses', 'EP', 0);
  assert.deepEqual(await s.bid(poor, FIGHTERS, ANTICLERE, 1000), { status: 409, body: { error: 'guild-marks-short' } });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE src_id = ?").get(poor.id).n, 0);
  // a bid standing near the cap: past it, the shape's refusal
  s.raw.prepare("INSERT INTO npc_chapter_patron_bids (faction, region, season, guild_id, amount, at) VALUES (?, ?, 2, ?, ?, 0)").run(MAGES, DAGGERFALL, poor.id, MARKS_MAX - 500_000);
  assert.deepEqual((await s.bid(poor, MAGES, DAGGERFALL, MARKS_MAX + 1)).body.error, 'bad-marks');
  // a raise that another raise beat to the table: refused, nothing held
  const db = s.svc.env.DB, batch = db.batch.bind(db);
  db.batch = async (stmts) => { s.raw.prepare('UPDATE npc_chapter_patron_bids SET amount = 2100 WHERE guild_id = ? AND faction = ?').run(a.id, FIGHTERS); return batch(stmts); };
  const raced = await s.bid(a, FIGHTERS, ANTICLERE, 2500);
  db.batch = batch;
  assert.deepEqual([raced.status, raced.body.error, s.treasury(a)], [409, 'patron-low', 3100], 'the treasury untouched (the 100 deposited above)');
  s.raw.prepare('UPDATE npc_chapter_patron_bids SET amount = 2000 WHERE guild_id = ? AND faction = ?').run(a.id, FIGHTERS);
  // a member of the guild who is not its guildmaster
  const m = await s.svc.registered('Bryn');
  const B = await seatRealm(s.svc.env, m.secret, 'Bryn');
  s.raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 1, ?, ?)').run(m.id, B.id, a.id, 'Bryn', NOW);
  assert.deepEqual(await s.svc.call('/v1/chapters/patron', { character: B.id, faction: MAGES, region: ANTICLERE, marks: 1500, rid: rid() }, m.secret), { status: 403, body: { error: 'guild-rank' } });
  // the Season opened: its Turning settled
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(LAST);
  assert.deepEqual(await s.bid(a, MAGES, DAGGERFALL, 1500), { status: 409, body: { error: 'closed' } });
  assert.ok(ledgerAddsUp(s.raw));
  const none = await stand(t, { zero: null });
  const g = await none.guild('Cael', 'Grey Lanterns', 'GL', 5000);
  assert.deepEqual(await none.bid(g, FIGHTERS, ANTICLERE, 1500), { status: 409, body: { error: 'no-season' } });
  const shut = await stand(t, { marksOpen: 'off' });
  const h = await shut.guild('Dara', 'Red Hands', 'RH', 5000);
  assert.deepEqual(await shut.bid(h, FIGHTERS, ANTICLERE, 1500), { status: 403, body: { error: 'marks-closed' } });
});

test('CHAP7a the Turning that opens the Season decides it: each chapter\'s highest bid of a guild standing burnt and its guild the patron, every other home; a struck chapter\'s, a gone guild\'s (burnt), an earlier Season\'s (never the winner); the Chronicle\'s row; the sheet\'s patron, and none once its guild is gone; the ledger adds up (mutants: the winner, the burn, the returns, the patron written, the rows)', async (t) => {
  const s = await stand(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 10_000);
  const b = await s.guild('Bryn', 'Grey Lanterns', 'GLN', 10_000);
  const c = await s.guild('Cael', 'Red Hands', 'RDH', 10_000);
  const d = await s.guild('Dara', 'Salt Kings', 'SKG', 10_000);
  assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 2000)).status, 200);
  assert.equal((await s.bid(b, FIGHTERS, ANTICLERE, 2500)).status, 200);
  assert.equal((await s.bid(b, MAGES, ANTICLERE, 1000)).status, 200);
  assert.equal((await s.bid(c, MAGES, ANTICLERE, 1000)).status, 200);   // a tie: B stood at it first
  assert.equal((await s.bid(c, FIGHTERS, DAGGERFALL, 3000)).status, 200);
  assert.equal((await s.bid(d, FIGHTERS, DAGGERFALL, 4000)).status, 200);
  assert.equal((await s.bid(d, MAGES, ANTICLERE, 4000)).status, 200);   // the highest, of a guild gone before the Turning
  assert.equal((await s.bid(a, MAGES, DAGGERFALL, 1500)).status, 200);
  s.raw.prepare('UPDATE npc_chapter_patron_bids SET at = at + 5 WHERE guild_id = ?').run(c.id);
  s.raw.prepare('DELETE FROM guild_members WHERE guild_id = ?').run(d.id);
  s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('guild', ?, 'burn', NULL, 'test', ?, 1, 1, 'seed', NULL, 'gone')`).run(d.id, s.treasury(d));   // its treasury out as a disband takes it
  s.raw.prepare('DELETE FROM guild_marks WHERE guild_id = ?').run(d.id);
  s.raw.prepare('DELETE FROM guilds WHERE id = ?').run(d.id);
  // earlier Seasons' bids still open (their Seasons opened while the Chapters were shut) - one the highest at its chapter
  const earlier = (f, g, guild, amount) => {
    s.raw.prepare("INSERT INTO npc_chapter_patron_bids (faction, region, season, guild_id, amount, at, state) VALUES (?, ?, 1, ?, ?, 0, 'open')").run(f, g, guild, amount);
    s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('mint', NULL, 'escrow', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(patronEscrowId(1, f, g, guild), amount, `seed-${f}-${g}-${guild}`);
  };
  earlier(MAGES, DAGGERFALL, b.id, 1200);
  earlier(FIGHTERS, ANTICLERE, a.id, 9000);
  // DAGGERFALL struck before the Turning: its bids all go home
  s.raw.prepare('DELETE FROM npc_hall_regions WHERE region = ?').run(DAGGERFALL);
  const before = { a: s.treasury(a), b: s.treasury(b), c: s.treasury(c) };
  assert.equal((await settleChaptersDue(s.svc.env.DB, turnOf(LAST), ZERO, 'on')), 7);
  const lines = s.raw.prepare("SELECT dst_kind, dst_id, kind, amount, rid, actor FROM marks_ledger WHERE kind IN ('patron', 'patron-return') ORDER BY rid").all().map((x) => ({ ...x }));
  const of = (guild, f, g, season = 2) => lines.find((l) => l.rid === patronEscrowId(season, f, g, guild));
  assert.deepEqual([of(b.id, FIGHTERS, ANTICLERE).kind, of(b.id, FIGHTERS, ANTICLERE).dst_kind, of(b.id, FIGHTERS, ANTICLERE).amount], ['patron', 'burn', 2500], 'the highest burnt');
  assert.deepEqual([of(a.id, FIGHTERS, ANTICLERE).kind, of(a.id, FIGHTERS, ANTICLERE).dst_id], ['patron-return', a.id], 'the other home');
  assert.equal(of(b.id, MAGES, ANTICLERE).kind, 'patron', 'a gone guild\'s highest passed over; then a tie: the first to stand at it');
  assert.equal(of(c.id, MAGES, ANTICLERE).kind, 'patron-return');
  assert.deepEqual([of(d.id, MAGES, ANTICLERE).kind, of(d.id, MAGES, ANTICLERE).dst_kind], ['patron-return', 'burn']);
  assert.deepEqual([of(a.id, FIGHTERS, ANTICLERE, 1).kind, of(a.id, FIGHTERS, ANTICLERE, 1).amount, of(a.id, FIGHTERS, ANTICLERE).amount], ['patron-return', 9000, 2000],
    'an earlier Season\'s bid never wins this one, and each line its own bid\'s');
  assert.deepEqual([of(c.id, FIGHTERS, DAGGERFALL).kind, of(d.id, FIGHTERS, DAGGERFALL).kind, of(d.id, FIGHTERS, DAGGERFALL).dst_kind, of(a.id, MAGES, DAGGERFALL).kind],
    ['patron-return', 'patron-return', 'burn', 'patron-return'], 'a struck chapter\'s bids all home - a gone guild\'s burnt');
  assert.deepEqual([of(b.id, MAGES, DAGGERFALL, 1).kind, of(b.id, MAGES, DAGGERFALL, 1).dst_id], ['patron-return', b.id], 'an earlier Season\'s open bid home');
  assert.ok(lines.every((l) => l.actor === 'chapters'));
  assert.deepEqual([s.treasury(a), s.treasury(b), s.treasury(c)], [before.a + 2000 + 1500 + 9000, before.b + 1200, before.c + 1000 + 3000]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM npc_chapter_patron_bids WHERE state = 'open'").get().n, 0);
  assert.deepEqual(s.raw.prepare("SELECT faction, region, guild_id FROM npc_chapter_patron_bids WHERE state = 'won' ORDER BY faction").all().map((x) => [x.faction, x.region, x.guild_id]),
    [[MAGES, ANTICLERE, b.id], [FIGHTERS, ANTICLERE, b.id]]);
  assert.deepEqual(s.raw.prepare('SELECT faction, region, patron, patron_season FROM npc_chapters WHERE patron IS NOT NULL ORDER BY faction').all().map((x) => [x.faction, x.region, x.patron, x.patron_season]),
    [[MAGES, ANTICLERE, b.id, 2], [FIGHTERS, ANTICLERE, b.id, 2]]);
  const rows = s.raw.prepare("SELECT faction, region, week, char_id, data FROM npc_chapter_history WHERE kind = 'patron' ORDER BY faction").all();
  assert.deepEqual(rows.map((x) => [x.faction, x.region, x.week, x.char_id, JSON.parse(x.data)]), [
    [MAGES, ANTICLERE, LAST, '', { season: 2, guild: b.id, name: 'Grey Lanterns', tag: 'GLN' }],
    [FIGHTERS, ANTICLERE, LAST, '', { season: 2, guild: b.id, name: 'Grey Lanterns', tag: 'GLN' }],
  ]);
  assert.ok(ledgerAddsUp(s.raw), 'minted - burnt = held, the escrow counted');
  // the sheet and the board, in Season 2
  t.mock.method(Date, 'now', () => turnOf(LAST) * 1000);
  const sheet = (await s.svc.call('/v1/chapters/list', {}, a.who.secret)).body;
  const fa = sheet.chapters.find((x) => x.f === FIGHTERS && x.region === ANTICLERE);
  assert.deepEqual([fa.patron.id, fa.patron.name, fa.patron.tag, typeof fa.patron.heraldry], [b.id, 'Grey Lanterns', 'GLN', 'object']);
  assert.equal(sheet.chapters.find((x) => x.f === FIGHTERS && x.region === DAGGERFALL)?.patron, undefined);
  s.raw.prepare('DELETE FROM guilds WHERE id = ?').run(b.id);
  assert.equal((await s.svc.call('/v1/chapters/list', {}, a.who.secret)).body.chapters.find((x) => x.f === FIGHTERS && x.region === ANTICLERE).patron, undefined, 'a patron gone since: none');
});

// ── THE BOARD ───────────────────────────────────────────────────────

const hourAt = (sec) => Math.floor((((Math.floor(sharedClassicMinutes(sec * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let x = from; x < from + 2 * 7200; x += 30) if (hourAt(x) === want && hourAt(x - 60) === want && hourAt(x + 60) === want) return x;
  throw new Error('no such hour');
}

test('CHAP7a the board: each chapter\'s patron this Season, to every reader; the guildmaster\'s own bids for the Season after, its own alone - none to another rank, none on a hidden guild\'s chapter (mutants: the patron, the guildmaster\'s read, its Season)', async (t) => {
  const noon = secondAt(utcDay(NOW) * DAY + 3600, 12);
  t.mock.method(Date, 'now', () => noon * 1000);
  const week = meritWeekOf(noon);
  const s = await standService({ CHAPTERS_OPEN: 'on', PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', SEASON_ZERO_WEEK: String(week - 5) });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(noon - days * DAY, who.id);
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`); age(w, 8);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [MAGES, FIGHTERS, THIEVES] } }, w.secret)).status, 200);
  }
  const g = await s.registered('Ground'); age(g, 8);
  const p = herbPatches({ x: 300, y: 200, day: utcDay(noon), climate: 231, confirmed: false })[0];
  assert.equal((await s.call('/v1/prof/harvest', {
    character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(noon), slot: p.slot }), kind: 'herbs',
    climate: 231, region: ANTICLERE, act: { clean: false, bruised: false }, at: noon - 2, rid: rid(),
  }, g.secret)).status, 200);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(week - 1);
  const gm = await s.registered('Alda', { renown: GUILD_FOUND_RENOWN });
  const id = (await s.found(gm, { name: 'Grey Lanterns', tag: 'GLN' })).body.guild.id;
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', 5000, 1, 1, 'seed', NULL, 'seed-gl')`).run(id);
  raw.prepare("INSERT INTO npc_chapters (faction, region, strength, week, merit, at, patron, patron_season) VALUES (?, ?, 50, ?, 0, 0, ?, 1)").run(FIGHTERS, ANTICLERE, week - 1, id);
  raw.prepare("INSERT INTO npc_chapters (faction, region, strength, week, merit, at, patron, patron_season) VALUES (?, ?, 50, ?, 0, 0, ?, 0)").run(MAGES, ANTICLERE, week - 1, id);   // last Season's
  assert.equal((await s.call('/v1/chapters/patron', { character: gm.character, faction: MAGES, region: ANTICLERE, marks: 1500, rid: rid() }, gm.secret)).status, 200);
  const lines = (await s.call('/v1/writs/list', { character: gm.character, region: ANTICLERE }, gm.secret)).body.chapters;
  const by = (f) => lines.find((x) => x.faction === f);
  assert.deepEqual([by(FIGHTERS).patron?.id, by(FIGHTERS).patron?.name, by(MAGES).patron], [id, 'Grey Lanterns', undefined], 'this Season\'s patron alone');
  assert.deepEqual([by(FIGHTERS).patronBid, by(MAGES).patronBid], [{ season: 2, marks: 0 }, { season: 2, marks: 1500 }]);
  assert.equal(by(THIEVES), undefined, 'a hidden guild\'s chapter: not on a stranger\'s board');
  const other = await s.registered('Bryn');
  const B = await seatRealm(s.env, other.secret, 'Bryn');
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 2, ?, ?)').run(other.id, B.id, id, 'Bryn', noon);
  const theirs = (await s.call('/v1/writs/list', { character: B.id, region: ANTICLERE }, other.secret)).body.chapters;
  assert.deepEqual([theirs.find((x) => x.faction === FIGHTERS).patron?.id, theirs.find((x) => x.faction === MAGES).patronBid], [id, undefined], 'a member: the patron, no bid');
});

test('CHAP7a a guild near the cap: its returns reckoned together - what passes the cap burnt, never the Turning failed (mutants: the running treasury)', async (t) => {
  const s = await stand(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 10_000);
  const b = await s.guild('Bryn', 'Grey Lanterns', 'GLN', 10_000);
  assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 1000)).status, 200);
  assert.equal((await s.bid(a, MAGES, ANTICLERE, 1000)).status, 200);
  assert.equal((await s.bid(b, FIGHTERS, ANTICLERE, 5000)).status, 200);
  assert.equal((await s.bid(b, MAGES, ANTICLERE, 5000)).status, 200);
  s.raw.prepare('UPDATE guild_marks SET balance = ? WHERE guild_id = ?').run(MARKS_MAX - 1500, a.id);
  assert.equal(await settleChaptersDue(s.svc.env.DB, turnOf(LAST), ZERO, 'on'), 7, 'the Turning settles');
  const kinds = s.raw.prepare("SELECT dst_kind FROM marks_ledger WHERE kind = 'patron-return' ORDER BY rid").all().map((x) => x.dst_kind);
  assert.deepEqual(kinds.sort(), ['burn', 'guild'], 'one home, the next past the cap burnt');
  assert.equal(s.treasury(a), MARKS_MAX - 500);
});

test('CHAP7a the wiring: the route and its door; the migrations grown in place; the Turning\'s batch carries the patrons and fails while a bid stands undecided; the opening week clears a developers\' patron (mutants: each seam)', () => {
  const ix = rd('server-account/src/index.js');
  assert.match(ix, /: path === '\/v1\/chapters\/patron' \? await bidPatron\(ctx, who\.player, env, body\)/);
  assert.match(rd('server-account/src/service.js'), /\n  '\/v1\/chapters\/patron',/);
  const nc = rd('server-account/src/npcChapters.js');
  assert.match(nc, /const patrons = next && next\.start === week \+ 1 \? await patronsDrawn\(db, next\.n, keys\) : null;/);
  assert.match(nc, /\.bind\(week, nowS, JSON\.stringify\(\[\.\.\.seasonRows, \.\.\.\(patrons\?\.rows \?\? \[\]\)\]\)\),\n\s+\.\.\.\(patrons \? patronStatements\(db, patrons, nowS\) : \[\]\),/);
  assert.match(nc, /INSERT INTO realm_tx_guard \(moved, expected\) SELECT 1, 0 WHERE EXISTS \(SELECT 1 FROM npc_chapter_patron_bids WHERE season <= \?1 AND state = 'open'\)/);
  assert.match(nc, /doctrine = NULL, doctrine_season = NULL, patron = NULL, patron_season = NULL WHERE true/);
  assert.match(rd('server-account/migrations/0100_npc_chapters.sql'), /\n  patron    TEXT,\n  patron_season INTEGER,\n/);
  assert.match(rd('server-account/migrations/0101_npc_seats.sql'), /CREATE TABLE IF NOT EXISTS npc_chapter_patron_bids \(/);
});
