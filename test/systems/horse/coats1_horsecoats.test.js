// COATS1 (2026-10-11): THE HORSE'S LOOK (bible/06-Systems/Horse-Coats.md, systems/horse/horseCoats.js) - the law (coat,
// pattern, legs and the horse's own seed), its birth, the dye and its markings, the item's fields, the wire's three
// doors (the pool's word, the parked word, the pose), the pictures that wear it (the riding sprite, the pool's
// billboards, Eye Of The Beholder's rider - mine and the others', the road's strangers), their letting go, and the Stable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import {
  HORSE_COATS, HORSE_PATTERNS, HORSE_LEGS, HORSE_COAT_MAX, HORSE_PATTERN_MAX, HORSE_LEGS_MAX, HORSE_SEED_MAX, HORSE_LOOK_CODE_MAX,
  HORSE_LOOK_PARTS, COAT_REGION_SHARE, COAT_SHADOW_VALUE, COAT_SHADOW_REACH, SHADE_HUE, SHADE_VALUE, BIRTH_WEIGHTS, STRANGER_SEEDS,
  readHorseLook, horseLookCode, horseLookOfCode, describeHorseLook, activeHorseItem, horseLookOf, riddenHorseLook, rollHorseLook,
  birthHorses, restyledHorse, restyleRiddenHorse, horseLookRows, strangerHorseLook, lookSuffix, isCoatPixel, recolorHorse, shadeOf,
} from '../../../src/systems/horse/horseCoats.js';
import { TRANSPORT_HORSE, TRANSPORT_SMALL_CART } from '../../../src/systems/item/itemTemplates.js';
import { validItemField } from '../../../src/systems/item/itemFields.js';
import { itemFindings } from '../../../src/systems/item/itemLaw.js';
import { hccWireRecord, validHccRecord, hccRecordKey, HCC_WIRE_KIND } from '../../../src/systems/horse/horseCartWire.js';
import { validParkData, validPose, poseChanged, HORSE_LOOK_MAX, POSE_RIDE } from '../../../src/net/wire.js';
import { spriteFor, lookedPixels } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { ridingLook, loadRidingArt } from '../../../src/systems/riding.js';
import { TRANSPORT_MODES } from '../../../src/systems/transport.js';
import { createHorseCartPool, horseStillRecord, horseWalkRecord, HORSE_ARCHIVE, HORSE_LOOKS_KEPT, HORSE_DYE_PICTURES } from '../../../src/scenes/horseCartPool.js';
import { HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_VIEWS, HORSE_WALK_FRAMES } from '../../../src/systems/horse/horseCartLaw.js';
import { createEotbArt, RIDER_LOOKS_KEPT, RIDER_LOOK_IDLE_MS } from '../../../src/net/peer/peerRiders.js';
import { stableProviderFor } from '../../../src/ui/holdingsPages.js';

const horseItem = (extra = {}) => ({ templateIndex: TRANSPORT_HORSE, group: 'Transportation', name: 'Horse', ...extra });
const cartItem = (extra = {}) => ({ templateIndex: TRANSPORT_SMALL_CART, group: 'Transportation', name: 'Small cart', ...extra });
const code = (coat, pattern = 0, legs = 0, seed = 0) => horseLookCode({ coat, pattern, legs, seed });
/** A stand-in for Math.random that answers its list in turn. */
const answers = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('COATS1 the law: seven coats, five patterns, three legs and a seed, one number on the wire; every copy of a bound holds it', () => {
  assert.deepEqual([...HORSE_COATS], ['bay', 'chestnut', 'black', 'grey', 'dun', 'buckskin', 'palomino']);
  assert.deepEqual([...HORSE_PATTERNS], ['solid', 'pinto', 'appaloosa', 'dapples', 'roan']);
  assert.deepEqual([...HORSE_LEGS], ['plain', 'socks', 'stockings']);
  assert.deepEqual([HORSE_COAT_MAX, HORSE_PATTERN_MAX, HORSE_LEGS_MAX, HORSE_SEED_MAX], [6, 4, 2, 65535]);
  assert.equal(HORSE_LOOK_CODE_MAX, 7 * 5 * 3 * 65536 - 1);
  assert.equal(HORSE_LOOK_MAX, HORSE_LOOK_CODE_MAX, 'the relay keeps exactly the looks the law makes (wire.js imports none of the game)');
  for (const [field, max] of [['horseCoat', 6], ['horsePattern', 4], ['horseLegs', 2], ['horseSeed', 65535]]) {
    assert.equal(validItemField(field, max), max, field); assert.equal(validItemField(field, max + 1), undefined, field);
    assert.equal(validItemField(field, 0), undefined, `${field}: its first is never written - the field is dropped`);
  }
  const l = { coat: 4, pattern: 2, legs: 1, seed: 40000 };
  assert.equal(horseLookCode(l), 4 + 7 * (2 + 5 * (1 + 3 * 40000)));
  assert.deepEqual(horseLookOfCode(horseLookCode(l)), l);
  assert.deepEqual(horseLookOfCode(HORSE_LOOK_CODE_MAX), { coat: 6, pattern: 4, legs: 2, seed: 65535 });
  assert.deepEqual(horseLookOfCode(HORSE_LOOK_CODE_MAX + 1), { coat: 0, pattern: 0, legs: 0, seed: 0 }, 'past the law: the bay as drawn');
  assert.deepEqual(readHorseLook({ coat: 9, pattern: -1, legs: 2.5, seed: 70000 }), { coat: 0, pattern: 0, legs: 0, seed: 0 });
  assert.equal(lookSuffix(0), ''); assert.equal(lookSuffix(code(2)), '~2'); assert.equal(lookSuffix(l), `~${horseLookCode(l)}`);
  assert.deepEqual([code(0), code(2, 1, 1), code(3, 3, 2), code(4, 2), code(1, 4)].map(describeHorseLook),
    ['bay', 'black pinto with socks', 'dapple grey with stockings', 'dun appaloosa', 'chestnut roan']);
});

test('COATS1 the birth: a horse with no seed is born its own look, in place; a born horse is left alone; every coat, pattern and legs is a birth\'s', () => {
  const ridden = horseItem(), second = horseItem(), born = horseItem({ horseCoat: 2, horseSeed: 7 }), cart = cartItem();
  const items = [cart, ridden, second, born];
  // the first: coat .99 (the palomino, the last), pattern .3 (solid: the first 6 of 12), legs .85 (stockings: past 8 of
  // 10), seed .5; the second: coat 0 (the bay), pattern .7 (appaloosa: past 8 of 12), legs .55 (socks: past 5), seed 0
  const n = birthHorses(items, answers(0.99, 0.3, 0.85, 0.5, 0, 0.7, 0.55, 0));
  assert.equal(n, 2, 'both unborn horses');
  assert.equal(items[1], ridden, 'the same object - an open window\'s hold on it is still good');
  assert.deepEqual(horseLookOf(ridden), { coat: 6, pattern: 0, legs: 2, seed: 1 + Math.floor(0.5 * HORSE_SEED_MAX) });
  assert.equal('horsePattern' in ridden, false, 'a list\'s first is never written');
  assert.deepEqual(horseLookOf(second), { coat: 0, pattern: 2, legs: 1, seed: 1 });
  assert.deepEqual(horseLookOf(born), { coat: 2, pattern: 0, legs: 0, seed: 7 }, 'born before: untouched');
  assert.deepEqual(cart, cartItem(), 'a cart is no horse');
  assert.equal(birthHorses(items, answers(0.1)), 0, 'once born, born');
  assert.equal(birthHorses(null), 0);
  const seen = { coat: new Set(), pattern: new Set(), legs: new Set() };
  for (let i = 0; i < 400; i++) { const r = rollHorseLook(); for (const k of Object.keys(seen)) seen[k].add(r[k]); assert.ok(r.seed >= 1 && r.seed <= HORSE_SEED_MAX); }
  assert.deepEqual([seen.coat.size, seen.pattern.size, seen.legs.size], [7, 5, 3]);
  assert.deepEqual([BIRTH_WEIGHTS.coat.length, BIRTH_WEIGHTS.pattern.length, BIRTH_WEIGHTS.legs.length], [7, 5, 3]);
});

test('COATS1 the Stable\'s choices: the coat, the pattern and the legs are the owner\'s to change; the seed - the horse - never', () => {
  const items = [cartItem(), horseItem({ horseCoat: 4, horseSeed: 321 }), horseItem({ horseSeed: 9 })];
  assert.equal(activeHorseItem(items), items[1]);
  assert.equal(riddenHorseLook(items), code(4, 0, 0, 321)); assert.equal(riddenHorseLook([]), 0);
  const before = items[1];
  assert.deepEqual(restyleRiddenHorse(items, 'pattern', 1), { ok: true, text: 'Your horse is now a dun pinto.' });
  assert.notEqual(items[1], before, 'a new object in its place'); assert.equal(before.horsePattern, undefined, 'the old one untouched');
  assert.deepEqual(restyleRiddenHorse(items, 'legs', 2), { ok: true, text: 'Your horse is now a dun pinto with stockings.' });
  assert.deepEqual(restyleRiddenHorse(items, 'coat', 0), { ok: true, text: 'Your horse is now a bay pinto with stockings.' });
  assert.equal('horseCoat' in items[1], false, 'the bay drops the field');
  assert.equal(items[1].horseSeed, 321, 'the seed is the horse');
  assert.equal(items[2].horsePattern, undefined, 'the second horse is not the ridden one');
  assert.deepEqual(restyleRiddenHorse([cartItem()], 'coat', 2), { ok: false, text: 'You do not own a horse.' });
  assert.equal(restyledHorse(horseItem(), 'seed', 3), null, 'the seed is no choice');
  assert.equal(restyledHorse(cartItem(), 'coat', 2), null);
  const rows = horseLookRows([horseItem({ horseCoat: 5, horsePattern: 3, horseLegs: 1, horseSeed: 2 })]);
  assert.equal(rows.desc, 'dapple buckskin with socks');
  assert.deepEqual(rows.rows.map((r) => [r.part, r.name, r.current, r.choices.length]), [['coat', 'Coat', 5, 7], ['pattern', 'Pattern', 3, 5], ['legs', 'Legs', 1, 3]]);
  assert.deepEqual(rows.rows[1].choices, ['Solid', 'Pinto', 'Appaloosa', 'Dapples', 'Roan']);
  assert.equal(horseLookRows([cartItem()]), null);
  assert.deepEqual(HORSE_LOOK_PARTS.map((p) => p.field), ['horseCoat', 'horsePattern', 'horseLegs']);
  for (const f of ['horseCoat', 'horsePattern', 'horseLegs', 'horseSeed']) assert.ok(itemFindings(cartItem({ [f]: 1, value: 150 })).includes('horse'), `${f} on a cart is the law's finding`);
  assert.ok(!itemFindings(horseItem({ horseCoat: 2, horsePattern: 1, horseLegs: 2, horseSeed: 5, value: 1000 })).includes('horse'));
});

// ── the dye, on a picture the test draws: a big bay body, a rider's face apart from it, a saddle, a black mane
const RGBA = (w, h) => new Uint8Array(w * h * 4);
function put(px, w, x, y, rgba) { px.set(rgba, (y * w + x) * 4); }
const HIDE = [130, 70, 35, 255], FACE = [200, 120, 80, 255], TACK = [110, 85, 55, 255], MANE = [30, 30, 32, 255];
function drawn() {
  const w = 40, h = 20, px = RGBA(w, h);
  for (let y = 4; y < 16; y++) for (let x = 2; x < 30; x++) put(px, w, x, y, HIDE);      // the body: 336 pixels
  for (let x = 10; x < 14; x++) put(px, w, x, 4, TACK);                                   // the saddle on its edge
  for (let y = 0; y < 3; y++) put(px, w, 2, y, MANE);                                     // the mane
  put(px, w, 36, 1, FACE); put(px, w, 37, 1, FACE);                                       // a face, apart from it
  return { width: w, height: h, colors: px };
}
/** A wide flat hide, for the patterns: 120 x 60 of HIDE. */
function flank() {
  const w = 120, h = 60, px = RGBA(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(px, w, x, y, HIDE);
  return { width: w, height: h, colors: px };
}
const at = (img, x, y) => [...new Uint8Array(img.colors.buffer, img.colors.byteOffset, img.colors.byteLength).subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const bytes = (img) => new Uint8Array(img.colors.buffer, img.colors.byteOffset, img.colors.byteLength);
const whiteish = (img, x, y) => { const [r, g, b] = at(img, x, y); return Math.max(r, g, b) - Math.min(r, g, b) <= 12 && Math.min(r, g, b) >= 100; };

test('COATS1 the dye: the hide is the warm, coloured, non-leather pixels; the tack, the mane and steel are not', () => {
  assert.equal(isCoatPixel(...HIDE.slice(0, 3)), true);
  assert.equal(isCoatPixel(...FACE.slice(0, 3)), true, 'a face is warm too - the regions tell it apart, not the pixel');
  assert.equal(isCoatPixel(...TACK.slice(0, 3)), false, 'the saddle\'s leather');
  assert.equal(isCoatPixel(...MANE.slice(0, 3)), false, 'the mane');
  assert.equal(isCoatPixel(120, 120, 130), false, 'steel');
  assert.equal(isCoatPixel(40, 120, 40), false, 'green cloth');
  assert.equal(isCoatPixel(...TACK.slice(0, 3), false), true, 'where no saddle is drawn (the riding sprite), the leather band is the neck\'s own shadow');
});

test('COATS1 the dye: the body takes the coat, the face apart from it, the saddle and the mane keep theirs; the bay as drawn is no pass', () => {
  const img = drawn();
  assert.equal(recolorHorse(img, 0), img, 'code 0: the picture itself');
  assert.equal(recolorHorse(img, HORSE_LOOK_CODE_MAX + 1), img, 'a look the law does not know: the bay as drawn');
  const black = recolorHorse(img, code(2));
  assert.notEqual(black, img); assert.notEqual(black.colors, img.colors);
  assert.deepEqual(at(img, 5, 8), HIDE, 'the source untouched');
  // HIDE is h 21.8, s .731, v .510: black is hue 25, s .14 * min(1, .731/.6 + .3), v 0 + .45 * .510
  assert.deepEqual(at(black, 5, 8), [59, 54, 50, 255]);
  assert.deepEqual(at(black, 11, 4), TACK, 'the saddle');
  assert.deepEqual(at(black, 2, 1), MANE, 'the mane');
  assert.deepEqual(at(black, 36, 1), FACE, 'the rider\'s face: a region under COAT_REGION_SHARE of the body');
  assert.deepEqual(at(black, 39, 19), [0, 0, 0, 0], 'the clear stays clear');
  // chestnut multiplies the art's own saturation (the 'mul' arm) - hue 13, s .731 * 1.12, v .05 + 1.05 * .510
  assert.deepEqual(at(recolorHorse(img, code(1)), 5, 8), [149, 54, 27, 255]);
  // a leg the shading cut off the body is still the horse's: 12 pixels against the body's 336 is over 3 %
  const leg = drawn();
  for (let y = 17; y < 20; y++) for (let x = 2; x < 6; x++) put(leg.colors, leg.width, x, y, HIDE);
  assert.ok(12 / 336 >= COAT_REGION_SHARE);
  assert.deepEqual(at(recolorHorse(leg, code(2)), 3, 18), [59, 54, 50, 255]);
});

test('COATS1 the dye: a dark speck the outline cut off the hide is the hide\'s shadow; a lit one apart from it is not', () => {
  const img = drawn();
  const SHADOW = [60, 32, 16, 255];
  assert.ok(60 / 255 < COAT_SHADOW_VALUE && COAT_SHADOW_REACH === 2);
  put(img.colors, img.width, 31, 8, SHADOW);   // a pixel past the body's edge at x 29: within COAT_SHADOW_REACH
  put(img.colors, img.width, 35, 12, SHADOW);   // and one six pixels off: no one's
  put(img.colors, img.width, 31, 12, FACE);   // a lit speck as near: a rider's
  const black = recolorHorse(img, code(2));
  assert.notDeepEqual(at(black, 31, 8), SHADOW, 'the shadow beside the hide is dyed');
  assert.deepEqual(at(black, 35, 12), SHADOW, 'one further off is not');
  assert.deepEqual(at(black, 31, 12), FACE, 'nor a lit speck, however near');
});

test('COATS1 the seed: one horse is one picture, every time; two horses of one coat are two shades of it, within SHADE_HUE and SHADE_VALUE', () => {
  const img = drawn();
  assert.deepEqual(bytes(recolorHorse(img, code(1, 0, 0, 77))), bytes(recolorHorse(img, code(1, 0, 0, 77))));
  assert.notDeepEqual(at(recolorHorse(img, code(1, 0, 0, 77)), 5, 8), at(recolorHorse(img, code(1, 0, 0, 78)), 5, 8));
  assert.deepEqual(shadeOf(0), [0, 1], 'no seed, no shade');
  for (let s = 1; s < 300; s++) { const [h, v] = shadeOf(s); assert.ok(Math.abs(h) <= SHADE_HUE && Math.abs(v - 1) <= SHADE_VALUE); }
  // the bay with a seed is its own shade of the art's own hue: no coat's hue forced on it
  const bay = at(recolorHorse(img, code(0, 0, 0, 5)), 5, 8);
  assert.notDeepEqual(bay, HIDE); assert.ok(bay[0] > bay[1] && bay[1] > bay[2], 'still a warm brown');
});

test('COATS1 the patterns: pinto patches, appaloosa spots, soft dapples and roan flecks - each its own per seed, never a circle, laid on the hide alone', () => {
  const img = flank();
  const share = (out) => { let n = 0; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (whiteish(out, x, y)) n++; return n / (img.width * img.height); };
  const pinto = recolorHorse(img, code(1, 1, 0, 11));
  assert.ok(share(pinto) > 0.15 && share(pinto) < 0.85, `pinto: broad white and colour both (${share(pinto).toFixed(2)})`);
  assert.notDeepEqual(bytes(pinto), bytes(recolorHorse(img, code(1, 1, 0, 12))), 'another seed, other patches');
  for (const seed of [11, 12, 13, 14]) {   // leopards and snowflakes: white and colour both, either way
    const app = share(recolorHorse(img, code(2, 2, 0, seed)));
    assert.ok(app > 0.01 && app < 0.99, `appaloosa ${seed}: spots (${app.toFixed(2)})`);
  }
  const solid = recolorHorse(img, code(1, 0, 0, 21)), dapple = recolorHorse(img, code(1, 3, 0, 21));
  let lighter = 0, darker = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const a = at(solid, x, y)[2], b = at(dapple, x, y)[2];
    if (b > a + 8) lighter++; else if (b < a - 2) darker++;
  }
  assert.ok(lighter > 200 && darker > 200, `dapples: lighter blots (${lighter}), the coat a shade darker between (${darker})`);
  // and no line drawn between them: a dapple is soft - no pixel darker than the coat by more than DAPPLE's own shade
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) assert.ok(at(dapple, x, y)[0] >= at(solid, x, y)[0] * 0.8, 'no dark net');
  let flecked = 0;
  const plain = recolorHorse(img, code(0, 0, 0, 31)), roan = recolorHorse(img, code(0, 4, 0, 31));
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (at(roan, x, y)[2] > at(plain, x, y)[2] + 30) flecked++;
  const f = flecked / (img.width * img.height);
  assert.ok(f > 0.25 && f < 0.5, `roan: a third or so of the hairs white (${f.toFixed(2)})`);
  // the markings are the hide's alone: the saddle, the mane and the face of the drawn picture keep theirs under every pattern
  for (const p of [1, 2, 3, 4]) {
    const out = recolorHorse(drawn(), code(2, p, 2, 99));
    assert.deepEqual([at(out, 11, 4), at(out, 2, 1), at(out, 36, 1)], [TACK, MANE, FACE], HORSE_PATTERNS[p]);
  }
});

test('COATS1 the legs: socks and stockings climb from the hooves - the picture\'s bottom, whichever way its rows run; none where no hoof is drawn', () => {
  const img = flank();   // 60 rows: socks the lowest 6 (0.1), stockings the lowest 12 (0.2), their tops ragged by up to a fifth
  const rowWhite = (out, y) => { let n = 0; for (let x = 0; x < img.width; x++) if (whiteish(out, x, y)) n++; return n / img.width; };
  const socks = recolorHorse(img, code(1, 0, 1, 5));   // bottomFirst: row 0 is the hooves
  assert.equal(rowWhite(socks, 0), 1); assert.equal(rowWhite(socks, 3), 1);
  assert.equal(rowWhite(socks, 8), 0, 'above the sock\'s highest ragged top');
  assert.equal(rowWhite(socks, 59), 0, 'the back is the coat');
  const stockings = recolorHorse(img, code(1, 0, 2, 5));
  assert.equal(rowWhite(stockings, 9), 1); assert.equal(rowWhite(stockings, 15), 0);
  const topFirst = recolorHorse(img, code(1, 0, 1, 5), { bottomFirst: false });
  assert.equal(rowWhite(topFirst, 59), 1); assert.equal(rowWhite(topFirst, 0), 0, 'rows top first: the hooves are the last row');
  const head = recolorHorse(img, code(1, 0, 2, 5), { legs: false });
  assert.equal(rowWhite(head, 0), 0, 'the riding sprite\'s lower edge is its neck');
});

test('COATS1 the dye, on the mod\'s own horse: the flank goes grey, the saddle stays leather, the mane stays black', () => {
  const raw = PNG.sync.read(readFileSync(new URL('../../../vendor/horse-cart-and-cargo/Textures/horse3.png', import.meta.url)));
  const img = { width: raw.width, height: raw.height, colors: raw.data };
  const grey = recolorHorse(img, code(3));
  let hide = 0, greyed = 0, tack = 0, tackKept = 0, dark = 0, darkKept = 0, leather = 0, leatherKept = 0;
  const a = new Uint8Array(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), b = bytes(grey);
  for (let i = 0; i < raw.width * raw.height; i++) {
    const o = i * 4;
    if (!a[o + 3]) continue;
    const [r, g, bl] = [a[o], a[o + 1], a[o + 2]];
    const max = Math.max(r, g, bl), min = Math.min(r, g, bl), s = max ? (max - min) / max : 0;
    const same = b[o] === r && b[o + 1] === g && b[o + 2] === bl;
    if (isCoatPixel(r, g, bl, false) && !isCoatPixel(r, g, bl, true)) { leather++; if (same) leatherKept++; }   // AUDIT COATS3D A13: the tack rule's own pixels, warm hide but for it
    if (isCoatPixel(r, g, bl)) { hide++; if (Math.max(b[o], b[o + 1], b[o + 2]) - Math.min(b[o], b[o + 1], b[o + 2]) <= 12) greyed++; }
    else if (s >= 0.2) { tack++; if (same) tackKept++; }
    else { dark++; if (same) darkKept++; }
  }
  assert.ok(hide > 2000 && hide < 2300, `the hide is most of the horse, and no more of it (${hide} - the saddle counted in would pass 2300)`);
  assert.ok(greyed / hide > 0.96, `nearly all of it greyed (${greyed}/${hide} - the rest are lit specks too small to be the horse)`);
  assert.ok(tack > 20 && tackKept === tack, 'every warm pixel the hide is not (the saddle, the bridle) kept');
  assert.equal(darkKept, dark, 'the mane, the tail and the hooves kept');
  // AUDIT COATS3D A13: the two above hold by construction (both sets are the gate's own complement) - these do not: the
  // leather the tack rule spares (a dye that dropped the rule would grey it), and the mane's whole count
  assert.ok(leather >= 150 && leatherKept === leather, `the saddle's leather the tack rule spares, every pixel of it kept (${leatherKept}/${leather})`);
  assert.ok(dark >= 1000, `the mane, tail and hooves are a thousand pixels (${dark}) - none taken into the hide`);
});

test('COATS1 the dye: the shape in is the shape out - a Uint32Array stays one, a Uint8ClampedArray stays one', () => {
  const img = drawn();
  const u32 = recolorHorse({ ...img, colors: new Uint32Array(img.colors.buffer) }, code(3, 1, 1, 4));
  assert.ok(u32.colors instanceof Uint32Array); assert.equal(u32.colors.length, img.width * img.height);
  const clamped = recolorHorse({ ...img, colors: new Uint8ClampedArray(img.colors.buffer) }, code(3, 1, 1, 4));
  assert.ok(clamped.colors instanceof Uint8ClampedArray); assert.equal(clamped.colors.length, img.width * img.height * 4);
  assert.deepEqual(at(u32, 5, 8), at(clamped, 5, 8));
});

test('COATS1 the pool\'s word: `hc` the look beside the name, for the horse standing and the team in the shafts; a look past the law\'s is a bay, never a dropped word', () => {
  const look = code(5, 2, 1, 4321);
  const view = { wagon: null, horse: { position: [1, 0, 2], forward: [0, 0, 1], walking: false }, name: 'Bess', look };
  const rec = hccWireRecord(view);
  assert.equal(rec.hc, look); assert.equal(rec.n, 'Bess');
  assert.equal(hccWireRecord({ ...view, look: 0 }).hc, undefined, 'the bay as drawn is never said');
  const team = hccWireRecord({ wagon: { kind: HCC_WIRE_KIND.Trailing, position: [0, 0, 0], rotation: [0, 0, 0, 1], tier: 0, angle: 0 }, horse: null, look });
  assert.equal(team.hc, look, 'the driven team wears it, though no horse stands');
  assert.equal(hccWireRecord({ wagon: null, horse: null, look, go: null }), null, 'nothing standing, no word');
  assert.equal(validHccRecord(rec).hc, look);
  const past = validHccRecord({ ...rec, hc: HORSE_LOOK_CODE_MAX + 1 });
  assert.ok(past && past.h, 'the word stands'); assert.equal(past.hc, undefined);
  assert.equal(validHccRecord({ ...rec, hc: 'black' }).hc, undefined);
  assert.notEqual(hccRecordKey(rec), hccRecordKey({ ...rec, hc: 1 }), 'a look chosen is a word that moved');
});

test('COATS1 the parked word: the cell keeps its horses\' look, and forgets anything else as a bay', () => {
  const r = { h: [10, 0, 10, 0, 1, 0], hc: HORSE_LOOK_MAX };
  assert.equal(validParkData({ c: 'char-0001', a: [10, 10], r }).r.hc, HORSE_LOOK_MAX);
  for (const bad of [HORSE_LOOK_MAX + 1, 0, 2.5, -3]) assert.equal(validParkData({ c: 'char-0001', a: [10, 10], r: { ...r, hc: bad } }).r.hc, undefined, String(bad));
});

test('COATS1 the pose: `rc` the look rides a mounted pose only, omitted for the bay, a look past the law\'s a bay (never clamped into another horse); a look chosen in the saddle goes out at once', () => {
  const base = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 };
  const look = code(3, 1, 2, 999);
  assert.equal(validPose({ ...base, rd: POSE_RIDE.Horse, rv: 1, rc: look }).rc, look);
  assert.equal('rc' in validPose({ ...base, rd: POSE_RIDE.Horse, rv: 1, rc: 0 }), false, 'the bay: the bytes a pose always had');
  assert.equal('rc' in validPose({ ...base, rd: 0, rc: look }), false, 'on foot, no horse');
  assert.equal('rc' in validPose({ ...base, rd: POSE_RIDE.Horse, rc: HORSE_LOOK_MAX + 1 }), false);
  assert.equal('rc' in validPose({ ...base, rd: POSE_RIDE.Horse, rc: 4.5 }), false);
  const a = validPose({ ...base, rd: POSE_RIDE.Horse, rv: 1 }), b = validPose({ ...base, rd: POSE_RIDE.Horse, rv: 1, rc: look });
  assert.equal(poseChanged(a, b), true);
});

test('COATS1 the rider: a mounted table\'s sprite wears the look under its own record; on foot there is none', () => {
  const look = code(3, 2, 1, 50);
  const bay = spriteFor('IdleHorse', 0, 0, { onHorse: 1 });
  const dyed = spriteFor('IdleHorse', 0, 0, { onHorse: 1, horse: look });
  assert.equal(dyed.key, bay.key, 'the same picture fetched');
  assert.equal(dyed.rec, `${bay.rec}~${look}`); assert.equal(dyed.horse, look); assert.equal(bay.horse, 0);
  assert.equal(spriteFor('Idle', 0, 0, { onFoot: 0, horse: look }).horse, 0, 'on foot the look is no one\'s');
  const img = drawn();
  assert.equal(lookedPixels(bay, img), img);
  assert.deepEqual(bytes(lookedPixels(spriteFor('IdleHorse', 0, 0, { horse: code(2) }), img)), bytes(recolorHorse(img, code(2))));
});

test('COATS1 the riding sprite: the horse\'s frames dyed under their own record, no leg whitened along the neck; the cart\'s never; a look left behind let go', async () => {
  const look = code(4, 1, 2, 8);
  assert.equal(ridingLook(TRANSPORT_MODES.Horse, look), look);
  assert.equal(ridingLook(TRANSPORT_MODES.Cart, look), 0, 'MRED01I0\'s boards are the hide\'s brown');
  assert.equal(ridingLook(TRANSPORT_MODES.Horse, HORSE_LOOK_CODE_MAX + 1), 0);
  const src = readFileSync(new URL('../../../src/systems/riding.js', import.meta.url), 'utf8');
  assert.match(src, /recolorHorse\(frameToColor32\(cfa\.getDFBitmap\(0, f\), palette, null\), c, \{ bottomFirst: false, legs: false, tack: false \}\)/, 'each frame dyed before its upload - its lower edge no hoof, no saddle to spare');
  assert.match(src, /records\.push\(`ride:\$\{fileName\}:\$\{f\}\$\{lookSuffix\(c\)\}`\)/, 'under its look\'s record');
  await assert.rejects(loadRidingArt(async () => { throw new Error('no ARENA2'); }, null, { uploadTexture: () => {} }, TRANSPORT_MODES.Horse, look), 'no art, no riding sprite: a refusal the rig logs');
  const rig = readFileSync(new URL('../../../src/player/mountRig.js', import.meta.url), 'utf8');
  assert.match(rig, /riddenHorseLook\(playerEntity\?\.items \?\? \[\]\)/, 'the ridden horse\'s look');
  assert.match(rig, /renderer\?\.evictTexture\?\.\(`img_\$\{rec\}`\)/, 'a look left behind is let go');
  assert.match(rig, /if \(id !== _req\) \{ if \(a\.look !== art\?\.look && a\.look !== _lastArt\?\.look && a\.look !== lookNow\(mode\)\) letGo\(a\); return; \}/, 'and a load overtaken by a newer one is never drawn - its look let go unless worn, or the newest load\'s own (AUDIT COATS3D A10: the same records, one handle a key)');
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };

function poolWith(look) {
  const uploads = [], evicted = [], batches = [];
  const renderer = {
    uploadTexture: (a, rec, px) => { uploads.push(`${a}_${rec}`); return px; },
    evictTexture: (k) => { evicted.push(k); return true; },
    createBillboardBatch: (archive, record) => { const b = { archive, record, origin: null }; batches.push(b); return b; },
    destroyBillboardBatch() {}, createMesh: () => ({}),
  };
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4).fill(200) });
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), decode, horseLook: () => look.v });
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: { isInteractive: true, position: [0, 0, 5], forward: [0, 0, 1], walk: { animationFrame: 0, walking: false } }, teamFollowing: false, horseFollowing: false, persistence: true }), lateUpdate() {}, rebase() {} });
  return { pool, uploads, evicted, batches };
}

/** PERF-DYE: the frames a look's every picture takes to be dyed, HORSE_DYE_PICTURES a frame (the views, then the walk set). */
const FRAMES_A_LOOK = Math.ceil(HORSE_VIEWS * (1 + HORSE_WALK_FRAMES) / HORSE_DYE_PICTURES);

test('COATS1 the pool: my horse posed in my look once its pictures are dyed - PERF-DYE: HORSE_DYE_PICTURES a frame, each once - the bay\'s until', async () => {
  const look = { v: code(4, 1, 1, 77) };
  const { pool, uploads, batches } = poolWith(look);
  assert.equal(pool.presentation.horseArt.ensureLook(look.v), false, 'nothing until the bay is up');
  await flush();
  pool.presentation.horseArt.ensureWalk(); await flush();
  pool.frame(0, [0, 1, 0]);
  const mine = batches.find((b) => b.archive === HORSE_ARCHIVE);
  assert.ok(mine, 'my horse stands');
  assert.doesNotMatch(mine.record, /~/, 'the views dyed this frame, so the walking horse is still the bay\'s');
  assert.ok(uploads.includes(`${HORSE_ARCHIVE}_${horseStillRecord(2, look.v)}`) && !uploads.includes(`${HORSE_ARCHIVE}_${horseWalkRecord(1, 3, look.v)}`));
  for (let i = 2; i < FRAMES_A_LOOK; i++) pool.frame(0, [0, 1, 0]);
  assert.doesNotMatch(mine.record, /~/, 'PERF-DYE: the walk set a few pictures a frame - the bay\'s until its last');
  pool.frame(0, [0, 1, 0]);
  assert.ok(mine.record.endsWith(`~${look.v}`), 'posed in my look once its walk frames are dyed too');
  const n = uploads.length;
  pool.frame(0, [0, 1, 0]);
  assert.equal(uploads.length, n, 'dyed once, not every frame');
  assert.equal(pool.shown().look, look.v, 'my word says it');
  pool.faceTeams([3, 1, 0]);
  assert.ok(mine.record.endsWith(`~${look.v}`), 'AUDIT COATS3D A1: turned to the eye that draws it (faceTeams, every frame after frame()) - still in my look, never the bay\'s');
  look.v = 0; pool.frame(0, [0, 1, 0]);
  assert.doesNotMatch(mine.record, /~/, 'the bay as drawn: the art\'s own record');
});

test('COATS1 the pool: past HORSE_LOOKS_KEPT looks, the one longest undrawn is let go - every picture of it, never one drawn now', async () => {
  const look = { v: code(1, 0, 0, 1) };
  const { pool, evicted } = poolWith(look);
  pool.presentation.horseArt.ensureStationary(); await flush();
  pool.presentation.horseArt.ensureWalk(); await flush();
  for (let s = 1; s <= HORSE_LOOKS_KEPT; s++) { look.v = code(1, 0, 0, s); for (let i = 0; i < FRAMES_A_LOOK; i++) pool.frame(0, [0, 1, 0]); }
  assert.equal(evicted.length, 0, 'HORSE_LOOKS_KEPT looks stand together');
  look.v = code(1, 0, 0, HORSE_LOOKS_KEPT + 1);
  for (let i = 0; i < 3; i++) pool.frame(0, [0, 1, 0]);
  const first = code(1, 0, 0, 1);
  assert.ok(evicted.includes(`${HORSE_ARCHIVE}_${horseStillRecord(0, first)}`) && evicted.includes(`${HORSE_ARCHIVE}_${horseWalkRecord(4, 7, first)}`), 'the first look\'s views and walk frames');
  assert.ok(evicted.every((k) => k.endsWith(`~${first}`)), 'that look alone');
});

// PIN MOVED (AUDIT FB1022d D1): a look is let go by the store's once-a-frame sweep (createEotbArt sweep, the riders'
// settle), never inside a draw - so each ensure here is a frame, swept
test('COATS1 the others\' riders: each rider\'s horse look is its own dyed pictures, let go once RIDER_LOOKS_KEPT others were drawn since', async () => {
  const evicted = [], uploads = [];
  let now = 0;
  const art = createEotbArt({
    renderer: { uploadTexture: (a, rec) => uploads.push(`${a}_${rec}`), evictTexture: (k) => evicted.push(k) },
    urlFor: () => 'x.png', decode: async () => ({ width: 4, height: 4, colors: new Uint8Array(64).fill(200) }), clock: () => now,
  });
  const sprite = (look) => spriteFor('IdleHorse', 0, 0, { onHorse: 0, horse: look });
  for (let s = 1; s <= RIDER_LOOKS_KEPT; s++) { art.ensure(sprite(code(2, 1, 0, s))); art.sweep(); now += RIDER_LOOK_IDLE_MS + 1; }
  await flush();
  assert.equal(uploads.length, RIDER_LOOKS_KEPT); assert.equal(evicted.length, 0);
  art.ensure(sprite(code(2, 1, 0, 999)));
  assert.equal(evicted.length, 0, 'never inside a draw');
  art.sweep();
  const first = sprite(code(2, 1, 0, 1));
  assert.deepEqual(evicted, [`${first.archive}_${first.rec}`], 'the look longest undrawn');
  assert.equal(art.ensure(first), null, 'asked again, fetched again');
});

test('COATS1 the road\'s strangers: a horse keeps the look its key gives it - born by the odds, on one of STRANGER_SEEDS seeds', () => {
  assert.equal(strangerHorseLook('trip7:h0'), strangerHorseLook('trip7:h0'));
  const coats = new Set(), patterns = new Set(), seeds = new Set();
  for (let i = 0; i < 3000; i++) { const l = horseLookOfCode(strangerHorseLook(`trip${i}:h0`)); coats.add(l.coat); patterns.add(l.pattern); seeds.add(l.seed); }
  assert.equal(coats.size, 7); assert.equal(patterns.size, 5);
  assert.deepEqual([...seeds].sort((a, b) => a - b), Array.from({ length: STRANGER_SEEDS }, (_, i) => i + 1), 'a few seeds, so the road shares its dyed pictures');
  const src = readFileSync(new URL('../../../src/world/road/roadTeams.js', import.meta.url), 'utf8');
  assert.match(src, /look: strangerHorseLook\(h\.key\)/, 'the road\'s horse is given its look off its key');
  assert.match(src, /pres\.poseHorse\(s\.batch, eye, \{[^}]*\}, 1, s\.look\)/, 'and posed in it');
});

test('COATS1 the Stable: the horse born before the card reads it; a row a part, the ridden horse restyled on a press; the host told', () => {
  const items = [horseItem()];
  let told = 0;
  const p = stableProviderFor({ runtime: { stableView: () => null }, on: () => false, hasHorse: () => true, hasCart: () => false, items: () => items, onPainted: () => told++ });
  const m = p.stable();
  assert.ok(items[0].horseSeed >= 1, 'born');
  assert.deepEqual(m.look.rows.map((r) => r.part), ['coat', 'pattern', 'legs']);
  assert.equal(m.look.desc, describeHorseLook(horseLookOf(items[0])));
  const seed = items[0].horseSeed;
  assert.equal(p.stableAct('coat', 6).ok, true); assert.equal(p.stableAct('pattern', 2).ok, true); assert.equal(p.stableAct('legs', 1).ok, true);
  assert.deepEqual(horseLookOf(items[0]), { coat: 6, pattern: 2, legs: 1, seed });
  assert.equal(told, 3);
  assert.equal(p.stable().look.desc, 'palomino appaloosa with socks');
  const none = stableProviderFor({ runtime: {}, on: () => false, hasHorse: () => false, hasCart: () => false, items: () => [], onPainted: () => told++ });
  assert.equal(none.stable().look, null);
  assert.equal(none.stableAct('coat', 2).ok, false); assert.equal(told, 3, 'nothing to tell');
});

test('COATS1 the wiring: both exterior hosts bear the horses each frame; the rig\'s record carries the look to the body, the pose to the others, the pool\'s seam to both pools', () => {
  const rd = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) assert.match(rd(host), /const hccTick = \(dt, nowMs\) => \{\n {4}birthHorses\(playerEntity\.items\);/, host);
  assert.match(rd('combat/weapon/weaponRig.js'), /horseLook: entity \? riddenHorseLook\(entity\.items \?\? \[\]\) : 0/);
  assert.match(rd('player/eyeOfTheBeholder/eotbBody.js'), /horse: last\.horseLook \?\? 0/);
  assert.match(rd('player/eyeOfTheBeholder/eotbBody.js'), /lookedPixels\(s, img\)/);
  assert.match(rd('player/eyeOfTheBeholder/eotbBody.js'), /renderer\?\.evictTexture\?\.\(k\.replace\(':', '_'\)\)/, 'a look left behind on my own rider is let go');
  assert.match(rd('net/peer/peerRiders.js'), /horse: pose\.rc \| 0/);
  assert.match(rd('net/peer/peerRiders.js'), /lookedPixels\(s, raw\)/);
  assert.match(rd('scenes/world.js'), /rc: riding \? riddenHorseLook\(playerEntity\.items \?\? \[\]\) \|\| undefined : undefined/);
  assert.match(rd('world/wagonModels.js'), /horseLook: \(\) => riddenHorseLook\(items\(\)\)/, 'THE ONE CONSTRUCTION SEAM: both hosts\' pools');
  assert.match(rd('scenes/world.js'), /horseArt: \(look = 0\) => !!hcc\.presentation\.horseArt\.ensureLook\(look\)/, 'the town watch\'s throw in its look');
});
