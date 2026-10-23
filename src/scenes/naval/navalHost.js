// @ts-check
// NAV-H (2026-09-28, Mac: "enhance the newly integrated ships by adding proper naval combat with a huge reference to
// assassins creed black flag. Being able to aim and fire when viewing from the side. Along with this, I want to
// introduce actual sailing ships to the world that players can encounter and pillage, which should also directly
// enhance and integrate into the pirate quest system. ... directly integrate into online mode.") - THE NAVAL HOST:
// the sea fight, stood in the streaming world. It owns the ships of the Iliac Bay (systems/naval/navalAI.js) on Come
// Sail Away's own hulls (scenes/comeSailAway/comeSailAwayPool.js `spawnSeaNow` - drawn, baked and lit as the player's boats), the
// guns of the player's boat and their aim, the shots and what they strike, the smoke and the spray, boarding and
// repelling boarders, the law, its record in the save, and its word to the other players in a cell.
//
// THE WORLD HOST IS ITS ONE HOST. The sea is the streaming world's (the exterior): a building or a dungeon has no
// broadside, and the other three hosts own no sea - THE FOUR HOSTS RULE, named in bible/03-World/Naval-Combat.md.
// Every seam it reaches is in `deps` (below), so the whole of it runs in Node under the tests.
//
// deps = {
//   pool                         scenes/comeSailAway/comeSailAwayPool.js's (spawnSeaNow, remove, ready(), models, seaBoats)
//   csa() -> runtime | null      Come Sail Away's runtime (isSailing(), state.CurrentBoat, state.velocityCurrent,
//                                state.windVectorCurrent, StopSailing()) - null with the mod off
//   seaY() -> number             the sea's height in the scene
//   isWater(x, z, hull) -> bool  open water deep enough for a hull there
//   feet() -> [x, y, z]          the player's feet
//   look() -> { origin, dir }    the view's eye and its forward (the first-person eye, or Eye of the Beholder's)
//   level() -> number            the player's level
//   where() -> { px, py, region, day, nearPort, capitals, cityLights }  the waters: the map pixel, its region, the day
//                                number (the seeds and notoriety's decay), a port within reach, the three capitals'
//                                pixels (navalShips.js crownOf), the lanterns' hour (SHIP-WATCH: the night's too - a
//                                lit ship seen far, a dark one close, shipWatch.js); `port` the board's port lain at
//                                (CAPT-BOARD) - FB1020c BERTH-RING: within SEA_RING, the berth's ring, where `nearPort`
//                                is a place the port's data flags within a pixel (inPortWaters reads the two)
//   say(text, seconds), mid(text, seconds)     the HUD's line and the mid-screen word
//   audio: { play3d(key, pos, vol, opts), loop3d(key, pos, vol, opts) -> handle }
//   flame(pos) -> { move(pos), retire() }       a deck fire - Daggerfall's own fire flat (scenes/naval/navalFlames.js)
//   law: { crime(region, crime), legal(region, n), faction(id, n) }
//   board: { leaveHelm(), placePlayer(pos, yaw), deckSpots(boat, n) -> [pos, yaw][], spawnFoe(mobile, pos, yaw, side,
//            { name }?) -> handle (AUDIT NAV1: `name` - her captain's, on the target bar), foeDown(handle) -> bool, removeFoe(handle), startRaid(name) -> quest | null,
//            endRaid(quest, { withdraw, won, crew }) (AUDIT NAV1: a raid let go of ends with it - its boarders withdrawn;
//            RAID-WON: a won one ended as one thrown back ashore, and her ship gone, its crew home),
//            standDown(handle) (AUDIT NAV1: a foe who yields - hostile no more, standing where he is),
//            takeHelm(boat) (AUDIT NAV1: Come Sail Away's StartSailing - back at her wheel),
//            openPlunder(model) -> bool (false: no window could open), giveItems(items, boat | null) -> { left: items },
//            SHIP-CLAIM (optional - without the first two no prize is claimed): mintUid() (the mod's items' UID,
//            DaggerfallUnity.NextUID), packDeed(item) -> () => items (the item into the pack as the mod adds one -
//            AddItem, no weight's gate - and the pack's live list the placing spends from), terrainAt(pos) -> terrain |
//            null (the placing's nodes and pixel), redeck(from, to) (the bodies on one hull's deck stood on another's),
//            forgetDeed(item) (AUDIT HOLDINGS F8: a claim that failed - the ledger's record of her forgotten) }
//   hold(key, tier) -> items                   DFU's loot roll at the player's level (systems/loot/loot.js generateItems), its
//                                              rarity at the lot's tier (navalPlunder.js holdTier)
//   online: { id() -> string|null, peers() -> [{ id, feet }] } | null
//   sendHit(data) -> bool                     a blow or a claim to another player - AUDIT NAV1 (online #9): through the
//                                              world's hit retry queue (net/hitPend.js), held while the wire refuses
//   setting(key) -> value                      the arc's own settings (NAVAL_SETTINGS)
//   random() -> [0, 1)                         the engine draw (Port-Ledger A's rule: injectable, Math.random by default)
//   groundY(x, z) -> y, shake(amount), peerBoats() -> [{ id, pos, vel, speed }], warmAshesOn() -> bool   (optional)
//   swimming() -> bool                         AUDIT NAV1: the player in the water (a cask hauled in by hand)
//   serpent: { targets(), struck(seg, d), hold(boat), drift(boat), near() } | null   SERPENT1 (scenes/serpentHost.js):
//                                              the sea serpent's segments among the shots' targets, a ball of mine on one,
//                                              its coil's hold on my ship (the warp seam), its maelstrom's pull and a blow's
//                                              throw (the drift seam), and whether it counts as a hostile near
//   raiderSpent(raiderId)                      NAV-R: a raider ship of mine sunk, struck, taken or given the slip - spent
//                                              for its life (the Overworld's own law, scenes/world.js seaRaidSpend: and
//                                              said to the cell, OW6's raider word and its ledger)
// }

import { createShotField, insideGrown } from '../../systems/naval/navalShots.js';
import { createNavalEffects } from '../../systems/naval/navalEffects.js';
import { createNavalFeel, MY_SMOKE_FROM } from './navalFeel.js';   // COMBAT-FEEL: the near miss, the drench, the blow's side, the magazine, my hull's smoke
import { createNavalDirector, DENSITY, seedBaseOf, SEED_SALT, DESPAWN_BEYOND, DEEP_BOLD, DEEP_TIER } from '../../systems/naval/navalDirector.js';
import { createSeaShip, stepCaptain, quatOfYaw, forwardOfYaw, velocityOf, provoke, hostile, lookoutOf, fightingPower, TEMPERS, HEAR_S, RUN_OUT_S, RUN_OUT_DEG, BOW_RUN_OUT, SPARE_S, GUNS_SEEN_S, PROVOKED_S, NAVY_HUNTS, temperOf } from '../../systems/naval/navalAI.js';
import { wrapAngle, multiply } from '../../world/mat4.js';   // ONCRASH1: the port's one angle wrap; AUDIT GN-R5: a rig box turned with its boom
import { createShipDamage, shotDamage, shotMen, ballMen, playerMen, SHIP_STATES, SINK_SECONDS, SINK_CLEAR, sinkAngles, sinkDepth, BRACE_TAKEN, FIRE_CHANCE, WRECKED_OARS, repairCost, STRUCK_AT } from '../../systems/naval/navalDamage.js';
import { createGunDeck, aimSolution, volleyLaunches, bearingOf, sideForBearing, toWorld, RIPPLE_S, READY_FLASH_S } from '../../systems/naval/navalGunnery.js';
import { hullBuild, firstBuildOf, batteryOf, batteriesOf, GUNS, classById, classFor, shipNames, crownOf, classLine, SIDES, SIDE_DIR, BARREL, NAVAL_FACTIONS, HULL, PLAYER_CREW_TOUGHNESS, SHIP_TOUGHNESS, shipBatteryWeight, MOD_BUILDS, flagOf, CROWNS } from '../../systems/naval/navalShips.js';
import { createWaterGrid, errandFor, errandRng, dwellOf, offsetErrand, alongside, BERTH_SNAP_M, BERTH_WAY } from '../../systems/naval/shipLife.js';   // SHIP-LIFE
import { createHarbourBook, HARBOUR_RETRY_S } from '../../systems/naval/harbourBook.js';   // HARBOUR-BOOK: the harbours, the world's and mine
import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { orientedBox, arcPoints, flatUnit, NAVAL_DEG, rangeAt, segmentBoxEntry, shotPosition, landing } from '../../systems/naval/navalBallistics.js';
import { lawOf, createNotoriety, crownRegion, notorietyLevel, WITNESS_RANGE, KNIGHTLY_FACTION, TEMPLE_FACTION } from '../../systems/naval/navalLaw.js';
import { standingFor } from '../../systems/naval/captainLedger.js';   // CAPT-MARQUE: a rival's regard lost to a letter's prize
import { SITE_REACH_PX } from '../../systems/naval/harbourBoard.js';   // CAPT-BOARD: a held contract's waters within this of me
import { CHART_SITE } from '../../systems/naval/treasureCharts.js';   // CAPT-CHARTS: a chart's cache's site
import { etherShipNames, etherFlagOf, ISLES_FLAG, legendOfClass, LEGEND_MEND_PER_S, LEGEND_MEND_QUIET_S, LEGEND_VEIL_K } from '../../systems/naval/etherShips.js';   // ETHER-SEA: the Eltheric Ocean's ships and its legends
import { BANDS } from '../../world/ethericSea.js';   // ETHER-SEA: the waters' bands
import { STRAND_SITE } from '../etherHost.js';   // ETHER-SEA: a wild isle's strand's site
import { KNOW, falseFlagOf, merchantOfHull, glassReach, knowledgeOf, glassHolds, glassCard, coloursWords, unknownName, hullWord, GLASS_ZOOM, GLASS_ZOOM_MIN, GLASS_ZOOM_MAX, GLASS_STUDY_S, GLASS_STUDY_NEAR_S } from '../../systems/naval/shipKnowledge.js';   // SPYGLASS: what I know of a ship, and the glass
import { drawHold, flotsamKeys, choiceEffect, choiceOffer, holdTier, CHOICES, prizeDeedValue, SALVAGE_LOT, isSalvage, salvageOf, STRONGBOX_KEY, STRONGBOX_RARITY_TIER } from '../../systems/naval/navalPlunder.js';
import { mintStores } from '../../systems/naval/navalStores.js';   // SALVAGE: a wreck's stores, minted as the yard's are
import { mintDeed } from '../../systems/comeSailAway/comeSailAwayItems.js';   // SHIP-CLAIM: a claimed prize's deed, the shelf's own mint
import { createPassageBerths } from './passageBerths.js';   // PASSAGE: a berth's ship to book, and her boat made the voyage's
import { yardOffer, yardAll, fieldMend, FIELD_QUIET_S, FIELD_REFLOAT, YARD_PRICE, provisionOffer, seaRepair, wantsRepair, paidDamage, STORE_POINTS, STORES_STOCK, storesToWhole, SEA_REPAIR_UNDER_FIRE, FIELD_MEND_CAP } from '../../systems/naval/navalYard.js';
import { createCompanions, companionRows, heldAtSide, packStaysAshore } from '../../systems/naval/crewCompanions.js';   // CREW-COMPANIONS - COMPANION-DROP: the zone keeps him at my side
import { createShipCrew, reloadScaleOf, mendScaleOf, handsBonusOf, crewCard, CREW_ORDERS, ORDER_TEXT, spiritsOf, LOOKOUT_ROLE, FIRST_MATE, crewWorth, NO_WORTH, SEASONED_HIRE } from '../../systems/naval/shipCrew.js';   // SHIP-CREW; CAPT-CREW: what her posts are worth
import { crewRoster, playerCrewCount } from '../../systems/naval/crewLife.js';   // AUDIT NAV1: the shipwright, the mending at sea
import { enlistPlan, releasePlan, CREW_HALL_TEXT } from '../../systems/crewHall.js';   // SHIPYARDS: the crew hall's recruits signed on to her deck by name, and paid off
import { createBoarding, berthPose, musterOf, crewTeamOf, handsOf, repelPartyOf, raidQuestOf, raidQuestWon, raidQuestRetreated, boardingWon, BOARD_RANGE, BOARD_SPEED, ABANDON_RANGE, HAND, SURRENDER_SHARE, CREW_PER_HAND } from '../../systems/naval/navalBoarding.js';
import { navalWireRecord, validNavalRecord, navalHitData, validNavalHit, NAVAL_SHARE_RADIUS, NAVAL_VOLLEY_KEEP_MS, NAVAL_GEN_MAX, NAVAL_WIRE_VOLLEYS, NAVAL_WIRE_SPENT, TRAFFIC_DEFAULT } from '../../systems/naval/navalWire.js';
import { Boat, boatAnimators, boatParticleSystems, animatorOf, setLights, meshLocalBounds, HULL_NAMES } from '../../systems/comeSailAway/comeSailAwayBoat.js';
import { runsDark, nightSight, lampSize, lampAlpha, lampPoints, LAMP_NEAR_M, LAMP_COLOR } from '../../systems/naval/shipWatch.js';   // SHIP-WATCH: the sea by night, and my lookout
import { stowSail, vSignedAngle, CSA_BRAKE_MAX } from '../../systems/comeSailAway/comeSailAway.js';   // AUDIT GN2-RG6: sailWind's angle - AUDIT 2 XA5: the brake's bound
import { quatEuler } from '../../world/unityAnimator.js';
import { quatRotate, quatLookRotation, quatAngleAxis, mat4FromQuatPos } from '../../world/quat.js';
import { constantCurve } from '../../world/unityParticles.js';
import { amGroupRollOwner } from '../../systems/campEncounters.js';
import { NAVAL_SFX, NAVAL_CLASSIC, NAVAL_FIRE_LOOP, NAVAL_SINK_LOOP, navalSoundRange } from '../../systems/naval/navalSounds.js';
import { raiderPlan, raiderClassOf, RAIDER_DROP_M } from '../../systems/naval/navalRaiders.js';
import { pursue } from '../../systems/naval/seaLanes.js';   // AUDIT BAY A6: a packet steered along her leg
import { FADE_FLATS } from '../comeSailAway/comeSailAwayPool.js';   // AUDIT BAY A13/A14: what of a fading ship goes at half
import { NEAR_LIFE_M, FAR_LIFE_EVERY, farLifeStep } from '../comeSailAway/farLife.js';   // BOAT-FAR: her rigging's life by her range, the pool's law too
import { segmentOfTarget } from '../serpentHost.js';   // SERPENT1: a sea serpent's segment among the shots' targets
import { intoDeck, outOfDeck, mainLevel, DECK_STEP } from '../../systems/naval/navalDeck.js';   // AUDIT NAV2 F36: the feet in her deck's frame (aboardShip); QUAYS: her rail where the gangway lands
import { CAPSULE_RADIUS } from '../../player/motor.js';   // AUDIT GN-D3: aboard under her main deck, a body's own reach (standsOn)
import { createGalleonGunDeck } from '../../systems/naval/galleonGunDeck.js';   // GALLEON: her shutters and guns at work
import { timeScale } from '../../systems/timeScale.js';   // AUDIT GN2-GN3: the real clock another player's word comes on
import { sharedSea, seaSeconds } from '../../systems/naval/seaClock.js';   // TIME-DILATION: a shared sea keeps real time
import { markStolen } from '../../systems/stolenGoods.js';   // STOLEN-GOODS AUDIT S4: a lawful ship's hold, taken by Piracy, is stolen goods
import { dockFor, madeFast, warpStep, quaySide, landwardOf, quayFrame, quayToScene, sceneToQuay, gangwayFoot, DOCK_WAY, DOCK_REACH_M, DOCK_REFUSED, GANGWAY_REACH, GANGWAY_ASHORE, GANGWAY_FACING, gangwaySide, QUAY_GAP, QUAY_WIDTH, QUAY_DECK_UP } from '../../systems/naval/quays.js';   // QUAYS: docking at a harbour's quays
import { foul, fouledBy, foulLeft, foulSaid, boardableState } from '../../systems/naval/navalFoul.js';   // RAM-BOARD: a ram fouls her, and a fouled ship is boarded as she stands
import { t } from '../../systems/textManager.js';   // RAM-BOARD: its words in the player's language
import { shotGun, shotFireChance, shotRigFire, naturalShot } from '../../systems/naval/shotKinds.js';   // SHOT-KINDS: what a battery is loaded with
import { captainWorth, struckGun, statScale } from '../../systems/naval/captainTree.js';   // CAPTAIN-TREE: what her captain's stars do at sea
import { createNavalLoads } from './navalLoads.js';   // SHOT-KINDS: the captain's choice of load, at the helm
import { createVolleyTally } from './navalTally.js';   // AUDIT NAV1 G17: my volley's tally - CARD-CREW: and her men it took
import { seaLiveryOf, seaFlagsOf } from '../../systems/naval/seaColours.js';   // SEA-COLOURS: the sea's ships in their own paint and flags
import { liveryCode } from '../../systems/naval/shipLivery.js';
import { noteAct } from '../../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests
import { captainsDue } from '../../systems/sigil/sigilSetPowers.js';
import { dueOnHull, legendTidemail } from './navalSeaSet.js';   // SEA-SET: the Captain's Due on my ship's hull, a legend's Tidemail piece (AUDIT SEA VENTURES D12: out of this host)
import { createTreasureFleet } from './treasureFleet.js';   // SEA-EVENTS: the treasure fleet's ships, stood and steered
import { createNavalPvp } from './navalPvp.js';   // SHIP-PVP: the open sea's guns' seams
import { strikeShip } from '../../systems/sea/seaEvents.js';   // SEA-EVENTS: the Aether Storm's lightning on my ship
import { createBerthWatch } from './navalBerth.js';   // FIELD BUGS 2026-10-21b VOYAGE-HOLD: the berth, still or not, and the helm let go in port

/** The record's name in the save's per-mod slot (systems/modSaveData.js) - the port's own, as the Sigil Broker's is. */
export const NAVAL_SAVE_VENDOR = 'NavalCombat';
/** The save record's shape version. */
export const NAVAL_SAVE_VERSION = 1;
/**
 * TOUGHER-SHIPS (2026-10-03): a saved boat's record with her hurts on her hull's whole now - her hull and canvas each the
 * share of the whole they were saved against: her record's own `maxHull` and `maxSail`, or - a record from before the
 * hulls were toughened, which says neither - her hull's first build's (navalShips.js firstBuildOf); and her part-spent
 * store's `credit` (work points, a hull point a point) by her hull's. A boat saved whole loads whole, never at the share
 * of a toughened hull her old numbers make.
 * @param {any} rec @param {number} hull @param {{ maxHull: number, maxSail: number }} whole
 */
export function savedHurts(rec, hull, whole) {
  const first = firstBuildOf(hull);
  const was = (v, fallback) => (Number.isFinite(v) && v > 0 ? v : fallback);
  const share = (v, then, now) => (Number.isFinite(v) && then > 0 ? (v / then) * now : v);
  const thenHull = was(rec.maxHull, first.hullHp);
  const out = { ...rec, hull: share(rec.hull, thenHull, whole.maxHull), sail: share(rec.sail, was(rec.maxSail, first.sailHp), whole.maxSail) };
  if (Number.isFinite(rec.credit)) out.credit = share(rec.credit, thenHull, whole.maxHull);
  // read on the very whole she was saved on (the build that saved her, no refit since): her hurts to the bit, as they
  // stood (`exact` - FG-05's law: a save and a load lose no fraction of her mending nor of her fires' work)
  const x = rec.exact;
  delete out.exact;
  if (x && typeof x === 'object' && x.maxHull === whole.maxHull && x.maxSail === whole.maxSail && Number.isFinite(x.hull) && Number.isFinite(x.sail)) {
    out.hull = x.hull; out.sail = x.sail;
    if (Number.isFinite(x.credit)) out.credit = x.credit;
  }
  return out;
}
/**
 * TOUGHER-SHIPS: a boat's record as the save keeps it - ON HER FIRST BUILD'S SCALE (navalShips.js firstBuildOf), her hull,
 * canvas and part-spent store's credit the share of it they are now (to the hundredth), and that whole said
 * (`maxHull`, `maxSail`): an older build reads her hurts as the points they always were (a save carried back to one
 * neither heals her nor wrecks her), and this one reads them as the share they are (savedHurts). Built on the damage's
 * `saveData` (each fire and the crew's burn kept - main's, at this branch's merge of #574), and `exact`: her hurts and
 * credit as they stand on her whole now, read to the bit by a build whose whole for her is the same (an older one, or a
 * refit, reads the share).
 * @param {ReturnType<typeof createShipDamage>} damage @param {number} hull @param {number} credit
 */
/** Her powder, her crew and (SHOT-KINDS) her guns' loads as a save keeps them (`st` a boat of mine's state) - the loads
 *  only when one is not her bores' own. */
function gunsRecord(st) {
  const loads = st.guns.snapshot().loads;
  return { barrels: st.guns.barrels, mates: st.crew.snapshot(), ...(Object.values(loads).some(Boolean) ? { loads } : {}) };
}
export function savedRecord(damage, hull, credit) {
  const first = firstBuildOf(hull);
  const on = (v, now, then) => (now > 0 ? Math.round((v / now) * then * 100) / 100 : 0);
  return { ...damage.saveData(), hull: on(damage.hull, damage.maxHull, first.hullHp), sail: on(damage.sail, damage.maxSail, first.sailHp),
    maxHull: first.hullHp, maxSail: first.sailHp, credit: on(credit, damage.maxHull, first.hullHp),
    exact: { maxHull: damage.maxHull, maxSail: damage.maxSail, hull: damage.hull, sail: damage.sail, credit } };
}
/** SHIP-LIFE: a harbour's moored ships stand while its mouth is within HARBOUR_STAND of the player (m) - ashore too -
 *  and go, to be stood again the same on the player's return, past HARBOUR_LEAVE; HARBOUR_ROLL of them (a draw in the
 *  range, never more than her berths), HARBOUR_NAVY of them the crown's, off a stream seeded by the port and the day
 *  (HARBOUR_SALT) - every player in that port sees the same ships in the same berths. */
export const HARBOUR_STAND = 1200;
export const HARBOUR_LEAVE = 2600;
export const HARBOUR_ROLL = Object.freeze([2, 4]);
export const HARBOUR_NAVY = 0.25;
export const HARBOUR_SALT = 0x4a7b;
/** SHIP-FADE (2026-10-02, Mac: "Ships should just disappear into the void. If theyre going out to open sea, they should
 *  fade away"): the seconds a ship takes to come into the world (every ship stood) and to leave it - one let go by her
 *  range (the director's, a raider sailing on, a harbour left behind, a lane's packet sailing out of sight, a peer's
 *  ship out of their word), never one sunk, taken or handed over: she dissolves as she sails on, and is gone when she
 *  has. One of mine fired on as she fades comes about and stays (she fights). */
export const SHIP_FADE_S = 4;
/** SEA-LANES (2026-10-02, Mac: "ships should be more persistant and actively engage with multiple docks and multiple
 *  pathways around daggerfall"): a lane's packet within LINER_STAND_M of the player is stood (systems/naval/seaLanes.js,
 *  the world's feed), and let go past LINER_DROP_M; at most LINERS_MAX under way by the Ships at sea (few, some, many) -
 *  one lying in a harbour I know stands while a berth is free, as the harbour's own do. */
export const LINER_STAND_M = 1200;
export const LINER_DROP_M = 1700;
export const LINERS_MAX = Object.freeze({ 0: 0, 1: 1, 2: 2, 4: 3 });
/** AUDIT BAY A6: a packet under way steers for the point LINER_LOOKAHEAD_M on along her leg from where she is
 *  (seaLanes.js pursue) - never for her place on the clock, which took her straight across the land a lane goes round,
 *  and back for it when she outsailed it; within LINER_PORT_M of her leg's end she is at her port. */
export const LINER_LOOKAHEAD_M = 300;
export const LINER_PORT_M = 500;
/** AUDIT SHIP-LIFE B3: the level a harbour's ships are drawn at - the port's, never a player's (two players' levels
 *  drew two fleets into one port's berths). */
export const HARBOUR_LEVEL = 10;
/** AUDIT SHIP-LIFE B7 (HARBOUR-BOOK: kept with the harbours now, systems/naval/harbourBook.js). */
export { HARBOUR_RETRY_S };
/** The port's key folded into a seed - a string's own hash (FNV-1a). */
const keyHash = (k) => { let h = 0x811c9dc5; for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 0x01000193); return h >>> 0; };
/** A ball's report heard as the near boom within this (m); past it the far one. */
export const NEAR_BOOM_M = 260;
/**
 * AUDIT NAV1 (the presentation) - THE MIX. The near reports and the far roll are crossfaded over FAR_FADE_M either side
 * of NEAR_BOOM_M, equal in power (the far clip, a broadside's roll across the bay, stood 6.5 dB over the near at the
 * switch: a gun got louder going away) - the roll once a volley (it was played once a GUN: a seven-gun ripple stacked
 * fourteen thumps), at FAR_MATCH times the root of her guns, the near reports' own power at the switch (both clips'
 * RMS through their references - navalSounds.js). Each report its own - GUN_PITCH_JITTER in pitch, GUN_GAIN_JITTER_DB
 * in level (every gun was one clip at pitch 1) - and my own ripple at one over the root of its guns (six reports at full
 * level, 90 ms apart, summed to +3.4 dBFS at the default volume, 11% of samples clipped at full: the bus has no
 * limiter). A sound past its range's end is not played (the inverse law never reaches silence: 0.006 at 5 km).
 */
export const FAR_FADE_M = 60;
export const FAR_MATCH = 0.46;
export const GUN_PITCH_JITTER = 0.06;
export const GUN_GAIN_JITTER_DB = 2;
/** AUDIT NAV1 (the presentation): a ball of mine striking her hull is heard at this reference (m) - the crunch that says
 *  a hit (at the hull's own 16 m it came to my helm 19 dB down from 150 m, under the ripple's roll). */
export const HIT_CONFIRM_REF_M = 60;
/** ...and a hull hit's splinters, flash and smoke are thrown full size within HIT_BURST_M of the eye and grown with the
 *  distance past it, to HIT_BURST_MAX times (a 0.3 m splinter at 150 m was two pixels; the flash eight, for 0.08 s). */
export const HIT_BURST_M = 50;
export const HIT_BURST_MAX = 3;
/** AUDIT NAV1 (the presentation): each gun of mine kicks the camera as it goes, by its kind (the broadside shook it
 *  once, 1.2 - under the Thunderlock pistol's 3); a powder barrel going up on my deck shakes it BLAST_SHAKE (it shook
 *  1.6, under a holed ball's 2.5). */
export const GUN_KICK = Object.freeze({ long: 1.1, heavy: 1.6, swivel: 0.45, chain: 0.9 });
export const BLAST_SHAKE = 3.2;
/** AUDIT NAV1 (the presentation, #17): HER RIGGING'S LIFE BY HER RANGE - NEAR_LIFE_M and FAR_LIFE_EVERY, born here and
 *  re-exported: BOAT-FAR moved them and the law's step (farLifeStep) to scenes/comeSailAway/farLife.js, which the Come
 *  Sail Away pool and the peers' boats read as poseShip does. */
export { NEAR_LIFE_M, FAR_LIFE_EVERY };
/** NAV-FAR-AI (2026-10-12, a player's live client walking the coast: the captains of the sea's ships were 12% of the
 *  main thread and some 29% of what it allocated - every ship of mine, every frame, the adopted ones hundreds of km off
 *  among them): A FAR CAPTAIN KEEPS HER WATCH EVERY FAR_LIFE_EVERY FRAMES, on the time she missed (never more than
 *  FRAME_STEP_S at once, the sea's own step) - past FAR_WATCH_M of the eye, where she stands no hull to be seen
 *  (PEER_HULL_FAR_M), afloat and in no fight (hers, or one that targets her), nor lashed to a prize. Her damage, her
 *  fires and her sinking keep every frame's clock. */
export const FAR_WATCH_M = 5500;
/** NAV-FAR-AI: a far captain's frame between her watches - nothing fired, nothing run out. */
const NO_WATCH = Object.freeze({ volleys: Object.freeze([]), barrels: Object.freeze([]), grapple: null, runOuts: Object.freeze([]) });
/**
 * NAV-FAR-AI: WHETHER ONE OF MY SEA'S CAPTAINS KEEPS A FAR WATCH - past FAR_WATCH_M of the eye, afloat, in no fight of
 * her own (engage or board), lashed to no prize, and no ship's target in a fight (`fought()`, asked last: the targets
 * of every ship in one).
 * @param {any} e a sea entry @param {number[]|null} eye @param {() => Set<string>} fought
 */
export function watchesFar(e, eye, fought) {
  const s = e.ship;
  return !!eye && s.damage.state === SHIP_STATES.afloat && s.mode !== 'engage' && s.mode !== 'board' && !s.lashed
    && Math.hypot(s.pos[0] - eye[0], s.pos[2] - eye[2]) > FAR_WATCH_M && !fought().has(e.id);
}
/** PEER-HULL-RANGE: ANOTHER'S SHIP FAR OFF STANDS NO HULL HERE. Every peer in the room says their sea in their word
 *  (applyWord), so a client held every player's ships wherever they sailed - 30-40 of them, most 80-700 km off - and
 *  Come Sail Away's pool walked and baked each one every frame (scenes/comeSailAway/comeSailAwayPool.js frame: her objects' walk and
 *  her sails' FixDeformations), a third of the main thread on a desktop (38-45 FPS against 103-150 with them gone).
 *  Her record sails on as ever (her stander's word, her fires, the claims); only her hull waits: built within
 *  PEER_HULL_NEAR_M of the eye, back to the pool past PEER_HULL_FAR_M (the gap keeps one on the edge from being built
 *  and torn down frame by frame). Both past where a peer's own sea reaches me (NAVAL_SHARE_RADIUS + LINER_DROP_M).
 *  AUDIT PEER-HULL-RANGE: AND PAST THE FOG ON EVERY LANE - the first cut's 3,000 / 3,500 m stood inside it (the enhanced
 *  lane's linear fog ends at 2400 x Land View / 3, world/weather.js scaleFogForDistance: 4,000 m at its default 5,
 *  4,800 m at 6), so a ship came into being 63-75% fogged. At 5,000 m every row DFU, the port and Dynamic Skies draw
 *  has closed (test/systems/naval/peerhullrange.test.js); the ships this is for were 80-700 km off, so the frame's saving is the same. */
export const PEER_HULL_NEAR_M = 5000;
export const PEER_HULL_FAR_M = 5500;
/** OWN-HULL-RANGE (2026-10-12, a player's live client travelling the overworld: 14 hulls 9-727 km off, 90 -> 37 FPS
 *  while they stood - their sails baked, their particles drawn, their rigging stepped every frame): MY OWN SEA'S SHIP FAR
 *  OFF STANDS NO HULL EITHER. A ship with no owner is this tab's - the traffic, the raiders, the packets, a port's moored
 *  ships, a bounty's quarry, the legends - and every ship a peer leaves behind (releaseOwner adopts them wherever they
 *  lie, so PEER-HULL-RANGE's 80-700 km came back as mine). Her record sails, fights, burns and sinks as ever (the
 *  captains, the director and the damage read her record, never her hull); her hull waits past the same edges - but
 *  for what still reads her BY her hull wherever she is (`hullKept`). */
/**
 * OWN-HULL-RANGE: WHETHER ONE OF MY OWN SEA'S SHIPS KEEPS HER HULL, however far: bodies on her deck, the boarding I am
 * in, a prize not yet settled (`claimPrize` moves her deck by her hull), a fight - hers (`mode` engage or board,
 * afloat) or one that targets her (`fought`, the targets of every ship in one): a shot lands only on a hull
 * (`targets`) and a galley rams only one (`checkShipRams`), so a fight between hull-less ships would never end.
 * @param {any} e a sea entry @param {{ fought: Set<string>, boardingId?: string|null }} at
 */
export function hullKept(e, { fought, boardingId = null }) {
  const s = e.ship;
  return !!e.deck?.length || (boardingId != null && boardingId === e.id) || (!!e.prize && !e.prize.fate)
    || (s.damage.state === SHIP_STATES.afloat && (s.mode === 'engage' || s.mode === 'board')) || fought.has(e.id);
}
/**
 * AUDIT NAV1 (the presentation, #14) - THE SEA AT A GLANCE (one card for the ship within 6 degrees of the look was all
 * the sea said, and a pirate turning on me said nothing). A TAG over each ship within NAVAL_TAG_RANGE of the eye and
 * past NAVAL_TAG_NEAR (nearer, she fills the view), NAVAL_TAG_MAX of them nearest first - her name, her hull, what
 * she is to me and her state - TAG_LIFT over her highest spar as she stands (the host's `tags`; the world projects
 * them, ui/naval/navalHud.js drawNavalTags wears them). And the lookout's SAIL HO! as a ship afloat turns hostile within
 * SAIL_HO_RANGE - her class, and where she bears off my bow at the helm - SAIL_HO_GAP_S apart at the least, looked
 * for every SAIL_HO_CHECK_S.
 */
export const NAVAL_TAG_RANGE = 700;
export const NAVAL_TAG_NEAR = 25;
export const NAVAL_TAG_MAX = 8;
export const TAG_LIFT = 2.5;
/** SPYGLASS: the glass is held on a ship this far over her waterline (m) - her hull's middle, not the sea at her foot. */
export const GLASS_AIM_LIFT = 3;
/** GLASS-CLEAR: how long (s, the sea's clock) the box of the ship I stand aboard keeps her spars before they are taken
 *  again (ownExtent) - her canvas, which its booms swing, is taken each frame. */
export const OWN_SPARS_S = 0.5;
/** CAPT-BOARD - THE SITES: a held contract's waters asked after this often (s); a wreck's casks float this long (s) and
 *  lie scattered this far about her (m); a quarry's point is this far ahead of the captain where the world names none. */
export const SITE_CHECK_S = 1;
export const SITE_CASK_LIFE = 1200;
export const SITE_CASK_SPREAD = 40;
export const SITE_AHEAD_M = 700;
/** The three crowns by name (a false flag's crown's region - its traders' names). */
const CROWNS_BY_NAME = new Map(CROWNS.map((c) => [c.name, c]));
/** ETHER-SEA (AUDIT CAPTAIN'S SEA D2): a strand's haul floats this far off the boat that pulled in for it (m). */
export const STRAND_ALONGSIDE_M = 40;
/** A wreck's cask's lot: `site:<the contract's id>`. */
export const SITE_LOT = 'site:';
export const isSiteLot = (lot) => typeof lot === 'string' && lot.startsWith(SITE_LOT);
/** CAPT-CHARTS: a cache raised pays this many of a strongbox's lots. */
export const CACHE_LOTS = 2;
export const SAIL_HO_RANGE = 900;
export const SAIL_HO_GAP_S = 8;
export const SAIL_HO_CHECK_S = 0.5;
/**
 * AUDIT NAV1 (the presentation, #15) - HER HURTS SEEN (they showed nowhere but the card: no smoke, no list, no canvas
 * lost, no wreckage). Under SMOKE_FROM of her hull she smokes along SMOKE_SPAN of her deck each way from amidships, more
 * as it falls (the effects' `smolder`), from the part the sea has not reached; under DAMAGE_LIST_FROM she lists, to
 * DAMAGE_LIST_MAX at nought, to the side she will go down on, taken on as she fills (DAMAGE_LIST_EASE_S - a hit
 * snapped her over) and the sinking's own list takes it on from there (its last pose unchanged); her canvas comes down
 * with her sail share, her highest sails first; and a ball into her hull sheds TIMBER_PER_HIT planks that float and
 * drift (a heavy ball one more).
 */
export const SMOKE_FROM = 0.6;
export const SMOKE_SPAN = 0.6;
export const DAMAGE_LIST_FROM = 0.4;
export const DAMAGE_LIST_MAX = 8;
export const DAMAGE_LIST_EASE_S = 2.5;
export const TIMBER_PER_HIT = 2;
/** The part of the line `a`-`b` over `floor` (its y): the whole, the part up to where it meets it, or null under it. */
export function lineOver(a, b, floor) {
  const ua = a[1] >= floor, ub = b[1] >= floor;
  if (ua && ub) return [a, b];
  if (!ua && !ub) return null;
  const k = (floor - a[1]) / (b[1] - a[1]);
  const cut = [a[0] + (b[0] - a[0]) * k, floor, a[2] + (b[2] - a[2]) * k];
  return ua ? [a, cut] : [cut, b];
}
/** The sails she shows for her sail share: her highest furled away first - `n` of them, `share` 0..1. */
export const sailsShown = (n, share) => Math.max(0, Math.min(n, Math.ceil(n * Math.max(0, share) - 1e-9)));
/** A bearing off the bow (degrees, starboard positive) in a lookout's words. */
export function bearingWords(b) {
  const a = Math.abs(b), side = b > 0 ? 'starboard' : 'port';
  if (a < 22.5) return 'dead ahead';
  if (a < 67.5) return `off the ${side} bow`;
  if (a < 112.5) return `on the ${side} beam`;
  if (a < 157.5) return `off the ${side} quarter`;
  return 'dead astern';
}
/** "A Pirate Brigantine", "An Iliac ..." */
export const withArticle = (w) => `${/^[aeiou]/i.test(w) ? 'An' : 'A'} ${w}`;
/** A muzzle's light: its reach (m) and its life (s). */
export const MUZZLE_FLASH_RANGE = 26;
export const MUZZLE_FLASH_S = 0.12;
/** A muzzle's flash, and a burning deck's glow: their colours (colour x intensity), the glow's reach (m), and how
 *  many burning ships light the scene at once. */
export const MUZZLE_FLASH_COLOR = Object.freeze([1.35, 1.0, 0.6]);
export const BURN_COLOR = Object.freeze([1.25, 0.72, 0.36]);
export const BURN_RANGE = 16;
export const BURN_LIGHTS = 3;
/** A ship within this of the player stands in the world's collider (its deck walkable, its hull a thing to strike). */
export const COLLIDE_RANGE = 180;
/** A boarding's deck spots: the least a ship offers before the rest share. */
export const HANDS_AROUND = 2.2;
/** A player on foot goes over a struck ship's rail within this of her side (m). */
export const FOOT_BOARD_M = 14;
/** Enemies near, for Come Sail Away's time scale: a hostile ship within this (m). */
export const HOSTILE_NEAR_M = 700;
/** AUDIT NAV1 (B14): feet this near a sea ship's hull box stand on her deck (m) - no save there. AUDIT NAV2 F36: and
 *  aboard, feet this near a floor of hers (by her rail, past her deck's inset edge). */
export const DECK_REACH_M = 1;
/** AUDIT NAV1 (the boarding audit's minor): a swimmer's reach for a cask - the box about the feet it must come into. */
export const SWIM_REACH = Object.freeze([0.6, 1.2, 0.6]);
/** The collector a swimmer's cask is hauled by (never a boat's). */
export const SWIMMER = 'me:swim';
/**
 * SEA-PEACE (2026-09-29, the player: "People shouldnt get attacked if not on a ship, some ships should be passive, not
 * all should be hostile. Enemy AI and Friendly AI should engage in their own encounters naturally"). THE SEA'S GUNS ARE
 * FOR THOSE ABOARD (`aboardShip`: at a helm, on a boat of mine, on a sea ship's deck): off every ship - ashore, on a
 * quay, in the water - no captain takes the player (the contacts had that) and NOTHING ELSE DID EITHER: the time scale,
 * a rest, a journey (OW6's threats), the shipwright, the mending's quiet and the lookout's "Sail ho!" each asked a
 * pirate's hostility alone, so a pirate a bay away held a player on the beach as an enemy nearby. A PRIZE TAKEN (the
 * captain's own, navalAI.js): a ship that struck to a captain of mine is boarded by her - grappled, the two lashed for
 * PRIZE_TAKE_S, and then fired, the victor's crew thinned by PRIZE_COST of the men the prize had left (the fight for her
 * deck - never the victor's last man) - and a victor struck by a ball casts off to fight. THE NEWS of a fight between ships reaches the player's HUD within NEWS_RANGE of them, or
 * when it is theirs. GUNFIRE is heard for HEAR_S (navalAI.js HEAR_GUNS_M): at most GUNFIRE_KEEP volleys kept.
 */
export const PRIZE_TAKE_S = 18;
export const PRIZE_COST = 0.5;
export const NEWS_RANGE = 1200;
export const GUNFIRE_KEEP = 24;
/**
 * SEA-EASE (2026-10-01, Mac: "Friendly AI should help the player in combat") - THE RELIEF AND THE STRAY. A lawful
 * player is in DISTRESS (`distressAt`) while a pirate I stand fights them - engaged on them or coming alongside - and no
 * crown's ship that does not hunt them sails within RELIEF_NEAR_M of them: the director rolls a navy ship for them
 * (navalDirector.js THE RELIEF) and her course is laid for where they were, kept until her lookout has a fight (the
 * guns she sails for are not one) or she is within RELIEF_REACHED_M of it. A crown's ship that takes on a pirate
 * fighting me says so, once ("comes to your aid!"). And a ball of mine that strikes a crown's ship of mine fighting a
 * pirate - an aid in the melee - is a STRAY, not a feud, while what I have struck her for stays under ALLY_STRAY_SHARE
 * of her hull: no charge, no provocation, no witnesses, and "Check your fire!" said once; past it, the law as ever. A
 * peer's ball on her is weighed the same.
 */
export const RELIEF_NEAR_M = 900;
export const RELIEF_REACHED_M = 250;
export const ALLY_STRAY_SHARE = 0.15;
/** AUDIT NAV1 (B10): the spots a boarded deck is dealt out by - every body on it one of these, shuffled once. */
export const DECK_SPOTS = 16;
/** AUDIT NAV2 F32/F44: the least room between two bodies a boarding stands (m) - two bodies' breadth. */
export const BODY_GAP = 0.9;
/** The share's hysteresis (DEEP-SHARE's): one who stands the sea keeps it until a lower id is within the radius;
 *  one who does not takes it only when every lower id is past this many radii. */
export const SHARE_HYSTERESIS = 1.25;
/** The ram: the closing speed a bow must strike at (m/s), and what it does a metre a second. */
export const RAM_SPEED = 1.6;
export const RAM_DAMAGE = 14;
/** A galley's ram multiplies what it deals, and takes this share back. */
export const GALLEY_RAM = 3;
export const RAM_RECOIL = 0.3;
/** The men a ram's blow takes: one for every RAM_A_MAN of the hull it deals - what the wire says (`ramMenSaid`) - and
 *  TOUGHER-SHIPS: over her crew's toughness on the `roll`, as a ball's (navalDamage.js ballMen), where she is stood -
 *  CREW-HOLD: a player's ship's PLAYER_CREW_TOUGHNESS (`tough`). */
export const RAM_A_MAN = 40;
export const ramMenSaid = (dealt) => Math.round(dealt / RAM_A_MAN);
export const ramMen = (dealt, roll, tough) => ballMen(dealt / RAM_A_MAN, roll, tough);
/** One ram a ship a stretch (s). */
export const RAM_COOLDOWN_S = 3;
/** AUDIT NAV1 (the helm): the ram strikes from her STEM (the hull's own bowZ) within RAM_REACH of the other's box - the
 *  collider stops a stem at the planking it meets; it read a point `beam * 2.4` out, 1.2 m short of a Small Ship's stem
 *  and 29 m inside a galley's, so no ram ever landed - at the way she came in with, the most of the last RAM_MEMORY_S
 *  (Come Sail Away takes a bow's way off it the frame it meets a hull), less the other's own way along her course. A
 *  stem not built to ram takes BOW_RECOIL times RAM_RECOIL back, a galley's ram a GALLEY_RAM-th of it. */
export const RAM_REACH = 1.2;
/** AUDIT NAV1 (the helm): HEAVE TO - a struck ship in reach with the helm too fast to board (the refusal said nothing:
 *  under sail W/S do nothing, and a Small Ship at 8.2 m/s took 28 s and 151 m to lose her way with her sails struck):
 *  Activate strikes the sails and brakes her, her way off at HEAVE_TO_DECEL (m/s^2, Come Sail Away's `brake` seam) for
 *  HEAVE_TO_S at most, until she is under BOARD_SPEED - then the grapples are the key's. HELM-WAY: a brake of its own
 *  number - it was ten times her own coast, which the Ship handling choice now moves (a Small Ship's 0.2 m/s^2 made 2). */
export const HEAVE_TO_DECEL = 2;
/** AUDIT NAV1 (the helm): the sea's ships stand on the compass within this (m) - the target card's own reach. */
export const COMPASS_SHIP_RANGE = 900;
/** AUDIT NAV1 (the helm): MY GUN CREWS' SKILL (navalGunnery.js volleyLaunches) - a full crew's, or my own hand at a boat
 *  that carries none, is PLAYER_SKILL; a crew thinned by grape and boarders lays wider, down to PLAYER_SKILL_THIN at
 *  none (it was PLAYER_SKILL whatever was left of them). */
export const PLAYER_SKILL = 0.6;
export const PLAYER_SKILL_THIN = 0.3;
export const HEAVE_TO_S = 8;
/** AUDIT SHIPS A3 (2026-10-06, Mac: "Audit everything"): HER WAY OFF BESIDE HER - the brake sized to the way she heaves to
 *  at, so it comes off within HEAVE_TO_M (m) at HEAVE_TO_DECEL at the least (heaveToDecel): at SAIL-FREE's ways the fixed
 *  2 m/s^2 ran a galleon 50-64 m and a Carrack 73-93 m (8.5 s, past HEAVE_TO_S) before she came under BOARD_SPEED, out of
 *  BOARD_RANGE of the ship she hove to beside. Under HELM-WAY's ways (8.2 m/s, 1.6 m/s^2 by this) it is 2 as it was. */
export const HEAVE_TO_M = 20;
/** AUDIT SHIPS A3: the brake (m/s^2) that takes a way of `v` m/s down to BOARD_SPEED within HEAVE_TO_M - AUDIT 2 XA5
 *  (2026-10-06): never past the runtime's own bound on a brake (comeSailAway.js CSA_BRAKE_MAX), so the brake asked is
 *  the brake she gets. */
export const heaveToDecel = (v) => Math.min(CSA_BRAKE_MAX, Math.max(HEAVE_TO_DECEL, (v * v - BOARD_SPEED * BOARD_SPEED) / (2 * HEAVE_TO_M)));
/** AUDIT 2 XA5: the metres she runs to BOARD_SPEED heaving to at a way of `v` m/s - HEAVE_TO_M, or farther where her way
 *  asks more than CSA_BRAKE_MAX (a storm's: a Carrack on her quarter at 38.9 m/s runs 37.7 m). The heave-to is offered by
 *  where it leaves her (heaveFor): offered beside a struck ship at that way, she ran past BOARD_RANGE of her. */
export const heaveToRun = (v) => Math.max(0, (v * v - BOARD_SPEED * BOARD_SPEED) / (2 * heaveToDecel(v)));
/** AUDIT NAV1 (the helm): THE SHIPWRIGHT stands at a port - a port town's waters (`inPortWaters` - FB1020c BERTH-RING), her way under
 *  YARD_SPEED (she lies to his quay) and no hostile ship near (systems/naval/navalYard.js). */
export const YARD_SPEED = 2.5;
export const RAM_MEMORY_S = 0.6;
export const BOW_RECOIL = 2;
/** Another player's ship eases toward its word at this rate (per second) and snaps past this far (m) - the team's law
 *  (systems/horse/horseCartWire.js easeToward), a ship's scale. */
export const PUPPET_EASE = 6;
export const PUPPET_SNAP_M = 25;
/** PUPPET-GLIDE (FIELD BUGS 2026-10-02d, Discord: "Ai ships move very janky and quick"): another player's ship UNDER WAY
 *  sails on between their words at the way her word says, along her own heading, and the gap to where the word puts her
 *  is taken up at PUPPET_CATCH a second, never faster than PUPPET_CATCH_MPS plus PUPPET_CATCH_SHARE of her way. Eased
 *  straight onto each word (PUPPET_EASE), a word's latency read as her place: every word a little late or early
 *  (a relay's 50-400 ms) moved the point she eased to by her way times the difference - a galley at 4 m/s was drawn at
 *  up to 10, lurching each word, a step astern in sixty frames; gliding she is drawn within a fifth of her way, never
 *  astern, and half as far off her stander's. A ship lying still, struck, going down or orphaned is still eased onto
 *  her word. */
export const PUPPET_CATCH = 1;
export const PUPPET_CATCH_MPS = 0.3;
export const PUPPET_CATCH_SHARE = 0.1;
/** How often the room's roster is read for owners who left (s), and how long a quiet owner's ships stand (s). */
export const OWNER_SWEEP_S = 2;
export const OWNER_STALE_S = 6;
/**
 * AUDIT NAV1 (online) - THE SEA HANDED ON. A ship's SEED is who she is in every client's sea (a stander's traffic
 * salted with its own id - `idSalt` - so two standers never launch twins; a raider's the raider's own). Her word
 * carries her handover's count `gen`, and of two players saying one seed, the greater count holds her, on a tie the
 * lower id (`claimBeats`, the stander law's own tie-break). A ship is TAKEN OVER at one past it: by the player who
 * would stand the sea when her stander is gone from the cell or quiet past OWNER_STALE_S (the heir - she sails on,
 * where she vanished mid-fight), and by her boarder at the grapple (the haul, the fight, the prize and her fate in one
 * world, where the boarder's copy was hauled 23 m from the stander's). Anyone else keeps a departed stander's ships
 * where they were for ORPHAN_S, for the heir's word to claim them - the same hulls, never rebuilt - and lets them go
 * after. Between words another's ship sails on along her course at her way (PREDICT_MAX_S at most), eased as ever.
 */
export const ORPHAN_S = 8;
export const PREDICT_MAX_S = 2.5;
/** AUDIT NAV1 (online #10): a ship of mine alongside another player's boat says her grapple to them this often (s) -
 *  theirs to take her over; the word they send back says whether they let pirates board them. */
export const GRAPPLE_CLAIM_S = 2;
/** AUDIT NAV1 (online #14): the most new volleys one peer's words fly here in NAVAL_VOLLEY_KEEP_MS - twice what one word
 *  says, room for a stander whose broadsides outran its word (the rest are said later, with their age); nothing bounded
 *  a word that said NAVAL_WIRE_VOLLEYS new ones every time. */
export const PEER_VOLLEYS_MAX = 2 * NAVAL_WIRE_VOLLEYS;
/** AUDIT NAV1 (online #15): a claim on another's cask - said again this often (s) while it waits for its owner's answer,
 *  and given up past CLAIM_WAIT_S (another's haul, or its owner gone); an answer given kept GRANT_KEEP_S, so a claim said
 *  again after a lost answer is answered again, never twice. */
export const CLAIM_AGAIN_S = 2;
export const CLAIM_WAIT_S = 10;
export const GRANT_KEEP_S = 30;
/** Whether a claim on a ship - her handover count `gen` said by `id` - holds her over another's. */
export const claimBeats = (gen, id, otherGen, otherId) => gen > otherGen || (gen === otherGen && String(id) < String(otherId));
/** A player's id folded into a number: the salt of the traffic they stand (0 offline - the waters' own seeds). */
export function idSalt(id) {
  if (typeof id !== 'string' || !id || id === 'local') return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
/** A ship another player stands that goes down within this of my last blow on her is mine to answer for (s): her
 *  stander lands the hurt (the victim's law), and my word never reaches it - the sinking does, in their next word. */
export const SINK_CREDIT_S = 20;
/** AUDIT NAV1 (the presentation): a deck fire whose place on her sinking hull is less than this over the sea is out (m)
 *  - its flame, its embers and its smoke; the rest burn on until the sea reaches them. */
export const FLAME_AWASH = 0.3;
/** NAV-R: a raider given the slip sheers off for its life: it steers for a point this far on, away from who slipped it. */
export const RAIDER_SHEER_M = 3000;
/** AUDIT NAV1: a frame's time is stepped this finely (s), at most this many steps a frame - Come Sail Away's time scale
 *  runs the sea as fast as the world, where one clamped step ran it at a fraction. */
export const FRAME_STEP_S = 0.1;
export const FRAME_STEPS_MAX = 12;
/** AUDIT NAV1 (the guns): the rest of the volley that struck her - the same striker within this (s) - cannot take her
 *  under one hull (a ball's ripple and its flight's spread: under a second), so sinking a prize is a new volley. */
export const STRUCK_GRACE_S = 2;
/** My volley's tally stands on the readout this long once its last ball has come down (s). */
export const TALLY_S = 3.5;
/** The run-out's warning reads a battery as bearing on my boat within this many degrees past its own arc. */
export const INCOMING_SLACK = 10;
/** AUDIT NAV1 (the helm): the look's ray finds a ship out to the battery's reach and this much more (m); a laid arc is
 *  walked this finely (s) against each ship as she will stand. */
export const LOOK_REACH_PAD = 60;
export const HOT_STEP_S = 0.1;
/** THE BROADSIDE CAMERA: while a broadside is laid, the eye eases (over AIM_CAM_TAU s) to AIM_CAM_OUT past the battery's
 *  ports, AIM_CAM_UP over them and AIM_CAM_AFT toward the stern (m) - her guns, the zone and the enemy on one screen. */
export const AIM_CAM_OUT = 4;
export const AIM_CAM_UP = 5.5;
export const AIM_CAM_AFT = 3;
export const AIM_CAM_TAU = 0.22;
/** ...and stops this far (m) short of another ship's side on its way out from the ports. */
export const AIM_CAM_CLEAR = 1.2;
/** AUDIT GN-G3: how long (s) another player's word keeps her broadside laid on my screen - longer than the full frame
 *  her word is said again by (net/online.js FOES_FULL_MS, 2 s), so a lay held still is never dropped between words.
 *  AUDIT GN2-GN3: real seconds, as that frame is - on my sea's clock Come Sail Away's time scale made 2 s ten at x5. */
export const PEER_LAY_S = 3;

/** A boat's hull as an oriented box in the world: its MeshCollider's own bounds through its MeshObject (null before
 *  its mesh is known) - the shots' target, the ram's, the target card's, and the host's deck rays'. */
export function hullBoxOf(boat, models) {
  const local = boat?.MeshCollider ? meshLocalBounds({ models }, boat.MeshCollider.m_Mesh) : null;
  if (!local) return null;
  return orientedBox(boat.MeshObject.worldMatrix(), local.center, local.extent);
}
/** AUDIT NAV1 (the guns): a boat's rig as oriented boxes in the world - its build's canvas (navalShips.js HULL_BUILDS
 *  `rig`, the root's frame) through the same MeshObject the hull rides, so the masts heel and settle with her.
 *  AUDIT GN-R5/G9: a box on a boom (`boom`, `pivot`) turned about its pivot by that boom's own rotation as the trim sets
 *  it - the canvas goes where the boom swings it, and so does the box; one askew (`obb`) as it lies. A boom the boat has
 *  not (another variant's, none walked yet) leaves its box home. AUDIT GN2-RG3: a box of a sail (`sail`) only while
 *  that sail is shown and set - furled or hidden (her sail share) her boxes took balls where no canvas hung. */
export function rigBoxesOf(boat) {
  const rig = hullBuild(boat?.hull).rig;
  const mo = boat?.MeshObject;
  if (!rig?.length || !mo) return [];
  const m = mo.worldMatrix();
  const lp = mo.localPosition ?? [0, 0, 0];
  const at = (p) => [p[0] - lp[0], p[1] - lp[1], p[2] - lp[2]];   // the root's frame in her mesh object's
  const hangs = (k) => { const s = boat.Sails?.[k]; return !s || (s.activeSelf && !animatorOf(s)?.GetBool('Stowed')); };
  // SHIPS-2: a box of another sail plan than hers is not her canvas (her Booms and Sails are her own plan's)
  const plan = (box) => /** @type {any} */ (box).variant == null || /** @type {any} */ (box).variant === (boat.variant ?? 0);
  return rig.filter((box) => plan(box) && (/** @type {any} */ (box).sail == null || hangs(/** @type {any} */ (box).sail))).map((box) => {
    const [mn, mx] = box, b = /** @type {any} */ (box);
    if (b.obb) return orientedBox(multiply(m, mat4FromQuatPos(quatAngleAxis(b.obb.pitch, [1, 0, 0]), at(b.obb.c)), new Float32Array(16)), [0, 0, 0], b.obb.h);
    const c = at([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]), h = [(mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2, (mx[2] - mn[2]) / 2];
    const q = b.boom != null ? boat.Booms?.[b.boom]?.localRotation : null;
    if (!q || !b.pivot) return orientedBox(m, c, h);
    // about the pivot: there, turned, and back
    const P = at(b.pivot);
    const turn = multiply(mat4FromQuatPos(q, P), mat4FromQuatPos([0, 0, 0, 1], [-P[0], -P[1], -P[2]]), new Float32Array(16));
    return orientedBox(multiply(m, turn, new Float32Array(16)), c, h);
  });
}

/** AUDIT GN2-RG4: how high a sail's canvas hangs (world y) - the mean of its grid (galleonRig.js: a bone a grid point,
 *  `*SailBones`, as built - her set canvas - at a sea ship's first pose, before her animators first run); a sail on one
 *  bone or none (the mod's hulls': no grid) its node's height, as they were sorted. Her jib's node stands at her origin
 *  and her gaff's at its boom's foot: by their nodes she lost her lowest canvas first. */
function canvasHeight(sail) {
  const grid = sail.children.find((c) => /SailBones$/.test(c.name))?.children ?? [];
  if (grid.length < 2) return sail.worldMatrix()[13];
  return grid.reduce((y, bone) => y + bone.worldMatrix()[13], 0) / grid.length;
}
/** AUDIT GN2-RG6: the sign Come Sail Away's sailWind (comeSailAway.js) gives a sail's Wind in the wind `w` (where it
 *  blows to) - by its signed angle to the sail's own forward: a gaff or a staysail +1 blown to starboard, a lateen the
 *  other way (its clips'); square canvas +1, full (a sea ship's yards are never braced, her way never backs). Every Wind
 *  was +: a sea ship's gaff and jib bellied to starboard in a wind blowing to port. */
function sailSide(boat, sail, w) {
  if (boat.SailsSquare?.includes(sail)) return 1;
  const f = quatRotate(sail.rotation, [0, 0, 1]);
  const a = vSignedAngle([f[0], 0, f[2]], [w[0], 0, w[2]], [0, 1, 0]);
  if (boat.SailsLateen?.includes(sail)) return a > 0 ? -1 : 1;
  if (boat.SailsGaff?.includes(sail)) return a >= 0 ? 1 : -1;
  return a > 0 ? 1 : -1;
}

/**
 * AUDIT NAV1 (the presentation): a boat's spars and planking as points in her MeshObject's own frame - the corners of
 * every rigid mesh of her rig and hull as it stands (a MeshFilter's model on an active node: another rig of a Large
 * Boat's is off; a skinned sail carries none, and its bake's filter holds no model - its bind-pose box is not where it
 * hangs, the Carrack's 101 m up, and a stowed sail lies along its yard) - and `lift`, that frame's origin over her root:
 * what the sinking takes her highest point by at her last pose (the masts stand past the build's rig boxes: the
 * galley's 1 m, the Carrack's 2.2). Null before any mesh of hers is known.
 */
export function sparsOf(boat, models) {
  const mo = boat?.MeshObject;
  if (!mo) return null;
  const points = [];
  for (const node of mo.walk()) {
    const local = node.activeInHierarchy ? meshLocalBounds({ models }, node.getComponent('MeshFilter')?.m_Mesh) : null;
    if (!local) continue;
    for (let i = 0; i < 8; i++) {
      const corner = [0, 1, 2].map((d) => local.center[d] + ((i >> d) & 1 ? local.extent[d] : -local.extent[d]));
      points.push(mo.inverseTransformPoint(node.transformPoint(corner)));
    }
  }
  if (!points.length) return null;
  return { points, lift: mo.worldMatrix()[13] - boat.GameObject.worldMatrix()[13] };
}

const MY_BOAT = 'me';
/** SERPENT1: the aim's "ship" when its guns strike the sea serpent (no sea entry - the target card stands none). */
const SERPENT_AIM = Object.freeze({ id: 'serpent' });
/** A boat of mine as the shots know it: its own id, so its balls never meet its own planking. */
const myBoatId = (boat) => `${MY_BOAT}:${boat?.uid || 0}`;
const isMine = (id) => typeof id === 'string' && id.startsWith(`${MY_BOAT}:`);
/** A shot a sea ship fired - never a player's own (mine, or a peer's `peer:`). */
const shipShot = (shooter) => !(typeof shooter === 'string' && (shooter.startsWith('peer:') || isMine(shooter)));
/** A hull on the flat, off its build: its centre, forward and right, half length and half width. */
export function flatHull(pos, yaw, hull) {
  const b = hullBuild(hull);
  const f = [Math.sin(yaw), Math.cos(yaw)];
  const mid = (b.bowZ + b.aftZ) / 2;
  return { c: [pos[0] + f[0] * mid, pos[2] + f[1] * mid], f, r: [f[1], -f[0]], hl: (b.bowZ - b.aftZ) / 2, hw: b.halfWidth };
}
/** The least push that takes hull A out of hull B (separating axes on the flat), or null when they stand apart. */
export function hullOverlap(A, B) {
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1]];
  let best = null, least = Infinity;
  for (const u of [A.f, A.r, B.f, B.r]) {
    const ra = A.hl * Math.abs(A.f[0] * u[0] + A.f[1] * u[1]) + A.hw * Math.abs(A.r[0] * u[0] + A.r[1] * u[1]);
    const rb = B.hl * Math.abs(B.f[0] * u[0] + B.f[1] * u[1]) + B.hw * Math.abs(B.r[0] * u[0] + B.r[1] * u[1]);
    const dd = d[0] * u[0] + d[1] * u[1];
    const o = ra + rb - Math.abs(dd);
    if (o <= 0) return null;
    if (o < least) { least = o; best = [-Math.sign(dd || 1) * u[0] * o, -Math.sign(dd || 1) * u[1] * o]; }
  }
  return best;
}
/**
 * SERPENT4 (2026-10-11, the players: "ships inevitably end up colliding and then phasing through each other with the lag.
 * I think ships need some kind of larger invisible box "aura" around them while this fight is in effect so they "bounce"
 * off each other"): THE SHIPS' BUMPERS - in the sea serpent's waters (navalHost drift) my ship's hull and every other
 * player's at her helm are met BUMPER_M out from each (both grown so far on every side), and my ship is pushed off along
 * the shallowest way out at BUMPER_GAIN a second of how deep the bumpers meet, BUMPER_V_MAX at most - on Come Sail Away's
 * drift seam, so her helm still answers. Each machine pushes its own ship, so two meeting are pushed apart by both: two
 * closing at 30 m/s hold 10 m inside the bumpers' 20, short of the hulls, and drift apart as their helms let go. A peer's
 * hull was met as a rock (comeSailAway.js CheckCollision) - at its own size, a frame stale, never while I lay still - so
 * with a wire's lag two hulls met and passed through each other. `me`, `others` are flatHull's; answers `[vx, 0, vz]` (the
 * flat's own axes, scene m/s) or null.
 */
export const BUMPER_M = 10;
export const BUMPER_GAIN = 1.5;
export const BUMPER_V_MAX = 30;
/** A hull farther than this (m, centre to centre) is never asked. */
export const BUMPER_REACH_M = 150;
export function bumperDrift(me, others) {
  const grow = (h) => ({ ...h, hl: h.hl + BUMPER_M, hw: h.hw + BUMPER_M });
  const A = grow(me);
  let vx = 0, vz = 0;
  for (const o of others) {
    if (Math.hypot(o.c[0] - A.c[0], o.c[1] - A.c[1]) > BUMPER_REACH_M) continue;
    const push = hullOverlap(A, grow(o));
    if (push) { vx += push[0] * BUMPER_GAIN; vz += push[1] * BUMPER_GAIN; }
  }
  const v = Math.hypot(vx, vz);
  if (!(v > 0)) return null;
  const k = v > BUMPER_V_MAX ? BUMPER_V_MAX / v : 1;
  return [vx * k, 0, vz * k];
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A launch's arc to `t` seconds, in 18 points - an aim's line to where its ball stops short of the sea. */
const arcTo = (l, t) => Array.from({ length: 18 }, (_, j) => shotPosition(l.p0, l.v0, t * j / 17));

/**
 * @param {any} deps - see the file's head
 */
export function createNavalHost(deps) {
  const random = deps.random ?? Math.random;
  const u32 = () => (Math.floor(random() * 0xffffffff) >>> 0) || 1;
  const setting = (k, d) => { const v = deps.setting?.(k); return v === undefined || v === null ? d : v; };
  /** QUICK-REPAIRS: whether her hands spend her stores on their own once a fight is over (Features > Naval Combat). */
  const autoRepair = () => setting('AutoRepair', true) !== false;
  /** The waters, read ONCE a frame (the frame refreshes it): every ship's pose, every charge and the readout ask it. */
  let whereNow = null;
  const where = () => (whereNow ??= deps.where?.() ?? {});
  const now = () => clock;
  let clock = 0;
  /** GALLEON: every galleon's gun deck in play - her shutters opened and her guns run out as a broadside is laid, each
   *  gun kicked back as it fires (systems/naval/galleonGunDeck.js; a hull without the nodes is left alone). */
  const galleonGuns = createGalleonGunDeck();
  /** AUDIT GN2-GN3: the real clock (s) - my sea's at one (world.js naval.frame(dt * worldTimeScale())) - that another
   *  player's lay is held on, her word coming on it. */
  let realClock = 0;
  let enabled = true;

  // ── the sea's ships ──────────────────────────────────────────────────────────────────────────────────────────────
  /** @type {Map<string, any>} id -> { id, n, owner, ship, boat, fires, fireLoop, sinkLoop, target, seen, charged, ramAt, myBlowAt, hunter,
   *  lifeDt, lifeN, list, deck, prize, lost, sinkUnder, colours } */
  const sea = new Map();
  let seq = 0;
  /** SHIP-LIFE: the harbours found near the player (systems/naval/harbourBook.js - key -> { key, name, harbour
   *  (shipLife.js findHarbour, or null: a port with no shore to berth at), at }) - and the water grids a hull's ways are
   *  planned on (the scene's; made again when the origin moves). HARBOUR-BOOK: the world's book (`deps.harbourBook`),
   *  which the world sounds, moves and empties whether the sea runs or not - its quays stand off it with Naval Combat
   *  off; made without one (the tests), a book of my own that my frame steps, my origin moves and my clear empties. */
  const ownBook = !deps.harbourBook;
  const harbours = deps.harbourBook ?? createHarbourBook({ harbourNear: () => deps.harbourNear?.() ?? null, isWater: (x, z, h) => deps.isWater(x, z, h) });
  /** The harbours whose moored ships stand (harbourFrame's roll), by their sounding - one found again is rolled anew,
   *  and my sea's clear forgets them all (its ships went with it). */
  let rolled = new WeakSet();
  let grids = new Map();
  /** AUDIT SHIP-LIFE B6: the seeds that sailed from each port today - port key -> { day, seeds } - kept across the sea's
   *  clear (a door's visit found the harbour again and stood a ship that had sailed at her berth once more). */
  const departedByPort = new Map();
  const departedOf = (key, day) => {
    let d = departedByPort.get(key);
    if (!d || d.day !== day) departedByPort.set(key, (d = { day, seeds: new Set() }));
    return d.seeds;
  };
  /** AUDIT NAV1 (the presentation): each hull and rig's spars, measured once (sparsOf) - `${hull}:${variant}` -> them. */
  const spars = new Map();
  const myId = () => deps.online?.id?.() ?? 'local';
  const director = createNavalDirector({ random });
  const notoriety = createNotoriety();
  let lastDecayDay = null;
  let standing = true;
  let lastSweep = 0;
  let lastHail = -Infinity, lastHailCheck = -Infinity, lastCardId = null;   // AUDIT NAV1 (#14): the lookout, and the card's ship
  /** SHIP-WATCH: a boat of mine's lookout's cry not yet shouted from her bow (myCrew's `call`, taken once). */
  const hailCalls = new Map();

  // ── the player's boats: each its own hurts and gun deck, by the boat's own deed UID (a console boat by itself) ──
  const boatState = new Map();   // uid (non-zero) -> { damage, guns }
  const boatStateByObj = new WeakMap();   // uid 0: the boat object
  const pendingBoats = new Map();   // a save's records waiting for their boat
  /** AUDIT CC-A5: nobody of hers ashore (never mutated). */
  const NO_HANDS_AWAY = new Set();
  let companions = createCompanions(null, deps.packedItems ?? null);   // CREW-COMPANIONS: the party ashore (crewCompanions.js), saved beside the crews - COMPANION-KIT: their packs through the save's item codec
  /** HOLDINGS (bible/03-World/Holdings.md): her build as her refits make it - her Hull refit's share on her hull's and
   *  her canvas's whole (`deps.refit`, the Fleet's ledger by her number; a boat with none, her hull's own). AUDIT 2: a
   *  share under 1 read too - CAPTAIN-TREE's keystones' prices (Boarders Away's hull) cost her here as Come Sail Away
   *  charges her way's. */
  function refitBuild(boat) {
    const b = hullBuild(boat.hull);
    const k = Number(boat?.uid ? deps.refit?.(boat)?.hull : 1);
    return Number.isFinite(k) && k > 0 && k !== 1 ? { ...b, hullHp: Math.round(b.hullHp * k), sailHp: Math.round(b.sailHp * k) } : b;
  }
  function myBoatState(boat) {
    if (!boat) return null;
    const keyed = boat.uid ? boatState.get(boat.uid) : boatStateByObj.get(boat);
    if (keyed) return keyed;
    const b = refitBuild(boat);
    const st = {
      damage: createShipDamage({ hullHp: b.hullHp, sailHp: b.sailHp, crew: b.crew, player: true }),
      guns: null,
    };
    // SHIP-CREW: her guns' reload by her crew's spirits and her standing order - CAPT-CREW: and her Gunner's worth
    st.worth = NO_WORTH;
    st.guns = createGunDeck(boat.hull, { crewed: !!boat.crewed, crewShare: () => st.damage.crewShare(), barrels: BARREL.stock, reloadScale: () => (boat.crewed && st.crew ? reloadScaleOf(st.crew.morale, st.crew.order) * st.worth.reload : 1) });
    const saved = boat.uid ? pendingBoats.get(boat.uid) : null;
    const rec = saved ? savedHurts(saved, boat.hull, st.damage) : null;   // TOUGHER-SHIPS: her hurts and credit on her whole now
    if (saved) { st.damage.restore(rec); if (Number.isFinite(saved.barrels)) st.guns.barrels = saved.barrels; st.guns.restoreLoads(saved.loads ?? null); pendingBoats.delete(boat.uid); }   // SHOT-KINDS: her loads
    // SHIP-CREW: her crew as people (names, spirits, the order standing), and SEA-REPAIR's store part-spent
    st.crew = createShipCrew({ seed: (deps.crewSeed?.(boat) ?? boat.uid ?? 1) >>> 0, regionIndex: where().region ?? 17, record: saved?.mates ?? null });
    st.credit = Number.isFinite(rec?.credit) ? Math.max(0, Math.min(STORE_POINTS, rec.credit)) : 0;   // AUDIT CC-D1: in work points (an older save's share of a whole reads as next to none)
    st.lastCrew = st.damage.crew; st.wasWrecked = st.damage.state === SHIP_STATES.wrecked; st.inFight = false; st.mustered = !!saved?.mates; st.repairing = false;
    st.hull = boat.hull;   // TOUGHER-SHIPS: her build, the scale the save keeps her on (savedRecord)
    if (boat.uid) boatState.set(boat.uid, st); else boatStateByObj.set(boat, st);
    return st;
  }
  const csa = () => deps.csa?.() ?? null;
  const sailing = () => !!csa()?.isSailing?.();
  const myBoat = () => (sailing() ? csa().state.CurrentBoat : null);
  /** AUDIT CAPTAIN'S SEA C1: THE NAMES OF A BOAT OF MINE'S HANDS ASHORE WITH ME - none while I sail (AUDIT CC-A5, Mac: "Back
   *  on deck while sailing"). Her posts' worth (crewStep), the hand who answers for her (`mateOf`), her card and her deck
   *  (`awayOf`) read this one set: the party's raw roll left a companion's post worth nothing while he stood it at sea. */
  const ashoreNames = (boat) => (boat?.uid && companions.party.length && !sailing() ? companions.awayOf(boat.uid) : NO_HANDS_AWAY);
  /** The boats of mine that stand in the world (the shots' targets, the flotsam's collectors). */
  const myBoats = () => (csa()?.state?.AllBoats ?? []).filter((b) => b.GameObject?.activeSelf);
  /** BERTH-HIDDEN (2026-10-04 - found chasing Mac's "its two ships clipped inside of eachother", which was the cabin's,
   *  world.js CABIN-HULL): every boat of mine placed outdoors,
   *  shown or not - what a berth asks of. Come Sail Away hides a boat more than a map pixel off and every one while I am
   *  indoors, and she lies where she lay all the same (FIELD-CSA1: she rides the origin in sight or not); read by the
   *  shown ones alone, a ship made fast at a quay was a free berth from the harbour roll's 1,200 m, and the port moored
   *  its own into her. A dungeon's (`inside`) lies in its own place. */
  const berthBoats = () => (csa()?.state?.AllBoats ?? []).filter((b) => b.GameObject && !b.inside);
  /** A boat's root pose as the gunnery reads it. */
  function boatPose(boat) {
    const r = csa();
    const rot = boat.GameObject.rotation;
    // FIELD BUGS 2026-10-21b VOYAGE-HOLD: a boat aground lies still - the runtime keeps her last way (Come Sail Away moves
    // a beached boat by none of it), and a Small Ship run ashore at the helm read 9.86 m/s: never a berth, and leagues logged
    const local = boat === r?.state?.CurrentBoat && sailing() && !r.IsBeached?.(boat) ? (r.state.velocityCurrent ?? [0, 0, 0]) : [0, 0, 0];
    return { position: boat.GameObject.position, rotation: rot, velocity: quatRotate(rot, local), hull: boat.hull };
  }
  const yawOfRot = (rot) => { const f = quatRotate(rot, [0, 0, 1]); return Math.atan2(f[0], f[2]); };

  const hullBox = (boat) => hullBoxOf(boat, deps.pool.models);

  // ── the effects, the shots ───────────────────────────────────────────────────────────────────────────────────────
  const wind = () => csa()?.state?.windVectorCurrent ?? [0.6, 0, 0.8];
  const effects = createNavalEffects({ random, wind });
  const feel = createNavalFeel({   // COMBAT-FEEL (scenes/naval/navalFeel.js)
    effects, sound: (k, p, v, o) => sound(k, p, v, o), shake: (k) => deps.shake?.(k), feet: () => deps.feet(), mine: (s) => isMine(s) || String(s ?? '').startsWith('peer:'),
    myHulls: () => myBoats().map((b) => ({ id: myBoatId(b), box: hullBox(b) })).filter((h) => h.box),
    // MY-SMOKE: a boat too whole to smoke never asks whether a hostile is near her (AUDIT 2026-10-17: a scan of the sea a boat a frame)
    myBoats: () => myBoats().filter((b) => myBoatState(b).damage.hullShare() < MY_SMOKE_FROM).map((b) => { const st = myBoatState(b); return { pose: boatPose(b), build: hullBuild(b.hull), hull: st.damage.hullShare(), fighting: hostileNearBoat(b, st) }; }),
  });
  const flashes = [];   // { pos, t }
  /** The shots' targets this frame: every sea ship afloat, and my own boats - each hull's box and its rig's. */
  function targets() {
    const out = [];
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk) continue;
      const box = hullBox(e.boat);
      if (box) out.push({ id: e.id, box, rig: rigBoxesOf(e.boat) });
    }
    // AUDIT NAV1 (online): another player's boat at her helm - a sea ship's ball or barrel that meets her bursts here too
    // (her own client alone judges it, the victim's law), never passing through her on my screen; a player's shot - mine
    // or any peer's, her own among them - never meets her (`hitBy`: no fight between players at sea) - SHIP-PVP: but in the
    // open sea (scenes/naval/seaBroadsides.js `open`), where my balls meet a stranger captain's ship and the referee judges
    // them, and a peer's are seen to meet her too
    for (const p of deps.peerBoats?.() ?? []) {
      const box = p.boat ? hullBox(p.boat) : null;
      if (box) out.push({ id: `peer:${p.id}`, box, rig: rigBoxesOf(p.boat), hitBy: (s) => shipShot(s) || pvp.open(p.id, s, isMine(s)) });
    }
    for (const b of myBoats()) {
      const box = hullBox(b);
      if (box) out.push({ id: myBoatId(b), box, rig: rigBoxesOf(b), boat: b, ear: true });   // COMBAT-FEEL NEAR-MISS: her near misses told
    }
    // SERPENT1: the sea serpent's segments above the sea - every ball meets it, a ship's, a peer's and mine (mine alone
    // counted: landHit)
    for (const t of deps.serpent?.targets?.() ?? []) out.push(t);
    return out;
  }
  const shots = createShotField({
    seaY: () => deps.seaY(),
    wind,
    targets,
    ground: (p) => !deps.isWater(p[0], p[2], -1) && p[1] < (deps.groundY?.(p[0], p[2]) ?? -Infinity),
    collectors: () => {
      const out = myBoats().map((b) => ({ id: myBoatId(b), box: hullBox(b), boat: b })).filter((c) => c.box);
      // AUDIT NAV1 (the boarding audit's minor): a swimmer hauls a cask in by hand - only a hull ever did
      if (deps.swimming?.()) { const f = deps.feet(); out.push({ id: SWIMMER, box: { c: [f[0], deps.seaY(), f[2]], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [...SWIM_REACH] } }); }
      return out;
    },
    onEvent: (e) => onShot(e),
    random,
  });

  /** Recent volleys and barrels for the word (NAV-G), the owner's own - each kept NAVAL_VOLLEY_KEEP_MS. */
  let wireVolleys = [];
  let wireBarrels = [];
  /** A peer's volleys and barrels seen already: owner -> Set of ids. */
  const seenVolleys = new Map();
  /** AUDIT NAV1 (online #14): when each peer's volleys were flown here - owner -> clocks, NAVAL_VOLLEY_KEEP_MS of them. */
  const flownAt = new Map();
  /** AUDIT NAV1 (online #15): my claims on others' casks, waiting on their answer - cask id -> { owner, raw, lot, from,
   *  collector, point, at, said } - and my answers on mine - raw id -> { to, at }. */
  const claims = new Map();
  const granted = new Map();
  /** KEEP-PLUNDER: the casks of the ships I sank, by floater id - the ones stowPlunder hauls in before the sea goes. */
  const myCasks = new Set();
  /** STOLEN-GOODS AUDIT (S4's flotsam): of myCasks, those of a lawful ship's hold (lawfulGoods) - her owner's goods, stolen
   *  however they come aboard (hauled, broken open swimming, the crew's stow). */
  const stolenCasks = new Set();
  /** AUDIT NAV1 (online): each peer's own word of themselves - owner -> { law: { crown: notoriety }, me: their boat's
   *  { hull, crippled, boarders } | null } - the captains I stand judge each player by their own. */
  const peerSelf = new Map();

  /** A sound at a place, heard over its own range (systems/naval/navalSounds.js NAVAL_SOUND_RANGE) - and not at all
   *  past its end (AUDIT NAV1: the bus's inverse law never reaches silence; the bus's own 500 m for a key without one). */
  function sound(key, pos, vol = 1, opts = {}) {
    const o = { ...navalSoundRange(key), ...opts };
    const f = deps.feet();
    if (pos && f && Math.hypot(pos[0] - f[0], pos[1] - f[1], pos[2] - f[2]) > (o.maxDistance ?? 500)) return;
    try { deps.audio?.play3d?.(key, pos, vol, o); } catch { /* a missing clip is silence */ }
  }
  /** AUDIT NAV1 (the presentation): a hull hit's burst at `p`, grown for the eye that sees it (HIT_BURST_M). */
  const burstScale = (p) => {
    const eye = deps.look?.()?.origin ?? deps.feet();
    return clamp(Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) / HIT_BURST_M, 1, HIT_BURST_MAX);
  };
  /** AUDIT NAV1 (the presentation): how far into the far roll a report at `d` (m) is heard - 0 near, 1 far. */
  const farShare = (d) => clamp((d - (NEAR_BOOM_M - FAR_FADE_M)) / (2 * FAR_FADE_M), 0, 1);

  /** GALLEON: the boat a shooter's id names - one of mine, a sea ship's, another player's at her helm - or null. */
  function boatOfShooter(id) {
    if (typeof id !== 'string') return null;
    if (isMine(id)) return myBoats().find((b) => myBoatId(b) === id) ?? null;
    if (id.startsWith('peer:')) { const owner = id.slice(5); return (deps.peerBoats?.() ?? []).find((p) => p.id === owner)?.boat ?? null; }
    return sea.get(id)?.boat ?? null;
  }

  /**
   * AUDIT GN-G5: a battery's muzzles through her hull as she lies - heeled and listed with her MeshObject, as her ports
   * are drawn - so each ball leaves its own port; the root's upright frame stood a ball 0.89 m off the port at 8 deg of
   * roll, under its sill on the high side. The lay (elevation, direction) is the root's, as aimed; a shooter with no
   * hull drawn here keeps the root's muzzles. Her heel is taken in the root's own frame and stood on `pose` - the root
   * as she fires: a sea ship's hull is posed after her captain's step, a frame behind her (her drawn world matrix put
   * a captain's ball a frame's way aft of her port, 3 m at Come Sail Away's half-second frame) - and through whatever
   * stands between her root and her MeshObject (the galleon's DaggerfallMesh node).
   */
  function heeled(solution, pose, boat) {
    const mo = boat?.MeshObject, root = boat?.GameObject, up = mo?.parent;
    if (!mo || !root || !up || !solution?.muzzles?.length) return solution;
    const q = mo.localRotation, lp = mo.localPosition;
    const inv = [-pose.rotation[0], -pose.rotation[1], -pose.rotation[2], pose.rotation[3]];
    const muzzles = solution.muzzles.map((w) => {
      const r = quatRotate(inv, [w[0] - pose.position[0], w[1] - pose.position[1], w[2] - pose.position[2]]);   // the root's frame
      const p = up.inverseTransformPoint(root.transformPoint(r));   // her MeshObject's parent's (the root's own place cancels)
      const h = quatRotate(q, [p[0] - lp[0], p[1] - lp[1], p[2] - lp[2]]);
      const o = quatRotate(pose.rotation, root.inverseTransformPoint(up.transformPoint([h[0] + lp[0], h[1] + lp[1], h[2] + lp[2]])));
      return [pose.position[0] + o[0], pose.position[1] + o[1], pose.position[2] + o[2]];
    });
    return { ...solution, muzzles };
  }

  // ── firing ───────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * A volley from a ship: its balls flown (resolved here when `resolve`), its word kept for the others.
   * @param {{ shooter: string, wireShooter: number, hull: number, pose: any, solution: any, skill: number, resolve?: boolean }} v
   */
  function fire({ shooter, wireShooter, hull, pose, solution, skill, resolve = true }) {
    if (!solution) return 0;
    if (solution.barrel) {
      for (const drop of solution.landings) {
        const id = u32();
        shots.dropBarrel({ id: String(id), shooter, pos: drop.point, resolve });
        wireBarrels.push({ id, pos: [...drop.point], at: clock, shooter: wireShooter });   // AUDIT NAV1 (online #7): whose she is
        sound(NAVAL_CLASSIC.splashSmall, drop.point, 0.5);   // a barrel over the side
      }
      return solution.landings.length;
    }
    const seed = u32();
    const weight = shipBatteryWeight(hull, solution.side, isMine(shooter));   // GALLEON-WEIGHT: my galleon's broadside, never a captain's galleon's (SHIPS-2: a captain's carrack's, the mod's seven)
    const launches = volleyLaunches(heeled(solution, pose, boatOfShooter(shooter)), seed, { skill, carry: pose.velocity, weight });
    const id = u32();
    shots.fireVolley({ id: String(id), shooter, launches, resolve, side: solution.side });
    if (isMine(shooter)) tallies.fired(id, launches.length);
    wireVolleys.push({ id, shooter: wireShooter, hull, side: solution.side, pos: [...pose.position], yaw: yawOfRot(pose.rotation), vel: pose.velocity ?? [0, 0, 0], elevation: solution.elevation, seed, skill, at: clock,
      shot: solution.shot && solution.shot !== naturalShot(solution.gun) ? solution.shot : null });   // SHOT-KINDS: a load not her bores' own, said (navalWire.js `o`)
    return launches.length;
  }

  /** A peer's volley, flown here from its word: drawn, and a ball that strikes MY boat - an AI's - is mine to take. */
  function fireFromWord(owner, v, toScene) {
    const shooter = v.shooter >= 0 ? `${owner}:${v.shooter}` : `peer:${owner}`;
    const boat = boatOfShooter(shooter);
    // AUDIT GN2-GN4: from her ports as drawn here - her drawn root, set back by her way over the volley's age to where it
    // stood as the balls left (they fly on from there, `since`) - not her word's pose: her shutters and guns are the drawn
    // copy's, gliding on between her words (PUPPET-GLIDE, csaPeers' ease), and the flash stood up to 1.16 m off them
    const drawn = boat?.GameObject, back = Math.max(0, (v.age ?? 0) / 1000);
    const pos = drawn ? drawn.position.map((x, k) => x - v.vel[k] * back) : toScene(v.pos);
    const pose = { position: pos, rotation: drawn ? drawn.rotation : quatOfYaw(v.yaw), velocity: v.vel, hull: v.hull };
    const solution = aimSolution(pose, v.side, null, deps.seaY(), { range: 1, shot: v.shot ?? null });   // SHOT-KINDS: her volley's load
    if (!solution) return;
    if (solution.barrel) return;
    // the lay the shooter used, not a range this client would pick
    const g = GUNS[solution.gun];
    solution.elevation = clamp(v.elevation, g.minEl * NAVAL_DEG, g.maxEl * NAVAL_DEG);
    const weight = shipBatteryWeight(v.hull, v.side, v.shooter < 0);   // GALLEON-WEIGHT: a peer's own galleon's broadside, never a captain's galleon's (SHIPS-2: a captain's carrack's)
    const launches = volleyLaunches(heeled(solution, pose, boat), v.seed, { skill: v.skill, carry: v.vel, weight });
    shots.fireVolley({ id: `${owner}:${v.id}`, shooter, launches, resolve: false, side: v.side, owner, since: (v.age ?? 0) / 1000 });   // AUDIT NAV1 (online #15): as far along as she is
  }

  // ── what the shots meet ──────────────────────────────────────────────────────────────────────────────────────────
  function onShot(e) {
    const seaY = deps.seaY();
    tallies.count(e);
    if (e.type === 'muzzle') {
      if ((e.index ?? 0) === 0) heardGun(e.pos, gunfireBy(e.shooter));   // SEA-PEACE: a volley's report, heard across the bay
      if (e.side === 'starboard' || e.side === 'port') { const gb = boatOfShooter(e.shooter); if (gb) galleonGuns.fired(gb, e.side, e.index ?? 0, clock); }   // GALLEON: the gun that fired it kicks back
      const scale = e.gun === 'heavy' ? 1.35 : e.gun === 'swivel' ? 0.55 : 1;
      effects.shotMuzzle(e.pos, e.dir, scale, e.shot);   // SHOT-KINDS: each load's own
      flashes.push({ pos: [...e.pos], t: clock });
      // the report (AUDIT NAV1, the presentation: THE MIX) - near, far, or crossfaded between; my own ripple's reports
      // at one over the root of its guns, the far roll once a volley
      const mine = isMine(e.shooter);
      const n = Math.max(1, e.count ?? 1);
      const x = farShare(dist2d(e.pos, deps.feet()));
      const weight = e.gun === 'swivel' ? 0.7 : 1;
      if (x < 1) {
        const level = 10 ** (((random() - 0.5) * 2 * GUN_GAIN_JITTER_DB) / 20);
        const pitch = 1 + (random() - 0.5) * 2 * GUN_PITCH_JITTER;
        sound(e.gun === 'swivel' ? NAVAL_SFX.swivel : NAVAL_SFX.cannon, e.pos, weight * level * Math.cos(x * Math.PI / 2) / (mine ? Math.sqrt(n) : 1), { pitch });
      }
      if (x > 0 && (e.index ?? 0) === 0) sound(NAVAL_SFX.cannonFar, e.pos, weight * FAR_MATCH * Math.sin(x * Math.PI / 2) * (mine ? 1 : Math.sqrt(n)), { far: true });
      if (mine) deps.shake?.(GUN_KICK[e.gun] ?? GUN_KICK.long);   // each gun's kick along the ripple
      return;
    }
    if (e.type === 'pass') { feel.passed(e); return; }   // COMBAT-FEEL NEAR-MISS: a ball going by her, heard
    if (e.type === 'splash') {
      effects.shotSplash([e.point[0], seaY, e.point[2]], e.gun === 'heavy', e.shot, burstScale(e.point));   // SHOT-KINDS: grape's spatter, heated shot's hiss; SPLASH-SPOUT: grown for an eye far off
      feel.splashed([e.point[0], seaY, e.point[2]]);   // COMBAT-FEEL DRENCH: over her rail, alongside
      if (dist2d(e.point, deps.feet()) < 220) sound(e.gun === 'heavy' ? NAVAL_CLASSIC.splashLarge : NAVAL_CLASSIC.splashSmall, e.point, 0.8);
      return;
    }
    if (e.type === 'land') { effects.hit(e.point, [0, 1, 0], false); return; }
    if ((e.type === 'hit' || e.type === 'blast') && segmentOfTarget(e.target) != null) {
      // SERPENT1: a ball into the serpent's hide - the sea thrown up off it, no splinters and no planks afloat
      effects.splash(e.point, e.gun === 'heavy' || e.type === 'blast');
      if (e.type === 'blast') { effects.blast(e.point); sound(NAVAL_SFX.blast, e.point, 1); }
      else sound(NAVAL_CLASSIC.splashSmall, e.point, 0.8, isMine(e.shooter) ? { refDistance: HIT_CONFIRM_REF_M } : {});
      landHit(e);
      return;
    }
    if (e.type === 'hit' || e.type === 'blast') {
      if (e.type === 'blast') { effects.blast(e.point); sound(NAVAL_SFX.blast, e.point, 1); }
      else {
        // AUDIT NAV1 (the presentation): a ball of mine that strikes her is heard at the helm (HIT_CONFIRM_REF_M), and its
        // splinters are thrown as far as the eye can read them - a hit and a miss had felt alike
        const confirm = isMine(e.shooter) ? { refDistance: HIT_CONFIRM_REF_M } : {};
        if (e.zone === 'rig') { effects.shotTear(e.point, e.dir ?? [0, 0, 1], e.shot); sound(NAVAL_SFX.hit, e.point, 0.3, confirm); }   // through her canvas: shreds and a crack of spars (SHOT-KINDS: chain's twice)
        else {
          effects.shotHit(e.point, e.dir ?? [0, 0, 1], e.gun === 'heavy', burstScale(e.point), e.shot); sound(NAVAL_SFX.hit, e.point, 0.9, confirm);   // SHOT-KINDS: grape's peppering, heated shot's embers
          effects.timber([e.point[0], seaY, e.point[2]], TIMBER_PER_HIT + (e.gun === 'heavy' ? 1 : 0));   // AUDIT NAV1 (#15): planks afloat
        }
      }
      landHit(e);
      return;
    }
    if (e.type === 'pickup') { if (e.owner) claimCask(e); else pickFlotsam(e); }   // AUDIT NAV1 (online #15): another's, claimed of them
  }

  /** A strike on a hull: whose it is decides who counts it. */
  function landHit(e) {
    const gun = e.type === 'blast' ? GUNS.barrel : struckGun(e.gun, GUNS[e.gun], e.shot, e.t, isMine(e.shooter) ? deps.captain?.stats?.() : null);   // SHOT-KINDS: as its load fires it - CAPTAIN-TREE: my shot locker's stars
    if (!gun) return;
    const zone = e.type === 'blast' ? 'hull' : e.zone;
    // AUDIT NAV1 (the guns): a fire is a barrel's, or FIRE_CHANCE of a hull hit above the waterline - never the canvas
    // a ball passed through, nor a hole the sea comes in by; SHOT-KINDS: heated shot's own chance, and its pass through
    // her canvas sets that alight too (shotKinds.js shotRigFire)
    const fire = e.type === 'blast' ? 'barrel' : (zone === 'hull' || (zone === 'rig' && shotRigFire(e.shot))) && random() < shotFireChance(e.shot, FIRE_CHANCE, gun.fireK);
    if (isMine(e.target)) {
      // MY boat: the victim's own client takes what strikes it - but never another player's ball (no fight between
      // players at sea), nor one of mine, only a ship's of the sea
      if (e.shooter?.startsWith?.('peer:') || isMine(e.shooter)) return;
      const boat = myBoats().find((b) => myBoatId(b) === e.target);
      const st = myBoatState(boat);
      if (!st) return;
      // CREW-HOLD: her men as a player's crew stands them; GALLEON-WEIGHT: the ball's weight of metal, its battery's
      const hurt = dueOnHull(shotDamage(gun, zone, { braced: st.guns.braced, roll: random(), tough: PLAYER_CREW_TOUGHNESS, weight: e.weight }));   // SEA-SET: the Captain's Due
      if (fire) hurt.fire = fire;
      const change = st.damage.apply(hurt, clock);
      if (boat === boatInPlay()) deps.shake?.(e.type === 'blast' ? BLAST_SHAKE : zone === 'holed' ? 2.5 : 1.6);   // AUDIT 2: the boat I stand on's - one moored across the water struck jarred my eye
      if (boat === myBoat()) feel.struck(quatRotate(boatPose(boat).rotation, [0, 0, 1]), e.dir);   // COMBAT-FEEL HULL-BLOW: the side it came from - AUDIT 2: the plate's boat's alone (a moored one of mine struck flashed my rose on her heading)
      if (change === SHIP_STATES.wrecked) deps.mid?.('Your ship is crippled! The sails hang in rags.', 3);
      return;
    }
    if (!e.resolve) return;
    // SERPENT1: a ball (or a barrel) of MINE on the serpent - its gun's own harm, my Guns refit's with it, gathered by
    // the serpent's host into the cell's word; anyone else's is its own machine's to say
    const seg = segmentOfTarget(e.target);
    if (seg != null) {
      if (!isMine(e.shooter)) return;
      const hurt = { hull: gun.hull * (e.weight ?? 1) * (0.85 + 0.3 * random()), sail: 0, crew: 0 };   // GALLEON-WEIGHT: her battery's weight of metal
      if (e.type !== 'blast') gunsRefit(hurt, e.shooter);
      deps.serpent?.struck?.(seg, hurt.hull);
      return;
    }
    // SHIP-PVP: a ball of MINE on a stranger captain's ship in the open sea - its harm as it would strike a sea ship, my Guns
    // refit's with it, gathered for the referee (seaBroadsides.js `shot`); her own game lays what the referee says landed
    if (typeof e.target === 'string' && e.target.startsWith('peer:')) {
      if (!isMine(e.shooter)) return;
      const hurt = shotDamage(gun, zone, { roll: random(), weight: e.weight });
      if (e.type !== 'blast') gunsRefit(hurt, e.shooter);
      if (fire) hurt.fire = fire;
      pvp.shot(e.target.slice(5), hurt);
      return;
    }
    const target = sea.get(e.target);
    if (!target) return;
    const hurt = shotDamage(gun, zone, { roll: random(), weight: e.weight });   // GALLEON-WEIGHT: the ball's weight of metal
    if (fire) hurt.fire = fire;
    const byMe = isMine(e.shooter);
    if (byMe && e.type !== 'blast') gunsRefit(hurt, e.shooter);   // HOLDINGS: her Guns refit - her balls' harm, never a barrel's
    const stray = byMe && !target.owner && strayOnAlly(target, hurt, myId());   // SEA-EASE: an aid struck in the melee
    if (byMe && !stray) chargePlayer('fire', target);
    if (byMe) target.myBlowAt = clock;
    if (target.owner) {
      // a ship another player stands: the blow is theirs to land
      // TOUGHER-SHIPS: her men as the gun takes them (shotMen) - her stander reckons the toughness (applyPeerHit). AUDIT 2: a
      // load's men are a fraction (chain's 0.6 a hull hit, grape thinned by its flight) and the word's are whole - rounded
      // on this ball's own roll, so the stander's reckoning comes out as mine would (it was cut: chain took no man of hers)
      deps.sendHit?.(navalHitData(target.owner, { n: target.n, hull: hurt.hull, sail: hurt.sail, crew: Math.floor(shotMen(gun, zone) + random()), fire: hurt.fire ?? false, zone }));
      if (byMe) tallies.men(e, shotMen(gun, zone) / SHIP_TOUGHNESS);   // CARD-CREW: as her stander will reckon them (AUDIT 2: her toughness's share - the tally counted the gun's men)
      return;
    }
    const men = target.ship.damage.crew;
    strike(target, hurt, byMe ? myId() : e.shooter, undefined, stray);
    if (byMe) tallies.men(e, men - target.ship.damage.crew);   // CARD-CREW (COMBAT-FEEL): the men my volley took
  }
  /** HOLDINGS: a ball of a boat of mine bettered by her Guns refit (`deps.refit`, the Fleet's) - its hull's and canvas's
   *  harm; the men it takes as the gun takes them. AUDIT 2: and worsened by a keystone's price (Merchant Prince's harm). */
  function gunsRefit(hurt, shooter) {
    const uid = Number(String(shooter).slice(MY_BOAT.length + 1));
    const refit = Number(uid > 0 ? deps.refit?.({ uid })?.guns : 1);
    const k = (Number.isFinite(refit) && refit > 0 ? refit : 1) * captainsDue().guns;   // SEA-SET: the Captain's Due - her balls' harm, over her refit's
    if (k === 1) return;
    if (Number.isFinite(hurt.hull)) hurt.hull *= k;
    if (Number.isFinite(hurt.sail)) hurt.sail *= k;
  }
  /** SEA-EASE: whether a player's ball on this ship is a stray on an aid - a crown's ship afloat, fighting a pirate,
   *  not at odds with them, and what they have struck her for still under ALLY_STRAY_SHARE of her hull (counted here). */
  function strayOnAlly(entry, hurt, by) {
    const s = entry.ship;
    if (s.cls.faction !== 'navy' || s.damage.state !== SHIP_STATES.afloat || s.mode !== 'engage' || sea.get(s.target)?.ship.cls.faction !== 'pirate') return false;
    if ((s.provoked.get(by) ?? -Infinity) > clock - PROVOKED_S) return false;
    entry.strays ??= new Map();
    const struck = (entry.strays.get(by) ?? 0) + Math.max(0, hurt.hull ?? 0);
    entry.strays.set(by, struck);
    if (struck > ALLY_STRAY_SHARE * s.damage.maxHull) return false;
    if (by === myId() && !entry.straySaid) { entry.straySaid = true; deps.say?.(`Check your fire! ${calledName(entry)} fights on your side.`, 4); }
    return true;
  }

  /**
   * A hurt on a ship I stand: its state, the word, the law's reckoning when the player sank her. AUDIT NAV1 (the guns):
   * a ball from a ship of her own trade - or between two lawful ones - provokes nothing (a stray is not a feud: the
   * audit's pirates turned on their sisters in six fights of sixteen); the rest of the volley that struck her cannot
   * take her under one hull (STRUCK_GRACE_S), and striking puts her fires out (navalDamage.js). AUDIT NAV1 (B4): who
   * set her afire is kept (`fireBy`) - her fires' own changes are theirs (stateChanged). `byPlayer`: the blow is a
   * player's - mine, or (AUDIT NAV1, online #6) a peer's landed here (applyPeerHit).
   */
  function strike(entry, hurt, by, byPlayer = by === myId(), stray = false) {
    const s = entry.ship;
    if (s.lashed) unlashPrize(entry);   // SEA-PEACE: a victor under fire leaves her prize to fight
    const striker = typeof by === 'string' ? sea.get(by)?.ship ?? null : null;
    if (!stray && (!striker || !kindred(striker, s))) provoke(s, by, clock);   // SEA-EASE: a stray on an aid is no feud
    const floor = entry.struck && entry.struck.by === by && clock - entry.struck.at <= STRUCK_GRACE_S ? 1 : 0;
    const before = s.damage.state;
    const change = s.damage.apply(hurt, clock, { floor });
    if (hurt.fire && s.damage.fire > 0) { igniteShip(entry); entry.fireBy = by; }
    // a navy that saw a lawful ship struck by a player is provoked at once - AUDIT NAV1 (online #6): any player's (a
    // peer's piracy beside a navy provoked no one)
    if (byPlayer && !stray && s.cls.faction !== 'pirate') {
      // CAPT-MARQUE: my own blow on a rival's ship under my letter - the ships of the crown that signed it look on
      const held = by === myId() ? deps.captain?.marque?.() ?? null : null;
      const signed = held && s.flag && s.flag !== held.crown ? held.crown : null;
      for (const w of sea.values()) if (w.ship.cls.faction === 'navy' && w.ship.flag !== signed && dist2d(w.ship.pos, s.pos) < WITNESS_RANGE) provoke(w.ship, by, clock);
    }
    if (change) stateChanged(entry, before, change, by);
  }
  /**
   * A ship's state changed - by a ball (strike) or by her fires (her damage's own step, charged to who set them): her
   * colours come down with her bell, or she goes down with what floats free of her and the law's reckoning. AUDIT NAV1
   * (B4): one arm, whatever did it - a ship the fire finished struck and sank unannounced, no casks, no reward, no
   * bell, and one boarded foundered under the fight and ended it without a word (founderUnderFight).
   */
  function stateChanged(entry, before, change, by) {
    const s = entry.ship;
    const news = by === myId() || newsworthy(entry);   // SEA-PEACE: a fight between ships a bay away is no news of mine
    if (change === SHIP_STATES.struck) {
      entry.struck = { by, at: clock };
      // SHIP-CREW: she struck to us; QL11: a ship made to strike her colours - by my guns (a peer's are theirs). AUDIT
      // QUESTLINES ACTS-8: the act in the crew's own arm, no line of its own (HOST-SPLIT)
      if (by === myId()) struckToMe();   // SHIP-CREW: she struck to us; QL11: the act
      if (news) deps.say?.(`${s.names?.name ?? 'It'} surrenders!`, 4);
      sound(NAVAL_CLASSIC.bell, s.pos, 0.8);   // her bell as the colours come down
    } else if (change === SHIP_STATES.sinking) {
      if (news) deps.say?.(`${s.names?.name ?? 'It'} is going down!`, 4);
      sound(NAVAL_CLASSIC.bubbles, s.pos, 1);
      if (before !== SHIP_STATES.sinking) onSinking(entry, by);
      feel.sinking(entry, s.seed, s.damage.fire > 0 || (entry.fires ?? []).some((f) => !f.out));   // COMBAT-FEEL MAGAZINE: afire, her powder may go up
      if (boarding?.kind === 'board' && boarding.shipId === entry.id) founderUnderFight(entry);
    }
  }

  /** Two ships of one trade, or two lawful ones (a navy and a merchantman): a stray ball between them is no feud. */
  const kindred = (a, b) => a.cls.faction === b.cls.faction || (!!NAVAL_FACTIONS[a.cls.faction]?.lawful && !!NAVAL_FACTIONS[b.cls.faction]?.lawful);

  /** SEA-EASE: where a lawful player is under a pirate's guns with no crown's ship by them - a pirate I stand afloat,
   *  engaged on them or coming alongside; their notoriety in `crown`'s waters under NAVY_HUNTS; no navy ship afloat
   *  within RELIEF_NEAR_M of them that does not take them for an enemy - or null. Me at my helm, a peer at theirs. */
  function distressAt(crown) {
    const at = new Map();
    const boat = boatInPlay();
    if (boat) at.set(myId(), { pos: boatPose(boat).position, law: notoriety.get(crown) });
    for (const p of deps.peerBoats?.() ?? []) if (Array.isArray(p.pos)) at.set(p.id, { pos: p.pos, law: peerSelf.get(p.id)?.law?.[crown] ?? 0 });
    for (const e of sea.values()) {
      const s = e.ship;
      if (e.owner || s.cls.faction !== 'pirate' || s.damage.state !== SHIP_STATES.afloat || (s.mode !== 'engage' && s.mode !== 'board')) continue;
      const p = at.get(s.target);
      if (!p || !(p.law < NAVY_HUNTS)) continue;
      const me = { kind: 'player', id: s.target, notoriety: () => p.law };
      const stood = [...sea.values()].some((w) => w.ship.cls.faction === 'navy' && w.ship.damage.state === SHIP_STATES.afloat
        && dist2d(w.ship.pos, p.pos) <= RELIEF_NEAR_M && !hostile(w.ship, me, { now: clock }));
      if (!stood) return [p.pos[0], p.pos[1], p.pos[2]];   // a plain array - a pose's position may be typed
    }
    return null;
  }

  // ── SEA-PEACE: the news, the guns heard, a prize taken between ships ─────────────────────────────────────────────
  /** Whether a happening between ships reaches my HUD: one of them fights me, or stands within NEWS_RANGE of me. */
  function newsworthy(...entries) {
    const feet = deps.feet();
    return entries.some((x) => x && (x.ship.target === myId() || dist2d(x.ship.pos, feet) <= NEWS_RANGE));
  }
  const nameOf = (e) => e.ship.names?.name ?? withArticle(classLine(e.ship.cls, e.ship.names?.crown));

  // ── SPYGLASS (2026-10-11, the owner: "Removing observable names from ships and instead implementing a spyglass option
  // where you can aim and view to observe other ships, their allegiance, cargo, etc."): WHAT I KNOW OF EACH SHIP
  // (systems/naval/shipKnowledge.js) - her hull at any range; her colours and name by the naked eye close, a Lookout's
  // call, the glass held on her, or her own acts; her guns, hands and hold through the glass close, or once she strikes.
  // Kept on her entry while she is in my sea; never on the wire (each player's own eye).
  let glassUp = false, glassZoom = GLASS_ZOOM, glassOn = null, glassHeld = 0;
  /** Her false colours, off her seed and temper (a raider's and a hand-launched foe's none: `plain`). AUDIT CAPTAIN'S SEA
   *  S5/D5: THE TRADER SHE PASSES FOR under them - the merchant of her own hull, named off
   *  her own seed as that trader would be (the Isles' names past the Veil), lined as that trader's class, flying the false
   *  crown's colours (the Isles' past the Veil, where every trader flies them) - `{ flag, name, line }`, or null. "A
   *  merchantman of Sentinel" named and lined like no real ship was the tell; a Bay crown's colours past the Veil another. */
  function disguiseOf(e) {
    const plain = !!e.plain;
    if (e.disguise && e.disguise.plain === plain) return e.disguise.as;
    const crown = falseFlagOf(e.ship.cls, e.ship.seed, e.ship.temper, { plain });
    const cls = crown ? merchantOfHull(e.ship.cls.hull) : null;
    const region = CROWNS_BY_NAME.get(crown)?.region ?? 17;
    const as = cls ? { flag: e.ether ? ISLES_FLAG : crown, name: (e.ether ? etherShipNames(cls, e.ship.seed) : shipNames(cls, e.ship.seed, { regionIndex: region })).name, line: classLine(cls) } : null;
    e.disguise = { plain, as };
    return as;
  }
  const falseFlagFor = (e) => disguiseOf(e)?.flag ?? null;
  /** SEA-COLOURS: who she is, as her paint and her flag read it (systems/naval/seaColours.js). */
  const seaWho = (e) => ({ cls: e.ship.cls, seed: e.ship.seed, crown: e.ship.flag ?? null, legend: e.legend ?? null, disguise: falseFlagFor(e) });
  /** What I know of her - KNOW's. */
  const knownOf = (e) => e?.known ?? KNOW.hull;
  /** Whether her false colours still hold for me: not yet seen through by the glass, no black flag run up. */
  const disguisedOf = (e) => !e.blackFlag && knownOf(e) < KNOW.studied && !!falseFlagFor(e);
  /** Her name as I may say it on her tag and card: an unknown hull's ("Unknown galleon"), a merchantman's under false
   *  colours, else her own (her class's line, a ship with none). */
  function shownName(e) {
    if (knownOf(e) < KNOW.colours) return unknownName(e.ship.hull);
    if (disguisedOf(e)) return disguiseOf(e).name;
    return e.ship.names?.name ?? classLine(e.ship.cls, e.ship.names?.crown);
  }
  /** Her line as I may say it: her hull's word unknown, a merchantman's under false colours, else her class's. */
  function shownLine(e) {
    if (knownOf(e) < KNOW.colours) return hullWord(e.ship.hull).replace(/^./, (c) => c.toUpperCase());
    if (disguisedOf(e)) return disguiseOf(e).line;
    return classLine(e.ship.cls, e.ship.names?.crown);
  }
  /** Her name as my crew cries it: an unknown hull by her kind ("A galleon"), else as her tag says it. */
  const calledName = (e) => (knownOf(e) < KNOW.colours ? withArticle(hullWord(e.ship.hull)) : disguisedOf(e) ? shownName(e) : nameOf(e));
  /** SPYGLASS: my deck's eye - the boat I sail, her Lookout's worth (`sight`) and whether one stands at her bow. */
  function deckEye() {
    const deck = boatInPlay();
    const st = deck ? myBoatState(deck) : null;
    return { deck, sight: st?.worth?.sight ?? 1, lookout: !!deck?.crewed && !!st?.worth?.posts?.Lookout };
  }
  /** Whether her guns are out: she engages or closes to board - anyone (a pirate's black flag goes up for any prey). */
  const engagedOf = (s) => s.damage.state === SHIP_STATES.afloat && (s.mode === 'engage' || s.mode === 'board');
  /** SPYGLASS: what a frame teaches me of each ship - the eye, my Lookout, the glass held on her, her acts - and the
   *  words a lesson says: my Lookout's call of her colours, false colours seen through, a black flag run up. */
  /** ETHER-LEGENDS: a `veiled` legend made out at LEGEND_VEIL_K of every reach (the eye's, the lookout's, the glass's). */
  /** ETHER-LEGENDS: the share of every reach a veiled legend is made out at (LEGEND_VEIL_K), 1 for any other ship. */
  const veilOf = (e) => (e.legend && legendOfClass(e.ship.cls.id)?.trait === 'veiled' ? LEGEND_VEIL_K : 1);
  const reachOf = (e, reach) => (e.legend && legendOfClass(e.ship.cls.id)?.trait === 'veiled'
    ? { far: reach.far * LEGEND_VEIL_K, near: reach.near * LEGEND_VEIL_K, eye: reach.eye * LEGEND_VEIL_K, lookout: reach.lookout * LEGEND_VEIL_K } : reach);
  function knowStep() {
    const eye = deps.look?.()?.origin ?? deps.feet();
    const { deck, sight, lookout } = deckEye();
    const night = !!where().night;
    const me = meContact(), law = { notoriety: (c) => notoriety.get(c), now: clock };
    for (const e of sea.values()) {
      if (!e.boat) continue;
      const s = e.ship;
      const dist = dist2d(s.pos, eye);
      const reach = reachOf(e, glassReach({ night, lit: showsLight(e), sight, lookout }));
      const engaged = engagedOf(s);
      // her guns out on me - run out at my side, or her flashes - tell her colours at any range; a crown's ship come to my
      // aid hails me with hers. AUDIT CAPTAIN'S SEA S7: on ME - her target mine, or her boarders on my deck (a pirate at a
      // merchantman 1.2 km off was made out by her fight with another)
      const onMe = s.target === myId() || boarding?.shipId === e.id;
      const gunsOut = s.runOut.size > 0 || gunfire.some((g) => g.by === e.id && clock - g.at <= GUNS_SEEN_S);
      const revealed = (engaged && onMe && gunsOut && hostile(s, me, law)) || !!e.relief;
      const was = knownOf(e);
      const held = glassUp && glassOn === e.id ? glassHeld : 0;
      const struck = s.damage.state !== SHIP_STATES.afloat || !!s.boarded || !!e.prize;
      e.known = knowledgeOf(was, { dist, reach, held, revealed, struck });
      if (was < KNOW.studied && e.known >= KNOW.studied && held > 0 && !struck) deps.captain?.event?.({ type: 'study', crown: watersCrown(), seed: e.ship.seed });   // CAPT-BOARD: the Admiralty's survey - AUDIT CAPTAIN'S SEA L6: each ship once, by her seed
      const ff = engaged && !e.blackFlag ? falseFlagFor(e) : null;
      if (ff) {
        // her false colours struck and the black flag run up as she goes for her prey - said where her flag is seen: by
        // the eye, my Lookout, or the glass on her
        e.blackFlag = true;
        // AUDIT CAPTAIN'S SEA S21: the trader she passed for named only while her colours held for me; seen through, she is
        // the pirate she is
        if (held > 0 || dist <= Math.max(reach.eye, reach.lookout)) deps.say?.(was === KNOW.colours ? `False colors! ${disguiseOf(e)?.name ?? 'The merchantman'} runs up the black flag!` : was >= KNOW.studied ? `${s.names?.name ?? 'It'} runs up the black flag!` : `${withArticle(hullWord(s.hull))} runs up the black flag!`, 4);
      }
      if (was >= e.known) continue;
      if (was < KNOW.colours && !held && lookout && dist > reach.eye && dist <= reach.lookout) {
        // my Lookout calls her colours from the bow (her false ones, while they hold)
        const colours = disguisedOf(e) ? coloursWords('merchant', falseFlagFor(e)) : coloursWords(s.cls.faction, s.flag);
        deps.say?.(`Lookout: ${withArticle(hullWord(s.hull))} flying ${colours}!`, 3);
        hailCalls.set(deck, `Flying ${colours}!`);   // from the bow (a Lookout stands only on a crewed deck)
      }
      if (e.known >= KNOW.studied && !e.blackFlag && !e.seenThrough && falseFlagFor(e)) {
        e.seenThrough = true;   // seen through: her colours are a lie - a pirate to me from now, whatever she flies
        // AUDIT CAPTAIN'S SEA S21: said only where she is seen - the glass on her, the eye, my Lookout (one struck far off is not)
        if (held > 0 || dist <= Math.max(reach.eye, reach.lookout)) deps.mid?.(`False colors! ${s.names?.name ?? 'It'} is a pirate.`, 4);
      }
    }
  }
  /** GLASS-CLEAR: the ship I stand aboard as one box in her own frame, heeling and pitching with her - every rigid
   *  mesh of her hull and rig (sparsOf) and her set canvas where its booms swing it (rigBoxesOf) - the box the glass's
   *  focus stands past (ui/spyglassView.js glassClearDepth). My deck (boatInPlay), a sea ship's my feet are on, or another
   *  player's I ride; null aboard none, or before her meshes are known. Her spars' box is kept OWN_SPARS_S (sparsOf walks
   *  every mesh of hers - most of a millisecond on the galley's 136, each frame the glass is up) and taken again after
   *  it, or at once for another ship; her canvas each frame. */
  let ownSpars = null;   // { boat, at, lo, hi } - her spars' box in her mesh object's frame, and when it was taken
  function ownExtent() {
    const boat = boatInPlay() ?? seaDeckUnderMe()?.boat ?? deps.aboardPeer?.() ?? null;
    const mo = boat?.MeshObject;
    if (!mo) return null;
    if (ownSpars?.boat !== boat || clock - ownSpars.at >= OWN_SPARS_S) {
      const spars = sparsOf(boat, deps.pool.models);
      if (!spars) return null;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const p of spars.points) for (let d = 0; d < 3; d++) { if (p[d] < lo[d]) lo[d] = p[d]; if (p[d] > hi[d]) hi[d] = p[d]; }
      ownSpars = { boat, at: clock, lo, hi };
    }
    const lo = [...ownSpars.lo], hi = [...ownSpars.hi];
    const take = (p) => { for (let d = 0; d < 3; d++) { if (p[d] < lo[d]) lo[d] = p[d]; if (p[d] > hi[d]) hi[d] = p[d]; } };
    for (const b of rigBoxesOf(boat)) {
      for (let i = 0; i < 8; i++) take(mo.inverseTransformPoint([0, 1, 2].map((d) => b.c[d] + (i & 1 ? 1 : -1) * b.ax[d] * b.h[0] + (i & 2 ? 1 : -1) * b.ay[d] * b.h[1] + (i & 4 ? 1 : -1) * b.az[d] * b.h[2])));
    }
    return orientedBox(mo.worldMatrix(), [0, 1, 2].map((d) => (lo[d] + hi[d]) / 2), [0, 1, 2].map((d) => (hi[d] - lo[d]) / 2));
  }
  /**
   * SPYGLASS: the glass's frame - raised (`up`), its magnification (`zoom`, the wheel's), the look it is held along. The
   * ship it holds (glassHolds: her hull's length or the reticle's width, the nearest to its centre) is studied while held
   * - a ship the glass leaves is begun afresh. Answers the glass card (shipKnowledge.js glassCard) or null. GLASS-CLEAR:
   * `near` the glass's focus (ui/spyglassView.js glassNear) - a ship nearer is not drawn in it, and is not held.
   */
  function glass(dt, { up = false, zoom = GLASS_ZOOM, field = Math.PI, near = 0 } = {}) {
    glassUp = !!up && enabled;
    glassZoom = clamp(Number(zoom) || GLASS_ZOOM, GLASS_ZOOM_MIN, GLASS_ZOOM_MAX);
    if (!glassUp) { glassOn = null; glassHeld = 0; return null; }
    const look = deps.look?.();
    if (!look) return null;
    const len = Math.hypot(look.dir[0], look.dir[1], look.dir[2]) || 1;
    const d = [look.dir[0] / len, look.dir[1] / len, look.dir[2] / len];
    const night = !!where().night;
    let best = null, bestA = Infinity;
    for (const e of sea.values()) {
      // AUDIT CAPTAIN'S SEA S6: only a ship an eye could find - never one the sea has let go once half faded out of it
      // (AUDIT BAY A14's half: her flats gone), by night within what the night lets the glass see of her (by day her hull
      // at any range), and not behind the land
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk || (e.retiring && (e.fade ?? 1) < FADE_FLATS)) continue;
      const p = e.ship.pos;
      const to = [p[0] - look.origin[0], p[1] + GLASS_AIM_LIFT - look.origin[1], p[2] - look.origin[2]];
      const dist = Math.hypot(to[0], to[1], to[2]);
      if (dist < Math.max(1, near)) continue;   // GLASS-CLEAR: nearer than the glass is focused she is not drawn in it - nor held
      if (night && dist > reachOf(e, glassReach({ night, lit: showsLight(e), sight: Infinity })).far) continue;
      const a = Math.acos(clamp((to[0] * d[0] + to[1] * d[1] + to[2] * d[2]) / dist, -1, 1));
      // AUDIT CAPTAIN'S SEA S19: her extent as she lies to the look - her length abeam, her beam bow-on - and never past
      // the glass's own field (`field`, the tube's radius in radians)
      const b = hullBuild(e.ship.hull), off = Math.atan2(to[0], to[2]) - e.ship.yaw;
      const half = ((b.bowZ - b.aftZ) / 2) * Math.abs(Math.sin(off)) + b.halfWidth * Math.abs(Math.cos(off));
      if (!glassHolds(a, dist, half, glassZoom, field)) continue;
      if (a < bestA && !deps.sightBlocked?.(e.id, [p[0], p[1] + GLASS_AIM_LIFT, p[2]])) { bestA = a; best = e; }
    }
    if ((best?.id ?? null) !== glassOn) { glassOn = best?.id ?? null; glassHeld = 0; }
    if (!best) return null;
    glassHeld += Math.max(0, dt);
    return glassCardOf(best);
  }
  // ── CAPT-BOARD (bible/03-World/Captains-Sea.md): THE SITES - a held contract's waters (harbourBoard.js contractSites,
  // the world's `captain.sites`): a bounty's quarry stood when I sail within SITE_REACH_PX map pixels of her waters, a
  // wreck's casks floated there; again if the sea let her go, or her casks sank, before the contract was done. And a
  // delivery's port: a boat of mine lying to its quay is the berth the contract asks after.
  const siteStood = new Map();   // site id -> her entry's id (a quarry), or 'casks'
  let lastSiteCheck = -Infinity;
  /** The crown of the waters I sail (the survey's and the hunt's). */
  const watersCrown = () => { const w = where(); return w.ether ? null : crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1).name; };   // ETHER-SEA: no crown's waters past the Veil
  /** A site's point in the scene: the world's water within her map pixel (`sitePoint`) where it is at least `minM` off,
   *  else SITE_AHEAD_M off me toward it - the first open water of thirteen ways round. */
  function sitePos(site, minM) {
    const f = deps.feet();
    const p = deps.sitePoint?.(site.px, site.py, site.seed) ?? null;
    const cand = p ? [p] : [];
    const a0 = p ? Math.atan2(p[0] - f[0], p[2] - f[2]) : ((site.seed >>> 0) % 360) * (Math.PI / 180);
    for (let k = 0; k < 12; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
      cand.push([f[0] + Math.sin(a) * SITE_AHEAD_M, deps.seaY(), f[2] + Math.cos(a) * SITE_AHEAD_M]);
    }
    return cand.find((q) => dist2d(q, f) >= minM && deps.isWater(q[0], q[2], 0)) ?? null;
  }
  /** AUDIT CAPTAIN'S SEA B4: A BOUNTY'S QUARRY GONE DOWN BY ANOTHER HAND (no blow of mine charged her end - a crown's
   *  relief, a stray ball, another captain's): her site never stands her again (she came back whole, and her casks floated
   *  anew each time), and her bounty is void - said, no regard lost. */
  function quarryGone(e) {
    if (e.owner || !e.bounty || e.charged?.has('sink') || e.charged?.has('board')) return;
    siteStood.set(e.bounty, 'ended');
    deps.captain?.event?.({ type: 'lost', bounty: e.bounty });
  }
  /** A bounty's quarry stood: her class, her seed and her region's names (the board's), bold, flying no false colours. */
  function standQuarry(site) {
    const cls = classById(site.classId);
    const pos = cls ? sitePos(site, SITE_AHEAD_M * 0.6) : null;
    if (!pos) return null;
    const f = deps.feet();
    const e = launch({ seed: site.seed >>> 0, classId: cls.id, variant: 0, pos, yaw: Math.atan2(f[0] - pos[0], f[2] - pos[2]), region: site.region });
    if (!e) return null;
    e.bounty = site.id; e.plain = true; e.ship.temper = TEMPERS.bold;
    return e;
  }
  /** ETHER-SEA (AUDIT CAPTAIN'S SEA D2): a strand's haul alongside - open water STRAND_ALONGSIDE_M off the boat that
   *  pulled in for it, its bearing the site's seed's - never the isle's own pixel (its centre mostly land: the casks went
   *  to the 700 m ring past her, on no bearing of the isle's). */
  function alongsidePos(site) {
    const f = deps.feet();
    const a0 = ((site.seed >>> 0) % 360) * (Math.PI / 180);
    for (let k = 0; k < 12; k++) {
      const a = a0 + k * (Math.PI / 6);
      const q = [f[0] + Math.sin(a) * STRAND_ALONGSIDE_M, deps.seaY(), f[2] + Math.cos(a) * STRAND_ALONGSIDE_M];
      if (deps.isWater(q[0], q[2], 0)) return q;
    }
    return null;
  }
  /** A wreck's casks floated about her point: `site.n`, SITE_CASK_LIFE each, scattered SITE_CASK_SPREAD about - each on
   *  open water (AUDIT CAPTAIN'S SEA D2: a strand's lie by its shore, and a cask scattered onto the beach floated in the
   *  ground out of every reach; one that would is floated at the point itself, open water). */
  function dropSiteCasks(site) {
    const c = site.kind === 'strand' ? alongsidePos(site) : sitePos(site, 0);
    if (!c) return false;
    const r = mulberry32(((site.seed >>> 0) ^ 0x5a1e5) >>> 0);
    for (let i = 0; i < site.n; i++) {
      const a = r() * Math.PI * 2, d = 6 + r() * SITE_CASK_SPREAD;
      const x = c[0] + Math.sin(a) * d, z = c[2] + Math.cos(a) * d, wet = deps.isWater(x, z, 0);
      shots.dropFlotsam({ id: String(u32()), pos: wet ? [x, deps.seaY(), z] : [c[0], deps.seaY(), c[2]], lot: SITE_LOT + site.id, from: 'merchantGalleon', life: SITE_CASK_LIFE });
    }
    return true;
  }
  /** What a site's casks are said as when they float out. */
  const SITE_WORDS = Object.freeze({
    cache: 'Your lookout spots a chest bobbing where the chart said. The cache!',
    salvage: 'Wreckage and floating casks. This is the wreck the harbormaster wants raised.',
    strand: 'Your boat goes ashore and comes back with its haul. The casks float alongside.',   // ETHER-SEA: a wild isle's good
  });
  /** THE SITES' STEP, SITE_CHECK_S apart: the berth said, then each held site within reach stood if it is not. */
  function siteStep(boat) {
    if (clock - lastSiteCheck < SITE_CHECK_S) return;
    lastSiteCheck = clock;
    const w = where();
    berths.step(boat, w.port);   // a delivery's port, a voyage's end (navalBerth.js: still or not, and the helm let go there)
    const sites = deps.captain?.sites?.() ?? [];
    const live = new Set(sites.map((x) => x.id));
    for (const id of [...siteStood.keys()]) if (!live.has(id)) siteStood.delete(id);
    if (!aboardShip() || !Number.isFinite(w.px) || !Number.isFinite(w.py)) return;
    for (const site of sites) {
      if (Math.max(Math.abs(site.px - w.px), Math.abs(site.py - w.py)) > SITE_REACH_PX) continue;
      const was = siteStood.get(site.id);
      if (site.kind === 'bounty') {
        if (was === 'ended' || (was && sea.has(was))) continue;   // AUDIT CAPTAIN'S SEA B4: gone down by another hand - never stood again
        const e = standQuarry(site);
        if (e) { siteStood.set(site.id, e.id); deps.say?.('Sails, right where the board said!', 4); }
      } else if ((site.kind === 'salvage' || site.kind === 'cache' || site.kind === 'strand') && site.n > 0) {
        // AUDIT CAPTAIN'S SEA D1: never while her casks float - a strand leaves the list out of reach (the stood mark with
        // it), and each return floated three more until the first was hauled
        if (shots.floaters().some((x) => x.lot === SITE_LOT + site.id)) continue;
        if (dropSiteCasks(site)) { siteStood.set(site.id, 'casks'); deps.say?.(site.word ?? SITE_WORDS[site.kind], 4); }   // SEA-EVENTS: a storm's wrack says its own
      }
    }
  }
  /** SPYGLASS: the glass card of a ship as I know her now. */
  function glassCardOf(e) {
    const s = e.ship;
    const dist = dist2d(s.pos, deps.look?.()?.origin ?? deps.feet());
    const stance = stanceOf(s);
    const engaged = stance.hostile && engagedOf(s);
    const v = velocityOf(s);
    const known = knownOf(e);
    const { sight, lookout } = deckEye();
    const reach = reachOf(e, glassReach({ night: !!where().night, lit: showsLight(e), sight, lookout }));   // ETHER-LEGENDS: a veiled one's
    // the study under way: her colours within the glass's far reach, the rest within its near - past it, how close
    const [needS, needM] = known < KNOW.colours ? [GLASS_STUDY_S, reach.far] : [GLASS_STUDY_NEAR_S, reach.near];
    const short = known < KNOW.studied && dist > needM;
    return glassCard({
      hull: s.hull, name: s.names?.name ?? classLine(s.cls, s.names?.crown), classLine: classLine(s.cls, s.names?.crown), faction: s.cls.faction,
      flag: s.flag, falseFlag: e.blackFlag ? null : falseFlagFor(e), falseName: e.blackFlag ? null : disguiseOf(e)?.name ?? null, falseLine: e.blackFlag ? null : disguiseOf(e)?.line ?? null, temper: s.temper, mode: s.mode, hostile: engaged, friendly: stance.friendly, bound: boundOf(e),
      distance: dist, speed: Math.hypot(v[0], v[2]), crew: s.damage.crew, hullShare: s.damage.hullShare(), sailShare: s.damage.maxSail > 0 ? s.damage.sailShare() : null,
      fire: s.damage.fire > 0, cargo: holdShownOf(e), bounty: deps.bountyOf?.(e) ?? null, lore: (e.legend ? legendOfClass(s.cls.id)?.lore : null) ?? deps.loreOf?.(e) ?? null,   // ETHER-LEGENDS: what the Eltheric Ocean tells of her
    }, known, { study: short ? 0 : Math.min(1, glassHeld / needS), within: short ? needM : null });
  }
  /** AUDIT CAPTAIN'S SEA S20: how her hold rides, as it is - her class's cargo, DEEP_TIER and her band's tier richer as
   *  her hold is drawn (CAPT-WATERS, ETHER-SEA), and nothing once a prize's hold is emptied (cargoWords clamps). */
  const holdShownOf = (e) => (e.prize?.hold && !e.prize.hold.length ? 0 : e.ship.cls.cargo + (e.deep ? DEEP_TIER : 0) + etherTier(e));
  /** The volleys heard at sea, HEAR_S each (navalAI.js heardGuns) - the newest GUNFIRE_KEEP. */
  let gunfire = [];
  /** AUDIT WK-N1: who a report shows by its flashes - the shooter as the captains' contacts name her: mine by my own id,
   *  a peer's by theirs. Their boats' keys (`me:`, `peer:`) named no contact, so a player firing by night was never seen
   *  by the flashes a sea ship is. */
  const gunfireBy = (shooter) => (isMine(shooter) ? myId() : typeof shooter === 'string' && shooter.startsWith('peer:') ? shooter.slice(5) : shooter);
  /** AUDIT WK-N6: whether a sea ship shows herself by night - her lanterns, or her guns' flashes within GUNS_SEEN_S (the
   *  captains' own law, navalAI.js stepCaptain): my lookout and my crew read her by it as they do. */
  const showsLight = (e) => shipLit(e) || gunfire.some((g) => g.by === e.id && clock - g.at <= GUNS_SEEN_S);
  function heardGun(pos, by) {
    gunfire = gunfire.filter((g) => clock - g.at <= HEAR_S);
    if (gunfire.length >= GUNFIRE_KEEP) gunfire.shift();
    gunfire.push({ pos: [pos[0], pos[1], pos[2]], at: clock, by: by ?? null });
  }
  /** A captain of mine grapples the ship that struck to her: the two lashed PRIZE_TAKE_S while her boarders carry the
   *  deck (a prize another stands, one already being taken, or one I board is never hers). */
  function lashPrize(victor, prize) {
    if (prize.owner || prize.takenBy || prize.ship.damage.state !== SHIP_STATES.struck || boarding?.shipId === prize.id) return;
    victor.ship.lashed = { id: prize.id, until: clock + PRIZE_TAKE_S };
    prize.takenBy = victor.id;
    if (newsworthy(victor, prize)) deps.say?.(`${calledName(victor)} grapples ${calledName(prize)}!`, 3);
  }
  /** A victor cast off her prize - under fire, or the prize gone from under her; the prize is anyone's again. */
  function unlashPrize(victor) {
    const p = victor.ship.lashed ? sea.get(victor.ship.lashed.id) : null;
    if (p?.takenBy === victor.id) p.takenBy = null;
    victor.ship.lashed = null;
  }
  /** The prizes my captains are taking: each held until its time is out, then taken - fired, the victor's crew thinned
   *  by PRIZE_COST of the prize's (never her last man) - or given up when the prize is no longer hers to take. */
  function stepPrizes() {
    for (const v of sea.values()) {
      const l = v.ship.lashed;
      if (!l) continue;
      const p = sea.get(l.id);
      if (!p || p.takenBy !== v.id || p.ship.damage.state !== SHIP_STATES.struck || boarding?.shipId === p.id || v.ship.damage.state !== SHIP_STATES.afloat) { unlashPrize(v); continue; }
      if (clock < l.until) continue;
      v.ship.lashed = null;
      v.ship.spare.set(p.id, v.ship.clock + SPARE_S);
      const lost = Math.min(Math.max(0, v.ship.damage.crew - 1), Math.round(p.ship.damage.crew * PRIZE_COST));
      if (lost > 0) v.ship.damage.apply({ hull: 0, sail: 0, crew: lost }, clock);
      p.ship.damage.scuttle();
      p.ship.damage.apply({ hull: 0, sail: 0, crew: 0, fire: true }, clock);   // her torch burns on as she goes (navalDamage.js step)
      igniteShip(p);
      sound(NAVAL_CLASSIC.bubbles, p.ship.pos, 1);
      if (newsworthy(v, p)) deps.say?.(`${calledName(v)} takes ${calledName(p)} and sets it on fire!`, 4);
    }
  }

  // ── AUDIT NAV1 (the guns): my volley's tally (scenes/naval/navalTally.js) ───────────────────────────────────────
  const tallies = createVolleyTally({ clock: () => clock, onSea: (id) => sea.has(id) });

  // ── AUDIT NAV1 (the guns): the run-out - the tell before a broadside ────────────────────────────────────────────
  /** A battery of hers begins to run out: the trucks' rumble from her side (the glint is drawn while it is out). */
  function runOutTell(entry, side) {
    const bat = batteryOf(entry.ship.hull, side);
    if (!bat) return;
    const pose = { position: entry.ship.pos, rotation: quatOfYaw(entry.ship.yaw) };
    const mid = toWorld(pose, bat.muzzles[bat.muzzles.length >> 1]);
    sound(NAVAL_SFX.runout, mid, 1);
  }
  /** Her run-out batteries' ports, glinting - the linstocks' match and the lanterns behind the open lids. */
  function glintRunOut(entry, d, seaY) {
    const s = entry.ship;
    if (!s.runOut?.size || !entry.boat) return;
    const pose = { position: [s.pos[0], seaY, s.pos[2]], rotation: quatOfYaw(s.yaw) };
    for (const [side, since] of s.runOut) {
      const bat = batteryOf(s.hull, side);
      if (!bat) continue;
      const k = clamp((clock - since) / RUN_OUT_S, 0, 1);
      for (const m of bat.muzzles) effects.glint(toWorld(pose, m), k, d);
    }
  }
  /** Whether a battery of hers bears on a point: within its run-out arc and INCOMING_SLACK, inside its reach. */
  function bearsOn(s, side, p) {
    const bat = batteryOf(s.hull, side);
    if (!bat || bat.gun === 'barrel') return false;
    const dx = p[0] - s.pos[0], dz = p[2] - s.pos[2];
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - s.yaw - (side === 'starboard' ? Math.PI / 2 : side === 'port' ? -Math.PI / 2 : 0))) / NAVAL_DEG;
    if (off > (side === 'bow' ? BOW_RUN_OUT : RUN_OUT_DEG) + INCOMING_SLACK) return false;
    const g = GUNS[bat.gun];
    return Math.hypot(dx, dz) <= rangeAt(g.maxEl * NAVAL_DEG, g.speed, bat.muzzles[0][1]) * 1.05;
  }
  /** Her volleys fired at my boat still in the air - the warning stands until the last ball is down: `{ name, until }`. */
  let inbound = [];
  /** An AI volley fired: if it bore on my boat, the warning holds through its flight (its range over the ball's way). */
  function noteInbound(e, side) {
    const boat = myBoat();
    if (!boat) return;
    const p = boatPose(boat).position;
    if (!bearsOn(e.ship, side, p)) return;
    const g = GUNS[batteryOf(e.ship.hull, side).gun];
    inbound.push({ name: e.ship.names?.name ?? 'A ship', side, until: clock + dist2d(e.ship.pos, p) / Math.max(1, g.speed * 0.9) + (batteryOf(e.ship.hull, side).muzzles.length - 1) * RIPPLE_S + 0.3 });
  }
  /** The run-out that bears on my boat now, soonest to fire - or a volley of hers at me still in the air: `{ name,
   *  side, t }` (t: seconds until it may fire, 0 once it has), or null. */
  function incoming(boat) {
    if (!boat) return null;
    const p = boatPose(boat).position;
    inbound = inbound.filter((v) => v.until > clock);
    let best = inbound.length ? { name: inbound[0].name, side: inbound[0].side, t: 0 } : null;
    for (const e of sea.values()) {
      const s = e.ship;
      if (!s.runOut?.size || s.damage.state !== SHIP_STATES.afloat) continue;
      for (const [side, since] of s.runOut) {
        if (!bearsOn(s, side, p)) continue;
        const t = Math.max(0, RUN_OUT_S - (clock - since));
        if (!best || t < best.t) best = { name: s.names?.name ?? 'A ship', side, t: +t.toFixed(1) };
      }
    }
    return best;
  }

  /** STOLEN-GOODS AUDIT (S4): whether a ship's goods are someone's keeping - a lawful ship's this side of the Veil, whose
   *  boarding is Piracy and whose sinking follows a Piracy struck (navalLaw.js lawOf); a pirate's are a lawful prize, and
   *  past the Veil no crown's writ runs. Her hold boarded and her casks I sank her for are marked alike: the cargo of a
   *  ship sunk by another, or of one whose owner gave me the cask (AUDIT NAV1's claim), is salvage, and her wreckage's
   *  stores (SALVAGE) are her fittings, no one's goods. */
  const lawfulGoods = (entry) => !entry.ether && !!NAVAL_FACTIONS[entry.ship.cls.faction]?.lawful;

  function onSinking(entry, by) {
    const s = entry.ship;
    const drop = (lot, near, far) => {
      const a = random() * Math.PI * 2, r = near + random() * (far - near);
      const id = String(u32());
      shots.dropFlotsam({ id, pos: [s.pos[0] + Math.sin(a) * r, deps.seaY(), s.pos[2] + Math.cos(a) * r], lot, from: s.cls.id, deep: !!entry.deep || !!entry.ether });   // CAPT-WATERS: her casks the deep's (ETHER-SEA: the Eltheric Ocean's as rich)
      if (by === myId()) myCasks.add(id);   // KEEP-PLUNDER: a ship I sank - her casks are mine to stow if the sea goes first
      if (by === myId() && lawfulGoods(entry)) stolenCasks.add(id);   // STOLEN-GOODS AUDIT: her lots her owner's, as boarded
    };
    // her lots that float free
    for (const key of flotsamKeys(s.cls, s.seed)) drop(key, 6, 16);
    drop(SALVAGE_LOT, 3, 8);   // SALVAGE: her wreckage, close where she went down
    if (by === myId()) chargePlayer('sink', entry);
  }

  /** The law's reckoning with the player, once per act per ship. CAPT-LOG: and the captain's ledger's - the deed logged by
   *  her trade and a crown's regard moved (`deps.captain`); CAPT-MARQUE: a lawful ship of a RIVAL crown struck under the
   *  letter of marque held is that rival's grievance - its crime, its notoriety, its regard lost - and the letter's
   *  crown's regard won; one of the letter's own crown's tears it up. CAPT-PAY: boarders thrown back are a pirate's end. */
  function chargePlayer(act, entry, { questPays = false } = {}) {
    const s = entry.ship;
    entry.charged ??= new Set();
    if (entry.charged.has(act)) return;
    entry.charged.add(act);
    if (entry.ether) { chargeEther(act, entry); return; }   // ETHER-SEA: past the Veil no crown's writ runs
    const lawful = !!NAVAL_FACTIONS[s.cls.faction]?.lawful;
    const held = lawful ? deps.captain?.marque?.() ?? null : null;
    const under = held && s.flag && s.flag !== held.crown ? held.crown : null;   // a rival's ship, under the letter
    if (held && s.flag === held.crown) {
      deps.captain?.tearMarque?.();
      deps.mid?.(`You attacked a ship of ${held.crown}. Your letter of marque is revoked.`, 4);
    }
    const crown = under ? s.flag : crownOfShip(s);
    const law = lawOf(act, s.cls, { crown, firstStrike: act === 'fire' });
    // AUDIT CAPTAIN'S SEA L1: a pirate whose boarders were thrown back was ended then (CAPT-PAY: "rewarded as a sinking
    // is") - taken or sunk after, her end is logged and never paid again (the law's reward and the crown's regard came twice)
    const paid = (act === 'sink' || act === 'board') && entry.charged.has('repel');
    for (const c of law.crimes) { deps.law?.crime?.(c.region, c.crime); deps.say?.(`Piracy! The crown of ${crown} will hear of this.`, 4); }
    for (const n of law.notoriety) notoriety.add(n.crown, n.add);
    for (const r of questPays || paid ? [] : law.rewards) {   // CAPT-PAY: WAQ_SHIP_ATTACK_PIRATE won pays its own repute
      if (r.legal) deps.law?.legal?.(r.region, r.legal);
      if (r.knightly) deps.law?.faction?.(KNIGHTLY_FACTION, r.knightly);
      if (r.temple) deps.law?.faction?.(TEMPLE_FACTION, r.temple);
    }
    const cap = deps.captain;
    if (!cap) return;
    cap.deed?.(act, s.cls, paid ? { crown: null } : { crown, marque: under });   // L1: logged, no regard a second time
    if (under) cap.regard?.(s.flag, standingFor(act, s.cls));   // the rival's regard: piracy's, as ever
    if (act === 'sink' || act === 'board') cap.event?.({ type: 'end', act, faction: s.cls.faction, crown, bounty: entry.bounty ?? null });   // CAPT-BOARD: a bounty, a hunt
    const chart = act === 'sink' || act === 'board' ? cap.chartFor?.(s.cls, s.seed, !!entry.deep) ?? null : null;   // CAPT-CHARTS: among her papers
    if (chart) {
      deps.board?.giveItems?.([chart], boatInPlay() ?? null, { force: true });   // AUDIT CAPTAIN'S SEA B9: never let go for a full pack
      deps.say?.(act === 'sink' ? 'A sealed chart case floats up from the wreck and your crew fishes it out. A treasure chart!' : 'Among the captain\'s papers: a treasure chart!', 5);
    }
  }

  /** ETHER-SEA - A SHIP OF THE ELTHERIC OCEAN ENDED: no crime, no notoriety, no crown's regard (the ledger logs her by her
   *  trade, 'ether' - a legend's 'legend', her name kept and every crown hearing of it); a legend's purse paid and her end
   *  remembered (the world's `ether.legendEnded`); a corsair's papers read for a chart of her waters. */
  function chargeEther(act, entry) {
    const s = entry.ship, cap = deps.captain;
    if (!cap) return;
    const legend = entry.legend ? legendOfClass(s.cls.id) : null;
    cap.deed?.(act, s.cls, { trade: legend ? 'legend' : 'ether', legend: legend?.name ?? null });
    if (act !== 'sink' && act !== 'board') return;
    cap.event?.({ type: 'end', act, faction: s.cls.faction, crown: null, bounty: entry.bounty ?? null });
    if (legend) legendTidemail(legend, s.seed, deps.ether?.legendEnded?.(legend.id, act), { give: (items) => deps.board?.giveItems?.(items, boatInPlay() ?? null, { force: true }), say: (text, n) => deps.say?.(text, n) });   // SEA-SET (navalSeaSet.js): her piece - AUDIT SEA VENTURES D1: only with her purse
    else if (s.cls.faction === 'pirate') { const w = where(); deps.ether?.papers?.(s.cls, s.seed, w.px, w.py); }   // a corsair's papers
    treasureFleet.ended(entry, act);   // SEA-EVENTS: the treasure fleet's flagship - her Tidemail piece, her purse
  }
  /** The crown whose law a ship answers to: a navy's her own, else the crown of the waters she sails. */
  function crownOfShip(s) {
    const w = where();
    return s.names?.crown ?? crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1).name;
  }
  function igniteShip(entry) {
    if (entry.fires?.length || !deps.flame) return;
    entry.fires = [];
    const spots = entry.ship.hull === 1 ? 1 : 3;
    for (let i = 0; i < spots; i++) {
      const at = (i - (spots - 1) / 2) * 0.5;
      entry.fires.push({ at, handle: deps.flame(entry.ship.pos) });
    }
  }
  function douse(entry) {
    for (const f of entry.fires ?? []) f.handle?.retire?.();
    entry.fires = null;
    entry.fireLoop?.stop?.();
    entry.fireLoop = null;
  }

  /** A cask hauled aboard: its lot's items into the hold of the boat that sailed through it (Come Sail Away's cargo). */
  function pickFlotsam(e) {
    const swim = e.collector === SWIMMER;
    const boat = swim ? null : myBoats().find((b) => myBoatId(b) === e.collector) ?? myBoat();
    if (isSalvage(e.lot)) { pickSalvage(e, boat, swim); return; }   // SALVAGE: her wreckage, no hold's lot
    if (isSiteLot(e.lot) && e.lot.startsWith(SITE_LOT + CHART_SITE)) { pickCache(e, boat, swim); return; }   // CAPT-CHARTS: a chart's cache
    if (isSiteLot(e.lot) && e.lot.startsWith(SITE_LOT + STRAND_SITE)) { pickStrand(e, boat, swim); return; }   // ETHER-SEA: a wild isle's good
    if (isSiteLot(e.lot)) {   // CAPT-BOARD: a cask of a contract's wreck - the contract's to count
      deps.say?.(swim ? 'You pull a cask of the wreck\'s cargo out of the sea.' : 'You haul a cask of the wreck\'s cargo aboard.', 3);
      deps.captain?.event?.({ type: 'haul', site: e.lot.slice(SITE_LOT.length) });
      sound(NAVAL_CLASSIC.splashSmall, e.point, 0.6);
      return;
    }
    const items = deps.hold?.(e.lot, holdTier(classById(e.from)) + (e.deep ? DEEP_TIER : 0)) ?? [];   // CAPT-WATERS: a deep ship's cask the richer
    if (e.id != null && stolenCasks.delete(e.id)) markStolen(items);   // STOLEN-GOODS AUDIT: a lawful ship's lot I sank her for
    if (items.length) { deps.board?.giveItems?.(items, boat ?? null); crewEvent(boat, 'plunder'); notePlunder(items); }   // SHIP-CREW: a hold filled; CAPT-LOG: the plunder hauled
    const things = `${items.length} ${items.length === 1 ? 'thing' : 'things'}`;
    deps.say?.(swim ? (items.length ? `You break open a floating cask (${things} in it).` : 'You break open a floating cask. It is empty.')
      : items.length ? `You haul a floating cask aboard (${things} in it).` : 'You haul a floating cask aboard. It is empty.', 3);
    sound(NAVAL_CLASSIC.splashSmall, e.point, 0.6);
  }

  /** ETHER-SEA: a cask of a wild isle's strand hauled - its good (the world's `ether.gather`) into the hold of the boat
   *  that sailed through it (a swimmer's pack), said. */
  function pickStrand(e, boat, swim) {
    const r = deps.ether?.gather?.(e.lot.slice(SITE_LOT.length)) ?? { items: [], text: '' };
    if (r.items.length) { deps.board?.giveItems?.(r.items, boat ?? null); crewEvent(boat, 'plunder'); }   // a swimmer's boat is none: his pack
    const how = swim ? 'You break open a cask in the water' : 'You haul a cask aboard';   // AUDIT CAPTAIN'S SEA D2: a swimmer's to his pack, said so
    deps.say?.(r.text ? `${how}: ${r.text}` : `${how}. It is empty.`, 4);
    if (e.point) sound(NAVAL_CLASSIC.splashSmall, e.point, 0.6);
  }
  /** CAPT-CHARTS: a chart's cache hauled up - two of a strongbox's lots and its gold, said; the chart off the captain's. */
  function pickCache(e, boat, swim) {
    const items = [];
    for (let i = 0; i < CACHE_LOTS; i++) for (const it of deps.hold?.(STRONGBOX_KEY, STRONGBOX_RARITY_TIER) ?? []) items.push(it);
    // AUDIT CAPTAIN'S SEA B9: every lot of it kept - a pack that cannot carry it all is overladen, said (what it could not
    // carry went down unsaid, the cache's mark struck off with it)
    const r = items.length ? deps.board?.giveItems?.(items, boat ?? null, { force: true }) ?? null : null;
    if (items.length) notePlunder(items);
    const gold = deps.captain?.raiseCache?.(e.lot.slice(SITE_LOT.length)) ?? 0;
    deps.say?.(`You ${swim ? 'drag' : 'haul'} up the cache: ${gold ? `${gold} gold and ` : ''}${items.length} ${items.length === 1 ? 'thing' : 'things'}${r?.over ? ' (more than you can carry)' : ''}.`, 5);
    if (e.point) sound(NAVAL_CLASSIC.splashSmall, e.point, 0.6);
  }
  /** SALVAGE: a sunk ship's wreckage hauled in - her stores and powder to the boat that sailed through it (a swimmer's to
   *  the boat of mine he swims beside - boatInPlay's own reach - else his pack), said. */
  function pickSalvage(e, boat, swim) {
    const into = swim ? boatInPlay() : boat ?? boatInPlay();
    const r = stowSalvage(salvageOf(classById(e.from)), into);
    const got = [r.stores ? `${r.stores} carpenter's ${r.stores === 1 ? 'store' : 'stores'}` : null, r.barrels ? `${r.barrels} fire ${r.barrels === 1 ? 'barrel' : 'barrels'}` : null].filter(Boolean);
    const head = !swim ? 'You haul the wreckage aboard' : into ? 'You pick through the wreckage and pass it up aboard' : 'You pick through the wreckage';
    const heavy = (n) => `${n} carpenter's ${n === 1 ? 'store is' : 'stores are'} too heavy to carry and ${n === 1 ? 'goes' : 'go'} down with the wreck`;
    if (got.length) deps.say?.(`${head}: ${got.join(' and ')}.`, 3);
    if (r.lost) deps.say?.(got.length ? `${heavy(r.lost)}.` : `${head}, but ${heavy(r.lost)}.`, 3);
    if (!got.length && !r.lost) deps.say?.(`${head}. Nothing in it is worth keeping.`, 3);
    if (r.stores || r.barrels) crewEvent(into, 'plunder');
    if (e.point) sound(NAVAL_CLASSIC.splashSmall, e.point, 0.6);
  }
  /** SALVAGE: a wreck's stores into `boat`'s hold as a cask's things go (no boat: the pack, a store at a time as far as it
   *  carries them), her powder to `boat`'s fire barrels up to her stock while her stern rolls them. Answers
   *  `{ stores, barrels, lost }`. */
  function stowSalvage(got, boat) {
    let stores = 0, barrels = 0, lost = 0;
    if (got.stores > 0) {
      const items = Array.from({ length: got.stores }, () => mintStores(1));   // a store a piece: the pack takes what it can carry
      const r = deps.board?.giveItems?.(items, boat ?? null) ?? { left: items };
      lost = Math.min(got.stores, Array.isArray(r.left) ? r.left.length : 0);
      stores = got.stores - lost;
    }
    if (boat && got.barrels > 0 && batteriesOf(boat.hull).some((x) => x.gun === 'barrel')) {
      const st = myBoatState(boat);
      barrels = Math.max(0, Math.min(got.barrels, BARREL.stock - st.guns.barrels));
      st.guns.barrels += barrels;
    }
    return { stores, barrels, lost };
  }

  // ── AUDIT NAV1 (online #15): the casks of another's sea ───────────────────────────────────────────────────────────
  /** A cask of another's sea my boat sailed through: gone from mine, claimed of its owner - its lot drawn on their answer. */
  function claimCask(e) {
    const raw = Number(e.id.slice(e.owner.length + 1));
    claims.set(e.id, { owner: e.owner, raw, lot: e.lot, from: e.from, deep: !!e.deep, collector: e.collector, point: [...e.point], at: clock, said: clock });   // AUDIT CAPTAIN'S SEA D8: its richness kept for the answer
    deps.sendHit?.(navalHitData(e.owner, { n: 0, cask: raw }));
  }
  /** My claims said again while they wait (a claim or its answer lost on the wire), given up past CLAIM_WAIT_S; my
   *  answers forgotten past GRANT_KEEP_S. */
  function tendClaims() {
    for (const [id, c] of claims) {
      if (clock - c.at > CLAIM_WAIT_S) claims.delete(id);   // no answer: another's haul, or its owner gone
      else if (clock - c.said >= CLAIM_AGAIN_S) { c.said = clock; deps.sendHit?.(navalHitData(c.owner, { n: 0, cask: c.raw })); }
    }
    for (const [raw, g] of granted) if (clock - g.at > GRANT_KEEP_S) granted.delete(raw);
  }
  /** A claim on a cask of mine: the first claimer's, answered and let go; the same claimer's said again, answered again. */
  function caskClaimed(from, raw) {
    const given = granted.get(raw);
    if (given) {
      if (given.to === from) deps.sendHit?.(navalHitData(from, { n: 0, cask: raw, answer: true }));
      return given.to === from;
    }
    const f = shots.floater(String(raw));
    if (!f || f.kind !== 'flotsam' || f.owner) return false;   // hauled in, sunk, or never mine to give
    shots.removeFloater(f.id);
    granted.set(raw, { to: from, at: clock });
    deps.sendHit?.(navalHitData(from, { n: 0, cask: raw, answer: true }));
    return true;
  }
  /** Their answer: the cask is mine - its lot drawn once, whatever answer comes again. */
  function caskAnswered(from, raw) {
    const id = `${from}:${raw}`;
    const c = claims.get(id);
    if (!c) return false;
    claims.delete(id);
    pickFlotsam({ lot: c.lot, from: c.from, deep: c.deep, collector: c.collector, point: c.point });
    return true;
  }
  /** A peer's word of their casks: each where they say it floats (its bob my sea's), each gone from it gone here, and
   *  none stood again that my claim waits on; one an heir says of a departed owner's is the same cask, taken over. */
  function applyCasks(owner, casks, toScene) {
    const said = new Set();
    for (const c of casks) {
      const id = `${owner}:${c.id}`;
      said.add(id);
      if (claims.has(id)) continue;
      const pos = toScene(c.pos);
      let f = shots.floater(id);
      if (!f) {
        const was = shots.floaters().find((o) => o.kind === 'flotsam' && o.owner && o.owner !== owner && o.id === `${o.owner}:${c.id}`);
        f = was ? shots.floater(was.id) : null;
        if (f) { f.id = id; f.owner = owner; f.orphanAt = null; }
      }
      if (f) { f.pos[0] = pos[0]; f.pos[2] = pos[2]; f.deep = !!c.deep; }
      else shots.dropFlotsam({ id, pos, lot: c.lot, from: c.from, owner, deep: !!c.deep });   // AUDIT CAPTAIN'S SEA D8: as rich as its owner's
    }
    for (const f of shots.floaters()) if (f.kind === 'flotsam' && f.owner === owner && !said.has(f.id)) shots.removeFloater(f.id);
  }
  /** A departed owner's casks: mine if I am their heir (taken over where they float, said in my word), else kept
   *  ORPHAN_S for the heir's word to claim. */
  function releaseCasks(owner, heir) {
    for (const o of shots.floaters()) {
      if (o.kind !== 'flotsam' || o.owner !== owner) continue;
      const f = shots.floater(o.id);
      if (heir) { f.id = o.id.slice(owner.length + 1); f.owner = null; f.orphanAt = null; }
      else f.orphanAt ??= clock;
    }
  }

  // ── the ships' lives ──────────────────────────────────────────────────────────────────────────────────────────────
  /** A ship launched: its record, its names, its build queued. */
  function launch(spec, owner = null, n = null) {
    const w = where();
    const cls = classById(spec.classId);
    if (!cls) return null;
    // AUDIT NAV1 (online): her names from the region her stander drew them in (her word's), else the waters' here -
    // a navy ship's her nearest capital's crown's (the same cutter was Wayrest's to one player and Daggerfall's to one
    // a pixel over)
    const region = Number.isInteger(spec.region) && spec.region >= 0 ? spec.region
      : cls.faction === 'navy' ? crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1).region : (w.region ?? 17);
    const crown = cls.faction === 'navy' ? crownOf(0, 0, null, region) : null;
    // ETHER-SEA: a ship of the Eltheric Ocean - launched there (the spec's band), or another's met there - its names and
    // colours the sea's own (systems/naval/etherShips.js), a legend's her own
    const legend = legendOfClass(cls.id);
    const ether = spec.ether ?? (legend || w.ether ? w.ether?.band ?? 'shallows' : null);
    const names = ether ? etherShipNames(cls, spec.seed) : shipNames(cls, spec.seed, { regionIndex: region, crown });
    const num = n ?? nextNumber();
    const id = owner ? `${owner}:${num}` : `${myId()}:${num}`;
    const ship = createSeaShip({ id, seed: spec.seed, classId: spec.classId, variant: spec.variant ?? 0, pos: spec.pos, yaw: spec.yaw ?? 0, names, owner, errand: spec.errand ?? null });
    ship.flag = ether ? etherFlagOf(cls) : flagOf(cls, spec.seed, region);   // CAPT-MARQUE: her colours - a crown's ship her crown's, a merchantman her home port's, a pirate none; ETHER-SEA: a trader the Isles'
    if (spec.deep) ship.temper = temperOf(cls, spec.seed, { bold: DEEP_BOLD });   // CAPT-WATERS: the deep waters' pirates bolder
    else if (ether && cls.faction === 'pirate') ship.temper = temperOf(cls, spec.seed, { bold: etherBold(ether) });   // ETHER-SEA: the deeper the band, the bolder its corsairs
    if (legend) ship.temper = TEMPERS.bold;   // ETHER-LEGENDS: a legend fears nothing that sails
    const entry = { id, n: num, owner, gen: Math.max(0, Math.min(NAVAL_GEN_MAX, spec.gen | 0)), region, deep: !!spec.deep, ether, legend: legend?.id ?? null, orphan: null, ship, boat: null, fires: null, fireLoop: null, sinkLoop: null, target: null, seen: clock, charged: null, ramAt: -Infinity, myBlowAt: -Infinity, grappleAt: -Infinity, hunter: !!spec.hunter, phase: random() * 6.28, lifeDt: 0, lifeN: num % FAR_LIFE_EVERY, list: null, wake: false, deck: null, prize: null, lost: false, sinkUnder: null, colours: null, fade: 0, retiring: false };   // SHIP-FADE: she comes into the world
    // ETHER-LEGENDS: she comes, said - AUDIT CAPTAIN'S SEA D12: to every captain whose sea she comes into (a party's other
    // captain stands another's copy of her, and never heard her come), once while she is in it
    const heard = legend && [...sea.values()].some((x) => x.legend === legend.id && x.ship.damage.state !== SHIP_STATES.sunk);
    sea.set(id, entry);
    if (legend && !heard) deps.mid?.(`The sea goes still. A sail on the horizon: ${legend.name}. ${legend.lore}`, 6);
    return entry;
  }
  /** ETHER-SEA: the director's word of the Eltheric Ocean - its band's row, and the legend whose haunt the captain sails
   *  when she sails now (the world's `ether.legendHere`) - or null in the Bay. */
  function etherCtx(w) {
    if (!w.ether) return null;
    const band = BANDS.find((b) => b.id === w.ether.band) ?? BANDS[0];
    const l = deps.ether?.legendHere?.(w.px, w.py, { night: !!w.night }) ?? null;
    return { band, legend: l ? { id: l.id, classId: l.classId } : null };
  }
  /** ETHER-LEGENDS: a `mends` legend afloat, no ball in her these LEGEND_MEND_QUIET_S, knits LEGEND_MEND_PER_S of her
   *  hull a second (her fires out first - the aether does not mend a burning ship). */
  function legendMend(e, d) {
    const s = e.ship;
    if (legendOfClass(s.cls.id)?.trait !== 'mends' || s.damage.state !== SHIP_STATES.afloat || s.damage.fire > 0) return;
    if (clock - s.damage.lastHitAt < LEGEND_MEND_QUIET_S || s.damage.hull >= s.damage.maxHull) return;
    s.damage.repair({ hull: s.damage.maxHull * LEGEND_MEND_PER_S * d, sail: 0, crew: 0 });
  }
  /** ETHER-SEA: a ship of the Eltheric Ocean's hold, its band's tiers richer (world/ethericSea.js BANDS `tier`). */
  const etherTier = (entry) => (entry.ether ? BANDS.find((b) => b.id === entry.ether)?.tier ?? 0 : 0);
  /** ETHER-SEA: a band's corsairs bold on this share - the Shallows' as the coast's, the Abyss's nearly all. */
  const etherBold = (band) => [0.3, 0.45, 0.6, 0.8][Math.max(0, BANDS.findIndex((b) => b.id === band))];
  /** A ship gone: its hull out of the pool, its fires out, and whoever fell on her deck with her. */
  function drop(entry) {
    douse(entry);
    entry.sinkLoop?.stop?.();   // AUDIT NAV1 (#15): her groaning gone with her
    entry.sinkLoop = null;
    for (const h of entry.deck ?? []) deps.board?.removeFoe?.(h);
    entry.deck = null;
    if (entry.boat) deps.pool.remove(entry.boat);
    sea.delete(entry.id);
  }
  /** SHIP-FADE: a ship let go by her range - she sails on and dissolves over SHIP_FADE_S, then is dropped (fadeStep). */
  function retire(entry) {
    entry.retiring = true;
  }
  /** SHIP-FADE: a ship's share in the world stepped - up to whole as she comes in, down as she retires, and dropped when
   *  she has faded away. */
  function fadeStep(entry, dt) {
    const s = entry.ship;
    if (entry.retiring && !entry.owner && ((s.damage.state === SHIP_STATES.afloat && (s.mode === 'engage' || s.mode === 'board')) || boarding?.shipId === entry.id)) entry.retiring = false;   // fired on as she faded: she stays and fights
    const k = dt / SHIP_FADE_S;
    entry.fade = entry.retiring ? Math.max(0, (entry.fade ?? 1) - k) : Math.min(1, (entry.fade ?? 1) + k);
    if (entry.boat) entry.boat.fade = entry.fade;
    if (entry.retiring && entry.fade <= 0) drop(entry);
  }
  /** A number of mine for a ship: the next not standing in my sea (sixteen bits, as the word carries it). */
  function nextNumber() {
    for (let i = 0; i < 0x10000; i++) {
      seq = (seq + 1) & 0xffff;
      if (!ownByN(seq)) return seq;
    }
    return seq;
  }
  /** AUDIT NAV1 (online #8): a ship of mine by her number - whatever id she was minted under (a ship launched while the
   *  socket was away stood as `local:n`, and a peer's blow asked for `me:n`). */
  function ownByN(n) {
    for (const e of sea.values()) if (!e.owner && e.n === n) return e;
    return null;
  }
  /** AUDIT NAV1 (online): the ship in my sea with this seed and class, other than `except` - her copy under another
   *  claim, or my own. */
  function bySeed(seed, classId, except) {
    for (const e of sea.values()) if (e.id !== except && e.ship.seed === seed && e.ship.cls.id === classId && e.ship.damage.state !== SHIP_STATES.sunk) return e;
    return null;
  }
  /** AUDIT NAV1 (online): a ship's entry under a new claim - `owner` (null: mine), her number and handover count -
   *  the same hull, fires and hurts (a boarding is never under way on her: taken over before it begins, ended before
   *  she is yielded). */
  function rekey(e, owner, n, gen) {
    sea.delete(e.id);
    e.owner = owner; e.n = n; e.gen = Math.max(0, Math.min(NAVAL_GEN_MAX, gen | 0));
    e.id = owner ? `${owner}:${n}` : `${myId()}:${n}`;
    e.ship.id = e.id; e.ship.owner = owner;
    e.lost = false; e.orphan = null; e.seen = clock;
    sea.set(e.id, e);
    return e;
  }
  /** AUDIT NAV1 (online): another's ship taken into my keeping - one past her handover count, so every client that hears
   *  her in my word, her old stander among them, knows she is mine now. Her captain sails her from where she lies. */
  function adopt(e) {
    if (!e.owner) return e;
    rekey(e, null, nextNumber(), e.gen + 1);
    e.target = null;
    // AUDIT NAV2 F7: her boarder's word said `boarded` - taken over, that boarding is over (its boarder gone, or me at
    // my own grapple), and she is anyone's to board again
    e.ship.boarded = false;
    // SHIP-LIFE: her errand never rode the word - drawn again where she is, as her stander drew it (AUDIT BAY A4: a
    // packet's her lane's)
    e.ship.errand = e.liner ? laneErrand(errandHere(e.ship)) : errandHere(e.ship);
    if (e.ship.errand?.kind === 'moored') e.fromHarbour = e.ship.errand.harbour;   // AUDIT SHIP-LIFE B5: the harbour's still - dropped past HARBOUR_LEAVE, her sailing noted
    return e;
  }
  /** AUDIT NAV1 (online): a ship of mine a stronger claim holds now - hers to sail from here, mine to draw. A boarding of
   *  her ends (another crew has her), and a raider of mine is not mine to spend. */
  function yieldTo(e, owner, n, gen) {
    if (!e.owner && boarding?.shipId === e.id) {
      const b = boarding;
      for (const f of b.foes) deps.board?.removeFoe?.(f.handle);
      b.foes = [];
      if (b.quest) { raidUids.delete(b.quest.uid); deps.board?.endRaid?.(b.quest, { withdraw: true }); }
      b.abandon?.();
      endBoarding();
      deps.say?.(`${e.ship.names?.name ?? 'It'} is taken by another crew.`, 3);
    }
    if (!e.owner) e.raider = null;
    rekey(e, owner, n, gen);
    e.ship.boarded = false;
    return e;
  }
  /** Whether I would stand the sea with `gone` out of the cell - the heir to their ships. */
  function heirOf(gone) {
    const on = deps.online;
    const id = on?.id?.();
    if (!on || !id) return true;
    return amGroupRollOwner(id, deps.feet(), (on.peers?.() ?? []).filter((p) => p.id !== gone), NAVAL_SHARE_RADIUS);
  }
  /** AUDIT NAV1 (online): an owner gone from the cell, silent, or quiet past OWNER_STALE_S - their ships are the heir's:
   *  taken over where they lie if that is me; kept ORPHAN_S for the heir's word if not; one going down finishes going
   *  down on my clock (letGo). */
  function releaseOwner(owner) {
    peerSelf.delete(owner);
    flownAt.delete(owner);
    const heir = heirOf(owner);
    const byN = new Map(), adopted = [];
    for (const e of [...sea.values()]) {
      if (e.owner !== owner || boarding?.shipId === e.id) continue;
      byN.set(e.n, e);
      const st = e.ship.damage.state;
      if (st === SHIP_STATES.sinking || st === SHIP_STATES.sunk) { letGo(e); continue; }
      if (heir) { adopt(e); adopted.push(e); } else e.orphan ??= clock;
    }
    // AUDIT NAV2 F5: a prize struck to a captain of theirs is that captain's still - her record was her stander's
    // alone, and on my clock the victor sailed off and she lay struck for good
    for (const e of adopted) {
      const victor = e.struckTo >= 0 ? byN.get(e.struckTo) : null;
      if (!e.struck && victor && !victor.owner && sea.has(victor.id) && e.ship.damage.state === SHIP_STATES.struck) e.struck = { by: victor.id, at: clock };
    }
    releaseCasks(owner, heir);
    seenVolleys.delete(owner);
  }

  /** OWN-HULL-RANGE, NAV-FAR-AI: the ships some ship in a fight targets (a fight's other half, hull or not) - a hull
   *  kept far off, and a captain who keeps every frame's watch. */
  const foughtIds = () => { const t = new Set(); for (const x of sea.values()) if (engagedOf(x.ship) && x.ship.target != null) t.add(x.ship.target); return t; };
  /** PEER-HULL-RANGE: a ship whose hull stands - within PEER_HULL_NEAR_M of the eye; OWN-HULL-RANGE: and one of my own
   *  sea's that something reads by her hull (hullKept), wherever she is. */
  const peerHullNear = (e, eye, fought) => !eye || dist2d(e.ship.pos, eye) <= PEER_HULL_NEAR_M
    || (!e.owner && hullKept(e, { fought, boardingId: boarding?.shipId ?? null }));
  /** PEER-HULL-RANGE: a ship past PEER_HULL_FAR_M of the eye gives her hull back to the pool - never one I board, nor
   *  one with bodies on her deck; OWN-HULL-RANGE: mine too, but for what hullKept keeps - and buildOne stands it again as
   *  she comes within PEER_HULL_NEAR_M. */
  function shedFarHulls(eye) {
    if (!eye) return;
    let fought = null;
    for (const e of sea.values()) {
      if (!e.boat || e.deck?.length || boarding?.shipId === e.id) continue;
      if (dist2d(e.ship.pos, eye) <= PEER_HULL_FAR_M) continue;
      if (!e.owner && hullKept(e, { fought: (fought ??= foughtIds()), boardingId: boarding?.shipId ?? null })) continue;   // OWN-HULL-RANGE
      deps.pool.remove(e.boat);
      e.boat = null;
      // AUDIT PEER-HULL-RANGE: what her record remembered of that hull goes with it (poseShip's canvas by height, the
      // colours and wake it last set), so the next one wears her record; her fires out of sight and their loops still
      // until poseShip stands them on her again; and she fades in when she is built again (SHIP-FADE), as a new ship does
      e.sailsByHeight = null; e.colours = null; e.wake = false;
      for (const f of e.fires ?? []) f.handle?.show?.(false);
      e.fireLoop?.stop?.(); e.fireLoop = null;
      e.sinkLoop?.stop?.(); e.sinkLoop = null;
      e.shed = true;
    }
  }
  /** One build a frame: the first sea ship with no hull yet (SpawnBoat is the frame's heaviest single act). */
  function buildOne() {
    if (!deps.pool?.ready?.()) return;
    const eye = deps.look?.()?.origin ?? deps.feet();
    let fought = null;
    for (const e of sea.values()) {
      if (e.boat || !peerHullNear(e, eye, (fought ??= foughtIds()))) continue;   // PEER-HULL-RANGE, OWN-HULL-RANGE
      try {
        e.boat = deps.pool.spawnSeaNow(new Boat(e.ship.hull, e.ship.variant));
        if (e.boat) {
          for (const sail of e.boat.Sails ?? []) { const a = animatorOf(sail); if (a) stowSail(a, false); }
          e.boat.IdleObject?.setActive?.(false);
          e.boat.ActiveObject?.setActive?.(true);
          e.boat.flagColor = NAVAL_FACTIONS[e.ship.cls?.faction]?.flag ?? null;   // her colours: the faction's own pennant
          e.boat.livery = liveryCode(seaLiveryOf(seaWho(e)));   // SEA-COLOURS: her own paint - the pool draws it as a peer's
          if (e.shed) { e.shed = false; e.fade = 0; }   // AUDIT PEER-HULL-RANGE: a hull given back and built again fades in
        }
      } catch (err) {
        console.warn('[naval] a ship would not build', err);
        drop(e);
      }
      return;
    }
  }

  /** Her hull and rig's spars (sparsOf), measured once a hull and rig - null while no mesh of hers is known. */
  function sparsFor(e) {
    const key = `${e.ship.hull}:${e.ship.variant | 0}`;
    let sp = spars.get(key);
    if (!sp) { sp = sparsOf(e.boat, deps.pool.models); if (sp) spars.set(key, sp); }
    return sp ?? null;
  }
  /**
   * AUDIT NAV1 (the presentation): the depth her root settles to by SINK_SECONDS - her highest drawn point at her last
   * pose (navalDamage.js sinkAngles at the end) SINK_CLEAR under the sea. Her spars measured once a hull and rig
   * (sparsOf; the Large Boat's rigs stand 6 to 9.4 m), the depth once a ship; the build's rig if her meshes are unknown.
   */
  function sinkUnder(e) {
    if (e.sinkUnder != null) return e.sinkUnder;
    const sp = sparsFor(e);
    const { roll, pitch } = sinkAngles(e.ship.seed, 1);
    const q = quatEuler(pitch, 0, roll);
    let top = -Infinity;
    for (const p of sp?.points ?? []) { const y = quatRotate(q, p)[1]; if (y > top) top = y; }
    const build = hullBuild(e.ship.hull);
    const reach = Math.max(build.top, ...build.rig.map(([, mx]) => mx[1])) + Math.max(-build.aftZ, build.bowZ) * Math.sin(Math.abs(pitch) * NAVAL_DEG);
    e.sinkUnder = (Number.isFinite(top) ? sp.lift + top : reach) + SINK_CLEAR;
    return e.sinkUnder;
  }
  /** A ship's hull stood where its record says - root, bob and heel, the sinking's list, trim and settle - and its
   *  rigging alive. */
  function poseShip(e, dt, seaY, eye = null) {
    const b = e.boat;
    if (!b) return;
    const s = e.ship;
    const w = wind();
    const wl = Math.hypot(w[0], w[2]);
    const state = s.damage.state;
    const sinkK = state === SHIP_STATES.sinking ? clamp(s.damage.sinkT / SINK_SECONDS, 0, 1) : state === SHIP_STATES.sunk ? 1 : 0;
    const sink = sinkAngles(s.seed, sinkK);
    const depth = sinkK > 0 ? sinkDepth(sinkUnder(e), sinkK) : 0;
    const pos = s.pos;
    const yaw = s.yaw;
    const seen = (e.fade ?? 1) >= FADE_FLATS;   // AUDIT BAY A14: half faded out of the world, her fire, smoke and founder go with her flats
    b.GameObject.position = [pos[0], seaY - depth, pos[2]];
    b.GameObject.rotation = quatOfYaw(yaw);
    const t = clock + e.phase;
    // AUDIT NAV1 (the presentation, #15): her list by her hurt, to her going-down side, taken on as she fills (her first
    // pose at it) - the sinking's own list over it
    const hull = s.damage.hullShare();
    const want = DAMAGE_LIST_MAX * clamp((DAMAGE_LIST_FROM - hull) / DAMAGE_LIST_FROM, 0, 1);
    e.list = e.list == null ? want : e.list + (want - e.list) * (1 - Math.exp(-dt / DAMAGE_LIST_EASE_S));
    const listed = Math.sign(sinkAngles(s.seed, 1).roll) * Math.max(Math.abs(sink.roll), e.list);
    const roll = s.heel + Math.sin(t * 0.5 * wl) * wl * 0.9 + listed;
    const pitch = Math.sin(t * wl) * wl * 0.5 + sink.pitch;
    if (b.MeshObject) b.MeshObject.localRotation = quatEuler(pitch, 0, roll);
    // the sails: set while she fights or runs, stowed struck, taken or going down. AUDIT NAV1 (#15): her canvas shown by
    // her sail share, her highest sails gone first - AUDIT GN2-RG4: by where each canvas hangs (canvasHeight)
    const set = state === SHIP_STATES.afloat && s.sails > 0.5;
    const sails = e.sailsByHeight ??= (b.Sails ?? []).map((n) => [n, canvasHeight(n)]).sort((p, q) => q[1] - p[1]).map(([n]) => n);
    const shown = s.damage.maxSail > 0 ? sailsShown(sails.length, s.damage.sailShare()) : sails.length;
    sails.forEach((sail, i) => { const on = i >= sails.length - shown; if (sail.activeSelf !== on) sail.setActive(on); });
    for (const sail of b.Sails ?? []) {
      const a = animatorOf(sail);
      if (!a) continue;
      if (a.GetBool('Stowed') === set) stowSail(a, !set);
      a.SetFloat('Wind', set ? sailSide(b, sail, w) * Math.min(1, wl) : 0);   // AUDIT GN2-RG6: blown to her lee side
    }
    // AUDIT NAV1 (the presentation): HER COLOURS BY HER STATE - her faction's while she sails and fights, struck with her
    // (the flag's emitter stops: they come down), the captor's once she is taken (the player's boats' own orange -
    // FlagMaterial's), and gone down with her (a flag flown on from a masthead under the sea showed through it); she
    // had flown her faction's whatever she was
    // SPYGLASS: a pirate under false colours flies a merchantman's pennant till she runs up the black flag
    const colours = state === SHIP_STATES.afloat ? (falseFlagFor(e) && !e.blackFlag ? 'false' : 'hers') : state === SHIP_STATES.prize ? 'taken' : 'struck';
    if (b.FlagEmitter && e.colours !== colours) {
      e.colours = colours;
      if (colours === 'struck') b.FlagEmitter.stop?.();
      else {
        b.flagColor = colours === 'hers' ? NAVAL_FACTIONS[s.cls?.faction]?.flag ?? null : colours === 'false' ? NAVAL_FACTIONS.merchant.flag : null;
        if (!b.FlagEmitter.isEmitting) b.FlagEmitter.play?.();
      }
    }
    if (b.FlagObject) {
      const v = velocityOf(s);
      const f = [w[0] - v[0] * 0.1, 0, w[2] - v[2] * 0.1];
      const fl = Math.hypot(f[0], f[2]);
      if (fl > 1e-4) {
        b.FlagObject.rotation = quatLookRotation([f[0] / fl, 0, f[2] / fl]);
        if (b.FlagEmitterMain) b.FlagEmitterMain.startSpeed = constantCurve(fl * 0.5);
      }
    }
    if (b.WakeEmitter) {
      const moving = s.speed > 0.5 && state === SHIP_STATES.afloat;
      if (moving && !e.wake) { b.WakeEmitter.play(); e.wake = true; } else if (!moving && e.wake) { b.WakeEmitter.stop(); e.wake = false; }
      if (b.WakeEmitterMain) { b.WakeEmitterMain.startLifetimeMultiplier = clamp(s.speed * 0.2 * 2, 1, 10); b.WakeEmitterMain.startSize = constantCurve(s.speed * 0.1); }
    }
    // SHIP-WATCH: her lanterns at the lights' hour - but a pirate prowls dark, and a merchantman running douses hers
    const lit = shipLit(e);
    if (b.LightOn !== lit && (b.Lights?.length ?? 0) > 0) setLights(b, lit);
    // AUDIT NAV1 (the presentation, #17): her animators found once, as her particle systems are (her whole tree was
    // walked for them every frame: 0.44 ms of a far galley's, for her three); past NEAR_LIFE_M both step every
    // FAR_LIFE_EVERY frames, with the time they missed - each ship on her own frame of the stride (her number's).
    // BOAT-FAR: the law read from scenes/comeSailAway/farLife.js, the one the pool and the peers' boats read
    const lived = farLifeStep(e, dt, s.pos, eye);
    if (lived !== null) {
      for (const a of (b.animators ??= boatAnimators(b))) a.update(lived);
      for (const ps of (b.particleSystems ??= boatParticleSystems(b))) ps.step(lived);
    }
    // her fires follow her deck as she heels, lists and trims; the burn breathes embers and smoke. AUDIT NAV1 (the
    // presentation): she burns on as she goes down, each fire out as the sea reaches its place on her (FLAME_AWASH) -
    // not all doused the moment she was holed, nor a scuttled hull's flames burning on under the sea
    if (e.fires) {
      const build = hullBuild(s.hull);
      const len = (build.beam || 4) * 1.6;
      const mo = b.MeshObject;   // every built hull has one (spawnBoat throws without her collider's node)
      const lp = mo.localPosition;
      let burning = 0;
      for (const fire of e.fires) {
        if (fire.out) continue;
        const p = mo.transformPoint([-lp[0], build.deck + 1 - lp[1], fire.at * len - lp[2]]);
        if (p[1] < seaY + FLAME_AWASH) { fire.handle?.retire?.(); fire.handle = null; fire.out = true; continue; }
        fire.handle?.move?.(p);
        fire.handle?.show?.(seen);   // AUDIT BAY A14: a flat - gone with her flats as she fades, up again as she comes back
        if (seen) effects.burn(p, dt);
        burning++;
      }
      if (burning) {
        e.fireLoop ??= deps.audio?.loop3d?.(NAVAL_CLASSIC.burning, pos, 0.7, NAVAL_FIRE_LOOP) ?? null;
        e.fireLoop?.move?.(pos);
      } else if (e.fireLoop) { e.fireLoop.stop?.(); e.fireLoop = null; }
      if (s.damage.fire <= 0 || state === SHIP_STATES.sunk) douse(e);
    }
    if (state === SHIP_STATES.sinking && seen) effects.founder([pos[0], seaY, pos[2]], dt, hullBuild(s.hull).beam);
    // AUDIT NAV1 (#15): she groans as she goes down - the loop from her founder until she is gone (a gurgle at the start
    // was all, then silence for the rest of her going); a peer's too, on the same pose
    if (state === SHIP_STATES.sinking) { e.sinkLoop ??= deps.audio?.loop3d?.(NAVAL_SFX.sinking, pos, 0.85, NAVAL_SINK_LOOP) ?? null; e.sinkLoop?.move?.(pos); }
    else if (e.sinkLoop) { e.sinkLoop.stop?.(); e.sinkLoop = null; }
    // AUDIT NAV1 (#15): a battered hull smokes along her deck as she lies, from the part the sea has not reached
    const smokeK = clamp((SMOKE_FROM - hull) / SMOKE_FROM, 0, 1);
    if (smokeK > 0 && seen) {
      const build = hullBuild(s.hull), mo = b.MeshObject, lp = mo.localPosition, y = build.deck + 0.5 - lp[1];
      const deck = lineOver(mo.transformPoint([-lp[0], y, build.aftZ * SMOKE_SPAN - lp[2]]), mo.transformPoint([-lp[0], y, build.bowZ * SMOKE_SPAN - lp[2]]), seaY + FLAME_AWASH);
      if (deck) effects.smolder(deck[0], deck[1], dt, smokeK);
    }
  }

  // ── the sea's share (NAV-G): who stands it ────────────────────────────────────────────────────────────────────────
  /**
   * AUDIT NAV1 (online #15): the traffic a shared sea is sailed at - the lowest Ships at sea among the players who share
   * it, each by their own word (a word without it, or none, TRAFFIC_DEFAULT). The stander's alone sailed everyone's.
   */
  function trafficDensity(feet) {
    const of = (key) => DENSITY[key] ?? DENSITY[TRAFFIC_DEFAULT];
    let d = of(setting('ShipsAtSea', TRAFFIC_DEFAULT));
    for (const p of deps.online?.peers?.() ?? []) {
      if (p.feet && dist2d(p.feet, feet) <= NAVAL_SHARE_RADIUS) d = Math.min(d, of(peerSelf.get(p.id)?.traffic ?? TRAFFIC_DEFAULT));
    }
    return d;
  }
  /** SEA-TRAFFIC (Mac: "players arent seeing boats"): whether I launch the sea's traffic - the lowest id among the players
   *  ON THE WATER near me (the share's greedy election, its hysteresis), for only a player on it launches any. Among every
   *  player near, a lower id ashore in the port town was elected and launched nothing, and the one sailing out met an
   *  empty sea. */
  let launching = true;
  function launchesTraffic() {
    const on = deps.online;
    const id = on?.id?.();
    if (!on || !id) return true;
    const afloat = (on.peers?.() ?? []).filter((p) => Array.isArray(p.feet) && deps.isWater(p.feet[0], p.feet[2], 0));
    launching = amGroupRollOwner(id, deps.feet(), afloat, launching ? NAVAL_SHARE_RADIUS : NAVAL_SHARE_RADIUS * SHARE_HYSTERESIS);
    return launching;
  }
  /** AUDIT SHIP-LIFE B4: whether I roll a harbour's moored ships - the lowest id among the players within HARBOUR_STAND
   *  of its mouth (the election over the players near me barred a player in the port for one too far off to roll). */
  function rollsHarbour(mouth) {
    const on = deps.online;
    const id = on?.id?.();
    if (!on || !id) return (standing = true);
    const near = (on.peers?.() ?? []).filter((p) => Array.isArray(p.feet) && Math.hypot(p.feet[0] - mouth[0], p.feet[2] - mouth[1]) <= HARBOUR_STAND);
    standing = amGroupRollOwner(id, deps.feet(), near, HARBOUR_STAND * 2);
    return standing;
  }

  // ── SEA-LANES: the Bay's packets, stood as ships (systems/naval/seaLanes.js) ──────────────────────────────────────
  /** A packet of mine busy at sea - fighting, running, or alongside a prize (her captain's 'board' while lashed): never
   *  let go of while she is. AUDIT BAY A2: one no longer afloat - struck (boarded, taken), going down - is her lane's
   *  no more (spendLiner): the sea's own law lets her hulk go out of sight, as any ship's (the lane kept a struck one,
   *  and the director counted her its, for good). */
  const linerKept = (e) => e.ship.mode === 'engage' || e.ship.mode === 'board' || e.ship.mode === 'flee';
  /** A packet her lane steers: afloat and about no fight - a crown's answering the guns sails for them. */
  const linerFree = (e) => e.ship.damage.state === SHIP_STATES.afloat && e.ship.mode === 'cruise';
  /** AUDIT BAY A18: the voyages spent - a packet no longer afloat (sunk, struck, boarded, taken), by her voyage's
   *  seed - none stood again till her lane's next; every player's who sees her go (mine or another's), and said in each
   *  word, the last NAVAL_WIRE_SPENT of them (a player who never saw her go stood her afresh where she went down). */
  const spentLiners = new Set();
  let spentSaid = [];
  const noteSpent = (sd) => { if (!spentLiners.has(sd)) { spentLiners.add(sd); spentSaid = [...spentSaid, sd].slice(-NAVAL_WIRE_SPENT); } };
  function spendLiner(e) {
    noteSpent(e.liner.seed >>> 0);
    e.liner = null;   // her lane's no more: never afloat again, she is no voyage's packet (liners)
  }
  /** A packet let go of her lane (her lineage past, her voyage spent by another's word): mine keeps the sea as any ship
   *  does (SHIP-LIFE's errand where she is - moored, she lies her own dwell out), a peer's is read as theirs. */
  function releaseLiner(e) {
    e.liner = null;
    if (e.owner || !linerFree(e)) return;
    const s = e.ship;
    s.course = null;
    if (s.errand?.kind === 'moored') s.errand.until = s.clock + dwellOf(errandRng(s.seed));
    else if (!s.errand || s.errand.kind === 'lurk') s.errand = errandHere(s);
  }
  /** AUDIT BAY A4: a peer within `range` of a ship - one who stands her in my place. */
  const peerNear = (pos, range) => (deps.online?.peers?.() ?? []).some((p) => Array.isArray(p.feet) && dist2d(p.feet, pos) <= range);
  /** A peer's feet, where their word puts them, or null. */
  const peerFeet = (id) => { const p = (deps.online?.peers?.() ?? []).find((q) => q.id === id); return Array.isArray(p?.feet) ? p.feet : null; };
  /** Where her clock has her bound, or lying: the port her clock's leg ends at. */
  const clockDest = (l) => (l.phase === 'dwell' ? l.port : l.to) ?? null;
  /** A packet's tag: who she is on her lane (her voyage's id and seed) and where her clock has her - her phase, her
   *  ports, her leg as the list said it - and, kept from tag to tag, her OWN leg (`way`) and the port it ends at
   *  (`dest`): AUDIT BAY A22, the leg she sails is hers till she has sailed it. */
  const linerTag = (l, was = null) => ({ id: l.id, seed: l.seed >>> 0, phase: l.phase, to: l.to ?? null, from: l.from ?? null, port: l.port ?? null,
    leg: l.leg ?? null, way: was?.way ?? l.leg ?? null, dest: was?.dest ?? clockDest(l) });
  /** AUDIT BAY A4/A22: the leg a packet I did not stand is first known on - her clock's; or, met under way heading back
   *  along it, the leg before it (her clock's reversed, for the port it left): behind her clock by a leg, she sails that
   *  one yet (taken over, she came about for her clock's port short of her own). Fighting, lying at a berth, or off her
   *  clock's port, where she heads says nothing: her clock's. (Off the port it left, heading for it, she has made it,
   *  and her clock sails her on at once: moveOn.) */
  function firstWay(l, s) {
    const leg = l.leg, clock = { way: leg ?? null, dest: clockDest(l) };
    if (!leg?.length || s.mode !== 'cruise' || berthOf(s)) return clock;
    const p = pursue(leg, s.pos[0], s.pos[2], 0), q = pursue(leg, s.pos[0], s.pos[2], LINER_LOOKAHEAD_M);
    if (p.left <= LINER_PORT_M || (q.x - p.x) * Math.sin(s.yaw) + (q.z - p.z) * Math.cos(s.yaw) >= 0) return clock;
    return { way: [...leg].reverse(), dest: l.from ?? null };
  }
  /** AUDIT BAY A4/A22: whether a packet has made her own leg's port - mine by her errand there (into a berth of it,
   *  moored at it, lying off it), another's by where she lies (at a berth of it: her errand never rides the word), any
   *  by her leg sailed to within LINER_PORT_M of its end along it (a leg come back by its end across a headland is no
   *  arrival). */
  function madePort(e) {
    const s = e.ship, l = e.liner, k = l.dest?.key, r = e.owner ? null : s.errand;
    if (k && (e.owner ? berthOf(s)?.key === k : (r?.kind === 'arrive' || r?.kind === 'moored') && r.harbour === k)) return true;
    return r?.kind === 'lurk' || (pursue(l.way, s.pos[0], s.pos[2], 0)?.left ?? 0) <= LINER_PORT_M;
  }
  /** AUDIT BAY A22: a packet at her own leg's port where her clock has her bound elsewhere takes up her clock's leg -
   *  mine and another's alike (a peer's copy kept the leg she was first known on for good: taken over, she sailed it
   *  again from wherever she was). */
  function moveOn(e) {
    const l = e.liner, target = clockDest(l);
    if (linerFree(e) && l.leg?.length && target && target.key !== l.dest?.key && madePort(e)) { l.way = l.leg; l.dest = target; }
  }
  /** AUDIT BAY A4: a ship of mine her lane takes up (taken over, or met in it again) - her errand her lane's from here
   *  (steerLiner): lying at a berth or on her way out of a harbour she keeps to it, else none (SHIP-LIFE's own, drawn
   *  where she lay, sent a packet mid-lane for the nearest harbour's berth - the port behind her, by a way of its own). */
  const laneErrand = (r) => (r?.kind === 'moored' || r?.kind === 'depart' ? r : null);
  /** AUDIT BAY A7: the berth a packet takes - a harbour's LAST free one (the harbour's own ships are stood at its
   *  first: a packet at the first was a berth of the day's own ship, never stood). */
  function openBerth(h) {
    for (let i = h.harbour.berths.length - 1; i >= 0; i--) if (berthFree(h.key, i)) return i;
    return -1;
  }
  /**
   * SEA-LANES: the packets of the lanes about the player, where the shared clock puts them (the world host's feed):
   * `list` `[{ id, seed, seeds, classId, region, phase, pos, yaw, leg, port, to, from }]` in the scene - `leg` her leg's
   * points `[[x, z], ...]`, `port`, `to` and `from` `{ key, name }`; her phase on the clock is what sails her (AUDIT
   * BAY A6). AUDIT BAY A3/A9/A17: each ship in my sea is known by her seeds - one taken over, a peer's copy, one
   * sailing on into her next voyage - mine steered by her lane, a peer's read on her tag; each followed along her own
   * leg (A22: firstWay, moveOn), and one of mine her lane takes up keeps her lane's errand (A4). Mine stand and go - a
   * packet under way within LINER_STAND_M (LINERS_MAX of them by the Ships at sea), one lying in a harbour I know at
   * its last open berth; past LINER_DROP_M she sails on and fades (SHIP-FADE) unless she fights - held ORPHAN_S for a
   * player within LINER_DROP_M of her, who takes her over where she lies (AUDIT BAY A4: she faded out of their sea and
   * was stood in it again) - and each steers her lane (steerLiner).
   */
  function liners(list) {
    if (!enabled) return;
    const me = deps.feet();
    const density = trafficDensity(me);   // AUDIT BAY A5: every player stands their own (the launcher's alone left a packet by another unstood)
    const bySeed = new Map();
    for (const l of list) for (const sd of l.seeds ?? [l.seed]) bySeed.set(sd >>> 0, l);
    // who each ship in my sea is
    for (const e of [...sea.values()]) {
      const s = e.ship;
      if (e.liner && s.damage.state !== SHIP_STATES.afloat) { spendLiner(e); continue; }
      const l = bySeed.get(s.seed >>> 0) ?? null;
      if (l && !spentLiners.has(l.seed >>> 0) && s.damage.state === SHIP_STATES.afloat) {
        if (!e.liner && !e.owner) s.errand = laneErrand(s.errand);
        e.liner = linerTag(l, e.liner ?? firstWay(l, s));
        moveOn(e);
      } else if (e.liner) releaseLiner(e);
    }
    // AUDIT BAY A4: a peer's packet they let go of (sailed off past their LINER_DROP_M of her, or out of their word)
    // within mine - taken over where she lies
    if (density > 0) for (const e of [...sea.values()]) {
      if (!e.owner || !e.liner || !linerFree(e) || dist2d(e.ship.pos, me) > LINER_DROP_M) continue;
      const feet = peerFeet(e.owner);
      if (!e.retiring && !(feet && dist2d(feet, e.ship.pos) > LINER_DROP_M)) continue;
      adopt(e);   // her tag hers still: her lane steers her (steerLiner) as mine from here
      e.retiring = false;
    }
    // mine let go past LINER_DROP_M - she sails on and fades (SHIP-FADE) - unless she fights, or a player near her takes her
    for (const e of sea.values()) {
      if (e.owner || !e.liner) continue;
      if (dist2d(e.ship.pos, me) <= LINER_DROP_M) { e.handOn = null; e.retiring = false; continue; }   // back as she faded: she stays
      if (linerKept(e) || e.retiring) continue;
      if (peerNear(e.ship.pos, LINER_DROP_M) && clock - (e.handOn ??= clock) < ORPHAN_S) continue;   // AUDIT BAY A4: held for their claim
      retire(e);
    }
    const max = LINERS_MAX[density] ?? Math.min(3, density);
    let under = [...sea.values()].filter((e) => !e.owner && e.liner && !e.retiring && e.ship.errand?.kind !== 'moored').length;
    for (const l of [...list].sort((a, b) => dist2d(a.pos, me) - dist2d(b.pos, me))) {
      const seed = l.seed >>> 0;
      if (!(density > 0) || dist2d(l.pos, me) > LINER_STAND_M || spentLiners.has(seed)) continue;
      // her voyage's ship anywhere in my sea (mine or a peer's copy, whatever her state), or her place's of an earlier
      // voyage afloat and sailing on as hers (AUDIT BAY A17)
      const seeds = new Set((l.seeds ?? [l.seed]).map((x) => x >>> 0));
      if ([...sea.values()].some((x) => x.ship.damage.state !== SHIP_STATES.sunk && (x.ship.seed === seed || (seeds.has(x.ship.seed) && x.ship.damage.state === SHIP_STATES.afloat)))) continue;
      const cls = classById(l.classId);
      if (!cls) continue;
      // lying at a port whose harbour I know: at its last open berth, as the harbour's own ships are stood at its first
      const h = l.phase === 'dwell' && l.port ? harbours.get(l.port.key) : null;
      const berth = h?.harbour && cls.hull !== HULL.LargeGalley ? openBerth(h) : -1;
      let e = null;
      if (berth >= 0) {
        const b = h.harbour.berths[berth], at = alongside(b, cls.hull, h.harbour.hull);   // QUAYS: alongside its quay
        e = launch({ seed, classId: cls.id, region: l.region, pos: [at[0], deps.seaY(), at[1]], yaw: b.yaw, errand: { kind: 'moored', harbour: h.key, berth, until: Infinity, path: null, i: 0 } });
        if (e) { e.ship.sails = 0; e.ship.sailsWant = 0; }
      } else {
        if (l.phase !== 'sail' || under >= max) continue;
        if (!deps.isWater(l.pos[0], l.pos[2], cls.hull)) continue;   // her place not yet water deep enough for her hull here
        e = launch({ seed, classId: cls.id, region: l.region, pos: [l.pos[0], deps.seaY(), l.pos[2]], yaw: l.yaw });   // AUDIT BAY A8: named by her lane's port, wherever she is met
        if (e) under++;
      }
      if (e) e.liner = linerTag(l);
    }
    for (const e of sea.values()) if (!e.owner && e.liner) steerLiner(e);
  }
  /**
   * SEA-LANES: a packet of mine steered by her lane (liners) - none while she fights. AUDIT BAY A6: under way, along
   * her leg from where she is (seaLanes.js pursue, LINER_LOOKAHEAD_M on) - out of any berth through its harbour's mouth
   * first; within LINER_PORT_M of her leg's end she is at her port - into its last open berth where I know the harbour,
   * moored till the clock sails her on (come early, she waits for it), else lying off it. AUDIT BAY A22: the leg she
   * sails is her own (`way`, to `dest`) till she has sailed it - the clock's turned under a packet behind it, and she
   * came about for home short of her port; at her port, where her clock has her bound elsewhere she sails at once
   * (moveOn: her dwell cut short by her lateness), where it has her there she waits for it.
   */
  function steerLiner(e) {
    const s = e.ship, l = e.liner;
    if (!linerFree(e) || !l.leg?.length) return;
    const r = s.errand;
    const h = l.dest ? harbours.get(l.dest.key) ?? null : null;   // the harbour of the port she makes for, or lies at
    if (r && (r.kind === 'arrive' || r.kind === 'moored')) {
      s.course = null;
      if (h && r.harbour === h.key) { if (r.kind === 'moored') r.until = Infinity; return; }   // in her port: the clock sails her
      s.errand = { kind: 'depart', harbour: r.harbour, berth: r.kind === 'moored' ? r.berth : -1, path: null, i: 0 };   // under way: out through its mouth first
      return;
    }
    if (r?.kind === 'depart') { s.course = null; return; }
    const p = pursue(l.way, s.pos[0], s.pos[2], LINER_LOOKAHEAD_M);
    const end = l.way[l.way.length - 1];
    if (p.left > LINER_PORT_M) { s.errand = null; s.course = [p.x, p.z]; return; }   // her way's own remainder: a leg come back by its end across a headland is no arrival
    // at her port: into a berth of it, else lying off it on her ring
    s.course = null;
    const berth = h?.harbour && s.hull !== HULL.LargeGalley ? openBerth(h) : -1;
    if (berth >= 0) { s.errand = { kind: 'arrive', harbour: h.key, berth, path: null, i: 0 }; return; }
    if (r?.kind !== 'lurk') s.errand = { kind: 'lurk', harbour: null, at: [end[0], end[1]], path: null, i: 0, spin: (s.seed % 1000) / 1000 };
  }

  // SEA-EVENTS (scenes/naval/treasureFleet.js): the treasure fleet's sailing about the captain - stood, steered, let go, its
  // flagship's spoils
  const treasureFleet = createTreasureFleet({
    sea, launch: (spec) => (enabled ? launch(spec) : null), retire: (e) => retire(e), busy: (e) => raiderBusy(e), feet: () => deps.feet(),
    isWater: (x, z, hull) => deps.isWater(x, z, hull), seaY: () => deps.seaY(), launches: () => launchesTraffic(),
    give: (items) => deps.board?.giveItems?.(items, boatInPlay() ?? null, { force: true }), say: (text, n) => deps.say?.(text, n),
    fleetEnded: (n, act) => deps.ether?.fleetEnded?.(n, act),
  });
  // ── SHIP-PVP: the open sea's guns between captains - their seams (scenes/naval/navalPvp.js) over the ships stood here ──
  const pvp = createNavalPvp({
    enabled: () => enabled, boat: () => boatInPlay(), stateOf: (b) => myBoatState(b), build: (b) => refitBuild(b), pose: (b) => boatPose(b),
    boats: () => csa()?.state?.AllBoats ?? [], peers: () => deps.peerBoats?.() ?? [], clock: () => clock, shake: (k) => deps.shake?.(k),
  });

  // ── NAV-R: Warm Ashes' raiders, stood as ships (systems/naval/navalRaiders.js) ─────────────────────────────────────
  /** A raider of mine busy at sea - fighting, running, boarded or going down: never let go of while it is. */
  const raiderBusy = (e) => e.ship.mode === 'engage' || e.ship.mode === 'board' || e.ship.mode === 'flee' || e.ship.boarded || boarding?.shipId === e.id
    || e.ship.damage.state === SHIP_STATES.sinking;
  /**
   * The raiders about the player, where they sail now (the world host's, off seaRaiders.js - the shared clock's):
   * `list` [{ id, seed, pos, yaw, ahead }] in the scene (`ahead` where the seeded course is RAIDER_LEAD_S on); `sight`
   * the lookout's reach tonight or today; `spent` the raiders spent this life; `held` the raiders a peer's word holds
   * (OW6's raider word: raider id -> the peer's id). Mine stand and go by raiderPlan; each steers its seeded course and
   * looks out, until it is spent.
   */
  function raiders(list, { sight = null, spent = new Set(), held = new Map() } = {}) {
    if (!enabled) return;
    const me = deps.feet();
    // AUDIT BAY A4: a raider a peer lets go of (sailed off past their RAIDER_DROP_M of her, or out of their word)
    // within mine - taken over where she lies (she faded out of my sea, and the plan stood her in it again)
    for (const e of [...sea.values()]) {
      if (!e.owner || e.ship.cls.faction !== 'pirate' || e.ship.damage.state !== SHIP_STATES.afloat || raiderBusy(e) || dist2d(e.ship.pos, me) > RAIDER_DROP_M) continue;
      const r = list.find((x) => (x.seed >>> 0) === e.ship.seed);
      if (!r || spent.has(r.id) || held.has(r.id)) continue;
      const feet = peerFeet(e.owner);
      if (!e.retiring && !(feet && dist2d(feet, e.ship.pos) > RAIDER_DROP_M)) continue;
      adopt(e);
      e.retiring = false;
    }
    const stood = new Map(), peers = new Map();
    for (const e of sea.values()) {
      // AUDIT NAV1 (online): a raider taken over from another (her stander gone, or grappled by me) is known by her seed
      if (!e.owner && !e.raider && e.ship.cls.faction === 'pirate') { const r = list.find((x) => (x.seed >>> 0) === e.ship.seed); if (r) { e.raider = { id: r.id, chased: false, spent: spent.has(r.id) }; e.ship.temper = TEMPERS.bold; } }   // SEA-PEACE: a raider is bold
      if (!e.owner && e.raider) stood.set(e.raider.id, { pos: e.ship.pos, engaged: raiderBusy(e), boarding: boarding?.shipId === e.id });
      else if (e.owner && e.ship.cls.faction === 'pirate') peers.set(e.ship.seed, e.owner);
    }
    const plan = raiderPlan({ raiders: list, me, myId: myId(), stood, peers, spent, held });
    for (const id of plan.drop) {
      const e = raiderEntry(id);
      if (!e) continue;
      if (held.has(id)) { drop(e); continue; }   // yielded into a peer's copy of her - that copy stands where she does
      if (!e.retiring && peerNear(e.ship.pos, RAIDER_DROP_M) && clock - (e.handOn ??= clock) < ORPHAN_S) continue;   // AUDIT BAY A4: held for the claim of a player near her
      retire(e);   // SHIP-FADE: she sails on out of sight
    }
    for (const e of sea.values()) if (!e.owner && e.raider && !plan.drop.includes(e.raider.id)) { e.handOn = null; e.retiring = false; }   // SHIP-FADE: back in range as she faded - she stays
    // ETHER-OW (2026-10-13): past the Veil the raiders are born on the Eltheric Ocean too (world.js tvRaidOpen), and a
    // ship launched there is the sea's own (launch: its names, its colours, no crown's law) - her class drawn the band's
    // levels over the captain's own, as every class the director draws there is (navalDirector.js ctx.ether)
    const w = where();
    const level = (deps.level?.() ?? 1) + (w.ether ? BANDS.find((b) => b.id === w.ether.band)?.level ?? 0 : 0);
    for (const id of plan.stand) {
      const r = list.find((x) => x.id === id);
      const cls = raiderClassOf(r.seed, level);
      if (!deps.isWater(r.pos[0], r.pos[2], cls.hull)) continue;   // a sail not yet on water deep enough for her hull
      const e = launch({ seed: r.seed, classId: cls.id, pos: [r.pos[0], deps.seaY(), r.pos[2]], yaw: r.yaw });
      if (e) { e.raider = { id, chased: false, spent: false }; e.ship.temper = TEMPERS.bold; }   // SEA-PEACE: Warm Ashes' raiders come to raid - never wary
    }
    for (const e of sea.values()) {
      if (e.owner || !e.raider || e.raider.spent) continue;
      const r = list.find((x) => x.id === e.raider.id);
      e.ship.sight = sight;
      e.ship.course = r?.ahead ? [r.ahead[0], r.ahead[2]] : null;   // its life over, it sails on for a waypoint of its own
    }
  }
  const raiderEntry = (raiderId) => [...sea.values()].find((e) => !e.owner && e.raider?.id === raiderId) ?? null;
  /** A raider spent for its life: said to the world host once; one given the slip sheers off and looks for no one. */
  function spendRaider(e, sheer) {
    e.raider.spent = true;
    deps.raiderSpent?.(e.raider.id);
    if (sheer) sheerOff(e);
  }
  /** A ship sent on her way, straight away from me RAIDER_SHEER_M: a raider on a course of her own (her seeded one no
   *  longer refreshed once she is spent) looking for no one, any other on a waypoint there (navalAI.js cruiseCourse -
   *  reached, she goes on about her own business). */
  function sheerOff(e) {
    const me = deps.feet();
    const dx = e.ship.pos[0] - me[0], dz = e.ship.pos[2] - me[2], d = Math.hypot(dx, dz) || 1;
    const p = [e.ship.pos[0] + (dx / d) * RAIDER_SHEER_M, e.ship.pos[2] + (dz / d) * RAIDER_SHEER_M];
    if (e.raider) { e.ship.sight = 0; e.ship.course = p; } else e.ship.waypoint = p;
  }
  /** The ship a raider of this seed sails as - mine or a peer's copy - for the Overworld's mark: where, and whether it
   *  chases me. Null: none stands. */
  function raiderShipOf(seed) {
    for (const e of sea.values()) {
      if (e.ship.seed !== (seed >>> 0) || e.ship.cls.faction !== 'pirate' || (!e.owner && !e.raider)) continue;
      return { pos: e.ship.pos, chase: chasesMe(e) };
    }
    return null;
  }
  /** THE MERGE (OW6): the raiders my sea stands and has not spent - `[{ id, pos }]`, where each sails (scene) - for the
   *  Overworld's raider word (scenes/world.js seaRaidHeld), so a peer's client holds off a raider I hold, with the sea
   *  fight or without it. */
  function raiderHeld() {
    const out = [];
    for (const e of sea.values()) if (!e.owner && e.raider && !e.raider.spent) out.push({ id: e.raider.id, pos: e.ship.pos });
    return out;
  }

  /** SHIP-WATCH: what a ship's hurts leave her crew to mend (0..1): her hull's loss, and half her canvas's. */
  const workOf = (damage) => Math.min(1, Math.max(0, (1 - damage.hullShare()) + (1 - damage.sailShare()) * 0.5));
  /** SHIP-WATCH: whether a sea ship shows her lanterns now - the lights' hour, unless she runs dark (shipWatch.js). */
  function shipLit(e) {
    return !!where().cityLights && carriesLanterns(e.boat, e.ship.hull) && !runsDark({ faction: e.ship.cls.faction, mode: e.ship.mode, afloat: e.ship.damage.state === SHIP_STATES.afloat });
  }
  /** AUDIT WK-N4: whether a boat carries lanterns to be lit by - a built one by her own (Come Sail Away's carrack prefab
   *  has none, so she was seen as a lit ship while she sailed black), one not yet built by her hull's (SHIPS-2: Mac's
   *  carrack carries seven - the mod's own, standing in for her, none). */
  const carriesLanterns = (boat, hull) => (boat ? (boat.Lights?.length ?? 0) > 0 : !(hull === HULL.Carrack && hullBuild(hull) === MOD_BUILDS[HULL.Carrack]));
  // ── contacts the captains see ────────────────────────────────────────────────────────────────────────────────────
  // SHIP-WATCH: each with whether she shows a light (`lit`) - by night a captain sees a lit one far, a dark one close
  function contacts() {
    const out = [];
    for (const e of sea.values()) {
      const st = e.ship.damage.state;
      if (st === SHIP_STATES.afloat) out.push({ id: e.id, kind: 'ship', faction: e.ship.cls.faction, pos: e.ship.pos, vel: velocityOf(e.ship), speed: e.ship.speed, yaw: e.ship.yaw, hull: e.ship.hull, ship: e.ship, lit: shipLit(e) });
      // SEA-PEACE: a ship of mine that struck to a captain of mine, not yet taken nor boarded by me - her prize to board
      else if (st === SHIP_STATES.struck && !e.owner && e.struck && sea.has(e.struck.by) && !e.takenBy && boarding?.shipId !== e.id) {
        out.push({ id: e.id, kind: 'ship', faction: e.ship.cls.faction, pos: e.ship.pos, vel: velocityOf(e.ship), speed: e.ship.speed, yaw: e.ship.yaw, hull: e.ship.hull, ship: e.ship, struck: true, struckTo: e.struck.by, lit: shipLit(e) });
      }
    }
    const boat = boatInPlay();
    if (boat) {
      const st = myBoatState(boat);
      const pose = boatPose(boat);
      out.push({
        id: myId(), kind: 'player', pos: pose.position, vel: pose.velocity, speed: Math.hypot(pose.velocity[0], pose.velocity[2]),
        yaw: yawOfRot(pose.rotation), hull: boat.hull,   // AUDIT NAV1: her heading (the berth a boarder comes up to) and her hull (the room a captain gives her)
        hullShare: st.damage.hullShare(), crippled: st.damage.state === SHIP_STATES.wrecked, power: myPowerOf(boat, st),   // SEA-PEACE: sized up by a wary pirate
        lit: !!boat.LightOn && carriesLanterns(boat, boat.hull),   // SHIP-WATCH: my lanterns - doused (Come Sail Away's own toggle), I slip by in the dark
      });
    }
    // the other players' boats at their helms (Come Sail Away's `sa`): a pirate takes them as it takes me; their hurts
    // are their own clients' to take (the victim's law), and so is her grapple - said to them, their own to take her over
    // by (AUDIT NAV1, online #10)
    for (const p of deps.peerBoats?.() ?? []) {
      // AUDIT NAV1 (online #6, #10): judged by their own word - their notoriety, their hull, a wreck, whether they let
      // pirates board them (the navy hunted every player by the stander's notoriety, and a peer's wreck was never boarded)
      const self = peerSelf.get(p.id);
      const share = self?.me?.hull ?? 1;
      out.push({
        id: p.id, kind: 'player', pos: p.pos, vel: p.vel ?? [0, 0, 0], speed: p.speed ?? 0, yaw: p.yaw, hull: p.hull ?? null, peer: true,
        notoriety: (c) => self?.law?.[c] ?? 0, hullShare: share, crippled: !!self?.me?.crippled, boarders: self?.me ? self.me.boarders : false,
        // SEA-PEACE: their boat sized up off its hull and its word's hurts. AUDIT NAV2 F2: and her hands as her word
        // says them, single-handed without a crew node - myPowerOf's own law, so every client sizes her as she does
        // herself (a full crew was assumed here, and a wary pirate took on one screen what she left on the other)
        power: peerPowerOf(p, self),
        lit: !!p.boat?.LightOn && carriesLanterns(p.boat, p.hull),   // SHIP-WATCH: as their word lights her
      });
    }
    return out;
  }

  /** AUDIT NAV1 (the boarding audit's minor): the boat of mine the sea takes me by - at her helm, the one I boarded from
   *  while I fight on another's deck, or the one under my feet (a fight on her deck, a walk about her). Off the helm a
   *  captain lost me and sailed off to cruise, a second pirate 18 m away among them. */
  function boatInPlay() {
    const at = myBoat();
    if (at) return at;
    if (boarding?.boat && myBoats().includes(boarding.boat)) return boarding.boat;
    const feet = deps.feet();
    for (const b of myBoats()) { const box = hullBox(b); if (box && insideGrown(box, feet, DECK_REACH_M)) return b; }
    return null;
  }
  /** AUDIT NAV1 (B14): a sea ship whose deck my feet stand on (her hull box, DECK_REACH_M grown), or null. */
  function seaDeckUnderMe() {
    const feet = deps.feet();
    for (const e of sea.values()) {
      const box = e.boat ? hullBox(e.boat) : null;
      if (box && insideGrown(box, feet, DECK_REACH_M)) return e;
    }
    return null;
  }
  /** SEA-PEACE: whether the player stands aboard a ship - at a helm, on a boat of theirs, or on a sea ship's deck. Off
   *  every ship the sea's hostility is nobody's business of theirs (the header's law). AUDIT NAV2 F4: or on another
   *  player's boat they ride (`deps.aboardPeer() -> boat | null`, Come Sail Away's riding: SEA-PEACE read the rider as
   *  ashore while the ship under them was under the guns - rest, a journey and the time scale open). F36: ON A BOAT IS
   *  STANDING ON HER - a floor of hers under the feet (systems/naval/navalDeck.js `under`: her deck, below it, by her
   *  rail within DECK_REACH_M), her box grown a metre only where no deck of hers is baked; that box, far wider than her
   *  hull at her bow and stern, read a quay or a beach off a moored hull's ends as aboard (332 m2 round a Small Ship, a
   *  quay point 19.6 m from her hull) and stood the hunt, a bounty's trail and a band's chase down. F60: a hull whose
   *  root stands past her own reach of the feet (her stem, her stern and her beam, and DECK_REACH_M) is never asked - her
   *  box was built for every boat and every sea ship on every call (3.34 us and 11 KB: each step's hostileNear, the
   *  threats, playerAfloat each frame). GALLEON (2026-10-01): DECK_REACH_M (by her rail, past her deck's inset edge) for
   *  feet within DECK_STEP of her main deck or over it (mainLevel - DECK_STEP, on every hull); under that a floor of hers
   *  within the body's own reach - the new galleon's gun deck lies 1.08 m over the sea, and a metre's reach of it stood
   *  a swimmer or a quay against her side aboard. AUDIT GN-D3: that reach the capsule's own radius (motor.js
   *  CAPSULE_RADIUS), never the feet's own cell alone - a 0.5 m cell read a man between her guns, on a gun, on her
   *  mast's step as ashore (the galleon's 891 of 25197 standable points under her main deck, the Carrack's 638, the
   *  Large Galley's 5436 (AUDIT GN2-DK5: it said 3829): no Sail ho!, no alarm, rest and journeys open, playerAfloat
   *  false), while the capsule's reach misses none of the galleon's, and with her floors read only where they face up
   *  (AUDIT GN-D-wall: her bottom's underside stood a swimmer on it) reads none of the points round her hull aboard (a
   *  metre read 3.8%). */
  const _aboardLocal = [0, 0, 0];
  const standsOn = (boat, feet) => {
    const r = boat.GameObject?.worldMatrix?.(), b = hullBuild(boat.hull);
    if (!r || Math.hypot(r[12] - feet[0], r[14] - feet[2]) > Math.hypot(Math.max(b.bowZ, -b.aftZ), b.halfWidth) + DECK_REACH_M) return false;
    const deck = boat.MeshObject && deps.pool.deckOf?.(boat.hull, boat.variant ?? 0);
    if (!deck?.count || !deck.under) { const box = hullBox(boat); return !!box && insideGrown(box, feet, DECK_REACH_M); }
    const l = intoDeck(boat.MeshObject.worldMatrix(), feet, _aboardLocal);
    return deck.under(l[0], l[2], l[1], l[1] >= mainLevel(deck) - DECK_STEP ? DECK_REACH_M : CAPSULE_RADIUS);
  };
  function aboardShip() {
    if (myBoat() || (boarding?.boat && myBoats().includes(boarding.boat)) || deps.aboardPeer?.()) return true;
    const feet = deps.feet();
    for (const b of myBoats()) if (standsOn(b, feet)) return true;
    for (const e of sea.values()) if (e.boat && standsOn(e.boat, feet)) return true;
    return false;
  }
  /** AUDIT NAV2 F2: a peer's boat sized up as myPowerOf sizes mine - her hull's hurts and her hands as her word says
   *  them (`m`; an older build's word: a full crew, as before), loading single-handed without a crew node (AUDIT NAV2
   *  F25's measure: her men and whether they load her guns). Null for a boat whose hull is unsaid. */
  function peerPowerOf(p, self = peerSelf.get(p.id)) {
    if (p.hull == null) return null;
    const b = hullBuild(p.hull), said = self?.boat;
    const crew = said && said.hull === p.hull ? Math.max(0, Math.min(b.crew, said.crew)) : b.crew;
    return fightingPower({ hull: p.hull, hullHp: b.hullHp, hullShare: self?.me?.hull ?? 1, crewShare: b.crew > 0 ? crew / b.crew : 1, crew, crewed: !(p.boat && !p.boat.crewed), player: true });
  }
  /** SEA-PEACE: my boat's fighting power as a captain sizes it up (navalAI.js fightingPower) - a boat without her crew
   *  loads single-handed (navalGunnery.js reloadSeconds). AUDIT NAV2 F25: her men and whether they load her guns - a
   *  player's boat never strikes, whatever her men. */
  function myPowerOf(boat, st = myBoatState(boat)) {
    return fightingPower({ hull: boat.hull, hullHp: st.damage.maxHull, hullShare: st.damage.hullShare(), crewShare: st.damage.crewShare(), crew: st.damage.crew, crewed: !!boat.crewed, player: true });
  }
  /** SEA-PEACE: me as the table reads me - the boat I am in play by, sized up, or (off every boat of mine) a player
   *  no wary pirate can size up. */
  function meContact() {
    const boat = boatInPlay();
    if (!boat) {
      // AUDIT NAV2 F4: riding another player's boat (Come Sail Away's riding) - sized up as she is, by her owner's word,
      // so a pirate that would take her is her rider's enemy too (the rider's sea was at peace while she was under fire)
      const ridden = deps.aboardPeer?.() ?? null;
      const p = ridden ? (deps.peerBoats?.() ?? []).find((x) => x.boat === ridden) : null;
      if (p && p.hull != null) {
        const self = peerSelf.get(p.id);
        return { kind: 'player', id: myId(), hullShare: self?.me?.hull ?? 1, crippled: !!self?.me?.crippled, power: peerPowerOf(p, self) };
      }
      return { kind: 'player', id: myId() };
    }
    const st = myBoatState(boat);
    return { kind: 'player', id: myId(), hullShare: st.damage.hullShare(), crippled: st.damage.state === SHIP_STATES.wrecked, power: myPowerOf(boat, st) };
  }
  /** A ship afloat that would take me - her trade and temper, the crowns' notoriety, a blow remembered (navalAI.js
   *  hostile) - `me` the contact she sizes me up by (meContact, read once by a caller walking the sea). */
  const hostileToMe = (e, me = meContact()) => e.ship.damage.state === SHIP_STATES.afloat
    && hostile(e.ship, me, { notoriety: (c) => notoriety.get(c), now: clock });
  /** AUDIT NAV1 (B14): whether a save must wait - a boarding under way, or the player on a ship of the sea's deck (a
   *  prize's among them). The sea is never a save's: a load set the player over open water, the ship and her prize
   *  gone. */
  function saveRefused() {
    if (!enabled) return false;
    if (boarding) return true;
    return !!seaDeckUnderMe();
  }
  /** Whether a hostile ship afloat is within HOSTILE_NEAR_M of the player - Come Sail Away's time scale, the mending,
   *  the shipwright, a rest and a journey all ask it. SEA-PEACE: only while the player is aboard a ship - off every ship
   *  no captain can take them. */
  function hostileNearMe() {
    if (!aboardShip()) return false;
    if (deps.serpent?.near?.()) return true;   // SERPENT1: the sea serpent's waters about me - no rest, no time scale, no yard
    const feet = deps.feet(), me = meContact();
    for (const e of sea.values()) if (dist2d(e.ship.pos, feet) <= HOSTILE_NEAR_M && hostileToMe(e, me)) return true;
    return false;
  }
  /** AUDIT WK-W2: whether my crew is called to the guns - a hostile ship afloat within HOSTILE_NEAR_M of me; by night
   *  only one the night's law shows (her lanterns or her guns' flashes, nightSight) or one that comes for me. A dark
   *  pirate cruising unseen at 500 m woke the watch with "All hands on deck!" and gave her away before any "Sail ho!".
   *  hostileNearMe - the rest, the journey, the yard - is unchanged. */
  function crewAlarm() {
    if (!aboardShip()) return false;
    if (deps.serpent?.near?.()) return true;   // SERPENT1: all hands to the guns in the sea serpent's waters
    const feet = deps.feet(), me = meContact(), night = !!where().night;
    for (const e of sea.values()) {
      const d = dist2d(e.ship.pos, feet);
      if (d > HOSTILE_NEAR_M || !hostileToMe(e, me)) continue;
      if (!night || e.ship.target === myId() || d <= nightSight(HOSTILE_NEAR_M, { night, lit: showsLight(e) })) return true;
    }
    return false;
  }
  /** AUDIT NAV2 F29: whether a hostile ship afloat is within HOSTILE_NEAR_M of a boat of mine, sized up as she lies -
   *  her hands' quiet to mend in, wherever I stand. */
  function hostileNearBoat(b, st) {
    const p = b.GameObject.position;
    const me = { kind: 'player', id: myId(), hullShare: st.damage.hullShare(), crippled: st.damage.state === SHIP_STATES.wrecked, power: myPowerOf(b, st) };
    for (const e of sea.values()) if (dist2d(e.ship.pos, p) <= HOSTILE_NEAR_M && hostileToMe(e, me)) return true;
    return false;
  }
  /** THE MERGE with main's OW6 (a fast journey slows as enemies close, systems/travel/travelThreat.js): the hostile ships
   *  afloat - mine and a peer's copies, raiders among them - each where she sails with the ring a journey must not
   *  cross unwarned: HOSTILE_NEAR_M, where she is an enemy nearby and the journey stops (NAV-H), or her lookout past
   *  it while she has not yet sighted me; closing at her pace once she comes for me. `[{ pos, reach, chasing, mps, holds }]`,
   *  none with the arc off - TIME-DILATION: `holds` the ring inside which she holds the clock to the world's own (NAV-H:
   *  no time scale past one with an enemy nearby; travelThreat.js foeRate). */
  function threats() {
    const out = [];
    if (!enabled || !aboardShip()) return out;   // SEA-PEACE: a journey ashore is no ship's to stop
    const me = meContact();
    for (const e of sea.values()) {
      if (!hostileToMe(e, me)) continue;
      const chasing = chasesMe(e);
      out.push({ pos: e.ship.pos, reach: chasing ? HOSTILE_NEAR_M : Math.max(HOSTILE_NEAR_M, lookoutOf(e.ship)), chasing, mps: e.ship.cls.speed, holds: HOSTILE_NEAR_M });
    }
    return out;
  }

  // ── the shipwright, and the mending at sea (AUDIT NAV1, the helm) ────────────────────────────────────────────────
  let mending = false;   // my helm's boat mended this frame
  /** FB1020c BERTH-RING: whether she lies in a port's waters - a place the port's data flags within a pixel of hers
   *  (`nearPort`, Come Sail Away's own reading, kept) or a board port within SEA_RING (`port`, the world's navalPortHere -
   *  the ring the port law reads: at twelve board ports no Small Ship finds water within a pixel). The berth, the shipwright and the
   *  crew's port ask this one question; the sea's traffic and its waters (`nearPort` alone) ask another. */
  const inPortWaters = () => { const w = where(); return !!(w.nearPort || w.port); };
  /** VOYAGE-HOLD: the berth said to the captain (navalBerth.js) - still under her own way alone, the current's none of it. */
  const berths = createBerthWatch({ lies: (b) => yardHere(b), clear: () => !hostileNearMe(), event: (ev) => deps.captain?.event?.(ev),
    ownWay: (b) => { const r = csa(); return b === r?.state?.CurrentBoat && !r.IsBeached?.(b) ? Math.hypot(...(r.state.MoveVectorCurrent ?? r.state.velocityCurrent ?? [0, 0, 0])) : 0; } });
  /** Whether the shipwright stands for my boat: a port's waters, her way under YARD_SPEED, no hostile ship near. */
  function yardHere(boat) {
    if (!enabled || !boat || !inPortWaters()) return false;
    const v = boatPose(boat).velocity;
    return Math.hypot(v[0], v[2]) <= YARD_SPEED && !hostileNearMe();
  }
  // ── SHIP-CREW: her crew as people, their spirits, and her captain's orders (systems/naval/shipCrew.js) ────────────
  /** Her crew's step: her named hands made to match her deck (a hand the guns took falls, named; one hired joins), the
   *  losses and a wreck on their spirits, a fight's end, and the spirits' clock - in port or at sea, for the boat the
   *  player is in. */
  function crewStep(b, s, d, hostile) {
    const c = s.crew;
    const lost = s.lastCrew - s.damage.crew;
    if (lost > 1e-9 && b.crewed) c.event('handLost', lost / CREW_PER_HAND);
    s.lastCrew = s.damage.crew;
    const wrecked = s.damage.state === SHIP_STATES.wrecked;
    if (wrecked && !s.wasWrecked) { c.event('wrecked'); deps.captain?.event?.({ type: 'wrecked', boat: b.uid ?? null }); }   // CAPT-BOARD: a delivery's cargo lost with her
    s.wasWrecked = wrecked;
    if (hostile) s.inFight = true;
    else if (s.inFight) { s.inFight = false; c.fightOver(); }
    if (b.crewed && playerCrewCount(b.hull, s.damage.crew) !== c.hands.length) {
      const { fell, joined } = muster(b, s);
      if (s.mustered) {
        for (const h of fell) deps.say?.(`${h.name}, ${h.role}, has fallen.`, 4);
        for (const h of joined) deps.say?.(`${h.name} signs on as ${h.role}.`, 3);
      }
      s.mustered = true;
    }
    s.worth = captainWorth(b.crewed ? crewWorth(c.hands, ashoreNames(b)) : NO_WORTH, deps.captain?.stats?.());   // CAPT-CREW: her posts aboard, by their holders' service - CAPTAIN-TREE: and her captain's drill
    if (b === boatInPlay()) {
      const v = boatPose(b).velocity;
      c.tick(d, { inPort: inPortWaters() && Math.hypot(v[0], v[2]) <= YARD_SPEED && !hostile, atSea: !inPortWaters(), wear: s.worth.wear });   // FB1020c BERTH-RING: the berth's own port
    }
  }
  /** SEA-REPAIR: her hands at the repairs she was ordered to make - her carpenter's stores spent as the work is done
   *  (navalYard.js seaRepair), all the way to whole; done, or her stores gone, the order stands down with a word. */
  /** CAPT-CREW: HER ROSTER MADE TO MATCH HER DECK - the hands joining signed on (a Commodore's harbour's come Seasoned:
   *  `deps.captain.seasonedHires`, asked where they sign on - AUDIT CAPTAIN'S SEA C3, the Fleet page's laid-up ship signed
   *  on Green; C4, a prize's pressed men at sea Seasoned), the fallen struck off. The one door of crewStep and crewHands. */
  function muster(b, s) {
    const service = deps.captain?.seasonedHires?.() ? SEASONED_HIRE : 0;
    return s.crew.sync(crewRoster({ hull: b.hull, seed: (deps.crewSeed?.(b) ?? b.uid ?? 1) >>> 0, crew: s.damage.crew }), { service });
  }
  /** AUDIT CC-D8: the hand who answers for her - her First Mate, or the first of her crew aboard while he walks ashore. */
  const mateOf = (boat, st) => {
    const away = ashoreNames(boat);
    const aboard = st.crew.hands.filter((h) => !away?.has(h.name));
    return (aboard.find((h) => h.role === FIRST_MATE) ?? aboard[0])?.name ?? null;   // HOLDINGS: the hand made her First Mate first
  };
  /** QUICK-REPAIRS: `auto` - her hands at the repairs on their own once the fight is over, paid for past the free
   *  mending's cap alone (navalYard.js paidDamage; no order to stand down; a word once, aboard the boat in play, when the
   *  work is done or the stores give out under it); `underFire` - DAMAGE CONTROL, the order's work with a hostile ship
   *  near at SEA_REPAIR_UNDER_FIRE of the pace, her fires left burning and a wreck a wreck until the fight is over. */
  function repairStep(b, s, d, { auto = false, underFire = false, inPlay = null } = {}) {
    if (inPortWaters()) return;   // AUDIT CC-D1: in port the shipwright is the repairs (the order stands for the open sea) - FB1020c BERTH-RING: the shipwright's own port
    if (auto && !wantsRepair(s.damage)) return;
    const stores = deps.stores?.count?.(b) ?? 0;
    if (auto && s.credit <= 1e-9 && stores <= 0) return;   // nothing to work with: the free mending stands, unsaid
    const scale = (b.crewed ? mendScaleOf(s.crew.morale) * (s.worth?.mend ?? 1) : 1) * (underFire ? SEA_REPAIR_UNDER_FIRE : 1);   // CAPT-CREW: her Carpenter's worth
    const crewShare = s.damage.crewShare();
    const owed = auto ? paidDamage(s.damage, { free: !b.crewed || crewShare > 0 }) : s.damage;
    const r = seaRepair(owed, d, { crewed: !!b.crewed, crewShare, scale, budget: s.credit + stores * STORE_POINTS });
    if (r.hull > 0 || r.sail > 0) {
      s.damage.repair({ hull: r.hull, sail: r.sail, crew: 0 }, { refloat: underFire ? Infinity : FIELD_REFLOAT, douse: !underFire });
      s.repairing = true;
      s.credit -= r.work;
      while (s.credit < -1e-9 && deps.stores?.spend?.(b)) s.credit += STORE_POINTS;
      s.credit = Math.max(0, s.credit);
    }
    const mate = mateOf(b, s);
    const spent = s.credit <= 1e-9 && (deps.stores?.count?.(b) ?? 0) <= 0;
    if (auto) {
      if (b !== inPlay) return;   // a boat I am not on mends unsaid
      if (!wantsRepair(s.damage)) deps.say?.(`${mate ? `${mate}: ` : ''}Repairs done, Captain.`, 4);
      else if (spent) deps.say?.(`${mate ? `${mate}: ` : ''}The carpenter's stores are spent, Captain.`, 4);
      return;
    }
    if (!wantsRepair(s.damage)) { s.crew.give(CREW_ORDERS.stand); deps.say?.(`${mate ? `${mate}: ` : ''}Repairs done, Captain.`, 4); }
    else if (spent) { s.crew.give(CREW_ORDERS.stand); deps.say?.(`${mate ? `${mate}: ` : ''}The carpenter's stores are spent, Captain.`, 4); }
  }
  /**
   * SHIP-CREW: an order given from her deck - CREW_ORDERS' (shipCrew.js): her crew answers it (her First Mate by name), or
   * says why not (repairs she does not want, or no stores to make them with). Answers `{ ok, said }`.
   * @param {any} boat @param {string} order
   */
  function giveOrder(boat, order) {
    const st = myBoatState(boat);
    if (!st || !ORDER_TEXT[order]) return { ok: false, said: null };
    const mate = mateOf(boat, st), who = mate ? `${mate}: ` : '';
    let said = null;
    if (order === CREW_ORDERS.repair) {
      if (!wantsRepair(st.damage)) said = `${who}No repairs needed, Captain.`;
      else if (inPortWaters()) said = `${who}We're in port, Captain. The shipwright can do the repairs.`;   // AUDIT CC-D1 (FB1020c BERTH-RING: the shipwright's own port)
      else if (st.credit <= 1e-9 && (deps.stores?.count?.(boat) ?? 0) <= 0) said = `${who}We've no carpenter's stores aboard, Captain.`;
      if (said) { deps.say?.(said, 4); return { ok: false, said }; }
    }
    st.crew.give(order);
    said = `${who}${ORDER_TEXT[order].said}`;
    deps.say?.(said, 3);
    return { ok: true, said };
  }
  /** The yard's model for the shipwright's window (ui/naval/navalYardWindow.js): her state, the offer against the purse, and
   *  the presses - each row as far as the purse pays, or all of them. */
  function yardModel(boat) {
    const st = myBoatState(boat);
    const d = st.damage;
    const discount = () => deps.captain?.yardDiscount?.() ?? 0;   // CAPT-BOARD: a rank's favour at the crown's yard
    const offer = () => yardOffer(d, st.guns.barrels, deps.gold?.() ?? 0, { discount: discount() });
    const give = (id, n) => {
      if (id === 'barrels') st.guns.barrels += n;
      else d.repair({ hull: id === 'hull' ? n : 0, sail: id === 'sail' ? n : 0, crew: id === 'crew' ? n : 0 });
    };
    const buy = (id) => {
      const r = offer().rows.find((x) => x.id === id);
      if (!r || r.missing <= 0) return { ok: false, id, n: 0, cost: 0 };
      if (r.afford <= 0) return { ok: false, id, n: 0, cost: 0, short: r.price };
      deps.pay?.(r.cost);
      give(id, r.afford);
      return { ok: true, id, n: r.afford, cost: r.cost, whole: r.afford === r.missing };
    };
    const buyAll = () => {
      const plan = yardAll(d, st.guns.barrels, deps.gold?.() ?? 0, { discount: discount() });
      const cost = plan.reduce((sum, p) => sum + p.cost, 0);
      if (cost > 0) deps.pay?.(cost);
      for (const p of plan) give(p.id, p.n);
      return { ok: cost > 0, cost, bought: plan, whole: offer().whole === 0 };
    };
    // SEA-REPAIR / SHIP-CREW: her provisions - carpenter's stores into her hold, a round of grog for her crew
    // AUDIT CC-D1: her hold stocked to what her wreck takes to be whole; CC-D5: one round of grog a port day
    const provisions = () => provisionOffer({ stores: deps.stores?.count?.(boat) ?? 0, stock: Math.max(STORES_STOCK, storesToWhole({ hull: 0, maxHull: d.maxHull, sail: 0, maxSail: d.maxSail })), morale: boat.crewed ? st.crew.morale : null, crew: d.crew, crewed: !!boat.crewed, gold: deps.gold?.() ?? 0, grogToday: st.crew.grogOn(where().day ?? null) });
    const buyProvision = (id) => {
      const r = provisions().rows.find((x) => x.id === id);
      if (!r || r.missing <= 0) return { ok: false, id, n: 0, cost: 0 };
      if (r.afford <= 0) return { ok: false, id, n: 0, cost: 0, short: r.price };
      if (id === 'stores' && !deps.stores?.add?.(boat, r.afford)) return { ok: false, id, n: 0, cost: 0 };
      deps.pay?.(r.cost);
      if (id === 'grog') { st.crew.event('grog'); st.crew.drankGrog(where().day ?? null); }
      return { ok: true, id, n: r.afford, cost: r.cost, whole: r.afford === r.missing };
    };
    return {
      name: HULL_NAMES[boat.hull], uid: boat.uid ?? null, cargo: () => boat.Cargo?.Items ?? null, room: () => csa()?.cargoRoom?.(boat) ?? null,   // CAPT-BOARD: her number - a delivery's hold; CAPT-TRADE: her hold
      ship: () => ({ hull: d.hull, maxHull: d.maxHull, sail: d.sail, maxSail: d.maxSail, crew: d.crew, maxCrew: d.maxCrew, barrels: st.guns.barrels, wrecked: d.state === SHIP_STATES.wrecked, stores: deps.stores?.count?.(boat) ?? 0, morale: boat.crewed ? st.crew.morale : null }),
      offer, buy, buyAll, prices: YARD_PRICE, hasBarrels: batteryOf(boat.hull, 'stern')?.gun === 'barrel',
      provisions, buyProvision,
    };
  }
  /** The shipwright's window over the world. */
  /** The shipwright's window over a boat of mine - `quay` true when she lies to his quay at her helm (AUDIT CAPTAIN'S SEA
   *  B3: the harbourmaster and the exchange deal with a ship at the quay alone; the Fleet page's yard is the shipwright's
   *  - a ship laid up a port away took goods in and sold them out where she never sailed). */
  function openYard(boat, { quay = false } = {}) { const m = yardModel(boat); m.atQuay = !!quay; return !!deps.openYard?.(m); }

  // ── HOLDINGS: a ship of mine as the Fleet page reads her and works her, wherever she lies (bible/03-World/Holdings.md) ─
  // `boat` is a boat of mine standing in the world (shown or not), or a laid-up ship's stand-in - `{ uid, hull, crewed,
  // Cargo: { Items } }`, her hold the laid-up one (scenes/fleetHost.js) - so her state is the one her number keeps here.
  /** Her state as the page draws it: her hull, canvas and crew against her whole, a wreck, a fire, her stores. */
  function fleetStatus(boat) {
    const st = myBoatState(boat);
    if (!st) return null;
    const d = st.damage;
    return { hull: d.hull, maxHull: d.maxHull, sail: d.sail, maxSail: d.maxSail, crew: d.crew, maxCrew: d.maxCrew, wrecked: d.state === SHIP_STATES.wrecked,
      fire: d.fire > 0, stores: deps.stores?.count?.(boat) ?? 0, inFight: !!st.inFight, morale: boat.crewed ? st.crew.morale : null, barrels: st.guns.barrels, wants: wantsRepair(d) };
  }
  /**
   * HOLDINGS: REPAIRS MADE AWAY (Mac: "option to repair if theres crew (even if youre away)") - what QUICK-REPAIRS'
   * hands do over the quiet, done at once where she lies: her hull and canvas mended free to FIELD_MEND_CAP of each
   * whole (the free mending's own reach), the rest paid out of her carpenter's stores by seaRepair's law (her hull first,
   * her spare work spent first, then a store STORE_POINTS of work at a time), her fires put out and a wreck refloated. A
   * crewed ship with a hand aboard only, and never one fighting. Answers `{ ok, text, spent }`.
   */
  function repairAway(boat) {
    const st = myBoatState(boat);
    if (!st) return { ok: false, text: 'No such ship of yours.', spent: 0 };
    const d = st.damage;
    if (!boat.crewed) return { ok: false, text: 'This ship has no crew to make repairs.', spent: 0 };
    if (d.crew <= 0) return { ok: false, text: 'This ship has no crew aboard to make repairs. Hire crew at a shipwright.', spent: 0 };
    if (st.inFight) return { ok: false, text: 'The crew is busy fighting.', spent: 0 };
    if (!wantsRepair(d) && !(d.fire > 0)) return { ok: false, text: 'This ship doesn\'t need repairs.', spent: 0 };
    const free = { hull: Math.max(0, d.maxHull * FIELD_MEND_CAP - d.hull), sail: d.maxSail > 0 ? Math.max(0, d.maxSail * FIELD_MEND_CAP - d.sail) : 0 };
    d.repair({ hull: free.hull, sail: free.sail, crew: 0 }, { refloat: FIELD_REFLOAT });
    const stores = deps.stores?.count?.(boat) ?? 0;
    const r = seaRepair(d, 1e9, { crewed: true, crewShare: 1, budget: st.credit + stores * STORE_POINTS });
    let spent = 0;
    if (r.hull > 0 || r.sail > 0) {
      d.repair({ hull: r.hull, sail: r.sail, crew: 0 }, { refloat: FIELD_REFLOAT });
      st.credit -= r.work;
      while (st.credit < -1e-9 && deps.stores?.spend?.(boat)) { st.credit += STORE_POINTS; spent++; }
      st.credit = Math.max(0, st.credit);
    }
    const mate = mateOf(boat, st), who = mate ? `${mate}: ` : '';
    const paid = spent ? ` ${spent === 1 ? 'One store' : `${spent} stores`} spent.` : '';
    if (!wantsRepair(d)) return { ok: true, text: `${who}All repaired, Captain.${paid}`, spent };
    return { ok: true, text: `${who}We've repaired what we can, Captain. We need carpenter's stores for the rest.${paid}`, spent };
  }
  /** HOLDINGS: her hands as the Fleet page's Crew panel reads them - her roster made to match her deck first (crewStep's
   *  own sync, said to nobody: a laid-up ship's hands are signed on before she ever stands), each as the save keeps him. */
  function crewHands(boat) {
    const st = myBoatState(boat);
    if (!st || !boat.crewed) return [];
    if (playerCrewCount(boat.hull, st.damage.crew) !== st.crew.hands.length) {
      muster(boat, st);
      st.mustered = true;
    }
    return st.crew.hands.map((h) => ({ ...h }));
  }
  /** HOLDINGS: a hand of hers given a post (shipCrew.js assign) - answers `{ ok, text }`. */
  function assignRole(boat, name, role) {
    const st = myBoatState(boat);
    if (!st || !boat.crewed) return { ok: false, text: 'This ship has no crew.' };
    return st.crew.assign(name, role);
  }
  /**
   * SHIPYARDS (systems/crewHall.js): A RECRUIT SIGNED ON BY NAME - her roster made to match her deck first (crewHands'
   * own sync, said to nobody), then her place for another named hand weighed (enlistPlan): he joins her roster at his
   * trade's post with his record (shipCrew.js enlist, her spirits lifted by `recruit.lift`), and her crew is raised to
   * the share that stands him on her deck - no blow, no fire put out, no loss on her spirits' books (`lastCrew` moved with
   * it). Answers `{ ok, text, hand? }`; the purse is the caller's.
   * @param {any} boat @param {{ name: string, trade: string, mobile: number, sex: string, fights?: number, boardings?: number, lift?: number }} recruit
   */
  function enlistHand(boat, recruit) {
    const st = myBoatState(boat);
    if (!st || !boat?.crewed) return { ok: false, text: CREW_HALL_TEXT.noCrew };
    crewHands(boat);
    const d = st.damage;
    const plan = enlistPlan({ hull: boat.hull, crew: d.crew, maxCrew: d.maxCrew, hands: st.crew.hands.length });
    if (!plan.ok) return { ok: false, full: !!plan.full, text: plan.why };
    if (st.crew.hands.some((h) => h.name === recruit.name)) return { ok: false, text: CREW_HALL_TEXT.sameName(recruit.name) };
    const hand = st.crew.enlist(recruitHand(recruit), recruit.lift ?? 0);
    if (!hand) return { ok: false, text: CREW_HALL_TEXT.gone };
    const was = d.crew;
    d.muster(plan.crew);   // AUDIT SHIPYARDS L2-5: her crew raised and nothing else - a wreck stays a wreck
    st.lastCrew = d.crew;
    st.mustered = true;
    return { ok: true, text: '', hand: { ...hand }, raise: d.crew - was };
  }
  /** A hall's recruit as her roster takes him (shipCrew.js enlist): his trade the post, his hall id with him. */
  const recruitHand = (recruit) => ({ name: recruit.name, role: recruit.trade, mobile: recruit.mobile, gender: recruit.sex, fights: recruit.fights, boardings: recruit.boardings, hall: recruit.id });
  /**
   * SHIPYARDS (AUDIT SHIPYARDS L7-2): A RECRUIT SIGNED ON IN A HAND'S PLACE - her deck full, `outName` paid off and the
   * recruit standing in his place: one man for another, her crew as it was, the spirits each brought or takes with him.
   * Never a hand ashore at the player's side, never a recruit whose name is already aboard. Answers `{ ok, text, hand?,
   * out? }`; the purse is the caller's. @param {any} boat @param {string} outName @param {any} recruit
   */
  function swapHand(boat, outName, recruit) {
    const st = myBoatState(boat);
    if (!st || !boat?.crewed) return { ok: false, text: CREW_HALL_TEXT.noCrew };
    crewHands(boat);
    if (!st.crew.hands.some((h) => h.name === outName)) return { ok: false, text: 'There\'s no crew member by that name aboard.' };
    if (boat.uid && companions.awayOf(boat.uid)?.has?.(outName)) return { ok: false, text: CREW_HALL_TEXT.ashore(outName) };
    if (st.crew.hands.some((h) => h.name === recruit.name)) return { ok: false, text: CREW_HALL_TEXT.sameName(recruit.name) };
    const out = st.crew.release(outName);
    const hand = st.crew.enlist(recruitHand(recruit), recruit.lift ?? 0);
    if (!hand) return { ok: false, text: CREW_HALL_TEXT.gone };   // unreachable: the name was asked first
    st.mustered = true;
    return { ok: true, text: '', hand: { ...hand }, out };
  }
  /** SHIPYARDS: a named hand of hers PAID OFF (systems/crewHall.js releasePlan) - never one ashore at the player's side,
   *  never the last of her crew; out of her roster wherever he stood, her crew down by his share, no loss on her spirits'
   *  books. Where her crew still stands as many on her deck, the sync names the man who steps up into the place (AUDIT
   *  SHIPYARDS L2-1: said, never a stranger unexplained). Answers `{ ok, text, hand?, next? }`.
   *  @param {any} boat @param {string} name */
  function releaseHand(boat, name) {
    const st = myBoatState(boat);
    if (!st || !boat?.crewed) return { ok: false, text: 'This ship has no crew.' };
    crewHands(boat);   // her roster made to match her deck first, as a hire's is
    if (boat.uid && companions.awayOf(boat.uid)?.has?.(name)) return { ok: false, text: CREW_HALL_TEXT.ashore(name) };
    if (!st.crew.hands.some((h) => h.name === name)) return { ok: false, text: 'There\'s no crew member by that name aboard.' };
    const plan = releasePlan({ crew: st.damage.crew });
    if (!plan.ok) return { ok: false, text: plan.why };
    const hand = st.crew.release(name);
    st.damage.discharge(plan.crew);
    st.lastCrew = st.damage.crew;
    const before = new Set(st.crew.hands.map((h) => h.name));
    const next = crewHands(boat).find((h) => !before.has(h.name)) ?? null;
    return { ok: true, text: '', hand, next };
  }
  /** SHIPYARDS (AUDIT SHIPYARDS L1-6): how many of her hands stand ashore at the player's side, by her number - whatever
   *  the sea fight's switch says and wherever she lies (packed, laid up, afar). */
  const handsAshore = (uid) => (uid ? companions.awayOf(uid)?.size ?? 0 : 0);
  /** SHIPYARDS: a ship sold (systems/shipyards.js) - her hurts, her powder, her crew and her store's credit let go, by her
   *  number. */
  function forgetBoat(uid) {
    if (!uid) return;
    boatState.delete(uid);
    pendingBoats.delete(uid);
  }
  /** HOLDINGS: her state on her refitted whole - her hurts kept as the share of it they were (a refit never heals her
   *  nor hurts her) and nothing else touched (AUDIT 2026-10-17: her state was built again, and CAPTAIN-TREE's stars,
   *  accepted mid-fight, loaded every battery and let the brace and her mending's quiet go). A record still waiting for
   *  her needs nothing: it is read on her new whole when she stands (savedHurts, by its share). */
  function refitBoat(boat) {
    const st = boat?.uid ? boatState.get(boat.uid) : null;
    if (st) st.damage.rewhole(refitBuild(boat));
  }

  /** My gun crews' skill for a volley: PLAYER_SKILL at a full crew (or none to thin), less as they thin. */
  const crewSkill = (boat, st) => Math.min(1, (boat.crewed ? PLAYER_SKILL_THIN + (PLAYER_SKILL - PLAYER_SKILL_THIN) * st.damage.crewShare() : PLAYER_SKILL) * statScale(deps.captain?.stats?.(), 'aim'));   // CAPTAIN-TREE: her captain's aim

  // ── a fire on my own deck (AUDIT NAV1, the helm): seen and heard as a sea ship's is - it read as a chip alone ────
  const myFires = new Map();   // boat -> { fires: [{ at, handle }], loop }
  function douseMine(boat, f) {
    for (const fire of f.fires) fire.handle?.retire?.();
    f.loop?.stop?.();
    myFires.delete(boat);
  }
  /** Each burning boat of mine: her flames along her deck with her, the embers and smoke, the burning loop. */
  function poseMyFires(dt) {
    const standing = myBoats();
    for (const [b, f] of myFires) if (!standing.includes(b)) douseMine(b, f);
    for (const b of standing) {
      const st = myBoatState(b);
      let f = myFires.get(b);
      if (st.damage.fire <= 0) { if (f) douseMine(b, f); continue; }
      if (!f) {
        f = { fires: [], loop: null };
        const spots = b.hull <= 1 ? 1 : 3;
        for (let i = 0; i < spots; i++) f.fires.push({ at: (i - (spots - 1) / 2) * 0.5, handle: deps.flame?.(b.GameObject.position) ?? null });
        myFires.set(b, f);
      }
      const pose = boatPose(b);
      const fw = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
      const build = hullBuild(b.hull);
      const deckY = pose.position[1] + build.deck + 1, len = (build.beam || 4) * 1.6;
      for (const fire of f.fires) {
        const p = [pose.position[0] + fw[0] * fire.at * len, deckY, pose.position[2] + fw[2] * fire.at * len];
        fire.handle?.move?.(p);
        effects.burn(p, dt);
      }
      f.loop ??= deps.audio?.loop3d?.(NAVAL_CLASSIC.burning, pose.position, 0.7, NAVAL_FIRE_LOOP) ?? null;
      f.loop?.move?.(pose.position);
    }
  }

  // ── aiming ───────────────────────────────────────────────────────────────────────────────────────────────────────
  let aiming = false;
  let aim = null;   // the solution this frame, while aiming
  let aimHit = null;   // AUDIT NAV1: where that solution's guns strike this frame (aimStrikes: { ship, hits }), or null
  let braceHeld = false;
  /** SHOT-KINDS: the captain's choice of load (navalLoads.js) - the group laid, else the one the look bears on. */
  const loads = createNavalLoads({ boat: () => (enabled && armed(myBoat()) ? myBoat() : null), deck: (b) => myBoatState(b).guns, side: (b) => (aiming && aim?.side) || lookSide(b), aiming: () => aiming, say: (x, sec) => deps.say?.(x, sec), now: () => realClock });   // AUDIT 2: the wheel's quiet on the real clock

  /**
   * AUDIT NAV1 (the helm): the point on a sea ship the look meets - her hull's box or her rig's, the nearest - inside
   * the battery's reach and LOOK_REACH_PAD: the guns are laid on it (navalGunnery.js `look.at`). A look on her canvas
   * lays round shot for her hull - her centre, at her box's middle height: a ball laid for a sail flies on through it,
   * and a galley's yard reaches out past her side - and chain for the canvas itself. Her way along the fire is led over
   * the ball's flight, so a ship sailing away is laid for where she will be; across the fire it is the helm's own
   * timing, as a broadside's always is.
   */
  function lookOnShip(boat, side, look) {
    const bat = batteryOf(boat.hull, side);
    if (!bat || bat.gun === 'barrel' || !look) return null;
    const load = myBoatState(boat).guns.load(side);   // SHOT-KINDS: laid for its load - its reach and its lead
    const g = shotGun(bat.gun, GUNS[bat.gun], load);
    const reach = rangeAt(g.maxEl * NAVAL_DEG, g.speed, bat.muzzles[0][1]) + LOOK_REACH_PAD;
    const l = Math.hypot(look.dir[0], look.dir[1], look.dir[2]) || 1;
    const far = [look.origin[0] + look.dir[0] / l * reach, look.origin[1] + look.dir[1] / l * reach, look.origin[2] + look.dir[2] / l * reach];
    let best = null;
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk) continue;
      const hull = hullBox(e.boat);
      const boxes = [hull, ...rigBoxesOf(e.boat)];
      for (let i = 0; i < boxes.length; i++) {
        if (!boxes[i]) continue;
        const hit = segmentBoxEntry(look.origin, far, boxes[i], 0);
        if (hit && (!best || hit.t < best.t)) best = { t: hit.t, point: hit.point, e, hull, rig: i > 0 };
      }
    }
    // SERPENT1: the look on the serpent lays the guns on the segment it meets - AUDIT SERPENT T4: led by its way as a
    // ship is by hers (a body swimming 11 m/s under a ball two seconds aloft was struck behind the segment laid on)
    for (const t of deps.serpent?.targets?.() ?? []) {
      const hit = segmentBoxEntry(look.origin, far, t.box, 0);
      if (hit && (!best || hit.t < best.t)) best = { t: hit.t, point: hit.point, e: null, hull: null, rig: false, v: t.v ?? null };
    }
    if (!best) return null;
    if (!best.e && !best.v) return best.point;
    const pose = boatPose(boat);
    const fire = flatUnit(quatRotate(pose.rotation, SIDE_DIR[side])) ?? [0, 0, 1];
    const v = best.e ? velocityOf(best.e.ship) : best.v;
    const p = best.rig && load !== 'chain' && best.hull ? best.hull.c : best.point;
    const along = (v[0] * fire[0] + v[2] * fire[2]) * dist2d(p, pose.position) / Math.max(1, g.speed * 0.97);
    return [p[0] + fire[0] * along, p[1], p[2] + fire[2] * along];
  }
  /** My aim for a side: the look's pitch, or the point on a ship it meets. */
  function lookAim(boat, side) {
    const look = deps.look?.();
    return aimSolution(boatPose(boat), side, look ? { ...look, at: lookOnShip(boat, side, look) } : null, deps.seaY(), { shot: myBoatState(boat).guns.load(side) });   // SHOT-KINDS
  }
  /**
   * AUDIT NAV1 (the helm): where each gun of a laid volley stops - its unscattered arc walked HOT_STEP_S at a time
   * against every ship's hull box (and her rig's for chain shot) as she will stand when it gets there, her way times
   * the ball's time aloft. `{ ship, hits }`: `hits[i]` the i-th gun's `{ t, point }` (the ball where it meets her) or
   * null (it reaches the sea); `ship` the first struck. Every ship at sea is asked, not only the one under the crosshair
   * (a broadside's zone lies forward of the look). Null when no gun strikes: the aim's red is this, never a guess.
   */
  function aimStrikes(solution) {
    if (!solution || solution.barrel) return null;
    const seaY = deps.seaY();
    const ships = [];
    for (const e of sea.values()) {
      const st = e.ship.damage.state;
      if (!e.boat || st === SHIP_STATES.sunk || st === SHIP_STATES.sinking) continue;
      const boxes = [hullBox(e.boat), ...(solution.shot === 'chain' ? rigBoxesOf(e.boat) : [])].filter(Boolean);   // SHOT-KINDS: chain's, whatever bore throws it
      if (boxes.length) ships.push({ e, v: velocityOf(e.ship), boxes: boxes.map((b) => ({ b, r: Math.hypot(b.h[0], b.h[1], b.h[2]) })) });
    }
    // SERPENT1: the sea serpent's segments above the sea - a broadside laid on it goes red as on a ship, each segment
    // where its way will carry it (AUDIT SERPENT T4)
    for (const t of deps.serpent?.targets?.() ?? []) ships.push({ e: SERPENT_AIM, v: t.v ?? [0, 0, 0], boxes: [{ b: t.box, r: Math.hypot(t.box.h[0], t.box.h[1], t.box.h[2]) }] });
    if (!ships.length) return null;
    let ship = null;
    const hits = solution.launches.map((l) => {
      const end = landing(l.p0, l.v0, seaY)?.t ?? 4;
      const n = Math.max(8, Math.ceil(end / HOT_STEP_S));
      let a = l.p0, ta = 0;
      for (let i = 1; i <= n; i++) {
        const tb = end * i / n, b = shotPosition(l.p0, l.v0, tb), tm = (ta + tb) / 2;
        const half = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2;
        let best = null;
        for (const s of ships) {
          const sx = s.v[0] * tm, sz = s.v[2] * tm;
          const a2 = [a[0] - sx, a[1], a[2] - sz], b2 = [b[0] - sx, b[1], b[2] - sz];
          const m = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, (a2[2] + b2[2]) / 2];
          for (const { b: box, r } of s.boxes) {
            if (Math.hypot(m[0] - box.c[0], m[1] - box.c[1], m[2] - box.c[2]) > r + half) continue;   // nowhere near her
            const hit = segmentBoxEntry(a2, b2, box, 0);
            if (hit && (!best || hit.t < best.k)) best = { k: hit.t, e: s.e };
          }
        }
        if (best) {
          const t = ta + (tb - ta) * best.k;
          ship ??= best.e;
          return { t, point: shotPosition(l.p0, l.v0, t) };
        }
        a = b; ta = tb;
      }
      return null;
    });
    return ship ? { ship, hits } : null;
  }
  /** The state of my battery for the aim's line: 'ready', 'reloading', 'braced', 'crippled' or 'empty' (no barrels). */
  function aimState(st, side, boat) {
    if (st.damage.state === SHIP_STATES.wrecked) return 'crippled';
    if (st.guns.braced) return 'braced';
    if (!st.guns.ready(side)) return batteryOf(boat.hull, side)?.gun === 'barrel' && st.guns.barrels <= 0 ? 'empty' : 'reloading';
    return 'ready';
  }

  /**
   * AUDIT NAV1 (the helm): her hurts in her way - Come Sail Away's `wayScale` seam (its moveSpeed times this). Under sail
   * the canvas her rig still sets (navalDamage.js wayShare: BARE_POLES and the rest by the canvas left); under oars
   * full, a wreck's WRECKED_OARS. The damage model had both and the helm read neither - a boat kept its whole way until
   * the last of its canvas went.
   */
  function wayScale(underSail) {
    const boat = myBoat();
    if (!enabled || !boat) return 1;
    if (heaveTo) return 0;   // heaving to: nothing driving her on
    const d = myBoatState(boat).damage;
    if (underSail) return d.state === SHIP_STATES.wrecked ? 0 : d.wayShare();
    return d.state === SHIP_STATES.wrecked ? WRECKED_OARS : 1;
  }
  /** CAPT-CREW: her Bosun's worth on her canvas (shipCrew.js crewWorth `way`) - a boat of mine with a crew's, else 1. Read
   *  where Come Sail Away reads her Rigging refit (scenes/world.js, the runtime's `refit` seam: its `speed` times this), so
   *  her way under sail and its coming on take it as they take the refit, and `wayScale` stays her hurts alone. */
  function postsWay(boat) {
    if (!enabled || !boat?.crewed) return 1;
    const st = boat.uid ? boatState.get(boat.uid) : boatStateByObj.get(boat);
    return st?.worth?.way ?? 1;
  }
  /** Why no sail will set on my boat - a wreck, a rig shot away - or null: Come Sail Away's `sailRefused` seam, said
   *  once where the raise is asked. */
  function sailRefused() {
    const boat = myBoat();
    if (!enabled || !boat) return null;
    const d = myBoatState(boat).damage;
    if (d.state === SHIP_STATES.wrecked) return 'The ship is crippled. No sail will set.';
    if (d.maxSail > 0 && d.sailShare() <= 0) return 'The rigging is shot away. No sail will set.';
    return null;
  }

  /** THE BROADSIDE CAMERA: the eye this frame - `ownEye` eased toward the broadside's own while one is laid, and home. */
  let camK = 0, camSide = null;
  function aimEye(ownEye, dt) {
    const boat = myBoat();
    const want = setting('AimCamera', true) !== false && aiming && boat && aim && (aim.side === 'port' || aim.side === 'starboard')
      && myBoatState(boat).damage.state !== SHIP_STATES.wrecked ? aim.side : null;
    if (want) camSide = want;
    camK += ((want ? 1 : 0) - camK) * (1 - Math.exp(-Math.max(0, dt) / AIM_CAM_TAU));
    if (!want && camK < 1e-3) { camK = 0; camSide = null; }
    if (!boat || !camSide || camK <= 0) return ownEye;
    const pose = boatPose(boat);
    const bat = batteryOf(boat.hull, camSide);
    if (!bat) return ownEye;
    const ports = bat.muzzles.map((m) => toWorld(pose, m));
    const c = ports.reduce((acc, m) => [acc[0] + m[0] / ports.length, acc[1] + m[1] / ports.length, acc[2] + m[2] / ports.length], [0, 0, 0]);
    const fire = flatUnit(quatRotate(pose.rotation, SIDE_DIR[camSide])) ?? [1, 0, 0];
    const fwd = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
    let at = [c[0] + fire[0] * AIM_CAM_OUT - fwd[0] * AIM_CAM_AFT, c[1] + AIM_CAM_UP, c[2] + fire[2] * AIM_CAM_OUT - fwd[2] * AIM_CAM_AFT];
    // never inside a ship alongside - a broadside at her rail's width is the one Black Flag remembers
    let clear = 1;
    for (const e of sea.values()) {
      const box = e.boat && e.ship.damage.state !== SHIP_STATES.sunk ? hullBox(e.boat) : null;
      const hit = box ? segmentBoxEntry(c, at, box, AIM_CAM_CLEAR) : null;
      if (hit && hit.t < clear) clear = hit.t;
    }
    if (clear < 1) at = [c[0] + (at[0] - c[0]) * clear, c[1] + (at[1] - c[1]) * clear, c[2] + (at[2] - c[2]) * clear];
    const k = camK * camK * (3 - 2 * camK);   // eased in and out
    return [ownEye[0] + (at[0] - ownEye[0]) * k, ownEye[1] + (at[1] - ownEye[1]) * k, ownEye[2] + (at[2] - ownEye[2]) * k];
  }

  /** The side the look lays on my boat, and whether it has guns. */
  function lookSide(boat) {
    const look = deps.look?.();
    if (!look) return null;
    const side = sideForBearing(bearingOf(look.dir, boat.GameObject.rotation));
    return batteryOf(boat.hull, side) ? side : null;
  }
  const armed = (boat) => !!boat && batteriesOf(boat.hull).length > 0;

  /**
   * The attack button at the helm: held, the guns are laid under the look and the zone drawn; let go, they fire. The
   * swing never runs at a helm with guns (the answer is true); a boat with none leaves the swing alone (false).
   */
  function attackInput(held) {
    if (!enabled) return false;
    const boat = myBoat();
    if (!armed(boat)) { aiming = false; return false; }
    const st = myBoatState(boat);
    if (held) { aiming = true; return true; }
    if (!aiming) return true;
    aiming = false;
    const side = lookSide(boat);
    if (!side) { deps.say?.('No guns bear there.', 1.5); return true; }
    if (st.damage.state === SHIP_STATES.wrecked) { deps.say?.('Your guns are silent. The ship is crippled.', 2); return true; }
    if (st.guns.braced) { deps.say?.('You are braced. Let go of the brace to fire.', 1.5); return true; }
    if (!st.guns.ready(side)) {
      const bat = batteryOf(boat.hull, side);
      deps.say?.(bat?.gun === 'barrel' && st.guns.barrels <= 0 ? 'No fire barrels left.' : `The ${side} guns are reloading (${st.guns.left(side).toFixed(1)} s).`, 1.5);
      return true;
    }
    const pose = boatPose(boat);
    const solution = lookAim(boat, side);
    fire({ shooter: myBoatId(boat), wireShooter: -1, hull: boat.hull, pose, solution, skill: crewSkill(boat, st) });
    st.guns.fired(side);   // AUDIT NAV1 (the presentation): each gun kicks as it goes (onShot), not the release once
    return true;
  }

  /** The aim put down without a shot - a window opened over it, the helm was left: the release owes nothing. */
  function cancelAim() { aiming = false; aim = null; }
  /** GUN-HOLD (2026-09-29, Mac: "shooting cannons should have attack canceling") - HOLD FIRE: the laid broadside put
   *  down unfired on purpose, by Activate while the guns are laid - the bow's own cancel (playerWeapon.js cancelHeld:
   *  Activate held un-draws a drawn bow). The release then owes nothing; the guns stay loaded. */
  function holdFire() {
    if (!aiming) return false;
    cancelAim();
    deps.say?.('Hold fire.', 1.2);
    return true;
  }

  // ── boarding ─────────────────────────────────────────────────────────────────────────────────────────────────────
  let boarding = null;
  /** The ship a boarding at the helm would take: struck, not taken, within reach - the one the look is on first. `at`
   *  where her helm is reckoned from (AUDIT 2 XA5: where a heave-to leaves her - heaveFor), else where she is. */
  function boardable(boat, { anySpeed = false, at = null } = {}) {
    if (!boat) return null;
    const pose = boatPose(boat);
    const look = deps.look?.();
    let best = null, bestScore = Infinity;
    for (const e of sea.values()) {
      const d = boardingGap(boat, e, { anySpeed, at, pose });
      if (d == null) continue;
      let score = d;
      if (look) {
        const to = [e.ship.pos[0] - look.origin[0], 0, e.ship.pos[2] - look.origin[2]];
        const l = Math.hypot(to[0], to[2]) || 1;
        const lf = flatUnit(look.dir) ?? [0, 0, 1];
        score -= 40 * (to[0] / l * lf[0] + to[2] / l * lf[2]);
      }
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }
  /** THE HELM'S BOARDING REACH, one law (`boardable`'s, and CREW-MUSTER's: the crews muster for a boarding this would
   *  allow, never for one it would not - FIELD BUGS 2026-10-14): her water between the two hulls (m) when the helm of
   *  `boat` could throw the grapples on `e` - struck, not taken, her hull standing, within BOARD_RANGE past the two
   *  beams of `at` (else where `boat` lies), `boat`'s way under BOARD_SPEED unless `anySpeed` - else null. */
  function boardingGap(boat, e, { anySpeed = false, at = null, pose = boatPose(boat) } = {}) {
    if (!anySpeed && Math.hypot(pose.velocity[0], pose.velocity[2]) > BOARD_SPEED) return null;
    if (!boardableState(e.ship, myId(), clock) || !e.boat) return null;   // RAM-BOARD: struck, or fouled by my stem
    const d = dist2d(e.ship.pos, at ?? pose.position) - (hullBuild(e.ship.hull).beam + hullBuild(boat.hull).beam);
    return d > BOARD_RANGE ? null : d;
  }
  /** ON FOOT, one law (`boardableOnFoot`'s, and CREW-MUSTER's): whether `feet` stand within FOOT_BOARD_M of struck `e`'s
   *  side - not taken, her hull standing - to go over her rail. */
  function footReach(e, feet) {
    return boardableState(e.ship, myId(), clock) && !!e.boat && dist2d(e.ship.pos, feet) - hullBuild(e.ship.hull).beam <= FOOT_BOARD_M;   // RAM-BOARD: or fouled by my stem
  }

  // ── heave to (AUDIT NAV1, the helm) ─────────────────────────────────────────────────────────────────────────────
  let heaveTo = null;   // { id, until, decel }
  /** A struck ship that the helm is too fast to board - the one a heave-to is for - or null: AUDIT 2 XA5, in reach of
   *  where the heave-to leaves her (heaveToRun along her way), so it is offered as she comes up on her and never as she
   *  passes her too fast to stop beside her. */
  function heaveFor(boat) {
    if (!boat || boardable(boat)) return null;
    const pose = boatPose(boat), v = pose.velocity, way = Math.hypot(v[0], v[2]), run = heaveToRun(way);
    const at = way > 0 ? [pose.position[0] + (v[0] / way) * run, pose.position[1], pose.position[2] + (v[2] / way) * run] : null;
    return boardable(boat, { anySpeed: true, at });
  }
  /** Strike the sails and take her way off beside `e` (AUDIT SHIPS A3: at the brake her way needs - heaveToDecel). */
  function startHeaveTo(e, boat) {
    const v = boat ? boatPose(boat).velocity : [0, 0, 0];
    heaveTo = { id: e.id, until: clock + HEAVE_TO_S, decel: heaveToDecel(Math.hypot(v[0], v[2])) };
    const r = csa();
    if (r?.state?.sailPosition > 0) r.LowerSails?.();
    deps.say?.(`Heave to! You slow down beside ${e.ship.names?.name ?? 'it'}.`, 2.5);
  }
  /** The heave-to ends under BOARD_SPEED, past HEAVE_TO_S, or with her gone from reach. */
  function stepHeaveTo(boat) {
    if (!heaveTo) return;
    const e = sea.get(heaveTo.id);
    const v = boat ? boatPose(boat).velocity : null;
    const slow = !v || Math.hypot(v[0], v[2]) <= BOARD_SPEED;
    if (slow || clock > heaveTo.until || !e || !boardableState(e.ship, myId(), clock)) heaveTo = null;   // RAM-BOARD: struck, or fouled by me
  }
  /** Come Sail Away's `brake` seam: her way comes off at the heave-to's brake while she heaves to (0: her own rate). */
  const brake = () => (enabled && heaveTo && myBoat() ? heaveTo.decel : 0);

  /**
   * Activate: at the helm, throw the grapples on a struck ship in reach; on foot (a deck alongside her, or swimming
   * up), go over her rail when she is within reach and the look is on her. True when it took the press.
   */
  function activate({ boatTrigger = false } = {}) {
    if (!enabled || boarding || aiming) return false;   // AUDIT NAV2 F31: the guns laid, Activate is the hold's (holdFire) - never a grapple thrown with a broadside owed on the release
    const boat = myBoat();
    // a prize of mine whose fate is not yet set: her hold again
    const prize = prizeInReach(boat);
    if (prize) { openPrize(prize); return true; }
    if (boat) {
      const e = boardable(boat);
      if (e) { startBoarding('board', e, boat); return true; }
      const fast = heaveFor(boat);
      if (fast) { startHeaveTo(fast, boat); return true; }   // AUDIT NAV1: too fast to board her - heave to
      return yardHere(boat) && openYard(boat, { quay: true });   // AUDIT NAV1: the shipwright, lying to his quay
    }
    const e = boardableOnFoot();
    const p = e || boatTrigger || gangwayInReach() ? null : passageShip();   // PASSAGE: a berth's friendly ship, her passage asked of the door - my own gangway first
    if (p) { deps.passage({ id: p.id, name: p.ship.names?.name ?? null, captain: p.ship.names?.captain ?? null, hull: p.ship.hull, faction: p.ship.cls.faction }); return true; }
    if (!e) { const g = boatTrigger ? null : gangwayInReach(); return g ? takeGangway(g) : false; }   // QUAYS: the gangway, on foot - AUDIT HOLDINGS Q4: never over her own helm, hold or door the ray is on (`boatTrigger`)
    startBoarding('board', e, null);
    return true;
  }
  /** NAVAL-E (AUDIT 2026-10-01 part four): WHETHER `activate` WOULD TAKE THE PRESS NOW, asked without taking it - a prize's
   *  hold, a struck ship to board or to heave to beside, the yard at her quay, a struck ship's rail on foot. The street
   *  asks it before a node's press: at sea the net's cast stands in the look, and E cast it while the readout said "E:
   *  board her". */
  function takesActivate({ boatTrigger = false } = {}) {
    if (aiming || boarding || !enabled) return false;   // activate's own guard
    const boat = myBoat();
    if (prizeInReach(boat)) return true;
    if (boat) return !!(boardable(boat) || heaveFor(boat) || yardHere(boat));
    if (!boatTrigger && passageShip()) return true;   // PASSAGE: and a berth's ship to book
    return !!(boardableOnFoot() || (!boatTrigger && gangwayInReach()));   // QUAYS: and the gangway
  }
  /** A prize this player took and has not yet scuttled or cast off, within reach - of the helm (BOARD_RANGE past the
   *  two beams) or of the feet (FOOT_BOARD_M past hers) - the look on her. */
  function prizeInReach(boat) {
    const from = boat ? boatPose(boat).position : deps.feet();
    const look = deps.look?.();
    const lf = look ? flatUnit(look.dir) : null;
    for (const e of sea.values()) {
      if (!e.prize || e.prize.fate || !e.boat || e.ship.damage.state !== SHIP_STATES.prize) continue;
      const reach = boat ? BOARD_RANGE + hullBuild(boat.hull).beam : FOOT_BOARD_M;
      if (dist2d(e.ship.pos, from) - hullBuild(e.ship.hull).beam > reach) continue;
      if (lf) {
        const to = [e.ship.pos[0] - look.origin[0], 0, e.ship.pos[2] - look.origin[2]];
        if ((to[0] * lf[0] + to[2] * lf[2]) / (Math.hypot(to[0], to[2]) || 1) < 0.5) continue;
      }
      return e;
    }
    return null;
  }
  /** The struck ship a player on foot can go over the rail of: within FOOT_BOARD_M of the feet, the look on her. */
  function boardableOnFoot() {
    const feet = deps.feet();
    const look = deps.look?.();
    for (const e of sea.values()) {
      if (!footReach(e, feet)) continue;
      if (look) {
        const box = hullBox(e.boat);
        const to = box ? [box.c[0] - look.origin[0], 0, box.c[2] - look.origin[2]] : null;
        const lf = flatUnit(look.dir);
        if (to && lf && (to[0] * lf[0] + to[2] * lf[2]) / (Math.hypot(to[0], to[2]) || 1) < 0.5) continue;
      }
      return e;
    }
    return null;
  }

  function startBoarding(kind, entry, boat) {
    const from = { pos: [...entry.ship.pos], yaw: entry.ship.yaw };
    let to = from;
    if (boat) {
      const pose = boatPose(boat);
      const anchor = { pos: pose.position, yaw: yawOfRot(pose.rotation), beam: hullBuild(boat.hull).beam, midZ: 0 };
      to = berthPose(anchor, { pos: entry.ship.pos, yaw: entry.ship.yaw, beam: hullBuild(entry.ship.hull).beam, midZ: 0 });
    }
    // AUDIT NAV1 (online #3): a ship another stands is taken over at the grapple - the haul, the fight, the prize and
    // her fate in one world, mine (the boarder's copy was hauled 23 m from her stander's, and slid back from under him)
    adopt(entry);
    boarding = createBoarding({ kind, shipId: entry.id, from, to: { pos: to.pos, yaw: to.yaw } });
    boarding.boat = boat;
    boarding.peerOrigin = deps.aboardPeer?.() ?? null;
    if (!boat) boarding.t = Infinity;   // on foot: no haul - over the rail at once
    entry.ship.boarded = true;
    entry.ship.speed = 0;
    entry.ship.damage.douse();   // AUDIT NAV1 (B4): grappled, her fires are fought - never a fight on a deck burning under it
    douse(entry);
    sound(NAVAL_SFX.grapple, entry.ship.pos, 0.9);
    deps.say?.(kind === 'board' ? `Grapples away! Hauling ${entry.ship.names?.name ?? 'it'} alongside...` : `Grappling hooks! ${entry.ship.names?.name ? `${entry.ship.names.name} is` : 'The pirates are'} coming alongside. Repel boarders!`, 3);
  }

  /** The boarding's frame: the haul, then the fight's tally, then the prize. */
  function stepBoarding(dt) {
    const b = boarding;
    if (!b) return;
    const entry = sea.get(b.shipId);
    if (!entry) {   // AUDIT NAV1 (B4, B6): her ship gone - her boarders fight on stranded, and her raid sends no more
      const quest = b.quest;
      endBoarding();
      if (quest) { raidUids.delete(quest.uid); deps.board?.endRaid?.(quest, { withdraw: false, crew: true }); }   // RAID-WON (AUDIT FB1019 D2): its crew home, never left on my deck counted as enemies near
      return;
    }
    const was = b.phase;
    b.step(dt);
    const pose = b.pose();
    if (pose) { entry.ship.pos = [pose.pos[0], entry.ship.pos[1], pose.pos[2]]; entry.ship.yaw = pose.yaw; }
    if (was === 'grapple' && b.phase === 'fight') beginFight(b, entry);
    if (b.phase !== 'fight') return;
    // the fight: its muster's tally, the player's distance
    if (dist2d(deps.feet(), entry.ship.pos) > ABANDON_RANGE) {
      if (b.kind === 'repel') { castOff(b, entry, 'abandon'); return; }   // AUDIT NAV1 (B6, B7): my own deck left to them
      deps.say?.(entry.ship.damage.state === SHIP_STATES.afloat ? t('naval.foul.leave', 'You leave the boarding. The enemy crew returns to their guns.') : 'You leave the boarding. The enemy crew stands down.', 3);   // RAM-BOARD: a sound ship fights on
      for (const f of b.foes) deps.board?.removeFoe?.(f.handle);
      b.foes = [];
      entry.ship.boarded = false;
      b.abandon();
      endBoarding();
      return;
    }
    // a Warm Ashes raid: its own flow - AUDIT NAV1 (B5): won the moment a winning task fires (never waiting on the
    // quest's own end, the flagship's twenty-five seconds after its leader fell), given up when its retreat sounds
    if (b.quest) {
      if (raidQuestWon(b.quest)) winBoarding(b, entry);
      else if (raidQuestRetreated(b.quest)) castOff(b, entry, 'retreat');
      return;
    }
    const down = b.foes.filter((f) => deps.board?.foeDown?.(f.handle)).length;
    const captainDown = b.foes.some((f) => f.captain && deps.board?.foeDown?.(f.handle));
    if (boardingWon({ captainDown, down, total: b.foes.length })) winBoarding(b, entry);
  }

  function beginFight(b, entry) {
    const boat = b.boat;
    deps.board?.leaveHelm?.();
    // AUDIT NAV2 F44/F32: every body a spot of its own (AUDIT NAV1 B10's law, kept for the living crew's stands and the
    // rail too): none within BODY_GAP of another stood body or of my landing - the rail answered its one cell again and
    // again on a short deck and the dealer went round, so hands stood on her men and on me - and a body with no free
    // spot is not stood (her men below decks, my hands at home: the deck holds no more)
    const taken = [];
    const free = (p) => !!p && taken.every((q) => dist2d(q, p) >= BODY_GAP);
    const claim = (spot) => { taken.push(spot[0]); return spot; };
    const pick = (...deals) => {
      for (const d of deals) for (let i = 0; i < d.size; i++) { const spot = d(); if (spot && free(spot[0])) return claim(spot); }
      return null;
    };
    if (b.kind === 'board') {
      const spots = deps.board?.deckSpots?.(entry.boat, DECK_SPOTS) ?? [];
      const first = spots[0] ?? [entry.ship.pos, entry.ship.yaw];
      // LIVING CREW (seamless): over the rail onto her deck across from where I stand - never her middle, a haul off
      const landing = deps.board?.landing?.(entry.boat, deps.feet()) ?? null;
      deps.board?.placePlayer?.((landing ?? first)[0], (landing ?? first)[1]);
      claim(landing ?? first);
      const deal = dealer(spots);   // AUDIT NAV1 (B10): every body a spot of its own, the deck's own dealt round
      const muster = musterOf(entry.ship.cls, entry.ship.damage.crewShare());
      const all = [muster.captain, ...muster.men];
      // LIVING CREW: her crew fight where they stand - the men on her deck are her muster's first, in its order
      // (crewLife.js crewRoster is musterOf's), each his own sex; the rest come up from below at the deck's spots
      const crew = deps.board?.crewOf?.(entry.boat, Infinity) ?? [];
      b.foes = [];
      for (let i = 0; i < all.length; i++) {
        const c = crew[i];
        const spot = c && free(c.feet) ? claim([c.feet, c.yaw]) : pick(deal);
        if (!spot) continue;
        // AUDIT NAV1 (B9): her captain by his name - the one the win asks for, never one more Spellsword among the rest
        // DECK-WALK: one crew (her faction's team) on her deck
        const named = { ...(i === 0 && entry.ship.names?.captain ? { name: `Captain ${entry.ship.names.captain}` } : {}), team: crewTeamOf(entry.ship.cls), boat: entry.boat, ...(c ? { gender: c.gender } : {}) };
        // AUDIT NAV2 F44: a man of hers stands as himself - his own class where he stood (a man thrown back and boarded
        // again was the muster's next class, an Archer stood as a Rogue)
        const handle = deps.board?.spawnFoe?.(c ? c.mobile : all[i], spot[0], spot[1], 'enemy', named);
        if (handle) b.foes.push({ handle, captain: i === 0 });
      }
      entry.deck = b.foes.map((f) => f.handle);   // they fall on her deck, and go with her
      const st = myBoatState(boat);
      const hands = myHands(boat, st);   // SHIP-CREW: her spirits and the rail's order
      // LIVING CREW: my hands are my own crew, off my deck and over with me, onto her rail across from my ship
      const mine = deps.board?.crewOf?.(boat, hands) ?? [];
      const rail = dealer(deps.board?.railSpots?.(entry.boat, boat ? boatPose(boat).position : deps.feet(), hands) ?? []);
      for (let i = 0; i < hands; i++) {
        const spot = pick(rail, deal);
        if (!spot) break;
        const handle = deps.board?.spawnFoe?.(mine[i]?.mobile ?? HAND, spot[0], spot[1], 'ally', { boat: entry.boat, ...(mine[i] ? { gender: mine[i].gender } : {}) });   // DECK-WALK: my hands on her deck
        if (handle) b.hands.push({ handle });
      }
      deps.mid?.(`You board ${entry.ship.names?.name ?? 'it'}!`, 3);
      deps.say?.(entry.ship.cls.faction === 'pirate' ? `Captain ${entry.ship.names?.captain ?? ''} rallies the pirates. Cut them down!` : `The crew of ${entry.ship.names?.name ?? 'it'} stand to defend their ship.`, 5);
      return;
    }
    // repel: she boards the player
    const crewed = !!boat?.crewed;
    const wa = deps.warmAshesOn?.() !== false;
    const deal = dealer(deps.board?.deckSpots?.(boat, DECK_SPOTS) ?? []);   // AUDIT NAV1 (B10)
    taken.push(deps.feet());   // AUDIT NAV2 F32: never on me
    // AUDIT NAV1 (B2): her crew stands to repel them - Warm Ashes' raid refused (one at a time) or the mod off, a crewed
    // boat's hands fight beside the player as they go over with them to board (handsOf; none from an uncrewed boat)
    const hands = myHands(boat, myBoatState(boat));   // SHIP-CREW: her spirits and the rail's order
    const mine = deps.board?.crewOf?.(boat, hands) ?? [];   // LIVING CREW: my own crew, standing to where they stand
    if (crewed && wa) {
      const quest = deps.board?.startRaid?.(raidQuestOf(entry.ship.cls));
      if (quest) { b.quest = quest; raids.set(quest, b); if (Number.isFinite(quest.uid)) raidUids.add(quest.uid); return; }   // its own `_ally_` are my crew
    }
    const n = repelPartyOf(entry.ship.cls);
    // LIVING CREW (seamless): her party is her own men (never her captain), off her deck and over my rail across from her
    const party = deps.board?.crewOf?.(entry.boat, n, { from: 1 }) ?? [];
    const rail = dealer(deps.board?.railSpots?.(boat, entry.ship.pos, n) ?? []);
    b.foes = [];
    for (let i = 0; i < n; i++) {
      const spot = pick(rail, deal);
      if (!spot) break;
      const handle = deps.board?.spawnFoe?.(party[i]?.mobile ?? musterOf(entry.ship.cls).men[i % 4], spot[0], spot[1], 'enemy', { team: crewTeamOf(entry.ship.cls), boat, ...(party[i] ? { gender: party[i].gender } : {}) });   // DECK-WALK: her party, one crew, on my deck
      if (handle) b.foes.push({ handle, captain: false });
    }
    for (let i = 0; i < hands; i++) {
      const spot = mine[i] && free(mine[i].feet) ? claim([mine[i].feet, mine[i].yaw]) : pick(deal);
      if (!spot) break;
      const handle = deps.board?.spawnFoe?.(mine[i]?.mobile ?? HAND, spot[0], spot[1], 'ally', { boat, ...(mine[i] ? { gender: mine[i].gender } : {}) });   // DECK-WALK: my hands on my own deck
      if (handle) b.hands.push({ handle });
    }
  }

  /** RAID-WON (bible/01-Overview/bugs/Field-Bugs-2026-10-19.md): a raid this throw-back won ends with it - its living foes
   *  withdrawn, its `_ally_` among them, and its quest ended as its own `end quest` ends one (world.js endRaid's `won`,
   *  scenes/raidAshore.js) - never left running with its crew on my deck, counted as enemies near. Its uid stays mine until
   *  the quest ends (raidEnded): a Leave Ship or a wave its grace ticks still run is the sea fight's, never a voyage's. */
  function wonRaid(quest) {
    if (quest) deps.board?.endRaid?.(quest, { won: true });
  }
  /** The fight won: a boarding's prize, or boarders thrown back. */
  function winBoarding(b, entry) {
    // SHIP-CREW: a boarding stood - each hand's count - and won: a prize taken, or the boarders thrown back
    crewEvent(b.boat ?? boatInPlay(), 'boarding');
    crewEvent(b.boat ?? boatInPlay(), b.kind === 'repel' ? 'win' : 'prize');
    if (b.kind === 'repel') {
      // AUDIT CAPTAIN'S SEA D10: A LEGEND OF BOARDERS BOARDS AGAIN (the Ninefold Hunger: "hands who board, and board
      // again" - her terror was clamped like any flagship's and did nothing): her first wave thrown back, half her hands
      // come over the rail again from where she lies lashed alongside; the second thrown back, she is beaten as any pirate
      const again = b.boat && myBoats().includes(b.boat) ? b.boat : null;
      if (again && legendOfClass(entry.ship.cls.id)?.trait === 'boarders' && !entry.boardedAgain && entry.ship.damage.state === SHIP_STATES.afloat) {
        entry.boardedAgain = true;
        entry.ship.damage.apply({ hull: 0, sail: 0, crew: entry.ship.damage.crew / 2 }, clock);
        endBoarding();
        wonRaid(b.quest);   // RAID-WON: her first wave's raid won - its crew home before the second comes over
        deps.mid?.(`The boarders are thrown back, but ${entry.ship.names?.name ?? 'it'} sends more over the rail!`, 3);
        startBoarding('repel', entry, again);
        return;
      }
      deps.mid?.('The boarders are thrown back!', 3);
      chargePlayer('repel', entry, { questPays: !!b.quest && entry.ship.cls.flagship });   // CAPT-PAY: a pirate's end - the law's reward (a flagship's raid quest pays its own), the log, the crown's regard
      // AUDIT NAV2 F19: her hull first - struck by it at the share NAV-R left her, her fires out - then her crew, gone
      // over my rail (HELM-WAY's unmanned strike took her on the crew line at 95% and burning, and the hull line never ran)
      if (entry.ship.damage.state === SHIP_STATES.afloat) entry.ship.damage.apply({ hull: Math.max(0, entry.ship.damage.hull - entry.ship.damage.maxHull * 0.24), sail: 0, crew: 0 }, clock);
      entry.ship.damage.apply({ hull: 0, sail: 0, crew: entry.ship.damage.crew }, clock);
      entry.ship.boarded = false;
      endBoarding();
      wonRaid(b.quest);   // RAID-WON: after the boarding's end, as castOff's lost raid (the raid's end comes back through raidEnded)
      return;
    }
    b.win();
    // AUDIT NAV1 (B3): "her crew surrenders" - her living men throw down their arms before her window opens over them
    let yielded = 0;
    for (const f of b.foes) if (!deps.board?.foeDown?.(f.handle)) { deps.board?.standDown?.(f.handle); yielded++; }
    entry.ship.damage.takePrize();
    entry.ship.boarded = false;   // AUDIT NAV1 (B1): the fight is over - a prize is let go like any hulk once out of sight
    chargePlayer('board', entry);
    sound(NAVAL_CLASSIC.bell, entry.ship.pos, 1);
    deps.mid?.(`${entry.ship.names?.name ?? 'It'} is yours!`, 3);
    if (yielded) deps.say?.('The rest of the enemy crew surrenders.', 3);
    // the prize: her hold drawn once (whoever opens it again finds what is left), the boat that took her
    entry.prize = { hold: drawHold(entry.ship.cls, entry.ship.seed, (key, tier) => deps.hold?.(key, tier + (entry.deep ? DEEP_TIER : 0) + etherTier(entry)) ?? []), boat: b.boat ?? nearestBoat(entry.ship.pos), peerOrigin: b.peerOrigin ?? null, chosen: null, fate: null };   // CAPT-WATERS: a deep ship's hold the richer
    entry.prize.drawn = drawnPlunder(entry.prize.hold);   // AUDIT CAPTAIN'S SEA L12: her own, counted once each as they leave her
    // STOLEN-GOODS AUDIT (2026-10-16, S4): A LAWFUL SHIP'S HOLD IS HER OWNER'S GOODS. Her boarding is Piracy (chargePlayer
    // above: navalLaw.js lawOf's 'board'), so what she carried is taken from someone else's keeping - marked as her hold
    // is drawn, so every way out of it carries the mark (Take all into the captor's hold or the pack, Open her hold, the
    // crew's stow when the sea goes). A pirate's hold is a lawful prize (her end is rewarded), and past the Veil no crown's
    // writ runs (chargeEther charges nothing) - neither is marked: the mark and the charge agree.
    if (lawfulGoods(entry)) markStolen(entry.prize.hold);
    deps.captain?.prize?.(entry.ship.names?.name ?? classLine(entry.ship.cls, entry.ship.names?.crown), deps.worth?.(entry.prize.hold) ?? 0);   // CAPT-LOG: the richest prize
    endBoarding();   // the hands go home over the rail; her dead lie on her deck (entry.deck)
    openPrize(entry);
  }
  /**
   * A hold emptied into a boat's hold (Come Sail Away's cargo - its weight slows her, as the mod weighs it), or with no
   * boat into the pack as far as the pack will carry; what will not go stays where it was. Answers the tally.
   */
  const _plundered = new WeakSet();   // AUDIT CC-D5: the prizes' holds her crew has cheered
  function takeInto(hold, boat) {
    if (!hold.length) return { taken: 0, left: 0, where: boat ? 'hold' : 'pack' };
    const all = hold.splice(0);
    const r = deps.board?.giveItems?.(all, boat) ?? { left: all };
    const left = Array.isArray(r.left) ? r.left : [];
    for (const it of left) hold.push(it);
    tallyPlunder(all.filter((it) => !left.includes(it)));   // CAPT-LOG: the plunder hauled - AUDIT CAPTAIN'S SEA L12: hers alone, once
    if (all.length > left.length && !_plundered.has(hold)) { _plundered.add(hold); crewEvent(boat ?? boatInPlay(), 'plunder'); }   // SHIP-CREW: a hold filled - AUDIT CC-D5: once a prize (an item put back and taken again was +3 a time)
    return { taken: all.length - left.length, left: left.length, where: boat ? 'hold' : 'pack' };
  }
  /**
   * KEEP-PLUNDER (2026-09-30, Mac: ship ownership "less punishing" - "Keep boats & cargo"): the sea is never a save's,
   * and a transition or a fast travel empties it (clear) - a prize whose hold was not yet emptied and the casks of the
   * ships I sank went with it. Before it goes, my crew stows them: a prize's hold into the boat that took her (her
   * captor gone from the world: the helm's boat, else the pack as far as it carries - takeInto), a cask of mine into
   * the helm's boat or the one of mine nearest it. A scuttled prize's hold goes down with her (her casks float); a
   * cask another player's sea floats, or one another ship sank, is not mine. The host skips a load (the loaded save's
   * own hold stands). Answers the tally, said once.
   */
  function stowPlunder() {
    if (!enabled) return { items: 0, prizes: 0, casks: 0, lost: 0 };
    let items = 0, prizes = 0, casks = 0, lost = 0;
    const standing = myBoats();
    // AUDIT KEEP-PLUNDER D1: off the helm (a door, a jump) into my boat nearest me before the pack - the pack carries
    // what it can, and what it cannot is said, never let go unsaid
    const feet = deps.feet();
    const nearMe = () => standing.reduce((best, b) => (!best || dist2d(b.GameObject.position, feet) < dist2d(best.GameObject.position, feet) ? b : best), null);
    const into = myBoat() ?? nearMe();
    for (const e of sea.values()) {
      const pz = e.prize;
      if (pz && !pz.fate) settlePlunder(pz);   // AUDIT CAPTAIN'S SEA L12: what was taken of her by hand
      if (!pz?.hold?.length || pz.fate === 'scuttle') continue;
      const r = takeInto(pz.hold, standing.includes(pz.boat) ? pz.boat : into);
      if (r.taken) { items += r.taken; prizes++; }
      lost += r.left;
    }
    for (const f of shots.floaters().filter((o) => o.kind === 'flotsam' && !o.owner && myCasks.has(o.id))) {
      if (isSalvage(f.lot)) {   // SALVAGE: her wreckage's stores and powder, as a cask's things
        const r = stowSalvage(salvageOf(classById(f.from)), into);
        shots.removeFloater(f.id);
        casks++;
        items += r.stores;
        lost += r.lost;
        continue;
      }
      const got = deps.hold?.(f.lot, holdTier(classById(f.from)) + (f.deep ? DEEP_TIER : 0)) ?? [];
      if (stolenCasks.delete(f.id)) markStolen(got);   // STOLEN-GOODS AUDIT: stowed, still her owner's
      const r = got.length ? deps.board?.giveItems?.(got, into) ?? { left: got } : { left: [] };
      shots.removeFloater(f.id);
      casks++;
      const left = Array.isArray(r.left) ? r.left.length : 0;
      items += got.length - left;
      lost += left;
    }
    if (items) deps.say?.(`Your crew stows the plunder left at sea (${items} ${items === 1 ? 'thing' : 'things'}).`, 3);
    if (lost) deps.say?.(`${lost} ${lost === 1 ? 'thing' : 'things'} would not fit and ${lost === 1 ? 'was' : 'were'} left behind.`, 3);
    return { items, prizes, casks, lost };
  }
  /** SHIP-CREW: the hands a boat of mine sends to a boarding - handsOf's, one more in high spirits or all hands to the
   *  rail, one fewer in low (never none while any stand, never past one more than her crew makes). CAPT-CREW: and her
   *  First Mate's hands besides, past that cap as well - a Veteran's one, an Old Salt's two. */
  function myHands(boat, st) {
    const base = handsOf(st?.damage.crew ?? 0, !!boat?.crewed);
    if (!base || !boat?.crewed || !st?.crew) return base;
    const mate = st.worth?.hands ?? 0;
    // AUDIT CAPTAIN'S SEA C5: her First Mate brings over the rail only hands her crew has the men for (a hand is
    // CREW_PER_HAND of her crew - AUDIT NAV2 F49), past the spirits' one more as it was: a Small Ship's six men stood
    // four, and the phantoms' falls took her real crew, her First Mate with them
    const men = Math.floor((st.damage.crew ?? 0) / CREW_PER_HAND);
    return Math.max(1, Math.min(base + 1 + mate, base + handsBonusOf(st.crew.morale, st.crew.order) + mate, Math.max(base + 1, men)));
  }
  /** CAPT-LOG: plunder hauled in - its worth to the captain's log (`deps.worth`, the world's measure of a thing). */
  function notePlunder(items) {
    if (items?.length) deps.captain?.note?.('plunder', deps.worth?.(items) ?? 0);
  }
  /** AUDIT CAPTAIN'S SEA L12: A HOLD'S OWN PLUNDER, COUNTED ONCE - the items a hold was drawn with, each counted as it
   *  leaves it (Take all; by hand, reckoned when her fate is chosen or the sea lets her go), never the captain's own things
   *  put in and taken out again (each pass counted them). Answers the list as drawn. */
  const _drawn = new WeakSet();
  function drawnPlunder(items) { for (const it of items) if (it && typeof it === 'object') _drawn.add(it); return [...items]; }
  function tallyPlunder(items) { notePlunder((items ?? []).filter((it) => it && typeof it === 'object' && _drawn.delete(it))); }
  /** A prize's own items taken out of her hold by hand since she was drawn - counted. */
  const settlePlunder = (pz) => tallyPlunder((pz?.drawn ?? []).filter((it) => !pz.hold.includes(it)));
  /** SHIP-CREW: what happened, told to a boat of mine's crew (none for no boat, or one without a crew). */
  function crewEvent(boat, kind) {
    if (!boat) return;
    const st = myBoatState(boat);
    if (st?.crew && boat.crewed) st.crew.event(kind);
  }
  /** A ship struck to my guns - in a sea I stand (stateChanged) or in her stander's word (applyWord, AUDIT CC-E4): my
   *  crew's win, and QL11's act - one say for both arms (AUDIT QUESTLINES ACTS-8, ACTS-11; HOST-SPLIT). */
  const struckToMe = () => { crewEvent(boatInPlay() ?? myBoat(), 'win'); noteAct('ship-struck'); };
  /** The boat of mine nearest a place, within COLLIDE_RANGE - the one a prize taken on foot answers to. */
  function nearestBoat(pos) {
    let best = null, bestD = COLLIDE_RANGE;
    for (const b of myBoats()) { const d = dist2d(b.GameObject.position, pos); if (d < bestD) { bestD = d; best = b; } }
    return best;
  }

  /**
   * The prize's window: her hold (what is left of it), the captor's one choice and her fate - the plunder window's
   * model (ui/naval/navalPlunderWindow.js). Shut without a fate, she lies taken where she is and Activate opens her again.
   */
  function openPrize(entry) {
    const s = entry.ship;
    const pz = entry.prize;
    if (!pz) return false;
    const boat = pz.boat && myBoats().includes(pz.boat) ? pz.boat : null;
    const st = boat ? myBoatState(boat) : null;
    const numbers = () => ({ maxHull: st.damage.maxHull, hull: st.damage.hull, maxSail: st.damage.maxSail, sail: st.damage.sail, maxCrew: st.damage.maxCrew, crew: st.damage.crew });
    const armament = () => ({
      barrelStock: BARREL.stock, barrels: st.guns.barrels, barrelGuns: batteriesOf(boat.hull).some((x) => x.gun === 'barrel'),
      loaded: SIDES.every((side) => !batteryOf(boat.hull, side) || st.guns.left(side) === 0),
      guns: batteriesOf(boat.hull).length > 0,   // AUDIT NAV1: a rowboat's powder is for no gun
    });
    // AUDIT NAV1 (B13): her papers - my notoriety in the waters of the crown she answers to; AUDIT CAPTAIN'S SEA D3: past
    // the Veil none (the nearest Bay capital's papers washed my notoriety there for a deed that never earned it)
    const crownName = entry.ether ? null : crownOfShip(s);
    const lawful = !!NAVAL_FACTIONS[s.cls.faction]?.lawful;
    const law = () => ({ notoriety: notoriety.get(crownName), lawful, crown: crownName });
    return deps.board?.openPlunder?.({
      name: s.names?.name ?? 'The prize', captain: s.names?.captain ?? null, classLine: classLine(s.cls, s.names?.crown),
      faction: s.cls.faction, items: pz.hold, raid: false,
      /** the captor's ship as the choices find her, read fresh at every paint */
      mine: () => (st ? { name: HULL_NAMES[boat.hull], hull: st.damage.hullShare(), sail: st.damage.maxSail > 0 ? st.damage.sailShare() : null, crew: st.damage.maxCrew > 0 ? st.damage.crewShare() : null } : null),
      offers: () => (st ? CHOICES.map((c) => choiceOffer(c, numbers(), armament(), law())) : []),
      takeAll: () => takeInto(pz.hold, boat),
      chosen: () => pz.chosen,
      fated: () => pz.fate,
      choose(choice) {
        if (pz.chosen || pz.fate || !st) return false;
        if (!CHOICES.includes(choice)) return false;
        const fx = choiceEffect(choice, numbers(), { barrelStock: BARREL.stock, notoriety: notoriety.get(crownName) });
        pz.chosen = choice;
        if (fx.notoriety) notoriety.add(crownName, fx.notoriety);
        if (fx.repair) {
          const was = [st.damage.hull, st.damage.sail];
          st.damage.repair({ hull: fx.repair.hull, sail: fx.repair.sail, crew: 0 });
          pz.took = { hull: st.damage.hull - was[0], sail: st.damage.sail - was[1] };   // SHIP-CLAIM: what her timber made good of mine, out of her
        }
        if (fx.barrels != null) st.guns.barrels = Math.max(st.guns.barrels, fx.barrels);
        if (fx.reload) st.guns.restore({ clocks: {}, barrels: st.guns.barrels });   // every battery loaded
        if (fx.crew) st.damage.repair({ hull: 0, sail: 0, crew: fx.crew });
        deps.say?.(choice === 'repair' ? `Salvaged timber and rope repair your ${HULL_NAMES[boat.hull]}.` : choice === 'powder' ? 'The captured powder is stowed aboard. Every gun is loaded.'
          : choice === 'press' ? 'The captured crew are put to work on your guns.'
            : !crownName ? (lawful ? 'You burn the ship\'s papers. No crown\'s law reaches past the Veil.' : 'The crew are put ashore in irons. No crown past the Veil will hang them.')
              : lawful ? `You burn the ship's papers. No one is left to report you in ${crownName}'s waters.` : `The crew are handed in irons to the crown of ${crownName}, and the crown will remember it.`, 3);
        return true;
      },
      /** SHIP-CLAIM: her third fate while it stands - `{ detail }`, what claiming her makes of her - or null. */
      claimOffer: () => (claimable(entry) ? { detail: claimDetail(entry) } : null),
      /** Her fate: 'scuttle', 'adrift' or SHIP-CLAIM's 'claim' - answers whether it was decided (THE MODAL CONTRACT: a
       *  boolean from every exit; a fate already decided, or a claim refused, false). */
      fate(which) {
        if (pz.fate) return false;
        if (which === 'claim') return claimPrize(entry, boat);   // SHIP-CLAIM: she is mine
        // Move to a surviving deck before releasing this one; a passenger never takes its owner's helm.
        if (!returnFromPrize(pz, boat)) { deps.say?.('No safe return deck is available. Stay here or claim the ship first.', 4); return false; }
        settlePlunder(pz);   // AUDIT CAPTAIN'S SEA L12
        pz.fate = which === 'scuttle' ? 'scuttle' : 'adrift';
        if (pz.fate === 'scuttle') { s.damage.scuttle(); s.damage.apply({ hull: 0, sail: 0, crew: 0, fire: true }, clock); igniteShip(entry); deps.say?.(`You set ${s.names?.name ?? 'it'} on fire. It burns to the waterline.`, 4); sound(NAVAL_CLASSIC.bubbles, s.pos, 1); }   // a sinking ship's fire burns on until she is gone (navalDamage.js step)
        else { s.adrift = true; deps.say?.(`You cut ${s.names?.name ?? 'it'} loose to drift.`, 3); }   // AUDIT NAV1 (B11): she drifts off downwind
        return true;
      },
      /** AUDIT NAV1 (B11): Leave her - she lies taken where she is (Activate opens her again), and I am back at my helm,
       *  never left on her deck with the water between the hulls. */
      leave() { returnFromPrize(pz, boat); },
    }) !== false;
  }

  /**
   * SHIP-CLAIM (2026-10-01, Mac: "provide more accessibility options to acquiring" ships - and of the choices put to
   * him, "Claim captured prizes - Keep a ship you take by boarding as your own boat, instead of scuttling her or casting
   * her adrift"). HER THIRD FATE: CLAIMED, SHE IS MY BOAT - Come Sail Away's own, as a bought one is.
   * - OFFERED (`claimable`) for a prize I stand - one another stands is theirs to settle (online, only my own) - and
   *   never a voyage raid's (its window's one way on is Sail on: leaveShipGate's model offers none), only where Come Sail
   *   Away can place her: its runtime's LaunchFromDeed and the host's mint and pack (none with the mod off).
   * - HER DEED: the shelf's own deed (comeSailAwayItems.js mintDeed, a fresh UID off the host's mint) for her hull and
   *   variant, worth navalPlunder.js PRIZE_DEED_SHARE of her hull's price - her papers: a taken ship is no bought one -
   *   into my pack as the mod puts its items there (`packDeed`: AddItem, no weight's gate).
   * - HER BOAT where she lies, heading as she lies, linked to that deed by the mod's own placing (LaunchFromDeed:
   *   PlaceBoat and the item's half), on the terrain under her. A hull the mod spends a deed on placing (one not
   *   `crewed`: the Large Boat) spends this one too - she is the mod's small boat, packed and placed again as any.
   * - HER HOLD, what is left of it, in her own hold (her cargo) - never lost.
   * - HER HURTS, as SHARES, onto her state as a boat of mine (myBoatState, by her deed's UID - saved as every boat of
   *   mine is): her hull, never under a point (she floats), and her canvas, each less what her timber made good of mine
   *   when that was my choice; her fire barrels what she has left (none, her powder taken); her crew gone - NO hands
   *   aboard: they are hired at a shipwright, and a crewed hull with none mends nothing alone.
   * - LET GO from the sea WITHOUT SINKING (`drop`): no bell, no casks, no reward - she is mine. Her living crew go with
   *   her record; her dead lie on her deck still (the world's `redeck`: my hull stands in hers); a harbour's moored ship
   *   is not stood at her berth again today. And I am back at my own helm, as her other fates put me (`returnAboard`).
   * Answers whether she was claimed.
   */
  function claimPrize(entry, captor) {
    const r = claimable(entry) ? csa() : null;
    if (!r) return false;
    const s = entry.ship, pz = entry.prize, d = s.damage, hers = entry.boat;
    const at = [s.pos[0], deps.seaY(), s.pos[2]];
    const deed = mintDeed(s.hull, s.variant, deps.board.mintUid(), prizeDeedValue(s.hull));
    const pack = deps.board.packDeed(deed);
    // ALL OR NOTHING: a placing that fails (it throws, or stands no boat) takes her deed back out of the pack, and she
    // lies a prize still - never a deed with no boat, nor a second deed for her
    let boat = null;
    try { boat = r.LaunchFromDeed(deed, pack, at, forwardOfYaw(s.yaw), deps.board.terrainAt?.(at)); } catch (err) { console.warn('[naval] a claimed prize would not be placed', err); }
    if (!boat) { const list = pack(), i = list.indexOf(deed); if (i >= 0) list.splice(i, 1); deps.board?.forgetDeed?.(deed); return false; }   // AUDIT HOLDINGS F8: and the ledger's record of her with it
    pz.fate = 'claim';
    tallyPlunder(pz.drawn ?? []);   // AUDIT CAPTAIN'S SEA L12: every one of hers mine now - in my hands, or in her hold with her
    if (pz.hold.length) deps.board?.giveItems?.(pz.hold.splice(0), boat);
    const st = myBoatState(boat);
    const took = pz.took ?? { hull: 0, sail: 0 };
    st.damage.restore({ hull: Math.max(1, ((d.hull - took.hull) / d.maxHull) * st.damage.maxHull), sail: ((d.sail - took.sail) / d.maxSail) * st.damage.maxSail, crew: 0 });
    st.lastCrew = st.damage.crew;   // no hand of hers ever lost to my crew's spirits
    st.guns.barrels = pz.chosen === 'powder' ? 0 : s.guns.barrels;
    if (entry.fromHarbour) departedOf(entry.fromHarbour, where().day ?? 0).add(s.seed);
    drop(entry);
    deps.board?.redeck?.(hers, boat);
    const name = s.names?.name ?? 'It';
    // HOLDINGS: her title to the Fleet's book (the world host's packDeed), never the pack
    deps.say?.(boat.crewed ? `${name} is yours. The title is in your Fleet ledger (Holdings). It has no crew: hire crew at a shipwright.` : `${name} is yours. It stays where you captured it.`, 5);
    deps.captain?.note?.('claimed');   // CAPT-LOG: a prize claimed
    if (!returnFromPrize(pz, captor)) returnAboard(boat);
    return true;
  }
  /** SHIP-CLAIM: whether a prize can be claimed - mine to settle, and Come Sail Away here to place her. */
  const claimable = (entry) => !entry.owner && typeof csa()?.LaunchFromDeed === 'function' && typeof deps.board?.mintUid === 'function' && typeof deps.board?.packDeed === 'function';
  /** SHIP-CLAIM: what claiming her makes of her, in the window's words. */
  const claimDetail = (entry) => (entry.boat?.crewed ? `Keep it as your own ${HULL_NAMES[entry.ship.hull]}. The title goes to your Fleet ledger and the cargo stays in its hold. It has no crew.`
    : `Keep it as your own ${HULL_NAMES[entry.ship.hull]} where it is, with the cargo in its hold.`);

  /** Back over the rail onto your own deck - AUDIT NAV1 (B11): and at her helm, as Black Flag hands you the wheel when
   *  the prize is settled (Come Sail Away's StartSailing: a wreck rows). */
  function returnFromPrize(prize, ownBoat) {
    if (ownBoat && myBoats().includes(ownBoat)) return returnAboard(ownBoat);
    const peer = prize.peerOrigin;
    if (!peer?.GameObject?.activeSelf || !deps.pool.peerBoats.includes(peer)) return false;
    const spot = deps.board?.deckSpots?.(peer, 4)?.[0];
    if (!spot || !deps.board?.placePlayer) return false;
    deps.board.placePlayer(spot[0], spot[1]);
    return true;
  }
  function returnAboard(boat) {
    const spots = deps.board?.deckSpots?.(boat, 4) ?? [];
    if (!spots[0] || !deps.board?.placePlayer) return false;
    deps.board.placePlayer(spots[0][0], spots[0][1]);
    deps.board?.takeHelm?.(boat);
    return true;
  }

  function endBoarding() {
    if (!boarding) return;
    if (boarding.quest) raids.delete(boarding.quest);
    // AUDIT NAV2 F49: a hand who fell is his CREW_PER_HAND of her crew, gone with him - my living crew stood whole again
    // beside his body
    const fell = boarding.hands.filter((h) => deps.board?.foeDown?.(h.handle)).length;
    if (fell && boarding.boat) myBoatState(boarding.boat)?.damage.apply({ hull: 0, sail: 0, crew: fell * CREW_PER_HAND }, clock);
    for (const h of boarding.hands) deps.board?.removeFoe?.(h.handle);   // my hands, back aboard their own ship
    boarding = null;
  }
  /** AUDIT NAV1 (B4): the ship I boarded going down under the fight - her living men over the side, my hands home and
   *  me back aboard my own deck, never left fighting on a hull that is not there. */
  function founderUnderFight(entry) {
    const b = boarding;
    for (const f of b.foes) if (!deps.board?.foeDown?.(f.handle)) deps.board?.removeFoe?.(f.handle);
    b.foes = [];
    entry.ship.boarded = false;
    b.abandon?.();
    const boat = b.boat && myBoats().includes(b.boat) ? b.boat : null;
    endBoarding();
    deps.mid?.(`${entry.ship.names?.name ?? 'It'} is going down! Back to your own ship!`, 3);
    if (boat) returnAboard(boat);
  }
  /**
   * AUDIT NAV1 (B5, B6, B7) - THE BOARDERS CAST OFF. A raid given up (its retreat sounded - `why` 'retreat' - or its own
   * hour run out, 'ended': its quest already over) or my deck left to them ('abandon'). Their raid ends with it - never
   * its waves following the player about, nor a quest holding every other boarding off - and its living boarders go
   * back over her rail with the arc's own; she hauls off - sheering away, and leaving me be SPARE_S (navalAI.js spare):
   * never grappling again the moment she lets go.
   */
  function castOff(b, entry, why) {
    const quest = b.quest;
    for (const f of b.foes) deps.board?.removeFoe?.(f.handle);
    b.foes = [];
    b.abandon?.();
    endBoarding();   // first: the raid's end below comes back through raidEnded, and finds no boarding of its own
    if (quest) { raidUids.delete(quest.uid); deps.board?.endRaid?.(quest, { withdraw: true }); }
    entry.ship.boarded = false;
    entry.ship.spare?.set?.(myId(), entry.ship.clock + SPARE_S);
    sheerOff(entry);
    const name = entry.ship.names?.name ?? 'the pirates\' ship';
    deps.say?.(why === 'abandon' ? `You leave your deck to them. The pirates fall back to ${name} and cast off.` : `The pirates fall back to ${name} and cast off.`, 4);
  }

  // ── Warm Ashes' raids (the pirate quest system) ──────────────────────────────────────────────────────────────────
  /** The raids this host started: quest -> boarding. */
  const raids = new Map();
  /** And their quests' UIDs, which the save keeps: a raid restored from a save has no boarding (the sea is not a
   *  save's), and its "Leave Ship" must still be the naval arc's - never Warm Ashes' voyage home. */
  const raidUids = new Set();
  let prizeRaid = null;   // a fast-travel raid's prize window: { quest, state: 'open' | 'done' }
  /**
   * Warm Ashes' "Leave Ship", asked first (systems/warmAshesShips.js's gate): a raid THIS host started is its own -
   * 'naval': the boarders are thrown back and nothing is sailed; a raid of the mod's own voyage waits ('wait') while
   * its prize window is open, and then goes on ('proceed').
   */
  function leaveShipGate(quest) {
    const b = raids.get(quest);
    if (b) {   // RAID-WON (AUDIT FB1019 D1): won - its uid mine until the quest ends (raidEnded), so its grace is the sea fight's
      const entry = sea.get(b.shipId);
      if (entry) winBoarding(b, entry); else { endBoarding(); wonRaid(quest); }   // her ship gone: won all the same
      return 'naval';
    }
    if (quest && raidUids.has(quest.uid)) { wonRaid(quest); return 'naval'; }   // a raid of mine a load carried: thrown back, nothing sailed - RAID-WON: and ended as won
    if (!enabled || setting('RaidPrize', true) !== true) return 'proceed';
    if (prizeRaid?.quest === quest) return prizeRaid.state === 'done' ? 'proceed' : 'wait';
    // the voyage's raiders beaten: their vessel's hold, before the ship sails on
    prizeRaid = { quest, state: 'open' };
    const cls = classById(deps.level?.() >= 4 ? 'pirateBrig' : 'pirateSloop');
    const seed = u32();
    const names = shipNames(cls, seed, { regionIndex: where().region ?? 17 });
    const items = drawHold(cls, seed, (key, tier) => deps.hold?.(key, tier) ?? []);
    const drawn = drawnPlunder(items);   // AUDIT CAPTAIN'S SEA L12
    const opened = deps.board?.openPlunder?.({
      name: names.name, captain: names.captain, classLine: classLine(cls), faction: 'pirate', items, raid: true,
      mine: () => null, offers: () => [], takeAll: () => takeInto(items, null),
      chosen: () => null, fated: () => (prizeRaid?.state === 'done' ? 'sailed' : null),
      choose: () => false,
      fate: () => { if (prizeRaid) prizeRaid.state = 'done'; tallyPlunder(drawn.filter((it) => !items.includes(it))); },
    });
    if (opened === false) { prizeRaid.state = 'done'; return 'proceed'; }   // no window to show it in: the voyage goes on
    return 'wait';
  }
  /**
   * A raid's quest ended (the machine's OnQuestEnded). Won - the pirate attack's leader down, or a small raid's wave
   * killed with no "Leave Ship" to say so (navalBoarding.js raidQuestWon) - the boarders are thrown back; ended by its
   * own clock first, they give up the fight and cast off.
   */
  function raidEnded(quest) {
    if (quest) raidUids.delete(quest.uid);
    const b = raids.get(quest);
    if (!b) return;
    const entry = sea.get(b.shipId);
    if (entry && raidQuestWon(quest)) { winBoarding(b, entry); return; }
    if (entry) { castOff(b, entry, 'ended'); return; }   // AUDIT NAV1 (B7): cast off, and gone - not lying alongside to grapple again
    endBoarding();
  }
  /**
   * Where a naval raid's quest foe stands (world.js's tryPlaceFoe asks first): a spot on the deck being boarded. AUDIT
   * NAV1 (B10): each raid DEALT its spots - DECK_SPOTS of the boarded deck, shuffled once, taken round - one the world
   * finds held (`isFree` false: a body standing, or standing up, there) passed over; every one held: `false`, the wave
   * waits as one on the open ground does (a wave's thirteen stood on five spots). A raid of mine whose fight is over:
   * `false` too - never the open ground's ring round the player; not a raid of mine: null.
   */
  function placeQuestFoe(quest, isFree = null) {
    const b = raids.get(quest);
    if (!b) return quest && raidUids.has(quest.uid) ? false : null;
    if (!b.boat) return null;
    // AUDIT NAV2 F37: the rail's spots dealt before the deck's, each shuffled in its own - one shuffle of both put 2 of a
    // wave's first 8 at my rail
    b.deal ??= [dealer(deps.board?.railSpots?.(b.boat, sea.get(b.shipId)?.ship.pos ?? deps.feet(), DECK_SPOTS / 2) ?? []), dealer(deps.board?.deckSpots?.(b.boat, DECK_SPOTS) ?? [])];   // LIVING CREW: a raid's waves over my rail across from her first
    for (const deal of b.deal) {
      for (let i = 0; i < deal.size; i++) {
        const spot = deal();
        if (spot && (!isFree || isFree(spot))) return [spot[0], spot[1], b.boat];   // DECK-WALK: and the deck it is on - the wave stays on it
      }
    }
    return false;
  }
  /** A deck's spots dealt: shuffled once on the host's own draw, then taken round - `deal()` the next, `deal.size`. */
  function dealer(spots) {
    const deck = [...spots];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    let k = 0;
    const deal = () => (deck.length ? deck[k++ % deck.length] : null);
    deal.size = deck.length;
    return deal;
  }

  // ── rams ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  let wayIn = [];   // AUDIT NAV1: my boat's forward way over the last RAM_MEMORY_S - [{ t, v }]
  function checkRams(boat) {
    if (!boat) { wayIn = []; return; }
    const pose = boatPose(boat);
    const v = pose.velocity;
    const fwd = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
    wayIn.push({ t: clock, v: v[0] * fwd[0] + v[2] * fwd[2] });
    while (wayIn.length && clock - wayIn[0].t > RAM_MEMORY_S) wayIn.shift();
    const way = wayIn.reduce((m, w) => Math.max(m, w.v), 0);
    if (way < RAM_SPEED) return;
    const build = hullBuild(boat.hull);
    const stem = [pose.position[0] + fwd[0] * build.bowZ, pose.position[1] + 1, pose.position[2] + fwd[2] * build.bowZ];
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk || clock - e.ramAt < RAM_COOLDOWN_S) continue;
      const box = hullBox(e.boat);
      if (!box || !insideGrown(box, stem, RAM_REACH)) continue;
      const her = velocityOf(e.ship);
      const speed = way - (her[0] * fwd[0] + her[2] * fwd[2]);   // closing: a ship sailing on ahead of the stem takes less of it
      if (speed < RAM_SPEED) continue;
      e.ramAt = clock;
      wayIn = [];   // the way spent on her
      const galley = build.ram;
      const dealt = Math.round(speed * RAM_DAMAGE * (galley ? GALLEY_RAM : 1) * statScale(deps.captain?.stats?.(), 'ram'));   // CAPTAIN-TREE: her captain's ram
      effects.hit(stem, fwd, true);
      sound(NAVAL_SFX.hit, stem, 1);
      deps.shake?.(3);
      deps.mid?.(galley ? 'Your ram smashes into the hull!' : 'You ram the ship!', 2);
      chargePlayer('fire', e);
      e.myBlowAt = clock;
      // RAM-BOARD (systems/naval/navalFoul.js): her bow fouled in my stem - boarded as she stands while it holds
      if (!e.owner) strike(e, { hull: dealt, sail: 0, crew: ramMen(dealt, random()) }, myId());   // AUDIT 2: her blow first - a ram that sends her down (or strikes her colours) fouls nothing, nor says so
      if (e.ship.damage.state === SHIP_STATES.afloat && !e.ship.boarded) { foul(e.ship, myId(), clock, deps.captain?.stats?.().foul); deps.say?.(t('naval.foul.rammed', 'The ships are locked together. Board before they break free!'), 3); }
      if (e.owner) deps.sendHit?.(navalHitData(e.owner, { n: e.n, hull: Math.min(400, dealt), crew: ramMenSaid(dealt), zone: 'holed', foul: fouledBy(e.ship, myId(), clock) ? foulLeft(e.ship, clock) : 0 }));   // RAM-BOARD: her stander holds her way
      const st = myBoatState(boat);
      const back = dealt * RAM_RECOIL * (galley ? 1 / GALLEY_RAM : BOW_RECOIL) * (st?.guns.braced ? BRACE_TAKEN : 1);
      st?.damage.apply({ hull: Math.round(back), sail: 0, crew: 0 }, clock);
      break;
    }
  }

  // ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * One frame of the sea, the streaming world's exterior only. `paused` holds every clock (the shots, the ships, the
   * smoke - a pause is a pause); `outdoors` false (a building, a dungeon) takes the sea away.
   */
  function frame(dt, { paused = false, outdoors = true, brace = false } = {}) {
    if (!enabled) return;
    if (!outdoors) { if (sea.size || shots.inFlight) clear(); return; }
    // AUDIT NAV1: the sea keeps the world's time. A frame's time - Come Sail Away's time scale's too - is stepped in
    // FRAME_STEP_S steps (FRAME_STEPS_MAX at most; a longer stall drops the rest), and the hulls are posed once after
    const total = paused ? 0 : Math.min(seaSeconds(dt, timeScale(), sharedSea(deps.online?.peers?.(), deps.feet(), NAVAL_SHARE_RADIUS)), FRAME_STEP_S * FRAME_STEPS_MAX);   // TIME-DILATION (systems/naval/seaClock.js): online, a sea a peer shares runs at real time - my clock never runs its AI against them
    if (!paused) realClock += Math.max(0, dt) / timeScale();   // AUDIT GN2-GN3: the frame's own, unscaled
    const seaY = deps.seaY();
    const boat = myBoat();
    const st = boat ? myBoatState(boat) : null;
    // notoriety fades day by day
    whereNow = null;   // the waters, read afresh for this frame
    const day = where().day ?? null;
    if (day != null) { if (lastDecayDay != null && day > lastDecayDay) notoriety.decay(day - lastDecayDay); lastDecayDay = day; }
    if (!total) return;
    braceHeld = !!brace;
    if (boat) { const v = boatPose(boat).velocity; deps.captain?.sailed?.(Math.hypot(v[0], v[2]) * Math.min(Math.max(0, dt), FRAME_STEP_S * FRAME_STEPS_MAX)); }   // CAPT-LOG: the leagues a captain sails at her helm - on her own clock (TIME-DILATION: a shared sea's is real time, her way the world's)
    for (let left = total; left > 1e-9;) {
      const h = Math.min(left, FRAME_STEP_S);
      stepSea(h, seaY, boat);
      left -= h;
    }
    // a rig shot away, or the ship crippled, with her sails set: struck down - once, the raise refused after it
    // (`sailRefused`, Come Sail Away's seam)
    const refused = sailRefused();
    if (refused && csa()?.state?.sailPosition > 0) { csa().LowerSails?.(); deps.say?.(refused, 2.5); }
    // an owner gone from the room takes their ships with them (checked every OWNER_SWEEP_S)
    if (deps.online && clock - lastSweep >= OWNER_SWEEP_S) { lastSweep = clock; sweepOwners(new Set((deps.online.peers?.() ?? []).map((p) => p.id))); }
    tendClaims();
    shedFarHulls(deps.look?.()?.origin ?? deps.feet());   // PEER-HULL-RANGE
    buildOne();
    const eye = deps.look?.()?.origin ?? deps.feet();   // AUDIT NAV1 (#17): her rigging's life by her range from it
    for (const e of [...sea.values()]) fadeStep(e, total);   // SHIP-FADE
    for (const e of sea.values()) poseShip(e, total, seaY, eye);
    knowStep();   // SPYGLASS: what this frame teaches me of each ship
    siteStep(boat);   // CAPT-BOARD: the held contracts' waters, and a delivery's berth
    if (clock - lastHailCheck >= SAIL_HO_CHECK_S) { lastHailCheck = clock; hailSails(boat); }   // AUDIT NAV1 (#14)
    // the ram and the aim, on the hulls as this frame stands them (AUDIT NAV1: both read the last frame's, a ship's way
    // behind - my stem where it is, her planking where it was)
    checkRams(boat);
    stepHeaveTo(boat);
    poseMyFires(total);
    feel.frame(total, (en) => (sea.get(en.id) === en && en.ship.damage.state === SHIP_STATES.sinking ? [en.ship.pos[0], seaY + 1.5, en.ship.pos[2]] : null));   // COMBAT-FEEL: magazines due, my hull's smoke
    aim = null; aimHit = null;
    if (aiming && boat) {
      const side = lookSide(boat);
      if (side) { aim = lookAim(boat, side); aimHit = aimStrikes(aim); }
      // GALLEON: laid - her shutters up, her guns out. AUDIT GN-G8: a battery reloading is not laid - its guns stay in to
      // load (they stood run out through a 9 s reload)
      if ((side === 'starboard' || side === 'port') && myBoatState(boat).guns.ready(side)) galleonGuns.lay(boat, side, clock);
    } else if (!boat) aiming = false;
    // GALLEON: a captain's run-out opens her shutters as it runs her guns out (the tell, navalAI.js) - and every
    // galleon in play stands her gun deck as this frame has it
    const decks = [...myBoats()];
    for (const e of sea.values()) {
      if (!e.boat) continue;
      decks.push(e.boat);
      for (const side of e.ship.runOut?.keys?.() ?? []) if (side === 'starboard' || side === 'port') galleonGuns.lay(e.boat, side, clock);
    }
    for (const p of deps.peerBoats?.() ?? []) {
      if (!p.boat) continue;
      decks.push(p.boat);
      // AUDIT GN-G3: another player's lay, from her word - while her word is fresh (it is said again at least every
      // full frame, net/online.js FOES_FULL_MS 2 s). AUDIT GN2-GN3: on the real clock that frame is - on my sea's at x5
      // her still lay lapsed between two words (laid 165 frames of 360)
      const self = peerSelf.get(p.id);
      if (self?.laid?.length && realClock - self.real <= PEER_LAY_S) for (const side of self.laid) if (side === 'starboard' || side === 'port') galleonGuns.lay(p.boat, side, clock);
    }
    galleonGuns.step(decks, clock);
    // the word's memory of the last moments
    wireVolleys = wireVolleys.filter((v) => clock - v.at <= NAVAL_VOLLEY_KEEP_MS / 1000);
    wireBarrels = wireBarrels.filter((v) => clock - v.at <= NAVAL_VOLLEY_KEEP_MS / 1000);
    for (let i = flashes.length - 1; i >= 0; i--) if (clock - flashes[i].t > MUZZLE_FLASH_S) flashes.splice(i, 1);
  }

  // ── AUDIT NAV1 (the presentation): a battery of mine coming ready ─────────────────────────────────────────────────
  /** The boat at the helm the batteries were last read on, each side's loaded state then, and when each came ready. */
  let readyBoat = null;
  const loadedWas = new Map();
  const readyAt = new Map();
  /** A battery loaded: its clock run out, and a barrel battery with barrels to roll (the brace is no reload). */
  const loadedNow = (st, bat) => st.guns.left(bat.side) <= 0 && (bat.gun !== 'barrel' || st.guns.barrels > 0);
  /**
   * Each battery of my boat at the helm that comes ready this step: the gun captain's word from her side (NAVAL_SFX
   * ready) and its chip's flash (READY_FLASH_S) - a side loaded already when I take the helm says nothing.
   */
  function heardReady(boat) {
    if (boat !== readyBoat) { readyBoat = boat; loadedWas.clear(); readyAt.clear(); }
    if (!boat) return;
    const st = myBoatState(boat);
    const pose = boatPose(boat);
    for (const bat of batteriesOf(boat.hull)) {
      const now = loadedNow(st, bat);
      if (loadedWas.get(bat.side) === false && now) {
        readyAt.set(bat.side, clock);
        const m = bat.muzzles;
        const mid = m.reduce((a, p) => [a[0] + p[0] / m.length, a[1] + p[1] / m.length, a[2] + p[2] / m.length], [0, 0, 0]);
        sound(NAVAL_SFX.ready, toWorld(pose, mid), 0.8);
      }
      loadedWas.set(bat.side, now);
    }
  }

  /** One step of the sea's clocks (`d` at most FRAME_STEP_S): my boats, the rams, the traffic, the captains and the
   *  hulls kept apart, the raiders' reckoning, the others' ships eased, the boarding, the shots and the smoke. */
  // ── SHIP-LIFE: the harbours and the errands (systems/naval/shipLife.js) ────────────────────────────────────────────
  /** The known harbours, as the errands read them. */
  function knownHarbours() {
    const out = [];
    for (const h of harbours.values()) if (h.harbour) out.push({ key: h.key, harbour: h.harbour, free: (i) => berthFree(h.key, i) });
    return out;
  }
  /** Whether berth `i` of harbour `key` is free - no ship of my sea moored at it or coming in to it, and (AUDIT BAY A7)
   *  none lying still at it: another player's moored ship, whose errand never rides the word (a packet was berthed
   *  on one). `except`: a ship asking of her own berth (AUDIT HOLDINGS Q5 - an arriving ship's last look). */
  function berthFree(key, i, except = null) {
    for (const e of sea.values()) { const r = e.ship.errand; if (e.ship !== except && r && r.harbour === key && r.berth === i && (r.kind === 'moored' || r.kind === 'arrive')) return false; }
    const b = harbours.get(key)?.harbour?.berths[i];
    if (b) for (const e of sea.values()) if (e.ship !== except && e.ship.damage.state !== SHIP_STATES.sunk && (e.ship.speed ?? 0) < BERTH_WAY && Math.hypot(b.pos[0] - e.ship.pos[0], b.pos[1] - e.ship.pos[2]) <= BERTH_SNAP_M) return false;
    if (warping?.k === `${key}#${i}`) return false;   // AUDIT HOLDINGS Q5: the berth my ship is warped in to, from as far as DOCK_REACH_M
    return !(b && boatAtBerth(b, null));   // QUAYS: nor a boat of mine or another player's lying at it - none moors into her
  }
  /** QUAYS: a boat of mine or another player's (not `except`) lying at berth `b` - within BERTH_SNAP_M of it, mine under
   *  BERTH_WAY (one sailing by takes no berth). BERTH-HIDDEN: shown or not - mine out of sight (berthBoats), another's
   *  under its hidden owner (comeSailAwayPeers.js O4: it stands nowhere while he is at its helm, and is posed all along). */
  function boatAtBerth(b, except) {
    for (const m of berthBoats()) {
      if (m === except || Math.hypot(m.GameObject.position[0] - b.pos[0], m.GameObject.position[2] - b.pos[1]) > BERTH_SNAP_M) continue;
      const v = boatPose(m).velocity;
      if (Math.hypot(v[0], v[2]) < BERTH_WAY) return true;
    }
    for (const m of deps.pool?.peerBoats ?? []) if (m !== except && m.GameObject && Math.hypot(m.GameObject.position[0] - b.pos[0], m.GameObject.position[2] - b.pos[1]) <= BERTH_SNAP_M) return true;
    return false;
  }
  /** AUDIT SHIP-LIFE B1: the harbour I know a ship lies still at a berth of - another player's moored ship (her errand
   *  never rides the word), read off where she lies - or null. */
  function berthOf(ship) {
    if ((ship.speed ?? 0) >= BERTH_WAY) return null;
    for (const h of harbours.values()) if (h.harbour?.berths.some((b) => Math.hypot(b.pos[0] - ship.pos[0], b.pos[1] - ship.pos[2]) <= BERTH_SNAP_M)) return h;
    return null;
  }
  const atBerth = (ship) => !!berthOf(ship);
  /** HOLDINGS (bible/03-World/Holdings.md): the berth a ship of mine is brought round to from the Fleet page - of the
   *  harbours I know, the free one (berthFree's, and no boat of mine lying at it) nearest the player: its place on the
   *  sea's top and her bow along it. Null: no harbour known here, or every berth taken. QUAYS: her place alongside its
   *  quay for her own hull (`hull`; shipLife.js alongside) - she is brought round made fast at it. */
  function freeBerth(hull = HULL.Carrack) {
    const f = deps.feet?.();
    if (!f || DOCK_REFUSED.includes(hull)) return null;   // AUDIT HOLDINGS Q2: no quay takes a galley - the placing click
    let best = null, bestD = Infinity;
    for (const h of harbours.values()) {
      const berths = h.harbour?.berths ?? [];
      for (let i = 0; i < berths.length; i++) {
        const b = berths[i];
        if (!berthFree(h.key, i) || myBoats().some((m) => Math.hypot(m.GameObject.position[0] - b.pos[0], m.GameObject.position[2] - b.pos[1]) <= BERTH_SNAP_M)) continue;
        const d = Math.hypot(b.pos[0] - f[0], b.pos[1] - f[2]);
        if (d < bestD) { const at = alongside(b, hull, h.harbour.hull); bestD = d; best = { position: [at[0], deps.seaY(), at[1]], direction: forwardOfYaw(b.yaw), harbour: h.name ?? null }; }
      }
    }
    return best;
  }
  // ── QUAYS: docking at a harbour's quays (systems/naval/quays.js; the quays themselves, scenes/quayPool.js) ─────────
  /** The harbours I know with their berths (the book's - its berths moved with the world in place, harbourBook.js
   *  offsetAll). HARBOUR-BOOK: the world's quays read the world's book itself, whether my sea runs or not. */
  function harbourList() { return harbours.list(); }
  /** Whether berth `i` of harbour `key` is free for `boat` to dock at: no ship of the sea moored at it or lying still by
   *  it, no other boat (mine, another player's) lying at it. A ship only coming in to it is put off it (dockAt). */
  function dockFree(key, i, boat) {
    const b = harbours.get(key)?.harbour?.berths[i];
    if (!b) return false;
    for (const e of sea.values()) {
      const r = e.ship.errand;
      if (r && r.harbour === key && r.berth === i && r.kind === 'moored') return false;
      if (e.ship.damage.state !== SHIP_STATES.sunk && (e.ship.speed ?? 0) < BERTH_WAY && Math.hypot(b.pos[0] - e.ship.pos[0], b.pos[1] - e.ship.pos[2]) <= BERTH_SNAP_M) return false;
    }
    return !boatAtBerth(b, boat);
  }
  /** Every berth I know, for quays.js dockFor - `free` false where another lies at it (`taken` false: asked of where she
   *  lies now, whoever else is by). */
  function dockBerths(boat, taken = true) {
    const out = [];
    for (const h of harbours.values()) {
      const bs = h.harbour?.berths;
      if (!bs) continue;
      for (let i = 0; i < bs.length; i++) out.push({ key: h.key, index: i, berth: bs[i], hull: h.harbour.hull, name: h.name ?? null, free: !taken || dockFree(h.key, i, boat) });
    }
    return out;
  }
  const portWords = (name) => (name ? `${name}'s quay` : 'the quay');
  /** Where my boat lies made fast - her dock (quays.js dockFor's, with the berth's own) - or null. Asked of where she
   *  lies, whoever else is by. */
  function dockOf(boat) {
    if (!boat?.GameObject) return null;
    const p = boat.GameObject.position, yaw = yawOfRot(boat.GameObject.rotation);
    const d = dockFor({ pos: p, yaw, hull: boat.hull }, dockBerths(boat, false));
    if (!d || !madeFast({ pos: p, yaw }, d)) return null;
    return { ...d, berth: harbours.get(d.key)?.harbour?.berths[d.index] ?? null, harbourHull: harbours.get(d.key)?.harbour?.hull };
  }
  /** The port my boat lies made fast at, by name ('' for an unnamed one), or null. */
  const dockedAt = (boat) => { const d = dockOf(boat); return d ? d.name ?? '' : null; };
  /** A ship coming in to a berth I dock at goes to another free berth of its harbour, or keeps her own cruise. */
  function putOff(key, i) {
    const bs = harbours.get(key)?.harbour?.berths ?? [];
    for (const e of sea.values()) {
      const r = e.ship.errand;
      if (r?.kind !== 'arrive' || r.harbour !== key || r.berth !== i) continue;
      const other = bs.findIndex((_, j) => j !== i && berthFree(key, j));
      e.ship.errand = other >= 0 ? { kind: 'arrive', harbour: key, berth: other, path: null, i: 0 } : null;
    }
  }
  let warping = null;   // { k: 'key#i', fast } - the berth my helm is warped in to, and whether she lies made fast at it
  /**
   * QUAYS - Come Sail Away's `warp` seam (the port's own): at the helm, her sails struck and no oar pulling, her way
   * under DOCK_WAY and no hostile ship near, her hands warp her in to a free berth's quay whose alongside place lies
   * within DOCK_REACH_M and her bow within DOCK_ANGLE of its line (quays.js dockFor) - this step's place and turn
   * (`{ pos: [x, z], rotation }`, warpStep's), her way off; null leaves her to her helm. Said once as she is taken in,
   * and once made fast.
   */
  function warp(boat, { struck = false, oars = false, dt = 0 } = {}) {
    // SERPENT1: in the sea serpent's coil she is held where it took her, her way off and her helm dead
    const held = enabled && boat ? deps.serpent?.hold?.(boat) ?? null : null;
    if (held) { warping = null; return { pos: held.pos, rotation: quatOfYaw(held.yaw) }; }
    const pose = boat ? boatPose(boat) : null;
    if (!enabled || !pose || !struck || oars || boarding || Math.hypot(pose.velocity[0], pose.velocity[2]) > DOCK_WAY || hostileNearMe()) { warping = null; return null; }
    const yaw = yawOfRot(pose.rotation);
    const dock = dockFor({ pos: pose.position, yaw, hull: boat.hull }, dockBerths(boat));
    if (!dock) { warping = null; return null; }
    const k = `${dock.key}#${dock.index}`;
    if (warping?.k !== k) {
      warping = { k, fast: madeFast({ pos: pose.position, yaw }, dock) };
      putOff(dock.key, dock.index);
      if (!warping.fast) deps.say?.(`Your crew brings the ship in alongside ${portWords(dock.name)}.`, 3);
    } else if (!warping.fast && madeFast({ pos: pose.position, yaw }, dock)) {
      warping.fast = true;
      deps.say?.(`Moored at ${portWords(dock.name)}.`, 3);
    }
    const step = warpStep([pose.position[0], pose.position[2]], yaw, dock, dt);
    return { pos: step.pos, rotation: quatOfYaw(step.yaw) };
  }
  /** The gangway run out to a boat of mine made fast at a quay, square to her side at her waist (quays.js gangwayFoot -
   *  AUDIT HOLDINGS Q1: never through her): its head at her main deck's port or on her gunwale (gangwaySide), its foot
   *  on the quay; `deckAt` her main deck's rail cell by it (navalDeck.js rail), where the player comes over her side;
   *  `ashore` where he steps off it onto the quay's deck - scene points - or null. AUDIT HOLDINGS Q9: none onto a quay
   *  not yet laid (`deps.quayLaid` - a plank over the water, a step ashore into the sea). */
  function gangwayOf(boat) {
    const d = dockOf(boat);
    if (!d?.berth || !boat.MeshObject) return null;
    if (deps.quayLaid && !deps.quayLaid(d.key, d.index)) return null;
    const deck = deps.pool?.deckOf?.(boat.hull, boat.variant ?? 0);
    const side = quaySide(yawOfRot(boat.GameObject.rotation), landwardOf(d.berth));
    const m = boat.MeshObject.worldMatrix();
    const [sx, sy] = gangwaySide(boat.hull);
    const head = outOfDeck(m, [side * sx, sy, 0]);
    const rail = deck?.count ? deck.rail(side, 0, [0, 0, 0], mainLevel(deck)) : null;
    const deckAt = rail ? outOfDeck(m, rail) : head;
    const frame = quayFrame(d.berth, d.harbourHull), seaY = deps.seaY();
    const x0 = frame.halfWidth + QUAY_GAP, x1 = x0 + QUAY_WIDTH;
    const [hx, hz] = sceneToQuay(frame, head[0], head[2]);
    const f = gangwayFoot(hx, head[1] - seaY, x0, x1);
    const [fx, fz] = quayToScene(frame, f.x, hz);
    const [ax, az] = quayToScene(frame, f.x > x0 ? Math.min(f.x + 0.6, x1 - 0.4) : x0 + 1.6, hz);   // past a climbing plank's foot, else in from the kerb
    return { boat, name: deps.shipName?.(boat) || null, port: d.name ?? null, foot: [fx, seaY + f.y, fz], head, deckAt, ashore: [ax, seaY + QUAY_DECK_UP, az], landward: landwardOf(d.berth) };
  }
  /** The gangways run out now: every boat of mine shown in the world and made fast. */
  function gangways() {
    const out = [];
    for (const b of myBoats()) { const g = gangwayOf(b); if (g) out.push(g); }
    return out;
  }
  /** The gangway the player can take now, on foot: on the quay by its foot, looking at her - aboard; on her deck by her
   *  rail there (GANGWAY_ASHORE - AUDIT HOLDINGS Q4), looking at the quay - ashore. `{ ...gangway, way }` or null.
   *  `looking` false: by it, wherever the look (its word's - said once a coming, never again as the look swings). */
  function gangwayInReach(looking = true) {
    if (myBoat() || boarding) return null;
    const feet = deps.feet?.();
    if (!feet) return null;
    const look = looking ? deps.look?.() : null;
    const lf = look ? flatUnit(look.dir) : null;
    const facing = (dir) => !lf || lf[0] * dir[0] + lf[2] * dir[1] >= GANGWAY_FACING;
    for (const g of gangways()) {
      if (standsOn(g.boat, feet)) {
        if (Math.hypot(g.deckAt[0] - feet[0], g.deckAt[2] - feet[2]) <= GANGWAY_ASHORE && facing(g.landward)) return { ...g, way: 'ashore' };
      } else if (Math.hypot(g.foot[0] - feet[0], g.foot[2] - feet[2]) <= GANGWAY_REACH && Math.abs(feet[1] - g.foot[1]) <= 2 && facing([-g.landward[0], -g.landward[1]])) return { ...g, way: 'aboard' };
    }
    return null;
  }
  /** Take the gangway: aboard, over her rail across from where I stand (the boarding's own landing); ashore, onto the
   *  quay by its foot, facing the land. */
  function takeGangway(g) {
    if (g.way === 'aboard') {
      const at = deps.board?.landing?.(g.boat, g.foot) ?? null;
      const spot = at ?? [g.deckAt, Math.atan2(-g.landward[0], -g.landward[1])];   // her rail's deck point, facing inboard
      deps.board?.placePlayer?.(spot[0], spot[1]);
      deps.say?.(`You go aboard${g.name ? ` the ${g.name}` : ''}.`, 2);
    } else {
      deps.board?.placePlayer?.([...g.ashore], Math.atan2(g.landward[0], g.landward[1]));
      deps.say?.(`You step ashore at ${portWords(g.port)}.`, 2);
    }
    return true;
  }
  let gangwaySaid = null;   // the gangway the player was last told of, so it is said once a coming to it
  /** The gangway's word, once each time the player comes to it. */
  function gangwayHint() {
    const g = gangwayInReach(false);
    const k = g ? `${g.way}:${g.boat.uid ?? ''}` : null;
    if (k && k !== gangwaySaid) deps.say?.(g.way === 'aboard' ? `The gangway${g.name ? ` to the ${g.name}` : ''} - Activate to go aboard.` : 'The gangway. Activate to step ashore.', 3);
    gangwaySaid = k;
  }
  // ── PASSAGE (2026-10-19; bible/03-World/Passage.md): a harbour's own friendly ship, booked from her quay - the sea's half
  // in scenes/naval/passageBerths.js (AUDIT PASSAGE D-M1: out of this scope), the voyage scenes/naval/passageHost.js's ──
  const { passageShip, passageHint, charter, charterSailed, goneSeed, goneSaid, hearGone } = createPassageBerths({ sea, harbours, enabled: () => enabled, boarding: () => boarding, myBoat, csa, stanceOf, drop, adopt, retire, departedOf, day: () => where().day ?? 0, hullBox }, deps);
  let dockPortsAt = -Infinity;
  /** The Fleet's word of where each boat of mine lies made fast (`deps.dockedPort(boat, name | null)`), once a second -
   *  AUDIT HOLDINGS Q8: "nowhere" said only where it is known - a known harbour's mouth within HARBOUR_STAND of her, or
   *  she under way; a harbour forgotten (a door, a jump) or never sounded leaves the last word standing. */
  function dockPorts() {
    if (!deps.dockedPort || clock - dockPortsAt < 1) return;
    dockPortsAt = clock;
    for (const b of myBoats()) {
      const at = dockedAt(b);
      if (at != null) { deps.dockedPort(b, at); continue; }
      const p = b.GameObject.position, v = boatPose(b).velocity;
      const known = [...harbours.values()].some((h) => h.harbour && Math.hypot(h.harbour.mouth[0] - p[0], h.harbour.mouth[1] - p[2]) <= HARBOUR_STAND);
      if (known || Math.hypot(v[0], v[2]) > DOCK_WAY) deps.dockedPort(b, null);
    }
  }
  /** A hull's water grid, made once for the scene as it stands. */
  function gridOf(hull) {
    let g = grids.get(hull);
    if (!g) { g = createWaterGrid({ isWater: (x, z, h) => deps.isWater(x, z, h), hull }); grids.set(hull, g); }
    return g;
  }
  /** The errands' door for the captains (navalAI.js stepCaptain's `world.life`). */
  const life = { harbour: (k) => harbours.get(k)?.harbour ?? null, grid: gridOf, free: berthFree, harbours: knownHarbours };
  /** A ship's errand drawn where she is (shipLife.js errandFor) - none while no harbour is known: the sea's traffic far
   *  from a port keeps its cruise. */
  function errandHere(ship) {
    const hs = knownHarbours();
    return hs.length ? errandFor({ seed: ship.seed, faction: ship.cls.faction, hull: ship.hull, pos: ship.pos, speed: ship.speed, clock: ship.clock, harbours: hs, clear: gridOf(ship.hull).clear }) : null;
  }
  /** The port near the player: its harbour found once, its moored ships stood while its mouth is near - ashore too;
   *  the stander's alone to launch, as every ship is - and gone past HARBOUR_LEAVE, to be stood again the same on the
   *  player's return (those that sailed today not again). */
  function harbourFrame(seaY) {
    // AUDIT HOLDINGS O1, AUDIT SHIP-LIFE B7: sounded once its ground is built, again after a sounding that found none -
    // HARBOUR-BOOK: by the world each frame, or here off a book of my own
    if (ownBook) harbours.step(clock);
    const feet = deps.feet();
    const day = where().day ?? 0;
    for (const h of harbours.values()) {
      if (!h.harbour) continue;
      const departed = departedOf(h.key, day);
      const d = Math.hypot(h.harbour.mouth[0] - feet[0], h.harbour.mouth[1] - feet[2]);
      if (d > HARBOUR_LEAVE) {
        if (rolled.has(h.harbour)) for (const e of [...sea.values()]) if (!e.owner && e.fromHarbour === h.key && e.ship.errand?.kind === 'moored') retire(e);   // SHIP-FADE
        rolled.delete(h.harbour);
        continue;
      }
      if (d > HARBOUR_STAND || !rollsHarbour(h.harbour.mouth)) continue;
      const r = mulberry32(hash32(keyHash(h.key), day >>> 0, HARBOUR_SALT));
      const n = Math.min(h.harbour.berths.length, HARBOUR_ROLL[0] + Math.floor(r() * (HARBOUR_ROLL[1] - HARBOUR_ROLL[0] + 1)));
      const seedOf = (i) => hash32(keyHash(h.key), day >>> 0, i, HARBOUR_SALT);
      if (rolled.has(h.harbour)) {
        // AUDIT BAY A20: the port's own a player sailing off lets go of (out of their word) - taken over where they
        // lie by the one who rolls the port now (they faded out of their berths under my eyes, the roll long done)
        const own = new Set(Array.from({ length: n }, (_, i) => seedOf(i)));
        for (const e of [...sea.values()]) if (e.owner && e.retiring && own.has(e.ship.seed) && !goneSeed(e.ship.seed) && e.ship.damage.state === SHIP_STATES.afloat) { adopt(e); e.retiring = false; }   // AUDIT PASSAGE B5: never one booked
        continue;
      }
      rolled.add(h.harbour);
      for (let i = 0; i < n; i++) {
        const seed = seedOf(i);
        const navy = r() < HARBOUR_NAVY;   // the stream's draw kept, past the Veil as in the Bay
        const faction = navy && !where().ether ? 'navy' : 'merchant';   // AUDIT CAPTAIN'S SEA D4: no crown's navy past the Veil - a freeport's quay the isles' traders'
        let cls = classFor(faction, HARBOUR_LEVEL, r());   // AUDIT SHIP-LIFE B3: the port's level, never a player's
        if (cls?.hull === HULL.LargeGalley) cls = classFor(faction, 1, r());   // a galley rows in and out, never moors
        // SHIP-FADE: one of these still fading out at her berth (the port left and come back to within SHIP_FADE_S) stays
        const back = [...sea.values()].find((x) => !x.owner && x.retiring && x.ship.seed === seed && x.fromHarbour === h.key);
        if (back) { back.retiring = false; continue; }
        // AUDIT SHIP-LIFE B3: her seed anyone's already (another's copy of her, whatever class it drew) - not stood again
        if (!cls || departed.has(seed) || goneSeed(seed) || [...sea.values()].some((x) => x.ship.seed === seed && x.ship.damage.state !== SHIP_STATES.sunk) || !berthFree(h.key, i)) continue;
        const b = h.harbour.berths[i], at = alongside(b, cls.hull, h.harbour.hull);   // QUAYS: her side to its quay
        const e = launch({ seed, classId: cls.id, variant: 0, pos: [at[0], seaY, at[1]], yaw: b.yaw, errand: { kind: 'moored', harbour: h.key, berth: i, until: dwellOf(errandRng(seed)), path: null, i: 0 } });
        if (e) { e.fromHarbour = h.key; e.ship.sails = 0; e.ship.sailsWant = 0; }
      }
    }
  }

  /** NAV-FAR-AI: her captain's step this frame - every frame near, in a fight, lashed or not afloat; past FAR_WATCH_M of
   *  the eye every FAR_LIFE_EVERY frames on the time she missed (a far captain's leftover kept for her first frame near). */
  function keepWatch(e, d, world, eye, fought) {
    const s = e.ship;
    const owed = e.watchDt ?? 0;
    // the time she missed is never more than FRAME_STEP_S at once (the sea's own step): owed and this frame's together
    // past it, what she owes is kept first, and this frame's waits for her next watch
    if (owed > 0 && owed + d > FRAME_STEP_S) { e.watchDt = d; return stepCaptain(s, { ...world, dt: owed }); }
    if (!watchesFar(e, eye, fought)) { e.watchDt = 0; return stepCaptain(s, owed > 0 ? { ...world, dt: owed + d } : world); }
    e.watchDt = owed + d;
    e.watchN = ((e.watchN ?? e.n) + 1) % FAR_LIFE_EVERY;   // each ship on her own frame of the stride (her number's)
    if (e.watchN !== 0) return NO_WATCH;
    e.watchDt = 0;
    return stepCaptain(s, { ...world, dt: owed + d });
  }

  function stepSea(d, seaY, boat) {
    clock += d;
    // my boats: their clocks, the brace, their fires
    // AUDIT NAV1 (the helm): her hands mend her between fights - no hostile ship near, nothing struck her lately (a fire
    // aboard strikes her every step it burns: navalDamage.js step). AUDIT NAV2 F29: near HER - over the side or ashore
    // (no longer aboard: hostileNear false) the fight she lies in went on and she mended in it
    mending = false;
    const inPlay = boatInPlay();   // QUICK-REPAIRS: the boat I am on - her repairs said, a crewless one's made
    for (const b of myBoats()) {
      const s = myBoatState(b);
      s.guns.step(d);
      s.guns.braced = b === boat && braceHeld;
      s.damage.step(d, clock);
      const hostile = hostileNearBoat(b, s);
      crewStep(b, s, d, hostile);   // SHIP-CREW
      s.repairing = false;
      const quiet = clock - s.damage.lastHitAt >= FIELD_QUIET_S && !hostile;
      if (quiet) {
        const m = fieldMend(s.damage, d, { crewed: !!b.crewed, crewShare: s.damage.crewShare(), scale: b.crewed ? mendScaleOf(s.crew.morale) * (s.worth?.mend ?? 1) : 1 });   // CAPT-CREW: her Carpenter's worth
        if (m.hull > 0 || m.sail > 0) {
          s.damage.repair({ hull: m.hull, sail: m.sail, crew: 0 }, { refloat: FIELD_REFLOAT });
          if (b === boat) mending = true;
        }
      }
      // SEA-REPAIR, QUICK-REPAIRS: the order's repairs - in the quiet at their pace, with an enemy near (DAMAGE CONTROL) at a
      // share of it; a fire aboard or a ball lately in her with none near, the quiet waited for. None given, once the fight
      // is over her hands spend her stores on their own past the free mending (AutoRepair) - a boat with no hand aboard
      // only under her captain's own, the boat I am on
      if (s.crew.order === CREW_ORDERS.repair) { if (quiet || hostile) repairStep(b, s, d, { underFire: hostile, inPlay }); }
      else if (quiet && autoRepair() && ((b.crewed && s.damage.crew > 0) || b === inPlay)) repairStep(b, s, d, { auto: true, inPlay });
    }
    heardReady(boat);
    harbourFrame(seaY);   // SHIP-LIFE: the port near the player - ashore too
    dockPorts(); gangwayHint(); passageHint();   // QUAYS: where my boats lie made fast, the Fleet's word of it, and the gangway's; PASSAGE: a berth's ship to book

    // the sea's traffic, when this player is on the water: new ships the stander's alone to launch - AUDIT NAV1
    // (online): its seeds salted with its id (two standers launched twins), and the whole shared sea near me counted
    // against the density - and every player's own let go out of sight, standing or not (two standers met: six ships,
    // and the one who stopped standing kept three for good)
    const onWater = !!boat || deps.isWater(deps.feet()[0], deps.feet()[2], 0);
    if (onWater) {
      const w = where();
      const crown = crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1);
      const feet = deps.feet();
      const players = [feet, ...(deps.online?.peers?.() ?? []).map((p) => p.feet)];
      const ships = [];
      for (const e of sea.values()) {
        const afloat = e.ship.damage.state === SHIP_STATES.afloat;
        // AUDIT NAV1 (B1): engaged while she fights, comes alongside or is boarded - a prize, a struck hulk or a boarding
        // given up is let go once out of sight - and only a ship afloat counts against the density; NAV-R: a raider is
        // its own law's to despawn (raiders()), and counts in the density. AUDIT NAV2 F23: she fights only AFLOAT - two
        // struck to each other kept each other for ever, each the other's taker by a stale target
        if (!e.owner) ships.push({ id: e.id, pos: e.ship.pos, classId: e.ship.cls.id, engaged: (afloat && (e.ship.mode === 'engage' || e.ship.mode === 'board')) || boarding?.shipId === e.id || !!e.raider || !!e.liner || !!e.takenBy || !!e.ship.lashed || (!!e.fromHarbour && e.ship.errand?.kind === 'moored'), afloat, berthed: e.ship.errand?.kind === 'moored' });   // SEA-LANES: a packet is her lane's to let go, and counts in the density   // AUDIT SHIP-LIFE B2: a harbour's moored ship is the harbour's to drop (past HARBOUR_LEAVE), never the director's   // SHIP-LIFE: a harbour's own, apart from the sea's density
        else if (e.orphan == null && dist2d(e.ship.pos, feet) <= DESPAWN_BEYOND) ships.push({ id: e.id, pos: e.ship.pos, classId: e.ship.cls.id, theirs: true, afloat, berthed: atBerth(e.ship) });   // AUDIT SHIP-LIFE B1: another's moored ship is no more the sea's traffic than mine
      }
      // AUDIT NAV2 F27: and a ship is in a fight while an engaged ship of mine targets her - SEA-PEACE's prize her taker
      // comes for or takes, and a quarry running (let go from under the pursuer kept for her)
      const chased = new Set(ships.filter((y) => y.engaged && !y.theirs).map((y) => sea.get(y.id)?.ship.target));
      for (const x of ships) if (!x.theirs && chased.has(x.id)) x.engaged = true;
      const relieving = [...sea.values()].some((e) => e.relief && !e.owner && e.ship.damage.state === SHIP_STATES.afloat);   // SEA-EASE
      const distress = relieving || w.ether ? null : distressAt(crown.name);   // ETHER-SEA: no navy past the Veil
      const out = director.step(d, {
        density: launchesTraffic() ? trafficDensity(feet) : 0, player: feet, players, level: deps.level?.() ?? 1, seaY, ships,   // SEA-TRAFFIC
        // AUDIT NAV1 (online #6): the waters draw the navy after the most notorious player in them, not the stander alone
        isOpenWater: (x, z, hull) => deps.isWater(x, z, hull), nearPort: !!w.nearPort, deep: w.waters === 'deep', notoriety: Math.max(notoriety.get(crown.name), ...[...peerSelf.values()].map((p) => p.law?.[crown.name] ?? 0)),
        seedBase: seedBaseOf(w.px ?? 0, w.py ?? 0, w.day ?? 0, SEED_SALT ^ idSalt(myId())),
        distress, relieving,   // SEA-EASE: THE RELIEF
        reliefSure: !!distress && !!deps.captain?.reliefSure?.(crown.name),   // CAPT-BOARD: an Admiral's crown always answers
        ether: etherCtx(w),   // ETHER-SEA: the Eltheric Ocean's band, and the legend whose haunt it is
        legends: [...sea.values()].filter((e) => e.legend && e.ship.damage.state !== SHIP_STATES.sunk).map((e) => e.legend),   // AUDIT CAPTAIN'S SEA D7: at any range, any stander's
      });
      for (const id of out.despawn) { const e = sea.get(id); if (e) retire(e); }   // SHIP-FADE: she sails out of the world
      if (out.spawn) {
        const e = launch(out.spawn);
        // SHIP-LIFE: a ship crossing the player's waters near a port goes somewhere - the hunter and a pair already at
        // it are about their fight; SEA-EASE: and a relief sails for the player she was sent to
        if (e && !out.spawn.hunter && !out.spawn.encounter && !out.spawn.relief) e.ship.errand = errandHere(e.ship);
        if (e && out.spawn.relief && distress) { e.relief = true; e.ship.course = [distress[0], distress[2]]; }
        if (out.spawn.company) launch(out.spawn.company);   // SEA-PEACE: two ships already at it
      }
    } else director.reset();

    // the captains of the ships I stand
    const night = !!where().night;   // SHIP-WATCH: the dark hours - AUDIT WK-N5: DFU's own night (worldClock isNight), not the lanterns' 17:00-07:59
    const world = {
      now: clock, dt: d, seaY, wind: wind(), isWater: (x, z, hull = HULL.SmallShip) => deps.isWater(x, z, hull), contacts: contacts(),
      notoriety: (c) => notoriety.get(c), random, boarders: setting('Boarders', true) !== false, gunfire,   // SEA-PEACE: the guns a navy hears
      life,   // SHIP-LIFE: the harbours and the water her errand sails by
      night,   // SHIP-WATCH: the dark hours - a lit ship seen far, a dark one close
    };
    life.night = night;   // SHIP-WATCH: a merchantman waits at her berth for the morning; a pirate lurks nearer the mouth
    // NAV-FAR-AI: the eye the far captains are measured from, and the ships a fight targets
    const watchEye = deps.look?.()?.origin ?? deps.feet();
    let fought = null;
    for (const e of [...sea.values()]) {
      if (e.owner) continue;
      const s = e.ship;
      if (s.damage.state === SHIP_STATES.sunk) { quarryGone(e); drop(e); continue; }
      const was = s.damage.state;
      if (boarding?.shipId === e.id) { const change = s.damage.step(d, clock); if (change) stateChanged(e, was, change, e.fireBy ?? null); continue; }
      const out = keepWatch(e, d, world, watchEye, () => (fought ??= foughtIds()));
      if (e.fromHarbour && s.errand?.kind !== 'moored') { departedOf(e.fromHarbour, where().day ?? 0).add(s.seed); e.fromHarbour = null; }   // SHIP-LIFE: sailed - not stood at her berth again today
      // AUDIT CAPTAIN'S SEA D17: a legend of the night is abroad between dusk and dawn alone - day come, she sails out of
      // the world once no fight holds her (she fought on in the sun)
      if (e.legend && !night && !e.retiring && s.damage.state === SHIP_STATES.afloat && s.mode !== 'engage' && s.mode !== 'board' && legendOfClass(s.cls.id)?.trait === 'night') retire(e);
      // SEA-EASE: a relief keeps her course for the player until her lookout has a fight (sailing for the guns she hears
      // is not one - they may fall silent) or she is where they were; a crown's ship that takes on a pirate fighting me
      // says so, once
      if (e.relief && s.course && ((s.mode !== 'cruise' && s.mode !== 'answer') || dist2d(s.pos, [s.course[0], 0, s.course[1]]) <= RELIEF_REACHED_M)) s.course = null;
      if (!e.aidSaid && s.cls.faction === 'navy' && s.mode === 'engage' && sea.get(s.target)?.ship.target === myId()) { e.aidSaid = true; deps.say?.(`${calledName(e)} comes to your aid!`, 4); }
      const change = s.damage.step(d, clock);
      if (change) stateChanged(e, was, change, e.fireBy ?? null);   // AUDIT NAV1 (B4): her fires' own, announced and charged
      if (e.legend) legendMend(e, d);   // ETHER-LEGENDS: the Drowned Queen's timbers knit
      for (const side of out.runOuts) runOutTell(e, side);
      const pose = { position: s.pos, rotation: quatOfYaw(s.yaw), velocity: velocityOf(s), hull: s.hull };
      for (const v of out.volleys) { fire({ shooter: e.id, wireShooter: e.n, hull: s.hull, pose, solution: v.solution, skill: s.cls.skill }); noteInbound(e, v.side); }
      for (const bsol of out.barrels) fire({ shooter: e.id, wireShooter: e.n, hull: s.hull, pose, solution: bsol, skill: s.cls.skill });
      if (out.grapple && !boarding && boat && out.grapple === myId() && setting('Boarders', true) !== false) startBoarding('repel', e, boat);
      else if (out.grapple && out.grapple !== myId() && peerSelf.has(out.grapple) && clock - e.grappleAt >= GRAPPLE_CLAIM_S) {
        // AUDIT NAV1 (online #10): alongside another player's boat - her grapnels said to them (GRAPPLE_CLAIM_S apart);
        // theirs to take her over
        e.grappleAt = clock;
        deps.sendHit?.(navalHitData(out.grapple, { n: e.n, grapple: true }));
      } else if (out.grapple && out.grapple !== myId() && sea.has(out.grapple) && !s.lashed) lashPrize(e, sea.get(out.grapple));   // SEA-PEACE: alongside the ship that struck to her
    }
    stepPrizes();
    checkShipRams();
    separateHulls();
    // NAV-R: a raider of mine sunk, struck, taken or boarding, or one that chased me and lost me, is spent for its life
    for (const e of sea.values()) {
      if (e.owner || !e.raider || e.raider.spent) continue;
      if (chasesMe(e)) e.raider.chased = true;
      const slipped = e.raider.chased && e.ship.mode === 'cruise';
      if (slipped || e.ship.boarded || boarding?.shipId === e.id || e.ship.damage.state !== SHIP_STATES.afloat) spendRaider(e, slipped);
    }
    // SEA-LANES: a packet sunk, struck, taken or boarded - no longer afloat - is spent for her voyage; AUDIT BAY A18:
    // another's too
    for (const e of sea.values()) if (e.liner && e.ship.damage.state !== SHIP_STATES.afloat) spendLiner(e);
    // AUDIT NAV1 (the presentation): a ship another player stands goes down on my clock as well as theirs - her sinking
    // run on between their words; one their word has let go of (`lost`, letGo) finishes going down, then is gone
    for (const e of [...sea.values()]) {
      if (!e.owner || e.ship.damage.state !== SHIP_STATES.sinking) continue;
      if (e.ship.damage.sinkOn(d) && e.lost) drop(e);
    }
    // the others' ships: eased toward their word - PUPPET-GLIDE: under way, sailed on and caught up to it
    for (const e of sea.values()) {
      if (!e.owner || !e.target || boarding?.shipId === e.id) continue;
      const tgt = e.target;
      // AUDIT NAV1 (online): where her word puts her now - sailed on along her course at her way since it was said,
      // PREDICT_MAX_S at most (an orphan's or a stale word's course is not run on forever)
      const ahead = e.orphan == null && e.ship.damage.state === SHIP_STATES.afloat ? (tgt.speed ?? 0) * Math.min(PREDICT_MAX_S, clock - (tgt.at ?? clock)) : 0;
      const at = [tgt.pos[0] + Math.sin(tgt.yaw) * ahead, tgt.pos[1], tgt.pos[2] + Math.cos(tgt.yaw) * ahead];
      if (dist2d(e.ship.pos, at) > PUPPET_SNAP_M) { e.ship.pos = at; e.ship.yaw = tgt.yaw; continue; }
      const k = 1 - Math.exp(-PUPPET_EASE * d);
      e.ship.yaw = wrapAngle(e.ship.yaw + wrapAngle(tgt.yaw - e.ship.yaw) * k);
      if (e.orphan != null || e.ship.damage.state !== SHIP_STATES.afloat || !((tgt.speed ?? 0) > 0)) {   // lying still, struck, going down, or her stander gone: eased onto her word
        e.ship.pos = [e.ship.pos[0] + (at[0] - e.ship.pos[0]) * k, at[1], e.ship.pos[2] + (at[2] - e.ship.pos[2]) * k];
        continue;
      }
      // PUPPET-GLIDE: under way she sails on at her word's way along her own heading (none once the word is
      // PREDICT_MAX_S old), and what the word says she is off by is taken up at PUPPET_CATCH a second, never faster than
      // PUPPET_CATCH_MPS + PUPPET_CATCH_SHARE of her way
      const v = clock - (tgt.at ?? clock) < PREDICT_MAX_S ? tgt.speed : 0;
      let x = e.ship.pos[0] + Math.sin(e.ship.yaw) * v * d, z = e.ship.pos[2] + Math.cos(e.ship.yaw) * v * d;
      const ex = at[0] - x, ez = at[2] - z, off = Math.hypot(ex, ez);
      if (off > 1e-9) {
        const take = Math.min(off * (1 - Math.exp(-PUPPET_CATCH * d)), (PUPPET_CATCH_MPS + PUPPET_CATCH_SHARE * v) * d) / off;
        x += ex * take; z += ez * take;
      }
      e.ship.pos = [x, at[1], z];
    }
    stepBoarding(d);
    for (const e of sea.values()) glintRunOut(e, d, seaY);
    shots.step(d);
    effects.step(d);
  }

  /** A ship of mine coming for me: fighting me, or coming alongside to board. */
  const chasesMe = (e) => (e.ship.mode === 'engage' || e.ship.mode === 'board') && e.ship.target === myId();

  // ── hulls kept apart, and a galley's ram (AUDIT NAV1) ──────────────────────────────────────────────────────────────
  // (a hull on the flat and the push out of another - flatHull, hullOverlap - stand at the module's top: SERPENT4's bumpers read them too)
  /**
   * Every sea ship of mine that stands in another hull - a ship of mine, another player's, one of my boats - is pushed
   * out along the shallowest axis (two of mine share it), and the way she made into it is taken off her.
   */
  function separateHulls() {
    const list = [];
    for (const e of sea.values()) {
      if (boarding?.shipId === e.id || e.ship.damage.state === SHIP_STATES.sunk) continue;
      list.push({ ship: e.ship, movable: !e.owner, pos: e.ship.pos, yaw: e.ship.yaw, hull: e.ship.hull });
    }
    for (const b of myBoats()) list.push({ ship: null, movable: false, pos: b.GameObject.position, yaw: yawOfRot(b.GameObject.rotation), hull: b.hull });
    if (list.length < 2) return;
    // NAV-COST (2026-10-12): a hull on the flat made once a pass (again once it is shoved), and two whose centres stand
    // farther apart than twice their reaches never measured - every pair of the sea's was, every frame, two new flats
    // each, and nearly all of them hundreds of km apart. hullOverlap's answer for them is null: a hull's half extent
    // along any axis is under its half length and half width together, and one of A's own axes holds at least 1/sqrt 2
    // of the distance between the centres - so past twice the reaches some axis separates them.
    const flatOf = (x) => (x.flat ??= flatHull(x.pos, x.yaw, x.hull));
    const shove = (x, v) => {
      x.flat = null;
      x.ship.pos[0] += v[0]; x.ship.pos[2] += v[1];
      const l = Math.hypot(v[0], v[1]) || 1, f = forwardOfYaw(x.ship.yaw);
      const into = -(f[0] * v[0] + f[2] * v[1]) / l;   // her heading into what she met
      if (into > 0) x.ship.speed *= clamp(1 - into, 0, 1);
    };
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        if (!A.movable && !B.movable) continue;
        const a = flatOf(A), b = flatOf(B), reach = 2 * (a.hl + a.hw + b.hl + b.hw), dx = b.c[0] - a.c[0], dz = b.c[1] - a.c[1];
        if (dx * dx + dz * dz > reach * reach) continue;
        const push = hullOverlap(a, b);
        if (!push) continue;
        if (A.movable && B.movable) { shove(A, [push[0] / 2, push[1] / 2]); shove(B, [-push[0] / 2, -push[1] / 2]); }
        else if (A.movable) shove(A, push);
        else shove(B, [-push[0], -push[1]]);
      }
    }
  }
  /** SERPENT4: the drift `d` (or null) with the ships' bumpers added while the sea serpent's waters are about me
   *  (bumperDrift - every other player's ship at her helm, as the peers' pool poses her). */
  function withBumpers(boat, d) {
    if (!deps.serpent?.near?.()) return d;
    const pose = boatPose(boat);
    const others = [];
    for (const p of deps.peerBoats?.() ?? []) if (p.boat !== boat && Array.isArray(p.pos) && Number.isInteger(p.hull)) others.push(flatHull(p.pos, p.yaw ?? 0, p.hull));
    const b = others.length ? bumperDrift(flatHull(pose.position, yawOfRot(pose.rotation), boat.hull), others) : null;
    return b ? (d ? [d[0] + b[0], 0, d[2] + b[2]] : b) : d;
  }
  /** A galley of mine that strikes a hull with her ram at RAM_SPEED or more: the ram's own law, the player's boats
   *  and the sea's ships alike - my boats take it on my client (the victim's law), a ship of mine is struck. */
  function checkShipRams() {
    for (const e of sea.values()) {
      const s = e.ship;
      if (e.owner || !hullBuild(s.hull).ram || s.damage.state !== SHIP_STATES.afloat || s.speed < RAM_SPEED) continue;
      if (clock - (e.rammedAt ?? -Infinity) < RAM_COOLDOWN_S) continue;
      const f = forwardOfYaw(s.yaw), bowZ = hullBuild(s.hull).bowZ;
      const bow = [s.pos[0] + f[0] * bowZ, deps.seaY() + 1, s.pos[2] + f[2] * bowZ];
      const inBox = (box) => {
        const l = [bow[0] - box.c[0], bow[1] - box.c[1], bow[2] - box.c[2]];
        return Math.abs(l[0] * box.ax[0] + l[1] * box.ax[1] + l[2] * box.ax[2]) <= box.h[0] + 1 && Math.abs(l[0] * box.az[0] + l[1] * box.az[1] + l[2] * box.az[2]) <= box.h[2] + 1;
      };
      for (const b of myBoats()) {
        const box = hullBox(b);
        if (!box || !inBox(box)) continue;
        const v = boatPose(b).velocity;
        const closing = s.speed - (v[0] * f[0] + v[2] * f[2]);
        if (closing < RAM_SPEED) continue;
        e.rammedAt = clock;
        const st = myBoatState(b);
        const dealt = Math.round(closing * RAM_DAMAGE * GALLEY_RAM * (st.guns.braced ? BRACE_TAKEN : 1));
        st.damage.apply({ hull: Math.round(dealt * captainsDue().hull), sail: 0, crew: ramMen(dealt, random(), PLAYER_CREW_TOUGHNESS) }, clock);   // CREW-HOLD: my boat's crew; SEA-SET: the Captain's Due on her hull
        effects.hit(bow, f, true);
        sound(NAVAL_SFX.hit, bow, 1);
        deps.shake?.(3.5);
        deps.mid?.(`${s.names?.name ?? 'A galley'} rams you!`, 2);
        s.damage.apply({ hull: Math.round(dealt * RAM_RECOIL / GALLEY_RAM), sail: 0, crew: 0 }, clock);
        break;
      }
      if (clock - (e.rammedAt ?? -Infinity) < RAM_COOLDOWN_S) continue;
      for (const t of sea.values()) {
        if (t === e || !t.boat || t.owner || t.ship.damage.state === SHIP_STATES.sunk || boarding?.shipId === t.id) continue;
        const box = hullBox(t.boat);
        if (!box || !inBox(box)) continue;
        const tv = velocityOf(t.ship);
        const closing = s.speed - (tv[0] * f[0] + tv[2] * f[2]);
        if (closing < RAM_SPEED) continue;
        e.rammedAt = clock;
        const dealt = Math.round(closing * RAM_DAMAGE * GALLEY_RAM);
        effects.hit(bow, f, true);
        sound(NAVAL_SFX.hit, bow, 1);
        // AUDIT NAV2 F26: a sound ship is rammed to her strike, never under it - one blow sank a prize outright (the rest
        // of a volley is floored only once she has struck: strike's STRUCK_GRACE_S)
        const td = t.ship.damage;
        const room = td.state === SHIP_STATES.afloat && td.hullShare() > STRUCK_AT ? Math.ceil(td.hull - td.maxHull * STRUCK_AT) : Infinity;
        strike(t, { hull: Math.min(dealt, room), sail: 0, crew: ramMen(dealt, random()) }, e.id);
        s.damage.apply({ hull: Math.round(dealt * RAM_RECOIL / GALLEY_RAM), sail: 0, crew: 0 }, clock);
        break;
      }
    }
  }

  // ── the others (NAV-G) ───────────────────────────────────────────────────────────────────────────────────────────
  /** My word: the ships I stand, my recent volleys and barrels. */
  function word(toWire) {
    const ships = [...sea.values()].filter((e) => !e.owner).map((e) => ({
      n: e.n, classId: e.ship.cls.id, variant: e.ship.variant, pos: e.ship.pos, yaw: e.ship.yaw, speed: e.ship.speed, sails: e.ship.sails,
      hull: e.ship.damage.hullShare(), sail: e.ship.damage.sailShare(), crew: e.ship.damage.crewShare(),
      state: e.ship.boarded && e.ship.damage.state === SHIP_STATES.struck ? 'boarded' : e.ship.damage.state, heel: e.ship.heel, seed: e.ship.seed, fire: e.ship.damage.fire > 0,   // RAM-BOARD (AUDIT 2026-10-17): a sound ship being boarded is said afloat - her captain's mode says 'boarded'
      runOut: [...e.ship.runOut.keys()].reduce((m, side) => m | (1 << SIDES.indexOf(side)), 0),
      gen: e.gen, region: e.region,
      // AUDIT NAV2 F1/F3/F5: her captain as I sail her - her temper (a raider's bold is mine, not her seed's), her mode
      // (her crew at battle on every screen) and the ship of mine she struck to (her victor, through a handover)
      temper: e.ship.temper, mode: e.ship.boarded ? 'boarded' : e.ship.mode, struckTo: e.struck && !sea.get(e.struck.by)?.owner ? sea.get(e.struck.by)?.n ?? -1 : -1,
      deep: e.deep,   // AUDIT CAPTAIN'S SEA D8: launched of the deep - her hold and her papers the deep's on every client
    }));
    // AUDIT NAV1 (online): my boat at sea and my notoriety - the captains another stands judge me by my own
    const b = boatInPlay(), st = b ? myBoatState(b) : null;
    // AUDIT NAV2 F2/F3: and her hands, her hull and whether she fights - every client sizes her to the man, as I do
    const me = st ? { hull: st.damage.hullShare(), crippled: st.damage.state === SHIP_STATES.wrecked, boarders: setting('Boarders', true) !== false,
      crew: st.damage.crew, battle: aiming || crewAlarm(), boatHull: b.hull } : null;   // AUDIT WK-W2: the alarm's own law
    // AUDIT NAV1 (online #15): each volley with its age, so a reader flies it from as far along as it is
    const volleys = wireVolleys.map((v) => ({ ...v, age: (clock - v.at) * 1000 }));
    // AUDIT NAV1 (online #15): my casks afloat - every player sees them, and any player's boat may haul one in
    const casks = shots.floaters().filter((f) => f.kind === 'flotsam' && !f.owner).map((f) => ({ id: Number(f.id), pos: f.pos, from: f.from, lot: f.lot, deep: !!f.deep }));   // AUDIT CAPTAIN'S SEA D8: a deep ship's the richer on every client
    // AUDIT GN-G3: my boat's laid broadsides - another screen lays her as mine does (her shutters up, her guns out)
    const laid = b ? Object.entries(galleonGuns.read(b, clock) ?? {}).filter(([, side]) => side.laid).map(([side]) => side) : [];
    return navalWireRecord({ ships, volleys, barrels: wireBarrels, me, law: notoriety.snapshot(), traffic: setting('ShipsAtSea', TRAFFIC_DEFAULT), casks, spent: spentSaid, gone: goneSaid(), laid }, toWire);   // AUDIT BAY A18: the packets I have seen spent
  }
  /** A peer's word: their ships stood as puppets, their volleys flown and drawn, their barrels afloat. */
  function applyWord(owner, raw, toScene = (p) => p) {
    if (!enabled || typeof owner !== 'string' || owner === myId()) return false;
    const rec = raw == null ? null : validNavalRecord(raw);
    if (!rec) {
      if (raw != null) return false;
      applyCasks(owner, [], toScene);   // AUDIT NAV1 (online #15): nothing of theirs afloat - never a cask an heir raises again
      dropOwner(owner);
      return true;
    }
    hearGone(rec.gone);   // AUDIT PASSAGE B5: the harbour ships booked - heard before her copy is read
    const keep = new Set();
    for (const w of rec.ships) {
      if (goneSeed(w.seed)) continue;   // AUDIT PASSAGE B5: a booked ship is nobody's at sea - a copy of her let go
      const id = `${owner}:${w.n}`;
      let e = sea.get(id);
      if (e && (e.ship.seed !== w.seed || e.ship.cls.id !== w.classId)) { drop(e); e = null; }   // her number said again for another ship: that one is gone
      if (!e) {
        // AUDIT NAV1 (online): her seed already in my sea - another's copy of her, or my own: the stronger claim holds her
        const twin = bySeed(w.seed, w.classId, id);
        if (twin) {
          if (!claimBeats(w.gen, owner, twin.gen, twin.owner ?? myId())) continue;
          e = yieldTo(twin, owner, w.n, w.gen);
        }
      }
      // AUDIT CAPTAIN'S SEA D7: ONE OF A LEGEND AT SEA - another's of the legend I stand (two captains apart in her haunt
      // launched her within a word of each other): the stander law's claim holds her - mine sails out of the world, or
      // theirs is never stood (each client reads the same claim)
      if (!e) {
        const lg = legendOfClass(w.classId);
        const rival = lg ? [...sea.values()].find((x) => !x.owner && x.legend === lg.id && !x.retiring && x.ship.damage.state !== SHIP_STATES.sunk) : null;
        if (rival) { if (!claimBeats(w.gen, owner, rival.gen, myId())) continue; retire(rival); }
      }
      keep.add(id);
      const pos = toScene(w.pos);
      const fresh = !e; if (!e) e = launch({ seed: w.seed, classId: w.classId, variant: w.variant, pos: [pos[0], deps.seaY(), pos[2]], yaw: w.yaw, gen: w.gen, region: w.region, deep: w.deep }, owner, w.n);   // AUDIT 2: `fresh` - a copy launched by this word
      if (!e) continue;
      e.retiring = false;   // SHIP-FADE: said again - she stays
      e.gen = w.gen;
      e.deep = !!w.deep;   // AUDIT CAPTAIN'S SEA D8: the deep's, as her stander launched her
      e.seen = clock;
      e.lost = false;
      e.orphan = null;
      // AUDIT NAV1 (online): where she was said to be, her course and her way - sailed on between the words
      e.target = { pos: [pos[0], deps.seaY(), pos[2]], yaw: w.yaw, speed: w.speed, at: clock };
      e.ship.speed = w.speed; e.ship.sails = w.sails; e.ship.heel = w.heel;
      const dmg = e.ship.damage;
      const was = dmg.state;
      dmg.restore({ hull: dmg.maxHull * w.hull100 / 100, sail: dmg.maxSail * w.sail100 / 100, crew: dmg.maxCrew * w.crew100 / 100, fire: w.fire ? 5 : 0, state: w.state === 'boarded' ? SHIP_STATES.struck : w.state });
      // she went down in their word: if my blows were on her, the sinking is mine to answer for too (the law, a reward)
      const down = (st) => st === SHIP_STATES.sinking || st === SHIP_STATES.sunk;
      if (!down(was) && down(dmg.state) && clock - (e.myBlowAt ?? -Infinity) <= SINK_CREDIT_S) chargePlayer('sink', e);
      // AUDIT CC-E4: a ship another stands struck to MY guns - her stander's strike is the one that runs, and it pays the
      // win to nobody's crew but the shooter's, so my crew heard of it never. AUDIT QUESTLINES ACTS-11: nor my quests -
      // online every ship but the stander's own is stood by another, so a group's other captains struck none
      if (was === SHIP_STATES.afloat && dmg.state === SHIP_STATES.struck && clock - (e.myBlowAt ?? -Infinity) <= SINK_CREDIT_S) struckToMe();
      if (!fresh && was !== SHIP_STATES.sinking && dmg.state === SHIP_STATES.sinking) { sound(NAVAL_CLASSIC.bubbles, e.ship.pos, 1); feel.sinking(e, w.seed, w.fire); }   // COMBAT-FEEL (AUDIT 2026-10-17): her going down as her stander's - her magazine by her seed on every screen; AUDIT 2: never a copy first seen already going down (a player sailing into sight of her heard her go, and her powder went up again)
      // AUDIT NAV2 F1/F3/F5: her captain as her stander sails her - an older build's word says none, and she keeps her
      // seed's temper and a puppet's 'cruise'
      const cap = rec.captains.get(w.n);
      e.ship.boarded = (w.state === 'boarded' || cap?.mode === 'boarded') && boarding?.shipId !== id;   // RAM-BOARD: a sound ship boarded is said by her mode
      if (w.fire) igniteShip(e);
      if (cap) { e.ship.temper = cap.temper; e.ship.mode = cap.mode; e.struckTo = cap.struckTo; }
      // AUDIT NAV1 (the guns): her run-out, as her stander says it - the tell is every player's to see and hear
      SIDES.forEach((side, i) => {
        const on = (w.runOut & (1 << i)) !== 0;
        if (on && !e.ship.runOut.has(side)) { e.ship.runOut.set(side, clock); runOutTell(e, side); }
        else if (!on) e.ship.runOut.delete(side);
      });
    }
    for (const e of [...sea.values()]) if (e.owner === owner && !keep.has(e.id) && boarding?.shipId !== e.id) letGo(e);
    let seen = seenVolleys.get(owner);
    if (!seen) { seen = new Set(); seenVolleys.set(owner, seen); }
    const flown = (flownAt.get(owner) ?? []).filter((t) => clock - t <= NAVAL_VOLLEY_KEEP_MS / 1000);
    flownAt.set(owner, flown);
    for (const v of rec.volleys) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      if (flown.length >= PEER_VOLLEYS_MAX) continue;   // past what one player's guns say - seen, never flown
      flown.push(clock);
      fireFromWord(owner, v, toScene);
      const from = v.shooter >= 0 ? sea.get(`${owner}:${v.shooter}`) : null;
      if (from) noteInbound(from, v.side);   // AUDIT NAV1 (the guns): her volley at me, the warning through its flight
    }
    for (const b of rec.barrels) {
      const key = `b${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // AUDIT NAV1 (online #7): a ship's barrel is a ship's - it blows under my boat as her balls strike it; the owner's
      // own is a player's, never mine to take (no fight between players at sea)
      shots.dropBarrel({ id: `${owner}:${b.id}`, shooter: b.shooter >= 0 ? `${owner}:${b.shooter}` : `peer:${owner}`, pos: toScene(b.pos), resolve: false, owner });
    }
    peerSelf.set(owner, { law: rec.law, me: rec.me, traffic: rec.traffic, at: clock, real: realClock, boat: rec.boat, laid: rec.laid });   // AUDIT GN-G3: her lay (GN2-GN3: said when, really)
    applyCasks(owner, rec.casks, toScene);
    // AUDIT BAY A18: the packets they have seen spent - none stood again here, and said on in my word
    for (const sd of rec.spent ?? []) noteSpent(sd);
    if (seen.size > 512) { const keepIds = [...seen].slice(-256); seen.clear(); for (const k of keepIds) seen.add(k); }
    return true;
  }
  function dropOwner(owner) {
    releaseOwner(owner);   // AUDIT NAV1 (online): the heir's to take over, never gone mid-fight
  }
  /**
   * A ship of another's let go of - gone from their word, or they from the room. AUDIT NAV1 (the presentation): one
   * going down finishes going down first (her stander drops her the moment she is under, a word or two before my clock
   * has her there, and she was removed whole from the surface), then the sinking's own step lets her go.
   */
  function letGo(e) {
    if (e.ship.damage.state === SHIP_STATES.sinking) e.lost = true;
    else if (e.ship.damage.state === SHIP_STATES.afloat) retire(e);   // SHIP-FADE: out of her stander's word, she fades as theirs did
    else drop(e);
  }
  /** A room change, a leave: every peer's ships go (the pool's puppets' own clear - exteriorFoes clearPuppets). */
  function clearPeers() {
    for (const e of [...sea.values()]) if (e.owner) drop(e);
    for (const f of shots.floaters()) if (f.owner) shots.removeFloater(f.id);
    seenVolleys.clear();
    peerSelf.clear();
    flownAt.clear();
    claims.clear();
  }
  /** An owner gone from the room, or quiet past `staleS`: their ships the heir's (releaseOwner); an orphan no word has
   *  claimed in ORPHAN_S let go. */
  function sweepOwners(alive, staleS = OWNER_STALE_S) {
    // AUDIT NAV1 (online #15): an owner by their casks too - a sea down to its casks is still theirs to hand on
    const casks = shots.floaters().filter((f) => f.kind === 'flotsam' && f.owner);
    const owners = new Set([...[...sea.values()].map((e) => e.owner), ...casks.map((f) => f.owner)].filter(Boolean));
    for (const o of owners) {
      const ships = [...sea.values()].filter((e) => e.owner === o && e.orphan == null);
      const afloat = casks.some((f) => f.owner === o && shots.floater(f.id)?.orphanAt == null);
      if (!ships.length && !afloat) continue;
      const last = Math.max(peerSelf.get(o)?.at ?? -Infinity, ...ships.map((e) => e.seen));
      if (!alive?.has?.(o) || clock - last > staleS) releaseOwner(o);
    }
    for (const e of [...sea.values()]) if (e.owner && e.orphan != null && clock - e.orphan >= ORPHAN_S) letGo(e);
    for (const f of casks) { const at = shots.floater(f.id)?.orphanAt; if (at != null && clock - at >= ORPHAN_S) shots.removeFloater(f.id); }
  }
  /** A blow on a ship I stand, from a peer (or a boarding claim). */
  function applyPeerHit(from, data) {
    const hit = validNavalHit(data);
    if (!hit) return false;
    if (hit.cask != null) return hit.answer ? caskAnswered(from, hit.cask) : caskClaimed(from, hit.cask);   // AUDIT NAV1 (online #15)
    if (hit.grapple) {
      // AUDIT NAV1 (online #10): their ship alongside my boat, her grapnels thrown - I take her over and fight her
      // boarders on my own deck, if I let pirates board me at all (else my word says so and she sheers off)
      const e = sea.get(`${from}:${hit.n}`);
      const boat = myBoat();
      if (!e || boarding || !boat || setting('Boarders', true) === false || e.ship.cls.faction !== 'pirate' || e.ship.damage.state !== SHIP_STATES.afloat) return false;
      startBoarding('repel', e, boat);
      return true;
    }
    const entry = ownByN(hit.n);   // AUDIT NAV1 (online #8): by her number, whatever id she was minted under
    if (!entry) return false;
    const hurt = { hull: hit.hull, sail: hit.sail, crew: ballMen(hit.crew, random()), fire: hit.fire };   // TOUGHER-SHIPS: the men said are a gun's (shotMen) or a ram's (ramMenSaid), her toughness reckoned here - an older build's word the same
    strike(entry, hurt, from, true, strayOnAlly(entry, hurt, from));   // a player's blow - SEA-EASE: a stray on an aid weighed as mine
    if (hit.foul) foulSaid(entry.ship, from, clock, hit.foul);   // RAM-BOARD (AUDIT 2026-10-17): their ram's foul - my AI holds her way
    return true;
  }

  // ── AUDIT NAV1 (the presentation, #14): the sea at a glance ─────────────────────────────────────────────────────
  /** Her highest point standing upright over her root (m): her spars as they stand, else her build's reach. */
  function mastTop(e) {
    if (e.mastTop != null) return e.mastTop;
    const build = hullBuild(e.ship.hull);
    const reach = Math.max(build.top, ...build.rig.map(([, mx]) => mx[1]));
    if (!e.boat) return reach;
    const sp = sparsFor(e);
    let top = -Infinity;
    for (const p of sp?.points ?? []) if (p[1] > top) top = p[1];
    e.mastTop = Number.isFinite(top) ? sp.lift + top : reach;
    return e.mastTop;
  }
  /** SHIP-STANCE (2026-10-02, Mac: "Friendly ships should have green Healthbars unless provoked"): how a ship of the
   *  sea stands to me - `hostile` (navalAI.js hostile: she would take me, a crown hunts me, or I provoked her), else
   *  `friendly` while she flies a lawful flag (a merchantman, a crown's ship) and sails; a pirate not after me now is
   *  neither - an enemy's red still. */
  function stanceOf(s, me = meContact(), law = { notoriety: (c) => notoriety.get(c), now: clock }) {
    const afloat = s.damage.state === SHIP_STATES.afloat;
    const isHostile = afloat && hostile(s, me, law);
    return { hostile: isHostile, friendly: afloat && !isHostile && !!NAVAL_FACTIONS[s.cls.faction]?.lawful };
  }
  /** SHIP-TAGS: where a ship of mine is bound, in words - her lane's port (SEA-LANES), her errand's harbour, a crown's
   *  patrol - or '' while she fights, runs, lurks, or keeps a cruise of her own. */
  function boundOf(e) {
    const s = e.ship;
    if (s.damage.state !== SHIP_STATES.afloat) return '';
    if (s.mode === 'answer') return e.relief ? 'coming to your aid' : '';   // AUDIT BAY A11: sailing for the guns, wherever she was bound
    if (s.mode !== 'cruise') return '';
    const r = s.errand;
    const port = (k) => (k != null ? harbours.get(k)?.name ?? null : null);
    const lying = e.owner ? berthOf(s) : null;   // AUDIT BAY A9: another's lying still at a berth - her errand never rides the word
    if (lying) return lying.name ? `moored at ${lying.name}` : 'moored';
    if (r?.kind === 'moored') return port(r.harbour) ? `moored at ${port(r.harbour)}` : 'moored';
    if (r?.kind === 'depart' && port(r.harbour)) return `leaving ${port(r.harbour)}`;   // AUDIT BAY A16: out of an unnamed one, her lane's words
    if (r?.kind === 'patrol') return port(r.harbour) ? `patrolling off ${port(r.harbour)}` : 'on patrol';
    if (r && (r.kind === 'arrive' || r.kind === 'voyage') && port(r.harbour)) return `bound for ${port(r.harbour)}`;
    if (e.liner) {
      // SEA-LANES: lying off her port, or bound for it - by her own leg (AUDIT BAY A22), a peer's packet's too (AUDIT
      // BAY A9: known by her seed, her leg tracked by where she lies)
      const at = e.liner.dest;
      if (!at?.name) return '';
      const leg = e.liner.way;
      const end = leg?.[leg.length - 1];
      return r?.kind === 'lurk' || (end && Math.hypot(s.pos[0] - end[0], s.pos[2] - end[1]) <= LINER_PORT_M) ? `lying off ${at.name}` : `bound for ${at.name}`;
    }
    if (e.relief) return 'coming to your aid';
    if (r?.kind === 'voyage') return 'bound out to sea';
    return '';
  }
  /** The ships the tags stand over: NAVAL_TAG_MAX within NAVAL_TAG_RANGE of the eye and past NAVAL_TAG_NEAR, nearest
   *  first, each `{ id, name, faction, hostile, friendly, line, bound, hull, state, boarded, target, distance, point }` -
   *  `point` TAG_LIFT over her highest spar where she stands (settling as she goes down); SHIP-STANCE's `friendly`,
   *  SHIP-TAGS' `line` (her class, her crown's) and `bound` (boundOf). */
  function tagsModel() {
    if (!enabled) return [];
    const eye = deps.look?.()?.origin ?? deps.feet();
    const near = [];
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk || knownOf(e) < KNOW.colours) continue;   // SPYGLASS: an unknown hull wears no tag
      const d = dist2d(e.ship.pos, eye);
      if (d <= NAVAL_TAG_RANGE && d >= NAVAL_TAG_NEAR) near.push({ e, d });
    }
    near.sort((a, b) => a.d - b.d);
    const me = meContact(), law = { notoriety: (c) => notoriety.get(c), now: clock };   // SEA-PEACE: sized up as I stand
    return near.slice(0, NAVAL_TAG_MAX).map(({ e, d }) => {
      const s = e.ship;
      const root = e.boat.GameObject.position;
      const stance = stanceOf(s, me, law);
      const hid = disguisedOf(e);   // SPYGLASS: her false colours, read as they fly - a merchantman's friendly bar
      return {
        id: e.id, name: shownName(e), faction: hid ? 'merchant' : s.cls.faction,
        hostile: !hid && stance.hostile, friendly: hid || stance.friendly, line: shownLine(e), bound: hid ? '' : boundOf(e), hull: s.damage.hullShare(), state: s.damage.state,
        boarded: !!s.boarded, target: e.id === lastCardId, distance: Math.round(d), point: [root[0], root[1] + mastTop(e) + TAG_LIFT, root[2]],
        fade: e.fade ?? 1,   // SHIP-FADE: her tag comes and goes with her
      };
    });
  }
  /** The lookout: the nearest ship afloat turned hostile within SAIL_HO_RANGE and not yet hailed, SAIL_HO_GAP_S after
   *  the last - her class, and at the helm where she bears off my bow. A ship no longer hostile may be hailed again.
   *  SHIP-WATCH: by night only as far as her lanterns show her (shipWatch.js nightSight - a pirate running dark is
   *  hailed close aboard), and cried by my crew's lookout at the bow (`myCrew` `call`). */
  function hailSails(boat) {
    if (!aboardShip()) return;   // SEA-PEACE: the lookout's cry is for a crew - ashore a sail is no threat (and is hailed once aboard)
    const from = boat ? boatPose(boat).position : deps.feet();
    const me = meContact(), law = { notoriety: (c) => notoriety.get(c), now: clock };
    const night = !!where().night;   // AUDIT WK-N5
    const deckSt = boatInPlay() ? myBoatState(boatInPlay()) : null;
    const sight = deckSt?.worth?.sight ?? 1;   // CAPT-CREW: her Lookout's eye
    let best = null, bestD = Infinity;
    for (const e of sea.values()) {
      const s = e.ship;
      if (s.damage.state !== SHIP_STATES.afloat || s.boarded || !hostile(s, me, law)) { e.hailed = false; continue; }
      if (disguisedOf(e)) continue;   // SPYGLASS: under false colours she is a merchantman to my lookout - till her black flag
      const d = dist2d(s.pos, from);
      if (e.hailed || d > nightSight(SAIL_HO_RANGE * sight, { night, lit: showsLight(e) }) * veilOf(e)) continue;   // AUDIT WK-N6: her flashes too; AUDIT CAPTAIN'S SEA D13: a veiled legend's at the veil's share
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best || clock - lastHail < SAIL_HO_GAP_S) return;
    best.hailed = true;
    lastHail = clock;
    const s = best.ship;
    const bears = boat ? ` ${bearingWords(bearingOf([s.pos[0] - from[0], 0, s.pos[2] - from[2]], boat.GameObject.rotation))}` : '';
    const cry = `Sail ho! ${knownOf(best) >= KNOW.colours ? withArticle(classLine(s.cls, s.names?.crown)) : withArticle(hullWord(s.hull))}${bears}!`;   // SPYGLASS: an unknown hull by her kind
    deps.say?.(cry, 3);
    const deck = boatInPlay();
    if (deck?.crewed) hailCalls.set(deck, `Sail ho!${bears ? ` ${bears.charAt(1).toUpperCase()}${bears.slice(2)}!` : ''}`);   // SHIP-WATCH: the lookout cries it from the bow
  }

  // ── the HUD's model ──────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * What the naval HUD draws this frame (ui/naval/navalHud.js). At a helm: the plate, the rose, the aim, the card and the
   * prompt. On foot: the card alone, and only while a struck ship or a prize of mine is in reach - the prompt that says
   * which key goes over her rail. Otherwise null.
   */
  function hudModel() {
    if (!enabled) return null;
    const boat = myBoat();
    const w = where();
    const crown = crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1);
    const notorietyWord = { crown: crown.name, value: notoriety.get(crown.name), level: notorietyLevel(notoriety.get(crown.name)) };
    if (!boat) {
      // AUDIT NAV1 (B9): the fight on foot - nothing was drawn at all: whose deck, her captain, the tally
      if (boarding) return { ship: null, armed: false, batteries: [], aim: null, aiming: false, target: null, board: null, boarding: fightOf(boarding), notoriety: notorietyWord };
      const e = prizeInReach(null) ?? boardableOnFoot();
      if (!e) return null;
      const card = targetCardOf(e, deps.feet());
      return {
        ship: null, armed: false, batteries: [], aim: null, aiming: false,
        target: card,
        board: { name: card.name, kind: e.prize ? 'hold' : 'board' },
        boarding: null, notoriety: notorietyWord,
      };
    }
    const st = myBoatState(boat);
    const look = lookSide(boat);
    const batteries = SIDES.map((side) => {
      const b = batteryOf(boat.hull, side);
      if (!b) return null;
      const fresh = readyAt.has(side) && clock - readyAt.get(side) <= READY_FLASH_S;   // AUDIT NAV1: just come ready
      return { side, gun: b.gun, guns: b.muzzles.length, progress: st.guns.progress(side), ready: st.guns.ready(side), loaded: loadedNow(st, b), fresh, active: side === look, barrels: b.gun === 'barrel' ? st.guns.barrels : null, shot: st.guns.load(side), left: +st.guns.left(side).toFixed(1) };   // SHOT-KINDS: its load; RELOAD-SECS: its seconds
    }).filter(Boolean);
    const target = targetCard(boat);
    lastCardId = target?.id ?? null;   // AUDIT NAV1 (#14): her tag marked as the card's
    const state = aim ? aimState(st, aim.side, boat) : null;
    const hot = !!aimHit && state === 'ready';
    const nb = boarding ? null : boardable(boat);
    const pr = nb || boarding ? null : prizeInReach(boat);
    const hv = nb || pr || boarding ? null : heaveFor(boat);
    const yard = !nb && !pr && !hv && !boarding && yardHere(boat);
    return {
      waters: w.waters ?? null,   // CAPT-WATERS: the plate says the deep waters
      ether: w.ether ? { bandName: w.ether.bandName, depth: w.ether.depth, veil: !!w.ether.veil } : null,   // ETHER-SEA: ...and the Eltheric Ocean's band and depth (AUDIT CAPTAIN'S SEA D19: or the Veil itself)
      ship: { id: boat.uid ?? null, name: HULL_NAMES[boat.hull], blow: feel.blow(), hull: st.damage.hullShare(), sail: st.damage.maxSail > 0 ? st.damage.sailShare() : null, crew: st.damage.maxCrew > 0 ? st.damage.crewShare() : null, fire: st.damage.fire > 0, wrecked: st.damage.state === SHIP_STATES.wrecked, braced: st.guns.braced, repair: repairCost(st.damage), mending,
        // SHIP-CREW, SEA-REPAIR: her crew's spirits and standing order, her repairs under way, her stores
        spirits: boat.crewed ? spiritsOf(st.crew.morale).label : null, order: boat.crewed && st.crew.order !== CREW_ORDERS.stand ? ORDER_TEXT[st.crew.order].label : null, repairing: !!st.repairing, repairOrdered: st.crew.order === CREW_ORDERS.repair, stores: deps.stores?.count?.(boat) ?? 0 },   // AUDIT CC-D8: her order standing (the hint says so in the quiet before the work)
      armed: batteries.length > 0,
      batteries,
      aim: aim ? { side: aim.side, gun: aim.gun, shot: aim.shot ?? null, range: Math.round(aim.range), max: Math.round(aim.maxRange), hot, barrel: aim.barrel, state, left: state === 'reloading' ? +st.guns.left(aim.side).toFixed(1) : 0 } : null,
      aiming,
      target,
      board: nb ? { name: nb.ship.names?.name ?? 'the ship', kind: 'board' } : pr ? { name: pr.ship.names?.name ?? 'the ship', kind: 'hold' }
        : hv ? { name: hv.ship.names?.name ?? 'the ship', kind: 'heave', heaving: !!heaveTo } : yard ? { name: 'the shipwright', kind: 'yard' } : null,
      boarding: boarding ? fightOf(boarding) : null,
      notoriety: notorietyWord,
      incoming: st.damage.state === SHIP_STATES.wrecked ? null : incoming(boat),
      tally: tallies.shown(clock, TALLY_S),
    };
  }
  /**
   * AUDIT NAV1 (B9) - THE FIGHT, for the HUD's card: whose deck it is, her captain and the tally that makes her crew
   * yield (navalBoarding.js boardingWon - her captain down and SURRENDER_SHARE of the rest, or every man); a Warm
   * Ashes raid's own count is its quest's (`raid`).
   */
  function fightOf(b) {
    const s = sea.get(b.shipId)?.ship;
    const down = (f) => !!deps.board?.foeDown?.(f.handle);
    return {
      kind: b.kind, phase: b.phase, name: s?.names?.name ?? 'the ship', captain: b.kind === 'board' ? (s?.names?.captain ?? null) : null,
      captainDown: b.foes.some((f) => f.captain && down(f)), down: b.foes.filter(down).length, total: b.foes.length,
      yieldAt: Math.ceil(b.foes.length * SURRENDER_SHARE), raid: !!b.quest,
    };
  }
  /** The ship the target card reads: while a broadside is laid, the one its guns strike (AUDIT NAV1: a broadside's
   *  zone lies forward of the look - the galley's helm laid square on a sloop 14.7 degrees off the crosshair showed no
   *  card); else the one the look is on (within 900 m, within 6 degrees of its bearing or its box).
   *  GLASS-SPOT (2026-10-11, the owner: "You can spot ships before you even decide to use the spyglass"): ONLY A SHIP
   *  MADE OUT. The look's card named every hull within 900 m it passed over - "Unknown two-master", her range - so a ship
   *  was spotted, and ranged, at a glance, at night and in the fog as well; a hull not yet made out (shipKnowledge.js
   *  KNOW.hull) gives no card, under the look or the laid guns: she is a sail on the sea till the eye, a Lookout, the
   *  glass or her own acts make her out. */
  function targetCard(boat) {
    if (aimHit?.ship?.boat && sea.has(aimHit.ship.id)) return knownOf(aimHit.ship) >= KNOW.colours ? targetCardOf(aimHit.ship, boatPose(boat).position) : null;   // GLASS-SPOT: the guns laid on a hull not made out - no card, and never another's
    const look = deps.look?.();
    if (!look) return null;
    const lf = flatUnit(look.dir) ?? [0, 0, 1];
    let best = null, bestA = Infinity;
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk || knownOf(e) < KNOW.colours) continue;   // GLASS-SPOT: a hull not made out gives no card
      const p = e.ship.pos;
      const to = [p[0] - look.origin[0], 0, p[2] - look.origin[2]];
      const dist = Math.hypot(to[0], to[2]);
      if (dist > 900) continue;
      const cos = (to[0] * lf[0] + to[2] * lf[2]) / (dist || 1);
      const halfWidth = Math.atan2(hullBuild(e.ship.hull).beam * 3 + 8, dist);
      const a = Math.acos(clamp(cos, -1, 1));
      if (a > Math.max(6 * NAVAL_DEG, halfWidth)) continue;
      if (a < bestA) { bestA = a; best = e; }
    }
    return best ? targetCardOf(best, boatPose(boat).position) : null;
  }
  /** A ship's card, its distance from `from`. */
  function targetCardOf(e, from) {
    const s = e.ship;
    // SPYGLASS: as I know her - an unknown hull her kind and nothing of her stance; false colours a merchantman's; her
    // captain's name once she is studied
    const known = knownOf(e), hid = disguisedOf(e), made = known >= KNOW.colours;
    const stance = !made ? { hostile: false, friendly: false } : hid ? { hostile: false, friendly: true } : stanceOf(s);
    return {
      id: e.id, name: shownName(e), captain: known >= KNOW.studied ? s.names?.captain ?? null : null, classLine: shownLine(e), faction: !made ? 'unknown' : hid ? 'merchant' : s.cls.faction,
      // AUDIT CAPTAIN'S SEA S24: an unknown hull's hurts are no more read than her colours - no bars till she is made
      // out, as she wears no tag (whose bar the card's mirrors)
      hull: made ? s.damage.hullShare() : null, sail: made && s.damage.maxSail > 0 ? s.damage.sailShare() : null, state: s.damage.state, boarded: !!s.boarded,
      crew: made && s.damage.maxCrew > 0 ? s.damage.crewShare() : null,   // CARD-CREW (COMBAT-FEEL): her men, as grape thins them
      ...(s.damage.state === SHIP_STATES.afloat && fouledBy(s, myId(), clock) ? { fouled: true } : {}),   // RAM-BOARD: her bow in my stem
      distance: Math.round(dist2d(s.pos, from)),
      ...stance, bound: known < KNOW.colours || hid ? '' : boundOf(e),   // SEA-PEACE: sized up as I stand; SHIP-STANCE: as her tag - a struck ship neither; SHIP-TAGS
    };
  }

  // ── the draw ─────────────────────────────────────────────────────────────────────────────────────────────────────
  /** What render/navalRender.js draws this frame. */
  function drawFrame() {
    let aimDraw = null;
    if (aim && !aim.barrel) {
      // AUDIT NAV1 (the helm): each gun's arc to where it stops - her side (a strike's mark) or the sea (a zone's)
      const hits = aimHit?.hits ?? [];
      const arcs = aim.launches.map((l, i) => (hits[i] ? arcTo(l, hits[i].t) : arcPoints(l.p0, l.v0, deps.seaY(), 18)));
      const zone = aim.landings.map((l, i) => (l && !hits[i] ? l.point : null)).filter(Boolean);
      const strikes = hits.filter(Boolean).map((h) => h.point);
      const boat = myBoat();
      const ready = !!boat && aimState(myBoatState(boat), aim.side, boat) === 'ready';
      aimDraw = { arcs, zone, strikes, hot: ready && strikes.length > 0, radius: Math.max(1.6, aim.width / 2), ready, posts: true };
    } else if (aim?.barrel) {
      const boat = myBoat();
      aimDraw = { arcs: [], zone: aim.landings.map((l) => l.point), hot: false, radius: 2, ready: !!boat && aimState(myBoatState(boat), aim.side, boat) === 'ready', posts: false };
    }
    const particles = effects.drawList();
    lampsInto(particles);   // SHIP-WATCH: the far ships' lanterns, points of light on the night sea
    return { particles, balls: shots.balls(), floaters: shots.floaters().map((f) => (isSalvage(f.lot) ? { ...f, wreck: true } : f)), aim: aimDraw, time: clock };   // AUDIT NAV1 (#4): the arcs' dash marches on the sea's clock
  }
  /**
   * SHIP-WATCH: a lit ship's lanterns past LAMP_NEAR_M of the eye, as points of light (an added glow, shipWatch.js
   * lampSize/lampAlpha - a few pixels at any range) - her own lantern flats are a pixel there and the light list holds
   * the nearest eight, so a ship at night was her dark hull alone. LAMP_MAX of each ship's lanterns, spread along her;
   * the sea's ships and mine.
   * @param {any[]} out
   */
  function lampsInto(out) {
    if (!where().cityLights) return;
    const eye = deps.look?.()?.origin ?? deps.feet();
    const boats = [];
    for (const e of sea.values()) if (e.boat?.LightOn && (e.fade ?? 1) >= FADE_FLATS) boats.push(e.boat);   // AUDIT BAY A13: gone with her lantern flats as she fades
    for (const b of myBoats()) if (b.LightOn) boats.push(b);
    for (const p of deps.peerBoats?.() ?? []) if (p.boat?.LightOn) boats.push(p.boat);   // AUDIT WK-N7: another player's lit boat, as my captains see her
    for (const b of boats) {
      const lit = (b.Lights ?? []).filter((l) => l.node?.activeInHierarchy !== false);
      for (const l of lampPoints(lit)) {
        const p = l.node.position, d = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
        if (d <= LAMP_NEAR_M) continue;
        out.push({ pos: p, size: lampSize(d), color: [LAMP_COLOR[0], LAMP_COLOR[1], LAMP_COLOR[2], lampAlpha(d)], rot: 0, blend: 'add', flat: false, solid: false, kind: 'lamp', aspect: 1 });
      }
    }
  }
  /** The muzzles' light this frame, and the burning ships' glow (the nearest BURN_LIGHTS of them, flickering), for
   *  the host's light list - carried lights: no shadow caster, no glare. */
  function lights() {
    const out = flashes.map((f) => ({ x: f.pos[0], y: f.pos[1], z: f.pos[2], range: MUZZLE_FLASH_RANGE * (1 - (clock - f.t) / MUZZLE_FLASH_S), color: MUZZLE_FLASH_COLOR, carried: true }));
    const feet = deps.feet();
    // AUDIT NAV1: my own burning deck's glow first - it is the nearest fire there is
    for (const b of myFires.keys()) {
      const p = b.GameObject.position;
      if (out.length - flashes.length >= BURN_LIGHTS) break;
      out.push({ x: p[0], y: p[1] + hullBuild(b.hull).deck + 2, z: p[2], range: BURN_RANGE * (0.85 + 0.15 * Math.sin(clock * 9)), color: BURN_COLOR, carried: true });
    }
    const burning = [...sea.values()].filter((e) => e.fires?.length && e.boat && (e.fade ?? 1) >= FADE_FLATS).sort((a, b) => dist2d(a.ship.pos, feet) - dist2d(b.ship.pos, feet)).slice(0, Math.max(0, BURN_LIGHTS - myFires.size));
    for (const e of burning) {
      const p = e.ship.pos;
      out.push({ x: p[0], y: deps.seaY() + hullBuild(e.ship.hull).deck + 2, z: p[2], range: BURN_RANGE * (0.85 + 0.15 * Math.sin(clock * 9 + e.phase)), color: BURN_COLOR, carried: true });
    }
    return out;
  }

  // ── the world moved, or went away ────────────────────────────────────────────────────────────────────────────────
  function offsetAll(o) {
    const shift = (system) => { if (system?.particleCount > 0) system.setParticles(system.getParticles().map((q) => ({ ...q, position: [q.position[0] + o[0], q.position[1] + o[1], q.position[2] + o[2]] }))); };
    for (const e of sea.values()) {
      e.ship.pos[0] += o[0]; e.ship.pos[1] += o[1]; e.ship.pos[2] += o[2];
      if (e.target) { e.target.pos[0] += o[0]; e.target.pos[2] += o[2]; }
      if (e.ship.waypoint) { e.ship.waypoint[0] += o[0]; e.ship.waypoint[1] += o[2]; }
      if (e.ship.course) e.ship.course = [e.ship.course[0] + o[0], e.ship.course[1] + o[2]];   // AUDIT BAY A1: a packet's, a raider's, a relief's - steered an origin's move off
      if (e.liner?.leg) e.liner.leg = e.liner.leg.map((q) => [q[0] + o[0], q[1] + o[2]]);   // her leg, as her tag reads it (each its own: the list's are shared)
      if (e.liner?.way) e.liner.way = e.liner.way.map((q) => [q[0] + o[0], q[1] + o[2]]);   // AUDIT BAY A22: and her own
      offsetErrand(e.ship.errand, o);   // SHIP-LIFE: her way and where it leads
      // her hull where the shift put the world, and her wake's living foam with it (OnPositionUpdateBoat's own)
      const b = e.boat;
      if (b) { const p = b.GameObject.position; b.GameObject.position = [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; shift(b.WakeEmitter); }
    }
    for (const f of flashes) { f.pos[0] += o[0]; f.pos[1] += o[1]; f.pos[2] += o[2]; }
    // AUDIT NAV1 (online #15): my word's volleys and barrels, said where they were fired - with the world, or a word said
    // after the shift put them an origin's move away for as long as it kept them
    for (const w of [...wireVolleys, ...wireBarrels]) { w.pos[0] += o[0]; w.pos[1] += o[1]; w.pos[2] += o[2]; }
    for (const c of claims.values()) { c.point[0] += o[0]; c.point[1] += o[1]; c.point[2] += o[2]; }
    for (const g of gunfire) { g.pos[0] += o[0]; g.pos[1] += o[1]; g.pos[2] += o[2]; }   // AUDIT NAV2 F8: the guns heard are the world's - a navy steered for a report an origin's move away
    if (boarding) for (const p of [boarding.from, boarding.to]) { p.pos[0] += o[0]; p.pos[2] += o[2]; }
    shots.offsetAll(o);
    effects.offsetAll(o);
    if (ownBook) harbours.offsetAll(o);   // SHIP-LIFE: the harbours with the world (HARBOUR-BOOK: the world's moves its own) - and the grids made again in it
    grids = new Map();
  }
  /** A transition, a fast travel, a load, a room change: the sea empties (its ships were never a save's). */
  function clear() {
    for (const e of [...sea.values()]) drop(e);
    shots.clear();
    effects.clear(); feel.clear();
    wireVolleys = []; wireBarrels = [];
    gunfire = [];   // AUDIT NAV2 F8: the guns heard go with the sea they were fired on
    if (ownBook) harbours.clear();   // SHIP-LIFE: found again where the world is next (HARBOUR-BOOK: the world empties its own at a transition)
    rolled = new WeakSet(); grids = new Map();   // and their ships stood again
    warping = null; gangwaySaid = null;   // AUDIT HOLDINGS Q9: no warp nor gangway word carried across
    claims.clear(); granted.clear();
    myCasks.clear();   // KEEP-PLUNDER
    stolenCasks.clear();
    seenVolleys.clear();
    hailCalls.clear();   // SHIP-WATCH
    flashes.length = 0;
    aiming = false; aim = null; aimHit = null; heaveTo = null; wayIn = [];
    for (const [b, f] of [...myFires]) douseMine(b, f);
    galleonGuns.clear();   // AUDIT GN2-GN5: every gun deck at rest - the sea's frame steps none while the arc is off
    if (boarding) {
      const quest = boarding.quest;
      for (const f of boarding.foes) deps.board?.removeFoe?.(f.handle);
      endBoarding();
      if (quest) { raidUids.delete(quest.uid); deps.board?.endRaid?.(quest, { withdraw: true }); }   // AUDIT NAV1 (B6): the raid ends with the sea it was fought on
    }
    director.reset();
  }

  // ── CREW-COMPANIONS: the party ashore ──────────────────────────────────────────────────────────────────────────────
  /** A boat of mine's hands as the save or her live crew says them, by her uid (null: no such boat of mine). */
  function handsByUid(uid) {
    const st = boatState.get(uid);
    if (st) return st.crew.hands;
    const rec = pendingBoats.get(uid);
    return rec ? (Array.isArray(rec.mates?.hands) ? rec.mates.hands : []) : null;
  }
  /** Whether a hand of a boat of mine still lives (on her roster) - the party's `prune`. */
  const handLives = (uid, name) => !!handsByUid(uid)?.some((h) => h?.name === name);
  /** COMPANION-KIT: a companion's pack given up (sent back, knocked out, fallen) - into his boat's hold (Come Sail Away's
   *  cargo, the board's giveItems), what it will not take into my pack; said when anything moved. AUDIT WK-P5: never
   *  thrown away - with no boat of his found, or what her hold leaves, into my pack past its gate if it must (`force`),
   *  his gold into my purse - and said as it went: the HUD said "stowed in your pack" over six claymores gone. */
  function stowPack(uid, items, name) {
    if (!items?.length) return;
    const boat = packStaysAshore() ? null : (csa()?.state?.AllBoats ?? []).find((b) => b?.uid === uid) ?? null;   // COMPANION-DROP: in the open zone, mine - it drops with my pack there
    const rest = boat ? deps.board?.giveItems?.(items, boat)?.left ?? [] : items;
    const mine = rest.length ? deps.board?.giveItems?.(rest, null, { force: true }) ?? null : null;
    const where = !rest.length ? 'in the hold' : rest.length === items.length ? 'in your pack' : 'in the hold and your pack';
    deps.say?.(`${name ?? 'Your companion'}'s pack is stowed ${where}${mine?.over ? ' (more than you can carry)' : ''}.`, 3);
  }
  /** Take a hand of a boat of mine ashore, or send one back: the picker's row pressed. Answers what was said. */
  function companionPress(boat, name, now) {
    const st = myBoatState(boat);
    if (!st || !boat?.uid) return null;
    const hand = st.crew.hands.find((h) => h.name === name);
    if (!hand) return null;
    if (companions.isAshore(boat.uid, name)) {
      if (heldAtSide(name, deps.say)) return null;   // COMPANION-DROP (crewCompanions.js): never sent back from inside the open zone
      const pack = companions.takePack(boat.uid, name);   // COMPANION-KIT: his pack stowed in her hold
      companions.sendBack(boat.uid, name);
      deps.say?.(`${name} goes back aboard.`, 3);
      stowPack(boat.uid, pack, name);
      return 'back';
    }
    const why = companions.why(boat.uid, hand, now, !!boat.crewed);
    if (why) { deps.say?.(`${name} cannot come ashore: ${why}.`, 3); return null; }
    if (!companions.take(boat.uid, hand, now)) return null;
    deps.say?.(`${name}, ${hand.role}, comes ashore with you.`, 3);
    return 'take';
  }

  // ── the save (systems/modSaveData.js) ────────────────────────────────────────────────────────────────────────────
  const newSaveData = () => ({ v: NAVAL_SAVE_VERSION, boats: {}, notoriety: {}, day: null, raids: [], party: { party: [], resting: [] } });
  function getSaveData() {
    const boats = {};
    for (const [uid, rec] of pendingBoats) boats[uid] = rec;
    for (const [uid, st] of boatState) boats[uid] = { ...savedRecord(st.damage, st.hull, st.credit), ...gunsRecord(st) };   // SHIP-CREW (`mates`: the damage's own `crew` is her count), SEA-REPAIR (`credit`), TOUGHER-SHIPS (on her first build's scale) - her fires and fractional hurts with it (`saveData`)
    return { v: NAVAL_SAVE_VERSION, boats, notoriety: notoriety.snapshot(), day: lastDecayDay, raids: [...raidUids], party: companions.snapshot() };   // CREW-COMPANIONS: `party`
  }
  function restoreSaveData(r) {
    boatState.clear();
    pendingBoats.clear();
    notoriety.restore(r?.notoriety ?? null);
    lastDecayDay = Number.isFinite(r?.day) ? r.day : null;
    raidUids.clear();
    for (const uid of Array.isArray(r?.raids) ? r.raids : []) if (Number.isSafeInteger(uid)) raidUids.add(uid);
    for (const [uid, rec] of Object.entries(r?.boats ?? {})) {
      const key = Number(uid);
      if (!Number.isSafeInteger(key) || key <= 0 || !rec || typeof rec !== 'object') continue;
      pendingBoats.set(key, rec);
    }
    companions = createCompanions(r?.party ?? null, deps.packedItems ?? null);   // CREW-COMPANIONS: an older save's, nobody ashore - COMPANION-KIT: their packs
    clear();
  }

  return {
    frame, attackInput, cancelAim, holdFire, activate, hudModel, drawFrame, lights, offsetAll, clear, stowPlunder, aimEye, wayScale, sailRefused, brake, postsWay,
    /** SHOT-KINDS: the load of the guns at hand stepped on (`dir` 1) or back - the key's, the pad's, the helm button's;
     *  the wheel's while they are laid (true: the wheel is the guns'); the helm button's label (null: no guns). */
    cycleShot: (dir = 1) => loads.cycle(dir), shotWheel: (dy) => loads.wheel(dy), shotLabel: () => (enabled ? loads.label(myBoat()) : null),
    /** CAPT-LOG: a crown's notoriety against me in its waters (the Captain page's - a hunted captain keeps no favours). */
    notorietyOf: (crown) => notoriety.get(crown),
    /** SPYGLASS: the glass's frame (raised or not, its magnification) - the card of the ship it holds, or null. */
    glass,
    /** GLASS-CLEAR: the ship I stand aboard as one box (ownExtent's) - the glass's focus stands past her. */
    ownExtent,
    /** SPYGLASS: whether the glass is up (the world's view narrows to it). */
    get glassUp() { return glassUp; },
    /** GALLEON: a galleon's gun deck as this frame stood it (her sides laid, her guns' places, her shutters) - a probe's reading. */
    gunDeckOf: (boat) => galleonGuns.read(boat, clock),
    /** SEA-EVENTS: the treasure fleet's sailing about the captain (scenes/naval/treasureFleet.js step), stepped by the world's
     *  feed; and the Aether Storm's lightning finding the ship I stand aboard (`strike` - systems/sea/seaEvents.js
     *  stormStrikeOf): hurt by its shares, never under her last timber by it alone. Answers whether it struck her. */
    fleet: (list, o) => { if (enabled) treasureFleet.step(list, o); },
    stormStrike: (strike) => strikeShip(enabled && aboardShip() ? myBoatState(boatInPlay())?.damage : null, strike, clock),
    /** SHIP-PVP: the open sea's guns' seams (scenes/naval/navalPvp.js) - the guns attached, my ship as the referee is told of
     *  her, its word laid on her, her wreck, a peer's boat where she lies, a prize out of her hold. */
    pvp,
    fleetStatus, repairAway, refitBoat, openYard, freeBerth, crewHands, assignRole,   // HOLDINGS: the Fleet page's (scenes/fleetHost.js) - with giveOrder and hostileNear, below
    passageShip, charter, charterSailed,   // PASSAGE: a berth's ship to book, and her boat made the voyage's (scenes/naval/passageHost.js)
    enlistHand, swapHand, releaseHand, forgetBoat, handsAshore,   // SHIPYARDS: the crew hall's recruits signed on (in a hand's place, AUDIT SHIPYARDS) and paid off, a ship sold, her hands ashore
    /** SHIPYARDS: the shipwright's model of a boat of mine (ui/naval/navalYardWindow.js's - its rows, its presses), for the
     *  shipmaster's window's Shipwright page (ui/shipyardWindow.js) - the one the yard's own window reads. */
    yardModelOf: (boat) => yardModel(boat),
    harbourList, warp, dockedAt, gangways,   // QUAYS: the harbours the quays stand off (scenes/quayPool.js), Come Sail Away's warp seam, where a boat lies made fast, the gangways run out
    boatInPlay: () => boatInPlay(),
    word, applyWord, sweepOwners, applyPeerHit, dropOwner, clearPeers,
    /** AUDIT NAV2 F3/F9: another player's boat at sea as their word says her - her crew's share and whether she
     *  fights (her crew at battle on every screen) - or null (no word, or an older build's). AUDIT WK-W12: and her work,
     *  her hull's loss as her word says it (the word carries no canvas), so her hands mend on every screen. */
    peerBoat(owner) {
      const self = peerSelf.get(owner), said = self?.boat;
      return said ? { crewShare: Math.max(0, Math.min(1, said.crew / Math.max(1, hullBuild(said.hull).crew))), battle: said.battle, work: Math.min(1, Math.max(0, 1 - (self.me?.hull ?? 1))) } : null;
    },
    leaveShipGate, raidEnded, placeQuestFoe,
    newSaveData, getSaveData, restoreSaveData,
    /** CREW-COMPANIONS: the party ashore (crewCompanions.js) - the companion layer's (crewAshore.js). */
    get companions() { return companions; },
    /** CREW-COMPANIONS: a boat of mine's companions picker rows (crewCompanions.js companionRows), or null. */
    companionRows(boat, now) {
      const st = myBoatState(boat);
      if (!st || !boat?.uid) return null;
      return companionRows({ boat: boat.uid, crewed: !!boat.crewed, hands: st.crew.hands, now, companions });
    },
    companionPress,
    /** CREW-COMPANIONS: a companion knocked out - carried back aboard, and his crew's spirits take it. */
    companionKnocked(c) {
      const live = boatState.get(c.boat);
      if (live) live.crew.event('knocked');
      else {
        // AUDIT CC-D7: a boat not stood since the load - the knock lands on her saved crew
        const rec = pendingBoats.get(c.boat);
        if (rec?.mates) { const crew = createShipCrew({ seed: c.boat >>> 0, record: rec.mates }); crew.event('knocked'); rec.mates = crew.snapshot(); }
      }
      deps.say?.(`${c.name} is knocked out. Your crew carries ${c.gender === 'female' ? 'her' : 'him'} back aboard to rest.`, 4);
      if (c.items?.length) stowPack(c.boat, c.items.splice(0), c.name);   // COMPANION-KIT: and his pack with him
    },
    /** CREW-COMPANIONS: the party's hands no longer anyone's (fallen, the boat gone) out of it - answers them. */
    pruneCompanions: () => {
      const gone = companions.prune(handLives);
      for (const c of gone) if (c.items?.length) stowPack(c.boat, c.items.splice(0), c.name);   // COMPANION-KIT: a fallen hand's pack is not lost
      return gone;
    },
    /** COMPANION-KIT: a companion's pack by his layer key (crewAshore.js companionKeyOf, `${boat}:${name}`) - his name,
     *  role and live item list - or null. */
    companionPack(key) {
      const c = companions.party.find((p) => `${p.boat}:${p.name}` === key);
      return c ? { name: c.name, role: c.role, items: c.items } : null;
    },
    /** CREW-COMPANIONS: a boat of mine's roster places ashore - her deck stands without them (navalCrew.js `away`). */
    awayOf(boat) {
      // AUDIT CC-A5: none away is an EMPTY set, never null - null left the last hand home off her deck for good; and
      // while I sail, every hand of mine is aboard (Mac: "Back on deck while sailing")
      const names = ashoreNames(boat);   // AUDIT CAPTAIN'S SEA C1: the one set
      if (!names.size) return NO_HANDS_AWAY;
      const hands = myBoatState(boat)?.crew.hands ?? [];
      const out = new Set();
      hands.forEach((h, i) => { if (names.has(h.name)) out.add(i); });
      return out;
    },
    raiders, raiderShipOf, raiderHeld,   // NAV-R; THE MERGE (OW6): the raiders I hold, for the raider word
    liners,   // SEA-LANES: the Bay's packets
    /** Whether a hostile ship is near - Come Sail Away's time scale refuses to run with one (AreEnemiesNearby). */
    hostileNear: () => hostileNearMe(),
    /** SERPENT1: Come Sail Away's `drift` seam - the sea serpent's maelstrom pulling my ship, a blow's throw: scene m/s
     *  `[vx, 0, vz]` added to the sea's current under her (scenes/serpentHost.js drift), or null. SERPENT4: and in its
     *  waters, the ships' bumpers (withBumpers). */
    drift: (boat) => (enabled ? withBumpers(boat, deps.serpent?.drift?.(boat) ?? null) : null),
    /** SERPENT4: Come Sail Away's `gale` seam - the sea serpent's gale about my ship (scenes/serpentHost.js gale), or null. */
    gale: (boat) => (enabled ? deps.serpent?.gale?.(boat) ?? null : null),
    /** SERPENT1: the boat of mine in play (at my helm, or one I stand aboard) as the serpent's blows read her - her root's
     *  place (`root` - what the coil holds), her hull's middle (`pos` - what a blow is tested at), her heading, half
     *  length and beam, her whole, and whether I hold her helm - or null. */
    serpentBoat() {
      if (!enabled) return null;
      const boat = boatInPlay();
      const st = boat ? myBoatState(boat) : null;
      if (!st) return null;
      const pose = boatPose(boat), b = hullBuild(boat.hull), yaw = yawOfRot(pose.rotation), mid = (b.bowZ + b.aftZ) / 2;
      return {
        boat, hull: boat.hull, root: [pose.position[0], pose.position[2]], yaw,
        pos: [pose.position[0] + Math.sin(yaw) * mid, pose.position[1], pose.position[2] + Math.cos(yaw) * mid],
        hl: (b.bowZ - b.aftZ) / 2, hw: b.halfWidth, maxHull: st.damage.maxHull, maxSail: st.damage.maxSail, hullNow: st.damage.hull,   // INT15: her hull as it stands, for the relay's count
        atHelm: boat === myBoat(), wrecked: st.damage.state === SHIP_STATES.wrecked,
      };
    },
    /** SERPENT1: a sea serpent's blow on a boat of mine - her own client takes it (the victim's law): her hurt, the deck's
     *  shake, the line. AUDIT SERPENT B6: braced, her hull and canvas take BRACE_TAKEN of it, as of any ball. Answers the
     *  state it changed her to, or null. */
    serpentStrike(boat, hurt, { shake = 0, line = null } = {}) {
      const st = boat ? myBoatState(boat) : null;
      if (!enabled || !st || !hurt) return null;
      const k = st.guns.braced ? BRACE_TAKEN : 1;
      // CREW-HOLD: its men over a player's crew's toughness, as every other blow's - they were taken whole
      const men = playerMen(hurt.crew ?? 0, random());
      const change = st.damage.apply({ ...hurt, crew: men, ...(k < 1 ? { hull: Math.round((hurt.hull ?? 0) * k), sail: Math.round((hurt.sail ?? 0) * k) } : {}) }, clock);
      if (shake) deps.shake?.(shake);
      if (line) deps.say?.(line, 2.5);
      if (change === SHIP_STATES.wrecked) deps.mid?.('Your ship is crippled! The sails hang in rags.', 3);
      return change;
    },
    /** SERPENT1: the sea's own spray for the serpent's landings - a breach's column, a lash's sheet, the venom's spatter,
     *  the ram's bow wave - on the sea fight's effects (one budget, one draw). */
    serpentFx(kind, pos, scale = 1) {
      if (!enabled || !pos) return;
      const jit = (r) => [pos[0] + (random() - 0.5) * r * scale, pos[1], pos[2] + (random() - 0.5) * r * scale];
      if (kind === 'breach') { for (let i = 0; i < 5; i++) effects.splash(jit(14), true); }
      else if (kind === 'lash') { for (let i = 0; i < 4; i++) effects.splash(jit(24), true); }
      else if (kind === 'wake' || kind === 'venom' || kind === 'roar') effects.splash(jit(4), kind === 'roar');
    },
    /** SEA-HUNT: whether the player stands aboard - at a helm, on a boat of theirs or on a sea ship's deck (aboardShip). */
    aboard: () => aboardShip(),
    takesActivate,   // NAVAL-E: the sea's E before a node's
    saveRefused,   // AUDIT NAV1 (B14): no save in a boarding or on a sea ship's deck
    threats,   // THE MERGE (OW6): the hostile ships a journey slows for
    tags: tagsModel,   // AUDIT NAV1 (#14): the ships the tags stand over (the world projects them)
    /** AUDIT NAV1 (the helm): the sea's ships on the compass (ui/hud/hud.js drawShipCompassMarks, ui/enhanced/enhancedHud.js) -
     *  within COMPASS_SHIP_RANGE of the player, afloat or struck: `[{ x, z, kind }]` in scene XZ, `kind` 'hostile' (a
     *  ship afloat that would take me), 'struck' (her colours down, or taken) or 'ship'. None with the arc off. */
    compassShips() {
      if (!enabled) return null;
      const feet = deps.feet();
      const out = [];
      const me = meContact();   // SEA-PEACE: sized up as I stand, once for the walk
      for (const e of sea.values()) {
        const st = e.ship.damage.state;
        if (st === SHIP_STATES.sinking || st === SHIP_STATES.sunk || dist2d(e.ship.pos, feet) > COMPASS_SHIP_RANGE) continue;
        // AUDIT CAPTAIN'S SEA S4: her stance as I know it - an unknown hull's, or false colours', no red (her tag's law)
        const kind = st !== SHIP_STATES.afloat ? 'struck'
          : knownOf(e) >= KNOW.colours && !disguisedOf(e) && hostile(e.ship, me, { notoriety: (c) => notoriety.get(c), now: clock }) ? 'hostile' : 'ship';
        out.push({ x: e.ship.pos[0], z: e.ship.pos[2], kind });
      }
      return out;
    },
    /** LIVING CREW (scenes/naval/navalCrew.js): the sea's ships whose crew can stand on her deck - her boat built, afloat,
     *  struck or taken, AUDIT NAV2 F45: or going down (her living crew aboard to the end, never the mod's static flats in
     *  her last minute; she drops once sunk) - each with her class (the muster's classes), what her crew has left, her
     *  seed, her faction, whether her guns are out (`battle`: she engages, boards, runs or answers gunfire), AUDIT NAV2
     *  F46: whether her colours are down (`struck`: struck, taken or going down - no song, no calm word), whether her
     *  crew is held off her deck (`hold`: a prize, or her men the fight's - my boarding's, or another's in a room) and,
     *  AUDIT NAV2 F40, a boarding at hand (`toward`, the point her crew musters toward, and CREW-MUSTER's `way`, her side
     *  of it): the ship she closes on to board (her 'board' course: 'board'), or me able to board her now she has struck
     *  ('repel': my helm's own reach, boardingGap - in range, my way under BOARD_SPEED - or my feet's, footReach) - a ship
     *  to come alongside set abeam of her on the side it will
     *  lie once she is (berthPose's: she lies on the side of its keel she is on, her heading its own or its reciprocal),
     *  at its distance (her men swung rail to rail while she came up bow-on). */
    crewShips() {
      if (!enabled) return [];
      const out = [];
      const helm = myBoat();
      let feet = null;
      const abeam = (e, pos, yaw) => {
        const lie = (e.ship.pos[0] - pos[0]) * Math.cos(yaw) - (e.ship.pos[2] - pos[2]) * Math.sin(yaw) >= 0 ? 1 : -1;
        const s = (Math.cos(e.ship.yaw - yaw) >= 0 ? -lie : lie) * dist2d(e.ship.pos, pos);
        return [e.ship.pos[0] + Math.cos(e.ship.yaw) * s, e.ship.pos[1], e.ship.pos[2] - Math.sin(e.ship.yaw) * s];
      };
      for (const e of sea.values()) {
        const st = e.ship.damage.state;
        if (!e.boat || (st !== SHIP_STATES.afloat && st !== SHIP_STATES.struck && st !== SHIP_STATES.prize && st !== SHIP_STATES.sinking)) continue;
        const mine = boarding?.shipId === e.id;
        const hold = st === SHIP_STATES.prize || (mine ? boarding.phase === 'fight' && boarding.kind === 'board' : !!e.ship.boarded);
        const battle = st === SHIP_STATES.afloat && e.ship.mode !== 'cruise';
        let toward = null, way = null;
        if (st === SHIP_STATES.afloat && e.ship.mode === 'board' && !e.ship.boarded) {
          const t = e.ship.target, me = t === myId() ? boatInPlay() : null, other = me ? null : sea.get(t);
          const peer = me || other ? null : (deps.peerBoats?.() ?? []).find((p) => p.id === t);
          const [pos, yaw] = me ? [me.GameObject.position, yawOfRot(me.GameObject.rotation)] : other ? [other.ship.pos, other.ship.yaw] : [peer?.pos ?? null, peer?.yaw];
          if (pos) { toward = Number.isFinite(yaw) ? abeam(e, pos, yaw) : pos; way = 'board'; }   // CREW-MUSTER: she goes over the other's rail
        } else if (boardableState(e.ship, myId(), clock) && !boarding) {   // RAM-BOARD: struck, or fouled by my stem
          // CREW-MUSTER (FIELD BUGS 2026-10-14; Mac's call): a boarding of her I could make NOW - my helm's own reach
          // (boardingGap: in range and my way under BOARD_SPEED), or my feet's (footReach) - and hers is the repel's side
          const from = helm ? helm.GameObject.position : (feet ??= deps.feet());
          if (helm ? boardingGap(helm, e) != null : footReach(e, from)) { toward = helm ? abeam(e, from, yawOfRot(helm.GameObject.rotation)) : from; way = 'repel'; }
        }
        out.push({ key: e.id, boat: e.boat, pos: e.ship.pos, shipClass: e.ship.cls, crewShare: e.ship.damage.crewShare(), seed: e.ship.seed, faction: e.ship.cls.faction, way, battle, struck: st !== SHIP_STATES.afloat, hold, toward, work: st === SHIP_STATES.afloat ? workOf(e.ship.damage) : 0 });   // SHIP-WATCH: her hurts, mended
      }
      return out;
    },
    /** LIVING CREW: a sea ship's boat by her id (a grapple's other ship, whose rail a crew musters toward). */
    boatOf: (id) => sea.get(id)?.boat ?? null,
    /** LIVING CREW: a boat of mine's crew - her count, whether she is in a fight (the aim laid, a hostile near) and, AUDIT
     *  NAV2 F40, a boarding at hand (`toward`, the point her crew musters toward, and CREW-MUSTER's `way`, her side of it):
     *  a ship closing on her to board ('repel'), or - at her helm - the struck ship a boarding from it would take now
     *  ('board': `boardable`). */
    myCrew(boat) {
      const st = myBoatState(boat);
      if (!st) return null;
      let toward = null, way = null;
      for (const e of sea.values()) {
        if (e.ship.damage.state === SHIP_STATES.afloat && e.ship.mode === 'board' && !e.ship.boarded && e.ship.target === myId()) {
          if (boat === boatInPlay()) { toward = e.ship.pos; break; }
        }
      }
      if (toward) way = 'repel';   // CREW-MUSTER: she comes over our rail
      // CREW-MUSTER (FIELD BUGS 2026-10-14, "Crew Attacking Me"; Mac's call): at her helm, the struck ship a boarding from it
      // would take NOW (the boarding's own `boardable`: in reach, her way under BOARD_SPEED) - never one it would not
      // (they stood at the rail crying the repel's words for as long as I sat at her helm with a struck ship in reach, at
      // any way - and to the player, with none coming aboard, they were crying them at him)
      else if (!boarding && boat === myBoat()) { const e = boardable(boat); if (e) { toward = e.ship.pos; way = 'board'; } }
      // SHIP-CREW: her standing order (the guns manned, the rail, the repairs), whether her spirits sing, and a line of theirs
      // SHIP-WATCH: her work (what her hurts leave to mend - all hands to it under a repair order) and her lookout's cry
      const call = hailCalls.get(boat) ?? null;
      if (call) hailCalls.delete(boat);
      const work = boat.crewed && st.crew.order === CREW_ORDERS.repair ? 1 : workOf(st.damage);
      // AUDIT WK-W10: the hand her card names Lookout keeps her bow - his roster place (the crew's members stand in it)
      const lookout = st.crew.hands.findIndex((h) => h.role === LOOKOUT_ROLE);
      const roles = boat.crewed ? st.crew.hands.map((h) => h.role) : null;   // HOLDINGS: each at his role's post
      return { crew: st.damage.crew, way, battle: aiming || crewAlarm(), toward, order: boat.crewed ? st.crew.order : CREW_ORDERS.stand, sings: !boat.crewed || st.crew.sings(), line: () => (boat.crewed ? st.crew.line() : null), repairing: !!st.repairing, work, call, lookout, roles };
    },
    /** SHIP-CREW: a hand of a boat of mine by where he stands in her roster - his name, or null. */
    crewName: (boat, i) => (boat?.crewed ? myBoatState(boat)?.crew.nameOf(i) ?? null : null),
    /** SHIP-CREW: an order given from a boat of mine's deck (giveOrder). */
    giveOrder: (boat, order) => giveOrder(boat, order),
    /** SHIP-CREW: a boat of mine's crew as people - their card's lines (shipCrew.js crewCard), her spirits, her order,
     *  and a hand's name by where he stands in her roster. */
    crewOf(boat) {
      const st = myBoatState(boat);
      if (!st) return null;
      const c = st.crew;
      return {
        crewed: !!boat.crewed, morale: c.morale, spirits: spiritsOf(c.morale), order: c.order, hands: c.hands.map((h) => ({ ...h })),
        card: crewCard(c, { ship: `The ${HULL_NAMES[boat.hull]}`, order: c.order, ashore: ashoreNames(boat) }), nameOf: (i) => c.nameOf(i), stores: deps.stores?.count?.(boat) ?? 0,   // AUDIT CAPTAIN'S SEA C1: none ashore while I sail
      };
    },
    /** The sea ships' boats standing near enough to be struck and walked on (the world's collider takes them). */
    collidable() { const f = deps.feet(); return [...sea.values()].filter((e) => e.boat && dist2d(e.ship.pos, f) < COLLIDE_RANGE).map((e) => e.boat); },
    /** Every sea ship's boat (their particles ride Come Sail Away's lists). */
    boats: () => [...sea.values()].map((e) => e.boat).filter(Boolean),
    /** SEA-COLOURS: the sea's flags of cloth this frame, the nearest first (scenes/shipFlagHost.js `seaFlags`). */
    seaFlags: () => seaFlagsOf(sea.values(), deps.feet(), seaWho),
    setEnabled(v) { if (enabled && !v) stowPlunder(); enabled = !!v; if (!enabled) clear(); },   // AUDIT KEEP-PLUNDER D3: stowed before the switch takes the sea
    get enabled() { return enabled; },
    get aiming() { return aiming; },
    /** Whether the attack is the broadside's: at the helm of a boat with guns. The world's doors read it - the drag and
     *  the look under a held attack are the aim's there, never the swing's, and the pad and the finger hold it plainly. */
    get atGuns() { return enabled && armed(myBoat()); },
    get boarding() { return boarding; },
    get notoriety() { return notoriety; },
    /** The probes' and the tests' reading. */
    stat: () => ({ ships: [...sea.values()].map((e) => ({ id: e.id, cls: e.ship.cls.id, owner: e.owner, pos: e.ship.pos.map((v) => +v.toFixed(1)), mode: e.ship.mode, state: e.ship.damage.state, hull: +e.ship.damage.hullShare().toFixed(2), built: !!e.boat })), inFlight: shots.inFlight, particles: effects.count, standing }),
    /** A test's and a console's door: a ship launched by class near the player. SEA-PEACE: a pirate launched by hand
     *  comes to fight (bold - the Sea battle's foe, a console's) unless `temper` names another; the rest their seed's. */
    spawnShip(classId, { range = 300, bearing = 0, yaw = null, temper = null } = {}) {
      const f = deps.feet();
      const pos = [f[0] + Math.sin(bearing) * range, deps.seaY(), f[2] + Math.cos(bearing) * range];
      const e = launch({ seed: u32(), classId, variant: 0, pos, yaw: yaw ?? bearing + Math.PI });
      if (e) e.ship.temper = Object.values(TEMPERS).includes(temper) ? temper : e.ship.cls.faction === 'pirate' ? TEMPERS.bold : e.ship.temper;
      if (e) e.plain = true;   // SPYGLASS: a hand-launched foe flies no false colours
      return e?.id ?? null;
    },
    _sea: sea, _shots: shots, _effects: effects, _contacts: contacts, _feel: feel,   // COMBAT-FEEL: the tests' door to the feel
    _myState: (boat) => myBoatState(boat),   // SHIP-CREW: the tests' door to a boat of mine's state (her damage, her crew)
    _charge: (act, id, o) => chargePlayer(act, sea.get(id), o),   // CAPT-LOG: the tests' door to the law's reckoning, by a ship's id
    _glass: () => ({ up: glassUp, on: glassOn, held: glassHeld, zoom: glassZoom }),   // SPYGLASS: the tests' door to the glass
    _sites: siteStood,   // CAPT-BOARD: the tests' door to the sites stood
    get volleyWire() { return wireVolleys; },
    directorState: director,
    SIDE_DIR,
  };
}
