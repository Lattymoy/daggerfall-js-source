// @ts-check
// ═════════════════════════════════════════════════════════════════════
// INT8 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): THE DUEL REFEREED - "a duel is the Royal Tourney's ring without its title".
//
// DUEL1 left every blow to the defender's own machine and every result to the loser's own word: a client that never
// took damage never fell, and one that never said it lost never did. Now the relay that routes the duel holds it:
//
//   - THE HANDSHAKE IS WATCHED, NOT CHANGED. The challenger's `ask`, the challenged's `yes` and the challenger's `start`
//     still ride between the two (net/duelSession.js); the relay notes each as it passes, and a `start` it can set a bout
//     on is the only one it routes - both fighters asked and answered with the same duel's id, within their windows,
//     neither in a bout, the ring's centre within the ring of both bodies. Else the challenger hears `no`.
//   - THE BOUT is the Royal Tourney's (net/siegeRef.js ROYAL_RING - DUEL1's own ring, pinned equal): both fighters whole
//     at the referee's vitality (300 + 2 x the Renown the token signed), DUEL1's countdown, its longest (then a draw).
//   - EVERY BLOW AND CAST between the two is the referee's (refereeBlow, refereeCast): a strike's damage claimed by its
//     striker, clipped to the weapon its look holds and the arms its token signs (INT7), within reach of both fighters'
//     last believed places; a cast three a five seconds, each to sixty; no heal between them. Nothing else is routed: the
//     defender resolves nothing, and its save's health is never touched.
//   - THE PLACE: a fighter's pose is believed only at a run the referee allows (refereeStep - a teleport is not where it
//     stands for reach); past the ring's edge and its slack DUEL_OUT_MS, it has left the ring - and lost.
//   - THE END: a fall (the referee's vitality at none), a yield, a fighter's own word that it is out (gone indoors,
//     fallen to something else, left) - each the SENDER's loss, once the countdown has run (before it, a cancel that
//     names nobody); a fighter gone from the room ROYAL_RING.goneMs loses by walkover; the clock's end is a draw. A bout
//     won names its winner in a signed receipt both fighters are handed (net/duelReceipt.js `d1`) - the account service
//     counts it once; the loser's own report retires.
//
// Pure: no clock (every `now` an argument), no socket, no storage - the relay's room (server/src/index.js) keeps the
// state in its memory (DECIDED: a room that restarts mid-bout - a deploy - ends it as a cancel, recording nothing).
// ═════════════════════════════════════════════════════════════════════
import { ROYAL_RING, SIEGE_UNITS_PER_M, SIEGE_HIT, newFighter, refereeBlow, refereeCast, refereeStep } from './siegeRef.js';

/** DUEL1's own numbers the ring does not carry (net/duelSession.js DUEL_START_WAIT_MS, DUEL_OUT_MS - pinned equal: this
 *  leaf imports no client module). */
export const DUEL_REF = Object.freeze({ startWaitMs: 8000, outMs: 2000 });
/** The most bouts and notes a room keeps - its peers' own bound, generously (a note is an ask or a yes on its way). */
export const DUEL_REF_BOUTS_MAX = 64;
export const DUEL_REF_NOTES_MAX = 256;
/** A cast's kind on the wire's referee word (SIEGE_HIT's own): a swing, a shaft, a spell. */
export const DUEL_REF_KIND = SIEGE_HIT;

/** A room's duels: the notes of asks and answers on their way, the bouts on, and which bout each account fights. */
export const newDuelRef = () => ({ asks: new Map(), yes: new Map(), bouts: new Map(), of: new Map() });
const noteKey = (from, to) => `${from}>${to}`;
const prune = (map, now, ttl) => {
  for (const [k, v] of map) if (now - v.at > ttl) map.delete(k);
  while (map.size > DUEL_REF_NOTES_MAX) map.delete(map.keys().next().value);
};

/** An ASK (`from` asks `to`, accounts, duel id `s`) or a YES (`from` takes `to`'s ask) noted as it passes the relay. */
export function duelNote(st, kind, from, to, s, now) {
  if (!from || !to || from === to || typeof s !== 'string') return;
  const map = kind === 'ask' ? st.asks : kind === 'yes' ? st.yes : null;
  if (!map) return;
  prune(st.asks, now, ROYAL_RING.askMs + DUEL_REF.startWaitMs);
  prune(st.yes, now, DUEL_REF.startWaitMs);
  map.set(noteKey(from, to), { s, at: now });
}

/** The ground metres between a world-frame pose (`{ x, y, z }`, natives on x and z) and a ring's centre (`[x, y, z]`). */
const fromCentre = (p, c) => Math.hypot((p.x - c[0]) / SIEGE_UNITS_PER_M, (p.z - c[2]) / SIEGE_UNITS_PER_M);
const poseOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.z);

/**
 * A START - `a` the challenger, `b` the challenged (`{ sub, id, pose, lv }` each, the relay's own: the verified account,
 * the socket's id, its last pose, the Renown its token signed), `s` the duel's id, `c` the ring's centre - SETS A BOUT
 * when the relay saw `a` ask `b` and `b` take it, with this id, within their windows; neither fights another bout; both
 * bodies stand within the ring. `n` the bout's id (twelve hex, the relay's). Answers `{ bout }` or `{ no }` (a DUEL_WHY
 * word: 'timeout' - the handshake was never seen, or has lapsed; 'busy'; 'range').
 */
export function duelOpen(st, { a, b, s, c, n }, now) {
  const ask = st.asks.get(noteKey(a?.sub, b?.sub)), yes = st.yes.get(noteKey(b?.sub, a?.sub));
  if (!ask || !yes || ask.s !== s || yes.s !== s || now - ask.at > ROYAL_RING.askMs + DUEL_REF.startWaitMs || now - yes.at > DUEL_REF.startWaitMs) return { no: 'timeout' };
  if (st.of.has(a.sub) || st.of.has(b.sub) || st.bouts.size >= DUEL_REF_BOUTS_MAX || st.bouts.has(s)) return { no: 'busy' };
  if (!Array.isArray(c) || c.length !== 3 || !c.every(Number.isFinite) || !poseOk(a.pose) || !poseOk(b.pose)) return { no: 'range' };
  if (fromCentre(a.pose, c) > ROYAL_RING.radiusM || fromCentre(b.pose, c) > ROYAL_RING.radiusM) return { no: 'range' };
  st.asks.delete(noteKey(a.sub, b.sub)); st.yes.delete(noteKey(b.sub, a.sub));
  const side = (x) => ({ sub: x.sub, id: x.id, f: newFighter(x.lv, now), pose: { ...x.pose }, poseAt: now, outAt: null, goneAt: null });
  const startMs = now + ROYAL_RING.countdownMs;
  const bout = { s, n, c: [c[0], c[1], c[2]], a: side(a), b: side(b), startMs, endMs: startMs + ROYAL_RING.boutMs };
  st.bouts.set(s, bout);
  st.of.set(a.sub, s); st.of.set(b.sub, s);
  return { bout };
}

/** The bout `sub` fights, or null. */
export const duelBoutOf = (st, sub) => { const s = st.of.get(sub); return s ? st.bouts.get(s) ?? null : null; };
/** A bout's two sides as `[mine, theirs]` for `sub`, or null. */
const sidesOf = (bout, sub) => (bout?.a.sub === sub ? [bout.a, bout.b] : bout?.b.sub === sub ? [bout.b, bout.a] : null);
/** The fighters' vitality, as the referee's word says it: `[[id, hp, max], [id, hp, max]]`, the challenger first. */
export const duelVitals = (bout) => [bout.a, bout.b].map((x) => [x.id, Math.max(0, x.f.hp), x.f.max]);

/**
 * A BLOW OR A CAST of `sub`'s at the socket `to` (its opponent's id): judged by the referee once the countdown has run and
 * before the clock's end - a strike (`r` a swing or a shaft) on the weapon `held` its look carries and the arms `wa` its
 * token signs (siegeRef.js refereeBlow), a cast (`r` SIEGE_HIT.Spell) to its harm's most and rate (refereeCast, never a
 * heal). Answers `{ ok, dealt, fell, bout, why }` - the vitality moved, a fall at none left.
 * @param {any} st @param {string} sub @param {string} to
 * @param {{ d?: number, r?: number, held?: any, wa?: any }} o
 * @param {number} now
 */
export function duelBlow(st, sub, to, { d = 0, r = SIEGE_HIT.Melee, held = null, wa = null } = {}, now) {
  const bout = duelBoutOf(st, sub), sides = sidesOf(bout, sub);
  if (!bout || !sides) return { ok: false, dealt: 0, fell: false, bout: null, why: 'no-bout' };
  const [me, them] = sides;
  if (them.id !== to) return { ok: false, dealt: 0, fell: false, bout, why: 'not-opponent' };
  if (now < bout.startMs || now >= bout.endMs) return { ok: false, dealt: 0, fell: false, bout, why: 'not-live' };
  const res = r === SIEGE_HIT.Spell
    ? refereeCast(me.f, them.f, { from: me.pose, at: them.pose, d }, now)
    : refereeBlow(me.f, them.f, { from: me.pose, at: them.pose, held, d, r, wa }, now);
  return { ok: res.ok, dealt: res.dealt, fell: res.fell, bout, why: res.why };
}

/**
 * A FIGHTER'S POSE (`p` world-frame, `{ x, y, z }`): believed for reach only at a run the referee allows (refereeStep, on
 * the fighter's own carried allowance - a step it refuses leaves the last believed place standing); past the ring's edge
 * and its slack, the time it left is kept (duelStep ends the bout on it). Answers whether `sub` fights a bout.
 */
export function duelPose(st, sub, p, now) {
  const bout = duelBoutOf(st, sub), me = sidesOf(bout, sub)?.[0];
  if (!bout || !me || !poseOk(p)) return false;
  if (refereeStep(me.pose, p, now - me.poseAt, me.f)) { me.pose = { x: p.x, y: Number.isFinite(p.y) ? p.y : 0, z: p.z }; me.poseAt = now; }
  if (fromCentre(p, bout.c) > ROYAL_RING.radiusM + ROYAL_RING.outSlackM) me.outAt ??= now; else me.outAt = null;
  return true;
}

/** A BOUT ENDED: `winner` the winning account (null: a draw, or a cancel during the countdown), `why` its DUEL_WHY word.
 *  The bout forgotten; answers `{ s, n, f: [challenger, challenged], ids, w, why }` - `w` 0 or 1 (the winner's place in
 *  `f`), null for none. */
export function duelEnd(st, bout, winner, why) {
  st.bouts.delete(bout.s);
  if (st.of.get(bout.a.sub) === bout.s) st.of.delete(bout.a.sub);
  if (st.of.get(bout.b.sub) === bout.s) st.of.delete(bout.b.sub);
  const w = winner === bout.a.sub ? 0 : winner === bout.b.sub ? 1 : null;
  return { s: bout.s, n: bout.n, f: [bout.a.sub, bout.b.sub], ids: [bout.a.id, bout.b.id], w, why };
}

/** A FIGHTER'S OWN WORD that it is out (a yield, gone indoors, fallen to something else, left): before the countdown has
 *  run, the bout called off; after it, the sender's loss ('yield' for a yield, else 'left'). Null when `sub` fights none. */
export function duelForfeit(st, sub, why, now) {
  const bout = duelBoutOf(st, sub), sides = sidesOf(bout, sub);
  if (!bout || !sides) return null;
  if (now < bout.startMs) return duelEnd(st, bout, null, 'cancelled');
  return duelEnd(st, bout, sides[1].sub, why === 'yield' ? 'yield' : 'left');
}

/**
 * ONE BEAT OF A ROOM'S DUELS (the relay calls it on the frames its fighters send - no alarm): the clock's end a draw; a
 * fighter past the ring's edge DUEL_REF.outMs has left it (its loss); a fighter whose socket is gone (`here(sub)` false)
 * ROYAL_RING.goneMs loses by walkover - both gone, a draw. Answers the bouts ended (duelEnd's).
 */
export function duelStep(st, here, now) {
  const out = [];
  for (const bout of [...st.bouts.values()]) {
    if (now >= bout.endMs) { out.push(duelEnd(st, bout, null, 'draw')); continue; }
    for (const x of [bout.a, bout.b]) { if (here(x.sub)) x.goneAt = null; else x.goneAt ??= now; }
    const goneA = bout.a.goneAt != null && now - bout.a.goneAt >= ROYAL_RING.goneMs;
    const goneB = bout.b.goneAt != null && now - bout.b.goneAt >= ROYAL_RING.goneMs;
    if (goneA || goneB) { out.push(duelEnd(st, bout, goneA && goneB ? null : goneA ? bout.b.sub : bout.a.sub, goneA && goneB ? 'draw' : 'left')); continue; }
    if (now < bout.startMs) continue;
    const outA = bout.a.outAt != null && now - bout.a.outAt >= DUEL_REF.outMs;
    const outB = bout.b.outAt != null && now - bout.b.outAt >= DUEL_REF.outMs;
    if (outA || outB) out.push(duelEnd(st, bout, outA && outB ? null : outA ? bout.b.sub : bout.a.sub, outA && outB ? 'draw' : 'left'));
  }
  return out;
}
