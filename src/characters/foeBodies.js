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
import { LOOK_GROUPS } from '../net/wire.js';   // AUDIT MW-NPC II K2: a worn piece's group, by its index on the wire
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';
import { creatureLook } from './creatureBodies.js';   // MWNPC9: a creature foe's look, its Morrowind creature
import { ARMOR_ENUM, WEAPONS_ENUM, equipmentVariantFor } from '../combat/enemyEquipment.js'; import { ARMOR_MATERIAL } from '../systems/armorMaterials.js'; import { MOBILE_TYPES } from './mobile/mobileTypes.js';   // MWNPC10: a roster's people, armoured and armed by their class
import { npcHint } from './wardrobe.js';   // MWNPC17: the man under the kit his own - his head, his hair, the clothes' records
import { isClassEnemyId, isClassicEnemyId } from './enemy/enemyBasics.js';   // DEX1: DFU's class test (DaggerfallEntity.IsClassEnemyId) - a mod's monster past 255 is no class; DEX7: a mod's person row names its own mobile

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
/** The foe's seed: its species and where its layout stood it (`marker`, the dungeon's - every machine builds the layout
 *  alike), else its number and where it stood when its seed was first asked. AUDIT MW-NPC II K3/K4: A SEED IS MINTED
 *  ONCE AND RIDES THE WIRE. Off the wire number alone, two owners' number 3s of one species were one man (the watch, all
 *  146, most of all), an heir's renumbering (exteriorFoes.js adopt) made another person mid-fight on every screen, and a
 *  dungeon puppet - stood at its first streamed feet, its `marker` - was another person than its owner's (AUDIT MW-NPC
 *  C5 had a watchman's look follow his late number for the same reason). Now the owner mints it once, at its own foe,
 *  and streams it (the record's `ls`); a copy stood off a record takes the owner's (`_mwSeedWire`) and keeps it when it
 *  is adopted, so an heir streams the very seed on.
 *  @param {any} f */
export function foeSeed(f) {
  if (f._mwSeedWire != null) return f._mwSeedWire;
  const own = ownPerson(f);   // FB1012d ALLY-RACE: a person of their own is drawn as themselves, never as this stand
  if (own != null) return own;
  if (f._mwSeed != null) return f._mwSeed;
  const at = f.marker ?? null;
  let h = mix((f.mobileType | 0) + 0x9e3779b9);
  if (at) for (const v of [at[0], at[2]]) h = mix(h ^ (Math.round((v || 0) * 10) | 0));
  else {
    h = mix(h ^ ((f.seq ?? f.id ?? 0) | 0));   // MWNPC6: a watchman has no layout point - his number, where he has one
    const p = f.ai?.feet;
    if (p) for (const v of [p[0], p[2]]) h = mix(h ^ (Math.round((v || 0) * 10) | 0));   // AUDIT MW-NPC II K4: and where he stood - two owners' number 3s are two men
  }
  return (f._mwSeed = h);
}
/** FB1012d ALLY-RACE (bible/01-Overview/bugs/Field-Bugs-2026-10-12d.md; the owner: "companions when morrowind attached switches
 *  character race"): A PERSON OF THEIR OWN. foeSeed's stand law - its species and where it stood, or its number and
 *  feet - drew a companion afresh at every stand: every door, dungeon, fast travel, load and sweep stood him in a new
 *  body of the Bay's (a Breton hand a Nord through the next door, a Wood Elf through the one after). One whose person is
 *  their own is drawn as that person, wherever and however often a body stands for them: a companion the layer stood
 *  (scenes/crewAshore.js stamps `person` on every body it stands - a crew hand his own, a sworn revenant its record's),
 *  and a revenant come back for the player (its record's `person` on its stamp - systems/revenant/revenant.js revenantPerson,
 *  minted off the body it was born in), so the one that kneels is the one that follows. It is the seed: every machine
 *  reads it off the wire (`ls`) as a foe's own, so the room sees the same man. Null: a foe of the place, drawn off where
 *  it stood. @param {any} f */
export function ownPerson(f) {
  const p = f?.person ?? f?.entity?.revenant?.person;
  return Number.isInteger(p) && p >= 0 && p <= 0xffffffff ? p : null;
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
 *  clothes, wearing its race's vampire head (formats/morrowind/mwFirstPerson.js vampireHeadRecord, the look's `vampire`). */
/** @type {Set<number>} */
export const VAMPIRE_MOBILES = new Set([MOBILE_TYPES.Vampire, MOBILE_TYPES.VampireAncient]);
/** MWNPC15 (section 20): THE WEREWOLF - a person in its beast form: its look a person's marked `wolf`, which the lane
 *  hands PeerBodies as the wire's wolf bit, so it stands in Bloodmoon's wolf as a transformed player does (WEREWOLF1) -
 *  and where the data has no wolf, PeerBodies refuses it and the sprite stands. */
export const WOLF_MOBILE = MOBILE_TYPES.Werewolf;
/** DEX7 (bible/04-Characters/Enemy-Expansion.md section 10): A MOD'S PEOPLE, AND ITS CLASSES THAT KEEP THEIR SPRITES.
 *  A mod's mobile past the classic ids registers here where the default - a class a person, a monster its creature row
 *  (creatureBodies.js registerCreatureMatches) - is wrong for it: `{ race }` a monster that is a person, drawn in that
 *  race's body as an orc is in the Orc's (dressed from its own equip table, MWNPC12's law); `{ sprite: reason }` a class
 *  that no person's body stands for (a rider - its horse is its sprite's), which keeps its sprite. Each mobile once;
 *  never a classic one - DFU's own are the laws above.
 *  @type {Map<number, Readonly<{ race?: string, sprite?: string }>>} */
const _modPeople = new Map();
/** Register a mod's rows: `[mobileType, { race } | { sprite: reason }]` pairs. */
export function registerPersonFoes(rows) {
  for (const [t, p] of rows) {
    if (!Number.isInteger(t) || isClassicEnemyId(t) || _modPeople.has(t)) throw new Error(`registerPersonFoes: mobile ${t} is classic or already named`);
    if (!!p.race === !!p.sprite) throw new Error(`registerPersonFoes: mobile ${t} is a person or a sprite, never both`);
    if (p.race && !FOE_RACES.some(([r]) => r === p.race)) throw new Error(`registerPersonFoes: mobile ${t}'s race ${p.race} is none of the Bay's`);
    if (p.sprite && !(String(p.sprite).length > 4)) throw new Error(`registerPersonFoes: mobile ${t}'s sprite says why`);
    _modPeople.set(t, Object.freeze({ ...p }));
  }
}
/** The test seam. */
export function _resetPersonFoes() { _modPeople.clear(); }
/** A mod's person race for a mobile, or undefined. */
const modRace = (t) => _modPeople.get(t)?.race;

/** MWNPC12: a foe that stands as a person - a class foe, or an orc; MWNPC14: or a vampire; MWNPC15: or a werewolf; DEX7:
 *  a mod's mobile as its row says (a monster that is a person; a class that keeps its sprite is none). */
export const isPersonFoe = (f) => {
  const p = _modPeople.get(f?.mobileType);
  if (p) return !!p.race;
  return isClassFoe(f) || ORC_MOBILES.has(f?.mobileType) || VAMPIRE_MOBILES.has(f?.mobileType) || f?.mobileType === WOLF_MOBILE;
};
/** MWNPC9: a foe that stands in a body - a person (MWNPC12: an orc too), or a creature Morrowind has a match for
 *  (creatureBodies.js). */
export const isBodyFoe = (f) => isPersonFoe(f) || !!creatureLook(f);

/** The foe's look: its race and face drawn off its seed, its gender its own, and what it wears - its equip table, as
 *  the player's look reads the player's (composeLook), with the clothes under the armour it has none over. Kept on the
 *  foe while its equip table holds the same pieces (a look is a cache key - PeerBodies builds a new body for a new
 *  one), so a foe that picks up nothing is one build for its life. */
export function foeLook(f) {
  const e = f.entity;
  // AUDIT MW-NPC II K2/K3: a copy stood off another machine's record (`_mwWire` - exteriorFoes.js, dungeonContext.js)
  // is its OWNER's man: no body until the owner's seed is here, and in the street's pool none until the owner's kit is
  // (`kit` - a puppet's own table is empty: exteriorFoes spawnFoe, its loot the owner's grant), then the kit worn. A
  // dungeon's copy wears its own table - every machine's copy of a dungeon's foe carries its own roll, the one its
  // player loots (section 23).
  if (f._mwWire && (f._mwSeedWire == null || (f._mwWire === 'kit' && f._mwWornWire == null))) return null;
  // MWNPC5c: asked every frame, so the common answer is a compare - the same pieces in the same slots (by reference,
  // no allocation) is the same look; only a change composes it again
  const slots = f._mwWire === 'kit' ? f._mwWornWireSlots : equipTableOf(e);
  const held = f._mwLookSlots;
  const h = foeSeed(f);   // AUDIT MW-NPC C5: a seed that moved (a watchman's first number) is another look
  if (f._mwLook && held && held.length === slots.length && f._mwLookSeed === h) {
    let same = true;
    for (let i = 0; i < slots.length; i++) if (slots[i] !== held[i]) { same = false; break; }
    if (same) return f._mwLook;
  }
  f._mwLookSlots = slots.slice();
  const worn = f._mwWire === 'kit' ? f._mwWornWire : composeLook(e, { eotbSet: null }).items;
  const wornKey = worn.map((it) => `${it.equipSlot}:${it.templateIndex}:${it.material ?? ''}:${it.dye ?? ''}`).join('|');
  if (f._mwLook && f._mwLookKey === wornKey && f._mwLookSeed === h) return f._mwLook;
  f._mwLookSeed = h;
  const bay = bayPerson(h), faceIndex = bay.faceIndex;
  const race = ORC_MOBILES.has(f.mobileType) ? 'Orc' : modRace(f.mobileType) ?? bay.race;   // MWNPC12: an orc in Morrowind's Orc body; DEX7: a mod's person in its row's race
  const gender = f.gender === 'female' ? 'female' : 'male';
  f._mwLookKey = wornKey;
  return (f._mwLook = { race, gender, faceIndex, items: clothesUnder([...worn], FOE_WARDROBE[gender], h), npc: npcHint(h, 0), ...(VAMPIRE_MOBILES.has(f.mobileType) ? { vampire: true } : {}), ...(f.mobileType === WOLF_MOBILE ? { wolf: true } : {}) });   // MWNPC14: a vampire's face; MWNPC15: a werewolf's beast; MWNPC17: the seed every machine shares, so the copy is the same man
}

/** AUDIT MW-NPC II K2: a worn piece on the wire - [equipSlot, group (LOOK_GROUPS' index), templateIndex, material, dye,
 *  variant], -1 where the piece has none (net/wire.js validFoeRecord `lw`). */
const WORN_FIELDS = Object.freeze(['material', 'dye', 'variant']);
/** @param {any[]} items @returns {number[][]} */
function encodeWorn(items) {
  const out = [];
  for (const it of items) {
    const g = LOOK_GROUPS.indexOf(it.group);
    if (g < 0 || !Number.isInteger(it.templateIndex) || !Number.isInteger(it.equipSlot)) continue;
    out.push([it.equipSlot, g, it.templateIndex, ...WORN_FIELDS.map((k) => (Number.isInteger(it[k]) ? it[k] : -1))]);
  }
  return out;
}
/** The pieces a record's `lw` names, as a look's items. @param {number[][]} lw */
export function decodeWorn(lw) {
  return lw.map(([equipSlot, g, templateIndex, ...rest]) => {
    const it = /** @type {any} */ ({ templateIndex, group: LOOK_GROUPS[g], equipSlot });
    WORN_FIELDS.forEach((k, i) => { if (rest[i] >= 0) it[k] = rest[i]; });
    return it;
  });
}
/**
 * AUDIT MW-NPC II K2-K4: WHAT THE OWNER STREAMS OF ITS FOE'S LOOK - its seed (`ls`, foeSeed) and, a person's, the kit it
 * wears (`lw`: the owner's equip table - or, a copy it adopted, the kit its first owner streamed, which it still wears).
 * `key` changes only when either does; kept on the foe, so a frame that changes nothing composes nothing.
 * @param {any} f @returns {{ seed: number, worn: number[][]|null, key: string }}
 */
export function foeWireLook(f) {
  const seed = foeSeed(f);
  let worn = null;
  if (isPersonFoe(f)) {
    if (f._mwWornWireRaw) worn = f._mwWornWireRaw;
    else {
      const slots = equipTableOf(f.entity), held = f._mwWireSlots;
      let same = !!held && held.length === slots.length;
      if (same) for (let i = 0; i < slots.length; i++) if (slots[i] !== held[i]) { same = false; break; }
      if (!same) { f._mwWireSlots = slots.slice(); f._mwWireWorn = encodeWorn(composeLook(f.entity, { eotbSet: null }).items); f._mwWireKey = null; }
      worn = f._mwWireWorn;
    }
  }
  if (f._mwWireKey == null || f._mwWireKeySeed !== seed || f._mwWireKeyWorn !== worn) {
    f._mwWireKeySeed = seed; f._mwWireKeyWorn = worn;
    f._mwWireKey = `${seed}|${worn ? worn.map((w) => w.join(',')).join(';') : ''}`;
  }
  return { seed, worn, key: f._mwWireKey };
}
/**
 * AUDIT MW-NPC II K2-K4: a record's look onto the copy it drives - the owner's seed (`ls`) and kit (`lw`), each kept
 * until the owner says another (a record that carries neither changes nothing).
 * @param {any} f @param {{ ls?: number, lw?: number[][] }} r
 */
export function applyWireLook(f, r) {
  if (Number.isInteger(r.ls)) f._mwSeedWire = r.ls;
  if (Array.isArray(r.lw)) {
    const k = r.lw.map((w) => w.join(',')).join(';');
    if (k !== f._mwWornWireKey) { f._mwWornWireKey = k; f._mwWornWireRaw = r.lw; f._mwWornWire = decodeWorn(r.lw); f._mwWornWireSlots = [f._mwWornWire]; }   // the slots foeLook compares: the kit, as one piece
  }
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
export function foeActor(f, id = foeId(f), { scale = 1 } = {}) {   // MWNPC6: `id` a population's own (the watch's pool id - its wire number comes late)
  if (f._hfAt != null && f._hfAt !== f._mwHitAt) { f._mwHitAt = f._hfAt; f._mwHits = ((f._mwHits | 0) + 1) & 0xffff; }
  const swings = (f._atkA | 0) >> 1;
  return {
    id,
    look: isPersonFoe(f) ? foeLook(f) : creatureLook(f),   // MWNPC9: a creature's is its Morrowind creature; MWNPC12: an orc a person's
    // AUDIT MW-NPC D1: the dead where the corpse lies - every host lays it on the floor below (C12: a flyer dies mid-air;
    // the dungeon's corpsePos, the marker's pos outdoors, carried by a deck that moves) - never the air it died in
    feet: f.dead ? (f.corpsePos ?? f.corpseMarker?.pos ?? f.ai.feet) : f.ai.feet,
    yaw: f.ai.yaw,
    scale: scale > 0 ? scale : 1,   // AUDIT MW-NPC D3: drawn the size its sprite is (an elite's quarter, a last stand's tenth, the wild giant)
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
  const wolf = mobileType === WOLF_MOBILE;   // MWNPC15: and a werewolf
  const mod = _modPeople.get(mobileType);   // DEX7: a mod's mobile as its row says
  if (mod?.sprite) return (rec._mwRosterLook = null);
  if (!orc && !vampire && !wolf && !mod && !isClassEnemyId(mobileType)) return (rec._mwRosterLook = creatureLook({ mobileType }));
  const h = mix((seed >>> 0) ^ mix((mobileType | 0) + 0x9e3779b9));
  const bay = bayPerson(h);
  const g = gender === 'female' ? 'female' : 'male';
  const items = /** @type {any[]} */ (orc ? orcKit(mobileType, h) : vampire || wolf || (mod && !isClassEnemyId(mobileType)) ? [] : [rosterBlade(h)]);   // MWNPC14: a vampire's claws are its own; DEX7: and a mod's monster's (SetEnemyCareer's table arms none - equipmentVariantFor)
  if (STEEL_CLASSES.has(mobileType)) {
    for (const [slot, piece] of STEEL_PLATE) items.push({ templateIndex: ARMOR_ENUM[piece], group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material: ARMOR_MATERIAL.Steel });   // steel (MWNPC12: by mwArmorRecords' own table)
    if (mobileType === MOBILE_TYPES.Knight_CityWatch) items.push({ templateIndex: ARMOR_ENUM.Helm, group: 'Armor', equipSlot: EQUIP_SLOTS.Head, material: ARMOR_MATERIAL.Steel });
  }
  return (rec._mwRosterLook = { race: orc ? 'Orc' : mod?.race ?? race ?? bay.race, gender: g, faceIndex: bay.faceIndex, items: clothesUnder(items, FOE_WARDROBE[g], h), npc: npcHint(h, 0), ...(vampire ? { vampire: true } : {}), ...(wolf ? { wolf: true } : {}) });   // MWNPC17
}

/** The tells the host has dressed the foe's billboard in this frame, for its body's quad (renderer.js
 *  drawCharacterSpriteQuad `fx`): the glint, the elite's pulse and clock, the dissolve - one object on the foe, rewritten
 *  in place each frame (no allocation a frame). Null when it wears none. `batch` the one to read - a corpse's flat for
 *  the dead (an elite's corpse keeps its rim).
 *  AUDIT DEX B2: and `noShadow`, the flat's - the body standing in its place casts where the flat would have
 *  (net/peer/peerBodies.js `cast`). A NoShadow row's mobile (SetupDemoEnemy.cs:137-140 `if (dfMobile.Enemy.NoShadow)
 *  meshRenderer.shadowCastingMode = Off`, characters/enemy/foeLook.js setupFoeLook - the classic vampires, the frost and
 *  fire daedra, the fire atronach, the mod's NoShadow rows) cast its Morrowind body's shadow while its billboard, cast-only,
 *  was passed over. A corpse's flat carries none of the row's: DFU's NoShadow is the mobile's renderer, and a corpse is
 *  another billboard. */
export function foeFx(f, batch = f?.batch) {
  if (!batch) return null;
  const glint = batch.glint && batch.glint[3] > 0 ? batch.glint : null;
  const elite = batch.eliteGlow || 0;
  const dissolve = batch.dissolve && batch.dissolve[0] > 0 ? batch.dissolve : null;
  const noShadow = batch.noShadow === true;
  if (!glint && !elite && !dissolve && !noShadow) return null;
  const fx = f._mwFx ?? (f._mwFx = { glint: null, elite: 0, time: 0, dissolve: null, noShadow: false });
  fx.glint = glint; fx.elite = elite; fx.time = batch.eliteTime || 0; fx.dissolve = dissolve; fx.noShadow = noShadow;
  return fx;
}

/**
 * FB1015 LOOT-BODY (2026-10-15, the owner: "When looting dead marrowind enemies, they turn to a sprite"): THE BODIES UNDER
 * A WINDOW. Both dungeon hosts draw the level's flats under a window and return before drawFoes - the only place a foe's
 * body was drawn - so AUDIT MW-NPC C6 showed every corpse flat there instead, and the loot window, opened on a body, stood
 * the classic corpse in its place for as long as it was open. The lane's bodies stand as its last sync left them - no
 * sync runs under the window, so none lingers, none steps, every skin is kept - so the window's frame draws them, frozen,
 * as the people's lane is drawn under a window (drawPeople), and marks each corpse flat cast-only where its body stands.
 * A dead foe with no body standing - past the cut, still building, no lane - keeps its flat: C6's law, which this keeps.
 * `stood` the foes drawFoes last offered (the lane's last sync), `corpseFlat(f)` a foe's corpse flat (or none). Answers
 * whether a body pass was drawn.
 * @param {any} lane @param {any[]} foes @param {any[]} stood
 * @param {{ idOf: (f: any) => any, corpseFlat: (f: any) => any, renderer: any, canvas: any, proj: any, view: any, eye: number[] }} o
 */
export function drawBodiesUnderWindow(lane, foes, stood, { idOf, corpseFlat, renderer, canvas, proj, view, eye }) {
  for (const f of foes) { const b = corpseFlat(f); if (b) b.castOnly = false; }
  if (!lane || !(lane.offered > 0)) return false;
  for (const f of stood) { const b = f.dead ? corpseFlat(f) : null; if (b) b.castOnly = lane.has('foe', idOf(f)); }
  renderer.beginCharacterSpriteBatch?.();
  try { lane.draw(canvas, { proj, view, eye }); } finally { renderer.flushCharacterSpriteBatch?.(); }
  return true;
}
