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
import { renownForXp } from '../../src/net/renown.js';   // PWR4: the long road's titles, off the account's best track

/**
 * The row with the three games' honours on it - `arena`, `iliac`, `gambit`, as withArenaHonours, withIliacHonours and
 * withGambitHonours lay them, in that order - and PWR4's `renownBest`.
 * @param {{ db: any }} ctx the binding's (AUDIT SCALE4d A1) @param {any} player @param {number} nowS
 * @param {{ db: any }} [readCtx] where a plain read rides - the mint's session (index.js), else `ctx`
 */
export async function withHonours(ctx, player, nowS, readCtx = ctx) {
  if (!player) return player;
  const plans = [arenaHonoursPlan(ctx, player, nowS), iliacHonoursPlan(ctx, player, nowS), gambitHonoursPlan(ctx, player, nowS)];
  const reads = plans.flatMap((p) => p.reads);
  // PWR4 (bible/05-Combat/Power-Arc.md section 7): and the account's best Renown - the long road's three titles
  // (net/identityToken.js RENOWN_TITLES) are derived from it as the founder is from a date. A plain read, nothing stored
  // after it: on the read's own ctx (the mint's session), beside the batch, never in it (PRIMARY-TRIPS: the binding's batch
  // is the three games' alone)
  const [res, best] = await Promise.all([
    reads.length ? ctx.db.batch(reads) : [],
    readCtx.db.prepare('SELECT MAX(xp) AS best FROM renown_tracks WHERE player = ?1').bind(player.id).first(),
  ]);
  let at = 0;
  /** @type {any[]} */
  const answers = [];
  for (const p of plans) { answers.push(await p.from(res.slice(at, at + p.reads.length))); at += p.reads.length; }
  return { ...player, arena: answers[0], iliac: answers[1], gambit: answers[2], renownBest: renownForXp(Number(best?.best ?? 0)) };
}
