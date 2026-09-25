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

/** GM programs (gmSynth.js FM bank - the per-program articulations matter: 45, 47, 55 and 14 are struck or plucked). */
export const SCORE_PROGRAMS = Object.freeze({ ostinato: 45, bass: 32, strings: 48, brass: 61, choir: 52, organ: 19, timpani: 47, hit: 55, bells: 14 });
/** Channels: one voice each, the kit on GM's channel 9. */
export const SCORE_CHANNELS = Object.freeze({ ostinato: 0, bass: 1, strings: 2, brass: 3, choir: 4, organ: 5, timpani: 6, hit: 7, bells: 8, kit: 9 });
/** Each voice's level (CC7) and place (CC10, 64 the middle) - the ostinato and the strings a little apart. */
const MIX = Object.freeze({
  ostinato: [108, 50], bass: [90, 64], strings: [92, 80], brass: [114, 60], choir: [100, 70], organ: [62, 64], timpani: [106, 64], hit: [100, 64], bells: [92, 76],
});
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
function makeSong(name, bpm, bars, write) {
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
  events.push({ tick: 0, type: 'controller', channel: SCORE_CHANNELS.kit, controller: 7, value: 118 });
  events.sort((a, b) => a.tick - b.tick || RANK[a.type] - RANK[b.type]);
  // AUDIT WB D4: a song written as whole bars loops on its bar line (systems/songPlayer.js `seamless`) - the player's
  // classic rewind rings a second past the end first, and the war songs fell silent that long at every pass
  return { name, beatsPerMinute: bpm, secondsPerTick: 60 / (bpm * SCORE_TPQ), events, durationTicks: bars * 4 * SCORE_TPQ, seamless: true };
}

/** The ostinato, the bass and the pads under a chord for one bar. `density` 1 eighths, 2 sixteenths in the last beat. */
function underBar(w, bar, chord, { pads = true, strings = false, choir = false, organ = 1, busy = false, vel = 1 } = {}) {
  const c = CHORDS[chord];
  c.ost.forEach((n, i) => w.note('ostinato', bar, i * 0.5, 0.42, n, (i % 2 === 0 ? 96 : 76) * vel));
  if (busy) for (let i = 0; i < 4; i++) w.note('ostinato', bar, 3 + i * 0.25, 0.2, c.ost[(i * 3) % 8], 82 * vel);
  w.note('bass', bar, 0, 1.8, c.bass, 96 * vel);
  w.note('bass', bar, 2, 1.8, c.bass, 88 * vel);
  if (pads && organ > 0) for (const n of c.pad) w.note('organ', bar, 0, 4, n, 70 * organ);
  if (strings) for (const n of c.pad) w.note('strings', bar, 0, 4, midiNote(n) + 12, 78 * vel);
  if (choir) for (const n of c.choir) w.note('choir', bar, 0, 4, n, 84 * vel);
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

/** GATEWAR1 - he wakes: 32 bars, the groove, the stabs, the theme, the theme with the choir under it. */
function war1() {
  return makeSong(GATE_SONGS.war1, 132, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = WAR_A[bar % 8], c = CHORDS[chord];
      underBar(w, bar, chord, { strings: bar >= 8, choir: bar >= 24, organ: bar < 8 ? 0.8 : 1 });
      w.note('timpani', bar, 0, 1, c.timp, 112);
      if (bar % 4 === 3) { for (const [b, n] of [[2.5, c.timp], [3, c.timp], [3.5, 'A2']]) w.note('timpani', bar, b, 0.45, n, 104); }
      if (bar >= 4 && bar % 2 === 0) for (const n of c.stab) w.note('brass', bar, 0, 0.9, n, 108);
      if (bar % 8 === 0) { for (const n of c.stab) w.note('hit', bar, 0, 1, n, 110); w.note('bells', bar, 0, 3, 'D5', 86); }
      // the kit: the low end of it, a soft backbeat, the hat on the eighths, a crash each fourth bar
      if (bar % 2 === 0) w.hit('surdo', bar, 0, 84);
      for (const b of [0, 1.5, 2]) w.hit('kick', bar, b, b === 0 ? 100 : 86);
      for (const b of [3, 3.5]) w.hit('lowTom', bar, b, b === 3 ? 86 : 74);
      for (const b of [1, 3]) w.hit('snare', bar, b, 88);
      for (let i = 0; i < 8; i++) w.hit('hat', bar, i * 0.5, i % 2 ? 36 : 54);
      if (bar % 4 === 0) w.hit('crash', bar, 0, 96);
    }
    themeBars(w, 16, THEME_A, 'brass', 104);
    themeBars(w, 24, THEME_A, 'brass', 110);
    themeBars(w, 24, THEME_A, 'strings', 80, 1);
  });
}

/** GATEWAR2 - the ward breaks: 32 bars, the choir from the first, the kit rolling into every fourth bar, the theme
 *  dotted and high. */
function war2() {
  return makeSong(GATE_SONGS.war2, 138, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = WAR_A[bar % 8], c = CHORDS[chord];
      underBar(w, bar, chord, { strings: true, choir: true, busy: bar % 4 === 3 });
      w.note('timpani', bar, 0, 1, c.timp, 116);
      w.note('timpani', bar, 2, 1, c.timp, 100);
      if (bar % 2 === 0) for (const n of c.stab) w.note('hit', bar, 0, 1, n, 104);
      if (bar % 4 === 0) w.note('bells', bar, 0, 3, 'A4', 80);
      if (bar % 2 === 0) w.hit('surdo', bar, 0, 90);
      for (const b of [0, 0.75, 1.5, 2, 2.75]) w.hit('kick', bar, b, b === 0 ? 104 : 88);
      for (const b of [1, 3]) { w.hit('snare', bar, b, 98); w.hit('tambourine', bar, b, 62); }
      for (let i = 0; i < 16; i++) w.hit('hat', bar, i * 0.25, i % 4 === 0 ? 58 : 38);
      if (bar % 4 === 3) { const toms = ['hiMidTom', 'hiMidTom', 'lowMidTom', 'lowMidTom', 'highFloorTom', 'highFloorTom', 'lowTom', 'lowTom']; toms.forEach((k, i) => w.hit(k, bar, 2 + i * 0.25, 80 + i * 5)); }
      else for (const b of [3, 3.5]) w.hit('lowTom', bar, b, 90);
      if (bar % 2 === 0) w.hit('crash', bar, 0, 100);
    }
    themeBars(w, 0, THEME_B, 'brass', 108);
    themeBars(w, 8, THEME_B, 'brass', 112);
    themeBars(w, 16, THEME_A, 'brass', 104, 1);
    themeBars(w, 24, THEME_B, 'brass', 116);
    themeBars(w, 24, THEME_B, 'choir', 88, -1);
  });
}

/** GATEWAR3 - his wrath: 32 bars on the Neapolitan, the kick on every beat, the theme at the top. */
function war3() {
  return makeSong(GATE_SONGS.war3, 150, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = WAR_C[bar % 8], c = CHORDS[chord];
      underBar(w, bar, chord, { strings: true, choir: true, busy: true, organ: 1.2, vel: 1.05 });
      for (let i = 0; i < 8; i++) w.note('timpani', bar, i * 0.5, 0.4, i % 4 === 3 ? 'A2' : c.timp, i === 0 ? 124 : 96);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 116); if (bar % 2 === 1) w.note('hit', bar, 3.5, 0.5, n, 104); }
      if (bar % 4 === 0) { w.note('bells', bar, 0, 2, 'D5', 92); w.note('bells', bar, 2, 2, 'Ab4', 84); }   // the tritone, tolled
      w.hit('surdo', bar, 0, 96);
      for (let b = 0; b < 4; b++) w.hit('kick', bar, b, b === 0 ? 108 : 92);
      for (const b of [1, 3]) { w.hit('snare', bar, b, 110); w.hit('tambourine', bar, b, 70); }
      for (let i = 0; i < 16; i++) w.hit('hat', bar, i * 0.25, i % 2 ? 40 : 60);
      if (bar % 2 === 0) w.hit('crash', bar, 0, 108);
      if (bar % 4 === 3) { w.hit('chinese', bar, 3, 96); ['hiMidTom', 'lowMidTom', 'highFloorTom', 'lowTom'].forEach((k, i) => { w.hit(k, bar, 2 + i * 0.25, 96); w.hit(k, bar, 2.125 + i * 0.25, 84); }); }
    }
    themeBars(w, 0, THEME_C, 'brass', 112);
    themeBars(w, 8, THEME_C, 'brass', 116);
    themeBars(w, 8, THEME_C, 'strings', 84, -1);
    themeBars(w, 16, THEME_B, 'brass', 112);
    themeBars(w, 24, THEME_C, 'brass', 120);
    themeBars(w, 24, THEME_C, 'choir', 92, -1);
  });
}

/** GATEFELL - he falls: a timpani roll into D major, fanfare, choir and bells, four bars; then eight bars' quiet (the
 *  law stops it long before it could come round again). */
function fell() {
  return makeSong(GATE_SONGS.fell, 92, 12, (w) => {
    for (let i = 0; i < 16; i++) w.note('timpani', 0, i * 0.25, 0.24, 'D2', 50 + i * 4.5);   // the roll, rising
    for (const n of ['A3', 'D4', 'F#4']) w.note('choir', 0, 2, 2, n, 64);
    const D = CHORDS.D;
    for (const n of D.stab) w.note('hit', 1, 0, 1.5, n, 124);
    w.note('timpani', 1, 0, 1, 'D2', 124);
    w.hit('crash', 1, 0, 118); w.hit('kick', 1, 0, 110); w.hit('surdo', 1, 0, 100);
    /** @type {Array<[string, number, number]>} */
    const call = [['D4', 0, 0.5], ['F#4', 0.5, 0.5], ['A4', 1, 1], ['D5', 2, 2]];
    /** @type {Array<[string, number, number]>} */
    const answer = [['A4', 0, 1], ['B4', 1, 1], ['A4', 2, 1], ['F#4', 3, 1]];
    for (const [n, b, len] of call) w.note('brass', 1, b, len * 0.95, n, 120);
    for (const [n, b, len] of answer) w.note('brass', 2, b, len * 0.95, n, 112);
    w.note('brass', 3, 0, 4, 'D5', 118);
    for (const n of D.pad) { w.note('organ', 1, 0, 12, n, 80); w.note('strings', 1, 0, 12, midiNote(n) + 12, 84); }
    for (const n of D.choir) w.note('choir', 1, 0, 12, n, 92);
    w.note('bass', 1, 0, 12, 'D2', 116);
    w.note('bells', 1, 0, 4, 'D5', 96); w.note('bells', 3, 0, 2, 'A4', 88); w.note('bells', 3, 2, 2, 'D5', 92);
    w.note('timpani', 3, 0, 1, 'D2', 118);
    for (let i = 0; i < 8; i++) w.note('timpani', 3, 2 + i * 0.25, 0.24, 'D2', 70 + i * 6);
    w.note('timpani', 4, 0, 1, 'D2', 124); w.hit('crash', 4, 0, 110);
  });
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
      if (law === GATE_SONGS.fell && stingAt === null) stingAt = now;
      if (stingAt !== null && s.fell) return now - stingAt < SCORE_STING_MS ? GATE_SONGS.fell : SCORE_SILENCE;
      return law;
    },
  };
}
