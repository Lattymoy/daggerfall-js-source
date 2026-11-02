// @ts-check
// APPEARANCES (2026-10-27; a player: "Add more horizontal progression please!"; bible/04-Characters/Wardrobe.md): THE
// WARDROBE'S LAW. A look is what a piece draws as - its template, material and style (the variant). A character collects
// every look it holds; a shop lays a collected look over a worn piece of the same kind. Only the drawing changes: every
// number still reads the piece itself. Both ends read this file - the client draws a look, the relay keeps one on a
// look's item only of the piece's kind (net/wire.js validLookItem) - and its one import is a leaf, so the relay's graph
// stays flat. Not a DFU member: Daggerfall Unity has none (Port-Ledger section A, APPEARANCES).
import { clampArmorVariant, ARMOR_MATERIAL } from '../systems/armorMaterials.js';

/** THE KINDS. A piece takes a look of its own kind only, decided by what every renderer draws it with: an armour
 *  piece's slot (the doll's layer, the Morrowind part, Layered Gearing's strip), a shield, and a weapon's classic
 *  first-person sheet, Morrowind's animation group and its hands together - so a look never changes a swing. */
export const APPEARANCE_KINDS = Object.freeze({
  102: 'chest',
  103: 'hands',
  104: 'legs',
  105: 'leftArm',
  106: 'rightArm',
  107: 'head',
  108: 'feet',
  109: 'shield',
  110: 'shield',
  111: 'shield',
  112: 'shield',
  113: 'dagger',
  114: 'shortBlade',
  116: 'shortBlade',
  117: 'shortBlade',
  118: 'longBlade',
  119: 'longBlade',
  120: 'longBlade',
  121: 'longBlade',
  122: 'greatBlade',
  123: 'greatBlade',
  115: 'staff',
  124: 'mace',
  125: 'flail',
  126: 'warhammer',
  127: 'axe',
  128: 'greatAxe',
  129: 'bow',
  130: 'bow',
  // Roleplay & Realism Items' pieces (systems/roleplayRealismItems/rriItems.js) take a look of their kind; their own
  // are drawn only while the mod is on, so none of them is a look
  513: 'axe',
  514: 'lightFlail',
  515: 'chest',
  516: 'legs',
  517: 'leftArm',
  518: 'rightArm',
  519: 'feet',
  520: 'chest',
  521: 'legs',
  522: 'head',
  523: 'feet',
  524: 'hands',
  525: 'leftArm',
  526: 'rightArm',
});
/** The kinds in the order a page lists them: head to foot, the shield, then the weapons. */
export const LOOK_KIND_ORDER = Object.freeze([
  'head',
  'rightArm',
  'leftArm',
  'chest',
  'hands',
  'legs',
  'feet',
  'shield',
  'dagger',
  'shortBlade',
  'longBlade',
  'greatBlade',
  'axe',
  'greatAxe',
  'mace',
  'flail',
  'warhammer',
  'staff',
  'bow',
]);
/** The templates whose looks are collected: DFU's own armour, shields and weapons (an arrow is no look). */
export const LOOK_TEMPLATES = Object.freeze(
  Object.keys(APPEARANCE_KINDS)
    .map(Number)
    .filter((t) => t >= 102 && t <= 130),
);
const ARMOR_TEMPLATES = new Set([
  102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526,
]);
/** A template's group, or null for one that is no piece of the wardrobe's. */
export const groupOfTemplate = (t) =>
  !Object.hasOwn(APPEARANCE_KINDS, t) ? null : ARMOR_TEMPLATES.has(t) ? 'Armor' : 'Weapons';
/** A piece's kind - its template's, where its group agrees - or null. */
export const pieceKind = (item) =>
  item && groupOfTemplate(item.templateIndex) === item.group ? APPEARANCE_KINDS[item.templateIndex] : null;

/** The materials a look is of: leather, chain and the ten plate metals for armour; the ten metals for a weapon. */
export const ARMOR_LOOK_MATERIALS = Object.freeze([
  ARMOR_MATERIAL.Leather,
  ARMOR_MATERIAL.Chain,
  ...Array.from({ length: 10 }, (_, i) => ARMOR_MATERIAL.Iron + i),
]);
export const WEAPON_LOOK_MATERIALS = Object.freeze(Array.from({ length: 10 }, (_, i) => i));
/** Each armour template's style count (itemTemplates.json `variants`; test/systems/appearances.test.js holds it equal). */
export const LOOK_VARIANTS = Object.freeze({ 102: 5, 103: 2, 104: 7, 105: 5, 106: 5, 107: 6, 108: 3 });

/** A material as a look reads it: Chain2 draws as chain. */
const lookMaterial = (t, m) =>
  groupOfTemplate(t) === 'Armor' && m === ARMOR_MATERIAL.Chain2 ? ARMOR_MATERIAL.Chain : m;
/** The style a piece draws: SetVariant's material clamp (systems/armorMaterials.js clampArmorVariant) inside the
 *  template's count, 0 where it has none - so two pieces drawn alike are one look. */
export function lookVariant(t, m, v) {
  const n = LOOK_VARIANTS[/** @type {keyof typeof LOOK_VARIANTS} */ (t)] ?? 0;
  if (!n) return 0;
  return Math.max(0, Math.min(n - 1, clampArmorVariant(t, m, Number.isInteger(v) ? v : 0)));
}
/** AUDIT HORIZONTAL E3: a style the clamp draws and no mint makes - chain boots' second. A shop rolls a pair of boots'
 *  style for plate alone (systems/shopStock.js randomizeArmorVariant, DFU's RandomizeArmorVariant) and loot, a corpse and
 *  the smith roll none, so no character could ever hold it. */
const neverMinted = (/** @type {number} */ t, /** @type {number} */ m, /** @type {number} */ v) =>
  t === 108 && lookMaterial(t, m) === ARMOR_MATERIAL.Chain && v !== 1;
/** Every style a template draws in one material and a mint makes, in order. */
export const lookVariants = (t, m) =>
  [
    ...new Set(
      Array.from({ length: Math.max(1, LOOK_VARIANTS[/** @type {keyof typeof LOOK_VARIANTS} */ (t)] ?? 0) }, (_, v) =>
        lookVariant(t, m, v),
      ),
    ),
  ].filter((v) => !neverMinted(t, m, v));

/** A look's key: `t.m.v`. */
export const lookCode = (/** @type {{ t: number, m: number, v: number }} */ a) => `${a.t}.${a.m}.${a.v}`;
/** EVERY LOOK there is, in LOOK_KIND_ORDER, each template's materials in order and each material's styles. */
export const ALL_LOOKS = Object.freeze(
  LOOK_KIND_ORDER.flatMap((kind) =>
    LOOK_TEMPLATES.filter((t) => APPEARANCE_KINDS[t] === kind).flatMap((t) =>
      (groupOfTemplate(t) === 'Armor' ? ARMOR_LOOK_MATERIALS : WEAPON_LOOK_MATERIALS).flatMap((m) =>
        lookVariants(t, m).map((v) => Object.freeze({ t, m, v, kind })),
      ),
    ),
  ),
);
const LOOK_BY_KEY = new Map(ALL_LOOKS.map((a) => [lookCode(a), a]));
/** The look of a key, or null for a key that names none. */
export const lookOfKey = (/** @type {unknown} */ key) =>
  typeof key === 'string' ? (LOOK_BY_KEY.get(key) ?? null) : null;
/** Whether `{ t, m, v }` is a look there is, exactly as written. */
export const isLook = (/** @type {any} */ a) =>
  !!a && Number.isInteger(a.t) && Number.isInteger(a.m) && Number.isInteger(a.v) && LOOK_BY_KEY.has(lookCode(a));

/** THE LOOK A PIECE IS, as a character collects it - or null: no look template, a material no look is of, or a piece
 *  that draws its own art (an artifact's record, a Gilded piece's gold), which no other piece can take. */
export function lookOfPiece(item) {
  if (
    !item ||
    typeof item !== 'object' ||
    !LOOK_TEMPLATES.includes(item.templateIndex) ||
    groupOfTemplate(item.templateIndex) !== item.group
  )
    return null;
  if (item.artifact === true || item.rarity === 'gilded') return null;
  const t = item.templateIndex,
    m = lookMaterial(t, item.material ?? 0);
  const a = { t, m, v: lookVariant(t, m, item.variant ?? 0) };
  return LOOK_BY_KEY.get(lookCode(a)) ?? null;
}

/** The look a piece wears over its own - its `appearance` (`{ t, m, v }`), or a look item's `ap` off the wire
 *  (`[t, m, v]`) - when it is a look there is and of the piece's kind, else null. */
export function appearanceOf(item) {
  if (!item || typeof item !== 'object') return null;
  const raw = item.appearance ?? (Array.isArray(item.ap) ? { t: item.ap[0], m: item.ap[1], v: item.ap[2] } : null);
  if (!isLook(raw)) return null;
  const look = /** @type {{ t: number, m: number, v: number, kind: string }} */ (LOOK_BY_KEY.get(lookCode(raw)));
  const kind = pieceKind(item);
  return kind && kind === look.kind ? look : null;
}
/** The item field's shape (systems/item/itemFields.js): exactly `{ t, m, v }`, a look there is. */
export const validAppearanceField = (/** @type {any} */ a) =>
  !!a && Object.keys(a).every((k) => k === 't' || k === 'm' || k === 'v') && isLook(a);
/** A look item's `ap` as the relay keeps it (net/wire.js validLookItem): `[t, m, v]` of the item's kind, or null. */
export const validWireAppearance = (/** @type {any} */ item, /** @type {unknown} */ ap) => {
  if (!Array.isArray(ap) || ap.length !== 3) return null;
  const a = appearanceOf({ templateIndex: item?.templateIndex, group: item?.group, ap });
  return a ? [a.t, a.m, a.v] : null;
};

/** The fields a drawn piece takes from its look, and those it drops: its dye follows the look's material, and the
 *  art of its own (an artifact's record, a Gilded piece's gold) is not the look's. */
const DRAWN_DROPS = Object.freeze([
  'appearance',
  'ap',
  'dyeColor',
  'artifact',
  'playerTextureArchive',
  'playerTextureRecord',
  'gilded',
]);
/** What a drawing reads that may change on a worn piece; the memo is rebuilt when one does. */
const DRAWN_WATCH = Object.freeze([
  'templateIndex',
  'group',
  'material',
  'variant',
  'equipSlot',
  'rarity',
  'artifact',
  'enchantments',
  'customEnchantments',
  'glow',
]);
/** @type {WeakMap<object, { look: any, src: any[], drawn: any }>} */
const _drawn = new WeakMap();
/** APPEARANCES-II: every copy drawnPiece made - a piece drawn in a look. @type {WeakSet<object>} */
const _copies = new WeakSet();
/**
 * THE PIECE AS IT IS DRAWN: the piece itself, or - wearing a look - a copy of it in the look's template, material and
 * style. ONE copy a piece and look, kept while nothing it read changes: renderers compare a held weapon by identity
 * (combat/weapon/weaponWidget.js), so a new copy every frame would reset a swing. Never handed to a number.
 */
export function drawnPiece(item) {
  const look = appearanceOf(item);
  if (!look) return item;
  const memo = _drawn.get(item);
  if (memo && memo.look === look && sameWatch(memo.src, item)) return memo.drawn;
  const drawn = { ...item, templateIndex: look.t, material: look.m, variant: look.v };
  for (const k of DRAWN_DROPS) delete drawn[k];
  if (drawn.rarity === 'gilded') delete drawn.rarity;
  _drawn.set(item, { look, src: DRAWN_WATCH.map((k) => item[k]), drawn });
  _copies.add(drawn);
  return drawn;
}
/** APPEARANCES-II: whether an item is a piece drawn in a look (drawnPiece's copy). A look is never an artifact (lookOfPiece),
 *  so art chosen off the copy is the look's, though it keeps the piece's enchantments for its glow - Diverse Weapons'
 *  per-template sheet (combat/diverseWeapons/diverseWeapons.js) reads this. */
export const isLookCopy = (/** @type {unknown} */ item) => !!item && typeof item === 'object' && _copies.has(item);
function sameWatch(src, item) {
  for (let i = 0; i < DRAWN_WATCH.length; i++) if (src[i] !== item[DRAWN_WATCH[i]]) return false;
  return true;
}
/** A worn piece's look as a key for a cache, '' for its own: a drawing that caches by the piece learns of a change. */
export const appearanceSig = (item) => {
  const a = appearanceOf(item);
  return a ? lookCode(a) : '';
};
