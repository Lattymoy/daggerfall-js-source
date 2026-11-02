// @ts-check
// SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE BANNER RIBBON (bible/
// 11-Multiplayer/Seats-Arc.md 9.1) - a thin band in the guild's colours under the name tag of every member of a guild
// that kept a seat a whole Season, worn through the next Season. Written at the Turning that ends a Season
// (seatTurning.js settleWeek, `town_seat_ribbons`); read here at the token's mint, the named character's alone.
import { ribbonSeasonOf } from '../../src/net/townSeatLaw.js';
import { ribbonClaimOf } from '../../src/net/heraldryLaw.js';

/**
 * The ribbon the named `character` wears in `season` (townSeatLaw.js seasonOf's, or null): its guild's colours as the
 * token's claim (heraldryLaw.js ribbonClaimOf) where that guild kept a seat through the Season before and the character
 * was its member at that Season's last Turning - else null. DECIDED: a member who joined after that Turning wears none;
 * the colours are the guild's as they are now (a banner changed is a ribbon changed).
 * @param {any} db
 */
export async function ribbonOf(db, playerId, character, season, member = undefined) {
  const n = ribbonSeasonOf(season);
  if (n == null || typeof character !== 'string') return null;
  // SCALE4f part two: the mint's one membership read (guilds.js mintMemberOf) - its guild's ribbon of the Season, earned
  // while it was a member (the join's own `m.joined_at <= r.at`), in the guild's colours as they are now
  const r =
    member !== undefined
      ? member &&
        member.gid != null &&
        (await db
          .prepare('SELECT 1 FROM town_seat_ribbons WHERE guild_id = ? AND season = ? AND at >= ? LIMIT 1')
          .bind(member.guild_id, n, member.joined_at)
          .first())
        ? { heraldry: member.heraldry }
        : null
      : await db
          .prepare(
            `SELECT g.heraldry AS heraldry FROM town_seat_ribbons r
    JOIN guild_members m ON m.guild_id = r.guild_id AND m.player = ? AND m.char_id = ? AND m.joined_at <= r.at
    JOIN guilds g ON g.id = r.guild_id WHERE r.season = ?`,
          )
          .bind(playerId, character, n)
          .first();
  if (!r) return null;
  let h = null;
  try {
    h = r.heraldry ? JSON.parse(r.heraldry) : null;
  } catch {
    h = null;
  }
  return ribbonClaimOf(h);
}
