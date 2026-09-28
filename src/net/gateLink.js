// @ts-check
// WB3b (2026-09-25, Mac: "a gate of oblivion which takes place in a large boss arena with an oversized enemy with
// telegraphed attacks"): WHAT THE CLIENT HOLDS OF A GATE'S FIGHT - the relay's words (net/wire.js validGateOut, off the
// court's room or the hub) folded into one state: the boss's health, where he stands and walks, the attack in flight,
// his phase and shield, the kill and the wrath, and this account's receipt. The court draws from it (WB4 - the body,
// the telegraphs, the bar); the gate in the world reads its `fellAt` (a gate whose boss fell collapses on every screen).
//
// PURE in its fold (`foldGate`): a state and a word in, the next state out - the pins drive it as the session would.
// The link around it keeps the state, the falls by day (the hub's word reaches players who were nowhere near the
// court) and says a refusal in words once.
//
// Not a DFU member. Ledger A (WB).
import { readReceipt } from './gateReceipt.js';

/**
 * @typedef {{day: number|null, boss: string|null, phase: number, hp: number, max: number, x: number, z: number, yaw: number,
 *   move: any, atk: any, shieldUntil: number, wrathAt: number|null, fighters: number, fell: any, wrath: number|null, heardAt: number}} GateState
 */
/** The empty state: nothing heard yet. @type {Readonly<GateState>} */
export const GATE_STATE_EMPTY = Object.freeze({
  day: null, boss: null, phase: 1, hp: 0, max: 0, x: 0, z: 0, yaw: 0, move: null, atk: null, shieldUntil: 0,
  wrathAt: null, fighters: 0, fell: null, wrath: null, heardAt: 0,
});

/**
 * One word folded into the court's state. `st` replaces everything it names; the rest move their own fields; an
 * attack's word supersedes the one in flight (the relay's law - one attack at a time); a word from another day's
 * gate than the state's is not this fight's and changes nothing but a whole state (a new court).
 * AUDIT WBX F4: a walk's word ends the attack before it (the brain says `mv` only when none is in flight) - a charge
 * kept in the state held him drawn at its lane's end while he walked. AUDIT WBX F3: his fall freezes him WHERE HE FELL
 * (`place` at the kill's moment - the court's own bossPlace, which knows a charge's head and a leap's flight) - the
 * fold cleared the move and kept where the last word BEGAN, and the body, the spoils and the portal home stood at a
 * leap's or a charge's start, up to 30 m from him.
 * @param {Readonly<GateState>} s @param {any} g a validGateOut projection @param {number} now
 * @param {(s: Readonly<GateState>, now: number) => number[]} [place]
 * @returns {Readonly<GateState>}
 */
export function foldGate(s, g, now, place = bossAt) {
  if (!g) return s;
  if (g.k === 'st') {
    return { day: g.d, boss: g.b, phase: g.ph, hp: g.h, max: g.m, x: g.x, z: g.z, yaw: g.yw, move: g.mv, atk: g.atk, shieldUntil: g.sh, wrathAt: g.wr, fighters: g.n, fell: g.fell, wrath: g.wrath, heardAt: now };
  }
  if (s.day === null) return s;   // nothing but a whole state starts a fight
  switch (g.k) {
    case 'mv': return { ...s, atk: null, move: { x: g.x, z: g.z, tx: g.tx, tz: g.tz, v: g.v, at: g.at }, x: g.x, z: g.z, yaw: g.v > 0 ? Math.atan2(g.tx - g.x, g.tz - g.z) : s.yaw, heardAt: now };
    case 'atk': return { ...s, atk: { i: g.i, a: g.a, at: g.at, x: g.x, z: g.z, yw: g.yw, tg: g.tg }, move: null, x: g.x, z: g.z, yaw: g.yw, heardAt: now };
    case 'hp': return { ...s, hp: g.h, max: g.m, heardAt: now };
    case 'ph': return { ...s, phase: g.n, shieldUntil: g.until, heardAt: now };
    case 'wrath': return { ...s, wrath: g.at, atk: null, heardAt: now };
    case 'fell': {
      if (g.d !== undefined && g.d !== s.day) return s;
      if (s.fell) return { ...s, heardAt: now };   // said again (the hub's echo): he has already fallen where he fell
      const [x, z] = place(s, g.at);
      return { ...s, fell: { at: g.at, top: g.top, n: g.n }, x, z, hp: 0, atk: null, move: null, heardAt: now };
    }
    default: return s;
  }
}

/**
 * Where the boss stands at `now` (the relay's clock): his walk carried on from the last word, as the brain carries it
 * (net/gateBrain.js stepWalk) - the client draws him there between words.
 * @param {Readonly<GateState>} s @param {number} now
 */
export function bossAt(s, now) {
  const m = s.move;
  if (!m || !(m.v > 0)) return [s.x, s.z];
  const len = Math.hypot(m.tx - m.x, m.tz - m.z);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  return [m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along];
}

/** The gate refusals' words as the player reads them (net/wire.js GATE_NO_WORDS). */
export const GATE_NO_TEXT = Object.freeze({
  'the gate is closed': 'The gate is closed.',
  'the gate is sealed': 'The gate has sealed behind the ones inside.',
  'the gate is closing': 'The gate is closing - its master has fallen.',
  'the court is full': 'The Burning Court can hold no more.',
});

/** GATE-RELOAD (2026-09-26, volo on Discord: "the oblivion gate is bugged rn" - "you cant enter it" - "it kicks you out
 *  instantly"): what the room's refusal of my `in` MEANS when it says the gate is closed. The relay says that word in a
 *  `no` for one reason alone - AUDIT WBX R7, a game that does not know its brain's law (`bv` below GATE_BRAIN_MIN: a tab
 *  loaded before the relay's deploy, a desktop copy whose update waits for the app to quit) - while the gate stands open
 *  (a closed window is refused at the hello, as an `error`, and never gets this far). "The gate is closed." in front of
 *  an open gate sent the players back through it, and out again, and to Discord. */
export const GATE_OUTDATED_TEXT = 'Your game is older than this gate - save, then reload (or update the app) to enter.';
/** The words a refusal of my `in` (a `no`) is said and taken out of the court in. */
export const gateRefusalText = (word) => (word === 'the gate is closed' ? GATE_OUTDATED_TEXT : GATE_NO_TEXT[word] ?? word);

/**
 * The link: the state, the falls by day, the receipts by day, and the words said.
 * @param {{now: () => number, say?: (text: string) => void, onFell?: (day: number, fell: {at: number, top: string[], n: number}) => void, onReceipt?: (receipt: string) => void, onRefused?: (why: string) => void, place?: (s: Readonly<GateState>, now: number) => number[]}} deps
 *   `onReceipt` is told every receipt the relay hands this socket - the same one again after a reconnect or from the hub
 *   (WB5b: net/gateClaims.js carries it to the account service, and keeps one a day). AUDIT WB B5: `onRefused` is told
 *   the relay's refusal of my `in` (its word, net/wire.js GATE_NO_WORDS) - the court this player stands in is not theirs
 *   to fight in, and the host takes them out of it.
 */
export function createGateLink({ now, say = () => {}, onFell = () => {}, onReceipt = () => {}, onRefused = () => {}, place = bossAt }) {
  /** @type {Readonly<GateState>} */
  let state = GATE_STATE_EMPTY;
  const falls = new Map();     // day -> {at, top, n}
  const receipts = new Map();  // day -> the receipt (net/gateReceipt.js), keyed by the day it names
  return {
    /** A word from the court's room or the hub - the hub says a kill (of any day's gate) and a receipt, and the fold
     *  moves the court for a kill of its own day alone. */
    word(g) {
      if (!g) return;
      if (g.k === 'no') { say(gateRefusalText(g.m)); onRefused(g.m); return; }   // GATE-RELOAD: in what the word means
      if (g.k === 'rcpt') { const c = readReceipt(g.r); if (c) { receipts.set(c.d, g.r); onReceipt(g.r); } return; }   // one a day: the receipt says which
      if (g.k === 'fell') {
        const day = g.d ?? state.day;
        if (Number.isSafeInteger(day) && !falls.has(day)) { const f = { at: g.at, top: g.top, n: g.n }; falls.set(day, f); onFell(day, f); }
      }
      state = foldGate(state, g, now(), place);
    },
    /** The court's state now. */
    state: () => state,
    /** The relay's word of a day's kill, or null (the omen's `fellAt`). */
    fellAt: (day) => falls.get(day)?.at ?? null,
    /** A day's receipt, or null (WB5 rolls the spoils off its seed and carries it to the account service). */
    receipt: (day) => receipts.get(day) ?? null,
    /** Out of the court: its state forgotten (the falls and the receipts are kept - they outlive the court). */
    leave() { state = GATE_STATE_EMPTY; },
  };
}
