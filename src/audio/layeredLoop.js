// @ts-check
// OWN-WORK4 sound audit (2026-11-01): A BED IN LAYERS. One long bed played as two or three loops of lengths that share
// no factor - the bed itself and its events (a boat's slaps and creaks, the rain's eave drips) - started together, so
// the whole comes round only after hours, in less memory than one loop of a minute. Not a DFU member.

/** Each of `keys` started by `start(key)` (the engine's loop or loop3d) as one handle; null, none left playing, while
 *  any layer cannot start yet (not made, no context), so the caller asks again next frame.
 *  @param {readonly string[]} keys @param {(key: string) => LoopHandle | null | undefined} start */
export function layeredLoop(keys, start) {
  /** @type {LoopHandle[]} */
  const handles = [];
  for (const key of keys) {
    const handle = start(key);
    if (!handle) {
      for (const made of handles) made.stop();
      return null;
    }
    handles.push(handle);
  }
  return {
    layers: handles.length,
    /** @param {number[]} p */
    move: (p) => handles.forEach((h) => h.move?.(p)),
    /** @param {number} v */
    setVolume: (v) => handles.forEach((h) => h.setVolume?.(v)),
    stop: () => handles.forEach((h) => h.stop()),
    /** @param {number} [seconds] */
    fadeStop: (seconds) => handles.forEach((h) => (h.fadeStop ? h.fadeStop(seconds) : h.stop())),
  };
}

/** @typedef {{ stop(): void, setVolume?(v: number): void, move?(p: number[]): void, fadeStop?(s?: number): void }} LoopHandle */
/** How long, in seconds, layers of these lengths (whole numbers of samples at their rates) take to come round together. */
export function layersPeriod(/** @type {ReadonlyArray<{ samples: number, rate: number }>} */ layers) {
  const gcd = (/** @type {bigint} */ a, /** @type {bigint} */ b) => {
    while (b) [a, b] = [b, a % b];
    return a;
  };
  // each period is samples / rate s: their LCM is lcm(samples_i * R / rate_i) / R over a common tick R
  const tick = layers.reduce((r, l) => (r * BigInt(l.rate)) / gcd(r, BigInt(l.rate)), 1n);
  const ticks = layers.map((l) => (BigInt(l.samples) * tick) / BigInt(l.rate));
  const lcm = ticks.reduce((a, b) => (a * b) / gcd(a, b));
  return Number(lcm) / Number(tick);
}
