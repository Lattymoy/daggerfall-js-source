// ENHANCED AI 3b: THE BAKE, OFF THE FRAME. The dungeon host posts the
// collider's triangle soup and the anchor; this bakes exactly as
// navBake does on the main thread - the same functions, the same
// order - and posts back bakeNavData's compact form, which the client
// hydrates. The compact heightfield the motor queries every tick lives
// on the main thread, because findPath is synchronous by his design.
import { trianglesToColliders } from './triRaster.js';
import { regionAnchor } from './navBake.js';
import {
  AGENT, coarsenAgent, buildNav, buildCompact, buildRegions, buildContours,
  buildPolyMesh, buildPolyMeshDetail, bakeNavData,
} from './navmesh.js';

globalThis.onmessage = (ev) => {
  const m = ev.data ?? {};
  try {
    if (m.t !== 'bake') return;
    const t0 = (globalThis.performance ?? Date).now();
    const agent = m.agent ?? AGENT;
    let cols = trianglesToColliders(m.positions, m.indices, { cs: agent.cs, maxSlope: agent.maxSlope });
    const coarser = coarsenAgent(cols, agent, m.budget ?? 250000, m.target ?? 80000);
    const ag = coarser ?? agent;
    if (coarser) cols = trianglesToColliders(m.positions, m.indices, { cs: ag.cs, maxSlope: ag.maxSlope });
    const floor = m.floor;
    const nav = buildNav(cols, ag, [], { at: () => floor, min: floor });
    const chf = buildCompact(nav, ag);
    buildRegions(chf, { anchor: regionAnchor(m.anchor) });   // WITH its y - see regionAnchor
    buildContours(chf); buildPolyMesh(chf); buildPolyMeshDetail(chf, cols);
    const baked = bakeNavData(chf);
    const ms = Math.round((globalThis.performance ?? Date).now() - t0);
    globalThis.postMessage({ t: 'baked', id: m.id, baked, cs: ag.cs, stats: { boxes: cols.length, cs: ag.cs, cells: nav.nx * nav.nz, polys: chf.mesh?.polys?.length ?? 0, ms } });
  } catch (e) {
    globalThis.postMessage({ t: 'error', id: m.id, message: e?.message ?? String(e) });
  }
};
