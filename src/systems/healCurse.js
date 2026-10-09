// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HEAL CURSE (2026-10-08, the owner: "Add a button to the temple services under heal disease named heal curse it removes
// being a werewolv and vampire and also removes their positive effects/negative effects and buffs ofc.")
//
// The temple's Cure Disease priest offers a second row: the CURSE lifted. What a curse is here:
//   - VAMPIRISM, turned (systems/vampirism.js cureVampirism - DFU's own CureVampirism: the clan remembered, the racial
//     override and its sun, its powers and its weaknesses gone, the tagged spells gone, the clan's quests ended);
//   - LYCANTHROPY, turned (systems/lycanthropy.js cureLycanthropy - DFU's CureLycanthropy: morphed back first, a full
//     heal, the override gone, the beast's claws, health limit and metal-to-hit gone, the tagged spells gone, the cure
//     quests ended);
//   - and either one still IN THE BLOOD, not yet turned (systems/infection.js's vampirism and lycanthropy strains) - the
//     dream never comes, the turn never happens.
// Every buff and every drawback of either goes with it, because each lives on the override, on its tagged spells or on
// the infection's entry, and each of those is ended here. A plague caught beside it is Cure Disease's, untouched.
//
// THE PRICE: a temple's rite, not a potion - HEAL_CURSE_BASE gold, through the region's price adjustment as Cure Disease
// is (guildServiceActions.js), and the temple's quality a tenth either way. Pure but for the entity it is handed.
// ═══════════════════════════════════════════════════════════════════
import { liveVampirism, cureVampirism } from './vampirism.js';
import { liveLycanthropy, cureLycanthropy } from './lycanthropy.js';
import { liveInfections } from './infection.js';
import { totalGoldAmount, deductGold } from './court.js';

export const HEAL_CURSE_BASE = 12000;
export const HEAL_CURSE_ROW = 'Heal Curse';
export const HEAL_CURSE_KEY = 'KeyH';

/** What curse the entity carries: `{ vampire, were, blood }` - turned, turned, and caught but not yet turned. */
export function curseOf(entity) {
  const blood = liveInfections(entity).filter((e) => /vamp|lycan|were/i.test(String(e.key ?? e.infection ?? '')));
  return { vampire: !!liveVampirism(entity), were: !!liveLycanthropy(entity), blood: blood.length };
}
// AUDIT 24 (one home): bearsCurse and healCurseLift, not isCursed and liftCurse - those names are lootRarity.js's and
// lootCurse.js's, an ITEM's curse (a drawback the temple lifts off a piece); this is the BLOOD's, on the entity
export const bearsCurse = (entity) => { const c = curseOf(entity); return c.vampire || c.were || c.blood > 0; };

/** The rite's price at this temple: the base through the region's adjustment (per thousand) and the hall's quality. */
export function healCursePrice({ priceAdjustment = 1000, quality = 10 } = {}) {
  const q = Math.max(0, Math.min(20, quality | 0));
  return Math.max(1, Math.round(HEAL_CURSE_BASE * (priceAdjustment / 1000) * (1.1 - q * 0.01)));
}

/** The offer: `{ kind: 'none' }` (nothing to lift) or `{ kind: 'offer', cost, curse }`. */
export function healCurseOffer(entity, deps = {}) {
  const curse = curseOf(entity);
  if (!curse.vampire && !curse.were && !curse.blood) return { kind: 'none' };
  return { kind: 'offer', cost: healCursePrice(deps), curse };
}

/** The curse lifted (no payment - healCursePaid pays first). Answers what went: `{ vampire, were, blood }`. */
export function healCurseLift(entity, { nowMinutes = 0, advanceMinutes = null, refreshHead = null } = {}) {
  const went = { vampire: false, were: false, blood: 0 };
  for (const e of liveInfections(entity)) {
    if (!/vamp|lycan|were/i.test(String(e.key ?? e.infection ?? ''))) continue;
    e.ended = true;
    went.blood += 1;
  }
  if (went.blood) entity.timeToBecomeVampireOrWerebeast = 0;   // the turn the blood was counting toward, cancelled with it
  went.were = cureLycanthropy(entity, { nowMinutes, advanceMinutes, refreshHead });
  went.vampire = cureVampirism(entity, { advanceMinutes });
  return went;
}

/** The paid rite: `{ kind: 'notEnoughGold' }`, `{ kind: 'none' }`, or `{ kind: 'lifted', cost, went }`. */
export function healCursePaid(entity, deps = {}) {
  const offer = healCurseOffer(entity, deps);
  if (offer.kind !== 'offer') return { kind: 'none' };
  if (totalGoldAmount(entity) < offer.cost) return { kind: 'notEnoughGold', cost: offer.cost };
  deductGold(entity, offer.cost);
  return { kind: 'lifted', cost: offer.cost, went: healCurseLift(entity, deps) };
}

/** The priest's words, plain rows the popup stands as a box. */
export const healCurseText = Object.freeze({
  none: 'You bear no curse that the Divines need lift.',
  offer: (cost, c) => [
    `${c.vampire ? 'The blood-hunger of the vampire' : c.were ? 'The beast within you' : 'A curse in your blood'} can be lifted here.`,
    'Every gift and every weakness it gave you will go with it.',
    `The rite costs ${cost.toLocaleString('en-US')} gold. Will you have it done?`,
  ],
  poor: (cost) => `The rite costs ${cost.toLocaleString('en-US')} gold - more than you carry.`,
  lifted: 'The priests chant over you through the long hours. When it is done, the curse is gone.',
});
