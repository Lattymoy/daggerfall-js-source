#!/usr/bin/env node
// Dump ARENA2/MIDI.BSA to standard .mid files.
//
// WHY THIS EXISTS: the archive does NOT hold .mid. It holds HMI Sound
// Operating System songs ("HMI-MIDISONG061595") - see formats/hmiFile.js's
// header for how that was established - so pulling the BSA records out
// raw gives you 131 files no synth, DAW or MIDI tool will open. This
// walks them through the repo's own HMI decoder and writes real Standard
// MIDI Files on the other side.
//
// It reads YOUR copy of the game data and writes to a directory you name.
// Nothing is bundled with it.
//
//   ARENA2_PATH=/path/to/ARENA2 node tools/dumpMidi.mjs [outDir]
//
// Default outDir is ./midi-out.
//
// The output is SMF type 0: hmiFile merges every HMI track into ONE
// ordered event stream (that is what its `events` array is), so writing
// a single track is the honest shape rather than an invented split.
// Division is the song's own ticksPerQuarterNote and the tempo meta is
// built from its beatsPerMinute - both read per song, though every
// retail song ships 480/120.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MidiBsaFile, HmiFile } from '../src/formats/hmiFile.js';

const arena2 = process.env.ARENA2_PATH;
if (!arena2) {
  console.error('set ARENA2_PATH to your ARENA2 directory, e.g.');
  console.error('  ARENA2_PATH=~/Daggerfall/ARENA2 node tools/dumpMidi.mjs');
  process.exit(2);
}
const outDir = process.argv[2] ?? 'midi-out';
mkdirSync(outDir, { recursive: true });

const archive = new MidiBsaFile();
if (!archive.load(new Uint8Array(readFileSync(join(arena2, 'MIDI.BSA'))))) {
  console.error(`could not read ${join(arena2, 'MIDI.BSA')} as a name-record BSA`);
  process.exit(1);
}

// ---- Standard MIDI File primitives ----------------------------------

/** SMF variable-length quantity: 7 bits per byte, high bit = "more". */
const vlq = (n) => {
  const out = [n & 0x7f];
  let v = n >>> 7;
  while (v > 0) { out.unshift((v & 0x7f) | 0x80); v >>>= 7; }
  return out;
};

const chunk = (tag, body) => {
  const head = [...tag].map((c) => c.charCodeAt(0));
  const len = body.length;
  return [...head, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...body];
};

/** One decoded HMI event to its MIDI wire bytes, or null to skip it. */
function eventBytes(e) {
  switch (e.type) {
    case 'noteOff':        return [0x80 | e.channel, e.note & 0x7f, e.velocity & 0x7f];
    case 'noteOn':         return [0x90 | e.channel, e.note & 0x7f, e.velocity & 0x7f];
    case 'polyPressure':   return [0xa0 | e.channel, e.note & 0x7f, e.pressure & 0x7f];
    case 'controller':     return [0xb0 | e.channel, e.controller & 0x7f, e.value & 0x7f];
    case 'programChange':  return [0xc0 | e.channel, e.program & 0x7f];
    case 'channelPressure':return [0xd0 | e.channel, e.pressure & 0x7f];
    case 'pitchBend':      return [0xe0 | e.channel, e.value & 0x7f, (e.value >> 7) & 0x7f];
    case 'sysEx':          return [e.status, ...vlq(e.data.length), ...e.data];
    case 'meta':
      // End-of-track is written by us, once, at the real end - a song's
      // own 0x2F mid-stream would truncate everything after it.
      if (e.metaType === 0x2f) return null;
      return [0xff, e.metaType & 0xff, ...vlq(e.data.length), ...e.data];
    default:               return null;
  }
}

function toSmf(hmi) {
  const division = hmi.ticksPerQuarterNote;   // the HMI clock (60), never the header's 480
  const bpm = hmi.beatsPerMinute || 120;
  const usPerQuarter = Math.round(60000000 / bpm);

  const track = [
    // tempo, at tick 0, before anything else
    0x00, 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff,
  ];

  let last = 0;
  for (const e of hmi.events) {
    const bytes = eventBytes(e);
    if (!bytes) continue;
    track.push(...vlq(Math.max(0, e.tick - last)), ...bytes);
    last = e.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);   // end of track

  const header = [0x00, 0x00, 0x00, 0x01, (division >> 8) & 0xff, division & 0xff];
  return Uint8Array.from([...chunk('MThd', header), ...chunk('MTrk', track)]);
}

// ---- walk the archive ------------------------------------------------

let written = 0;
const skipped = [];
for (let i = 0; i < archive.count; i++) {
  const name = archive.getSongName(i);
  const hmi = new HmiFile();
  let ok = false;
  try {
    ok = hmi.load(archive.getSongBytes(i), name);
  } catch (err) {
    skipped.push(`${name}: ${err.message}`);
    continue;
  }
  if (!ok) { skipped.push(`${name}: not an HMI song`); continue; }

  const out = join(outDir, `${name.replace(/\.HMI$/i, '')}.mid`);
  writeFileSync(out, toSmf(hmi));
  written++;
  console.log(`${name}  ->  ${out}  (${hmi.trackCount} tracks, ${hmi.events.length} events, ${hmi.beatsPerMinute}bpm)`);
}

console.log(`\n${written}/${archive.count} songs written to ${outDir}/`);
// NO SILENT CAPS: anything the decoder refused is named, not swallowed.
if (skipped.length) {
  console.log(`${skipped.length} skipped:`);
  for (const s of skipped) console.log(`  ${s}`);
}
