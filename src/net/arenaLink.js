// @ts-check
// ARENA4 (2026-10-02): WHAT THE CLIENT HOLDS OF THE ARENA ONLINE - the relay's words (net/arenaLaw.js validArenaOut)
// folded into two states: THE HALL (my place in the queue and its band, an offer and its clock, the bout I am sent to,
// the bouts to watch) and THE BOUT (a mirror of the relay's bout, in the bout law's own shape - systems/arenaBout.js - so
// the HUD, the crowd and the Herald read a bout the relay runs as they read one this screen runs). Design:
// bible/11-Multiplayer/Arena.md "7. Online".
//
// PURE: a state and a word in, the next state out (the hall), or a mirror moved in place and the events to hear handed
// back (the bout) - the pins drive both as the host does.
//
// THE RELAY'S CLOCK. A bout's times are the relay's (`Date.now()` on the relay); the mirror keeps them on THIS screen's
// clock by an offset learned from each event as it arrives (an event is said the moment it happens, so its `at` less
// the local now is the offset, give or take the wire) - the timer and the phases read the screen's own clock.
//
// Not a DFU member. Ledger A (ARENA).
import { newBout, BOUT_LIMIT_MS } from '../systems/arenaBout.js';
import { arenaBoutSeed } from './arenaBrain.js';

/** The hall when nothing has been heard. */
export const HALL_EMPTY = Object.freeze({ status: 'off', queue: 'idle', band: 0, n: 0, offer: null, go: null, live: [], said: null, heardAt: 0 });

/**
 * ONE HALL WORD folded: `qd` queued (the band, how many wait), `qx` out of the queue (why - `said`), `of` an offer (its
 * id, whom, its lapse on the relay's clock - kept on this screen's by `off`), `go` the bout is on, `live` the bouts to
 * watch. `status` is the host's (the link's socket). Pure.
 * @param {any} s @param {any} w a validArenaOut projection @param {number} now this screen's clock @param {number} [off] relay less local
 */
export function foldHall(s, w, now, off = 0) {
  if (!w) return s;
  switch (w.k) {
    case 'qd': return { ...s, queue: 'queued', band: w.band, n: w.n, offer: null, heardAt: now };
    case 'qx': return { ...s, queue: 'idle', offer: null, said: w.m, heardAt: now };
    // ARENA4b: a casual pair's offer and call carry `u` (net/arenaLaw.js validArenaOut) - the bout counts nowhere
    case 'of': return { ...s, queue: 'offer', offer: { o: w.o, vs: w.vs, until: w.until - off, casual: w.u === 1 }, said: null, heardAt: now };
    case 'go': return { ...s, queue: 'going', offer: null, go: { o: w.o, side: w.side, vs: w.vs, at: now, casual: w.u === 1 }, said: null, heardAt: now };
    case 'live': return { ...s, live: w.l, heardAt: now };
    default: return s;
  }
}

/** The bout phases a mirror moves to on an event of the same name. */
const PHASE_EVENTS = new Set(['call', 'walk', 'count', 'fight', 'end', 'verdict', 'heal', 'done']);
/** A fighter's way out, from the event that took it out. */
const OUT_EVENTS = new Set(['yield', 'fall', 'ringout']);

/**
 * THE MIRROR from a whole `st` word: the bout law's own state (newBout) with the relay's fighters, their health and
 * their outs, its phase, its fight's clock - `names(i, mobile)` naming the relay's own fighters by the bout's seed
 * (systems/arenaFighters.js fighterIdentity - every screen bills them alike). `prev` a mirror of the same bout keeps its
 * tallies. `off` the relay's clock less this screen's. Returns `{ b, me, kind, tier, bout, ai: [{ id, i, mobile }] }`.
 */
/**
 * @param {any} st @param {number} now
 * @param {{ prev?: any, off?: number, names?: (i: number, mobile: number) => any }} [o]
 */
export function mirrorOf(st, now, { prev = null, off = 0, names = () => null } = {}) {
  const seed = arenaBoutSeed(st.o);
  const fighters = st.f.map(([id, name, side, hp, max, out, ai, mob, tmp], k) => {
    const who = ai ? names(k - st.f.filter((x) => !x[6]).length, mob) : null;
    return { id, name: who?.name ?? name, side, maxHealth: max, health: hp, temper: tmp / 100, ai: !!ai, home: who?.home ?? '', epithet: who?.epithet ?? '', out: out || null, mob };
  });
  const b = prev?.b && prev.b.id === st.o ? prev.b : newBout({ id: st.o, kind: st.kind === 'pvp' ? 'pvp' : st.kind === 'ex' ? 'exhibition' : 'ladder', fighters, ring: { centre: [0, 0], radius: 14 }, now, limitMs: st.lim || BOUT_LIMIT_MS, tier: st.tier ?? 0 });   // ARENA4b: the hour's exhibition is the law's own kind
  b.events = [];
  for (const f of fighters) {
    const m = b.fighters.find((x) => x.id === f.id);
    if (!m) continue;
    m.name = f.name; m.home = f.home; m.epithet = f.epithet; m.maxHealth = f.maxHealth; m.health = f.health; m.out = f.out; m.ai = f.ai;
  }
  const ph = st.ph === 'wait' ? 'call' : st.ph === 'void' ? 'done' : st.ph;
  if (b.phase !== ph) { b.phase = ph; b.phaseAt = st.pa - off; }
  if (st.fa != null) b.fightAt = st.fa - off;
  if (st.res && !b.result) b.result = resultOf(b, st.res.side, st.res.how);
  return {
    b, me: st.me, kind: st.kind, tier: st.tier ?? null, bout: st.bout ?? null, seed, waiting: st.ph === 'wait', void: st.ph === 'void',
    ai: st.f.filter((x) => x[6]).map((x, i) => ({ id: x[0], i, mobile: x[7] })), spectators: st.sp,
  };
}
/** A result in the law's shape. */
function resultOf(b, side, how) {
  return { side, how, winners: side == null ? [] : b.fighters.filter((f) => f.side === side).map((f) => f.id), losers: b.fighters.filter((f) => f.side !== side).map((f) => f.id), judges: null };
}

/**
 * THE RELAY'S EVENTS on the mirror: each moved onto this screen's clock, the mirror moved as the law moved the relay's
 * bout (its phase, the fight's start and end, a fighter out, a blow's tallies), and handed back to be HEARD (the crowd,
 * the Herald, the verdict - scenes/arenaBouts.js `hear`). `clock` `{ off }` the offset, learned from each. Pure but for
 * the mirror and the clock it is handed.
 * @param {any} M a mirror (mirrorOf) @param {any[]} events @param {number} now @param {{ off: number|null }} clock
 */
export function mirrorEvents(M, events, now, clock) {
  const b = M?.b;
  const out = [];
  if (!b) return out;
  for (const e0 of events) {
    // the offset is the relay's time less mine at the event's arrival - a late word reads it low by its delay, so the
    // highest heard is the truest (the delay least), let down a little each word so a drift is followed
    clock.off = clock.off == null ? e0.at - now : Math.max(e0.at - now, clock.off - 5);
    const at = e0.at - clock.off;
    const e = { ...e0, at };
    if (PHASE_EVENTS.has(e.k) && b.phase !== e.k) { b.phase = e.k; b.phaseAt = at; }
    if (e.k === 'fight') { b.fightAt = at; b.lastBlowAt = at; }
    if (e.k === 'end') { b.endAt = at; if (!b.result) b.result = resultOf(b, e.side ?? null, e.how ?? ''); }
    if (e.k === 'verdict' && !b.result) b.result = resultOf(b, e.side ?? null, e.how ?? '');
    if (OUT_EVENTS.has(e.k)) { const f = b.fighters.find((x) => x.id === e.a); if (f && !f.out) { f.out = e.k; f.outAt = at; } }
    if (e.k === 'hit') { const f = b.fighters.find((x) => x.id === e.a); if (f) { f.dealt += e.dmg ?? 0; f.hits++; } b.lastBlowAt = at; }
    if (e.k === 'miss') { const f = b.fighters.find((x) => x.id === e.a); if (f) f.misses++; }
    out.push(e);
  }
  return out;
}

/** The `hp` word on the mirror: each fighter's health and whole. Answers my own `[health, max]` (null - not a fighter). */
export function mirrorHealth(M, h) {
  let mine = null;
  for (const [id, hp, max] of h) {
    const f = M?.b?.fighters.find((x) => x.id === id);
    if (f) { f.health = hp; f.maxHealth = max; }
    if (id === M?.me) mine = [hp, max];
  }
  return mine;
}

/** An AI fighter's place at `now` (this screen's clock) from its last walk word (relay times, less `off`) - the
 *  brain's own aiAt law, on this screen. */
export function walkAt(mv, now, off = 0) {
  if (!mv) return null;
  if (!(mv.v > 0)) return [mv.x, mv.z];
  const len = Math.hypot(mv.tx - mv.x, mv.tz - mv.z);
  if (len < 1e-6) return [mv.tx, mv.tz];
  const along = Math.min(len, (Math.max(0, now - (mv.at - off)) / 1000) * mv.v);
  return [mv.x + ((mv.tx - mv.x) / len) * along, mv.z + ((mv.tz - mv.z) / len) * along];
}
/** Whether a walk word's walk is done at `now`. */
export const walkDone = (mv, now, off = 0) => !mv || !(mv.v > 0) || (Math.max(0, now - (mv.at - off)) / 1000) * mv.v >= Math.hypot(mv.tx - mv.x, mv.tz - mv.z);

/** ARENA4b: THE VERDICT A RELAY'S WORD SAYS of its bout - a whole `st`'s result, or an `ev` word's end or verdict - as
 *  `{ side }` (0 / 1, null a draw), or null when the word says none. The bookmaker settles an exhibition's wager by it
 *  (scenes/arenaOnline.js exhibitionVerdict). Pure. */
export function verdictOfWord(w) {
  if (w?.k === 'st') return w.res ? { side: w.res.side ?? null } : null;
  if (w?.k === 'ev') { const e = (w.e ?? []).find((x) => x.k === 'end' || x.k === 'verdict'); return e ? { side: e.side ?? null } : null; }
  return null;
}
