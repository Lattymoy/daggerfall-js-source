// @ts-check
// PERF-WARM (2026-09-19): THE COMPILE THAT HAPPENS MID-FRAME.
//
// PERF-TEX/PERF-TEX2/PERF-UI took GL calls out of the steady frame.
// This takes out a different kind of cost, and the one a player
// actually feels: a HITCH. Seven programs in this renderer were built
// the first time something needed them, and "the first time" is always
// inside a draw call, which is always inside a frame:
//
//   - `particleProgram`      the first spell effect that draws
//   - `charQuadProgram`      the first classic character sprite
//   - `screenQuadProgram`    the first 2D blit of the session
//   - `screenQuadRunProgram` the first instanced 2D run
//   - `overlayProgram`       the first full-screen overlay
//   - the lab's rain and pixel-snow programs, in precipitation.js
//
// A compile-and-link is a DRIVER call. It is not a few hundred GL
// calls that add up - it is one call that can stall the calling
// thread for tens of milliseconds while the driver runs its own
// compiler, and nothing in this codebase can make it cheaper. The
// only thing that can be done with it is to MOVE it: off the frame
// that needs the program and onto time the browser was going to spend
// idle anyway.
//
// WHAT THIS DOES NOT CLAIM. Unlike the GL-call work, the size of this
// win is not measured here and cannot be: `test/glstate.test.js`
// drives a stub, and a stub does not compile shaders. The claim is
// structural - the program is built before the first draw needs it
// rather than during it - and the number belongs to whatever driver
// the player is running. What IS pinned is the structure: that every
// step is idempotent, that the draw path still builds on demand for
// anyone who never warms, and that a step which throws does not take
// the rest of the warm down with it.

/** Pay for a renderer's on-demand programs during idle time, one at a
 *  time, each behind its own idle wait - the shape MENU1's
 *  `warmEnhancedChunks` settled on, for the same reason: five compiles
 *  back to back in one callback would be the stall this exists to
 *  remove, just moved somewhere less visible.
 *
 *  Answers how many steps actually ran (the tests drive it with their
 *  own scheduler). The latch is per-call, not per-session: a scene that
 *  boots a second renderer warms it too. */
export async function warmPrograms(steps, {
  idle = (fn) => (globalThis.requestIdleCallback
    ? globalThis.requestIdleCallback(fn, { timeout: 4000 })
    : setTimeout(fn, 1500)),
  alive = () => true,
} = {}) {
  let done = 0;
  for (const step of steps) {
    if (!alive()) break;
    await new Promise((resolve) => idle(resolve));
    if (!alive()) break;
    // A warm is an optimisation and never a failure: whatever a step
    // could not build, the draw that needs it will build the same way
    // it always did, and throw there if it is going to throw.
    try { step(); done++; } catch { /* the draw path is still the one that reports */ }
  }
  return done;
}
