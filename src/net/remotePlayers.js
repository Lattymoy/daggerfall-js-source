// @ts-check
// ONLINE1 (2026-09-12): THE OTHERS, DRAWN. Mac: "if using classic, you'd
// see the other user's paperdoll; if using enhanced, you would see the
// other person's Morrowind sprite" - and, of a client without the
// Morrowind data, "acceptable" that it sees the paperdoll instead. This
// iteration draws every peer as their PAPERDOLL: the same composite the
// inventory shows, minus its panel background, cropped to the figure and
// stood on the ground as a billboard at the peer's feet, the name over
// its head. With the Morrowind layer on, the
// body instead (MWBODY1, net/peerBodies.js: one rig instance per
// peer), the doll standing wherever a body does not. Recorded in
// Online-Arc.md.
//
// THE LOOK travels in the hello (net/online.js): race, gender, face,
// and the equipped items' doll fields (paperdollItemImage reads
// templateIndex, group, material, dye, variant, equipSlot). A stub
// entity with those and an equip table stands in for the peer at the
// compositor's PURE door (ui/paperDoll.js composePaperDollPixels, AUDIT
// ONLINE C1-C4): its own art set, its own buffer, nothing of the
// inventory's doll read or written - the first cut composed through
// the singleton and could hand the inventory a stranger's doll, or the
// stranger the player's, panel and all.
import { composePaperDollPixels } from '../ui/paperDoll.js';
import { equipTableOf } from '../systems/equip.js';
import { createEquipTable } from '../characters/equipTable.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { drawText, measureText } from '../ui/text.js';
import { titleBadge, glyphMarks } from '../ui/playerBadge.js';   // ACC3: what a title and a glyph LOOK like - one home, both faces (the DOM layer reads the same module)
import { projectToScreen } from '../player/tapRay.js';   // one home (audit24 onehome): the touch layer's own projection
import { LOOK_ITEM_FIELDS, LOOK_GROUPS } from './wire.js';   // the look's vocabulary: the wire's own
import { renownText } from './renown.js';   // RENOWN1: Renown's words, left of the name in the bitmap face too
// 2026-09-17 (per-request, the NON-Morrowind peer only - net/peerBodies.js and its Morrowind body are untouched):
// the same class-enemy sprite classic dungeon humanoids already use (Warrior, Mage, Knight, ...), driven by simple
// moving/striking flags off the peer's synced pose instead of AI - the reusable pieces dungeonContext.js already
// builds a foe's OWN mobile unit from (MobileUnit.update takes the same flags EnemyMotor's AI would set).
import { MobileUnit } from '../characters/mobileUnit.js';
import { ENEMY_BASICS, ENEMY_NAMES } from '../characters/enemyBasics.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';   // DISC12: the beast a peer in beast form stands as
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { modSetting, storedModSetting } from '../systems/modSettings.js';   // DISC23-B: the Eye Of The Beholder set the look carries
import { getPref } from '../systems/uiPrefs.js';   // 2026-09-17: the 'peerClassSprites' on/off, read once a sync (Other players, enhancedMenu.js peerSpritesCard)
import { CLASS_CAREERS } from '../systems/chargen.js';   // 2026-09-17 (bugfix): a stock class's CFG-loaded career carries no `.name` of its own - chargenSession.js's own class list already falls back to this array by careerIndex (`cf.career.name || CLASS_CAREERS[i]`), and composeLook needs the same fallback or every stock-class peer sends class:null
import { EQUIP_SLOTS } from '../characters/paperdoll.js';   // AUDIT DROPS E6: the hand a swing sound is read off
import { FootstepMachine, FOOTSTEP_CLIP_SETS } from '../systems/footsteps.js';   // PEER-FS1: peer footsteps off the pose's own `fk`
import { RidingAnimator, RIDING_VOLUME_SCALE, nextNeighDelay } from '../systems/riding.js';   // RIDE-SOUND: a peer's hooves are TransportManager's own loop, clip swap and neigh
import { TRANSPORT_MODES } from '../systems/transport.js';   // RIDE-SOUND: the pose's `rd` as the animator's mode
import { swingSoundFor, SOUND } from '../systems/soundClips.js';   // PEER-FS2: a peer's own swing sound, off the pose's `an` edge and their equipped weapon
import { billboardSize } from '../world/rmbFlats.js';   // PCORPSE1: a corpse stands as the dungeon's own corpses stand
import { raceGenderPain3Sound, CLASSIC_PLAYER_DEATH_SOUND } from '../systems/playerDeath.js';   // PCORPSE1: the fallen player's own cry
import { RACES } from '../systems/races.js';

// ── PCORPSE1: THE FALLEN ──────────────────────────────────────────
//
// Discord, 2026-09-23: "add dead corpses to players that died against mobs, based on the class they play - right
// now they just disappear. The corpse should stay for 1 minute and disappear, and give it the player's death sound
// depending on whether it's a woman or a man."
//
// THE BODY IS THE CLASS'S OWN CORPSE: `corpseTexture` off the same EnemyBasics row the peer's class sprite is drawn
// from (classMobileType), which is exactly the body a killed class enemy of that class leaves in a dungeon
// (dungeonContext spawnCorpse). DFU's data gives every human class ONE body (TEXTURE.380 record 1), so a Mage and a
// Knight fall the same - which is Daggerfall's own answer, read from its table rather than restated here. A peer
// with no class to go on falls to the Thief row, the class sprite's own default.
//
// THE CRY IS THE PLAYER'S OWN death voice: GetRaceGenderPain3Sound (PlayerDeath.cs:179-201), the race's clip for the
// peer's gender - the woman's cry for a woman, the man's for a man - at the footsteps' distance falloff.

/** How long a fallen player's body lies, in ms. */
export const CORPSE_MS = 60_000;
/** Bodies kept at once - a massacre is bounded like every other peer cache. */
export const CORPSES_MAX = 32;
/** The corpse row for a look: the class's own, else the Thief's (the class sprite's default). */
export function corpseTextureFor(look) {
  const t = classMobileType(look?.class) ?? THIEF_MOBILE_TYPE;
  return ENEMY_BASICS[t]?.corpseTexture ?? ENEMY_BASICS[THIEF_MOBILE_TYPE]?.corpseTexture ?? null;
}
/** The fallen player's death cry: their race's Pain3 for their gender, the classic clip for a race outside the eight. */
export function peerDeathSound(look) {
  const clip = raceGenderPain3Sound(RACES[look?.race] ?? RACES.Breton, look?.gender === 'female' ? 'female' : 'male');
  return clip >= 0 ? clip : CLASSIC_PLAYER_DEATH_SOUND;
}

/** entity.career?.name for a CUSTOM class; CLASS_CAREERS[entity.careerIndex] for a STOCK one, whose loaded career
 *  object does not carry its own name (see the import comment above) - null if neither resolves, same as before
 *  this existed. Centralized so composeLook has exactly one place that knows career data can be name-less. */
function careerName(entity) {
  return entity?.career?.name || (Number.isInteger(entity?.careerIndex) ? CLASS_CAREERS[entity.careerIndex] : null) || null;
}

/** DFU's own "Thief" class-enemy id (ENEMY_NAMES index 53 -> 128 + 53 - 43). Named here rather than left as a bare
 *  138 so the fallback below reads as what it is - the SAME default the Unity co-op mod's own getCorrectType falls
 *  through to for any class name its switch statement does not recognize. */
const THIEF_MOBILE_TYPE = 138;

/** A career name ("Warrior", "Mage", ...) to the matching class-enemy MobileType (128+). `ENEMY_NAMES` is
 *  generated straight off DFU's own EnemyBasics table (see characters/enemyBasics.js's header) - class rows start
 *  at array index 43, mobileType 128 - so this reads the SAME data dungeonContext.js's own class-enemy foes render
 *  from, rather than a second, hand-kept copy of the mapping (the Unity co-op mod this was ported from keeps its
 *  own switch statement for exactly this; a data-driven lookup here cannot drift out of sync with the sprite table
 *  the way a hand-written one can).
 *  2026-09-23 ("show ALL players as animated sprites, always"): this used to return null - and RemotePlayers used
 *  to leave the peer on the flat paperdoll forever - for a name it did not recognize AND for a name that never
 *  arrived at all (no class synced yet, an older peer whose look predates the field, or a custom class name
 *  `validLook` stripped for using a character its regex did not allow). Every one of those cases now lands on
 *  THIEF_MOBILE_TYPE instead, same as the Unity mod's own switch-statement default arm does for an unrecognized
 *  class name - so a peer is NEVER stuck without a mobileType to try, and the paperdoll fallback in RemotePlayers
 *  is reached only for its own remaining reasons (spritesOn off, or a build that is still composing/genuinely
 *  failing - a missing texture, deps not wired), never for "we don't know their class". */
export function classMobileType(name) {
  if (typeof name !== 'string' || !name) return THIEF_MOBILE_TYPE;
  const i = ENEMY_NAMES.indexOf(name);
  return i >= 43 ? 128 + (i - 43) : THIEF_MOBILE_TYPE;
}

export { LOOK_ITEM_FIELDS, LOOK_GROUPS };

/** A synthetic archive for the peers' dolls - no TEXTURE.### is this high. */
export const PEER_ARCHIVE = 900000;
/** The figure's height on the ground: the player's own capsule. */
export const PEER_HEIGHT = CAPSULE_HEIGHT;
/** Names farther than this, in scene units, are not drawn. */
export const NAME_RANGE = 60;

// ── NAME1 (2026-09-16, Mac: "Player names clip and cut off the top of the sprite head and additionally grow in size
// the further away + are able to be seen through walls") ─────────────────────────────────────────────────────────
//
// THREE FAULTS, ONE ROOT: the label was drawn at a CONSTANT pixel size with its TOP-LEFT on the head point and no
// sight test at all. So it hung DOWN over the skull (the clip), it kept its pixel size while the sprite shrank with
// depth (which reads as "grows the further away"), and a wall was nothing to it. The three laws below are the
// answer, and they live HERE rather than in either drawing pass because there are two faces now - the enhanced
// skin's DOM layer (ui/nameLayer.js) and the classic bitmap pass (drawNames) - and a law kept in one of them would
// drift from the other by the end of the week.

/** The gap, in screen pixels, between the top of the head and the BOTTOM of the label. Screen-space and fixed: the
 *  anchor already rides the body (it is the head point, projected), so a second world-space lift would only make the
 *  clearance swing with depth - which is the thing that went wrong. Small, because the label hangs off the head and
 *  a large gap reads as a label floating over nobody. */
export const NAME_GAP_PX = 5;
/* ═══ ACC1d-MARK IS RETIRED, AND ACC1g IS WHY ══════════════════════
 *
 * A mark stood beside a name the relay had CHECKED, because until the
 * gate a name could also be one the player had simply typed. Mac closed
 * that door - "You shouldnt be able to just type a name and enter
 * anymore.... this is what the account system is for" - and the relay
 * now refuses a hello it cannot verify.
 *
 * So every name over every head is a checked one, and a badge that
 * appears on all of them is the wallpaper Mac named when he took the
 * first polarity apart. It goes, with `NAME_MARK`, `NAME_MARK_GAP_PX`,
 * the point's `vouched` and the DOM layer's own span; the wire drops
 * `v` in the same deploy, because this was its only reader.
 *
 * THE MECHANISM IS IN THE HISTORY AND IN THE RECORD, not in a dead
 * branch here: a mark beside a label, measured off the name's own width
 * so the label stays centred on the skull, drawn in both faces out of
 * one point. If a later slice needs a mark again - a moderator, a
 * party leader, a mute - that is where to read how it was done.
 */
/** The depth, in scene units, at which a name is drawn at scale 1. A fixed world height projects to `f * H / depth`
 *  pixels, so `REF / depth` IS the perspective law - the label shrinks exactly as the body under it does. */
export const NAME_SCALE_REF = 18;
/** Below this the name stops being a word. A peer past `NAME_SCALE_REF / NAME_SCALE_MIN` (32.7 units) holds it. */
export const NAME_SCALE_MIN = 0.55;
/** And above this a name in your face would be a banner. Held from `NAME_SCALE_REF / NAME_SCALE_MAX` (12) in. */
export const NAME_SCALE_MAX = 1.5;
/** The label's height in CSS pixels at scale 1 - the DOM face's font-size, and the number the bitmap face's own
 *  scale is measured against. */
export const NAME_BASE_PX = 16;
// ── AUDIT NAME1 F3: THE SIZE IS THE FRAME'S, NOT THE SCREEN'S ─────────────────────────────────────────────────
// `REF / depth` alone is a law about the WORLD. What a player reads is PIXELS, and a pixel is a different slice of
// the view on a 400-px-tall phone than on a 900-px desktop, and a different slice again at FOV 120 than at FOV 60
// (ui/viewSettings.js - the player's own setting, read every frame). A fixed world height lands on
// `H / (2 * depth * tan(fov/2))` viewport pixels, so the two terms below are exactly what the pure depth law was
// missing: at FOV 120 the sprite is three times smaller and the name used to be the same size, and on a phone a
// 16-px label is two and a bit times the share of the screen it takes on a desktop.
//
// THEY ARE KEPT APART from `nameScaleFor` on purpose. The depth law is the one number BOTH faces read off the
// point; the terms below are measured in each face's OWN pixels - the DOM face in CSS px (so it takes the viewport
// term by value) and the classic bitmap face in drawing-buffer px, where the host's own `hudScale` (ui/hud.js: the
// 320x200 fit) is already that term. The LENS term belongs to neither face in particular - it is the lens both of
// them drew the sprite through - so it rides the point itself.
/** The viewport height, in a face's own pixels, the size law is normalised at. */
export const NAME_REF_H = 900;
/** And the lens: 60 degrees vertical - FOV_MIN, and the `Math.PI / 3` the port's five hosts drew with for nine
 *  milestones before Video/FieldOfView was wired. At the reference height and this lens every term below is 1, so
 *  `NAME_SCALE_REF / depth` still IS the whole law on the frame it was tuned on. */
export const NAME_REF_FOV = Math.PI / 3;
export const NAME_REF_FOCAL = 1 / Math.tan(NAME_REF_FOV / 2);
/** The band a DOM label's final size is held inside, in CSS px. A name is a thing to READ: the perspective terms
 *  may shrink it to a fifth of the base (a far peer on a phone at FOV 120) and that is smaller than a letter. The
 *  player's own HUD scale is applied OUTSIDE this band - it is a request, not an accident. */
export const NAME_PX_MIN = 9;
export const NAME_PX_MAX = 30;

/**
 * THE LENS TERM, off the projection the frame was drawn with: `proj[5]` is `1 / tan(fovY / 2)` for every
 * perspective this port builds (world/mat4.js perspective; mirrorProjectionX touches column 0 alone), so the name
 * is read out of the SAME matrix the sprite was projected by and cannot drift from a host's FOV wiring.
 * @param {ArrayLike<number>|null|undefined} proj
 */
export function nameLensScale(proj) {
  const f = Number(proj?.[5]);
  if (!Number.isFinite(f) || f <= 0) return 1;   // no lens to read is the reference lens
  return f / NAME_REF_FOCAL;
}

/** THE VIEWPORT TERM, for a face measured in CSS pixels: the world viewport's height against the reference. */
export function nameViewportScale(h) {
  if (!Number.isFinite(h) || h <= 0) return 1;
  return h / NAME_REF_H;
}

/**
 * THE DOM FACE'S FONT SIZE, in CSS px: the point's own scale (depth and lens), the viewport term, held inside the
 * legible band, and the player's HUD scale on top of that.
 */
export function namePixelSize(scale, viewport = 1, hudScale = 1) {
  const s = Number.isFinite(scale) ? scale : 1;
  const v = Number.isFinite(viewport) && viewport > 0 ? viewport : 1;
  const hud = Number.isFinite(hudScale) && hudScale > 0 ? hudScale : 1;
  return Math.max(NAME_PX_MIN, Math.min(NAME_PX_MAX, NAME_BASE_PX * s * v)) * hud;
}
/** How far short of the head the sight ray stops, in scene units. A peer's own body is not in the collider (peers
 *  are billboards and rigs, never triangles), but the floor, a doorframe or the lip of the arch they stand under can
 *  sit within a hand's breadth of the head point and would otherwise blind every name in a doorway. The same posture
 *  player/activate.js pickFoeAlong takes with its own 0.05 (`wall < d - 0.05`), at a head's scale. */
export const NAME_SIGHT_SKIN = 0.2;

/**
 * THE SIZE LAW, pure. `REF / depth`, clamped both ends - monotone non-increasing in depth, and inside the band a
 * peer twice as far away wears a name half the size.
 * @param {number} depth the view-space depth of the head point (player/tapRay.js projectToScreen's `depth`)
 */
export function nameScaleFor(depth) {
  if (!Number.isFinite(depth) || depth <= 0) return NAME_SCALE_MAX;   // a point on the lens is as near as a point can be
  return Math.min(NAME_SCALE_MAX, Math.max(NAME_SCALE_MIN, NAME_SCALE_REF / depth));
}

/**
 * THE SIGHT LAW: is solid world standing between the eye and this head point?
 *
 * WHY THE COLLIDER AND NOT A DEPTH TEXTURE. The port's frame is not rendered to a target in the shipping hosts - it
 * draws to the default framebuffer - so a depth read at the projected point would mean either a new render target
 * for every frame of every host or a `readPixels` stall in the middle of one, and it would answer for the pixel
 * rather than for the peer (a flat in front of the head, a raindrop, the player's own weapon). The collider's
 * `raycast` is the test this engine ALREADY uses for exactly this question - `pickActivatableHit` rejects an
 * activatable behind a wall with it, `pickFoeAlong` rejects a foe behind one - it is one ray a peer a frame against
 * a uniform grid, and it is the same triangles the player cannot walk through. So the name obeys the same wall the
 * body does.
 *
 * WHAT IT CANNOT SEE, said out loud: the collider holds TRIANGLE BUCKETS - buildings, models, city gates, windmill
 * towers, action doors, an interior's or a dungeon's mesh - and the exterior's TERRAIN is not one of them
 * (player/collider.js keeps the ground as a `heightAt` floor for the capsule, and `raycastHit` walks buckets alone).
 * So out in the open a HILL between two players hides the body and not the name. That is a known, named limit and
 * not a silent one: it is the exterior's own shape, the same one player/socialPick.js records for the F-menu's
 * cylinder, and closing it would mean a terrain ray this engine does not have.
 *
 * @param {{raycast?: (o: number[], d: number[], m: number) => number}|null|undefined} collider the LIVE one
 * @param {number[]} eye
 * @param {number[]} head
 * @param {number} [skin]
 * @returns {boolean} true when the name must not be drawn
 */
export function sightBlockedBy(collider, eye, head, skin = NAME_SIGHT_SKIN) {
  if (typeof collider?.raycast !== 'function' || !eye || !head) return false;   // no collider is no wall: a host without one draws every name, as it always did
  const dx = head[0] - eye[0], dy = head[1] - eye[1], dz = head[2] - eye[2];
  const d = Math.hypot(dx, dy, dz);
  const reach = d - skin;
  if (!(reach > 0)) return false;   // a head inside the skin is not behind anything
  const hit = collider.raycast([eye[0], eye[1], eye[2]], [dx / d, dy / d, dz / d], reach);
  return Number.isFinite(hit) && hit < reach;
}

/** AUDIT NAME1 F2: how often a peer's sight line is actually re-cast, in ms. A ray is the one per-frame cost that
 *  scales with the crowd, and nothing a player can see changes in a tenth of a second: at 60 fps this is one ray a
 *  peer every nine frames instead of nine. */
export const NAME_SIGHT_MS = 150;
/** AUDIT NAME1 F5: and how long the ray must keep saying "blocked" before the name goes, in ms. ONE un-hysteresised
 *  ray strobes: a railing, a lamppost or the edge of a doorframe crossing the line for a frame took the name away
 *  and the DOM face REBUILT the element when it came back (measured: 12 nodes built, 8 appends, 5 removes over 10
 *  flickering frames). A name that waits out a flicker costs a name shown a tenth of a second behind a post; a name
 *  that does not costs the element. */
export const NAME_SIGHT_HOLD_MS = 150;
/** How long an id nobody has asked about is kept in the cache, ms. */
export const NAME_SIGHT_TTL_MS = 5000;

/**
 * AUDIT NAME1 F2/F5: THE SIGHT, CACHED AND HYSTERESISED - one object, because the two findings are one mechanism.
 * The cache is what makes the ray affordable (it is cast at most every `every` ms a peer) and the STAMP it keeps is
 * what gives the answer its hysteresis: a name is taken away only once the ray has said "blocked" for `hold` ms,
 * and is given back the instant it says "seen".
 *
 * It is keyed by PEER ID, so it is the host's to own for the session and not a frame's - a frame builds the closure
 * over it, never the cache. `rays()` is the budget, readable by a pin or a probe.
 *
 * @param {{now?: () => number, every?: number, hold?: number, ttl?: number,
 *          cast?: (c: any, eye: number[], head: number[]) => boolean}} [opts]
 */
export function createSightCache({ now = () => Date.now(), every = NAME_SIGHT_MS, hold = NAME_SIGHT_HOLD_MS,
  ttl = NAME_SIGHT_TTL_MS, cast = sightBlockedBy } = {}) {
  /** id -> { at: when the ray was last cast, raw: its answer, since: when it first said blocked, touched } */
  const seen = new Map();
  let rays = 0;
  let sweptAt = -Infinity;
  const blocked = (collider, eye, id, head) => {
    const t = now();
    if (typeof id !== 'string' || !id) { rays++; return cast(collider, eye, head); }   // no identity is no cache: ask
    let e = seen.get(id);
    if (!e) { e = { at: -Infinity, raw: false, since: null, touched: t }; seen.set(id, e); }
    e.touched = t;
    if (!(t - e.at < every)) {
      e.at = t;
      rays++;
      const raw = !!cast(collider, eye, head);
      e.since = raw ? (e.raw ? e.since : t) : null;   // the stamp survives a run of blocked answers and dies on a seen one
      e.raw = raw;
    }
    if (t - sweptAt >= ttl) { sweptAt = t; for (const [k, v] of seen) if (t - v.touched >= ttl) seen.delete(k); }
    return e.raw && e.since !== null && t - e.since >= hold;
  };
  return {
    blocked,
    rays: () => rays,
    size: () => seen.size,
    drop: (id) => seen.delete(id),
    clear: () => { seen.clear(); sweptAt = -Infinity; },
  };
}

/** The most distinct dolls kept on the GPU that NOBODY IS WEARING; past it the least recently drawn is released
 *  (AUDIT ONLINE C7).
 *  SLAM7 (2026-09-16, AUDIT SLAM): "that nobody is wearing" is the whole correction. This counted every ready doll,
 *  so once more than this many distinct looks stood in view the sweep released one that was ON SCREEN - whose batch
 *  it destroyed, which the next frame composed again, which released another. Measured over 40 frames with 199
 *  looks in view: 5,464 composes where 199 would do, 2,496 billboards destroyed, and only ever 64 peers drawn - a
 *  DIFFERENT 64 each frame, so the crowd flickered. A doll a billboard is wearing is not cache, it is the scene. */
export const DOLLS_MAX = 64;
/** A doll that failed to compose is not retried before this (AUDIT ONLINE C5). */
export const DOLL_RETRY_MS = 5000;
/** A class-enemy SPRITE build that failed is not retried before this. Kept far shorter than DOLL_RETRY_MS (2026-09-23,
 *  "always show all players as animated sprites"): the paperdoll fallback here is meant to be the rare, brief
 *  exception - a texture genuinely not there yet, deps not wired, a slow connection - not something a peer sits in
 *  for 5+ seconds at a stretch while a sprite would otherwise be one attempt away. A short retry means a transient
 *  failure (a texture load racing the network, or landing the very frame after this peer's build was requested)
 *  clears itself almost immediately, at the cost of one extra getTexture call a second for a peer that is still
 *  failing outright (missing deps, no texture row for that mobileType) - a real cost, but a bounded and small one:
 *  only peers CURRENTLY on the paperdoll retry at all, never the whole roster. */
export const MOBILE_RETRY_MS = 1000;

/** DISC23-B: the Eye Of The Beholder on-foot set this player CHOSE, or null - what the look's `eo` says (wire.js
 *  validLook). Null while their mod is off, and null while they have never chosen one: the mod ships on, so a set read
 *  off its default would dress every player who never opened the dial as its first set - a whole room of the same
 *  woman in green where each stood as their own class. The store knows a choice from a default (storedModSetting). */
export function ownEotbSet() {
  try {
    if (!modSetting('eye-of-the-beholder', 'Enabled')) return null;
    if (storedModSetting('eye-of-the-beholder', 'Graphics.OnFoot') === undefined) return null;
    return modSetting('eye-of-the-beholder', 'Graphics.OnFoot');
  } catch { return null; }   // not vendored: no set
}

/** The player's look, as the hello carries it. DISC23-B: `eotbSet` the chosen sprite set (ownEotbSet, the host's read). */
export function composeLook(entity, { eotbSet = ownEotbSet() } = {}) {
  const items = [];
  const table = entity ? equipTableOf(entity) : [];
  for (let slot = 0; slot < table.length; slot++) {
    const it = table[slot];
    if (!it) continue;
    const o = {};
    for (const k of LOOK_ITEM_FIELDS) if (it[k] != null) o[k] = it[k];
    if (o.equipSlot == null) o.equipSlot = slot;
    items.push(o);
  }
  // 2026-09-17: `class` rides the look alongside race/gender/face so a peer without a Morrowind body can be drawn
  // as the matching class-enemy sprite (see classMobileType, RemotePlayers) instead of the flat paperdoll. It is
  // NOT part of the doll's own recipe - `entity.career?.name` is either DFU's stock class ("Warrior", "Mage", ...)
  // or a custom class's name, and an unmapped one just leaves the peer on the paperdoll, same as today.
  // ONLINE-CLASS1: `class` is OMITTED, not null, when the career has no name - a look is a cache key (`lookKey`) and the
  // hello's own bytes, so a stray `class: null` would miss every look already cached, and a class-less peer must still
  // serialize to the bytes it always did.
  const klass = careerName(entity);
  // DISC23-B: `eo` OMITTED while the mod is off, `class`'s law - a look without it keeps the bytes it always had
  return { race: entity?.race ?? 'Breton', gender: entity?.gender ?? 'male', faceIndex: entity?.faceIndex ?? 0, ...(klass ? { class: klass } : {}), ...(Number.isInteger(eotbSet) ? { eo: eotbSet } : {}), items };
}

/** One string per distinct look: the doll cache's key.
 *  SLAM12 (AUDIT SLAM): MEMOISED ON THE LOOK OBJECT. This was recomputed for every peer every frame - `RemotePlayers.sync`
 *  once per doll peer and `PeerBodies.sync` once per peer - and at 199 dressed peers the `JSON.stringify` inside it
 *  was ~64% of the client's whole per-frame peer work (1.19 ms of 1.85 ms, measured). A look object is replaced,
 *  never mutated (`_peer`, `_refresh`), so its identity is exactly the key's lifetime: a WeakMap holds the string for
 *  as long as the look lives and no longer. A null look has no identity and is one constant (SLAM14 B6). */
const _keyOf = new WeakMap();
const _computeLookKey = (look) => `${look?.race ?? 'Breton'}|${look?.gender ?? 'male'}|${look?.faceIndex ?? 0}|${JSON.stringify((look?.items ?? []).map((it) => LOOK_ITEM_FIELDS.map((k) => it[k] ?? null)))}`;
const NULL_LOOK_KEY = _computeLookKey(null);   // SLAM14 (AUDIT SLAM FINAL B6): a look-less peer's key has no object to hang on - computed once, here
export const lookKey = (look) => {
  if (!look || typeof look !== 'object') return NULL_LOOK_KEY;
  let k = _keyOf.get(look);
  if (k === undefined) { k = _computeLookKey(look); _keyOf.set(look, k); }
  return k;
};

const uint = (v, max = 1e6) => (Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : null);

/**
 * A stand-in for the peer at the compositor: the identity fields and
 * an equip table with the look's items in their slots. The look is
 * RELAY DATA (AUDIT ONLINE C13): every field is clamped to what the
 * doll art indexes with, a group the art does not know is dropped,
 * and the table's 27 slots bound the items.
 */
export function peerStubEntity(look) {
  const entity = { race: typeof look?.race === 'string' ? look.race.slice(0, 16) : 'Breton', gender: look?.gender === 'female' ? 'female' : 'male', faceIndex: uint(look?.faceIndex, 9) ?? 0, class: typeof look?.class === 'string' ? look.class.slice(0, 20) : null, items: [], activeEffects: [], equip: createEquipTable() };
  const slots = entity.equip.slots.length;
  for (const it of look?.items ?? []) {
    if (!it || typeof it !== 'object' || entity.items.length >= slots) continue;
    const templateIndex = uint(it.templateIndex, 65535);
    const slot = uint(it.equipSlot);
    if (templateIndex == null || slot == null || slot >= slots || !LOOK_GROUPS.includes(it.group)) continue;   // a slot past the table is dropped, not clamped onto another
    const item = { templateIndex, group: it.group, equipSlot: slot };
    for (const k of ['material', 'dye', 'variant']) { const v = uint(it[k], 4095); if (v != null) item[k] = v; }
    entity.items.push(item);
    if (!entity.equip.slots[slot]) entity.equip.slots[slot] = item;
  }
  return entity;
}

/**
 * The figure's bounds in an RGBA buffer - the rows and columns with any
 * alpha - or null when it is empty (AUDIT ONLINE C11: the panel's
 * headroom and floor margin are not the figure, and a billboard the
 * panel tall stood the doll short and floating).
 */
export function alphaBounds(rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A sub-rectangle of an RGBA buffer, copied out. `bottomUp` writes
 *  the rows in reverse (OD1, 2026-09-12, Mac: "Paperdoll is upside down
 *  when viewing other players in multiplayer"): the compositor's
 *  buffer is a UI image, row 0 at the top, while the billboard shader
 *  samples GL's bottom-up texel order (render/renderer.js's header and
 *  its vUV note - "the quad top samples v = 1"). Every other billboard
 *  arrives from TextureFile.getColor32 already bottom-up; this one was
 *  the only top-down buffer ever handed to createBillboardBatch, so
 *  the peers stood on their heads. */
export function cropRgba(rgba, w, r, { bottomUp = false } = {}) {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const dst = bottomUp ? r.h - 1 - y : y;
    out.set(rgba.subarray(((r.y + y) * w + r.x) * 4, ((r.y + y) * w + r.x + r.w) * 4), dst * r.w * 4);
  }
  return out;
}

let _dollSeq = 0;   // the record keys, monotonic (AUDIT ONLINE C10: a size-and-millisecond key could repeat)

/** 3D-AUDIO: a peer's sounds play AT them - the linear falloff PEER-FS1 faked on a flat one-shot (full inside 6 m,
 *  silent past 30), now the panner's own, so a peer's steps, swings and hooves come from where they stand. */
export const PEER_SOUND_PROFILE = Object.freeze({ refDistance: 6, maxDistance: 30, distanceModel: 'linear' });
/** Past the far edge nothing is made at all (a panner and a source per step for a peer nobody can hear). */
export const peerInEarshot = (f, eye) => !(eye && eye.length === 3) || Math.hypot(f[0] - eye[0], f[1] - eye[1], f[2] - eye[2]) < PEER_SOUND_PROFILE.maxDistance;
function peerSound(audio, clip, at, volume) {
  if (audio.play3d) audio.play3d(clip, at, volume, PEER_SOUND_PROFILE);
  else audio.playOneShot?.(clip, volume);
}
export const ridingLoopName = (id) => `peerRide:${id}`;
/** AUDIT DISC7 B3: a mounted peer whose newest pose is older than this is standing still for the riding loop - a
 *  rider in motion sends at POSE_HZ, so a second of silence is a stall, not a gallop. */
export const PEER_RIDE_STALE_MS = 1000;

/** The peers of a session, as billboards and names. */
export class RemotePlayers {
  /**
   * @param {object} p
   * @param {import('../render/contract.js').RendererLike} p.renderer
   * @param {{fetchBytes: Function, palette: object, getTexture?: Function, uploadRecordFrame?: Function, audio?: {playOneShot: Function, play3d?: Function, setLoop3d?: Function, moveLoop3d?: Function}|null}|null} p.deps  the compositor's; PEER-FS1/2: and the one-shot audio door the peer sounds play through (null in a test, and then they are silent)
   * @param {Function} [p.compose] the compositor's door (composePaperDollPixels); a test hands in its own
   * @param {Function} [p.now]
   */
  constructor({ renderer, deps, compose = composePaperDollPixels, now = () => Date.now() }) {
    this.renderer = renderer;
    this.deps = deps;
    this._compose = compose;
    this._now = now;
    this._dolls = new Map();     // lookKey -> { rec, w, h } ready | Promise composing | { failedUntil } (insertion-ordered: the oldest first)
    this._footsteps = new Map(); // PEER-FS1: peer id -> FootstepMachine (the stride timing off their own pose)
    this._attackAn = new Map();  // PEER-FS2: peer id -> the last `an` heard, so a new swing count is a swing
    this._riding = new Map();
    this._onFoot = new Set();    // AUDIT DISC7 B4: peer ids last seen on foot - their next mount is a mount (the neigh soon after)    // RIDE-SOUND: peer id -> { anim: RidingAnimator, rd } - the mounted peer's hooves
    this._batches = new Map();   // peer id -> { batch, key, doll, peer } (doll kind) | { batch, kind: 'mobile', mobileType, gender, mobileUnit, archive, tex, height, lastAn, lastCn, peer } (mobile kind)
    this._shown = [];            // the last sync's drawable peers with their head heights - the name pass reads it
    this._wanted = new Set();    // SLAM7: the look keys the last sync ASKED FOR - composed or composing, drawn or not
    this._queue = Promise.resolve();
    this._mobiles = new Map();   // 2026-09-17: peer id -> a ready MobileUnit bundle | Promise building | { failedUntil } - see _mobileFor
    this._corpses = [];          // PCORPSE1: { pose, room, until, batch | null, building } - the fallen, in wire space
    this._told = new Map();      // AUDIT CONTRIB A3: acct -> { at, until, cried } - a party member's death their party pose tells of
    this._lastEye = null;        // PCORPSE1: the listener, for the cry's falloff between syncs
    this._lastToScene = null;
  }

  /** PCORPSE1: a peer fell. `pose` is its last pose (wire space), `room` the room it was heard in. The body is drawn
   *  from the next sync on; the cry plays now, at the distance the last sync placed the listener. */
  addCorpse(peer, pose, room = null, { until = null, quiet = false } = {}) {
    if (!pose) return;
    const ct = corpseTextureFor(peer?.look);
    const c = { id: peer?.id ?? null, acct: peer?.acct ?? null, pose: { x: pose.x, y: pose.y, z: pose.z }, room, until: until ?? this._now() + CORPSE_MS, ct, batch: null, building: false };
    this._corpses.push(c);
    while (this._corpses.length > CORPSES_MAX) this._dropCorpse(this._corpses.shift());
    const audio = this.deps?.audio;
    if (audio?.playOneShot && !quiet) {
      let falloff = 1;
      const eye = this._lastEye;
      if (eye && this._lastToScene) {
        const f = this._lastToScene(c.pose);
        const d = Math.hypot(f[0] - eye[0], f[1] - eye[1], f[2] - eye[2]);
        falloff = d <= 8 ? 1 : d >= 45 ? 0 : 1 - (d - 8) / 37;
      }
      if (falloff > 0) audio.playOneShot(peerDeathSound(peer?.look), falloff);
    }
  }

  /** PCORPSE1: bodies whose room the player has left for another kind of space are not this scene's to draw - a
   *  dungeon's local coordinates mean nothing outdoors. `keep(room)` answers whether a corpse heard there still
   *  belongs to the scene now. */
  keepCorpses(keep) {
    for (const c of [...this._corpses]) if (!keep(c.room)) this._dropCorpse(c);
  }

  /** RESURRECT1: the bodies lying in this scene, as the party pick reads a person ({id, acct, feet, height}). */
  corpseMarks(toScene = (p) => [p.x, p.y, p.z]) {
    return this._corpses.filter((c) => !c.dead && (c.id || c.acct)).map((c) => ({ id: c.id, acct: c.acct, feet: toScene(c.pose), height: 0.9 }));
  }
  /** PCORPSE3: is a body already lying for this account (or peer)? */
  hasCorpseOf(acct, id = null) { return this._corpses.some((c) => !c.dead && ((acct && c.acct === acct) || (id && c.id === id))); }
  /** PCORPSE3: the body of a member who got up (a respawn, a rise) - gone. */
  dropCorpseOf(acct) { for (const c of [...this._corpses]) if (acct && c.acct === acct) this._dropCorpse(c); }

  /** PCORPSE3, AUDIT CONTRIB A3: A PARTY MEMBER'S BODY THEIR PARTY POSE TELLS OF (`dd` {k, x, y, z, at}). The host
   *  kept one memo per death and wrote it BEFORE asking whether the body's room was this scene's - so a body in a
   *  dungeon I walked into after the death never stood, and one a building's walls took from the scene (keepCorpses)
   *  never came back. The minute runs from the first word of THIS death (`at`) on this clock; the body stands
   *  whenever `here` (the scene is the one it lies in) and none lies already, for what is left of its minute, and it
   *  cries only the once. */
  partyBody(acct, id, look, dd, here) {
    if (!acct || !dd) return;
    let e = this._told.get(acct);
    if (!e || e.at !== dd.at) this._told.set(acct, e = { at: dd.at, until: this._now() + CORPSE_MS, cried: false });
    if (this.hasCorpseOf(acct, id)) { e.cried = true; return; }   // the death pose brought it (and its cry)
    if (!here || this._now() >= e.until) return;
    this.addCorpse({ id, acct, look }, dd, dd.k, { until: e.until, quiet: e.cried });
    e.cried = true;
  }
  /** PCORPSE3: a member no longer fallen (a rise, a respawn) - the body goes with the word of it. */
  partyRose(acct) { this._told.delete(acct); this.dropCorpseOf(acct); }
  /** PCORPSE3: a member gone from the party - nothing more is told of them; a body lying stays its minute. */
  partyForget(acct) { this._told.delete(acct); }

  _dropCorpse(c) {
    if (!c) return;
    const i = this._corpses.indexOf(c);
    if (i >= 0) this._corpses.splice(i, 1);
    c.dead = true;
    if (c.batch) this.renderer.destroyBillboardBatch?.(c.batch);
    c.batch = null;
  }

  _syncCorpses(toScene) {
    const now = this._now();
    for (const c of [...this._corpses]) {
      if (now >= c.until) { this._dropCorpse(c); continue; }
      if (!c.batch) {
        if (c.building || !c.ct || !this.deps?.getTexture || !this.deps?.uploadRecordFrame) continue;
        c.building = true;
        Promise.resolve(this.deps.getTexture(c.ct.archive)).then((tex) => {
          c.building = false;
          if (c.dead || !tex || c.ct.record >= (tex.recordCount ?? Infinity)) return;
          try {
            this.deps.uploadRecordFrame(c.ct.archive, c.ct.record, 0);
            const batch = this.renderer.createBillboardBatch(c.ct.archive, `${c.ct.record}#0`, billboardSize(tex, c.ct.record), [[0, 0, 0]]);
            batch.origin = [0, 0, 0];
            c.batch = batch;
          } catch { c.ct = null; }   // a body that cannot be drawn is not retried every frame; the cry already played
        }, () => { c.building = false; });
        continue;
      }
      const f = toScene(c.pose);
      c.batch.origin[0] = f[0]; c.batch.origin[1] = f[1]; c.batch.origin[2] = f[2];
    }
  }

  /** The doll for a look: composed once per look, serialized; a failure waits DOLL_RETRY_MS before another try. */
  dollFor(look) {
    const key = lookKey(look);
    const have = this._dolls.get(key);
    if (have && have.failedUntil != null) {
      if (this._now() < have.failedUntil) return null;
      this._dolls.delete(key);
    } else if (have) return have;
    const p = (this._queue = this._queue.then(() => this._composeDoll(look)).catch(() => null));
    this._dolls.set(key, p);
    p.then((doll) => {
      // SLAM12 (AUDIT SLAM): a doll that lands after its key was released - by `_evict`, or by `destroy()` at the
      // page's hide - has a texture on the GPU that nothing references. It used to be orphaned here. Measured: sync
      // fifty peers, destroy, fifty textures uploaded, none released.
      if (this._dolls.get(key) !== p) { if (doll && typeof doll.rec === 'string') this.renderer.releaseTexture?.(PEER_ARCHIVE, doll.rec); return; }
      if (doll) { this._dolls.set(key, doll); } else this._dolls.set(key, { failedUntil: this._now() + DOLL_RETRY_MS });
      this._evict();   // SLAM4: a FAILURE sweeps too - it was the one outcome that never reached the eviction
    });
    return p;
  }

  async _composeDoll(look) {
    const { deps, renderer } = this;
    if (!deps || !renderer) return null;
    const px = await this._compose(deps, peerStubEntity(look), { context: 'town', background: false });
    if (!px?.rgba) return null;
    const r = alphaBounds(px.rgba, px.width, px.height);
    if (!r) return null;
    const crop = cropRgba(px.rgba, px.width, r, { bottomUp: true });   // OD1: the billboard samples bottom-up
    const rec = `doll_${++_dollSeq}`;
    renderer.uploadTexture(PEER_ARCHIVE, rec, { width: r.w, height: r.h, colors: new Uint32Array(crop.buffer) });
    return { rec, w: PEER_HEIGHT * (r.w / r.h), h: PEER_HEIGHT };
  }

  /** The mobile-unit bundle for a peer's class-enemy sprite: composed once per PEER (not shared by look, the way a
   *  doll is - each peer's MobileUnit keeps its own animation clock and facing, exactly as each foe's own `f.mobile`
   *  does in dungeonContext.js), retried after MOBILE_RETRY_MS on a failure (a missing texture, a build that threw) -
   *  same shape as `dollFor`, so a peer this fails for just keeps the paperdoll rather than never being drawn - just
   *  for a much shorter stretch than a failed doll compose gets (see MOBILE_RETRY_MS's own comment for why).
   *  `mobileType`/`gender` changing (a peer's class - or, mid-look, their sex - changed) tears down and rebuilds:
   *  a MobileUnit is built FOR one type/gender pair, and does not re-type itself the way a foe's async retypeFoe can.
   *
   *  BUGFIX (2026-09-20, "sprites on, still see a stiff paperdoll"): `have` is a PENDING PROMISE for every frame the
   *  build has not landed on yet - `_buildMobile` is async and its result is stored in `this._mobiles` the moment it
   *  is CALLED, not when it resolves (see below). A bare Promise carries none of the bundle's own fields, so
   *  `have.mobileType` read off it was always `undefined` and never matched the requested `mobileType` - every frame
   *  that found a still-pending build misread it as "wrong type", fell through, and started a BRAND NEW build,
   *  discarding the one already in flight. `_mobileFor` is called once a peer, every sync(): any texture load that
   *  does not land inside a single frame's own microtask queue (the common case - a first-ever load of that class's
   *  archive, a slow connection, several peers loading at once) never got the chance to finish at all, and the peer
   *  sat on the paperdoll fallback (the documented "composing" state) forever, not just for the one frame it was
   *  meant to. The promise now carries the type/gender it is building for, exactly as a landed bundle already does,
   *  so the SAME check above recognizes and returns an in-flight build instead of restarting it. */
  _mobileFor(peerId, mobileType, gender) {
    const have = this._mobiles.get(peerId);
    if (have && have.failedUntil != null) {
      if (this._now() < have.failedUntil) return null;
      this._mobiles.delete(peerId);
    } else if (have) {
      if (have.mobileType === mobileType && have.gender === gender) return have;
      // a ready bundle, OR A BUILD ALREADY IN FLIGHT, for the WRONG type/gender - fall through and rebuild, same as
      // a look-key miss for a doll
    }
    // BUGFIX: tag the in-flight promise so THIS SAME peer/type/gender is recognized as already building, next frame
    // and every frame after, instead of being mistaken for "no build yet" and restarted. Object.assign rather than
    // two property writes because a bare `p.mobileType = ...` is a write to a property Promise does not declare, and
    // `npm run types` refuses it (TS2339); assigning at the point of creation gives the binding the tagged type.
    const p = Object.assign(this._buildMobile(mobileType, gender).catch(() => null), { mobileType, gender });
    this._mobiles.set(peerId, p);
    p.then((bundle) => {
      if (this._mobiles.get(peerId) !== p) return;   // SLAM12's own race: a peer released or rebuilt while this was in flight
      if (bundle) this._mobiles.set(peerId, bundle);
      else this._mobiles.set(peerId, { failedUntil: this._now() + MOBILE_RETRY_MS });
    });
    return p;
  }

  async _buildMobile(mobileType, gender) {
    const { deps } = this;
    const basics = ENEMY_BASICS[mobileType];
    if (!deps?.getTexture || !deps?.uploadRecordFrame || !basics?.maleTexture) {
      // Mac, 2026-09-17: "just fix it" - this used to fail silently (a
      // permanent, unlogged fallback to the paperdoll) with no way to tell
      // WHICH of the three things was missing. Now it says so once per
      // mobileType, so the real cause (deps never wired vs. no texture row
      // for this class) is visible instead of invisible.
      if (!this._warnedMissing) this._warnedMissing = new Set();
      if (!this._warnedMissing.has(mobileType)) {
        this._warnedMissing.add(mobileType);
        console.warn(`[remotePlayers] class sprite ${mobileType} unavailable - `
          + `getTexture:${!!deps?.getTexture} uploadRecordFrame:${!!deps?.uploadRecordFrame} `
          + `maleTexture:${basics?.maleTexture ?? 'none'} - falling back to the paperdoll for this peer.`);
      }
      return null;
    }
    const archive = gender === 'female' && basics.femaleTexture ? basics.femaleTexture : basics.maleTexture;
    const tex = await deps.getTexture(archive);
    if (!tex) {
      if (!this._warnedMissing) this._warnedMissing = new Set();
      const key = `tex${archive}`;
      if (!this._warnedMissing.has(key)) {
        this._warnedMissing.add(key);
        console.warn(`[remotePlayers] getTexture(${archive}) returned nothing for class sprite ${mobileType} - falling back to the paperdoll.`);
      }
      return null;
    }
    const mobileUnit = new MobileUnit(mobileType, basics, (rec) => tex.getFrameCount(rec), Math.random, gender);
    return { mobileType, gender, mobileUnit, archive, tex, height: 0, lastAn: null, lastCn: null };
  }

  /** The looks the scene needs right now: the ones the last sync ASKED FOR - drawn, or composing and not yet handed
   *  over. Neither is cache.
   *  SLAM7: the composing half is not a nicety. A doll composes between one frame and the next, so for that gap no
   *  batch is wearing it - and a sweep run by another compose finishing in the same gap released it unworn, before
   *  it was ever drawn once. That alone cost 213 of the 412 composes the first cut of this fix still paid at 199
   *  looks; with it the count is exactly the 199 the room actually has.
   *  SLAM15 (AUDIT SLAM FINAL B4): this used to union the WORN keys in as well, and that half was redundant by
   *  construction - `sync` adds every drawn peer's key to `_wanted` before it touches the peer's batch and destroys
   *  the batch of every peer it did not draw, and `destroy()` empties both - so after any sync every batch's key is
   *  already in `_wanted`. The invariant is pinned (slam15); the set is the wanted set. */
  _needed() { return this._wanted; }

  /** SLAM7: this map is its own LRU list - a key used this frame is moved to the END, so `_evict` walking from the
   *  front releases the least recently DRAWN. Before this the order was first-ever-composed and never changed
   *  again, however long a look had been on screen: not FIFO by use, FIFO by birth. */
  _touch(key) {
    const v = this._dolls.get(key);
    if (v === undefined) return;
    this._dolls.delete(key);
    this._dolls.set(key, v);   // the same value, so dollFor's `this._dolls.get(key) !== p` identity check still holds
  }

  /** Past DOLLS_MAX ready dolls THE SCENE DOES NOT NEED, the least recently drawn goes: its texture released, the
   *  batches wearing it dropped (SLAM7: there are none, by construction - that is the point). */
  /** SLAM4: AND THE FAILURES AGE OUT. `_evict` counts only the READY dolls, so the `{ failedUntil }` records left by
   *  a look that would not compose were never counted and never swept - only re-asking for that exact look cleared
   *  one, and a look nobody wears again is never asked for. Every distinct broken look a session sees stayed in this
   *  map for its whole life. Small each; unbounded in a crowd, which is what an event is. */
  _evict() {
    const now = this._now();
    for (const [k, v] of [...this._dolls]) if (v && v.failedUntil != null && now >= v.failedUntil) this._dolls.delete(k);
    const needed = this._needed();
    while (true) {
      let spare = 0, oldest = null;
      for (const [k, v] of this._dolls) if (v && typeof v.rec === 'string' && !needed.has(k)) { spare++; if (!oldest) oldest = k; }
      if (spare <= DOLLS_MAX || !oldest) return;
      this._release(oldest);
    }
  }

  _release(key) {
    const doll = this._dolls.get(key);
    this._dolls.delete(key);
    if (!doll || typeof doll.rec !== 'string') return;
    for (const [id, e] of this._batches) {
      if (e.key !== key) continue;
      this.renderer.destroyBillboardBatch?.(e.batch);
      this._batches.delete(id);
    }
    this.renderer.releaseTexture?.(PEER_ARCHIVE, doll.rec);
  }

  /**
   * Once a frame: a batch per drawable peer whose doll is ready, at
   * the peer's feet in the SCENE frame (`toScene` maps a room pose to
   * it); a peer whose look changed gets a new batch (AUDIT ONLINE
   * C12); the batches of peers gone are released.
   */
  /**
   * HARD3: `bodyHeight` is called with a peer id, and its default took
   * none - so the DEFAULT was the documented signature and the real one
   * went unwritten. The annotation is the contract; the default still
   * answers 0 for every peer.
   * @param {Iterable<any>} peers
   * @param {(p: any) => number[]} [toScene]
   * @param {{bodyHeight?: (id: any) => number, dt?: number, eye?: number[]|null, poseAgeMs?: ((peer: any) => number)|null}} [opts]  PEER-FS1: `eye` is the listener, for the falloff
   */
  sync(peers, toScene = (p) => [p.x, p.y, p.z], { bodyHeight = () => 0, dt = 0, eye = null, poseAgeMs = null } = {}) {
    const live = new Set();
    // PCORPSE1: the fallen lie on whatever the living do - placed, aged out, drawn
    if (eye && eye.length === 3) this._lastEye = [eye[0], eye[1], eye[2]];
    this._lastToScene = toScene;
    this._syncCorpses(toScene);
    this._shown = [];   // every drawable peer, doll, mobile or body, for the name pass
    this._wanted = new Set();   // SLAM7: rebuilt every frame - a look nobody is standing in any more stops being needed at once
    // 2026-09-17: read once a sync, not once a peer - the pref does not change mid-frame, and a card's toggle takes
    // effect on the very next sync either way (this loop runs every frame; there is nothing to miss by not reading it fresher).
    const spritesOn = getPref('peerClassSprites');
    const seen = new Set();   // AUDIT DROPS E4: EVERY peer this sync met, body peers included - the two sound maps are swept against it, not against `live` (which a body peer never joins)
    for (const peer of peers) {
      if (!peer?.shown) continue;
      seen.add(peer.id);
      this._syncFootsteps(peer, toScene, eye);
      this._syncAttackSound(peer, toScene, eye);
      this._syncRidingSound(peer, toScene, dt, eye, poseAgeMs);
      // MWBODY1: a peer standing in a Morrowind body (net/peerBodies.js) draws no doll/mobile; its name still rides this pass, at the body's own head
      const bodyH = bodyHeight(peer.id);
      if (bodyH > 0) { this._shown.push({ peer, height: bodyH }); continue; }
      live.add(peer.id);
      // 2026-09-17: a peer whose class maps onto a class-enemy sprite (classMobileType) is drawn as that sprite,
      // animated off their synced pose (_syncMobilePeer) - the same billboard a hostile Warrior/Mage/etc. already
      // is, just puppeted by the wire instead of AI. 2026-09-23: classMobileType no longer returns null for "no
      // class yet" or "a custom class this build does not recognize" - both land on THIEF_MOBILE_TYPE now, so
      // EVERY peer maps to a sprite the instant spritesOn is true. Only a build that is still composing/waiting
      // out a retry (a missing texture, deps not wired - see _buildMobile), or the player having turned the
      // 'Other players' card off (spritesOn false), keeps the paperdoll now - never "we don't know their class".
      // DISC12 (Mac: werewolves "not wired correctly"): A PEER IN BEAST FORM IS THE BEAST. The pose's `wb` says which
      // (LycanthropyTypes 1 werewolf, 2 wereboar); the sprite is the enemy's own (MobileTypes 9 / 14), puppeted off the
      // pose like any class sprite - whatever the 'Other players' card says, since a person drawn there is a lie.
      // PR-WW1 (2026-09-24, player report: "Werewolf morrowind sprite not showing online"): THE FALLBACK now. A beast
      // is drawn as Eye Of The Beholder's lycanthrope by net/peerRiders.js - the art the transformed player sees on
      // themselves - and reaches here only while that art is not up (loading, failed, or a build without it), when
      // `bodyHeight` answers 0: the enemy sprite stands for them then, so a beast is never nothing
      const beast = peer.shown.wb | 0;
      // AUDIT CONTRIB S1: a peer with NO LOOK yet (heard by pose before its introduction - first contact, a SLAM recall)
      // keeps the doll path until the look lands: classMobileType's Thief is for a look with no class or one this build
      // does not know, and handing it to a look that has not arrived drew a Thief, then nothing while the real class
      // built, then the real sprite
      const mobileType = beast ? (beast === 2 ? MOBILE_TYPES.Wereboar : MOBILE_TYPES.Werewolf) : spritesOn && peer.look ? classMobileType(peer.look.class) : null;
      const bundle = mobileType != null && ENEMY_BASICS[mobileType] ? this._mobileFor(peer.id, mobileType, peer.look?.gender === 'female' ? 'female' : 'male') : null;
      if (bundle && typeof bundle.then !== 'function') { this._syncMobilePeer(peer, bundle, toScene, dt, eye); continue; }
      this._syncDollPeer(peer, toScene);
    }
    for (const [id, entry] of this._batches) {
      if (live.has(id)) continue;
      this.renderer.destroyBillboardBatch?.(entry.batch);
      this._batches.delete(id);
      this._footsteps?.delete(id);   // PEER-FS1: a departed peer's stride machine goes with everything else
      this._attackAn?.delete(id);   // PEER-FS2: and their swing-edge tracker
    }
    // AUDIT DROPS E4: a peer drawn as a Morrowind BODY holds no batch, so the sweep above never reached their
    // stride machine or their swing edge - the entries stayed for the life of the session (SLAM4's class), and a
    // stale `an` played a phantom swing when that peer came back
    // RESURRECT1: a fallen player standing again where they fell (a resurrection) takes their body with them
    if (this._corpses.length) {
      const up = new Map();
      for (const peer of peers) if (peer?.shown && peer.id) up.set(peer.id, peer.shown);
      for (const c of [...this._corpses]) {
        const s = up.get(c.id);
        if (!s) continue;
        if (this._now() - (c.until - CORPSE_MS) < 2000) continue;   // PCORPSE2: a body's first two seconds - the fallen figure's last frames are not a rise
        const a = toScene(s), b = toScene(c.pose);
        if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 2.5) this._dropCorpse(c);
      }
    }
    for (const id of this._footsteps.keys()) if (!seen.has(id)) this._footsteps.delete(id);
    for (const id of this._attackAn.keys()) if (!seen.has(id)) this._attackAn.delete(id);
    for (const id of [...this._riding.keys()]) if (!seen.has(id)) this._stopRidingSound(id);   // RIDE-SOUND: a peer gone (or every peer, on the dead's empty sync) takes their hooves with them
    for (const id of [...this._onFoot]) if (!seen.has(id)) this._onFoot.delete(id);   // AUDIT DISC7 B4: and what they were last seen on
    // 2026-09-17: a departed peer's mobile bundle (or its in-flight build) goes with it. AUDIT 68
    // S14-remoteplayers-mobiles-unswept: swept against `live`, not inside the batch sweep - a peer gone before its build
    // landed held no batch, and the build then stored a whole bundle for nobody (`_mobileFor`'s own race check drops it now)
    for (const id of this._mobiles.keys()) if (!live.has(id)) this._mobiles.delete(id);
  }

  /** PEER-FS1 (Mac, 2026-09-18: "footstep sounds depending where they walk
   *  on... like you have" for online peers): one FootstepMachine per peer,
   *  driven by their own synced position and the SURFACE KIND they sent in
   *  their own pose (`fk` - their client already knows what they're
   *  standing on; a receiver has no cheap way to ask its own terrain
   *  queries about a point that is not the local player). 3D-AUDIO: the
   *  step plays AT them (`peerSound`, the panner's linear falloff of
   *  PEER_SOUND_PROFILE - full inside 6 m, silent past 30), where PEER-FS1
   *  once faked that falloff on a flat one-shot. */
  _syncFootsteps(peer, toScene, eye) {
    if (!this.deps?.audio?.playOneShot || getPref('peerFootsteps') === false) return;
    let fm = this._footsteps.get(peer.id);
    if (!fm) { fm = new FootstepMachine(); this._footsteps.set(peer.id, fm); }
    const shown = peer.shown;
    const f = toScene(shown);
    const set = FOOTSTEP_CLIP_SETS[shown.fk ?? 0] ?? FOOTSTEP_CLIP_SETS[0];
    // PEER-BUZZ (2026-09-22, Discord: "footstep sounds are broken" - a recording of a continuous buzz while a peer
    // walked): AUDIT DROPS E5 measured the stride in the WIRE's frame to dodge the floating-origin shift, and in
    // the OVERWORLD the wire's frame is world coordinates - 32768 per map pixel against the scene's 819.2, forty
    // scene units to one. A peer walking at 3 u/s moved 120 wire units a second, and the machine fired a step every
    // 2.5 of them: forty-eight a second, the buzz. The stride is measured in SCENE units, as the local one is, and
    // the recentre is handled the way EV1 handles it for the local machine - world.js calls `rebaseFootsteps` in
    // the same block that calls `footsteps.rebase()`, so the anchor re-seeds and the 819.2-unit jump is no stride.
    // AUDIT RIDE: a peer in the saddle takes no stride - the rider's own machine is silent on a mount (isOnFoot), so the others' is too
    const step = fm.update(f, { grounded: true, swimming: false, levitating: false, onFoot: !shown.rd, standingStill: !shown.mv, halfSpeed: false }, set);
    if (!step) return;
    if (!peerInEarshot(f, eye)) return;
    peerSound(this.deps.audio, step.clip, f, step.volume);
  }

  /** PEER-BUZZ: the floating origin moved - every peer's stride anchor re-seeds on its next frame, as the local
   *  machine's does (EV1 `footsteps.rebase()`), so the 819.2-unit shift of every scene point is not a step. */
  rebaseFootsteps() {
    for (const fm of this._footsteps.values()) fm.rebase();
  }

  /** PEER-FS2 (Mac: "attacking sounds are not in"): every SWING - not just
   *  the ones drawn as a class sprite - carries an `an` edge in the pose
   *  already (systems/hostCombat.js's own weapon-swing counter, wired
   *  through world.js's `arm`), so this tracks it for EVERY peer
   *  independently of which visual path (doll, mobile, body) they draw
   *  through. `swingSoundFor` is the exact same weapon-family lookup the
   *  local player's own PlaySwingSound path uses - the weapon read off
   *  whatever the peer's own look reports as equipped, not guessed. Same
   *  distance falloff as footsteps - see `_syncFootsteps`'s own header. */
  _syncAttackSound(peer, toScene, eye) {
    if (!this.deps?.audio?.playOneShot || getPref('peerAttackSounds') === false) return;
    const an = peer.shown.an | 0;
    const last = this._attackAn.get(peer.id);
    this._attackAn.set(peer.id, an);
    if (last == null || an === last) return;   // first sighting of this peer, or no new swing since
    const f = toScene(peer.shown);
    if (!peerInEarshot(f, eye)) return;
    // AUDIT DROPS E6: the weapon IN HAND (the look's right-hand slot), and none at all while the pose says sheathed
    // (`wd` 0 - a fist swings as a fist), not the first weapon anywhere in the look
    // DISC12: the hand the peer USES (`lh`), and a beast's claws are no weapon (fists' swing, WeaponManager :909)
    const hand = peer.shown.lh ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand;
    const weapon = peer.shown.wd && !peer.shown.wb ? ((peer.look?.items ?? []).find((it) => it?.group === 'Weapons' && it.equipSlot === hand) ?? null) : null;
    peerSound(this.deps.audio, swingSoundFor(weapon), f, 1.1);
  }

  /** RIDE-SOUND (Mac: the known limit - "other players' horses make no hoof sounds yet"): A PEER IN THE SADDLE IS
   *  HEARD. TransportManager's riding half (systems/riding.js RidingAnimator) runs for them as it does for me - the
   *  loop's clip (the fast clop, the cart's own rattle), its 0.2 s stop, its volume and its neigh - off their pose
   *  (`rd` the mount, `mv` moving), and it plays AT them: one named positional loop a peer, moved every frame, with
   *  the peers' own falloff. Gated with their footsteps ('peerFootsteps' - hooves are a mount's steps). */
  _syncRidingSound(peer, toScene, dt, eye = null, poseAgeMs = null) {
    const audio = this.deps?.audio;
    const rd = peer.shown?.rd | 0;
    if (!audio?.setLoop3d || !rd || getPref('peerFootsteps') === false) {
      this._stopRidingSound(peer.id);
      if (!rd) this._onFoot.add(peer.id);   // AUDIT DISC7 B4: seen on foot - a mount after this is a real one
      return;
    }
    const mode = rd === 2 ? TRANSPORT_MODES.Cart : TRANSPORT_MODES.Horse;
    let r = this._riding.get(peer.id);
    if (!r || r.rd !== rd) {
      // AUDIT DISC7 B4: UpdateMode's mount neigh (1-4 s) is for a MOUNT - a change of mount, or a rider seen on foot
      // before. A rider first seen already in the saddle (a room join, a cell crossing, back out of a building) did
      // not just mount: their neigh keeps the ordinary 2-39 s cadence.
      const mounted = !!r || this._onFoot.has(peer.id);
      if (r) this._stopRidingSound(peer.id);
      r = { anim: new RidingAnimator(), rd, at: null };
      r.anim.mount(mode);
      if (!mounted) r.anim.neighTime = r.anim.now + nextNeighDelay();
      this._riding.set(peer.id, r);
    }
    this._onFoot.delete(peer.id);
    // AUDIT DISC7 B3: a rider whose poses stopped (a tab in the background, a crash, a stall) stands - `visible` keeps
    // them for up to PEER_TIMEOUT_MS on their last pose, and a frozen gallop clopped in place for all of it
    const stale = typeof poseAgeMs === 'function' && poseAgeMs(peer) > PEER_RIDE_STALE_MS;
    // DISC7: the rider's own half-speed flag off the pose (`hs`) - standing reads true, as the motor's own does
    const moving = !!peer.shown.mv && !stale;
    const out = r.anim.update(Math.max(0, dt), { mode, standingStill: !moving, movingLessThanHalfSpeed: !moving || !!peer.shown.hs });
    const at = toScene(peer.shown);
    r.at = at;
    // AUDIT DISC7 B4: past earshot nothing is made - no panner and no source for a rider nobody can hear (the
    // animator keeps its clock, so the loop comes back in step when they ride into range)
    const heard = peerInEarshot(at, eye);
    audio.setLoop3d(ridingLoopName(peer.id), out.playing && heard ? SOUND[out.clip] : null, at, { volume: out.volume, pitch: out.pitch, ...PEER_SOUND_PROFILE });
    if (out.neigh && heard && audio.play3d) audio.play3d(SOUND.AnimalHorse, at, RIDING_VOLUME_SCALE, PEER_SOUND_PROFILE);
  }
  /** AUDIT DISC7 B6: the floating origin moved - every rider's loop is carried with it in the same frame the listener
   *  is (the sync above ran before the recentre, so its panners stood in the old frame for one frame: a click). */
  rebaseSounds(offset) {
    if (!offset) return;
    for (const [id, r] of this._riding) {
      if (!r.at) continue;
      r.at = [r.at[0] + offset[0], r.at[1] + offset[1], r.at[2] + offset[2]];
      this.deps?.audio?.moveLoop3d?.(ridingLoopName(id), r.at);
    }
  }
  _stopRidingSound(id) {
    if (!this._riding.has(id)) return;
    this._riding.delete(id);
    this.deps?.audio?.setLoop3d?.(ridingLoopName(id), null);
  }

  /** The paperdoll path, unchanged in shape from before the mobile-billboard branch existed - just factored out of
   *  `sync` so the two paths (doll, mobile) share the same peer loop and the same departed-peer cleanup. */
  _syncDollPeer(peer, toScene) {
    const key = lookKey(peer.look);
    this._wanted.add(key); this._touch(key);   // SLAM7: asked for this frame, so it is needed and it is the newest thing in the cache
    let entry = this._batches.get(peer.id);
    if (entry && (entry.kind === 'mobile' || entry.key !== key)) { this.renderer.destroyBillboardBatch?.(entry.batch); this._batches.delete(peer.id); entry = null; }
    if (!entry) {
      const doll = this._dolls.get(key);
      if (!doll || typeof doll.rec !== 'string') { this.dollFor(peer.look); return; }   // composing, or waiting out a failure
      const batch = this.renderer.createBillboardBatch(PEER_ARCHIVE, doll.rec, { w: doll.w, h: doll.h }, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
      entry = { kind: 'doll', batch, key, doll, peer };
      this._batches.set(peer.id, entry);
    }
    const f = toScene(peer.shown);
    entry.batch.origin[0] = f[0]; entry.batch.origin[1] = f[1]; entry.batch.origin[2] = f[2];
    entry.peer = peer;
    this._shown.push({ peer, height: entry.doll.h });
  }

  /** The class-enemy billboard path: `bundle.mobileUnit.update` is fed simple flags off the peer's OWN synced pose
   *  (`shown`), the same wire fields net/peerBodies.js already reads to drive its own (Morrowind) rig - `mv` for
   *  moving/running, `an`'s change for the striking edge - rather than anything new added to the wire protocol.
   *  `striking` only fires from the SECOND frame a given peer is seen onward (`entry.lastAn` starts null): a peer's
   *  attack counter is whatever it already was when they were first drawn, and comparing against nothing would
   *  read that as a swing that just happened, exactly the false trigger `dollFor`-style caching is built to avoid
   *  for a doll's look key. */
  _syncMobilePeer(peer, bundle, toScene, dt, eye) {
    let entry = this._batches.get(peer.id);
    if (entry && (entry.kind !== 'mobile' || entry.mobileUnit !== bundle.mobileUnit)) { this.renderer.destroyBillboardBatch?.(entry.batch); this._batches.delete(peer.id); entry = null; }
    const shown = peer.shown;
    const f = toScene(shown);
    const moving = !!shown.mv;
    const an = shown.an | 0;
    const striking = entry != null && entry.lastAn != null && an !== entry.lastAn;
    const yaw = Number.isFinite(shown.yaw) ? shown.yaw : 0;
    // BUGFIX (2026-09-17): mobileOrientation (characters/mobileUnit.js) reads cameraPos[0]/[2] unconditionally to
    // work out which of the 8 directional frames faces the viewer - it was never optional the way `null` assumed,
    // and crashed the moment a sprite actually built successfully. `eye` is the local player's own position, passed
    // in from world.js's onlineFrame (the same call site already reading `player.pos` for peerBodies.sync); the `f`
    // fallback (face the peer's own feet - degenerates to an arbitrary but valid angle, never a crash) only matters
    // if sync() is ever called without an eye at all, which callers should not do.
    //
    // BUGFIX 2 (2026-09-17, "same sideways stance no matter how anyone moves"): the guard here used to be
    // `Array.isArray(eye)`, which is FALSE for a typed array - and `player.pos` (world.js) is a Float32Array, not a
    // plain Array. So this always failed and silently substituted the peer's OWN feet as "the viewer", making every
    // peer face a coincident (zero-distance) point forever - orientation frozen regardless of anyone's real yaw or
    // position. `eye.length === 3` accepts either array kind.
    const out = bundle.mobileUnit.update(dt, { moving, striking }, yaw, f, eye && eye.length === 3 ? eye : f);
    const rkey = `${out.record}#${out.frame}`;
    if (!this.renderer.textures?.has?.(`${bundle.archive}_${rkey}`)) this.deps.uploadRecordFrame(bundle.archive, out.record, out.frame);
    const sz = mobileBillboardSize(bundle.tex, out.record);
    const size = { w: out.flip ? -sz.w : sz.w, h: sz.h };
    if (!entry) {
      const batch = this.renderer.createBillboardBatch(bundle.archive, rkey, size, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
      entry = { kind: 'mobile', batch, mobileUnit: bundle.mobileUnit, archive: bundle.archive, tex: bundle.tex, height: sz.h, lastAn: an, peer };
      this._batches.set(peer.id, entry);
    } else {
      entry.batch.record = rkey;
      entry.batch.size = size;
      entry.height = sz.h;
      entry.lastAn = an;
      entry.peer = peer;
    }
    entry.batch.origin[0] = f[0]; entry.batch.origin[1] = f[1]; entry.batch.origin[2] = f[2];
    this._shown.push({ peer, height: entry.height });
  }

  /** The batches for the hosts' billboard pass. */
  /** PEERFX3: a peer's drawn sprite (doll or class body), for the hurt flash; null when this layer draws none. */
  batchOf(id) { return this._batches.get(id)?.batch ?? null; }

  batches() {
    const out = [];
    for (const e of this._batches.values()) out.push(e.batch);
    for (const c of this._corpses) if (c.batch) out.push(c.batch);   // PCORPSE1: and the fallen
    return out;
  }

  /**
   * The names over the heads, in the HUD's own pass (after the 3D).
   * `rect` is the world viewport when the docked HUD shrinks it (E5,
   * AUDIT ONLINE C6): the projection lands where the peer is drawn.
   */
  /**
   * NAME1: the point is THE TOP OF THE HEAD - `feet + height`, the body's own capsule height for a Morrowind body
   * and the doll's `h` for a billboard, both already in `_shown`. It used to carry a `+ 0.25` world lift, which was
   * the clip's other half: a quarter of a unit is many pixels at arm's length and barely one at forty, so the
   * clearance it bought swung with depth in the wrong direction. The lift is gone; the gap is NAME_GAP_PX, in
   * screen pixels, and it belongs to the drawing pass because it is measured in the same units the label is.
   *
   * Each point carries `scale` (nameScaleFor of its own depth) and the `depth` it came from, so both faces size the
   * label from ONE number and a test can read the law off the point.
   *
   * THE FOUR CULLS, cheapest first: out of NAME_RANGE, behind the lens, off the strip, and then - last, because it
   * is the only one that costs a ray - BLOCKED. `blocked(head)` is the host's sight test (sightBlockedBy over the
   * live collider); nothing is passed on the probe hosts and every name is drawn, as it always was.
   *
   * THE ORDER IS THE BUDGET, and PERF-ON is why it is written down. The name pass is the one per-frame cost that
   * scales with how many people are online (Mac: "the more people that are online, the worse fps becomes"), so the
   * ray is paid ONLY for a peer who is in range, in front and on the strip - the peers a player can actually read -
   * and never for the room. One ray each, against a uniform grid, after three comparisons that cost nothing.
   * @param {((head: number[], id: string) => boolean)|null} [blocked]
   */
  namePoints(proj, view, w, h, eye, toScene = (p) => [p.x, p.y, p.z], rect = null, blocked = null) {
    const out = [];
    // AUDIT NAME1 F3: the frame's lens, once - it is the same for every point and it is read off the matrix the
    // sprites were projected by (nameLensScale), so a wide FOV shrinks the name exactly as it shrank the body.
    const lens = nameLensScale(proj);
    for (const e of this._shown ?? []) {
      const f = toScene(e.peer.shown);
      if (eye) { const dx = f[0] - eye[0], dz = f[2] - eye[2]; if (dx * dx + dz * dz > NAME_RANGE * NAME_RANGE) continue; }
      const head = [f[0], f[1] + e.height, f[2]];
      const s = projectToScreen(head, w, h, proj, view, rect);
      if (!s.front || s.x < -200 || s.x > w + 200 || s.y < -50 || s.y > h + 50) continue;
      // AUDIT NAME1 F2/F5: the peer's ID rides the sight test, because the answer is CACHED per peer and
      // hysteresised (createSightCache) - a head point alone has no identity to remember an answer under. Purely
      // additive: a host that passes the raw `sightBlockedBy` closure ignores the second argument.
      if (blocked && blocked(head, e.peer.id)) continue;
      // ACC3: THE BADGE RIDES THE POINT, because it is a fact about the
      // PEER - unlike `colorOf`, which is the social picture's knowledge
      // asked for by id. Both faces read it off here, so neither can
      // invent a title the other does not draw (ACC1d-MARK's own shape).
      // RENOWN1: and Renown, the relay's stamp - left of the name in both faces
      out.push({ id: e.peer.id, name: e.peer.name ?? '', x: s.x, y: s.y,
        title: e.peer.title ?? null, glyphs: Array.isArray(e.peer.glyphs) ? e.peer.glyphs : [], lv: e.peer.lv ?? null,
        scale: nameScaleFor(s.depth) * lens, depth: s.depth, lens });
    }
    return out;
  }

  /**
   * SOC4 (2026-09-16, Mac: "Upon joining a party, the players name who are in a party together should turn green"):
   * `colorOf` is an APPENDED optional parameter (it was the last one until NAME1 appended `blocked` behind it - the
   * rule is the same, nothing ahead of it moved), because a name's colour is not this module's business to know. A peer is a tab in a room; whether that tab belongs to somebody in my party (PARTY_MAX seats) is the social
   * picture's question (net/social.js colorOf -> PARTY_GREEN or null), and the host asks it. Nothing is passed on
   * the probe hosts and on every caller written before the party existed, so the default path stays exactly what it
   * was: white, byte for byte (test/online.test.js pins it).
   * @param {((id: string) => number[]|null)|null} colorOf peer id -> an RGBA array, or null for the plain name
   */
  /**
   * NAME1: THE CLASSIC FACE, KEPT - and it is not dead code. The enhanced skin's DOM layer (ui/nameLayer.js) is what
   * a player sees, because online forces the enhanced lane (OL1); this pass is what a host with no `document` draws,
   * which is every Node probe and every suite in test/. It is kept rather than retired because the two faces share
   * ONE law - `namePoints` answers the anchor, the size and the sight for both - so the fallback cannot drift from
   * the thing it stands in for, and retiring it would cost the suite its only way to read a name's position without
   * a browser. `scale` is the HOST's (hudScale); the point's own perspective scale multiplies it.
   *
   * THE ANCHOR IS THE LABEL'S BOTTOM. `drawText` takes a TOP-LEFT, and handing it the head point is exactly how the
   * label came to sit over the skull: the text is placed a full line UP from the gap, so its bottom edge lands
   * NAME_GAP_PX above the head at every distance.
   *
   * @param {((id: string) => number[]|null)|null} colorOf peer id -> an RGBA array, or null for the plain name
   * @param {((head: number[], id: string) => boolean)|null} [blocked] the sight test: a name behind a wall is not drawn
   */
  drawNames(renderer, font, proj, view, w, h, eye, scale = 1, toScene = (p) => [p.x, p.y, p.z], rect = null, colorOf = null, blocked = null) {
    return this.drawNamePoints(renderer, font, this.namePoints(proj, view, w, h, eye, toScene, rect, blocked), scale, colorOf);
  }

  /** The bitmap face over points ALREADY answered - so a host that has the points (nameFrame) draws them without
   *  projecting the room, and every ray, a second time. */
  drawNamePoints(renderer, font, points, scale = 1, colorOf = null) {
    if (!font) return 0;
    let drawn = 0;
    for (const n of points) {
      const s = scale * n.scale;
      // ACC3: the glyphs sit on the RIGHT OF THE NAME (Mac), so they
      // are part of the run the label is centred on - measured with it
      // rather than after it, or a badged peer's name drifts left off
      // their own skull by half the badge.
      const marks = glyphMarks(n);
      // RENOWN1: and the level LEFT of the name, in the same run for the same reason - boxed in brackets, the one box a
      // bitmap line can draw ("[12] Mack"; the DOM face draws a real one)
      const lead = renownText(n.lv);
      const run = `${lead ? `[${lead}] ` : ''}${marks ? `${n.name} ${marks}` : n.name}`;
      const tw = measureText(font.fnt, run) * s;
      // AUDIT NAME1 F13: the gap takes the HOST's scale, and only that one. NAME_GAP_PX is a clearance in SCREEN
      // pixels and this face draws in the drawing buffer's, where `scale` (ui/hud.js hudScale, the 320x200 fit) is
      // what carries one into the other - the same number the glyph box takes before the point's own perspective
      // term multiplies it. Unscaled, the classic face put a 5-buffer-pixel gap under a label drawn five times
      // over, which is a fifth of the clearance the DOM face leaves at the same size: the two faces disagreeing
      // about the one number they exist to share. It is NOT multiplied by `n.scale`, because a clearance that
      // swings with depth is the world-space lift NAME1 took out.
      const top = n.y - NAME_GAP_PX * scale - font.fnt.fixedHeight * s;
      drawText(renderer, font, run, Math.round(n.x - tw / 2), Math.round(top), s, colorOf?.(n.id) ?? [1, 1, 1, 1]);
      drawn++;
      // ACC3: THE TITLE IS ITS OWN LINE, ABOVE (Mac: "Player titles
      // appear above a player name"), in its own colour - which is the
      // one thing on this label `colorOf` does NOT get an opinion on,
      // because gold IS the Founder title and a party's green would
      // erase the distinction Mac asked for.
      const title = titleBadge(n);
      if (title) {
        const tt = measureText(font.fnt, title.text) * s;
        drawText(renderer, font, title.text, Math.round(n.x - tt / 2), Math.round(top - font.fnt.fixedHeight * s), s, title.rgba ?? [1, 1, 1, 1]);
        drawn++;
      }
    }
    return drawn;
  }

  /**
   * AUDIT NAME1 F1/F14: THE WHOLE NAME PASS, IN ONE CALL A TEST CAN DRIVE.
   *
   * It was four statements in scenes/world.js - the cull word, the points, the layer, the fallback - and four
   * statements inside a 10,000-line host is a thing only a REGEX can check, which is exactly what the suite was
   * doing. Here a pin builds the host's own composition (a real RemotePlayers, a real nameLayer over a fake
   * document, a real Collider with a real wall in it, real matrices) and drives the pass end to end.
   *
   * THE COVERED FRAME IS STILL A FRAME. A window over the HUD projects nothing and casts no ray - but the layer is
   * still rendered, because a DOM surface has to be TOLD to hide and because the bubble pump rides this call. The
   * dungeon's overlay arm used to skip the pass altogether (scenes/worldModes.js): the names stayed on the glass at
   * the positions of the frame the window opened on, painted over the overlay, until it closed.
   *
   * ONE FACE A FRAME: the layer where there is one, the bitmap pass where there is not. `w`/`h` are the face's own
   * pixels - CSS for the layer, the drawing buffer's for the bitmap pass - and the caller passes the pair that
   * belongs to the face it gave.
   * @param {{proj?: any, view?: any, w?: number, h?: number, eye?: number[]|null,
   *          toScene?: (p: any) => number[], rect?: any, covered?: boolean,
   *          layer?: any, log?: any, colorOf?: ((id: string) => number[]|null)|null,
   *          blocked?: ((head: number[], id: string) => boolean)|null,
   *          renderer?: any, font?: any, scale?: number, hudScale?: number}} [opts]
   * @returns {number} how many names the frame drew
   */
  nameFrame({
    proj, view, w, h, eye, toScene = (p) => [p.x, p.y, p.z], rect = null, covered = false,
    layer = null, log = null, colorOf = null, blocked = null,
    renderer = null, font = null, scale = 1, hudScale = 1,
  } = {}) {
    const points = covered ? [] : this.namePoints(proj, view, w, h, eye, toScene, rect, blocked);
    if (layer) {
      // the world viewport's own height where the docked HUD shrinks it (E5) - the name is sized by the frame it
      // is drawn into, not by the page (AUDIT NAME1 F3). The rect is NORMALISED (ui/hudLarge.js
      // largeHudViewportRect: `{ x: 0, y: hudHeight, w: 1, h: 1 - hudHeight }`), so its height is a SHARE of the
      // canvas and the pixels are that share of it.
      layer.render({ points, log, covered, colorOf, viewport: (Number.isFinite(rect?.h) ? rect.h : 1) * h, hudScale });
      return points.length;   // the NAMES the frame drew; the layer's own return is its bubbles (bubbleCount)
    }
    if (covered) return 0;
    return this.drawNamePoints(renderer, font, points, scale, colorOf);
  }

  /** Every batch and every doll texture released - the host's teardown. */
  destroy() {
    for (const id of [...this._riding.keys()]) this._stopRidingSound(id);   // RIDE-SOUND
    for (const e of this._batches.values()) this.renderer.destroyBillboardBatch?.(e.batch);
    this._batches.clear();
    this._wanted.clear();   // SLAM7: nothing is needed by a host that is gone
    for (const key of [...this._dolls.keys()]) this._release(key);
    this._mobiles.clear();   // 2026-09-17: no GPU resource of its own to release (the shared archive texture cache outlives any one peer), just the map
    for (const c of [...this._corpses]) this._dropCorpse(c);   // PCORPSE1: the host is gone, and its bodies with it
    this._told.clear();
  }
}
