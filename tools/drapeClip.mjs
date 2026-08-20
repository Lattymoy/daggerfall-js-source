// Diagnostic: does a drape clear the body it hangs on, at every height?
//
// The fit is one uniform scale on X and Z. A body is not uniformly wide:
// it has shoulders, it has hips, and it has ARMS hanging outside the
// torso. A scale that clears the chest can still pass straight through
// a forearm.
import { drapedGrid, DRAPED_NAMES } from '../src/characters/pieces/draped.js';
import { buildNeutralBody } from '../src/characters/neutralBody.js';
import { UNDEAD_DESIGNS, undeadOpts } from '../src/characters/undeadBody.js';
import { CLASS_DESIGNS, classOpts } from '../src/characters/humanClasses.js';
import { DAEDRA_DESIGNS, daedraOpts } from '../src/characters/daedra.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

// Read the SHIPPED fit rather than recomputing it: this tool now checks
// what actually goes out, not what a second copy of the maths says.
import { buildPaperdollPayload } from '../src/characters/paperdollPayload.js';
const PAYLOAD = buildPaperdollPayload(null, null, null);
const SHIPPED = new Map();
for (const line of [PAYLOAD.undead, PAYLOAD.classes, PAYLOAD.daedra, PAYLOAD.beasts, PAYLOAD.villagers]) {
  for (const d of line || []) if (d.drape) SHIPPED.set(d.name, d.drape.fit);
}
function fit(d) {
  return SHIPPED.get(d.name) ?? 1;
}

/** The drape's own radius at each row. */
function drapeRows(name) {
  const g = drapedGrid(name);
  if (!g) return null;
  const rows = [];
  for (let r = 0; r < g.rows; r++) {
    let y = 0;
    let rx = 0;
    let rz = 0;
    for (let c = 0; c < g.cols; c++) {
      const i = (r * g.cols + c) * 3;
      y = g.pos[i + 1];
      rx = Math.max(rx, Math.abs(g.pos[i]));
      rz = Math.max(rz, Math.abs(g.pos[i + 2]));
    }
    rows.push({ y, rx, rz });
  }
  return rows;
}

/** How wide the body actually is in a band around a height, per group. */
function bodyAt(faces, y, band = 0.045) {
  const out = {};
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const py = f.p[i * 3 + 1];
      if (Math.abs(py - y) > band) continue;
      const g = f.g;
      const ax = Math.abs(f.p[i * 3]);
      const az = Math.abs(f.p[i * 3 + 2]);
      const e = (out[g] ||= { x: 0, z: 0 });
      if (ax > e.x) e.x = ax;
      if (az > e.z) e.z = az;
    }
  }
  return out;
}

const LINES = [
  [UNDEAD_DESIGNS, undeadOpts],
  [CLASS_DESIGNS, classOpts],
  [DAEDRA_DESIGNS, daedraOpts],
];

let worst = [];
for (const [designs, opts] of LINES) {
  for (const d of designs) {
    if (!d.drape) continue;
    const { ramps, opts: o } = opts(d, pal);
    const faces = buildNeutralBody(ramps, o);
    const rows = drapeRows(d.drape.name);
    if (!rows) continue;
    const k = fit(d);
    for (const r of rows) {
      const body = bodyAt(faces, r.y);
      for (const [group, e] of Object.entries(body)) {
        // The drape is an ellipse of rx*k by rz*k. A body point at (x,z)
        // is INSIDE it when (x/rx)^2 + (z/rz)^2 < 1.
        const nx = e.x / (r.rx * k);
        const nz = e.z / (r.rz * k);
        const outside = Math.hypot(nx, nz);
        if (outside > 1) {
          worst.push({ who: d.name, garment: d.drape.name, group, y: r.y, by: outside });
        }
      }
    }
  }
}

worst.sort((a, b) => b.by - a.by);
console.log(`clipping rows found: ${worst.length}`);
const seen = new Set();
for (const w of worst) {
  const key = w.who + w.group;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(
    `  ${w.who.padEnd(17)} ${w.garment.padEnd(14)} ${w.group.padEnd(5)} at y ${w.y.toFixed(2)} — body is ${((w.by - 1) * 100).toFixed(0)}% outside the cloth`,
  );
  if (seen.size >= 12) break;
}
