// @ts-check
// OWN-WORK4 sound audit: A BED IN LAYERS. One long bed played as two or three loops of lengths that share
// no factor - the bed itself and its events (a boat's slaps and creaks, the rain's eave drips) - each started once it
// is made, so the whole comes round only after hours, in less memory than one loop of a minute. Not a DFU member.

/** Each of `keys` started by `start(key)` (the engine's loop or loop3d) as one handle: null while the first, the bed,
 *  cannot start yet (not made, no context), so the caller asks again next frame. Another layer not made yet joins on
 *  the first move or level after it can start, and takes that call; a started layer is never started again.
 *  @param {readonly string[]} keys @param {(key: string) => LoopHandle | null | undefined} start */
export function layeredLoop(keys, start) {
  const bed = keys.length ? start(keys[0]) : null;
  if (!bed) return null;
  /** @type {LoopHandle[]} */
  const handles = [bed];
  let waiting = keys.slice(1);
  const join = () => {
    if (!waiting.length) return;
    waiting = waiting.filter((key) => {
      const handle = start(key);
      if (!handle) return true;
      handles.push(handle);
      return false;
    });
  };
  join();
  const end = () => {
    waiting = [];
  };
  return {
    get layers() {
      return handles.length;
    },
    /** @param {number[]} position */
    move: (position) => {
      join();
      for (const handle of handles) handle.move?.(position);
    },
    /** @param {number} volume */
    setVolume: (volume) => {
      join();
      for (const handle of handles) handle.setVolume?.(volume);
    },
    stop: () => {
      end();
      for (const handle of handles) handle.stop();
    },
    /** @param {number} [seconds] */
    fadeStop: (seconds) => {
      end();
      for (const handle of handles) (handle.fadeStop ? handle.fadeStop(seconds) : handle.stop());
    },
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
  const tick = layers.reduce((common, layer) => (common * BigInt(layer.rate)) / gcd(common, BigInt(layer.rate)), 1n);
  const ticks = layers.map((layer) => (BigInt(layer.samples) * tick) / BigInt(layer.rate));
  const lcm = ticks.reduce((a, b) => (a * b) / gcd(a, b));
  return Number(lcm) / Number(tick);
}
