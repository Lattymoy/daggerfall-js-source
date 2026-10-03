// SILVER-WAYS (2026-10-03, Mac: "With the introduction of guilds. I want to talk about how we can make silver obtainable
// and balanced outside of crafting"; then "Do it"): SILVER OUTSIDE THE CRAFTS, AS THE SERVICE KEEPS IT - a town defended
// strikes 30 silver; the gates and the raids share one combat cap of 150 a UTC day, the day's last strike what it has
// left; three of a guild's accounts on one raid or gate strike its treasury a deed of 25, four a guild a day, members of
// seven days alone; a guild's contract pays each defender of a raid in its region from its escrowed treasury, less the
// tax, never its own posters. Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 10.5; bible/06-Systems/Online-Arc.md SILVER-WAYS.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { MARKS_FAUCETS, MARKS_COMBAT, MARKS_KINDS, combatStrike, utcDay } from '../src/net/marksLaw.js';
import { saleTaxOn } from '../src/net/marketLaw.js';
import {
  CONTRACT_KINDS, CONTRACT_S, GUILD_CONTRACTS_MAX, CONTRACT_PAY_MAX, CONTRACT_DEEDS_MAX, CONTRACTS_PAID_MAX,
  contractPayOk, contractDeedsOk, contractRegionOfRaid, contractPaidMay,
} from '../src/net/writLaw.js';

const { subtle } = globalThis.crypto;
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `slv-${String(++_rid).padStart(6, '0')}`;
const DAY = 86400;
const DF = 17, WR = 23;
/** A raid's key in `region` - `region:location:day` (the game day the key names; RAID_CLAIMS_DAY_MAX counts by it). */
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
  const escrowLedger = () => {
    const r = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount END), 0) AS i, COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount END), 0) AS o
      FROM marks_ledger`).get();
    return Number(r.i) - Number(r.o);
  };
  /** Minted less burnt is every balance, every guild's treasury and every escrow (MARKS1's ledger law). */
  const addsUp = () => {
    const m = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN src_kind = 'mint' THEN amount END), 0) AS m, COALESCE(SUM(CASE WHEN dst_kind = 'burn' THEN amount END), 0) AS b FROM marks_ledger`).get();
    const a = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM marks').get().s;
    const g = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks').get().s;
    return Number(m.m) - Number(m.b) === Number(a) + Number(g) + escrowLedger();
  };
  /** A guild - Aldric its Guildmaster, Mara an Officer, and `members` Members - its treasury `marks`; everyone's
   *  membership `tenure` days old (the deed asks seven). */
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
  return { ...s, raw, balance, guildMarks, raid, gate, lines, escrowLedger, addsUp, guild };
}

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SILVER-WAYS the law: a gate 50 and a raid 30 under one combat cap of 150 a UTC day, the day\'s last strike what it has left; a deed 25 for three accounts of seven days, four a guild a day; a Motherlode 10, one a day; the new kinds named, three mints and three moves (mutants: the cap; the last strike\'s remainder; a kind\'s way)', () => {
  assert.deepEqual(MARKS_FAUCETS.gate, { amount: 50 });
  assert.deepEqual(MARKS_FAUCETS.raid, { amount: 30 });
  assert.deepEqual(MARKS_FAUCETS.deed, { amount: 25, perDay: 4, members: 3, tenureS: 7 * DAY });
  assert.deepEqual(MARKS_FAUCETS.motherlode, { amount: 10, perDay: 1 });
  assert.deepEqual(MARKS_COMBAT, { kinds: ['gate', 'raid'], perDay: 150 });
  assert.deepEqual([combatStrike(50, 0), combatStrike(30, 100), combatStrike(30, 130), combatStrike(50, 140), combatStrike(30, 150), combatStrike(30, 170), combatStrike(30, -5)],
    [50, 30, 20, 10, 0, 0, 30]);
  assert.deepEqual(['raid', 'guild-deed', 'motherlode', 'contract-escrow', 'contract-pay', 'contract-return'].map((k) => MARKS_KINDS[k]),
    ['mint', 'mint', 'mint', 'move', 'move', 'move']);
});

test('SILVER-WAYS the contracts\' law: raids alone, seven days, five a guild, 1-50 silver a defender, 1-500 defenders, three contracts a claim; the region is the raid key\'s own; a guild\'s posters are never paid by its contracts (mutants: the pay\'s bound; the deeds\' bound; the region\'s segment; the posters paid)', () => {
  assert.deepEqual([CONTRACT_KINDS, CONTRACT_S, GUILD_CONTRACTS_MAX, CONTRACT_PAY_MAX, CONTRACT_DEEDS_MAX, CONTRACTS_PAID_MAX], [['raid'], 7 * DAY, 5, 50, 500, 3]);
  assert.deepEqual([0, 1, 50, 51, 1.5, '5'].map(contractPayOk), [false, true, true, false, false, false]);
  assert.deepEqual([0, 1, 500, 501].map(contractDeedsOk), [false, true, true, false]);
  assert.deepEqual([contractRegionOfRaid('17:203:1234'), contractRegionOfRaid('0:1:2'), contractRegionOfRaid('07:1:2'), contractRegionOfRaid(null)], [17, 0, null, null]);
  assert.deepEqual([0, 1, 2, 3, null].map(contractPaidMay), [false, false, true, true, true]);
});

// ─── A TOWN DEFENDED, AND THE DAY'S COMBAT CAP ───────────────────────────────────────────────────────────────────────

test('SILVER-WAYS DONE WHEN: a raid counted strikes 30 silver, said in its answer; two gates and two raids reach 150 - the second raid 20, what the day had left; a third gate strikes nothing, `cap`; the next UTC day strikes afresh; a raid claimed twice strikes once (mutants: the raid unstruck; the cap counting the gate alone; the remainder refused; the day unkeyed)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna');
  const r1 = await s.raid(ann, raidKey(DF, 1));
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.recorded, true);
  assert.deepEqual(r1.body.marks, { struck: 30, balance: 30, combat: { earned: 30, max: 150 } });
  assert.equal((await s.gate(ann, 500)).body.marks.struck, 50);
  assert.equal((await s.gate(ann, 501)).body.marks.struck, 50);
  const r2 = await s.raid(ann, raidKey(DF, 2));
  assert.deepEqual(r2.body.marks, { struck: 20, balance: 150, combat: { earned: 150, max: 150 } }, 'the day\'s last strike: what the cap had left');
  const g3 = await s.gate(ann, 502);
  assert.equal(g3.body.recorded, true, 'the gate is counted all the same');
  assert.deepEqual(g3.body.marks, { struck: 0, balance: 150, combat: { earned: 150, max: 150 }, why: 'cap' });
  const r3 = await s.raid(ann, raidKey(DF, 3));
  assert.deepEqual([r3.body.recorded, r3.body.marks.struck, r3.body.marks.why], [true, 0, 'cap']);
  // claimed twice: counted once, struck once
  const again = await s.raid(ann, raidKey(DF, 1));
  assert.deepEqual([again.body.recorded, again.body.why, again.body.marks], [false, 'claimed', undefined]);
  assert.deepEqual(s.lines('raid').map((l) => [l.amount, l.rid, l.day]), [[30, `raid:${raidKey(DF, 1)}`, utcDay(T0)], [20, `raid:${raidKey(DF, 2)}`, utcDay(T0)]]);
  // the card's line
  const card = await s.call('/v1/marks/balance', {}, ann.secret);
  assert.deepEqual([card.body.today.combat, card.body.today.combatMax, card.body.today.gate], [150, 150, 2], 'two gates struck - the third counted, struck nothing');
  // the next UTC day: afresh
  clock(T0 + DAY);
  assert.equal((await s.raid(ann, raidKey(DF, 4, 1012))).body.marks.struck, 30);
  assert.equal(s.balance(ann), 180);
  assert.ok(s.addsUp());
  clock(T0);
});

test('SILVER-WAYS: a raid strikes nothing for a guest, nor while silver is shut (the raid counted all the same); at `dev` the developers alone; a full purse is `full` (mutants: the guest struck; the switch unread)', async () => {
  clock(T0);
  const shut = await stand({ MARKS_OPEN: 'off' });
  const a = await shut.registered('Anna');
  const r = await shut.raid(a, raidKey(DF, 1));
  assert.deepEqual([r.body.recorded, 'marks' in r.body], [true, false]);
  assert.equal(shut.lines('raid').length, 0);
  const dev = await stand({ MARKS_OPEN: 'dev' });
  const [mac, bors] = [await dev.registered('Mac'), await dev.registered('Bors')];
  assert.equal((await dev.raid(mac, raidKey(DF, 1))).body.marks.struck, 30);
  assert.equal('marks' in (await dev.raid(bors, raidKey(DF, 1))).body, false);
  const full = await stand();
  const f = await full.registered('Fen');
  full.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?)').run(f.id, 10_000_000);
  const fr = await full.raid(f, raidKey(DF, 1));
  assert.deepEqual([fr.body.recorded, fr.body.marks.struck, fr.body.marks.why], [true, 0, 'full']);
});

// ─── GUILD DEEDS ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('SILVER-WAYS guild deeds: the third of a guild\'s accounts to claim one raid strikes its treasury 25, said in that claim\'s answer; a fourth strikes no second; a member of under seven days counts for nothing; two guilds\' deeds on one raid are each their own (mutants: two members a deed; the tenure unread; a deed twice; the deed into an account)', async () => {
  clock(T0);
  const s = await stand();
  const { members: [bran, cass, dain], officer, g } = await s.guild({ marks: 0 });
  const key = raidKey(DF, 9);
  const before = s.guildMarks(g.id);
  assert.equal((await s.raid(bran, key)).body.deed, null);
  assert.equal((await s.raid(cass, key)).body.deed, null, 'two is no deed');
  const third = await s.raid(dain, key);
  assert.deepEqual(third.body.deed, { struck: 25, guild: { name: 'The HND Guild', tag: 'HND' } });
  assert.equal(s.guildMarks(g.id), before + 25);
  assert.equal((await s.raid(officer, key)).body.deed, null, 'one deed an event');
  assert.deepEqual(s.lines('guild-deed').map((l) => [l.src_kind, l.dst_kind, l.dst_id, l.amount, l.actor, l.rid]),
    [['mint', 'guild', g.id, 25, g.id, `deed:raid:${key}`]]);
  // a new member counts for nothing until its seventh day
  const fresh = await stand();
  const f = await fresh.guild({ marks: 0, tenure: 6 });
  for (const m of f.members) await fresh.raid(m, key);
  assert.equal(fresh.lines('guild-deed').length, 0, 'six days is not seven');
  // two guilds on one raid: each its own deed
  const two = await stand();
  const a = await two.guild({ marks: 0, tag: 'AAA', gmName: 'Ash', officerName: 'Ava', members: ['Abe', 'Ada', 'Amy'] });
  const b = await two.guild({ marks: 0, tag: 'BBB', gmName: 'Bea', officerName: 'Ben', members: ['Bob', 'Bud', 'Bly'] });
  for (const m of [...a.members, ...b.members]) await two.raid(m, key);
  assert.deepEqual(two.lines('guild-deed').map((l) => l.dst_id).sort(), [a.g.id, b.g.id].sort());
  assert.ok(s.addsUp() && two.addsUp());
});

test('SILVER-WAYS guild deeds by gate: three of a guild\'s accounts claiming one gate day with their characters strike it; a claim that names no character counts for none; at most four deeds a guild a UTC day, the fifth struck by a claim the next day (mutants: the day\'s cap; the gate unguarded)', async () => {
  clock(T0);
  const s = await stand();
  const { members, officer, gm, g } = await s.guild({ marks: 0, members: ['Bran', 'Cass', 'Dain', 'Eda'] });
  const [bran, cass, dain, eda] = members;
  const anon = await s.gate(bran, 700);
  assert.equal(anon.body.deed, undefined, 'a claim naming no character tries no deed');
  await s.gate(cass, 700, { character: cass.character });
  assert.equal((await s.gate(dain, 700, { character: dain.character })).body.deed, null, 'Bran named none: two marks');
  assert.deepEqual((await s.gate(eda, 700, { character: eda.character })).body.deed, { struck: 25, guild: { name: 'The HND Guild', tag: 'HND' } });
  // four deeds a day: gates 701-703 make three more, a fifth raid deed waits
  for (const d of [701, 702, 703]) for (const w of [cass, dain, eda]) await s.gate(w, d, { character: w.character });
  assert.equal(s.lines('guild-deed').length, 4);
  const key = raidKey(DF, 5);
  for (const w of [bran, cass, dain]) await s.raid(w, key);
  assert.equal(s.lines('guild-deed').length, 4, 'the day\'s four');
  clock(T0 + DAY);
  const late = await s.raid(officer, key);
  assert.deepEqual(late.body.deed, { struck: 25, guild: { name: 'The HND Guild', tag: 'HND' } }, 'the next member\'s claim, the next day, strikes it');
  assert.equal(s.lines('guild-deed').length, 5);
  assert.ok(gm && s.addsUp());
  clock(T0);
});

// ─── GUILD CONTRACTS ─────────────────────────────────────────────────────────────────────────────────────────────────

test('SILVER-WAYS contracts DONE WHEN: a Guildmaster\'s contract of 3 defenders at 40 silver in Daggerfall, its 120 held from the treasury; an outsider\'s raid there paid 40 less the running tax, a member\'s too; the Officer and the Guildmaster never; another region\'s raid none; the third deed fills and closes it; the board lists it, best pay first (mutants: the region unread; a poster paid; the escrow undrawn; the tax per deed, not running)', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, members: [bran, cass], g } = await s.guild({ marks: 5_000 });
  const [out1, out2] = [await s.registered('Oswin'), await s.registered('Pell')];
  const post = await s.call('/v1/writs/contract', { character: gm.character, region: DF, kind: 'raid', pay: 40, deeds: 3, rid: rid() }, gm.secret);
  assert.equal(post.status, 200, JSON.stringify(post.body));
  assert.deepEqual([post.body.contract.pay, post.body.contract.deeds, post.body.contract.left, post.body.contract.escrow, post.body.guildMarks], [40, 3, 3, 120, 4_880]);
  const board = await s.call('/v1/writs/list', { character: out1.character, region: DF }, out1.secret);
  assert.deepEqual(board.body.contracts.map((c) => [c.pay, c.left, c.guild.tag]), [[40, 3, 'HND']]);
  assert.equal(board.body.contractPost, false);
  // another region's raid: nothing
  assert.equal((await s.raid(out1, raidKey(WR, 1))).body.contracts, undefined);
  // the outsider: paid, less the running tax (40 at 0 before: 2)
  const p1 = await s.raid(out1, raidKey(DF, 1));
  assert.deepEqual(p1.body.contracts, [{ contract: post.body.contract.id, guild: { name: 'The HND Guild', tag: 'HND' }, pay: 40 - saleTaxOn(0, 40), tax: saleTaxOn(0, 40) }]);
  assert.equal(s.raw.prepare('SELECT escrow FROM guild_contracts WHERE id = ?').get(post.body.contract.id).escrow, 80, 'the escrow drawn down by the deed');
  // the posters, never
  assert.equal((await s.raid(gm, raidKey(DF, 1))).body.contracts, undefined);
  assert.equal((await s.raid(officer, raidKey(DF, 1))).body.contracts, undefined);
  // a member is paid - its guild paying its fighters is what a contract is for
  const p2 = await s.raid(bran, raidKey(DF, 1));
  assert.equal(p2.body.contracts[0].tax, saleTaxOn(40, 40));
  const p3 = await s.raid(out2, raidKey(DF, 2));
  assert.equal(p3.body.contracts[0].tax, saleTaxOn(80, 40), 'the tax is the running total\'s, as a writ\'s');
  const row = s.raw.prepare('SELECT state, left_deeds, escrow, returned FROM guild_contracts WHERE id = ?').get(post.body.contract.id);
  assert.deepEqual({ ...row }, { state: 'filled', left_deeds: 0, escrow: 0, returned: 1 });
  assert.equal((await s.raid(cass, raidKey(DF, 2))).body.contracts, undefined, 'filled');
  assert.equal(s.balance(out1), 30 + 30 + 40 - saleTaxOn(0, 40), 'two raids\' silver and the contract\'s pay');
  assert.equal(s.guildMarks(g.id), 5_000 - 120 + 25, 'the treasury paid its three - nothing came home of a filled contract - and its Guildmaster, Officer and Bran on one raid struck it a deed');
  assert.ok(s.addsUp());
  assert.equal(s.escrowLedger(), 0, 'nothing held, nothing owed');
  // the tax is the running total's (a writ's, AUDIT 30 L6): 5% of 30 floored is 1, of 60 is 3 - the second defender pays 2
  const c30 = await s.call('/v1/writs/contract', { character: gm.character, region: WR, kind: 'raid', pay: 30, deeds: 2, rid: rid() }, gm.secret);
  assert.equal(c30.status, 200);
  const t1 = await s.raid(out2, raidKey(WR, 7)), t2 = await s.raid(cass, raidKey(WR, 7));
  assert.deepEqual([t1.body.contracts[0].tax, t2.body.contracts[0].tax], [1, 2]);
  assert.ok(s.addsUp());
});

test('SILVER-WAYS contracts: an Officer posts within the writ budget, one budget with its writs; five a guild; a withdrawal sends the rest home; an expired one goes home on the next read; a guild with a contract standing does not disband; a repeat answers the post (mutants: the budget unshared; the escrow kept; the disband allowed)', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, g } = await s.guild({ marks: 5_000 });
  const contract = (who, extra = {}) => s.call('/v1/writs/contract', { character: who.character, region: DF, kind: 'raid', pay: 10, deeds: 10, rid: rid(), ...extra }, who.secret);
  assert.equal((await contract(officer)).body.error, 'writ-budget', 'no budget until set');
  await s.call('/v1/writs/budget', { character: gm.character, marks: 250 }, gm.secret);
  assert.equal((await contract(officer)).status, 200, 'within it: 100');
  const w = await s.call('/v1/writs/post', { character: officer.character, region: DF, material: 'log:oak', units: 50, pay: 3, rid: rid() }, officer.secret);
  assert.equal(w.status, 200, 'a writ of 150: 250 spent');
  assert.equal((await contract(officer, { deeds: 1, pay: 1 })).body.error, 'writ-budget', 'the one budget, spent');
  const list = await s.call('/v1/writs/list', { character: gm.character, region: DF }, gm.secret);
  assert.equal(list.body.guild.spent, 250, 'the Work tab\'s budget counts the contract');
  for (let i = 0; i < 4; i++) assert.equal((await contract(gm)).status, 200);
  assert.equal((await contract(gm)).body.error, 'guild-contracts-max');
  // a repeat answers its post
  const r = rid();
  const once = await contract(gm, { rid: r });
  assert.equal(once.body.error, 'guild-contracts-max');
  // the Guildmaster withdraws one: its 100 home
  const mine = (await s.call('/v1/writs/list', { character: gm.character, region: DF }, gm.secret)).body.yoursContracts;
  const before = s.guildMarks(g.id);
  const wd = await s.call('/v1/writs/contract-withdraw', { character: gm.character, contract: mine[0].id, rid: rid() }, gm.secret);
  assert.equal(wd.status, 200, JSON.stringify(wd.body));
  assert.equal(s.guildMarks(g.id), before + 100);
  // a guild with a contract standing does not go
  const gone = await s.call('/v1/guilds/disband', { character: gm.character }, gm.secret);
  assert.notEqual(gone.status, 200);
  // past its seventh day: home on anyone's read
  clock(T0 + 8 * DAY);
  const mid = s.guildMarks(g.id);
  await s.call('/v1/writs/list', { character: gm.character, region: DF }, gm.secret);
  assert.equal(s.guildMarks(g.id), mid + 4 * 100 + 150, 'the four contracts\' and the Officer\'s writ\'s');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM guild_contracts WHERE state = 'open'").get().n, 0);
  assert.ok(s.addsUp());
  clock(T0);
});
