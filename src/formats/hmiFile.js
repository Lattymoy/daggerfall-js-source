// MIDI.BSA song reader: enumerates Daggerfall's music archive and decodes each
// song into a neutral, ordered MIDI event stream.
//
// NO DAGGERFALL UNITY SOURCE EXISTS FOR THIS FILE. DFU never reads MIDI.BSA:
// Internal/DaggerfallSongPlayer.cs loads 133 pre-converted .mid files plus a
// SoundFont from Unity Resources and renders them with its vendored
// AudioSynthesis synth; SongFiles.cs is only an enum and
// Game/Questing/Actions/PlaySong.cs only a quest action. So this reader is a
// DEPARTURE in the Port-Ledger sense - it was written against the shipped bytes
// of the user's own ARENA2/MIDI.BSA, not translated from C#. Every structural
// claim below was established by parsing all 131 songs / 1286 tracks in the
// retail archive and is pinned in test/hmi.test.js.
//
// NAMING: this slice was commissioned as "the XMI reader" and the bytes said
// otherwise, so the file is hmiFile.js - the format it actually reads. The
// wrong name would have misled every future reader of this directory, and the
// Ledger records the correction rather than burying it in a comment.
// Daggerfall's MIDI.BSA does NOT hold IFF XMI
// (no FORM/XDIR/CAT/XMID chunk appears anywhere in the archive); it holds HMI
// Sound Operating System songs, signature "HMI-MIDISONG061595". HMI and XMI
// share exactly one trait - note-on carries an explicit duration instead of a
// matching note-off - and differ everywhere else: HMI delta times are ordinary
// MIDI variable-length quantities, NOT XMI's interval-count encoding.
//
// CONTAINER
//   MIDI.BSA is a standard NameRecord BSA (see bsaFile.js), 131 records, each
//   record one *.HMI song. No second container reader is introduced here.
//
// SONG (HMI-MIDISONG061595)
//   0x000  18   signature "HMI-MIDISONG061595"
//   0x0D2  u16  header resolution            (480 in every retail song - NOT
//               the time base; see THE CLOCK below)
//   0x0D4  u16  beats per minute            (120 in every retail song)
//   0x0D6  u32  = trackTableOffset + 8*trackCount (end of the second table)
//   0x0E4  u32  track count                 (1..41 across the archive)
//   0x0E8  u32  track table offset          (370 = 0x172 in every retail song)
//   0x0F4  u32  = trackTableOffset + 4*trackCount (end of the track table)
//   0x172  u32[trackCount]  absolute byte offset of each track
//          u32[trackCount]  second table, all zero in every retail song
//   The trailing 16 bytes of the file are a NUL-padded source-file name, almost
//   always "*.mid" but sometimes the real one ("dungeon8", "fmover_c").
//
// TRACK (HMI-MIDITRACK)
//   +0x00  13   signature "HMI-MIDITRACK"
//   +0x61  u16  stream event count minus one, i.e. every event before the
//               end-of-track meta except the last (1285/1286 retail tracks;
//               TAVERN.HMI track 22 says 8 where the stream holds 11)
//   +0x63  u32  offset of the event stream from the track start (174..180)
//   +0x79  u8   MIDI channel this track plays on
//   ...    the rest of the 174..180 byte header is not decoded here; it is
//          exposed verbatim as track.header for a later slice.
//
// EVENT STREAM
//   <prologue> then repeating <VLQ delta><event> until meta 0x2F end-of-track.
//   Prologue: one count byte N (1 or 2) followed by N six-byte records of the
//   shape "80 01 <xx> 00 00 00". Undecoded - HMI patch/device setup, most
//   likely - and exposed verbatim as track.prologue. The same six-byte record
//   is the payload of the 0xFE 0x15 event, which is how its size was fixed.
//   Events are ordinary MIDI with running status, plus two deviations:
//     0x9n note on  - note, velocity, then a VLQ DURATION in ticks. There is no
//                     note-off in the data; the whole archive contains zero
//                     0x8n events and zero zero-velocity note-ons.
//     0xFE ...      - HMI private events, sizes established from the corpus:
//                       FE 10 <2><len><len bytes><4>   channel setup, 1 per track
//                       FE 12 / FE 13 / FE 14 <2>      3 bytes total
//                       FE 15 <6>                      7 bytes total
//   Meta events are 0xFF <type> <VLQ len> <data>; the only type in the archive
//   is 0x2F (end of track). There is NO tempo meta - tempo lives in the song
//   header, so a song has exactly one tempo for its whole length.
//
// THE CLOCK (2026-08-27, Mac: "music continuously loops with short tracks")
//   This reader first took the u16 at 0x0D2 (480) for ticks-per-quarter and
//   the u16 at 0x0D4 (120) for BPM, giving 1/960 s per tick - and every song
//   played EIGHT TIMES too fast: DUNGEON.HMI in 28 seconds, D1 in 28, then
//   looped. The HMI driver's tick is 1/BPM of a second - SIXTY ticks per
//   quarter at the header's BPM - and the 480 is the header's resolution
//   field, not the sequencer's rate. Two independent readers agree:
//   WildMIDI's f_hmi.c (bpm from byte 212, division fixed at 60) and
//   foo_midi's midi_processor_hmi.cpp (192 ppqn at 1,605,632 us, the same
//   8.36 ms/tick), and DFU's own shipped conversions were made with the
//   latter: dungeon.mid is 223 s at 192 ppqn / 1,605,566 us, i.e. this
//   archive's 26,675 ticks at 8.36 ms each - not 28 s. So secondsPerTick is
//   1/BPM, the header resolution is kept as the field it is, and the
//   corpus pins that said 28.048 s now say 224.383 s.
//   Only 0x9n, 0xBn, 0xCn and 0xEn channel events occur; no sysex, no aftertouch.
//
// Anything outside this vocabulary throws. A reader that decodes most of an
// archive and says so is worth more than one that silently emits garbage.
//
// HOW STRONG THE EVIDENCE ACTUALLY IS (AUDIT 19 F1 - this used to overstate it)
//   The byte-exact gate - every one of the 1286 tracks consuming to its
//   end-of-track meta exactly at the next track's offset - was described here
//   and in the manifest as proving all the 0xFE sizes. It does not. Measured,
//   by sweeping the sizes and re-decoding the whole archive:
//
//     0x15 = 7        DETERMINED by the gate. Size 6 makes 130 of 131 songs
//                     throw, so this one really is pinned by byte alignment.
//     0x10 = 8 + len  DETERMINED likewise (its length byte is self-checking).
//     0x14 = 3        NOT determined by the gate: sizes 1 and 2 also land all
//                     1286 tracks byte-exactly. What separates them is a
//                     SECOND, stronger invariant - with size 3, 123 of 131
//                     songs have every track ending on the same tick; with 1
//                     or 2 that collapses to 4 of 131. Tracks of one song are
//                     meant to end together, so 3 is the reading.
//     0x12, 0x13 = 3  NOT determined by EITHER check. Both appear only in
//                     TAVERN.HMI, once each, so the archive carries almost no
//                     evidence about them; several sizes decode it identically.
//                     These two are an ASSUMPTION, not a measurement, and are
//                     recorded as one rather than dressed up as proven.
//
// NOT DECODED, AND SAID SO
//   - The 174..180 byte track header past the three fields above, the track
//     prologue records, and the payload of every 0xFE event. Their MEANING is
//     unknown; their sizes are evidenced to the degrees set out above. Raw
//     bytes are exposed.
//   - The song header words at 0x0D6/0x0F4 are derived from the track count, so
//     they carry no information; the rest of the 370-byte song header is zero
//     or constant across the archive.
//
// CORPUS QUIRKS, all preserved verbatim - but one
//   - SUNNYDAY.HMI track 5 carries a 1,192,560-tick delta (VLQ c8 e4 70)
//     before its last two events, a reverb-send controller and the closing
//     marker, where every other track in the song ends at tick 6802. Real
//     bytes, not a misparse - the track still lands exactly on its
//     end-of-track meta - and taking them at their word made that ONE song's
//     loop wait 2.76 hours in silence (9,994 s at the true clock; the song
//     is 57 s). It is an authoring artifact, and the reference reader knows
//     it: foo_midi's midi_processor_hmi.cpp "shunts" any HMI delta over
//     0xFFFF - the event lands at the track's last timestamp instead of
//     advancing - which is why DFU's shipped sunnyday.mid is 54.8 s. So
//     does this reader now (HMI_MAX_DELTA, 2026-08-27), and SUNNYDAY's
//     end tick is 6802 like its nine siblings.
//   - 129 songs have exactly one 0xFE 0x10 per track plus one 0xFE 0x14 and one
//     0xFE 0x15. TAVERN.HMI has extra 0xFE 0x10s and the archive's only
//     0xFE 0x12 and 0xFE 0x13; FOLK3.HMI has two 0xFE 0x14 and no 0xFE 0x15.
//   - 37 note-ons have duration 0. Their note-off is emitted at the same tick,
//     ordered after the note-on.
//   - Every track opens with controller 105 = 1 on channel 0 and closes with
//     controller 105 = 0 on channel 0, whatever channel the track plays on.
//     HMI's own marker; passed through as an ordinary controller event.

import { BsaFile, DIRECTORY_TYPES } from './bsaFile.js';

export const SONG_SIGNATURE = 'HMI-MIDISONG061595';
export const TRACK_SIGNATURE = 'HMI-MIDITRACK';

// Song header field offsets.
const SONG_RESOLUTION = 0xd2;
const SONG_TEMPO_BPM = 0xd4;

/** THE CLOCK: the HMI sequencer's ticks per quarter note at the header's
 *  BPM - sixty, so one tick is 1/BPM of a second (WildMIDI f_hmi.c:92;
 *  foo_midi's 192 ppqn at 1,605,632 us is the same 8.36 ms/tick). The
 *  header's own resolution field (0x0D2, 480 throughout the archive) is
 *  NOT this number - reading it as the time base ran every song 8x fast. */
export const HMI_TICKS_PER_QUARTER = 60;

/** THE SHUNT: a delta over this is not time. foo_midi's HMI processor
 *  (`delta > 0xFFFF`: "Large HMI delta detected, shunting") drops the
 *  event onto the track's last event tick rather than advancing by it;
 *  one retail track (SUNNYDAY.HMI track 5) carries such a delta and the
 *  original driver plainly did not wait 2.76 hours on it. */
export const HMI_MAX_DELTA = 0xffff;
const SONG_TRACK_COUNT = 0xe4;
const SONG_TRACK_TABLE = 0xe8;
const SONG_TRAILER_SIZE = 16;

// Track header field offsets.
const TRACK_EVENT_COUNT = 0x61;
const TRACK_DATA_OFFSET = 0x63;
const TRACK_CHANNEL = 0x79;

const PROLOGUE_RECORD_SIZE = 6;

// Bytes an HMI private event occupies after its 0xFE status byte, keyed by
// subtype. 0x10 is variable: subtype + 2 + length byte + length + 4.
const HMI_FIXED_SIZES = Object.freeze({ 0x12: 3, 0x13: 3, 0x14: 3, 0x15: 7 });
const HMI_CHANNEL_SETUP = 0x10;

const META_END_OF_TRACK = 0x2f;

/** Sort rank at equal ticks: note-offs first so a retrigger is not cut short. */
const RANK_NOTE_OFF = 0;
const RANK_EVENT = 1;
// A zero-duration note (37 exist in the archive) would otherwise sort its own
// note-off ahead of its note-on.
const RANK_DEGENERATE_NOTE_OFF = 2;

function readCString(bytes, offset, maxLength) {
  let s = '';
  for (let i = offset; i < offset + maxLength && i < bytes.length; i++) {
    if (bytes[i] === 0) break;
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

/**
 * One HMI song: header, tracks, and a merged event stream.
 *
 * All ticks are the HMI clock's: HMI_TICKS_PER_QUARTER (60) per quarter note
 * at the header's BPM. The stream is the whole song - a synth needs nothing
 * from this class but `events`, `secondsPerTick` and the channel of each event.
 */
export class HmiFile {
  constructor() {
    this.name = '';
    this.signature = '';
    this.headerResolution = 0;   // the 0x0D2 field, 480 in every retail song; not the time base
    this.beatsPerMinute = 0;
    this.trackCount = 0;
    this.tracks = [];
    this.events = [];
    this.durationTicks = 0;
    this.sourceName = '';
    this._bytes = null;
  }

  /**
   * Decodes a song. Returns false if the bytes are not an HMI song at all;
   * throws if they are an HMI song this reader cannot fully decode.
   * @param {Uint8Array} bytes
   * @param {string} name - song name, used in error messages only.
   * @returns {boolean}
   */
  load(bytes, name = '') {
    if (!(bytes instanceof Uint8Array)) throw new TypeError('HmiFile expects a Uint8Array');
    this.name = name;
    if (bytes.length < SONG_TRACK_TABLE + 4) return false;
    this.signature = readCString(bytes, 0, SONG_SIGNATURE.length);
    if (this.signature !== SONG_SIGNATURE) return false;

    this._bytes = bytes;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.headerResolution = view.getUint16(SONG_RESOLUTION, true);
    this.beatsPerMinute = view.getUint16(SONG_TEMPO_BPM, true);
    this.trackCount = view.getUint32(SONG_TRACK_COUNT, true);
    const tableOffset = view.getUint32(SONG_TRACK_TABLE, true);

    if (this.headerResolution <= 0) this._fail('bad header resolution');
    if (this.beatsPerMinute <= 0) this._fail('bad tempo');
    if (this.trackCount <= 0) this._fail('no tracks');
    if (tableOffset + 4 * this.trackCount > bytes.length) this._fail('track table out of range');

    const offsets = [];
    for (let i = 0; i < this.trackCount; i++) {
      const off = view.getUint32(tableOffset + 4 * i, true);
      if (off >= bytes.length) this._fail(`track ${i} offset ${off} out of range`);
      offsets.push(off);
    }

    this.tracks = [];
    let seq = 0;
    const merged = [];
    for (let i = 0; i < this.trackCount; i++) {
      const limit = i + 1 < this.trackCount ? offsets[i + 1] : bytes.length - SONG_TRAILER_SIZE;
      const track = this._readTrack(view, i, offsets[i], limit, seq);
      seq += track.events.length;
      this.tracks.push(track);
      for (const ev of track.events) merged.push(ev);
    }

    merged.sort((a, b) => a.tick - b.tick || a._rank - b._rank || a._seq - b._seq);
    for (const ev of merged) {
      delete ev._rank;
      delete ev._seq;
    }
    this.events = merged;
    this.durationTicks = this.tracks.reduce((n, t) => Math.max(n, t.endTick), 0);
    this.sourceName = readCString(bytes, bytes.length - SONG_TRAILER_SIZE, SONG_TRAILER_SIZE);
    return true;
  }

  /** The HMI clock: ticks per quarter note, for consumers that want a
   *  standard-MIDI division to pair with microsecondsPerQuarterNote. */
  get ticksPerQuarterNote() {
    return HMI_TICKS_PER_QUARTER;
  }

  /** Seconds per tick at the song's single tempo: 1/BPM (THE CLOCK above). */
  get secondsPerTick() {
    return 60 / (this.beatsPerMinute * HMI_TICKS_PER_QUARTER);
  }

  /** Standard-MIDI microseconds per quarter note, for exporting/consumers. */
  get microsecondsPerQuarterNote() {
    return Math.round(60000000 / this.beatsPerMinute);
  }

  /** Song length in seconds. */
  get durationSeconds() {
    return this.durationTicks * this.secondsPerTick;
  }

  /** Converts a tick to seconds from song start. */
  tickToSeconds(tick) {
    return tick * this.secondsPerTick;
  }

  _fail(message, offset) {
    const where = offset === undefined ? '' : ` at byte ${offset}`;
    throw new Error(`${this.name || 'HMI song'}: ${message}${where}`);
  }

  _readTrack(view, index, start, limit, seqBase) {
    const bytes = this._bytes;
    if (readCString(bytes, start, TRACK_SIGNATURE.length) !== TRACK_SIGNATURE) {
      this._fail(`track ${index} is not ${TRACK_SIGNATURE}`, start);
    }
    const dataOffset = view.getUint32(start + TRACK_DATA_OFFSET, true);
    const channel = bytes[start + TRACK_CHANNEL];
    let p = start + dataOffset;
    if (p >= limit) this._fail(`track ${index} data offset out of range`, start);

    const prologueCount = bytes[p];
    const prologueEnd = p + 1 + PROLOGUE_RECORD_SIZE * prologueCount;
    if (prologueEnd > limit) this._fail(`track ${index} prologue out of range`, p);
    const prologue = bytes.slice(p, prologueEnd);
    p = prologueEnd;

    const events = [];
    const pending = [];
    let tick = 0;
    let status = 0;
    let endTick = 0;
    let seq = seqBase;

    const vlq = () => {
      let value = 0;
      for (let i = 0; i < 4; i++) {
        if (p >= limit) this._fail(`track ${index} ran past its data`, p);
        const c = bytes[p++];
        value = (value << 7) | (c & 0x7f);
        if (!(c & 0x80)) return value;
      }
      this._fail(`track ${index} over-long variable-length quantity`, p);
      return 0;
    };
    const data = () => {
      if (p >= limit) this._fail(`track ${index} ran past its data`, p);
      const b = bytes[p++];
      if (b & 0x80) this._fail(`track ${index} data byte 0x${b.toString(16)} has bit 7 set`, p - 1);
      return b;
    };
    const push = (ev, rank) => {
      ev._rank = rank;
      ev._seq = seq++;
      ev.track = index;
      events.push(ev);
      return ev;
    };

    let lastTick = 0;   // the shunt's landing: the latest tick any event took
    for (;;) {
      const delta = vlq();
      if (delta > HMI_MAX_DELTA) tick = lastTick;   // THE SHUNT (foo_midi): an authoring artifact, not time
      else { tick += delta; if (tick > lastTick) lastTick = tick; }
      if (p >= limit) this._fail(`track ${index} ended without end-of-track`, p);
      let st = bytes[p];
      if (st & 0x80) p++;
      else if (status) st = status;
      else this._fail(`track ${index} running status with no status`, p);

      if (st === 0xff) {
        const type = bytes[p++];
        const length = vlq();
        const payload = bytes.slice(p, p + length);
        p += length;
        if (type === META_END_OF_TRACK) {
          endTick = tick;
          break;
        }
        push({ tick, type: 'meta', channel: null, metaType: type, data: payload }, RANK_EVENT);
        continue;
      }
      if (st === 0xfe) {
        if (p + 4 > limit) this._fail(`track ${index} HMI event runs past its data`, p);
        const subtype = bytes[p];
        let size = HMI_FIXED_SIZES[subtype];
        if (subtype === HMI_CHANNEL_SETUP) size = 1 + 2 + 1 + bytes[p + 3] + 4;
        if (!size) this._fail(`track ${index} unknown HMI event 0xFE 0x${subtype.toString(16)}`, p);
        if (p + size > limit) this._fail(`track ${index} HMI event runs past its data`, p);
        push(
          { tick, type: 'hmi', channel: null, subtype, data: bytes.slice(p + 1, p + size) },
          RANK_EVENT,
        );
        p += size;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        const length = vlq();
        const payload = bytes.slice(p, p + length);
        p += length;
        push({ tick, type: 'sysEx', channel: null, status: st, data: payload }, RANK_EVENT);
        continue;
      }
      status = st;
      const kind = st & 0xf0;
      const ch = st & 0x0f;
      switch (kind) {
        case 0x80: {
          const note = data();
          const velocity = data();
          push({ tick, type: 'noteOff', channel: ch, note, velocity }, RANK_NOTE_OFF);
          break;
        }
        case 0x90: {
          const note = data();
          const velocity = data();
          const duration = vlq();
          const on = push({ tick, type: 'noteOn', channel: ch, note, velocity, duration }, RANK_EVENT);
          pending.push({
            tick: tick + duration,
            type: 'noteOff',
            channel: ch,
            note,
            velocity: 0,
            _rank: duration === 0 ? RANK_DEGENERATE_NOTE_OFF : RANK_NOTE_OFF,
            _seq: on._seq,
            track: index,
          });
          break;
        }
        case 0xa0: {
          const note = data();
          const pressure = data();
          push({ tick, type: 'polyPressure', channel: ch, note, pressure }, RANK_EVENT);
          break;
        }
        case 0xb0: {
          const controller = data();
          const value = data();
          push({ tick, type: 'controller', channel: ch, controller, value }, RANK_EVENT);
          break;
        }
        case 0xc0:
          push({ tick, type: 'programChange', channel: ch, program: data() }, RANK_EVENT);
          break;
        case 0xd0:
          push({ tick, type: 'channelPressure', channel: ch, pressure: data() }, RANK_EVENT);
          break;
        case 0xe0: {
          const lsb = data();
          const msb = data();
          push({ tick, type: 'pitchBend', channel: ch, value: (msb << 7) | lsb }, RANK_EVENT);
          break;
        }
        default:
          // AUDIT 19 F3: pitch bend used to be the DEFAULT arm, so every
          // undefined status - 0xF1..0xF6 and 0xF8..0xFD - was decoded as
          // a bend on a phantom channel taken from its low nibble (0xF8
          // became "channel 8"). That directly contradicted this file's
          // own claim that anything outside the vocabulary throws, and it
          // is the shape the reader exists to prevent: garbage in, plausible
          // data out. 0xE0 is now explicit and the default fails loudly.
          this._fail(`track ${index} unknown status byte 0x${st.toString(16)}`, p - 1);
          break;
      }
    }

    const streamEventCount = events.length;
    for (const off of pending) {
      events.push(off);
      if (off.tick > endTick) endTick = off.tick;
    }
    events.sort((a, b) => a.tick - b.tick || a._rank - b._rank || a._seq - b._seq);

    // AUDIT 19 F2: ENFORCE the gate rather than merely reporting it. A
    // track that does not consume exactly to its limit has been misparsed,
    // and continuing produces a plausible-looking event stream that is
    // simply wrong. The whole retail archive satisfies this at 1286/1286.
    if (limit - p !== 0) {
      this._fail(`track ${index} consumed to ${p}, not its limit ${limit} (${limit - p} bytes adrift)`, p);
    }

    return {
      index,
      channel,
      byteOffset: start,
      byteLength: limit - start,
      dataOffset,
      headerEventCount: view.getUint16(start + TRACK_EVENT_COUNT, true),
      header: bytes.slice(start, start + dataOffset),
      prologue,
      events,
      // Events actually present in the byte stream, before note-on durations
      // are resolved into note-offs and excluding the end-of-track meta.
      streamEventCount,
      endTick,
      // AUDIT 19 F2: this is the reader's OWN GATE and it used to be
      // computed and thrown away - only the test looked at it. An injected
      // early FF 2F 00 made D1.HMI silently lose 839 events with load()
      // still returning true, which is exactly the "decodes to garbage
      // silently" failure this reader claims it cannot have. It is
      // enforced below; the field stays for the pins that report it.
      trailingBytes: limit - p,
    };
  }
}

/**
 * MIDI.BSA: the 131-song music archive. Thin wrapper over BsaFile that decodes
 * records on demand and caches them.
 */
export class MidiBsaFile {
  constructor() {
    this._bsa = null;
    this._songs = null;
  }

  static get filename() {
    return 'MIDI.BSA';
  }

  /** Number of songs in the archive. */
  get count() {
    return this._bsa ? this._bsa.count : 0;
  }

  /** Underlying BSA container. */
  get bsaFile() {
    return this._bsa;
  }

  /**
   * Loads MIDI.BSA contents.
   * @param {Uint8Array} bytes
   * @returns {boolean} true if successful.
   */
  load(bytes) {
    this._bsa = new BsaFile(bytes);
    if (this._bsa.directoryType !== DIRECTORY_TYPES.NameRecord) return false;
    this._songs = new Array(this._bsa.count).fill(null);
    return true;
  }

  /** True if index is within a valid range. */
  isValidIndex(song) {
    return song >= 0 && song < this.count;
  }

  /** Record name of a song, e.g. "D1.HMI". */
  getSongName(song) {
    return this._bsa ? this._bsa.getRecordName(song) : '';
  }

  /** Index of the named song record, or -1. */
  getSongIndex(name) {
    return this._bsa ? this._bsa.getRecordIndex(name) : -1;
  }

  /** Raw song bytes, or null. */
  getSongBytes(song) {
    return this._bsa ? this._bsa.getRecordBytes(song) : null;
  }

  /**
   * Decoded song at index, cached after first read. Returns null on an invalid
   * index; throws if the record is not a decodable HMI song.
   * @returns {HmiFile|null}
   */
  getSong(song) {
    if (!this.isValidIndex(song)) return null;
    if (this._songs[song]) return this._songs[song];
    const name = this.getSongName(song);
    const hmi = new HmiFile();
    if (!hmi.load(this.getSongBytes(song), name)) {
      throw new Error(`${name}: not an ${SONG_SIGNATURE} record`);
    }
    this._songs[song] = hmi;
    return hmi;
  }
}
