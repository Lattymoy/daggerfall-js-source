// MWBODY1 (2026-09-12, Mac: "knock out the deferred morrowind model"):
// THE OTHERS, IN THE MORROWIND BODY. ONLINE1's brief - "if using
// enhanced, you would see the other person's Morrowind sprite" - was
// deferred because the rig was read as a singleton. It is not: the
// module exports one INSTANCE (`fpArm = createFpArm()`) of a factory,
// and every mutable the machine owns lives in the instance's closure;
// what the module keeps at its level (the ESM walk, the textures, the
// face matches, the clip reports, the icons) is keyed by content and
// shared by design. So a peer is one more `createFpArm()`: attached to
// the same renderer with its OWN camera callback (a stub fed from the
// peer's pose - the yaw, and `mv` as the forward move, so the movement
// slot picks the walk and the idle otherwise), built through the same
// door the player's own arms are (buildFpArm, with the peer's look
// mapped onto the same inputs weaponRig's armBuildOptsOf maps the
// entity onto), switched to the third-person view, stepped once a
// frame, and drawn by its own drawThird at the peer's feet - the same
// sprite-box pass the player's body takes (MW-D24).
//
// THE GATE is the host's: the enhanced skin, the player's own arms
// switch (MWA1's `mwArms` pref - the layer is on when the arms are),
// and Morrowind data attached. Without any, every peer keeps the paperdoll
// (remotePlayers.js) - and a peer whose body will not build (a race
// with no body records, a build that threw) keeps it too, retried
// after BODY_RETRY_MS. Bodies are capped at BODIES_MAX: a build parses
// meshes for seconds and holds a GPU mesh, so past the cap the rest
// stand as dolls. Builds run one at a time.
import { createFpArm } from '../combat/fpArm.js';
import { dfWornEquipment } from '../formats/mwItemMap.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { mwRaceId } from '../formats/mwNpc.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { peerStubEntity, lookKey } from './remotePlayers.js';

/** The most peers in a Morrowind body at once; the rest keep the paperdoll. */
export const BODIES_MAX = 8;
/** A body that failed to build is not tried again before this. */
export const BODY_RETRY_MS = 30000;
/** The stub camera's eye over the feet (the third-person pose reads no eye, the arm's first-person laws do). */
export const PEER_EYE = CAPSULE_HEIGHT * 0.92;

/** The rig's build options from a peer's look - the same inputs weaponRig.armBuildOptsOf maps the player's entity onto. */
export function peerBuildOpts(look) {
  const stub = peerStubEntity(look);
  return {
    race: mwRaceId(stub.race),
    female: stub.gender === 'female',
    faceIndex: stub.faceIndex | 0,
    armor: dfWornEquipment(stub.equip.slots, EQUIP_SLOTS, ARMOR_ENUM),
    weapon: stub.equip.slots[EQUIP_SLOTS.RightHand] ?? null,
    hasAmmo: false,
  };
}

/** Past this ground speed (scene units a second) the peer runs. */
export const RUN_SPEED = 4.5;

/** The camera the rig reads once a frame (world.js hands the player's own
 *  in the same shape): the peer's yaw, its `mv` as the forward move -
 *  the movement slot (MW-D26) picks the walk from it, the idle without -
 *  and the ground speed measured off the drawn pose, which sets the
 *  clip's rate (a walk at the pace it is walked) and the run past RUN_SPEED. */
export function peerCamera(shown, feet, speed = 0) {
  const moving = !!shown.mv;
  return {
    pos: [feet[0], feet[1] + PEER_EYE, feet[2]], yaw: shown.yaw, pitch: 0, sneaking: false, bob: [0, 0],
    move: { forward: moving ? 1 : 0, strafe: 0, running: moving && speed > RUN_SPEED, speed: moving ? speed : 0, grounded: true, jumping: false, swimming: false, levitating: false },
  };
}

/** The peers of a session, each in a Morrowind body of its own. */
export class PeerBodies {
  /**
   * @param {object} p
   * @param {object} p.renderer
   * @param {() => boolean} [p.enabled]  the host's gate (the enhanced skin, the arms switch, Morrowind data)
   * @param {Function} [p.createRig]     createFpArm; a test hands in its own
   * @param {Function} [p.buildOpts]     peerBuildOpts
   * @param {Function} [p.now]
   */
  constructor({ renderer, enabled = () => true, createRig = createFpArm, buildOpts = peerBuildOpts, now = () => Date.now() }) {
    this.renderer = renderer;
    this.enabled = enabled;
    this._createRig = createRig;
    this._buildOpts = buildOpts;
    this._now = now;
    this._bodies = new Map();   // peer id -> { id, key, rig, state: 'building'|'ok', cam, feet, yaw, peer }
    this._failed = new Map();   // lookKey -> retry-after
    this._queue = Promise.resolve();
  }

  /** Does this peer stand in a body (so the doll is not drawn for it)? */
  has(id) { const b = this._bodies.get(id); return !!(b && b.state === 'ok'); }

  /** The body's height over its feet - the capsule scaled by the race's own (MW-D34) - or 0 without a body: the name pass's head. */
  heightOf(id) { const b = this._bodies.get(id); return b && b.state === 'ok' ? CAPSULE_HEIGHT * (b.rig.raceHeightScale?.() ?? 1) : 0; }

  /** Once a frame: a body per drawable peer within the cap, its camera fed from the pose, stepped by dt; the bodies of peers gone released. */
  sync(peers, toScene, dt) {
    if (!this.enabled()) { if (this._bodies.size) this.destroy(); return; }
    const live = new Set();
    for (const peer of peers) {
      if (!peer?.shown) continue;
      live.add(peer.id);
      const key = lookKey(peer.look);
      let b = this._bodies.get(peer.id);
      if (b && b.key !== key) { this._release(peer.id); b = null; }   // a new look is a new body
      if (!b) {
        if (this._bodies.size >= BODIES_MAX) continue;
        const retryAt = this._failed.get(key);
        if (retryAt != null && this._now() < retryAt) continue;
        b = { id: peer.id, key, rig: this._createRig(), state: 'building', cam: null, feet: null, yaw: 0, speed: 0, peer };
        this._bodies.set(peer.id, b);
        b.rig.attach(this.renderer, () => b.cam);
        this._queue = this._queue.then(() => this._build(b, peer.look)).catch(() => null);
      }
      const f = toScene(peer.shown);
      // the ground speed off the drawn pose, eased so a pose's arrival does not stutter the clip
      const step = b.feet && dt > 0 ? Math.hypot(f[0] - b.feet[0], f[2] - b.feet[2]) / dt : 0;
      b.speed = b.feet ? b.speed * 0.8 + step * 0.2 : 0;
      b.feet = f; b.yaw = peer.shown.yaw; b.cam = peerCamera(peer.shown, f, b.speed); b.peer = peer;
      if (b.state === 'ok') b.rig.update(dt);
    }
    for (const id of [...this._bodies.keys()]) if (!live.has(id)) this._release(id);
  }

  async _build(b, look) {
    let res = null;
    try { res = await b.rig.build(this._buildOpts(look)); } catch { res = null; }
    if (this._bodies.get(b.id) !== b) { try { b.rig.unload(); } catch { /* gone */ } return; }   // released while building
    const ok = !!(res && res.ok && b.rig.canThirdPerson() && b.rig.setViewMode('third'));
    if (ok) { b.state = 'ok'; return; }
    this._failed.set(b.key, this._now() + BODY_RETRY_MS);
    this._release(b.id);
  }

  /** The bodies, after the local one (the same pass, MW-D24). */
  draw(canvas, { proj, view, eye }) {
    let drawn = 0;
    for (const b of this._bodies.values()) {
      if (b.state !== 'ok' || !b.feet) continue;
      if (b.rig.drawThird(canvas, { proj, view, eye, feet: b.feet, yaw: b.yaw })) drawn++;
    }
    return drawn;
  }

  _release(id) {
    const b = this._bodies.get(id);
    if (!b) return;
    this._bodies.delete(id);
    try { b.rig.unload(); } catch { /* a rig mid-build unloads when the build lands */ }
  }

  destroy() { for (const id of [...this._bodies.keys()]) this._release(id); }
}
