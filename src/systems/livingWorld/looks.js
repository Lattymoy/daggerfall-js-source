// @ts-check
// LW-LOOKS (2026-10-06, bible/06-Systems/Living-World.md "LW-LOOKS"; Mac: NPCs should "even utilize different sprite
// forms not just the basic npc sprites" - and, asked how, "Class looks + still flats"): WHAT A RESIDENT LOOKS LIKE.
//
// THE CLASS THEY WALK THE TOWN IN (`townClassOf`). LW0 decision 5 put a class's eight-way sprite on one going out to
// fight (LW3's armed walk) and every one else in a townsperson's outfit; now those whose calling is a class's walk the
// town in it too: one with a class of their own (an adventurer, a sellsword, a courier), a guild hall's own members (the
// Mages Guild's one of the mage's classes, the Fighters Guild's one of the warrior's - their seed's - a knightly order's
// a knight) and a temple's priests (the healer's robes). Those of a guild by their trade (a scholar, a smith) keep their
// trade's outfit.
//
// THE STILL PICTURE (`stillRoleOf`, `stillFlatOf`, STILL_FLATS). One who keeps their place alone - a beggar at their
// pitch, a stall-keeper at their stall, a priest at the temple's door, a courtier at home in the palace - stands as
// Daggerfall's own still picture of their kind (its NPC flats, FLATS.CFG's captions and genders: an old beggar, a
// well-to-do merchant, a cowled monk, a noblewoman wearing blue), their seed's among their kind's, animated as the game's
// own still people are (render/flatAnimation.js). In a circle they are themselves, turned to those they talk with.
import { MOBILE_TYPES as M } from '../../characters/mobileTypes.js';
import { lwSeed, textSeed } from './seed.js';
import { MAGES_GUILD, FIGHTERS_GUILD, ORDER_FACTIONS } from './dayPlan.js';

/** The classes a guild's own members walk the town in: the Mages Guild's the mage's, the Fighters Guild's the warrior's
 *  (Daggerfall's runs of six, dayPlan.js isMageClass/isWarriorClass); a knightly order's a knight. */
export const GUILD_CLASSES = Object.freeze({
  [MAGES_GUILD]: Object.freeze([M.Mage, M.Healer, M.Sorcerer, M.Battlemage, M.Spellsword, M.Nightblade]),
  [FIGHTERS_GUILD]: Object.freeze([M.Warrior, M.Barbarian, M.Archer, M.Ranger, M.Monk, M.Knight]),
});
/** A temple's priest walks in the healer's robes. */
export const PRIEST_CLASS = M.Healer;

/**
 * LW-LOOKS: THE CLASS A RESIDENT WALKS THE TOWN IN, or null (their own outfit): their own class (an adventurer, a
 * sellsword, a courier); a guild hall's own member their guild's (`res.faction`, their hall's - one of GUILD_CLASSES by
 * their seed, a knightly order's a knight; a hall of another faction none); a temple's priest PRIEST_CLASS.
 * @param {{ id: string, job: string, cls: number|null, faction?: number }} res @returns {number|null}
 */
export function townClassOf(res) {
  if (res.cls != null) return res.cls;
  if (res.job === 'priest') return PRIEST_CLASS;
  if (res.job !== 'guildsman') return null;
  const f = res.faction ?? 0;
  if (ORDER_FACTIONS.has(f)) return M.Knight;
  const list = /** @type {readonly number[]|undefined} */ (GUILD_CLASSES[/** @type {keyof typeof GUILD_CLASSES} */ (f)]);
  return list ? list[lwSeed(textSeed(res.id), 0x636c7373) % list.length] : null;   // 'clss'
}

/** LW-LOOKS: Daggerfall's still pictures of its people by kind and sex (archive, record - its NPC flats; FLATS.CFG's
 *  captions in the comments, its genders the lists'; none ChildGard censors; none a tenth taller than the people's
 *  tallest walker, 2.15 m - its cowled old man, 177.0, stands 2.65 m). Each looked over for its kind: a market's
 *  labourers are many at once (a city's 11-28 at nine), so every kind has several - never one picture stood by all. Left
 *  out: its "cowled woman" (178.0, a cowled swordswoman), its "wizened crone" (175.15, a witch at her magic), its hooded
 *  men, its children, and those dressed for a fight or for little at all. */
export const STILL_FLATS = Object.freeze({
  // an old beggar, a pathetic old cripple, a pathetic beggar, a pitiful bald man (sitting, and lying), a man in a brown
  // hat, a fair-bearded man (crouched); an old crone, a blind old crone
  beggar: Object.freeze({ male: Object.freeze([[182, 21], [182, 29], [184, 27], [182, 30], [182, 31], [182, 14], [182, 16]]), female: Object.freeze([[182, 44], [183, 15]]) }),
  // a well-to-do merchant, a stylish fat man, a chubby old man (aproned, a cup), a portly man in violet, a fat bald man,
  // a bearded man and a blond-bearded man (their bottles at their feet), a white-haired old man; an elegantly dressed
  // lady, a comely maiden (a tray of drinks), a dark-haired woman in red (a cup)
  merchant: Object.freeze({ male: Object.freeze([[184, 0], [183, 16], [184, 16], [180, 3], [182, 1], [182, 3], [182, 2], [182, 0]]), female: Object.freeze([[182, 27], [182, 11], [180, 0]]) }),
  // a blacksmith (at his anvil), a white-bearded man (aproned, a bowl), a man in a chef's hat, a brawny peasant, a chubby
  // old man (aproned), a fat bald man, a bearded man and a blond-bearded man (their wares at their feet); a young lady in
  // green (aproned, a pot), a milk maid, a comely maiden (a tray of drinks), a dark-haired woman in red (a cup)
  crafter: Object.freeze({ male: Object.freeze([[182, 59], [182, 7], [182, 8], [184, 17], [184, 16], [182, 1], [182, 3], [182, 2]]), female: Object.freeze([[182, 26], [182, 12], [182, 11], [180, 0]]) }),
  // a brawny peasant, a street sweeper, a man in a gray tunic, a man in a green coat, a man in a blue coat, a
  // blond-bearded man (a sack); a milk maid, a young lady in green, a red-haired woman
  labourer: Object.freeze({ male: Object.freeze([[184, 17], [182, 39], [182, 19], [182, 20], [182, 23], [182, 17]]), female: Object.freeze([[182, 12], [182, 26], [184, 26]]) }),
  // a scruffy-looking sailor, a scruffy sailor; a milk maid, a red-haired woman
  fisher: Object.freeze({ male: Object.freeze([[182, 25], [182, 35]]), female: Object.freeze([[182, 12], [184, 26]]) }),
  // a cowled monk, a cloaked old man, a blue-cloaked old man (a golden staff); a hooded woman, a blue-cloaked woman, a
  // woman in gray, a woman in blue (gowned, a golden sash)
  priest: Object.freeze({ male: Object.freeze([[183, 12], [182, 22], [181, 2]]), female: Object.freeze([[182, 56], [182, 28], [182, 9], [182, 10]]) }),
  // a well-dressed man, a noble-looking man, an elegant gentleman, a blond aristocrat, a flamboyant young man, a
  // wise-looking man; a noblewoman wearing blue, a pretty young lady, a beautiful blonde, a blonde wearing blue, an
  // elegantly dressed lady
  court: Object.freeze({ male: Object.freeze([[180, 2], [183, 4], [175, 14], [182, 15], [183, 5], [182, 40]]), female: Object.freeze([[180, 1], [182, 47], [184, 5], [184, 29], [182, 27]]) }),
});

/** The stalls' keepers by trade, and their kind of still picture - a courier, who keeps a labourer's day (dayPlan.js),
 *  none: the one at a stall with a class of their own keeps it. */
const STALL_ROLE = Object.freeze({ merchant: 'merchant', crafter: 'crafter', fisher: 'fisher', labourer: 'labourer' });

/**
 * LW-LOOKS: THE KIND OF STILL PICTURE ONE KEEPING THEIR PLACE ALONE STANDS AS AT THIS STAY (`e`, their day's entry), or
 * null (themselves): a beggar at their pitch; a stall-keeper at their stall by their trade (a courier, with a class of
 * their own, keeps it); a priest at their temple's door. Outdoors (the street's); the palace's courtiers are the room's
 * (`court`).
 * @param {{ job: string, work: number|null }} res @param {{ kind: string, at?: { building?: number } | null } | null | undefined} e
 * @returns {keyof typeof STILL_FLATS | null}
 */
export function stillRoleOf(res, e) {
  if (!e) return null;
  if (e.kind === 'beg') return 'beggar';
  if (e.kind === 'stall') return /** @type {any} */ (STALL_ROLE[/** @type {keyof typeof STALL_ROLE} */ (res.job)] ?? null);
  if (res.job === 'priest' && e.kind === 'social' && res.work != null && e.at?.building === res.work) return 'priest';
  return null;
}

/**
 * LW-LOOKS: THE STILL PICTURE a resident stands as for `role` - their seed's among their kind's of their sex (every kind
 * has both). @param {{ id: string, sex: 'male'|'female' }} res @param {keyof typeof STILL_FLATS} role
 * @returns {{ archive: number, record: number }}
 */
export function stillFlatOf(res, role) {
  const list = STILL_FLATS[role][res.sex === 'female' ? 'female' : 'male'];
  const [archive, record] = list[lwSeed(textSeed(res.id), 0x7374696c) % list.length];   // 'stil'
  return { archive, record };
}
