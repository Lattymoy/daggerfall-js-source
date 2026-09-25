// ═══════════════════════════════════════════════════════════════════
// DW-D (2026-09-25): ILIAC PUDDLE NO MORE'S SWIM MOVEMENT
// (OutdoorSwimMovementController.cs, jet082, 1.2.2) - every frame the
// player swims ANYWHERE (the carved sea, or a dungeon's water: IsAnySwimming
// is LevitateMotor.IsSwimming too), and never inside the load grace:
//
//   the SPEED - the Swim Speed Multiplier setting (0.25 .. 30) as a walk
//     speed modifier (AddWalkSpeedMod), which DFU's swim speed is built on
//     (GetSwimSpeed(GetBaseSpeed())); the port's motor reads it as
//     swimSpeedScale;
//   the STROKE - Run's edge (either edge: press or release) with Enable
//     Swim Stroke on, off cooldown, with the fatigue for it: a burst along
//     the keys through the camera (or the look), leaned 0.65 by the float
//     keys, eased out over its duration, all at the multiplier's tempo;
//   the FLOOR - outdoors only, the capsule's centre kept 0.18 m over the
//     swimmable seafloor, or over the vanilla terrain of a distance-field
//     pixel when the correction is 2.5 m or less (ClampAboveRenderedSeafloor).
// ═══════════════════════════════════════════════════════════════════

import { STROKE, strokeTempoScale, strokeFatigueCost, strokeDirection, strokeVelocity } from '../world/deepWaterSwim.js';
import { maxFatigue } from '../systems/statMods.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** SeafloorSwimFloorClearance, MaxShoreClampCorrection. */
export const SEAFLOOR_CLEARANCE = STROKE.seafloorClearance;
export const MAX_TERRAIN_CLAMP_CORRECTION = STROKE.maxShoreClampCorrection;

/**
 * @param {object} deps
 * @param {() => object} deps.settings - {swimSpeedMultiplier, enableSwimStroke}
 * @param {object|(() => object)} deps.collider - the host's Collider, or a getter for it (the stroke is a swept move, MoveWithMovingPlatform)
 */
export function createSwimMovement({ settings, collider }) {
  const stroke = { remaining: 0, duration: STROKE.duration, next: 0, dir: null, wasHeld: false };
  const reset = () => { stroke.remaining = 0; stroke.duration = STROKE.duration; stroke.wasHeld = false; };
  /** ConsumeStrokeInputEdge: Run's press or release since the last read. */
  const consumeEdge = (run) => { const held = !!run; const edge = held !== stroke.wasHeld; stroke.wasHeld = held; return edge; };

  return {
    /** ResetStroke - and the speed modifier off (RemoveSpeedModifier). */
    reset(player) { reset(); if (player) player.swimSpeedScale = 1; },

    /**
     * OutdoorSwimMovementController.Update.
     * @param {object} f - {now (s), dt, player, entity, anySwimming, outdoorSwimming, loadGrace,
     *   input: {forward, strafe, up, down, run}, yaw, pitch, lookDir, cameraY, oceanY (null indoors),
     *   seafloorY: (x, z) => ?number (TryGetSwimmableSeafloorWorldY), vanillaGroundY: (x, z) => ?number}
     */
    update(f) {
      const p = f.player;
      if (!f.anySwimming || f.loadGrace) { p.swimSpeedScale = 1; reset(); return; }
      const s = settings();
      const mult = clamp(s.swimSpeedMultiplier, 0.25, 30);
      p.swimSpeedScale = mult;   // ApplySpeedMultiplier (a no-op modifier at 1)
      // HandleStrokeInput, in its short-circuit order: the switch, then the edge (ConsumeStrokeInputEdge - read and
      // spent even on a cooldown frame, never with the stroke switched off), then the cooldown, then the direction
      const tempo = strokeTempoScale(mult);
      if (s.enableSwimStroke && consumeEdge(f.input.run) && f.now >= stroke.next) {
        const dir = strokeDirection({ forward: f.input.forward, strafe: f.input.strafe, yaw: f.yaw, pitch: f.pitch, lookDir: f.lookDir, up: f.input.up, down: f.input.down, cameraY: f.cameraY, oceanY: f.oceanY });
        const cost = f.entity ? strokeFatigueCost(maxFatigue(f.entity)) : 0;   // raw units: MaxFatigue is (STR + END) x 64
        if (dir && f.entity && (f.entity.fatigue ?? 0) >= cost) {
          f.entity.fatigue = Math.min(maxFatigue(f.entity), Math.max(0, (f.entity.fatigue ?? 0) - cost));   // DecreaseFatigue(cost, false): SetFatigue's clamps, no x64
          stroke.dir = dir;
          stroke.duration = STROKE.duration / tempo;
          stroke.remaining = stroke.duration;
          stroke.next = f.now + STROKE.cooldown / tempo;
        }
      }
      // ApplyStrokeMotion: speed x 2.65 x tempo x the eased share, a tenth of a second at most per frame
      if (stroke.remaining > 0 && stroke.dir) {
        const v = strokeVelocity({ direction: stroke.dir, swimSpeed: p.swimSpeedNow(), tempo, remaining: stroke.remaining, duration: stroke.duration });
        const dt = Math.min(f.dt, STROKE.maxMoveDelta);
        const col = typeof collider === 'function' ? collider() : collider;
        col?.move(p.pos, v[0] * dt, v[1] * dt, v[2] * dt, p.height, false);   // MoveWithMovingPlatform: a bare Move, no ground snap
        stroke.remaining = Math.max(0, stroke.remaining - f.dt);
      }
      if (f.outdoorSwimming) clampAboveSeafloor(p, f);
    },
  };
}

/** ClampAboveRenderedSeafloor: the capsule's centre, 0.18 m over the swimmable floor - or over a distance-field pixel's own terrain, when that is no more than 2.5 m up. */
export function clampAboveSeafloor(p, f) {
  const centreY = p.pos[1] + p.height / 2;
  const floor = f.seafloorY(p.pos[0], p.pos[2]);
  if (floor != null) {
    const min = floor + SEAFLOOR_CLEARANCE;
    if (centreY < min) p.pos[1] = min - p.height / 2;
    return;
  }
  const ground = f.vanillaGroundY?.(p.pos[0], p.pos[2]);
  if (ground == null) return;
  const min = ground + SEAFLOOR_CLEARANCE;
  if (!(centreY >= min) && !(min - centreY > MAX_TERRAIN_CLAMP_CORRECTION)) p.pos[1] = min - p.height / 2;
}
