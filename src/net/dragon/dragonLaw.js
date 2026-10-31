// @ts-check
// DRAGON2 (the owner: "a new rare random world encounter, a sort of world boss when found anywhere in the world";
// bible/11-Multiplayer/Dwarven-Dragon.md sections 2 and 4): THE DRAGON'S LAW - which watches bring a dragon down, which
// is the Aetherbright, where its site is rolled, how its fight is named. DRAGON-HIDDEN (the owner: "people are able to
// predict the dragon spawn by looking at source code"): every roll takes a watch's omen `{w, s}`, its seed the relay's
// secret (net/dragon/dragonSeed.js), told only once its landing is past. The site is the client's to find over the
// world's own data (systems/dragon/dragonSite.js); the relay never reads a map. Pure. Not a DFU member. Ledger A (DRAGON).
import { gateHash } from '../gate/gateLaw.js';
import { GATE_LANES_OPEN, PIXEL_UNITS, mapPixelOfWire, gateLanePixelOk } from '../wire.js';

/** A watch of the real clock, ms; one in DRAGON_WATCH_ONE_IN brings a dragon down (about eight a day). */
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

// THE SITE. The gate's site law (systems/gate/gateSite.js findGateSite, theatreGateSite.js for a province) under a number of
// the dragon's own: DRAGON_SITE_BASE past every game day the gate will see for millennia and below the lanes' span, so no
// gate, star or Hollow ever names the same.
export const DRAGON_SITE_BASE = 50_000_000;
/** The gate site law's number for an omen's site, on its lane's own day count - its own roll (DRAGON-HIDDEN: never the
 *  watch's number, which anyone counts). @param {{w: number, s: number}} o */
export const dragonSiteDay = (o) => DRAGON_SITE_BASE + (dragonRoll(o, 5) % DRAGON_SITE_BASE);
/** Which theatre (the gate's lane) an omen's dragon comes down in - any that stands. @param {{w: number, s: number}} o */
export const dragonLaneOf = (o) => GATE_LANES_OPEN[dragonRoll(o, 2) % GATE_LANES_OPEN.length];
/** A map pixel's centre, in native units (x east, z north) - every site's point. @param {number} px @param {number} py */
export const pixelCentreNative = (px, py) => ({ sx: (px + 0.5) * PIXEL_UNITS, sz: (499 - py + 0.5) * PIXEL_UNITS });
/** AUDIT DRAGON-HIDDEN A1: could an omen's dragon stand at this site, as far as a relay with no map can judge - a pixel's
 *  centre on its theatre's side of the Bay's edge (wire.js gateLanePixelOk; no province's border is the relay's).
 *  @param {{w: number, s: number}} o @param {number} sx @param {number} sz */
export function dragonSiteOk(o, sx, sz) {
  const [px, py] = mapPixelOfWire(sx, sz), c = pixelCentreNative(px, py);
  return gateLanePixelOk(dragonLaneOf(o), px, py) && sx === c.sx && sz === c.sz;
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
export const DRAGON_BRAIN_V = 2;
export const DRAGON_BRAIN_MIN = 2;   // DRAGON-HIDDEN: a game that rolls the old public salt is told to reload
