// @ts-check
// NAV-D (2026-09-28, Mac: "actual sailing ships to the world that players can encounter and pillage, which should
// also directly enhance and integrate into the pirate quest system") - BOARDING: taking a ship with the sword, and
// throwing boarders off your own. The port's own; pure - the phases, the berth, the musters and the reckoning. The
// host stands the foes, moves the player, opens the windows and runs the quests.
//
// WHEN YOU BOARD HER. A ship that has struck her colours (navalDamage.js STRUCK_AT) lies within BOARD_RANGE of your
// helm, your way under BOARD_SPEED: Activate (the key the prompt names) throws the grapples. She is hauled
// ALONGSIDE over GRAPPLE_S - swung parallel to your hull on the side she lies, BERTH_GAP of water between the two
// planks (`berthPose`) - and you go over her rail onto her deck. Her crew stands to fight on it: her MUSTER, what her
// class sends (navalShips.js `boarders`) thinned by what her crew has lost, never under MUSTER_MIN nor over
// MUSTER_MAX, led by her CAPTAIN - a pirate flagship's and a navy's a named officer, the Spellsword Warm Ashes makes
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

export const BOARD_RANGE = 32;
export const BOARD_SPEED = 2.5;
export const GRAPPLE_S = 2.2;
export const BERTH_GAP = 2.2;
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
 * Where a ship lies ALONGSIDE another: parallel to it (the same heading, or the reciprocal when she lies more than
 * abeam astern - she is hauled round the short way), on the side she lies, the two half beams and BERTH_GAP apart,
 * level with its middle.
 * @param {{ pos: number[], yaw: number, beam: number, midZ?: number }} anchor - the ship she berths against
 * @param {{ pos: number[], yaw: number, beam: number, midZ?: number }} ship - the ship hauled
 * @returns {{ pos: number[], yaw: number, side: 1|-1 }}
 */
export function berthPose(anchor, ship) {
  const f = [Math.sin(anchor.yaw), 0, Math.cos(anchor.yaw)], r = [f[2], 0, -f[0]];
  const d = [ship.pos[0] - anchor.pos[0], 0, ship.pos[2] - anchor.pos[2]];
  const side = d[0] * r[0] + d[2] * r[2] >= 0 ? 1 : -1;
  // her heading: the anchor's, or its reciprocal - whichever is nearer her own
  const same = Math.cos(ship.yaw - anchor.yaw) >= 0;
  const yaw = same ? anchor.yaw : anchor.yaw + Math.PI;
  const off = side * (anchor.beam + ship.beam + BERTH_GAP);
  const along = (anchor.midZ ?? 0) - (same ? 1 : -1) * (ship.midZ ?? 0);
  return {
    pos: [anchor.pos[0] + r[0] * off + f[0] * along, ship.pos[1], anchor.pos[2] + r[2] * off + f[2] * along],
    yaw: wrapAngle(yaw),
    side,
  };
}

/** A pose on the way from `from` to `to`: `t` in [0, 1], eased (smoothstep), the yaw the short way round. */
export function haulPose(from, to, t) {
  const k = clamp(t, 0, 1);
  const s = k * k * (3 - 2 * k);
  const dy = wrapAngle(to.yaw - from.yaw);   // the short way round, in one step whatever the input (ONCRASH1)
  return {
    pos: [from.pos[0] + (to.pos[0] - from.pos[0]) * s, from.pos[1] + (to.pos[1] - from.pos[1]) * s, from.pos[2] + (to.pos[2] - from.pos[2]) * s],
    yaw: from.yaw + dy * s,
  };
}

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
 *   'grapple' - she is hauled alongside (GRAPPLE_S); then
 *   'fight'   - the muster stands on the deck; the host tallies it (`won`) and the distance (`abandon`); then
 *   'prize'   - the plunder window; then 'done'.
 * `kind` - 'board' (the player boards her) or 'repel' (she boards the player).
 */
export function createBoarding({ kind, shipId, from, to }) {
  const b = { kind, shipId, phase: 'grapple', t: 0, from, to, quest: null, foes: [], hands: [], outcome: null };
  return Object.assign(b, {
    /** The haul's pose now, while grappling; null after. */
    pose() { return b.phase === 'grapple' ? haulPose(b.from, b.to, b.t / GRAPPLE_S) : null; },
    step(dt) {
      if (b.phase !== 'grapple') return null;
      b.t += Math.max(0, dt);
      if (b.t >= GRAPPLE_S) { b.phase = 'fight'; return 'fight'; }
      return null;
    },
    win() { if (b.phase === 'fight') { b.phase = 'prize'; b.outcome = 'won'; } },
    abandon() { if (b.phase === 'fight' || b.phase === 'grapple') { b.phase = 'done'; b.outcome = 'abandoned'; } },
    done() { b.phase = 'done'; b.outcome ??= 'done'; },
  });
}
