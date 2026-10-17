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
import { ATTACKS, nearestCourt, COURTS, hostAt } from './gateBrain.js';   // WB9b: the bound's word and the court it lands in; WB11b: where one of his host stands

/**
 * @typedef {{day: number|null, boss: string|null, phase: number, hp: number, max: number, x: number, z: number, yaw: number,
 *   move: any, atk: any, shieldUntil: number, wrathAt: number|null, fighters: number, fell: any, wrath: number|null, heardAt: number,
 *   md: ReadonlyArray<string>|null, fed: {ns: ReadonlyArray<string>, at: number}|null,
 *   xa: ReadonlyArray<number>, cx: {i: number, m: number, c: number[][], broke: ReadonlyArray<{c: number, n: string, at: number}>}|null,
 *   stunUntil: number, stunAt: number, rk: number, lg: GateHost|null, openUntil?: number}} GateState
 * @typedef {{ads: ReadonlyArray<{i: number, k: number, h: number, m: number, x: number, z: number, mv: any, atk: {at: number, x: number, z: number}|null, rose: number, yaw: number}>,
 *   gone: ReadonlyArray<{i: number, k: number, x: number, z: number, w: number, n: string|null, at: number}>, ward?: {n: number, at: number, is?: ReadonlyArray<number>}}} GateHost
 *   GATE-UX: `fell` carries `dm`, the kill's damage chart (net/gate/gateBrain.js damageChart), from a relay that makes one.
 *   WB8b: `md` his marks (net/gate/gateMods.js - the fight's profile is made from them, net/gate/gateBrain.js fightProfile), `fed`
 *   the last fallen challenger a Soul-Hungry Warden fed on (their name, the relay's moment). WB9b: `xa` the crossings'
 *   words (the walkways laid - net/gate/gateBrain.js walkFormed). WB9c: `cx` the Reckoning's crystals ({i, m, c: [[x, z, h]]}
 *   and who broke which), `stunUntil`/`stunAt` a broken Reckoning's stun, `rk` when the next Reckoning comes. WB11b:
 *   `lg` his host under the Legion-Lord (null in any other fight) - each one standing (`ads`: its number, kind, health
 *   and whole, spot and walk - net/gate/gateBrain.js hostAt carries it - its blow in flight, when it rose - -Infinity for
 *   one already risen when this screen came - and its facing) and the last few gone (`gone`: where, how - net/gate/gateBrain.js
 *   HOST_GONE - by whom, when), kept for the court to play out.
 */
/** The empty state: nothing heard yet. @type {Readonly<GateState>} */
export const GATE_STATE_EMPTY = Object.freeze({
  day: null, boss: null, phase: 1, hp: 0, max: 0, x: 0, z: 0, yaw: 0, move: null, atk: null, shieldUntil: 0,
  wrathAt: null, fighters: 0, fell: null, wrath: null, heardAt: 0, md: null, fed: null,
  xa: Object.freeze([]), cx: null, stunUntil: 0, stunAt: 0, rk: 0, lg: null, openUntil: 0,
});

/** WB11b: how many of his host gone the fold keeps for the court to play out (their fall, their crumbling). */
export const HOST_GONE_KEPT = 16;
/** WB11b: a host body's facing as it rises - into the court it stands in, from the rim the wave rises at. */
const facingIn = (x, z) => { const c = COURTS[nearestCourt(x, z)]; return Math.atan2(c[0] - x, c[1] - z); };
/** WB11b: HIS HOST AS A STATE SAYS IT (net/gate/gateBrain.js hostStateOf - every one standing) folded over what this screen
 *  held of the same fight: each one's rising and facing kept, its gone kept. Pure. */
function hostOfState(lg, prev) {
  if (!lg) return null;
  const ads = lg.map((t) => {
    const had = prev?.ads.find((a) => a.i === t[0]);
    const mv = t[8] > 0 ? { x: t[4], z: t[5], tx: t[6], tz: t[7], v: t[8], at: t[9] } : null;
    return { i: t[0], k: t[1], h: t[2], m: t[3], x: t[4], z: t[5], mv, atk: t[10] ? { at: t[10], x: t[11], z: t[12] } : null,
      rose: had ? had.rose : -Infinity, yaw: mv ? Math.atan2(mv.tx - mv.x, mv.tz - mv.z) : had ? had.yaw : facingIn(t[4], t[5]) };
  });
  // AUDIT WB11 C5/U3: the count of a wave of Ward-Bearers kept only while one of THAT wave stands - a state after a lost
  // socket kept the last court's ("3 of 4 stand" where three rose); without it the bar says how many stand
  const ward = prev?.ward && ads.some((a) => a.k === 2 && prev.ward.is?.includes(a.i)) ? prev.ward : null;
  return { ads, gone: prev?.gone ?? [], ...(ward ? { ward } : {}) };
}
/** WB11b: ONE WORD OF HIS HOST folded into the state's `lg` (its health, for a Sapper he drank) - its rising, its
 *  walks, its blows, its health, its gone. A word of a host this screen holds none of starts one (the relay says the
 *  rest in its next whole state). Pure. */
function foldHost(s, g, now) {
  const H = s.lg ?? { ads: [], gone: [] };
  switch (g.k) {
    case 'ad': return { ...s, lg: { ...H, ads: [...H.ads.filter((a) => !g.a.some((q) => q[0] === a.i)), ...g.a.map(([i, x, z]) => ({ i, k: g.w, h: g.m, m: g.m, x, z, mv: null, atk: null, rose: g.at, yaw: facingIn(x, z) }))],
      ...(g.w === 2 ? { ward: { n: g.a.length, at: g.at, is: g.a.map((q) => q[0]) } } : {}) }, heardAt: now };   // a Ward-Bearers' rising: how many hold his ward (and which - AUDIT WB11 C5)
    case 'amv': {
      const by = new Map(g.m.map((t) => [t[0], t]));
      return { ...s, lg: { ...H, ads: H.ads.map((a) => {
        const t = by.get(a.i);
        if (!t) return a;
        const mv = t[5] > 0 ? { x: t[1], z: t[2], tx: t[3], tz: t[4], v: t[5], at: t[6] } : null;
        return { ...a, x: t[1], z: t[2], mv, yaw: mv ? Math.atan2(mv.tx - mv.x, mv.tz - mv.z) : a.yaw };
      }) }, heardAt: now };
    }
    case 'aatk': {
      const by = new Map(g.a.map((t) => [t[0], t]));
      return { ...s, lg: { ...H, ads: H.ads.map((a) => { const t = by.get(a.i); return t ? { ...a, atk: { at: t[1], x: t[2], z: t[3] } } : a; }) }, heardAt: now };
    }
    case 'ah': {
      const by = new Map(g.h.map((t) => [t[0], t[1]]));
      return { ...s, lg: { ...H, ads: H.ads.map((a) => (by.has(a.i) ? { ...a, h: by.get(a.i) } : a)) }, heardAt: now };
    }
    case 'adie': {
      const out = [], ads = [];
      for (const a of H.ads) {
        if (!g.is.includes(a.i)) { ads.push(a); continue; }
        const [x, z] = hostAt(a, g.at);
        out.push({ i: a.i, k: a.k, x, z, w: g.w, n: g.n ?? null, at: g.at });
      }
      const gone = [...H.gone, ...out].slice(-HOST_GONE_KEPT);
      return { ...s, lg: { ...H, ads, gone }, ...(g.h != null ? { hp: g.h, max: g.m } : {}), heardAt: now };
    }
    default: return s;
  }
}

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
    // WB8b: the marks are the fight's; a feeding already heard is kept through a state of the same fight. WB9c: so are
    // the crystals already seen broken (a state names their health, not who broke them) and the stun's moment
    const same = s.day === g.d;
    const cx = g.cx ? { i: g.cx.i, m: g.cx.m, c: g.cx.c.map((q) => [q[0], q[1], q[2]]), broke: same && s.cx?.i === g.cx.i ? s.cx.broke : [] } : null;
    return {
      day: g.d, boss: g.b, phase: g.ph, hp: g.h, max: g.m, x: g.x, z: g.z, yaw: g.yw, move: g.mv, atk: g.atk, shieldUntil: g.sh, wrathAt: g.wr, fighters: g.n, fell: g.fell, wrath: g.wrath, heardAt: now, md: g.md ?? null, fed: same ? s.fed ?? null : null,
      xa: g.xa ?? [], cx, stunUntil: g.su ?? 0, stunAt: same && s.stunUntil === (g.su ?? 0) ? s.stunAt : (g.su ? now : 0), rk: g.rk ?? 0,
      lg: hostOfState(g.lg, same ? s.lg : null),   // WB11b: his host standing - none said, none held (any other fight's)
      openUntil: g.op ?? 0,   // WB13e: the opening's end - his wake (0: an older relay's word, and no wake)
    };
  }
  if (s.day === null) return s;   // nothing but a whole state starts a fight
  switch (g.k) {
    // WB9c: a walk, or another attack's word, and the Reckoning's crystals are done with (the relay grows them only with
    // its word, and spends them at its landing or its breaking - no word of their own says so)
    case 'mv': return { ...s, atk: null, move: { x: g.x, z: g.z, tx: g.tx, tz: g.tz, v: g.v, at: g.at }, x: g.x, z: g.z, yaw: g.v > 0 ? Math.atan2(g.tx - g.x, g.tz - g.z) : s.yaw, heardAt: now, cx: null };
    // AUDIT WB9 (brain F3): the Wrath's word ends a stun as the relay ends it (net/gate/gateBrain.js - "the midnight overtakes a
    // Reckoning and a stun alike"); no other attack begins under one
    case 'atk': return { ...s, atk: { i: g.i, a: g.a, at: g.at, x: g.x, z: g.z, yw: g.yw, tg: g.tg }, move: null, x: g.x, z: g.z, yaw: g.yw, heardAt: now, cx: s.cx && s.cx.i === g.i ? s.cx : null, ...(g.a === ATTACKS.wrath.id ? { stunUntil: 0 } : {}), ...crossLaid(s, g) };
    case 'hp': return { ...s, hp: g.h, max: g.m, heardAt: now };
    case 'ph': return { ...s, phase: g.n, shieldUntil: g.until, heardAt: now };
    case 'wrath': return { ...s, wrath: g.at, atk: null, heardAt: now, lg: s.lg ? { ...s.lg, ads: [] } : null };   // WB11b: his host is gone with the court
    case 'fed': return { ...s, hp: g.h, max: g.m, fed: { ns: g.ns, at: g.at }, heardAt: now };   // WB8b: the health his feeding left, and who fed him (AUDIT PRE-MERGE 0929 W1-3: every one of the beat's)
    // WB9c: THE CRYSTALS - grown whole at the Reckoning's word, their health as it falls, each one broken (and by whom),
    // and the Reckoning broken: he is stunned and the crystals are gone. A word of another Reckoning's crystals is not these.
    case 'cx': return { ...s, cx: { i: g.i, m: g.m, c: g.c.map((q) => [q[0], q[1], g.m]), broke: [] }, heardAt: now };
    case 'cxh': return s.cx && s.cx.i === g.i ? { ...s, cx: { ...s.cx, c: s.cx.c.map((q, k) => [q[0], q[1], Number.isFinite(g.h[k]) ? g.h[k] : q[2]]) }, heardAt: now } : s;
    case 'cxb': return s.cx && s.cx.i === g.i && s.cx.c[g.c] ? { ...s, cx: { ...s.cx, c: s.cx.c.map((q, k) => (k === g.c ? [q[0], q[1], 0] : q)), broke: [...s.cx.broke, { c: g.c, n: g.n, at: g.at }] }, heardAt: now } : s;
    // (the stun keeps the crystals, every one broken - who broke the last is said with it; the next word clears them)
    case 'stun': return { ...s, stunUntil: g.until, stunAt: g.at, atk: null, move: null, cx: s.cx ? { ...s.cx, c: s.cx.c.map((q) => [q[0], q[1], 0]) } : null, heardAt: now };
    // WB11b: HIS HOST - risen, walking, striking, its health, gone
    case 'ad': case 'amv': case 'aatk': case 'ah': case 'adie': return foldHost(s, g, now);
    case 'fell': {
      if (g.d !== undefined && g.d !== s.day) return s;
      // said again (the hub's echo): he has already fallen where he fell - GATE-UX: the court's word may bring the damage
      // chart the hub's never carries, whichever came first
      if (s.fell) return g.dm && !s.fell.dm ? { ...s, fell: { ...s.fell, dm: g.dm }, heardAt: now } : { ...s, heardAt: now };
      const [x, z] = place(s, g.at);
      return { ...s, fell: { at: g.at, top: g.top, n: g.n, ...(g.dm ? { dm: g.dm } : {}) }, x, z, hp: 0, atk: null, move: null, heardAt: now, lg: s.lg ? { ...s.lg, ads: [] } : null };   // WB11b: his host goes with him
    }
    default: return s;
  }
}

/** WB9b: A BOUND'S WORD LAYS ITS WALKWAY on every screen that hears it - the walkway into the court it lands in, from
 *  the word's own moment (its landing less its wind-up: the relay's `xa`, net/gate/gateBrain.js beginTurn), so the stones
 *  rise here as they rise on the relay's clock without waiting for the next whole state. Pure; `{}` for any other word. */
export function crossLaid(s, g) {
  if (g.a !== ATTACKS.cross.id || !g.tg?.[0]) return {};
  const k = nearestCourt(g.tg[0][0], g.tg[0][1]) - 1;
  if (!(k >= 0) || Number.isFinite(s.xa?.[k])) return {};
  const xa = [...(s.xa ?? [])];
  // AUDIT WB9 (brain F5): every walkway up to the court he bounds to, as the relay lays them (net/gate/gateBrain.js beginTurn)
  // - a fight woken from a checkpoint older than WB9 bounds from the first court straight to the third
  for (let j = 0; j <= k; j++) if (!Number.isFinite(xa[j])) xa[j] = g.at - ATTACKS.cross.windup;
  return { xa };
}

/**
 * Where the boss stands at `now` (the relay's clock): his walk carried on from the last word, as the brain carries it
 * (net/gate/gateBrain.js stepWalk) - the client draws him there between words.
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
  'the gate is sealed': 'The gate has sealed.',   // WB13b: the event, then stop
  'the gate is closing': 'The Warden has fallen. The gate is closing.',
  'the court is full': 'The Burning Court is full.',
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
 *   (WB5b: net/gate/gateClaims.js carries it to the account service, and keeps one a day). AUDIT WB B5: `onRefused` is told
 *   the relay's refusal of my `in` (its word, net/wire.js GATE_NO_WORDS) - the court this player stands in is not theirs
 *   to fight in, and the host takes them out of it.
 */
export function createGateLink({ now, say = () => {}, onFell = () => {}, onReceipt = () => {}, onRefused = () => {}, place = bossAt }) {
  /** @type {Readonly<GateState>} */
  let state = GATE_STATE_EMPTY;
  const falls = new Map();     // day -> {at, top, n}
  const receipts = new Map();  // day -> the receipt (net/gate/gateReceipt.js), keyed by the day it names
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
