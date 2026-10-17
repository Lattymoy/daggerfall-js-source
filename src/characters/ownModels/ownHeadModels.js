// @ts-check
// THE HEADS AND HAIRS MORROWIND'S OWN DATA DOES NOT CARRY.
//
// MW-HEADS1 (2026-10-13, the owner: "Everything we are doing is for the morrowwind model. This batch is for breton",
// with the export of three heads and their six paintings; asked who wears them: every Breton man - townspeople, NPCs
// and a Breton player - in place of Morrowind's own Breton men's heads - bible/04-Characters/Own-Heads.md). The heads
// counterpart of ownArmorModels.js and ownClothingModels.js, and a leaf for the same reason: formats/morrowind/mwFirstPerson.js
// asks it, and nothing it imports may reach back.
//
// A head and a hair are BODY records to the build (a skin part of a race and a sex, its slot PRT_Head or PRT_Hair, its
// mesh a rigid part hung under the "Head" node - Morrowind-Rules.md rules 5 and 12), and the port's own are written in
// that same shape: a race's own heads and hairs ARE its pools wherever they exist (facePools), so the NPC walk
// (characters/wardrobe.js npcFaceOf), the player's curated face (mwFaceTable.json) and the measured match
// (formats/morrowind/mwFaceMatch.js) all choose among them on the doors they always used, and a race with none keeps the data's.
// The meshes ship under `src/assets/mw/` (tools/bakeHeads.mjs), served by systems/ownMwAssets.js - and stand only where
// that archive loaded: a page whose own chunk did not load draws the data's heads, never none (facePools' `has`).

/** MW_BODY_PARTS' indices (formats/morrowind/mwEsmFile.js): the head's part and the hair's. */
const PART = Object.freeze({ head: 0, hair: 1 });

/** One part as a BODY record reads (formats/morrowind/mwFirstPerson.js readBodyPart): a skin, playable, never a vampire's, a
 *  third-person part - its id the shipped mesh's name. Exactly the record a BODY of that id, mesh, race and part reads
 *  as - nothing the build could tell from the data's (test/tooling/mwheads1.test.js holds each to bodyParts' reading).
 *  @param {string} race @param {boolean} female @param {'head'|'hair'} slot @param {string} id */
const record = (race, female, slot, id) => Object.freeze({
  id, model: `${id}.nif`, race, part: PART[slot], female, playable: true, skin: true, vampire: false, bodyKind: 0, slot, firstPerson: false,
});

/** @param {string} race @param {boolean} female @param {string[]} heads @param {string[]} hairs */
const pools = (race, female, heads, hairs) => Object.freeze({
  heads: Object.freeze(heads.map((id) => record(race, female, 'head', id))),
  hairs: Object.freeze(hairs.map((id) => record(race, female, 'hair', id))),
});

/**
 * The port's own heads and hairs, by race (a RACE record's id, lowercased - BODY records name it so) and sex, each pool
 * in id order (facePools' order - a save's face walks the same records on every machine). MW-HEADS1: the Breton men's
 * three heads (the paintings h04, h0411 and h0423 - h0411 the eyepatch, MW-HEADS3) and three hairs (01, 0111 - the red
 * headband - and the widow's peak).
 */
export const OWN_HEADS = Object.freeze({
  breton: Object.freeze({
    male: pools('breton', false, ['breton_m_head_h04', 'breton_m_head_h0411', 'breton_m_head_h0423'], ['breton_m_hair_01', 'breton_m_hair_0111', 'breton_m_hair_widow']),
  }),
});

/**
 * The port's own pools for a race and sex - `{ heads, hairs }`, BODY-shaped records - or null where it has none (the
 * data's own stand). @param {string} race @param {boolean} female
 */
export function ownFacePools(race, female) {
  const byRace = /** @type {Record<string, any>} */ (OWN_HEADS)[String(race || '').toLowerCase()];
  return byRace?.[female ? 'female' : 'male'] ?? null;
}

/** Every mesh path the port's own heads and hairs name - the coverage walk's (each ships, test/tooling/mwheads1.test.js). The
 *  build asks a pool's own, through facePools' `has`. */
export const ownHeadModelPaths = () => Object.values(OWN_HEADS)
  .flatMap((bySex) => Object.values(bySex))
  .flatMap((p) => [...p.heads, ...p.hairs])
  .map((r) => `meshes/${r.model}`);
