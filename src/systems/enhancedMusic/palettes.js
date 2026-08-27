// ENHANCED MUSIC - the palettes: one record per place, the whole of what
// the composer knows about how a place should sound. Records, not
// modules: a new place is a new record here, never a new branch in the
// composer. (EM1, 2026-08-27.)
//
// Keys are songManager's MUSIC_ENV names, so the director's own answer
// for "what environment is this" is the palette lookup, unchanged. A
// place with no record keeps its classic song under the enhanced skin,
// which is the honest state until its record is written.
//
// Programs are General MIDI numbers, resolved by gmSynth/fmSpec exactly
// as the classic songs' are - the underscore and the archive share one
// bank, so a palette can never ask for a voice the synth lacks.

/** The HMI clock the scheduler runs on: sixty ticks per quarter. */
export const TICKS_PER_BEAT = 60;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;   // 240
export const BARS_PER_SECTION = 8;

/** Chord degrees per mode, 0-based (0 = i). Each row is one 8-bar
 *  section at two bars a chord. */
const DARK_PROGRESSIONS = Object.freeze({
  aeolian:       [[0, 5, 2, 6], [0, 3, 0, 4], [0, 6, 5, 6], [0, 5, 3, 0]],
  phrygian:      [[0, 1, 0, 6], [0, 3, 1, 0], [0, 1, 5, 1], [0, 6, 1, 0]],
  locrian:       [[0, 1, 0, 4], [0, 5, 1, 0], [0, 3, 1, 0]],
  harmonicMinor: [[0, 5, 4, 0], [0, 3, 4, 0], [0, 6, 4, 0]],
  dorian:        [[0, 3, 0, 6], [0, 5, 3, 0], [0, 3, 4, 0]],
});

export const MUSIC_PALETTES = Object.freeze({
  /** THE DUNGEON: the first place every game is heard in. Slow, dark,
   *  spacious - a pad bed two bars a chord, a bass that mostly rests, a
   *  motif that speaks in half the bars and says nothing in the rest,
   *  and one bell at the turn of each section. The silence is a layer. */
  dungeonInterior: Object.freeze({
    id: 'dungeonInterior',
    tempo: [52, 64],
    modes: [
      { value: 'phrygian', weight: 3 }, { value: 'aeolian', weight: 3 },
      { value: 'locrian', weight: 1 }, { value: 'harmonicMinor', weight: 1 },
    ],
    roots: [40, 47],                       // E2..B2: the tonic sits low
    form: ['A', 'A', 'B', 'A2'],           // 32 bars, then the loop
    barsPerChord: 2,
    progressions: DARK_PROGRESSIONS,
    layers: Object.freeze({
      bed:   { channel: 0, program: 89, register: [40, 59], velocity: [66, 78], volume: 96,  pan: 64, seventh: 0.35,
               mix: { floor: 1, full: 0.75, from: 0.4, to: 0.9 } },                      // darkens a little under danger
      bass:  { channel: 1, program: 33, register: [28, 40], velocity: [86, 100], volume: 118, pan: 64, restBeat4: 0.6, fifthBeat4: 0.25 },
      motif: { channel: 2, program: 52, register: [60, 79], velocity: [80, 100], volume: 122, pan: 54, cell: [4, 6], leap: 0.3, dotted: 0.35,
               mix: { floor: 1, full: 0.3, from: 0.3, to: 0.8 } },                       // the motif THINS as danger rises
      color: { channel: 3, program: 14, register: [52, 67], velocity: [74, 90], volume: 104, pan: 74 },
      /** THE TENSION LAYERS (EM4b): composed for the whole loop and SILENT
       *  at rest - their mix floor is 0 - they come up with the danger
       *  level, on the grid they were written on, so they never enter
       *  off the beat. tension: a low pulse on one and three plus a
       *  dissonant sustained pair in the strings; drive: an eighth-note
       *  ostinato on the root and fifth. */
      tension: { channel: 4, program: 47, register: [36, 48], velocity: [90, 110], volume: 118, pan: 60,
                 pair: { program: 48, channel: 6, register: [64, 76], velocity: [60, 76], volume: 100, pan: 80 },
                 mix: { floor: 0, full: 1, from: 0.2, to: 0.7 } },
      drive:   { channel: 5, program: 39, register: [33, 45], velocity: [92, 112], volume: 116, pan: 44,
                 mix: { floor: 0, full: 1, from: 0.5, to: 1 } },
    }),
  }),
});

/** THE MIX LAW (EM4b). A layer with a `mix` record sits at `floor` when
 *  the danger level is at or below `from`, at `full` at or above `to`,
 *  and eases (smoothstep) between; a layer without one is always 1.
 *  Pure: the level in, one gain per channel out - the stem system's
 *  vertical mix, over material the composer wrote instead of files. */
export function layerMix(palette, level) {
  const t = Math.max(0, Math.min(1, level));
  const out = {};
  const apply = (layer) => {
    const m = layer.mix;
    if (!m) { out[layer.channel] = 1; return; }
    const u = m.to <= m.from ? (t >= m.to ? 1 : 0) : Math.max(0, Math.min(1, (t - m.from) / (m.to - m.from)));
    const e = u * u * (3 - 2 * u);
    out[layer.channel] = m.floor + (m.full - m.floor) * e;
  };
  for (const layer of Object.values(palette.layers)) {
    apply(layer);
    if (layer.pair) out[layer.pair.channel] = out[layer.channel];   // a paired voice rides its layer's mix
  }
  return out;
}

/** The palette for an environment, or null: no record, classic song. */
export const paletteFor = (environment) => MUSIC_PALETTES[environment] ?? null;
