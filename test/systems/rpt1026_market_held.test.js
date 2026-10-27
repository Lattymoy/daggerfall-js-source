// RPT1026-MARKET HOLD-SAID (private reports 2026-10-26): gathering stopped overnight under a notice that named only a
// trade freeze, with no reason and no road to anyone who could help; another found crafting and gathering counted as
// trading, and asked for clearer messages and a clearer account state. A hold
// refuses every progression claim (server-account/src/progress.js seatRefusalOf over PROGRESS_ROUTES), so every notice says
// the three a player meets; staff's says how to reach them; and a `trade-held` refusal anywhere - a harvest's, a craft's -
// says the standing hold's own notice (its reason, its piece, its end), the session's word through the realm holds' host.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TRADE_HELD_NOTICES, tradeHeldLawNotice, tradeHeldUntilNotice, tradeHeldSaid, realmTradeRefusalText } from '../../src/net/realm/realmTradeLaw.js';
import { tradeHeldNotice, TRADE_OPEN_NOTICE } from '../../src/systems/item/itemIds.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { wireRealmHolds } from '../../src/scenes/realmHoldHost.js';
import { PROGRESS_ROUTES, seatRefusalOf } from '../../server-account/src/progress.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';

const FROZEN = /trading, gathering and crafting/;
const refusal = () => { const r = accountRefusalText('trade-held'); return typeof r === 'function' ? r() : r; };

test('RPT1026-MARKET HOLD-SAID: what a hold refuses is what its words say - the seat\'s law refuses a harvest and every craft of a held character, and every notice (the law\'s, the budget\'s, staff\'s, a timed one\'s, the law\'s with its piece) names trading, gathering and crafting (mutants: a notice back to "Trading is frozen"; the timed one\'s three dropped)', () => {
  // the law the words speak for: a held seat's claims are refused, a harvest and a craft among them
  for (const route of ['/v1/prof/harvest', '/v1/prof/smelt', '/v1/prof/craft', '/v1/prof/brew', '/v1/writs/deliver']) assert.ok(PROGRESS_ROUTES[route], route);
  assert.deepEqual(seatRefusalOf({ id: 'r1', held: 'staff' }, { named: true, character: 'r1' }), { error: 'trade-held', held: 'staff' });
  for (const k of ['law', 'budget', 'staff']) assert.match(TRADE_HELD_NOTICES[k], FROZEN, k);
  assert.match(tradeHeldLawNotice(templateByIndex(113).name), FROZEN);
  assert.match(tradeHeldUntilNotice(1_800_000_000), /^This character has been held 3 times\. Its trading, gathering and crafting are frozen until .*, then reopen on their own\.$/);
  assert.match(tradeHeldUntilNotice(1_800_000_000, 'Ring'), /the last over a Ring it carries\. Its trading, gathering and crafting are frozen until .*, and after that until the Ring is gone\.$/);
  assert.equal(tradeHeldNotice('staff', null), TRADE_OPEN_NOTICE);
  assert.equal(TRADE_OPEN_NOTICE, 'This character\'s trading, gathering and crafting are open again.');
});

test('RPT1026-MARKET HOLD-SAID: a staff hold says how to reach staff - a private report with /bug, or the game\'s Discord - and never the staff\'s note; the automatic holds keep their reasons, and a staff note is said nowhere (mutants: staff\'s contact dropped)', () => {
  assert.equal(TRADE_HELD_NOTICES.staff, 'The realm\'s staff have frozen this character\'s trading, gathering and crafting. To ask why, send them a private report with /bug, or ask on the game\'s Discord.');
  assert.match(TRADE_HELD_NOTICES.law, /it carries an item the game could not have made/);
  assert.match(TRADE_HELD_NOTICES.budget, /its wealth grew faster than play could earn it/);
  assert.match(realmTradeRefusalText('trade-held', 'mine', 'staff'), /\/bug.*Discord.*Nothing was traded\.$/, 'a trade it refused says it again');
});

test('RPT1026-MARKET HOLD-SAID: a `trade-held` refusal - a harvest\'s, a craft\'s - says the standing hold\'s own notice as the session last heard it: staff\'s with its contact, a timed law hold with its end and its piece; offline, or no hold heard, what a hold freezes (mutants: the refusal\'s generic words alone; the provider never wired; the provider kept past the session)', () => {
  const session = { tradeHeld: 'staff', tradeHeldWhy: null, lockedKeys: [], landedText: null };
  wireRealmHolds(session, { say: () => {}, entity: { items: [] } });
  try {
    assert.equal(refusal(), TRADE_HELD_NOTICES.staff, 'staff\'s hold, and how to reach them');
    session.tradeHeld = 'law';
    session.tradeHeldWhy = { code: 'until', t: null, until: 1_800_000_000 };
    assert.equal(refusal(), tradeHeldUntilNotice(1_800_000_000), 'a timed hold, with its end');
    session.tradeHeld = undefined;
    assert.equal(tradeHeldSaid(), null, 'no answer has said one yet');
    assert.match(refusal(), /^This character's trading, gathering and crafting are frozen\. The notice shown when it froze says why, and until when\.$/);
  } finally { wireRealmHolds(null, { say: () => {}, entity: null }); }
  session.tradeHeld = 'staff';
  assert.equal(tradeHeldSaid(), null, 'offline: none - the session left behind says nothing');
  assert.match(refusal(), FROZEN);
});
