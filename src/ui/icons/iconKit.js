// @ts-check
// AURUM (2026-10-29, the owner: "For profile icons no figures should be used. Ensure some are fully animated and go
// beyond with detail"; bible/06-Systems/Aurum.md section 5): THE PIECES THE ICONS ARE DRAWN WITH - a gear, a star, and
// the motions an icon's shapes take (ui/profileIcons.js builds them, and leaves the motions out for a still drawing).
// Pure data: each answers shapes in the icon's `[tag, attrs, children]` form, in its 64-unit square.

const f = (/** @type {number} */ n) => Math.round(n * 100) / 100;

/** A gear's outline about (cx, cy): `teeth` square-shouldered teeth from `rIn` out to `rOut`. */
export function gearPath(/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rOut, /** @type {number} */ rIn, /** @type {number} */ teeth) {
  const pts = [], step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    for (const [da, r] of [[-0.3, rIn], [-0.2, rOut], [0.2, rOut], [0.3, rIn]]) pts.push(`${f(cx + Math.cos(a + da * step) * r)} ${f(cy + Math.sin(a + da * step) * r)}`);
  }
  return `M${pts.join(' L')} Z`;
}
/** A star of `n` points about (cx, cy), from `r1` at its points to `r2` between them. */
export function starPath(/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r1, /** @type {number} */ r2, /** @type {number} */ n, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1;
    pts.push(`${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`);
  }
  return `M${pts.join(' L')} Z`;
}
/** A four-pointed glint at (x, y), `r` its reach. */
export const glintPath = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) =>
  `M${x} ${f(y - r)} L${f(x + r * 0.22)} ${f(y - r * 0.22)} L${f(x + r)} ${y} L${f(x + r * 0.22)} ${f(y + r * 0.22)} L${x} ${f(y + r)} L${f(x - r * 0.22)} ${f(y + r * 0.22)} L${f(x - r)} ${y} L${f(x - r * 0.22)} ${f(y - r * 0.22)} Z`;

// ── THE MOTIONS: each a child for the shape it moves ──
/** A turn about (cx, cy) every `dur` seconds, backwards with `back`. */
export const spin = (/** @type {number} */ dur, /** @type {number} */ cx, /** @type {number} */ cy, back = false) =>
  ['animateTransform', { attributeName: 'transform', type: 'rotate', from: `${back ? 360 : 0} ${cx} ${cy}`, to: `${back ? 0 : 360} ${cx} ${cy}`, dur: `${dur}s`, repeatCount: 'indefinite' }];
/** An attribute through `values` (`a;b;c`) every `dur` seconds, from `begin`. */
export const pulse = (/** @type {string} */ attr, /** @type {string} */ values, /** @type {number} */ dur, begin = 0, more = {}) =>
  ['animate', { attributeName: attr, values, dur: `${dur}s`, begin: `${begin}s`, repeatCount: 'indefinite', ...more }];
/** A move along `path` (the shape's own place its start) every `dur` seconds, from `begin`. */
export const drift = (/** @type {string} */ path, /** @type {number} */ dur, begin = 0) =>
  ['animateMotion', { path, dur: `${dur}s`, begin: `${begin}s`, repeatCount: 'indefinite' }];
/** A transform through `values` (`type` translate, scale, rotate) every `dur` seconds, laid on the shape's own. */
export const sway = (/** @type {string} */ type, /** @type {string} */ values, /** @type {number} */ dur, begin = 0, more = {}) =>
  ['animateTransform', { attributeName: 'transform', type, values, dur: `${dur}s`, begin: `${begin}s`, repeatCount: 'indefinite', additive: 'sum', ...more }];
/** A mote rising from (x, y) by `h` as it fades - a spark, a bubble, a grain of ash. */
export const mote = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r, /** @type {string} */ fill, /** @type {number} */ h, /** @type {number} */ dur, /** @type {number} */ begin, dx = 0) =>
  ['circle', { cx: x, cy: y, r, fill, opacity: 0 }, [
    drift(`M0 0 Q${f(dx * 0.6)} ${f(-h * 0.5)} ${dx} ${-h}`, dur, begin),
    pulse('opacity', '0;0.95;0.7;0', dur, begin, { keyTimes: '0;0.15;0.7;1' }),
  ]];
