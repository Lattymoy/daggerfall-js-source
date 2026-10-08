// The .NET runtime members DFU's C# leans on for a seed, ported once. A leaf: it imports nothing.
//
// AUDIT 68 S24-string-hash-duplicate: string.GetHashCode had two byte-identical homes - answerPipeline's
// knowledge seed (stringHash) and Better Ambience's dungeon fog seed (monoStringHash) - each recorded as its
// own Ledger A departure. It lives here now and both import it.
//
// HAZE1 (2026-10-08): System.Random had the same two homes - scenes/shared.js's NetRandom (DaggerfallSky's stars) and
// Better Ambience's SystemRandom (Foggy Dungeons' fog) - and Heat Haze's noise and Windfall's gusts each wanted a
// third. It lives here now; shared.js and betterAmbience.js re-export it under their own names.

/** string.GetHashCode as Mono's corlib computes it: h = (h << 5) - h + c over the chars (Mono walks two per
 *  turn, which is the same sum), int32. The runtime's hash is not stable across processes and Unity's is not
 *  verifiable from outside (Ledger A), so a DFU player may get a different value for the same string; what
 *  the port keeps is that it is DETERMINISTIC, here as there. */
export function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

// ---- System.Random -------------------------------------------------------------------------------------------------
// .NET System.Random, the seeded Knuth subtractive generator, ported byte-exact (the reference's Net5CompatSeedImpl -
// what Mono's corlib, and so Unity's, runs for `new Random(seed)`). DaggerfallSky holds `new System.Random(0)` (:74),
// Foggy Dungeons seeds one with a dungeon's name, Heat Haze one with 1212701233 for its noise and Windfall one with
// each day's context for its gusts: each is a pure function of its sequence, so a different generator paints
// different stars, fog, shimmer and gusts - a DATA law, not an engine detail, and the Ledger's engine-PRNG row (which
// covers UnityEngine.Random) does not cover it.
const MBIG = 2147483647;   // int.MaxValue
const MSEED = 161803398;

export class NetRandom {
  constructor(seed = 0) {
    this._seedArray = new Int32Array(56);
    const subtraction = seed === -2147483648 ? MBIG : Math.abs(seed);
    let mj = MSEED - subtraction;
    this._seedArray[55] = mj;
    let mk = 1;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this._seedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += MBIG;
      mj = this._seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this._seedArray[i] -= this._seedArray[1 + ((i + 30) % 55)];
        if (this._seedArray[i] < 0) this._seedArray[i] += MBIG;
      }
    }
    this._inext = 0;
    this._inextp = 21;
  }

  /** Random.InternalSample */
  _internalSample() {
    let locINext = this._inext;
    let locINextp = this._inextp;
    if (++locINext >= 56) locINext = 1;
    if (++locINextp >= 56) locINextp = 1;
    let retVal = this._seedArray[locINext] - this._seedArray[locINextp];
    if (retVal === MBIG) retVal--;
    if (retVal < 0) retVal += MBIG;
    this._seedArray[locINext] = retVal;
    this._inext = locINext;
    this._inextp = locINextp;
    return retVal;
  }

  /** Random.Sample / Random.NextDouble */
  nextDouble() {
    return this._internalSample() * (1.0 / MBIG);
  }

  /** Random.Next(minValue, maxValue), small-range arm. */
  next(minValue, maxValue) {
    const range = maxValue - minValue;
    return Math.trunc(this.nextDouble() * range) + minValue;
  }
}
