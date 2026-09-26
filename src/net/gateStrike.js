// @ts-check
// WB4 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)"): WHERE AN ATTACK LANDS -
// the shapes net/gateBrain.js's ATTACKS name, tested against a point on the court, the telegraph's clock, and the
// verdict a struck player's machine reaches at the landing. Design: bible/11-Multiplayer/World-Bosses.md section 5
// ("Its attacks - every one telegraphed").
//
// CO-OP'S LAW, the struck player's own machine: the relay says an attack's word once (`atk` - which, when it lands on
// the relay's clock, where he stood, his facing, its targets) and every client draws its shape and, at the landing,
// tests ITS OWN FEET against it. A hit takes `pct` of the struck player's own maximum health, `el` its element (fire
// honours the game's own saving throw) - so a level-1 and a level-30 read the same fight. The relay never learns who
// was struck; it did not need to.
//
// PURE: an attack's word and a point in, a verdict out. The court's frame (net/gateBrain.js): metres about the court's
// centre, a facing `atan2(dx, dz)`.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, BOSS_R, windupOf } from './gateBrain.js';

/** A landing is decided at the first frame at or past it - and a frame that comes later than this past its span (a
 *  stalled or hidden screen) lets it pass: nobody is struck by what their screen never showed land. */
export const STRIKE_LATE_MS = 400;

const DEG = Math.PI / 180;
const wrap = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };

/** The distance from (px, pz) to the segment (ax, az)-(bx, bz). */
export function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2)) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/** WBX5: the Spokes of Dagon's lanes - `n` segments from where he stood, the first along his facing, each `len` long:
 *  [[ax, az, bx, bz], ...]. Pure. */
export function spokeLanes(atk) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || A.shape !== 'spokes') return [];
  const out = [];
  for (let k = 0; k < A.n; k++) {
    const a = atk.yw + (k * 2 * Math.PI) / A.n;
    out.push([atk.x, atk.z, atk.x + Math.sin(a) * A.len, atk.z + Math.cos(a) * A.len]);
  }
  return out;
}

/**
 * Is the point (px, pz) inside the attack's shape? `atk` is the wire's atk word ({a, x, z, yw, tg}).
 *   cone   - within `r` of where he stood and `arc` degrees about his facing (his own body's width always in it)
 *   disc   - within `r` of his feet (aim 'self'), of any of its targets (aim 'players') or of its one spot (aim 'point')
 *   lane   - within half its width of the line from where he stood to its end (tg[0]) - the ground his charge runs
 *   ring   - between `r0` and `r1` of where he stood
 *   spokes - WBX5: within half its width of any of its lanes (spokeLanes)
 *   all    - anywhere
 * @param {{a: number, x: number, z: number, yw: number, tg: number[][]}} atk @param {number} px @param {number} pz
 */
export function inAttack(atk, px, pz) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(px) || !Number.isFinite(pz)) return false;
  const dx = px - atk.x, dz = pz - atk.z, d = Math.hypot(dx, dz);
  switch (A.shape) {
    case 'cone': return d <= A.r && (d <= BOSS_R || Math.abs(wrap(Math.atan2(dx, dz) - atk.yw)) <= (A.arc / 2) * DEG);
    case 'disc': return A.aim === 'self' ? d <= A.r : (A.aim === 'point' ? (atk.tg ?? []).slice(0, 1) : (atk.tg ?? [])).some((p) => Math.hypot(px - p[0], pz - p[1]) <= A.r);
    case 'lane': { const e = atk.tg?.[0]; return !!e && segmentDistance(px, pz, atk.x, atk.z, e[0], e[1]) <= A.width / 2; }
    case 'ring': return d >= A.r0 && d <= A.r1;
    case 'spokes': return spokeLanes(atk).some((l) => segmentDistance(px, pz, l[0], l[1], l[2], l[3]) <= A.width / 2);
    case 'all': return true;
    default: return false;
  }
}

/**
 * WBX5: THE BURNING GROUND an attack's landing leaves (net/gateBrain.js POOLS): one pool under each of its marks
 * (Hellfire's) or at its one spot (the Meteor's), burning from the landing for the pool's span - `[{x, z, r, from, until,
 * pct, base}]`, the court's frame. Every screen that saw the landing knows where it burns; nothing is sent. Pure.
 */
export function landingPools(atk) {
  const A = ATTACK_BY_ID[atk?.a], P = A && 'pool' in A ? A.pool : null;
  if (!P || !Number.isFinite(atk.at)) return [];
  const spots = A.aim === 'point' ? (atk.tg ?? []).slice(0, 1) : A.aim === 'self' ? [[atk.x, atk.z]] : (atk.tg ?? []);
  return spots.map((p) => ({ x: p[0], z: p[1], r: P.r, from: atk.at, until: atk.at + P.ms, pct: P.pct, base: P.base }));
}

/** WBX5: the burning ground under (px, pz) at `now` - the first live pool that holds the point, or null. Pure. */
export function poolUnder(pools, px, pz, now) {
  for (const p of pools ?? []) if (now >= p.from && now < p.until && Math.hypot(px - p.x, pz - p.z) <= p.r) return p;
  return null;
}

/** Where the charge's head stands at `now` - the brain's own run (net/gateBrain.js stepBrain: from where he stood to
 *  the lane's end over the attack's `active` span) - or null outside the run. */
export function chargeHead(atk, now) {
  const A = ATTACK_BY_ID[atk?.a], e = atk?.tg?.[0];
  if (A !== ATTACKS.charge || !e || now < atk.at || now > atk.at + A.active) return null;
  const k = Math.min(1, (now - atk.at) / A.active);
  return [atk.x + (e[0] - atk.x) * k, atk.z + (e[1] - atk.z) * k];
}

/** Does the charge he is running strike (px, pz) between the frame before (`prev`) and this one (`now`) - within the
 *  lane's half-width (his body's at least) of the ground he ran over in between? The lane ahead of him is safe until he
 *  gets there, and the ground behind him once he has passed; a slow frame still sweeps all it missed. */
export function chargeStrikes(atk, px, pz, now, prev = -Infinity) {
  const A = ATTACKS.charge;
  if (ATTACK_BY_ID[atk?.a] !== A || now < atk.at || prev > atk.at + A.active) return false;
  const a = chargeHead(atk, Math.max(prev, atk.at)), b = chargeHead(atk, Math.min(now, atk.at + A.active));
  if (!a || !b) return false;
  return segmentDistance(px, pz, a[0], a[1], b[0], b[1]) <= Math.max(A.width / 2, BOSS_R);
}

/**
 * THE VERDICT on the struck player's machine, at the frame `now` (`prev` the frame before): 'hit', 'miss', or 'wait'
 * (not yet decided). The charge is 'hit' at the frame whose stretch of his run passes over the player, and 'miss' once
 * the run is over; every other attack is decided at the first frame at or past its landing - inside its shape or not.
 * Any landing met later than STRIKE_LATE_MS past its span is a 'miss'.
 * @param {{a: number, at: number, x: number, z: number, yw: number, tg: number[][]}} atk @param {number} px @param {number} pz
 * @param {number} now @param {number} [prev]
 * @returns {'hit'|'miss'|'wait'}
 */
export function strikeVerdict(atk, px, pz, now, prev = -Infinity) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(atk.at)) return 'miss';
  if (now < atk.at) return 'wait';
  if (now > atk.at + Math.max(A.active, 1) + STRIKE_LATE_MS) return 'miss';
  if (A === ATTACKS.charge) return chargeStrikes(atk, px, pz, now, prev) ? 'hit' : now >= atk.at + A.active ? 'miss' : 'wait';
  return inAttack(atk, px, pz) ? 'hit' : 'miss';
}

/** What an attack does to a player it strikes: the share of their own maximum health and the points beside it (WBX4),
 *  its element (null plain), its name, and whether a saving throw answers it (Dagon's Wrath is answered by nothing). */
export const blowOf = (atk) => {
  const A = ATTACK_BY_ID[atk?.a];
  return A ? { pct: A.pct, base: A.base ?? 0, el: A.el, name: A.name, saved: A.el === 'fire' && A !== ATTACKS.wrath } : null;
};

/** The damage a struck player takes: `pct` of their maximum health and WBX4's `base` points beside it, whole points, at
 *  least one (Dagon's Wrath is more than any health - 999%). */
export const strikeDamage = (pct, maxHealth, base = 0) => Math.max(1, Math.round(pct * Math.max(1, maxHealth) + Math.max(0, base)));

/** A fire strike's share after the game's own saving throw (combat/spellcast.js savingThrow answers the percent of an
 *  effect that lands, 0..100). */
export const fireShare = (dmg, savePct) => Math.trunc((dmg * Math.max(0, Math.min(100, savePct))) / 100);

/**
 * The telegraph's clock: how far through its wind-up the attack stands at `now` (0 at the word, 1 at the landing),
 * whether it is landing now (the landing's own span, `active`), and whether it is over. The wind-up is its phase's
 * (net/gateBrain.js windupOf - phase three's are shorter).
 * @param {{a: number, at: number}} atk @param {number} phase @param {number} now the relay's clock
 */
export function telegraphAt(atk, phase, now) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(atk.at)) return null;
  const w = windupOf(A, phase), span = Math.max(A.active, 1);
  const t = w > 0 ? Math.max(0, Math.min(1, (now - (atk.at - w)) / w)) : 1;
  return { t, landing: now >= atk.at && now < atk.at + span, over: now >= atk.at + span, key: A.key, since: now - atk.at };
}
