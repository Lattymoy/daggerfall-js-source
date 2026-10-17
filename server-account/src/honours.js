// @ts-check
// SIGN-BATCH (2026-10-16, Mac: "Is the server okay?", then "Start #2" - the account database's primary at its ceiling of
// round trips; bible/11-Multiplayer/Scale-Arc.md SIGN-BATCH): THE HONOURS A BADGE IS MADE OF, IN ONE BATCH. The doors
// that read a badge (arena.js ARENA_HONOUR_PATHS - the token's mint first) laid the arena's honours on the row, then Iliac
// Hand's, then The King's Gambit's, each its own reads on the binding (AUDIT SCALE4d A1: a stale #1 is counted again and
// written, so never off a replica): some four round trips of the primary's a mint, past its session's lookup, at 3.5
// mints a second at the evening's peak. Each game says its reads as statements (arenaHonoursPlan, iliacHonoursPlan,
// gambitHonoursPlan); they go in ONE batch, and each game's answer is read from its own - a stale #1 counted and stored
// after it as before, in the same order.
import { arenaHonoursPlan } from './arena.js';
import { iliacHonoursPlan } from './iliac.js';
import { gambitHonoursPlan } from './gambit.js';

/**
 * The row with the three games' honours on it - `arena`, `iliac`, `gambit`, as withArenaHonours, withIliacHonours and
 * withGambitHonours lay them, in that order.
 * @param {{ db: any }} ctx @param {any} player @param {number} nowS
 */
export async function withHonours(ctx, player, nowS) {
  if (!player) return player;
  const plans = [arenaHonoursPlan(ctx, player, nowS), iliacHonoursPlan(ctx, player, nowS), gambitHonoursPlan(ctx, player, nowS)];
  const reads = plans.flatMap((p) => p.reads);
  const res = reads.length ? await ctx.db.batch(reads) : [];
  let at = 0;
  /** @type {any[]} */
  const answers = [];
  for (const p of plans) { answers.push(await p.from(res.slice(at, at + p.reads.length))); at += p.reads.length; }
  return { ...player, arena: answers[0], iliac: answers[1], gambit: answers[2] };
}
