// STOREFRONT, AUDIT LANE 5 (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): THE RESONANT MAUL'S DAY, THE SERVICE'S -
// through the real Worker on node:sqlite (test/accountDb.mjs) and the page's own door (net/accountClient.js
// accountSeasonMaul). A yes once a UTC day an account, inside the Heart stage alone, on the service's clock; the same ask
// asked again (its answer lost) a yes again; any other ask that day `taken`. The page had kept the day in its own store.
// tools/mutants/storefront_seasonaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { PROGRESS_ROUTES, progressSpentOf } from '../../server-account/src/progress.js';
import { claimMaul, MAUL_RID_RE, MAUL_STAGE_KEY, SEASON_MAUL_STATUS } from '../../server-account/src/seasonClaim.js';
import { accountSeasonMaul, SESSION_KEY } from '../../src/net/accountClient.js';
import { passSeasonById } from '../../src/net/battlePassLaw.js';
import { HEART_STAGE } from '../../src/systems/pass/seasonWorld.js';

const S1 = passSeasonById('s1');
const IN_HALLS = S1.stages[1].fromMs + 3_600_000;
const IN_HEART = S1.stages[2].fromMs + 3_600_000;
const DAY_MS = 86_400_000;
const rid = (n) => n.toString(16).padStart(16, '0');

test('AUDIT LANE 5 (2): the Maul\'s day through the Worker - a yes once a UTC day an account, inside the Heart stage; the same ask again a yes; another ask that day taken; a guest, a bad id and another stage refused (mutants: a second ask the same day takes the day; the stage unread; the lost answer refused)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_HALLS });
  const s = await standService();
  const me = await s.seated('Hammer'), other = await s.seated('Anvil');   // a realm character's seat (progress.js INT16 asks it of a progression claim)
  const ask = (who, r) => s.call('/v1/season/maul', { rid: r }, who.secret);
  assert.deepEqual(await ask(me, rid(1)), { status: 409, body: { error: 'closed' } }, 'the Brass Halls: no Colossus wakes');
  t.mock.timers.setTime(IN_HEART);
  const day = Math.floor(IN_HEART / DAY_MS);
  assert.deepEqual(await ask(me, rid(1)), { status: 200, body: { ok: true, day } });
  assert.deepEqual(await ask(me, rid(1)), { status: 200, body: { ok: true, day } }, 'its answer lost: asked again, a yes again');
  assert.deepEqual(await ask(me, rid(2)), { status: 409, body: { error: 'taken' } }, 'a second Colossus the same day');
  assert.deepEqual(await ask(other, rid(2)), { status: 200, body: { ok: true, day } }, 'another account\'s own day');
  assert.deepEqual(await ask(me, 'nope'), { status: 400, body: { error: 'rid' } });
  t.mock.timers.setTime(IN_HEART + DAY_MS);
  assert.deepEqual(await ask(me, rid(3)), { status: 200, body: { ok: true, day: day + 1 } }, 'the next UTC day');
  t.mock.timers.setTime(S1.toMs + 1000);
  assert.deepEqual(await ask(me, rid(4)), { status: 409, body: { error: 'closed' } }, 'the season over');
  const g = await s.guest();
  t.mock.timers.setTime(IN_HEART);
  assert.equal((await s.call('/v1/season/maul', { rid: rid(5) }, g.secret)).status, 403, 'a guest');
  assert.deepEqual(s.env.DB._raw.prepare('SELECT day, season, rid FROM season_mauls WHERE account = ? ORDER BY day').all(me.id).map((r) => ({ ...r })), [{ day, season: 's1', rid: rid(1) }, { day: day + 1, season: 's1', rid: rid(3) }]);
  assert.ok(ROUTES.has('/v1/season/maul'));
  assert.equal(S1.stages[HEART_STAGE].key, MAUL_STAGE_KEY, 'the world\'s Heart stage is the claim\'s');
  assert.deepEqual([SEASON_MAUL_STATUS.taken, SEASON_MAUL_STATUS.guest], [409, 403]);
  assert.ok(MAUL_RID_RE.test(rid(9)));
  assert.deepEqual(await claimMaul({ db: s.env.DB, nowS: Math.floor(IN_HEART / 1000) }, { id: 'x', handle: null }, { rid: rid(1) }), { error: 'guest' });
});

test('AUDIT LANE 5 (2): the page\'s door - its session\'s account asks with the ask\'s id; no session is no ask (mutants: the ask\'s id unsent)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_HEART });
  const s = await standService();
  const me = await s.seated('Striker');
  const io = { fetch: (u, i) => s.fetch(String(u).replace(/^.*?\/v1\//, 'https://accounts.invalid/v1/'), i), storage: sessionStorageOf(SESSION_KEY, me) };
  const door = accountSeasonMaul(io);
  const yes = await door.claim(rid(7));
  assert.equal(yes.ok, true, JSON.stringify(yes));
  assert.equal(yes.data.day, Math.floor(IN_HEART / DAY_MS));
  const again = await door.claim(rid(8));
  assert.deepEqual([again.ok, again.error, again.status], [false, 'taken', 409]);
  const none = await accountSeasonMaul({ fetch: io.fetch, storage: { getItem: () => null } }).claim(rid(9));
  assert.deepEqual(none, { ok: false, error: 'no-session' });
});

test('AUDIT-STOREFRONT the Maul\'s day is a progression claim, as the season\'s finds are - a registered account with no seated realm character refused before the route reads a word, on the pass\'s stream; its answer spends nothing (mutants: the route no claim)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_HEART });
  const s = await standService();
  assert.deepEqual(PROGRESS_ROUTES['/v1/season/maul'], ['pass', false], 'names no character: the account\'s seat is asked');
  const bare = await s.registered('Scripted');
  const no = await s.call('/v1/season/maul', { rid: rid(1) }, bare.secret);
  assert.deepEqual([no.status, no.body?.error], [403, 'progress-seat'], 'a session\'s secret alone, no game played');
  assert.equal(s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM season_mauls').get().n, 0, 'nothing taken');
  const me = await s.seated('Hammer');
  const yes = await s.call('/v1/season/maul', { rid: rid(1) }, me.secret);
  assert.equal(yes.status, 200);
  assert.deepEqual(progressSpentOf('/v1/season/maul', yes.body), [], 'the UTC day its bound - no bucket spent');
});
