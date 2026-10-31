// @ts-check
// IC-GRAND's perf pass (bible/03-World/Arena-Provinces.md IC-GRAND, "Off the page's thread") - THE IMPERIAL CITY'S OWN
// WORKER: a slice's blocks and models made off the page's thread (world/imperialPrebuild.js says what and why), a piece at
// a time, the wanted slices in the order the page last said (nearest the player first) - each piece handed back as it is
// made, its buffers moved, not copied.
//
// Messages in:
//   {t: 'want', slices: [{s, near}]} - the slices wanted now, in order; it replaces the last list (what is no longer
//     wanted is not made), and a piece the page has already made is skipped
//   {t: 'made', key} - a piece the page made itself ('b:<name>' or 'm:<id>'): never made here
//   {t: 'need', keys} - IC-STUTTER: pieces a build is waiting on ('b:<name>' or 'm:<id>'), made before the wanted list -
//     made again even where made before (the page let its copy go), in the order asked; a new list never drops them
// Messages out:
//   {t: 'block', name, json} - a block's JSON, its automap's buffer moved
//   {t: 'model', id, model} - a model (null: none in that cell), its buffers moved
//   {t: 'error', key, message} - a piece that threw (the page makes it itself)
//
// Pure modules only (no ui/, scenes/, render/) - a worker has no DOM. The state machine is exported for the pins and for
// the page's own fallback (world/imperialPrebuildClient.js).
import { sliceWork, prebuildDeps, makeWork, modelTransfers } from './imperialPrebuild.js';
import { installCapitals, imperialSliceFootprint, isImperialPartId } from './capitalModels.js'; // IC-FOOTPRINT-OFF-THREAD
import { customModelFor } from './customModels.js';

/** The worker's own model door and its writers: the landmarks on it (their parts built here once, for the slices' parts
 *  and their footprint - world/capitalModels.js), no picture (the page paints them); a part handed to the page a copy of
 *  its door's (its buffers moved, the door's kept for the footprints still to come). */
function workerDeps() {
  installCapitals({ addTextures: () => 0 });
  const partModel = (/** @type {number} */ id) => {
    const m = isImperialPartId(id) ? customModelFor(id) : null;
    return m
      ? {
          ...m,
          positions: m.positions.slice(),
          normals: m.normals.slice(),
          uvs: m.uvs.slice(),
          indices: m.indices.slice(),
        }
      : null;
  };
  return prebuildDeps(imperialSliceFootprint, partModel);
}

/** How many pieces' keys the worker remembers as made (a near ring's and the next's, twice over). */
export const DONE_KEEP = 2400;
/** @param {(msg: any, transfer?: ArrayBuffer[]) => void} post */
export function createPrebuildWorkerState(post) {
  let deps = null,
    queue = /** @type {Array<{ kind: 'block', name: string } | { kind: 'model', id: number }>} */ ([]);
  /** IC-STUTTER (bible/03-World/Arena-Provinces.md IC-STUTTER): the pieces a build waits on, ahead of the wanted list.
   *  @type {Array<{ kind: 'block', name: string } | { kind: 'model', id: number }>} */
  let needs = [];
  /** The pieces made here or by the page lately, oldest first - DONE_KEEP of them, so a slice come back to after a walk
   *  across the city is made again (the page's own keep has long let it go). */
  const done = new Set();
  const mark = (k) => {
    done.delete(k);
    done.add(k);
    if (done.size > DONE_KEEP) done.delete(/** @type {string} */ (done.values().next().value));
  };
  const keyOf = (w) => (w.kind === 'block' ? `b:${w.name}` : `m:${w.id}`);
  return {
    /** A message from the page. */
    on(msg) {
      if (msg?.t === 'want') {
        queue = (msg.slices ?? []).flatMap(({ s, near }) => sliceWork(s, !!near)).filter((w) => !done.has(keyOf(w)));
      } else if (msg?.t === 'made' && msg.key) {
        mark(msg.key);
        queue = queue.filter((w) => keyOf(w) !== msg.key);
        needs = needs.filter((w) => keyOf(w) !== msg.key);
      } else if (msg?.t === 'need') {
        const has = new Set(needs.map(keyOf));
        for (const w of (msg.keys ?? []).map(workOfKey)) {
          if (!w || has.has(keyOf(w))) continue;
          has.add(keyOf(w));
          done.delete(keyOf(w)); // made before and let go by the page: made again
          needs.push(w);
        }
      }
    },
    /** One piece made and handed back; false when nothing is wanted. */
    step() {
      const need = needs.shift(),
        w = need ?? queue.shift();
      if (!w) return false;
      const key = keyOf(w);
      if (done.has(key)) return true; // IC-STUTTER: a need's key was let out of `done` as it was asked
      mark(key);
      deps ??= workerDeps();
      try {
        const made = makeWork(w, deps);
        if (w.kind === 'block')
          post(
            { t: 'block', name: w.name, json: made },
            made?.RmbBlock?.FldHeader?.AutoMapData?.buffer ? [made.RmbBlock.FldHeader.AutoMapData.buffer] : [],
          );
        else post({ t: 'model', id: w.id, model: made }, modelTransfers(made));
      } catch (e) {
        post({ t: 'error', key, message: String(/** @type {any} */ (e)?.message ?? e) });
      }
      return true;
    },
    get owed() {
      return queue.length + needs.length;
    },
  };
}
/** IC-STUTTER: a piece's work from its key ('b:<name>' a block, 'm:<id>' a model) - null for neither. @param {string} key */
export function workOfKey(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith('b:') && key.length > 2) return { kind: 'block', name: key.slice(2) };
  const id = key.startsWith('m:') ? Number(key.slice(2)) : NaN;
  return Number.isInteger(id) ? { kind: 'model', id } : null;
}

// the worker itself - absent in node, where the state is driven directly: a piece a task, so a new list is heard between
const G = /** @type {any} */ (globalThis);
if (typeof G.WorkerGlobalScope !== 'undefined' && G instanceof G.WorkerGlobalScope) {
  const scope = G;
  const state = createPrebuildWorkerState((m, transfer) => scope.postMessage(m, transfer ?? []));
  let running = false;
  const run = () => {
    running = false;
    if (state.step()) {
      running = true;
      setTimeout(run, 0);
    }
  };
  scope.onmessage = (/** @type {MessageEvent} */ e) => {
    state.on(e.data);
    if (!running) {
      running = true;
      setTimeout(run, 0);
    }
  };
}
