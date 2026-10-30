// FOUNDATION F5 (2026-10-30, bible/03-World/Foundation-Arc.md): THE BUILD'S OPEN FILES HELD. Vite reads every asset the
// game imports with `fsp.readFile` and no cap (vite/dist/node/chunks/node.js resolveBuiltAsset), and the eager globs
// over vendor/ name all 13,134 of its PNGs at once - past the C runtime's open-file limit on Windows, where the
// production build failed about half the time with EMFILE. The shared node:fs/promises object's readFile is wrapped:
// at most OPEN_FILES_MAX reads open at once, and a read refused with EMFILE or ENFILE is queued again.
import fsp from 'node:fs/promises';

/** The most reads open at once - far under Windows' 8,192, and no slower on any disk. */
export const OPEN_FILES_MAX = 256;

/**
 * Wraps `target.readFile` once: queued past `max` open, a busy refusal asked again. Answers its tally.
 * @param {{ readFile: (...a: any[]) => Promise<any> }} [target] @param {number} [max]
 * @returns {{ max: number, most: () => number, retried: () => number }}
 */
export function limitOpenFiles(target = fsp, max = OPEN_FILES_MAX) {
  const had = /** @type {any} */ (target.readFile).limited;
  if (had) return had;
  const real = target.readFile;
  /** @type {{ args: any[], ok: (v: any) => void, no: (e: any) => void }[]} */ const queue = [];
  let open = 0, most = 0, retried = 0;
  const next = () => {
    while (open < max && queue.length) {
      const job = /** @type {any} */ (queue.shift());
      open++;
      most = Math.max(most, open);
      Promise.resolve().then(() => real.apply(target, job.args)).then(job.ok, (e) => {
        if (e?.code === 'EMFILE' || e?.code === 'ENFILE') { retried++; queue.push(job); } else job.no(e);
      }).finally(() => { open--; next(); });
    }
  };
  const tally = Object.freeze({ max, most: () => most, retried: () => retried });
  const limited = (/** @type {any[]} */ ...args) => new Promise((ok, no) => { queue.push({ args, ok, no }); next(); });
  limited.limited = tally;
  target.readFile = limited;
  return tally;
}
