// @ts-check
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
// THE GATE is the host's: the enhanced skin and Morrowind data
// attached (MWA4: the files are the arms' switch - MWA1's `mwArms` pref
// is retired). Without both, every peer keeps the
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
//
// WB9h (2026-09-30, Mac: "Further improve the morrowind model performance
// as it's unplayable with so many players around"): A CROWD.
// tools/peerCrowdProbe.mjs stood forty players milling round the eye for
// thirty seconds: 81 bodies BUILT - the first eight, then one torn down
// and another built every few hundred milliseconds as the nearest eight
// reshuffled, up to 24 in five seconds, each a multi-second mesh parse on
// a retail body, all on one queue - 68 of them torn down while their
// player still stood within 25 m, and every body skinned and drawn
// whether or not the eye could see it. Four laws now:
//   THE VIEW - a body out of the view (its sphere past a side of the last
//     body pass's frustum, viewPlanes; CULL_MARGIN_M to spare for the
//     skin) is neither drawn nor skinned: its clocks run, and it is posed
//     the moment it is seen - in the draw, when the view swung onto it
//     faster than the margin.
//   THE BUDGET - at most SKIN_BUDGET bodies are skinned a frame, the most
//     overdue and then the nearest first; the rest keep last frame's skin
//     and are owed the next. A body with no skin to keep poses regardless.
//   THE SWAP - a nearer bodiless stranger takes a stranger's body only
//     once it has wanted one SWAP_DWELL_MS, no oftener than SWAP_EVERY_MS,
//     and not while another body builds unless a spare stands for it. A
//     party mate takes a stranger's outright (AUDIT PARTY8), and a
//     lingering body gives its slot to anyone, as before.
//   THE SPARES - a body given up in a swap keeps its built rig SPARE_MS
//     (at most SPARE_MAX of them): the next peer who wears the same body -
//     its look and its form - stands in it at once, with no build.
import { createFpArm } from '../combat/fpArm.js';
import { dfWornEquipment } from '../formats/mwItemMap.js';
import { werewolfSkinOf } from '../characters/werewolfSkin.js';   // SHADOW-FANG: a peer's wolf in the skin their signed glyphs name
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { mwRaceId } from '../formats/mwNpc.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { peerStubEntity, lookKey } from './remotePlayers.js';
import { POSE_STRIKES } from './wire.js';   // MAC7 #1: the swing's kind, by the wire's index
import { HIT_FRAME_MELEE, MELEE_NUM_FRAMES } from '../characters/weaponStates.js';   // MW-PACE1: where in a blow its hit lands
import { wrapAngle } from '../world/mat4.js';   // ONCRASH1: the port's one angle wrap, which cannot loop
import { seatTopOf } from '../player/seatPose.js';   // CARDS2b: the table's top the pose names
import { JUMP_UNITS, stepPeerPace } from './peerPace.js'; import { peerBodyYaw, peerClimbing, peerMoving, PeerClimbTrack } from './peerClimb.js';   // HT-WAIST-BACK: the pace law, lifted - the walkers' lanterns swing off it too; CLIMB5: the climb's facing and pose


/** The most peers in a Morrowind body at once; the rest keep the paperdoll. */
export const BODIES_MAX = 8;
/** MWNPC4: THE PAGE'S ONE BUILD QUEUE - every body lane a host stands (the peers, the family, the card table, the NPCs)
 *  passes it as `gate`, so the lanes' builds run one after another as one lane's always did. */
export const BODY_BUILD_GATE = { chain: Promise.resolve() };
/** A body that failed to build is not tried again before this. */
export const BODY_RETRY_MS = 30000;
/** A peer gone from the drawable set keeps its body this long before it is released. */
export const BODY_LINGER_MS = 15000;
/** Past this distance from the player (scene units) the rig sleeps and the doll stands. */
export const BODY_RANGE = 120;
/** A drawn pose farther than this from the last (scene units) is a jump, not a stride: the pace resets (net/peerPace.js). */
export { JUMP_UNITS };
/** A body farther than this factor beyond a bodiless nearer peer gives up its slot. */
export const SWAP_MARGIN = 1.25;
/** A peer's look change within this of its body's build keeps the body (a rebuild is seconds; a rejoin with new gear every second is not). */
export const BODY_REBUILD_MS = 10000;
/** A strike the rig refused (an equip in flight, a shot still releasing) is asked again this many frames, then dropped (AUDIT WORLD C3). */
export const PENDING_FRAMES = 60;
/** MW-PACE1 (Mac: "Morrowind attack animations don't scale with attack speed/multiple attacks when attack speed is
 *  high"): A PEER'S BLOW, PACED BY ITS OWN GAPS. The wire carries a swing's count and kind, not the sender's Speed - but
 *  a held button keeps swinging (WeaponSwingMode 2), and the sender's machine starts each blow the frame after the last
 *  is done, so the gap between two counts IS the sender's blow. A burst's shortest gap paces its blows (a pause in a
 *  fight only lengthens a gap), its hit two fifths in (the machine's HIT_FRAME_MELEE of MELEE_NUM_FRAMES); a gap past
 *  PEER_BLOW_MAX_S (seconds) ends the burst, and its first blow keeps the record's pace. The bounds: the slowest blow
 *  the swing law draws (characters/weaponStates.js SWING_FRAME_MAX, 2 s) with a pose's lag on top, and under the
 *  fastest (0.45 s) by a pose's jitter. */
export const PEER_BLOW_MIN_S = 0.3;
export const PEER_BLOW_MAX_S = 2.2;
/** The burst's pace after a gap of `gapS` seconds (null: none yet), and the schedule a blow is fitted into. Pure. */
export function peerBlowPace(pace, gapS) {
  if (!(gapS >= 0) || gapS > PEER_BLOW_MAX_S) return null;
  const g = Math.max(PEER_BLOW_MIN_S, gapS);
  return pace == null ? g : Math.min(pace, g);
}
export const peerBlow = (pace) => (pace == null ? null
  : { seconds: pace, hitAt: (pace * HIT_FRAME_MELEE) / MELEE_NUM_FRAMES.StrikeDown });
/** The drawn yaw eases toward the pose's at this rate (a second) - a turn the rig can see every frame, not one that stops between poses. */
export const YAW_EASE = 12;
/** PEER-CADENCE (2026-09-22, Mac: "look for ways to improve online performance"): how many frames apart a body's
 *  SKIN is re-posed, by its distance from the eye (scene units, metres) - `[within, every]`, the first row that
 *  holds. The clips advance every frame regardless (the rig's `pose: false`); what waits is poseAssembly, the mesh
 *  upload and the particle step, the whole of a body's CPU cost (PERF-RIG1: ~0.3 ms a body a frame at 3,000
 *  vertices, and eight bodies at once). The pose comes off the wire at POSE_HZ (10 a second) and the body is drawn
 *  as a MW_ARM_PIXEL sprite, so a skin every third frame (20 Hz at 60 fps) beyond 25 m is still twice the wire and
 *  under the block; within 10 m every frame, where a swing's arc is read. */
export const POSE_CADENCE = [[10, 1], [25, 2], [Infinity, 3]];
/** WB9h: the most bodies SKINNED in one frame - the rest keep last frame's skin and are owed the next (a body with no
 *  skin to keep poses whatever this says). Four at 60 fps is every body of eight at least every other frame - thrice
 *  the wire's rate. */
export const SKIN_BUDGET = 4;
/** WB9h: a bodiless stranger wants a body this long before it may take a stranger's, and a body is handed over no
 *  oftener than this - a build is seconds on a retail body, and a crowd milling reshuffles its nearest eight faster. */
export const SWAP_DWELL_MS = 2500;
export const SWAP_EVERY_MS = 4000;
/** WB9h: a body given up in a swap keeps its built rig this long, at most SPARE_MAX of them, for the next peer who wears
 *  the same body. */
export const SPARE_MS = 60000;
export const SPARE_MAX = 4;
/** WB9h: a body's sphere for the view's test - about its middle, this share of its height round it - and the margin the
 *  SKIN's test adds (metres), so a body the view is swinging onto is posed before it comes into sight. */
export const BODY_SPHERE_SHARE = 0.75;
export const CULL_MARGIN_M = 2;
/** MW-CROWD (FIELD BUGS 2026-10-01 #8, "Culling performance issues when using the morrowind model and around a large
 *  group of players"): THE MARGIN LEADS A TURNING EYE. The skins are decided on the LAST pass's view, and a body the
 *  view swung onto past CULL_MARGIN_M arrived stale and was posed in the draw, outside SKIN_BUDGET - at 300 degrees a
 *  second and 30 frames a crowd's every body swung onto posed in one frame (a CPU skin and a whole re-upload each). The
 *  margin grows by the turn: the angle the view turned last frame, TURN_LEAD_FRAMES frames of it (no more than
 *  TURN_LEAD_MAX), at the body's distance - so the bodies about to come into view are skinned on the budget before. */
export const TURN_LEAD_FRAMES = 3;
export const TURN_LEAD_MAX = 1.2;
/** The margin a body `dist` metres off takes when the view turned `turn` radians last frame. */
export const turnLeadMargin = (dist, turn) => CULL_MARGIN_M + (turn > 0 ? Math.max(0, dist) * Math.tan(Math.min(TURN_LEAD_MAX, turn * TURN_LEAD_FRAMES)) : 0);
/** AUDIT WB9 (bodies F1): the most of the frames a body went unposed its particles are stepped by at once, seconds - a
 *  body out of the view steps its clocks unposed, and its whole bank (a minute behind the eye: sixty seconds) as one
 *  particle step threw every flame out of its sprite, blinking it out as it came back into sight. */
export const EFFECTS_BANK_MAX_S = 0.1;
/** Frames between poses for a body at squared distance d2 - the first POSE_CADENCE row within which it stands. */
export function poseCadenceFor(d2) {
  for (const [within, every] of POSE_CADENCE) if (d2 <= within * within) return every;
  return POSE_CADENCE[POSE_CADENCE.length - 1][1];
}

/** The rig's build options from a peer's look - the same inputs
 *  weaponRig.armBuildOptsOf maps the player's entity onto. `hasAmmo`
 *  is false at the BUILD: the look carries the equip table alone; the
 *  arrow arrives later off the pose's `am` bit through `_arm`'s
 *  setWeapon (MAC7 #2). */
/** DISC12: the weapon in the hand the peer USES - the look carries both hands, the pose's `lh` says which one is
 *  drawn (WeaponManager.ApplyWeapon :741-755: the other hand is never on screen). */
const _stubSlots = new WeakMap();   // MW-CROWD: a look's stand-in's slots, once a look - a look is replaced, never mutated (lookKey's law)
export function peerWeaponOf(look, shown = null) {
  // MW-CROWD: every stepped body asked this every frame, and each ask built a whole stand-in (an entity, a 27-slot
  // equip table, its items) - eight bodies' worth of garbage a frame in a crowd. One a look now
  let slots = look && typeof look === 'object' ? _stubSlots.get(look) : null;
  if (!slots) { slots = peerStubEntity(look).equip.slots; if (look && typeof look === 'object') _stubSlots.set(look, slots); }
  return slots[shown?.lh ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand] ?? null;
}

/** WEREWOLF1: is this peer Morrowind's werewolf right now - the pose's `wb` 1 (LycanthropyTypes Werewolf)? The
 *  wereboar (2) has no Morrowind form and stays Eye Of The Beholder's boar (net/peerRiders.js). */
export const peerIsWolf = (shown) => (shown?.wb | 0) === 1;

/** WEREWOLF1 (AUDIT E1): the wolf's half of its key - only what its build reads of the look: the race (the wolf takes
 *  its scale) and the sex (a woman's CNAM). Memoised by the look, as lookKey is. */
const _wolfLookKeys = new WeakMap();
function wolfLookKey(look) {
  if (!look || typeof look !== 'object') return 'breton|male';
  let k = _wolfLookKeys.get(look);
  if (k === undefined) { const s = peerStubEntity(look); k = `${mwRaceId(s.race)}|${s.gender}`; _wolfLookKeys.set(look, k); }
  return k;
}

/** WEREWOLF1: WHICH BODY A PEER WEARS, as a key - the look's own for a person, unchanged; for a werewolf the wolf, its
 *  race, sex and skin, so a peer who transforms is a different body (built at once, not after BODY_REBUILD_MS) and a
 *  wolf refused (no Bloodmoon here) is waited out as a wolf and never as the person. AUDIT E1: NOT the person's look -
 *  the transformation unequips both hands and PROFILE2 says the look again a second later, and a key that read the
 *  equip table tore the standing wolf down and built it again ten seconds on (a second refusal and warning, where it
 *  was refused). */
export function peerBodyKey(look, shown = null, glyphs = null) {
  return peerIsWolf(shown) ? `wolf|${wolfLookKey(look)}|${werewolfSkinOf(glyphs) ?? ''}` : bodyLookKey(look);   // SHADOW-FANG: and the wolf's skin
}

/** MW-CROWD (FIELD BUGS 2026-10-01 #8): A PERSON'S BODY IS ITS LOOK LESS ITS WEAPONS. The weapon in hand is the arm's
 *  live door (`_arm` -> setWeapon, DISC12's hand swap), so a peer who drew another sword tore down a built body after
 *  BODY_REBUILD_MS and queued a whole build for it - the doll standing meanwhile - to hold what setWeapon had already put
 *  in the hand. The body key reads every other item as lookKey does; memoised by the look, as lookKey is. */
const _bodyLookKeys = new WeakMap();
function bodyLookKey(look) {
  if (!look || typeof look !== 'object') return lookKey(look);
  let k = _bodyLookKeys.get(look);
  if (k === undefined) {
    const items = Array.isArray(look.items) ? look.items : [];
    k = items.some((it) => it?.group === 'Weapons') ? lookKey({ ...look, items: items.filter((it) => it?.group !== 'Weapons') }) : lookKey(look);
    _bodyLookKeys.set(look, k);
  }
  return k;
}

export function peerBuildOpts(look, shown = null, glyphs = null) {
  const stub = peerStubEntity(look);
  const wolf = peerIsWolf(shown);
  const skin = wolf ? werewolfSkinOf(glyphs) : null;   // SHADOW-FANG: the glyphs the relay read off the peer's own token
  return {
    race: mwRaceId(stub.race),
    female: stub.gender === 'female',
    faceIndex: stub.faceIndex | 0,
    armor: dfWornEquipment(stub.equip.slots, EQUIP_SLOTS, ARMOR_ENUM),
    // DISC12: the hand in use; WEREWOLF1: a wolf holds nothing (the build refuses the hand anyway)
    weapon: wolf ? null : stub.equip.slots[shown?.lh ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand] ?? null,
    hasAmmo: false,
    reachSweep: false,   // MWNPC3: a peer is never looked out of - no first-person reach sweep in its build
    ...(wolf ? { werewolf: true, ...(skin ? { skin } : {}) } : {}),   // WEREWOLF1: Bloodmoon's wolf - its skeleton, head, hair and robe; SHADOW-FANG: its skin
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
 * written in place each frame. WB9h: `yaw` the body's own eased yaw
 * (the pose's when none), so no copy of the pose is made a frame.
 */
/** CARDS2b: a seated peer's seat (`{ feet, yaw, top }` - the rig's thirdSeat poses it at the body's own race) at the
 *  feet and facing the body is drawn at - kept while none of them moves (a sitter's pose stands still), rebuilt while
 *  the arrival eases in or the seat changes. */
export function seatFor(b, f, yaw, st) {
  const key = `${f[0].toFixed(2)},${f[1].toFixed(2)},${f[2].toFixed(2)},${yaw.toFixed(3)},${st}`;
  if (b.seatKey !== key) { b.seatKey = key; b.seatSpec = { feet: [f[0], f[1], f[2]], yaw, top: seatTopOf(st) }; }
  return b.seatSpec;
}

export function peerCamera(shown, feet, speed = 0, cam = null, yaw = peerBodyYaw(shown)) {
  const c = cam ?? { pos: [0, 0, 0], yaw: 0, pitch: 0, sneaking: false, bob: [0, 0], move: { forward: 0, strafe: 0, running: false, speed: 0, grounded: true, jumping: false, swimming: false, levitating: false } };
  const moving = peerMoving(shown);   // CLIMB5: a shimmy along a lip is no walk
  c.move.grounded = !peerClimbing(shown);   // CLIMB5: on the wall the body is off the ground - the in-air pose the local third person takes there
  c.pos[0] = feet[0]; c.pos[1] = feet[1]; c.pos[2] = feet[2];
  c.yaw = yaw; c.pitch = 0;
  c.move.forward = moving ? 1 : 0;
  c.move.running = shown.mv === 2;
  c.move.speed = moving ? speed : 0;
  return c;
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;

/** WB9h: the rows of proj x view, and which row makes each side: left, right, bottom, top, near (the 4th row plus or
 *  minus the 1st, 2nd, 3rd). */
const _rows = new Float64Array(16);
const SIDES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1]];
/**
 * WB9h: THE VIEW'S SIDES - left, right, bottom, top and near - off `proj` x `view` (column-major, the renderer's own), each
 * a normalised plane [a, b, c, d] with the inside positive, into `out` (twenty numbers). The far plane is left out: a
 * lens with no far has none, and a body past the fog is no cost worth a test. Answers `out`, or null for a pair that is
 * not a lens (a stub's). Pure.
 * @param {ArrayLike<number>|null|undefined} proj @param {ArrayLike<number>|null|undefined} view @param {Float64Array} [out]
 */
export function viewPlanes(proj, view, out = new Float64Array(20)) {
  if (proj?.length !== 16 || view?.length !== 16) return null;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) _rows[r * 4 + c] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
  }
  for (let i = 0; i < SIDES.length; i++) {
    const [row, sign] = SIDES[i];
    const a = _rows[12] + sign * _rows[row * 4], b = _rows[13] + sign * _rows[row * 4 + 1];
    const c = _rows[14] + sign * _rows[row * 4 + 2], d = _rows[15] + sign * _rows[row * 4 + 3];
    const l = Math.hypot(a, b, c) || 1;
    out[i * 4] = a / l; out[i * 4 + 1] = b / l; out[i * 4 + 2] = c / l; out[i * 4 + 3] = d / l;
  }
  return out;
}
/** WB9h: does the sphere (x, y, z, r) reach inside the view (viewPlanes)? Pure. */
export function sphereInView(planes, x, y, z, r) {
  for (let i = 0; i < 20; i += 4) if (planes[i] * x + planes[i + 1] * y + planes[i + 2] * z + planes[i + 3] < -r) return false;
  return true;
}
/** WB9h: the skin budget's order - a body with no skin first, then one owed a skin (over the last budget, or back in
 *  the view), then one its cadence names; within each, the longest since it was posed, then the nearest. */
const bySkinRank = (a, b) => b.rank - a.rank || a.posedAt - b.posedAt || a.d2 - b.d2;

/** The peers of a session, each in a Morrowind body of its own. */
export class PeerBodies {
  /**
   * @param {object} p
   * @param {import('../render/contract.js').RendererLike} p.renderer
   * @param {() => boolean} [p.enabled]  the host's gate (the enhanced skin, the arms switch, Morrowind data)
   * @param {Function} [p.createRig]     createFpArm; a test hands in its own
   * @param {Function} [p.buildOpts]     peerBuildOpts
   * @param {Function} [p.now]
   * @param {() => number} [p.generation] HARD3: the Morrowind data's generation. Destructured since MWBODY1 and never documented, which is how a caller finds out a parameter exists - by reading the destructuring.
   * @param {(m: string) => void} [p.warn] HARD3: likewise - the injected warn a test reads instead of the console.
   * @param {() => any} [p.collider] CLIMB6: the scene's collider, for a peer's floor under its climb (climbPose.js floorGapAt).
   * @param {{max?: number, range?: number, skinBudget?: number, spareMax?: number}} [p.limits] MWNPC3: this instance's own
   *   caps - the most bodies, the range they stand to, the skins a frame, the spares kept. Every one defaults to the
   *   module's constant, so the peers, the family and the card table read what they read; the NPC lane sets its own.
   * @param {{chain: Promise<any>}|null} [p.gate] MWNPC4: the build queue, SHARED - BODY_BUILD_GATE, which every body lane
   *   the hosts stand passes, so one body builds at a time on the page however many lanes ask; none, the instance's own.
   */
  constructor({ renderer, enabled = () => true, createRig = createFpArm, buildOpts = peerBuildOpts, now = () => Date.now(), generation = () => 0, warn = (m) => console.warn(m), collider = () => null, limits = null, gate = null }) {
    this.renderer = renderer;
    this._max = limits?.max ?? BODIES_MAX;   // MWNPC3: the instance's caps (limits)
    this._range = limits?.range ?? BODY_RANGE;
    this._skinBudget = limits?.skinBudget ?? SKIN_BUDGET;
    this._spareMax = limits?.spareMax ?? SPARE_MAX;
    this._collider = collider;   // CLIMB6: the host's, for the floor under a hanging peer's feet
    this.enabled = enabled;
    this._generation = generation;   // the Morrowind data's generation: a re-attach releases every body built from the last (weaponRig's fpRecheck, for the peers)
    this._gen = generation();
    this._warn = warn;
    this._createRig = createRig;
    this._buildOpts = buildOpts;
    this._now = now;
    this._bodies = new Map();   // peer id -> { id, key, rig, state: 'building'|'ok', cam, feet, yaw, speed, goneAt, far, d2, swing, cast, pending, held }
    this._failed = new Map();   // lookKey -> { until, reason }
    this._wolfRefused = null;   // WEREWOLF1 (AUDIT E2): { reason } - this data has no werewolf (its skeleton refused), until the data changes
    this._formWait = new Map();   // WEREWOLF1 (AUDIT E3): peer id -> the time its next body may be built, after a form flipped back too soon
    this._flipped = new Set();    // and the peers whose last body went for a change of form (their next is a form's body)
    this._queue = Promise.resolve();
    this._gate = gate;   // MWNPC4: the page's one build queue (BODY_BUILD_GATE), or null - this instance's own
    this._phase = 0;   // PEER-CADENCE: each new body takes the next phase, so bodies on the same cadence pose on different frames
    this._frame = 0;   // AUDIT PEER-CADENCE F1: the frame the cadence counts on - the MODULE's, not each body's (see _place)
    this._cam = null;   // INVIS-LOOK: the camera the body pass drew with this frame - the late pass draws the concealed with it
    this._planes = new Float64Array(20);   // WB9h: the last body pass's view sides (viewPlanes) - that pass's test, the next frame's skins
    this._planesOk = false;
    this._turn = 0; this._lastFwd = null;   // MW-CROWD: the last pass's turn (radians) and its forward
    this._live = new Map();   // WB9h: the frame's drawable peers - one map and one list, refilled a frame (AUDIT WB D10)
    this._want = []; this._wantPool = [];
    this._due = [];   // WB9h: the bodies stepped this frame, for the skin budget
    this._wantSince = new Map();   // WB9h: peer id -> { since, frame } - how long a bodiless peer has wanted a body
    this._swappedAt = -Infinity;   // WB9h: when a body was last handed over
    this._spares = [];   // WB9h: [{ key, rig, weapon, ammo, at }] - bodies given up in a swap, built, kept SPARE_MS
  }

  /** Is this body standing for its peer: built, in range, its peer present, the rig live? */
  _standing(b) { return !!(b && b.state === 'ok' && b.goneAt == null && !b.far && b.feet && (b.rig.thirdActive?.() ?? true)); }

  /** Does this peer stand in a body (so the doll is not drawn for it)? */
  has(id) { return this._standing(this._bodies.get(id)); }

  /** The body's height over its feet - the capsule scaled by the race's own (MW-D34) - or 0 without a standing body: the name pass's head. */
  heightOf(id) { const b = this._bodies.get(id); return this._standing(b) ? CAPSULE_HEIGHT * (b.rig.raceHeightScale?.() ?? 1) * (this._cam?.grow && b.feet ? Math.max(1, this._cam.grow(b.feet)) : 1) : 0; }   // OW-PEERS: a grown body's head, for its name

  /** Why a look has no body - a person's, or (AUDIT E7) a wolf's by the pose and glyphs it is keyed on - or null. */
  failureOf(look, shown = null, glyphs = null) {
    if (peerIsWolf(shown) && this._wolfRefused) return this._wolfRefused.reason;
    const f = this._failed.get(peerBodyKey(look, shown, glyphs));
    return f ? f.reason : null;
  }

  /** SHADOW-CLOAK: a peer's body's named bones where they stand - { feet, yaw, bones }: the feet and the eased yaw the
   *  body is drawn at and its bones in its own frame (the rig's thirdBones) - or null without a standing body. A body out
   *  of view keeps its last pose, as its skin does. */
  bonesOf(id, names) {
    const b = this._bodies.get(id);
    if (!this._standing(b)) return null;
    let bones = null; try { bones = b.rig.thirdBones?.(names) ?? null; } catch (e) { console.error('[peerBodies] bonesOf', e); }   // as every rig call here (AUDIT MWBODY A1): a throw never ends the frame
    return bones ? { feet: b.feet, yaw: b.yaw, bones } : null;
  }

  /** WEREWOLF1 (AUDIT E4): does this peer stand in a Morrowind WOLF here - the one body the rider layer yields a beast
   *  on foot to (a person's body standing on a transformation's first frame is not the beast's). */
  wolfStands(id) { const b = this._bodies.get(id); return !!b?.wolf && this._standing(b); }

  /**
   * Once a frame: the bodies of peers gone released past the linger,
   * a body per drawable peer within the cap - the nearest to `near`
   * first, a far body giving its slot to a nearer peer - its camera
   * fed from the pose, stepped by dt within BODY_RANGE.
   */
  sync(peers, toScene, dt, near = null, { priority = null, conceal = null } = {}) {
    if (!this.enabled()) { if (this._bodies.size || this._spares.length) this.destroy(); return; }
    const gen = this._generation();
    if (gen !== this._gen) { this._gen = gen; this._failed.clear(); this._wolfRefused = null; this.destroy(); }   // AUDIT MWBODY A9: new data, new bodies; WEREWOLF1: and perhaps a werewolf
    const now = this._now();
    this._frame++;
    // SLAM4: the failed looks age out. A look was only ever forgotten when a peer wearing THAT look asked again
    // (`:180`), so a look nobody wears again stayed for the life of the session - and a crowd is mostly looks seen
    // once. BODY_RETRY_MS has passed for these; they are nothing but memory.
    if (this._failed.size) for (const [k, f] of this._failed) if (now >= f.until) this._failed.delete(k);
    if (this._formWait.size) for (const [k, t] of this._formWait) if (now >= t) this._formWait.delete(k);
    if (this._spares.length) this._expireSpares(now);   // WB9h
    // WEREWOLF1 (AUDIT E2): WHERE THIS DATA HAS NO WEREWOLF - refused at its skeleton, Bloodmoon not attached - a peer in
    // beast form is not the bodies' at all, as before WEREWOLF1: no rig made and refused every BODY_RETRY_MS (with a
    // warning, and the farthest body evicted for it each time), and the person's body LINGERS for a turn back
    const live = this._live;
    live.clear();
    for (const peer of peers) if (peer?.shown && !(this._wolfRefused && peerIsWolf(peer.shown))) live.set(peer.id, peer);
    if (this._flipped.size) for (const id of this._flipped) if (!live.has(id)) this._flipped.delete(id);
    // the sweep first (the cap counts what stands, not what is leaving)
    for (const [id, b] of this._bodies) {
      if (live.has(id)) { b.goneAt = null; continue; }
      if (b.goneAt == null) { b.goneAt = now; b.hit = null; b.dead = null; b.swing = null; b.pending = null; b.posed = false; }   // AUDIT WORLD C7: a body that lingers re-latches its counts on the way back - what happened out of sight is not replayed. AUDIT PEER-CADENCE F2: and its skin is stale on the way back - the first frame back poses
      else if (now - b.goneAt > BODY_LINGER_MS) this._release(id);
    }
    // the peers with a body: their feet, pace and camera - and then (WB9h) their steps, the skins on the budget
    const due = this._due;
    due.length = 0;
    for (const [id, b] of this._bodies) {
      const peer = live.get(id);
      if (!peer) continue;
      const key = peerBodyKey(peer.look, peer.shown, peer.glyphs);
      // a new look is a new body (built below) - not oftener than BODY_REBUILD_MS; WEREWOLF1: a new FORM at once - the
      // wolf the moment the peer transforms and the person the moment they turn back, as their own screen shows it
      if (b.key !== key && (!!b.wolf !== peerIsWolf(peer.shown) || now - b.builtAt >= BODY_REBUILD_MS)) {
        // AUDIT E3: A FORM IS NOT FLIPPED FASTER THAN A BODY IS BUILT. A transformation's new body comes at once; a body
        // that was ITSELF a change of form, flipped out of inside BODY_REBUILD_MS of its birth, holds the next back for
        // the rest of it: a `wb` flipped every pose (Hircine's Ring, a modified client) was a rig made and a build
        // queued per flip, holding the one build queue from every other peer. The body in between is the sprite's.
        if (!!b.wolf !== peerIsWolf(peer.shown)) {
          if (b.byForm && now - b.born < BODY_REBUILD_MS) this._formWait.set(id, b.born + BODY_REBUILD_MS);
          this._flipped.add(id);
        }
        this._release(id);
        continue;
      }
      b.veil = conceal ? (conceal(id) ?? null) : null;   // INVIS-LOOK: a concealed peer's body keeps standing, drawn translucent (drawVeiled)
      this._place(b, peer, toScene, dt, near);
      if (b.state === 'ok' && !b.far && dt > 0) { b.peer = peer; due.push(b); } else {
        b.posed = false; b.stale = false; b.owed = false;   // AUDIT PEER-CADENCE F2: far (or a frozen frame) - whatever skin stands is stale by the time it is stepped again
        if (b.swing != null) { b.swing = peer.shown.an | 0; b.cast = peer.shown.cn | 0; b.pending = null; }
        if (b.hit != null) { b.hit = peer.shown.ht | 0; if ((peer.shown.dd | 0) !== b.dead) b.dead = null; }   // MWNPC4: and the reactions - a recoil out of sight is not played, a death out of sight is a corpse on waking   // AUDIT WORLD C7: not arming (far, or frozen) - the counts follow, so a blow out of sight is not replayed on waking
      }
    }
    this._stepDue(dt);
    // the peers without one, nearest first, within the cap - a far body yields its slot
    const want = this._want;
    let n = 0;
    for (const [id, peer] of live) {
      if (this._bodies.has(id)) continue;
      // SLAM10 (AUDIT SLAM): A STRANGER TAKES NO BODY. SLAM6 stands a peer from its pose before the relay has said who
      // it is, look-less; the nearest of those are the first to be offered one of BODIES_MAX rigs - so the eight
      // figures closest to the camera were eight IDENTICAL default Bretons, each a multi-second mesh parse, each paid
      // twice (once for the placeholder, again at BODY_REBUILD_MS when the real look landed). The shared look-less
      // doll costs one compose for the whole crowd; a rig is the dearest thing a peer can wear, and it waits for the
      // introduction.
      if (peer.told === false) continue;
      const fw = this._formWait.get(id);   // AUDIT E3
      if (fw != null && now < fw) continue;
      const fkey = peerBodyKey(peer.look, peer.shown, peer.glyphs);   // WEREWOLF1: a wolf refused is waited out as a wolf
      const f = this._failed.get(fkey);
      if (f) { if (now < f.until) continue; this._failed.delete(fkey); }
      const p = toScene(peer.shown);
      const w = this._wantPool[n] ?? (this._wantPool[n] = { peer: null, key: '', d2: 0, pri: false, since: 0 });
      w.peer = peer; w.key = fkey; w.d2 = near ? dist2(p, near) : 0; w.pri = priority ? !!priority(peer.id) : false;
      w.since = this._wanted(id, now);   // WB9h
      want[n++] = w;
    }
    want.length = n;
    if (this._wantSince.size) for (const [id, s] of this._wantSince) if (s.frame !== this._frame) this._wantSince.delete(id);   // WB9h: one that stopped wanting starts again
    // AUDIT PARTY8 (2026-09-23): A PARTY MATE BEFORE A STRANGER. The rigs were nearest-first alone, so with seven
    // companions and one stranger nearer than the farthest of them, the stranger took the eighth body and a party
    // mate stood as a paper doll. `priority` (the host's own `social.isPartyPeer`) sorts a mate first, and a mate
    // may take a stranger's slot outright; a stranger never takes a mate's.
    want.sort((a, b) => (a.pri === b.pri ? a.d2 - b.d2 : a.pri ? -1 : 1));
    for (const [id, b] of this._bodies) b.pri = priority ? !!priority(id) : false;
    for (const w of want) {
      if (this._bodies.size >= this._max) {
        if (!this._maySwap(w, now) || !this._yield(w.d2, w.pri, w.key)) break;
      }
      const peer = w.peer;
      const spare = this._takeSpare(w.key);   // WB9h: a body given up for this one's, built - no build
      // AUDIT WB9 (bodies F3): the look its key names, read NOW - the queue reaches its build later, and a look changed
      // meanwhile was built under the old key (a spare the next wearer of the old look stood in, in the wrong armour)
      const look = peer.look, shown = peer.shown, glyphs = peer.glyphs;
      const b = { id: peer.id, key: w.key, wolf: peerIsWolf(shown), rig: spare ? spare.rig : this._createRig(), state: spare ? 'ok' : 'building', cam: null, feet: null, yaw: peerBodyYaw(shown), speed: 0, goneAt: null, far: false, d2: w.d2, pri: w.pri, builtAt: now, born: now, byForm: this._flipped.delete(peer.id), swing: null, cast: null, pending: null, held: false, ammo: spare ? spare.ammo : null, weapon: spare ? spare.weapon : null,
        posed: false, phase: this._phase++, bank: 0,   // PEER-CADENCE
        posedAt: 0, rank: 0, inView: true, stale: false, owed: false, peer: null,   // WB9h
        veil: conceal ? (conceal(peer.id) ?? null) : null };   // AUDIT WB9 (bodies F4): a spare stands the frame it is taken - concealed from that frame, never drawn open once
      this._bodies.set(peer.id, b);
      this._wantSince.delete(peer.id);
      b.rig.attach(this.renderer, () => b.cam);
      this._place(b, peer, toScene, dt, near);
      if (!spare) {
        const build = () => this._build(b, look, shown, glyphs);
        // MWNPC4: through the page's gate when the host gave one - a peer's body, the family's and an NPC's wait their turn
        // on ONE queue, so two lanes never build at once (a build's synchronous spans - the bind, the skin transfer -
        // were one lane's stutter at a time; two lanes doubled it)
        if (this._gate) this._queue = this._gate.chain = this._gate.chain.then(build).catch(() => null);
        else this._queue = this._queue.then(build).catch(() => null);
      }
      else {
        // WB9h: a spare stands at once, its skin the last wearer's - stale, so it is posed for its new peer on its first
        // frame when seen, and otherwise the moment it is (as any body out of the view)
        b.posed = true; b.stale = true;
        if (!b.far && dt > 0) { b.peer = peer; this._step(b, dt, b.inView); }
      }
    }
  }

  /** WB9h: how long this bodiless peer has wanted a body (the time it began), stamped for this frame. */
  _wanted(id, now) {
    let s = this._wantSince.get(id);
    if (!s) this._wantSince.set(id, s = { since: now, frame: 0 });
    s.frame = this._frame;
    return s.since;
  }

  /** WB9h: MAY THIS PEER TAKE A BODY THAT STANDS? A party mate always (AUDIT PARTY8), and anyone while a body lingers
   *  (its peer gone - nothing is seen to go); a stranger once it has wanted one SWAP_DWELL_MS, no sooner than
   *  SWAP_EVERY_MS after the last hand-over, and - unless a spare stands for its body - not while another body builds:
   *  it would wait on the one queue, the body it took already gone. */
  _maySwap(w, now) {
    if (w.pri) return true;
    for (const b of this._bodies.values()) if (b.goneAt != null) return true;
    if (now - w.since < SWAP_DWELL_MS || now - this._swappedAt < SWAP_EVERY_MS) return false;
    if (this._hasSpare(w.key)) return true;
    for (const b of this._bodies.values()) if (b.state === 'building') return false;
    return true;
  }

  /** The farthest body - a lingering one first - gives its slot to a peer nearer by SWAP_MARGIN; true when a slot was freed.
   *  AUDIT WB9 (bodies F2): `key` the body the slot is freed for - a spare of it is never the one the body given up pushes
   *  out of a full pool (_maySwap allowed the hand-over on it; lost, the newcomer built behind another build). */
  _yield(d2, pri = false, key = null) {
    let victim = null, stranger = null;
    for (const b of this._bodies.values()) {
      if (b.goneAt != null) { victim = b; break; }
      if (b.pri && !pri) continue;   // AUDIT PARTY8: a stranger never takes a party mate's slot
      if (!victim || b.d2 > victim.d2) victim = b;
      if (!b.pri && (!stranger || b.d2 > stranger.d2)) stranger = b;
    }
    if (!victim) return false;
    // AUDIT PARTY8: a party mate takes the farthest stranger's slot outright, margin or none
    if (pri && stranger && victim.goneAt == null) { this._release(stranger.id, true, key); this._swappedAt = this._now(); return true; }
    if (victim.goneAt == null && !(victim.d2 > d2 * SWAP_MARGIN * SWAP_MARGIN)) return false;
    // WB9h: a standing body given up is kept for its body's next wearer, and the hand-over is timed (a lingering one's
    // peer is gone - nothing is seen to go)
    if (victim.goneAt == null) this._swappedAt = this._now();
    this._release(victim.id, true, key);   // MW-CROWD: a LINGERING body is kept too - its peer mounted or dropped out of the list a moment, and came back to a whole rebuild (_release spares only a built, skinned rig)
    return true;
  }

  /** A body's feet, pace, range and camera for this frame. */
  _place(b, peer, toScene, dt, near) {
    const f = toScene(peer.shown);
    // the ground speed off the drawn pose, eased; a jump (a snap, a recenter missed) resets it rather than reading as a sprint.
    // FIELD BUGS 2026-09-29 (the sea) #1: one stood on a deck (the glue's `deck`) paces by their place on it - a body standing
    // on a moving deck stood in a walk at the ship's speed - and a change of deck (or onto one, or off) starts afresh
    const on = peer.shown.deckKey ?? null, at = on ? peer.shown.deck : f;
    b.speed = stepPeerPace(b.speed, b.paceKey === on ? b.paceAt : null, at, dt);   // HT-WAIST-BACK: net/peerPace.js, the one home
    b.paceAt = at; b.paceKey = on;
    b.feet = f;
    // the yaw eased toward the pose's (AUDIT MWBODY A8): the rig reads turning off the yaw's change frame to frame,
    // and a pose eased over one send interval stops between arrivals, so the turn clip stuttered
    // ONCRASH1: one step, not a loop - the yaw eased here is the WIRE's
    // (see online.js lerpAngle), and a loop over a large one never falls.
    b.yaw += wrapAngle(peerBodyYaw(peer.shown) - b.yaw) * (dt > 0 ? Math.min(1, dt * YAW_EASE) : 1);   // CLIMB5: to the wall, on the climb
    b.d2 = near ? dist2(f, near) : 0;
    b.far = !!near && b.d2 > this._range * this._range;
    b.cam = peerCamera(peer.shown, f, b.speed, b.cam, b.yaw);
    // CLIMB6: the climb the body's limbs take - the hold rebuilt from the pose, a move from its kind, lip and time
    b.cam.climb = (b.climbTrack ??= new PeerClimbTrack()).input(peer.shown, f, b.yaw, this._now(), this._collider());
    // CARDS2b: seated at a card table - the same seated request the sitter's own body takes (player/seatPose.js), at the
    // table's top the pose names; rebuilt only when the seat moves
    b.cam.seat = peer.shown.st ? seatFor(b, f, b.yaw, peer.shown.st) : null;
    b.inView = !this._planesOk || this._sees(b, turnLeadMargin(Math.sqrt(b.d2), this._turn));   // WB9h: in the last pass's view, with the margin a turning eye needs - MW-CROWD: led by the turn
  }

  /** WB9h: does the view the last body pass drew (viewPlanes) reach this body - its sphere about its middle, BODY_SPHERE_SHARE of
   *  its height round, `margin` metres more? */
  _sees(b, margin, grow = 1) {
    const h = CAPSULE_HEIGHT * (b.rig.raceHeightScale?.() ?? 1) * grow;   // OW-PEERS: a grown body reaches its grow times as far
    return sphereInView(this._planes, b.feet[0], b.feet[1] + h / 2, b.feet[2], h * BODY_SPHERE_SHARE + margin);
  }

  /**
   * WB9h: THE FRAME'S STEPS - every stepped body's clocks and weapon every frame, and the skins on the budget.
   * PEER-CADENCE: the skin on its cadence, the clocks every frame. A body with NO SKIN TO KEEP always poses: its first
   * step (the third-person mesh is minted by the first upload, and `thirdActive` waits on it - a body that skipped its
   * first frame would stand as the doll for a frame), its first step back from far or from a linger (the kept skin is
   * seconds old - AUDIT PEER-CADENCE F2), and the step after a rebuild let the mesh go (setWeapon on an arrow's nock,
   * setTorch - the rig releases the mesh in an async tick, and a skipped frame would have shown the doll: `thirdActive`
   * says so - AUDIT PEER-CADENCE F3). Otherwise one frame in `every`, counted on the MODULE's frame with a phase per
   * body, so bodies on one cadence skin on different frames whenever their builds landed (AUDIT PEER-CADENCE F1: a
   * per-body tick started on the standing frame made the stagger an accident of the build queue - eight bodies landed a
   * frame apart all skinned together). The skipped frames' dt is banked for the particle step, which keeps wall time on
   * the frame that poses.
   * WB9h: a body out of the view skins nothing (its clocks run; it is posed as it is seen - `stale`), and of the rest
   * wanting a skin at most SKIN_BUDGET pose in a frame, in bySkinRank's order; one left over is owed the next frame.
   */
  _stepDue(dt) {
    const due = this._due;
    for (const b of due) {
      const must = !b.posed || !(b.rig.thirdActive?.() ?? true);
      b.rank = must ? 3 : !b.inView ? 0 : (b.owed || b.stale) ? 2 : (this._frame + b.phase) % poseCadenceFor(b.d2) === 0 ? 1 : 0;
    }
    if (due.length > 1) due.sort(bySkinRank);
    let skins = 0;
    for (const b of due) {
      const pose = b.rank === 3 || (b.rank > 0 && skins < this._skinBudget);
      if (pose) skins++;
      else if (b.rank > 0) b.owed = true;
      else if (!b.inView) b.stale = true;
      this._step(b, dt, pose);
    }
    due.length = 0;
  }

  /** One body's step: its weapon off the wire, then its clocks - and its skin when `pose`. */
  _step(b, dt, pose) {
    const peer = b.peer;
    b.peer = null;
    // AUDIT MWBODY A1: a throw from one peer's rig is that peer's doll, never the frame's end
    try {
      this._arm(b, peer.shown, peer.look);
      b.bank = Math.min(EFFECTS_BANK_MAX_S, b.bank + dt);   // AUDIT WB9 (bodies F1)
      if (pose) { b.rig.update(dt, { pose: true, effectsDt: b.bank }); b.bank = 0; b.posed = true; b.owed = false; b.stale = false; b.posedAt = this._frame; }
      else b.rig.update(dt, { pose: false });
    } catch (e) { this._fail(b, `update threw: ${e?.message ?? e}`); }
  }

  /** MAC7 #1 (Mac: "no weapons"): the weapon and the swing, off the wire's own bits - the rig's weapon drawn while
   *  the sender's is (setSheathed, the player's own rig's door), a swing once per count and never the count the body
   *  was born with (a late joiner does not replay an old blow), and release() every frame as weaponRig gives its own
   *  rig - a wind-up that is not held lets go on the next frame.
   *  MAC7 #2: the arrow (setWeapon with the wire's ammo bit, the same door weaponRig's per-frame read takes), the
   *  spell stance (readySpell, a boolean compare on the rig's side), a cast once per count with the wire's range,
   *  and the bow's hold - a swing that arrives with wd 2 is the draw (attack with hold), and release() waits while
   *  wd stays 2, exactly as weaponRig withholds it while the machine sits in StrikeUp. */
  _arm(b, shown, look = null) {
    // MWNPC4: a dead body takes no weapon, no spell and no swing - its counts follow, so nothing is replayed if it stands
    if (this._react(b, shown)) { b.swing = shown.an | 0; b.cast = shown.cn | 0; b.pending = null; b.held = false; return; }
    const drawn = !!shown.wd;
    b.rig.setSheathed?.(!drawn);
    // DISC12 (Discord: "Weapons when swapped into left hand dont work showing fists"): THE HAND IN USE. The body was
    // built holding the look's RIGHT hand, always, so a peer fighting left-handed stood with the wrong weapon or a fist.
    // The pose says the hand (`lh`); the weapon follows it through setWeapon, the arm's own door, when the arm is quiet.
    if (look) {
      const want = b.wolf ? null : peerWeaponOf(look, shown);   // WEREWOLF1: the wolf's hands are its claws
      if (want !== b.weapon && (want?.templateIndex !== b.weapon?.templateIndex || want?.equipSlot !== b.weapon?.equipSlot)
        && (b.rig.upperBodyReady?.() ?? true) && b.rig.setWeapon?.(want, { hasAmmo: !!shown.am }) !== false) { b.weapon = want; b.ammo = shown.am ? 1 : 0; }
    }
    // AUDIT WORLD C5/C6: the arrow lands only when the arm is quiet (setWeapon clears the action in flight, so the
    // last arrow's loose - am 1 to 0 in the same pose as the count - was cut every time) and is committed only
    // when the rig took it (a swap refused mid-swap was never retried, and the wrong nock stood until a rebuild)
    const am = shown.am ? 1 : 0;
    if (b.weapon && b.ammo !== am && (b.rig.upperBodyReady?.() ?? true) && b.rig.setWeapon?.(b.weapon, { hasAmmo: !!am }) !== false) b.ammo = am;
    b.rig.readySpell?.(!b.wolf && !!shown.sr);   // WEREWOLF1: a werewolf casts nothing (setWerewolf clears the spell stance)
    // HT-WAIST-NET (2026-09-24): THE LANTERN AT THE WAIST, off the pose's `hl` - the rig's own door, the local body's
    // (weaponRig hands the player's the same boolean every frame): the fast path one compare, the first lit binds the
    // lantern at this body's pelvis once, a light arriving mid-build is queued. It swings off this body's own camera
    // (peerCamera's `move` and eased yaw, the walk clip's phase), as the local one swings off the motor's. No held
    // light rides the wire (MW-D51) - this one is in no hand.
    b.rig.setHipLight?.(!b.wolf && !!shown.hl);   // WEREWOLF1: and hangs nothing at the hip
    const an = shown.an | 0, cn = shown.cn | 0;
    if (b.swing == null) { b.swing = an; b.cast = cn; }
    else {
      if (an !== b.swing) {
        b.swing = an;
        if (b.held) {
          // the count after a held draw is its LOOSE: release() plays the shot - below, once wd dropped, or here
          // when the next draw rode the same pose (C4: an +2, wd still 2) - and nothing is queued for it (a queued
          // strike would shoot again once the arm came back)
          if (shown.wd === 2) { b.rig.release?.(); b.held = false; b.pending = { strike: 'StrikeUp', hold: true, left: PENDING_FRAMES }; }
          else b.pending = null;
        } else {
          // MW-PACE1: the gap since the last count, which paces the burst this blow belongs to
          const at = this._now();
          b.blowPace = peerBlowPace(b.swingAt == null ? null : b.blowPace, b.swingAt == null ? -1 : (at - b.swingAt) / 1000);
          b.swingAt = at;
          // C3: the strike is KEPT until the rig takes it - the equip that setSheathed started this very frame
          // refuses it, and a consumed count was a blow never played - for PENDING_FRAMES and no more
          b.pending = drawn ? { strike: POSE_STRIKES[shown.as | 0] ?? 'StrikeDown', hold: shown.wd === 2, left: PENDING_FRAMES, blow: peerBlow(b.blowPace) } : null;
        }
      }
      if (b.pending && b.pending.left-- > 0) {
        if (b.rig.attack?.(b.pending.strike, { hold: b.pending.hold, blow: b.pending.blow ?? null })) { b.held = b.pending.hold; b.pending = null; }
      } else b.pending = null;
      if (cn !== b.cast) { b.cast = cn; b.rig.castSpell?.(shown.cr | 0); }
    }
    if (shown.wd !== 2) { b.rig.release?.(); b.held = false; }
  }

  /** MWNPC4: THE REACTIONS, off the two pose fields an NPC's carries (characters/npcBodies.js npcShown) and the wire's
   *  peers never send: `ht`, a hit count - a new count is a recoil (the rig's `hurt`, its roll the count) - and `dd`, the
   *  death: 0 standing, else the death's roll + 1 (`die`). Latched the first time a body meets them, as the swing count
   *  is: a body that first meets an actor already dead stands in the death's last frame (the reference's startpoint, a
   *  corpse it loads), and one handed to a living actor - a spare, a body back from its linger - is brought back
   *  (`revive`, nothing on a living rig). A dead actor recoils from nothing. True while the actor is dead. */
  _react(b, shown) {
    const ht = shown.ht | 0, dd = shown.dd | 0;
    if (b.dead == null) { b.dead = dd; if (dd) b.rig.die?.(dd - 1, { startPoint: 1 }); else b.rig.revive?.(); }
    else if (dd !== b.dead) { b.dead = dd; if (dd) b.rig.die?.(dd - 1); else b.rig.revive?.(); }
    if (b.hit == null || dd) b.hit = ht;
    else if (ht !== b.hit) { b.hit = ht; b.rig.hurt?.(ht); }
    return dd > 0;
  }

  /** A body that failed - refused, or threw - is released and its look waited out, the reason kept and said once. */
  _fail(b, reason) {
    this._failed.set(b.key, { until: this._now() + BODY_RETRY_MS, reason });
    try { this._warn(`[online] a peer's Morrowind body stands down - ${reason}`); } catch { /* a console is not the body's problem */ }
    this._release(b.id);
  }

  async _build(b, look, shown = null, glyphs = null) {
    if (this._bodies.get(b.id) !== b) return;   // released before its turn: no parse for a body already gone
    let res = null, reason = 'threw';
    // WEREWOLF1: the form it was keyed on rides the build - a wolf's body is built as the wolf
    try { const opts = this._buildOpts(look, b.wolf ? { ...shown, wb: 1 } : null, glyphs); b.weapon = opts.weapon ?? null; res = await b.rig.build(opts); } catch (e) { res = null; reason = `threw: ${e?.message ?? e}`; }
    if (this._bodies.get(b.id) !== b) { try { b.rig.unload(); } catch { /* gone */ } return; }   // released while building
    if (res && res.ok && b.rig.canThirdPerson() && b.rig.setViewMode('third')) { b.state = 'ok'; b.builtAt = this._now(); this._failed.delete(b.key); return; }
    if (res) reason = res.ok ? 'no third-person body' : `${res.stage}: ${res.error}`;
    // AUDIT E2: a WOLF refused at its skeleton is this data's answer for every wolf - Bloodmoon is not attached - and
    // it is said once; a new data generation asks again
    if (b.wolf && res && !res.ok && res.stage === 'skeleton') this._wolfRefused = { reason };
    this._fail(b, reason);
  }

  /** The bodies, after the local one (the same pass, MW-D24) - the standing ones. INVIS-LOOK: not a CONCEALED peer's -
   *  that one is drawn translucent after the world's opaque draws (drawVeiled), with the camera kept here. */
  draw(canvas, { proj, view, eye, flashOf = null, grow = null, up = null, fxOf = null }) {
    const c = this._cam ?? (this._cam = { canvas: null, proj: null, view: null, eye: null, flashOf: null, grow: null, up: null, fxOf: null });
    c.canvas = canvas; c.proj = proj; c.view = view; c.eye = eye; c.flashOf = flashOf;
    c.fxOf = fxOf;   // MWNPC5: a body's tells by its id (a foe's glint, elite glow, dissolve - characters/npcBodies.js)
    c.grow = grow; c.up = up;   // OW-PEERS (FIELD BUGS 2026-10-01 #11): under the Overworld each body drawn its grow times about its feet, leaned as the traveller's own is (drawThird's OW-BIG and AUDIT OW3 J6)
    this._planesOk = !!viewPlanes(proj, view, this._planes);   // WB9h: this pass's view - and the next frame's skins
    // MW-CROWD: how far the view turned since the last pass - the angle between the two forwards (the view's third row)
    if (this._planesOk) {
      const fx = -view[2], fy = -view[6], fz = -view[10], l = this._lastFwd;
      this._turn = l ? Math.acos(Math.max(-1, Math.min(1, fx * l[0] + fy * l[1] + fz * l[2]))) : 0;
      const k = this._lastFwd ?? (this._lastFwd = new Float64Array(3));
      k[0] = fx; k[1] = fy; k[2] = fz;
    }
    return this._drawBodies(canvas, proj, view, eye, false, flashOf);
  }

  /** INVIS-LOOK (2026-09-27, Mac: "Give invisibility the same invisibility we give enemies in enhanced AI. That
   *  transparent look"): THE CONCEALED BODIES, TRANSLUCENT - ECV1's look, the one a concealed foe's sprite takes (the
   *  shimmer and ripple, a shade's dark silhouette), through the sprite box's own quad. Blended with no depth write,
   *  so a host calls it AFTER its opaque world (the level, the flats, the foes), and it draws with this frame's camera
   *  - the one `draw` was handed. Nothing before the body pass has drawn this frame: nothing. */
  drawVeiled() {
    const c = this._cam;
    return c ? this._drawBodies(c.canvas, c.proj, c.view, c.eye, true, c.flashOf) : 0;
  }

  /** The standing bodies of one kind - the open (`veiled` false) or the concealed. */
  _drawBodies(canvas, proj, view, eye, veiled, flashOf = null) {
    let drawn = 0;
    for (const b of this._bodies.values()) {
      if (!this._standing(b) || !b.veil !== !veiled) continue;
      // WB9h: out of the view (the frustum's sides and near, the body's own reach): nothing to draw - the sprite pass
      // has no such test. A view that is no lens (a stub's) keeps the old test alone: behind the eye.
      const g = this._cam?.grow ? Math.max(1, this._cam.grow(b.feet)) : 1;   // OW-PEERS
      if (this._planesOk) { if (!this._sees(b, 0, g)) continue; }
      else if (view && view.length === 16) {
        const f = b.feet, vz = view[2] * f[0] + view[6] * f[1] + view[10] * f[2] + view[14];
        if (vz > CAPSULE_HEIGHT) continue;
      }
      // WB9h: seen, and its skin behind its clocks (the view swung onto it past the margin since the frame stepped it) -
      // posed now, where its clocks stand, before it is drawn
      if (b.stale) {
        try { b.rig.update(0, { pose: true, effectsDt: b.bank }); b.bank = 0; b.stale = false; b.owed = false; b.posedAt = this._frame; } catch (e) { this._fail(b, `update threw: ${e?.message ?? e}`); continue; }
      }
      try { if (b.rig.drawThird(canvas, { proj, view, eye, feet: b.feet, yaw: b.yaw, hitFlash: flashOf ? flashOf(b.id) : 0, conceal: b.veil ?? null, grow: g, up: this._cam?.up ?? null, fx: this._cam?.fxOf ? this._cam.fxOf(b.id) : null })) drawn++; } catch (e) { this._fail(b, `draw threw: ${e?.message ?? e}`); }   // AUDIT MWBODY A1; HITFLASH1: a struck body flashes red; INVIS-LOOK: a concealed one blends; OW-PEERS: grown and leaned under the Overworld
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

  _release(id, spare = false, keep = null) {
    const b = this._bodies.get(id);
    if (!b) return;
    this._bodies.delete(id);
    // WB9h: a body given up in a swap - built, skinned - is kept for the next peer who wears it
    if (spare && b.state === 'ok' && (b.rig.thirdActive?.() ?? false)) { this._keepSpare(b, keep); return; }
    try { b.rig.unload(); } catch { /* a rig mid-build unloads when the build lands */ }
  }

  /** WB9h: a spare kept - nobody's camera while it waits; the oldest past SPARE_MAX unloaded - AUDIT WB9 (bodies F2): the
   *  oldest not of `keep` (the body a hand-over is for), while another stands. */
  _keepSpare(b, keep = null) {
    b.rig.attach(this.renderer, null);
    this._spares.push({ key: b.key, rig: b.rig, weapon: b.weapon, ammo: b.ammo, at: this._now() });
    while (this._spares.length > this._spareMax) {
      const i = this._spares.findIndex((x) => x.key !== keep);
      this._unloadSpare(this._spares.splice(Math.max(0, i), 1)[0]);
    }
  }
  /** WB9h: the newest spare of this body, taken, or null. */
  _takeSpare(key) {
    for (let i = this._spares.length - 1; i >= 0; i--) if (this._spares[i].key === key) return this._spares.splice(i, 1)[0];
    return null;
  }
  _hasSpare(key) { for (const s of this._spares) if (s.key === key) return true; return false; }
  _expireSpares(now) {
    for (let i = this._spares.length - 1; i >= 0; i--) if (now - this._spares[i].at > SPARE_MS) this._unloadSpare(this._spares.splice(i, 1)[0]);
  }
  _unloadSpare(s) { try { s.rig.unload(); } catch { /* gone */ } }

  destroy() {
    for (const id of this._bodies.keys()) this._release(id);
    for (const s of this._spares) this._unloadSpare(s);
    this._spares.length = 0;
    this._wantSince.clear();
    this._cam = null; this._planesOk = false;
  }
}
