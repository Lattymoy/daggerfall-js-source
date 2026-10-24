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
// (scenes/world.js:"crosses to zero and").
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

/** TRAVEL-NAV1: how far (x, z) stands from the rect - zero inside or on
 *  it. The steering (travelSteer.js) reads it so a town's walls BEHIND
 *  the arrival buffer are no reason to turn away from the town: the way
 *  only has to be clear as far as the rect the journey arrives in. */
export function rectDistance(rect, x, z) {
  const dx = Math.max(rect.xMin - x, 0, x - rect.xMax);
  const dz = Math.max(rect.zMin - z, 0, z - rect.zMax);
  return Math.hypot(dx, dz);
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

/** OW-ROAD-TRUE (2026-10-19, the owner: "Routes should always follow the road if planned, it should never offset"):
 *  THE ROAD'S LANE, PURSUED. The mod aims a leg ONCE a map pixel (Update re-aims only when the pixel under the player
 *  changes, :92-96) - a bearing from wherever the body stood as it crossed, straight at the leg's middle. With Avoid
 *  Obstacles off, whatever then turned the body off the road's line was carried at that bearing for up to a pixel - 819 m
 *  - beside the road; with it on (the default) TRAVEL-NAV1's BACK TO THE LINE takes the body back - but to the leg's OWN
 *  line, from wherever the leg began, and a leg that begins off the road (past a corner a frame's step at a hundred times
 *  walking pace overshot, a five-degree swing taken for an arrival, a resume) walks beside the road the whole leg: knocked
 *  near a corner, measured 102 m off it (AUDIT OW-REVISITED L2-6 - the first record named the mod's carry alone, which
 *  the default never meets). A leg on a road or a track walks
 *  its LANE instead (`lane`: the road's own line, its last leg's middle to its own - travelPaths.js: a road runs middle to
 *  middle): every frame the body aims at the point a short way ahead of where it stands along the line, so a body
 *  knocked off it is back on it within that distance, and the leg is arrived at where the line ends, not where a bearing
 *  happened to swing. The look ahead grows with the frame's step (a fast frame steers no zig-zag across the line).
 *  A departure from PlayerAutoPilot.cs's Update (:76-105), the Overworld's and First-Person Travel's routed legs alone -
 *  the mod's own journeys (a place straight, the follow key, the coordinates) keep its re-aim exactly. */
export const LANE_LOOK_MIN = 512;      // world units: a path's width (travelPaths.js P_SIZE) - back on the road within it
export const LANE_LOOK_MAX = 4096;     // ...and never more than a city block ahead, whatever the step
export const LANE_LOOK_STEPS = 3;      // three frames' steps ahead at speed
/** AUDIT OW-REVISITED L2-4 / L1-2: a frame never carries the body past the corner it is walking to - its force cut to
 *  land on it (the last frame's step the measure), down to this share at the least, so a corner is turned at the corner
 *  at any frame rate (a 30 fps x100 frame walked ten metres past a road's bend, a rider's street corner a building's
 *  width). A hitch the frame before cannot foresee is the one step not cut. */
export const LANE_CORNER_FORCE_MIN = 0.25;

/**
 * Where a body at (x, z) aims along a lane `{ ax, az, bx, bz }` (world units, a to b) looking `look` ahead: the point on
 * the segment `look` past the body's own projection onto it, clamped to its end, and `t` - that projection as a share of
 * the lane (0 at a, 1 at b; past 1, the lane is walked). A lane of no length aims at its end, walked.
 */
export function lanePursuit(x, z, lane, look) {
  const dx = lane.bx - lane.ax, dz = lane.bz - lane.az, len = Math.hypot(dx, dz);
  if (!(len > 0)) return { t: 1, x: lane.bx, z: lane.bz };
  const t = ((x - lane.ax) * dx + (z - lane.az) * dz) / (len * len);
  const u = Math.max(0, Math.min(1, t + look / len));
  return { t, x: lane.ax + dx * u, z: lane.az + dz * u };
}

/** The distance from (x, z) to the segment a-b. */
function segDistance(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - (ax + dx * u), z - (az + dz * u));
}

/**
 * OW-TOWN-WALK: the same pursuit along a LINE OF RUNS - `path` [[x, z], ...] (two points at least, world units), `seg`
 * the run the body walked last. The run moves on while the body's projection passes its end, or (AUDIT OW-REVISITED
 * L1-1) the body stands nearer the next run than this one - past a turn sharper than a right angle a body on the next
 * run still projects inside this one, and the walk hovered at the corner for ever (37% of the game's town ways turn so)
 * - never past the last; the aim is `look` ahead of the projection along the runs that follow, clamped to the line's
 * end. `end` once the body has passed the last run's end. A street's way through a town is walked as one line: no stop
 * at each turn.
 */
export function pathPursuit(x, z, path, seg, look) {
  const last = path.length - 2;
  let k = Math.max(0, Math.min(last, seg | 0));
  let t = 0;
  for (;;) {
    const [ax, az] = path[k], [bx, bz] = path[k + 1];
    t = lanePursuit(x, z, { ax, az, bx, bz }, 0).t;
    if (k < last && (t >= 1 || segDistance(x, z, bx, bz, path[k + 2][0], path[k + 2][1]) < segDistance(x, z, ax, az, bx, bz))) { k++; continue; }
    break;
  }
  let i = k, at = Math.max(0, Math.min(1, t)), left = look;
  for (;;) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const rest = (1 - at) * len;
    if (left <= rest || i === last) {
      const u = len > 0 ? Math.min(1, at + left / len) : 1;
      return { seg: k, t, x: ax + (bx - ax) * u, z: az + (bz - az) * u, end: t >= 1 };   // past 1 only on the last run - the runs before it moved on
    }
    left -= rest; i++; at = 0;
  }
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
  constructor(targetPixel, targetRect, speedMultiplier = 1, { grow = false, isLocation = false, edgeArrival = false, lane = null, path = null, lookMin = LANE_LOOK_MIN, lookMax = LANE_LOOK_MAX } = {}) {
    this.isLocation = !!isLocation;   // :155 - only a LOCATION destination turns the look at arrival
    // TRAVEL-NAV1: the arrival buffer across a pixel edge (see update).
    this.edgeArrival = !!edgeArrival;
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
    this.initTargetRect(targetPixel, targetRect, speedMultiplier, { grow, lane, path, lookMin, lookMax });
  }

  /** :39-49, InitTargetRect - and :62-73's InitDestination, which is
   *  the same three lines with the buffer grown AFTER the centre is
   *  taken, so the centre stays the location's own. */
  initTargetRect(targetPixel, targetRect, speedMultiplier, { grow = false, lane = null, path = null, lookMin = LANE_LOOK_MIN, lookMax = LANE_LOOK_MAX } = {}) {
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
    // OW-ROAD-TRUE: a road's leg walks its line; OW-TOWN-WALK: a street's way its runs - one law, a line of points
    this.path = path?.length >= 2 ? path.map((q) => [q[0] ?? q.x, q[1] ?? q.z]) : lane ? [[lane.ax, lane.az], [lane.bx, lane.bz]] : null;
    this.seg = 0;
    this.lookMin = lookMin;   // OW-TOWN-WALK: a street's corner is met at its corner - its look ahead a step or two, never a road's width
    this.lookMax = Math.max(lookMin, lookMax);   // AUDIT OW-REVISITED L1-2: ...and a street's never more, whatever the step (a rider's three steps cut the corner)
    this.lastAt = null;    // OW-ROAD-TRUE: where the body stood at the last update - the frame's step, the look ahead's measure
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
    if (this.path) return this.laneUpdate(worldX, worldZ);   // OW-ROAD-TRUE: a road's leg, along its lane (OW-TOWN-WALK: a street's runs)
    // TRAVEL-NAV1: THE BUFFER THAT CROSSES A PIXEL EDGE. The arrival test
    // runs only in the destination PIXEL (:80), and a location eight
    // blocks across fills its pixel (terrainTiles.js
    // getLocationTerrainTileOrigin centres it: (128 - 8 * 16) / 2 = 0), so
    // its ARRIVAL_BUFFER lies wholly in the neighbours - a traveller came
    // up to the walls, crossed into the pixel AT them, and only then asked
    // whether it had arrived. With the port's steering on, the grown rect
    // is also an arrival outside the pixel - plain containment, no
    // overshoot arm (the bearing latch belongs to the pixel test).
    if (this.edgeArrival && !this.inDestinationMapPixel && rectContains(this.destinationWorldRect, worldX, worldZ)) {
      if (this.isLocation) this.mouseLookAtDestination();
      this.onArrival?.();
      return { yaw: this.yaw, pitch: this.pitch, forward: 0, arrived: true };
    }
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

  /** OW-ROAD-TRUE: a road's leg - arrived inside its rect (a place's, grown, turns the look as the mod's arrival does) or
   *  once the body's projection passes the lane's end; else aimed along the lane every frame (lanePursuit). No bearing
   *  latch: the yaw swings as the line asks, so the mod's overshoot test (a five-degree swing, below) is no arrival here.
   *  AUDIT OW-REVISITED: a PLACE is arrived at inside its rect alone (L2-1: its line's end, a pixel's middle, lies outside
   *  the main quest's eight off-middle dungeons and behind a body resumed past it - "arrived" fifty metres short); a line
   *  of runs only on its last (L1-9: a way that bends back passes its end's square on the far side of a building); and the
   *  force is cut to land on the run's end (LANE_CORNER_FORCE_MIN). */
  laneUpdate(worldX, worldZ) {
    const step = this.lastAt ? Math.hypot(worldX - this.lastAt.x, worldZ - this.lastAt.z) : 0;
    this.lastAt = { x: worldX, z: worldZ };
    const look = Math.max(this.lookMin, Math.min(this.lookMax, LANE_LOOK_STEPS * step));
    const p = pathPursuit(worldX, worldZ, this.path, this.seg, look);
    this.seg = p.seg;
    const lastRun = p.seg >= this.path.length - 2;
    if ((lastRun && rectContains(this.destinationWorldRect, worldX, worldZ)) || (p.end && !this.isLocation)) {
      if (this.isLocation) this.mouseLookAtDestination();
      this.onArrival?.();
      return { yaw: this.yaw, pitch: this.pitch, forward: 0, arrived: true };
    }
    this.yaw = calculateYaw(worldX, worldZ, p.x, p.z);
    const [ex, ez] = this.path[p.seg + 1], toEnd = Math.hypot(ex - worldX, ez - worldZ);
    const cut = step > 0 && toEnd < step && p.t < 1 ? Math.max(LANE_CORNER_FORCE_MIN, toEnd / step) : 1;
    return { yaw: this.yaw, pitch: this.pitch, forward: this.speedMultiplier * cut, arrived: false };
  }

  /** AUDIT OW-REVISITED L2-5: the bearing of the run a line's leg is on (degrees, the yaw's own) - what a held strafe
   *  walks beside (travelSteer.js steerDrive: TRAVEL-STRAFE's sidestep kept while the key is held), or null for a leg
   *  that walks no line. */
  get runYaw() {
    if (!this.path) return null;
    const [ax, az] = this.path[this.seg], [bx, bz] = this.path[this.seg + 1];
    return ax === bx && az === bz ? null : calculateYaw(ax, az, bx, bz);
  }

  /** OW-TOWN-WALK: where the steering's own line runs to (travelSteer.js steerDrive) - a leg that walks a line, the end
   *  of the run it is on (a street's corner, a road's middle), so its feelers' line and its headway are the run's; any
   *  other leg, the target's centre as ever. */
  get steerTarget() {
    if (!this.path) return this.destinationCentre;
    const q = this.path[Math.min(this.seg + 1, this.path.length - 1)];
    return { x: q[0], z: q[1] };
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
