// ROAD-C c2/S7: THE AUTOMAP PICKER - GetRayCastNearestHitOnAutomapLayer
// (Automap.cs:1840-1856) and the taxonomy GetMouseHoverOverText
// (:555-614) reads off its answer.
//
// WHAT DFU DOES, AND WHAT THE PORT HAS INSTEAD. DFU duplicates the whole
// level into a second scene on `layerAutomap`, gives every piece a
// MeshCollider, and answers a mouse position with
// `Physics.RaycastAll(ray, 10000, 1 << layerAutomap)` filtered to the
// NEAREST hit **whose MeshRenderer is enabled** - which is DFU's own way
// of saying "only revealed geometry is pickable", because the renderer's
// enabled flag IS the discovery bit (:60-79). The port has no second
// scene and no second collider bucket (the c2 risk list says why: the
// one `Collider` walks every bucket for movement, senses, activation and
// arrows, so a dungeon-sized second bucket is a global regression bought
// for a cosmetic identity). It has something better shaped: c2/S1's
// reveal model already holds every automap-eligible entry with its world
// AABB, its stable key and - since this stage - the CPU triangles and
// the matrix the host drew it with. So the pick is a broadphase over
// those AABBs and a Moller-Trumbore over the triangles of whatever the
// ray's box test kept, filtered by `rec.revealed`.
//
// THE RESULT IS THE SAME ANSWER FROM THE SAME TRIANGLES. This is not the
// hit-point-vs-AABB substitution the 5 Hz reveal probe records: that one
// resolves a point the collider already found; this one intersects the
// real geometry, and the only reason it is not literally DFU's call is
// that the port refuses to carry a second physics world.
//
// MARKER PROXIES ARE BOXES, AND THAT IS A DEPARTURE (rowed in the
// Ledger). DFU's beacons are Unity primitives, so a cylinder beacon
// carries the CapsuleCollider `CreatePrimitive` attached (the
// `Destroy(GetComponent<Collider>())` lines beside them are commented
// out - :1367, :1382, :1421) and the cube a BoxCollider; the two curved
// arrows and the player arrow get MeshColliders. The port hit-tests each
// marker's ORIENTED BOX instead. For the three beacons the delta is the
// corner of a 0.3-wide box against a 0.15-radius capsule over a 100-unit
// ray - well under a pixel at every zoom the map offers - and the cube's
// box IS its collider. Only the two curved arrows and the player arrow
// are genuinely coarser, and both are tiny targets whose whole job is to
// answer one status-bar string.
//
// GEOMETRY IS PICKABLE ONLY IF REVEALED - the `MeshRenderer.enabled`
// filter at :1850, which is the single most important line in the C#
// function: without it the map would name rooms the player has never
// seen just by hovering over where they are.

import { rayAabb } from '../player/activate.js';

/** The gameobject NAMES DFU dispatches its hover text on (:149-166).
 *  They are the picker's taxonomy on purpose: `GetMouseHoverOverText`
 *  is a chain of `transform.name ==` comparisons, so porting the names
 *  ports the dispatch. */
export const MARKER_NAMES = Object.freeze({
  PLAYER_ARROW: 'PlayerMarkerArrow',              // :149
  PLAYER_BEACON: 'BeaconPlayerPosition',          // :150
  PIVOT_BEACON: 'BeaconRotationPivotAxis',        // :151
  ROTATE_ARROW: 'CurvedArrow',                    // :152
  ENTRANCE_RAY: 'BeaconEntrancePositionMarker',   // :154
  ENTRANCE_CUBE: 'CubeEntrancePositionMarker',    // :155
  PORTAL: 'PortalMarker',                         // :157 - c2/S8's teleporters
  NOTE_PREFIX: 'UserNoteMarker_',                 // :164 - c2/S8's notes
});

/**
 * GetMouseHoverOverText's dispatch (:555-614), as the mapping from a
 * hit to its Internal_Strings key. SEVEN keys over EIGHT arms - the
 * pivot axis and its two curved arrows answer the same string, which is
 * one `||` in the C#.
 *
 * The two arms that answer no key are DFU's own: a user note marker
 * answers the NOTE ITSELF (`listUserNoteMarkers[id].note`, not a
 * localized string), and everything else - which is all of the level
 * geometry - falls out of the chain and answers `""`.
 */
export function hoverKeyForHit(hit) {
  if (!hit) return null;
  switch (hit.name) {
    case MARKER_NAMES.PLAYER_BEACON: return 'automapPlayerPositionBeacon';
    case MARKER_NAMES.PIVOT_BEACON:
    case MARKER_NAMES.ROTATE_ARROW: return 'automapRotationPivotAxis';
    case MARKER_NAMES.ENTRANCE_RAY: return 'automapEntranceExitPositionBeacon';
    case MARKER_NAMES.ENTRANCE_CUBE: return 'automapEntranceExit';
    case MARKER_NAMES.PLAYER_ARROW: return 'automapPlayerMarker';
    case MARKER_NAMES.PORTAL:
      // the parent's name suffix is what tells the two ends apart
      // (":557-566" - `EndsWith("] - Portal Entrance")` / `"] - Portal Exit"`)
      return hit.portal === 'exit' ? 'automapTeleporterExit'
        : hit.portal === 'entrance' ? 'automapTeleporterEntrance'
          : null;
    default: return null;
  }
}

// ── the small linear algebra this file needs, and no more ────────────

/** Full 4x4 inverse (column-major), or null for a singular matrix. */
export function invertMat4(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const d = 1 / det;
  return new Float64Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ]);
}

/** Transform a point by a column-major 4x4, dividing through by w. */
export function transformPoint4(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const iw = w === 0 ? 1 : 1 / w;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw,
  ];
}

/** An AABB in one space, re-fitted around its eight transformed
 *  corners. Marker boxes are ORIENTED in world space (the pivot yaws
 *  with the camera), so the proxy the ray tests is this refit, which is
 *  the standard conservative answer and is never tighter than the box
 *  it came from. */
export function transformBounds(bounds, m) {
  if (!bounds) return null;
  const { min, max } = bounds;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = transformPoint4(m,
      (i & 1) ? max[0] : min[0],
      (i & 2) ? max[1] : min[1],
      (i & 4) ? max[2] : min[2]);
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2];
  }
  return { min: [x0, y0, z0], max: [x1, y1, z1] };
}

/** Moller-Trumbore, DOUBLE SIDED - DFU's MeshColliders are, and a
 *  dungeon's inward-facing walls would be unpickable from the map
 *  camera otherwise. Answers the ray parameter or null. */
export function rayTriangle(o, d, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const px = d[1] * e2z - d[2] * e2y;
  const py = d[2] * e2x - d[0] * e2z;
  const pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det > -1e-12 && det < 1e-12) return null;
  const inv = 1 / det;
  const tx = o[0] - ax, ty = o[1] - ay, tz = o[2] - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-9 ? t : null;
}

/**
 * `cameraAutomap.ScreenPointToRay(screenPosition)` for the port's
 * direct-to-panel pass.
 *
 * DFU renders into a RenderTexture the size of the panel and hands the
 * camera a PANEL-LOCAL position with the y flipped
 * (`mousePosition.y = panelRenderAutomap.Size.y - mousePosition.y`,
 * DaggerfallAutomapWindow.cs:1025-1026) because Unity's screen space
 * counts from the BOTTOM. `px, py` here are panel-local in the port's
 * own top-left native space, so that flip is already folded into the
 * NDC y below and nothing re-spells it.
 *
 * The projection handed in is the pass's OWN - `mirrorProjectionX` and
 * all - so the mirror that puts world +x on screen right is inverted
 * with everything else and the picker can never disagree with what was
 * drawn.
 */
export function panelRay(proj, view, panel, px, py) {
  const vp = mulMat4(proj, view);
  const inv = invertMat4(vp);
  if (!inv) return null;
  const ndcX = (px / panel.w) * 2 - 1;
  const ndcY = 1 - (py / panel.h) * 2;
  const near = transformPoint4(inv, ndcX, ndcY, -1);
  const far = transformPoint4(inv, ndcX, ndcY, 1);
  const dx = far[0] - near[0], dy = far[1] - near[1], dz = far[2] - near[2];
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0)) return null;
  return { origin: near, dir: [dx / len, dy / len, dz / len] };
}

/** The forward half of the same map: a world point to panel-local
 *  pixels (top-left origin), or null behind the camera. The picker does
 *  not need it; the ROUND-TRIP PIN does, and a projection whose inverse
 *  is only checked against itself proves nothing. */
export function projectToPanel(proj, view, panel, point) {
  const vp = mulMat4(proj, view);
  const w = vp[3] * point[0] + vp[7] * point[1] + vp[11] * point[2] + vp[15];
  if (w <= 0) return null;
  const p = transformPoint4(vp, point[0], point[1], point[2]);
  return [(p[0] * 0.5 + 0.5) * panel.w, (0.5 - p[1] * 0.5) * panel.h];
}

function mulMat4(a, b) {
  const out = new Float64Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** Ties go to the MARKER. DFU's RaycastAll returns colliders in no
 *  documented order and takes a strict `<`, so a marker sitting exactly
 *  on the floor it stands on is a coin flip there; here it is a law,
 *  because the beacons exist to be clickable and the floor under them
 *  does not. */
const TIE = 1e-6;

/**
 * One pick. `model` is c2/S1's reveal model, `rec` the live automap
 * record (its `revealed` set is the MeshRenderer.enabled filter),
 * `markers` the proxy list `[{ name, matrix, bounds, portal?, id? }]`.
 */
export function pickAutomap({ ray, model, rec, markers = null, stats = null }) {
  if (!ray) return null;
  const { origin: o, dir: d } = ray;
  let best = null;

  for (const mk of markers ?? []) {
    const box = mk.aabb ?? transformBounds(mk.bounds, mk.matrix);
    if (!box) continue;
    // ONE HOME: the slab test is player/activate.js's, the same one
    // activation and the missile sweep run - it clamps an origin
    // INSIDE the box to 0, which is the answer a physics query would
    // give and the answer a 100-unit beacon ray wants.
    const t = rayAabb(o, d, box);
    if (t === null) continue;
    if (best && t >= best.distance) continue;
    best = {
      kind: 'marker', name: mk.name, portal: mk.portal ?? null, id: mk.id ?? null,
      // c2/S8: a user note answers the NOTE ITSELF, and a portal is
      // resolved back to its dictionary key - DFU reads both off the
      // GameObject's NAME (:565-567, :646-661); the port carries them as
      // fields on the proxy, so nothing parses a string back apart.
      note: mk.note ?? null, teleporterKey: mk.teleporterKey ?? null,
      key: null, distance: t,
      point: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t],
      normal: aabbNormalAt(box, [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]),
    };
  }
  const markerDistance = best ? best.distance : Infinity;

  let geo = null;
  for (const row of model?.rows ?? []) {
    // :1850 - the MeshRenderer.enabled filter, which IS discovery
    if (!rec?.revealed?.has(row.key)) continue;
    const box = rayAabb(o, d, row.aabb);
    if (box === null) continue;
    if (geo && box >= geo.distance) continue;
    const tri = triangleHit(o, d, row, geo ? geo.distance : Infinity, stats);
    if (tri) { geo = { ...tri, kind: 'geometry', name: null, key: row.key, row }; continue; }
    if (row.positions && row.indices) continue;   // real triangles said no
    // A row with no CPU triangles (a hand-built fixture, or an entry
    // whose model never reached cpuModels) answers its BOX - the same
    // conservative stand-in the reveal probe records, and never a
    // silent miss.
    const p = [o[0] + d[0] * box, o[1] + d[1] * box, o[2] + d[2] * box];
    geo = { kind: 'geometry', name: null, key: row.key, row, distance: box, point: p, normal: aabbNormalAt(row.aabb, p) };
  }

  if (geo && geo.distance + TIE < markerDistance) return geo;
  return best ?? geo;
}

/** Nearest triangle of one row, in the row's own model space so the
 *  ray is transformed ONCE instead of every triangle three times. The
 *  ray parameter `t` is invariant under an affine change of basis
 *  applied to BOTH origin and direction, which is why the distance
 *  needs no correction on the way back out. */
function triangleHit(o, d, row, limit, stats) {
  const pos = row.positions, idx = row.indices, m = row.matrix;
  if (!pos || !idx || !m) return null;
  const inv = invertMat4(m);
  if (!inv) return null;
  const lo = transformPoint4(inv, o[0], o[1], o[2]);
  const ld = [
    inv[0] * d[0] + inv[4] * d[1] + inv[8] * d[2],
    inv[1] * d[0] + inv[5] * d[1] + inv[9] * d[2],
    inv[2] * d[0] + inv[6] * d[1] + inv[10] * d[2],
  ];
  let bestT = limit;
  let bi = -1;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const t = rayTriangle(lo, ld,
      pos[a], pos[a + 1], pos[a + 2],
      pos[b], pos[b + 1], pos[b + 2],
      pos[c], pos[c + 1], pos[c + 2]);
    if (t !== null && t < bestT) { bestT = t; bi = i; }
  }
  if (stats) stats.triangleTests += idx.length / 3;
  if (bi < 0) return null;
  const a = idx[bi] * 3, b = idx[bi + 1] * 3, c = idx[bi + 2] * 3;
  // the face normal, in model space, rotated into the world by the
  // matrix's upper 3x3 (dungeon placements are rigid - the ROAD-C
  // reveal model's rows all come from `trs` with unit scale)
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const wx = m[0] * nx + m[4] * ny + m[8] * nz;
  const wy = m[1] * nx + m[5] * ny + m[9] * nz;
  const wz = m[2] * nx + m[6] * ny + m[10] * nz;
  const len = Math.hypot(wx, wy, wz) || 1;
  nx = wx / len; ny = wy / len; nz = wz / len;
  // face the ray, as a collision normal always does
  if (nx * d[0] + ny * d[1] + nz * d[2] > 0) { nx = -nx; ny = -ny; nz = -nz; }
  return {
    distance: bestT,
    point: [o[0] + d[0] * bestT, o[1] + d[1] * bestT, o[2] + d[2] * bestT],
    normal: [nx, ny, nz],
  };
}

/** Which face of a box a point sits on - the box proxy's stand-in for
 *  a collider normal. Used only where there are no triangles. */
function aabbNormalAt(box, p) {
  const { min, max } = box;
  let bestD = Infinity;
  let n = [0, 1, 0];
  const faces = [
    [Math.abs(p[0] - min[0]), [-1, 0, 0]], [Math.abs(p[0] - max[0]), [1, 0, 0]],
    [Math.abs(p[1] - min[1]), [0, -1, 0]], [Math.abs(p[1] - max[1]), [0, 1, 0]],
    [Math.abs(p[2] - min[2]), [0, 0, -1]], [Math.abs(p[2] - max[2]), [0, 0, 1]],
  ];
  for (const [dist, v] of faces) if (dist < bestD) { bestD = dist; n = v; }
  return n;
}

/**
 * THE HOVER CACHE, and why it is not optional. DFU re-renders the map
 * only when something changed (UpdateAutomapView) and raycasts once per
 * frame into a physics engine written in C++; the port's window draws
 * every frame and the pick runs in JS. A player who leaves the mouse
 * still - which is what a player reading a status bar does - would pay
 * for a full traversal sixty times a second for an answer that cannot
 * have changed.
 *
 * The key is the mouse position AND a caller-supplied stamp covering
 * everything else the answer depends on: the camera and the revealed
 * set. `stats.picks` counts the traversals that actually ran, which is
 * what the budget pin reads - a cache that "works" by returning stale
 * answers would pass a timing assertion and fail this one.
 */
export function createAutomapPicker() {
  let cached = null;   // { px, py, stamp, hit }
  const stats = { picks: 0, triangleTests: 0 };
  return {
    stats,
    invalidate() { cached = null; },
    pick({ proj, view, panel, px, py, model, rec, markers, stamp = '' }) {
      if (cached && cached.px === px && cached.py === py && cached.stamp === stamp) return cached.hit;
      stats.picks++;
      const ray = panelRay(proj, view, panel, px, py);
      const hit = pickAutomap({ ray, model, rec, markers, stats });
      cached = { px, py, stamp, hit };
      return hit;
    },
  };
}
