// STAFF-SET-BANK (2026-10-23, mob: "we need a set bank setting"; asked before, "how to i adjust a lpayers bank?", and
// nothing could) - THE STAFF PANEL SETS A REALM CHARACTER'S BANK: /v1/staff/fix/bank { id, ticket, was, gold, note }, an
// Admin's (server-account/src/staffRealm.js), the review's `bank` act (review.js bankAct, the repair's and the mend's
// machinery - staffMend) over its law (net/repairLaw.js bankSetOf, applyBankSet, bankTotalOf).
//
// The law alone, then driven through the real Worker on the node:sqlite database every account pin stands on
// (test/accountDb.mjs) with R2 beside it (test/realmSeat.mjs), a record holding the game's own bank table (banking.js
// createBankAccounts) with gold in two branches and a loan:
//   - the law: what a set may ask, and the set on a save - every branch folded into the Empire's account and that one set,
//     the loans where they stand, a total moved or no Empire account refused with nothing changed;
//   - the set: the total the profile says (/v1/staff/player `banks`) read and named, the record one sequence on with its
//     seat taken, the gold witnessed, the act's row, its finding, its faucet and its audit row; the playing tab's next
//     checkpoint refused, and the next join's judged clean - where the same gold written by the player's own save is a gain
//     the budget measures;
//   - a set down, and a bank below nothing: no faucet for a removal, none for gold that was never there;
//   - only an Admin, a note, the law's body, a total not the one read, a record with no Empire account;
//   - once a ticket, and a ticket names one act: a mend's or a repair's is no bank set's, nor a bank set's theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { seatRealm, freshSave, recordOf, realmJoinAt } from '../realmSeat.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { BANK_SET_FACTION } from '../../server-account/src/review.js';
import { saveViewOf } from '../../server-account/src/staffPlayers.js';
import { wealthOf } from '../../server-account/src/judge.js';
import { bankSetOf, applyBankSet, bankTotalOf } from '../../src/net/repairLaw.js';
import { createBankAccounts, foldEmpireAccounts, EMPIRE_ACCOUNT_REGION } from '../../src/systems/banking.js';
import { REALM_EMPIRE_ACCOUNT } from '../../src/net/realm/realmGoldLaw.js';
import { GOLD_INT_MAX } from '../../src/systems/item/itemLaw.js';
import { FACTION_FLAGS } from '../../src/formats/factionFile.js';
import worker from '../../server-account/src/index.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const DF = 17, WR = 23, SENTINEL = 5;   // Daggerfall (the Empire's account), Wayrest, and a branch below nothing
const TICKET = 'mob-bank-1';
const NOTE = 'set from the ticket';

/** The game's own bank table (banking.js createBankAccounts), `gold` by region, and a loan standing in Wayrest. */
const bankOf = (gold = {}) => createBankAccounts().map((a) => ({
  ...a, accountGold: gold[a.regionIndex] ?? 0, ...(a.regionIndex === WR ? { loanTotal: 1_100, loanDueDate: 777_000, hasDefaulted: false } : {}),
}));
const loansOf = (accounts) => accounts.map(({ regionIndex, loanTotal, loanDueDate, hasDefaulted }) => ({ regionIndex, loanTotal, loanDueDate, hasDefaulted }));

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up (test/server/staffpanel3realm.test.js's): mob an Admin and a developer, Asynian a
 *  Moderator, each signed in; realm characters seated through the service. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`,
  });
  const raw = s.env.DB._raw;
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const asyKey = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await asyKey.proof('enroll', 'Asynian')) })).body;
  const admin = (path, body = {}) => staff(path, body, mob.session);
  /** A checkpoint under a lease, one on - the character's own tab's, unless one is named. */
  const put = async (who, id, save, { seq = null, lease = null } = {}) => {
    const row = raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(id);
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': lease ?? row.lease ?? '0'.repeat(32), 'x-realm-seq': String(seq ?? row.seq + 1) }, body: JSON.stringify(save),
    }), s.env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A registered account seated as a realm character, `save` checkpointed over its first. */
  const seat = async (handle, save = null) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    if (save) assert.equal((await put(who, R.id, save)).status, 200, `${handle}'s save lands`);
    return { who, id: R.id };
  };
  const row = (id) => ({ ...raw.prepare('SELECT * FROM realm_characters WHERE id = ?').get(id) });
  const findings = (id) => raw.prepare('SELECT kind, detail FROM realm_findings WHERE char_id = ? ORDER BY id').all(id).map((r) => ({ kind: r.kind, detail: JSON.parse(r.detail) }));
  const repairs = (id) => raw.prepare('SELECT ticket, faction, flag, was, gold, seq, by_handle, note FROM realm_repairs WHERE char_id = ?').all(id).map((r) => ({ ...r }));
  const faucet = () => ({ ...raw.prepare("SELECT COALESCE(SUM(gold), 0) AS gold, COALESCE(SUM(n), 0) AS n FROM realm_faucets WHERE kind = 'repair'").get() });
  const audits = (act) => raw.prepare('SELECT act, target, detail, outcome FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null }));
  /** The bank the profile says for one character - the Staff Panel's own read (staffPlayers.js `banks`). */
  const banks = async (c) => {
    const r = await admin('/v1/staff/player', { target: row(c.id).player, tab: 'inventories', char: c.id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data.banks;
  };
  const setBank = (c, body) => admin('/v1/staff/fix/bank', { id: c.id, ticket: TICKET, note: NOTE, ...body });
  return { ...s, raw, staff, admin, mob, asy, put, seat, row, findings, repairs, faucet, audits, banks, setBank };
}

test('STAFF-SET-BANK THE LAW: a set asks a ticket of the repair\'s shape, the total staff read (any finite number - below nothing, or past every safe integer) and a bank of 0 to one int\'s worth; nothing else is a set (mutants: the ticket unread; the total unread; the total read loosely; each bound of the gold)', () => {
  assert.deepEqual(bankSetOf({ ticket: TICKET, was: 5_700, gold: 0, note: 'x', id: 'r1' }), { ticket: TICKET, was: 5_700, gold: 0 });
  assert.deepEqual(bankSetOf({ ticket: TICKET, was: -200, gold: GOLD_INT_MAX }), { ticket: TICKET, was: -200, gold: GOLD_INT_MAX }, 'a branch below nothing; one int\'s worth at most');
  assert.equal(bankSetOf({ ticket: TICKET, was: 1e18, gold: 0 })?.was, 1e18, 'any finite total is a set\'s to name; whether it is the bank\'s is the record\'s (applyBankSet)');
  for (const [why, v] of [
    ['no body', null], ['no object', 'mob-bank-1'],
    ['no ticket', { was: 0, gold: 0 }], ['a ticket of no shape', { ticket: 'Bank Set', was: 0, gold: 0 }],
    ['no total named', { ticket: TICKET, gold: 0 }], ['a total of null', { ticket: TICKET, was: null, gold: 0 }], ['a total as text', { ticket: TICKET, was: '5700', gold: 0 }],
    ['a total past every number', { ticket: TICKET, was: Infinity, gold: 0 }], ['a total of no number', { ticket: TICKET, was: NaN, gold: 0 }],
    ['no gold', { ticket: TICKET, was: 0 }], ['gold below nothing', { ticket: TICKET, was: 0, gold: -1 }], ['gold past one int', { ticket: TICKET, was: 0, gold: GOLD_INT_MAX + 1 }],
    ['gold not whole', { ticket: TICKET, was: 0, gold: 0.5 }], ['gold as text', { ticket: TICKET, was: 0, gold: '5' }],
  ]) assert.equal(bankSetOf(v), null, why);
});

test('STAFF-SET-BANK THE SET ON A SAVE: the total the profile says (one sum), still the one read, folded into the Empire\'s account and that one set - every other branch at nothing, one below nothing and a count of no number too, every loan, due date and default where it stands, nothing left for the boot\'s fold; a total moved, or no Empire account, refused with nothing changed (mutants: the total unchecked; the Empire\'s account unchecked; the branches kept; a loan touched; a count of no number summed)', () => {
  assert.equal(REALM_EMPIRE_ACCOUNT, EMPIRE_ACCOUNT_REGION, 'the realm\'s Empire account is the game\'s');
  const save = { bankAccounts: bankOf({ [DF]: 5_000, [WR]: 700, [SENTINEL]: -200 }) };
  save.bankAccounts[30] = { ...save.bankAccounts[30], loanTotal: 50, hasDefaulted: true };
  save.bankAccounts[DF].loanTotal = 300;   // a loan taken in Daggerfall stands on the Empire's own account
  save.bankAccounts[DF].loanDueDate = 888_000;
  save.bankAccounts[40].accountGold = '900';   // a count of no number: the profile counts it none
  save.bankAccounts[41] = null;
  save.bankAccounts[42].accountGold = Infinity;
  const loans = loansOf(save.bankAccounts.filter(Boolean));
  assert.equal(bankTotalOf(save), 5_500);
  assert.equal(bankTotalOf(save), saveViewOf(save).banks, 'the profile\'s own sum');
  const before = structuredClone(save);
  assert.equal(applyBankSet(save, { was: 5_501, gold: 9_000 }), 'bank-moved', 'played since, or another character');
  assert.deepEqual(save, before, 'nothing changed');
  assert.deepEqual(applyBankSet(save, { was: 5_500, gold: 9_000 }), { was: 5_500 });
  assert.equal(save.bankAccounts[DF].accountGold, 9_000, 'the Empire\'s account holds the bank');
  assert.deepEqual(save.bankAccounts.map((a, i) => [i, a?.accountGold]).filter(([i, g]) => i !== DF && g !== 0 && i !== 41), [], 'every other branch at nothing');
  assert.equal(save.bankAccounts[41], null, 'an entry that is no account left as it is');
  assert.deepEqual(loansOf(save.bankAccounts.filter(Boolean)), loans, 'every loan, its due date and its default where it stands');
  assert.equal(bankTotalOf(save), 9_000);
  assert.equal(saveViewOf(save).banks, 9_000, 'the profile says the bank set');
  assert.equal(foldEmpireAccounts(save), null, 'the boot\'s fold finds nothing to move');
  // REVIEW (2026-10-23): a bank past every safe integer - or summed past every number - is said at the bound, a total the
  // profile can send (JSON has no Infinity) and the act's row can hold, and a set from it lands
  for (const [why, g, total] of [['past every safe integer', [1e16], Number.MAX_SAFE_INTEGER], ['summed past every number', [1e308, 1e308], Number.MAX_SAFE_INTEGER],
    ['below every safe integer', [-1e308, -1e308], -Number.MAX_SAFE_INTEGER], ['a fraction', [5_000.5], 5_000.5]]) {
    const big = { bankAccounts: bankOf({ [DF]: g[0], [WR]: g[1] ?? 0 }) };
    assert.equal(bankTotalOf(big), total, why);
    assert.equal(saveViewOf(big).banks, total, `${why}: the profile's own sum`);
    assert.deepEqual(applyBankSet(big, { was: total, gold: 7 }), { was: total }, why);
    assert.equal(bankTotalOf(big), 7, why);
  }
  // no Empire account: refused, never a table invented
  for (const [why, s] of [
    ['no table', { goldPieces: 5 }], ['an empty table', { bankAccounts: [] }], ['a short table', { bankAccounts: bankOf({ 3: 40 }).slice(0, DF) }],
    ['no list', { bankAccounts: { [DF]: { accountGold: 5 } } }], ['the Empire\'s entry no account', { bankAccounts: bankOf({ 3: 40 }).map((a, i) => (i === DF ? 7 : a)) }],
  ]) {
    const was = bankTotalOf(s);
    const b = structuredClone(s);
    assert.equal(applyBankSet(s, { was, gold: 100 }), 'bank-none', why);
    assert.deepEqual(s, b, `${why}: nothing changed`);
  }
});

test('STAFF-SET-BANK THE SET: an Admin reads the bank the profile says and names it; the bank becomes the Empire\'s account holding the gold named, every other branch at nothing and the loan where it stands - the record one sequence on with its seat taken, the gold witnessed, the act\'s row, its finding, the service\'s own faucet for what it raised and the audit row; the playing tab writes over it never, and the next join\'s checkpoint is judged clean, where the same bank written by the player\'s own save is a gain the budget measures (mutants: the act unwired; the route unlisted; the route\'s act; the row unwritten; the finding; the faucet; the profile\'s sum)', async () => {
  const s = await stand();
  const saved = freshSave({ name: 'Banker', bankAccounts: bankOf({ [DF]: 5_000, [WR]: 700 }) });
  const c = await s.seat('Banker', saved);
  const before = { row: s.row(c.id), rec: recordOf(s.env, c.id), findings: s.findings(c.id).length };
  const tab = { lease: before.row.lease, seq: before.row.seq + 1 };
  const was = await s.banks(c);
  assert.equal(was, 5_700, 'the profile says every branch together');
  const gold = 3_000_000;
  const r = await s.setBank(c, { was, gold });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, repeat: false, ticket: TICKET, seq: before.row.seq + 1, was, gold, held: null, by: 'SirMcMobdon', at: r.body.at, playing: true });
  const rec = recordOf(s.env, c.id);
  assert.equal(rec.bankAccounts[DF].accountGold, gold);
  assert.equal(rec.bankAccounts[WR].accountGold, 0, 'Wayrest\'s gold folded in');
  assert.deepEqual(loansOf(rec.bankAccounts), loansOf(before.rec.bankAccounts), 'the loan where it stands');
  assert.deepEqual({ ...rec, bankAccounts: null }, { ...before.rec, bankAccounts: null }, 'nothing else in the record moved');
  assert.equal(await s.banks(c), gold, 'the profile says the bank set');
  const after = s.row(c.id);
  assert.deepEqual([after.seq, after.svc_seq, after.lease], [before.row.seq + 1, before.row.seq + 1, null], 'one sequence on, a service move, the seat taken from any tab');
  assert.equal(after.witnessed - before.row.witnessed, wealthOf(rec) - wealthOf(before.rec), 'witnessed: what the set moved');
  assert.equal(wealthOf(rec) - wealthOf(before.rec), gold - was);
  assert.deepEqual(s.repairs(c.id), [{ ticket: TICKET, faction: BANK_SET_FACTION, flag: 0, was, gold, seq: before.row.seq + 1, by_handle: 'SirMcMobdon', note: NOTE }]);
  assert.equal(BANK_SET_FACTION < 0, true, 'below every faction a repair (1 or more) or a mend (0) names');
  assert.deepEqual(s.findings(c.id).slice(before.findings), [{ kind: 'staff', detail: { act: 'bank', by: 'SirMcMobdon', note: NOTE, ticket: TICKET, was, gold, from: before.row.seq, to: before.row.seq + 1 } }]);
  assert.deepEqual(s.faucet(), { gold: gold - was, n: 1 }, 'what the set raised the bank by, the service\'s own faucet');
  assert.deepEqual(s.audits('fix-bank').map((a) => [a.target, a.outcome, a.detail]), [[after.player, 'ok', { char: c.id, name: 'Banker', note: NOTE, ticket: TICKET, gold, was, repeat: false }]]);
  // the tab that was playing: its next checkpoint names a seat and a sequence the record has left
  const stale = await s.put(c.who, c.id, { ...before.rec, goldPieces: 1 }, tab);
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.deepEqual(recordOf(s.env, c.id), rec, 'the set stands');
  // its next join plays the set record, and the next checkpoint charges nothing
  await realmJoinAt(s.env, c.who.secret, c.id);
  const findings = s.findings(c.id).length;
  const next = await s.put(c.who, c.id, rec);
  assert.equal(next.status, 200, JSON.stringify(next.body));
  assert.equal(next.body.tradeHeld ?? null, null);
  assert.deepEqual(s.findings(c.id).slice(findings), [], 'no finding: the budget charges no gain the service made');
  // the same bank written by the player's own save: a gain no witness explains, past the allowance
  const own = await s.seat('Saver', saved);
  const ownFindings = s.findings(own.id).length;
  assert.equal((await s.put(own.who, own.id, { ...saved, bankAccounts: rec.bankAccounts })).status, 200);
  assert.deepEqual(s.findings(own.id).slice(ownFindings).map((f) => [f.kind, f.detail.gain]), [['measure', gold - was]], 'the budget measures the same gold a save wrote');
});

test('STAFF-SET-BANK DOWN, AND BELOW NOTHING: a bank set down is written in the finding and the audit row and pays no faucet - the service keeps no sink for staff\'s removals - witnessed all the same, so no gain after it hides; a bank below nothing set up counts the gold it was never there for none (mutants: a faucet of a removal; the total below nothing counted)', async () => {
  const s = await stand();
  const c = await s.seat('Rich', freshSave({ name: 'Rich', bankAccounts: bankOf({ [DF]: 900_000, [WR]: 100_000 }) }));
  const before = { row: s.row(c.id), rec: recordOf(s.env, c.id) };
  const r = await s.setBank(c, { was: await s.banks(c), gold: 250 });
  assert.deepEqual([r.status, r.body.was, r.body.gold], [200, 1_000_000, 250], JSON.stringify(r.body));
  assert.deepEqual(s.faucet(), { gold: 0, n: 0 }, 'no faucet row for a removal');
  assert.equal(s.row(c.id).witnessed - before.row.witnessed, 250 - 1_000_000, 'the removal witnessed');
  assert.deepEqual(s.findings(c.id).filter((f) => f.kind === 'staff').map((f) => [f.detail.was, f.detail.gold]), [[1_000_000, 250]]);
  assert.deepEqual(s.audits('fix-bank').map((a) => [a.detail.was, a.detail.gold]), [[1_000_000, 250]]);
  // the player then makes gold of its own: the budget measures it as it would have, the removal no cover for it
  await realmJoinAt(s.env, c.who.secret, c.id);
  const rec = recordOf(s.env, c.id);
  const findings = s.findings(c.id).length;
  assert.equal((await s.put(c.who, c.id, { ...rec, goldPieces: rec.goldPieces + 500_000 })).status, 200);
  assert.deepEqual(s.findings(c.id).slice(findings).map((f) => [f.kind, f.detail.gain]), [['measure', 500_000]]);
  // a bank below nothing (no honest bank is - the judge holds on it): set up, the faucet is the gold set, none for the hole
  const d = await s.seat('Debtor', freshSave({ name: 'Debtor', bankAccounts: bankOf({ [DF]: 0, [WR]: -300 }) }));
  assert.equal(s.row(d.id).held, 'law', 'a bank below nothing holds');
  const up = await s.setBank(d, { ticket: 'mob-bank-2', was: await s.banks(d), gold: 1_000 });
  assert.deepEqual([up.status, up.body.was, up.body.held], [200, -300, 'law'], 'no hold lifted: the next checkpoint judges the record as it stands');
  assert.deepEqual(s.faucet(), { gold: 1_000, n: 1 });
  assert.deepEqual(recordOf(s.env, d.id).bankAccounts.map((a) => a.accountGold).filter((g) => g !== 0), [1_000]);
});

test('STAFF-SET-BANK THE REFUSALS: a Moderator is refused and written down; a note is required; the law\'s body (400); a total not the one read (409 bank-moved) and a record with no Empire account (409 bank-none), each written failed with its word and nothing moved (mutants: the note; the dispatch\'s check; each status)', async () => {
  const s = await stand();
  const c = await s.seat('Banker', freshSave({ name: 'Banker', bankAccounts: bankOf({ [DF]: 5_000, [WR]: 700 }) }));
  const before = { row: s.row(c.id), rec: recordOf(s.env, c.id) };
  const nothingMoved = (why) => {
    assert.deepEqual([s.row(c.id).seq, s.row(c.id).obj, s.row(c.id).lease], [before.row.seq, before.row.obj, before.row.lease], `${why}: the record did not move`);
    assert.deepEqual(recordOf(s.env, c.id), before.rec, why);
    assert.deepEqual([s.repairs(c.id).length, s.faucet().n], [0, 0], why);
  };
  const ask = { was: 5_700, gold: 10 };
  assert.deepEqual(await s.staff('/v1/staff/fix/bank', { id: c.id, ticket: TICKET, note: NOTE, ...ask }, s.asy.session), { status: 403, body: { error: 'staff-admin' } });
  assert.deepEqual(s.audits('refused').map((a) => [a.outcome, a.detail.path, a.detail.need]), [['denied', '/v1/staff/fix/bank', 'admin']]);
  assert.deepEqual(await s.staff('/v1/staff/fix/bank', { id: c.id, ticket: TICKET, note: NOTE, ...ask }), { status: 401, body: { error: 'staff-session' } });
  nothingMoved('refused callers');
  for (const note of [undefined, '', '   ']) assert.deepEqual(await s.setBank(c, { ...ask, note }), { status: 400, body: { error: 'staff-note' } }, `note ${JSON.stringify(note)}`);
  for (const [why, body] of [['a ticket of no shape', { ticket: 'Bank Set' }], ['no total', { was: undefined }], ['a total as text', { was: '5700' }], ['gold past one int', { gold: GOLD_INT_MAX + 1 }], ['gold below nothing', { gold: -5 }]]) {
    assert.deepEqual(await s.setBank(c, { ...ask, ...body }), { status: 400, body: { error: 'body' } }, why);
  }
  assert.deepEqual(await s.setBank(c, { ...ask, was: 5_699 }), { status: 409, body: { error: 'bank-moved' } });
  nothingMoved('refused sets');
  assert.deepEqual(s.audits('fix-bank').map((a) => [a.outcome, a.detail.error]), [
    ['failed', 'staff-note'], ['failed', 'staff-note'], ['failed', 'staff-note'],
    ['failed', 'body'], ['failed', 'body'], ['failed', 'body'], ['failed', 'body'], ['failed', 'body'], ['failed', 'bank-moved'],
  ]);
  // a record that keeps no Empire account: the game mints its accounts as it loads, and the next checkpoint carries them
  const none = await s.seat('Newcomer', freshSave({ name: 'Newcomer', bankAccounts: [] }));
  const noneRec = recordOf(s.env, none.id);
  assert.deepEqual(await s.setBank(none, { was: 0, gold: 10 }), { status: 409, body: { error: 'bank-none' } });
  assert.deepEqual(recordOf(s.env, none.id), noneRec, 'never a table invented');
  assert.equal(s.audits('fix-bank').at(-1).detail.error, 'bank-none');
  assert.deepEqual(await s.setBank({ id: 'r00000000000000000000' }, ask), { status: 404, body: { error: 'no-realm-character' } });
});

test('STAFF-SET-BANK ONCE A TICKET: the same ticket again is the set it was - answered again, nothing moved, no second faucet; and a ticket names one act - a mend\'s or a repair\'s ticket asked as a bank set, or a bank set\'s as a mend or a repair, is refused (409 repair-ticket) (mutants: a bank set\'s row read as a repair\'s; its row naming a mend\'s faction; a ticket of any kind)', async () => {
  const s = await stand();
  const c = await s.seat('Banker', freshSave({ name: 'Banker', goldPieces: -500, bankAccounts: bankOf({ [DF]: 5_000, [WR]: 700 }) }));
  const first = await s.setBank(c, { was: 5_700, gold: 6_000 });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const once = { row: s.row(c.id), rec: recordOf(s.env, c.id), faucet: s.faucet() };
  const again = await s.setBank(c, { was: 6_000, gold: 9_999_999, note: 'asked twice' });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual({ ...again.body, at: 0 }, { ...first.body, repeat: true, at: 0, playing: false }, 'the first set\'s answer, marked a repeat (the seat it took is no tab\'s now)');
  assert.deepEqual([s.row(c.id).seq, s.row(c.id).obj], [once.row.seq, once.row.obj], 'the record did not move');
  assert.deepEqual(recordOf(s.env, c.id), once.rec);
  assert.deepEqual(s.faucet(), once.faucet);
  assert.deepEqual([s.repairs(c.id).length, s.findings(c.id).filter((f) => f.kind === 'staff').length], [1, 1]);
  // REVIEW (2026-10-23): the repeat's audit row says it was one, with what the ticket's row holds - never the body asked again
  assert.deepEqual(s.audits('fix-bank').map((a) => [a.outcome, a.detail.note, a.detail.was, a.detail.gold, a.detail.repeat]), [['ok', NOTE, 5_700, 6_000, false], ['ok', 'asked twice', 5_700, 6_000, true]]);
  // the bank set's ticket, asked as a mend and as a repair
  assert.deepEqual(await s.admin('/v1/staff/fix/mend', { id: c.id, ticket: TICKET, was: -500, gold: 500, note: NOTE }), { status: 409, body: { error: 'repair-ticket' } });
  assert.deepEqual(await s.admin('/v1/staff/fix/repair', { id: c.id, ticket: TICKET, faction: 8, flag: FACTION_FLAGS.Summoned, gold: 0, note: NOTE }), { status: 409, body: { error: 'repair-ticket' } });
  assert.equal(recordOf(s.env, c.id).goldPieces, -500, 'the purse unmended');
  // a mend's ticket, asked as a bank set
  assert.equal((await s.admin('/v1/staff/fix/mend', { id: c.id, ticket: 'mob-purse-1', was: -500, gold: 500, note: NOTE })).status, 200);
  const mended = recordOf(s.env, c.id);
  assert.deepEqual(await s.setBank(c, { ticket: 'mob-purse-1', was: 6_000, gold: 1 }), { status: 409, body: { error: 'repair-ticket' } });
  assert.deepEqual(recordOf(s.env, c.id), mended, 'the mend\'s ticket sets no bank');
  assert.deepEqual(s.audits('fix-bank').at(-1).detail.error, 'repair-ticket');
  assert.equal((await s.setBank(c, { ticket: 'mob-bank-3', was: 6_000, gold: 1 })).status, 200, 'a ticket of its own does');
});

test('STAFF-SET-BANK A BANK THE JUDGE COUNTS OTHERWISE (REVIEW, 2026-10-23): a branch past every safe integer, banks summed past every number, a branch below nothing beside gold, and a fraction - each said by the profile, set, audited, and its faucet the gold the set witnessed, as the judge counts a bank (judge.js goldOf, wealthOf), never the total named (mutants: the faucet from the total; a branch below nothing counted; the total unbounded)', async () => {
  const s = await stand();
  for (const [handle, gold, said, set] of [
    ['Hacked', { [DF]: 1e16 }, Number.MAX_SAFE_INTEGER, 3_000_000],   // a modified client's bank: the witness counts it none
    ['Summed', { [DF]: 1e308, [WR]: 1e308 }, Number.MAX_SAFE_INTEGER, 1_000],
    ['Mixed', { [DF]: 5_000, [WR]: -5_000 }, 0, 5_000],   // 5,000 counted before and after: no gold came in
    ['Halved', { [DF]: 5_000.5 }, 5_000.5, 6_000],
  ]) {
    const c = await s.seat(handle, freshSave({ name: handle, bankAccounts: bankOf(gold) }));
    const before = { row: s.row(c.id), rec: recordOf(s.env, c.id), faucet: s.faucet().gold };
    const was = await s.banks(c);
    assert.equal(was, said, `${handle}: the profile says it`);
    const r = await s.setBank(c, { ticket: `mob-${handle.toLowerCase()}`, was, gold: set });
    assert.equal(r.status, 200, `${handle}: ${JSON.stringify(r.body)}`);
    assert.deepEqual([r.body.was, r.body.gold], [said, set], handle);
    const rec = recordOf(s.env, c.id);
    assert.equal(bankTotalOf(rec), set, handle);
    const witnessed = s.row(c.id).witnessed - before.row.witnessed;
    assert.equal(witnessed, wealthOf(rec) - wealthOf(before.rec), `${handle}: witnessed what the set moved`);
    assert.equal(s.faucet().gold - before.faucet, Math.max(0, witnessed), `${handle}: the faucet is the gold the set witnessed`);
    assert.deepEqual(s.audits('fix-bank').at(-1), { act: 'fix-bank', target: before.row.player, outcome: 'ok', detail: { char: c.id, name: handle, note: NOTE, ticket: `mob-${handle.toLowerCase()}`, gold: set, was: said, repeat: false } }, `${handle}: the set's audit row`);
  }
  assert.deepEqual(s.faucet(), { gold: 3_000_000 + 1_000 + 6_000, n: 3 }, 'no faucet row for the mixed bank: no gold came in');
});
