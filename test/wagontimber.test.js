// WAGON-TIMBER (2026-10-16, Mac, of the wagon's wood and of its wheels: "Ok so there is a separation of all the wooden
// parts which is cool. Lets make a selector for each of them and send them over the wire using the same system that
// already exists"; "I want the wheel options to be separate from the wood options"; "Add a few more options for the wheels
// as well which I know are editable via hex color codes so come up with a few discrete options: couple different browns, a
// reddish one and a grey one if possible") - THE WAGON'S FOUR WOODEN PARTS AND ITS WHEELS GET A CHOICE EACH - the law
// (`src/systems/wagonTimber.js`), the art (`src/world/wagonArt.js` WOOD_DYES / WHEEL_FINISHES over the painted
// pictures), and the one shared dye (`src/systems/horse/horseCoats.js` dyeEveryTexel).
//
// WHAT IS PINNED, AND WHY NONE OF IT IS A PICTURE. No wagon texel is compared with a stored image here: what these pins
// hold is the law of the choice - which record each choice wears, that no two choices anywhere wear the same one, that
// the wheels answer to their own table and never to the wood's, that the dye is a SHIFT (the grain survives it) and not
// a fill, that choice 0 is the wagon that shipped. The colour itself is the rider's eye; the arithmetic under it is a
// pin on a number.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIMBER_CHOICES, TIMBER_PARTS, TIMBER_FIELDS, TIMBER_LOOKS, WHEEL_LOOKS, TIMBER_LOOK_NAMES, TIMBER_PART_NAMES,
  readWagonTimber, isBuiltTimber, timberFieldsOf, wagonTimberOf, timberedWagon, timberRows, timberChoiceName,
} from '../src/systems/wagonTimber.js';
import { LOOK_COUNT, paintedWagon, wagonLookOf } from '../src/systems/wagon/wagonLooks.js';
import { newWagonItem } from '../src/systems/wagon/wagonKinds.js';
import { WAGON_LOOK_KEYS, validItemField } from '../src/systems/item/itemFields.js';
import {
  TEX, LOOK_RECORDS, LOOK_RECORD_STRIDE, lookRecord, TIMBER_LISTS, WOOD_DYES, WHEEL_FINISHES, K as WAGON_K,
  wagonLookArt, tyreArt, wheelArt,
} from '../src/world/wagonArt.js';
import { dyeEveryTexel } from '../src/systems/horse/horseCoats.js';
import { CARAVAN_LIVE_CHOICE } from '../src/scenes/caravanRoom.js';
import { C as FLEET } from '../src/world/ships/galleonArt.js';

const hash = (pic) => Buffer.from(pic.data).toString('base64');
/** An RGB triple as [hue degrees, saturation, value] - what "a reddish one" and "a grey" are asked in. */
const hsv = (c) => {
  const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  return { h: d === 0 ? 0 : (((Math.round(((g - b) / d) * 10) % 6) + 6) % 6) * 6, s: mx === 0 ? 0 : d / mx, v: mx };
};
/** How far two hues are round the wheel, in degrees (0..180). */
const hueApart = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const looksFor = (list) => (list === 'wheels' ? WHEEL_LOOKS : TIMBER_LOOKS);

test('WAGON-TIMBER THE LAW: one width for every part, the first the wagon as built, a choice checked and an unknown one the wagon as built; the item keeps its paint and drops a part put back; the rows the driven kind wears', () => {
  assert.equal(TIMBER_CHOICES, LOOK_COUNT, 'the two laws keep one width - the wire\'s digit is one digit');
  assert.equal(TIMBER_CHOICES, 6, 'and it is six still: WAGON-TIMBER grew no list');
  for (const [part, list] of Object.entries(TIMBER_LISTS)) {
    assert.equal(looksFor(list).length, TIMBER_CHOICES, `${part}: six`);
    assert.ok(LOOK_RECORDS[list], `${part}: a list the art answers for`);
    assert.equal(typeof TIMBER_PART_NAMES[part], 'string', `${part}: named`);
  }
  assert.deepEqual([...TIMBER_FIELDS], [...TIMBER_PARTS, 'wheels'], 'four parts and the wheels, and nothing else in the look');
  assert.deepEqual([...TIMBER_PARTS], ['floor', 'inner', 'beam', 'bench'], 'the four the operator named');
  assert.notDeepEqual(TIMBER_LOOKS, WHEEL_LOOKS, 'and the two families are not one list');
  for (const k of [...TIMBER_LOOKS, ...WHEEL_LOOKS]) assert.equal(typeof TIMBER_LOOK_NAMES[k], 'string', k);
  assert.equal(/ /.test(TIMBER_LOOK_NAMES[TIMBER_LOOKS[1]]), false, 'a dye\'s name is one word, so a player\'s language can route it');

  assert.deepEqual(readWagonTimber({ floor: 3, inner: -1, beam: 9, bench: 2.5, wheels: 4, o: 5 }), { floor: 3, inner: 0, beam: 0, bench: 0, wheels: 4 }, 'checked, and the paint\'s own fields read past');
  assert.deepEqual(readWagonTimber(null), { floor: 0, inner: 0, beam: 0, bench: 0, wheels: 0 });
  assert.deepEqual(readWagonTimber('nonsense'), { floor: 0, inner: 0, beam: 0, bench: 0, wheels: 0 });
  assert.equal(isBuiltTimber({ floor: 0, wheels: 0 }), true);
  assert.equal(isBuiltTimber({ wheels: 1 }), false);
  assert.deepEqual(timberFieldsOf({ o: 2, floor: 0, beam: 4 }), { beam: 4 }, 'the paint\'s fields are not this law\'s to carry');

  const wagon = newWagonItem('openWagon');
  assert.deepEqual(wagonTimberOf(wagon), readWagonTimber(null), 'a wagon as it was built');
  assert.deepEqual(wagonTimberOf({ templateIndex: 1 }), readWagonTimber(null), 'anything that is not a wagon');
  const dyed = timberedWagon(wagon, 'beam', 3);
  assert.deepEqual(dyed.wagonLook, { o: 0, w: 0, f: 0, c: 0, beam: 3 }, 'the field set, and the paint checked in beside it');
  assert.equal(wagon.wagonLook, undefined, 'the wagon it came from untouched');
  assert.deepEqual(timberedWagon(dyed, 'floor', 0).wagonLook, { o: 0, w: 0, f: 0, c: 0, beam: 3 }, 'one part put back, the rest kept');
  assert.deepEqual(timberedWagon(dyed, 'beam', 0), wagon, 'and the last one gone leaves the wagon as it was');
  assert.equal(timberedWagon(dyed, 'beam', 0).wagonLook, undefined);
  assert.equal(timberedWagon(dyed, 'keel', 1), null, 'a part this law does not know');
  assert.equal(timberedWagon({ templateIndex: 1 }, 'beam', 1), null, 'anything that is not a wagon');

  // THE PAINT SURVIVES A DYE, AND THE DYE SURVIVES A PAINT - one field, two laws, neither dropping the other's part
  const painted = paintedWagon(dyed, 'outside', 2);
  assert.deepEqual(painted.wagonLook, { o: 2, w: 0, f: 0, c: 0, beam: 3 }, 'a repaint of a dyed wagon keeps the beams');
  assert.deepEqual(timberedWagon(painted, 'wheels', 2).wagonLook, { o: 2, w: 0, f: 0, c: 0, beam: 3, wheels: 2 });
  assert.equal(wagonLookOf(timberedWagon(painted, 'wheels', 0)).o, 2, 'and the paint still reads back');
  assert.equal(paintedWagon(dyed, 'outside', 0).wagonLook.beam, 3, 'and painting it back as built does not un-dye it');
  assert.equal(timberedWagon(newWagonItem('cart'), 'floor', 1).wagonLook.floor, 1, 'a cart has a wooden floor too');
  assert.equal(paintedWagon(newWagonItem('cart'), 'walls', 1), null, 'and still no inside');

  const rows = timberRows([{ templateIndex: 2 }, dyed]);
  assert.deepEqual(rows.map((r) => [r.part, r.name, r.choices.length]), [['floor', 'Floor', 6], ['beam', 'Beams', 6], ['bench', 'Bench', 6], ['wheels', 'Wheels', 6]], 'an open wagon: no inner row (PER-KIND ROWS)');
  assert.deepEqual(rows.map((r) => r.choices), [TIMBER_LOOKS, TIMBER_LOOKS, TIMBER_LOOKS, WHEEL_LOOKS].map((l) => l.map((k) => TIMBER_LOOK_NAMES[k])));
  assert.equal(rows.find((r) => r.part === 'beam').current, 3, 'and the one worn');
  assert.equal(timberChoiceName('beam', 2), TIMBER_LOOK_NAMES[TIMBER_LOOKS[2]]);
  assert.equal(timberChoiceName('wheels', 2), TIMBER_LOOK_NAMES[WHEEL_LOOKS[2]]);
  assert.equal(timberRows([]), null, 'no wagon, no rows');
  assert.equal(timberRows(null), null);
});

test('WAGON-TIMBER THE SAVE RIDES IT: the one `wagonLook` field takes the paint\'s four and the timber\'s five, six choices each, and the schema\'s key set is the law\'s own (mutants: a key the schema does not know, a key the law does not know, a seventh choice)', () => {
  assert.deepEqual([...WAGON_LOOK_KEYS].sort(), ['beam', 'bench', 'c', 'f', 'floor', 'inner', 'o', 'w', 'wheels'], 'the paint\'s four and the timber\'s five');
  for (const k of TIMBER_FIELDS) assert.ok(WAGON_LOOK_KEYS.has(k), `${k}: the schema keeps what the law writes`);
  const look = { o: 2, w: 0, f: 1, c: 0, floor: 3, inner: 0, beam: 4, bench: 0, wheels: 5 };
  assert.deepEqual(validItemField('wagonLook', look), look, 'a dyed, painted wagon saves whole');
  assert.equal(validItemField('wagonLook', { ...look, keel: 1 }), undefined, 'a key the law does not know');
  assert.equal(validItemField('wagonLook', { ...look, wheels: 6 }), undefined, 'a seventh choice');
  assert.equal(validItemField('wagonLook', { ...look, beam: -1 }), undefined);
  assert.equal(validItemField('wagonLook', { ...look, beam: 1.5 }), undefined);
  assert.deepEqual(validItemField('wagonLook', { o: 2, w: 0, f: 1, c: 0 }), { o: 2, w: 0, f: 1, c: 0 }, 'and an old save still reads');
});

test('WAGON-TIMBER THE FOUR WOODEN BASES ARE PAINTED WOODS: TEX.floor, TEX.inner, TEX.beam and TEX.bench name the four bases the operator named, and each timber list dyes its own - the dye over the painter\'s picture, never another part\'s (mutants: a part dyed off another part\'s boards)', () => {
  assert.deepEqual([TEX.floor, TEX.inner, TEX.beam, TEX.bench], [0, 2, 3, 4], 'the four bases the operator named');
  assert.deepEqual(LOOK_RECORDS.timberFloor, [TEX.floor]);
  assert.deepEqual(LOOK_RECORDS.timberInner, [TEX.inner]);
  assert.deepEqual(LOOK_RECORDS.timberBeam, [TEX.beam]);
  assert.deepEqual(LOOK_RECORDS.timberBench, [TEX.bench]);
  for (const [part, list] of Object.entries(TIMBER_LISTS)) {
    if (part === 'wheels') continue;
    const base = LOOK_RECORDS[list][0];
    const [[rec, pic]] = wagonLookArt(list, 1, 'walnut');
    assert.equal(rec, lookRecord(base, 1), `${part}: the dye's own record, a stride from its base`);
    assert.deepEqual([pic.width, pic.height], [64, 64], `${part}: the painter's own shape`);
  }
  // the wheels are NOT one of them: a wheel is turned and fitted, and is finished here, not dyed
  assert.deepEqual(LOOK_RECORDS.wheels, [TEX.tyre, TEX.wheel], 'a wheel\'s own two records');
});

test('WAGON-TIMBER THE CHOICES: choice 0 names nothing (the wagon as built), every other choice wears its own records a stride from the base, and every one of them is a picture of its own - unlike the built one and unlike every other choice\'s (mutants: the built choice named, a choice its built picture, one choice\'s picture another\'s)', () => {
  const pictures = new Map();
  for (const list of Object.values(TIMBER_LISTS)) {
    const names = looksFor(list);
    assert.deepEqual(wagonLookArt(list, 0, names[0]), [], `${list}: the built choice names nothing here`);
    for (let i = 1; i < names.length; i++) {
      const pics = wagonLookArt(list, i, names[i]);
      assert.deepEqual(pics.map(([rec]) => rec), LOOK_RECORDS[list].map((rec) => lookRecord(rec, i)), `${list} ${names[i]}: its own records`);
      for (const [rec, pic] of pics) {
        assert.deepEqual([pic.width, pic.height], [64, 64], `${list} ${names[i]}: the painter's own shape`);
        const own = hash(pic);
        assert.equal(pictures.has(own), false, `${list} ${names[i]} record ${rec}: a picture of its own - no other choice wears it`);
        pictures.set(own, `${list} ${names[i]} ${rec}`);
      }
    }
  }
});

test('WAGON-TIMBER THE DYE IS A SHIFT, NOT A FILL: a dye moves hue, saturation and light and leaves the wood\'s own shading standing - two shades that were apart are apart, and the order of the light is the order it was - and EVERY texel of the record goes through it, its alpha untouched (mutants: the dye a flat fill, one texel in eight left undyed, the art\'s light thrown away, the hue ignored)', () => {
  const ramp = [0.2, 0.4, 0.6, 0.8].map((v) => [Math.round(166 * v), Math.round(115 * v), Math.round(70 * v)]);   // one wood in four shades - the grain a picture has
  const src = new Uint8Array(ramp.flatMap((c) => [...c, 255]));
  const light = (d, i) => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  const hues = (d) => [...Array(4)].map((_, i) => hsv([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]).h);
  // THE SHADE OF EVERY DYE, ON EVERY TEXEL - `val` is the light lever, and it is the ONLY one: a hue on its own
  const hueOnly = { hue: 6, sat: /** @type {any} */ (['mul', 1]), val: /** @type {any} */ ([0, 1]) };
  const onlyHue = /** @type {Uint8Array} */ (dyeEveryTexel(src, src.slice(), hueOnly));
  assert.equal(onlyHue.length, src.length, 'every texel answered, and the picture its own length');
  for (let i = 0; i < ramp.length; i++) {
    assert.equal(light(onlyHue, i), light(src, i), `texel ${i}: the art's own light is its own light`);
    assert.ok(hueApart(hues(onlyHue)[i], hues(src)[i]) > 10, `texel ${i}: and its hue really moved`);
  }
  assert.deepEqual([...onlyHue].filter((_, i) => i % 4 === 3), [...src].filter((_, i) => i % 4 === 3), 'alpha is never touched');
  // and the five shipped dyes, each on all four
  for (const name of TIMBER_LOOKS) {
    const out = /** @type {Uint8Array} */ (dyeEveryTexel(src, src.slice(), WOOD_DYES[name]));
    assert.equal(out.length, src.length, `${name}: every texel`);
    assert.deepEqual([...out].filter((_, i) => i % 4 === 3), [...src].filter((_, i) => i % 4 === 3), `${name}: alpha untouched`);
    for (let i = 1; i < ramp.length; i++) assert.ok(light(out, i) > light(out, i - 1), `${name} texel ${i}: paler than the one before - the shading is not flattened`);
    if (name === 'oak') continue;   // the identity is pinned below, against the painted boards themselves
    assert.notDeepEqual([...out], [...src], `${name}: and the wood is a different colour`);
    assert.ok(hueApart(hues(out)[3], hues(src)[3]) > 10 || Math.abs(light(out, 3) - light(src, 3)) > 10, `${name}: it really moved something`);
  }
  const shipped = TIMBER_LOOKS.map((k) => [...dyeEveryTexel(src, src.slice(), WOOD_DYES[k])].join(','));
  assert.equal(new Set(shipped).size, shipped.length, 'every dye lands somewhere of its own');
  const spread = TIMBER_LOOKS.slice(1).map((k) => { const out = /** @type {Uint8Array} */ (dyeEveryTexel(src, src.slice(), WOOD_DYES[k])); return hsv([out[0], out[1], out[2]]); });
  assert.ok(Math.max(...spread.map((c) => c.h)) - Math.min(...spread.map((c) => c.h)) > 15, 'the dyes are spread in hue, not five tints of one');
  assert.ok(Math.max(...spread.map((c) => c.v)) / Math.min(...spread.map((c) => c.v)) > 1.8, 'and in light');
});

test('WAGON-TIMBER THE WHEELS ARE THEIR OWN TABLE: choice 0 names nothing (the wheel that shipped stands); every finish is a whole row of RGB triples - DATA, not drawing - and every choice\'s face AND its tread are pictures of their own; the iron is iron in all six (mutants: a finish missing a colour, two finishes the same picture, the tread left alone)', () => {
  assert.deepEqual(wagonLookArt('wheels', 0, 'oak'), [], 'choice 0 names nothing - the wheel that shipped stands');
  assert.deepEqual([...WHEEL_LOOKS], Object.keys(WHEEL_FINISHES), 'the law lists exactly the finishes the wheel code draws');
  const faces = new Set(), treads = new Set();
  for (const name of WHEEL_LOOKS) {
    const fin = WHEEL_FINISHES[name];
    assert.deepEqual(Object.keys(fin).sort(), ['black', 'dust', 'felloe', 'hub', 'iron', 'ironLit', 'oak', 'oakDark', 'oakLit', 'rust', 'spoke', 'tar'], `${name}: a whole row - nothing the drawing reads is missing`);
    for (const [k, c] of Object.entries(fin)) assert.ok(Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${name}.${k}: an RGB triple`);
    const face = wheelArt(fin), tread = tyreArt(fin);
    assert.deepEqual([face.width, face.height], [64, 64], `${name}: the wheel's own picture shape`);
    faces.add(hash(face));
    treads.add(hash(tread));
    assert.deepEqual([fin.iron, fin.ironLit], [FLEET.iron, FLEET.ironLit], `${name}: the iron is the iron`);
  }
  assert.equal(faces.size, WHEEL_LOOKS.length, 'every finish a face of its own');
  assert.equal(treads.size, WHEEL_LOOKS.length, 'and a tread of its own - the road\'s dust takes the timber\'s tone');
  // the built row IS the fleet's colours: the wheel that shipped is one table row, not a second copy of it
  assert.deepEqual(WHEEL_FINISHES.oak.hub, WAGON_K.hub, 'the built hub');
  assert.deepEqual(WHEEL_FINISHES.oak.felloe, WAGON_K.felloe, 'the built felloes');
  assert.deepEqual(WHEEL_FINISHES.oak.spoke, WAGON_K.spoke, 'the built spokes');
  assert.deepEqual([WHEEL_FINISHES.oak.oak, WHEEL_FINISHES.oak.oakDark, WHEEL_FINISHES.oak.oakLit], [FLEET.oak, FLEET.oakDark, FLEET.oakLit], 'the built oak');
  // AND KEY BY KEY, WHICH IS THE POINT OF A TABLE: move one triple and that one picture moves.
  const other = Object.freeze([7, 7, 7]);
  for (const name of WHEEL_LOOKS) {
    const fin = WHEEL_FINISHES[name];
    assert.notEqual(hash(tyreArt({ ...fin, dust: other })), hash(tyreArt(fin)), `${name}: the tread wears its own dust`);
    assert.notEqual(hash(tyreArt({ ...fin, rust: other })), hash(tyreArt(fin)), `${name}: and its own rust`);
    assert.notEqual(hash(wheelArt({ ...fin, spoke: other })), hash(wheelArt(fin)), `${name}: the face wears its own spoke`);
    assert.notEqual(hash(wheelArt({ ...fin, felloe: other })), hash(wheelArt(fin)), `${name}: its own felloes`);
    assert.notEqual(hash(wheelArt({ ...fin, oakDark: other })), hash(wheelArt(fin)), `${name}: and its own shadow inside the wheel`);
  }
  // THE OPERATOR'S OWN LIST, READ OUT OF THE TABLE: a couple of browns, a reddish one, a grey one
  const felloe = WHEEL_LOOKS.map((n) => hsv(WHEEL_FINISHES[n].felloe)), built = felloe[0].h;
  assert.ok(felloe.filter((c) => Math.abs(c.h - built) < 12).length >= 3, `a couple of browns beside the built one (${felloe.map((c) => c.h).join(', ')})`);
  assert.ok(felloe.some((c) => c.h <= 20), 'and a reddish one');
  assert.ok(Math.min(...felloe.map((c) => c.s)) < 0.2, 'and a grey - the colour nearly gone out of the timber');
  assert.equal(WOOD_DYES.silvered, undefined, 'silvered is a wheel\'s word only: the wood\'s table has no such row, and the two answer separately');
  assert.ok(TIMBER_LOOKS.includes('ash') && WHEEL_LOOKS.includes('silvered'), 'and each family has a grey of its own name');
});

test('WAGON-TIMBER THE WHEELS ARE SEPARATE FROM THE WOOD (Mac: "I want the wheel options to be separate from the wood options"): over EVERY choice of EVERY part no record is both a wheel\'s and a wood\'s, and one wagon may wear the one without the other (mutants: a wheel record in a wood\'s sources, the wheel list answering with a wood\'s records)', () => {
  const wood = new Set(), wheels = new Set();
  for (const part of TIMBER_PARTS) for (let i = 1; i < TIMBER_LOOKS.length; i++) for (const [rec] of wagonLookArt(TIMBER_LISTS[part], i, TIMBER_LOOKS[i])) wood.add(rec);
  for (let i = 1; i < WHEEL_LOOKS.length; i++) for (const [rec] of wagonLookArt('wheels', i, WHEEL_LOOKS[i])) wheels.add(rec);
  assert.deepEqual([...wood].filter((r) => wheels.has(r)), [], 'no record is both a wheel\'s and a wood\'s');
  assert.deepEqual(LOOK_RECORDS.wheels.map((r) => wood.has(lookRecord(r, 1))), [false, false], 'and a wheel\'s base is in none of the wood\'s');
  assert.deepEqual(LOOK_RECORDS.wheels.map((r) => wheels.has(lookRecord(r, 1))), [true, true], 'and its own record is in the wheels\'');
  assert.equal(wheels.size, (WHEEL_LOOKS.length - 1) * 2, 'two records a wheel choice past the first - the tread and the face - and no more');
  for (const part of TIMBER_PARTS) assert.equal(wagonLookArt(TIMBER_LISTS[part], 1, 'walnut').length, 1, `${part}: one record of its own`);
  for (let wi = 1; wi < WHEEL_LOOKS.length; wi++) {
    const name = WHEEL_LOOKS[wi], fin = WHEEL_FINISHES[name];
    const [[trec, tread], [wrec, face]] = wagonLookArt('wheels', wi, name);
    assert.equal(trec, lookRecord(TEX.tyre, wi), `${name}: the tread's record`);
    assert.deepEqual(Buffer.from(tread.data).toString('base64'), Buffer.from(tyreArt(fin).data).toString('base64'), `${name}: the tread's record wears the tread's picture`);
    assert.deepEqual(Buffer.from(face.data).toString('base64'), Buffer.from(wheelArt(fin).data).toString('base64'), `${name}: and the face's its own`);
  }
  const wagon = timberedWagon(timberedWagon(newWagonItem('caravan'), 'bench', 4), 'wheels', 3);
  assert.deepEqual(wagon.wagonLook, { o: 0, w: 0, f: 0, c: 0, bench: 4, wheels: 3 }, 'a walnut bench on mahogany wheels');
  assert.deepEqual(readWagonTimber({ ...wagon.wagonLook, wheels: 0 }), { floor: 0, inner: 0, beam: 0, bench: 4, wheels: 0 }, 'and the wheels put back change nothing else');
  assert.deepEqual(wagonTimberOf(timberedWagon(wagon, 'floor', 2)), { floor: 2, inner: 0, beam: 0, bench: 4, wheels: 3 }, 'nor the bench when the floor is dyed');
});

test('WAGON-TIMBER THE STRIDE IS SAFE: every choice of every list - the paint\'s, the caravan\'s inside\'s, the wood\'s and the wheels\' - wears a record no other wears, each a stride from a base of its own below the stride, and none lands on the room\'s live records (mutants: the stride shortened under the bases, two lists sharing a base, a choice landing on a live room record)', () => {
  assert.equal(LOOK_RECORD_STRIDE, 100, 'the paint\'s own stride - one ladder for every list a wagon carries');
  assert.deepEqual([TEX.floor, TEX.inner, TEX.beam, TEX.bench, TEX.tyre, TEX.wheel], [0, 2, 3, 4, 5, 6], 'the six bases the operator named, below the stride and distinct in it');
  const bases = new Set(), all = new Set();
  const take = (what, rec, band) => {
    assert.equal(all.has(rec), false, `record ${rec} (${what}) is nobody else's`);
    if (band === 'built') assert.ok(rec >= 0 && rec < CARAVAN_LIVE_CHOICE * LOOK_RECORD_STRIDE, `record ${rec}: above the built band and below the room's live ones`);
    all.add(rec);
  };
  for (const [list, recs] of Object.entries(LOOK_RECORDS)) {
    for (const rec of recs) {
      assert.ok(rec < LOOK_RECORD_STRIDE, `${list}: base ${rec} below the stride`);
      assert.equal(bases.has(rec), false, `${list}: base ${rec} is nobody else's`);
      bases.add(rec);
      for (let i = 0; i < TIMBER_CHOICES; i++) {
        const r = lookRecord(rec, i);
        assert.equal(r % LOOK_RECORD_STRIDE, rec % LOOK_RECORD_STRIDE, `record ${r} (${list} ${i}): its own base's band`);
        take(`${list} ${i}`, r, 'built');
      }
    }
  }
  for (const rec of [...LOOK_RECORDS.walls, ...LOOK_RECORDS.floor, ...LOOK_RECORDS.ceiling]) {
    assert.ok(lookRecord(rec, CARAVAN_LIVE_CHOICE) >= CARAVAN_LIVE_CHOICE * LOOK_RECORD_STRIDE, 'the room\'s live records stand above the built band');
    take(`live ${CARAVAN_LIVE_CHOICE}`, lookRecord(rec, CARAVAN_LIVE_CHOICE), 'live');
  }
  assert.equal(bases.size, Object.values(LOOK_RECORDS).flat().length, 'and every built record belongs to one list alone');
  assert.equal(all.size, [...all].length, 'the whole archive numbering is one record each');
});
