// @ts-check
// COATS1 (2026-10-11, a player: "can we take the current horse sprite thats used for placement, riding and even the
// character riding the horse and give the sprite different color types and colors. Like a variation of horse sprites";
// then "What about also different patterns? The goal is for every person's horse to be unique" - asked, every horse BORN
// unique and re-dyable on the Stable card, with pinto, appaloosa, dapples, socks and roan): THE HORSE'S LOOK - THE LAW.
//
// Every horse the port draws is one bay horse: Daggerfall's riding sprite (MRED00I0.CFA, the player's own data), Horse
// Cart and Cargo's standing and walking views (vendor/horse-cart-and-cargo) and Eye Of The Beholder's five riders
// (vendor/eye-of-the-beholder, archives 112382-112386, horse and rider in one picture). A look is not new art: it is the
// same pictures re-dyed as they are uploaded, by `recolorHorse` below - so no picture of the player's data is ever
// written anywhere but the renderer (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA), and a set the port gains later
// takes every look for free.
//
// A HORSE'S LOOK is four things, and it is its own, so it rides the horse item (TRANSPORT_HORSE, template 94):
//  - its COAT (`horseCoat`, HORSE_COATS - the colour), its PATTERN (`horsePattern`, HORSE_PATTERNS - the white or the
//    spots laid over it) and its LEGS (`horseLegs`, HORSE_LEGS - white socks or stockings), each absent for the first;
//  - and its SEED (`horseSeed`, 1..HORSE_SEED_MAX), which is the horse itself: where its patches, spots, dapples and
//    flecks fall, the ragged top of its socks, and a shade of its coat a touch off any other's (`shadeOf`). Two horses
//    of one coat, pattern and legs are still two horses.
// A horse is BORN with all four (`birthHorses`, rolled once, the first time a host sees it without a seed: a horse
// bought, found, or carried in from an older save), weighted to the common coats and patterns (BIRTH_WEIGHTS). Its
// owner may change the coat, the pattern and the legs on the Stable card (ui/holdingsPages.js), free and any time - the
// wagon's paint's law (systems/wagon/wagonLooks.js), for the horse - but never the seed: the markings stay where they fell.
// A save carries the fields as it carries any item field; a sold horse takes its look with it.
//
// ON THE WIRE a look is one number (`horseLookCode`: coat + 7 pattern + 35 legs + 105 seed), 0 the bay as drawn.
//
// THE DYE. The art is a bay: a warm brown hide, a black mane, tail and hooves, a brown leather saddle, and on Eye Of The
// Beholder's sets a rider of any colour astride. The dye moves the HIDE alone:
//  - a hide pixel is a warm one (hue 345-50 degrees) with some colour in it (saturation 0.2 or more) - the mane, the
//    tail, the hooves, steel and cloth are none of them;
//  - but not the TACK: the saddle and the bridle's leather are yellower, duller and darker than the hide around them
//    (hue 28-48, saturation 0.36-0.58, value 0.24-0.5 - measured off horse3.png's saddle against its flank);
//  - and only where the warm pixels are the HORSE's: a rider's face, hands and leathers are warm too, but they stand
//    apart from the hide - small islands, cut off by steel and shadow. So the warm pixels are gathered into their
//    8-connected regions and a region is dyed only when it is at least COAT_REGION_SHARE of the largest (the body; a
//    leg the shading cut from it is still a few percent of it, a face is under one) - or when it is a scrap of SHADOW
//    beside one (a belly's or a far leg's dark speckle, cut off by the outline: mean value under COAT_SHADOW_VALUE and
//    within COAT_SHADOW_REACH pixels of a dyed region). A rider's skin is lit (a mean value of 0.4 and more on all
//    five sets); their dark hair, where it is warm, stands further off the horse's back.
// A dyed pixel takes the coat's hue, a saturation off its own (so the art's shading stays its shading) and a value
// `lift + scale * v` - the art's light, re-keyed for a darker or a paler horse - nudged by the seed's shade. Then the
// pattern and the legs lay their white (and the appaloosa its spots) over it, each white the hide's own light, so a
// patch in shadow is a shadowed white. The markings are placed in the HIDE's own frame - from its left, down from its
// top, in PATTERN_SCALE_PX - so a walk frame carries them with the body; a mirrored view mirrors them, as the other
// flank. A sprite is one picture a side, so a flank's patches and the chest's are not one body's - each side is its own.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member: Daggerfall has one horse. Ledger A (COATS1).
import { TRANSPORT_HORSE } from '../item/itemTemplates.js';
import { MOUNT_LOOKS } from '../../net/effectLaw.js';   // STOREFRONT: the account's mount looks, in the kit's order
import { paintMountHide, paintMountPoint, mountAnatomy, mountFacing, lightOf, EDGE_MAX, HEART_UP } from './mountPaint.js';   // AUDIT-STOREFRONT: the looks painted

/** The coats, in the order the Stable lists them and the item keeps them (`horseCoat`); the first the bay as drawn. */
export const HORSE_COATS = Object.freeze(['bay', 'chestnut', 'black', 'grey', 'dun', 'buckskin', 'palomino']);
export const HORSE_COAT_MAX = HORSE_COATS.length - 1;
/** The patterns (`horsePattern`), the first none. */
export const HORSE_PATTERNS = Object.freeze(['solid', 'pinto', 'appaloosa', 'dapples', 'roan']);
export const HORSE_PATTERN_MAX = HORSE_PATTERNS.length - 1;
/** The legs (`horseLegs`), the first the coat's own. */
export const HORSE_LEGS = Object.freeze(['plain', 'socks', 'stockings']);
export const HORSE_LEGS_MAX = HORSE_LEGS.length - 1;
/** STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 7): THE MOUNT LOOKS (`mount`), the first none - the
 *  account's (net/effectLaw.js MOUNT_LOOKS): a fifth part laid over the other four, never the item's and never on the
 *  wire's code - the signed token carries it, and each screen lays it on locally (`withMountLook`; `wireHorseLook`
 *  takes it off a code bound for the wire). */
export const HORSE_MOUNTS = Object.freeze(['none', ...MOUNT_LOOKS]);
export const HORSE_MOUNT_MAX = HORSE_MOUNTS.length - 1;
/** The highest seed (`horseSeed`); 0 is no seed - a horse not yet born, or the art as drawn. */
export const HORSE_SEED_MAX = 65535;
/** What each is called on the Stable card. */
export const HORSE_LOOK_NAMES = Object.freeze({
  bay: 'Bay', chestnut: 'Chestnut', black: 'Black', grey: 'Grey', dun: 'Dun', buckskin: 'Buckskin', palomino: 'Palomino',
  solid: 'Solid', pinto: 'Pinto', appaloosa: 'Appaloosa', dapples: 'Dapples', roan: 'Roan',
  plain: 'Plain', socks: 'Socks', stockings: 'Stockings',
});
/** The Stable's rows, in order: the part, the item's field, its list. */
export const HORSE_LOOK_PARTS = Object.freeze([
  Object.freeze({ part: 'coat', field: 'horseCoat', list: HORSE_COATS, name: 'Coat' }),
  Object.freeze({ part: 'pattern', field: 'horsePattern', list: HORSE_PATTERNS, name: 'Pattern' }),
  Object.freeze({ part: 'legs', field: 'horseLegs', list: HORSE_LEGS, name: 'Legs' }),
]);
/** The words the card says. */
export const COAT_TEXT = Object.freeze({
  changed: (desc) => `Your horse is now a ${desc}.`,
  noHorse: 'You do not own a horse.',
});

/**
 * Each coat's dye: `hue` in degrees (null: the art's own, the bay); `sat` either `['mul', k]` (the art's own saturation
 * times k) or `['abs', s]` (s, eased by the art's own: s * min(1, own / 0.6 + 0.3), so a highlight stays paler than a
 * flank); `val` `[lift, scale]`. Tuned by eye against all three sets (a black mane and points on every coat but the
 * palomino's, whose mane the art cannot tell from the rider's steel - so it keeps the art's dark one).
 */
export const COAT_DYES = Object.freeze({
  bay: Object.freeze({ hue: null, sat: Object.freeze(['mul', 1]), val: Object.freeze([0, 1]) }),
  chestnut: Object.freeze({ hue: 13, sat: Object.freeze(['mul', 1.12]), val: Object.freeze([0.05, 1.05]) }),
  black: Object.freeze({ hue: 25, sat: Object.freeze(['abs', 0.14]), val: Object.freeze([0, 0.45]) }),
  grey: Object.freeze({ hue: 30, sat: Object.freeze(['abs', 0.05]), val: Object.freeze([0.25, 0.95]) }),
  dun: Object.freeze({ hue: 33, sat: Object.freeze(['abs', 0.36]), val: Object.freeze([0.18, 0.95]) }),
  buckskin: Object.freeze({ hue: 37, sat: Object.freeze(['abs', 0.58]), val: Object.freeze([0.14, 1.1]) }),
  palomino: Object.freeze({ hue: 40, sat: Object.freeze(['abs', 0.5]), val: Object.freeze([0.25, 1.05]) }),
});
/** A warm region is the horse's when it is at least this share of the largest one (see THE DYE). */
export const COAT_REGION_SHARE = 0.03;
/** And a smaller one is when it is SHADOW on the hide: its mean value under COAT_SHADOW_VALUE and within
 *  COAT_SHADOW_REACH pixels of a region that is the horse's (see THE DYE). */
export const COAT_SHADOW_VALUE = 0.3;
export const COAT_SHADOW_REACH = 2;
/** How far a seed turns a coat: up to SHADE_HUE degrees of hue and SHADE_VALUE of its light, either way. */
export const SHADE_HUE = 4;
export const SHADE_VALUE = 0.075;
/** The markings' measure: a pattern is laid in units of this many pixels (or the hide's width, if wider) - the side
 *  view's width - so a spot is one size from every side, though a front view is a third as wide. */
export const PATTERN_SCALE_PX = 100;
/** How high the white climbs from the hooves, as a share of the hide's height: socks, then stockings. */
export const LEG_BANDS = Object.freeze([0, 0.1, 0.2]);

/**
 * A HORSE'S BIRTH: the odds of each coat, pattern and legs (in their lists' order) a horse is born with - the bays and
 * chestnuts most, a solid coat more often than a marked one, bare legs more often than white.
 */
export const BIRTH_WEIGHTS = Object.freeze({
  coat: Object.freeze([5, 4, 2, 2, 1, 1, 1]),
  pattern: Object.freeze([6, 2, 1, 2, 1]),
  legs: Object.freeze([5, 3, 2]),
});
/** The stranger's seeds (`strangerHorseLook`): sixteen, so the road's horses share a few dyed sets between them. */
export const STRANGER_SEEDS = 16;

const index = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const pick = (weights, r) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) { if (x < weights[i]) return i; x -= weights[i]; }
  return 0;
};

/** A look, checked: `{ coat, pattern, legs, seed }`, each a value the law knows, else 0 - and STOREFRONT's `mount` with
 *  them only while one is laid over it (an item's look never carries one). */
export function readHorseLook(v) {
  const o = v && typeof v === 'object' ? v : {};
  const mount = index(o.mount, HORSE_MOUNT_MAX);
  return { coat: index(o.coat, HORSE_COAT_MAX), pattern: index(o.pattern, HORSE_PATTERN_MAX), legs: index(o.legs, HORSE_LEGS_MAX), seed: index(o.seed, HORSE_SEED_MAX), ...(mount ? { mount } : {}) };
}
const C = HORSE_COATS.length, P = HORSE_PATTERNS.length, L = HORSE_LEGS.length;
/** The codes of the item's four parts - the wire's - and STOREFRONT's mount look over them, its highest factor. */
const BASE = C * P * L * (HORSE_SEED_MAX + 1);
/** The look as one number, 0 the bay as drawn - the wire's (no mount look) under BASE. */
export const horseLookCode = (look) => { const l = readHorseLook(look); return l.coat + C * (l.pattern + P * (l.legs + L * l.seed)) + BASE * (l.mount ?? 0); };
/** The highest code the WIRE may say: the item's four parts (a mount look is the token's, never a peer's word). */
export const HORSE_LOOK_CODE_MAX = BASE - 1;
/** STOREFRONT: the highest code a screen draws - a mount look laid over it. */
export const HORSE_LOOK_WORN_MAX = BASE * HORSE_MOUNTS.length - 1;
/** The look a code names - the bay as drawn for anything the law does not know. */
export function horseLookOfCode(code) {
  if (!Number.isInteger(code) || code < 0 || code > HORSE_LOOK_WORN_MAX) return readHorseLook(null);
  const b = code % BASE;
  return readHorseLook({ coat: b % C, pattern: Math.floor(b / C) % P, legs: Math.floor(b / (C * P)) % L, seed: Math.floor(b / (C * P * L)), mount: Math.floor(code / BASE) });
}
/** STOREFRONT: a code with mount look `key` laid over it (net/effectLaw.js MOUNT_LOOKS; null or unknown: none). */
export const withMountLook = (/** @type {unknown} */ code, /** @type {unknown} */ key) => {
  const l = horseLookOfCode(Number.isInteger(code) ? /** @type {number} */ (code) : 0);
  return horseLookCode({ ...l, mount: Math.max(0, HORSE_MOUNTS.indexOf(/** @type {string} */ (key))) });
};
/** STOREFRONT: a code as the wire says it - its mount look taken off. */
export const wireHorseLook = (/** @type {unknown} */ code) => horseLookCode({ ...horseLookOfCode(Number.isInteger(code) ? /** @type {number} */ (code) : 0), mount: 0 });
/** A look or its code, as a look. */
const lookOf = (v) => (typeof v === 'number' ? horseLookOfCode(v) : readHorseLook(v));
/** A look in words: "chestnut", "black pinto with socks", "dapple grey with stockings". */
export function describeHorseLook(v) {
  const l = lookOf(v);
  const coat = HORSE_LOOK_NAMES[HORSE_COATS[l.coat]].toLowerCase();
  const pattern = HORSE_PATTERNS[l.pattern];
  const body = pattern === 'solid' ? coat : pattern === 'dapples' ? `dapple ${coat}` : `${coat} ${pattern}`;
  return l.legs ? `${body} with ${HORSE_LEGS[l.legs]}` : body;
}

/** Whether an item is a horse (DFU's one Transportation.Horse template). */
export const isHorseItem = (item) => item?.templateIndex === TRANSPORT_HORSE;
/** The horse a player rides: the first in the pack (inventorySession.js hasHorse's own find). */
export const activeHorseItem = (items) => (Array.isArray(items) ? items.find(isHorseItem) ?? null : null);
/** A horse item's look (its four fields, checked) - the bay as drawn for anything else. */
export const horseLookOf = (item) => readHorseLook(isHorseItem(item) ? { coat: item.horseCoat, pattern: item.horsePattern, legs: item.horseLegs, seed: item.horseSeed } : null);
/** The look of the horse a player rides, as its code (0, the bay as drawn, with none). */
export const riddenHorseLook = (items) => horseLookCode(horseLookOf(activeHorseItem(items)));

/** A look rolled at a horse's birth (BIRTH_WEIGHTS; `rand` () => [0, 1)). */
export function rollHorseLook(rand = Math.random) {
  return {
    coat: pick(BIRTH_WEIGHTS.coat, rand()), pattern: pick(BIRTH_WEIGHTS.pattern, rand()), legs: pick(BIRTH_WEIGHTS.legs, rand()),
    seed: 1 + Math.min(HORSE_SEED_MAX - 1, Math.floor(rand() * HORSE_SEED_MAX)),
  };
}
/**
 * THE HORSES BORN: every horse in `items` without a seed is given its look, in place (the item keeps its place and its
 * identity - an open window's hold on it is still good); a horse with one is left as it is. Answers how many were born.
 */
export function birthHorses(items, rand = Math.random) {
  if (!Array.isArray(items)) return 0;
  let n = 0;
  for (const item of items) {
    if (!isHorseItem(item) || index(item.horseSeed, HORSE_SEED_MAX) > 0) continue;
    const l = rollHorseLook(rand);
    for (const { part, field } of HORSE_LOOK_PARTS) { if (l[part]) item[field] = l[part]; else delete item[field]; }
    item.horseSeed = l.seed;
    n++;
  }
  return n;
}

/** The item a part's choice makes: a new object, the old one untouched; a field dropped for its list's first. Null for
 *  anything not a horse, or a part the law does not know. The seed is never touched. */
export function restyledHorse(item, part, i) {
  const p = HORSE_LOOK_PARTS.find((x) => x.part === part);
  if (!isHorseItem(item) || !p) return null;
  const v = index(i, p.list.length - 1);
  const { [p.field]: _drop, ...rest } = item;
  return v ? { ...rest, [p.field]: v } : rest;
}
/**
 * THE RIDDEN HORSE RESTYLED: in the pack `items` (the host's own list - the horse's place in it taken by its restyled
 * self), the horse a player rides given choice `i` of `part` ('coat', 'pattern' or 'legs'). `{ ok, text }` - what the
 * Stable says.
 */
export function restyleRiddenHorse(items, part, i) {
  const item = activeHorseItem(items);
  if (!item || !Array.isArray(items)) return { ok: false, text: COAT_TEXT.noHorse };
  const styled = restyledHorse(item, part, i);
  if (!styled) return { ok: false, text: 'Not here.' };
  items[items.indexOf(item)] = styled;
  return { ok: true, text: COAT_TEXT.changed(describeHorseLook(horseLookOf(styled))) };
}
/** The ridden horse's look as the Stable lists it: a row a part - its name, its choices' names, the one worn - with its
 *  words; null with no horse. */
export function horseLookRows(items) {
  const item = activeHorseItem(items);
  if (!item) return null;
  const l = horseLookOf(item);
  return {
    desc: describeHorseLook(l),
    rows: HORSE_LOOK_PARTS.map(({ part, list, name }) => ({ part, name, choices: list.map((k) => HORSE_LOOK_NAMES[k]), current: l[part] })),
  };
}

/** FNV-1a, 32-bit, of a string. */
function fnv(k) {
  let h = 0x811c9dc5;
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/**
 * A STRANGER'S HORSE: the look a horse nobody owns wears - the road's teams (world/road/roadTeams.js) - off its own key, so
 * it keeps it every frame and every client sees the same one: born by BIRTH_WEIGHTS on the key's hash, on one of
 * STRANGER_SEEDS seeds (a road shows many horses at once, and each look is its own dyed pictures). As a code.
 */
export function strangerHorseLook(key) {
  let h = fnv(String(key ?? ''));
  const next = () => { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0; return (h >>> 0) / 4294967296; };
  const l = { coat: pick(BIRTH_WEIGHTS.coat, next()), pattern: pick(BIRTH_WEIGHTS.pattern, next()), legs: pick(BIRTH_WEIGHTS.legs, next()), seed: 1 + Math.floor(next() * STRANGER_SEEDS) };
  return horseLookCode(l);
}

/** The suffix a dyed picture's record wears on the renderer (`''` for the bay as drawn - the art's own record). */
export const lookSuffix = (v) => { const c = typeof v === 'number' ? horseLookCode(horseLookOfCode(v)) : horseLookCode(v); return c ? `~${c}` : ''; };

// ── the dye ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// PERF-HIDE: THE DYE'S HELPERS ANSWER INTO SCRATCH, NOT A NEW ARRAY. They run a pixel at a time - a dapple's pixel asks
// `nearest2` once and `noise` some sixty times - and each answered a fresh array (and `nearest2` swapped through one,
// nine times a pixel): a picture's dye was thousands of allocations. Each now writes its answer into its own scratch
// (doubles, so every value is the one the array held), read back by its caller before the next call; the arithmetic
// is the same, step for step, so a dyed picture is byte for byte the one it was.
const _hsv = new Float64Array(3), _rgb = new Float64Array(3), _warp = new Float64Array(2), _near = new Float64Array(3), _mark = new Float64Array(2);

/** RGB bytes -> [hue degrees, saturation, value], into `_hsv` (PERF-HIDE). */
function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  _hsv[0] = h; _hsv[1] = max > 0 ? d / max : 0; _hsv[2] = max / 255;
  return _hsv;
}
/** [hue degrees, saturation, value] -> RGB bytes, written into `out` at `o`. Any hue, turned into [0, 360) first
 *  (AUDIT COATS3D A9: a hue jittered under 0 - the bay's red, a seed's shade down - wrapped a channel to 255). */
function rgbInto(out, o, hue, s, v) {
  const h = ((hue % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const k = Math.floor(h / 60) % 6;
  let r, g, b;
  if (k === 0) { r = c; g = x; b = 0; } else if (k === 1) { r = x; g = c; b = 0; } else if (k === 2) { r = 0; g = c; b = x; } else if (k === 3) { r = 0; g = x; b = c; } else if (k === 4) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
  out[o] = Math.round((r + m) * 255); out[o + 1] = Math.round((g + m) * 255); out[o + 2] = Math.round((b + m) * 255);
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fract = (v) => v - Math.floor(v);

/** A seed's integer hash of a lattice point - [0, 1). */
function hash3(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 0x27d4eb2f)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise at (x, y) - [0, 1). */
function noise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash3(ix, iy, s), b = hash3(ix + 1, iy, s), c = hash3(ix, iy + 1, s), d = hash3(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/**
 * The nearest two of a jittered lattice's points to (x, y), in cells: [the nearest's distance, the next's, the nearest
 * cell's hash]. Each point's distance is measured in its own stretched and turned frame (`stretch` how far a cell may be
 * squashed, 0 none), so a spot or a dapple is an oval of its own bearing, never a circle.
 */
function nearest2(x, y, s, stretch = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  // PERF-HIDE: the nine points about one lattice cell are the cell's, not the pixel's - a run of pixels in one cell
  // asks the same nine, so they are kept for the last cell asked (`_cells`) and only the distances are the pixel's
  if (ix !== _cellAt[0] || iy !== _cellAt[1] || s !== _cellAt[2] || stretch !== _cellAt[3]) {
    _cellAt[0] = ix; _cellAt[1] = iy; _cellAt[2] = s; _cellAt[3] = stretch;
    for (let dy = -1, j = 0; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++, j += 6) {
      const cx = ix + dx, cy = iy + dy;
      _cells[j] = cx + 0.1 + 0.8 * hash3(cx, cy, s); _cells[j + 1] = cy + 0.1 + 0.8 * hash3(cy, cx, s + 1);
      if (stretch) {
        const a = hash3(cx, cy, s + 3) * Math.PI;
        _cells[j + 2] = Math.cos(a); _cells[j + 3] = Math.sin(a); _cells[j + 4] = 1 + stretch * hash3(cx, cy, s + 4);
      }
      _cells[j + 5] = hash3(cx, cy, s + 2);
    }
  }
  let f1 = 9, f2 = 9, bh = 0;
  for (let j = 0; j < 54; j += 6) {
    let ex = x - _cells[j], ey = y - _cells[j + 1];
    if (stretch) {
      const c = _cells[j + 2], sn = _cells[j + 3], k = _cells[j + 4];
      const tx = (ex * c + ey * sn) / k;
      ey = (ey * c - ex * sn) * k; ex = tx;
    }
    const d = Math.hypot(ex, ey);
    if (d < f1) { f2 = f1; f1 = d; bh = _cells[j + 5]; } else if (d < f2) f2 = d;
  }
  _near[0] = f1; _near[1] = f2; _near[2] = bh;
  return _near;
}
const _cellAt = new Float64Array([NaN, NaN, NaN, NaN]), _cells = new Float64Array(54);
/** PERF-HIDE: `nearest2`'s answer as a new array - its pins' door, so the kept cells are asked across seeds and
 *  stretches directly (inside one dye both are fixed). */
export const latticeNearest = (x, y, s, stretch = 0) => Array.from(nearest2(x, y, s, stretch));
/** (x, y) pushed about by the seed's noise, `amp` its reach - so a lattice's rows and a patch's edge wander. Into
 *  `_warp` (PERF-HIDE). */
function warp(x, y, s, amp, freq = 1.3) {
  _warp[0] = x + amp * (noise(x * freq + 13.1, y * freq, s + 21) * 2 - 1);
  _warp[1] = y + amp * (noise(x * freq, y * freq + 7.7, s + 22) * 2 - 1);
  return _warp;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A seed's own [0, 1) for its `k`th question. */
const seedRand = (seed, k) => hash3(seed, k, 0x5eed);

/** A seed's shade of its coat: [hue degrees, light factor] - none for no seed. */
export function shadeOf(seed) {
  if (!seed) return [0, 1];
  return [(seedRand(seed, 1) * 2 - 1) * SHADE_HUE, 1 + (seedRand(seed, 2) * 2 - 1) * SHADE_VALUE];
}

/** The pinto's field at (u, v): three octaves of the seed's noise over a domain the noise pushes about - and the
 *  threshold past which it is white (`pintoCut`). Apart, so the 3D dye can blend the field before it cuts it. */
function pintoField(s, u, v) {
  const ox = seedRand(s, 3) * 61, oy = seedRand(s, 4) * 47;
  const W = warp(u * 2.4 + ox, v * 2.4 + oy, s, 0.45, 1.1), wu = W[0], wv = W[1];
  return 0.62 * noise(wu, wv, s) + 0.28 * noise(wu * 2.3 + oy, wv * 2.3 + ox, s + 7) + 0.1 * noise(wu * 7, wv * 7, s + 8);
}
const pintoCut = (s, n) => { const t = 0.5 + (seedRand(s, 5) - 0.5) * 0.16; return smooth(t - 0.012, t + 0.012, n); };
/** The roan's white hairs' share at (u, v): a quarter to a half of the hide, thicker in patches. */
const roanDensity = (s, u, v) => 0.22 + seedRand(s, 9) * 0.12 + 0.2 * noise(u * 3 + seedRand(s, 3) * 61, v * 3 + seedRand(s, 4) * 47, s + 12);
/** ...and whether the hide's pixel or texel (`px`, `py`, its own grid) is one: white at 0.6, never a pure white. */
const roanFleck = (s, px, py, density) => (hash3(px, py, s + 11) < density ? 0.6 : 0);

/**
 * The marking a pattern lays at a hide pixel: `[white, dark]` - how far toward white it goes (0..1), and how far its
 * light falls (0..1, the appaloosa's spots and the dapples' rings). `u` from the hide's left and `v` down from its top,
 * in PATTERN_SCALE_PX units (so the frame is square), `px` the pixel's place in the hide's own grid (the roan's flecks).
 * Into `_mark` (PERF-HIDE).
 */
function markingAt(pattern, seed, u, v, px, py) {
  const s = seed | 0, ox = seedRand(s, 3) * 61, oy = seedRand(s, 4) * 47;
  switch (HORSE_PATTERNS[pattern]) {
    case 'pinto': return mark(pintoCut(s, pintoField(s, u, v)), 0);   // tobiano: broad white across the back and down the flanks, its edge wandering and ragged
    case 'appaloosa': {   // half are leopards (white, the coat in spots), half snowflakes (the coat, flecked in white)
      const cell = 0.075 + seedRand(s, 6) * 0.03;
      const W = warp(u / cell + ox, v / cell + oy, s, 0.3);
      const N = nearest2(W[0], W[1], s, 0.45), f1 = N[0], h = N[2];   // an oval of its own bearing: at the 3D horse's detail a spot stretched further read as a brush stroke
      const r = (0.14 + 0.2 * h) * (0.75 + 0.5 * noise(u * 40 + ox, v * 40 + oy, s + 9));   // each spot its own size, its edge ragged
      const spot = smooth(r - 0.04, r + 0.04, r * 2 - f1);
      if (seedRand(s, 7) < 0.5) return mark(1 - spot, spot * 0.15);   // leopard
      return mark(h < 0.7 ? spot : 0, 0);   // snowflake: most cells flecked
    }
    case 'dapples': {   // soft lighter blots, each its own size and bearing, the coat a shade darker between them - no line drawn
      const cell = 0.08 + seedRand(s, 8) * 0.025;
      const W = warp(u / cell + ox, v / cell + oy, s, 0.4);
      const N = nearest2(W[0], W[1], s, 0.7), f1 = N[0], h = N[2];
      const r = 0.3 + 0.16 * h;
      const blot = 1 - smooth(r * 0.45, r, f1 * (0.85 + 0.3 * noise(u * 30 + ox, v * 30 + oy, s + 9)));
      const fade = 0.55 + 0.45 * smooth(0.25, 0.75, noise(u * 1.6 + oy, v * 1.6 + ox, s + 10));   // dapples come and go across the coat
      return mark(0.34 * blot * fade, (1 - blot) * 0.16 * fade);
    }
    case 'roan': return mark(roanFleck(s, px, py, roanDensity(s, u, v)), 0);   // white hairs through the coat, thicker on the body in patches
    default: return mark(0, 0);
  }
}
const mark = (white, dark) => { _mark[0] = white; _mark[1] = dark; return _mark; };

/**
 * ONE DYE, EVERY HORSE (COATS3D's parity): a hide pixel `o` of `src` dyed into `out` - the coat's hue (the bay keeps
 * the art's own) turned by the seed's shade, a saturation off its own, a value `lift + scale * v` lit by the shade and
 * darkened by `dark`, then `white` of the hide's own light in white over it - that light at least `whiteFloor` (0 for a
 * sprite; WHITE_FLOOR_3D for the 3D horse). The sprites' dye and the 3D horse's both end here, so a coat is one colour
 * whichever horse wears it.
 */
function dyeInto(out, src, o, dye, hueJ, valJ, white, dark, whiteFloor = 0) {
  const H = hsv(src[o], src[o + 1], src[o + 2]), h0 = H[0], s = H[1], v = H[2];
  const mode = dye.sat[0], k = dye.sat[1], lift = dye.val[0], scale = dye.val[1];
  const hue = (dye.hue ?? h0) + hueJ;
  const ns = clamp01(mode === 'mul' ? s * k : k * Math.min(1, s / 0.6 + 0.3));
  let nv = clamp01((lift + scale * v) * valJ);
  if (dark) nv *= 1 - dark;
  rgbInto(out, o, hue, ns, nv);
  if (white > 0) {   // the hide's own light, in white: a patch in shadow is a shadowed white
    const tmp = _rgb;
    rgbInto(tmp, 0, hue, 0.04, clamp01(0.4 + 0.85 * Math.max(v, whiteFloor)));
    out[o] = Math.round(out[o] + (tmp[0] - out[o]) * white);
    out[o + 1] = Math.round(out[o + 1] + (tmp[1] - out[o + 1]) * white);
    out[o + 2] = Math.round(out[o + 2] + (tmp[2] - out[o + 2]) * white);
  }
}

// ── STOREFRONT: the mount looks ─────────────────────────────────────────────────────────────────────────────────────
// AUDIT-STOREFRONT: each look painted by systems/horse/mountPaint.js - its own ramp by the art's light, its marks by the
// horse's own shape. The coat is dyed first and the look laid over it, so a look taken off is the coat again.

/** Where the points' leather-brown shading starts, a share of the hide's height down from its top - the belly. */
export const POINT_BELLY = 0.56;
/** Every mount look paints the points (the ghost's deep blue, the charger's fire, the warhorse's burning, steel). */
export const dyesPoints = (/** @type {number} */ mount) => !!HORSE_MOUNTS[mount] && HORSE_MOUNTS[mount] !== 'none';
/** The light a point is scaled by: the points are the art's near-black, POINT_VAL its brightest. */
const pointLight = (/** @type {Uint8Array|ArrayLike<number>} */ c, /** @type {number} */ o) => clamp01(lightOf(c[o], c[o + 1], c[o + 2]) / POINT_VAL);
/** One reused pixel record for the painters. @type {import('./mountPaint.js').MountPixel} */
const _px = { t: 0, up: 0, ur: 0, edge: EDGE_MAX, leg: 0, hem: 0, far: 0, heart: Infinity, px: 0, py: 0, seed: 0, legs: true, flat: false, face: 0 };

/** AUDIT-STOREFRONT: THE 3D HORSE'S MANE AND TAIL - its hair picture's rows `r0` to `r1` (not including it), `src`'s
 *  texels in mount look `mount` into `out` (a copy of `src`), as the sprites' points; its alpha its own.
 *  @param {Uint8Array} src @param {Uint8Array} out @param {number} width @param {number} mount @param {number} r0 @param {number} r1 */
export function dyeHorseHairRows(src, out, width, mount, r0, r1) {
  const look = HORSE_MOUNTS[mount], p = _px;
  p.flat = true; p.leg = 0; p.hem = 0; p.far = 6; p.heart = Infinity; p.edge = 2; p.legs = false; p.up = 1; p.ur = 0; p.face = 0;   // a strand's middle
  // AUDIT-STOREFRONT II (lane C 4): seed 0 - one picture for every horse in the look (world/horseRig.js keeps it by look),
  // never the flicker of whichever horse the shared record was last dyed for
  p.seed = 0;
  for (let o = r0 * width * 4, end = r1 * width * 4; o < end; o += 4) {
    if (!src[o + 3]) continue;
    p.t = clamp01(lightOf(src[o], src[o + 1], src[o + 2]) / 0.6); p.px = (o / 4) % width; p.py = Math.floor(o / 4 / width);
    paintMountPoint(out, o, look, p);
  }
}
/** Whether a pixel is one of the horse's points: near-black and all but grey (POINT_*), as the art paints them. */
const isPointPixel = (r, g, b) => { const H = hsv(r, g, b); return H[1] < POINT_SAT && H[2] < POINT_VAL; };
/** AUDIT-STOREFRONT: a point is near-black under this value and this saturation - the art's mane, tail and shading, never
 *  a rider's leather, steel or cloth. */
export const POINT_VAL = 0.35;
export const POINT_SAT = 0.15;
/** AUDIT-STOREFRONT: THE HORSE'S POINTS in a picture - its near-black pixels, and below its belly the leather-brown
 *  its shading is painted in, joined to its hide through such pixels alone (8-connected, nearest first). Never one
 *  climbing more than POINT_ABOVE of the hide's height over where its run left the hide (a rider's bow or spear rising
 *  off the neck; a mane sits on it, a tail falls from the croup), nor a thin line (fewer than POINT_BODY of its
 *  neighbours the horse's). A bridle drawn in the points' black is among them: across the hide it is drawn as the
 *  shading is, a dark band, and a rule that spared it blacked the small sprites' shading. `down(i)` a pixel's depth. */
function pointsOf(src, w, h, hide, tack, down, hideH, spare) {
  const n = w * h, horse = new Uint8Array(n), out = [];
  for (const i of hide.at) horse[i] = 2;
  const belly = POINT_BELLY * hideH, reach = POINT_ABOVE * hideH;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (!horse[i] && src[o + 3] && !spare?.[i] && (isPointPixel(src[o], src[o + 1], src[o + 2]) || (tack && down(i) > belly && isCoatPixel(src[o], src[o + 1], src[o + 2], false)))) horse[i] = 1;
  }
  const near = (/** @type {number} */ p, /** @type {(q: number) => void} */ f) => {
    const x = p % w, y = (p - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if ((dx || dy) && X >= 0 && X < w && Y >= 0 && Y < h) f(Y * w + X);
    }
  };
  const body = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (horse[i] === 1) { let k = 0; near(i, (q) => { if (horse[q]) k++; }); body[i] = k >= POINT_BODY ? 1 : 0; }
  const seen = new Uint8Array(n), base = new Float64Array(n), queue = [];
  let from = 0;
  const visit = (/** @type {number} */ q, /** @type {number} */ b) => {
    if (seen[q] || !body[q] || b - down(q) > reach) return;
    seen[q] = 1; base[q] = b; out.push(q); queue.push(q);
  };
  for (const i of hide.at) near(i, (q) => visit(q, down(i)));
  while (from < queue.length) { const p = queue[from++]; near(p, (q) => visit(q, base[p])); }
  // a strand's shine: a grey lighter than the points, held among them - the mane's streaks seen from the saddle
  for (let pass = 0; pass < 2; pass++) {
    const shine = [];
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (seen[i] || horse[i] === 2 || !src[o + 3] || spare?.[i] || hsv(src[o], src[o + 1], src[o + 2])[1] >= POINT_SAT) continue;
      let k = 0; near(i, (q) => { if (seen[q]) k++; });
      if (k >= POINT_SHINE) shine.push(i);
    }
    for (const i of shine) { seen[i] = 1; out.push(i); }
  }
  // THE VISUAL PASS: the art's rose sheen on the hooves and the poll is neither hide nor point, so a look left it the
  // bay's own (pink under a ghost's dissolved hooves). Taken with the points, grown from the horse: a speck touching it
  // with POINT_SPECK neighbours the horse's, sheen or the toe's grey. A grey itself stays the shine's rule's (a rider's
  // steel beside a mane).
  const sheen = new Uint8Array(n);   // 1 a speck of sheen, 2 a grey it may lean on
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (seen[i] || horse[i] === 2 || !src[o + 3] || spare?.[i]) continue;
    if (isSpeckPixel(src[o], src[o + 1], src[o + 2])) sheen[i] = 1; else if (hsv(src[o], src[o + 1], src[o + 2])[1] < POINT_SAT) sheen[i] = 2;
  }
  for (let pass = 0; pass < 4; pass++) {
    const specks = [];
    for (let i = 0; i < n; i++) {
      if (sheen[i] !== 1 || seen[i]) continue;
      let k = 0, s = 0;
      near(i, (q) => { if (seen[q] || horse[q] === 2) k++; else if (sheen[q]) s++; });
      if (k >= 1 && k + s >= POINT_SPECK) specks.push(i);
    }
    for (const i of specks) { seen[i] = 1; out.push(i); }
  }
  return out;
}
/** THE VISUAL PASS: how many of a speck's eight neighbours are the horse's or sheen for it to be taken with the points. */
export const POINT_SPECK = 3;
/** The rose sheen the art paints the horse's hooves and poll with: hue 290-345 degrees, coloured. */
export const isSpeckPixel = (/** @type {number} */ r, /** @type {number} */ g, /** @type {number} */ b) => { const H = hsv(r, g, b); return H[0] >= 290 && H[0] < 345 && H[1] >= 0.2; };
/** AUDIT-STOREFRONT: how many of a grey pixel's eight neighbours are points for it to be a strand's shine among them. */
export const POINT_SHINE = 5;
/** AUDIT-STOREFRONT: how many of a point's eight neighbours are the horse's - a mane's, a tail's or an outline's are most;
 *  a line drawn across the air has two or three. */
export const POINT_BODY = 4;
/** AUDIT-STOREFRONT: how far over the hide a run of points may climb, a share of the hide's height - a mane's crest. */
export const POINT_ABOVE = 0.06;

/** Whether a pixel is the hide's (THE DYE's first two rules): warm, coloured, and - where a saddle is drawn (`tack`) -
 *  not the tack's leather. */
export function isCoatPixel(r, g, b, tack = true) {
  const H = hsv(r, g, b), h = H[0], s = H[1], v = H[2];
  if (!((h <= 50 || h >= 345) && s >= 0.2)) return false;
  return !(tack && h >= 28 && h <= 48 && s >= 0.36 && s < 0.58 && v >= 0.24 && v < 0.5);
}

/**
 * THE DYE: `image` (`{ width, height, colors }`, RGBA bytes - a Uint8Array, a Uint8ClampedArray or a Uint32Array over
 * them) in look `look` (a look or its code) - a NEW image of the same shape, the old one untouched; the image itself for
 * the bay as drawn (code 0), which is no pass at all. `bottomFirst` whether row 0 is the picture's bottom (the world's
 * billboards' order, formats/color32Order.js - the pool's and Eye Of The Beholder's pictures; the legs' white climbs
 * from the hooves, and the markings hang from the top); `legs` false where no hoof is drawn (the riding sprite's head
 * and neck), so no white is laid along the picture's lower edge; `tack` false where no saddle is (the riding sprite's
 * neck: its shadow along the mane is the leather band's colour, and without a saddle to spare it is the hide's); `spare`
 * 1 a pixel never the horse's (a rider's, eotbRiderMasks.js); `view` its view (mountPaint.js VIEW_FRONT..VIEW_BACK).
 * @template {{ width: number, height: number, colors: ArrayLike<number> & { buffer: ArrayBufferLike, byteOffset: number, byteLength: number } }} T
 * @param {T} image @param {any} look @param {{ bottomFirst?: boolean, legs?: boolean, tack?: boolean, spare?: Uint8Array|null, view?: number }} [opts]
 * @returns {T}
 */
export function recolorHorse(image, look, { bottomFirst = true, legs = true, tack = true, spare = null, view = undefined } = {}) {
  const l = lookOf(look);
  if (!horseLookCode(l) || !image?.colors) return image;
  const dye = COAT_DYES[HORSE_COATS[l.coat]];
  const { width: w, height: h } = image;
  const src = new Uint8Array(image.colors.buffer, image.colors.byteOffset, image.colors.byteLength);
  const n = w * h;
  if (src.length < n * 4) return image;
  const out = new Uint8Array(src);   // a copy
  const hide = hideOf(image.colors, src, w, h, tack, bottomFirst, spare);
  if (hide.at.length) {
    const { at, x0, r0, r1 } = hide;
    const hideW = Math.max(1, hide.x1 - x0 + 1), hideH = Math.max(1, r1 - r0 + 1), unit = Math.max(PATTERN_SCALE_PX, hideW);
    const [hueJ, valJ] = shadeOf(l.seed);
    const band = legs ? LEG_BANDS[l.legs] * hideH : 0;
    for (let j = 0; j < at.length; j++) {
      const i = at[j];
      const x = i % w, r = (i - x) / w;
      const down = bottomFirst ? r1 - r : r - r0, up = bottomFirst ? r - r0 : r1 - r;
      let white = 0, dark = 0;
      if (l.pattern) { const M = markingAt(l.pattern, l.seed, (x - x0) / unit, down / unit, x - x0, down); white = M[0]; dark = M[1]; }
      if (band > 0 && up < band * (0.8 + 0.4 * hash3(x - x0, 0, l.seed + 13))) white = 1;   // the legs' white, its top ragged
      dyeInto(out, src, i * 4, dye, hueJ, valJ, white, dark);
    }
    if (l.mount) {   // STOREFRONT: the mount look over the coat - AUDIT-STOREFRONT: its hide and its points, by the horse's shape
      const look = HORSE_MOUNTS[l.mount], downOf = (/** @type {number} */ i) => { const r = (i - (i % w)) / w; return bottomFirst ? r1 - r : r - r0; };
      const pts = pointsOfImage(image.colors, src, w, h, tack, bottomFirst, spare, hide, downOf, hideH);
      const an = anatomyOfImage(image.colors, src, w, h, tack, bottomFirst, spare, at, pts, downOf, hideW, hideH);
      const { face, heart } = mountFacing(an, w, at, pts, downOf, hideW, hideH, view);
      const p = _px, span = an.hi - an.lo;
      p.seed = l.seed; p.legs = legs; p.flat = false; p.face = legs ? face : 0;   // without hooves, the view along the neck from the saddle
      const paint = (/** @type {number} */ i, /** @type {boolean} */ point) => {
        const o = i * 4, x = i % w, along = (x - x0) / hideW;
        p.t = point ? pointLight(src, o) : clamp01((lightOf(src[o], src[o + 1], src[o + 2]) - an.lo) / span);
        p.up = 1 - downOf(i) / hideH; p.ur = face < 0 ? 1 - along : along;
        p.edge = an.edge[i]; p.leg = an.leg[i]; p.hem = an.hem[i]; p.far = an.far[i]; p.px = x; p.py = (i - x) / w;
        p.heart = Math.hypot(x - heart[0], p.py - heart[1]) / heart[2];   // NaN where no chest is seen: never the heart
        if (!(point ? paintMountPoint(out, o, look, p) : paintMountHide(out, o, look, p))) out[o + 3] = 0;
      };
      for (let j = 0; j < at.length; j++) paint(at[j], false);
      for (let j = 0; j < pts.length; j++) paint(pts[j], true);
    }
  }
  const Ctor = /** @type {any} */ (image.colors).constructor;
  const colors = Ctor === Uint8Array ? out : new Ctor(out.buffer, 0, Ctor.BYTES_PER_ELEMENT === 4 ? n : n * 4);
  return /** @type {T} */ ({ ...image, colors });
}

/** PERF-HIDE: each picture's hide, kept by its pixels' array - one entry a `tack` (0 without, 1 with). */
const _hides = new WeakMap();
/** AUDIT-STOREFRONT: and its points, found once a picture a `tack` the first time a mount look asks. */
const _points = new WeakMap();
const pointsOfImage = (colors, src, w, h, tack, bottomFirst, spare, hide, down, hideH) => keptOf(_points, colors, slotOf(tack, bottomFirst, spare), () => pointsOf(src, w, h, hide, tack, down, hideH, spare));
/** AUDIT-STOREFRONT: and its shape for the looks (mountPaint.js mountAnatomy), a `tack` and a row order each. */
const _anatomy = new WeakMap();
const anatomyOfImage = (colors, src, w, h, tack, bottomFirst, spare, at, pts, down, hideW, hideH) =>
  keptOf(_anatomy, colors, slotOf(tack, bottomFirst, spare), () => mountAnatomy(src, w, h, at, pts, down, hideW, hideH, bottomFirst ? -1 : 1));
/** PERF-HIDE: what `cache` keeps for a picture's pixels' array and a `tack` - `make`'s answer, asked once. */
function keptOf(cache, colors, k, make) {
  let kept = cache.get(colors);
  if (!kept) { kept = [null, null, null, null, null, null, null, null]; cache.set(colors, kept); }
  return kept[k] ?? (kept[k] = make());
}
/** A picture's slot in what is kept for it: its `tack`, and its row order (AUDIT-STOREFRONT: its points and its shape are
 *  measured from its top, so a picture asked in both orders keeps each), and whether a rider is spared in it. */
const slotOf = (/** @type {boolean} */ tack, /** @type {boolean} */ bottomFirst, /** @type {Uint8Array|null} */ spare) => (tack ? 1 : 0) + (bottomFirst ? 2 : 0) + (spare ? 4 : 0);

/**
 * PERF-HIDE (2026-10-12, a profile of a player's client in its first seconds in the world: the wagon pool's looks dyed
 * 0.9 s of the main thread, three quarters of it finding the hide again): THE HIDE IS THE PICTURE'S, NOT THE LOOK'S.
 * Which pixels the dye moves (THE DYE's warm, coloured, not-tack pixels, gathered into regions, the horse's kept) and
 * the frame they make (`x0`..`x1`, `r0`..`r1`) are read off the picture's own pixels and `tack` alone - so they are
 * found once a picture and kept with it (`_hides`, weakly: a picture let go takes its hide with it), and every look
 * after is the dye's own pass over `at`, the hide's pixels in order. A picture is never re-painted under a look (the
 * pool's and the riders' kept art is read, never written; a riding frame is a new array each time it is decoded).
 * @param {object} colors the picture's pixels' array (the key)
 * @param {Uint8Array} src the same, as bytes
 * @param {number} w
 * @param {number} h
 * @param {boolean} tack
 * @returns {{ at: Int32Array, x0: number, x1: number, r0: number, r1: number }}
 */
function hideOf(colors, src, w, h, tack, bottomFirst, spare) {
  return keptOf(_hides, colors, slotOf(tack, bottomFirst, spare), () => findHide(src, w, h, tack, spare));
}

/** PERF-HIDE: the hide `recolorHorse` dyes `image` by - the one it keeps for the picture (`tack` as recolorHorse's).
 *  Named `pictureHide`, not `horseHide`: the 3D horse's measure is `world/horseModel.js` horseHide, and one name is one
 *  module's (test/systems/talk/audit24_onehome.test.js's ratchet).
 *  @param {{ width: number, height: number, colors: ArrayLike<number> & { buffer: ArrayBufferLike, byteOffset: number, byteLength: number } }} image */
export function pictureHide(image, { tack = true, bottomFirst = true, spare = /** @type {Uint8Array|null} */ (null) } = {}) {
  return hideOf(image.colors, new Uint8Array(image.colors.buffer, image.colors.byteOffset, image.colors.byteLength), image.width, image.height, tack, bottomFirst, spare);
}

/** THE DYE's hide of one picture - its regions, the horse's among them, and their frame (see hideOf). */
function findHide(src, w, h, tack, spare) {
  const n = w * h;
  // the hide's pixels, and their 8-connected regions - never a spared pixel (a rider's skin is as warm as a bay)
  const coatMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (src[o + 3] && !spare?.[i] && isCoatPixel(src[o], src[o + 1], src[o + 2], tack)) coatMask[i] = 1;
  }
  const region = new Int32Array(n).fill(-1);
  const sizes = [], light = [];
  const stack = [];
  for (let i = 0; i < n; i++) {
    if (!coatMask[i] || region[i] >= 0) continue;
    const id = sizes.length;
    let size = 0, sum = 0;
    region[i] = id; stack.push(i);
    while (stack.length) {
      const p = /** @type {number} */ (stack.pop());
      size++;
      sum += Math.max(src[p * 4], src[p * 4 + 1], src[p * 4 + 2]) / 255;
      const px = p % w, py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const y = py + dy;
        if (y < 0 || y >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          if (x < 0 || x >= w) continue;
          const q = y * w + x;
          if (coatMask[q] && region[q] < 0) { region[q] = id; stack.push(q); }
        }
      }
    }
    sizes.push(size); light.push(sum / size);
  }
  if (!sizes.length) return { at: new Int32Array(0), x0: w, x1: -1, r0: h, r1: -1 };
  // the horse's regions: the large, then the small shadowed ones within COAT_SHADOW_REACH of a large one
  const floor = Math.max(...sizes) * COAT_REGION_SHARE;
  const dyed = sizes.map((z) => z >= floor);
  const near = new Uint8Array(n), R = COAT_SHADOW_REACH;
  for (let i = 0; i < n; i++) {
    if (region[i] < 0 || !dyed[region[i]]) continue;
    const px = i % w, py = (i - px) / w;
    for (let y = Math.max(0, py - R); y <= Math.min(h - 1, py + R); y++) for (let x = Math.max(0, px - R); x <= Math.min(w - 1, px + R); x++) near[y * w + x] = 1;
  }
  for (let i = 0; i < n; i++) { const id = region[i]; if (id >= 0 && !dyed[id] && near[i] && light[id] < COAT_SHADOW_VALUE) dyed[id] = true; }
  // the hide's pixels in order, and its frame: its width from its left, its top and its hooves
  let x0 = w, x1 = -1, r0 = h, r1 = -1, count = 0;
  for (let i = 0; i < n; i++) {
    if (region[i] < 0 || !dyed[region[i]]) continue;
    count++;
    const x = i % w, r = (i - x) / w;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (r < r0) r0 = r; if (r > r1) r1 = r;
  }
  const at = new Int32Array(count);
  for (let i = 0, j = 0; i < n; i++) if (region[i] >= 0 && dyed[region[i]]) at[j++] = i;
  return { at, x0, x1, r0, r1 };
}

// ── COATS3D: the 3D horse's dye ──────────────────────────────────────────────────────────────────────────────────────

/** THE 3D HORSE'S WHITE, at least this light. A sprite's picture is lit by its painting alone, so its white is the
 *  hide's own light (a patch in shadow, a shadowed white); the 3D horse is lit by the world, and its painting's darkest
 *  hide is PIGMENT - the bay's black points, the lower legs painted at a value of 0.1-0.22 (measured, horseModel.js
 *  horseTexelMap's legs) - so a sock laid by the art's light came out a mid grey (0.48-0.59). Its light is floored
 *  here: a sock a white the world then shades. */
export const WHITE_FLOOR_3D = 0.4;
/** The 3D dye's planes (`texelPlanes`): how sharply the hide's facing picks its plane - a weight is |normal|^4. */
export const PLANE_SHARPNESS = 4;
/** ...and a plane whose weight falls under this is not asked (its share of a marking under a hundredth). */
const PLANE_FLOOR = 0.01;

/**
 * THE 3D HIDE'S FRAME. A sprite's hide is one picture, so its markings are laid in the picture's own frame. The 3D
 * horse's hide is a surface, so each texel is laid in the frame of the side it FACES, as the sprite's views are: its
 * flank as the side view lays it (from the nose back, down from the top), its back and belly as seen from above and
 * below (from the nose back, across), its chest, face and rump as from the front and behind (across, down). Each of
 * the six faces has its own place on the pattern (a left flank is not its right's mirror), and a texel facing between
 * two takes both, weighted by how far it faces each (|n|^PLANE_SHARPNESS) - so where the back turns into the flank the
 * one side's patches hand over to the other's with no seam. The measure is the sprite's: one PATTERN_SCALE_PX unit is
 * the hide's length nose to rump (the side view's width), so a spot is one size on both. Answers `[u, v, w]` thrice
 * (the x, y and z faces, the one the normal points to), into `out` at `o`.
 * @param {ArrayLike<number>} p the texel's bind position, metres (Z up, +Y the way the horse faces)
 * @param {ArrayLike<number>} n its bind normal
 * @param {{ length: number, front: number, top: number }} hide the hide's length, its nose's y and its top's z
 */
export function texelPlanes(p, n, hide, out = new Float32Array(9), o = 0) {
  const L = hide.length || 1;
  const along = (hide.front - p[1]) / L, down = (hide.top - p[2]) / L, across = p[0] / L;
  const wx = Math.abs(n[0]) ** PLANE_SHARPNESS, wy = Math.abs(n[1]) ** PLANE_SHARPNESS, wz = Math.abs(n[2]) ** PLANE_SHARPNESS;
  const sum = wx + wy + wz || 1;
  // each face its own place on the pattern: the flanks, the front and back, the top and belly - six, apart
  const fx = n[0] < 0 ? 37.3 : 0, fy = n[1] < 0 ? 53.9 : 71.1, fz = n[2] < 0 ? 89.7 : 17.9;
  out[o] = along + fx; out[o + 1] = down; out[o + 2] = wx / sum;
  out[o + 3] = across + fy; out[o + 4] = down; out[o + 5] = wy / sum;
  out[o + 6] = along + fz; out[o + 7] = across; out[o + 8] = wz / sum;
  return out;
}

/**
 * THE 3D HORSE'S DYE (COATS3D): `image` (the body's picture, `{ width, height, colors }` RGBA bytes) in look `look` -
 * a new image, or the image itself for the bay as drawn (code 0). `map` places each texel on the horse - built off the
 * mesh by world/horseModel.js horseTexelMap: `hide` (1 a texel the body's hide draws, 0 one no triangle covers or a
 * hoof's), `planes` (texelPlanes, nine a texel) and `up` (the texel's height over the hooves as a share of the hide's).
 * The law is the sprites', to the number - the same hide test (warm and coloured: an eye's white and pupil, a
 * nostril's black are not), the same coat, shade, markings and white through the one `dyeInto` - with the markings
 * laid in each texel's own frame (texelPlanes), the legs' white from the hooves by the same LEG_BANDS share of the
 * hide's height, its top ragged, and a white never darker than WHITE_FLOOR_3D's light. No tack is spared (none is painted) and no region is weighed (no rider is in the
 * picture). A mane is not in this picture: the hair cards' is the art's, as the sprites' is.
 * @template {{ width: number, height: number, colors: ArrayLike<number> & { buffer: ArrayBufferLike, byteOffset: number, byteLength: number } }} T
 * @param {T} image
 * @param {any} look
 * @param {{ hide: Uint8Array, planes: Float32Array, up: Float32Array }} map
 * @returns {T}
 */
export function recolorHorseTexels(image, look, map) {
  const l = lookOf(look);
  if (!horseLookCode(l) || !image?.colors || !map) return image;
  const { width: w, height: h } = image;
  const n = w * h;
  const src = new Uint8Array(image.colors.buffer, image.colors.byteOffset, image.colors.byteLength);
  if (src.length < n * 4 || map.hide.length < n) return image;
  const out = new Uint8Array(src);
  dyeHorseTexelRows(src, out, w, l, map, 0, h);
  const Ctor = /** @type {any} */ (image.colors).constructor;
  const colors = Ctor === Uint8Array ? out : new Ctor(out.buffer, 0, Ctor.BYTES_PER_ELEMENT === 4 ? n : n * 4);
  return /** @type {T} */ ({ ...image, colors });
}

/** AUDIT-STOREFRONT: where the 3D horse's legs end, a share of its height over the hooves - the belly. */
export const LEG_UP_3D = 0.5;
/** AUDIT-STOREFRONT: the 3D hide's light, its 5th to 95th share, read once a picture. */
const _texLight = new WeakMap();
function texLightOf(/** @type {Uint8Array} */ src, /** @type {any} */ map) {
  let k = _texLight.get(src.buffer);
  if (!k) {
    const v = [];
    for (let i = 0; i < map.hide.length; i++) if (map.hide[i] && src[i * 4 + 3]) v.push(lightOf(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]));
    v.sort((a, b) => a - b);
    const lo = v.length ? v[Math.floor(v.length * 0.05)] : 0, hi = v.length ? v[Math.floor(v.length * 0.95)] : 1;
    k = { lo, span: Math.max(0.05, hi - lo) };
    _texLight.set(src.buffer, k);
  }
  return k;
}
/** AUDIT-STOREFRONT: where the 3D chest's front is at the heart's height, along the flank's plane (1 the nose) - read off
 *  the map once, as the sprites' is off their pixels (mountAnatomy): a number guessed for it stood in the air. */
const _chest = new WeakMap();
function chestOf(/** @type {any} */ map) {
  let ur = _chest.get(map.up);
  if (ur === undefined) {
    let along = 1;
    for (let i = 0; i < map.hide.length; i++) {
      if (!map.hide[i] || Math.abs(map.up[i] - HEART_UP) > 0.02 || map.planes[i * 9 + 2] < 0.3) continue;   // on a flank
      const a = map.planes[i * 9];
      along = Math.min(along, a > 30 ? a - 37.3 : a);
    }
    _chest.set(map.up, ur = 1 - along);
  }
  return ur;
}
/** AUDIT-STOREFRONT: a 3D hide texel in its mount look - lit by the world, so no rim; its legs and its belly by its
 *  height, its place along by the flank's plane (0 its nose). */
function paintTexel(out, o, src, l, map, i, x, y) {
  const p = _px, L = texLightOf(src, map), up = map.up[i], a = map.planes[i * 9];
  p.flat = true; p.legs = true; p.seed = l.seed; p.face = -1; p.edge = EDGE_MAX; p.far = 0;
  p.t = clamp01((lightOf(src[o], src[o + 1], src[o + 2]) - L.lo) / L.span);
  p.up = up; p.leg = up < LEG_UP_3D ? 1 : 0; p.hem = up >= LEG_UP_3D && up < LEG_UP_3D + 0.03 ? 1 : 0;
  p.ur = clamp01(1 - (a > 30 ? a - 37.3 : a)); p.px = x; p.py = y;
  p.heart = Math.hypot((p.ur - chestOf(map) + 0.03) / 0.035, (up - HEART_UP) / 0.05);   // just in from the chest's front
  paintMountHide(out, o, HORSE_MOUNTS[l.mount], p);
}

/**
 * recolorHorseTexels's work, rows `r0` to `r1` (not including it) of a `width`-wide picture: `src`'s texels dyed into
 * `out` (a copy of `src`, the rows outside left as they are). Apart so a renderer can spread one look's dye over a
 * few frames (world/horseRig.js) - the whole picture is some 50-120 ms of a frame's CPU.
 * @param {Uint8Array} src
 * @param {Uint8Array} out
 * @param {number} width
 * @param {any} look
 * @param {{ hide: Uint8Array, planes: Float32Array, up: Float32Array }} map
 * @param {number} r0
 * @param {number} r1
 */
export function dyeHorseTexelRows(src, out, width, look, map, r0, r1) {
  const l = lookOf(look);
  if (!horseLookCode(l)) return;
  const dye = COAT_DYES[HORSE_COATS[l.coat]];
  const [hueJ, valJ] = shadeOf(l.seed);
  const s = l.seed | 0, P = map.planes;
  const band = LEG_BANDS[l.legs];
  const pattern = HORSE_PATTERNS[l.pattern];
  for (let i = r0 * width, end = r1 * width; i < end; i++) {
    const o = i * 4;
    if (!map.hide[i] || !src[o + 3] || !isCoatPixel(src[o], src[o + 1], src[o + 2], false)) continue;
    const x = i % width, y = (i - x) / width, q = i * 9;
    let white = 0, dark = 0, field = 0, rag = 0;
    for (let k = 0; k < 9; k += 3) {
      const pw = P[q + k + 2];
      if (pw < PLANE_FLOOR) continue;
      const u = P[q + k], v = P[q + k + 1];
      if (band > 0) rag += pw * noise(u * 40, v * 40, s + 13);
      if (pattern === 'pinto') field += pw * pintoField(s, u, v);
      else if (pattern === 'roan') field += pw * roanDensity(s, u, v);
      else if (l.pattern) { const M = markingAt(l.pattern, s, u, v, x, y); white += pw * M[0]; dark += pw * M[1]; }
    }
    if (pattern === 'pinto') white = pintoCut(s, field);
    else if (pattern === 'roan') white = roanFleck(s, x, y, field);
    if (band > 0 && map.up[i] < band * (0.8 + 0.4 * rag)) white = 1;   // the legs' white, its top ragged
    dyeInto(out, src, o, dye, hueJ, valJ, white, dark, WHITE_FLOOR_3D);
    if (l.mount) paintTexel(out, o, src, l, map, i, x, y);   // STOREFRONT: the mount look over the coat; its alpha the 3D horse's own
  }
}
