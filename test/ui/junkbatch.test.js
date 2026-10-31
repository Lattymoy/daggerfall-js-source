// BATCH-JUNK and JUNK-RULES (a player's ask: junk for books, potions, ingredients and misc as well as gear; a Batch junk button that
// marks a category and rarity at once; and Always junk, a name that is junk for every copy, looted or not): systems/item/junkRules.js,
// ui/enhanced/junkBatchPanel.js, and the wiring in the pack and the counter (by source). Real items, the real refusals.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setPref, resetPrefs, _resetForTests } from '../../src/systems/uiPrefs.js';
import { canJunk, canJunkInBatch, junkRefusal, isAlwaysJunk, setAlwaysJunk, toggleAlwaysJunk, forgetAlwaysJunk, alwaysJunkNames, isJunkNow, junkName, JUNK_ALWAYS_PREF } from '../../src/systems/item/junkRules.js';
import { isJunk, setJunk } from '../../src/systems/item/itemJunk.js';
import { setLocked } from '../../src/systems/item/itemLock.js';
import { batchJunkPlan, applyBatchJunk, clearBatchJunk, passedOverWhy } from '../../src/ui/enhanced/junkBatchPanel.js';
import { FEATURES, resolveControl } from '../../src/systems/features.js';

beforeEach(() => { _resetForTests(); resetPrefs(); });
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const sword = (extra = {}) => ({ group: 'Weapons', templateIndex: 3, material: 0, name: 'Iron Sword', ...extra });
const beads = (extra = {}) => ({ group: 'ReligiousItems', templateIndex: 301, name: 'Prayer Beads', ...extra });   // (a template index under 78 is an ingredient's - ui/native/nativeInventory.js isIngredientTemplate - whatever the group)
const book = (extra = {}) => ({ group: 'Books', templateIndex: 277, name: 'Book of Poems', ...extra });
const junkPiece = (extra = {}) => ({ group: 'MiscItems', templateIndex: 300, name: 'Broken Cup', ...extra });

test('JUNK-RULES what may be marked: a book, a potion, an ingredient and a misc piece as much as gear; never a worn, a quest\'s, a summoned, a bound piece or gold, and the batch never a locked one (mutants: gear alone; a quest item marked; a lock lifted by a sweep)', () => {
  for (const it of [sword(), beads(), book(), junkPiece(), { group: 'UselessItems1', templateIndex: 0, name: 'Potion' }, { group: 'PlantIngredients1', templateIndex: 2, name: 'Red Rose' }]) assert.equal(canJunk(it), true, it.name);
  assert.equal(canJunk(null), false);
  assert.equal(canJunk(book({ questItem: true })), false, 'a quest\'s item');
  assert.match(junkRefusal(book({ questItem: true })), /Quest/);
  assert.equal(canJunk({ group: 'Currency', templateIndex: 0, name: 'Gold Pieces' }), false, 'gold');
  assert.equal(canJunk(beads({ timeForItemToDisappear: 120 })), false, 'a summoned piece');
  const locked = book(); setLocked(locked, true);
  assert.equal(canJunk(locked), true, 'a press may mark a locked piece - and lifts the lock (itemJunk.js setJunk)');
  assert.equal(canJunkInBatch(locked), false, 'a sweep never lifts a lock');
});

test('JUNK-RULES always junk: a name on the list makes every copy junk NOW - looted later, a different stack, any case - and never a piece that may not be junk; it comes off by the same press or the drawer (mutants: the name matched case-sensitively; a quest item of the same name made junk; the list lost across a sale)', () => {
  const a = beads();
  assert.equal(isJunkNow(a), false);
  assert.equal(toggleAlwaysJunk(a), true, 'listed');
  assert.deepEqual(alwaysJunkNames(), ['Prayer Beads']);
  assert.equal(isJunkNow(beads()), true, 'another copy, nothing marked on it');
  assert.equal(isJunkNow(beads({ name: 'PRAYER beads', stackCount: 3 })), true, 'any case, a stack');
  assert.equal(isJunkNow(beads({ name: 'Prayer Beads', questItem: true })), false, 'a quest\'s of that name is no junk');
  assert.equal(isJunk(a), false, 'nothing is written on the item: the rule is the list\'s');
  setJunk(a, true); setJunk(a, false);   // sold: the mark ends at the shelf
  assert.equal(isJunkNow(beads()), true, 'the list stands after a sale');
  assert.equal(toggleAlwaysJunk(a), false, 'off again');
  assert.equal(isJunkNow(beads()), false);
  // a piece that may not be junk is never put on the list
  assert.equal(setAlwaysJunk(book({ questItem: true }), true), false);
  assert.deepEqual(alwaysJunkNames(), []);
  setAlwaysJunk(book(), true); setAlwaysJunk(beads(), true);
  forgetAlwaysJunk('prayer BEADS');
  assert.deepEqual(alwaysJunkNames(), ['Book of Poems'], 'the drawer\'s × takes one name off');
  setPref(JUNK_ALWAYS_PREF, 'garbage');
  assert.deepEqual(alwaysJunkNames(), [], 'a bad stored word reads as empty');
  assert.equal(junkName({ name: '  Spaced  ' }), 'Spaced');
});

test('BATCH-JUNK plan: a category and a rarity choose the pieces; already-junk, worn, locked, quest and bound pieces are counted and never marked; Clear lifts the same pieces (mutants: the page ignored; a locked piece marked; a rarity ignored)', () => {
  const b1 = book(), b2 = book({ name: 'Almanac' }), b3 = book({ name: 'Locked Tome' }), b4 = book({ name: 'Quest Letter', questItem: true }), b5 = book({ name: 'Old Atlas' });
  setLocked(b3, true); setJunk(b5, true);
  const s = sword(), m = junkPiece(), r = sword({ name: 'Rare Sword', rarity: 'rare' });
  const pack = [b1, b2, b3, b4, b5, s, m, r];
  const sel = (pages, rarities = ['common']) => ({ pages: new Set(pages), rarities: new Set(rarities) });
  let plan = batchJunkPlan(pack, sel(['books']));
  assert.deepEqual(plan.mark.map((x) => x.name), ['Book of Poems', 'Almanac'], 'the books that may be marked');
  assert.deepEqual(plan.marked.map((x) => x.name), ['Old Atlas'], 'already junk: counted apart');
  assert.deepEqual(plan.skipped, { locked: 1, quest: 1 }, 'the locked and the quest\'s are passed over, and counted');
  assert.equal(passedOverWhy(b3), 'locked');
  assert.deepEqual(batchJunkPlan(pack, sel([])).mark, [], 'nothing chosen, nothing marked');
  // a rarity narrows: only Common swords by default, the Rare one with its tick
  assert.deepEqual(batchJunkPlan(pack, sel(['weapons'])).mark.map((x) => x.name), ['Iron Sword']);
  assert.deepEqual(batchJunkPlan(pack, sel(['weapons'], ['rare'])).mark.map((x) => x.name), ['Rare Sword']);
  assert.deepEqual(batchJunkPlan(pack, sel(['weapons'], ['common', 'rare'])).mark.map((x) => x.name), ['Iron Sword', 'Rare Sword']);
  assert.deepEqual(batchJunkPlan(pack, sel(['weapons'], []), false).mark.map((x) => x.name), ['Iron Sword', 'Rare Sword'], 'the ladder off: no tier to ask');
  // mark, then clear
  plan = batchJunkPlan(pack, sel(['books']));
  assert.equal(applyBatchJunk(plan), 2);
  assert.ok(isJunk(b1) && isJunk(b2) && !isJunk(b3) && !isJunk(b4), 'only the markable ones');
  assert.ok(b3.locked !== false, 'the lock is as it was');
  plan = batchJunkPlan(pack, sel(['books']));
  assert.equal(clearBatchJunk(plan), 3, 'Clear lifts the mark from every junk piece in the choice');
  assert.ok(!isJunk(b1) && !isJunk(b5));
});

test('JUNK-RULES the row: Always junk is a names list part of the Quick loot row with its own pref, empty by default; the pack, the counter and the batch are wired (by source; mutants: the list not in the row; the counter reading the old mark)', () => {
  const c = resolveControl(FEATURES.find((f) => f.id === 'quick-loot'));
  assert.ok(c.parts.some((p) => p.key === 'junkAlways' && p.list === 'names'));
  assert.deepEqual(c.also.find((a) => a.key === 'junkAlways').initial, []);
  const inv = rd('src/ui/enhanced/enhancedInventory.js');
  assert.match(inv, /if \(side === 'local' && !line\.equipped && canJunk\(picked\) && !isAlwaysLocked\(picked\)\) \{/, 'any piece the pack may let go of (and no name always locked)');
  assert.match(inv, /isAlwaysJunk\(picked\) \? t\('inventory\.junkAlways\.stop', 'Stop always junk'\) : t\('inventory\.junkAlways\.start', 'Always junk'\)/);
  assert.match(inv, /const junkMany = el\('button', 'act junkbtn'/, 'Batch junk beside Batch salvage, shown whether or not a piece would break');
  assert.match(inv, /if \(isJunkNow\(item\)\) node\.dataset\.junk = '';/);
  assert.match(rd('src/ui/enhanced/enhancedTrade.js'), /filter\(\(it\) => isJunkNow\(it\) && !equipped\(it\)/, 'Sell junk takes a listed name\'s pieces too');
  assert.match(rd('src/systems/quickLoot.js'), /if \(isJunk\(item\)\) return true;/, 'the take-all still leaves only a MARKED piece - a name always junk is looted, to be sold');
});

test('BATCH-JUNK locked: a locked piece that is already junk is passed over like any locked piece - not in the Clear list, and Clear never lifts its mark (mutants: the junk test before the lock test; Clear ignoring the lock)', () => {
  const kept = book({ name: 'Kept Tome' }), plain = book({ name: 'Plain Tome' });
  setJunk(kept, true); setLocked(kept, true); setJunk(plain, true);
  const sel = { pages: new Set(['books']), rarities: new Set(['common']) };
  const plan = batchJunkPlan([kept, plain], sel);
  assert.deepEqual(plan.marked.map((x) => x.name), ['Plain Tome'], 'only the unlocked one is Clear\'s');
  assert.deepEqual(plan.skipped, { locked: 1 }, 'the locked one is counted as passed over');
  assert.equal(clearBatchJunk(plan), 1);
  assert.ok(!isJunk(plain), 'the plain one is cleared');
  assert.ok(isJunk(kept), 'the locked one keeps its mark');
  assert.equal(clearBatchJunk({ marked: [kept] }), 0, 'even a plan handed the locked piece cannot lift it');
  assert.ok(isJunk(kept));
});
