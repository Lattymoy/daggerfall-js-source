// AUDIT RPT1026 C4 (2026-10-27, lane C; bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md, RPT1026-LEDGERLAW STOLEN-SAID):
// A STOLEN PIECE ANOTHER PLAYER OFFERS IN A TRADE SAYS SO. STOLEN-SAID tagged the market's Goods rows and a hired
// trader's, and left the window two players trade in: a stolen piece the other player held out read like any other,
// though its theft rides the trade (systems/stolenGoods.js - the counter destroys it at its sale, the court takes it at a
// conviction). The piece is stolen by the theft's own law (takenFromKeeping), wired by its holder's real pack
// (systems/tradePack.js), received by a real session (net/tradeSession.js) and drawn by the real window
// (ui/enhanced/enhancedPlayerTrade.js) over the fake DOM the trade pins share (test/invdrag.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mountEnhancedPlayerTrade } from '../../src/ui/enhanced/enhancedPlayerTrade.js';
import { TradeSession } from '../../src/net/tradeSession.js';
import { createTradePack } from '../../src/systems/tradePack.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { takenFromKeeping, isStolen, stolenTag, stolenLine } from '../../src/systems/stolenGoods.js';
import { withDom } from '../invdrag.mjs';

const hero = (name, items = []) => ({ isPlayer: true, name, career: { name: 'Spellsword' }, level: 5, stats: { strength: 90, endurance: 90 }, activeEffects: [], spells: [], items, goldPieces: 500 });

test('AUDIT RPT1026 C4: a stolen piece the other player offers says Stolen on its row in their offer, and its strip says what taking it means; an honest piece says nothing (mutants: the row\'s word; the strip\'s line)', () => withDom((dom) => {
  const shelf = createWeapon(120, 1, () => 0.5);
  assert.equal(takenFromKeeping(new Set([shelf]), shelf, shelf), true, 'taken off a shut shop\'s shelf');
  const honest = createWeapon(116, 1, () => 0.5);
  const peer = hero('Brenna', [shelf, honest]);
  const records = createTradePack(peer).wire([{ item: shelf, count: 1 }, { item: honest, count: 1 }]);
  const me = hero('Aelwyn');
  const session = new TradeSession({ sid: 'auditc4', me: 'peerAAAA', peer: 'peerBBBB', peerName: 'Brenna', pack: createTradePack(me), send: () => true, near: () => true });
  session.receive({ s: 'auditc4', k: 'offer', r: 1, items: records, g: 0 });
  assert.deepEqual(session.theirs.items.map(isStolen), [true, false], 'the theft rides the offer');
  const host = dom.mk('div');
  dom.body.append(host);
  const view = mountEnhancedPlayerTrade(host, { session, deps: { items: () => me.items, entity: me, gold: () => me.goldPieces, onExit: () => {} } });
  const theirRows = () => host.querySelectorAll('.packremote').at(-1).querySelectorAll('.itemrow');   // the third column, theirs (mine is a .packremote too)
  const sub = (r) => r.querySelector('small')?.textContent ?? '';
  assert.equal(theirRows().length, 2);
  assert.deepEqual(theirRows().map((r) => sub(r).split(' · ').includes(stolenTag())), [true, false], 'the stolen piece\'s row alone');
  theirRows()[0].onclick({ timeStamp: 0 });
  const lines = () => (host.querySelector('.trade-detail-info')?.querySelectorAll('.meta') ?? []).map((p) => p.textContent);
  assert.ok(lines().includes(stolenLine()), 'picked: the counter\'s and the court\'s word');
  theirRows()[1].onclick({ timeStamp: 1000 });
  assert.equal(lines().includes(stolenLine()), false, 'an honest piece picked says nothing of it');
  view.unmount();
}));
