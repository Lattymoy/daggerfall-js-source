// AUDIT RPT1026 lane A (SECNET), the account service's half (bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md,
// RPT1026-SECNET RECOVERY HOLDS): through the real service over the real migrations (test/accountDb.mjs), on a database
// that HOLDS one request between two of its statements while another runs whole - the interleaving two Worker requests
// on one D1 meet (test/server/rpt1026_secnet.test.js's harness, the same shape).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';

/** `hold(re)`: the next statement whose SQL matches `re` waits until `h.go()`; `h.at` resolves as it starts waiting. */
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

const live = async (S, secret) => (await S.fetch('https://accounts.invalid/v1/account', { method: 'GET', headers: { authorization: `Bearer ${secret}` } })).status === 200;
const signsIn = async (S, handle, password) => (await S.call('/v1/auth/login', { handle, password })).status === 200;

test('AUDIT RPT1026 A3 A RECOVERY\'S SIGN-OUT STANDS ON ITS OWN PASSWORD: of two recoveries with two of the set\'s codes, the first held at its sign-out of every device while the second runs whole, the second\'s session - answered 200 - is not then deleted by the first (it signed out every device that stood before it; the first hears codes-moved and opens none); a recovery alone still signs out every device (mutant: the sign-out by the account\'s id alone)', async () => {
  const S = await standService();
  const g = (await S.call('/v1/auth/guest', { ...ACCEPTED })).body;
  const reg = await S.call('/v1/auth/register', { handle: 'Twocodes', password: 'the first password', ...ACCEPTED, set: true }, g.secret);
  assert.equal(reg.status, 200);
  const codes = reg.body.recoveryCodes;
  const thief = (await S.call('/v1/auth/login', { handle: 'Twocodes', password: 'the first password' })).body.secret;
  const hold = holding(S);
  const h = hold(/^DELETE FROM sessions WHERE player_id = \?/);
  const first = S.call('/v1/auth/recover', { handle: 'Twocodes', code: codes[0], password: 'the first recovery', set: true });
  await h.at;
  const second = await S.call('/v1/auth/recover', { handle: 'Twocodes', code: codes[1], password: 'the second recovery', set: true });
  assert.equal(second.status, 200, 'the second recovery is answered with a session');
  h.go();
  const one = await first;
  assert.deepEqual([one.status, one.body.error], [409, 'codes-moved']);
  assert.equal(await live(S, second.body.secret), true, 'the session the second recovery answered stands');
  assert.equal(await live(S, thief), false, 'and every device from before it is signed out');
  assert.equal(await signsIn(S, 'Twocodes', 'the second recovery'), true);
  // a recovery alone: every device before it signed out, its own session opened
  const other = (await S.call('/v1/auth/login', { handle: 'Twocodes', password: 'the second recovery' })).body.secret;
  const third = await S.call('/v1/auth/recover', { handle: 'Twocodes', code: codes[2], password: 'the third recovery', set: true });
  assert.equal(third.status, 200);
  assert.equal(await live(S, other), false);
  assert.equal(await live(S, second.body.secret), false);
  assert.equal(await live(S, third.body.secret), true);
});
