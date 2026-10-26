// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 6, 7, 8 and 16) and EG-FULL
// (2026-10-11, Mac: "I said I want everything"): THE DIRECTOR - an Elite Breach as its relay room runs it. One record
// (`B`) holds the breach: the company frozen at the open, each member's admission, life, purse and run (their Vestiges,
// Reliquaries, Cantrips, lumen, shards and tonics), the hall the company stands in and its stage, THE COUNT, the
// decrees, the company's word, the Mementos, the Redoubts taken, the end; and the hall's fight (`B.F`, net/eliteGates/egBodies.js -
// its lords and champions, net/eliteGates/egLords.js; its legion, net/eliteGates/egLegion.js; its errands' objects). The room
// (server/src/index.js `_egTick`) steps it every BRAIN_TICK_MS over the members' bodies and fans what it answers - a
// frame carrying `to` to that member alone; it mints the receipts the record owes (`B.owe`) with the relay's key.
//
// ONE HALL AT A TIME, THE COMPANY TOGETHER (section 7): `arrive` (each member stepping onto the hall's arrival plate is
// `here`; the hall wakes EG_GATHER_MS after the last, or EG_ARRIVE_MAX_MS after the pull), `trial` (the hall's kind and
// variant - section 8 - and its twist), `closing` (the door open; each member steps through it, `down`), the pull. A
// Court's fall takes the circle's Redoubt for every living member at once (section 16.2's sequence): its receipts, the
// count's time, the recalls, the rest with its Vestiges, the next circle's decrees and the company's word, the way home.
//
// THE COUNT (section 6.2), THE GOLD RUN, THE COVENANT'S PATIENCE (section 18), the respite and the Surplus.
// ONE LIFE, ONE RECALL (section 16.5): a fall makes a witness; the next Redoubt the living take calls them back once, or a
// Memento carried to a Battlemage's niche does sooner; a second fall is final. No living member, and the breach ends.
//
// EG-FULL, LAYER THREE (section 11): THE FRAGMENTS' RELAY HALF - the engines worked (`use`), the alcoves behind their
// false walls, THE FORK's High Road cache and Low Road niche and foes and its closing, the Clan Pit's Honour Horn, the
// fragments' Lurkers, a lord's page of the Annals (net/eliteGates/egAnnals.js).
//
// EG-ZC (2026-10-12, Mac: "I said I want everything"; sections 11.4, 11.10 and 22): THE ENGINES AS WRITTEN - the Sluice's
// channel flooded 6 s, the Moon-Mirror lighting a branch as well as blinding the Divers (its body held in THE FAIR TRAIL);
// the Low Road's closing waiting on either road (forkClosing); every hall drawn in the breach's own law (`egv`).
//
// EG-H1 (EG8d, 2026-10-12, Mac: "I said I want everything"; section 21): WHAT THE RELAY JUDGES - each member's pose fed
// to THE FAIR TRAIL at its shared time (egPoseIn, net/eliteGates/egFair.js), every pose-gated credit asking it (the door, `down`, a
// cache, THE GOLD RUN, a niche, a Memento, the Vault, the High Road's cache), a second break refusing a member's hits a
// while; THE BODY COUNTED and enforced - the relay's count is the member's one life (egCount: one judge for every shape and
// the hall's hazards, net/bossRef.js; a fall told `bd`), the room's own heals restored to it (egCountHeals), the member's
// own word believed (egBodyWord); Watchfire's company told each committed blow early (egWatchOf).
//
// EG-ZA (2026-10-12, Mac: "I said I want everything"; sections 20, 21, 22 and 23): THE RECEIPTS SAY EVERYTHING - an end
// carries `td` (the Descent's seconds, which only the herald heard) and `co` (the company - net/eliteGates/egReceipt.js
// egCompanyTag); a Redoubt carries `sh` (the member's share of the circle's damage, thousandths), `m` (THE FAIR TRAIL's
// measures over the circle, folded as each trail closes - measureFold) and `co`. And A KEY IS NEVER LOST: a breach that
// ends with no hall woken is a void - never the opener's 'empty', unless the room was told its call went out
// (`B.called`) - and an opener who never entered is owed the void itself (egEnd).
// EG-ZB (2026-10-12; sections 8.2, 11.7, 19 and 21): THE LEGION HUNTS - a span's legion raised in its stage (spanLegion: the
// Harriers shadowing the company, the Divers waiting at its islands), a blow struck only from THE FIGHT GROUND
// (net/eliteGates/egWalkGraph.js), a member off the floors past six seconds hunted (huntStep), and THE CENSUS widened: the drains, the
// Vestiges that change it, Featherstep's cast-back, a fallen segment's catch, and who each blow caught (`F.cg`, the feats').
// EG-ZF (2026-10-12, Mac: "I said I want everything"; section 27.6): THE RECAP'S NUMBERS - each member's damage and healing
// over the breach (`st`'s and `end`'s `ds`), a Court's DAMAGE CHART at its lord's fall (`rd`'s `dm`), the healing a
// companion's spell did said by its receiver (egHeal) - counted by net/eliteGates/egTally.js.
// EG-ZI (2026-10-12, Mac: "I said I want everything"; sections 7, 10.6, 15 and 21): THE DIRECTOR'S LAST RULES - THE PULL'S
// TOLL (egTollOf: a member pulled short of a crossed hall's end pays for the road still ahead of its furthest fair point,
// said to it - `toll` - and taken off its count, egCountHeals); THE LATE WAKE (a hall woken before a member's `here`
// counted, `m.late`; after two in a row the gather waits only EG_LATE_ARRIVE_MS for it - arriveWait - and its `here` is
// heard when it reaches the plate after the wake); and LIFELINE IN THE CENSUS (a heal of a Lifeline holder's, said while
// its member stood under 30%, spares that member's blows for 3 s - egHeal, egCensusDr).
// EG-ZR (2026-10-12; section 15): SHIELD-HYMN IN THE CENSUS - Rally's heal at a door with a Bastion holder within 10 m of
// another member holding Rally gives the company that Bastion for 4 s (egHymnStep, read by egCensusDr).
// EG-ZS (2026-10-12; section 15, EG-ZR's "Not built"): THE MASTERIES AND THE ACCORDS ON THE RELAY - BLADESTORM, DEADEYE and
// KINDLED STEEL struck by the room itself (hostHits, hostStrike, egBehind), an Echo's claim taken at its share (net/eliteGates/egRun.js
// egEchoShare - War-Chorus whole), Ambush spent by the blow after a Fade, a mark's layer kept (Hammer and Anvil); and in the
// census STONESKIN COUNTED (egCountWhole: a holder's count is of its whole body, the cushion with it, so it falls where its
// screen does) and LIVING WALL on the room's heals (egWallOf).
// THE ASCENT (LAW 9, 2026-10-16; Elite-Gates-Ascent.md section 1): PROGRESS IS ALONG THE ROUTE (net/eliteGates/egRoute.js) - the toll's
// road and its road ahead (egTollOf), the Captive's chains along the course (egCaptiveSpots), the Low Road's member and a
// trail's road (onLowRoad, egPoseIn - the road of the route's nearest way, by height too), the leading member, the Divers'
// island ahead and the Harriers' rise ahead of their member (spanLegion) - never z. Laws 4-8: the route's measure is their
// z, their road the fork's by x, every number the number it was.
// EG-PERFECT (2026-10-18, the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect"):
// THE HALLS AS THE RELAY READS THEM, no hall drawn otherwise - a door its trial's end opens closes, in a hall laid as a way
// (LAW 9), in EG_CLOSING_FIGHT_MS and its way from the trial's end to the door at THE SPAN BUILD with a quarter to spare
// (egClosingMs: the door stood a median 180-240 m on and the closing was 20 s, so its cache was lost and the pull came first);
// the Deserter raised and the Pit's Ashfall kept on the fight floor, never on the fight's bounding disc (`spec.fight`);
// the Captive's chains the law laid off every fight floor (a hero chamber's under LAW 9) hung about the chamber's floor
// (egCaptiveSpots); and a chamber's Casters on its raised anchors (egCasterStands, section 11.7).
//
// Pure: a record and a beat in, frames out. Not a DFU member. Ledger A (ELITE-GATES).
import { EG_SPEC, EG_SEALED_MS, EG_GATHER_MS, EG_ARRIVE_MAX_MS, EG_CLOSING_FIGHT_MS, EG_CLOSING_SPAN_MS, EG_CLOSING_COUNT_MS, EG_REST_MS,
  EG_WAKE_RING_MS, EG_ABSENT_TRIAL_MS, EG_LAST_WORD_MS, EG_COUNT_CAP_MS, egHallOf, egCircleOfHall, egFirstHallOf, egStartHall, egTimes, egAdmits, egCountNew, egCountLeft, egCountRun, egCountHold,
  egInHall, egLocalX, egOnArrive, egAtDoor, egOnFight, egSpecDigest, egGeoOf, egSeed, egProclamationOf, egKeepOnFight, EG_VOID_Y, EG_CAST_BACK_LOSS, EG_CAST_BACK_FLOOR } from './egLaw.js';
import { EG_LATE_HALLS, EG_LATE_ARRIVE_MS, EG_TOLL_STEP, EG_TOLL_QUARTERS, EG_TOLL_WAIVE_MS, EG_TOLL_KINDS } from './egLaw.js';   // EG-ZI: the late wake and the pull's toll (sections 7 and 10.6)
import { egCountRedoubt, egRedoubtHold, egCountOver, EG_OPEN_ENDS } from './egLaw.js';   // AUDIT EG III (lane2 #1, #2): the count's one law, the good ends
import { EG_ROLE, EG_FL, EG_GONE, EG_STATE_EVERY_MS, egFightNew, egFightBind, egCarry, egMovesOut, egHpOut, egBlowsStep, egHitBody, egGone, egHas, egSetFl, egBodiesOf, egBodyById, egHpTeam, egRaise, egWalk, egAim, egTethersOut, egMarksOut, egStruck, egMark, egUnmark, egMarkOf, egBodyAt } from './egBodies.js';
import { egStruckOff } from './egBodies.js';   // FIELD BUGS 2026-10-18f TURNED-BLOW: a blow from off the fight ground, the one law
import { EG_KIND, EG_LEGION_KINDS, EG_DIVER_WAIT_R, egIsleAhead, egAirY, egLegionStep, egLegionRaise, egWaveKinds, egWaveSize, egAddSlain, egSquad } from './egLegion.js';
import { egLegionRoom, egLegionCapOf, egEscortOf, egLurkerWake } from './egLegion.js';   // AUDIT EG III: the room under the legion's cap, a champion's escort, a struck Lurker's wake
import { egLegionSummon, egBinderBroken, egSpotted } from './egLegion.js';   // AUDIT EG IV: a summons held to the room, a Binder's raise broken, a Spotter's arrow
import { egShieldTurns, egShieldSoak } from './egLegion.js';   // AUDIT EG V (L2-7): a Shielded elite's shield, one law for every blow
import { EG_OBJ, egLordsWake, egLordsAwake, egLordsFell, egLordsOf, egObjBroken, egObjsOf, zoneOut, egStun, egZonesKeep, EG_ZONE_FIGHT_MS } from './egLords.js';
import { EG_SEAM, egLordsFight } from './egLords.js';   // EG-ZK (section 13.1): every lord through THE BOSS SEAM, called inside the one beat
import { egLordsStand } from './egLords.js';   // FIELD BUGS 2026-10-19e LORD-SHARES: the lords stood for the company on the plate
import { egPieceIn, egPolyEdgeDist } from './egShape.js';   // AUDIT EG IV (lane1 #11): a champion's wake ring off its floor
import { egAsk, egVote, egAskResult, egAsksDue, egDecreesAsk, egDecreesChosen, egDecreeRanks, egDecreesInForce, egBargainDecree, egTideOf, egStratumAt, egStrataTo, egOffers, egPick, egPicksClose, egSurplus,
  egLoseNewest, egCacheDraw, egGive, egBuy, egVestigeX, egThreatX, egFadeOn, egMarkFoe, egRunOf, EG_CANTRIPS, EG_LUMEN_ADD, EG_LUMEN_RIFT } from './egRun.js';
import { egVOf, egRankOf, EG_MASTERIES, EG_AURA_EXTRA, EG_AURA_EXTRA_MAX, EG_DR_MAX } from './egVestige.js';
import { egHymnOf, EG_HYMN_MS } from './egVestige.js';   // EG-ZR (section 15's Accord): Shield-Hymn's pair and its seconds
import { egResonance, egAccordMates, EG_STORM_N, EG_STORM_M, EG_FAR_M, EG_KINDLED_M, EG_WALL_X, EG_ECHO_Q } from './egVestige.js';   // EG-ZS: the capstones, the Accords
import { EG_M_ID, EG_SWEEP_M, EG_SPILL_M, EG_COUNTER_M } from './egVestige.js';   // AUDIT EG III: Sweeping Arc's, Spillover's and Counterstroke's numbers
import { egSpirebridge } from './egVestige.js';   // AUDIT EG III: Spirebridge, the room's rule
import { egEchoShare, egCompanyAt } from './egRun.js';   // EG-ZS: an Echo's share; the company the pair law reads at a blow
import { egBargainOpen, egFrayOf } from './egRun.js';   // AUDIT EG V: a Bargain only with a family free (L2-4); The Fraying's fray (L2-10)
import { shDisc, shLane, egInShape } from './egShape.js';
import { egBlowNear } from './egFloor.js';   // AUDIT EG III: Counterstroke's reach from a lord's blow
import { EG_ENGINES, EG_ENGINE_REACH_M, EG_ENGINE_CD_MS, EG_ENGINE_PCT, EG_ENGINE_TELL_MS, EG_ALCOVE_REACH_M, EG_NICHE_HEAL, EG_MIRROR_REACH_M, EG_MIRROR_LIT_R, EG_HAZARDS, egWispAt } from './egFragLaw.js';   // EG-FULL LAYER THREE: the fragments' relay half (EG-ZC: the Moon-Mirror's branch; EG-ZB: the census's drains)
import { EG_BODY_R } from './egSpanLaw.js';   // EG-ZC: a lit branch's top, the capsule about it
import { EG_BALCONY_OUT_CM, EG_BALCONY_R_CM } from './egFragLaw.js';   // EG-PERFECT: a kit chamber's balconies about its court - its Casters' reach
import { egAnnalsNext, egAnnalsLordPage } from './egAnnals.js';
import { egFeatBits } from './egFeats.js';   // EG-E: the lords' feats, judged at a lord's fall
import { arenaWeekOf } from '../arena/arenaLaw.js';   // EG-E: the Proclamation's week, the arena's (Monday to Monday from the season epoch)
import { EG_HERALD_TELL_MAX } from './egHerald.js';   // EG-E3: the herald's news, kept on the breach for the hub
import { orreryOf, orreryFresh, orreryJudge, orreryShortest, SD_STONES, SD_HOURS } from '../superDungeon/sdBrain.js';
import { BUCKET_DEPTH_X, GATE_HIT_HZ_MAX, HIT_KINDS,  dpsRef, clampLv } from '../gate/gateBrain.js';
import { HIT_CAP_X, spendPurse } from '../gate/gateBrain.js';   // AUDIT EG III: Spillover's carry, within its blow's cap and out of the purse
import { SAP_HEAL, SAP_FEEDS_MAX } from '../gate/gateBrain.js';   // AUDIT EG IV (lane1 #17): a Sapper feeds a lord by the gate's law, its feedings capped
import { EG_LORDS } from './egLaw.js';   // AUDIT EG IV (section 18's strata): a lord's band, for the Twin Court's second
import { egMoltenRim } from './egLaw.js';   // AUDIT EG V (lane1 #21): THE MOLTEN RIM and its causeways
import { egFightPieceAt } from './egLaw.js';   // THE ASCENT - HEIGHT: a champion's ring on its own floor
import { egLawOf, EG_BROKEN_LAW } from './egLaw.js';   // EG-PERFECT - THE BROKEN WAY (spec law 10): a fight hall's trial awaits its company
// EG-H1 (EG8d): WHAT THE RELAY JUDGES - THE FAIR TRAIL and its time law (net/eliteGates/egFair.js), one judge for every shape and the
// hall's own hazards (net/bossRef.js), and the body counted (net/bossBody.js) - the member's one life
import { egFairNew, egFairPose, egFairOk, EG_FAIR_WORDS, egFairRefuses, egFairCross, egRideHolds, egRideAt, egCrossMinMs, egFallenAt, egTrailAt, egFightFloorAt, EG_POSE_NEAR_MS, EG_SUPPORT_UP_M, EG_SUPPORT_DOWN_M, EG_TS_LAG_MAX_MS } from './egFair.js';
import { egCompanyTag, EG_SHARE_WHOLE, EG_MEASURES, EG_MEASURE_MAX } from './egReceipt.js';   // EG-ZA: the company, the share and the measures a receipt carries
import { judgePlace } from '../bossRef.js';
import { bodyStruck, bodySaid, bodyHealed, bodyLife } from '../bossBody.js';
// EG-ZB (2026-10-12; sections 8.2, 11.7, 19 and 21): THE LEGION HUNTS - the fight ground and the walk graph (net/eliteGates/egWalkGraph.js),
// the span's legion, the hunt, the census's drains and its Vestiges, who a place's blow caught
import { egFightView, egGroundAt, egAirKeep, EG_STRIKE_PAD_M } from './egWalkGraph.js';
import { egByHeight, egFeetY, egBears } from './egWalkGraph.js';   // THE ASCENT - HEIGHT: who stands where, by their feet
import { egTallyWake, egTallyBlow, egTallyFall, egTallyHeal, egChartOf, egTalliesOf } from './egTally.js';   // EG-ZF: the recap's numbers (section 27.6)
import { healRef } from '../gate/gateBrain.js';   // EG-ZF: a heal's share of the count, at the gate's reference health
import { BRAIN_TICK_MS } from '../gate/gateBrain.js';   // EG-ZI: Lifeline's look back over the beat a count was last seen low
import { EG_TRAIL_MS } from './egFair.js';   // EG-ZI: a Lifeline window kept while a blow in it may still be judged
import { egTubeAtMouth } from './egFair.js';   // EG-PERFECT: a routed hall's Collapsing Tube falls from the company's arrival at its mouth
import { egRouteAlong, egRouteAlongAt, egRouteRoad, egRouteRoadAt, egRouteAhead } from './egRoute.js';   // THE ASCENT (LAW 9): progress along the hall's route
import { egRouteOf } from './egRoute.js';   // EG-PERFECT: the route's paths, the trial's end on them
import { egRouteSolved, EG_WAIT_MAX } from './egSpanLaw.js';   // EG-PERFECT: the way to the door at THE SPAN BUILD, a pair's proven wait
import { egRouted } from './egRouteProof.js';   // EG-PERFECT: a hall laid as a way (LAW 9)
import { egFeetAt, EG_GROUND_UNDER_M } from './egWalkGraph.js';   // EG-PERFECT: a caster anchor's raised floor; the hero box it stands in, by its feet

/** The rifts together hold this many seconds of the company's reference damage (section 8.1); a Wellspring's great
 *  rift and each anchor; a Rampart's gate's Ward-Bearers; a Muster's standard; a captive's chains; a Holdfast's hold. */
export const EG_RIFT_TEAM_S = 36;
export const EG_SPRING_S = 30;
export const EG_ANCHOR_S = 4;
export const EG_GATE_TEAM_S = 12;
export const EG_STANDARD_S = 20;
export const EG_CHAIN_S = 4;
export const EG_HOLD_MS = 75_000;
export const EG_RELIC_MAX = 100;
/** AUDIT EG III (lane2 #1; section 16.3): what a Reliquary of a circle already paid this week gives instead (lumen). */
export const EG_REL_LUMEN = 20;
export const EG_WINCH_MS = 60_000;
export const EG_SILENCE_MS = 3000;
export const EG_ENGINE_HOLD_MS = 45_000;
/** AUDIT EG V (c, L7-7; sections 16.4 and 16.5 - "every 3 s"): a ping's cooldown, living or witness (ms) - the screen shows it. */
export const EG_PING_MS = 3000;
/** EG-FULL LAYER THREE - THE CLAN PIT's Honour Horn (section 11.2): first blown this long after the wake, then once the
 *  last call ends and this long more; the Kynval's ring (m); Ashfall's pulse (ms) and its pools. */
export const EG_HORN_FIRST_MS = 20_000;
export const EG_HORN_AGAIN_MS = 40_000;
export const EG_HORN_RING_M = 6;
export const EG_ASHFALL_EVERY_MS = 6000;
/** The High Road's cache and the Low Road's niche reach (m). */
export const EG_HCACHE_REACH_M = 2.5;
export const EG_SCRIPTORIUM_MS = 30_000;
/** AUDIT EG III - the halls Kyn's Vigil stands no champion in (section 14): a Proving Walk's and a Court's (a champion or a lord
 *  of their own), the Scriptorium (no trial), a span and a Brink (a crossing, its arrival plate the crossing's start - a lord
 *  keeps to the fight ground, and a span's islands are not joined: it could follow no one). */
export const EG_VIGIL_NONE = Object.freeze(['proving', 'court', 'scriptorium', 'span', 'brink']);
/** How often each rift pours a wave at circle c (section 8.1 - never under nine seconds), a Rampart's march, a Court's
 *  escort, an Athenaeum's pressure, Hunting Pack's (ms). */
export const egWaveEveryMs = (c) => Math.max(9000, 20_000 - 500 * (c - 1));
export const EG_MARCH_EVERY_MS = 12_000;
/** AUDIT EG IV (lane10 #17; section 8.3) - THE MARCH HOLDS THE GATE: a Rampart's Ward-Bearers are warded while any of its march
 *  stands within this of the portcullis (m). */
export const EG_GATE_HOLD_M = 20;
export const EG_ESCORT_EVERY_MS = 25_000;
/** A Kynval Squad (section 8.7) stands in place of a wave: the hall's first wave held this long (ms); on a Rift-Yard its four
 *  elites stand this far about the yard's heart (m - AUDIT EG V, L3-4: the yard's squad was never stood). */
export const EG_SQUAD_HOLD_MS = 30_000;
export const EG_SQUAD_RING_M = 6;
export const EG_LOCK_EVERY_MS = 15_000;
/** AUDIT EG V (L3-1; section 8.4) - THE ORRERY'S REACH: the most turns six stones can ever need from any start (each stone's
 *  way at most half the hours, net/superDungeon/sdBrain.js sdTurnsFor), 36. orreryOf draws the start again until its shortest way lies in
 *  the range it is asked, so a range past the reach is drawn for ever - the relay's room hung on an Athenaeum from circle 56. */
export const EG_ORRERY_REACH = SD_STONES.length * (SD_HOURS / 2);
/** AUDIT EG V (L3-1): THE SPIRE'S TURNS RANGE for an Athenaeum of circle `c` (section 8.4) - 16 to 28 turns, rising by 2 every
 *  five Redoubts until its top reaches EG_ORRERY_REACH (circle 21 on: 24 to 36), where it stays. Pure. */
export function egOrreryTurns(c) {
  const k = Math.max(0, Math.min(Math.floor((c - 1) / 5), (EG_ORRERY_REACH - 28) / 2));
  return { turnsMin: 16 + 2 * k, turnsMax: 28 + 2 * k };
}
/** AUDIT EG V (L2-6; section 17.2) - STILLNESS: the next hall that pours a wave of its own holds its first this much longer
 *  (ms) - a Rift-Yard's rifts, a Rampart's march, an Athenaeum's pressure, a Proving Walk's escort, a Court's first escort, a
 *  Deepway chamber's rifts or engine waves, a span's shadows; a hall that pours none (egStillHolds) leaves it for the next. */
export const EG_STILL_MS = 10_000;
/** AUDIT EG V (L2-6): does hall `spec` pour a wave of its own for Stillness to hold - not the Scriptorium (no trial), a Brink
 *  (no legion), a Gauntlet (its Casters stand on their pillars from the wake) or a Deepway whose chamber is a champion's? Pure. */
export const egStillHolds = (spec) => !(spec.kind === 'scriptorium' || spec.kind === 'brink' || (spec.kind === 'rampart' && spec.variant === 'gauntlet') || (spec.kind === 'deepway' && (spec.spots?.chamber?.[0]?.obj ?? 0) === 1));
/** The rifts a company of n living members faces (section 8.1); the legion's cap is net/eliteGates/egLegion.js's (egLegionCap). */
export const egRiftsFor = (n) => Math.max(3, Math.min(5, 2 + Math.ceil(n / 3)));
export { egLegionCap, EG_STANDING_MAX } from './egLegion.js';
/** THE RESPITE BUDGET (section 6.2): fifteen minutes a breach, ten more each Valkynaz Redoubt; spent in two-minute pieces. */
export const EG_RESPITE_BUDGET_MS = 900_000;
export const EG_RESPITE_VALK_MS = 600_000;
export const EG_RESPITE_STEP_MS = 120_000;
/** The respite is asked while this much of its budget is left (ms - section 6.2: "asked while 30 s or more is left"). */
export const EG_RESPITE_MIN_MS = 30_000;
/** A Ready that passes ends the rest this long after its word (ms). */
export const EG_READY_MS = 3000;
/** THE SURPLUS (section 6.2): five minutes the count's cap turns away, three at most. */
export const EG_SURPLUS_MS = 300_000;
export const EG_SURPLUS_MAX = 3;
/** THE GOLD RUN (section 8.2): every living member across before the closing's fifteenth second - a minute more. */
export const EG_GOLD_RUN_MS = 60_000;
/** A Memento is carried within this of it, and set at a niche within this (m); the recall it gives (a share of health). */
export const EG_MEMENTO_REACH = 2;
export const EG_MEMENTO_PCT = 0.5;
/** The Redoubt's sequence (section 16.2): the beacon, the count's gain, the spoils, the recalls, the rest window (ms
 *  after the fall). */
export const EG_RD_RECALL_MS = 4500;
export const EG_RD_WINDOW_MS = 6000;
/** A cache is taken within this of it (m), a stood-on errand (a plate, a winch) within this. */
export const EG_TOUCH_M = 2.5;
/** AUDIT EG III (lane2 #3) - ACTIVE IN A HALL (section 16.1): this part of an even share of the hall's damage dealt, or of
 *  what the company took healed in others; this long (ms) stood in an errand's mark; the errands' stood-on objects. */
export const EG_ACTIVE_SHARE = 1 / 8;
export const EG_ERRAND_STAND_MS = 1500;
export const EG_ERRAND_MARKS = Object.freeze(['rune', 'gem', 'isle', 'umbra', 'relic', 'stone', 'engine']);
/** EG-ZB (section 11.7): a member off the fight floors this long in a fight is HUNTED by the Harriers (ms) - its mark
 *  (Hunted, net/eliteGates/egBodies.js mark 7) said this long at a time, a pair rising for the hunt where no Harrier stands; in the
 *  halls whose trial is one fight on its floor (a span's legion shadows instead, a Deepway's passages are crossed, a
 *  Scriptorium is quiet). */
export const EG_HUNT_AFTER_MS = 6000;
export const EG_HUNT_MARK_MS = 30_000;
export const EG_HUNT_RAISE = 2;
export const EG_HUNT_KINDS = Object.freeze(['yard', 'rampart', 'proving', 'athenaeum', 'court']);
/** EG-ZB (section 8.2): a span's Harriers rise this far beside a member and this far ahead of it (m); a member stands on a
 *  span's fight ground (its islands, its plates, its passages' floors) within this of it (m). */
export const EG_SHADOW_SIDE_M = 5;
export const EG_SHADOW_AHEAD_M = 6;
export const EG_SPAN_GROUND_PAD_M = 0.5;
/** EG-ZB (section 21): THE CENSUS'S VESTIGES (section 15) - Challenger's Oath: lords' blows on its holder weaker by rank;
 *  Featherstep: a cast-back's cost by rank; Immovable: still this long (ms) within this (m) on a fight floor, blows 25%
 *  less; Bastion's reach and Steadfast Line's (m), and Steadfast's three allies. */
export const EG_OATH_DR = Object.freeze([0.05, 0.10, 0.15]);
export const EG_FEATHER_CAST = Object.freeze([0.08, 0.06, 0.04]);
export const EG_IMMOVABLE_MS = 1000;
export const EG_IMMOVABLE_M = 0.2;
export const EG_IMMOVABLE_DR = 0.25;
export const EG_BASTION_M = 6;
export const EG_STEADFAST_M = 8;
export const EG_STEADFAST_N = 3;
/** EG-ZB (sections 11.2 and 12): a drain's tick (ms - the screens' own, scenes/eliteGates/egFight.js EG_TICK_MS), and how soon one
 *  soul-wisp binds a member again after it lets go (ms - its WISP_AGAIN_MS). */
export const EG_DRAIN_TICK_MS = 1000;
export const EG_WISP_AGAIN_MS = 6000;
/** EG-ZI (section 15's Lifeline, in the census - section 21): a heal said while its member stood under this share of its
 *  body; the blows it spares them for this long after (ms); a member's heal word says the heals of up to its last this
 *  long (ms - scenes/eliteGates/egClient.js EG_HEAL_SEND_MS, pinned equal: the relay's bundle does not carry the client), and a
 *  count seen low within it and a beat more stood low for the heal. */
export const EG_LIFELINE_UNDER = 0.3;
export const EG_LIFELINE_MS = 3000;
/** AUDIT EG III: a healer's heal opens a Lifeline window only when what was believed of it is at least this share of its
 *  member's reference body (net/gate/gateBrain.js healRef - the heal bucket's) - a point's heal word holds no window open; the
 *  receiver's screen asks the same of its word (scenes/eliteGates/egClient.js lifelineSaid). */
export const EG_LIFELINE_MIN = 0.05;
/** AUDIT EG III: the points a healer's heal on a member of level `lv` is believed at, at least, to open a Lifeline window. */
export const egLifelineMin = (lv) => EG_LIFELINE_MIN * healRef(clampLv(lv));
export const EG_HEAL_WORD_MS = 1000;
export const EG_LIFELINE_LOOK_MS = EG_HEAL_WORD_MS + BRAIN_TICK_MS;
/** AUDIT EG IV (lane3 #3; section 16.1, AUDIT EG0 A6): how long before a heal word a cast the room relayed from a healer to
 *  its receiver (ALLY-CAST's directed `cast` frame - the healer's own socket sent it) corroborates the word naming that
 *  healer for the earner's part (egHeal's `cast`) - the word goes each second (scenes/eliteGates/egClient.js EG_HEAL_SEND_MS) with the
 *  heals landed since, and a heal lands as its cast frame does. */
export const EG_HEAL_CAST_MS = 5000;
/** The names the gate's old frames gave (kept for the tracker's words). */
export const EG_FOE_NAMES = Object.freeze({ champion: 'The Kynreeve', lord: 'The Lord of the Court' });

const secs = (ms) => Math.max(0, Math.floor(ms / 1000));
const purseOf = (lv, now) => ({ lv, rate: GATE_HIT_HZ_MAX, rateAt: now, bucket: BUCKET_DEPTH_X * dpsRef(lv), bucketAt: now, clipped: 0, dealt: 0, bq: null, bqAt: 0, bqWho: [] });
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/**
 * A breach opened: the hub's verified open (net/wire.js validEgOpenTell) at `now`, the room's own record from here.
 * @param {ReturnType<typeof import('../wire.js').validEgOpenTell>} t
 */
export function egBreachNew(t) {
  return {
    v: 2, b: t.b, ez: t.ez, s: t.s, o: t.o, ew: t.ew, rh: t.rh, seed: t.seed >>> 0, egv: EG_SPEC, op: t.op, site: t.site,
    wg: Array.isArray(t.wg) ? t.wg.slice(0, 3) : [], pr: t.pr ?? egProclamationOf(arenaWeekOf(t.op / 1000)),
    co: t.co.map(([sub, name, n]) => ({ sub, name, n })),
    /** @type {Record<string, any>} each member admitted: its name, numeral, level, life, purse and run */
    mem: {},
    h: 0, sg: 'wait', sa: t.op, su: t.op + EG_SEALED_MS, hw: 0, dn: 0, pulledAt: 0, gatherAt: 0, cleared: 0, rdAt: 0,
    wk: 0, cnt: egCountNew(), rd: 0, end: null, endAt: 0,
    dc: [], bargainDc: [], next: null, asks: [], tide: null, strata: [],
    resp: EG_RESPITE_BUDGET_MS, sur: 0, surAcc: 0, gold: 0, covenant: 0, warned: 0,
    cache: null, mementos: [], log: [],
    /** @type {any} the hall's fight */
    F: null,
    /** @type {any[]} the receipts owed: `{ sub, claims }` - the room fills each one's seed and signs it */
    owe: [],
    /** @type {string[]} the admission orders spent (their `ez`) */
    zs: [],
    lastStateAt: 0,
  };
}
/** The breach as the clock's law reads one (net/eliteGates/egLaw.js egTimes, egPhase). */
const clockRec = (B) => ({ openedAt: B.op, wokeAt: B.wk, endAt: B.endAt, why: B.end });
/** The living, entered company (`[sub, m]`). */
const living = (B) => Object.entries(B.mem).filter(([, m]) => m.in && m.alive && !m.home);
/** AUDIT EG V (L2-2; section 15: an aura and an Accord are "while they stand together") - THE COMPANY WHERE IT STANDS: each living
 *  member by the pose the room last holds of it in THIS hall (`{sub, x, z}`) - a member gone home, a witness, or one whose last
 *  pose is an earlier hall's stands nowhere, and lends no Vestige by its place (a blow's Standard and Accords, Watchfire's). */
export const egPosedHere = (B) => living(B).filter(([, m]) => m.pose?.h === B.h).map(([sub, m]) => ({ sub, x: m.pose.x, z: m.pose.z }));
const memberName = (B, sub) => B.mem[sub]?.name ?? B.co.find((c) => c.sub === sub)?.name ?? '';
/** The circle's span decrees, folded into the specs (net/eliteGates/egLaw.js egGeoOf). */
export const egGeo = (B) => egGeoOf(egDecreesInForce(B));
/** The hall the company stands in, in its breach's own law (EG-ZC: THE LAW PIN - the law before kept). EG-ZJ: and its fight
 *  bound to its fight ground (net/eliteGates/egBodies.js egFightBind) - every word the director takes reads its hall here first, so a
 *  woken room's restored fight stands what it raises, places and walks on its ground from the first word, a beat's or a blow's. */
const specOf = (B) => { const spec = egHallOf(B.seed, B.h, egGeo(B), B.egv); if (B.F) egFightBind(B.F, egFightView(spec)); return spec; };
// ── EG-H1 (EG8d): THE FAIR TRAIL'S DOOR - bible/11-Multiplayer/Elite-Gates.md section 21 ───────────────────────────────
/** A member's fair trail is its hall's and its life's: a new hall, or a fall, begins it again. */
const fairKey = (B, m) => `${B.h}:${m.falls ?? 0}`;
/** A member's fair trail in this hall and this life, or null (none judged yet - the law judges poses, never their absence). */
const fairOfMember = (B, sub) => { const m = B.mem[sub], A = m?.fair; return A && A.k === fairKey(B, m) ? A : null; };
/** EVERY POSE-GATED CREDIT NEEDS A FAIR TRAIL from the last island (section 21): the door, `down`, a cache, THE GOLD RUN, a
 *  niche, a Memento carried, the Reliquary Vault, the High Road's cache (net/eliteGates/egFair.js egFairOk). AUDIT EG V (L3-6; section 7 -
 *  "No member is targeted or judged before their `here`"): and the member's `here` in this hall - its arrival on the plate, or
 *  its recall where it was called back - for a trail begins there: a member the room never heard arrive was never judged, and
 *  a screen that stood it first at the end plate opened a span's door on the trial's first beat. */
const fairOf = (B, sub) => B.mem[sub]?.hereH === B.h && egFairOk(fairOfMember(B, sub));
/**
 * Who opens an arrival's door (a span, a Brink, a Deepway's way down): a member at the end plate whose trail is fair. After
 * the room was woken mid-hall (`fwake` - its trails the saved ones, egFairWoke), failing that, the first arrival - its
 * measure says so (`wake`): a hall woken after every member passed the last island never deadlocks. Null: no door yet.
 */
function doorOpener(B, spec, inHall) {
  const at = inHall.filter((b) => egAtDoor(spec, b.x, b.z, b.y) && B.mem[b.sub]?.hereH === B.h);   // AUDIT EG V (L3-6): a member whose `here` the room heard
  const fair = at.find((b) => fairOf(B, b.sub));
  if (fair || !at.length) return fair ?? null;
  if (!(B.fwake > 0 && B.hw > 0 && B.hw < B.fwake)) return null;
  const A = fairOfMember(B, at[0].sub);
  if (A) A.wake = 1;
  return at[0];
}
/**
 * FIELD BUGS 2026-10-20f (DOOR-WORD; bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md, ilovemybonk: "it seemed the game doesnt
 * register i made it to the end") - A MEMBER THE DOOR WILL NOT TAKE IS TOLD WHY: standing at the door in the hall it was heard
 * arriving in, on a trail the door refuses (fairOf - broken since the last island, or crossed too much unseen), it is told
 * once a hall (`efair`, to it alone: `w` the break's own word - `speed`, `air`, `void` - else `blind`). The door, `down` and
 * every pose-gated credit refused it without a word: the member stood at the door, the objective still said *Cross.*, and
 * nothing said what was wanted.
 */
function doorWord(B, spec, inHall, out) {
  for (const b of inHall) {
    const m = B.mem[b.sub];
    if (!m || m.hereH !== B.h || m.downH === B.h || m.fairSaid === B.h || !egAtDoor(spec, b.x, b.z, b.y) || fairOf(B, b.sub)) continue;
    const A = fairOfMember(B, b.sub);
    m.fairSaid = B.h;
    out.push({ k: 'efair', w: A && A.brk > 0 && EG_FAIR_WORDS.includes(A.why) ? A.why : 'blind', to: b.sub });
  }
}
/** EG-H1: the room was woken (a new instance read the breach from storage) - after it, a hall woken before it opens its
 *  door on the first arrival when no saved trail is fair (doorOpener). */
export function egFairWoke(B, now) { if (B && !B.end) B.fwake = now; }

/** May `sub` enter breach `B` at `now` - null, or the refusal's words (net/wire.js EG_NO_WORDS). */
export function egAdmitWord(B, sub, now) {
  if (!B.co.some((c) => c.sub === sub)) return 'the breach answers only to its company';
  if (B.end) return 'the breach is closed';
  const m = B.mem[sub];
  if (m?.forsaken) return 'you have fallen';
  if (m?.home) return 'you went home';
  if (m?.in) return null;   // a reload, a witness: back into the hall it stands in
  return egAdmits(clockRec(B), now) ? null : 'the breach is closed';
}
/** A member's admission, its order verified by the room (`ez` its id): spent once; its level frozen at the first. Answers
 *  null, or the refusal's words. */
export function egEnter(B, sub, ez, lv, now) {
  const no = egAdmitWord(B, sub, now);
  if (no) return no;
  if (B.mem[sub]?.in) { B.mem[sub].seenAt = now; return null; }   // counted already (a reload, a new circle's room): nothing to spend
  if (B.zs.includes(ez)) return 'the order is spent';
  B.zs = [...B.zs, ez].slice(-64);
  const c = B.co.find((x) => x.sub === sub);
  // AUDIT EG V (L7-6; section 27.7 - the Rehearsal's "one life"): a Rehearsal's member enters with no recall - it ends at Redoubt 1,
  // before any rest could call one back, so its fall is final and the FALLEN card, the witness's line and the first-time
  // lines (which read the fall's `fin` and the company's recall) say so
  if (!B.mem[sub]) B.mem[sub] = { name: c.name, n: c.n, in: 1, lv: clampLv(lv), alive: 1, home: 0, fellAt: 0, falls: 0, recall: B.rh ? 0 : 1, wit: 0, forsaken: 0, hereH: 0, downH: 0, dh: 0, dc: 0, act: 0, seenAt: now,
    vs: [], mast: -1, shards: 0, tonics: 0, cant: [], lumen: 0, rel: [], kinds: [0, 0, 0], offer: null, picks: 0, newestV: null, bequest: null, x: 0, ...purseOf(clampLv(lv), now) };
  else B.mem[sub].seenAt = now;
  return null;
}

/** The count's word: what was left when it last began to run (`cl`, whole ms) and that instant (`ca`; 0 while it holds -
 *  `cl` is then what is left) - every screen counts it down from there (net/eliteGates/egLink.js egCountAt). */
const countWord = (B, now) => ({ cl: Math.round(B.cnt.at > 0 ? B.cnt.left : egCountLeft(B.cnt, now)), ca: B.cnt.at });
/**
 * EG-PERFECT (2026-10-18; Elite-Gates.md section 11.3): THE INSTANT THE COMPANY REACHED A ROUTED HALL'S COLLAPSING TUBE this wake
 * (relay ms - the first fair pose within net/eliteGates/egFair.js EG_TUBE_MOUTH_M of its mouth, egPoseIn), or 0: its fall runs from
 * there (net/eliteGates/egFair.js egTubeEdgeIn - LAW 9 stood its mouth 34-82 s of walking from the plate, past the 18 s the wake
 * gave it). Kept on the record as `tm: { hw, at, said }` - the wake it belongs to, so a hall woken again (a pull, a rest, a
 * new circle) starts its tube afresh with nothing to reset, and whether the stage has said it.
 */
export const egTubeMouthOf = (B) => (B.tm && B.hw > 0 && B.tm.hw === B.hw ? B.tm.at : 0);
/** The stage's word (`sg`). EG-PERFECT: with `tm`, the instant the company reached a routed hall's tube (egTubeMouthOf),
 *  once there is one - every screen starts the tube's fall from it, as the relay's judge does. */
export const egStageWord = (B, now) => { const tm = egTubeMouthOf(B); return { k: 'sg', h: B.h, sg: B.sg, sa: B.sa, su: B.su, ...countWord(B, now), hw: B.hw, dn: B.dn, ...(tm ? { tm } : {}) }; };
/** EG-PERFECT: the stage says the company's arrival at a routed hall's Collapsing Tube the beat after the room recorded it
 *  (egPoseIn - `said` 0), once a wake: every screen's tube falls from it (scenes/eliteGates/egSpan.js tubeEdgeOf). */
function tubeSaid(B, now, out) {
  if (!B.tm || B.tm.said || !egTubeMouthOf(B)) return;
  B.tm.said = 1;
  out.push(egStageWord(B, now));
}
/** The company as the room says it: `[sub, name, numeral, alive, home, in, witness, forsaken, falls, recall, here]`. AUDIT EG V
 *  (c, L3-10; section 7 - "a ring fills over the plate, *3 of 6 here*"): `here` 1 once the member has said `here` in the hall
 *  the company stands in (its pose on the arrival plate - `hereH`), so every screen counts the gather the room counts. */
export const egCompanyOf = (B) => B.co.map((c) => { const m = B.mem[c.sub]; return [c.sub, c.name, c.n, m ? m.alive : 1, m?.home ? 1 : 0, m?.in ? 1 : 0, m?.wit ? 1 : 0, m?.forsaken ? 1 : 0, m?.falls ?? 0, m ? m.recall : B.rh ? 0 : 1, m && B.h > 0 && m.hereH === B.h ? 1 : 0]; });
/** AUDIT EG V (L2-11; section 14: "At each Redoubt the next circle's decrees are chosen and shown on the beacon") - THE NEXT
 *  CIRCLE'S DECREES as the rest's beacon names them (`[[id, rank], ...]`): those the company's word chose for it (asksStep), in a
 *  rest whose next circle they are; none before the word closes, and none outside a rest. Every screen words them with the
 *  next Court's lord, the law's (ui/eliteGates/egHud.js egNextCircleText). */
export const egNextOf = (B) => (B.sg === 'rest' && B.next?.c === egCircleOfHall(B.h) + 1 ? (B.next.dc ?? []).map((p) => [...p]) : []);
/** The breach's whole state (`st`): the stage, the company, the decrees in force (and the Proclamation, the Wager, the
 *  tide, the strata), each member's run, the cache's kind, the Mementos lying, the respite and the Surplus. */
export function egStateOf(B, now) {
  const spec = B.h > 0 ? specOf(B) : null;
  return { ...egStageWord(B, now), k: 'st', b: B.b, seed: B.seed, egv: B.egv, op: B.op, wk: B.wk, co: egCompanyOf(B), rd: B.rd, rh: B.rh,
    dg: spec ? egSpecDigest(spec) : 0, end: B.end,
    dc: egDecreesInForce(B), pr: B.pr ?? '', wg: [...(B.wg ?? [])], td: B.tide ?? '', sr: [...(B.strata ?? [])], geo: egGeo(B),
    ms: Object.entries(B.mem).filter(([, m]) => m.in).map(([sub, m]) => egRunOf(sub, m)),
    ca2: B.cache ? B.cache.k : '', mm: B.mementos.map((q) => [q.s, q.h, Math.round(q.x * 100) / 100, Math.round(q.z * 100) / 100, q.by ?? '']),
    rp: Math.round(B.resp), sp: B.sur, as: (B.asks ?? []).map((a) => [a.q, [...a.o], a.until]),
    nx: egNextOf(B),   // AUDIT EG V (L2-11; sections 14 and 16.3): the beacon's word - the next circle's decrees, as the company chose them
    ds: egTalliesOf(B),   // EG-ZF (section 27.6): each member's damage and healing over the breach - the recap's share and healing
    ...(B.site ? { site: B.site } : {}) };   // EG-F (section 6.3): the arch's site, the room's to keep - the cast-out's landing with the arch gone
}
/** The hall's fight's whole word (`efs`), or null when it holds none. */
export function egFightStateOf(B, now = Date.now()) { return B.F ? EG_SEAM.stateOf(egLordsFight(B.F, null, {}, now)) : null; }   // EG-ZK: the seam's state

/** A member's body in the hall's own frame, or null when it stands in no part of hall `spec` - EG-ZB: its feet's height
 *  `y` with it where the pose said one (the fight floor a body stands on is read by it - section 11.7). */
const local = (spec, b) => (b && egInHall(spec, b.sx, b.z) ? { sub: b.sub, x: egLocalX(spec, b.sx), z: b.z, ...(Number.isFinite(b.y) ? { y: b.y } : {}) } : null);

/** A receipt owed - its seed the room's own draw. */
function owe(B, sub, claims) { B.owe.push({ sub, claims: { b: B.b, s: sub, z: B.ez, ...claims } }); }
/** EG-ZA: THE COMPANY a receipt carries (`co` - net/eliteGates/egReceipt.js egCompanyTag): the breach's entrants, in no order (the
 *  opener alone when none entered). */
const companyOf = (B) => { const E = entrants(B).map(([sub]) => sub); return egCompanyTag(E.length ? E : [B.s]); };
/** A member's end receipt (`x`), once: why it ended, the deepest hall cleared, the Reliquaries it opens (a good end), its
 *  falls. AUDIT EG III (lane3 #6): `nr` when the BREACH is over with no Redoubt taken - an end its end owes, or the end of
 *  the last member living (nobody left to take one) - the word the first breach's mercy waits for. */
function oweEnd(B, sub, why, now) {
  const m = B.mem[sub];
  if (m?.x) return;
  if (m) m.x = 1;
  const good = EG_OPEN_ENDS.includes(why);
  owe(B, sub, { q: 'x', h: B.cleared, t: B.wk ? secs(now - B.wk) : 0, n: Object.values(B.mem).filter((x) => x.in).length, ew: B.ew, l: m?.lv ?? 1, why,
    ...(good && m?.rel?.length ? { rl: m.rel.slice(0, 64) } : {}), fl: m?.falls ?? 0, ...(B.rh ? { rh: 1 } : {}),
    // EG-E3: the Wager (the boards rank a wagered breach on the Depths alone) and the Annals' pages the breach gave
    ...(B.wg?.length ? { wg: [...B.wg] } : {}), ...(m?.pages ? { an: m.pages } : {}),
    // EG-ZA (section 23's table): the seconds from Hall 1's wake to the deepest hall's door, once one is cleared (the
    // Descent's second key - section 20), and the company
    ...(B.cleared > 0 ? { td: B.td ?? 0 } : {}), co: companyOf(B), ...(!(B.rd > 0) && !B.rh && (B.end || !living(B).length) ? { nr: 1 } : {}) });
}
/**
 * EG-ZA: A MEMBER'S FAIR TRAIL FOLDED INTO ITS CIRCLE'S MEASURES (`m.mz` - a Redoubt's `m`, section 21: "its measures ride
 * the receipt"), once a trail: `[crossings, the quickest crossing as a share of its bound (%, 0 none), the most blind
 * share (%), breaks, the fastest stretch (cm/s), crossings whose door was the room's wake's]` - net/eliteGates/egFair.js
 * egFairMeasure's six, over the circle. A trail that judged nothing folds nothing.
 * @param {any} m @param {any} A
 */
function measureFold(m, A) {
  if (!m || !A || A.mzd || !(A.span > 0)) return;
  A.mzd = 1;
  const z = (m.mz ??= new Array(EG_MEASURES).fill(0));
  if (A.cross > 0) {
    z[0]++;
    if (A.cmin > 0) { const pct = Math.round((100 * A.cross) / A.cmin); z[1] = z[1] > 0 ? Math.min(z[1], pct) : pct; }
    if (A.wake) z[5]++;
  }
  z[2] = Math.max(z[2], Math.round(100 * (A.cross > 0 ? A.cblind : A.blind / A.span)));
  z[3] += A.brks; z[4] = Math.max(z[4], A.fast);
}
/** EG-ZA: a member's circle's measures as its Redoubt's receipt carries them (each held to EG_MEASURE_MAX), begun again. */
function measuresOut(m) {
  const z = (m.mz ?? new Array(EG_MEASURES).fill(0)).map((n) => Math.max(0, Math.min(EG_MEASURE_MAX, Math.round(n))));
  m.mz = null;
  return z;
}
/** EG-E3: a hall cleared (the door, or a Court's fall) - the deepest the breach holds, and its seconds from Hall 1's wake
 *  (`td`, the Descent's second key - section 20). */
function clearHall(B, now) {
  if (B.h <= B.cleared) return;
  B.cleared = B.h;
  B.td = B.wk ? secs(now - B.wk) : 0;
}
/** EG-E3: THE HERALD'S NEWS (net/eliteGates/egHerald.js) - kept on the breach, numbered, for the room to tell the hub, which decides
 *  what the channel hears; the oldest let go past EG_HERALD_TELL_MAX. */
function heraldOwe(B, now, ev) {
  B.hn = (B.hn ?? 0) + 1;
  B.hq = [...(B.hq ?? []), { i: B.hn, at: now, ...ev }].slice(-EG_HERALD_TELL_MAX);
}
/** The company's entrants, in its order: `[sub, m]`. */
const entrants = (B) => B.co.map((c) => [c.sub, B.mem[c.sub]]).filter(([, m]) => m?.in);
/** FIELD BUGS 2026-10-20d LONE-HERALD: the company a Redoubt's news names - its entrants (`n`, the Descent's count, section 20)
 *  and the name its post leads with (`o`): the opener's where the opener entered, else the first entrant's - an opener who never
 *  stepped in (AUDIT EG IV lane3 #11) is not of the company that went, alone or not (AUDIT FB1020d L1-1). */
const heraldCompany = (B) => { const E = entrants(B), opener = E.some(([sub]) => sub === B.s); return { n: E.length, o: opener || !E.length ? B.o ?? '' : E[0][1].name ?? '' }; };

/**
 * A MEMBER FALLS (section 16.5): a death, or EG_ABSENT_TRIAL_MS gone in a trial. Their Reliquaries are lost; they become a
 * witness; with their recall still in hand a Memento lies where they fell; with none (or a second fall), the fall is
 * final and their end receipt is owed. Said to all.
 */
export function egFall(B, sub, now, out, at = null) {
  const m = B.mem[sub];
  if (!m || (!m.alive && !m.down) || m.home || B.end) return;
  if (m.down && !at && m.downAt?.h === B.h) at = { x: m.downAt.x, z: m.downAt.z };   // RAISE BEFORE THE FALL: where it lay
  m.down = 0;
  m.alive = 0; m.fellAt = now; m.falls = (m.falls ?? 0) + 1; m.wit = 1; m.rel = [];
  const final = !(m.recall > 0) || m.falls >= 2;
  // AUDIT EG V (L3-15; section 16.5 - "Solo stays literally one life"): a fall that leaves nobody living is the breach's wipe -
  // nobody can recall the fallen nor carry a Memento, so its word says it is final (its receipt the wipe's, as before)
  const last = !living(B).length;
  // AUDIT EG V (L3-22; section 16.5 - "A fall leaves a gold mote where the member fell"): a fall the word names no place of (180 s
  // absent, a `fell` with no pose, the count's fall off another hall's trail) lies at the member's last pose in this hall
  const where = at ?? (m.pose && m.pose.h === B.h ? m.pose : null);
  if (final) oweEnd(B, sub, 'fall', now);
  else if (where && !last) B.mementos.push({ s: sub, h: B.h, x: where.x, z: where.z, by: null });
  // a carrier's fall drops the Memento where they fall
  for (const q of B.mementos) if (q.by === sub) { q.by = null; if (at) { q.x = at.x; q.z = at.z; q.h = B.h; } }
  if (B.F) B.F.fellThisHall = (B.F.fellThisHall ?? 0) + 1;
  if (B.F) EG_SEAM.join(egLordsFight(B.F, null, {}, now), sub, m.name, m.lv, now, null, { admits: false });   // EG-ZQ (section 13.2): a fall told every lord standing, through the seam - FIELD BUGS 2026-10-19e LORD-SHARES: a lord awake keeps its share, one asleep lets it go
  egTallyFall(B.F, sub);   // EG-ZF: on a Court's chart
  B.log.push({ h: B.h, fall: m.name });
  out.push({ k: 'fall', s: sub, n: m.name, at: now, fin: final || last ? 1 : 0 }, { k: 'co', co: egCompanyOf(B) });
}
/**
 * AUDIT WORLD-EVENTS L1-4 - RAISE BEFORE THE FALL (the owner, asked what Resurrect means in the Spire: "Raise before the
 * fall"; bible/11-Multiplayer/Elite-Gates.md section 24): a death in a hall's fight lays the member DOWN where it fell for
 * EG_DOWN_MS - out of the fight (no longer living: its `alive` 0, no word of it heard but its giving up), its Reliquaries
 * still its own, its company told (`down`) - for a party member's Resurrect at the body (egRezMember). Past the window, given
 * up (`yield`), the hall cleared (the Redoubt's recall is the fall's), or with nobody living left to raise it, THE FALL
 * (egFall) as ever. A death with no hall's fight about it (a rest, the stair), or that names no place, falls at once.
 */
export const EG_DOWN_MS = 60_000;
/** How near where a member lies its raiser stands (m) - RESURRECT's touch (systems/resurrect.js RESURRECT_REACH, 6 m), a
 *  pose's lag with it; and the health the raised stands at (systems/resurrect.js RESURRECT_HEALTH_PCT - pinned equal). */
export const EG_REZ_REACH_M = 10;
export const EG_REZ_PCT = 0.3;
export function egLayDown(B, sub, now, out, at = null) {
  const m = B.mem[sub];
  if (!m || !m.alive || m.home || B.end) return;
  const where = at ?? (m.pose && m.pose.h === B.h ? m.pose : null);
  if ((B.sg !== 'trial' && B.sg !== 'closing') || !where || !living(B).some(([s]) => s !== sub)) { egFall(B, sub, now, out, at); return; }
  m.alive = 0; m.down = now; m.downAt = { h: B.h, x: where.x, z: where.z };
  out.push({ k: 'down', s: sub, n: m.name, until: now + EG_DOWN_MS }, { k: 'co', co: egCompanyOf(B) });
}
/** A party member's Resurrect at a member lying down (`rz` - systems/resurrect.js's spell, said by the caster's page): the
 *  caster living in the breach and within EG_REZ_REACH_M of where the body lies (its own pose, `at`, the hall's frame),
 *  inside the window - the member stands there at EG_REZ_PCT of its health, a new life on the count. Answers whether it
 *  rose. */
export function egRezMember(B, sub, to, now, out, at = null) {
  const c = B.mem[sub], m = B.mem[to];
  if (!c || !c.in || !c.alive || c.home || !m || !m.down || m.home || B.end || now - m.down >= EG_DOWN_MS || sub === to) return false;
  if (!at || m.downAt?.h !== B.h || Math.hypot(at.x - m.downAt.x, at.z - m.downAt.z) > EG_REZ_REACH_M) return false;
  m.alive = 1; m.down = 0; m.seenAt = now; m.hereH = B.h; delete m.bd;   // the count's body begun again: the page says its share at its next word
  out.push({ k: 'rise', to, s: to, p: EG_REZ_PCT, x: m.downAt.x, z: m.downAt.z, h: B.h, by: c.name }, { k: 'co', co: egCompanyOf(B) }, { k: 'esay', w: 'rezzed', n: m.name, t: c.name });
  return true;
}
/** A witness forsakes the breach (section 16.5): their recall forfeit, their end receipt owed. */
export function egForsake(B, sub, now, out) {
  const m = B.mem[sub];
  if (m?.down) egFall(B, sub, now, out, null);   // AUDIT WORLD-EVENTS L1-4: one lying down falls first
  if (!m || m.alive || m.forsaken || B.end) return false;
  m.forsaken = 1; m.recall = 0;
  B.mementos = B.mementos.filter((q) => q.s !== sub);
  oweEnd(B, sub, 'forsake', now);
  out.push({ k: 'co', co: egCompanyOf(B) });
  return true;
}
/** A fallen member called back (THE RECALL): alive at `pct` of their health, their newest Vestige lost, their recall
 *  spent. Said to all, and to them (`rise`, where to stand). */
function recall(B, sub, pct, at, now, out) {
  const m = B.mem[sub];
  if (!m || m.alive || m.down || m.forsaken || !(m.recall > 0)) return false;   // AUDIT WORLD-EVENTS L1-4: never one lying down - it is raised, or falls
  m.alive = 1; m.wit = 0; m.recall = 0; m.seenAt = now; m.roseH = B.h; m.hereH = B.h;   // EG-H1: its fair trail begins where it is called back - AUDIT EG V (L3-6): its `here`
  egLoseNewest(m);
  B.mementos = B.mementos.filter((q) => q.s !== sub);
  out.push({ k: 'rise', to: sub, s: sub, p: pct, x: at[0], z: at[1], h: B.h }, { k: 'co', co: egCompanyOf(B) }, { k: 'esay', w: 'recalled', n: m.name });
  return true;
}
/** A member takes the way home at a Redoubt's rest: their Reliquaries opened, their end receipt owed. Answers whether
 *  it went. */
export function egHome(B, sub, now, out) {
  const m = B.mem[sub];
  if (!m || !m.alive || m.home || B.end || B.sg !== 'rest' || now < B.rdAt + EG_RD_WINDOW_MS) return false;
  m.home = now;
  oweEnd(B, sub, 'home', now);
  out.push({ k: 'co', co: egCompanyOf(B) }, { k: 'esay', w: 'home', n: m.name });
  return true;
}
/** THE END (section 22): every member still in it owed its end, said to all. EG-ZA ("A key's loss"): an end with no hall
 *  ever woken is a void - never the opener's 'empty', unless the room was told its call went out (`B.called`) and nobody
 *  answered - and an opener who never entered a voided breach is owed the void itself (`v`, its stake back). */
export function egEnd(B, why, now, out) {
  if (B.end) return;
  if (!(B.wk > 0) && !(why === 'empty' && B.called)) why = 'void';
  B.end = why; B.endAt = now; B.sg = 'end'; B.sa = now; B.su = 0;
  B.cnt = egCountHold(B.cnt, now);
  const dm = B.F && egLordsFell(B.F) ? egChartOf(B) : [];   // EG-ZF: an end at a lord's fall (a Rehearsal's) says its chart
  if (B.F) egGone(B.F, egBodiesOf(B.F, EG_ROLE.add), EG_GONE.crumbled, '', now, out);
  B.F = null;
  B.asks = [];
  for (const [sub, m] of Object.entries(B.mem)) if (m.in && !m.home && !m.x && (m.alive || !m.forsaken)) oweEnd(B, sub, m.alive ? why : (why === 'home' ? 'fall' : why), now);
  if (why === 'empty' && !B.mem[B.s]) oweEnd(B, B.s, 'empty', now);   // the opener's stake settles even when nobody came
  if (why === 'void' && !B.mem[B.s]?.in) owe(B, B.s, { q: 'v' });   // EG-ZA: and a voided breach's opener who never entered has the stake straight back
  // EG-E3: THE DESCENT'S CANDIDATE (section 20) - a breach begun at Hall 1, unwagered and no Rehearsal, told the herald:
  // the hub keeps the season's best a bracket, and says a new top
  if (!B.rh && !B.ew && !(B.wg ?? []).length && B.cleared > 0) {
    const E = entrants(B);
    heraldOwe(B, now, { k: 'dc', h: B.cleared, td: B.td ?? 0, n: E.length, o: B.o ?? '', by: E.map(([, m]) => m.name ?? '') });
  }
  out.push({ k: 'end', why, at: now, ds: egTalliesOf(B), ...(dm.length ? { dm } : {}) }, egStageWord(B, now));   // EG-ZF (section 27.6): the recap's numbers
}

// ── a hall's wake: its fight stood ──────────────────────────────────────────────────────────────────────────
/** The hall woken: the trial begins, the count runs (from thirty minutes at the breach's first wake), its fight stood. */
function wake(B, now, rng, out) {
  const spec = specOf(B);
  B.sg = 'trial'; B.sa = now; B.su = 0; B.hw = now; B.dn = 0; B.gatherAt = 0; B.gold = 0;
  const first = !B.wk;
  if (!B.wk) { B.wk = now; B.cnt = { left: egCountNew().left, at: now }; } else B.cnt = egCountRun(B.cnt, now);
  // AUDIT EG IV (lane3 #11; section 23): THE OPENER WHO NEVER STEPPED IN - the first wake closes the door to them (egAdmits),
  // so their end is owed now ('empty', nothing cleared): their stake settles by it (the first breach's mercy may hold it, as
  // any end of the opener's) and their `eg_live` clears, never held three hours by a breach their company plays without them
  if (first && !B.mem[B.s]?.in) oweEnd(B, B.s, 'empty', now);
  for (const [, m] of living(B)) { m.downH = 0; m.dh = 0; m.late = m.hereH === B.h ? 0 : (m.late ?? 0) + 1; }   // EG-ZI (section 7): THE LATE WAKE - a hall woken before its `here` counted, one in time begins the count again
  B.cache = spec.end && spec.kind !== 'brink' ? egCacheDraw(rng, spec.twist === 'mimic') : null;
  B.F = standFight(B, spec, now, rng, out);
  if (B.F && egTrialAwaits(spec)) B.F.await = now;   // EG-PERFECT (spec law 10): its clocks held until its company stands on its floor
  egTallyWake(B.F, spec.kind);   // EG-ZF: a Court lays its damage chart
  out.push(egStageWord(B, now), egStateOf(B, now));
  if (B.F) out.push(EG_SEAM.stateOf(egLordsFight(B.F, spec, {}, now)));
}
/** EG-PERFECT - THE BROKEN WAY (spec law 10, 2026-10-18): A FIGHT HALL'S TRIAL AWAITS ITS COMPANY. From spec law 10 a Rift-Yard's
 *  and an Athenaeum's rooms all stand before their trial (net/eliteGates/egAscent.js - the way climbs to it, its door after it), and a
 *  Deepway's chamber may stand past rooms of its own: its rifts poured their waves, its Orrery its locks, its decrees their
 *  sparks and packs from the wake on the arrival plate - 200 m and more of the way before anyone stood on its floor. Its clocks
 *  (EG_AWAIT_CLOCKS) are held, each beat, until the first member stands on its fight ground (`here`); every other beat of the
 *  hall (its Lurkers, Kyn's Vigil at the plate, the fragments' hazards) keeps its own time. */
export const EG_AWAIT_CLOCKS = Object.freeze(['waveAt', 'packAt', 'wanderAt', 'escortAt', 'ashAt', 'sparkAt', 'ventAt', 'quietUntil']);
/** Does hall `spec`'s trial await its company (EG_AWAIT_CLOCKS - spec law 10's Rift-Yard, Athenaeum and Deepway; THE AUDIT: and
 *  its Scriptorium, whose quiet ran from the wake while its company still climbed its rooms - pulled before THE SPAN BUILD
 *  reached its door)? Pure. */
export const egTrialAwaits = (/** @type {any} */ spec) => egLawOf(spec) >= EG_BROKEN_LAW && ['yard', 'athenaeum', 'deepway', 'scriptorium'].includes(spec?.kind);
/** Does body `b` (the hall's frame, its feet) stand on hall `spec`'s trial's own ground - its way's first course that is no broken
 *  bridge (a Scriptorium's, which lays no fight floor)? Pure. */
export const egOnTrialGround = (/** @type {any} */ spec, /** @type {{x: number, y: number, z: number}} */ b) => {
  const g = spec?.route?.courses?.find((/** @type {any} */ q) => !q.b);
  return !!g && b.x >= g.x0 - 1 && b.x <= g.x1 + 1 && b.z >= g.z0 - 1 && b.z <= g.z1 + 1 && (!Number.isFinite(b.y) || (b.y >= g.y0 - 1 && b.y <= g.y1 + 3));   // (feet with no height said: in plan)
};
/** AUDIT EG IV (lane2 #3; section 18's strata): THE TWIN COURT's second lords - one of each band, the one drawn never of the
 *  Court's own lord's band; each lord of a pair stands at EG_PAIR_HP of its health. THE MASTERS' GROUND (THE OLD MASTERS with a
 *  master the Court's own lord - both masters standing): the Last Lesson stops at EG_MASTERS_LESSON_R and the Examination's runes
 *  stand on a ring of EG_MASTERS_RUNE_R, inside it (net/eliteGates/egLords.js reads `F.mem.lessonMin`, `F.mem.runeR`), the havens on
 *  their r 13 - so neither master's errand stands in the other's burning ground. */
export const EG_TWIN_COURT_LORDS = Object.freeze(['hound', 'cairnkeeper', 'dusk', 'colossus']);
export const EG_PAIR_HP = 0.6;
export const EG_MASTERS_LESSON_R = 17;
export const EG_MASTERS_RUNE_R = 16;
/**
 * AUDIT EG IV (lane2 #3, lane1 #14; section 18) - A COURT'S SECOND LORD under the strata `strata` held, for the Court of lord
 * `key` at circle `c`: THE OLD MASTERS - a master beside every Court's lord (the Last Spellmaster at an odd circle, the Last
 * Armsmaster at an even one), the other master beside a master; else THE TWIN COURT - a lord of another band than the Court's
 * own (EG_TWIN_COURT_LORDS, turning with the circle), never the lord itself. Null with neither held. Pure.
 * @param {string[]|null|undefined} strata @param {string} key @param {number} c
 */
export function egStrataSecond(strata, key, c) {
  const S = strata ?? [];
  if (S.includes('oldmasters')) return key === 'spellmaster' ? 'armsmaster' : key === 'armsmaster' ? 'spellmaster' : c % 2 ? 'spellmaster' : 'armsmaster';
  if (!S.includes('twincourt')) return null;
  const band = EG_LORDS[key]?.band ?? -1, open = EG_TWIN_COURT_LORDS.filter((k) => k !== key && EG_LORDS[k]?.band !== band);
  return open[((c % open.length) + open.length) % open.length] ?? null;
}
/** A Proving Walk's champion's escort (section 8.5: `1 + ceil(n/3)` adds of its band, egEscortOf) about its spot - at the wake,
 *  or AUDIT EG V (L2-6) EG_STILL_MS later under Stillness. */
function provingEscort(F, spec, rng, now, out) {
  const k = egEscortOf(F.n);
  egLegionRaise(F, egWaveKinds(F, rng, k), ringSpots(spec, spec.foe.x, spec.foe.z, 5, k, rng, spec.foe.y), now, out, { wave: 1 });
}
/** AUDIT EG V (h; sections 8.7 and 17.2) - A KYNVAL SQUAD'S TWIST STOOD, one law for a Rift-Yard's and a Rampart's: its four
 *  elites at `spots` (net/eliteGates/egLegion.js egSquad - a mechanic's body, whole whatever the room), the hall's first wave held
 *  EG_SQUAD_HOLD_MS and Stillness's `still` past it. The Rift-Yard's held no Stillness: spent at its wake, it bought nothing. */
function squadTwist(F, spots, now, still, out) {
  egSquad(F, spots, now, out);
  F.waveAt = now + EG_SQUAD_HOLD_MS + still;
}
/** A wave's spots about (x, z), `r` out, kept to the fight floor. THE ASCENT (Elite-Gates-Ascent.md section 2): `y` the floor
 *  they are raised about - in a hall that judges by height, kept to its storey, each spot its floor's height with it. */
function ringSpots(spec, x, z, r, k, rng, y = NaN) {
  const out = [];
  for (let i = 0; i < k; i++) { const a = (i / Math.max(1, k)) * Math.PI * 2 + rng(); out.push(egKeepOnFight(spec, x + Math.sin(a) * r, z + Math.cos(a) * r, 1, y)); }
  return out;
}
/**
 * EG-PERFECT - A CHAMBER'S CASTER STANDS (section 11.4: "a second fight floor 3-4 m up, on two stairs, where Casters stand";
 * section 11.7: "Casters stand at `anchors.caster` (raised where the chamber has a second floor)" - net/eliteGates/egFragLaw.js lays
 * a kit chamber's on its balconies, a hero's records name theirs on its galleries, and the relay read none): `[x, z, y, ov, box]`
 * for each caster anchor the law laid on a chamber (`spots.caster` whose fragment is one - a passage's stand on its own floor, no
 * second one) - its raised floor's height (net/eliteGates/egWalkGraph.js egFeetAt: the floor in the band of the height its spot
 * names, else the lowest under it - a kit chamber's spot names its chamber's floor and its balcony stands 2.5-4 m over it), the
 * height its spot names (`ov` - the floor a kit balcony overlooks; NaN in a hall that judges in plan alone), and its chamber's
 * reach (`box`, `[x0, y0, z0, x1, y1, z1]` - a hero's own box, else the kit chamber's court and its balconies about it, 1 m
 * under its floor to 5 m over): a Caster takes the stand only when it rises in that chamber (net/eliteGates/egLegion.js
 * egStandFree), never one a Vigil raises on the arrival plate. The same bodies the waves raise. Pure.
 * @param {any} spec
 */
export function egCasterStands(spec) {
  const view = egFightView(spec), out = [], pad = (EG_BALCONY_OUT_CM + EG_BALCONY_R_CM) / 100;
  for (const q of spec?.spots?.caster ?? []) {
    const f = spec.frags?.[q.f];
    if (f?.cls !== 'chamber') continue;
    const ov = spotY(spec, q), y = egFeetAt(view, q.x, q.z, ov), R = (f.z1 - f.z0) / 2, fy = f.y ?? 0;
    const H = (spec.heroes ?? []).find((g) => q.x >= g.box[0] && q.x <= g.box[3] && q.z >= g.box[2] && q.z <= g.box[5] && y >= g.box[1] - EG_GROUND_UNDER_M && y <= g.box[4]);
    const box = H ? [H.box[0], H.box[1] - 1, H.box[2], H.box[3], H.box[4], H.box[5]] : [f.x - R - pad, fy - 1, f.z0 - pad, f.x + R + pad, fy + 5, f.z1 + pad];
    out.push([q.x, q.z, y, ov, box]);
  }
  return out;
}
/** EG-PERFECT: a fight piece's heart and reach - a disc's own; a polygon's box's middle and half its narrower side; a lane's
 *  middle and half its width. */
const pieceDisc = (f) => {
  if (f.t === 'd') return { x: f.x, z: f.z, r: f.r };
  if (f.t === 'l') return { x: (f.ax + f.bx) / 2, z: (f.az + f.bz) / 2, r: f.hw };
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [px, pz] of f.poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.min(x1 - x0, z1 - z0) / 2 };
};
/** EG-PERFECT: a polygon piece's box's area (m^2) - the widest of a hero chamber's fight floors is its court. */
const boxArea = (f) => { const xs = f.poly.map((p) => p[0]), zs = f.poly.map((p) => p[1]); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)); };
/** THE ASCENT (section 2): a law spot's floor height (its `y`, the law's centimetres) where hall `spec` judges by height; else
 *  not known (NaN - a body stood there stands on the fight ground under it, as before). */
const spotY = (spec, q) => (egByHeight(spec) && Number.isFinite(q?.y) ? q.y / 100 : NaN);
/**
 * A HALL'S FIGHT stood at its wake, sized by its living company and its depth, by its kind, its variant and its twist
 * (section 8): the rifts, the anchors and the great rift, the standard and its rally points, the relic, the wandering
 * rifts; the Rampart's gate and march, its casters' pillars, its winch, its Gauntlet; the Athenaeum's Orrery; the
 * champion; the Deepway's chamber; the Scriptorium's quiet; the Court's lord asleep in its ring - and the twist's own.
 */
function standFight(B, spec, now, rng, out) {
  const L = living(B), lvs = L.map(([, m]) => m.lv), subs = L.map(([sub]) => sub);   // EG-ZQ: the company by account, each lord's fighters
  // AUDIT EG V (L2-6; section 17.2): STILLNESS spent by the first hall that pours a wave of its own (egStillHolds), its first
  // wave EG_STILL_MS late whatever sets it - the kind's own first below, a Court's at its ring's wake (trial)
  const still = B.still && egStillHolds(spec) ? EG_STILL_MS : 0;
  if (still) B.still = 0;
  if (spec.kind === 'span' || spec.kind === 'brink') {
    const F = egFightNew(spec, now, lvs, subs);
    F.D = egDecreeRanks(B);
    if ((B.strata ?? []).includes('mingled')) F.mingled = 1;   // AUDIT EG IV (section 18): THE MINGLED LEGION's waves (net/eliteGates/egLegion.js egWaveKinds)
    // EG-ZB (section 8.2): a span's legion - its first shadows 4 s after the wake (Stillness: 14 s), Hunting Pack's on its own clock
    if (spec.kind === 'span') { F.waveAt = now + 4000 + still; F.packAt = now + 30_000; }
    spanTwist(B, F, spec, now, out); fragStand(B, F, spec, now, out);
    return F;
  }
  const F = egFightNew(spec, now, lvs, subs);
  F.D = egDecreeRanks(B);
  if ((B.strata ?? []).includes('mingled')) F.mingled = 1;   // AUDIT EG IV (section 18): THE MINGLED LEGION's waves (net/eliteGates/egLegion.js egWaveKinds)
  const n = F.n, P = F.pg;
  F.waveAt = now + 4000 + still;
  F.still = still;
  F.stands = egCasterStands(spec);   // EG-PERFECT (section 11.7): a chamber's Casters on its raised anchors
  const v = spec.variant;
  if (spec.kind === 'yard') {
    if (v === 'wellspring') {
      const g = spec.rifts[0];
      const spring = egRaiseObj(F, 'rift', g.x, g.z, egHpTeam(F, EG_SPRING_S), now, out, { r: 2.2, great: 1 });
      egSetFl(F, spring, EG_FL.ward, true, out);
      for (const a of spec.spots.anchor ?? []) egRaiseObj(F, 'anchor', a.x, a.z, egHpTeam(F, EG_ANCHOR_S), now, out, { r: 0.9, y: spotY(spec, a) });
      P.obj = 'wellspring';
    } else if (v === 'muster') {
      const pts = (spec.spots.rally ?? []).map((q) => [q.x, q.z]);
      F.rally = pts;
      const [s] = egLegionRaise(F, [EG_KIND.standard], [pts[0] ?? [spec.fight.x, spec.fight.z]], now, out, { hpX: 1 });
      if (s) { s.hp = s.max = egHpTeam(F, EG_STANDARD_S); }
      P.obj = 'muster';
    } else if (v === 'holdfast') {
      const r = spec.spots.relic?.[0];
      if (r) egRaiseObj(F, 'relic', r.x, r.z, 0, now, out, { r: r.r ?? 6, y: spotY(spec, r) });
      F.relic = EG_RELIC_MAX; F.holdMs = 0; F.holdNeed = EG_HOLD_MS;
      F.riftSpots = spec.rifts.slice(0, 3);
      for (const q of F.riftSpots) { const o = egRaiseObj(F, 'rift', q.x, q.z, 1, now, out, { r: 1.3 }); egSetFl(F, o, EG_FL.ward, true, out); }
      P.obj = 'holdfast'; P.hold = 0; P.relic = EG_RELIC_MAX;
    } else {
      const k = Math.min(egRiftsFor(n), spec.rifts.length);
      for (const q of spec.rifts.slice(0, k)) egRaiseObj(F, 'rift', q.x, q.z, egHpTeam(F, EG_RIFT_TEAM_S, k), now, out, { r: 1.3 });
      if (v === 'wellmouth') { F.wander = 1; F.wanderAt = now + 20_000; }
      P.obj = 'rifts';
    }
    if (spec.twist === 'deserter') { egLegionRaise(F, [EG_KIND.deserter], [egKeepOnFight(spec, spec.fight.x, spec.fight.z - spec.fight.r + 3, 1)], now, out); F.desClosed = 0; F.coClosed = 0; }   // EG-PERFECT: on the court, a metre in - `r` the bounding disc's, half its box's diagonal, and its spot 7-14 m past the court's rim
    // AUDIT EG V (L3-4; section 8.7 - a Kynval Squad "in place of a wave", on a Rift-Yard or a Rampart): its four elites about the
    // yard's heart on its floor, the rifts' first wave held as the Rampart's march is
    if (spec.twist === 'squad') squadTwist(F, ringSpots(spec, spec.fight.x, spec.fight.z, EG_SQUAD_RING_M, 4, () => 0), now, still, out);
  } else if (spec.kind === 'rampart') {
    const pillars = spec.spots.pillar ?? [];
    const onPillar = (p) => [p.x, p.z, spec.discs.find((d) => d.role === 'pillar' && Math.hypot(d.x - p.x, d.z - p.z) < 0.01)?.y];   // EG-ZJ: a pinned Caster on its pillar's top, never the walkway its plan overlaps
    if (v === 'gauntlet') {
      const k = Math.min(pillars.length, 2 + Math.ceil(n / 2));
      F.gauntlet = pillars.slice(0, k).map((p) => ({ p, stood: 0, at: 0, done: 0 }));
      for (const g of F.gauntlet) { const [c] = egLegionRaise(F, [EG_KIND.caster], [onPillar(g.p)], now, out); if (c) { c.pinned = 1; g.i = c.i; } }
      P.obj = 'gauntlet'; P.left = F.gauntlet.length; P.silenced = F.gauntlet.map((g) => g.done);   // FIELD BUGS 2026-10-19f GAUNTLET-PLATES: each plate's word from the wake (trialStep's)
    } else {
      if (v !== 'winch') egLegionRaise(F, [EG_KIND.bearer, EG_KIND.bearer], spec.gate.bearers.map((q) => [q.x, q.z]), now, out);
      const k = Math.min(pillars.length, 1 + Math.ceil(n / 3));
      for (const p of pillars.slice(0, k)) { const [c] = egLegionRaise(F, [EG_KIND.caster], [onPillar(p)], now, out); if (c) c.pinned = 1; }
      F.waveAt = now + 6000 + still;
      if (v === 'winch') { F.winch = 0; P.obj = 'winch'; P.winch = 0; } else P.obj = 'wards';
    }
    if (spec.twist === 'squad') squadTwist(F, [[spec.walk.x, spec.walk.z0 + 30], [spec.walk.x + 1.5, spec.walk.z0 + 32], [spec.walk.x - 1.5, spec.walk.z0 + 34], [spec.walk.x, spec.walk.z0 + 36]], now, still, out);
  } else if (spec.kind === 'athenaeum') {
    const s = (egSeed(B.seed, 0x0a7e + spec.h) % 2147483646) + 1;
    // AUDIT EG V (L3-1): the range held to what six stones can need; (L2-10; sections 8.4 and 14): THE FRAYING in force sets
    // the Orrery's fray (net/eliteGates/egRun.js egFrayOf), the Hour's otherwise
    F.orrery = orreryOf(s, { ...egOrreryTurns(spec.c), ...(F.D.fraying ? { fray: egFrayOf(spec.c, F.D.fraying) } : {}) });
    F.lock = orreryFresh(F.orrery); F.lockLast = [0, 0, 0, 0, 0, 0]; F.turns = 0; F.best = orreryShortest(F.orrery, F.lock.st);
    for (const [j, st] of (spec.spots.stone ?? []).entries()) egRaiseObj(F, 'stone', st.x, st.z, 0, now, out, { r: 1, pt: j, y: spotY(spec, st) });
    F.waveAt = now + EG_LOCK_EVERY_MS + still;
    P.obj = 'orrery'; P.st = [...F.lock.st]; P.lit = 0; P.f = 0;
  } else if (spec.kind === 'proving') {
    const key = spec.champ ?? 'kynreeve';
    EG_SEAM.new({ F, spec, key, now, out, decrees: F.D, n });   // AUDIT EG IV (lane1 #11; section 8.5): asleep - it wakes at its court's ring (trial, champRing)
    if (still) F.escortAt = now + still; else provingEscort(F, spec, rng, now, out);   // AUDIT EG V (L2-6): under Stillness its escort rises late (trial)
    P.obj = 'champion';
  } else if (spec.kind === 'deepway') {
    const ch = spec.spots.chamber?.[0];
    F.chamber = ch?.obj ?? 0;
    if (F.chamber === 0) { const k = Math.min(egRiftsFor(n), spec.rifts.length); for (const q of spec.rifts.slice(0, k)) egRaiseObj(F, 'rift', q.x, q.z, egHpTeam(F, EG_RIFT_TEAM_S, k), now, out, { r: 1.3 }); F.halfCap = 1; P.obj = 'rifts'; }
    else if (F.chamber === 1) { EG_SEAM.new({ F, spec, key: spec.champ ?? 'kynreeve', now, out, decrees: F.D, n }); P.obj = 'champion'; }   // AUDIT EG IV (lane1 #11): asleep until its chamber's ring
    else { const e = spec.spots.engine?.[0]; if (e) egRaiseObj(F, 'engine', e.x, e.z, 0, now, out, { r: 3, y: spotY(spec, e) }); F.engineHeld = 0; P.obj = 'engine'; P.hold = 0; }
  } else if (spec.kind === 'scriptorium') {
    out.push({ k: 'eheal', p: 0.3 });
    F.quietUntil = now + EG_SCRIPTORIUM_MS;
    P.obj = 'quiet';
  } else if (spec.kind === 'court') {
    const key = spec.lord;
    const sev = B.sever ? 1 : 0;
    B.sever = 0;
    const [main] = EG_SEAM.new({ F, spec, key, now, out, decrees: F.D, n }).stood;
    if (F.D.feud && spec.foe) { const champ = ['kynreeve', 'kynmarcher', 'markynaz', 'markynaz'][spec.band]; EG_SEAM.new({ F, spec, key: champ, now, out, decrees: F.D, n, at: [spec.foe.x + 6, spec.foe.z] }); }
    // THE TWIN COURT, THE OLD MASTERS (section 18's strata) - AUDIT EG IV (lane2 #3): the second lord egStrataSecond's, never the
    // lord itself, each lord at EG_PAIR_HP (a champion beside them whole); the two masters together on THE MASTERS' GROUND
    const second = egStrataSecond(B.strata, key, spec.c);
    if (second && spec.foe) {
      const [b] = EG_SEAM.new({ F, spec, key: second, now, out, decrees: F.D, n, at: [spec.foe.x - 6, spec.foe.z] }).stood;
      if (b) { for (const a of egLordsOf(F)) if (!a.champ) { a.hp = a.max = Math.round(a.max * EG_PAIR_HP); } }
      if ((B.strata ?? []).includes('oldmasters')) F.mem.oldMasters = 1;   // the Twins' window over the pair (net/eliteGates/egLords.js egLordHit)
      if ([key, second].includes('spellmaster') && [key, second].includes('armsmaster')) { F.mem.lessonMin = EG_MASTERS_LESSON_R; F.mem.runeR = EG_MASTERS_RUNE_R; }
    }
    F.sever = sev;
    F.ringAt = 0;
    if ((B.strata ?? []).includes('moltenrim')) { const M = egMoltenRim(spec); for (const k of ['void', 'haven']) { const list = k === 'void' ? M.rings : M.ways, ys = k === 'void' ? M.ys?.rings : M.ys?.ways; for (const [j, s] of list.entries()) zoneOut(F, k, s, now, now + EG_ZONE_FIGHT_MS, out, { whole: true, y: ys?.[j] }); } }   // THE MOLTEN RIM: a Court's discs (AUDIT EG IV: section 18 says so) - AUDIT EG V (lane1 #21): each way across it a causeway (net/eliteGates/egLaw.js egMoltenRim)
    P.obj = 'lord';
  }
  // THE TWISTS (section 8.7) at the wake
  if (spec.twist === 'vault') vaultStand(F, spec, now, out);   // AUDIT EG V (lane3 #18): a Proving Walk's Reliquary Vault, as a span's
  if (spec.twist === 'ghost' && spec.fight) egLegionRaise(F, [EG_KIND.ghost], [[spec.arrive.x + 2, spec.arrive.z + 2]], now, out);
  if (spec.twist === 'captive') captiveStand(F, spec, now, out);
  if (spec.twist === 'bargain' && egBargainOpen(B)) egAsk(B, 'bargain', [1], now, out);
  // KYN'S VIGIL (section 14): the band's champion on the arrival plate with its escort (section 8.5's, doubled at rank II) -
  // AUDIT EG III: in every hall with a trial and no champion or lord of its own: never a Proving Walk's or a Court's, never the
  // Scriptorium's quiet; a span's and a Brink's crossing never stand it (their fight returns above - EG_VIGIL_NONE). AUDIT EG IV
  // (lane1 #1): nor a Deepway whose chamber stood its own champion - a hall whose fight stands a lord already
  if (F.D.vigil && !EG_VIGIL_NONE.includes(spec.kind) && spec.arrive && !egLordsOf(F).length) {
    const champ = ['kynreeve', 'kynmarcher', 'markynaz', 'markynaz'][spec.band], at = [spec.arrive.x, spec.arrive.z + 3], k = egEscortOf(n) * (F.D.vigil >= 2 ? 2 : 1);
    EG_SEAM.new({ F, spec, key: champ, now, out, decrees: F.D, n, at }); egLordsWake(F, spec, now, out, { n });
    egLegionRaise(F, egWaveKinds(F, rng, k), ringSpots(spec, at[0], at[1], 5, k, rng, spec.arrive.y), now, out, { wave: 1 });
  }
  if ((F.D.warband || B.tide === 'warband') && spec.fight && spec.kind !== 'court') egSquad(F, ringSpots(spec, spec.fight.x, spec.fight.z, 6, 4, rng), now, out);
  F.sparkAt = now + 20_000; F.ashAt = now + 12_000; F.packAt = now + 30_000;
  fragStand(B, F, spec, now, out);
  egLordsStand(F, L.filter(([, m]) => m.hereH === B.h).map(([sub]) => sub));   // FIELD BUGS 2026-10-19e LORD-SHARES: every lord stood (the Twin Court's at its part), sized for the company on its arrival plate - the whole fight said by the wake
  return F;
}

// ── EG-FULL LAYER THREE: THE FRAGMENTS' RELAY HALF (net/eliteGates/egFragLaw.js; section 11) ─────────────────────────────────
/**
 * At a hall's wake: each seam alcove's false wall (one blow - a struck object, `fwall`), the fragments' Lurkers dormant
 * in their walls' shadow (the Low Road's every one; a passage's one from circle 3; a chamber's one from circle 4), the
 * engines' cooldowns, the Clan Pit's horn.
 */
function fragStand(B, F, spec, now, out) {
  F.alc = {}; F.engCd = {}; F.engUsed = {}; F.engHits = []; F.engStun = {}; F.lowUp = 0; F.took = {}; F.lit = [];
  F.horn = spec.spots.horn?.length ? { at: now + EG_HORN_FIRST_MS, kv: 0, sub: '', foul: 0, ashAt: 0, ash: 0 } : null;
  for (const a of spec.alcoves ?? []) {
    if (a.seal !== 'seam') { F.alc[a.i] = 1; continue; }
    const o = egRaiseObj(F, 'fwall', a.x, a.z, 1, now, out, { r: 1.0, pt: a.i, y: a.y });   // EG-ZJ: on its alcove's own floor
    if (o) o.alc = a.i;
  }
  const lurks = [], firstOf = new Set();
  for (const q of spec.spots.lurker ?? []) {
    const f = spec.frags?.[q.f], low = q.road === 1;
    if (!f) continue;
    if (low || (!firstOf.has(q.f) && ((f.cls === 'passage' && spec.c >= 3) || (f.cls === 'chamber' && spec.c >= 4)))) { lurks.push([q.x, q.z]); firstOf.add(q.f); }
  }
  if (lurks.length) egLegionRaise(F, lurks.map(() => EG_KIND.lurker), lurks, now, out, { wave: 0 });   // AUDIT EG V (L2-3): statues - the cap counts each from its waking (net/eliteGates/egLegion.js egLegionRoom)
}
/** The Low Road's member (section 11.4): on THE FORK's other road (net/eliteGates/egRoute.js egRouteRoad - laws 4-8 past the fork, on
 *  its side of the hall; LAW 9 on the route's road 1, by height too). */
const onLowRoad = (spec, b) => !!spec.fork && egRouteRoad(spec, b) === 1;
/**
 * The fragments' beat, in a trial and its closing: the alcoves (a member within reach of an open one takes what it
 * holds, once), the High Road's cache (a Reliquary to each who touches it) and the Low Road's niche (15% once, a shard
 * each), the Low Road's foes risen as the first member takes it, the engines' blows landing on the legion, the Clan Pit's
 * horn.
 */
function fragStep(B, F, spec, now, inHall, here, rng, out) {
  if (!F.alc) return;
  // THE ASCENT (Elite-Gates-Ascent.md section 2): of things laid at a height (an alcove's floor, metres; a cache's or a niche's
  // spot, centimetres), those a member's feet stand on the floor of - never a ledge's cache from the floor under it, nor over it
  const reachable = (b, list, cm = true) => (egByHeight(spec) ? (list ?? []).filter((q) => { const oy = cm ? spotY(spec, q) : q.y; return !Number.isFinite(oy) || egBears(oy, egFeetY(spec, b.y)); }) : list ?? []);
  for (const b of inHall) {
    const mm = B.mem[b.sub];
    if (!mm) continue;
    const took = (F.took[b.sub] ??= {});
    for (const a of reachable(b, spec.alcoves, false)) {
      if (!F.alc[a.i] || took[`a${a.i}`] || dist(b.x, b.z, a.x, a.z) > EG_ALCOVE_REACH_M) continue;
      took[`a${a.i}`] = 1;
      if (a.holds === 'page') {
        const p = egAnnalsNext(mm.pages ?? 0, (B.seed + spec.h * 7 + a.i) % 17);
        if (p >= 0) { mm.pages = (mm.pages ?? 0) | (1 << p); out.push({ k: 'egot', to: b.sub, w: 'page', p }); }
        else { egGive(mm, 'lumen'); out.push({ k: 'egot', to: b.sub, w: 'lumen' }); }
      } else { egGive(mm, a.holds); out.push({ k: 'egot', to: b.sub, w: a.holds }); }
      out.push({ k: 'run', r: egRunOf(b.sub, mm) });
    }
    for (const q of reachable(b, spec.spots.hcache)) if (!took.hc && dist(b.x, b.z, q.x, q.z) <= EG_HCACHE_REACH_M && fairOf(B, b.sub)) { took.hc = 1; egGive(mm, 'rel', egCircleOfHall(B.h)); out.push({ k: 'egot', to: b.sub, w: 'rel' }, { k: 'esay', w: 'hcache', n: mm.name }, { k: 'run', r: egRunOf(b.sub, mm) }); }
    for (const q of reachable(b, spec.spots.lniche)) if (!took.ln && dist(b.x, b.z, q.x, q.z) <= EG_ALCOVE_REACH_M && fairOf(B, b.sub)) { took.ln = 1; egGive(mm, 'shard'); out.push({ k: 'eheal', p: EG_NICHE_HEAL, why: 'niche', to: b.sub }, { k: 'egot', to: b.sub, w: 'shard' }, { k: 'esay', w: 'niche', n: mm.name }, { k: 'run', r: egRunOf(b.sub, mm) }); }
    if (!F.lowUp && B.sg === 'trial' && onLowRoad(spec, b)) {
      F.lowUp = 1;
      const foes = spec.spots.lowfoe ?? [];
      if (foes.length) egLegionSummon(F, foes.map(() => EG_KIND.harrier), foes.map((q) => (Number.isFinite(spotY(spec, q)) ? [q.x, q.z, spotY(spec, q)] : [q.x, q.z])), now, out, { wave: 0 });   // AUDIT EG IV (lane1 #6): within the legion's cap
      out.push({ k: 'esay', w: 'lowroad', n: mm.name });
    }
  }
  // the engines' blows land on the legion (each member's own share is the blow's - every screen judges its own feet); EG-ZC:
  // the Sluice's flood lands every beat until its 6 s run, each add's share once; a lit branch goes dark at its end
  if (F.engHits.length) {
    const due = F.engHits.filter((h) => now >= h.at);
    F.engHits = F.engHits.filter((h) => now < h.at || now < (h.until ?? 0));
    for (const h of due) engineLands(B, F, spec, h, now, out);
  }
  if (F.lit?.length) F.lit = F.lit.filter((q) => now < q.until);
  if (F.horn && B.sg === 'trial') hornStep(B, F, spec, now, inHall, rng, out);
}
/**
 * AN ENGINE WORKED (section 11.10 - `use`): the Sluice floods a channel through the legion, the Shelf topples onto it
 * (once), the Drop-Hammer falls on it, each a blow of the place told EG_ENGINE_TELL_MS (a member caught takes the place's
 * 20%); the Soul-Bell and the Moon-Mirror ring out about the engine. Aimed where the legion stands thickest. EG-ZC (the
 * engines as written): the Sluice's channel stays flooded `flood` from its landing - burning ground of the place's fire, a
 * member in it taking the place's 20% each tick, every add in it losing its 40% once (its ring tells the flood, and bites
 * nothing itself); the Moon-Mirror also lights the Moon branch nearest it within EG_MIRROR_REACH_M for `lit` - a haven over
 * its top on every screen (it stands while lit), and its body held there in THE FAIR TRAIL (egPoseIn).
 */
function engineWork(B, F, spec, e, mm, now, out) {
  const E = EG_ENGINES[e.kind];
  if (!E) return false;
  const adds = egBodiesOf(F, EG_ROLE.add).filter((a) => !egHas(a, EG_FL.friend) && a.hp > 0);
  let tx = spec.fight?.x ?? e.x, tz = spec.fight?.z ?? e.z, best = -1;
  for (const a of adds) { const n = adds.filter((q) => dist(q.x, q.z, a.x, a.z) <= 3).length; if (n > best) { best = n; tx = a.x; tz = a.z; } }
  const yaw = Math.atan2(tx - e.x, tz - e.z), far = Math.max(8, dist(e.x, e.z, tx, tz) + 6);
  const stamp = e.kind === 'sluice' ? shLane(e.x, e.z, e.x + Math.sin(yaw) * Math.max(far, 2 * (spec.fight?.r ?? 12)), e.z + Math.cos(yaw) * Math.max(far, 2 * (spec.fight?.r ?? 12)), 4)
    : e.kind === 'shelf' ? shLane(e.x, e.z, e.x + Math.sin(yaw) * 12, e.z + Math.cos(yaw) * 12, 4)
      : e.kind === 'hammer' ? shDisc(tx, tz, 3) : shDisc(e.x, e.z, 8);
  const at = now + EG_ENGINE_TELL_MS;
  if (E.flood) zoneOut(F, 'burn', stamp, at, at + E.flood, out, { p: EG_ENGINE_PCT, b: 0, el: 'fire', y: e.y });
  if (E.pct > 0) {
    const here = egPosedHere(B);   // AUDIT EG V (h, A1 NEW-1; L2-2's root): the living company by its poses of THIS hall - never a pose an earlier hall left
    egAim(F, spec, { o: 0, s: [stamp], at, wu: EG_ENGINE_TELL_MS, p: E.flood ? 0 : EG_ENGINE_PCT, b: 0, el: E.flood ? 'fire' : null, nm: E.name, y: e.y }, here, now, out);
  }
  F.engHits.push({ at, until: E.flood ? at + E.flood : 0, kind: e.kind, s: stamp, i: e.i, got: [] });
  const br = E.lit ? moonNear(spec, e) : null;
  if (br) { (F.lit ??= []).push({ i: br.i, from: at, until: at + E.lit }); zoneOut(F, 'haven', shDisc(br.x, br.z, EG_MIRROR_LIT_R), at, at + E.lit, out, { y: br.y }); }
  if (E.once) F.engUsed[e.i] = 1;
  out.push({ k: 'esay', w: 'engine', n: mm.name, t: E.name.replace(/^the /, '') });
  return true;
}
/** EG-ZC: the Moon branch nearest engine `e` within the Moon-Mirror's reach (EG_MIRROR_REACH_M), or null. */
function moonNear(spec, e) {
  let best = null, bd = EG_MIRROR_REACH_M;
  for (const s of spec.steps ?? []) if (s.kind === 'moon' && dist(s.x, s.z, e.x, e.z) <= bd) { bd = dist(s.x, s.z, e.x, e.z); best = s; }
  return best;
}
/** An engine's blow landed: the adds caught lose their share; the bell stuns Wraiths and Binders, the mirror the Divers;
 *  the hammer stuns a lord caught, once a phase. EG-ZC: a flood (`got`) takes each add's share once while it runs. */
function engineLands(B, F, spec, h, now, out) {
  const E = EG_ENGINES[h.kind];
  for (const a of egBodiesOf(F, EG_ROLE.add)) {
    if (egHas(a, EG_FL.friend) || !(a.hp > 0) || !egInShape(h.s, a.x, a.z)) continue;
    if (h.got) { if (h.got.includes(a.i)) continue; h.got.push(a.i); }
    if (E.stun) {
      const k = /** @type {number[]} */ (h.kind === 'soulbell' ? [EG_KIND.wraith, EG_KIND.binder] : [EG_KIND.diver]);
      if (k.includes(a.k)) { egSetFl(F, a, EG_FL.stun, true, out); a.stunUntil = now + E.stun; }
      continue;
    }
    a.hp -= a.max * E.pct;
    if (a.hp <= 0) { a.hp = 0; egGone(F, [a], EG_GONE.slain, E.name, now, out); }
  }
  if (E.lordStun) for (const L of egLordsOf(F)) if (egInShape(h.s, L.x, L.z) && F.engStun[L.i] !== L.ph) { F.engStun[L.i] = L.ph; egStun(F, L, E.lordStun, now, out); }
}
/**
 * THE HONOUR HORN (the Clan Pit, section 11.2): a Kynval steps into a ring (r 6) and calls one member. If that member
 * alone fights him, the tiers throw a Reliquary to every member; if another member enters the ring, the crowd throws
 * fire - Ashfall in the Pit for the rest of the hall. With one member it is always honourable.
 */
function hornStep(B, F, spec, now, inHall, rng, out) {
  const H = F.horn, at = spec.spots.horn[0];
  if (H.ash && now >= H.ashAt) {
    H.ashAt = now + EG_ASHFALL_EVERY_MS;
    // EG-PERFECT: "Ashfall in the Pit" - about the fight floor under its horn, each pool kept on it (the fight's bounding disc,
    // `r` half its box's diagonal, threw 15-34% of them past a Pit's rim, and a Deepway's - over its whole hall - four in five)
    const pit = egFightPieceAt(spec, at.x, at.z, 0, spotY(spec, at)), c = pit ? pieceDisc(pit) : spec.fight ?? at;
    for (let k = 0; k < 3; k++) {
      const a = rng() * Math.PI * 2, r = rng() * Math.max(2, (c.r ?? 12) - 3), [x, z] = pit ? egKeepOnFight({ fl: [pit] }, c.x + Math.sin(a) * r, c.z + Math.cos(a) * r, 1) : [c.x + Math.sin(a) * r, c.z + Math.cos(a) * r];
      zoneOut(F, 'burn', shDisc(x, z, 3), now + 1500, now + 7500, out, { y: spotY(spec, at), p: 0.06, b: 2, el: 'fire' });
    }
  }
  if (!H.kv) {
    if (now < H.at || !inHall.length) return;
    const callee = inHall[Math.floor(rng() * inHall.length)];
    const [k] = egLegionSummon(F, [EG_KIND.kynval], [Number.isFinite(spotY(spec, at)) ? [at.x, at.z, spotY(spec, at)] : [at.x, at.z]], now, out, { need: 1, wave: 0 });   // AUDIT EG V (L2-16; section 12): the challenge's own body - it stands whatever the room, and counts against it after
    if (!k) { H.at = now + EG_HORN_AGAIN_MS; return; }
    H.kv = k.i; H.sub = callee.sub; H.foul = inHall.length <= 1 ? 0 : H.foul;
    out.push({ k: 'esay', w: 'horn', n: memberName(B, callee.sub) });
    return;
  }
  const k = egBodyById(F, H.kv);
  if (!k || !(k.hp > 0)) {
    if (!H.foul) { for (const [s2, m2] of living(B)) { egGive(m2, 'rel', egCircleOfHall(B.h)); out.push({ k: 'egot', to: s2, w: 'rel' }); } out.push({ k: 'esay', w: 'hornwon', n: memberName(B, H.sub) }); }
    H.kv = 0; H.sub = ''; H.foul = 0; H.at = now + EG_HORN_AGAIN_MS;
    return;
  }
  if (!H.foul && inHall.length > 1 && inHall.some((b) => b.sub !== H.sub && dist(b.x, b.z, k.x, k.z) <= EG_HORN_RING_M)) {
    H.foul = 1;
    if (!H.ash) { H.ash = 1; H.ashAt = now; }
    out.push({ k: 'esay', w: 'hornfoul' });
  }
}
/** A Span's twist: the Reliquary Vault's cache. AUDIT EG V (L3-19; section 8.7 - "any trial hall"): A Battlemage's Ghost at the
 *  arrival plate, flying with the company over the course (net/eliteGates/egLegion.js - a span's ghost keeps to the air, as its Harriers
 *  do), and the Captive Battlemage's three chains on the course's islands (egCaptiveSpots) - a span's fight returned before
 *  the twists of every other hall were stood, so neither ever stood on one. */
function spanTwist(B, F, spec, now, out) {
  if (spec.twist === 'vault') vaultStand(F, spec, now, out);
  if (spec.twist === 'bargain' && egBargainOpen(B)) egAsk(B, 'bargain', [1], now, out);
  if (spec.twist === 'ghost' && spec.arrive) egLegionRaise(F, [EG_KIND.ghost], [[spec.arrive.x + 2, spec.arrive.z + 2]], now, out);
  if (spec.twist === 'captive') captiveStand(F, spec, now, out);
  F.pg.obj = 'cross';
}
/** THE CAPTIVE BATTLEMAGE's chains this many (section 8.7: "three chains, each 4 s of the company's reference damage"). */
export const EG_CHAINS = 3;
/**
 * AUDIT EG V (L3-19; section 8.7) - WHERE THE CAPTIVE'S THREE CHAINS HANG, on the hall's fight ground: the law's spots where it
 * lays three (about a disc that is its first fight floor - a court, a chamber's); else the director's - a span's (or a Brink's)
 * on its islands spread along the course (its plates where it has fewer); a Deepway's about its chamber's floor, as the law
 * lays a court's; else along the hall's first lane (a Rampart's walkway) at its quarters. The law lays one chain where its
 * first floor is a lane, so a Rampart and most Deepways hung one and a span's hung in the air. EG-PERFECT (2026-10-18): the
 * law's three where each hangs on a fight floor - LAW 9 laid a hero chamber's about the hall's origin line, off every floor
 * where its way turned the chamber aside (seed 40's hall 66, seed 6's hall 22, seed 60's hall 99 - 3 of the 210 Captive halls
 * of seeds 1-60); refused, about the chamber's own floor (a disc's as the law lays them, a hero's fight polygon's a quarter of
 * its narrower side out, each kept on it). `[x, z]` each. Pure.
 * @param {any} spec
 * @returns {Array<[number, number]>}
 */
export function egCaptiveSpots(spec) {
  const law = spec.spots?.chain ?? [], three = law.slice(0, EG_CHAINS);
  // EG-PERFECT: the law's three only where each hangs on a fight floor (by its height, where the hall judges so) - LAW 9 lays a
  // hero chamber's about the hall's origin line (x 0, the plan's X taken back), off its floor; refused, about the chamber's own
  // floor (below). Every hall whose three hang on its floor keeps them
  if (law.length >= EG_CHAINS && three.every((q) => egOnFight(spec, q.x, q.z, 0, spotY(spec, q)))) return three.map((q) => [q.x, q.z]);
  const about = (d) => [0, 120, 240].map((deg) => /** @type {[number, number]} */ ([d.x + Math.sin((deg * Math.PI) / 180) * (d.r / 2), d.z + Math.cos((deg * Math.PI) / 180) * (d.r / 2)]));
  if (spec.kind === 'span' || spec.kind === 'brink') {
    const fl = egFightView(spec).fl, by = (a, b) => egRouteAlong(spec, a) - egRouteAlong(spec, b);   // THE ASCENT: along the route
    const isles = fl.filter((f) => f.g === 'island').sort(by);
    const ground = isles.length >= EG_CHAINS ? isles : [...isles, ...fl.filter((f) => f.g === 'plate').sort(by)];
    if (ground.length >= EG_CHAINS) return [0, 1, 2].map((j) => { const d = ground[Math.round((j * (ground.length - 1)) / 2)]; return [d.x, d.z]; });
    if (ground.length) return about(ground[0]);
  }
  const ch = spec.spots?.chamber?.[0], disc = ch ? (spec.fl ?? []).find((f) => f.t === 'd' && Math.hypot(f.x - ch.x, f.z - ch.z) <= f.r) : null;
  if (disc) return about(disc);
  // EG-PERFECT: the law's three refused - about a hero chamber's floor: the fight polygon under its chamber's spot (a Deepway's),
  // else the hall's widest (a Rift-Yard's, a Proving Walk's court), each kept on it
  if (law.length >= EG_CHAINS) {
    const polys = (spec.fl ?? []).filter((f) => f.t === 'p'), under = ch ? egFightPieceAt(spec, ch.x, ch.z, 0, spotY(spec, ch)) : null;
    const poly = under?.t === 'p' ? under : polys.reduce((a, f) => (!a || boxArea(f) > boxArea(a) ? f : a), null);
    if (poly) return about(pieceDisc(poly)).map(([x, z]) => /** @type {[number, number]} */ (egKeepOnFight({ fl: [poly] }, x, z, 1)));
  }
  const lane = (spec.fl ?? []).find((f) => f.t === 'l');
  if (lane) return [0.25, 0.5, 0.75].map((t) => [lane.ax + (lane.bx - lane.ax) * t, lane.az + (lane.bz - lane.az) * t]);
  return law.map((q) => [q.x, q.z]);
}
/** The Captive's chains stood (section 8.7), each EG_CHAIN_S of the company's reference damage. */
function captiveStand(F, spec, now, out) {
  for (const [x, z] of egCaptiveSpots(spec)) egRaiseObj(F, 'chain', x, z, egHpTeam(F, EG_CHAIN_S), now, out, { r: 0.8 });
  F.captive = 1;
}
/** The Captive freed: every chain broken, a Cantrip for each living member (section 17.2), once. */
function captiveStep(B, F, rng, out) {
  if (!F.captive || egObjsOf(F, 'chain').length) return;
  F.captive = 0;
  for (const [sub, m] of living(B)) { egGive(m, 'cant', 1, rng); out.push({ k: 'egot', to: sub, w: 'cant' }); }
  out.push({ k: 'esay', w: 'freed' });
}
/** THE RELIQUARY VAULT (section 8.7): its cache stood at the wake, wherever its hall's law laid it (AUDIT EG V, lane3 #18: a
 *  Span's, a Brink's and a Proving Walk's - spec law 8 lays one on a forked span too). */
function vaultStand(F, spec, now, out) {
  for (const q of spec.spots.vault ?? []) egRaiseObj(F, 'vault', q.x, q.z, 0, now, out, { r: 3, y: spotY(spec, q) });
}
/** THE RELIQUARY VAULT TAKEN: an extra Reliquary for each member who reaches it with a fair trail - in the trial of any hall
 *  that stood one and in its closing (AUDIT EG V, lane3 #18: it was taken only in a span's trial). */
function vaultStep(B, spec, inHall, out) {
  if (spec.twist !== 'vault' || !B.F) return;
  // THE ASCENT (Elite-Gates-Ascent.md section 2): reached only with the feet on the vault's own floor
  for (const b of inHall) for (const o of egObjsOf(B.F, 'vault')) if (dist(b.x, b.z, o.x, o.z) <= 3 && (!egByHeight(spec) || egBears(o.y ?? 0, egFeetY(spec, b.y))) && fairOf(B, b.sub) && !(o.took ??= {})[b.sub]) { o.took[b.sub] = 1; egGive(B.mem[b.sub], 'rel', egCircleOfHall(B.h)); out.push({ k: 'egot', to: b.sub, w: 'rel' }); }
}
/** An errand's object stood (net/eliteGates/egLords.js's law for its types). */
function egRaiseObj(F, t, x, z, hp, now, out, o = {}) {
  const b = egRaise(F, EG_ROLE.obj, EG_OBJ[t] ?? 0, [[x, z, o.y]], hp > 0 ? hp : 1, now, out, { r: o.r ?? 1.2, pt: o.pt ?? 0 })[0];
  if (!b) return null;
  b.t = t; b.st = 0; b.great = o.great ?? 0;
  if (!(hp > 0)) egSetFl(F, b, EG_FL.ward, true, out);
  return b;
}

// ── EG-PERFECT (2026-10-18): THE CLOSING'S WALK ─────────────────────────────────────────────────────────────────────────────
/** EG-PERFECT - the share a closing's walk is given past THE SPAN BUILD's own crossing of it (egClosingMs): a quarter to spare,
 *  for the turn a body takes at a landing and the member who stops for the hall's cache. */
export const EG_CLOSING_WALK_X = 1.25;
/** The kinds whose door opens on an arrival at it (a fair trail's first at the end plate - section 21): the company is at the door. */
const ARRIVAL_DOORS = Object.freeze(['span', 'deepway', 'brink']);
/**
 * EG-PERFECT - THE TRIAL'S END ON THE ROUTE (THE ASCENT, LAW 9): the place on road 0's path (net/eliteGates/egRoute.js egRouteOf's
 * `paths[0]` - its number there) of the last node that stands on the hall's first course's own ground (`route.courses` first - THE BROKEN WAY's broken bridges, `b`, aside - 0.5 m
 * about: a Rift-Yard's court, the Rampart's walk, the Athenaeum's lock, the Scriptorium's court, a Proving Walk's champion's
 * court - where its trial is fought), the way leaving it there for the door; 0, the arrival plate, on a route that names no
 * course. Pure.
 * @param {any} spec
 */
export function egTrialEndAt(spec) {
  const R = egRouteOf(spec), g = spec?.route?.courses?.find((q) => !q.b), P = R.paths[0], pad = 0.5;   // (THE BROKEN WAY - spec law 10: never a broken bridge's ground, `b`)
  let k0 = 0;
  if (g) P.forEach((n, k) => { const p = R.nodes[n]; if (p[0] >= g.x0 - pad && p[0] <= g.x1 + pad && p[2] >= g.z0 - pad && p[2] <= g.z1 + pad && p[1] >= g.y0 - pad && p[1] <= g.y1 + pad) k0 = k; });
  return k0;
}
/**
 * EG-PERFECT - THE CLOSING'S WALK of a hall laid as a way (s): road 0's legs from the trial's end (egTrialEndAt) to the door at
 * THE SPAN BUILD (net/eliteGates/egSpanLaw.js egRouteSolved - each by its kind's law; before a climb, the grip the last one spent
 * waited back, as egRouteCross waits it; a span leg's timed pairs each at most EG_WAIT_MAX, the wait THE TIMED SOLVER proves).
 * Transcendental-free (+, -, x, / and the square root - one answer on every engine, the relay's and the pins'). Pure.
 * @param {any} spec
 */
export function egClosingWalk(spec) {
  let t = 0, owed = 0, since = 0;
  for (const L of egRouteSolved(spec, 0).slice(egTrialEndAt(spec))) {
    if (L.g.kind === 'climb' && owed - (t - since) > 0) t += owed - (t - since);
    t += L.span + L.pairs.length * EG_WAIT_MAX;
    if (L.g.kind === 'climb') { owed = L.owed; since = t; }
  }
  return t;
}
/**
 * EG-PERFECT - A DOOR'S CLOSING (section 7's stage, ms): EG_CLOSING_SPAN_MS after a door an arrival opened (a span, a Brink, the
 * Deepway - the company stands at it); after a door its trial's end opens (a Rift-Yard's last rift, a Rampart's gate, an
 * Athenaeum's Orrery, a Scriptorium's quiet, a Proving Walk's champion) EG_CLOSING_FIGHT_MS - a Proving Walk's
 * EG_CLOSING_SPAN_MS, its second span crossed in it - and in a hall laid as a way (LAW 9, net/eliteGates/egRouteProof.js egRouted)
 * EG_CLOSING_FIGHT_MS and its way to the door (egClosingWalk) at THE SPAN BUILD x EG_CLOSING_WALK_X, ceiled to the second: THE
 * ASCENT lays a fight hall's door a median 180-240 m past its trial's end (500 halls, 2026-10-18) and the closing was 20 s, so
 * the door stood out of reach in 76-100% of them (a Proving Walk's in 88%, its 45 s), its cache was lost (taken only in the
 * closing - cacheStep) and the pull came first. Laws 4-8: the closings they had. Pure.
 * @param {any} spec
 */
export function egClosingMs(spec) {
  if (ARRIVAL_DOORS.includes(spec?.kind)) return EG_CLOSING_SPAN_MS;
  if (!egRouted(spec)) return spec?.kind === 'proving' ? EG_CLOSING_SPAN_MS : EG_CLOSING_FIGHT_MS;
  return EG_CLOSING_FIGHT_MS + Math.ceil(egClosingWalk(spec) * EG_CLOSING_WALK_X) * 1000;
}
/** The door opens (section 7): the closing begins - a Rally's heal said, the cache's plaque, the legion crumbles. AUDIT EG V
 *  (h; section 8.2, THE TRAIL): a crossing's door names the member whose fair arrival opened it (`by` - its word's `s`), whose
 *  route every other screen then draws as the first across's. */
function door(B, spec, now, out, inHall = [], by = '') {
  clearHall(B, now);
  if (B.F) { egGone(B.F, egBodiesOf(B.F, EG_ROLE.add), EG_GONE.crumbled, '', now, out); egGone(B.F, egObjsOf(B.F, 'spark'), EG_GONE.crumbled, '', now, out); }
  if (B.F?.marks?.some((q) => q[1] === 7)) { B.F.marks = B.F.marks.filter((q) => q[1] !== 7); egMarksOut(B.F, out); }   // EG-ZB: the hunt is over with the trial
  B.sg = 'closing'; B.sa = now; B.dn = now;
  B.su = now + egClosingMs(spec);   // EG-PERFECT: a way's door its closing's walk too - said with the stage (its `su`), every screen's count
  // THE FORK (section 11.4): the Low Road's closing waits on either road - EG-ZC (forkClosing)
  if (spec.fork) { B.lw = 0; forkClosing(B, spec, inHall, now); }
  // Rally (and the Rallying Cry): the company heals when a hall's door opens - the strongest holder's
  const rally = Math.max(0, ...living(B).map(([, m]) => egVOf(m.vs, 'rally')));
  if (rally > 0) { out.push({ k: 'eheal', p: B.tide === 'hungering' ? rally / 3 : rally, why: 'rally' }); egHymnStep(B, now); }   // EG-ZR: and Shield-Hymn with it
  out.push(egStageWord(B, now), { k: 'esay', w: 'door', ...(by ? { s: [by] } : {}) });
}
/**
 * EG-ZC - THE LOW ROAD'S CLOSING (section 11.4, as written): the High Road's closing begins at the door's opening; the Low
 * Road's at its first arrival at the door (`B.lw` - a member whose trail took the Low Road), or at the door's opening plus
 * the difference between the two roads' fastest crossings, whichever comes first - so the safe road is never a forfeit, and
 * a Low Road that arrives early brings its closing forward. The company is pulled once, at the later road's end, while a
 * member is still on the Low Road or has come by it. Answers whether the closing's end moved.
 */
function forkClosing(B, spec, inHall, now) {
  const low = (b) => onLowRoad(spec, b) || fairOfMember(B, b.sub)?.road === 1;
  if (!B.lw && inHall.some((b) => low(b) && egAtDoor(spec, b.x, b.z, b.y))) B.lw = now;
  const away = inHall.some((b) => low(b) && !egAtDoor(spec, b.x, b.z, b.y) && B.mem[b.sub]?.downH !== B.h);
  const lowFrom = Math.min(B.lw || Infinity, B.dn + Math.max(0, Math.round((spec.fork.lo - spec.fork.hi) * 1000)));
  const su = B.dn + EG_CLOSING_SPAN_MS + (B.lw || away ? Math.max(0, lowFrom - B.dn) : 0);
  if (su === B.su) return false;
  B.su = su;
  return true;
}
/**
 * AUDIT EG III (lane2 #3) - A MEMBER ACTIVE IN A HALL (section 16.1; AUDIT EG0 A6's idle account, EG II L4-18's scripted
 * wiggle): `m` dealt at least EG_ACTIVE_SHARE of an even share of the hall's damage (`dealt`, the company's, `n` the living
 * company at the hall's end), or healed others for at least that share of what the company took in it (`took` - the
 * census's shares, `m.hh` its heals' shares of their receivers' bodies), or stood EG_ERRAND_STAND_MS in an errand's mark
 * (`m.erH`, errandStep), or - in a hall that is crossed (EG_TOLL_KINDS) - crossed it on a fair trail (`crossed`: a step
 * through its door, which only a fair trail takes, or its end reached on one). A step through a fight hall's door alone is
 * not activity. Pure.
 * @param {any} m @param {{ h: number, n: number, dealt: number, took: number, crossed: boolean }} hall
 */
export function egActiveIn(m, { h, n, dealt, took, crossed }) {
  const even = EG_ACTIVE_SHARE / Math.max(1, n);
  return (m.dh > 0 && m.dh >= even * dealt) || (m.hh > 0 && took > 0 && m.hh >= even * took) || m.erH === h || crossed;
}
/** A hall's part in the circle counted for each living member (egActiveIn), and the hall's measures begun again for every
 *  member. */
function countPart(B) {
  const L = living(B), spec = specOf(B), crossHall = EG_TOLL_KINDS.includes(spec.kind);
  const dealt = Object.values(B.mem).reduce((a, m) => a + (m.in && m.dh > 0 ? m.dh : 0), 0), took = B.ctk ?? 0;
  for (const [sub, m] of L) {
    const crossed = crossHall && (m.downH === B.h || !!fairOfMember(B, sub)?.atEnd);
    if (egActiveIn(m, { h: B.h, n: L.length, dealt, took, crossed })) m.act++;
  }
  for (const m of Object.values(B.mem)) { m.dh = 0; m.hh = 0; m.erAt = 0; }
  B.ctk = 0;
}
/**
 * AUDIT EG III (lane2 #3) - AN ERRAND'S MARK STOOD IN (section 16.1): each living member in the hall standing in one -
 * a stood-on errand's object of the hall's fight (EG_ERRAND_MARKS: a rune, a gem, an isle, an umbra, a relic, an Orrery's
 * stone, an engine) within its own reach or EG_TOUCH_M, or a Rampart's winch plate or a Gauntlet's plate still to silence
 * within EG_TOUCH_M - since `m.erAt`; EG_ERRAND_STAND_MS there unbroken is the hall's part (`m.erH`).
 */
function errandStep(B, F, spec, now, inHall) {
  const marks = F.bodies.filter((o) => o.role === EG_ROLE.obj && EG_ERRAND_MARKS.includes(o.t)).map((o) => [o.x, o.z, Math.max(o.r ?? 1.2, EG_TOUCH_M)]);
  for (const q of spec.spots.winch ?? []) marks.push([q.x, q.z, EG_TOUCH_M]);
  for (const g of F.gauntlet ?? []) if (!g.done && g.p?.plate) marks.push([g.p.plate[0], g.p.plate[1], EG_TOUCH_M]);
  for (const b of inHall) {
    const m = B.mem[b.sub];
    if (!m) continue;
    if (!marks.some(([x, z, r]) => dist(b.x, b.z, x, z) <= r)) { m.erAt = 0; continue; }
    if (!(m.erAt > 0)) m.erAt = now;
    if (now - m.erAt >= EG_ERRAND_STAND_MS) m.erH = B.h;
  }
}
/** THE PULL: every living member to the next hall, its arrival begun, the count held to its wake (at most the wait and the gather - net/eliteGates/egLaw.js EG_CLOSING_COUNT_S's note). EG-ZI:
 *  each member short of a crossed hall's end told its toll first (tollStep), and the gather's wait the late wake's. */
function pull(B, now, out) {
  countPart(B);
  tollStep(B, now, out);
  B.h += 1; B.F = null; B.cache = null;
  B.sg = 'arrive'; B.sa = now; B.pulledAt = now; B.hw = 0; B.dn = 0; B.gatherAt = 0;
  B.su = now + arriveWait(B);
  B.cnt = egCountHold(B.cnt, now);
  out.push(egStageWord(B, now), egStateOf(B, now));
}
/**
 * EG-ZI - THE PULL'S TOLL (section 10.6): the quarters of its road a member pulled from hall `h` (its `spec`) pays - each
 * EG_TOLL_STEP of its health, at most EG_TOLL_QUARTERS - for the road still ahead of its furthest fair point (`A.far`,
 * net/eliteGates/egFair.js), measured along THE ROUTE (net/eliteGates/egRoute.js - laws 4-8 the hall's +z) from the arrival plate to the end
 * plate in whole centimetres, every quarter
 * begun counted whole (a member a step short of the end pays one). Nothing after a hall that is not crossed
 * (EG_TOLL_KINDS), for a member who stepped through the door or stood at it on a fair trail (`A.atEnd`), or who reached
 * new ground - an island, a fragment's floor - in its last EG_TOLL_WAIVE_MS (`A.fnew`): only the idle pay, and trying and
 * falling short costs less than standing still. A member the relay judged no fair pose of stands at the arrival plate.
 * Pure.
 * @param {any} spec @param {any} m the member's record @param {any} A its fair trail in the hall, or null @param {number} h @param {number} now
 */
export function egTollOf(spec, m, A, h, now) {
  if (!EG_TOLL_KINDS.includes(spec?.kind) || !spec.arrive || !spec.end || m?.downH === h || A?.atEnd) return 0;
  if (A?.fnew > 0 && now - A.fnew <= EG_TOLL_WAIVE_MS) return 0;
  const a = egRouteAlong(spec, spec.arrive), e = egRouteAlong(spec, spec.end), road = Math.round((e - a) * 100);   // THE ASCENT: along the route
  if (!(road > 0)) return 0;
  const ahead = Math.max(0, Math.round((e - (A?.far ?? a)) * 100));
  return Math.min(EG_TOLL_QUARTERS, Math.ceil((EG_TOLL_QUARTERS * ahead) / road));
}
/** EG-ZI: THE TOLL SAID - each living member who owes one is told it (`toll`, to it alone: `q` its quarters, `h` the hall it
 *  was pulled from); the room's census takes it off the count (egCountHeals) and the member's screen pays it
 *  (scenes/eliteGates/egClient.js), as the void's cost is paid. */
function tollStep(B, now, out) {
  const spec = specOf(B);
  for (const [sub, m] of living(B)) {
    const q = egTollOf(spec, m, fairOfMember(B, sub), B.h, now);
    if (q > 0) out.push({ k: 'toll', to: sub, q, h: B.h });
  }
}
/** EG-ZI - THE LATE WAKE (section 7): how long after the pull the gather waits for the living members not yet `here` -
 *  EG_ARRIVE_MAX_MS, or EG_LATE_ARRIVE_MS once every one of them woke late in the EG_LATE_HALLS halls before (`m.late`). */
function arriveWait(B) {
  const owed = living(B).filter(([, m]) => m.hereH !== B.h);
  return owed.length && owed.every(([, m]) => (m.late ?? 0) >= EG_LATE_HALLS) ? EG_LATE_ARRIVE_MS : EG_ARRIVE_MAX_MS;
}
/** THE SURPLUS (section 6.2): `over` ms the count's cap turned away banked, every EG_SURPLUS_MS of it a Surplus, at most
 *  EG_SURPLUS_MAX held. */
function surplusBank(B, over) {
  if (!(over > 0)) return;
  B.surAcc += over;
  while (B.surAcc >= EG_SURPLUS_MS && B.sur < EG_SURPLUS_MAX) { B.surAcc -= EG_SURPLUS_MS; B.sur++; }
}
/** The count's gain at a Redoubt: fifteen minutes (ten under The Covenant's Press, five at its rank II), never past the cap
 *  nor the last word - AUDIT EG III (lane2 #2): THE ONE LAW, net/eliteGates/egLaw.js egCountRedoubt and egRedoubtHold; what the cap
 *  turned away banked toward a Surplus (egCountOver). The count held through the rest. Answers the gain (ms). */
function redoubtGain(B, now) {
  const hold = egRedoubtHold(egDecreeRanks(B).press ?? 0), before = egCountLeft(B.cnt, now);
  surplusBank(B, egCountOver(B.cnt, now, hold));
  B.cnt = egCountRedoubt(egCountHold(B.cnt, now), now, Math.max(0, B.op + EG_LAST_WORD_MS - now), hold);
  return B.cnt.left - before;
}
/**
 * THE REDOUBT (section 16): the Court fell - its receipts for every earner (a share of the circle's damage, or a part in
 * three of its halls), a Reliquary sealed into each earner's satchel, the count's time (none under THE COVENANT'S
 * PATIENCE), the rest held; the recalls at 4.5 s; at 6 s the rest window: the Vestiges offered, the next circle's decrees
 * put to the company, the Ready and the respite. A Rehearsal ends here instead.
 */
function redoubt(B, now, rng, out) {
  for (const [sub, m] of Object.entries(B.mem)) if (m.down) egFall(B, sub, now, out, null);   // AUDIT WORLD-EVENTS L1-4: the hall cleared with one lying down - the fall now, and the Redoubt's recall is its own
  clearHall(B, now);
  countPart(B);
  if (B.F) egGone(B.F, egBodiesOf(B.F, EG_ROLE.add), EG_GONE.crumbled, '', now, out);
  // THE ANNALS (section 11.10): a lord's first fall adds its page to every living member's - AUDIT EG V (L3-14): a Rehearsal's
  // too (section 20's EG-E2: "a page is lore, not pay"), so before its end, whose receipts carry it (`an`)
  const page = egAnnalsLordPage(specOf(B).lord ?? '');
  if (page >= 0) for (const [sub, m] of living(B)) if (!((m.pages ?? 0) & (2 ** page))) { m.pages = (m.pages ?? 0) + 2 ** page; out.push({ k: 'egot', to: sub, w: 'page', p: page }); }
  if (B.rh) { egEnd(B, 'rehearsal', now, out); return; }
  const dm = egChartOf(B);   // EG-ZF (section 27.6): THE DAMAGE CHART at the lord's fall, said with the Redoubt
  const w = egCircleOfHall(B.h), L = living(B), total = L.reduce((s, [, m]) => s + m.dc, 0), n = Math.max(1, L.length);
  const earned = egLordsFight(B.F, specOf(B), { co: L }, now), earners = L.filter(([sub]) => EG_SEAM.earned(earned, sub));   // EG-ZK: the seam's earning
  const valk = w % 5 === 0;
  B.rd = w; B.rdAt = now;
  const lone = L.length === 1 && Object.values(B.mem).filter((m) => m.in).length >= 4;
  const gain = B.covenant ? 0 : redoubtGain(B, now);
  if (B.covenant) B.cnt = egCountHold(B.cnt, now);
  // EG-E: the lord's feats, judged at its fall (net/eliteGates/egFeats.js) - said on each earner's receipt with the lord's key
  const lk = specOf(B).lord ?? '', ft = B.F ? egFeatBits(lk, B.F, { covenant: B.covenant, now }) : 0;
  // EG-ZA (section 23's table): each earner's share of the circle's damage (thousandths), its circle's measures (the Court's
  // own trail folded first) and the company
  const co = companyOf(B);
  for (const [sub, m] of earners) {
    measureFold(m, fairOfMember(B, sub));
    owe(B, sub, { q: 'w', w, h: B.h, t: secs(now - B.wk), n: earners.length, ew: B.ew, l: m.lv, vs: (m.vs ?? []).slice(0, 32), fl: m.falls ?? 0, ...(lone ? { lb: 1 } : {}), ...(B.wg?.length ? { wg: B.wg } : {}), ...(lk ? { lk, ft } : {}),
      sh: total > 0 ? Math.max(0, Math.min(EG_SHARE_WHOLE, Math.round((EG_SHARE_WHOLE * m.dc) / total))) : 0, m: measuresOut(m), co });
    m.rel = [...(m.rel ?? []), w];
  }
  for (const m of Object.values(B.mem)) { m.mz = null; if (m.fair) m.fair.mzd = 1; }   // the circle's measures begun again for every member (an earner's said above), no trail of this circle folded into the next
  // EG-E3: THE HERALD'S NEWS - a Valkynaz's Redoubt (the hub says every tenth, the first tenth ever as First of the Spire,
  // and a band passed whose seal a deploy lifted), and a Court felled alone, once a member a breach
  // AUDIT EG V (L8-7): its seconds are from the breach's first wake - Hall 1's only for a breach begun there, so the start (`ew`)
  // rides with them and the post says it. FIELD BUGS 2026-10-20d LONE-HERALD: and the company's size, so a company of one is
  // posted as one ("Mara took Redoubt 20 ... alone"), never as "<name>'s company"
  if (valk) heraldOwe(B, now, { k: 'rd', w, h: B.h, t: secs(now - B.wk), ew: B.ew ?? 0, ...heraldCompany(B), by: earners.map(([, m]) => m.name ?? '') });
  if (lone && !L[0][1].lbSaid) { L[0][1].lbSaid = 1; heraldOwe(B, now, { k: 'lb', n: L[0][1].name ?? '', lk, c: entrants(B).length }); }
  if (valk) B.resp += EG_RESPITE_VALK_MS;
  // AUDIT EG V (L3-3, L8-3; section 16.1 - "an earner, in that circle"): the circle's damage and parts begun again for EVERY
  // member entered - a witness too, or one recalled at this rest would carry the circle it fell in into the next
  for (const m of Object.values(B.mem)) { m.dc = 0; m.act = 0; }
  B.log.push({ h: B.h, rd: w, lord: specOf(B).lord });
  egStratumAt(B, w);   // AUDIT EG IV (lane10 #11): the season's stratum for this Redoubt
  B.F = null;
  B.sg = 'rest'; B.sa = now; B.su = now + EG_RD_WINDOW_MS + EG_REST_MS; B.hw = 0; B.dn = 0;
  B.rdSeq = { recalled: 0, window: 0, valk };
  out.push({ k: 'rd', w, h: B.h, at: now, cl: Math.round(egCountLeft(B.cnt, now)), g: Math.round(gain), v: valk ? 1 : 0, cov: B.covenant ? 1 : 0, ...(dm.length ? { dm } : {}) }, egStageWord(B, now));
}
/** The Redoubt's sequence run on (section 16.2): the recalls, the rest window, the respite and the Ready. */
function restStep(B, now, rng, out) {
  const S = B.rdSeq ?? {};
  if (!S.recalled && now >= B.rdAt + EG_RD_RECALL_MS) {
    S.recalled = 1;
    const spec = specOf(B), c = spec.fight ?? spec.arrive;
    for (const [sub, m] of Object.entries(B.mem)) if (m.in && !m.alive && !m.forsaken && m.recall > 0) recall(B, sub, 1, [c.x, c.z], now, out);
  }
  if (!S.window && now >= B.rdAt + EG_RD_WINDOW_MS) {
    S.window = 1;
    // the rest's heal: whole (half under Ashen Vigil or Hungering Dark, a quarter at Ashen Vigil's rank II)
    const ash = egDecreeRanks(B).ashen ?? 0;
    out.push({ k: 'eheal', p: ash >= 2 ? 0.25 : ash || B.tide === 'hungering' ? 0.5 : 1, why: 'rest' });
    out.push(...egOffers(B, B.rd, S.valk, rng, now));
    if (B.covenant) out.push({ k: 'esay', w: 'covenantrest' });
    else {
      egDecreesAsk(B, egCircleOfHall(B.h) + 1, rng, now, out);
      egAsk(B, 'ready', [1], now, out);
      if (B.resp >= EG_RESPITE_MIN_MS) egAsk(B, 'respite', [1], now, out);
    }
    out.push(egStateOf(B, now));
  }
}
/** The rest over: the next circle's decrees chosen (its tide drawn), its first hall - or the end (nobody stays, or THE
 *  COVENANT'S PATIENCE ends it as the way home). */
function nextCircle(B, now, rng, out) {
  egPicksClose(B);
  const due = egAsksDue(B, now, true);
  if (B.covenant) { egEnd(B, 'home', now, out); return; }
  if (!living(B).length) { egEnd(B, 'gone', now, out); return; }
  const c = egCircleOfHall(B.h) + 1;
  // AUDIT EG V (L2-1; section 14): the decrees the company chose (their asks closed in the rest - asksStep), and any still open
  B.dc = [...(B.next?.c === c ? B.next.dc ?? [] : []), ...egDecreesChosen(B, due)];
  B.bargainDc = [];
  B.tide = egTideOf(c, rng);
  B.h = egFirstHallOf(c);
  B.sg = 'arrive'; B.sa = now; B.pulledAt = now; B.hw = 0; B.dn = 0; B.gatherAt = 0;
  for (const [, m] of living(B)) m.hereH = 0;
  B.su = now + arriveWait(B);   // EG-ZI: the late wake's wait
  out.push(egStageWord(B, now), egStateOf(B, now));
}
/**
 * The company's word answered: the asks whose window closed, each acted on (a Bargain, a respite, the Ready). AUDIT EG V:
 *   - (L2-1; sections 14 and 16.4) THE NEXT CIRCLE'S DECREES - each family's ask closes at its EG_ASK_MS as every ask does
 *     (they once stayed in the record past it and were dropped unread, so no circle bore a decree the company chose): its
 *     choice kept for the next circle (`B.next.dc` - nextCircle) and said on the beacon (the state's `nx`);
 *   - (L3-17; section 6.2: "each yes lengthening the rest") a respite that passes puts the respite again while
 *     EG_RESPITE_MIN_MS of the budget is left, and the Ready with it, so a lengthened rest can still be ended early;
 *   - a Ready and a respite passed in one word: the respite is taken whole, and the rest ends EG_READY_MS after it (the Ready
 *     acted on first, the respite lengthening what it left).
 */
function asksStep(B, now, rng, out) {
  if (!(B.asks ?? []).length) return;
  const due = egAsksDue(B, now).sort((a, b) => (a.q === 'respite' ? 1 : 0) - (b.q === 'respite' ? 1 : 0));
  const dec = due.filter((a) => a.q.startsWith('dec:'));
  if (dec.length && B.next) B.next.dc = [...(B.next.dc ?? []), ...egDecreesChosen(B, dec)];
  let again = false;
  for (const a of due) {
    const yes = egAskResult(a) === 1;
    if (a.q === 'bargain' && yes) {
      const D = egBargainDecree(B, rng);
      if (D) { for (const [sub, y] of Object.entries(a.v)) if (y === 1 && B.mem[sub]?.alive) egGive(B.mem[sub], 'rel', egCircleOfHall(B.h)); out.push({ k: 'esay', w: 'bargain', t: D.name }, egStateOf(B, now)); }
    } else if (a.q === 'respite' && yes && B.sg === 'rest') {
      const add = Math.min(EG_RESPITE_STEP_MS, B.resp);
      B.resp -= add; B.su += add; again = true;
      out.push(egStageWord(B, now), { k: 'esay', w: 'respite', t: String(Math.round(add / 1000)) });
    } else if (a.q === 'ready' && yes && B.sg === 'rest') {
      B.su = Math.min(B.su, now + EG_READY_MS);
      out.push(egStageWord(B, now), { k: 'esay', w: 'ready' });
    }
    out.push({ k: 'asked', q: a.q, r: egAskResult(a, a.q.startsWith('dec:')) });
  }
  if (again) { egAsk(B, 'ready', [1], now, out); if (B.resp >= EG_RESPITE_MIN_MS) egAsk(B, 'respite', [1], now, out); }
  if (dec.length) out.push(egStateOf(B, now));   // the beacon's word: the next circle's decrees chosen
}

/**
 * ONE BEAT of the breach: `bodies` the members' newest fresh poses (`{sub, sx, z, dead, at}` - the Spire's frame:
 * net/superDungeon/sdBrain.js dungeonToRealm's), `rng` a [0,1) source. Moves the record in place; answers the frames to fan, in order.
 * @param {any} B @param {number} now @param {{sub: string, sx: number, z: number, dead: boolean, at?: number}[]} bodies
 * @param {() => number} rng
 */
export function egStep(B, now, bodies, rng) {
  const out = [];
  if (B.end) return out;
  if (now >= B.op + EG_LAST_WORD_MS) { egEnd(B, 'last', now, out); return out; }
  const spec0 = B.h > 0 ? specOf(B) : null;
  for (const b of bodies) {
    const m = B.mem[b.sub];
    if (!m || !m.in || !m.alive || m.home) continue;
    m.seenAt = Math.max(m.seenAt, b.at ?? now);
    if (b.dead) egLayDown(B, b.sub, now, out, spec0 ? local(spec0, b) : null);   // AUDIT WORLD-EVENTS L1-4: down first
  }
  for (const [sub, m] of Object.entries(B.mem)) if (m.down && (now - m.down >= EG_DOWN_MS || !living(B).length)) egFall(B, sub, now, out, null);   // AUDIT WORLD-EVENTS L1-4: the window passed, or nobody left to raise it
  // AUDIT EG III (section 6.1: "Absence on the stair or at a rest never counts"): a trial's absence counts from its wake
  if (B.sg === 'trial') for (const [sub, m] of living(B)) if (now - Math.max(m.seenAt, B.hw) > EG_ABSENT_TRIAL_MS) egFall(B, sub, now, out, null);
  // no living member: a WIPE - or, at a rest, where the way home is the only way out, every member GONE (section 23's `end`)
  if (B.wk && !living(B).length) { egEnd(B, B.sg === 'rest' ? 'gone' : 'wipe', now, out); return out; }
  asksStep(B, now, rng, out);
  const T = egTimes(clockRec(B)), alive = bodies.filter((b) => { const m = B.mem[b.sub]; return m && m.in && m.alive && !m.home && !b.dead; });
  if (B.sg === 'wait') {
    if (now >= B.su) { B.h = egStartHall(B.ew); egStrataTo(B, B.ew); B.sg = 'arrive'; B.sa = now; B.su = T.admitUntil; B.pulledAt = now; out.push(egStageWord(B, now)); }   // EG-F: a deeper start's first hall (section 16.6) - AUDIT EG IV (lane10 #11): with every stratum of the Redoubts it starts past
    return out;
  }
  const spec = specOf(B);
  const inHall = alive.map((b) => local(spec, b)).filter(Boolean);
  for (const b of inHall) B.mem[b.sub].pose = { x: b.x, z: b.z, h: B.h };   // EG-ZR: the hall it stood in (egHymnStep reads none of another)
  mementoStep(B, spec, inHall, now, out);
  // EG-ZI (sections 7 and 21): A LATE WAKE'S `here` - a member the hall woke without says it as it reaches the arrival
  // plate, and its trail is judged from there (unheard, its trail never began: nothing it crossed was judged, and the toll
  // had no fair point of it)
  // AUDIT EG V (c, L3-10): a `here` newly said is told the company (`co` - each screen's gather ring and its count)
  let heard = false;
  if (B.sg === 'trial' || B.sg === 'closing') for (const b of inHall) { const m = B.mem[b.sub]; if (m.hereH !== B.h && m.downH !== B.h && egOnArrive(spec, b.x, b.z, 1.5, b.y)) { m.hereH = B.h; heard = true; } }
  if (B.sg === 'arrive') for (const b of inHall) if (B.mem[b.sub].hereH !== B.h && egOnArrive(spec, b.x, b.z, 1.5, b.y)) { B.mem[b.sub].hereH = B.h; heard = true; }
  if (heard) out.push({ k: 'co', co: egCompanyOf(B) });
  tubeSaid(B, now, out);   // EG-PERFECT: a routed hall's tube falls from the company's arrival at its mouth, said to every screen
  if (B.sg === 'arrive') {
    const L = living(B);
    const all = B.wk ? L.length > 0 && L.every(([, m]) => m.hereH === B.h) : B.co.every((c) => B.mem[c.sub]?.in && B.mem[c.sub].alive && B.mem[c.sub].hereH === B.h);
    if (all && !B.gatherAt) { B.gatherAt = now; B.su = now + EG_GATHER_MS; out.push(egStageWord(B, now)); }
    if (B.gatherAt && now >= B.gatherAt + EG_GATHER_MS) { wake(B, now, rng, out); return out; }
    // AUDIT EG V (L3-13): the open window's end wakes the first hall only when no gather has begun - one begun in it runs its
    // EG_GATHER_MS whole (AUDIT EG III lane2 #18's rule, below, for the breach's first hall too)
    if (!B.wk && !B.gatherAt && now >= T.admitUntil) { if (L.length) wake(B, now, rng, out); else egEnd(B, 'empty', now, out); return out; }
    // EG-ZI (section 7): THE LATE WAKE - the wait the members still owed hold it to, its end said as it moves
    const wait = B.wk ? arriveWait(B) : 0;
    if (B.wk && !B.gatherAt && B.su !== B.pulledAt + wait) { B.su = B.pulledAt + wait; out.push(egStageWord(B, now)); }
    // AUDIT EG III (lane2 #18): the wait wakes a hall whose company is not all here; a gather begun before it ends runs its
    // EG_GATHER_MS whole - so the pull's hold of the count lasts at most the two together, and wants no bound of its own
    if (B.wk && !B.gatherAt && now >= B.pulledAt + wait) { wake(B, now, rng, out); return out; }
    return out;
  }
  if (B.sg === 'rest') { restStep(B, now, rng, out); if (now >= B.su) nextCircle(B, now, rng, out); return out; }
  if (B.sg === 'closing') {
    if (B.cnt.at > 0 && now >= B.dn + EG_CLOSING_COUNT_MS) { B.cnt = egCountHold(B.cnt, now); out.push(egStageWord(B, now)); }
    if (B.cnt.at > 0 && egCountLeft(B.cnt, now) <= 0) { egEnd(B, 'tear', now, out); return out; }
    cacheStep(B, spec, inHall, now, rng, out);
    vaultStep(B, spec, inHall, out);   // AUDIT EG V (lane3 #18): a vault taken in the closing too
    if (B.F) fragStep(B, B.F, spec, now, inHall, inHall, rng, out);   // LAYER THREE: an alcove, a cache, a niche taken in the closing too
    if (spec.fork && forkClosing(B, spec, inHall, now)) out.push(egStageWord(B, now));   // EG-ZC: the Low Road's closing on either road
    goldRun(B, spec, now, out);
    doorWord(B, spec, inHall, out);   // FIELD BUGS 2026-10-20f DOOR-WORD: a step through it refused (egDown) is told why
    const L = living(B);
    if (now >= B.su || (L.length && L.every(([, m]) => m.downH === B.h))) pull(B, now, out);
    return out;
  }
  // THE TRIAL - and THE COVENANT'S PATIENCE: a count spent while a Court's lord is awake does not tear. AUDIT EG IV (lane10 #1):
  // nor once its lords have FALLEN - the beat after the felling blow finds the count spent and no lord awake, and the Redoubt is
  // the trial's to take (paid, no time added under the Covenant); a fall on the very beat the count runs out takes it too
  if (egCountLeft(B.cnt, now) <= 0) {
    if (spec.kind === 'court' && B.F && (egLordsFell(B.F) || egLordsAwake(B.F))) { if (!egLordsFell(B.F) && !B.covenant) { B.covenant = 1; out.push({ k: 'esay', w: 'covenant' }); } }
    else { egEnd(B, 'tear', now, out); return out; }
  }
  trial(B, spec, now, inHall, rng, out);
  return out;
}

/** THE GOLD RUN (section 8.2): every living member across a span before the closing's fifteenth second - a minute more on
 *  the count, past the cap toward a Surplus. A company of one is exempt. */
function goldRun(B, spec, now, out) {
  if (B.gold || !(spec.kind === 'span' || spec.kind === 'deepway' || spec.kind === 'brink')) return;
  const L = living(B);
  if (L.length < 2 || now > B.dn + EG_CLOSING_COUNT_MS) return;
  if (!L.every(([, m]) => m.downH === B.h || m.atEndH === B.h)) return;
  B.gold = 1;
  const want = egCountLeft(B.cnt, now) + EG_GOLD_RUN_MS;
  surplusBank(B, egCountOver(B.cnt, now, EG_GOLD_RUN_MS));
  B.cnt = { left: Math.min(want, EG_COUNT_CAP_MS), at: B.cnt.at > 0 ? now : 0 };
  out.push(egStageWord(B, now), { k: 'esay', w: 'goldrun' });
}
/** THE CACHE on the end plate (section 17.1): each member who touches it during the closing takes one - a Kyn Mimic's
 *  one in eight a Lurker instead. */
function cacheStep(B, spec, inHall, now, rng, out) {
  const C = B.cache, at = spec.spots.cache?.[0];
  if (!C || !at || C.lost) return;
  for (const b of inHall) {
    const m = B.mem[b.sub];
    if (!m || C.took[b.sub] || dist(b.x, b.z, at.x, at.z) > EG_TOUCH_M || !fairOf(B, b.sub)) continue;   // EG-H1: a fair trail's
    if (b.x != null) m.atEndH = B.h;
    if (C.mimic) { C.mimic = 0; C.lost = 1; if (!B.F) B.F = egFightNew(spec, now, living(B).map(([, x]) => x.lv)); const [lk] = egLegionRaise(B.F, [EG_KIND.lurker], [[at.x, at.z]], now, out); if (lk) egSetFl(B.F, lk, EG_FL.dormant, false, out); out.push({ k: 'esay', w: 'mimic' }); return; }
    C.took[b.sub] = 1;
    egGive(m, C.k, 1, rng);
    out.push({ k: 'egot', to: b.sub, w: C.k }, { k: 'run', r: egRunOf(b.sub, m) });
  }
}
/** THE MEMENTOS (section 16.5): carried by a living member who passes within 2 m; set at a Battlemage's niche, the
 *  fallen is called back at half their health. */
function mementoStep(B, spec, inHall, now, out) {
  if (!B.mementos.length) return;
  const niches = (spec.spots.niche ?? []).map((q) => [q.x, q.z]);
  for (const q of B.mementos) {
    if (!q.by) {
      if (q.h !== B.h) continue;
      const c = inHall.find((b) => dist(b.x, b.z, q.x, q.z) <= EG_MEMENTO_REACH && fairOf(B, b.sub));   // EG-H1: carried on a fair trail
      if (c) { q.by = c.sub; out.push({ k: 'esay', w: 'memento', n: memberName(B, c.sub), t: memberName(B, q.s) }, egStateOf(B, now)); }
      continue;
    }
    const c = inHall.find((b) => b.sub === q.by);
    if (!c) continue;
    q.x = c.x; q.z = c.z; q.h = B.h;
    const niche = niches.find(([x, z]) => dist(c.x, c.z, x, z) <= EG_MEMENTO_REACH + 0.5);
    if (niche && fairOf(B, q.by)) recall(B, q.s, EG_MEMENTO_PCT, [niche[0], niche[1] + 1.5], now, out);
  }
}

/** The trial's beat, by the hall's kind. `inHall` the living members standing in the hall (its own frame). */
function trial(B, spec, now, inHall, rng, out) {
  const F = B.F;
  if (!F) return;
  egCarry(F, now);
  // EG-ZB (sections 8.2 and 11.7): THE FIGHT GROUND (net/eliteGates/egWalkGraph.js egFightView) - a span's islands and plates beside its
  // passages' floors, a Rampart's pillars and winch plates beside its walkway. On a span a member is aimed at only standing
  // on it (traversal ground is never aimed at); elsewhere within the fight's old 4 m.
  const view = egFightView(spec), span = spec.kind === 'span';
  const here = span ? inHall.filter((b) => egGroundAt(view, b.x, b.y, b.z, EG_SPAN_GROUND_PAD_M)) : inHall.filter((b) => egOnFight(view, b.x, b.z, 4, b.y));   // THE ASCENT: on a fight floor by its feet
  const D = F.D ?? {};
  // A WAVE POURED within THE LEGION'S CAP (section 8.1 - AUDIT EG III: the room under it read live, egLegionRoom, so the
  // beat's every wave takes its room from what is left, never the whole): a rift's (`src`, its key) whose wave would pass the
  // cap HOLDS IT, and its next wave is one body larger (once, however long it held - `F.mem.grow`); any other wave pours what
  // the room holds of it
  const wave = (spots, k = egWaveSize(F.n), src = null, only = null) => {
    if (!spots.length) return [];
    const grow = (F.mem.grow ??= {}), size = k + (src != null && grow[src] ? 1 : 0), room = egLegionRoom(F);
    if (src != null) {
      if (room < Math.min(size + (D.swarm ?? 0), egLegionCapOf(F))) { grow[src] = 1; return []; }
      delete grow[src];
    }
    if (Math.min(size, room) <= 0) return [];
    F.waveNo = (F.waveNo ?? 0) + 1;
    const kinds = egWaveKinds(F, rng, size, { swarm: D.swarm ?? 0, waveNo: F.waveNo, sky: !spec.chamber, room, only });   // AUDIT EG V (L3-20): `only` one kind's wave
    return egLegionRaise(F, kinds, spots, now, out, { wave: F.waveNo });
  };
  fragStep(B, F, spec, now, inHall, here, rng, out);
  errandStep(B, F, spec, now, inHall);   // AUDIT EG III (lane2 #3): an errand's mark stood in - a hall's part (section 16.1)
  // EG-ZQ (section 13.2): THE SEEN-AND-RESTORE STEP - every living member in the hall joins the lords through the seam, its
  // share in each lord's health: one the hall or its lords did not wake with brings it, a recalled one's comes back. The fallen
  // are never seen here - FIELD BUGS 2026-10-19e LORD-SHARES: a lord awake kept their shares at the fall (egFall), one asleep let
  // them go; stood for the company on the plate (net/eliteGates/egLords.js egLordsStand), it wakes for the company standing
  if (egLordsOf(F).length) { const lf = egLordsFight(F, spec, {}, now); for (const b of inHall) { const mm = B.mem[b.sub]; EG_SEAM.join(lf, b.sub, mm.name, mm.lv, now, null, { admits: mm.alive && mm.in && !mm.home }); } }
  const lordCtx = { decrees: D, n: F.n, covenant: B.covenant, nums: Object.fromEntries(B.co.map((c) => [c.sub, c.n])) };   // AUDIT EG IV (lane1 #15): the company's numerals, its errands given by them
  const legionCtx = {
    decrees: D,
    anchor: spec.kind === 'court' ? (() => { const L0 = egLordsOf(F)[0]; return L0 ? [L0.x, L0.z] : null; })() : null,
    fadeOf: (sub, t) => (B.mem[sub]?.fadeUntil ?? 0) > t,
    pool: poolTo(F, out),
    rally: F.rally,
    sapGoal: (a) => sapperGoal(F, spec, a),
    sapAt: (a) => sapperReach(F, spec, a, now, out),
    ghostHit: (g, t) => { t.hp -= Math.max(1, F.mean * 1.5); if (t.hp <= 0) { egGone(F, [t], EG_GONE.slain, "A Battlemage's Ghost", now, out); egAddSlain(F, spec, t, null, now, here, out, legionCtx); } },
    deserterGoal: () => { if (F.await != null) return null;   // (THE AUDIT: no rift closed for the company while its trial awaits it)
      const r = egObjsOf(F, 'rift').filter((o) => o.hp > 0 && !egHas(o, EG_FL.ward)); return r[0] ? [r[0].x, r[0].z] : null; },
    deserterHit: () => { const r = egObjsOf(F, 'rift').filter((o) => o.hp > 0 && !egHas(o, EG_FL.ward))[0]; if (r) { r.hp -= F.mean * 2; if (r.hp <= 0) { r.hp = 0; F.desClosed = (F.desClosed ?? 0) + 1; riftClosed(B, F, spec, r, 'The Deserter', now, out); } } },
  };
  // EG-H2 (Elite-Gates.md section 22): the beat's own closures ride the fight unenumerated - a record that carried them
  // could not be structured-cloned, so every trial's checkpoint threw and storage kept the hall as it woke
  Object.defineProperty(F, 'legionCtx', { value: legionCtx, enumerable: false, writable: true, configurable: true });
  // the Span, the Brink: the door opens on the first living member at the far plate; a fragment's Lurkers and the Low
  // Road's foes at their work meanwhile
  vaultStep(B, spec, inHall, out);   // AUDIT EG V (lane3 #18): every kind's vault, a Proving Walk's too
  if (spec.kind === 'span' || spec.kind === 'brink') {
    // EG-ZB (section 8.2): THE SPAN'S LEGION - the Harriers shadow every member in the hall and bite only those on its fight
    // ground; from the Shade the Divers wait at its islands
    if (span) spanLegion(F, view, now, inHall, egLegionRoom(F), out);
    if (egBodiesOf(F, EG_ROLE.add).length) egLegionStep(F, view, now, here, rng, out, span ? { ...legionCtx, span: 1, shadow: inHall, isles: view.fl.filter((f) => f.g === 'island' || f.g === 'plate') } : legionCtx);
    captiveStep(B, F, rng, out);   // AUDIT EG V (L3-19): a span's Captive freed
    const first = doorOpener(B, spec, inHall);
    if (first) door(B, spec, now, out, inHall, first.sub);   // EG-H1: a fair arrival opens it (section 21) - AUDIT EG V (h): and is named, THE TRAIL's
    else doorWord(B, spec, inHall, out);   // FIELD BUGS 2026-10-20f DOOR-WORD: an arrival it will not take is told why
    if (span) { egBlowsStep(F, view, now, here, out, egWatchOf(B)); fightTail(F, now, out); }
    else egMovesOut(F, out);
    return;
  }
  // EG-PERFECT - THE BROKEN WAY (spec law 10): its clocks held, beat by beat, until the first member stands on its fight ground
  if (F.await != null) {
    if ((spec.kind === 'scriptorium' ? inHall.filter((b) => egOnTrialGround(spec, b)) : here).length) delete F.await;
    else { const dt = now - F.await; F.await = now; for (const k of EG_AWAIT_CLOCKS) if (F[k] > 0) F[k] += dt; }
  }
  const kind = spec.kind, v = spec.variant;
  if (kind === 'yard' || (kind === 'deepway' && F.chamber === 0)) {
    const rifts = egObjsOf(F, 'rift');
    if (v === 'wellspring') {
      const spring = rifts.find((o) => o.great);
      const anchors = egObjsOf(F, 'anchor');
      if (spring) egSetFl(F, spring, EG_FL.ward, anchors.length > 0, out);
      F.pg.anchors = anchors.length;
      if (!spring) { door(B, spec, now, out); return; }
      if (now >= F.waveAt) {
        F.waveAt = now + egWaveEveryMs(F.c); wave(ringSpots(spec, spring.x, spring.z, 3, egWaveSize(F.n), rng, spring.y), egWaveSize(F.n), spring.i);
        // AUDIT EG V (L2-8; sections 8.1 and 12): a Sapper walks from the great rift to a broken anchor to relight it at a third
        // (sapperGoal, sapperReach), within the cap - as a Yard's walks to its closed rift
        if (F.brokenAnchors?.length && egLegionRoom(F) > 0) egLegionRaise(F, [EG_KIND.sapper], [[spring.x, spring.z]], now, out, { wave: F.waveNo });
      }
    } else if (v === 'muster') {
      const std = egBodiesOf(F, EG_ROLE.add, EG_KIND.standard)[0];
      if (!std) { door(B, spec, now, out); return; }
      if (now >= F.waveAt) { F.waveAt = now + egWaveEveryMs(F.c); for (const p of F.rally ?? []) wave([p], Math.ceil(egWaveSize(F.n) / 2)); }
    } else if (v === 'holdfast') {
      const relic = egObjsOf(F, 'relic')[0];
      const onIt = relic && here.some((b) => dist(b.x, b.z, relic.x, relic.z) <= (relic.r ?? 6));
      if (onIt) F.holdMs += 250;
      for (const a of egBodiesOf(F, EG_ROLE.add)) if (relic && !egHas(a, EG_FL.friend) && dist(a.x, a.z, relic.x, relic.z) <= 2.5) { egGone(F, [a], EG_GONE.fed, '', now, out); F.relic -= 4; }
      if (F.relic <= 0 && relic) {
        F.relic = EG_RELIC_MAX; F.holdMs = Math.floor(F.holdMs / 2);
        for (const q of spec.rifts.slice(3, 5)) { if (F.riftSpots.length >= 5) break; F.riftSpots.push(q); const o = egRaiseObj(F, 'rift', q.x, q.z, 1, now, out, { r: 1.3 }); egSetFl(F, o, EG_FL.ward, true, out); }
        out.push({ k: 'esay', w: 'relicbroken' });
      }
      F.pg.hold = Math.min(F.holdNeed, F.holdMs); F.pg.relic = F.relic;
      if (F.holdMs >= F.holdNeed) { door(B, spec, now, out); return; }
      if (now >= F.waveAt) { F.waveAt = now + egWaveEveryMs(F.c); for (const [j, q] of F.riftSpots.entries()) wave([[q.x, q.z]], Math.ceil(egWaveSize(F.n) / 2), `h${j}`); }
    } else {
      const standing = rifts.filter((o) => o.hp > 0);
      F.pg.rifts = [standing.length, rifts.length + (F.closed ?? 0)];
      if (!standing.length) {
        if (spec.twist === 'deserter' && (F.desClosed ?? 0) >= (F.coClosed ?? 0) && B.cache) { B.cache.lost = 1; out.push({ k: 'esay', w: 'desertertook' }); }
        else if (spec.twist === 'deserter') for (const [sub, m] of living(B)) { egGive(m, 'shard', 1, rng); out.push({ k: 'egot', to: sub, w: 'shard' }); }
        if (kind === 'deepway') F.chamberDone = 1; else { door(B, spec, now, out); return; }
      }
      if (F.wander && now >= F.wanderAt) {
        F.wanderAt = now + 20_000;
        for (const [j, o] of standing.entries()) { const socks = (spec.spots.socket ?? []).filter((s) => s.k === j); const to = socks[Math.floor(rng() * socks.length)]; if (to) egWalk(F, o, to.x, to.z, 0, 2.0, now, spec, 0, true); }
      }
      if (now >= F.waveAt && standing.length) {
        F.waveAt = now + egWaveEveryMs(F.c);
        for (const q of standing) { const toward = Math.atan2(spec.fight.x - q.x, spec.fight.z - q.z), k = Math.max(1, Math.ceil(egWaveSize(F.n) / 2)), spots = []; for (let i = 0; i < k; i++) { const a = toward + (i - (k - 1) / 2) * 0.6; spots.push([q.x + Math.sin(a) * 2.2, q.z + Math.cos(a) * 2.2]); } wave(spots, k, q.i); }
        // a Sapper walks to a closed rift to open it again
        if (F.closedSpots?.length && egLegionRoom(F) > 0) { const [s] = egLegionRaise(F, [EG_KIND.sapper], [[standing[0].x, standing[0].z]], now, out, { wave: F.waveNo }); if (s) s.goal = nearestClosed(F, s); }   // AUDIT EG IV (lane1 #27): the nearest closed rift
      }
    }
  } else if (kind === 'rampart') {
    if (v === 'gauntlet') {
      for (const g of F.gauntlet) {
        if (g.done) continue;
        // GAUNTLET-SLAIN (Field-Bugs-2026-10-19d): a Caster slain is a Caster silenced - its pillar was held open for the plate
        // alone, which no screen marks, and a company that killed every Caster stood in a hall whose door would not give
        if (g.i && !egBodyById(F, g.i)) { g.done = 1; out.push({ k: 'esay', w: 'silenced' }); continue; }
        const pl = g.p.plate, on = pl && here.concat(inHall).some((b) => dist(b.x, b.z, pl[0], pl[1]) <= EG_TOUCH_M);
        if (on) { g.stood = g.stood ? g.stood : now; if (now - g.stood >= EG_SILENCE_MS) { g.done = 1; const c = egBodyById(F, g.i); if (c) egGone(F, [c], EG_GONE.crumbled, '', now, out); out.push({ k: 'esay', w: 'silenced' }); } } else g.stood = 0;
      }
      F.pg.left = F.gauntlet.filter((g) => !g.done).length;
      // FIELD BUGS 2026-10-19f GAUNTLET-PLATES (section 8.3): and plate by plate, in `spots.pillar`'s order, whether its Caster is
      // silenced (1) - by its plate held or its death (GAUNTLET-SLAIN, above) - so the screen marks the plates still to hold
      // and dims a silenced one (scenes/eliteGates/egFight.js gauntletPlates).
      F.pg.silenced = F.gauntlet.map((g) => g.done);
      if (!F.pg.left) { door(B, spec, now, out); return; }
    } else if (v === 'winch') {
      const plates = spec.spots.winch ?? [], need = Math.min(2, living(B).length);   // AUDIT EG V (L3-2; section 8.3): `n` the living company now, never the wake's
      const on = inHall.filter((b) => plates.some((p) => dist(b.x, b.z, p.x, p.z) <= EG_TOUCH_M)).length;
      if (on >= need) F.winch += 250;
      F.pg.winch = Math.min(EG_WINCH_MS, F.winch);
      if (F.winch >= EG_WINCH_MS) { door(B, spec, now, out); return; }
    } else {
      const bearers = egBodiesOf(F, EG_ROLE.add, EG_KIND.bearer);
      if (!bearers.length) { door(B, spec, now, out); return; }
      // AUDIT EG IV (lane10 #17; section 8.3) - THE MARCH HOLDS THE GATE: while any of the march stands within EG_GATE_HOLD_M of the
      // portcullis its Ward-Bearers are warded, so a company that runs the walkway past the march breaks it at the gate first
      const gx = (spec.gate.bearers ?? []).reduce((a, q, j, all) => a + q.x / all.length, 0), held = egBodiesOf(F, EG_ROLE.add).some((a) => a.march && dist(a.x, a.z, gx, spec.gate.z) <= EG_GATE_HOLD_M);
      for (const b of bearers) egSetFl(F, b, EG_FL.ward, held, out);
      if (held && !F.gateSaid) { F.gateSaid = 1; out.push({ k: 'esay', w: 'gateheld' }); }
    }
    if (v !== 'gauntlet' && now >= F.waveAt) {
      F.waveAt = now + EG_MARCH_EVERY_MS;
      const k = egWaveSize(F.n), spots = [];
      for (let i = 0; i < k; i++) spots.push([(i - (k - 1) / 2) * 1.4, spec.gate.z - 8 - (i % 2) * 1.5]);
      for (const a of wave(spots, k)) a.march = 1;   // AUDIT EG IV (lane10 #17): the march (never a bastion's Breaker or a pinned Caster)
      // a Breaker across from a bastion's side
      const bast = spec.discs.filter((d) => d.role === 'bastion');
      if (bast.length && egLegionRoom(F) > 0) { const d = bast[Math.floor(rng() * bast.length)]; egLegionRaise(F, [EG_KIND.breaker], [[d.x, d.z]], now, out, { wave: F.waveNo }); }
    }
  } else if (kind === 'athenaeum') {
    F.pg.st = [...F.lock.st]; F.pg.f = F.lock.f; F.pg.lit = F.lock.lit ?? 0;
    if (F.lock.ok) {
      if (F.turns <= F.best) { for (const [, m] of living(B)) m.athFree = 1; out.push({ k: 'esay', w: 'orrerytrue' }); }
      door(B, spec, now, out); return;
    }
    // AUDIT EG V (L3-20; section 8.4): the lock's pressure is `ceil(n/4)` HARRIERS (Swarm-Mother's Binder beside them)
    if (now >= F.waveAt) { F.waveAt = now + EG_LOCK_EVERY_MS; const k = Math.ceil(F.n / 4); wave(ringSpots(spec, spec.fight.x, spec.fight.z, spec.fight.r - 3, k, rng), k, null, EG_KIND.harrier); }
  } else if (kind === 'proving' || (kind === 'deepway' && F.chamber === 1)) {
    if (F.escortAt > 0 && now >= F.escortAt) { F.escortAt = 0; provingEscort(F, spec, rng, now, out); }   // AUDIT EG V (L2-6): the escort Stillness held
    if (egLordsFell(F)) { if (kind === 'deepway') F.chamberDone = 1; else { door(B, spec, now, out); return; } }
    else if (!egLordsAwake(F)) ringWake(F, spec, champRing(spec), inHall, now, out, lordCtx);   // AUDIT EG IV (lane1 #11; section 8.5): it wakes at its court's ring
  } else if (kind === 'deepway' && F.chamber === 2) {
    const e = egObjsOf(F, 'engine')[0];
    if (e && here.some((b) => dist(b.x, b.z, e.x, e.z) <= 3)) F.engineHeld += 250;
    F.pg.hold = Math.min(EG_ENGINE_HOLD_MS, F.engineHeld);
    if (F.engineHeld >= EG_ENGINE_HOLD_MS) F.chamberDone = 1;
    if (!F.chamberDone && now >= F.waveAt && e) { F.waveAt = now + egWaveEveryMs(F.c); wave(ringSpots(spec, e.x, e.z, 10, egWaveSize(F.n), rng, spotY(spec, e))); }
  } else if (kind === 'scriptorium') {
    F.pg.quiet = Math.max(0, F.quietUntil - now);
    if (now >= F.quietUntil) { door(B, spec, now, out); return; }
  } else if (kind === 'court') {
    const lords = egLordsOf(F);
    egZonesKeep(F, now, out);   // AUDIT EG V: THE MOLTEN RIM stood again where the fight's last zones pushed it out - (h) and every zone laid to the fight's end (net/eliteGates/egLords.js egZonesKeep)
    if (egLordsFell(F)) { redoubt(B, now, rng, out); return; }
    if (!egLordsAwake(F)) {
      if (ringWake(F, spec, spec.ring, inHall, now, out, lordCtx)) { F.waveAt = now + EG_ESCORT_EVERY_MS + (F.still ?? 0); F.lordAt = now; }   // AUDIT EG V (L2-6): Stillness holds the first escort
    } else {
      if (now >= F.waveAt) {
        F.waveAt = now + EG_ESCORT_EVERY_MS;
        const L0 = lords[0];
        if (L0) {
          wave(ringSpots(spec, L0.x, L0.z, 12, egWaveSize(F.n), rng, L0.y));
          // a Sapper for the lord - none in its first phase under Severance
          if (!(F.sever && L0.ph === 1) && egLegionRoom(F) > 0) { const [s] = egLegionRaise(F, [EG_KIND.sapper], ringSpots(spec, L0.x, L0.z, 16, 1, rng, L0.y), now, out, { wave: F.waveNo }); if (s) s.lordGoal = L0.i; }
        }
      }
    }
    const said0 = out.length;
    out.push(...EG_SEAM.step(egLordsFight(F, spec, lordCtx, now), now, here, rng));   // EG-ZK: the lords' beat, through the seam
    tallySays(F, out, said0);
    rallyingCry(B, F, out, said0, now);   // AUDIT EG IV (lane10 #14): Fellowship's capstone at a Court's phase turn
  }
  if (kind !== 'court' && egLordsOf(F).length) out.push(...EG_SEAM.step(egLordsFight(F, spec, lordCtx, now), now, here, rng));
  if (kind === 'deepway' && F.chamberDone && !F.saidDone) { F.saidDone = 1; out.push({ k: 'esay', w: 'chamberdone' }); }
  if (kind === 'deepway' && F.chamberDone && doorOpener(B, spec, inHall)) { door(B, spec, now, out); return; }   // EG-H1: a fair arrival
  if (kind === 'deepway' && F.chamberDone) doorWord(B, spec, inHall, out);   // FIELD BUGS 2026-10-20f DOOR-WORD
  captiveStep(B, F, rng, out);
  hazards(B, F, spec, now, here, rng, out);
  legionCtx.hunted = huntStep(B, F, view, spec, now, inHall, out);   // EG-ZB (section 11.7): off the floors past six seconds, hunted
  egLegionStep(F, view, now, here, rng, out, legionCtx);
  egBlowsStep(F, view, now, here, out, egWatchOf(B));   // EG-H1: Watchfire's company told each committed blow early
  // the census: where a landing found a member's pose (section 21's measure - the struck member's own machine resolves it)
  for (const bl of F.blows) {
    if (bl.counted || now < bl.at) continue;
    bl.counted = 1;
    for (const m of egStruck(bl, here)) { const mm = B.mem[m.sub]; if (mm) mm.struck = (mm.struck ?? 0) + 1; }
    // AUDIT EG III - COUNTERSTROKE ARMED (section 15: "after one of its blows lands within 6 m of you"): every member on the
    // floor within EG_COUNTER_M of a lord's blow as it landed, struck or not
    if (bl.o && egLordsOf(F).some((L) => L.i === bl.o)) for (const m of here) if (B.mem[m.sub] && egBlowNear(bl, m.x, m.z) <= EG_COUNTER_M) B.mem[m.sub].lordLandedAt = bl.at;
  }
  fightTail(F, now, out);
}
/**
 * THE WAKE RING (section 8.6): the fight's lords wake when every living member in the hall (`inHall`) stands inside `ring`, or
 * EG_WAKE_RING_MS after the first does - the fastest member never meets a lord alone. Answers whether they woke. AUDIT EG IV
 * (lane1 #11): the Court's, and a champion's at its own court's ring (champRing).
 */
function ringWake(F, spec, ring, inHall, now, out, ctx) {
  const H = egByHeight(spec) && Number.isFinite(ring.y) ? ring.y : NaN;   // THE ASCENT (Elite-Gates-Ascent.md section 2): the ring's own floor
  const inRing = inHall.filter((b) => dist(b.x, b.z, ring.x, ring.z) <= ring.r && (!Number.isFinite(H) || egBears(H, egFeetY(spec, b.y))));
  if (inRing.length && !F.ringAt) F.ringAt = now;
  if (!((inRing.length && inRing.length === inHall.length) || (F.ringAt && now >= F.ringAt + EG_WAKE_RING_MS))) return false;
  egLordsWake(F, spec, now, out, ctx);
  return true;
}
/**
 * AUDIT EG IV (lane1 #11; sections 8.5 and 8.6) - A CHAMPION'S WAKE RING, the Court's law at its own court (a spec carries a
 * Court's `ring` alone, and the hall's law is unchanged): about the proving court's heart (the floor disc its champion stands
 * on) or a Deepway champion chamber's (its chamber spot), 1 m inside that floor's edge as the Court's ring is (`{ x, z, r }`).
 * @param {any} spec
 */
export function champRing(spec) {
  const ch = spec.kind === 'deepway' ? spec.spots?.chamber?.[0] : null, fx = ch?.x ?? spec.foe?.x ?? 0, fz = ch?.z ?? spec.foe?.z ?? 0;
  // THE ASCENT (Elite-Gates-Ascent.md section 2): the floor under its spot at the spot's own height, where the law says one
  const fy = egFeetY(spec, ch ? spotY(spec, ch) : spec.foe?.y), f = Number.isFinite(fy) ? egFightPieceAt(spec, fx, fz, 0, fy) : (spec.fl ?? []).find((q) => egPieceIn(q, fx, fz));
  const [x, z] = f?.t === 'd' && !ch ? [f.x, f.z] : [fx, fz];
  const edge = !f ? EG_CHAMP_RING_M + 1 : f.t === 'd' ? f.r - Math.hypot(x - f.x, z - f.z) : f.t === 'p' ? egPolyEdgeDist(f.poly, x, z) : f.hw;
  return Number.isFinite(fy) ? { x, z, r: Math.max(EG_CHAMP_RING_MIN_M, edge - 1), y: f?.y ?? fy } : { x, z, r: Math.max(EG_CHAMP_RING_MIN_M, edge - 1) };
}
/** AUDIT EG IV (lane1 #11): a champion's ring where no floor holds its spot (m), and the least a ring is. */
export const EG_CHAMP_RING_M = 13;
export const EG_CHAMP_RING_MIN_M = 4;
/** The fight's words a beat ends with: the walks, the health, the tethers and marks that moved, the whole fight now and then. */
function fightTail(F, now, out) {
  egMovesOut(F, out);
  egHpOut(F, now, out);
  if (F.mem.txDirty) { F.mem.txDirty = 0; egTethersOut(F, out); }
  if (F.mem.mkDirty) { F.mem.mkDirty = 0; egMarksOut(F, out); }
  if (now - F.stateAt >= EG_STATE_EVERY_MS) { F.stateAt = now; out.push(EG_SEAM.stateOf(egLordsFight(F, null, {}, now))); }
}
/**
 * EG-ZB (section 8.2): THE SPAN'S LEGION - Harriers shadow the company along the course and, from the Shade, Divers wait at
 * its islands: a wave every egWaveEveryMs(c) (and Hunting Pack's on its own clock - section 14) of egWaveSize(n), within the
 * legion's cap (`cap`, the room left under it). The Harriers rise in the air beside the members in turn, EG_SHADOW_SIDE_M
 * out and EG_SHADOW_AHEAD_M ahead (kept out of a passage's rock); from the Shade every other wave is led at half by Divers
 * over the island (or plate) the leading member stands on or comes to next (net/eliteGates/egLegion.js egIsleAhead). No die is drawn: a span's legion keeps the breach's rolls where they were.
 * THE ASCENT (LAW 9): "ahead" and "leading" are along THE ROUTE (net/eliteGates/egRoute.js) - the member furthest along it leads, and a
 * Harrier rises ahead along its member's way and beside it (laws 4-8: +z and +-x, as ever).
 */
const _ahead = [0, 0];   // egRouteAhead's answer, read at once
function spanLegion(F, view, now, inHall, cap, out) {
  if (!inHall.length) return;
  const D = F.D ?? {};
  let due = 0, room = cap;
  if (now >= F.waveAt) { F.waveAt = now + egWaveEveryMs(F.c); due++; }
  if (D.pack && now >= F.packAt) { F.packAt = now + (D.pack >= 2 ? 20_000 : 30_000); due++; }
  const isles = view.fl.filter((f) => f.g === 'island' || f.g === 'plate');
  for (; due > 0; due--) {
    const n = Math.min(egWaveSize(F.n), room);
    if (n <= 0) return;
    room -= n;
    F.waveNo = (F.waveNo ?? 0) + 1;
    let la = egRouteAlong(view, inHall[0]);   // THE ASCENT: the member furthest along the route leads, its island ahead along it
    for (const q of inHall) la = Math.max(la, egRouteAlong(view, q));
    const isle = egIsleAhead(isles, la, view);
    const divers = F.band >= 2 && isle && F.waveNo % 2 === 1 ? Math.ceil(n / 2) : 0;
    const kinds = [], spots = [];
    for (let j = 0; j < n; j++) {
      if (j < divers) { const a = (j / divers) * Math.PI * 2; kinds.push(EG_KIND.diver); spots.push([...egAirKeep(view, isle.x + Math.sin(a) * EG_DIVER_WAIT_R, isle.z + Math.cos(a) * EG_DIVER_WAIT_R), isle.y ?? 0]); continue; }
      const m = inHall[j % inHall.length], s = j % 2 ? 1 : -1;
      const [hx, hz] = egRouteAhead(view, m, EG_SHADOW_AHEAD_M, s * EG_SHADOW_SIDE_M, _ahead);   // THE ASCENT: ahead along the route, beside it
      kinds.push(EG_KIND.harrier); spots.push([...egAirKeep(view, hx, hz), egAirY(view, m, {})]);   // EG-ZJ: risen at their member's height (the Divers at the island's)
    }
    egLegionRaise(F, kinds, spots, now, out, { wave: F.waveNo });
  }
}
/**
 * EG-ZB (section 11.7): THE HUNT - in a hall whose trial is one fight on its floor (EG_HUNT_KINDS), a member who has stood on
 * its fight ground this hall and is off it (net/eliteGates/egWalkGraph.js egGroundAt, EG_STRIKE_PAD_M - by its feet's height where its
 * pose says one: a member up on an arch's wall over the floor stands on none) for more than EG_HUNT_AFTER_MS is HUNTED:
 * marked (7, Hunted - EG_HUNT_MARK_MS at a time, unmarked back on the floor), first in every Harrier's mind
 * (net/eliteGates/egLegion.js), and where no Harrier stands a pair (EG_HUNT_RAISE) rises at the floor's edge nearest them, within the
 * legion's cap, once a hunt. Answers the hunted (`{sub, x, z, y?}`, the hall's frame).
 */
function huntStep(B, F, view, spec, now, inHall, out) {
  const hunted = [];
  if (!EG_HUNT_KINDS.includes(spec.kind)) return hunted;
  for (const b of inHall) {
    const m = B.mem[b.sub];
    if (!m) continue;
    if (egGroundAt(view, b.x, b.y, b.z, EG_STRIKE_PAD_M)) {
      m.flH = B.h; m.offAt = 0;
      if (egMarkOf(F, b.sub, 7)) { egUnmark(F, b.sub, 7); F.mem.mkDirty = 1; }
      if (F.hunt) delete F.hunt[b.sub];
      continue;
    }
    if (m.flH !== B.h) continue;   // not in the fight yet - an approach still being crossed
    if (!m.offAt) m.offAt = now;
    if (now - m.offAt <= EG_HUNT_AFTER_MS) continue;
    hunted.push(b);
    const mk = egMarkOf(F, b.sub, 7);
    if (!mk || mk[2] <= now) { egMark(F, b.sub, 7, now + EG_HUNT_MARK_MS); F.mem.mkDirty = 1; }
    if ((F.hunt ??= {})[b.sub]) continue;
    F.hunt[b.sub] = now;
    const stand = egBodiesOf(F, EG_ROLE.add).filter((a) => !egHas(a, EG_FL.friend));
    const room = egLegionRoom(F);
    if (stand.some((a) => a.k === EG_KIND.harrier) || room <= 0) continue;
    egLegionRaise(F, Array(Math.min(EG_HUNT_RAISE, room)).fill(EG_KIND.harrier), [egKeepOnFight(view, b.x, b.z, 1, b.y)], now, out, { wave: 0 });   // THE ASCENT: at its own storey's edge
  }
  return hunted;
}
/** The hall's own hazards under the decrees: Ashfall's meteors, Wellhead Sparks, Hunting Pack's waves, Soul-Pools' heal,
 *  the Wellhead Erupts' vents. */
function hazards(B, F, spec, now, here, rng, out) {
  const D = F.D ?? {};
  if (D.ashfall && now >= F.ashAt && here.length) {
    F.ashAt = now + (D.ashfall >= 2 ? 8000 : 12_000);
    const m = here[Math.floor(rng() * here.length)];
    egAim(F, spec, { o: 0, s: [shDisc(m.x, m.z, 4)], at: now + 1800, wu: 1800, p: 0.15, b: 4, el: 'fire', nm: 'Ashfall', y: m.y }, here, now, out);
  }
  if (D.sparks && spec.fight && now >= F.sparkAt) {   // AUDIT EG III: a hall with no fight floor (the Scriptorium) raises none
    F.sparkAt = now + 20_000;
    const k = D.sparks >= 2 ? F.n : Math.ceil(F.n / 2);
    for (const [x, z] of ringSpots(spec, spec.fight.x, spec.fight.z, spec.fight.r * 0.6, k, rng)) { const o = egRaiseObj(F, 'spark', x, z, 1, now, out, { r: 0.6 }); if (o) o.burst = now + 8000; }
  }
  for (const o of egObjsOf(F, 'spark')) if (now >= o.burst) { egGone(F, [o], EG_GONE.crumbled, '', now, out); egAim(F, spec, { o: 0, s: [shDisc(o.x, o.z, 2.5)], at: now + 1200, wu: 1200, p: 0.15, b: 4, el: 'shock', nm: 'Spark', y: o.y }, here, now, out); }
  if (D.pack && now >= F.packAt && spec.fight) {
    F.packAt = now + (D.pack >= 2 ? 20_000 : 30_000);
    const spots = ringSpots(spec, spec.fight.x, spec.fight.z, spec.fight.r - 2, egWaveSize(F.n), rng).slice(0, egLegionRoom(F));   // AUDIT EG III: within the legion's cap
    if (spots.length) egLegionRaise(F, spots.map(() => EG_KIND.harrier), spots, now, out, { wave: 900 + (F.waveNo ?? 0) });
  }
  if (D.soulpools) for (const z of (F.zones ?? []).filter((q) => q.kind === 'soul' && q.until > now)) {
    const s = z.s, holds = (x, zz) => Math.hypot(x - s[1], zz - s[2]) <= s[3];
    if (here.some((m) => holds(m.x, m.z))) continue;
    for (const a of egBodiesOf(F, EG_ROLE.add)) if (holds(a.x, a.z)) a.hp = Math.min(a.max, a.hp + a.max * 0.0075);
  }
  if (B.tide === 'erupts' && spec.kind === 'court' && now >= (F.ventAt ?? 0) && here.length) {
    F.ventAt = now + 9000;
    const m = here[Math.floor(rng() * here.length)];
    egAim(F, spec, { o: 0, s: [shDisc(m.x + (rng() - 0.5) * 6, m.z + (rng() - 0.5) * 6, 3)], at: now + 1500, wu: 1500, p: 0.2, b: 4, el: 'fire', nm: 'Wellhead Vent', y: m.y }, here, now, out);
  }
}
/** A Sapper's objective: its lord (to heal it), a closed rift (to open it at a third), a Wellspring's broken anchor. AUDIT EG IV
 *  (lane1 #27; section 12: "a Yard's nearest closed rift"): its rift the closed one nearest it, taken again when another Sapper
 *  reopened the one it walked to (none left: it stands). */
function sapperGoal(F, spec, a) {
  if (a.lordGoal) { const L = egBodyById(F, a.lordGoal); return L ? [L.x, L.z, L.r + 0.6] : null; }
  if (a.goal) { if (!(F.closedSpots ?? []).includes(a.goal)) a.goal = nearestClosed(F, a); return a.goal ? [a.goal[0], a.goal[1], 1.6] : null; }
  const broken = F.brokenAnchors?.[0];
  return broken ? [broken[0], broken[1], 1.6] : null;
}
/** AUDIT EG IV (lane1 #27): the closed rift (`[x, z, its health whole]` - riftClosed) nearest body `a`, or null. */
const nearestClosed = (F, a) => (F.closedSpots ?? []).reduce((b, q) => (!b || dist(q[0], q[1], a.x, a.z) < dist(b[0], b[1], a.x, a.z) ? q : b), null);
/** A Sapper at its objective: gone into it. AUDIT EG IV (lane1 #17; section 12: "heals it, the gate's law"): a lord drinks it
 *  as the gate's Warden does - SAP_HEAL of its health while its fight's feedings last (SAP_FEEDS_MAX), burnt out against it
 *  after (net/gate/gateBrain.js sapperBeat); a closed rift opened again at a third of its own health (lane1 #27). FB1018D
 *  TWIN-REKINDLE: only a lord STANDING drinks - the gate's Warden is fed only while he stands, and a lord of a fight of two
 *  lies a body after its fall (a Twin in its window, the Twin Court's first, the Old Masters'), so a Sapper stood for it
 *  before its fall burns out against the body: fed, the body stood again with its fall's flag still on - a lord on the
 *  relay, throwing blows, that no screen's blow could meet, and that kept the pair's raise from ever coming. */
function sapperReach(F, spec, a, now, out) {
  const L = a.lordGoal ? egBodyById(F, a.lordGoal) : null, feeds = !!L && L.hp > 0 && (F.mem.fed ?? 0) < SAP_FEEDS_MAX;
  egGone(F, [a], a.lordGoal && !feeds ? EG_GONE.crumbled : EG_GONE.fed, '', now, out);
  if (a.lordGoal) { if (feeds) { F.mem.fed = (F.mem.fed ?? 0) + 1; L.hp = Math.min(L.max, L.hp + L.max * SAP_HEAL); out.push({ k: 'esay', w: 'sapperfed' }); } return; }
  if (a.goal) { if (!(F.closedSpots ?? []).includes(a.goal)) return; F.closedSpots = F.closedSpots.filter((q) => q !== a.goal); egRaiseObj(F, 'rift', a.goal[0], a.goal[1], Math.round((a.goal[2] ?? egHpTeam(F, EG_RIFT_TEAM_S, 5)) / 3), now, out, { r: 1.3 }); out.push({ k: 'esay', w: 'reopened' }); return; }
  const b = F.brokenAnchors?.shift();
  if (b) { egRaiseObj(F, 'anchor', b[0], b[1], Math.round(egHpTeam(F, EG_ANCHOR_S) / 3), now, out, { r: 0.9 }); out.push({ k: 'esay', w: 'relit' }); }
}
/** A rift closed (by the company or the Deserter): its lumen, its place remembered for a Sapper. */
function riftClosed(B, F, spec, o, name, now, out) {
  egObjBroken(F, spec, o, name, now, out);
  F.closed = (F.closed ?? 0) + 1;
  (F.closedSpots ??= []).push([o.x, o.z, o.max]);   // AUDIT EG IV (lane1 #27): its health whole kept - a Sapper opens it again at a third of it
  for (const [, m] of living(B)) m.lumen = (m.lumen ?? 0) + EG_LUMEN_RIFT;
}

/**
 * A MEMBER'S BLOW (`m` the wire's `hit` - `{i, q, d, r}` on body `i`), from where its own pose stands (`pose` - the
 * Spire's frame `{sx, z}`): only in a trial, from a living member, in the hall; the gate's hand and purse (the bucket
 * grown by the member's declared Vestiges), times the lord's own weight (a stun, a flank, a ward) and the relay's
 * Vestiges (Long Sight, Culling Edge, the Standard, Fallen's Due, a marked foe, Counterstroke), capped. Answers the
 * frames.
 */
export function egBlow(B, sub, m, pose, now) {
  const out = [];
  const mm = B.mem[sub], F = B.F;
  if (!mm || !mm.in || !mm.alive || mm.home || B.sg !== 'trial' || !F || !pose || m.k !== 'hit') return out;
  const spec = specOf(B), p = local(spec, { sub, sx: pose.sx, y: pose.y, z: pose.z, dead: false });
  const body = p ? egBodyById(F, m.i) : null;
  if (!body) return out;
  // FIELD BUGS 2026-10-20f (LANDED-WORD; bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md, ilovemybonk: "ive dumped a literal
  // million damage into a redoubt 16 boss and it says at the end it only took 31k"): WHAT THE BLOW LANDED, TO ITS STRIKER ALONE
  // (`eland`) - its screen's number, the duel's law (INT8: a miss said at once, a hit at the referee's word). The screen said
  // the claim, and the purse, the lord's weight and its health decide what lands: a refused blow lands nothing and says so
  const land = (d) => { out.push({ k: 'eland', i: m.i, d: Math.max(0, Math.round(d)), to: sub }); return out; };
  if (egFairRefuses(fairOfMember(B, sub), now)) return land(0);   // EG-H1: a second break of the fair trail in a hall refuses its hits a while
  // EG-ZB (sections 11.7 and 21): A BLOW IS STRUCK FROM THE FIGHT GROUND (net/eliteGates/egWalkGraph.js egFightView) - a pose on
  // traversal ground (a step, a ledge, a side span, the top of an arch's wall over the floor) strikes nothing; an object
  // standing off it (a false wall in its alcove) is struck from beside it, as before (net/eliteGates/egBodies.js egHitBody)
  const view = egFightView(spec);
  if (egStruckOff(view, body, p.x, p.y, p.z)) return land(0);   // THE ASCENT: the object's own floor by its feet; FIELD BUGS 2026-10-18f TURNED-BLOW: the rule moved into egBodies.js egStruckOff, the one law every screen asks too
  const here = egPosedHere(B);   // AUDIT EG V (L2-2): the living company by its poses of this hall
  mm.pose = { x: p.x, z: p.z, h: B.h };   // AUDIT EG V (L3-22, L2-2): the hall it struck in, as egStep keeps a pose (a fall's Memento and egPosedHere read it)
  // AUDIT EG IV (lane1 #19): COUNTERSTROKE ARMED AT THE BLOW - a lord's blow landed within EG_COUNTER_M of this member since the
  // beat's census last looked (which arms it for the rest - trial) arms it now, so its 0.6 s are whole from the landing
  for (const bl of F.blows) if (!bl.counted && bl.at <= now && bl.o && egLordsOf(F).some((L) => L.i === bl.o) && egBlowNear(bl, p.x, p.z) <= EG_COUNTER_M) mm.lordLandedAt = Math.max(mm.lordLandedAt ?? -Infinity, bl.at);
  const far = Math.hypot(p.x - body.x, p.z - body.z);   // between the poses at the blow, as Long Sight reads it (net/eliteGates/egRun.js egVestigeX)
  const vx = egVestigeX(B, sub, p, body, m.r, now, here);
  let mult = vx.x;
  // EG-ZS (section 15): an Arcane Echo's claim is its cast's whole (a blow numbered EG_ECHO_Q past its cast's, which is under it -
  // scenes/eliteGates/egFight.js: from EG_ECHO_Q to twice it, as the wire's `q` holds); the room takes its share - half, or the whole in
  // War-Chorus (net/eliteGates/egRun.js egEchoShare)
  const dm = m.q >= EG_ECHO_Q && m.q < 2 * EG_ECHO_Q ? m.d * egEchoShare(B, sub, p, here) : m.d;
  if (egShieldTurns(body, p.x, p.z)) mult = 0;   // a Shielded elite's front (net/eliteGates/egLegion.js - AUDIT EG V L2-7: the host hits' law too)
  if (body.role === EG_ROLE.obj && body.t === 'heart' && egHas(body, EG_FL.ward)) mult = 0;
  // EG-ZK (section 13.1): A BLOW ON A LORD THROUGH THE SEAM - joined (the director's admission, a lord standing), then the
  // gate's hand and purse times the lord's own weight, and what lands told the lord (its words in `out`)
  const said0 = out.length, lf = body.role === EG_ROLE.lord ? egLordsFight(F, spec, {}, now) : null;
  if (lf && !EG_SEAM.join(lf, sub, mm.name, mm.lv, now, null, { admits: mm.alive && mm.in && !mm.home })) return land(0);
  const r = lf ? EG_SEAM.hit(lf, sub, dm, m.r, p, now, m.q, { i: m.i, p: mm, x: mult, bx: vx.bx, name: mm.name, here, out, threatX: egThreatX(mm) }) : egHitBody(F, spec, mm, m.i, dm, m.r, p, now, m.q, mult, vx.bx);
  const got = r.got;
  land(got);   // LANDED-WORD: told first, before what the blow's landing says to the room
  // a Shielded elite (section 8.7): its shield - a quarter of its health - takes the blows from behind first
  if (got) egShieldSoak(F, body, got, out);
  if (!got || !r.b) return out;
  if (r.b.role === EG_ROLE.add) egLurkerWake(F, r.b, now, out);   // AUDIT EG III: a blow landing on a dormant Lurker wakes it (Spotter's arrows at any range so - section 15)
  mm.dh += got; mm.dc += got;
  egTallyBlow(mm, F, sub, got, r.b.role === EG_ROLE.lord);   // EG-ZF: the recap's damage, and a Court's chart
  if (m.r >= 0 && m.r <= 2) mm.kinds[m.r] = (mm.kinds[m.r] ?? 0) + 1;
  if (egMarkFoe(mm, body, m.r, now, sub, far)) egSpotted(F, body, now, out);   // EG-ZS: the mark keeps who laid it (Hammer and Anvil); AUDIT EG III (lane2 #6): an arrow from beyond 12 m; AUDIT EG IV (lane10 #13): a Spotter's spotting breaks an add's wind-up
  mm.amb = 0;   // EG-ZS: Ambush's first blow after a Fade is spent
  egFadeOn(mm, now);
  const b = r.b;
  if (b.role === EG_ROLE.lord) {
    if (b.hp <= 0 && Object.values(B.mem).filter((x) => x.in).length >= 4 && living(B).length === 1) B.loneBeacon = sub;
  } else if (b.role === EG_ROLE.add) {
    // AUDIT EG III: a Binder's raise is broken by what LANDS on it over its cast - the hand and the purse's, never the claim
    if (b.k === EG_KIND.binder && b.cast && (b.cast.dmg += got) >= b.cast.max) egBinderBroken(F, b, out);   // AUDIT EG IV (lane1 #12): its raise spent, never begun again
    if (b.hp <= 0) addDied(B, F, spec, b, sub, mm, now, here, out);
  } else if (b.role === EG_ROLE.obj && b.hp <= 0) {
    if (b.t === 'fwall') { egGone(F, [b], EG_GONE.slain, mm.name, now, out); if (F.alc) F.alc[b.alc] = 1; out.push({ k: 'esay', w: 'seam', n: mm.name }); }   // LAYER THREE: a false wall falls - its alcove open
    else if (b.t === 'rift') { riftClosed(B, F, spec, b, mm.name, now, out); F.coClosed = (F.coClosed ?? 0) + 1; }
    else if (b.t === 'anchor') { egObjBroken(F, spec, b, mm.name, now, out); (F.brokenAnchors ??= []).push([b.x, b.z]); }
    else egObjBroken(F, spec, b, mm.name, now, out);
  }
  hostHits(B, F, spec, sub, mm, { r: m.r, q: m.q, bx: vx.bx, d: dm * mult }, b, got, p, now, here, out);   // EG-ZS: Bladestorm, Deadeye, Kindled Steel (AUDIT EG III: Sweeping Arc, Spillover)
  if (spec.kind === 'court') tallySays(F, out, said0);   // EG-E: a banner broken, a lord stunned - the feats count them
  return out;
}
/**
 * EG-ZS (section 15; EG-ZR's "Not built") - THE HOST HITS a landed blow of member `sub`'s brings (`b` its target, `got` what
 * landed, `p` where it was struck from), struck by the room itself (hostStrike):
 *   - BLADESTORM (Blade's capstone: "every fifth melee blow strikes every foe within 3 m"): every EG_STORM_N-th landed melee
 *     blow of a member resonating in Blade (`mm.storm`, counted over the breach) strikes every other foe within EG_STORM_M of
 *     the member as the blow landed;
 *   - DEADEYE (Hunt's: "an arrow from beyond 12 m pierces the add behind its target"): a landed arrow of a member resonating in
 *     Hunt, from beyond EG_FAR_M of its target, strikes the first add its line meets past the target (egBehind) as it landed;
 *   - KINDLED STEEL (Searing Edge with Overcharge: "the Edge holder's melee fire splashes 2 m"): a landed melee blow of a
 *     Searing Edge holder standing within EG_ACCORD_M of a mate holding Overcharge (net/eliteGates/egVestige.js egAccordMates) splashes
 *     its fire - the Edge's points - on every other foe within EG_KINDLED_M of the target.
 * AUDIT EG III:
 *   - SWEEPING ARC ("melee blows splash 20 / 35 / 50% to adds within 3 m of the target"): a landed melee blow - on any body,
 *     a lord's and an object's too - strikes every other add within EG_SWEEP_M of the target, where each stands as it landed,
 *     its share of what landed;
 *   - SPILLOVER (Arcana's Mastery: "a spell's overkill on an add carries to the nearest add within 6 m"): a landed spell that
 *     fells an add carries what its claim (`w.d`, the blow's factors in it) held past the add's health - within the blow's own
 *     cap, out of the member's purse - to the nearest other add within EG_SPILL_M of it, once.
 */
function hostHits(B, F, spec, sub, mm, w, b, got, p, now, here, out) {
  const r = w.r, foes = () => F.bodies.filter((a) => a !== b && (a.role === EG_ROLE.add || a.role === EG_ROLE.lord));
  const sweep = r === HIT_KINDS.Melee ? egVOf(mm.vs, 'sweeping') : 0;
  if (sweep > 0) {
    const [bx, bz] = egBodyAt(b, now);
    for (const a of F.bodies.filter((q) => q !== b && q.role === EG_ROLE.add)) { const [ax, az] = egBodyAt(a, now); if (dist(ax, az, bx, bz) <= EG_SWEEP_M) hostStrike(B, F, spec, a, got * sweep, w, sub, mm, p, now, here, out); }
  }
  if (r === HIT_KINDS.Spell && mm.mast === EG_M_ID.spillover && b.role === EG_ROLE.add && !(b.hp > 0) && w.d > got) {
    const [bx, bz] = egBodyAt(b, now);
    let to = null, bd = Infinity;
    for (const a of F.bodies.filter((q) => q !== b && q.role === EG_ROLE.add && q.hp > 0 && !egHas(q, EG_FL.friend) && !egHas(q, EG_FL.ward) && !egHas(q, EG_FL.hidden))) {
      const [ax, az] = egBodyAt(a, now), d = dist(ax, az, bx, bz);
      if (d <= EG_SPILL_M && d < bd) { bd = d; to = a; }
    }
    const left = to ? Math.min(w.d, HIT_CAP_X * dpsRef(mm.lv) * (w.bx ?? 1)) - got : 0;
    if (left > 0) hostStrike(B, F, spec, to, spendPurse(mm, left, to.hp, now, w.bx ?? 1), w, sub, mm, p, now, here, out);
  }
  if (r === HIT_KINDS.Melee && egResonance(mm.vs).includes('blade') && (mm.storm = (mm.storm ?? 0) + 1) % EG_STORM_N === 0) {
    let n = 0;
    for (const a of foes()) { const [ax, az] = egBodyAt(a, now); if (dist(ax, az, p.x, p.z) <= EG_STORM_M) n += hostStrike(B, F, spec, a, got, w, sub, mm, p, now, here, out) > 0 ? 1 : 0; }
    if (n) out.push({ k: 'esay', w: 'storm', n: mm.name, s: [sub] });   // AUDIT EG III (section 27.5): its striker's screen says it
  }
  if (r === HIT_KINDS.Shaft && egResonance(mm.vs).includes('hunt')) {
    const [bx, bz] = egBodyAt(b, now), a = dist(bx, bz, p.x, p.z) > EG_FAR_M ? egBehind(F, b, p, now) : null;
    if (a && hostStrike(B, F, spec, a, got, w, sub, mm, p, now, here, out) > 0) out.push({ k: 'esay', w: 'deadeye', n: mm.name, s: [sub] });   // AUDIT EG III: and this
  }
  const fire = r === HIT_KINDS.Melee ? egVOf(mm.vs, 'searing') : 0;
  if (fire > 0 && egAccordMates(egCompanyAt(B, sub, p, here), sub, 'kindled', 'a').length) {
    const [bx, bz] = egBodyAt(b, now);
    for (const a of foes()) { const [ax, az] = egBodyAt(a, now); if (dist(ax, az, bx, bz) <= EG_KINDLED_M) hostStrike(B, F, spec, a, fire, w, sub, mm, p, now, here, out); }
  }
}
/**
 * EG-ZS - A HOST HIT (section 15's "relay host hits"): `n` of member `sub`'s blow `w` (`{ r, q, bx }` - its kind, its number,
 * its bucket's factor) struck by the room itself on foe `a`. An add takes it as Sweeping Arc's splash strikes one (its fall the
 * slayer's). A lord takes it through THE BOSS SEAM's one `hit`, as every blow on a lord goes (section 13.1 - net/eliteGates/egLords.js
 * EG_SEAM): riding the blow's own token (its number), out of the member's purse, by the lord's own weight (a ward, a flyer out
 * of a blade's reach, Unyielding's) and told the lord (its threat, its kit, its fall). A friend, a ward, a hidden body or one
 * already down takes none. Answers what landed.
 */
function hostStrike(B, F, spec, a, n, w, sub, mm, p, now, here, out) {
  if (!(n > 0) || !(a.hp > 0) || egHas(a, EG_FL.friend) || egHas(a, EG_FL.ward) || egHas(a, EG_FL.hidden)) return 0;
  // AUDIT EG V (L2-7; section 8.7): a Shielded elite's shield turns a host hit on its front and soaks one from behind, as it
  // does a member's blow (net/eliteGates/egLegion.js) - struck from where the member stands
  if (egShieldTurns(a, p.x, p.z)) return 0;
  let got = 0;
  if (a.role === EG_ROLE.add) { got = Math.min(n, a.hp); a.hp -= n; egShieldSoak(F, a, got, out); }
  else got = EG_SEAM.hit(egLordsFight(F, spec, {}, now), sub, n, w.r, p, now, w.q, { i: a.i, p: mm, x: 1, bx: w.bx, name: mm.name, here, out, threatX: egThreatX(mm) }).got;
  // AUDIT EG IV (lane1 #25): what a host hit landed is its member's as a blow's is - the hall's and the circle's damage (section
  // 16.1's part, the receipt's share) and the recap's and a Court's chart (net/eliteGates/egTally.js)
  if (got > 0) { mm.dh += got; mm.dc += got; egTallyBlow(mm, F, sub, got, a.role === EG_ROLE.lord); }
  if (a.role === EG_ROLE.add && a.hp <= 0) addDied(B, F, spec, a, sub, mm, now, here, out);
  return a.role === EG_ROLE.add ? n : got;
}
/**
 * EG-ZS - DEADEYE'S LINE (section 15): the first add the line from `p` through target `b` meets past the target - its centre
 * within its own radius of the line, beyond the target - never the target, a friend, a ward or a hidden body. Null for none.
 * @param {any} F @param {any} b @param {{ x: number, z: number }} p @param {number} now
 */
export function egBehind(F, b, p, now) {
  const [bx, bz] = egBodyAt(b, now), L = dist(bx, bz, p.x, p.z);
  if (!(L > 0)) return null;
  const ux = (bx - p.x) / L, uz = (bz - p.z) / L;
  let best = null, bestT = Infinity;
  for (const a of F.bodies) {
    if (a === b || a.role !== EG_ROLE.add || !(a.hp > 0) || egHas(a, EG_FL.friend) || egHas(a, EG_FL.ward) || egHas(a, EG_FL.hidden)) continue;
    const [ax, az] = egBodyAt(a, now), t = (ax - p.x) * ux + (az - p.z) * uz, off = Math.abs((ax - p.x) * uz - (az - p.z) * ux);
    if (t > L && off <= (a.r ?? 0.6) && t < bestT) { best = a; bestT = t; }
  }
  return best;
}
/**
 * AUDIT EG IV (lane10 #14; section 15) - RALLYING CRY AT A COURT'S PHASE TURN (Fellowship's capstone - at a door it gave back
 * what the closing could not spend): the first of the Court's lords to turn each phase (its second, its third - a mirror's or a
 * champion's never) while a living member resonates in Fellowship sounds it once - Rally's heal again (`eheal` `cry`: the
 * strongest holder's share, a third under Hungering Dark; nothing with no holder, and Shield-Hymn with it) and every Second Wind
 * in the company given back (systems/eliteGates/spireVestiges.js spireRallyingCry, at the word). `from` the frames' index the beat's began.
 */
function rallyingCry(B, F, out, from, now) {
  let ph = 0;
  for (let k = from; k < out.length; k++) { const f = out[k]; if (f?.k === 'eph') { const L = egBodyById(F, f.i); if (L && !L.champ && !egHas(L, EG_FL.mirror)) ph = Math.max(ph, f.ph); } }
  if (!(ph > (F.mem.cried ?? 1))) return;
  F.mem.cried = ph;
  if (!living(B).some(([, m]) => egResonance(m.vs).includes('fellowship'))) return;
  const rally = Math.max(0, ...living(B).map(([, m]) => egVOf(m.vs, 'rally')));
  out.push({ k: 'eheal', p: B.tide === 'hungering' ? rally / 3 : rally, why: 'cry' });
  if (rally > 0) egHymnStep(B, now);
}
/** EG-E: a Court's beats counted as they are spoken (its lord's feats read them at its fall - net/eliteGates/egFeats.js). */
function tallySays(F, out, from) {
  if (!F) return;
  for (let k = from; k < out.length; k++) if (out[k]?.k === 'esay') { F.said ??= {}; F.said[out[k].w] = (F.said[out[k].w] ?? 0) + 1; }
}
/** An add slain: its lumen to the slayer, its decrees (net/eliteGates/egLegion.js egAddSlain), its words. AUDIT EG III: a pool it leaves
 *  (Soul-Pools) is said in this blow's own frames (`out`), never the last beat's, already fanned. */
function addDied(B, F, spec, a, sub, mm, now, here, out) {
  if (!F.bodies.includes(a)) return;
  egGone(F, [a], EG_GONE.slain, mm.name, now, out);
  mm.lumen = (mm.lumen ?? 0) + EG_LUMEN_ADD;
  egAddSlain(F, spec, a, sub, now, here, out, { ...(F.legionCtx ?? { decrees: F.D }), pool: poolTo(F, out) });
}
/** A pool laid in `out`'s frames (a Caster's Bolt, a Searing strike, Soul-Pools - net/eliteGates/egLegion.js's `ctx.pool`). */
const poolTo = (F, out) => (x, z, r, from, ms, p, b, el, kind = 'burn', y = NaN) => zoneOut(F, kind, shDisc(x, z, r), from, from + ms, out, { p, b, el, y });   // THE ASCENT: on its own floor
/** A member's step through the door (`down`): in the closing of hall `h`, from a living member standing at it. Answers
 *  whether it was believed. */
export function egDown(B, sub, h, pose, now) {
  const mm = B.mem[sub];
  if (!mm || !mm.in || !mm.alive || mm.home || B.sg !== 'closing' || h !== B.h || !pose) return false;
  const spec = specOf(B), p = local(spec, { sub, sx: pose.sx, y: pose.y, z: pose.z, dead: false });
  if (!p || !egAtDoor(spec, p.x, p.z, p.y) || !fairOf(B, sub)) return false;   // EG-H1: a step through the door on a fair trail - AUDIT EG III (lane2 #11): within EG_DOOR_REACH_M, the ring's, no pad
  mm.downH = h;
  return true;
}
/**
 * A MEMBER'S OTHER WORDS in the breach: `pick` (a Vestige card), `surplus` (a fourth card or a reroll), `vote` (the
 * company's word), `cant` (a Cantrip used), `buy` (from the Sutler), `lping`/`ping` (a living member's, a witness's),
 * `bequest` (a fallen's Vestige offered to the living), `forsake`, `pz` (an Athenaeum's turn), `use` (an engine), `mast`
 * (AUDIT EG III: Spirebridge asked - net/eliteGates/egVestige.js egSpirebridge). Answers
 * the frames.
 * @param {any} B @param {string} sub @param {any} m @param {{sx: number, z: number}|null} pose @param {number} now @param {() => number} rng
 */
export function egWord(B, sub, m, pose, now, rng) {
  const out = [];
  const mm = B.mem[sub];
  if (!mm || !mm.in || B.end) return out;
  const spec = B.h > 0 ? specOf(B) : null;
  const p = spec && pose ? local(spec, { sub, sx: pose.sx, z: pose.z, dead: false }) : null;
  switch (m.k) {
    // AUDIT EG V (L2-15; section 15: "takes one within the rest"): a pick and a Surplus are the rest's alone
    case 'pick': if (mm.alive && B.sg === 'rest' && egPick(B, sub, m.v)) out.push({ k: 'run', r: egRunOf(sub, mm) }, { k: 'offer', to: sub, v: mm.offer ?? [], n: mm.picks ?? 0 }); break;
    case 'surplus': { const o = B.sg === 'rest' ? egSurplus(B, sub, m.use === 1 ? 'reroll' : 'card', rng, B.rd, B.rd % 5 === 0) : null; if (o) out.push(o, egStateOf(B, now)); break; }
    case 'vote': if (egVote(B, sub, m.q, m.y)) { const a = B.asks.find((x) => x.q === m.q); out.push({ k: 'tally', q: m.q, v: Object.values(a.v) }); } break;
    case 'cant': {
      const i = m.i, id = mm.cant?.[i];
      // AUDIT EG III (section 17.2: "anywhere outside a lord's shield"): refused while any lord standing holds its shield (the
      // second Twin's too) - the rest and the stair among the anywhere; Sight alone is kept where no hall's fight stands to show
      if (!mm.alive || id == null || !EG_CANTRIPS[id]) break;
      if (B.F && egLordsOf(B.F).some((L) => L.ward > now || egHas(L, EG_FL.ward))) break;
      if (EG_CANTRIPS[id].key === 'sight' && !B.F) break;
      mm.cant = mm.cant.filter((_, j) => j !== i);
      const C = EG_CANTRIPS[id];
      if (C.key === 'mending') out.push({ k: 'eheal', p: 0.15, why: 'mending' });
      else if (C.key === 'stillness') B.still = 1;
      else if (C.key === 'severance') B.sever = 1;
      else if (C.key === 'sight' && B.F) B.F.pg.sight = 1;
      out.push({ k: 'esay', w: 'cantrip', n: mm.name, t: C.name }, { k: 'run', r: egRunOf(sub, mm) });
      if (C.key === 'longstep') out.push({ k: 'egot', to: sub, w: 'longstep' });
      break;
    }
    case 'buy': {
      if (!mm.alive || !spec || spec.twist !== 'sutler' || !p) break;
      const at = spec.spots.sutler?.[0];
      if (!at || dist(p.x, p.z, at.x, at.z) > 4) break;
      const got = egBuy(mm, m.i, rng);
      if (got) out.push({ k: 'egot', to: sub, w: got }, { k: 'run', r: egRunOf(sub, mm) });
      break;
    }
    case 'mast': { const w = egSpirebridge(B, sub, spec, p, now); if (w) out.push(w); break; }   // AUDIT EG III: Spirebridge asked (net/eliteGates/egVestige.js - the room's rule)
    case 'lping': if (mm.alive && now - (mm.pingAt ?? 0) >= EG_PING_MS) { mm.pingAt = now; out.push({ k: 'eping', s: sub, x: m.x, z: m.z, w: m.w, wit: 0 }); } break;
    case 'ping': if (!mm.alive && now - (mm.pingAt ?? 0) >= EG_PING_MS) { mm.pingAt = now; out.push({ k: 'eping', s: sub, x: m.x, z: m.z, w: m.w, wit: 1 }); } break;
    case 'bequest': if (!mm.alive && (mm.vs ?? []).some((q) => q[0] === m.v)) mm.bequest = m.v; break;
    case 'forsake': egForsake(B, sub, now, out); break;
    case 'wkpaid': {
      // AUDIT EG III (lane2 #1; section 16.3): A REDOUBT ALREADY PAID THIS WEEK SEALS NONE - the member's own word that the account
      // service answered its Redoubt `w`'s receipt paid already this arena week (only the service knows): every Reliquary of
      // that circle in its satchel gives EG_REL_LUMEN instead. Its own loss alone - a word that lies turns a Reliquary that
      // would open into lumen - so believed for a circle the breach took
      const k = (mm.rel ?? []).filter((w) => w === m.w).length;
      if (!k || !(m.w <= B.rd)) break;
      mm.rel = mm.rel.filter((w) => w !== m.w);
      mm.lumen = (mm.lumen ?? 0) + EG_REL_LUMEN * k;
      out.push({ k: 'run', r: egRunOf(sub, mm) });
      break;
    }
    case 'fell': if (mm.alive && B.h > 0) egLayDown(B, sub, now, out, p); break;   // AUDIT WORLD-EVENTS L1-4: down first
    case 'yield': if (mm.down) egFall(B, sub, now, out, null); break;   // AUDIT WORLD-EVENTS L1-4: the fall given in to
    case 'rz': egRezMember(B, sub, m.to, now, out, p); break;   // AUDIT WORLD-EVENTS L1-4: a party member's Resurrect at a body lying down
    case 'tonic': if (mm.alive && (mm.tonics ?? 0) > 0) { mm.tonics--; out.push({ k: 'eheal', p: 0.25, why: 'tonic', to: sub }, { k: 'run', r: egRunOf(sub, mm) }); } break;   // AUDIT EG III (lane1 #5): A SPIRE TONIC drunk (section 17.1) - its share of health (the census's - egCountHeals) and of magicka (the member's screen), one of the run's spent
    case 'use': {
      // EG-FULL LAYER THREE: an engine worked (section 11.10) - within 2 m, once in 30 s (the Shelf once)
      const F = B.F, e = (spec?.engines ?? [])[m.i];
      if (!mm.alive || !F?.engCd || B.sg !== 'trial' || !p || !e || dist(p.x, p.z, e.x, e.z) > EG_ENGINE_REACH_M + 0.5) break;
      if (now < (F.engCd[e.i] ?? 0) || F.engUsed[e.i]) break;
      if (engineWork(B, F, spec, e, mm, now, out)) F.engCd[e.i] = now + EG_ENGINE_CD_MS;
      break;
    }   // a death in the Spire, said by the member's own machine (the pose's `dd`'s twin - the death save turned it into a fall there)
    case 'pz': {
      const F = B.F;
      if (!mm.alive || !F?.orrery || B.sg !== 'trial' || !p) break;
      const stone = egObjsOf(F, 'stone').find((o) => o.pt === m.i);
      if (!stone || dist(p.x, p.z, stone.x, stone.z) > 3.5) break;
      const res = orreryJudge(F.orrery, F.lock, F.lockLast, m.i, m.a === -1 ? -1 : 1, now);   // EG-H3 (EG4): the Hour's one judge - the settle and the turn (no rights: a company is one thread)
      if (!res) break;
      F.lock = { st: res.st, f: res.f, ok: res.ok, lit: res.lit }; F.lockLast[m.i] = now; F.turns++;
      if (res.x) { for (const [s2] of living(B)) out.push({ k: 'eheal', p: -0.25, why: 'fray', to: s2 }); F.turns = 0; }
      out.push({ k: 'pz', st: res.st, f: res.f, lit: res.lit, ok: res.ok ? 1 : 0, x: res.x ? 1 : 0, by: mm.name });
      break;
    }
    default: break;
  }
  return out;
}
/** EG-H1: the Watchfire holders among the living (section 15) - each one's lead at its rank and the Long Sight holders it
 *  keeps Far Watch with (net/eliteGates/egBodies.js egTellTo). AUDIT EG III: FAR WATCH by THE PAIR LAW (net/eliteGates/egVestige.js egAccordMates) -
 *  another member holding Long Sight within EG_ACCORD_M of the holder, never the holder itself. */
export function egWatchOf(B) {
  const L = living(B).filter(([, m]) => m.pose?.h === B.h), out = [];   // AUDIT EG V (L2-2): by a pose of this hall
  const ms = L.map(([sub, m]) => ({ sub, vs: m.vs ?? [], x: m.pose.x, z: m.pose.z }));
  for (const [sub, m] of L) {
    const v = egVOf(m.vs, 'watchfire');
    if (!(v > 0)) continue;
    const mates = egAccordMates(ms, sub, 'farwatch', 'b'), ls = ms.filter((q) => mates.includes(q.sub)).map((q) => [q.x, q.z]);
    out.push({ sub, x: m.pose.x, z: m.pose.z, lead: Math.round(v * 1000), ls });
  }
  return out;
}
/**
 * EG-H1 - A MEMBER'S POSE in its breach's room, at its SHARED time `t` (net/eliteGates/egFair.js egPoseShared - the room's every pose):
 * where it stands in the hall's own frame - a ridden pose (`pl`) at its piece's clock position, its offset held to the
 * piece's top (RIDDEN POSES, section 10.8) - fed to THE FAIR TRAIL while the member is in a trial or its closing, from its
 * arrival on this hall (`here`) to its step through the door (`down`): a pose between them belongs to no crossing, and one
 * sent mid-stair to no hall. A fall past EG_VOID_Y under its last support owes the count a cast-back (egCount). Answers the
 * point for the room's shared-time trail (`{x, y, z, h}`), or null (no hall's, a witness's, a member out).
 * @param {any} B @param {string} sub @param {{sx: number, y: number, z: number, pl?: number[]|null, cl?: number}} p @param {number} t
 */
export function egPoseIn(B, sub, p, t) {
  const m = B.mem[sub];
  if (!m || !m.in || !m.alive || m.home || B.end || !(B.h > 0) || B.sg === 'wait' || B.sg === 'rest') return null;
  const spec = specOf(B);
  if (!egInHall(spec, p.sx, p.z, 4)) return null;
  let x = egLocalX(spec, p.sx), y = p.y, z = p.z, ride = false;
  if (Array.isArray(p.pl) && egRideHolds(spec, p.pl, x, y, z, t / 1000)) { const q = egRideAt(spec, p.pl, t / 1000); if (q) { [x, y, z] = q; ride = true; } }   // AUDIT EG V (lane4 L4-2): the ride the pose's own feet stand on
  if (!ride && litOn(B.F, spec, x, y, z, t)) ride = true;   // EG-ZC: a branch the Moon-Mirror lit holds its body
  if ((B.sg === 'trial' || B.sg === 'closing') && m.hereH === B.h && m.downH !== B.h) {
    const k = fairKey(B, m);
    // a trail begins on the arrival plate (or where a recall stood it): a first pose anywhere else is a step the law never
    // saw - a break, so a member who left the plate in the gather's last seconds holds nothing until it stands on an island
    if (m.fair?.k !== k) { measureFold(m, m.fair); m.fair = { ...egFairNew(B.h, B.hw), k, cbHeld: 0 }; if (!egOnArrive(spec, x, z, 2, y) && m.roseH !== B.h) { m.fair.brk = 1; m.fair.brks = 1; m.fair.why = 'start'; } }   // EG-ZA: the trail it closes folded into the circle's measures
    const A = m.fair;
    A.tm = egTubeMouthOf(B);   // EG-PERFECT: a routed hall's Collapsing Tube falls from the company's arrival at its mouth
    egFairPose(A, spec, { x, y, z, ride, cl: !!p.cl }, t, B.sb);   // AUDIT EG III: a standing Spirebridge is ground
    // EG-PERFECT (section 11.3): the first fair pose at a routed hall's tube's mouth is the company reaching it - the room keeps
    // the instant with this wake, and egStep says it with the stage (egTubeMouthOf)
    if (!A.tm && egFairOk(A) && egTubeAtMouth(spec, x, y, z)) { B.tm = { hw: B.hw, at: Math.max(1, Math.round(t)), said: 0 }; A.tm = B.tm.at; }
    if (egRouteRoadAt(spec, x, y, z) === 1) A.road = 1;   // THE ASCENT: the route's road 1 (laws 4-8: past the fork, by x)
    if (egAtDoor(spec, x, z, y)) { egFairCross(A, t, A.road); if (A.cross > 0 && A.cmin == null) A.cmin = egCrossMinMs(spec, A.road); if (egFairOk(A)) A.atEnd = 1; }   // EG-ZA: the crossing's bound kept with it (its hall's spec is this one); EG-ZI: the end reached on a fair trail owes no toll
    // a fall past EG_VOID_Y - EG-ZB (section 21): or feet on a Falling Wall's or the Collapsing Tube's fallen ground, which the
    // screen casts on to the nearest standing segment at the same cost (net/eliteGates/egFair.js egFallenAt) - owes one cast-back;
    // EG-PERFECT: and a fall into a void zone (the fair trail's `vz` - Elite-Gates-Ascent.md section 2), cast back as into the void
    if ((A.sup && y < A.sup[2] + EG_VOID_Y) || A.vz || egFallenAt(spec, A.hw ?? 0, x, y, z, t, A.tm ?? 0)) { if (!A.cbHeld) { A.cbHeld = 1; m.cbOwe = (m.cbOwe ?? 0) + 1; } }
    else if (A.sup && A.sup[0] === t) A.cbHeld = 0;
  }
  return { x, y, z, h: B.h };
}
/** EG-ZC: is a body at (x, y, z) (the hall's frame) at shared ms `t` on a Moon branch the Moon-Mirror lit - its top, the
 *  capsule about it, within the support's heights (net/eliteGates/egFair.js)? */
function litOn(F, spec, x, y, z, t) {
  for (const q of F?.lit ?? []) {
    const s = t >= q.from && t < q.until ? spec.steps?.[q.i] : null;
    if (s && Math.abs(x - s.x) <= s.w / 2 + EG_BODY_R && Math.abs(z - s.z) <= s.d / 2 + EG_BODY_R && y <= s.y + EG_SUPPORT_UP_M && y >= s.y - EG_SUPPORT_DOWN_M) return true;
  }
  return false;
}
/** EG14, after EG8d (EG-H1 lands it - section 21): THE BODY COUNT IS ENFORCED in `eg:` rooms whatever the gate's BOSS_BODY
 *  line says - the relay's count is the member's one life. The line's depth and pace stay the hub's. */
export const EG_BODY_ENFORCE = true;
/**
 * EG-H1 - THE BODY COUNTED in the Spire (net/bossBody.js; section 21): the hall's blows judged on the living members'
 * shared-time trails (net/bossRef.js judgeShapes - EG-ZK: the boss seam's judge), its own hazards at their landing (judgePlace), and each cast-back a
 * pose owed (egPoseIn - a tenth of the whole, never below a quarter), each kept in the member's census (`cs`: blows struck,
 * hazards struck, cast-backs, the thousandths counted) and taken off its count (bodyStruck - a plain blow's share; an
 * element's is seen and never counted). A count at nothing under enforcement is the member's FALL - one life (egFall: the
 * witness, the Memento, the final fall's receipt) - and is told to it (`bd`, `to` it). Answers the frames.
 * EG-ZB (section 21; EG-H1's departures 10 and 11 closed): judged on THE FIGHT GROUND (net/eliteGates/egWalkGraph.js egFightView - a
 * span's islands and plates, where its Harriers bite); THE DRAINS counted (censusDrains - a soul-wisp's, a Wraith's tether);
 * the census APPLIES THE VESTIGES that change it (egCensusDr - Bastion, Challenger's Oath, Steadfast Line, Immovable,
 * EG-ZI's Lifeline - and Featherstep's lighter cast-back, egCastBackCost); and WHO A BLOW CAUGHT is kept on the fight by its
 * name (`F.cg`, the feats' - net/eliteGates/egFeats.js), an element's as a plain one's. EG-ZI: a count left under EG_LIFELINE_UNDER is
 * noted (`m.lowAt`) for a heal's word to find.
 * @param {any} B @param {number} now @param {Array<{sub: string, tr?: number[][]}>} bodies each living member's trail
 * (`[t, x, y, z, h]` - the hall's frame, shared ms) @param {{depth: number, perS: number}} line @param {boolean} [enforce]
 */
export function egCount(B, now, bodies, line, enforce = EG_BODY_ENFORCE) {
  const out = [];
  if (B.end || !(B.h > 0) || (B.sg !== 'trial' && B.sg !== 'closing')) return out;
  const spec = specOf(B), F = B.F, view = egFightView(spec);
  const live = bodies.filter((b) => { const m = B.mem[b.sub]; return m && m.in && m.alive && !m.home; });
  const hits = [...EG_SEAM.judge(egLordsFight(F, view, {}, now), live, now), ...judgePlace(F, view, B.hw, live, now), ...censusDrains(F, view, live, now)];   // EG-ZK: the fight's blows by the seam's judge
  for (const b of live) {
    const m = B.mem[b.sub];
    for (; (m.cbOwe ?? 0) > 0; m.cbOwe--) hits.push({ sub: b.sub, share: Math.min(egCastBackCost(m.vs), Math.max(0, (m.bd?.v ?? 1) * egCountWhole(m.vs) - EG_CAST_BACK_FLOOR)), i: 0, k: 2 });   // EG-ZS: the floor's quarter of the body without the cushion, as the screen's
  }
  for (const h of hits) {
    const m = B.mem[h.sub];
    if (!m?.alive) continue;
    if (h.k === 0 && h.share > 0) h.share *= 1 - egCensusDr(B, F, view, h, live);
    if (F && h.nm) { const c = ((F.cg ??= {})[h.nm] ??= []); if (!c.includes(h.sub)) c.push(h.sub); }
    const cs = (m.cs ??= [0, 0, 0, 0]);
    cs[h.k]++; cs[3] += Math.round(h.share * 1000);
    if (h.share > 0) B.ctk = (B.ctk ?? 0) + h.share;   // AUDIT EG III (lane2 #3): what the company took in the hall - a healer's part is measured by it
    if (!(h.share > 0) || !bodyStruck(m, h.share / egCountWhole(m.vs), now, line) || !enforce) continue;   // EG-ZS: off the whole, Stoneskin's cushion in it
    const tr = live.find((b) => b.sub === h.sub)?.tr, at = tr?.length ? tr[tr.length - 1] : null;
    egLayDown(B, h.sub, now, out, at && at[4] === B.h ? { x: at[1], z: at[3] } : null);   // AUDIT WORLD-EVENTS L1-4: down first
    out.push({ k: 'bd', to: h.sub });
  }
  for (const b of live) { const m = B.mem[b.sub]; if (m.bd && m.bd.v < EG_LIFELINE_UNDER) m.lowAt = now; }   // EG-ZI: a count seen under 30%, for Lifeline (egHeal)
  return out;
}
/** EG-ZB (section 15's Featherstep, in the census): what a cast-back costs a member's count - a tenth, Featherstep's 8, 6 or
 *  4% by rank (the floor's quarter is egCount's). */
export const egCastBackCost = (vs) => { const r = egRankOf(vs, 'featherstep'); return r ? EG_FEATHER_CAST[r - 1] : EG_CAST_BACK_LOSS; };
/** EG-ZS - STONESKIN IN THE CENSUS (section 15; EG-ZR's open issue for EG14, closed and its sentence deleted): A MEMBER'S WHOLE in
 *  shares of the body without Stoneskin's cushion - 1, and its rank's share more for a holder (1.25 at III). Every share the
 *  room takes - a blow's, a hazard's, a drain's, the void's, the toll's, the lash's - is of the body without the cushion, as
 *  the screen takes it (systems/renownLayer.js spireBodyMax), so it comes off the count over this: the count stays a share
 *  of the whole, as the screen's maximum, the member's own word, the room's heals and a recall are, and a holder falls by it
 *  where its screen falls. */
export const egCountWhole = (vs) => 1 + egVOf(vs, 'stoneskin');
/** EG-ZS - LIVING WALL, THE CENSUS'S HALF (section 15's Accord, Stoneskin with Mender's Grace - "heals on the Stoneskin holder
 *  +10%"): whether member `sub` stands in it now - holding Stoneskin within EG_ACCORD_M of another living member holding
 *  Mender's Grace, on the poses the director holds of this hall (net/eliteGates/egVestige.js egAccordMates). */
export function egWallOf(B, sub) {
  const ms = living(B).filter(([, q]) => q.pose?.h === B.h).map(([s, q]) => ({ sub: s, vs: q.vs ?? [], x: q.pose.x, z: q.pose.z }));
  return egAccordMates(ms, sub, 'livingwall', 'a').length > 0;
}
/**
 * EG-ZR - SHIELD-HYMN, THE CENSUS'S HALF (section 15's Accord, Bastion with Rally - "Rally's heal also gives the company 4 s
 * of Bastion's protection"; section 21: the census applies Bastion): as Rally's heal is said at a door, the Bastion holders
 * standing within EG_ACCORD_M of another member who holds Rally (net/eliteGates/egVestige.js egHymnOf, on each living member's pose in
 * this hall) give the company their Bastion for EG_HYMN_MS - `B.hy` `[from, until, subs]`, which egCensusDr reads. A door
 * with no such pair leaves the last window to lapse. Answers `B.hy`.
 * @param {any} B @param {number} now
 */
export function egHymnStep(B, now) {
  const hy = egHymnOf(living(B).filter(([, m]) => m.pose?.h === B.h).map(([sub, m]) => ({ sub, vs: m.vs ?? [], x: m.pose.x, z: m.pose.z })));
  if (hy.length) B.hy = [now, now + EG_HYMN_MS, hy];
  return B.hy ?? null;
}
/** Immovable's number (the Mastery's id - net/eliteGates/egVestige.js EG_MASTERIES). */
const IMMOVABLE_ID = EG_MASTERIES.find((M) => M.key === 'immovable')?.id ?? -1;
/**
 * EG-ZB - THE CENSUS'S VESTIGES (section 21: "the relay's census applies Bastion, Challenger's Oath, Steadfast Line, Immovable
 * and Lifeline itself"; section 15's numbers): the share of a counted blow `h` (`{sub, at, o}` - its landing and thrower)
 * its member is spared, by where the company stood at its landing on their shared-time trails (`bodies`):
 *   - Challenger's Oath: a lord's blow on its holder, 5 / 10 / 15% less (EG_OATH_DR);
 *   - Bastion: another living member within EG_BASTION_M holding it - the strongest, and 2% more for each other holder, at
 *     most 6% over it (section 15's stacking: EG_AURA_EXTRA, EG_AURA_EXTRA_MAX);
 *   - Steadfast Line: its holder with EG_STEADFAST_N allies within EG_STEADFAST_M;
 *   - Immovable: its holder still EG_IMMOVABLE_MS (within EG_IMMOVABLE_M) on a fight floor, 25% less;
 *   - EG-ZI, Lifeline: a blow landing inside a window a Lifeline holder's heal opened on its member (`m.ll` - egHeal, from
 *     the member's own `heal` word, which the room hears since EG-ZF), 20 / 25 / 30% less by the healer's rank (AUDIT EG III's - EG_V_BY_KEY.lifeline), the
 *     strongest window's;
 *   - EG-ZR, Shield-Hymn: inside the window Rally's heal opened (`B.hy` - egHymnStep), the hymn's Bastion holders stand by
 *     every other member wherever it stands - Bastion's one aura, stacked with the holders near as Bastion is;
 * together never past EG_DR_MAX (30%). Pure.
 * @param {any} B @param {any} F @param {any} view @param {{sub: string, at?: number, o?: number}} h @param {Array<{sub: string, tr?: number[][]}>} bodies
 */
export function egCensusDr(B, F, view, h, bodies) {
  const m = B.mem[h.sub];
  if (!m) return 0;
  const t = h.at ?? 0;
  const trOf = (sub) => bodies.find((b) => b.sub === sub)?.tr ?? null;
  const posOf = (sub) => { const e = egTrailAt(trOf(sub), t); return e && e[4] === B.h ? e : null; };
  let dr = 0;
  const oath = egRankOf(m.vs, 'oath');
  if (oath && h.o && F && egLordsOf(F).some((L) => L.i === h.o)) dr += EG_OATH_DR[oath - 1];
  let ll = 0;
  for (const w of m.ll ?? []) if (t >= w[0] && t <= w[1] && w[2] > ll) ll = w[2];
  dr += ll;
  const me = posOf(h.sub);
  const near = (r) => (me ? living(B).filter(([s]) => s !== h.sub).map(([s, x]) => [x, posOf(s)]).filter(([, p]) => p && Math.hypot(p[1] - me[1], p[3] - me[3]) <= r).map(([x]) => x) : []);
  const hymn = B.hy && t >= B.hy[0] && t <= B.hy[1] ? living(B).filter(([s]) => s !== h.sub && B.hy[2].includes(s)).map(([, x]) => x) : [];   // EG-ZR: Shield-Hymn
  const bast = [...new Set([...near(EG_BASTION_M), ...hymn])].map((x) => egVOf(x.vs, 'bastion')).filter((v) => v > 0).sort((a, b) => b - a);
  if (bast.length) dr += Math.min(bast[0] + EG_AURA_EXTRA * (bast.length - 1), bast[0] + EG_AURA_EXTRA_MAX);
  if (me) {
    const sf = egVOf(m.vs, 'steadfast');
    if (sf > 0 && near(EG_STEADFAST_M).length >= EG_STEADFAST_N) dr += sf;
    if (m.mast === IMMOVABLE_ID && egFightFloorAt(view, me[1], me[2], me[3])) {
      const tr = trOf(h.sub), from = egTrailAt(tr, t - EG_IMMOVABLE_MS);
      if (from && from[4] === B.h && tr.every((e) => e[0] < from[0] || e[0] > t || Math.hypot(e[1] - me[1], e[3] - me[3]) <= EG_IMMOVABLE_M)) dr += EG_IMMOVABLE_DR;
    }
  }
  return Math.min(EG_DR_MAX, dr);
}
/**
 * EG-ZB - THE DRAINS, COUNTED (EG-H1's departure 11 closed): a SOUL-WISP (section 11.2) binds a member on a fight floor within
 * its reach (EG_HAZARDS.wisp `r`, within 3 m of its height), drains them EG_DRAIN_TICK_MS by EG_DRAIN_TICK_MS from a tick
 * after it binds, lets go at its `brk` or after its `live`, and binds them again only EG_WISP_AGAIN_MS later - the screens'
 * own law (scenes/eliteGates/egFight.js wispStep), judged on each member's freshest pose (within EG_POSE_NEAR_MS of the beat); a
 * WRAITH's tether (section 12) drains its member each tick while within its kind's reach. `[{sub, share, i: 0, k: 1, nm,
 * at}]`, each a plain share. The fight's holds kept on it (`F.drn`).
 * @param {any} F @param {any} view @param {Array<{sub: string, tr?: number[][]}>} bodies @param {number} now
 */
function censusDrains(F, view, bodies, now) {
  const out = [];
  if (!F) return out;
  const H = (F.drn ??= {});
  // AUDIT EG V (lane4 L4-1): a body the room holds at its newest pose (a stand-in, `e[5]` 1 - a socket silent or gone) is
  // fresh to the edge the room holds it to, EG_TS_LAG_MAX_MS short of now (server/src/index.js _egTrails)
  const fresh = (b) => { const e = egTrailAt(b.tr, now); return e && now - e[0] <= EG_POSE_NEAR_MS + (e[5] === 1 ? EG_TS_LAG_MAX_MS : 0) && e[4] === F.h ? e : null; };
  const L = EG_HAZARDS.wisp;
  for (const hz of view?.hazards ?? []) {
    if (hz.kind !== 'wisp') continue;
    const [wx, wz] = egWispAt(hz, now / 1000);
    for (const b of bodies) {
      const e = fresh(b), q = (H[`w${hz.i}:${b.sub}`] ??= { from: 0, tick: 0, free: 0 });
      const d = e && egFightFloorAt(view, e[1], e[2], e[3]) && Math.abs(e[2] - (hz.y ?? 0)) < 3 ? Math.hypot(e[1] - wx, e[3] - wz) : Infinity;
      if (!q.from) { if (d <= L.r && now >= q.free) { q.from = now; q.tick = now + EG_DRAIN_TICK_MS; } continue; }
      if (d > L.brk || now - q.from >= L.live) { q.from = 0; q.free = now + EG_WISP_AGAIN_MS; continue; }
      if (now >= q.tick) { q.tick += EG_DRAIN_TICK_MS; out.push({ sub: b.sub, share: L.pct, i: 0, k: 1, nm: L.name, at: now }); }
    }
  }
  const W = EG_LEGION_KINDS[EG_KIND.wraith], seen = new Set();
  for (const t of F.tethers ?? []) {
    const b = t[2] === 0 ? bodies.find((x) => x.sub === t[1]) : null, a = b ? egBodyById(F, t[0]) : null;
    if (!a) continue;
    const key = `t${t[0]}:${t[1]}`, q = (H[key] ??= { tick: now + EG_DRAIN_TICK_MS }), e = fresh(b), [ax, az] = egBodyAt(a, now);
    seen.add(key);
    if (now < q.tick) continue;
    q.tick += EG_DRAIN_TICK_MS;
    if (e && Math.hypot(e[1] - ax, e[3] - az) <= W.drain.r) out.push({ sub: b.sub, share: W.drain.pct, i: 0, k: 1, nm: W.name, at: now });
  }
  for (const k of Object.keys(H)) if (k[0] === 't' && !seen.has(k)) delete H[k];
  return out;
}
/**
 * EG-H1 - THE ROOM'S OWN HEALS ON THE COUNT (section 21's census: what the relay heals it restores, so no holder drains its
 * budget or skews the measure): a rest's whole heal stands each living member's count whole (bodyLife), a share heals it
 * (bodyHealed - a Rally, a Mending, a niche), the fray's lash takes its share and never the last of it, and a recall's word
 * (`rise`) stands its member at its share - a new life. EG-ZI: THE PULL'S TOLL (`toll`, to its member) is counted as a blow
 * is (bodyStruck, in the census's thousandths) - its quarters' share, and as the lash never the last of the count. The
 * frames the room fans, read; the counts moved in place. EG-ZS: the toll and the lash are shares of the body without
 * Stoneskin's cushion, taken off the whole (egCountWhole); a heal on a Stoneskin holder in LIVING WALL counts its share more
 * (egWallOf), as the holder's screen heals it (scenes/eliteGates/egClient.js applyHeal).
 * @param {any} B @param {any[]} frames @param {number} now @param {{depth: number, perS: number}} line @param {boolean} [enforce]
 */
export function egCountHeals(B, frames, now, line, enforce = EG_BODY_ENFORCE) {
  for (const f of frames) {
    if (f.k === 'rise' && B.mem[f.s]) { const m = B.mem[f.s]; bodyLife(m, now, line); m.bd.v = Math.max(0.01, Math.min(1, f.p)); continue; }
    if (f.k === 'toll') {
      const m = B.mem[f.to];
      if (!m?.in || !m.alive || m.home || !(f.q > 0)) continue;
      const W = egCountWhole(m.vs), share = Math.min(f.q * EG_TOLL_STEP, Math.max(0, (m.bd?.v ?? 1) * W - 0.01));   // EG-ZS: of the body without the cushion
      if (!(share > 0)) continue;
      bodyStruck(m, share / W, now, line);
      (m.cs ??= [0, 0, 0, 0])[3] += Math.round(share * 1000);
      continue;
    }
    if (f.k !== 'eheal' || !Number.isFinite(f.p)) continue;
    for (const [sub, m] of living(B)) {
      if (f.to && f.to !== sub) continue;
      if (f.why === 'rest' && f.p >= 1) bodyLife(m, now, line);
      else if (f.p > 0) bodyHealed(m, f.p * (egWallOf(B, sub) ? 1 + EG_WALL_X : 1), now, line, { enforce });   // EG-ZS: LIVING WALL - its share more on a Stoneskin holder standing in it
      else if (f.p < 0 && m.bd) m.bd.v = Math.max(0.01, m.bd.v + f.p / egCountWhole(m.vs));   // the lash: a setback, never a death (EG-ZS: of the body without the cushion)
    }
  }
}
/** EG-H1 - A MEMBER'S OWN WORD OF ITS BODY (`vt`, thousandths - net/bossBody.js bodySaid, INT15's pace): a mend it claims
 *  believed out of its budget; from a member the breach does not count alive, not heard. EG-ZI: a word under
 *  EG_LIFELINE_UNDER is noted (`m.lowAt`) - a hurt the count never saw is the member's own (a player owns their body), and
 *  Lifeline answers it as its client does. */
export function egBodyWord(B, sub, v, now, line, enforce = EG_BODY_ENFORCE) {
  const m = B.mem[sub];
  if (!m || !m.in || !m.alive || m.home || B.end) return false;
  if (v < EG_LIFELINE_UNDER * 1000) m.lowAt = now;
  return bodySaid(m, v / 1000, now, line, { enforce });
}
/**
 * EG-ZF (section 27.6) - WHAT A COMPANION'S SPELL HEALED IN A MEMBER, by its receiver's word (`pairs` `[healer's account,
 * points]` - the room's reading of the peer ids the word named): the recap's healing and a Court's chart (net/eliteGates/egTally.js
 * egTallyHeal, believed within the member's heal bucket), and what was believed mends the member's count - an ally's
 * mend, never its own budget's (net/bossBody.js bodyHealed, at the gate's reference health: the gate's AUDIT INT11 law).
 * EG-ZI - LIFELINE IN THE CENSUS (sections 15 and 21): a believed heal of a Lifeline holder's on a member under
 * EG_LIFELINE_UNDER - its count now, or seen so (`m.lowAt`, its own word's or the count's) within EG_LIFELINE_LOOK_MS -
 * opens a window on that member's blows (`m.ll`: `[from, until, share]`, the healer's rank's). The word says the heals of
 * its last EG_HEAL_WORD_MS, so the window runs from that far back to EG_LIFELINE_MS past the word: every blow that could
 * land inside the 3 s of a heal it says, in the struck member's favour as every judge of the relay's is (BODY_MARGIN).
 * Windows a blow can no longer be judged in (EG_TRAIL_MS) are let go. Answers the points believed.
 * AUDIT EG IV (lane3 #3; section 16.1 - "an idle account pulled from hall to hall earns nothing", AUDIT EG0 A6): A HEALER'S
 * PART IS CORROBORATED - the receiver's word alone named any entered member its healer, so a modified client made an idle
 * companion an earner with one forged word a hall. A healer's believed heal is its part in the hall (`hh`, egActiveIn) only
 * where `cast(by)` says the room relayed a cast from that healer's own socket to this member within EG_HEAL_CAST_MS (the
 * room's record - server/src/index.js `_egCastSaw`); none given, none is. AUDIT EG V (lane4 L4-7; section 21, "the relay's
 * census fells it"): AND SO IS THE MEND - the count is mended, and Lifeline opened, only by the believed heals of healers
 * `cast(by)` corroborates: a word naming a companion who cast nothing mended a modified client's count a third of a body a
 * second, and refused damage stood. The recap's healing reads the word as before.
 * @param {any} B @param {string} sub @param {Array<[string, number]>} pairs @param {number} now @param {{depth: number, perS: number}} line @param {boolean} [enforce]
 * @param {(by: string) => boolean} [cast]
 */
export function egHeal(B, sub, pairs, now, line, enforce = EG_BODY_ENFORCE, cast = () => false) {
  const m = B.mem[sub], list = Array.isArray(pairs) ? pairs : [];
  const under = !!m && ((m.bd?.v ?? 1) < EG_LIFELINE_UNDER || now - (m.lowAt ?? -Infinity) <= EG_LIFELINE_LOOK_MS);
  const had = list.map(([by]) => B.mem[by]?.ht ?? 0);
  const got = egTallyHeal(B, sub, pairs, now);
  // AUDIT EG V (lane4 L4-7): what the count is mended by - each healer's believed heal once, where its cast was relayed
  const seen = new Set(), backed = list.reduce((a, [by], i) => { const d = (B.mem[by]?.ht ?? 0) - had[i]; if (seen.has(by) || !(d > 0) || !cast(by)) return a; seen.add(by); return a + d; }, 0);
  if (backed > 0) bodyHealed(B.mem[sub], backed / healRef(B.mem[sub].lv) / egCountWhole(B.mem[sub].vs), now, line, { enforce });   // EG-ZS: a share of the whole, Stoneskin's cushion in it
  // AUDIT EG III (lane2 #3): each healer's believed heal in this hall, a share of its receiver's body (section 16.1's part)
  if (got > 0) list.forEach(([by], i) => { const q = B.mem[by], d = (q?.ht ?? 0) - had[i]; if (d > 0 && cast(by)) q.hh = (q.hh ?? 0) + d / healRef(B.mem[sub].lv); });   // AUDIT EG IV (lane3 #3): a healer the room saw cast on this member alone
  if (under && got > 0) {
    // the strongest Lifeline among the healers whose heal was believed (its credit rose) - AUDIT EG III: by a heal worth a
    // window (EG_LIFELINE_MIN of the member's reference body)
    let v = 0;
    const min = egLifelineMin(m.lv);
    list.forEach(([by], i) => { const q = B.mem[by]; if (q && (q.ht ?? 0) - had[i] >= min && cast(by)) v = Math.max(v, egVOf(q.vs, 'lifeline')); });   // AUDIT EG V (lane4 L4-7): a heal a cast backs
    if (v > 0) m.ll = [...(m.ll ?? []).filter((w) => w[1] >= now - EG_TRAIL_MS), [now - EG_HEAL_WORD_MS, now + EG_LIFELINE_MS, v]].slice(-4);
  }
  return got;
}
/** Is the breach still running at `now` (its room's beat wanted)? */
export const egLive = (B, now) => !!B && !B.end && now < B.op + EG_LAST_WORD_MS;
