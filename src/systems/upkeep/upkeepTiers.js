// THE TWO UPKEEP SWITCHES' TIERS, AS DATA - horse care's (HORSE-TIERS, below) and wagon upkeep's (WAGON-TIERS, at the
// end): systems/upkeep/upkeepSwitch.js's two Features rows, each one key with Off, Boons (the default) and Hard on it.
//
// HORSE-TIERS (2026-10-15, Mac: "Allow turn off. Rework this system to be more in line with how we handle climates and
// calories boons.") - HORSE CARE'S TIERS, AS DATA (bible/06-Systems/Horse-Care.md). Climates & Calories' model
// (survival/difficulty.js, SURV-TIERS and SURV-BOONS) laid over the horse: ONE KEY, THREE ANSWERS -
//
//   OFF    DFU's plain horse: no stats, one pace, no gallop of its own, nothing to feed (the law runs nothing).
//   BOONS  THE DEFAULT (BOONS-DEFAULT's word for Climates & Calories, Mac's for the horse): care EARNS and neglect
//          COSTS NOTHING. A tended horse earns what STEED1 gave it - its bond's points on every stat, a gallop on its
//          breath, a fast horse's pace - and an untended one is never worse than DFU's plain horse.
//   HARD   STEED1 and HORSE-WALK as they shipped, the system as it stood (Climates & Calories' Hard is the arc as SURV1-7
//          built it): a born-slow horse rides slower than DFU's, hunger takes ten and then twenty-five off every stat and
//          slows its breath, a starving or winded horse will not gallop and is held to the walk, starving fades the bond,
//          and a team's Strength drags a loaded wagon.
//
// BOONS IS NOT HARD WITH THE NUMBERS TURNED DOWN. Its rules, written out (the table below is them as fields):
//
//   1. SAME WORLD. The horse's stats, its bond, its food clock, its breath and every word are the world's, as they are in
//      Hard - a Boons rider and a Hard one see the same horse, Hungry and Starving said alike - and only what the horse
//      PAYS differs.
//   2. NOTHING IS EVER TAKEN. Hunger takes no stat and slows no breath (`hungerCosts`); starving fades no bond
//      (`bondFades` - the keep holds a starving horse's clock at the starving line, so no fade is owed when the tier
//      turns); the ride's pace is never under DFU's (`paceFloor`); a team never drags a wagon (`draftDrags`).
//   3. A HORSE KEPT EARNS. The bond grown by every meal raises every stat; a horse with its breath, and fed, gallops on
//      Run. Starving or winded the gallop is not earned - and a refused gallop rides DFU's own pace, never the walk
//      (`refusedRunWalks` false), so Run held is never slower than DFU's horse. The walk with Run let go is the
//      owner's HORSE-WALK, every caring tier's way to ride - not a price of neglect.
//   4. NO RED (Climates & Calories' rule 4: RED MEANS IT COSTS). Where hunger costs nothing its chip goes no further than
//      amber (ui/enhanced/enhancedSaddle.js, ui/holdingsPages.js read `hungerCosts`).
//
// Every reader asks the tier through ONE accessor, systems/upkeep/upkeepSwitch.js horseCareRules (null for Off), and the laws
// take the rules as an argument (systems/steedCare.js) - a law handed none runs HARD, the system as it stood, so every
// pin written before the tiers still pins it.
//
// A LEAF: no imports, so the prefs shelf's load (uiPrefs.js), the switch and the laws read it without a cycle.
// The shelf is on the entry's static path (test/render/boot2.test.js holds this a leaf there) and in the account Worker's
// bundle (.github/workflows/account-deploy.yml names this file, test/server/accountdeploy.test.js's walk).

export const HORSE_CARE_OFF = 'off';
/** The tiers in the Features bar's order - the gentlest first after Off, as Climates & Calories'. */
export const HORSE_CARE_TIER_IDS = Object.freeze([HORSE_CARE_OFF, 'boons', 'hard']);
export const HORSE_CARE_DEFAULT = 'boons';

/** What each tier is STORED as on the prefs shelf - the values the Features row's segments write (systems/features.js
 *  'horse-care'; test/systems/horsetiers.test.js holds the row to this). OFF KEEPS THE OLD SWITCH'S OWN `false`: a player who
 *  turned horse care off before the tiers is on Off with no conversion, and a build from before them reads it as off.
 *  Hard is stored by name, and the default is never stored at all (uiPrefs.js PREF1). */
export const HORSE_CARE_STORED = Object.freeze({ off: false, boons: 'boons', hard: 'hard' });
const TIER_OF_STORED = new Map(Object.entries(HORSE_CARE_STORED).map(([tier, v]) => [v, tier]));
/** Whether a stored value names a tier. */
export const isStoredHorseCare = (v) => TIER_OF_STORED.has(v);
/** THE OLD SWITCH'S ON, stored: horse care as it stood is Hard (uiPrefs.js loadPrefs moves it there, once). PREF1's
 *  shelf never stored the old default, so a player who never touched the switch stored nothing and plays the new
 *  default - BOONS-DEFAULT's reading - and only an On written to the shelf by hand names the system it chose. */
export const HORSE_CARE_OLD_ON = true;
export const HORSE_CARE_OLD_ON_TIER = 'hard';
/** The tier a stored value names; anything else reads as the default, the same rule the Features bar draws it by
 *  (ui/enhanced/enhancedMenu.js tileStates), and the shelf drops it at the load (uiPrefs.js loadPrefs). */
export const horseCareTierOfStored = (v) => TIER_OF_STORED.get(v) ?? HORSE_CARE_DEFAULT;

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

/** What each tier charges. A field is here only because the tiers DIFFER on it - the world's numbers (the stats' birth,
 *  the bond's step, the hunger's stages and penalties, the breath's pool and rates) live with their law in steedCare.js. */
export const HORSE_CARE_RULES = deepFreeze({
  boons: {
    id: 'boons',
    hungerCosts: false,      // Hungry and Starving take steedCare.js HUNGER's penalty off every stat and slow the breath
    bondFades: false,        // a starving horse's bond fades STARVING_BOND_TENTHS_A_DAY
    paceFloor: true,         // the ride's pace is never under DFU's (steedSpeedScale never under 1)
    draftDrags: false,       // a team's Strength drags a loaded wagon (teamDraftScale)
    refusedRunWalks: false,  // a gallop refused (winded, starving) holds the horse to the walk - else DFU's own pace
  },
  hard: {
    id: 'hard',
    hungerCosts: true,
    bondFades: true,
    paceFloor: false,
    draftDrags: true,
    refusedRunWalks: true,
  },
});

/** The system as it stood: what a law runs when it is handed no rules. */
export const HORSE_CARE_HARD = HORSE_CARE_RULES.hard;
/** A tier's rules, or null for Off and for anything that is not a tier. */
export const horseCareRulesForTier = (tier) => (typeof tier === 'string' && Object.hasOwn(HORSE_CARE_RULES, tier) ? HORSE_CARE_RULES[tier] : null);

// ── WAGON-TIERS ─────────────────────────────────────────────────────
// WAGON-TIERS (2026-10-15, Mac: "Yes, same tiers") - WAGON UPKEEP'S TIERS, AS DATA (bible/06-Systems/Wagon-Upkeep.md),
// horse care's model on the wagon's own key, `wagonUpkeep`:
//
//   OFF    DFU's plain wagon: it never wears, rolls at its team's pace, and sells as a whole one.
//   BOONS  THE DEFAULT: the same world - it wears by the road, a journey and the watch, its states are said, a Wagon
//          Yard and a kit mend it - and NOTHING IS EVER TAKEN: a worn wagon rolls at DFU's pace (`wearSlows`) and a
//          counter buys it as a whole one (`wearPrices`), so it is never worse than DFU's plain wagon. NO RED where wear
//          costs nothing (ui/enhanced/enhancedSaddle.js, ui/holdingsPages.js read `wearSlows`). And A WAGON KEPT EARNS (Mac,
//          2026-10-15: "Sound wagon rolls faster"): a Sound one - 60% of whole and up - rolls at WAGON_SOUND_BOON times
//          DFU's pace (`soundPace`), every other state at DFU's. Online the boon is the player's own, earned by keeping
//          the wagon, as Climates & Calories' boons are (AUDIT C&C B1, BOONS ONLINE: KEPT).
//   HARD   WAGONS4 and WAGON-MEND as they shipped: a Rickety wagon rolls at 0.85 of its pace, a Failing one at 0.7, and
//          a counter prices it by its condition (Roleplay & Realism: Items' conditionCostBase).
//
// Every reader asks the tier through systems/upkeep/upkeepSwitch.js wagonUpkeepRules (null for Off), and the laws take the
// rules as an argument (systems/wagon/wagonUpkeep.js) - a law handed none runs HARD.

export const WAGON_UPKEEP_OFF = 'off';
/** The tiers in the Features bar's order, as horse care's. */
export const WAGON_UPKEEP_TIER_IDS = Object.freeze([WAGON_UPKEEP_OFF, 'boons', 'hard']);
export const WAGON_UPKEEP_DEFAULT = 'boons';
/** What each tier is STORED as - horse care's values: OFF KEEPS THE OLD SWITCH'S OWN `false`, Hard by name, the default
 *  never stored (uiPrefs.js PREF1). */
export const WAGON_UPKEEP_STORED = Object.freeze({ off: false, boons: 'boons', hard: 'hard' });
const WAGON_TIER_OF_STORED = new Map(Object.entries(WAGON_UPKEEP_STORED).map(([tier, v]) => [v, tier]));
/** Whether a stored value names a wagon upkeep tier. */
export const isStoredWagonUpkeep = (v) => WAGON_TIER_OF_STORED.has(v);
/** THE OLD SWITCH'S ON, stored: wagon upkeep as it stood is Hard (uiPrefs.js loadPrefs moves it there, once) - the old
 *  default was never stored, so a player who never touched the switch plays the new default. */
export const WAGON_UPKEEP_OLD_ON = true;
export const WAGON_UPKEEP_OLD_ON_TIER = 'hard';
/** The tier a stored value names; anything else reads as the default (the shelf drops it at the load). */
export const wagonUpkeepTierOfStored = (v) => WAGON_TIER_OF_STORED.get(v) ?? WAGON_UPKEEP_DEFAULT;

/** WAGON-TIERS (Mac, 2026-10-15: "Sound wagon rolls faster"): a Sound wagon's pace on Boons, times DFU's - the one
 *  number of the boon, read through the tier's rules (`soundPace`, wagonUpkeep.js wagonPace). */
export const WAGON_SOUND_BOON = 1.1;
/** What each tier charges and earns - a field only where the tiers differ (the world's numbers live in wagonUpkeep.js). */
export const WAGON_UPKEEP_RULES = deepFreeze({
  boons: {
    id: 'boons',
    wearSlows: false,    // a Rickety or Failing wagon rolls at its state's pace (WAGON_STATES), under DFU's
    wearPrices: false,   // a counter prices a wagon by its condition, under a whole one's
    soundPace: WAGON_SOUND_BOON,   // a Sound wagon's pace, times its state's
  },
  hard: {
    id: 'hard',
    wearSlows: true,
    wearPrices: true,
    soundPace: 1,
  },
});
/** The system as it stood: what a law runs when it is handed no rules. */
export const WAGON_UPKEEP_HARD = WAGON_UPKEEP_RULES.hard;
/** A tier's rules, or null for Off and for anything that is not a tier. */
export const wagonUpkeepRulesForTier = (tier) => (typeof tier === 'string' && Object.hasOwn(WAGON_UPKEEP_RULES, tier) ? WAGON_UPKEEP_RULES[tier] : null);
