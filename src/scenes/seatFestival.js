// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FESTIVAL-STAGE (2026-10-02, Mac: "lets finish the build work") - A
// FESTIVAL'S MUSIC, BANNERS AND LANTERNS (bible/11-Multiplayer/
// Seats-Arc.md 7.6: "Festival - music, banners, lanterns"). SEAT1d built
// its Festive buff (systems/seatEdicts.js); this is the town dressed for
// it, while a Festival rules there - the holder's Edict as the seats'
// list dresses the seat (net/townSeatLaw.js festivalRules). Nothing on
// the relay or the service: each client stages it off its own list.
//
//   THE MUSIC: the street's City music becomes the Tavern's - DFU's own
//     tavern playlist (systems/song/songManager.js TAVERN_SONGS: SQUARE_2,
//     TAVERN, FOLK1-3; FM: FM_SQR_2), the day's song as a tavern picks
//     it - in the town's streets (scenes/shared.js createMusicDirector).
//     Indoors, each building keeps its own.
//   THE BANNERS: more of the holder's banners on the seat banners' own
//     cloth (scenes/seatBanners.js, render/bannerPass.js) - two beside
//     each tavern's door, and a pennant over each board BOUNTY1 took for
//     its hunts (the rumour boards carry the seat's already), at most
//     FESTIVAL_BANNERS_MAX, measured where the pixel is built.
//   THE LANTERNS: one hung before every banner the town flies (its seat
//     anchors and the Festival's), in the street's own lantern pool
//     (world/city/cityLights.js fillLanternPool) - lit with the town's lamps
//     at dusk, flickering on their own slots, chosen nearest as they are.
//
// Online alone. Four hosts: world.js WIRED (the streets); worldModes.js
// and dungeonContext.js stand no street; exterior.js (the bench) runs no
// account service, so no Festival rules there.
// ═══════════════════════════════════════════════════════════════════
import { hallBannerAnchors, BANNER_REFRESH_MS } from './hallBanners.js';
import { boardPennantAnchor } from './seatBanners.js';
import { festivalRules } from '../net/townSeatLaw.js';
import { MUSIC_ENV } from '../systems/song/songManager.js';

/** How many more banners a Festival hangs in its town at most. */
export const FESTIVAL_BANNERS_MAX = 6;
/** A Festival's lantern: below its banner's top and out before its cloth - metres. */
export const FESTIVAL_LANTERN_DROP_M = 0.4;
export const FESTIVAL_LANTERN_OUT_M = 0.6;

/**
 * A FESTIVAL'S BANNERS' ANCHORS, in order: two beside each tavern's door (`tavernKeys` its building keys, `frames` the
 * pixel's building frames - scenes/world.js `homeFrames`), then a pennant over each board BOUNTY1 took (`bounty` the
 * boards' indices), at most FESTIVAL_BANNERS_MAX. Pure.
 */
export function festivalBannerAnchors({ frames = null, tavernKeys = [], boards = [], bounty = new Set() } = {}) {
  const out = [];
  for (const k of tavernKeys) {
    const two = hallBannerAnchors(frames?.get?.(k));
    if (two && out.length + 2 <= FESTIVAL_BANNERS_MAX) out.push(...two);
  }
  boards.forEach((b, i) => {
    const a = bounty.has(i) ? boardPennantAnchor(b) : null;
    if (a && out.length < FESTIVAL_BANNERS_MAX) out.push(a);
  });
  return out;
}

/** THE LANTERNS before `anchors` (every banner the town flies), pixel-local `[x, y, z]` - one each, below the cloth's
 *  top and out before it. Pure. */
export const festivalLanternsOf = (anchors) => (anchors ?? []).map((a) => [
  a.top[0] + a.out[0] * FESTIVAL_LANTERN_OUT_M, a.top[1] - FESTIVAL_LANTERN_DROP_M, a.top[2] + a.out[2] * FESTIVAL_LANTERN_OUT_M,
]);

/** THE MUSIC: the environment heard in a Festival town - its streets' City music the Tavern's; any other kept. Pure. */
export const festivalEnvironment = (environment, festival) => (festival === true && environment === MUSIC_ENV.City ? MUSIC_ENV.Tavern : environment);

/**
 * THE STAGE: whether a Festival rules at a town, and a built pixel's lanterns while it does. `seatAt(mapId)` the seat a
 * town is (dressed, while the seats are open to this account; else null), `version()` what moves the seats' answer,
 * `now()` ms. A town's answer is kept until the version moves or BANNER_REFRESH_MS passes - one seat read a second at
 * most, never one a frame.
 */
export function createFestivalStage({ seatAt, now = () => Date.now(), version = () => 0 }) {
  /** @type {Map<any, boolean>} */
  const rules = new Map();
  let at = -Infinity, seen = -1;
  const festive = (mapId) => {
    const v = version(), t = now();
    if (v !== seen || t - at >= BANNER_REFRESH_MS) { rules.clear(); seen = v; at = t; }
    let r = rules.get(mapId);
    if (r === undefined) { r = mapId != null && festivalRules(seatAt(mapId)); rules.set(mapId, r); }
    return r;
  };
  return {
    /** Whether a Festival rules at the town `mapId` this week. */
    festive,
    /** A built pixel's Festival lanterns (`festivalLanterns`, its town's) while one rules there - else null. */
    lanterns: (p) => (p?.festivalLanterns?.length && festive(p.homeTown) ? p.festivalLanterns : null),
  };
}
