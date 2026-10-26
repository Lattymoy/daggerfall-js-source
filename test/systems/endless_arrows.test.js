// ENDLESS-ARROWS (2026-10-23, the owner: "give general stores always arrows for each player to buy they cant exhaust"):
// A GENERAL STORE'S QUIVER NEVER EMPTIES (systems/shopStock.js) - a whole quiver on its counter at any quality, filled
// back after every purchase that takes arrows, offline and online; every other storefront's sells out as SHOP-ARROWS says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stockShopShelf, restockEndless, shopArrowStack, endlessArrowsAt, GENERAL_STORE_ARROWS, SHOP_ARROWS_MAX } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES as B } from '../../src/world/buildingNames.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';

const arrows = (items) => items.filter((it) => it.group === 'Weapons' && it.templateIndex === ARROW_TEMPLATE);
const count = (items) => arrows(items).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const stock = (b, q, shelfIndex = 0) => stockShopShelf({ buildingType: b, quality: q }, { level: 5 }, { rolls: () => 0.999, shelfIndex, torchesFromItems: false });

test('ENDLESS-ARROWS: a General Store\'s counter holds a whole quiver at any quality; the shelves behind it none of their own, and the other storefronts their SHOP-ARROWS stack (mutants: the quality\'s stack; every shop endless)', () => {
  assert.equal(GENERAL_STORE_ARROWS, SHOP_ARROWS_MAX);
  assert.equal(endlessArrowsAt(B.GeneralStore), true);
  for (const b of [B.WeaponSmith, B.Armorer, B.PawnShop, B.Alchemist]) assert.equal(endlessArrowsAt(b), false, `building ${b}`);
  for (const q of [1, 9, 20]) assert.equal(count(stock(B.GeneralStore, q)), GENERAL_STORE_ARROWS, `quality ${q}`);
  assert.equal(count(stock(B.GeneralStore, 9, 1)), 0, 'a shelf behind the counter');
  assert.equal(count(stock(B.Armorer, 9)), shopArrowStack(B.Armorer, 9));
});

test('ENDLESS-ARROWS: a purchase that takes arrows fills a General Store\'s quiver back - part of it or all of it, offline - and nothing else\'s; a lot with no arrows leaves it (mutants: offline left out; another shop filled; the fill past a lot with no arrows)', () => {
  const shelf = stock(B.GeneralStore, 5);
  const [quiver] = arrows(shelf);
  quiver.stackCount -= 30;
  const bought = { ...quiver, stackCount: 30 };
  assert.equal(restockEndless(shelf, [bought], B.GeneralStore), 1);
  assert.equal(count(shelf), GENERAL_STORE_ARROWS, 'part of it: filled back');
  shelf.splice(shelf.indexOf(quiver), 1);
  assert.equal(restockEndless(shelf, [quiver], B.GeneralStore), 1);
  assert.equal(count(shelf), GENERAL_STORE_ARROWS, 'all of it: a fresh quiver stood');
  const [fresh] = arrows(shelf);
  assert.deepEqual([fresh.material, fresh.value > 0, fresh.name], [quiver.material, true, quiver.name], 'minted as the shelf mints its own');
  fresh.stackCount = 10;
  assert.equal(restockEndless(shelf, [{ group: 'Weapons', templateIndex: 113 }], B.GeneralStore), 0, 'a dagger bought: the quiver untouched');
  assert.equal(count(shelf), 10);
  const armorer = stock(B.Armorer, 5);
  const [aq] = arrows(armorer);
  armorer.splice(armorer.indexOf(aq), 1);
  assert.equal(restockEndless(armorer, [aq], B.Armorer), 0);
  assert.equal(count(armorer), 0, 'an Armorer\'s sells out');
  assert.equal(restockEndless(shelf, [quiver]), 0, 'no shop named: nothing filled');
});

test('ENDLESS-ARROWS wired (by source): the counter\'s commit and the keyed list both name their shop to restockEndless - for the counter\'s shelf alone (mutants: the commit unnamed; any shelf a quiver)', () => {
  const w = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  // PIN MOVED (AUDIT UPDATE E2, E-N7): the shop read where the restock is made, and only for the counter's shelf - a
  // back shelf's drawn arrows, or a row a player sold there, are no endless quiver
  assert.match(w, /restockEndless\(shelf\.items, staged, shelf === interiorCtx\?\.shelves\?\.\[0\] \? interiorBuilding\?\.buildingType : null\);/);
  assert.match(w, /restockEndless\(shelf\.items, \[it\], shelf === interiorCtx\?\.shelves\?\.\[0\] \? interiorBuilding\?\.buildingType : null\);/);
  assert.doesNotMatch(w, /buildingType: b\.buildingType \}/, 'the commit\'s asks carry no shop (E-N7: no host line for it)');
});

// AUDIT UPDATE (2026-10-25, bible/01-Overview/audits/Audit-Update-2026-10-25.md): lane E's laws of the quiver
test('AUDIT UPDATE E1: a purchase puts back what it took, never the whole - arrows stolen stay gone, so a theft and one arrow bought is one arrow sold (mutants: the whole filled; the theft refilled)', () => {
  const shelf = stock(B.GeneralStore, 5);
  const [quiver] = arrows(shelf);
  quiver.stackCount = 40;   // sixty stolen
  assert.equal(restockEndless(shelf, [{ ...quiver, stackCount: 10 }], B.GeneralStore), 1);
  assert.equal(count(shelf), 50, 'forty left, ten bought and ten put back: the theft stays gone');
  quiver.stackCount = 1;   // ninety-nine stolen, the last bought whole
  shelf.splice(shelf.indexOf(quiver), 1);
  assert.equal(restockEndless(shelf, [{ ...quiver, stackCount: 1 }], B.GeneralStore), 1);
  assert.equal(count(shelf), 1, 'one arrow bought: one put back, never a fresh hundred');
});

test('AUDIT UPDATE E3: a counter quiver over the whole (DFU\'s own drawn arrows merged in) is never cut back; a lot of arrows and a dagger puts the arrows back; a fresh quiver stands at the shelf\'s own condition (mutants: the whole read as exactly it; every row an arrow asked; the mint\'s condition skipped)', () => {
  const shelf = stock(B.GeneralStore, 5);
  const [quiver] = arrows(shelf);
  quiver.stackCount = 102;   // 104 stocked, two bought
  assert.equal(restockEndless(shelf, [{ ...quiver, stackCount: 2 }], B.GeneralStore), 0);
  assert.equal(count(shelf), 102, 'left as it stands');
  quiver.stackCount = 80;
  assert.equal(restockEndless(shelf, [{ ...quiver, stackCount: 20 }, { group: 'Weapons', templateIndex: 113 }], B.GeneralStore), 1);
  assert.equal(count(shelf), GENERAL_STORE_ARROWS, 'the arrows of a mixed lot put back');
  const was = { ...quiver };
  shelf.splice(shelf.indexOf(quiver), 1);
  restockEndless(shelf, [{ ...quiver, stackCount: GENERAL_STORE_ARROWS }], B.GeneralStore);
  const [fresh] = arrows(shelf);
  assert.deepEqual([fresh.currentCondition, fresh.maxCondition, fresh.value], [was.currentCondition, was.maxCondition, was.value], 'minted as the shelf mints its own, condition and price');
});

// AUDIT UPDATE II (2026-10-25, bible/01-Overview/audits/Audit-Update-II-2026-10-25.md) B2
test('AUDIT UPDATE II B2: an arrow sold at a General Store\'s counter is paid for and never shelved, so a sale bought back never reads as arrows taken from its quiver; every other piece and shelf lands as STOLEN-GOODS says (mutants: the counter\'s arrows shelved; every shop\'s refused)', async () => {
  const { landSoldAt } = await import('../../src/systems/shopStock.js');
  const shelf = stock(B.GeneralStore, 5);
  const [quiver] = arrows(shelf);
  shelf.splice(shelf.indexOf(quiver), 1);   // the quiver stolen whole
  const mine = { ...quiver, stackCount: 100 };   // the player's own hundred, sold
  assert.equal(landSoldAt(shelf, mine, B.GeneralStore), false, 'paid for, not shelved');
  assert.equal(count(shelf), 0, 'so nothing of it to buy back');
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger' };
  assert.equal(landSoldAt(shelf, dagger, B.GeneralStore), true, 'any other piece lands');
  const armorer = stock(B.Armorer, 5);
  const n = count(armorer);
  assert.equal(landSoldAt(armorer, { ...mine }, B.Armorer), true);
  assert.equal(count(armorer), n + 100, 'an Armorer shelves the arrows sold to it');
  assert.equal(landSoldAt(shelf, { ...mine }, null), true, 'a shelf behind the counter (no shop named) lands them');
});
