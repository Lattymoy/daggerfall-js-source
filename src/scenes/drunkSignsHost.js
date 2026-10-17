// @ts-check
// DRUNK4 (2026-10-17, "Perhaps seeing the tavern sign appear outside random buildings to give the impression your
// character can't discern reality anymore"): THE SIGN, WHERE IT HANGS - the 3D half of systems/survival/drunkSigns.js
// (which picks the buildings and names them; the door's plaque is worldModes' exteriorHoverName). While the player is
// Very drunk a small hanging tavern sign - a tankard on a dark board - is drawn beside the door of each building the law
// picked. A billboard, drawn on the flats' axis with the street's people (world.js framePools): the building itself,
// its door, its click and its directory entry are untouched, and the sign is gone the frame the player is sober.
//
// THERE IS NO SIGN ART in Daggerfall's files for it (the tavern's own sign is a model of the building), so the port draws
// its own pixel picture in code, as ui/hud/hudStatus.js draws its glyphs: `signImage` lays that module's 16px tankard
// (`drunk`, the HUD's own chip) on a 32x24 board, once, as rows from the BOTTOM up (a world billboard's color32 order).
//
// WHERE: the door beside which the hall banners hang (scenes/hallBanners.js hallBannerAnchors: the building's first door,
// measured where its pixel is built - `homeFrames` - two opposite corners in the pixel's frame, the wall's direction and
// the face away from the building's middle); the sign is centred SIGN.centerM over the door's foot on the side the
// building's key picks, a hand off the wall. Carried by the pixel's live floating-origin translation, set each frame.
//
// EVERY ALLOCATION HAS AN OWNER (bible/Home.md): one billboard batch a sign, and the one picture they share. The batch
// is freed the frame its building is no longer picked (sober, the next binge, another town), its pixel is rebuilt or
// unbuilt, and by `destroyAll` (a load); the picture is uploaded with the first batch and released with the last.
//
// THE FOUR HOSTS (bible/Home.md): world.js WIRED (the streets: framePools draws it on the flats' axis, a load
// takes it down). exterior.js (the bench) measures no door frames - it draws no online homes (hallBanners.js) - so it
// stands no sign and has the plaque alone. worldModes.js (interiors) and dungeonContext.js stand no street.
//
// Not a DFU member. Ledger A (DRUNK4).

import { statusGlyphColor32 } from '../ui/hud/hudStatus.js';
import { hallBannerAnchors, BANNER_TOP_M } from './hallBanners.js';
import { drunkSigns, phantomEligible } from '../systems/survival/drunkSigns.js';

/** THE SIGN: its picture's texture key (a string archive, as the portals' - never a Daggerfall texture's), its size in
 *  metres (the picture's 4:3), its centre over the door's foot, and how far it hangs off the wall past the banner's. */
export const SIGN = Object.freeze({ archive: 'drunksign', record: 'tavern', w: 0.8, h: 0.6, centerM: 2.8, extraOutM: 0.15, tex: Object.freeze({ w: 32, h: 24 }) });

/** The picture's colours: the iron the board hangs from, the board's outline, edge and plank. */
const INK = Object.freeze({ iron: '#2b2b2f', outline: '#1a0f08', edge: '#a37a46', plank: '#7a5530', grain: '#6d4b29' });
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
/** The board's rows from the top: the chains (rows 0-2), then the board (rows 3-23). */
const BOARD_TOP = 3;
const CHAINS = Object.freeze([6, 25]);
/** The tankard's top-left on the picture. */
const GLYPH_AT = Object.freeze([8, 5]);

/**
 * The sign's picture: { width: 32, height: 24, colors } as renderer.uploadTexture takes it - RGBA bytes, the rows from the
 * BOTTOM up. Two iron chains over a plank board (outlined, edged, grained, its four corners cut) with the HUD's tankard
 * on it; everything else clear. Pure.
 */
export function signImage() {
  const { w, h } = SIGN.tex;
  const colors = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, hex) => {   // y from the TOP, as drawn; stored from the bottom
    const o = ((h - 1 - y) * w + x) * 4, c = rgb(hex);
    colors[o] = c[0]; colors[o + 1] = c[1]; colors[o + 2] = c[2]; colors[o + 3] = 255;
  };
  for (const x of CHAINS) for (let y = 0; y < BOARD_TOP; y++) put(x, y, INK.iron);
  for (let y = BOARD_TOP; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const corner = (x === 0 || x === w - 1) && (y === BOARD_TOP || y === h - 1);
      if (corner) continue;
      const rim = x === 0 || x === w - 1 || y === BOARD_TOP || y === h - 1;
      const edge = x === 1 || x === w - 2 || y === BOARD_TOP + 1 || y === h - 2;
      put(x, y, rim ? INK.outline : edge ? INK.edge : (y - BOARD_TOP) % 4 === 0 ? INK.grain : INK.plank);
    }
  }
  const glyph = statusGlyphColor32('drunk');
  if (glyph) {
    const g = new Uint8Array(glyph.colors.buffer, glyph.colors.byteOffset, glyph.width * glyph.height * 4);
    for (let gy = 0; gy < glyph.height; gy++) {
      for (let gx = 0; gx < glyph.width; gx++) {
        const s = (gy * glyph.width + gx) * 4;
        if (g[s + 3] === 0) continue;
        const o = ((h - 1 - (GLYPH_AT[1] + gy)) * w + GLYPH_AT[0] + gx) * 4;
        colors[o] = g[s]; colors[o + 1] = g[s + 1]; colors[o + 2] = g[s + 2]; colors[o + 3] = 255;
      }
    }
  }
  return { width: w, height: h, colors };
}

/**
 * Where a building's sign hangs: `frame` the building's `{ box, door: { a, b } }` in its pixel's frame (the pixel build's
 * homeFrames), `key` its building key. The billboard's BASE (the quad stands on it; the shader lifts by half its height)
 * in the pixel's frame, on the side of the door the key's low bit picks, hung `SIGN.centerM` up the wall - or null for a
 * building whose door the build did not measure. Pure.
 * @returns {{ base: number[], out: number[], centre: number }|null}
 */
export function signPlace(frame, key) {
  const two = hallBannerAnchors(frame);
  if (!two) return null;
  const a = two[key & 1];
  const foot = a.top[1] - BANNER_TOP_M;
  return {
    base: [a.top[0] + a.out[0] * SIGN.extraOutM, foot + SIGN.centerM - SIGN.h / 2, a.top[2] + a.out[2] * SIGN.extraOutM],
    out: a.out,
    centre: foot + SIGN.centerM,
  };
}

const NONE = Object.freeze([]);

/**
 * THE HOST'S SIGNS. `deps`: `renderer`; `built()` the world's built pixels (each `{ px, py, homeTown, homeFrames }`);
 * `translation(px, py, out)` a pixel's place in the scene now; `pixelNow()` the pixel the player stands in (its town is the
 * one that shows signs); `signs` the law's runtime; `place` where a sign hangs (signPlace - a test counts its calls). Says to the law which town the player is in and which of its buildings
 * have a door a sign can hang beside (`provide`).
 */
export function createDrunkSignsHost({ renderer, built, translation, pixelNow, signs = drunkSigns, place = signPlace }) {
  // AUDIT DRUNK2 (sign maintenance allocated every frame: a set, a placement and an id string a sign a frame): held by the pixel OBJECT (a pixel built again is a new object, so its signs are simply not seen again and
  // are freed) and then by building key - no id string a frame - each sign stamped with the frame that last saw it, so the
  // sweep needs no set made a frame. A sign kept is not placed again: its pick and its pixel are what it was made from.
  /** @type {Map<any, Map<number, { pixel: any, batch: any, base: number[], origin: number[], seen: number }>>} */
  const held = new Map();
  const out = [];
  const scratch = [0, 0, 0];
  let art = false, stamp = 0, hung = 0;

  signs.provide({
    town: () => pixelNow()?.homeTown || null,
    buildings: () => {
      const list = [];
      for (const [buildingKey, f] of pixelNow()?.homeFrames ?? []) list.push({ buildingKey, buildingType: f.type, hasDoor: !!place(f, buildingKey) });
      return list;
    },
  });

  const release = () => { if (art) { renderer.releaseTexture?.(SIGN.archive, SIGN.record); art = false; } };
  const free = (h) => { try { renderer.destroyBillboardBatch(h.batch); } catch { /* gone */ } };
  function make(pixel, placed) {
    if (!renderer?.createBillboardBatch || !renderer.uploadTexture) return null;
    renderer.uploadTexture(SIGN.archive, SIGN.record, signImage());   // keyed and cached: asked again, never uploaded twice
    art = true;
    const batch = renderer.createBillboardBatch(SIGN.archive, SIGN.record, { w: SIGN.w, h: SIGN.h }, [[0, 0, 0]]);
    batch.origin = [0, 0, 0];
    batch.noShadow = true;
    return { pixel, batch, base: placed.base, origin: batch.origin, seen: 0 };
  }

  return {
    /** This frame's signs, each batch set where its pixel stands now: the ones the law picked in the player's town whose
     *  pixel is built and whose building has a door; every other held sign freed. Called each frame on the flats' axis. */
    batches() {
      const now = signs.current();
      if (!now.keys.length && !hung) return NONE;   // sober and nothing hung: the frame makes nothing
      stamp++;
      if (now.keys.length) {
        for (const p of built()?.values() ?? []) {
          if (!p?.homeFrames || (p.homeTown >>> 0) !== now.town) continue;
          let mine = held.get(p);
          for (const key of now.keys) {
            const had = mine?.get(key);
            if (had) { had.seen = stamp; continue; }   // kept: the same pick on the same pixel, no placement again
            const frame = p.homeFrames.get(key);
            if (!frame || !phantomEligible({ buildingKey: key, buildingType: frame.type })) continue;
            const placed = place(frame, key);
            if (!placed) continue;
            const made = make(p, placed);
            if (!made) continue;
            made.seen = stamp;
            if (!mine) held.set(p, mine = new Map());
            mine.set(key, made);
            hung++;
          }
        }
      }
      // what this frame did not see goes: no longer picked, its pixel built again or gone, another town
      for (const [p, mine] of held) {
        for (const [key, h] of mine) if (h.seen !== stamp) { free(h); mine.delete(key); hung--; }
        if (!mine.size) held.delete(p);
      }
      if (!hung) release();
      out.length = 0;
      for (const mine of held.values()) {
        for (const h of mine.values()) {
          const t = translation(h.pixel.px, h.pixel.py, scratch);
          h.origin[0] = t[0] + h.base[0]; h.origin[1] = t[1] + h.base[1]; h.origin[2] = t[2] + h.base[2];
          out.push(h.batch);
        }
      }
      return out;
    },
    /** Every sign down and the picture released (a load, a teardown). */
    destroyAll() {
      for (const mine of held.values()) for (const h of mine.values()) free(h);
      held.clear();
      hung = 0;
      out.length = 0;
      release();
    },
    /** How many signs hang (tests). */
    get count() { return hung; },
  };
}
