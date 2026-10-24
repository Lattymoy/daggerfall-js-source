// SURV-TIERS (2026-09-23, Mac: "adding a new tab to climates and calories
// thats on by default. Something that introduces mechanics, leaves some out
// and is overall not a punished experience for players", then "Off, Casual,
// Hard" and "I want this to be a smart and thorough difficulty design. No
// band aids") - THE TIERS, AS DATA.
//
// ONE KEY, FOUR ANSWERS. The survival pref (survival/switch.js) was a
// boolean; it is a tier now: OFF (the classic game), BOONS (SURV-BOONS,
// 2026-10-12: the rewards-only tier - its rules are at the end of this
// note - THE DEFAULT since BOONS-DEFAULT, 2026-10-13, Mac: "make boons
// the default"), CASUAL (the default until then) and HARD (the arc as
// SURV1-7 built it).
// SURV-TIERS made the first three. Every law that can charge the
// player reads its tier's RULES from this table, handed in by the host's
// composition - env.js survivalFeed (the minute law), scenes/shared.js
// createRestDeps (the rest, and the encounter asks it stamps on the
// resting player), env.js survivalGateOn (the gate), the two tavern
// windows and systems/useItem.js. A law handed no
// rules (undefined or null) runs HARD, the arc at full strength, so every
// pin written before the tiers still pins Hard.
//
// CASUAL IS NOT HARD WITH THE NUMBERS TURNED DOWN. It is five rules, and
// the table below is those rules written out:
//
//   1. SAME WORLD, DIFFERENT STAKES. The clocks, the thresholds, the felt
//      temperature, the food and its spoiling, the water, the camps and the
//      tavern menus are the world's and identical in both tiers - so the
//      HUD, the status page and every notice say the same things about
//      the world, and two players on different tiers
//      stand in one world online. Only what the body PAYS differs, and that
//      is all this holds - with the few words that say what a tier did (a
//      barkeep's or a kitchen's refusal, a loan repaid, a Hard morning's
//      Stiff).
//   2. STAMINA IS THE ONLY PRICE OF NEGLECT. Casual never takes an
//      attribute, a point of health, an item's condition, a disease, a coin
//      or an hour. (The drink's own attribute swing stays: it is a choice
//      made at a bar with an upside, not a need left unmet.)
//   3. RED MEANS IT COSTS. A need charges only at the stages the HUD
//      paints red in Casual (survival/status.js needLevel reads every
//      tier's red off this table - AUDIT C&C S5): Starving; Parched and
//      Dehydrated; Exhausted; Freezing, Deadly cold and Scorching. Amber is
//      information. The rates are Hard's own (needs.js DRAIN) - the body
//      tires as fast in both tiers once it is in trouble. (Wetness and the
//      drink are not needs: Drenched is amber - it costs through the felt
//      temperature, whose own chip says so - and the drink's swing is the
//      drink's, from its amber Drunk on.)
//   4. BORROWED, NOT TAKEN. The needs may take stamina down to half the
//      pool and no further - so on their own they can never raise DFU's
//      exhaustion collapse, which kills a player with a foe near (the
//      port's costs a tenth of the health there - SPENT-ASHORE,
//      systems/rest/rest.js exhaustionOutcome) - and what a need took it gives
//      back the moment the need is met: a meal repays the hunger, a drink
//      the thirst, a sleep the exhaustion, a warm place or a lit fire the
//      cold. The floor is the NEEDS' share: DFU's own walking and running
//      drain still runs below it, as it does with the arc off. And a loan is
//      never more than the pool is short (needs.js settleLoan).
//   5. NOTHING REFUSED, NOTHING ROLLED AGAINST YOU, NOTHING WASTED. No rest
//      gate, and a rest is always a rest (the needs charge nothing while
//      the player rests, so a rest can always finish); no second encounter
//      ask, no stiff morning, no sickness roll, no blackout (the barkeep
//      stops pouring) and no wasted meal (the kitchen will not sell a full
//      stomach a meal) - both asked before the coin changes hands
//      (tavernMenu.js tavernOrder).
//
// What Casual keeps as the reason to engage is everything that was never a
// penalty: a bed or a fire pays sleep three times faster than the rest
// window, a cooked meal feeds more than a raw one and a fresh one more than
// a spoiled one, a fed hour gives stamina back.
//
// SURV-BOONS (2026-10-12, the owner: "a completely different version. Instead
// of punishing players for not tending, we instead provides boons to those
// who upkeep. Much like [Valheim]. Players would still be able to switch
// between CAC versions") - THE FOURTH TIER, BOONS. Not Casual turned down
// again: Casual and Hard ask what a need left unmet COSTS; Boons asks what
// a need met EARNS. Its rules, written out:
//
//   1. SAME WORLD, as above - the counters, the stages, the food, the
//      camps and the words are the world's, so a Boons player stands in
//      one world with a Hard one.
//   2. NOTHING IS EVER TAKEN. The needs take none of the stamina pool
//      (`stamina.floor` 1 - the share they may not take is all of it, and
//      needs.js `tire` charges nothing at all under it), and no attribute,
//      health, condition, disease, coin or hour - Casual's `false` on every
//      other cost. `repaid` is TRUE: Boons lends nothing, but a loan Casual
//      made is repaid as its need is met, as Casual promised (AUDIT
//      SURV-BOONS B2 - turning to Boons had thrown it away). The drink's
//      swing stays, as in every tier: it is chosen at a bar. Casual's two
//      house refusals stay too - the barkeep stops before a blackout, the
//      kitchen will not waste a meal - because they guard the coin.
//   3. A BODY KEPT EARNS. `boons` (needs.js BOON, survivalBoons): Well fed
//      (strength and endurance), Quenched (agility and speed), Well rested
//      (intelligence and willpower - banked only by sleep in a bed or by a
//      fire, which a Sleeping Draught makes of the rest window too, and
//      earned only while the sleep debt is paid) and, all three at once,
//      Thriving (luck); and a lit fire beside a waking, unresting player
//      refills their stamina (Hearth). Like Valheim's food and its Rested:
//      the bonus is the reason to tend, and its fading is the only price of
//      not tending.
//   4. NO RED. A need's chip goes no further than amber in Boons (status.js
//      needLevel) - RED MEANS IT COSTS, and nothing here costs. The
//      boons are the strip's green tiles.
//
// A LEAF: no imports, so the laws, the switch and the prefs shelf read it
// without a cycle.

export const SURVIVAL_OFF = 'off';
/** The tiers in the Features bar's order. */
export const SURVIVAL_TIER_IDS = Object.freeze([SURVIVAL_OFF, 'boons', 'casual', 'hard']);   // SURV-BOONS: the gentlest first after Off
export const SURVIVAL_DEFAULT = 'boons';   // BOONS-DEFAULT (2026-10-13, Mac: "make boons the default") - Casual until then

/** AUDIT SURV-TIERS: what each tier is STORED as on the prefs shelf -
 *  the values the Features row's segments write (systems/features.js
 *  `mod-climates-calories`; test/systems/survival/survtiers.test.js holds the row to
 *  this). OFF KEEPS THE OLD SWITCH'S OWN `false`: a shelf written before
 *  the tiers needs no conversion for it, and a build from before the
 *  tiers - an older desktop install reading the same file - still reads
 *  a player's Off as off. Casual and Hard are stored by name, and the
 *  default is never stored at all (uiPrefs.js PREF1). */
export const SURVIVAL_STORED = Object.freeze({ off: false, boons: 'boons', casual: 'casual', hard: 'hard' });
const TIER_OF_STORED = new Map(Object.entries(SURVIVAL_STORED).map(([tier, v]) => [v, tier]));
/** Whether a stored value names a tier. */
export const isStoredTier = (v) => TIER_OF_STORED.has(v);
/** The tier a stored value names; anything else - the old `true`, a hand
 *  edit - is no tier and reads as the default, the same rule the Features
 *  bar draws it by (ui/enhanced/enhancedMenu.js tileStates), and the shelf drops
 *  it at the load (uiPrefs.js loadPrefs) so the two can never disagree. */
export const tierOfStored = (v) => TIER_OF_STORED.get(v) ?? SURVIVAL_DEFAULT;

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

/** What each tier charges. A field is here only because the tiers
 *  DIFFER on it - the world's numbers (the stages, the drain rates, the
 *  sleep a bed pays) live with their laws in needs.js and rest.js. */
export const SURVIVAL_RULES = deepFreeze({
  // SURV-BOONS: Casual's every `false`, a floor that is the whole pool (nothing charged - needs.js tire), Casual's loan
  // repaid, and the boons. hotFrom / coldFrom are Casual's red words: with nothing charged they decide nothing but
  // whether a carried loan's temperature share is met, and they stay a real band rather than a sentinel.
  boons: {
    id: 'boons',
    stamina: { floor: 1, hotFrom: 51, coldFrom: -31, bareFeet: false, duringRest: false, repaid: true, fireWarms: true },
    attributes: false,
    health: false,
    rust: false,
    sickness: false,
    roughRest: { recovery: 1, encounters: 1, stiffHours: 0 },
    roughSleepFloor: null,
    restGate: false,
    blackout: false,
    wastedMeal: false,
    boons: true,         // a need met earns its boon (needs.js survivalBoons)
  },
  casual: {
    id: 'casual',
    /** The needs' stamina: `floor` is the share of the pool they may not
     *  take; the heat and the cold charge at a felt temperature of
     *  `hotFrom` or more, or `coldFrom` or less - here the edges of the
     *  red words (temperature.js temperatureWord: scorching past 50,
     *  freezing past -30); `bareFeet` is the barefoot tax; `duringRest`
     *  whether the heat and the cold still charge a rest away from a fire
     *  (the other needs never do); `repaid` whether what a need took comes
     *  back when the need is met (needs.js, the record's `borrowed`);
     *  `fireWarms` whether a lit fire answers the cold outright - AUDIT
     *  SURV-TIERS, the second pass: its fifteen degrees alone left a camper
     *  in a snowstorm Deadly cold, charged and never repaid, beside the
     *  very fire the rules send them to. */
    stamina: { floor: 0.5, hotFrom: 51, coldFrom: -31, bareFeet: false, duringRest: false, repaid: true, fireWarms: true },
    attributes: false,   // starving, exposure, dehydration, lost sleep and the stiff morning lower the attributes
    health: false,       // dehydration, exposure, and bare skin in the cold or the sun wound
    rust: false,         // wet metal armour loses condition
    sickness: false,     // raw or spoiled food risks a disease
    /** The window's rest on bare ground (rest.js REST_KIND.Rough): the
     *  share of DFU's hour it pays, the encounter asks a minute, the
     *  stiff hours after. A bed and a camp cost the same in every tier. */
    roughRest: { recovery: 1, encounters: 1, stiffHours: 0 },
    roughSleepFloor: null,   // the sleep-debt stage a rough night cannot pay below (needs.js)
    restGate: false,     // too cold without a fire, or too hot, refuses the sleep
    blackout: false,     // drinking past the endurance passes the night on the tavern floor
    wastedMeal: false,   // a meal bought on a full stomach is charged, takes its half hour and goes to waste
    boons: false,        // SURV-BOONS: a need met earns a bonus - Boons alone
  },
  hard: {
    id: 'hard',
    stamina: { floor: 0, hotFrom: 20, coldFrom: -20, bareFeet: true, duringRest: true, repaid: false, fireWarms: false },
    attributes: true,
    health: true,
    rust: true,
    sickness: true,
    roughRest: { recovery: 0.5, encounters: 2, stiffHours: 4 },
    roughSleepFloor: 'tired',
    restGate: true,
    blackout: true,
    wastedMeal: true,
    boons: false,
  },
});

/** The arc at full strength: what a law runs when it is handed no rules. */
export const HARD_RULES = SURVIVAL_RULES.hard;
/** A tier's rules, or null for Off and for anything that is not a tier. */
export const rulesForTier = (tier) => (typeof tier === 'string' && Object.hasOwn(SURVIVAL_RULES, tier) ? SURVIVAL_RULES[tier] : null);
