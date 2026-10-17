// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT POI M13 (2026-10-15) - THE UNWRAP, OFF THE THREAD THAT DRAWS THE EDITOR.
//
// The UV editor's unwrap (poi/uv/uvMesh.js unwrapLscm) of an island at the mesh law's size is seconds of solve - 522,000
// triangles (the law's 262,144 vertices) eight of them - and it ran on the page's own thread, which stood still: no
// paint, no pointer, the tab "not responding". This client hands it to a module Worker (poi/uv/uvUnwrapWorker.js) that runs
// the SAME unwrap over its own session of the SAME mesh, and answers the corners it laid with their UVs.
//
// The shape is mwTextureClient.js's, law for law:
//  - `new Worker(new URL(...))` stays in exactly that spelling (eslint.config.js's note: Vite's static analysis matches
//    the bare constructor to bundle the worker entry).
//  - The factory is injectable, so node never evaluates `new Worker` and a test drives a hand-rolled fake.
//  - The mesh is COPIED to the worker, never transferred: the editor's session reads the very same arrays.
//  - THE FALLBACK IS THE OLD PATH, NOT A FAILURE: no Worker (node, a test, an old host), a factory that throws, a worker
//    that dies or answers an error, or ?uvthread=off - the answer is null and the editor unwraps on its own thread, the
//    same function over the same session: the fallback costs the stall and nothing else.
//  - AN IDLE WORKER IS LET GO: once every unwrap has answered and UV_UNWRAP_IDLE_MS pass with nothing new, it is
//    terminated (its session is the mesh's size again); the next unwrap opens it again.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

/** How long a worker with nothing to do keeps its session - past a builder's few presses between unwraps. */
export const UV_UNWRAP_IDLE_MS = 30000;

/** The escape hatch, read once per editor (the ?texturethread=off shape). */
export function uvThreadDisabled(search = globalThis.location?.search) {
  try { return /[?&]uvthread=off\b/.test(search ?? ''); }
  catch { return false; }
}

/** The one place the worker URL is spelled. Split out so tests can inject a factory and node never evaluates `new Worker`. */
function defaultWorkerFactory() {
  return new Worker(new URL('./uvUnwrapWorker.js', import.meta.url), { type: 'module' });
}

/**
 * The unwrap's worker for one part's mesh. `unwrap(faces, seams)` - `seams` welded pairs, two numbers a seam - resolves
 * `{ corners, uvs, pieces, triangles }` from the worker, or null where it must run on this thread.
 * @param {{ positions: ArrayLike<number> & { slice(): any }, normals?: ArrayLike<number> & { slice(): any }, uvs: ArrayLike<number> & { slice(): any }, indices: ArrayLike<number> & { slice(): any }, submeshes: { start: number, count: number }[] }} mesh
 * @param {{ workerFactory?: (() => any) | null, idleMs?: number }} [opts]
 */
export function createUnwrapThread(mesh, { workerFactory = undefined, idleMs = UV_UNWRAP_IDLE_MS } = {}) {
  const factory = workerFactory === undefined
    ? ((uvThreadDisabled() || typeof Worker === 'undefined') ? null : defaultWorkerFactory)
    : workerFactory;
  let w = null, dead = !factory, idle = null, nextId = 1;
  const jobs = new Map();   // id -> resolve
  const wake = () => { if (idle !== null) { clearTimeout(idle); idle = null; } };
  // the worker goes; every unwrap it still owed is answered null - run here
  const letGo = () => {
    wake();
    if (w) { try { w.terminate?.(); } catch { /* already gone */ } w = null; }
    for (const r of jobs.values()) r(null);
    jobs.clear();
  };
  const rest = () => {
    wake();
    if (jobs.size || !w) return;
    idle = setTimeout(() => { idle = null; if (!jobs.size) letGo(); }, idleMs);
    idle.unref?.();   // node: an idle worker never holds the process open
  };
  const fail = (why) => { console.warn('[poi] the UV unwrap worker is unavailable; unwrapping on the main thread -', why ?? 'the worker failed'); dead = true; letGo(); };
  const open = () => {
    try {
      w = factory();
      w.onerror = (e) => fail(e?.message);
      w.onmessage = (ev) => {
        const m = ev.data ?? {};
        const r = jobs.get(m.id);
        if (!r) return;
        jobs.delete(m.id);
        // an error from a live worker is a bug the same unwrap would meet here too: answered null, run here, said once
        if (m.t !== 'laid') console.warn('[poi] the UV unwrap worker answered an error; unwrapping on the main thread -', m.message);
        r(m.t === 'laid' ? m : null);
        rest();
      };
      // a COPY: the editor's session reads these very arrays
      const copy = {
        positions: mesh.positions.slice(), normals: mesh.normals ? mesh.normals.slice() : new Float32Array(mesh.positions.length),
        uvs: mesh.uvs.slice(), indices: mesh.indices.slice(), submeshes: mesh.submeshes.map((sm) => ({ start: sm.start, count: sm.count })),
      };
      w.postMessage({ t: 'mesh', mesh: copy }, [copy.positions.buffer, copy.normals.buffer, copy.uvs.buffer, copy.indices.buffer]);
      return true;
    } catch (e) {
      fail(e?.message ?? e);
      return false;
    }
  };
  return {
    /** @param {ArrayLike<number>} faces @param {ArrayLike<number>} seams @returns {Promise<{ corners: Int32Array, uvs: Float64Array, pieces: number, triangles: number } | null>} */
    unwrap(faces, seams) {
      if (dead || (!w && !open())) return Promise.resolve(null);
      wake();
      return new Promise((resolve) => {
        const id = nextId++;
        jobs.set(id, resolve);
        const f = Int32Array.from(faces), sm = Int32Array.from(seams);
        try { w.postMessage({ t: 'unwrap', id, faces: f, seams: sm }, [f.buffer, sm.buffer]); }
        catch (e) { fail(e?.message ?? e); }
      });
    },
    /** Let the worker go; later unwraps run on this thread. */
    close() { dead = true; letGo(); },
    get onWorker() { return !!w; },
  };
}
