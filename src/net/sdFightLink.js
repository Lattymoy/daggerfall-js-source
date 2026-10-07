// @ts-check
// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): WHAT THE PAGE HOLDS OF
// THE LAST MOMENT'S FIGHT - the realm's words (net/wire.js validSdOut's fight kinds) folded into one state, as
// net/gateLink.js folds a gate's: the Remnant's health and phase, where each body stands and walks (the Remnant, and in
// the Dragon Break the GOLD and SILVER Echoes), the blow each has in flight and the Hour's own, the Reset's Hearts, the
// stun, the fall and the loss. The arena's set draws from it (scenes/sdRemnant.js), the bar reads it (ui/sdRemnantBar.js).
//
// PURE in its fold (`foldSdFight`): a state and a word in, the next state out. The link around it keeps the state, says
// the fight's turns in words once each, and keeps MY PLACE IN IT: the realm counts me in only when it answers my `in`
// with the whole fight and `me` (SD8c - a guest's, a dead body's or an `in` from outside the arena is dropped unanswered,
// and a blow from one the fight does not hold is junk on the relay), so a blow of mine goes out only into a fight that
// answered me.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY, SD_REM, SD_REM_START, SD_ECHO_SPOTS, SD_PHASE_AT, SD_RESET_FIRST_MS, SD_RESET_EVERY_MS, keepInArena } from './sdRemnant.js';

/**
 * @typedef {{ x: number, z: number, yw: number, mv: {x: number, z: number, tx: number, tz: number, v: number, at: number}|null, atk: any }} SdBody
 * @typedef {SdBody & { h: number, m: number, up: number, dn: number }} SdEcho
 * @typedef {{ fi: number, s: number, ph: number, h: number, m: number, op: number, ou: number, rem: SdBody,
 *   ec: SdEcho[]|null, clk: any, pu: number, pa: number, ends: number, ended: number,
 *   cx: {i: number, m: number, c: number[][]}|null, su: number, stunAt: number, rk: number, n: number,
 *   fell: {at: number, top: string[], n: number, dm?: any}|null, lost: number, heardAt: number }} SdFightState
 *   `fi` the fight's number (0: none heard), `rem` the Remnant's body, `ec` the Echoes' (the Dragon Break's - each its
 *   health, its whole, when it stands and when it fell), `clk` the Hour's own blow in flight (the Pulse, the End), `cx`
 *   the Reset's Hearts ([x, z, health] each), `su` the stun's end and `stunAt` its moment, `rk` the next Reset.
 */
const STILL = Object.freeze({ x: SD_REM_START[0], z: SD_REM_START[1], yw: Math.PI, mv: null, atk: null });
/** AUDIT SD II (L4 F3): whether fight `s`'s Hour has ended at `now` - by the clock, as the law's (`ends`): the End's word
 *  (`ended`, said 2 s before it lands) stops the bodies, and a blow in its wind-up is still a blow. */
export const sdHourOver = (s, now) => !!s && s.ends > 0 && now >= s.ends;
/** The empty state: no fight heard. @type {Readonly<SdFightState>} */
export const SD_FIGHT_EMPTY = Object.freeze({
  fi: 0, s: 0, ph: 1, h: 0, m: 0, op: 0, ou: 0, rem: STILL, ec: null, clk: null, pu: 0, pa: 0, ends: 0, ended: 0,
  cx: null, su: 0, stunAt: 0, rk: 0, n: 0, fell: null, lost: 0, heardAt: 0,
});

/** How long the page waits for the realm's answer before it says its `in` again (and between two at most). */
export const SD_IN_RETRY_MS = 2000;

/** AUDIT SD II (L6 F7, SD11d): the Reset's Hearts' thread - its call and each Heart broken say it anew (the page's voice,
 *  scenes/sdVoice.js `key`): the newer count takes the older's place, never queued behind it. */
export const SD_HEARTS_KEY = 'hearts';
/** The realm's refusals (net/wire.js SD_NO_WORDS) as the player reads them; and the fight's turns, said once each. */
export const SD_FIGHT_TEXT = Object.freeze({
  no: Object.freeze({
    'the Hour has closed': 'The Hour has closed.',
    'the fight is over': 'The Last Moment is over.',
    'the arena is full': 'The arena is full.',
    'an older Hour': 'Your game is older than this Hour. Leave it, then reload or update the app to fight.',   // AUDIT SD II (L1 F5, L6 F12): it said "save" where the Hour refuses a save
  }),
  // AUDIT SD II (L6 F21, SD11d): WB13b's words - the event, then what to do; no dash asides, no shouted names, nothing
  // the bar already says (it was "The Remnant steps outside time - strike down the GOLD and SILVER Echoes together.")
  dragonBreak: 'The Dragon Break! Strike down the Gold and Silver Echoes together.',
  lastMoment: 'The Last Moment! The Remnant returns.',
  echoFell: (name, e) => `${name} fells the ${e === 0 ? 'Gold' : 'Silver'} Echo.`,
  echoRose: (e) => `The ${e === 0 ? 'Gold' : 'Silver'} Echo rises again!`,
  stunned: 'The Reset breaks! Strike now!',   // the bar says "Stunned - 8s"
  // AUDIT SD II (L6 F7): each Heart broken, said - the gate's crystals' words (gateCourt.js COURT_RECKON_TEXT.shattered)
  heartBroken: (who, left) => (left > 0 ? `${who || 'A fighter'} breaks a Heart. ${left} ${left === 1 ? 'remains' : 'remain'}.` : `${who || 'A fighter'} breaks the last Heart!`),
  lost: 'The Hour turns back. The Remnant waits.',
});
/** The refusals the page never says its `in` again after, this visit (the rest wait for another fight). */
const FOR_GOOD = Object.freeze(['the Hour has closed', 'an older Hour']);

/**
 * Where a body stands at `now` (the relay's clock): its walk carried on from the last word, as the law carries it
 * (net/sdRemnant.js stepWalk - kept within SD_REM.keep of the centre). Pure.
 * @param {SdBody|null|undefined} B @param {number} now @returns {[number, number]}
 */
export function sdBodyAt(B, now) {
  if (!B) return [STILL.x, STILL.z];
  const m = B.mv;
  if (!m || !(m.v > 0)) return [B.x, B.z];
  const len = Math.hypot(m.tx - m.x, m.tz - m.z);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  const p = keepInArena(m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along, SD_REM.keep);
  return [p[0], p[1]];
}
/** Whether a blow in flight is done by `now` - landed, its span and its stillness after spent (the law sends no word for
 *  its end). Pure. */
export function sdBlowDone(atk, now) {
  const A = atk ? SD_BLOW_BY_ID[atk.a] : null;
  return !A || now >= atk.at + A.active + A.recover;
}
/** The Reset's Hearts STANDING at `now`: its Hearts while the Reset they rose with still winds up - the law lets them go
 *  as it lands and says no word for it - else null. Pure. */
export function sdHeartsOf(s, now) {
  const a = s?.rem?.atk;
  return s?.cx && a && a.a === SD_BLOWS.reset.id && a.i === s.cx.i && now < a.at ? s.cx : null;
}
/** A body stopped where its walk had taken it by `at`, its walk and blow done with. */
const stopped = (B, at) => { const [x, z] = sdBodyAt(B, at); return { ...B, x, z, mv: null, atk: null }; };
/** A body as a whole state says it. */
const bodyOf = (B) => ({ x: B.x, z: B.z, yw: B.yw, mv: B.mv ?? null, atk: B.atk ?? null });
/** A walk's word on a body: where it set out, toward what, how fast - and a walk ends the blow before it. */
const walked = (B, w) => {
  const mv = w.v > 0 ? { x: w.x, z: w.z, tx: w.tx, tz: w.tz, v: w.v, at: w.at } : null;
  const turn = mv && Math.hypot(w.tx - w.x, w.tz - w.z) > 1e-6;
  return { ...B, x: w.x, z: w.z, mv, atk: null, yw: turn ? Math.atan2(w.tx - w.x, w.tz - w.z) : B.yw };
};
/** A blow's word on a body: it stands where it struck from, facing its aim. */
const struck = (B, w) => ({ ...B, x: w.x, z: w.z, yw: w.yw, mv: null, atk: atkOf(w) });
const atkOf = (w) => ({ b: w.b, i: w.i, a: w.a, at: w.at, x: w.x, z: w.z, yw: w.yw, tg: w.tg, ...(w.sw != null ? { sw: w.sw } : {}), ...(w.n != null ? { n: w.n } : {}) });
/** An Echo fresh at its spot (risen, or risen again), facing the way in. */
const echoAt = (e) => ({ x: SD_ECHO_SPOTS[e][0], z: SD_ECHO_SPOTS[e][1], yw: Math.PI, mv: null, atk: null });

/**
 * One word folded into the fight's state. `st` replaces everything it names (a new number is a fresh fight); the rest
 * move their own fields; a word before any whole state changes nothing. A walk ends a body's blow (the law says `mv`
 * only between blows); the turns move the bodies as the law does (the Dragon Break stops the Remnant where it stood;
 * the Last Moment stands it at the centre after the break); the stun stops it and clears the Hearts; the Hour's End stops
 * every body; the fall stops it WHERE IT FELL (its walk carried to the kill's moment).
 * @param {Readonly<SdFightState>} s @param {any} w a validSdOut fight projection @param {number} now
 * @returns {Readonly<SdFightState>}
 */
export function foldSdFight(s, w, now) {
  if (!w) return s;
  if (w.k === 'st') {
    const same = s.fi === w.fi;
    return {
      fi: w.fi, s: w.s, ph: w.ph, h: w.h, m: w.m, op: w.op, ou: w.ou, rem: bodyOf(w.rem),
      ec: w.ec ? w.ec.map((E) => ({ ...bodyOf(E), h: E.h, m: E.m, up: E.up, dn: E.dn })) : null,
      clk: w.clk ?? null, pu: w.pu, pa: w.pa, ends: w.ends, ended: w.ended,
      cx: w.cx ? { i: w.cx.i, m: w.cx.m, c: w.cx.c.map((q) => [q[0], q[1], q[2]]) } : null,
      su: w.su, stunAt: same && s.su === w.su ? s.stunAt : w.su ? now : 0, rk: w.rk, n: w.n, fell: w.fell ?? null, lost: w.lost, heardAt: now,
    };
  }
  if (!s.fi) return s;   // nothing but a whole state starts a fight
  switch (w.k) {
    case 'mv': {
      if (w.b === SD_BODY.remnant) return { ...s, rem: walked(s.rem, w), heardAt: now };
      const k = w.b - SD_BODY.gold;
      return s.ec?.[k] ? { ...s, ec: s.ec.map((E, j) => (j === k ? { ...E, ...walked(E, w) } : E)), heardAt: now } : s;
    }
    case 'atk': {
      if (w.b === SD_BODY.hour) {
        if (w.a !== SD_BLOWS.end.id || s.ended) return { ...s, clk: atkOf(w), heardAt: now };
        // THE HOUR ENDS - the law stops every body and says no word for it: each stopped where it stood as the End was
        // said (its wind-up before it lands - within a beat of the law's moment), the Hearts and the stun gone with it
        const at = w.at - SD_BLOWS.end.windup;
        return { ...s, clk: atkOf(w), ended: w.at, rem: stopped(s.rem, at), ec: s.ec ? s.ec.map((E) => ({ ...E, ...stopped(E, at) })) : null, cx: null, su: 0, heardAt: now };
      }
      if (w.b === SD_BODY.remnant) return { ...s, rem: struck(s.rem, w), heardAt: now };
      const k = w.b - SD_BODY.gold;
      return s.ec?.[k] ? { ...s, ec: s.ec.map((E, j) => (j === k ? { ...E, ...struck(E, w) } : E)), heardAt: now } : s;
    }
    case 'hp': return { ...s, h: w.h, m: w.m, heardAt: now };
    case 'ph':
      if (w.n === 2) return { ...s, ph: 2, rem: stopped(s.rem, w.at), heardAt: now };
      return { ...s, ph: 3, ec: null, ou: w.up, rem: { x: 0, z: 0, yw: Math.PI, mv: null, atk: null }, h: Math.min(s.h, SD_PHASE_AT[1] * s.m), rk: w.up + SD_RESET_FIRST_MS, heardAt: now };
    case 'ec': {
      const ec = w.e.map((t, k) => {
        const had = s.ec?.[k] ?? null;
        let B = !had || w.r === k ? echoAt(k) : had;
        if (had && w.d === k) B = stopped(B, w.at);   // fallen where it stood
        return { ...bodyOf(B), h: t[0], m: t[1], up: t[2], dn: t[3] };
      });
      return { ...s, ph: Math.max(2, s.ph), ec, heardAt: now };
    }
    case 'cx': return { ...s, cx: { i: w.i, m: w.m, c: w.c.map((q) => [q[0], q[1], w.m]) }, heardAt: now };
    case 'cxh': return s.cx && s.cx.i === w.i ? { ...s, cx: { ...s.cx, c: s.cx.c.map((q, k) => [q[0], q[1], Number.isFinite(w.h[k]) ? w.h[k] : q[2]]) }, heardAt: now } : s;
    case 'cxb': return s.cx && s.cx.i === w.i && s.cx.c[w.c] ? { ...s, cx: { ...s.cx, c: s.cx.c.map((q, k) => (k === w.c ? [q[0], q[1], 0] : q)) }, heardAt: now } : s;
    case 'stun': return { ...s, su: w.until, stunAt: w.at, rem: stopped(s.rem, w.at), cx: null, rk: w.until + SD_RESET_EVERY_MS, heardAt: now };
    case 'fell':
      if (s.fell) return w.dm && !s.fell.dm ? { ...s, fell: { ...s.fell, dm: w.dm }, heardAt: now } : { ...s, heardAt: now };
      return { ...s, fell: { at: w.at, top: w.top, n: w.n, ...(w.dm ? { dm: w.dm } : {}) }, rem: stopped(s.rem, w.at), h: 0, clk: null, cx: null, heardAt: now };
    case 'lost': return { ...s, lost: w.at, heardAt: now };
    default: return s;
  }
}

/**
 * The link: the fight's state, its turns said, and my place in it.
 * @param {{ now: () => number, say?: (text: string, key?: string) => void, onRefused?: (why: string) => void }} deps
 *   `now` the relay's clock; `say` a line over the screen (`key` its thread - SD_HEARTS_KEY); `onRefused` the realm's word
 *   refusing my `in`.
 */
export function createSdFightLink({ now, say = () => {}, onRefused = () => {} }) {
  /** @type {Readonly<SdFightState>} */
  let state = SD_FIGHT_EMPTY;
  /** my `in`: when it was last said, the fight the realm counted me in, and the refusal standing against it */
  let inAt = -Infinity, mine = 0;
  /** @type {{fi: number, lost: number, m: string}|null} */
  let refused = null;
  return {
    /** A word from the realm I stand in: its fight's, folded; a refusal said; the turns said once each. */
    word(w) {
      if (!w) return;
      if (w.k === 'no') {
        refused = { fi: state.fi, lost: state.lost, m: w.m };
        say(SD_FIGHT_TEXT.no[w.m] ?? w.m);
        onRefused(w.m);
        return;
      }
      const was = state;
      state = foldSdFight(state, w, now());
      if (w.k === 'st' && w.me === 1) { mine = state.fi; refused = null; }   // the realm's answer to my `in`: I am in this fight
      if (w.k === 'ph' && was.fi) say(w.n === 2 ? SD_FIGHT_TEXT.dragonBreak : SD_FIGHT_TEXT.lastMoment);
      else if (w.k === 'ec' && was.fi) { if (w.d != null && w.n) say(SD_FIGHT_TEXT.echoFell(w.n, w.d)); else if (w.r != null) say(SD_FIGHT_TEXT.echoRose(w.r)); }
      else if (w.k === 'stun' && was.fi) say(SD_FIGHT_TEXT.stunned);
      else if (w.k === 'cxb' && was.fi && was.cx?.i === w.i && (was.cx.c[w.c]?.[2] ?? 0) > 0) say(SD_FIGHT_TEXT.heartBroken(w.n, state.cx ? state.cx.c.filter((q) => q[2] > 0).length : 0), SD_HEARTS_KEY);   // AUDIT SD II (L6 F7): a Heart broken, by whom, and how many stand
      else if (w.k === 'lost' && was.fi && !was.lost) say(SD_FIGHT_TEXT.lost);
    },
    /** The fight's state now. */
    state: () => state,
    /** The relay's clock. */
    now: () => now(),
    /** Whether the realm has counted me in the fight it is fighting - a blow of mine may go out. */
    joined: () => state.fi > 0 && mine === state.fi && !state.lost && !state.fell && !sdHourOver(state, now()),   // AUDIT SD II (L4 F3): its End by the clock
    /** SD9e: whether the realm counted me in the fight it holds - fallen or not (its spoils' word, scenes/sdSpoils.js). */
    counted: () => state.fi > 0 && mine === state.fi,
    /**
     * Whether my `in` is due at `t`, standing alive in the arena: not counted in a fight still to fight (none heard, a
     * fight lost, or one that never answered me), no refusal standing against it (one for good; else one said while the
     * fight stood as it stands - a fresh fight or a loss lapses it), and its last saying SD_IN_RETRY_MS behind.
     */
    inDue(t) {
      if (refused && (FOR_GOOD.includes(refused.m) || (refused.fi === state.fi && refused.lost === state.lost))) return false;
      if (state.fi > 0 && !state.lost && (state.fell || state.ended || mine === state.fi)) return false;
      return t - inAt >= SD_IN_RETRY_MS;
    },
    /** My `in` left the socket at `t`. */
    sentIn(t) { inAt = t; },
    /** Out of the realm: its fight forgotten, my place in it and the refusals with it. */
    leave() { state = SD_FIGHT_EMPTY; inAt = -Infinity; mine = 0; refused = null; },
  };
}
