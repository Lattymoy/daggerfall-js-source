// ═══════════════════════════════════════════════════════════════════
// EG-H3 (2026-10-12, bible/11-Multiplayer/Elite-Gates.md sections 7
// and 31, EG10) - THE SWAP'S WORKER. A circle's made level built off
// the main thread (world/eliteGates/egCircleParts.js - the halls' mesh, the
// collider's triangles, the lamps, the portcullises): tens of
// milliseconds of the hall law and the mesh builders that must never
// land in a frame (section 7: "it must never land in one frame").
//
// Messages in:  {t: 'build', id, seed, c, geo, band, given}
// Messages out: {t: 'built', id, parts} - its buffers transferred - or
//               {t: 'error', id, message}.
// AUDIT EG V (L6-8, L6-9): the parts carry the circle's five specs and,
// when `band` is asked, that band's dress painted (egCircleBuild) - the
// page lays no hall again under the veil and paints nothing in its rest.
// AUDIT EG V (E NEW-2): `given` - a breach of another law's halls, as its
// room gave them, taken before anything is laid (egCircleBuild).
//
// Pure modules only (no ui/, scenes/, render/) - a worker has no DOM.
// ═══════════════════════════════════════════════════════════════════

import { egCircleBuild, egCirclePartsTransfers } from './egCircleParts.js';

globalThis.onmessage = (ev) => {
  const m = ev.data ?? {};
  if (m.t !== 'build') return;
  try {
    const parts = egCircleBuild(m);
    globalThis.postMessage({ t: 'built', id: m.id, parts }, egCirclePartsTransfers(parts));
  } catch (e) {
    globalThis.postMessage({ t: 'error', id: m.id, message: String(e?.message ?? e) });
  }
};
