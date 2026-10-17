#!/usr/bin/env node
// GUILD-GRANT (2026-10-03, Mac: "Can we award the empire of tamriel guild 1.6mil gold") - GOLD INTO A GUILD'S TREASURY,
// AWARDED BY THE OPERATOR. No route mints gold into a treasury, and on purpose: every gold piece in one was carried in
// by a member (GUILD1), and only what realm characters carried in buys a hall or comes back out (AUDIT REALM L1-F3,
// `realm_gold`). So an award is the operator's, written once, by hand, through .github/workflows/guild-grant.yml:
//   1. a dry run reads the guild the name finds - its tag, its members, its treasury and the part of it that buys a
//      hall - and nothing is written;
//   2. the run with apply on writes the award: the treasury AND `realm_gold`, so the gold buys a hall and a realm
//      character can take it out like any other, and the guild's own ledger says who put it there (`grant`, by
//      GRANT_BY - the Guild tab's line, src/ui/socialPanel.js GUILD_LEDGER_WORDS).
//
//   node tools/grantGuildGold.mjs --look <guild name>          the dry run's statement: the guild as it stands
//   node tools/grantGuildGold.mjs --sql <guild name> <gold>    the award's statement, as guild-grant.yml runs it
//
// A guild is found by its name key (guildLaw.js guildNameKey: the case, the spaces and the punctuation aside), the key
// the service holds unique - so "empire of tamriel" typed into the workflow is the Empire of Tamriel, and no other.

import { isMain } from './lib/isMain.mjs';
import { guildNameOf, guildNameKey, GUILD_TREASURY_MAX } from '../src/net/guild/guildLaw.js';

/** Who the guild's ledger says put the gold in - never a registered player's handle (a handle has no space). */
export const GRANT_BY = 'The developers';

/** The name key the service would hold for a guild named `name`, or throw: only a name a guild could be founded with. */
function keyOf(name) {
  const n = guildNameOf(name);
  if (!n) throw new Error(`not a guild name: ${JSON.stringify(name)}`);
  return guildNameKey(n);   // [a-z0-9]+ alone: nothing in it can end an SQL string
}

/** The award: digits only, at least one gold piece, never past the treasury's own cap. */
export function grantGold(raw) {
  const s = String(raw ?? '').trim();
  const gold = /^[1-9][0-9]*$/.test(s) ? Number(s) : NaN;
  if (!Number.isSafeInteger(gold) || gold > GUILD_TREASURY_MAX) throw new Error(`not an award: ${JSON.stringify(raw)} - digits only, 1 to ${GUILD_TREASURY_MAX}`);
  return gold;
}

/** THE DRY RUN: the one guild the name finds, as it stands, and nothing written. */
export function lookSql(name) {
  return `SELECT g.name, g.tag, g.treasury, g.realm_gold, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = g.id) AS members FROM guilds g WHERE g.name_key = '${keyOf(name)}';`;
}

/**
 * THE AWARD: the treasury and the part of it that buys a hall, both, on that one guild - with its mover, its moment and
 * its kind on the row, so the ledger's trigger (0046_guild_halls.sql) writes the line in the same statement. Never past
 * the treasury's cap (the deposit's own bound, guilds.js). RETURNING names the row it changed, so the workflow can
 * refuse a run that changed none.
 * @param {string} name
 * @param {string|number} goldRaw
 */
export function grantSql(name, goldRaw) {
  const key = keyOf(name);
  const gold = grantGold(goldRaw);
  return `UPDATE guilds SET treasury = treasury + ${gold}, realm_gold = realm_gold + ${gold}, moved_by = '${GRANT_BY}', moved_at = CAST(strftime('%s', 'now') AS INTEGER), moved_kind = 'grant' WHERE name_key = '${key}' AND treasury + ${gold} <= ${GUILD_TREASURY_MAX} RETURNING name, tag, treasury, realm_gold;`;
}

function main(argv) {
  if (argv[0] === '--look' && argv.length === 2) return void process.stdout.write(`${lookSql(argv[1])}\n`);
  if (argv[0] === '--sql' && argv.length === 3) return void process.stdout.write(`${grantSql(argv[1], argv[2])}\n`);
  throw new Error('usage: node tools/grantGuildGold.mjs --look <guild name> | --sql <guild name> <gold>');
}

if (isMain(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}
