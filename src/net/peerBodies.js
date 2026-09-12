// MWBODY1 (2026-09-12, Mac: "knock out the deferred morrowind model"):
// THE OTHERS, IN THE MORROWIND BODY. ONLINE1's brief - "if using
// enhanced, you would see the other person's Morrowind sprite" - was
// deferred because the rig was read as a singleton. It is not: the
// module exports one INSTANCE (`fpArm = createFpArm()`) of a factory,
// and every mutable the machine owns lives in the instance's closure;
// what the module keeps at its level (the ESM walk, the textures, the
// face matches, the garment colours, the clip reports, the icons) is
// keyed by content and shared by design. So a peer is one more
// `createFpArm()`: attached to the same renderer with its OWN camera
// callback (a stub fed from the peer's pose - the yaw, `mv` as the
// forward move and the run, so the movement slot picks the walk, the
// run or the idle), built through the same door the player's own arms
// are (buildFpArm, with the peer's look mapped onto the same inputs
// weaponRig's armBuildOptsOf maps the entity onto), switched to the
// third-person view, stepped once a frame, and drawn by its own
// drawThird at the peer's feet - the same sprite-box pass the player's
// body takes (MW-D24).
//
// THE GATE is the host's: the enhanced skin, the player's own arms
// switch (MWA1's `mwArms` pref - the layer is on when the arms are),
// and Morrowind data attached. Without all three, every peer keeps the
// paperdoll (remotePlayers.js) - and a peer whose body will not build
// (a race with no body records, a build that threw) keeps it too,
// retried after BODY_RETRY_MS, the reason kept. Bodies are capped at
// BODIES_MAX, the NEAREST peers first: a build parses meshes for
// seconds and holds a GPU mesh, so past the cap the rest stand as
// dolls. Builds run one at a time.
//
// AUDIT MWBODY (2026-09-12, the audit before the merge) added the
// LINGER (a peer leaving the drawable set - out of range, silent, a
// room change - keeps its body BODY_LINGER_MS before it is released,
// or a peer flickering at an edge rebuilt its body every flicker and
// the build queue never drained), the RANGE (past BODY_RANGE the rig
// sleeps and the doll stands - eight rigs posed and re-uploaded every
// frame for peers two kilometres off), the recenter shift (offsetAll,
// the floating origin's D5 law), the step bound (a snap read as a
// sprint), and the run bit from the wire in place of a speed guess
// that sat under every walk.
import { createFpArm } from '../combat/fpArm.js';
import { dfWornEquipment } from '../formats/mwItemMap.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { mwRaceId } from '../formats/mwNpc.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { peerStubEntity, lookKey } from './remotePlayers.js';
import { POSE_STRIKES } from './wire.js';   // MAC7 #1: the swing's kind, by the wire's index

/** The most peers in a Morrowind body at once; the rest keep the paperdoll. */
export const BODIES_MAX = 8;
/** A body that failed to build is not tried again before this. */
export const BODY_RETRY_MS = 30000;
/** A peer gone from the drawable set keeps its body this long before it is released. */
export const BODY_LINGER_MS = 15000;
/** Past this distance from the player (scene units) the rig sleeps and the doll stands. */
export const BODY_RANGE = 120;
/** A drawn pose farther than this from the last (scene units) is a jump, not a stride: the pace resets. */
export const JUMP_UNITS = 5;
/** A body farther than this factor beyond a bodiless nearer peer gives up its slot. */
export const SWAP_MARGIN = 1.25;
/** A peer's look change within this of its body's build keeps the body (a rebuild is seconds; a rejoin with new gear every second is not). */
export const BODY_REBUILD_MS = 10000;
/** The drawn yaw eases toward the pose's at this rate (a second) - a turn the rig can see every frame, not one that stops between poses. */
export const YAW_EASE = 12;

/** The rig's build options from a peer's look - the same inputs
 *  weaponRig.armBuildOptsOf maps the player's entity onto. `hasAmmo`
 *  is false by the wire: the look carries the equip table alone, and
 *  arrows are inventory, so a peer's drawn bow shows no arrow. */
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

/**
 * The camera the rig reads once a frame (world.js hands the player's
 * own in the same shape - { pos, yaw, pitch, sneaking, bob, move }):
 * the peer's yaw; `mv` as the forward move and, at 2, the run (the
 * wire's own bit, the sender's isRunning); the ground speed measured
 * off the drawn pose, which sets the clip's rate. The third-person
 * branch reads no eye and no pitch (the body stands level, vanilla's
 * law), so `pos` is the feet and `pitch` is 0. One object per body,
 * written in place each frame.
 */
export function peerCamera(shown, feet, speed = 0, cam = null) {
  const c = cam ?? { pos: [0, 0, 0], yaw: 0, pitch: 0, sneaking: false, bob: [0, 0], move: { forward: 0, strafe: 0, running: false, speed: 0, grounded: true, jumping: false, swimming: false, levitating: false } };
  const moving = !!shown.mv;
  c.pos[0] = feet[0]; c.pos[1] = feet[1]; c.pos[2] = feet[2];
  c.yaw = shown.yaw; c.pitch = 0;
  c.move.forward = moving ? 1 : 0;
  c.move.running = shown.mv === 2;
  c.move.speed = moving ? speed : 0;
  return c;
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;

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
  constructor({ renderer, enabled = () => true, createRig = createFpArm, buildOpts = peerBuildOpts, now = () => Date.now(), generation = () => 0, warn = (m) => console.warn(m) }) {
    this.renderer = renderer;
    this.enabled = enabled;
    this._generation = generation;   // the Morrowind data's generation: a re-attach releases every body built from the last (weaponRig's fpRecheck, for the peers)
    this._gen = generation();
    this._warn = warn;
    this._createRig = createRig;
    this._buildOpts = buildOpts;
    this._now = now;
    this._bodies = new Map();   // peer id -> { id, key, rig, state: 'building'|'ok', cam, feet, yaw, speed, goneAt, far, d2 }
    this._failed = new Map();   // lookKey -> { until, reason }
    this._queue = Promise.resolve();
  }

  /** Is this body standing for its peer: built, in range, its peer present, the rig live? */
  _standing(b) { return !!(b && b.state === 'ok' && b.goneAt == null && !b.far && b.feet && (b.rig.thirdActive?.() ?? true)); }

  /** Does this peer stand in a body (so the doll is not drawn for it)? */
  has(id) { return this._standing(this._bodies.get(id)); }

  /** The body's height over its feet - the capsule scaled by the race's own (MW-D34) - or 0 without a standing body: the name pass's head. */
  heightOf(id) { const b = this._bodies.get(id); return this._standing(b) ? CAPSULE_HEIGHT * (b.rig.raceHeightScale?.() ?? 1) : 0; }

  /** Why a look has no body, for a person, or null. */
  failureOf(look) { const f = this._failed.get(lookKey(look)); return f ? f.reason : null; }

  /**
   * Once a frame: the bodies of peers gone released past the linger,
   * a body per drawable peer within the cap - the nearest to `near`
   * first, a far body giving its slot to a nearer peer - its camera
   * fed from the pose, stepped by dt within BODY_RANGE.
   */
  sync(peers, toScene, dt, near = null) {
    if (!this.enabled()) { if (this._bodies.size) this.destroy(); return; }
    const gen = this._generation();
    if (gen !== this._gen) { this._gen = gen; this._failed.clear(); this.destroy(); }   // AUDIT MWBODY A9: new data, new bodies
    const now = this._now();
    const live = new Map();
    for (const peer of peers) if (peer?.shown) live.set(peer.id, peer);
    // the sweep first (the cap counts what stands, not what is leaving)
    for (const [id, b] of [...this._bodies]) {
      if (live.has(id)) { b.goneAt = null; continue; }
      if (b.goneAt == null) b.goneAt = now;
      else if (now - b.goneAt > BODY_LINGER_MS) this._release(id);
    }
    // the peers with a body: their feet, pace and camera
    for (const [id, b] of this._bodies) {
      const peer = live.get(id);
      if (!peer) continue;
      const key = lookKey(peer.look);
      if (b.key !== key && now - b.builtAt >= BODY_REBUILD_MS) { this._release(id); continue; }   // a new look is a new body (built below) - not oftener than BODY_REBUILD_MS
      this._place(b, peer, toScene, dt, near);
    }
    // the peers without one, nearest first, within the cap - a far body yields its slot
    const want = [];
    for (const [id, peer] of live) {
      if (this._bodies.has(id)) continue;
      const f = this._failed.get(lookKey(peer.look));
      if (f) { if (now < f.until) continue; this._failed.delete(lookKey(peer.look)); }
      const p = toScene(peer.shown);
      want.push({ peer, d2: near ? dist2(p, near) : 0 });
    }
    want.sort((a, b) => a.d2 - b.d2);
    for (const w of want) {
      if (this._bodies.size >= BODIES_MAX && !this._yield(w.d2)) break;
      const peer = w.peer;
      const b = { id: peer.id, key: lookKey(peer.look), rig: this._createRig(), state: 'building', cam: null, feet: null, yaw: peer.shown.yaw, speed: 0, goneAt: null, far: false, d2: w.d2, builtAt: now, swing: null, cast: null, ammo: null, weapon: null };
      this._bodies.set(peer.id, b);
      b.rig.attach(this.renderer, () => b.cam);
      this._place(b, peer, toScene, dt, near);
      this._queue = this._queue.then(() => this._build(b, peer.look)).catch(() => null);
    }
  }

  /** The farthest body - a lingering one first - gives its slot to a peer nearer by SWAP_MARGIN; true when a slot was freed. */
  _yield(d2) {
    let victim = null;
    for (const b of this._bodies.values()) {
      if (b.goneAt != null) { victim = b; break; }
      if (!victim || b.d2 > victim.d2) victim = b;
    }
    if (!victim) return false;
    if (victim.goneAt == null && !(victim.d2 > d2 * SWAP_MARGIN * SWAP_MARGIN)) return false;
    this._release(victim.id);
    return true;
  }

  /** A body's feet, pace, range and camera for this frame. */
  _place(b, peer, toScene, dt, near) {
    const f = toScene(peer.shown);
    if (b.feet) {
      const d = Math.hypot(f[0] - b.feet[0], f[2] - b.feet[2]);
      // the ground speed off the drawn pose, eased; a jump (a snap, a recenter missed) resets it rather than reading as a sprint
      if (d > JUMP_UNITS) b.speed = 0;
      else if (dt > 0) b.speed = b.speed * 0.8 + (d / dt) * 0.2;
    } else b.speed = 0;
    b.feet = f;
    // the yaw eased toward the pose's (AUDIT MWBODY A8): the rig reads turning off the yaw's change frame to frame,
    // and a pose eased over one send interval stops between arrivals, so the turn clip stuttered
    let dy = peer.shown.yaw - b.yaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    b.yaw += dy * (dt > 0 ? Math.min(1, dt * YAW_EASE) : 1);
    b.d2 = near ? dist2(f, near) : 0;
    b.far = !!near && b.d2 > BODY_RANGE * BODY_RANGE;
    b.cam = peerCamera({ ...peer.shown, yaw: b.yaw }, f, b.speed, b.cam);
    if (b.state === 'ok' && !b.far && dt > 0) {
      // AUDIT MWBODY A1: a throw from one peer's rig is that peer's doll, never the frame's end
      try {
        this._arm(b, peer.shown);
        b.rig.update(dt);
      } catch (e) { this._fail(b, `update threw: ${e?.message ?? e}`); }
    }
  }

  /** MAC7 #1 (Mac: "no weapons"): the weapon and the swing, off the wire's own bits - the rig's weapon drawn while
   *  the sender's is (setSheathed, the player's own rig's door), a swing once per count and never the count the body
   *  was born with (a late joiner does not replay an old blow), and release() every frame as weaponRig gives its own
   *  rig - a wind-up that is not held lets go on the next frame.
   *  MAC7 #2: the arrow (setWeapon with the wire's ammo bit, the same door weaponRig's per-frame read takes), the
   *  spell stance (readySpell, a boolean compare on the rig's side), a cast once per count with the wire's range,
   *  and the bow's hold - a swing that arrives with wd 2 is the draw (attack with hold), and release() waits while
   *  wd stays 2, exactly as weaponRig withholds it while the machine sits in StrikeUp. */
  _arm(b, shown) {
    const drawn = !!shown.wd;
    b.rig.setSheathed?.(!drawn);
    const am = shown.am ? 1 : 0;
    if (b.weapon && b.ammo !== am) { b.ammo = am; b.rig.setWeapon?.(b.weapon, { hasAmmo: !!am }); }
    b.rig.readySpell?.(!!shown.sr);
    const an = shown.an | 0, cn = shown.cn | 0;
    if (b.swing == null) { b.swing = an; b.cast = cn; }
    else {
      if (an !== b.swing) { b.swing = an; if (drawn) b.rig.attack?.(POSE_STRIKES[shown.as | 0] ?? 'StrikeDown', { hold: shown.wd === 2 }); }
      if (cn !== b.cast) { b.cast = cn; b.rig.castSpell?.(shown.cr | 0); }
    }
    if (shown.wd !== 2) b.rig.release?.();
  }

  /** A body that failed - refused, or threw - is released and its look waited out, the reason kept and said once. */
  _fail(b, reason) {
    this._failed.set(b.key, { until: this._now() + BODY_RETRY_MS, reason });
    try { this._warn(`[online] a peer's Morrowind body stands down - ${reason}`); } catch { /* a console is not the body's problem */ }
    this._release(b.id);
  }

  async _build(b, look) {
    if (this._bodies.get(b.id) !== b) return;   // released before its turn: no parse for a body already gone
    let res = null, reason = 'threw';
    try { const opts = this._buildOpts(look); b.weapon = opts.weapon ?? null; res = await b.rig.build(opts); } catch (e) { res = null; reason = `threw: ${e?.message ?? e}`; }
    if (this._bodies.get(b.id) !== b) { try { b.rig.unload(); } catch { /* gone */ } return; }   // released while building
    if (res && res.ok && b.rig.canThirdPerson() && b.rig.setViewMode('third')) { b.state = 'ok'; b.builtAt = this._now(); this._failed.delete(b.key); return; }
    if (res) reason = res.ok ? 'no third-person body' : `${res.stage}: ${res.error}`;
    this._fail(b, reason);
  }

  /** The bodies, after the local one (the same pass, MW-D24) - the standing ones. */
  draw(canvas, { proj, view, eye }) {
    let drawn = 0;
    for (const b of [...this._bodies.values()]) {
      if (!this._standing(b)) continue;
      // behind the eye (the view's z past the near side, with the body's own reach): nothing to draw - the sprite pass has no such test
      if (view && view.length === 16) {
        const f = b.feet, vz = view[2] * f[0] + view[6] * f[1] + view[10] * f[2] + view[14];
        if (vz > CAPSULE_HEIGHT) continue;
      }
      try { if (b.rig.drawThird(canvas, { proj, view, eye, feet: b.feet, yaw: b.yaw })) drawn++; } catch (e) { this._fail(b, `draw threw: ${e?.message ?? e}`); }   // AUDIT MWBODY A1
    }
    return drawn;
  }

  /** The floating origin moved under the scene: every body's feet follow it (D5's law for the dolls). */
  offsetAll(offset) {
    for (const b of this._bodies.values()) {
      if (!b.feet) continue;
      b.feet[0] += offset[0]; b.feet[1] += offset[1]; b.feet[2] += offset[2];
      if (b.cam) { b.cam.pos[0] += offset[0]; b.cam.pos[1] += offset[1]; b.cam.pos[2] += offset[2]; }
    }
  }

  _release(id) {
    const b = this._bodies.get(id);
    if (!b) return;
    this._bodies.delete(id);
    try { b.rig.unload(); } catch { /* a rig mid-build unloads when the build lands */ }
  }

  destroy() { for (const id of [...this._bodies.keys()]) this._release(id); }
}
