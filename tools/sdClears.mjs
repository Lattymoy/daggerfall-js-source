#!/usr/bin/env node
// SD-CLEARS (2026-10-08, Mac: "The first group clear of the new abyss dungeon is done. Can you pull up all of their
// names?") - WHO BROKE AN ABYSS DUNGEON, READ BY THE OPERATOR. The hub's record keeps only the top fighter's name and how
// many fought (`top`, `n` - bible/11-Multiplayer/Super-Dungeons.md section 2); the names are the account service's, one
// `sd_kills` row a (slot, account) the kill's receipt was claimed for (migration 0090, server-account/src/sds.js). No
// route reads them back by slot, so they are read here, by hand, through .github/workflows/sd-clears.yml. It writes
// nothing.
//
//   node tools/sdClears.mjs --list            every Abyss Dungeon broken: its slot, how many claimed it, the first claim
//   node tools/sdClears.mjs --names [slot]    who broke one: its every claim, oldest first - no slot, the first broken
//
// A row is a REGISTERED account's alone: a guest's receipt is answered `guest` and kept on its device until it
// registers (sds.js claimSd), and an account that is gone takes its rows with it - so the names can be fewer than the
// record's `n`, and grow as late claims land.

import { isMain } from './lib/isMain.mjs';

/** A Hollow's slot (the record's `s`: 1, 2, 3 ...), or throw: digits only, so nothing in it can reach the SQL. */
export function sdSlot(raw) {
  const s = String(raw ?? '').trim();
  const slot = /^[1-9][0-9]{0,8}$/.test(s) ? Number(s) : NaN;
  if (!Number.isSafeInteger(slot)) throw new Error(`not a slot: ${JSON.stringify(raw)} - digits only, 1 or more`);
  return slot;
}

/** Every Abyss Dungeon broken, in the order they rose: its slot, how many claimed it, the first claim's moment. */
export function listSql() {
  return 'SELECT slot, COUNT(*) AS fighters, MIN(at) AS first_at FROM sd_kills GROUP BY slot ORDER BY slot;';
}

/**
 * Who broke one: every claim of that slot - the account's name, how it earned it, the level the fight admitted, what its
 * first write granted, when it was claimed - oldest first. No slot, the lowest any claim names: one Hollow stands at a
 * time, and the slots rise in order, so the lowest broken is the first broken.
 * @param {string|number} [slotRaw]
 */
export function namesSql(slotRaw) {
  const slot = slotRaw == null || String(slotRaw).trim() === '' ? '(SELECT MIN(slot) FROM sd_kills)' : sdSlot(slotRaw);
  return `SELECT k.slot, p.handle AS name, k.earned, k.lv, k.title, k.aura, k.at FROM sd_kills k JOIN players p ON p.id = k.account WHERE k.slot = ${slot} ORDER BY k.at, p.handle_lc;`;
}

function main(argv) {
  if (argv[0] === '--list' && argv.length === 1) return void process.stdout.write(`${listSql()}\n`);
  if (argv[0] === '--names' && argv.length <= 2) return void process.stdout.write(`${namesSql(argv[1])}\n`);
  throw new Error('usage: node tools/sdClears.mjs --list | --names [slot]');
}

if (isMain(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}
