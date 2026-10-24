// @ts-check
// NAV-A (2026-09-28, Mac: "Being able to aim and fire when viewing from the side") - THE GUNNERY: which battery
// bears for a look, where its volley will fall, the volley itself, and the reload. The port's own; pure - the host
// hands a ship's pose and the camera's ray, and gets numbers back.
//
// BLACK FLAG'S LAW, ON A DAGGERFALL HELM. Look over the side and the broadside bears; look over the bow and the
// chasers do; look astern and the barrels roll off the stern. Hold the attack to AIM - the volley's landing zone
// stands on the water where it will fall, following the look - and let go to FIRE. A quick click fires where the
// look already is. The ship is the traverse: a broadside fires square to the hull and the look sets only the RANGE,
// so to bring the guns onto a ship you turn your own, as a captain does.
// AUDIT NAV1 (the helm): the zone stands where the look meets the sea only while that point moves less than
// AIM_SLOPE metres a degree of the look's pitch; toward the horizon and over it the range goes on at AIM_SLOPE a degree
// to the guns' longest (`lookReach`) - where the look met the sea at every range, a pixel of the default mouse threw a
// long shot 37 m, and the zone read "longest" from a degree and a half under the horizon up. A look ON A SHIP (her
// hull or her rig, the host's ray - `look.at`) lays the guns for that very point: its range out along the fire and its
// height, so the crosshair on her side is a broadside into her side (the sea's point behind her flew it over).
//
// THE ZONE IS THE TRUTH. It is drawn from the same launches the volley flies (systems/naval/navalBallistics.js):
// each gun's muzzle on the hull (navalShips.js), the elevation `elevationForRange` found, the deck's own velocity
// carried. Only the scatter is left out - the zone's width is what the spread can throw at that range.
//
// A VOLLEY ripples down the side, a gun every RIPPLE_S, the first at once - one seed per volley scatters it
// (navalBallistics.js volleyRandom), so every client in a room scatters it the same way - and each gun fires from
// where its port IS when its turn comes: the deck's way carried over its wait (AUDIT NAV1: the last of a Carrack's
// seven flashed 4.9 m behind its port at 9 m/s).
//
// RELOAD is each battery's own clock, the gun's time with a full crew: a crew thinned by grapeshot or a boarding
// fights its guns slower (up to RELOAD_UNDERMANNED more at none), and a boat that carries no crew - the player alone
// at a Large Boat's swivels - takes RELOAD_SINGLEHANDED. BRACING (the brace key held) halves what the hull takes and
// silences the guns while it is held (navalDamage.js BRACE_TAKEN) - and, AUDIT NAV1, stops the reload: a crew holding
// on is not loading, so the brace is an answer to a broadside, not a stance held for free.
//
// SHOT-KINDS (2026-10-17, bible/03-World/Naval-Refit.md SHOT-KINDS): WHAT EACH BATTERY IS LOADED WITH. A deck keeps one
// load for each of its gun groups (LOAD_GROUPS: the broadsides together, the bow, the stern), each its bore's own
// (shotKinds.js naturalShot) until the captain changes it. The aim and the volley are laid and flown with the gun as it
// fires that load (shotKinds.js shotGun: its muzzle speed, its scatter), its reload is the load's, and a change draws a
// loaded battery and loads it again in SHOT_SWITCH of the new load's reload - one already reloading takes the new shot
// in, its clock scaled to the new load's. A fire barrel carries none.

import { GUNS, SIDE_DIR, batteryOf, BARREL } from './navalShips.js';
import { shotGun, naturalShot, shotId, SHOT_SWITCH } from './shotKinds.js';
import { launchVelocity, elevationForRange, landing, maxRange, volleyRandom, scatter, flatUnit, NAVAL_DEG } from './navalBallistics.js';
import { quatRotate } from '../../world/quat.js';

/** The bow's arc and the stern's, either side of the keel line (degrees): a look within one lays that battery. */
export const BOW_ARC = 35;
export const STERN_ARC = 40;
/** A volley's ripple, gun to gun (s). */
export const RIPPLE_S = 0.09;
/** Reload multipliers: a crew at none (scaled by the crew's share lost), and a boat with no crew at all. */
export const RELOAD_UNDERMANNED = 0.8;
export const RELOAD_SINGLEHANDED = 1.4;
/** AUDIT NAV1 (the presentation): a battery just come ready is said FRESH this long (s) - the host's word for it and the
 *  HUD's flash of its chip (a side came ready in silence, only a class changing). */
export const READY_FLASH_S = 0.7;
/** A fire barrel's roll: its own short clock, whatever the stern's reload says. */
export const BARREL_DROP_S = 1.2;
/** AUDIT NAV1 (the helm): the most the zone moves out a degree of the look's pitch (m) - see `lookReach`. */
export const AIM_SLOPE = 30;
/** SHOT-KINDS: the deck's load groups - the two broadsides load as one, the bow and the stern each their own. */
export const LOAD_GROUPS = Object.freeze(['broadside', 'bow', 'stern']);
/** SHOT-KINDS: the load group a battery's side is in. */
export const loadGroupOf = (side) => (side === 'starboard' || side === 'port' ? 'broadside' : side === 'bow' || side === 'stern' ? side : null);
/** SHOT-KINDS: the load a gun of `gunKind` fires for a deck's `shot` - its own when none is said (null: a barrel's). */
export const loadOf = (gunKind, shot) => (gunKind === 'barrel' ? null : shot == null ? naturalShot(gunKind) : shotId(shot));

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * How far out on the flat a look lays (m from the eye's foot), for its pitch (radians, negative down) and the eye's
 * height over the sea `h`: where it meets the sea (h / tan of the depression) while that point moves out less than
 * AIM_SLOPE a degree - steeper than the depression p0 where sin^2(p0) = h / slope - and past it straight on at
 * AIM_SLOPE, through the horizon and over it, meeting the first law at p0 in both its value and its rate.
 */
export function lookReach(pitch, h) {
  const slope = AIM_SLOPE / NAVAL_DEG;   // m a radian
  const hh = Math.max(0.5, h);
  const p0 = Math.asin(Math.min(1, Math.sqrt(hh / slope)));
  const dip = -pitch;
  return dip >= p0 ? hh / Math.tan(dip) : hh / Math.tan(p0) + slope * (p0 - dip);
}

/** The ship's forward and starboard in the world (unit, flat) from its root rotation. */
export function shipAxes(rotation) {
  const f = flatUnit(quatRotate(rotation, [0, 0, 1])) ?? [0, 0, 1];
  return { forward: f, right: [f[2], 0, -f[0]] };
}

/**
 * The look's bearing off the bow, degrees in (-180, 180]: positive to starboard. From its horizontal part alone; a
 * look straight up or down has none (0).
 */
export function bearingOf(lookDir, rotation) {
  const l = flatUnit(lookDir);
  if (!l) return 0;
  const { forward, right } = shipAxes(rotation);
  return Math.atan2(l[0] * right[0] + l[2] * right[2], l[0] * forward[0] + l[2] * forward[2]) / NAVAL_DEG;
}

/** The battery a bearing lays: 'bow' within BOW_ARC of the stem, 'stern' within STERN_ARC of the stern, else the
 *  side it points to. */
export function sideForBearing(bearing) {
  const a = Math.abs(bearing);
  if (a <= BOW_ARC) return 'bow';
  if (a >= 180 - STERN_ARC) return 'stern';
  return bearing > 0 ? 'starboard' : 'port';
}

/** A root-frame point in the world, through the ship's pose. */
export const toWorld = (ship, p) => {
  const r = quatRotate(ship.rotation, p);
  return [ship.position[0] + r[0], ship.position[1] + r[1], ship.position[2] + r[2]];
};

/**
 * The aim for one battery: where its volley falls if fired now, and how to lay it.
 * @param {{ position: number[], rotation: number[], velocity?: number[], hull: number }} ship - the root's pose
 * @param {'starboard'|'port'|'bow'|'stern'} side
 * @param {{ origin: number[], dir: number[], at?: number[] | null } | null} look - the camera's ray (null: lay for `range`); `at`
 *   the point on a ship it meets (the host's ray: her hull or her rig), laid for itself
 * @param {number} seaY - the sea's height
 * @param {{ range?: number, target?: number[], targetY?: number, shot?: string | null }} [opts] - with no look: a range to lay for, or a world
 *   point to lay on (the AI's lead - its distance out from the guns, along the fire); `targetY` the height the lay
 *   meets at that range (the sea's, unless given - a captain laying his chain for a rig); SHOT-KINDS: `shot` the battery's
 *   load (null: its bore's own) - laid with that load's muzzle speed, and said on the solution (`shot`)
 * @returns {null | { side: string, gun: string, barrel: boolean, shot: string | null, elevation: number, range: number, maxRange: number,
 *   dir: number[], muzzles: number[][], launches: { p0: number[], v0: number[] }[], landings: ({ t: number, point: number[] } | null)[],
 *   width: number, lookPoint: number[] | null }}
 */
export function aimSolution(ship, side, look, seaY, { range = null, target = null, targetY = null, shot = null } = {}) {
  const battery = batteryOf(ship.hull, side);
  if (!battery) return null;
  const load = loadOf(battery.gun, shot);
  const gun = shotGun(battery.gun, GUNS[battery.gun], load);
  const muzzles = battery.muzzles.map((m) => toWorld(ship, m));
  const local = SIDE_DIR[side];
  const dir = flatUnit(quatRotate(ship.rotation, local)) ?? [0, 0, 1];
  if (battery.gun === 'barrel') {
    // a barrel is dropped, not laid: it lands on the sea under the stern's muzzle
    const drops = muzzles.map((m) => [m[0] + dir[0] * 1.5, seaY, m[2] + dir[2] * 1.5]);
    return { side, gun: battery.gun, barrel: true, shot: null, elevation: 0, range: 1.5, maxRange: 1.5, dir, muzzles, launches: [], landings: drops.map((point) => ({ t: 0, point })), width: 1, lookPoint: null };
  }
  // the battery's centre: where the range is measured from
  const c = muzzles.reduce((s, m) => [s[0] + m[0] / muzzles.length, s[1] + m[1] / muzzles.length, s[2] + m[2] / muzzles.length], [0, 0, 0]);
  const dy = c[1] - seaY;
  const hi = gun.maxEl * NAVAL_DEG, lo = gun.minEl * NAVAL_DEG;
  const far = maxRange(gun.speed, dy, hi);
  let want = range, lookPoint = null, layDy = dy;
  if (!look && target) want = (target[0] - c[0]) * dir[0] + (target[2] - c[2]) * dir[2];
  if (!look && Number.isFinite(targetY)) layDy = c[1] - targetY;
  if (look?.at) {
    // on a ship: her very point - out from the guns along the fire, and its own height
    lookPoint = look.at;
    want = (look.at[0] - c[0]) * dir[0] + (look.at[2] - c[2]) * dir[2];
    layDy = c[1] - look.at[1];
  } else if (look) {
    // the sea: the look's reach out along its own bearing, measured out from the guns along the fire
    const l = Math.hypot(look.dir[0], look.dir[1], look.dir[2]) || 1;
    const reach = lookReach(Math.asin(clamp(look.dir[1] / l, -1, 1)), look.origin[1] - seaY);
    const flat = flatUnit(look.dir) ?? dir;
    lookPoint = [look.origin[0] + flat[0] * reach, seaY, look.origin[2] + flat[2] * reach];
    want = (lookPoint[0] - c[0]) * dir[0] + (lookPoint[2] - c[2]) * dir[2];
  }
  const elevation = want == null ? lo : want <= 0 ? lo : elevationForRange(want, gun.speed, layDy, lo, hi);
  const carry = ship.velocity ?? null;
  const launches = muzzles.map((p0) => ({ p0, v0: launchVelocity(dir, elevation, gun.speed, carry) }));
  const landings = launches.map((l) => landing(l.p0, l.v0, seaY));
  const reached = landings.filter(Boolean);
  const meanRange = reached.length ? reached.reduce((s, l) => s + Math.hypot(l.point[0] - c[0], l.point[2] - c[2]), 0) / reached.length : 0;
  return {
    side, gun: battery.gun, barrel: false, shot: load, elevation, range: meanRange, maxRange: far, dir, muzzles, launches, landings,
    width: Math.max(2, 2 * meanRange * Math.tan(gun.yawSpread * NAVAL_DEG)), lookPoint,
  };
}

/**
 * The shots of one volley from an aim: each muzzle's launch bent by the gun's scatter on the volley's own draw
 * (`seed`), a gun every RIPPLE_S - each from where its port stands when it fires, the deck's way (`carry`) over its
 * wait. `skill` (0..1) is a gun crew's: the scatter at (1.5 - skill) of the gun's own, so a poor crew throws wider and
 * a crack one tighter than the zone's half-width.
 * GALLEON-WEIGHT: each launch carries the `weight` of metal it throws (navalShips.js playerBatteryWeight - a player's
 * galleon's broadside), to its ball and its hit. SHOT-KINDS: and the solution's load (`shot` - its bore's own when the
 * solution says none), flown with that load's speed and scatter.
 * @returns {{ delay: number, p0: number[], v0: number[], gun: string, shot: string, weight: number, index: number }[]}
 */
export function volleyLaunches(solution, seed, { skill = 0.5, carry = null, weight = 1 } = {}) {
  if (!solution || solution.barrel) return [];
  const w = Number.isFinite(weight) && weight > 0 ? weight : 1;
  const shot = loadOf(solution.gun, solution.shot);
  const gun = shotGun(solution.gun, GUNS[solution.gun], shot);
  const rand = volleyRandom(seed);
  const k = clamp(1.5 - skill, 0.4, 1.5);
  const c = carry ?? [0, 0, 0];
  return solution.muzzles.map((p0, index) => {
    const s = scatter(solution.dir, solution.elevation, gun.yawSpread * k, gun.pitchSpread * k, rand);
    const delay = index * RIPPLE_S;
    return { delay, p0: [p0[0] + (c[0] ?? 0) * delay, p0[1] + (c[1] ?? 0) * delay, p0[2] + (c[2] ?? 0) * delay], v0: launchVelocity(s.dir, s.elevation, gun.speed, carry), gun: solution.gun, shot, weight: w, index };
  });
}

/** A battery's reload, in seconds: the gun's own at a full crew, slower undermanned, slower still single-handed -
 *  SHOT-KINDS: for its load (`shot`, null its bore's own). */
export function reloadSeconds(gunKind, crewShare, crewed, shot = null) {
  if (!GUNS[gunKind]) return 0;
  if (gunKind === 'barrel') return BARREL_DROP_S;
  const g = shotGun(gunKind, GUNS[gunKind], loadOf(gunKind, shot));
  if (!crewed) return g.reload * RELOAD_SINGLEHANDED;
  return g.reload * (1 + RELOAD_UNDERMANNED * (1 - clamp(crewShare, 0, 1)));
}

/**
 * One ship's gun deck: each battery's clock, the barrels aboard, the brace - SHOT-KINDS: and each load group's load
 * (`load`, `setLoad`). `step(dt)` runs the clocks; `ready` asks; `fired` starts a battery's reload. Pure state the host
 * and the AI share.
 * @param {number} hull
 * @param {{ crewed?: boolean, crewShare?: () => number, barrels?: number, reloadScale?: () => number }} [opts]
 */
export function createGunDeck(hull, { crewed = true, crewShare = () => 1, barrels = BARREL.stock, reloadScale = () => 1 } = {}) {
  /** @type {Record<string, number>} */ const clocks = { starboard: 0, port: 0, bow: 0, stern: 0 };
  /** @type {Record<string, number>} */ const length = { starboard: 1, port: 1, bow: 1, stern: 1 };
  /** @type {number} */ let barrelStock = barrels;
  let braced = false;
  /** SHOT-KINDS: each load group's load - null its bores' own (shotKinds.js naturalShot). */
  /** @type {Record<string, string | null>} */ const loads = { broadside: null, bow: null, stern: null };
  const scaleNow = () => Math.max(0.5, Math.min(1.5, Number(reloadScale()) || 1));
  /** The load a side fires: its group's, else its bore's own (null: no battery, or a barrel's). */
  const loadAt = (side) => { const b = batteryOf(hull, side); return b ? loadOf(b.gun, loads[loadGroupOf(side)]) : null; };
  const deck = {
    hull,
    /** The seconds left on a battery (0: loaded). */
    left: (side) => clocks[side] ?? 0,
    /** The share of its reload a battery has done (1: loaded) - the HUD's gauge. */
    progress: (side) => (clocks[side] > 0 ? clamp(1 - clocks[side] / (length[side] || 1), 0, 1) : 1),
    /** Whether a battery can fire: it exists, is loaded, the brace is off - and a barrel battery has barrels. */
    ready(side) {
      const b = batteryOf(hull, side);
      if (!b || braced || clocks[side] > 0) return false;
      return b.gun !== 'barrel' || barrelStock > 0;
    },
    /** A battery fired: its reload starts (a barrel is spent). */
    fired(side) {
      const b = batteryOf(hull, side);
      if (!b) return;
      // SHIP-CREW: a player's crew's spirits and standing order scale it (shipCrew.js reloadScaleOf), never a barrel's drop
      const s = reloadSeconds(b.gun, crewShare(), crewed, loadAt(side)) * (b.gun === 'barrel' ? 1 : scaleNow());
      clocks[side] = s; length[side] = s || 1;
      if (b.gun === 'barrel') barrelStock = Math.max(0, barrelStock - 1);
    },
    /** SHOT-KINDS: the load `side` fires (its group's, else its bore's own; null: no guns there, or the barrels). */
    load: loadAt,
    /**
     * SHOT-KINDS: load `side`'s group with `shot` - every battery of it with guns (the barrels carry none). A battery
     * standing loaded is drawn and loaded again (SHOT_SWITCH of the new load's reload); one reloading takes the new shot
     * in, its clock scaled to the new load's. Its bores' own load is said as none (`loads` null). False: nothing changed.
     */
    setLoad(side, shot) {
      const group = loadGroupOf(side);
      const sides = group === 'broadside' ? ['starboard', 'port'] : [group];
      const armed = sides.filter((x) => { const b = batteryOf(hull, x); return b && b.gun !== 'barrel'; });
      if (!armed.length) return false;
      const next = shotId(shot);
      if (armed.every((x) => loadAt(x) === next)) return false;
      for (const x of armed) {
        const b = batteryOf(hull, x);
        const was = reloadSeconds(b.gun, crewShare(), crewed, loadAt(x));
        const now = reloadSeconds(b.gun, crewShare(), crewed, next);
        if (clocks[x] > 0) { const k = now / (was || 1); clocks[x] *= k; length[x] *= k; }
        else { const t = SHOT_SWITCH * now * scaleNow(); clocks[x] = t; length[x] = t || 1; }
      }
      loads[group] = armed.every((x) => naturalShot(batteryOf(hull, x).gun) === next) ? null : next;
      return true;
    },
    /** The clocks run - but not while the crew holds on (the brace). */
    step(dt) { if (braced) return; for (const k of Object.keys(clocks)) if (clocks[k] > 0) clocks[k] = Math.max(0, clocks[k] - Math.max(0, dt)); },
    get barrels() { return barrelStock; },
    set barrels(n) { barrelStock = Math.max(0, Math.min(99, n | 0)); },
    get braced() { return braced; },
    set braced(v) { braced = !!v; },
    /** The deck as a save or the wire keeps it - SHOT-KINDS: its loads, a group at its bores' own said as none. */
    snapshot: () => ({ clocks: { ...clocks }, barrels: barrelStock, loads: { ...loads } }),
    restore(s) {
      if (!s || typeof s !== 'object') return;
      for (const k of Object.keys(clocks)) { const v = Number(s.clocks?.[k]); clocks[k] = Number.isFinite(v) && v > 0 ? Math.min(v, 60) : 0; }
      if (Number.isFinite(s.barrels)) deck.barrels = s.barrels;
      if (s.loads && typeof s.loads === 'object') deck.restoreLoads(s.loads);
    },
    /** SHOT-KINDS: the loads as a save keeps them (`snapshot().loads`), the clocks untouched - a group's bores' own load
     *  (or an unknown one) said as none, as `setLoad` says it. */
    restoreLoads(l) {
      for (const g of LOAD_GROUPS) {
        const sides = g === 'broadside' ? ['starboard', 'port'] : [g];
        const guns = sides.map((x) => batteryOf(hull, x)?.gun).filter((k) => k && k !== 'barrel');
        const want = typeof l?.[g] === 'string' && guns.length ? shotId(l[g]) : null;
        loads[g] = want && !guns.every((k) => naturalShot(k) === want) ? want : null;
      }
    },
  };
  return deck;
}

