// @ts-check
// MWNPC5b (2026-10-09, the MW-NPC arc's fifth slice - bible/04-Characters/Morrowind-NPCs.md section 10b): A FOE, READ
// FOR ITS BODY. The NPC lane (characters/npcBodies.js) stands an actor from a look and a few facts; this reads both off
// a class foe as every foe host keeps it (dungeonContext.js's records, scenes/exteriorFoes.js's - the same shape: an
// `entity` with its worn equip table, an `ai` motor with its feet, yaw and stride, the stream's attack and cast counts,
// the billboard `batch` the host has already dressed in the foe's tells this frame). It owns no rule of the foe's: the
// look is what the foe WEARS (its equip table - composeLook's own read, the player's look's), the race and the face
// are the foe's own stable draw (Daggerfall's class foes have neither; one Breton for every bandit is the plan's own
// complaint), and the tells are the batch's as the host set them.
import { composeLook } from '../net/remotePlayers.js';
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';
import { creatureLook } from './creatureBodies.js';   // MWNPC9: a creature foe's look, its Morrowind creature
import { ARMOR_ENUM, WEAPONS_ENUM, equipmentVariantFor } from '../combat/enemyEquipment.js'; import { ARMOR_MATERIAL } from '../systems/armorMaterials.js'; import { MOBILE_TYPES } from './mobileTypes.js';   // MWNPC10: a roster's people, armoured and armed by their class

/** The Iliac Bay's people, weighted - the races a class foe is drawn as (Daggerfall's own spelling, the look's). The
 *  Bay is Breton and Redguard country; the rest are travellers, the beast folk fewest. */
/** @type {ReadonlyArray<[string, number]>} */
export const FOE_RACES = Object.freeze([
  ['Breton', 30], ['Redguard', 25], ['Nord', 10], ['WoodElf', 9], ['DarkElf', 8], ['HighElf', 8], ['Khajiit', 5], ['Argonian', 5],
]);
const RACE_TOTAL = FOE_RACES.reduce((a, [, w]) => a + w, 0);

/** What a foe wears UNDER its armour, by gender: a shirt, pants (or a skirt), shoes - the templates Daggerfall's own
 *  wardrobe draws them from (itemTemplates.json; mwItemMap.js DF_CLOTHING_ROWS dresses each in a Morrowind CLOT), and
 *  the dyes a common garment takes. A slot the foe's armour fills (the cuirass, the greaves, the boots) shows the armour
 *  - the reference's own slot law; the clothes are under it. */
export const FOE_WARDROBE = Object.freeze({
  male: Object.freeze({ group: 'MensClothing', shirts: [165, 166, 167, 168, 169, 170, 171, 172, 158], legs: [151, 152], feet: [147, 149, 148] }),
  female: Object.freeze({ group: 'WomensClothing', shirts: [202, 203, 204, 205, 206, 207, 208, 209, 184], legs: [190, 212], feet: [186, 188, 187] }),
});
export const FOE_DYES = Object.freeze([1, 3, 5, 0, 2, 9, 4, 6]);   // Grey, DarkBrown, LightBrown, Blue, Red, Green, Purple, White

/** A 32-bit mix (splitmix's finaliser) - the foe's draws, the same on every machine that sees the same foe. */
function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** The foe's seed: its species and where its layout stood it (`marker`, the dungeon's; the encounter's spawn point
 *  otherwise) - facts every machine in the room shares, so a foe is the same person on each. A foe with neither takes
 *  its own sequence number (a watchman his pool's id). */
export function foeSeed(f) {
  if (f._mwSeed != null) return f._mwSeed;
  const at = f.marker ?? f.spawnAt ?? null;
  let h = mix((f.mobileType | 0) + 0x9e3779b9);
  if (at) for (const v of [at[0], at[2]]) h = mix(h ^ (Math.round((v || 0) * 10) | 0));
  else h = mix(h ^ ((f.seq ?? f.id ?? 0) | 0));   // MWNPC6: a watchman has no layout point and rides the wire late - his own number
  return (f._mwSeed = h);
}
const pick = (list, h) => list[h % list.length];

/** MWNPC10: the person a seed draws - a race of the Bay's by its weight and a face - one home for the foe's look and
 *  the roster's (rosterLook). */
function bayPerson(h) {
  let r = mix(h ^ 0x51ed27) % RACE_TOTAL, race = FOE_RACES[0][0];
  for (const [name, w] of FOE_RACES) { if (r < w) { race = name; break; } r -= w; }
  return { race, faceIndex: mix(h ^ 0xfa) % 10 };
}
/** MWNPC10: the clothes under what `items` already holds - a shirt, legs and shoes for each slot nothing fills, dyed
 *  off the seed (the reference's slot law: the armour shows, the clothes are under it). */
function clothesUnder(items, W, h) {
  const has = new Set(items.map((it) => it.equipSlot));
  const dye = (k) => pick(FOE_DYES, mix(h ^ k));
  if (!has.has(EQUIP_SLOTS.ChestClothes)) items.push({ templateIndex: pick(W.shirts, mix(h ^ 0xc1)), group: W.group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: dye(0xd1) });
  if (!has.has(EQUIP_SLOTS.LegsClothes)) items.push({ templateIndex: pick(W.legs, mix(h ^ 0xc2)), group: W.group, equipSlot: EQUIP_SLOTS.LegsClothes, dye: dye(0xd2) });
  if (!has.has(EQUIP_SLOTS.Feet)) items.push({ templateIndex: pick(W.feet, mix(h ^ 0xc3)), group: W.group, equipSlot: EQUIP_SLOTS.Feet, dye: dye(0xd3) });
  return items;
}

/** Is this foe one a Morrowind body stands for? A CLASS foe (Daggerfall's people - the mobiles past 127) - the
 *  creatures are MWNPC9's, with their own skeletons. */
export const isClassFoe = (f) => !!f?.entity?.isClass;
/** MWNPC12 (bible/04-Characters/Morrowind-NPCs.md section 17): THE ORCS - Daggerfall's monsters that are people (the
 *  orc, its sergeant, its shaman, its warlord). Each stands as a person in Morrowind's Orc body, dressed and armed from
 *  its own equip table as a class foe is (DFU arms an orc as it arms a class - enemyEquipment.js equipmentVariantFor);
 *  never a creature (creatureBodies.js declares them misses). */
/** @type {Set<number>} */
export const ORC_MOBILES = new Set([MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord]);
/** MWNPC14 (section 19): THE VAMPIRES - people, as Morrowind's are: a vampire foe stands as a person of the Bay in its
 *  clothes, wearing its race's vampire head (formats/mwFirstPerson.js vampireHeadRecord, the look's `vampire`). */
/** @type {Set<number>} */
export const VAMPIRE_MOBILES = new Set([MOBILE_TYPES.Vampire, MOBILE_TYPES.VampireAncient]);
/** MWNPC12: a foe that stands as a person - a class foe, or an orc; MWNPC14: or a vampire. */
export const isPersonFoe = (f) => isClassFoe(f) || ORC_MOBILES.has(f?.mobileType) || VAMPIRE_MOBILES.has(f?.mobileType);
/** MWNPC9: a foe that stands in a body - a person (MWNPC12: an orc too), or a creature Morrowind has a match for
 *  (creatureBodies.js). */
export const isBodyFoe = (f) => isPersonFoe(f) || !!creatureLook(f);

/** The foe's look: its race and face drawn off its seed, its gender its own, and what it wears - its equip table, as
 *  the player's look reads the player's (composeLook), with the clothes under the armour it has none over. Kept on the
 *  foe while its equip table holds the same pieces (a look is a cache key - PeerBodies builds a new body for a new
 *  one), so a foe that picks up nothing is one build for its life. */
export function foeLook(f) {
  const e = f.entity;
  // MWNPC5c: asked every frame, so the common answer is a compare - the same pieces in the same slots (by reference,
  // no allocation) is the same look; only a change composes it again
  const slots = equipTableOf(e);
  const held = f._mwLookSlots;
  if (f._mwLook && held && held.length === slots.length) {
    let same = true;
    for (let i = 0; i < slots.length; i++) if (slots[i] !== held[i]) { same = false; break; }
    if (same) return f._mwLook;
  }
  f._mwLookSlots = slots.slice();
  const worn = composeLook(e, { eotbSet: null }).items;
  const wornKey = worn.map((it) => `${it.equipSlot}:${it.templateIndex}:${it.material ?? ''}:${it.dye ?? ''}`).join('|');
  if (f._mwLook && f._mwLookKey === wornKey) return f._mwLook;
  const h = foeSeed(f);
  const bay = bayPerson(h), faceIndex = bay.faceIndex;
  const race = ORC_MOBILES.has(f.mobileType) ? 'Orc' : bay.race;   // MWNPC12: an orc in Morrowind's Orc body
  const gender = f.gender === 'female' ? 'female' : 'male';
  f._mwLookKey = wornKey;
  return (f._mwLook = { race, gender, faceIndex, items: clothesUnder([...worn], FOE_WARDROBE[gender], h), ...(VAMPIRE_MOBILES.has(f.mobileType) ? { vampire: true } : {}) });   // MWNPC14: a vampire's face
}

/** The foe's id among the lane's: its host's sequence number where it keeps one (exteriorFoes' `seq`), else one minted
 *  on the record - never reused while the record lives. */
let _ids = 0;
export const foeId = (f) => f.seq ?? (f._mwId ??= ++_ids);

/**
 * The actor the lane stands, off the foe as its host left it this frame (characters/npcBodies.js `stand`):
 *   - THE STRIDE: its motor's feet and yaw (the player's own yaw convention: forward is (sin yaw, cos yaw)), moving
 *     and - in pursuit (its give-up timer running, both motors' field) - running;
 *   - THE BLOW: the stream's attack count (`_atkA`, its low bit the ranged flag - enemyTargets.js bumpAtkCount), each
 *     new count a swing, its strike drawn from the count (Morrowind's NPCs pick theirs at random; the count is the
 *     roll every machine shares);
 *   - THE CAST: the stream's cast count (`_castN`);
 *   - THE RECOIL: a count of the health drops the host's hit flash has seen (systems/hitFlash.js foeHitFlash marks
 *     each on the foe as `_hfAt`) - each new mark a recoil;
 *   - THE DEATH: dead, the death's roll + 1 off its seed.
 * @param {any} f
 */
export function foeActor(f, id = foeId(f)) {   // MWNPC6: `id` a population's own (the watch's pool id - its wire number comes late)
  if (f._hfAt != null && f._hfAt !== f._mwHitAt) { f._mwHitAt = f._hfAt; f._mwHits = ((f._mwHits | 0) + 1) & 0xffff; }
  const swings = (f._atkA | 0) >> 1;
  return {
    id,
    look: isPersonFoe(f) ? foeLook(f) : creatureLook(f),   // MWNPC9: a creature's is its Morrowind creature; MWNPC12: an orc a person's
    feet: f.ai.feet,
    yaw: f.ai.yaw,
    moving: !!f.ai.moving,
    running: !!f.ai.moving && f.ai.giveUpTimer > 0,   // pursuing (EnemyMotor's GiveUpTimer running): a Morrowind NPC runs at its foe
    drawn: true,   // a class foe's weapon is out - Daggerfall's foes never sheathe
    swings,
    strike: 1 + (swings % 6),   // POSE_STRIKES 1..6: down, down-left, left, right, down-right, up
    casts: f._castN | 0,
    castRange: 2,   // the target range - a foe casts at its target (the pose's `cr`)
    hits: f._mwHits | 0,
    dead: f.dead ? 1 + (mix(foeSeed(f) ^ 0xdead) % 5) : 0,
  };
}

/** MWNPC10: the classes that go in steel when no equip table says what they wear - the knight, the warrior, the
 *  spellsword, the watch (the watch helmed, as the street's guard is). */
/** @type {Set<number>} */
const STEEL_CLASSES = new Set([MOBILE_TYPES.Knight, MOBILE_TYPES.Warrior, MOBILE_TYPES.Spellsword, MOBILE_TYPES.Knight_CityWatch]);
const STEEL_PLATE = Object.freeze([['ChestArmor', 'Cuirass'], ['LegsArmor', 'Greaves'], ['Feet', 'Boots'], ['LeftArm', 'Left_Pauldron'], ['RightArm', 'Right_Pauldron'], ['Gloves', 'Gauntlets']]);

/** MWNPC10c: a roster's blade, by DFU's own roll for a class foe (combat/enemyEquipment.js rollEnemyEquipment): one of
 *  its two variants - a broadsword, a saber or a longsword; or a two-hander, a claymore to a battle axe - iron or
 *  steel, off the seed. */
function rosterBlade(h, two = mix(h ^ 0xb1) & 1) {   // MWNPC12: or the variant's own (an orc's)
  const lo = two ? WEAPONS_ENUM.Claymore : WEAPONS_ENUM.Broadsword, hi = two ? WEAPONS_ENUM['Battle Axe'] : WEAPONS_ENUM.Longsword;
  return { templateIndex: lo + (mix(h ^ 0xb2) % (hi + 1 - lo)), group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand, material: mix(h ^ 0xb3) & 1 };
}

/** MWNPC12: the pieces DFU rolls for an armed monster, in its order (rollEnemyEquipment) - each its own chance. */
const ORC_PIECES = Object.freeze([['Head', 'Helm'], ['RightArm', 'Right_Pauldron'], ['LeftArm', 'Left_Pauldron'], ['ChestArmor', 'Cuirass'], ['LegsArmor', 'Greaves'], ['Feet', 'Boots']]);
/** MWNPC12: an armour material by DFU's own roll (enemyEquipment.js randomArmorMaterial): leather below 70, chain to
 *  89, plate from 90 - iron or steel, the low levels' plate. */
function orcMaterial(h) {
  const roll = 1 + (mix(h) % 100);
  return roll >= 90 ? (mix(h ^ 0x1e) & 1 ? ARMOR_MATERIAL.Steel : ARMOR_MATERIAL.Iron) : roll >= 70 ? ARMOR_MATERIAL.Chain : ARMOR_MATERIAL.Leather;
}
/** MWNPC12: AN ORC'S KIT WITH NO EQUIP TABLE TO READ (a road's or a roster's orc), by DFU's own roll for it
 *  (rollEnemyEquipment over equipmentVariantFor): the orc and its shaman a one-hander, half the time a shield, each
 *  piece of armour at even odds; the sergeant a two-hander and each piece three times in four; the warlord a
 *  two-hander and nine in ten - off the seed. */
function orcKit(mobileType, h) {
  const variant = equipmentVariantFor(mobileType, false) ?? 0;
  const items = /** @type {any[]} */ ([rosterBlade(h, variant > 0 ? 1 : 0)]);
  const chance = variant === 0 ? 50 : variant === 1 ? 75 : 90;
  if (variant === 0 && mix(h ^ 0x5d) % 100 < 50) items.push({ templateIndex: ARMOR_ENUM.Buckler + (mix(h ^ 0x5e) % (ARMOR_ENUM.Round_Shield + 1 - ARMOR_ENUM.Buckler)), group: 'Armor', equipSlot: EQUIP_SLOTS.LeftHand, material: orcMaterial(h ^ 0x5f) });
  ORC_PIECES.forEach(([slot, piece], k) => { if (mix(h ^ (0xa0 + k)) % 100 < chance) items.push({ templateIndex: ARMOR_ENUM[piece], group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material: orcMaterial(h ^ (0xe0 + k)) }); });
  return items;
}

/**
 * MWNPC10 (bible/04-Characters/Morrowind-NPCs.md section 15b): THE LOOK OF ONE A ROSTER DRIVES - a siege's fighter, a
 * ship's hand - with no entity to read. A creature mobile is its creature (creatureBodies.js; null where there is no
 * match); a class mobile a person: a race of the Bay's and a face off `seed`, its gender, the clothes a foe wears under
 * its armour in their dyes, and steel for the classes that go in it (the watch helmed) - MWNPC10c: and its class's
 * blade in its hand (`rosterBlade`), and `race` its own where the caller knows it (a living world's resident). Kept on
 * `rec` while the mobile, gender, seed and race hold - one build for its life.
 * @param {any} rec @param {{ mobileType: number, gender?: string, seed?: number, race?: string }} o
 */
export function rosterLook(rec, { mobileType, gender = 'male', seed = 0, race = undefined }) {
  if (rec._mwRosterMob === mobileType && rec._mwRosterG === gender && rec._mwRosterSeed === seed && rec._mwRosterRace === race) return rec._mwRosterLook;   // no key built a frame
  rec._mwRosterMob = mobileType; rec._mwRosterG = gender; rec._mwRosterSeed = seed; rec._mwRosterRace = race;
  const orc = ORC_MOBILES.has(mobileType);   // MWNPC12: a person, never a creature
  const vampire = VAMPIRE_MOBILES.has(mobileType);   // MWNPC14: and a vampire
  if (!orc && !vampire && !(mobileType >= 128)) return (rec._mwRosterLook = creatureLook({ mobileType }));
  const h = mix((seed >>> 0) ^ mix((mobileType | 0) + 0x9e3779b9));
  const bay = bayPerson(h);
  const g = gender === 'female' ? 'female' : 'male';
  const items = /** @type {any[]} */ (orc ? orcKit(mobileType, h) : vampire ? [] : [rosterBlade(h)]);   // MWNPC14: a vampire's claws are its own
  if (STEEL_CLASSES.has(mobileType)) {
    for (const [slot, piece] of STEEL_PLATE) items.push({ templateIndex: ARMOR_ENUM[piece], group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material: ARMOR_MATERIAL.Steel });   // steel (MWNPC12: by mwArmorRecords' own table)
    if (mobileType === MOBILE_TYPES.Knight_CityWatch) items.push({ templateIndex: ARMOR_ENUM.Helm, group: 'Armor', equipSlot: EQUIP_SLOTS.Head, material: ARMOR_MATERIAL.Steel });
  }
  return (rec._mwRosterLook = { race: orc ? 'Orc' : race ?? bay.race, gender: g, faceIndex: bay.faceIndex, items: clothesUnder(items, FOE_WARDROBE[g], h), ...(vampire ? { vampire: true } : {}) });
}

/** The tells the host has dressed the foe's billboard in this frame, for its body's quad (renderer.js
 *  drawCharacterSpriteQuad `fx`): the glint, the elite's pulse and clock, the dissolve - one object on the foe, rewritten
 *  in place each frame (no allocation a frame). Null when it wears none. `batch` the one to read - a corpse's flat for
 *  the dead (an elite's corpse keeps its rim). */
export function foeFx(f, batch = f?.batch) {
  if (!batch) return null;
  const glint = batch.glint && batch.glint[3] > 0 ? batch.glint : null;
  const elite = batch.eliteGlow || 0;
  const dissolve = batch.dissolve && batch.dissolve[0] > 0 ? batch.dissolve : null;
  if (!glint && !elite && !dissolve) return null;
  const fx = f._mwFx ?? (f._mwFx = { glint: null, elite: 0, time: 0, dissolve: null });
  fx.glint = glint; fx.elite = elite; fx.time = batch.eliteTime || 0; fx.dissolve = dissolve;
  return fx;
}
