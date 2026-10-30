// FOUNDATION F5 (2026-10-30, bible/03-World/Foundation-Arc.md): THE BUILD'S OPEN FILES HELD. Vite reads every asset the
// game imports with `fsp.readFile` and no cap (vite/dist/node/chunks/node.js resolveBuiltAsset), and the eager globs
// over vendor/ name all 13,134 of its PNGs at once - past the C runtime's open-file limit on Windows, where the
// production build failed about half the time with EMFILE. The shared node:fs/promises object's readFile is wrapped:
// at most OPEN_FILES_MAX reads open at once, and a read refused with EMFILE or ENFILE asked again after a growing wait,
// OPEN_FILES_RETRIES times at most (AUDIT FOUNDATION A4: a descriptor never freed fails the build, never spins it).
import fsp from 'node:fs/promises';

/** The most reads open at once - far under Windows' 8,192, and no slower on any disk. */
export const OPEN_FILES_MAX = 256;
/** The most times one read refused for want of a handle is asked again, and its wait's ceiling, ms. */
export const OPEN_FILES_RETRIES = 40;
export const OPEN_FILES_WAIT_MAX_MS = 500;

/**
 * Wraps `target.readFile` once: queued past `max` open, a busy refusal asked again. Answers its tally.
 * @param {{ readFile: (...a: any[]) => Promise<any> }} [target] @param {number} [max] @param {number} [retries]
 * @returns {{ max: number, most: () => number, retried: () => number }}
 */
export function limitOpenFiles(target = fsp, max = OPEN_FILES_MAX, retries = OPEN_FILES_RETRIES) {
  const had = /** @type {any} */ (target.readFile).limited;
  if (had) return had;
  const real = target.readFile;
  /** @type {{ args: any[], ok: (v: any) => void, no: (e: any) => void, tries: number }[]} */ const queue = [];
  let open = 0, most = 0, retried = 0;
  const next = () => {
    while (open < max && queue.length) {
      const job = /** @type {any} */ (queue.shift());
      open++;
      most = Math.max(most, open);
      Promise.resolve().then(() => real.apply(target, job.args)).then(job.ok, (e) => {
        if ((e?.code === 'EMFILE' || e?.code === 'ENFILE') && job.tries < retries) {
          retried++;
          job.tries++;
          setTimeout(() => { queue.push(job); next(); }, Math.min(OPEN_FILES_WAIT_MAX_MS, 2 ** job.tries));
        } else job.no(e);
      }).finally(() => { open--; next(); });
    }
  };
  const tally = Object.freeze({ max, most: () => most, retried: () => retried });
  const limited = (/** @type {any[]} */ ...args) => new Promise((ok, no) => { queue.push({ args, ok, no, tries: 0 }); next(); });
  limited.limited = tally;
  target.readFile = limited;
  return tally;
}
