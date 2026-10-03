// MARKS1 (2026-09-28, Mac: "New currency"; "continue"): MARKS, THE SERVER'S CURRENCY - the law both ends read
// (src/net/marksLaw.js), the account service's balances, the one ledger that moves them, the first faucet (the gate's
// receipts), the Bank's one-way exchange, a guild's Marks treasury and the developers' weekly report, driven through the
// real Worker over node:sqlite with every migration applied (server-account/src/marks.js, 0025_marks.sql).
// bible/06-Systems/Professions-Arc.md 10.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { strikeGateMarks } from '../server-account/src/marks.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { GUILD_FOUND_RENOWN, GUILD_FOUND_GOLD } from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import {
  MARKS_MAX, MARKS_FAUCETS, MARKS_BANK, MARKS_KINDS, MARKS_SWITCH, marksSwitchOf, utcDay, marksAmountOk, exchangeGold,
  MARKS_RID_RE, marksText,
} from '../src/net/marksLaw.js';
import { accountMarks, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { createMarksBook, MARKS_TEXT, MARKS_PENDING_KEY, mintMarksRid } from '../src/net/marksBook.js';
import { createGateClaims, gateClaimVerdict, GATE_CLAIM_TEXT } from '../src/net/gateClaims.js';
import { creditMarksSale, marksSaleCredit, createBankAccounts } from '../src/systems/banking.js';
import { BankWindow, MARKS_ENTRY, MARKS_COUNTING } from '../src/ui/bankWindow.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // MERGE 2: TERMS1 - a request that makes an account carries the versions ticked
import { r2, seatRealm } from './realmSeat.mjs';   // MERGE 2: a founding is a realm character's (AUDIT REALM2 S2)

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const T0 = 1_800_000_000;   // a UTC day's middle: 20833 * 86400 + 28800
const DAY = 86400;
async function gatePair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pub };
}
const receiptFor = (s, d, key, nowS) => mintReceipt({ d, b: 'ruhn', s, c: 4242, x: 'dealt' }, key, { subtle, nowS });

async function stand({ open = 'on', developers = 'Devra' } = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const gate = await gatePair();
  const env = {
    DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: gate.pub,   // MERGE 2: SAVES, the realm's records
    MARKS_OPEN: open, DEVELOPER_HANDLES: developers,
  };
  const call = async (path, body, bearer = null, method = 'POST') => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const guest = async () => (await call('/v1/auth/guest', { ...ACCEPTED })).body;   // MERGE 2: main's TERMS1
  const registered = async (handle, { character = `char-${handle.toLowerCase()}`, renown = 1 } = {}) => {
    const g = await guest();
    assert.equal((await call('/v1/auth/register', { handle, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200, `${handle} registers`);
    if (renown > 1) {
      // RENOWN-CHAR: the character's own track again (MERGE 2 had seeded RENOWN-ACCOUNT's one track an account)
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(g.id, character, handle, renownXpFor(renown), T0, T0);
    }
    return { secret: g.secret, id: g.id, character, handle };
  };
  const claim = async (who, gameDay, nowS) => call('/v1/gate/claim', { receipt: await receiptFor(who.id, gameDay, gate.priv, nowS) }, who.secret);
  const balance = (who) => call('/v1/marks/balance', {}, who.secret);
  const mint = (o, nowS = T0) => mintReceipt({ b: 'ruhn', c: 4242, x: 'dealt', ...o }, gate.priv, { subtle, nowS });   // AUDIT WB12d: any receipt the relay could sign
  return { env, call, guest, registered, claim, balance, mint };
}
let _rid = 0;
const rid = () => `req-${String(++_rid).padStart(6, '0')}`;

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MARKS1 the law: a balance holds 10,000,000; the gate strikes 50 (SILVER-WAYS: under the day\'s combat cap, test/silverways_service.test.js); the Bank pays 8 gold a Mark, 300 Marks a day; the switch is off, dev or on (anything else off); the caps count by the UTC day', () => {
  assert.equal(MARKS_MAX, 10_000_000);
  assert.deepEqual(MARKS_FAUCETS.gate, { amount: 50 });   // PIN MOVED (SILVER-WAYS): two a UTC day of its own became the gates' and the raids' one combat cap
  assert.deepEqual(MARKS_BANK, { goldPerMark: 8, perDay: 300 });
  assert.deepEqual(MARKS_SWITCH, ['off', 'dev', 'on']);
  assert.deepEqual(['on', 'dev', 'off', 'ON', undefined, 'yes'].map(marksSwitchOf), ['on', 'dev', 'off', 'off', 'off', 'off']);
  assert.equal(utcDay(T0), Math.floor(T0 / DAY));
  assert.equal(utcDay(Math.floor(T0 / DAY) * DAY + DAY - 1), utcDay(T0), 'the last second of the day');
  assert.deepEqual([1, 300, 0, -1, 1.5, 301, NaN, '5'].map((n) => marksAmountOk(n, 300)), [true, true, false, false, false, false, false, false]);
  assert.equal(exchangeGold(300), 2400);
  assert.ok(MARKS_RID_RE.test('req-000001') && !MARKS_RID_RE.test('short') && !MARKS_RID_RE.test('has space in it'));
  assert.deepEqual([marksText(1), marksText(1240)], ['1 silver', '1,240 silver']);
});

test('MARKS1: GOLD NEVER BUYS MARKS - no kind, route, table or statement takes gold in and strikes a Mark', () => {
  // PROF1 built the second: a Court writ's pay, struck for units the service took out of the Stores (test/prof1_service)
  assert.deepEqual(Object.entries(MARKS_KINDS).filter(([, way]) => way === 'mint').map(([k]) => k), ['gate', 'writ', 'siege-honours', 'gate-incursion', 'seat-strike-refund', 'raid', 'guild-deed', 'motherlode'], 'the faucets built - each a witnessed act');   // PIN MOVED (AUDIT-SEATS): a siege's relay-signed Honours and an Incursion's agreed gate days, registered at last; PIN MOVED (SILVER-WAYS): a raid's receipt, a guild's deed, a Motherlode's Watch
  assert.ok(![...ROUTES].some((r) => r.startsWith('/v1/marks/') && /buy|purchase|gold/i.test(r)), 'no route to buy Drakes');
  const marks = src('server-account/src/marks.js').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // PIN MOVED (SILVER-WAYS): the gate's statement became the combat strike's, the gate's and the raid's alone, and the
  // guild deed's strikes a guild's treasury
  const mints = [...marks.matchAll(/SELECT 'mint', NULL, '(?:account|guild)', [^,]+, '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(mints, ['${kind}', 'guild-deed'], 'the service strikes Drakes in two statements, the combat strike\'s and the deed\'s');
  assert.deepEqual([...marks.matchAll(/combatStrikeStatement\(ctx, player, '([a-z]+)'/g)].map((m) => m[1]), ['gate', 'raid'], 'the combat strike, a gate\'s and a raid\'s');
  assert.doesNotMatch(src('server-account/migrations/0025_marks.sql'), /'gold'/, 'the ledger has no gold end');
  assert.match(src('server-account/migrations/0025_marks.sql'), /src_kind TEXT NOT NULL CHECK \(src_kind IN \('mint', 'account', 'guild'\)\)/);
});

// ─── THE LEDGER MOVES THE BALANCES ───────────────────────────────────────────────────────────────────────────────────

test('MARKS1 the schema: a line moves both balances on its own insert; a line that would overdraw or overfill is refused by the net under the floor; an account that goes takes its balance, never its lines', async () => {
  const { env, registered } = await stand();
  const a = await registered('Anna');
  const raw = env.DB._raw;
  const line = (src, srcId, dst, dstId, amount, r) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES (?, ?, ?, ?, 'test', ?, 1, 1, ?, NULL, ?)`).run(src, srcId, dst, dstId, amount, a.id, r);
  line('mint', null, 'account', a.id, 70, 'r-000001');
  assert.equal(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(a.id).balance, 70);
  line('account', a.id, 'burn', null, 20, 'r-000002');
  assert.equal(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(a.id).balance, 50);
  assert.throws(() => line('account', a.id, 'burn', null, 51, 'r-000003'), /CHECK/, 'never below nothing');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM marks_ledger').get().n, 2, 'and the refused line is not written');
  assert.throws(() => line('mint', null, 'account', a.id, MARKS_MAX, 'r-000004'), /CHECK/, 'never past the cap');
  assert.throws(() => line('mint', null, 'account', a.id, 1, 'r-000001'), /UNIQUE/, 'one line a request');
  raw.prepare('DELETE FROM players WHERE id = ?').run(a.id);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM marks WHERE account = ?').get(a.id).n, 0, 'its Drakes go');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM marks_ledger').get().n, 2, 'the ledger is the economy\'s audit, kept');
});

// ─── THE FIRST FAUCET ────────────────────────────────────────────────────────────────────────────────────────────────

test('MARKS1 the gate\'s receipt: 50 Marks for a gate counted, under the day\'s combat cap (SILVER-WAYS: was two a UTC day) - a fourth gate the same day counts and strikes nothing; the next day strikes again; the same gate never twice; a guest none', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { env, registered, guest, claim, balance, call } = await stand();
  const a = await registered('Anna');
  const first = await claim(a, 700, T0);
  // PIN MOVED (SILVER-WAYS): the strike answers the day's combat silver beside it, and the cap is the gates' and the
  // raids' 150 together (three gates), where it was the gate's own two
  const combat = (earned) => ({ earned, max: 150 });
  assert.deepEqual(first.body, { recorded: true, stones: 1, closed: 1, marks: { struck: 50, balance: 50, combat: combat(50) } });   // WB12d: the row's embers said (AUDIT WB12d A1)
  assert.deepEqual((await claim(a, 701, T0)).body.marks, { struck: 50, balance: 100, combat: combat(100) });
  assert.deepEqual((await claim(a, 702, T0)).body.marks, { struck: 50, balance: 150, combat: combat(150) }, 'SILVER-WAYS: the third gate within the cap');
  const fourth = await claim(a, 703, T0);
  assert.equal(fourth.body.recorded, true, 'the gate is on the record');
  assert.deepEqual(fourth.body.marks, { struck: 0, balance: 150, combat: combat(150), why: 'cap' }, 'the faucet\'s cap, not the gate\'s');
  assert.deepEqual((await claim(a, 700, T0)).body, { recorded: false, why: 'claimed', stones: 1, closed: 4 }, 'the same gate again strikes nothing');
  assert.deepEqual((await balance(a)).body.today, { gate: 3, combat: 150, combatMax: 150, exchanged: 0, exchangeMax: 300 });
  clock = (T0 + DAY) * 1000;
  assert.deepEqual((await claim(a, 712, T0 + DAY)).body.marks, { struck: 50, balance: 200, combat: combat(50) }, 'a new UTC day');
  assert.equal((await call('/v1/account', undefined, a.secret, 'GET')).body.account.marks, 200, 'the account card reads it');
  const g = await guest();
  const gr = await claim(g, 700, T0 + DAY);
  assert.deepEqual([gr.body.recorded, gr.body.marks], [false, undefined], 'a guest\'s gate is not on a record, and strikes nothing');
  // ...and the strike itself refuses a guest, whoever asks it (its own contract, not claimGate's alone)
  assert.equal(await strikeGateMarks({ db: env.DB, nowS: T0 + DAY }, { id: g.id, handle: null }, env, 800), null);
  assert.equal((await call('/v1/account', undefined, g.secret, 'GET')).body.account.marks, null);
});

test('AUDIT WB12d (A2, A3): A RECEIPT OF THE RITE ALONE strikes no Drakes and answers none, nor the seats\' influence (SEAT1b, at the merge) - the game says "Rite recorded." alone, on a day two breaches already struck too; a guest\'s is the rite\'s own line, kept for its week (mutants: the rite answered a Drakes line; the rite credited a seat; the guest told of a breach)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { registered, claim, call, mint } = await stand();
  const a = await registered('Anna');
  await claim(a, 700, T0); await claim(a, 701, T0);   // the UTC day's two strikes spent
  const rite = await mint({ d: 702, s: a.id, x: 'rite' });
  const answer = await call('/v1/gate/claim', { receipt: rite, region: 21, character: 'anna-1' }, a.secret);
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.body, { recorded: true, stones: 1, rite: true, closed: 2 }, 'no `marks` - the rite alone strikes none; nor `seat` (SEAT1b at the merge: the rite alone is no kill, and no influence)');
  const said = [];
  const claims = createGateClaims({ claim: async () => ({ ok: true, data: answer.body }), me: () => a.id, say: (x) => said.push(x), onMarks: () => 'a Drakes line' });
  claims.add(rite);
  await claims.flush();
  assert.deepEqual(said, ['Rite recorded.']);
  const guestSaid = [];
  const gc = createGateClaims({ claim: async () => ({ ok: true, data: { recorded: false, why: 'guest', closed: 0 } }), me: () => a.id, say: (x) => guestSaid.push(x) });
  const g = await mint({ d: 703, s: a.id, x: 'rite' });
  gc.add(g);
  await gc.flush();
  assert.deepEqual(guestSaid, [GATE_CLAIM_TEXT.guestRite]);
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: false, why: 'guest', closed: 0 } }, { x: 'rite' }), 'keep', 'kept for its week');
});

test('AUDIT WB12d (A1): A FIGHTER\'S `r` is let go only once a service that answers its embers has counted it - one from before acct62 (no `stones`) keeps it for its week, and acct62 makes its row good on the claim again; every other receipt as it was (mutants: an `r` let go at one ember; every receipt kept)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: true, closed: 1 } }, { x: 'dealt', r: 1 }), 'keep', 'acct45: counted at one');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed', closed: 1 } }, { x: 'dealt', r: 1 }), 'keep');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed', stones: 2, closed: 1 } }, { x: 'dealt', r: 1 }), 'done');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: true, closed: 1 } }, { x: 'dealt' }), 'done', 'a plain receipt as ever');
  const { registered, call, mint, env } = await stand();
  const a = await registered('Anna');
  env.DB._raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (700, ?, 'ruhn', 'dealt', 1)").run(a.id);   // acct45 counted it
  const again = await call('/v1/gate/claim', { receipt: await mint({ d: 700, s: a.id, r: 1 }) }, a.secret);
  assert.deepEqual(again.body, { recorded: false, why: 'claimed', stones: 2, closed: 1 });
  assert.equal(gateClaimVerdict({ ok: true, data: again.body }, { x: 'dealt', r: 1 }), 'done');
});

test('MARKS1 the balance\'s cap: a gate that would carry a balance past 10,000,000 strikes nothing (`full`)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, registered, claim } = await stand();
  const a = await registered('Anna');
  env.DB._raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, 'test', ?, 1, 1, ?, NULL, 'seed-0001')`).run(a.id, MARKS_MAX - 10, a.id);
  assert.deepEqual((await claim(a, 700, T0)).body.marks, { struck: 0, balance: MARKS_MAX - 10, combat: { earned: 0, max: 150 }, why: 'full' });   // PIN MOVED (SILVER-WAYS): the day's combat silver beside it
});

test('MARKS1 the switch: off, nothing strikes and nothing answers; dev, the developers alone; on, every account', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const off = await stand({ open: 'off' });
  const a = await off.registered('Anna');
  assert.equal((await off.claim(a, 700, T0)).body.marks, null);
  assert.deepEqual(await off.balance(a), { status: 403, body: { error: 'marks-closed' } });
  const dev = await stand({ open: 'dev', developers: 'Devra' });
  const d = await dev.registered('Devra');
  const p = await dev.registered('Pell');
  assert.deepEqual((await dev.claim(d, 700, T0)).body.marks, { struck: 50, balance: 50, combat: { earned: 50, max: 150 } }, 'a developer strikes');   // PIN MOVED (SILVER-WAYS): the day's combat silver beside it
  assert.equal((await dev.claim(p, 700, T0)).body.marks, null, 'everyone else waits for "on"');
  assert.match(src('server-account/wrangler.toml'), /^MARKS_OPEN = "on"$/m, 'shipped at dev - opened to everyone by one line (SWITCH-ON, Mac: "Fuck it lets switch everything on")');
});

// ─── THE BANK ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MARKS1 the Bank: Marks burnt for 8 gold each, never more than held, 300 a UTC day; a request asked twice is one sale; a guest has no Marks to sell', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { env, registered, guest, call, balance } = await stand();
  const a = await registered('Anna');
  env.DB._raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, 'test', 1000, 1, 1, ?, NULL, 'seed-0001')`).run(a.id, a.id);
  const sell = (marks, r = rid()) => call('/v1/marks/exchange', { marks, rid: r }, a.secret);
  const r1 = rid();
  assert.deepEqual((await sell(200, r1)).body, { ok: true, marks: 200, gold: 1600, balance: 800, exchangedToday: 200 });
  assert.deepEqual((await sell(200, r1)).body, { repeat: true, marks: 200, gold: 1600, balance: 800, exchangedToday: 200 }, 'its answer lost and asked again: answered again, never sold twice');
  assert.deepEqual(await sell(101), { status: 409, body: { error: 'marks-bank-cap' } }, '300 a day');
  assert.equal((await sell(100)).body.balance, 700);
  assert.deepEqual(await sell(1), { status: 409, body: { error: 'marks-bank-cap' } });
  clock = (T0 + DAY) * 1000;
  assert.deepEqual(await sell(301), { status: 400, body: { error: 'bad-marks' } }, 'never more than a day\'s at once');
  assert.deepEqual((await sell(300)).body.gold, 2400, 'the next day');
  clock = (T0 + 2 * DAY) * 1000;
  assert.deepEqual((await sell(300)).body.balance, 100);
  clock = (T0 + 3 * DAY) * 1000;
  assert.deepEqual(await sell(101), { status: 409, body: { error: 'marks-short' } }, 'never more than held');
  assert.deepEqual(await sell(5, 'bad id'), { status: 400, body: { error: 'marks-rid' } });
  assert.deepEqual((await balance(a)).body.balance, 100);
  const g = await guest();
  assert.deepEqual(await call('/v1/marks/exchange', { marks: 1, rid: rid() }, g.secret), { status: 403, body: { error: 'marks-need-account' } });
  assert.equal((await call('/v1/marks/exchange', { marks: 1, rid: rid() })).status, 401, 'a stranger sells nothing');
  assert.ok(!OPEN_ROUTES.has('/v1/marks/exchange'));
});

// ─── A GUILD'S MARKS TREASURY ────────────────────────────────────────────────────────────────────────────────────────

test('MARKS1 a guild\'s Marks treasury: any member puts Marks in from the account\'s balance; the guildmaster alone takes them out; the view shows it and its lines; a disband gives what is left to the guildmaster (AUDIT 28 M3)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, registered, call } = await stand();
  const seed = (who, n) => env.DB._raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, 'test', ?, 1, 1, ?, NULL, ?)`).run(who.id, n, who.id, `seed-${who.handle}`);
  const aldric = await registered('Aldric', { renown: GUILD_FOUND_RENOWN });
  // MERGE 2: a founding is a realm character's, paid on its record (main's AUDIT REALM2 S2) - Aldric plays one from here
  const R = await seatRealm(env, aldric.secret, aldric.handle, { name: aldric.handle, level: 9, goldPieces: GUILD_FOUND_GOLD * 10, items: [] });
  // RENOWN-CHAR: a founding asks the founder's OWN track - carried to the realm character it plays from here, as customs carries one
  env.DB._raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, aldric.id, aldric.character);
  aldric.character = R.id;
  const { guild } = (await call('/v1/guilds/found', { character: R.id, name: 'The Hound', tag: 'HND', realm: R.at() }, aldric.secret)).body;
  const mara = await registered('Mara');
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'mara' }, aldric.secret);
  await call('/v1/guilds/answer', { character: mara.character, guild: guild.id, accept: true }, mara.secret);
  seed(mara, 500); seed(aldric, 100);
  const put = (who, marks, r = rid()) => call('/v1/marks/guild/deposit', { character: who.character, marks, rid: r }, who.secret);
  const take = (who, marks, r = rid()) => call('/v1/marks/guild/withdraw', { character: who.character, marks, rid: r }, who.secret);
  const idTaken = rid();
  assert.deepEqual((await put(mara, 300, idTaken)).body, { ok: true, marks: 300, balance: 200, guildMarks: 300 }, 'a recruit puts in');
  assert.deepEqual(await call('/v1/marks/exchange', { marks: 300, rid: idTaken }, mara.secret), { status: 400, body: { error: 'marks-rid' } }, 'a deposit\'s id is never answered as a sale - no gold for Drakes never sold');
  assert.deepEqual(await put(mara, 201), { status: 409, body: { error: 'marks-short' } });
  assert.deepEqual(await take(mara, 10), { status: 403, body: { error: 'guild-rank' } }, 'the guildmaster\'s alone');
  assert.deepEqual(await take(aldric, 301), { status: 409, body: { error: 'guild-marks-short' } });
  const r = rid();
  assert.deepEqual((await take(aldric, 120, r)).body, { ok: true, marks: 120, balance: 220, guildMarks: 180 });
  assert.deepEqual((await take(aldric, 120, r)).body, { repeat: true, marks: 120, balance: 220, guildMarks: 180 }, 'one take a request');
  const view = (await call('/v1/guilds/mine', { character: aldric.character }, aldric.secret)).body.guild;
  assert.equal(view.marks, 180);
  assert.deepEqual(view.marksLedger.map((l) => [l.who, l.kind, l.amount]), [['Aldric', 'withdraw', 120], ['Mara', 'deposit', 300]]);
  assert.deepEqual(await put({ ...mara, character: 'char-not-in-it' }, 1), { status: 404, body: { error: 'no-guild' } });
  // AUDIT 28 M3: a disband gives the Marks still held to the guildmaster - one line, in the disband's own batch
  await call('/v1/guilds/remove', { character: aldric.character, member: view.members.find((m) => m.name === 'Mara').member }, aldric.secret);
  assert.equal((await call('/v1/guilds/disband', { character: aldric.character }, aldric.secret)).status, 200, 'it goes');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guild_marks').get().n, 0);
  assert.equal(env.DB._raw.prepare('SELECT balance FROM marks WHERE account = ?').get(aldric.id).balance, 400, '220 held + the 180 the treasury held');
  assert.deepEqual({ ...env.DB._raw.prepare("SELECT kind, amount, src_kind, dst_id FROM marks_ledger WHERE rid = ?").get(`disband:${guild.id}`) },
    { kind: 'guild-withdraw', amount: 180, src_kind: 'guild', dst_id: aldric.id }, 'and the ledger says where they went');
});

// ─── THE WEEKLY REPORT ───────────────────────────────────────────────────────────────────────────────────────────────

test('MARKS1 the weekly report: a developer\'s alone - struck by faucet, burnt by sink, moved, in circulation, day by day, and the accounts at a cap', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { registered, claim, call } = await stand({ developers: 'Devra' });
  const d = await registered('Devra');
  const a = await registered('Anna');
  await claim(a, 700, T0); await claim(a, 701, T0); await claim(a, 702, T0); await claim(d, 700, T0);   // PIN MOVED (SILVER-WAYS): three gates reach the combat cap
  await call('/v1/marks/exchange', { marks: 40, rid: rid() }, a.secret);
  assert.deepEqual(await call('/v1/marks/report', {}, a.secret), { status: 403, body: { error: 'not-developer' } });
  const r = (await call('/v1/marks/report', {}, d.secret)).body;
  assert.deepEqual([r.minted, r.burnt, r.moved], [{ gate: 200 }, { exchange: 40 }, {}]);
  assert.deepEqual([r.mintedTotal, r.burntTotal, r.ratio], [200, 40, 5]);
  assert.deepEqual(r.circulation, { accounts: 160, guilds: 0, escrow: 0, holders: 2 });   // PROF5: the buy orders' escrow beside the balances
  assert.deepEqual(r.days, [{ day: utcDay(T0), minted: 200, burnt: 40 }]);
  assert.deepEqual(r.capped, { combat: 1, bank: 0 });   // PIN MOVED (SILVER-WAYS): the accounts at the day's combat cap, the gates' and the raids'
  assert.equal(r.to - r.from, 6, 'seven UTC days');
});

// ─── THE CLIENT ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A JSON store as the host's (scenes/spoilsPool.js spoilsStore). */
const jsonStore = () => { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => (v == null ? m.delete(k) : m.set(k, v)), _m: m }; };
/** The door over the real Worker, as a signed-in device holds it. */
const doorOver = (env, who) => accountMarks({
  fetch: (u, i) => worker.fetch(new Request(u, i), env),
  storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: who.secret, id: who.id }) : null) },
});
const seedMarks = (env, who, n) => env.DB._raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
  VALUES ('mint', NULL, 'account', ?, 'test', ?, 1, 1, ?, NULL, ?)`).run(who.id, n, who.id, `seed-${who.handle}-${n}`);

test('MARKS1 the client\'s door: every Marks route posts to the service behind the session; every word the service says has its sentence', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push([new URL(url).pathname, JSON.parse(init.body), init.headers.authorization]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  const door = accountMarks({ fetch, storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 'sek' }) : null) } });
  await door.balance(); await door.exchange(5, 'r-00000001'); await door.guildDeposit('c1', 7, 'r-00000002'); await door.guildWithdraw('c1', 8, 'r-00000003'); await door.report();
  assert.deepEqual(sent.map((s) => s[0]), ['/v1/marks/balance', '/v1/marks/exchange', '/v1/marks/guild/deposit', '/v1/marks/guild/withdraw', '/v1/marks/report']);
  assert.ok(sent.every((s) => s[2] === 'Bearer sek'));
  assert.deepEqual(sent.map((s) => s[1]).slice(1, 4), [{ marks: 5, rid: 'r-00000001' }, { character: 'c1', marks: 7, rid: 'r-00000002' }, { character: 'c1', marks: 8, rid: 'r-00000003' }]);
  for (const w of ['marks-need-account', 'marks-closed', 'marks-rid', 'bad-marks', 'marks-short', 'marks-bank-cap', 'marks-full', 'guild-marks-short', 'guild-marks-full', 'marks-rate', 'not-developer']) {
    assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
  }
  assert.match(mintMarksRid(), MARKS_RID_RE, 'the ids the book mints are ids the service reads');
});

test('MARKS1 the Bank\'s sale, end to end: the Marks burnt on the service and the gold paid once into the account at this bank; an answer lost is asked again and paid once; a sale never answered is kept and settles into its own region, for its own character', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { env, registered } = await stand();
  const a = await registered('Anna');
  seedMarks(env, a, 1000);
  const real = doorOver(env, a);
  const accounts = createBankAccounts(62);
  const credit = marksSaleCredit(() => accounts, () => 17);
  const store = jsonStore();
  let playing = 'char-anna';
  const book = createMarksBook({ door: real, store, character: () => playing });
  assert.deepEqual((await book.sell(100, credit, 17)).text, MARKS_TEXT.sold(100, 800));
  assert.equal(accounts[17].accountGold, 800, 'paid into the account where the sale was made');
  assert.equal(book.state.balance, 900);
  // the answer lost once: the same request asked again is the same sale, paid once
  let dropped = 0;
  const lossy = { ...real, exchange: async (m, r) => { const answer = await real.exchange(m, r); if (dropped++ === 0) return { ok: false, error: 'offline' }; return answer; } };
  const b2 = createMarksBook({ door: lossy, store, character: () => playing });
  assert.equal((await b2.sell(50, credit, 17)).gold, 400);
  assert.equal(accounts[17].accountGold, 1200, 'one sale, one payment');
  assert.equal((await b2.refresh()).data.balance, 850, 'and one burn');
  // never answered: kept; another character's gold waits; its own settles into its own region
  const dark = { ...real, exchange: async (m, r) => { await real.exchange(m, r); return { ok: false, error: 'offline' }; } };
  const b3 = createMarksBook({ door: dark, store, character: () => playing });
  assert.equal((await b3.sell(30, credit, 5)).text, MARKS_TEXT.kept);
  assert.ok(store._m.has(MARKS_PENDING_KEY));
  assert.equal((await b3.sell(1, credit, 5)).text, MARKS_TEXT.kept, 'one sale at a time - the last settles first');
  playing = 'char-other';
  const b4 = createMarksBook({ door: real, store, character: () => playing });
  assert.equal(await b4.settle(credit), null, 'another character\'s gold waits for it');
  playing = 'char-anna';
  assert.equal(await b4.settle(credit), MARKS_TEXT.settled(30, 240));
  assert.deepEqual([accounts[5].accountGold, store._m.has(MARKS_PENDING_KEY)], [240, false], 'paid into the region it was sold in, and let go');
  assert.equal((await b4.refresh()).data.balance, 820, 'burnt once: 1000 - 100 - 50 - 30');
  // a refusal keeps nothing and pays nothing
  clock = (T0 + DAY) * 1000;
  assert.equal((await b4.sell(300, credit, 5)).gold, 2400);
  assert.equal((await b4.sell(1, credit, 5)).text, REFUSALS['marks-bank-cap']);
  assert.equal(store._m.has(MARKS_PENDING_KEY), false);
  assert.equal(accounts[5].accountGold, 2640);
});

test('MARKS1 the Bank window: "Sell Marks" is the port\'s own entry - open with Marks held and nothing kept; Enter sells what was typed; the box counts until the service answers, and cannot be dismissed while it does', async () => {
  const accounts = createBankAccounts(62);
  let held = 500, pending = false;
  const asked = [];
  let answer;
  const w = new BankWindow({
    accounts: () => accounts, regionIndex: () => 17, player: {}, rows: () => [],
    marks: { open: () => true, balance: () => held, today: () => ({ exchanged: 0 }), pending: () => pending },
    sellMarks: (n) => { asked.push(n); return new Promise((res) => { answer = res; }); },
  });
  assert.equal(w.enabled('sellMarks'), true);
  held = 0; assert.equal(w.enabled('sellMarks'), false, 'nothing to sell'); held = 500;
  pending = true; assert.equal(w.enabled('sellMarks'), false, 'a kept sale settles first'); pending = false;
  w._button('sellMarks');
  assert.equal(w.transactionType, MARKS_ENTRY);
  w.value = '120';
  w.input('Enter');
  assert.deepEqual(asked, [120]);
  assert.equal(w.box.rows[0].text, MARKS_COUNTING);
  w.input('Space');
  assert.equal(w.box.rows[0].text, MARKS_COUNTING, 'the counting box stays');
  answer({ ok: true, text: MARKS_TEXT.sold(120, 960) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(w.box.rows[0].text, MARKS_TEXT.sold(120, 960));
  w.input('Space');
  assert.equal(w.box, null);
  const offline = new BankWindow({ accounts: () => accounts, regionIndex: () => 17, player: {}, rows: () => [] });
  assert.equal(offline.enabled('sellMarks'), false, 'offline the Bank buys no Drakes');
  assert.equal(creditMarksSale(accounts, 3, 0), 0, 'a sale of nothing pays nothing');
});

test('MARKS1 the gate\'s line: a counted gate says the Marks struck, or that the day\'s two are done', async () => {
  const said = [];
  const book = createMarksBook({ door: {} });
  assert.equal(book.strikeLine({ struck: 50, balance: 150 }), MARKS_TEXT.struck(50, 150));
  assert.equal(book.state.balance, 150);
  assert.equal(book.strikeLine({ struck: 0, balance: 150, why: 'cap' }), MARKS_TEXT.capped);
  assert.equal(book.strikeLine({ struck: 0, balance: 150, why: 'full' }), null);
  assert.equal(book.strikeLine(null), null);
  const { priv } = await gatePair();
  const receipt = await receiptFor('acct-me', 700, priv, Math.floor(Date.now() / 1000));
  const claims = createGateClaims({
    claim: async () => ({ ok: true, data: { recorded: true, closed: 4, marks: { struck: 50, balance: 200 } } }),
    me: () => 'acct-me', say: (x) => said.push(x), onMarks: (m) => book.strikeLine(m),
  });
  claims.add(receipt);
  await claims.flush();
  assert.deepEqual(said, ['Breach recorded. Breaches closed: 4.', MARKS_TEXT.struck(50, 200)]);   // WB13b
});

test('MARKS1 the wiring: online the streaming host holds the book and hands it to the Bank, the guild and the gate; the Bank face, the Guild tab and the account card show Marks', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const marksBook = params\.has\('online'\)\n\s*\? createMarksBook\(\{ door: accountMarks\(/);
  assert.match(w, /marks: marksBook,   \/\/ MARKS1: the Bank of the Empire's Marks, online/);
  assert.match(w, /marks: marksBook,   \/\/ MARKS1: the guild's Marks treasury/);
  // PIN MOVED (SILVER-WAYS): the gate's lines and the raid's, the strike's and a guild deed's, in the book's own words
  // HAUL-CARDS (PIN MOVED): the book's lines said as ever, its cards shown beside them (ui/haulCards.js claimHauls)
  assert.match(w, /onMarks: \(marks, data\) => \{ showHaul\(claimHauls\(data \?\? \{ marks \}, 'gate'\)\); return marksBook\?\.claimLines\(data \?\? \{ marks \}, 'gate'\) \?\? null; \},/);
  assert.match(w, /onMarks: \(data\) => \{ showHaul\(claimHauls\(data, 'raid'\)\); return marksBook\?\.claimLines\(data, 'raid'\) \?\? null; \},/);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /sellMarks: host\.marks \? \(n\) => host\.marks\.sell\(n, marksSaleCredit\(\(\) => playerEntity\.bankAccounts, bankRegion, host\.saveSoon\), bankRegion\(\)\) : null,/);
  assert.match(m, /void host\.marks\.settle\(marksSaleCredit\(\(\) => playerEntity\.bankAccounts, bankRegion, host\.saveSoon\)\)/, 'a kept sale settles as the counter opens');
  assert.match(src('src/ui/enhancedPorts.js'), /\{ label: w\.hooks\.marks\.pending\(\) \? 'Counting a sale\.\.\.' : 'Sell silver', act: \(\) => w\._button\('sellMarks'\)/);
  assert.match(src('src/ui/socialPanel.js'), /if \(g\.marks\?\.state\?\.open === true\) \{\n\s*out\.push\(el\('div', 'dfsocial-sec', 'Silver treasury'\)\);/);
  assert.match(src('src/ui/enhancedAccount.js'), /if \(Number\.isSafeInteger\(flow\.account\.marks\)\) row\('Silver', marksText\(flow\.account\.marks\)\);/);
});
