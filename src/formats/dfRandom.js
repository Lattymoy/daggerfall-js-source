// Classic Daggerfall random number generator.
// 1:1 translation of Daggerfall Unity's DFRandom.cs (MIT, Daggerfall
// Workshop). Verbatim:
//   next = next * 1103515245 + 12345 (mod 2^64)
//   rand() = (uint)((next >> 16) & 0x7FFF)
//   srand(int) casts through uint (negative seeds wrap).
// The C# state is a ulong, but only its low 32 bits are ever observable
// (rand reads bits 16-30, Seed reads 0-31, srand/Seed load a uint), and
// the low 32 bits of the step depend only on the low 32 bits of the
// state - so a uint32 state with Math.imul is exact.

let next = 1;

/** Seed the generator. Negative ints wrap through uint exactly as C#. */
export function srand(seed) {
  next = seed >>> 0;
}

/** DFRandom.Seed, C#'s settable uint property over the same state.
 *  TalkManagerMCP's MaleName nudges it by +3547 across a name draw and
 *  puts it back (TalkManagerMCP.cs:68-72), so the accessor pair has to
 *  exist for that quirk to be portable at all. */
export function getSeed() { return next; }
export function setSeed(seed) { next = seed >>> 0; }
/** `DFRandom.Seed += delta`, wrapping through uint as C# does. */
export function bumpSeed(delta) { setSeed((getSeed() + delta) | 0); }

/** Next random value in [0, 0x7FFF]. */
export function rand() {
  // AUDIT 68 S10-dfrandom-bigint: three BigInt ops per draw bought nothing.
  next = (Math.imul(next, 1103515245) + 12345) >>> 0;
  return (next >>> 16) & 0x7fff;
}

/** Random number between min and max inclusive, verbatim modulo form. */
export function randomRangeInclusive(min, max) {
  return (rand() % (max - min + 1)) + min;
}

/** DFRandom.random_range(min, max), EXCLUSIVE upper (T3c: the
 *  building-name part draws use this form). */
export function randomRange(min, max) {
  return (rand() % (max - min)) + min;
}
