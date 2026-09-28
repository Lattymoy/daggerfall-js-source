// @ts-check
// WB7 (2026-09-25, Mac: "Proper boss audio during the boss fight"): THE WARDEN'S SCORE - the Burning Court's own music,
// written here as notes, and the law of which of it plays. Design: bible/11-Multiplayer/World-Bosses.md section 5
// ("His voice and his music").
//
// WHY MADE, NOT CHOSEN. Daggerfall has no fight music: its dungeon tracks are made to be walked through, and none of
// MIDI.BSA's 131 songs rises and falls with anything. So the court's songs are made in code, in the shape an HMI song
// decodes to (formats/hmiFile.js - a tick-ordered event stream, one tempo, notes that carry their own durations), and
// played by the game's own player and voice bank (systems/songPlayer.js, gmSynth.js FM) under names of their own
// (music.registerSong) - so they sit in the same mix as every other song, fade in and out by the same law (DISC20-B),
// and a player's music pack can replace them by name as it replaces any song (M-EXT).
//
// THE SCORE, in D minor, on the instruments the FM bank plays with their own articulation (pizzicato strings for the
// driving ostinato, a struck timpani, the orchestra hit, brass, choir, church organ, tubular bells, the kit):
//   GATEWAR1 - HE WAKES. 132 BPM, i-VI-iv-V under a pizzicato ostinato on every eighth, timpani on each downbeat, the
//              kit's low end; brass stabs join, then the Warden's theme on the brass, then the choir under it.
//   GATEWAR2 - THE WARD BREAKS (phase two). 138 BPM, the kit busier and rolling into each fourth bar, the choir from the
//              first bar, the theme dotted and an octave higher.
//   GATEWAR3 - HIS WRATH (phase three, and the last minute before the Wrath at any phase). 150 BPM, the Neapolitan Eb
//              against D, the kick on every beat, crashes every other bar, the theme at the top of the brass.
//   GATEFELL - HE FALLS. A timpani roll into D major - Daggerfall's minor turned to its major - fanfare, choir, bells;
//              then quiet: the court is the Deadlands' air alone.
// Each loops (the player's own law) but GATEFELL, which the law stops once it has sounded.
//
// WBX9 (2026-09-26, Mac: "The music needs to be louder and more intense"): LOUDER - every voice's level raised and each
// song played SCORE_LEVEL over the player's own (systems/songPlayer.js `song.level`: the game's songs stand at 1), so the
// fight sounds over the Deadlands' air and the dungeon's tracks it replaces, its peaks still under the clip at the
// highest MusicVolume (tools/gateScoreProbe.mjs measures both); MORE INTENSE - no song waits to begin: the strings,
// the brass stabs and the whole kit from the first bar, the theme from the ninth, the choir from the ninth in the first
// song and from the first after; the ostinato driving in sixteenths as the phases turn (a bar's last beat in the first,
// every other bar's second half in the second, every bar whole in the third), the orchestra hit and the timpani on more
// beats, the kit's fills every fourth bar, the third song's choir chanting on the beat. The key, the tempos, the themes
// and the law are as they were.
//
// THE LAW (`courtScoreFor`): no fight, no score (the host's music director stands); a fight, the war song of his phase
// (the third from SCORE_WRATH_WARN_MS before the Wrath); his fall, GATEFELL for SCORE_STING_MS, then silence.
// Pure: the relay's clock in, a song's name (or SCORE_SILENCE, or null) out.
// Not a DFU member. Ledger A (WB).

/** The HMI clock: ticks a quarter note (formats/hmiFile.js HMI_TICKS_PER_QUARTER). */
export const SCORE_TPQ = 60;
/** The songs' names - their own, beside MIDI.BSA's (no record there is called this). */
export const GATE_SONGS = Object.freeze({ war1: 'GATEWAR1.HMI', war2: 'GATEWAR2.HMI', war3: 'GATEWAR3.HMI', fell: 'GATEFELL.HMI' });
/** The law's answer when the court wants nothing sounding. */
export const SCORE_SILENCE = 'silence';
/** The last stretch before the Wrath at which the third song plays whatever his phase, and how long the fall's
 *  fanfare is given before the court falls quiet (its four bars and a hit at 92 BPM, 11.1 s, and their ring). */
export const SCORE_WRATH_WARN_MS = 60000;
export const SCORE_STING_MS = 12500;
/** AUDIT WBX W3: how long after the court asks for the fanfare it begins - the song before it fades out first
 *  (systems/music.js MUSIC_FADE_OUT_S) and the player starts a beat on (systems/songPlayer.js' 0.06 s) - so its time is
 *  counted from its own first note, and its last hit is never under the fade. */
export const SCORE_STING_LEAD_MS = 1560;

/** GM programs (gmSynth.js FM bank - the per-program articulations matter: 45, 47, 55 and 14 are struck or plucked). */
export const SCORE_PROGRAMS = Object.freeze({ ostinato: 45, bass: 32, strings: 48, brass: 61, choir: 52, organ: 19, timpani: 47, hit: 55, bells: 14 });
/** Channels: one voice each, the kit on GM's channel 9. */
export const SCORE_CHANNELS = Object.freeze({ ostinato: 0, bass: 1, strings: 2, brass: 3, choir: 4, organ: 5, timpani: 6, hit: 7, bells: 8, kit: 9 });
/** Each voice's level (CC7) and place (CC10, 64 the middle) - the ostinato and the strings a little apart. */
const MIX = Object.freeze({
  ostinato: [116, 50], bass: [110, 64], strings: [108, 80], brass: [122, 60], choir: [114, 70], organ: [86, 64], timpani: [112, 64], hit: [110, 64], bells: [96, 76],
});
/** WBX9: the kit's level (CC7 on channel 9). */
const KIT_LEVEL = 114;
/** WBX9: each song over the player's own level (systems/songPlayer.js `song.level`; the game's songs stand at 1) - the
 *  war growing with his phases, the fall's fanfare over them. Measured through the real player: tools/gateScoreProbe.mjs. */
export const SCORE_LEVEL = Object.freeze({ war1: 1.42, war2: 1.6, war3: 1.64, fell: 1.7 });
/** GM kit keys (gmSynth.js DRUMS). */
const KIT = Object.freeze({ kick: 36, snare: 38, lowTom: 41, hat: 42, highFloorTom: 43, lowMidTom: 47, hiMidTom: 48, crash: 49, chinese: 52, tambourine: 54, crash2: 57, surdo: 87 });

const PITCH = Object.freeze({ C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 });
/** A note by name: `D4` is 62 (C4 is middle C, 60). */
export function midiNote(name) {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m || PITCH[m[1]] === undefined) throw new Error(`gateScore: not a note: ${name}`);
  return 12 * (Number(m[2]) + 1) + PITCH[m[1]];
}

/** The harmony: each chord's bass, its pad and choir voicings, its ostinato bar (eight eighths) and its brass stab. */
const CHORDS = Object.freeze({
  Dm: { bass: 'D2', timp: 'D2', pad: ['D3', 'F3', 'A3'], choir: ['A3', 'D4', 'F4'], ost: ['D3', 'D3', 'A3', 'D3', 'Bb3', 'D3', 'A3', 'F3'], stab: ['D4', 'F4', 'A4'] },
  Bb: { bass: 'Bb1', timp: 'F2', pad: ['Bb2', 'D3', 'F3'], choir: ['Bb3', 'D4', 'F4'], ost: ['Bb2', 'Bb2', 'F3', 'Bb2', 'G3', 'Bb2', 'F3', 'D3'], stab: ['Bb3', 'D4', 'F4'] },
  Gm: { bass: 'G1', timp: 'G2', pad: ['G2', 'Bb2', 'D3'], choir: ['G3', 'Bb3', 'D4'], ost: ['G2', 'G2', 'D3', 'G2', 'Eb3', 'G2', 'D3', 'Bb2'], stab: ['G3', 'Bb3', 'D4'] },
  A: { bass: 'A1', timp: 'A2', pad: ['A2', 'C#3', 'E3'], choir: ['A3', 'C#4', 'E4'], ost: ['A2', 'A2', 'E3', 'A2', 'F3', 'A2', 'E3', 'C#3'], stab: ['A3', 'C#4', 'E4'] },
  C: { bass: 'C2', timp: 'G2', pad: ['C3', 'E3', 'G3'], choir: ['G3', 'C4', 'E4'], ost: ['C3', 'C3', 'G3', 'C3', 'A3', 'C3', 'G3', 'E3'], stab: ['C4', 'E4', 'G4'] },
  Eb: { bass: 'Eb2', timp: 'Bb2', pad: ['Eb3', 'G3', 'Bb3'], choir: ['Bb3', 'Eb4', 'G4'], ost: ['Eb3', 'Eb3', 'Bb3', 'Eb3', 'C4', 'Eb3', 'Bb3', 'G3'], stab: ['Eb4', 'G4', 'Bb4'] },
  D: { bass: 'D2', timp: 'D2', pad: ['D3', 'F#3', 'A3'], choir: ['A3', 'D4', 'F#4'], ost: ['D3', 'D3', 'A3', 'D3', 'B3', 'D3', 'A3', 'F#3'], stab: ['D4', 'F#4', 'A4'] },
});
/** The progressions, a chord a bar. */
const WAR_A = Object.freeze(['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A']);
const WAR_C = Object.freeze(['Dm', 'Eb', 'C', 'A', 'Dm', 'Eb', 'Bb', 'A']);
/** THE WARDEN'S THEME, three ways: [note, beats] a bar, eight bars over its progression. */
const THEME_A = Object.freeze([
  [['D4', 1], ['A4', 1], ['G4', 0.5], ['F4', 0.5], ['E4', 1]],
  [['F4', 1.5], ['D4', 0.5], ['Bb3', 2]],
  [['G4', 1], ['Bb4', 1], ['A4', 0.5], ['G4', 0.5], ['F4', 1]],
  [['E4', 2], ['C#4', 1], ['A3', 1]],
  [['D4', 1], ['F4', 1], ['A4', 1], ['D5', 1]],
  [['C5', 1.5], ['Bb4', 0.5], ['A4', 1], ['F4', 1]],
  [['G4', 1], ['E4', 1], ['C5', 1], ['Bb4', 1]],
  [['A4', 2], ['G4', 0.5], ['F4', 0.5], ['E4', 1]],
]);
const THEME_B = Object.freeze([
  [['A4', 0.75], ['A4', 0.25], ['A4', 1], ['D5', 1], ['C5', 1]],
  [['Bb4', 0.75], ['A4', 0.25], ['G4', 1], ['F4', 2]],
  [['G4', 0.75], ['G4', 0.25], ['G4', 1], ['Bb4', 1], ['A4', 1]],
  [['E4', 3], ['C#4', 1]],
  [['A4', 0.75], ['A4', 0.25], ['A4', 1], ['F5', 1], ['E5', 1]],
  [['D5', 1.5], ['C5', 0.5], ['Bb4', 1], ['A4', 1]],
  [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1]],
  [['A5', 2], ['E5', 1], ['C#5', 1]],
]);
const THEME_C = Object.freeze([
  [['D5', 0.5], ['D5', 0.5], ['D5', 0.5], ['F5', 0.5], ['A5', 1], ['G5', 1]],
  [['G5', 1], ['Eb5', 1], ['Bb4', 1], ['G4', 1]],
  [['C5', 0.5], ['C5', 0.5], ['E5', 0.5], ['G5', 0.5], ['E5', 1], ['C5', 1]],
  [['C#5', 2], ['A4', 1], ['E4', 1]],
  [['D5', 0.5], ['D5', 0.5], ['F5', 0.5], ['A5', 0.5], ['D6', 2]],
  [['Bb5', 1], ['G5', 1], ['Eb5', 1], ['Bb4', 1]],
  [['A5', 1], ['F5', 1], ['D5', 1], ['Bb4', 1]],
  [['A4', 2], ['C#5', 1], ['E5', 1]],
]);

/** Control events sort before notes on the same tick (the reader's rank order: a program change is heard by the note
 *  it stands beside). */
const RANK = { programChange: 0, controller: 0, noteOn: 1 };

/**
 * A song in the shape the player plays (formats/hmiFile.js HmiFile: `events`, `secondsPerTick`, `durationTicks`):
 * `write(w)` lays its notes with `w.note(voice, bar, beat, beats, name, velocity)` and `w.hit(key, bar, beat,
 * velocity)`; every voice gets its program, level and place at tick 0.
 */
function makeSong(name, bpm, bars, write, level = 1) {
  const events = [];
  const tick = (bar, beat) => Math.round((bar * 4 + beat) * SCORE_TPQ);
  const w = {
    note(voice, bar, beat, beats, n, velocity) {
      const note = typeof n === 'number' ? n : midiNote(n);
      events.push({ tick: tick(bar, beat), type: 'noteOn', channel: SCORE_CHANNELS[voice], note, velocity: Math.max(1, Math.min(127, Math.round(velocity))), duration: Math.max(1, Math.round(beats * SCORE_TPQ)) });
    },
    hit(key, bar, beat, velocity) { w.note('kit', bar, beat, 0.25, KIT[key], velocity); },
  };
  write(w);
  for (const [voice, [level, pan]] of Object.entries(MIX)) {
    const channel = SCORE_CHANNELS[voice];
    events.push({ tick: 0, type: 'programChange', channel, program: SCORE_PROGRAMS[voice] });
    events.push({ tick: 0, type: 'controller', channel, controller: 7, value: level });
    events.push({ tick: 0, type: 'controller', channel, controller: 10, value: pan });
  }
  events.push({ tick: 0, type: 'controller', channel: SCORE_CHANNELS.kit, controller: 7, value: KIT_LEVEL });
  events.sort((a, b) => a.tick - b.tick || RANK[a.type] - RANK[b.type]);
  // AUDIT WB D4: a song written as whole bars loops on its bar line (systems/songPlayer.js `seamless`) - the player's
  // classic rewind rings a second past the end first, and the war songs fell silent that long at every pass
  return { name, beatsPerMinute: bpm, secondsPerTick: 60 / (bpm * SCORE_TPQ), events, durationTicks: bars * 4 * SCORE_TPQ, seamless: true, level };
}

/** The ostinato, the bass and the pads under a chord for one bar. `busy` sixteenths in the last beat; WBX9 `drive`
 *  sixteenths from that beat on (0 the whole bar, 2 its second half). */
function underBar(w, bar, chord, { pads = true, strings = false, choir = false, organ = 1, busy = false, drive = null, vel = 1 } = {}) {
  const c = CHORDS[chord];
  const from = drive ?? (busy ? 3 : 4);   // the beat the sixteenths take over from
  c.ost.forEach((n, i) => { if (i * 0.5 < from) w.note('ostinato', bar, i * 0.5, 0.42, n, (i % 2 === 0 ? 100 : 82) * vel); });
  for (let i = 0; i < (4 - from) * 4; i++) w.note('ostinato', bar, from + i * 0.25, 0.2, c.ost[(i * 3) % 8], (i % 4 === 0 ? 98 : 84) * vel);
  w.note('bass', bar, 0, 1.8, c.bass, 104 * vel);
  w.note('bass', bar, 2, 1.8, c.bass, 96 * vel);
  if (pads && organ > 0) for (const n of c.pad) w.note('organ', bar, 0, 4, n, 80 * organ);
  if (strings) for (const n of c.pad) w.note('strings', bar, 0, 4, midiNote(n) + 12, 90 * vel);
  if (choir) for (const n of c.choir) w.note('choir', bar, 0, 4, n, 96 * vel);
}

/** A theme's eight bars from `bar0`, over `voice`, shifted `octave` octaves. */
function themeBars(w, bar0, theme, voice, velocity, octave = 0) {
  theme.forEach((notes, b) => {
    let beat = 0;
    for (const [n, beats] of notes) {
      w.note(voice, bar0 + b, beat, beats * 0.92, midiNote(n) + 12 * octave, velocity + (beat === 0 ? 10 : 0));
      beat += beats;
    }
  });
}

/** GATEWAR1 - he wakes: 32 bars, the groove, the stabs and the strings from the first bar, the theme from the ninth
 *  with the choir under it, the theme again over the strings, then with the choir an octave below. WBX9: nothing
 *  waits - the whole band from the first bar. */
function war1() {
  return makeSong(GATE_SONGS.war1, 132, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = WAR_A[bar % 8], c = CHORDS[chord];
      underBar(w, bar, chord, { strings: true, choir: bar >= 8, busy: bar % 4 === 3 });
      w.note('timpani', bar, 0, 1, c.timp, 108);
      w.note('timpani', bar, 2, 1, c.timp, 96);
      if (bar % 4 === 3) { for (const [b, n] of [[2.5, c.timp], [3, c.timp], [3.5, 'A2']]) w.note('timpani', bar, b, 0.45, n, 106); }
      // the brass: a stab on the one and the and-of-two - every bar before the theme, every other bar under it
      if (bar < 8 || bar % 2 === 0) for (const n of c.stab) { w.note('brass', bar, 0, 0.9, n, 112); w.note('brass', bar, 1.5, 0.45, n, 98); }
      if (bar % 4 === 0) for (const n of c.stab) w.note('hit', bar, 0, 1, n, 104);
      if (bar % 8 === 0) w.note('bells', bar, 0, 3, 'D5', 92);
      // the kit: the low end, the backbeat, the hat on the eighths, a fill into every fourth bar, a crash on each
      w.hit('surdo', bar, 0, bar % 2 === 0 ? 96 : 84);
      for (const b of [0, 1.5, 2, 2.5]) w.hit('kick', bar, b, b === 0 ? 108 : 92);
      for (const b of [1, 3]) w.hit('snare', bar, b, 100);
      for (let i = 0; i < 8; i++) w.hit('hat', bar, i * 0.5, i % 2 ? 44 : 62);
      if (bar % 4 === 3) ['lowMidTom', 'lowMidTom', 'highFloorTom', 'lowTom'].forEach((k, i) => w.hit(k, bar, 3 + i * 0.25, 88 + i * 6));
      if (bar % 4 === 0) w.hit('crash', bar, 0, 94);
    }
    themeBars(w, 8, THEME_A, 'brass', 112);
    themeBars(w, 16, THEME_A, 'brass', 116);
    themeBars(w, 16, THEME_A, 'strings', 96, 1);
    themeBars(w, 24, THEME_A, 'brass', 120);
    themeBars(w, 24, THEME_A, 'choir', 100, -1);
  }, SCORE_LEVEL.war1);
}

/** GATEWAR2 - the ward breaks: 32 bars, the choir from the first, the ostinato driving in sixteenths through every
 *  other bar's second half, the kit rolling into every fourth bar, the theme dotted and high. */
function war2() {
  return makeSong(GATE_SONGS.war2, 138, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = WAR_A[bar % 8], c = CHORDS[chord];
      underBar(w, bar, chord, { strings: true, choir: true, drive: bar % 2 === 1 ? 2 : 3 });
      w.note('timpani', bar, 0, 1, c.timp, 110);
      w.note('timpani', bar, 1.5, 0.5, c.timp, 94);
      w.note('timpani', bar, 2, 1, c.timp, 104);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 104); if (bar % 2 === 1) w.note('hit', bar, 2.5, 0.5, n, 98); }
      if (bar % 4 === 0) w.note('bells', bar, 0, 3, 'A4', 88);
      w.hit('surdo', bar, 0, 96);
      for (const b of [0, 0.75, 1.5, 2, 2.75, 3.5]) w.hit('kick', bar, b, b === 0 ? 108 : 92);
      for (const b of [1, 3]) { w.hit('snare', bar, b, 104); w.hit('tambourine', bar, b, 70); }
      for (let i = 0; i < 16; i++) w.hit('hat', bar, i * 0.25, i % 4 === 0 ? 62 : 42);
      if (bar % 4 === 3) { const toms = ['hiMidTom', 'hiMidTom', 'lowMidTom', 'lowMidTom', 'highFloorTom', 'highFloorTom', 'lowTom', 'lowTom']; toms.forEach((k, i) => w.hit(k, bar, 2 + i * 0.25, 84 + i * 5)); }
      else for (const b of [3, 3.5]) w.hit('lowTom', bar, b, 94);
      if (bar % 2 === 0) w.hit('crash', bar, 0, 96);
    }
    themeBars(w, 0, THEME_B, 'brass', 112);
    themeBars(w, 8, THEME_B, 'brass', 116);
    themeBars(w, 8, THEME_B, 'strings', 92, 1);
    themeBars(w, 16, THEME_A, 'brass', 110, 1);
    themeBars(w, 16, THEME_A, 'strings', 96);
    themeBars(w, 24, THEME_B, 'brass', 120);
    themeBars(w, 24, THEME_B, 'choir', 98, -1);
  }, SCORE_LEVEL.war2);
}

/** GATEWAR3 - his wrath: 32 bars on the Neapolitan, the ostinato driving in sixteenths through every bar, the timpani
 *  on every eighth, the kick on every beat, the choir chanting on the beat, the theme at the top. */
function war3() {
  return makeSong(GATE_SONGS.war3, 150, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = WAR_C[bar % 8], c = CHORDS[chord];
      underBar(w, bar, chord, { strings: true, choir: false, drive: 0, organ: 1.2, vel: 1.05 });
      // the choir chants the chord on every beat, the first strongest
      for (let b = 0; b < 4; b++) for (const n of c.choir) w.note('choir', bar, b, 0.9, n, b === 0 ? 106 : 92);
      for (let i = 0; i < 8; i++) w.note('timpani', bar, i * 0.5, 0.4, i % 4 === 3 ? 'A2' : c.timp, i === 0 ? 110 : 96);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 106); w.note('hit', bar, 2.5, 0.5, n, 100); if (bar % 2 === 1) w.note('hit', bar, 3.5, 0.5, n, 100); }
      if (bar % 4 === 0) { w.note('bells', bar, 0, 2, 'D5', 96); w.note('bells', bar, 2, 2, 'Ab4', 90); }   // the tritone, tolled
      w.hit('surdo', bar, 0, 100);
      for (let b = 0; b < 4; b++) w.hit('kick', bar, b, b === 0 ? 110 : 96);
      if (bar % 4 === 3) for (const b of [0.5, 1.5, 2.5, 3.5]) w.hit('kick', bar, b, 88);   // the kick on every eighth into each fourth bar
      for (const b of [1, 3]) { w.hit('snare', bar, b, 112); w.hit('tambourine', bar, b, 76); }
      for (let i = 0; i < 16; i++) w.hit('hat', bar, i * 0.25, i % 2 ? 44 : 64);
      if (bar % 2 === 0) w.hit('crash', bar, 0, 98);
      if (bar % 4 === 3) { w.hit('chinese', bar, 3, 100); ['hiMidTom', 'lowMidTom', 'highFloorTom', 'lowTom'].forEach((k, i) => { w.hit(k, bar, 2 + i * 0.25, 100); w.hit(k, bar, 2.125 + i * 0.25, 88); }); }
    }
    themeBars(w, 0, THEME_C, 'brass', 114);
    themeBars(w, 8, THEME_C, 'brass', 118);
    themeBars(w, 8, THEME_C, 'strings', 96, -1);
    themeBars(w, 16, THEME_B, 'brass', 116);
    themeBars(w, 16, THEME_B, 'strings', 94);
    themeBars(w, 24, THEME_C, 'brass', 122);
    themeBars(w, 24, THEME_C, 'strings', 100, -1);
  }, SCORE_LEVEL.war3);
}

/** GATEFELL - he falls: a timpani roll into D major, fanfare, choir and bells, four bars; then eight bars' quiet (the
 *  law stops it long before it could come round again). */
function fell() {
  return makeSong(GATE_SONGS.fell, 92, 12, (w) => {
    for (let i = 0; i < 16; i++) w.note('timpani', 0, i * 0.25, 0.24, 'D2', 56 + i * 4);   // the roll, rising
    for (const n of ['A3', 'D4', 'F#4']) w.note('choir', 0, 2, 2, n, 82);
    const D = CHORDS.D;
    for (const n of D.stab) w.note('hit', 1, 0, 1.5, n, 112);
    w.note('timpani', 1, 0, 1, 'D2', 112);
    w.hit('crash', 1, 0, 104); w.hit('kick', 1, 0, 112); w.hit('surdo', 1, 0, 104);
    /** @type {Array<[string, number, number]>} */
    const call = [['D4', 0, 0.5], ['F#4', 0.5, 0.5], ['A4', 1, 1], ['D5', 2, 2]];
    /** @type {Array<[string, number, number]>} */
    const answer = [['A4', 0, 1], ['B4', 1, 1], ['A4', 2, 1], ['F#4', 3, 1]];
    // WBX9: the call and its answer on the brass and, an octave over it, the strings
    for (const [n, b, len] of call) { w.note('brass', 1, b, len * 0.95, n, 124); w.note('strings', 1, b, len * 0.95, midiNote(n) + 12, 100); }
    for (const [n, b, len] of answer) { w.note('brass', 2, b, len * 0.95, n, 118); w.note('strings', 2, b, len * 0.95, midiNote(n) + 12, 96); }
    w.note('brass', 3, 0, 4, 'D5', 122);
    for (const n of D.pad) { w.note('organ', 1, 0, 12, n, 94); w.note('strings', 3, 0, 5, midiNote(n) + 12, 100); }   // held into the last hit, never past it
    for (const n of D.choir) w.note('choir', 1, 0, 12, n, 108);
    w.note('bass', 1, 0, 12, 'D2', 118);
    w.note('bells', 1, 0, 4, 'D5', 100); w.note('bells', 3, 0, 2, 'A4', 92); w.note('bells', 3, 2, 2, 'D5', 96);
    w.note('timpani', 3, 0, 1, 'D2', 116);
    for (let i = 0; i < 8; i++) w.note('timpani', 3, 2 + i * 0.25, 0.24, 'D2', 76 + i * 5);
    w.note('timpani', 4, 0, 1, 'D2', 112); w.hit('crash', 4, 0, 102); w.hit('kick', 4, 0, 104);
    for (const n of D.stab) w.note('hit', 4, 0, 1, n, 108);
  }, SCORE_LEVEL.fell);
}

let _songs = null;
/** The four songs, made once (pure: the same notes every time). */
export function gateScoreSongs() {
  return (_songs ??= Object.freeze({ war1: war1(), war2: war2(), war3: war3(), fell: fell() }));
}

/**
 * THE LAW: what the court plays for the fight state `s` (net/gateLink.js) at `now` (the relay's clock, ms) - a
 * GATE_SONGS name, SCORE_SILENCE, or null (no fight on this screen: the host's music director stands).
 */
export function courtScoreFor(s, now) {
  if (!s || s.day === null || s.day === undefined) return null;
  if (s.fell) return now - s.fell.at < SCORE_STING_MS ? GATE_SONGS.fell : SCORE_SILENCE;
  if (s.wrath != null) return SCORE_SILENCE;   // the Wrath has landed: nothing plays over it
  if (Number.isFinite(s.wrathAt) && s.wrathAt - now <= SCORE_WRATH_WARN_MS) return GATE_SONGS.war3;
  return s.phase >= 3 ? GATE_SONGS.war3 : s.phase === 2 ? GATE_SONGS.war2 : GATE_SONGS.war1;
}

/**
 * AUDIT WB D2: THE SCORE AS ONE MACHINE HEARS IT - courtScoreFor, but his fall's fanfare, once begun here, plays WHOLE:
 * SCORE_STING_MS from when it began on this screen, not from his fall (a word of the kill that came late cut it short),
 * and what follows it is quiet. A fight of another day starts fresh. `want(s, now)` answers as courtScoreFor does.
 */
export function createCourtScore() {
  let stingAt = null, day = null;
  return {
    want(s, now) {
      const law = courtScoreFor(s, now);
      if (law === null) { stingAt = null; day = null; return null; }
      if (s.day !== day) { day = s.day; stingAt = null; }
      if (law === GATE_SONGS.fell && stingAt === null) stingAt = now + SCORE_STING_LEAD_MS;   // AUDIT WBX W3: from when it sounds
      if (stingAt !== null && s.fell) return now - stingAt < SCORE_STING_MS ? GATE_SONGS.fell : SCORE_SILENCE;
      return law;
    },
  };
}
