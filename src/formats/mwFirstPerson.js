// MW-D: THE DIAGNOSTIC, and it deliberately draws nothing.
//
// The Morrowind import arc was reverted whole on 2026-08-28 after three
// "fixes" that all failed. Every one failed the same way: a rule was
// guessed, verified against a fixture built from the same guess, and
// reported working. The reverted rig hardcoded `meshes\base_anim.1st.nif`
// - a name that appears NOWHERE in OpenMW's skeleton table, because
// base_anim.nif is the THIRD-person skeleton (bible/02-Formats/
// Morrowind-Rules.md, rule 6). Nothing ever said so out loud; the layer
// just fell back to the sprite for ever.
//
// So this module is the thing that should have existed first. It opens the
// player's OWN archives and reports what is genuinely inside them. It
// renders nothing, so it cannot be wrong about rendering, and every answer
// it gives is a fact about their files rather than a claim about ours.
//
// Every parse below cites the rule it implements. Where a routine is a
// HEURISTIC rather than a parse, it says so in its own name and its own
// output - the one thing this module must never do is sound certain.

/** Rule: Part V - the Morrowind BSA directory is ONE contiguous block.
 *  12-byte header of 3 uint32 LE (id must be 0x100, dirsize, filenum);
 *  then 3*filenum uint32 read as ONE run, indexed [i*2] size,
 *  [i*2+1] offset, [2*filenum + i] name offset; then the string buffer of
 *  (dirsize - 12*filenum) bytes of NUL-terminated names; then an
 *  8*filenum hash table WHICH THE ENGINE READS AND IGNORES. File data
 *  begins at 12 + dirsize + 8*filenum and every stored offset is relative
 *  to that. (components/bsa/bsafile.cpp:77-205) */
export function parseBsaIndex(bytes) {
  const size = bytes.byteLength;
  if (size < 12) throw new Error('file too small to be a BSA (under 12 bytes)');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, size);
  const id = dv.getUint32(0, true);
  if (id !== 0x100) {
    throw new Error(`not a Morrowind BSA: header id is 0x${id.toString(16)}, expected 0x100`);
  }
  const dirsize = dv.getUint32(4, true);
  const filenum = dv.getUint32(8, true);

  // The engine's own corruption checks, copied rather than invented.
  if (filenum * 21 > size - 12) throw new Error('directory larger than the archive (file count)');
  if (dirsize + 8 * filenum > size - 12) throw new Error('directory larger than the archive (dir size)');

  const tableBytes = 12 * filenum;
  const stringStart = 12 + tableBytes;
  const stringLen = dirsize - tableBytes;
  if (stringLen < 0) throw new Error('directory smaller than its own offset table');
  const dataStart = 12 + dirsize + 8 * filenum;

  const u32 = (i) => dv.getUint32(12 + i * 4, true);
  const files = [];
  for (let i = 0; i < filenum; i++) {
    const fileSize = u32(i * 2);
    const offset = u32(i * 2 + 1) + dataStart;
    const nameOffset = u32(2 * filenum + i);
    if (nameOffset >= stringLen) throw new Error(`name offset outside the string buffer (entry ${i})`);
    let end = stringStart + nameOffset;
    while (end < stringStart + stringLen && bytes[end] !== 0) end++;
    if (end >= stringStart + stringLen) throw new Error(`unterminated name (entry ${i})`);
    files.push({
      // Rule: VFS normalisation is backslash -> slash then ASCII lowercase.
      name: latin1(bytes.subarray(stringStart + nameOffset, end)).replace(/\\/g, '/').toLowerCase(),
      size: fileSize,
      offset,
    });
  }
  return { fileCount: filenum, dirSize: dirsize, dataStart, files };
}

/** Windows-1252 is the ENGLISH release's default, not a property of the
 *  format - engine.cpp:373 seeds it and :1106 can change it, because
 *  localised releases ship other code pages (Part V). This decoder is
 *  therefore named for what it assumes. The five bytes Windows-1252 maps
 *  differently from Latin-1 in the 0x80-0x9F range are the ones a bone
 *  name would never use, so Latin-1 is the honest cheap approximation and
 *  is labelled as such rather than called a decode. */
export function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** Rule: Part V - the NIF header is a PREFIX test on ONE '\n'-terminated
 *  line, then a raw uint32 BCD version. (niffile.cpp:539-562) */
export const NIF_MAGICS = Object.freeze(['NetImmerse File Format', 'Gamebryo File Format']);

export function readNifHeader(bytes) {
  let nl = -1;
  for (let i = 0; i < Math.min(bytes.length, 128); i++) if (bytes[i] === 0x0a) { nl = i; break; }
  if (nl < 0) return { ok: false, why: 'no newline in the first 128 bytes - not a NIF' };
  const line = latin1(bytes.subarray(0, nl)).replace(/\r$/, '');
  const magic = NIF_MAGICS.find((m) => line.startsWith(m));
  if (!magic) return { ok: false, why: `header line is ${JSON.stringify(line)}`, line };
  if (bytes.length < nl + 5) return { ok: false, why: 'file ends before the version field', line };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(nl + 1, true);
  return {
    ok: true, magic, line, version,
    versionText: [24, 16, 8, 0].map((s) => (version >>> s) & 0xff).join('.'),
    // Rule: a NIF `bool` is int32 BELOW version 4.1.0.0 and int8 at or
    // above - the threshold is the rule, not the answer (Part V).
    boolBytes: version < 0x04010000 ? 4 : 1,
  };
}

/** The first-person skeletons OpenMW will actually ask for, by actor.
 *  getActorSkeleton + settings-default.cfg [Models] (rules 6 and 18).
 *  base_anim.1st.nif is in this table ONLY as the name the reverted arc
 *  used, so the report can say plainly whether it was ever there. */
export const FP_SKELETONS = Object.freeze([
  { path: 'meshes/xbase_anim.1st.nif', who: 'male, non-beast' },
  { path: 'meshes/base_anim_female.1st.nif', who: 'female' },
  { path: 'meshes/base_animkna.1st.nif', who: 'beast (Khajiit, Argonian)' },
  { path: 'meshes/wolf/skin.1st.nif', who: 'werewolf' },
  { path: 'meshes/xbase_anim.1st.kf', who: 'first-person animation source' },
  { path: 'meshes/base_anim.1st.nif', who: 'THE NAME THE REVERTED RIG HARDCODED' },
]);

/** Rule: TES3 records are name[4] + uint32 size + 8 bytes of header/flags,
 *  then `size` bytes of subrecords, each name[4] + uint32 size + data.
 *  Unlike NIF every record carries its size, so an unknown type is
 *  skippable by design - which is why this walk cannot desynchronise. */
export function walkEsm(bytes, { limit = Infinity } = {}) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let p = 0;
  while (p + 16 <= bytes.length && out.length < limit) {
    const type = latin1(bytes.subarray(p, p + 4));
    const size = dv.getUint32(p + 4, true);
    const body = p + 16;
    if (body + size > bytes.length) break;   // truncated tail, not a throw
    out.push({ type, start: body, size });
    p = body + size;
  }
  return out;
}

export function subrecords(bytes, rec) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let p = rec.start;
  const end = rec.start + rec.size;
  while (p + 8 <= end) {
    const name = latin1(bytes.subarray(p, p + 4));
    const len = dv.getUint32(p + 4, true);
    if (p + 8 + len > end) break;
    out.push({ name, start: p + 8, len });
    p = p + 8 + len;
  }
  return out;
}

const zstr = (bytes, s, n) => {
  let e = s;
  while (e < s + n && bytes[e] !== 0) e++;
  return latin1(bytes.subarray(s, e));
};

/** Morrowind's body-part slots, by BYDT index
 *  (components/esm3/loadbody.hpp MeshPart). ONE HOME: the ESM reader owns
 *  this table. The inspector carried its own copy while the format layer
 *  was reverted out of the tree; now that the layer is back, a second
 *  copy is exactly the duplicate-declaration the one-home audit exists to
 *  catch - and it caught it. Re-exported so this module's own API is
 *  unchanged for its page and its pins. */
export { MW_BODY_PARTS } from './mwEsmFile.js';
import { MW_BODY_PARTS } from './mwEsmFile.js';
import FACE_TABLE from './mwFaceTable.json' with { type: 'json' };
import { GRAPH_ROOT, ACCUM_ROOT_NAMES } from './mwSkin.js';
import { getTextKeyTime, animVelocity } from './mwAnim.js';

/** The four parts allowed to fall back to a third-person mesh when the
 *  first-person record is missing (rule 3 / npcanimation.cpp:1217-1253).
 *  NOT the list of what gets shown - the reverted arc inverted exactly
 *  this and so rendered nothing else. */
export const ARM_PARTS = Object.freeze(['hand', 'wrist', 'forearm', 'upperarm']);

/** Rule 1: a first-person body part is a RECORD whose id ends in "1st"
 *  (loadbody.cpp:85-88) - NOT a mesh filename with .1st spliced in, which
 *  is the transform the reverted arc applied to the MODL path. */
export const isFirstPersonId = (id) => String(id).toLowerCase().endsWith('1st');

export function bodyParts(bytes) {
  const out = [];
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'BODY') continue;
    const e = { id: '', model: '', race: '', part: -1, female: false, playable: true, skin: false };
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') e.id = zstr(bytes, sub.start, sub.len);
      else if (sub.name === 'MODL') e.model = zstr(bytes, sub.start, sub.len).replace(/\\/g, '/').toLowerCase();
      else if (sub.name === 'FNAM') e.race = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'BYDT' && sub.len >= 4) {
        e.part = bytes[sub.start];
        const flags = bytes[sub.start + 2];
        e.female = (flags & 1) !== 0;            // BPF_Female = 1
        e.playable = (flags & 2) === 0;          // BPF_NotPlayable = 2
        e.skin = bytes[sub.start + 3] === 0;     // MT_Skin = 0
        e.bodyKind = bytes[sub.start + 3];       // IG3: the raw MeshType - getShieldMesh gates on MT_Armor (2)
      }
    }
    e.slot = MW_BODY_PARTS[e.part] ?? `#${e.part}`;
    e.firstPerson = isFirstPersonId(e.id);
    out.push(e);
  }
  return out;
}

/** MW-D32: the RACE records the build needs - the beast flag decides
 *  the skeleton column (getActorSkeleton) and the height/weight pairs
 *  scale the rig (npc.cpp's race scaling). RADT is 140 bytes
 *  (loadrace.hpp:50-70): 7 skill pairs (56) + 8x2 attributes (64), then
 *  maleHeight/femaleHeight/maleWeight/femaleWeight floats at 120..135
 *  and the flags int32 at 136 (Playable 0x1, Beast 0x2). */
export function raceRecords(bytes) {
  const out = new Map();
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'RACE') continue;
    const e = { id: '', beast: false, playable: false, height: [1, 1], weight: [1, 1], radt: false };
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') e.id = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'RADT' && sub.len >= 140) {
        e.radt = true;
        const dv = new DataView(bytes.buffer, bytes.byteOffset + sub.start, 140);
        e.height = [dv.getFloat32(120, true), dv.getFloat32(124, true)];
        e.weight = [dv.getFloat32(128, true), dv.getFloat32(132, true)];
        const flags = dv.getInt32(136, true);
        e.playable = (flags & 1) !== 0;
        e.beast = (flags & 2) !== 0;
      }
    }
    if (e.id) out.set(e.id, e);
  }
  return out;
}

/**
 * MW-D9: THE WEAPON RECORDS.
 *
 * ESM::Weapon::Type, read off components/esm3/loadweap.hpp - explicit
 * values, every one of them, including the four NEGATIVE pseudo-types
 * that are not items at all. The reverted arc had FOUR weapon classes
 * where the reference has fourteen, so every one-hander was forced onto
 * one group; the whole table is here so that cannot recur by omission.
 */
export const MW_WEAPON_TYPE = Object.freeze({
  PickProbe: -4,
  HandToHand: -3,
  Spell: -2,
  None: -1,
  ShortBladeOneHand: 0,
  LongBladeOneHand: 1,
  LongBladeTwoHand: 2,
  BluntOneHand: 3,
  BluntTwoClose: 4,
  BluntTwoWide: 5,
  SpearTwoWide: 6,
  AxeOneHand: 7,
  AxeTwoHand: 8,
  MarksmanBow: 9,
  MarksmanCrossbow: 10,
  MarksmanThrown: 11,
  Arrow: 12,
  Bolt: 13,
});

/** RULE 8's attach-bone column, and RULE 17 is why it is a table rather
 *  than a constant: for PRT_Weapon the generic "Weapon Bone" from the
 *  part table is REPLACED by the equipped type's own mAttachBone when the
 *  actor has that node. The bow is the reason the column exists - it is
 *  the only weapon that goes on the LEFT - and the reverted arc, having
 *  no such table, put every weapon on one bone. */
export const WEAPON_ATTACH_BONE = Object.freeze({
  [MW_WEAPON_TYPE.MarksmanBow]: 'Weapon Bone Left',
  [MW_WEAPON_TYPE.Arrow]: 'Bip01 Arrow',
  [MW_WEAPON_TYPE.Bolt]: 'ArrowBone',
});
/**
 * MW-D12 / RULE 11's ATTACK TYPE, AND THIS ROW IS A PORT DECISION.
 *
 * The two games choose an attack differently and there is no translation
 * between them, only a mapping somebody has to pick:
 *
 *   Morrowind picks by MOVEMENT at the moment of the swing
 *   (getMovementBasedAttackType, character.cpp:2924-2932): forward or
 *   back dominating is "thrust", sideways is "slash", otherwise "chop" -
 *   or, with "always use best attack" on, the type with the highest
 *   damage spread on the WEAP record.
 *
 *   Daggerfall picks by GESTURE: the mouse drag's 15-degree radial
 *   section becomes one of six strikes, and the strike IS the attack.
 *
 * So the port maps Daggerfall's six onto Morrowind's three BY THE SHAPE
 * OF THE MOTION, which is the only honest correspondence available:
 *
 *   StrikeDown, StrikeDownLeft, StrikeDownRight -> chop    (a downward arc)
 *   StrikeLeft, StrikeRight                     -> slash   (a horizontal one)
 *   StrikeUp                                    -> thrust  (the port's own
 *       viewmodel already calls StrikeUp the thrust, Characters-Arc.md)
 *
 * and a BOW's swing is Morrowind's "shoot" whatever direction produced
 * it, because the bow has no directional attacks at all.
 *
 * getBestAttack is NOT ported and is not a gap: it reads the damage
 * spread off a WEAP record to answer a question Daggerfall never asks -
 * the player's gesture has already chosen.
 */
export const DF_STRIKE_TO_MW_ATTACK = Object.freeze({
  StrikeDown: 'chop',
  StrikeDownLeft: 'chop',
  StrikeDownRight: 'chop',
  StrikeLeft: 'slash',
  StrikeRight: 'slash',
  StrikeUp: 'thrust',
});

/** Rule 11's ranged case: every bow swing is "shoot", and the release
 *  key is "shoot release" where a melee blow is "<type> hit". */
export const MW_SHOOT_ATTACK = 'shoot';

export function mwAttackType(strike, { bow = false } = {}) {
  if (bow) return MW_SHOOT_ATTACK;
  return DF_STRIKE_TO_MW_ATTACK[strike] ?? null;
}

/**
 * RULE 11's KEY NAMES, composed. The attack type never enters the GROUP -
 * it is a prefix on the text keys inside the long group
 * (character.cpp:1663-1718, 1762-1815):
 *
 *   wind-up   "<type> start"        -> "<type> max attack"
 *   release   "<type> max attack"   -> "<type> hit"     ("shoot release")
 *   follow    "<type> <strength> follow start" -> "... follow stop"
 *
 * where strength is small (<0.33), medium (<0.66) or large - and "shoot"
 * has NO strength word at all.
 */
export function attackKeys(attackType, strength = 0) {
  const shoot = attackType === MW_SHOOT_ATTACK;
  const hit = shoot ? 'release' : 'hit';
  const word = strength < 0.33 ? 'small' : strength < 0.66 ? 'medium' : 'large';
  return {
    windUp: { start: `${attackType} start`, stop: `${attackType} max attack` },
    release: { start: `${attackType} max attack`, stop: `${attackType} ${hit}` },
    follow: shoot
      ? { start: `${attackType} follow start`, stop: `${attackType} follow stop` }
      : { start: `${attackType} ${word} follow start`, stop: `${attackType} ${word} follow stop` },
    hitKey: `${attackType} ${hit}`,
    // THE THREE KEYS NOBODY PLAYS, which only ever have their TIMES read
    // (character.cpp:1241-1242, :1779). They are not clip boundaries -
    // they are the measuring stick the wind-up strength and the release's
    // skip-ahead are computed against, and they are named here so the
    // caller never has to spell one out and get a space wrong.
    minAttack: `${attackType} min attack`,
    maxAttack: `${attackType} max attack`,
    minHit: `${attackType} min hit`,
  };
}

/**
 * CharacterController::calculateWindUp, verbatim (character.cpp:1235-1248).
 *
 * How far into the wind-up window the clip got, 0 to 1 - and -1, THE
 * SENTINEL, when the window does not exist. The caller must not read -1
 * as "no charge": prepareHit (:1256-1259) replaces it with a RANDOM
 * `min(1, 0.1 + rollClosedProbability())`, which is a different thing
 * from zero and is why the sentinel is a number rather than a null.
 *
 * @param currentTime   the playhead in the weapon group
 * @param minAttackTime getTextKeyTime("<group>: <type> min attack")
 * @param maxAttackTime getTextKeyTime("<group>: <type> max attack")
 */
export function calculateWindUp(currentTime, minAttackTime, maxAttackTime) {
  if (minAttackTime === -1 || minAttackTime >= maxAttackTime) return -1;
  const f = (currentTime - minAttackTime) / (maxAttackTime - minAttackTime);
  return Math.min(1, Math.max(0, f));
}

/**
 * The release's SKIP-AHEAD (character.cpp:1774-1784).
 *
 * A weak blow does not play the whole swing: it starts `1 - strength` of
 * the way through, and that fraction is then RESCALED so it never eats
 * into the part of the clip after the hit - `(minHit - maxAttack) /
 * (hit - maxAttack)` - but ONLY when the file actually orders the three
 * keys that way. Every term is an ordering test, never a sentinel test,
 * which is the recorded caveat on rule 46: a missing `min hit` comes
 * back as -1 and fails `maxAttackTime <= minHitTime` on its own.
 */
export function releaseStartPoint(strength, { minAttackTime, maxAttackTime, minHitTime, hitTime }) {
  if (minAttackTime === -1 || minAttackTime >= maxAttackTime) return 0;
  let startPoint = 1 - strength;
  if (maxAttackTime <= minHitTime && minHitTime < hitTime) {
    startPoint *= (minHitTime - maxAttackTime) / (hitTime - maxAttackTime);
  }
  return startPoint;
}

/** Rule 10's draw and sheathe, which are the long group's own keys
 *  (character.cpp:1444-1478 and :1390-1414). */
export const EQUIP_KEYS = Object.freeze({ start: 'equip start', stop: 'equip stop', attach: 'equip attach' });
export const UNEQUIP_KEYS = Object.freeze({ start: 'unequip start', stop: 'unequip stop', detach: 'unequip detach' });

/**
 * MW-D12 / RULE 8's OTHER TWO COLUMNS, which the port never carried.
 *
 * `weapontype.cpp` gives every type TWO names and they are not derivable
 * from one another:
 *
 *   mLongGroup  - the animation group for the whole draw/attack/sheathe
 *                 cycle. The attack type is NOT part of it (rule 11).
 *   mShortGroup - a SUFFIX for the stance variants: "idle" + "1h" =
 *                 "idle1h", and the same for movement and jump (rule 9).
 *
 * The table is transcribed, not reasoned about. It deliberately collides:
 * AxeOneHand shares BluntOneHand's pair, AxeTwoHand shares
 * BluntTwoClose's, SpearTwoWide shares BluntTwoWide's - and PickProbe
 * borrows the 1h SHORT group while keeping its own LONG one. The bible
 * records that the reverted arc got this wrong in one direction (four
 * classes for eleven groups) and that MWAUDIT's correction got it wrong
 * in another (moving every two-hander to weapontwowide); both were
 * reasoned rather than read.
 */
export const WEAPON_SHORT_GROUP = Object.freeze({
  [MW_WEAPON_TYPE.ShortBladeOneHand]: '1s',
  [MW_WEAPON_TYPE.LongBladeOneHand]: '1h',
  [MW_WEAPON_TYPE.BluntOneHand]: '1b',
  [MW_WEAPON_TYPE.AxeOneHand]: '1b',
  [MW_WEAPON_TYPE.LongBladeTwoHand]: '2c',
  [MW_WEAPON_TYPE.AxeTwoHand]: '2b',
  [MW_WEAPON_TYPE.BluntTwoClose]: '2b',
  [MW_WEAPON_TYPE.BluntTwoWide]: '2w',
  [MW_WEAPON_TYPE.SpearTwoWide]: '2w',
  [MW_WEAPON_TYPE.MarksmanBow]: 'bow',
  [MW_WEAPON_TYPE.MarksmanCrossbow]: 'crossbow',
  [MW_WEAPON_TYPE.MarksmanThrown]: '1t',
  [MW_WEAPON_TYPE.HandToHand]: 'hh',
  [MW_WEAPON_TYPE.Spell]: 'spell',
  [MW_WEAPON_TYPE.PickProbe]: '1h',
  [MW_WEAPON_TYPE.None]: '',
});

export const WEAPON_LONG_GROUP = Object.freeze({
  [MW_WEAPON_TYPE.ShortBladeOneHand]: 'shortbladeonehand',
  [MW_WEAPON_TYPE.LongBladeOneHand]: 'weapononehand',
  [MW_WEAPON_TYPE.BluntOneHand]: 'bluntonehand',
  [MW_WEAPON_TYPE.AxeOneHand]: 'bluntonehand',
  [MW_WEAPON_TYPE.LongBladeTwoHand]: 'weapontwohand',
  [MW_WEAPON_TYPE.AxeTwoHand]: 'blunttwohand',
  [MW_WEAPON_TYPE.BluntTwoClose]: 'blunttwohand',
  [MW_WEAPON_TYPE.BluntTwoWide]: 'weapontwowide',
  [MW_WEAPON_TYPE.SpearTwoWide]: 'weapontwowide',
  [MW_WEAPON_TYPE.MarksmanBow]: 'bowandarrow',
  [MW_WEAPON_TYPE.MarksmanCrossbow]: 'crossbow',
  [MW_WEAPON_TYPE.MarksmanThrown]: 'throwweapon',
  [MW_WEAPON_TYPE.HandToHand]: 'handtohand',
  [MW_WEAPON_TYPE.Spell]: 'spellcast',
  [MW_WEAPON_TYPE.PickProbe]: 'pickprobe',
  [MW_WEAPON_TYPE.None]: '',
});

export const weaponShortGroup = (type) => WEAPON_SHORT_GROUP[type] ?? '';
export const weaponLongGroup = (type) => WEAPON_LONG_GROUP[type] ?? '';

/**
 * MWMechanics::getAllWeaponTypeShortGroups (weapontype.cpp:422-434):
 * every type First(-4) through Last(13), non-empty short groups only,
 * deduplicated "via a set" - std::set, which also SORTS them. The order
 * is not load-bearing for the one consumer (isLoopingAnimation scans
 * for the LONGEST suffix wherever it sits), but the pin asserts it so a
 * second consumer inherits the reference's answer, not this table's
 * iteration order. Arrow and Bolt sit inside [First, Last] with an
 * empty short group and are dropped by the non-empty test, which is why
 * eleven come out of eighteen.
 */
export function allWeaponShortGroups() {
  const set = new Set();
  for (let type = MW_WEAPON_TYPE.PickProbe; type <= MW_WEAPON_TYPE.Bolt; type++) {
    const shortGroup = weaponShortGroup(type);
    if (shortGroup) set.add(shortGroup);
  }
  return [...set].sort();
}

/**
 * THE OTHER TWO COLUMNS OF THE SAME TABLE (weapontype.cpp), which decide
 * every fallback below and which the port had been guessing at with a
 * hand-written list of "two-handed" types.
 *
 * `mWeaponClass` is Melee, Ranged, Thrown or Ammo, and `mFlags` is a
 * bitfield of TwoHanded (0x01) and HasHealth (0x02) (loadweap.hpp:91-105).
 * Transcribed, and the surprises are transcribed with it: SPELL and
 * HAND-TO-HAND BOTH CARRY THE TwoHanded BIT, and both are class Melee -
 * so a test of "TwoHanded" alone would send bare fists to the two-handed
 * ladder. The reference never asks that question alone; every use pairs
 * the bit with the class, and so does isTwoHandedMelee below.
 */
export const MW_WEAPON_CLASS = Object.freeze({
  Melee: 0, Ranged: 1, Thrown: 2, Ammo: 3,
});
export const MW_TWO_HANDED = 0x01;
export const MW_HAS_HEALTH = 0x02;

export const WEAPON_CLASS = Object.freeze({
  [MW_WEAPON_TYPE.None]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.PickProbe]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.Spell]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.HandToHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.ShortBladeOneHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.LongBladeOneHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.BluntOneHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.AxeOneHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.LongBladeTwoHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.AxeTwoHand]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.BluntTwoClose]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.BluntTwoWide]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.SpearTwoWide]: MW_WEAPON_CLASS.Melee,
  [MW_WEAPON_TYPE.MarksmanBow]: MW_WEAPON_CLASS.Ranged,
  [MW_WEAPON_TYPE.MarksmanCrossbow]: MW_WEAPON_CLASS.Ranged,
  [MW_WEAPON_TYPE.MarksmanThrown]: MW_WEAPON_CLASS.Thrown,
  [MW_WEAPON_TYPE.Arrow]: MW_WEAPON_CLASS.Ammo,
  [MW_WEAPON_TYPE.Bolt]: MW_WEAPON_CLASS.Ammo,
});

export const WEAPON_FLAGS = Object.freeze({
  [MW_WEAPON_TYPE.None]: 0,
  [MW_WEAPON_TYPE.PickProbe]: 0,
  [MW_WEAPON_TYPE.Spell]: MW_TWO_HANDED,
  [MW_WEAPON_TYPE.HandToHand]: MW_TWO_HANDED,
  [MW_WEAPON_TYPE.ShortBladeOneHand]: MW_HAS_HEALTH,
  [MW_WEAPON_TYPE.LongBladeOneHand]: MW_HAS_HEALTH,
  [MW_WEAPON_TYPE.BluntOneHand]: MW_HAS_HEALTH,
  [MW_WEAPON_TYPE.AxeOneHand]: MW_HAS_HEALTH,
  [MW_WEAPON_TYPE.LongBladeTwoHand]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.AxeTwoHand]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.BluntTwoClose]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.BluntTwoWide]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.SpearTwoWide]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.MarksmanBow]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.MarksmanCrossbow]: MW_HAS_HEALTH | MW_TWO_HANDED,
  [MW_WEAPON_TYPE.MarksmanThrown]: 0,
  [MW_WEAPON_TYPE.Arrow]: 0,
  [MW_WEAPON_TYPE.Bolt]: 0,
});

export const weaponClass = (type) => WEAPON_CLASS[type] ?? MW_WEAPON_CLASS.Melee;
export const weaponFlags = (type) => WEAPON_FLAGS[type] ?? 0;

/**
 * isRealWeapon (character.cpp:316-320), verbatim, and it is the gate on
 * BOTH fallback ladders below:
 *
 *   return weaponType != HandToHand && weaponType != Spell && weaponType != None;
 *
 * PickProbe IS a real weapon by this test, which is the one entry nobody
 * guesses right. The consequence is the rule: bare fists, a readied
 * spell, and an empty sheathed hand DO NOT take a sword's animation when
 * their own is missing - they fall straight to the bare base group, or to
 * nothing at all.
 */
export function isRealWeapon(type) {
  return type !== MW_WEAPON_TYPE.HandToHand
    && type !== MW_WEAPON_TYPE.Spell
    && type !== MW_WEAPON_TYPE.None;
}

/** `weapInfo->mFlags & TwoHanded && mWeaponClass == Melee`
 *  (character.cpp:584, :620). BOTH terms: bows are TwoHanded and Ranged,
 *  so they take the ONE-handed ladder, and hand-to-hand is TwoHanded and
 *  Melee but is filtered out before this by isRealWeapon. */
export function isTwoHandedMelee(type) {
  return !!(weaponFlags(type) & MW_TWO_HANDED)
    && weaponClass(type) === MW_WEAPON_CLASS.Melee;
}

/**
 * RULE 9's FALLBACK, which is a real function and not a guess
 * (`CharacterController::fallbackShortWeaponGroup`, character.cpp:602-637).
 *
 *   0. NOT A REAL WEAPON    -> the BARE base group, at once (:604-611)
 *   1. two-handed MELEE     -> base + "2c"  (LongBladeTwoHand's short)
 *   2. anything else        -> base + "1h"  (LongBladeOneHand's short)
 *   3. still missing        -> the BARE base group (:629-634)
 *
 * Step 0 is the one this port shipped without and it is not a nicety:
 * without it a bare-handed player whose .kf has no "idlehh" idles in
 * "idle1h" - the one-handed SWORD stance, fist raised as if holding a
 * blade - where Morrowind gives them the plain "idle".
 *
 * The blend-mask half of the reference is deliberately absent: steps 0
 * and 3 also narrow the animation to BlendMask_LowerBody, which is a
 * first-person no-op (there is no lower body in shot) and would be a lie
 * to carry as a field nothing reads.
 *
 * The reverted arc invented a different chain ending in "any idle in the
 * file", which is how it drew a plausible wrong animation instead of
 * saying it had none. There is no such tail here.
 *
 * @param base    "idle", "runforward", ... - the group WITHOUT the suffix
 * @param type    an MW_WEAPON_TYPE
 * @param hasGroup(name) -> boolean, the file's own answer
 */
export function composeStanceGroup(base, type, hasGroup) {
  const short = weaponShortGroup(type);
  const asked = short ? `${base}${short}` : base;
  if (hasGroup(asked)) return { group: asked, fallback: null };
  if (!isRealWeapon(type)) {
    return hasGroup(base) ? { group: base, fallback: 'bare' } : { group: null, fallback: null };
  }
  const ladder = isTwoHandedMelee(type)
    ? `${base}${WEAPON_SHORT_GROUP[MW_WEAPON_TYPE.LongBladeTwoHand]}`
    : `${base}${WEAPON_SHORT_GROUP[MW_WEAPON_TYPE.LongBladeOneHand]}`;
  if (ladder !== asked && hasGroup(ladder)) return { group: ladder, fallback: 'short' };
  if (hasGroup(base)) return { group: base, fallback: 'bare' };
  return { group: null, fallback: null };
}

/**
 * getWeaponAnimation (character.cpp:573-592), the LONG group, and its
 * ladder is gated the same way - `isRealWeapon(weaponType) &&
 * !hasAnimation(weaponGroup)`.
 *
 * So a missing "handtohand" does NOT become "weapononehand": the
 * reference returns the missing name and the caller finds no animation,
 * which here is a null group and a stance that plays its idle and
 * refuses to swing. That refusal is the correct outcome - an arm that
 * mimes a sword swing with empty hands is worse than one that does not
 * swing.
 *
 * The non-bipedal "attack1" arm (:589-590) is out of scope by
 * construction: the player is bipedal and this module only ever animates
 * the player's own first-person rig.
 */
/**
 * MW-D26: THE MOVEMENT STATE - refreshCurrentAnims' movestate ladder
 * (character.cpp:2297-2330) minus the swim family (deferred with the
 * port's swim animations; recorded, not faked). The strafe test is the
 * reference's own 2:1 (character.cpp:2085 - mIsStrafing when the side
 * component more than doubles the forward one); sneak beats run beats
 * walk exactly as the nested ternaries order them; and the TURN states
 * exist only for a third-person biped that is not sneaking
 * (character.cpp:2321-2329 - "do not use turning animations in the
 * first-person view and when sneaking"). Returns the base group name
 * ("runforward", "turnleft", ...) or null for standing still.
 */
export function movementAnimState({
  forward = 0, strafe = 0, running = false, sneaking = false,
  turning = 0, thirdPerson = false,
} = {}) {
  const prefix = sneaking ? 'sneak' : running ? 'run' : 'walk';
  const strafing = Math.abs(strafe) > Math.abs(forward) * 2;
  if (strafing) return strafe > 0 ? `${prefix}right` : `${prefix}left`;
  if (forward !== 0 || strafe !== 0) return forward >= 0 ? `${prefix}forward` : `${prefix}back`;
  if (turning && thirdPerson && !sneaking) return turning > 0 ? 'turnright' : 'turnleft';
  return null;
}

/**
 * MW-D26: the movement group's WEAPON suffix and its fallbacks
 * (refreshMovementAnims, character.cpp:674-708). The suffix ladder is
 * fallbackShortWeaponGroup's, which composeStanceGroup already IS
 * (asked short, then the 2c/1h fallback for real weapons, then the
 * bare base) - one home, reused. What movement adds on top is the
 * run -> walk swap (character.cpp:697-699) when the composed name has
 * no animation, and a null when even that misses (:701-707 - the
 * movement state RESETS rather than substituting a wrong clip).
 */
export function composeMovementGroup(base, type, hasGroup) {
  const short = weaponShortGroup(type);
  let name = base;
  if (short) {
    const r = composeStanceGroup(base, type, hasGroup);
    name = r.group ?? base;
  }
  if (!hasGroup(name)) {
    const walked = name.replace('run', 'walk');
    if (walked !== name && hasGroup(walked)) return { group: walked, walked: true };
    return { group: null, walked: false };
  }
  return { group: name, walked: false };
}

/**
 * MW-D39: THE JUMP STATE - update()'s in-air derivation
 * (character.cpp:2195-2296), the ANIMATION half only. The same block's
 * fall damage, Acrobatics progression, knockdown and landing sounds
 * are DFU's own laws in this port (fallwater/footsteps own them; the
 * reference's DefaultLand is NoPlayerLocal anyway - the first-person
 * player never hears their own), so what this derives is exactly what
 * refreshJumpAnims consumes: which of the two jump plays is owed, and
 * whether movement selection is suppressed this frame.
 *
 * The reference's shape, kept:
 *   - mInJump is re-derived EVERY frame from the world, not latched
 *     (:2195-2196 - wasInJump is remembered, mInJump starts false);
 *   - in the air and not swimming, not levitating: InAir, and inJump
 *     (:2206-2212 - the reference's !inwater && !flying && solid gate;
 *     this port has no noclip, so solid is construction);
 *   - THE TAKEOFF FRAME (:2224-2227): a jump STARTING while still
 *     grounded sets mInJump - movement gates off one frame before the
 *     feet leave - but plays nothing yet; the `priorInAir` guard is
 *     the reference's own `mJumpState != JumpState_InAir`, which is
 *     what keeps the LANDING frame (motor's jump latch not yet
 *     cleared) from reading as a fresh takeoff;
 *   - not in a jump, and the jump clip is still playing: Landing
 *     (:2292-2293) - the state that plays the clip's tail once and
 *     clears itself when the clip stops.
 *
 * `jumpQueued` is the port's crossing for `vec.z() > 0`: the motor's
 * own jump latch (AcrobatMotor.Jumping - set at the jump, cleared on
 * the next grounded frame), true on exactly the takeoff frame while
 * grounded. Swim-family jump groups are out with the swim movement
 * family (MW-D26's recorded deferral, one line over).
 *
 * @returns {{ jump: 'inair'|'landing'|null, inJump: boolean }}
 */
export function jumpAnimState({ grounded = true, swimming = false, levitating = false,
  jumpQueued = false, priorInAir = false, jumpPlaying = false } = {}) {
  let inJump = false;
  let jump = null;
  if (!swimming && !levitating) {
    if (!grounded) { inJump = true; jump = 'inair'; }
    else if (!priorInAir && jumpQueued) inJump = true;   // :2224-2227, the takeoff frame
  }
  if (!inJump && jumpPlaying) jump = 'landing';   // :2292-2293
  return { jump, inJump };
}

/** character.cpp:750-752 - the animation speeds assumed when a clip
 *  carries no accum-root velocity ("the first person anims don't have
 *  any velocity to calculate a speed multiplier from"), in MW units
 *  per second: sneak, run, walk. */
export const MOVEMENT_FALLBACK_SPEED = Object.freeze({
  sneak: 33.5452, run: 222.857, walk: 154.064,
});

/** character.cpp:2403 - "Vanilla caps the played animation speed." */
export const MOVEMENT_SPEED_CAP = 10;

/** character.cpp:2396 - the turning animation's own speed law. */
export const turnAnimSpeed = (yawRatePerSec) =>
  Math.min(1.5, Math.abs(yawRatePerSec) / Math.PI);

export function composeWeaponGroup(type, hasGroup) {
  const asked = weaponLongGroup(type);
  if (asked && hasGroup(asked)) return { group: asked, fallback: null };
  if (!isRealWeapon(type)) return { group: null, fallback: null };
  const ladder = isTwoHandedMelee(type)
    ? WEAPON_LONG_GROUP[MW_WEAPON_TYPE.LongBladeTwoHand]
    : WEAPON_LONG_GROUP[MW_WEAPON_TYPE.LongBladeOneHand];
  if (ladder !== asked && hasGroup(ladder)) return { group: ladder, fallback: 'long' };
  return { group: null, fallback: null };
}

/**
 * MW-D16 / RULE 8's LAST COLUMN: mAmmoType (weapontype.cpp). Only the two
 * marksman types have one, and MarksmanThrown does NOT - a thrown weapon
 * IS its own ammunition, which is why attachArrow's Thrown branch just
 * shows the weapon again instead of adding a node
 * (weaponanimation.cpp:70-79).
 */
export const WEAPON_AMMO_TYPE = Object.freeze({
  [MW_WEAPON_TYPE.MarksmanBow]: MW_WEAPON_TYPE.Arrow,
  [MW_WEAPON_TYPE.MarksmanCrossbow]: MW_WEAPON_TYPE.Bolt,
});
export const ammoTypeFor = (type) => WEAPON_AMMO_TYPE[type] ?? MW_WEAPON_TYPE.None;

/**
 * getArrowBone (npcanimation.cpp:1077-1102): the bone the held round sits
 * on, which is the AMMO type's attach bone - "Bip01 Arrow" for an arrow,
 * "ArrowBone" for a bolt - looked for in the ACTOR's skeleton first, and
 * failing that as a node named "ArrowBone" INSIDE THE WEAPON'S OWN MESH.
 *
 * The fallback is not a nicety: Morrowind's bows carry that node and most
 * skeletons do not carry "Bip01 Arrow", so on retail data the second
 * branch is the one that runs. It also decides the arrow's whole
 * placement, because a node inside the weapon's mesh brings the weapon's
 * transform chain with it - and the weapon's own mirror. A bow hangs on
 * "Weapon Bone Left", so rule 13 negates its X, and THE ARROW INHERITS
 * THAT, because the reference instances it under a node that is already
 * inside the mirrored subtree.
 */
export const ARROW_FALLBACK_NODE = 'ArrowBone';
export function arrowAttachBone(weaponType) {
  const ammo = ammoTypeFor(weaponType);
  if (ammo === MW_WEAPON_TYPE.None) return null;
  return WEAPON_ATTACH_BONE[ammo] ?? null;
}

/**
 * character.cpp:1827-1829, as a condition rather than an `if` buried in a
 * switch:
 *
 *   if (ammunition && mWeaponType == ESM::Weapon::MarksmanCrossbow)
 *       mAnimation->attachArrow();
 *
 * at the end of Equipping, AttackEnd or Casting. A CROSSBOW puts the next
 * bolt on itself; a BOW does not, and waits for the next "shoot attach"
 * key - so a freshly drawn bow is empty-handed until you begin to draw
 * it. That reads as a bug until you see the weapon type in the test.
 *
 * DAGGERFALL HAS NO CROSSBOW, so no row of DF_TO_MW_WEAPON reaches
 * MarksmanCrossbow and this can never be true in the played game. It is
 * here as a FUNCTION, pinned on its own, precisely because of that: a
 * branch that cannot be exercised is not pinned, and a condition that can
 * be is. If a crossbow row is ever added, the arm reloads correctly with
 * nothing to change.
 */
export const reloadsItself = (type) => type === MW_WEAPON_TYPE.MarksmanCrossbow;

/**
 * character.cpp:1676-1677 - which attacks are "shoot":
 *
 *   if (weapclass == ESM::WeaponType::Ranged || weapclass == ESM::WeaponType::Thrown)
 *       mAttackType = "shoot";
 *
 * A CLASS test, not a bow test, and the two are not the same: a THROWN
 * weapon shoots without being a bow, which is the case the port's own
 * `machine.isBow` would have missed. Daggerfall has no thrown-weapon row
 * either, so like reloadsItself this is a condition the played game
 * cannot reach today and a function that is right when it can.
 */
export const shootsRatherThanSwings = (type) => {
  const cls = weaponClass(type);
  return cls === MW_WEAPON_CLASS.Ranged || cls === MW_WEAPON_CLASS.Thrown;
};

export const DEFAULT_WEAPON_BONE = 'Weapon Bone';

/** Rules 8 + 17: the bone this weapon type attaches at. The fallback is
 *  the part table's own entry, exactly as the reference's comment says. */
export const weaponAttachBone = (type) => WEAPON_ATTACH_BONE[type] ?? DEFAULT_WEAPON_BONE;

/**
 * The WEAP records in a player's .esm.
 *
 * WPDT is a 32-byte struct and its layout is CITED, not guessed
 * (components/esm3/loadweap.hpp:64-74): float mWeight; int32 mValue; int16
 * mType; uint16 mHealth; float mSpeed, mReach; uint16 mEnchant; uchar
 * mChop[2], mSlash[2], mThrust[2]; int32 mFlags. Only the offset of
 * mType matters here - byte EIGHT (MW-D22) - and a short record is REFUSED rather
 * than read past, because a wrong offset silently yields a plausible
 * weapon type and this arc has already died of plausible.
 */
export function weaponRecords(bytes) {
  const out = [];
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'WEAP') continue;
    const e = { id: '', model: '', name: '', type: MW_WEAPON_TYPE.None, enchanted: false, speed: 1 };
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') e.id = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'MODL') e.model = zstr(bytes, sub.start, sub.len).replace(/\\/g, '/').toLowerCase();
      else if (sub.name === 'FNAM') e.name = zstr(bytes, sub.start, sub.len);
      else if (sub.name === 'ENAM') e.enchanted = true;
      else if (sub.name === 'WPDT') {
        if (sub.len < 32) continue;   // refused, not read past
        // MW-D22: mType is at byte EIGHT. loadweap.hpp's WPDTstruct is
        // float mWeight (0-3), int32 mValue (4-7), int16 mType (8-9),
        // uint16 mHealth (10-11), ... - 32 bytes. MW-D9 recorded "byte
        // 10" (4+4 does not make 10), the reader read 10, and the
        // fixture writer was authored FROM THE SAME GUESS - so every
        // pin passed while retail play read mHealth as the type:
        // a shortsword (type 0) found no record with health 0 and drew
        // EMPTY HANDS, and a staff (type 5) drew whatever record's
        // health is 5. Mac's play was the first retail check this
        // number ever got, which is the whole TEST-THE-SHAPE lesson
        // wearing bytes.
        const dv = new DataView(bytes.buffer, bytes.byteOffset + sub.start, 32);
        e.type = dv.getInt16(8, true);
        // MW-D28: mSpeed at byte 12 (loadweap.hpp:70, after mHealth's
        // uint16 at 10-11). It is the ONLY record field that changes an
        // attack's played speed: character.cpp:1326 reads it for the
        // drawn weapon and :1718/:1786/:1811 pass it as the speedmult of
        // exactly the three attack sections - equip and unequip play at
        // 1.0f (:1408, :1465).
        e.speed = dv.getFloat32(12, true);
      }
    }
    if (e.id && e.model) out.push(e);
  }
  return out;
}

/** MW-D30: the CLOT records - the ARMO reader's twin, plus CTDT's
 *  TYPE, which the composer needs twice over: DF garments resolve to
 *  MW clothing BY TYPE (a shirt is any CLOT of type 2, id-sorted),
 *  and the robe/skirt types trigger the reference's slot RESERVES.
 *  CTDT is 12 bytes - u32 type, f32 weight, u16 value, u16 enchant
 *  points (loadclot.hpp) - refused at any other size. The part
 *  references are the same INDX/BNAM/CNAM list armor carries, and
 *  MODL is the ground mesh here too. */
export function clothingRecords(bytes) {
  const out = [];
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'CLOT') continue;
    const e = { id: '', model: '', name: '', type: -1, enchanted: false, parts: [] };
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') e.id = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'MODL') e.model = zstr(bytes, sub.start, sub.len).replace(/\\/g, '/').toLowerCase();
      else if (sub.name === 'FNAM') e.name = zstr(bytes, sub.start, sub.len);
      else if (sub.name === 'ENAM') e.enchanted = true;
      else if (sub.name === 'CTDT') {
        if (sub.len !== 12) throw new Error(`CLOT ${e.id}: CTDT is ${sub.len} bytes`);
        e.type = new DataView(bytes.buffer, bytes.byteOffset + sub.start, 4).getUint32(0, true);
      } else if (sub.name === 'INDX') {
        if (sub.len !== 1) throw new Error(`CLOT ${e.id}: INDX is ${sub.len} bytes`);
        e.parts.push({ part: bytes[sub.start], male: null, female: null });
      } else if (sub.name === 'BNAM' && e.parts.length) {
        e.parts[e.parts.length - 1].male = zstr(bytes, sub.start, sub.len).toLowerCase();
      } else if (sub.name === 'CNAM' && e.parts.length) {
        e.parts[e.parts.length - 1].female = zstr(bytes, sub.start, sub.len).toLowerCase();
      }
    }
    if (e.id && e.model) out.push(e);
  }
  return out;
}

/** AUDIT MW-A F1: IS THIS RACE A BEAST? Read from the RACE record's
 *  own RADT flags (bit 2), the WEAP way - a targeted walk, lenient of
 *  fixtures, because the one consumer is a boolean and parseEsm's
 *  full door throws on headerless test bytes. Later masters override
 *  earlier ones, so the caller feeds esms IN ORDER and the last RACE
 *  with this id wins - the load order, not a preference.
 *
 *  THE DEFECT THIS CLOSES: fpSkeletonPath/tpSkeletonPath switch on
 *  `beast`, playerBodyRows hides the tail row on `!beast` - and no
 *  production caller ever SET it. An Argonian or Khajiit player built
 *  on the human skeleton (base_anim, not base_animkna) with the tail
 *  slot silently skipped, and nothing on screen said so. The flag was
 *  in the player's own data the whole time. */
export function raceBeastFlag(bytes, raceId) {
  // ONE HOME: the full RACE reader below answers; this stays as the
  // narrow question its callers ask. null = this esm does not know.
  const rec = raceRecords(bytes).get(String(raceId || '').toLowerCase());
  return rec && rec.radt ? rec.beast : null;
}

/** MW-D28: the ARMO records, read the WEAP way - id, model, display
 *  name, enchantment flag. AODT is not decoded: nothing this port
 *  draws needs Morrowind's armor class, and a struct nobody consumes
 *  is a guess waiting for its own MW-D22 (the byte-eight lesson, one
 *  screen up). mwItemMap resolves DF armor against these by token. */
export function armorRecords(bytes) {
  const out = [];
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'ARMO') continue;
    const e = { id: '', model: '', name: '', enchanted: false, parts: [] };
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') e.id = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'MODL') e.model = zstr(bytes, sub.start, sub.len).replace(/\\/g, '/').toLowerCase();
      else if (sub.name === 'FNAM') e.name = zstr(bytes, sub.start, sub.len);
      else if (sub.name === 'ENAM') e.enchanted = true;
      // MW-D29: THE WORN HALF. An ARMO's MODL is the GROUND mesh - the
      // thing a dropped cuirass looks like - and the worn shape is a
      // list of PART REFERENCES: INDX (one byte, the sided
      // PartReferenceType enum) opens a reference, then BNAM names the
      // male BODY record and CNAM the female one, either optional
      // (loadarmo.hpp's PartReferenceList; same layout on CLOT).
      // Reading MODL as the worn mesh would dress the player in
      // ground clutter, which is this format's byte-eight trap.
      else if (sub.name === 'INDX') {
        if (sub.len !== 1) throw new Error(`ARMO ${e.id}: INDX is ${sub.len} bytes`);
        e.parts.push({ part: bytes[sub.start], male: null, female: null });
      } else if (sub.name === 'BNAM' && e.parts.length) {
        e.parts[e.parts.length - 1].male = zstr(bytes, sub.start, sub.len).toLowerCase();
      } else if (sub.name === 'CNAM' && e.parts.length) {
        e.parts[e.parts.length - 1].female = zstr(bytes, sub.start, sub.len).toLowerCase();
      }
    }
    if (e.id && e.model) out.push(e);
  }
  return out;
}

/**
 * MW-D15 / RULE 32(a): the GMST the SNEAK SINK is measured in.
 *
 * `MWWorld::Player::update` reads `i1stPersonSneakDelta` ONCE, statically,
 * and Camera::setSneakOffset pushes `osg::Vec3f(0, 0, -offset)` into the
 * neck controller while the player has the Sneak stance and is neither
 * swimming nor flying. It is a STEP change with no smoothing.
 *
 * Read from the player's own .esm rather than hardcoded, because it is a
 * GMST and a mod may move it - and because a constant here would be the
 * fourth time this arc invented a number the data already carries.
 * GMST layout: NAME is the id, and the value rides INTV / FLTV / STRV by
 * the id's first letter (i / f / s), which is Morrowind's own convention
 * and the reason the type does not need to be stored.
 *
 * @returns the number, or null when the .esm does not carry it - the
 *   caller decides, and a missing GMST is not a reason to refuse an arm.
 */
export function gmstValue(bytes, id) {
  const want = String(id).toLowerCase();
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'GMST') continue;
    let name = '';
    let value = null;
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') name = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'INTV' && sub.len >= 4) {
        value = new DataView(bytes.buffer, bytes.byteOffset + sub.start, 4).getInt32(0, true);
      } else if (sub.name === 'FLTV' && sub.len >= 4) {
        value = new DataView(bytes.buffer, bytes.byteOffset + sub.start, 4).getFloat32(0, true);
      } else if (sub.name === 'STRV') value = zstr(bytes, sub.start, sub.len);
    }
    if (name === want) return value;
  }
  return null;
}

/** The GMST id, spelled once. */
export const GMST_SNEAK_DELTA = 'i1stpersonsneakdelta';

/**
 * RULE 32(a)'s vector, in the OBJECT ROOT's space: `Vec3f(0, 0, -offset)`
 * while sneaking and the zero vector otherwise. The whole first-person
 * body sinks by that much in -Z, through the NECK - so the Camera bone
 * goes with it and the eye drops too, which is the point.
 *
 * "neither swimming nor flying" has no Daggerfall counterpart worth
 * porting here: the port's sneak input is already refused in those
 * states by the host, so the guard would be a branch no frame can take.
 */
export function sneakOffset(sneaking, delta) {
  return sneaking && delta ? [0, 0, -delta] : [0, 0, 0];
}

/**
 * THE DIVERGENCE, DECLARED. Daggerfall's weapon taxonomy is NOT
 * Morrowind's, and this document's own warning is that any mapping
 * between them is a PORT DECISION which "belongs in the recorded
 * divergences with its reasoning visible - not inferred inside a lookup
 * table, where the last attempt hid it wrong twice."
 *
 * So it is a table, it is exported, it is pinned, and every row is
 * arguable. Keyed by the port's own WEAPONS template index, because
 * Daggerfall's templates are finer than its WEAPON_TYPES: a Claymore and
 * a Longsword are both LongBlade to the sprite layer, and they are a
 * two-hander and a one-hander to Morrowind.
 *
 * THE ROWS THAT ARE JUDGEMENT, not translation:
 *   - FLAIL. Morrowind has no flail. BluntOneHand is the nearest thing
 *     that exists; nothing here is right.
 *   - STAFF. Daggerfall's staff is a two-handed blunt; Morrowind's own
 *     staves are BluntTwoWide, so that is where it goes.
 *   - WAR AXE vs BATTLE AXE. Daggerfall splits them one/two-handed and
 *     Morrowind's AxeOneHand / AxeTwoHand split the same way, which is
 *     the cleanest row in the table.
 *   - DAI-KATANA and CLAYMORE are LongBladeTwoHand, which costs them
 *     Daggerfall's own one-handed animation - a real behavioural change,
 *     not just a mesh swap.
 */
export const DF_TO_MW_WEAPON = Object.freeze({
  Dagger: MW_WEAPON_TYPE.ShortBladeOneHand,
  Tanto: MW_WEAPON_TYPE.ShortBladeOneHand,
  Shortsword: MW_WEAPON_TYPE.ShortBladeOneHand,
  Wakazashi: MW_WEAPON_TYPE.ShortBladeOneHand,
  Broadsword: MW_WEAPON_TYPE.LongBladeOneHand,
  Saber: MW_WEAPON_TYPE.LongBladeOneHand,
  Longsword: MW_WEAPON_TYPE.LongBladeOneHand,
  Katana: MW_WEAPON_TYPE.LongBladeOneHand,
  Claymore: MW_WEAPON_TYPE.LongBladeTwoHand,
  Dai_Katana: MW_WEAPON_TYPE.LongBladeTwoHand,
  Mace: MW_WEAPON_TYPE.BluntOneHand,
  Flail: MW_WEAPON_TYPE.BluntOneHand,
  Warhammer: MW_WEAPON_TYPE.BluntTwoClose,
  Staff: MW_WEAPON_TYPE.BluntTwoWide,
  War_Axe: MW_WEAPON_TYPE.AxeOneHand,
  Battle_Axe: MW_WEAPON_TYPE.AxeTwoHand,
  Short_Bow: MW_WEAPON_TYPE.MarksmanBow,
  Long_Bow: MW_WEAPON_TYPE.MarksmanBow,
});

/** Daggerfall's materials against Morrowind's, for picking WHICH record
 *  of a type to draw. Only the seven Morrowind actually ships are here;
 *  the rest fall through to whatever the type offers, and the caller
 *  reports which record it took so a wrong pick is visible rather than
 *  merely odd. */
// MW-D37: THE MATERIAL ROWS ARE COLOUR TRUTH, NOT LORE GUESSES. Every
// Daggerfall material is a 16-index band of ART_PAL (dyes.js
// METAL_TABLES); the band's mean is what the sprite art actually looks
// like, measured (mwItemMap.DF_MATERIAL_RGB). The rows below follow it:
//   Elven is SILVER-WHITE in Daggerfall (#a6a6a7, the same band family
//     as Silver) - D9 had sent it to green glass, which no Daggerfall
//     player would recognise as elven. Silver weapons exist in MW.
//   Mithril is a dark blue-steel (#2a3849), Adamantium near-black
//     (#2e2e30), Ebony black (#3a3a3a): Daggerfall's own art barely
//     tells the three apart, and the darkest MW metal is ebony - so all
//     three read as ebony, with Adamantium trying Tribunal's own
//     'adamantium' first when that master is loaded.
//   Orcish is dark GREEN (#314026). MW has no orcish weapon; glass is
//     the green metal, ebony the dark one - green is the identity a
//     player reads, so glass, recorded as the judgement it is.
// Each value is a CHAIN tried in order; the first token present wins.
export const DF_TO_MW_MATERIAL = Object.freeze({
  Iron: ['iron'], Steel: ['steel'], Silver: ['silver'], Elven: ['silver', 'steel'],
  Dwarven: ['dwarven'], Mithril: ['ebony'], Adamantium: ['adamantium', 'ebony'],
  Ebony: ['ebony'], Orcish: ['glass', 'ebony'], Daedric: ['daedric'],
});

/**
 * Pick the WEAP record to put in the hand: the right TYPE first, then
 * the closest material, then anything of that type. Enchanted records
 * are avoided because in Morrowind they carry a glow this slice does not
 * draw, so taking one would show an ordinary mesh under a name that
 * promises light.
 *
 * Answers null rather than substituting a different type - a longsword
 * standing in for a bow would be drawn on the wrong bone, in the wrong
 * hand, and nothing on screen would say so.
 */
/**
 * A Daggerfall item to a Morrowind weapon type, through the table above.
 * Answers None for anything not in it - unarmed, a lockpick, a torch, a
 * werecreature's claws - and None means NO WEAPON IS DRAWN, which is the
 * honest answer for an item Morrowind has no weapon for.
 *
 * templateIndex is the key, not the sprite layer's WEAPON_TYPES, because
 * WEAPON_TYPES folds a Claymore and a Longsword into one class and
 * Morrowind holds them in different numbers of hands.
 */
export function dfWeaponToMw(item, weaponsTable) {
  if (!item || item.werecreatureClaws) return MW_WEAPON_TYPE.None;
  const idx = item.templateIndex;
  for (const [name, tmpl] of Object.entries(weaponsTable ?? {})) {
    if (tmpl === idx && name in DF_TO_MW_WEAPON) return DF_TO_MW_WEAPON[name];
  }
  return MW_WEAPON_TYPE.None;
}

export function pickWeaponRecord(records, type, material = null) {
  // AUDIT MW-A F3: id-sorted, for the face's own reason (D27) - file
  // order is a property of the LOAD, and `ofType[0]` handed a player
  // whichever record their archive arrangement listed first. Sorted,
  // the same character draws the same sword on every machine, and on
  // retail the alphabetical first is the iron/chitin commons the old
  // pick usually landed on anyway.
  const ofType = (records ?? []).filter((r) => r.type === type && !r.enchanted)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!ofType.length) return null;
  const chain = material ? DF_TO_MW_MATERIAL[material] : null;
  for (const want of (Array.isArray(chain) ? chain : chain ? [chain] : [])) {
    const hit = ofType.find((r) => r.id.includes(want));
    if (hit) return hit;
  }
  return ofType[0];
}

/** The report the reverted arc never printed: for one race, which
 *  first-person arm records actually exist, and what each one would fall
 *  back to. Answers are about the PLAYER'S data, never about ours. */
/** MW-D32: sBodyPartMap's slot list (npcanimation.cpp:1187-1197) - the
 *  mesh parts the skin sweep maps to visible slots. NO head, NO hair
 *  (those come off the actor's own record - the chargen face law), NO
 *  clavicle (deliberately never mapped to any PRT slot). */
export const SKIN_SWEEP_SLOTS = Object.freeze([
  'neck', 'chest', 'groin', 'hand', 'wrist', 'forearm', 'upperarm',
  'foot', 'ankle', 'knee', 'upperleg', 'tail',
]);

const ARM_SLOT_SET = new Set(['hand', 'wrist', 'forearm', 'upperarm']);

/**
 * MW-D32: GETBODYPARTS, WHOLE (npcanimation.cpp:1167-1297). One record
 * sweep in LOAD ORDER over the sBodyPartMap slots, with the reference's
 * exact ladder:
 *  - BPF_NotPlayable skipped, MT_Skin only, race matched - and NO
 *    vampire filter: the sweep never had one (vampire heads live on the
 *    actor's own record path, and head/hair are not in the map at all)
 *  - a first-person HAND slot missing its .1st record falls back to
 *    third-person skins (:1232-1254): same gender fills, same gender
 *    upgrades an other-gender fallback, male fills for a female
 *  - every other slot takes parts of ITS view only (:1258)
 *  - male parts fall back for females: fill when empty, and a male
 *    .1st upgrades a 3P hand fallback (:1261-1280)
 *  - a PROPER match (right view, right gender) OVERWRITES - the LAST
 *    record in load order wins (:1286-1293), which is how an expansion
 *    overrides a base-game body
 * @returns {Map} slot -> chosen record (absent: no record for the slot)
 */
export function resolveBodyParts(parts, race, female, { firstPerson = false } = {}) {
  const want = String(race || '').toLowerCase();
  const isF = !!female;
  const out = new Map();
  for (const p of parts ?? []) {
    if (!p.playable || !p.skin) continue;
    if (p.race !== want) continue;
    const slot = p.slot;
    if (!SKIN_SWEEP_SLOTS.includes(slot)) continue;
    const isHand = ARM_SLOT_SET.has(slot);
    const sameGender = !!p.female === isF;
    if (firstPerson && isHand && !p.firstPerson) {
      const cur = out.get(slot);
      if (!cur && sameGender) out.set(slot, p);
      else if (cur && sameGender && !!cur.female !== isF) out.set(slot, p);
      else if (!cur && isF) out.set(slot, p);
      continue;
    }
    if (!!p.firstPerson !== !!firstPerson) continue;
    if (isF && !p.female) {
      const cur = out.get(slot);
      if (!cur) out.set(slot, p);
      else if (isHand && !cur.firstPerson && p.firstPerson) out.set(slot, p);
      continue;
    }
    if (isF !== !!p.female) continue;
    out.set(slot, p);   // proper match: LAST in load order wins
  }
  return out;
}

export function armReport(parts, race, female) {
  const want = String(race || '').toLowerCase();
  // MW-D32: the PICKS come from the one reference-whole resolver
  // (getBodyParts, npcanimation.cpp:1167-1297) - the report keeps its
  // verdict shape for the card, but no longer carries a second, subtly
  // different copy of the ladder.
  const fpResolved = resolveBodyParts(parts, race, female, { firstPerson: true });
  const tpResolved = resolveBodyParts(parts, race, female, { firstPerson: false });
  const rows = [];
  for (const slot of ARM_PARTS) {
    const forSlot = parts.filter((p) => p.race === want && p.slot === slot && p.skin && p.playable);
    const fp = forSlot.filter((p) => p.firstPerson);
    const tp = forSlot.filter((p) => !p.firstPerson);
    const resolved = fpResolved.get(slot) ?? null;
    const chosenFp = resolved && resolved.firstPerson ? resolved : null;
    const chosenTp = resolved && !resolved.firstPerson ? resolved : (tpResolved.get(slot) ?? null);
    rows.push({
      slot,
      firstPerson: chosenFp,
      thirdPersonFallback: chosenTp,
      // Rule 3: only these four may fall back at all, and this IS one of them.
      verdict: chosenFp ? 'first-person record found'
        : chosenTp ? 'no .1st record - falls back to the third-person mesh (allowed for arms)'
          : 'NOTHING for this slot',
      counts: { firstPerson: fp.length, thirdPerson: tp.length },
    });
  }
  return rows;
}

/**
 * MW-D24: THE THIRD-PERSON BODY, one row per slot. The same question
 * armReport answers for the four arm slots, asked for every slot the
 * body has, in the THIRD-PERSON records (the ones whose id does not end
 * "1st" - rule 1). Sex picks with the male fallback retail relies on
 * (assembleNpc's law); head and hair are skin-type BODY records like
 * everything else. A missing tail on a non-beast race is the data
 * being right.
 *
 * THE FACE IS DERIVED, NOT CHOSEN (Mac's call, 2026-08-30): classic
 * chargen stays byte-for-byte - the portrait strip, faceIndex 0..9 -
 * and the Morrowind head and hair are a pure function of what classic
 * already saved. faceIndex indexes the race-and-sex's own playable
 * head list and hair list, modulo their counts, so every classic face
 * resolves to SOME real face, a save from before this slice resolves
 * the same way forever, and no schema changed. The pools are sorted BY
 * RECORD ID first: "first in file order" was the old law and file
 * order is a property of the load, not of the character - two archive
 * arrangements would give one save two faces. Sorted, index 0 lands on
 * the _01 records vanilla names first, which is exactly what the old
 * first-in-file pick chose on retail. Every slot that is not the head
 * or the hair keeps index 0 - a chest has one skin record and a face
 * has six, and only the face was ever a choice in Daggerfall.
 */
/** MW-D35: the race-and-sex's head and hair pools, id-sorted - THE
 *  SAME pools playerBodyRows walks, exposed so the matcher measures
 *  exactly the candidates the walk would have chosen among. */
export function facePools(parts, race, female) {
  const want = String(race || '').toLowerCase();
  const pool = (slot) => {
    const forSlot = (parts ?? []).filter((p) => p.race === want && p.slot === slot
      && p.skin && p.playable && !p.firstPerson);
    const sexed = forSlot.filter((p) => p.female === !!female);
    return (sexed.length ? sexed : forSlot.filter((p) => !p.female))
      .slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };
  return { heads: pool('head'), hairs: pool('hair') };
}

export function playerBodyRows(parts, race, female, { beast = false, faceIndex = 0, faceTable = FACE_TABLE, faceMatch = null } = {}) {
  const want = String(race || '').toLowerCase();
  // MW-D32: the sweep slots resolve through getBodyParts-whole
  // (npcanimation.cpp:1167-1297 - LAST proper match wins, male-for-
  // female fallback fills, no vampire filter, playable filtered), and
  // clavicle is OUT: sBodyPartMap never maps it to a slot.
  const resolved = resolveBodyParts(parts, race, female, { firstPerson: false });
  const rows = [];
  for (const slot of SKIN_SWEEP_SLOTS) {
    const forSlot = parts.filter((p) => p.race === want && p.slot === slot
      && p.skin && p.playable && !p.firstPerson);
    const chosen = resolved.get(slot) ?? null;
    if (!chosen && slot === 'tail' && !beast) continue;
    rows.push({
      slot,
      record: chosen,
      verdict: chosen ? 'third-person record found' : 'NOTHING for this slot',
      counts: { all: forSlot.length },
    });
  }
  // Head and hair are NOT in the skin sweep (sBodyPartMap has no
  // MP_Head/MP_Hair rows): the actor's own record names them, and the
  // player's stand-in is the chargen face law below.
  //
  // MW-D33 (parallel arc): THE CURATION TABLE. Mac's report: the
  // derived head and hair do not match the portrait - the modulo walk
  // is deterministic but it is not a LIKENESS, and a likeness is a
  // judgement no arithmetic makes. mwFaceTable.json holds the
  // judgements: race -> sex -> faceIndex -> { head, hair } record ids,
  // authored by eye. A curated id wins when the pool carries it; an id
  // the archives do not carry falls back to the walk (never traps),
  // and the row's verdict says which happened.
  const curated = faceTable?.[want]?.[female ? 'female' : 'male']?.[String(faceIndex | 0)] ?? null;
  for (const slot of ['head', 'hair']) {
    const forSlot = parts.filter((p) => p.race === want && p.slot === slot
      && p.skin && p.playable && !p.firstPerson);
    // The sex law, list-shaped: the matching sex's pool, else the male
    // pool retail relies on - never a mix, or the index would walk
    // across sexes.
    const sexed = forSlot.filter((p) => p.female === !!female);
    const pool = sexed.length ? sexed : forSlot.filter((p) => !p.female);
    // AUDIT MW-A F2: the sort and the index are the FACE'S law and no
    // one else's. Head and hair sort by id so a save's face survives
    // any archive arrangement; the sweep slots above ride
    // resolveBodyParts, the reference's own LAST-wins walk, untouched.
    let chosen = null;
    let how = null;
    if (pool.length) {
      const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const wantId = curated ? String(curated[slot] || '').toLowerCase() : '';
      chosen = wantId ? sorted.find((p) => p.id === wantId) ?? null : null;
      how = chosen ? 'curated' : null;
      // MW-D35 (parallel arc): the MEASURED match sits between the
      // hand-curated table and the walk - a likeness computed from the
      // player's own data, named as such on the row.
      if (!chosen && faceMatch?.[slot]) {
        const mid = String(faceMatch[slot]).toLowerCase();
        chosen = sorted.find((p) => p.id === mid) ?? null;
        how = chosen ? 'matched to the portrait' : null;
      }
      if (!chosen) {
        chosen = sorted[((faceIndex % sorted.length) + sorted.length) % sorted.length];
        how = wantId ? `derived (curated "${wantId}" is not in these archives)` : 'derived';
      }
    }
    rows.push({
      slot,
      record: chosen,
      verdict: chosen ? (how ? `third-person record found, ${how}` : 'third-person record found') : 'NOTHING for this slot',
      counts: { all: forSlot.length },
    });
  }
  return rows;
}

/** MW-D2: IS THIS MESH SKINNED, OR RIGID?
 *
 * The question MW8's entire design rested on and nobody ever asked of a
 * real file. MW8 concluded Morrowind's arms are RIGID meshes hung off a
 * bone, from reading OpenMW's two attach branches. If they are actually
 * SKINNED, that fix was wrong in the same way MW7's was.
 *
 * THIS IS A SCAN, NOT A PARSE, and it is named so you cannot forget that.
 * A Morrowind NIF (4.0.0.2) stores each record's TYPE NAME as a sized
 * string immediately before the record, and there are no per-record sizes
 * - which is exactly why an unknown type is fatal to a real reader (rule:
 * niffile.cpp throws). A full walk therefore needs every record's layout.
 * But the type NAMES are recoverable without any of that: a uint32 length
 * followed by that many bytes of a NIF type name is a pattern a mesh's
 * other contents essentially never produce.
 *
 * So this answers "does a NiSkinInstance appear in this file" with high
 * confidence and answers NOTHING about geometry, transforms or bones. It
 * is a census, offered as a census.
 */
export function scanNifRecordTypes(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const census = new Map();
  const NAME = /^[A-Z][A-Za-z0-9_]{2,39}$/;
  for (let i = 0; i + 4 < bytes.length; i++) {
    const len = dv.getUint32(i, true);
    if (len < 3 || len > 40 || i + 4 + len > bytes.length) continue;
    let ok = true;
    for (let j = i + 4; j < i + 4 + len; j++) {
      const c = bytes[j];
      if (c < 0x30 || c > 0x7a || (c > 0x39 && c < 0x41) || (c > 0x5a && c < 0x61 && c !== 0x5f)) { ok = false; break; }
    }
    if (!ok) continue;
    const name = latin1(bytes.subarray(i + 4, i + 4 + len));
    if (!NAME.test(name)) continue;
    // Morrowind's own vocabulary: almost everything is Ni*, plus a short
    // tail of engine markers. Anything else is far more likely to be a
    // coincidence in vertex data than a record type.
    if (!/^Ni/.test(name) && !['RootCollisionNode', 'AvoidNode'].includes(name)) continue;
    census.set(name, (census.get(name) || 0) + 1);
    i += 3 + len;
  }
  return census;
}

/** The verdict, with its own uncertainty attached. `skinned` is only ever
 *  true because a NiSkinInstance was SEEN - never inferred from absence of
 *  something else. */
export function skinVerdict(bytes) {
  const header = readNifHeader(bytes);
  if (!header.ok) return { ok: false, why: header.why };
  const census = scanNifRecordTypes(bytes);
  const skinInstances = census.get('NiSkinInstance') || 0;
  const shapes = (census.get('NiTriShape') || 0) + (census.get('NiTriStrips') || 0);
  return {
    ok: true,
    version: header.versionText,
    skinned: skinInstances > 0,
    skinInstances,
    shapes,
    census: [...census.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    method: 'record-type SCAN, not a parse - it can tell you a NiSkinInstance is present, nothing more',
  };
}

/** Where an arm slot's mesh actually lives in the archive: the record the
 *  engine would use for this actor, then its own MODL under meshes/.
 *  Rule: the .1st RECORD carries its own mesh name; the path is never
 *  built by splicing .1st into a filename. */
export function armMeshPaths(rows) {
  return rows.map((row) => {
    const rec = row.firstPerson || row.thirdPersonFallback || null;
    return {
      slot: row.slot,
      record: rec ? rec.id : null,
      firstPerson: !!row.firstPerson,
      path: rec && rec.model ? `meshes/${rec.model}` : null,
    };
  });
}

/** MW-D3: PARSE THE MESH FOR REAL, AND SHOW IT.
 *
 * The scan above answers "is there a NiSkinInstance" without parsing. This
 * does the opposite: it runs the restored strict reader (parseNif +
 * flattenNif, MW-IMPORT slices 1-2) over an actual arm mesh and hands back
 * geometry a page can draw.
 *
 * IT IS ALLOWED TO FAIL, AND SAYING SO IS THE POINT. An unknown record
 * type throws and kills the whole file - that is the format, not a bug in
 * the reader (niffile.cpp has no skip path). A community-mesh sweep put
 * 602 such failures across 14 record types on the worklist. So a failure
 * here is a FACT about which records this file needs, reported with the
 * message, not swallowed into an empty view the way the reverted rig
 * swallowed everything.
 */
export async function parseMeshForPreview(bytes) {
  let parseNif; let flattenNif;
  try {
    ({ parseNif } = await import('./mwNifFile.js'));
    ({ flattenNif } = await import('./mwNifMesh.js'));
  } catch (err) {
    return { ok: false, error: `reader unavailable: ${err.message}` };
  }
  let nif;
  try {
    nif = parseNif(bytes);
  } catch (err) {
    return { ok: false, stage: 'parse', error: err.message };
  }
  let batches;
  try {
    batches = flattenNif(nif);
  } catch (err) {
    return { ok: false, stage: 'flatten', error: err.message };
  }
  const shapes = batches.map((b) => ({
    positions: b.positions,
    indices: b.indices,
    skinned: !!(b.skinned && b.skin),
    vertices: b.positions ? b.positions.length / 3 : 0,
    triangles: b.indices ? b.indices.length / 3 : 0,
  })).filter((s) => s.vertices > 0 && s.triangles > 0);
  if (!shapes.length) return { ok: false, stage: 'geometry', error: 'parsed, but it carries no drawable geometry' };
  return {
    ok: true,
    shapes,
    vertices: shapes.reduce((n, s) => n + s.vertices, 0),
    triangles: shapes.reduce((n, s) => n + s.triangles, 0),
    skinnedShapes: shapes.filter((s) => s.skinned).length,
    bounds: meshBounds(shapes),
  };
}

/** Axis-aligned bounds over every shape, for framing a preview.
 *  Morrowind is Z-UP, so a front view is x across and z up. */
export function meshBounds(shapes) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (const s of shapes) {
    const p = s.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
      if (p[i + 2] < minZ) minZ = p[i + 2];
      if (p[i + 2] > maxZ) maxZ = p[i + 2];
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Fit the bounds into a w x h box, front view (x across, z up, z flipped
 *  because canvas y grows downward). Returns a point mapper. Uniform
 *  scale - a per-axis fit would make a hand look correct while hiding
 *  proportions that are actually wrong. */
export function frontViewMapper(bounds, w, h, pad = 8) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1e-6);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return (x, y, z) => [w / 2 + (x - cx) * scale, h / 2 - (z - cz) * scale];
}

/** MW-D4: DOES YOUR SKELETON HAVE THE BONES THE RULES NAME?
 *
 * Rule 5 records OpenMW's part-to-bone table verbatim - "Right Hand",
 * "Left Upper Arm", "Weapon Bone" and the rest - read out of
 * npcanimation.cpp:200-260. Rule 16 records that lookup is CASE-
 * INSENSITIVE, lowercased on both sides, and that duplicate names resolve
 * to the first in depth-first order.
 *
 * All of that came off source. None of it has been checked against a
 * skeleton in an actual archive. If a name is wrong, every attach silently
 * finds nothing and the rig draws an empty view - which is the failure
 * this whole effort keeps circling. So ask the file.
 */
export async function skeletonReport(bytes) {
  let parseNif; let buildSkeleton;
  try {
    ({ parseNif } = await import('./mwNifFile.js'));
    ({ buildSkeleton } = await import('./mwSkin.js'));
  } catch (err) {
    return { ok: false, error: `reader unavailable: ${err.message}` };
  }
  let skel;
  try {
    skel = buildSkeleton(parseNif(bytes));
  } catch (err) {
    return { ok: false, stage: 'parse', error: err.message };
  }
  const names = [...skel.nodes.values()].map((n) => n.name).filter(Boolean);
  return {
    ok: true,
    boneCount: skel.nodes.size,
    names,
    // Rule 16: lowercased on both sides. The report must use the SAME
    // comparison the binder will, or it answers a question nobody asked.
    has: (name) => skel.byName.has(String(name).toLowerCase()),
  };
}

/** The bones a first-person arm actually needs, per rule 5, plus the two
 *  weapon bones rule 17 says are chosen per weapon type. Names are given
 *  in the engine's own spelling; the lookup lowercases. */
export const FP_REQUIRED_BONES = Object.freeze([
  { name: 'Left Hand', why: 'hand, left side' },
  { name: 'Right Hand', why: 'hand, right side' },
  { name: 'Left Wrist', why: 'wrist, left side' },
  { name: 'Right Wrist', why: 'wrist, right side' },
  { name: 'Left Forearm', why: 'forearm, left side' },
  { name: 'Right Forearm', why: 'forearm, right side' },
  { name: 'Left Upper Arm', why: 'upper arm, left side' },
  { name: 'Right Upper Arm', why: 'upper arm, right side' },
  { name: 'Weapon Bone', why: 'every weapon type except the bow' },
  { name: 'Weapon Bone Left', why: 'the BOW, and only the bow (rule 8)' },
  { name: 'Bip01 Spine1', why: 'blend mask: Torso (rule 9)' },
  { name: 'Bip01 L Clavicle', why: 'blend mask: LeftArm' },
  { name: 'Bip01 R Clavicle', why: 'blend mask: RightArm' },
]);

/** Which of them this skeleton actually carries. A missing bone is
 *  reported as missing, never worked around - a silent fallback here is
 *  how an empty view gets called a working one. */
export function checkRequiredBones(report) {
  if (!report || !report.ok) return [];
  return FP_REQUIRED_BONES.map((b) => ({ ...b, present: report.has(b.name) }));
}

/** MW-D5: ASSEMBLE THE ARM.
 *
 * The first step that PLACES parts relative to one another rather than
 * examining them one at a time. Everything here is a recorded rule, and
 * the two the reverted arc got backwards are the two doing the work:
 *
 *  rule 12 - skinned and rigid parts take COMPLETELY different paths. A
 *    skinned part's geometry is skinned to the actor's skeleton and is
 *    never parented to a bone. A rigid part is placed AT a bone.
 *  rule 13 - a rigid part whose attach bone's name contains "Left" is
 *    drawn with x negated. One mesh serves both sides. MW8 attached the
 *    same mesh at both bones with no mirror, so its left hand was a
 *    second right hand.
 *  rule 15 - for a skinned part the bone name is ALSO a geometry filter:
 *    a case-insensitive prefix match on the shape name with Morrowind's
 *    "Tri " convention stripped. That is how a skinned part picks its
 *    side, where a rigid one uses the mirror.
 *
 * MW-D7 SPLIT THIS IN TWO, and the sentence that used to end this block -
 * "rest pose only, no clip, no time; animation is the next stage" - is
 * gone because it stopped being true. This function still BINDS only:
 * parse, skeleton, rule 15's filter, rule 13's mirror, the attach ref and
 * the output buffers, none of which depend on time. It ends by calling
 * poseAssembly once, so the rest pose is now "pose at t=0 with no tracks"
 * rather than a second copy of the same arithmetic - which is what lets
 * the result be re-posed at all.
 */
export async function assembleFirstPersonArm({ skeletonBytes, parts }) {
  const mod = {};
  try {
    ({ parseNif: mod.parseNif } = await import('./mwNifFile.js'));
    ({ buildSkeleton: mod.buildSkeleton, poseSkeleton: mod.poseSkeleton,
      skeletonSpaceMatrices: mod.skelMats, skinBatch: mod.skinBatch,
      accumRootRef: mod.accumRootRef, trackBinding: mod.trackBinding } = await import('./mwSkin.js'));
    ({ bindPart: mod.bindPart, attachmentTransform: mod.attachmentTransform } = await import('./mwCharacter.js'));
    ({ PART_BONES: mod.PART_BONES } = await import('./mwNpc.js'));
  } catch (err) {
    return { ok: false, error: `readers unavailable: ${err.message}` };
  }

  let skeleton;
  try {
    skeleton = mod.buildSkeleton(mod.parseNif(skeletonBytes));
  } catch (err) {
    return { ok: false, stage: 'skeleton', error: err.message };
  }
  const rootRef = [...skeleton.nodes.entries()].find(([, n]) => n.parent < 0)?.[0] ?? -1;

  const pieces = [];
  const notes = [];
  bindPartsInto({ pieces, notes, skeleton, fns: mod }, parts);
  const assembly = {
    ok: pieces.length > 0,
    pieces,
    notes,
    skeleton,
    rootRef,
    // The resolved readers ride along so the per-frame call is SYNCHRONOUS.
    // A dynamic import inside a requestAnimationFrame body is a promise per
    // frame; this function already paid for them once.
    fns: mod,
    bounds: null,
    error: pieces.length ? null : 'nothing bound - see the notes for why',
  };
  // THE REST POSE IS NOW "pose at t=0 with no tracks" - one home, and the
  // MW-D5/D6 pins keep seeing byte-identical numbers because they are the
  // same arithmetic, called once instead of inlined.
  return pieces.length ? poseAssembly(assembly) : assembly;
}

/**
 * MW-D19: THE PART LOOP, callable on a LIVE assembly. The build calls it
 * once with every part; a weapon swap calls it again with just the new
 * weapon and arrow, through the very same bind, filter, mirror and note
 * paths - a second copy of any of those is how MW7 died. Mutates
 * `assembly.pieces` and `assembly.notes` in place.
 */
export function bindPartsInto(assembly, parts) {
  const mod = assembly.fns;
  const { skeleton, pieces, notes } = assembly;
  for (const part of parts) {
    // `part.bones` overrides the table so a test can drive real assembly
    // against a fixture skeleton whose bone names are not Morrowind's.
    const bones = part.bones ?? mod.PART_BONES[part.slot] ?? [];
    let nif;
    try {
      nif = mod.parseNif(part.bytes);
    } catch (err) {
      notes.push(`${part.slot}: ${err.message}`);
      continue;
    }
    // MW-D6: the nameless-shape extension binds ONCE for the part; a
    // NAMED shape binds once PER SIDE, filtered. See the block below.
    let tookNameless = false;
    const piecesBefore = pieces.length;
    let shapeCensus = null;
    for (const bone of bones.length ? bones : [null]) {
      if (bone && !skeleton.byName.has(bone.toLowerCase())) {
        notes.push(`${part.slot}: this skeleton has no bone "${bone}"`);
        continue;
      }
      let bound;
      try {
        bound = mod.bindPart(skeleton, nif, bone ? { attachBone: bone } : {});
      } catch (err) {
        notes.push(`${part.slot} @ ${bone}: ${err.message}`);
        continue;
      }
      const bonePiecesBefore = pieces.length;
      // RULE 40's report: skipped influences draw wrong, not invisibly,
      // so the card must say WHY a finger sags or a strip collapses.
      // One note per part, not per bone - the names are the same.
      if (bound.missingBones?.length) {
        const say = `${part.slot}: this skeleton has no bone `
          + `${bound.missingBones.map((b) => `"${b}"`).join(', ')} - `
          + 'those influences are skipped (rule 40)';
        if (!notes.includes(say)) notes.push(say);
      }
      shapeCensus ??= bound.skinned.map((b) => String(b.name || '').trim() || '(nameless)');

      // RULE 12 + 15: skinned geometry carries its own bones, so it is
      // never MIRRORED - it picks its side by the shape NAME. And it
      // binds ONCE PER SIDE, not once per part.
      //
      // MW-D6 CORRECTION. This block used to be wrapped in a
      // `if (!tookSkinned)` latch raised by the first bone that yielded
      // any skinned batch, so a two-bone slot - and every arm slot is one
      // (`PART_BONES.hand = ['left hand','right hand']`) - emitted the
      // LEFT hand and never asked for the right. The filter that exists
      // precisely to pick a side ran once and then was skipped, which on
      // retail data is a one-handed arm.
      //
      // Rule 4 is what the latch contradicted: sPartList is a MULTIMAP,
      // `{ MP_Hand, PRT_RHand }, { MP_Hand, PRT_LHand }` - one mesh part,
      // two slots, "each side its own part reference at its own bone".
      // The doc already warns that the first attempt "treated a part as
      // one mesh attached at two bones in one pass"; the latch was the
      // same error wearing the other face.
      //
      // A latch is still needed, but only for the port's own EXTENSION to
      // rule 15: a shape with no name matches every bone (OpenMW's
      // ciStartsWith("", filter) is false and the engine drops it), so a
      // nameless one-shape part would bind at every side and stack
      // duplicates in the same place. That one binds once.
      // MW-D31 / rule 15's HAIR EXCEPTION: the hair part attaches at the
      // Head bone but its geometry filter is the word "hair"
      // (npcanimation.cpp:801 - `bonefilter = (type == PRT_Hair) ?
      // "hair" : bonename`). Every other slot filters on its bone name.
      const geomFilter = part.slot === 'hair' ? 'hair' : bone;
      let namelessHere = false;
      for (const batch of bound.skinned) {
        const nameless = !String(batch.name || '').trim();
        if (nameless && tookNameless) continue;
        if (geomFilter && !shapeMatchesBone(batch.name, geomFilter)) continue;
        // MW-D7: the piece KEEPS its batch, and `positions` is its own
        // buffer - never an alias of batch.positions, which poseAssembly
        // reads every frame. Aliasing them is the runaway the viewer
        // documents at mwViewer.js:430-436.
        pieces.push({ slot: part.slot, bone, kind: 'skinned', mirrored: false,
          batch, source: null, attachRef: null,
          // MW-D11: the UVs and the material ride WITH the piece. They
          // were reachable through `batch` for a skinned piece and lost
          // entirely for a rigid one (which keeps only its positions), so
          // the texture a Morrowind mesh names never reached the draw.
          uvs: batch.uvs || null, colors: batch.colors || null, material: batch.material || null,
          positions: new Float32Array(batch.positions.length), indices: batch.indices });
        if (nameless) namelessHere = true;
      }
      tookNameless = tookNameless || namelessHere;

      // RULE 12 + 13: a rigid part is PLACED at the bone, once per side,
      // with x negated on the left.
      //
      // MW-D31: the skinned-vs-rigid branch is decided per FILE, not per
      // shape. One skinned geometry makes the whole file a rig
      // (node.cpp:275-276 sets mUseSkinning; nifloader wraps the roots
      // in a Skeleton) and attach() then takes the CopyRigVisitor
      // branch, which seeds ONLY RigGeometry drawables
      // (attach.cpp:42-46 `if (!isRig) return;`) - an unskinned shape
      // in that file never takes the rigid path's mirror/offset, it is
      // drawn only as part of a copied rig ancestor's subtree, which
      // this flattened graph cannot express. So a rig file's rigid
      // batches are NOTED and dropped rather than mirrored into places
      // the reference never draws them.
      if (bound.attached.length && bound.skinned.length) {
        const say = `${part.slot}: ${bound.attached.length} unskinned shape(s) in a RIG file are not `
          + 'attached (attach.cpp:42-46 seeds only skinned geometry)';
        if (!notes.includes(say)) notes.push(say);
      } else if (bound.attached.length) {
        // The mirror is fixed HERE, at bind time, because it is a fact
        // about the bone's NAME, not about the pose. Re-deriving it per
        // frame invites a pose-dependent mirror, which is a left hand
        // that flips sides mid-clip.
        //
        // MW-D31 / rule 13: the reference tests the RESOLVED node's own
        // name, case-SENSITIVELY (attach.cpp:166 - `attachNode->getName()
        // .find("Left") != npos`). The requested name in the part table
        // is lowercase; the node the skeleton actually carries is what
        // decides.
        const nodeRef = bone ? skeleton.byName.get(bone.toLowerCase()) : null;
        const nodeName = nodeRef != null && skeleton.nodes.has(nodeRef) ? skeleton.nodes.get(nodeRef).name : (bone || '');
        const mirror = nodeName.includes('Left');
        for (const batch of bound.attached) {
          pieces.push({ slot: part.slot, bone, kind: 'rigid', mirrored: mirror,
            // MW-D16: a part instanced under a node INSIDE another part's
            // mesh (the arrow, under the bow's ArrowBone) carries that
            // node's whole chain. It is baked in ONCE here rather than
            // applied per frame, because it is a fact about two FILES and
            // not about the pose.
            batch: null, source: applyPre(batch.positions, part.preTransform), attachRef: bound.attachRef,
            // Rule 14: the part's own BoneOffset node, resolved once at
            // bind time because it is a fact about the FILE.
            //
            // MW-D34: AMMUNITION is the one part that never takes it.
            // attachArrow does not go through SceneUtil::attach - it is
            // a bare `getInstance(model, parent)` under getArrowBone()
            // (weaponanimation.cpp:87-93) - so the arrow mesh's own
            // "BoneOffset" node is never searched for and never applied.
            // What the arrow DOES inherit is its parent chain: the
            // weapon's node (preTransform above) when it rides the
            // weapon's ArrowBone, mirror and all.
            boneOffset: part.ammo ? null : (bound.boneOffset || null),
            uvs: batch.uvs || null, colors: batch.colors || null, material: batch.material || null,
            positions: new Float32Array(batch.positions.length), indices: batch.indices });
        }
      }
      // THE SILENT HOLE, CLOSED. A bone whose every NAMED skinned shape
      // fails rule 15's filter used to bind NOTHING and say NOTHING -
      // the card read "on - N pieces" with a side simply absent from
      // the arm, which is both the missing-hand hole and the MW-D6
      // one-handed defect wearing a new face. If this bone gained no
      // piece and the part had named shapes to offer, the note lists
      // them against the filter. (A nameless shape skipped by the
      // once-per-part latch is correct and stays silent: `named` is
      // empty for it.)
      if (pieces.length === bonePiecesBefore && bone) {
        const named = bound.skinned
          .map((b) => String(b.name || '').trim())
          .filter((s) => s);
        // No attached-geometry guard: rigid geometry always binds, so
        // reaching here with no new piece already means attached was
        // empty - a guard on it would be a branch no fixture can take.
        if (named.length) {
          notes.push(`${part.slot} @ ${bone}: no shape matched - the mesh offers `
            + `${named.map((s) => `"${s}"`).join(', ')} (rule 15's filter is a `
            + 'case-insensitive prefix, "tri " stripped first)');
        }
      }
    }
    // And a part that contributed nothing AT ALL with geometry in hand
    // (both sides missed, or an empty mesh) is one sentence, not a hole.
    if (pieces.length === piecesBefore && shapeCensus && !shapeCensus.length) {
      notes.push(`${part.slot}: nothing bound - the mesh has no geometry to bind`);
    }
  }
}

/**
 * MW-D7: POSE THE ASSEMBLY. The one home for everything that changes when
 * time does - and the reason assembleFirstPersonArm's return value can be
 * re-posed at all.
 *
 * What is recomputed here, and nothing else:
 *   - the pose (one poseSkeleton over the whole skeleton);
 *   - the skeleton-space matrices, MEMOISED PER SKELETON ROOT. The
 *     assembly had been walking the chain once per skinned batch; the
 *     distinct roots are what the walk actually depends on, and on an arm
 *     that is one.
 *   - per skinned piece: skinBatch into the piece's own buffer;
 *   - per rigid piece: the attachment affine, which now carries the
 *     bone's ANIMATED rotation, so rigid parts move too. A stage that
 *     re-skinned the skinned half and left the rigid half at rest would
 *     draw a hand that animates inside a cuff that does not.
 *
 * What is NOT recomputed, because it is a fact about the files and not
 * about time: the parse, the skeleton, the bind, rule 15's shape filter,
 * rule 13's mirror, the attach ref, the output buffers, and the draw
 * mapper. A mapper that follows the per-frame bounds renormalises the
 * picture every frame and hides the very motion this stage exists to show.
 *
 * Mutates `assembly` in place and returns it.
 */
/**
 * RULE 54, VERBATIM: THE FIRST-PERSON CAMERA IS A NODE OF THE RIG.
 *
 *   mAnimation->setViewMode(NpcAnimation::VM_FirstPerson);
 *   mTrackingNode = mAnimation->getNode("Camera");
 *   if (!mTrackingNode) mTrackingNode = mAnimation->getNode("Head");
 *   mHeightScale = 1.f;
 *                            - mwrender/camera.cpp:346-357
 *
 * and the position it yields is that node's world TRANSLATION with no
 * height term at all in first person (calculateTrackedPosition, :87-99:
 * the `res.z() += mHeight * mHeightScale` line is inside
 * `if (mMode != Mode::FirstPerson)`).
 *
 * There is no third fallback. A rig with neither node has no first-person
 * camera, and inventing one is what MW-D8's port mapper did.
 */
export function firstPersonCameraRef(skeleton) {
  const byName = skeleton && skeleton.byName;
  if (!byName) return -1;
  if (byName.has('camera')) return byName.get('camera');
  if (byName.has('head')) return byName.get('head');
  return -1;
}

/** The node NpcAnimation hangs the first-person RotateController on. */
export const FP_NECK_BONE = 'bip01 neck';

/**
 * NpcAnimation::runAnimation (:711-723), whole:
 *
 *   if (mAccurateAiming) mAimingFactor = 1.f;
 *   else mAimingFactor = std::max(0.f, mAimingFactor - timepassed * 0.5f);
 *   float rotateFactor = 0.75f + 0.25f * mAimingFactor;
 *
 * MW-D13 CLOSED THE OTHER HALF. The factor is not the constant 0.75 the
 * port shipped: it is 0.75 at rest and rises to 1.0 WHILE AIMING, which
 * is `mUpperBodyState > UpperBodyState::WeaponEquipped`
 * (character.cpp:1894) - every attack section, and nothing else. So the
 * arms lag the look by a quarter of it normally and follow it EXACTLY
 * while you are swinging, which is what makes a blow land where you are
 * looking.
 *
 * The rise is INSTANT and the fall is a 0.5-per-second ramp, so the arms
 * snap onto the aim and drift back off it over two seconds. An
 * implementation that eased both ways, or that decayed per frame instead
 * of per second, would look almost right and be wrong at every frame
 * rate but one.
 *
 * MW-D12's upper-body machine is what makes this reachable at all - with
 * a constant idle there was no aiming state to be in, which is why the
 * constant was honest when it was written and is a gap now.
 */
export const FP_NECK_ROTATE_FACTOR = 0.75;
export const FP_AIM_SPAN = 0.25;
export const FP_AIM_DECAY_PER_SECOND = 0.5;

/** mAimingFactor's own step. `prev` is last frame's value; the caller
 *  keeps it, because it is a decaying state and not a function of the
 *  current frame alone. */
export function aimingFactor(prev, accurate, dt) {
  if (accurate) return 1;
  return Math.max(0, (prev || 0) - dt * FP_AIM_DECAY_PER_SECOND);
}

/** rotateFactor, which is what multiplies the pitch. */
export function neckRotateFactor(aim = 0) {
  return FP_NECK_ROTATE_FACTOR + FP_AIM_SPAN * aim;
}

const mul33 = (p, l) => {
  const a = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      a[r * 3 + c] = p[r * 3] * l[c] + p[r * 3 + 1] * l[3 + c] + p[r * 3 + 2] * l[6 + c];
    }
  }
  return a;
};
const transpose33 = (m) => Float32Array.from([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);

/**
 * `matrix.getRotate()` - the ROTATION, with the scale divided out.
 *
 * MW-D15: the skeleton-space 3x3 this module works in is rotation TIMES
 * SCALE (rule 55 folds a NIF's uniform scale into the matrix), and
 * RotateController takes `worldMat.getRotate()`, which is the rotation
 * alone. Conjugating with the scaled matrix gives `s^2 * (R rot R^T)`
 * and translating with its transpose gives `s * offset` - both silently
 * correct at s = 1, which every fixture and most retail rigs are, and
 * both wrong the moment a rig scales its neck chain.
 *
 * NIF scale is a single float, so the columns share one length and one
 * division does it.
 */
const rotationOf = (m) => {
  const s = Math.hypot(m[0], m[3], m[6]);
  if (!(s > 1e-8) || Math.abs(s - 1) < 1e-6) return m;
  const out = new Float32Array(9);
  for (let i = 0; i < 9; i++) out[i] = m[i] / s;
  return out;
};
/** Rotation about -X by `rad`, which is the axis the neck controller
 *  takes: `osg::Quat(pitch * rotateFactor, osg::Vec3f(-1, 0, 0))`. */
const rotNegX = (rad) => {
  const c = Math.cos(rad); const sn = Math.sin(rad);
  return Float32Array.from([1, 0, 0, 0, c, sn, 0, -sn, c]);
};

/**
 * The first-person neck rotation, applied the way RotateController does
 * it (mwrender/rotatecontroller.cpp:41-60):
 *
 *   worldOrient = rotation of the node's matrix relative to the object root
 *   orient = worldOrient * mRotate * worldOrient^-1 * matrix.getRotate()
 *
 * i.e. the pitch is expressed in the OBJECT ROOT's frame and conjugated
 * into the node's own, then PRE-multiplied onto whatever the animation
 * already put there. Doing it in the node's local frame instead would
 * pitch the head sideways as soon as the neck is not axis-aligned.
 */
export function applyFirstPersonNeck(skeleton, pose, rootRef, skelMats, pitch, aim = 0, offset = null) {
  const ref = skeleton && skeleton.byName ? skeleton.byName.get(FP_NECK_BONE) : undefined;
  const sinking = !!(offset && (offset[0] || offset[1] || offset[2]));
  if (ref === undefined || (!pitch && !sinking)) return false;
  const world = skelMats(skeleton, pose, rootRef).get(ref);
  if (!world) return false;
  const local = pose.get(ref) ?? skeleton.nodes.get(ref).rest;
  const w = rotationOf(world.a);
  const rotate = rotNegX(pitch * neckRotateFactor(aim));
  const rotation = mul33(mul33(mul33(w, rotate), transpose33(w)), local.rotation);
  // RULE 32(a), and it rides the SAME controller as the pitch because it
  // is the same line of the same function:
  //   matrix.setTrans(matrix.getTrans() + worldOrientInverse * mOffset);
  //                                     (rotatecontroller.cpp:52)
  // worldOrientInverse turns a vector given in the OBJECT ROOT's space
  // into the neck's own, which is the transpose of the same world 3x3 the
  // rotation is conjugated by. Applying the offset in the neck's local
  // frame instead would sink the body along whatever way the neck
  // happens to be pointing.
  let translation = local.translation;
  if (sinking) {
    const inv = transpose33(w);
    translation = [
      local.translation[0] + inv[0] * offset[0] + inv[1] * offset[1] + inv[2] * offset[2],
      local.translation[1] + inv[3] * offset[0] + inv[4] * offset[1] + inv[5] * offset[2],
      local.translation[2] + inv[6] * offset[0] + inv[7] * offset[1] + inv[8] * offset[2],
    ];
  }
  pose.set(ref, { rotation, translation, scale: local.scale });
  return true;
}

export function poseAssembly(assembly, { tracks = null, sampleTrack = null,
  time = 0, accumRoot = null, neckPitch = 0, neckAim = 0, neckOffset = null } = {}) {
  const { fns, skeleton, pieces } = assembly;
  if (!fns || !skeleton) return assembly;
  const pose = fns.poseSkeleton(skeleton, tracks, sampleTrack, time, { accumRoot });
  // MW-D20: ONE SPACE. The reference poses every piece - skinned, rigid,
  // and the camera node rule 54 reads - in the same space, the full
  // graph below the Skeleton group with the root node's own transform
  // included. What stood here memoised matrices PER DECLARED SKIN ROOT
  // and placed rigid pieces relative to the file root: two spaces that
  // coincide exactly when every declared root is the root and the root's
  // transform is identity - true of every fixture, false of retail data,
  // where the difference is a hand floating away from its forearm.
  applyFirstPersonNeck(skeleton, pose, GRAPH_ROOT, fns.skelMats, neckPitch, neckAim, neckOffset);
  const mats = fns.skelMats(skeleton, pose, GRAPH_ROOT);
  for (const p of pieces) {
    if (p.kind === 'skinned') {
      fns.skinBatch(p.batch, skeleton, pose, mats, p.positions, null);
    } else {
      const at = fns.attachmentTransform(mats, p.attachRef);
      placeAtBone(p.source, at, p.mirrored, p.positions, p.boneOffset);
    }
  }
  assembly.pose = pose;
  // The rig-space transform of every node, kept so rule 54 can read the
  // camera node's translation without re-posing the skeleton.
  assembly.mats = mats;
  assembly.time = time;
  assembly.bounds = pieces.length ? meshBounds(pieces) : null;
  return assembly;
}

/** MW-D6: one row per assembled piece, for the page's table and the
 *  probe's readback - so neither invents its own summary of the same
 *  data and the two can disagree.
 *
 *  KEYED BY SLOT **AND** BONE. Every arm slot is two-boned (rule 4's
 *  multimap), so a key of slot alone collides on exactly the case this
 *  stage exists to show. Bounds are PER PIECE, not the assembly's, which
 *  is what makes a left/right mix-up readable in a table as well as on
 *  the canvas. */
export function armPieceRows(pieces) {
  return (pieces ?? []).map((p) => ({
    key: `${p.slot} @ ${p.bone ?? '(no bone)'}`,
    slot: p.slot,
    bone: p.bone ?? null,
    kind: p.kind,
    mirrored: !!p.mirrored,
    // Rule 14, on the card: a part placed at its bone's bare origin and
    // one placed at its authored offset are the same picture until you
    // know which you are looking at.
    boneOffset: p.boneOffset || null,
    vertices: p.positions ? p.positions.length / 3 : 0,
    triangles: p.indices ? p.indices.length / 3 : 0,
    bounds: meshBounds([p]),
  }));
}

/** MW-D16: bake a part's pre-transform into its authored vertices. Null
 *  is the common case and returns the array untouched, so nothing pays
 *  for a feature it does not use. */
function applyPre(positions, pre) {
  if (!pre) return positions;
  const out = new Float32Array(positions.length);
  for (let v = 0; v < positions.length; v += 3) {
    const x = positions[v]; const y = positions[v + 1]; const z = positions[v + 2];
    out[v] = pre.a[0] * x + pre.a[1] * y + pre.a[2] * z + pre.t[0];
    out[v + 1] = pre.a[3] * x + pre.a[4] * y + pre.a[5] * z + pre.t[1];
    out[v + 2] = pre.a[6] * x + pre.a[7] * y + pre.a[8] * z + pre.t[2];
  }
  return out;
}

/** RULE 15's filter, verbatim: a case-insensitive PREFIX match on the
 *  shape name, with Morrowind's "Tri " convention stripped first. A shape
 *  with NO name matches everything, because a nameless shape in a
 *  one-shape part file is the part. */
export function shapeMatchesBone(shapeName, bone) {
  const name = String(shapeName || '').trim().toLowerCase();
  if (!name) return true;
  const want = String(bone).toLowerCase();
  if (name.startsWith(want)) return true;
  return name.startsWith('tri ') && name.slice(4).startsWith(want);
}

/** RULE 13, alone and directly testable: place a rigid part's vertices at
 *  a bone, mirroring x first when the part is going on the LEFT.
 *
 *  Extracted because the mirror could not be reached end-to-end - no
 *  fixture skeleton carries a bone whose name contains "left", so an
 *  assembly test simply never took this branch and three mutants survived
 *  a full sweep. A rule that cannot be exercised is not pinned, whatever
 *  the test output says.
 */
export function placeAtBone(positions, at, mirror, out = new Float32Array(positions.length), offset = null) {
  // RULE 14's OFFSET RIDES THE SAME TRANSFORM AS THE MIRROR, and the
  // ORDER is decided by OSG rather than chosen here: both are set on one
  // PositionAttitudeTransform, whose matrix is
  // T(position) * R(attitude) * S(scale). So the mirror scales the
  // vertex, the offset translates the result, and only then does the
  // bone place it. Adding the offset BEFORE the mirror would negate its
  // x on every left-hand part - the bow, among others.
  const ox = offset ? offset[0] : 0;
  const oy = offset ? offset[1] : 0;
  const oz = offset ? offset[2] : 0;
  for (let v = 0; v < positions.length; v += 3) {
    const x = (mirror ? -positions[v] : positions[v]) + ox;
    const y = positions[v + 1] + oy;
    const z = positions[v + 2] + oz;
    out[v] = at.a[0] * x + at.a[1] * y + at.a[2] * z + at.t[0];
    out[v + 1] = at.a[3] * x + at.a[4] * y + at.a[5] * z + at.t[1];
    out[v + 2] = at.a[6] * x + at.a[7] * y + at.a[8] * z + at.t[2];
  }
  return out;
}

/**
 * MW-D7: THE CLIP, READ AND REPORTED. One summary the page renders and the
 * probe reads back, so the two cannot invent different accounts of the
 * same file.
 *
 * `binding` is the field that earns its place. poseSkeleton answers an
 * unmatched bone with its rest transform, so a .kf keyed to bones this
 * skeleton does not have poses NOTHING and draws a clean, static,
 * entirely plausible arm. That failure is invisible in a picture and
 * invisible in a pixel count; it is only ever visible as a sentence.
 *
 * `tracks[].rotationType` is the second: it says how much of a player's
 * real file rides KEY_TYPE.constant, whose sampler this tree holds at the
 * previous key where the reference flips at the segment midpoint. That is
 * a different member with no fixture, deliberately not touched here - but
 * a player looking at their own data deserves to see how much of it is
 * affected rather than being told nothing.
 *
 * `legacy` is parseAnimGroups' answer to the same question, carried so
 * the page can show both. On the fixture they disagree by construction:
 * the listing reports Idle [1.00 -> 0.50], a range that runs backwards,
 * while the clip law reads [1.00 -> 3.00].
 */
/**
 * MW-D14 / RULE 6 + 18 + the SOURCE LIST, which is not one file.
 *
 * NpcAnimation::updateNpcBase (npcanimation.cpp:499-537) adds TWO
 * animation sources for a first-person actor, in this order:
 *
 *   base            = Settings::models().mXbaseanim1st  ("meshes/xbase_anim.1st.nif")
 *   defaultSkeleton = correctActorModelPath(getActorSkeleton(...))
 *
 *   addAnimSource(base, smodel);
 *   if (defaultSkeleton != base) addAnimSource(defaultSkeleton, smodel);
 *
 * and addAnimSource swaps a .nif extension for .kf and DROPS the source
 * silently when that file is not in the archive
 * (animation.cpp:646-671). For a MALE the two are the same string, so
 * there is one source and the port's single .kf was right; for a FEMALE
 * or a BEAST they differ, and the second one - when the archive carries
 * it - is the LAST inserted and therefore the one that wins
 * (`Look in reverse; last-inserted source has priority`,
 * animation.cpp:918-923).
 *
 * `use additional anim sources` is deliberately absent: it is an OpenMW
 * setting, default false, that scans an `animations/` folder Morrowind
 * does not ship.
 */
export const FP_BASE_MODEL = 'meshes/xbase_anim.1st.nif';

/** The .kf a model name names (animation.cpp:648-654): swap ONLY when
 *  the extension is exactly "nif". */
export function animSourceName(model) {
  const p = String(model || '').toLowerCase();
  return p.endsWith('.nif') ? `${p.slice(0, -4)}.kf` : p;
}

/**
 * The ordered source list, in PUSH order - the caller searches it in
 * REVERSE. `exists` is the archive probe; a source the archive lacks is
 * dropped here rather than refused, exactly as addSingleAnimSource does.
 */
export function fpAnimSources(skeletonPath, exists) {
  return animSourcesFor(FP_BASE_MODEL, skeletonPath, exists);
}

/** MW-D24: the reference's own unit bridge - constants.hpp:10,
 *  UnitsPerMeter. The camera's distances and the body's world scale
 *  both cross it, so it lives here in the format layer, once. */
export const MW_UNITS_PER_METER = 69.99125109;

/** MW-D24: the THIRD-PERSON base animation model (settings-default.cfg
 *  [Models] xbaseanim, updateNpcBase's `base` for every non-werewolf -
 *  npcanimation.cpp:506-508). Its .kf sibling is the file that carries
 *  idle/walk/attack for the whole visible body. */
export const TP_BASE_MODEL = 'meshes/xbase_anim.nif';

/** The third-person source list, same push order and existence filter as
 *  the first-person one: base first (npcanimation.cpp:529-530), then the
 *  actor's own skeleton when it differs (npcanimation.cpp:532-533). The
 *  kf name is the model with its extension swapped and NOTHING else -
 *  no "x" is inserted (animation.cpp:651-654). */
export function tpAnimSources(skeletonPath, exists) {
  return animSourcesFor(TP_BASE_MODEL, skeletonPath, exists);
}

function animSourcesFor(baseModel, skeletonPath, exists) {
  const out = [];
  const base = animSourceName(baseModel);
  if (exists(base)) out.push(base);
  const own = animSourceName(skeletonPath);
  if (own !== base && exists(own)) out.push(own);
  return out;
}

/**
 * play()'s source search (animation.cpp:918-935): walk mAnimSources in
 * REVERSE and take the FIRST source whose text keys give this group a
 * valid range. Not "the first source that mentions the group" - the
 * whole of reset() has to succeed, so a source carrying a start key and
 * no stop key is passed over rather than refused.
 *
 * @param sources ordered as pushed; index 0 is the base
 * @returns {{index:number, source:object, state:object}|null}
 */
/**
 * MW-D29: ANIMATION::GETTEXTKEYTIME across EVERY source
 * (animation.cpp:840-854): the sources are walked in REVERSE - the
 * last-pushed wins - and the first key that starts with the asked text
 * answers. The port had asked ONE source (the idle pick's), so an
 * equip-attach key living only in the base .kf while a female skeleton's
 * own .kf won the idle went unseen.
 */
export function sourcesKeyTime(sources, textKey) {
  for (let i = (sources ? sources.length : 0) - 1; i >= 0; i--) {
    const t = getTextKeyTime(sources[i].keys, textKey);
    if (t >= 0) return t;
  }
  return -1;
}

/**
 * MW-D29: ANIMATION::GETVELOCITY's two searches (animation.cpp:1267-1338):
 * first the sources in REVERSE for one that carries the group's start
 * key; that source's accum-root velocity answers - and "if there's no
 * velocity" (the > 1 test, :1301/:1307) the walk CONTINUES through the
 * remaining earlier sources until one yields more. The port had stopped
 * at the single source the clip was picked from.
 */
/** PX29: ONE source's own velocity for a group - the number that
 *  matches the clip actually playing, which is what the movement rate
 *  divides by after Mac's revert. sourcesVelocity (below) is the
 *  reference's multi-source walk and stays for any consumer that
 *  wants it; nothing in the movement lane does. */
export function sourceVelocityOf(source, group) {
  if (!source) return 0;
  const acc = ACCUM_ROOT_NAMES.find((n) => source.trackMap && source.trackMap.has && source.trackMap.has(n));
  return acc ? animVelocity(source.keys, source.trackMap.get(acc), group) : 0;
}

export function sourcesVelocity(sources, group) {
  const list = sources || [];
  const velOf = (so) => {
    const acc = ACCUM_ROOT_NAMES.find((n) => so.trackMap && so.trackMap.has && so.trackMap.has(n));
    return acc ? animVelocity(so.keys, so.trackMap.get(acc), group) : 0;
  };
  let i = list.length - 1;
  for (; i >= 0; i--) {
    if (getTextKeyTime(list[i].keys, `${group}: start`) >= 0
      || getTextKeyTime(list[i].keys, `${group}: loop start`) >= 0) break;
  }
  if (i < 0) return 0;
  let velocity = velOf(list[i]);
  for (let j = i - 1; !(velocity > 1) && j >= 0; j--) velocity = velOf(list[j]);
  return velocity;
}

export function pickAnimSource(sources, group, resetClip, opts = {}) {
  for (let i = (sources?.length ?? 0) - 1; i >= 0; i--) {
    const state = resetClip(sources[i].keys, group, opts);
    if (state.ok) return { index: i, source: sources[i], state };
  }
  return null;
}

/** hasAnimation (animation.cpp): ANY source that names the group. */
export function anySourceHasGroup(sources, group) {
  return (sources ?? []).some((s) => s.groupSet.has(group));
}

export async function clipReport({ kfBytes, skeleton = null, group = 'Idle', clipOpts = {} } = {}) {
  const mod = {};
  try {
    ({ parseNif: mod.parseNif } = await import('./mwNifFile.js'));
    ({ collectTextKeys: mod.collectTextKeys, normalizeTextKeys: mod.normalizeTextKeys,
      clipGroups: mod.clipGroups, resetClip: mod.resetClip, parseAnimGroups: mod.parseAnimGroups,
      extractTracks: mod.extractTracks } = await import('./mwAnim.js'));
    ({ trackBinding: mod.trackBinding, accumRootRef: mod.accumRootRef } = await import('./mwSkin.js'));
  } catch (err) {
    return { ok: false, error: `readers unavailable: ${err.message}` };
  }
  if (!kfBytes || !kfBytes.length) {
    return { ok: false, error: 'no animation file - the archive carries no first-person .kf' };
  }
  let nif;
  try {
    nif = mod.parseNif(kfBytes);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const rawKeys = mod.collectTextKeys(nif);
  const keys = mod.normalizeTextKeys(rawKeys);
  const tracks = mod.extractTracks(nif);
  const clip = mod.resetClip(keys, group, clipOpts);
  const legacyRaw = mod.parseAnimGroups(rawKeys).get(group);
  const channels = (t) => ({
    rotation: (t.rotationKeys?.length ?? 0) || (t.xyzRotations ? -1 : 0),
    translation: t.translations?.keys?.length ?? 0,
    scale: t.scales?.keys?.length ?? 0,
  });
  return {
    ok: true,
    header: readNifHeader(kfBytes),
    rawKeys,
    keys,
    groups: mod.clipGroups(keys),
    group,
    clip,
    // RULE 49's default loopStopTime is +Infinity, and JSON turns that
    // into null on its way through a page evaluation. The boolean is what
    // survives the trip, so a probe never asserts on a null it cannot read.
    loopStopFinite: !!clip.ok && Number.isFinite(clip.loopStopTime),
    legacy: legacyRaw
      ? { start: legacyRaw.start, stop: legacyRaw.stop,
        loopStart: legacyRaw.loopStart, loopStop: legacyRaw.loopStop }
      : null,
    tracks: [...tracks.entries()].map(([bone, t]) => ({
      bone,
      channels: channels(t),
      rotationType: t.rotationType,
      translationType: t.translations?.type ?? 0,
      startTime: t.startTime,
      stopTime: t.stopTime,
      frequency: t.frequency,
      phase: t.phase,
    })),
    binding: skeleton ? mod.trackBinding(skeleton, tracks) : null,
    accumRoot: skeleton ? mod.accumRootRef(skeleton, tracks) : null,
    trackMap: tracks,
  };
}

/** MW-D7: the draw mapper's bounds, over the WHOLE clip rather than one
 *  frame. A mapper recomputed per frame renormalises the picture every
 *  time the arm moves, which cancels out exactly the motion this stage
 *  exists to show - the arm would appear to hold still while its numbers
 *  changed underneath. Sample, union, fix the mapper once. */
/** PX27: the sample times to measure an arm's REACH over - every clip
 *  every source carries, not the idle alone. A clip is a start/stop
 *  pair in a source's text keys; each is sampled at a fixed count, so
 *  the cost is bounded by the data's own clip count and a rig with one
 *  animation costs exactly what it did before. Falls back to the idle's
 *  own span when a source carries no readable pairs, so a rig this
 *  cannot read is measured no worse than it was. */
export function clipSweepTimes(sources, idleState, { perClip = 9 } = {}) {
  const spans = [];
  for (const so of sources ?? []) {
    const keys = so?.keys;
    if (!keys || typeof keys.forEach !== 'function') continue;
    const starts = new Map();
    keys.forEach((time, name) => {
      const n = String(name).toLowerCase();
      const i = n.lastIndexOf(': ');
      if (i < 0) return;
      const group = n.slice(0, i);
      const word = n.slice(i + 2);
      if (word.endsWith('start')) starts.set(`${group}|${word.slice(0, -5)}`, time);
      else if (word.endsWith('stop')) {
        const from = starts.get(`${group}|${word.slice(0, -4)}`);
        if (from != null && time > from) spans.push([from, time]);
      }
    });
  }
  if (!spans.length) {
    const a = idleState?.startTime ?? 0;
    const b = idleState?.stopTime ?? a;
    return Array.from({ length: 25 }, (_, i) => a + ((b - a) * i) / 24);
  }
  const out = [];
  for (const [a, b] of spans) {
    for (let i = 0; i < perClip; i++) out.push(a + ((b - a) * i) / (perClip - 1));
  }
  return out;
}

export function clipUnionBounds(assembly, poseAt, times) {
  let acc = null;
  for (const t of times ?? []) {
    poseAt(t);
    const b = assembly.bounds;
    if (!b) continue;
    acc = acc ? {
      minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY), minZ: Math.min(acc.minZ, b.minZ),
      maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY), maxZ: Math.max(acc.maxZ, b.maxZ),
    } : { ...b };
  }
  return acc;
}
