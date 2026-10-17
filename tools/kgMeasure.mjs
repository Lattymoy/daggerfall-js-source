#!/usr/bin/env node
// KG2 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md section 12; the owner: "Do KG2"): THE TIERS, MEASURED - a
// regular of each tier (systems/gambit/gambitPatrons.js) dealt against an Auto-filled 300 and three potions, both seats played
// by the regulars' own rules (regularStep), the player's seat with no blunder unless asked; seeded, so every figure the
// record quotes is a command away.
//
// EVERY GAME IS PLAYED TO ITS END OR TO `--rounds` (200), and one not decided by then is counted by what stands
// (AUDIT KG B3 - the first measure stopped a game at the two kings alone, on the claim that neither king would ever
// move again; a blunder walks a lone king, so some of those games ended inside the cap):
//   'kings'  the two kings alone at the cap - the rules walk a king at a foe only by a blunder (AiBlunder walks a piece
//            at random, a lone king too), so two kings alone end, if ever, by a blunder's walk into a blow or a hazard's
//            bite, often hundreds of rounds on; two that never blunder stand for good;
//   'long'   armies still on the board at the cap - THE HAZARD DANCE, mostly: two pieces across a cell with an active
//            hazard on it, each stepping onto it to reach the other (in range, 50, less the hazard's 40) and off it
//            again on its turn's last action before it strikes (the escape comes before the blow), turn after turn.
// The rounds a game took are averaged over the decided games alone, and the longest decided game is said.
//
//   node tools/kgMeasure.mjs                          # the record's run: 1,000 games a tier, seed 1
//   node tools/kgMeasure.mjs --games 200 --seed 7     # another sample
//   node tools/kgMeasure.mjs --player-blunder 0.15    # the player's seat blundering as a Seasoned regular does
import { isMain } from './lib/isMain.mjs';
import { KG_POINT_BUDGET, autoFill, finishTurn } from '../src/net/kingsGambit.js';
import { GAMBIT_TIERS, dealRegular, regularStep } from '../src/systems/gambit/gambitPatrons.js';

/** A xorshift32 source - the measure's own, seeded. @param {number} seed */
export const xorshift = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
};

/** MurmurHash3's finalizer: every bit of a 32-bit word stirred into every other, a bijection (0 to 0 alone). */
const mix32 = (/** @type {number} */ h) => {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** A game's seed in a sample: the sample's seed and the game's place in it, spread, then mixed - xorshift32's first
 *  draws from neighbouring seeds are near one another (AUDIT KG B5: the first draws of consecutive games correlated at
 *  -0.48), and the first draw is the player's Auto-fill's. Never 0, which xorshift32 cannot leave. */
export const gameSeed = (seed, g) => mix32((Math.imul(seed, 1000003) + Math.imul(g, 7919) + 1) >>> 0) || 1;

/**
 * ONE GAME against a regular of `tier`, from `seed`: the player's army Auto-filled to KG_POINT_BUDGET, then the deal
 * (dealRegular), then turn after turn - each seat's actions by regularStep, the turn's end by finishTurn - one source for
 * all of it. Answers `{end, rounds}`: 'regular' or 'player' (who won), or, past `rounds`, 'kings' (the two kings alone)
 * or 'long'.
 * @param {{blunder: number, budget: number, potions: number}} tier @param {number} seed
 * @param {{playerBlunder?: number, rounds?: number}} [o]
 */
export function playRegular(tier, seed, { playerBlunder = 0, rounds = 200 } = {}) {
  const rnd = xorshift(seed);
  let st = dealRegular({ army: autoFill([], KG_POINT_BUDGET, rnd), tier, rand32: rnd });
  const player = { blunder: playerBlunder };
  while (!st.over) {
    if (st.round > rounds) return { end: st.pieces.every((p) => p.king) ? 'kings' : 'long', rounds: st.round };
    st = st.ending ? finishTurn(st, rnd).state : regularStep(st, st.turn, st.turn === 1 ? tier : player, rnd, rnd).state;
  }
  return { end: st.over.winner === 1 ? 'regular' : 'player', rounds: st.round };
}

/**
 * A TIER'S TALLY over `games` seeded games: `{regular, player, kings, long, rounds, longest}` (rounds summed over the
 * decided, and the most a decided game took).
 * @param {{blunder: number, budget: number, potions: number}} tier
 * @param {{games?: number, seed?: number, playerBlunder?: number, rounds?: number}} [o]
 */
export function measureTier(tier, { games = 1000, seed = 1, ...opts } = {}) {
  const tally = { regular: 0, player: 0, kings: 0, long: 0, rounds: 0, longest: 0 };
  for (let g = 0; g < games; g++) {
    const r = playRegular(tier, gameSeed(seed, g), opts);
    tally[r.end]++;
    if (r.end === 'regular' || r.end === 'player') { tally.rounds += r.rounds; tally.longest = Math.max(tally.longest, r.rounds); }
  }
  return tally;
}

/** The run: a line a tier. @param {string[]} argv */
function main(argv) {
  const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : dflt; };
  const games = arg('--games', 1000), seed = arg('--seed', 1), playerBlunder = arg('--player-blunder', 0), rounds = arg('--rounds', 200);
  if (![games, seed, playerBlunder, rounds].every(Number.isFinite) || games < 1) {
    console.error('usage: node tools/kgMeasure.mjs [--games N] [--seed S] [--player-blunder P] [--rounds R]');
    return 2;
  }
  console.log(`${games} games a tier, seed ${seed}, the player's seat blundering ${playerBlunder}`);
  const pct = (n, of) => `${(100 * n / of).toFixed(1)}%`.padStart(6);
  for (const tier of GAMBIT_TIERS) {
    const t = measureTier(tier, { games, seed, playerBlunder, rounds });
    const decided = t.regular + t.player;
    console.log(`${tier.key.padEnd(12)} regular ${pct(t.regular, games)}  player ${pct(t.player, games)}  kings alone ${pct(t.kings, games)}  long ${pct(t.long, games)}`
      + `  | of the decided: regular ${pct(t.regular, decided || 1)}, ${(t.rounds / (decided || 1)).toFixed(1)} rounds a game, the longest ${t.longest}`);
  }
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
