// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): THE SIGHTING - what the clock's serpent says to
// one player: the chat's lines, the map's ring, the compass's mark. The gate's omen's twin (systems/gate/gateOmen.js).
// Design: bible/11-Multiplayer/Sea-Serpent.md section 2.
//
// ONE CALL A FRAME from the online frame (scenes/world.js), reads for the maps and the HUD. Everything is a function of
// the RELAY'S clock (`now` - the welcome's offset); before the host is ready (the relay's clock heard, the hub's
// welcome come - a kill said at the hello lands then) nothing is said, and for SERPENT_OMEN_SETTLE_MS after it.
//
// EACH LINE IS SAID ONCE, by the serpent's day and how far through its lines: a player who sails in mid-fight hears the
// one line for where it stands now (gateOmen.js AUDIT WB C4's law - a clock that steps back never says one twice).
// The kill's line is the HUB's word (the link's onFell, which names the place from this machine's own site); a serpent
// slain says no sounding.
//
// THE SITE IS ASKED LAZILY: the lanes' walk (systems/serpent/serpentSite.js) runs the first time a serpent is in its omen or
// later - SERPENT2: or online, from its quiet on (`ahead`, the site said to the hub for its Discord herald) - and a
// host with no map data hands `site` a null and the omen stays silent rather than naming nowhere - asking again every
// SITE_RETRY_MS (a site that throws is none), so a map loaded late still names it that day.
//
// Not a DFU member. Ledger A (SERPENT1).
import {
  serpentAt, serpentPhase, serpentCountdown, serpentCountdownWords, serpentClock, serpentMarked, serpentSwims, serpentBossOf,
  sightingLine, risingLine, sealLine, soundLine, SERPENT_RISE_MINUTE, SERPENT_SOUND_MINUTE, SERPENT_DAY_MINUTES,
} from '../../net/serpent/serpentLaw.js';

/** The phases that say a line on arrival, and the line each says. */
const SAYS = Object.freeze({ omen: 'omen', rising: 'rise', hunt: 'rise', late: 'seal', sounding: 'sound' });
const LINE_ORDER = Object.freeze(['omen', 'rise', 'seal', 'sound']);
/** How long the omen holds its peace once its host is ready (the hub's word of a kill arrives just behind its welcome). */
export const SERPENT_OMEN_SETTLE_MS = 1500;
/** A day's site that came back none (the map's data not loaded yet, the lanes not built) is asked again this often. */
export const SITE_RETRY_MS = 5000;
/** Is map pixel (px, py) within the omen's ring, give or take `slack` pixels - the compass carries the serpent only here. */
export const insideSerpentRing = (mark, px, py, slack = 1) => !!mark && Math.hypot(px + 0.5 - mark.cx, py + 0.5 - mark.cy) <= mark.r + slack;

/**
 * @param {{now: () => number, site: (day: number) => any, say: (text: string) => void, localTime?: (classicMinutes: number) => (string|null),
 *   fellAt?: (day: number, site: {sx: number, sz: number}) => (number|null), ready?: () => boolean, settleMs?: number}} deps
 *   `fellAt` the kill of THIS site's serpent (AUDIT SERPENT S1 - the hub says each site's; a forged one's is not mine)
 */
export function createSerpentOmen({ now, site, say, localTime = () => null, fellAt = () => null, ready = () => true, settleMs = 0 }) {
  let saidDay = null, saidRank = -1;
  let readyAt = null, settled = false;
  let cache = { day: null, site: null, at: -Infinity };
  const siteOf = (day) => {
    if (cache.day !== day || (!cache.site && now() - cache.at >= SITE_RETRY_MS)) {
      let s = null;
      try { s = site(day) ?? null; } catch { s = null; }
      cache = { day, site: s, at: now() };
    }
    return cache.site;
  };
  const at = (day, minute) => localTime(day * SERPENT_DAY_MINUTES + minute) ?? '?';
  let current = null;
  return {
    /** One frame: the serpent's state now, and its line if a new one is due. */
    frame() {
      if (!ready()) { readyAt = null; settled = false; current = null; return null; }
      if (!settled) {
        if (readyAt == null || now() < readyAt) readyAt = now();
        if (now() - readyAt < settleMs) { current = null; return null; }
        settled = true;
      }
      const t = serpentAt(now());
      // AUDIT SERPENT S1: the site first - its kill is the one that ends it early (a kill only ever brings `gone` sooner,
      // so the clock's own quiet and gone need no site)
      const bare = serpentPhase(t, now());
      if (bare === 'quiet' || bare === 'gone') { current = { t, phase: bare, site: null }; return current; }
      const s = siteOf(t.day);
      const phase = serpentPhase(t, now(), s ? fellAt(t.day, s) : null);
      if (phase === 'gone') { current = { t, phase, site: null }; return current; }
      current = { t, phase, site: s };
      if (!s) return current;
      const line = SAYS[phase];
      const rank = LINE_ORDER.indexOf(line);
      if (line && (t.day !== saidDay || rank > saidRank)) {
        saidDay = t.day; saidRank = rank;
        const words = { near: s.near, boss: serpentBossOf(t.day).name };
        if (line === 'omen') say(sightingLine({ ...words, near: s.place, at: at(t.day, SERPENT_RISE_MINUTE) }));
        else if (line === 'rise') say(risingLine({ ...words, left: serpentClock(t.soundAt - now()) }));   // SERPENT4: to its dive - its waters open till then
        else if (line === 'seal') say(sealLine({ ...words, at: at(t.day, SERPENT_SOUND_MINUTE) }));
        else if (line === 'sound') say(soundLine(words));
      }
      return current;
    },
    current: () => current,
    /** SERPENT2: the serpent the clock is about and its site, found AHEAD of its bells (from its quiet on, once the omen is
     *  ready) - what this game says to the hub, so the Discord herald's bells can name the place (net/serpent/serpentHerald.js).
     *  Null until then, or while no site is found. */
    ahead() {
      if (!settled) return null;
      const t = serpentAt(now());
      const s = siteOf(t.day);
      return s ? { day: t.day, site: s } : null;
    },
    /** AUDIT SERPENT L4: offline, nothing stands - no ring, no compass mark - until the omen is ready and settled again
     *  (its lines already said stay said). */
    reset() { current = null; readyAt = null; settled = false; },
    /** The map's mark while the omen stands: the ring (map pixels), its name and its countdown's words, its card. */
    mapMark() {
      const c = current;
      if (!c?.site || !serpentMarked(c.phase)) return null;
      const cd = serpentCountdown(c.t, now(), c.phase);
      const boss = serpentBossOf(c.t.day);
      const words = c.phase === 'slain' ? 'slain' : serpentCountdownWords(cd);
      const label = words ? `${boss.name} - ${words}` : boss.name;
      const [a, b] = c.site.between ?? [];
      const tip = { title: `${boss.name}, ${boss.title}`, lines: [`Off ${c.site.place}`, ...(a && b ? [`On the packet lane from ${a} to ${b}`] : []), ...(words ? [words[0].toUpperCase() + words.slice(1)] : [])] };
      return { day: c.t.day, cx: c.site.ring.cx, cy: c.site.ring.cy, r: c.site.ring.r, label, phase: c.phase, tip };
    },
    /** Where it swims, for the compass and the host: its site, its phase and its times, while it swims. */
    swimming() {
      const c = current;
      return c?.site && serpentSwims(c.phase) ? { day: c.t.day, site: c.site, phase: c.phase, t: c.t, fellAt: fellAt(c.t.day, c.site) } : null;
    },
  };
}
