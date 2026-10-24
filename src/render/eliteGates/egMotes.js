// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 5):
// THE AIR - the Spire's air made visible, a band at a time, as the Hour's is (render/superDungeon/sdMotes.js, SD14c):
//   THE MOTES - SD14c's motion law made a generator of a layout and its colours: each band's kinds of mote (EG_MOTE_KINDS -
//     how each moves; world/eliteGates/egAtmos.js `motes` - how many, in what colours): the Galleries' embers rising off the fire-sea
//     and ash drifting down, the Cairn's soul-motes rising slow and breathing, the Shade's moon-dust falling silver and
//     glinting, the Wellhead's sparks rising thick and its heavy ash. 600-1,000 points, ONE draw, added onto the frame,
//     depth-tested and never written, fogged as the world is, in the band's own colours under L2 but for the embers' and
//     the sparks' hottest (L3, small). Every mote is a pure function of its seeded draws and the clock (its lives whole
//     over EG_SKY_PERIOD, its wind whole cells over it), laid in one field anchored at the hall the eye stands in and
//     wrapped about the eye in the hall's plane (EG_MOTE_CELL) - every screen sees the same air in the same place, and the
//     air is as thick wherever the eye stands in a hall 150 m long. THE TELEGRAPHS KEEP THEIR FLOOR (Elite-Gates.md
//     section 25.6): a mote fades out within EG_MOTE_FLOOR.clear of any floor's top over its footprint - the eye's hall's
//     floors handed to the shader (egMoteFloors) - and out of a passage whole. Reduced motion holds the clock (the
//     host's), so the air stands still - the Hour's precedent (render/nodeGlow.js: "every moving part held at its seed's
//     own place"). THE QUIET COMPANY (section 25.4) never touches it: it is the place, not a player's.
//   THE HALOS - the classic set's bloom (render/superDungeon/sdHalo.js, reused): every lamp's fixture (world/eliteGates/egHall.js egCircleLights -
//     the lamps where they stand) and the foot of every beam of the way (the door's, the Redoubt's beacon - world/
//     egLights.js), the nearest EG_HALO.max a frame.
//   THE CAIRN'S MIST SHEETS - the band's mist under every rim, below the cornice's foot (render/eliteGates/egMistPass.js's sheet, held
//     still - never a surge), round under a disc and square under a band, never over any floor of the hall (egRimMists).
// Nothing a frame allocates: the floors, the halos and the sheets are written into kept arrays.
//
// A foreign pass (the motes): it owns its program, its buffer and its state; the host marks it. Not a DFU member.
// Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { EG_SKY_PERIOD } from './egSkyMap.js';
import { egAtmosOf } from '../../world/eliteGates/egAtmos.js';
import { egToDungeon, egIsleDisc } from '../../world/eliteGates/egHall.js';
import { EG_LIGHT_KIND } from '../../world/eliteGates/egLights.js';

/** THE KINDS OF MOTE and how each moves - its id (the layout's), up (+1) or down, the heights it lives between in the
 *  hall's frame (m), its lives a period (whole - drawn between), its size (m), its sway (m) and how many sways a life,
 *  its wind (whole cells a period), whether it is hot (cooling as it rises: its hottest is L3), whether it glows (a disc
 *  of light) or is a flake, whether it breathes or glints. */
export const EG_MOTE_KINDS = Object.freeze({
  ember: Object.freeze({ id: 0, rise: 1, y: Object.freeze([-20, 20]), turns: Object.freeze([36, 60]), size: Object.freeze([0.1, 0.16]), sway: 0.9, flutter: 2, wind: 1, hot: 1, glow: 1, breathe: 0, glint: 0 }),
  ash: Object.freeze({ id: 1, rise: -1, y: Object.freeze([-18, 22]), turns: Object.freeze([16, 28]), size: Object.freeze([0.14, 0.24]), sway: 1.6, flutter: 5, wind: 1, hot: 0, glow: 0, breathe: 0, glint: 0 }),
  soul: Object.freeze({ id: 2, rise: 1, y: Object.freeze([-16, 20]), turns: Object.freeze([10, 18]), size: Object.freeze([0.14, 0.24]), sway: 1.4, flutter: 1.5, wind: 0, hot: 0, glow: 1, breathe: 1, glint: 0 }),
  dust: Object.freeze({ id: 3, rise: -1, y: Object.freeze([-16, 22]), turns: Object.freeze([12, 20]), size: Object.freeze([0.08, 0.14]), sway: 0.7, flutter: 2, wind: 1, hot: 0, glow: 1, breathe: 0, glint: 1 }),
  spark: Object.freeze({ id: 4, rise: 1, y: Object.freeze([-20, 20]), turns: Object.freeze([70, 120]), size: Object.freeze([0.08, 0.13]), sway: 1.2, flutter: 4, wind: 2, hot: 1, glow: 1, breathe: 0, glint: 0 }),
  cinder: Object.freeze({ id: 5, rise: -1, y: Object.freeze([-18, 22]), turns: Object.freeze([28, 46]), size: Object.freeze([0.18, 0.3]), sway: 1.1, flutter: 4, wind: 2, hot: 0, glow: 0, breathe: 0, glint: 0 }),
});
const KINDS = Object.values(EG_MOTE_KINDS).sort((a, b) => a.id - b.id);
const KIND_NAMES = Object.keys(EG_MOTE_KINDS).sort((a, b) => EG_MOTE_KINDS[a].id - EG_MOTE_KINDS[b].id);
/** The kind each id is and the band's colours for it (each kind is one band's): `{ band, lo, hi }` by id. */
export const EG_MOTE_COLOURS = Object.freeze(KIND_NAMES.map((name) => {
  for (let b = 0; b < 4; b++) { const m = egAtmosOf(b).motes.find((q) => q.kind === name); if (m) return Object.freeze({ band: b, lo: m.lo, hi: m.hi }); }
  throw new Error(`[eg] the mote kind ${name} is no band's`);
}));
/** The field's cell (m): the motes tile the hall's plane with it, and the eye stands in the middle of the one it sees. */
export const EG_MOTE_CELL = 48;
/** THE TELEGRAPHS KEEP THEIR FLOOR: within `clear` m over a floor's top (and `under` m below it), over its footprint and
 *  `margin` m past it, a mote is gone, coming back over `ease` m more; a passage's floor clears its whole height and a
 *  metre. At most `max` floors a hall. */
export const EG_MOTE_FLOOR = Object.freeze({ clear: 3, ease: 1.5, under: 1, margin: 1, max: 40 });
/** The least a mote is drawn across (px) - smaller, it is faded by how much (render/superDungeon/sdMotes.js's law) - the most, and
 *  the most drawn as one solid dot (a glow's rings need room). */
export const EG_MOTE_PX = Object.freeze({ min: 2, max: 24, solid: 3 });
/** The phones' tier: this share of each kind. */
export const EG_MOTE_LITE = 0.5;

/** A band's motes: how many in all (the lite tier's share with `lite`). */
export const egMoteCount = (band, lite = false) => egAtmosOf(band).motes.reduce((n, m) => n + (lite ? Math.round(m.n * EG_MOTE_LITE) : m.n), 0);
/** THE LAYOUT: one vertex a mote - its kind's id and three draws in [0, 1) - band `band`'s kinds in its counts. Seeded,
 *  pure: the same band, the same air on every screen. */
export function egMoteLayout(band, lite = false, seed = 0xe61007) {
  let x = (seed ^ (band * 0x9e3779b1)) >>> 0;
  const r = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const out = new Float32Array(egMoteCount(band, lite) * 4);
  let o = 0;
  for (const m of egAtmosOf(band).motes) {
    const n = lite ? Math.round(m.n * EG_MOTE_LITE) : m.n, id = EG_MOTE_KINDS[m.kind].id;
    for (let i = 0; i < n; i++) { out[o++] = id; out[o++] = r(); out[o++] = r(); out[o++] = r(); }
  }
  return out;
}

const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v4 = (a) => `vec4(${a.map(f).join(', ')})`;
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;
const arr = (type, name, rows) => `const ${type} ${name}[${rows.length}] = ${type}[${rows.length}](${rows.join(', ')});`;
const F = EG_MOTE_FLOOR;

/** THE LAW, the vertex shader's: `moteAt(seed, T, size, alpha, heat)` - where mote (kind, a, b, c) stands at the clock's
 *  T in the field (its anchor's frame), its size, its alpha over its life and its warmth; `floorFade(p)` - what the
 *  hall's floors leave of a mote at p (the scene's frame). The tests run this very text (test/glsl.mjs). */
export const EG_MOTE_LAW_GLSL = `const float PERIOD = ${EG_SKY_PERIOD.toFixed(1)};
const float TAU = 6.283185307179586;
const float CELL = ${EG_MOTE_CELL.toFixed(1)};
${arr('vec4', 'KA', KINDS.map((k) => v4([k.rise, k.y[0], k.y[1], k.sway])))}   // up or down, its heights, its sway
${arr('vec4', 'KB', KINDS.map((k) => v4([k.turns[0], k.turns[1], k.size[0], k.size[1]])))}   // its lives a period, its size
${arr('vec4', 'KC', KINDS.map((k) => v4([k.flutter, k.wind, k.hot, k.breathe])))}   // its sways a life, its wind, hot, breathing
${arr('float', 'KD', KINDS.map((k) => f(k.glint)))}   // glinting
uniform vec4 uFloor[${F.max * 2}];   // the eye's hall's floors, two a floor (egMoteFloors)
uniform int uFloors;
vec3 moteAt(vec4 s, float T, out float size, out float alpha, out float heat) {
  int k = int(s.x + 0.5);
  vec4 A = KA[k], B = KB[k], C = KC[k];
  float a = s.y, b = s.z, c = s.w;
  float n = floor(B.x + a * (B.y - B.x + 1.0));          // whole lives a period
  float lives = T * n / PERIOD + b;
  float u = fract(lives), life = mod(floor(lives), n);   // where it is in this life, and which life (each its own place)
  float px = fract(c * 7.31 + life * 0.618034 + a * 1.37), pz = fract(a * 3.97 + life * 0.414214 + c * 5.13);
  float y = A.x > 0.0 ? mix(A.y, A.z, u) : mix(A.z, A.y, u);
  float ph = u * TAU * C.x;
  size = mix(B.z, B.w, c);
  alpha = min(1.0, u * 8.0) * (C.z > 0.5 ? 1.0 - u : min(1.0, (1.0 - u) * 6.0));
  heat = C.z > 0.5 ? 1.0 - u * u : 0.5;   // a hot one holds its heat through its first half, cooling as it climbs
  if (C.w > 0.5) { float br = 0.5 + 0.5 * sin(TAU * 24.0 * T / PERIOD + c * TAU); alpha *= 0.55 + 0.45 * br; heat = br; }
  if (KD[k] > 0.5) { float g = max(sin(TAU * 90.0 * T / PERIOD + b * 41.0), 0.0); g *= g; g *= g; alpha *= 0.35 + 0.65 * g; heat = g; }
  return vec3(px * CELL + sin(ph + c * TAU) * A.w + C.y * CELL * T / PERIOD, y, pz * CELL + cos(ph * 0.83 + a * TAU) * A.w * 0.8);
}
// how far p stands outside floor i's footprint in plan (0 or less: over it), and its top, its lowest top, its clearance
float floorFade(vec3 p) {
  float k = 1.0;
  for (int i = 0; i < ${F.max}; i++) {
    if (i >= uFloors) break;
    vec4 f0 = uFloor[2 * i], f1 = uFloor[2 * i + 1];
    float low = f0.x < 0.5 ? f1.x : f0.x < 1.5 ? f1.y : f1.z;
    float dy = p.y - f1.z;
    if (p.y < low - ${f(F.under)} || dy > f1.w + ${f(F.ease)}) continue;
    float d;
    if (f0.x < 0.5) d = length(p.xz - f0.yz) - f0.w;
    else if (f0.x < 1.5) { vec2 q = max(f0.yz - p.xz, p.xz - vec2(f0.w, f1.x)); d = max(q.x, q.y); }
    else { vec2 pa = p.xz - f0.yz, ba = vec2(f0.w, f1.x) - f0.yz; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); d = length(pa - ba * t) - f1.y; }
    if (d > ${f(F.margin)}) continue;
    k = min(k, smoothstep(f1.w, f1.w + ${f(F.ease)}, dy));
  }
  return k;
}
`;

export const EG_MOTES_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeed;   // kind, three draws in [0, 1)
uniform mat4 uVP;
uniform vec3 uEye;         // the eye (the scene's frame): the field is wrapped about it
uniform vec3 uAnchor;      // the hall the eye stands in - its origin (the scene's frame): the field's
uniform float uTime;       // the air's clock, wrapped at the period (held under reduced motion)
uniform float uPxPerM;     // pixels a metre at one metre off
out float vHeat;
out float vAlpha;
out float vKind;
out float vPx;
out vec3 vWorld;
${EG_MOTE_LAW_GLSL}
// THE FIELD about the eye: the mote's place in the anchor's field, the cell it stands in round the eye's, faded at the
// cell's edge (where it wraps) and over the floors
vec3 moteWorld(vec4 s, float T, out float size, out float alpha, out float heat) {
  vec3 w = uAnchor + moteAt(s, T, size, alpha, heat);
  vec2 rel = w.xz - uEye.xz;
  rel -= CELL * floor(rel / CELL + 0.5);
  w.xz = uEye.xz + rel;
  alpha *= 1.0 - smoothstep(0.72, 0.98, max(abs(rel.x), abs(rel.y)) / (CELL * 0.5));
  alpha *= floorFade(w);
  return w;
}
void main() {
  float size, alpha, heat;
  vec3 w = moteWorld(aSeed, uTime, size, alpha, heat);
  vKind = aSeed.x; vHeat = heat; vWorld = w;
  vec4 cp = uVP * vec4(w, 1.0);
  float px = size * uPxPerM / max(cp.w, 0.1);
  vPx = clamp(px, ${f(EG_MOTE_PX.min)}, ${f(EG_MOTE_PX.max)});
  gl_PointSize = vPx;
  vAlpha = alpha * clamp(px / ${f(EG_MOTE_PX.min)}, 0.0, 1.0);
  gl_Position = vAlpha > 0.002 ? cp : vec4(2.0, 2.0, 2.0, 1.0);   // a mote with nothing left is no fragment
}`;
export const EG_MOTES_FS = `#version 300 es
precision highp float;
in float vHeat;
in float vAlpha;
in float vKind;
in float vPx;
in vec3 vWorld;
uniform float uGain;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
${arr('vec3', 'LO', EG_MOTE_COLOURS.map((c) => v3([...c.lo])))}
${arr('vec3', 'HI', EG_MOTE_COLOURS.map((c) => v3([...c.hi])))}
${arr('float', 'GLOW', KINDS.map((k) => f(k.glow)))}
// a mote's light over its point, at most 1 - a glow's core, body and rim in three steps, a flake's square, and a mote
// drawn ${EG_MOTE_PX.solid} px or less one solid dot: the pixel law
float moteShape(vec2 q, float glow, float px) {
  if (px <= ${f(EG_MOTE_PX.solid)}) return glow < 0.5 ? 0.8 : 1.0;
  if (glow < 0.5) return max(abs(q.x), abs(q.y)) < 0.62 ? 0.8 : 0.0;
  float d = dot(q, q);
  return d < 0.2 ? 1.0 : d < 0.55 ? 0.5 : d < 1.0 ? 0.2 : 0.0;
}
void main() {
  int k = int(vKind + 0.5);
  float s = moteShape(gl_PointCoord * 2.0 - 1.0, GLOW[k], vPx);
  if (s <= 0.0 || vAlpha <= 0.002) discard;
  o = vec4(mix(LO[k], HI[k], vHeat) * s * vAlpha * fogFactorAt(vWorld) * uGain, 1.0);
}`;

/**
 * THE EYE'S HALL'S FLOORS for the motes (`spec` the hall), into `out` (EG_MOTE_FLOOR.max floors, eight floats each, the
 * scene's frame): every disc (its centre, radius, top), every band and ramp (its box, top - a ramp's its higher end, low
 * its lower), every lane (its line, half-width, top), each road's run of pieces as one box (its highest piece's top, its
 * lowest's low, their whole travel) and each passage (its box, clearing its height). Answers how many.
 * @param {any} spec @param {Float32Array} out
 */
export function egMoteFloors(spec, out) {
  let n = 0;
  const room = Math.min(F.max, Math.floor(out.length / 8));
  const put = (k, a, b, c, d, e, top, clear) => { if (n >= room) return; const o = n * 8; out[o] = k; out[o + 1] = a; out[o + 2] = b; out[o + 3] = c; out[o + 4] = d; out[o + 5] = e; out[o + 6] = top; out[o + 7] = clear; n++; };
  const P = (x, y, z) => egToDungeon(spec, x, y, z);
  const rect = (x0, z0, x1, z1, top, low, clear = F.clear) => { const a = P(x0, top, z0), b = P(x1, top, z1); put(1, Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), P(0, low, 0)[1], a[1], clear); };
  for (const d of spec.discs ?? []) { const c = P(d.x, d.y ?? 0, d.z); put(0, c[0], c[2], d.r, c[1], 0, c[1], F.clear); }
  for (const b of spec.bands ?? []) {
    const cave = b.role === 'cave' ? (spec.caves ?? []).find((q) => Math.abs(q.x - b.x) < 0.01 && b.z0 >= q.z0 - 0.01 && b.z1 <= q.z1 + 0.01) : null;
    rect(b.x - b.halfW, Math.min(b.z0, b.z1), b.x + b.halfW, Math.max(b.z0, b.z1), (b.y ?? 0) + 0.124, b.y ?? 0, cave ? cave.height + 1 : F.clear);
  }
  for (const q of spec.caves ?? []) rect(q.x - q.halfW, q.z0, q.x + q.halfW, q.z1, Math.max(q.y ?? 0, q.yB ?? q.y ?? 0), Math.min(q.y ?? 0, q.yB ?? q.y ?? 0), q.height + 1);
  for (const q of spec.ramps ?? []) {
    const pad = q.hw ?? 1;
    rect(Math.min(q.ax, q.bx) - pad, Math.min(q.az, q.bz) - pad, Math.max(q.ax, q.bx) + pad, Math.max(q.az, q.bz) + pad, Math.max(q.y0, q.y1), Math.min(q.y0, q.y1));
  }
  for (const l of spec.lanes ?? []) { const a = P(l.ax, l.y ?? 0, l.az), b = P(l.bx, l.y ?? 0, l.bz); put(2, a[0], a[2], b[0], b[2], l.hw, a[1], F.clear); }
  for (const road of [0, 1]) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, top = -Infinity, low = Infinity;
    for (const s of spec.steps ?? []) {
      if ((s.road ?? 0) !== road) continue;
      const reach = (s.amp ?? 0) + Math.max(s.w ?? 0, s.d ?? 0) / 2;
      x0 = Math.min(x0, s.x - reach); x1 = Math.max(x1, s.x + reach); z0 = Math.min(z0, s.z - reach); z1 = Math.max(z1, s.z + reach);
      top = Math.max(top, s.y ?? 0); low = Math.min(low, s.y ?? 0);
    }
    if (top > -Infinity) rect(x0, z0, x1, z1, top, low);
  }
  return n;
}
/** Is a point at `p` (the scene's frame) within the floors' clearance - the law floorFade keeps (JS, for the tests and
 *  the lab): the share of a mote's light left there (0 within `clear` over a floor, 1 clear of every one). */
export function egMoteFloorKeep(floors, n, p) {
  let k = 1;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    const o = i * 8, kind = floors[o], top = floors[o + 6], clear = floors[o + 7];
    const low = kind < 0.5 ? floors[o + 4] : kind < 1.5 ? floors[o + 5] : top, dy = p[1] - top;
    if (p[1] < low - F.under || dy > clear + F.ease) continue;
    let d;
    if (kind < 0.5) d = Math.hypot(p[0] - floors[o + 1], p[2] - floors[o + 2]) - floors[o + 3];
    else if (kind < 1.5) d = Math.max(floors[o + 1] - p[0], p[0] - floors[o + 3], floors[o + 2] - p[2], p[2] - floors[o + 4]);
    else { const ax = floors[o + 1], az = floors[o + 2], bx = floors[o + 3], bz = floors[o + 4], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[2] - az) * dz) / (dx * dx + dz * dz || 1))); d = Math.hypot(p[0] - ax - dx * t, p[2] - az - dz * t) - floors[o + 5]; }
    if (d > F.margin) continue;
    k = Math.min(k, sm(clear, clear + F.ease, dy));
  }
  return k;
}

// ── THE HALOS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** THE HALOS (render/superDungeon/sdHalo.js - the classic set's bloom): at most `max` a frame; a lamp's fixture's (`lamp`: its size in
 *  metres and its share of the lamp's colour) and a beam of the way's foot (`beam`: its size, its share of the beam's
 *  colour, how far over the floor it stands); none past `far` metres from the eye (the fog has them). */
export const EG_HALO = Object.freeze({ max: 48, far: 120, lamp: Object.freeze({ size: 0.6, k: 0.5 }), beam: Object.freeze({ size: 1.8, k: 0.7, up: 0.3 }) });
/**
 * THE HALOS THIS FRAME into `out` (a kept array-like of kept halos - render/superDungeon/sdHalo.js's `{ at, size, color }`, its
 * `length` the count): every beam's foot in `lights` (world/eliteGates/egLights.js egSpireLights - the way's gold), then the lamps of
 * `lamps` (world/eliteGates/egHall.js egCircleLights's shape) nearest `eye`, at most EG_HALO.max and none past EG_HALO.far. `order`
 * a kept index list at least as long as `lamps`, the lamps sorted in it. Answers `out`. Nothing is made but the first
 * frame's slots.
 * @param {any} out @param {any[]} lamps @param {any[]|null} lights @param {ArrayLike<number>} eye @param {Int32Array} order
 */
export function egHalosInto(out, lamps, lights, eye, order) {
  const H = EG_HALO, far2 = H.far * H.far;
  let n = 0;
  for (const L of lights ?? NO_LIGHTS) {
    if (n >= H.max) break;
    if (L.k !== EG_LIGHT_KIND.beam || !(L.h > 0)) continue;
    const h = haloSlot(out, n), a = L.a ?? 1;
    h.at[0] = L.x; h.at[1] = L.y + H.beam.up; h.at[2] = L.z; h.size = H.beam.size * Math.min(1.6, L.w / 1.4 || 1);
    h.color[0] = L.c[0] * H.beam.k * a; h.color[1] = L.c[1] * H.beam.k * a; h.color[2] = L.c[2] * H.beam.k * a;
    n++;
  }
  // the lamps nearest first (an insertion sort into the kept order - a circle's lamps are a few dozen)
  let m = 0;
  for (let i = 0; i < lamps.length && m < order.length; i++) {
    const d = dist2(lamps[i], eye);
    if (d > far2) continue;
    let j = m++;
    while (j > 0 && dist2(lamps[order[j - 1]], eye) > d) { order[j] = order[j - 1]; j--; }
    order[j] = i;
  }
  for (let q = 0; q < m && n < H.max; q++) {
    const L = lamps[order[q]], h = haloSlot(out, n);
    h.at[0] = L.x; h.at[1] = L.y; h.at[2] = L.z; h.size = H.lamp.size;
    h.color[0] = L.color[0] * H.lamp.k; h.color[1] = L.color[1] * H.lamp.k; h.color[2] = L.color[2] * H.lamp.k;
    n++;
  }
  out.length = n;
  return out;
}
const NO_LIGHTS = Object.freeze([]);
/** Halo `n`'s kept slot in `out` (made the first time it is asked). */
const haloSlot = (out, n) => (out[n] ??= { at: new Float32Array(3), size: 0, color: new Float32Array(3) });
/** A lamp's squared distance from the eye. */
const dist2 = (L, eye) => (L.x - eye[0]) * (L.x - eye[0]) + (L.y - eye[1]) * (L.y - eye[1]) + (L.z - eye[2]) * (L.z - eye[2]);

// ── THE CAIRN'S MIST SHEETS ───────────────────────────────────────────────────────────────────────────────────────────
/** THE CAIRN'S MIST under the rims: the bands that wear it, how far under a rim a sheet lies (below the cornice's foot -
 *  world/eliteGates/egRuin.js), how far past the rim it runs (m), the least disc that has one, its colour (linear - the Cairn's
 *  mist's pale violet), how thick, and at most how many a hall (render/eliteGates/egMistPass.js EG_MIST_MAX). */
export const EG_RIM_MIST = Object.freeze({ bands: Object.freeze([1]), below: 2.4, pad: 6, minR: 3, color: Object.freeze([0.36, 0.33, 0.46]), alpha: 0.55, max: 8 });
/**
 * THE CAIRN'S MIST SHEETS for hall `spec` (in band `band`) into `out` (a kept list of kept sheets - render/eliteGates/egMistPass.js's
 * `{ rect, y, alpha, round }`, the scene's frame): one under each disc of at least EG_RIM_MIST.minR (round), then each
 * open band (square - never a passage's), the largest first, at most EG_RIM_MIST.max. Each lies EG_RIM_MIST.below under
 * the lowest top of every floor its footprint meets - never over a floor of the hall. None outside the bands that wear
 * it. Answers `out`, its length the count.
 * @param {any} spec @param {number} band @param {any[]} out
 */
export function egRimMists(spec, band, out) {
  const M = EG_RIM_MIST;
  let n = 0;
  if (!spec || !M.bands.includes(band)) { out.length = 0; return out; }
  // every floor's footprint in the hall's frame (a box) and its top
  const floors = [];
  for (const d of spec.discs ?? []) floors.push([d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, d.y ?? 0]);
  for (const b of spec.bands ?? []) floors.push([b.x - b.halfW, Math.min(b.z0, b.z1), b.x + b.halfW, Math.max(b.z0, b.z1), b.y ?? 0]);
  for (const l of spec.lanes ?? []) floors.push([Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw, l.y ?? 0]);
  for (const q of spec.ramps ?? []) floors.push([Math.min(q.ax, q.bx) - q.hw, Math.min(q.az, q.bz) - q.hw, Math.max(q.ax, q.bx) + q.hw, Math.max(q.az, q.bz) + q.hw, Math.min(q.y0, q.y1)]);
  for (const s of spec.steps ?? []) { const r = (s.amp ?? 0) + Math.max(s.w ?? 0, s.d ?? 0) / 2; floors.push([s.x - r, s.z - r, s.x + r, s.z + r, s.y ?? 0]); }
  const lowUnder = (x0, z0, x1, z1) => { let y = Infinity; for (const g of floors) if (g[0] < x1 && g[2] > x0 && g[1] < z1 && g[3] > z0) y = Math.min(y, g[4]); return y; };
  const cands = [];
  for (const d of spec.discs ?? []) if (d.r >= M.minR && !egIsleDisc(spec, d)) cands.push({ area: d.r * d.r * Math.PI, x0: d.x - d.r - M.pad, z0: d.z - d.r - M.pad, x1: d.x + d.r + M.pad, z1: d.z + d.r + M.pad, round: true });
  for (const b of spec.bands ?? []) if (b.role !== 'cave') cands.push({ area: 2 * b.halfW * Math.abs(b.z1 - b.z0), x0: b.x - b.halfW - M.pad, z0: Math.min(b.z0, b.z1) - M.pad, x1: b.x + b.halfW + M.pad, z1: Math.max(b.z0, b.z1) + M.pad, round: false });
  cands.sort((a, b) => b.area - a.area);
  for (const c of cands) {
    if (n >= M.max) break;
    const y = lowUnder(c.x0, c.z0, c.x1, c.z1);
    if (!Number.isFinite(y)) continue;
    const a = egToDungeon(spec, c.x0, y - M.below, c.z0), b = egToDungeon(spec, c.x1, y - M.below, c.z1);
    const s = (out[n] ??= { rect: [0, 0, 0, 0], y: 0, alpha: 0, round: false });
    s.rect[0] = Math.min(a[0], b[0]); s.rect[1] = Math.min(a[2], b[2]); s.rect[2] = Math.max(a[0], b[0]); s.rect[3] = Math.max(a[2], b[2]);
    s.y = a[1]; s.alpha = M.alpha; s.round = c.round;
    n++;
  }
  out.length = n;
  return out;
}

// ── THE PASS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function mul4(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}
const NO_RANGE = new Float32Array([0, 1]), NO_CAM = new Float32Array(3);

/** FIRST-USE (#1144): the pass's one program, as its constructor builds it - what the hall's load starts and the
 *  look's door waits on (render/glProgram.js startPrograms, compiledPass). */
export const EG_MOTES_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[EG_MOTES_VS, EG_MOTES_FS]]));

/** THE MOTES, one foreign pass: a band's layout in its buffer (made again only for another band), the eye's hall's floors
 *  and anchor handed when the eye's hall changes, one draw a frame. */
export class EgMotesPass {
  /** @param {WebGL2RenderingContext} gl @param {{ lite?: boolean }} [o] */
  constructor(gl, { lite = false } = {}) {
    this.gl = gl;
    this.lite = !!lite;
    const [[vs, fs]] = EG_MOTES_PROGRAMS;
    this.prog = buildProgram(gl, vs, fs, 'eg motes');
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uAnchor', 'uTime', 'uPxPerM', 'uFloor', 'uFloors', 'uGain', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
    /** the band laid in the buffer (-1: none), how many motes, what the last draw drew */
    this.band = -1;
    this.count = 0;
    this.drawn = 0;
    this._vp = new Float32Array(16);
    this._floors = new Float32Array(EG_MOTE_FLOOR.max * 8);
    this._nFloors = 0;
    this._anchor = new Float32Array(3);
    this._eye = new Float32Array(3);
  }
  /** Band `band`'s layout into the buffer (once a band). */
  setBand(band) {
    const b = Math.max(0, Math.min(3, band | 0));
    if (b === this.band) return false;
    const gl = this.gl, data = egMoteLayout(b, this.lite);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.band = b; this.count = data.length / 4;
    return true;
  }
  /** The hall the eye stands in: its floors (egMoteFloors) and its origin (the field's anchor - the scene's frame). */
  setHall(spec) {
    this._nFloors = egMoteFloors(spec, this._floors);
    const o = egToDungeon(spec, 0, 0, 0);
    this._anchor[0] = o[0]; this._anchor[1] = o[1]; this._anchor[2] = o[2];
  }
  /**
   * The motes, depth-tested and never written, added onto the frame after the solid geometry, in the frame's fog (`fog`
   * the renderer's) at `gain` (the band's light against its fog - the sky's). `eye` the camera (the scene's frame), `T`
   * the air's clock (wrapped here), `viewH` the world image's height in pixels. Answers whether it drew.
   */
  draw(proj, view, eye, T, fog = null, gain = 1, viewH = 0) {
    const gl = this.gl, U = this.u;
    this.drawn = 0;
    if (this.band < 0 || !this.count || !Number.isFinite(T)) return false;
    this._eye[0] = eye[0]; this._eye[1] = eye[1]; this._eye[2] = eye[2];
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(U.uVP, false, mul4(this._vp, proj, view));
    gl.uniform3fv(U.uEye, this._eye);
    gl.uniform3fv(U.uAnchor, this._anchor);
    gl.uniform1f(U.uTime, ((T % EG_SKY_PERIOD) + EG_SKY_PERIOD) % EG_SKY_PERIOD);
    gl.uniform1f(U.uPxPerM, (Math.max(1, viewH || gl.drawingBufferHeight || 720) * proj[5]) / 2);
    gl.uniform4fv(U.uFloor, this._floors);
    gl.uniform1i(U.uFloors, this._nFloors);
    gl.uniform1f(U.uGain, gain);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_CAM);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.disable(gl.BLEND);
    this.drawn = this.count;
    return true;
  }
  /** Every GL object it made, freed once. */
  destroy() {
    const gl = this.gl;
    if (!this.prog) return;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
    this.prog = /** @type {any} */ (null);
    this.band = -1; this.count = 0;
  }
}
