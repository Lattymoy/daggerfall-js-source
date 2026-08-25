#!/usr/bin/env node
// What each song in MIDI.BSA is FOR - and what a music pack still misses.
//
// A replacement file has to be named after the archive record it
// replaces (GDAY___D.ogg), and a pack downloaded from anywhere is named
// after what a human called the track. Nothing can bridge that
// automatically: only a person knows their "Tavern Theme.mp3" is
// TAVERN.HMI. So this does the two halves a machine CAN do.
//
//   node tools/musicNames.mjs                 # the reference table
//   node tools/musicNames.mjs --check <dir>   # what your folder covers
//
// The contexts are read off songManager.js's own playlists rather than
// typed here, so this cannot drift from what the game actually plays.

import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as SM from '../src/systems/songManager.js';
import { replacementEntry, replacementKey } from '../src/systems/musicReplacement.js';

// Playlist export name -> the words a player would use. Only the
// SHAPE is named here; the membership comes from the module.
export const CONTEXT = {
  DUNGEON_SONGS: 'dungeon', SUNNY_SONGS: 'outdoors, clear', CLOUDY_SONGS: 'outdoors, cloudy',
  OVERCAST_SONGS: 'outdoors, overcast/fog', RAIN_SONGS: 'rain', SNOW_SONGS: 'snow',
  SNEAKING_SONGS: 'sneaking', TEMPLE_GOOD_SONGS: 'temple (good)',
  TEMPLE_NEUTRAL_SONGS: 'temple (neutral)', TEMPLE_BAD_SONGS: 'temple (bad)',
  TAVERN_SONGS: 'tavern', NIGHT_SONGS: 'outdoors, night', DAY_SONGS: 'outdoors, day',
  CASTLE_SONGS: 'castle', COURT_SONGS: 'court (arrested)', SHOP_SONGS: 'shop',
  MAGES_GUILD_SONGS: 'mages guild', INTERIOR_SONGS: 'building interior',
  KNIGHT_SONGS: 'knightly order', PALACE_SONGS: 'palace',
};

/**
 * D1-D10 and their FM twins are in MIDI.BSA and in NO playlist, and
 * that is DFU's answer too, not a gap in this port: SongManager.cs:919
 * and :934 declare them as `_unusedDungeonSongs` /
 * `_unusedDungeonSongsFM` - the comment is literally "Unused dungeon
 * music" - and nothing in the DFU tree references either array again.
 * Checked both ways before writing this down.
 *
 * Worth naming rather than letting them fall in with misnamed files: a
 * pack author who supplies D1.ogg would hear nothing and have no way
 * to find out why.
 */
const UNUSED_IN_DFU = new Set(
  Array.from({ length: 10 }, (_, i) => [`D${i + 1}`, `D${i + 1}FM`]).flat(),
);

/**
 * Build the record -> contexts table. PURE, and separated from the CLI
 * for a reason that cost a real false green: this file used to do its
 * work and call process.exit at the top level, so importing it from a
 * test KILLED THE RUNNER after the first test. The suite printed
 * `# tests 1 / # fail 0` and looked perfectly healthy - and neither
 * the manifest guard nor the pass line could ever have caught it,
 * because both count tests in the SOURCE, not tests that ran.
 */
export function songTable() {
  // song record -> { contexts:Set, fm:boolean, gm:boolean }
  const songs = new Map();
  for (const [name, value] of Object.entries(SM)) {
    const m = /^([A-Z_]+_SONGS)(_FM)?$/.exec(name);
    if (!m || !Array.isArray(value)) continue;
    const label = CONTEXT[m[1]];
    // A warning in a tool nobody runs is nothing, so this is fatal: an
    // unlabelled playlist would silently drop its songs out of the table
    // and a pack author would never learn those records exist.
    if (!label) { console.error(`no label for ${m[1]} - add one to CONTEXT`); process.exit(3); }
    for (const song of value) {
      if (!songs.has(song)) songs.set(song, { contexts: new Set(), fm: false, gm: false });
      const e = songs.get(song);
      e.contexts.add(label);
      if (m[2]) e.fm = true; else e.gm = true;
    }
  }

  return [...songs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** The CLI half. Runs only when this file IS the program - never on
 *  import, which is the whole point of the split above. */
function main() {
  const rows = songTable();
  const dirArg = process.argv.indexOf('--check');
  

  if (dirArg < 0) {
    console.log(`${rows.length} songs, from songManager.js's own playlists.`);
    console.log('Name a replacement after the record, e.g. GDAY___D.ogg\n');
    console.log('RECORD        SET  PLAYS FOR');
    for (const [song, e] of rows) {
      const set = e.fm && e.gm ? 'both' : (e.fm ? 'FM' : 'GM');
      console.log(`${replacementKey(song).padEnd(13)} ${set.padEnd(4)} ${[...e.contexts].sort().join(' / ')}`);
    }
    console.log('\nSET: GM is the default; FM is the Adlib set behind Audio/AlternateMusic.');
    console.log('Replace a "both" record and it is heard whichever set is selected.');
    process.exit(0);
  }

  // --check: what does this folder actually cover?
  const dir = process.argv[dirArg + 1];
  if (!dir) { console.error('--check needs a directory'); process.exit(2); }
  const have = new Map();
  for (const f of readdirSync(dir)) {
    const e = replacementEntry(f);
    if (e) have.set(e.key, f);
  }
  const covered = rows.filter(([s]) => have.has(replacementKey(s)));
  const missing = rows.filter(([s]) => !have.has(replacementKey(s)));
  // Files that match NOTHING are the ones worth shouting about - a pack
  // renamed slightly wrong looks identical to a pack that is simply
  // short, and only this tells them apart.
  const known = new Set(rows.map(([s]) => replacementKey(s)));
  const unused = [...have.entries()].filter(([k]) => UNUSED_IN_DFU.has(k));
  const strays = [...have.entries()].filter(([k]) => !known.has(k) && !UNUSED_IN_DFU.has(k));

  console.log(`${dir}: ${covered.length}/${rows.length} songs covered\n`);
  if (missing.length) {
    console.log('STILL PLAYING THE ORIGINAL:');
    for (const [song, e] of missing) {
      console.log(`  ${replacementKey(song).padEnd(13)} ${[...e.contexts].sort().join(' / ')}`);
    }
  }
  if (strays.length) {
    console.log(`\n${strays.length} FILES MATCH NO SONG - misnamed, or not Daggerfall music:`);
    for (const [, f] of strays.slice(0, 20)) console.log(`  ${f}`);
    if (strays.length > 20) console.log(`  ...and ${strays.length - 20} more`);
  }
  if (unused.length) {
    console.log(`\n${unused.length} files replace UNUSED tracks - they will never play:`);
    for (const [, f] of unused) console.log(`  ${f}`);
    console.log('  (SongManager.cs:919/:934 - DFU declares these and uses them nowhere.)');
  }
  if (!missing.length && !strays.length) console.log('every song covered, nothing stray.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
