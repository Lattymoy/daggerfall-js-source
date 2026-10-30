// AUDIT-STOREFRONT III (lane C, C13, 2026-10-30): THE AURUM SPENT IN A FOLIO, AS THE SERVICE KEEPS IT. An open folio
// said "6,400 Aurum spent" to an Admin, who holds every item (ADMIN-ALL, derived) and spent nothing: the window counted
// what was held. The pass's card now says each folio's spending off the ledger's `panel` lines - what was paid, not what
// the items cost today - and the window says that; a page still opens by what is held.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { passOf } from '../../server-account/src/battlePass.js';
import { passCardOf, passSeasonById, passItemOf, PASS_PREMIUM_AURUM } from '../../src/net/battlePassLaw.js';

const S1 = passSeasonById('s1');
const NOW = S1.fromMs + 5 * 86_400_000;
const ON = { PASS_OPEN: 'on', AURUM_OPEN: 'on', DEVELOPER_HANDLES: 'admin1' };

test('AUDIT-STOREFRONT III C13: the pass\'s card says each folio\'s Aurum spent off the ledger - a buyer\'s what it paid in each folio, an Admin\'s nothing though it holds every item, another season\'s lines never counted (mutants: the spent left out; read off what is held; an item\'s line counted to the wrong folio)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await standService(ON);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const give = (who, n) => raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', ?, ?, 0, 0)").run(who.id, `g${Math.random()}`, n);
  const me = await s.registered('Buyer');
  give(me, 5000);
  assert.equal((await ask(me, '/v1/pass/buy', { season: 's1', grant: 'glyph:cog' })).status, 200);
  assert.equal((await ask(me, '/v1/pass/unlock', { season: 's1' })).status, 200);
  const gilded = 'glyph:tonalfork';
  assert.equal(passItemOf('s1', gilded)?.track, 'premium', 'a Gilded Folio item');
  assert.equal((await ask(me, '/v1/pass/buy', { season: 's1', grant: gilded })).status, 200);
  raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'panel', 's0:glyph:cog', -999, 0, 0)").run(me.id);   // another season's
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  const player = (who) => raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);
  const mine = await passOf(ctx(), player(me), ON);
  assert.deepEqual(mine.spent, { free: passItemOf('s1', 'glyph:cog').aurum, premium: passItemOf('s1', gilded).aurum }, 'the unlock is no folio\'s spending');
  assert.deepEqual(passCardOf(mine).spent, mine.spent, 'the client takes it');
  raw.prepare("UPDATE aurum_ledger SET amount = -150 WHERE account = ? AND kind = 'panel' AND ref = 's1:glyph:cog'").run(me.id);
  assert.equal((await passOf(ctx(), player(me), ON)).spent.free, 150, 'what was paid, never today\'s price');
  const admin = await s.registered('Admin1');
  const card = await passOf(ctx(), player(admin), ON);
  assert.equal(card.tracks.premium, true);
  assert.ok(card.bought.length > 10, 'an Admin holds every item');
  assert.deepEqual(card.spent, { free: 0, premium: 0 }, 'and spent nothing');
  assert.ok(PASS_PREMIUM_AURUM.s1 > 0);
});
