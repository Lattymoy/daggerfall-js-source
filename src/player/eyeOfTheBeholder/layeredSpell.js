// @ts-check
import { FACING_X } from './layeredWeapon.js';
// SPELL-BURST (2026-10-30, the owner, of a concept sheet's "Wrath of Sithis": "Do both. I wanna see what you can cook").
// THE SPELL IN THE HAND OF A WORN-ARMOUR BODY. The art has no cast of its own - the cast plays the swing's wind-up and
// throw (layeredArmor.js recordBase) - so the spell is drawn into those frames: an orb gathering at the fists, swelling
// with crackling veins, bursting ahead as the arms throw, its specks scattering after. In the element's colours
// (combat/fpsSpellCasting.js ELEMENT_TYPES: fire, frost, poison, shock, magic). Pure: the pins drive it.

/** Each element's burst: its heart, its body, its rim and its veins (RGB). */
export const SPELL_COLOURS = Object.freeze([
  { core: [255, 236, 150], body: [236, 92, 36], rim: [128, 24, 12], vein: [64, 8, 6] },   // fire
  { core: [244, 252, 255], body: [130, 196, 255], rim: [34, 78, 168], vein: [16, 34, 92] },   // frost
  { core: [222, 255, 160], body: [96, 196, 64], rim: [34, 96, 24], vein: [18, 48, 12] },   // poison
  { core: [255, 255, 236], body: [250, 232, 96], rim: [150, 120, 30], vein: [236, 244, 255] },   // shock: white forks
  { core: [255, 226, 255], body: [196, 96, 236], rim: [84, 24, 116], vein: [46, 10, 66] },   // magic
]);
/** The cast's four frames (the swing's 0-3): the burst's radius and its distance past the fists (px at the male body's
 *  scale; up to the throw along the hammer's line, from it along the body's facing), its veins' reach (radii), the share
 *  of it kept. */
export const BURST_STAGES = Object.freeze([
  { r: 3, at: 3, vein: 0, keep: 1 },
  { r: 5, at: 5, vein: 1.9, keep: 1 },
  { r: 11, at: 19, vein: 1.9, keep: 1 },
  { r: 9, at: 27, vein: 0, keep: 0.35 },
]);
/** Thrown toward or away from the eye (views 0 and 4), the flight is foreshortened to this share. */
const END_ON = 0.35;
/** The furthest a burst thrown from behind flies on to clear the body (px at the male body's scale). */
const CLEAR_PX = 40;
const MALE_CM = 0.6222, SPIKES = 7, VEINS = 5;
/** A number in [0, 1) from two integers, the same each time. */
const hash = (a, b) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Draw a spell's burst into a cast frame, in place: at the fists along the hammer's line (`fr`); from the throw on,
 * from the throw frame's fists (`throwFr`) along the body's facing. The stage's size and veins, the element's colours.
 * Thrown from behind (views 3 and 4), it flies away from the eye: past the body only.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {any} fr @param {number} element 0..4
 * @param {number} stage the swing frame, 0..3 @param {number} view 0..4 @param {number} cm the body's px a centimetre
 * @param {any} [throwFr] the throw frame's rig
 */
export function drawSpellBurst(out, fr, element, stage, view, cm, throwFr = null) {
  const C = SPELL_COLOURS[element] ?? SPELL_COLOURS[4], S = BURST_STAGES[stage];
  if (!S || !fr) return out;
  const k = cm > 0 ? cm / MALE_CM : 1;
  const thrown = stage >= 2, line = thrown && throwFr ? throwFr : fr, v = Math.max(0, Math.min(4, view | 0));
  const [lx, ly, ex, ey] = line.w ?? [...line.q, ...line.t], D = Math.hypot(ex - lx, ey - ly) || 1, fx = FACING_X[v];
  const [ux, uy] = thrown && fx ? [Math.sign(fx), 0] : [(ex - lx) / D, (ey - ly) / D];   // thrown: ahead, level
  const w = out.width, h = out.height, d = out.data, behind = v >= 3 && thrown;
  const solid = (x, y) => {
    x = Math.round(x);
    y = Math.round(y);
    return x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  };
  let along = S.at * k * (!thrown ? 1 : fx ? Math.abs(fx) : END_ON);
  const r0 = S.r * k, hidden = (a) => solid(lx + ux * a, ly + uy * a) || solid(lx + ux * (a - r0 / 2), ly + uy * (a - r0 / 2));
  // Thrown from behind it is past the body only, so it flies on until its heart, and half of it, clear the body.
  for (const most = along + CLEAR_PX * k; behind && along < most && hidden(along); ) along++;
  const cx = lx + ux * along, cy = ly + uy * along;
  const phase = hash(element + 1, 7) * Math.PI * 2;
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    if (behind && d[i + 3]) return;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  };
  const reach = r0 * 1.45;
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const R = r0 * (0.72 + 0.6 * Math.max(0, Math.cos(SPIKES * th + phase)) ** 3);
    if (r > R || (S.keep < 1 && hash(x * 31 + y, stage * 977 + element) > S.keep)) continue;
    const t = r / R, c = t < 0.4 ? C.core : t > 0.82 ? C.rim : C.body;
    put(x, y, c);
  }
  for (let v = 0; S.vein && v < VEINS; v++) {   // the veins: crooked lines out of the burst
    let a = phase + (v * Math.PI * 2) / VEINS + (hash(v, stage + 11) - 0.5) * 0.8, x = cx + Math.cos(a) * r0 * 0.7, y = cy + Math.sin(a) * r0 * 0.7;
    for (let s = 0; s < Math.ceil(r0 * S.vein * 2); s++) {
      a += (hash(v * 97 + s, stage + element * 5) - 0.5) * 0.9;
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
      put(Math.floor(x), Math.floor(y), C.vein);
    }
  }
  return out;
}
