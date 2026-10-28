// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): A SPECIES IS WHAT A CREATURE IS - its body, its kind and what that body can
// draw. It never sets a level, a role, a temper or loot: a template does (pveTemplates.js). The vanilla bodies are the
// species; a species the spec names with no art in the game stands as a candidate, never spawned.
// Not a DFU member: DFU has bodies and careers, no species. Ledger A (FIXED-PVE).

import { ENEMY_NAMES, ENEMY_BASICS, isClassEnemyId, enemyCareerIndex } from '../../characters/enemy/enemyBasics.js';
import { enemyEntityGroup } from '../../combat/enemyGroups.js';
import { MONSTER_SPELL_LISTS } from '../enemySpells.js';

/** Enemy groups by name (DFCareer.EnemyGroups). */
const GROUP_NAME = Object.freeze({ [-1]: 'none', 0: 'undead', 1: 'daedra', 2: 'humanoid', 3: 'animal' });

/** The class bodies that cast: Mage, Spellsword, Battlemage, Sorcerer, Healer, Nightblade (ENEMY_BASICS castsMagic). */
const castsAt = (id) => !!ENEMY_BASICS[id]?.castsMagic || MONSTER_SPELL_LISTS[id] != null;

/** A species key from its body's name: 'Orc Shaman' -> 'orc-shaman'. */
export const speciesKey = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Monsters 0-42 and classes 128-146, the horse (39) and the second Dragonling row (40) left out. */
const BODY_IDS = Object.freeze([...Array.from({ length: 43 }, (_, i) => i).filter((i) => i !== 39 && i !== 40),
  ...Array.from({ length: 19 }, (_, i) => 128 + i)]);

/** @typedef {{ key: string, name: string, body: number, kind: 'monster'|'class', group: string, aquatic: boolean,
 *  flying: boolean, shoots: boolean, casts: boolean, vanillaLevel: number|null }} Species */

/** @type {ReadonlyArray<Species>} */
export const SPECIES = Object.freeze(BODY_IDS.map((id) => {
  const row = ENEMY_BASICS[id] ?? {};
  const name = ENEMY_NAMES[id < 128 ? id : 43 + (id - 128)];
  return Object.freeze({
    key: speciesKey(name), name, body: id,
    kind: isClassEnemyId(id) ? 'class' : 'monster',
    group: isClassEnemyId(id) ? 'humanoid' : GROUP_NAME[enemyEntityGroup(enemyCareerIndex(id))] ?? 'none',   // a class is Humanoid (FormulaHelper.cs:2746)
    aquatic: row.behaviour === 'Aquatic', flying: row.behaviour === 'Flying',
    shoots: !!row.hasRangedAttack1, casts: castsAt(id),
    vanillaLevel: isClassEnemyId(id) ? null : row.level ?? null,
  });
}));

export const SPECIES_BY_KEY = new Map(SPECIES.map((s) => [s.key, s]));

/** The spec's species with no body in the game yet: data for a later art pass, never spawned. */
export const CANDIDATE_SPECIES = Object.freeze([
  'Riekr', 'Echatere', 'Durzog', 'Duneripper', 'Assassin Beetle', 'Draugr', 'Falmer', 'Chaurus', 'Frost Troll',
  'Ice Wraith', 'Horker', 'Mammoth', 'Hagraven', 'Minotaur', 'Goblin', 'Ogre', 'Will-o-the-Wisp', 'Nix-Hound', 'Guar',
  'Kagouti', 'Alit', 'Netch', 'Kwama', 'Shalk', 'Ash Hopper', 'Dwemer Construct', 'Wamasu', 'Voriplasm', 'Haj Mota',
  'Crocodile', 'Senche', 'Terror Bird', 'Strangler', 'Hoarvor', 'Lurcher', 'Gryphon', 'Indrik', 'Yaghra', 'Nixad',
].map((name) => Object.freeze({ key: speciesKey(name), name, body: null, status: 'candidate' })));
