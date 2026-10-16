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
// NOT ON THE WIRE YET, AND WHAT PASS 2 MUST PUT THERE. Nothing in this module is carried by a word or a park record:
// no field, no RELAY_VERSION, no PARK_WAGON_* bound. The art and the law are here first so that what rides later is a
// number and not a picture. Pass 2 has to:
//  - pack the four wood digits as `ww`, floor + 6*inner + 36*beam + 216*bench - the same base-LOOK_COUNT ladder `wl`
//    uses, so its bound is the same LOOK_COUNT ** 4 - 1 = 1295 - and the wheel digit as `wr` (0..LOOK_COUNT - 1);
//  - carry both on the hv word and on a parked team's record (net/wire.js validParkData), which is a RELAY_VERSION bump
//    and a PARK_WAGON_TIMBER_MAX / PARK_WAGON_WHEEL_MAX beside PARK_WAGON_LOOK_MAX;
//  - call the pool's own door for each list (world/wagonArt.js wagonLookSources and LOOK_RECORDS already answer for
//    `timberFloor`, `timberInner`, `timberBeam`, `timberBench` and `wheels`, so the art needs nothing);
//  - and build the selectors on the Stable card, beside outsidePaintRow.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS2, WAGON-TIMBER).
import { isWagonItem } from './wagonKinds.js';
import { wagonLookOf, isBuiltLook, LOOK_COUNT } from './wagonLooks.js';

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
 * The driven wagon's timber as the Stable card will list it (pass 2 builds the selectors; this is the data they read):
 * a row a part - its name, its choices' names, the one worn - five rows, the wheels among them and last. Null with no
 * wagon. The same shape wagonLooks.js horseLookRows-style rows have, so one row renderer can take both.
 * @param {any[]} items
 */
export function timberRows(items) {
  if (!Array.isArray(items)) return null;
  const item = items.find(isWagonItem);
  if (!item) return null;
  const t = wagonTimberOf(item);
  return TIMBER_FIELDS.map((part) => ({ part, name: TIMBER_PART_NAMES[part], choices: looksOf(part).map((k) => TIMBER_LOOK_NAMES[k]), current: t[part] }));
}