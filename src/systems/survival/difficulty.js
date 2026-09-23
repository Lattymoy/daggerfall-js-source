// SURV-TIERS (2026-09-23, Mac: "adding a new tab to climates and calories
// thats on by default. Something that introduces mechanics, leaves some out
// and is overall not a punished experience for players", then "Off, Casual,
// Hard" and "I want this to be a smart and thorough difficulty design. No
// band aids") - THE TIERS, AS DATA.
//
// ONE KEY, THREE ANSWERS. The survival pref (survival/switch.js) was a
// boolean; it is a tier now: OFF (the classic game), CASUAL (the default)
// and HARD (the arc as SURV1-7 built it, unchanged to the number). Every
// law that can charge the player reads its tier's RULES from this table,
// handed in by the host's composition - env.js survivalFeed (the minute
// law), scenes/shared.js createRestDeps (the rest, and the encounter
// asks it stamps on the resting player), env.js survivalGateOn (the
// gate), the two tavern windows, scenes/hunting.js and systems/
// useItem.js. A law handed no rules runs HARD, the arc at full
// strength, so every pin written before the tiers still pins Hard.
//
// CASUAL IS NOT HARD WITH THE NUMBERS TURNED DOWN. It is five rules, and
// the table below is those rules written out:
//
//   1. SAME WORLD, DIFFERENT STAKES. The clocks, the thresholds, the felt
//      temperature, the food and its spoiling, the water, the camps, the
//      tavern menus and the hunt's events are the world's and identical in
//      both tiers - so the HUD, the status page and every notice say the
//      same things, and two players on different tiers stand in one world
//      online. Only what the body PAYS differs, and that is all this holds.
//   2. STAMINA IS THE ONLY PRICE OF NEGLECT. Casual never takes an
//      attribute, a point of health, an item's condition, a disease or an
//      hour. (The drink's own attribute swing stays: it is a choice made at
//      a bar with an upside, not a need left unmet.)
//   3. RED MEANS IT COSTS. A need charges only at the stages the HUD
//      already paints red (survival/status.js HUD_NEED_WORDS): Starving;
//      Parched and Dehydrated; Exhausted; Freezing, Deadly cold and
//      Scorching. Amber is information. The rates are Hard's own (needs.js
//      DRAIN) - the body tires as fast in both tiers once it is in trouble.
//   4. BOUNDED. The needs may take stamina down to half the pool and no
//      further, so on their own they can never raise DFU's exhaustion
//      collapse, which kills a player with a foe near
//      (systems/rest.js exhaustionOutcome).
//   5. NOTHING REFUSED, NOTHING ROLLED AGAINST YOU. No rest gate, no second
//      encounter ask, no stiff morning, no sickness roll, no bite, fall or
//      beast from a hunt (each takes its declared safe twin -
//      hunting.js HUNT_SAFE_TWIN), no blackout (the barkeep stops pouring -
//      tavernMenu.js tavernPour).
//
// What Casual keeps as the reason to engage is everything that was never a
// penalty: a bed or a fire pays sleep three times faster than the rest
// window, a cooked meal feeds more than a raw one and a fresh one more than
// a spoiled one, a fed hour gives stamina back.
//
// A LEAF: no imports, so the laws and the switch read it without a cycle.

export const SURVIVAL_OFF = 'off';
/** The tiers in the Features bar's order. The row (systems/features.js
 *  `mod-climates-calories`) declares the same ids beside their labels;
 *  test/survtiers.test.js holds the two to each other. */
export const SURVIVAL_TIER_IDS = Object.freeze([SURVIVAL_OFF, 'casual', 'hard']);
export const SURVIVAL_DEFAULT = 'casual';

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

/** What each tier charges. A field is here only because the tiers
 *  DIFFER on it - the world's numbers (the stages, the drain rates, the
 *  sleep a bed pays) live with their laws in needs.js and rest.js. */
export const SURVIVAL_RULES = deepFreeze({
  casual: {
    id: 'casual',
    /** The needs' stamina: `floor` is the share of the pool they may not
     *  take; the heat and the cold charge at a felt temperature of
     *  `hotFrom` or more, or `coldFrom` or less - here the edges of the
     *  red words (temperature.js temperatureWord: scorching past 50,
     *  freezing past -30); `bareFeet` is the barefoot tax. */
    stamina: { floor: 0.5, hotFrom: 51, coldFrom: -31, bareFeet: false },
    attributes: false,   // starving, exposure, dehydration, lost sleep and the stiff morning lower the attributes
    health: false,       // dehydration, exposure, and bare skin in the cold or the sun wound
    rust: false,         // wet metal armour loses condition
    sickness: false,     // raw or spoiled food risks a disease
    huntHarms: false,    // a hunt may bite, poison, sicken, bruise, tire or raise a beast
    /** The window's rest on bare ground (rest.js REST_KIND.Rough): the
     *  share of DFU's hour it pays, the encounter asks a minute, the
     *  stiff hours after. A bed and a camp cost the same in every tier. */
    roughRest: { recovery: 1, encounters: 1, stiffHours: 0 },
    roughSleepFloor: null,   // the sleep-debt stage a rough night cannot pay below (needs.js)
    restGate: false,     // too cold without a fire, or too hot, refuses the sleep
    blackout: false,     // drinking past the endurance passes the night on the tavern floor
  },
  hard: {
    id: 'hard',
    stamina: { floor: 0, hotFrom: 20, coldFrom: -20, bareFeet: true },
    attributes: true,
    health: true,
    rust: true,
    sickness: true,
    huntHarms: true,
    roughRest: { recovery: 0.5, encounters: 2, stiffHours: 4 },
    roughSleepFloor: 'tired',
    restGate: true,
    blackout: true,
  },
});

/** The arc at full strength: what a law runs when it is handed no rules. */
export const HARD_RULES = SURVIVAL_RULES.hard;
/** A tier's rules, or null for Off and for anything that is not a tier. */
export const rulesForTier = (tier) => (typeof tier === 'string' && Object.hasOwn(SURVIVAL_RULES, tier) ? SURVIVAL_RULES[tier] : null);
/** The tier a stored value names: a tier id as it is, anything else the default. */
export const normalizeTier = (v) => (typeof v === 'string' && SURVIVAL_TIER_IDS.includes(v) ? v : SURVIVAL_DEFAULT);
