// @ts-check
// OWN-WORK4 (2026-10-31): THE BOATS' OWN PARTS - every mesh our five hulls draw and stand on, made from numbers here
// on world/ships/galleonMesh.js's bench (the fleet's), in the boat's frame (Unity's: +x starboard, +y up, +z the bow).
// A part is the CSA geometry shape (positions, normals, uvs, indices, a sub-mesh a picture, its slots and its box);
// world/ships/ownBoats/ownBoatFiles.js writes them as Come Sail Away's meshes were written. Nothing here is read off
// Come Sail Away 2.1's models: a hull is lofted from its stations, a deck laid across its inside at its height, and the
// small things are boxes, prisms and rope. Not a DFU member.
import { MeshBench, box, prism, rope, planarUv, colliderOf, sub, add, scl, len, norm, cross } from '../galleonMesh.js';
import { OWN_BOAT_ARCHIVE, OWN_TEX as T, OWN_TILE } from './ownBoatArt.js';

/** A bench in our archive. */
export const bench = () => new MeshBench(OWN_BOAT_ARCHIVE);
/** Planar uv on a picture's tile. */
const uvOf = (point, n, key) => planarUv(point, n, OWN_TILE[key] ?? [1, 1]);
/** A quad uv'd planar on its picture. */
function face(b, rec, key, pts, facing) {
  b.poly(
    rec,
    pts,
    pts.map((point) => uvOf(point, facing, key)),
    facing,
  );
}
/** A box uv'd planar on its picture. */
export const block = (b, key, centre, half, opts = {}) =>
  box(b, T[key], centre, half, { tile: OWN_TILE[key] ?? [1, 1], ...opts });

// ── the hull ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** How many points a half-section has, keel to gunwale. */
const SECTION = 7;
/** A station's half-section, keel to gunwale: `b` its half-beam at the gunwale, `g` the gunwale's height, `k` the
 *  keel's, `f` how full the bilge is (0.5 a round hull, 1 a V). */
function section({ b, g: gunwale, k, f: fullness = 0.55 }) {
  const out = [];
  for (let i = 0; i <= SECTION; i++) {
    const angle = ((i / SECTION) * Math.PI) / 2;
    out.push([b * Math.pow(Math.sin(angle), fullness), k + (gunwale - k) * (1 - Math.cos(angle))]);
  }
  return out;
}
/** A station's inside, `thickness` in from its outside. */
const insideOf = (pts, thickness) => pts.map(([x, y]) => [Math.max(0, x - thickness), y + thickness]);
/** The half-width of a half-section at height `y` (0 under it, its top's over it). */
export function widthAt(pts, y) {
  if (y <= pts[0][1]) return 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1];
    if (y >= y0 && y <= y1) return y1 > y0 ? x0 + ((x1 - x0) * (y - y0)) / (y1 - y0) : x1;
  }
  return pts[pts.length - 1][0];
}
/** A station at `z` between the stations either side of it. */
export function stationAt(stations, z) {
  if (z <= stations[0].z) return stations[0];
  for (let i = 0; i + 1 < stations.length; i++) {
    const a = stations[i],
      next = stations[i + 1];
    if (z <= next.z) {
      const along = (z - a.z) / (next.z - a.z);
      const blend = (k) => a[k] + (next[k] - a[k]) * along;
      return {
        z,
        b: blend('b'),
        g: blend('g'),
        k: blend('k'),
        f: (a.f ?? 0.55) + ((next.f ?? 0.55) - (a.f ?? 0.55)) * along,
      };
    }
  }
  return stations[stations.length - 1];
}
/** The inside half-width at height `y` at `z`. */
export const innerWidth = (stations, thickness, z, y) =>
  widthAt(insideOf(section(stationAt(stations, z)), thickness), y);
/** The outside half-width at height `y` at `z`. */
export const outerWidth = (stations, z, y) => widthAt(section(stationAt(stations, z)), y);

/**
 * A lofted hull: its stations aft to fore (`z`, `b` half-beam, `g` gunwale, `k` keel, `f` fullness), its planking
 * `thickness` thick - the outside its side's picture over the waterline and its bottom's under it, its ceiling, its gunwale's
 * cap and its transom (the first station, when it has beam).
 * @param {MeshBench} b
 * @param {{ z:number, b:number, g:number, k:number, f?:number }[]} stations
 */
export function hullSkin(b, stations, thickness = 0.08) {
  const secs = stations.map((station) => ({
    z: station.z,
    out: section(station),
    in: insideOf(section(station), thickness),
  }));
  for (const side of [1, -1]) {
    const pointOf = (station, i, which) => [side * station[which][i][0], station[which][i][1], station.z];
    for (let k = 0; k + 1 < secs.length; k++) {
      const aftSection = secs[k],
        foreSection = secs[k + 1];
      for (let i = 0; i < SECTION; i++) {
        const quad = [
          pointOf(aftSection, i, 'out'),
          pointOf(aftSection, i + 1, 'out'),
          pointOf(foreSection, i + 1, 'out'),
          pointOf(foreSection, i, 'out'),
        ];
        const n = norm(cross(sub(quad[2], quad[0]), sub(quad[3], quad[1])));
        const out = n[0] * side > 0 || (i === 0 && n[1] < 0) ? n : scl(n, -1);
        const wet = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4 < 0.05;
        face(b, wet ? T.bottom : T.side, wet ? 'bottom' : 'side', quad, out);
        const innerQuad = [
          pointOf(aftSection, i, 'in'),
          pointOf(aftSection, i + 1, 'in'),
          pointOf(foreSection, i + 1, 'in'),
          pointOf(foreSection, i, 'in'),
        ];
        face(b, T.inner, 'inner', innerQuad, scl(out, -1));
      }
      const top = [
        pointOf(aftSection, SECTION, 'out'),
        pointOf(foreSection, SECTION, 'out'),
        pointOf(foreSection, SECTION, 'in'),
        pointOf(aftSection, SECTION, 'in'),
      ];
      face(b, T.trim, 'trim', top, [0, 1, 0]);
    }
  }
  const aft = secs[0];
  if (stations[0].b > 0.05) {
    const ring = (which) => [
      ...aft[which].map(([x, y]) => [x, y, aft.z]),
      ...aft[which]
        .slice()
        .reverse()
        .map(([x, y]) => [-x, y, aft.z]),
    ];
    const fan = (pts, facing, rec, key) => {
      const centre = pts.reduce((a, point) => add(a, point), [0, 0, 0]).map((value) => value / pts.length);
      for (let i = 0; i < pts.length; i++) face(b, rec, key, [centre, pts[i], pts[(i + 1) % pts.length]], facing);
    };
    fan(ring('out'), [0, 0, -1], T.side, 'side');
    fan(ring('in'), [0, 0, 1], T.inner, 'inner');
  }
}

/**
 * A deck across the hull's inside at height `y` from `z0` to `z1`, its hatchways (`holes`: `{ x0, x1, z0, z1 }`) left
 * open - its top the deck's picture, its underside `under`'s (none for a floor nothing stands under).
 */
export function deck(
  b,
  stations,
  thickness,
  { y, z0, z1, holes = [], under = 'underDeck', inset = 0, top = 'deck', thick = 0 },
) {
  const cuts = new Set([
    z0,
    z1,
    ...stations.map((station) => station.z),
    ...holes.flatMap((hole) => [hole.z0, hole.z1]),
  ]);
  const cutsAlong = [...cuts].filter((z) => z >= z0 && z <= z1).sort((a, later) => a - later);
  const w = (z) => Math.max(0, innerWidth(stations, thickness, z, y) - inset);
  for (let k = 0; k + 1 < cutsAlong.length; k++) {
    const zFrom = cutsAlong[k],
      zTo = cutsAlong[k + 1],
      zMid = (zFrom + zTo) / 2;
    const hole = holes.find((span) => zMid > span.z0 && zMid < span.z1);
    const bands = hole
      ? [
          [-1, hole.x0],
          [hole.x1, 1],
        ]
      : [[-1, 1]];
    for (const [fromU, toU] of bands) {
      const xAt = (z, across) =>
        across === -1 ? -w(z) : across === 1 ? w(z) : Math.max(-w(z), Math.min(w(z), across));
      const quad = [
        [xAt(zFrom, fromU), y, zFrom],
        [xAt(zFrom, toU), y, zFrom],
        [xAt(zTo, toU), y, zTo],
        [xAt(zTo, fromU), y, zTo],
      ];
      face(b, T[top], top, quad, [0, 1, 0]);
      if (under)
        face(b, T[under], under, thick ? quad.map(([x, quadY, z]) => [x, quadY - thick, z]) : quad, [0, -1, 0]);
    }
  }
}

/** A wall across the hull at `z` from `y0` to `y1`, inside its planking, a doorway (`door`: `{ x0, x1, top }`) left
 *  open; `facing` +1 its face toward the bow. */
export function bulkhead(b, stations, thickness, { z, y0, y1, door = null, facing = 1, rec = 'trim' }) {
  const n = [0, 0, facing];
  const widthLow = innerWidth(stations, thickness, z, y0),
    widthHigh = innerWidth(stations, thickness, z, y1);
  const wall = (xa0, xa1, yFrom, yTo) => {
    if (xa1 - xa0 < 1e-3 || yTo - yFrom < 1e-3) return;
    const quad = [
      [xa0, yFrom, z],
      [xa1, yFrom, z],
      [xa1, yTo, z],
      [xa0, yTo, z],
    ];
    face(b, T[rec], rec, quad, n);
    face(b, T[rec], rec, quad, scl(n, -1));
  };
  const half = Math.min(widthLow, widthHigh);
  if (!door) {
    wall(-half, half, y0, y1);
    return;
  }
  wall(-half, door.x0, y0, y1);
  wall(door.x1, half, y0, y1);
  wall(door.x0, door.x1, door.top, y1);
}

/** A flight up from (`z0`, `y0`) to (`z1`, `y1`) at `x` across `w`: a ramp of treads, a stair's slope a body climbs. */
export function stairFlight(b, { x = 0, w = 1, z0, y0, z1, y1, steps = 0 }) {
  const n = steps || Math.max(2, Math.round(Math.abs(y1 - y0) / 0.25));
  for (let i = 0; i < n; i++) {
    const zFrom = z0 + ((z1 - z0) * i) / n,
      zTo = z0 + ((z1 - z0) * (i + 1)) / n,
      yFrom = y0 + ((y1 - y0) * i) / n,
      yTo = y0 + ((y1 - y0) * (i + 1)) / n;
    const tread = [
      [x - w / 2, yTo, zFrom],
      [x + w / 2, yTo, zFrom],
      [x + w / 2, yTo, zTo],
      [x - w / 2, yTo, zTo],
    ];
    face(b, T.deck, 'deck', tread, [0, 1, 0]);
    const riser = [
      [x - w / 2, yFrom, zFrom],
      [x + w / 2, yFrom, zFrom],
      [x + w / 2, yTo, zFrom],
      [x - w / 2, yTo, zFrom],
    ];
    face(b, T.trim, 'trim', riser, [0, 0, Math.sign(z0 - z1) || 1]);
  }
}

// ── the rig's spars ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A mast from its foot (the node) up `height`, tapering from `footRadius` to `headRadius`, eight sides. */
export function mastGeometry(height, footRadius, headRadius) {
  const b = bench();
  prism(b, T.spar, [0, 0, 0], [0, height, 0], footRadius, headRadius, 8, {
    smooth: true,
    tileV: OWN_TILE.spar[1],
    capRec: T.trim,
  });
  return b.finish();
}
/** A spar between two points (a yard, a boom, a gaff), `radius` its radius. */
export function sparGeometry(a, end, radius = 0.08) {
  const b = bench();
  prism(b, T.spar, a, end, radius, radius * 0.7, 6, { smooth: true, tileV: OWN_TILE.spar[1] });
  return b.finish();
}

// ── the oars, the rudder, the helm ──────────────────────────────────────────────────────────────────────────────────

/** An oar along -x from its loom (x 0) - `out` m of shaft outboard, `inboard` m of loom and handle in, its blade the
 *  last `blade` m; `sx` +1 mirrors it to run along +x. */
export function oarGeometry(out, { inboard = 0.6, blade = 0.9, r: radius = 0.05, sx: side = -1 } = {}) {
  const b = bench();
  const end = side * out;
  prism(b, T.spar, [-side * inboard, 0, 0], [end - side * blade, 0, 0], radius, radius * 0.8, 6, {
    smooth: true,
    tileV: 1,
  });
  block(b, 'blade', [end - (side * blade) / 2, 0, 0], [blade / 2, 0.02, Math.max(0.09, blade * 0.16)]);
  return b.finish();
}
/** A rudder's blade hung from its stock's head (the node) down `drop` m, `chord` m aft, `thickness` thick, its stock over it. */
export function rudderBladeGeometry(drop, chord, thickness = 0.08, stock = 0.6) {
  const b = bench();
  block(b, 'trim', [0, -drop / 2, -chord / 2], [thickness / 2, drop / 2, chord / 2]);
  prism(b, T.spar, [0, 0, -0.05], [0, stock, -0.05], 0.06, 0.05, 6, { smooth: true });
  return b.finish();
}
/** A tiller from the stock's head forward `length` m. */
export function tillerGeometry(length) {
  const b = bench();
  prism(b, T.spar, [0, 0, 0], [0, 0.08, length], 0.05, 0.035, 6, { smooth: true });
  return b.finish();
}
/** A helm's wheel square to z, `radius` its radius: its rim, its spokes and its hub. */
export function helmWheelGeometry(radius = 0.75) {
  const b = bench();
  const SPOKES = 12;
  const at = (k, ringRadius) => [
    Math.cos((k / SPOKES) * Math.PI * 2) * ringRadius,
    Math.sin((k / SPOKES) * Math.PI * 2) * ringRadius,
    0,
  ];
  for (let k = 0; k < SPOKES; k++)
    prism(b, T.trim, at(k, radius), at(k + 1, radius), 0.04, 0.04, 4, { caps: [false, false] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    prism(b, T.trim, [0, 0, 0], [Math.cos(a) * (radius + 0.12), Math.sin(a) * (radius + 0.12), 0], 0.025, 0.02, 4);
  }
  prism(b, T.iron, [0, 0, -0.12], [0, 0, 0.12], 0.08, 0.08, 8);
  return b.finish();
}
/** The wheel's pedestal: a post under the wheel's axle (`axleY` over the node), its feet on the deck. */
export function pedestalGeometry(axleY = 0.95) {
  const b = bench();
  block(b, 'trim', [0, axleY / 2, -0.3], [0.18, axleY / 2, 0.18]);
  block(b, 'trim', [0, 0.05, -0.3], [0.5, 0.05, 0.4]);
  return b.finish();
}

// ── the small things ────────────────────────────────────────────────────────────────────────────────────────────────

/** A door's leaf hinged at its node, `w` wide along +x (`side` -1 along -x) and `height` tall about its middle. */
export function doorGeometry(w = 1.2, height = 2.2, thickness = 0.08, side = 1) {
  const b = bench();
  const whole = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  box(b, T.door, [(side * w) / 2, 0, 0], [w / 2, height / 2, thickness / 2], {
    uvFace: (faceIndex, k) => (faceIndex >= 4 ? whole[k] : [0, 0]),
  });
  return b.finish();
}
/** A steep ladder from (`z0`, `y0`) up to (`z1`, `y1`) at `x`, `w` wide: two rails and their rungs, a hand-over-hand
 *  climb no walk takes (a flight is a stair). */
export function steepLadder(b, { x = 0, w = 0.6, z0, y0, z1, y1 }) {
  const n = Math.max(2, Math.round((y1 - y0) / 0.3));
  for (const side of [-1, 1])
    prism(
      b,
      T.trim,
      [x + (side * w) / 2, y0, z0],
      [x + (side * w) / 2, y1 + 0.9, z1 + ((z1 - z0) * 0.9) / (y1 - y0)],
      0.04,
      0.04,
      4,
    );
  for (let i = 1; i < n; i++) {
    const along = i / n;
    const at = [y0 + (y1 - y0) * along, z0 + (z1 - z0) * along];
    prism(b, T.trim, [x - w / 2, at[0], at[1]], [x + w / 2, at[0], at[1]], 0.025, 0.025, 6);
  }
}
/** A hatch's leaf: flat, `w` across x and `depth` along z from its hinge at the node. */
export function hatchGeometry(w, depth, thickness = 0.08, side = 1) {
  const b = bench();
  block(b, 'grate', [(side * w) / 2, 0, 0], [w / 2, thickness / 2, depth / 2]);
  return b.finish();
}
/** A rope ladder hung from its node down `drop` m, `w` wide, standing `out` off the side (x). */
export function ladderGeometry(drop = 3, w = 0.6, out = 0.15) {
  const b = bench();
  for (const side of [-1, 1])
    rope(
      b,
      T.rope,
      [
        [out, 0, (side * w) / 2],
        [out + 0.05, -drop, (side * w) / 2],
      ],
      0.02,
    );
  for (let y = 0.3; y < drop; y += 0.35)
    prism(b, T.trim, [out + (0.05 * y) / drop, -y, -w / 2], [out + (0.05 * y) / drop, -y, w / 2], 0.025, 0.025, 4);
  return b.finish();
}
/** An anchor stowed at its node: its shank down, its stock across, its two arms and their flukes. */
export function anchorGeometry(size = 1) {
  const b = bench();
  const scale = size;
  prism(b, T.iron, [0, 0, 0], [0, -1.1 * scale, 0], 0.06 * scale, 0.07 * scale, 6);
  prism(b, T.trim, [-0.5 * scale, -0.08 * scale, 0], [0.5 * scale, -0.08 * scale, 0], 0.05 * scale, 0.05 * scale, 6);
  for (const side of [-1, 1]) {
    prism(
      b,
      T.iron,
      [0, -1.1 * scale, 0],
      [side * 0.45 * scale, -0.75 * scale, 0.25 * scale],
      0.05 * scale,
      0.04 * scale,
      6,
    );
    block(b, 'iron', [side * 0.45 * scale, -0.75 * scale, 0.25 * scale], [0.12 * scale, 0.1 * scale, 0.03 * scale]);
  }
  prism(b, T.iron, [0, 0.05 * scale, 0], [0, 0.15 * scale, 0], 0.1 * scale, 0.1 * scale, 8, { caps: [false, false] });
  return b.finish();
}
/** An anchor weighed and fished along a ship's side, its ring at its node: its shank forward (+z) `size` m long, its
 *  arms up and down off its crown, its stock square across it (x) behind the ring. `alongX`: the same anchor turned a
 *  quarter (its shank along +x) and centred on its node. */
export function anchorCattedGeometry(size = 1.6, stock = 1.2, alongX = false) {
  if (alongX) return turnedQuarter(anchorCattedGeometry(size, stock), -size / 2);
  const b = bench();
  const scale = size;
  prism(b, T.iron, [0, 0, 0.08 * scale], [0, 0, scale], 0.05 * scale, 0.05 * scale, 6);
  prism(b, T.trim, [-stock / 2, 0, 0.05 * scale], [stock / 2, 0, 0.05 * scale], 0.04 * scale, 0.04 * scale, 6);
  prism(b, T.iron, [0, 0, -0.02 * scale], [0, 0, 0.06 * scale], 0.06 * scale, 0.06 * scale, 8, {
    caps: [false, false],
  });
  for (const upDown of [-1, 1]) {
    prism(b, T.iron, [0, 0, scale], [0, upDown * 0.3 * scale, 0.75 * scale], 0.04 * scale, 0.035 * scale, 6);
    block(b, 'iron', [0, upDown * 0.3 * scale, 0.75 * scale], [0.02 * scale, 0.08 * scale, 0.07 * scale]);
  }
  return b.finish();
}
/** A geometry turned a quarter about y (+z to +x), moved `dx` along x. */
function turnedQuarter(geometry, dx = 0) {
  const positions = Float32Array.from(geometry.positions),
    normals = Float32Array.from(geometry.normals);
  for (let i = 0; i < positions.length; i += 3) {
    const [x, z] = [geometry.positions[i], geometry.positions[i + 2]];
    positions[i] = z + dx;
    positions[i + 2] = -x;
    const [normalX, normalZ] = [geometry.normals[i], geometry.normals[i + 2]];
    normals[i] = normalZ;
    normals[i + 2] = -normalX;
  }
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], positions[i]);
    hi[i % 3] = Math.max(hi[i % 3], positions[i]);
  }
  const center = lo.map((low, axis) => (low + hi[axis]) / 2);
  return { ...geometry, positions, normals, aabb: { center, extent: hi.map((high, axis) => high - center[axis]) } };
}
/** An anchor let go from its node: the cable out of her hawse at `hawse` (its node's frame) and down `depth` m on a
 *  slant, the anchor at its foot. */
export function anchorDeployedGeometry(depth = 6, slant = 1.5, hawse = [0, 0, 0], lead = [0.3, -0.08, 0]) {
  const b = bench();
  const [hawseX, hawseY, hawseZ] = hawse;
  const out = [hawseX + lead[0], hawseY + lead[1], hawseZ + lead[2]];
  rope(
    b,
    T.rope,
    [
      [hawseX, hawseY, hawseZ],
      out,
      [out[0] * 0.4, hawseY - depth * 0.5, out[2] * 0.4 + slant * 0.4],
      [0, -depth, slant],
    ],
    0.04,
  );
  prism(b, T.iron, [0, -depth, slant], [0, -depth - 1, slant], 0.06, 0.07, 6);
  return b.finish();
}
/** Cargo at its node: crates and a barrel on the deck, about `w` by `depth` and `height` tall. */
export function cargoGeometry(w = 0.9, depth = 0.75, height = 0.58) {
  const b = bench();
  const crate = (centre, half) =>
    block(b, 'crate', centre, half, {
      uvFace: (faceIndex, k) =>
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
        ][k],
    });
  crate([-w * 0.22, height * 0.25, 0], [w * 0.28, height * 0.25, depth * 0.45]);
  crate([w * 0.25, height * 0.2, -depth * 0.15], [w * 0.22, height * 0.2, depth * 0.3]);
  crate([-w * 0.2, height * 0.68, 0.02], [w * 0.2, height * 0.18, depth * 0.3]);
  prism(b, T.trim, [w * 0.3, 0, depth * 0.32], [w * 0.3, height * 0.55, depth * 0.32], 0.14, 0.14, 8);
  return b.finish();
}
/** A ship's stove at its node: a brick-lined iron range 2.4 m tall on a hearth, its firebox open forward (+z) at
 *  1.2 m, its stack's foot on its top. */
export function stoveGeometry() {
  const b = bench();
  block(b, 'dark', [0, 0.05, 0.2], [0.62, 0.05, 0.75]);
  block(b, 'iron', [0, 0.6, 0.2], [0.55, 0.5, 0.6]);
  block(b, 'iron', [0, 1.75, 0.0], [0.5, 0.65, 0.42]);
  block(b, 'iron', [0, 1.2, 0.78], [0.3, 0.12, 0.02]);
  prism(b, T.iron, [0, 2.4, -0.38], [0, 2.4 + 0.05, -0.38], 0.16, 0.16, 8);
  return b.finish();
}
/** A stove's cowl up from its node, its top 0.54 m over it (the flue world/ships/galleonModel.js runs up to it). */
export function stovePipeGeometry(height = 0.48) {
  const b = bench();
  prism(b, T.iron, [0, 0, 0], [0, height, 0], 0.12, 0.12, 8, { caps: [false, true] });
  prism(b, T.iron, [0, height, 0], [0, height + 0.06, 0], 0.2, 0.16, 8);
  return b.finish();
}
/** A lantern's pole from its foot (the node) up `height`, its arm out to -z where the lantern hangs (`arm` m). */
export function lanternPoleGeometry(height, arm = 0.36) {
  const b = bench();
  prism(b, T.spar, [0, 0, 0], [0, height, 0], 0.045, 0.035, 6, { smooth: true });
  prism(b, T.iron, [0, height - 0.06, 0], [0, height - 0.06, -arm], 0.018, 0.018, 4);
  prism(b, T.iron, [0, height - 0.06, -arm], [0, height - 0.16, -arm], 0.008, 0.008, 4, { caps: [false, false] });
  return b.finish();
}
/** A lantern's stand on a plank: the plank across its foot, the post up `height`, its arm out to -z. */
export function lanternStandGeometry(height = 2.1, arm = 0.28) {
  const b = bench();
  block(b, 'trim', [0, 0.04, -0.1], [0.36, 0.04, 0.2]);
  prism(b, T.spar, [0, 0.08, 0], [0, height, 0], 0.06, 0.05, 6, { smooth: true });
  prism(b, T.iron, [0, height, 0], [0, height, -arm], 0.02, 0.02, 4);
  return b.finish();
}
/** A lantern's hook on a beam or a wall: an iron bracket out to -z. */
export function lanternHookGeometry(arm = 0.3) {
  const b = bench();
  block(b, 'trim', [0, 0, -0.01], [0.04, 0.09, 0.02]);
  prism(b, T.iron, [0, 0.02, 0], [0, 0.02, -arm], 0.016, 0.016, 4);
  return b.finish();
}
/** A hammock slung between two posts at its node, `length` long along z. */
export function hammockGeometry(length = 2.4, height = 1.1) {
  const b = bench();
  for (const end of [-1, 1])
    prism(b, T.spar, [0, 0, (end * length) / 2], [0, height + 0.4, (end * length) / 2], 0.05, 0.05, 6);
  const sag = [];
  for (let i = 0; i <= 6; i++) {
    const along = i / 6;
    sag.push([0, height - 0.35 * 4 * along * (1 - along), -length / 2 + 0.2 + (length - 0.4) * along]);
  }
  for (let i = 0; i < 6; i++) {
    const a = sag[i],
      next = sag[i + 1];
    face(
      b,
      T.canvas,
      'awning',
      [add(a, [-0.35, 0, 0]), add(a, [0.35, 0, 0]), add(next, [0.35, 0, 0]), add(next, [-0.35, 0, 0])],
      [0, 1, 0],
    );
    face(
      b,
      T.canvas,
      'awning',
      [add(a, [-0.35, 0, 0]), add(a, [0.35, 0, 0]), add(next, [0.35, 0, 0]), add(next, [-0.35, 0, 0])],
      [0, -1, 0],
    );
  }
  return b.finish();
}
/** A thwart or a bench across x from `-w` to `w` at `y`, `depth` deep. */
export function thwart(b, w, y, z, depth = 0.25, thickness = 0.05) {
  block(b, 'trim', [0, y - thickness / 2, z], [w, thickness / 2, depth / 2]);
}
/** An awning: four posts at its node's corners (`w` a side, `aftZ`..`foreZ` along z) up `height`, a ridged canvas over them,
 *  and its after end (`aftZ`) closed by a curtain `curtain` m deep under the eaves and the gable over it. */
export function awningGeometry(w, aftZ, foreZ, height, ridge = 0.8, curtain = 0) {
  const b = bench();
  for (const side of [-1, 1])
    for (const z of [aftZ, foreZ]) prism(b, T.spar, [side * w, 0, z], [side * w, height, z], 0.08, 0.07, 6);
  const top = height + ridge;
  for (const side of [-1, 1]) {
    const quad = [
      [side * w, height, aftZ],
      [0, top, aftZ],
      [0, top, foreZ],
      [side * w, height, foreZ],
    ];
    face(b, T.awning, 'awning', quad, [side, 1, 0]);
    face(b, T.awning, 'awning', quad, [-side, -1, 0]);
  }
  if (curtain > 0) {
    const back = [
      [-w, height - curtain, aftZ],
      [w, height - curtain, aftZ],
      [w, height, aftZ],
      [0, top, aftZ],
      [-w, height, aftZ],
    ];
    face(b, T.awning, 'awning', back, [0, 0, -1]);
    face(b, T.awning, 'awning', back, [0, 0, 1]);
  }
  return b.finish();
}
/** A row of oar ports' frames along a side at `x` (its sign the side), from `z0` to `z1` at heights `heights`. */
export function oarStationGeometry(x, z0, z1, heights, n) {
  const b = bench();
  const side = Math.sign(x) || 1;
  for (const y of heights) block(b, 'trim', [x, y - 0.12, (z0 + z1) / 2], [0.12, 0.06, (z1 - z0) / 2]);
  for (let k = 0; k < n; k++) {
    const z = z0 + ((z1 - z0) * k) / Math.max(1, n - 1);
    block(
      b,
      'dark',
      [x - side * 0.05, (heights[0] + heights[heights.length - 1]) / 2, z],
      [0.08, (heights[heights.length - 1] - heights[0]) / 2 + 0.2, 0.06],
    );
  }
  return b.finish();
}
/** A flat plate at its node's height over a hull's plan (`w` a side, `z0`..`z1`): a water mask's face, never drawn. */
export function plateGeometry(w, z0, z1) {
  const b = bench();
  face(
    b,
    T.deck,
    'deck',
    [
      [-w, 0, z0],
      [w, 0, z0],
      [w, 0, z1],
      [-w, 0, z1],
    ],
    [0, 1, 0],
  );
  return b.finish();
}

/** A geometry's collider (the fleet's: every triangle, welded). */
export { colliderOf, len };

/** An anchor stowed flat on a deck at its node: its shank along +z, its stock across, its arms' flukes lifted -
 *  its lowest point `size` x 0.06 under its node. */
export function anchorStowedGeometry(size = 1) {
  const b = bench();
  const scale = size;
  prism(b, T.iron, [0, 0, -0.1 * scale], [0, 0, 1.0 * scale], 0.06 * scale, 0.06 * scale, 6);
  prism(
    b,
    T.trim,
    [-0.5 * scale, 0.0, -0.02 * scale],
    [0.5 * scale, 0.0, -0.02 * scale],
    0.05 * scale,
    0.05 * scale,
    6,
  );
  for (const side of [-1, 1]) {
    prism(
      b,
      T.iron,
      [0, 0, 1.0 * scale],
      [side * 0.42 * scale, 0.12 * scale, 0.7 * scale],
      0.05 * scale,
      0.04 * scale,
      6,
    );
    block(b, 'iron', [side * 0.42 * scale, 0.14 * scale, 0.7 * scale], [0.1 * scale, 0.03 * scale, 0.1 * scale]);
  }
  return b.finish();
}

/** Geometries as one, each sub-mesh kept on its own picture. */
export function merge(...geometries) {
  const b = bench();
  for (const geometry of geometries) {
    if (!geometry) continue;
    for (const [slot, subMesh] of geometry.subMeshes.entries()) {
      const rec = geometry.slots[slot].record;
      const at = (i, n, src) => Array.from({ length: n }, (_, axis) => src[geometry.indices[i] * n + axis]);
      for (let corner = subMesh.startIndex; corner < subMesh.startIndex + subMesh.primitiveCount * 3; corner += 3)
        b.tri(
          rec,
          at(corner, 3, geometry.positions),
          at(corner + 1, 3, geometry.positions),
          at(corner + 2, 3, geometry.positions),
          at(corner, 2, geometry.uvs),
          at(corner + 1, 2, geometry.uvs),
          at(corner + 2, 2, geometry.uvs),
          null,
          [at(corner, 3, geometry.normals), at(corner + 1, 3, geometry.normals), at(corner + 2, 3, geometry.normals)],
        );
    }
  }
  return b.finish();
}
