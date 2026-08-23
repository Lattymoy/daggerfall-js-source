// E2: THE ENCHANTMENT CAST SEAMS - CastWhenHeld's item-pinned held
// bundles, CastWhenUsed's use ladder, CastWhenStrikes' landing, the
// classic-reversed casting cost, and the host ctx mount
// (setDefaultEnchantCtx). DFU sources: CastWhenHeld/Used/Strikes.cs,
// EntityEffectManager.cs (StartHeldItem :1045, UnequipHeldItem :1065,
// DoMagicRound :1733 "item effects are always ticked",
// RerollItemEffects :2001), ItemEquipTable.cs (:149/:163 the payload
// doors), FormulaHelper.CalculateCastingCost (:2411).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCHANTMENT_TYPES as T, PAYLOAD, doItemEnchantmentPayloads,
  setDefaultEnchantCtx, assignHeldSpell, restartHeldEnchantments,
  enchantmentMagicRound, REROLL_MINIMUM_HOURS,
  DURABILITY_LOSS_ON_USE, DURABILITY_LOSS_ON_STRIKE,
} from '../src/systems/enchantments.js';
import { applySpell, tickActiveEffects, removeItemPinnedEffects } from '../src/systems/effects.js';
import { classicCastingCost } from '../src/systems/spellcost.js';
import { equipItem, unequipSlot } from '../src/systems/equip.js';
import { useItem } from '../src/systems/useItem.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';

const item = (type, param = -1, over = {}) => ({
  name: 'Test Item', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100,
  enchantments: [{ type, param }], ...over,
});
const wearer = (items, over = {}) => ({ name: 'W', health: 20, maxHealth: 30, items, level: 5, stats: {}, skills: 40, career: {}, ...over });

// A Fortify Strength record in the classic SPELLS.STD field shape:
// 3 rounds, magnitude 5 flat, CasterOnly.
const fortifyRecord = () => ({
  index: 4, name: 'Held Fortify', rangeType: 0, element: 4,
  effects: [{
    type: 9, subType: 0, durationBase: 3, durationMod: 0, durationPerLevel: 1,
    chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  }],
});
const spellMap = (rec) => () => new Map([[rec.index, rec]]);
const mountCtx = (ctx) => setDefaultEnchantCtx(ctx);

test('E2 classic cost: CalculateCastingCost, hand-computed both arms (:2411-2477)', () => {
  // Levitate (type 14, settings type 3): 15*durBase + trunc(durMod/
  // durPer)*25 = 15 + 250 = 265; item arm skill 50 -> trunc(265*60/
  // 100) = 159; range 0 modifier 2 >> 1 leaves it.
  const rec = { rangeType: 0, effects: [
    { type: 14, subType: -1, durationBase: 1, durationMod: 10, durationPerLevel: 1,
      chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
      magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 },
  ] };
  assert.equal(classicCastingCost(rec), 159, 'the enchanting arm pins skill at 50 (:2440)');
  assert.equal(classicCastingCost(rec, () => 110), 5, 'a 110 skill zeroes the cost and the floor of 5 holds');
  // Fortify (type 9, settings type 6, coef 0x0C): 7*3 + 5*10 = 71;
  // at live skill 40 -> trunc(71*70/100) = 49.
  assert.equal(classicCastingCost(fortifyRecord(), () => 40), 49);
});

test('E2 held: the equip door assigns the pinned bundle, bills the casting cost, stamps the reroll clock', () => {
  const rec = fortifyRecord();
  mountCtx({ spellsByIndex: spellMap(rec), now: () => 1000 });
  try {
    const ring = item(T.CastWhenHeld, 4);
    const w = wearer([ring]);
    equipItem(w, ring);
    const pin = (w.activeEffects ?? []).find((a) => a.heldItem === ring);
    assert.ok(pin, 'StartHeldItem: the spell rides activeEffects pinned to the item');
    assert.equal(pin.kind, 'fortifyAttribute');
    assert.equal(ring.currentCondition, 100 - 49, 'the wearer pays the CLASSIC casting cost in condition (InstantiateSpellBundle)');
    assert.equal(ring.timeEffectsLastRerolled, 1000, 'equip stamps timeEffectsLastRerolled');
    // DoMagicRound :1733: item effects are ALWAYS ticked - the entry
    // outlives its 3 rounds while the item stays worn
    for (let i = 0; i < 10; i++) tickActiveEffects(w, {});
    assert.ok(w.activeEffects.find((a) => a.heldItem === ring), 'held entries never expire by rounds');
    // ...and the unequip door strips it (UnequipHeldItem :1074-1084)
    unequipSlot(w, ring.equipSlot);
    assert.ok(!(w.activeEffects ?? []).some((a) => a.heldItem === ring), 'unequip removed the pinned bundle');
  } finally { mountCtx(null); }
});

test('E2 held: a pinned bundle NEVER merges with a spell instance - two entries, separate lives', () => {
  const rec = fortifyRecord();
  const w = wearer([]);
  const ring = item(T.CastWhenHeld, 4, { equipSlot: 9 });
  assignHeldSpell(rec, w, ring, { recast: true });
  // the same fortify CAST normally joins as its OWN entry (DFU keeps
  // the HeldMagicItem bundle beside the spell bundle)
  applySpell(rec, 5, w, {}, () => 0.5);
  const forts = w.activeEffects.filter((a) => a.kind === 'fortifyAttribute');
  assert.equal(forts.length, 2, 'no F12 merge across the pin boundary');
  // the spell copy expires on its own; the pin stays
  for (let i = 0; i < 6; i++) tickActiveEffects(w, {});
  const left = w.activeEffects.filter((a) => a.kind === 'fortifyAttribute');
  assert.equal(left.length, 1);
  assert.equal(left[0].heldItem, ring);
  removeItemPinnedEffects(w, ring);
  assert.equal(w.activeEffects.length, 0);
});

test('E2 reroll: six worn hours re-instantiate the held bundle and restamp (rerollMinimumHours, :1745/:2001)', () => {
  const rec = fortifyRecord();
  mountCtx({ spellsByIndex: spellMap(rec), now: () => 1000 });
  try {
    const ring = item(T.CastWhenHeld, 4);
    const w = wearer([ring], { isPlayer: true });
    equipItem(w, ring);
    const condAfterEquip = ring.currentCondition;
    const firstPin = w.activeEffects.find((a) => a.heldItem === ring);
    enchantmentMagicRound(w, 5, { nowMinutes: 1000 + REROLL_MINIMUM_HOURS * 60 });
    assert.equal(ring.timeEffectsLastRerolled, 1000 + REROLL_MINIMUM_HOURS * 60, 'the reroll restamped the clock');
    const newPin = w.activeEffects.find((a) => a.heldItem === ring);
    assert.ok(newPin && newPin !== firstPin, 'the bundle was recast fresh');
    assert.equal(ring.currentCondition, condAfterEquip, 'a recast bills NO casting cost (:2026 fires with recast=true)');
    // one round short of the threshold does nothing
    enchantmentMagicRound(w, 6, { nowMinutes: 1000 + REROLL_MINIMUM_HOURS * 60 + 59 });
    assert.equal(ring.timeEffectsLastRerolled, 1000 + REROLL_MINIMUM_HOURS * 60);
  } finally { mountCtx(null); }
});

test('E2 used: the inventory ladder fires the Used payload - CasterOnly to self, others to the ready slot (:1809)', () => {
  const rec = fortifyRecord();
  const self = [], readied = [];
  mountCtx({ spellsByIndex: spellMap(rec), applySpellToSelf: (r) => self.push(r), setReadySpell: (r) => readied.push(r) });
  try {
    const wand = item(T.CastWhenUsed, 4);
    const w = wearer([]);
    const r = useItem(wand, [wand], { entity: w, isEnchanted: () => true, nowMinute: 50 });
    assert.equal(r.enchanted, true);
    assert.equal(r.closesWindow, true);
    assert.ok(!r.pending, 'the arm is live, not pending');
    assert.deepEqual(self, [rec], 'CasterOnly assigns straight to the user (CastWhenUsed.cs:120-141)');
    assert.equal(wand.currentCondition, 100 - DURABILITY_LOSS_ON_USE);
    // a ranged record loads the ready slot as a FREE cast instead
    const ranged = { ...rec, index: 7, rangeType: 2 };
    mountCtx({ spellsByIndex: spellMap(ranged), applySpellToSelf: (x) => self.push(x), setReadySpell: (x) => readied.push(x) });
    useItem(item(T.CastWhenUsed, 7), null, { entity: w, isEnchanted: () => true });
    assert.deepEqual(readied, [ranged], 'SetReadySpell(bundle, true)');
    // a BROKEN item answers durability alone - no cast (its gate)
    const dead = item(T.CastWhenUsed, 7, { currentCondition: 0 });
    const w2 = wearer([dead]);
    useItem(dead, w2.items, { entity: w2, isEnchanted: () => true });
    assert.equal(readied.length, 1, 'the broken gate skipped the cast');
  } finally { mountCtx(null); }
});

test('E2 strikes: CastWhenStrikes lands the spell on the TARGET through the merged host ctx, weapon pays 10', () => {
  const rec = { ...fortifyRecord(), rangeType: 2 };
  const landed = [];
  mountCtx({ spellsByIndex: spellMap(rec), applySpellToTarget: (r, from, to) => landed.push([r, from, to]) });
  try {
    const sword = item(T.CastWhenStrikes, 4, { group: ITEM_GROUPS.Weapons, templateIndex: 113 });
    const w = wearer([]);
    const foe = { mobileType: 3 };
    const out = doItemEnchantmentPayloads(PAYLOAD.Strikes, sword, { entity: w, target: foe, damage: 6 });
    assert.equal(out, 6);
    assert.deepEqual(landed, [[rec, w, foe]], 'the ctx was the MOUNTED one - no per-call ctx passed');
    assert.equal(sword.currentCondition, 100 - DURABILITY_LOSS_ON_STRIKE);
    // no target / zero damage = nothing (CastWhenStrikes' guard)
    doItemEnchantmentPayloads(PAYLOAD.Strikes, sword, { entity: w, target: foe, damage: 0 });
    assert.equal(landed.length, 1);
  } finally { mountCtx(null); }
});

test('E2 break: enchantment wear CONSUMES a broken item unless AllowMagicRepairs (LowerCondition\'s collection arm)', () => {
  const rec = fortifyRecord();
  mountCtx({ spellsByIndex: spellMap(rec), now: () => 0 });
  try {
    const wand = item(T.CastWhenUsed, 4, { currentCondition: DURABILITY_LOSS_ON_USE });
    const w = wearer([wand]);
    useItem(wand, w.items, { entity: w, isEnchanted: () => true });
    assert.equal(w.items.length, 0, 'the break on the Used bill removed it from the collection');
    mountCtx({ spellsByIndex: spellMap(rec), now: () => 0, allowMagicRepairs: true });
    const wand2 = item(T.CastWhenUsed, 4, { currentCondition: DURABILITY_LOSS_ON_USE });
    const w2 = wearer([wand2]);
    useItem(wand2, w2.items, { entity: w2, isEnchanted: () => true });
    assert.equal(w2.items.length, 1, 'AllowMagicRepairs keeps the husk');
    assert.equal(wand2.currentCondition, 0);
  } finally { mountCtx(null); }
});

test('E2 bypassChance: AssignBundleFlags.BypassChance forces a chance-based effect through a failing roll', () => {
  const paralyzeRec = { rangeType: 0, element: 4, effects: [{
    type: 0, subType: -1, durationBase: 5, durationMod: 0, durationPerLevel: 1,
    chanceBase: 1, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  }] };
  const plain = wearer([]);
  const r1 = applySpell(paralyzeRec, 5, plain, {}, () => 0.99);
  assert.ok(!r1.paralyzed, 'a 1% chance fails on a 0.99 roll');
  const r2 = applySpell(paralyzeRec, 5, wearer([]), {}, () => 0.99, null, { bypassChance: true });
  assert.equal(r2.paralyzed, 1, 'BypassChance lands it');
});

test('E2 save: pinned entries are NOT serialized; the restore re-instantiates them from the worn set (:2240/:2312)', () => {
  const rec = fortifyRecord();
  mountCtx({ spellsByIndex: spellMap(rec), now: () => 1000 });
  try {
    const ring = item(T.CastWhenHeld, 4);
    const w = wearer([ring], { isPlayer: true, stats: { strength: 50 }, skills: [40], skillUses: [], magicka: 5, maxMagicka: 10 });
    equipItem(w, ring);
    const condWorn = ring.currentCondition;
    assert.ok(w.activeEffects.some((a) => a.heldItem === ring));
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(w, {})));
    assert.ok(!snap.activeEffects.some((a) => a.heldItem), 'no pin crosses the envelope - it could never re-link');
    const w2 = { name: 'W2' };
    restorePlayer(w2, snap);
    const restoredRing = w2.items.find((it) => it.enchantments);
    assert.ok(restoredRing && restoredRing !== ring);
    const pin = (w2.activeEffects ?? []).find((a) => a.heldItem === restoredRing);
    assert.ok(pin, 'restartHeldEnchantments re-pinned the RESTORED record');
    assert.equal(restoredRing.currentCondition, condWorn, 'the restore recast bills no durability');
  } finally { mountCtx(null); }
});

test('E2 restart: restartHeldEnchantments honours the unknown-key abort per item', () => {
  const rec = fortifyRecord();
  const bad = item(T.VisionProblems, 0);
  bad.enchantments.push({ type: T.CastWhenHeld, param: 4 });
  bad.equipSlot = 9;
  const w = wearer([bad]);
  restartHeldEnchantments(w, { spellsByIndex: spellMap(rec) });
  assert.ok(!(w.activeEffects ?? []).length, 'the unknown key before CastWhenHeld aborted the item, DFU\'s own walk');
});
