// @ts-check
// STAR5/STAR6 (2026-10-20): THE STARFALL ON A PLAYER'S SCREEN, AS LAW - what the host (scenes/starfall/starfallHost.js)
// asks of a star before it draws, stands or says anything: where in its life the clock has it, where its coven stands,
// the word a player at it says to its cell, and the tracker's, the map's, the compass's and the timers' readings of it.
// Design: bible/11-Multiplayer/Starfall.md sections 3, 4, 5 and 8.
//
// Pure: every input an argument (the star's times, its ledger as the cell said it, this player's own record), every
// answer a value. Not a DFU member. Ledger A (STARFALL).
import { starTimes, starRoll, STAR_WAVES, STAR_LIGHT, STAR_LOW_LIGHT, P_FALLEN, P_GATHER, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST } from '../../net/starfall/starfallLaw.js';
import { STAR_CARD_TEXT, STAR_REGION_TEXT } from './starWords.js';
import { starMasterOf } from './starCoven.js';
import { covenWitches } from './starfallCovens.js';
import { heartStar } from './starfallNight.js';

/** A word is said from this near, and the coven sprung, stood and held from it (AUDIT STARFALL C2: one leash,
 *  scenes/starfall/starfallHost.js leashSlipped) - inside the relay's reach (net/starfall/starfallLaw.js STAR_REACH_M,
 *  60), so a pose a frame behind the feet is never refused at the edge (the rite's RITE_SAY_REACH_M). */
export const STAR_SAY_M = 55;
/** The tracker, the master's bar and the star's hum stand for a player this near. */
export const STAR_HUD_M = 400;
/** The ground shakes for a player this near a landing. */
export const STAR_SHAKE_M = 300;
/** The coven stands just past the crater's thrown earth (world/starfall/starModel.js STAR_BARE_R, 9.6 m): this far from
 *  the heart, its nearest and its farthest. STAR-TUNE (the owner: "The time between waves is too long"): 14 to 20 m, from
 *  25 to 35 - a wave stood that far out spent its first seconds walking in. */
export const STAR_STAND_R = Object.freeze([14, 20]);
/** STAR-TUNE: where a stand's rolls begin (starRoll's index): the ring's angle a wave's 32 from here, its radius 32 from
 *  200 past - clear of every other roll a star makes (its layout's under 100, its rosters' 300s, its circle's 500s, its
 *  ring's own 700 + w, its night's 900s). */
export const STAR_STAND_ROLLS = 1000;
/** A word that changed is said once more this long after - the relay's bucket may have dropped it (the rite's). */
export const STAR_RESAY_MS = 1000;
/** The master calls its circle this far out from itself. */
export const STAR_CIRCLE_R = 6;

/** Where in its life the clock has star (n, k) at `t` (relay ms): before its omen, the omen, the streak, fallen (its
 *  defense's time), after its end (held gold or lost dark, standing), gone. Pure. */
export function starClockPhase(n, k, t) {
  const T = starTimes(n, k);
  if (!(t >= T.omenAt)) return 'none';
  if (t < T.streakAt) return 'omen';
  if (t < T.fallAt) return 'streak';
  if (t < T.endAt) return 'fallen';
  if (t < T.goneAt) return 'after';
  return 'gone';
}

/** WHERE THE COVEN STANDS: `count` places on a ring STAR_STAND_R out from the heart, `[dx, dz, yaw]` - each its own roll
 *  (the star's, the wave's), every one facing the star. Pure. */
export function starStandPlaces(n, k, w, count) {
  const out = [];
  const a0 = (starRoll(n, k, 700 + w) / 4294967296) * 2 * Math.PI;
  for (let i = 0; i < count; i++) {
    // STAR-TUNE: each place's two rolls in blocks of their own, a wave's thirty-two apiece - a wave of twenty-four once
    // shared its rolls with the next wave's and with the radii (720 + 16w and 760 + 16w overlapped past sixteen)
    const a = a0 + (i / Math.max(1, count)) * 2 * Math.PI + ((starRoll(n, k, STAR_STAND_ROLLS + w * 32 + i) % 1000) / 1000 - 0.5) * 0.5;
    const r = STAR_STAND_R[0] + ((starRoll(n, k, STAR_STAND_ROLLS + 200 + w * 32 + i) % 1000) / 1000) * (STAR_STAND_R[1] - STAR_STAND_R[0]);
    const dx = Math.sin(a) * r, dz = Math.cos(a) * r;
    out.push([dx, dz, Math.atan2(-dx, -dz)]);
  }
  return out;
}
/** The circle's places about the master, `[dx, dz]` from it. Pure. */
export const starCirclePlaces = (count) => Array.from({ length: count }, (_, i) => { const a = (i / Math.max(1, count)) * 2 * Math.PI; return [Math.sin(a) * STAR_CIRCLE_R, Math.cos(a) * STAR_CIRCLE_R]; });

/**
 * THE WORD THIS PLAYER SAYS AT A STAR (net/wire.js validStarIn): its star and pixel, the level, and - from `mine` (this
 * player's own record of the star) - whether it struck one of its foes, whether it owns them, the wave it stood and is
 * counting (`kw`) and the deaths it saw of that wave (none without one: the cell credits them to that wave alone), the
 * wave it saw cleared, its foes' blows on the star, the master's fall. Pure.
 * @param {{ n: number, k: number, px: number, py: number }} star
 * @param {{ struck: boolean, own: boolean, kw?: number, kn: number, wc: number, hb: number, mf: boolean }} mine @param {number} level
 */
export const starWordOf = (star, mine, level) => {
  const kw = Math.max(0, Math.min(STAR_WAVES, mine.kw | 0));
  return {
    n: star.n, k: star.k, px: star.px, py: star.py, lv: Math.max(1, Math.min(60, level | 0)),
    s: mine.struck ? 1 : 0, o: mine.own ? 1 : 0, kw, kn: kw ? Math.max(0, Math.min(99, mine.kn | 0)) : 0, wc: Math.max(0, Math.min(STAR_WAVES, mine.wc | 0)),
    hb: Math.max(0, Math.min(9999, mine.hb | 0)), mf: mine.mf ? 1 : 0,
  };
};
/** A word's fields as a key, to say it again at once when it changes. */
export const starWordKey = (w) => `${w.s}.${w.o}.${w.kw}.${w.kn}.${w.wc}.${w.hb}.${w.mf}`;

/** The ledger's phase as the tracker says it - the master by its name. */
export function starPhaseLine(led, masterName) {
  if (!led) return STAR_CARD_TEXT.waits();
  switch (led.p) {
    case P_FALLEN: return STAR_CARD_TEXT.waits();
    case P_GATHER: return STAR_CARD_TEXT.gathers();
    case P_WAVE: return STAR_CARD_TEXT.wave(led.w, STAR_WAVES);
    case P_BREATH: return STAR_CARD_TEXT.breath();
    case P_MASTER: return masterName;
    case P_HELD: return STAR_CARD_TEXT.held();
    default: return STAR_CARD_TEXT.lost();
  }
}

/** "m:ss" for `ms` (never under 0:00). */
export const clockText = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/**
 * THE TRACKER'S READING of a star a player stands near: `{ title, near, coven, phase, light, low, left, heart }` - `light`
 * 0..1 (the ledger's, full before one is heard), `left` the time to its deadline. Pure.
 * @param {{ n: number, k: number, coven: any, near: string }} site @param {any} led the cell's `st`, or null
 * @param {number} t relay ms @param {string} masterName @param {boolean} [held] the hub said it held
 */
export function starTrackerModel(site, led, t, masterName, held = false) {
  const heart = heartStar(site.n, site.k), T = starTimes(site.n, site.k);
  const over = held || led?.p === P_HELD ? P_HELD : led?.p === P_LOST ? P_LOST : null;
  const lt = led ? led.lt : STAR_LIGHT;
  return {
    title: STAR_CARD_TEXT.name(heart),
    near: STAR_CARD_TEXT.near(site.near),
    coven: covenWitches(site.coven),
    phase: over === P_HELD ? STAR_CARD_TEXT.held() : over === P_LOST ? STAR_CARD_TEXT.lost() : starPhaseLine(led, masterName),
    light: over === P_LOST ? 0 : Math.max(0, Math.min(1, lt / STAR_LIGHT)),
    low: !over && lt <= STAR_LOW_LIGHT,
    left: over ? '' : STAR_CARD_TEXT.left(clockText(T.endAt - t)),
    heart,
    held: over === P_HELD,
  };
}

/** A held star's key, the hub's words' and the host's (night, star, pixel). */
export const starHeldKey = (n, s, px, py) => `${n}.${s}@${px},${py}`;

/**
 * THE MAP'S CARDS: one for each of the night's stars from its omen until it is gone - `{ key, px, py, label, tip }`
 * (ui/eventMapMarks.js's raid marks' shape). `held` the hub's word by starHeldKey (`{ top, c }`), `led` the cells' by
 * the same key; `localTime(ms)` the player's own clock. Pure.
 * @param {any[]} sites @param {number} t relay ms
 * @param {{ held?: Map<string, any>, led?: Map<string, any>, localTime?: (ms: number) => string }} [o]
 */
export function starMapMarks(sites, t, { held = new Map(), led = new Map(), localTime = () => '' } = {}) {
  const out = [];
  for (const s of sites ?? []) {
    const phase = starClockPhase(s.n, s.k, t);
    if (phase === 'none' || phase === 'gone') continue;
    const key = starHeldKey(s.n, s.k, s.px, s.py), h = held.get(key), l = led.get(key), T = starTimes(s.n, s.k);
    const title = STAR_CARD_TEXT.name(heartStar(s.n, s.k));
    const state = h ? STAR_CARD_TEXT.heldBy(h.top, h.c)
      : l?.p === P_LOST || phase === 'after' ? STAR_CARD_TEXT.lost()
        : phase === 'omen' ? STAR_CARD_TEXT.falls(localTime(T.fallAt))
          : phase === 'streak' ? STAR_CARD_TEXT.falling()
            : starPhaseLine(l, l ? starMasterOf(l.b, s.k).name() : '');
    out.push({ key, px: s.px, py: s.py, label: `${title}, ${s.near}`, tip: { title, lines: [STAR_CARD_TEXT.near(s.near), covenWitches(s.coven), state] } });
  }
  return out;
}

/**
 * THE TIMERS WINDOW'S ROWS (systems/eventTimers.js's `{ id, kind, title, where, detail, live, at, until }`): each star
 * fallen and still undecided, live to its deadline; and the next to fall, coming - its coven always (the night's), its
 * town from its omen on, as the region hears it. `decided(key)` the host's word that a star by starHeldKey is held or
 * lost. Pure.
 * @param {any[]} sites @param {number} t relay ms @param {(key: string) => boolean} [decided]
 */
export function starTimerRows(sites, t, decided = () => false) {
  const rows = [];
  let next = null;
  for (const s of sites ?? []) {
    const T = starTimes(s.n, s.k), heart = heartStar(s.n, s.k);
    if (T.fallAt <= t && t < T.endAt && !decided(starHeldKey(s.n, s.k, s.px, s.py))) {
      rows.push({ id: `star:${s.n}.${s.k}`, kind: 'star', title: STAR_CARD_TEXT.name(heart), where: STAR_CARD_TEXT.near(s.near), detail: STAR_CARD_TEXT.takes(), live: true, at: T.endAt, until: T.endAt });
    } else if (T.fallAt > t && (!next || T.fallAt < next.at)) next = { s, at: T.fallAt, omen: T.omenAt <= t, heart };
  }
  if (next) rows.push({ id: `star:${next.s.n}.${next.s.k}`, kind: 'star', title: STAR_CARD_TEXT.comes(next.heart), where: next.omen ? STAR_CARD_TEXT.near(next.s.near) : null, detail: STAR_CARD_TEXT.rite(covenWitches(next.s.coven)), live: false, at: next.at, until: null });
  return rows;
}

/** The region's line for a held star the hub said: its town where this screen found the night's stars, else none. */
export const starHeldLine = (site, top, c) => (site ? STAR_REGION_TEXT.held(site.near, top, c) : null);
