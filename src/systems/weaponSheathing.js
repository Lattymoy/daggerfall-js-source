// @ts-check
// WS1 (2026-09-17, Mac: "Can we implement this for the morrowind model" -
// Greatness7's WEAPON SHEATHING 1.6, the OpenMW archive). THE LAW, ONE
// HOME. The mod is two things: ART (seventy-one `_sh` scabbard meshes
// and three skeleton addons, vendored under vendor/weapon-sheathing/ -
// the assets module serves them) and a MECHANISM, which on OpenMW is the
// engine's own (`weapon sheathing = true` + `use additional anim
// sources = true`; the mod's readme credits "akortunov and the OpenMW
// team" for it). This module is the port of that mechanism, read off
// the reference where the port already cites it (actoranimation.cpp
// updateHolsteredWeapon / updateQuiver, weapontype.cpp's sheathing
// bones, animation.cpp injectCustomBones) and off the files themselves
// where the reference's exact visitor was not to hand (the injection
// rule is recorded as the FILES dictate it - Morrowind-Rules.md WS1).
//
//   1. THE BONES. Every .nif under `animations/<model>/` is a bone
//      addon: the skeleton takes its unknown nodes under the node of
//      their parent's name (mwSkin.js injectSkeletonNodes). Weapon
//      Sheathing's `xbase_anim_sh.nif` brings fourteen: twelve
//      sheathing bones, "Bip01 AttachShield" and "Bip01 AttachWeapon".
//   2. THE HOLSTER. A sheathed weapon of type T hangs at SHEATHING_BONE[T]
//      (the type's mSheathingBone). If `<model>_sh.nif` exists it is the
//      SCABBARD: the whole file attaches at that bone and stays; its
//      "Bip01 Weapon" node is masked while the weapon is drawn, and if
//      that node is EMPTY the base weapon mesh is instanced under it
//      (the author tweaks the position without shipping the blade). No
//      `_sh` file: the base mesh itself hangs at the bone, shown while
//      sheathed. Thrown weapons never holster ("they stack").
//   3. THE QUIVER. A scabbard carrying "Bip01 Ammo" takes one instance of
//      the equipped ammunition's mesh under each "Bip01 Ammo N" child,
//      min(count, children) of them - arrows for a bow, bolts for a
//      crossbow, the thrown stack for a thrown weapon.
//
// Third person only: the first-person skeleton has no addon (the mod
// ships none for xbase_anim.1st) and the reference draws no holster
// there either. The pieces are rigid parts through the same binder the
// weapon takes (bindPartsInto), but BARE (AUDIT-WS F6): the reference's
// attachMesh is a plain getInstance under the bone, so no BoneOffset and
// no mirror ride a holstered mesh - and no sheathing bone is "Left".

import { MW_WEAPON_TYPE, ammoTypeFor } from '../formats/mwFirstPerson.js';
import { findNodeByName, nodeTransformOf } from '../formats/mwCharacter.js';
import { deref } from '../formats/mwNifFile.js';

/** weapontype.cpp's mSheathingBone column: the addon's node for each type. */
export const SHEATHING_BONE = Object.freeze({
  [MW_WEAPON_TYPE.ShortBladeOneHand]: 'Bip01 ShortBladeOneHand',
  [MW_WEAPON_TYPE.LongBladeOneHand]: 'Bip01 LongBladeOneHand',
  [MW_WEAPON_TYPE.LongBladeTwoHand]: 'Bip01 LongBladeTwoClose',
  [MW_WEAPON_TYPE.BluntOneHand]: 'Bip01 BluntOneHand',
  [MW_WEAPON_TYPE.BluntTwoClose]: 'Bip01 BluntTwoClose',
  [MW_WEAPON_TYPE.BluntTwoWide]: 'Bip01 BluntTwoWide',
  [MW_WEAPON_TYPE.SpearTwoWide]: 'Bip01 SpearTwoWide',
  [MW_WEAPON_TYPE.AxeOneHand]: 'Bip01 LongBladeOneHand',   // AUDIT-WS F1: weapontype.hpp:115 - the one-handed axe sheathes at the long blade's bone (the addon carries a "Bip01 AxeOneHand" too, at the same transform, that the reference never names)
  [MW_WEAPON_TYPE.AxeTwoHand]: 'Bip01 AxeTwoClose',
  [MW_WEAPON_TYPE.MarksmanBow]: 'Bip01 MarksmanBow',
  [MW_WEAPON_TYPE.MarksmanCrossbow]: 'Bip01 MarksmanCrossbow',
  [MW_WEAPON_TYPE.MarksmanThrown]: 'Bip01 MarksmanThrown',
});
/** The scabbard file's three named nodes. */
export const SHEATH_WEAPON_NODE = 'Bip01 Weapon';
export const SHEATH_AMMO_NODE = 'Bip01 Ammo';
/** The piece slots the rig hides by: the holster shows while sheathed, the rest always. */
export const HOLSTER_SLOTS = Object.freeze(['holster', 'sheath', 'quiver']);

/** `meshes/w/w_saber.nif` -> `meshes/w/w_saber_sh.nif` (addSuffixBeforeExtension). */
export function sheathedMeshPath(model) {
  const p = String(model || '');
  const dot = p.lastIndexOf('.');
  if (dot <= p.lastIndexOf('/')) return p ? `${p}_sh` : '';
  return `${p.slice(0, dot)}_sh${p.slice(dot)}`;
}

/** The addon folder a model's bones come from: `meshes/xbase_anim.nif`
 *  -> `animations/xbase_anim/` (the reference swaps the first path
 *  segment and drops the extension). */
export function animationsDirOf(model) {
  let p = String(model || '').replace(/\\/g, '/').toLowerCase();
  if (p.startsWith('meshes/')) p = `animations/${p.slice(7)}`;
  const dot = p.lastIndexOf('.');
  if (dot > p.lastIndexOf('/')) p = p.slice(0, dot);
  return `${p}/`;
}

/** Every .nif the archives carry under the base model's and the actor's
 *  own addon folders, base first, each once - the two calls the
 *  reference makes (the base xbase_anim and then the actor's model). An
 *  archive lists through `list()` (a .bsa) or `names` (the loose and the
 *  vendored ducks); one that lists nothing offers nothing. */
export function boneSourcesFor(baseModel, skeletonPath, archives) {
  const dirs = [animationsDirOf(baseModel)];
  const own = animationsDirOf(skeletonPath);
  if (own !== dirs[0]) dirs.push(own);
  const out = [];
  const seen = new Set();
  for (const dir of dirs) {
    for (const arc of archives ?? []) {
      const names = typeof arc.list === 'function' ? arc.list() : (arc.names ?? []);
      for (const raw of names) {
        const n = String(raw).replace(/\\/g, '/').toLowerCase();
        if (n.startsWith(dir) && n.endsWith('.nif') && !seen.has(n)) { seen.add(n); out.push(n); }
      }
    }
  }
  return out;
}

/** Is the holstered weapon itself SHOWN for this type? Thrown weapons
 *  stack, so the reference forces showHolsteredWeapons off for them
 *  (actoranimation.cpp:333-336) - the scabbard, if one exists, still
 *  attaches; the weapon node in it, or the bare mesh, never shows. */
export const holsters = (mwType) => SHEATHING_BONE[mwType] != null && mwType !== MW_WEAPON_TYPE.MarksmanThrown;

/** The archive paths resolveHolsterParts will read, for the one preload
 *  round (weaponPartPaths' twin): the scabbard, and nothing else - the
 *  weapon and ammunition meshes are the weapon resolve's own. */
export function holsterPartPaths({ weaponModel }) {
  return weaponModel ? [sheathedMeshPath(`meshes/${weaponModel}`)] : [];
}

/**
 * The holster's parts for the third-person body. `weaponBytes` is the
 * base mesh already in hand (resolveWeaponParts read it), `ammo` the
 * resolved ammunition `{ bytes, type }` or null, `ammoCount` the stack.
 * `find(path)` answers the archive holding a loaded path, `hasBone`
 * asks the skeleton AFTER its addons. `parseNif` is passed in so this
 * module stays a leaf of the format layer's parser.
 *
 * @returns {{ parts: object[], info: object|null, notes: string[] }}
 */
export function resolveHolsterParts({ mwType, weaponModel, weaponBytes, ammo = null, ammoCount = 0, find, hasBone, parseNif }) {
  const notes = [];
  const parts = [];
  if (mwType == null || mwType === MW_WEAPON_TYPE.None || !weaponModel || !weaponBytes) return { parts, info: null, notes };
  const bone = SHEATHING_BONE[mwType];
  if (!bone) return { parts, info: null, notes };
  const showHolstered = holsters(mwType);   // AUDIT-WS F3: thrown - the scabbard alone
  if (!hasBone(bone)) {
    notes.push(`holster: this skeleton has no "${bone}" - no bone addon (animations/xbase_anim/xbase_anim_sh.nif) was found`);
    return { parts, info: { bone, reason: 'no sheathing bone' }, notes };
  }
  const shPath = sheathedMeshPath(`meshes/${weaponModel}`);
  const shArc = find(shPath);
  if (!shArc) {
    // No scabbard: the weapon's own mesh hangs at the bone while sheathed
    // (:352-360) - and for a thrown weapon nothing at all.
    if (showHolstered) parts.push({ slot: 'holster', bones: [bone], bytes: weaponBytes, bare: true });
    return { parts, info: { bone, scabbard: null, weaponNode: false, thrown: !showHolstered }, notes };
  }
  const shBytes = shArc.get(shPath).slice();
  let shNif;
  try { shNif = parseNif(shBytes); } catch (err) {
    notes.push(`holster: ${shPath}: ${err.message}`);
    if (showHolstered) parts.push({ slot: 'holster', bones: [bone], bytes: weaponBytes, bare: true });
    return { parts, info: { bone, scabbard: null, weaponNode: false, thrown: !showHolstered }, notes };
  }
  const weaponNode = findNodeByName(shNif, SHEATH_WEAPON_NODE);
  if (!weaponNode) {
    // The reference attaches the file and returns: no node to mask, so
    // the whole scabbard stands whatever the hand does, and no holster.
    parts.push({ slot: 'sheath', bones: [bone], bytes: shBytes, bare: true });
    return { parts, info: { bone, scabbard: shPath, weaponNode: false, thrown: !showHolstered }, notes };
  }
  // The scabbard, less the weapon node; then the weapon node's own
  // geometry, or the base mesh instanced under an empty one.
  // AUDIT-WS F6: EVERY holster part is a BARE instance. The scabbard and
  // the fallback mesh go through attachMesh (actoranimation.cpp:66-83) -
  // `getInstance(model, parent)`, no SceneUtil::attach, so no BoneOffset
  // and no mirror - unlike the weapon in the hand. A retail weapon mesh
  // that carries a BoneOffset node hangs at the sheathing bone WITHOUT it.
  parts.push({ slot: 'sheath', bones: [bone], bytes: shBytes, excludeNode: SHEATH_WEAPON_NODE, bare: true });
  // The weapon node's children (the Crescent's is a NiBSAnimationNode
  // with five shapes under it). A GEOMETRY record named "Bip01 Weapon"
  // is not found at all - findNodeByName's recorded delta (mwCharacter.js:
  // a NiTriShape answers null where the reference's visitor matches its
  // MatrixTransform) - and the file then stands whole; no vendored file
  // names a shape so.
  const weaponKids = (weaponNode.rec.children ?? []).filter((c) => c >= 0).length;
  if (!showHolstered) {
    // thrown: the weapon node is masked whatever the hand does (:375-378 with showHolsteredWeapons forced false)
  } else if (weaponKids > 0) {
    parts.push({ slot: 'holster', bones: [bone], bytes: shBytes, underNode: SHEATH_WEAPON_NODE, bare: true });
  } else {
    parts.push({ slot: 'holster', bones: [bone], bytes: weaponBytes, preTransform: nodeTransformOf(shNif, SHEATH_WEAPON_NODE), bare: true, inheritOffsetFrom: 'sheath' });
  }
  // The quiver.
  let quiver = 0;
  const ammoNode = findNodeByName(shNif, SHEATH_AMMO_NODE);
  if (ammoNode && ammo?.bytes) {
    const wanted = mwType === MW_WEAPON_TYPE.MarksmanThrown ? mwType : ammoTypeFor(mwType);
    const suitable = wanted !== MW_WEAPON_TYPE.None && ammo.type === wanted;
    if (suitable) {
      const slots = (ammoNode.rec.children ?? []).filter((c) => c >= 0);
      const n = Math.min(Math.max(0, Math.floor(Number(ammoCount) || 0)), slots.length);   // never `| 0`: a full quiver is asked for with MAX_SAFE_INTEGER
      for (let i = 0; i < n; i++) {
        const child = /** @type {any} */ (deref(shNif, slots[i]));
        const name = child?.name || `${SHEATH_AMMO_NODE} ${i}`;
        // AUDIT-WS F4: the tag is the slot's index and the count, so the
        // rig can empty the LAST slot while a round is on the string
        // (updateQuiver's `ammoCount--` when isArrowAttached, :441-443,
        // re-run at every attach, release and detach - npcanimation.cpp
        // :1062-1074).
        parts.push({ slot: 'quiver', bones: [bone], bytes: ammo.bytes, preTransform: nodeTransformOf(shNif, name), bare: true, inheritOffsetFrom: 'sheath', tag: { i, n } });
        quiver++;
      }
    }
  }
  return { parts, info: { bone, scabbard: shPath, weaponNode: true, weaponNodeEmpty: weaponKids === 0, quiver, thrown: !showHolstered }, notes };
}

/** The rig's hide law for the three slots, in one place: the holster
 *  shows while the weapon is NOT shown in the hand (showWeapons ->
 *  updateHolsteredWeapon(!mShowWeapons), npcanimation.cpp:992); the
 *  scabbard always; the quiver always, except its LAST slot while a
 *  round is on the string (AUDIT-WS F4: `tag` is the part's { i, n }). */
export function holsterHidden(slot, weaponShown, { arrowShown = false, tag = null } = {}) {
  if (slot === 'holster') return !!weaponShown;
  if (slot === 'sheath') return false;
  if (slot === 'quiver') return !!(arrowShown && tag && tag.i === tag.n - 1);
  return null;
}

/** WS1's archive door. MOVED to `systems/urlArchive.js` at FIELD-GUN-MW2,
 *  when the port's own Morrowind assets became its second caller, and
 *  RE-EXPORTED here so every existing import still resolves - one home,
 *  both names, which is the same shape `server/src/relay.js` uses for
 *  the wire. */
export { makeVendoredArchive } from './urlArchive.js';

/** `vendor/weapon-sheathing/Data Files/Meshes/w/x_sh.nif` -> `meshes/w/x_sh.nif`:
 *  the canonical data-files path the loose store keys by. */
export function vendoredDataPath(file) {
  const p = String(file).replace(/\\/g, '/').toLowerCase();
  const at = p.indexOf('data files/');
  return at >= 0 ? p.slice(at + 'data files/'.length) : p.slice(p.lastIndexOf('/') + 1);
}
