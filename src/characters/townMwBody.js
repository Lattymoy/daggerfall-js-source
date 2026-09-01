// NPC3b: A WANDERING TOWNSPERSON'S MORROWIND BODY.
//
// ── THEIR RACE AND SEX ARE NOT INVENTED ──────────────────────────
//
// PERSON_TEXTURES (mobilePerson.js) is the real thing: Daggerfall's
// people archives ARE a race-and-sex table - Redguard/Nord/Breton x
// male/female - and the crowd is spawned from it. So a wandering
// person's body reads its identity straight off the sprite it
// replaces, and a Nord woman stays a Nord woman.
//
// This is deliberately NOT raceOfArchive (raceCharacter.js), whose own
// comment calls itself "a deterministic spread ... until that table is
// wired". The table was wired all along, one module over.
//
// ── THEIR CLOTHES ARE INVENTED, AND SAY SO ───────────────────────
//
// Daggerfall paints a townsperson's clothes into the sprite and gives
// them no equipment at all, so the wardrobe is the port's own - see
// mwWardrobe.js for the whole argument and the cache budget. The
// street crowd dresses as COMMONERS, which is what they are; the
// faction-bearing people who carry a social group (shopkeepers, quest
// NPCs) take their own tier when that slice lands.
import { PERSON_TEXTURES } from './mobilePerson.js';
import { SOCIAL_GROUPS } from '../formats/factionFile.js';
import { personaFor } from './mwWardrobe.js';
import { mwRaceId } from '../formats/mwNpc.js';

/** archive -> { race, female }, built once from the spawn table so the
 *  two can never disagree about what an archive means. */
const BY_ARCHIVE = (() => {
  const out = new Map();
  for (const [race, sexes] of Object.entries(PERSON_TEXTURES)) {
    for (const a of sexes.male) out.set(a, { race, female: false });
    for (const a of sexes.female) out.set(a, { race, female: true });
  }
  return out;
})();

/** What the sprite says this person is. Null for an archive the spawn
 *  table does not carry - a guard's 399, say - so the caller keeps its
 *  sprite rather than guessing a race. */
export function townPersonIdentity(archive) {
  return BY_ARCHIVE.get(archive | 0) ?? null;
}

/**
 * The opts mwActorBody takes, for one wandering townsperson.
 *
 * @param archive the person's people-texture archive (race and sex)
 * @param seed    a stable per-person number - their clothes must not
 *                change while you watch them
 */
export function townMwBodyOpts(archive, seed) {
  const who = townPersonIdentity(archive);
  if (!who) return null;
  const persona = personaFor(seed, SOCIAL_GROUPS.Commoners, who.female);
  return {
    race: mwRaceId(who.race),
    female: who.female,
    faceIndex: persona.faceIndex,
    worn: persona.worn,
    weapon: null,
    hasAmmo: false,
  };
}
