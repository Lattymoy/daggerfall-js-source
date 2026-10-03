// @ts-check
// NAV-C (2026-09-28, Mac: "introduce actual sailing ships to the world that players can encounter and pillage") -
// THE CAPTAINS: how a ship of the Iliac Bay sails, keeps off the rocks and off other hulls, and fights. The port's own;
// pure - the host hands the wind, a water test and what else is at sea, and gets the ship moved and its volleys back.
//
// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") rebuilt the seamanship on what the movement
// audit measured: ships that stalled head to wind for minutes, spun like tops in a tenth of their own length, sailed
// through each other and over thin spits, and could never force, hold or chase a fight at half the player's speed.
//
// A SHIP SAILS BY THE WIND. Its way is its class's best (navalShips.js, rated at WIND_RATED - the player's own hulls'
// pace, Come Sail Away's) times the wind's strength over that, times the point of sail - the angle between its
// heading and where the wind blows TO: running before it most of its best, a broad reach all of it, close-hauled a
// third, head to wind in irons almost none (`windFactor`) - times what canvas it has left (navalDamage.js wayShare)
// and the sail it has set. A galley rows: under oars it never makes less than OARS_FLOOR of its best, whatever the
// wind. NO SHIP POINTS HIGHER THAN CLOSE-HAULED: a course into the wind's eye is beaten up to on a TACK, 45 degrees
// off the eye, coming about when the place it beats for bears TACK_FLIP past the eye on the other side (a galley
// strikes sail and rows it).
//
// IT TURNS LIKE A HULL. The helm takes over TURN_TAU (the hull's own) and the turn eases in and out - never past the
// course, the approach critically damped - at no more than her STEERAGE allows (HELM-WAY, systems/helmWay.js: the
// player's own responsive helm - her hull's helm times a curve of her way that answers at rest, bites hardest at half
// her way and eases toward her full way, so she turns tightest at half sail) and her class's handiness (`turn`); never
// under TURN_FLOOR, a galley's oars OARS_TURN. A turn at full helm costs her TURN_SPEED_LOSS of her way, and she heels
// into it - with her way, and to leeward with the wind on her beam - on a spring, settling rather than snapping.
//
// IT KEEPS OFF THE LAND. Every NAV_EVERY_S the lookout sounds the course she wants - from the stem out past her
// turning circle and LOOKAHEAD_S of her way (LOOKAHEAD_MIN at least), every SCAN_STEP, on the keel line and SCAN_MARGIN
// past either side of her hull - and when it is foul, the courses swung either side of it, nearest first; she keeps a
// swing until it is foul too or the course she swung from has been clear AVOID_HOLD_S; boxed in she comes about. A
// stem or a shoulder that would stand on land does not: she loses her way (AGROUND_WAY) and turns for open water.
// `isWater(x, z, hull)` is the host's word (the map's heights, the streamed ground where it is built, deep enough for
// her hull). AND OFF OTHER HULLS: one that will pass within both hulls' reach and AVOID_SHIP_CLEAR inside
// AVOID_SHIP_S is given room - to starboard for one ahead, as the rule of the road has it, away from one overtaking.
//
// IT FIGHTS AS A SHIP OF THE LINE. A captain with an enemy in reach (ENGAGE_RANGE, or a raider's own lookout) closes
// on a true intercept - the course that meets the enemy's way, read smoothed - to its class's range, then shows the
// side whose broadside will bear SOONEST: the turn to present it against its reload, the wind's eye costing its
// course, a course onto land none at all. Presented, it lays the enemy's LEAD abeam - where the enemy will be when the
// balls arrive - bent up to RANGE_BEND off the beam to keep its fighting range, her way matched to the enemy's
// along her course so the lead stays abeam (PRESENT_GAIN on how far it has drawn ahead or dropped astern) and never
// under PRESENT_SAILS of her sail: she keeps station yardarm to yardarm with a ship under way, and never sails past a
// slow one. A galley fights over its stem. It lets an enemy go past DISENGAGE times the reach it saw it at, or
// a chase that gains nothing in CHASE_GIVE_UP_S, and leaves that one be for SPARE_S. A merchant runs from a threat on
// the fastest point of sail away from it, and fires only what bears as it runs; a pirate short of hull runs too - a
// flagship never. A PIRATE COMES ALONGSIDE a player's boat that is crippled, holed under GRAPPLE_HULL or lying still
// GRAPPLE_STILL_S: on the side she comes up from, BERTH_GAP of water between the planks - up from astern to a boat
// under way, straight for the berth of one lying still, and within SWEEP_RANGE of it on her SWEEPS (pulled round the
// short way, a little way whatever the wind) - shortening sail as she closes, her broadsides held, and grapples across
// GRAPPLE_GAP of open water (the boarding is the host's: NAV-D, Warm Ashes' raid). A wreck no one aboard will board
// (no pirate, no men, the Boarders setting off) is not fired on and is left WRECK_SPARE_S on.
//
// WHO FIGHTS WHOM. Pirates take anything; a navy takes pirates, and the player when their notoriety in its crown's
// waters has reached NAVY_HUNTS (NAV-D) or they have fired on it or on a lawful ship it saw; a merchant fights no
// one and fires back only at who fired on it. `hostile(a, b)` is that table; `provoke` records a blow.
//
// SEA-PEACE (2026-09-29, the player: "some ships should be passive, not all should be hostile. Enemy AI and Friendly
// AI should engage in their own encounters naturally") - A CAPTAIN'S TEMPER (`temperOf`), drawn off her seed so every
// client in a room reads the same one: a merchant is PEACEFUL, a navy DUTIFUL (the table above), and a pirate BOLD -
// she takes anything her trade takes, as every pirate did - or, all but BOLD_SHARE of them (never the flagship, nor
// Warm Ashes' raiders, whom the host makes bold), WARY: she takes only a prize she outguns - her FIGHTING POWER
// (`fightingPower`: her weight of metal, her gunners' and her crew's share, times the hull she has left - the
// Lanchester product, so of two ships the greater wins the duel) at least WARY_ODDS of the quarry's - or one crippled
// or holed under GRAPPLE_HULL; a quarry she cannot size up she leaves be, and from a threat that outguns her she runs.
// A blow is answered by every temper. THE ENDS OF A FIGHT: a ship that struck to a captain (`struckTo`) is boarded
// by her - alongside on the board course, grappled across GRAPPLE_GAP, and held there (`lashed`) while the host takes
// her (navalHost.js takePrize). THE GUNS ARE HEARD: a navy with no enemy in sight answers gunfire within HEAR_GUNS_M
// of her fired in the last HEAR_S (`world.gunfire`), and sails for it until its fight is in her own lookout.
//
// SHIP-WATCH (2026-10-01, Mac: "I also want to keep improving the AI") - BY NIGHT (`world.night`) her lookout sees a
// contact only as far as its lanterns show it (shipWatch.js nightSight: a lit one NIGHT_LIT_SIGHT, a dark one
// NIGHT_DARK_SIGHT - `c.lit`), and a threat to run from no farther: a pirate running dark comes up on a merchantman
// unseen, and a player who douses their lanterns slips past a pirate at a cable's length. The guns are heard as ever,
// and a ship that fired in the last GUNS_SEEN_S is seen by her flashes as a lit one is.
//
// SEA-EASE (2026-10-01, Mac: "Friendly AI should help the player in combat") - A CROWN'S SHIP STANDS BY A LAWFUL PLAYER.
// Of the pirates in her lookout, one fighting a player she does not hunt (`standsBy`: in her fight or coming alongside
// them) is hers first - chosen as if AID_PRIORITY nearer than she is - so the cutter that comes up on a fight takes the
// pirate on the player's quarter, not the one a mile off; the director sends her (navalDirector.js THE RELIEF) and the
// host forgives the player's stray ball on her (navalHost.js ALLY_STRAY_SHARE). And the bay is gentler: a quarter of
// the pirates bold (BOLD_SHARE), and a boat lying still grappled only after GRAPPLE_STILL_S.

import { classById, batteryOf, hullBuild, GUNS, HULL, SHIP_CLASSES, SHIP_TOUGHNESS } from './navalShips.js';
import { mulberry32 } from '../../combat/bloodArt.js';   // SEA-PEACE: the temper's draw (navalShips.js names on the same stream kind)
import { createShipDamage, SHIP_STATES, STRUCK_AT, HOLED_BONUS, WATERLINE_BAND } from './navalDamage.js';
import { createGunDeck, aimSolution, reloadSeconds } from './navalGunnery.js';
import { NAVAL_DEG, rangeAt, SHOT_GRAVITY } from './navalBallistics.js';
import { BERTH_GAP } from './navalBoarding.js';
import { wrapAngle } from '../../world/mat4.js';   // ONCRASH1: the port's one angle wrap, which cannot loop
import { steerage, HULL_HELM, HELM_WAY } from '../helmWay.js';   // HELM-WAY: the player's own helm, the captains' too
import { stepErrand, MOOR_EASE_S } from './shipLife.js';   // SHIP-LIFE: a ship going somewhere
import { nightSight } from './shipWatch.js';   // SHIP-WATCH: by night a lit ship is seen far, a dark one close

/** A galley's oars: its least way, as a share of its best. */
export const OARS_FLOOR = 0.55;
/** How far ahead a helm looks past its stem and its turning circle: seconds of its way, and never less than this. */
export const LOOKAHEAD_S = 22;
export const LOOKAHEAD_MIN = 70;
/** The lookout's soundings: SCAN_STEP m apart out to the turning circle's far side and twice that beyond, each on the
 *  keel line and SCAN_MARGIN m past either side of the hull. */
export const SCAN_STEP = 6;
export const SCAN_MARGIN = 4;
/** The swings a foul course is tried at, nearest first (degrees). */
export const AVOID_SWINGS = Object.freeze([25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180]);
/** A swing is kept until the course it swung from has been clear this long (s); the lookout sounds this often (s). */
export const AVOID_HOLD_S = 3;
export const NAV_EVERY_S = 0.25;
/** A broadside bears within this of abeam; the chasers within BOW_BEAR of dead ahead (degrees). */
export const BEAR_DEG = 13;
export const BOW_BEAR = 11;
/**
 * AUDIT NAV1 (the guns) - THE RUN-OUT: a battery is run out RUN_OUT_S before it can fire - the tell the helm sees,
 * hears and braces for (the host's glint along her ports, the trucks' rumble, the readout's warning) - once it is
 * loaded, in its reach, with a lay that can strike her and no friend across the line, and the enemy's lead will bear
 * within RUN_OUT_S: in the fire's window now, or closing on it fast enough (the lead's bearing's own rate - its way
 * across her and her own turn); never past RUN_OUT_DEG of the beam (the chasers' BOW_RUN_OUT of the stem). It is
 * run in again past RUN_IN_DEG, out of reach, with the line fouled, or unfired RUN_OUT_WAIT_S past its time - and not
 * run out again for RUN_IN_S: a tell is a promise, never a stance.
 * THE FIRE: run out, and the lead inside the fire's window (`fireWindow`): the bearing off the battery's line that
 * still lays the volley across her - her half-extent across the line of fire, her length turned to it - the crew's
 * share of it: a crack crew waits for her middle (FIRE_EXTENT_K), a green one fires at her edge (FIRE_EXTENT_SKILL
 * more at no skill); never inside the gun's own spread, never past BEAR_DEG. A side whose window the wind will not let
 * her bring the lead into costs NO_BEAR_S more in the choosing (engageCourse): she tacks to show the other.
 */
export const RUN_OUT_S = 1.3;
export const RUN_OUT_DEG = 30;
export const BOW_RUN_OUT = 24;
export const RUN_IN_DEG = 45;
export const RUN_OUT_WAIT_S = 2.5;
export const RUN_IN_S = 2;
/** A tell is begun only with the lead inside this share of the battery's reach - never one the enemy sails out of. */
export const RUN_OUT_REACH = 0.92;
/** Loaded, she still opens the range from a lead inside this share of her fighting range - no slugging hull to hull. */
export const POINT_BLANK = 0.4;
/** Presented, the helm leads the turn by her heading's own rate (read over TRACK_TAU s; a jump past TRACK_JUMP degrees
 *  in a step is a new course, not a rate) - the orbit's turn - else it trails the lead 4 TURN_TAU times that rate aft of
 *  her beam, outside the fire's window (AUDIT NAV1, the guns: 8 degrees in a steady orbit at 90 m). */
export const TRACK_TAU = 0.5;
export const TRACK_JUMP = 20;
export const FIRE_EXTENT_K = 0.35;
export const FIRE_EXTENT_SKILL = 0.65;
export const NO_BEAR_S = 90;
/** The crew's lay, long or short of the lead by up to LAY_ERR of the range at no skill (none at the best), laid at
 *  AIM_FREEBOARD of her hull's height (her rig's middle for chain shot). */
export const LAY_ERR = 0.9;
export const AIM_FREEBOARD = 0.4;
/** A ship she does not take for an enemy within FRIEND_CLEAR of the line of fire holds it (m). */
export const FRIEND_CLEAR = 6;
/** An enemy is engaged inside this (m) and let go past DISENGAGE times the reach it was seen at; a threat is fled inside
 *  FLEE_RANGE. A chase that has not closed CHASE_GAIN of its range in CHASE_GIVE_UP_S is given up, and the one it
 *  chased left be for SPARE_S. */
export const ENGAGE_RANGE = 750;
/** A captain's lookout: how far she sees an enemy (m) - her own where she has one (a raider's, seaRaiders.js
 *  raiderSight), else ENGAGE_RANGE. One law for her captain and for a journey that slows before her (navalHost.js
 *  threats). */
export const lookoutOf = (ship) => ship.sight ?? ENGAGE_RANGE;
export const DISENGAGE = 1.35;
/** SEA-PEACE: a quarry runs from her while its way along her line of sight, away, is over this share of her own pace;
 *  and she lies abaft its beam more than ABAFT_DEG off its bow - the stern chase (engageCourse). */
export const CHASE_AWAY = 0.5;
export const ABAFT_DEG = 110;
/** SEA-PEACE: a stern chase runs the quarry down dead astern until within this many of her fighting ranges, then
 *  sheers out for a berth off the quarry's beam. */
export const CHASE_SHEER = 1.4;
/** AUDIT NAV2 F21: past her range she bends in on a runner at least steeply enough to close on it by this share of her
 *  pace (the asin of its way away over her pace, plus this) - a flat RANGE_BEND closed at half her pace. */
export const CHASE_MARGIN = 0.3;
/** AUDIT NAV2 F21: the chase's marks - her range to the one she chases, one every CHASE_MARK_S (s) - its gain read
 *  against the farthest of the last CHASE_GIVE_UP_S. */
export const CHASE_MARK_S = 2;
export const FLEE_RANGE = 320;
export const CHASE_GIVE_UP_S = 150;
export const CHASE_GAIN = 0.1;
export const SPARE_S = 300;
/** A pirate runs under this share of hull (a flagship never). TOUGHER-SHIPS: 0.33 before - her band between running and
 *  striking (STRUCK_AT) as many seconds of fire as it was, now each share of her hull takes SHIP_TOUGHNESS times the balls
 *  (0.08 of the old hull is 0.05 of the toughened one). */
export const PIRATE_RUNS_AT = 0.3;
/** A pirate grapples a boat within this (m) that is crippled (under GRAPPLE_HULL of hull) or has lain under
 *  GRAPPLE_STILL m/s for GRAPPLE_STILL_S - with at least GRAPPLE_CREW men to send. */
export const GRAPPLE_RANGE = 28;
/** Where both hulls are known the grapnels fly across this much open water between them (m) - the haul brings her in. */
export const GRAPPLE_GAP = 12;
export const GRAPPLE_HULL = 0.35;
export const GRAPPLE_STILL = 1.2;
/** SEA-EASE (Mac: "The sea is too dangerous right now"): a boat lying still is grappled after a quarter of a minute, not
 *  five seconds - a captain who stops to look about is not boarded for it. */
export const GRAPPLE_STILL_S = 15;
export const GRAPPLE_CREW = 6;
/** Coming alongside to board: she makes the pace that stops her BOARD_SAILS.from metres short of the berth at DECEL -
 *  never under .min of her sail - and matches the boat's own way. */
export const BOARD_SAILS = Object.freeze({ min: 0.3, from: 15 });
/** AUDIT NAV1 (online #10): HER SWEEPS - within SWEEP_RANGE of the berth of a boat lying still, a boarding pirate gets
 *  out her long oars: she is pulled round the short way at SWEEP_TURN degrees a second at least, through the wind's eye
 *  as readily as from it, and keeps SWEEP_WAY m/s of way whatever the wind (the pace that stops her short of the berth
 *  under it). Under sail alone she beat and wore round a wreck 60 m off for two minutes and more in a third of the
 *  winds - a brig wears through a circle of 150 m. HELM-WAY: her sweeps turn her as the player's own oars turn their
 *  Small Ship (Come Sail Away's turnSpeedOar 20 x the hull's 0.5) - her responsive helm alone passes the old 5 at a
 *  crawl. */
export const SWEEP_RANGE = 250;
export const SWEEP_WAY = 1.4;
export const SWEEP_TURN = 10;
/** AUDIT NAV2 F22 - A WAY ROUND THE LAND to a berth (a prize's, a boat lying still): the straight leg sounded every
 *  ROUTE_STEP m by her hull's width and, foul, one waypoint - ROUTE_DISTS out from her and from the berth on bearings
 *  ROUTE_TURN apart - whose legs both sound clear, the shortest way first, one across her line ROUTE_SWITCH times
 *  shorter to be taken; sought again every ROUTE_EVERY_S (a way not found every ROUTE_RETRY_S, and at once for a berth
 *  moved ROUTE_SLIP). A spit between her and a prize held her circling it for ever. */
export const ROUTE_STEP = 10;
export const ROUTE_EVERY_S = 1;
export const ROUTE_RETRY_S = 5;
export const ROUTE_TURN = 15;
export const ROUTE_DISTS = Object.freeze([60, 120, 200, 320, 480, 700, 1000]);
export const ROUTE_SWITCH = 1.2;
export const ROUTE_SLIP = 50;
/** A crippled boat no one here will board is not fired on, and left after this (s). */
export const WRECK_SPARE_S = 30;
/** A navy hunts a player whose notoriety in its crown has reached this (0..100, NAV-D). */
export const NAVY_HUNTS = 50;
/** The way a ship gains and loses (m/s^2), a heavy hull half as quick to gain it - she carries her way through a tack.
 *  HELM-WAY: the player's responsive helm's own (a Small Ship gathers 1.05 at the rated wind and coasts off at 0.6) -
 *  the captains' were 0.35 and 0.25, a brig 22 s to her way. */
export const ACCEL = 1;
export const DECEL = 0.6;
/** How long a blow keeps a ship provoked by who struck it (s). */
export const PROVOKED_S = 300;
/** SEA-PEACE: the tempers; the share of pirates drawn bold (the rest wary); the odds a wary pirate wants on a prize; the
 *  gunners' skill a player's boat is sized up at (a class's `skill` is her own); and how far and how long a navy hears
 *  gunfire (m, s). */
export const TEMPERS = Object.freeze({ peaceful: 'peaceful', dutiful: 'dutiful', bold: 'bold', wary: 'wary' });
/** SEA-EASE (Mac: "The sea is too dangerous right now"): a quarter of the pirates bold (two in five were). */
export const BOLD_SHARE = 0.25;
export const WARY_ODDS = 1.25;
export const PLAYER_GUN_SKILL = 0.6;
/** AUDIT NAV2 F25: the range a duel is sized at (m - the navy-pirate duels' own middle), and the turn (degrees) she comes
 *  round between volleys - her fire's pace is her reload and that turn at her own rate. */
export const DUEL_RANGE = 110;
export const TURN_PER_VOLLEY = 90;
export const HEAR_GUNS_M = 1600;
export const HEAR_S = 40;
/** SEA-EASE: a pirate fighting a player a crown's ship stands by is chosen as if this share of her distance off. */
export const AID_PRIORITY = 0.5;
/** SHIP-WATCH: a ship that fired within this (s) is seen by night as a lit one - her guns' flashes. */
export const GUNS_SEEN_S = 20;
/** AUDIT WK-N3: by night a ship that ran keeps running this long (s) from where she last saw the threat - a threat lost
 *  in the dark is not a threat gone (a merchantman relit at the edge of her sight while the pirate still hunted her). */
export const RUN_ON_S = 60;
/** The temper's own salt on her seed (never the name's stream, navalShips.js shipNames). */
const TEMPER_SALT = 0x7e3a9e1d;
/** The wind the classes' speeds are rated at - Come Sail Away's Random.Range(1, 2), its middle - and the bounds of the
 *  share a stronger or lighter wind makes of them. */
export const WIND_RATED = 1.5;
export const WIND_SHARE = Object.freeze([0.3, 2]);
/** Close-hauled: the nearest a ship points to the wind's eye, as its angle off the run (degrees; 135 is 45 off). */
export const CLOSE_HAULED = 135;
/** A tack is held at least TACK_MIN_S (s); she comes about when the place she beats for bears TACK_FLIP (degrees) past
 *  the wind's eye on the side she sails from. */
export const TACK_MIN_S = 12;
export const TACK_FLIP = 35;
/** How quickly a hull's helm takes (s), by hull. */
export const TURN_TAU = Object.freeze([0.5, 0.6, 1.0, 1.5, 1.2]);
/** Her helm never answers slower than this (degrees a second); a galley's oars turn her at OARS_TURN (HELM-WAY: the
 *  player's galley rows round at 15 - the captains' at 3 sailed a 240 m circle to show her bow). */
export const TURN_FLOOR = 1;
export const OARS_TURN = 6;
/** A turn at full helm costs this share of her way. */
export const TURN_SPEED_LOSS = 0.25;
/** The heel: a turn's (degrees per m/s of way per degree a second of turn), the wind's on the beam (degrees at the
 *  rated wind, all sail set), the most either way (degrees), and the spring she settles on (rad/s, its damping). */
export const HEEL_TURN = 0.15;
export const HEEL_WIND = 2;
export const HEEL_MAX = 12;
export const HEEL_OMEGA = 2.2;
export const HEEL_ZETA = 0.55;
/** Other hulls: watched within AVOID_SHIP_RANGE (m); one passing within both hulls' reach and AVOID_SHIP_CLEAR (m)
 *  inside AVOID_SHIP_S (s) is given room, up to AVOID_SHIP_SWING degrees - to starboard for one met within
 *  AVOID_HEAD_ON of the bow (the rule of the road), else away from the side she passes on. AUDIT NAV1 (the guns): the
 *  starboard rule once ran to 112.5 degrees, so a hull on her starboard beam had her steer into it. */
export const AVOID_SHIP_RANGE = 250;
export const AVOID_SHIP_S = 25;
export const AVOID_SHIP_CLEAR = 15;
export const AVOID_SHIP_SWING = 60;
export const AVOID_HEAD_ON = 22.5;
/** The enemy's way is read smoothed over TARGET_VEL_TAU (s); a pursuit with no intercept leads by PURSUIT_LEAD_S. */
export const TARGET_VEL_TAU = 1;
export const PURSUIT_LEAD_S = 20;
/** A broadside presented bends up to this (degrees) off the beam to keep her fighting range. */
export const RANGE_BEND = 30;
/** Presented within reach she keeps station: her way matched to the enemy's along her course, gaining PRESENT_GAIN a
 *  second on each metre the lead has drawn ahead of her beam (losing it astern), never under PRESENT_SAILS of her sail.
 *  AUDIT NAV1 (the guns): a flat PRESENT_SAILS dropped her astern of a boat under way, again and again. */
export const PRESENT_SAILS = 0.6;
export const PRESENT_GAIN = 0.08;
/** A side whose broadside heading lies past close-hauled is presented close-hauled instead; the degrees the enemy's
 *  lead then stands off the beam cost the side this many seconds each, when the sides are weighed. */
export const BEAR_COST_S = 1;
/** The side she shows is changed only for one that will bear SIDE_HOLD_S sooner, or when hers runs onto the land. */
export const SIDE_HOLD_S = 8;
/** A turn through the wind's eye is decided once, as it begins: a ship with less way than this share of her best wears
 *  - turns through the wind's lee, the long way round - rather than tack and lie in irons; one that tacks carries
 *  TACK_CARRY of the rate she went in with through the eye (her way shoots her through it). */
export const WEAR_BELOW = 0.45;
export const TACK_CARRY = 0.8;
/** Only a ship already this near the wind (degrees off the run) tacks; off it she wears, keeping her way. */
export const TACK_FROM = 110;
/** A ship lying in irons - within IRONS_DEG of the wind's eye with under IRONS_WAY m/s - pays off: the wind on her
 *  backed canvas swings her bow away at PAYOFF_TURN degrees a second. */
export const IRONS_DEG = 30;
export const IRONS_WAY = 1;
export const PAYOFF_TURN = 4;
/** A ship boxed in by the land shortens sail to BOXED_SAILS and, her way down to half again IRONS_WAY, is warped round
 *  where she lies at PAYOFF_TURN - a channel's end is turned in, not scraped round. */
export const BOXED_SAILS = 0.3;
/** A running ship takes the fastest point of sail within this of dead away (degrees). */
export const FLEE_SPREAD = 60;
/** A cruise's waypoint: out WAYPOINT_DIST (m), reached within WAYPOINT_REACHED, never upwind of close-hauled nor across
 *  land (the leg sounded every WAYPOINT_SOUND m); WAYPOINT_TRIES draws for one. */
export const WAYPOINT_DIST = Object.freeze([900, 2300]);
export const WAYPOINT_REACHED = 120;
export const WAYPOINT_SOUND = 60;
export const WAYPOINT_TRIES = 12;
/** A stem that would stand on land holds her there: her way falls to AGROUND_WAY of her best for AGROUND_S. */
export const AGROUND_WAY = 0.3;
export const AGROUND_S = 2;
/** A prize cast adrift drifts downwind at this (m/s). */
export const ADRIFT_SPEED = 0.35;

const DEG = NAVAL_DEG;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const forwardOfYaw = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
/** The quaternion of a yaw about +y (the root's rotation). */
export const quatOfYaw = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
const headingTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/**
 * The point of sail's share of a ship's best way: `offRun` the angle (radians, 0..PI) between its heading and where
 * the wind blows to - 0 running dead before it, PI head to wind.
 */
export function windFactor(offRun) {
  const d = Math.abs(offRun) / DEG;
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  if (d <= 40) return 0.85;
  if (d <= 100) return lerp(0.85, 1, (d - 40) / 60);
  if (d <= 135) return lerp(1, 0.7, (d - 100) / 35);
  if (d <= 150) return lerp(0.7, 0.35, (d - 135) / 15);
  return lerp(0.35, 0.08, (d - 150) / 30);
}

/** The share of her rated way a wind of strength `windLen` gives (Come Sail Away's way is linear in it). */
export const windShare = (windLen) => clamp(windLen / WIND_RATED, WIND_SHARE[0], WIND_SHARE[1]);

/**
 * A new ship at sea. `spec` - `{ id, seed, classId, variant, pos, yaw, names, owner, temper, errand }`; the class decides
 * the rest - SEA-PEACE: her temper her seed's (temperOf) unless one is named; SHIP-LIFE: her errand, if she has one.
 */
export function createSeaShip({ id, seed, classId, variant = 0, pos, yaw = 0, names = null, owner = null, temper = null, errand = null }) {
  const cls = classById(classId);
  if (!cls) throw new Error(`navalAI: no ship class '${classId}'`);
  const damage = createShipDamage({ hullHp: cls.hullHp, sailHp: cls.sailHp, crew: cls.crew });
  const ship = {
    id: String(id), seed: seed >>> 0, cls, hull: cls.hull, variant, names, owner,
    pos: [...pos], yaw: wrapAngle(yaw), speed: 0, turnNow: 0, sails: 1, heel: 0, settle: 0,
    /** AUDIT NAV1: the helm's rate (rad/s), the heel's (degrees a second), the sail she wants, her own clock (s) */
    yawRate: 0, heelVel: 0, sailsWant: 1, clock: 0,
    mode: 'cruise', target: null, waypoint: null, damage,
    /** SEA-PEACE: her temper (temperOf - the host makes a raider bold), the prize she lies lashed to while the host takes
     *  her ({ id } | null), and the gunfire she answers ({ pos, at } | null) */
    temper: Object.values(TEMPERS).includes(temper) ? temper : temperOf(cls, seed), lashed: null, heard: null, runOn: null,   // AUDIT WK-N3
    /** NAV-R: a raider's own lookout (m; null: ENGAGE_RANGE) and the course it sails ([x, z]; null: a waypoint of its own) */
    sight: null, course: null,
    /** SHIP-LIFE: what she is about when no fight is hers (shipLife.js errandFor: moored, depart, voyage, arrive, patrol,
     *  lurk; null: her own cruise) */
    errand,
    guns: createGunDeck(cls.hull, { crewed: true, crewShare: () => damage.crewShare() }),
    /** attacker id -> the time of its last blow */
    provoked: new Map(),
    /** contact id -> seconds it has lain still */
    stillFor: new Map(),
    /** contact id -> the clock she leaves it be until (a chase given up, a wreck left) */
    spare: new Map(),
    /** AUDIT NAV1: the lookout's swing off the land, the tack she beats on, the chase's tally, the enemy's way smoothed,
     *  the side she presents, the wreck she watches, the side she berths on, the seconds she lies aground, and the turn
     *  through the wind's eye she has committed to (tack or wear) */
    avoid: { swing: 0, heading: null, clearFor: 0, at: -Infinity, dir: 0 },
    tack: null, chase: null, tvel: null, present: null, wreck: null, berthSide: 0, aground: 0, turnWay: null,
    /** AUDIT NAV2 F22: a boarding's tally ({ id, since, best } - her way to the berth) and her way round the land to it
     *  ({ goal, wp, at, lost }) */
    approach: null, route: null,
    /** AUDIT NAV1 (online #10): the way her sweeps give her while she is pulled alongside (m/s; 0 under sail alone) */
    sweeps: 0,
    /** AUDIT NAV1 (the guns): the heading she steered for last step, and its rate - the presented helm's lead */
    wantPrev: null, wantRate: 0,
    /** AUDIT NAV1 (the guns): side -> her clock when that battery began to run out; side -> the clock it was run in */
    runOut: new Map(), runIn: new Map(),
    boarded: false,
    /** a prize cast adrift: she drifts downwind */
    adrift: false,
    volleySeq: 0,
    lastFire: -Infinity,
  };
  return ship;
}

/** The world velocity of a ship: its way along its heading. */
export const velocityOf = (ship) => { const f = forwardOfYaw(ship.yaw); return [f[0] * ship.speed, 0, f[2] * ship.speed]; };

/**
 * Whether faction `a`'s ship takes `b` (a contact: `{ kind: 'ship'|'player', faction?, id }`) for an enemy - a player
 * by the notoriety their contact carries (AUDIT NAV1, online #6: a peer's own word's), else by `opts.notoriety`.
 * SEA-PEACE: a pirate by her temper - a wary one only a prize she outguns (`takesPrize`); a blow is answered by all.
 * @param {any} ship
 * @param {{ kind: string, faction?: string, id: string, notoriety?: (crown: string | null) => number, power?: FighterMeasure | number | null,
 *   hullShare?: number, crippled?: boolean, ship?: any, hull?: number | null }} contact - SEA-PEACE: `power` her fighting power (a player's
 *   boat: the host's; a ship: her own, off `ship`), `hullShare`/`crippled` a hull a wary pirate falls on
 * @param {{ notoriety?: (crown: string | null) => number, now?: number }} [opts]
 */
export function hostile(ship, contact, { notoriety = () => 0, now = 0 } = {}) {
  const f = ship.cls.faction;
  if ((ship.provoked.get(contact.id) ?? -Infinity) > now - PROVOKED_S) return true;   // a blow, answered by every temper
  if (contact.kind === 'player') {
    if (f === 'pirate') return takesPrize(ship, contact);
    // AUDIT NAV1 (online #6): a player by their own notoriety - a peer's contact carries it, else the law handed in
    if (f === 'navy') return (contact.notoriety ?? notoriety)(ship.names?.crown ?? null) >= NAVY_HUNTS;
    return false;   // a merchant: only who fired on it
  }
  const g = contact.faction;
  if (f === 'pirate') return (g === 'merchant' || g === 'navy') && takesPrize(ship, contact);
  if (f === 'navy') return g === 'pirate';
  return false;
}

/** SEA-PEACE: whether a pirate takes this quarry - a bold one any; a wary one a prize she outguns WARY_ODDS to one, or
 *  one crippled or holed under GRAPPLE_HULL - never one she cannot size up. AUDIT NAV2 F25: the odds hers against it. */
function takesPrize(ship, contact) {
  if (ship.temper !== TEMPERS.wary) return true;
  const share = contact.hullShare ?? contact.ship?.damage?.hullShare?.() ?? 1;
  if (contact.crippled || share < GRAPPLE_HULL) return true;
  const theirs = sizeUp(contact);
  return theirs != null && odds(shipPower(ship), theirs) >= WARY_ODDS;
}

/** SEA-PEACE: whether a threat outguns her - its fighting power over hers (a player's boat by the power the host sized
 *  it at; one that cannot be sized up never does). AUDIT NAV2 F25: it makes her strike sooner than she does it. */
export function outguns(threat, ship) {
  const theirs = sizeUp(threat);
  return theirs != null && odds(theirs, shipPower(ship)) > 1;
}
/** AUDIT NAV2 F25: a contact sized up - its `power` (a player's boat: the host's fightingPower of her), else her own
 *  ship's; a bare number (an older word's) read off her hull as she stands; null when she cannot be. */
function sizeUp(c) {
  const p = c.power ?? (c.ship ? shipPower(c.ship) : null);
  if (typeof p !== 'number') return p;
  return c.hull == null ? null : fightingPower({ hull: c.hull, hullHp: hullBuild(c.hull).hullHp, hullShare: c.hullShare ?? 1 });
}

/**
 * SEA-PEACE: a captain's temper off her class and seed - a merchant peaceful, a navy dutiful, a pirate flagship bold,
 * and any other pirate bold on BOLD_SHARE of her seed's own draw, else wary (the host makes a raider bold).
 * @param {{ faction: string, flagship?: boolean }} cls
 * @param {number} seed
 */
export function temperOf(cls, seed) {
  if (cls.faction === 'merchant') return TEMPERS.peaceful;
  if (cls.faction === 'navy') return TEMPERS.dutiful;
  if (cls.flagship) return TEMPERS.bold;
  return mulberry32(((seed >>> 0) ^ TEMPER_SALT) >>> 0)() < BOLD_SHARE ? TEMPERS.bold : TEMPERS.wary;
}

/** AUDIT NAV2 F25: a ship's measure (fightingPower's answer).
 * @typedef {Readonly<{ hull: number, hullHp: number, hullShare: number, crewShare: number, crew: number, strikes: boolean,
 *   skill: number, range: number, turn: number, crewed: boolean, tactic: string }>} FighterMeasure */
/**
 * SEA-PEACE: a ship's FIGHTING POWER - AUDIT NAV2 F25 (Mac: "Model crew losses"): no longer one number (her weight of
 * metal times the hull she has left, which counted a hull's hurt a salvo only, so a sloop - whose swivels take two men a
 * ball, and a ship with no hands strikes - was fifteen times weaker than the cutter she beat 6 duels in 8, and a war
 * galley that could not lay a gun on her stronger still) but HER MEASURE, what one ship is sized against another by
 * (`strikeTime`, `odds`): her hull and its build, the hull and the men she has left, whether she strikes when they are
 * down (an AI ship does; a player's boat never), her gunners' skill, the range she fights at, her turn, and whether her
 * guns have a crew to load them. A player's boat's range and turn are her hull's (rangeOfHull, turnOfHull), and a galley's
 * great guns hers to fight with.
 * @param {{ hull: number, hullHp: number, hullShare?: number, crewShare?: number, crew?: number, strikes?: boolean,
 *   skill?: number, range?: number | null, turn?: number | null, crewed?: boolean, tactic?: string }} o
 */
export function fightingPower({ hull, hullHp, hullShare = 1, crewShare = 1, crew = 0, strikes = false, skill = PLAYER_GUN_SKILL, range = null, turn = null, crewed = true, tactic = null }) {
  return Object.freeze({
    hull, hullHp: Math.max(0, hullHp), hullShare: clamp(hullShare, 0, 1), crewShare: clamp(crewShare, 0, 1), crew: Math.max(0, crew), strikes: !!strikes,
    skill, range: range ?? rangeOfHull(hull), turn: turn ?? turnOfHull(hull), crewed: !!crewed, tactic: tactic ?? (hull === HULL.LargeGalley ? 'bow' : 'broadside'),
  });
}
/** SEA-PEACE: a sea ship's own fighting power, as she stands. */
export const shipPower = (ship) => fightingPower({
  hull: ship.hull, hullHp: ship.damage.maxHull, hullShare: ship.damage.hullShare(), crewShare: ship.damage.crewShare(), crew: ship.damage.crew,
  strikes: ship.damage.maxCrew > 0, skill: ship.cls.skill, range: ship.cls.range, turn: turnRateAt(ship, ship.cls.speed) / DEG, tactic: ship.cls.tactic,
});
/** SEA-PEACE: a class's power fresh from port - what the director pairs a staged encounter by. */
export const classPower = (cls) => fightingPower({
  hull: cls.hull, hullHp: cls.hullHp, crew: cls.crew, strikes: cls.crew > 0, skill: cls.skill, range: cls.range,
  turn: turnRateAt({ hull: cls.hull, cls }, cls.speed) / DEG, tactic: cls.tactic,
});
/** AUDIT NAV2 F25: a boat with no class of her own (a player's) fights at the nearest range any captain of her hull
 *  does, and turns at her hull's own helm at the steerage's peak (the oars' floor for a galley's). */
export const rangeOfHull = (hull) => { const on = SHIP_CLASSES.filter((c) => c.hull === hull); return Math.min(...(on.length ? on : SHIP_CLASSES).map((c) => c.range)); };
export const turnOfHull = (hull) => Math.max(hull === HULL.LargeGalley ? OARS_TURN : TURN_FLOOR, (HULL_HELM[hull] ?? 1) * steerage(HELM_WAY.steerPeakV));
/**
 * AUDIT NAV2 F25 - THE TIME ONE SHIP NEEDS TO MAKE ANOTHER STRIKE (s): her hull to STRUCK_AT, or - one that strikes when
 * her hands are down - her last man, whichever her fire does first. Her fire: her broadside (a galley's great guns and
 * her broadside by turns), a volley each reload - slower as her men fall (navalGunnery.js reloadSeconds) - and the
 * TURN_PER_VOLLEY she comes round between (her turn); none from a battery whose dead zone on the other's hull lies
 * past the range the other fights at (layMin: she cannot lay it there); each ball striking at the other's size
 * (hitShare), taking the gun's hull and men. Infinity for none.
 * @param {FighterMeasure} a @param {FighterMeasure} b
 */
export function strikeTime(a, b) {
  const sides = a.tactic === 'bow' ? ['bow', 'starboard'] : ['starboard'];
  let hull = 0, men = 0;
  for (const side of sides) {
    const bat = batteryOf(a.hull, side);
    if (!bat || layMin(a.hull, side, b.hull) > b.range) continue;
    const g = GUNS[bat.gun];
    const balls = bat.muzzles.length / sides.length / (reloadSeconds(bat.gun, a.crewShare, a.crewed) + TURN_PER_VOLLEY / Math.max(1, a.turn));
    const hits = balls * hitShare(bat, a.skill, b.hull);
    hull += hits * g.hull * (1 + HOLED_BONUS * Math.min(1, WATERLINE_BAND / hullBuild(b.hull).top));   // a low hull is holed at the waterline
    men += (hits * g.crew) / SHIP_TOUGHNESS;   // TOUGHER-SHIPS: a ball's men (navalDamage.js ballMen), as her hull's points
  }
  const byHull = hull > 0 ? b.hullHp * Math.max(0, b.hullShare - STRUCK_AT) / hull : Infinity;
  const byMen = b.strikes && men > 0 ? b.crew / men : Infinity;
  return Math.min(byHull, byMen);
}
/** AUDIT NAV2 F25: `a`'s odds against `b` - how many times sooner she makes `b` strike than `b` makes her (>1: she
 *  outguns her). The wary pirate's WARY_ODDS, the flight from a stronger ship and the director's plunder read it. */
export function odds(a, b) {
  const mine = strikeTime(a, b), theirs = strikeTime(b, a);
  if (mine === theirs) return 1;
  return mine === 0 || theirs === Infinity ? Infinity : theirs / mine;
}
/**
 * AUDIT NAV2 F25: the share of a battery's balls that strike a hull at DUEL_RANGE (her gunners' `skill`): the depth a
 * lay long or short of her still passes through her (her height over the ball's fall at her, and her beam) against the
 * lay's error and the carriage's scatter in its height, times her half length against the scatter across the fire and
 * the fire's window. Reckoned once for each battery, crew and hull.
 */
export function hitShare(bat, skill, targetHull) {
  const key = `${bat.gun}:${bat.muzzles[0][1]}:${skill}:${targetHull}`;
  let s = HIT_SHARE.get(key);
  if (s !== undefined) return s;
  const g = GUNS[bat.gun], b = hullBuild(targetHull), k = clamp(1.5 - skill, 0.4, 1.5), R = DUEL_RANGE;
  const t = R / g.speed, aimY = b.top * AIM_FREEBOARD;
  const fall = Math.max(0.02, (0.5 * SHOT_GRAVITY * t + (bat.muzzles[0][1] - aimY) / t) / g.speed);
  const deep = b.top / fall + 2 * b.halfWidth;
  const err = R * Math.hypot(0.5 * LAY_ERR * (1 - skill), Math.tan(g.pitchSpread * k * DEG) / fall);
  const halfLen = (b.bowZ - b.aftZ) / 2;
  const across = R * Math.tan(g.yawSpread * k * DEG) + halfLen * (FIRE_EXTENT_K + FIRE_EXTENT_SKILL * (1 - skill));
  s = Math.min(1, deep / (2 * err)) * Math.min(1, halfLen / across);
  HIT_SHARE.set(key, s);
  return s;
}
const HIT_SHARE = new Map();

/** A blow from `by` at `now`: the ship remembers who struck it. */
export function provoke(ship, by, now) { if (by != null) ship.provoked.set(String(by), now); }

// ── the hull's handling ────────────────────────────────────────────────────────────────────────────────────────────

/** A hull's length off its build (m). */
export const hullLength = (hull) => { const b = hullBuild(hull); return b.bowZ - b.aftZ; };
/** The most she turns at `v` m/s (rad/s): HELM-WAY's steerage times her hull's helm, never under the floor, never past
 *  her class's handiness. */
export function turnRateAt(ship, v) {
  const floor = (ship.hull === HULL.LargeGalley ? OARS_TURN : TURN_FLOOR) * DEG;
  return Math.min(ship.cls.turn * DEG, Math.max(floor, (HULL_HELM[ship.hull] ?? 1) * steerage(v) * DEG));
}
/** The most she turns now (rad/s). */
export const maxTurnRate = (ship) => turnRateAt(ship, ship.speed);
/** The circle she turns on at her class's own way (radius, m: that way over her rate at it; never under half her own
 *  length) - the room the lookout keeps and a side's course is sounded over, whatever way she has on now: a ship lying
 *  still is about to gather it. */
export const turnRadius = (ship) => Math.max(hullLength(ship.hull) * 0.5, ship.cls.speed / turnRateAt(ship, ship.cls.speed));

// ── the land ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Whether the course `yaw` is clear from `pos`: soundings every `step` metres from `from` out to `dist` (twice as far
 * apart past `near`), each on the line and `half` metres either side of it - a hull is wide. `isWater(x, z)`.
 * @param {number[]} pos
 * @param {number} yaw
 * @param {number} dist
 * @param {(x: number, z: number) => boolean} isWater
 * @param {{ half?: number, from?: number, near?: number, step?: number }} [opts]
 */
export function courseClear(pos, yaw, dist, isWater, { half = 10, from = 0, near = Infinity, step = SCAN_STEP } = {}) {
  // AUDIT BAY A21: a reach or a start that is no number - a way gone NaN - is no clear course: the soundings stepped
  // for ever toward it and the sea's frame never returned
  if (!Number.isFinite(dist) || !Number.isFinite(from) || !(step > 0)) return false;
  const f = forwardOfYaw(yaw), r = [f[2], 0, -f[0]];
  let s = Math.max(0, from);
  for (;;) {
    const x = pos[0] + f[0] * s, z = pos[2] + f[2] * s;
    if (!isWater(x, z) || !isWater(x + r[0] * half, z + r[2] * half) || !isWater(x - r[0] * half, z - r[2] * half)) return false;
    if (s >= dist) return true;
    s = Math.min(dist, s + (s < near ? step : step * 2));
  }
}

/** The lookout's reach for a ship: past her stem, her turning circle and LOOKAHEAD_S of her way. */
function lookout(ship) {
  const b = hullBuild(ship.hull);
  const rTurn = turnRadius(ship);
  return { from: b.bowZ * 0.5, near: b.bowZ + rTurn, dist: b.bowZ + rTurn + Math.max(LOOKAHEAD_MIN, ship.speed * LOOKAHEAD_S), half: b.halfWidth + SCAN_MARGIN };
}
const soundCourse = (ship, yaw, isWater) => { const l = lookout(ship); return courseClear(ship.pos, yaw, l.dist, isWater, { half: l.half, from: l.from, near: l.near }); };

/**
 * The course nearest `want` that is clear (AVOID_SWINGS), or the reciprocal of the heading when none is. Sounded
 * every NAV_EVERY_S of the ship's own clock - between soundings the last answer stands - and a swing is kept until it
 * is foul or `want` has been clear AVOID_HOLD_S.
 */
export function avoidLand(ship, want, isWater, wind = null) {
  const a = ship.avoid;
  if (ship.clock - a.at < NAV_EVERY_S) return a.heading != null ? a.heading : wrapAngle(want + a.swing * DEG);
  const since = Number.isFinite(a.at) ? ship.clock - a.at : 0;
  a.at = ship.clock;
  const out = avoidLandSounded(ship, want, isWater, wind, since);
  // a turn of more than 120 degrees near the land: round on the side with the more open water
  const turn = wrapAngle(out - ship.yaw);
  if (Math.abs(turn) > 120 * DEG && !a.dir) {
    const r = roomEither(ship, isWater);
    a.dir = r.right === r.left ? 0 : r.right > r.left ? 1 : -1;
  } else if (Math.abs(turn) <= 120 * DEG) a.dir = 0;
  return out;
}
/** The open water either side of her: how many of three courses 45, 90 and 135 degrees off to each side sound clear
 *  out to her turning circle's reach. */
function roomEither(ship, isWater) {
  const l = lookout(ship);
  const count = (side) => { let n = 0; for (const k of [45, 90, 135]) if (courseClear(ship.pos, wrapAngle(ship.yaw + side * k * DEG), l.near, isWater, { half: l.half, from: l.from })) n++; return n; };
  return { right: count(1), left: count(-1) };
}
function avoidLandSounded(ship, want, isWater, wind, since) {
  const a = ship.avoid;
  const wantClear = soundCourse(ship, want, isWater);
  if (a.heading == null && a.swing === 0) {
    if (wantClear) return want;
  } else {
    a.clearFor = wantClear ? a.clearFor + since : 0;
    if (a.clearFor >= AVOID_HOLD_S) { a.swing = 0; a.heading = null; a.clearFor = 0; return want; }
    if (a.heading == null && soundCourse(ship, wrapAngle(want + a.swing * DEG), isWater)) return wrapAngle(want + a.swing * DEG);
    if (wantClear) { a.swing = 0; a.heading = null; a.clearFor = 0; return want; }   // the swing is foul and the course clear again
  }
  // the nearest clear swing she can sail (a galley rows any), else the nearest clear one at all
  for (const any of [false, true]) {
    for (const s of AVOID_SWINGS) {
      const y = wrapAngle(want + s * DEG);
      if (!any && wind && sailable(ship, y, wind) !== y) continue;
      if (soundCourse(ship, y, isWater)) { a.swing = s; a.heading = null; a.clearFor = 0; return y; }
    }
  }
  // boxed in: about - round toward the side with the more open water, never swinging the stem across the land
  const r = roomEither(ship, isWater);
  const side = r.right >= r.left ? 1 : -1;
  a.swing = 0; a.clearFor = 0;
  a.heading = wrapAngle(ship.yaw + side * (Math.PI - 1e-3));
  return a.heading;
}

// ── bearings, the lead, the intercept ───────────────────────────────────────────────────────────────────────────────

/** The bearing of a point off a ship's bow (radians, + starboard) and its distance on the flat. */
export function bearingTo(ship, p) {
  const dx = p[0] - ship.pos[0], dz = p[2] - ship.pos[2];
  return { bearing: wrapAngle(Math.atan2(dx, dz) - ship.yaw), dist: Math.hypot(dx, dz) };
}

/**
 * Where to lay for a moving enemy: its position after the flight, the flight found by iterating the range twice.
 * `rel` the enemy's velocity less ours (the balls carry our own).
 */
export function leadPoint(from, target, rel, speed) {
  let p = [...target];
  for (let i = 0; i < 3; i++) {
    const d = Math.hypot(p[0] - from[0], p[2] - from[2]);
    const t = d / Math.max(1, speed * 0.97);   // the flight: the ball's way along the flat (cos of a laid gun ~0.97)
    p = [target[0] + rel[0] * t, target[1], target[2] + rel[2] * t];
  }
  return p;
}

/**
 * The course that meets a target: the smallest t with |P + V t| = s t (P where it is from us, V its way, s ours) - or,
 * when it outruns us, a pursuit leading it by at most PURSUIT_LEAD_S. Answers `{ heading, point, t }`.
 */
export function intercept(from, speed, target, vel) {
  const P = [target[0] - from[0], target[2] - from[2]], V = [vel?.[0] ?? 0, vel?.[2] ?? 0];
  const s = Math.max(0.5, speed);
  const a = V[0] * V[0] + V[1] * V[1] - s * s, b = 2 * (P[0] * V[0] + P[1] * V[1]), c = P[0] * P[0] + P[1] * P[1];
  let t = null;
  if (Math.abs(a) < 1e-9) t = b < 0 ? -c / b : null;
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const q = Math.sqrt(disc);
      const roots = [(-b - q) / (2 * a), (-b + q) / (2 * a)].filter((r) => r > 0);
      t = roots.length ? Math.min(...roots) : null;
    }
  }
  if (t == null) t = Math.min(PURSUIT_LEAD_S, Math.sqrt(c) / s);
  const point = [target[0] + V[0] * t, target[1] ?? 0, target[2] + V[1] * t];
  return { heading: headingTo(from, point), point, t };
}

// ── the wind's eye ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The angle between a heading and where the wind blows to (0 running, PI in irons). */
function offRunOf(yaw, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (wl < 1e-6) return Math.PI / 2;
  return Math.abs(wrapAngle(yaw - Math.atan2(wind[0], wind[2])));
}

/**
 * A course no nearer the wind's eye than close-hauled: `want` itself, or the tack she beats on toward `goal` - held
 * TACK_MIN_S at least, put about when the goal bears TACK_FLIP past the eye on the side she sails from. A galley rows.
 */
export function tackCourse(ship, want, goal, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (ship.hull === HULL.LargeGalley || wl < 1e-6 || offRunOf(want, wind) <= CLOSE_HAULED * DEG) { ship.tack = null; return want; }
  const eye = wrapAngle(Math.atan2(wind[0], wind[2]) + Math.PI);
  const g = goal ?? [ship.pos[0] + Math.sin(want) * 1000, 0, ship.pos[2] + Math.cos(want) * 1000];
  const a = wrapAngle(headingTo(ship.pos, g) - eye);
  const flip = TACK_FLIP * DEG;
  if (!ship.tack) {
    const side = Math.abs(a) > flip ? Math.sign(a) : (wrapAngle(ship.yaw - eye) >= 0 ? 1 : -1);
    ship.tack = { side, since: ship.clock };
  } else if (ship.clock - ship.tack.since >= TACK_MIN_S && ((ship.tack.side > 0 && a < -flip) || (ship.tack.side < 0 && a > flip))) {
    ship.tack = { side: -ship.tack.side, since: ship.clock };
  }
  return wrapAngle(eye + ship.tack.side * (180 - CLOSE_HAULED) * DEG);
}

/** The heading nearest `want` a ship can sail - `want`, or close-hauled on its side of the wind's eye (a galley rows
 *  any course). */
export function sailable(ship, want, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (ship.hull === HULL.LargeGalley || wl < 1e-6 || offRunOf(want, wind) <= CLOSE_HAULED * DEG) return want;
  const eye = wrapAngle(Math.atan2(wind[0], wind[2]) + Math.PI);
  return wrapAngle(eye + (wrapAngle(want - eye) >= 0 ? 1 : -1) * (180 - CLOSE_HAULED) * DEG);
}

// ── other hulls ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A hull's reach for passing clear: between its half beam and its half length. */
const passReach = (hull) => { const b = hullBuild(hull); return 0.5 * (b.halfWidth + (b.bowZ - b.aftZ) / 2); };

/**
 * `want` bent clear of the hulls about her (`contacts` with a `hull`): each that will pass within both reaches and
 * AVOID_SHIP_CLEAR inside AVOID_SHIP_S bends it by its urgency - to starboard for one forward of the beam, away from
 * one abaft it - up to AVOID_SHIP_SWING in all. `except` is left out (the ship she means to lie alongside).
 */
export function trafficCourse(ship, want, contacts, except = null) {
  const my = velocityOf(ship);
  const mine = passReach(ship.hull);
  let bend = 0;
  for (const c of contacts ?? []) {
    if (c.id === ship.id || c.id === except || c.gone || c.hull == null) continue;
    const p = [c.pos[0] - ship.pos[0], c.pos[2] - ship.pos[2]];
    if (Math.hypot(p[0], p[1]) > AVOID_SHIP_RANGE) continue;
    const v = [(c.vel?.[0] ?? 0) - my[0], (c.vel?.[2] ?? 0) - my[2]];
    const vv = v[0] * v[0] + v[1] * v[1];
    const tca = vv > 1e-6 ? Math.max(0, -(p[0] * v[0] + p[1] * v[1]) / vv) : 0;
    if (tca > AVOID_SHIP_S) continue;
    const dca = Math.hypot(p[0] + v[0] * tca, p[1] + v[1] * tca);
    const reach = mine + passReach(c.hull) + AVOID_SHIP_CLEAR;
    if (dca >= reach) continue;
    const urgency = (1 - dca / reach) * (1 - tca / AVOID_SHIP_S);
    const brg = wrapAngle(Math.atan2(p[0], p[1]) - ship.yaw);
    const side = wrapAngle(Math.atan2(p[0] + v[0] * tca, p[1] + v[1] * tca) - ship.yaw);   // where she lies at the closest
    const dir = Math.abs(brg) < AVOID_HEAD_ON * DEG ? 1 : side > 0 ? -1 : 1;
    bend += dir * urgency * AVOID_SHIP_SWING * DEG;
  }
  return wrapAngle(want + clamp(bend, -AVOID_SHIP_SWING * DEG, AVOID_SHIP_SWING * DEG));
}

// ── the captain ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One step of a captain. `world`:
 *   now, dt, seaY, wind (where the wind blows to, its length the strength), isWater(x, z, hull),
 *   contacts: [{ id, kind: 'player'|'ship', faction?, pos, vel, speed, yaw?, hull?, hullShare?, crippled?, peer?, ship? }],
 *   notoriety(crown) -> 0..100, random() -> [0, 1), boarders (false: the Boarders setting off - no one grapples)
 * Answers `{ volleys: [{ side, solution }], barrels: [solution], grapple: contactId | null }`; the ship itself moved.
 */
export function stepCaptain(ship, world) {
  const out = { volleys: [], barrels: [], grapple: null, runOuts: [] };
  const dt = Math.max(0, world.dt);
  ship.clock += dt;
  const st = ship.damage.state;
  const isWater = (x, z) => world.isWater(x, z, ship.hull);
  ship.guns.step(dt);
  if (st !== SHIP_STATES.afloat || ship.boarded) {
    ship.runOut.clear();   // a ship that no longer fights runs her guns in
    // AUDIT NAV2 F23: and fights no one - two struck to each other each held the other's prize "come for" for ever
    ship.target = null; ship.berthSide = 0; ship.present = null; ship.chase = null; ship.approach = null; ship.route = null;
  }
  if (st === SHIP_STATES.sinking || st === SHIP_STATES.sunk) {
    ship.speed = Math.max(0, ship.speed - DECEL * dt);
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    helm(ship, ship.yaw, dt, world, 0);
    moveShip(ship, dt, null);
    return out;
  }
  if (st === SHIP_STATES.struck || st === SHIP_STATES.prize || ship.boarded) {
    ship.mode = st === SHIP_STATES.prize ? 'prize' : ship.boarded ? 'boarded' : 'struck';
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    ship.speed = Math.max(0, ship.speed - DECEL * 0.6 * dt);
    helm(ship, ship.yaw, dt, world, 0);
    moveShip(ship, dt, isWater);
    if (ship.adrift && st === SHIP_STATES.prize) drift(ship, dt, world.wind, isWater);
    return out;
  }
  // SEA-PEACE: lashed alongside a prize she is taking - her guns in, her way off, until the host has taken her
  if (ship.lashed) {
    ship.mode = 'board';
    ship.target = ship.lashed.id;
    ship.runOut.clear();
    ship.sweeps = 0;
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    ship.speed = Math.max(0, ship.speed - DECEL * 2 * dt);
    helm(ship, ship.yaw, dt, world, 0);
    moveShip(ship, dt, isWater);
    return out;
  }

  // who is out there, and who is an enemy - the one she fights kept until it is past DISENGAGE of its reach
  const sight = lookoutOf(ship);
  let enemy = null, enemyD = Infinity, threat = null, threatD = Infinity, prize = null, prizeD = Infinity;
  const aids = standsBy(ship, world);   // SEA-EASE: the players a crown's ship stands by
  // SHIP-WATCH: who showed themselves by their guns' flashes lately (by night, seen as a lit ship is)
  const flashed = world.night ? new Set((world.gunfire ?? []).filter((g) => world.now - g.at <= GUNS_SEEN_S).map((g) => g.by)) : null;
  for (const c of world.contacts ?? []) {
    if (c.id === ship.id || c.gone) continue;
    const { dist } = bearingTo(ship, c.pos);
    // SEA-PEACE: a ship struck to HER is her prize to board - nobody's enemy, nobody's threat (AUDIT NAV2 F22: one she
    // gave up, left be)
    if (c.struck) { if (c.struckTo === ship.id && dist < prizeD && !((ship.spare.get(c.id) ?? -Infinity) > ship.clock)) { prize = c; prizeD = dist; } continue; }
    const held = c.id === ship.target && (ship.mode === 'engage' || ship.mode === 'board');
    const lit = !!c.lit || !!flashed?.has(c.id);
    const see = nightSight(sight, { night: !!world.night, lit });   // SHIP-WATCH: by night, by her lanterns (or her guns)
    if (hostile(ship, c, world) && !((ship.spare.get(c.id) ?? -Infinity) > ship.clock)) {
      // SEA-EASE: a pirate fighting a player she stands by is hers first
      const rank = (held ? dist * 0.8 : dist) * (aids && fightsAny(c, aids) ? AID_PRIORITY : 1);
      if (dist < (held ? see * DISENGAGE : see) && rank < enemyD) { enemy = c; enemyD = rank; }
    }
    // a threat is anything hostile that would take US - SEA-PEACE: sized up by her own power, and a player who fired on
    // her a threat to a pirate too (a wary one runs from a stronger one; a bold one fights it out, as she did)
    const theyTakeUs = c.kind === 'ship' ? c.ship && hostile(c.ship, { kind: 'ship', faction: ship.cls.faction, id: ship.id, ship }, world) : (ship.provoked.get(c.id) ?? -Infinity) > world.now - PROVOKED_S;
    if (theyTakeUs && dist < nightSight(FLEE_RANGE, { night: !!world.night, lit }) && dist < threatD) { threat = c; threatD = dist; }   // SHIP-WATCH: a threat seen
  }
  if (enemy) enemyD = bearingTo(ship, enemy.pos).dist;
  for (const c of world.contacts ?? []) {
    if (c.kind !== 'player') continue;
    ship.stillFor.set(c.id, (c.speed ?? 0) < GRAPPLE_STILL ? (ship.stillFor.get(c.id) ?? 0) + dt : 0);
  }
  enemy = chaseOrGiveUp(ship, enemy, enemyD);
  if (!enemy) enemyD = Infinity;
  const boards = !!enemy && boardsHer(ship, enemy, world);
  enemy = leaveTheWreck(ship, enemy, boards);
  if (!enemy) enemyD = Infinity;

  const runs = (ship.cls.faction === 'merchant' && (threat || enemy))
    || (ship.cls.faction === 'pirate' && !ship.cls.flagship && ship.damage.hullShare() < PIRATE_RUNS_AT && (threat || enemy))
    || (ship.cls.faction === 'pirate' && ship.temper === TEMPERS.wary && !!threat && outguns(threat, ship));   // SEA-PEACE: a wary pirate runs from a stronger ship
  if (ship.runOn && !(world.night && world.now < ship.runOn.until)) ship.runOn = null;   // AUDIT WK-N3: the run's end, or the day
  let plan;
  if (runs) {
    const from = threat ?? enemy;
    ship.mode = 'flee';
    ship.target = from.id;
    ship.runOn = { id: from.id, pos: [from.pos[0], from.pos[1], from.pos[2]], until: world.now + RUN_ON_S };   // AUDIT WK-N3: by night (the day clears it)
    plan = fleeCourse(ship, from, world.wind);
  } else if (ship.runOn && !enemy) {
    // AUDIT WK-N3: by night she runs on, dark, from where she last saw it
    ship.mode = 'flee';
    ship.target = ship.runOn.id;
    plan = fleeCourse(ship, ship.runOn, world.wind);
  } else if (enemy && ship.cls.faction !== 'merchant') {
    trackTarget(ship, enemy, dt);
    ship.target = enemy.id;
    if (boards) {
      ship.mode = 'board';
      plan = boardCourse(ship, enemy, world.wind, isWater);
      if (!plan) { plan = giveUp(ship, enemy); enemy = null; }   // AUDIT NAV2 F22: a boarding that gains nothing - she leaves the boat be
    } else { ship.mode = 'engage'; ship.berthSide = 0; plan = engageCourse(ship, enemy, enemyD, world, isWater); }
  } else if (prize && ship.damage.crew > 0 && ship.cls.faction !== 'merchant') {
    // SEA-PEACE: the end of her fight - alongside the ship that struck to her, to take her: she has surrendered, so any
    // men to send will do (GRAPPLE_CREW is for carrying a deck that fights - a player's). AUDIT NAV2 F30 (Mac: "No, they
    // sail on"): a merchantman takes no prize - navies and pirates do
    ship.mode = 'board';
    ship.target = prize.id;
    plan = boardCourse(ship, prize, world.wind, isWater);
    if (!plan) { plan = giveUp(ship, prize); prize = null; }   // AUDIT NAV2 F22: and one she cannot come at - spared
  } else {
    ship.target = null;
    ship.berthSide = 0;
    // SEA-PEACE: a navy with no enemy in sight sails for the guns she hears
    ship.heard = ship.cls.faction === 'navy' ? heardGuns(ship, world) : null;
    if (ship.heard) {
      ship.mode = 'answer';
      plan = { want: headingTo(ship.pos, ship.heard.pos), goal: [ship.heard.pos[0], 0, ship.heard.pos[2]], sails: 1 };
    } else {
      // SHIP-LIFE: no fight of hers - her errand (shipLife.js), taken up again with a way planned anew after one; a
      // raider's course and a ship with none keep the cruise
      if (ship.mode !== 'cruise' && ship.errand) ship.errand.path = null;
      ship.mode = 'cruise';
      const life = ship.errand && !ship.course && world.life ? stepErrand(ship, dt, world.life) : null;
      if (life?.hold) return moor(ship, life.hold, dt, out);
      // into a harbour or out of it with the wind in her teeth: warped on her sweeps, as a boarding's pirate is pulled
      // alongside (a coaster beat for forty minutes in the lee of a headland and never came in)
      if (life && (ship.errand?.kind === 'arrive' || ship.errand?.kind === 'depart') && sailable(ship, life.want, world.wind) !== life.want) { life.sweeps = SWEEP_WAY; life.sailable = true; }
      plan = life ?? { want: cruiseCourse(ship, world.wind, isWater, world.random ?? Math.random), goal: ship.course ? [ship.course[0], 0, ship.course[1]] : ship.waypoint ? [ship.waypoint[0], 0, ship.waypoint[1]] : null, sails: 1 };
    }
  }
  if (ship.mode !== 'board') { ship.approach = null; ship.route = null; }   // AUDIT NAV2 F22: a boarding's tally and way are its own
  ship.sweeps = plan.sweeps ?? 0;   // AUDIT NAV1 (online #10): her sweeps out, or in
  let want = plan.sailable ? plan.want : tackCourse(ship, plan.want, plan.goal, world.wind);
  want = trafficCourse(ship, want, world.contacts, ship.mode === 'board' ? ship.target : null);
  if (!plan.berthing) want = avoidLand(ship, want, isWater, world.wind);   // SHIP-LIFE: the last leg into a sounded berth

  // the sail, the helm and the way - boxed in by the land she shortens sail and pivots
  ship.sailsWant = ship.avoid.heading != null ? Math.min(plan.sails, BOXED_SAILS) : plan.sails;
  ship.sails = clamp(ship.sails + clamp(ship.sailsWant - ship.sails, -0.5 * dt, 0.4 * dt), 0, 1);
  helm(ship, want, dt, world, 1, plan.track ? trackRate(ship, want, dt) : (ship.wantPrev = null, ship.wantRate = 0));
  moveShip(ship, dt, isWater);

  // the guns - held at a wreck, and all but the chasers while she comes alongside
  if (!ship.guns.braced && !(enemy?.crippled && enemy.kind === 'player')) {
    gunnery(ship, world, enemy ?? (ship.cls.faction === 'merchant' ? threat : null), out, { broadsides: ship.mode !== 'board' });
  } else ship.runOut.clear();

  // the grapple: a pirate with men to send, alongside a crippled, holed or stopped boat - GRAPPLE_GAP of water between
  // the hulls where both are known, else within GRAPPLE_RANGE
  if (ship.mode === 'board') {
    const q = enemy ?? prize;   // SEA-PEACE: or the prize she comes alongside
    const close = q.hull != null && Number.isFinite(q.yaw) ? hullGap(ship.pos, ship.yaw, ship.hull, q.pos, q.yaw, q.hull) <= GRAPPLE_GAP : bearingTo(ship, q.pos).dist <= GRAPPLE_RANGE;
    if (close) out.grapple = q.id;
  }
  return out;
}

/** SEA-EASE: the players a crown's ship stands by - every player in her contacts she does not take for an enemy - or
 *  null (she is no crown's ship, or stands by no one). */
function standsBy(ship, world) {
  if (ship.cls.faction !== 'navy') return null;
  let ids = null;
  for (const c of world.contacts ?? []) if (c.kind === 'player' && !hostile(ship, c, world)) (ids ??= new Set()).add(c.id);
  return ids;
}
/** SEA-EASE: whether a contact is a ship fighting one of `ids` - in her fight with them, or coming alongside them. */
export const fightsAny = (c, ids) => c.kind === 'ship' && !!c.ship && ids.has(c.ship.target) && (c.ship.mode === 'engage' || c.ship.mode === 'board');

/** SHIP-LIFE: moored - her way off, her sails stowed, eased onto her berth over MOOR_EASE_S (shipLife.js): no helm, no
 *  way, nothing she steers round; her guns run in. */
function moor(ship, hold, dt, out) {
  const k = Math.min(1, dt / MOOR_EASE_S);
  ship.pos[0] += (hold.pos[0] - ship.pos[0]) * k;
  ship.pos[2] += (hold.pos[1] - ship.pos[2]) * k;
  ship.yaw = wrapAngle(ship.yaw + wrapAngle(hold.yaw - ship.yaw) * k);
  ship.speed = 0; ship.turnNow = 0; ship.yawRate = 0; ship.sweeps = 0;
  ship.sailsWant = 0;
  ship.sails = Math.max(0, ship.sails - dt * 0.5);
  ship.runOut.clear();
  ship.target = null;
  return out;
}

/** SEA-PEACE: the gunfire a navy answers (`world.gunfire`: `[{ pos, at, by }]`) - the nearest fired by another within
 *  HEAR_GUNS_M of her in the last HEAR_S, and not yet within half her lookout (there the table decides who she fights). */
function heardGuns(ship, world) {
  // AUDIT WK-N2: half the lookout she sees by - by night a dark ship's (she stopped answering at half her day's, and
  // turned from a fight her night's lookout could not see)
  const near = nightSight(lookoutOf(ship), { night: !!world.night, lit: false }) * 0.5;
  let best = null, bestD = Infinity;
  for (const g of world.gunfire ?? []) {
    if (g.by === ship.id || !(world.now - g.at <= HEAR_S)) continue;
    const d = Math.hypot(g.pos[0] - ship.pos[0], g.pos[2] - ship.pos[2]);
    if (d > HEAR_GUNS_M || d < near || d >= bestD) continue;
    best = g; bestD = d;
  }
  return best;
}

/** A pirate's boarding: a player's boat - AUDIT NAV1 (online #10): another player's too, whose own word lets pirates
 *  board them (the grapple theirs to take her over by) - men to send, the Boarders setting on, and the boat crippled,
 *  holed or lying still. */
function boardsHer(ship, enemy, world) {
  if (ship.cls.faction !== 'pirate' || enemy.kind !== 'player' || (enemy.peer ? enemy.boarders === false : world.boarders === false)) return false;
  if (ship.damage.crew < GRAPPLE_CREW || ship.damage.hullShare() < PIRATE_RUNS_AT) return false;
  return !!enemy.crippled || (enemy.hullShare ?? 1) < GRAPPLE_HULL || (ship.stillFor.get(enemy.id) ?? 0) >= GRAPPLE_STILL_S;
}

/** A wreck no one here will board is not fought: after WRECK_SPARE_S watching it she leaves it be. */
function leaveTheWreck(ship, enemy, boards) {
  if (!enemy || boards || !(enemy.crippled && enemy.kind === 'player')) { if (!enemy || ship.wreck?.id !== enemy.id) ship.wreck = null; return enemy; }
  if (ship.wreck?.id !== enemy.id) ship.wreck = { id: enemy.id, since: ship.clock };
  if (ship.clock - ship.wreck.since < WRECK_SPARE_S) return enemy;
  ship.spare.set(enemy.id, ship.clock + SPARE_S);
  ship.wreck = null;
  return null;
}

/** The chase's tally: a new enemy starts it; one not closed by CHASE_GAIN in CHASE_GIVE_UP_S - while still past her
 *  fighting range - is given up and left be for SPARE_S. AUDIT NAV2 F21: the gain read against the farthest she has
 *  lain in the last CHASE_GIVE_UP_S (her marks, one every CHASE_MARK_S) - against the best she ever did, a chase that
 *  lost ground and was closing again was given up. */
function chaseOrGiveUp(ship, enemy, d) {
  if (!enemy) { ship.chase = null; return null; }
  if (ship.chase?.id !== enemy.id) ship.chase = { id: enemy.id, since: ship.clock, marks: [] };
  const c = ship.chase;
  if (!c.marks.length || ship.clock - c.marks[c.marks.length - 1][0] >= CHASE_MARK_S) c.marks.push([ship.clock, d]);
  while (c.marks.length > 1 && ship.clock - c.marks[0][0] > CHASE_GIVE_UP_S) c.marks.shift();
  const far = c.marks.reduce((m, k) => Math.max(m, k[1]), d);
  if (d < far * (1 - CHASE_GAIN) || d <= ship.cls.range * CLOSE_FROM) c.since = ship.clock;   // closing, or in the fight
  if (ship.clock - ship.chase.since > CHASE_GIVE_UP_S && d > ship.cls.range * CLOSE_FROM) {
    ship.spare.set(enemy.id, ship.clock + SPARE_S);
    ship.chase = null;
    return null;
  }
  return enemy;
}

/** The enemy's way, smoothed over TARGET_VEL_TAU - its turns read as turns, not as each frame's jitter. */
function trackTarget(ship, enemy, dt) {
  const v = enemy.vel ?? [0, 0, 0];
  if (ship.tvel?.id !== enemy.id) { ship.tvel = { id: enemy.id, v: [v[0], 0, v[2]] }; return; }
  const k = 1 - Math.exp(-dt / TARGET_VEL_TAU);
  ship.tvel.v[0] += (v[0] - ship.tvel.v[0]) * k;
  ship.tvel.v[2] += (v[2] - ship.tvel.v[2]) * k;
}

/** The rate her wanted heading turns at (rad/s), read smoothed over TRACK_TAU - a jump past TRACK_JUMP a new course. */
function trackRate(ship, want, dt) {
  if (ship.wantPrev == null || !(dt > 0)) { ship.wantPrev = want; ship.wantRate = 0; return 0; }
  const step = wrapAngle(want - ship.wantPrev);
  ship.wantPrev = want;
  if (Math.abs(step) > TRACK_JUMP * DEG) { ship.wantRate = 0; return 0; }
  ship.wantRate += (step / dt - ship.wantRate) * (1 - Math.exp(-dt / TRACK_TAU));
  return ship.wantRate;
}

/**
 * The helm and the way: the turn eased toward `want` inside her rate - led by `lead` (rad/s, the heading's own turn
 * while she presents) - her way toward what the wind, her canvas and her sail give (`power` 0 for none), a turn's cost
 * taken from it, and the heel on its spring.
 */
function helm(ship, want, dt, world, power, lead = 0) {
  let maxRate = maxTurnRate(ship);
  const tau = TURN_TAU[ship.hull] ?? 1;
  let err = wrapAngle(want - ship.yaw);
  // a turn through the wind's eye, decided as it begins and held to its end: wear with little way on (the short way
  // round becomes the long way, through the lee), else tack - her way carrying her through the eye at TACK_CARRY of
  // the rate she went in with
  const wind = world.wind;
  const wl0 = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (power > 0 && ship.hull !== HULL.LargeGalley && !ship.sweeps && wl0 > 1e-6) {
    const toEye = wrapAngle(Math.atan2(wind[0], wind[2]) + Math.PI - ship.yaw);
    const through = Math.sign(toEye) === Math.sign(err) && Math.abs(toEye) < Math.abs(err);
    const off = offRunOf(ship.yaw, wind);
    // a tack is over once she can sail again past the eye; a wear once she is round
    if (ship.turnWay && (Math.abs(err) < 20 * DEG || (!through && ship.turnWay.kind === 'tack' && off <= CLOSE_HAULED * DEG))) ship.turnWay = null;
    if (!ship.turnWay && through) {
      ship.turnWay = ship.speed >= WEAR_BELOW * paceOf(ship, wind) && off >= TACK_FROM * DEG ? { kind: 'tack', rate: maxRate } : { kind: 'wear' };
    }
    if (ship.turnWay?.kind === 'wear' && through) err -= Math.sign(err) * 2 * Math.PI;
    if (ship.turnWay?.kind === 'tack') maxRate = Math.max(maxRate, Math.min(ship.cls.turn * DEG, TACK_CARRY * ship.turnWay.rate));
    // in irons she pays off, the bow swung from the eye whichever way the helm asks
    if (Math.abs(toEye) < IRONS_DEG * DEG && ship.speed < IRONS_WAY) maxRate = Math.max(maxRate, PAYOFF_TURN * DEG);
  } else ship.turnWay = null;
  if (ship.avoid.heading != null || ship.aground > 0) {
    maxRate = Math.max(maxRate, PAYOFF_TURN * DEG);   // boxed in or aground: warped round where she lies
    ship.turnWay = null;
  }
  if (power > 0 && ship.sweeps > 0) maxRate = Math.max(maxRate, SWEEP_TURN * DEG);   // AUDIT NAV1 (online #10): pulled round on her sweeps
  // a big turn under the land goes round on the side the lookout found open (avoidLand's `dir`)
  if (ship.avoid.dir) {
    if (Math.abs(err) < 30 * DEG) ship.avoid.dir = 0;
    else if (Math.sign(err) !== ship.avoid.dir && Math.abs(err) > 90 * DEG) err -= Math.sign(err) * 2 * Math.PI;
  }
  const cmd = clamp(err / (4 * tau) + lead, -maxRate, maxRate);
  if (dt > 0) ship.yawRate += (cmd - ship.yawRate) * (1 - Math.exp(-dt / tau));
  ship.yawRate = clamp(ship.yawRate, -maxRate, maxRate);
  ship.yaw = wrapAngle(ship.yaw + ship.yawRate * dt);
  ship.turnNow = ship.yawRate;
  if (power > 0) {
    const wl = wl0;
    let best = ship.cls.speed * windFactor(offRunOf(ship.yaw, wind)) * windShare(wl) * ship.damage.wayShare();
    if (ship.hull === HULL.LargeGalley) best = Math.max(best, ship.cls.speed * OARS_FLOOR);
    const helmShare = maxRate > 0 ? Math.min(1, Math.abs(ship.yawRate) / maxRate) : 0;
    const sailed = best * ship.sails * (1 - TURN_SPEED_LOSS * helmShare);
    const target = Math.max(sailed, ship.sweeps) * (ship.aground > 0 ? AGROUND_WAY : 1);   // AUDIT NAV1 (online #10): her sweeps' way where the wind gives less
    // AUDIT NAV2 F28: gathered and lost at her hull's own rates, the player's (the prefab's `sailWay` on both) - the
    // Carrack gathered way at half the player's Carrack, and a galley lost hers at twice the player's galley's coast
    const way = wayOf(ship);
    ship.speed = ship.speed < target ? Math.min(target, ship.speed + ACCEL * way * dt) : Math.max(target, ship.speed - DECEL * way * dt);
  }
  ship.aground = Math.max(0, ship.aground - dt);
  // the heel: into the turn with her way, to leeward with the wind on her beam, on a spring
  const cross = (wind?.[0] ?? 0) * Math.cos(ship.yaw) - (wind?.[2] ?? 0) * Math.sin(ship.yaw);   // the wind across her, + blowing to starboard
  const want2 = clamp(-HEEL_TURN * ship.speed * (ship.yawRate / DEG) + HEEL_WIND * (cross / WIND_RATED) * ship.sails, -HEEL_MAX, HEEL_MAX);
  for (let t = dt; t > 1e-9;) {
    const h = Math.min(t, 0.05);
    ship.heelVel += (HEEL_OMEGA * HEEL_OMEGA * (want2 - ship.heel) - 2 * HEEL_ZETA * HEEL_OMEGA * ship.heelVel) * h;
    ship.heel += ship.heelVel * h;
    t -= h;
  }
}

/** The ship moves along its heading - unless her stem or a shoulder would stand on land: then she holds, losing her
 *  way, and the lookout sounds again at once. */
function moveShip(ship, dt, isWater) {
  const f = forwardOfYaw(ship.yaw);
  const step = ship.speed * dt;
  if (isWater && step > 0) {
    const b = hullBuild(ship.hull);
    const nx = ship.pos[0] + f[0] * step, nz = ship.pos[2] + f[2] * step;
    const r = [f[2], -f[0]];
    const sh = b.bowZ * 0.55, w = b.halfWidth;
    const clear = isWater(nx + f[0] * b.bowZ, nz + f[2] * b.bowZ)
      && isWater(nx + f[0] * sh + r[0] * w, nz + f[2] * sh + r[1] * w)
      && isWater(nx + f[0] * sh - r[0] * w, nz + f[2] * sh - r[1] * w);
    if (!clear) {
      ship.speed = Math.min(ship.speed, AGROUND_WAY * ship.cls.speed);
      ship.aground = AGROUND_S;
      ship.avoid.at = -Infinity;
      return;
    }
  }
  ship.pos[0] += f[0] * step;
  ship.pos[2] += f[2] * step;
}

/** A prize cast adrift goes where the wind takes her, slowly, and never onto the land. */
function drift(ship, dt, wind, isWater) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (wl < 1e-6) return;
  const s = ADRIFT_SPEED * dt / wl;
  const x = ship.pos[0] + wind[0] * s, z = ship.pos[2] + wind[2] * s;
  if (isWater(x, z)) { ship.pos[0] = x; ship.pos[2] = z; }
}

/** Past this many times its fighting range (or past its guns' reach) a captain closes on an intercept. */
export const CLOSE_FROM = 1.8;
/** A loaded broadside is presented once the enemy is inside this share of the guns' reach. */
export const PRESENT_WITHIN = 0.92;
/** A galley turns its bow on an enemy within this of the bow (degrees); further round it fights its broadside. */
export const BOW_SWING = 60;
/** A battery's reach from its deck: its gun's range at the carriage's highest (m); 0 for none, or a barrel. */
export function batteryReach(ship, side, seaY = 0) {
  const bat = batteryOf(ship.hull, side);
  if (!bat || bat.gun === 'barrel') return 0;
  const g = GUNS[bat.gun];
  return rangeAt(g.maxEl * DEG, g.speed, bat.muzzles[0][1] + (ship.pos[1] - seaY));
}
export const broadsideReach = (ship, seaY = 0) => batteryReach(ship, 'starboard', seaY);
/**
 * AUDIT NAV2 F24 - a battery's DEAD ZONE on a hull: the shortest range (m, from her root) at which its lay, laid on her
 * as the gunnery lays it (AIM_FREEBOARD of her height, her rig's middle for chain shot), passes through her (layPasses)
 * - inside it the carriage cannot depress onto her (a galley's great guns on a Large Boat 91 m, her broadside 57: she
 * fought one from inside both and never struck it). Sounded once for each battery and hull, every LAY_MIN_STEP out to
 * the battery's reach (its reach when no lay strikes); 0 for none, or a barrel.
 * @param {number} hull @param {string} side @param {number} [targetHull]
 */
export function layMin(hull, side, targetHull = HULL.LargeBoat) {
  const key = `${hull}:${side}:${targetHull}`;
  let m = LAY_MIN.get(key);
  if (m !== undefined) return m;
  m = 0;
  const bat = batteryOf(hull, side);
  if (bat && bat.gun !== 'barrel') {
    const build = hullBuild(targetHull);
    const rig = bat.gun === 'chain' && build.rig.length ? rigBand(build) : null;
    const band = rig ?? [0, build.top];
    const aimY = rig ? (rig[0] + rig[1]) / 2 : build.top * AIM_FREEBOARD;
    const g = GUNS[bat.gun];
    const reach = rangeAt(g.maxEl * DEG, g.speed, bat.muzzles[0][1]);
    const dir = side === 'starboard' ? [1, 0] : side === 'port' ? [-1, 0] : side === 'bow' ? [0, 1] : [0, -1];
    const pose = { position: [0, 0, 0], rotation: quatOfYaw(0), velocity: [0, 0, 0], hull };
    m = reach;
    for (let r = LAY_MIN_STEP; r < reach; r += LAY_MIN_STEP) {
      const at = [dir[0] * r, 0, dir[1] * r];
      const sol = aimSolution(pose, /** @type {'starboard'|'port'|'bow'|'stern'} */ (side), null, 0, { target: at, targetY: aimY });
      if (sol && layPasses(sol, at, band)) { m = r; break; }
    }
  }
  LAY_MIN.set(key, m);
  return m;
}
/** AUDIT NAV2 F24: the dead zones sounded (the builds are frozen) - `hull:side:targetHull` -> m. */
const LAY_MIN = new Map();
export const LAY_MIN_STEP = 1;

/** The best way she makes on no particular point of sail - the intercept's own pace. */
const paceOf = (ship, wind) => ship.cls.speed * windShare(Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0)) * ship.damage.wayShare();
/** AUDIT NAV2 F28: her hull's share of ACCEL and DECEL - the prefab's sail modifier (navalShips.js `sailWay`), the
 *  player's own hull's. */
const wayOf = (ship) => hullBuild(ship.hull).sailWay ?? 1;

/**
 * The engagement course. Far off - past CLOSE_FROM ranges, or past the guns' reach - she steers to meet the enemy (a
 * true intercept on its smoothed way). A galley with her great guns loaded and the enemy within BOW_SWING of the bow
 * turns her stem on its lead. Else she shows the broadside that will bear SOONEST: each side's heading lays the
 * enemy's lead abeam, bent up to RANGE_BEND to keep her fighting range, and is weighed by the time to turn to it
 * against its reload, the wind's eye costing its degrees and a course onto the land never taken while another serves.
 * The side is weighed each NAV_EVERY_S; between, its heading follows the enemy.
 */
function engageCourse(ship, enemy, d, world, isWater) {
  // AUDIT NAV2 F24: her fighting range never inside the dead zone (layMin) of her broadside on the hull she fights - nor
  // of her great guns, a galley's (91 m on a Large Boat: at her own 70 a sloop held her inside her broadside's too, 57,
  // and neither struck the other in 900 s)
  const eh = enemy.hull ?? HULL.LargeBoat;
  const deadZone = layMin(ship.hull, 'starboard', eh);
  const range = Math.max(ship.cls.range, deadZone, ship.cls.tactic === 'bow' ? layMin(ship.hull, 'bow', eh) : 0);
  const reach = broadsideReach(ship, world.seaY);
  const vel = ship.tvel?.v ?? enemy.vel ?? [0, 0, 0];
  const own = paceOf(ship, world.wind);
  if (d > Math.max(range * CLOSE_FROM, reach)) {
    const i = intercept(ship.pos, own, enemy.pos, vel);
    ship.present = null;
    return { want: i.heading, goal: i.point, sails: 1 };
  }
  const { bearing } = bearingTo(ship, enemy.pos);
  const my = velocityOf(ship);
  const rel = [vel[0] - my[0], 0, vel[2] - my[2]];
  const away = (vel[0] * (enemy.pos[0] - ship.pos[0]) + vel[2] * (enemy.pos[2] - ship.pos[2])) / Math.max(1e-6, d);   // her way along our line of sight, away
  // SEA-PEACE: A STERN CHASE is closed up her quarter - she runs from us (her way along our line of sight, away, over
  // CHASE_AWAY of OUR pace: a quarry that slow is presented to as ever) and we lie abaft her beam (more than ABAFT_DEG
  // off her bow): a side turned to her there gives
  // the chase up (a pirate on a fleeing merchantman fell from 169 m to 220 and gave her up), so she is run down dead
  // astern - the intercept of the quarry herself, sails full, the chasers bearing (a berth off her beam held them
  // silent 100 s, the bow 11 to 21 degrees off her) - and within CHASE_SHEER of her range she sheers out for a berth
  // her range off our side of the quarry's beam, to present from abeam. AUDIT NAV2 F21: and a ship in FLIGHT is run
  // down however slow she runs (a wary sloop at 0.45 of a cutter's pace was presented to and got away, 7 in 11)
  const ev = Math.hypot(vel[0], vel[2]);
  if (ev > 0.3) {   // at any range: astern of her, a side turned to her only opens it (she wove 93-113 m off her stern)
    const eYaw = Math.atan2(vel[0], vel[2]);
    const offBow = Math.abs(wrapAngle(headingTo(enemy.pos, ship.pos) - eYaw));
    if (((enemy.ship?.mode === 'flee' && away > 0) || away > CHASE_AWAY * own) && offBow > ABAFT_DEG * DEG) {
      const f = forwardOfYaw(eYaw), r = [f[2], 0, -f[0]];
      const onSide = ((ship.pos[0] - enemy.pos[0]) * r[0] + (ship.pos[2] - enemy.pos[2]) * r[2]) >= 0 ? 1 : -1;
      const out = d > range * CHASE_SHEER ? 0 : range;
      ship.present = null;
      // AUDIT NAV2 F21: run down with her chasers loaded, she steers for THEIR lead - on her own intercept point a runner
      // 8 degrees off the line drew one chaser volley in 90 s, against eleven dead on it
      const chasers = out ? null : chaserLead(ship, enemy, rel, eh, world.seaY);
      if (chasers) return { want: headingTo(ship.pos, chasers), goal: chasers, sails: 1 };
      const berth = [enemy.pos[0] + r[0] * onSide * out, enemy.pos[1] ?? 0, enemy.pos[2] + r[2] * onSide * out];
      const i = intercept(ship.pos, own, berth, vel);
      return { want: i.heading, goal: i.point, sails: 1 };
    }
  }
  // a galley fights over its stem: its great guns loaded, the enemy in their reach and within BOW_SWING of the bow,
  // it turns its bow on where its guns must be laid - the enemy's lead for their flight. AUDIT NAV2 F24: only outside
  // their dead zone (layMin) - inside it she stood on at a Large Boat to point-blank and never laid a gun
  const bowReach = batteryReach(ship, 'bow', world.seaY);
  if (ship.cls.tactic === 'bow' && ship.guns.ready('bow') && d <= bowReach * PRESENT_WITHIN && Math.abs(bearing) <= BOW_SWING * DEG) {
    const bow = batteryOf(ship.hull, 'bow');
    const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bow.gun].speed);
    if (Math.hypot(lead[0] - ship.pos[0], lead[2] - ship.pos[2]) >= layMin(ship.hull, 'bow', eh)) {
      ship.present = null;
      return { want: headingTo(ship.pos, lead), goal: lead, sails: 1 };
    }
  }
  // a loaded side in reach lays the lead dead abeam - to fire; one reloading bends off the beam to work the range, and
  // so does one loaded at point-blank (AUDIT NAV1, the guns: the hulls all but touching). AUDIT NAV2 F21: loaded, with
  // the lead inside the run-out's reach once she is round to it and run out - a runner's way away over that time on it
  // (at PRESENT_WITHIN she lay abeam of a runner whose lead never came inside RUN_OUT_REACH, and never ran out) - and
  // past her range she bends in at least steeply enough to close on a runner by CHASE_MARGIN of her pace (a flat
  // RANGE_BEND closed at half her pace). AUDIT NAV2 F24: and never laid inside her dead zone, where no lay strikes -
  // there she opens the range hard (a sloop held a war galley 55 m off her beam, both her batteries dumb)
  const holdsLead = (side) => {
    const l = leadPoint(ship.pos, enemy.pos, rel, GUNS[batteryOf(ship.hull, side).gun].speed);
    const ld = Math.hypot(l[0] - ship.pos[0], l[2] - ship.pos[2]);
    if (ship.present?.side === side && ship.present.lays) return ld <= reach * RUN_OUT_REACH;   // laying it: held while it is in reach
    const abeam = wrapAngle(headingTo(ship.pos, l) - (side === 'starboard' ? 1 : -1) * 90 * DEG);
    // round to it at her rate, settled over her helm's own ease (4 TURN_TAU), and run out
    const round = Math.abs(wrapAngle(abeam - ship.yaw)) / Math.max(maxTurnRate(ship), TURN_FLOOR * DEG) + 4 * (TURN_TAU[ship.hull] ?? 1) + RUN_OUT_S;
    return ld + Math.max(0, away) * round <= reach * RUN_OUT_REACH;
  };
  const closeIn = away > 0 ? Math.asin(clamp((away + CHASE_MARGIN * own) / Math.max(0.5, ship.speed), 0, 1)) : 0;
  const bendOf = (side) => {
    if (ship.guns.ready(side) && d <= reach * PRESENT_WITHIN && d >= Math.max(range * POINT_BLANK, deadZone) && holdsLead(side)) return 0;
    if (d < deadZone) return -2 * RANGE_BEND * DEG;
    const b = clamp((d - range) / range, -1, 1) * RANGE_BEND * DEG;
    return d > range ? Math.max(b, closeIn) : b;
  };
  const headingFor = (side) => {
    const bat = batteryOf(ship.hull, side);
    const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bat.gun].speed);
    const sign = side === 'starboard' ? 1 : -1;
    return wrapAngle(headingTo(ship.pos, lead) - sign * (90 * DEG - bendOf(side)));
  };
  const sides = ['starboard', 'port'].filter((s) => { const b = batteryOf(ship.hull, s); return b && b.gun !== 'barrel'; });
  if (!sides.length) { ship.present = null; return { want: headingTo(ship.pos, enemy.pos), goal: enemy.pos, sails: 1 }; }
  if (!ship.present || ship.clock - ship.present.at >= NAV_EVERY_S || !sides.includes(ship.present.side)) {
    const rate = Math.max(maxTurnRate(ship), TURN_FLOOR * DEG);
    const l = lookout(ship);
    const cost = {};
    for (const side of sides) {
      const ideal = headingFor(side);
      const h = sailable(ship, ideal, world.wind);
      const turnS = Math.abs(wrapAngle(h - ship.yaw)) / rate;
      const off = Math.abs(wrapAngle(ideal - h)) / DEG;
      // AUDIT NAV1 (the guns): the wind holding the lead outside the fire's window - she would sail on unfired
      const bat = batteryOf(ship.hull, side);
      const noBear = off > fireWindow(ship, enemy, leadPoint(ship.pos, enemy.pos, rel, GUNS[bat.gun].speed), bat.gun, BEAR_DEG) ? NO_BEAR_S : 0;
      const foul = courseClear(ship.pos, h, l.near, isWater, { half: l.half, from: l.from }) ? 0 : 1e4;   // her turning circle's reach
      cost[side] = Math.max(turnS, ship.guns.left(side)) + off * BEAR_COST_S + noBear + foul;
    }
    const held = ship.present && sides.includes(ship.present.side) ? ship.present.side : null;
    let best = held ?? sides[0];
    for (const side of sides) if (cost[side] + (side === held ? 0 : held ? SIDE_HOLD_S : 0) < cost[best] + (best === held ? 0 : held ? SIDE_HOLD_S : 0)) best = side;
    ship.present = { side: best, at: ship.clock, lays: best === held && !!ship.present?.lays };
  }
  const side = ship.present.side;
  const ideal = headingFor(side);
  ship.present.lays = bendOf(side) === 0;   // AUDIT NAV2 F21: laying her lead abeam - held to while it stays in reach (holdsLead)
  const want = sailable(ship, ideal, world.wind);
  const bat = batteryOf(ship.hull, side);
  const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bat.gun].speed);
  // presented: loaded, in reach, on her heading - and a heading the wind lets lay the lead inside the fire's window
  const presented = ship.guns.ready(side) && d <= reach * PRESENT_WITHIN && Math.abs(wrapAngle(want - ship.yaw)) < 30 * DEG
    && Math.abs(wrapAngle(ideal - want)) / DEG <= fireWindow(ship, enemy, lead, bat.gun, BEAR_DEG);
  if (!presented) return { want, goal: null, sails: 1, sailable: true, track: true };
  // station: her way matched to the enemy's along her course, closing on the lead drawn ahead or astern of her beam
  const f = forwardOfYaw(ship.yaw);
  const pace = (vel[0] * f[0] + vel[2] * f[2]) + PRESENT_GAIN * ((lead[0] - ship.pos[0]) * f[0] + (lead[2] - ship.pos[2]) * f[2]);
  const best = Math.max(0.5, paceOf(ship, world.wind) * windFactor(offRunOf(ship.yaw, world.wind)));
  return { want, goal: null, sails: clamp(pace / best, PRESENT_SAILS, 1), sailable: true, track: true };
}

/** AUDIT NAV2 F21: the lead her bow battery lays for - loaded, the lead inside its reach's RUN_OUT_REACH and outside
 *  its dead zone (layMin) - or null. */
function chaserLead(ship, enemy, rel, eh, seaY) {
  const bow = batteryOf(ship.hull, 'bow');
  if (!bow || bow.gun === 'barrel' || !ship.guns.ready('bow')) return null;
  const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bow.gun].speed);
  const ld = Math.hypot(lead[0] - ship.pos[0], lead[2] - ship.pos[2]);
  return ld <= batteryReach(ship, 'bow', seaY) * RUN_OUT_REACH && ld >= layMin(ship.hull, 'bow', eh) ? lead : null;
}

/**
 * Alongside to board: the berth on her lee side (chosen once), the two hulls' half beams and BERTH_GAP apart, steered
 * for through a point on her quarter that slides up to the berth as she closes - so she comes up parallel, not bows
 * on - her sail coming in as she nears it. AUDIT NAV2 F22: the berth SOUNDED - one where her hull would lie on the land
 * is no berth: the other side, when it is open - and made ROUND THE LAND (routeTo): her way there, the waypoint's legs
 * where the straight one is foul; a way there she has not shortened in CHASE_GIVE_UP_S (boardingGivenUp) and she gives
 * the boarding up - null, for the caller to leave her be (giveUp).
 */
function boardCourse(ship, enemy, wind, isWater) {
  const v = enemy.vel ?? [0, 0, 0];
  const eYaw = Number.isFinite(enemy.yaw) ? enemy.yaw : Math.hypot(v[0], v[2]) > 0.3 ? Math.atan2(v[0], v[2]) : ship.yaw;
  const f = forwardOfYaw(eYaw), r = [f[2], 0, -f[0]];
  // the side she comes up on: the one she is on when she means to board - her approach never crosses the boat
  if (!ship.berthSide) ship.berthSide = ((ship.pos[0] - enemy.pos[0]) * r[0] + (ship.pos[2] - enemy.pos[2]) * r[2]) >= 0 ? 1 : -1;
  const gap = hullBuild(ship.hull).halfWidth + hullBuild(enemy.hull ?? HULL.LargeBoat).halfWidth + BERTH_GAP;
  const berthOn = (side) => [enemy.pos[0] + r[0] * side * gap, 0, enemy.pos[2] + r[2] * side * gap];
  if (!berthOpen(ship, berthOn(ship.berthSide), f, r, ship.berthSide, isWater) && berthOpen(ship, berthOn(-ship.berthSide), f, r, -ship.berthSide, isWater)) ship.berthSide = -ship.berthSide;
  const berth = berthOn(ship.berthSide);
  const wp = routeTo(ship, berth, isWater);
  // her way there: straight, or by the waypoint round the land
  const d = wp ? Math.hypot(wp[0] - ship.pos[0], wp[2] - ship.pos[2]) + Math.hypot(berth[0] - wp[0], berth[2] - wp[2]) : Math.hypot(berth[0] - ship.pos[0], berth[2] - ship.pos[2]);
  if (boardingGivenUp(ship, enemy.id, d)) return null;
  // the pace that stops her BOARD_SAILS.from short of the berth, and the boat's own way on top
  const along = Math.max(0, v[0] * f[0] + v[2] * f[2]);
  const pace = Math.sqrt(2 * DECEL * wayOf(ship) * Math.max(0, d - BOARD_SAILS.from)) + along;   // AUDIT NAV2 F28: her hull's own coast
  const best = Math.max(0.5, paceOf(ship, wind));
  const sails = clamp(pace / best, BOARD_SAILS.min, 1);
  // AUDIT NAV1 (online #10): to a boat lying still, straight for the berth - her stern is no course to match (with it
  // to the wind's eye the point astern lay dead to windward) - and within SWEEP_RANGE on her sweeps
  const still = Math.hypot(v[0], v[2]) < GRAPPLE_STILL;
  const sweeps = still && d <= SWEEP_RANGE ? Math.min(SWEEP_WAY, pace) : 0;
  if (wp) return { want: headingTo(ship.pos, wp), goal: wp, sails, sweeps, sailable: sweeps > 0 };
  if (d < 8) return { want: eYaw, goal: berth, sails, sweeps, sailable: sweeps > 0 };
  // up from astern to match a boat under way
  const lead = still ? 0 : Math.min(60, d) * 0.8, ahead = Math.min(10, d / Math.max(1, ship.speed));
  const aim = [berth[0] - f[0] * lead + v[0] * ahead, 0, berth[2] - f[2] * lead + v[2] * ahead];
  return { want: headingTo(ship.pos, aim), goal: aim, sails, sweeps, sailable: sweeps > 0 };
}

/** AUDIT NAV2 F22: whether she can lie at a berth - her stem, middle and stern there, on her keel line and her outer
 *  side (the hull she berths by along `f`, her side of it `side` along `r`), all on water. */
function berthOpen(ship, berth, f, r, side, isWater) {
  const b = hullBuild(ship.hull);
  for (const z of [b.bowZ, 0, b.aftZ]) {
    for (const x of [0, b.halfWidth]) if (!isWater(berth[0] + f[0] * z + r[0] * side * x, berth[2] + f[2] * z + r[2] * side * x)) return false;
  }
  return true;
}

/** AUDIT NAV2 F22: a leg sounded clear for her hull - every ROUTE_STEP m, on its line and her half beam and SCAN_MARGIN
 *  either side of it. */
function legClear(ship, a, b, isWater) {
  const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
  return d < 1 || courseClear(a, headingTo(a, b), d, isWater, { half: hullBuild(ship.hull).halfWidth + SCAN_MARGIN, step: ROUTE_STEP });
}

/**
 * AUDIT NAV2 F22: her way to `goal` round the land - null while the straight leg sounds clear, else the shortest way
 * round from where she is now (wayRound), sought again every ROUTE_EVERY_S so the way hugs the land's end as she
 * comes round it (between, the last answer stands); a way round not found is sought again only every ROUTE_RETRY_S.
 */
function routeTo(ship, goal, isWater) {
  const r = ship.route;
  if (r && Math.hypot(r.goal[0] - goal[0], r.goal[2] - goal[2]) < ROUTE_SLIP && ship.clock - r.at < (r.lost ? ROUTE_RETRY_S : ROUTE_EVERY_S)) return r.wp;
  const open = legClear(ship, ship.pos, goal, isWater);
  const wp = open ? null : wayRound(ship, goal, isWater, r?.wp ?? null);
  ship.route = { goal: [goal[0], 0, goal[2]], wp, at: ship.clock, lost: !open && !wp };
  return wp;
}

/** AUDIT NAV2 F22: the shortest way round to `goal` by one waypoint - ROUTE_DISTS out from her and from the goal on
 *  bearings ROUTE_TURN apart, and the one she steers for (`was`), tried shortest first (its leg on, her leg there), the
 *  cruise's law: open water, never across the land; a way on the other side of her line to the goal from `was` must be
 *  ROUTE_SWITCH shorter - she never flips round a spit and back. */
function wayRound(ship, goal, isWater, was) {
  const toward = headingTo(ship.pos, goal);
  const sideOf = (p) => Math.sign(Math.sin(headingTo(ship.pos, p) - toward));
  const keep = was ? sideOf(was) : 0;
  const ways = was ? [{ p: was, cost: Math.hypot(was[0] - ship.pos[0], was[2] - ship.pos[2]) + Math.hypot(goal[0] - was[0], goal[2] - was[2]) }] : [];
  for (const [o, from] of [[ship.pos, toward], [goal, toward + Math.PI]]) {
    for (const dist of ROUTE_DISTS) {
      for (let k = -180 + ROUTE_TURN; k <= 180; k += ROUTE_TURN) {
        const a = from + k * DEG;
        const p = [o[0] + Math.sin(a) * dist, 0, o[2] + Math.cos(a) * dist];
        const cost = Math.hypot(p[0] - ship.pos[0], p[2] - ship.pos[2]) + Math.hypot(goal[0] - p[0], goal[2] - p[2]);
        ways.push({ p, cost: keep && sideOf(p) !== keep ? cost * ROUTE_SWITCH : cost });
      }
    }
  }
  ways.sort((x, y) => x.cost - y.cost);
  for (const w of ways) if (isWater(w.p[0], w.p[2]) && legClear(ship, w.p, goal, isWater) && legClear(ship, ship.pos, w.p, isWater)) return w.p;
  return null;
}

/** AUDIT NAV2 F22: the boarding's tally - her way to the berth not shortened by CHASE_GAIN of its best in
 *  CHASE_GIVE_UP_S, she gives the boarding up (the prize branch never did: circling a spit, for ever). */
function boardingGivenUp(ship, id, way) {
  const a = ship.approach;
  if (a?.id !== id) { ship.approach = { id, since: ship.clock, best: way }; return false; }
  if (way < a.best * (1 - CHASE_GAIN)) { a.best = way; a.since = ship.clock; }
  return ship.clock - a.since > CHASE_GIVE_UP_S;
}

/** AUDIT NAV2 F22: a boarding given up - the one she would board left be SPARE_S (so the host lets both go); she holds
 *  her course this step. */
function giveUp(ship, target) {
  ship.spare.set(target.id, ship.clock + SPARE_S);
  ship.mode = 'cruise'; ship.target = null; ship.berthSide = 0; ship.approach = null; ship.route = null;
  return { want: ship.yaw, goal: null, sails: 1 };
}

/** The open water between two hulls on the flat (m): the widest gap along any of their four axes - 0 or less when
 *  they touch. Hulls off their builds; `hull` null is a Large Boat. */
export function hullGap(aPos, aYaw, aHull, bPos, bYaw, bHull) {
  const box = (pos, yaw, hull) => {
    const b = hullBuild(hull ?? HULL.LargeBoat), f = [Math.sin(yaw), Math.cos(yaw)], mid = (b.bowZ + b.aftZ) / 2;
    return { c: [pos[0] + f[0] * mid, pos[2] + f[1] * mid], f, r: [f[1], -f[0]], hl: (b.bowZ - b.aftZ) / 2, hw: b.halfWidth };
  };
  const A = box(aPos, aYaw, aHull), B = box(bPos, bYaw ?? 0, bHull);
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1]];
  let gap = -Infinity;
  for (const u of [A.f, A.r, B.f, B.r]) {
    const ra = A.hl * Math.abs(A.f[0] * u[0] + A.f[1] * u[1]) + A.hw * Math.abs(A.r[0] * u[0] + A.r[1] * u[1]);
    const rb = B.hl * Math.abs(B.f[0] * u[0] + B.f[1] * u[1]) + B.hw * Math.abs(B.r[0] * u[0] + B.r[1] * u[1]);
    gap = Math.max(gap, Math.abs(d[0] * u[0] + d[1] * u[1]) - ra - rb);
  }
  return gap;
}

/** Running: the fastest point of sail within FLEE_SPREAD of dead away from what she runs from. */
function fleeCourse(ship, from, wind) {
  const away = headingTo(from.pos, ship.pos);
  let best = away, bestV = -Infinity;
  for (let k = -FLEE_SPREAD; k <= FLEE_SPREAD; k += 15) {
    const h = wrapAngle(away + k * DEG);
    const v = windFactor(offRunOf(h, wind)) * Math.cos(k * DEG);
    if (v > bestV + 1e-9) { bestV = v; best = h; }
  }
  return { want: best, goal: null, sails: 1 };
}

/** A cruise: toward a waypoint - drawn from every quarter, never upwind of close-hauled (a galley rows there) nor across
 *  the land, a new one on arrival (and none kept once reached) - or a raider's own seeded course, where the host sets
 *  one (NAV-R). */
function cruiseCourse(ship, wind, isWater, r) {
  if (ship.course) return Math.atan2(ship.course[0] - ship.pos[0], ship.course[1] - ship.pos[2]);
  const wp = ship.waypoint;
  if (!wp || Math.hypot(wp[0] - ship.pos[0], wp[1] - ship.pos[2]) < WAYPOINT_REACHED || !isWater(wp[0], wp[1])) {
    ship.waypoint = null;
    for (let i = 0; i < WAYPOINT_TRIES; i++) {
      const a = r() * Math.PI * 2;
      const dist = WAYPOINT_DIST[0] + r() * (WAYPOINT_DIST[1] - WAYPOINT_DIST[0]);
      if (ship.hull !== HULL.LargeGalley && offRunOf(a, wind) > CLOSE_HAULED * DEG) continue;   // a galley rows to windward
      const p = [ship.pos[0] + Math.sin(a) * dist, ship.pos[2] + Math.cos(a) * dist];
      let clear = true;
      for (let s = WAYPOINT_SOUND; s < dist && clear; s += WAYPOINT_SOUND) clear = isWater(ship.pos[0] + Math.sin(a) * s, ship.pos[2] + Math.cos(a) * s);
      if (clear && isWater(p[0], p[1])) { ship.waypoint = p; break; }
    }
    // none found (a channel, a bight): back the way she came, as far as it is open
    if (!ship.waypoint) {
      const a = wrapAngle(ship.yaw + Math.PI);
      let s = 0;
      while (s + WAYPOINT_SOUND <= WAYPOINT_DIST[0] && isWater(ship.pos[0] + Math.sin(a) * (s + WAYPOINT_SOUND), ship.pos[2] + Math.cos(a) * (s + WAYPOINT_SOUND))) s += WAYPOINT_SOUND;
      if (s >= WAYPOINT_REACHED * 2) ship.waypoint = [ship.pos[0] + Math.sin(a) * s, ship.pos[2] + Math.cos(a) * s];
    }
  }
  if (!ship.waypoint) return ship.yaw;
  return Math.atan2(ship.waypoint[0] - ship.pos[0], ship.waypoint[1] - ship.pos[2]);
}

/**
 * The guns of one step. Each battery that bears is run out (RUN_OUT_S, the tell) and fires once it is out and its lay
 * passes near enough the enemy's LEAD - where it will be when the balls arrive, which is where the guns are laid (the
 * crew's error long or short by LAY_ERR at no skill) - at AIM_FREEBOARD of her hull, or through the middle of her rig
 * for chain shot. Never a lay that passes over her or falls short of her, never across a friend; barrels for a pursuer
 * close under the stern. `broadsides` false holds the broadsides (a pirate coming alongside keeps her prize whole).
 */
function gunnery(ship, world, enemy, out, { broadsides = true } = {}) {
  if (!enemy) { ship.runOut.clear(); return; }
  const { bearing, dist } = bearingTo(ship, enemy.pos);
  const deg = bearing / DEG;
  const pose = { position: ship.pos, rotation: quatOfYaw(ship.yaw), velocity: velocityOf(ship), hull: ship.hull };
  const skill = ship.cls.skill;
  const r = world.random ?? Math.random;
  const my = velocityOf(ship);
  const rel = [(enemy.vel?.[0] ?? 0) - my[0], 0, (enemy.vel?.[2] ?? 0) - my[2]];
  const build = hullBuild(enemy.hull ?? HULL.LargeBoat);
  const battery = (side, bearingWant, arc, bear) => {
    const bat = batteryOf(ship.hull, side);
    if (!bat || bat.gun === 'barrel' || (!broadsides && (side === 'starboard' || side === 'port'))) { ship.runOut.delete(side); return; }
    const g = GUNS[bat.gun];
    const lead = leadPoint(ship.pos, enemy.pos, rel, g.speed);
    const toLead = bearingTo(ship, lead);
    const err = Math.abs(wrapAngle(toLead.bearing - bearingWant * DEG)) / DEG;
    const loaded = ship.guns.ready(side);
    const reach = batteryReach(ship, side, world.seaY);
    const inReach = toLead.dist <= reach * 1.02;
    // the height the lay meets her at, and the band it must pass through to strike her there
    const rig = bat.gun === 'chain' && build.rig.length ? rigBand(build).map((y) => world.seaY + y) : null;
    const band = rig ?? [world.seaY, world.seaY + build.top];
    const aimY = rig ? (rig[0] + rig[1]) / 2 : world.seaY + build.top * AIM_FREEBOARD;
    const lay = (k) => aimSolution(pose, side, null, world.seaY, { target: [ship.pos[0] + (lead[0] - ship.pos[0]) * k, lead[1], ship.pos[2] + (lead[2] - ship.pos[2]) * k], targetY: aimY });
    const clear = !lineFoul(ship, bat, lead, enemy, world);
    const strikes = () => { const sol = lay(1); return !!sol && layPasses(sol, lead, band); };
    const window = fireWindow(ship, enemy, lead, bat.gun, bear);
    const since = ship.runOut.get(side);
    if (since == null) {
      if ((ship.runIn.get(side) ?? -Infinity) > ship.clock - RUN_IN_S) return;
      const soon = err <= window || bearsWithin(ship, lead, enemy, side === 'bow' ? 0 : bearingWant, window) <= RUN_OUT_S;
      if (loaded && toLead.dist <= reach * RUN_OUT_REACH && err <= arc && soon && clear && strikes()) { ship.runOut.set(side, ship.clock); out.runOuts.push(side); }
      return;
    }
    if (!loaded || !inReach || err > RUN_IN_DEG || !clear || ship.clock - since > RUN_OUT_S + RUN_OUT_WAIT_S) {
      ship.runOut.delete(side);
      ship.runIn.set(side, ship.clock);
      return;
    }
    if (ship.clock - since < RUN_OUT_S || err > window) return;
    if (!strikes()) return;
    // the crew's error: the lay long or short of the lead by up to LAY_ERR / 2 at no skill, none at the best
    const solution = lay(1 + (r() - 0.5) * LAY_ERR * (1 - skill));
    if (!solution) return;
    out.volleys.push({ side, solution });
    ship.guns.fired(side);
    ship.runOut.delete(side);
    ship.lastFire = world.now;
  };
  battery('starboard', 90, RUN_OUT_DEG, BEAR_DEG);
  battery('port', -90, RUN_OUT_DEG, BEAR_DEG);
  battery('bow', 0, BOW_RUN_OUT, BOW_BEAR);
  // a barrel for a pursuer close under the stern
  if (Math.abs(deg) > 160 && dist < 45 && ship.guns.ready('stern')) {
    const bat = batteryOf(ship.hull, 'stern');
    if (bat?.gun === 'barrel') {
      const solution = aimSolution(pose, 'stern', null, world.seaY);
      if (solution) { out.barrels.push(solution); ship.guns.fired('stern'); }
    }
  }
}

/**
 * The fire's window (degrees off a battery's line) for a volley at `at` (the lead): her half-extent across the line
 * of fire - her length times the sine of her heading against it, her half beam times its cosine (her heading unknown
 * and her way too slow to read it by: her mean profile) - times the crew's
 * share (FIRE_EXTENT_K, and FIRE_EXTENT_SKILL more at no skill), over the range; never inside the gun's own spread for
 * this crew, never past `bear`.
 */
export function fireWindow(ship, enemy, at, gun, bear) {
  const b = hullBuild(enemy.hull ?? HULL.LargeBoat);
  const los = Math.atan2(at[0] - ship.pos[0], at[2] - ship.pos[2]);
  const dist = Math.max(1, Math.hypot(at[0] - ship.pos[0], at[2] - ship.pos[2]));
  // her heading: her own, else her way's, else unknown - her mean profile over every heading (2/pi of each half)
  const v = enemy.vel ?? [0, 0, 0];
  const eyaw = Number.isFinite(enemy.yaw) ? enemy.yaw : Math.hypot(v[0], v[2]) > 0.3 ? Math.atan2(v[0], v[2]) : null;
  const halfLen = (b.bowZ - b.aftZ) / 2;
  const extent = eyaw == null ? (halfLen + b.halfWidth) * 2 / Math.PI : halfLen * Math.abs(Math.sin(eyaw - los)) + b.halfWidth * Math.abs(Math.cos(eyaw - los));
  const miss = extent * (FIRE_EXTENT_K + FIRE_EXTENT_SKILL * (1 - ship.cls.skill));
  const spread = (GUNS[gun]?.yawSpread ?? 1) * clamp(1.5 - ship.cls.skill, 0.4, 1.5);
  return Math.min(bear, Math.max(spread, Math.asin(Math.min(1, miss / dist)) / DEG));
}

/**
 * The seconds until the lead's bearing comes within `window` degrees of `want` (the battery's beam, degrees off the
 * bow): its rate is the lead's way across her line of sight (its smoothed way less hers, over the range) less her own
 * turn. 0 already in it, Infinity opening or standing.
 */
export function bearsWithin(ship, lead, enemy, want, window) {
  const dx = lead[0] - ship.pos[0], dz = lead[2] - ship.pos[2];
  const d2 = dx * dx + dz * dz;
  if (d2 < 1) return 0;
  const err = wrapAngle(Math.atan2(dx, dz) - ship.yaw - want * DEG) / DEG;
  if (Math.abs(err) <= window) return 0;
  const v = ship.tvel?.id === enemy.id ? ship.tvel.v : enemy.vel ?? [0, 0, 0];
  const my = velocityOf(ship);
  const rx = v[0] - my[0], rz = v[2] - my[2];
  // d(atan2(dx, dz))/dt = (dz rx - dx rz) / d2 - the world bearing's rate; less her own yaw rate
  const rate = ((dz * rx - dx * rz) / d2 - (ship.yawRate ?? 0)) / DEG;
  if (Math.sign(rate) === Math.sign(err) || Math.abs(rate) < 1e-6) return Infinity;   // opening, or standing
  return (Math.abs(err) - window) / Math.abs(rate);
}

/** A hull's rig as one band of height over the sea: its lowest box's floor to its highest's roof (m). */
export function rigBand(build) {
  let lo = Infinity, hi = -Infinity;
  for (const [mn, mx] of build.rig) { lo = Math.min(lo, mn[1]); hi = Math.max(hi, mx[1]); }
  return [lo, hi];
}

/**
 * Whether a lay's unscattered flight (the battery's middle gun) passes through the height band `band` (world heights)
 * where it comes abreast of `at` along the fire - neither over her (a carriage that cannot depress so far) nor into the
 * sea short of her.
 */
export function layPasses(solution, at, band) {
  const l = solution.launches[solution.launches.length >> 1];
  if (!l) return false;
  const along = l.v0[0] * solution.dir[0] + l.v0[2] * solution.dir[2];
  const x = (at[0] - l.p0[0]) * solution.dir[0] + (at[2] - l.p0[2]) * solution.dir[2];
  if (!(along > 1e-6) || !(x > 0)) return false;
  const t = x / along;
  const y = l.p0[1] + l.v0[1] * t - 0.5 * SHOT_GRAVITY * t * t;
  return y >= band[0] - 0.25 && y <= band[1];
}

/**
 * Whether a friend lies across a battery's line of fire: any contact she does not take for an enemy whose hull (its
 * flat box off its build, FRIEND_CLEAR grown) the line from her guns out past the lead crosses.
 */
export function lineFoul(ship, bat, lead, enemy, world) {
  const f = forwardOfYaw(ship.yaw), rr = [f[2], 0, -f[0]];
  const m = bat.muzzles[bat.muzzles.length >> 1];
  const a = [ship.pos[0] + rr[0] * m[0] + f[0] * m[2], 0, ship.pos[2] + rr[2] * m[0] + f[2] * m[2]];
  const len = Math.hypot(lead[0] - a[0], lead[2] - a[2]);
  if (len < 1e-6) return false;
  const over = hullLength(enemy.hull ?? HULL.LargeBoat) / 2;
  const b = [a[0] + (lead[0] - a[0]) / len * (len + over), 0, a[2] + (lead[2] - a[2]) / len * (len + over)];
  for (const c of world.contacts ?? []) {
    if (c.id === ship.id || c.id === enemy.id || c.gone || hostile(ship, c, world)) continue;
    const hb = hullBuild(c.hull ?? HULL.LargeBoat);
    const yaw = Number.isFinite(c.yaw) ? c.yaw : 0;
    const cf = [Math.sin(yaw), Math.cos(yaw)], cr = [cf[1], -cf[0]];
    const mid = (hb.bowZ + hb.aftZ) / 2;
    const cc = [c.pos[0] + cf[0] * mid, c.pos[2] + cf[1] * mid];
    const hl = (hb.bowZ - hb.aftZ) / 2 + FRIEND_CLEAR, hw = hb.halfWidth + FRIEND_CLEAR;
    // the segment in her box's frame, slab-tested
    const to = (p) => { const d = [p[0] - cc[0], p[2] - cc[1]]; return [d[0] * cr[0] + d[1] * cr[1], d[0] * cf[0] + d[1] * cf[1]]; };
    const pa = to(a), pb = to(b);
    let t0 = 0, t1 = 1, crosses = true;
    for (const [i, h] of [[0, hw], [1, hl]]) {
      const d = pb[i] - pa[i];
      if (Math.abs(d) < 1e-9) { if (Math.abs(pa[i]) > h) { crosses = false; break; } continue; }
      let u = (-h - pa[i]) / d, w = (h - pa[i]) / d;
      if (u > w) [u, w] = [w, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, w);
      if (t0 > t1) { crosses = false; break; }
    }
    if (crosses) return true;
  }
  return false;
}

/** What the wire says of a ship (NAV-G) and a save keeps of nothing - a sea ship lives in a room, not a save. */
export function shipWireState(ship) {
  return {
    id: ship.id, seed: ship.seed, cls: ship.cls.id, variant: ship.variant,
    pos: ship.pos, yaw: ship.yaw, speed: ship.speed, sails: ship.sails, heel: ship.heel,
    mode: ship.mode, damage: ship.damage.snapshot(),
  };
}
