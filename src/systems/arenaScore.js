// @ts-check
// ARENA2 (2026-10-02, Mac: "extremely detailed and authentic ... AAA grade"): THE ARENA'S MUSIC - a march for the call
// and the fight, and a victory fanfare for the verdict, made in code as the Warden's score is (systems/gateScore.js -
// the precedent and its reasons: MIDI.BSA holds no fight music) and played by the game's own player and FM bank under
// names of their own (music.registerSong), so a music pack can replace them by name as it replaces any song.
//
//   ARENAMAR - THE MARCH. B-flat major, 116 BPM, sixteen bars that loop on their bar line: a snare's rudiments and the
//              bass drum on one and three, the timpani on the tonic and the dominant, the tuba's oom-pah, the
//              trumpets' call over it (a rising fourth and a dotted figure, the tourney's horn), the horns' answer, the
//              strings holding the chord. Heraldic, not grim - the Burning Court's score is the villain's; this is the
//              crowd's holiday.
//   ARENAWIN - THE VICTORY. A timpani roll into the trumpets' call in full, the strings and choir on the major chord,
//              a crash; then quiet - the law stops it once it has sounded.
//
// THE LAW (`arenaScoreFor`): no bout, no score (the host's director stands); the call, the walk, the count and the
// fight, the march; the end and the verdict, the fanfare (for ARENA_STING_MS from when it began), then silence through
// the healers. Pure. Not a DFU member. Ledger A (ARENA).

import { midiNote } from './gateScore.js';

export const ARENA_SONGS = Object.freeze({ march: 'ARENAMAR.HMI', win: 'ARENAWIN.HMI' });
export const ARENA_SCORE_SILENCE = 'silence';
/** How long the fanfare is given before the floor falls quiet (its bars at 96 BPM and their ring). */
export const ARENA_STING_MS = 9000;
const TPQ = 60;
/** GM programs (gmSynth.js FM bank) and channels: one voice each, the kit on GM's channel 9. */
export const ARENA_PROGRAMS = Object.freeze({ trumpet: 56, horn: 60, tuba: 58, strings: 48, choir: 52, timpani: 47, snareRoll: 47, bells: 14 });
const CH = Object.freeze({ trumpet: 0, horn: 1, tuba: 2, strings: 3, choir: 4, timpani: 5, bells: 6, kit: 9 });
const MIX = Object.freeze({ trumpet: [118, 64], horn: [104, 48], tuba: [108, 64], strings: [92, 82], choir: [96, 70], timpani: [110, 64], bells: [88, 76] });
const KIT = Object.freeze({ kick: 36, snare: 38, rim: 37, crash: 49, ride: 51, tom: 45 });
export const ARENA_SCORE_LEVEL = Object.freeze({ march: 1.25, win: 1.45 });

function makeSong(name, bpm, bars, write, level) {
  const events = [];
  const tick = (bar, beat) => Math.round((bar * 4 + beat) * TPQ);
  const w = {
    note(voice, bar, beat, beats, n, vel) {
      events.push({ tick: tick(bar, beat), type: 'noteOn', channel: CH[voice], note: typeof n === 'number' ? n : midiNote(n), velocity: Math.max(1, Math.min(127, Math.round(vel))), duration: Math.max(1, Math.round(beats * TPQ)) });
    },
    hit(key, bar, beat, vel) { w.note('kit', bar, beat, 0.25, KIT[key], vel); },
  };
  write(w);
  for (const [voice, [lv, pan]] of Object.entries(MIX)) {
    events.push({ tick: 0, type: 'programChange', channel: CH[voice], program: ARENA_PROGRAMS[voice] ?? 0 });
    events.push({ tick: 0, type: 'controller', channel: CH[voice], controller: 7, value: lv });
    events.push({ tick: 0, type: 'controller', channel: CH[voice], controller: 10, value: pan });
  }
  events.push({ tick: 0, type: 'controller', channel: CH.kit, controller: 7, value: 108 });
  const rank = { programChange: 0, controller: 0, noteOn: 1 };
  events.sort((a, b) => a.tick - b.tick || rank[a.type] - rank[b.type]);
  return { name, press: null, beatsPerMinute: bpm, secondsPerTick: 60 / (bpm * TPQ), events, durationTicks: bars * 4 * TPQ, seamless: true, level };
}

/** The march's harmony, a chord a bar: I - IV - V - I, I - vi - ii - V, twice (B-flat major). */
const PROG = Object.freeze(['Bb', 'Eb', 'F', 'Bb', 'Bb', 'Gm', 'Cm', 'F']);
const CHORD = Object.freeze({
  Bb: { root: 'Bb1', fifth: 'F2', triad: ['Bb3', 'D4', 'F4'] }, Eb: { root: 'Eb2', fifth: 'Bb1', triad: ['Bb3', 'Eb4', 'G4'] },
  F: { root: 'F1', fifth: 'C2', triad: ['A3', 'C4', 'F4'] }, Gm: { root: 'G1', fifth: 'D2', triad: ['Bb3', 'D4', 'G4'] },
  Cm: { root: 'C2', fifth: 'G1', triad: ['C4', 'Eb4', 'G4'] },
});
/** The trumpets' call: [note, beats] a bar, eight bars - the rising fourth, the dotted tourney figure, the cadence. */
/** @type {ReadonlyArray<ReadonlyArray<[string, number]>>} */
const CALL = Object.freeze([
  [['F4', 1], ['Bb4', 1.5], ['Bb4', 0.5], ['Bb4', 1]],
  [['C5', 1], ['Bb4', 0.5], ['G4', 0.5], ['Eb5', 2]],
  [['D5', 1.5], ['C5', 0.5], ['A4', 1], ['F4', 1]],
  [['Bb4', 3], ['F4', 1]],
  [['D5', 1], ['F5', 1.5], ['D5', 0.5], ['Bb4', 1]],
  [['G4', 1], ['Bb4', 1], ['D5', 1], ['G5', 1]],
  [['Eb5', 1.5], ['D5', 0.5], ['C5', 1], ['A4', 1]],
  [['Bb4', 2], ['F4', 1], ['Bb4', 1]],
]);

/** ARENAMAR - the march: sixteen bars, the call twice (the second an octave of horns under it). */
function march() {
  return makeSong(ARENA_SONGS.march, 116, 16, (w) => {
    for (let bar = 0; bar < 16; bar++) {
      const c = CHORD[PROG[bar % 8]];
      // the oom-pah: the tuba on one and three (the root, then the fifth), the strings' chord on two and four
      w.note('tuba', bar, 0, 0.9, c.root, 104); w.note('tuba', bar, 2, 0.9, c.fifth, 96);
      for (const n of c.triad) { w.note('strings', bar, 1, 0.8, n, 74); w.note('strings', bar, 3, 0.8, n, 70); }
      w.note('timpani', bar, 0, 0.9, bar % 4 === 2 ? 'F2' : 'Bb1', 104);
      if (bar % 4 === 3) for (let i = 0; i < 8; i++) w.note('timpani', bar, 2 + i * 0.25, 0.24, 'F2', 70 + i * 5);
      // the kit: the bass drum on one and three, the snare's march (a flam on two, the rolled four), a crash each phrase
      w.hit('kick', bar, 0, 104); w.hit('kick', bar, 2, 96);
      w.hit('snare', bar, 1, 100); w.hit('snare', bar, 1.75, 70); w.hit('snare', bar, 3, 102);
      for (let i = 0; i < 4; i++) w.hit('snare', bar, 3.25 + i * 0.1875, 64 + i * 8);
      if (bar % 8 === 0) w.hit('crash', bar, 0, 96);
      if (bar % 8 === 7) w.note('bells', bar, 3, 1, 'F5', 70);
    }
    for (let half = 0; half < 2; half++) {
      CALL.forEach((notes, bb) => {
        let beat = 0;
        for (const [n, beats] of notes) {
          w.note('trumpet', half * 8 + bb, beat, beats * 0.9, n, 112 + (beat === 0 ? 8 : 0));
          if (half === 1) w.note('horn', half * 8 + bb, beat, beats * 0.9, midiNote(n) - 12, 98);
          beat += beats;
        }
      });
    }
  }, ARENA_SCORE_LEVEL.march);
}

/** ARENAWIN - the victory: four bars of fanfare and a held chord, then quiet. */
function win() {
  return makeSong(ARENA_SONGS.win, 96, 8, (w) => {
    for (let i = 0; i < 16; i++) w.note('timpani', 0, i * 0.25, 0.24, 'Bb1', 56 + i * 4);
    /** @type {Array<[string, number, number]>} */
    const call = [['F4', 0, 0.5], ['Bb4', 0.5, 0.5], ['D5', 1, 1], ['F5', 2, 2]];
    for (const [n, b, len] of call) { w.note('trumpet', 1, b, len * 0.95, n, 124); w.note('horn', 1, b, len * 0.95, midiNote(n) - 12, 104); }
    /** @type {Array<[string, number, number]>} */
    const answer = [['Eb5', 0, 1], ['D5', 1, 1], ['C5', 2, 1], ['D5', 3, 1]];
    for (const [n, b, len] of answer) w.note('trumpet', 2, b, len * 0.95, n, 118);
    w.note('trumpet', 3, 0, 4, 'Bb4', 122); w.note('horn', 3, 0, 4, 'F4', 108);
    for (const n of ['Bb3', 'D4', 'F4']) { w.note('strings', 1, 0, 11, n, 96); w.note('choir', 1, 0, 11, n, 100); }
    w.note('tuba', 1, 0, 11, 'Bb1', 112);
    w.note('timpani', 1, 0, 1, 'Bb1', 116); w.hit('crash', 1, 0, 108); w.hit('kick', 1, 0, 110);
    w.note('timpani', 3, 0, 1, 'Bb1', 116); w.hit('crash', 3, 0, 104);
    w.note('bells', 3, 0, 4, 'Bb5', 96);
  }, ARENA_SCORE_LEVEL.win);
}

let _songs = null;
/** The two songs, made once (pure: the same notes every time). */
export function arenaScoreSongs() { return (_songs ??= Object.freeze({ march: march(), win: win() })); }

/**
 * THE LAW: what the floor plays for a bout in `phase` whose verdict began at `verdictAt` (ms, the bout's clock; NaN
 * before), at `now` - a song's name, ARENA_SCORE_SILENCE, or null (no bout: the director stands).
 */
export function arenaScoreFor(phase, verdictAt, now) {
  if (!phase || phase === 'done') return null;
  if (phase === 'call' || phase === 'walk' || phase === 'count' || phase === 'fight') return ARENA_SONGS.march;
  if (Number.isFinite(verdictAt) && now - verdictAt < ARENA_STING_MS) return ARENA_SONGS.win;
  return ARENA_SCORE_SILENCE;
}
