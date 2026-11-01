// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md sections 7 and 9): A MOUNT LOOK TRIED ON - the horse the world
// draws (the cart's horse's side view - OWN-WORK4: ours, systems/horse/horseArt.js) in the look, by the world's own dye
// (systems/horse/horseCoats.js recolorHorse, its mount part), on a canvas of its own with the look's beat drawn over it:
// embers and smoke, light wisping off a ghost, sun motes, sparks and steam. For the profile's Mount slot and the shop's
// panels. Still for less motion. Not a DFU member.
import { recolorHorse, withMountLook } from '../systems/horse/horseCoats.js';
import { VIEW_SIDE } from '../systems/horse/mountPaint.js';
import { prefersReducedMotion } from '../systems/hitFlash.js';   // the viewer's less motion, read live
import { ownHorsePicture } from '../systems/horse/horseArt.js';   // OWN-WORK4: the picture, ours

/** The picture the preview dyes (the side view) and its scale on the canvas (whole pixels, the art's own). */
export const MOUNT_PREVIEW_FILE = 'horse3.png';
export const MOUNT_PREVIEW_SCALE = 2;
/** Where on the picture (shares of its width and height, from its top left) the hooves strike and the mane runs -
 *  OWN-WORK4: read off our side view (horseArt.js), its head to the left. */
export const MOUNT_PREVIEW_MARKS = Object.freeze({ hooves: Object.freeze([0.34, 0.38, 0.62, 0.83]), ground: 0.94, mane: Object.freeze([0.12, 0.22]), chest: Object.freeze([0.27, 0.5]) });
/** Each look's beat drawn over the picture: its particles' colours, how many a second, and how they move. */
export const MOUNT_PREVIEW_BEAT = Object.freeze({
  warhorse: Object.freeze({ rate: 26, from: 'hooves', c: Object.freeze(['#ff9a3c', '#d2280a', '#3a2a2a']), rise: 40, life: 1.0 }),
  spectral: Object.freeze({ rate: 16, from: 'body', c: Object.freeze(['#cfeeff', '#7fb8ff']), rise: 12, life: 1.4 }),
  dawnfire: Object.freeze({ rate: 22, from: 'mane', c: Object.freeze(['#fff2a8', '#ffb42e', '#ff6a14']), rise: 30, life: 0.8 }),
  automaton: Object.freeze({ rate: 14, from: 'chest', c: Object.freeze(['#eef2f5', '#ffd27a', '#7fd8ff']), rise: 18, life: 1.2 }),
});

/** @type {Promise<{ width: number, height: number, data: Uint8Array } | null> | null} the picture, built once */
let _art = null;
/** OWN-WORK4: the side view, built from the player's own files once; a build that fails answers none and is forgotten. */
const ownArt = () => (_art ??= ownHorsePicture(MOUNT_PREVIEW_FILE).catch(() => { _art = null; return null; }));

/**
 * A preview: `node` its canvas, `set(key)` the look (null: the horse as drawn), `dispose()` its clock stopped.
 * @param {Document} doc @param {{ coat?: number, reduced?: boolean | (() => boolean), picture?: () => Promise<any> }} [o]
 * `coat` the horse's own look's code under it; `reduced` less motion - read each frame, or fixed; `picture` the side
 * view's loader (top row first, as horseArt.js builds it)
 */
export function mountPreview(doc, { coat = 0, reduced = () => prefersReducedMotion(), picture = ownArt } = {}) {
  // AUDIT-STOREFRONT II (lane C 6): less motion read as each frame is drawn (render/effectStage.js's way), so a player
  // who changes it with the card open is followed - read once, the preview kept the old choice for the card's life
  const still = typeof reduced === 'function' ? reduced : () => !!reduced;
  const canvas = doc.createElement('canvas');
  canvas.className = 'mountpreview';
  canvas.setAttribute?.('aria-hidden', 'true');
  const g = canvas.getContext?.('2d') ?? null;
  let key = /** @type {string|null} */ (null), pic = /** @type {HTMLCanvasElement|null} */ (null), raf = 0, alive = true, last = 0, owed = 0;
  /** the picture last drawn - under less motion, with nothing moving, it is not drawn again */
  let painted = /** @type {HTMLCanvasElement|null} */ (null);
  /** @type {{ x: number, y: number, vx: number, vy: number, age: number, life: number, c: string, s: number }[]} */
  const parts = [];
  function dye(/** @type {{ width: number, height: number, data: Uint8Array<ArrayBuffer> | Uint8ClampedArray<ArrayBuffer> }} */ art) {
    const d = recolorHorse({ width: art.width, height: art.height, colors: new Uint8Array(art.data.buffer, art.data.byteOffset, art.data.byteLength) }, withMountLook(coat, key), { bottomFirst: false, view: VIEW_SIDE });
    const p = doc.createElement('canvas'); p.width = art.width; p.height = art.height;
    const pg = /** @type {CanvasRenderingContext2D} */ (p.getContext('2d'));
    pg.putImageData(new ImageData(new Uint8ClampedArray(d.colors.buffer, d.colors.byteOffset, art.width * art.height * 4), art.width, art.height), 0, 0);
    pic = p;
    canvas.width = art.width * MOUNT_PREVIEW_SCALE; canvas.height = art.height * MOUNT_PREVIEW_SCALE;
  }
  function emit(/** @type {any} */ beat, /** @type {number} */ W, /** @type {number} */ H) {
    const M = MOUNT_PREVIEW_MARKS, r = Math.random;
    let x, y;
    if (beat.from === 'hooves') { x = M.hooves[Math.floor(r() * 4)] * W; y = M.ground * H; }
    else if (beat.from === 'mane') { x = (M.mane[0] + r() * 0.16) * W; y = (M.mane[1] + r() * 0.08) * H; if (r() < 0.4) { x = M.hooves[Math.floor(r() * 4)] * W; y = M.ground * H; } }
    else if (beat.from === 'chest') { x = M.chest[0] * W; y = M.chest[1] * H; if (r() < 0.5) { x = M.hooves[Math.floor(r() * 4)] * W; y = M.ground * H; } }
    else { x = (0.15 + r() * 0.75) * W; y = (0.2 + r() * 0.5) * H; }
    parts.push({ x, y, vx: (r() - 0.5) * 14 + (beat.from === 'body' ? 10 : 0), vy: -beat.rise * (0.5 + r()), age: 0, life: beat.life * (0.6 + 0.8 * r()), c: beat.c[Math.floor(r() * beat.c.length)], s: 1 + r() * 2.2 });
  }
  function draw(/** @type {number} */ now) {
    raf = 0;
    if (!alive || !g || canvas.isConnected === false) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    raf = globalThis.requestAnimationFrame?.(draw) ?? 0;   // the clock runs on under less motion, so its end is seen too
    const calm = still();
    if (calm && !parts.length && painted === pic) return;
    painted = pic;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (pic) g.drawImage(pic, 0, 0, canvas.width, canvas.height);
    const beat = key ? MOUNT_PREVIEW_BEAT[/** @type {keyof typeof MOUNT_PREVIEW_BEAT} */ (key)] : null;
    if (beat && !calm) {
      owed += dt * beat.rate;
      while (owed >= 1) { owed -= 1; emit(beat, canvas.width, canvas.height); }
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 0.985;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      g.globalAlpha = Math.max(0, 1 - p.age / p.life) * 0.9;
      g.fillStyle = p.c;
      g.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.s), Math.ceil(p.s));
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  const kick = () => { if (!raf && alive) raf = globalThis.requestAnimationFrame?.(draw) ?? 0; };
  return {
    node: canvas,
    set(/** @type {string|null} */ next) {
      key = typeof next === 'string' && Object.hasOwn(MOUNT_PREVIEW_BEAT, next) ? next : null;
      parts.length = 0;
      picture().then((art) => { if (alive && art) { dye(art); kick(); } });
    },
    dispose() { alive = false; if (raf) globalThis.cancelAnimationFrame?.(raf); raf = 0; },
  };
}
