// @ts-check
// SHOT-KINDS (2026-10-17, the owner: "Different cannon shot types, for example a grape shot to thin out crew, Chain to try
// to take down their sail, etc"; bible/03-World/Naval-Refit.md SHOT-KINDS) - WHAT A GUN IS LOADED WITH. The port's own;
// pure.
//
// A gun (navalShips.js GUNS) is a bore - its muzzle speed, its carriage's elevation, its scatter, its reload - and until
// now it was also one load: a long gun threw round shot and a chaser chain, and that was the whole choice. Black Flag's
// captain chooses what goes down the barrel, and Daggerfall's gunners would too:
//
//   round   - ROUND SHOT, the gun's own ball: what every number in GUNS was tuned on. Holes her hull.
//   grape   - GRAPESHOT, a canvas bag of musket balls: it leaves slower and opens into a cone (SHOT.grape.spread) that
//             sweeps a wide path (`sweep`) and kills men where a ball would only splinter planks - and it bites hardest
//             close in: past GRAPE_FULL_S of flight its men fall off to half at GRAPE_SPENT_S.
//   chain   - CHAIN SHOT, two half-balls on a chain, tumbling: slower and wilder, a wider sweep across her rigging, and
//             it shreds canvas - her way under sail is what it takes from her (navalDamage.js wayShare).
//   heated  - HEATED SHOT, round shot heated red in a furnace aboard: as a ball does to her hull, a little less (the iron
//             is softer hot), but a hull hit sets her alight HEATED_FIRE of the time where a cold ball's FIRE_CHANCE does,
//             and her canvas burns where it passes through her rig. Slow to load (`reload`) - the furnace.
//
// EVERY NUMBER IS RELATIVE TO THE GUN'S OWN LOAD. A bore keeps its NATURAL load (`naturalShot`): the broadsides' long guns,
// the swivels and the galley's great guns round shot; the Small Ship's and the Carrack's bow chasers, whose GUNS row IS
// chain shot (navalShips.js `chain`), chain. A gun loaded with another shot carries that shot's factors over its own
// load's (`shotGun` - so a chaser loaded with round throws a long gun's kind of ball, 12 hull to the chain's 3), and a
// gun loaded with its own load is exactly the gun it was: every captain of the sea keeps his own loads, his duels and the
// odds tuned on them unchanged (navalAI.js strikeTime, hitShare).
//
// THE LOAD IS THE BATTERY'S. The player's gun deck holds a load for each of its gun groups - the two broadsides as one,
// the bow chasers, the stern guns (navalGunnery.js LOAD_GROUPS, createGunDeck `setLoad`), each its bores' own until the
// captain changes it: grape in the broadsides for her crew and chain in the chasers for her canvas, as Black Flag's
// captain lays them. The fire barrels are not guns and carry none. Changed, a battery standing loaded is drawn and
// loaded again in SHOT_SWITCH of the new load's reload; one already reloading takes the new shot in. The balls in the air
// keep the shot they left with, and say it (a volley's shot rides the room's word - navalWire.js `o`, its code
// SHOT_CODES - so every client flies the same balls and the victim's client judges the same blow).

/** The loads, in the cycle's order. */
export const SHOT_ORDER = Object.freeze(['round', 'grape', 'chain', 'heated']);
/** A shot's wire code: its place in SHOT_ORDER. */
export const SHOT_CODES = Object.freeze(Object.fromEntries(SHOT_ORDER.map((id, i) => [id, i])));

/**
 * Each load's factors over round shot: `speed` its muzzle speed, `spread` its scatter, `sweep` the metres its hit is swept
 * wider by (the cone of a bag of balls, the span of a chain), `hull`/`sail`/`crew` what a strike does, `reload` its
 * loading time, `fire` the chance a hull hit sets her alight (null: the gun's own FIRE_CHANCE), `rigFire` whether a pass
 * through her canvas sets it burning.
 */
export const SHOT = Object.freeze({
  round: Object.freeze({ speed: 1, spread: 1, sweep: 0, hull: 1, sail: 1, crew: 1, reload: 1, fire: null, rigFire: false }),
  grape: Object.freeze({ speed: 0.82, spread: 2.4, sweep: 0.45, hull: 0.2, sail: 0.6, crew: 4, reload: 0.9, fire: null, rigFire: false }),
  chain: Object.freeze({ speed: 0.9, spread: 1.6, sweep: 0.3, hull: 0.22, sail: 4, crew: 0.6, reload: 1.15, fire: null, rigFire: false }),
  heated: Object.freeze({ speed: 1, spread: 1.1, sweep: 0, hull: 0.85, sail: 0.8, crew: 1, reload: 1.6, fire: 0.45, rigFire: true }),
});
/** Grapeshot's reach: its men whole to this flight (s), half by GRAPE_SPENT_S and after. */
export const GRAPE_FULL_S = 1.2;
export const GRAPE_SPENT_S = 2.6;
/** A loaded battery drawn for a new load: this share of its reload. */
export const SHOT_SWITCH = 0.5;

/** A load's id as the deck keeps one: one of SHOT_ORDER, else round. */
export const shotId = (s) => (SHOT_ORDER.includes(s) ? s : 'round');
/** A gun kind's own load: the chasers' chain (navalShips.js GUNS.chain is chain shot), every other bore's round. */
export const naturalShot = (gunKind) => (gunKind === 'chain' ? 'chain' : 'round');

/**
 * The gun as it fires `shot`: GUNS[`gunKind`]'s row (`gun`) with the load's factors over its natural load's. A gun loaded
 * with its own load - or with none said (null: a ball of an older word, a captain's gun) - is the row itself (the same
 * object). A barrel carries no load.
 * @param {string} gunKind @param {any} gun - navalShips.js GUNS[gunKind] @param {string | null} [shot]
 */
export function shotGun(gunKind, gun, shot) {
  const own = naturalShot(gunKind);
  const s = shot == null ? own : shotId(shot);
  if (!gun || gunKind === 'barrel' || s === own) return gun;
  const a = SHOT[s], o = SHOT[own];
  const k = (key) => a[key] / o[key];
  return Object.freeze({
    ...gun, shot: s,
    speed: gun.speed * k('speed'), yawSpread: gun.yawSpread * k('spread'), pitchSpread: gun.pitchSpread * k('spread'),
    radius: gun.radius + Math.max(0, a.sweep - o.sweep), reload: gun.reload * k('reload'),
    hull: gun.hull * k('hull'), sail: gun.sail * k('sail'), crew: gun.crew * k('crew'),
  });
}

/** CAPTAIN-TREE: the most a hull hit's chance of fire comes to under a captain's heated shot (captainTree.js captainShot). */
export const FIRE_MOST = 0.9;
/** The chance a hull hit of `shot` sets her alight: heated shot's own, else the gun's (`fireChance`, navalDamage.js) -
 *  a ball that says no load is its bore's own (never heated) - CAPTAIN-TREE: times `k`, her captain's stars' (the gun's
 *  `fireK`), to FIRE_MOST at the most. */
export function shotFireChance(shot, fireChance, k = 1) {
  const c = shot == null ? fireChance : SHOT[shotId(shot)].fire ?? fireChance;
  return k === 1 ? c : Math.min(FIRE_MOST, c * k);
}
/** Whether a pass through her rig with `shot` sets her canvas burning (heated shot). */
export const shotRigFire = (shot) => shot != null && SHOT[shotId(shot)].rigFire;
/** Grapeshot's men by its flight `t` (s): whole to GRAPE_FULL_S, falling to half by GRAPE_SPENT_S; every other load 1. */
export function shotReach(shot, t) {
  if (shot == null || shotId(shot) !== 'grape' || !(t > GRAPE_FULL_S)) return 1;
  return 1 - 0.5 * Math.min(1, (t - GRAPE_FULL_S) / (GRAPE_SPENT_S - GRAPE_FULL_S));
}
/** The next load in the cycle (`dir` 1 on, -1 back). */
export const nextShot = (shot, dir = 1) => SHOT_ORDER[(SHOT_ORDER.indexOf(shotId(shot)) + (dir < 0 ? SHOT_ORDER.length - 1 : 1)) % SHOT_ORDER.length];
