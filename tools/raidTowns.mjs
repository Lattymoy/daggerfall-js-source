#!/usr/bin/env node
// RAID-ROLL (2026-09-28, Mac: "Fix it" - the relay held no copy of the day's raid schedule): THE TOWNS TABLE'S HASH,
// the value the relay's RAID_TOWNS_SHA256 pins (server/wrangler.toml).
//
// The relay reads every raid word against the day's own draws with no game data at all (net/raid/raidLaw.js
// raidDaySlots: a raid's start, party and target), and against the day's WHOLE roll - its town, key and pixel too -
// once it holds the towns table. The table is the player's game data (MAPS.BSA's rows and the travel map's region
// picker, TRAV0I01.IMG), so it is never in this repository and never on the relay until a client hands it over; what
// the relay is given is this hash. Run it over your own ARENA2 folder, pin the answer, deploy: the hub then asks every
// hello for the table by that hash and keeps the first one that hashes to it.
//
//   node tools/raidTowns.mjs --arena2 <path to ARENA2>
//
// The game says the same hash once in the browser console ("[raid] this world's towns table: ...") the first time a
// hub asks for it.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MapsFile } from '../src/formats/mapsFile.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { raidRegions } from '../src/systems/raidingParties.js';
import { raidTownsCanon, raidTownsHash, readRaidTowns } from '../src/net/raid/raidLaw.js';
import { isMain } from './lib/isMain.mjs';

/** The towns table of the game files in `arena2`, in its one spelling, and its hash - what the game's own
 *  systems/raidingParties.js raidRegions reads off the same files. */
export async function raidTownsOf(arena2) {
  const file = (name) => {
    const p = join(arena2, name);
    if (!existsSync(p)) throw new Error(`${name} not found in ${arena2}`);
    return new Uint8Array(readFileSync(p));
  };
  const maps = new MapsFile();
  maps.load(file('MAPS.BSA'), file('CLIMATE.PAK'), file('POLITIC.PAK'));
  const picker = new ImgFile();
  picker.load(file('TRAV0I01.IMG'), 'TRAV0I01.IMG');
  const regions = raidRegions(maps, picker.getDFBitmap().data) ?? [];
  const text = raidTownsCanon(regions);
  return { regions, text, hash: await raidTownsHash(text) };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--arena2');
  const dir = at >= 0 ? args[at + 1] : null;
  if (!dir) { console.error('usage: node tools/raidTowns.mjs --arena2 <path to ARENA2>'); process.exit(2); }
  const { regions, text, hash } = await raidTownsOf(dir);
  if (!regions.length || !readRaidTowns(text)) { console.error('no towns table read back - are these the game\'s own files?'); process.exit(1); }
  const towns = regions.reduce((n, g) => n + g.towns.length, 0);
  console.log(`${regions.length} regions, ${towns} towns, ${text.length} bytes`);
  console.log(`RAID_TOWNS_SHA256 = "${hash}"`);
}
