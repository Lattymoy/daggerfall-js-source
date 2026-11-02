// BAL7 - THE LOOT THAT WINS ALONE (2026-10-12; bible/05-Combat/Balance-Arc.md section 13). BAL5 left a watch item -
// "the next measurement, which should wear the loot" - and the measurement wore it: a level-20 kit of the ladder's own
// pieces against an Ancient Lich in a Dragon's Den. Four powers decided the fight without the player in it:
//   - VAMPIRIC EFFECT when strikes, one Rare weapon flavour in eleven, healed every point a blow dealt: the plain build
//     went from 1.1 kills before it fell to 50 and counting with the one blade. Retired from the draw, as Troll's Blood.
//   - THE LEECH summed a weapon's line and its gems uncapped (an Exalted 10 and a Perfect Emerald's 7: 17% of every
//     landed blow): now at most 10, the top of a Legendary line's band, as the thorns are.
//   - HIST-SAP regenerated 2% a round (4% under half) - worth more than any guard: halved.
//   - OPEN HAND landed every bare-handed blow twice, whole: the second now for half.
//
// Pinned by execution through the real Rare mint (systems/loot/lootRarity.js applyRarity), the law (itemLaw.js), the strike
// listener and the magic round (systems/loot/lootPowers.js) and the host's door standing in.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { ENCHANTMENT_TYPES } from '../../src/systems/enchantments.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';

const T = ENCHANTMENT_TYPES;
const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 100 });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const sword = (affixes = []) => Object.assign(createWeapon(120, 0, () => 0.5), { rarity: 'rare', affixes });
function legendary(id) {
  const rec = LR.legendaryById(id);
  const t = rec.templates?.[0];
  const base = rec.group === 'Weapons' ? createWeapon(t ?? 120, 0, () => 0.5)
    : mintCondition({ group: rec.group, templateIndex: t ?? (rec.group === 'Armor' ? 102 : 135), material: rec.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}

test('BAL7 VAMPIRIC EFFECT: retired from the Rare weapon draw - three thousand seeded Rare blades never draw it and draw every other weapon flavour - while a piece that drew it stays lawful, and Gortwog\'s Cleaver keeps its record\'s (mutants: the retired flavour drawn; the mark dropped)', () => {
  fresh();
  const vamp = LR.RARE_FLAVOURS.Weapons.find((f) => f.type === T.VampiricEffect);
  assert.ok(vamp, 'still in the list - the law reads it');
  assert.equal(vamp.retired, true);
  const live = LR.RARE_FLAVOURS.Weapons.filter((f) => !f.retired).map((f) => `${f.type}:${f.param}`).sort();
  assert.equal(live.length, LR.RARE_FLAVOURS.Weapons.length - 1, 'Vampiric Effect alone is retired among the weapons');
  const drawn = new Set();
  for (let seed = 1; seed <= 3000; seed++) {
    const r = LR.applyRarity(createWeapon(120, 1, () => 0.5), 'rare', lcg(seed));
    const e = r.enchantments[0];
    assert.notEqual(e.type, T.VampiricEffect, `seed ${seed} drew Vampiric Effect`);
    drawn.add(`${e.type}:${e.param}`);
  }
  assert.deepEqual([...drawn].sort(), live, 'every other weapon flavour still drawn');
  const old = LR.applyRarity(createWeapon(120, 1, () => 0.5), 'rare', lcg(7));
  old.enchantments = [{ type: T.VampiricEffect, param: 1 }];
  assert.deepEqual(itemFindings(JSON.parse(JSON.stringify(old))), [], 'a blade that drew it before BAL7 is lawful and keeps it');
  assert.deepEqual(LR.legendaryById('gortwogs-cleaver').enchantment, { type: T.VampiricEffect, param: 1 }, 'the Cleaver\'s record is its own');
  // Troll's Blood stays retired beside it (BAL5)
  assert.equal(LR.RARE_FLAVOURS.Armor.find((f) => f.type === T.CastWhenHeld && f.param === 24).retired, true);
});

test('BAL7 THE LEECH: a weapon\'s lines and gems summed, at most 10% of the blow that landed (an Exalted 10 and a Perfect Emerald\'s 7 healed 17) (mutants: the cap at 17; the cap dropped)', () => {
  fresh();
  assert.equal(LP.LEECH_CAP, 10);
  const me = player();
  me.maxHealth = 1000; me.health = 100;
  const w = sword([{ id: 'leech', value: 10 }, { id: 'leech', value: 7, gem: 'perfect-emerald' }]);
  assert.deepEqual(LP.linesOf(w, 'leech').map((a) => a.value), [10, 7], 'both lines are read, the gem at its own piece cap');
  LP.lootStrike(me, { careerIndex: 7, career: {}, health: 50, maxHealth: 50 }, 100, w);
  assert.equal(me.health, 110, 'ten of a hundred, not seventeen');
  const under = sword([{ id: 'leech', value: 5 }]);
  LP.lootStrike(me, { careerIndex: 7, career: {}, health: 50, maxHealth: 50 }, 100, under);
  assert.equal(me.health, 115, 'a line under the cap heals its own share');
});

test('BAL7 HIST-SAP and OPEN HAND: the Mark regenerates 1% a round, 2% under half; the Gauntlets\' second bare-handed blow lands for half - and the cards say so (mutants: Hist-Sap at 2/4; the second blow whole)', () => {
  fresh();
  const hist = LR.powerOf('mark-of-the-hist');
  assert.deepEqual([hist.pct, hist.low], [1, 2]);
  assert.match(hist.text, /1% of your health, or 2% while below half/);
  let me = player();
  wear(me, legendary('mark-of-the-hist'));
  me.health = 60;
  LP.lootRound(me);
  assert.equal(me.health, 61, '1% a round');
  me.health = 40;
  LP.lootRound(me);
  assert.equal(me.health, 42, '2% under half');
  fresh();
  const open = LR.powerOf('gauntlets-of-the-rose');
  assert.equal(open.share, 50);
  assert.match(open.text, /50% of its damage/);
  me = player();
  wear(me, legendary('gauntlets-of-the-rose'));
  const struck = { careerIndex: 7, career: {}, health: 100, maxHealth: 100 };
  const hurts = [];
  setPlayerDoor({ foes: () => [{ name: 'struck', entity: struck, ai: { feet: [0, 0, 0] }, dead: false }], feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push(n), castOnPlayer: () => {}, player: () => me });
  LP.lootStrike(me, struck, 20, null);
  assert.deepEqual(hurts, [10], 'a bare-handed blow of 20 strikes again for 10');
  LP.lootStrike(me, struck, 1, null);
  assert.deepEqual(hurts, [10, 1], 'never less than a point');
  LP.lootStrike(me, struck, 20, createWeapon(120, 0, () => 0.5));
  assert.equal(hurts.length, 2, 'a weapon\'s blow does not');
});
