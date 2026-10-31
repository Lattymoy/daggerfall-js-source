// @ts-check
// DRAGON2 (the owner: "a new rare random world encounter, a sort of world boss when found anywhere in the world";
// bible/11-Multiplayer/Dwarven-Dragon.md sections 2 and 4): THE DRAGON'S LAW - which watches bring a dragon down, which
// is the Aetherbright, where its site is rolled, how its fight is named. DRAGON-HIDDEN (the owner: "people are able to
// predict the dragon spawn by looking at source code"): every roll takes a watch's omen `{w, s}`, its seed the relay's
// secret (net/dragon/dragonSeed.js), told only once its landing is past. DRAGON-CELL (2026-10-31, the owner chose
// "Cell-scoped"): the seed picks a cell, and only a player near it is told. The site in the cell is the client's to find
// over the world's own data (systems/dragon/dragonSite.js); the relay never reads a map. Pure. Not a DFU member. Ledger A (DRAGON).
import { gateHash } from '../gate/gateLaw.js';
import { PIXEL_UNITS, WORLD_CELL, mapPixelOfWire } from '../wire.js';

/** A watch of the real clock, ms; one omen in DRAGON_WATCH_ONE_IN brings a dragon down. DRAGON-CELL: a watch holds
 *  DRAGON_CELLS_A_WATCH omens (dragonCandidates), each its own cell, and one comes down only where its cell has ground. */
export const DRAGON_WATCH_MS = 3_600_000;
export const DRAGON_WATCH_ONE_IN = 3;
/** How long it stays before it climbs away unslain, ms. DRAGON-HIDDEN-TIME (2026-10-30, the owner: "dragon location and
 *  timer need to be random ... more so not traceable"): when in its watch it comes down is its seed's roll too, a whole
 *  second in the watch's first DRAGON_LAND_SPAN_MS (dragonLandOf) - never a fixed minute anyone counts. */
export const DRAGON_LAND_SPAN_MS = 20 * 60_000;
export const DRAGON_STAY_MS = 40 * 60_000;
/** Its leaving - the climb out of sight - and its death's fall to the ground, ms. */
export const DRAGON_CLIMB_MS = 15_000;
/** A slain dragon lies deactivated this long after its fall, ms (section 7) - every screen's, and the cell's word of it. */
export const DRAGON_REMAINS_MS = 10 * 60_000;
/** One dragon in this many is the Aetherbright (section 11). */
export const DRAGON_SHINY_ONE_IN = 20;
/** Is `o` a watch's omen - its number and the relay's seed for it, a whole 32-bit number? @param {any} o */
export const dragonOmenOk = (o) => !!o && Number.isSafeInteger(o.w) && o.w >= 0 && Number.isSafeInteger(o.s) && o.s >= 0 && o.s <= 0xffffffff;
/** Roll `k` of an omen, a whole number in [0, 2^32). @param {{w: number, s: number}} o @param {number} k */
export const dragonRoll = (o, k) => gateHash(o.s, o.w, k);
/** The watch a relay-clock instant stands in. */
export const dragonWatchAt = (nowMs) => Math.floor(nowMs / DRAGON_WATCH_MS);
/** Does this omen bring a dragon down? @param {any} o */
export const isDragonOmen = (o) => dragonOmenOk(o) && dragonRoll(o, 0) % DRAGON_WATCH_ONE_IN === 0;
/** Is its dragon the Aetherbright? @param {{w: number, s: number}} o */
export const dragonShinyOf = (o) => dragonRoll(o, 1) % DRAGON_SHINY_ONE_IN === 0;
/** Its look's number, the receipt's `b` and the pose's `rc`: 0 the brass, 1 the Aetherbright. @param {{w: number, s: number}} o */
export const dragonLookOf = (o) => (dragonShinyOf(o) ? 1 : 0);

/** DRAGON-HIDDEN-TIME: how far into its watch an omen's dragon lands, ms - a whole second its seed rolls. @param {{w: number, s: number}} o */
export const dragonLandOf = (o) => (dragonRoll(o, 6) % (DRAGON_LAND_SPAN_MS / 1000)) * 1000;
/** An omen's instants, relay-clock ms - its landing its seed's (DRAGON-HIDDEN-TIME), so the clock alone tells no one when.
 *  @param {{w: number, s: number}} o */
export function dragonTimes(o) {
  const landAt = o.w * DRAGON_WATCH_MS + dragonLandOf(o);
  return { w: o.w, landAt, leaveAt: landAt + DRAGON_STAY_MS };
}
/** The latest any dragon of watch `w` lands: a quiet watch is told quiet no sooner, so its silence says nothing. */
export const dragonQuietAt = (w) => w * DRAGON_WATCH_MS + DRAGON_LAND_SPAN_MS;
/** The last instant a screen may want watch `w`'s word: its latest dragon's leaving and its remains. */
export const dragonAskEnd = (w) => dragonQuietAt(w) + DRAGON_STAY_MS + DRAGON_CLIMB_MS + DRAGON_REMAINS_MS;
/** May omen `o`'s seed be told at `nowMs` - its dragon landed, or for a quiet watch its latest landing past; never a
 *  watch to come, never a landing ahead. Null `o` (no secret here) is told as quiet. @param {any} o @param {number} w @param {number} nowMs */
export const dragonSeedTold = (o, w, nowMs) => Number.isSafeInteger(w) && w >= 0 && (o && isDragonOmen(o) ? nowMs >= dragonTimes(o).landAt : nowMs >= dragonQuietAt(w));
/** The watches a screen may still see a dragon of at `nowMs`: this one and the last (its remains may lie past it). */
export const dragonWatchesAbout = (nowMs) => { const w = dragonWatchAt(nowMs); return w > 0 ? [w, w - 1] : [w]; };
/** May a fight with this omen's dragon begin now - from its landing until it climbs away? @param {any} o @param {number} nowMs */
export const dragonAdmits = (o, nowMs) => { if (!isDragonOmen(o)) return false; const t = dragonTimes(o); return nowMs >= t.landAt && nowMs < t.leaveAt; };
/** May a fighter already in it be in it now (a reconnect after a blip) - until its climb is over? @param {any} o @param {number} nowMs */
export const dragonHolds = (o, nowMs) => { if (!isDragonOmen(o)) return false; const t = dragonTimes(o); return nowMs >= t.landAt && nowMs < t.leaveAt + DRAGON_CLIMB_MS; };

// THE CELL (DRAGON-CELL; a player read every dragon's pixel off the omen the relay told the whole world at its landing).
// The seed picks one of the relay's world cells (wire.js WORLD_CELL) in a box the relay knows with no map, and the relay
// tells the omen only to a socket standing within DRAGON_TELL_PX of it. The client finds the site in that cell
// (systems/dragon/dragonSite.js); a cell with no ground brings no dragon down.
/** A cell's side, pixels: the relay's own cells, so a site's fight stands in its cell's room. */
export const DRAGON_CELL_PX = WORLD_CELL;
/** The cells a seed picks from: the continent's frame at its authored fit (world/tamriel/tamrielFrame.js BAY_ORIGIN 862,
 *  975, 6000 x 3750 pixels). It holds the land at that fit and at the freeware's trace (ppu 15.5), not at every fit the
 *  search allows (AUDIT DRAGON-CELL D11: past ppu 18.75 the land spills east of it). */
export const DRAGON_CELLS = Object.freeze({ cx0: -54, cy0: -61, cols: 376, rows: 235 });
/** How far past its cell a player is told its omen, pixels: DRAGON_SIGHT_R (4 km, scenes/dragonHost.js) and its roost
 *  (dragonBody.js ROOST_R) from the cell's edge, at 0.8192 km a pixel. */
export const DRAGON_TELL_PX = 6;
/** An omen's cell. @param {{w: number, s: number}} o @returns {{cx: number, cy: number}} */
export function dragonCellOf(o) {
  const n = dragonRoll(o, 7) % (DRAGON_CELLS.cols * DRAGON_CELLS.rows);
  return { cx: DRAGON_CELLS.cx0 + (n % DRAGON_CELLS.cols), cy: DRAGON_CELLS.cy0 + Math.floor(n / DRAGON_CELLS.cols) };
}
/** Is map pixel (px, py) within DRAGON_TELL_PX of an omen's cell - may a player standing there be told it?
 *  @param {{w: number, s: number}} o @param {number} px @param {number} py */
export function dragonToldAt(o, px, py) {
  const { cx, cy } = dragonCellOf(o), x0 = cx * DRAGON_CELL_PX - DRAGON_TELL_PX, y0 = cy * DRAGON_CELL_PX - DRAGON_TELL_PX, span = DRAGON_CELL_PX + 2 * DRAGON_TELL_PX;
  return Number.isInteger(px) && Number.isInteger(py) && px >= x0 && py >= y0 && px < x0 + span && py < y0 + span;
}
/** How many omens a watch holds. On the freeware (tools/dragonCellProbe.mjs) at most 27.7% of DRAGON_CELLS hold ground,
 *  so four, one in three a dragon, bring at most 8.9 a day down, and up to four a watch - one in three watches had one. */
export const DRAGON_CELLS_A_WATCH = 4;
/** A watch's omens: each `{w, s}`, `s` one of the watch's `seeds` (net/dragon/dragonSeed.js dragonOmenSeeds - each its own
 *  HMAC, so one told says nothing of another), an omen as the law reads one. One within two cells of an earlier one's is
 *  dropped, so a player stands near one at most. @param {{w: number, seeds: readonly number[]}} o */
export function dragonCandidates(o) {
  /** @type {Array<{w: number, s: number}>} */ const out = [];
  for (let i = 0; i < DRAGON_CELLS_A_WATCH; i++) {
    const c = { w: o.w, s: o.seeds[i] >>> 0 }, cell = dragonCellOf(c);
    if (out.some((d) => { const e = dragonCellOf(d); return Math.max(Math.abs(e.cx - cell.cx), Math.abs(e.cy - cell.cy)) <= 2; })) continue;
    out.push(c);
  }
  return out;
}
/** The omen of a watch's that a player on map pixel (px, py) may be told, or null. @param {{w: number, seeds: readonly number[]}} o @param {number} px @param {number} py */
export const dragonCandidateAt = (o, px, py) => dragonCandidates(o).find((c) => dragonToldAt(c, px, py)) ?? null;
/** The omen of a watch's whose dragon could stand at this site, or null. @param {{w: number, seeds: readonly number[]}} o @param {number} sx @param {number} sz */
export const dragonCandidateOf = (o, sx, sz) => dragonCandidates(o).find((c) => dragonSiteOk(c, sx, sz)) ?? null;
/** Which of its cell's grounds an omen's site is: its own roll, never the watch's number. @param {{w: number, s: number}} o */
export const dragonSitePick = (o) => dragonRoll(o, 5);
/** A map pixel's centre, in native units (x east, z north) - every site's point. @param {number} px @param {number} py */
export const pixelCentreNative = (px, py) => ({ sx: (px + 0.5) * PIXEL_UNITS, sz: (499 - py + 0.5) * PIXEL_UNITS });
/** Could an omen's dragon stand at this site, as far as a relay with no map can judge - a pixel's centre in its cell.
 *  @param {{w: number, s: number}} o @param {number} sx @param {number} sz */
export function dragonSiteOk(o, sx, sz) {
  const [px, py] = mapPixelOfWire(sx, sz), c = pixelCentreNative(px, py), cell = dragonCellOf(o);
  return Math.floor(px / DRAGON_CELL_PX) === cell.cx && Math.floor(py / DRAGON_CELL_PX) === cell.cy && sx === c.sx && sz === c.sz;
}

/** Native units to the metre (wire.js PIXEL_UNITS over gateLaw.js PIXEL_M - pinned equal, serpentLaw.js's own). */
export const DRAGON_NATIVE_PER_M = 40;
/** A site's name: its native point to the whole unit (the serpent's AUDIT SERPENT S1 law - one fight a site). */
export const dragonSiteKey = (sx, sz) => `${Math.round(sx)},${Math.round(sz)}`;
/** A fight's id in its cell: the watch and the site. */
export const dragonFightId = (w, sx, sz) => `${w}@${dragonSiteKey(sx, sz)}`;
/** The most sites one cell keeps a fight for in a watch (a forged site stands a fight of its own - section 2). */
export const DRAGON_SITES_MAX = 3;

/** The brain's law a client fights by: the relay tells an older game to reload (the gate's GATE-RELOAD law). */
export const DRAGON_BRAIN_V = 3;
export const DRAGON_BRAIN_MIN = 3;   // DRAGON-HIDDEN: a game that rolls the old public salt is told to reload; DRAGON-CELL: one that finds a site off a lane
