// @ts-check
// RAID5 (2026-10-25, bible/03-World/Raiding-Parties.md RAID5): A RAIDED TOWN'S PLACES AND PEOPLE - the world host's half
// of the raid's kinds (systems/raidKinds.js, run by systems/raidingParties.js): the town's square (where the Standard is
// held and the refugees are bound), the way the refugees walk to it (the town's own walk grid - systems/livingWorld/
// townPaths.js findTownPath, the same cells every client walks), the Standard-Bearer (one of the town's watch, minted
// at the square - scenes/cityGuards.js standBearer) and a refugee (a townsperson of the street's pool, the player's ally,
// walking behind the way's guide - characters/enemy/enemyMotor.js `follow`). A module the host wires (HOST-SPLIT,
// bible/01-Overview/Host-Split.md): the host hands its own doors, as they are, and keeps none of this.
//
// THE FOUR HOSTS (THE FOUR HOSTS RULE, Home.md): scenes/world.js WIRED - the one host with the Bay's towns, their walk
// grids and the town watch.
// scenes/exterior.js - FLAGGED: the fixed-city bench runs no raid; the streaming host is where its towns are raided.
// scenes/worldModes.js and scenes/dungeonContext.js - FLAGGED: a raid is the street's, and stands nothing indoors (RAID1).
import { NAV_CELL } from '../world/city/cityNavigation.js';
import { findTownPath, pathLine } from '../systems/livingWorld/townPaths.js';
import { streetNet } from '../systems/livingWorld/places.js';   // AUDIT WORLD-EVENTS L4-3/L4-8: the town's street net, where its living town has no places
import { MOBILE_TYPES } from '../characters/mobile/mobileTypes.js';
import { RAID_BEARER_HEALTH_X, RAID_BEARER_LEASH_M, RAID_REFUGEE_HEALTH_X } from '../systems/raidKinds.js';

/** The most a way's search opens. */
export const RAID_WAY_EXPANSIONS = 30000;
/** AUDIT WORLD-EVENTS L4-8: the least a walkable component holds to be the town's streets where its living town names
 *  none (cells) - a yard boxed in about the grid's middle is no square (the game's held one, two, sixteen and 237). */
export const RAID_STREETS_MIN = 400;
/** The sides a way comes from, by the raid's draw (0 north - the grid's far rows, +z - then east, south, west), as the
 *  living town's exits name them (systems/livingWorld/places.js). */
const SIDE_NAMES = Object.freeze(['n', 'e', 's', 'w']);
/** The refugee's kind - a temple's healer, a townsperson the street's pool can stand. */
export const RAID_REFUGEE_KIND = MOBILE_TYPES.Healer;

/**
 * AUDIT WORLD-EVENTS L4-8: THE TOWN'S STREETS off its grid alone (a classic town - its people the TownPopulation's,
 * with no places): the walkable component (four-neighbour, places.js streetNet) of the cell nearest the grid's middle
 * that holds RAID_STREETS_MIN cells or more (or the largest's whole, a town smaller than that), and that cell its square.
 * Null for a grid with no walkable cell. Pure.
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number }} nav
 * @returns {{ label: Int32Array, id: number, square: number[], exits: null }|null}
 */
export function gridStreets(nav) {
  const { label } = streetNet(nav);
  const size = new Map();
  for (let i = 0; i < label.length; i++) if (label[i]) size.set(label[i], (size.get(label[i]) ?? 0) + 1);
  let biggest = 0;
  for (const n of size.values()) biggest = Math.max(biggest, n);
  const min = Math.min(RAID_STREETS_MIN, biggest), W = nav.width, H = nav.height, mx = Math.floor(W / 2), my = Math.floor(H / 2);
  for (let r = 0; r < Math.max(W, H) && biggest; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = mx + dx, y = my + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || x < 0 || y < 0 || x >= W || y >= H) continue;
    const id = label[y * W + x];
    if (id && size.get(id) >= min) return { label, id, square: [x, y], exits: null };
  }
  return null;
}
/**
 * The cell of a town's streets nearest the middle of its side `side` (0 north - the grid's far rows - then east,
 * south, west): the line nearest that edge holding a street cell, and on it the one nearest the side's middle - the
 * living town's exits' own reading (places.js). Pure. @param {{ width: number, height: number }} nav
 * @param {Int32Array} label @param {number} id @param {number} side @returns {number[]|null}
 */
export function streetEdgeCell(nav, label, id, side) {
  const W = nav.width, H = nav.height, k = ((side | 0) % 4 + 4) % 4, rows = k === 0 || k === 2;
  const lines = rows ? H : W, along = rows ? W : H, half = along / 2;
  for (let n = 0; n < lines; n++) {
    const i = k === 0 ? H - 1 - n : k === 1 ? W - 1 - n : k === 2 ? n : n;
    let best = null, bestMid = Infinity;
    for (let j = 0; j < along; j++) {
      const x = rows ? j : i, y = rows ? i : j;
      if (label[y * W + x] !== id) continue;
      if (Math.abs(j - half) < bestMid) { bestMid = Math.abs(j - half); best = [x, y]; }
    }
    if (best) return best;
  }
  return null;
}

/**
 * @param {{
 *   townAt: (x: number, z: number) => ({ town: number, nav: any, places?: any, local: number[], toScene: (u: number, v: number) => number[] }|null|undefined),
 *   townAtPixel?: (px: number, py: number) => ({ town: number, nav: any, places?: any, toScene: (u: number, v: number) => number[] }|null),
 *   feet: () => (number[]|null), groundAt: (x: number, z: number) => number,
 *   standGuard: (pos: number[], yaw: number) => Promise<any>,
 *   spawnFoe: (mobileType: number, pos: number[], o: any) => Promise<any>,
 * }} deps  `townAt` the scene's point in a built town (scenes/wagon/wagonWardenHost.js wardenTownIn); `townAtPixel` the
 *   built town on a map pixel (wardenTownOfPixel - AUDIT WORLD-EVENTS L4-4: the raid's own, wherever about it the player
 *   stands); `feet` the player's; `groundAt` the ground's height; `standGuard` a defender of the watch minted at a point
 *   (cityGuards.standBearer); `spawnFoe` the street's pool's own (exteriorFoes.spawnFoe - a refugee is its `allied`,
 *   loose and transient)
 */
export function createRaidSites({ townAt, townAtPixel = () => null, feet, groundAt, standGuard, spawnFoe }) {
  /** AUDIT WORLD-EVENTS L4-4: the raid's own town - its map pixel's, built - else the one about the player's feet (the
   *  feet alone read null across the block the town's rect is widened by, and the raid kept the null). */
  const townOf = (raid) => (raid && Number.isInteger(raid.px) && Number.isInteger(raid.py) ? townAtPixel(raid.px, raid.py) : null) ?? (() => { const f = feet(); return f ? townAt(f[0], f[2]) ?? null : null; })();
  /** @type {WeakMap<object, any>} each classic grid's streets, read once */
  const gridNets = new WeakMap();
  /** AUDIT WORLD-EVENTS L4-3/L4-8: the town's streets and square - its living town's places' (the net its doors open
   *  onto, the square on it, the exits on it), else its grid's (gridStreets). */
  function streetsOf(t) {
    const pl = t.places;
    if (pl?.net && pl.square?.cell) return { label: pl.net, id: pl.netId, square: pl.square.cell, exits: pl.exits ?? null };
    if (!gridNets.has(t.nav)) gridNets.set(t.nav, gridStreets(t.nav));
    return gridNets.get(t.nav);
  }
  const sceneOf = (t, cell) => { const s = t.toScene((cell[0] + 0.5) * NAV_CELL, (cell[1] + 0.5) * NAV_CELL); return [s[0], groundAt(s[0], s[1]), s[1]]; };
  return {
    /** The town's square in the scene ([x, y, z]), or null (its town not built, or no streets). @param {any} [raid] */
    square(raid = null) {
      const t = townOf(raid);
      const s = t ? streetsOf(t) : null;
      return s ? sceneOf(t, s.square) : null;
    },
    /**
     * The refugees' way: from the town's edge on the side `side` names (0 north, 1 east, 2 south, 3 west - the raid's own
     * draw) to its square, along its streets - [x, y, z] points, or null. AUDIT WORLD-EVENTS L4-3: its start on the
     * square's own streets (a walled city's edge cells are the fields outside its wall - no way was ever found in a city).
     * @param {number} side @param {any} [raid]
     */
    way(side, raid = null) {
      const t = townOf(raid);
      const s = t ? streetsOf(t) : null;
      if (!s) return null;
      const k = ((side | 0) % 4 + 4) % 4;
      const start = s.exits?.find((e) => e.side === SIDE_NAMES[k])?.cell ?? streetEdgeCell(t.nav, s.label, s.id, k);
      if (!start) return null;
      const cells = findTownPath(t.nav, start, s.square, { maxExpansions: RAID_WAY_EXPANSIONS });
      if (!cells || cells.length < 2) return null;
      return pathLine(cells).pts.map((p) => { const s = t.toScene(p[0], p[1]); return [s[0], groundAt(s[0], s[1]), s[1]]; });
    },
    /** The Standard-Bearer at `post`: the watch's own, RAID_BEARER_HEALTH_X as hardy, kept within RAID_BEARER_LEASH_M of it. */
    async standBearer(post) {
      const g = await standGuard(post, 0);
      if (!g?.entity) return g ?? null;
      g.entity.maxHealth = Math.max(1, Math.round((g.entity.maxHealth || 1) * RAID_BEARER_HEALTH_X));
      g.entity.health = g.entity.maxHealth;
      g.raidBearer = true;
      if (g.ai) g.ai.follow = { feet: () => post, stop: 0.6, leash: RAID_BEARER_LEASH_M };
      return g;
    },
    /** AUDIT WORLD-EVENTS L4-9: a bearer this machine no longer runs the raid of - he stands down, the watch's walk off
     *  (cityGuards.js WATCH-LEAVES), and the next runner raises its own. @param {any} g */
    releaseBearer(g) {
      if (!g) return;
      g.raidBearer = false; g.leaving = true;
      if (g.ai) { g.ai.follow = null; g.ai.target = null; }
    },
    /** A refugee at `at`, walking behind `follow` (the way's guide - characters/enemy/enemyMotor.js `follow`). */
    async standRefugee(at, follow) {
      const f = await spawnFoe(RAID_REFUGEE_KIND, at, { allied: true, loose: true, transient: true, feetGiven: true });
      if (!f?.entity) return f ?? null;
      f.entity.maxHealth = Math.max(1, Math.round((f.entity.maxHealth || 1) * RAID_REFUGEE_HEALTH_X));
      f.entity.health = f.entity.maxHealth;
      f.refugee = true;
      if (f.ai) f.ai.follow = follow;
      return f;
    },
  };
}
