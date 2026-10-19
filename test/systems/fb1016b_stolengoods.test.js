// STOLEN-GOODS (FIELD BUGS 2026-10-16b, the Discord's "A bug related to infinite..."): "you steal something from the
// shelf and can sell it back to an NPC, and he'll put the item back on the shelf again, and it just goes in a circle ...
// completely disrupts the economy ... Also, when you're sent to prison, all the stolen items stay with you and aren't
// taken away."
//
// Driven over the real producers and doors: a smith's and a general store's shelves as the shop stocks them
// (shopStock.js stockShopShelf), the real Steal on both skins (ui/native/nativeTrade.js, ui/enhanced/enhancedTrade.js), the real Sell
// window and its confirm, the real inventory windows over a shut shop's shelf (ui/native/nativeInventory.js,
// ui/enhanced/enhancedInventory.js), the save, the wire and a realm trade's record, and the real arrest flow and court
// (scenes/arrestFlow.js over systems/court.js) from the surrender to the release. The host's two sale arms and two theft
// targets (scenes/worldModes.js, which no test can stand up whole) are read by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { stockShopShelf } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARROW_TEMPLATE, addItem, splitStack } from '../../src/systems/inventory.js';
import { applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { NativeTradeWindow, TRADE_RECTS } from '../../src/ui/native/nativeTrade.js';
import { NativeInventoryWindow } from '../../src/ui/native/nativeInventory.js';
import { mountEnhancedTrade } from '../../src/ui/enhanced/enhancedTrade.js';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { withDom } from '../invdrag.mjs';
import { isStolen, landSold, confiscatedText, stolenLine } from '../../src/systems/stolenGoods.js';
import { ITEM_FIELDS } from '../../src/systems/item/itemFields.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { RECEIVER_MARKS, takeTradeGoods } from '../../src/net/realm/realmTradeLaw.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createArrestFlow } from '../../src/scenes/arrestFlow.js';
import { CRIMES, addGold, totalGoldAmount, THIEVES_GUILD_FACTION_ID } from '../../src/systems/court.js';
import { PrisonScreenWindow, PRISON_UPDATE_INTERVAL } from '../../src/ui/prisonScreen.js';
import { equipItem, equipTableOf, isEquipped } from '../../src/systems/equip.js';
import { isLightSource } from '../../src/systems/useItem.js';
import { setLightSource } from '../../src/systems/lightSource.js';
import { setSeed, getSeed, rand } from '../../src/formats/dfRandom.js';
// STOLEN-GOODS AUDIT (2026-10-16): the owner's keeping, the bag at a verdict, the room's word and the counter, the two
// theft arms that marked nothing, the patron
import { theftBasket, shopShelfTheft } from '../../src/systems/theft.js';
import { confiscateStolen } from '../../src/systems/court.js';
import { goldStack } from '../../src/systems/inventory.js';
import { applyInteriorLoot, interiorLootRecords } from '../../src/world/interior/interiorShared.js';
import { markCounterBought } from '../../src/systems/tradeModes.js';
import { patronTakes } from '../../src/net/patronLaw.js';
import { lawfulItem } from '../../src/systems/item/itemLaw.js';
import { isBagItem, hasBag } from '../../src/net/bagLaw.js';
import { mintCarried, heldOf } from '../../src/systems/materialsBag.js';
import { generateItems } from '../../src/systems/loot/loot.js';
import { sea } from '../navalSea.mjs';
import { GRAPPLE_S } from '../../src/systems/naval/navalBoarding.js';
import { isSalvage } from '../../src/systems/naval/navalPlunder.js';
import { STRUCK_GRACE_S } from '../../src/scenes/naval/navalHost.js';
import { SHIP_STATES } from '../../src/systems/naval/navalDamage.js';
import { navalHitData, NAVAL_HIT_MAX } from '../../src/systems/naval/navalWire.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const DAGGER = 113;

/** A weaponsmith's first shelf and a general store's, as worldModes.js openShelf stocks them. */
const smithShelf = () => stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 10 }, { items: [], level: 1 }, { rolls: () => 0.5, shelfIndex: 0, torchesFromItems: false });
const storeShelf = () => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, { items: [], level: 1 }, { rolls: () => 0.2, shelfIndex: 0, torchesFromItems: false });
const thief = (over = {}) => ({ name: 'Mack', stats: { strength: 80, endurance: 50, willpower: 50, personality: 50 }, items: [], bagItems: [], goldPieces: 0, level: 1, ...over });

/** The counter, as worldModes.js openTradeWindow hands it over: the live shelf and the live pack, the steal's sinks, and a
 *  Sell that concludes as commitTrade's Sell arm does (the coin to the counter, each piece out of the pack and to
 *  landSold - the host's one line, pinned by source below). */
function counter(mode, shelf, player, said = []) {
  return new NativeTradeWindow({
    mode, shelfItems: () => shelf, packItems: () => player.items, otherItems: () => [], isEquipped: (it) => isEquipped(it), accepts: () => true,
    enchanted: () => false, priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }),   // a region's par index
    gold: () => totalGoldAmount(player), rows: () => [], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e6 }),
    commit: (m, staged, price) => {
      addGold(player, price);
      for (const it of staged) { const i = player.items.indexOf(it); if (i >= 0) player.items.splice(i, 1); landSold(shelf, it); }
      return true;
    },
    icons: ICONS, entity: player, pickpocketSkill: () => 50, tallyPickpocket: () => {}, tallyCrimeGuild: () => {},
    crimeTheft: () => said.push('crime'), spawnCityGuards: () => {}, say: (l) => said.push(l),
  });
}
/** The real Steal (DoSteal), got away with: the pieces staged off the shelf, the button pressed, the roll a clean one. */
function steal(shelf, player, pieces) {
  const w = counter('Buy', shelf, player);
  for (const it of pieces) w._pickRemote(shelf.indexOf(it));
  assert.deepEqual(w.basket, pieces, 'staged whole');
  const real = Math.random;
  Math.random = () => 0.99;
  try { const [x, y, rw, rh] = TRADE_RECTS.steal; w.click(x + rw / 2, y + rh / 2); } finally { Math.random = real; }
  assert.equal(w.done, true);
  return pieces;
}
/** The real Sell: the piece staged off the pack's list, the mode action, Yes. Answers the price paid. */
function sell(shelf, player, item) {
  const w = counter('Sell', shelf, player);
  const at = w.localList().indexOf(item);
  assert.ok(at >= 0, 'the counter lists it');
  w._pickLocal(at);
  const before = totalGoldAmount(player);
  w._modeAction();
  assert.equal(w.box?.buttons, 'YesNo');
  w.input('KeyY');
  return totalGoldAmount(player) - before;
}

test('STOLEN-GOODS the report: a piece stolen off a smith\'s shelf (the real Steal) and sold back is paid for and GONE - the shelf as it was, nothing to buy back and steal again; an honest sale still lands on the shelf, so a mistake can be bought back (mutants: the steal unmarked, the stolen piece shelved, the mark not the item law\'s)', () => {
  const shelf = smithShelf();
  const player = thief();
  const [dagger] = steal(shelf, player, [shelf.find((it) => it.templateIndex === DAGGER)]);
  assert.deepEqual(player.items, [dagger], 'carried off');
  assert.equal(isStolen(dagger), true, 'and marked stolen');
  assert.equal(dagger.stolen, true, 'the field itself, as the save and the wire carry it');
  assert.equal(ITEM_FIELDS.stolen.kind, 'bool', 'a declared field (itemFields.js): the save, the wire and the item law know it');
  const shelfBefore = [...shelf];
  const paid = sell(shelf, player, dagger);
  assert.ok(paid > 0, `the merchant pays for it (${paid} gold)`);
  assert.deepEqual(player.items, [], 'out of the pack');
  assert.deepEqual(shelf, shelfBefore, 'and NOT on the shelf: the circle is broken');
  // an honest piece - one the world handed over (a body's dagger) - still lands on the open shelf (Port-Ledger T2)
  const found = createWeapon(DAGGER, 0, () => 0.5);
  player.items.push(found);
  assert.equal(isStolen(found), false);
  assert.ok(sell(shelf, player, found) > 0);
  assert.equal(shelf.at(-1), found, 'shelved, to be bought back');
  assert.equal(shelf.length, shelfBefore.length + 1);
});

test('STOLEN-GOODS the enhanced counter\'s Steal marks what it carries off - the one piece picked, and a basket of arrows, which stay a stack of their own beside the pack\'s (mutants: the enhanced steal unmarked)', () => {
  const run = (stage) => withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const shelf = smithShelf();
    const mine = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
    const player = thief({ items: [mine] });
    const view = mountEnhancedTrade(host, {
      mode: 'Buy', shelfItems: () => shelf, packItems: () => player.items, accepts: () => true, enchanted: () => false,
      priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 0, rows: (id) => [{ text: `#${id}`, center: true }],
      weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e6 }), commit: () => {}, icons: ICONS, entity: player,
      pickpocketSkill: () => 50, tallyPickpocket: () => {}, tallyCrimeGuild: () => {}, crimeTheft: () => {}, spawnCityGuards: () => {}, say: () => {},
    });
    const named = (r) => r.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
    const piece = stage(host, named, shelf);
    host.querySelectorAll('button').find((b) => b.textContent === 'Steal').onclick();
    const real = Math.random;
    Math.random = () => 0.99;
    try { host.querySelectorAll('button').find((b) => b.textContent === 'Yes').onclick(); } finally { Math.random = real; }
    view.unmount();
    return { player, mine, piece };
  });
  // the one piece picked (stealTargets' selection arm)
  const one = run((host, named, shelf) => {
    host.querySelectorAll('.itemrow').find((r) => named(r).startsWith('Dagger')).onclick({ timeStamp: 1000 });   // one click: picked, not moved
    return shelf.find((it) => it.templateIndex === DAGGER);
  });
  assert.deepEqual(one.player.items, [one.mine, one.piece], 'carried off');
  assert.equal(isStolen(one.piece), true, 'and marked');
  // a basket: the arrows staged with the counter's own button, then stolen
  const lot = run((host, named, shelf) => {
    const arrows = shelf.find((it) => it.templateIndex === ARROW_TEMPLATE);
    host.querySelectorAll('.itemrow').find((r) => named(r) === `Arrow ×${arrows.stackCount}`).onclick({ timeStamp: 1000 });   // the shelf's, not the pack's own
    host.querySelectorAll('.act.primary').find((b) => b.textContent === 'Buy').onclick();   // into the basket
    assert.equal(shelf.includes(arrows), false, 'staged');
    return arrows;
  });
  assert.deepEqual(lot.player.items.map((it) => [it.stackCount, isStolen(it)]), [[lot.mine.stackCount, false], [85, true]], 'the basket marked before it merged into the pack');
});

test('STOLEN-GOODS a shut shop\'s shelf: a take through the inventory window (both skins) is marked BEFORE it lands, so eighty-five arrows off the shelf stay a stack of their own beside the pack\'s eleven; put back, a piece is the owner\'s again; an honest pile and the wagon mark nothing (mutants: the take unmarked, marked after the merge, the put-back kept, every loot a theft, the wagon a theft)', () => {
  const ownArrows = () => createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
  // the classic window
  const shelf = smithShelf();
  const arrows = shelf.find((it) => it.templateIndex === ARROW_TEMPLATE);
  const mine = ownArrows();
  const player = thief({ items: [mine] });
  const w = new NativeInventoryWindow({ items: () => player.items, icons: ICONS, entity: player, loot: { items: () => shelf, stolenFrom: new Set(shelf) } });   // PIN MOVED (AUDIT S1): the shop's keeping, as the host takes it
  w._pickRemote(shelf.indexOf(arrows), 'remove');
  assert.equal(shelf.includes(arrows), false, 'taken off the shelf');
  assert.deepEqual(player.items.map((it) => [it.stackCount, isStolen(it)]), [[mine.stackCount, false], [85, true]],
    'two stacks: the pack\'s own arrows untouched, the shelf\'s marked - never one stack of either');
  w._pick(w._filtered().indexOf(arrows), 'remove');   // put back
  assert.equal(shelf.at(-1), arrows, 'back on the shelf');
  assert.equal(isStolen(arrows), false, 'its owner\'s again');
  assert.deepEqual(player.items, [mine]);
  // an honest pile: the same take merges as it always did, and nothing is marked
  const pile = [ownArrows()];
  const had = mine.stackCount + pile[0].stackCount;
  const honest = new NativeInventoryWindow({ items: () => player.items, icons: ICONS, entity: player, loot: { items: () => pile } });
  honest._pickRemote(0, 'remove');
  assert.deepEqual(player.items.map((it) => [it.stackCount, isStolen(it)]), [[had, false]], 'merged, clean');
  // the wagon, shown while the shelf is the loot target, is the player's own
  const wagonItems = [ownArrows()];
  const p2 = thief();
  const wagonShelf = smithShelf();
  const wagonWin = new NativeInventoryWindow({ items: () => p2.items, wagonItems: () => wagonItems, icons: ICONS, entity: p2, loot: { items: () => wagonShelf, stolenFrom: new Set([...wagonShelf, ...wagonItems]) } });   // the wagon's own in the Set too: only the target's showing makes a theft
  wagonWin.usingWagon = true;
  const fromWagon = wagonItems[0];
  wagonWin._pickRemote(0, 'remove');
  assert.deepEqual([p2.items[0], isStolen(fromWagon)], [fromWagon, false], 'a take out of the wagon is no theft');
  // the enhanced pack: the same take, a press on the container's row
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const s2 = smithShelf();
    const a2 = s2.find((it) => it.templateIndex === ARROW_TEMPLATE);
    const m2 = ownArrows();
    const e = thief({ items: [m2] });
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => s2, stolenFrom: new Set(s2) }, onExit: () => view.unmount() });
    const named = (r) => r.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
    host.querySelectorAll('.itemrow').find((r) => r.closest('.loot-win') && named(r).startsWith('Arrow')).onclick();   // a container's row: a press takes it
    assert.deepEqual(e.items.map((it) => [it.stackCount, isStolen(it)]), [[m2.stackCount, false], [85, true]], 'marked as it landed, its own stack');
    assert.equal(e.items[1], a2);
    view.unmount();
  });
});

test('STOLEN-GOODS the mark rides: a stolen piece stacks with stolen kin alone and a split keeps it; the save keeps it; the wire and a realm trade\'s record carry it to the next owner - a hand-off launders nothing (mutants: a stolen stack merged into a clean one, the split clean, the mark a receiver\'s)', () => {
  const shelf = smithShelf();
  const player = thief();
  const [arrows, dagger] = steal(shelf, player, [shelf.find((it) => it.templateIndex === ARROW_TEMPLATE), shelf.find((it) => it.templateIndex === DAGGER)]);
  // the pack's stacks
  const clean = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
  addItem(player.items, clean);
  assert.equal(player.items.length, 3, 'clean arrows do not join the stolen stack');
  const more = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
  more.stolen = true;
  addItem(player.items, more);
  assert.equal(arrows.stackCount, 85 + more.stackCount, 'stolen arrows join the stolen stack');
  const part = splitStack(player.items, arrows, 5);
  assert.deepEqual([part.stackCount, isStolen(part)], [5, true], 'a split is no way out of the mark');
  // the save
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player, {})));
  const back = thief();
  restorePlayer(back, snap);
  assert.deepEqual(back.items.map((it) => isStolen(it)), player.items.map((it) => isStolen(it)), 'every mark as it was');
  assert.equal(back.items.filter(isStolen).length, 3);
  // the wire: a dropped piece, a pile's record
  assert.equal(RECEIVER_MARKS.includes('stolen'), false, 'never the receiver\'s mark');
  assert.equal(validLootItem(JSON.parse(JSON.stringify(dagger)))?.stolen, true, 'a peer\'s copy of the record keeps it');
  // a realm trade: the record as it leaves the giver's save
  const save = { items: [JSON.parse(JSON.stringify(dagger))], goldPieces: 0 };
  const moved = takeTradeGoods(save, { items: [JSON.parse(JSON.stringify(dagger))], gold: 0 }, [0]);
  assert.equal(moved?.[0]?.stolen, true, 'and the buyer\'s copy is stolen too');
});

// ─── THE COURT ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The town host's one overlay slot, as townTalk.frame drains it (prisonrelease.test.js's). */
function mkTalk() {
  const slot = { win: null, onClosed: null };
  return {
    slot, texts: () => null, overlay: null, factionDict: null, locationName: 'Daggerfall',
    showOverlay(win, onClosed = null) { slot.win = win; slot.onClosed = onClosed; },
    pushOverlay(win, onClosed = null) { slot.win = win; slot.onClosed = onClosed; },
    close() { const cb = slot.onClosed; slot.win = null; slot.onClosed = null; cb?.(); },
  };
}
/** A defendant who robbed a smith and a general store with the real Steal: a stolen dagger worn in the hand, a stolen
 *  torch lit, stolen arrows and rations in the pack, a stolen bundle in the Materials Bag - and honest goods beside them. */
function defendant({ crime = CRIMES.Theft, gold = 0, legal = 0 } = {}) {
  const p = thief({
    health: 1, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
    crimeCommitted: crime, chargedCrime: crime, legalRep: { 17: legal }, skills: 30, skillUses: [],
    haveShownSurrenderDialogue: true, arrested: false,
  });
  const smith = smithShelf(), store = storeShelf();
  const [dagger, arrows] = steal(smith, p, [smith.find((it) => it.templateIndex === DAGGER), smith.find((it) => it.templateIndex === ARROW_TEMPLATE)]);
  const [torch, rations, bread] = steal(store, p, [store.find(isLightSource), store.find((it) => it.name === 'Rations'), store.find((it) => it.name === 'Bread')]);
  applyTransfer(bread, { amount: 1 }, p.items, p.bagItems);   // into the Materials Bag, as its store moves it
  const honest = [createWeapon(120, 0, () => 0.5), createWeapon(ARROW_TEMPLATE, 0, () => 0.5)];   // a Longsword and arrows found, never stolen
  for (const it of honest) addItem(p.items, it);
  assert.ok(equipItem(p, dagger) !== null && isEquipped(dagger), 'the stolen dagger in hand');
  setLightSource(p, torch);
  p.goldPieces = gold;   // after the theft: a purse's weight is no part of the steal's carry gate here
  return { p, stolen: [dagger, arrows, torch, rations, bread], honest };
}
function flowFor(p, { rolls = () => 0.99, guildRankOf = () => null } = {}) {
  const townTalk = mkTalk();
  const said = [];
  const flow = createArrestFlow({ townTalk, playerEntity: p, regionIndex: 17, rolls, guildRankOf, advanceDays: () => {}, advanceMinutes: () => {}, say: (l) => said.push(l) });
  return { townTalk, flow, said };
}
const carriedStolen = (p) => [...p.items, ...p.bagItems].filter(isStolen);
const takenLine = confiscatedText(1 + 85 + 1 + 99 + 1);   // the dagger, the arrows, the torch, the rations, the bread

test('STOLEN-GOODS the court: a sentence served takes every stolen piece carried - the worn dagger taken off its hand, the lit torch out, the pack\'s and the Materials Bag\'s - and keeps every honest one; the line is said once, at the release (mutants: nothing taken, the worn piece left in its slot, the torch left lit, the bag unsearched, the count by records, the line unsaid)', () => {
  const { p, stolen, honest } = defendant();
  const { townTalk, flow, said } = flowFor(p);
  flow.startCourtFlow();
  townTalk.slot.win.input('KeyG');   // guilty, no coin: the whole sentence in days
  assert.ok(townTalk.slot.win instanceof PrisonScreenWindow, 'to prison');
  assert.deepEqual(carriedStolen(p), [], 'taken at the verdict');
  assert.deepEqual(p.items, honest, 'and every honest piece kept');
  assert.equal(equipTableOf(p).includes(stolen[0]), false, 'the dagger off its hand first');
  assert.equal(stolen[0].equipSlot, undefined);
  assert.equal(p.lightSource ?? null, null, 'the torch out');
  assert.deepEqual(said, [], 'said at the release, not under the prison screen');
  const w = townTalk.slot.win;
  for (let i = 0; i < w.daysInPrison; i++) w.tick(PRISON_UPDATE_INTERVAL);
  townTalk.close();
  assert.deepEqual(said, [takenLine], 'once, the pieces counted');
  assert.equal(takenLine, 'The guards take the stolen goods you carried (187 items).');
  assert.equal(confiscatedText(1), 'The guards take the stolen goods you carried (1 item).');
});

test('STOLEN-GOODS the court: every guilty exit takes them - a fine paid with no days, banishment, the failed defence\'s sentence - and an acquittal and a guild\'s rescue take nothing (mutants: the confiscation at every release, the fine\'s exit free)', () => {
  // a fine paid in full, no days: every coin flip of the court's penalty a fine
  const seed = getSeed();
  try {
    const flips = 12;   // a Theft at standing 0: 500 / 40
    let s = 1;
    for (; s < 1e6; s++) { setSeed(s); let all = true; for (let i = 0; i < flips; i++) if ((rand() & 1) === 0) { all = false; break; } if (all) break; }
    const fined = defendant({ gold: 100000 });
    const f = flowFor(fined.p);
    setSeed(s);
    f.flow.startCourtFlow();
    f.townTalk.slot.win.input('KeyG');
    assert.ok(fined.p.goldPieces < 100000, 'the fine paid');
    assert.equal(fined.p.arrested, false, 'released with no days');
    assert.deepEqual([carriedStolen(fined.p), fined.p.items], [[], fined.honest]);
    assert.deepEqual(f.said, [takenLine]);
  } finally { setSeed(seed); }
  // banished: a Murder, a name the court can banish for
  const banished = defendant({ crime: CRIMES.Murder, legal: -60 });
  const b = flowFor(banished.p, { rolls: () => 0 });
  b.flow.startCourtFlow();
  b.townTalk.slot.win.input('KeyG');
  assert.match(b.townTalk.slot.win.lines.join(' '), /banished/i, 'banished');
  assert.deepEqual([carriedStolen(banished.p), banished.p.items], [[], banished.honest], 'banishment takes them');
  assert.deepEqual(b.said, [takenLine]);
  // the failed defence: guilty after a lie, the verdict's box, the sentence
  const lied = defendant();
  const l = flowFor(lied.p, { rolls: () => 0.99 });
  l.flow.startCourtFlow();
  l.townTalk.slot.win.input('KeyN');
  l.townTalk.slot.win.input('KeyL');
  assert.equal(carriedStolen(lied.p).length, 5, 'nothing taken while the verdict\'s words stand');
  l.townTalk.close();   // the found-guilty box: its close is the sentence
  assert.deepEqual(carriedStolen(lied.p), [], 'the sentence takes them');
  // acquitted: no crime found, nothing taken
  const freed = defendant();
  const a = flowFor(freed.p, { rolls: () => 0 });
  a.flow.startCourtFlow();
  a.townTalk.slot.win.input('KeyN');
  a.townTalk.slot.win.input('KeyD');
  assert.equal(freed.p.arrested, false, 'free to go');
  assert.equal(carriedStolen(freed.p).length, 5, 'an acquittal takes nothing');
  assert.deepEqual(a.said, []);
  // the Thieves Guild's rescue: a member's break-in, the guild got them out
  const member = defendant({ crime: CRIMES.Breaking_And_Entering });
  const r = flowFor(member.p, { rolls: () => 0, guildRankOf: (id) => (id === THIEVES_GUILD_FACTION_ID ? 9 : null) });
  r.flow.startCourtFlow();
  assert.equal(member.p.arrested, false, 'rescued before any plea');
  assert.equal(carriedStolen(member.p).length, 5, 'a rescue takes nothing');
  assert.deepEqual(r.said, []);
});

test('STOLEN-GOODS wired (worldModes.js, by source): both sale arms land a piece through landSold - the counter\'s commitTrade and the keyed doSell - and neither pushes onto the shelf; the shut shop\'s shelf and a stranger\'s cupboard are loot targets marked stolen, a cupboard of one\'s own is not; the enhanced card says what the mark means (mutants: either arm shelving, either target unmarked)', () => {
  const wm = src('src/scenes/worldModes.js');
  const sellArm = wm.slice(wm.indexOf("} else if (mode === 'Sell' || mode === 'SellMagic') {"), wm.indexOf("} else if (mode === 'Repair') {"));
  assert.match(sellArm, /for \(const it of staged\) \{\n\s+const i = playerEntity\.items\.indexOf\(it\);\n\s+if \(i >= 0\) playerEntity\.items\.splice\(i, 1\);\n\s+landSold\(shelf\.items, it\);/, 'the counter');
  const doSell = wm.slice(wm.indexOf('function doSell(shelf, it) {'), wm.indexOf('function itemValue(it)'));
  assert.match(doSell, /playerEntity\.items\.splice\(playerEntity\.items\.indexOf\(it\), 1\);\n\s+landSold\(shelf\.items, it\);/, 'the keyed list');
  for (const [name, body] of [['the counter', sellArm], ['the keyed list', doSell]]) assert.doesNotMatch(body, /shelf\.items\.push\(/, `${name} pushes nothing onto the shelf`);
  assert.match(wm, /import \{ landSold \} from '\.\.\/systems\/stolenGoods\.js';/);
  const shelfArm = wm.slice(wm.indexOf('function openShelf'), wm.indexOf('function openMerchantSell'));
  // PIN MOVED (AUDIT S1): each target hands over the owner's keeping, taken as the window opens - the one Set the mark and
  // the theft's own law (the shelf's tally, the cupboard's basket) read
  assert.match(shelfArm, /if \(b\.insideOpenShop === false\) \{[\s\S]*const shelfBefore = new Set\(shelf\.items\);[^\n]*\n\s*const win = interiorInventory\(\{\n\s*loot: \{ items: \(\) => shelf\.items, stolenFrom: shelfBefore \},[\s\S]{0,300}if \(shopShelfTheft\(shelfBefore, shelf\.items\)\)/, 'a shut shop\'s shelf');
  assert.match(wm, /const openLoot = \(privateProperty = false\) => \{\n\s*if \(privateProperty\) interiorLootBirth\(interiorCtx, key, _intShared\);[^\n]*\n\s*const before = privateProperty \? new Set\(c\.items \?\? \[\]\) : null;[^\n]*\n\s*const win = interiorInventory\(\{\n\s*loot: \{ items: \(\) => c\.items, storage: !privateProperty, stolenFrom: before \},[\s\S]{0,400}basket: theftBasket\(before, c\.items \?\? \[\]\),/, 'a stranger\'s cupboard - the theft arm alone, its basket the same Set');   // PIN MOVED (OUTDOOR-LOOT): the Yes mints the room's birth and composes it into the cupboard FIRST - the keeping is taken after, or a first opener's takes would mark nothing
  // the enhanced pack's put-back: it shows a container alone (a body's frame - shipstore.test.js), so no row of the pack
  // can reach a shelf today; its stow still asks the same question the classic window's does, should a layout ever offer it
  assert.match(src('src/ui/enhanced/enhancedInventory.js'), /applyTransfer\(item, \{ \.\.\.plan, amount \}, deps\.items\?\.\(\) \?\? \[\], to, \{ entity: deps\.entity, fromLocal: true, returnTo: theftTarget\(deps, sessionState\(\)\) \}\);/);
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const shelf = smithShelf();
    const player = thief();
    const [dagger] = steal(shelf, player, [shelf.find((it) => it.templateIndex === DAGGER)]);
    let view = null;
    view = mountEnhancedInventory(host, { entity: player, items: () => player.items, onExit: () => view.unmount() });
    host.querySelectorAll('.itemrow')[0].onclick({ timeStamp: 1 });
    const words = (n) => [n.textContent ?? '', ...(n.children ?? []).map(words)].join(' ');
    assert.ok(words(host).includes(stolenLine()), 'the stolen piece\'s card says it');
    assert.equal(isStolen(dagger), true);
    view.unmount();
  });
});

// ─── AUDIT (2026-10-16) ──────────────────────────────────────────────────────────────────────────────────────────────

test('STOLEN-GOODS AUDIT S1: A THEFT IS OF THE OWNER\'S PIECES - an honest Longsword misclicked into a stranger\'s cupboard and taken straight back comes out clean (the theft basket 0, shelved at a sale, kept at a verdict); a piece stolen elsewhere is not laundered by the cupboard; a handful off the owner\'s stack is marked AND in the basket, and put back is theirs and out of it; a handful of their coin is counted, never marked (mutants: every take marked, every put cleared, a split\'s source unasked, the split outside the keeping, a merge left in it, the coin uncounted, a stack\'s basket by the list)', () => {
  const sword = createWeapon(120, 0, () => 0.5);   // a Longsword found, never stolen
  const dagger = createWeapon(DAGGER, 0, () => 0.5);   // the stranger's
  const arrows = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);   // and their quiver
  const coin = goldStack(50);   // and their purse
  const cupboard = [dagger, arrows, coin];
  const keeping = new Set(cupboard);   // the host's `before` (worldModes.js openLoot): the owner's keeping as the window opens
  const player = thief({ items: [sword] });
  const w = new NativeInventoryWindow({ items: () => player.items, icons: ICONS, entity: player, loot: { items: () => cupboard, stolenFrom: keeping } });
  // the report's own case (s1_ownitem): a misclick into the cupboard and straight back
  w._pick(w._filtered().indexOf(sword), 'remove');
  assert.equal(cupboard.at(-1), sword, 'into the cupboard');
  assert.equal(isStolen(sword), false);
  w._pickRemote(cupboard.indexOf(sword), 'remove');
  assert.deepEqual([player.items.includes(sword), isStolen(sword)], [true, false], 'back in the pack - the player\'s own, clean');
  assert.deepEqual(theftBasket(keeping, cupboard), [], 'and the theft law counts nothing: the mark and the crime agree');
  const shelf = [];
  assert.equal(landSold(shelf, sword), true, 'sold, it lands on the shelf as an honest piece');
  player.items.push(shelf.pop());
  assert.equal(confiscateStolen(player).includes(sword), false, 'a verdict leaves it');
  // the owner's dagger taken is a theft - marked, and in the basket
  w._pickRemote(cupboard.indexOf(dagger), 'remove');
  assert.deepEqual([isStolen(dagger), theftBasket(keeping, cupboard)], [true, [dagger]]);
  // put back, theirs again and out of the basket; taken again, stolen again
  w._pick(w._filtered().indexOf(dagger), 'remove');
  assert.deepEqual([cupboard.includes(dagger), isStolen(dagger), theftBasket(keeping, cupboard)], [true, false, []]);
  w._pickRemote(cupboard.indexOf(dagger), 'remove');
  assert.equal(isStolen(dagger), true, 'taken again: stolen again');
  // a piece stolen elsewhere (the real Steal off a smith's shelf) is not laundered by a stranger's cupboard
  const smith = smithShelf();
  const [loot] = steal(smith, player, [smith.find((it) => it.templateIndex === DAGGER)]);
  w._pick(w._filtered().indexOf(loot), 'remove');
  assert.deepEqual([cupboard.includes(loot), isStolen(loot)], [true, true], 'put in, it keeps its theft');
  w._pickRemote(cupboard.indexOf(loot), 'remove');
  assert.deepEqual([player.items.includes(loot), isStolen(loot)], [true, true], 'and out again, still stolen');
  assert.deepEqual(theftBasket(keeping, cupboard), [dagger], 'never this owner\'s theft');
  // a handful off the owner's stack - the member every window calls (itemTransfer.js applyTransfer)
  const n = arrows.stackCount;
  const handful = applyTransfer(arrows, { amount: 4 }, cupboard, player.items, { entity: player, toPlayer: true, stolenFrom: keeping });
  assert.notEqual(handful, arrows, 'a split: their stack still stands');
  assert.deepEqual([handful.stackCount, isStolen(handful), arrows.stackCount, isStolen(arrows)], [4, true, n - 4, false]);
  assert.deepEqual(theftBasket(keeping, cupboard), [dagger, handful], 'the basket counts the handful - a diff of the list saw their stack still standing');
  applyTransfer(handful, { amount: 2 }, player.items, cupboard, { entity: player, fromLocal: true, returnTo: keeping });
  assert.deepEqual([arrows.stackCount, handful.stackCount, isStolen(handful)], [n - 2, 2, true], 'two back into their stack; two still carried, still stolen');
  assert.deepEqual(theftBasket(keeping, cupboard), [dagger, handful]);
  applyTransfer(handful, { amount: 2 }, player.items, cupboard, { entity: player, fromLocal: true, returnTo: keeping });
  assert.deepEqual([arrows.stackCount, cupboard.includes(handful), player.items.includes(handful)], [n, false, false], 'the rest back, merged into their stack');
  assert.deepEqual(theftBasket(keeping, cupboard), [dagger], 'and nothing of the arrows is out');
  // a handful of their coin: into the purse, unmarked (a number) - and counted
  const purse = player.goldPieces;
  applyTransfer(coin, { amount: 10 }, cupboard, player.items, { entity: player, toPlayer: true, stolenFrom: keeping });
  assert.equal(player.goldPieces, purse + 10);
  const basket = theftBasket(keeping, cupboard);
  assert.equal(basket.length, 2);
  assert.equal(basket[0], dagger);
  assert.deepEqual([basket[1].group, basket[1].templateIndex, basket[1].stackCount], [coin.group, coin.templateIndex, 10], 'the ten coins in the basket');
  assert.deepEqual([cupboard.includes(coin), coin.stackCount], [true, 40], 'the rest of their purse where it was');
});

test('STOLEN-GOODS AUDIT S1: the shut shop\'s shelf reads the same keeping - a piece of the player\'s own put down masks no take (the tally DFU\'s count missed), and a round trip of the player\'s own is no theft; the enhanced pack\'s take marks the owner\'s piece alone (mutants: the shelf by count, the enhanced take unwired)', () => {
  const shelf = smithShelf();
  const shopDagger = shelf.find((it) => it.templateIndex === DAGGER);
  const keeping = new Set(shelf);   // worldModes.js openShelf's `shelfBefore`
  const sword = createWeapon(120, 0, () => 0.5);
  const player = thief({ items: [sword] });
  const w = new NativeInventoryWindow({ items: () => player.items, icons: ICONS, entity: player, loot: { items: () => shelf, stolenFrom: keeping } });
  w._pick(w._filtered().indexOf(sword), 'remove');
  w._pickRemote(shelf.indexOf(sword), 'remove');
  assert.deepEqual([isStolen(sword), shopShelfTheft(keeping, shelf)], [false, false], 'a round trip of one\'s own: no theft, no tally');
  w._pick(w._filtered().indexOf(sword), 'remove');   // the sword down...
  w._pickRemote(shelf.indexOf(shopDagger), 'remove');   // ...the shop's dagger up: the shelf as long as it was
  assert.equal(shelf.length, keeping.size, 'DFU\'s count saw nothing');
  assert.deepEqual([isStolen(shopDagger), shopShelfTheft(keeping, shelf)], [true, true], 'marked, and the tally the mark agrees with');
  // the enhanced pack: a press on the container's row takes it - the shop's piece marked, the player's own not
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const own = createWeapon(120, 0, () => 0.5);
    const theirs = createWeapon(DAGGER, 0, () => 0.5);
    const cupboard = [theirs, own];   // `own` put there in this window: not in the keeping
    const e = thief();
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => cupboard, stolenFrom: new Set([theirs]) }, onExit: () => view.unmount() });
    const named = (r) => r.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
    host.querySelectorAll('.itemrow').find((r) => r.closest('.loot-win') && named(r).startsWith('Longsword')).onclick();
    host.querySelectorAll('.itemrow').find((r) => r.closest('.loot-win') && named(r).startsWith('Dagger')).onclick();
    assert.deepEqual(e.items.map((it) => [it, isStolen(it)]), [[own, false], [theirs, true]]);
    view.unmount();
  });
});

test('STOLEN-GOODS AUDIT S2: a stolen Materials Bag taken at a verdict leaves its honest goods in the pack - every log, whatever they weigh, never in a list nobody owns; a stolen piece in it goes with it; a bag of one\'s own beside it keeps them (mutants: the goods stranded, a bag of one\'s own emptied)', () => {
  const where = globalThis.location;
  try {
    globalThis.location = { search: '?online' };   // the professions' lane: every General Store shelves one (shopStock.js BAG1)
    const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, { items: [], level: 1 }, { rolls: () => 0.5, torchesFromItems: false });
    const p = thief({ stats: { strength: 30 } });
    const w = new NativeInventoryWindow({ items: () => p.items, icons: ICONS, entity: p, loot: { items: () => shelf, stolenFrom: new Set(shelf) } });
    w._pickRemote(shelf.findIndex(isBagItem), 'remove');   // a shut store's bag off its shelf
    const bag = p.items.find(isBagItem);
    assert.equal(isStolen(bag), true, 'stolen');
    const bread = steal(shelf, p, [shelf.find((it) => it.name === 'Bread')])[0];
    applyTransfer(bread, { amount: 1 }, p.items, p.bagItems);   // a stolen piece in the bag too
    const cut = mintCarried(p, 'log:oak', 200);   // the harvest's own door: into the bag while it holds
    assert.ok(cut.bag > 100, `honest logs cut into it (${cut.bag})`);
    const taken = confiscateStolen(p);
    assert.deepEqual(new Set(taken), new Set([bag, bread]), 'the bag and what in it was stolen');
    assert.equal(hasBag(p.items), false);
    assert.deepEqual(p.bagItems, [], 'nothing left in a list nobody owns');
    assert.equal(heldOf(p, 'log:oak'), cut.bag + cut.pack, 'every log the bag held, in the pack beside the ones she carried - a hundred and more kilograms past what she can');
    assert.equal(p.items.some(isStolen), false);
    // a bag of one's own beside the stolen one (a save from before ONE-BAG): its goods stay in it
    const q = thief();
    const own = { ...bag };
    delete own.stolen;   // one bought (the shelf's record, the counter's Buy clears a mark)
    q.items.push(own, { ...bag, stolen: true });
    assert.equal(q.items.filter(isBagItem).length, 2);
    mintCarried(q, 'log:oak', 3);
    confiscateStolen(q);
    assert.deepEqual([hasBag(q.items), heldOf(q, 'log:oak'), q.bagItems.length], [true, 3, 1], 'the logs in the bag still held');
  } finally { globalThis.location = where; }
});

test('STOLEN-GOODS AUDIT S3: no shelf piece is stolen - the room\'s word for a shelf or a cupboard lands clean (an older build\'s sale, a hostile client) and this build says none, and a piece bought at the counter is the buyer\'s, honestly, on either lane (mutants: the word kept, the word said, the Buy kept)', () => {
  const word = { ...createWeapon(DAGGER, 0, () => 0.5), stolen: true };
  const theirs = { ...createWeapon(ARROW_TEMPLATE, 0, () => 0.5), stolen: true };
  const shelf = { items: [], stockedDate: 5 };
  const cupboard = { items: [], stockedDate: 5 };
  const ctx = { shelves: [shelf], containers: [cupboard] };
  assert.equal(applyInteriorLoot(ctx, [{ k: 'shelf:0', r: [word], d: 5 }, { k: 'container:0', r: [theirs], d: 5 }], { today: 5 }), 2);
  assert.deepEqual([shelf.items.length, cupboard.items.length], [1, 1]);
  assert.deepEqual([isStolen(shelf.items[0]), isStolen(cupboard.items[0])], [false, false], 'landed clean');
  // and this build's own word never carries one: a stash left on a shut shelf keeps its mark here, and goes out clean (an
  // older build beside this one lands what it is told)
  const stash = { ...createWeapon(DAGGER, 0, () => 0.5), stolen: true };
  shelf.items.push(stash);
  const said = interiorLootRecords(ctx, ['shelf:0']);
  assert.deepEqual(said.map((r) => [r.k, r.r.length, r.r.some(isStolen)]), [['shelf:0', 2, false]], 'said clean');
  assert.equal(isStolen(stash), true, 'the stash itself as it was - no cupboard launders it');
  shelf.items.pop();
  // a stash: a piece stolen elsewhere left on a shut shelf keeps its mark there (no cupboard launders it) - until it is
  // bought: the counter's Buy door (worldModes.js commitTrade's Buy arm and doBuy, markCounterBought) makes it the buyer's
  for (const online of [false, true]) {
    const smith = smithShelf();
    const p = thief();
    const [stash] = steal(smith, p, [smith.find((it) => it.templateIndex === DAGGER)]);
    assert.equal(isStolen(stash), true);
    markCounterBought([stash], { online });
    assert.equal(isStolen(stash), false, `bought, ${online ? 'online' : 'offline'}: honest`);
    assert.equal(stash.counterBought === true, online, 'and the counter\'s own mark as it was');
  }
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /if \(mode === 'Buy'\) \{\n\s+deductGold\(playerEntity, price\);\n\s+markCounterBought\(staged, \{ price, \.\.\.asked \}\);/, 'the counter\'s Buy - the door the clear rides');   // PIN MOVED (AUDIT TOWN-ECON 2 PRICE-1)   // PIN MOVED (LAW-3): the lot's price handed in
  assert.match(wm, /shelf\.items\.splice\(at, 1\);\n\s+markCounterBought\(\[it\], \{ price \}\);/, 'and the keyed list\'s');
});

/** The real naval host's boarding: a ship struck alongside, boarded from my helm and taken - her hold drawn by the
 *  world's own producer (world.js's `hold`: the treasure table's draw), not yet emptied (keepplunder.test.js's rig). */
async function prizeOf(classId, o = {}) {
  const h = await sea({ hull: 2, ...o });
  h.deps.hold = (key) => generateItems(key, { level: 5, gender: 'male' }, () => 0.5);
  const id = h.host.spawnShip(classId, { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  h.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true, 'the grapples');
  h.run(GRAPPLE_S + 0.3);
  for (const f of h.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  h.run(0.3);
  assert.ok(e.prize?.hold?.length > 0, `${classId}: her hold drawn`);
  return { h, e };
}

test('STOLEN-GOODS AUDIT S4: the two theft arms that marked nothing - a lawful ship\'s hold, taken by Piracy, is stolen goods however it leaves her (her crew\'s stow into her captor\'s hold); a pirate\'s is a lawful prize, and past the Veil no crown\'s writ runs; a robbed caravan\'s goods are its people\'s (world.js, by source) (mutants: the merchantman clean, every prize stolen, the Veil\'s stolen, the caravan unmarked)', async () => {
  const merchant = await prizeOf('merchantGalleon');
  assert.ok(merchant.e.prize.hold.every(isStolen), 'a merchantman\'s hold: her owner\'s goods');
  const given = [];
  merchant.h.deps.board.giveItems = (items) => { given.push(...items); return { left: [] }; };
  merchant.h.host.stowPlunder();
  assert.ok(given.length > 0 && given.every(isStolen), 'into her captor\'s hold, still stolen');
  const pirate = await prizeOf('pirateSloop');
  assert.equal(pirate.e.prize.hold.some(isStolen), false, 'a pirate\'s hold: fair prize');
  const ether = await prizeOf('merchantGalleon', { where: { ether: { band: 'shallows', depth: 0.1 } } });
  assert.ok(ether.e.ether, 'a ship of the Eltheric Ocean');
  assert.equal(ether.e.prize.hold.some(isStolen), false, 'past the Veil: no crown, no theft');
  // the robbed caravan (bootWorld cannot be stood up): its loot window hands over the goods as the owner's keeping
  const w = src('src/scenes/world.js');
  const caravan = w.slice(w.indexOf('const caravanHostOf = () => (_caravanHost ??= createCaravanHost({'), w.indexOf('choose: (lines, options) => townTalk.showOverlay(new ChoiceWindow({ lines, options })),'));
  assert.match(caravan, /openLoot: \(\{ items \}\) => \{[\s\S]*makeInventoryWindow\(\{ loot: \{ items: \(\) => items, containerImage: \(\) => CONTAINER_IMAGES\.Chest, playerOwned: false, stolenFrom: new Set\(items\) \} \}\);/);
});

/** A ship sunk by `by` ('local': me) through peers' blows, as keepplunder.test.js sinks one: struck, then her hull broken
 *  past it a grace later (a blow is a hit's most at a time). */
function sunk(h, classId, pos, by) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  const blow = (hull) => { for (let left = hull; left > 0; left -= NAVAL_HIT_MAX) h.host.applyPeerHit(by, navalHitData('local', { n: e.n, hull: Math.min(left, NAVAL_HIT_MAX) })); };
  blow(Math.floor(e.ship.damage.hull - 1));
  h.run(STRUCK_GRACE_S + 1);
  blow(Math.ceil(e.ship.damage.hull + 1));
  h.run(0.5);
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking, `${classId} by ${by}: going down`);
  return e;
}

test('STOLEN-GOODS AUDIT S4 (the flotsam, decided): a lawful ship I sank floats her owner\'s goods - her casks\' lots are stolen however they come aboard (hauled in, the crew\'s stow), as boarding her marks her hold; a pirate\'s casks are fair prize and a lawful ship another sank floats salvage (mutants: the casks clean, every cask stolen, another\'s sinking mine)', async () => {
  const h = await sea({ hull: 2 });
  h.deps.hold = (key) => generateItems(key, { level: 5, gender: 'male' }, () => 0.5);
  const given = [];
  h.deps.board.giveItems = (items) => { given.push(...items); return { left: [] }; };
  const casksOf = (e) => h.host._shots.floaters().filter((f) => f.kind === 'flotsam' && f.from === e.ship.cls.id && !isSalvage(f.lot) && Math.hypot(f.pos[0] - e.ship.pos[0], f.pos[2] - e.ship.pos[2]) < 40);
  const merchant = sunk(h, 'merchantGalleon', [300, 0, 0], 'local');
  const hauled = casksOf(merchant);
  assert.ok(hauled.length >= 2, 'her lots afloat');
  // one hauled aboard where it floats: my boat sails through it
  const f = h.host._shots.floater(hauled[0].id);
  f.pos[0] = 0; f.pos[2] = 0;
  h.run(0.3);
  assert.ok(given.length > 0 && given.every(isStolen), `hauled: ${given.length} things, every one her owner's`);
  // the rest by the crew's stow
  given.length = 0;
  h.host.stowPlunder();
  const cargo = given.filter((x) => x.name !== "Carpenter's Stores");
  assert.ok(cargo.length > 0 && cargo.every(isStolen), 'stowed: still stolen');
  assert.ok(given.length > cargo.length && !given.some((x) => !cargo.includes(x) && isStolen(x)), 'her wreckage\'s stores her fittings, no one\'s goods');
  // a pirate I sank, and a merchantman another sank: no theft of mine
  const pirate = sunk(h, 'pirateSloop', [0, 0, 300], 'local');
  given.length = 0;
  h.host.stowPlunder();
  assert.ok(given.some((x) => x.name !== "Carpenter's Stores") && !given.some(isStolen), 'a pirate\'s casks: fair prize');
  const theirs = sunk(h, 'merchantGalleon', [-300, 0, 0], 'peer-x');
  const drift = casksOf(theirs)[0];
  given.length = 0;
  const g = h.host._shots.floater(drift.id);
  g.pos[0] = 0; g.pos[2] = 0;
  h.run(0.3);
  assert.ok(given.length > 0 && !given.some(isStolen), 'another\'s sinking: salvage');
  assert.ok(pirate && theirs);
});

test('STOLEN-GOODS AUDIT S6: a town\'s patron takes no stolen piece off a hired trader - the record as the market\'s listing moves it (a realm trade\'s own take), the mark riding; the item law still stands behind it, so a player may buy it (mutants: the patron a fence)', () => {
  const shelf = smithShelf();
  const p = thief();
  const [dagger] = steal(shelf, p, [shelf.find((it) => it.templateIndex === DAGGER)]);
  const save = { items: [JSON.parse(JSON.stringify(dagger))], goldPieces: 0 };
  const [listed] = takeTradeGoods(save, { items: [JSON.parse(JSON.stringify(dagger))], gold: 0 }, [0]);
  assert.equal(listed.stolen, true, 'the listing\'s record carries it');
  assert.equal(lawfulItem(listed), true, 'a lawful record: listed, and a player\'s to buy');
  assert.equal(patronTakes(listed), false, 'no patron buys it');
  const found = createWeapon(DAGGER, 0, () => 0.5);
  assert.equal(patronTakes(found), true, 'an honest one, as ever');
});
