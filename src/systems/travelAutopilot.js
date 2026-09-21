// TO1: THE AUTOPILOT - PlayerAutoPilot.cs (MIT, Copyright (C) 2019
// Jedidia, contributor Hazelnut), the class Travel Options credits to
// Tedious Travel in its readme: "Credit to Jedidia for the autopilot
// class and some other logic I reused from Tedious Travel."
//
// It is the thing that WALKS the player. Every frame of an accelerated
// journey it answers two numbers - the yaw the body should face and
// the forward force to apply - and says when the destination rectangle
// has been reached. The mod drives the real player controller with
// them (`mouseLook.Yaw`, `InputManager.ApplyVerticalForce`), which is
// why an accelerated trip is a REAL walk across real terrain rather
// than a fade to black: the port does the same through
// `player.update(dt, { forward, ... }, cam.yaw, cam.pitch)`
// (scenes/world.js:9647-9669).
//
// PURE: it holds its own state and takes the player's position as
// numbers. No DOM, no renderer, no world reads - which is what lets
// the pins fly a whole journey across the Iliac Bay on a table.

/** PlayerAutoPilot.cs:20 - the destination rectangle is grown by this
 *  much on every side, "so fast travel cancels shortly before entering
 *  the location". World units: 800 of 32768 to a map pixel. Applied
 *  ONLY to a location destination (InitDestination, :62-73), never to
 *  the rect a caller hands in (InitTargetRect, :39-49). */
export const ARRIVAL_BUFFER = 800;

/** :117-121 - a yaw that swings more than this in one update means the
 *  target went past, so the journey counts as arrived. Degrees. */
export const OVERSHOOT_YAW_DEGREES = 5;

/** :125-129, CalculateYaw. The bearing FROM a world position TO
 *  another, in the game's own degrees (0 north, 90 east).
 *
 *  Written exactly as Jedidia wrote it - the arguments to atan2 are
 *  (from.X - to.X, from.Y - to.Y), which is the bearing from the
 *  TARGET back to the player, and the `+ 180` is what turns it around.
 *  Straightening that into one atan2 of the difference would give the
 *  same angle for every case but the exactly-coincident one, and this
 *  is a 1:1 port. `z` is the C#'s `.Y`: the port's world +z is DFU's
 *  world +y (world/streamingWorld.js keeps the axis names). */
export function calculateYaw(fromX, fromZ, toX, toZ) {
  const angleRad = Math.atan2(fromX - toX, fromZ - toZ);
  return angleRad * 180 / Math.PI + 180;
}

/** Unity's Rect.Contains - inclusive at the minimum, exclusive at the
 *  maximum (UnityEngine.Rect.Contains(Vector2)). The mod leans on it
 *  at :122 and at TravelOptionsMod.cs:610, :759-773. */
export function rectContains(rect, x, z) {
  return x >= rect.xMin && x < rect.xMax && z >= rect.zMin && z < rect.zMax;
}

/** A rect from a corner and a size, the shape `new Rect(x, y, w, h)`
 *  makes. The mod builds the plain path-target rect this way
 *  (TravelOptionsMod.cs:506, :700). */
export const rectOf = (x, z, w, h) => ({ xMin: x, zMin: z, xMax: x + w, zMax: z + h });

/** Unity's Rect.MinMaxRect. The four corner rects of a circumnavigation
 *  are built with it (TravelOptionsMod.cs:800-806). */
export const rectMinMax = (xMin, zMin, xMax, zMax) => ({ xMin, zMin, xMax, zMax });

/** Rect.center, truncated to ints as :43 and :66 truncate it. */
export function rectCentre(rect) {
  return {
    x: Math.trunc((rect.xMin + rect.xMax) / 2),
    z: Math.trunc((rect.zMin + rect.zMax) / 2),
  };
}

/** The port's own name for the mod's `int.MaxValue` sentinel pixel
 *  (:47, :58) - "no pixel seen yet", so the first Update re-aims. */
const NO_PIXEL = Number.MAX_SAFE_INTEGER;

export class TravelAutopilot {
  /** `targetPixel` {x, y} the destination MAP pixel; `targetRect` its
   *  world rectangle; `speedMultiplier` the forward force (1 reckless,
   *  0.8 cautious by default). `grow` adds the arrival buffer, which is
   *  what the location-summary constructor does and the rect
   *  constructor does not. */
  constructor(targetPixel, targetRect, speedMultiplier = 1, { grow = false, isLocation = false } = {}) {
    this.isLocation = !!isLocation;   // :155 - only a LOCATION destination turns the look at arrival
    this.onArrival = null;
    // AUDIT-TO1 K1: yawVector is a FIELD initialiser (:33, `new Vector3(0,
    // 0, 0)`), zeroed once when the object is made and never by
    // InitTargetRect (:40-50), which writes the pixel, the rect, the
    // centre, the multiplier, the sentinel, the flag and the pitch and
    // nothing else. BeginPathTravel reuses the autopilot leg after leg
    // (TravelOptionsMod.cs:711, `playerAutopilot.InitTargetRect`), and
    // an interrupt in the rest of that same Update - a foe, a low
    // fatigue - reads the latched bearing through MouseLookAtDestination
    // (:169-173): the player is left facing the way they were WALKING.
    // Zeroing it in the re-init snapped that camera to due north.
    this.yaw = 0;          // yawVector.y
    this.pitch = 0;        // :48 - mouseLook.Pitch = 0, and :143 holds it there every frame
    this.initTargetRect(targetPixel, targetRect, speedMultiplier, { grow });
  }

  /** :39-49, InitTargetRect - and :62-73's InitDestination, which is
   *  the same three lines with the buffer grown AFTER the centre is
   *  taken, so the centre stays the location's own. */
  initTargetRect(targetPixel, targetRect, speedMultiplier, { grow = false } = {}) {
    this.destinationMapPixel = { x: targetPixel.x, y: targetPixel.y };
    this.destinationCentre = rectCentre(targetRect);
    this.destinationWorldRect = grow
      ? { xMin: targetRect.xMin - ARRIVAL_BUFFER, xMax: targetRect.xMax + ARRIVAL_BUFFER,
        zMin: targetRect.zMin - ARRIVAL_BUFFER, zMax: targetRect.zMax + ARRIVAL_BUFFER }
      : { ...targetRect };
    this.speedMultiplier = speedMultiplier;
    this.lastPlayerMapPixel = { x: NO_PIXEL, y: NO_PIXEL };
    this.inDestinationMapPixel = false;
    this.pitch = 0;        // :48 - mouseLook.Pitch = 0, and :143 holds it there every frame
    // ...and NOT the yaw: see the constructor (AUDIT-TO1 K1).
  }

  /** :76-105, Update. Returns what the host must apply this frame:
   *  { yaw, pitch, forward, arrived }. `arrived` true means the mod's
   *  OnArrival event fired - the caller raises it and RETURNS, exactly
   *  as :80-84 returns before touching the orientation or the force.
   *
   *  THE ORDER IS THE MOD'S: the arrival test first and only while the
   *  player stands in the destination PIXEL; then the re-aim, which
   *  happens only when the pixel under the player changed; then the
   *  orientation and the force, every frame. */
  update({ worldX, worldZ, mapPixelX, mapPixelY }) {
    if (this.inDestinationMapPixel && this.isPlayerInArrivalRect(worldX, worldZ)) {
      // :155-157 - the look turns to the destination only for a real
      // location (`destinationSummary.ID != 0`), never for a path leg
      // or a map-coordinate target.
      if (this.isLocation) this.mouseLookAtDestination();
      this.onArrival?.();
      return { yaw: this.yaw, pitch: this.pitch, forward: 0, arrived: true };
    }
    if (mapPixelX !== this.lastPlayerMapPixel.x || mapPixelY !== this.lastPlayerMapPixel.y) {
      this.lastPlayerMapPixel = { x: mapPixelX, y: mapPixelY };
      this.setNewYaw(worldX, worldZ);
      this.inDestinationMapPixel = mapPixelX === this.destinationMapPixel.x && mapPixelY === this.destinationMapPixel.y;
    }
    // :101-104 - the mouse look is held off and the body is pushed
    // forward at the journey's speed multiplier.
    return { yaw: this.yaw, pitch: this.pitch, forward: this.speedMultiplier, arrived: false };
  }

  /** :112-123, IsPlayerInArrivalRect. Two answers in one method, and
   *  the first is the important one: if the bearing to the centre
   *  swung more than five degrees since the last update the player
   *  must have gone PAST the target, so that counts as arrival even
   *  though the rectangle test would say no. Otherwise the bearing is
   *  latched and the rectangle decides.
   *
   *  The latch is the same field SetNewYaw writes, which is why the
   *  mod's comment says the event "will be raised whenever player is
   *  inside destination rect when update is called". */
  isPlayerInArrivalRect(worldX, worldZ) {
    const yaw = calculateYaw(worldX, worldZ, this.destinationCentre.x, this.destinationCentre.z);
    const dy = Math.abs(yaw - this.yaw);
    if (dy > OVERSHOOT_YAW_DEGREES) return true;
    this.yaw = yaw;
    return rectContains(this.destinationWorldRect, worldX, worldZ);
  }

  /** :131-138, SetNewYaw. */
  setNewYaw(worldX, worldZ) {
    this.yaw = calculateYaw(worldX, worldZ, this.destinationCentre.x, this.destinationCentre.z);
  }

  /** :163-167, MouseLookAtDestination - `mouseLook.SetFacing(yaw, 0)`.
   *  Called at arrival for a location, and by InterruptTravel (:1300)
   *  for every journey, so a paused traveller is left looking the way
   *  they were going. The port's host writes cam.yaw/cam.pitch. */
  mouseLookAtDestination() {
    this.pitch = 0;
    return { yaw: this.yaw, pitch: 0 };
  }
}

// ── TO-FIELD / AUDIT-FIELD: THE GROUND THE JOURNEY WALKS ON ──────────
//
// The autopilot above answers a bearing and a force; it knows nothing
// about whether the ground under that bearing has been BUILT yet. On a
// streaming world it has not always: the streamer raises ONE map pixel
// per call and an accelerated journey crosses them at up to a hundred
// times walking pace, so the traveller can outrun the world and walk
// into the hole - which is what Mac saw ("Using travel options spawns
// you under the maps"). These two are that gate, kept PURE here for the
// same reason the autopilot is: the pins can drive them on a table
// instead of matching the host's source text, which is all the first
// cut of this fix had.

/** How far ahead of the traveller the ground must exist. `floor` is a
 *  distance that is comfortable at ordinary speed and far less than a
 *  map pixel; the FRAME's own reach is the real requirement, because a
 *  motor moves `speed * min(dt, maxFrameDt) * scale` in one go and the
 *  frame that hitches is exactly the frame the streamer is behind. */
export function travelLookaheadFor({ speed = 0, dt = 0, scale = 1, maxFrameDt = 0.25, floor = 64, margin = 1.5 }) {
  return Math.max(floor, speed * Math.min(dt, maxFrameDt) * Math.max(1, scale) * margin);
}

/** The journey's forward force, held while the ground is missing AND the
 *  streamer is still bringing it. `heightAt` answers a non-finite number
 *  over a pixel that is not built. With nothing in flight the ground is
 *  not coming and holding for ever would be its own bug, so the drive
 *  goes through - a hole that will never be filled is a build failure,
 *  not a reason to stand still until the sun goes out. */
export function travelDriveForward({ feet, yaw, lookahead, heightAt, streaming, forward }) {
  const ahead = [feet[0] + Math.sin(yaw) * lookahead, feet[2] + Math.cos(yaw) * lookahead];
  const standing = Number.isFinite(heightAt(feet[0], feet[2])) && Number.isFinite(heightAt(ahead[0], ahead[1]));
  return (!standing && streaming) ? 0 : forward;
}
