// Vendored from project-final's Rewrite Engine (rewrite/core/geometry.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json
// (captured from rewrite/rig at vendor time). Do not hand-diverge:
// upstream first, then re-vendor + re-capture.
// Voxel mesh primitives. Each pushes faces ({p:4 corners, n, c}) to `out`.
import { sub, add, mul, cross, len, norm } from './math.js';

      function face(out, a, b, c, d, n, col) {
        // T1.3: vertices packed flat [ax,ay,az, bx,by,bz, cx,cy,cz, dx,dy,dz] (one array, not four
        // sub-arrays) for cache locality + fewer GC objects per face. n/c stay small arrays.
        out.push({ p: [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]], n, c: col });
      }
      // oriented box: centre + 3 orthonormal axes (U,V,W) + half-extents.
      function obox(out, c, U, V, W, hu, hv, hw, col) {
        const uU = mul(U, hu),
          vV = mul(V, hv),
          wW = mul(W, hw);
        const P = (su, sv, sw) => [
          c[0] + uU[0] * su + vV[0] * sv + wW[0] * sw,
          c[1] + uU[1] * su + vV[1] * sv + wW[1] * sw,
          c[2] + uU[2] * su + vV[2] * sv + wW[2] * sw,
        ];
        // +U / -U
        face(out, P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), U, col);
        face(out, P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), P(-1, -1, -1), mul(U, -1), col);
        // +V / -V
        face(out, P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), V, col);
        face(out, P(-1, -1, 1), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), mul(V, -1), col);
        // +W / -W
        face(out, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), W, col);
        face(out, P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), mul(W, -1), col);
      }
      // axis-aligned box from bounds
      function box(out, x0, x1, y0, y1, z0, z1, col) {
        obox(
          out,
          [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          (x1 - x0) / 2,
          (y1 - y0) / 2,
          (z1 - z0) / 2,
          col,
        );
      }
      // oriented segment p0->p1 with a w(across) x h(thick) cross-section.
      function seg(out, p0, p1, w, h, col, upHint) {
        const fwd = norm(sub(p1, p0));
        let up = upHint || [0, 1, 0];
        let right = cross(up, fwd);
        if (len(right) < 1e-4) right = cross([1, 0, 0], fwd);
        right = norm(right);
        up = norm(cross(fwd, right));
        const c = mul(add(p0, p1), 0.5);
        obox(out, c, right, up, fwd, w / 2, h / 2, len(sub(p1, p0)) / 2, col);
      }
      // tapered N-gon prism p0->p1 with elliptic cross-section in the U,V plane.
      // U,V are the (perpendicular) cross-section axes; radii may differ per end.
      // Side normals are radial-outward so the band shader gives a rounded gradient
      // across the width -- this is what reads as a volume (not a flat slab) at low res.
      function tprism(out, p0, p1, U, V, rU0, rV0, rU1, rV1, sides, col) {
        const ring = (c, rU, rV) => {
          const a = [];
          for (let k = 0; k < sides; k++) {
            const t = (k / sides) * 2 * Math.PI;
            a.push(add(add(c, mul(U, Math.cos(t) * rU)), mul(V, Math.sin(t) * rV)));
          }
          return a;
        };
        const A = ring(p0, rU0, rV0),
          B = ring(p1, rU1, rV1);
        for (let k = 0; k < sides; k++) {
          const k2 = (k + 1) % sides;
          const tm = ((k + 0.5) / sides) * 2 * Math.PI;
          const n = norm(add(mul(U, Math.cos(tm)), mul(V, Math.sin(tm))));
          face(out, A[k], A[k2], B[k2], B[k], n, col);
        }
      }
      // filled round disc (a fan of degenerate quads from the centre) - caps a round tube end, e.g. a scope lens.
      function disc(out, center, U, V, rU, rV, sides, col) {
        const ring = [];
        for (let k = 0; k < sides; k++) { const t = (k / sides) * 2 * Math.PI; ring.push(add(add(center, mul(U, Math.cos(t) * rU)), mul(V, Math.sin(t) * rV))); }
        const n = norm(cross(U, V));
        for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; face(out, center, ring[k], ring[k2], center, n, col); }
      }
      // rounded segment p0->p1: a tapered prism with a cross-section axis hint U.
      // U is re-orthogonalised against the segment direction, so callers can pass
      // a rough "width" axis and get a clean rounded bone/digit.
      function rseg(out, p0, p1, U, rU0, rV0, rU1, rV1, sides, col) {
        const d = norm(sub(p1, p0));
        const V = norm(cross(U, d));
        const u = norm(cross(d, V));
        tprism(out, p0, p1, u, V, rU0, rV0, rU1, rV1, sides, col);
      }

      // ── a gripping hand: palm + knuckle ridge + 4 curled fingers + thumb ──
      // wrist: world anchor.  fwd: toward the fingertips.  axis: the gripped
      // cylinder's axis (fingers line up along it).  wrapSign: which way they

      // Solid wedge ramp over the footprint [x0,x1]x[z0,z1]. The walking surface is a plane that rises
      // along one horizontal axis: axis 'x' goes yLo (at x0) -> yHi (at x1); axis 'z' goes yLo (at z0) ->
      // yHi (at z1). Pass yLo>yHi to rise the other way. Solid down to base = min(yLo,yHi). Backface cull
      // is off, so winding is irrelevant - only each face normal (for the band shade) matters. The surface
      // plane here MUST match surfaceY() in the collision code, so the ramp you see is the ramp you walk.
      function ramp(out, x0, x1, z0, z1, axis, yLo, yHi, col) {
        const base = Math.min(yLo, yHi);
        const topY = (cx, cz) => {
          const t = axis === 'x' ? (cx - x0) / (x1 - x0) : (cz - z0) / (z1 - z0);
          return yLo + (yHi - yLo) * t;
        };
        const fp = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; // footprint corners (xz)
        const T = fp.map(([cx, cz]) => [cx, topY(cx, cz), cz]); // top, on the plane
        const B = fp.map(([cx, cz]) => [cx, base, cz]); // base
        // incline top: normal forced up
        let nt = norm(cross(sub(T[1], T[0]), sub(T[3], T[0])));
        if (nt[1] < 0) nt = mul(nt, -1);
        face(out, T[0], T[1], T[2], T[3], nt, col);
        // base: straight down (usually buried; cheap + correct for elevated ramps)
        face(out, B[0], B[3], B[2], B[1], [0, -1, 0], col);
        // vertical sides, outward horizontal normals; skip the degenerate zero-height (flush) low edge
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          if (T[i][1] - base < 1e-6 && T[j][1] - base < 1e-6) continue;
          let nx = fp[j][1] - fp[i][1], nz = -(fp[j][0] - fp[i][0]); // perp to the edge in xz
          const mx = (fp[i][0] + fp[j][0]) / 2, mz = (fp[i][1] + fp[j][1]) / 2;
          if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; } // point away from centre
          face(out, T[i], T[j], B[j], B[i], norm([nx, 0, nz]), col);
        }
      }

export { box, obox, seg, tprism, disc, rseg, ramp };
