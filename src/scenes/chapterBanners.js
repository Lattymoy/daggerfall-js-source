// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP7b (2026-10-09, Mac: "continue"; bible/11-Multiplayer/Chapters-Arc.md
// section 8, CALL 6) — A PATRON'S BANNERS AT ITS CHAPTER'S HALLS: "A
// patron's banner hangs in the chapter's halls". A town's guild halls and
// temples whose chapter (the hall's guild in the town's politic region - AUDIT
// CHAP3 C6, as the hall's prices read it - off the chapter sheet,
// net/chapterSheet.js chapterOf) has a player guild for its
// patron this Season hang that guild's arms, two banners beside the door,
// as a player guild's own hall does (scenes/hallBanners.js
// hallBannerAnchors, its measure and its keys). A patron that chose no
// arms, a hall whose door the build did not measure, a chapter the sheet
// does not name - none.
//
// Online alone (the sheet is the account service's). Four hosts: world.js
// WIRED (the streets, the halls' banners' own pass); worldModes.js and
// dungeonContext.js stand no street; exterior.js (the bench) not wired - it
// reads no sheet.
// ═══════════════════════════════════════════════════════════════════
import { BANNERS_MAX } from '../render/bannerPass.js';
import { hallBannerAnchors, bannerKeyOf, BANNER_REFRESH_MS } from './hallBanners.js';

/**
 * THE PATRONS' BANNERS. `deps`: `built()` the world's built pixels (each `{ px, py, homeFrames, chapterHalls }` -
 * `chapterHalls` the town's guild halls and temples, a Map of building key to its guild faction), `regionAt(px, py)` a
 * pixel's politic region (or null), `chapterOf(faction, region)` the sheet's chapter (its `patron`, `{ heraldry }`),
 * `translation(px, py)` a pixel's place in the scene now, `eye()` where the view stands, `now()` ms. `list()` answers
 * this frame's banners for render/bannerPass.js.
 */
export function createChapterBanners({ built, regionAt, chapterOf, translation, eye = () => null, now = () => Date.now() }) {
  /** @type {any[]} */
  let held = [];
  /** @type {any[]} */
  let outs = [];
  /** @type {any[]} */
  const nearest = [];
  let at = -Infinity;
  /** @type {number[] | null} */
  let eyeAt = null;
  const byEye = (/** @type {any} */ x, /** @type {any} */ y) => Math.hypot(x.top[0] - /** @type {number[]} */ (eyeAt)[0], x.top[2] - /** @type {number[]} */ (eyeAt)[2])
    - Math.hypot(y.top[0] - /** @type {number[]} */ (eyeAt)[0], y.top[2] - /** @type {number[]} */ (eyeAt)[2]);
  function read() {
    const out = [];
    for (const [, p] of built?.() ?? []) {
      if (!p?.chapterHalls?.size || !p.homeFrames) continue;
      const region = regionAt?.(p.px, p.py) ?? null;
      if (!Number.isInteger(region)) continue;
      for (const [bk, faction] of p.chapterHalls) {
        const h = chapterOf?.(faction, region)?.patron?.heraldry ?? null;
        if (!h) continue;
        const anchors = hallBannerAnchors(p.homeFrames.get(bk));
        if (!anchors) continue;
        anchors.forEach((a, i) => out.push({ px: p.px, py: p.py, a, key: bannerKeyOf(h), heraldry: h, phase: (bk % 11) * 0.9 + i * 1.7 }));
      }
    }
    held = out;
    outs = held.map((/** @type {any} */ b) => ({ key: b.key, heraldry: b.heraldry, phase: b.phase, top: [0, 0, 0], right: b.a.right, out: b.a.out }));
  }
  return {
    list() {
      if (now() - at >= BANNER_REFRESH_MS) { read(); at = now(); }
      for (let i = 0; i < held.length; i++) {
        const b = held[i], t = translation(b.px, b.py), top = outs[i].top;
        top[0] = t[0] + b.a.top[0]; top[1] = t[1] + b.a.top[1]; top[2] = t[2] + b.a.top[2];
      }
      if (outs.length <= BANNERS_MAX) return outs;
      const e = eye();
      nearest.length = 0;
      for (const o of outs) nearest.push(o);
      if (e) { eyeAt = e; nearest.sort(byEye); }
      nearest.length = BANNERS_MAX;
      return nearest;
    },
  };
}
