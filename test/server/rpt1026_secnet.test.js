// RPT1026-SECNET (from a private security report, 2026-10-20; bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md, A
// PASSWORD IS CHANGED WITH THE OLD ONE): THE RACES, through
// the real service over the real migrations (test/accountDb.mjs), on a database that HOLDS one request between two of its
// own statements while another runs whole - the interleaving two Worker requests on one D1 meet. Recovery signs every
// device out; nothing already under way when it lands may undo it: a password change, a sign-in (and its rehash), a
// second device admitted, a second recovery's loser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { hashPassword, needsRehash } from '../../server-account/src/password.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const OWNER = 'the first password', RECOVERED = 'the one the codes set', THIEF = 'the one a stranger chose';

/** The service's database made to HOLD: `hold(re)` - the next statement whose SQL matches `re` waits until `h.go()`, and
 *  `h.at` resolves as it starts waiting. One statement a hold; every other statement, and a batch, runs as it would. */
function holding(S) {
  const inner = S.env.DB, holds = [];
  S.env.DB = {
    _raw: inner._raw,
    prepare(sql) {
      const st = inner.prepare(sql);
      const held = (fn) => async (...a) => {
        const h = holds.find((x) => !x.spent && x.re.test(sql));
        if (h) { h.spent = true; h.reached(); await h.gate; }
        return fn(...a);
      };
      const api = { bind(...a) { st.bind(...a); return api; }, first: held(st.first), all: held(st.all), run: held(st.run), _result: () => st._result() };
      return api;
    },
    batch: (list) => inner.batch(list),
  };
  return (re) => {
    const h = { re, spent: false };
    h.gate = new Promise((r) => { h.go = r; });
    h.at = new Promise((r) => { h.reached = r; });
    holds.push(h);
    return h;
  };
}

/** A registered account with its set of codes, and a thief signed in with its password. */
async function victim(S, handle = 'Keepsake') {
  const g = (await S.call('/v1/auth/guest', { ...ACCEPTED })).body;
  const reg = await S.call('/v1/auth/register', { handle, password: OWNER, ...ACCEPTED, set: true }, g.secret);
  assert.equal(reg.status, 200);
  const thief = await S.call('/v1/auth/login', { handle, password: OWNER });
  assert.equal(thief.status, 200);
  return { id: g.id, handle, codes: reg.body.recoveryCodes, thief: thief.body.secret };
}
const signsIn = async (S, handle, password) => (await S.call('/v1/auth/login', { handle, password })).status === 200;
const live = async (S, secret) => (await S.fetch('https://accounts.invalid/v1/account', { method: 'GET', headers: { authorization: `Bearer ${secret}` } })).status === 200;
const sessionsOf = (S, id) => S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(id).n;
const recoverWith = (S, v, code, password) => S.call('/v1/auth/recover', { handle: v.handle, code, password, set: true });

test('RPT1026-SECNET THE CHANGE LANDS ON WHAT IT PROVED: a recovery that lands while a thief\'s password change is under way keeps the account - the change is refused, the owner\'s new password and session stand, the thief\'s password never works; a recovery between the change\'s write and its sign-out keeps its own session; a device signed out mid-change sets no password; of two changes at once the first keeps the account (mutants: the change\'s password unchecked; its session unchecked; the sign-out unconditional)', async () => {
  // the recovery lands before the change writes
  {
    const S = await standService();
    const v = await victim(S);
    const hold = holding(S);
    const h = hold(/^UPDATE players SET password = \? WHERE/);
    const change = S.call('/v1/account/password', { oldPassword: OWNER, password: THIEF }, v.thief);
    await h.at;
    const rec = await recoverWith(S, v, v.codes[0], RECOVERED);
    assert.equal(rec.status, 200, 'the owner recovers');
    h.go();
    const ch = await change;
    assert.deepEqual([ch.status, ch.body.error], [401, 'bad-login'], 'the change is refused - its old password is no longer the password');
    assert.equal(await signsIn(S, v.handle, RECOVERED), true, 'the owner\'s recovered password stands');
    assert.equal(await signsIn(S, v.handle, THIEF), false, 'the thief\'s never took');
    assert.equal(await live(S, rec.body.secret), true, 'the owner\'s recovery session stands');
    assert.equal(await live(S, v.thief), false, 'the thief is signed out');
  }
  // the recovery lands between the change's write and its sign-out of every other device
  {
    const S = await standService();
    const v = await victim(S);
    const hold = holding(S);
    const h = hold(/^DELETE FROM sessions WHERE player_id = \? AND id != \?/);
    const change = S.call('/v1/account/password', { oldPassword: OWNER, password: THIEF }, v.thief);
    await h.at;
    const rec = await recoverWith(S, v, v.codes[0], RECOVERED);
    assert.equal(rec.status, 200);
    h.go();
    await change;
    assert.equal(await live(S, rec.body.secret), true, 'the recovery\'s session outlives the change that came before it');
    assert.equal(await signsIn(S, v.handle, RECOVERED), true);
    assert.equal(await signsIn(S, v.handle, THIEF), false);
    assert.equal(await live(S, v.thief), false);
  }
  // "sign out of every device", pressed by the owner while the thief's change is under way: the thief's session is gone
  {
    const S = await standService();
    const v = await victim(S);
    const owner = (await S.call('/v1/auth/login', { handle: v.handle, password: OWNER })).body;
    const hold = holding(S);
    const h = hold(/^UPDATE players SET password = \? WHERE/);
    const change = S.call('/v1/account/password', { oldPassword: OWNER, password: THIEF }, v.thief);
    await h.at;
    assert.equal((await S.call('/v1/auth/logout', { all: true }, owner.secret)).status, 200);
    h.go();
    assert.equal((await change).status, 401, 'a device signed out sets no password');
    assert.equal(await signsIn(S, v.handle, OWNER), true);
    assert.equal(await signsIn(S, v.handle, THIEF), false);
  }
  // two changes at once from two devices, both proved against the same old password before either wrote - the thief's
  // held before its write, the owner's written and held before its sign-out: the thief's then finds the password moved
  {
    const S = await standService();
    const v = await victim(S);
    const owner = (await S.call('/v1/auth/login', { handle: v.handle, password: OWNER })).body;
    const hold = holding(S);
    const hThief = hold(/^UPDATE players SET password = \? WHERE/);
    const theirs = S.call('/v1/account/password', { oldPassword: OWNER, password: THIEF }, v.thief);
    await hThief.at;
    const hMine = hold(/^DELETE FROM sessions WHERE player_id = \? AND id != \?/);
    const mine = S.call('/v1/account/password', { oldPassword: OWNER, password: 'the owner chose again' }, owner.secret);
    await hMine.at;
    hThief.go();
    const t = await theirs;
    assert.deepEqual([t.status, t.body.error], [401, 'bad-login'], 'the password it proved the old one against is not the password any more');
    hMine.go();
    assert.equal((await mine).status, 200);
    assert.equal(await signsIn(S, v.handle, 'the owner chose again'), true, 'the change that wrote first keeps the account');
    assert.equal(await signsIn(S, v.handle, THIEF), false);
    assert.equal(await live(S, owner.secret), true);
    assert.equal(await live(S, v.thief), false, 'and it signed the other device out');
  }
});

test('RPT1026-SECNET A SIGN-IN STANDS ON THE HASH IT VERIFIED: one on the former password, still deriving as the recovery lands, opens no session (a recovery ends the session of every device, none excepted); on a hash due its rehash it writes nothing over the recovered password; and two honest sign-ins at once on such a hash both get in (mutants: the session unguarded; the rehash by id alone; the row never asked again)', async () => {
  // the old password, under way as the recovery lands
  {
    const S = await standService();
    const v = await victim(S);
    const hold = holding(S);
    const h = hold(/^DELETE FROM rate_limits/);   // past the password's derivation, before any write of its own
    const login = S.call('/v1/auth/login', { handle: v.handle, password: OWNER });
    await h.at;
    const rec = await recoverWith(S, v, v.codes[0], RECOVERED);
    assert.equal(rec.status, 200);
    h.go();
    const l = await login;
    assert.deepEqual([l.status, l.body.error], [401, 'bad-login'], 'refused - the password it typed is not the account\'s any more');
    assert.equal(sessionsOf(S, v.id), 1, 'the recovery\'s session alone');
    assert.equal(await live(S, rec.body.secret), true);
  }
  // the same on a hash written at an older cost
  {
    const S = await standService();
    const v = await victim(S);
    const stale = await hashPassword(OWNER, { subtle, rand }, 1000);
    assert.equal(needsRehash(stale), true);
    S.env.DB._raw.prepare('UPDATE players SET password = ? WHERE id = ?').run(stale, v.id);
    const hold = holding(S);
    const h = hold(/^DELETE FROM rate_limits/);
    const login = S.call('/v1/auth/login', { handle: v.handle, password: OWNER });
    await h.at;
    const rec = await recoverWith(S, v, v.codes[0], RECOVERED);
    assert.equal(rec.status, 200);
    h.go();
    assert.equal((await login).status, 401);
    assert.equal(await signsIn(S, v.handle, RECOVERED), true, 'the recovered password was not written over');
    assert.equal(await signsIn(S, v.handle, OWNER), false, 'and the old one is gone');
    assert.equal(sessionsOf(S, v.id), 2, 'the recovery\'s and the sign-in just made with the recovered password');
  }
  // two honest sign-ins of one account at once, its hash due a rehash: the second finds the first's rehash and is let in
  {
    const S = await standService();
    const v = await victim(S, 'Twodevice');
    S.env.DB._raw.prepare('UPDATE players SET password = ? WHERE id = ?').run(await hashPassword(OWNER, { subtle, rand }, 1000), v.id);
    const hold = holding(S);
    const h = hold(/^UPDATE players SET password = \? WHERE id = \? AND password = \?/);
    const first = S.call('/v1/auth/login', { handle: v.handle, password: OWNER });
    await h.at;
    const second = await S.call('/v1/auth/login', { handle: v.handle, password: OWNER });
    assert.equal(second.status, 200);
    h.go();
    const one = await first;
    assert.equal(one.status, 200, 'its rehash lost to the other\'s, and the password is still the one it typed');
    assert.equal(await live(S, one.body.secret), true);
    assert.equal(await live(S, second.body.secret), true);
    assert.equal(needsRehash(S.env.DB._raw.prepare('SELECT password FROM players WHERE id = ?').get(v.id).password), false);
  }
});

test('RPT1026-SECNET A DEVICE ADMITS ANOTHER ONLY WHILE IT IS IN: the thief\'s session asking for a second device as the recovery lands is refused, and a second recovery\'s session is never outlived by the first\'s (mutants: the new device unguarded; the recovery\'s session unguarded)', async () => {
  // a second device, asked by the thief's session
  {
    const S = await standService();
    const v = await victim(S);
    const hold = holding(S);
    const h = hold(/^INSERT INTO sessions/);
    const more = S.call('/v1/auth/session', { label: 'another' }, v.thief);
    await h.at;
    const rec = await recoverWith(S, v, v.codes[0], RECOVERED);
    assert.equal(rec.status, 200);
    h.go();
    const m = await more;
    assert.deepEqual([m.status, m.body.error], [401, 'auth'], 'the device that asked is signed out - it admits nobody');
    assert.equal(sessionsOf(S, v.id), 1, 'the recovery\'s session alone');
  }
  // two of the set's codes, two recoveries: the first held at its session, the second whole
  {
    const S = await standService();
    const v = await victim(S);
    const hold = holding(S);
    const h = hold(/^INSERT INTO sessions/);
    const first = recoverWith(S, v, v.codes[0], 'the first recovery');
    await h.at;
    const second = await recoverWith(S, v, v.codes[1], 'the second recovery');
    assert.equal(second.status, 200);
    h.go();
    const one = await first;
    assert.deepEqual([one.status, one.body.error], [409, 'codes-moved'], 'told to try again, as a code that lost a race is');
    assert.equal(sessionsOf(S, v.id), 1, 'the second recovery signed every device out, and nothing outlived it');
    assert.equal(await live(S, second.body.secret), true);
    assert.equal(await signsIn(S, v.handle, 'the second recovery'), true);
    assert.equal(await live(S, v.thief), false);
  }
});

test('RPT1026-SECNET nothing an honest player does alone moves: a sign-in, a change of password (every other device signed out, this one kept), a second device and a recovery', async () => {
  const S = await standService();
  const v = await victim(S, 'Honesta');
  const me = await S.call('/v1/auth/login', { handle: v.handle, password: OWNER });
  assert.equal(me.status, 200);
  const other = (await S.call('/v1/auth/session', { label: 'phone' }, me.body.secret));
  assert.equal(other.status, 200);
  assert.equal(await live(S, other.body.secret), true);
  const ch = await S.call('/v1/account/password', { oldPassword: OWNER, password: 'honest pass four' }, me.body.secret);
  assert.deepEqual([ch.status, ch.body], [200, { ok: true }]);
  assert.equal(await live(S, me.body.secret), true, 'the device that changed it stays');
  assert.equal(await live(S, other.body.secret), false, 'every other is signed out');
  assert.equal(await live(S, v.thief), false);
  assert.equal(await signsIn(S, v.handle, 'honest pass four'), true);
  const rec = await recoverWith(S, v, v.codes[0], 'honest pass five');
  assert.equal(rec.status, 200);
  assert.equal(sessionsOf(S, v.id), 1);
});
