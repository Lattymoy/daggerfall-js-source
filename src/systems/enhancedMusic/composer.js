// ENHANCED MUSIC - the composer. A palette and a seed in, a SONG out -
// the same object the HMI reader hands the scheduler ({ events,
// secondsPerTick, durationTicks }), so it plays through SongPlayer and
// the FM bank with no second audio path. Pure and deterministic: the
// same palette and seed compose the same piece, note for note, which is
// DFU's own law for its song choice kept for what the enhanced side
// writes. (EM1, 2026-08-27.)
//
// THE SHAPE OF A PIECE. Sections of eight bars in the palette's form
// (A A B A2 for the dungeon), each section a progression from the mode's
// table at `barsPerChord`, and four layers written against those chords:
//
//   bed    the chord, voice-led from the last one, held for its bars
//   bass   the chord root on the downbeat of every bar, mostly resting
//          after; a fifth or the octave now and then on beat four
//   motif  a seeded cell of four to six notes - mostly steps, one leap -
//          spoken over the odd chords of A, INVERTED and lifted an octave
//          in B, and given a tail that resolves to the root in A2
//   color  one bell on the root at the turn of each section
//
// Everything a layer does is the palette's record, not the composer's
// opinion: registers, velocities, programs, how often the bass rests,
// how long the cell is. Change the record, change the place.

import {
  seededRandom, degreeToPitch, chordOnDegree, voiceLead, fitRegister, pickWeighted, pickOne, SCALE_MODES,
} from './theory.js';
import { TICKS_PER_BEAT, TICKS_PER_BAR, BARS_PER_SECTION } from './palettes.js';

const lerp = (a, b, t) => a + (b - a) * t;
const irand = (rand, lo, hi) => Math.round(lerp(lo, hi, rand()));

/** The cell: relative degree steps and a rhythm, seeded. */
function composeCell(rand, layer) {
  const n = irand(rand, layer.cell[0], layer.cell[1]);
  const steps = [];
  const leapAt = rand() < layer.leap ? irand(rand, 1, n - 2) : -1;
  for (let i = 1; i < n; i++) {
    if (i === leapAt) steps.push(pickOne(rand, [4, -4, 3, -3, 5]));
    else steps.push(pickOne(rand, [-2, -1, -1, 1, 1, 2]));
  }
  // Durations in ticks: quarter, dotted quarter, half, dotted half - the
  // cell must fit its two bars, so the rhythm is drawn until it does.
  const pool = [TICKS_PER_BEAT, TICKS_PER_BEAT * 1.5, TICKS_PER_BEAT * 2, TICKS_PER_BEAT * 3];
  let rhythm;
  for (let tries = 0; tries < 12; tries++) {
    rhythm = Array.from({ length: n }, () => (rand() < layer.dotted ? pool[1] : pickOne(rand, [pool[0], pool[0], pool[2], pool[3]])));
    if (rhythm.reduce((s, d) => s + d, 0) <= TICKS_PER_BAR * 2) break;
    rhythm = null;
  }
  if (!rhythm) rhythm = Array.from({ length: n }, () => TICKS_PER_BEAT);
  return { steps, rhythm };
}

/** One statement of the cell over one chord, in the register, as events. */
function speakCell(cell, { root, mode, chordDegree, layer, startTick, rand, invert = false, lift = 0, tail = false, velocityBias = 0 }) {
  const events = [];
  // Start on a chord tone of the chord being sounded: its root, third or fifth.
  let degree = chordDegree + pickOne(rand, [0, 2, 4]) + lift;
  let tick = startTick;
  const [lo, hi] = layer.register;
  const say = (deg, dur) => {
    const pitch = fitRegister(degreeToPitch(root, mode, deg), lo, hi);
    events.push({
      tick, type: 'noteOn', channel: layer.channel, note: pitch,
      velocity: Math.max(1, Math.min(127, irand(rand, layer.velocity[0], layer.velocity[1]) + velocityBias)),
      duration: Math.max(TICKS_PER_BEAT / 2, dur - 6),
    });
    tick += dur;
  };
  say(degree, cell.rhythm[0]);
  cell.steps.forEach((s, i) => { degree += invert ? -s : s; say(degree, cell.rhythm[i + 1]); });
  if (tail) {
    // Two notes that land on the chord root: the step above, then home.
    say(chordDegree + 1 + lift, TICKS_PER_BEAT);
    say(chordDegree + lift, TICKS_PER_BEAT * 2);
  }
  return events;
}

/**
 * Compose a piece.
 * @param {object} palette   a PALETTES record
 * @param {number} seed      32-bit seed (hashSeed of the place)
 * @param {object} [opts]    { bpm, root, mode } to pin any of the three
 *                           (a scored place hands its track's key/tempo)
 * @returns a song for SongPlayer: { name, events, secondsPerTick,
 *          durationTicks, meta }
 */
export function composeScore(palette, seed, opts = {}) {
  const rand = seededRandom(seed);
  const bpm = opts.bpm ?? irand(rand, palette.tempo[0], palette.tempo[1]);
  const mode = opts.mode ?? pickWeighted(rand, palette.modes);
  const root = opts.root ?? irand(rand, palette.roots[0], palette.roots[1]);
  if (!SCALE_MODES[mode]) throw new Error(`enhancedMusic: unknown mode ${mode}`);
  const L = palette.layers;
  const sectionTicks = TICKS_PER_BAR * BARS_PER_SECTION;
  const chordTicks = TICKS_PER_BAR * palette.barsPerChord;
  const chordsPerSection = BARS_PER_SECTION / palette.barsPerChord;

  // Progressions: A gets one row, B another; A2 is A's.
  const rows = palette.progressions[mode] ?? Object.values(palette.progressions)[0];
  const progA = pickOne(rand, rows);
  const progB = rows.length > 1 ? pickOne(rand, rows.filter((r) => r !== progA)) : progA;
  const cell = composeCell(rand, L.motif);

  const events = [];
  // Programs, volumes and pans, at the top, one per layer.
  for (const layer of Object.values(L)) {
    events.push({ tick: 0, type: 'programChange', channel: layer.channel, program: layer.program });
    events.push({ tick: 0, type: 'controller', channel: layer.channel, controller: 7, value: layer.volume });
    events.push({ tick: 0, type: 'controller', channel: layer.channel, controller: 10, value: layer.pan });
  }

  let prevVoicing = null;
  palette.form.forEach((section, s) => {
    const base = s * sectionTicks;
    const prog = section === 'B' ? progB : progA;
    const isB = section === 'B';
    const isLast = s === palette.form.length - 1;
    const bias = isB ? 8 : 0;

    // color: the bell at the turn of B and of the last section
    if (isB || isLast) {
      const [lo, hi] = L.color.register;
      events.push({ tick: base, type: 'noteOn', channel: L.color.channel, note: fitRegister(root, lo, hi),
        velocity: irand(rand, L.color.velocity[0], L.color.velocity[1]), duration: TICKS_PER_BAR * 2 });
    }

    for (let c = 0; c < chordsPerSection; c++) {
      const degree = prog[c % prog.length];
      const at = base + c * chordTicks;

      // bed
      const chord = chordOnDegree(root, mode, degree, { seventh: rand() < L.bed.seventh });
      const voicing = voiceLead(prevVoicing, chord, L.bed.register[0], L.bed.register[1]);
      prevVoicing = voicing;
      for (const pitch of voicing) {
        events.push({ tick: at, type: 'noteOn', channel: L.bed.channel, note: pitch,
          velocity: irand(rand, L.bed.velocity[0], L.bed.velocity[1]) + bias, duration: chordTicks - 12 });
      }

      // bass: the root each bar, then mostly nothing
      const [blo, bhi] = L.bass.register;
      const bassRoot = fitRegister(degreeToPitch(root, mode, degree), blo, bhi);
      for (let bar = 0; bar < palette.barsPerChord; bar++) {
        const b0 = at + bar * TICKS_PER_BAR;
        events.push({ tick: b0, type: 'noteOn', channel: L.bass.channel, note: bassRoot,
          velocity: irand(rand, L.bass.velocity[0], L.bass.velocity[1]) + bias, duration: TICKS_PER_BEAT * 3 - 6 });
        const r = rand();
        if (r >= L.bass.restBeat4) {
          const fifth = r < L.bass.restBeat4 + L.bass.fifthBeat4;
          // The octave only when the register has room for it; a clamp to
          // the register's edge is a pitch outside the mode.
          const note = fifth ? fitRegister(degreeToPitch(root, mode, degree + 4), blo, bhi)
            : (bassRoot + 12 <= bhi ? bassRoot + 12 : bassRoot);
          events.push({ tick: b0 + TICKS_PER_BEAT * 3, type: 'noteOn', channel: L.bass.channel, note,
            velocity: irand(rand, L.bass.velocity[0], L.bass.velocity[1]) - 8, duration: TICKS_PER_BEAT - 6 });
        }
      }

      // motif: A speaks on the odd chords, B on all but the last (inverted,
      // an octave up), A2 on the odd chords with the tail on the last.
      const speaks = isB ? c < chordsPerSection - 1 : c % 2 === 0;
      if (speaks) {
        events.push(...speakCell(cell, {
          root, mode, chordDegree: degree, layer: L.motif, startTick: at, rand,
          invert: isB, lift: isB ? 7 : 0, tail: isLast && c === chordsPerSection - 2, velocityBias: bias,
        }));
      }
    }
  });

  // The cadence: a held root in the bed on the final chord's last bar.
  const total = sectionTicks * palette.form.length;
  events.sort((a, b) => a.tick - b.tick || (a.type === 'noteOn') - (b.type === 'noteOn'));
  return {
    name: `enhanced:${palette.id}:${seed >>> 0}`,
    events,
    secondsPerTick: 1 / bpm,
    durationTicks: total,
    meta: { bpm, mode, root, form: [...palette.form], progressions: { A: progA, B: progB }, cell },
  };
}
