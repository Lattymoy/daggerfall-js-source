// @ts-check
// MWNPC8 (2026-10-09, the MW-NPC arc's eighth slice - bible/04-Characters/Morrowind-NPCs.md section 13): A STANDING
// PERSON, READ FOR THEIR BODY. Daggerfall's standing people - the shopkeeper, the guild's officer, the noble at court,
// the drunk in the tavern - are StaticNPCs (characters/staticNpc.js staticNpcData): a race off their faction (else the
// region's), a gender off their record's flags, a faction whose social group and guild say who they are. The body wears
// THAT: a wardrobe by the faction (a temple's priest in priest's robes, a mage in robes, a knight or a fighter in steel,
// a noble in a formal tunic or a fine skirt, a merchant in a tunic and breeches, the underworld in dark plain clothes,
// everyone else the street's own outfits), dyed off their name seed. A child keeps their sprite, and so does a vampire
// (the plan's law: neither has a Morrowind body of their own here). They stand idle and turn to face the player, as
// Daggerfall's billboards always did, at a person's pace.
import { GENDERS } from './nameHelper.js';
import { isChildNPCData } from './staticNpc.js';
import { RACES } from '../systems/races.js';
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../formats/factionFile.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../systems/armorMaterials.js';   // MWNPC12: steel is ARMOR_MATERIAL.Steel
import { FOLK_OUTFITS } from './folkBodies.js';
import { EDITOR_FLATS_ARCHIVE } from '../world/rmbFlats.js';

const RACE_NAME = Object.freeze(Object.fromEntries(Object.entries(RACES).map(([k, v]) => [v, k])));

/** The wardrobes, by what a faction says a person is: [male, female] each [chest, legs or null, feet], and the dyes
 *  it is worn in (characters/dyes.js DYE_COLORS). */
export const PEOPLE_WARDROBE = Object.freeze({
  priest: Object.freeze({ male: [164, null, 147], female: [201, null, 186], dyes: [6, 8, 2] }),          // priest's robes: white, yellow, red
  mage: Object.freeze({ male: [163, null, 147], female: [200, null, 186], dyes: [0, 4, 7, 1] }),         // plain robes: blue, purple, aquamarine, grey
  noble: Object.freeze({ male: [159, 152, 148], female: [184, 212, 187], dyes: [4, 2, 0, 6, 9] }),       // a formal tunic, breeches, tall boots; a blouse and a long skirt
  merchant: Object.freeze({ male: [158, 152, 149], female: [204, 190, 188], dyes: [5, 3, 9, 0, 7] }),    // a tunic and breeches; a long shirt and pants
  underworld: Object.freeze({ male: [165, 151, 149], female: [202, 190, 188], dyes: [3, 1] }),            // dark plain clothes
  scholar: Object.freeze({ male: [163, null, 147], female: [200, null, 186], dyes: [3, 1, 5] }),         // plain robes in plain colours
});
/** Who wears steel: a knightly order's, a fighters' guild's, a knightly guard's person. */
const STEEL = Object.freeze([['ChestArmor', ARMOR_ENUM.Cuirass], ['LegsArmor', ARMOR_ENUM.Greaves], ['Feet', ARMOR_ENUM.Boots],
  ['LeftArm', ARMOR_ENUM.Left_Pauldron], ['RightArm', ARMOR_ENUM.Right_Pauldron], ['Gloves', ARMOR_ENUM.Gauntlets]]);
const COMMON_DYES = Object.freeze([1, 3, 5, 0, 2, 9, 4, 6, 7, 8]);

function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** What a faction makes a person wear: 'priest', 'mage', 'steel', 'noble', 'merchant', 'underworld', 'scholar', or
 *  'common' (the street's outfits); 'none' for a vampire, a Daedra, a god, Oblivion's or the Fey's - who keep their
 *  sprites. @param {any} f the FACTION.TXT row */
export function wardrobeOf(f) {
  if (!f) return 'common';
  if (f.type === FACTION_TYPES.VampireClan || f.ggroup === GUILD_GROUPS.Vampires || f.sgroup === SOCIAL_GROUPS.SupernaturalBeings) return 'none';
  // MWNPC8b: nor anyone not mortal - a Daedra, a god, Oblivion's or the Fey's: their sprite is no person in clothes
  if (f.type === FACTION_TYPES.Daedra || f.type === FACTION_TYPES.God || f.ggroup === GUILD_GROUPS.Oblivion || f.ggroup === GUILD_GROUPS.TheFey) return 'none';
  if (f.type === FACTION_TYPES.Temple || f.ggroup === GUILD_GROUPS.HolyOrder) return 'priest';
  if (f.ggroup === GUILD_GROUPS.MagesGuild || f.type === FACTION_TYPES.MagicUser) return 'mage';
  if (f.ggroup === GUILD_GROUPS.KnightlyOrder || f.ggroup === GUILD_GROUPS.FightersGuild || f.type === FACTION_TYPES.KnightlyGuard) return 'steel';
  if (f.sgroup === SOCIAL_GROUPS.Nobility || f.type === FACTION_TYPES.Courts) return 'noble';
  if (f.sgroup === SOCIAL_GROUPS.Merchants) return 'merchant';
  if (f.sgroup === SOCIAL_GROUPS.Underworld || f.type === FACTION_TYPES.Thieves) return 'underworld';
  if (f.sgroup === SOCIAL_GROUPS.Scholars) return 'scholar';
  return 'common';
}

/**
 * The person's look, or null when they keep their sprite (a child, a vampire, a race the data cannot name) or have
 * none to keep (an editor marker). `data` is
 * staticNpcData's record; `faction` its faction's FACTION.TXT row. Kept on the person: a standing person is one build
 * for as long as they stand.
 * @param {any} pn @param {any} data @param {any} faction
 */
export function personLook(pn, data, faction) {
  if (pn._mwLook !== undefined) return pn._mwLook;
  if (!data || isChildNPCData(data)) return (pn._mwLook = null);
  // MWNPC8b: an EDITOR flat (a marker DFU never renders, whatever faction it carries) is no one to stand a body for
  if (data.billboardArchiveIndex === EDITOR_FLATS_ARCHIVE) return (pn._mwLook = null);
  const kind = wardrobeOf(faction);
  const race = RACE_NAME[data.race];
  if (kind === 'none' || !race) return (pn._mwLook = null);
  const female = data.gender === GENDERS.Female;
  const gender = female ? 'female' : 'male';
  const group = female ? 'WomensClothing' : 'MensClothing';
  const seed = mix((data.nameSeed | 0) ^ mix(data.hash | 0));
  const items = [];
  const dyes = kind === 'common' || kind === 'steel' ? COMMON_DYES : PEOPLE_WARDROBE[kind].dyes;
  const dye = (k) => dyes[mix(seed ^ k) % dyes.length];
  let outfit;
  if (kind === 'steel') {
    for (const [slot, piece] of STEEL) items.push({ templateIndex: piece, group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material: ARMOR_MATERIAL.Steel });   // MWNPC12: steel, as mwArmorRecords reads it
    outfit = FOLK_OUTFITS[gender][0];
  } else if (kind === 'common') outfit = FOLK_OUTFITS[gender][mix(seed ^ 0x0f) % 4];
  else outfit = PEOPLE_WARDROBE[kind][gender];
  items.push({ templateIndex: outfit[0], group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: dye(0xd1) });
  if (outfit[1] != null) items.push({ templateIndex: outfit[1], group, equipSlot: EQUIP_SLOTS.LegsClothes, dye: dye(0xd2) });
  if (kind !== 'steel') items.push({ templateIndex: outfit[2], group, equipSlot: EQUIP_SLOTS.Feet, dye: dye(0xd3) });
  return (pn._mwLook = { race, gender, faceIndex: mix(seed ^ 0xfa) % 10, items });
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
