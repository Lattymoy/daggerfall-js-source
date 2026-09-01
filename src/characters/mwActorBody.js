// NPC1: THE HUMANOID BODY SERVICE - one Morrowind body per OUTFIT,
// shared by every actor wearing it.
//
// ENHANCED ONLY, and the gate is the one every enhanced door already
// rides (uiSkin's isEnhanced). The classic lane keeps its own rigged
// bodies untouched: this is an addition to one skin, never a
// replacement of the port's own art.
//
// WHY A SERVICE AND NOT A CALL. A build is seconds long - the archive
// index, the record walk, every mesh parse - which is what IG2 was
// about. A town is thirty actors. Thirty builds is a tab that stops
// responding, and thirty COPIES of one guard's body is thirty times
// the memory for one picture. So the expensive half is keyed by what
// actually changes the mesh (race, sex, face, outfit, weapon) and
// shared; the cheap half - where the playhead is, which frame this
// actor is on - stays with the actor, exactly as OpenMW keeps shared
// resources against per-actor animation state.
//
// WHAT THIS OWNS: the key, the cache, the gate, and the refusal.
// WHAT IT DOES NOT: the build itself (fpArm's buildTpBody, the same
// one the player's body rides) and the records (mwActorCatalog). Two
// ports of one rule drift apart - MW7's lesson - so neither is
// re-implemented here.
import { isEnhanced } from '../systems/uiSkin.js';
import { mwActorCatalog, catalogRace } from '../formats/mwActorCatalog.js';
import {
  buildTpBody, clothingColourOf, wornEquipKeyOf, fpWeaponKey,
} from '../combat/fpArm.js';
import { composeWornArmor } from '../formats/mwItemMap.js';

/** key -> Promise<body>. The PROMISE is cached, not the result: two
 *  actors asking for the same outfit in one frame must share one
 *  build, not race two. */
const BODIES = new Map();
/** The generation the cache belongs to. A re-attach drops every body -
 *  the meshes came from archives that are no longer the ones loaded. */
let _gen = null;
/** How many builds actually ran. The build-count pin reads this: N
 *  distinct outfits must cost N builds however many actors wear them. */
let _builds = 0;

/**
 * THE IDENTITY OF A BODY - everything that changes which meshes are
 * assembled, and nothing that does not.
 *
 * Position, heading, health, name and animation phase are all absent
 * on purpose: two guards in different corners of a town facing
 * opposite ways are the same body, and keying on anything they differ
 * by is how a shared cache silently becomes a per-actor one.
 *
 * The worn and weapon halves reuse the player's own key helpers
 * (wornEquipKeyOf, fpWeaponKey) rather than minting a second spelling
 * of "same outfit" - MW-D19/MW-D32 own those questions.
 */
export function mwBodyKey({
  race, female = false, beast = null, faceIndex = 0, worn = null, weapon = null, hasAmmo = false,
} = {}) {
  return [
    String(race || '').toLowerCase(),
    female ? 'f' : 'm',
    beast === null ? '?' : (beast ? 'b' : '-'),
    faceIndex | 0,
    wornEquipKeyOf(worn),
    fpWeaponKey(weapon, hasAmmo),
  ].join('/');
}

/**
 * The body for one actor's identity, built once per outfit.
 *
 * Answers NULL - never throws, never a half-body - when the enhanced
 * skin is off, when no Morrowind data is attached, or when the build
 * refuses. A null answer means "this actor keeps the port's own rigged
 * body", which is the behaviour every caller already has.
 *
 * @returns {Promise<object|null>} the built body (buildTpBody's shape:
 *   arm, tracks, sources, textures, raceScale, notes...) or null.
 */
export async function mwActorBody(opts = {}, deps = null) {
  if (!isEnhanced()) return null;
  const cat = await mwActorCatalog(deps);
  if (!cat.ok) return null;

  // A fresh attach invalidates every body: the meshes and textures in
  // them were read out of archives that are no longer the loaded set.
  if (cat.gen !== _gen) { BODIES.clear(); _gen = cat.gen; }

  const { race, female = false, faceIndex = 0, weapon = null, hasAmmo = false } = opts;
  const armor = opts.worn ?? [];
  const { beast, raceScale } = catalogRace(cat, race, female, opts.beast ?? null);
  const key = mwBodyKey({ race, female, beast, faceIndex, worn: armor, weapon, hasAmmo });
  const hit = BODIES.get(key);
  if (hit) return hit;

  const pending = (async () => {
    _builds++;
    // MW-D31: ONE COMPOSITION - the same arbitration the player's body
    // receives, over this actor's own equip list.
    // MW-D37: the garments' measured colours, so the dye can choose.
    const colourOf = (c) => clothingColourOf(c, cat.parts, cat.archives, cat.gen);
    const worn = composeWornArmor({
      pieces: armor, armors: cat.armors ?? [], clothes: cat.clothes ?? [],
      bodyPool: cat.parts, female, colourOf,
    });
    const body = await buildTpBody({
      race, female, beast, faceIndex, faceMatch: null, weapon, hasAmmo, worn,
      archives: cat.archives, parts: cat.parts, allWeapons: cat.weapons,
      find: cat.find, gen: cat.gen,
    });
    if (!body || !body.ok) return null;
    // MW-D34: adjustScale's per-gender factors ride the body, so the
    // draw does not re-derive them per actor (MW-D25's law: the seam
    // answers once).
    body.raceScale = raceScale;
    return body;
  })();

  BODIES.set(key, pending);
  const body = await pending;
  // A refusal is not cached as a permanent no: the data can change
  // under the player (an archive attached mid-game), and the next
  // generation clears the map anyway. But a null must not be re-tried
  // every frame either - it stays until the generation turns over.
  return body;
}

/** For the build-count pin and the diagnostic card: how many distinct
 *  outfits have been built, and how many builds that actually cost. */
export function mwActorBodyStats() {
  return { builds: _builds, cached: BODIES.size, gen: _gen };
}

/** Test seam: forget every body and the build tally. */
export function _resetActorBodiesForTests() {
  BODIES.clear();
  _gen = null;
  _builds = 0;
}
