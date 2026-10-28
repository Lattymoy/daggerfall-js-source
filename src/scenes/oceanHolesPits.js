// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { createMiasma, miasmaReach } from '../world/oceanHolesMiasma.js';
import { onFloatingFrame } from '../player/collider.js';

/** @param {any} host */
export function createOceanHolesPits(host) {
  const {
    collider
  } = host;
  /** OH-C: BuildPit's children that need a machine of their own - the miasma's particles and the entrance's BoxCollider,
   *  pixel-local through the live translation (the walls' shape). The discs are one shared mesh, drawn from the pit. */
  function ohCreatePit(entry, pit) {
    const h = { entry, pit, miasma: createMiasma({ count: pit.miasma.count, height: pit.miasma.height, radius: pit.miasma.radius }), bucket: `${entry.px},${entry.py}:oceanhole` };
    const [sx, sy, sz] = pit.entrance.size;
    const x = pit.marker.localX, y = pit.entrance.y, z = pit.marker.localZ;
    const bx = sx / 2, by = sy / 2, bz = sz / 2;
    const pos = [x - bx, y - by, z - bz, x + bx, y - by, z - bz, x + bx, y + by, z - bz, x - bx, y + by, z - bz,
      x - bx, y - by, z + bz, x + bx, y - by, z + bz, x + bx, y + by, z + bz, x - bx, y + by, z + bz];
    const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
    const o = [0, 0, 0];
    collider.addMesh(h.bucket, pos, idx, _ohIdentity, onFloatingFrame(host.state, () => host.state.pixelTranslation(entry.px, entry.py, o)));   // PERF-COL2: riding the floating origin
    // AUDIT OH-F A2: Unity culls the plume by its particles' own bounds; here the pixel's box is the draw's verdict
    // (drawOceanHolesTransparent), so the box reaches the plume - the rise, the drift, the largest puff. It only grows.
    const b = entry._box, reach = miasmaReach(pit.miasma), c = [x, pit.miasma.y, z];
    if (b) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], c[i] + reach[i]); b[3 + i] = Math.max(b[3 + i], c[i] + reach[3 + i]); }
    return h;
  }
  function ohDestroyPit(h) { if (h?.bucket) collider.removeBucket(h.bucket); h.bucket = null; }
  const _ohIdentity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { ohCreatePit, ohDestroyPit };
}
