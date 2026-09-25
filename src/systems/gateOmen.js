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
import { gateAt, gatePhase, gateCountdown, countdownText, gateMarked, gateStands, gateBossOf, omenLine, riseLine, openLine, sealLine, wrathLine, GATE_OPEN_MINUTE, GATE_SEAL_MINUTE, GATE_DAY_MINUTES } from '../net/gateLaw.js';

/** Is map pixel (px, py) within the omen's ring, give or take `slack` pixels? The compass carries the gate only here:
 *  inside the area the map drew, where the player has come looking. */
export const insideGateRing = (mark, px, py, slack = 1) => !!mark && Math.hypot(px + 0.5 - mark.cx, py + 0.5 - mark.cy) <= mark.r + slack;
/** The gate's spot in the SCENE's x/z: its pixel's translation (the streaming host's `pixelTranslation`, the pixel's
 *  south-west corner) plus the spot, [east, north] metres - spawned dungeons' own sum (scenes/world.js, the sight line). */
export const gateSceneXZ = (standing, t) => [t[0] + standing.spot[0], t[2] + standing.spot[1]];

/** The phases that say a line on arrival, and the line each says. */
const SAYS = Object.freeze({ omen: 'omen', rising: 'rise', sealed: 'rise', open: 'open', closed: 'seal', collapsing: 'wrath' });

/**
 * `now` the relay-clock ms; `site` the day's site (gateSite.findGateSite), or null when there is no map data; `say` a
 * line on the chat (the host's chatNotice); `localTime` the real time a classic minute falls at on THIS machine
 * ("14:32"); `fellAt` the relay's word of the kill (WB3), null until it is said.
 * @param {{now: () => number, site: (day: number) => any, say: (text: string) => void, localTime?: (classicMinutes: number) => (string|null), fellAt?: (day: number) => (number|null)}} deps
 */
export function createGateOmen({ now, site, say, localTime = () => null, fellAt = () => null }) {
  let said = null;           // `${day}:${line}` - the last line said
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
      const t = gateAt(now());
      const fell = fellAt(t.day);
      const phase = gatePhase(t, now(), fell);
      if (phase === 'quiet' || phase === 'gone') { current = { t, phase, site: null }; return current; }
      const s = siteOf(t.day);
      current = { t, phase, site: s };
      if (!s) return current;
      const line = SAYS[phase];
      // a gate collapsing because its boss FELL says no wrath: the relay's own line (WB3) said the fall
      const key = `${t.day}:${line}`;
      if (line && said !== key && !(line === 'wrath' && Number.isFinite(fell))) {
        said = key;
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
    /** Where the gate stands, for the compass and the gate's own pool (WB2): its pixel and its spot in it, its phase,
     *  its times and the relay's word of its fall (the pool times the rise and the collapse by them), while it stands. */
    standing() {
      const c = current;
      return c?.site && gateStands(c.phase) ? { day: c.t.day, px: c.site.px, py: c.site.py, spot: c.site.spot, phase: c.phase, t: c.t, fellAt: fellAt(c.t.day), near: c.site.near } : null;
    },
  };
}
