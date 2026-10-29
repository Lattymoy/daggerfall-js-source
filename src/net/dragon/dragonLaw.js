// @ts-check
// DRAGON2 (2026-10-29, the owner: "a new rare random world encounter, a sort of world boss when found anywhere in the
// world"; bible/11-Multiplayer/Dwarven-Dragon.md sections 2 and 4): THE DRAGON'S LAW - which watches bring a dragon down,
// which dragon is the Aetherbright, where its site is rolled and how its fight is named. A function of the relay's clock
// alone, so every client and the relay agree with no frame sent. The site is the client's to find over the world's own
// data (systems/dragon/dragonSite.js, the gate's scan); the relay never reads a map.
//
// Pure, and the relay's: it imports the gate's hash and the lanes that stand. Not a DFU member. Ledger A (DRAGON).
import { gateHash } from '../gate/gateLaw.js';
import { GATE_LANES_OPEN } from '../wire.js';

/** A watch of the real clock, ms; one in DRAGON_WATCH_ONE_IN brings a dragon down (about eight a day). */
export const DRAGON_WATCH_MS = 3_600_000;
export const DRAGON_WATCH_ONE_IN = 3;
/** When in its watch a dragon comes down, and how long it stays before it climbs away unslain, ms. */
export const DRAGON_LAND_AT_MS = 15 * 60_000;
export const DRAGON_STAY_MS = 40 * 60_000;
/** Its leaving - the climb out of sight - and its death's fall to the ground, ms. */
export const DRAGON_CLIMB_MS = 15_000;
/** One dragon in this many is the Aetherbright (section 11). */
export const DRAGON_SHINY_ONE_IN = 20;
/** The one salt every client rolls a dragon with. Changing it moves every dragon in the world. */
export const DRAGON_SALT = 0xd7a6;

/** Roll `k` of watch `w`, a whole number in [0, 2^32). */
export const dragonRoll = (w, k) => gateHash(DRAGON_SALT, w, k);
/** The watch a relay-clock instant stands in. */
export const dragonWatchAt = (nowMs) => Math.floor(nowMs / DRAGON_WATCH_MS);
/** Does watch `w` bring a dragon down? */
export const isDragonWatch = (w) => Number.isSafeInteger(w) && w >= 0 && dragonRoll(w, 0) % DRAGON_WATCH_ONE_IN === 0;
/** Is watch `w`'s dragon the Aetherbright? */
export const dragonShinyOf = (w) => dragonRoll(w, 1) % DRAGON_SHINY_ONE_IN === 0;
/** Its look's number, the receipt's `b` and the pose's `rc`: 0 the brass, 1 the Aetherbright. */
export const dragonLookOf = (w) => (dragonShinyOf(w) ? 1 : 0);

/** Watch `w`'s instants, relay-clock ms. @param {number} w */
export function dragonTimes(w) {
  const landAt = w * DRAGON_WATCH_MS + DRAGON_LAND_AT_MS;
  return { w, landAt, leaveAt: landAt + DRAGON_STAY_MS };
}
/** The dragon the clock is about at `nowMs`: this watch's until it has climbed away, else the next watch that brings
 *  one. @param {number} nowMs */
export function dragonAt(nowMs) {
  let w = dragonWatchAt(nowMs);
  if (isDragonWatch(w) && nowMs < dragonTimes(w).leaveAt + DRAGON_CLIMB_MS) return dragonTimes(w);
  for (let k = 0; k < 256 && !isDragonWatch(++w);) k++;
  return dragonTimes(w);
}
/** May a fight with watch `w`'s dragon begin now - from its landing until it climbs away? */
export const dragonAdmits = (w, nowMs) => { const t = dragonTimes(w); return isDragonWatch(w) && nowMs >= t.landAt && nowMs < t.leaveAt; };
/** May a fighter already in it be in it now (a reconnect after a blip) - until its climb is over? */
export const dragonHolds = (w, nowMs) => { const t = dragonTimes(w); return isDragonWatch(w) && nowMs >= t.landAt && nowMs < t.leaveAt + DRAGON_CLIMB_MS; };

// THE SITE. The gate's site law (systems/gate/gateSite.js findGateSite, theatreGateSite.js for a province) under a number of
// the dragon's own: DRAGON_SITE_BASE past every game day the gate will see for millennia and below the lanes' span, so no
// gate, star or Hollow ever names the same.
/** The gate site law's number for watch `w`'s site, on its lane's own day count. */
export const DRAGON_SITE_BASE = 50_000_000;
export const dragonSiteDay = (w) => DRAGON_SITE_BASE + (w % DRAGON_SITE_BASE);
/** Which theatre (the gate's lane) watch `w`'s dragon comes down in - any that stands. */
export const dragonLaneOf = (w) => GATE_LANES_OPEN[dragonRoll(w, 2) % GATE_LANES_OPEN.length];

/** Native units to the metre (wire.js PIXEL_UNITS over gateLaw.js PIXEL_M - pinned equal, serpentLaw.js's own). */
export const DRAGON_NATIVE_PER_M = 40;
/** A site's name: its native point to the whole unit (the serpent's AUDIT SERPENT S1 law - one fight a site). */
export const dragonSiteKey = (sx, sz) => `${Math.round(sx)},${Math.round(sz)}`;
/** A fight's id in its cell: the watch and the site. */
export const dragonFightId = (w, sx, sz) => `${w}@${dragonSiteKey(sx, sz)}`;
/** The most sites one cell keeps a fight for in a watch (a forged site stands a fight of its own - section 4). */
export const DRAGON_SITES_MAX = 3;

/** The brain's law a client fights by: the relay tells an older game to reload (the gate's GATE-RELOAD law). */
export const DRAGON_BRAIN_V = 1;
export const DRAGON_BRAIN_MIN = 1;
