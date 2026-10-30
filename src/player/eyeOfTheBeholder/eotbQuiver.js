// @ts-check
// QUIVER (2026-10-30, Mac: "For the bow, lets add a quiver to the holster"): a bow's quiver on an Eye Of The Beholder
// sprite's back, mine and every walker's, by the Morrowind body's law (systems/weaponSheathing.js WS1): it hangs with
// the bow, stays while the bow is drawn, and holds arrows while its wearer has them (mine the rig's `hasAmmo`, a
// walker's pose `am`). Daggerfall draws no quiver: the tube is painted here, the arrows are the Arrow's own picture
// (TEXTURE.207) stood upright. It hangs by the holster's law (eotbHolster.js hangSpriteHolster) with its own spec.

import { EOTB_FIGURE } from '../../render/auraRing.js';
import { uprightWeaponPicture, HOLSTER_RETRY_MS } from './eotbHolster.js';
import { itemIconColor32 } from '../../ui/item/itemIconColor32.js';

/** The bows: SHORT_BOW_TEMPLATE and LONG_BOW_TEMPLATE (literals, as ui/hud/hud.js BOW_TEMPLATES are). */
export const QUIVER_BOWS = Object.freeze([129, 130]);
/** The Arrow (net/recipeLaw.js ARROWS_TEMPLATE): the picture the quiver's arrows are. */
export const QUIVER_ARROW_TEMPLATE = 131;
/** Does this weapon carry a quiver? A bow - the Thunderlock's shot is no arrow. */
export const quiverRidesWith = (item) => QUIVER_BOWS.includes(item?.templateIndex);

/** The quiver's hang (hangSpriteHolster's spec): steeper than the bow, its mouth higher over the shoulder, nearer the
 *  body so the bow lies over it from behind, and `side` toward the body's right - an archer draws over that shoulder. */
export const BACK_QUIVER = Object.freeze({ tilt: 18 * Math.PI / 180, back: 0.12, clear: 0.01, over: 0.3, nudge: 0.03, side: 0.08 });
/** The tube in the sprites' texels (EOTB_FIGURE.mpp): its width, its height, and how far the fletching stands over it. */
export const QUIVER_TUBE = Object.freeze({ w: 5, h: 28, rise: 8 });
/** The leather: the tube, the rim at its mouth, and the strap band and the base. */
export const QUIVER_LEATHER = Object.freeze({ body: [104, 66, 36], rim: [150, 108, 64], band: [62, 40, 24] });
/** The tube's columns lit as a cylinder, left to right. */
const SHADE = [0.6, 0.85, 1, 0.8, 0.55];
/** The arrows: their columns in the tube and how much higher each stands. */
const ARROW_COLS = [1, 2, 3], ARROW_LIFTS = [0, 2, 1];

/**
 * The quiver's picture: the tube, and with `full` three of `arrow` (an upright arrow - uprightWeaponPicture's, its
 * fletching on top) standing out of its mouth. The answer as uprightWeaponPicture's: color32 RGBA, row 0 the bottom,
 * `mirror` the columns reversed, `w` and `h` its quad in metres on a figure the sets' size. Pure.
 */
export function quiverPicture(arrow, full = true) {
  const T = QUIVER_TUBE, arrows = full && arrow?.width > 0 && arrow?.height > 0 ? arrow : null;
  const W = T.w, H = T.h + (arrows ? T.rise + Math.max(...ARROW_LIFTS) : 0);
  const out = new Uint8Array(W * H * 4), mirror = new Uint8Array(W * H * 4);
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    for (const [buf, c] of /** @type {[Uint8Array, number][]} */ ([[out, x], [mirror, W - 1 - x]])) {
      const o = (y * W + c) * 4;
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
    }
  };
  if (arrows) {
    for (let i = 0; i < ARROW_COLS.length; i++) {
      const top = T.h + T.rise + ARROW_LIFTS[i], x0 = ARROW_COLS[i] - Math.floor(arrows.width / 2);
      for (let ay = 0; ay < arrows.height; ay++) {
        const y = top - arrows.height + ay;
        if (y < T.h) continue;   // inside the tube
        for (let ax = 0; ax < arrows.width; ax++) {
          const q = (ay * arrows.width + ax) * 4;
          if (arrows.colors[q + 3] > 127) put(x0 + ax, y, arrows.colors[q], arrows.colors[q + 1], arrows.colors[q + 2]);
        }
      }
    }
  }
  const L = QUIVER_LEATHER, band = Math.round(T.h * 0.62);
  for (let y = 0; y < T.h; y++) {
    const c = y >= T.h - 2 ? L.rim : y === 0 || y === band ? L.band : L.body;
    for (let x = 0; x < W; x++) put(x, y, Math.round(c[0] * SHADE[x]), Math.round(c[1] * SHADE[x]), Math.round(c[2] * SHADE[x]));
  }
  return { width: W, height: H, colors: out, mirror, w: W * EOTB_FIGURE.mpp, h: H * EOTB_FIGURE.mpp };
}

/** The renderer's archive a quiver is uploaded under (record 0 as drawn, 1 mirrored). */
export const quiverArtArchive = (full) => `eotb-quiver:${full ? 'arrows' : 'empty'}`;

/** The default arrow door: the Arrow's own picture, stood upright - or null (none, not in a browser). */
export async function loadQuiverArrow() {
  return uprightWeaponPicture(/** @type {any} */ (await itemIconColor32({ templateIndex: QUIVER_ARROW_TEMPLATE, group: 'Weapons' })));
}

/**
 * One layer's two quivers: `ensure(full)` answers `{ archive, w, h, pic }` - with arrows once the arrow's picture is
 * up, the empty tube until then (and while it is asked again after a failure, HOLSTER_RETRY_MS). Two pictures for the
 * session, each uploaded once and again if the renderer let it go.
 * @param {() => any} getRenderer @param {() => Promise<any>} [loadArrow] @param {() => number} [clock]
 */
export function createQuiverArt(getRenderer, loadArrow = loadQuiverArrow, clock = () => Date.now()) {
  /** @type {any} */ let arrow = null;   // null unasked | Promise in flight | an upright picture | { failedAt }
  /** @type {any[]} */ const made = [null, null];   // [empty, arrows]
  const upload = (renderer, a) => {
    renderer.uploadTexture(a.archive, 0, { width: a.pic.width, height: a.pic.height, colors: a.pic.colors });
    renderer.uploadTexture(a.archive, 1, { width: a.pic.width, height: a.pic.height, colors: a.pic.mirror });
  };
  const ask = () => {
    const p = Promise.resolve().then(() => loadArrow()).then(
      (pic) => { if (arrow === p) arrow = pic ?? { failedAt: clock() }; },
      () => { if (arrow === p) arrow = { failedAt: clock() }; });
    arrow = p;
  };
  return {
    ensure(full) {
      const renderer = getRenderer();
      if (!renderer) return null;
      if (full && !made[1]) {
        if (!arrow || (arrow.failedAt != null && clock() - arrow.failedAt >= HOLSTER_RETRY_MS)) ask();
        if (arrow instanceof Promise || arrow.failedAt != null) full = false;   // the empty tube meanwhile
      }
      const i = full ? 1 : 0;
      let a = made[i];
      if (!a) {
        const pic = quiverPicture(arrow, full);
        upload(renderer, (a = made[i] = { archive: quiverArtArchive(full), w: pic.w, h: pic.h, pic }));
      } else if (renderer.textures?.has && !renderer.textures.has(`${a.archive}_0`)) upload(renderer, a);
      return a;
    },
  };
}
