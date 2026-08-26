// The four classic Daggerfall shields as actual shallow 3D pieces.
//
// Their final colour/detail does NOT live here: the viewer traces the user's
// TEXTURE.24x paperdoll record at runtime and wraps that classic art over these
// surfaces. This file owns only geometry/silhouette, keeping the ARENA2 pixels
// out of the repository exactly like the clothing/armour pipeline.
import templates from './itemTemplates.json' with { type: 'json' };
import { shadePiece, compress, STEEL_RAMP } from './pieces/pieceLoft.js';

export const SHIELDS = Object.freeze({
  Buckler: 109,
  Round_Shield: 110,
  Kite_Shield: 111,
  Tower_Shield: 112,
});

const byIndex = new Map(templates.map((t) => [t.index, t]));
export const SHIELD_CATALOG = Object.freeze(
  Object.values(SHIELDS).map((index) => Object.freeze({ ...byIndex.get(index), index })),
);

const ARM_X = 0.235;      // opposite arm from the weapon family
const CENTER_Y = 0.92;    // pre-HSCALE; follows the forearm/hand chain
const FRONT_Z = 0.135;

const regular = (n, rx, ry, phase = 0) => Array.from({ length: n }, (_, i) => {
  const a = phase + (i / n) * Math.PI * 2;
  return [Math.cos(a) * rx, Math.sin(a) * ry];
});

const OUTLINES = Object.freeze({
  [SHIELDS.Buckler]: regular(12, 0.135, 0.135, Math.PI / 12),
  [SHIELDS.Round_Shield]: regular(16, 0.205, 0.205, Math.PI / 16),
  [SHIELDS.Kite_Shield]: [
    [-0.190, 0.205], [-0.080, 0.250], [0.080, 0.250], [0.190, 0.205],
    [0.180, 0.055], [0.105, -0.175], [0.000, -0.330],
    [-0.105, -0.175], [-0.180, 0.055],
  ],
  [SHIELDS.Tower_Shield]: [
    [-0.205, 0.310], [-0.095, 0.345], [0.095, 0.345], [0.205, 0.310],
    [0.220, -0.245], [0.155, -0.345], [-0.155, -0.345], [-0.220, -0.245],
  ],
});

function quadNormal(p0, p1, p3) {
  const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
  const vx = p3[0]-p0[0], vy = p3[1]-p0[1], vz = p3[2]-p0[2];
  let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
  const L = Math.hypot(nx, ny, nz) || 1;
  return [nx/L, ny/L, nz/L];
}

function triFace(a, b, c, n, group) {
  return { p: [...a, ...b, ...c, ...c], n, g: group };
}

/**
 * Build one shield as a shallow extruded silhouette. The front/back are triangle
 * fans stored in the project's quad payload convention (fourth corner repeated),
 * while the rim gets true quads. A small rear boss gives the texture real depth
 * at oblique angles without pretending the source sprite supplied a side view.
 */
export function buildShield(ramp = STEEL_RAMP, templateIndex = SHIELDS.Round_Shield) {
  const outline = OUTLINES[templateIndex] || OUTLINES[SHIELDS.Round_Shield];
  const faces = [];
  const group = 'armR';
  const thick = templateIndex === SHIELDS.Tower_Shield ? 0.030 : 0.024;
  const zF = FRONT_Z, zB = FRONT_Z - thick;
  const front = outline.map(([x, y]) => [ARM_X + x, CENTER_Y + y, zF]);
  const back = outline.map(([x, y]) => [ARM_X + x, CENTER_Y + y, zB]);
  const cf = [ARM_X, CENTER_Y, zF], cb = [ARM_X, CENTER_Y, zB];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    faces.push(triFace(cf, front[i], front[j], [0, 0, 1], group));
    faces.push(triFace(cb, back[j], back[i], [0, 0, -1], group));
    const p0 = front[i], p1 = back[i], p2 = back[j], p3 = front[j];
    faces.push({ p: [...p0, ...p1, ...p2, ...p3], n: quadNormal(p0, p1, p3), g: group });
  }

  // Rear boss / forearm block. It is deliberately low-poly and fully covered by
  // the generated wrap; the original paperdoll alpha never owns 3D holes.
  const bossW = templateIndex === SHIELDS.Buckler ? 0.075 : 0.095;
  const bossH = templateIndex === SHIELDS.Tower_Shield ? 0.150 : 0.105;
  const x0 = ARM_X-bossW, x1 = ARM_X+bossW, y0 = CENTER_Y-bossH, y1 = CENTER_Y+bossH;
  const z0 = zB - 0.028, z1 = zB;
  const box = [
    [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[0,0,-1]],
    [[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[0,0,1]],
    [[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1],[-1,0,0]],
    [[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[1,0,0]],
    [[x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[0,-1,0]],
    [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0]],
  ];
  for (const q of box) faces.push({ p: [...q[0], ...q[1], ...q[2], ...q[3]], n: q[4], g: group });
  return compress(shadePiece(faces, ramp));
}
