// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The ground", AUDIT: the dress's cost) - A ZONE'S DRESS OFF THE PAGE'S
// THREAD. A set's dress is the better part of a second of work (a transition record's shares, blurs and blends a few
// milliseconds each, 44 of them), and on the page's thread the stream's breather gives it a slice of each frame: a zone
// met at a junction of three held its first pixel back by seconds. Here it runs whole, on its own core, while the page
// draws - world/tamriel/groundDressClient.js is the page's side, and its fallback the same work on the page's thread.
//
// Messages in:
//   {t: 'dress', id, layers, dress, exposure} - a set's layers as drawn ({width, height, colors} each, or null), a zone's
//     dress (tamrielLands.js LANDS' `ground`) and the pack's exposure (groundDress.js setExposure)
// Messages out:
//   {t: 'dressed', id, layers} - the set dressed (groundDress.js dressLayers), its colours' buffers moved, not copied
//   {t: 'error', id, message} - a dress that threw (the page dresses it itself)
//
// Pure modules only - a worker has no DOM.
import { dressLayers } from './groundDress.js';

/** The worker's answer to one message through `post` (the pins drive it directly, and so does no worker at all). */
export function dressMessage(/** @type {any} */ m, /** @type {(msg: any, transfer?: ArrayBuffer[]) => void} */ post) {
  if (m?.t !== 'dress') return;
  try {
    const layers = dressLayers(m.layers, m.dress, m.exposure);
    /** @type {ArrayBuffer[]} */
    const moved = [];
    for (const l of layers) { const b = /** @type {any} */ (l?.colors)?.buffer; if (b instanceof ArrayBuffer && !moved.includes(b)) moved.push(b); }
    post({ t: 'dressed', id: m.id, layers }, moved);
  } catch (e) {
    post({ t: 'error', id: m.id, message: String(/** @type {any} */ (e)?.message ?? e) });
  }
}

// the worker itself - absent in node, where dressMessage is driven directly
const G = /** @type {any} */ (globalThis);
if (typeof G.WorkerGlobalScope !== 'undefined' && G instanceof G.WorkerGlobalScope) {
  const scope = G;
  scope.onmessage = (/** @type {MessageEvent} */ e) => dressMessage(e.data, (msg, transfer) => scope.postMessage(msg, transfer ?? []));
}
