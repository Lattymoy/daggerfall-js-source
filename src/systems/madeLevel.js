// @ts-check
// EG-H2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 24, slice EG7): THE
// MADE LEVEL'S RULES - one law for the three made levels the world host stands a player in: the Burning Court (an
// Oblivion Gate's arena, world/gate/gateArena.js), the Shattered Hour (world/superDungeon/sdRealm.js) and an Elite Breach's circle - the
// Spire (world/eliteGates/egHall.js). Each rule's door asked the level itself (`gateArenaDay`, `sdRealmSlot`, `egHallBreach`,
// `isGateArena`, `_sdRealm`, `_egHall`), so a third made level grew a third copy of every check and one was forgotten
// (THE FOUR HOSTS RULE's own failure: the pause's Save never learnt the Spire). Now a door asks THIS law what the level
// under the player turns off, and test/systems/eliteGates/egmade_law.test.js sweeps the hosts so no door asks a level again (THE ONE
// CONSTRUCTION SEAM).
//
//   madeLevelOf(loc)      'court' | 'hour' | 'spire' | null - the location's own predicates, read in one place
//   MADE_LEVEL_RULES      what each level turns off, as data (null: as the game does it today)
//   MADE_LEVEL_TEXT       how each level refuses, in its own words (the court's, the Hour's, the Spire's - unchanged)
//   madeLevelRule(lv, r)  a rule of a level; madeLevelSays(lv, r) its refusal's words
//   registerMadeLevelHere the world host's word on where the player stands (and whether on the Spire's traversal
//                         ground), so a door with no host in reach (an item's use, a technique) asks the same law
//
// The Burning Court and the Hour were re-plugged unchanged (EG7) - every value for them what their doors did before this
// law, pinned by their own tests and by the law's - and EVENT-RULES moved two rows since (AUDIT WORLD-EVENTS L5-14): their
// regeneration held, not off, and no level refusing a party member's Resurrect. The Spire's column is section 24's, with
// THE POTION LAW, THE FORGIVENESS (section 10.8), the flight bans (section 10.7), AvoidDeath refused and DEATH-PENALTY none.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { isGateArena, COURT_TEXT } from '../world/gate/gateArena.js';
import { isSdRealm, SD_REALM_TEXT } from '../world/superDungeon/sdRealm.js';
import { isEgHall } from '../world/eliteGates/egHall.js';
import { EG_TEXT } from '../net/eliteGates/egLaw.js';
import { isKetchShip } from '../world/ketch/ketchShip.js';   // KETCH: the sky-ketch, a made level as the Hour is
import { KT_WORDS } from './ketch/ketchWords.js';   // KETCH: her refusals, in the player's language (L10N4)

/** The made levels, by the law's names. KETCH (2026-10-24, bible/11-Multiplayer/Sky-Ketch.md section 3): and the sky-ketch's. */
export const MADE_LEVELS = Object.freeze(['court', 'hour', 'spire', 'ketch']);

/**
 * Which made level a location is: the Burning Court, the Shattered Hour, the Spire, or none. The three predicates are
 * their own homes' (each asks its made record's location id), mutually exclusive.
 * @param {any} loc a dungeon location (worldModes' `dungeonLoc`, dungeonContext's `dfLocation`)
 * @returns {'court'|'hour'|'spire'|'ketch'|null}
 */
export const madeLevelOf = (loc) => (isGateArena(loc) ? 'court' : isSdRealm(loc) ? 'hour' : isEgHall(loc) ? 'spire' : isKetchShip(loc) ? 'ketch' : null);

/** THE FORGIVENESS (section 10.8): a jump pressed up to this long before landing fires on landing; a plain jump pressed
 *  up to this long after walking off an edge still leaps (s). The Spire's alone - the motor is DFU's elsewhere. */
export const EG_JUMP_BUFFER_S = 0.12;
export const EG_LATE_PRESS_S = 0.12;
/** The technique flight's refusal on the Spire's traversal ground (section 10.7: on a span a leap would be a bridge). */
export const EG_NO_FLIGHT_TEXT = 'The Spire\'s spans are walked, not flown.';

/**
 * Every rule the law knows, and what its value means (null in a level's row: the game's own, as today):
 *   save          'refused'  - the save door and the pause's Save (the exit autosave asks the same door)
 *   rest          'refused'  - the rest window (the travel map's journeys are the dungeon's own refusal)
 *   automap       'off'      - no map kept, the M key refused
 *   mark          'refused'  - Recall's Mark
 *   recall        'refused'  - a Recall cast (the court refuses the Mark alone - World-Bosses.md: "Recall's mark")
 *   portalStone   'refused'  - a Portal Stone's portal
 *   companions    'out'      - GATE-ALONE, SD-ALONE: lifted at the door, stood again outside
 *   regen         'held'     - the court's law (systems/courtRules.js): natural regeneration at half, and none for 5 s
 *                              after a hurt (EVENT-RULES - it was 'off', WBX6's)
 *   potions       'counted'  - THE POTION LAW: two restoring potions a hall (systems/eliteGates/spireKit.js, the count the breach's
 *                              client keeps - ui/eliteGates/egHud.js EG_POTIONS_PER_HALL)
 *   levitate      'banned'   - the Levitate ward (characters/playerEntity.js registerLevitateWard)
 *   slowfall      'banned'   - the motor's slow fall written false (the effect still runs)
 *   techFlight    'refused'  - a weapon technique's leap or dash, on traversal ground
 *   jumpBuffer    seconds    - THE FORGIVENESS's buffer (0: DFU's motor, none)
 *   latePress     seconds    - THE FORGIVENESS's late press (0: none)
 *   runLeap       'refused'  - EG-PERFECT: the enhanced climb's RUNNING LEAP (player/motor.js _pkMayLeap - CLIMB3's leap at an
 *                              edge and its late press) refused, so a running Jump at an edge is the plain jump the courses
 *                              were proven with; the wall run, the mantle, the vault and the free climb are kept
 *   resurrect     'refused'  - a party member's Resurrect (EVENT-RULES, 2026-10-25, the owner: "Resurrect allowed" - no
 *                              level refuses it now; the key stays for a level that will)
 *   avoidDeath    'refused'  - Stendarr's AvoidDeath (GuildManager.AvoidDeath)
 *   death         'castOut' | 'final' | 'fall' - what a death is: cast out before the gate, final for the Hollow, a fall
 *   deathPenalty  'none'     - DEATH-PENALTY's tenth of the purse not taken
 *   unstuck       'refused' | 'wayHome' - /unstuck refused, or the level's own way out
 *   says          'mid' | 'hour' - the voice a level's refusal is said in (the mid-screen line, the Hour's own voice)
 */
export const MADE_LEVEL_RULE_KEYS = Object.freeze(['save', 'rest', 'automap', 'mark', 'recall', 'portalStone', 'companions', 'regen', 'potions', 'levitate', 'slowfall',
  'techFlight', 'jumpBuffer', 'latePress', 'runLeap', 'resurrect', 'avoidDeath', 'death', 'deathPenalty', 'unstuck', 'says']);
const NONE_IS_ZERO = new Set(['jumpBuffer', 'latePress']);
/** A level's row: every rule named, null (or 0 for a duration) where the level leaves the game as it is. */
const row = (o) => Object.freeze(Object.fromEntries(MADE_LEVEL_RULE_KEYS.map((k) => [k, o[k] ?? (NONE_IS_ZERO.has(k) ? 0 : null)])));
/** WHAT EACH MADE LEVEL TURNS OFF (section 24's table, as the doors read it).
 *  EG-PERFECT (2026-10-18, Mac: "Traversing between sections should present a challenge, platforming should be detailed"):
 *  THE RUNNING LEAP REFUSED on the made levels whose ways are proven gap by gap - the Spire's spans (section 10.5, THE TIMED
 *  SOLVER) and the Shattered Hour's Unmoored Steps (SD7b) are both proven with THE SPAN BUILD's PLAIN running jump, and the
 *  enhanced climb is forced on online (systems/features.js `enhanced-climbing`, scenes/shared.js parkourSwitchOn): a running
 *  Jump within PARKOUR_RUNLEAP_EDGE of an edge became CLIMB3's leap, ~3.9 m at Jumping 0 and ~8.4 m at Jumping 100 - past the
 *  platform the plain jump lands on (the sweep with the online page's parkour on every frame: 50 of 308 courses not crossed with
 *  the leap, none refused - Elite-Gates.md's EG-PERFECT ways record). The Hour shares the law (its Steps are the Spire's pieces'
 *  own record, and its online page forces the same lane), so both rows refuse it; the court has no course. The wall run, the
 *  mantle, the vault and the free climb stay on. THE AUDIT: the Hour gives no late press (DFU's motor's own), so its refused
 *  late Jump past an edge is nothing at all - as DFU's; the Spire's is its own forgiveness, the plain jump.
 *  EVENT-RULES (2026-10-25, the owner, on "a lot of people are unhappy with the world event restrictions including the
 *  regen not working"): every level HOLDS regeneration now ('held' - half, and none for 5 s after a hurt), where it had
 *  turned it off and said nothing; and none refuses a party member's Resurrect - the Hour's one life is the relay's to
 *  keep until the fallen gives it up (Super-Dungeons.md SD-ONELIFE, EVENT-RULES). The rest stands, said on the HUD's
 *  made-level tile (ui/hud/statusTips.js madeRulesTile). */
export const MADE_LEVEL_RULES = Object.freeze({
  court: row({ save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', portalStone: 'refused', companions: 'out', regen: 'held', death: 'castOut', unstuck: 'refused', says: 'mid' }),
  hour: row({ save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', recall: 'refused', portalStone: 'refused', companions: 'out', regen: 'held', levitate: 'banned',
    runLeap: 'refused', death: 'final', unstuck: 'wayHome', says: 'hour' }),
  spire: row({ save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', recall: 'refused', portalStone: 'refused', companions: 'out', regen: 'held', potions: 'counted',
    levitate: 'banned', slowfall: 'banned', techFlight: 'refused', jumpBuffer: EG_JUMP_BUFFER_S, latePress: EG_LATE_PRESS_S, runLeap: 'refused', avoidDeath: 'refused', death: 'fall',
    deathPenalty: 'none', unstuck: 'refused', says: 'mid' }),
  // KETCH (bible/11-Multiplayer/Sky-Ketch.md section 3): the Hour's row for the deck (its Sailwalk the Hour's own course, its
  // running leap refused), the Spire's for flight (no Levitate, no slow fall, no technique's leap on the Sailwalk), and a
  // death a FALL - the death save's (scenes/ketch/ketchClient.js fallSave): out of the sky to the fields under her
  // anchor-lift, no DEATH-PENALTY, no Stendarr, and the anchor-lift there to ride again while she keeps station
  ketch: row({ save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', recall: 'refused', portalStone: 'refused', companions: 'out', regen: 'held', levitate: 'banned',
    slowfall: 'banned', techFlight: 'refused', runLeap: 'refused', avoidDeath: 'refused', death: 'fall', deathPenalty: 'none', unstuck: 'refused', says: 'mid' }),
});
/** HOW EACH REFUSES, in its own words - the three homes' own lines, unchanged (the Spire's Mark is its Recall's). */
export const MADE_LEVEL_TEXT = Object.freeze({
  court: Object.freeze({ save: COURT_TEXT.noSave, rest: COURT_TEXT.noRest, automap: COURT_TEXT.noMap, mark: COURT_TEXT.noMark, unstuck: COURT_TEXT.noUnstuck }),
  hour: Object.freeze({ save: SD_REALM_TEXT.noSave, rest: SD_REALM_TEXT.noRest, automap: SD_REALM_TEXT.noMap, mark: SD_REALM_TEXT.noMark, recall: SD_REALM_TEXT.noRecall }),
  spire: Object.freeze({ save: EG_TEXT.noSave, rest: EG_TEXT.noRest, automap: EG_TEXT.noMap, mark: EG_TEXT.noRecall, recall: EG_TEXT.noRecall,
    unstuck: `${EG_TEXT.noRecall} The way home stands at a Redoubt.`, techFlight: EG_NO_FLIGHT_TEXT }),
  // KETCH: read when it refuses - the Sailwalk walked, not flown, and /unstuck's refusal aboard: her ways down are her own
  ketch: Object.freeze({
    get save() { return KT_WORDS.noSave; }, get rest() { return KT_WORDS.noRest; }, get automap() { return KT_WORDS.noMap; }, get mark() { return KT_WORDS.noMark; },
    get recall() { return KT_WORDS.noRecall; }, get unstuck() { return KT_WORDS.noUnstuck; }, get techFlight() { return KT_WORDS.noFlight; },
  }),
});

/**
 * A rule of a made level: its value in MADE_LEVEL_RULES, or null (0 for a duration) for no made level.
 * @param {string|null|undefined} level @param {string} rule
 */
export function madeLevelRule(level, rule) {
  const r = level ? MADE_LEVEL_RULES[/** @type {'court'|'hour'|'spire'|'ketch'} */ (level)] : null;
  if (r && Object.hasOwn(r, rule)) return r[rule];
  return NONE_IS_ZERO.has(rule) ? 0 : null;
}
/**
 * The words a made level refuses a rule in, or '' (no level, or a rule it says nothing of).
 * @param {string|null|undefined} level @param {string} rule
 */
export function madeLevelSays(level, rule) {
  const t = level ? MADE_LEVEL_TEXT[/** @type {'court'|'hour'|'spire'|'ketch'} */ (level)] : null;
  return (t && Object.hasOwn(t, rule) ? t[rule] : '') ?? '';
}

// ── where the player stands: the world host's word ───────────────────────────────────────────────────────
/** @type {(() => any) | null} */
let _here = null;
/** @type {(() => any) | null} */
let _traverse = null;
/**
 * The world host's word on the made level under the player (scenes/world.js - its mode machine's `madeLevel`), and
 * whether its feet stand on the Spire's traversal ground (off the hall's fight floor - scenes/eliteGates/egClient.js onTraverse).
 * A door with no host in reach reads them: an item's use (systems/eliteGates/spireKit.js), a technique (combat/techniques.js), the
 * motor's forgiveness. Null removes either. A word that throws is no made level.
 * @param {(() => any) | null} here @param {(() => any) | null} [traverse]
 */
export function registerMadeLevelHere(here, traverse = null) {
  _here = typeof here === 'function' ? here : null;
  _traverse = typeof traverse === 'function' ? traverse : null;
}
/** The made level under the player now, or null. */
export function madeLevelHere() {
  try { const v = _here?.() ?? null; return MADE_LEVELS.includes(v) ? /** @type {'court'|'hour'|'spire'|'ketch'} */ (v) : null; } catch { return null; }
}
/** A rule of the made level under the player now. */
export const madeRuleHere = (/** @type {string} */ rule) => madeLevelRule(madeLevelHere(), rule);
/** Its refusal's words. */
export const madeSaysHere = (/** @type {string} */ rule) => madeLevelSays(madeLevelHere(), rule);
/** Whether the player's feet stand on traversal ground (the Spire's spans, off every fight floor). */
export function madeOnTraverse() {
  try { return !!_traverse?.(); } catch { return false; }
}
