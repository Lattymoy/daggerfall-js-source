// @ts-check
// DRAGON-POV (2026-10-30, as the owner asked): MY DRAGON IN THIRD PERSON.
// The wheel out of the head on a dragon did nothing (a tamed dragon is a ride, and RIDE-POV held every ride but the 3D
// horse in the head) or showed my own body standing in the air under the saddle's picture (an Admin's /dragon). Out of
// the head on a dragon the camera stands back from the dragon the others see me on - its own sprite with its rider in
// the art, puppeted as net/remotePlayers.js puppets a peer's (DRAGON1), hovering at rest (DRAGON-HOVER) - and neither my
// body (player/mwView.js) nor the saddle (player/dragonSaddle.js) is drawn. The wheel reaches out to DRAGON_VIEW_REACH_M
// by the helm's ratio (player/seaZoom.js), about the rider's seat. Not a DFU member.
import { RemotePlayers } from '../net/remotePlayers.js';
import { POSE_RIDE } from '../net/wire.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { ridingDragon, dragonRideLook } from '../systems/staffDragon.js';
import { dragonMountOf, dragonLookOfItem } from '../systems/dragon/dragonMount.js';
import { mwViewThirdPerson, DRAGON_VIEW_REACH_M } from '../player/mwView.js';

export { DRAGON_VIEW_REACH_M };
/** The rider's seat over the dragon's feet, as a share of the drawn sprite's height - the camera's pivot. */
export const DRAGON_VIEW_SEAT = 0.75;
/** The seat's height (m) until the sprite's pictures are up. */
export const DRAGON_VIEW_SEAT_M = 4;
/** AURA-ON-DRAGON (2026-10-30, as the owner asked): how far under the rider's seat the ground a horse's rider
 *  stands on would be (m) - an aura and the armory hang a rider's rest pose over that ground lifted by the saddle's
 *  AURA_SADDLE_M (render/auraRing.js, render/armoryPose.js poseAtRest), so the dragon's rider wears them where the art
 *  sits them, never at the dragon's feet. */
export const DRAGON_AURA_DROP_M = 1.7;
/** The seat over a dragon's feet (m) by its sprite's drawn height `h` (DRAGON_VIEW_SEAT_M until it is up). Pure. */
export const dragonSeatOver = (/** @type {number} */ h) => (h > 0 ? h * DRAGON_VIEW_SEAT : DRAGON_VIEW_SEAT_M);
/** AURA-SEAT (2026-10-31, as the owner asked): WHERE THE ART SITS ITS RIDER, as a share of the sprite's height - the
 *  camera's pivot (DRAGON_VIEW_SEAT) stands over the rider's head, and an aura hung from it floated a dragon's height over
 *  him. The pictures (public/art/dwarven-dragon, 471x262 with the sky above the wings) seat the rider near 0.6 walking
 *  (records 0-19) and near 0.5 hovering (records 20-24, DRAGON-HOVER), the body lower in the beat. */
export const DRAGON_RIDER_SEAT = 0.6;
export const DRAGON_RIDER_SEAT_HOVER = 0.5;
/** The first hover record (characters/dwarvenDragonId.js DRAGON-HOVER). */
const HOVER_RECORD = 20;
/** The rider's seat share for a drawn record - a batch's `"record#frame"` key or the record. Pure. @param {unknown} record */
export const dragonRiderSeatShare = (record) =>
  parseInt(String(record ?? ''), 10) >= HOVER_RECORD ? DRAGON_RIDER_SEAT_HOVER : DRAGON_RIDER_SEAT;
/** AURA-ON-DRAGON: how far over a dragon's feet its rider's cosmetics stand (m), by its sprite's drawn height `h` and the
 *  record it draws (AURA-SEAT: the art's own seat, never the camera's). Pure.
 *  @param {number} h @param {unknown} [record] */
export const dragonAuraLift = (h, record) =>
  (h > 0 ? h * dragonRiderSeatShare(record) : DRAGON_VIEW_SEAT_M) - DRAGON_AURA_DROP_M;
/** Below this many metres a second the dragon stands (hovers) rather than walks. */
const MOVING_MPS = 0.3;

/** The dragon I sit, by the host's state: `{ look }` (1 the Aetherbright) or null on none - a tamed one ridden, or an
 *  Admin's /dragon. @param {any} player @param {any[] | null | undefined} items */
export function dragonRidden(player, items) {
  if (player?.riding && player.transportMode === TRANSPORT_MODES.Dragon)
    return { look: dragonLookOfItem(dragonMountOf(items)) };
  return ridingDragon() ? { look: dragonRideLook() } : null;
}

/** `deps` the texture pipeline (getTexture, uploadRecordFrame - the class sprite's two doors); `third()` whether the camera
 *  is out of the head (tests hand their own).
 *  @param {any} renderer @param {any} deps @param {() => boolean} [third] */
export function createDragonViewHost(renderer, deps, third = mwViewThirdPerson) {
  const layer = new RemotePlayers({ renderer, deps }); // no audio: my own dragon's sounds are the ride's
  /** @type {{ look: number } | null} */
  let ride = null;
  let shown = false;
  /** @type {number[] | null} */
  let lastFeet = null;
  let height = 0; // the sprite's drawn height (m), kept from the last frame it stood
  return {
    /** The frame's ride, read before the camera - mwViewFrame's `dragon`: the rider's seat over my feet (m), the camera's
     *  pivot, or 0 on no dragon. @param {any} player @param {any[]} items */
    ride(player, items) {
      ride = dragonRidden(player, items);
      return ride ? dragonSeatOver(height) : 0;
    },
    /** Each frame after the camera: my dragon stood at my `feet`, facing `yaw`, when the camera is out of the head, seen
     *  from `eye`. @param {ArrayLike<number>} feet @param {number} yaw @param {ArrayLike<number>} eye @param {number} dt */
    frame(feet, yaw, eye, dt) {
      const was = shown;
      shown = !!ride && third();
      if (!shown) {
        if (was) {
          lastFeet = null;
          layer.sync([]);
        }
        return;
      } // into the head, or off the dragon: its batch goes
      const speed =
        lastFeet && dt > 0 ? Math.hypot(feet[0] - lastFeet[0], feet[1] - lastFeet[1], feet[2] - lastFeet[2]) / dt : 0;
      const moving = speed > MOVING_MPS;
      lastFeet = [feet[0], feet[1], feet[2]];
      const shownPose = {
        x: feet[0],
        y: feet[1],
        z: feet[2],
        yaw,
        rd: POSE_RIDE.Dragon,
        rc: ride?.look || undefined,
        mv: moving ? 1 : 0,
      };
      layer.sync([{ id: 'self-dragon', shown: shownPose, look: null }], (p) => [p.x, p.y, p.z], {
        dt,
        eye: [eye[0], eye[1], eye[2]],
      });
      height = Math.abs(layer.batches()[0]?.size?.h ?? 0) || height;
    },
    /** Whether my dragon stands in the world this frame. */
    shown: () => shown,
    /** AURA-ON-DRAGON: how far over my feet my aura and armory stand this frame (m) - on my dragon drawn in the world, the
     *  rider's (dragonAuraLift); 0 in first person or off it, where my body is where my feet are. */
    auraLift: () => (shown ? dragonAuraLift(height, layer.batches()[0]?.record) : 0),
    /** Its batch, for the host's billboard pass (none in first person). */
    batches: () => (shown ? layer.batches() : []),
    /** Its batch onto the street's billboard list `out` (none in first person). @param {any[]} out */
    drawInto(out) {
      if (shown) for (const b of layer.batches()) out.push(b);
    },
  };
}
