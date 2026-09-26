// ═══════════════════════════════════════════════════════════════════
// DW-D (2026-09-25): THE SWIMMER IN THE CARVED SEA. Iliac Puddle No More
// 1.2.2's OutdoorSwimDriver (jet082) in its own two phases around the
// port's motor, over the port's own machinery:
//
//   UPDATE (beforeMove) - the decisions (in the water, swimming, head
//     under, the presentation under), the dismount, the shore exit, the
//     published state, and the FORGE the motor steps under: LevitateMotor
//     swimming on the forged water line (the mod hands DFU a
//     blockWaterLevel, a short; the port's motor reads the height it
//     stands for), the host's IsPlayerSwimming - returned for the ONE
//     motor flag write the host makes each frame
//     (shared.applyMotorEffectFlags), never written a second time,
//     because every change of LevitateMotor.IsSwimming cancels a step;
//   POST PHASE (afterMove - OutdoorSwimDriverAfter's PostPhaseRestore) -
//     after the motor moved: out on shore ground ends the swim; else the
//     decisions again from where the move left the player, the flags
//     re-applied, the ascent clamped, the surface camera kept unsunk;
//   the forge's reach PAST the motor - blockWaterLevel, isPlayerSubmerged
//     and OnExteriorWaterMethod as the forge leaves them (waterLevelY,
//     submerged, waterMethod): the ambient's water sounds, Temple.AvoidDeath,
//     the footsteps. Never the motor's own OnExteriorWater: PlayerMotor.Update
//     recomputes that from the ground right before the height changer reads
//     it, and the carved sea's ground is None - so DFU's height changer
//     swim-CROUCHES the swimmer (DecideHeightAction's swim arm, a dungeon
//     swimmer's pose) and never sinks one;
//   the HEIGHT CHANGER's writes from outside - DoUnsinking for a swimmer
//     whose head is clear of the sea while a vanilla sink holds
//     (KeepSurfaceCameraUnsunk; it drops the forced swim crouch too),
//     DoUnsinking / DoStanding when the water is left
//     (RequestStandAfterWaterExit), and a crouch cleared for 1.5 s after
//     (ClearCrouchAfterWaterExit) - through the motor's forceUnsink /
//     forceStand, which leave DecideHeightAction's edge where DFU leaves it;
//   BREATH is the dungeon's own law (systems/breath.js breathStep) on the
//     head-under test, at the classic cadence (the host's);
//   the FOG is DFU's own UnderwaterFog (render/underwaterFog.js) with the
//     mod's density range and its neutral colour, over the host's own.
//
// The swim's MOVEMENT (the multiplier, the stroke, the floor clamp) is
// scenes/deepWatersSwimMove.js, which the dungeon's swimmer runs too; the
// public state is systems/deepWaterPlayer.js. NOT ported: the forge's
// `isPlayerInsideDungeon` - the mod raises DFU's dungeon flag for the
// Update window to borrow the dungeon arm's swim; the port hands the swim,
// the submersion and the water audio state over directly (and the arm's
// afloat line, player/motor.js afloatMessageStep, which the host runs while
// forged), so the flag's other readers in the window - the city watch, the
// ambient light's target, a window, a quest placement or a save taking the
// sea for a dungeon - are not reached; and the water terrain collider gate,
// which the port's carved ground (heightAt's floor) makes unnecessary
// (Port-Ledger A, the Iliac Puddle No More row).
// ═══════════════════════════════════════════════════════════════════

import {
  DeepWaterSwimState, forgedSwimWaterLineY, swimCheckY, surfaceAscentCeiling, presentationWaterLineForFog,
  worldYToBlockWaterLevel, blockWaterLevelToWorldY, NO_WATER_LEVEL, headClearOfSurface, headUnderwater, SHORE_GROUND_PROBE_HEIGHT, SHORE_GROUND_PROBE_DISTANCE, SHORE_GROUND_OCEAN_MARGIN,
  WATER_CONTACT_MINIMUM_DEPTH, SHORE_EXIT, SWIM_EXIT_CLEARANCE, SWIM_ENTER_CLEARANCE,
} from '../world/deepWaterSwim.js';
import { UnderwaterFog } from '../render/underwaterFog.js';
import { underwaterFogDensityMax, underwaterFogColor } from '../world/deepWaterLook.js';
import { evaluateSwimmingSuppression, publishState, clearState } from '../systems/deepWaterPlayer.js';
import { ON_EXTERIOR_WATER } from '../player/exteriorSurface.js';

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Restore's uncrouchAfterExitUntil: a crouch is stood up this long after the water is left. */
export const UNCROUCH_AFTER_EXIT_SECONDS = 1.5;
/** GuardSwimMotorFrameSpike's bar: `Time.deltaTime > 0.1f`. */
export const FRAME_SPIKE_SECONDS = 0.1;

/**
 * @param {object} deps
 * @param {object} deps.host - createDeepWatersHost's
 * @param {(x: number, z: number) => ?{entry: object, lx: number, lz: number, baseY: number}} deps.locate - the built pixel under a world point
 * @param {() => number} deps.seaY - the sea's world height now (OceanElevation * TerrainScale + WorldCompensation.y)
 * @param {(x: number, z: number) => number} deps.terrainGroundAt - the drawn ground WITHOUT the seafloor: -Infinity in a carved cell (the floor is not shore)
 * @param {object} deps.collider - the world's Collider (meshes, for the probes; the shore exit's swept move)
 * @param {() => object} deps.settings - lookSettings' + {swimSpeedMultiplier, enableSwimStroke, argonianInfiniteBreath}
 * @param {() => void} [deps.dismount] - the host's transport change to Foot
 */
export function createDeepWatersPlayer({ host, locate, seaY, terrainGroundAt, collider, settings, dismount = () => {} }) {
  const swim = new DeepWaterSwimState();
  const fog = new UnderwaterFog();
  let uncrouchUntil = 0;       // uncrouchAfterExitUntil
  let suppressed = false;      // swimmingSuppressed
  let exteriorContext = false; // exteriorContextActive
  let lastDecision = null;
  let spikeSuppressed = false; // suppressedSwimMotorForFrameSpike
  // PlayerEnterExit.blockWaterLevel and isPlayerSubmerged as the forge leaves them (ApplyWaterAudioState): the
  // readers past the motor - the ambient's water sounds, Temple.AvoidDeath, an aquatic foe's WaterMove - see these.
  // And PlayerMotor's onExteriorWaterMethod, written the same way (`method`, null on a frame the driver left it be):
  // what DFU's readers after the post phase see, the footsteps' FixedUpdate above all. It is NEVER the motor's own
  // flag - PlayerMotor.Update recomputes that from the ground (GetOnExteriorWaterMethod, :367) right before the height
  // changer's decision reads it (:371), and over the carved sea the ground is None (the floor is no DaggerfallTerrain,
  // the terrain collider is gated off): the height changer swim-crouches a swimmer, as a dungeon's, and never sinks one.
  const audio = { waterLevel: NO_WATER_LEVEL, submerged: false, method: null };

  /** TryGetAuthoritativeWaterColumn - the swimmable floor under the point, or null. */
  function columnAt(x, z) {
    const at = locate(x, z);
    return at ? host.waterColumn(at.entry, at.lx, at.lz, at.baseY) : null;
  }
  /** DeepWaterWorld.TryGetWaterColumn - the bathymetry's depth, the rendered floor beside it. */
  function rawColumnAt(x, z) {
    const at = locate(x, z);
    return at ? host.rawWaterColumn(at.entry, at.lx, at.lz, at.baseY) : null;
  }
  /** TryGetUsableWaterColumn. */
  const usableAt = (x, z) => { const c = columnAt(x, z); return !!c && c.depth >= WATER_CONTACT_MINIMUM_DEPTH; };
  const centreOf = (p) => p.pos[1] + p.height / 2;

  /**
   * A downward probe the way the mod's rays see the world: the nearest of
   * the meshes (the floor's walls excepted - IsShoreGround) and the
   * terrain (none over a carved cell).
   */
  function probeDown(x, yTop, z, dist) {
    const mesh = collider.raycastHit?.([x, yTop, z], [0, -1, 0], dist, { skip: host.wallBuckets }) ?? null;
    const g = terrainGroundAt(x, z);
    let best = mesh && Number.isFinite(mesh.dist) ? { y: yTop - mesh.dist, normalY: mesh.normal ? Math.abs(mesh.normal[1]) : 1 } : null;
    if (Number.isFinite(g) && g <= yTop && yTop - g <= dist && (!best || g > best.y)) best = { y: g, normalY: collider.groundNormal ? collider.groundNormal(x, z)[1] : 1 };
    return best;
  }
  /** IsValidLandingHit (shore ground, a walkable slope, no open water under it - TryGetWaterColumn's depth). */
  function validLanding(x, hit, z, oceanY) {
    if (hit.normalY < SHORE_EXIT.minLandingNormalY) return false;
    const c = rawColumnAt(x, z);
    if (c) {
      if (c.depth >= SHORE_EXIT.minOpenWaterColumnDepth) return false;
      if (hit.y <= c.oceanY + SHORE_EXIT.landingWaterMargin) return false;
    }
    return hit.y >= oceanY - 1;
  }
  /** IsStandingOnShoreGround: 3.25 m down from 1.25 over the capsule's centre. */
  function onShoreGround(p, oceanY) {
    const hit = probeDown(p.pos[0], centreOf(p) + SHORE_GROUND_PROBE_HEIGHT, p.pos[2], SHORE_GROUND_PROBE_DISTANCE);
    if (!hit || hit.y < oceanY - SHORE_GROUND_OCEAN_MARGIN) return false;
    return validLanding(p.pos[0], hit, p.pos[2], oceanY);
  }
  /** OutdoorShoreExitAssist.TryMoveToShore(requireSwimming: false): Vertical over 0.02, the camera's forward flattened
   *  (none looking straight up or down), a landing 1 m ahead then under the player, the capsule's centre to 1.5 m over
   *  it - a swept move, CharacterController.Move's. */
  function tryMoveToShore(p, f, oceanY) {
    if (!(f.input.forward > SHORE_EXIT.minForwardInput)) return false;
    const cp = Math.cos(f.pitch ?? 0);
    if (cp * cp < 0.01) return false;
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    for (const [po, lo] of [[1, 0.5], [0, 0]]) {
      const x = p.pos[0] + fx * po, z = p.pos[2] + fz * po;
      const hit = probeDown(x, oceanY + SHORE_EXIT.probeHeightAboveOcean, z, SHORE_EXIT.probeDistance);
      if (!hit || !validLanding(x, hit, z, oceanY)) continue;
      if (hit.y >= oceanY - 1 && hit.y <= oceanY + SHORE_EXIT.maxLandingAboveOcean && hit.y > centreOf(p) - 0.1) {
        const dy = hit.y + 1.5 - centreOf(p);
        collider.move(p.pos, x + fx * lo - p.pos[0], dy, z + fz * lo - p.pos[2], p.height, false);   // CharacterController.Move: no snap
        return true;
      }
    }
    return false;
  }

  /** The decisions, in Update's order - {inWater, swimming, headSubmerged, underwater, onShore}. */
  function decide(p, f, oceanY) {
    return swim.step({
      now: f.now, oceanY, centreY: centreOf(p), cameraY: f.cameraY, descend: f.descend, ascend: f.ascend,
      onShore: onShoreGround(p, oceanY), grounded: !!p.grounded, usableColumnHere: usableAt(p.pos[0], p.pos[2]),
    });
  }
  /** ApplyDfuWaterAudioState + ApplyDfuSwimFlags on the host's two flags (LevitateMotor.IsSwimming is the host's one
   *  write). The water line goes through the short DFU is handed (WorldYToBlockWaterLevel), so the motor's surface is
   *  the level's own height, a 0.025 m step, as DFU's reads of blockWaterLevel * -GlobalScale are. */
  function applyFlags(p, oceanY, swimming) {
    audio.waterLevel = worldYToBlockWaterLevel(forgedSwimWaterLineY(oceanY, swimming, centreOf(p)));
    audio.submerged = headUnderwater(centreOf(p), oceanY);   // IsPlayerHeadUnderwater
    audio.method = swimming ? ON_EXTERIOR_WATER.Swimming : ON_EXTERIOR_WATER.None;
    p.isPlayerSwimming = swimming;         // PlayerEnterExit.IsPlayerSwimming
    return { swimming, waterSurfaceY: blockWaterLevelToWorldY(audio.waterLevel) };
  }
  /** ApplyWaterAudioState(10000, None, false) - Restore's and ClearBoatSwimPose's. */
  function clearAudio() { audio.waterLevel = NO_WATER_LEVEL; audio.submerged = false; audio.method = ON_EXTERIOR_WATER.None; }
  /** Restore: the flags down, the fog's backup back (fog() reads the decision), the head reset, the uncrouch window open.
   *  LevitateMotor.IsSwimming goes down with them (ApplyDfuSwimFlags(false)) - a no-op ahead of the motor, where the
   *  host's one write is false anyway, and the post phase's own edge after it, as DFU's is. */
  function restore(p, now) {
    clearAudio();
    p.isPlayerSwimming = false;
    p.swimming = false;
    swim.forged = false;
    swim.resetHead(false);
    uncrouchUntil = now + UNCROUCH_AFTER_EXIT_SECONDS;
  }
  /** RequestStandAfterWaterExit. */
  function requestStand(p) {
    const sinking = p.isInWaterTile || p.heightAction === 'sink';
    p.forcedSwimCrouch = false;
    if (sinking && p.heightAction !== 'unsink') { p.forceUnsink(); return; }
    if (p.crouching && p.heightAction !== 'unsink') p.forceStand();
  }
  /** ClearCrouchAfterWaterExit. */
  function clearCrouch(p, now) {
    if (now >= uncrouchUntil) return;
    if (p.crouching && p.heightAction !== 'unsink' && p.heightAction !== 'stand') p.forceStand();
  }
  /** KeepSurfaceCameraUnsunk: a swimmer's head clear of the sea, not diving - the capsule unsunk, the swim crouch off. */
  function keepSurfaceCameraUnsunk(p, underwater, oceanY, descend) {
    if (underwater) return;
    if (!headClearOfSurface(centreOf(p), oceanY) || descend) return;
    p.forcedSwimCrouch = false;
    if ((p.isInWaterTile || p.heightAction === 'sink') && p.heightAction !== 'unsink') p.forceUnsink();
  }
  /**
   * GuardSwimMotorFrameSpike: a swimmer (not levitating) whose frame's Time.deltaTime - the real frame under the
   * mod's own 0.1 s maximumDeltaTime (the hosts' frame clamp), times the time scale - passes 0.1 s has LevitateMotor
   * disabled for it, so the frame moves them nothing; otherwise a disabled LevitateMotor is enabled again, whoever
   * disabled it. Under the clamp only a raised time scale (Travel Options' accelerated journey) can pass the bar.
   */
  function guardFrameSpike(p, swimming, frameDelta) {
    if (swimming && !p.levitating && frameDelta > FRAME_SPIKE_SECONDS) {
      if (p.levitateMotorEnabled !== false) { p.levitateMotorEnabled = false; spikeSuppressed = true; }
    } else if (p.levitateMotorEnabled === false) {
      p.levitateMotorEnabled = true;
      spikeSuppressed = false;
    }
  }
  /** ReleaseSwimMotorFrameSpikeGuard: the guard's own disable undone (inside, suppressed, the state cleared). */
  function releaseSpikeGuard(p) {
    if (!spikeSuppressed) return;
    if (p.levitateMotorEnabled === false) p.levitateMotorEnabled = true;
    spikeSuppressed = false;
  }
  /** SuppressOutdoorSwimming / the post phase's boat arm: ClearBoatSwimPose with it. */
  function suppress(p, now) {
    swim.resetHead(false);
    releaseSpikeGuard(p);
    if (swim.forged) restore(p, now);
    clearAudio();
    p.isPlayerSwimming = false;
    p.swimming = false;
    const sinking = p.isInWaterTile || p.heightAction === 'sink';
    p.forcedSwimCrouch = false;
    if (sinking && p.heightAction !== 'unsink') p.forceUnsink();
  }

  return {
    swim,
    columnAt,
    rawColumnAt,
    /** WaterSurfaceResources.GetPlayerShallowWaterFactor: 1 at 3 m of water or less under the player, 0 at 12 m or more (or none). */
    shallowFactor(centre) {
      const c = rawColumnAt(centre[0], centre[2]);
      if (!c) return 0;
      return 1 - Math.min(1, Math.max(0, (c.depth - 3) / 9));
    },
    /** The sea's world height now (TryGetCachedOceanSurfaceWorldY - always known outdoors). */
    seaY,
    /** currentlyForged. */
    get forged() { return swim.forged; },
    /** exteriorContextActive (DeepWaterPlayer.TryGetWaterColumn answers only while it holds). */
    get exteriorContext() { return exteriorContext; },
    /** PlayerEnterExit.IsPlayerSubmerged as the forge leaves it (Temple.AvoidDeath; the ambient's bubbles). */
    get submerged() { return audio.submerged; },
    /** blockWaterLevel * -1 * GlobalScale as the forge leaves it - the world height the ambient's WaterGentle plays at
     *  and an aquatic foe's WaterMove stops under - or null at NoWaterSentinel. */
    get waterLevelY() { return audio.waterLevel === NO_WATER_LEVEL ? null : blockWaterLevelToWorldY(audio.waterLevel); },
    /** OnExteriorWaterMethod as the driver wrote it this frame (Swimming / None), or null when it wrote none -
     *  then PlayerMotor.Update's own, the host's surface model, is what the late readers see too. */
    get waterMethod() { return audio.method; },

    /**
     * AUDIT DW-F: OnSaveLoad, on SaveLoadManager.OnStartLoad and again on OnLoad (after the save's crouch is back):
     * RestoreWaterTerrainCollider (the port has no collider gate - Port-Ledger (5)), then ClearOutdoorWaterState - the
     * suppression and the exterior context down, DeepWaterPlayer.ClearState, the fog's backup back (fog() reads the
     * decision), and past a PlayerEnterExit: currentlyForged down WITHOUT Restore (no flag touched, no uncrouch window),
     * DropForgeTracking (no forged dungeon here), ResetHeadWaterState(false), ReleaseSwimMotorFrameSpikeGuard and
     * RequestStandAfterWaterExit - so a crouched save loads standing. The caller flushes the state change.
     */
    saveLoad(p) {
      suppressed = false;
      exteriorContext = false;
      clearState();
      lastDecision = null;
      swim.forged = false;
      swim.resetHead(false);
      releaseSpikeGuard(p);
      requestStand(p);
    },

    /** Update's IsPlayerInside arm: no exterior context, the state cleared, the forge restored. */
    insideFrame(p, now) {
      audio.method = null;
      suppressed = false;
      exteriorContext = false;
      clearState();
      lastDecision = null;
      releaseSpikeGuard(p);
      if (swim.forged) restore(p, now);
    },

    /**
     * TryGetPlayerWaterColumn: the usable column under the player; else one
     * a capsule's radius off (0.85 of it, within 0.35 .. 0.75) along the
     * axes, then along the camera's flattened forward and its right.
     */
    playerWaterColumn(p, yaw, radius = 0.35) {
      const x = p.pos[0], z = p.pos[2];
      const usable = (px, pz) => { const c = columnAt(px, pz); return c && c.depth >= WATER_CONTACT_MINIMUM_DEPTH ? c : null; };
      const r = clamp(radius * 0.85, 0.35, 0.75);
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
      return usable(x, z) ?? usable(x + r, z) ?? usable(x - r, z) ?? usable(x, z + r) ?? usable(x, z - r)
        ?? usable(x + fx * r, z + fz * r) ?? usable(x - fx * r, z - fz * r) ?? usable(x + rx * r, z + rz * r) ?? usable(x - rx * r, z - rz * r);
    },

    /** IsPlayerInOrAboveDeepWater(minimumDepth): the camera under the sea by 0.25, or a column that deep under the player. */
    inOrAboveDeepWater(pos, cameraY, minimumDepth) {
      const oceanY = seaY();
      if (cameraY < oceanY - 0.25) return true;
      const c = rawColumnAt(pos[0], pos[2]);
      return !!c && c.depth >= minimumDepth;
    },

    /**
     * OutdoorSwimDriver.Update, ahead of the motor. `f`: {now (s), player, cameraY, yaw, pitch, descend, ascend,
     * onBoat, loadGrace, input: {forward}, frameDelta (Time.deltaTime: the frame's clamped seconds x the time scale)}.
     * Returns the forge for the host's one motor flag write -
     * {swimming, waterSurfaceY} - or null (the plain per-frame clear).
     */
    beforeMove(f) {
      const p = f.player;
      audio.method = null;   // PlayerMotor.Update's own until the driver writes it
      exteriorContext = true;
      suppressed = !!f.onBoat || evaluateSwimmingSuppression();
      if (suppressed) { clearState(); suppress(p, f.now); lastDecision = null; return null; }
      const oceanY = seaY();
      const d = decide(p, f, oceanY);
      d.oceanY = oceanY;
      lastDecision = d;
      guardFrameSpike(p, d.swimming, f.frameDelta ?? 0);
      if (d.swimming && p.riding) dismount();   // DismountForSwimming: off the horse or the cart
      // the shore exit - a swimmer near the surface, not diving, outside the load grace
      if (!f.descend && swimCheckY(centreOf(p)) >= oceanY - 0.75 && !f.loadGrace && d.swimming && tryMoveToShore(p, f, oceanY)) {
        if (swim.forged) restore(p, f.now);
        clearState();
        requestStand(p);
        clearCrouch(p, f.now);
        lastDecision = { ...d, inWater: false, swimming: false, headSubmerged: false, underwater: false };
        return null;
      }
      publishState(d.inWater, d.swimming, d.headSubmerged, d.underwater);
      if (!d.swimming && !d.underwater) {
        if (swim.forged) { restore(p, f.now); requestStand(p); }
        clearCrouch(p, f.now);
        return null;
      }
      swim.forged = true;   // Forge
      const forge = applyFlags(p, oceanY, d.swimming);
      if (d.swimming) keepSurfaceCameraUnsunk(p, d.underwater, oceanY, f.descend);
      return forge;
    },

    /**
     * OutdoorSwimDriverAfter's PostPhaseRestore, after the motor moved and the host's own surface model ran.
     * `f`: {now (s), player, cameraY, descend, ascend, onBoat}. Returns {swimming, headSubmerged, underwater} for
     * the frame's readers (the breath, the ear).
     */
    afterMove(f) {
      const p = f.player;
      const none = { swimming: false, headSubmerged: false, underwater: false };
      if (f.onBoat || suppressed) { clearState(); suppress(p, f.now); return none; }
      if (!swim.forged) return none;
      const oceanY = seaY();
      if (!f.descend && onShoreGround(p, oceanY)) {
        clearState();
        restore(p, f.now);
        requestStand(p);
        lastDecision = null;
        return none;
      }
      // the decisions again, from where the move left the player (no shore arm: that returned above)
      const centreY = centreOf(p);
      const inWater = swim.recentContact({ now: f.now, oceanY, centreY, descend: f.descend, onShore: false, grounded: !!p.grounded, usableColumnHere: usableAt(p.pos[0], p.pos[2]) });
      const atDepth = swimCheckY(centreY) < oceanY + (swim.forged ? SWIM_EXIT_CLEARANCE : SWIM_ENTER_CLEARANCE);
      const swimming = inWater && (atDepth || f.descend || f.ascend);
      const underwater = inWater && swim.presentationUnderwater(oceanY, f.cameraY, centreY);
      const headSubmerged = inWater && headUnderwater(centreY, oceanY);
      publishState(inWater, swimming, headSubmerged, underwater);
      lastDecision = { inWater, swimming, headSubmerged, underwater, onShore: false, oceanY };
      applyFlags(p, oceanY, swimming);
      p.swimming = swimming;   // ApplyDfuSwimFlags' LevitateMotor.IsSwimming - a change here cancels the next step, as DFU's does
      // ClampSurfaceAscent: rising stops with the centre at the sea + 0.55 - 1.25 + 0.93
      if (swimming && f.ascend && !p.levitating) {
        const ceiling = surfaceAscentCeiling(oceanY);
        if (centreOf(p) > ceiling) p.pos[1] = ceiling - p.height / 2;
      }
      keepSurfaceCameraUnsunk(p, underwater, oceanY, f.descend);
      return { swimming, headSubmerged, underwater };
    },

    /**
     * The frame's fog: DFU's UnderwaterFog over the host's own, with the
     * mod's density range and its neutral colour, while the presentation
     * is under water (ApplyUnderwaterPresentation); the host's own fog
     * otherwise (UpdateFog(10000) - the backup restored).
     * @param {{mode: string, density: number, start: number, end: number, color: number[]}} current
     */
    fog(current, cameraY, daylight) {
      const d = lastDecision;
      const s = settings();
      const oceanY = seaY();
      const under = !!d && d.underwater;
      fog.fogDensityMin = 0;
      fog.fogDensityMax = clamp(Math.max(underwaterFogDensityMax(s.fogStrength, s.fogDistance), lerp(0, 0.0012, clamp(s.fogStrength, 0, 1))), 0, 0.03);
      const level = under ? worldYToBlockWaterLevel(presentationWaterLineForFog(oceanY, cameraY)) : 10000;
      const out = fog.updateFog(level, cameraY, current);
      if (!under) return null;
      // ApplyNeutralUnderwaterFogColor: the fog colour's luminance, toward 0.045 by half the fog strength
      const c = underwaterFogColor(daylight);
      const lum = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
      const g = lerp(lum * 0.9, 0.045, clamp(s.fogStrength, 0, 1) * 0.5);
      return { ...out, color: [g, g, g] };
    },

    /**
     * UnderwaterDistanceFog.TryGetUnderwaterPresentation: the distance fog's
     * own "under" - the one the surfaces' shaders read too (their
     * _DeepWatersUnderwater) - wider than the swimmer's: a camera within a
     * quarter metre OVER the sea already counts, and so does a head in deep
     * water with no swim at all. The sea is the terrain's (always known
     * outdoors), or a column's under the camera or the player when that
     * stands 12 m off it. {under, oceanY}.
     * @param {{camera: number[], centre: number[], swimming: boolean, playing?: boolean}} f -
     *   the camera and the capsule's centre, world; IsExteriorSwimming (the
     *   host flag, the motor's swim, or its exterior water); IsPlayingGame
     *   (a pausing window up is none of it - absent reads as playing)
     */
    fogPresentation(f) {
      if (f.playing === false) return { under: false, oceanY: 0 };   // AUDIT DW-F: !IsPlayingGame - false, the out height 0 (IL_12020, IL_1203e)
      let oceanY = seaY();
      const local = rawColumnAt(f.camera[0], f.camera[2]);
      const c = local && local.depth > 0.25 ? local : rawColumnAt(f.centre[0], f.centre[2]);
      if (c && c.depth > 0.25 && Math.abs(oceanY - c.oceanY) > 12) oceanY = c.oceanY;
      if (f.camera[1] <= oceanY + 0.25) return { under: true, oceanY };
      if (swim.presentationUnderwater(oceanY, f.camera[1], f.centre[1])) return { under: true, oceanY };
      const headY = f.centre[1] + 0.95;
      if (f.swimming && headY <= oceanY - 0.15) return { under: true, oceanY };
      return { under: insideDeepWater(f.centre[0], headY, f.centre[2], oceanY, -0.25), oceanY };
    },

    /** IsPointInsideDeepWater (UnderwaterDistanceFog's; the presentation's head test shadows it all but at its edge). */
    insideDeepWater: (x, y, z, oceanY, pad) => insideDeepWater(x, y, z, oceanY, pad),
    /** DeepWaterWorld.HasNearbyWaterColumn. */
    hasNearbyColumn: (x, z, minDistance, maxDistance, directions, minimumDepth) => hasNearbyColumn(x, z, minDistance, maxDistance, directions, minimumDepth),

    get decision() { return lastDecision; },
  };

  /** IsPointInsideDeepWater: under the sea by the padding, over a column 0.25 deep or more and no more than 8 m under its floor - or, off every column, one within 36 m. */
  function insideDeepWater(x, y, z, oceanY, pad) {
    if (y > oceanY + pad) return false;
    const c = rawColumnAt(x, z);
    if (c) return c.depth > 0.25 && y <= c.oceanY + pad && y >= c.renderedSeafloorY - 8;
    return hasNearbyColumn(x, z, 4, 36, 8, 0.25);
  }
  /** HasNearbyWaterColumn: the point's own column, or one on a ring of `directions` at the near, the middle and the far radius. */
  function hasNearbyColumn(x, z, minDistance, maxDistance, directions, minimumDepth) {
    const deep = (px, pz) => { const c = rawColumnAt(px, pz); return !!c && c.depth >= minimumDepth; };   // TryGetWaterColumnDepth
    if (deep(x, z)) return true;
    const n = Math.max(1, directions);
    for (const r of [minDistance, (minDistance + maxDistance) * 0.5, maxDistance]) {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        if (deep(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true;
      }
    }
    return false;
  }
}
