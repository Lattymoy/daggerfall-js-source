// @ts-check
// REVENANT-TROPHY (2026-10-02, Mac: "Killing should show a unique animation where you destroy your foe, which drops a
// unique weapon random rarity weapon specific to the enemy, with their name included in the weapon name").
//
// WHAT IT DROPS. One weapon, its own:
//  - SPECIFIC TO IT: the weapon it fought with when it carried one (a person's best blade), else the one its kind
//    would wield - an orc's axe, a lich's staff, a vampire's saber, a bear's claw-axe, a centaur's bow - and a person
//    by its class (a Barbarian's claymore, an Assassin's tanto, an Archer's longbow);
//  - NAMED FOR IT: "<its given name>'s <a word for the weapon>" - "Grushnak's Reaver", "Varis's Requiem" - the word
//    drawn from the revenant's id, so one revenant's trophy is always called the same;
//  - A RANDOM RARITY, never Common: Magic, Rare or Legendary, the better ones likelier the higher its rank;
//  - of a better material than the street's - the best of two rolls at the player's level.
// Pre-rolled when the revenant yields, so the choice shows exactly what killing it gives.
import { createWeapon, randomMaterial, WEAPONS_ENUM } from '../../combat/enemyEquipment.js';
import { mintCondition, setItemFields, templateByIndex } from '../item/itemTemplates.js';
import { applyRarity } from '../loot/lootRarity.js';
import { MOBILE_TYPES as M } from '../../characters/mobile/mobileTypes.js';
import { possessive } from './revenantPersonality.js';   // one possessive for every title

const W = WEAPONS_ENUM;
/** The weapons each kind would wield (characters/mobile/mobileTypes.js ids), by template. */
export const TROPHY_KIND_WEAPONS = Object.freeze({
  [M.Rat]: [W.Dagger], [M.Imp]: [W.Dagger, W.Tanto], [M.Spriggan]: [W.Staff], [M.GiantBat]: [W.Dagger],
  [M.GrizzlyBear]: [W['War Axe']], [M.SabertoothTiger]: [W.Tanto, W.Katana], [M.Spider]: [W.Dagger],
  [M.Orc]: [W['War Axe'], W['Battle Axe']], [M.Centaur]: [W['Long Bow'], W.Longsword], [M.Werewolf]: [W.Dagger, W.Tanto],
  [M.Nymph]: [W['Short Bow'], W.Staff], [M.Slaughterfish]: [W.Tanto], [M.OrcSergeant]: [W['Battle Axe'], W.Broadsword],
  [M.Harpy]: [W.Saber, W.Dagger], [M.Wereboar]: [W.Mace, W.Flail], [M.SkeletalWarrior]: [W.Broadsword, W.Claymore],
  [M.Giant]: [W.Warhammer, W.Mace], [M.Zombie]: [W.Mace, W.Flail], [M.Ghost]: [W['Dai-Katana'], W.Katana],
  [M.Mummy]: [W.Saber, W.Wakazashi], [M.GiantScorpion]: [W.Shortsword], [M.OrcShaman]: [W.Staff],
  [M.Gargoyle]: [W.Warhammer, W.Mace], [M.Wraith]: [W['Dai-Katana'], W.Katana], [M.OrcWarlord]: [W.Claymore, W['Battle Axe']],
  [M.FrostDaedra]: [W.Claymore, W.Longsword], [M.FireDaedra]: [W.Saber, W.Broadsword], [M.Daedroth]: [W['War Axe'], W.Flail],
  [M.Vampire]: [W.Saber, W.Katana], [M.DaedraSeducer]: [W.Saber, W.Katana], [M.VampireAncient]: [W.Katana, W['Dai-Katana']],
  [M.DaedraLord]: [W['Dai-Katana'], W.Claymore], [M.Lich]: [W.Staff], [M.AncientLich]: [W.Staff],
  [M.Dragonling]: [W.Saber], [M.Dragonling_Alternate]: [W.Saber], [M.FireAtronach]: [W.Saber], [M.IronAtronach]: [W.Warhammer],
  [M.FleshAtronach]: [W.Mace], [M.IceAtronach]: [W.Claymore], [M.Dreugh]: [W.Flail, W.Tanto], [M.Lamia]: [W.Wakazashi, W['Short Bow']],
  // a person, by class
  [M.Mage]: [W.Staff], [M.Spellsword]: [W.Longsword], [M.Battlemage]: [W['War Axe']], [M.Sorcerer]: [W.Staff], [M.Healer]: [W.Mace],
  [M.Nightblade]: [W.Wakazashi], [M.Bard]: [W.Saber], [M.Burglar]: [W.Dagger], [M.Rogue]: [W.Shortsword], [M.Acrobat]: [W.Tanto],
  [M.Thief]: [W.Dagger], [M.Assassin]: [W.Tanto], [M.Monk]: [W.Staff], [M.Archer]: [W['Long Bow']], [M.Ranger]: [W['Short Bow']],
  [M.Barbarian]: [W.Claymore], [M.Warrior]: [W.Longsword], [M.Knight]: [W.Broadsword],
});
/** What a trophy of each template is called after its owner's name. */
export const TROPHY_NOUNS = Object.freeze({
  [W.Dagger]: ['Fang', 'Shiv', 'Sting'], [W.Tanto]: ['Kiss', 'Whisper'], [W.Staff]: ['Rod', 'Crook', 'Stave'],
  [W.Shortsword]: ['Bite', 'Edge'], [W.Wakazashi]: ['Edge', 'Whisper'], [W.Broadsword]: ['Blade', 'Reaver'],
  [W.Saber]: ['Wing', 'Slash'], [W.Longsword]: ['Oath', 'Blade'], [W.Katana]: ['Edge', 'Song'],
  [W.Claymore]: ['Greatblade', 'Ruin'], [W['Dai-Katana']]: ['Edge', 'Requiem'], [W.Mace]: ['Maul', 'Cudgel'],
  [W.Flail]: ['Scourge', 'Flail'], [W.Warhammer]: ['Hammer', 'Maul'], [W['Battle Axe']]: ['Cleaver', 'Axe'],
  [W['War Axe']]: ['Reaver', 'Axe'], [W['Short Bow']]: ['Bow', 'Sting'], [W['Long Bow']]: ['Longbow', 'Reach'],
});
/** The chance of each tier at rank 1, and how much each rank above it moves from Magic to the better two. */
export const TROPHY_RARITY = Object.freeze({ legendary: 0.12, rare: 0.33, legendaryPerRank: 0.05, rarePerRank: 0.04 });

const MELEE_AND_BOWS = new Set(Object.values(W));
/** FNV-1a: a revenant's own pick, the same every time. */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** The weapon it fought with, if it carried one: its best (by worth) of the weapons DFU makes (no arrows, no oddity). */
export function carriedWeaponTemplate(entity) {
  let best = null;
  for (const it of Array.isArray(entity?.items) ? entity.items : []) {
    if (!it || it.group !== 'Weapons' || !MELEE_AND_BOWS.has(it.templateIndex)) continue;
    if (!best || (Number(it.value) || 0) > (Number(best.value) || 0)) best = it;
  }
  return best ? best.templateIndex : null;
}
/** WHICH WEAPON: its own carried one first, else its kind's (one of them, by its id), else a longsword. */
export function trophyTemplate(r, entity = null) {
  const carried = carriedWeaponTemplate(entity);
  if (carried != null) return carried;
  const pool = TROPHY_KIND_WEAPONS[r?.mobileType] ?? [W.Longsword];
  return pool[hashStr(`trophy:${r?.id ?? ''}`) % pool.length];
}
/** WHAT IT IS CALLED: "<given>'s <noun>" - the noun the template's, drawn by the revenant's id. */
export function trophyName(r, templateIndex) {
  const nouns = TROPHY_NOUNS[templateIndex] ?? [templateByIndex(templateIndex)?.name ?? 'Blade'];
  const noun = nouns[hashStr(`noun:${r?.id ?? ''}`) % nouns.length];
  const given = String(r?.given ?? r?.name ?? 'Nameless').trim() || 'Nameless';
  return `${possessive(given)} ${noun}`;
}
/** ITS RARITY: never Common - Magic, Rare or Legendary, the better ones likelier with its rank. */
export function trophyRarity(rank = 1, rolls = Math.random) {
  const k = Math.max(0, Math.min(4, (rank | 0) - 1));
  const leg = TROPHY_RARITY.legendary + TROPHY_RARITY.legendaryPerRank * k;
  const rare = TROPHY_RARITY.rare + TROPHY_RARITY.rarePerRank * k;
  const x = rolls();
  return x < leg ? 'legendary' : x < leg + rare ? 'rare' : 'magic';
}

/**
 * THE TROPHY: the weapon a revenant `r` drops when the player destroys it - its own kind of weapon, a random rarity,
 * named for it. `entity` the body it stood in (the weapon it carried), `level` the player's (the material's roll).
 */
export function revenantTrophy(r, { entity = null, level = 1, rolls = Math.random } = {}) {
  const templateIndex = trophyTemplate(r, entity);
  const lv = Math.max(1, level | 0);
  const material = Math.max(randomMaterial(lv, rolls), randomMaterial(lv, rolls));   // the better of two
  const item = mintCondition(setItemFields({ group: 'Weapons', ...createWeapon(templateIndex, material, rolls) }));
  if (!item) return null;
  const tier = trophyRarity(r?.rank ?? 1, rolls);
  applyRarity(item, r?.dread ? 'legendary' : tier, rolls);   // UNQUIET II (Revenants.md section 47): the Dread's, Legendary always (its tier's roll drawn first all the same)
  item.name = trophyName(r, templateIndex);   // over the ladder's name - a Legendary's record keeps its powers, not its name
  return item;
}
/** The choice's words for a trophy: "Rare War Axe". */
export function trophyKindWords(item) {
  const tier = item?.rarity ? item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) : '';
  const base = templateByIndex(item?.templateIndex)?.name ?? 'weapon';
  return [tier, base].filter(Boolean).join(' ');
}
