// Vendored from project-final's Rewrite Engine (rewrite/core/math.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json
// (captured from rewrite/rig at vendor time). Do not hand-diverge:
// upstream first, then re-vendor + re-capture.
// Shared engine math: vector helpers + rotation/transform builders.
// Coordinate convention everywhere: x=right, y=up, z=forward (into screen).

      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
      const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
      const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const len = (a) => Math.hypot(a[0], a[1], a[2]);
      const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      // rotate vector v about a (unit-ish) axis by angle ang (Rodrigues)
      const rotAxis = (v, axis, ang) => {
        const c = Math.cos(ang),
          s = Math.sin(ang);
        const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
        const k = [axis[0] / l, axis[1] / l, axis[2] / l];
        return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
      };
      const norm = (a) => {
        const l = len(a) || 1;
        return [a[0] / l, a[1] / l, a[2] / l];
      };


      function rotEuler(yaw, pitch, roll) {
        const cy = Math.cos(yaw),
          sy = Math.sin(yaw),
          cp = Math.cos(pitch),
          sp = Math.sin(pitch),
          cr = Math.cos(roll),
          sr = Math.sin(roll);
        // roll(z) -> pitch(x) -> yaw(y)
        return (v) => {
          let x = v[0] * cr - v[1] * sr,
            y = v[0] * sr + v[1] * cr,
            z = v[2];
          let y2 = y * cp - z * sp,
            z2 = y * sp + z * cp;
          let x3 = x * cy + z2 * sy,
            z3 = -x * sy + z2 * cy;
          return [x3, y2, z3];
        };
      }
      function xformFaces(faces, R, T) {
        return faces.map((f) => {
          const fp = f.p, np = fp.length / 3, p = new Array(np * 3); // p packed: 3 floats/vertex
          for (let k = 0; k < np; k++) { const i = k * 3, v = add(R([fp[i], fp[i + 1], fp[i + 2]]), T); p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; }
          return { p, n: R(f.n), c: f.c };
        });
      }
      // map a per-vertex fn([x,y,z])->[x,y,z] over a packed vertex array (3 floats/vertex) -> new packed array.
      function mapVerts(p, fn) {
        const np = p.length / 3, out = new Array(p.length);
        for (let k = 0; k < np; k++) { const i = k * 3, v = fn([p[i], p[i + 1], p[i + 2]]); out[i] = v[0]; out[i + 1] = v[1]; out[i + 2] = v[2]; }
        return out;
      }

      const rotY = (a) => {
        const c = Math.cos(a), s = Math.sin(a);
        return (p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
      };
      function rotX(v, a) {
        const c = Math.cos(a), s = Math.sin(a);
        return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
      }

export { sub, add, mul, mad, dot, cross, len, mix, rotAxis, norm, rotEuler, xformFaces, mapVerts, rotY, rotX };
