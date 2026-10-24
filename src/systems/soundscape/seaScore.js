// @ts-check
// SEA-SCORE (2026-10-24, the owner: "different music and ambience sounds for sailing"): THE SEA'S MUSIC - six songs for
// a helm, made in code as the Warden's, the Hour's and the arena's are (systems/gate/gateScore.js - the precedent and its
// reasons), and the law of which plays. Daggerfall has no sea music: SongManager plays the overland weather songs on a
// deck as on a road (DaggerfallSongManager's playlists know a dungeon, a building and the sky, never a ship), so a
// voyage under sail heard the same SUNNYDAY as a walk to the next farm. These are played by the game's own player and
// FM bank under names of their own (music.registerSong), in the same mix as every other song, faded in and out by the
// same law (DISC20-B), replaced by name by a music pack as any song is (M-EXT).
//
//   SEACALM - A STILL SEA. 6/8, D Dorian (the major sixth, B natural, the mode's sea colour), 84 BPM in quarters: the
//             harp rolling the chord in eighths, a low drone, the flute's tune, the strings come in on its second pass
//             and the whistle takes a tune of its own in the middle. For drifting, the oars, a sea under fog.
//   SEAOPEN - THE OPEN SEA. 4/4, G with the flat seventh borrowed (its F chord, F natural over it - AUDIT SOUNDSCAPE M7:
//             G major elsewhere, F sharp over D, not the Mixolydian the first cut named), 100 BPM: the fiddle's
//             tune over the accordion's off-beat chords, the cello and bass on one and three, a bodhran's pattern; the
//             accordion joins the tune and the horns hold under it on the second pass; a breath on the strings and the
//             whistle, then everything for the last eight bars. For a ship making way.
//   SEASTORM - THE STORM. 4/4, D Aeolian, 126 BPM: the low strings driving in eighths, the timpani on one and three and
//             rolling into each fourth bar, brass stabs in open fifths, the choir under it, a crash at each section;
//             the horn's theme, then the strings' and the brass's an octave over. Tense, not a boss: no orchestra hit,
//             no organ, no tolled bell - the weather, not a villain.
//   SEANIGHT - THE SEA AT NIGHT. 3/4, A Dorian, 66 BPM: sparse - the harp's broken chord, a soft choir pad, the flute's
//             slow tune, the cello holding under its second pass, one low bell far off at the head of each half.
//   SEAPORT - LANDFALL. A jig: 6/8, D major, 156 BPM in quarters (a dotted quarter at 104), AABB twice: the fiddle and
//             the whistle, the accordion's boom-chick, the bodhran and a tambourine; the fiddle a diatonic third under
//             the whistle on the second time through. For a port's approach.
//   SEAFIGHT - A SEA FIGHT. 4/4, D minor with its major dominant, 144 BPM: a snare's march, the kick on one and three,
//             the strings' ostinato, the timpani, the brass's theme - heroic, a swashbuckler's, its turns on the minor
//             iv and the Andalusian fall (i - VII - VI - V; M7: no major IV stands in it), never the Warden's half steps.
//
// THE LAW (`seaScoreFor`): not at a helm, no score (the music director stands) - but aboard in a sea fight, the fight
// still (AUDIT SOUNDSCAPE M1: a boarding lets the helm go, and the deck fight, a sea fight's climax, played the
// overland song); a sea fight as the watch knows it, the fight; a thunderstorm, the storm; a port's approach, landfall;
// night, the night's; drifting (under SEA_CALM_WAY) or fog, the still sea; else the open sea. Rain and snow at sea are
// the open sea's: a wet passage, not a storm (DFU's own weather splits rain from storm the same way: WeatherManager's
// IsRaining and IsStorming). Pure.
// THE HOLD (`createSeaScore`): a song once chosen plays whole - its own length, and never under SEA_SCORE_HOLD_MS -
// and the law must have wanted another for SEA_SCORE_SETTLE_MS on end before it changes, so a ship working about the
// calm line or the edge of a port's ring neither flips between songs nor cuts one short (AUDIT SOUNDSCAPE M3: a timer
// alone changed at 90 s on the dot, and the still sea's choir and the shanty's last tutti were never heard); a fight or
// a storm comes in at once, the helm let go lets the music go at once, and a fight ended keeps its song
// SEA_FIGHT_TAIL_MS more - aboard off the helm too.
// Not a DFU member. Ledger A (SEA-SCORE).

import { midiNote, SCORE_TPQ } from '../gate/gateScore.js';

/** The songs' names - their own, beside MIDI.BSA's (no record there begins SEA) and the other made scores'. */
export const SEA_SONGS = Object.freeze({ calm: 'SEACALM.HMI', open: 'SEAOPEN.HMI', storm: 'SEASTORM.HMI', night: 'SEANIGHT.HMI', port: 'SEAPORT.HMI', fight: 'SEAFIGHT.HMI' });
/** The law's answer for nothing sounding (the other scores' word; no arm of the sea's law answers it - a helm always
 *  has its song). */
export const SEA_SCORE_SILENCE = 'silence';
/** Under this way (m/s, the helm's - comeSailAway.js helmPanelState().way) a ship is drifting: the still sea's song. */
export const SEA_CALM_WAY = 2.5;
/** The least a chosen song plays before the law may change it (a song longer plays whole), how long on end the law must
 *  want another, and how long a fight's song outlives the fight (M3: a ship at the edge of a hostile's reach - in 4 s,
 *  out 14 s - restarted the fight's song from its top seventeen times in five minutes on a 12 s tail). */
export const SEA_SCORE_HOLD_MS = 90_000;
export const SEA_SCORE_SETTLE_MS = 20_000;
export const SEA_FIGHT_TAIL_MS = 20_000;

/** Each song's tempo (quarter notes a minute), length in bars, and bar in quarter beats (6/8 is three). */
export const SEA_SHAPE = Object.freeze({
  calm: Object.freeze({ bpm: 84, bars: 64, beats: 3 }),
  open: Object.freeze({ bpm: 100, bars: 48, beats: 4 }),
  storm: Object.freeze({ bpm: 126, bars: 48, beats: 4 }),
  night: Object.freeze({ bpm: 66, bars: 32, beats: 3 }),
  port: Object.freeze({ bpm: 156, bars: 64, beats: 3 }),
  fight: Object.freeze({ bpm: 144, bars: 48, beats: 4 }),
});

/** GM programs (gmSynth.js FM bank; 46, 45, 47 and 14 carry their own articulation there). The fiddle is the violin
 *  (40, bowed): GM's own fiddle (110) sits in the ethnic family, a plucked envelope that dies in half a second. */
export const SEA_PROGRAMS = Object.freeze({
  fiddle: 40, flute: 73, whistle: 78, accordion: 21, harp: 46, pizz: 45, strings: 48, cello: 42, bass: 43,
  choir: 52, horn: 60, brass: 61, timpani: 47, bells: 14, drive: 42,
});
/** Channels: one voice each, the kit on GM's channel 9. */
export const SEA_CHANNELS = Object.freeze({
  fiddle: 0, flute: 1, whistle: 2, accordion: 3, harp: 4, pizz: 5, strings: 6, cello: 7, bass: 8, kit: 9,
  choir: 10, horn: 11, brass: 12, timpani: 13, bells: 14, drive: 15,
});
/** Each voice's level (CC7) and place (CC10, 64 the middle): the band about the middle - the fiddle a touch left, the
 *  whistle and the flute right, the harp left of them and the pizzicato right, the horns left and the brass right. */
export const SEA_MIX = Object.freeze({
  fiddle: Object.freeze([104, 56]), flute: Object.freeze([98, 72]), whistle: Object.freeze([90, 78]), accordion: Object.freeze([94, 46]),
  harp: Object.freeze([100, 40]), pizz: Object.freeze([88, 84]), strings: Object.freeze([86, 70]), cello: Object.freeze([94, 52]),
  bass: Object.freeze([96, 64]), choir: Object.freeze([80, 64]), horn: Object.freeze([98, 44]), brass: Object.freeze([100, 82]),
  timpani: Object.freeze([100, 64]), bells: Object.freeze([70, 90]), drive: Object.freeze([94, 52]),
});
/** The kit's level (CC7 on channel 9). */
export const SEA_KIT_LEVEL = 100;
/** GM kit keys (gmSynth.js DRUMS): the bodhran is the low floor tom's skin and the low tom's top. */
const KIT = Object.freeze({ kick: 36, snare: 38, bodhran: 41, bodhranTop: 45, tom: 47, crash: 49, ride: 51, tambourine: 54 });

/** EG-ROAR's voices (systems/song/songPlayer.js songVoices), by voice: the fiddle bowed quicker than the bank's
 *  strings and a pair a few cents apart (a player's bow, not a section's); the accordion's reeds tuned apart - the
 *  musette's beat, which is what an accordion is; the strings and the choir an ensemble; the cello and the horn a pair. */
export const SEA_VOICES = Object.freeze({
  fiddle: Object.freeze({ attack: 0.025, decay: 0.25, sustain: 0.8, release: 0.16, index: 2.2, idxDecay: 0.8, unison: 2, cents: 5, spread: 0.15 }),
  accordion: Object.freeze({ unison: 2, cents: 14, spread: 0.3 }),
  strings: Object.freeze({ attack: 0.18, release: 0.8, index: 1.6, idxDecay: 2, unison: 3, cents: 10, spread: 0.5 }),
  cello: Object.freeze({ attack: 0.07, unison: 2, cents: 6, spread: 0.2 }),
  choir: Object.freeze({ mod: 1, index: 1.1, idxDecay: 2, attack: 0.35, release: 1, unison: 3, cents: 12, spread: 0.45 }),
  horn: Object.freeze({ attack: 0.06, index: 2.6, unison: 2, cents: 6, spread: 0.25 }),
  /** AUDIT SOUNDSCAPE M5: THE DRIVE - the storm's and the fight's bowed eighths (and the storm's sixteenths) on a cello that
   *  speaks and stops inside its note. On the cello's own envelope (0.37 s to speak, 0.4 to die) every strike still sounded
   *  under the next three of the same key, and copies of one key at one pitch cancel and swell by its pitch and the
   *  tempo: the storm's drive was quietest, with holes 18-20 dB deep inside each eighth, on its own tonic. */
  drive: Object.freeze({ attack: 0.012, decay: 0.08, sustain: 0.75, release: 0.05, unison: 2, cents: 6, spread: 0.2 }),
});
/** The voices by channel, as the song carries them. */
const VOICES_BY_CHANNEL = Object.freeze(Object.fromEntries(Object.entries(SEA_VOICES).map(([v, s]) => [SEA_CHANNELS[/** @type {keyof typeof SEA_CHANNELS} */ (v)], s])));
/** The kit's own drums (songPlayer.js songKit, by GM key): the bodhran's low skin and its top, a kick, a snare with a
 *  body under its crack. */
export const SEA_KIT = Object.freeze({
  [KIT.bodhran]: Object.freeze({ hz: 74, decay: 0.34, gain: 1.1, drop: 0.8, click: 0.3 }),
  [KIT.bodhranTop]: Object.freeze({ hz: 140, decay: 0.12, gain: 0.7, click: 0.45 }),
  [KIT.kick]: Object.freeze({ hz: 56, decay: 0.32, gain: 1.05, click: 0.4 }),
  [KIT.snare]: Object.freeze({ hz: 1800, decay: 0.15, gain: 0.8, body: 190 }),
});
/** Each song over the player's own level (songPlayer.js songLevel; the game's songs stand at 1), so the sea sits
 *  where DFU's day songs sit at the same MusicVolume (tools/seaScoreProbe.mjs measures both) - never a boss's level. */
export const SEA_LEVEL = Object.freeze({ calm: 2.8, open: 2, storm: 2.1, night: 2.4, port: 2.1, fight: 1.95 });

const PITCH = Object.freeze({ C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 });
/** The chords, as pitch classes from the root: [root, third, fifth]. */
const CHORD = Object.freeze({
  Dm: [2, 5, 9], D: [2, 6, 9], G: [7, 11, 2], Gm: [7, 10, 2], C: [0, 4, 7], F: [5, 9, 0], Am: [9, 0, 4], A: [9, 1, 4],
  Em: [4, 7, 11], Bm: [11, 2, 6], Bb: [10, 2, 5],
});
/** A pitch class in an octave (C4 is 60). */
const at = (pc, octave) => 12 * (octave + 1) + pc;
/** The chord's tones from its root in `octave` upward: root, third, fifth, then each an octave over, `n` of them. */
function stack(name, octave, n = 6) {
  const [r, t, f] = CHORD[/** @type {keyof typeof CHORD} */ (name)];
  const root = at(r, octave), third = root + ((t - r + 12) % 12), fifth = root + ((f - r + 12) % 12);
  const base = [root, third, fifth];
  return Array.from({ length: n }, (_, i) => base[i % 3] + 12 * Math.floor(i / 3));
}
/** The chord's closed voicing over `low` (MIDI): its three tones, the first the lowest at or above `low`. */
function voicing(name, low) {
  const pcs = CHORD[/** @type {keyof typeof CHORD} */ (name)];
  const tones = [];
  for (let n = low; tones.length < 3; n++) if (pcs.includes(((n % 12) + 12) % 12)) tones.push(n);
  return tones;
}
/** The note `steps` degrees of `scale` (pitch classes) under `note` - a diatonic third under is two. */
function under(note, steps, scale) {
  let n = note, left = steps;
  while (left > 0) { n--; if (scale.includes(((n % 12) + 12) % 12)) left--; }
  return n;
}
const D_MAJOR = Object.freeze([2, 4, 6, 7, 9, 11, 1]);
/** The bass's floor: a note under E1 (28, the contrabass's lowest string) is played an octave up. */
const BASS_FLOOR = 28;
const floored = (n) => (n < BASS_FLOOR ? n + 12 : n);

/**
 * A tune, bar by bar: `'A4:1.5 D5:.5 | ...'` - each note its name and its length in quarter beats, `r` a rest, bars
 * split by `|`. Answers `[[note | null, beats], ...]` a bar.
 * @param {string} text
 * @returns {ReadonlyArray<ReadonlyArray<readonly [number | null, number]>>}
 */
export function tune(text) {
  return Object.freeze(text.split('|').map((bar) => Object.freeze(bar.trim().split(/\s+/).map((tok) => {
    const [n, b] = tok.split(':');
    const beats = Number(b);
    if (!(beats > 0)) throw new Error(`seaScore: no length: ${tok}`);
    return /** @type {readonly [number | null, number]} */ (Object.freeze([n === 'r' ? null : midiNote(n), beats]));
  }))));
}

/** THE TUNES - each bar whole in its song's bar (SEA_SHAPE's `beats`). */
export const SEA_TUNES = Object.freeze({
  // the still sea, D Dorian over Dm G Dm C F C G Am | Dm G Dm C F C G Dm
  calmA: tune('A4:1.5 D5:.5 C5:.5 A4:.5 | B4:1 A4:.5 G4:1 A4:.5 | F4:1.5 E4:.5 D4:.5 E4:.5 | G4:1 E4:.5 C4:1.5 | A4:1.5 C5:1 A4:.5 | G4:1 E4:.5 G4:1 C5:.5 | B4:1.5 A4:.5 G4:.5 B4:.5 | A4:3'
    + ' | A4:1 D5:.5 E5:1 F5:.5 | G5:1.5 F5:.5 E5:.5 D5:.5 | F5:1 E5:.5 D5:1 A4:.5 | C5:1.5 G4:1.5 | A4:1 C5:.5 F5:1 E5:.5 | E5:1.5 D5:.5 C5:.5 E5:.5 | D5:1 B4:.5 G4:1 B4:.5 | D5:3'),
  // its middle, over F C G Dm F C Am Am | F G Em Am F C G Dm
  calmB: tune('C5:1.5 A4:1.5 | G4:1 E4:.5 G4:1.5 | B4:1 D5:.5 B4:1 G4:.5 | A4:3 | C5:.5 D5:.5 C5:.5 A4:1.5 | G4:.5 A4:.5 G4:.5 E4:1.5 | E4:1 A4:.5 C5:1 B4:.5 | A4:3'
    + ' | F5:1.5 E5:1 D5:.5 | D5:1.5 B4:1.5 | E5:1 D5:.5 B4:1 G4:.5 | A4:1.5 E5:1.5 | F5:1 E5:.5 D5:1 C5:.5 | E5:1.5 G4:1.5 | B4:1 A4:.5 G4:1 B4:.5 | D5:3'),
  // the open sea, G with its borrowed flat seventh over G C G D G F D G | C G C D Em C D G
  openA: tune('D4:.5 G4:1 G4:.5 G4:.5 A4:.5 B4:1 | C5:1 B4:.5 A4:.5 G4:1 E4:1 | D4:1 G4:.5 A4:.5 B4:1 D5:1 | C5:1 A4:1 F#4:1 D4:1'
    + ' | D4:.5 G4:1 G4:.5 G4:.5 A4:.5 B4:1 | C5:1 A4:.5 C5:.5 F5:1 E5:.5 D5:.5 | D5:1 A4:1 B4:.5 A4:.5 F#4:1 | G4:3 r:1'),
  openB: tune('E5:1.5 D5:.5 C5:1 E5:1 | D5:1.5 B4:.5 G4:1 B4:1 | C5:1 E5:1 G5:1 E5:1 | D5:2 A4:1 F#4:1'
    + ' | E5:1 D5:.5 B4:.5 G4:1 B4:1 | C5:1 B4:.5 A4:.5 G4:1 E4:1 | D4:1 F#4:1 A4:1 C5:1 | B4:1 A4:.5 B4:.5 G4:2'),
  // the storm's theme, D Aeolian over Dm Bb C Dm Dm Gm Bb A
  storm: tune('D4:2 A4:1.5 G4:.5 | F4:1 D4:1 Bb3:2 | C4:1 E4:1 G4:1.5 F4:.5 | E4:1 D4:3 | D4:1 F4:1 A4:1 D5:1 | Bb4:2 A4:1 G4:1 | F4:1.5 G4:.5 A4:1 Bb4:1 | A4:4'),
  // the sea at night, A Dorian over Am G D Am C G Em Am | C G Am Em D C Em Am
  night: tune('E5:2 D5:1 | B4:3 | A4:1.5 B4:.5 A4:1 | E4:3 | G4:2 A4:1 | B4:1 D5:2 | E5:1.5 D5:.5 B4:1 | A4:3'
    + ' | C5:2 B4:1 | D5:3 | E5:2 A5:1 | G5:1.5 F#5:.5 E5:1 | F#5:2 E5:1 | D5:1 C5:1 B4:1 | B4:1.5 A4:.5 G4:1 | A4:3'),
  // landfall's jig, D major over D G D A D G A D | D G D A Bm G A D
  portA: tune('A4:.5 F#4:.5 A4:.5 D5:1 A4:.5 | B4:.5 G4:.5 B4:.5 D5:.5 B4:.5 G4:.5 | A4:.5 F#4:.5 A4:.5 D5:.5 E5:.5 F#5:.5 | E5:1 C#5:.5 A4:1.5'
    + ' | A4:.5 F#4:.5 A4:.5 D5:1 A4:.5 | B4:.5 G4:.5 B4:.5 D5:.5 E5:.5 F#5:.5 | E5:.5 F#5:.5 E5:.5 C#5:.5 A4:.5 C#5:.5 | D5:1 F#4:.5 D4:1.5'),
  portB: tune('F#5:1 E5:.5 F#5:.5 A5:.5 F#5:.5 | G5:1 F#5:.5 E5:.5 D5:.5 B4:.5 | A4:.5 D5:.5 F#5:.5 A5:1 F#5:.5 | E5:1 D5:.5 C#5:1 A4:.5'
    + ' | B4:.5 D5:.5 F#5:.5 B5:1 A5:.5 | G5:.5 F#5:.5 E5:.5 D5:.5 E5:.5 F#5:.5 | E5:.5 C#5:.5 A4:.5 B4:.5 C#5:.5 E5:.5 | D5:1.5 D4:1.5'),
  // the sea fight's theme, D minor over Dm C Bb A Dm C Bb A | F C Gm A Dm Bb A Dm
  fightA: tune('D4:1 A4:1.5 A4:.5 A4:1 | G4:.5 A4:.5 Bb4:1 A4:1 G4:1 | F4:1 D4:1 F4:1 Bb4:1 | A4:3 r:1'
    + ' | D5:1 C5:.5 A4:.5 D5:1 F5:1 | E5:1.5 D5:.5 C5:1 G4:1 | F5:1 D5:1 Bb4:.5 C5:.5 D5:1 | C#5:2 E5:1 A4:1'),
  fightB: tune('F5:1.5 E5:.5 F5:1 A5:1 | G5:1.5 F5:.5 E5:1 C5:1 | D5:1 G5:1 F5:1 D5:1 | E5:2 C#5:1 A4:1'
    + ' | D5:1 F5:1 A5:1.5 G5:.5 | F5:1 D5:1 F5:1 Bb5:1 | E5:1 C#5:1 E5:1 A5:1 | D5:3 r:1'),
});

/** THE HARMONY, a chord a bar, beside each tune. */
export const SEA_CHORDS = Object.freeze({
  calmA: Object.freeze(['Dm', 'G', 'Dm', 'C', 'F', 'C', 'G', 'Am', 'Dm', 'G', 'Dm', 'C', 'F', 'C', 'G', 'Dm']),
  calmB: Object.freeze(['F', 'C', 'G', 'Dm', 'F', 'C', 'Am', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'C', 'G', 'Dm']),
  openA: Object.freeze(['G', 'C', 'G', 'D', 'G', 'F', 'D', 'G']),
  openB: Object.freeze(['C', 'G', 'C', 'D', 'Em', 'C', 'D', 'G']),
  storm: Object.freeze(['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'Bb', 'A']),
  stormB: Object.freeze(['F', 'C', 'Dm', 'Bb', 'Gm', 'Dm', 'A', 'A']),
  night: Object.freeze(['Am', 'G', 'D', 'Am', 'C', 'G', 'Em', 'Am', 'C', 'G', 'Am', 'Em', 'D', 'C', 'Em', 'Am']),
  portA: Object.freeze(['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D']),
  portB: Object.freeze(['D', 'G', 'D', 'A', 'Bm', 'G', 'A', 'D']),
  fightA: Object.freeze(['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A']),
  fightB: Object.freeze(['F', 'C', 'Gm', 'A', 'Dm', 'Bb', 'A', 'Dm']),
});

/** Control events sort before notes on the same tick (a program change is heard by the note it stands beside). */
const RANK = { programChange: 0, controller: 0, noteOn: 1 };

/**
 * @typedef {{ note(voice: keyof typeof SEA_CHANNELS, bar: number, beat: number, beats: number, n: number | string, velocity: number): void,
 *   hit(key: keyof typeof KIT, bar: number, beat: number, velocity: number): void }} Writer
 */

/**
 * A song in the shape the player plays (formats/hmiFile.js HmiFile: `events`, `secondsPerTick`, `durationTicks`):
 * `write(w)` lays its notes with `w.note(voice, bar, beat, beats, note, velocity)` - `beat` in quarter beats of a bar
 * SEA_SHAPE's `beats` long - and `w.hit(key, bar, beat, velocity)`; every voice gets its program, level and place at
 * tick 0. A note laid past the last bar sounds at the loop's start (the song is a loop: a pickup or an echo runs round
 * its seam), and one held past the end stops at it. One note a key a moment (AUDIT SD III A8, gateScore.js makeSong):
 * a note laid where the same voice already strikes it is one note, its loudest and its longest; and a key struck again
 * ends the note before it there (AUDIT SOUNDSCAPE M5: a string, a reed or a key sounds once - two of one pitch at once
 * cancel and swell).
 * @param {keyof typeof SEA_SHAPE} key
 * @param {(w: Writer) => void} write
 */
function makeSong(key, write) {
  const { bpm, bars, beats: bpb } = SEA_SHAPE[key];
  const events = [];
  const length = bars * bpb * SCORE_TPQ;
  const tick = (bar, beat) => ((Math.round((bar * bpb + beat) * SCORE_TPQ) % length) + length) % length;
  const struck = new Map();
  /** @type {Writer} */
  const w = {
    note(voice, bar, beat, beats, n, velocity) {
      const note = typeof n === 'number' ? n : midiNote(n), t = tick(bar, beat), channel = SEA_CHANNELS[voice];
      const v = Math.max(1, Math.min(127, Math.round(velocity))), duration = Math.max(1, Math.min(length - t, Math.round(beats * SCORE_TPQ)));
      const k = (t * 16 + channel) * 128 + note, was = struck.get(k);
      if (was) { was.velocity = Math.max(was.velocity, v); was.duration = Math.max(was.duration, duration); return; }
      const e = { tick: t, type: 'noteOn', channel, note, velocity: v, duration };
      struck.set(k, e);
      events.push(e);
    },
    hit(k, bar, beat, velocity) { w.note('kit', bar, beat, 0.25, KIT[k], velocity); },
  };
  write(w);
  const byKey = new Map();
  for (const e of events) if (e.channel !== SEA_CHANNELS.kit) { const k = e.channel * 128 + e.note; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(e); }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.tick - b.tick);
    for (let i = 0; i + 1 < list.length; i++) list[i].duration = Math.max(1, Math.min(list[i].duration, list[i + 1].tick - list[i].tick));
  }
  for (const [voice, [lv, pan]] of Object.entries(SEA_MIX)) {
    const channel = SEA_CHANNELS[/** @type {keyof typeof SEA_CHANNELS} */ (voice)];
    events.push({ tick: 0, type: 'programChange', channel, program: SEA_PROGRAMS[/** @type {keyof typeof SEA_PROGRAMS} */ (voice)] });
    events.push({ tick: 0, type: 'controller', channel, controller: 7, value: lv });
    events.push({ tick: 0, type: 'controller', channel, controller: 10, value: pan });
  }
  events.push({ tick: 0, type: 'controller', channel: SEA_CHANNELS.kit, controller: 7, value: SEA_KIT_LEVEL });
  events.sort((a, b) => a.tick - b.tick || RANK[a.type] - RANK[b.type]);
  return {
    name: SEA_SONGS[key], press: null, beatsPerMinute: bpm, secondsPerTick: 60 / (bpm * SCORE_TPQ), events, durationTicks: length,
    seamless: true, level: SEA_LEVEL[key], voices: VOICES_BY_CHANNEL, kit: SEA_KIT,
  };
}

/**
 * A tune's bars from `bar0` on `voice`: each note its length times `legato` (a jig's eighths detached, a pad's held),
 * `octave` octaves over, the first note of a bar `accent` louder, `late` beats behind (an echo).
 * @param {Writer} w
 * @param {keyof typeof SEA_CHANNELS} voice
 * @param {number} bar0
 * @param {ReadonlyArray<ReadonlyArray<readonly [number | null, number]>>} bars
 * @param {number} velocity
 */
function lay(w, voice, bar0, bars, velocity, { octave = 0, legato = 0.92, accent = 8, late = 0, from = 0, to = bars.length, map = /** @type {(n: number) => number} */ ((n) => n) } = {}) {
  for (let b = from; b < to; b++) {
    let beat = 0;
    bars[b].forEach(([n, beats], i) => {
      if (n !== null) w.note(voice, bar0 + b - from, beat + late, beats * legato, map(n) + 12 * octave, velocity + (i === 0 ? accent : 0));
      beat += beats;
    });
  }
}

/** SEACALM - the still sea: A, A with the strings, B on the whistle, A with the choir and the whistle over it. */
function calm() {
  return makeSong('calm', (w) => {
    const prog = [...SEA_CHORDS.calmA, ...SEA_CHORDS.calmA, ...SEA_CHORDS.calmB, ...SEA_CHORDS.calmA];
    prog.forEach((c, bar) => {
      // the harp rolls the chord in eighths - root, fifth, octave, tenth, octave, fifth - softer on the off-beats
      const s = stack(c, 3);
      [s[0], s[2], s[3], s[4], s[3], s[2]].forEach((n, i) => w.note('harp', bar, i * 0.5, 1.4, n, i === 0 ? 74 : i === 3 ? 66 : 56));
      // the drone: the cello on D, a bar and a half at a time, the bass under it every other bar
      if (bar % 2 === 0) { w.note('cello', bar, 0, 5.6, 'D3', 52); w.note('bass', bar, 0, 5.6, 'D2', 50); }
      if (bar >= 16) for (const n of voicing(c, 62)) w.note('strings', bar, 0, 2.9, n, bar >= 32 && bar < 48 ? 60 : 50);
      if (bar >= 48) for (const n of voicing(c, 57)) w.note('choir', bar, 0, 2.9, n, 46);
    });
    lay(w, 'flute', 0, SEA_TUNES.calmA, 84, { legato: 0.96, accent: 6 });
    lay(w, 'flute', 16, SEA_TUNES.calmA, 88, { legato: 0.96, accent: 6 });
    lay(w, 'whistle', 32, SEA_TUNES.calmB, 82, { legato: 0.95, accent: 6 });
    lay(w, 'pizz', 32, SEA_TUNES.calmB, 50, { octave: -1, legato: 0.5, accent: 4 });
    lay(w, 'flute', 48, SEA_TUNES.calmA, 86, { legato: 0.96, accent: 6 });
    // the whistle an octave over the tune's second half, an eighth behind it - the echo off the water
    lay(w, 'whistle', 56, SEA_TUNES.calmA, 54, { octave: 1, legato: 0.6, accent: 0, late: 0.5, from: 8, to: 16 });
  });
}

/** The bodhran in a 4/4 bar: the low skin on one and three, its top between, a push on the and of four. */
function bodhran44(w, bar, velocity) {
  w.hit('bodhran', bar, 0, velocity); w.hit('bodhranTop', bar, 0.5, velocity - 34); w.hit('bodhranTop', bar, 1, velocity - 22);
  w.hit('bodhranTop', bar, 1.75, velocity - 36); w.hit('bodhran', bar, 2, velocity - 6); w.hit('bodhranTop', bar, 2.5, velocity - 34);
  w.hit('bodhranTop', bar, 3, velocity - 22); w.hit('bodhran', bar, 3.5, velocity - 18);
}

/** SEAOPEN - the open sea: the fiddle's tune twice through, the second with the accordion on it and the horns under,
 *  a breath of strings and whistle, then all of it for the last eight. */
function open() {
  return makeSong('open', (w) => {
    const prog = [...SEA_CHORDS.openA, ...SEA_CHORDS.openB, ...SEA_CHORDS.openA, ...SEA_CHORDS.openB, ...SEA_CHORDS.openA, ...SEA_CHORDS.openB];
    prog.forEach((c, bar) => {
      const [r, , f] = stack(c, 2);
      const breath = bar >= 32 && bar < 40;
      // the cello and the bass on one and three - the root, then the fifth
      w.note('bass', bar, 0, 0.9, floored(r - 12), breath ? 66 : 92); w.note('bass', bar, 2, 0.9, floored(f - 12), breath ? 60 : 86);
      w.note('cello', bar, 0, 1.8, r, breath ? 58 : 76); w.note('cello', bar, 2, 1.8, f, breath ? 54 : 72);
      // the accordion's off-beat chord, two and four
      if (!breath) for (const n of voicing(c, 59)) { w.note('accordion', bar, 1, 0.7, n, 70); w.note('accordion', bar, 3, 0.7, n, 66); }
      if (breath) for (const n of voicing(c, 62)) w.note('strings', bar, 0, 3.9, n, 62);
      if (bar >= 16 && bar < 32) for (const n of voicing(c, 55)) w.note('horn', bar, 0, 3.8, n, 64);
      if (bar >= 40) for (const n of voicing(c, 62)) w.note('strings', bar, 0, 3.9, n, 58);
      if (!breath) bodhran44(w, bar, bar >= 40 ? 104 : 96);
    });
    for (const half of [0, 16, 40]) {
      if (half < 40) { lay(w, 'fiddle', half, SEA_TUNES.openA, 98); lay(w, 'fiddle', half + 8, SEA_TUNES.openB, 100); }
      else lay(w, 'fiddle', half, SEA_TUNES.openB, 104);
    }
    lay(w, 'accordion', 16, SEA_TUNES.openA, 84, { octave: -1 }); lay(w, 'accordion', 24, SEA_TUNES.openB, 86, { octave: -1 });
    lay(w, 'whistle', 32, SEA_TUNES.openA, 80, { legato: 0.95 });
    lay(w, 'accordion', 40, SEA_TUNES.openB, 88, { octave: -1 });
    lay(w, 'whistle', 40, SEA_TUNES.openB, 74, { octave: 1, legato: 0.8, accent: 4 });
    w.hit('crash', 40, 0, 84); w.hit('crash', 0, 0, 70);
  });
}

/** SEASTORM - the storm: the drive and the choir; the horn's theme; the B harmony with the stabs and the strings'
 *  theme high; a breath of ostinato and choir alone; the brass's theme over everything. */
function storm() {
  return makeSong('storm', (w) => {
    const A = SEA_CHORDS.storm, B = SEA_CHORDS.stormB;
    const prog = [...A, ...A, ...B, ...A, ...B, ...A];
    prog.forEach((c, bar) => {
      const breath = bar >= 32 && bar < 40;
      const [r, , f] = stack(c, 2);
      // the drive: the cello (its quick bow, M5) and the bass in eighths on the root, the bar's last two leaning to the fifth and back
      for (let i = 0; i < 8; i++) {
        const n = i === 6 ? f : r;
        w.note('drive', bar, i * 0.5, 0.42, n, (i % 2 === 0 ? 88 : 72) + (i === 0 ? 10 : 0) - (breath ? 18 : 0));
        if (i % 2 === 0) w.note('bass', bar, i * 0.5, 0.45, floored(r - 12), breath ? 66 : 90);
      }
      if (!breath) {
        w.note('timpani', bar, 0, 0.9, at(CHORD[/** @type {keyof typeof CHORD} */ (c)][0], 2), 104); w.note('timpani', bar, 2, 0.9, at(CHORD[/** @type {keyof typeof CHORD} */ (c)][0], 2), 92);
        if (bar % 4 === 3) for (let i = 0; i < 8; i++) w.note('timpani', bar, 2 + i * 0.25, 0.24, 'A2', 60 + i * 6);
        // the stabs in open fifths, on one and the and of two
        if (bar >= 16) for (const n of [r + 12, f + 12, r + 24]) { w.note('brass', bar, 0, 0.5, n, 96); w.note('brass', bar, 1.5, 0.4, n, 84); }
      }
      for (const n of voicing(c, 57)) w.note('choir', bar, 0, 3.9, n, breath ? 70 : 62);
      if (bar % 8 === 0 && !breath) w.hit('crash', bar, 0, 92);
      if (!breath) { w.hit('kick', bar, 0, 90); w.hit('kick', bar, 2, 82); }
      // the unrest: repeated sixteenths, high and soft, over the B harmony
      if ((bar >= 16 && bar < 24) || bar >= 40) for (let i = 0; i < 16; i++) for (const n of voicing(c, 69).slice(0, 2)) w.note('drive', bar, i * 0.25, 0.22, n, 46 + (i % 4 === 0 ? 10 : 0));   // M5: the drive's quick bow, every sixteenth spoken
    });
    lay(w, 'horn', 8, SEA_TUNES.storm, 96);
    lay(w, 'strings', 24, SEA_TUNES.storm, 84, { octave: 1, legato: 0.96 });
    lay(w, 'horn', 40, SEA_TUNES.storm, 98);
    lay(w, 'brass', 40, SEA_TUNES.storm, 92, { octave: 1 });
  });
}

/** SEANIGHT - the sea at night: the tune, then again with the cello under it and the flute's answer an octave down. */
function night() {
  return makeSong('night', (w) => {
    const prog = [...SEA_CHORDS.night, ...SEA_CHORDS.night];
    prog.forEach((c, bar) => {
      // the harp's broken chord: the root on one, the fifth and the tenth together on two, the octave on three
      const s = stack(c, 3);
      w.note('harp', bar, 0, 2.8, s[0], 62); w.note('harp', bar, 1, 1.8, s[2], 48); w.note('harp', bar, 1, 1.8, s[4], 46); w.note('harp', bar, 2, 0.9, s[3], 44);
      for (const n of voicing(c, 57)) w.note('choir', bar, 0, 2.9, n, 40);
      if (bar >= 16) w.note('cello', bar, 0, 2.9, s[0] - 12, 50);
    });
    lay(w, 'flute', 0, SEA_TUNES.night, 76, { legato: 0.97, accent: 4 });
    lay(w, 'flute', 16, SEA_TUNES.night, 72, { legato: 0.97, accent: 4, to: 8 });
    lay(w, 'flute', 24, SEA_TUNES.night, 70, { octave: -1, legato: 0.97, accent: 4, from: 8 });
    // one bell, far off, at the head of each half
    w.note('bells', 0, 0, 6, 'A3', 40); w.note('bells', 16, 0, 6, 'E4', 36);
  });
}

/** The jig's boom-chick: the bass on one and four, the accordion's chord on the eighths after; the bodhran's six. */
function jigBar(w, bar, c, loud) {
  const s = stack(c, 2);
  w.note('bass', bar, 0, 0.9, s[0], loud ? 92 : 84); w.note('bass', bar, 1.5, 0.9, s[2], loud ? 84 : 76);
  for (const n of voicing(c, 62)) { w.note('accordion', bar, 0.5, 0.4, n, 66); w.note('accordion', bar, 1, 0.4, n, 58); w.note('accordion', bar, 2, 0.4, n, 66); w.note('accordion', bar, 2.5, 0.4, n, 58); }
  const v = loud ? 100 : 92;
  w.hit('bodhran', bar, 0, v); w.hit('bodhranTop', bar, 0.5, v - 36); w.hit('bodhranTop', bar, 1, v - 30);
  w.hit('bodhran', bar, 1.5, v - 10); w.hit('bodhranTop', bar, 2, v - 36); w.hit('bodhranTop', bar, 2.5, v - 30);
  w.hit('tambourine', bar, 1.5, loud ? 52 : 42);
}

/** SEAPORT - landfall's jig, AABB twice: the fiddle leads the first time and the whistle the second, the fiddle a
 *  third under it; the whistle over the B parts the first time. */
function port() {
  return makeSong('port', (w) => {
    const prog = [...SEA_CHORDS.portA, ...SEA_CHORDS.portA, ...SEA_CHORDS.portB, ...SEA_CHORDS.portB];
    [...prog, ...prog].forEach((c, bar) => jigBar(w, bar, c, bar >= 32));
    const parts = [SEA_TUNES.portA, SEA_TUNES.portA, SEA_TUNES.portB, SEA_TUNES.portB];
    parts.forEach((t, i) => {
      lay(w, 'fiddle', i * 8, t, 96, { legato: 0.82, accent: 10 });
      if (i >= 2) lay(w, 'whistle', i * 8, t, 70, { legato: 0.7, accent: 6 });
      lay(w, 'whistle', 32 + i * 8, t, 96, { legato: 0.78, accent: 10 });
      lay(w, 'fiddle', 32 + i * 8, t, 82, { legato: 0.82, accent: 8, map: (n) => under(n, 2, D_MAJOR) });
    });
    w.hit('crash', 32, 0, 72);
  });
}

/** SEAFIGHT - a sea fight: the drums and the drive; the brass's theme, A and B; the strings and the fiddle on it with
 *  the choir; then the whole band on it, the horns an octave under the brass. */
function fight() {
  return makeSong('fight', (w) => {
    const A = SEA_CHORDS.fightA, B = SEA_CHORDS.fightB;
    const prog = [...A, ...A, ...B, ...A, ...A, ...B];
    prog.forEach((c, bar) => {
      const [r, t, f] = stack(c, 3);
      // the drive: the cello's quick bow in eighths (M5), root and fifth rocking, the bass on the beat
      for (let i = 0; i < 8; i++) w.note('drive', bar, i * 0.5, 0.42, i % 2 === 0 ? r - 12 : f - 12, i === 0 ? 96 : i % 2 === 0 ? 84 : 70);
      for (let i = 0; i < 4; i++) w.note('bass', bar, i, 0.8, floored(r - 24), i === 0 ? 98 : 86);
      w.note('timpani', bar, 0, 0.9, r - 12, 100); w.note('timpani', bar, 3, 0.4, f - 24, 84);
      // the march: the kick on one and three, the snare on two and four with its drag before four
      w.hit('kick', bar, 0, 98); w.hit('kick', bar, 2, 90);
      w.hit('snare', bar, 1, 92); w.hit('snare', bar, 2.75, 54); w.hit('snare', bar, 3, 96);
      if (bar % 4 === 3) for (let i = 0; i < 4; i++) w.hit('tom', bar, 3 + i * 0.25, 72 + i * 8);
      if (bar % 8 === 0) w.hit('crash', bar, 0, 96);
      // the stabs: the chord whole on one and the and of two, through the intro and the tutti
      if (bar < 8 || bar >= 32) for (const n of [r, t, f]) { w.note('brass', bar, 0, 0.45, n, 92); w.note('brass', bar, 1.5, 0.4, n, 82); }
      if (bar >= 24) for (const n of voicing(c, 57)) w.note('choir', bar, 0, 3.9, n, bar >= 32 ? 66 : 58);
      if (bar >= 8 && bar < 32) for (const n of voicing(c, 62)) w.note('strings', bar, 0, 3.9, n, 52);
    });
    lay(w, 'brass', 8, SEA_TUNES.fightA, 100); lay(w, 'brass', 16, SEA_TUNES.fightB, 102);
    lay(w, 'fiddle', 24, SEA_TUNES.fightA, 98); lay(w, 'strings', 24, SEA_TUNES.fightA, 80, { octave: 1, legato: 0.96 });
    lay(w, 'brass', 32, SEA_TUNES.fightA, 104); lay(w, 'horn', 32, SEA_TUNES.fightA, 92, { octave: -1 });
    lay(w, 'brass', 40, SEA_TUNES.fightB, 106); lay(w, 'horn', 40, SEA_TUNES.fightB, 94, { octave: -1 });
  });
}

let _songs = null;
/** The six songs, made once (pure: the same notes every time). */
export function seaScoreSongs() {
  return (_songs ??= Object.freeze({ calm: calm(), open: open(), storm: storm(), night: night(), port: port(), fight: fight() }));
}

/**
 * THE LAW: what a helm hears - a song's name, or null (not at a helm: the music director stands). `ctx`:
 * `{ sailing, fight, weather, night, nearPort, way }` - at a helm (a passage's too), a sea fight near, the weather's word
 * (systems/weather/weatherFront.js soundWeather's), night, a port's approach, the helm's way in m/s. Pure.
 * @param {{ sailing?: boolean, aboard?: boolean, fight?: boolean, weather?: string, night?: boolean, nearPort?: boolean, way?: number } | null | undefined} ctx
 */
export function seaScoreFor(ctx) {
  if (ctx?.aboard && ctx.fight) return SEA_SONGS.fight;
  if (!ctx?.sailing) return null;
  if (ctx.fight) return SEA_SONGS.fight;
  if (ctx.weather === 'thunder') return SEA_SONGS.storm;
  if (ctx.nearPort) return SEA_SONGS.port;
  if (ctx.night) return SEA_SONGS.night;
  if (!(Number(ctx.way) >= SEA_CALM_WAY) || ctx.weather === 'fog') return SEA_SONGS.calm;
  return SEA_SONGS.open;
}

/** A song's own length (ms), off its shape. Pure. @param {string} name */
export function seaSongMs(name) {
  const key = /** @type {keyof typeof SEA_SHAPE | undefined} */ (Object.keys(SEA_SONGS).find((k) => /** @type {any} */ (SEA_SONGS)[k] === name));
  if (!key) return 0;
  const { bpm, bars, beats } = SEA_SHAPE[key];
  return (bars * beats * 60_000) / bpm;
}

/**
 * THE HOLD over the law: `want(ctx, now)` (now in ms) - the law's song, played whole (its length, never under
 * SEA_SCORE_HOLD_MS) and changed only once the law has wanted another SEA_SCORE_SETTLE_MS on end; a fight or a storm
 * comes in at once; a fight ended keeps its song SEA_FIGHT_TAIL_MS (aboard off the helm too, then none); the helm let go
 * is null at once (and the next helm starts afresh).
 */
export function createSeaScore() {
  /** @type {string | null} */
  let current = null, pending = /** @type {string | null} */ (null);
  let since = -Infinity, fightOverAt = /** @type {number | null} */ (null), pendingSince = -Infinity;
  const take = (/** @type {string | null} */ song, /** @type {number} */ now) => { current = song; since = now; pending = null; fightOverAt = null; return current; };
  return {
    get current() { return current; },
    /** @param {Parameters<typeof seaScoreFor>[0]} ctx @param {number} now */
    want(ctx, now) {
      const law = seaScoreFor(ctx);
      if (law === SEA_SONGS.fight) { fightOverAt = null; pending = null; return current === law ? current : take(law, now); }
      if (current === SEA_SONGS.fight && (law !== null || ctx?.aboard)) {
        fightOverAt ??= now;
        if (now - fightOverAt < SEA_FIGHT_TAIL_MS) return current;
        return take(law, now);
      }
      if (law === null) { take(null, -Infinity); return null; }
      if (current === null || (law === SEA_SONGS.storm && current !== law)) return take(law, now);
      if (law === current) { pending = null; return current; }
      if (pending !== law) { pending = law; pendingSince = now; }
      if (now - since >= Math.max(SEA_SCORE_HOLD_MS, seaSongMs(current)) && now - pendingSince >= SEA_SCORE_SETTLE_MS) take(law, now);
      return current;
    },
  };
}
