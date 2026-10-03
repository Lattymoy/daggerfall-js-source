// AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue") - MARKS1's findings, each
// pinned against the real Worker over node:sqlite (test/accountDb.mjs) or the client's own book, and each failing on
// the code before the fix. bible/06-Systems/Online-Arc.md (AUDIT 28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountMarks, SESSION_KEY, ACCOUNT_ACT_WAIT_MS } from '../src/net/accountClient.js';
import { createMarksBook, MARKS_TEXT, MARKS_PENDING_KEY, MARKS_FINAL } from '../src/net/marksBook.js';
import { MARKS_RID_RE, utcDay } from '../src/net/marksLaw.js';
import { gateStrikeRid, gateStrikeStatement } from '../server-account/src/marks.js';
import { createBankAccounts, marksSaleCredit } from '../src/systems/banking.js';
import { GUILD_FOUND_RENOWN } from '../src/net/guildLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86400;
let _rid = 0;
const rid = () => `aud-${String(++_rid).padStart(6, '0')}`;
const jsonStore = () => { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => (v == null ? m.delete(k) : m.set(k, v)), _m: m }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const ledgerAddsUp = (raw) => {
  const minted = raw.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE src_kind = 'mint'").get().s;
  const burnt = raw.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE dst_kind = 'burn'").get().s;
  const held = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM marks').get().s + raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks').get().s;
  return minted - burnt === held;
};
/** A kept sale: the sale made on the service, its answer never home - and the book that kept it, whose line comes
 *  back when `light()` is called. */
async function keptSale(svc, who, store, character, marks, where) {
  const real = accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  let dark = true;
  const door = { ...real, exchange: async (m, r) => { const x = await real.exchange(m, r); return dark ? { ok: false, error: 'offline' } : x; } };
  const book = createMarksBook({ door, store, character: () => character });
  assert.equal((await book.sell(marks, () => assert.fail('never paid unanswered'), where)).text, MARKS_TEXT.kept);
  return Object.assign(real, { book, light: () => { dark = false; } });
}

test('AUDIT 28 M1: two settles in flight pay a kept sale ONCE - the book asks one thing at a time', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 1000);
  const store = jsonStore();
  const real = await keptSale(svc, a, store, 'char-anna', 300, 5);
  let release;
  const gateOpen = new Promise((r) => { release = r; });
  const slow = { ...real, exchange: async (m, r) => { await gateOpen; return real.exchange(m, r); } };
  const book = createMarksBook({ door: slow, store, character: () => 'char-anna' });
  const paid = [];
  const credit = (gold, region) => paid.push([gold, region]);
  const first = book.settle(credit);
  const second = book.settle(credit);   // the bank closed and opened again while the first is slow
  release();
  assert.deepEqual([await first, await second], [MARKS_TEXT.settled(300, 2400), null]);
  assert.deepEqual(paid, [[2400, 5]], 'one burn, one payment');
});

test('AUDIT 28 M1: a store that reads empty is another tab\'s settle, not a lost write - the book does not pay again from memory', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 1000);
  const store = jsonStore();
  const kept = await keptSale(svc, a, store, 'char-anna', 100, 3);
  store._m.delete(MARKS_PENDING_KEY);   // tab B settled it and let it go
  kept.light();
  assert.equal(await kept.book.settle(() => assert.fail('paid twice')), null, 'the tab that kept it reads the store, not its memory');
});

test('AUDIT 28 M2: a kept sale is asked again only under the account that made it, and kept through any answer that says nothing of its line', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  const b = await svc.registered('Bran');
  svc.seedMarks(a, 1000); svc.seedMarks(b, 1000);
  const store = jsonStore();
  await keptSale(svc, a, store, 'char-anna', 50, 7);
  // signed out: `no-session` says nothing of the line - the sale waits
  const out = createMarksBook({ door: accountMarks({ fetch: svc.fetch, storage: { getItem: () => null } }), store, character: () => 'char-anna' });
  assert.equal(await out.settle(() => assert.fail('no session pays nothing')), null);
  assert.ok(store._m.has(MARKS_PENDING_KEY), 'kept through no-session');
  // A's session refused (a password changed elsewhere): `auth` says nothing of the line either
  const revoked = createMarksBook({ door: accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, { ...a, secret: 'a-secret-the-service-forgot' }) }), store, character: () => 'char-anna' });
  assert.equal(await revoked.settle(() => assert.fail('a refused session pays nothing')), null);
  assert.ok(store._m.has(MARKS_PENDING_KEY), 'kept through auth');
  // another account on this device: its session would make a FRESH sale from its own balance - never asked there
  const asB = createMarksBook({ door: accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, b) }), store, character: () => 'char-anna' });
  assert.equal(await asB.settle(() => assert.fail('B pays nothing of A\'s')), null);
  assert.equal(svc.env.DB._raw.prepare('SELECT balance FROM marks WHERE account = ?').get(b.id).balance, 1000, 'nothing of B\'s burnt');
  // the switch shut after the sale: the service still answers the line it finds - a sale made is a sale answered
  svc.env.MARKS_OPEN = 'off';
  const paid = [];
  const asA = createMarksBook({ door: accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, a) }), store, character: () => 'char-anna' });
  assert.equal(await asA.settle((gold, region) => paid.push([gold, region])), MARKS_TEXT.settled(50, 400));
  assert.deepEqual(paid, [[400, 7]]);
  assert.equal(store._m.has(MARKS_PENDING_KEY), false);
  assert.deepEqual(MARKS_FINAL, ['bad-marks', 'marks-short', 'marks-bank-cap', 'marks-rate', 'marks-rid', 'marks-closed'], 'the refusals that let a sale go - each given after the line was looked for');
  const x = src('server-account/src/marks.js');
  assert.ok(x.indexOf('const prior = await lineOf(db, player.id, rid);\n  if (prior) return repeat(prior);') < x.indexOf('const closed = shut(player, env);'), 'the exchange looks for the line before the switch');
});

test('AUDIT 28 M3: a lone guildmaster\'s Leave takes no Marks with the guild - they go to the guildmaster, and the ledger still adds up', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const g = await svc.registered('Gild', { renown: GUILD_FOUND_RENOWN });
  svc.seedMarks(g, 500);
  const { guild } = (await svc.found(g, { name: 'Lone Lanterns', tag: 'LNL' })).body;
  assert.equal((await svc.call('/v1/marks/guild/deposit', { character: g.character, marks: 400, rid: rid() }, g.secret)).status, 200);
  const r = await svc.call('/v1/guilds/leave', { character: g.character }, g.secret);
  assert.equal(r.status, 200);
  assert.equal(r.body.disbanded, true);
  const raw = svc.env.DB._raw;
  assert.equal(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(g.id).balance, 500, 'every Mark back where it can be spent');
  assert.equal(raw.prepare("SELECT amount FROM marks_ledger WHERE rid = ?").get(`disband:${guild.id}`).amount, 400);
  assert.ok(ledgerAddsUp(raw), 'minted - burnt = held');
});

test('AUDIT 28 M3: a guild whose Marks would pass its guildmaster\'s cap does not go - it says so, and nothing moves', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const g = await svc.registered('Gild', { renown: GUILD_FOUND_RENOWN });
  svc.seedMarks(g, 500);
  await svc.found(g, { name: 'Full Hands', tag: 'FHD' });
  await svc.call('/v1/marks/guild/deposit', { character: g.character, marks: 400, rid: rid() }, g.secret);
  svc.seedMarks(g, 10_000_000 - 100, 'fill');
  assert.deepEqual(await svc.call('/v1/guilds/disband', { character: g.character }, g.secret), { status: 409, body: { error: 'marks-full' } });
  assert.equal(svc.env.DB._raw.prepare('SELECT balance FROM guild_marks').get().balance, 400, 'the treasury holds them still');
});

test('AUDIT 28 M3: a disband refused for the gold still in its treasury moves no Marks - the sweep goes only with the guild', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'off' });
  const g = await svc.registered('Gild', { renown: GUILD_FOUND_RENOWN });
  const { guild } = (await svc.found(g, { name: 'Gold Kept', tag: 'GKP' })).body;
  const raw = svc.env.DB._raw;
  assert.equal((await svc.call('/v1/guilds/deposit', { character: g.character, gold: 50, realm: g.at() }, g.secret)).status, 200, 'gold in the treasury');   // MERGE 2: paid on the realm character's record (REALM P2.2a)
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', 90, 1, 1, ?, NULL, 'seed-guild')`).run(guild.id, g.id);
  assert.deepEqual(await svc.call('/v1/guilds/disband', { character: g.character }, g.secret), { status: 409, body: { error: 'guild-treasury' } });
  assert.equal(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(guild.id).balance, 90, 'the Marks stay with the guild that stays');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM marks WHERE account = ?').get(g.id).n, 0, 'and none reached the guildmaster behind a shut switch');
});

test('AUDIT 28 M4: the gate\'s row and its Marks are one transaction - a strike that fails takes the row with it, and the retry strikes', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  const raw = svc.env.DB._raw;
  raw.exec("CREATE TRIGGER boom BEFORE INSERT ON marks_ledger WHEN NEW.kind = 'gate' BEGIN SELECT RAISE(ABORT, 'the strike fails'); END");
  const first = await svc.claim(a, 700, T0);
  assert.equal(first.status, 500, 'the claim fails whole');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM gate_kills').get().n, 0, 'no row kept without its Marks');
  raw.exec('DROP TRIGGER boom');
  const again = await svc.claim(a, 700, T0);
  assert.equal(again.body.recorded, true);
  assert.deepEqual(again.body.marks, { struck: 50, balance: 50, combat: { earned: 50, max: 150 } }, 'the retry strikes');   // PIN MOVED (SILVER-WAYS): the day's combat silver beside it
  assert.deepEqual((await svc.claim(a, 700, T0)).body.marks, undefined, 'and a third is the claimed row, striking nothing');
  assert.equal(gateStrikeStatement({ db: svc.env.DB, nowS: T0 }, { id: a.id, handle: null }, svc.env, 701), null, 'a guest has no statement to batch');
});

test('AUDIT 28 M5: the guild view shows Marks only where they are the viewer\'s, and a switch the guildmaster cannot pass locks nothing', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra' });
  const g = await svc.registered('Gild', { renown: GUILD_FOUND_RENOWN });
  const d = await svc.registered('Devra');
  const { guild } = (await svc.found(g, { name: 'Open Hands', tag: 'OPH' })).body;
  await svc.call('/v1/guilds/invite', { character: g.character, handle: 'devra' }, g.secret);
  await svc.call('/v1/guilds/answer', { character: d.character, guild: guild.id, accept: true }, d.secret);
  svc.seedMarks(d, 300);
  await svc.call('/v1/marks/guild/deposit', { character: d.character, marks: 200, rid: rid() }, d.secret);
  svc.env.MARKS_OPEN = 'dev';
  const seen = (who) => svc.call('/v1/guilds/mine', { character: who.character }, who.secret).then((r) => r.body.guild);
  const mine = await seen(g);
  assert.equal('marks' in mine || 'marksLedger' in mine, false, 'at dev a guildmaster who is no developer sees no Marks, nor who put them in');
  assert.equal((await seen(d)).marks, 200, 'the developer does');
  svc.env.MARKS_OPEN = 'off';
  const members = (await seen(g)).members;
  await svc.call('/v1/guilds/remove', { character: g.character, member: members.find((m) => m.name === 'Devra').member }, g.secret);
  assert.equal((await svc.call('/v1/guilds/disband', { character: g.character }, g.secret)).status, 200, 'off, the guild still goes');
  assert.equal(svc.env.DB._raw.prepare('SELECT balance FROM marks WHERE account = ?').get(g.id).balance, 200, 'its Marks kept, the guildmaster\'s');
});

test('AUDIT 28 M6: a Marks request that hangs is given up as offline - the counting box never waits for ever', async () => {
  assert.equal(ACCOUNT_ACT_WAIT_MS, 15_000);
  const hung = (url, init) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  const door = accountMarks({ fetch: hung, storage: sessionStorageOf(SESSION_KEY, { secret: 'sek', id: 'acct-1' }), waitMs: 20 });
  const alive = setTimeout(() => {}, 5000);   // AbortSignal.timeout's timer does not hold node's loop open; a page's does not need it
  try { assert.deepEqual(await door.exchange(5, 'aud-000999'), { ok: false, error: 'offline' }); } finally { clearTimeout(alive); }
});

test('AUDIT 28 M7: a sale kept for one character shuts no other character\'s Bank', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 1000);
  const store = jsonStore();
  const real = await keptSale(svc, a, store, 'char-one', 50, 2);
  const other = createMarksBook({ door: real, store, character: () => 'char-two' });
  assert.equal(other.pending, false);
  const paid = [];
  assert.equal((await other.sell(10, (g, r) => paid.push([g, r]), 4)).gold, 80);
  assert.deepEqual(paid, [[80, 4]]);
  const one = createMarksBook({ door: real, store, character: () => 'char-one' });
  assert.equal(one.pending, true, 'char-one\'s sale still waits for char-one');
});

test('AUDIT 28 M8: a guild move pressed again after its answer was lost is the same move, never a second', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const g = await svc.registered('Gild', { renown: GUILD_FOUND_RENOWN });
  svc.seedMarks(g, 500);
  await svc.found(g, { name: 'Twice Shy', tag: 'TWS' });
  const real = accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, g) });
  let lose = true;
  const lossy = { ...real, guildDeposit: async (c, m, r) => { const x = await real.guildDeposit(c, m, r); return lose ? { ok: false, error: 'offline' } : x; } };
  const book = createMarksBook({ door: lossy, store: jsonStore(), character: () => g.character });
  assert.equal((await book.moveGuild(g.character, 100)).ok, false, 'three answers lost');
  lose = false;
  const again = await book.moveGuild(g.character, 100);
  assert.equal(again.ok, true);
  assert.equal(again.guildMarks, 100, 'moved once');
  assert.equal(svc.env.DB._raw.prepare('SELECT balance FROM marks WHERE account = ?').get(g.id).balance, 400);
});

test('AUDIT 28 M9: "Sold today" moves with the sale', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 1000);
  const book = createMarksBook({ door: accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, a) }), store: jsonStore(), character: () => 'c' });
  await book.refresh();
  assert.equal(book.state.today.exchanged, 0);
  await book.sell(120, () => {}, 1);
  assert.equal(book.state.today.exchanged, 120);
});

test('AUDIT 28 M10: the weekly report counts the ACCOUNTS at a cap, once each, with the account-days beside them', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra' });
  const d = await svc.registered('Devra');
  const a = await svc.registered('Anna');
  // PIN MOVED (SILVER-WAYS): the cap is the day's combat silver - three gates (150) - where it was the gate's own two
  await svc.claim(a, 700, now); await svc.claim(a, 701, now); await svc.claim(a, 704, now);
  now = T0 + DAY;
  await svc.claim(a, 702, now); await svc.claim(a, 703, now); await svc.claim(a, 705, now);
  const r = (await svc.call('/v1/marks/report', {}, d.secret)).body;
  assert.deepEqual([r.capped, r.cappedDays], [{ combat: 1, bank: 0 }, { combat: 2, bank: 0 }]);
});

test('AUDIT 28 M11: the service\'s own line ids carry a `:` no client id can - a client cannot take a gate\'s line', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  assert.equal(gateStrikeRid(900), 'gate:900');
  assert.equal(MARKS_RID_RE.test(gateStrikeRid(900)), false);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 100);
  assert.deepEqual(await svc.call('/v1/marks/exchange', { marks: 1, rid: 'gate:900' }, a.secret), { status: 400, body: { error: 'marks-rid' } });
  await svc.call('/v1/marks/exchange', { marks: 1, rid: 'gate-day-900' }, a.secret);   // MARKS1's spelling, now any client's
  assert.deepEqual((await svc.claim(a, 900, T0)).body.marks, { struck: 50, balance: 149, combat: { earned: 50, max: 150 } }, 'the gate still strikes');   // PIN MOVED (SILVER-WAYS): the day's combat silver beside it
  assert.equal(utcDay(T0), Math.floor(T0 / DAY));
});

test('AUDIT 28 M12: a kept sale made at one bank settles into THAT region at any other; a fresh sale into this one', () => {
  const accounts = createBankAccounts(62);
  const credit = marksSaleCredit(() => accounts, () => 9);
  credit(240, 5);
  credit(80);
  assert.deepEqual([accounts[5].accountGold, accounts[9].accountGold], [240, 80]);
});

test('AUDIT 28 H8: the Bank\'s face asks `pending` every frame - the store is read at most once a second for it', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 1000);
  const inner = jsonStore();
  let reads = 0;
  const store = { get: (k) => { reads++; return inner.get(k); }, set: inner.set };
  const kept = await keptSale(svc, a, store, 'char-anna', 10, 1);
  reads = 0;
  for (let i = 0; i < 60; i++) assert.equal(kept.book.pending, true);
  assert.ok(reads <= 1, `the store read ${reads} times for sixty frames`);
});

test('AUDIT 28 M2: a sale\'s answer clears the kept sale of the character that made it, whoever plays when it comes', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const a = await svc.registered('Anna');
  svc.seedMarks(a, 5);
  const store = jsonStore();
  let playing = 'char-one';
  let release;
  const gateOpen = new Promise((r) => { release = r; });
  const real = accountMarks({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, a) });
  const slow = { ...real, exchange: async (m, r) => { await gateOpen; return real.exchange(m, r); } };
  const book = createMarksBook({ door: slow, store, character: () => playing });
  const selling = book.sell(50, () => assert.fail('never paid: 5 held'), 3);   // refused: marks-short
  await tick();
  playing = 'char-two';   // the player switched character while the Bank counted
  release();
  await selling;
  assert.deepEqual(Object.keys(store._m.get(MARKS_PENDING_KEY) ?? {}), [], 'char-one\'s refused sale let go, under char-one');
});
