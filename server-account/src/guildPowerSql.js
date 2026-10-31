// @ts-check
// GUILD-RANKS (2026-10-30, the owner: "More guild ranks plus rank permission edits"; bible/11-Multiplayer/Guild-Shop.md
// section 13): A STATEMENT'S OWN CHECK OF A GUILD'S POWERS. A write that guards on a rank reads the guild's `powers` row in
// the same statement, so a power taken away between the read and the write moves nothing. No imports but the law, so a
// module's top-level SQL (decor.js OWNS) may read it whatever loads first.
import { guildPowerRanks } from '../../src/net/guild/guildLaw.js';

/** Whether `rankExpr` holds `power` in the guild `guildExpr`, as SQL: a guildmaster always; a power the guild never set,
 *  the law's default list. Both expressions qualified - json_each has an `id` column of its own. */
export function guildPowerSql(/** @type {string} */ power, /** @type {string} */ rankExpr, /** @type {string} */ guildExpr) {
  const def = JSON.stringify(guildPowerRanks(power));
  return `(${rankExpr} = 0 OR EXISTS (SELECT 1 FROM guilds pg, json_each(COALESCE(json_extract(pg.powers, '$.${power}'), '${def}')) pj
    WHERE pg.id = ${guildExpr} AND pj.value = ${rankExpr}))`;
}
