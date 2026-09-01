// NPC4: A STATIC NPC'S MORROWIND BODY.
//
// A shopkeeper, a temple healer, a tavern patron, a quest questor -
// every person who STANDS somewhere rather than wanders. NPC3b dressed
// the wandering crowd; these are the other half, and they differ in
// one way that matters: they carry a FACTION, so "what they are" is
// data rather than a default.
//
// ── THEIR IDENTITY IS NOT DERIVED TWICE ──────────────────────────
//
// The input here is StaticNPC.Data - staticNpcData's answer, the ONE
// SetLayoutData law (StaticNPC.cs:210-224). That record already
// carries every field a body needs:
//
//   race     - GetRaceFromFaction (:357-369): a named faction lends
//              its race, everyone else takes the region's
//   gender    - the billboard's own flags & 32 (:219)
//   nameSeed  - position ^ (buildingKey + locationIndex) (:217)
//   factionID - which the social group reads off FACTION.TXT
//
// So the person standing in the shop is the SAME person the talk
// window names, wearing clothes seeded by the seed their name comes
// from. Deriving a second identity here - a race off the archive, say
// - would give a body that disagreed with its own dialogue.
//
// ── THE CLOTHES ARE THE PORT'S OWN, AND THE TIER IS NOT ──────────
//
// Same argument as NPC3b (see mwWardrobe.js): Daggerfall paints a
// citizen's clothes into the sprite, so a Morrowind body must be
// dressed by the port or render nude. What is NOT invented is the
// TIER - FACTION.TXT's sgroup - and a static NPC is exactly the case
// the tiers were written for. A noble's servant, a temple's scholar
// and a thieves-den fence each dress as their faction says.
//
// ── TWO PEOPLE THIS DELIBERATELY REFUSES ─────────────────────────
//
// A CHILD (StaticNPC.IsChildNPCData, :342-350 - the eight child
// texture pairs, or faction 514). Morrowind has no child body: every
// NPC mesh in it is an adult, and dressing a child record in one
// would stand a grown man where the game put a kid. They keep their
// sprite, which is the honest answer.
//
// A person whose RACE DOES NOT RESOLVE. staticNpcData starts from the
// zero struct, whose race field is `(Races)0` - not a member of the
// enum at all (see ZERO_NPC_DATA's note). A host that cannot answer
// GetRaceOfCurrentRegion leaves it there, and 0 names no race, so
// there is nothing to build and the sprite stands.
import { isChildNPCData } from './staticNpc.js';
import { GENDERS } from './nameHelper.js';
import { raceById } from '../systems/races.js';
import { SOCIAL_GROUPS } from '../formats/factionFile.js';
import { personaFor } from './mwWardrobe.js';
import { mwRaceId } from '../formats/mwNpc.js';

/**
 * The opts mwActorBody takes, for one static NPC.
 *
 * @param data StaticNPC.Data - staticNpcData's / layoutNpcData's answer
 * @param deps.getFaction the FACTION.TXT lookup, for the social group.
 *   A person with no faction (factionID 0) or a faction the table does
 *   not hold dresses as a COMMONER - wardrobeTier's own default, and
 *   the right one: an unfactioned villager IS a commoner.
 * @returns the opts, or null for a person this lane refuses
 */
export function staticMwBodyOpts(data, { getFaction = null } = {}) {
  if (!data) return null;
  if (isChildNPCData(data)) return null;
  const tmpl = raceById(data.race);
  if (!tmpl) return null;
  const female = data.gender === GENDERS.Female;
  const sgroup = getFaction?.(data.factionID)?.sgroup ?? SOCIAL_GROUPS.Commoners;
  const persona = personaFor(data.nameSeed, sgroup, female);
  return {
    race: mwRaceId(tmpl.key),
    female,
    faceIndex: persona.faceIndex,
    worn: persona.worn,
    // A static NPC carries no equipment in Daggerfall - they are a
    // billboard and a faction. Nothing to draw, nothing to invent:
    // the wardrobe dresses them, it does not arm them.
    weapon: null,
    hasAmmo: false,
  };
}
