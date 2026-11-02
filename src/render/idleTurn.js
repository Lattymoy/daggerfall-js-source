// @ts-check
// SHADER-EASE MOUNT-START (2026-10-29): the compile queues' wait between turns (glProgram.js startProgramsInTurn), one
// home for playPrograms.js and mountPrograms.js. A leaf that imports nothing.

/** The browser's next idle, or a quarter second at the most (a timer where it has none, one that never keeps a test's
 *  process alive). @returns {Promise<unknown>} */
export const idleTurn = () =>
  new Promise((resolve) => {
    if (globalThis.requestIdleCallback) globalThis.requestIdleCallback(() => resolve(undefined), { timeout: 250 });
    else /** @type {any} */ (setTimeout(resolve, 50)).unref?.();
  });
