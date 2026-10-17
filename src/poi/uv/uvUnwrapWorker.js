// ═══════════════════════════════════════════════════════════════════
// AUDIT POI M13 (2026-10-15) - THE UNWRAP'S WORKER. The other half of poi/uv/uvUnwrapClient.js: a 'mesh' message hands it
// a COPY of the part's mesh, from which it makes its own session (poi/uv/uvMesh.js uvSessionOf - the same weld, the same
// edges, the same numbers as the editor's); each 'unwrap' message names the faces and the seams as the editor holds them
// then, runs the SAME unwrap (unwrapLscm) and answers the corners it laid and their UVs, TRANSFERRED. An unwrap of the
// mesh law's largest island is seconds of solve; on the thread that draws the editor the page stood still for them.
//
// This module may import ONLY pure, node-tested modules - no ui/, no scenes/, no render/ - because a worker has no DOM
// and the import graph is evaluated whole. `handleUnwrap` is exported so node tests drive the wire without a Worker.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { uvSessionOf, unwrapLscm, edgeKey } from './uvMesh.js';

let session = null;

/**
 * One message in, at most one out through `post(msg, transfer)`. 'mesh' answers nothing; 'unwrap' answers
 * `{ t: 'laid', id, corners, uvs, pieces, triangles }` (corners Int32Array, uvs Float64Array two a corner) or
 * `{ t: 'error', id, message }`.
 */
export function handleUnwrap(m, post) {
  try {
    if (m.t === 'mesh') { session = uvSessionOf(m.mesh); return; }
    if (m.t !== 'unwrap') throw new Error(`uv unwrap worker: unknown message ${JSON.stringify(m.t)}`);
    if (!session) throw new Error('uv unwrap worker: no mesh');
    // the seams as the editor holds them now: welded pairs, two numbers a seam
    session.seams = new Set();
    for (let i = 0; i + 1 < m.seams.length; i += 2) session.seams.add(edgeKey(m.seams[i], m.seams[i + 1]));
    const pieces = unwrapLscm(session, Array.from(m.faces));
    let n = 0;
    for (const p of pieces) n += p.length * 3;
    const corners = new Int32Array(n), uvs = new Float64Array(n * 2);
    let k = 0;
    for (const p of pieces) for (const f of p) for (let j = 0; j < 3; j++) {
      const c = f * 3 + j;
      corners[k] = c; uvs[k * 2] = session.cornerUv[c * 2]; uvs[k * 2 + 1] = session.cornerUv[c * 2 + 1]; k++;
    }
    post({ t: 'laid', id: m.id, corners, uvs, pieces: pieces.length, triangles: n / 3 }, [corners.buffer, uvs.buffer]);
  } catch (e) {
    post({ t: 'error', id: m.id, message: e?.message ?? String(e) });
  }
}

globalThis.onmessage = (ev) => handleUnwrap(ev.data ?? {}, (msg, transfer) => globalThis.postMessage(msg, transfer ?? []));
