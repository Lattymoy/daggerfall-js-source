// @ts-check
// WAGON-TIMBER (2026-10-16, Mac, of the wagon's wood and of its wheels: "Ok so there is a separation of all the wooden
// parts which is cool. Lets make a selector for each of them and send them over the wire using the same system that
// already exists"; "I want the wheel options to be separate from the wood options"; "Add a few more options for the wheels
// as well which I know are editable via hex color codes so come up with a few discrete options: couple different browns,
// a reddish one and a grey one if possible"): THE WAGON'S TIMBER AND ITS WHEELS - THE LAW.
//
// A wagon is mostly wood, and the port's wagon wore all of it as Daggerfall has it: one record per wooden part, one
// appearance for the wheels, no choice anywhere. This is the choice, and it is the SAME SYSTEM the paint already is -
// systems/wagonLooks.js LOOK_COUNT, its index-into-a-list shape, its "absent is the first" rule, its save field. The
// only thing new here is WHICH parts and WHICH wheels.
//
// THE SHAPE, AND WHAT IT IS NOT. The item keeps ONE `wagonLook` and it now has nine fields:
//
//   wagonLook: {
//     o, w, f, c        - the PAINT (wagonLooks.js: the outside, and the caravan's walls, floor and ceiling),
//     floor, inner,     - this module: each wooden part's dye, and the wheels' finish, each absent for the first
//       beam, bench,      of its list, the wagon as it was built;
//     wheels
//   }
//
// The four wooden parts are the four fixed records of world/wagonArt.js TEX - `floor` (0), `inner` (2), `beam` (3) and
// `bench` (4) - and they are names, not new geometry: the parts already had those names in the paint of a caravan's own
// floor, and the wood is the wagon's own boards, so a part named `floor` here is the wooden bed, not a paint. Each is
// its own selector with its own index, which is what "a selector for each of them" asks for and why they are four
// fields and not one.
//
// THE WHEELS ARE THEIR OWN FIELD, NOT A FIFTH PART. Mac's words: "I want the wheel options to be separate from the wood
// options". So the wheels answer to `wheels`, they are chosen out of WHEEL_LOOKS and not out of TIMBER_LOOKS, they dye
// no wooden part and no wooden part dyes them, and they are drawn by world/wagonWheelArt.js's own finish table rather
// than by the wood's dye - TWO TABLES, and a name that stands in both lists is the same wood in both and nothing else.
// A player can have an ebony bed on a wagon whose wheels are silvered, and nothing in this law has an opinion.
//
// THE DYE, AND WHY IT IS NOT A HEX CODE. A dye is hue/saturation/value the horse coat's own arithmetic already owns
// (systems/horseCoats.js COAT_DYES and dyeInto; world/wagonArt.js WOOD_DYES, and classicArt.js dyedPicture runs it over
// the record as it is read). That is the whole reason the wagon's wood is dyed and not filled: a hue shift over a
// Daggerfall record leaves the GRAIN standing - the plank's own light and shadow, its knots - where a flat fill would
// take it away and leave a coloured plane where a wagon was. The operator's "editable via hex color codes" is what the
// colours ARE; what they are used for is a shift, not a stamp.
//
// PASS 2 - ON THE WIRE, AND WHERE IT STANDS. The art and the law landed first so that what rides is a number and not a
// picture; this is the riding. `ww`, the four wood digits as `floor + 6*inner + 36*beam + 216*bench` - the SAME
// base-LOOK_COUNT ladder `wl` uses, so its bound is the same LOOK_COUNT ** 4 - 1 = 1295 and no second ladder exists -
// and `wr`, the wheel's digit, 0..LOOK_COUNT - 1. Both ride the hv word (systems/horseCartWire.js hccWireRecord /
// validHccRecord / hccRecordKey) AND a parked team's record (net/wire.js validParkData: PARK_WAGON_TIMBER_MAX and
// PARK_WAGON_WHEEL_MAX beside PARK_WAGON_LOOK_MAX), which is RELAY_VERSION world207 and the house deploy order - the
// relay BEFORE the account service, or a token signing either word is refused whole.
//
// THE PACKING IS NOT A WIDENING. `wl` keeps its six-base packing and PARK_WAGON_LOOK_MAX stays 1295, LOOK_COUNT stays
// six, and no list grows: two more NUMBERS beside the paint's one, because the digit is one width for every list a
// wagon already carries. The five lists go through the pool's own door (world/wagonArt.js wagonLookSources and
// LOOK_RECORDS already answer for `timberFloor`, `timberInner`, `timberBeam`, `timberBench` and `wheels`, so the art
// needed nothing), and the selectors stand on the Stable card beside the paint's.
//
// AND THE NINE-KEY READER IS HERE, IN THIS MODULE, NOT IN THE PAINT'S. `wagonLook` is ONE field and it now has nine
// keys, so something has to read all nine at once - the wire's own unpack, the pool's remap, the card. The obvious home
// is wagonLooks.js and the one place it must NOT go: that law already promised never to import this module ("nothing
// here imports systems/wagonTimber.js to get at the timber"), and that promise is what keeps dyeing the beams from
// welding the paint to the wood. This module already imports the paint's - LOOK_COUNT is TAKEN from it rather than
// written - so the reader is HERE, and the paint is untouched and still reads only its own four.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS2, WAGON-TIMBER).
import { isWagonItem } from './wagonKinds.js';
import { wagonLookOf, readWagonLook, wagonLookOfCode, isBuiltLook, LOOK_COUNT } from './wagonLooks.js';
import { t } from './textManager.js';   // L10N4: the card's own words, routed like every new sentence the port adds

/** How many choices each of these lists holds - the wagon paint's own LOOK_COUNT (systems/wagonLooks.js), TAKEN rather
 *  than written: the wire's digit is one width for every list a wagon carries, and two numbers here would be two widths
 *  the wire's ladder would have to know about. */
export const TIMBER_CHOICES = LOOK_COUNT;

/** THE WOODEN PARTS, in the order the selectors list them and the item keeps them (`wagonLook`'s own keys). Each is a
 *  fixed record of world/wagonArt.js TEX - the bed's boards, the inside faces, the beams and axles, the bench - and each
 *  was, until WAGON-TIMBER, one appearance for every wagon in the game. */
export const TIMBER_PARTS = Object.freeze(['floor', 'inner', 'beam', 'bench']);
/** EVERY field this law adds to the item's `wagonLook`: the four parts and the wheels. The paint's own four are
 *  wagonLooks.js's; systems/itemFields.js's save check carries both sets. */
export const TIMBER_FIELDS = Object.freeze([...TIMBER_PARTS, 'wheels']);

/** The dyes a wooden part may wear, the first the wagon as it was built (world/wagonArt.js WAGON_SOURCES' own Daggerfall
 *  wood, undyed): `pine` a pale blonde, `walnut` a dark brown, `mahogany` the red, `ebony` nearly black, `ash` the grey-
 *  blond of a wood left out in the weather. Their arithmetic is world/wagonArt.js WOOD_DYES'. */
export const TIMBER_LOOKS = Object.freeze(['oak', 'pine', 'walnut', 'mahogany', 'ebony', 'ash']);
/** The wheel finishes (the operator's "a couple different browns, a reddish one and a grey one if possible", spent: `ash`
 *  and `walnut` the two browns, `mahogany` the red, `silvered` the grey, `ebony` under it), the first the wheel as
 *  DF-ART IV painted it. Their colours are world/wagonWheelArt.js WHEEL_FINISHES' - triples, not a dye. */
export const WHEEL_LOOKS = Object.freeze(['oak', 'ash', 'walnut', 'mahogany', 'silvered', 'ebony']);

/** What each dye and each finish is called on a selector. One word each, so a player's language can route them. */
export const TIMBER_LOOK_NAMES = Object.freeze({
  oak: 'Oak', pine: 'Pine', ash: 'Ash', walnut: 'Walnut', mahogany: 'Mahogany', ebony: 'Ebony', silvered: 'Silvered',
});
/** What each part is called on a selector - the wagon's own words for its own boards. */
export const TIMBER_PART_NAMES = Object.freeze({ floor: 'Floor', inner: 'Inner', beam: 'Beams', bench: 'Bench', wheels: 'Wheels' });
/** PASS 2: each field's OWN list of choice names, the one a selector walks and the pool's `ensureLook` names a picture
 *  by - `scenes/horseCartPool.js` pairs it with world/wagonArt.js TIMBER_LISTS (which LIST a part is), and the two
 *  together are the pool's own door. The four parts share TIMBER_LOOKS and the wheels answer out of WHEEL_LOOKS. */
export const TIMBER_CHOICE_LISTS = Object.freeze({ floor: TIMBER_LOOKS, inner: TIMBER_LOOKS, beam: TIMBER_LOOKS, bench: TIMBER_LOOKS, wheels: WHEEL_LOOKS });

const index = (v) => (Number.isInteger(v) && v >= 0 && v < TIMBER_CHOICES ? v : 0);
const looksOf = (part) => (part === 'wheels' ? WHEEL_LOOKS : TIMBER_LOOKS);

/**
 * A wagon's timber, checked: `{ floor, inner, beam, bench, wheels }`, each an index into its list, each 0 for anything
 * the law does not know. `v` the item's `wagonLook` (systems/wagonLooks.js's four fields are read past, not here - this
 * is what the TIMBER is, not what the wagon is painted).
 * @param {any} v
 */
export function readWagonTimber(v) {
  const o = v && typeof v === 'object' ? v : {};
  return { floor: index(o.floor), inner: index(o.inner), beam: index(o.beam), bench: index(o.bench), wheels: index(o.wheels) };
}

/** Whether a look is a wagon as it was built, in THIS law's own five fields - the paint's four asked separately
 *  (wagonLooks.js isBuiltLook), because a wagon dyed all the way down is still a wagon as built if its paint says so. */
export function isBuiltTimber(look) {
  const t = readWagonTimber(look);
  return !TIMBER_FIELDS.some((k) => t[k]);
}

/** The timber fields an item's look ACTUALLY carries, absent ones left out - so a wagon as it was built keeps no field
 *  and a dyed one keeps only what was dyed (the same law wagonLooks.js keeps its own four by). */
export function timberFieldsOf(look) {
  const t = readWagonTimber(look), out = /** @type {Record<string, number>} */ ({});
  for (const k of TIMBER_FIELDS) if (t[k]) out[k] = t[k];
  return out;
}

/** A wagon item's timber (its five fields, checked) - every wagon as it was built, for anything that is not one. */
export const wagonTimberOf = (item) => readWagonTimber(isWagonItem(item) ? item.wagonLook : null);

/**
 * The item a choice makes: a new object, the old one untouched - the part's field set to `i`, or DROPPED for its list's
 * first (the wagon as it was built); the paint (`o`, `w`, `f`, `c`) kept whole, because dyeing the beams is not
 * un-painting the wagon; and `wagonLook` dropped only when the WHOLE look is as built, so a wagon whose timber is dyed
 * and whose paint is not still keeps its field. Null for anything that is not a wagon, or a part this law does not know.
 * @param {any} item @param {string} part @param {number} i
 */
export function timberedWagon(item, part, i) {
  if (!isWagonItem(item) || !TIMBER_FIELDS.includes(part)) return null;
  const look = { ...wagonLookOf(item), ...timberFieldsOf(item?.wagonLook) }, v = index(i);
  if (v) look[part] = v; else delete look[part];
  const { wagonLook: _drop, ...rest } = item;
  return isBuiltLook(look) && isBuiltTimber(look) ? rest : { ...rest, wagonLook: look };
}

/** The name of a part's choice `i` - the wagon's own words for it. */
export const timberChoiceName = (part, i) => TIMBER_LOOK_NAMES[looksOf(part)[index(i)]];

/**
 * The driven wagon's timber as the Stable card will list it: a row a part - its name, its choices' names, the one worn -
 * five rows, the wheels among them and last. Null with no wagon. The same shape wagonLooks.js horseLookRows-style rows
 * have, so one row renderer can take both.
 *
 * PASS 2: the card's five rows read this, and `timberedDrivenWagon` below dyes THE SAME WAGON - the first one in the
 * pack, found the same way here and there. A row that showed one wagon's timber and a press that dyed another's is
 * the card lying about itself, so the two find alike on purpose; the paint's own rows read activeWagonItem and its own
 * act does too, which is a different rule and not this law's to move.
 * @param {any[]} items
 */
export function timberRows(items) {
  if (!Array.isArray(items)) return null;
  const item = items.find(isWagonItem);
  if (!item) return null;
  const t = wagonTimberOf(item);
  return TIMBER_FIELDS.map((part) => ({ part, name: TIMBER_PART_NAMES[part], choices: looksOf(part).map((k) => TIMBER_LOOK_NAMES[k]), current: t[part] }));
}

/** PASS 2: what the card says when a part is dyed. The wagon's part, in its own words, and the choice's - and the
 *  number is read off TIMBER_PART_NAMES, where `Beams` and `Wheels` are the two many and `Floor`, `Inner` and `Bench`
 *  the three one, rather than off a second list that could drift from the first. */
export const TIMBER_TEXT = Object.freeze({
  // L10N4 (a player reads it in English whatever language they chose): through `t`, like every new sentence the port
  // adds. The PAINT's own three are still bare (wagonLooks.js LOOK_TEXT predates the ratchet and is not this law's to
  // move); the plural is not a second table but the name's own ending, so one pattern covers 'the floor is' and
  // 'the beams are' without a per-part sentence to keep in step with TIMBER_PART_NAMES.
  dyed: (part, name) => {
    const what = /** @type {string} */ (TIMBER_PART_NAMES[part] ?? part);
    const at = { part: what.toLowerCase(), name: name.toLowerCase() };
    // TWO patterns, not one with an English verb riding in an argument: a translator cannot fix \{verb\} = 'is' |
    // 'are' in a language whose verb agrees with the noun - and the part name IS the noun. The number is read off
    // TIMBER_PART_NAMES (the two many are `Beams` and `Wheels`), the same table a card shows, so there is nothing
    // to keep in step but the names themselves.
    return what.endsWith('s') ? t('wagon.timber.dyedMany', "The wagon's {part} are now {name}.", at) : t('wagon.timber.dyedOne', "The wagon's {part} is now {name}.", at);
  },
  noWagon: () => t('wagon.timber.noWagon', 'You have no wagon to dye.'),
});

/**
 * PASS 2: THE DRIVEN WAGON DYED: in the pack `items` (the host's own list - the wagon's place in it taken by its dyed
 * self), the first wagon the pack holds given choice `i` of `part` - THE ONE timberRows listed, so the row a player
 * pressed is the row they saw. `{ ok, text }` - what the Stable says. Free, any time, the mod on or off, as the paint's
 * own act is: what the wagon is made of is the wagon's business.
 * @param {any[]} items @param {string} part @param {number} i
 */
export function timberedDrivenWagon(items, part, i) {
  if (!Array.isArray(items)) return { ok: false, text: TIMBER_TEXT.noWagon() };
  const item = items.find(isWagonItem);
  if (!item || !TIMBER_FIELDS.includes(part)) return { ok: false, text: TIMBER_TEXT.noWagon };
  const dyed = timberedWagon(item, part, i);
  if (!dyed) return { ok: false, text: TIMBER_TEXT.noWagon };
  items[items.indexOf(item)] = dyed;
  return { ok: true, text: TIMBER_TEXT.dyed(part, /** @type {string} */ (timberChoiceName(part, i))) };
}

// ═══ PASS 2: THE WIRE, AND THE ONE READER THAT KNOWS ALL NINE KEYS ═══════════════════════════════════════════════════
//
// `wagonLook` is ONE save field with NINE keys, and the wire carries them as TWO numbers beside the paint's one: `ww`
// (four wood digits, the same base-TIMBER_CHOICES ladder `wl` uses - so the same 1295 bound and no second ladder to
// keep) and `wr` (the wheel's digit). These are the two halves of that, and the reader that puts all nine back.

/** PASS 2: the timber as the wire says it - one number, base TIMBER_CHOICES (`ww`): floor + 6*inner + 36*beam +
 *  216*bench, the paint's own ladder (systems/wagonLooks.js wagonLookCode) with this law's four parts in it. */
export const wagonTimberCode = (look) => { const t = readWagonTimber(look); return t.floor + TIMBER_CHOICES * (t.inner + TIMBER_CHOICES * (t.beam + TIMBER_CHOICES * t.bench)); };
/** PASS 2: the highest wood code a look can be - LOOK_COUNT ** 4 - 1, the SAME bound `wl` has, because it is the
 *  same ladder over the same width. A wagon that could choose six of four things and six of one is the same number. */
export const WAGON_TIMBER_CODE_MAX = TIMBER_CHOICES ** 4 - 1;
/** PASS 2: the wood a wire code names - every part as it was built for anything the law does not know. */
export function wagonTimberOfCode(code) {
  if (!Number.isInteger(code) || code < 0 || code > WAGON_TIMBER_CODE_MAX) return readWagonTimber(null);
  return readWagonTimber({ floor: code % TIMBER_CHOICES, inner: Math.floor(code / TIMBER_CHOICES) % TIMBER_CHOICES, beam: Math.floor(code / TIMBER_CHOICES ** 2) % TIMBER_CHOICES, bench: Math.floor(code / TIMBER_CHOICES ** 3) % TIMBER_CHOICES });
}

/** PASS 2: the wheels as the wire says it - one digit, `wr` (0..LOOK_COUNT - 1; 0 is the wheel DF-ART IV painted and
 *  is never written, so a wagon as built carries no field at all, as the paint's does not). */
export const wagonWheelCode = (look) => readWagonTimber(look).wheels;
/** PASS 2: the highest wheel digit - one choice under the width, the one number `wr` is bounded by. */
export const WAGON_WHEEL_CODE_MAX = TIMBER_CHOICES - 1;
/** PASS 2: the finish a wire digit names - the wheel DF-ART IV painted for anything the law does not know. */
export const wagonWheelOfCode = (code) => (Number.isInteger(code) && code >= 0 && code <= WAGON_WHEEL_CODE_MAX ? code : 0);

/**
 * PASS 2: THE WHOLE LOOK, NINE KEYS, from the save field as it stands - the paint's four read through
 * systems/wagonLooks.js readWagonLook and this law's five through readWagonTimber, and nothing else. What the draw and
 * the card take, and the one reader of the shape: the two laws stay apart in WHAT they read (the paint has never heard
 * of the timber, and never will) and meet only here, where both halves are already in hand.
 * @param {any} v
 */
export const readWagonLookAll = (v) => ({ ...readWagonLook(v), ...readWagonTimber(v) });

/**
 * PASS 2: the look a peer's word names, from its three numbers: `paint` the `wl` code (the four), `wood` the `ww` code
 * (the four parts), `wheel` the `wr` digit (the wheels). Nine keys, each checked by its own law, and a word that
 * carries none of them (every word before this bump) reads as the wagon as built.
 * @param {number} paint @param {number} wood @param {number} wheel
 */
export const wagonLookOfWire = (paint, wood, wheel) => ({ ...wagonLookOfCode(paint), ...wagonTimberOfCode(wood), wheels: wagonWheelOfCode(wheel) });