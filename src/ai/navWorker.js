// ENHANCED AI 3b: THE BAKE, OFF THE FRAME. The dungeon host posts the
// collider's triangle soup and the anchor; this bakes through navBake's
// one core (bakeSoup - the same function the main thread's fallback
// runs) and posts back bakeNavData's compact form, which the client
// hydrates. The compact heightfield the motor queries every tick lives
// on the main thread, because findPath is synchronous by his design.
//
// AUDIT 68 S02-hydrate-main-thread-revoxelize: the boxes the height layer
// reads ride back with the bake, packed and transferred, so the main
// thread no longer re-voxelises the soup to rebuild them; a cache hit
// asks for them alone ('cols'), cut here at the cached cell size.
import { bakeSoup } from './navBake.js';
import { trianglesToColliders, packColliders } from './triRaster.js';
import { AGENT, bakeNavData } from './navmesh.js';

globalThis.onmessage = (ev) => {
  const m = ev.data ?? {};
  try {
    if (m.t === 'bake') {
      const r = bakeSoup(m.positions, m.indices, { floor: m.floor, anchor: m.anchor, agent: m.agent ?? AGENT });
      const cols = packColliders(r.cols);
      globalThis.postMessage({ t: 'baked', id: m.id, baked: bakeNavData(r.chf), cs: r.agent.cs, stats: r.stats, cols }, [cols.box.buffer, cols.noNavTop.buffer]);
    } else if (m.t === 'cols') {
      const cols = packColliders(trianglesToColliders(m.positions, m.indices, { cs: m.cs, maxSlope: m.maxSlope }));
      globalThis.postMessage({ t: 'cols', id: m.id, cols }, [cols.box.buffer, cols.noNavTop.buffer]);
    }
  } catch (e) {
    globalThis.postMessage({ t: 'error', id: m.id, message: e?.message ?? String(e) });
  }
};
