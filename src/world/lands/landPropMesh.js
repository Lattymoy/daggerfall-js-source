// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The landmarks"): THE LANDMARKS, MADE - procedural low-poly meshes of the
// port's own, every vertex a function of its kind's and variant's seed: the parasol (Morrowind's giant fungi), the spire
// (a pillar, a hoodoo, a crag, a standing stone, a termite mound), the Hist, the reeds, a vineyard's row, a grove's tree.
// Flat-shaded, each face wound out (the graht-oaks' law, world/jungle/grahtOakMesh.js), in three submeshes (body, crown,
// detail) at three LODs. Pure: (kind, variant, lod) in, typed arrays out; scenes/landPropsHost.js draws them.
import { grahtRng, icosphere, bezier, blobJitter } from '../jungle/grahtOakMesh.js';

/** The kinds, in their index order (the sites' float), and each one's variants. */
export const LAND_KINDS = Object.freeze(['parasol', 'spire', 'hist', 'reeds', 'vines', 'grove']);
export const LAND_VARIANTS = Object.freeze({ parasol: 4, spire: 5, hist: 3, reeds: 3, vines: 2, grove: 3 });
/** The LODs, and the submeshes in their order. */
export const LAND_LODS = 3;
export const LAND_SUBS = Object.freeze(['body', 'crown', 'detail']);

const lerp = (a, b, t) => a + (b - a) * t;
const within = (r, ab) => lerp(ab[0], ab[1], r());
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** A variant's seed: its kind's and its own. */
export const landSeed = (kind, variant) =>
  (0x4c414e44 ^ Math.imul(LAND_KINDS.indexOf(kind) + 1, 0x85ebca6b) ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0;

/** A growing flat-shaded mesh: three vertices a face (position, normal, uv), in LAND_SUBS' three submeshes. */
function builder() {
  const subs = LAND_SUBS.map(() => ({ p: [], n: [], uv: [] }));
  const tri = (s, a, b, c, ua, ub, uc) => {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (!(l > 1e-9)) return; // a degenerate face draws nothing
    nx /= l;
    ny /= l;
    nz /= l;
    const m = subs[s];
    m.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    m.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    m.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };
  /** a face wound to face along `out` whichever way round it was handed */
  const triOut = (s, a, b, c, ua, ub, uc, out) => {
    if (dot(cross(sub3(b, a), sub3(c, a)), out) >= 0) tri(s, a, b, c, ua, ub, uc);
    else tri(s, a, c, b, ua, uc, ub);
  };
  const quadOut = (s, a, b, c, d, ua, ub, uc, ud, out) => {
    triOut(s, a, b, c, ua, ub, uc, out);
    triOut(s, a, c, d, ua, uc, ud, out);
  };
  /** each submesh's vertices so far */
  const mark = () => subs.map((q) => q.p.length / 3);
  /** TESA-LANDS' second audit (lane D): A SOLID PART - what `make()` lays about the upright axis at (x, z) is one body
   *  (a stalk, a lump of rock, a trunk), its radius and its height read off its own vertices at finish */
  const parts = [];
  const part = (x, z, make) => {
    const from = mark();
    const o = make();
    parts.push({ x, z, from, to: mark() });
    return o;
  };
  return { tri, triOut, quadOut, subs, mark, part, parts };
}

/** TESA-LANDS' second audit (lane D): how high over its foot (m, at scale 1) a landmark's solid is read for its feet and
 *  its bodies - the ground to a man's chest, its LOD 0 sunk a metre or so. */
export const LAND_CHEST = 2;

/** The made mesh: the three submeshes end to end - and, read off its body's and its crown's vertices (never the detail's
 *  cards: gills, moss, leaves) up to LAND_CHEST, its FOOT (the widest of them from its axis: a crag's satellite lumps, a
 *  grove of three's outer stalks, the Hist's roots) and each solid PART's radius about its own axis and its height (the
 *  second audit: one stalk's or one lump's had stood for the whole - the player walked metres into a crag's rock). */
function finish(m, extra) {
  const counts = m.subs.map((s) => s.p.length / 3);
  const total = counts.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(total * 3),
    normals = new Float32Array(total * 3),
    uvs = new Float32Array(total * 2);
  const subs = [];
  let at = 0;
  m.subs.forEach((s, i) => {
    positions.set(s.p, at * 3);
    normals.set(s.n, at * 3);
    uvs.set(s.uv, at * 2);
    subs.push([at, counts[i]]);
    at += counts[i];
  });
  let foot = 0;
  for (const si of [BODY, CROWN]) {
    const p = m.subs[si].p;
    for (let k = 0; k < p.length; k += 3) if (p[k + 1] <= LAND_CHEST) foot = Math.max(foot, Math.hypot(p[k], p[k + 2]));
  }
  const parts = m.parts.map((q) => {
    let r = 0,
      h = 0;
    for (const si of [BODY, CROWN, DETAIL]) {
      const p = m.subs[si].p;
      for (let k = q.from[si] * 3; k < q.to[si] * 3; k += 3) {
        h = Math.max(h, p[k + 1]);
        if (si !== DETAIL && p[k + 1] <= LAND_CHEST) r = Math.max(r, Math.hypot(p[k] - q.x, p[k + 2] - q.z));
      }
    }
    return Object.freeze({ x: q.x, z: q.z, r, h });
  });
  return { positions, normals, uvs, subs, foot, parts: Object.freeze(parts), ...extra };
}

/**
 * A RING-SWEPT SOLID along an upright axis: `rings` [{ y, r, c: [x, z], wob? }] from its foot up, `sides` round each (a
 * vertex's radius pushed by `jit`(ring, side) - a rock's facets), its sides in submesh `s` (`crown` for those faces whose
 * normal looks up past `up`), capped at its top (`capS`) unless `open`. uv: round it `uScale` pictures, up it a picture a
 * `vScale` metres.
 */
function sweep(
  m,
  s,
  rings,
  sides,
  { jit = null, crown = -1, up = 0.62, capS = s, open = false, uScale = 2, vScale = 4, twist = 0 } = {},
) {
  const pts = rings.map((ring, k) => {
    const row = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * 6.283185307 + twist * ring.y,
        j = jit ? jit(k, i % sides) : 0,
        r = ring.r * (1 + j);
      row.push([ring.c[0] + Math.cos(a) * r, ring.y, ring.c[1] + Math.sin(a) * r]);
    }
    return row;
  });
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = pts[k],
      B = pts[k + 1],
      v0 = rings[k].y / vScale,
      v1 = rings[k + 1].y / vScale,
      cA = rings[k].c,
      cB = rings[k + 1].c;
    for (let i = 0; i < sides; i++) {
      const u0 = (i / sides) * uScale,
        u1 = ((i + 1) / sides) * uScale;
      const a = A[i],
        b = B[i],
        c = B[i + 1],
        d = A[i + 1];
      const mid = [(a[0] + c[0]) / 2 - (cA[0] + cB[0]) / 2, 0, (a[2] + c[2]) / 2 - (cA[1] + cB[1]) / 2];
      const n = cross(sub3(b, a), sub3(c, a)),
        l = Math.hypot(n[0], n[1], n[2]) || 1;
      const outward = dot(n, mid) >= 0 ? 1 : -1,
        ny = (n[1] / l) * outward;
      m.quadOut(crown >= 0 && ny > up ? crown : s, a, b, c, d, [u0, v0], [u0, v1], [u1, v1], [u1, v0], mid);
    }
  }
  if (!open) {
    const T = pts[pts.length - 1],
      top = rings[rings.length - 1],
      cy = top.y + top.r * 0.12,
      apex = [top.c[0], cy, top.c[1]];
    for (let i = 0; i < sides; i++)
      m.triOut(
        capS,
        T[i],
        T[i + 1],
        apex,
        [T[i][0] / 4, T[i][2] / 4],
        [T[i + 1][0] / 4, T[i + 1][2] / 4],
        [apex[0] / 4, apex[2] / 4],
        [0, 1, 0],
      );
  }
  return pts;
}

/** A tube along a cubic path (the graht-oaks' limbs' law): `sides` round, `segs` along, radius r0 to r1, capped. */
function tube(m, s, path, r0, r1, sides, segs) {
  const rings = [];
  let len = 0,
    last = null;
  for (let k = 0; k <= segs; k++) {
    const tt = k / segs,
      p = bezier(path, tt);
    const q = bezier(path, Math.min(1, tt + 0.01)),
      q0 = bezier(path, Math.max(0, tt - 0.01));
    const dir = norm(sub3(q, q0));
    const side = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm(cross(dir, side)),
      e2 = cross(e1, dir);
    const r = lerp(r0, r1, tt);
    if (last) len += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
    last = p;
    const pts = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * 6.283185307;
      pts.push([
        p[0] + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r,
        p[1] + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r,
        p[2] + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r,
      ]);
    }
    rings.push({ pts, v: len / 6, c: p });
  }
  for (let k = 0; k < segs; k++) {
    const A = rings[k],
      B = rings[k + 1];
    for (let i = 0; i < sides; i++) {
      const a = A.pts[i],
        b = B.pts[i],
        c = B.pts[i + 1],
        d = A.pts[i + 1];
      const mid = [(a[0] + c[0]) / 2 - A.c[0], (a[1] + c[1]) / 2 - A.c[1], (a[2] + c[2]) / 2 - A.c[2]];
      m.quadOut(s, a, b, c, d, [i / sides, A.v], [i / sides, B.v], [(i + 1) / sides, B.v], [(i + 1) / sides, A.v], mid);
    }
  }
  const E = rings[segs],
    end = bezier(path, 1),
    out = sub3(bezier(path, 1), bezier(path, 0.97));
  for (let i = 0; i < sides; i++)
    m.triOut(s, E.pts[i], E.pts[i + 1], end, [0, E.v], [0.1, E.v], [0.05, E.v + 0.1], out);
}

/** A mass of an icosphere (`sub` times subdivided) at `c`, radius `r`, its height `squash` of it, its underside flattened
 *  by `under`, its vertices pushed by its seed - in submesh `s`, uv by the plane each face looks along (`uvM` metres a picture). */
function blob(m, s, c, r, squash, under, seed, sub, uvM = 8) {
  const sph = icosphere(sub);
  const pts = sph.v.map((d, i) => {
    const k = 1 + 0.16 * blobJitter(seed, i),
      y = d[1] < 0 ? d[1] * under : d[1];
    return [c[0] + d[0] * r * k, c[1] + y * r * squash * k, c[2] + d[2] * r * k];
  });
  for (const [i, j, k] of sph.f) {
    const A = pts[i],
      B = pts[j],
      C = pts[k];
    const n = cross(sub3(B, A), sub3(C, A)),
      ax = Math.abs(n[0]),
      ay = Math.abs(n[1]),
      az = Math.abs(n[2]);
    const uv = (P) =>
      ay >= ax && ay >= az ? [P[0] / uvM, P[2] / uvM] : ax >= az ? [P[2] / uvM, P[1] / uvM] : [P[0] / uvM, P[1] / uvM];
    m.tri(s, A, B, C, uv(A), uv(B), uv(C));
  }
}

/** A card (a quad cut by its picture's alpha), at `at`, along `tg` and up `up`, `w` x `h` metres, its picture's rect
 *  [u0, v0, u1, v1] - drawn on both faces (the detail submesh's material culls none). */
function card(m, s, at, tg, up, w, h, rect) {
  const P = (x, y) => [
    at[0] + tg[0] * x * w + up[0] * y * h,
    at[1] + tg[1] * x * w + up[1] * y * h,
    at[2] + tg[2] * x * w + up[2] * y * h,
  ];
  const [u0, v0, u1, v1] = rect;
  m.tri(s, P(-0.5, 0), P(0.5, 0), P(0.5, 1), [u0, v0], [u1, v0], [u1, v1]);
  m.tri(s, P(-0.5, 0), P(0.5, 1), P(-0.5, 1), [u0, v0], [u1, v1], [u0, v1]);
}

const BODY = 0,
  CROWN = 1,
  DETAIL = 2;
/** A part about the axis begun here, closed - pushed - by calling what this answers (for a part laid in several steps). */
const mark0 = (m) => {
  const from = m.mark();
  return () => m.parts.push({ x: 0, z: 0, from, to: m.mark() });
};

// ─── THE PARASOL ──────────────────────────────────────────────────

/** One emperor parasol at (ox, oz): its stalk `h` high and `r0` at its foot, its cap `R` across. */
function parasolOne(m, r, lod, ox, oz, h, r0, R) {
  const sides = [9, 7, 5][lod],
    capSeg = [14, 10, 6][lod];
  const lean = [lerp(-0.12, 0.12, r()) * h, lerp(-0.12, 0.12, r()) * h];
  const at = (t) => [ox + lean[0] * t * t, oz + lean[1] * t * t];
  // the stalk: its foot flared, a slight swell under the cap
  const ys = lod === 2 ? [-0.6, h * 0.5, h] : [-0.6, 0, h * 0.12, h * 0.35, h * 0.6, h * 0.82, h];
  const rings = ys.map((y) => {
    const t = Math.max(0, y) / h;
    const rr = r0 * (0.55 + 0.45 * Math.exp(-t * 5)) * (1 + 0.12 * Math.sin(t * 3.14159));
    return { y, r: rr, c: at(t) };
  });
  sweep(m, BODY, rings, sides, { open: true, uScale: 1, vScale: 3 });
  // the cap: a flattened dome over the stalk's top, its rim drooping; its gills a shallow cone under it
  const top = at(1),
    capH = R * lerp(0.2, 0.3, r()),
    rimY = h - R * 0.08,
    ring = [];
  const nR = lod === 2 ? 2 : 3;
  for (let k = 0; k <= nR; k++) {
    const t = k / nR,
      rr = R * (1 - t * t * 0.94 - (k === nR ? 0.06 : 0)),
      y = rimY + capH * (1 - Math.pow(1 - t, 2.2));
    const row = [];
    for (let i = 0; i <= capSeg; i++) {
      const a = (i / capSeg) * 6.283185307,
        wob = 1 + 0.05 * Math.sin(a * 3 + R);
      row.push([top[0] + Math.cos(a) * rr * wob, y, top[1] + Math.sin(a) * rr * wob]);
    }
    ring.push(row);
  }
  for (let k = 0; k < nR; k++) {
    for (let i = 0; i < capSeg; i++) {
      const a = ring[k][i],
        b = ring[k + 1][i],
        c = ring[k + 1][i + 1],
        d = ring[k][i + 1];
      m.quadOut(
        CROWN,
        a,
        b,
        c,
        d,
        [a[0] / 6, a[2] / 6],
        [b[0] / 6, b[2] / 6],
        [c[0] / 6, c[2] / 6],
        [d[0] / 6, d[2] / 6],
        [0, 1, 0],
      );
    }
  }
  const apex = [top[0], rimY + capH * 1.02, top[1]],
    last = ring[nR];
  for (let i = 0; i < capSeg; i++)
    m.triOut(
      CROWN,
      last[i],
      last[i + 1],
      apex,
      [last[i][0] / 6, last[i][2] / 6],
      [last[i + 1][0] / 6, last[i + 1][2] / 6],
      [apex[0] / 6, apex[2] / 6],
      [0, 1, 0],
    );
  // the gills: from the rim in to the stalk, facing down
  const gill = [top[0], h - 0.15, top[1]],
    rim = ring[0];
  for (let i = 0; i < capSeg; i++) {
    const a = rim[i],
      b = rim[i + 1];
    m.triOut(
      DETAIL,
      a,
      b,
      gill,
      [(i / capSeg) * 4, 0],
      [((i + 1) / capSeg) * 4, 0],
      [((i + 0.5) / capSeg) * 4, 1],
      [0, -1, 0],
    );
  }
  return { top: h + capH, reach: Math.hypot(lean[0], lean[1]) + R };
}

/** A pod on its stalk (the Telvanni's grown pod, Deshaan's glowstalk): a thinner stalk, a bulb. */
function podOne(m, r, lod, ox, oz, h, r0, R) {
  const sides = [8, 6, 5][lod];
  const lean = [lerp(-0.15, 0.15, r()) * h, lerp(-0.15, 0.15, r()) * h];
  const at = (t) => [ox + lean[0] * t * t, oz + lean[1] * t * t];
  const ys = lod === 2 ? [-0.5, h] : [-0.5, 0, h * 0.3, h * 0.65, h];
  sweep(
    m,
    BODY,
    ys.map((y) => ({ y, r: r0 * (0.7 + 0.3 * Math.exp((-Math.max(0, y) / h) * 4)), c: at(Math.max(0, y) / h) })),
    sides,
    { open: true, uScale: 1, vScale: 3 },
  );
  const top = at(1);
  blob(
    m,
    CROWN,
    [top[0], h + R * 0.55, top[1]],
    R,
    lerp(0.85, 1.05, r()),
    0.7,
    (r() * 4294967296) >>> 0,
    lod === 0 ? 1 : 0,
    4,
  );
  return { top: h + R * 1.6, reach: Math.hypot(lean[0], lean[1]) + R * 1.1 };
}

function parasolMesh(variant, lod) {
  const r = grahtRng(landSeed('parasol', variant)),
    m = builder();
  let top = 0,
    reach = 0,
    stalk = 0;
  const take = (o) => {
    top = Math.max(top, o.top);
    reach = Math.max(reach, o.reach);
  };
  if (variant === 0) {
    const h = within(r, [11.5, 15]),
      r0 = within(r, [1.0, 1.3]);
    take(m.part(0, 0, () => parasolOne(m, r, lod, 0, 0, h, r0, within(r, [5.5, 7.5]))));
    stalk = r0;
  } else if (variant === 1) {
    const h = within(r, [9, 12]),
      r0 = within(r, [1.0, 1.25]);
    take(m.part(0, 0, () => parasolOne(m, r, lod, 0, 0, h, r0, within(r, [5.5, 7]))));
    const n = lod === 2 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const a = r() * 6.283 + k * 2.6,
        d = within(r, [2.6, 3.6]),
        s = within(r, [0.5, 0.72]);
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d; // the grove's own stalks: each its own body
      take(m.part(x, z, () => parasolOne(m, r, lod, x, z, h * s, r0 * s * 1.1, within(r, [4, 5.5]) * s * 1.2)));
    }
    stalk = r0;
  } else if (variant === 2) {
    const h = within(r, [6, 8.5]),
      r0 = within(r, [0.45, 0.6]);
    take(m.part(0, 0, () => podOne(m, r, lod, 0, 0, h, r0, within(r, [2.2, 3.0]))));
    stalk = r0;
  } else {
    // xylaria: spikes from one foot, leaning out, their top quarter the crown's (its dark tips) - the cluster one body
    const n = [8, 6, 4][lod],
      sides = [5, 4, 3][lod];
    m.part(0, 0, () => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.283 + r() * 0.6,
          d = k ? within(r, [0.4, 1.4]) : 0,
          h = within(r, [2.2, 5.5]) * (k ? 0.8 : 1.15);
        const base = [Math.cos(a) * d, Math.sin(a) * d],
          tip = [base[0] + Math.cos(a) * h * 0.22, base[1] + Math.sin(a) * h * 0.22];
        const r0 = within(r, [0.22, 0.38]) * (k ? 1 : 1.3);
        const ring = (t) => ({
          y: -0.3 + (h + 0.3) * t,
          r: r0 * (1 - t * 0.92),
          c: [lerp(base[0], tip[0], t * t), lerp(base[1], tip[1], t * t)],
        });
        sweep(m, BODY, [ring(0), ring(0.4), ring(0.72)], sides, { open: true, uScale: 1, vScale: 2 });
        sweep(m, CROWN, [ring(0.72), ring(0.9)], sides, { capS: CROWN, uScale: 1, vScale: 2 });
        top = Math.max(top, h);
        reach = Math.max(reach, d + h * 0.25);
      }
    });
    stalk = 0.6;
  }
  return finish(m, { top, reach, stalk });
}

// ─── THE SPIRE ────────────────────────────────────────────────────

function spireMesh(variant, lod) {
  const r = grahtRng(landSeed('spire', variant)),
    m = builder();
  const jitSeed = (r() * 4294967296) >>> 0;
  const jit = (amp) => (k, i) => amp * blobJitter(jitSeed + k * 131, i);
  let top = 0,
    reach = 0,
    foot = 0;
  if (variant === 0 || variant === 1) {
    // a pillar (an obelisk's taper) or a hoodoo (a waist under its caprock)
    const h = variant === 0 ? within(r, [8, 13]) : within(r, [6.5, 10]),
      rb = within(r, [1.7, 2.5]),
      rt = variant === 0 ? rb * within(r, [0.45, 0.6]) : rb * within(r, [0.55, 0.7]);
    const sides = [8, 6, 5][lod],
      n = [9, 5, 2][lod];
    const lean = [lerp(-0.08, 0.08, r()) * h, lerp(-0.08, 0.08, r()) * h];
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        y = -1 + (h + 1) * t;
      const waist = variant === 1 ? 1 - 0.28 * Math.sin(t * 3.14159) : 1;
      rings.push({ y, r: lerp(rb, rt, t) * waist, c: [lean[0] * t, lean[1] * t] });
    }
    const column = mark0(m);
    sweep(m, BODY, rings, sides, {
      jit: jit(lod === 2 ? 0.08 : 0.16),
      crown: CROWN,
      up: 0.82,
      capS: CROWN,
      vScale: 3,
      uScale: 2,
    });
    top = h;
    reach = rb * 1.2;
    foot = rb;
    if (variant === 1) {
      // the caprock: a wider, harder slab on the column's top
      const ct = [lean[0], lean[1]],
        cr = rt * within(r, [1.7, 2.2]),
        ch = within(r, [0.9, 1.5]);
      sweep(
        m,
        CROWN,
        [
          { y: h - 0.2, r: cr * 0.92, c: ct },
          { y: h + ch * 0.55, r: cr, c: ct },
          { y: h + ch, r: cr * 0.86, c: ct },
        ],
        sides,
        { jit: jit(0.12), capS: CROWN, vScale: 2 },
      );
      top = h + ch;
      reach = Math.max(reach, cr * 1.15);
    }
    column();
  } else if (variant === 2) {
    // a crag: a broad lump of rock and its two smaller ones, sunk a third into the ground; its tops the crown's
    const R = within(r, [4.5, 6.5]),
      sub = lod === 0 ? 2 : lod === 1 ? 1 : 0;
    const lump = (c, rr, sq, seed) => {
      const sph = icosphere(sub);
      const pts = sph.v.map((d, i) => {
        const k = 1 + 0.28 * blobJitter(seed, i) * (lod === 2 ? 0.6 : 1);
        return [c[0] + d[0] * rr * k, c[1] + d[1] * rr * sq * k, c[2] + d[2] * rr * k];
      });
      for (const [i, j, k] of sph.f) {
        const A = pts[i],
          B = pts[j],
          C = pts[k],
          n = cross(sub3(B, A), sub3(C, A)),
          l = Math.hypot(n[0], n[1], n[2]) || 1;
        const uv = (P) => [(P[0] + P[2]) / 6, P[1] / 4];
        m.tri(n[1] / l > 0.6 ? CROWN : BODY, A, B, C, uv(A), uv(B), uv(C));
      }
    };
    const sq = within(r, [0.85, 1.25]);
    m.part(0, 0, () => lump([0, R * sq * 0.35, 0], R, sq, (r() * 4294967296) >>> 0));
    if (lod < 2)
      for (let k = 0; k < 2; k++) {
        const a = r() * 6.283,
          d = R * within(r, [0.8, 1.1]),
          rr = R * within(r, [0.35, 0.55]);
        const x = Math.cos(a) * d,
          z = Math.sin(a) * d; // each lump its own body
        m.part(x, z, () => lump([x, rr * 0.3, z], rr, within(r, [0.7, 1.1]), (r() * 4294967296) >>> 0));
        reach = Math.max(reach, d + rr);
      }
    top = R * sq * 1.35 * 1.28;
    reach = Math.max(reach, R * 1.28);
    foot = R * 0.9;
  } else if (variant === 3) {
    // a standing stone: a slab, tapering to a rounded top, leaning a little
    const h = within(r, [2.8, 4.4]),
      w = within(r, [1.0, 1.4]),
      d = within(r, [0.45, 0.6]),
      lean = lerp(-0.12, 0.12, r());
    const n = [4, 3, 1][lod],
      prof = [],
      stone = mark0(m);
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        y = -0.6 + (h + 0.6) * t,
        s = 1 - 0.35 * t * t;
      prof.push({ y, w: w * s, d: d * (1 - 0.2 * t), x: lean * y });
    }
    for (let k = 0; k < n; k++) {
      const A = prof[k],
        B = prof[k + 1];
      const ca = [
        [A.x - A.w / 2, A.y, -A.d / 2],
        [A.x + A.w / 2, A.y, -A.d / 2],
        [A.x + A.w / 2, A.y, A.d / 2],
        [A.x - A.w / 2, A.y, A.d / 2],
      ];
      const cb = [
        [B.x - B.w / 2, B.y, -B.d / 2],
        [B.x + B.w / 2, B.y, -B.d / 2],
        [B.x + B.w / 2, B.y, B.d / 2],
        [B.x - B.w / 2, B.y, B.d / 2],
      ];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          mid = [(ca[i][0] + ca[j][0]) / 2 - A.x, 0, (ca[i][2] + ca[j][2]) / 2];
        m.quadOut(
          BODY,
          ca[i],
          cb[i],
          cb[j],
          ca[j],
          [i / 2, A.y / 2],
          [i / 2, B.y / 2],
          [(i + 1) / 2, B.y / 2],
          [(i + 1) / 2, A.y / 2],
          mid,
        );
      }
    }
    const T = prof[n],
      tc = [
        [T.x - T.w / 2, T.y, -T.d / 2],
        [T.x + T.w / 2, T.y, -T.d / 2],
        [T.x + T.w / 2, T.y, T.d / 2],
        [T.x - T.w / 2, T.y, T.d / 2],
      ];
    const apex = [T.x, T.y + T.w * 0.25, 0];
    for (let i = 0; i < 4; i++) m.triOut(CROWN, tc[i], tc[(i + 1) % 4], apex, [0, 0], [1, 0], [0.5, 0.5], [0, 1, 0]);
    stone();
    top = h + w * 0.25;
    reach = w;
    foot = w * 0.6;
  } else {
    // a termite mound: a ridged cone with a few lumps
    const h = within(r, [2.4, 4.0]),
      rb = within(r, [1.3, 1.9]),
      sides = [9, 7, 5][lod],
      n = [5, 3, 1][lod];
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      rings.push({ y: -0.5 + (h + 0.5) * t, r: rb * (1 - t * 0.82), c: [0, 0] });
    }
    m.part(0, 0, () => {
      sweep(m, BODY, rings, sides, { jit: jit(0.2), crown: CROWN, up: 0.75, capS: CROWN, vScale: 2, uScale: 1 });
      if (lod < 2)
        for (let k = 0; k < 3; k++) {
          const a = r() * 6.283,
            d = rb * 0.55;
          blob(
            m,
            BODY,
            [Math.cos(a) * d, h * within(r, [0.25, 0.55]), Math.sin(a) * d],
            rb * within(r, [0.35, 0.5]),
            1.1,
            0.8,
            (r() * 4294967296) >>> 0,
            0,
            3,
          );
        }
    });
    top = h + 0.3;
    reach = rb * 1.2;
    foot = rb;
  }
  return finish(m, { top, reach, stalk: foot });
}

// ─── THE HIST ─────────────────────────────────────────────────────

function histMesh(variant, lod) {
  const r = grahtRng(landSeed('hist', variant)),
    m = builder();
  const crownFrom = within(r, [11, 15]),
    r0 = within(r, [2.6, 3.4]),
    sides = [12, 8, 5][lod];
  // the trunk: a gnarled column, bulging and twisting, its lean a slow spiral
  const turn = r() * 6.283,
    sway = within(r, [1.0, 2.0]);
  const axis = (y) => [
    Math.cos(turn + y * 0.09) * sway * (y / crownFrom),
    Math.sin(turn + y * 0.09) * sway * (y / crownFrom),
  ];
  const ys = lod === 2 ? [-2, crownFrom * 0.5, crownFrom + 2] : [-2, 0, 1.5, 4, 7, 10, crownFrom, crownFrom + 2.5];
  const rings = ys.map((y) => {
    const t = Math.max(0, y) / crownFrom;
    return { y, r: r0 * (0.72 + 0.6 * Math.exp(-t * 4) + 0.12 * Math.sin(t * 9 + turn)), c: axis(Math.max(0, y)) };
  });
  const seed = (r() * 4294967296) >>> 0;
  m.part(0, 0, () =>
    sweep(m, BODY, rings, sides, {
      jit: (k, i) => (lod === 2 ? 0.05 : 0.12) * blobJitter(seed + k * 97, i),
      twist: 0.05,
      vScale: 6,
      uScale: 2,
      capS: BODY,
    }),
  ); // the trunk the body; its roots the foot's
  // the root flares: tubes from the trunk's foot out and down into the mud
  const nRoots = [7, 5, 0][lod];
  for (let k = 0; k < nRoots; k++) {
    const a = (k / nRoots) * 6.283 + r() * 0.5,
      reachR = within(r, [6, 9]),
      y0 = within(r, [2.5, 5]);
    const c = axis(y0),
      p0 = [c[0] + Math.cos(a) * r0 * 0.6, y0, c[1] + Math.sin(a) * r0 * 0.6];
    const p3 = [Math.cos(a) * reachR, -1.2, Math.sin(a) * reachR];
    tube(
      m,
      BODY,
      [p0, [p0[0] + Math.cos(a) * 2.5, y0 * 0.8, p0[2] + Math.sin(a) * 2.5], [p3[0] * 0.75, 0.6, p3[2] * 0.75], p3],
      within(r, [0.9, 1.3]),
      0.35,
      lod === 0 ? 6 : 4,
      lod === 0 ? 4 : 2,
    );
  }
  // the limbs and the crown's masses; the moss hung under them
  const nLimbs = [6, 5, 4][lod],
    top = axis(crownFrom);
  let height = crownFrom,
    reach = r0;
  for (let k = 0; k < nLimbs; k++) {
    const a = (k / nLimbs) * 6.283 + r() * 0.7,
      len = within(r, [9, 14]),
      rise = within(r, [0.25, 0.55]);
    const p0 = [top[0], crownFrom - within(r, [0, 3]), top[1]],
      p3 = [p0[0] + Math.cos(a) * len, p0[1] + len * rise, p0[2] + Math.sin(a) * len];
    tube(
      m,
      BODY,
      [
        p0,
        [p0[0] + Math.cos(a) * len * 0.35, p0[1] + len * rise * 0.6, p0[2] + Math.sin(a) * len * 0.35],
        [p0[0] + Math.cos(a) * len * 0.7, p0[1] + len * rise * 0.95, p0[2] + Math.sin(a) * len * 0.7],
        p3,
      ],
      within(r, [1.1, 1.5]),
      0.45,
      [6, 5, 3][lod],
      [4, 2, 1][lod],
    );
    const nB = lod === 2 ? 1 : 2;
    for (let i = 0; i < nB; i++) {
      const R = within(r, [5.5, 8]) * (i ? 0.8 : 1),
        c = [p3[0] + (r() - 0.5) * 4, p3[1] + within(r, [1, 3]), p3[2] + (r() - 0.5) * 4];
      blob(m, CROWN, c, R, within(r, [0.45, 0.6]), 0.55, (r() * 4294967296) >>> 0, lod === 0 ? 1 : 0, 6);
      height = Math.max(height, c[1] + R * 0.6);
      reach = Math.max(reach, Math.hypot(c[0], c[2]) + R);
      if (lod === 0)
        for (let j = 0; j < 3; j++) {
          const aa = r() * 6.283,
            d = R * within(r, [0.3, 0.8]),
            at = [c[0] + Math.cos(aa) * d, c[1] - R * 0.35 - within(r, [2, 5]), c[2] + Math.sin(aa) * d];
          const tg = [Math.cos(aa + 1.57), 0, Math.sin(aa + 1.57)];
          card(m, DETAIL, at, tg, [0, 1, 0], within(r, [1.6, 2.4]), within(r, [3, 5.5]), [0, 0, 0.5, 1]);
        }
    }
  }
  return finish(m, { top: height, reach, stalk: r0 * 0.9 });
}

// ─── THE REEDS ────────────────────────────────────────────────────

function reedsMesh(variant, lod) {
  const r = grahtRng(landSeed('reeds', variant)),
    m = builder();
  const n = variant === 1 ? [7, 4, 3][lod] : variant === 2 ? [10, 6, 3][lod] : [16, 8, 4][lod];
  const tall = variant === 1 ? [2.8, 4.2] : variant === 2 ? [0.9, 1.5] : [1.8, 2.9];
  let top = 0,
    reach = 0;
  for (let k = 0; k < n; k++) {
    const a = r() * 6.283,
      d = within(r, [0, variant === 1 ? 0.9 : 1.3]),
      h = within(r, tall),
      lean = within(r, [0.05, 0.22]);
    const at = [Math.cos(a) * d, -0.2, Math.sin(a) * d],
      up = norm([Math.cos(a) * lean, 1, Math.sin(a) * lean]),
      tg = [-Math.sin(a), 0, Math.cos(a)];
    if (variant === 1) {
      // a cane: its stalk the body's, its leaves the detail's cards arching off it
      const tipAt = [at[0] + up[0] * h, at[1] + up[1] * h, at[2] + up[2] * h];
      tube(
        m,
        BODY,
        [
          at,
          [at[0] + up[0] * h * 0.33, at[1] + up[1] * h * 0.33, at[2] + up[2] * h * 0.33],
          [at[0] + up[0] * h * 0.66, at[1] + up[1] * h * 0.66, at[2] + up[2] * h * 0.66],
          tipAt,
        ],
        0.06,
        0.035,
        lod === 0 ? 4 : 3,
        1,
      );
      const leaves = [3, 2, 1][lod];
      for (let i = 0; i < leaves; i++) {
        const t = 0.45 + i * 0.18,
          ang = a + i * 2.1,
          base = [at[0] + up[0] * h * t, at[1] + up[1] * h * t, at[2] + up[2] * h * t];
        const out = norm([Math.cos(ang), 0.55, Math.sin(ang)]);
        card(m, DETAIL, base, [-Math.sin(ang), 0, Math.cos(ang)], out, 0.5, within(r, [1.1, 1.6]), [0.5, 0, 0.75, 1]);
      }
    } else {
      // a reed: a blade, its head on one in three (the reeds' picture's left half; a rush its lower part alone)
      card(
        m,
        DETAIL,
        at,
        tg,
        up,
        variant === 2 ? 0.3 : within(r, [0.28, 0.42]),
        h,
        variant === 2 ? [0.25, 0, 0.5, 0.6] : k % 3 === 0 ? [0, 0, 0.25, 1] : [0.25, 0, 0.5, 1],
      );
    }
    top = Math.max(top, h);
    reach = Math.max(reach, d + 0.5);
  }
  return finish(m, { top, reach, stalk: 0 });
}

// ─── THE VINES ────────────────────────────────────────────────────

/** A vineyard row's length along x, -VINE_SPAN/2 to +VINE_SPAN/2 (a tile: the sites lay one a tile). */
export const VINE_SPAN = 6.4;
function vinesMesh(variant, lod) {
  const r = grahtRng(landSeed('vines', variant)),
    m = builder(),
    L = VINE_SPAN / 2;
  // the posts at the row's ends (the next length's shares this one's: one each end), a wire between
  for (const x of lod === 2 ? [-L] : [-L, L]) {
    sweep(
      m,
      BODY,
      [
        { y: -0.4, r: 0.07, c: [x, 0] },
        { y: 1.85, r: 0.06, c: [x, 0] },
      ],
      lod === 0 ? 5 : 4,
      { uScale: 1, vScale: 2 },
    );
  }
  // the foliage: a hedge along the wire, its top and sides lumpy, from 0.45 m to about 1.8
  const seg = [8, 4, 2][lod],
    seed = (r() * 4294967296) >>> 0;
  const lump = (i, s) => 1 + 0.22 * blobJitter(seed + s, i);
  const sec = [];
  for (let i = 0; i <= seg; i++) {
    const x = -L + (2 * L * i) / seg,
      w = 0.48 * lump(i, 1),
      t = 1.55 + 0.28 * lump(i, 2);
    sec.push([
      [x, 0.42, -w * 0.7],
      [x, t * 0.62, -w],
      [x, t, -w * 0.45],
      [x, t, w * 0.45],
      [x, t * 0.62, w],
      [x, 0.42, w * 0.7],
    ]);
  }
  for (let i = 0; i < seg; i++) {
    for (let f = 0; f < 5; f++) {
      const a = sec[i][f],
        b = sec[i + 1][f],
        c = sec[i + 1][f + 1],
        d = sec[i][f + 1];
      const out = [0, f === 2 ? 1 : f < 2 ? 0.2 : 0.2, f < 2 ? -1 : f > 2 ? 1 : 0];
      m.quadOut(
        CROWN,
        a,
        b,
        c,
        d,
        [a[0] / 2, a[1] / 2 + f * 0.3],
        [b[0] / 2, b[1] / 2 + f * 0.3],
        [c[0] / 2, c[1] / 2 + f * 0.3],
        [d[0] / 2, d[1] / 2 + f * 0.3],
        out,
      );
    }
  }
  // the hanging leaves and grapes: cards along both sides (LOD 0)
  if (lod === 0)
    for (let i = 0; i < 6; i++)
      for (const side of [-1, 1]) {
        const x = -L + (i + 0.5) * ((2 * L) / 6) + (r() - 0.5) * 0.4;
        card(m, DETAIL, [x, 0.25, side * 0.55], [1, 0, 0], [0, 1, side * 0.15], 0.9, 1.0, [0, 0, 1, 1]);
      }
  return finish(m, { top: 2.0, reach: L * 1.05, stalk: 0 });
}

// ─── THE GROVE ────────────────────────────────────────────────────

function groveMesh(variant, lod) {
  const r = grahtRng(landSeed('grove', variant)),
    m = builder();
  const shape = [
    {
      trunk: [2.4, 3.4],
      height: [7.5, 9.5],
      r0: [0.32, 0.42],
      limbs: 5,
      spread: 3.6,
      rise: [0.55, 0.9],
      blob: [2.4, 3.2],
      squash: 0.82,
    }, // round: cherry
    {
      trunk: [2.4, 3.2],
      height: [10.5, 13.5],
      r0: [0.28, 0.36],
      limbs: 5,
      spread: 1.7,
      rise: [1.6, 2.6],
      blob: [1.8, 2.4],
      squash: 1.35,
    }, // tall: ginkgo, aspen
    {
      trunk: [2.2, 3.0],
      height: [7, 9],
      r0: [0.38, 0.5],
      limbs: 6,
      spread: 5.2,
      rise: [0.3, 0.55],
      blob: [2.6, 3.4],
      squash: 0.62,
    }, // spreading: maple
  ][variant];
  const tH = within(r, shape.trunk),
    r0 = within(r, shape.r0),
    sides = [8, 6, 4][lod];
  const lean = [lerp(-0.25, 0.25, r()), lerp(-0.25, 0.25, r())];
  m.part(0, 0, () =>
    sweep(
      m,
      BODY,
      [
        { y: -0.5, r: r0 * 1.25, c: [0, 0] },
        { y: 0.4, r: r0 * 1.1, c: [0, 0] },
        { y: tH, r: r0 * 0.82, c: lean },
      ],
      sides,
      { open: false, uScale: 1, vScale: 2, capS: BODY },
    ),
  );
  const nL = lod === 2 ? Math.max(3, shape.limbs - 2) : shape.limbs;
  let top = tH,
    reach = r0;
  for (let k = 0; k < nL; k++) {
    const a = (k / nL) * 6.283 + r() * 0.8,
      len = shape.spread * within(r, [0.75, 1.15]),
      rise = within(r, shape.rise) * len;
    const p0 = [lean[0], tH - 0.3, lean[1]],
      p3 = [p0[0] + Math.cos(a) * len, p0[1] + rise, p0[2] + Math.sin(a) * len];
    if (lod < 2)
      tube(
        m,
        BODY,
        [
          p0,
          [p0[0] + Math.cos(a) * len * 0.3, p0[1] + rise * 0.55, p0[2] + Math.sin(a) * len * 0.3],
          [p0[0] + Math.cos(a) * len * 0.7, p0[1] + rise * 0.9, p0[2] + Math.sin(a) * len * 0.7],
          p3,
        ],
        r0 * 0.55,
        r0 * 0.2,
        lod === 0 ? 5 : 3,
        lod === 0 ? 3 : 1,
      );
    const R = within(r, shape.blob),
      c = [p3[0], p3[1] + R * 0.35, p3[2]];
    blob(m, CROWN, c, R, shape.squash, 0.7, (r() * 4294967296) >>> 0, lod === 0 ? 1 : 0, 3);
    top = Math.max(top, c[1] + R * shape.squash * 1.16);
    reach = Math.max(reach, Math.hypot(c[0], c[2]) + R * 1.16);
    if (lod === 0)
      for (let j = 0; j < 3; j++) {
        const aa = r() * 6.283,
          el = lerp(-0.6, 0.5, r()),
          d = [Math.cos(aa) * Math.cos(el), Math.sin(el), Math.sin(aa) * Math.cos(el)];
        const at = [c[0] + d[0] * R * 0.85, c[1] + d[1] * R * shape.squash * 0.85, c[2] + d[2] * R * 0.85];
        card(
          m,
          DETAIL,
          at,
          norm([-Math.sin(aa), 0, Math.cos(aa)]),
          norm([d[0], d[1] + 0.4, d[2]]),
          within(r, [1.6, 2.4]),
          within(r, [1.3, 2.0]),
          [0, 0, 1, 1],
        );
      }
  }
  // the leader's own mass over the trunk
  const R = within(r, shape.blob) * 1.1,
    c = [lean[0], tH + shape.spread * within(r, shape.rise) * 0.9 + R * 0.4, lean[1]];
  blob(m, CROWN, c, R, shape.squash, 0.7, (r() * 4294967296) >>> 0, lod === 0 ? 1 : 0, 3);
  top = Math.max(top, c[1] + R * shape.squash * 1.16);
  return finish(m, { top, reach, stalk: r0 * 1.1 });
}

const MAKERS = Object.freeze({
  parasol: parasolMesh,
  spire: spireMesh,
  hist: histMesh,
  reeds: reedsMesh,
  vines: vinesMesh,
  grove: groveMesh,
});

/**
 * A KIND'S VARIANT AT A LOD - `{ positions, normals, uvs }` (f32, three vertices a face), `subs` ([first vertex, vertex
 * count] a submesh, LAND_SUBS' order), and its measures at scale 1: `top` (m over its foot), `reach` (its widest from its
 * foot's axis), `stalk` (the radius of its main stalk, column or trunk; 0 none), `foot` (its widest up to LAND_CHEST) and
 * `parts` (each solid one's axis { x, z }, its radius up to LAND_CHEST and its height: what a body walks into).
 * @param {string} kind @param {number} variant @param {number} lod
 */
export function landPropMesh(kind, variant, lod) {
  const make = /** @type {any} */ (MAKERS)[kind];
  if (!make) throw new Error(`landPropMesh: no kind ${kind}`);
  return make(variant, lod);
}
