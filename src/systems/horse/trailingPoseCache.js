// @ts-check
// THE TRAILING WAGON'S CACHED POSE - WHERE A DISMOUNT PARKS THE WAGON (STALE-PARK, 2026-10-22; moved out of
// systems/horse/horseCart.js). The IL keeps it as four TrailingWagonRuntime fields (movingWorldX/Z, movingWorldHeading,
// hasMovingWorldPose): CacheMovingWorldPose [IL_7748] writes them from the drawn trailing wagon, and
// CaptureBestAvailableDeploymentPose [IL_7820] parks a dismount from them. The runtime decides WHEN the pose is cached
// and when it no longer stands behind the player (its drawn wagon, its frame, its transitions); this module holds the
// pose, picks a dismount's park from it, and says a park that lands far from the player.
//
//   deps = { now() -> seconds, log: { warn }, playerWorld() -> [x, z] natives, ratio() -> natives a metre }

import { V_FORWARD, TELEPORT_DISTANCE } from './horseCartLaw.js';

/** @typedef {{ wx: number, wz: number, heading: number[] }} DeploymentPose a park: natives and a heading */

/**
 * @param {{ now: () => number, log: { warn?: (line: string) => void }, playerWorld: () => number[], ratio: () => number }} deps
 */
export function createTrailingPoseCache({ now, log, playerWorld, ratio }) {
  let movingWorldX = 0, movingWorldZ = 0, movingWorldHeading = [...V_FORWARD], hasMovingWorldPose = false;
  let movingWorldPoseAt = 0;   // STALE-PARK: when the moving pose was cached (now()) - the far-park warning says its age

  /** CacheMovingWorldPose's write [IL_7748]: the trailing wagon's axle in natives, and its heading.
   *  @param {number[]} world @param {number[]} heading */
  function store([wx, wz], heading) {
    movingWorldX = wx; movingWorldZ = wz;
    movingWorldHeading = heading; hasMovingWorldPose = true; movingWorldPoseAt = now();
  }
  /** The cached pose no longer stands behind the player: the next park is laid behind them. */
  function forget() { hasMovingWorldPose = false; }
  /** CaptureBestAvailableDeploymentPose [IL_7820]: the trailing wagon's last cached world pose, else `behindPlayer()`'s -
   *  2.5 m behind the player (WAGONS3: a wagon's own setback behind them, the runtime's deploySetback).
   *  @param {() => DeploymentPose} behindPlayer @returns {DeploymentPose} */
  function captureBestAvailableDeploymentPose(behindPlayer) {
    if (hasMovingWorldPose) return { wx: movingWorldX, wz: movingWorldZ, heading: [...movingWorldHeading] };
    return behindPlayer();
  }
  /** DeployFromBestAvailablePose's park: CaptureBestAvailableDeploymentPose's, said in the log when it lands far.
   *  @param {() => DeploymentPose} behindPlayer @returns {DeploymentPose} */
  function dismountPose(behindPlayer) {
    const cachedAt = hasMovingWorldPose ? movingWorldPoseAt : null;
    const p = captureBestAvailableDeploymentPose(behindPlayer);
    warnIfParkedFar(p, cachedAt);
    return p;
  }
  /** STALE-PARK (the port's own, no IL twin): a dismount parks the wagon at most a hitch and a setback from the player,
   *  so a park past the mod's own jump distance (TELEPORT_DISTANCE) came from a pose that no longer stood behind them.
   *  The log names where the pose came from, so a report of a wagon gone missing can be traced.
   *  @param {DeploymentPose} p @param {number | null} cachedAt */
  function warnIfParkedFar(p, cachedAt) {
    const [px, pz] = playerWorld();
    const metres = Math.hypot(p.wx - px, p.wz - pz) / ratio();
    if (!(metres > TELEPORT_DISTANCE)) return;
    const from = cachedAt === null ? 'behind the player' : `at the trailing pose cached ${(now() - cachedAt).toFixed(1)} s earlier`;
    log.warn?.(`[TrailingWagon] A dismount parked the wagon ${metres.toFixed(1)} m from the player, ${from}.`);
  }

  return { store, forget, captureBestAvailableDeploymentPose, dismountPose };
}
