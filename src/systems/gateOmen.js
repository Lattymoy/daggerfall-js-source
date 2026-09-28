// @ts-check
// WB1 (2026-09-25): THE OMEN - what the clock's gate says to one player: the chat's lines, the map's ring, the
// compass's mark. Design: bible/11-Multiplayer/World-Bosses.md sections 1-2.
//
// ONE CALL A FRAME from the online frame (scenes/world.js `gateFrame`, beside the chat's and the duel's - before the
// dead return, so the omen still speaks to a player on the death screen), and reads for the maps and the HUD.
// Everything here is a function of the RELAY'S clock (`now`), which the host reads through the welcome's offset
// (WORLD5); before the first welcome the offset is 0 and the machine's own clock stands in, as it does for the sky.
//
// EACH LINE IS SAID ONCE. The last moment announced is remembered by the gate's day and phase, so a frame that finds
// the same phase says nothing, and a player who arrives mid-gate hears the ONE line for where the gate stands now -
// "it opens in 2:30", not the omen, the rise and the countdown in a burst.
//
// THE SITE IS ASKED LAZILY: the scan over the map files (systems/gateSite.js) runs the first time a gate is in the
// omen or later, not at boot, and a host with no map data (a probe, a test) hands `site` a null and the omen stays
// silent rather than naming nowhere.
//
// Not a DFU member. Ledger A (WB).
import { gateAt, gatePhase, gateCountdown, countdownText, gateMarked, gateStands, gateBossOf, omenLine, riseLine, openLine, sealLine, wrathLine, GATE_OPEN_MINUTE, GATE_SEAL_MINUTE, GATE_DAY_MINUTES, GATE_COLLAPSE_MS, PIXEL_M } from '../net/gateLaw.js';
import { GATE_TOWN_MAX_PX } from './gateSite.js';

/** Is map pixel (px, py) within the omen's ring, give or take `slack` pixels? The compass carries the gate only here:
 *  inside the area the map drew, where the player has come looking. */
export const insideGateRing = (mark, px, py, slack = 1) => !!mark && Math.hypot(px + 0.5 - mark.cx, py + 0.5 - mark.cy) <= mark.r + slack;
/** The gate's spot in the SCENE's x/z: its pixel's translation (the streaming host's `pixelTranslation`, the pixel's
 *  south-west corner) plus the spot, [east, north] metres - spawned dungeons' own sum (scenes/world.js, the sight line). */
export const gateSceneXZ = (standing, t) => [t[0] + standing.spot[0], t[2] + standing.spot[1]];

// ═══ WBX8: THE SKY BURNS ═════════════════════════════════════════════════════════════════════════════════════════
// Mac (2026-09-26): "Improve the sky effect to be more like the /event dread command" - "When I say sky effect, I mean
// daggerfall, not the inside". The omen has always SAID it - "The sky burns over the wilds near ..." - and the sky over
// the site never did: the gate's only mark on it was its beacon. Now the sky over a gate wears the live event's dread
// (world/dreadSky.js: the crimson grade on the sky, its fog and the light the land stands in, the storm's deck) with
// the event's red storm gathered round the gate - not round the eye - so its lightning shows where the gate stands.
// A function of the relay's clock and the eye's distance from the site, so every player near a gate sees the same sky
// at the same moment; nothing is sent. The court (the inside) keeps the Deadlands' own sky (render/deadlands.js).
//
// ITS LIFE: the omen's first line kindles it (GATE_SKY_KINDLE of it within GATE_SKY_KINDLE_MS, so the line is true at
// once) and it deepens to GATE_SKY_OMEN by the rise, to GATE_SKY_RISEN by the opening, and whole within
// GATE_SKY_KINDLE_MS of it; open, sealed and until its end (the kill or the wrath) it burns whole; it clears as the gate
// collapses (GATE_COLLAPSE_MS) - the dread lifting as the event's does. Never a step: every stage walks from the last. ITS REACH: whole within GATE_SKY_FULL_M of the gate - the town it is reached from stands under it
// (gateSite.js GATE_TOWN_MAX_PX) - thinning to nothing at GATE_SKY_EDGE_M.
export const GATE_SKY_KINDLE = 0.35;
export const GATE_SKY_KINDLE_MS = 30_000;
export const GATE_SKY_OMEN = 0.6;
export const GATE_SKY_RISEN = 0.85;
export const GATE_SKY_FULL_M = Math.ceil((GATE_TOWN_MAX_PX + 1) * PIXEL_M);
export const GATE_SKY_EDGE_M = 12_000;
/** The gate's storm: its own schedule (a salt on the event's) and its reach round the gate - near strikes at the gate
 *  itself, far ones over the land round it (world/dreadSky.js dreadStrikes' ring). */
export const GATE_STORM_RING = Object.freeze({ salt: 0x6a7e5b1d, near: 120, split: 1400, far: 4500, nearShare: 0.55 });

const smooth01 = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

/**
 * How much the sky burns over a gate at `nowMs`, 0..1, by its life alone (its times `t`, the relay's word of its fall).
 * The end is gatePhase's own: a fall after the opening, or the wrath. Pure.
 * @param {{omenAt:number, riseAt:number, openAt:number, sealAt:number, wrathAt:number}|null} t
 * @param {number} nowMs
 * @param {number|null} [fellAt]
 */
export function gateSkyPhaseWeight(t, nowMs, fellAt = null) {
  if (!t || !Number.isFinite(nowMs) || nowMs < t.omenAt) return 0;
  if (nowMs < t.riseAt) {
    return GATE_SKY_KINDLE * smooth01((nowMs - t.omenAt) / GATE_SKY_KINDLE_MS) + (GATE_SKY_OMEN - GATE_SKY_KINDLE) * smooth01((nowMs - t.omenAt) / (t.riseAt - t.omenAt));
  }
  if (nowMs < t.openAt) return GATE_SKY_OMEN + (GATE_SKY_RISEN - GATE_SKY_OMEN) * smooth01((nowMs - t.riseAt) / (t.openAt - t.riseAt));
  const end = Number.isFinite(fellAt) && /** @type {number} */ (fellAt) >= t.openAt ? Math.min(/** @type {number} */ (fellAt), t.wrathAt) : t.wrathAt;
  const whole = GATE_SKY_RISEN + (1 - GATE_SKY_RISEN) * smooth01((nowMs - t.openAt) / GATE_SKY_KINDLE_MS);   // the opening burns it whole
  if (nowMs < end) return whole;
  return whole * (1 - smooth01((nowMs - end) / GATE_COLLAPSE_MS));
}

/** How much of a gate's sky reaches an eye `distM` metres from it, 0..1: whole within GATE_SKY_FULL_M, nothing past
 *  GATE_SKY_EDGE_M. Pure. */
export function gateSkyNear(distM) {
  if (!Number.isFinite(distM)) return 0;
  return 1 - smooth01((distM - GATE_SKY_FULL_M) / (GATE_SKY_EDGE_M - GATE_SKY_FULL_M));
}

/** The sky a gate burns over an eye `distM` metres off at `nowMs`: its life's weight by its reach. Pure. */
export const gateSkyWeight = (t, nowMs, fellAt, distM) => gateSkyPhaseWeight(t, nowMs, fellAt) * gateSkyNear(distM);

/** WB3b: the kill, said to everyone online (the hub's word): who stood where, and who struck hardest. */
export const fellLine = ({ near, boss, top }) => `${boss} has fallen at the Oblivion Gate near ${near}${top?.length ? ` - struck down by ${top.length > 1 ? `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}` : top[0]}` : ''}. The gate collapses.`;

/** The phases that say a line on arrival, and the line each says. */
const SAYS = Object.freeze({ omen: 'omen', rising: 'rise', sealed: 'rise', open: 'open', closed: 'seal', collapsing: 'wrath' });
/** AUDIT WB C4: the lines in the order a gate lives them - a line is said only past the last one said for its day, so a
 *  clock that steps back (the relay's offset arriving, a correction) never says one twice. */
const LINE_ORDER = Object.freeze(['omen', 'rise', 'open', 'seal', 'wrath']);
/** AUDIT WB C4: how long the omen holds its peace once its host is ready (the relay's clock read, the hub's welcome
 *  come) - the hub's word of a kill arrives just behind its welcome, and a gate said open before it would be wrong. */
export const OMEN_SETTLE_MS = 1500;

/**
 * `now` the relay-clock ms; `site` the day's site (gateSite.findGateSite), or null when there is no map data; `say` a
 * line on the chat (the host's chatNotice); `localTime` the real time a classic minute falls at on THIS machine
 * ("14:32"); `fellAt` the relay's word of the kill (WB3), null until it is said. AUDIT WB C4: `ready` whether the host
 * knows the relay's clock and has heard the hub (until then nothing is said and no gate stands - the machine's own
 * clock is not the world's), and `settleMs` how long past that the omen still holds (OMEN_SETTLE_MS in the game).
 * @param {{now: () => number, site: (day: number) => any, say: (text: string) => void, localTime?: (classicMinutes: number) => (string|null), fellAt?: (day: number) => (number|null), ready?: () => boolean, settleMs?: number}} deps
 */
export function createGateOmen({ now, site, say, localTime = () => null, fellAt = () => null, ready = () => true, settleMs = 0 }) {
  let saidDay = null, saidRank = -1;   // the day the last line was said for, and how far through its lines
  let readyAt = null, settled = false; // when the host was first ready (the relay's clock), and whether its settle is over
  let cache = { day: null, site: null };
  const siteOf = (day) => {
    if (cache.day !== day) cache = { day, site: site(day) ?? null };
    return cache.site;
  };
  const at = (day, minute) => localTime(day * GATE_DAY_MINUTES + minute) ?? '?';
  let current = null;

  return {
    /** One frame: the gate's state now, and its line if a new one is due. */
    frame() {
      if (!ready()) { readyAt = null; settled = false; current = null; return null; }
      if (!settled) {
        // a clock that steps back while the omen settles counts the wait from where it stands now; once settled, a
        // step never silences the gate again - only the host's losing the relay does
        if (readyAt == null || now() < readyAt) readyAt = now();
        if (now() - readyAt < settleMs) { current = null; return null; }
        settled = true;
      }
      const t = gateAt(now());
      const fell = fellAt(t.day);
      const phase = gatePhase(t, now(), fell);
      if (phase === 'quiet' || phase === 'gone') { current = { t, phase, site: null }; return current; }
      const s = siteOf(t.day);
      current = { t, phase, site: s };
      if (!s) return current;
      const line = SAYS[phase];
      // a gate collapsing because its boss FELL says no wrath: the relay's own line (WB3) said the fall
      const rank = LINE_ORDER.indexOf(line);
      if (line && (t.day !== saidDay || rank > saidRank) && !(line === 'wrath' && Number.isFinite(fell))) {
        saidDay = t.day; saidRank = rank;
        const words = { place: s.place, near: s.near, boss: gateBossOf(t.day).name };
        if (line === 'omen') say(omenLine({ ...words, at: at(t.day, GATE_OPEN_MINUTE) }));
        else if (line === 'rise') say(riseLine({ ...words, left: countdownText(t.openAt - now()) }));
        else if (line === 'open') say(openLine({ ...words, at: at(t.day, GATE_SEAL_MINUTE) }));
        else if (line === 'seal') say(sealLine(words));
        else if (line === 'wrath') say(wrathLine(words));
      }
      return current;
    },
    /** The gate as the last frame saw it: {t, phase, site}, or null before the first frame. */
    current: () => current,
    /** The map's mark while the omen stands: the ring (map pixels), the gate's name and its countdown's words. */
    mapMark() {
      const c = current;
      if (!c?.site || !gateMarked(c.phase)) return null;
      const cd = gateCountdown(c.t, now(), c.phase);
      const label = cd ? `Oblivion Gate - ${cd.to === 'open' ? 'opens' : 'seals'} in ${countdownText(cd.ms)}` : 'Oblivion Gate';
      return { day: c.t.day, cx: c.site.ring.cx, cy: c.site.ring.cy, r: c.site.ring.r, label, phase: c.phase };
    },
    /** WBX8: THE SKY THE GATE BURNS over an eye at `eye` (scene metres): its weight (gateSkyWeight - its life by its
     *  reach) and where the site stands in the scene (`x`, `z` - the storm gathers there), or null when no gate burns
     *  over it. From the omen on: the site is known before the gate stands. */
    sky(eye, pixelTranslation) {
      const c = current;
      if (!c?.site || !eye) return null;
      const [x, z] = gateSceneXZ(c.site, pixelTranslation(c.site.px, c.site.py));
      const weight = gateSkyWeight(c.t, now(), fellAt(c.t.day), Math.hypot(eye[0] - x, eye[2] - z));
      return weight > 0 ? { weight, x, z } : null;
    },
    /** Where the gate stands, for the compass and the gate's own pool (WB2): its pixel and its spot in it, its phase,
     *  its times and the relay's word of its fall (the pool times the rise and the collapse by them), while it stands. */
    standing() {
      const c = current;
      return c?.site && gateStands(c.phase) ? { day: c.t.day, px: c.site.px, py: c.site.py, spot: c.site.spot, phase: c.phase, t: c.t, fellAt: fellAt(c.t.day), near: c.site.near } : null;
    },
  };
}
