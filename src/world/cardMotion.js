// @ts-check
// CARDS3 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 3; Mac: "I imagine actual detailed card physics"):
// THE CARDS' MOTION - pure, DOM-free. A card is a plate (CARD_W x CARD_L, CARD_T thick) that flies, lands, slides on the
// cloth and settles; that turns over its long edge; a chip is a disc in a stack that slides to the pot. The physics is
// the PICTURE, never the rules (section 3): what a card is and whose comes from the cards' law; this only says how it
// gets there, closed-form in time, so any frame - a slow one, a skipped one - lands on the same pose, and a deal seeded
// alike lands alike for every eye at the table.
//
// THE THROW. From the dealer's hand (DEAL_LIFT over the top, at the button's edge) toward the card's rest: a ballistic
// arc (ARC_HEIGHT at its middle) at FLIGHT_SPEED to a landing short of the rest by the slide, spinning about the vertical
// as it goes; then a slide under the cloth's friction (SLIDE_DECEL) that stops exactly on the rest, the spin bleeding out
// with the speed. Each throw's small differences - where on the cloth, how much spin, how far it skids - come from its
// seed (hash of the hand, the card and the table), never from Math.random.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).

/** The poker card: 63 x 88 mm, a quarter millimetre thick - drawn at a millimetre, so the cloth never shows through. */
export const CARD_W = 0.063;
export const CARD_L = 0.088;
export const CARD_T = 0.001;
/** MEASURE (CARDS3): the throw - the dealer's hand over the top, the speed across, the arc's rise, the cloth's grip. */
export const DEAL_LIFT = 0.18;
export const FLIGHT_SPEED = 2.4;
export const FLIGHT_MIN_S = 0.18;
export const ARC_HEIGHT = 0.06;
export const SLIDE_DECEL = 3.2;
export const SLIDE_MIN = 0.02;
export const SLIDE_SPREAD = 0.05;
export const SPIN_MAX = 3.5;
export const REST_JITTER = 0.008;
export const YAW_JITTER = 0.12;
/** MEASURE (CARDS3): a turn over the long edge, and how high the edge lifts. */
export const FLIP_S = 0.32;
/** MEASURE (CARDS3): one card thrown after another - the deal's pace; and the longest a throw takes to land and stop
 *  across a tavern table (a metre and a half at FLIGHT_SPEED, the slide's longest) - the session waits it out
 *  (AUDIT CARDS-2 M6: a patron who folded before his cards had landed snatched them out of the air). */
export const DEAL_STAGGER = 0.11;
export const THROW_LAND_S = 0.7;
/** MEASURE (CARDS3): a chip - a disc 39 mm across, 3.3 mm thick (the casino's); a push's length. */
export const CHIP_R = 0.0195;
export const CHIP_T = 0.0033;
export const CHIP_STACK_MAX = 20;
export const PUSH_S = 0.45;
/** MEASURE (AUDIT CARDS-2 L5): a pot's scoop to its winner rises this high at its middle, over the cards in its way. */
export const SCOOP_LIFT = 0.03;
/** The chips' values, highest first - a bet is stacked greedily from them. */
export const CHIP_VALUES = Object.freeze([500, 100, 25, 5, 1]);

/** A 32-bit hash of integers - the seed a throw's differences come from. */
export function hashSeed(...xs) {
  let h = 0x811c9dc5;
  for (const x of xs) { h ^= (x | 0) >>> 0; h = Math.imul(h, 0x01000193) >>> 0; h ^= h >>> 15; }
  return h >>> 0;
}
/** Three uniforms in [0, 1) off a seed (mulberry32's step, thrice). */
export function seedUnits(seed, n = 3) {
  let a = seed >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * A card thrown from `from` to rest at `to` (both world points; `to` on the cloth), face `roll` (0 up, PI down), at
 * `yaw` once settled, starting at `t0` seconds, its differences from `seed`. Answers `{t0, land, t1, rest, at(t)}`:
 * `t1` the clock it settles on, `rest` the jittered point it settles at, and `at(t)` its pose then -
 * `{pos, yaw, roll, moving}`. Before t0 it is in the dealer's hand - unless `fromYaw` says it already lies somewhere (a
 * fold to the muck, AUDIT CARDS-2 M6): then it starts where it is, at that yaw and `fromRoll`, turns as it flies, and is
 * never hidden.
 * @param {{from: number[], to: number[], yaw: number, roll?: number, t0: number, seed: number, fromYaw?: number, fromRoll?: number}} p
 */
export function dealMotion({ from, to, yaw, roll = Math.PI, t0, seed, fromYaw = undefined, fromRoll = roll }) {
  const [jx, jz, js] = seedUnits(seed);
  const rest = [to[0] + (jx - 0.5) * 2 * REST_JITTER, to[1], to[2] + (jz - 0.5) * 2 * REST_JITTER];
  const dx = rest[0] - from[0], dz = rest[2] - from[2];
  const dist = Math.hypot(dx, dz) || 1e-6;
  const dir = [dx / dist, dz / dist];
  const slide = Math.min(dist * 0.5, SLIDE_MIN + js * SLIDE_SPREAD);
  const land = [rest[0] - dir[0] * slide, rest[1], rest[2] - dir[1] * slide];
  const flight = Math.max(FLIGHT_MIN_S, (dist - slide) / FLIGHT_SPEED);
  const v0 = Math.sqrt(2 * SLIDE_DECEL * slide);
  const slideS = v0 / SLIDE_DECEL;
  const spin = (js - 0.5) * 2 * SPIN_MAX;
  const yawRest = yaw + (jx - jz) * YAW_JITTER;
  const tLand = t0 + flight, t1 = tLand + slideS;
  // The spin a slide has left in it at speed v - it bleeds out with the speed.
  const spinLeft = (v) => spin * 0.25 * (v0 > 0 ? v / v0 : 0);
  return {
    t0, land: tLand, t1, rest,
    at(t) {
      const lying = fromYaw !== undefined;
      if (t <= t0) return lying ? { pos: from.slice(), yaw: fromYaw, roll: fromRoll, moving: false } : { pos: from.slice(), yaw: yawRest + spin, roll, moving: false, held: true };
      if (t < tLand) {
        const u = (t - t0) / flight;
        const y = lerp(from[1], land[1], u) + ARC_HEIGHT * 4 * u * (1 - u);
        const turn = lying ? lerp(fromYaw, yawRest + spinLeft(v0), u) : yawRest + spin * (1 - u) + spinLeft(v0);
        return { pos: [lerp(from[0], land[0], u), y, lerp(from[2], land[2], u)], yaw: turn, roll: lerp(fromRoll, roll, smooth(u)), moving: true };
      }
      if (t < t1) {
        const s = t - tLand, v = v0 - SLIDE_DECEL * s;
        const d = v0 * s - 0.5 * SLIDE_DECEL * s * s;
        return { pos: [land[0] + dir[0] * d, rest[1], land[2] + dir[1] * d], yaw: yawRest + spinLeft(v), roll, moving: true };
      }
      return { pos: rest.slice(), yaw: yawRest, roll, moving: false };
    },
  };
}

/**
 * A card at rest at `pos` turned over, from `fromRoll` to `fromRoll + PI`, over FLIP_S from `t0`. `pivot` 'edge' (the
 * dealer's turn): the edge it turns on stays on the cloth, the far edge lifts and comes over, and the card lies a width
 * across (flipShift - a dealer throws a card a width short of where it is to lie); 'middle' (a player's own turn of his
 * cards, a hand shown): it lifts at its middle and turns where it lies. `acrossYaw` the way across it moves (the board's
 * own axis, so a jittered card still turns onto its slot - AUDIT CARDS-2 L4). Answers `{t0, t1, at(t)}`.
 * @param {{pos: number[], yaw: number, fromRoll?: number, t0: number, pivot?: 'edge'|'middle', acrossYaw?: number}} p
 */
export function flipMotion({ pos, yaw, fromRoll = Math.PI, t0, pivot = 'edge', acrossYaw = yaw }) {
  const t1 = t0 + FLIP_S;
  return {
    t0, t1,
    at(t) {
      const u = smooth((t - t0) / FLIP_S);
      const a = u * Math.PI;   // the turn so far
      // The card pivots on its right long edge: its middle rises by half a width times sin, and moves in by
      // half a width times (1 - cos) - across it, the yaw's right. The roll turns the far (left) edge up and over:
      // trs's Rz turns +X toward +Y for a positive roll, so the edge that stays down wants it negative (AUDIT
      // CARDS-2 M5: positive, the pivot edge rose and the far edge skidded a width and a half on the cloth).
      const r = [Math.cos(acrossYaw), 0 - Math.sin(acrossYaw)];
      const edge = pivot === 'edge';
      const lift = (CARD_W / 2) * Math.sin(a), across = edge ? (CARD_W / 2) * (1 - Math.cos(a)) : 0;
      return { pos: [pos[0] + r[0] * across, pos[1] + lift, pos[2] + r[1] * across], yaw, roll: edge ? fromRoll - a : fromRoll + a, moving: u > 0 && u < 1 };
    },
  };
}

/** Where a card the dealer will turn over its edge must land so the turn lays it on `to`: a width back across. */
export function flipShift(to, yaw) {
  return [to[0] - Math.cos(yaw) * CARD_W, to[1], to[2] + Math.sin(yaw) * CARD_W];
}

/**
 * A stack of chips for `amount`: `[{value, count}]` greedy from CHIP_VALUES, highest first - the fewest chips that make it.
 * @param {number} amount
 */
export function chipStacks(amount) {
  let left = Math.max(0, Math.floor(Number(amount) || 0));
  const out = [];
  for (const value of CHIP_VALUES) {
    const count = Math.floor(left / value);
    if (count) { out.push({ value, count }); left -= count * value; }
  }
  return out;
}

/**
 * The chips of `amount` laid at `at` (a point on the cloth), facing `yaw`: each disc's centre, in columns of at most
 * CHIP_STACK_MAX, the columns side by side across the yaw's right - centred on `at`, or (`outward`) growing away from
 * it to the right, so a seat's stack never spreads back over its cards (AUDIT CARDS-2 L5) - `[{value, pos}]`, bottom
 * first.
 * @param {number} amount
 * @param {number[]} at
 * @param {number} yaw
 * @param {boolean} [outward]
 */
export function chipDiscs(amount, at, yaw, outward = false) {
  const r = [Math.cos(yaw), 0 - Math.sin(yaw)];
  const columns = [];
  for (const { value, count } of chipStacks(amount)) for (let left = count; left > 0; left -= CHIP_STACK_MAX) columns.push({ value, count: Math.min(CHIP_STACK_MAX, left) });
  const out = [];
  columns.forEach((c, i) => {
    const off = (outward ? i : i - (columns.length - 1) / 2) * CHIP_R * 2.15;
    for (let k = 0; k < c.count; k++) out.push({ value: c.value, pos: [at[0] + r[0] * off, at[1] + CHIP_T * (k + 0.5), at[2] + r[1] * off] });
  });
  return out;
}

/**
 * A push from `from` to `to` (chips into the pot, a pot to its winner) over PUSH_S from `t0`, eased: the point between -
 * `lift` its arc's rise at the middle (a pot scooped to its winner passes over his cards, AUDIT CARDS-2 L5).
 * @param {number[]} from
 * @param {number[]} to
 * @param {number} t0
 * @param {number} t
 * @param {number} [lift]
 */
export function pushAt(from, to, t0, t, lift = 0) {
  const u = smooth((t - t0) / PUSH_S);
  return [lerp(from[0], to[0], u), lerp(from[1], to[1], u) + lift * 4 * u * (1 - u), lerp(from[2], to[2], u)];
}
