// @ts-check
// BOW-BLOOM (2026-10-30: "could we do a accruacy circle", "so if u shoot to fast it way less accuyrat", "like bloom",
// "in a gun"): a player's bow shot flies anywhere inside a circle that each quick shot widens and a rest shrinks. The
// first shot after a rest flies true; a slow archer never blooms. The crosshair draws it (ui/bowBloomRing.js). Pure but
// for its own clock. A departure: DFU's arrows fly true.

/** Degrees a shot adds, the widest the circle grows, degrees a second it shrinks back. */
export const BOW_BLOOM = Object.freeze({ step: 2, most: 8, settle: 3 });

let _deg = 0, _at = 0, _settle = BOW_BLOOM.settle;
const bloomClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** The circle's radius now, degrees. */
export const bowBloomNow = (now = bloomClock()) => Math.max(0, _deg - _settle * Math.max(0, now - _at));

/** A shot loosed along `dir` (a unit vector): where it flies inside the circle as it stands, and the circle widened
 *  (`kind` the bow's, BOW_KINDS). */
export function bowBloomShot(dir, now = bloomClock(), rand = Math.random, kind = null) {
  const r = bowBloomNow(now);
  _deg = Math.min(BOW_BLOOM.most, r + BOW_BLOOM.step);
  _at = now;
  _settle = kind?.settle ?? BOW_BLOOM.settle;
  if (!(r > 0)) return [dir[0], dir[1], dir[2]];
  const off = (r * Math.sqrt(rand()) * Math.PI) / 180, turn = rand() * 2 * Math.PI;   // a point spread evenly over the disc
  const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = bloomNorm(bloomCross(dir, up)), v = bloomCross(dir, u);
  const s = Math.sin(off), c = Math.cos(off), a = Math.cos(turn) * s, b = Math.sin(turn) * s;
  return bloomNorm([dir[0] * c + u[0] * a + v[0] * b, dir[1] * c + u[1] * a + v[1] * b, dir[2] * c + u[2] * a + v[2] * b]);
}

// BOW-FAST (2026-10-30: "stackable damage reduction if you shoot too fast"): a shot within `within` s of the last adds a
// stack, at most `most`, each taking `cut` per cent off its damage; a shot after a longer rest has none. The stacks ride
// the shaft from its loose (`fast`) and are read where it lands (bowFastDamage), PvE and PvP alike.
export const BOW_FAST = Object.freeze({ cut: 20, most: 4, within: 1 });
let _stacks = 0, _last = -Infinity, _landing = /** @type {any} */ (null);

// BOW-KINDS (2026-10-30: "how do we balance short ad long bow"): the short bow is whole at 0.75 s and its circle closes
// 4 a second; the long bow is whole at 1.25 s and lands x1.5 (`pull`). Paced, the two land about the same a second.
// Any other bow keeps BOW_FAST's and BOW_BLOOM's own. By template (combat/enemyEquipment.js: Short Bow 129, Long Bow 130).
export const BOW_KINDS = Object.freeze({
  129: Object.freeze({ within: 0.75, settle: 4, pull: 1 }),
  130: Object.freeze({ within: 1.25, settle: 3, pull: 1.5 }),
});
const BOW_PLAIN = Object.freeze({ within: BOW_FAST.within, settle: BOW_BLOOM.settle, pull: 1 });
/** The kind of bow `weapon` is. */
export const bowKindOf = (weapon) => BOW_KINDS[weapon?.templateIndex] ?? BOW_PLAIN;

/** A shot loosed now from a bow of `kind`: its stacks. */
export function bowFastShot(now = bloomClock(), kind = null) {
  _stacks = now - _last < (kind?.within ?? BOW_FAST.within) ? Math.min(BOW_FAST.most, _stacks + 1) : 0;
  _last = now;
  return _stacks;
}
/** What a player's shot from `weapon` carries, loosed now: its stacks and its bow's pull. */
export function bowShotStamp(weapon, now = bloomClock()) {
  const kind = bowKindOf(weapon);
  return { fast: bowFastShot(now, kind), pull: kind.pull };
}
/** `dmg` after the stacks and the pull shaft `m` carries - at least 1 where it was over 0. */
export function bowFastDamage(m, dmg) {
  const k = Math.max(0, Math.min(BOW_FAST.most, Math.trunc(Number(m?.fast) || 0)));
  const pull = Number(m?.pull) > 0 ? Number(m.pull) : 1;
  return (k > 0 || pull !== 1) && dmg > 0 ? Math.max(1, Math.round((dmg * pull * (100 - BOW_FAST.cut * k)) / 100)) : dmg;
}
/** Run `fn` while shaft `m` lands, so a door that rolls the blow itself (combat/duelCombat.js) reads its stacks. */
export function whileShaftLands(m, fn) {
  const was = _landing;
  _landing = m;
  try { return fn(); } finally { _landing = was; }
}
/** The shaft landing now, or null. */
export const landingShaft = () => _landing;

/** Tests: the circle closed, the stacks cleared. */
export function _resetBowBloomForTests() { _deg = 0; _at = 0; _settle = BOW_BLOOM.settle; _stacks = 0; _last = -Infinity; _landing = null; }

/** @param {number[]} a @param {number[]} b */
const bloomCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} a */
const bloomNorm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
