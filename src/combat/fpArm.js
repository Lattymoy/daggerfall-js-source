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

import { lookAt, perspective, trs, mirrorProjectionX } from '../world/mat4.js';
import { CHAR_PIXEL, CHAR_SPRITE_RT_SIZE } from '../render/renderer.js';
import {
  sampleTrack, resetClip, advanceClip, getTextKeyTime,
} from '../formats/mwAnim.js';
import { accumRootRef, buildSkeleton } from '../formats/mwSkin.js';
import { nodeTransformOf } from '../formats/mwCharacter.js';
import { parseNif } from '../formats/mwNifFile.js';
import {
  assembleFirstPersonArm, poseAssembly, armPieceRows, clipReport, clipUnionBounds,
  armReport, armMeshPaths, bodyParts,
  weaponRecords, dfWeaponToMw, pickWeaponRecord, weaponAttachBone, MW_WEAPON_TYPE,
  ammoTypeFor, arrowAttachBone, ARROW_FALLBACK_NODE, reloadsItself, shootsRatherThanSwings,
  firstPersonCameraRef, composeStanceGroup, composeWeaponGroup, mwAttackType, attackKeys,
  weaponShortGroup, calculateWindUp, releaseStartPoint, EQUIP_KEYS, UNEQUIP_KEYS,
  aimingFactor, fpAnimSources, pickAnimSource, anySourceHasGroup, FP_BASE_MODEL, animSourceName,
  gmstValue, GMST_SNEAK_DELTA, sneakOffset,
} from '../formats/mwFirstPerson.js';
import { WEAPONS } from '../characters/weapons.js';
import { correctTexturePath, correctActorModelPath, wrapModes, warningImage } from '../formats/mwTexture.js';
import { decodeDds } from '../formats/mwDdsFile.js';
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
export function animWeaponType(mwType, sheathed) {
  if (sheathed) return MW_WEAPON_TYPE.None;
  return mwType === MW_WEAPON_TYPE.None ? MW_WEAPON_TYPE.HandToHand : mwType;
}

/** CharacterController::UpperBodyState (character.hpp:107-117), in its own
 *  order. Casting is out of scope for this slice - Daggerfall's spell
 *  hand is the port's own viewmodel - and is absent rather than aliased,
 *  because an enum with a member the code never reaches is a lie the next
 *  reader has to disprove. */
export const UPPER_BODY = Object.freeze({
  None: 0,
  Equipping: 1,
  Unequipping: 2,
  WeaponEquipped: 3,
  AttackWindUp: 4,
  AttackRelease: 5,
  AttackEnd: 6,
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
export const accurateAiming = (upper) => upper > UPPER_BODY.WeaponEquipped;

/** AnimState::getCompletion - the fraction of [startTime, stopTime] the
 *  playhead has covered. refreshIdleAnims feeds it straight back in as
 *  the next play's startPoint (:822-825), so a finished idle restarts AT
 *  ITS OWN END and the loop window immediately wraps it. That is not a
 *  bug being reproduced; it is why a re-armed idle does not visibly
 *  stutter back to the beginning. */
export function clipCompletion(state) {
  if (!state) return 0;
  const span = state.stopTime - state.startTime;
  if (!(span > 0)) return 0;
  return Math.min(1, Math.max(0, (state.time - state.startTime) / span));
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

export async function buildFpArm({
  race, female = false, beast = false, weapon = null, hasAmmo = false, deps = null,
} = {}) {
  const d = deps || await import('../scenes/dataSource.js');
  const settingsSkeleton = fpSkeletonPath({ female, beast });
  let skeletonPath = settingsSkeleton;
  try {
    const archives = await d.loadMorrowindArchives();
    if (!archives.length) return { ok: false, stage: 'data', error: 'no Morrowind .bsa attached' };
    // MW-D14 / RULE 18: the settings name is not the final name. The
    // x-form is used only when its .kf is in the archive, which for a
    // male is never (the entry is already x-form, so the insert yields
    // "xx") and for a female or a beast is the whole question.
    skeletonPath = correctActorModelPath(settingsSkeleton, (p) => archives.some((a) => a.has(p)));

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
    // bodyParts(), not loadMorrowindEsm(). The store's parseEsm door
    // returns mwEsmFile's body shape; armReport wants bodyParts' shape;
    // there is no adapter and writing one by guess inside this slice is
    // exactly how MW7 died. Raw bytes through the pinned path instead.
    const parts = esmBytes.flatMap((e) => bodyParts(e.bytes));
    // RULE 32(a)'s GMST, read from the player's own data. Later masters
    // override earlier ones, so the LAST .esm that carries it wins -
    // which is the load order, not a preference.
    let sneakDelta = null;
    for (const e of esmBytes) {
      const v = gmstValue(e.bytes, GMST_SNEAK_DELTA);
      if (typeof v === 'number') sneakDelta = v;
    }

    const find = (p) => archives.find((a) => a.has(p));
    const skelArc = find(skeletonPath);
    if (!skelArc) return { ok: false, stage: 'skeleton', error: `${skeletonPath} is not in your archives` };
    const skeletonBytes = skelArc.get(skeletonPath).slice();

    const rows = armReport(parts, race, female);
    const wanted = armMeshPaths(rows);
    const partBytes = [];
    const missing = [];
    for (const w of wanted) {
      if (!w.path) { missing.push(`${w.slot}: no record for this actor`); continue; }
      const arc = find(w.path);
      if (!arc) { missing.push(`${w.slot}: ${w.path} is not in your archives`); continue; }
      partBytes.push({ slot: w.slot, bytes: arc.get(w.path).slice() });
    }
    // MW-D9: THE WEAPON, and it needs no new attach path at all.
    //
    // A Morrowind weapon is a RIGID part at a bone - rule 12's rigid
    // half, the same path armcuff has proved since MW-D6 - so it rides
    // in as one more part with an explicit `bones` override instead of
    // the PART_BONES table. Rule 17 is that override: the generic
    // "Weapon Bone" is replaced by the equipped type's own attach bone
    // when the actor has that node, which is how a bow reaches
    // "Weapon Bone Left" (rule 8).
    //
    // AND THE BOW COMES OUT MIRRORED, which is faithful and surprising
    // enough to write down before someone "fixes" it. Rule 13's mirror is
    // a SUBSTRING TEST on the attach bone's name
    // (SceneUtil::attach, components/sceneutil/attach.cpp:166-181), and
    // that function is the generic attach path for every part - weapons
    // included, not body parts only. "Weapon Bone Left" contains "Left",
    // so the bow is drawn with X negated by exactly the same rule that
    // mirrors the left hand. Nothing here special-cases it.
    const weaponNotes = [];
    let weaponInfo = null;
    let arrowInfo = null;
    const mwType = dfWeaponToMw(weapon, WEAPONS);
    if (mwType !== MW_WEAPON_TYPE.None) {
      const allWeapons = esmBytes.flatMap((e) => weaponRecords(e.bytes));
      const rec = pickWeaponRecord(allWeapons, mwType, weapon && weapon.materialName);
      if (!rec) {
        weaponNotes.push(`weapon: your archives carry no unenchanted Morrowind weapon of type ${mwType}`);
      } else {
        const path = `meshes/${rec.model}`;
        const arc = find(path);
        if (!arc) weaponNotes.push(`weapon: ${path} (${rec.id}) is not in your archives`);
        else {
          const bone = weaponAttachBone(mwType);
          const weaponBytes = arc.get(path).slice();
          partBytes.push({ slot: 'weapon', bones: [bone], bytes: weaponBytes });
          weaponInfo = { id: rec.id, name: rec.name, model: rec.model, type: mwType, bone };

          // MW-D16 / RULE 24's ARROW. A drawn bow with no round on it is
          // what the port has been drawing; the reference instances the
          // AMMUNITION SLOT's model under getArrowBone() at the
          // "shoot attach" key.
          const ammoType = ammoTypeFor(mwType);
          if (ammoType !== MW_WEAPON_TYPE.None && hasAmmo) {
            const ammoRec = pickWeaponRecord(allWeapons, ammoType);
            if (!ammoRec) {
              weaponNotes.push(`arrow: your archives carry no unenchanted Morrowind ammunition of type ${ammoType}`);
            } else {
              const ammoPath = `meshes/${ammoRec.model}`;
              const ammoArc = find(ammoPath);
              if (!ammoArc) weaponNotes.push(`arrow: ${ammoPath} (${ammoRec.id}) is not in your archives`);
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
                  weaponNotes.push(`arrow: neither this skeleton's "${skelBone}" bone nor an `
                    + `"${ARROW_FALLBACK_NODE}" node in ${weaponInfo.model} - nowhere to put it`);
                } else {
                  partBytes.push({
                    slot: 'arrow', bones: [arrowBone], bytes: ammoArc.get(ammoPath).slice(), preTransform: pre,
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
      weaponNotes.push('weapon: Morrowind has no weapon type for what you are holding');
    }

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
    const textures = arm.ok ? collectArmTextures(arm.pieces, archives) : new Map();
    archives.length = 0;   // release the mapped archives; the bytes we need are copied
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
      const one = await clipReport({ kfBytes: sb.bytes, skeleton: arm.skeleton, group: FP_IDLE_BASE });
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

    return {
      ok: true,
      arm,
      tracks,
      accumRoot,
      keys: idlePick.source.keys,
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
      esm: esmDiagnosis(esmNames, parts, race),
      notes: [...missing, ...weaponNotes, ...(arm.notes || [])],
      binding: idlePick.source.binding,
      pieces: armPieceRows(arm.pieces).length,
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
export function collectArmTextures(pieces, archives) {
  const out = new Map();
  const exists = (p) => archives.some((a) => a.has(p));
  for (const piece of pieces ?? []) {
    const file = piece.material && piece.material.textureFile;
    if (!file || out.has(file)) continue;
    const path = correctTexturePath(file, exists);
    const arc = archives.find((a) => a.has(path));
    if (!arc) {
      out.set(file, { ok: false, path, error: 'not in your archives', image: warningImage() });
      continue;
    }
    try {
      out.set(file, { ok: true, path, image: decodeDds(arc.get(path).slice()) });
    } catch (err) {
      out.set(file, { ok: false, path, error: err.message, image: warningImage() });
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
  let mesh = null;
  let packed = null;
  let reason = 'not built';
  let frames = 0;
  let busy = false;

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
  let upper = UPPER_BODY.None;
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

  const active = () => !!(built && built.ok && mesh && renderer && camera && (actionState || idleState));

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
  const ready = () => !!(built && built.ok && (actionState || idleState) && renderer);

  function releaseMesh() {
    if (mesh && renderer && renderer.gl) {
      const gl = renderer.gl;
      gl.deleteVertexArray(mesh.vao);
      for (const b of mesh.buffers || []) gl.deleteBuffer(b);
      // MW-D11: the textures go with the mesh that owns them. An arm
      // rebuilt on every attach would otherwise leak one upload per
      // piece per build, which is the shape of NT1's teardown leaks.
      for (const r of mesh.ranges || []) if (r.tex) gl.deleteTexture(r.tex);
    }
    mesh = null;
  }

  // hasAnimation: ANY source names the group (animation.cpp). WHICH
  // source plays it is a separate question, answered in reverse below.
  const hasGroup = (n) => !!built && anySourceHasGroup(built.sources, n);

  /** The source currently posing the arm - the one that won the clip
   *  being drawn, because its tracks are the ones the pose reads. */
  let poseSource = null;

  /** The file's time for a key of the CURRENT weapon group, as
   *  getTextKeyTime is always called (character.cpp:1241): the group, a
   *  colon-space, and the action. -1 when the file has no such key. */
  const keyTime = (action) => (weaponGroup && built
    ? getTextKeyTime(built.keys, `${weaponGroup}: ${action}`) : -1);

  /** Play a section of the weapon group. Returns FALSE and leaves the
   *  slot empty when the file has no such window - it never substitutes
   *  a different one, because a substituted attack animation is the
   *  reverted arc's whole failure mode in miniature. */
  function playAction(start, stop, startPoint = 0) {
    if (!built || !weaponGroup) return false;
    const pick = pickAnimSource(built.sources, weaponGroup, resetClip, { start, stop, startPoint });
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
    const type = animWeaponType(built.mwType, sheathed);
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
    const pick = pickAnimSource(built.sources, composed.group, resetClip,
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

  /** Rule 9's long group for the CURRENT stance, and the equip/unequip
   *  and attack sections all live in it. */
  function refreshWeaponGroup() {
    if (!built || !built.ok) { weaponGroup = null; return; }
    const type = animWeaponType(built.mwType, sheathed);
    weaponGroup = composeWeaponGroup(type, hasGroup).group;
  }

  /** ANIMATION::HANDLETEXTKEY's first-person consequences. Rule 47's
   *  group test is `mine` - a key of another group crossed by this
   *  playhead is not this animation's business. */
  function onActionKey(text, time, mine) {
    if (!mine || !weaponGroup) return;
    const action = text.slice(weaponGroup.length + 2);
    // showWeapons(true/false) at the attach/detach keys
    // (character.cpp:1468-1472, :1481-1483).
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
    const startPoint = releaseSkip(built.keys, weaponGroup, attackType, attackStrength);
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
      default:
        if (actionState) actionState = null;
        break;
    }
  }

  return {
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
        built = res;
        packed = null;
        idleState = null; actionState = null; idleGroup = null; weaponGroup = null;
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
      } finally { busy = false; }
    },

    unload() {
      releaseMesh(); built = null; packed = null;
      idleState = null; actionState = null; idleGroup = null; weaponGroup = null;
      upper = UPPER_BODY.None; attackType = null; holdWindUp = false;
      weaponShown = false; arrowShown = false;
      notes.length = 0; aimFactor = 0; sneaking = false;
      idleSource = null; actionSource = null; poseSource = null;
      reason = 'unloaded';
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
        if (upper === UPPER_BODY.None || !weaponGroup) {
          sheathed = true; weaponShown = false; arrowShown = false;
          refreshWeaponGroup(); refreshIdle(true);
          return true;
        }
        upper = UPPER_BODY.Unequipping;
        // If the file has no "unequip detach" key the weapon is hidden
        // by hand, immediately (:1481-1483).
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
      // refreshCurrentAnims' order, and it is not arbitrary: the weapon
      // state is stepped FIRST because the idle refresh below depends on
      // it - "idle handled last as it can depend on the other states"
      // (character.cpp:842).
      if (actionState) {
        advanceClip(actionState, built.keys, dt, onActionKey);
        stepUpper();
      }
      if (idleState) advanceClip(idleState, built.keys, dt, null);
      refreshIdle();
      aimFactor = aimingFactor(aimFactor, accurateAiming(upper), dt);
      if (!actionState && !idleState) return;
      // THE WINNER, not a blend. See the two-slot note above: in first
      // person both animations are played on BlendMask_All, so the higher
      // priority takes every bone for as long as it is playing.
      const state = actionState || idleState;
      // MW-D14: and the TRACKS come from the same file as the clip. A
      // female actor can win her idle from xbase_anim_female.1st.kf and
      // her swing from the base xbase_anim.1st.kf, and posing one with
      // the other's tracks is a bind pose with no error.
      poseSource = actionState ? actionSource : idleSource;
      // Rule 54's neck: the camera node hangs off "bip01 neck", so the
      // pitch has to be in the pose before any matrix is composed - the
      // eye MOVES with the look, it is not a lens tilt.
      const cam = camera && camera();
      sneaking = !!(cam && cam.sneaking);
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
        neckPitch: cam ? -(cam.pitch || 0) : 0,
        // MW-D13: and the factor that pitch is multiplied by, which is
        // not the constant 0.75 this passed before. Stepped HERE, once
        // per frame, because mAimingFactor is a decaying state.
        neckAim: aimFactor,
        // Rule 32(a): the whole body sinks by i1stPersonSneakDelta in -Z
        // while sneaking, through the neck - so the Camera bone goes with
        // it and the eye drops too, which is the point of doing it here
        // rather than at the lens.
        neckOffset: sneakOffset(sneaking, built.sneakDelta),
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
      // Animation::showWeapons, and it HIDES rather than removes - which
      // is rule 57's own distinction and the reason it is a per-range
      // flag and not a shorter vertex stream. Repacking without the
      // weapon would change the buffer's length every time you drew or
      // sheathed, orphaning the ranges the textures hang on.
      for (const r of mesh.ranges) {
        if (r.slot === 'weapon') r.hidden = !weaponShown;
        else if (r.slot === 'arrow') r.hidden = !arrowShown;
      }
      frames++;
    },

    draw(canvas) {
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
      // The neck has already taken 0.75 of the pitch (poseAssembly), so
      // the eye has MOVED with the look; the lens takes all of it, which
      // is the lag you feel when you glance down at your hands.
      const pitch = cam.pitch || 0;
      const fwd = [0, Math.sin(pitch), -Math.cos(pitch)];
      const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);

      // AND IT RIDES THE HANDEDNESS MIRROR, which the viewmodel pass
      // this technique was borrowed from does not.
      //
      // mat4's law: a right-handed lookAt puts world +x on screen-LEFT,
      // which is the mirror image the port presented until M1 - every
      // town flipped east-west, every sign reading backwards. The fix is
      // ONE mirror at the projection, and EVERY world pass rides it. The
      // voxel viewmodel was left out with the reason given as "its pass
      // never culls" - why it was SAFE to leave, not a claim it was right.
      //
      // For an arm it is the whole thing: measured, a point one metre to
      // the player's RIGHT lands at NDC x -1.96 through the unmirrored
      // pass and +1.96 through a world pass. Your sword hand would be on
      // the wrong side of the screen and every left hand a right one, and
      // no picture says so, because an arm looks like an arm either way.
      //
      // Mirroring is free for the reason the original note gives:
      // drawCharacter disables back-face culling (renderer.js), so the
      // winding flip a negative-x scale causes costs nothing.
      //
      // The planes are in RIG UNITS and come off the arm's own reach, so
      // a file authored at any scale is framed by its own geometry
      // rather than by a constant that assumes metres.
      const proj = mirrorProjectionX(
        perspective(FP_FIELD_OF_VIEW, pw / ph, Math.max(built.reach / 200, 1e-4), built.reach * 4),
      );
      const tex = renderer.renderCharacterSprite(mesh, NIF_TO_PASS, proj, view, pw, ph);
      renderer.drawScreenOverlayQuad(tex, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);
      return true;
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
        clipNotes: notes.slice(-6),
        time: actionState ? actionState.time : (idleState ? idleState.time : null),
        frames,
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
}

export const fpArm = createFpArm();
