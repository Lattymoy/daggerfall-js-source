// @ts-check
// SD13 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16; Mac: "The detail needs to
// exceed that of the oblivion gates. These are the pinnacle of the hardest content in the game"): THE SCORE OF THE HOUR
// - the Hollow's and the Shattered Hour's own music, written here as notes, and the law of which of it plays where.
//
// WHY MADE: as the Warden's (systems/gateScore.js): Daggerfall has no fight music, and nothing in MIDI.BSA rises and
// falls with anything. So the Hour's songs are made in code in the shape an HMI song decodes to, played by the game's
// own player and FM bank (systems/songPlayer.js, gmSynth.js) under names of their own (music.registerSong), faded by
// the same law, and replaceable by a music pack by name.
//
// THE HOUR'S SOUND - "not oblivion, something different" (Mac, of the Hour): the Warden's is D minor and fire; the
// Hour's is C MINOR AND A CLOCK. Its one motif is a WESTMINSTER QUARTER CHIME, struck in the minor and BROKEN - its
// fourth change ends on F sharp, the tritone of its home, where the hour should strike (`HOUR_CHIME`): the Warp's
// every-ending-at-once, heard. Its escapement is a harpsichord ticking in eighths and sixteenths over the chord (the
// `clock` voice), a wood block's tick and tock on the beat, a music box for the chime, tubular bells for the hours;
// its harmony turns on the AUGMENTED triad (A-flat, C, E - C minor's own third undone) and the Neapolitan D-flat; the
// Brass Remnant's theme is on the brass and the horns, low. When the Remnant falls the chime is MENDED - the four
// quarters in C major, ending home (`HOUR_CHIME_MENDED`).
//
//   HOURHOLW - THE HOLLOW. 84 BPM: the Remnant's progression at half speed under the organ's pedal, the tick and
//              the tock, a quarter of the broken chime on the bells at each section; its theme, slowed, on the horn
//              in the second half. The dungeon's walk before the Rift.
//   HOURHALL - THE ORRERY. 96 BPM: the harpsichord's escapement and the harp under the music box's chime and its
//              answer - the hall's riddle in sound; the claves ticking.
//   HOURSTEP - THE UNMOORED STEPS. 120 BPM: a heartbeat on the timpani, the escapement driving, the horn's long
//              theme over the void, a whole-tone run on the music box falling into each fourth bar.
//   HOURWAR1 - THE REMNANT WAKES. 136 BPM: the brass ostinato and the escapement in sixteenths, the Remnant's theme on
//              the brass, then the horns and the choir; the kit low, the tick and tock through it all.
//   HOURWAR2 - THE DRAGON BREAK. 142 BPM: two themes for two Echoes - GOLD on the brass and SILVER, its echo, two beats
//              behind on the strings an octave down (the Echoes' canon); the chromatic mediant E major against C minor.
//   HOURWAR3 - THE LAST MOMENT. 152 BPM: the Neapolitan and the augmented, the claves racing in sixteenths, the choir
//              chanting the beat, the theme in eighths over all of it, the broken chime tolled on the bells.
//   HOURLAST - THE HOUR ENDS (its last minute). 160 BPM: C minor and D-flat, a bar each, the bell tolling every bar
//              - counting - the broken change hammered on the brass, the clock in sixteenths.
//   HOURFELL - IT FALLS. A timpani roll into C MAJOR, the MENDED chime on the brass and the bells, the choir; then
//              quiet.
//   HOURGONE - THE COLLAPSE. 72 BPM: C major and A minor, the mended chime on the music box, slowly, the harp and the
//              strings, the horn's farewell, the tick and the tock - the three minutes the way home stands.
//
// THE LAW (`hourScoreFor`): where I stand (`sdScorePlace` - the Hollow; in the Hour the hall, the Steps or the arena)
// and the fight this page holds: no Hollow and no Hour, no score (the director stands); the Hollow, HOURHOLW; the hall,
// HOURHALL; the Steps (and the arena before its fight's first word), HOURSTEP; the arena's fight, the war of its phase,
// HOURLAST in its last minute, silence from the End and on a lost fight; the fall, HOURFELL from its own first note
// for SD_SCORE_STING_MS (`createHourScore`), then HOURGONE anywhere in the Hollow or the Hour while it collapses.
// Pure: the fight's clock in, a song's name (or SD_SCORE_SILENCE, or null) out.
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { midiNote, SCORE_TPQ, SCORE_STING_LEAD_MS } from './gateScore.js';
import { SD_ARENA } from '../net/sdBrain.js';
import { SD_FIRST_STEP } from '../world/sdHall.js';
import { SD_BAR_NEAR_M } from '../ui/sdRemnantBar.js';

/** The songs' names - their own, beside MIDI.BSA's and the Warden's. */
export const HOUR_SONGS = Object.freeze({
  hollow: 'HOURHOLW.HMI', hall: 'HOURHALL.HMI', steps: 'HOURSTEP.HMI', war1: 'HOURWAR1.HMI', war2: 'HOURWAR2.HMI', war3: 'HOURWAR3.HMI',
  last: 'HOURLAST.HMI', fell: 'HOURFELL.HMI', gone: 'HOURGONE.HMI',
});
/** The law's answer when the Hour wants nothing sounding. */
export const SD_SCORE_SILENCE = 'silence';
/** The last stretch before the Hour's End at which HOURLAST plays, and how long the fall's song is given from its own
 *  first note (its five bars and the hour struck at 88 BPM, 15 s, and their ring) before the collapse's song. */
export const SD_SCORE_ENDS_WARN_MS = 60 * 1000;
export const SD_SCORE_STING_MS = 16500;

/** GM programs (gmSynth.js's FM bank - 6, 10, 14, 45, 46, 47 and 55 by their own articulation: plucked, struck, rung). */
export const HOUR_PROGRAMS = Object.freeze({
  clock: 6, bass: 32, strings: 48, brass: 61, choir: 52, organ: 19, timpani: 47, chime: 10, bells: 14, horn: 60, pizz: 45, harp: 46, hit: 55,
});
/** Channels: one voice each, the kit on GM's channel 9. */
export const HOUR_CHANNELS = Object.freeze({
  clock: 0, bass: 1, strings: 2, brass: 3, choir: 4, organ: 5, timpani: 6, chime: 7, bells: 8, kit: 9, horn: 10, pizz: 11, harp: 12, hit: 13,
});
/** Each voice's level (CC7) and place (CC10): the escapement left, the chime further left, the bells and the strings
 *  right - a clock's face across the stereo. The bass under the rest (the gate's WB10a: a laptop gives nothing below
 *  120 Hz back). */
const MIX = Object.freeze({
  clock: [100, 44], bass: [98, 64], strings: [104, 84], brass: [120, 58], choir: [110, 72], organ: [84, 64], timpani: [112, 64],
  chime: [106, 34], bells: [98, 92], horn: [112, 70], pizz: [96, 50], harp: [94, 40], hit: [106, 64],
});
const KIT_LEVEL = 112;
/** Each song over the player's own level, and its press (systems/songPlayer.js `song.level`, `song.press` - the gate's
 *  law): the wars growing with the phases, the last minute over them, the places' songs under the fight's. Measured
 *  through the real player: tools/sdScoreProbe.mjs. */
export const HOUR_LEVEL = Object.freeze({ hollow: 1.25, hall: 1.3, steps: 1.4, war1: 1.42, war2: 1.55, war3: 1.62, last: 1.66, fell: 1.7, gone: 1.3 });
const PRESS = Object.freeze({ threshold: -18, knee: 12, ratio: 4, attack: 0.003, release: 0.25, ceiling: -1 });
export const HOUR_PRESS = Object.freeze({
  hollow: Object.freeze({ ...PRESS, out: 4.2 }), hall: Object.freeze({ ...PRESS, out: 4.4 }), steps: Object.freeze({ ...PRESS, out: 4.8 }),
  war1: Object.freeze({ ...PRESS, out: 5.2 }), war2: Object.freeze({ ...PRESS, out: 5.2 }), war3: Object.freeze({ ...PRESS, out: 5.6 }),
  last: Object.freeze({ ...PRESS, out: 5.8 }), fell: Object.freeze({ ...PRESS, out: 5.6 }), gone: Object.freeze({ ...PRESS, out: 4.4 }),
});
/** GM kit keys (gmSynth.js DRUMS): the clock's woods - the tick (hi wood block), the tock (low), the claves racing -
 *  the gears' ride bell, and the low drums. */
const KIT = Object.freeze({
  kick: 36, snare: 38, lowTom: 41, highFloorTom: 43, tom: 45, lowMidTom: 47, hiMidTom: 48, crash: 49, chinese: 52, rideBell: 53,
  claves: 75, tick: 76, tock: 77, triangle: 81, surdo: 87,
});

/** THE HOUR'S CHIME - the Westminster quarters struck in C minor, a change a bar, BROKEN: its fourth change ends on F
 *  sharp, the tritone of its home, where the hour should strike. */
export const HOUR_CHIME = Object.freeze([
  Object.freeze(['Eb5', 'D5', 'C5', 'G4']), Object.freeze(['C5', 'Eb5', 'D5', 'G4']), Object.freeze(['Eb5', 'C5', 'D5', 'G4']), Object.freeze(['G4', 'D5', 'Eb5', 'F#5']),
]);
/** ...and MENDED, as the Remnant falls: the quarters in C major, the fourth ending home. */
export const HOUR_CHIME_MENDED = Object.freeze([
  Object.freeze(['E5', 'D5', 'C5', 'G4']), Object.freeze(['C5', 'E5', 'D5', 'G4']), Object.freeze(['E5', 'C5', 'D5', 'G4']), Object.freeze(['G4', 'D5', 'E5', 'C5']),
]);

/** The harmony: each chord's bass and timpani, its pad (the organ - open where it is struck), the strings' and the
 *  choir's voicings, its escapement (eight eighths, the root's swing against its fifth and a turn at the end) and its
 *  harp (eight eighths, up and back). */
const CHORDS = Object.freeze({
  Cm: { bass: 'C2', timp: 'C2', pad: ['C3', 'G3', 'C4'], str: ['C4', 'Eb4', 'G4'], choir: ['C3', 'G3', 'Eb4'], clock: ['C4', 'G3', 'Eb4', 'G3', 'C4', 'G3', 'D4', 'G3'], stab: ['C3', 'G3', 'C4'], arp: ['C3', 'G3', 'C4', 'Eb4', 'G4', 'Eb4', 'C4', 'G3'] },
  Aaug: { bass: 'Ab1', timp: 'C2', pad: ['Ab2', 'E3', 'C4'], str: ['C4', 'E4', 'Ab4'], choir: ['Ab2', 'E3', 'C4'], clock: ['C4', 'Ab3', 'E4', 'Ab3', 'C4', 'Ab3', 'E4', 'Ab3'], stab: ['Ab2', 'E3', 'C4'], arp: ['Ab2', 'C3', 'E3', 'Ab3', 'C4', 'E4', 'C4', 'Ab3'] },
  Fm: { bass: 'F1', timp: 'F2', pad: ['F2', 'C3', 'F3'], str: ['C4', 'F4', 'Ab4'], choir: ['F2', 'C3', 'Ab3'], clock: ['C4', 'F3', 'Ab3', 'F3', 'C4', 'F3', 'Bb3', 'F3'], stab: ['F2', 'C3', 'F3'], arp: ['F2', 'C3', 'F3', 'Ab3', 'C4', 'Ab3', 'F3', 'C3'] },
  G: { bass: 'G1', timp: 'G2', pad: ['G2', 'D3', 'G3'], str: ['B3', 'D4', 'G4'], choir: ['G2', 'D3', 'B3'], clock: ['B3', 'G3', 'D4', 'G3', 'B3', 'G3', 'F4', 'G3'], stab: ['G2', 'D3', 'G3'], arp: ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3'] },
  Db: { bass: 'Db2', timp: 'Ab2', pad: ['Db3', 'Ab3', 'Db4'], str: ['Db4', 'F4', 'Ab4'], choir: ['Db3', 'Ab3', 'F4'], clock: ['Db4', 'Ab3', 'F4', 'Ab3', 'Db4', 'Ab3', 'C4', 'Ab3'], stab: ['Db3', 'Ab3', 'Db4'], arp: ['Db3', 'Ab3', 'Db4', 'F4', 'Ab4', 'F4', 'Db4', 'Ab3'] },
  Bbm: { bass: 'Bb1', timp: 'F2', pad: ['Bb2', 'F3', 'Bb3'], str: ['Db4', 'F4', 'Bb4'], choir: ['Bb2', 'F3', 'Db4'], clock: ['Db4', 'Bb3', 'F4', 'Bb3', 'Db4', 'Bb3', 'C4', 'Bb3'], stab: ['Bb2', 'F3', 'Bb3'], arp: ['Bb2', 'F3', 'Bb3', 'Db4', 'F4', 'Db4', 'Bb3', 'F3'] },
  E: { bass: 'E2', timp: 'B2', pad: ['E3', 'B3', 'E4'], str: ['E4', 'G#4', 'B4'], choir: ['E3', 'B3', 'G#4'], clock: ['E4', 'B3', 'G#4', 'B3', 'E4', 'B3', 'F#4', 'B3'], stab: ['E3', 'B3', 'E4'], arp: ['E3', 'B3', 'E4', 'G#4', 'B4', 'G#4', 'E4', 'B3'] },
  Ab: { bass: 'Ab1', timp: 'Eb2', pad: ['Ab2', 'Eb3', 'Ab3'], str: ['C4', 'Eb4', 'Ab4'], choir: ['Ab2', 'Eb3', 'C4'], clock: ['C4', 'Ab3', 'Eb4', 'Ab3', 'C4', 'Ab3', 'Bb3', 'Ab3'], stab: ['Ab2', 'Eb3', 'Ab3'], arp: ['Ab2', 'Eb3', 'Ab3', 'C4', 'Eb4', 'C4', 'Ab3', 'Eb3'] },
  Abmaj7: { bass: 'Ab1', timp: 'Eb2', pad: ['Ab2', 'Eb3', 'G3'], str: ['C4', 'Eb4', 'G4'], choir: ['Ab2', 'Eb3', 'C4'], clock: ['C4', 'Ab3', 'G4', 'Ab3', 'Eb4', 'Ab3', 'G4', 'Ab3'], stab: ['Ab2', 'Eb3', 'Ab3'], arp: ['Ab2', 'Eb3', 'G3', 'C4', 'Eb4', 'C4', 'G3', 'Eb3'] },
  Gsus: { bass: 'G1', timp: 'G2', pad: ['G2', 'D3', 'C4'], str: ['C4', 'D4', 'G4'], choir: ['G2', 'D3', 'C4'], clock: ['C4', 'G3', 'D4', 'G3', 'C4', 'G3', 'D4', 'G3'], stab: ['G2', 'D3', 'G3'], arp: ['G2', 'D3', 'G3', 'C4', 'D4', 'C4', 'G3', 'D3'] },
  Dm7b5: { bass: 'D2', timp: 'D2', pad: ['D3', 'Ab3', 'C4'], str: ['C4', 'F4', 'Ab4'], choir: ['D3', 'Ab3', 'F4'], clock: ['C4', 'Ab3', 'F4', 'Ab3', 'D4', 'Ab3', 'F4', 'Ab3'], stab: ['D3', 'Ab3', 'C4'], arp: ['D3', 'Ab3', 'C4', 'F4', 'Ab4', 'F4', 'C4', 'Ab3'] },
  C: { bass: 'C2', timp: 'C2', pad: ['C3', 'G3', 'E4'], str: ['C4', 'E4', 'G4'], choir: ['C3', 'G3', 'E4'], clock: ['C4', 'G3', 'E4', 'G3', 'C4', 'G3', 'D4', 'G3'], stab: ['C4', 'E4', 'G4'], arp: ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'] },
  Am: { bass: 'A1', timp: 'A2', pad: ['A2', 'E3', 'A3'], str: ['C4', 'E4', 'A4'], choir: ['A2', 'E3', 'C4'], clock: ['C4', 'A3', 'E4', 'A3', 'C4', 'A3', 'B3', 'A3'], stab: ['A2', 'E3', 'A3'], arp: ['A2', 'E3', 'A3', 'C4', 'E4', 'C4', 'A3', 'E3'] },
  F: { bass: 'F1', timp: 'F2', pad: ['F2', 'C3', 'A3'], str: ['C4', 'F4', 'A4'], choir: ['F2', 'C3', 'A3'], clock: ['C4', 'F3', 'A3', 'F3', 'C4', 'F3', 'G3', 'F3'], stab: ['F2', 'C3', 'F3'], arp: ['F2', 'C3', 'F3', 'A3', 'C4', 'A3', 'F3', 'C3'] },
});
/** The progressions, a chord a bar. The Remnant's: C minor, the augmented (its third undone), iv, the dominant, then
 *  the Neapolitan; the Dragon Break's turns to E major - gold against silver, a third apart; the Last Moment's on the
 *  Neapolitan and the minor four. */
const HOUR_A = Object.freeze(['Cm', 'Aaug', 'Fm', 'G', 'Cm', 'Db', 'G', 'G']);
const HOUR_B = Object.freeze(['Cm', 'E', 'Cm', 'Ab', 'Fm', 'Db', 'G', 'G']);
const HOUR_C = Object.freeze(['Cm', 'Db', 'Bbm', 'Db', 'Fm', 'Aaug', 'G', 'G']);
const HALL = Object.freeze(['Cm', 'Abmaj7', 'Fm', 'Gsus', 'Cm', 'Aaug', 'Dm7b5', 'G']);
const STEPS = Object.freeze(['Cm', 'Db', 'Cm', 'Aaug', 'Fm', 'Db', 'G', 'G']);
const LAST = Object.freeze(['Cm', 'Db', 'Cm', 'Db', 'Cm', 'Db', 'G', 'G']);
const GONE = Object.freeze(['C', 'Am', 'F', 'C', 'Am', 'F', 'Gsus', 'G']);

/** THE BRASS REMNANT'S THEME, three ways ([note, beats] a bar, eight bars over its progression): it opens on the
 *  chime's own first notes, low, and leans on the augmented's E natural against the minor's E-flat. */
const THEME_R1 = Object.freeze([
  [['C4', 1], ['G3', 1], ['Eb4', 1.5], ['D4', 0.5]],
  [['C4', 2], ['E4', 1], ['Ab4', 1]],
  [['F4', 1.5], ['Ab4', 0.5], ['G4', 1], ['F4', 1]],
  [['D4', 2], ['B3', 1], ['G3', 1]],
  [['Eb4', 1], ['D4', 1], ['C4', 1], ['G3', 1]],
  [['Db4', 2], ['F4', 1], ['Ab4', 1]],
  [['G4', 1.5], ['F4', 0.5], ['Eb4', 1], ['D4', 1]],
  [['D4', 2], ['G3', 1], ['B3', 1]],
]);
/** The Dragon Break's: dotted, climbing, a third bright - the gold Echo's; the silver's is the same two beats behind. */
const THEME_R2 = Object.freeze([
  [['G4', 0.75], ['G4', 0.25], ['Eb4', 1], ['C4', 1], ['G4', 1]],
  [['G#4', 0.75], ['G#4', 0.25], ['B4', 1], ['E5', 2]],
  [['G4', 0.75], ['Eb4', 0.25], ['C5', 1], ['Bb4', 1], ['G4', 1]],
  [['Ab4', 2], ['C5', 1], ['Eb5', 1]],
  [['F4', 0.75], ['F4', 0.25], ['Ab4', 1], ['C5', 1], ['Db5', 1]],
  [['Db5', 1.5], ['C5', 0.5], ['Ab4', 1], ['F4', 1]],
  [['G4', 1], ['B4', 1], ['D5', 1], ['F5', 1]],
  [['Eb5', 2], ['D5', 1], ['B4', 1]],
]);
/** The Last Moment's: in eighths, up the chord and down. */
const THEME_R3 = Object.freeze([
  [['C5', 0.5], ['C5', 0.5], ['D5', 0.5], ['Eb5', 0.5], ['G5', 1], ['C5', 1]],
  [['Db5', 1], ['F5', 0.5], ['Ab5', 0.5], ['F5', 1], ['Db5', 1]],
  [['Bb4', 0.5], ['Bb4', 0.5], ['Db5', 0.5], ['F5', 0.5], ['Bb5', 1], ['F5', 1]],
  [['Ab5', 1], ['F5', 1], ['Db5', 1], ['Ab4', 1]],
  [['F5', 0.5], ['G5', 0.5], ['Ab5', 0.5], ['G5', 0.5], ['F5', 1], ['C5', 1]],
  [['E5', 1], ['Ab5', 1], ['C6', 1], ['Ab5', 1]],
  [['B4', 0.5], ['D5', 0.5], ['F5', 0.5], ['Ab5', 0.5], ['G5', 1], ['F5', 1]],
  [['G5', 2], ['F#5', 1], ['G5', 1]],
]);
/** The hall's: the chime's four changes, then its answer - the riddle, and the turn of it. */
const THEME_HALL = Object.freeze([
  [['Eb5', 1], ['D5', 1], ['C5', 1], ['G4', 1]],
  [['C5', 1], ['Eb5', 1], ['D5', 1], ['G4', 1]],
  [['Eb5', 1], ['C5', 1], ['D5', 1], ['G4', 1]],
  [['G4', 1], ['D5', 1], ['Eb5', 1], ['F#5', 1]],
  [['G5', 2], ['Eb5', 1], ['C5', 1]],
  [['E5', 2], ['C5', 1], ['Ab4', 1]],
  [['F5', 1.5], ['Eb5', 0.5], ['D5', 1], ['C5', 1]],
  [['B4', 2], ['D5', 1], ['G4', 1]],
]);
/** The Steps': the horn's long line over the void. */
const THEME_STEPS = Object.freeze([
  [['C4', 3], ['G3', 1]],
  [['Ab3', 2], ['F3', 1], ['Db4', 1]],
  [['Eb4', 3], ['D4', 1]],
  [['E4', 2], ['C4', 2]],
  [['F4', 1.5], ['G4', 0.5], ['Ab4', 2]],
  [['Ab4', 2], ['F4', 1], ['Db4', 1]],
  [['D4', 2], ['B3', 2]],
  [['G3', 4]],
]);
/** The collapse's: the horn's farewell in C major. */
const THEME_GONE = Object.freeze([
  [['E4', 2], ['D4', 1], ['C4', 1]],
  [['C4', 2], ['E4', 1], ['A4', 1]],
  [['A4', 1.5], ['G4', 0.5], ['F4', 1], ['C4', 1]],
  [['E4', 3], ['G4', 1]],
  [['A4', 2], ['G4', 1], ['E4', 1]],
  [['F4', 2], ['A4', 1], ['C5', 1]],
  [['D5', 2], ['C5', 2]],
  [['B4', 3], ['G4', 1]],
]);
/** The whole-tone run from C - the Steps' fall into the void (no fifth, no home). */
const WHOLE_TONE = Object.freeze(['C6', 'A#5', 'G#5', 'F#5', 'E5', 'D5', 'C5', 'A#4']);

/** Control events sort before notes on the same tick (the reader's rank order). */
const RANK = { programChange: 0, controller: 0, noteOn: 1 };

/**
 * A song in the shape the player plays (formats/hmiFile.js): `write(w)` lays its notes with `w.note(voice, bar, beat,
 * beats, name, velocity)` and `w.hit(key, bar, beat, velocity)`; every voice gets its program, level and place at tick
 * 0. Written as whole bars, it loops on its bar line (`seamless` - the gate's AUDIT WB D4).
 */
function makeSong(name, bpm, bars, write, level, press) {
  const events = [];
  const length = bars * 4 * SCORE_TPQ;
  // a note laid past the last bar (the silver Echo's canon, two beats behind) sounds at the loop's start: the song is
  // a loop, and the canon runs on round its seam
  const tick = (bar, beat) => Math.round((bar * 4 + beat) * SCORE_TPQ) % length;
  const w = {
    note(voice, bar, beat, beats, n, velocity) {
      const note = typeof n === 'number' ? n : midiNote(n);
      events.push({ tick: tick(bar, beat), type: 'noteOn', channel: HOUR_CHANNELS[voice], note, velocity: Math.max(1, Math.min(127, Math.round(velocity))), duration: Math.max(1, Math.round(beats * SCORE_TPQ)) });
    },
    hit(key, bar, beat, velocity) { w.note('kit', bar, beat, 0.25, KIT[key], velocity); },
  };
  write(w);
  for (const [voice, [lv, pan]] of Object.entries(MIX)) {
    const channel = HOUR_CHANNELS[voice];
    events.push({ tick: 0, type: 'programChange', channel, program: HOUR_PROGRAMS[voice] });
    events.push({ tick: 0, type: 'controller', channel, controller: 7, value: lv });
    events.push({ tick: 0, type: 'controller', channel, controller: 10, value: pan });
  }
  events.push({ tick: 0, type: 'controller', channel: HOUR_CHANNELS.kit, controller: 7, value: KIT_LEVEL });
  events.sort((a, b) => a.tick - b.tick || RANK[a.type] - RANK[b.type]);
  return { name, press, beatsPerMinute: bpm, secondsPerTick: 60 / (bpm * SCORE_TPQ), events, durationTicks: length, seamless: true, level };
}

/** A theme's eight bars from `bar0` over `voice`, shifted `octave` octaves, each note `stretch` times its length (two:
 *  a bar of it over two of the song's), `delay` beats late (the silver Echo's canon). */
function themeBars(w, bar0, theme, voice, velocity, { octave = 0, stretch = 1, delay = 0 } = {}) {
  theme.forEach((notes, b) => {
    let beat = 0;
    for (const [n, beats] of notes) {
      const at = (b * 4 + beat) * stretch + delay;
      w.note(voice, bar0 + Math.floor(at / 4), at % 4, beats * stretch * 0.92, midiNote(n) + 12 * octave, velocity + (beat === 0 ? 10 : 0));
      beat += beats;
    }
  });
}

/** A change of the chime on `voice` - a note a beat through `bar`. */
function chimeBar(w, bar, change, voice, velocity, { octave = 0, beats = 1 } = {}) {
  change.forEach((n, i) => w.note(voice, bar, i * beats, beats * 0.95, midiNote(n) + 12 * octave, velocity - i * 3));
}

/** The escapement under a chord for one bar: its eighths, or sixteenths (`fast`) - the swing of the root against its
 *  fifth, the bar's first and each half's first accented. */
function escapement(w, bar, chord, { fast = false, vel = 1 } = {}) {
  const c = CHORDS[chord].clock;
  if (fast) for (let s = 0; s < 16; s++) w.note('clock', bar, s * 0.25, 0.2, c[s % 8], (s % 8 === 0 ? 100 : s % 4 === 0 ? 88 : 72) * vel);
  else c.forEach((n, i) => w.note('clock', bar, i * 0.5, 0.42, n, (i === 0 ? 98 : i === 4 ? 88 : 74) * vel));
}

/** The chord's floor for one bar: its bass, its pad, and - asked for - its strings and its choir. */
function floorBar(w, bar, chord, { strings = false, choir = false, organ = 1, bass2 = true, vel = 1, beats = 4 } = {}) {
  const c = CHORDS[chord];
  w.note('bass', bar, 0, bass2 ? 1.8 : beats * 0.95, c.bass, 104 * vel);
  if (bass2) w.note('bass', bar, 2, 1.8, c.bass, 96 * vel);
  if (organ > 0) for (const n of c.pad) w.note('organ', bar, 0, beats, n, 80 * organ);
  if (strings) for (const n of c.str) w.note('strings', bar, 0, beats, n, 90 * vel);
  if (choir) for (const n of c.choir) w.note('choir', bar, 0, beats, n, 96 * vel);
}

/** The clock's woods: the tick on the one and the three, the tock on the two and the four. */
function tickTock(w, bar, velocity) {
  for (let b = 0; b < 4; b++) w.hit(b % 2 === 0 ? 'tick' : 'tock', bar, b, velocity - (b % 2) * 8);
}

/** HOURHOLW - the Hollow: the Remnant's progression at half speed, the organ's pedal, the tick and the tock, a change
 *  of the broken chime on the bells at each section, the harp in its second half; the theme slowed on the horn. */
function hollow() {
  return makeSong(HOUR_SONGS.hollow, 84, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = HOUR_A[Math.floor(bar / 2) % 8];
      floorBar(w, bar, chord, { strings: bar >= 8, choir: bar >= 24, organ: 0.9, bass2: false, vel: 0.85 });
      tickTock(w, bar, 70);
      if (bar % 2 === 0) w.hit('surdo', bar, 0, 84);
      if (bar % 8 === 0) chimeBar(w, bar, HOUR_CHIME[(bar / 8) % 4], 'bells', 92, { octave: -1 });
      if (bar >= 16) CHORDS[chord].arp.forEach((n, i) => w.note('harp', bar, i * 0.5, 0.45, n, i === 0 ? 82 : 66));
      else if (bar % 2 === 1) for (const [b, i] of [[0, 0], [1.5, 2], [3, 4]]) w.note('clock', bar, b, 0.4, CHORDS[chord].clock[i], 64);
      if (bar % 4 === 3) w.note('timpani', bar, 3, 0.9, CHORDS[chord].timp, 86);
    }
    themeBars(w, 16, THEME_R1, 'horn', 92, { stretch: 2 });
  }, HOUR_LEVEL.hollow, HOUR_PRESS.hollow);
}

/** HOURHALL - the Orrery: the escapement and the harp under the music box's chime and its answer; the claves ticking,
 *  the strings from the ninth bar, the choir from the seventeenth, the theme doubled on the celesta's octave above in
 *  the last eight. */
function hall() {
  return makeSong(HOUR_SONGS.hall, 96, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = HALL[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { strings: bar >= 8, choir: bar >= 16, organ: 0.8, vel: 0.9 });
      escapement(w, bar, chord, { vel: 0.85 });
      if (bar >= 8) c.arp.forEach((n, i) => w.note('harp', bar, i * 0.5, 0.45, n, i % 4 === 0 ? 80 : 64));
      for (let b = 0; b < 4; b++) w.hit('claves', bar, b, b === 0 ? 74 : 60);
      if (bar % 8 === 0) { w.hit('triangle', bar, 0, 70); w.note('bells', bar, 0, 4, 'C4', 84); }
      if (bar % 8 === 3) w.note('bells', bar, 3, 1, 'F#4', 80);   // the broken hour, struck where it breaks
      if (bar % 4 === 3) for (let i = 0; i < 4; i++) w.note('pizz', bar, 2 + i * 0.5, 0.4, c.arp[i * 2], 78);
    }
    themeBars(w, 0, THEME_HALL, 'chime', 100);
    themeBars(w, 8, THEME_HALL, 'chime', 104);
    themeBars(w, 16, THEME_HALL, 'chime', 100);
    themeBars(w, 16, THEME_HALL, 'strings', 78, { octave: -1 });
    themeBars(w, 24, THEME_HALL, 'chime', 106);
    themeBars(w, 24, THEME_HALL, 'horn', 88, { octave: -1 });
  }, HOUR_LEVEL.hall, HOUR_PRESS.hall);
}

/** HOURSTEP - the Unmoored Steps: a heartbeat on the timpani and the surdo, the escapement in eighths then
 *  sixteenths, the horn's long line, the music box's whole-tone fall into each fourth bar, the woods' tick. */
function steps() {
  return makeSong(HOUR_SONGS.steps, 120, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = STEPS[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { strings: true, choir: bar >= 16, organ: 0.7 });
      escapement(w, bar, chord, { fast: bar >= 16 });
      w.note('timpani', bar, 0, 0.6, c.timp, 108);
      w.note('timpani', bar, 0.75, 0.5, c.timp, 92);
      w.hit('surdo', bar, 0, 100);
      w.hit('tom', bar, 2, 84);
      tickTock(w, bar, 78);
      if (bar >= 16) for (let b = 0; b < 4; b++) w.hit('claves', bar, b + 0.5, 64);
      if (bar % 4 === 3) WHOLE_TONE.forEach((n, i) => w.note('chime', bar, 2 + i * 0.25, 0.24, n, 96 - i * 4));
      if (bar % 4 === 0) { for (const n of c.stab) w.note('brass', bar, 0, 0.9, n, 100); w.hit('crash', bar, 0, 84); }
      if (bar % 8 === 7) ['lowMidTom', 'tom', 'highFloorTom', 'lowTom'].forEach((k, i) => w.hit(k, bar, 3 + i * 0.25, 88 + i * 5));
    }
    themeBars(w, 0, THEME_STEPS, 'horn', 98);
    themeBars(w, 8, THEME_STEPS, 'horn', 104);
    themeBars(w, 8, THEME_STEPS, 'strings', 80, { octave: 1 });
    themeBars(w, 16, THEME_STEPS, 'brass', 108);
    themeBars(w, 24, THEME_STEPS, 'brass', 112);
    themeBars(w, 24, THEME_STEPS, 'choir', 96);
  }, HOUR_LEVEL.steps, HOUR_PRESS.steps);
}

/** The war's own drums under one bar: `full` time or half, the gears' ride bell on the offbeats when `gears`, a fill
 *  into every fourth bar. */
function warKit(w, bar, { full = false, every = false, gears = false, racing = false } = {}) {
  w.hit('surdo', bar, 0, 106);
  if (every) for (let b = 0; b < 4; b++) w.hit('kick', bar, b, b === 0 ? 112 : 98);
  else for (const b of full ? [0, 0.75, 1.5, 2, 2.75, 3.5] : [0, 0.75, 1.5]) w.hit('kick', bar, b, b === 0 ? 110 : 94);
  for (const b of full || every ? [1, 3] : [2]) w.hit('snare', bar, b, 108);
  tickTock(w, bar, 84);
  if (gears) for (let b = 0; b < 4; b++) w.hit('rideBell', bar, b + 0.5, 70);
  if (racing) for (let s = 0; s < 16; s++) w.hit('claves', bar, s * 0.25, s % 4 === 0 ? 80 : 60);
  if (bar % 4 === 3) ['hiMidTom', 'lowMidTom', 'tom', 'highFloorTom', 'lowTom'].forEach((k, i) => w.hit(k, bar, 2.75 + i * 0.25, 88 + i * 5));
  if (bar % 4 === 0) w.hit('crash', bar, 0, 96);
}

/** HOURWAR1 - the Remnant wakes: the escapement in eighths, then sixteenths into every fourth bar, the brass stabs,
 *  the theme on the brass from the ninth bar, then the horns and the choir; a change of the broken chime on the
 *  bells each section; the kit in half time. */
function war1() {
  return makeSong(HOUR_SONGS.war1, 136, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = HOUR_A[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { strings: true, choir: bar >= 16 });
      escapement(w, bar, chord, { fast: bar % 4 === 3 || bar >= 24 });
      w.note('timpani', bar, 0, 1, c.timp, 110);
      w.note('timpani', bar, 1.5, 0.5, c.timp, 94);
      if (bar < 8 || bar % 2 === 0) for (const n of c.stab) { w.note('brass', bar, 0, 0.9, n, 112); w.note('brass', bar, 1.5, 0.45, n, 98); }
      if (bar % 4 === 0) for (const n of c.stab) w.note('hit', bar, 0, 1, n, 102);
      if (bar % 8 === 0) chimeBar(w, bar, HOUR_CHIME[(bar / 8) % 4], 'bells', 96, { octave: -1 });
      warKit(w, bar, { gears: bar >= 16 });
    }
    themeBars(w, 8, THEME_R1, 'brass', 112);
    themeBars(w, 16, THEME_R1, 'brass', 116);
    themeBars(w, 16, THEME_R1, 'horn', 100, { octave: 1 });
    themeBars(w, 24, THEME_R1, 'brass', 120);
    themeBars(w, 24, THEME_R1, 'horn', 106);
    themeBars(w, 24, THEME_R1, 'choir', 100);
  }, HOUR_LEVEL.war1, HOUR_PRESS.war1);
}

/** HOURWAR2 - the Dragon Break: two Echoes' themes - gold on the brass, silver on the strings two beats behind and an
 *  octave down - over the escapement driving the second half of every bar; the bells struck in pairs (gold's and
 *  silver's); the kit in full time. */
function war2() {
  return makeSong(HOUR_SONGS.war2, 142, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = HOUR_B[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { choir: true, organ: 1.1 });
      escapement(w, bar, chord, { fast: bar % 2 === 1 });
      w.note('timpani', bar, 0, 1, c.timp, 110);
      w.note('timpani', bar, 1.5, 0.5, c.timp, 94);
      w.note('timpani', bar, 2, 1, c.timp, 104);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 102); if (bar % 2 === 1) w.note('hit', bar, 2.5, 0.5, n, 96); }
      if (bar % 4 === 0) { w.note('bells', bar, 0, 2, c.pad[0], 94); w.note('bells', bar, 0.5, 2, c.pad[1], 86); }   // gold's and silver's
      if (bar % 8 === 0) chimeBar(w, bar, HOUR_CHIME[(bar / 8) % 4], 'chime', 100);
      warKit(w, bar, { full: true, gears: true });
      if (bar % 8 === 7) w.hit('chinese', bar, 3, 96);
    }
    themeBars(w, 0, THEME_R2, 'brass', 112);
    themeBars(w, 0, THEME_R2, 'strings', 92, { octave: -1, delay: 2 });
    themeBars(w, 8, THEME_R2, 'brass', 116);
    themeBars(w, 8, THEME_R2, 'strings', 96, { octave: -1, delay: 2 });
    themeBars(w, 16, THEME_R1, 'brass', 114);
    themeBars(w, 16, THEME_R1, 'horn', 102, { octave: 1, delay: 2 });
    themeBars(w, 24, THEME_R2, 'brass', 120);
    themeBars(w, 24, THEME_R2, 'horn', 104, { delay: 2 });
    themeBars(w, 24, THEME_R2, 'choir', 96, { octave: -1 });
  }, HOUR_LEVEL.war2, HOUR_PRESS.war2);
}

/** HOURWAR3 - the Last Moment: the escapement in sixteenths through every bar, the claves racing, the kick on every
 *  beat, the choir chanting the beat, the theme in eighths over it all, the broken chime tolled on the bells every
 *  fourth bar. */
function war3() {
  return makeSong(HOUR_SONGS.war3, 152, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = HOUR_C[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { strings: true, organ: 1.2, vel: 1.05 });
      escapement(w, bar, chord, { fast: true, vel: 1.05 });
      for (let b = 0; b < 4; b++) for (const n of c.choir) w.note('choir', bar, b, 0.9, n, b === 0 ? 106 : 92);
      for (let i = 0; i < 8; i++) w.note('timpani', bar, i * 0.5, 0.4, i % 4 === 3 ? 'G2' : c.timp, i === 0 ? 110 : 96);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 104); w.note('hit', bar, 2.5, 0.5, n, 98); }
      if (bar % 4 === 0) chimeBar(w, bar, HOUR_CHIME[(bar / 4) % 4], 'bells', 98, { octave: -1 });
      warKit(w, bar, { every: true, racing: true });
      if (bar % 2 === 0) w.hit('crash', bar, 0, 96);
    }
    themeBars(w, 0, THEME_R3, 'brass', 114, { octave: -1 });
    themeBars(w, 8, THEME_R3, 'brass', 118, { octave: -1 });
    themeBars(w, 8, THEME_R3, 'strings', 96);
    themeBars(w, 16, THEME_R1, 'brass', 116);
    themeBars(w, 16, THEME_R1, 'horn', 104, { octave: 1 });
    themeBars(w, 24, THEME_R3, 'brass', 122, { octave: -1 });
    themeBars(w, 24, THEME_R3, 'horn', 106, { octave: -1 });
    themeBars(w, 24, THEME_R3, 'strings', 100);
  }, HOUR_LEVEL.war3, HOUR_PRESS.war3);
}

/** HOURLAST - the Hour ends: C minor and the Neapolitan a bar each, the bell tolling every bar - counting - the broken
 *  change hammered on the brass in octaves, the escapement and the claves in sixteenths, the kick on every beat. */
function last() {
  return makeSong(HOUR_SONGS.last, 160, 16, (w) => {
    for (let bar = 0; bar < 16; bar++) {
      const chord = LAST[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { strings: true, choir: true, organ: 1.2, vel: 1.05 });
      escapement(w, bar, chord, { fast: true, vel: 1.1 });
      w.note('bells', bar, 0, 3.5, bar % 8 >= 6 ? 'F#4' : 'C4', 100 + Math.min(20, bar));   // the toll, counting
      for (let i = 0; i < 8; i++) w.note('timpani', bar, i * 0.5, 0.4, c.timp, i === 0 ? 114 : 96);
      if (bar % 2 === 0) { chimeBar(w, bar, HOUR_CHIME[3], 'brass', 118, { octave: -1 }); chimeBar(w, bar, HOUR_CHIME[3], 'horn', 108, { octave: -2 }); }
      else for (const n of c.stab) { w.note('brass', bar, 0, 0.9, n, 114); w.note('brass', bar, 2, 0.9, n, 108); w.note('hit', bar, 0, 1, n, 106); }
      warKit(w, bar, { every: true, racing: true });
      w.hit('crash', bar, 0, bar % 2 === 0 ? 100 : 86);
    }
  }, HOUR_LEVEL.last, HOUR_PRESS.last);
}

/** HOURFELL - it falls: a timpani roll into C MAJOR, the mended chime on the brass and the strings over the bells'
 *  four quarters, the choir; five bars, then seven bars' quiet (the law moves on long before it could come round). */
function fell() {
  return makeSong(HOUR_SONGS.fell, 88, 12, (w) => {
    for (let i = 0; i < 16; i++) w.note('timpani', 0, i * 0.25, 0.24, 'C2', 56 + i * 4);   // the roll, rising
    for (const n of ['G3', 'C4', 'E4']) w.note('choir', 0, 2, 2, n, 82);
    const C = CHORDS.C;
    for (const n of C.stab) w.note('hit', 1, 0, 1.5, n, 112);
    w.note('timpani', 1, 0, 1, 'C2', 112);
    w.hit('crash', 1, 0, 104); w.hit('kick', 1, 0, 112); w.hit('surdo', 1, 0, 104);
    // the mended chime: the brass its first and fourth changes, the strings an octave over them
    for (const [bar, change] of [[1, HOUR_CHIME_MENDED[0]], [2, HOUR_CHIME_MENDED[3]]]) {
      chimeBar(w, bar, change, 'brass', 122, { octave: -1 });
      chimeBar(w, bar, change, 'strings', 100);
    }
    w.note('brass', 3, 0, 4, 'C4', 122); w.note('horn', 3, 0, 4, 'G3', 112);
    for (let q = 0; q < 4; q++) chimeBar(w, 1 + q, HOUR_CHIME_MENDED[q], 'bells', 100 - q * 2);   // the four quarters, whole
    for (const n of C.pad) { w.note('organ', 1, 0, 16, n, 94); w.note('strings', 3, 0, 6, midiNote(n) + 12, 100); }
    for (const n of C.choir) w.note('choir', 1, 0, 16, n, 108);
    w.note('bass', 1, 0, 16, 'C2', 118);
    C.arp.forEach((n, i) => { w.note('harp', 3, i * 0.5, 0.45, n, 86); w.note('harp', 4, i * 0.5, 0.45, midiNote(n) + 12, 80); });
    w.note('timpani', 3, 0, 1, 'C2', 116);
    for (let i = 0; i < 8; i++) w.note('timpani', 4, 2 + i * 0.25, 0.24, 'C2', 76 + i * 5);
    w.note('timpani', 5, 0, 1, 'C2', 112); w.hit('crash', 5, 0, 102); w.hit('kick', 5, 0, 104);
    for (const n of C.stab) w.note('hit', 5, 0, 1, n, 108);
    w.note('bells', 5, 0, 2, 'C5', 104);   // the hour, struck at last
  }, HOUR_LEVEL.fell, HOUR_PRESS.fell);
}

/** HOURGONE - the collapse: C major and A minor, the mended chime on the music box a change a bar through the first
 *  eight, the harp and the strings, the horn's farewell, the bell tolled each fourth bar, the tick and the tock. */
function gone() {
  return makeSong(HOUR_SONGS.gone, 72, 24, (w) => {
    for (let bar = 0; bar < 24; bar++) {
      const chord = GONE[bar % 8], c = CHORDS[chord];
      floorBar(w, bar, chord, { strings: true, choir: bar >= 16, organ: 0.75, bass2: false, vel: 0.85 });
      c.arp.forEach((n, i) => w.note('harp', bar, i * 0.5, 0.45, n, i === 0 ? 84 : 66));
      tickTock(w, bar, 66);
      if (bar < 8) chimeBar(w, bar, HOUR_CHIME_MENDED[bar % 4], 'chime', 96);
      if (bar % 4 === 0) w.note('bells', bar, 0, 4, bar % 8 === 0 ? 'C4' : 'G3', 86);
      if (bar % 4 === 3) w.note('timpani', bar, 3, 0.9, c.timp, 80);
    }
    themeBars(w, 8, THEME_GONE, 'horn', 98);
    themeBars(w, 16, THEME_GONE, 'horn', 102);
    themeBars(w, 16, THEME_GONE, 'chime', 88, { octave: 1 });
  }, HOUR_LEVEL.gone, HOUR_PRESS.gone);
}

let _songs = null;
/** The nine songs, made once (pure: the same notes every time). */
export function sdScoreSongs() {
  return (_songs ??= Object.freeze({ hollow: hollow(), hall: hall(), steps: steps(), war1: war1(), war2: war2(), war3: war3(), last: last(), fell: fell(), gone: gone() }));
}

/**
 * WHERE I STAND IN THE HOUR, by the realm's frame (net/sdBrain.js): near the arena as its bar is (ui/sdRemnantBar.js
 * SD_BAR_NEAR_M), on the Steps from the first step's near edge on, else the hall (the Threshold, the Orrery, the
 * bridge). Pure.
 * @returns {'arena' | 'steps' | 'hall' | null}
 */
export function sdScorePlace(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (Math.hypot(x - SD_ARENA.x, z - SD_ARENA.z) <= SD_ARENA.r + SD_BAR_NEAR_M) return 'arena';
  return z >= SD_FIRST_STEP.z - SD_FIRST_STEP.r ? 'steps' : 'hall';
}

/**
 * THE LAW: what plays where I stand (`place` - 'hollow', or sdScorePlace's in the Hour; null for neither) for the
 * fight this page holds (`s`, net/sdFightLink.js - its clock's `now`), and whether the Hollow collapses (`collapsing`,
 * the hub's record fell) - an HOUR_SONGS name, SD_SCORE_SILENCE, or null (the director stands).
 */
export function hourScoreFor(place, s, now, collapsing = false) {
  if (!place) return null;
  const fight = s && s.fi > 0 ? s : null;
  if (fight?.fell) return now - fight.fell.at < SD_SCORE_STING_MS ? HOUR_SONGS.fell : HOUR_SONGS.gone;
  if (collapsing) return HOUR_SONGS.gone;
  if (place === 'hollow') return HOUR_SONGS.hollow;
  if (place === 'hall') return HOUR_SONGS.hall;
  if (place !== 'arena' || !fight) return HOUR_SONGS.steps;
  if (fight.lost) return SD_SCORE_SILENCE;
  if (fight.ended > 0 || (Number.isFinite(fight.ends) && now >= fight.ends)) return SD_SCORE_SILENCE;   // the End: nothing over it
  if (Number.isFinite(fight.ends) && fight.ends - now <= SD_SCORE_ENDS_WARN_MS) return HOUR_SONGS.last;
  return fight.ph >= 3 ? HOUR_SONGS.war3 : fight.ph === 2 ? HOUR_SONGS.war2 : HOUR_SONGS.war1;
}

/**
 * THE SCORE AS ONE PAGE HEARS IT - hourScoreFor, but the fall's song, once begun here, plays WHOLE: SD_SCORE_STING_MS
 * from its own first note (the gate's AUDIT WB D2 and WBX W3 - a word of the kill that came late never cuts it short),
 * then the collapse's. Each fall once: a fight of another Hour starts fresh.
 */
export function createHourScore() {
  let stingAt = null, fallKey = null;
  return {
    want(place, s, now, collapsing = false) {
      const law = hourScoreFor(place, s, now, collapsing);
      const fell = law !== null && s?.fi > 0 && s.fell ? `${s.fi}:${s.fell.at}` : null;
      if (fell === null) { stingAt = null; fallKey = null; return law; }
      if (fell !== fallKey) { fallKey = fell; stingAt = law === HOUR_SONGS.fell ? now + SCORE_STING_LEAD_MS : -Infinity; }   // a fall heard late: its collapse
      return now - stingAt < SD_SCORE_STING_MS ? HOUR_SONGS.fell : HOUR_SONGS.gone;
    },
  };
}
