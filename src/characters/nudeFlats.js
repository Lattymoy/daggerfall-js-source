// NUDE-FLATS (2026-09-27, Field-Bugs-2026-09-26b report 7, Twoddle:
// "'show Nudity' off still has a few nude characters around, i dont know
// all the areas but temples of kynareth is one. This can be an issue for
// people wanting to stream.")
//
// ChildGuard/PlayerNudity - "Show Nudity" - gated the paperdoll's censor
// welds and the adult quests, which are DFU's only two readers of it
// (PaperDollRenderer.BlitBody, QuestListsManager). The world's people
// were never behind it: a Temple of Kynareth stands two of its own
// (faction 36, The Temple of Kynareth) as TEXTURE.184 records 11 and 12,
// "naked blonde woman" and "naked brunette", and DFU draws them whatever
// the setting says. Classic hid such flats under ChildGard - FLATS.CFG
// marks them with a leading "?" (formats/flatsFile.js flatCensored) - and
// DFU never ported that half.
//
// THE TABLE is every nude or topless figure in the NPC flat archives
// (world/rdbLayout.js NPC_FLAT_ARCHIVES), found by looking at every record
// of all thirteen rather than by trusting the "?" mark: the mark misses
// 179.3 (a coven dancer naked but for a black cowl) and marks seven that
// are dressed - 176.4, 182.33, 184.8, 184.9, 184.10, 184.28 and 184.33
// (a halter, a bikini, a corset, blouses) - which stay as they are.
//
// THE STAND-IN is a dressed adult of the same sex, from the same archive
// where one fits the role, so a room keeps its look. Only the PICTURE
// changes: the person keeps the flat they were born as - faction, name
// seed, FLATS.CFG face and caption - the way RR2's variants already do
// (interiorContext.js `drawArchive`). Nothing is hidden, because these
// are people a player clicks: the Kynareth pair are the temple's own
// (faction 36) and talk, a coven's witches are who summons a Daedra
// (PlayerActivate.cs WitchesCovenPopup), and Azura is a quest's.
//
// Read when a scene is built, like every other flat decision: flipping
// the setting redraws the next scene, not the one standing.
//
// NUDE-HOSTS (2026-10-05, the owner: "Even with nudity turned off.
// Players can see and have access to nude vendors"). The table was asked
// by the five hosts that stood people on the day it shipped, and by no
// host made after: the decorator's Vendors (HOME-VENDOR - every person
// Daggerfall stands in a room, the nude ones among them, offered, placed
// and drawn as themselves) and the Arena's tiers (182.48 and 184.6 among
// its seated crowd) drew the figures whatever the setting said. A rule
// each new host has to remember is a rule the next one forgets, so the
// source is swept (test/nudedecor.test.js): every file that batches a
// billboard is named there - one that draws a person asks drawnFlat, any
// other says why it draws none.

import { getBool } from '../systems/settings.js';

/** `archive_record` -> the clothed stand-in [archive, record]. The
 *  captions are FLATS.CFG's; where they stand is BLOCKS.BSA's. */
export const NUDE_FLAT_STAND_INS = Object.freeze({
  '175_0': Object.freeze([182, 56]),    // "beautiful maiden" (Azura, when summoned) -> "hooded woman"
  '176_2': Object.freeze([176, 6]),     // "bare-breasted dancer" (Dark Brotherhood halls) -> "woman in black and red"
  '176_3': Object.freeze([176, 6]),     // "bare-breasted dancer" -> "woman in black and red"
  '179_0': Object.freeze([179, 2]),     // "naked dark-haired woman" (coven witch) -> "mysterious woman"
  '179_1': Object.freeze([179, 4]),     // "naked woman" (coven witch, crossbow) -> "red-haired woman" (spear)
  '179_3': Object.freeze([179, 2]),     // "black-cowled dancer" (coven witch; no "?" mark) -> "mysterious woman"
  '182_32': Object.freeze([182, 11]),   // "good-looking whore" -> "comely maiden"
  '182_34': Object.freeze([182, 47]),   // "blonde whore" (houses, tavern blocks, Temple of Dibella) -> "pretty young lady"
  '182_41': Object.freeze([182, 27]),   // "remarkable woman" (houses, Mages Guild) -> "elegantly dressed lady"
  '182_48': Object.freeze([182, 26]),   // "blond whore" (houses, general stores, Temple of Dibella) -> "young lady in green"
  '184_6': Object.freeze([182, 11]),    // "bare-breasted wench" (taverns) -> "comely maiden" (the barmaid)
  '184_11': Object.freeze([184, 29]),   // "naked blonde woman" (taverns, Temple of Kynareth) -> "blonde wearing blue"
  '184_12': Object.freeze([184, 23]),   // "naked brunette" (houses, taverns, Temple of Kynareth) -> "woman in green pants"
  '184_13': Object.freeze([184, 5]),    // "naked blonde" -> "beautiful blonde"
  '184_14': Object.freeze([184, 26]),   // "naked brunette" (houses, Temple of Dibella) -> "red-haired woman"
  '184_31': Object.freeze([182, 57]),   // "bald slave" (naked, in chains) -> "nearly naked man" (the same figure in a loincloth)
});

/** Show Nudity: ChildGuard/PlayerNudity, the switch the paperdoll's welds
 *  read (ui/paperDoll.js). Ships False. */
export const showNudity = () => getBool('ChildGuard', 'PlayerNudity');

/** NUDE-DECOR: whether a flat is one of the table's figures - what a
 *  catalogue must not OFFER while Show Nudity is off (the decorator's
 *  people, systems/decorCatalogue.js decorRoomEntries): a figure placed
 *  is drawn as its stand-in, but one chosen would be the nude figure to
 *  every visitor whose setting is on. */
export const isNudeFlat = (archive, record) => Object.hasOwn(NUDE_FLAT_STAND_INS, `${archive}_${record}`);

/** The flat a billboard DRAWS for the flat it was born as: the clothed
 *  stand-in while Show Nudity is off, the flat itself otherwise. Answers
 *  [archive, record]; the setting is read only for a flat in the table. */
export function drawnFlat(archive, record, show = null) {
  const s = NUDE_FLAT_STAND_INS[`${archive}_${record}`];
  return s && !(show ?? showNudity()) ? [s[0], s[1]] : [archive, record];
}
