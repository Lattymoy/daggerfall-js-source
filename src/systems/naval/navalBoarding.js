// @ts-check
// NAV-D (2026-09-28, Mac: "actual sailing ships to the world that players can encounter and pillage, which should
// also directly enhance and integrate into the pirate quest system") - BOARDING: taking a ship with the sword, and
// throwing boarders off your own. The port's own; pure - the phases, the berth, the musters and the reckoning. The
// host stands the foes, moves the player, opens the windows and runs the quests.
//
// WHEN YOU BOARD HER. A ship that has struck her colours (navalDamage.js STRUCK_AT) lies within BOARD_RANGE of your
// helm: Activate (the key the prompt names) throws the grapples. She is hauled ALONGSIDE over GRAPPLE_S - swung
// parallel to your hull on the side she lies, BERTH_GAP of water between the two planks (`berthPose`) - and you go
// over her rail onto her deck. BOARD-MAGNET (2026-10-26, the owner: "remove the ship ramming feature as its broken and
// instead with a ship is damaged enough, a prompt to board should show within range and properly magnitize to the
// other ship"): the grapples are thrown at any way - the prompt stands whenever she is in reach, never a heave-to
// first - and the haul DRAWS HER TO THE SHIP AS IT LIES EACH FRAME (`haul`, `drawHaul`, over `berthHull`'s own beams,
// widths and middles), out to her berth's lane and along it, kept clear of your hull, while your way comes off under
// `haulBrake`: she meets you where you come to rest, side by side, never where you were when the lines went over, and
// never through your planking on the way. Her crew stands to fight on her deck: her MUSTER, what her class sends
// (navalShips.js `boarders`) thinned by what her crew has lost, never under MUSTER_MIN nor over MUSTER_MAX, led by her
// CAPTAIN - a pirate flagship's and a navy's a named officer, the Spellsword Warm Ashes makes
// the pirates' leader (WAQ_SHIP_ATTACK_PIRATE `_spells_`). A crewed ship of your own sends HANDS with you - Warm
// Ashes' crew, Warriors on the player's side (its `_ally_`), one for every CREW_PER_HAND of your crew, at most
// HANDS_MAX. Her captain dead and SURRENDER_SHARE of her muster with him - or every man of them - she is your PRIZE
// (navalPlunder.js). Swim or sail more than ABANDON_RANGE from her and the fight is given up: her men stand down
// and she lies struck.
//
// WHEN THEY BOARD YOU. A pirate that grapples (navalAI.js GRAPPLE_*) is hauled alongside the same way, and its men
// come over YOUR rail. A crewed ship of yours meets them with Warm Ashes' own raid - WAQ_SHIP_SMALLRAID, or from a
// pirate flagship WAQ_SHIP_ATTACK_PIRATE, the waves and the captain that quest was written for and the mod never
// started - on your own deck; a boat with no crew meets a party of the naval arc's own (REPEL_PARTY). Throw them off
// and their ship, her boarders spent, lies struck alongside: board her in turn.

import { wrapAngle } from '../../world/mat4.js';   // ONCRASH1: the port's one angle wrap
import { hullBuild, hullMid, flatHull, hullOverlap } from './navalShips.js';   // BOARD-MAGNET: a hull's own beam, width and middle (berthHull); the haul kept clear (drawHaul)

export const BOARD_RANGE = 32;
export const GRAPPLE_S = 2.2;
export const BERTH_GAP = 2.2;
/** BOARD-MAGNET: the least water between the two hulls at their widest (m) - their colliders' half widths
 *  (navalShips.js `halfWidth`), where a hull swells past her deck's beam: a Large Galley 2.4 m a side, so a berth by
 *  the beams alone laid a Carrack's planking 0.2 m inside the galley's. */
export const HULL_CLEAR = 0.5;
/** BOARD-MAGNET (AUDIT): the haul's bounds - its way (m/s) and its turn (rad/s) at the most, and how long it may run
 *  (s) before she is laid in her berth whatever held her: a guard - the slowest haul from any start in reach, a galley
 *  lying across another's stern at a captain's farthest reach, lies in its berth in 5.3 s. */
export const HAUL_SPEED = 30;
export const HAUL_TURN = (120 * Math.PI) / 180;
export const HAUL_MAX_S = 6;
export const MUSTER_MIN = 3;
export const MUSTER_MAX = 12;
export const CREW_PER_HAND = 6;
export const HANDS_MAX = 4;
export const SURRENDER_SHARE = 0.7;
export const ABANDON_RANGE = 160;
/** The party that boards a boat with no crew (no quest): its size by the pirate's class. */
export const REPEL_PARTY = Object.freeze({ min: 3, max: 6 });

/** DFU's MobileTypes for the musters (the quest foe table's ids: vendor/dfu-quests/Tables/Quests-Foes.txt). */
export const MOBILE = Object.freeze({
  Spellsword: 129, BattleMage: 130, Healer: 132, Nightblade: 133, Bard: 134, Rogue: 136, Thief: 138, Assassin: 139,
  Monk: 140, Archer: 141, Ranger: 142, Barbarian: 143, Warrior: 144, Knight: 145,
});
/** Who a ship sends to her rail, by faction - drawn in order, round and round - and who leads them. */
export const MUSTERS = Object.freeze({
  pirate: Object.freeze({ men: Object.freeze([MOBILE.Rogue, MOBILE.Barbarian, MOBILE.Thief, MOBILE.Rogue, MOBILE.Archer, MOBILE.Nightblade, MOBILE.Barbarian, MOBILE.Assassin]), captain: MOBILE.Spellsword }),
  merchant: Object.freeze({ men: Object.freeze([MOBILE.Warrior, MOBILE.Archer, MOBILE.Monk, MOBILE.Warrior, MOBILE.Bard]), captain: MOBILE.Ranger }),
  navy: Object.freeze({ men: Object.freeze([MOBILE.Knight, MOBILE.Warrior, MOBILE.Archer, MOBILE.Warrior, MOBILE.BattleMage, MOBILE.Knight]), captain: MOBILE.Knight }),
});
/** The hands a crewed ship of the player's sends: Warm Ashes' `_ally_` (Foe _ally_ is Warrior). */
export const HAND = MOBILE.Warrior;
/** RAID-WON (bible/01-Overview/bugs/Field-Bugs-2026-10-19.md): the raids' own crew - their `_ally_` Foe, by the inner name
 *  the machine keys a symbol by (quest/symbol.js getInnerSymbolName): the hands a raid stands in my crew's place. */
export const RAID_CREW = 'ally';

/** Warm Ashes' two raids, as the naval arc starts them (systems/warmAshesShips.js WA_RAID_QUEST's list). */
export const WA_SMALLRAID = 'WAQ_SHIP_SMALLRAID';
export const WA_ATTACK_PIRATE = 'WAQ_SHIP_ATTACK_PIRATE';
/** The raid a pirate class's boarding runs: a flagship's the pirate attack, any other the small raid. */
export const raidQuestOf = (shipClass) => (shipClass?.flagship ? WA_ATTACK_PIRATE : WA_SMALLRAID);
/**
 * THE TASKS A RAID IS WON BY, as the two quests write them (vendor/warm-ashes-ships/Quests): the pirate attack's
 * `_winner_`, set when its `_spells_` leader falls (`_killcommanderknights_`); the small raid's three endings, each the
 * wave it drew killed (`_endquestproper_` the barbarians, `_endquestproper2_` the rogues, `_endquestproper5_` the orcs
 * and their sergeants). Keyed as the machine keys a task: its symbol's inner name (quest/symbol.js getInnerSymbolName).
 * Either quest can also END unwon - the small raid's `_cooldown_` hour runs out, the pirate attack's `_gotYou_` resets.
 */
export const RAID_WIN_TASKS = Object.freeze(['winner', 'endquestproper', 'endquestproper2', 'endquestproper5']);
/** Whether a raid quest was won: one of its winning tasks triggered (a quest that is not a raid never was). */
export function raidQuestWon(quest) {
  const tasks = quest?.tasks;
  if (!tasks?.get) return false;
  return RAID_WIN_TASKS.some((name) => tasks.get(name)?.getTriggerValue?.() === true);
}
/**
 * AUDIT NAV1 (B5) - THE TASK A RAID IS GIVEN UP BY: the pirate attack's `_retreat_` clock, started with its second wave
 * (an hour of the world's clock). It clears the waves' triggers, so its leader never comes, and it stops the `_cooldown_`
 * that would have ended it: a player slower than the hour met no leader and a quest that never ended, and the boarding
 * that waited on it held every other boarding off. The mod left it unfinished (its lines 2025-2029 unwritten, its notes
 * "Add Retreat Timer"); here it is what it names - the boarders fall back and cast off, and the raid ends
 * (scenes/naval/navalHost.js castOff). The small raid declares the clock and never starts it.
 */
export const RAID_RETREAT_TASKS = Object.freeze(['retreat']);
/** Whether a raid quest was given up: its retreat triggered and it was not won. */
export function raidQuestRetreated(quest) {
  const tasks = quest?.tasks;
  if (!tasks?.get || raidQuestWon(quest)) return false;
  return RAID_RETREAT_TASKS.some((name) => tasks.get(name)?.getTriggerValue?.() === true);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Whether a ship can have the grapples thrown on her as her state stands: her colours struck - never one being boarded
 *  already, a prize, a wreck going down or gone. BOARD-MAGNET: the one way aboard (RAM-BOARD's foul is gone with the ram).
 *  @param {{ boarded?: boolean, damage: { state: string } }} ship */
export const boardableState = (ship) => !!ship && !ship.boarded && ship.damage.state === 'struck';

/**
 * A ship's muster: its captain and its men, as MobileTypes. `crewShare` - what her crew has left (0..1).
 * @returns {{ captain: number, men: number[] }}
 */
export function musterOf(shipClass, crewShare = 1) {
  const m = MUSTERS[shipClass.faction] ?? MUSTERS.pirate;
  const n = clamp(Math.round(shipClass.boarders * clamp(crewShare, 0, 1)), MUSTER_MIN, MUSTER_MAX);
  const men = [];
  for (let i = 0; i < n - 1; i++) men.push(m.men[i % m.men.length]);
  return { captain: m.captain, men };
}

/** DECK-WALK: the one team a ship's crew fights as - a pirate's the Criminals', a merchantman's and a navy's the Knights
 *  and Mages' (DFU's MobileTeams) - so a muster of mixed classes (a pirate's Spellsword captain among her barbarians and
 *  archers) never turns on itself under infighting. */
export const CREW_TEAMS = Object.freeze({ pirate: 'Criminals', merchant: 'KnightsAndMages', navy: 'KnightsAndMages' });
export const crewTeamOf = (shipClass) => CREW_TEAMS[shipClass?.faction] ?? CREW_TEAMS.pirate;

/** The hands a crewed ship of the player's sends with them: one for every CREW_PER_HAND of her crew, HANDS_MAX at most. */
export const handsOf = (crew, crewed) => (crewed ? clamp(Math.floor(crew / CREW_PER_HAND), 0, HANDS_MAX) : 0);

/** A repelling party's size for a pirate class boarding a boat with no crew. */
export const repelPartyOf = (shipClass) => clamp(Math.round(shipClass.boarders / 3), REPEL_PARTY.min, REPEL_PARTY.max);

/**
 * BOARD-MAGNET: a hull as `berthPose` reads it - where she lies and her heading, her deck's half beam, her collider's
 * widest half (`halfWidth`) and her middle along her keel (halfway from her stern to her stem, navalShips.js `aftZ`
 * and `bowZ`), so two hulls lie side by side middle to middle, never root to root (a galley's root is 4.7 m aft of her
 * middle).
 * @param {number[]} pos @param {number} yaw @param {number} hull a Come Sail Away hull index
 */
export function berthHull(pos, yaw, hull) {
  const b = hullBuild(hull);
  return { pos, yaw, beam: b.beam, halfWidth: b.halfWidth, midZ: hullMid(b) };
}

/**
 * Where a ship lies ALONGSIDE another: parallel to it (the same heading, or the reciprocal when she lies more than
 * abeam astern - she is hauled round the short way), on the side she lies, the two half beams and BERTH_GAP apart -
 * BOARD-MAGNET: and never nearer than HULL_CLEAR between their widest (`halfWidth`, where it is said) - level with its
 * middle. `lie` ({ side, same }, a berth's own answer) keeps a side and a heading chosen before (BOARD-MAGNET AUDIT: the
 * haul's, chosen when the lines went over - chosen afresh each frame against a turning anchor, a ship lying near 90
 * degrees off it flipped her heading mid-haul, 28 degrees in a frame).
 * @param {{ pos: number[], yaw: number, beam: number, halfWidth?: number, midZ?: number }} anchor - the ship she berths against
 * @param {{ pos: number[], yaw: number, beam: number, halfWidth?: number, midZ?: number }} ship - the ship hauled
 * @param {{ side: 1|-1, same: boolean } | null} [lie]
 * @returns {{ pos: number[], yaw: number, side: 1|-1, same: boolean }}
 */
export function berthPose(anchor, ship, lie = null) {
  const f = [Math.sin(anchor.yaw), 0, Math.cos(anchor.yaw)], r = [f[2], 0, -f[0]];
  const d = [ship.pos[0] - anchor.pos[0], 0, ship.pos[2] - anchor.pos[2]];
  const side = lie?.side ?? (d[0] * r[0] + d[2] * r[2] >= 0 ? 1 : -1);
  // her heading: the anchor's, or its reciprocal - whichever is nearer her own
  const same = lie?.same ?? Math.cos(ship.yaw - anchor.yaw) >= 0;
  const yaw = same ? anchor.yaw : anchor.yaw + Math.PI;
  const off = side * Math.max(anchor.beam + ship.beam + BERTH_GAP, (anchor.halfWidth ?? anchor.beam) + (ship.halfWidth ?? ship.beam) + HULL_CLEAR);
  const along = (anchor.midZ ?? 0) - (same ? 1 : -1) * (ship.midZ ?? 0);
  return {
    pos: [anchor.pos[0] + r[0] * off + f[0] * along, ship.pos[1], anchor.pos[2] + r[2] * off + f[2] * along],
    yaw: wrapAngle(yaw),
    side, same,
  };
}

/** BOARD-MAGNET: the brake (m/s^2) the grapples take a way of `v` m/s off at - all of it over the haul's GRAPPLE_S, so
 *  the ship hauled meets one coming to rest; never past `most` (Come Sail Away's own bound on a brake). */
export const haulBrake = (v, most = Infinity) => Math.min(most, Math.max(0, Number(v) || 0) / GRAPPLE_S);

/**
 * BOARD-MAGNET (AUDIT) - A FRAME OF THE HAUL: her pose `at` drawn toward her berth `to` beside `anchor` ({ pos, yaw, hull },
 * the hull she is hauled to, as it lies this frame), paced on the haul's time left (`t` of GRAPPLE_S, `dt` this frame):
 * first across the anchor's keel to her berth's lane, then along it - a hull lying across the anchor's bow or stern swings
 * out to the lane before it slides in, never wedged behind a stern - her heading round to the berth's the short way,
 * HAUL_SPEED and HAUL_TURN at the most; and kept out of the anchor's hull grown by HULL_CLEAR (navalShips.js hullOverlap,
 * the push that keeps the sea's hulls apart). The eased straight line it replaced drove a galley 39.7 m into another
 * from across her stern; over every start in reach of every pair of hulls this never comes within HULL_CLEAR.
 * @param {{ pos: number[], yaw: number }} at @param {{ pos: number[], yaw: number }} to
 * @param {number} t @param {number} dt @param {{ pos: number[], yaw: number, hull: number }} anchor @param {number} hull hers
 */
export function drawHaul(at, to, t, dt, anchor, hull) {
  if (!(dt > 0)) return at;
  const left = Math.max(GRAPPLE_S - t, dt);
  const f = [Math.sin(anchor.yaw), Math.cos(anchor.yaw)], r = [f[1], -f[0]];
  const local = (p) => { const x = p[0] - anchor.pos[0], z = p[2] - anchor.pos[2]; return [x * r[0] + z * r[1], x * f[0] + z * f[1]]; };
  const [a0, l0] = local(at.pos), [a1, l1] = local(to.pos);
  let step = Math.min((Math.abs(a1 - a0) + Math.abs(l1 - l0)) / left, HAUL_SPEED) * dt;
  const da = clamp(a1 - a0, -step, step);
  step -= Math.abs(da);
  const a = a0 + da, l = l0 + clamp(l1 - l0, -step, step);   // the lane first, then along it with the step it leaves
  const dy = wrapAngle(to.yaw - at.yaw);   // the short way round, in one step whatever the input (ONCRASH1)
  const yaw = wrapAngle(at.yaw + Math.sign(dy) * Math.min(Math.abs(dy), (Math.abs(dy) * dt) / left, HAUL_TURN * dt));
  let pos = [anchor.pos[0] + r[0] * a + f[0] * l, at.pos[1], anchor.pos[2] + r[1] * a + f[1] * l];
  const grown = flatHull(anchor.pos, anchor.yaw, anchor.hull);
  grown.hl += HULL_CLEAR; grown.hw += HULL_CLEAR;
  for (let i = 0; i < 4; i++) {
    const push = hullOverlap(flatHull(pos, yaw, hull), grown);
    if (!push) break;
    pos = [pos[0] + push[0], pos[1], pos[2] + push[1]];
  }
  return { pos, yaw };
}
/** Whether a haul has laid her in her berth. */
const lies = (at, to) => Math.hypot(at.pos[0] - to.pos[0], at.pos[2] - to.pos[2]) < 1e-3 && Math.abs(wrapAngle(at.yaw - to.yaw)) < 1e-4;

/**
 * Whether a boarding fight is won: the captain down and SURRENDER_SHARE of the muster down, or every man of it.
 * @param {{ captainDown: boolean, down: number, total: number }} tally
 */
export function boardingWon({ captainDown, down, total }) {
  if (total <= 0) return true;
  if (down >= total) return true;
  return captainDown && down / total >= SURRENDER_SHARE;
}

/**
 * The boarding's own clock and phases:
 *   'grapple' - she is hauled alongside: GRAPPLE_S, and on until she lies in her berth (BOARD-MAGNET AUDIT: a haul
 *               around a hull takes longer - HAUL_MAX_S at the most); then
 *   'fight'   - the muster stands on the deck; the host tallies it (`won`) and the distance (`abandon`); then
 *   'prize'   - the plunder window; then 'done'.
 * `kind` - 'board' (the player boards her) or 'repel' (she boards the player); `hull` hers (the haul's own footprint).
 */
export function createBoarding({ kind, shipId, from, to, hull = 0 }) {
  const b = { kind, shipId, phase: 'grapple', t: 0, from, to, hull, at: { pos: [...from.pos], yaw: from.yaw }, arrived: false, quest: null, foes: [], hands: [], outcome: null };
  return Object.assign(b, {
    /** BOARD-MAGNET: a frame of the haul - her pose (`at`) drawn toward `to`, her berth as the hull she is hauled to,
     *  `anchor`, lies NOW (`drawHaul`); with no anchor (over her rail on foot) she lies where she is told; laid in the berth
     *  at HAUL_MAX_S whatever held her. Answers her pose. */
    haul(to, anchor, dt) {
      b.to = to;
      const d = Math.max(0, dt);
      b.at = !anchor || b.t + d >= HAUL_MAX_S ? { pos: [...to.pos], yaw: to.yaw } : drawHaul(b.at, to, b.t, d, anchor, b.hull);
      b.arrived = lies(b.at, to);
      return b.at;
    },
    step(dt) {
      if (b.phase !== 'grapple') return null;
      b.t += Math.max(0, dt);
      if ((b.t >= GRAPPLE_S - 1e-9 && b.arrived) || b.t >= HAUL_MAX_S) { b.phase = 'fight'; return 'fight'; }   // a clock summed frame by frame, a hair either side
      return null;
    },
    win() { if (b.phase === 'fight') { b.phase = 'prize'; b.outcome = 'won'; } },
    abandon() { if (b.phase === 'fight' || b.phase === 'grapple') { b.phase = 'done'; b.outcome = 'abandoned'; } },
    done() { b.phase = 'done'; b.outcome ??= 'done'; },
  });
}
