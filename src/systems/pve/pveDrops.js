// @ts-check
// FIXED-PVE TEMPLATE-DROPS (bible/05-Combat/Fixed-PvE.md section 20, 2026-10-31: jewellery, armour and weapon drops
// fixed): a template foe's drop reads the foe, not its old body. Its tier is its own level, so a zone's foe
// rolls the zone's odds. The boss ladder is its rank's (Strong and up), not a Daggerfall level of 18. Every template
// foe may carry jewellery, a caster most often; a creature may carry a weapon or a piece of armour it took; a ranked foe
// carries more. Daggerfall's tables give no creature gear and no foe jewellery. Ledger A (FIXED-PVE).
import { spellRanked } from './pveSpellRank.js';
import { SPECIES_BY_BODY } from './pveSpecies.js';

/** The share of template foes that carry a piece of jewellery: a body that casts, and any other. */
export const DROP_JEWEL = Object.freeze({ caster: 0.5, other: 0.15 });
/** The share of creature template foes, and of people who cast no spell (FIGHTER-GEAR), that carry a weapon or a piece of armour. */
export const DROP_CREATURE_GEAR = 0.3;
/** CLOTH-DROPS (2026-10-31, cloaks included): the share of people (a class body) that carry a piece of
 *  clothing, and the share of a clothing piece that is a cloak. */
export const DROP_CLOTH = Object.freeze({ people: 0.3, cloak: 0.25 });
/** The pieces of any kind a ranked foe carries past those, by its category. */
export const DROP_RANK_PIECES = Object.freeze({ normal: 0, strong: 1, elite: 2, champion: 2, boss: 3, raidBoss: 5 });

const bodyOf = (mobileType) => SPECIES_BY_BODY.get(mobileType) ?? null;   // REGIONAL-PVE: Enemy Expansion's bodies too

/** A template foe's corpse source over `base` (lootRarity.js corpseSource's): its own level the tier, its rank the boss
 *  ladder. Any other foe keeps `base`. @param {any} entity @param {any} base */
export function templateDropSource(entity, base) {
  if (!entity?.pveTemplate) return base;
  return { ...base, tier: Math.max(1, Number(entity.level) | 0), boss: spellRanked(entity) };
}

/** The kinds of gear template foe `entity` carries past its table, drawn on `rolls`: 'jewel', 'weapon', 'armor', 'cloth'
 *  or 'cloak'.
 *  None for any other foe. @param {any} entity @param {() => number} rolls */
export function templateGearKinds(entity, rolls = Math.random) {
  if (!entity?.pveTemplate) return [];
  const body = bodyOf(entity.mobileType), out = [];
  if (rolls() < (body?.casts ? DROP_JEWEL.caster : DROP_JEWEL.other)) out.push('jewel');
  // FIGHTER-GEAR (2026-10-31, warriors drop weapons and armour too): a person that casts no spell
  // rolls the creature's extra weapon or armour beside the kit it wore
  if ((body?.kind !== 'class' || !body?.casts) && rolls() < DROP_CREATURE_GEAR) out.push(rolls() < 0.5 ? 'weapon' : 'armor');
  const cloth = () => (rolls() < DROP_CLOTH.cloak ? 'cloak' : 'cloth');
  if (body?.kind === 'class' && rolls() < DROP_CLOTH.people) out.push(cloth());
  const extra = entity.eliteFoe ? Math.max(DROP_RANK_PIECES.elite, DROP_RANK_PIECES[entity.pveCategory] ?? 0) : DROP_RANK_PIECES[entity.pveCategory] ?? 0;
  for (let i = 0; i < extra; i++) {
    const k = ['jewel', 'weapon', 'armor', 'cloth'][Math.min(3, Math.floor(rolls() * 4))];
    out.push(k === 'cloth' ? cloth() : k);
  }
  return out;
}

/** OVER-GEAR (2026-10-31, no gear past 10 levels over): a template foe this many levels or more below its
 *  roller drops no gear - its gold and supplies only - so a high character gains nothing farming a starter zone. */
export const OVER_GEAR_LEVELS = 10;
