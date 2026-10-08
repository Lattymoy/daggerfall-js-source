// AUDIT CHAP3 (2026-10-08, Mac: "Let's audit everything we have so far before we continue") - a pin a fix: CHAP0 to
// CHAP3c read again through six lenses (the service, the economy, the client, Daggerfall's law, the record, the pins).
// bible/01-Overview/Audit-Chapters-3.md is the record; each test names the findings it holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';

import {
  memberWrit, chapterShelfQuality, hallRememberLine, rollAdopt, ROLL_FACTIONS,
} from '../src/net/npcChapterLaw.js';
import { regionWritTable } from '../src/net/nodeLaw.js';
import { createChapterSheet, SHEET_KEPT_MS } from '../src/net/chapterSheet.js';
import { settleChapterWeek, settleChaptersDue, CHAPTER_TURNING_GRACE_S } from '../server-account/src/npcChapters.js';
import { listHalls } from '../server-account/src/npcHalls.js';
import { creditReceipt } from '../server-account/src/npcReceipts.js';
import { listWrits } from '../server-account/src/professions.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { meritWeekOf } from '../src/net/npcChapterLaw.js';
import { seatWeekStartMs, seasonEndingAt } from '../src/net/townSeatLaw.js';
import { gameDayAt } from '../src/net/gateLaw.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21;
const tick = () => new Promise((r) => setImmediate(r));

const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (x) => { _now = x; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `audit3-${String(++_rid).padStart(6, '0')}`;

/** Confirmed towns of `towns` ([key, region, factions]), the ground of Anticlere witnessed, a member of `members`. */
async function stand({ open = 'on', towns = [[77, ANTICLERE, [41, 368]]], members = [41], extra = {} } = {}) {
  clock(NOON);
  const s = await standService({ CHAPTERS_OPEN: open, PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra,Wit0,Wit1,Wit2,Ground', ...extra });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const wits = [];
  for (let i = 0; i < 3; i++) { const w = await s.registered(`Wit${i}`); age(w, 8); wits.push(w); }
  for (const [key, region, factions] of towns) {
    for (const w of wits) {
      clock(_now + 1);
      assert.equal((await s.call('/v1/chapters/witness', { hall: { key, region, factions } }, w.secret)).status, 200);
    }
  }
  const g = await s.registered('Ground');
  age(g, 8);
  const p = herbPatches({ x: 300, y: 200, day: utcDay(_now), climate: WOODS, confirmed: false })[0];
  assert.equal((await s.call('/v1/prof/harvest', {
    character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
    climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid(),
  }, g.secret)).status, 200);
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 41: 10, 368: 5 }, members: members.map((f) => ({ f, rank: 0 })) } });
  raw.prepare('UPDATE npc_roll SET joined_at = joined_at - ? WHERE char_id = ?').run(8 * DAY, R.id);
  const merit = (week, faction, region, amount, source = 'raid', ref = `x:${++_rid}`) => raw.prepare(`INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(week, faction, region, who.id, R.id, source, amount, ref, _now);
  const strength = (f, region = ANTICLERE) => raw.prepare('SELECT strength FROM npc_chapters WHERE faction = ? AND region = ?').get(f, region)?.strength ?? null;
  return { ...s, raw, who, R, wits, merit, strength };
}

// ── THE SERVICE ─────────────────────────────────────────────────────

test('AUDIT CHAP3 S1: a week settles its grace after its boundary - a credit in flight across the boundary lands in its week first (mutants: the grace, its number)', async () => {
  const s = await stand();
  const week = meritWeekOf(_now);
  s.raw.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, ?, 0)').run(week - 1, 'on');
  const turning = seatWeekStartMs(week + 1) / 1000;
  assert.equal(CHAPTER_TURNING_GRACE_S, 300);
  assert.equal(await settleChaptersDue(s.env.DB, turning + 60), 0, 'inside the grace: the week is still open to its credits');
  s.merit(week, 41, ANTICLERE, 600);   // a credit stamped in the week, landing after its boundary
  assert.equal(await settleChaptersDue(s.env.DB, turning + CHAPTER_TURNING_GRACE_S - 1), 0);
  assert.equal(await settleChaptersDue(s.env.DB, turning + CHAPTER_TURNING_GRACE_S), 1);
  assert.equal(s.strength(41), 60, 'its Merit counted');
});

test('AUDIT CHAP3 S2: the Chapters shut - no hall writ posted, no Turning settled; the first week settled \'on\' after a \'dev\' week starts every chapter from 50 (mutants: the switch unread, the open column, the reset)', async () => {
  const s = await stand();
  assert.equal(await settleChaptersDue(s.env.DB, _now, null, 'off'), 0);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM npc_chapter_weeks').get().n, 0);
  s.env.CHAPTERS_OPEN = 'off';
  const mac = await s.registered('Mac');
  const r = await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.writs.length > 0 && r.body.writs.every((w) => w.kind === 'court'), 'the Court\'s stand');
  assert.deepEqual([s.raw.prepare('SELECT COUNT(*) AS n FROM hall_writ_days').get().n, s.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'hall'").get().n,
    s.raw.prepare('SELECT COUNT(*) AS n FROM npc_chapter_weeks').get().n], [0, 0, 0]);
  // a 'dev' week moved the chapters; the first 'on' week forgets it
  const week = meritWeekOf(_now);
  s.merit(week - 2, 41, ANTICLERE, 600);
  assert.deepEqual(await settleChapterWeek(s.env.DB, week - 2, _now, null, 'dev'), { settled: true, chapters: 2 });
  assert.deepEqual([s.strength(41), s.strength(368)], [60, 47]);
  await settleChapterWeek(s.env.DB, week - 1, _now, null, 'on');
  assert.deepEqual([s.strength(41), s.strength(368)], [47, 47], 'from 50, an idle week');
  assert.deepEqual(s.raw.prepare('SELECT week, open FROM npc_chapter_weeks ORDER BY week').all().map((x) => ({ ...x })), [{ week: week - 2, open: 'dev' }, { week: week - 1, open: 'on' }]);
  await settleChapterWeek(s.env.DB, week, _now, null, 'on');
  assert.equal(s.strength(41), 44, 'an \'on\' week after an \'on\' week carries its Strength');
  // the switch each route settles under is the service's own: the sheet's and the board's, at 'dev'
  for (const via of ['sheet', 'board']) {
    const t = await stand({ open: 'dev' });
    const dev = await t.registered('Devra');
    if (via === 'sheet') assert.equal((await t.call('/v1/chapters/list', {}, dev.secret)).status, 200);
    else await t.call('/v1/writs/list', { character: dev.character, region: ANTICLERE }, dev.secret);
    assert.deepEqual(t.raw.prepare('SELECT open FROM npc_chapter_weeks').all().map((x) => x.open), ['dev'], via);
  }
});

test('AUDIT CHAP3 S3: a witness that changed something tells every region its town\'s reports name; one that changed nothing tells none; a region\'s answer is computed once a change (mutants: the bump, its guard)', async () => {
  const s = await stand();
  const ver = () => s.raw.prepare('SELECT ver FROM npc_hall_regions WHERE region = ?').get(ANTICLERE).ver;
  const v0 = ver();
  // the same account again: nothing changed
  assert.deepEqual((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [41, 368] } }, s.wits[0].secret)).body, { ok: true, counted: true });
  assert.equal(ver(), v0, 'no news');
  const w = await s.registered('Wit9');
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 8 * DAY, w.id);
  await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [41, 368] } }, w.secret);
  assert.equal(ver(), v0 + 1, 'a fourth witness: a change');
  // read once: the row's answer stands under its version
  const r = await s.call('/v1/chapters/list', {}, s.who.secret);
  assert.deepEqual(r.body.chapters.map((c) => c.f), [41, 368]);
  const row = s.raw.prepare('SELECT chapters, ver, done FROM npc_hall_regions WHERE region = ?').get(ANTICLERE);
  assert.deepEqual([JSON.parse(row.chapters), row.done], [[41, 368], row.ver]);
});

test('AUDIT CHAP3 S4: a region\'s hall writs in one statement, their own batch - a hall batch that fails leaves the Court\'s day written (mutants: the statement a writ, the shared batch)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41, 368, 40, 21]]] });
  const mac = await s.registered('Mac');
  const player = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id);
  let hallInserts = 0;
  const spy = { prepare: (sql) => { if (/INSERT OR IGNORE INTO writs/.test(sql) && /'hall'/.test(sql)) hallInserts++; return s.env.DB.prepare(sql); }, batch: (l) => s.env.DB.batch(l) };
  await listWrits({ db: spy, nowS: _now }, { ...player }, s.env, { character: mac.character, region: ANTICLERE });
  assert.equal(hallInserts, 1, 'one statement for every chapter\'s writs');
  assert.ok(s.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'hall'").get().n >= 8);
  const t = await stand({ towns: [[77, ANTICLERE, [41]]] });
  const tm = await t.registered('Mac');
  const tp = t.raw.prepare('SELECT * FROM players WHERE id = ?').get(tm.id);
  const failing = { prepare: (sql) => t.env.DB.prepare(sql), batch: async (l) => { if (l.length === 2) throw new Error('D1 refused'); return t.env.DB.batch(l); } };
  await assert.rejects(listWrits({ db: failing, nowS: _now }, { ...tp }, t.env, { character: tm.character, region: ANTICLERE }));
  assert.deepEqual([t.raw.prepare('SELECT COUNT(*) AS n FROM writ_days').get().n, t.raw.prepare('SELECT COUNT(*) AS n FROM hall_writ_days').get().n], [1, 0], 'the Court\'s stood');
});

test('AUDIT CHAP3 S5/T10: a strike landing between a witness\'s check and its write takes the report with it - the answer is hall-struck; a strike tells the sheet at once (mutants: the strike unasked in the write)', async () => {
  const s = await stand();
  const w = await s.registered('Wit7');
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 8 * DAY, w.id);
  const player = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(w.id);
  const { witnessHall } = await import('../server-account/src/npcHalls.js');
  const racing = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (l) => { s.raw.prepare('INSERT INTO npc_hall_strikes (map_id, by, at) VALUES (99, ?, ?)').run('Devra', _now); return s.env.DB.batch(l); } };
  assert.deepEqual(await witnessHall({ db: racing, nowS: _now }, { ...player }, s.env, { hall: { key: 99, region: ANTICLERE, factions: [40] } }), { error: 'hall-struck' });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'npchall' AND key = '1:99'").get().n, 0);
  // the sheet hears a strike at once, on any isolate (its row's version moved)
  assert.deepEqual((await s.call('/v1/chapters/list', {}, s.who.secret)).body.chapters.map((c) => c.f), [41, 368]);
  const dev = await s.registered('Devra');
  await s.call('/v1/chapters/strike', { key: 77 }, dev.secret);
  assert.deepEqual((await s.call('/v1/chapters/list', {}, s.who.secret)).body.chapters, []);
});

// ── THE ECONOMY ─────────────────────────────────────────────────────

test('AUDIT CHAP3 E1: a gate of another week counts for no chapter; at the Turning a gate\'s Merit counts only in the region three of its day\'s claims agree on (mutants: the week, the agreement)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41]], [78, 17, [41]]] });
  const old = gameDayAt((_now - 8 * DAY) * 1000);
  assert.deepEqual(await creditReceipt({ db: s.env.DB, nowS: _now }, { id: s.who.id }, { CHAPTERS_OPEN: 'on' }, { character: s.R.id, kind: 'gate', id: old, region: ANTICLERE }),
    { counted: false, why: 'old-week' });
  // three claims of day d agree on Anticlere; the Merit a client named Daggerfall for counts nowhere
  const d = gameDayAt(_now * 1000);
  for (const w of s.wits) s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'dealt', ?, ?)").run(d, w.id, _now, ANTICLERE);
  const week = meritWeekOf(_now);
  s.merit(week, 41, ANTICLERE, 600, 'gate', `gate:${d}`);
  s.raw.prepare(`INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at) VALUES (?, 41, 17, ?, 'r00000000000000000000', 'gate', 600, ?, ?)`)
    .run(week, s.wits[0].id, `gate:${d}`, _now);   // another account's gate of the same day, named for Daggerfall
  s.merit(week, 41, 17, 120, 'raid');   // a raid's line stands whatever the gates say
  await settleChapterWeek(s.env.DB, week, _now);
  assert.deepEqual([s.strength(41), s.strength(41, 17)], [60, 52]);
  // with no agreement, no gate's Merit counts at all
  const t = await stand();
  const tweek = meritWeekOf(_now);
  t.merit(tweek, 41, ANTICLERE, 600, 'gate', `gate:${d}`);
  await settleChapterWeek(t.env.DB, tweek, _now);
  assert.equal(t.strength(41), 47);
});

test('AUDIT CHAP3 E3: a member\'s own writ is one a guild a UTC day, wherever posted - the first board of the day with a chapter of its guild (mutants: the region in the check, the check in the write)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41]], [78, 17, [41]]] });
  const list = async (region) => (await s.call('/v1/writs/list', { character: s.R.id, region }, s.who.secret)).body;
  assert.equal((await list(ANTICLERE)).writs.filter((w) => w.kind === 'member').length, 1);
  assert.deepEqual((await list(17)).writs.filter((w) => w.kind === 'member'), [], 'not a second in Daggerfall');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'member'").get().n, 1);
  // another board's writ landing between this read and its write: the write's own check holds
  clock(_now + DAY);
  const day = utcDay(_now);
  const player = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(s.who.id);
  const racing = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (l) => {
    if (l.length === 1) {   // the member writ's own batch - one statement, one guild
      s.raw.prepare(`INSERT OR IGNORE INTO writs (id, kind, day, region, faction, owner, slot, material, tier, qty, pay, renown, expires_at)
        VALUES (?, 'member', ?, 17, 41, ?, 0, 'p1:23', 2, 10, 20, 30, ?)`).run(`m:${day}:17:41:${s.R.id}`, day, s.R.id, (day + 1) * DAY);
    }
    return s.env.DB.batch(l);
  } };
  await listWrits({ db: racing, nowS: _now }, { ...player }, s.env, { character: s.R.id, region: ANTICLERE });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'member' AND day = ?").get(day).n, 1, 'the other board\'s writ alone');
});

// ── THE CLIENT ──────────────────────────────────────────────────────

test('AUDIT CHAP3 C2/T7: a stopped sheet forgets what it held; a read still out is the only read, however the clock jumps (mutants: the strengths kept, the busy guard)', async () => {
  let t = 0;
  let answer = { ok: true, data: { chapters: [{ f: 41, region: 21, strength: 80 }] } };
  const sheet = createChapterSheet({ door: { list: async () => answer }, nowMs: () => t });
  sheet.refresh();
  await tick(); await tick();
  assert.equal(sheet.strengthOf(41, 21), 80);
  t = SHEET_KEPT_MS;
  answer = { ok: false, error: 'chapters-closed' };
  sheet.refresh();
  await tick(); await tick();
  assert.equal(sheet.strengthOf(41, 21), null, 'the hall is DFU\'s own again');
  // T7: a read that never answers, and the wall clock jumping past the beat - no second read
  let calls = 0;
  let u = 0;
  const hung = createChapterSheet({ door: { list: () => { calls++; return new Promise(() => {}); } }, nowMs: () => u });
  hung.refresh();
  await tick();
  u += 2 * SHEET_KEPT_MS;
  assert.equal(hung.refresh(), false);
  assert.equal(calls, 1);
});

test('AUDIT CHAP3 C7/C8: a Take refused no-writ reads the list again; a member\'s own writ promises Merit only where it can earn (mutants: the reload, the promise)', async () => {
  const writ = { id: 'm:1:21:41:r0', kind: 'member', region: 21, faction: 41, material: 'p1:23', tier: 2, qty: 4, pay: 24, renown: 37, expiresAt: 9e9, state: 'open' };
  let reads = 0;
  const mk = (merit) => {
    const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
      writs: async () => { reads++; return { data: { writs: [writ], receipts: [], merit, chapters: [], today: { filled: 0, max: 3 } }, error: null, stale: false }; },
      deliver: async () => ({ ok: false, error: 'no-writ' }) };
    const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
    const host = document.createElement('div');
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book, region: 21, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n) } });
    return host;
  };
  const host = mk([{ faction: 41, merit: 0, max: 600, elsewhere: false, from: null }]);
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.equal(byClass(byClass(host, 'notice-writ')[0], 'writ-pay')[0].textContent, 'Pays 24 silver, 37 Renown, standing and Merit with the Fighters Guild');
  const before = reads;
  byClass(host, 'notice-take')[0].click();
  for (let i = 0; i < 4; i++) await tick();
  assert.ok(reads > before, 'read again');
  for (const m of [[{ faction: 41, merit: 0, max: 600, elsewhere: true, from: null }], [{ faction: 41, merit: 600, max: 600, elsewhere: false, from: null }], [{ faction: 41, merit: 0, max: 600, elsewhere: false, from: 9e9 }], []]) {
    const h = mk(m);
    await tick();
    byClass(h, 'notice-tab')[1].click();
    for (let i = 0; i < 3; i++) await tick();
    assert.equal(byClass(byClass(h, 'notice-writ')[0], 'writ-pay')[0].textContent, 'Pays 24 silver, 37 Renown and standing with the Fighters Guild', JSON.stringify(m));
  }
  // and a receipt's Merit is said with its guilds' memory
  assert.equal(hallRememberLine([41], 50), 'The Fighters Guild will remember it, 50 Merit to its chapter here.');
  assert.equal(hallRememberLine([41, 368], 100), 'The Fighters Guild and the Knights of the Dragon will remember it, 100 Merit to their chapters here.');
  assert.equal(hallRememberLine([41], 0), 'The Fighters Guild will remember it.');
});

test('AUDIT CHAP3 C3/C4/C5/C9: the hosts\' wiring - a kept gate claim waits for the scan, a raid\'s line on its fighter\'s page, a late writ said in the chat, a stale build\'s stop said (mutants: each seam)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /const GATE_SCAN_WAIT_MS = 90_000;/);
  assert.match(world, /if \(_gateScan \|\| Date\.now\(\) - _gateClaimsFrom >= GATE_SCAN_WAIT_MS\) return true;\n\s+warmGateScan\(\);\n\s+return false;/);
  assert.match(world, /sayLate: \(text\) => chatNotice\(text\),/);
  assert.match(world, /if \(error === 'roll-seed' \|\| error === 'roll-claim'\) chatNotice\(accountRefusalText\(error\)\);/);
});

// ── DAGGERFALL'S LAW ────────────────────────────────────────────────

test('AUDIT CHAP3 D2: a band that moves nothing leaves a hall\'s quality as DFU reads it, past 20 too; a move never takes a hall past 20 below its own (mutants: the identity, the bound)', () => {
  assert.deepEqual([[25, null], [25, 50], [0, 80], [18, 80], [25, 80], [25, 10], [3, 10]].map(([q, s]) => chapterShelfQuality(q, s)), [25, 25, 0, 20, 25, 21, 1]);
});

// ── THE PINS ────────────────────────────────────────────────────────

test('AUDIT CHAP3 T1: a Season\'s end through the routes - the sheet and the board settle the week with the Season counted (mutants: the zero unread at either route)', async () => {
  const week = meritWeekOf(NOON) - 1;
  let zero = null;
  for (let z = Math.max(0, week - 40); z <= week; z++) if (seasonEndingAt(week, z)) { zero = z; break; }
  assert.notEqual(zero, null);
  for (const via of ['sheet', 'board']) {
    const s = await stand({ extra: { SEASON_ZERO_WEEK: String(zero) } });
    s.raw.prepare('INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (41, 21, 90, 0, 0, 0)').run();
    s.merit(week, 41, ANTICLERE, 600);
    if (via === 'sheet') await s.call('/v1/chapters/list', {}, s.who.secret);
    else await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret);
    assert.equal(s.strength(41), 75, `${via}: 90 + 10, then halfway to 50`);
  }
});

test('AUDIT CHAP3 T2: a member\'s own writ draws over its day and its region too (mutants: the day, the region in the dice)', () => {
  const table = regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: true }], 'summer');
  const RA = 'r0123456789abcdef0123';
  const days = [20000, 20001, 20002, 20003, 20004].map((d) => JSON.stringify(memberWrit(d, ANTICLERE, 41, RA, table)));
  assert.ok(new Set(days).size > 2, 'its day in the dice');
  const regions = [17, 18, 19, 20, 21].map((g) => JSON.stringify(memberWrit(20000, g, 41, RA, regionWritTable(g, [{ climate: WOODS, confirmed: true }], 'summer'))));
  assert.ok(new Set(regions).size > 2, 'its region in the dice');
});

test('AUDIT CHAP3 T3: a character that dies between the membership read and the credit\'s write is credited nothing (mutants: the death in the head\'s write)', async () => {
  const s = await stand();
  const dying = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (l) => { s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(_now, s.R.id); return s.env.DB.batch(l); } };
  const rep0 = s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(s.R.id).rep;
  assert.deepEqual(await creditReceipt({ db: dying, nowS: _now }, { id: s.who.id }, { CHAPTERS_OPEN: 'on' }, { character: s.R.id, kind: 'raid', id: '21:9:1', region: ANTICLERE }), { counted: false, why: 'busy' });
  assert.equal(s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(s.R.id).rep, rep0);
});

test('AUDIT CHAP3 T5: a town disputed after its confirmation is on the developer\'s audit list, however many agree (mutants: the disputed arm)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41]]] });
  const more = [];
  for (let i = 0; i < 4; i++) { const w = await s.registered(`Late${i}`); s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 8 * DAY, w.id); more.push(w); }
  clock(_now + 1);
  await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [41] } }, more[0].secret);   // four agree
  for (const w of more.slice(1)) { clock(_now + 1); await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [40] } }, w.secret); }   // three dissent
  const dev = s.raw.prepare('SELECT * FROM players WHERE handle = ?').get('Wit0');
  const l = await listHalls({ db: s.env.DB, nowS: _now }, { ...dev }, s.env, { region: ANTICLERE });
  const town = l.towns.find((x) => x.key === 77);
  assert.deepEqual([town.state, town.audit], ['disputed', true]);
});

test('AUDIT CHAP3 T6: a kept record missing a faction adopts the Roll\'s number for it, never the save\'s whole standing again (mutants: the base\'s own faction asked)', () => {
  const roll = Object.fromEntries(ROLL_FACTIONS.map((f) => [f, 0]));
  roll[41] = 20;
  const current = { 41: 25 };
  const { local } = rollAdopt(current, { 40: 0 }, {}, roll);
  assert.equal(local[41], 20, 'the Roll\'s 20 - not 20 + 25');
});

test('AUDIT CHAP3 T8: the no-ground pin\'s spy sees the ground read when there is one to see', () => {
  assert.match(src('test/audit_chap2.test.js'), /assert\.ok\(ground >= 1, 'the spy sees a read of the ground when one comes'\);/);
});
