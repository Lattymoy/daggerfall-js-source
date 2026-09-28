// ENCHANT-LOAD (2026-09-26, DragynDance on the Discord: "Items with vanilla enchants buggy" - "Reloading a save with an
// enchanted item equipped makes you lose the enchantment until you take it off and put it on again"). A quest reward or
// an item-maker piece carries Daggerfall's own enchantments, and their constant half (EnhancesSkill, the armour pair,
// ExtraSpellPts, AbsorbsSpells, IncreasedWeightAllowance, ImprovesTalents) is a FOLD - derived, never saved - that only
// equipping and the magic round computed. A load rebuilt the equip table without it, and a magic round is a game minute
// of unpaused play that never comes while a window is up: the player loaded, opened the sheet, and the item read bare.
// The restore folds it now (enchantments.js restartHeldEnchantments), and two more of the load's losses with it: every
// Cast-When-Held power of an item stands, not only its last, and the item keeps its own reroll clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCHANTMENT_TYPES as T, setDefaultEnchantCtx, enchantmentMagicRound, computeEnchantmentMods, restartHeldEnchantments, REROLL_MINIMUM_HOURS,
  enchantSkillMod, enchantWeightAllowanceMult, entityAbsorbsSpells, EXTRA_SPELL_PTS_MAX_INCREASE,
} from '../src/systems/enchantments.js';
import { equipItem, unequipSlot } from '../src/systems/equip.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';

const ring = (enchantments, over = {}) => ({
  name: 'Made Ring', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, enchantments, ...over,
});
const player = (items, over = {}) => ({
  name: 'W', isPlayer: true, health: 20, maxHealth: 30, items, level: 5, stats: { strength: 50 }, skills: new Array(35).fill(40),
  skillUses: [], career: {}, magicka: 5, maxMagicka: 10, ...over,
});
/** Fortify, in SPELLS.STD's field shape: `stat` 0 strength, 3 agility; 3 rounds of 5, caster only. */
const fortify = (index, stat) => ({
  index, name: `Held Fortify ${index}`, rangeType: 0, element: 4,
  effects: [{
    type: 9, subType: stat, durationBase: 3, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  }],
});
const spells = (...recs) => () => new Map(recs.map((r) => [r.index, r]));
const roundTrip = (w) => JSON.parse(JSON.stringify(snapshotPlayer(w, {})));
const pinsOf = (w, item) => (w.activeEffects ?? []).filter((a) => a.heldItem === item);

test('ENCHANT-LOAD: a load folds the worn item\'s constant enchantments at once - no magic round, no re-equip', () => {
  setDefaultEnchantCtx({ spellsByIndex: spells(), now: () => 1000 });
  try {
    const worn = ring([{ type: T.EnhancesSkill, param: 5 }, { type: T.IncreasedWeightAllowance, param: 1 }, { type: T.AbsorbsSpells, param: -1 }]);
    const w = player([worn]);
    equipItem(w, worn);
    assert.equal(enchantSkillMod(w, 5), 15, 'worn: the skill reads +15 (EnhancesSkill.cs:28)');
    const loaded = { name: 'W2' };   // a boot load: a fresh entity, never folded
    restorePlayer(loaded, roundTrip(w));
    assert.equal(enchantSkillMod(loaded, 5), 15, 'loaded, before any round: +15 - it read 0 until the item was put on again');
    assert.equal(enchantWeightAllowanceMult(loaded), 0.5);
    assert.equal(entityAbsorbsSpells(loaded), true);
  } finally { setDefaultEnchantCtx(null); }
});

test('ENCHANT-LOAD: a load into the SAME entity forgets what the old game wore', () => {
  setDefaultEnchantCtx({ spellsByIndex: spells(), now: () => 1000 });
  try {
    const worn = ring([{ type: T.EnhancesSkill, param: 5 }]);
    const w = player([worn]);
    equipItem(w, worn);
    const bare = roundTrip(player([ring([{ type: T.EnhancesSkill, param: 5 }])]));   // the same ring, in the pack
    assert.equal(enchantSkillMod(w, 5), 15);
    restorePlayer(w, bare);
    assert.equal(enchantSkillMod(w, 5), 0, 'the in-session load read the old game\'s ring until the first round');
  } finally { setDefaultEnchantCtx(null); }
});

test('ENCHANT-LOAD: the restore\'s fold never cuts the magicka the save holds - the first round, at the live clock, clamps', () => {
  const winter = { spellsByIndex: spells(), now: () => 1000, season: () => 0 };
  setDefaultEnchantCtx(winter);
  try {
    const worn = ring([{ type: T.ExtraSpellPts, param: 0 }]);   // DuringWinter
    const w = player([worn]);
    restorePlayer(w, roundTrip(w));   // the live accessor, as every loaded entity has it
    const base = w.maxMagicka;
    equipItem(w, w.items[0]);
    assert.equal(w.maxMagicka, base + EXTRA_SPELL_PTS_MAX_INCREASE);
    w.magicka = base + 60;
    const snap = roundTrip(w);
    setDefaultEnchantCtx({ ...winter, season: () => 2 });   // a season read before the world has the save's clock back
    const loaded = { name: 'W2' };
    restorePlayer(loaded, snap);
    assert.equal(loaded.maxMagicka, base, 'folded at the wrong season: no +75 yet');
    assert.equal(loaded.magicka, base + 60, 'the save\'s magicka stands over it - DFU\'s clamp here cut it to the bare maximum');
    setDefaultEnchantCtx(winter);
    enchantmentMagicRound(loaded, 1, { nowMinutes: 1001 });
    assert.equal(loaded.maxMagicka, base + EXTRA_SPELL_PTS_MAX_INCREASE, 'the round folds at the live season');
    assert.equal(loaded.magicka, base + 60);
    // DFU's clamp (:1700-1702) is kept everywhere else
    const plain = { items: [], magicka: 50, maxMagicka: 10 };
    computeEnchantmentMods(plain, null, { clampMagicka: false });
    assert.equal(plain.magicka, 50);
    computeEnchantmentMods(plain);
    assert.equal(plain.magicka, 10);
  } finally { setDefaultEnchantCtx(null); }
});

test('ENCHANT-LOAD: every Cast-When-Held power of an item stands - on the equip, the reroll and the load (AssignBundle strips nothing; RerollItemEffects strips once per item)', () => {
  const str = fortify(4, 0), agi = fortify(5, 3);
  setDefaultEnchantCtx({ spellsByIndex: spells(str, agi), now: () => 1000 });
  try {
    const worn = ring([{ type: T.CastWhenHeld, param: 4 }, { type: T.CastWhenHeld, param: 5 }]);
    const w = player([worn]);
    equipItem(w, worn);
    assert.deepEqual(pinsOf(w, worn).map((a) => a.stat).sort(), ['agility', 'strength'], 'both powers ride the wearer - the second took the first off');
    const before = pinsOf(w, worn);
    enchantmentMagicRound(w, 5, { nowMinutes: 1000 + REROLL_MINIMUM_HOURS * 60 });
    const after = pinsOf(w, worn);
    assert.equal(after.length, 2, 'the reroll recasts both');
    assert.ok(after.every((a) => !before.includes(a)), 'fresh, the old pair stripped first');
    const loaded = { name: 'W2' };
    restorePlayer(loaded, roundTrip(w));
    const restored = loaded.items.find((it) => it.enchantments?.length === 2);
    assert.equal(pinsOf(loaded, restored).length, 2, 'and the load re-pins both');
    restartHeldEnchantments(loaded);
    assert.equal(pinsOf(loaded, restored).length, 2, 'a second restart strips the item\'s pair before it recasts - never four');
    unequipSlot(loaded, restored.equipSlot);
    assert.equal(pinsOf(loaded, restored).length, 0);
  } finally { setDefaultEnchantCtx(null); }
});

test('ENCHANT-LOAD: a load keeps the item\'s own reroll clock (saved with it, as DFU\'s is), not the session\'s', () => {
  const rec = fortify(4, 0);
  setDefaultEnchantCtx({ spellsByIndex: spells(rec), now: () => 1000 });
  try {
    const worn = ring([{ type: T.CastWhenHeld, param: 4 }]);
    const w = player([worn]);
    equipItem(w, worn);
    assert.equal(worn.timeEffectsLastRerolled, 1000);
    const snap = roundTrip(w);
    setDefaultEnchantCtx({ spellsByIndex: spells(rec), now: () => 9000 });   // the session played on; the save is older
    const loaded = { name: 'W2' };
    restorePlayer(loaded, snap);
    const restored = loaded.items.find((it) => it.enchantments?.length);
    assert.equal(restored.timeEffectsLastRerolled, 1000, 'stamped 9000, the six-hour reroll waited out the whole gap');
    assert.equal(pinsOf(loaded, restored).length, 1);
  } finally { setDefaultEnchantCtx(null); }
});
