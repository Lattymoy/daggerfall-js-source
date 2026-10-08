// @ts-check
// SD18a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD18a;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S MARKS - what each Hollow's Hour keeps. The
// gate's Warden wears one of 4 aspects and two of 9 trials, a cycle of 144 (net/gateMods.js, net/gateLaw.js marksCycle);
// the Hour was the same every time.
//
//   THE ENDING (`SD_ENDINGS`, 6 - the Orrery's own stones, net/sdBrain.js SD_STONES): which of the Warp in the West's
//     endings the Remnant keeps. It sets the element its own blows carry (the Stomp, the Hour-Hand and the Volley - the
//     Hour's Pulse, Reset and End stay no-one's, unresisted), the light of its heart and eyes, and its SIGNATURE: one of
//     its blows as only that Ending throws it - the Lion's Roar (the Stomp's ring to the arena's rim), Sunfall (seven
//     gears, the brass burning longer), the Turning Tide (the Hand sweeping three quarters of the arena), the Tusk (it
//     walks faster, its Stomp wider), the Hungering Heart (the Mantella's Pulse quicker) and the Dragon's Break (the
//     Echoes faster, falling within ten seconds of each other).
//   THE OMENS (`SD_OMENS`, 9 - two a Hollow): what else the Warp asks - a brazen hide, quickened gears, a short Hour,
//     hardened Hearts, burning brass, the Orrery fraying sooner, a restless Pulse, an unending Reset, the twin Hands.
//
// A Hollow's marks are its place in the CYCLE OF MARKS (`sdMarksCycle`, `sdMarksOf` - by its slot, which every screen and
// the relay know): 6 Endings x 36 pairs of omens = 216 Hollows, no two running sharing an Ending or an omen. A mark is
// names and numbers HERE (`law`); the fight's profile composes them (net/sdRemnant.js sdFightProfile) and the relay
// stamps each blow's changed shape on its own frame (`sh`), so a screen judges the blow the relay threw.
//
// PURE and a LEAF: no imports - the relay's bundle (net/sdRemnant.js, net/sdBrain.js, net/wire.js) reads it.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/**
 * @typedef {{ stompR?: number, stompR1?: number, stompWave?: number, handArc?: number, handActive?: number, volleyMax?: number,
 *   poolMsX?: number, poolRX?: number, remSpeedX?: number, echoSpeedX?: number, pulseMs?: number, pairMs?: number, hpX?: number,
 *   windX?: number, endsMs?: number, heartX?: number, fray?: number, pulseStep?: number, resetMs?: number,
 *   pairHandMs?: number }} SdMarkLaw
 * @typedef {{ id: string, stone: string, sign: string, el: string, light: ReadonlyArray<number>, sig: string,
 *   text: string, law: Readonly<SdMarkLaw> }} SdEnding
 * @typedef {{ id: string, name: string, text: string, law: Readonly<SdMarkLaw> }} SdOmen
 */
/** The elements a blow may carry (the gate's - net/gateMods.js aspects' `el` - and magic). */
export const SD_ELEMENTS = Object.freeze(['fire', 'frost', 'shock', 'poison', 'magic']);
/** THE ENDINGS - the Orrery's stones, in their order (net/sdBrain.js SD_STONES). `light` its heart's and eyes' colour.
 *  @type {ReadonlyArray<Readonly<SdEnding>>} */
export const SD_ENDINGS = Object.freeze([
  Object.freeze({
    id: 'daggerfall', stone: 'Daggerfall', sign: 'the lion', el: 'shock', light: Object.freeze([0.75, 0.82, 1.0]),
    sig: 'The Lion\'s Roar', text: 'Its Stomp\'s ring rolls out to the arena\'s rim, and faster.',
    law: Object.freeze({ stompR1: 26, stompWave: 13 }),
  }),
  Object.freeze({
    id: 'sentinel', stone: 'Sentinel', sign: 'the sun', el: 'fire', light: Object.freeze([1.0, 0.62, 0.22]),
    sig: 'Sunfall', text: 'Its Gear Volley throws seven, and the brass burns half again as long.',
    law: Object.freeze({ volleyMax: 7, poolMsX: 1.5 }),
  }),
  Object.freeze({
    id: 'wayrest', stone: 'Wayrest', sign: 'the ship', el: 'frost', light: Object.freeze([0.55, 0.9, 1.0]),
    sig: 'The Turning Tide', text: 'Its Hour-Hand sweeps three quarters of the arena, over five seconds.',
    law: Object.freeze({ handArc: 1.5 * Math.PI, handActive: 5000 }),
  }),
  Object.freeze({
    id: 'orsinium', stone: 'Orsinium', sign: 'the tusk', el: 'poison', light: Object.freeze([0.62, 1.0, 0.3]),
    sig: 'The Tusk', text: 'It walks the faster, and its Stomp lands wider.',
    law: Object.freeze({ remSpeedX: 1.4, stompR: 8.5 }),
  }),
  Object.freeze({
    id: 'underking', stone: 'the Underking', sign: 'the crown of bone', el: 'magic', light: Object.freeze([0.78, 0.5, 1.0]),
    sig: 'The Hungering Heart', text: 'The Mantella pulses every twenty-two seconds.',
    law: Object.freeze({ pulseMs: 22_000 }),
  }),
  Object.freeze({
    id: 'blades', stone: 'the Blades', sign: 'the dragon', el: 'fire', light: Object.freeze([1.0, 0.36, 0.26]),
    sig: 'The Dragon\'s Break', text: 'Its Echoes walk the faster, and must fall within ten seconds of each other.',
    law: Object.freeze({ pairMs: 10_000, echoSpeedX: 1.2 }),
  }),
]);
/** THE OMENS - two a Hollow. @type {ReadonlyArray<Readonly<SdOmen>>} */
export const SD_OMENS = Object.freeze([
  Object.freeze({ id: 'brazen', name: 'The Brazen Hide', text: 'It stands with a quarter more health.', law: Object.freeze({ hpX: 1.25 }) }),
  Object.freeze({ id: 'quickened', name: 'The Quickened Gears', text: 'Its blows wind up faster.', law: Object.freeze({ windX: 0.85 }) }),
  Object.freeze({ id: 'short', name: 'The Short Hour', text: 'The Hour ends at twelve minutes.', law: Object.freeze({ endsMs: 12 * 60_000 }) }),
  Object.freeze({ id: 'hardened', name: 'The Hardened Hearts', text: 'Its Hearts hold a quarter again as much.', law: Object.freeze({ heartX: 1.25 }) }),   // AUDIT SD III (F5): half again made the Reset a race no party at reference damage could run between its Hearts
  Object.freeze({ id: 'burning', name: 'The Burning Brass', text: 'Its brass burns twice as long, and wider.', law: Object.freeze({ poolMsX: 2, poolRX: 4 / 3 }) }),
  Object.freeze({ id: 'fraying', name: 'The Fraying', text: 'The Orrery snaps back at thirty-six turns.', law: Object.freeze({ fray: 36 }) }),
  Object.freeze({ id: 'restless', name: 'The Restless Pulse', text: 'Each Mantella Pulse climbs twice as steeply - to three quarters of your health.', law: Object.freeze({ pulseStep: 0.04 }) }),
  Object.freeze({ id: 'unending', name: 'The Unending Reset', text: 'The Reset comes every forty seconds.', law: Object.freeze({ resetMs: 40_000 }) }),
  Object.freeze({ id: 'twin', name: 'The Twin Hands', text: 'The Echoes\' paired Hour-Hand comes every ten seconds.', law: Object.freeze({ pairHandMs: 10_000 }) }),
]);
/** How many omens a Hollow keeps. */
export const SD_OMENS_A_HOLLOW = 2;
/** The cycle's own salt (its shuffles - the Endings' order and the omens' seats). */
export const SD_MARKS_SALT = 0x5d18a;

/** mulberry32 (net/sdBrain.js sdRng's, kept here so this file stays a leaf). */
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** A ring through every pair of `n` seats, each pair sharing no seat with the next (nor the last with the first) - found
 *  by a depth-first walk in a fixed order. Pure. */
export function disjointRing(n) {
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  const used = new Array(pairs.length).fill(false), ring = [0];
  used[0] = true;
  const apart = (p, q) => p[0] !== q[0] && p[0] !== q[1] && p[1] !== q[0] && p[1] !== q[1];
  const walk = () => {
    if (ring.length === pairs.length) return apart(pairs[ring[ring.length - 1]], pairs[ring[0]]);
    const last = pairs[ring[ring.length - 1]];
    for (let k = 0; k < pairs.length; k++) {
      if (used[k] || !apart(last, pairs[k])) continue;
      used[k] = true; ring.push(k);
      if (walk()) return true;
      used[k] = false; ring.pop();
    }
    return false;
  };
  if (!walk()) throw new Error('sdMarks: no ring of disjoint pairs');
  return ring.map((k) => pairs[k]);
}
let _cycle = null;
/**
 * THE CYCLE OF MARKS: every [Ending, omen, omen] once - 216 - Hollow `k` (from 0) keeping pair `k mod 36` of the omens'
 * ring (disjointRing - so two Hollows running share no omen) and Ending `(k + floor(k / 36)) mod 6` (a step a Hollow -
 * never the same twice running, and every Ending with every pair once). The Endings' order and the omens' seats are the
 * salt's shuffles. Pure and cached.
 */
export function sdMarksCycle() {
  if (_cycle) return _cycle;
  const r = rngOf(SD_MARKS_SALT);
  const ends = shuffled(r, SD_ENDINGS.map((e) => e.id)), seats = shuffled(r, SD_OMENS.map((o) => o.id)), ring = disjointRing(seats.length);
  const n = ends.length * ring.length;
  _cycle = Object.freeze(Array.from({ length: n }, (_, k) => {
    const p = ring[k % ring.length], e = ends[(k + Math.floor(k / ring.length)) % ends.length];
    return Object.freeze([e, seats[p[0]], seats[p[1]]]);
  }));
  return _cycle;
}
/** A Hollow's marks by its slot (1, 2, 3 ...): `[ending id, omen id, omen id]`. Pure. */
export function sdMarksOf(s) {
  const c = sdMarksCycle(), k = Math.floor(Number(s) || 0) - 1;
  return c[((k % c.length) + c.length) % c.length];
}
/** The Ending and the omens a set of marks names (unknown ids dropped). */
export const sdEndingOf = (mk) => SD_ENDINGS.find((e) => e.id === mk?.[0]) ?? null;
export const sdOmensOf = (mk) => (Array.isArray(mk) ? mk.slice(1) : []).map((id) => SD_OMENS.find((o) => o.id === id)).filter(Boolean);
/** Whether `mk` is a set of marks: one known Ending, then SD_OMENS_A_HOLLOW distinct known omens. */
export const validSdMarks = (mk) => Array.isArray(mk) && mk.length === 1 + SD_OMENS_A_HOLLOW && !!sdEndingOf(mk)
  && sdOmensOf(mk).length === SD_OMENS_A_HOLLOW && mk[1] !== mk[2];
/** A set of marks' law, composed: multipliers multiplied, the rest the last that names it (an Ending's, then its omens'). */
export function sdMarksLaw(mk) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const L of [sdEndingOf(mk)?.law, ...sdOmensOf(mk).map((o) => o.law)]) {
    if (!L) continue;
    for (const [k, v] of Object.entries(L)) out[k] = k.endsWith('X') && out[k] != null ? out[k] * v : v;
  }
  return Object.freeze(out);
}
