// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LEGACY7 part four (2026-10-06, bible/06-Systems/Legacy-Arc.md section 10b) - THE LINE IN ITS OWN BODY.
//
// LEGACY-HOME recorded a departure and named who owed it: "the design asked for their own race and kit, the way an
// online peer is drawn; the street's walkers are the census's billboards, and a peer's composite body is the realm's
// renderer - that is LEGACY7's to bring". This brings it. A member of the line standing in the world whose newest save
// wrote down their LOOK (scenes/legacyHost.js writeCurrent - the hello's own recipe, systems/legacy/family.js
// memberLook) is drawn as an online peer is drawn on this screen: a Morrowind body where this client stands those
// (net/peerBodies.js - the enhanced lane with the data attached), else their class's sprite or their paperdoll as the
// 'Other players' card says (net/remotePlayers.js). A member never played has no look and wears the town's outfit, as
// before. Each is drawn by layers of their own - no footstep, no swing heard: a townsperson's steps are the town's.
//
// The walker (the street) and the room's seat (indoors) stay the member's TALK TARGET; only the picture moves here.
// ═══════════════════════════════════════════════════════════════════
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';

/** A member's id among the peer layers' - never a relay id (those are the wire's ID_RE, with no colon). */
export const familyPeerId = (resId) => `fam:${resId}`;

/** A member's pose as the peer layers read one: the scene's own point (the layers' `toScene` is the identity here), the
 *  yaw, the move bit. */
export const familyShown = (feet, yaw, moving, st = 0) => ({ x: feet[0], y: feet[1], z: feet[2], yaw: Number.isFinite(yaw) ? yaw : 0, mv: moving ? 1 : 0, ...(st > 0 ? { st } : {}) });   // CARDS4b: `st` seated (a card table's regular), the pose's own byte
const sceneOf = (/** @type {any} */ s) => [s.x, s.y, s.z];

/**
 * The line's bodies for one place (the street, or a room): stood each frame between `begin` and `end`.
 * @param {{ dolls: any, bodies?: any }} layers - a RemotePlayers of the line's own (no sound) and a PeerBodies
 */
export function createFamilyBodies({ dolls, bodies = null }) {
  /** @type {any[]} */
  const peers = [];
  return {
    /** A frame begins: nobody stands yet. */
    begin() { peers.length = 0; },
    /**
     * One of the line at `feet` (the scene's frame), facing `yaw`, walking or not. True when they are drawn here - the
     * caller draws its own sprite for them no more this frame. A resident with no look is not.
     * @param {any} res @param {number[]} feet @param {number} yaw @param {boolean} moving @param {number} [st] seated - the pose's seat byte
     */
    stand(res, feet, yaw, moving, st = 0) {
      if (!res?.look || !feet) return false;
      peers.push({ id: familyPeerId(res.id), look: res.look, shown: familyShown(feet, yaw, moving, st) });
      return true;
    },
    /** The frame ends: the Morrowind bodies first, then a class sprite or a paperdoll for whoever stands in none. */
    end(/** @type {number} */ dt, /** @type {number[]|null} */ eye) {
      bodies?.sync(peers, sceneOf, dt, eye);
      dolls.sync(peers, sceneOf, { bodyHeight: (/** @type {string} */ id) => bodies?.heightOf(id) ?? 0, dt, eye });
    },
    /** This frame's sprites and dolls, for the pass that draws the place's people. */
    batches: () => dolls.batches(),
    /** The Morrowind bodies, in the bodies' pass. */
    draw(/** @type {any} */ canvas, /** @type {any} */ o) { bodies?.draw(canvas, o); },
    /** The floating origin moved: everything drawn follows it (the peer layers' own law, AUDIT ONLINE D5). */
    offsetAll(/** @type {number[]} */ o) {
      for (const b of dolls.batches()) { b.origin[0] += o[0]; b.origin[1] += o[1]; b.origin[2] += o[2]; }
      bodies?.offsetAll(o);
    },
    /** Everything freed (the place left). */
    clear() { peers.length = 0; dolls.sync([], sceneOf); bodies?.destroy(); },
    /** AUDIT CARDS-3 B10: the layer let go for good - every doll texture released too (clear keeps the dolls' cache for
     *  the next stand; a layer dropped after clear took its textures with it, an evening's regulars at a time). */
    destroy() { peers.length = 0; dolls.destroy?.(); bodies?.destroy(); },
    /** How many of the line stood this frame. */
    get size() { return peers.length; },
  };
}

/**
 * A ROOM'S SPRITES WITH THE LINE IN ITS OWN BODY (scenes/livingIndoors.js's `sprites`): one of the line with a look is
 * stood in `family` and keeps a talk seat of its own here (the room's own shape: `nameNPC`, `personFaceRecordId`,
 * `_talkSeed`, `living`); everyone else goes to the room's own sprites (world/travellerSprites.js) as before.
 * @param {any} sprites - the room's createTravellerSprites @param {ReturnType<typeof createFamilyBodies>} family
 * @param {any} [living] - the room's talk door (the person's `living.town`, as travellerSprites hands it)
 */
export function familyRoomSprites(sprites, family, living = null) {
  /** @type {{ person: any, pos: number[] }[]} */
  const seats = [];
  /** key -> the member's talk target, kept while they stand (a hand in their purse is remembered) */
  const persons = new Map();
  const personOf = (key, res, feet, yaw) => {
    let p = persons.get(key);
    if (!p || p.living.res !== res) {
      p = { nameNPC: res.name, personFaceRecordId: res.face, _talkSeed: lwSeed(textSeed(res.id), 0x74616c6b) & 0x7fffffff,
        living: { id: res.id, res, town: living }, pos: [0, 0, 0], facingYaw: 0, guard: false, archive: res.archive, pickpocketAttempted: false };
      persons.set(key, p);
    }
    p.pos = feet; p.facingYaw = yaw;
    return p;
  };
  return {
    /** One frame: the line's to their bodies, the rest to the room's sprites. @param {any[]} list @param {any} [o] */
    sync(list, o = {}) {
      family.begin();
      seats.length = 0;
      const rest = [];
      const here = new Set();
      for (const m of list ?? []) {
        if (m?.res && m.feet && family.stand(m.res, m.feet, m.yaw, !!m.moving)) {
          here.add(m.key);
          seats.push({ person: personOf(m.key, m.res, m.feet, m.yaw), pos: m.feet });
          continue;
        }
        rest.push(m);
      }
      for (const key of [...persons.keys()]) if (!here.has(key)) persons.delete(key);
      sprites.sync(rest, o);
      family.end(o.dt ?? 0, o.eye ?? null);
    },
    batches: () => [...sprites.batches(), ...family.batches()],
    persons: () => [...sprites.persons(), ...seats],
    bodyOf: (/** @type {string} */ key) => sprites.bodyOf?.(key) ?? null,
    /** MWNPC10c: the rest's Morrowind bodies (the line's are the family's). */
    drawBodies(canvas, proj, view, eye, dt) { sprites.drawBodies?.(canvas, proj, view, eye, dt); },
    clear() { sprites.clear(); family.clear(); seats.length = 0; persons.clear(); },
    get size() { return (sprites.size ?? 0) + family.size; },
  };
}
