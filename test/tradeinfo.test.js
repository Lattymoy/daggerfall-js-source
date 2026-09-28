// TRADE-INFO + TRADE-FIT (2026-09-27, Discord - Tabitha: "General Trade Improvements" - "magic item stats on the trade
// hover (own and other's)", "Show enchantment stats in the inventory and trade - Enhanced+ doesn't show enchants").
//
// AN ITEM'S MAGIC IN WORDS, ONE LIST (ui/enhancedInventory.js itemPowerLines): the tier's lines (lootRarity
// rarityLines - a rolled item's affixes and enchantments), and for an enchanted item the tier list does not name - DFU's
// own magic items and the item maker's carry no `rarity`, and with the tiers off it names none - DFU's own Info box
// powers (itemPowers magicPowersLines), "Powers unknown." until it is identified. The Enhanced card, the trade row's
// hover and the trade detail read it. And AN OFFER IS ONE FRAME (net/tradeSession.js setOffer): an offer over
// TRADE_FRAME_MAX was never sent, and the trade ended "timed out" - it is refused in words now, before anything moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemPowerLines } from '../src/ui/enhancedInventory.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { POWERS_UNKNOWN_TEXT } from '../src/systems/itemPowers.js';
import { createTradeManager, inTradeRange, OFFER_TOO_BIG_TEXT, tradeFrameBytes } from '../src/net/tradeSession.js';
import { validTradeData, TRADE_FRAME_MAX, TRADE_DATA_MAX, TRADE_REV_MAX } from '../src/net/wire.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tiers = (on, fn) => { setPref(LOOT_RARITY_KEY, on); try { return fn(); } finally { setPref(LOOT_RARITY_KEY, false); } };
// a DFU magic longsword: Potent vs Daedra and Feather weight - no `rarity`, as a shop's or the item maker's is
const dfu = (over = {}) => ({ templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [{ type: 4, param: 1 }, { type: 11, param: -1 }], isIdentified: true, ...over });

test('TRADE-INFO itemPowerLines: a DFU magic item names its powers in DFU\'s own words, tiers on or off; "Powers unknown." until it is identified (the tiers\' "Unidentified" stands alone); a plain item says nothing (mutants: the DFU powers never read; read for an item the tiers already name; read unidentified)', () => {
  assert.deepEqual(tiers(false, () => itemPowerLines(dfu(), {})), ['Potent vs Daedra', 'Feather weight'], 'Enhanced+ with the tiers off: the powers');
  assert.deepEqual(tiers(true, () => itemPowerLines(dfu(), {})), ['Magic', 'Potent vs Daedra', 'Feather weight'], 'the tier, then the powers');
  assert.deepEqual(tiers(false, () => itemPowerLines(dfu({ isIdentified: false }), {})), [POWERS_UNKNOWN_TEXT]);
  assert.deepEqual(tiers(true, () => itemPowerLines(dfu({ isIdentified: false }), {})), ['Magic', 'Unidentified'], 'the tier list\'s own word, not a second one');
  assert.deepEqual(tiers(false, () => itemPowerLines({ templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [] }, {})), []);
  // a rolled item: the tier list names its enchantments; the DFU list is not read beside it
  const rolled = dfu({ rarity: 'rare' });
  const withTiers = tiers(true, () => itemPowerLines(rolled, {}));
  assert.equal(withTiers.includes('Potent vs Daedra'), false, 'the tiers\' wording, never both');
});

test('TRADE-INFO the surfaces: the Enhanced card, the trade row\'s hover and the trade detail read the one list (mutants: a surface on rarityLines alone)', () => {
  const inv = src('src/ui/enhancedInventory.js');
  assert.match(inv, /\{ const lines = itemPowerLines\(picked, deps, \{ set: false \}\); if \(lines\.length\) \{ const ul = el\('ul', 'rarity'\);/);
  const t = src('src/ui/enhancedPlayerTrade.js');
  assert.match(t, /const powers = itemPowerLines\(item, deps\);\n\s*b\.title = \[line\.name, \.\.\.powers\]\.join\('\\n'\);/, 'the row\'s hover - mine and theirs alike');
  assert.match(t, /const powers = itemPowerLines\(selected\.item, deps\);\n\s*if \(powers\.length\) \{ const ul = el\('ul', 'rarity'\);/, 'and the detail, a line each');
});

/** A fake pack whose wire records carry `bytes` of payload each - an enchanted item's weight on the wire. */
function makePack(ids, bytes) {
  const st = { items: ids.map((id) => ({ id, stackCount: 1 })), gold: 100 };
  return {
    st,
    offerable: () => null,
    wire: (entries) => entries.map(({ item, count }) => ({ id: item.id, n: count, fx: 'x'.repeat(bytes) })),
    unwire: (recs) => recs.map((r) => ({ id: r.id, stackCount: r.n })),
    take: () => null, restore() {}, give() {}, fits: () => true, gold: () => st.gold,
  };
}
function rig(bytes) {
  const q = [];
  const mk = (id, other, otherId, pack) => createTradeManager({
    pack, now: () => 0, say() {}, peerName: () => other, selfId: () => id,
    send: (d) => { const v = validTradeData(d); if (!v) return false; if (tradeFrameBytes(v) > TRADE_FRAME_MAX) return false; q.push({ to: v.to, from: id, d: v }); return true; },
    near: () => inTradeRange([0, 0, 0], [1, 0, 0]), open() {},
  });
  const packA = makePack(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'], bytes);
  const A = mk('peerAAAA', 'B', 'peerBBBB', packA), B = mk('peerBBBB', 'A', 'peerAAAA', makePack(['b1'], bytes));
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  A.request('peerBBBB'); pump(); B.request('peerAAAA'); pump();
  return { A, B, packA, q, pump };
}

test('TRADE-FIT an offer too big for one trade frame is refused in words before anything moves - where it waited in the outbox until the trade "timed out" - and one that fits goes as ever (mutants: the size never read; read without the wrapper)', () => {
  const r = rig(1400);   // ~1.4 KB an item on the wire: eight of them are over the 12 KB frame
  const items = r.packA.st.items;
  assert.ok(r.A.session && r.B.session, 'the session is open');
  const small = r.A.session.setOffer(items.slice(0, 3).map((item) => ({ item, count: 1 })));
  assert.deepEqual(small, { ok: true });
  r.pump();
  assert.equal(r.B.session.theirs.items.length, 3, 'three went across');
  const big = r.A.session.setOffer(items.slice(0, 9).map((item) => ({ item, count: 1 })));
  assert.deepEqual(big, { ok: false, why: OFFER_TOO_BIG_TEXT });
  assert.equal(r.A.session.mine.entries.length, 3, 'my offer stands as it was');
  r.pump();
  assert.equal(r.B.session.theirs.items.length, 3, 'and so does theirs of mine');
  assert.equal(r.A.session.phase, 'open', 'the trade is not over');
  assert.match(OFFER_TOO_BIG_TEXT, /offer fewer items/);
  assert.equal(tradeFrameBytes({ k: 'offer' }), JSON.stringify({ t: 'trade', data: { k: 'offer' } }).length, 'the frame as the relay reads it');
});

// ─── AUDIT (the batch's audit, agents D and F) ─────────────────────────────────────────────────────────────────────

test('AUDIT TRADE-FIT D1: an offer is measured by the COMMIT its goods will ride, as the wire\'s own cap reads it (validTradeData, TRADE_DATA_MAX) with the peer\'s revision at its most - the frame measure passed offers the socket refused, and one whose commit it refused after the peer\'s had left stranded the peer\'s goods; the bound is exact (mutants: the frame alone; the commit at the peer\'s revision now)', () => {
  const r = rig(0);
  const s = r.A.session;
  let len = 0;
  r.packA.wire = (entries) => entries.map(({ item, count }) => ({ id: item.id, n: count, fx: 'x'.repeat(len) }));
  const shape = (k, n, o = undefined) => ({ k, r: s.rev + 1, ...(o !== undefined ? { o } : {}), items: [{ id: 'a1', n: 1, fx: 'x'.repeat(n) }], g: 0, to: s.peer, s: s.sid });
  const fit = TRADE_DATA_MAX - JSON.stringify(validTradeData(shape('commit', 0, TRADE_REV_MAX))).length;
  assert.ok(validTradeData(shape('commit', fit, TRADE_REV_MAX)) && !validTradeData(shape('commit', fit + 1, TRADE_REV_MAX)), 'the wire\'s own bound, measured');
  len = fit + 1;
  assert.ok(validTradeData(shape('offer', len)) && tradeFrameBytes(validTradeData(shape('offer', len))) <= TRADE_FRAME_MAX, 'the offer alone rides the wire...');
  assert.ok(validTradeData(shape('commit', len, 0)), '...and a commit at the peer\'s revision now would too');
  assert.deepEqual(s.setOffer([{ item: r.packA.st.items[0], count: 1 }]), { ok: false, why: OFFER_TOO_BIG_TEXT }, 'refused: its commit at the longest does not');
  len = fit;
  assert.deepEqual(s.setOffer([{ item: r.packA.st.items[0], count: 1 }]), { ok: true }, 'its longest commit fits: it goes');
});

test('AUDIT TRADE-INFO D2 + D6: the trade window reads an artifact\'s powers where the pack\'s card does (TEXT.RSC through the host\'s `rows`); an item\'s two like powers are two lines, as the Info box says them (mutants: the trade window without the reader; every repeat dropped)', () => {
  assert.match(src('src/scenes/world.js'), /tradeWin = createPlayerTradeWindow\(session, \{ items: \(\) => \(playerEntity\.items \?\?= \[\]\), entity: playerEntity, gold: \(\) => tradePack\.gold\(\),\n\s*rows: \(id, pick\) => townTalk\.lines\(id, pick\) \}\);/);
  const twice = dfu({ enchantments: [{ type: 4, param: 1 }, { type: 4, param: 1 }, { type: 11, param: -1 }] });
  assert.deepEqual(tiers(false, () => itemPowerLines(twice, {})), ['Potent vs Daedra', 'Potent vs Daedra', 'Feather weight']);
});
