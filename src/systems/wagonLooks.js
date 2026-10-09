// @ts-check
// WAGONS2 (2026-10-09, Mac: "5. Exterior and interior texture customization of the wagons"; asked, "Free, any time" -
// the outside picked on the Stable card, the caravan's inside in the decorator's paint tab, as the online homes' paint
// already is, and seen by other players): THE WAGONS' PAINT - THE LAW.
//
// A wagon's paint is its own, so it rides the wagon item (systems/wagonKinds.js - a template-93 item, its `wagonKind`
// beside it): `wagonLook` is `{ o, w, f, c }`, each an index into a list below - `o` the outside paint (every kind), and
// the caravan's inside: `w` its walls, `f` its floor, `c` its ceiling. Absent, or any index the law does not know, is the
// first of its list - the wagon as it was built (WAGONS1's pictures). A save carries the field as it carries any item
// field; a sold wagon takes its paint with it. Changing it costs nothing (Mac's answer) and is the owner's alone.
//
// On the wire the four indices are one number, `wl` (systems/horseCartWire.js, and a parked team's record in
// net/wire.js validParkData): o + 6w + 36f + 216c, each digit below LOOK_COUNT - so another player's client paints the
// same wagon from it (world/wagonArt.js wagonLookArt), and a visitor in a caravan sees its owner's inside.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS2).
import { validWagonKind, isWagonItem, activeWagonItem, wagonKindOf } from './wagonKinds.js';

/** How many choices each list holds (the wire's digit). */
export const LOOK_COUNT = 6;

/** Each kind's outside paints, the first the wagon as built: the cart's boards stained, the open wagon's tilt dyed,
 *  the caravan's body painted (its trim and gilt kept). */
export const WAGON_OUTSIDE_LOOKS = Object.freeze({
  cart: Object.freeze(['oak', 'red', 'blue', 'green', 'black', 'white']),
  openWagon: Object.freeze(['cream', 'red', 'blue', 'green', 'ochre', 'black']),
  caravan: Object.freeze(['green', 'oxblood', 'blue', 'ochre', 'black', 'white']),
});
/** The caravan's inside: its walls, its floor and its ceiling, each the first as built. */
export const CARAVAN_INSIDE_LOOKS = Object.freeze({
  walls: Object.freeze(['green', 'oak', 'whitewash', 'blue', 'oxblood', 'ochre']),
  floor: Object.freeze(['pine', 'oak', 'dark', 'redRug', 'blueRug', 'checker']),
  ceiling: Object.freeze(['boards', 'whitewash', 'night', 'green', 'oak', 'ochre']),
});
/** The inside's parts, in the order the paint tab lists them and the item keeps them (`w`, `f`, `c`). */
export const CARAVAN_INSIDE_PARTS = Object.freeze(['walls', 'floor', 'ceiling']);
const PART_FIELD = Object.freeze({ walls: 'w', floor: 'f', ceiling: 'c' });

/** What each paint is called on the card and in the tab. */
export const LOOK_NAMES = Object.freeze({
  oak: 'Weathered oak', red: 'Red', blue: 'Blue', green: 'Green', black: 'Black', white: 'White', cream: 'Cream canvas',
  ochre: 'Ochre', oxblood: 'Oxblood', whitewash: 'Whitewash', pine: 'Pine boards', dark: 'Dark boards',
  redRug: 'Red rug', blueRug: 'Blue rug', checker: 'Checkered tiles', boards: 'Painted boards', night: 'Night sky',
});
/** The words the card and the tab say. */
export const LOOK_TEXT = Object.freeze({
  paint: 'Paint',
  outside: 'Outside',
  walls: 'Walls', floor: 'Floor', ceiling: 'Ceiling',
  painted: (name) => `Your wagon is painted ${name.toLowerCase()}.`,
  paintedInside: (part, name) => `The ${part} are now ${name.toLowerCase()}.`,
  noWagon: 'You have no wagon to paint.',
  notCaravan: 'Only a caravan has an inside to paint.',
});

const index = (v) => (Number.isInteger(v) && v >= 0 && v < LOOK_COUNT ? v : 0);

/** A look, checked: every index the law knows, else 0 (the wagon as built). */
export function readWagonLook(v) {
  const o = v && typeof v === 'object' ? v : {};
  return { o: index(o.o), w: index(o.w), f: index(o.f), c: index(o.c) };
}
/** A wagon item's look (its `wagonLook`, checked) - the wagon as built for anything else. */
export const wagonLookOf = (item) => readWagonLook(isWagonItem(item) ? item.wagonLook : null);
/** Whether a look is the wagon as built (no field needs keeping). */
export const isBuiltLook = (look) => { const l = readWagonLook(look); return !l.o && !l.w && !l.f && !l.c; };

/** The look as the wire says it: one number, base LOOK_COUNT (`wl`). */
export const wagonLookCode = (look) => { const l = readWagonLook(look); return l.o + LOOK_COUNT * (l.w + LOOK_COUNT * (l.f + LOOK_COUNT * l.c)); };
/** The highest code a look can be. */
export const WAGON_LOOK_CODE_MAX = LOOK_COUNT ** 4 - 1;
/** The look a wire code names - the wagon as built for anything the law does not know. */
export function wagonLookOfCode(code) {
  if (!Number.isInteger(code) || code < 0 || code > WAGON_LOOK_CODE_MAX) return readWagonLook(null);
  return readWagonLook({ o: code % LOOK_COUNT, w: Math.floor(code / LOOK_COUNT) % LOOK_COUNT, f: Math.floor(code / LOOK_COUNT ** 2) % LOOK_COUNT, c: Math.floor(code / LOOK_COUNT ** 3) });
}

/** A kind's outside paints (the cart's for a kind the law does not know). */
export const outsideLooksOf = (kind) => WAGON_OUTSIDE_LOOKS[validWagonKind(kind) ?? 'cart'];
/** The name of a kind's outside paint `o`. */
export const outsideLookName = (kind, o) => LOOK_NAMES[outsideLooksOf(kind)[index(o)]];
/** The name of the caravan inside part's paint `i`. */
export const insideLookName = (part, i) => LOOK_NAMES[CARAVAN_INSIDE_LOOKS[part]?.[index(i)] ?? 'green'];

/**
 * The item a paint makes: `item` with its look's `part` ('outside', or one of CARAVAN_INSIDE_PARTS) set to `i` - a new
 * object, the old one untouched; the field dropped when the look is the wagon as built. Null when the item is not a
 * wagon, or an inside part is asked of anything but a caravan.
 */
export function paintedWagon(item, part, i) {
  if (!isWagonItem(item)) return null;
  const field = part === 'outside' ? 'o' : PART_FIELD[part];
  if (!field) return null;
  if (field !== 'o' && validWagonKind(item.wagonKind) !== 'caravan') return null;
  const look = { ...wagonLookOf(item), [field]: index(i) };
  const { wagonLook: _drop, ...rest } = item;
  return isBuiltLook(look) ? rest : { ...rest, wagonLook: look };
}

/**
 * THE DRIVEN WAGON PAINTED: in the pack `items` (the host's own list - the wagon's place in it taken by its painted
 * self), the wagon a player drives (systems/wagonKinds.js activeWagonItem) given choice `i` of `part` ('outside', or one
 * of the caravan's inside parts). `{ ok, text }` - what the Stable or the decorator says.
 */
export function paintDrivenWagon(items, part, i) {
  const item = activeWagonItem(items);
  if (!item || !Array.isArray(items)) return { ok: false, text: LOOK_TEXT.noWagon };
  const kind = wagonKindOf(item);
  if (part !== 'outside' && kind !== 'caravan') return { ok: false, text: LOOK_TEXT.notCaravan };
  const painted = paintedWagon(item, part, i);
  if (!painted) return { ok: false, text: LOOK_TEXT.noWagon };
  items[items.indexOf(item)] = painted;
  const look = wagonLookOf(painted);
  return part === 'outside'
    ? { ok: true, text: LOOK_TEXT.painted(outsideLookName(kind, look.o)) }
    : { ok: true, text: LOOK_TEXT.paintedInside(LOOK_TEXT[part].toLowerCase(), insideLookName(part, look[PART_FIELD[part]])) };
}
/** The caravan's inside as the decorator's painter lists it: a row a part - its name, its paints' names, its paint now. */
export const caravanPaintRows = (look) => {
  const l = readWagonLook(look);
  return CARAVAN_INSIDE_PARTS.map((part) => ({ part, name: LOOK_TEXT[part], choices: CARAVAN_INSIDE_LOOKS[part].map((k) => LOOK_NAMES[k]), current: l[PART_FIELD[part]] }));
};
/** The driven wagon's outside as the Stable lists it: its paints' names and its paint now (null with no wagon). */
export const outsidePaintRow = (items) => {
  const item = activeWagonItem(items);
  if (!item) return null;
  return { choices: outsideLooksOf(wagonKindOf(item)).map((k) => LOOK_NAMES[k]), current: wagonLookOf(item).o };
};
