// @ts-check
// SPYGLASS (2026-10-11, the owner: "a spyglass option where you can aim and view to observe other ships, their
// allegiance, cargo, etc." - bible/03-World/Captains-Sea.md) - THE GLASS'S WINDOW. While the glass is up the world is
// seen through it: the view narrowed to its magnification (scenes/world.js glassFov), the edge of the view the dark of
// its tube, a reticle at its heart - and under the reticle, the card of the ship it holds (scenes/naval/navalHost.js glass:
// systems/naval/shipKnowledge.js glassCard), her name toned by what she is to me, her rows as far as she is made out,
// and the study's bar filling while the glass is held on her. A DOM overlay over the world, under every window.
// AUDIT CAPTAIN'S SEA S10/S17: its box is the WORLD'S STRIP (`rect` - above the classic skin's docked bar, where the
// crosshair and the look the glass holds along stand), every length a share of that box's shorter side (`--g-m`, its
// hundredth); over the world's labels (the tags, the names and the wild marks stand at z-index 3), under the HUD.

import { PIXEL_FONT_CSS } from './pixelifyFive.js';
import { injectEnhancedFonts } from './enhanced/enhancedStyle.js';

export const SPYGLASS_STYLE_ID = 'dfglass-style';
/** The glass's own field: the share of the view's shorter side its circle spans. */
export const GLASS_FIELD = 0.92;
/** The tones a card's name wears, by `tone` (glassCard's). */
export const GLASS_TONES = Object.freeze({ hostile: '#e8705e', pirate: '#d9a05a', friendly: '#9fd69a', neutral: '#e6dcb8', unknown: '#b8c2ca' });

const CSS = `
.dfglass { position: fixed; left: var(--g-x, 0px); top: var(--g-y, 0px); width: var(--g-w, 100vw); height: var(--g-h, 100vh); --g-m: 1vmin;
  pointer-events: none; z-index: 4; ${PIXEL_FONT_CSS} color: #e6dcb8; --g-scale: 1; }
.dfglass-tube { position: absolute; inset: 0;
  background: radial-gradient(circle closest-side at 50% 50%, rgba(5,6,8,0) 0, rgba(5,6,8,0) ${Math.round(GLASS_FIELD * 100) - 4}%, rgba(5,6,8,0.86) ${Math.round(GLASS_FIELD * 100)}%, #050608 ${Math.round(GLASS_FIELD * 100) + 3}%); }
.dfglass-ring { position: absolute; left: 50%; top: 50%; width: calc(${GLASS_FIELD * 100} * var(--g-m)); height: calc(${GLASS_FIELD * 100} * var(--g-m)); transform: translate(-50%, -50%);
  border-radius: 50%; box-shadow: inset 0 0 0 2px rgba(201,162,92,0.55), inset 0 0 calc(6 * var(--g-m)) rgba(5,6,8,0.55); }
.dfglass-hair { position: absolute; background: rgba(230,220,184,0.7); box-shadow: 0 0 0 1px rgba(5,6,8,0.35); }
.dfglass-hair.h { height: 1px; top: 50%; }
.dfglass-hair.v { width: 1px; left: 50%; }
.dfglass-hair.l { left: calc(50% - 30 * var(--g-m)); width: calc(27 * var(--g-m)); }
.dfglass-hair.r { left: calc(50% + 3 * var(--g-m)); width: calc(27 * var(--g-m)); }
.dfglass-hair.t { top: calc(50% - 30 * var(--g-m)); height: calc(27 * var(--g-m)); }
.dfglass-hair.b { top: calc(50% + 3 * var(--g-m)); height: calc(27 * var(--g-m)); }
.dfglass-pip { position: absolute; left: 50%; top: 50%; width: calc(1.6 * var(--g-m)); height: calc(1.6 * var(--g-m)); transform: translate(-50%, -50%); border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(230,220,184,0.8); }
.dfglass.held .dfglass-pip { box-shadow: 0 0 0 2px rgba(230,220,184,0.95); }
.dfglass-card { position: absolute; left: 50%; top: calc(50% + 8 * var(--g-m)); width: max(260px, calc(40 * var(--g-m))); transform: translateX(-50%) scale(var(--g-scale)); transform-origin: 50% 0;
  background: rgba(10,12,16,0.72); border: 1px solid rgba(201,162,92,0.55); padding: 8px 10px 9px; text-shadow: 1px 1px 0 #050608; }
.dfglass-title { display: block; font-size: 17px; line-height: 1.15; }
.dfglass-sub { display: block; font-size: 12px; opacity: 0.8; margin-top: 2px; }
.dfglass-study { display: block; height: 3px; margin: 6px 0 4px; background: rgba(230,220,184,0.15); }
.dfglass-study i { display: block; height: 100%; width: 0; background: #c9a25c; }
.dfglass-rows { display: grid; grid-template-columns: auto 1fr; column-gap: 10px; row-gap: 2px; font-size: 12px; margin-top: 4px; }
.dfglass-rows b { font-weight: normal; opacity: 0.7; }
.dfglass-hint { display: block; font-size: 12px; margin-top: 6px; color: #c9a25c; }
.dfglass-foot { position: absolute; left: 50%; bottom: calc(50% - ${GLASS_FIELD * 50} * var(--g-m) + 2 * var(--g-m)); transform: translateX(-50%) scale(var(--g-scale)); transform-origin: 50% 100%;
  font-size: 12px; text-align: center; white-space: nowrap; text-shadow: 1px 1px 0 #050608; opacity: 0.85; }
.dfglass-btn { display: none; pointer-events: auto; margin-left: 10px; padding: 6px 12px; font-size: 13px; color: #e6dcb8; background: rgba(10,12,16,0.8);
  border: 1px solid rgba(201,162,92,0.7); touch-action: none; }
.dfglass.touch .dfglass-btn { display: inline-block; }
`;

/** The glass's lens eases to its magnification (and home) over about this long (s). */
export const GLASS_EASE_S = 0.12;
/** The lens a frame eases to: `lens` toward `want` (1: no glass) over GLASS_EASE_S, snapped home within a hair. */
export function easeLens(lens, want, dt) {
  const next = lens + (want - lens) * (1 - Math.exp(-Math.max(0, dt) / GLASS_EASE_S));
  return Math.abs(want - next) < 0.01 ? want : next;
}
/** The vertical field of view through the glass (radians): the lens's magnification is the tangent's - a glass of x4
 *  shows a quarter of the height the eye does. No glass (`lens` 1), the field as it is. */
export const glassFov = (fov, lens) => (lens > 1 ? 2 * Math.atan(Math.tan(fov / 2) / lens) : fov);
/** The look's speed under the glass: slowed by its magnification, so a ship held at x8 does not fly off the reticle. */
export const glassLookScale = (lens) => 1 / Math.max(1, lens);

/**
 * GLASS-CLEAR (2026-10-11, the owner: "the ship blocks your view most of the time when using your spyglass"): THE GLASS
 * FOCUSES PAST HER. Raised at a helm the view is the head's (mwViewHoldFirst), behind the ship's own masts, sails, wheel
 * and hands, and through a glass at x4 the nearest of them fill it. A glass shows nothing nearer than it is focused: as
 * the lens comes to its magnification the world's near plane stands out from the eye's own GLASS_NEAR_MIN to just past
 * the ship I stand aboard (`own`: how deep she reaches into the glass's view along the look, glassClearDepth's, and
 * GLASS_CLEAR_PAD more) - so another ship beyond her is drawn, and held, however close. Never past GLASS_NEAR_MAX, and
 * never so far that the sea at the foot of the view is cut, which would open a hole in it: where the view's lower edge
 * meets the sea (GLASS_SEA_MARGIN over its level, for the swell), its depth along the look, and GLASS_SEA_SHARE of that
 * - a long hull's bow far ahead of her helm stays in view. Aboard nothing (`own` 0), the eye's own. `fovY` the glass's
 * vertical field (glassFov's), `pitch` the look's (up positive), `eyeOverSea` the eye over the sea or whatever ground
 * stands higher under the view's foot (m). Pure.
 */
export const GLASS_NEAR_MIN = 0.2;
export const GLASS_NEAR_MAX = 120;
export const GLASS_CLEAR_PAD = 0.5;
export const GLASS_SEA_MARGIN = 0.6;
export const GLASS_SEA_SHARE = 0.85;
export function glassNear({ lens = 1, zoom = 1, fovY = 1, pitch = 0, eyeOverSea = 0, own = 0 } = {}) {
  if (!(lens > 1) || !(zoom > 1) || !(own > 0)) return GLASS_NEAR_MIN;
  const t = Math.min(1, (lens - 1) / (zoom - 1)), half = fovY / 2, dip = half - pitch, h = eyeOverSea - GLASS_SEA_MARGIN;
  let reach = Math.min(GLASS_NEAR_MAX, own + GLASS_CLEAR_PAD);
  if (dip > 1e-3) reach = h > 0 ? Math.min(reach, (GLASS_SEA_SHARE * h * Math.cos(half)) / Math.sin(dip)) : GLASS_NEAR_MIN;
  return GLASS_NEAR_MIN + (Math.max(GLASS_NEAR_MIN, reach) - GLASS_NEAR_MIN) * t;
}
/** A box's faces, its corners numbered by their sides (bit 0 its x, 1 its y, 2 its z), each taken round. */
const BOX_FACES = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
/**
 * GLASS-CLEAR: how deep along the look (m) a box reaches into the glass's view - the square about its circle, `field`
 * its half-angle (the reticle's world.js field) - the deepest point of the box within it; 0 where none of it is. `box`
 * an oriented box ({ c, ax, ay, az, h }, navalBallistics.js orientedBox's - the ship I stand aboard, navalHost.js
 * ownExtent), `eye` the look's origin, `yaw`/`pitch` its (forward [sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch)]).
 * Each face cut to the view (its four sides) and its deepest corner taken. Pure.
 */
export function glassClearDepth({ box = null, eye = [0, 0, 0], yaw = 0, pitch = 0, field = 0 } = {}) {
  if (!box || !(field > 0)) return 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = [sy * cp, sp, cy * cp], r = [cy, 0, -sy], u = [-sy * sp, cp, -cy * sp];
  const k = Math.tan(Math.min(field, 1.5));
  // her corners in the look's own frame: across, up, along
  const P = [];
  for (let i = 0; i < 8; i++) {
    const w = [0, 1, 2].map((d) => box.c[d] - eye[d] + (i & 1 ? 1 : -1) * box.ax[d] * box.h[0] + (i & 2 ? 1 : -1) * box.ay[d] * box.h[1] + (i & 4 ? 1 : -1) * box.az[d] * box.h[2]);
    P.push([w[0] * r[0] + w[1] * r[1] + w[2] * r[2], w[0] * u[0] + w[1] * u[1] + w[2] * u[2], w[0] * f[0] + w[1] * f[1] + w[2] * f[2]]);
  }
  // the view's four sides, each a plane through the eye: n . p <= 0 within
  const sides = [[1, 0, -k], [-1, 0, -k], [0, 1, -k], [0, -1, -k]];
  let deepest = 0;
  for (const face of BOX_FACES) {
    let poly = face.map((i) => P[i]);
    for (const n of sides) {
      const kept = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = n[0] * a[0] + n[1] * a[1] + n[2] * a[2], db = n[0] * b[0] + n[1] * b[1] + n[2] * b[2];
        if (da <= 0) kept.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); kept.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
      }
      poly = kept;
      if (!poly.length) break;
    }
    for (const p of poly) if (p[2] > deepest) deepest = p[2];
  }
  return deepest;
}
/** GLASS-CLEAR: the eye's height over where the view's lower edge meets the sea - over the sea, or over the ground there
 *  where it stands higher (a shore, a shoal: one look along the look's bearing, `groundAt(x, z)`; none, the sea alone).
 *  `eyeX`, `eyeZ`, `eyeY` the eye, `yaw` the look's (forward [sin, 0, cos]), `seaY` the sea's level. Pure. */
export function glassEyeOverSea({ eyeX = 0, eyeZ = 0, yaw = 0, eyeY = 0, seaY = 0, fovY = 1, pitch = 0, groundAt = null } = {}) {
  const h = eyeY - seaY, dip = fovY / 2 - pitch;
  if (!groundAt || !(h > 0) || !(dip > 1e-3)) return h;
  const run = h / Math.tan(dip), g = groundAt(eyeX + Math.sin(yaw) * run, eyeZ + Math.cos(yaw) * run);
  return eyeY - (Number.isFinite(g) ? Math.max(seaY, g) : seaY);
}

/**
 * The words the glass's foot says: its magnification and the presses that turn it and lower it.
 * @param {{ zoom?: number, keys?: { glass?: string|null, zoom?: string|null }, touch?: boolean, pad?: boolean }} [o]
 */
export function glassFootWords({ zoom = 4, keys = {}, touch = false, pad = false } = {}) {
  if (touch) return `x${Math.round(zoom)}`;   // AUDIT CAPTAIN'S SEA S3/S16: a finger's two presses are the foot's own buttons
  const magnify = pad ? (keys.zoom ? `${keys.zoom}: magnify` : null) : 'Wheel: magnify';   // S3: the pad's, the look stick's click
  const lower = keys.glass ? `${keys.glass}: lower the glass` : 'Lower the glass';
  return [`x${Math.round(zoom)}`, magnify, lower].filter(Boolean).join(' - ');
}
/** AUDIT CAPTAIN'S SEA S3: the glass's magnifications round - x2, x4, x8 and back to x2 (a press's, where no wheel turns). */
export const nextGlassZoom = (zoom) => (zoom >= 8 ? 2 : zoom >= 4 ? 8 : 4);
/** AUDIT CAPTAIN'S SEA S3/S16: the foot's presses under a finger not yet read - Magnify and Lower (the glass is up on a
 *  deck too, where the plate's Glass is not, and no wheel turns under a finger). Read once each. */
const taps = { zoom: 0, lower: 0 };
export function spyglassTaps() { const t = { zoom: taps.zoom > 0, lower: taps.lower > 0 }; taps.zoom = 0; taps.lower = 0; return t; }

let root = null, parts = null;
const said = new Map();
const set = (key, v, write) => { if (said.get(key) !== v) { said.set(key, v); write(v); } };
function el(doc, tag, cls) { const n = doc.createElement(tag); if (cls) n.className = cls; return n; }
function build(doc) {
  if (doc.head && !doc.getElementById?.(SPYGLASS_STYLE_ID)) {
    const st = el(doc, 'style', null);
    st.id = SPYGLASS_STYLE_ID;
    st.textContent = CSS;
    doc.head.append(st);
    injectEnhancedFonts(doc);
  }
  root = el(doc, 'div', 'dfglass');
  root.setAttribute?.('aria-hidden', 'true');
  const tube = el(doc, 'div', 'dfglass-tube'), ring = el(doc, 'div', 'dfglass-ring'), pip = el(doc, 'div', 'dfglass-pip');
  const hairs = ['h l', 'h r', 'v t', 'v b'].map((k) => el(doc, 'div', `dfglass-hair ${k}`));
  const card = el(doc, 'div', 'dfglass-card'), title = el(doc, 'span', 'dfglass-title'), sub = el(doc, 'span', 'dfglass-sub');
  const study = el(doc, 'span', 'dfglass-study'), fill = el(doc, 'i', null), rows = el(doc, 'div', 'dfglass-rows'), hint = el(doc, 'span', 'dfglass-hint');
  study.append(fill);
  card.append(title, sub, study, rows, hint);
  const foot = el(doc, 'div', 'dfglass-foot'), footText = el(doc, 'span', 'dfglass-foot-words');
  const zoomBtn = el(doc, 'span', 'dfglass-btn zoom'), lowerBtn = el(doc, 'span', 'dfglass-btn lower');
  zoomBtn.textContent = 'Magnify';
  lowerBtn.textContent = 'Lower';
  const tapper = (k) => (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); taps[k]++; };
  zoomBtn.addEventListener?.('touchstart', tapper('zoom'), { passive: false });
  lowerBtn.addEventListener?.('touchstart', tapper('lower'), { passive: false });
  foot.append(footText, zoomBtn, lowerBtn);
  root.append(tube, ring, ...hairs, pip, card, foot);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { card, title, sub, study, fill, rows, hint, foot: footText };
}

/**
 * The glass's window this frame: `model` null (the glass down - the window hidden), else `{ card, zoom }` - the card of
 * the ship the glass holds (null: none) and its magnification. `keys.glass` the press that lowers it (`keys.zoom` the
 * pad's that magnifies), `scale` the HUD's, `rect` the world's strip in CSS px ({ x, y, w, h }; none: the window's).
 * @param {{ card: any, zoom: number } | null} model
 * @param {{ doc?: any, keys?: { glass?: string|null, zoom?: string|null }, scale?: number, touch?: boolean, pad?: boolean, covered?: boolean, rect?: { x: number, y: number, w: number, h: number } | null }} [o]
 */
export function drawSpyglass(model, { doc = globalThis.document, keys = {}, scale = 1, touch = false, pad = false, covered = false, rect = null } = {}) {
  const on = !!model && !covered;
  if (!root) {
    if (!on || !doc?.createElement) return;
    build(doc);
  }
  set('on', on, (v) => { root.style.display = v ? '' : 'none'; });
  if (!on) { taps.zoom = 0; taps.lower = 0; return; }
  set('scale', String(scale), (v) => { root.style.setProperty?.('--g-scale', v); });
  // AUDIT CAPTAIN'S SEA S10: the world's strip - the docked bar's room left out, the reticle on the crosshair
  const box = rect && rect.w > 0 && rect.h > 0 ? `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}` : '';
  set('rect', box, (v) => {
    const [x, y, w, h] = v ? v.split(',').map(Number) : [];
    for (const [k, n] of [['--g-x', x], ['--g-y', y], ['--g-w', w], ['--g-h', h]]) root.style.setProperty?.(k, v ? `${n}px` : '');
    root.style.setProperty?.('--g-m', v ? `${Math.min(w, h) / 100}px` : '');
  });
  const c = model.card;
  set('held', `${!!c}|${!!touch}`, () => { root.className = `dfglass${c ? ' held' : ''}${touch ? ' touch' : ''}`; parts.card.style.display = c ? '' : 'none'; });
  set('foot', glassFootWords({ zoom: model.zoom, keys, touch, pad }), (v) => { parts.foot.textContent = v; });
  if (!c) return;
  set('title', c.title, (v) => { parts.title.textContent = v; });
  set('tone', GLASS_TONES[c.tone] ?? GLASS_TONES.neutral, (v) => { parts.title.style.color = v; });
  set('sub', c.sub ?? '', (v) => { parts.sub.textContent = v; });
  const study = Math.max(0, Math.min(1, Number(c.study) || 0));
  set('studying', study < 1, (v) => { parts.study.style.display = v ? '' : 'none'; });
  set('study', Math.round(study * 100), (v) => { parts.fill.style.width = `${v}%`; });
  set('rows', JSON.stringify(c.rows ?? []), () => {
    parts.rows.textContent = '';
    for (const [label, text] of c.rows ?? []) {
      const b = el(doc, 'b', null), s = el(doc, 'span', null);
      b.textContent = label;
      s.textContent = text;
      parts.rows.append(b, s);
    }
  });
  set('hint', c.hint ?? '', (v) => { parts.hint.textContent = v; parts.hint.style.display = v ? '' : 'none'; });
}
