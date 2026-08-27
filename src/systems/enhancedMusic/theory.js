// ENHANCED MUSIC - the theory the composer writes with. Pure, seeded,
// no audio. (EM1, 2026-08-27, Mac's call: "put my own twists on things
// - a procedural music system", enhanced skin only. OURS, not a port:
// Daggerfall has no generative music and DFU has nothing to translate,
// which is the whole reason it lives behind the enhanced gate and
// never touches the classic path.)
//
// Everything here is a function of a SEED so the same place on the same
// day sounds the same - DFU's own law for its song choice (SongManager
// seeds on gameDays, and a dungeon on its header field), kept for what
// the enhanced side composes.

/** mulberry32 - a small, good 32-bit PRNG. Ours, not DFRandom: the
 *  classic LCG is DFU's law for DFU's rolls and must not be shared
 *  with a generator that would consume it. */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string seed (a dungeon key, a town name) folded to 32 bits. */
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x2a; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Scale-degree intervals from the root, in semitones. */
export const SCALE_MODES = Object.freeze({
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  ionian:     [0, 2, 4, 5, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
});

export const NOTE_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

/** Pitch of scale degree `d` (0-based, any integer - negatives and
 *  overflow wrap by octave) above `root` (a MIDI note) in `mode`. */
export function degreeToPitch(root, mode, d) {
  const scale = SCALE_MODES[mode];
  const n = scale.length;
  const oct = Math.floor(d / n);
  const idx = ((d % n) + n) % n;
  return root + oct * 12 + scale[idx];
}

/** Is a MIDI pitch in the mode (any octave)? */
export function inMode(root, mode, pitch) {
  const pc = (((pitch - root) % 12) + 12) % 12;
  return SCALE_MODES[mode].includes(pc);
}

/** The diatonic triad on degree `d`: three pitches (root, third, fifth
 *  stacked in the mode), plus the seventh when asked. */
export function chordOnDegree(root, mode, d, { seventh = false } = {}) {
  const tones = [0, 2, 4].map((k) => degreeToPitch(root, mode, d + k));
  if (seventh) tones.push(degreeToPitch(root, mode, d + 6));
  return tones;
}

/** Move each pitch into [lo, hi] by octaves. */
export function fitRegister(pitch, lo, hi) {
  let p = pitch;
  while (p < lo) p += 12;
  while (p > hi) p -= 12;
  return p;
}

/** Nearest voicing: revoice `chord` so each tone lands as close as it
 *  can to the previous voicing (common tones hold, the rest move by the
 *  least). Keeps the register window. */
export function voiceLead(prev, chord, lo, hi) {
  if (!prev) return chord.map((p) => fitRegister(p, lo, hi));
  return chord.map((p, i) => {
    const target = prev[Math.min(i, prev.length - 1)];
    let best = fitRegister(p, lo, hi);
    let bestD = Math.abs(best - target);
    for (const cand of [best - 12, best + 12]) {
      if (cand < lo || cand > hi) continue;
      const d = Math.abs(cand - target);
      if (d < bestD) { best = cand; bestD = d; }
    }
    return best;
  });
}

/** Pick one from a weighted list [{ value, weight }] with `rand`. */
export function pickWeighted(rand, items) {
  const total = items.reduce((n, it) => n + (it.weight ?? 1), 0);
  let r = rand() * total;
  for (const it of items) { r -= it.weight ?? 1; if (r <= 0) return it.value; }
  return items[items.length - 1].value;
}

export const pickOne = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
