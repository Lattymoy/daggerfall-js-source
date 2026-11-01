// @ts-check
// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): A CHARACTER'S LOOKS AND THE WARDROBE'S ACTS. Every look the
// character holds is remembered on it (`entity.appearances`, keys of net/appearanceLaw.js, in the save); at a Clothing
// Store, an Armorer or a Weaponsmith a worn piece takes any collected look of its kind for gold, or its own back for
// nothing. The look is the piece's `appearance` field - the wearer's mark, stripped when the piece changes hands
// (net/realm/realmTradeLaw.js RECEIVER_MARKS). Cosmetic: the client's word is enough, and nothing rides the service.
import {
  ALL_LOOKS,
  LOOK_KIND_ORDER,
  lookCode,
  lookOfKey,
  lookOfPiece,
  appearanceOf,
  pieceKind,
  lookVariants,
  groupOfTemplate,
} from '../net/appearanceLaw.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { itemBaseValue } from './item/itemTemplates.js';
import { lookNameParts } from './item/itemInfo.js';
import { equipTableOf, EQUIP_SLOTS } from './equip.js';
import { totalGoldAmount, deductGold } from './court.js';
import { t } from './textManager.js';

/** The shops that keep a wardrobe: the tailor and the two smiths (DFU's own Clothing Store, Armorer, Weaponsmith). */
export const WARDROBE_SHOPS = Object.freeze(
  /** @type {number[]} */ ([BUILDING_TYPES.ClothingStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith]),
);
export const isWardrobeShop = (/** @type {unknown} */ buildingType) =>
  WARDROBE_SHOPS.includes(/** @type {number} */ (buildingType));

/** THE FEE: a twentieth of what a piece of the look is minted at (systems/item/itemTemplates.js itemBaseValue), never
 *  under WARDROBE_FEE_MIN - an iron look is cheap, a Daedric one dear. Its own look back costs nothing. */
export const WARDROBE_FEE_SHARE = 20;
export const WARDROBE_FEE_MIN = 25;
/** A look's stand-in piece: what a renderer or a namer is handed for it. */
export const lookStub = (/** @type {{ t: number, m: number, v: number }} */ look) => ({
  group: groupOfTemplate(look.t),
  templateIndex: look.t,
  material: look.m,
  variant: look.v,
});
export const wardrobeFee = (/** @type {{ t: number, m: number, v: number }} */ look) =>
  Math.max(WARDROBE_FEE_MIN, Math.round(itemBaseValue(lookStub(look)) / WARDROBE_FEE_SHARE));

// ── THE COLLECTION ──────────────────────────────────────────────────

/** @type {WeakMap<object, { arr: any, set: Set<string> }>} */
const _sets = new WeakMap();
/** The looks a character holds, as a Set of keys - read from its save's list, every key there is a look there is. */
export function appearancesOf(entity) {
  if (!entity || typeof entity !== 'object') return new Set();
  const arr = entity.appearances;
  const memo = _sets.get(entity);
  if (memo && memo.arr === arr) return memo.set;
  const set = new Set(Array.isArray(arr) ? arr.filter((k) => lookOfKey(k)) : []);
  _sets.set(entity, { arr, set });
  return set;
}
/** Whether the character holds a look. */
export const holdsLook = (entity, /** @type {{ t: number, m: number, v: number }} */ look) =>
  !!look && appearancesOf(entity).has(lookCode(look));

/** What a piece last read as - so a frame's sweep reads each record once until it changes. @type {WeakMap<object, string>} */
const _read = new WeakMap();
const readSig = (/** @type {any} */ it) =>
  `${it.group}|${it.templateIndex}|${it.material}|${it.variant}|${it.artifact}|${it.rarity}`;
/**
 * THE SWEEP: every armour piece, shield and weapon in the character's pack, wagon and Materials Bag adds its look -
 * once a frame from the HUD's one call (ui/hud/hud.js drawHud, which every host makes), and when the Wardrobe opens.
 * The list is replaced, never pushed to (a save's copy may share it), and kept in the catalogue's order.
 * @returns {number} the looks added
 */
export function noteHeldLooks(entity) {
  if (!entity || typeof entity !== 'object') return 0;
  /** @type {string[]} */
  const fresh = [];
  for (const list of [entity.items, entity.wagonItems, entity.bagItems]) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      if (!it || typeof it !== 'object' || (it.group !== 'Armor' && it.group !== 'Weapons')) continue;
      const sig = readSig(it);
      if (_read.get(it) === sig) continue;
      _read.set(it, sig);
      const look = lookOfPiece(it);
      if (look) fresh.push(lookCode(look));
    }
  }
  if (!fresh.length) return 0;
  const have = appearancesOf(entity);
  const add = fresh.filter((k) => !have.has(k));
  if (!add.length) return 0;
  const all = new Set([...have, ...add]);
  entity.appearances = ALL_LOOKS.map(lookCode).filter((k) => all.has(k));
  return new Set(add).size;
}

/** A kind's looks: `{ kind, held, total, looks }`, the looks in the catalogue's order, each `{ look, held }`. */
export function lookGroups(entity) {
  const have = appearancesOf(entity);
  return LOOK_KIND_ORDER.map((kind) => {
    const looks = ALL_LOOKS.filter((a) => a.kind === kind).map((look) => ({ look, held: have.has(lookCode(look)) }));
    return { kind, held: looks.filter((l) => l.held).length, total: looks.length, looks };
  });
}
/** `{ held, total }` over every look. */
export const looksCount = (entity) => ({ held: [...appearancesOf(entity)].length, total: ALL_LOOKS.length });

// ── THE WORDS ───────────────────────────────────────────────────────

/** A kind's name, as a page heads its group. */
export function kindName(/** @type {string} */ kind) {
  switch (kind) {
    case 'head':
      return t('looks.kind.head', 'Head');
    case 'rightArm':
      return t('looks.kind.rightArm', 'Right arm');
    case 'leftArm':
      return t('looks.kind.leftArm', 'Left arm');
    case 'chest':
      return t('looks.kind.chest', 'Chest');
    case 'hands':
      return t('looks.kind.hands', 'Hands');
    case 'legs':
      return t('looks.kind.legs', 'Legs');
    case 'feet':
      return t('looks.kind.feet', 'Feet');
    case 'shield':
      return t('looks.kind.shield', 'Shields');
    case 'dagger':
      return t('looks.kind.dagger', 'Daggers');
    case 'shortBlade':
      return t('looks.kind.shortBlade', 'Short blades');
    case 'longBlade':
      return t('looks.kind.longBlade', 'Long blades');
    case 'greatBlade':
      return t('looks.kind.greatBlade', 'Two-handed blades');
    case 'axe':
      return t('looks.kind.axe', 'One-handed axes');
    case 'greatAxe':
      return t('looks.kind.greatAxe', 'Two-handed axes');
    case 'mace':
      return t('looks.kind.mace', 'Maces');
    case 'flail':
      return t('looks.kind.flail', 'Flails');
    case 'warhammer':
      return t('looks.kind.warhammer', 'Warhammers');
    case 'staff':
      return t('looks.kind.staff', 'Staves');
    case 'bow':
      return t('looks.kind.bow', 'Bows');
    default:
      return kind;
  }
}
/** A look's style among its material's, 1-based, or 0 where the material draws one style only. */
export function lookStyle(/** @type {{ t: number, m: number, v: number }} */ look) {
  const vs = lookVariants(look.t, look.m);
  return vs.length > 1 ? vs.indexOf(look.v) + 1 : 0;
}
/** A look's name: "Steel Cuirass", "Iron Helm, style 3" - its metal always said (past DFU's helm and shield gate). */
export function lookName(/** @type {{ t: number, m: number, v: number }} */ look) {
  const { material, name } = lookNameParts(lookStub(look));
  const whole = material ? t('looks.name', '{material} {name}', { material, name }) : name;
  const style = lookStyle(look);
  return style ? t('looks.styled', '{name}, style {n}', { name: whole, n: style }) : whole;
}

/** What a worn piece looks like, said - "Looks like Ebony Katana" - or '' in its own: the Wardrobe's list and the pack's
 *  Info box say it, so a piece whose picture is its own is never a surprise on the body. */
export function lookLine(item) {
  const a = appearanceOf(item);
  return a ? t('wardrobe.wearing', 'Looks like {name}', { name: lookName(a) }) : '';
}

// ── THE WARDROBE ────────────────────────────────────────────────────

/** The worn pieces a look can be laid over, head to foot then the hands: `{ slot, item, kind }`. */
export function wardrobePieces(entity) {
  let table = [];
  try {
    table = equipTableOf(entity) ?? [];
  } catch {
    table = [];
  }
  const out = [];
  for (const [slot, item] of table.entries()) {
    const kind = item ? pieceKind(item) : null;
    if (kind && LOOK_KIND_ORDER.includes(kind)) out.push({ slot, item, kind }); // AUDIT HORIZONTAL E5: a kind no look is of (a Light Flail's) offers none
  }
  return out.sort((a, b) => LOOK_KIND_ORDER.indexOf(a.kind) - LOOK_KIND_ORDER.indexOf(b.kind) || a.slot - b.slot);
}
/** The looks a piece can take: every collected look of its kind but its own. */
export function looksForPiece(entity, item) {
  const kind = pieceKind(item);
  if (!kind) return [];
  const own = lookOfPiece(item);
  const have = appearancesOf(entity);
  return ALL_LOOKS.filter((a) => a.kind === kind && a !== own && have.has(lookCode(a)));
}
/** Whether a piece is worn by the character now. */
const isWorn = (entity, item) => {
  try {
    return (equipTableOf(entity) ?? []).includes(item);
  } catch {
    return false;
  }
};

/** Why a look cannot be laid over a piece now, by its word - or null. */
export function wearRefusal(entity, item, look) {
  const a = look ? lookOfKey(lookCode(look)) : null;
  if (!a) return 'look';
  if (!isWorn(entity, item)) return 'worn';
  if (pieceKind(item) !== a.kind) return 'kind';
  if (lookOfPiece(item) === a) return 'own';
  if (!holdsLook(entity, a)) return 'uncollected';
  if (appearanceOf(item) === a) return 'same';
  if (totalGoldAmount(entity) < wardrobeFee(a)) return 'gold';
  return null;
}
/** LAY A LOOK OVER A WORN PIECE: its fee paid, the look worn. `{ ok, reason, fee }` - refused in a word, nothing taken. */
export function wearAppearance(entity, item, look) {
  const reason = wearRefusal(entity, item, look);
  if (reason) return { ok: false, reason, fee: 0 };
  const a = /** @type {{ t: number, m: number, v: number }} */ (lookOfKey(lookCode(look)));
  const fee = wardrobeFee(a);
  deductGold(entity, fee);
  item.appearance = { t: a.t, m: a.m, v: a.v };
  return { ok: true, reason: null, fee };
}
/**
 * APPEARANCES-II: THE PREVIEW'S WEARER - the character as it would look with `look` over a worn piece (its own look for
 * null), before Wear is paid. A stand-in that reads as the character in everything but its equip table, whose slot holds
 * a copy of the piece wearing the look; every renderer draws the copy through net/appearanceLaw.js drawnPiece. Neither the
 * piece nor the character is touched, and nothing but a drawing reads it (ui/wardrobe/wardrobePreview.js).
 */
export function previewWearer(entity, item, look) {
  let table = [];
  try {
    table = equipTableOf(entity) ?? [];
  } catch {
    table = [];
  }
  const slots = table.map((it) => (it && it === item ? previewPiece(item, look) : it));
  return Object.create(entity, { equip: { value: { slots }, enumerable: true } });
}
function previewPiece(item, look) {
  const { appearance, ...own } = item;
  void appearance;
  return look ? { ...own, appearance: { t: look.t, m: look.m, v: look.v } } : own;
}
/** A WORN PIECE'S OWN LOOK BACK, for nothing. `{ ok, reason }`. */
export function clearAppearance(entity, item) {
  if (!isWorn(entity, item)) return { ok: false, reason: 'worn' };
  if (!item.appearance) return { ok: false, reason: 'none' };
  delete item.appearance;
  return { ok: true, reason: null };
}
/** The slot a piece is worn in, as a page names it (systems/equip.js EQUIP_SLOTS) - an armour slot its kind's word. */
export function slotName(/** @type {number} */ slot) {
  const S = EQUIP_SLOTS;
  switch (slot) {
    case S.Head:
      return kindName('head');
    case S.RightArm:
      return kindName('rightArm');
    case S.LeftArm:
      return kindName('leftArm');
    case S.ChestArmor:
      return kindName('chest');
    case S.Gloves:
      return kindName('hands');
    case S.LegsArmor:
      return kindName('legs');
    case S.Feet:
      return kindName('feet');
    case S.RightHand:
      return t('looks.slot.rightHand', 'Right hand');
    case S.LeftHand:
      return t('looks.slot.leftHand', 'Left hand');
    default:
      return '';
  }
}
