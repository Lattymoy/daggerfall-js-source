// @ts-check
// EG-H3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 13.1, EG3): THE BOSS
// SEAM - one contract every boss the relay hosts keeps, made from the shape the three brains already kept by convention:
//
//   new(birth, rng)                          a fight born from the brain's own birth record (the gate's day, wrath and
//                                            marks; a Hollow's slot, number and marks; a serpent's day, sounding and
//                                            site) - `rng` for a brain that draws at its birth (none of the three does)
//   join(f, sub, name, lv, now, present, o)  a fighter in - its own refusals in `o` (the gate's and the serpent's
//                                            `admits`, the serpent's hull `hl` and `near`); whether it is in
//   hit(f, sub, d, r, pose, now, seq, o)     a blow believed by the brain's caps - the serpent's zone in `o.z`, its hand
//                                            the blow's kind 1; answers the brain's own (the damage taken, the
//                                            serpent's words)
//   step(f, now, bodies, rng) -> frames[]    one beat over the census
//   stateOf(f)                               the whole fight, as a joiner is told it
//   judge(f, bodies, now) -> [{sub, share}]  its blows judged on the relay's trails (net/bossRef.js) - the bodies carry
//                                            their trails (`tr`), so the page's `judge(f, blow, trails)` is this
//   earned(f, sub)                           whether its receipt is owed
//
// THE THREE RE-PLUGGED, FRAMES AND PINS UNCHANGED: the Warden (net/gate/gateBrain.js), the Brass Remnant (net/superDungeon/sdRemnant.js)
// and the Sea Serpent (net/serpent/serpentBrain.js). Where a brain's shape already was the contract's, the seam's member IS the
// brain's own function (the same reference - nothing between the host and the law); where it was not (a birth's
// arguments, the refusals a join takes, the serpent's zone and hand), a thin map hands the brain exactly the arguments
// the host handed it before. The relay's hosts call through the seam (server/src/index.js), and THE GOLDEN FRAMES
// (test/net/eliteGates/egseam_law.test.js) hold every word a court, a realm and a cell say to what they said before it.
//
// What the seam does not take: the gate's crystals, host and heals and the Remnant's Echoes and Hearts are each brain's
// own blows beside its boss (`applyCrystalHit`, `applyHostHit`, `applyEchoHit`, `applyHeartHit`) and stay so.
//
// EG-ZK (2026-10-12; section 13.1, "The Spire's lords are written to it"): THE SPIRE'S LORDS keep the contract too, ONE plug
// for every lord and champion (net/eliteGates/egLords.js EG_SEAM - it imports this board, so the relay's graph walks as before). The
// breach's director (net/eliteGates/egBrain.js) calls it inside its one beat with the legion and the place's hazards: the seam is a
// contract the director calls, not a second host.
//
// Pure: a plug board, no state. Not a DFU member. Ledger A (ELITE-GATES).
import { newFight, joinFight, applyHit, stepBrain, stateOf, earned } from './gate/gateBrain.js';
import { newRemnantFight, joinRemnant, applyRemnantHit, stepRemnant, remnantStateOf } from './superDungeon/sdRemnant.js';
import { newSerpentFight, joinSerpentFight, applySerpentHit, stepSerpentBrain, serpentStateOf, serpentEarned } from './serpent/serpentBrain.js';
import { judgeGate, judgeRemnant, judgeSerpent } from './bossRef.js';

/** The contract's members, in the page's order. */
export const BOSS_SEAM_KEYS = Object.freeze(['new', 'join', 'hit', 'step', 'stateOf', 'judge', 'earned']);

/**
 * A boss plugged into the seam: every member of the contract a function, nothing else carried. Throws on a member
 * missing - a brain that does not keep the contract never reaches a host.
 * @param {string} name
 * @param {Record<string, Function>} members
 * @returns {Readonly<Record<string, any>>}
 */
export function bossSeam(name, members) {
  /** @type {Record<string, any>} */
  const out = { name };
  for (const k of BOSS_SEAM_KEYS) {
    if (typeof members?.[k] !== 'function') throw new TypeError(`the ${name} boss keeps no ${k}`);
    out[k] = members[k];
  }
  return Object.freeze(out);
}

/** THE GATE'S WARDEN: born of `{ day, now, wrathAt, boss, md }`, joined while `o.admits`. */
export const GATE_SEAM = bossSeam('gate', {
  new: ({ day, now, wrathAt, boss, md = null, pt = null, ti = null }) => newFight(day, now, wrathAt, boss, md, pt, ti),   // WB14b: and the night's portents; WB14e: its Tithe-Imp's moment
  join: (f, sub, name, lv, now, present = null, o = {}) => joinFight(f, sub, name, lv, now, o.admits, present),
  hit: applyHit, step: stepBrain, stateOf, judge: judgeGate, earned,
});
/** THE ABYSS DUNGEON'S BRASS REMNANT: born of `{ s, fi, now, mk }`; earned by the gate's own law. */
export const SD_SEAM = bossSeam('sd', {
  new: ({ s, fi, now, mk = null }) => newRemnantFight(s, fi, now, mk),
  join: joinRemnant, hit: applyRemnantHit, step: stepRemnant, stateOf: remnantStateOf, judge: judgeRemnant, earned,
});
/** THE SEA SERPENT: born of `{ day, now, soundAt, boss, sx, sz, yaw }`, joined with `o.hl`, `o.admits` and `o.near`; a
 *  blow's zone `o.z`, a hand's own weapons the blow's kind 1 (SERPENT4). */
export const SERPENT_SEAM = bossSeam('serpent', {
  new: ({ day, now, soundAt, boss, sx, sz, yaw = 0 }) => newSerpentFight(day, now, soundAt, boss, sx, sz, yaw),
  join: (f, sub, name, lv, now, present = null, o = {}) => joinSerpentFight(f, sub, name, lv, o.hl, now, o.admits, present, o.near ?? true),
  hit: (f, sub, d, r, pose, now, _seq = null, o = {}) => applySerpentHit(f, sub, d, o.z, pose, now, r === 1),
  step: stepSerpentBrain, stateOf: serpentStateOf, judge: judgeSerpent, earned: serpentEarned,
});
