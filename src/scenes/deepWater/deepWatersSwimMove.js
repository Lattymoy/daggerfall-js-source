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

import { STROKE, strokeTempoScale, strokeFatigueCost, strokeDirection, strokeVelocity } from '../../world/deepWater/deepWaterSwim.js';
import { maxFatigue } from '../../systems/statMods.js';
import { EXACT_SWEEP_MAX } from '../../player/collider.js';   // AUDIT DISC28 MO-3: the longest motion one move() sweeps exactly

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** AUDIT DISC28 MO-3: the most pieces one frame's stroke is handed over in. Eight sweeps of EXACT_SWEEP_MAX is over
 *  five hundred metres - the settings' worst is two - and a piece count must never be a loop a caller's arithmetic
 *  chooses (AUDIT ONCRASH1 B5a). */
const STROKE_PIECES_MAX = 8;
/** AUDIT DISC28 MO-3 (the pre-merge audit, 2026-09-28): ONE STROKE IS ONE SWEEP, HOWEVER LONG. ApplyStrokeMotion moves
 *  through MoveWithMovingPlatform - one CharacterController.Move, which sweeps the whole motion and never crosses a
 *  surface. The port's move() sweeps exactly only up to EXACT_SWEEP_MAX and takes the rest whole, and the stroke is the
 *  one motion that passes it: at the Swim Speed Multiplier's top (30 - offline; the online lane holds it at 1) a fast
 *  swimmer's stroke in a frame of 0.1 s is over a hundred metres, whose substeps were wider than the capsule and carried
 *  it straight up through any ceiling (measured: from under a ceiling to 114 m up, in one frame). So a frame's
 *  stroke goes to the collider in pieces it sweeps exactly. Every stroke that fits one sweep - every stroke at the
 *  settings anyone walks with, and any motion that is not a finite number - is the one move it always was. */
function strokeMove(col, p, dx, dy, dz) {
  const m = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  const n = Number.isFinite(m) ? Math.min(STROKE_PIECES_MAX, Math.max(1, Math.ceil(m / EXACT_SWEEP_MAX))) : 1;
  for (let i = 0; i < n; i++) col.move(p.pos, dx / n, dy / n, dz / n, p.height, false);   // MoveWithMovingPlatform: a bare Move, no ground snap
}
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
        if (col) strokeMove(col, p, v[0] * dt, v[1] * dt, v[2] * dt);   // AUDIT DISC28 MO-3: swept whole, as one Move is
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
