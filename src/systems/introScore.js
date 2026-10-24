// @ts-check
// INTRO3 (2026-10-14, Mac: "With the main menu music, is there anyway to recreate it using the sound system daggerfall's
// music uses", then "you do it and it's for both"): THE MAIN THEME, WRITTEN AS NOTES - the film's score and the menu's
// music, played by the game's own song player and FM voice bank (systems/song/songPlayer.js, gmSynth.js) as every MIDI.BSA
// song is, in place of the recorded master (INTRO2's assets/intro/theme.mp3) that played through a decoder of its own.
//
// MADE THE WAY THE WARDEN'S SCORE IS (systems/gate/gateScore.js - the precedent): a song in the shape an HMI song decodes to
// (formats/hmiFile.js - tick-ordered `events`, one tempo, notes that carry their own durations), so it sounds like the
// rest of the soundtrack, follows MusicVolume and the mute by the same master, and loops on its bar line.
//
// TRANSCRIBED, NOT INVENTED. The notes are the recording's, read off it bar by bar (2026-10-14): its stems split
// (htdemucs), each transcribed (basic-pitch), its beats tracked, its harmony read from beat-synchronous chroma and the
// bass stem, and every bar's melody checked against its chord. What the recording is, as this file plays it:
//   G minor; 129 BPM through the opening, 127 after it (one tempo here, set by the film's two landmarks - below).
//   0.5 s   INTRO - four bars over a low G, the pads swelling from nothing (Gm, Cm over G, Gm7, G).
//   8.0 s   RISE - E-flat, F: a line climbing E-flat, G, A, B-flat to C; a timpani roll and a cymbal swell.
//  11.712  THE CLOUD BREAK - C major, held four bars (the Dorian IV, the only major sonority the opening has).
//  19.168  THE IMPACT - G minor on the beat the logo lands on; the horn's call G, A, B-flat - C, B-flat, A, G.
//  22.9 s  THE THEME, four times between its interludes: (G A) B-flat A B-flat - C F D - E-flat C A - B-flat C B-flat A F
//          - G, over i - VII - iv - v - VI - VII; an answer on D, A-flat and C minor; a build to D6 at 103 s; a breakdown
//          on a bare G at 118 s; the dominant, D major, at 132 s; the last statement and the close on G at 159 s.
// The taiko-like drums are cinematic - low drums in a 3-3-2, no backbeat but the big sections' - and the low strings
// pulse the root under all of it, which is how the recording drives.
//
// THE TEMPO IS THE FILM'S. The intro is cut to two landmarks of the recording (ui/intro/introCue.js): the cloud break at
// CLOUD_REVEAL_TIME and the logo's landing at TITLE_IMPACT_TIME, four bars apart and both downbeats. The song's one tempo
// is the one that puts those two bar lines exactly there (128.76 BPM, a hair over the recording's opening), after a
// lead of INTRO_LEAD_TICKS of quiet - so the film's cue sheet stands as it was, and the score answers to it.
//
// INTRO3b (2026-10-23, the owner: "I want to make this music better. Currently its not really good and too flat. I
// really need you to put work into this and make it truely amazing"). MEASURED FIRST, against the recording's first
// 27 s: the dry render's presence (2-6 kHz) stood 12 dB under the recording's share and its air (6 kHz up) 14 dB under,
// its spectral centroid 265 Hz to the recording's 552, its spectral flatness 0.003 to 0.090 (a few pure tones, not an
// orchestra) - and it was all but mono, L/R correlation 0.985 to the recording's 0.33. Flat, literally: dull, thin and
// centred. So, with EG-ROAR's tools (systems/song/songPlayer.js songVoices, songKit): EVERY SECTION IS AN ENSEMBLE
// (INTRO_VOICES - unison copies cents apart, laid either side of the section's place, the FM index higher and slower to
// settle so the top of the band is there), THE KIT HAS BEATERS AND SKINS (INTRO_KIT - the taiko long with its click,
// the snare a crack over a skin, the crash two seconds long), a HALO of tremolo strings holds the chord's top an octave
// over the choir where the band opens out, the LOW BRASS braams under every brass bar and section hit, the timpani
// answers on three, the cellos drive every step of the pulse where the drums are fullest, a snare roll climbs into the
// build's top and the last statement, and a CRESCENDO leads the bed into every landmark and section turn. THE HALL is the
// session's (systems/introTheme.js introSpace): a concert hall's impulse under the player's master, the way the engine's
// reverb zones are built. The notes are still the recording's: the melody and the harmony tables did not move.
//
// Not a DFU member. Ledger A (INTRO3).

import { midiNote } from './gate/gateScore.js';
import { CLOUD_REVEAL_TIME, TITLE_IMPACT_TIME } from '../ui/intro/introCue.js';

/** The song's name - its own, beside MIDI.BSA's (no record there is called this). */
export const INTRO_SONG = 'DFOTHEME.HMI';
/** The HMI clock (formats/hmiFile.js HMI_TICKS_PER_QUARTER): ticks a quarter note, and a 4/4 bar. */
export const INTRO_SCORE_TPQ = 60;
const BAR = 4 * INTRO_SCORE_TPQ;
/** The recording's bars, counted as the transcription counts them: bar 0 is the E-flat at 8.0 s, the four bars of the
 *  opening are -4 to -1, the last bar is 80 (its G at 159 s), and two bars of ring follow it. */
export const FIRST_BAR = -4;
export const LAST_BAR = 82;
/** The two bars the film is cut to (ui/intro/introCue.js): the cloud break and the logo's landing. */
export const CLOUD_BAR = 2;
export const IMPACT_BAR = 6;
/** The last bar played: the close's G, left to ring to LAST_BAR. */
const CLOSE_BAR = 80;
/** One tempo, from the landmarks: four bars between them, to the tick. */
export const INTRO_SECONDS_PER_TICK = (TITLE_IMPACT_TIME - CLOUD_REVEAL_TIME) / ((IMPACT_BAR - CLOUD_BAR) * BAR);
/** The quiet before the first bar - whatever puts the cloud break's bar line on CLOUD_REVEAL_TIME (68 ticks, 0.53 s:
 *  the recording's first sound is at 0.59 s). */
export const INTRO_LEAD_TICKS = Math.round(CLOUD_REVEAL_TIME / INTRO_SECONDS_PER_TICK) - (CLOUD_BAR - FIRST_BAR) * BAR;
/** Where a bar's beat falls, in ticks from the song's start. */
export const introTick = (bar, beat = 0) => INTRO_LEAD_TICKS + Math.round(((bar - FIRST_BAR) * 4 + beat) * INTRO_SCORE_TPQ);
/** ...and in seconds from it. */
export const introSeconds = (bar, beat = 0) => introTick(bar, beat) * INTRO_SECONDS_PER_TICK;

/** GM programs (gmSynth.js FM bank) and channels: one voice each, the kit on GM's channel 9. The horn carries the theme;
 *  the violins double it an octave up where the recording opens out; the riser into each landmark is a suspended
 *  cymbal's roll on the kit (INTRO3c: it was the bank's reverse cymbal, 119, then the Spire's FM shimmer - a whine). */
export const INTRO_PROGRAMS = Object.freeze({
  horn: 60, violins: 40, strings: 48, choir: 52, ostinato: 32, cellos: 42, contrabass: 43, brass: 61,
  timpani: 47, harp: 46, bells: 14, pad: 89, hit: 55, halo: 44,
});
export const INTRO_CHANNELS = Object.freeze({
  horn: 0, violins: 1, strings: 2, choir: 3, ostinato: 4, cellos: 5, contrabass: 6, brass: 7,
  timpani: 8, kit: 9, harp: 11, bells: 12, pad: 13, hit: 14, halo: 15,
});
/** Each voice's level (CC7) and place (CC10, 64 the middle). INTRO3b: the sections stand further apart - the violins
 *  and the choir right, the strings, the cellos and the harp left, the bells far right - and each is spread from its
 *  place by its voice (INTRO_VOICES). */
const MIX = Object.freeze({
  horn: [118, 58], violins: [96, 82], strings: [100, 40], choir: [104, 88], ostinato: [100, 64], cellos: [92, 48],
  contrabass: [104, 64], brass: [108, 72], timpani: [110, 64], harp: [84, 30], bells: [86, 92],
  pad: [90, 64], hit: [100, 64], halo: [80, 64],
});
const KIT_LEVEL = 112;

/** INTRO3c: THE TONE - the whole mix's shape, matched to the recording's. Measured over the film's 27 s at equal loudness,
 *  third-octave by third-octave, the bowed render stood 6 dB short of the recording at 100 Hz, 5 dB over at 250 (the
 *  bed's and the horn's fundamentals stack there), 4 short at 500, 3 to 6 short from 2 to 5 kHz and 3 to 5 short above;
 *  this is that difference, applied once to the sum (songPlayer.js songTone, between the fader and the master). */
export const INTRO_TONE = Object.freeze({ low: [60, -3], bands: [[100, 2, 1.2], [250, -4, 1.2], [500, 3, 1.4], [3150, 4, 0.9]], high: [5000, 4] });
/** The song at the player's own level (systems/song/songPlayer.js `song.level`) through a press (songPress) - lighter than
 *  the gate score's (3:1 from -14 dB, a ceiling a decibel under the clip), its drive after it, so the theme stands as
 *  loud as the recording it replaces (about -22 dBFS as the intro played it at MusicVolume 0.5) and keeps the
 *  recording's rise and fall: the swell from nothing, the dip before the impact, the breakdown at 118 s. INTRO3b: the
 *  press lets a drum's first 12 ms through (EG-ROAR's lesson - at 3 ms it clamped every taiko and kick to the pads'
 *  level). Measured through the real player, second by second against the recording: tools/introScoreProbe.mjs. */
export const INTRO_LEVEL = 1;
export const INTRO_PRESS = Object.freeze({ threshold: -14, knee: 12, ratio: 3, attack: 0.012, release: 0.25, ceiling: -1, out: 2 });
/** GM kit keys (gmSynth.js DRUMS). */
const KIT = Object.freeze({ kick: 36, snare: 38, clap: 39, lowTom: 41, floorTom: 43, tom: 45, midTom: 47, crash: 49, ride: 51, splash: 55, surdo: 87 });

/** INTRO3b: THE VOICES - each section's own instrument over the FM bank's one pair a note (systems/song/songPlayer.js
 *  songVoices, EG-ROAR). The bowed sections are ensembles: `unison` copies `cents` apart, laid `spread` either side of
 *  their place, their FM index higher than the bank's and slower to settle (idxDecay) so the top of the band is there
 *  through the note, not only at its attack. The choir and the pad modulate at twice the note (odd harmonics - the hollow
 *  "oo" a voice has that a string has not), the brass bites (index 5), the ostinato is a spiccato, the timpani carries a
 *  sub, and the halo is four tremolo violins at the edges (INTRO3c: the swell, the Spire's inharmonic shimmer, is gone - a cymbal's roll). The
 *  contrabass carries no sub: at G1 its octave under is 24 Hz, under the floor and heard by nothing but the press. */
export const INTRO_VOICES = Object.freeze({
  horn: Object.freeze({ attack: 0.05, index: 3, idxDecay: 1.1, idxFloor: 0.5, release: 0.3, unison: 2, cents: 3, spread: 0.2, vibrato: 5, vibRate: 4.8, noise: 0.06, body: [[450, 6, 1.2]], air: -3 }),
  violins: Object.freeze({ saw: 1, cutoff: 10, cutQ: 0.9, attack: 0.12, release: 0.6, unison: 3, cents: 6, spread: 0.55, vibrato: 13, vibRate: 5.6, arc: 0.4, sway: 0.25, swayRate: 0.4, noise: 0.08, body: [[550, 5, 1], [1300, 2, 1.5], [3000, 8, 1]], air: -4, ensemble: 0.45, ensembleRate: 0.8, ensembleMs: 10 }),
  strings: Object.freeze({ saw: 1, cutoff: 12, cutQ: 0.9, attack: 0.18, release: 0.8, gain: 1.1, unison: 3, cents: 6, spread: 0.6, vibrato: 11, vibRate: 5.2, arc: 0.5, sway: 0.3, swayRate: 0.35, noise: 0.08, body: [[450, 7, 0.8], [1000, 2, 1.4], [2700, 8, 1]], air: -4, ensemble: 0.45, ensembleRate: 0.7, ensembleMs: 12 }),
  choir: Object.freeze({ saw: 1, cutoff: 6, cutQ: 0.7, attack: 0.35, release: 1.1, gain: 1.1, unison: 3, cents: 8, spread: 0.5, vibrato: 14, vibRate: 5, arc: 0.5, sway: 0.3, swayRate: 0.2, body: [[650, 7, 2.5], [1050, 5, 3], [2500, 6, 3]], air: -10, ensemble: 0.5, ensembleRate: 0.5, ensembleMs: 18 }),
  ostinato: Object.freeze({ attack: 0.008, decay: 0.14, sustain: 0.45, release: 0.08, index: 4.2, idxDecay: 0.18, unison: 2, cents: 6, spread: 0.25 }),
  cellos: Object.freeze({ saw: 1, cutoff: 10, attack: 0.02, unison: 2, cents: 5, spread: 0.3, vibrato: 8, vibRate: 4.9, noise: 0.1, body: [[220, 6, 0.9], [600, 3, 1.3], [1800, 6, 1.2]], air: -6, ensemble: 0.35, ensembleRate: 0.6, ensembleMs: 14 }),
  contrabass: Object.freeze({ saw: 1, cutoff: 14, attack: 0.05, release: 0.45, gain: 1, unison: 2, cents: 4, spread: 0.15, vibrato: 5, vibRate: 4.4, arc: 1, sway: 0.2, swayRate: 0.15, body: [[100, 4, 0.7], [200, 4, 1], [400, 4, 1.2]], air: -10, ensemble: 0.25, ensembleRate: 0.5, ensembleMs: 16 }),
  brass: Object.freeze({ attack: 0.035, index: 5, idxDecay: 0.8, idxFloor: 0.35, release: 0.3, unison: 3, cents: 6, spread: 0.4, noise: 0.06 }),
  timpani: Object.freeze({ decay: 0.9, release: 0.5, gain: 1.2, sub: 0.2 }),
  harp: Object.freeze({ index: 3, idxDecay: 0.4, unison: 2, cents: 5, spread: 0.35 }),
  bells: Object.freeze({ index: 6, idxDecay: 0.8, unison: 2, cents: 3, spread: 0.3 }),
  pad: Object.freeze({ saw: 1, cutoff: 4, attack: 0.4, release: 1.2, unison: 3, cents: 8, spread: 0.7, vibrato: 5, vibRate: 4, arc: 0.8, sway: 0.4, swayRate: 0.25, body: [[300, 5, 0.8]], air: -12, ensemble: 0.8, ensembleRate: 0.4, ensembleMs: 20 }),
  hit: Object.freeze({ index: 4.5, decay: 0.5, release: 0.35, unison: 2, cents: 15, sub: 0.35, spread: 0.4 }),
  halo: Object.freeze({ saw: 1, cutoff: 6, attack: 0.35, release: 1, gain: 0.6, unison: 3, cents: 5, spread: 0.8, vibrato: 14, vibRate: 6.1, arc: 0.5, body: [[3000, 5, 1.6]], air: -5, ensemble: 0.45, ensembleRate: 0.9, ensembleMs: 9 }),
});
// INTRO3c (2026-10-24, the owner: "I dont like the high pitch whine"; "It still has that whine. Its not natural"; "Now
// it just sounds like static. Stop band aid fixing and be as detailed as possible"): THE WHINE WAS THE MODEL. Measured
// against the recording over the opening's held chord: two-operator FM at 1:1 put the chord's 4th and 6th harmonics as
// loud as its fundamentals with the 7th and the 9th 50 dB under them - isolated pure lines 6-12 cents wide where a
// string section has a dense series with a plateau from the 5th harmonic (-20 dB) and every partial 20-50 cents wide -
// and the render had no body (315-630 Hz, 5-7 dB short) and no presence (2-3 kHz, 8-10 short). A vibrato widened the
// lines; a breath of noise under the notes filled the gaps with hiss (the static). So the bed is BOWED
// (song/songPlayer.js INTRO3c): sawtooths - the bowed string's own waveform - under the bow's low-pass, each section
// through its body's resonances, an air shelf and a string machine's ensemble, with a vibrato, and a bite of noise at
// the start of a note at most; the horn and the brass stay FM (brass is what FM does well), the horn's index settling
// to half; the whole mix through THE TONE, the recording's third-octave curve against the render's (INTRO_TONE). After:
// the chord's harmonics 0, -10, -21, -13, -17, -18, -18, -22, -25 dB (nothing above the 3rd within 13 of the loudest),
// its partials 18-47 cents wide, the film within 3 dB of the recording's curve from 80 Hz to 10 kHz. The halo stays a
// soft shimmer out of the opening's bare bars; the risers are a suspended cymbal's roll (swellInto: the FM shimmer's
// sidebands were the whine in the build-up to the title drop); every held voice has the bow's arc and the bed sways, with
// the bass at the recording's level (a flat sawtooth pedal 7 dB over it was the hum). tools/introScoreProbe.mjs pins the
// chord's shape (chordShape), the build-up (riserShape) and the bass (bassShape) beside the width and the presence.
/** The voices by channel, as the song carries them. */
const INTRO_VOICES_BY_CHANNEL = Object.freeze(Object.fromEntries(Object.entries(INTRO_VOICES).map(([v, o]) => [INTRO_CHANNELS[/** @type {keyof typeof INTRO_CHANNELS} */ (v)], o])));
/** INTRO3b: THE KIT - each drum the theme strikes, past the bank's one sine or band of noise (systems/song/songPlayer.js
 *  songKit): the taiko (the open surdo) long and falling with its beater's click, the kick and the toms the same, the
 *  snare a crack over a skin, the crash two seconds long; INTRO3c: the ride under soft mallets, the roll's stroke (a
 *  20 ms attack, no click - a cymbal swelling, not struck). */
export const INTRO_KIT = Object.freeze({
  [KIT.kick]: Object.freeze({ hz: 50, decay: 0.42, gain: 1.4, click: 0.5 }),
  [KIT.surdo]: Object.freeze({ hz: 62, decay: 1.1, gain: 1.5, drop: 0.7, click: 0.5 }),
  [KIT.lowTom]: Object.freeze({ hz: 84, decay: 0.6, gain: 1.05, click: 0.3 }),
  [KIT.floorTom]: Object.freeze({ hz: 102, decay: 0.55, click: 0.3 }),
  [KIT.tom]: Object.freeze({ hz: 124, decay: 0.48, click: 0.3 }),
  [KIT.midTom]: Object.freeze({ hz: 152, decay: 0.42, click: 0.3 }),
  [KIT.snare]: Object.freeze({ hz: 2000, q: 0.7, decay: 0.26, gain: 0.95, body: 185 }),
  [KIT.clap]: Object.freeze({ hz: 1500, q: 0.9, decay: 0.14, gain: 0.6 }),
  [KIT.crash]: Object.freeze({ decay: 2.6, q: 0.45, gain: 1 }),
  [KIT.ride]: Object.freeze({ hz: 5500, q: 0.6, attack: 0.02, decay: 0.45, gain: 0.55 }),
  [KIT.splash]: Object.freeze({ decay: 1.1, q: 0.6, gain: 0.7 }),
});

/** The chords the recording uses: its root (the contrabass's octave), and the strings', choir's and brass's voicings. */
const CHORDS = Object.freeze({
  Gm: { root: 'G1', str: ['G3', 'Bb3', 'D4', 'G4'], choir: ['D4', 'G4', 'Bb4'], brass: ['G3', 'D4', 'G4', 'Bb4'] },
  Gsus: { root: 'G1', str: ['G3', 'C4', 'D4', 'G4'], choir: ['D4', 'G4', 'C5'], brass: ['G3', 'D4', 'G4', 'C5'] },
  GmA: { root: 'A1', str: ['G3', 'Bb3', 'D4', 'G4'], choir: ['D4', 'G4', 'Bb4'], brass: ['A2', 'D4', 'G4', 'Bb4'] },
  Gm7: { root: 'G1', str: ['F3', 'Bb3', 'D4', 'A4'], choir: ['D4', 'F4', 'Bb4'], brass: ['G3', 'D4', 'F4', 'Bb4'] },
  CmG: { root: 'G1', str: ['G3', 'C4', 'Eb4', 'G4'], choir: ['C4', 'Eb4', 'G4'], brass: ['G3', 'C4', 'Eb4', 'G4'] },
  F6: { root: 'F1', str: ['F3', 'A3', 'C4', 'D4'], choir: ['D4', 'F4', 'A4'], brass: ['F3', 'C4', 'D4', 'A4'] },
  F: { root: 'F1', str: ['F3', 'A3', 'C4', 'F4'], choir: ['C4', 'F4', 'A4'], brass: ['F3', 'C4', 'F4', 'A4'] },
  Eb: { root: 'Eb1', str: ['Eb3', 'G3', 'Bb3', 'Eb4'], choir: ['Bb3', 'Eb4', 'G4'], brass: ['Eb3', 'Bb3', 'Eb4', 'G4'] },
  Cm: { root: 'C2', str: ['C3', 'G3', 'C4', 'Eb4'], choir: ['C4', 'Eb4', 'G4'], brass: ['C3', 'G3', 'C4', 'Eb4'] },
  C: { root: 'C2', str: ['C3', 'G3', 'D4', 'E4', 'G4'], choir: ['C4', 'E4', 'G4'], brass: ['C3', 'G3', 'C4', 'E4'] },
  Dm: { root: 'D2', str: ['D3', 'A3', 'D4', 'F4'], choir: ['D4', 'F4', 'A4'], brass: ['D3', 'A3', 'D4', 'F4'] },
  D: { root: 'D2', str: ['D3', 'A3', 'D4', 'F#4'], choir: ['D4', 'F#4', 'A4'], brass: ['D3', 'A3', 'D4', 'F#4'] },
  Dsus: { root: 'D2', str: ['D3', 'A3', 'D4', 'G4'], choir: ['D4', 'G4', 'A4'], brass: ['D3', 'A3', 'D4', 'G4'] },
  Ab: { root: 'Ab1', str: ['Ab2', 'Eb3', 'Ab3', 'C4'], choir: ['C4', 'Eb4', 'Ab4'], brass: ['Ab2', 'Eb3', 'Ab3', 'C4'] },
  Bb: { root: 'Bb1', str: ['Bb2', 'F3', 'Bb3', 'D4'], choir: ['Bb3', 'D4', 'F4'], brass: ['Bb2', 'F3', 'Bb3', 'D4'] },
});

/** THE HARMONY, a bar at a time as two half bars - read off the recording (bass stem and beat-synchronous chroma). */
const HARMONY = Object.freeze({
  [-4]: ['Gm', 'Gm'], [-3]: ['CmG', 'CmG'], [-2]: ['Gm7', 'Gm7'], [-1]: ['Gm', 'Gm'],
  0: ['Eb', 'Eb'], 1: ['F', 'F'], 2: ['C', 'C'], 3: ['C', 'C'], 4: ['C', 'C'], 5: ['C', 'C'], 6: ['Gm', 'Gm'], 7: ['Gsus', 'Gm'],
  8: ['Gm', 'Gm'], 9: ['F', 'Gm'], 10: ['Cm', 'F'], 11: ['Gm', 'Dm'], 12: ['Eb', 'Eb'], 13: ['F', 'Gm'], 14: ['Gm', 'Gm'], 15: ['Gm', 'Gm'], 16: ['Gm', 'Gm'],
  17: ['D', 'Eb'], 18: ['Ab', 'Cm'], 19: ['Gm', 'F'], 20: ['Eb', 'Eb'], 21: ['F', 'F'], 22: ['F', 'F6'], 23: ['Gm', 'Gm'], 24: ['Gsus', 'Gm'],
  25: ['Gm', 'Gm'], 26: ['F', 'Gm'], 27: ['Eb', 'F'], 28: ['Gm', 'Gm'], 29: ['Eb', 'Eb'], 30: ['F', 'F'], 31: ['F', 'F6'], 32: ['Gm', 'Gm'], 33: ['Gm', 'Gm'],
  34: ['Gm', 'Gm'], 35: ['F', 'Gm'], 36: ['Eb', 'Bb'], 37: ['F', 'Gm'], 38: ['Eb', 'Cm'], 39: ['F', 'F'], 40: ['F', 'F'],
  41: ['Gm', 'Gm'], 42: ['F', 'Gm'], 43: ['Gm', 'GmA'], 44: ['Bb', 'F'], 45: ['Cm', 'Gm'], 46: ['Eb', 'F'], 47: ['Eb', 'Eb'], 48: ['D', 'D'],
  49: ['Gm', 'F'], 50: ['Gm', 'F'], 51: ['Gm', 'F'], 52: ['Eb', 'Bb'], 53: ['Cm', 'Gm'], 54: ['Eb', 'F'], 55: ['Eb', 'Eb'], 56: ['F', 'F'], 57: ['F', 'F'], 58: ['Gm', 'Gm'],
  59: ['Gm', 'Gm'], 60: ['Gm', 'Gm'], 61: ['F', 'Gm'], 62: ['Eb', 'F'], 63: ['Gm', 'Dm'], 64: ['Cm', 'Cm'], 65: ['Dsus', 'D'], 66: ['D', 'D'],
  67: ['Gm', 'Gm'], 68: ['Gsus', 'Gm'], 69: ['Gm', 'Gm'], 70: ['F', 'Gm'], 71: ['Cm', 'D'], 72: ['Gm', 'F'], 73: ['Eb', 'Eb'], 74: ['F', 'F'], 75: ['F', 'D'],
  76: ['Gm', 'Gm'], 77: ['Gm', 'Gm'], 78: ['Gm', 'Gm'], 79: ['F', 'Gm'], 80: ['Gm', 'Gm'], 81: ['Gm', 'Gm'], 82: ['Gm', 'Gm'],
});

/** THE MELODY, bar by bar: [note, beats], 'r' a rest - transcribed from the recording's lead and checked against each
 *  bar's chord. Every bar's beats sum to four (test/systems/intro3_score.test.js). */
/** @type {Readonly<Record<number, ReadonlyArray<[string, number]>>>} */
const MELODY = Object.freeze({
  // the opening's sighs, then the rise
  [-3]: [['r', 0.75], ['F4', 1], ['Eb4', 1.25], ['F4', 0.25], ['Eb4', 0.75]],
  [-2]: [['r', 1], ['D4', 1.5], ['A4', 1.5]],
  [-1]: [['r', 1.5], ['G4', 2.5]],
  0: [['r', 1], ['Eb4', 0.75], ['G4', 0.5], ['A4', 0.75], ['Bb4', 1]],
  1: [['C5', 0.75], ['C5', 0.75], ['A4', 1.5], ['C5', 0.5], ['F5', 0.5]],
  // the cloud break holds its C; the D's are the pickup to the impact
  2: [['G5', 4]],
  3: [['r', 0.75], ['C5', 0.75], ['C5', 0.5], ['C5', 2]],
  4: [['G4', 4]],
  5: [['G4', 2], ['r', 1], ['D4', 0.5], ['D4', 0.5]],
  // the impact's call
  6: [['G4', 1.5], ['A4', 0.5], ['Bb4', 2]],
  7: [['C5', 1.25], ['Bb4', 0.25], ['A4', 0.5], ['G4', 2]],
  // THE THEME
  8: [['r', 1.25], ['G4', 0.25], ['A4', 0.5], ['Bb4', 0.5], ['A4', 0.5], ['Bb4', 1]],
  9: [['C5', 0.75], ['C5', 0.25], ['F5', 1], ['D5', 1], ['D5', 0.5], ['Bb4', 0.25], ['D5', 0.25]],
  10: [['Eb5', 2], ['C5', 1], ['A4', 1]],
  11: [['Bb4', 0.75], ['Bb4', 0.5], ['C5', 0.25], ['Bb4', 0.5], ['A4', 1], ['F4', 1]],
  12: [['G4', 3], ['r', 1]],
  13: [['r', 1.25], ['F4', 0.25], ['A4', 0.5], ['G4', 2]],
  14: [['r', 1.5], ['G4', 0.25], ['A4', 0.25], ['Bb4', 0.5], ['Bb4', 0.5], ['Bb4', 0.75], ['Bb4', 0.25]],
  15: [['C5', 1], ['A4', 0.25], ['Bb4', 0.25], ['C5', 0.5], ['D5', 0.25], ['C5', 0.5], ['Bb4', 0.75], ['A4', 0.5]],
  16: [['G4', 4]],
  // its answer
  17: [['A4', 1.25], ['G4', 0.5], ['F4', 0.25], ['G4', 1], ['G4', 0.25], ['A4', 0.25], ['Bb4', 0.5]],
  18: [['C5', 0.75], ['C5', 0.75], ['C5', 0.5], ['Eb5', 2]],
  19: [['Bb4', 1.25], ['A4', 0.25], ['Bb4', 0.5], ['C5', 1], ['A4', 0.5], ['A4', 0.5]],
  20: [['G4', 4]],
  21: [['r', 1.25], ['Bb4', 0.75], ['Bb4', 0.5], ['F5', 0.5], ['Bb4', 0.75], ['F4', 0.25]],
  22: [['A4', 0.5], ['A4', 0.5], ['F4', 3]],
  23: [['r', 2], ['A4', 0.5], ['Bb4', 1.5]],
  24: [['C5', 4]],
  // the interlude
  26: [['r', 0.75], ['F4', 0.25], ['F4', 0.5], ['F4', 1.5], ['r', 0.25], ['A4', 0.5], ['Bb4', 0.25]],
  27: [['G4', 1.25], ['A4', 0.25], ['Bb4', 0.5], ['A4', 0.25], ['A4', 0.75], ['F4', 0.5], ['F4', 0.5]],
  28: [['C5', 0.25], ['C5', 0.75], ['Bb4', 0.5], ['Bb4', 0.5], ['Bb4', 0.25], ['A4', 0.25], ['Bb4', 0.5], ['Bb4', 0.75], ['A4', 0.25]],
  29: [['G4', 0.5], ['G4', 1], ['Bb4', 1], ['Bb4', 1.5]],
  30: [['r', 2], ['Bb4', 1], ['F4', 1]],
  31: [['A4', 1], ['F4', 0.5], ['F4', 0.5], ['F4', 2]],
  32: [['r', 0.25], ['G4', 1.25], ['G4', 0.25], ['A4', 0.25], ['Bb4', 2]],
  33: [['A4', 1.25], ['Bb4', 0.5], ['A4', 0.25], ['G4', 0.25], ['G4', 0.5], ['G4', 1.25]],
  // the theme again, varied
  34: [['r', 1], ['G4', 0.75], ['A4', 0.25], ['Bb4', 0.75], ['C5', 0.25], ['C5', 0.25], ['D5', 0.25], ['D5', 0.5]],
  35: [['A4', 1], ['F5', 0.5], ['F5', 0.5], ['D5', 0.75], ['D5', 0.5], ['Bb4', 0.75]],
  36: [['Bb4', 0.25], ['Eb5', 0.5], ['Eb5', 0.75], ['C5', 0.5], ['D5', 0.5], ['D5', 0.5], ['Bb4', 1]],
  37: [['C5', 0.75], ['C5', 0.5], ['Bb4', 0.25], ['A4', 0.5], ['Bb4', 0.5], ['G4', 1], ['A4', 0.5]],
  38: [['Bb4', 1], ['G4', 0.25], ['A4', 0.25], ['Bb4', 0.5], ['Eb5', 1], ['D5', 1]],
  39: [['C5', 1.75], ['F4', 0.25], ['Bb4', 1], ['Bb4', 0.5], ['F4', 0.5]],
  40: [['A4', 1], ['F4', 0.5], ['F4', 1.5], ['r', 1]],
  // the third statement
  41: [['r', 1], ['G4', 0.5], ['A4', 0.5], ['Bb4', 0.25], ['Bb4', 0.5], ['Bb4', 0.75], ['A4', 0.25], ['Bb4', 0.25]],
  42: [['C5', 1], ['A4', 1], ['Bb4', 0.5], ['Bb4', 0.5], ['Bb4', 1]],
  43: [['r', 1.5], ['A4', 0.5], ['Bb4', 0.25], ['Bb4', 0.25], ['C5', 0.25], ['C5', 0.5], ['D5', 0.75]],
  44: [['F5', 1], ['D5', 0.25], ['Bb4', 0.75], ['C5', 0.75], ['C5', 0.5], ['C5', 0.25], ['D5', 0.5]],
  45: [['Eb5', 0.5], ['Eb5', 1.25], ['C5', 0.25], ['D5', 1], ['G4', 0.25], ['G4', 0.5], ['Bb4', 0.25]],
  46: [['Bb4', 0.25], ['Bb4', 0.5], ['Bb4', 1], ['D5', 0.25], ['C5', 0.25], ['C5', 0.75], ['A4', 0.25], ['A4', 0.25], ['A4', 0.5]],
  47: [['Bb4', 0.25], ['A4', 0.5], ['G4', 0.25], ['Bb4', 0.25], ['A4', 0.5], ['G4', 0.25], ['Bb4', 0.25], ['A4', 0.5], ['G4', 0.5], ['Bb4', 0.25], ['G4', 0.25], ['A4', 0.25]],
  48: [['A4', 1], ['G4', 0.75], ['Bb4', 0.25], ['D5', 0.25], ['D5', 0.5], ['A4', 0.25], ['D5', 1]],
  // the build, high
  51: [['r', 1], ['G5', 0.25], ['A5', 0.5], ['Bb5', 0.25], ['A5', 0.5], ['A5', 0.5], ['F5', 0.75], ['F5', 0.25]],
  52: [['G5', 0.25], ['G5', 1], ['F5', 0.25], ['F5', 0.5], ['D5', 0.5], ['D5', 0.75], ['D5', 0.25], ['D5', 0.5]],
  53: [['Eb5', 0.5], ['Eb5', 0.25], ['Eb5', 0.5], ['F5', 0.75], ['D5', 0.5], ['D5', 0.5], ['G5', 0.5], ['Bb5', 0.5]],
  54: [['Bb5', 0.75], ['Bb5', 0.5], ['A5', 0.25], ['Bb5', 0.5], ['C6', 0.25], ['C6', 0.75], ['F5', 0.5], ['C6', 0.5]],
  55: [['D6', 3], ['r', 1]],
  56: [['r', 2], ['Bb4', 0.5], ['F4', 0.25], ['F4', 0.25], ['Bb4', 0.5], ['F5', 0.5]],
  57: [['r', 0.25], ['F5', 1.25], ['A4', 0.5], ['F4', 0.25], ['A4', 0.25], ['F4', 1.5]],
  58: [['G4', 4]],
  // out of the breakdown, up to the dominant
  60: [['r', 1.25], ['G4', 0.25], ['A4', 0.5], ['Bb4', 0.5], ['A4', 0.5], ['Bb4', 1]],
  61: [['C5', 0.5], ['C5', 0.5], ['F5', 1], ['D5', 0.25], ['D5', 0.25], ['D5', 0.5], ['D5', 1]],
  62: [['G4', 0.5], ['G4', 0.25], ['G4', 0.25], ['G4', 0.5], ['G4', 0.25], ['G4', 0.25], ['A4', 0.5], ['A4', 0.5], ['F4', 0.25], ['F4', 0.25], ['F4', 0.25], ['F4', 0.25]],
  63: [['D5', 0.25], ['D5', 0.25], ['D5', 0.25], ['D5', 0.25], ['D5', 0.25], ['G4', 0.25], ['Bb4', 0.25], ['Bb4', 0.25], ['A4', 0.5], ['A4', 0.25], ['A4', 0.25], ['F4', 0.25], ['F4', 0.25], ['F4', 0.25], ['F4', 0.25]],
  64: [['F5', 0.5], ['Eb5', 1], ['G4', 0.5], ['G4', 1], ['A4', 0.5], ['Bb4', 0.5]],
  65: [['A4', 0.5], ['A4', 0.5], ['D5', 0.5], ['D5', 0.5], ['D5', 0.5], ['D5', 0.5], ['D5', 0.5], ['D5', 0.5]],
  66: [['D5', 0.5], ['F#4', 0.5], ['A4', 1], ['F#4', 1], ['A4', 1]],
  // the last statement
  67: [['r', 1], ['G4', 0.5], ['A4', 0.5], ['Bb4', 0.25], ['Bb4', 0.25], ['Bb4', 0.5], ['Bb4', 0.75], ['Bb4', 0.25]],
  68: [['C5', 0.5], ['C5', 1.25], ['A4', 0.75], ['G4', 1.5]],
  69: [['G4', 1.5], ['G4', 0.25], ['A4', 0.25], ['Bb4', 0.75], ['A4', 0.5], ['Bb4', 0.75]],
  70: [['C5', 0.5], ['C5', 0.5], ['F5', 1], ['D5', 1], ['D5', 0.25], ['C5', 0.25], ['D5', 0.5]],
  71: [['Eb5', 0.25], ['Eb5', 0.75], ['Eb5', 0.75], ['Eb5', 0.25], ['D5', 0.25], ['D5', 0.25], ['D5', 0.5], ['D5', 0.75], ['A4', 0.25]],
  72: [['Bb4', 0.25], ['Bb4', 0.5], ['Bb4', 0.5], ['C5', 1], ['C5', 0.75], ['F4', 0.5], ['F4', 0.25], ['F4', 0.25]],
  73: [['G4', 0.5], ['G4', 0.25], ['G4', 0.25], ['G4', 0.25], ['G4', 0.75], ['Bb4', 0.75], ['C5', 0.5], ['D5', 0.75]],
  74: [['C5', 1.75], ['F4', 1.5], ['F4', 0.75]],
  75: [['A4', 0.5], ['F4', 1.5], ['F#4', 2]],
  // the close
  76: [['G4', 4]],
  77: [['C5', 1.5], ['A4', 0.5], ['Bb4', 0.5], ['Bb4', 1.5]],
  78: [['r', 1.5], ['A4', 0.5], ['Bb4', 0.5], ['A4', 1], ['Bb4', 0.5]],
  79: [['C5', 1], ['F5', 0.25], ['F4', 0.75], ['G4', 2]],
  80: [['G4', 4]],
});

/** THE SHAPE, bar by bar: how hard the band plays (`dyn`, a velocity scale), what the drums do (`kit`: 0 none, 1 the
 *  low drums on one and three, 2 the 3-3-2 groove, 3 the groove with the backbeat), and who joins - read off the
 *  recording's loudness and its stems (the drums drop out at 14-18 s and 28-32 s, the bass at 118-124 s). */
/** INTRO3b: `halo` - the tremolo violins over the choir's chord: over the cloud break's held C and the big sections
 *  (INTRO3c took it out of the opening's bare bars, where its partials were the whine); `octave` reaches the cloud
 *  break's and the impact's calls (the horn in octaves with the violins).
 *  The pad stays the quiet bars' (the opening, the cloud break, the breakdown, the close): under the full band it is low
 *  mids the recording's body does not have - measured, the whole song's spectral centre sat 55 Hz under the film's with it. */
/** @typedef {{ dyn: number, kit: 0 | 1 | 2 | 3, pulse?: boolean, choir?: boolean, brass?: boolean, octave?: boolean, harp?: boolean, pad?: boolean, bare?: boolean, halo?: boolean }} Shape */
/** @type {(m: number) => Shape} */
function shapeOf(m) {
  if (m < 0) return { dyn: 0.55 + 0.1 * (m + 4), kit: 0, pad: true, harp: m >= -2 };
  if (m <= 1) return { dyn: 0.85, kit: 0, pad: true, harp: true };
  if (m <= 3) return { dyn: 1, kit: 0, choir: true, brass: true, pad: true, halo: true, octave: true };
  if (m <= 5) return { dyn: 0.75, kit: 0, pad: true, harp: true };
  if (m <= 7) return { dyn: 0.95, kit: 1, pulse: true, choir: true, brass: true, octave: true };
  if (m <= 16) return { dyn: 1, kit: 2, pulse: true, choir: m >= 12, octave: m >= 14, halo: m >= 14 };
  if (m <= 24) return { dyn: 1, kit: m <= 22 ? 2 : 1, pulse: true, choir: true, brass: m === 17 || m === 18, halo: m <= 20 };
  if (m <= 33) return { dyn: 0.85, kit: m >= 28 && m <= 31 ? 1 : 2, pulse: true, harp: true };
  if (m <= 40) return { dyn: 1, kit: 2, pulse: true, choir: true, octave: true, halo: true };
  if (m <= 48) return { dyn: 1.05, kit: 3, pulse: true, choir: true, brass: m >= 44, octave: true, halo: true };
  if (m <= 50) return { dyn: 1, kit: 2, pulse: true, choir: true, brass: true };
  if (m <= 55) return { dyn: 1.1, kit: 3, pulse: true, choir: true, brass: true, halo: true };
  if (m <= 58) return { dyn: 1, kit: 2, pulse: true, choir: true };
  if (m <= 60) return { dyn: 0.85, kit: 2, pad: true, harp: true, bare: true };   // the breakdown: the drums on, the bass gone
  if (m <= 66) return { dyn: 1.05, kit: m >= 63 ? 3 : 2, pulse: true, choir: true, brass: m >= 64, octave: m >= 63, halo: m >= 63 };
  if (m <= 75) return { dyn: 1.12, kit: 3, pulse: true, choir: true, brass: true, octave: true, halo: true };
  if (m < CLOSE_BAR) return { dyn: 1, kit: 2, pulse: true, choir: true, octave: m <= 77, halo: m <= 77 };
  return { dyn: 0.9, kit: 0, choir: true, pad: true, halo: true };
}

/** Control events sort before notes on the same tick (a program change is heard by the note it stands beside). */
const RANK = { programChange: 0, controller: 0, noteOn: 1 };
const clampVel = (v) => Math.max(1, Math.min(127, Math.round(v)));

/** The writer: `note(voice, bar, beat, beats, name, velocity)` lays a note, `hit(key, bar, beat, velocity)` a drum,
 *  `volume(voice, bar, beat, value)` a CC7. One note a key a moment (the gate score's law, AUDIT SD III A8): a note laid
 *  where the same voice already strikes it is one note, its loudest and its longest. */
function writer() {
  /** @type {Array<{ tick: number, type: string, channel: number, note?: number, velocity?: number, duration?: number, program?: number, controller?: number, value?: number }>} */
  const events = [];
  const struck = new Map();
  const w = {
    events,
    /** @param {keyof typeof INTRO_CHANNELS} voice @param {number} bar @param {number} beat @param {number} beats @param {string | number} n @param {number} velocity */
    note(voice, bar, beat, beats, n, velocity) {
      const note = typeof n === 'number' ? n : midiNote(n), at = introTick(bar, beat), channel = INTRO_CHANNELS[voice];
      const v = clampVel(velocity), duration = Math.max(1, Math.round(beats * INTRO_SCORE_TPQ));
      const key = (at * 16 + channel) * 128 + note, was = struck.get(key);
      if (was) { was.velocity = Math.max(was.velocity, v); was.duration = Math.max(was.duration, duration); return; }
      const e = { tick: at, type: 'noteOn', channel, note, velocity: v, duration };
      struck.set(key, e);
      events.push(e);
    },
    /** @param {keyof typeof KIT} key @param {number} bar @param {number} beat @param {number} velocity */
    hit(key, bar, beat, velocity) { w.note('kit', bar, beat, 0.25, KIT[key], velocity); },
    /** @param {keyof typeof INTRO_CHANNELS} voice @param {number} bar @param {number} beat @param {number} value */
    volume(voice, bar, beat, value) {
      events.push({ tick: introTick(bar, beat), type: 'controller', channel: INTRO_CHANNELS[voice], controller: 7, value: Math.max(0, Math.min(127, Math.round(value))) });
    },
  };
  return w;
}

/** A swell: a suspended cymbal's roll into (bar, 0) - soft mallets in sixteenths over the last `beats` of the bar before,
 *  rising from a whisper to its loudest at the last stroke before the line, where the crash and the hit take over.
 *  INTRO3c (the owner: "Theres still a high pitch whine in the build up leading to the title drop"): this was the
 *  bank's reverse cymbal, then INTRO3b's riser - the Spire's inharmonic FM shimmer on G5 and D6 under a 2.76 modulator,
 *  whose sidebands (2.9, 4.4, 5.1 and 7.6 kHz) stood 14 to 17 dB over their surroundings through both build-ups where
 *  the recording has none. A cymbal's roll is a band of noise: no line in it to whine. */
function swellInto(w, bar, beats) {
  const steps = beats * 4 - 1;
  for (let i = 0; i <= steps; i++) w.hit('ride', bar - 1, 4 - beats + i / 4, 12 + 115 * Math.pow(i / steps, 1.6));
}

/** A timpani roll on `note` over the last `beats` of the bar before `bar`, rising. */
function rollInto(w, bar, beats, note, from = 50, to = 112) {
  const n = beats * 4;
  for (let i = 0; i < n; i++) w.note('timpani', bar - 1, 4 - beats + i / 4, 0.24, note, from + (to - from) * (i / (n - 1)));
}

/** INTRO3b: a snare roll over the last `beats` of the bar before `bar`, in sixteenths, rising - into the build's top and
 *  the last statement. */
function rollSnare(w, bar, beats, from = 40, to = 104) {
  const n = beats * 4;
  for (let i = 0; i < n; i++) w.hit('snare', bar - 1, 4 - beats + i / 4, from + (to - from) * (i / (n - 1)));
}

/** INTRO3b: the bed's voices, and a swell into `bar` - over the two bars before it each sinks from its level to `from`
 *  of it and surges back to the whole of it on the bar line (no step: a sink, then the surge), so a landmark and a
 *  section's turn are led into, not merely struck. */
const BED = /** @type {const} */ (['strings', 'choir', 'violins', 'halo', 'pad']);
function crescendoInto(w, bar, from = 0.86) {
  for (let i = 0; i <= 16; i++) {
    const k = i <= 8 ? 1 - (1 - from) * (i / 8) : from + (1 - from) * ((i - 8) / 8);
    for (const voice of BED) w.volume(voice, bar - 2, i / 2, MIX[voice][0] * k);
  }
}

/** The big hit on a landmark's bar line: the whole low end, the crash and the orchestra hit together - INTRO3b: and the
 *  low brass's braam an octave under the section. */
function landOn(w, bar, chord, vel = 1) {
  const c = CHORDS[chord];
  w.note('timpani', bar, 0, 1.5, midiNote(c.root) + 12, 124 * vel);
  w.note('contrabass', bar, 0, 4, c.root, 120 * vel);
  for (const n of c.brass) { w.note('hit', bar, 0, 1, n, 116 * vel); w.note('brass', bar, 0, 2, n, 112 * vel); }
  w.note('brass', bar, 0, 2, midiNote(c.brass[0]) - 12, 112 * vel);
  w.hit('crash', bar, 0, 118 * vel);
  w.hit('surdo', bar, 0, 120 * vel);
  w.hit('kick', bar, 0, 122 * vel);
  w.hit('splash', bar, 0, 100 * vel);
  w.note('bells', bar, 0, 4, midiNote(c.root) + 36, 100 * vel);
}

/** The ostinato's 16th steps and which carry the 3-3-2 accent (the low strings' pulse, as the recording's G2-G3). */
const PULSE = Object.freeze([[0, true], [0.25, false], [0.75, true], [1, false], [1.5, true], [2, true], [2.25, false], [2.75, true], [3, false], [3.5, true]]);
/** A chord's root in the ostinato's octave (F2 to E3) and the contrabass's (the CHORDS entry). */
const pulseNote = (root) => { let n = midiNote(root); while (n < 41) n += 12; while (n > 52) n -= 12; return n; };

/** One bar of the band under the melody, by its shape. */
function bandBar(w, m) {
  if (m > CLOSE_BAR) return;   // the close's chord rings through the last two bars
  const s = shapeOf(m), [h1, h2] = HARMONY[m], d = s.dyn;
  for (const [half, name] of [[0, h1], [2, h2]]) {
    const c = CHORDS[name];
    const sameAsBefore = half === 2 && h1 === h2;
    if (!sameAsBefore) {
      const len = m === CLOSE_BAR ? 4 * (LAST_BAR - CLOSE_BAR + 1) : half === 0 && h1 === h2 ? 4 : 2;
      for (const n of c.str) w.note('strings', m, half, len, n, 82 * d);
      if (s.choir) for (const n of c.choir) w.note('choir', m, half, len, n, 88 * d);
      if (s.pad) for (const n of c.choir) w.note('pad', m, half, len, midiNote(n) - 12, 84 * d);
      if (!s.bare) w.note('contrabass', m, half, len, c.root, 100 * d);
      if (s.brass) for (const n of c.brass) w.note('brass', m, half, len * 0.9, n, 92 * d);
      // INTRO3b: the low brass's braam under the section, and the halo - the tremolo violins on the chord an octave
      // over the choir
      if (s.brass) w.note('brass', m, half, len * 0.9, midiNote(c.brass[0]) - 12, 96 * d);
      if (s.halo) for (const n of c.choir) w.note('halo', m, half, len, midiNote(n) + 12, 72 * d);
    }
    if (s.pulse) {
      const p = pulseNote(c.root);
      for (const [b, accent] of PULSE) {
        if (b < half || b >= half + 2) continue;
        w.note('ostinato', m, b, accent ? 0.4 : 0.2, p, (accent ? 104 : 74) * d);
        // INTRO3b: the cellos on every step where the drums are fullest, on the accents elsewhere
        if (accent || s.kit >= 3) w.note('cellos', m, b, 0.45, p, (accent ? 88 : 70) * d);
      }
    }
    if (s.harp) {
      // the harp's arpeggio, up through the chord and back, in eighths
      const tones = c.choir.map(midiNote), up = [tones[0], tones[1], tones[2], tones[0] + 12];
      up.forEach((n, i) => w.note('harp', m, half + i * 0.5, 0.9, n, (i === 0 ? 80 : 66) * d));
    }
  }
  // the drums
  if (s.kit >= 1) {
    w.hit('surdo', m, 0, 104 * d);
    w.hit('surdo', m, 2, 92 * d);
    w.note('timpani', m, 0, 1, midiNote(CHORDS[h1].root) + 12, 96 * d);
  }
  if (s.kit >= 2) w.note('timpani', m, 2, 1, midiNote(CHORDS[h2].root) + 12, 80 * d);   // INTRO3b: the timpani answers on three
  // INTRO3b: the suspended cymbal's wash under the groove - soft, on one and three, on every beat where the drums are
  // fullest (the bar line's own crash stands over it where they meet)
  if (s.kit >= 2) for (const b of s.kit >= 3 ? [0, 1, 2, 3] : [0, 2]) w.hit('crash', m, b, (s.kit >= 3 ? 54 : 46) * d);
  if (s.kit >= 2) {
    for (const b of [0, 0.75, 1.5, 2, 2.75, 3.5]) w.hit('kick', m, b, (b === 0 || b === 2 ? 108 : 90) * d);
    w.hit('lowTom', m, 1.5, 84 * d);
    w.hit('floorTom', m, 3, 80 * d);
    if (m % 4 === 3) ['midTom', 'tom', 'floorTom', 'lowTom'].forEach((k, i) => w.hit(/** @type {keyof typeof KIT} */ (k), m, 3 + i * 0.25, (86 + i * 6) * d));
    if (m % 4 === 0) w.hit('crash', m, 0, 96 * d);
  }
  if (s.kit >= 3) for (const b of [1, 3]) { w.hit('snare', m, b, 100 * d); w.hit('clap', m, b, 84 * d); }
}

/** The melody: the horn always; the violins an octave over it where the recording opens out. */
function melodyBar(w, m) {
  const bar = MELODY[m];
  if (!bar) return;
  const s = shapeOf(m);
  let beat = 0;
  for (const [n, beats] of bar) {
    if (n !== 'r') {
      const accent = beat === 0 || beat === 2 ? 8 : 0;
      w.note('horn', m, beat, beats * 0.94, n, (100 + accent) * Math.min(1.1, s.dyn));
      if (s.octave) w.note('violins', m, beat, beats * 0.94, midiNote(n) + 12, (90 + accent) * s.dyn);
    }
    beat += beats;
  }
}

/** The whole song: the band bar by bar, the melody over it, the risers and hits on the film's two landmarks and the
 *  sections' turns. Pure: the same notes every time. */
function makeTheme() {
  const w = writer();
  for (let m = FIRST_BAR; m <= LAST_BAR; m++) { bandBar(w, m); melodyBar(w, m); }
  // the opening swells from nothing: every voice it uses fades in over its four bars
  for (let i = 0; i < 32; i++) {
    const v = 44 + (i / 32) * 56;
    for (const voice of /** @type {const} */ (['strings', 'pad', 'contrabass', 'harp'])) w.volume(voice, FIRST_BAR, i / 2, voice === 'harp' ? v * 0.84 : v);
  }
  w.volume('strings', 0, 0, MIX.strings[0]); w.volume('pad', 0, 0, MIX.pad[0]); w.volume('contrabass', 0, 0, MIX.contrabass[0]); w.volume('harp', 0, 0, MIX.harp[0]);
  // into the cloud break: the roll, the swell, the crescendo, the hit - on CLOUD_REVEAL_TIME
  rollInto(w, CLOUD_BAR, 2, 'C3');
  swellInto(w, CLOUD_BAR, 2);
  crescendoInto(w, CLOUD_BAR, 0.82);
  landOn(w, CLOUD_BAR, 'C', 0.96);
  // the C holds; it settles, then rises again into the impact - on TITLE_IMPACT_TIME
  rollInto(w, IMPACT_BAR, 2, 'D3', 46, 116);
  swellInto(w, IMPACT_BAR, 4);
  crescendoInto(w, IMPACT_BAR, 0.76);
  landOn(w, IMPACT_BAR, 'Gm', 1.05);
  // the sections' turns: the theme's entry, its answer, the third statement, the build's top, the breakdown's end, the
  // dominant's arrival and the last statement - each led into by the bed's crescendo (INTRO3b), struck by the low
  // brass's braam with the hit
  for (const [bar, chord, vel] of /** @type {Array<[number, string, number]>} */ ([[8, 'Gm', 0.92], [17, 'D', 0.9], [41, 'Gm', 0.95], [55, 'Eb', 1], [61, 'F', 0.9], [67, 'Gm', 1.05]])) {
    w.hit('crash', bar, 0, 110 * vel);
    w.note('timpani', bar, 0, 1, midiNote(CHORDS[chord].root) + 12, 116 * vel);
    for (const n of CHORDS[chord].brass) w.note('hit', bar, 0, 1, n, 100 * vel);
    w.note('brass', bar, 0, 1.5, midiNote(CHORDS[chord].brass[0]) - 12, 104 * vel);
    crescendoInto(w, bar);
  }
  rollInto(w, 41, 2, 'D3');
  rollSnare(w, 55, 2);
  rollInto(w, 61, 4, 'D3', 40, 110);
  swellInto(w, 61, 4);
  rollInto(w, 67, 4, 'D3', 50, 120);
  swellInto(w, 67, 2);
  rollSnare(w, 67, 4, 36, 110);
  crescendoInto(w, CLOSE_BAR, 0.9);
  // the close: one last hit on G, and the chord left to ring into the loop
  landOn(w, CLOSE_BAR, 'Gm', 0.92);
  for (let i = 0; i < 16; i++) for (const voice of /** @type {const} */ (['strings', 'choir', 'pad', 'contrabass', 'halo', 'violins'])) w.volume(voice, CLOSE_BAR + 1, i / 2, MIX[voice][0] * (1 - i / 16));
  // every voice's program, level and place at tick 0
  for (const [voice, [level, pan]] of Object.entries(MIX)) {
    const channel = INTRO_CHANNELS[/** @type {keyof typeof INTRO_CHANNELS} */ (voice)];
    w.events.push({ tick: 0, type: 'programChange', channel, program: INTRO_PROGRAMS[/** @type {keyof typeof INTRO_PROGRAMS} */ (voice)] });
    w.events.push({ tick: 0, type: 'controller', channel, controller: 7, value: voice === 'strings' || voice === 'pad' || voice === 'contrabass' || voice === 'harp' ? 44 : level });
    w.events.push({ tick: 0, type: 'controller', channel, controller: 10, value: pan });
  }
  w.events.push({ tick: 0, type: 'controller', channel: INTRO_CHANNELS.kit, controller: 7, value: KIT_LEVEL });
  w.events.sort((a, b) => a.tick - b.tick || RANK[/** @type {keyof typeof RANK} */ (a.type)] - RANK[/** @type {keyof typeof RANK} */ (b.type)]);
  return {
    name: INTRO_SONG, press: INTRO_PRESS, tone: INTRO_TONE, level: INTRO_LEVEL,
    beatsPerMinute: 60 / (INTRO_SECONDS_PER_TICK * INTRO_SCORE_TPQ), secondsPerTick: INTRO_SECONDS_PER_TICK,
    events: w.events, durationTicks: introTick(LAST_BAR + 1), seamless: true,
    voices: INTRO_VOICES_BY_CHANNEL, kit: INTRO_KIT,   // INTRO3b: its own voices and kit (songPlayer.js songVoices, songKit)
  };
}

let _theme = null;
/** The theme, made once (pure: the same notes every time). */
export function introThemeSong() {
  return (_theme ??= Object.freeze(makeTheme()));
}

/** For the tests: the transcription's tables as they stand. */
export const INTRO_SCORE_TABLES = Object.freeze({ HARMONY, MELODY, CHORDS });
