// AUDIT SILVER-WAYS (2026-10-03, Mac: "Audit this") - THE SERVICE'S FINDINGS, each pinned through the real Worker over
// node:sqlite with every migration applied (test/accountDb.mjs): A1 one account one guild an event (a gate's re-claim in
// its own second marked a second guild); A2 a deed struck by a counted claim alone; A3 the day's deeds in the guild's
// view; B1 a party's claims all paid by a contract (the tax reckoned in the batch); B2 an officer paid by another
// guild's contract; B3 a guild with a contract standing answers 409; C1 the Watch no later than the act's end; C2 a
// repeat's silver as it was; C3 the day's Motherlodes picked once. bible/06-Systems/Online-Arc.md SILVER-WAYS (the
// audit); bible/06-Systems/Professions-Arc.md 38.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';
import { MARKS_FAUCETS, utcDay } from '../src/net/marksLaw.js';
import { saleTax, saleTaxOn, MARKET_TAX_PCT } from '../src/net/marketLaw.js';
import { SKEW_S } from '../src/net/identityToken.js';
import { xpForRank, glintsMax } from '../src/net/professionLaw.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { MOTHERLODE_RANK, MOTHERLODE_TIER, MOTHERLODE_WATCH_S, MOTHERLODE_WATCH_AHEAD_S, motherlodeWatchOk } from '../src/net/motherlodeLaw.js';

const { subtle } = globalThis.crypto;
const DAY = 86400;
const DAY0 = utcDay(T0);
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `aslv-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const raidKey = (region, location, gameDay = 1000) => `${region}:${location}:${gameDay}`;

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const guildMarks = (g) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(g)?.balance ?? 0);
  const raid = async (who, key, extra2 = {}) => s.call('/v1/raid/claim', {
    receipt: await mintRaidReceipt({ w: key, s: who.id, c: 777, y: 2 }, s.gateKey, { subtle, nowS: _now }), character: who.character, name: who.handle, ...extra2,
  }, who.secret);
  const gate = async (who, gameDay, extra2 = {}) => s.call('/v1/gate/claim', {
    receipt: await mintReceipt({ d: gameDay, b: 'ruhn', s: who.id, c: 4242, x: 'dealt' }, s.gateKey, { subtle, nowS: _now }), ...extra2,
  }, who.secret);
  const lines = (kind) => raw.prepare('SELECT * FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind);
  const addsUp = () => {
    const m = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN src_kind = 'mint' THEN amount END), 0) AS m, COALESCE(SUM(CASE WHEN dst_kind = 'burn' THEN amount END), 0) AS b FROM marks_ledger`).get();
    const a = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM marks').get().s;
    const g = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks').get().s;
    const e = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount END), 0) - COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount END), 0) AS e FROM marks_ledger`).get().e;
    return Number(m.m) - Number(m.b) === Number(a) + Number(g) + Number(e);
  };
  const guild = async ({ marks = 5_000, members = ['Bran', 'Cass', 'Dain'], tenure = 8, tag = 'HND', gmName = 'Aldric', officerName = 'Mara' } = {}) => {
    const gm = await s.registered(gmName, { renown: 10 });
    s.seedMarks(gm, 100_000, `gm-${tag}`);
    const g = (await s.found(gm, { name: `The ${tag} Guild`, tag })).body.guild;
    const join = async (handle) => {
      const w = await s.registered(handle, { renown: 1 });
      await s.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret);
      await s.call('/v1/guilds/answer', { character: w.character, guild: g.id, accept: true }, w.secret);
      return w;
    };
    const officer = await join(officerName);
    const roster = async () => (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.members;
    const m = (await roster()).find((x) => x.name === officer.handle).member;
    assert.equal((await s.call('/v1/guilds/rank', { character: gm.character, member: m, rank: 1 }, gm.secret)).status, 200);
    const list = [];
    for (const h of members) list.push(await join(h));
    raw.prepare('UPDATE guild_members SET joined_at = joined_at - ? WHERE guild_id = ?').run(tenure * DAY, g.id);
    if (marks) assert.equal((await s.call('/v1/marks/guild/deposit', { character: gm.character, marks, rid: rid() }, gm.secret)).status, 200);
    return { gm, officer, members: list, g };
  };
  return { ...s, raw, balance, guildMarks, raid, gate, lines, addsUp, guild };
}

// ─── A: THE DEEDS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT SILVER-WAYS A1: one account counts for one guild an event - three accounts each with a character in two guilds, each claiming a gate and re-sending its receipt in the same second naming the other character, strike ONE deed (the guild named first), not two; the re-send answers `claimed` (mutants: the mark a guild\'s; the unique (event, account) dropped)', async () => {
  clock(T0);
  const s = await stand();
  const a = await s.guild({ marks: 0, tag: 'AAA', gmName: 'Ash', officerName: 'Ava', members: ['Abe', 'Ada', 'Amy'] });
  const b = await s.guild({ marks: 0, tag: 'BBB', gmName: 'Bea', officerName: 'Ben', members: ['Bob', 'Bud', 'Bly'] });
  // each of AAA's three keeps a second character in BBB, ten days a member
  for (const w of a.members) {
    s.raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 3, ?, ?)')
      .run(w.id, `alt-${w.handle}`, b.g.id, `${w.handle} Alt`, _now - 10 * DAY);
  }
  for (const w of a.members) {
    const first = await s.gate(w, 700, { character: w.character });
    assert.equal(first.body.recorded, true);
    const again = await s.gate(w, 700, { character: `alt-${w.handle}` });   // the same second: the gate's guard passes
    assert.deepEqual([again.body.recorded, again.body.why], [false, 'claimed']);
  }
  assert.deepEqual(s.lines('guild-deed').map((l) => l.dst_id), [a.g.id], 'one deed, the guild named first');
  assert.equal(s.guildMarks(b.g.id), 0, 'BBB earned nothing of AAA\'s gate');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_deed_marks WHERE event = ?').get('gate:700').n, 3, 'three marks, one an account');
  assert.ok(s.addsUp());
});

test('AUDIT SILVER-WAYS A2: a deed the day\'s cap held back is struck by the next COUNTED claim - a member\'s refused re-send the next day strikes nothing; the next member\'s claim strikes it and says so (mutants: the strike unguarded)', async () => {
  clock(T0);
  const s = await stand();
  const { members: [bran, cass, dain], officer, g } = await s.guild({ marks: 0 });
  // the day's four deeds already struck
  for (let i = 0; i < MARKS_FAUCETS.deed.perDay; i++) {
    s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('mint', NULL, 'guild', ?, 'guild-deed', 25, ?, ?, ?, 'Seed', ?)`).run(g.id, DAY0, _now, g.id, `deed:seed:${i}`);
  }
  const key = raidKey(DF, 31);
  for (const w of [bran, cass, dain]) assert.equal((await s.raid(w, key)).body.recorded, true);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM marks_ledger WHERE rid = ?').get(`deed:raid:${key}`).n, 0, 'held back by the day\'s four');
  clock(T0 + DAY);
  const resend = await s.raid(bran, key);
  assert.deepEqual([resend.body.recorded, resend.body.why, resend.body.deed], [false, 'claimed', undefined]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM marks_ledger WHERE rid = ?').get(`deed:raid:${key}`).n, 0, 'a refused claim strikes no deed');
  const next = await s.raid(officer, key);
  assert.deepEqual(next.body.deed, { struck: 25, guild: { name: 'The HND Guild', tag: 'HND' } }, 'the next counted claim strikes it, and says so');
  assert.ok(s.addsUp());
  clock(T0);
});

test('AUDIT SILVER-WAYS A3: the guild\'s view says the day\'s deeds against their cap, where silver is open (mutants: the deeds unread)', async () => {
  clock(T0);
  const s = await stand();
  const { gm, members: [bran, cass, dain] } = await s.guild({ marks: 0 });
  const view = async () => (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild;
  assert.deepEqual([(await view()).deeds, (await view()).deedsMax], [0, MARKS_FAUCETS.deed.perDay]);
  for (const w of [bran, cass, dain]) await s.raid(w, raidKey(DF, 40));
  assert.equal((await view()).deeds, 1);
  const shut = await stand({ MARKS_OPEN: 'off' });
  const sg = await shut.guild({ marks: 0 });
  assert.equal((await shut.call('/v1/guilds/mine', { character: sg.gm.character }, sg.gm.secret)).body.guild.deedsMax, undefined, 'silver shut: none');
});

// ─── B: THE CONTRACTS ────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT SILVER-WAYS B1: a party\'s claims, every one read before any is written (as the relay\'s receipts send them, together), are EVERY one paid by a contract - each its deed, the tax the running total\'s in the batch\'s order, the escrow drawn by each; the tax in SQL is saleTaxOn\'s for every deed of every pay (mutants: the contract as read; the tax per deed; the tax\'s percent)', async () => {
  // the law: the batch's integer reckoning is saleTaxOn's, every pay 1-50 and every deed 0-499
  for (let pay = 1; pay <= 50; pay++) {
    for (const done of [0, 1, 2, 19, 20, 21, 99, 499]) {
      assert.equal(Math.floor(((done + 1) * pay * MARKET_TAX_PCT) / 100) - Math.floor((done * pay * MARKET_TAX_PCT) / 100), saleTaxOn(done * pay, pay));
    }
  }
  clock(T0);
  const s = await stand();
  const { gm, g } = await s.guild({ marks: 5_000, tag: 'PAY', gmName: 'Payer', officerName: 'Payo', members: ['Pam'] });
  const post = await s.call('/v1/writs/contract', { character: gm.character, region: DF, kind: 'raid', pay: 30, deeds: 10, rid: rid() }, gm.secret);
  assert.equal(post.status, 200, JSON.stringify(post.body));
  const party = [await s.registered('Uno'), await s.registered('Duo'), await s.registered('Tre'), await s.registered('Qua')];
  // THE BARRIER: each claim's own batch (its raid_cleanses row first) held until all four have read
  const db = s.env.DB;
  const prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  db.prepare = (sql) => Object.assign(prepare(sql), { _sql: sql });
  let held = [];
  db.batch = async (list) => {
    if (/INTO raid_cleanses/.test(list[0]?._sql ?? '') && held !== null) {
      await new Promise((go) => { held.push(go); if (held.length === party.length) { const all = held; held = null; all.forEach((f) => f()); } });
    }
    return batch(list);
  };
  const key = raidKey(DF, 50);
  const answers = await Promise.all(party.map((w) => s.raid(w, key)));
  db.prepare = prepare; db.batch = batch;
  assert.ok(answers.every((r) => r.body.recorded === true), 'every claim counted');
  assert.ok(answers.every((r) => r.body.contracts?.length === 1), `every defender paid: ${JSON.stringify(answers.map((r) => r.body.contracts))}`);
  const pays = answers.map((r) => r.body.contracts[0]);
  assert.ok(pays.every((p) => p.pay + p.tax === 30));
  assert.equal(pays.reduce((n, p) => n + p.tax, 0), saleTax(4 * 30), 'the running total\'s tax, whatever the order');
  const row = s.raw.prepare('SELECT left_deeds, escrow FROM guild_contracts WHERE id = ?').get(post.body.contract.id);
  assert.deepEqual([row.left_deeds, row.escrow], [6, 6 * 30]);
  for (const w of party) assert.equal(s.balance(w), 30 + pays[party.indexOf(w)].pay, 'the raid\'s 30 and the deed\'s pay');
  assert.ok(g && s.addsUp());
});

test('AUDIT SILVER-WAYS B2: an Officer whose own guilds\' contracts outrank the rest in a region - an account an Officer of two guilds, ten contracts of theirs at the top - is paid by a third guild\'s there; an outsider by the best three, never a fourth (mutants: the read ignores the posters; the claim\'s three unread)', async () => {
  clock(T0);
  const s = await stand();
  const a = await s.guild({ marks: 5_000, tag: 'TOP', gmName: 'Topa', officerName: 'Topo', members: ['Tia'] });
  const m = await s.guild({ marks: 5_000, tag: 'MID', gmName: 'Mida', officerName: 'Mido', members: ['Mia'] });
  const b = await s.guild({ marks: 5_000, tag: 'LOW', gmName: 'Lowa', officerName: 'Lowo', members: ['Lia'] });
  // TOP's Officer keeps a second character, an Officer of MID's
  s.raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 1, ?, ?)').run(a.officer.id, 'alt-topo', m.g.id, 'Topo Alt', _now - 10 * DAY);
  for (const gm of [a.gm, m.gm]) {
    for (let i = 0; i < 5; i++) assert.equal((await s.call('/v1/writs/contract', { character: gm.character, region: DF, kind: 'raid', pay: 50, deeds: 5, rid: rid() }, gm.secret)).status, 200);
  }
  const low = await s.call('/v1/writs/contract', { character: b.gm.character, region: DF, kind: 'raid', pay: 40, deeds: 5, rid: rid() }, b.gm.secret);
  const r = await s.raid(a.officer, raidKey(DF, 60));
  assert.deepEqual(r.body.contracts?.map((c) => [c.contract, c.pay + c.tax]), [[low.body.contract.id, 40]], 'LOW\'s pays the Officer; TOP\'s and MID\'s never');
  // an outsider: the best three, never a fourth (CONTRACTS_PAID_MAX, the batch's own count)
  const out = await s.registered('Outa');
  const paid = await s.raid(out, raidKey(DF, 60));
  assert.deepEqual(paid.body.contracts.map((c) => c.pay + c.tax), [50, 50, 50]);
  assert.ok(s.addsUp());
});

test('AUDIT SILVER-WAYS B1: a claim reads past the contracts it may be paid by - one of the best filled by another claim between its read and its write, it is paid by the next (mutants: the read no wider than the pay)', async () => {
  clock(T0);
  const s = await stand();
  const { gm } = await s.guild({ marks: 5_000, tag: 'FIL', gmName: 'Fila', officerName: 'Filo', members: ['Fia'] });
  for (let i = 0; i < 3; i++) assert.equal((await s.call('/v1/writs/contract', { character: gm.character, region: DF, kind: 'raid', pay: 50, deeds: 1, rid: rid() }, gm.secret)).status, 200);
  const next = await s.call('/v1/writs/contract', { character: gm.character, region: DF, kind: 'raid', pay: 40, deeds: 5, rid: rid() }, gm.secret);
  const pair = [await s.registered('Xan'), await s.registered('Yve')];
  const db = s.env.DB;
  const prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  db.prepare = (sql) => Object.assign(prepare(sql), { _sql: sql });
  let held = [];
  db.batch = async (list) => {
    if (/INTO raid_cleanses/.test(list[0]?._sql ?? '') && held !== null) {
      await new Promise((go) => { held.push(go); if (held.length === pair.length) { const all = held; held = null; all.forEach((f) => f()); } });
    }
    return batch(list);
  };
  const answers = await Promise.all(pair.map((w) => s.raid(w, raidKey(DF, 70))));
  db.prepare = prepare; db.batch = batch;
  // HAUL-CARDS (FOUND - the full suite's load): which held batch the barrier lets go first is the scheduler's, so the
  // pin reads the pair by what each was paid, not by who asked first
  const paid = answers.map((r) => r.body.contracts ?? []);
  const first = paid.find((p) => p.length === 3), second = paid.find((p) => p !== first);
  assert.deepEqual(first?.map((c) => c.pay + c.tax), [50, 50, 50], `one claim the three best, each its last deed: ${JSON.stringify(paid)}`);
  assert.deepEqual(second?.map((c) => c.contract), [next.body.contract.id], 'the other the next, read past the three');
  assert.ok(s.addsUp());
});

test('AUDIT SILVER-WAYS B3: a guild with a contract standing refuses to disband with 409, as its writs\' siblings do (mutants: the status unmapped)', async () => {
  clock(T0);
  const s = await stand();
  const { gm } = await s.guild({ marks: 5_000 });
  assert.equal((await s.call('/v1/writs/contract', { character: gm.character, region: DF, kind: 'raid', pay: 10, deeds: 5, rid: rid() }, gm.secret)).status, 200);
  const gone = await s.call('/v1/guilds/disband', { character: gm.character }, gm.secret);
  assert.deepEqual([gone.status, gone.body.error], [409, 'guild-contracts']);
});

// ─── C: THE MOTHERLODES ──────────────────────────────────────────────────────────────────────────────────────────────

async function lodeRig(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const witnesses = [await s.registered('Wita'), await s.registered('Witb'), await s.registered('Witc')];
  const confirm = (n, day = DAY0) => {
    for (let i = 0; i < n; i++) {
      for (const w of witnesses) {
        raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)')
          .run('pixel', `${200 + i},${80}`, w.id, `${CLIMATES.Mountain},21`, 21, day * DAY - 3600);
      }
    }
  };
  const miner = async (handle) => {
    const w = await s.registered(handle);
    raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'mining', ?, ?)`).run(w.id, w.character, xpForRank(MOTHERLODE_RANK), _now);
    return w;
  };
  const read = (who) => s.call('/v1/prof/motherlodes', { character: who.character }, who.secret);
  const watch = (who, lode, nowS) => mintWatchReceipt({ s: who.id, x: lode.x, y: lode.y, c: 4242 }, s.gateKey, { subtle, nowS });
  const strike = async (who, lode, { at = _now - 2, watchAt = at, ...extra2 } = {}) => s.call('/v1/prof/harvest', {
    character: who.character, node: lode.key, kind: 'ore', act: { glints: glintsMax(MOTHERLODE_TIER), clean: true }, at, rid: rid(),
    watch: await watch(who, lode, watchAt), ...extra2,
  }, who.secret);
  return { ...s, raw, confirm, miner, read, strike };
}

test('AUDIT SILVER-WAYS C1: a strike\'s Watch receipt stands from ten minutes before the act\'s end to the clocks\' skew after it, never later - a strike told as ended inside the two hours, sent after them, with a receipt the relay issued after the Motherlode had gone is refused (mutants: no ceiling; the skew unread)', async () => {
  assert.equal(MOTHERLODE_WATCH_AHEAD_S, SKEW_S, 'the receipts\' own skew');
  assert.deepEqual([motherlodeWatchOk(1000 - MOTHERLODE_WATCH_S, 1000), motherlodeWatchOk(1000 + SKEW_S, 1000), motherlodeWatchOk(1001 + SKEW_S, 1000), motherlodeWatchOk(999 - MOTHERLODE_WATCH_S, 1000), motherlodeWatchOk(undefined, 1000)],
    [true, true, false, false, false]);
  clock(DAY0 * DAY + 60);
  const s = await lodeRig();
  s.confirm(4);
  const ann = await s.miner('Ann'), bea = await s.miner('Bea');
  const [l0] = (await s.read(ann)).body.lodes;
  // late: the act told as ending a second before the close, sent nine minutes after it, a receipt from after it
  clock(l0.closesAt + 540);
  const late = await s.strike(ann, l0, { at: l0.closesAt - 1, watchAt: _now });
  assert.equal(late.body.error, 'motherlode-watch', JSON.stringify(late.body));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM motherlode_strikes').get().n, 0);
  // inside the hours: the skew's thirty seconds stand, thirty-one do not
  clock(l0.opensAt + 900);
  assert.equal((await s.strike(bea, l0, { at: _now - 60, watchAt: _now - 60 + SKEW_S + 1 })).body.error, 'motherlode-watch');
  assert.equal((await s.strike(bea, l0, { at: _now - 60, watchAt: _now - 60 + SKEW_S })).status, 200);
});

test('AUDIT SILVER-WAYS C2: a strike made while silver was shut, asked again once it is open, says no silver - never a full purse; a purse truly full still says so (mutants: `full` for any strike without a line)', async () => {
  clock(DAY0 * DAY + 60);
  const s = await lodeRig({ MARKS_OPEN: 'off' });
  s.confirm(4);
  const ann = await s.miner('Ann');
  const [l0] = (await s.read(ann)).body.lodes;
  clock(l0.opensAt + 120);
  const id = rid();
  const hit = await s.strike(ann, l0, { rid: id });
  assert.equal(hit.status, 200);
  assert.equal(hit.body.marks, undefined);
  s.env.MARKS_OPEN = 'on';
  const again = await s.strike(ann, l0, { rid: id });
  assert.deepEqual([again.body.repeat, again.body.marks], [true, undefined], 'no silver said, and no full purse');
  // a purse at the most: `full`
  const full = await lodeRig();
  full.confirm(4);
  const bea = await full.miner('Bea');
  full.seedMarks(bea, 10_000_000 - 5, 'full-bea');
  const [m0] = (await full.read(bea)).body.lodes;
  clock(m0.opensAt + 120);
  const f = await full.strike(bea, m0);
  assert.deepEqual([f.status, f.body.marks?.struck, f.body.marks?.why], [200, 0, 'full']);
});

test('AUDIT SILVER-WAYS C3: the day\'s Motherlodes are picked once - a realm with no ground keeps its day\'s mark of none, and ground stamped before the day afterwards changes nothing that day; picks are written only under the mark their own read made (mutants: no mark kept; the picks unguarded by the mark)', async () => {
  clock(DAY0 * DAY + 60);
  const s = await lodeRig();
  const ann = await s.miner('Ann');
  assert.deepEqual((await s.read(ann)).body.lodes, []);
  assert.deepEqual({ ...s.raw.prepare('SELECT day, picked FROM motherlode_days').get() }, { day: DAY0, picked: 0 }, 'the day picked: none');
  s.confirm(6);
  const db0 = s.env.DB, prepare0 = db0.prepare.bind(db0);
  let scans = 0;
  db0.prepare = (sql) => { if (/FROM world_witness/.test(sql)) scans++; return prepare0(sql); };
  assert.deepEqual((await s.read(ann)).body.lodes, [], 'read once a day');
  db0.prepare = prepare0;
  assert.equal(scans, 0, 'the ground not read again');
  // the next day reads the ground
  clock((DAY0 + 1) * DAY + 60);
  assert.equal((await s.read(ann)).body.lodes.length, 3);
  // two first reads racing the turn: another read's mark lands between this read's look and its batch - this read
  // writes no picks under it (that read's are its own to write)
  clock((DAY0 + 2) * DAY + 60);
  const db = s.env.DB;
  const prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  db.prepare = (sql) => Object.assign(prepare(sql), { _sql: sql });
  db.batch = async (list) => {
    if (/INTO motherlode_days/.test(list[0]?._sql ?? '')) s.raw.prepare("INSERT INTO motherlode_days (day, picked, n) VALUES (?, 3, 'another-read')").run(DAY0 + 2);
    return batch(list);
  };
  const raced = await s.read(ann);
  db.prepare = prepare; db.batch = batch;
  assert.deepEqual(raced.body.lodes, []);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM motherlodes WHERE day = ?').get(DAY0 + 2).n, 0, 'none written under another\'s mark');
  clock(T0);
});
