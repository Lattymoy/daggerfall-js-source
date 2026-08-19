import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  HmiFile,
  MidiBsaFile,
  SONG_SIGNATURE,
  TRACK_SIGNATURE,
} from '../src/formats/hmiFile.js';
import { DIRECTORY_TYPES } from '../src/formats/bsaFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// FNV-1a over the whole emitted stream. Any change to tick, ordering, type,
// channel or payload moves it.
function checksum(song) {
  let h = 2166136261 >>> 0;
  const mix = (x) => {
    h ^= x >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  };
  for (const ev of song.events) {
    mix(ev.tick);
    mix(ev.type.length);
    for (let i = 0; i < ev.type.length; i++) mix(ev.type.charCodeAt(i));
    mix(ev.channel === null ? 255 : ev.channel);
    mix(ev.note || 0);
    mix(ev.velocity || 0);
    mix(ev.duration || 0);
    mix(ev.controller || 0);
    mix(ev.value || 0);
    mix(ev.program || 0);
    mix(ev.track);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

const TRACK_HEADER_SIZE = 176;

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

function buildTrack({ channel, prologueRecords = 1, headerEventCount = 0, stream }) {
  const head = new Uint8Array(TRACK_HEADER_SIZE);
  for (let i = 0; i < TRACK_SIGNATURE.length; i++) head[i] = TRACK_SIGNATURE.charCodeAt(i);
  const v = new DataView(head.buffer);
  v.setUint16(0x61, headerEventCount, true);
  v.setUint32(0x63, TRACK_HEADER_SIZE, true);
  head[0x79] = channel;
  const prologue = new Uint8Array(1 + 6 * prologueRecords);
  prologue[0] = prologueRecords;
  for (let r = 0; r < prologueRecords; r++) {
    prologue.set([0x80, 0x01, 0xc1, 0x00, 0x00, 0x00], 1 + 6 * r);
  }
  return concat(head, prologue, Uint8Array.from(stream));
}

function buildSong(tracks, { division = 480, bpm = 120, signature = SONG_SIGNATURE } = {}) {
  const n = tracks.length;
  const headerSize = 370 + 8 * n;
  const body = concat(...tracks);
  const out = new Uint8Array(headerSize + body.length + 16);
  const v = new DataView(out.buffer);
  for (let i = 0; i < signature.length; i++) out[i] = signature.charCodeAt(i);
  v.setUint16(0xd2, division, true);
  v.setUint16(0xd4, bpm, true);
  v.setUint32(0xe4, n, true);
  v.setUint32(0xe8, 370, true);
  let off = headerSize;
  for (let i = 0; i < n; i++) {
    v.setUint32(370 + 4 * i, off, true);
    off += tracks[i].length;
  }
  out.set(body, headerSize);
  for (let i = 0; i < 5; i++) out[out.length - 16 + i] = '*.mid'.charCodeAt(i);
  return out;
}

// Track 0: every event class the archive uses, plus a zero-duration note.
const TRACK0_STREAM = [
  0x00, 0xb0, 0x69, 0x01, // tick 0   CC ch0 105 = 1
  0x00, 0xfe, 0x14, 0xff, 0xff, // tick 0   HMI 0x14
  0x00, 0xfe, 0x10, 0x80, 0x01, 0x02, 0x68, 0x58, 0x00, 0x00, 0x00, 0x00, // HMI 0x10, len 2
  0x00, 0xc4, 0x58, // tick 0   program change ch4 = 88
  0x00, 0xb4, 0x07, 0x7f, // tick 0   CC ch4 volume = 127
  0x02, 0x94, 0x3c, 0x40, 0x81, 0x00, // tick 2   note on ch4 60 vel 64 dur 128
  0x81, 0x00, 0x3e, 0x41, 0x00, // tick 130 running status, note 62 vel 65 dur 0
  0x10, 0xe4, 0x00, 0x40, // tick 146 pitch bend centre
  0x00, 0xb0, 0x69, 0x00, // tick 146 CC ch0 105 = 0
  0x00, 0xff, 0x2f, 0x00, // tick 146 end of track
];

const TRACK1_STREAM = [
  0x00, 0xb0, 0x69, 0x01,
  0x00, 0xfe, 0x10, 0x80, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, // HMI 0x10, len 0
  0x00, 0x95, 0x40, 0x50, 0x40, // tick 0 note on ch5 64 vel 80 dur 64
  0x00, 0xb0, 0x69, 0x00,
  0x00, 0xff, 0x2f, 0x00,
];

function syntheticSong() {
  return buildSong([
    buildTrack({ channel: 4, headerEventCount: 8, stream: TRACK0_STREAM }),
    buildTrack({ channel: 5, prologueRecords: 2, headerEventCount: 4, stream: TRACK1_STREAM }),
  ]);
}

test('xmi: synthetic HMI song decodes to an ordered event stream', () => {
  const hmi = new HmiFile();
  assert.equal(hmi.load(syntheticSong(), 'SYNTH.HMI'), true);

  assert.equal(hmi.signature, SONG_SIGNATURE);
  assert.equal(hmi.ticksPerQuarterNote, 480);
  assert.equal(hmi.beatsPerMinute, 120);
  assert.equal(hmi.trackCount, 2);
  assert.equal(hmi.sourceName, '*.mid');
  assert.equal(hmi.microsecondsPerQuarterNote, 500000);
  assert.equal(hmi.secondsPerTick, 60 / (120 * 480));
  assert.equal(hmi.tickToSeconds(480), 0.5);

  const t0 = hmi.tracks[0];
  assert.equal(t0.channel, 4);
  assert.equal(t0.dataOffset, TRACK_HEADER_SIZE);
  assert.equal(t0.headerEventCount, 8);
  assert.equal(t0.streamEventCount, 9);
  assert.equal(t0.trailingBytes, 0);
  assert.equal(t0.endTick, 146);
  // Prologue is one count byte plus that many six-byte records; track 1 has two.
  assert.equal(t0.prologue.length, 7);
  assert.equal(hmi.tracks[1].prologue.length, 13);
  assert.equal(hmi.tracks[1].endTick, 64);
  assert.equal(hmi.durationTicks, 146);
  assert.equal(hmi.durationSeconds, 146 * (60 / (120 * 480)));

  // Track 0's own stream, in emitted order.
  assert.deepEqual(
    t0.events.map((e) => [e.tick, e.type, e.channel]),
    [
      [0, 'controller', 0],
      [0, 'hmi', null],
      [0, 'hmi', null],
      [0, 'programChange', 4],
      [0, 'controller', 4],
      [2, 'noteOn', 4],
      // Note-off first at tick 130 so a retrigger is never cut short...
      [130, 'noteOff', 4],
      [130, 'noteOn', 4],
      // ...except a zero-duration note, whose own note-off must follow it.
      [130, 'noteOff', 4],
      [146, 'pitchBend', 4],
      [146, 'controller', 0],
    ],
  );
  assert.deepEqual(t0.events[6], { tick: 130, type: 'noteOff', channel: 4, note: 60, velocity: 0, track: 0 });
  assert.deepEqual(t0.events[7], {
    tick: 130, type: 'noteOn', channel: 4, note: 62, velocity: 65, duration: 0, track: 0,
  });
  assert.deepEqual(t0.events[8], { tick: 130, type: 'noteOff', channel: 4, note: 62, velocity: 0, track: 0 });
  assert.deepEqual(t0.events[5], {
    tick: 2, type: 'noteOn', channel: 4, note: 60, velocity: 64, duration: 128, track: 0,
  });
  assert.deepEqual(t0.events[3], { tick: 0, type: 'programChange', channel: 4, program: 88, track: 0 });
  assert.deepEqual(t0.events[9], { tick: 146, type: 'pitchBend', channel: 4, value: 8192, track: 0 });
  assert.deepEqual(t0.events[0], {
    tick: 0, type: 'controller', channel: 0, controller: 105, value: 1, track: 0,
  });
  // HMI events keep their raw payload and no channel.
  assert.equal(t0.events[1].subtype, 0x14);
  assert.deepEqual(Array.from(t0.events[1].data), [0xff, 0xff]);
  assert.equal(t0.events[2].subtype, 0x10);
  assert.deepEqual(Array.from(t0.events[2].data), [0x80, 0x01, 0x02, 0x68, 0x58, 0, 0, 0, 0]);

  // Merged stream is tick-ordered across tracks and carries the track index.
  for (let i = 1; i < hmi.events.length; i++) {
    assert.ok(hmi.events[i].tick >= hmi.events[i - 1].tick, `merged order at ${i}`);
  }
  assert.equal(hmi.events.length, t0.events.length + hmi.tracks[1].events.length);
  assert.equal(hmi.events.filter((e) => e.type === 'noteOn').length, 3);
  assert.equal(hmi.events.filter((e) => e.type === 'noteOff').length, 3);
  // Sort keys never leak into the emitted events.
  assert.equal('_rank' in hmi.events[0], false);
  assert.equal('_seq' in hmi.events[0], false);
});

test('xmi: non-HMI bytes are rejected, undecodable HMI bytes throw', () => {
  const hmi = new HmiFile();
  assert.equal(hmi.load(new Uint8Array(4096)), false);
  assert.equal(hmi.load(new Uint8Array(8)), false);
  assert.equal(hmi.load(buildSong([buildTrack({ channel: 0, stream: TRACK1_STREAM })], {
    signature: 'HMI-MIDISONG000000',
  })), false);
  assert.throws(() => hmi.load(new ArrayBuffer(8)), TypeError);

  // An HMI private event this reader has never seen must fail loudly rather
  // than resynchronise onto garbage.
  const unknownFe = buildSong([buildTrack({
    channel: 0,
    stream: [0x00, 0xfe, 0x77, 0x00, 0x00, 0x00, 0xff, 0x2f, 0x00],
  })]);
  assert.throws(() => new HmiFile().load(unknownFe, 'BAD.HMI'), /unknown HMI event 0xFE 0x77/);

  // A data byte with bit 7 set means the stream is misaligned.
  const badData = buildSong([buildTrack({
    channel: 0,
    stream: [0x00, 0xb0, 0x07, 0xff, 0x00, 0xff, 0x2f, 0x00],
  })]);
  assert.throws(() => new HmiFile().load(badData, 'BAD.HMI'), /has bit 7 set/);

  // Running status with nothing to run.
  const noStatus = buildSong([buildTrack({ channel: 0, stream: [0x00, 0x40, 0x40] })]);
  assert.throws(() => new HmiFile().load(noStatus, 'BAD.HMI'), /running status with no status/);

  // No end-of-track meta at all.
  const noEnd = buildSong([buildTrack({ channel: 0, stream: [0x00, 0xb0, 0x07, 0x7f] })]);
  assert.throws(() => new HmiFile().load(noEnd, 'BAD.HMI'), /ran past its data|ended without end-of-track/);

  // Over-long variable-length quantity.
  const badVlq = buildSong([buildTrack({
    channel: 0,
    stream: [0x80, 0x80, 0x80, 0x80, 0x80, 0x00, 0xff, 0x2f, 0x00],
  })]);
  assert.throws(() => new HmiFile().load(badVlq, 'BAD.HMI'), /over-long variable-length quantity/);

  // A song header that claims no tracks.
  const noTracks = buildSong([buildTrack({ channel: 0, stream: TRACK1_STREAM })]);
  new DataView(noTracks.buffer).setUint32(0xe4, 0, true);
  assert.throws(() => new HmiFile().load(noTracks, 'BAD.HMI'), /no tracks/);
});

test('xmi: MIDI.BSA wrapper enumerates and caches songs', () => {
  const song = syntheticSong();
  const name = 'SYNTH.HMI';
  const bsa = new Uint8Array(4 + song.length + 18);
  const v = new DataView(bsa.buffer);
  v.setInt16(0, 1, true);
  v.setUint16(2, DIRECTORY_TYPES.NameRecord, true);
  bsa.set(song, 4);
  for (let i = 0; i < name.length; i++) bsa[4 + song.length + i] = name.charCodeAt(i);
  v.setInt32(4 + song.length + 14, song.length, true);

  const m = new MidiBsaFile();
  assert.equal(MidiBsaFile.filename, 'MIDI.BSA');
  assert.equal(m.count, 0);
  assert.equal(m.load(bsa), true);
  assert.equal(m.count, 1);
  assert.equal(m.getSongName(0), name);
  assert.equal(m.getSongIndex(name), 0);
  assert.equal(m.getSongIndex('NOPE.HMI'), -1);
  assert.equal(m.getSongBytes(0).length, song.length);
  assert.equal(m.isValidIndex(0), true);
  assert.equal(m.isValidIndex(1), false);
  assert.equal(m.getSong(-1), null);
  assert.equal(m.getSong(1), null);
  const decoded = m.getSong(0);
  assert.equal(decoded.name, name);
  assert.equal(decoded.trackCount, 2);
  assert.equal(m.getSong(0), decoded, 'songs are cached');
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

function realArchive() {
  const m = new MidiBsaFile();
  assert.equal(m.load(new Uint8Array(readFileSync(join(ARENA2, MidiBsaFile.filename)))), true);
  return m;
}

test('xmi: MIDI.BSA container holds 131 named HMI songs', { skip: skipReal }, () => {
  const m = realArchive();
  assert.equal(m.bsaFile.directoryType, DIRECTORY_TYPES.NameRecord);
  assert.equal(m.count, 131);

  const names = [];
  for (let i = 0; i < m.count; i++) names.push(m.getSongName(i));
  assert.equal(new Set(names).size, 131);
  assert.equal(names.every((n) => n.endsWith('.HMI')), true);
  // Record order is the archive's, not alphabetical.
  assert.deepEqual(names.slice(0, 5), ['D1.HMI', 'DUNGEON6.HMI', 'DUNGEON7.HMI', '02.HMI', 'FOLK1.HMI']);
  assert.deepEqual(names.slice(-3), ['GDAY___D.HMI', 'GSHOP.HMI', 'MAGIC_2.HMI']);
  assert.equal(m.getSongIndex('DUNGEON.HMI'), 55);
  assert.equal(m.getSongBytes(55).length, 34678);
  // Every record is an HMI song, not IFF XMI: no FORM/XDIR/CAT chunk anywhere.
  for (let i = 0; i < m.count; i++) {
    const bytes = m.getSongBytes(i);
    assert.equal(String.fromCharCode(...bytes.slice(0, 18)), SONG_SIGNATURE, names[i]);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)) === 'FORM', false, names[i]);
  }
});

test('xmi: every song in the real archive decodes', { skip: skipReal }, () => {
  const m = realArchive();

  let tracks = 0;
  let events = 0;
  const byType = new Map();
  const hmiSubtypes = new Map();
  const channels = new Set();
  let zeroDurationNotes = 0;
  let prologueRecords = 0;

  for (let i = 0; i < m.count; i++) {
    const song = m.getSong(i);
    // One tempo per song, no tempo meta anywhere in the archive.
    assert.equal(song.ticksPerQuarterNote, 480, song.name);
    assert.equal(song.beatsPerMinute, 120, song.name);
    assert.equal(song.sourceName.length > 0, true, song.name);
    tracks += song.trackCount;
    events += song.events.length;

    for (const t of song.tracks) {
      // The decode lands byte-exactly on each track's end-of-track meta - the
      // proof that the FE event sizes and the prologue shape are right.
      assert.equal(t.trailingBytes, 0, `${song.name} track ${t.index}`);
      assert.equal(t.header.length, t.dataOffset);
      assert.ok(t.dataOffset >= 174 && t.dataOffset <= 180, `${song.name} dataOffset`);
      prologueRecords += t.prologue[0];
      // Every track opens with CC105=1 and carries exactly one more CC105=0.
      const marks = t.events.filter((e) => e.type === 'controller' && e.controller === 105);
      assert.equal(marks.length, 2, `${song.name} track ${t.index}`);
      assert.deepEqual(marks.map((e) => [e.channel, e.value]), [[0, 1], [0, 0]]);
      assert.equal(t.events[0], marks[0]);
    }

    for (const ev of song.events) {
      byType.set(ev.type, (byType.get(ev.type) || 0) + 1);
      if (ev.channel !== null) channels.add(ev.channel);
      if (ev.type === 'hmi') hmiSubtypes.set(ev.subtype, (hmiSubtypes.get(ev.subtype) || 0) + 1);
      if (ev.type === 'noteOn' && ev.duration === 0) zeroDurationNotes++;
    }
    for (let k = 1; k < song.events.length; k++) {
      assert.ok(song.events[k].tick >= song.events[k - 1].tick, `${song.name} merged order`);
    }
  }

  assert.equal(tracks, 1286);
  assert.equal(events, 354655);
  // Every note-on duration is resolved into exactly one note-off.
  assert.equal(byType.get('noteOn'), 104827);
  assert.equal(byType.get('noteOff'), 104827);
  assert.equal(byType.get('controller'), 122060);
  assert.equal(byType.get('pitchBend'), 20532);
  assert.equal(byType.get('programChange'), 855);
  assert.equal(byType.get('hmi'), 1554);
  // The archive uses nothing else: no note-off, no aftertouch, no sysex, and
  // the only meta event is end-of-track, which the reader consumes.
  assert.deepEqual(
    [...byType.keys()].sort(),
    ['controller', 'hmi', 'noteOff', 'noteOn', 'pitchBend', 'programChange'],
  );
  assert.deepEqual([...channels].sort((a, b) => a - b), [...Array(16).keys()]);
  assert.deepEqual([...hmiSubtypes].sort((a, b) => a[0] - b[0]),
    [[0x10, 1290], [0x12, 1], [0x13, 1], [0x14, 132], [0x15, 130]]);
  assert.equal(zeroDurationNotes, 37);
  // 1282 tracks carry one prologue record, 4 carry two.
  assert.equal(prologueRecords, 1286 + 4);
});

test('xmi: named songs pinned by shape and stream checksum', { skip: skipReal }, () => {
  const m = realArchive();
  const pins = {
    'D1.HMI': { tracks: 4, events: 6064, durationTicks: 26926, sum: 3296487299 },
    '02.HMI': { tracks: 6, events: 1099, durationTicks: 10483, sum: 2318344463 },
    'DUNGEON.HMI': { tracks: 20, events: 11099, durationTicks: 26675, sum: 4079693625 },
    'FOLK3.HMI': { tracks: 3, events: 503, durationTicks: 4231, sum: 102046012 },
    'TAVERN.HMI': { tracks: 23, events: 1309, durationTicks: 25717, sum: 3457131586 },
    'SUNNYDAY.HMI': { tracks: 10, events: 2486, durationTicks: 1199310, sum: 4046892480 },
  };
  for (const [name, pin] of Object.entries(pins)) {
    const song = m.getSong(m.getSongIndex(name));
    assert.equal(song.trackCount, pin.tracks, name);
    assert.equal(song.events.length, pin.events, name);
    assert.equal(song.durationTicks, pin.durationTicks, name);
    assert.equal(checksum(song), pin.sum, name);
  }

  const d1 = m.getSong(m.getSongIndex('D1.HMI'));
  assert.deepEqual(d1.tracks.map((t) => t.channel), [4, 5, 6, 9]);
  assert.deepEqual(d1.tracks.map((t) => t.byteLength), [721, 2758, 8141, 7316]);
  assert.deepEqual(d1.tracks.map((t) => t.streamEventCount), [109, 779, 2430, 2292]);
  assert.equal(d1.durationSeconds.toFixed(3), '28.048');
  assert.deepEqual(d1.events[3], { tick: 0, type: 'programChange', channel: 4, program: 88, track: 0 });
  const firstNote = d1.events.find((e) => e.type === 'noteOn');
  assert.deepEqual(firstNote, {
    tick: 2, type: 'noteOn', channel: 4, note: 0x2b, velocity: 0x53, duration: 347, track: 0,
  });
});

test('xmi: real-archive quirks stay pinned', { skip: skipReal }, () => {
  const m = realArchive();

  // SUNNYDAY track 5 carries a 1,192,560-tick delta before its last two events.
  // Every other track in the song ends at 6802. Real bytes, and the track still
  // lands exactly on its end-of-track meta.
  const sunny = m.getSong(m.getSongIndex('SUNNYDAY.HMI'));
  assert.deepEqual(sunny.tracks.map((t) => t.endTick),
    [6802, 6802, 6802, 6802, 6802, 1199310, 6802, 6802, 6802, 6802]);
  assert.equal(sunny.tracks[5].trailingBytes, 0);
  assert.equal(Math.round(sunny.durationSeconds), 1249);

  // TAVERN track 22 is the only track whose header event count disagrees with
  // the stream, and the only one carrying 0xFE 0x12 / 0xFE 0x13.
  let disagree = 0;
  for (let i = 0; i < m.count; i++) {
    for (const t of m.getSong(i).tracks) {
      if (t.headerEventCount !== t.streamEventCount - 1) disagree++;
    }
  }
  assert.equal(disagree, 1);
  const tavern = m.getSong(m.getSongIndex('TAVERN.HMI'));
  assert.equal(tavern.tracks[22].headerEventCount, 8);
  assert.equal(tavern.tracks[22].streamEventCount, 11);
  assert.deepEqual(
    tavern.tracks[22].events.filter((e) => e.type === 'hmi').map((e) => e.subtype),
    [0x10, 0x12, 0x10, 0x13],
  );

  // The FM variants are the same songs with different tail bytes, not copies.
  const a = m.getSongBytes(m.getSongIndex('02.HMI'));
  const b = m.getSongBytes(m.getSongIndex('02FM.HMI'));
  assert.equal(a.length, b.length);
  let differing = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differing++;
  assert.equal(differing, 18);
});

// ---------------------------------------------------------------------------
// AUDIT 19 F1: THE SECOND INVARIANT, and an honest account of the first.
//
// The byte-exact gate was described as proving the 0xFE event sizes. It does
// not. Sweeping the sizes and re-decoding the whole archive shows 0x14 = 1 or
// 2 ALSO lands all 1286 tracks byte-exactly - while blowing D1.HMI from 26,926
// to 2,123,950 ticks. What actually separates them is that the tracks of a
// song are meant to END TOGETHER: at 0x14 = 3, 123 of 131 songs have every
// track finishing on the same tick; at 1 or 2 that collapses to 4 of 131.
//
// So the reader is pinned on BOTH invariants, and this one is the discriminating
// one. Without it, a wrong size passes every other pin in this file.
// ---------------------------------------------------------------------------

test('hmi: the tracks of a song END TOGETHER - the discriminating invariant', { skip: skipReal }, () => {
  const bsa = new MidiBsaFile();
  bsa.load(new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA'))));

  let together = 0;
  const stragglers = [];
  for (let i = 0; i < 131; i++) {
    const song = bsa.getSong(i);
    const ends = new Set(song.tracks.map((t) => t.endTick));
    if (ends.size === 1) together++;
    else stragglers.push(`${bsa.getSongName(i)} (${ends.size} distinct end ticks)`);
  }

  // 123/131 with the decoded sizes. A wrong 0x14 size drops this to 4, so the
  // bound is what makes the pin discriminate - it is not a round number for
  // its own sake, it is the measured value with a wide margin below it.
  assert.ok(together >= 120,
    `only ${together}/131 songs have all tracks ending together - the 0xFE sizes are wrong.\n`
    + stragglers.slice(0, 6).join('\n'));
  assert.equal(together, 123, 'the measured value, so a drift in either direction is visible');

  // And the eight that genuinely differ are the corpus quirk, not a misparse:
  // each still lands byte-exactly on its end-of-track (the gate above).
  assert.equal(stragglers.length, 8);
});

test('hmi: an unknown status byte THROWS rather than becoming a pitch bend', () => {
  // AUDIT 19 F3: pitch bend used to be the switch's DEFAULT arm, so every
  // undefined status - 0xF1..0xF6, 0xF8..0xFD - decoded as a bend on a phantom
  // channel taken from its low nibble. That contradicted this reader's central
  // promise. 0xE0 is explicit now and the default fails loudly.
  const src = readFileSync('src/formats/hmiFile.js', 'utf8');
  assert.match(src, /case 0xe0: \{/, 'pitch bend is an EXPLICIT case, not the default');
  const dflt = src.slice(src.indexOf('        default:'), src.indexOf('        default:') + 600);
  assert.match(dflt, /_fail\(/, 'the default arm throws');
  assert.ok(!/pitchBend/.test(dflt), 'and it does not invent a pitch bend');
});
