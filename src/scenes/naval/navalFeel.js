// @ts-check
// COMBAT-FEEL (2026-10-17, the owner: "Improve and polish combat and visuals"; bible/03-World/Naval-Refit.md
// COMBAT-FEEL) - WHAT A SEA FIGHT FEELS LIKE AT MY RAIL: the moments the sea fight had no word for, wired by the naval
// host (scenes/naval/navalHost.js) and drawn by its effects (systems/naval/navalEffects.js) and sounds
// (systems/naval/navalSounds.js). Each is the port's own - Daggerfall has no sea.
//
//   NEAR-MISS  a ship's ball going by my boat close (the shot field's 'pass', systems/naval/navalShots.js NEAR_MISS_M):
//              heard - its whistle at the place it passed, louder the nearer (`passed`). A ball of mine or of
//              another player's never whistles at me: no fight between players at sea.
//   DRENCH     a ball falling into the sea within NEAR_SPLASH_M of my boat's hull throws its water over her rail
//              (effects.drench) and jars her (`shake`, NEAR_SHAKE at her side, less as it falls further) - whoever's
//              ball it was: the sea is the sea (`splashed`).
//   HULL-BLOW  a ball striking my boat is felt from a SIDE - her bow, her stern or a beam - read off the ball's way
//              against her heading (`blowSide`): the HUD's plate flashes that side of her rose for BLOW_S (`blow`).
//   MAGAZINE   a ship going down while she burns may blow her magazine - MAGAZINE_CHANCE, decided by her own seed so
//              every player who sees her sees the same - once, MAGAZINE_DELAY into her going down, at her middle: the
//              barrel's blast (effects.blast, its sound) and a jar for a boat of mine near (`sinking`, `frame`).
//   MY-SMOKE   my own boat smokes along her deck as she is battered, as a sea ship does (navalHost.js poseShip's
//              SMOKE_FROM law, the effects' smolder) - while a hostile ship is near her (the fight's smoke, not a
//              mooring's: navalHost.js hostileNearBoat); she had shown her fires alone (`frame`).
import { NAVAL_SFX } from '../../systems/naval/navalSounds.js';
import { boxGap, NEAR_MISS_M } from '../../systems/naval/navalShots.js';
import { quatRotate } from '../../world/quat.js';

/** DRENCH: how near a ball's fall to my boat's hull throws its water aboard (m). */
export const NEAR_SPLASH_M = 6;
/** DRENCH: the jar of a fall alongside (the camera's kick; a ball striking her is 1.6, a barrel's blast more). */
export const NEAR_SHAKE = 0.7;
/** AUDIT 2: how near her hull my feet must be for her deck's jar to be mine (m) - on her, or at her rail. */
export const DRENCH_FEET_M = 2;
/** HULL-BLOW: how long the side a blow came from is shown (s). */
export const BLOW_S = 1.4;
/** MAGAZINE: the share of ships going down afire whose magazine goes up, and when (s into her going down, from and to). */
export const MAGAZINE_CHANCE = 0.55;
export const MAGAZINE_DELAY = Object.freeze([1.5, 4.5]);
/** MAGAZINE: how far off a boat of mine is jarred by it (m), and how hard alongside. */
export const MAGAZINE_SHAKE_M = 160;
export const MAGAZINE_SHAKE = 2.4;
/** MY-SMOKE: under this share of her hull she smokes, and over this share of her length each way from amidships - the
 *  sea ships' own law (navalHost.js SMOKE_FROM, SMOKE_SPAN). */
export const MY_SMOKE_FROM = 0.6;
export const MY_SMOKE_SPAN = 0.6;

/** A seed's share in [0, 1) - a ship's own draw, the same on every machine that knows her seed. */
export const seedShare = (seed, salt) => {
  let h = (Math.imul((seed >>> 0) ^ salt, 0x9e3779b1) >>> 0);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
/** HULL-BLOW: the side of a ship a ball travelling `dir` struck her from - 'bow', 'stern', 'port' or 'starboard' - her
 *  heading `fwd` (her +z in the world) and her starboard its turn clockwise from above (+x at heading 0). */
export function blowSide(fwd, dir) {
  const fl = Math.hypot(fwd[0], fwd[2]) || 1, f = [fwd[0] / fl, fwd[2] / fl];
  const from = [-(dir[0] ?? 0), -(dir[2] ?? 0)];   // where it came from
  const ahead = from[0] * f[0] + from[1] * f[1];
  const beam = from[0] * f[1] - from[1] * f[0];   // starboard is fwd turned a quarter clockwise: (f.z, -f.x)
  if (Math.abs(ahead) >= Math.abs(beam)) return ahead >= 0 ? 'bow' : 'stern';
  return beam >= 0 ? 'starboard' : 'port';
}
/** MAGAZINE: whether a ship of `seed` going down afire blows her magazine, and when - null for one that does not. */
export function magazineOf(seed) {
  if (seedShare(seed, 0x6a91) >= MAGAZINE_CHANCE) return null;
  return MAGAZINE_DELAY[0] + seedShare(seed, 0x2b7) * (MAGAZINE_DELAY[1] - MAGAZINE_DELAY[0]);
}

/** MY-SMOKE: a boat's deck line, aft to bow over MY_SMOKE_SPAN of her each way, half a metre over her deck - her pose's
 *  (`position`, `rotation`) and her build's (navalShips.js hullBuild: `deck`, `aftZ`, `bowZ`). */
export function deckLine(pose, build) {
  const f = quatRotate(pose.rotation, [0, 0, 1]);
  const fl = Math.hypot(f[0], f[2]) || 1, fw = [f[0] / fl, f[2] / fl];
  const y = pose.position[1] + build.deck + 0.5;
  const at = (z) => [pose.position[0] + fw[0] * z * MY_SMOKE_SPAN, y, pose.position[2] + fw[1] * z * MY_SMOKE_SPAN];
  return { a: at(build.aftZ), b: at(build.bowZ) };
}

/**
 * @param {{ effects: any, sound: (key: string, pos: number[], vol?: number, opts?: any) => void, shake?: (k: number) => void,
 *   mine: (shooter: any) => boolean, myHulls: () => { id: string, box: any }[], feet: () => number[],
 *   myBoats?: () => { pose: any, build: any, hull: number, fighting: boolean }[] }} deps
 *   `mine(shooter)` whether a shooter is this player's or another player's (no fight between players at sea);
 *   `myHulls()` my boats' hull boxes this frame; `myBoats()` each boat of mine - her pose, her build, her hull's share
 *   left and whether a hostile ship is near her
 */
export function createNavalFeel(deps) {
  let clock = 0;
  /** HULL-BLOW: the last blow on a boat of mine - `{ side, at }`. */
  let lastBlow = null;
  /** MAGAZINE: ships going down whose magazine waits - entry -> the clock it goes at. */
  const magazines = new Map();

  /** NEAR-MISS: a 'pass' of the shot field - a ship's ball going by a boat of mine. */
  function passed(e) {
    if (deps.mine(e.shooter) || !e.point) return;
    const k = Math.max(0, 1 - (Number(e.gap) || 0) / NEAR_MISS_M);
    deps.sound(NAVAL_SFX.whistle, e.point, 0.55 + 0.45 * k);
  }
  /** DRENCH: a ball into the sea at `point` - over the rail of a boat of mine within NEAR_SPLASH_M; the deck rocked under
   *  me only where I stand on her (AUDIT 2: within DRENCH_FEET_M of her hull - one moored across the water shook my eye). */
  function splashed(point) {
    let best = null;
    for (const h of deps.myHulls()) {
      const gap = boxGap(h.box, point);
      if (gap <= NEAR_SPLASH_M && (!best || gap < best.gap)) best = { h, gap };
    }
    if (!best) return false;
    const k = 1 - best.gap / NEAR_SPLASH_M;
    deps.effects.drench(point, best.h.box.c, k);
    const feet = deps.feet?.();
    if (feet && boxGap(best.h.box, feet) <= DRENCH_FEET_M) deps.shake?.(NEAR_SHAKE * (0.4 + 0.6 * k));
    return true;
  }
  /** HULL-BLOW: a ball travelling `dir` struck a boat of mine heading `fwd`. */
  function struck(fwd, dir) {
    if (!fwd || !dir) return;
    lastBlow = { side: blowSide(fwd, dir), at: clock };
  }
  /** HULL-BLOW: the side a blow came from while it is shown, or null. */
  const blow = () => (lastBlow && clock - lastBlow.at < BLOW_S ? lastBlow.side : null);
  /** MAGAZINE: a ship begins to go down - `burning` whether a fire of hers burns. */
  function sinking(entry, seed, burning) {
    if (!burning || magazines.has(entry)) return;
    const after = magazineOf(seed);
    if (after != null) magazines.set(entry, clock + after);
  }
  /**
   * The frame: the magazines due go up (`posOf(entry)` where she is now - null for one gone, whose magazine is forgotten),
   * and my battered boats smoke.
   * @param {number} dt @param {(entry: any) => number[] | null} posOf
   */
  function frame(dt, posOf = () => null) {
    clock += Math.max(0, dt);
    for (const [entry, at] of magazines) {
      if (clock < at) continue;
      magazines.delete(entry);
      const p = posOf(entry);
      if (!p) continue;
      deps.effects.blast(p);
      deps.sound(NAVAL_SFX.blast, p, 1);
      const f = deps.feet();
      const d = Math.hypot(p[0] - f[0], p[2] - f[2]);
      if (d < MAGAZINE_SHAKE_M) deps.shake?.(MAGAZINE_SHAKE * (1 - d / MAGAZINE_SHAKE_M));
    }
    for (const m of deps.myBoats?.() ?? []) {
      const k = (MY_SMOKE_FROM - m.hull) / MY_SMOKE_FROM;
      if (k <= 0 || !m.fighting || !m.pose || !m.build) continue;
      const deck = deckLine(m.pose, m.build);
      deps.effects.smolder(deck.a, deck.b, dt, Math.min(1, k));
    }
  }
  return { passed, splashed, struck, blow, sinking, frame, clear() { lastBlow = null; magazines.clear(); }, get clock() { return clock; } };
}
