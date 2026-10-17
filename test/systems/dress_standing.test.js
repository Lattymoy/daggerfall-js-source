// DRESS1 (2026-09-30, Discord: "Add positive and negative reputation
// buffs for clothing items... common clothes ... Commoner +, Noble -
// ... temple-specific robes with a positive buff for that temple
// faction"): the clothing reaction - classification, sums and caps,
// the magic-round hook (live even with nothing enchanted worn), the
// temple term in getReactionToPlayer, and the Standing page's line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dressClassOf, dressStanding, applyDressStanding, dressTempleBonus, DRESS_CLASS, DRESS_CAP,
} from '../../src/systems/clothingStanding.js';
import { enchantmentMagicRound } from '../../src/systems/enchantments.js';
import { equipItem, unequipItem } from '../../src/systems/equip.js';
import { getReactionToPlayer } from '../../src/systems/talk/talk.js';
import { FACTION_TYPES, SOCIAL_GROUP_COUNT } from '../../src/formats/factionFile.js';
import { dressLine } from '../../src/ui/enhanced/enhancedMenu.js';
import TEMPLATES from '../../src/characters/itemTemplates.json' with { type: 'json' };

const nameOf = (i) => (Array.isArray(TEMPLATES) ? TEMPLATES : Object.values(TEMPLATES)).find((t) => (t.index ?? t.Index) === i)?.name;
const garment = (templateIndex, group = templateIndex >= 182 ? 'WomensClothing' : 'MensClothing') => ({ group, templateIndex, condition: 100, maxCondition: 100 });
const player = () => ({ isPlayer: true, items: [], reactionMods: new Array(SOCIAL_GROUP_COUNT).fill(0), sGroupReputations: new Array(SOCIAL_GROUP_COUNT).fill(0), biographyReactionMod: 0 });
const wear = (p, ...items) => { for (const it of items) { p.items.push(it); equipItem(p, it); } return p; };

test('DRESS1: the classification reads the template names', () => {
  assert.equal(nameOf(151), 'Casual Pants');
  assert.equal(dressClassOf(garment(151)), DRESS_CLASS.Common);
  assert.equal(nameOf(184), 'Peasant Blouse');
  assert.equal(dressClassOf(garment(184)), DRESS_CLASS.Common);
  assert.equal(nameOf(163), 'Plain Robes');
  assert.equal(dressClassOf(garment(163)), DRESS_CLASS.Common);
  assert.equal(nameOf(155), 'Formal Cloak');
  assert.equal(dressClassOf(garment(155)), DRESS_CLASS.Fine);
  assert.equal(nameOf(195), 'Evening Gown');
  assert.equal(dressClassOf(garment(195)), DRESS_CLASS.Fine);
  assert.equal(nameOf(194), 'Formal Eodoric');
  assert.equal(dressClassOf(garment(194)), DRESS_CLASS.Fine);
  assert.equal(nameOf(164), 'Priest Robes');
  assert.equal(dressClassOf(garment(164)), DRESS_CLASS.Religious);
  assert.equal(nameOf(201), 'Priestess Robes');
  assert.equal(dressClassOf(garment(201)), DRESS_CLASS.Religious);
  assert.equal(dressClassOf(garment(148)), null, 'Tall Boots are neutral');
  assert.equal(dressClassOf({ group: 'Armor', templateIndex: 151 }), null, 'only clothing groups count');
});

test('DRESS1: per-group sums - common, fine, religious', () => {
  const c = wear(player(), garment(151), garment(154));   // Casual Pants + Casual Cloak
  assert.deepEqual(dressStanding(c), { groups: [6, 0, 0, -6, 0], temple: 0 });
  const f = wear(player(), garment(159), garment(155));   // Formal Tunic + Formal Cloak
  assert.deepEqual(dressStanding(f), { groups: [-2, 2, 0, 6, 0], temple: 0 });
  const r = wear(player(), garment(164));
  assert.deepEqual(dressStanding(r), { groups: [0, 0, 1, 0, 0], temple: 3 });
});

test('DRESS1: every group is capped at +/-10', () => {
  const p = player();
  p.equip = { slots: new Array(27).fill(null) };
  for (const s of [14, 16, 17, 24, 26]) p.equip.slots[s] = garment(151);   // five common garments: 15 raw
  const d = dressStanding(p);
  assert.equal(d.groups[0], DRESS_CAP);
  assert.equal(d.groups[3], -DRESS_CAP);
});

test('DRESS1: the magic-round hook runs with NO enchanted item worn, and is live (cleared each round)', () => {
  const p = wear(player(), garment(151));
  enchantmentMagicRound(p, 1);
  assert.equal(p.reactionMods[0], 3, 'Commoners +3');
  assert.equal(p.reactionMods[3], -3, 'Nobility -3');
  assert.equal(getReactionToPlayer({ rep: 0, sgroup: 0 }, p), 3);
  assert.equal(getReactionToPlayer({ rep: 0, sgroup: 3 }, p), -3);
  enchantmentMagicRound(p, 2);
  assert.equal(p.reactionMods[0], 3, 'no accumulation across rounds');
  unequipItem(p, p.items[0]);
  enchantmentMagicRound(p, 3);
  assert.deepEqual([...p.reactionMods], new Array(SOCIAL_GROUP_COUNT).fill(0), 'take it off and the next round forgets it');
});

test('DRESS1: unequipped clothing in the bag does nothing', () => {
  const p = player();
  p.items.push(garment(151), garment(164));
  assert.deepEqual(dressStanding(p), { groups: [0, 0, 0, 0, 0], temple: 0 });
  enchantmentMagicRound(p, 1);
  assert.deepEqual([...p.reactionMods], new Array(SOCIAL_GROUP_COUNT).fill(0));
  assert.equal(dressLine(p), '');
});

test('DRESS1: priest robes warm TEMPLE factions only', () => {
  const p = wear(player(), garment(164));
  applyDressStanding(p);
  const temple = { rep: 0, sgroup: 2, type: FACTION_TYPES.Temple };
  const guild = { rep: 0, sgroup: 2, type: FACTION_TYPES.Group };
  assert.equal(dressTempleBonus(temple, p), 3);
  assert.equal(dressTempleBonus(guild, p), 0);
  assert.equal(getReactionToPlayer(temple, p), 4, 'Scholars +1 and the temple +3');
  assert.equal(getReactionToPlayer(guild, p), 1);
});

test('DRESS1: non-players are untouched; the Standing line names the groups', () => {
  const npc = wear({ items: [] }, garment(151));
  assert.equal(applyDressStanding(npc), null);
  assert.equal(npc._dressStanding, undefined);
  assert.equal(dressLine(wear(player(), garment(164))), 'Scholars +1, Temples +3');
  assert.equal(dressLine(wear(player(), garment(151))), 'Commoners +3, Nobility -3');
});
