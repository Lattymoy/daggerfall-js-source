import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedTrade, TRADE_COST_WORD, tradeGoldText } from '../../src/ui/enhanced/enhancedTrade.js';
import { tradeCost, getTradePrice } from '../../src/systems/tradeModes.js';
import { stockShopShelf } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';

const said = (n) => (n.textContent || '') + (n.children ?? []).map(said).join('');
const find = (root, sel, txt = null) => root.querySelectorAll(sel).find((n) => txt == null || n.textContent === txt) ?? null;
const ctx = { quality: 6, priceAdjustment: 1000, skills: { mercantile: 30, personality: 40 } };

test('SELL-SHOWN the counter\'s "You get" is the keeper\'s offer and the deal\'s pay - the haggled price, not the lot\'s raw cost; "To pay" likewise (mutant: the footer back on the raw cost)', () => {
  for (const mode of ['Sell', 'Buy']) {
    withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const pack = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 10 }, {}, { rolls: () => 0, torchesFromItems: false }).slice(0, 4);
      const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 10 }, {}, { rolls: () => 0, torchesFromItems: false }).slice(0, 4);
      const paid = [];
      const view = mountEnhancedTrade(host, { mode, shopName: 'The Shop', shelfItems: () => shelf, packItems: () => pack, accepts: () => true,
        enchanted: () => false, priceCtx: () => ctx, gold: () => 1e9, commit: (m, staged, price) => { paid.push(price); } });
      const side = mode === 'Sell' ? '.packlocal' : '.packremote';
      const lot = [];
      for (let i = 0; i < 3; i++) {
        const row = find(host, side)?.querySelectorAll('.itemrow')[0] ?? host.querySelectorAll('.itemrow').find((r) => (mode === 'Sell' ? pack : shelf).includes(r._tradeItem));
        lot.push(row._tradeItem);
        row.onclick({ timeStamp: 1000 * i });
        row.onclick({ timeStamp: 1000 * i + 10 });
      }
      const { cost, pieces, resale } = tradeCost(mode, lot, ctx);
      const price = getTradePrice(mode, cost, ctx.quality, ctx.skills, pieces, resale);
      assert.ok(cost > 0 && price !== cost, `${mode}: the haggle moves the figure (cost ${cost}, price ${price})`);
      const fig = host.querySelectorAll('.trade-fig')[0];
      assert.equal(fig.children[0].textContent, TRADE_COST_WORD[mode]);
      assert.equal(fig.children[1].textContent, tradeGoldText(price), `${mode}: the footer shows the keeper's price`);
      find(host, '.act.primary').onclick();
      assert.ok(said(host).includes(String(price)), `${mode}: the keeper offers the same figure`);
      view.unmount();
    });
  }
});
