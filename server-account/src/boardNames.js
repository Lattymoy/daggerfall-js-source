// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT CARDS-6 D3 (2026-10-09) - A SEASON BOARD'S NAMES, EVERY HONOUR ON THEM.
//
// The arena's board (arena.js arenaBoardOf) and Iliac Hand's (iliac.js
// iliacBoardOf) each badged their rows with their OWN honours alone - the
// row titles.js reads carried `arena` on the one and `iliac` on the other -
// so the Iliac Champion's row on the arena's board wore no title, and the
// arena's #1 on Iliac Hand's wore neither its title nor its laurel, where
// the token, a letter and a notice wear them all (letters.js, board.js).
//
// ONE DOOR FOR BOTH BOARDS. A board lays the honours it counted itself with
// the board it answers (`own` - its #1 off its own rows, as fresh as the
// board); the others are read as a letter's sender's are (arena.js
// withArenaHonoursAll, iliac.js withIliacHonoursAll - the Worker's kept
// words, never a count).
//
// Not a DFU member: Daggerfall Unity has no accounts.
// ═══════════════════════════════════════════════════════════════════
import { displayName } from './accounts.js';
import { titleWorn, glyphsOf } from './titles.js';
import { withArenaHonoursAll } from './arena.js';
import { withIliacHonoursAll } from './iliac.js';

/**
 * Players by id, each with the badge they wear now: `{ name, title, glyphs }` (titles.js). `own` names the honours the
 * board counted itself - `{ arena: (row) => ({ grand, champion }) }`, `{ iliac: (row) => ({ champion }) }` - laid over
 * the rest, which are read as a letter's are.
 * @param {{ db: any }} ctx @param {string[]} ids @param {any} env @param {number} nowS
 * @param {{ arena?: (row: any) => any, iliac?: (row: any) => any }} own
 */
export async function boardNamesOf(ctx, ids, env, nowS, own) {
  const want = [...new Set(ids.filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < want.length; i += 50) {
    const part = want.slice(i, i + 50);
    let rows = (await ctx.db.prepare(`SELECT * FROM players WHERE id IN (${part.map((_, k) => `?${k + 1}`).join(', ')})`).bind(...part).all()).results ?? [];
    if (!own.arena) rows = await withArenaHonoursAll(ctx, rows, nowS);
    if (!own.iliac) rows = await withIliacHonoursAll(ctx, rows, nowS);
    for (const row of rows) {
      const withH = { ...row, ...(own.arena ? { arena: own.arena(row) } : {}), ...(own.iliac ? { iliac: own.iliac(row) } : {}) };
      out.set(row.id, { name: displayName(row), title: titleWorn(withH, env) ?? null, glyphs: glyphsOf(withH, env, nowS) });
    }
  }
  return out;
}
