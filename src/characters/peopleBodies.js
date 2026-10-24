// @ts-check
// MWNPC8 (2026-10-09, the MW-NPC arc's eighth slice - bible/04-Characters/Morrowind-NPCs.md section 13): A STANDING
// PERSON, READ FOR THEIR BODY. Daggerfall's standing people - the shopkeeper, the guild's officer, the noble at court,
// the drunk in the tavern - are StaticNPCs (characters/staticNpc.js staticNpcData): a race off their faction (else the
// region's), a gender off their record's flags, a faction whose social group and guild say who they are. The body wears
// THAT: a wardrobe by the faction (a temple's priest in priest's robes, a mage in robes, a knight in plate, a fighter in
// what armour came to hand, a noble in formal clothes or a gown, a merchant in a tunic and breeches, the underworld in
// dark clothes, everyone else the street's own) - MWNPC17 (section 25): each DRESSED off their name seed by the
// wardrobe's role (characters/wardrobe.js dressPerson), the cut, the garments, the dyes, the cloak, the rung of
// Morrowind's ladder and the armour's metal their own, and the look's `npc` hint their own picks, head and hair. A child
// keeps their sprite (no Morrowind body is a child's), and so does a vampire's people: AUDIT MW-NPC II K6 - MWNPC14 gave
// a vampire its race's vampire head where the look KNOWS it is one (a foe's mobile, a roster's), but a standing person's
// faction row is all that says it here, and the supernatural social group is wider than the vampires; they keep their
// pictures rather than a guess (section 21's NOT HERE). They stand idle and turn to face the player, as Daggerfall's
// billboards always did, at a person's pace.
import { GENDERS } from './nameHelper.js';
import { isChildNPCData, isChildNPCTexture } from './staticNpc.js';   // MWNPC18: and a child's picture, a figure's
import { flatGender } from '../formats/flatsFile.js';   // MWNPC18: a figure's sex, FLATS.CFG's column
import { textSeed } from '../systems/livingWorld/seed.js';   // MWNPC18: a figure's seed, its piece's id
import { RACES } from '../systems/races.js';
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../formats/factionFile.js';
import { isNpcFlat } from '../world/npcFlatArchives.js';   // STALL-FLATS: RDBLayout.NPCFlatArchives, the people's pictures
import { dressPerson } from './wardrobe.js';   // MWNPC17: the wardrobe's roles

const RACE_NAME = Object.freeze(Object.fromEntries(Object.entries(RACES).map(([k, v]) => [v, k])));

/** MWNPC17: the wardrobe's role (characters/wardrobe.js WARDROBE_ROLES) each kind of person is dressed by. */
export const KIND_ROLE = Object.freeze({
  priest: 'priest', mage: 'mage', knight: 'knight', fighter: 'fighter', noble: 'noble', merchant: 'merchant',
  underworld: 'rogue', scholar: 'scholar', common: 'commoner',
});

function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** What a faction makes a person wear: 'priest', 'mage', 'knight', 'fighter', 'noble', 'merchant', 'underworld',
 *  'scholar', or 'common' (the street's); 'none' for a vampire's people (the header: a faction row is all that says it),
 *  a Daedra, a god, Oblivion's or the Fey's - who keep their sprites. MWNPC17: a knightly order's and a court's guard a
 *  knight's plate, a fighters' guild's a fighter's mismatched armour (they were one 'steel' - one suit for both); a
 *  witch's coven and a necromancer a mage's robes, the Dark Brotherhood the underworld's dark clothes.
 *  @param {any} f the FACTION.TXT row */
export function wardrobeOf(f) {
  if (!f) return 'common';
  if (f.type === FACTION_TYPES.VampireClan || f.ggroup === GUILD_GROUPS.Vampires || f.sgroup === SOCIAL_GROUPS.SupernaturalBeings) return 'none';
  // MWNPC8b: nor anyone not mortal - a Daedra, a god, Oblivion's or the Fey's: their sprite is no person in clothes
  if (f.type === FACTION_TYPES.Daedra || f.type === FACTION_TYPES.God || f.ggroup === GUILD_GROUPS.Oblivion || f.ggroup === GUILD_GROUPS.TheFey) return 'none';
  if (f.type === FACTION_TYPES.Temple || f.ggroup === GUILD_GROUPS.HolyOrder) return 'priest';
  if (f.ggroup === GUILD_GROUPS.MagesGuild || f.type === FACTION_TYPES.MagicUser) return 'mage';
  if (f.type === FACTION_TYPES.WitchesCoven || f.ggroup === GUILD_GROUPS.Witches || f.ggroup === GUILD_GROUPS.Necromancers) return 'mage';   // MWNPC17
  if (f.ggroup === GUILD_GROUPS.KnightlyOrder || f.type === FACTION_TYPES.KnightlyGuard) return 'knight';   // MWNPC17: was 'steel'
  if (f.ggroup === GUILD_GROUPS.FightersGuild) return 'fighter';   // MWNPC17: was 'steel'
  if (f.sgroup === SOCIAL_GROUPS.Nobility || f.type === FACTION_TYPES.Courts) return 'noble';
  if (f.sgroup === SOCIAL_GROUPS.Merchants) return 'merchant';
  if (f.sgroup === SOCIAL_GROUPS.Underworld || f.type === FACTION_TYPES.Thieves || f.ggroup === GUILD_GROUPS.DarkBrotherHood) return 'underworld';   // MWNPC17: and the Brotherhood
  if (f.sgroup === SOCIAL_GROUPS.Scholars) return 'scholar';
  return 'common';
}

/**
 * The person's look, or null when they keep their sprite (a child, a vampire, a race the data cannot name) or have
 * none to keep (an editor marker). `data` is
 * staticNpcData's record; `faction` its faction's FACTION.TXT row. Kept on the person: a standing person is one build
 * for as long as they stand. MWNPC17: dressed by their kind's role off their name seed (characters/wardrobe.js).
 * @param {any} pn @param {any} data @param {any} faction
 */
export function personLook(pn, data, faction) {
  if (pn._mwLook !== undefined) return pn._mwLook;
  if (!data || isChildNPCData(data)) return (pn._mwLook = null);
  // MWNPC8b: an EDITOR flat (a marker DFU never renders, whatever faction it carries) is no one to stand a body for -
  // STALL-FLATS (FIELD BUGS 2026-10-15c, "every animal and food stand item turned into freaks"; "The NPC's are clustered
  // into groups and all have their heads down and they just rotate"): nor a flat whose picture is no person's - a town
  // mod's market food, goods and animals carry faction ids (Beautiful Villages' TVRNAS02, TEMPASB0, TEMPBSB0, RESIAS02:
  // faction 584), and RMBLayout makes each a StaticNPC, but DFU draws a person only of RDBLayout.NPCFlatArchives
  // (FlatTypes.NPC, DaggerfallBillboard) and the rest as their billboards - AUDIT WD3 G1's click law, the body's now. A
  // quest's person is one by the quest's word, whatever FLATS.CFG pictures them with (`questPerson`). The editor's 199 is
  // no person's archive, so this one law keeps the marker's sprite-less flat bodiless too.
  if (!data.questPerson && !isNpcFlat(data.billboardArchiveIndex)) return (pn._mwLook = null);
  const kind = wardrobeOf(faction);
  const race = RACE_NAME[data.race];
  if (kind === 'none' || !race) return (pn._mwLook = null);
  const gender = data.gender === GENDERS.Female ? 'female' : 'male';
  const seed = mix((data.nameSeed | 0) ^ mix(data.hash | 0));
  const d = dressPerson({ role: KIND_ROLE[kind], gender, seed });
  return (pn._mwLook = { race, gender, faceIndex: mix(seed ^ 0xfa) % 10, items: d.items, npc: d.npc });
}

/**
 * MWNPC18 (2026-10-11, a player's report via Mac: "Player decorations are not affected" - bible/04-Characters/
 * Morrowind-NPCs.md section 26): A FIGURE A PLAYER PLACED (net/decorLaw.js decorIsFigure - one of Daggerfall's people
 * set down in a home or its yard, DECOR-FIGURE) stands in a Morrowind body as the room's own people do. It has no
 * StaticNPC record - no faction, no flags - so what it IS is read off its picture: its sex off FLATS.CFG's gender column
 * (formats/flatsFile.js flatGender), its role off FLATS.CFG's caption (figureRole - a judgement, words to a wardrobe
 * role), its race the region's, and its seed its piece's id, so every visitor sees the same person and a second copy of
 * one picture is a second person. A child keeps their picture, and so does a figure no row names a sex for and the
 * Daedra Princes' archive (TEXTURE.175 - Azura is no person in clothes). `fig` keeps the answer (a standing piece is one
 * build); `ctx.flats` is FLATS.CFG (null: not read yet - asked again), `ctx.race` the region's - read only when a figure
 * is first looked at (a host hands one object for every frame, its members getters).
 * @param {any} fig a standing piece ({ piece }) @param {{ flats?: any, race?: any } | null} [ctx]
 */
export function figureLook(fig, ctx = null) {
  if (fig._mwLook !== undefined) return fig._mwLook;
  const piece = fig.piece, flat = piece?.flat;
  if (!Array.isArray(flat)) return (fig._mwLook = null);
  const [a, r] = flat;
  if (a === DAEDRA_PRINCES_ARCHIVE || isChildNPCTexture(a, r)) return (fig._mwLook = null);
  const flats = ctx?.flats ?? null;
  if (!flats) return null;
  const row = flats.getFlatData?.(a, r) ?? null;
  const gender = row ? flatGender(row.gender) : null;
  if (!gender) return (fig._mwLook = null);
  const seed = textSeed(`decor:${piece.id}`);
  const d = dressPerson({ role: figureRole(row.caption), gender, seed });
  return (fig._mwLook = { race: raceNameOf(ctx?.race ?? null), gender, faceIndex: seed % 10, items: d.items, npc: d.npc });
}
/** MWNPC18: TEXTURE.175, the Daedra Princes as their quests summon them - never a person's body. */
export const DAEDRA_PRINCES_ARCHIVE = 175;
/** MWNPC18: a race the host names (a RACES id, or a name) as the look spells it - the Bay's Breton when it names none. */
const raceNameOf = (race) => (typeof race === 'number' ? RACE_NAME[race] : typeof race === 'string' && race in RACES ? race : null) ?? 'Breton';
/** MWNPC18: THE CAPTION'S WORDS, to a wardrobe role (characters/wardrobe.js WARDROBE_ROLES) - the first that matches, in this
 *  order (a "noble knight" is a knight); none, the street's. A judgement over FLATS.CFG's own words, recorded here.
 *  AUDIT MWNPC16-18 D3: each word from its start (`\b`), and a short one whole - "good-looking" and "walking" held a
 *  king, "country" a count, "overseer" a seer, "image" a mage, "relaxed" an axe and "monkey" a monk. A guard and a smith
 *  are read inside a word (a bodyguard, a blacksmith). */
/** @type {ReadonlyArray<[string, RegExp]>} */
export const FIGURE_ROLE_WORDS = Object.freeze([
  ['priest', /\b(?:priest|monks?\b|nuns?\b|cleric|healer|acolyte|templar|abbot|abbess|holy\b)/i],
  ['mage', /\b(?:mages?\b|wizard|sorcer|witch|warlock|necromanc|magician|enchant|seers?\b|mystic|alchemist)/i],
  ['knight', /\b(?:knight|soldier|captain|sentry|sentries|paladin|sergeant)|guard/i],
  ['fighter', /\b(?:warrior|fighter|barbarian|mercenar|swordsm|archer|spear|axes?\b|axe-?m[ae]n|crossbow|amazon|gladiator)/i],
  ['noble', /\b(?:noble|lords?\b|lady|ladies|kings?\b|queen|prince|baron|duke|duchess|count(?:ess)?\b|regent|courtier|elegant|royal|emperor|empress|aristocra)/i],
  ['rogue', /\b(?:thief|thieves|rogue|assassin|cutthroat|bandit|brotherhood|smuggler|pirate|cowl)/i],
  ['merchant', /\b(?:merchant|shopkeep|trader|vendor|innkeep|barkeep|bartender|banker|tailor|grocer)|smith/i],
  ['scholar', /\b(?:scholar|sages?\b|librarian|scribe|teacher|professor|clerk|historian)/i],
]);
/** MWNPC18: the role a caption names, or the street's. @param {any} caption @returns {string} */
export function figureRole(caption) {
  const c = String(caption ?? '');
  for (const [role, re] of FIGURE_ROLE_WORDS) if (re.test(c)) return role;
  return 'commoner';
}

/** The turn a standing person makes toward the player, radians a second - a person's, not a billboard's snap. */
export const PERSON_TURN_RATE = 3;
const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

let _ids = 0;
/**
 * The actor the lane stands for a standing person: their look, their feet at their billboard's base, idle, turning
 * toward `eye` at PERSON_TURN_RATE (the first frame facing it) - forward is (sin, cos), the foes' convention. One
 * object a person, rewritten each frame.
 * @param {any} pn @param {any} look @param {number[]} feet @param {number[]} eye @param {number} dt
 */
export function personActor(pn, look, feet, eye, dt) {
  const a = pn._mwActor ??= { id: `p${++_ids}`, look: null, feet: null, yaw: 0, moving: false, running: false, drawn: false, swings: 0, strike: 0, casts: 0, castRange: 0, hits: 0, dead: 0 };
  a.look = look; a.feet = feet;
  const want = Math.atan2(eye[0] - feet[0], eye[2] - feet[2]);
  if (pn._mwYaw == null) pn._mwYaw = want;
  else {
    const d = wrap(want - pn._mwYaw), step = PERSON_TURN_RATE * Math.max(0, dt);
    pn._mwYaw = wrap(pn._mwYaw + (Math.abs(d) <= step ? d : Math.sign(d) * step));
  }
  a.yaw = pn._mwYaw;
  return a;
}
