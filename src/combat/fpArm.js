// MW-D8: THE MORROWIND FIRST-PERSON ARM, IN THE GAME.
//
// Seven stages of this arc shipped diagnostics and nothing touched the
// game. This is the wire. It owns no rules: every rule it applies is
// already ported and pinned in src/formats/mwFirstPerson.js and
// src/formats/mwAnim.js, and this file IMPORTS them rather than
// restating them. That is deliberate - MW7 failed by carrying a second
// port of one rule, and two copies of a rule drift.
//
// WHAT IT DRAWS, as of MW-D12: a TEXTURED pair of arms with the equipped
// weapon in hand, playing the stance the drawn weapon composes (rule 9),
// looping it the number of times rule 10's dice say, and running the
// equip / wind-up / release / follow / unequip sections of the weapon's
// own long group as the game asks for them. The scope boundary this note
// used to draw has moved; what is still outside it is in the STATUS
// block in bible/02-Formats/Morrowind-Rules.md, which is the one list.
//
// HOW IT DRAWS, and why this needs no renderer change at all: the port
// has ALREADY shipped a first-person pass. renderCharacterSprite
// (render/renderer.js:751) binds an offscreen target with its OWN depth
// renderbuffer, clears colour AND depth, swaps the frame's proj/view for
// ones the caller supplies, draws, and restores; drawScreenOverlayQuad
// (:987) composites it fullscreen with an alpha cut and no depth test.
// Two recorded rules fall out of that technique for free:
//
//   rule 29 - the first-person subtree renders with its OWN field of
//     view (60 degrees by default). We hand renderCharacterSprite its
//     own perspective, which is what the proj/view swap is for.
//   rule 52 - first person gets a bin whose draw CLEARS DEPTH first, so
//     the arms are never clipped by the world. Here that is structural
//     rather than emulated: no world geometry is ever drawn into that
//     framebuffer, so there is nothing to be clipped by.
//
// MW-D10: the framing constants this pass USED to borrow from the voxel
// viewmodel (render/characterSprite.js:74-86) are gone with the mapper
// that needed them. Rule 54 places the camera inside the rig, so there
// is no distance to push, no drop to apply and no scale to solve - and
// the viewmodel's two hard-won laws do not transfer either: its camera
// looks level because ITS pitch is an animation channel, where this one
// takes the player's pitch through the neck the reference rotates.

import { lookAt, multiply, ortho, perspective, transformPoint, trs } from '../world/mat4.js';
import { CHAR_PIXEL, CHAR_SPRITE_RT_SIZE } from '../render/renderer.js';
import {
  sampleTrack, resetClip, advanceClip, getTextKeyTime,
} from '../formats/mwAnim.js';
import { accumRootRef, buildSkeleton } from '../formats/mwSkin.js';
import { nodeTransformOf } from '../formats/mwCharacter.js';
import { parseNif } from '../formats/mwNifFile.js';
import { flattenNif } from '../formats/mwNifMesh.js';
import {
  assembleFirstPersonArm, poseAssembly, armPieceRows, clipReport, clipUnionBounds, bindPartsInto,
  armReport, armMeshPaths, bodyParts,
  weaponRecords, dfWeaponToMw, pickWeaponRecord, weaponAttachBone, MW_WEAPON_TYPE,
  ammoTypeFor, arrowAttachBone, ARROW_FALLBACK_NODE, reloadsItself, shootsRatherThanSwings,
  firstPersonCameraRef, composeStanceGroup, composeWeaponGroup, mwAttackType, attackKeys,
  weaponShortGroup, calculateWindUp, releaseStartPoint, EQUIP_KEYS, UNEQUIP_KEYS, isRealWeapon,
  aimingFactor, fpAnimSources, pickAnimSource, anySourceHasGroup, FP_BASE_MODEL, animSourceName,
  gmstValue, GMST_SNEAK_DELTA, sneakOffset,
  tpAnimSources, TP_BASE_MODEL, playerBodyRows, MW_UNITS_PER_METER, resolveBodyParts, ARM_PARTS, raceBeastFlag, raceRecords, armorRecords, clothingRecords,
  facePools, meshBounds,
  movementAnimState, composeMovementGroup, MOVEMENT_FALLBACK_SPEED, MOVEMENT_SPEED_CAP, turnAnimSpeed,
  jumpAnimState,
  sourcesKeyTime, sourcesVelocity,
} from '../formats/mwFirstPerson.js';
import { PART_BONES, dfRaceKeyOf } from '../formats/mwNpc.js';
import { portraitFeatures, headFeatures, hairFeatures, matchFace } from '../formats/mwFaceMatch.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { raceArt } from '../systems/races.js';
import { appStorage } from '../systems/appStorage.js';   // DA1: the storage seam
import { drawRigSpriteBox } from '../render/characterSprite.js';
import { WEAPONS } from '../characters/weapons.js';
import { materialName } from '../systems/itemInfo.js';
import { composeWornArmor, shadowSkinRows, fpWornAdds, mwArmorRecords, mwClothingRecord, CLOTHING_NAME } from '../formats/mwItemMap.js';
import { correctTexturePath, correctActorModelPath, wrapModes, warningImage, decodeTextureImage } from '../formats/mwTexture.js';
import { diffuseAt } from '../formats/mwNifMesh.js';

/** Rule 6's table, as a decision rather than a list. Werewolf is out of
 *  scope (it ships with Bloodmoon and Part VI records it ABSENT from a
 *  vanilla archive), and Daggerfall has no beast race at all - the beast
 *  arm is here because the rule has one, not because a Daggerfall player
 *  can reach it. A skeleton this archive lacks is REPORTED, never
 *  silently swapped: a silent fallback here is how an empty view got
 *  called a working one for four releases. */
export function fpSkeletonPath({ female = false, beast = false } = {}) {
  if (beast) return 'meshes/base_animkna.1st.nif';
  if (female) return 'meshes/base_anim_female.1st.nif';
  return 'meshes/xbase_anim.1st.nif';
}

/** MW-D24: rule 6's OTHER column - the THIRD-PERSON skeleton the same
 *  actor walks on (getActorSkeleton's !firstPerson branch,
 *  actorutil.cpp:8-19, through settings-default.cfg [Models]
 *  baseanim/baseanimfemale/baseanimkna). Werewolf out of scope for the
 *  same reason as above. */
export function tpSkeletonPath({ female = false, beast = false } = {}) {
  if (beast) return 'meshes/base_animkna.nif';
  if (female) return 'meshes/base_anim_female.nif';
  return 'meshes/base_anim.nif';
}
/** Rule 6 again: the first-person animation source sits beside it. This
 *  is the BASE source every first-person actor gets (mXbaseanim1st with
 *  its extension swapped); MW-D14 added the SECOND one a female or beast
 *  actor also gets - see fpAnimSources. */
export const FP_CLIP_PATH = 'meshes/xbase_anim.1st.kf';

/** Rule 9's BASE, which the weapon's short group is suffixed onto:
 *  "idle" + "1h" = "idle1h". MW-D12 retired the hardcoded 'Idle' - a
 *  constant group is a constant STANCE, and the arm held a bare-handed
 *  idle with a longsword drawn. */
export const FP_IDLE_BASE = 'idle';

/**
 * MW-D12 / RULE 10, and the arithmetic is worth spelling out because the
 * comment and the code count DIFFERENT THINGS.
 *
 *   numLoops = 1 + Misc::Rng::rollDice(4, prng);   character.cpp:808-810
 *   // play until the Loop Stop key 2 to 5 times, then play until the Stop key
 *
 * `rollDice(max)` is `uniform_int_distribution<int>(0, max - 1)`, so
 * numLoops is 1..4 - and that is the number of WRAPS, each of which costs
 * one decrement in advanceClip. One wrap is two traversals, so 1..4 wraps
 * is the comment's 2 to 5 plays. A port that reads "2 to 5" off the
 * comment and writes `2 + rollDice(4)` idles half again as long as
 * Morrowind does, which is the kind of error no screenshot can show.
 *
 * AND IT IS CONDITIONAL. numLoops starts at uint32 max - effectively
 * forever - and only becomes the dice roll when the actor HAS a weapon
 * short group (:800-812). A sheathed arm idles without end; a drawn one
 * runs to its stop key every few seconds. That condition is rule 10's
 * real content and the reason it is a first-person rule at all.
 */
export const FP_IDLE_LOOPS = () => 1 + Math.floor(Math.random() * 4);

/**
 * RULE 8's ANIMATION weapon type, which is NOT the item in your hand.
 *
 * `mWeaponType` is `ESM::Weapon::None` while nothing is drawn - the bare
 * "idle" group, no short suffix, and rule 10's endless loop - and it
 * becomes HandToHand the moment empty fists are RAISED (getWeaponType
 * returns HandToHand for an empty hand in a drawn stance, weapontype.cpp).
 * So the same empty hand is two different animation states, and the port
 * has both: playerWeapon.sheathed is the switch.
 *
 * Getting this wrong is not subtle: a sheathed player would idle in
 * "idlehh" with fists up, which is Morrowind's ready stance played while
 * Daggerfall says the weapon is away.
 */
export function animWeaponType(mwType, sheathed, spellReady = false) {
  // MW-D39 (Mac: Morrowind's spellcasting animations): A READIED SPELL IS
  // A STANCE. In the reference the spell is a WEAPON TYPE - Spell(-1),
  // whose short group is "spell" and long group "spellcast" - and
  // getWeaponType returns it whenever a spell is readied, before any
  // equipped weapon is consulted (weapontype.cpp / character.cpp's
  // getActiveWeapon). Daggerfall readies a spell the same way, so the
  // port asks the same question in the same order. The SHEATHED test
  // still comes first: a readied spell with the weapon put away is the
  // caster's own empty hands, which is exactly what the spellcast
  // animation wants, so the spell stance survives it.
  if (spellReady) return MW_WEAPON_TYPE.Spell;
  if (sheathed) return MW_WEAPON_TYPE.None;
  return mwType === MW_WEAPON_TYPE.None ? MW_WEAPON_TYPE.HandToHand : mwType;
}

/** CharacterController::UpperBodyState (character.hpp:107-117), in its own
 *  order. MW-D39 adds Casting, which the reference carries as
 *  UpperCharState_CastingSpell: the slice that reaches it is here now,
 *  so the member is no longer a lie the next reader has to disprove. */
export const UPPER_BODY = Object.freeze({
  None: 0,
  Equipping: 1,
  Unequipping: 2,
  WeaponEquipped: 3,
  AttackWindUp: 4,
  AttackRelease: 5,
  AttackEnd: 6,
  Casting: 7,
});

/** MW-D13: THE ORDER IS LOAD-BEARING, so these are numbers.
 *  `setAccurateAiming(mUpperBodyState > UpperBodyState::WeaponEquipped)`
 *  (character.cpp:1894) is a COMPARISON on this enum, and it is the only
 *  thing that decides whether the neck takes 0.75 of the look or all of
 *  it. A string enum cannot answer it. */
export const UPPER_BODY_NAME = Object.freeze(
  Object.fromEntries(Object.entries(UPPER_BODY).map(([k, v]) => [v, k])),
);

/** setAccurateAiming's argument, verbatim. Casting sits above
 *  AttackEnd in the reference's enum and is out of scope here, so the
 *  test is the same shape with one fewer state above the line. */
/** MW-D39: the spell's ATTACK TYPE, which names its key pair
 *  (character.cpp:1618-1636). Morrowind has three ranges; Daggerfall
 *  has five, and the two area forms cast like the point form they
 *  surround - an area at range is aimed, an area around the caster is
 *  not. */
export function spellAttackType(rangeType) {
  if (rangeType === 1) return 'touch';
  if (rangeType === 0 || rangeType === 3) return 'self';
  return 'target';
}

export const accurateAiming = (upper) => upper > UPPER_BODY.WeaponEquipped;

/** AnimState::getCompletion (animation.cpp:2160-2166) - the fraction of
 *  [startTime, stopTime] the playhead has covered. refreshIdleAnims
 *  feeds it straight back in as the next play's startPoint (:822-825),
 *  so a finished idle restarts AT ITS OWN END and the loop window
 *  immediately wraps it. That is not a bug being reproduced; it is why
 *  a re-armed idle does not visibly stutter back to the beginning.
 *
 *  MW-D33: the reference does NOT clamp the ratio, and a zero-length
 *  clip answers by whether it is still playing - `mPlaying ? 0.0f :
 *  1.0f` - a FINISHED zero-length clip is complete, not at its start.
 *  The port had clamped and answered 0 for both. */
export function clipCompletion(state) {
  if (!state) return 0;
  const span = state.stopTime - state.startTime;
  if (span > 0) return (state.time - state.startTime) / span;
  return state.playing ? 0 : 1;
}

/**
 * THE RELEASE'S START POINT, resolved against the file's own key times.
 *
 * Split out of the runtime so it can be pinned without a GPU: it is the
 * three getTextKeyTime calls of character.cpp:1767-1783 and nothing else.
 * Every one of them is a PREFIX lookup that answers -1 when the key is
 * absent (rule 46), and releaseStartPoint's ordering tests are what
 * filter that - no sentinel test anywhere, exactly as the reference.
 */
export function releaseSkip(keys, group, attackType, strength) {
  const k = attackKeys(attackType, strength);
  const t = (name) => getTextKeyTime(keys, `${group}: ${name}`);
  return releaseStartPoint(strength, {
    minAttackTime: t(k.minAttack),
    maxAttackTime: t(k.maxAttack),
    minHitTime: t(k.minHit),
    hitTime: t(k.hitKey),
  });
}

/**
 * RULE 54, AND THE PORT MAPPER IS GONE.
 *
 * MW-D8 shipped an invented framing - fit the arm's clip bounds into a
 * fixed span, push it ARM_FORWARD metres ahead of the eye and ARM_DROP
 * below it, cast the lens down by a constant - and its own comment said
 * it was "a PORT DECISION, not a claim of parity" and that rule 54 was
 * the authentic answer. Mac's screenshot is what that decision looks
 * like on retail data: two forearms adrift at the horizon, detached,
 * wrong scale, wrong angle.
 *
 * The authentic law needs no framing at all, because the camera is
 * INSIDE THE RIG:
 *
 *   mTrackingNode = getNode("Camera") ?? getNode("Head")   camera.cpp:353
 *   position      = that node's world translation, and in first person
 *                   NO height term at all                  camera.cpp:96
 *   orientation   = the PLAYER's look                      camera.cpp:127
 *   the neck takes 0.75 of the pitch              npcanimation.cpp:719
 *   first person field of view = 60.0            settings-default.cfg
 *
 * Everything else follows. The arms sit where Morrowind authored them
 * relative to that node, at whatever scale the file uses, because the
 * camera and the arms are in the same rig. There is no metre to convert
 * into and no span to fit - which is why the invented version could
 * never have been made right by tuning its constants.
 *
 * AND THE BASIS CHANGE NOTHING IN THE CHAIN EVER MADE. A Morrowind NIF
 * is Z-UP with +Y forward; this renderer is Y-UP with -Z forward.
 * Neither the reader, the flattener, the assembly nor the pass converted
 * between them, so the rig was drawn lying on its side and pointing away
 * from the viewer - which is exactly the two end-on forearms in the
 * screenshot. The fit-to-span framing then scaled whatever bounds that
 * produced and landed it "plausibly", which is how a 90-degree error
 * survived three probes and a mutation campaign: every assertion was in
 * MODEL space, and model space cannot see the frame it is drawn in.
 */
export const NIF_TO_PASS = trs(0, 0, 0, -90, 0, 0);

/** files/settings-default.cfg: `first person field of view = 60.0`. */
export const FP_FIELD_OF_VIEW = Math.PI / 3;

// IG6 (Mac's final call, 2026-08-31): NO tilt constants. The IG5 tilt
// (an under-rotated draw lens) came out INVERTED on the played screen
// and Mac closed the question: "just make it where it follows the
// screen. Just like classic daggerfall." So the shipped mode is the
// pure glue - neck at aim 1, offset zeroed, lens taking the whole look
// - whose image is INVARIANT under pitch: the arms are fixed to the
// screen exactly the way drawFpsWeapon's classic sprite is.

/** MW-D11: nine floats became eleven - [pos.xyz, colour.rgb, normal.xyz,
 *  uv.xy]. Stated once, here, because the pack and the VAO have to agree
 *  and a second copy of the number is how they stop agreeing. */
export const FP_FLOATS = 11;

/** Rule 54's placement, in the pass's axes: the camera node's rig-space
 *  translation, with the Z-up basis turned into the renderer's Y-up. */
export function firstPersonEye(mats, cameraRef) {
  const node = mats && mats.get(cameraRef);
  if (!node) return null;
  const [x, y, z] = node.t;
  return [x, z, -y];
}

/** How far the arm reaches from the camera node, in RIG units - all the
 *  near and far planes need, measured off the data instead of assuming a
 *  unit scale the file need not use. */
export function armReach(eye, unionBounds) {
  if (!eye || !unionBounds) return 1;
  let far = 0;
  for (const x of [unionBounds.minX, unionBounds.maxX]) {
    for (const y of [unionBounds.minY, unionBounds.maxY]) {
      for (const z of [unionBounds.minZ, unionBounds.maxZ]) {
        const d = Math.hypot(x - eye[0], z - eye[1], -y - eye[2]);
        if (d > far) far = d;
      }
    }
  }
  return far || 1;
}

/**
 * PACK THE ASSEMBLY for drawCharacter's vertex stream: 9 floats per
 * vertex, [pos.xyz, colour.rgb, normal.xyz], NON-INDEXED, because
 * drawCharacter issues drawArrays (renderer.js:702). The MW readers hand
 * back indexed triangles, so the indices are expanded here.
 *
 * NORMALS ARE COMPUTED, not read. poseAssembly skins positions with a
 * null normals-out (mwFirstPerson.js's skinBatch call), so there are no
 * normals to carry. One cross product per triangle gives flat shading,
 * which is what makes an untextured arm's form readable at all.
 *
 * AND RULE 13'S RENDERING CONSEQUENCE, which MW8 also lacked: a mirrored
 * piece has its X negated, which REVERSES its triangle winding, so its
 * computed face normal points inward. Negate it back. Without this the
 * left arm is lit inside-out - dark where the right arm is bright - and
 * that is a lighting bug that reads as "the mesh is wrong" rather than
 * as "the mirror is wrong". drawCharacter disables back-face culling
 * (renderer.js:700), so the winding costs nothing else.
 */
export function packFpArm(pieces, out = null) {
  let tris = 0;
  for (const p of pieces) tris += (p.indices ? p.indices.length : 0) / 3;
  const buf = out && out.packed && out.packed.length === tris * 3 * FP_FLOATS
    ? out.packed : new Float32Array(tris * 3 * FP_FLOATS);
  const ranges = [];
  let o = 0;
  let first = 0;
  for (const p of pieces) {
    const pos = p.positions;
    const idx = p.indices;
    if (!pos || !idx) continue;
    const uvs = p.uvs || null;
    // MW-D13 / RULE 63: the colour written per vertex is the RESOLVED
    // DIFFUSE, which is the vertex colour only when the mode says so.
    // What stood here read p.colors directly and the shader MULTIPLIED
    // it into the albedo - the exact error rule 63 opens by naming: "the
    // single most likely place for a port to be silently wrong. OpenMW
    // does not modulate the material by the vertex colour; the vertex
    // colour SUBSTITUTES for whichever material channel the colour mode
    // names." A mesh with both a material colour and vertex colours was
    // being tinted twice and drawn dark.
    const cols = p.colors || null;
    const mat = p.material || null;
    const flip = p.mirrored ? -1 : 1;
    const textured = !!(uvs && p.material && p.material.textureFile);
    // THE INVENTED SKIN TONE IS GONE. The reference's fragment starts at
    // opaque WHITE with no diffuse map (objects.frag:152-154) and the
    // NIF material defaults are overridden to white too
    // (nifloader.cpp:2740-2742), so an untextured surface is white lit by
    // the scene - not a flat colour somebody chose. The vertex colour,
    // when the mesh HAS one, substitutes for the material's diffuse and
    // ambient terms, which in this pass's single-product lighting is the
    // same arithmetic: texel * colour * (ambient + sun * diff).
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a]; const uy = pos[b + 1] - pos[a + 1]; const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a]; const vy = pos[c + 1] - pos[a + 1]; const vz = pos[c + 2] - pos[a + 2];
      let nx = (uy * vz - uz * vy) * flip;
      let ny = (uz * vx - ux * vz) * flip;
      let nz = (ux * vy - uy * vx) * flip;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-8) { nx /= len; ny /= len; nz /= len; } else { nx = 0; ny = 1; nz = 0; }
      for (let k = 0; k < 3; k++) {
        const v = [a, b, c][k];
        const vi = idx[i + k] * 2;
        buf[o++] = pos[v]; buf[o++] = pos[v + 1]; buf[o++] = pos[v + 2];
        const [dr, dg, db] = diffuseAt(mat, cols, idx[i + k]);
        buf[o++] = dr; buf[o++] = dg; buf[o++] = db;
        buf[o++] = nx; buf[o++] = ny; buf[o++] = nz;
        buf[o++] = uvs ? uvs[vi] : 0;
        buf[o++] = uvs ? uvs[vi + 1] : 0;
      }
    }
    const count = (idx.length / 3) * 3;
    // ONE RANGE PER PIECE, because a Morrowind arm is several meshes with
    // several textures and the character path issues drawArrays. The
    // range carries the piece's own texture name; the caller resolves it
    // once and hangs the GL texture here.
    ranges.push({ first, count, slot: p.slot, piece: p, textureFile: textured ? p.material.textureFile : null, tex: null, hidden: false });
    first += count;
  }
  return { packed: buf, ranges };
}

/**
 * BUILD. Async, expensive, explicitly triggered, and NEVER in a frame.
 *
 * Returns a status object and never throws: every failure is a named
 * stage and a message the card prints, because "an empty box" was the
 * reverted rig's defining behaviour and the one outcome forbidden here.
 *
 * `archives` and the raw esm bytes are dropped before returning.
 * MwBsaFile.get hands back a zero-copy subarray of the whole archive
 * (mwBsaFile.js), so keeping one 40 KB hand mesh would pin a ~300 MB
 * Morrowind.bsa for the life of the tab. Copy what we need, release the
 * rest.
 */
/** MW-D16: the weapon mesh is parsed twice - once by the assembly and
 *  once here, for getArrowBone's fallback - so it is cached per call
 *  rather than parsed twice for the same bytes. */
function parseNifOnce(bytes, cache = parseNifOnce.cache) {
  if (cache.has(bytes)) return cache.get(bytes);
  const nif = parseNif(bytes);
  cache.set(bytes, nif);
  return nif;
}
parseNifOnce.cache = new WeakMap();

/** getArrowBone's FIRST branch: does the ACTOR's own skeleton carry the
 *  ammo type's attach bone? */
function skeletonHasBone(skeletonBytes, name) {
  try {
    const skel = buildSkeleton(parseNifOnce(skeletonBytes));
    return skel.byName.has(String(name).toLowerCase());
  } catch { return false; }
}

/**
 * MW-D9's WEAPON RESOLUTION, one home (extracted at MW-D19 so a live
 * equip change resolves through the same door as the build).
 *
 * A Morrowind weapon is a RIGID part at a bone - rule 12's rigid half,
 * the same path armcuff has proved since MW-D6 - so it rides in as one
 * more part with an explicit `bones` override instead of the PART_BONES
 * table. Rule 17 is that override: the generic "Weapon Bone" is
 * replaced by the equipped type's own attach bone when the actor has
 * that node, which is how a bow reaches "Weapon Bone Left" (rule 8).
 *
 * AND THE BOW COMES OUT MIRRORED, which is faithful and surprising
 * enough to write down before someone "fixes" it. Rule 13's mirror is
 * a SUBSTRING TEST on the attach bone's name (SceneUtil::attach,
 * components/sceneutil/attach.cpp:166-181), and that function is the
 * generic attach path for every part - weapons included, not body parts
 * only. "Weapon Bone Left" contains "Left", so the bow is drawn with X
 * negated by exactly the same rule that mirrors the left hand. Nothing
 * here special-cases it.
 *
 * @returns {{mwType:number, parts:object[], weaponInfo:object|null,
 *   arrowInfo:object|null, notes:string[]}}
 */
/**
 * MW-D19: the identity a weapon swap compares. Everything that changes
 * WHICH mesh hangs on the bone is in it - the Morrowind type (two
 * Daggerfall templates mapping to one type are the same arm), the
 * material (pickWeaponRecord matches the record id on it), and whether
 * an arrow rides along. Two unknown items both fold to None and compare
 * equal, which is right: both draw nothing.
 */
/** MW-D32: the worn list as one comparable key - kind, template,
 *  material, in the readout's own order. */
/** MW-D32: see the walk memo in buildFpArm. Bounded by the handful of
 *  esm files a data set carries, times three record kinds. */
const ESM_WALK_CACHE = new Map();
// IG2: the .kf ANIMATION-SOURCE parse memo. clipReport parses a whole
// keyframe file and matches its tracks by NAME; for one skeleton path
// in one data generation the answer cannot change, and with the body
// following the equip table it was re-parsed on every swap, twice per
// rig. The cached result is read-only downstream - every build wraps
// it in its own source object and mints fresh clip states.
const CLIP_REPORT_CACHE = new Map();
async function cachedClipReport(gen, skeletonPath, name, bytesOf, skeleton) {
  if (gen === null || gen === undefined) return clipReport({ kfBytes: bytesOf(), skeleton, group: FP_IDLE_BASE });
  const key = `${gen}:${skeletonPath}:${name}`;
  let hit = CLIP_REPORT_CACHE.get(key);
  if (hit === undefined) {
    hit = await clipReport({ kfBytes: bytesOf(), skeleton, group: FP_IDLE_BASE });
    CLIP_REPORT_CACHE.set(key, hit);
  }
  return hit;
}
// IG2: decoded-texture memo, same generation key - a steel cuirass's
// texture does not change because a gauntlet did.
const TEXTURE_CACHE = new Map();
/** AUDIT 32 F2: the face match per identity per data generation. */
const FACE_MATCH_CACHE = new Map();

/** MW-D37: the mean colour of a CLOT record's worn texture (its first
 *  part reference's BODY mesh, male side) - what the dye-aware garment
 *  pick compares against Daggerfall's dye band. Memoised per data
 *  generation; null when nothing measures. */
const CLOT_COLOUR_CACHE = new Map();
/** AUDIT 34 F1: LAZY AND SYNCHRONOUS. The first sampler pre-measured
 *  EVERY CLOT record in the master the first time a garment was worn -
 *  hundreds of texture decodes for a shirt - and the icon door could
 *  not reach it at all, so an icon and the worn piece could disagree.
 *  Now one record is measured when the resolver asks for it (the
 *  resolver only asks about its own type's pool), memoised per data
 *  generation, and the same function serves the build and the icon. */
function clothingColourOf(rec, parts, archives, gen) {
  const key = `${gen}:${rec.id}`;
  if (CLOT_COLOUR_CACHE.has(key)) return CLOT_COLOUR_CACHE.get(key);
  let rgb = null;
  try {
    const ref = (rec.parts ?? []).find((r) => r.male || r.female);
    const body = ref ? (parts ?? []).find((b) => String(b.id || '').toLowerCase() === (ref.male || ref.female)) : null;
    const model = body ? body.model : rec.model;
    const path = `meshes/${model}`;
    const arc = archives.find((a) => a.has(path));
    if (arc) {
      const batches = flattenNif(parseNif(arc.get(path).slice()));
      const file = batches.map((b) => b.material && b.material.textureFile).find(Boolean);
      if (file) {
        const exists = (p) => archives.some((a) => a.has(p));
        const tpath = correctTexturePath(file, exists);
        const tarc = archives.find((a) => a.has(tpath));
        if (tarc) {
          const m0 = decodeTextureImage(tpath, tarc.get(tpath).slice()).mips[0];
          const f = hairFeatures(m0.rgba, m0.width, m0.height, 0);   // alpha-weighted mean
          if (f && f.colour) rgb = f.colour.map((v) => Math.round(v * 255));
        }
      }
    }
  } catch { rgb = null; }
  CLOT_COLOUR_CACHE.set(key, rgb);
  return rgb;
}

/** MW-D38: the icon cache, per data generation / record / size / dye. */
const ITEM_ICON_CACHE = new Map();

/** MW-D38: frame a mesh's bounds for the icon camera: a three-quarter
 *  view from above-front-right, the ortho fitted to the projected
 *  corners with a little air. Pure; pinned. */
export function iconFrame(bounds, { air = 1.12 } = {}) {
  const cx = (bounds.minX + bounds.maxX) / 2; const cy = (bounds.minY + bounds.maxY) / 2; const cz = (bounds.minZ + bounds.maxZ) / 2;
  const dir = [0.55, 0.65, 0.85];
  const dl = Math.hypot(...dir);
  const d = dir.map((v) => v / dl);
  const span = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ) || 1;
  const eye = [cx + d[0] * span * 2, cy + d[1] * span * 2, cz + d[2] * span * 2];
  const view = lookAt(eye, [cx, cy, cz], [0, 1, 0]);
  // project the eight corners into view space; the ortho half-extents
  // are the largest |x| and |y| seen, with air.
  let hw = 0; let hh = 0;
  for (const x of [bounds.minX, bounds.maxX]) for (const y of [bounds.minY, bounds.maxY]) for (const z of [bounds.minZ, bounds.maxZ]) {
    const p = transformPoint(view, x, y, z);
    hw = Math.max(hw, Math.abs(p[0])); hh = Math.max(hh, Math.abs(p[1]));
  }
  const half = Math.max(hw, hh) * air || 1;
  return { view, proj: ortho(half, half, 0.1, span * 8), eye };
}


/** MW-D35: MEASURE ONE MORROWIND BODY PART - its base texture's level-0
 *  RGBA and its mesh height - from the archives. Null-honest at every
 *  step; the matcher names the ones that could not be measured. */
async function measurePart(record, archives, kind) {
  const exists = (p) => archives.some((a) => a.has(p));
  const path = `meshes/${record.model}`;
  const arc = archives.find((a) => a.has(path));
  if (!arc) return null;
  let parseNif; let flattenNif;
  try {
    ({ parseNif } = await import('../formats/mwNifFile.js'));
    ({ flattenNif } = await import('../formats/mwNifMesh.js'));
  } catch { return null; }
  let batches;
  try { batches = flattenNif(parseNif(arc.get(path).slice())); } catch { return null; }
  const file = batches.map((b) => b.material && b.material.textureFile).find(Boolean);
  if (!file) return null;
  const tpath = correctTexturePath(file, exists);
  const tarc = archives.find((a) => a.has(tpath));
  if (!tarc) return null;
  let img;
  // MW-D34: by extension - the ladder legitimately answers .tga/.bmp.
  try { img = decodeTextureImage(tpath, tarc.get(tpath).slice()); } catch { return null; }
  const m0 = img.mips[0];
  if (kind === 'head') {
    // AUDIT 32 F1: sampled through the mesh's own UVs, so the texture's
    // layout is never assumed.
    return headFeatures(m0.rgba, m0.width, m0.height, batches.map((b) => ({ positions: b.positions, uvs: b.uvs })));
  }
  const shapes = batches.filter((b) => b.positions && b.positions.length);
  const bounds = shapes.length ? meshBounds(shapes) : null;
  return hairFeatures(m0.rgba, m0.width, m0.height, bounds ? bounds.maxZ - bounds.minZ : 0);
}

/** MW-D35: THE FACE, MATCHED. The classic portrait the player picked,
 *  measured; every playable head and hair of the race and sex,
 *  measured; the nearest of each chosen - all on the player's own data,
 *  at build time. Returns { head, hair, reasons } with nulls where a
 *  half could not be measured (the walk then stands for that half). */
export async function matchFaceFor({ race, female, faceIndex, parts, archives, deps }) {
  const reasons = [];
  let portrait = null;
  try {
    const art = raceArt(dfRaceKeyOf(race), female ? 'female' : 'male');
    const cif = new CifRciFile();
    const bytes = await deps.fetchArena2Bytes(art.heads);
    const pal = new DFPalette();
    pal.load(await deps.fetchArena2Bytes(cif.paletteName || 'ART_PAL.COL'), cif.paletteName || 'ART_PAL.COL');
    cif.load(bytes, art.heads, pal);
    portrait = portraitFeatures(cif.getDFBitmap(faceIndex | 0, 0), pal);
  } catch (err) {
    reasons.push(`portrait unreadable: ${err.message}`);
  }
  if (!portrait) return { head: null, hair: null, reasons: [...reasons, 'the walk stands'] };
  const pools = facePools(parts, race, female);
  const heads = [];
  for (const rec of pools.heads) heads.push({ id: rec.id, f: await measurePart(rec, archives, 'head') });
  const hairs = [];
  for (const rec of pools.hairs) hairs.push({ id: rec.id, f: await measurePart(rec, archives, 'hair') });
  const m = matchFace(portrait, heads, hairs, { female });
  const hex = (c) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  reasons.push(`portrait ${faceIndex | 0}: skin ${hex(portrait.skin)}, hair ${portrait.bald ? 'none' : hex(portrait.hair)}, `
    + `length ${portrait.length.toFixed(2)}, beard ${portrait.beard.toFixed(2)}`);
  return { head: m.head, hair: m.hair, reasons: [...reasons, ...m.reasons] };
}

/** MW-D33: one line per worn piece for the card - what it resolved to
 *  and what it dressed, or why it kept its sprite. Pure over the
 *  composer's own output; the adds name their record in `slot`. */
export function wornVerdicts(pieces, worn) {
  const rows = [];
  for (const p of pieces ?? []) {
    const label = p.kind === 'clothing'
      ? (p.name ?? `garment ${p.templateIndex}`)
      : `armor ${p.templateIndex} (material ${p.material ?? 0})`;
    const dressed = (worn?.adds ?? []).filter((a) => a.piece === p).map((a) => a.slot);
    const reason = (worn?.notes ?? []).find((n) => n.startsWith(label.split(' (')[0]) || (p.kind !== 'clothing' && n.startsWith(`armor ${p.templateIndex}:`)));
    rows.push({ label, dressed, reason: dressed.length ? null : (reason ?? 'no part reached the rig') });
  }
  return rows;
}

export function wornEquipKeyOf(pieces) {
  // MW-D37: the dye is part of a garment's identity now - a re-dyed
  // shirt resolves to a different MW shirt, so it is a change.
  return (pieces ?? []).map((p) => `${p.kind || 'armor'}:${p.templateIndex}:${p.material ?? ''}:${p.dye ?? ''}`).join('|');
}

export function fpWeaponKey(item, hasAmmo) {
  // MW-D38: the MATERIAL IS READ, at last. `item.materialName` was a
  // field no item ever carried - the name lives behind itemInfo's
  // materialName(item) - so every weapon of a type keyed the same and
  // resolved to the type's first record: a daedric longsword drew as
  // the id-sorted first longsword, and swapping it for an iron one was
  // not a change. Found by MW-D37's question - "do the textures map to
  // the materials" - because no weapon's ever had.
  return `${dfWeaponToMw(item, WEAPONS)}:${item ? materialName(item) : ''}:${hasAmmo ? 1 : 0}`;
}

/**
 * MW-D22: WHICH SIDE the weapon's attach bone rests on, made legible.
 * In Morrowind's basis an actor faces +Y with +Z up, so the actor's
 * right hand is +X (right = forward x up = y x z). The card prints this
 * beside the bone so a bug report can tell "the weapon hangs on the
 * wrong copy of the bone" (rule 16's duplicate trap) from "the view is
 * mirrored" without a screenshot argument.
 */
export function weaponRestSide(arm, bone) {
  const ref = arm && arm.skeleton && arm.skeleton.byName.get(String(bone || '').toLowerCase());
  const node = ref !== undefined && arm.mats ? arm.mats.get(ref) : null;
  if (!node) return 'unknown';
  const x = node.t[0];
  return x > 1e-4 ? 'right' : x < -1e-4 ? 'left' : 'centre';
}

/** Template 131 is Daggerfall's arrow. This test existed as THREE
 *  literals (the rig's out-of-arrows auto-sheathe, the card's build
 *  button, and the swap seam wanted a fourth) - one export now. */
export const DF_ARROW_TEMPLATE = 131;
export function hasDaggerfallArrows(items) {
  return !!items?.some((it) => it.templateIndex === DF_ARROW_TEMPLATE && (it.stackCount ?? 1) > 0);
}

export function resolveWeaponParts({ weapon, hasAmmo = false, allWeapons, find, skeletonBytes }) {
  const notes = [];
  const parts = [];
  let weaponInfo = null;
  let arrowInfo = null;
  const mwType = dfWeaponToMw(weapon, WEAPONS);
  if (mwType !== MW_WEAPON_TYPE.None) {
    const rec = pickWeaponRecord(allWeapons, mwType, weapon ? materialName(weapon) : null);   // MW-D38
    if (!rec) {
      notes.push(`weapon: your archives carry no unenchanted Morrowind weapon of type ${mwType}`);
    } else {
      const path = `meshes/${rec.model}`;
      const arc = find(path);
      if (!arc) notes.push(`weapon: ${path} (${rec.id}) is not in your archives`);
      else {
        // MW-D32: the TYPED bone only when the rig CARRIES it - the
        // reference starts from sPartList's "Weapon Bone" and switches
        // to the type's own mAttachBone only `if (found != nodeMap
        // .end())` (npcanimation.cpp:787-795). A rig without "Weapon
        // Bone Left" hangs the bow on "Weapon Bone" rather than
        // dropping it.
        const typed = weaponAttachBone(mwType);
        const bone = typed === 'Weapon Bone' || skeletonHasBone(skeletonBytes, typed)
          ? typed : 'Weapon Bone';
        const weaponBytes = arc.get(path).slice();
        parts.push({ slot: 'weapon', bones: [bone], bytes: weaponBytes });
        weaponInfo = { id: rec.id, name: rec.name, model: rec.model, type: mwType, bone,
          // MW-D28: the record's own attack speed (character.cpp:1326).
          speed: rec.speed || 1 };

        // MW-D16 / RULE 24's ARROW. A drawn bow with no round on it is
        // what the port has been drawing; the reference instances the
        // AMMUNITION SLOT's model under getArrowBone() at the
        // "shoot attach" key.
        const ammoType = ammoTypeFor(mwType);
        if (ammoType !== MW_WEAPON_TYPE.None && hasAmmo) {
          const ammoRec = pickWeaponRecord(allWeapons, ammoType);
          if (!ammoRec) {
            notes.push(`arrow: your archives carry no unenchanted Morrowind ammunition of type ${ammoType}`);
          } else {
            const ammoPath = `meshes/${ammoRec.model}`;
            const ammoArc = find(ammoPath);
            if (!ammoArc) notes.push(`arrow: ${ammoPath} (${ammoRec.id}) is not in your archives`);
            else {
              // getArrowBone's two branches. The ACTOR's own bone
              // first; failing that, a node named "ArrowBone" inside
              // the WEAPON's mesh - which brings the weapon's whole
              // transform chain, and its MIRROR, along with it.
              const skelBone = arrowAttachBone(mwType);
              const onActor = skelBone && skeletonHasBone(skeletonBytes, skelBone);
              let pre = null;
              let arrowBone = skelBone;
              if (!onActor) {
                pre = nodeTransformOf(parseNifOnce(weaponBytes), ARROW_FALLBACK_NODE);
                arrowBone = pre ? bone : null;
              }
              if (!arrowBone) {
                notes.push(`arrow: neither this skeleton's "${skelBone}" bone nor an `
                  + `"${ARROW_FALLBACK_NODE}" node in ${weaponInfo.model} - nowhere to put it`);
              } else {
                parts.push({
                  // MW-D34: `ammo` marks the one part attachArrow
                  // instances BARE - no BoneOffset of its own
                  // (weaponanimation.cpp:87-93, getInstance direct).
                  slot: 'arrow', bones: [arrowBone], bytes: ammoArc.get(ammoPath).slice(), preTransform: pre,
                  ammo: true,
                });
                arrowInfo = {
                  id: ammoRec.id, name: ammoRec.name, model: ammoRec.model, type: ammoType,
                  bone: arrowBone, viaWeaponMesh: !onActor,
                };
              }
            }
          }
        }
      }
    }
  } else if (weapon) {
    notes.push('weapon: Morrowind has no weapon type for what you are holding');
  }
  return { mwType, parts, weaponInfo, arrowInfo, notes };
}

/**
 * MW-D24: THE THIRD-PERSON BODY, built through the very same doors as
 * the arm - rule 6's other skeleton column (tpSkeletonPath), rules 1-3's
 * third-person BODY records (playerBodyRows), the one assembly seam
 * (assembleFirstPersonArm -> bindPartsInto), rule 8's weapon column on
 * THIS skeleton's own bones, and the third-person animation sources
 * (xbase_anim.kf first, npcanimation.cpp:529-533). Runs INSIDE the
 * arm's build while the archives are still open, because a second
 * multi-second walk for the same bytes is pure waste.
 *
 * A body that refuses does NOT refuse the arm: the player keeps first
 * person and the card names the reason the wheel cannot leave it.
 */
async function buildTpBody({
  race, female, beast, faceIndex, faceMatch, weapon, hasAmmo, worn, archives, parts, allWeapons, find, gen = null,
}) {
  const exists = (p) => archives.some((a) => a.has(p));
  const settingsSkeleton = tpSkeletonPath({ female, beast });
  const skeletonPath = correctActorModelPath(settingsSkeleton, exists);
  try {
    const skelArc = find(skeletonPath);
    if (!skelArc) return { ok: false, stage: 'skeleton', error: `${skeletonPath} is not in your archives` };
    const skeletonBytes = skelArc.get(skeletonPath).slice();

    const rows = playerBodyRows(parts, race, female, { beast, faceIndex, faceMatch });
    const missing = [];
    // MW-D29/D31: the worn verdicts arrive COMPOSED - one arbitration
    // in buildFpArm serves both rigs. shadowSkinRows applies the
    // shadows to the skin rows' bone lists so a right gauntlet hides
    // the right hand and leaves the left on the body. Never-traps:
    // every miss is a note and the skin stands.
    missing.push(...worn.notes);
    const skinRows = shadowSkinRows(
      rows.filter((r) => r.record).map((r) => ({ slot: r.slot, bones: PART_BONES[r.slot] ?? [], model: r.record.model })),
      worn.shadows);
    for (const row of rows) {
      if (!row.record) missing.push(`${row.slot}: no third-person record for this actor`);
    }
    const partBytes = [];
    for (const row of [...skinRows, ...worn.adds]) {
      const path = `meshes/${row.model}`;
      const arc = find(path);
      if (!arc) { missing.push(`${row.slot}: ${path} is not in your archives`); continue; }
      partBytes.push({ slot: row.slot, bones: row.bones, bytes: arc.get(path).slice() });
    }
    if (!partBytes.length) {
      return { ok: false, stage: 'parts', error: `no third-person body mesh resolved for race "${race}"`, notes: missing, rows };
    }
    // Rule 8 on THIS skeleton: the third-person rig carries its own
    // Weapon Bone (vanilla parents it under Bip01 R Hand), so the same
    // record hangs off the same column with no new law.
    const resolvedWeapon = resolveWeaponParts({ weapon, hasAmmo, allWeapons, find, skeletonBytes });
    partBytes.push(...resolvedWeapon.parts);

    const arm = await assembleFirstPersonArm({ skeletonBytes, parts: partBytes });
    if (!arm.ok) {
      return { ok: false, stage: arm.stage || 'assembly', error: arm.error, notes: [...missing, ...(arm.notes || [])], rows };
    }
    const textures = collectArmTextures(arm.pieces, archives, gen);

    const sourcePaths = tpAnimSources(skeletonPath, exists);
    if (!sourcePaths.length) {
      return {
        ok: false, stage: 'clip',
        error: `no third-person animation file - neither ${animSourceName(TP_BASE_MODEL)} `
          + `nor ${animSourceName(skeletonPath)} is in your archives`,
        notes: missing, rows,
      };
    }
    const sources = [];
    for (const p of sourcePaths) {
      const one = await cachedClipReport(gen, skeletonPath, p, () => find(p).get(p).slice(), arm.skeleton);
      if (!one.ok) return { ok: false, stage: 'clip', error: `${p}: ${one.error}`, notes: missing, rows };
      sources.push({
        name: p, keys: one.keys, groups: one.groups, groupSet: new Set(one.groups),
        trackMap: one.trackMap, binding: one.binding,
        wouldAccumRoot: accumRootRef(arm.skeleton, one.trackMap),
      });
    }
    const groupSet = new Set(sources.flatMap((so) => so.groups));
    const idleProbe = composeStanceGroup(FP_IDLE_BASE, animWeaponType(resolvedWeapon.mwType, true), (n) => groupSet.has(n));
    if (!idleProbe.group) {
      return { ok: false, stage: 'clip', error: `this .kf names no "${FP_IDLE_BASE}" group and no weapon-suffixed variant of one`, notes: missing, rows };
    }
    const idlePick = pickAnimSource(sources, idleProbe.group, resetClip, { loopFallback: true });
    if (!idlePick) {
      return { ok: false, stage: 'clip', error: `no source gives group "${idleProbe.group}" a start and a stop key`, notes: missing, rows };
    }
    const accumRoot = sources.reduce((acc, so) => (acc ?? so.wouldAccumRoot), null) ?? null;
    for (const so of sources) so.accumRoot = accumRoot;
    poseAssembly(arm, { tracks: idlePick.source.trackMap, sampleTrack, time: idlePick.state.startTime, accumRoot });

    return {
      ok: true,
      arm,
      tracks: idlePick.source.trackMap,
      accumRoot,
      keys: idlePick.source.keys,
      sources,
      sourcePaths,
      clip: idlePick.state,
      groups: [...groupSet].sort(),
      groupSet,
      mwType: resolvedWeapon.mwType,
      textures,
      skeletonPath,
      settingsSkeleton,
      weapon: resolvedWeapon.weaponInfo,
      arrow: resolvedWeapon.arrowInfo,
      rows,
      notes: [...missing, ...resolvedWeapon.notes, ...(arm.notes || [])],
      pieces: armPieceRows(arm.pieces).length,
      // MW-D24: the live weapon swap re-resolves against THIS skeleton's
      // bones, exactly as the arm's swap does against its own.
      skeletonBytes,
    };
  } catch (err) {
    return { ok: false, stage: 'build', error: err && err.message ? err.message : String(err) };
  }
}

export async function buildFpArm({
  race, female = false, beast = null, faceIndex = 0, weapon = null, hasAmmo = false, armor = null, deps = null,
} = {}) {
  const d = deps || await import('../scenes/dataSource.js');
  let settingsSkeleton = null;
  let skeletonPath = null;
  try {
    const archives = await d.loadMorrowindArchives();
    if (!archives.length) return { ok: false, stage: 'data', error: 'no Morrowind .bsa attached' };

    // EVERY .esm, not the first one.
    //
    // THE DEFECT THIS REPLACES, reported by Mac with three archives
    // attached: `.find()` took whichever .esm the store listed first. An
    // expansion carries no base-race BODY records, so if Tribunal.esm or
    // Bloodmoon.esm sorted ahead of Morrowind.esm every arm slot came
    // back "no record for this actor" and the card had nothing more to
    // say. loadMorrowindArchives (dataSource.js) already RANKS the .bsa
    // files by name for exactly this reason; the .esm door simply never
    // got the same treatment.
    //
    // Reading all of them is also what the engine does - later masters
    // add to and override earlier ones - so this is the load order
    // rather than a workaround for it.
    const esmNames = (await d.storedMorrowindNames()).filter((n) => /\.esm$/i.test(n));
    if (!esmNames.length) {
      return { ok: false, stage: 'data', error: 'no Morrowind .esm attached - the body records live there, not in the .bsa' };
    }
    const esmBytes = [];
    for (const n of esmNames) esmBytes.push({ name: n, bytes: await d.loadMorrowindFile(n) });
    // MW-D32 / IG2: the ESM WALK MEMO, hoisted above every record scan
    // so ALL of them ride it - the records do not change between two
    // rebuilds of the same data, only the pieces do. Keyed on the
    // store's generation stamp, so a re-attached archive is a fresh
    // walk and never a stale one. IG2 routed the race, GMST and weapon
    // scans through it too: with the body following the equip table,
    // every swap re-walked tens of megabytes of .esm five ways.
    // A test's deps carry no generation: gen stays NULL there and the
    // clip/texture memos stand down (the walk memo below keys on the
    // byte length too, so it is collision-safe either way). Only the
    // real store's monotonic stamp turns the swap caches on.
    const gen = typeof d.morrowindDataGeneration === 'function' ? d.morrowindDataGeneration() : null;
    const walk = (e, kind, fn) => {
      // No generation (a test's deps) = no memo: two fixtures of the
      // same name AND length but different bytes are an everyday test
      // arrangement, and the byteLength fingerprint cannot tell them
      // apart - the mSpeed pin proved it the day the weapon walk
      // joined this memo.
      if (gen === null) return fn(e.bytes);
      const key = `${gen}:${e.name}:${e.bytes.byteLength}:${kind}`;
      let hit = ESM_WALK_CACHE.get(key);
      if (hit === undefined) { hit = fn(e.bytes); ESM_WALK_CACHE.set(key, hit); }
      return hit;
    };
    const raceKey = String(race || '').toLowerCase();
    // AUDIT MW-A F1: BEAST COMES FROM THE DATA. The skeleton switch
    // and the tail row both read this flag, and no production caller
    // ever set it - an Argonian player built on the human skeleton
    // with the tail silently skipped. The RACE record's own RADT bit
    // decides now, last esm wins (load order); an explicit option
    // still overrides, which is what the fixtures use.
    if (beast === null) {
      beast = false;
      for (const e of esmBytes) {
        const rrec = walk(e, 'races', raceRecords).get(raceKey);
        if (rrec && rrec.radt) beast = rrec.beast;   // raceBeastFlag's own rule, off the memo
      }
    }
    // MW-D34: Npc::adjustScale (npc.cpp:1102-1136) - the race record's
    // RADT carries per-gender height and weight, and the rendered body
    // scales x,y by WEIGHT and z by HEIGHT (:1124-1135). The player's
    // own FIRST-person meshes take uniform HEIGHT only - "Race weight
    // should not affect 1st-person meshes, otherwise it will change
    // hand proportions and can break aiming" (:1112-1121); in this
    // port's FP composition (rule 54: camera and rig share one space)
    // a uniform scale of both cancels exactly, so the carve-out is the
    // no-op the reference's comment wants. Collision never scales
    // (:1104-1106) - the classic motor's collider is untouched. Last
    // .esm wins, the load order as everywhere else.
    let raceScale = { weight: 1, height: 1 };
    for (const e of esmBytes) {
      const rrec = walk(e, 'races', raceRecords).get(raceKey);
      if (rrec && rrec.radt) {
        raceScale = { weight: rrec.weight[female ? 1 : 0], height: rrec.height[female ? 1 : 0] };
      }
    }
    // MW-D14 / RULE 18: the settings name is not the final name. The
    // x-form is used only when its .kf is in the archive, which for a
    // male is never (the entry is already x-form, so the insert yields
    // "xx") and for a female or a beast is the whole question - and
    // the beast answer now exists, which is why the skeleton resolves
    // HERE and not before the data (AUDIT MW-A F1).
    settingsSkeleton = fpSkeletonPath({ female, beast });
    skeletonPath = correctActorModelPath(settingsSkeleton, (p) => archives.some((a) => a.has(p)));
    // bodyParts(), not loadMorrowindEsm(). The store's parseEsm door
    // returns mwEsmFile's body shape; armReport wants bodyParts' shape;
    // there is no adapter and writing one by guess inside this slice is
    // exactly how MW7 died. Raw bytes through the pinned path instead.
    const parts = esmBytes.flatMap((e) => walk(e, 'parts', bodyParts));
    // MW-D29: the ARMO records ride the same esm walk, load order and
    // all - the composer resolves DF pieces against them by token.
    const armors = esmBytes.flatMap((e) => walk(e, 'armors', armorRecords));
    const clothes = esmBytes.flatMap((e) => walk(e, 'clothes', clothingRecords));
    // RULE 32(a)'s GMST, read from the player's own data. Later masters
    // override earlier ones, so the LAST .esm that carries it wins -
    // which is the load order, not a preference.
    let sneakDelta = null;
    for (const e of esmBytes) {
      const g = walk(e, 'gmst-sneak', (b) => ({ v: gmstValue(b, GMST_SNEAK_DELTA) }));
      if (typeof g.v === 'number') sneakDelta = g.v;
    }

    const find = (p) => archives.find((a) => a.has(p));
    const skelArc = find(skeletonPath);
    if (!skelArc) return { ok: false, stage: 'skeleton', error: `${skeletonPath} is not in your archives` };
    const skeletonBytes = skelArc.get(skeletonPath).slice();

    // MW-D31: ONE COMPOSITION for both rigs. The worn arbitration runs
    // here, once, and the third person receives the verdicts instead
    // of re-arguing them - one seam, one law, two views.
    // MW-D37: the garments' measured colours, so the dye can choose -
    // lazily, one candidate at a time (AUDIT 34 F1).
    const colourOf = (c) => clothingColourOf(c, parts, archives, gen);
    const worn = composeWornArmor({ pieces: armor ?? [], armors: armors ?? [], clothes: clothes ?? [], bodyPool: parts, female, colourOf });
    // MW-D35: THE FACE, MATCHED to the classic portrait on this data.
    // Null halves fall back to the walk inside playerBodyRows.
    // AUDIT 32 F2: memoised per identity per data generation - a
    // rebuild happens on every equip change now (D32), and the face
    // does not change when a gauntlet does; without this, every worn
    // swap re-parsed a dozen meshes and decoded a dozen textures.
    let faceMatch;
    if (!d.fetchArena2Bytes) {
      faceMatch = { head: null, hair: null, reasons: ['no Daggerfall data door - the walk stands'] };
    } else {
      const fkey = `${gen}:${race}:${female ? 'f' : 'm'}:${faceIndex | 0}`;
      faceMatch = FACE_MATCH_CACHE.get(fkey);
      if (!faceMatch) {
        faceMatch = await matchFaceFor({ race, female, faceIndex, parts, archives, deps: d });
        // AUDIT 32 F3: a MISS is not memoised. The enhanced door opens
        // before ARENA2 is picked, so the first build of a session can
        // find no portrait archive at all; caching that verdict would
        // have pinned "the walk stands" onto every rebuild of the
        // session even after the data arrived.
        if (faceMatch.head || faceMatch.hair) FACE_MATCH_CACHE.set(fkey, faceMatch);
      }
    }

    const rows = armReport(parts, race, female);
    const wanted = armMeshPaths(rows);
    // MW-D32: updateParts sweeps EVERY slot in first person too
    // (npcanimation.cpp:682, PRT_Neck..PRT_Count with
    // getBodyParts(firstPerson=true)) - non-hand slots take .1st
    // records only (:1258), which retail does not carry, so on vanilla
    // data this adds nothing; a mod's .1st neck now appears exactly as
    // the reference shows it. A missing non-arm slot is NOT noted -
    // the reference leaves those null silently.
    const fpAll = resolveBodyParts(parts, race, female, { firstPerson: true });
    for (const [slot, rec] of fpAll) {
      if (ARM_PARTS.includes(slot)) continue;
      if (rec && rec.model) wanted.push({ slot, record: rec.id, firstPerson: true, path: `meshes/${rec.model}` });
    }
    const partBytes = [];
    const missing = [];
    // The fp skin wears the same shadows: a right gauntlet hides the
    // right 1st-person hand exactly as it hides the right skin hand on
    // the body.
    const fpRows = shadowSkinRows(
      wanted.filter((w) => w.path).map((w) => ({ slot: w.slot, bones: PART_BONES[w.slot] ?? [], path: w.path })),
      worn.shadows);
    for (const w of wanted) {
      if (!w.path) { missing.push(`${w.slot}: no record for this actor`); continue; }
    }
    for (const w of fpRows) {
      const arc = find(w.path);
      if (!arc) { missing.push(`${w.slot}: ${w.path} is not in your archives`); continue; }
      partBytes.push({ slot: w.slot, bones: w.bones, bytes: arc.get(w.path).slice() });
    }
    // And the fp camera sees what the reference shows it: gauntlets,
    // sleeves, the shield - fpWornAdds' filter - never a helmet in
    // your face.
    missing.push(...worn.notes);
    for (const add of fpWornAdds(worn.adds)) {
      const path = `meshes/${add.model}`;
      const arc = find(path);
      if (!arc) { missing.push(`${add.slot}: ${path} is not in your archives`); continue; }
      partBytes.push({ slot: add.slot, bones: add.bones, bytes: arc.get(path).slice() });
    }
    // MW-D9: THE WEAPON - resolveWeaponParts above, the one home MW-D19
    // gave it so a live weapon swap resolves through the very same door
    // as the build.
    const allWeapons = esmBytes.flatMap((e) => walk(e, 'weapons', weaponRecords));
    const resolvedWeapon = resolveWeaponParts({ weapon, hasAmmo, allWeapons, find, skeletonBytes });
    partBytes.push(...resolvedWeapon.parts);
    const weaponNotes = resolvedWeapon.notes;
    const weaponInfo = resolvedWeapon.weaponInfo;
    const arrowInfo = resolvedWeapon.arrowInfo;
    const mwType = resolvedWeapon.mwType;

    // MW-D14: the SOURCE LIST, in push order, existence-filtered exactly
    // as addSingleAnimSource filters it.
    const sourcePaths = fpAnimSources(skeletonPath, (p) => archives.some((a) => a.has(p)));
    const sourceBytes = sourcePaths.map((p) => ({ name: p, bytes: find(p).get(p).slice() }));

    if (!partBytes.length) {
      // "no record for this actor" is a dead end for whoever reads it.
      // MW-D4's pattern: report the MEASUREMENT - what was asked for, and
      // what the data actually offers - so the next step is obvious
      // instead of a guess.
      return {
        ok: false,
        stage: 'parts',
        error: `no arm mesh resolved for race "${race}"`,
        notes: missing,
        rows: wanted,
        esm: esmDiagnosis(esmNames, parts, race),
      };
    }
    const arm = await assembleFirstPersonArm({ skeletonBytes, parts: partBytes });
    // MW-D11: the textures the assembled pieces NAME, resolved through
    // rule 36's path law and decoded now - while the archives are still
    // open. The release moved below this for that reason: which textures
    // a mesh wants is not knowable until the mesh is parsed, and parsing
    // twice to keep the release where it was would cost seconds.
    const textures = arm.ok ? collectArmTextures(arm.pieces, archives, gen) : new Map();
    // MW-D38: THE CATALOG the item icons resolve against - the same
    // archives and records this build used, kept on the result so an
    // icon never re-walks an esm.
    const catalog = { archives, parts, armors, clothes, weapons: allWeapons, gen };
    // MW-D24: the THIRD-PERSON BODY, while the same archives are open.
    // Its refusal is a note on the card, never the arm's refusal.
    const third = arm.ok
      ? await buildTpBody({ race, female, beast, faceIndex, faceMatch, weapon, hasAmmo, worn, archives, parts, allWeapons, find, gen })
      : null;
    // IG2: the mapped archives are NO LONGER truncated here - they are
    // dataSource's generation-keyed cache now (the same array every
    // build gets), and emptying it made the NEXT swap re-read and
    // re-index every .bsa blob, which is exactly the seconds Mac felt.
    // Residency is the stated cost of instant swaps; an attach drops it.
    if (!arm.ok) {
      return { ok: false, stage: arm.stage || 'assembly', error: arm.error, notes: [...missing, ...(arm.notes || [])], rows: wanted };
    }
    // MW-D12: the report is asked for the BASE idle, and its `clip` is
    // not what drives the arm any more. Rule 9 composes the real group
    // from the drawn weapon's short suffix, and the drawn weapon changes
    // while the game runs - so the group is resolved LIVE, below, and
    // what the build needs from here is the key list and the group list.
    if (!sourceBytes.length) {
      return {
        ok: false, stage: 'clip',
        error: `no first-person animation file - neither ${animSourceName(FP_BASE_MODEL)} `
          + `nor ${animSourceName(skeletonPath)} is in your archives`,
        notes: [...missing, ...(arm.notes || [])], rows: wanted,
      };
    }
    const sources = [];
    for (const sb of sourceBytes) {
      const one = await cachedClipReport(gen, skeletonPath, sb.name, () => sb.bytes, arm.skeleton);
      if (!one.ok) {
        return {
          ok: false, stage: 'clip', error: `${sb.name}: ${one.error}`,
          notes: [...missing, ...(arm.notes || [])], rows: wanted,
        };
      }
      sources.push({
        name: sb.name, keys: one.keys, groups: one.groups, groupSet: new Set(one.groups),
        trackMap: one.trackMap, binding: one.binding,
        // What THIS source would choose. The Animation's actual accum
        // root is picked below, and it is not per-source.
        wouldAccumRoot: accumRootRef(arm.skeleton, one.trackMap),
      });
    }
    // hasAnimation: ANY source. The reverse search below picks WHICH.
    const groupSet = new Set(sources.flatMap((so) => so.groups));
    const clip = sources[sources.length - 1];
    // THE REFUSAL MOVES WITH THE RULE. MW-D8 refused when "Idle" did not
    // reset; that group need not exist at all in a first-person .kf that
    // only carries idle1h and friends. What must exist is SOME idle this
    // actor's stance can reach, and composeStanceGroup is the reference's
    // own ladder for finding it - asked group, short-group fallback, bare
    // base. Nothing below that: the reverted arc's "any idle in the file"
    // tail is what let it draw a plausible wrong animation.
    const idleProbe = composeStanceGroup(FP_IDLE_BASE, animWeaponType(mwType, true), (n) => groupSet.has(n));
    if (!idleProbe.group) {
      return {
        ok: false, stage: 'clip',
        error: `this .kf names no "${FP_IDLE_BASE}" group and no weapon-suffixed variant of one`,
        notes: [...missing, ...(arm.notes || [])], rows: wanted,
      };
    }
    const idlePick = pickAnimSource(sources, idleProbe.group, resetClip, { loopFallback: true });
    if (!idlePick) {
      return {
        ok: false, stage: 'clip',
        error: `no source gives group "${idleProbe.group}" a start and a stop key`,
        notes: [...missing, ...(arm.notes || [])], rows: wanted,
      };
    }
    const idleCheck = idlePick.state;
    const tracks = idlePick.source.trackMap;
    // RULE 56's STICKINESS. `if (!mAccumRoot)` guards the whole block in
    // addAnimSource, so the accum root is chosen by the FIRST source
    // that resolves one - in PUSH order - and later sources do not
    // re-pick it. It is ONE value for the whole rig, not one per clip:
    // a per-source accum root would move the extraction bone when the
    // player swung, which is a rig that walks away mid-blow.
    const accumRoot = sources.reduce((acc, so) => (acc ?? so.wouldAccumRoot), null) ?? null;
    for (const so of sources) so.accumRoot = accumRoot;
    const poseAt = (t) => poseAssembly(arm, { tracks, sampleTrack, time: t, accumRoot });
    const c = idleCheck;
    const times = Array.from({ length: 25 }, (_, i) => c.startTime + ((c.stopTime - c.startTime) * i) / 24);
    const union = clipUnionBounds(arm, poseAt, times);
    poseAt(c.startTime);

    // RULE 54. No third fallback, and no invented camera: a rig with
    // neither node has no first-person view, and saying so is the whole
    // difference between this and the mapper it replaces.
    const cameraRef = firstPersonCameraRef(arm.skeleton);
    if (cameraRef < 0) {
      return {
        ok: false,
        stage: 'camera',
        error: 'this skeleton has no "Camera" bone and no "Head" bone - '
          + 'rule 54 has nothing to track',
        notes: [...missing, ...(arm.notes || [])],
        rows: wanted,
      };
    }
    const reach = armReach(firstPersonEye(arm.mats, cameraRef), union);
    if (weaponInfo) weaponInfo.side = weaponRestSide(arm, weaponInfo.bone);
    if (arrowInfo) arrowInfo.side = weaponRestSide(arm, arrowInfo.bone);

    return {
      ok: true,
      arm,
      tracks,
      accumRoot,
      keys: idlePick.source.keys,
      // MW-D33: THE WORN VERDICTS, ON THE CARD. Mac's report - clothing
      // and armor not showing - arrived with nothing on screen saying
      // WHY, which is the reverted rig's defining failure wearing new
      // clothes. Every piece the equip table handed over, and what
      // became of it: the record it resolved to and the parts it
      // dressed, or the reason it kept its sprite.
      worn: wornVerdicts(armor ?? [], worn),
      face: faceMatch,
      catalog,
      // MW-D14: every source, in PUSH order, each with its own keys AND
      // its own tracks - because the source that wins a group is the one
      // whose tracks must pose it.
      sources,
      sourcePaths,
      clip: c,
      // MW-D12: the file's own answer to "does this animation exist",
      // which rules 9 and 10 both consult. A Set, because
      // composeStanceGroup calls it up to three times per stance change
      // and composeWeaponGroup twice more.
      groups: [...groupSet].sort(),
      groupSet,
      // The Morrowind weapon type this arm was built holding. Rule 8's
      // ANIMATION type is derived from it live (animWeaponType), because
      // sheathing changes the answer without rebuilding anything.
      mwType,
      textures,
      cameraRef,
      reach,
      skeletonPath,
      settingsSkeleton,
      sneakDelta,
      // MW-D4's PATTERN, applied forward: report the bone the NEXT slice
      // needs rather than guessing it. Rule 54 says the first-person
      // camera tracks a node named "Camera", falling back to "Head". This
      // slice does not implement that - it uses the port mapper above -
      // but it says whether the data would support it, so MW-D9 starts
      // from a measurement. A missing bone is REPORTED, never worked
      // around.
      cameraBone: arm.skeleton.byName.has('camera') ? 'Camera'
        : arm.skeleton.byName.has('head') ? 'Head (rule 54 fallback)' : null,
      rows: wanted,
      weapon: weaponInfo,
      arrow: arrowInfo,
      // MW-D19: what a live weapon swap needs without re-walking the
      // .esm - the parsed WEAP records and the skeleton bytes the arrow
      // branch tests bones against. The archives are NOT retained (they
      // are the memory cost); setWeapon reopens them for one fetch.
      allWeapons,
      skeletonBytes,
      esm: esmDiagnosis(esmNames, parts, race),
      notes: [...missing, ...weaponNotes, ...(arm.notes || [])],
      binding: idlePick.source.binding,
      pieces: armPieceRows(arm.pieces).length,
      // MW-D34: adjustScale's factors for the drawn body and the
      // camera's focal height.
      raceScale,
      // MW-D24: the third-person body, or its named refusal.
      third,
    };
  } catch (err) {
    return { ok: false, stage: 'build', error: err && err.message ? err.message : String(err) };
  }
}

/**
 * MW-D11: RESOLVE AND DECODE EVERY TEXTURE THE ARM NAMES.
 *
 * One entry per distinct textureFile, because a Morrowind arm's four
 * pieces routinely share two textures and decoding a DDS twice is pure
 * waste. The path goes through correctTexturePath - the reference's four
 * probes over a re-rooted, .tga->.dds-swapped name - and a MISS is not a
 * refusal: it becomes the 8x8 magenta warning image, exactly as
 * ImageManager does, so a texture the archives do not carry SAYS SO on
 * the arm instead of quietly leaving it flat.
 */
export function collectArmTextures(pieces, archives, gen = null) {
  const out = new Map();
  const exists = (p) => archives.some((a) => a.has(p));
  for (const piece of pieces ?? []) {
    const file = piece.material && piece.material.textureFile;
    if (!file || out.has(file)) continue;
    // IG2: one decode per texture per data generation - the entry is
    // read-only downstream (mips feed createCharacterTexture), so the
    // memo is safe to share across rebuilds.
    if (gen !== null) {
      const memo = TEXTURE_CACHE.get(`${gen}:${file}`);
      if (memo) { out.set(file, memo); continue; }
    }
    const path = correctTexturePath(file, exists);
    const arc = archives.find((a) => a.has(path));
    if (!arc) {
      const entry = { ok: false, path, error: 'not in your archives', image: warningImage() };
      out.set(file, entry);
      if (gen !== null) TEXTURE_CACHE.set(`${gen}:${file}`, entry);
      continue;
    }
    try {
      // MW-D34: decode BY EXTENSION (imagemanager.cpp:104-118) - the
      // ladder legitimately answers the AUTHORED .tga/.bmp when the
      // .dds probe misses (resourcehelpers.cpp:112-114), and feeding
      // that to decodeDds turned a texture the archives DO carry into
      // the magenta warning.
      const entry = { ok: true, path, image: decodeTextureImage(path, arc.get(path).slice()) };
      out.set(file, entry);
      if (gen !== null) TEXTURE_CACHE.set(`${gen}:${file}`, entry);
    } catch (err) {
      const entry = { ok: false, path, error: err.message, image: warningImage() };
      out.set(file, entry);
      if (gen !== null) TEXTURE_CACHE.set(`${gen}:${file}`, entry);
    }
  }
  return out;
}

/** What the .esm layer actually saw, so a refusal names its own cause.
 *  A slot with no record is not information; the race that was asked
 *  for, beside the races the files carry, is. */
export function esmDiagnosis(names, parts, race) {
  const races = [...new Set((parts ?? []).filter((p) => p.skin && p.playable).map((p) => p.race))].sort();
  return {
    files: names,
    bodyRecords: (parts ?? []).length,
    firstPerson: (parts ?? []).filter((p) => p.firstPerson).length,
    raceWanted: race,
    racesFound: races,
    raceIsThere: races.includes(String(race || '').toLowerCase()),
  };
}

/**
 * IG4/IG5 (2026-08-31, Mac). A DECLARED DIVERGENCE, and it is the
 * OWNER'S. The reference DESIGNS the arms to trail the look -
 * rotateFactor is 0.75 at rest (npcanimation.cpp:719), so a quarter of
 * every glance moves the arms AGAINST it, and the first-person offset
 * hits the lens twice against the neck's once (camera.cpp:149-157), so
 * the sneak sink and the head bob slide them against the view too. The
 * port measured itself AT that law (the probe read the lag at 0.26 of
 * the look against the reference's 0.25) and Mac rejected the design
 * itself. IG5 tried a tilt (an under-rotated draw lens) whose direction
 * came out INVERTED on the played screen, and Mac closed the question
 * (IG6): "just make it where it follows the screen. Just like classic
 * daggerfall." So the shipped mode is the pure glue - aim 1 in the pose
 * (the reference's own aiming value, npcanimation.cpp:714-718), the
 * offset zeroed at both applications, the lens taking the whole look -
 * whose image is INVARIANT under pitch: the arms are fixed to the
 * screen exactly as the classic sprite is. The Morrowind feel stays one
 * toggle away (the pause card), and the probe's law layers measure it
 * with the flag OFF.
 */
// KEY BUMPED (IG6b): the v1 key ('dagger.mwArmsFollowCamera') can hold
// an ACCIDENTAL off - the toggle's first label named the mode you were
// IN ("Arms: follow the camera"), which reads as "click to enable", and
// one natural click switched the clicker to Morrowind look-lag and
// PERSISTED it. That stored off then overrode every later default and
// made the fixes look unshipped on the owner's own machine. The bump
// abandons the old value so every player lands back on the fixed
// default; the action-named button re-persists a deliberate choice
// under the new key.
const FOLLOW_CAMERA_KEY = 'dagger.mwArmsFollowCamera2';
// DA1: through the storage seam, not localStorage directly - the pin
// in test/filestorage.test.js caught this landing bare on the merge,
// which would have split the toggle out of the desktop app's file
// store (the seam's whole reason). First firing of that pin, one
// merge after it was written.
function readFollowCamera() {
  try { return (appStorage()?.getItem(FOLLOW_CAMERA_KEY) ?? 'true') !== 'false'; }
  catch { return true; }
}

/**
 * THE LIVE ARM. One per game, module-level, because there is one player.
 *
 * active() is the whole safety story and every term earns its place: an
 * unbuilt arm, a missing GPU mesh, a host that forgot the camera dep, or
 * a clip that refused all answer FALSE, and weaponRig's branch then
 * falls straight through to the classic sprite. MWFIX2's failure was an
 * active() that stayed true when the group lookup returned null, so the
 * player got a frozen bind-pose arm where the sprite had been correct. A
 * frozen arm is not a reachable state here; the sprite is.
 */
export function createFpArm() {
  let renderer = null;
  let camera = null;
  let built = null;
  const listeners = new Set();   // MW-D36
  let pendingWorn = null;        // PX25: the worn table that arrived mid-build
  let mesh = null;
  let packed = null;
  let reason = 'not built';
  let frames = 0;
  let busy = false;
  // MW-D19: the equip identity this arm currently wears, and the deps
  // seam it was built through - the swap resolves through the same one.
  let wornKey = null;
  let buildDeps = null;
  // MW-D32: what the body last dressed in, and the opts to dress it
  // again. The equip table is read every frame by weaponRig; when the
  // worn list changes the rig rebuilds through the same door the card
  // pressed, with the new pieces - the body FOLLOWS THE EQUIP TABLE,
  // not the last time someone pressed Build.
  let wornEquipKey = null;
  let lastBuildOpts = null;

  // MW-D12: TWO CLIP SLOTS, because Morrowind's first-person arm plays
  // TWO animations and the port had one.
  //
  // The reference keeps mCurrentIdle and mCurrentWeapon as separate
  // AnimStates on separate priorities and lets rule 26 resolve them per
  // bone group. In first person the weapon group is played on
  // BlendMask_All at priorityWeapon, and the idle at a lower priority on
  // the same mask, so the resolution is not a blend at all: WHILE A
  // WEAPON ANIMATION IS PLAYING IT WINS EVERY BONE. That is why this can
  // be two slots and a winner rather than the whole priority vector -
  // and it is stated here so that when a third animation arrives
  // (hit recoil, sneak) somebody ports rule 26 instead of adding a third
  // `if`.
  let idleState = null;
  let actionState = null;
  let idleGroup = null;
  let weaponGroup = null;
  // MW-D26: THE THIRD SLOT - MOVEMENT. The reference plays movement at
  // Priority_Movement, above the idle and below the weapon action, and
  // in first person everything rides BlendMask_All - so the two-slot
  // winner grows to three: action beats movement beats idle. The
  // per-bone-group blend (a swing on the torso OVER a walk on the legs,
  // rule 26's real vector) is NOT this - recorded in the bible as the
  // known gap, so nobody mistakes the ladder for the vector.
  let movementState = null;
  let movementGroup = null;
  let movementSource = null;
  let movementBase = null;
  let movementStance = null;
  let movementRate = 1;
  // MW-D39: THE FOURTH SLOT - JUMP. Priority_Jump sits BELOW
  // Priority_Movement in the reference's enum (character.hpp:34-35),
  // so the winner ladder reads action > movement > JUMP > idle - and
  // the jump still SHOWS in the air because the movestate ladder only
  // runs inside `if (!mInJump)` (character.cpp:2296): airborne, the
  // movement slot empties and the jump is the highest thing playing.
  // On the landing frame movement selects again, so a player who lands
  // holding W walks over the landing tail - the reference's own look.
  let jumpState = null;
  let jumpGroup = null;
  let jumpSource = null;
  let jumpStance = null;
  let jumpKind = null;          // mJumpState: null | 'inair' | 'landing'
  // character.cpp:2355-2366 - the turn animation HOLDS 0.05s past the
  // last actual rotation, so mouse jitter does not flicker it.
  let lastYaw = null;
  let turnHold = 0;
  let turnDir = 0;
  let upper = UPPER_BODY.None;
  let spellReady = false;        // MW-D39: a spell is readied (the stance)
  let attackType = null;
  let attackStrength = 1;
  let sheathed = true;
  let weaponShown = false;
  // MW-D16: the held round. FALSE at build, because the reference does
  // not attach one until a "shoot attach" key fires - a freshly drawn bow
  // is empty until you start to draw it, and only the CROSSBOW reloads
  // itself at the end of a section.
  let arrowShown = false;
  let holdWindUp = false;
  let resetIdleOnAttackEnd = false;
  // mAimingFactor (npcanimation.cpp:712-719). It is STATE, not a
  // per-frame function: it snaps to 1 while aiming and ramps back down
  // at 0.5 a second, so it has to survive between frames.
  let aimFactor = 0;
  // IG4: follow-camera mode, the shipped default - see the module head
  // above createFpArm. Persisted so Mac's choice survives a reload.
  let followCam = readFollowCamera();
  // IG1: THE FIRST-PERSON OFFSET - the reference's ONE channel for
  // everything that moves the FP view against the arms. The sneak sink
  // feeds it (Camera::setSneakOffset -> (0,0,-delta), camera.cpp:312)
  // and so does the HEAD BOB (head_bobbing.lua:57 adds its zOffset to
  // the same setFirstPersonOffset vector). The neck takes the offset
  // ONCE (npcanimation.cpp:723) and the LENS adds it AGAIN on top of
  // the tracked camera bone (calculateFirstPersonPosition,
  // camera.cpp:149-157) - two applications against the arms' one,
  // which is exactly why you SEE your arms sink when you sneak and bob
  // when you walk. MW object-root space, MW units.
  let fpOffset = [0, 0, 0];
  // Rule 32(a): the Sneak STANCE, read off the camera dep beside the
  // pitch. It is DFU's Sneak binding and not its Crouch one - Morrowind
  // has one sneak stance, and Daggerfall's crouch is a height change the
  // collider owns rather than an animation state. A step change with no
  // smoothing, because the reference has none and adding one would be a
  // port decision wearing a rule's clothes.
  let sneaking = false;
  // The source each slot won, kept beside the clip because a clip and
  // the tracks that pose it come from the SAME file.
  let idleSource = null;
  let actionSource = null;
  const notes = [];

  // MW-D24: TWO RIGS, ONE MACHINE. The reference's CharacterController
  // never knows which view it is driving - setViewMode rebuilds the
  // NpcAnimation with the other skeleton and part set
  // (npcanimation.cpp:295-317) and the controller re-derives its state
  // on it (forceStateUpdate -> refreshCurrentAnims(force),
  // character.cpp:2798). Here both rigs are built up front (one archive
  // walk) and the machine's clip resolution reads THE ACTIVE one:
  // groups, sources and keys all come from rig(), so "idle1h" resolves
  // in xbase_anim.1st.kf in first person and xbase_anim.kf in third,
  // with one state machine between them - MW7 died of two copies.
  let viewMode = 'first';
  let thirdBuilt = null;
  let thirdMesh = null;
  let thirdPacked = null;
  const rig = () => (viewMode === 'third' && thirdBuilt && thirdBuilt.ok ? thirdBuilt : built);

  const active = () => !!(built && built.ok && mesh && renderer && camera && (actionState || movementState || jumpState || idleState)
    && viewMode === 'first');
  const thirdActive = () => !!(built && built.ok && thirdBuilt && thirdBuilt.ok && thirdMesh
    && renderer && (actionState || movementState || jumpState || idleState) && viewMode === 'third');

  /**
   * MW-D9f: THE UPDATE PREDICATE, WHICH IS NOT THE DRAW PREDICATE.
   *
   * active() is about DRAWING, and it requires a GPU mesh - correctly,
   * because drawing without one is the frozen-arm failure MWFIX2 shipped.
   * But the mesh is created BY update(), on its first run. Gate the
   * update on active() and the two deadlock: no mesh, so not active; not
   * active, so never updated; never updated, so no mesh. A built arm sat
   * at frames 0 forever and the classic sprite drew instead.
   *
   * Nothing could see it. The node pins drive update() directly and the
   * browser probe drives its own loop, so both skipped the one gate that
   * mattered - the seam, not the engine. THE MEASUREMENT HAS TO RUN THE
   * CALLER'S CONDITION, not a condition that reaches the same code.
   *
   * These are exactly update()'s own requirements: a camera is a DRAW
   * term, and posing without one is harmless work, not a wrong picture.
   */
  const ready = () => !!(built && built.ok && (actionState || movementState || jumpState || idleState) && renderer);

  function releaseGpu(m) {
    if (m && renderer && renderer.gl) {
      const gl = renderer.gl;
      gl.deleteVertexArray(m.vao);
      for (const b of m.buffers || []) gl.deleteBuffer(b);
      // MW-D11: the textures go with the mesh that owns them. An arm
      // rebuilt on every attach would otherwise leak one upload per
      // piece per build, which is the shape of NT1's teardown leaks.
      for (const r of m.ranges || []) if (r.tex) gl.deleteTexture(r.tex);
    }
  }
  function releaseMesh() { releaseGpu(mesh); mesh = null; }

  /** MW-D38: one ground mesh, textured, rendered to an icon-sized image. */
  function renderGroundMesh(nifBytes, archives, gen, size) {
    let batches;
    try { batches = flattenNif(parseNif(nifBytes)); } catch { return null; }
    const pieces = batches.filter((b) => b.positions && b.indices).map((b) => ({ ...b, slot: 'item', mirrored: false }));
    if (!pieces.length) return null;
    // the pass frame: NIF Z-up tipped to Y-up, in metres
    const u = 1 / MW_UNITS_PER_METER;
    const model = multiply(trs(0, 0, 0, 0, 0, 0, u, u, u), NIF_TO_PASS);
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of pieces) {
      for (let i = 0; i < p.positions.length; i += 3) {
        const q = transformPoint(model, p.positions[i], p.positions[i + 1], p.positions[i + 2]);
        if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0];
        if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
        if (q[2] < minZ) minZ = q[2]; if (q[2] > maxZ) maxZ = q[2];
      }
    }
    if (!(maxX > minX)) return null;
    const packed = packFpArm(pieces);
    const mesh = renderer.createCharacterMesh(packed.packed, { uv: true });
    mesh.ranges = packed.ranges;
    const textures = collectArmTextures(pieces, archives, gen);
    for (const r of mesh.ranges) {
      if (!r.textureFile) continue;
      const entry = textures.get(r.textureFile);
      if (!entry) continue;
      const clampMode = r.piece.material ? r.piece.material.clampMode : 3;
      r.tex = renderer.createCharacterTexture(entry.image.mips, wrapModes(clampMode));
      r.alphaCut = r.piece.material && r.piece.material.alphaTest ? (r.piece.material.alphaThreshold || 0) / 255 : 0;
    }
    const { view, proj } = iconFrame({ minX, minY, minZ, maxX, maxY, maxZ });
    const px = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(8, size | 0));
    let img = null;
    try { img = renderer.renderCharacterSpriteImage(mesh, model, proj, view, px, px); }
    finally { releaseGpu(mesh); }
    return img;
  }
  function releaseThirdMesh() { releaseGpu(thirdMesh); thirdMesh = null; }
  /** Pack the posed third-person pieces and put them on the GPU - the
   *  ONE upload both the wheel (update) and the inventory figure use.
   *  AUDIT 33 F1: the figure used to gate on thirdActive(), which
   *  demands viewMode === 'third' and a mesh the wheel had uploaded -
   *  so in first person, the default, the inventory showed the classic
   *  doll and the model never appeared. The body's pieces are posed at
   *  build regardless of view; only the upload was view-gated. */
  function uploadThirdMesh(t) {
    thirdPacked = packFpArm(t.arm.pieces, thirdPacked);
    if (!thirdMesh) {
      thirdMesh = renderer.createCharacterMesh(thirdPacked.packed, { uv: true });
      thirdMesh.ranges = thirdPacked.ranges;
      for (const r of thirdMesh.ranges) {
        if (!r.textureFile) continue;
        const entry = t.textures.get(r.textureFile);
        if (!entry) continue;
        const clampMode = r.piece.material ? r.piece.material.clampMode : 3;
        r.tex = renderer.createCharacterTexture(entry.image.mips, wrapModes(clampMode));
        r.alphaCut = r.piece.material && r.piece.material.alphaTest
          ? (r.piece.material.alphaThreshold || 0) / 255 : 0;
      }
    } else {
      renderer.updateCharacterMesh(thirdMesh, thirdPacked.packed);
    }
    return thirdMesh;
  }

  // hasAnimation: ANY source names the group (animation.cpp). WHICH
  // source plays it is a separate question, answered in reverse below.
  const hasGroup = (n) => { const r = rig(); return !!r && !!r.sources && anySourceHasGroup(r.sources, n); };

  /** The source currently posing the arm - the one that won the clip
   *  being drawn, because its tracks are the ones the pose reads. */
  let poseSource = null;

  /** The file's time for a key of the CURRENT weapon group, as
   *  getTextKeyTime is always called (character.cpp:1241): the group, a
   *  colon-space, and the action. -1 when the file has no such key. */
  // MW-D29: getTextKeyTime asks EVERY source in reverse
  // (animation.cpp:840-854), not the one the idle was picked from.
  const keyTime = (action) => (weaponGroup && rig()
    ? sourcesKeyTime(rig().sources, `${weaponGroup}: ${action}`) : -1);

  /** Play a section of the weapon group. Returns FALSE and leaves the
   *  slot empty when the file has no such window - it never substitutes
   *  a different one, because a substituted attack animation is the
   *  reverted arc's whole failure mode in miniature. */
  function playAction(start, stop, startPoint = 0) {
    if (!rig() || !weaponGroup) return false;
    const pick = pickAnimSource(rig().sources, weaponGroup, resetClip, { start, stop, startPoint });
    if (!pick) {
      actionState = null;
      notes.push(`${weaponGroup}: no source has "${weaponGroup}: ${start}" and "${weaponGroup}: ${stop}"`);
      return false;
    }
    actionState = pick.state;
    actionSource = pick.source;
    return true;
  }

  /**
   * REFRESHIDLEANIMS, the first-person half (character.cpp:773-830).
   *
   * Called EVERY FRAME, exactly as the reference calls it, and its early
   * return is what keeps that cheap: the same group still playing is left
   * alone. What it is NOT is a one-shot at build time - the group depends
   * on the drawn weapon, so sheathing has to be able to change it without
   * anything else being torn down.
   */
  function refreshIdle(force = false) {
    if (!built || !built.ok) return;
    const type = animWeaponType(built.mwType, sheathed, spellReady);
    if (!force && idleState && idleState.playing) {
      // Only the GROUP can have gone stale; a playing idle of the right
      // group is left exactly where it is.
      const composed = composeStanceGroup(FP_IDLE_BASE, type, hasGroup);
      if (composed.group === idleGroup) return;
    }
    const composed = composeStanceGroup(FP_IDLE_BASE, type, hasGroup);
    if (!composed.group) { idleState = null; idleGroup = null; return; }
    // Rule 10's condition: the dice roll happens only when the stance HAS
    // a short group. Bare hands away idle forever.
    const short = weaponShortGroup(type);
    const loopCount = short ? FP_IDLE_LOOPS() : Infinity;
    // :822-825 - a restart of the SAME group resumes from where it was.
    const startPoint = idleGroup === composed.group ? clipCompletion(idleState) : 0;
    const pick = pickAnimSource(rig().sources, composed.group, resetClip,
      { loopFallback: true, loopCount, startPoint });
    if (!pick) {
      idleState = null; idleGroup = null;
      notes.push(`idle: no source gives "${composed.group}" a start and a stop key`);
      return;
    }
    idleGroup = composed.group;
    idleState = pick.state;
    idleSource = pick.source;
  }

  /** resetCurrentIdleState (:1850-1853 via mResetIdleOnAttackEnd): drop
   *  the idle so the next refresh replays it from its start with a fresh
   *  loop count, rather than resuming mid-swing-shaped. */
  function resetIdle() { idleState = null; idleGroup = null; refreshIdle(true); }

  function resetMovement() {
    movementState = null; movementGroup = null; movementSource = null; movementBase = null;
    movementStance = null;
  }

  /** resetCurrentJumpState (character.cpp:350-354). */
  function resetJump() {
    jumpState = null; jumpGroup = null; jumpSource = null; jumpStance = null;
    jumpKind = null;
  }

  /** The velocity the clip itself travels at, so the played speed can
   *  scale to the actor's real speed (character.cpp:743-752): the
   *  accum root's horizontal displacement over the clip, falling back
   *  to the reference's own constants when a clip carries none. */
  let movementAnimSpeed = MOVEMENT_FALLBACK_SPEED.walk;

  /**
   * MW-D26: REFRESHMOVEMENTANIMS + the movestate selection, per frame
   * (character.cpp:639-759, :2297-2330). The state derives from the
   * frame's movement INPUT (the reference's movement-settings vector)
   * carried on the camera dep; the group composes the weapon's short
   * suffix through the same one ladder the idle rides, plus movement's
   * own run->walk swap; a same-group refresh resumes from where it was
   * (:711-713); and a group nothing serves RESETS the slot rather than
   * substituting a wrong clip (:701-707).
   *
   * TURNING (character.cpp:2321-2329, 2355-2366): third person only,
   * never sneaking; the state holds 0.05s past the last rotation so
   * per-frame mouse deltas do not flicker it. The reference's
   * isTurning() reads the movement-settings rotation channel; this
   * port's yaw is mouse-driven per frame, so the hold IS the port of
   * the threshold, stated rather than smuggled.
   */
  /**
   * MW-D39: REFRESHJUMPANIMS (character.cpp:494-532), fed by the
   * frame's derived JumpState (jumpAnimState above the fold in
   * mwFirstPerson.js - update()'s :2195-2296, animation half).
   *
   * The reference's laws, kept in its own order:
   *   - the early-out is `jump == mJumpState` unless forced (:496);
   *     the force here is the weapon-stance transition, MW-D29's law
   *     carried over from movement - a sword drawn mid-air recomposes
   *     jump -> jump1h THAT frame;
   *   - None resets the jump slot AND the idle (:499-505 - the idle
   *     replays from its start when a jump ends over it);
   *   - the group is "jump" + the weapon short suffix through
   *     fallbackShortWeaponGroup's ladder (:508-513), which
   *     composeStanceGroup already IS (MW-D26's one-home law); a name
   *     nothing serves resets both, exactly as None does (:515-520);
   *   - startAtLoop (:522): a forced re-pick in the SAME state starts
   *     at "loop start" (resetClip carries Animation::reset's own
   *     ": start" fallback for it, :986-991), so a mid-air stance
   *     change does not replay the takeoff;
   *   - InAir plays start -> stop with unbounded loops and NO
   *     loopfallback (:528-529 - a group with real loop keys loops
   *     forever, one without plays once and HOLDS its last pose, which
   *     is the reference's autodisable=false falling pose);
   *   - Landing plays ONCE from "loop stop" to "stop" (:531). A group
   *     with no "jump: loop stop" key fails the pick - which is
   *     Animation::reset:992 returning false and the reference's play
   *     silently doing nothing: no landing animation is the correct
   *     outcome for data that carries none.
   *
   * Returns the frame's inJump, which gates the movestate ladder
   * (character.cpp:2296 - it runs only inside `if (!mInJump)`).
   */
  function refreshJump(mv) {
    if (!built || !built.ok) return false;
    const derived = jumpAnimState({
      grounded: mv ? mv.grounded !== false : true,
      swimming: !!(mv && mv.swimming),
      levitating: !!(mv && mv.levitating),
      jumpQueued: !!(mv && mv.jumping),
      priorInAir: jumpKind === 'inair',
      jumpPlaying: !!(jumpState && jumpState.playing),
    });
    const stance = animWeaponType(built.mwType, sheathed, spellReady);
    const force = !!jumpState && jumpStance !== stance;
    if (!force && derived.jump === jumpKind) return derived.inJump;   // :496
    if (!derived.jump) {
      if (jumpState) { resetJump(); resetIdle(); }   // :499-505
      else resetJump();
      return derived.inJump;
    }
    const composed = composeStanceGroup('jump', stance, hasGroup);   // :508-513
    if (!composed.group) {
      if (jumpState) { resetJump(); resetIdle(); }   // :515-520
      else resetJump();
      return derived.inJump;
    }
    const startAtLoop = derived.jump === jumpKind;   // :522
    const pick = derived.jump === 'inair'
      ? pickAnimSource(rig().sources, composed.group, resetClip,
        { start: startAtLoop ? 'loop start' : 'start', stop: 'stop', loopCount: Infinity })
      : pickAnimSource(rig().sources, composed.group, resetClip,
        { start: 'loop stop', stop: 'stop', loopCount: 0 });
    if (!pick) {
      // The Landing arm lands here on loop-key-less data; the InAir arm
      // on a group hasGroup approved whose keys resetClip refuses.
      // Either way the reference's outcome is a jump slot with nothing
      // playing (:515-520 / Animation::reset:992).
      if (jumpState) { resetJump(); resetIdle(); }
      else resetJump();
      return derived.inJump;
    }
    jumpState = pick.state;
    jumpSource = pick.source;
    jumpGroup = composed.group;
    jumpStance = stance;
    jumpKind = derived.jump;
    return derived.inJump;
  }

  function refreshMovement(cam, dt, inJump = false) {
    if (!built || !built.ok) return;
    const yaw = cam ? (cam.yaw || 0) : 0;
    let yawRate = 0;
    if (lastYaw != null && dt > 0) {
      let d = yaw - lastYaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      yawRate = d / dt;
      if (d !== 0) { turnDir = Math.sign(d); turnHold = 0.05; }
      else { turnHold -= dt; if (turnHold <= 0) turnDir = 0; }
    }
    lastYaw = yaw;
    const mv = (cam && cam.move) || null;
    // MW-D39: the movestate ladder runs only inside `if (!mInJump)`
    // (character.cpp:2296) - airborne, the movement slot EMPTIES and
    // the jump slot beneath it is what shows. The null flows into the
    // existing empty-movement branch, which already carries the
    // reset-both law (:646-651).
    const base = inJump ? null : movementAnimState({
      forward: mv ? mv.forward : 0,
      strafe: mv ? mv.strafe : 0,
      running: !!(mv && mv.running),
      sneaking,
      turning: turnDir,
      thirdPerson: viewMode === 'third',
    });
    if (!base) {
      // MW-D29: the frame the movement EMPTIES while one was playing,
      // the idle resets with it (character.cpp:646-651) - so it replays
      // from its start with freshly rolled loop dice (:824, :811)
      // instead of resuming mid-clip on a stale counter.
      if (movementState) { resetMovement(); resetIdle(); }
      return;
    }
    const isTurn = base.startsWith('turn');
    // MW-D29: the STANCE is part of the early-out key. The reference
    // forces refreshMovementAnims on every weapon-type transition
    // (forcestateupdate at character.cpp:1361/:1372/:1431 flows into
    // refreshCurrentAnims -> refreshMovementAnims(force)), so drawing a
    // sword mid-walk re-composes walkforward -> walkforward1h THAT
    // frame - the port's old gate keyed on the movestate name alone and
    // kept the bare-handed walk playing with the sword out.
    const stance = animWeaponType(built.mwType, sheathed, spellReady);
    const fresh = !(movementState && movementState.playing
      && movementBase === base && movementStance === stance);
    if (fresh) {
      const composed = composeMovementGroup(base, stance, hasGroup);
      if (!composed.group) {
        if (movementState) { resetMovement(); resetIdle(); }   // :701-707 resets BOTH
        movementBase = base; movementStance = stance;
        return;
      }
      if (!(movementState && movementState.playing && movementGroup === composed.group)) {
        const startPoint = movementGroup === composed.group ? clipCompletion(movementState) : 0;
        const pick = pickAnimSource(rig().sources, composed.group, resetClip,
          { loopFallback: true, loopCount: Infinity, startPoint });
        if (!pick) {
          resetMovement();
          notes.push(`movement: no source gives "${composed.group}" a start and a stop key`);
          return;
        }
        movementGroup = composed.group;
        movementState = pick.state;
        movementSource = pick.source;
      }
      movementBase = base; movementStance = stance;
      // MW-D29: the clip speed refreshes on EVERY state change, not only
      // a re-pick - the reference assigns mMovementAnimSpeed whenever
      // refreshMovementAnims runs (character.cpp:743-752), and the
      // fallback constant reads the FRESH state's run/sneak, which is
      // exactly the run->walk-swap case where the clip stays put and
      // the state does not. The velocity itself is getVelocity's
      // multi-source walk (animation.cpp:1267-1338), not the one picked
      // source's answer.
      const vel = sourcesVelocity(rig().sources, movementGroup);
      movementAnimSpeed = vel > 1 ? vel
        : sneaking ? MOVEMENT_FALLBACK_SPEED.sneak
          : (mv && mv.running) ? MOVEMENT_FALLBACK_SPEED.run : MOVEMENT_FALLBACK_SPEED.walk;
    }
    // The rate follows the LIVE speed every frame (character.cpp:2392-2408),
    // AFTER the pick so a fresh clip's own velocity is what divides: a
    // turn plays at min(1.5, |rot|/dt/pi); everything else at actual
    // speed / clip speed, capped at 10 - the port's meters crossing to
    // MW units through the one bridge, because the clip's velocity is
    // in MW units.
    movementRate = isTurn
      ? turnAnimSpeed(yawRate)
      : Math.min(MOVEMENT_SPEED_CAP,
        ((mv && mv.speed ? mv.speed : 0) * MW_UNITS_PER_METER) / movementAnimSpeed);
  }

  /** Rule 9's long group for the CURRENT stance, and the equip/unequip
   *  and attack sections all live in it. */
  function refreshWeaponGroup() {
    if (!built || !built.ok) { weaponGroup = null; return; }
    const type = animWeaponType(built.mwType, sheathed, spellReady);
    weaponGroup = composeWeaponGroup(type, hasGroup).group;
  }

  /** ANIMATION::HANDLETEXTKEY's first-person consequences. Rule 47's
   *  group test is `mine` - a key of another group crossed by this
   *  playhead is not this animation's business. */
  function onActionKey(text, time, mine) {
    if (!mine || !weaponGroup) return;
    const action = text.slice(weaponGroup.length + 2);
    // showWeapons(true/false) at the attach/detach keys - the
    // listener's own branches (CharacterController::handleTextKey,
    // character.cpp:1074-1087), gated there on Equipping/Unequipping
    // exactly as the machine is here.
    if (action === EQUIP_KEYS.attach) weaponShown = true;
    else if (action === UNEQUIP_KEYS.detach) weaponShown = false;
    // RULE 24's ranged actions (character.cpp:1153-1165). Two keys
    // attach and one releases, and "shoot follow attach" is the second
    // attach - the round that goes on the string during the
    // follow-through, which is why a bow looks loaded again before the
    // animation has finished.
    else if (action === 'shoot attach' || action === 'shoot follow attach') arrowShown = true;
    else if (action === 'shoot release') arrowShown = false;
  }

  /** PREPAREHIT's strength half (character.cpp:1250-1259), which is the
   *  ONLY thing that decides which of small/medium/large follow keys the
   *  blow ends on and how much of the release it skips. */
  function windUpStrength() {
    if (!actionState) return 1;
    const f = calculateWindUp(actionState.time, keyTime(`${attackType} min attack`),
      keyTime(`${attackType} max attack`));
    // The sentinel is NOT zero: a group with no wind-up window gets a
    // random 0.1..1.0 blow, which is how creature attacks with no
    // min/max keys still vary.
    return f === -1 ? Math.min(1, 0.1 + Math.random()) : f;
  }

  /** UpperBodyState::AttackWindUp -> AttackRelease (:1725-1790). */
  function beginRelease() {
    attackStrength = windUpStrength();
    upper = UPPER_BODY.AttackRelease;
    const k = attackKeys(attackType, attackStrength);
    const startPoint = releaseSkip(rig().keys, weaponGroup, attackType, attackStrength);
    if (!playAction(k.release.start, k.release.stop, startPoint)) beginFollow();
  }

  /** AttackRelease -> AttackEnd (:1793-1812): the follow-through, whose
   *  key names carry the strength word for a melee blow and do not for a
   *  shot. */
  function beginFollow() {
    upper = UPPER_BODY.AttackEnd;
    const k = attackKeys(attackType, attackStrength);
    if (!playAction(k.follow.start, k.follow.stop, 0)) endAttack();
  }

  /** AttackEnd -> WeaponEquipped (:1821-1856). */
  function endAttack() {
    actionState = null;
    actionSource = null;
    reloadCrossbow();
    upper = UPPER_BODY.WeaponEquipped;
    attackType = null;
    if (resetIdleOnAttackEnd) { resetIdleOnAttackEnd = false; resetIdle(); }
  }

  /** character.cpp:1827-1829 - the end of Equipping, AttackEnd or
   *  Casting. The condition is reloadsItself's; see its header for why
   *  Daggerfall can never satisfy it. */
  function reloadCrossbow() {
    if (built && built.ok && built.arrow && reloadsItself(built.mwType)) arrowShown = true;
  }

  /** UPDATEWEAPONSTATE's tail, run once per frame: every transition here
   *  is "the section that was playing has finished". */
  function stepUpper() {
    const playing = !!(actionState && actionState.playing);
    if (playing) return;
    switch (upper) {
      case UPPER_BODY.Equipping:
        actionState = null; actionSource = null;
        // MW-D28: attachArrow runs when Equipping OR AttackEnd finishes
        // (character.cpp:1824-1828) - the crossbow comes up LOADED, not
        // empty until the first shot's follow-through.
        reloadCrossbow();
        upper = UPPER_BODY.WeaponEquipped;
        if (resetIdleOnAttackEnd) { resetIdleOnAttackEnd = false; resetIdle(); }
        break;
      case UPPER_BODY.Unequipping:
        // :1857-1859 - THIS is where the weapon type becomes None, and
        // with it the stance drops to the bare "idle" of rule 10's
        // endless loop.
        actionState = null; actionSource = null;
        upper = UPPER_BODY.None;
        sheathed = true;
        refreshWeaponGroup();
        refreshIdle(true);
        break;
      case UPPER_BODY.AttackWindUp:
        // THE BOW HOLDS HERE and nothing else does. The reference leaves
        // AttackWindUp when getAttackingOrSpell() goes false - the button
        // came up - so a weapon the player cannot charge leaves it the
        // instant the wind-up section ends, at full strength. Daggerfall's
        // melee swing is exactly that: uncharged, so released at max.
        if (!holdWindUp) beginRelease();
        break;
      case UPPER_BODY.AttackRelease:
        beginFollow();
        break;
      case UPPER_BODY.AttackEnd:
        endAttack();
        break;
      case UPPER_BODY.Casting:
        // MW-D39: the cast's section finished - back to the stance, and
        // the idle replays from its start (the reference's own
        // resetCurrentIdleState on leaving an upper-body action).
        actionState = null;
        actionSource = null;
        upper = UPPER_BODY.WeaponEquipped;
        if (resetIdleOnAttackEnd) { resetIdleOnAttackEnd = false; resetIdle(); }
        break;
      default:
        if (actionState) actionState = null;
        break;
    }
  }

  const api = {
    attach(r, cam) { renderer = r || null; camera = cam || null; },
    active,
    ready,
    get frames() { return frames; },

    async build(opts) {
      if (busy) return { ok: false, stage: 'build', error: 'already building' };
      busy = true;
      try {
        const res = await buildFpArm(opts);
        releaseMesh();
        releaseThirdMesh();
        built = res;
        packed = null;
        thirdPacked = null;
        // MW-D24: the body rides the same build. A refused body is a
        // named note, and the machine stands back up in first person -
        // the one view that cannot be missing.
        thirdBuilt = res && res.ok ? (res.third || null) : null;
        viewMode = 'first';
        wornKey = fpWeaponKey(opts && opts.weapon, !!(opts && opts.hasAmmo));
        wornEquipKey = wornEquipKeyOf(opts && opts.armor);
        lastBuildOpts = opts ? { ...opts } : null;
        buildDeps = (opts && opts.deps) || null;
        idleState = null; actionState = null; idleGroup = null; weaponGroup = null;
        movementState = null; movementGroup = null; movementSource = null; movementBase = null;
        jumpState = null; jumpGroup = null; jumpSource = null; jumpStance = null; jumpKind = null;   // MW-D39
        lastYaw = null; turnDir = 0; turnHold = 0;
        upper = UPPER_BODY.None; attackType = null; holdWindUp = false;
        weaponShown = false; arrowShown = false; notes.length = 0; aimFactor = 0; sneaking = false;
        idleSource = null; actionSource = null; poseSource = null;
        // A REBUILT ARM STARTS SHEATHED, whatever the last one was doing.
        // The build is triggered by a button, and the player is not
        // mid-swing when they press it; carrying a stale AttackRelease
        // across a rebuild would leave the machine waiting for a clip
        // that no longer exists.
        sheathed = true;
        if (!res.ok) { reason = `${res.stage}: ${res.error}`; built = res; return res; }
        refreshWeaponGroup();
        refreshIdle(true);
        if (!idleState) {
          built = null;
          reason = 'clip: no idle group this stance can reach';
          return { ok: false, stage: 'clip', error: reason };
        }
        reason = 'built';
        return res;
      } finally {
        busy = false;
        // MW-D36: whoever shows the body (the pack's figure) repaints
        // when a build settles, ok or not - D32 rebuilds on every equip
        // change, asynchronously, and a panel drawn before the rebuild
        // lands would show the old clothes on the new equip table.
        for (const fn of listeners) { try { fn(); } catch { /* a dead panel is not the rig's problem */ } }
        // PX25: the table that arrived mid-build goes now.
        if (pendingWorn) { const p = pendingWorn; pendingWorn = null; this.setWorn(p); }
      }
    },

    /** MW-D36: subscribe to build/unload settlements; returns the
     *  unsubscribe. */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    unload() {
      releaseMesh(); built = null; packed = null;
      releaseThirdMesh(); thirdBuilt = null; thirdPacked = null; viewMode = 'first';
      movementState = null; movementGroup = null; movementSource = null; movementBase = null;
      jumpState = null; jumpGroup = null; jumpSource = null; jumpStance = null; jumpKind = null;   // MW-D39
      lastYaw = null; turnDir = 0; turnHold = 0;
      idleState = null; actionState = null; idleGroup = null; weaponGroup = null;
      upper = UPPER_BODY.None; attackType = null; holdWindUp = false;
      weaponShown = false; arrowShown = false;
      notes.length = 0; aimFactor = 0; sneaking = false;
      idleSource = null; actionSource = null; poseSource = null;
      reason = 'unloaded';
      for (const fn of listeners) { try { fn(); } catch { /* see build() */ } }
    },

    /**
     * THE DRAWN/SHEATHED SWITCH, which is a whole animation state and not
     * a boolean the draw path reads.
     *
     * Rule 8: sheathed is weapon type None - the bare "idle" group with
     * rule 10's endless loop and no weapon in shot. Drawn is the weapon's
     * own type, its "idle<short>" stance, and the equip section played
     * once on the way in. The reference reaches this through
     * updateWeaponState comparing `weaptype` to `mWeaponType`
     * (character.cpp:1382-1500); here the caller says which it wants and
     * the same two sections play.
     */
    setSheathed(next) {
      const want = !!next;
      if (!built || !built.ok) return false;
      if (want === sheathed) return false;
      // THE TWO HALVES ARE NOT SYMMETRIC, and that asymmetry is the rule.
      //
      // Drawing sets mWeaponType to the new type AS THE EQUIP ANIMATION
      // STARTS (character.cpp:1495-1496), so the stance becomes "idle1h"
      // immediately. Sheathing does NOT: mWeaponType stays the old type
      // for the whole unequip section and only becomes None when it
      // finishes (:1857-1859). Flipping it early would compose the
      // unequip section's group name from a weapon that is already gone -
      // the animation would look for "unequip start" in the bare-handed
      // group and find nothing, and the weapon would vanish rather than
      // be put away.
      if (want) {
        // :1384 - the guard against restarting the unequip we are
        // already playing, which the per-frame sync makes load-bearing.
        if (upper === UPPER_BODY.Unequipping) return false;
        // MW-D28: the OTHER half of :1383-1384's guard, which the port
        // had dropped - `mUpperBodyState <= UpperBodyState::AttackWindUp`.
        // The wind-up may be interrupted by a sheathe; the release and
        // the follow-through may NOT: the attack runs out first and the
        // per-frame sync starts the unequip on the next frame, exactly
        // as the reference's per-frame updateWeaponState does.
        if (upper === UPPER_BODY.AttackRelease || upper === UPPER_BODY.AttackEnd) return false;
        if (upper === UPPER_BODY.None || !weaponGroup) {
          sheathed = true; weaponShown = false; arrowShown = false;
          refreshWeaponGroup(); refreshIdle(true);
          return true;
        }
        upper = UPPER_BODY.Unequipping;
        // If the file has no "unequip detach" key the weapon is hidden
        // by hand, immediately (:1412-1414).
        const detach = keyTime(UNEQUIP_KEYS.detach);
        if (!playAction(UNEQUIP_KEYS.start, UNEQUIP_KEYS.stop, 0)) {
          upper = UPPER_BODY.None; sheathed = true; weaponShown = false; arrowShown = false;
          refreshWeaponGroup(); refreshIdle(true);
          return true;
        }
        if (detach < 0) weaponShown = false;
        // detachArrow() (character.cpp:1410), unconditionally, as the
        // unequip section starts - not at its "unequip detach" key.
        arrowShown = false;
        return true;
      }
      sheathed = false;
      refreshWeaponGroup();
      upper = UPPER_BODY.Equipping;
      resetIdleOnAttackEnd = true;
      const attach = keyTime(EQUIP_KEYS.attach);
      if (!playAction(EQUIP_KEYS.start, EQUIP_KEYS.stop, 0)) { upper = UPPER_BODY.WeaponEquipped; weaponShown = true; }
      // :1468-1472 - no "equip attach" key means show the weapon now.
      if (attach < 0) weaponShown = true;
      refreshIdle(true);
      return true;
    },

    /**
     * MW-D19: THE WEAPON FOLLOWS THE HAND. The arm was a one-shot
     * snapshot of the equip state at build time - the ONLY caller of
     * build() is the card's button, so a weapon equipped after it was
     * pressed never reached the hand, and one equipped before it never
     * left. The reference re-resolves the weapon whenever the equip
     * slot changes (updateEquippedWeapon destroys and re-creates the
     * weapon's PartHolder; rule 57's hide-not-remove is for
     * draw/sheathe of the SAME weapon, which weaponShown still does).
     *
     * The fast path is synchronous and per-frame cheap: the caller
     * hands in what the hand holds every frame, and nothing happens
     * until fpWeaponKey says the identity changed. The slow path
     * reopens the stored archives for the one mesh fetch, resolves
     * through resolveWeaponParts - the build's own door - swaps the
     * weapon and arrow pieces on the live assembly, and re-equips if
     * the old weapon was drawn.
     */
    /** MW-D32: THE BODY FOLLOWS THE EQUIP TABLE. One key compare per
     *  frame, exactly setWeapon's shape; a change rebuilds the whole
     *  rig through build() with the new worn list, because worn
     *  verdicts reshape the SKIN rows (shadows) and not just an
     *  attachment - an in-place rebind cannot express "the right hand
     *  skin is gone now". The rebuild runs while the inventory is open
     *  and the game paused, which is when equipment changes. */
    setWorn(pieces) {
      if (!built || !built.ok || !lastBuildOpts) return false;
      const key = wornEquipKeyOf(pieces);
      if (key === wornEquipKey) return false;
      // PX25: A CHANGE DURING A REBUILD IS NOT DROPPED. The pack hands
      // over the table on every action now, and two quick equips land
      // the second while the first is still building; returning false
      // here left the key unmoved and the body one change behind until
      // something else asked. The latest table waits and is applied the
      // moment the in-flight build settles.
      if (busy) { pendingWorn = pieces; return false; }
      wornEquipKey = key;
      return this.build({ ...lastBuildOpts, armor: pieces, weapon: lastBuildOpts.weapon });
    },
    setWeapon(item, { hasAmmo = false } = {}) {
      if (!built || !built.ok || busy) return false;
      const key = fpWeaponKey(item, hasAmmo);
      if (key === wornKey) return false;
      busy = true;
      const token = built;
      return (async () => {
        try {
          const d = buildDeps || await import('../scenes/dataSource.js');
          const archives = await d.loadMorrowindArchives();
          // Unloaded or rebuilt while the archives opened: this swap's
          // target is gone, and the newer state already carries its own
          // wornKey. Walk away.
          if (built !== token) return false;
          const find = (p) => archives.find((a) => a.has(p));
          const resolved = resolveWeaponParts({
            weapon: item, hasAmmo, allWeapons: token.allWeapons, find,
            skeletonBytes: token.skeletonBytes,
          });
          const arm = token.arm;
          arm.pieces = arm.pieces.filter((p) => p.slot !== 'weapon' && p.slot !== 'arrow');
          bindPartsInto(arm, resolved.parts);
          // Textures the NEW pieces name, resolved while the archives
          // are open; what the arm already decoded stays.
          const fresh = arm.pieces.filter((p) => p.slot === 'weapon' || p.slot === 'arrow');
          for (const [file, tex] of collectArmTextures(fresh, archives)) {
            if (!token.textures.has(file)) token.textures.set(file, tex);
          }
          const oldType = token.mwType;
          token.mwType = resolved.mwType;
          token.weapon = resolved.weaponInfo;
          token.arrow = resolved.arrowInfo;
          token.notes = [
            ...(token.notes || []).filter((n) => !/^(weapon|arrow)[ :@]/.test(n)),
            ...resolved.notes,
          ];
          token.pieces = armPieceRows(arm.pieces).length;
          // Reach follows the new silhouette - the build's own 25-pose
          // sweep, same arithmetic.
          const poseAt = (t) => poseAssembly(arm, {
            tracks: token.tracks, sampleTrack, time: t, accumRoot: token.accumRoot,
          });
          const c = token.clip;
          const times = Array.from({ length: 25 }, (_, i) => c.startTime + ((c.stopTime - c.startTime) * i) / 24);
          token.reach = armReach(firstPersonEye(arm.mats, token.cameraRef), clipUnionBounds(arm, poseAt, times));
          poseAt(c.startTime);
          if (token.weapon) token.weapon.side = weaponRestSide(arm, token.weapon.bone);
          if (token.arrow) token.arrow.side = weaponRestSide(arm, token.arrow.bone);
          // MW-D24: the SAME swap on the third-person body - same door
          // (resolveWeaponParts), this rig's own skeleton bytes, so the
          // bow lands on ITS "Weapon Bone Left" and the arrow test runs
          // against bones this rig actually has.
          if (thirdBuilt && thirdBuilt.ok) {
            const t = thirdBuilt;
            const tResolved = resolveWeaponParts({
              weapon: item, hasAmmo, allWeapons: token.allWeapons, find,
              skeletonBytes: t.skeletonBytes,
            });
            t.arm.pieces = t.arm.pieces.filter((p) => p.slot !== 'weapon' && p.slot !== 'arrow');
            bindPartsInto(t.arm, tResolved.parts);
            const tFresh = t.arm.pieces.filter((p) => p.slot === 'weapon' || p.slot === 'arrow');
            for (const [file, tex] of collectArmTextures(tFresh, archives)) {
              if (!t.textures.has(file)) t.textures.set(file, tex);
            }
            t.mwType = tResolved.mwType;
            t.weapon = tResolved.weaponInfo;
            t.arrow = tResolved.arrowInfo;
            t.pieces = armPieceRows(t.arm.pieces).length;
            releaseThirdMesh();
            thirdPacked = null;
          }
          releaseMesh();
          packed = null;
          // The old action clip belonged to the old weapon's group.
          actionState = null; actionSource = null; attackType = null; holdWindUp = false;
          wornKey = key;
          const wasDrawn = !sheathed;
          // MW-D28: isStillWeapon (character.cpp:1364) - a DRAWN hand
          // swapping one real weapon for another plays NO unequip and NO
          // equip: "We should not play equipping animation and sound
          // during weapon->weapon transition". The unequip block is
          // gated `&& !isStillWeapon` (:1385) and the whole equip body
          // is wrapped `if (!isStillWeapon)` (:1445); only the group
          // and the stance re-resolve (:1443, :1495-1496), and a
          // mid-attack swap is forced to WeaponEquipped with the weapon
          // SHOWN first (:1370-1377). The mesh swaps in the hand.
          const stillWeapon = wasDrawn && isRealWeapon(oldType) && isRealWeapon(resolved.mwType);
          if (stillWeapon) {
            weaponShown = true;    // :1377 showWeapons(true)
            arrowShown = false;    // a fresh round attaches at its own shoot keys (MW-D16)
            upper = UPPER_BODY.WeaponEquipped;
            refreshWeaponGroup();
            resetIdle();           // forcestateupdate (:1372) - the new stance's idle
          } else {
            weaponShown = false; arrowShown = false;
            sheathed = true;
            upper = UPPER_BODY.None;
            refreshWeaponGroup();
            refreshIdle(true);
            // A drawn hand equips the NEW weapon - the same section the
            // reference plays when the equip slot changes mid-draw
            // (real-weapon-to-real-weapon never reaches here any more).
            if (wasDrawn) { busy = false; api.setSheathed(false); }
          }
          return true;
        } finally { busy = false; }
      })();
    },

    /**
     * A BLOW STARTS. `strike` is Daggerfall's own six-way gesture result,
     * which rule 11's recorded divergence maps onto Morrowind's three
     * attack types by the SHAPE OF THE MOTION.
     *
     * The wind-up is all that is played here. What follows it is decided
     * by the machine: a bow HOLDS at full draw until release() (which is
     * what the port's own StrikeUp draw frame does), and everything else
     * runs straight on into the release at full strength - because
     * Daggerfall's swing has no charge, so the button is never "still
     * held at max attack".
     */
    attack(strike, { hold = false } = {}) {
      if (!built || !built.ok || sheathed) return null;
      if (upper !== UPPER_BODY.WeaponEquipped) return null;
      // MW-D16: the SHOOT test is the weapon CLASS, not a flag the
      // caller passes:
      //   if (weapclass == Ranged || weapclass == Thrown)
      //       mAttackType = "shoot";            character.cpp:1676-1677
      // The arm already knows its weapon type, so asking the caller was
      // a second source of truth for a question the data answers - and
      // the port's own `isBow` would have missed MarksmanThrown, which
      // shoots without being a bow.
      const type = mwAttackType(strike, {
        bow: shootsRatherThanSwings(animWeaponType(built.mwType, sheathed)),
      });
      if (!type) return null;
      attackType = type;
      attackStrength = 1;
      resetIdleOnAttackEnd = true;
      // `hold` is the caller's machine, not a guess about bows. The
      // port's in-game bow is DFU's BowDrawback-OFF instant shot
      // (playerWeapon.gesture:105-111), so it does NOT hold and does not
      // ask to; the drawn-and-holding StrikeUp state exists in the same
      // machine and the paperdoll viewer drives it. Coupling the hold to
      // `bow` would hang the arm at full draw waiting for a release the
      // game path never sends.
      holdWindUp = !!hold;
      upper = UPPER_BODY.AttackWindUp;
      const k = attackKeys(type, 1);
      if (!playAction(k.windUp.start, k.windUp.stop, 0)) {
        upper = UPPER_BODY.WeaponEquipped;
        attackType = null;
        holdWindUp = false;
        return null;
      }
      return type;
    },

    /** MW-D39: A SPELL IS READIED. The stance changes and the idle,
     *  the movement and the weapon group all re-compose to the
     *  spellcast family on the next frame - the same path a drawn
     *  sword takes. Idempotent; false when nothing changed, so a host
     *  may call it every frame. */
    readySpell(ready) {
      const want = !!ready;
      if (!built || !built.ok || spellReady === want) return false;
      spellReady = want;
      // A cast in flight is abandoned by an un-ready (the spell was
      // aborted): the arm returns to its stance rather than finishing
      // an animation for a spell that is not going out.
      if (!want && upper === UPPER_BODY.Casting) { actionState = null; actionSource = null; upper = UPPER_BODY.WeaponEquipped; }
      refreshWeaponGroup();
      resetIdle();
      resetMovement();
      return true;
    },

    /** MW-D39: THE SPELL GOES. The key pair is THE SPELL'S RANGE, not a
     *  single "cast": character.cpp:1618-1636 sets mAttackType from the
     *  first effect's range - self / touch / target - and plays
     *  "<type> start" ... "<type> stop" in the spellcast group. A first
     *  draft here guessed "cast start", which no Morrowind animation
     *  carries, and every cast would have been a silent note. The
     *  Daggerfall range byte maps onto the reference's three
     *  (spellcast.js TARGET_TYPES): CasterOnly and AreaAroundCaster are
     *  SELF, ByTouch is TOUCH, SingleTargetAtRange and AreaAtRange are
     *  TARGET. Lands back in the stance through the upper-body machine.
     *  Never a gate: a missing clip is a note on the card and the spell
     *  still flies. */
    castSpell(rangeType = 2) {
      if (!built || !built.ok || !spellReady) return false;
      if (upper !== UPPER_BODY.WeaponEquipped && upper !== UPPER_BODY.Casting) return false;
      const type = spellAttackType(rangeType);
      attackType = type;
      attackStrength = 1;
      resetIdleOnAttackEnd = true;
      upper = UPPER_BODY.Casting;
      if (!playAction(`${type} start`, `${type} stop`, 0)) {
        // no keys for this range in this group: the stance stands, and
        // the note on the card says which group could not answer.
        upper = UPPER_BODY.WeaponEquipped;
        attackType = null;
        return false;
      }
      return true;
    },

    /** The held bow comes up. Everything else releases itself. */
    release() {
      if (upper !== UPPER_BODY.AttackWindUp) return false;
      holdWindUp = false;
      if (actionState && actionState.playing) return true;   // still winding up; the machine takes it
      beginRelease();
      return true;
    },

    /** PER FRAME. Synchronous, no allocation after the first pack, no
     *  await and no dynamic import - a promise per frame in a rAF body
     *  is a stutter you cannot profile out. */
    update(dt) {
      if (!built || !built.ok || !renderer) return;
      const cam = camera && camera();
      sneaking = !!(cam && cam.sneaking);
      // refreshCurrentAnims' order, and it is not arbitrary: the weapon
      // state is stepped FIRST because the idle refresh below depends on
      // it - "idle handled last as it can depend on the other states"
      // (character.cpp:842) - and MW-D26's movement sits between them,
      // exactly where refreshMovementAnims runs (:842-845).
      // MW-D29: EACH clip advances against ITS OWN source's text keys -
      // a state minted from one .kf and stepped through another's key
      // list crosses the wrong markers the moment two sources serve
      // different groups (the base .kf plus a skeleton's own is the
      // everyday retail case for a female or beast actor).
      if (actionState) {
        // MW-D28: the weapon record's mSpeed scales EXACTLY the three
        // attack sections - wind-up, release, follow - and nothing else
        // (character.cpp:1718/:1786/:1811 pass weapSpeed as speedmult;
        // the equip/unequip plays at :1408/:1465 pass 1.0f). A dagger
        // swings fast and a warhammer slow, off the record, not a guess.
        const attacking = upper === UPPER_BODY.AttackWindUp
          || upper === UPPER_BODY.AttackRelease || upper === UPPER_BODY.AttackEnd;
        const weapSpeed = attacking && built.weapon && Number.isFinite(built.weapon.speed)
          ? built.weapon.speed : 1;
        advanceClip(actionState, (actionSource || rig()).keys, dt * weapSpeed, onActionKey);
        stepUpper();
      }
      // MW-D39: jump refreshes BEFORE movement, the reference's own
      // order (refreshCurrentAnims, character.cpp:841-844: hit recoil,
      // jump, movement, idle last), and its inJump is what gates the
      // movestate ladder this frame.
      const inJump = refreshJump((cam && cam.move) || null);
      refreshMovement(cam, dt, inJump);
      if (movementState) advanceClip(movementState, (movementSource || rig()).keys, dt * movementRate, null);
      // The jump plays at speedmult 1.0 (character.cpp:528-531 pass
      // 1.0f) - no rate scaling, unlike movement.
      if (jumpState) advanceClip(jumpState, (jumpSource || rig()).keys, dt, null);
      if (idleState) advanceClip(idleState, (idleSource || rig()).keys, dt, null);
      refreshIdle();
      aimFactor = aimingFactor(aimFactor, accurateAiming(upper), dt);
      if (!actionState && !movementState && !jumpState && !idleState) return;
      // THE WINNER, not a blend. See the two-slot note above: in first
      // person both animations are played on BlendMask_All, so the higher
      // priority takes every bone for as long as it is playing.
      // THE FOUR-SLOT WINNER (MW-D26, MW-D39): weapon action, then
      // movement, then jump, then idle - the reference's priority order
      // (character.hpp:30-43: Jump below Movement below Weapon) with
      // BlendMask_All everywhere. The jump wins the air because the
      // movement slot empties there, not by outranking it. The
      // per-bone-group vector is the recorded gap.
      const state = actionState || movementState || jumpState || idleState;
      // MW-D14: and the TRACKS come from the same file as the clip. A
      // female actor can win her idle from xbase_anim_female.1st.kf and
      // her swing from the base xbase_anim.1st.kf, and posing one with
      // the other's tracks is a bind pose with no error.
      poseSource = actionState ? actionSource : (movementState ? movementSource : (jumpState ? jumpSource : idleSource));
      // Rule 54's neck: the camera node hangs off "bip01 neck", so the
      // pitch has to be in the pose before any matrix is composed - the
      // eye MOVES with the look, it is not a lens tilt.
      // MW-D24: THE THIRD-PERSON FRAME. One machine advanced the clip
      // above; which ASSEMBLY takes the pose is the view's question.
      // The body takes NO neck pitch and no sneak delta: rule 54's neck
      // rotation and rule 32(a)'s i1stPersonSneakDelta are first-person
      // laws by name (npcanimation.cpp:719 runs the pitch controller
      // only in VM_FirstPerson; the GMST is "1stPerson"), and vanilla's
      // visible body stands level however the player looks.
      if (viewMode === 'third') {
        const t = thirdBuilt;
        if (!t || !t.ok) return;
        poseAssembly(t.arm, {
          tracks: poseSource ? poseSource.trackMap : t.tracks,
          sampleTrack,
          time: state.time,
          accumRoot: t.accumRoot,
        });
        uploadThirdMesh(t);
        // Rule 57 hides on the SAME flags: sheathed vanilla shows no
        // weapon on the body, and the arrow follows the shoot keys.
        for (const r of thirdMesh.ranges) {
          if (r.slot === 'weapon') r.hidden = !weaponShown;
          else if (r.slot === 'arrow') r.hidden = !arrowShown;
        }
        frames++;
        return;
      }
      poseAssembly(built.arm, {
        tracks: poseSource ? poseSource.trackMap : built.tracks,
        sampleTrack,
        time: state.time,
        // Rule 56's accum root is STICKY and rig-wide, so it does not
        // follow the source the way the tracks do.
        accumRoot: built.accumRoot,
        // NEGATED, and the sign is a real difference between the two
        // engines rather than a fudge: Morrowind's rot[0] counts pitch
        // DOWNWARD (the controller takes `Quat(rot[0] * 0.75, (-1,0,0))`
        // and a positive angle tips the rig's +Y forward axis toward
        // -Z), while this port's cam.pitch counts UPWARD - world.js
        // SUBTRACTS the mouse's y delta. Passed unconverted, the neck
        // rotates the arms the wrong way and DOUBLES the loss: measured,
        // a 0.25 look-up put every vertex out of frame instead of
        // sliding them a tenth of the way down it.
        // IG6c: in FIXED mode the look does not enter the arms pass AT
        // ALL - not here, not at the lens. The earlier glue relied on
        // the neck rotation and the lens rotation cancelling, which is
        // exact on the fixtures and was STILL moving on Mac's retail
        // data - a cancellation can only be as good as both of its
        // halves, and a half this bench cannot verify (the retail
        // skeleton's own bones) must not be load-bearing. Zero in, zero
        // out cannot move, on any data, by construction.
        neckPitch: (followCam || !cam) ? 0 : -(cam.pitch || 0),
        // MW-D13: and the factor that pitch is multiplied by, which is
        // not the constant 0.75 this passed before. Stepped HERE, once
        // per frame, because mAimingFactor is a decaying state.
        // IG4: glued arms hold the reference's own aiming glue (aim 1 is
        // rotateFactor 1.0) on EVERY frame; the law path still steps
        // aimFactor above so flipping the toggle lands mid-decay exactly
        // where the reference would be.
        neckAim: followCam ? 1 : aimFactor,
        // Rule 32(a): the whole body sinks by i1stPersonSneakDelta in -Z
        // while sneaking, through the neck - and IG1 adds the head bob
        // to the SAME vector, the reference's own channel (the module
        // head on fpOffset carries the citations). The lens adds this
        // offset a second time in draw(), per calculateFirstPersonPosition.
        neckOffset: (() => {
          // IG4: glued arms take NO offset at EITHER of its two
          // applications - zeroing one side alone would smuggle the
          // slide back in through the other.
          if (followCam) { fpOffset[0] = 0; fpOffset[1] = 0; fpOffset[2] = 0; return null; }
          const sneak = sneakOffset(sneaking, built.sneakDelta);
          const bobZ = cam && cam.bob ? (cam.bob[1] || 0) * MW_UNITS_PER_METER : 0;
          fpOffset = [sneak[0], sneak[1], sneak[2] + bobZ];
          return fpOffset;
        })(),
      });
      packed = packFpArm(built.arm.pieces, packed);
      if (!mesh) {
        mesh = renderer.createCharacterMesh(packed.packed, { uv: true });
        // MW-D11: the ranges are the piece list, and the textures are
        // resolved ONCE and hung on them - the per-frame path re-uploads
        // vertices and touches nothing else.
        mesh.ranges = packed.ranges;
        for (const r of mesh.ranges) {
          if (!r.textureFile) continue;
          const entry = built.textures.get(r.textureFile);
          if (!entry) continue;
          const clamp = r.piece.material ? r.piece.material.clampMode : 3;
          r.tex = renderer.createCharacterTexture(entry.image.mips, wrapModes(clamp));
          // NiAlphaProperty's own threshold, 0-255 in the file.
          r.alphaCut = r.piece.material && r.piece.material.alphaTest
            ? (r.piece.material.alphaThreshold || 0) / 255 : 0;
        }
      } else {
        renderer.updateCharacterMesh(mesh, packed.packed);
      }
      // NpcAnimation::showWeapons - the reference REMOVES the part
      // (removeIndividualPart(PRT_Weapon), npcanimation.cpp:981) and
      // re-adds it on show. This port keeps the vertices and flips a
      // per-range flag instead - a DECLARED mechanism divergence with
      // the same visible behaviour: repacking without the weapon would
      // change the buffer's length every time you drew or sheathed,
      // orphaning the ranges the textures hang on.
      for (const r of mesh.ranges) {
        if (r.slot === 'weapon') r.hidden = !weaponShown;
        else if (r.slot === 'arrow') r.hidden = !arrowShown;
      }
      frames++;
    },

    draw(canvas) {
      // MW-D24: in third person the first-person overlay does not exist
      // - the reference masks the whole FP root out of the scene
      // (Mask_FirstPerson, npcanimation.cpp:542-546 - setViewMode's
      // setNodeMask on the whole object root). active() is already false in that mode; the guard here
      // keeps the sentence readable at the call site.
      if (!active() || !canvas) return false;
      const cam = camera();
      if (!cam) return false;
      const wantW = canvas.clientWidth / CHAR_PIXEL;
      const wantH = canvas.clientHeight / CHAR_PIXEL;
      const s = Math.min(1, CHAR_SPRITE_RT_SIZE / wantW, CHAR_SPRITE_RT_SIZE / wantH);
      const pw = Math.max(2, Math.round(wantW * s));
      const ph = Math.max(2, Math.round(wantH * s));

      // RULE 54: THE WHOLE PASS LIVES IN THE RIG'S OWN SPACE.
      //
      // The camera is a node of this rig, so the player's world position
      // and heading do not enter into it at all - turning your head does
      // not move your arms relative to your eyes. What is left is the
      // camera node's translation, the player's pitch, and the basis
      // change from the file's Z-up axes into this renderer's Y-up.
      const eye = firstPersonEye(built.arm.mats, built.cameraRef);
      if (!eye) return false;
      // IG1: calculateFirstPersonPosition adds the first-person offset
      // ON TOP of the tracked bone (camera.cpp:149-157) - the bone
      // already moved once with the neck, so the lens moves twice and
      // the arms visibly shift against the view: the sink you see when
      // you sneak, the bob you see when you walk. MW z is the pass's
      // up, MW y its -Z forward.
      eye[0] += fpOffset[0];
      eye[1] += fpOffset[2];
      eye[2] -= fpOffset[1];
      // The neck has already taken 0.75 of the pitch (poseAssembly), so
      // the eye has MOVED with the look; the lens takes all of it, which
      // is the lag you feel when you glance down at your hands.
      // IG6c: in FIXED mode the lens never pitches, matching the pose
      // that never pitched - the look is simply not an input to this
      // pass, so the picture cannot depend on it, on any skeleton. The
      // rotate-and-cancel glue this replaces was exact on the fixtures
      // and still moved on Mac's retail data; classic-sprite semantics
      // ("the weapon ignores the look") are now taken literally.
      const pitch = followCam ? 0 : (cam.pitch || 0);
      const fwd = [0, Math.sin(pitch), -Math.cos(pitch)];
      const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);

      // MW-D23: NO MIRROR. THIS PASS IS ALREADY CHIRALITY-TRUE, and the
      // mirror MW-D9 borrowed from the world pass is what put Mac's
      // sword in the LEFT hand - the one object in the frame that can
      // betray a mirror, because a mirrored PAIR of hands looks exactly
      // like a correct pair.
      //
      // The measured law, through THIS pass's own composition
      // (NIF_TO_PASS is Rx(-90), det +1; this lookAt faces -Z with +Y
      // up; perspective is standard GL): a point one unit to the
      // ACTOR'S RIGHT (+X in Morrowind's basis - actors face +Y with
      // +Z up, right = forward x up) lands at POSITIVE NDC x, which is
      // SCREEN-RIGHT, with no mirror at all.
      //
      // MW-D9's contrary measurement built its probe camera looking
      // toward +Z while this pass looks toward -Z; through a +Z-facing
      // camera the viewer's right is -X, so its "one metre to the
      // player's right" test point was actually on the player's LEFT,
      // and the mirror it demanded flipped a correct pass. The world's
      // mirror belongs to the WORLD pass's own composition (Daggerfall
      // content, its own yaw convention - towns and signage verify it
      // visually); it was never a law about lookAt, and borrowing it
      // across compositions is how a fix becomes a bug.
      //
      // The planes are in RIG UNITS and come off the arm's own reach, so
      // a file authored at any scale is framed by its own geometry
      // rather than by a constant that assumes metres.
      const proj = perspective(FP_FIELD_OF_VIEW, pw / ph, Math.max(built.reach / 200, 1e-4), built.reach * 4);
      const tex = renderer.renderCharacterSprite(mesh, NIF_TO_PASS, proj, view, pw, ph);
      renderer.drawScreenOverlayQuad(tex, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);
      return true;
    },

    /**
     * MW-D24: THE VIEW SWITCH, the port's setViewMode + forceStateUpdate
     * (npcanimation.cpp:295-317; character.cpp:2798). The camera machine
     * only crosses the first-person boundary when upperBodyReady() - the
     * reference queues otherwise (camera.cpp:225-232) - so by the time
     * this runs the machine is in a stable state (None or
     * WeaponEquipped) and the re-derivation is exactly a force refresh:
     * the action slot empties ("Changing the view will stop all playing
     * animations"), the stance re-resolves on the NEW rig's sources, and
     * weaponShown/sheathed carry over untouched.
     */
    setViewMode(mode) {
      const want = mode === 'third' ? 'third' : 'first';
      if (want === viewMode) return true;
      if (want === 'third' && !(thirdBuilt && thirdBuilt.ok)) {
        notes.push(`view: no third-person body - ${thirdBuilt ? `${thirdBuilt.stage}: ${thirdBuilt.error}` : 'not built'}`);
        return false;
      }
      viewMode = want;
      actionState = null; actionSource = null; attackType = null; holdWindUp = false;
      resetMovement();
      resetJump();   // MW-D39: the clip state came from the OTHER rig's sources; the next frame re-derives
      if (upper !== UPPER_BODY.None && upper !== UPPER_BODY.WeaponEquipped) {
        upper = weaponShown ? UPPER_BODY.WeaponEquipped : UPPER_BODY.None;
      }
      refreshWeaponGroup();
      resetIdle();
      return true;
    },
    viewMode: () => viewMode,
    /** IG4: follow-camera mode - the shipped default. See the module
     *  head above createFpArm; the pause card's toggle flips it live. */
    followCamera: () => followCam,
    setFollowCamera(v) {
      followCam = !!v;
      try { appStorage()?.setItem(FOLLOW_CAMERA_KEY, followCam ? 'true' : 'false'); } catch { /* a full store still keeps the in-session choice */ }
      return followCam;
    },
    thirdActive,
    /** Animation::upperBodyReady (animation.cpp:1846-1857), which is
     *  what the camera's queued-mode gate consults (camera.cpp:135):
     *  a stable stance, no action section in flight, no build in
     *  flight. */
    upperBodyReady: () => !busy && !actionState
      && (upper === UPPER_BODY.None || upper === UPPER_BODY.WeaponEquipped),
    /** What the wheel may cross INTO: a body that refused keeps the
     *  player in first person with the reason on the card. */
    canThirdPerson: () => !!(thirdBuilt && thirdBuilt.ok),

    /** MW-D34: the race's HEIGHT factor (adjustScale's z, npc.cpp:1127/
     *  1134), which is what the camera's focal height rides - the
     *  tracked node sits on the scaled actor. mwViewFrame passes it so
     *  no host re-derives the seam (MW-D25's law). */
    raceHeightScale: () => (built && built.ok && built.raceScale ? built.raceScale.height : 1),

    /**
     * MW-D24: THE THIRD-PERSON DRAW - the body composited into the world
     * through the pixelize standard (drawRigSpriteBox, the same law the
     * voxel foes ride). The assembly is in Morrowind's Z-up units; the
     * model matrix stands it at the player's feet with the player's
     * heading and ONE scale, the reference's own unit bridge
     * (constants.hpp:10) - a Morrowind body is 1.83m tall in this
     * port's meters because that is what 128 units IS, not because it
     * was fitted to anything.
     *
     * Yaw: the port's world forward is [sin yaw, 0, cos yaw]; a
     * Morrowind actor faces +Y in model space, which Rx(-90) sends to
     * -Z... so the rig needs an extra half-turn to face the player's
     * forward, folded into the yaw term below and pinned by the probe's
     * facing layer rather than trusted.
     *
     * MW-D34, THE MEASURED CHIRALITY (mwArmProbe L5b, through the REAL
     * composite - MW-D23's law): this pass composites through the
     * WORLD's lens, which is mirrorProjectionX (dungeon.js:488 et al.),
     * and the port's world convention puts the player's RIGHT at +X at
     * yaw 0 (motor.js:573) - a LEFT-handed convention the mirror turns
     * into correct screen imagery. A right-handed NIF actor placed with
     * a pure rotation therefore reads MIRRORED on screen (measured:
     * sword ink Δleft 1701 vs Δright -127 with the motor's +X anchor
     * projecting screen-right). The -u on the local x axis is the SAME
     * basis adaptation every Daggerfall asset already carries via that
     * mirror: it puts the actor's right hand at the motor's right
     * (+X), and through the lens, on SCREEN-RIGHT - where the FP pass
     * (chirality-true by MW-D23's measurement) already shows it.
     * Winding is safe: drawCharacter disables CULL_FACE.
     */
    drawThird(canvas, { proj, view, eye, feet, yaw }) {
      if (!thirdActive() || !canvas || !feet) return false;
      const t = thirdBuilt;
      const u = 1 / MW_UNITS_PER_METER;
      const yawDeg = (yaw * 180 / Math.PI) + 180;
      // MW-D34: adjustScale on the rendered body (npc.cpp:1124-1135):
      // x,y take the race's WEIGHT, z its HEIGHT. In this frame the
      // local x/z pair is the MW horizontal (side/forward through
      // Rx(-90)) and local y is the MW vertical.
      const rs = (built && built.raceScale) || { weight: 1, height: 1 };
      const model = multiply(
        trs(feet[0], feet[1], feet[2], 0, yawDeg, 0, -u * rs.weight, u * rs.height, u * rs.weight),
        NIF_TO_PASS,
      );
      // The box the sprite law needs, measured off the POSED pieces in
      // MW axes and mapped: MW z is world up, MW x/y are the horizontal
      // pair. The azimuth-safe half-width holds under yaw for free,
      // exactly as the voxel rigs' does.
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const r of armPieceRows(t.arm.pieces)) {
        const b = r.bounds;
        if (!b) continue;
        if (b.minX < minX) minX = b.minX; if (b.maxX > maxX) maxX = b.maxX;
        if (b.minY < minY) minY = b.minY; if (b.maxY > maxY) maxY = b.maxY;
        if (b.minZ < minZ) minZ = b.minZ; if (b.maxZ > maxZ) maxZ = b.maxZ;
      }
      if (!(maxX > minX)) return false;
      const halfH = ((maxZ - minZ) * u * rs.height) / 2;
      const halfW = (Math.hypot(maxX - minX, maxY - minY) * u * rs.weight) / 2;
      const center = transformPoint(model, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      drawRigSpriteBox(renderer, canvas, thirdMesh, model, { center, halfW, halfH }, proj, view, eye);
      return true;
    },

    /** MW-D38: THE ITEM ICON - a Daggerfall item's Morrowind GROUND
     *  mesh, the thing Morrowind itself draws for an icon and a dropped
     *  item, rendered under a three-quarter ortho camera as an image.
     *  Resolves through the ONE item map (weapon type + material, armor
     *  template + material, garment name + dye), so an icon and the
     *  worn piece are the same record. Synchronous: the catalog is the
     *  build's, the parse and the decode are in-memory, the render is
     *  one sprite pass - and the pack can ask per tile without an
     *  onReady dance. Null when no build stands or nothing resolves:
     *  the classic icon stands (never traps). Cached per record, size
     *  and dye per data generation. */
    itemIcon(item, { size = 96 } = {}) {
      if (!(built && built.ok && built.catalog && renderer) || !item) return null;
      const cat = built.catalog;
      let rec = null; let dye = '';
      try {
        if (item.group === 'Weapons') {
          const mwType = dfWeaponToMw(item, WEAPONS);
          if (mwType !== MW_WEAPON_TYPE.None) rec = pickWeaponRecord(cat.weapons, mwType, materialName(item));
        } else if (item.group === 'Armor') {
          rec = mwArmorRecords(cat.armors, item.templateIndex, item.material ?? 0).records[0] ?? null;
        } else if (item.group === 'MensClothing' || item.group === 'WomensClothing') {
          dye = String(item.dye ?? 0);
          // AUDIT 34 F1: the icon measures through the same door the
          // build does, so the icon and the worn piece are ONE record.
          const colourOf = (c) => clothingColourOf(c, cat.parts, cat.archives, cat.gen);
          rec = mwClothingRecord(cat.clothes, CLOTHING_NAME[item.templateIndex], { dye: item.dye ?? 0, colourOf }).record;
        }
      } catch { rec = null; }
      if (!rec || !rec.model) return null;
      const ckey = `${cat.gen}:${rec.id}:${size}:${dye}`;
      if (ITEM_ICON_CACHE.has(ckey)) return ITEM_ICON_CACHE.get(ckey);
      let img = null;
      try {
        const path = `meshes/${rec.model}`;
        const arc = cat.archives.find((a) => a.has(path));
        if (arc) img = renderGroundMesh(arc.get(path).slice(), cat.archives, cat.gen, size);
      } catch { img = null; }
      ITEM_ICON_CACHE.set(ckey, img);
      return img;
    },

    /** MW-D36: THE FIGURE - the third-person body as an image for the
     *  enhanced inventory's panel. Same pieces, same textures, same
     *  race scale as drawThird, framed full-height under a front ortho
     *  camera at the yaw asked for (0 = facing the viewer). Returns
     *  {width, height, data} or null when no third-person body stands -
     *  the panel then keeps the classic doll (never traps). Display
     *  only by Mac's decision: unequip stays with the item list. */
    figure({ yaw = 0, height = 384 } = {}) {
      // AUDIT 33 F1: a built body, not an ACTIVE wheel - the inventory
      // is opened from first person, where the wheel is off.
      if (!(built && built.ok && thirdBuilt && thirdBuilt.ok && renderer)) return null;
      const t = thirdBuilt;
      uploadThirdMesh(t);
      // the figure shows what the body wears, sheathed or drawn, exactly
      // as the wheel's rule 57 does
      for (const r of thirdMesh.ranges) {
        if (r.slot === 'weapon') r.hidden = !weaponShown;
        else if (r.slot === 'arrow') r.hidden = !arrowShown;
      }
      const u = 1 / MW_UNITS_PER_METER;
      const rs = (built && built.raceScale) || { weight: 1, height: 1 };
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const r of armPieceRows(t.arm.pieces)) {
        const b = r.bounds;
        if (!b) continue;
        if (b.minX < minX) minX = b.minX; if (b.maxX > maxX) maxX = b.maxX;
        if (b.minY < minY) minY = b.minY; if (b.maxY > maxY) maxY = b.maxY;
        if (b.minZ < minZ) minZ = b.minZ; if (b.maxZ > maxZ) maxZ = b.maxZ;
      }
      if (!(maxX > minX)) return null;
      // feet at the origin, facing the viewer: drawThird's +180 makes yaw
      // 0 face -Z in pass space, and the eye below sits on +Z.
      const yawDeg = (yaw * 180 / Math.PI) + 180;
      const model = multiply(trs(0, 0, 0, 0, yawDeg, 0, -u * rs.weight, u * rs.height, u * rs.weight), NIF_TO_PASS);
      const halfH = ((maxZ - minZ) * u * rs.height) / 2 * 1.06;
      const halfW = (Math.hypot(maxX - minX, maxY - minY) * u * rs.weight) / 2 * 1.06;
      const center = transformPoint(model, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      const ph = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(height)));
      const pw = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(ph * halfW / halfH)));
      const eye = [center[0], center[1], center[2] + 4];
      const view = lookAt(eye, center, [0, 1, 0]);
      return renderer.renderCharacterSpriteImage(thirdMesh, model, ortho(halfW, halfH, 0.1, 8), view, pw, ph);
    },

    status() {
      return {
        active: active(),
        reason: active() ? 'built' : reason,
        skeletonPath: built && built.skeletonPath,
        pieces: built && built.ok ? built.pieces : 0,
        rows: built && built.rows,
        notes: built && built.notes,
        binding: built && built.binding,
        weapon: built && built.ok ? built.weapon : null,
        spellReady,                       // MW-D39
        casting: upper === UPPER_BODY.Casting,
        raceScale: built && built.ok ? built.raceScale : null,
        worn: built && built.ok ? built.worn : null,
        face: built && built.ok ? built.face : null,
        esm: built && built.esm ? built.esm : null,
        cameraBone: built && built.ok ? built.cameraBone : null,
        reach: built && built.ok ? built.reach : null,
        clip: built && built.ok ? { start: built.clip.startTime, stop: built.clip.stopTime } : null,
        // MW-D12: the card reports the ANIMATION state, because "built"
        // stopped being the whole question the moment there were two
        // clips and a machine between them. A frozen arm now has a name.
        idleGroup,
        weaponGroup,
        upper,
        upperName: UPPER_BODY_NAME[upper],
        aimFactor,
        attackType,
        sheathed,
        sneaking,
        sneakDelta: built && built.ok ? built.sneakDelta : null,
        weaponShown,
        arrowShown,
        arrow: built && built.ok ? built.arrow : null,
        loopsLeft: idleState && Number.isFinite(idleState.loopCount) ? idleState.loopCount : null,
        groups: built && built.ok ? built.groups : null,
        sources: built && built.ok ? built.sourcePaths : null,
        idleSource: idleSource && idleSource.name,
        actionSource: actionSource && actionSource.name,
        // MW-D26: the movement slot, on the card like the others.
        movementGroup,
        movementRate: movementState ? +movementRate.toFixed(3) : null,
        movementSource: movementSource && movementSource.name,
        // MW-D39: the jump slot, on the card like the others.
        jumpGroup,
        jumpKind,
        jumpSource: jumpSource && jumpSource.name,
        clipNotes: notes.slice(-6),
        time: actionState ? actionState.time : (idleState ? idleState.time : null),
        frames,
        // MW-D24: which rig the machine is driving, and the body's own
        // build verdict - a refusal is a sentence on the card, exactly
        // like the arm's.
        viewMode,
        third: thirdBuilt
          ? (thirdBuilt.ok
            ? { ok: true, pieces: thirdBuilt.pieces, skeletonPath: thirdBuilt.skeletonPath,
                weapon: thirdBuilt.weapon, groups: thirdBuilt.groups ? thirdBuilt.groups.length : 0 }
            : { ok: false, stage: thirdBuilt.stage, error: thirdBuilt.error })
          : null,
      };
    },

    /** Probe readbacks. Every one runs THIS module's own code - a probe
     *  with its own copy measures the copy. */
    rows: () => (built && built.ok ? armPieceRows(built.arm.pieces).map((r) => ({ ...r })) : null),
    /** The GPU mesh, for the pins that have to see the RANGES - which
     *  piece is hidden, and that the list never changes length. */
    mesh: () => mesh,
    /** The build result, for pins that must pose the REAL assembly
     *  rather than a re-implementation of it. A probe with its own copy
     *  measures the copy. */
    built: () => built,
    trace({ dt = 0.2, steps = 40, loopCount = 2, group = null } = {}) {
      if (!built || !built.ok) return null;
      const s2 = resetClip(built.keys, group || idleGroup, { loopCount, loopFallback: true });
      if (!s2.ok) return null;
      const out = [];
      for (let i = 0; i < steps && s2.playing; i++) {
        advanceClip(s2, built.keys, dt, null);
        poseAssembly(built.arm, {
          tracks: built.tracks, sampleTrack, time: s2.time, accumRoot: built.accumRoot,
        });
        const rh = armPieceRows(built.arm.pieces).find((r) => r.bone === 'right hand');
        out.push({
          time: s2.time,
          playing: s2.playing,
          loopStartTime: s2.loopStartTime,
          loopStopTime: Number.isFinite(s2.loopStopTime) ? s2.loopStopTime : null,
          rightHandMaxX: rh && rh.bounds ? rh.bounds.maxX : null,
        });
      }
      return out;
    },
  };
  return api;
}

export const fpArm = createFpArm();
