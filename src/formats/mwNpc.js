// Morrowind NPC assembly - slice 6 of the import arc. Turns ESM records
// into the concrete list of meshes a character wears: for every body
// slot, the BODY record whose race, sex and part match (female bodies
// fall back to male when a race ships no female variant - retail does
// this constantly), plus the head and hair the NPC_ record names
// outright. Pure data: paths and attach bones out, rendering elsewhere.
//
// Skinned parts (the *_skins chest/groin/limb pieces) rebind onto the
// base skeleton by bone name (mwCharacter.js); UNSKINNED parts carry
// the bone they attach at, the OpenMW sPartList mapping. Paired limbs
// name both sides - the mirror-attach render lands with the clothing
// slice, the DATA is complete here.

import { MW_BODY_PARTS, BODY_TYPE } from './mwEsmFile.js';

/** Attach bone(s) per slot for unskinned parts, retail bone names. */
export const PART_BONES = Object.freeze({
  head: ['head'],
  hair: ['head'],
  neck: ['neck'],
  chest: ['chest'],
  groin: ['groin'],
  tail: ['tail'],
  hand: ['left hand', 'right hand'],
  wrist: ['left wrist', 'right wrist'],
  forearm: ['left forearm', 'right forearm'],
  upperarm: ['left upper arm', 'right upper arm'],
  foot: ['left foot', 'right foot'],
  ankle: ['left ankle', 'right ankle'],
  knee: ['left knee', 'right knee'],
  upperleg: ['left upper leg', 'right upper leg'],
  clavicle: ['left clavicle', 'right clavicle'],
});

/** meshes\ prefix the MODL paths are relative to. */
export const MESH_ROOT = 'meshes\\';

/**
 * Index skins once: race -> part -> {male, female} body records.
 * @param {Map} bodies - parseEsm(...).bodies
 */
export function indexSkins(bodies) {
  const byRace = new Map();
  for (const body of bodies.values()) {
    // MW-D32: the reference's sweep filters NotPlayable and skin-type
    // ONLY (getBodyParts, npcanimation.cpp:1208-1211) - there is NO
    // vampire test there (vampire heads ride the actor's own record
    // path), and the port had it backwards: vampire filtered, playable
    // not.
    if (body.kind !== BODY_TYPE.skin || !body.playable || body.part < 0) continue;
    let race = byRace.get(body.race);
    if (!race) byRace.set(body.race, (race = new Map()));
    let slot = race.get(body.part);
    if (!slot) race.set(body.part, (slot = {}));
    slot[body.female ? 'female' : 'male'] = body;
  }
  return byRace;
}

/**
 * Assemble one NPC's body-part list.
 * @param {{npcs:Map, races:Map, bodies:Map}} esm - parseEsm result.
 * @param {string} npcId
 * @param {Map} [skinIndex] - indexSkins(esm.bodies), built here if absent.
 * @returns {{npc:object, race:object, animFile:string, parts:
 *   {slot:string, bodyId:string, model:string, attachBones:string[]}[],
 *   missing:string[]}}
 */
export function assembleNpc(esm, npcId, skinIndex = null) {
  const npc = esm.npcs.get(String(npcId).toLowerCase());
  if (!npc) throw new Error(`assembleNpc: no NPC_ "${npcId}"`);
  const race = esm.races.get(npc.race);
  if (!race) throw new Error(`assembleNpc: NPC "${npc.id}" names unknown race "${npc.race}"`);
  const skins = (skinIndex ?? indexSkins(esm.bodies)).get(npc.race) ?? new Map();

  const parts = [];
  const missing = [];
  const push = (slot, body) => {
    parts.push({
      slot,
      bodyId: body.id,
      model: MESH_ROOT + body.model,
      attachBones: PART_BONES[slot] ?? [],
    });
  };

  // Head and hair come straight off the NPC_ record.
  for (const [slot, id] of [
    ['head', npc.head],
    ['hair', npc.hair],
  ]) {
    const body = id && esm.bodies.get(id);
    if (body) push(slot, body);
    else missing.push(`${slot}: ${id ?? '(none named)'}`);
  }
  // Everything else is the race's skin set, sex-matched with the male
  // fallback retail relies on. Head/hair slots in the skin set are the
  // generic race heads - the NPC_ names its own, so they're skipped.
  for (let p = 0; p < MW_BODY_PARTS.length; p++) {
    const slot = MW_BODY_PARTS[p];
    if (slot === 'head' || slot === 'hair') continue;
    const pair = skins.get(p);
    if (!pair) {
      // Tails only exist on beast races; a missing tail elsewhere is
      // the data being right, not a hole.
      if (slot === 'tail' && !race.beast) continue;
      missing.push(`${slot}: no ${npc.race} skin`);
      continue;
    }
    const body = (npc.female && pair.female) || pair.male || pair.female;
    if (body) push(slot, body);
  }

  // Beast races walk on their own skeleton; an NPC_ MODL overrides all.
  // MW-D32: the FEMALE column was missing - getActorSkeleton
  // (actorutil.cpp, !firstPerson branch) picks base_anim_female.nif for
  // a female non-beast, and beast wins over sex exactly as the
  // reference's if-ladder orders it.
  const animFile = npc.model
    ? MESH_ROOT + npc.model
    : race.beast
      ? MESH_ROOT + 'base_animkna.nif'
      : npc.female
        ? MESH_ROOT + 'base_anim_female.nif'
        : MESH_ROOT + 'base_anim.nif';

  return { npc, race, animFile, parts, missing };
}

// ── MW7: THE FIRST-PERSON ARMS ─────────────────────────────────────
//
// Slice 5 built a first-person rig and slice 6 built body assembly,
// and nothing ever joined them - so on RETAIL data the rig loaded
// meshes\base_anim.1st.nif (Morrowind's first-person SKELETON and
// animation carrier), found no skinned geometry inside it, and fell
// back to the classic sprite for ever. The visible arms were never
// anywhere near it: in Morrowind they are ordinary body parts, chosen
// by race and sex exactly as the third-person body is, in their
// first-person variants.

/* MW7's FIRST-PERSON HELPERS WERE REMOVED HERE, AND DELIBERATELY NOT
 * RESTORED. They were FIRST_PERSON_SLOTS, firstPersonModel and
 * firstPersonArmParts, and they encoded a rule that is wrong in kind:
 * firstPersonModel spliced ".1st" into a body part's MESH FILENAME and
 * asked the archive for the result.
 *
 * The engine never transforms a path. A first-person body part is a
 * RECORD whose ID ends in "1st" (components/esm3/loadbody.cpp:85-88,
 * recorded as rule 1), and that record carries its OWN MODL, unrelated
 * to the third-person one. Retail data settled it beyond argument: the
 * Nord male hand record is `b_n_nord_m_handS.1st` - PLURAL - so a name
 * built from the singular slot stem finds nothing at all, and
 * `b_n_nord_m_upper arm` contains a SPACE.
 *
 * The correct lookup lives in src/formats/mwFirstPerson.js (isFirstPersonId,
 * armReport, armMeshPaths), pinned against hand-built records and proven
 * against real archives.
 *
 * See bible/02-Formats/Morrowind-Rules.md rules 1 and 3, and Part VI.
 */

/**
 * A Daggerfall race name -> the Morrowind race id that carries its
 * body parts. Every one of Daggerfall's eight races is also a
 * Morrowind race, so this is a spelling change and not a mapping:
 * the port writes 'DarkElf', the ESM writes 'dark elf'.
 */
export function mwRaceId(dfRace) {
  if (!dfRace) return null;
  return String(dfRace).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/** The inverse spelling: 'dark elf' -> 'DarkElf', for the port's own
 *  race tables (MW-D35 reads the classic portrait archive by race key). */
export function dfRaceKeyOf(mwRace) {
  if (!mwRace) return null;
  return String(mwRace).split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
