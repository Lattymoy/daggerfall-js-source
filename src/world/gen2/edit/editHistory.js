// @ts-check
// WG2 UNDO AND REDO (bible/03-World/World-2-Canon.md, "Editing"): the editor's documents are frozen values, so a step
// back is the document before - nothing is undone by hand, and nothing a later step changed can leak into an earlier
// one. A new change after an undo drops the steps that were undone. The stack keeps LIMIT steps.
export const LIMIT = 200;

/** @param {any} doc */
export const historyOf = (doc) => ({ past: [], now: doc, future: [] });
/** @param {{ past: any[], now: any, future: any[] }} h @param {any} doc */
export const commit = (h, doc) => (doc === h.now ? h : { past: [...h.past, h.now].slice(-LIMIT), now: doc, future: [] });
/** @param {{ past: any[], now: any, future: any[] }} h */
export const undo = (h) => (h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h);
/** @param {{ past: any[], now: any, future: any[] }} h */
export const redo = (h) => (h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h);
