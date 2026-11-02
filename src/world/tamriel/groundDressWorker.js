// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "Its cost, off the page's thread"): A ZONE'S DRESS ON ITS OWN CORE, while
// the page draws (world/tamriel/groundDressClient.js the page's side). In: {t: 'dress', id, layers, dress, exposure} - a
// set's layers as drawn, a zone's dress, the pack's exposure. Out: {t: 'dressed', id, layers} with the colours' buffers
// moved, or {t: 'error', id, message} (the page dresses it itself). Pure modules only - a worker has no DOM.
import { dressLayers } from './groundDress.js';

/** The worker's answer to one message through `post` (the pins drive it directly, and so does no worker at all). */
export function dressMessage(/** @type {any} */ m, /** @type {(msg: any, transfer?: ArrayBuffer[]) => void} */ post) {
  if (m?.t !== 'dress') return;
  try {
    const layers = dressLayers(m.layers, m.dress, m.exposure);
    /** @type {ArrayBuffer[]} */
    const moved = [];
    for (const l of layers) {
      const b = /** @type {any} */ (l?.colors)?.buffer;
      if (b instanceof ArrayBuffer && !moved.includes(b)) moved.push(b);
    }
    post({ t: 'dressed', id: m.id, layers }, moved);
  } catch (e) {
    post({ t: 'error', id: m.id, message: String(/** @type {any} */ (e)?.message ?? e) });
  }
}

// the worker itself - absent in node, where dressMessage is driven directly
const G = /** @type {any} */ (globalThis);
if (typeof G.WorkerGlobalScope !== 'undefined' && G instanceof G.WorkerGlobalScope) {
  const scope = G;
  scope.onmessage = (/** @type {MessageEvent} */ e) =>
    dressMessage(e.data, (msg, transfer) => scope.postMessage(msg, transfer ?? []));
}
