// AUDIT 68 X3-transition-build-race: the mode host's door builds, made
// serial and cancellable.
//
// DFU's transitions are synchronous. The port's are not: enterInteriorCore
// and tryEnterDungeon await a build for seconds while the host's frame,
// its keys, a load and a teleport all keep running outdoors. A build that
// finished after the world moved under it published itself anyway, and
// two builds in flight wrote the one context slot in whichever order they
// resolved, orphaning the other.
//
// So: ONE build at a time - a second request WAITS for the first to
// unwind rather than overlapping or being dropped (ASYNC NEVER DROPS) -
// and anything that moves the world aborts the pending build, which then
// frees what it made instead of publishing it.

export function createTransitionGate() {
  let gen = 0;
  let inFlight = null;   // { promise, resolve } of the build holding the gate, null when idle
  return {
    /** Wait for any build in flight to unwind, then hold the gate. The
     *  token is taken at the REQUEST, so a request the world moved under
     *  while it waited answers null and never holds the gate. */
    async begin() {
      const token = gen;
      while (inFlight) await inFlight.promise;
      if (token !== gen) return null;
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      inFlight = { promise, resolve };
      return token;
    },
    /** False once the world moved since `token` was taken. */
    valid(token) { return token === gen; },
    /** The world moved: every pending build is stale. */
    abort() { gen++; },
    /** The build holding the gate has unwound. */
    end() {
      const held = inFlight;
      inFlight = null;
      held?.resolve();
    },
    /** Resolves once no build holds the gate. */
    async settled() {
      while (inFlight) await inFlight.promise;
    },
  };
}
