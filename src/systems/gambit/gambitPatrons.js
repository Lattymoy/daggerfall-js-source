// @ts-check
// KG2 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 2.7, 10.5 and 12; the owner: "Do KG2"): THE
// INNKEEPER'S PLAY, AT A REGULAR'S CHAIR - pure, DOM-free. The mod's innkeeper is a tavern's regular here (section 10.5):
// the regular's TIER is the mod's TierFor over the regular's seed, the ARMY is Auto-filled to the tier's points at every
// deal, and the PLAY is the mod's AiAction verbatim - a blunder by the tier's chance, a potion, an escape off a hazard,
// the best blow, the best move - read off the law itself (net/kingsGambit.js: GetReachable, InRange, FoesInRange,
// PathMap).
//
// THE MOD'S, VERBATIM - TheKingsGambit.dll (section 2.7 tables every number):
//   the tiers   Tiers (the least stake a regular sits down for, the points fielded, the potions, the blunders); TierFor's
//               hash and bands
//   the deal    StartBattle: the regular's army Auto-filled to the tier's points, then BeginMatch with the tier's potions
//   the play    AiAction - AiBlunder, the potion's line, TryEscape (NearestPath), the best blow, the best move
//               (HazardPenalty) - and AiTurnRoutine's step; every score at float32, as the C# keeps it
//
// THE PORT'S OWN: the tier is the regular's SEED's (scenes/worldModes.js regularSeeds), where the mod hashed the
// innkeeper's faction - so a tavern's regulars set the tiers it offers, the same every evening. A tier's words (its name
// and blurb, section 2.7) are the client's, said through the text core (L10N4): here a tier is its key and its numbers.
// The regular's choices draw from the `rand32` handed in - Random.value is the law's nextDouble at float32,
// Random.Range(0, n) drawBelow(n) - in the mod's order of draws, so a seeded game replays; a step draws through the law's
// checked source (AUDIT KG B8), so a broken one takes no step rather than spinning. EnemyPause (1.2 s before and between
// the regular's actions) is the table's clock (KG3): a step here is one action.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import {
  KG_POINT_BUDGET, KG_POTIONS_PER_SIDE, KG_HAZARD_DAMAGE, KG_UNREACHABLE,
  autoFill, newGambit, gambitAct, nextDouble, checkedRand32, cellIndex, pathMap, hazardAt, reachable, foesInRange, targetInRange,
} from '../../net/kingsGambit.js';
import { drawBelow } from '../../net/dice.js';

/** @typedef {import('../../net/kingsGambit.js').GambitState} GambitState */
/** @typedef {import('../../net/kingsGambit.js').GambitBoard} GambitBoard */
/** @typedef {import('../../net/kingsGambit.js').GambitPiece} GambitPiece */

// ── THE TIERS ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** THE TIERS (Tiers), in the mod's order: each its key, the least stake a regular of it sits down for, the points the
 *  regular fields, the potions held, and the share of the regular's actions that are blunders. */
export const GAMBIT_TIERS = Object.freeze([
  Object.freeze({ key: 'amateur', stake: 10, budget: 220, potions: 2, blunder: 0.35 }),
  Object.freeze({ key: 'seasoned', stake: 50, budget: 300, potions: 3, blunder: 0.15 }),
  Object.freeze({ key: 'veteran', stake: 200, budget: 360, potions: 3, blunder: 0.05 }),
  Object.freeze({ key: 'grandmaster', stake: 1000, budget: 450, potions: 4, blunder: 0 }),
]);
/** TierFor's hash: (seed x 73856093) ^ 0x127409F on an int32 (the product wraps), its remainder by 100 made positive. */
export const GAMBIT_TIER_HASH = Object.freeze([73856093, 0x127409F]);
/** TierFor's bands: under 40 Amateur, under 75 Seasoned, under 93 Veteran, else Grandmaster. */
export const GAMBIT_TIER_BANDS = Object.freeze([40, 75, 93]);

/** A regular's TIER (TierFor), by the regular's seed - a uint32, read as the int32 the C# multiplies. @param {number} seed */
export function tierFor(seed) {
  const h = (((Math.imul(seed | 0, GAMBIT_TIER_HASH[0]) ^ GAMBIT_TIER_HASH[1]) % 100) + 100) % 100;
  const band = GAMBIT_TIER_BANDS.findIndex((b) => h < b);
  return GAMBIT_TIERS[band < 0 ? GAMBIT_TIERS.length - 1 : band];
}

// ── THE DEAL ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** THE REGULAR'S ARMY (StartBattle): Auto-filled to the tier's points - a fresh army at every deal; null for a source
 *  that is not one (autoFill's check). @param {{budget: number}} tier @param {() => number} rand32 */
export const regularArmy = (tier, rand32) => autoFill([], tier.budget, rand32);

/**
 * A GAME AGAINST A REGULAR (StartBattle, then BeginMatch), or null for an army or a source the law refuses: the player
 * the host - side 0, `army` within KG_POINT_BUDGET, KG_POTIONS_PER_SIDE potions - and the regular the guest, side 1,
 * the regular's army and potions the tier's. One source, in the mod's order: the regular's army first, then the board.
 * @param {{army: number[], tier: {budget: number, potions: number}, rand32: () => number}} p
 */
export function dealRegular({ army, tier, rand32 }) {
  return newGambit({ armies: [army, regularArmy(tier, rand32)], rand32, potions: [KG_POTIONS_PER_SIDE, tier.potions], budgets: [KG_POINT_BUDGET, tier.budget] });
}

// ── THE PLAY ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** AiBlunder: one time in two a blundering piece with a foe in range strikes one, else it walks. */
export const GAMBIT_BLUNDER_STRIKE = 0.5;
/** The potion's line: a piece's share of its health at or below which a regular drinks for it - a king's, any other's. */
export const GAMBIT_POTION_LINE = Object.freeze({ king: 0.5, other: 0.3 });
/** The best blow's weights over its attack and its draw: a blow at the king, a blow that kills. */
export const GAMBIT_BLOW_WEIGHTS = Object.freeze({ king: 40, kill: 30 });
/** The best move's weights. A king: alarmed by a foe this near (in steps), the gain in distance it moves away times
 *  `flee`, else `stay`. Any other piece, from a cell that puts a foe in range: `reach`, `king` more with the king among
 *  them, and a ranged one `space` times its distance from the nearest foe (to `spaceMax`); from any other cell, its gain
 *  in nearness times `close`. */
export const GAMBIT_MOVE_WEIGHTS = Object.freeze({ alarm: 4, flee: 5, stay: -100, reach: 50, king: 20, space: 0.5, spaceMax: 20, close: 3 });
/** HazardPenalty: what a move to a hazard's cell costs - a warning, an active hazard. */
export const GAMBIT_HAZARD_PENALTY = Object.freeze({ warning: 8, active: 40 });
/** The draw a move's or an escape's score is jittered by: Random.value times this, ties broken at random. */
export const GAMBIT_JITTER = 0.1;

const f32 = Math.fround;
/** Random.value: a float in [0, 1] off the regulars' source. @param {() => number} rand32 */
const value = (rand32) => f32(nextDouble(rand32));
/** NearestPath: the fewest steps any of the maps' pieces walks to (c, r), KG_UNREACHABLE when none does.
 *  @param {number[][]} maps @param {number} c @param {number} r */
const nearestPath = (maps, c, r) => maps.reduce((m, d) => Math.min(m, d[cellIndex(c, r)]), KG_UNREACHABLE);
/** HazardPenalty: the cell's hazard as a move weighs it. @param {GambitBoard} board @param {number} c @param {number} r */
function hazardPenalty(board, c, r) {
  const h = hazardAt(board, c, r);
  return !h ? 0 : h.active ? GAMBIT_HAZARD_PENALTY.active : GAMBIT_HAZARD_PENALTY.warning;
}

/** AiBlunder: one of the regular's pieces at random strikes a foe in its range at random one time in two (the draw taken
 *  only when it has one), else walks to a cell it reaches at random; null when it can do neither.
 *  @param {GambitState} state @param {GambitPiece[]} mine @param {() => number} rand32 */
function blunder(state, mine, rand32) {
  const p = mine[drawBelow(mine.length, rand32)];
  const foes = foesInRange(state, p);
  if (foes.length > 0 && value(rand32) < f32(GAMBIT_BLUNDER_STRIKE)) {
    return { type: 'attack', piece: p.id, target: foes[drawBelow(foes.length, rand32)].id };
  }
  const cells = reachable(state, p);
  if (!cells.length) return null;
  const [col, row] = cells[drawBelow(cells.length, rand32)];
  return { type: 'move', piece: p.id, col, row };
}

/** TryEscape's cell: of the cells `p` reaches with no hazard on them (warning or active), a king's farthest from the
 *  foes by their walk and any other's nearest, a draw in [0, 0.1] on each (Random.value is Unity's, inclusive); null when
 *  none is clear.
 *  @param {GambitState} state @param {GambitPiece} p @param {number[][]} maps @param {() => number} rand32 */
function escapeCell(state, p, maps, rand32) {
  let best = -Infinity, cell = null;   // float.MinValue: below every score
  for (const [c, r] of reachable(state, p)) {
    if (hazardAt(state, c, r)) continue;
    const near = nearestPath(maps, c, r);
    const score = f32((p.king ? near : -near) + f32(value(rand32) * f32(GAMBIT_JITTER)));
    if (score > best) { best = score; cell = [c, r]; }
  }
  return cell;
}

/** A tier the play reads: its share of blunders, a number in [0, 1] - anything else would never blunder (`x < NaN` is
 *  false), a Grandmaster's play passed off silently (AUDIT KG B8). @param {any} tier */
const playable = (tier) => typeof tier?.blunder === 'number' && tier.blunder >= 0 && tier.blunder <= 1;

/**
 * A REGULAR'S CHOICE (AiAction) for side `side` on its turn: a command the law takes (`{type: 'move', piece, col, row}`,
 * `{type: 'attack', piece, target}`, `{type: 'potion', piece}`), or null when the regular finds none, or for a tier the
 * play cannot read - the first that answers:
 *   1. with the tier's chance, a BLUNDER (AiBlunder) - the chance drawn every action, a Grandmaster's too;
 *   2. a POTION, while one is held, for the piece with the least share of its health at or below its line;
 *   3. an ESCAPE (TryEscape) for a piece on an active hazard that would die of its bite - or any, on the turn's last
 *      action - to the clear cell its kind prefers;
 *   4. the BEST BLOW: its attack and a draw, more at the king and more for a kill;
 *   5. the BEST MOVE scoring above 0: a king flees an alarm, any other piece steps into range or nearer the foes,
 *      a hazard's cell weighed against, a draw on each.
 * The foes' walks are PathMap's from each foe (floor only, pieces no bar). `rand32` stands for Unity's shared Random,
 * drawn as it is handed (regularStep checks it, as newGambit checks buildMap's).
 * @param {GambitState} state @param {number} side @param {{blunder: number}} tier @param {() => number} rand32
 */
export function regularAction(state, side, tier, rand32) {
  if (!state || !playable(tier)) return null;
  const mine = state.pieces.filter((p) => p.side === side);
  const foes = state.pieces.filter((p) => p.side !== side);
  if (!mine.length || !foes.length) return null;
  const lastAction = state.actions === 1;   // AiTurnRoutine's a == 1: a turn opens with KG_ACTIONS_PER_TURN, two
  if (value(rand32) < f32(tier.blunder)) return blunder(state, mine, rand32);
  const maps = foes.map((f) => pathMap(state.tiles, f.col, f.row));
  if (state.potions[side] > 0) {
    let drinker = null, low = f32(1);
    for (const p of mine) {
      const share = f32(f32(p.hp) / f32(p.maxHp));
      if (share <= f32(p.king ? GAMBIT_POTION_LINE.king : GAMBIT_POTION_LINE.other) && share < low) { drinker = p; low = share; }
    }
    if (drinker) return { type: 'potion', piece: drinker.id };
  }
  for (const p of mine) {
    const h = hazardAt(state, p.col, p.row);
    if (!h || !h.active || !(lastAction || p.hp <= KG_HAZARD_DAMAGE[h.kind])) continue;
    const cell = escapeCell(state, p, maps, rand32);
    if (cell) return { type: 'move', piece: p.id, col: cell[0], row: cell[1] };
  }
  let best = -Infinity, striker = null, struck = null;
  for (const p of mine) {
    for (const t of foesInRange(state, p)) {
      let score = f32(p.atk + value(rand32));
      if (t.king) score = f32(score + GAMBIT_BLOW_WEIGHTS.king);
      if (t.hp <= p.atk) score = f32(score + GAMBIT_BLOW_WEIGHTS.kill);
      if (score > best) { best = score; striker = p; struck = t; }
    }
  }
  if (striker) return { type: 'attack', piece: striker.id, target: struck.id };
  const W = GAMBIT_MOVE_WEIGHTS;
  let top = f32(0), mover = null, to = null;
  for (const p of mine) {
    const here = nearestPath(maps, p.col, p.row);
    for (const [c, r] of reachable(state, p)) {
      const there = nearestPath(maps, c, r);
      let score;
      if (p.king) {
        score = here <= W.alarm && there > here ? f32((there - here) * W.flee) : W.stay;
      } else {
        let inRange = false, kingInRange = false;
        for (const f of foes) {
          if (targetInRange(state, p, c, r, f)) { inRange = true; if (f.king) kingInRange = true; }
        }
        score = inRange ? f32(W.reach + (kingInRange ? W.king : 0) + (p.ranged ? f32(W.space * Math.min(there, W.spaceMax)) : 0)) : f32((here - there) * W.close);
      }
      score = f32(score - hazardPenalty(state, c, r));
      score = f32(score + f32(value(rand32) * f32(GAMBIT_JITTER)));
      if (score > top) { top = score; mover = p; to = [c, r]; }
    }
  }
  return mover ? { type: 'move', piece: mover.id, col: to[0], row: to[1] } : null;
}

/**
 * A REGULAR'S ACTION, TAKEN (AiTurnRoutine's step - its clock the table's): `{cmd, state, events}`, the regular's choice
 * applied by the law (gambitAct, a blow's roll off `gameRand`) - or, when the regular finds none or the law refuses it,
 * the turn ended (the routine's actionsLeft = 0 and QueueTurnEnd: End turn). Null when the action is not the regular's
 * to take - the game over, another's turn, the turn ending - and for a tier the play cannot read or a choices' source
 * that is not one (the law's checkedRand32: a draw that is no 32-bit draw, or draws without end): neither takes a step,
 * as the law's broken source deals no game - never a turn passed in silence. `aiRand` stands for the choices' source
 * (Unity's shared Random), `gameRand` for the game's dice (System.Random).
 * @param {GambitState} state @param {number} side @param {{blunder: number}} tier @param {() => number} aiRand
 * @param {() => number} gameRand
 */
export function regularStep(state, side, tier, aiRand, gameRand) {
  if (!state || state.over || state.turn !== side || state.ending || state.actions <= 0 || !playable(tier)) return null;
  let cmd;
  try { cmd = regularAction(state, side, tier, checkedRand32(aiRand)); } catch { return null; }
  const out = cmd ? gambitAct(state, side, cmd, gameRand) : null;
  if (out?.state) return { cmd, state: out.state, events: out.events };
  const end = gambitAct(state, side, { type: 'end' });
  return { cmd: { type: 'end' }, state: end.state, events: end.events };
}
