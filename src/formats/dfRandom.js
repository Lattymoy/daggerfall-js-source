// Classic Daggerfall random number generator.
// 1:1 translation of Daggerfall Unity's DFRandom.cs (MIT, Daggerfall
// Workshop). The state is a C# ulong; JS Numbers cannot hold exact 64-bit
// products, so the state lives in a BigInt masked to 64 bits. Verbatim:
//   next = next * 1103515245 + 12345 (mod 2^64)
//   rand() = (uint)((next >> 16) & 0x7FFF)
//   srand(int) casts through uint (negative seeds wrap).

const MASK64 = (1n << 64n) - 1n;
const MULT = 1103515245n;
const INC = 12345n;

let next = 1n;

/** Seed the generator. Negative ints wrap through uint exactly as C#. */
export function srand(seed) {
  next = BigInt(seed >>> 0);
}

/** DFRandom.Seed, C#'s settable uint property over the same state.
 *  TalkManagerMCP's MaleName nudges it by +3547 across a name draw and
 *  puts it back (TalkManagerMCP.cs:68-72), so the accessor pair has to
 *  exist for that quirk to be portable at all. */
export function getSeed() { return Number(next & 0xffffffffn); }
export function setSeed(seed) { next = BigInt(seed >>> 0); }
/** `DFRandom.Seed += delta`, wrapping through uint as C# does. */
export function bumpSeed(delta) { setSeed((getSeed() + delta) | 0); }

/** Next random value in [0, 0x7FFF]. */
export function rand() {
  next = (next * MULT + INC) & MASK64;
  return Number((next >> 16n) & 0x7fffn);
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
