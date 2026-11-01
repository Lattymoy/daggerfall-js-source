// OWN-WORK4 (2026-10-31; the owner: "A proper 1 to 1 recreation for everything"): Roleplay & Realism: Items' pictures
// are ours (systems/roleplayRealismItems/rriArt.js) - every name, size and doll place the release used, the picture
// drawn by our recipes over Daggerfall's matching paper-doll record, the Short Flail painted whole. CI has no ARENA2, so
// the painter is pinned on made-up records; with ARENA2_PATH every picture is built from the player's own files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RRI_ART_BASE, RRI_ART_KIND, RRI_HATCHET, RRI_FLAIL_HAND, RRI_METALS, RRI_FUR, rriArtRecipe, rriOwnPicture, paintRriPicture, placeRecord } from '../../src/systems/roleplayRealismItems/rriArt.js';
import { RRI_SPRITES } from '../../src/systems/roleplayRealismItems/rriIndex.js';
import { RAMP } from '../../src/art/ownPainter.js';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { TextureFile } from '../../src/formats/textureFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const key = (rgba, at) => `${rgba[at]},${rgba[at + 1]},${rgba[at + 2]}`;
const colours = (...ramps) => new Set(ramps.flat().map((c) => c.join(',')));
const opaque = (picture) => { const out = []; for (let i = 0; i < picture.width * picture.height; i++) if (picture.data[i * 4 + 3]) out.push(i); return out; };
/** A made-up classic record: a w x h block of greys, its top row a ramp, `mask` texels opaque black (ART_PAL's 255). */
function record(w, height, { mask = [], tint = null } = {}) {
  const data = new Uint8Array(w * height * 4);
  for (let i = 0; i < w * height; i++) {
    const grey = 40 + ((i * 37) % 180);
    data.set(tint ? tint(i, grey) : [grey, grey, grey], i * 4);
    data[i * 4 + 3] = 255;
  }
  for (const i of mask) data.fill(0, i * 4, i * 4 + 3);
  return { width: w, height, data };
}

test('OWN-WORK4 RRI art: a recipe of ours for every name the release used - the kind by record (our rule), the metal by dye, the base the slot\'s classic record (mutants: a kind, a dye or a base unread)', () => {
  const names = Object.keys(RRI_SPRITES);
  assert.equal(names.length, 280);
  assert.deepEqual(names.filter((n) => !rriArtRecipe(n)), [], 'every name has a recipe - the helmet\'s masks and the Dwarven helmets too, no spec over the authors\' pixels');
  const count = (kind) => names.filter((n) => rriArtRecipe(n).kind === kind).length;
  assert.deepEqual(['hatchet', 'flail', 'leather', 'fur', 'plated', 'mask'].map(count), [20, 20, 16, 16, 160, 48]);
  assert.deepEqual({ ...RRI_ART_KIND.light }, { 2: 'fur', 6: 'fur', 10: 'plated', 14: 'plated', 16: 'leather', 17: 'leather' }, 'rriItems.js lightRecord: fur its own row, plate +8, leather 16/17');
  assert.deepEqual({ ...RRI_ART_KIND.cap }, { 1: 'fur', 2: 'fur', 5: 'fur', 6: 'fur', 9: 'plated', 10: 'plated', 13: 'plated', 14: 'plated', 16: 'leather', 17: 'leather', 18: 'leather', 19: 'leather' }, 'helmetRecord\'s four rows');
  assert.deepEqual(Object.keys(RRI_METALS), ['Silver', 'Iron', 'Steel', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
  const iron = rriArtRecipe('520_10-0_Iron');
  assert.deepEqual([iron.kind, iron.metal, iron.width, iron.height, [...iron.base]], ['plated', 'Iron', 44, 76, [247, 4, 0, 0]]);
  assert.equal(rriArtRecipe('520_10-0').metal, 'Silver', 'a bare name is the Unchanged ask: silver');
  assert.deepEqual([...rriArtRecipe('522_13-0_Mask').base], [251, 27, 0, 0], 'a mask is built from the helm its cap is');
  const dwarven = rriArtRecipe('522_10-0_Dwarven');
  assert.deepEqual([dwarven.kind, dwarven.metal, [...dwarven.base]], ['plated', 'Dwarven', [245, 27, 0, 0]], 'a Dwarven helmet is our plated cap in our Dwarven metal');
  assert.equal(RRI_METALS.Dwarven, RAMP.bronze);
  assert.deepEqual([...RRI_ART_BASE['522_1'], ...RRI_ART_BASE['513_0']], [245, 27, 3, 0, 234, 0, -2, 0]);
  assert.deepEqual([rriArtRecipe('514_1-0_Daedric').kind, rriArtRecipe('514_1-0_Daedric').hand], ['flail', 1]);
  assert.deepEqual([...rriArtRecipe('513_1-0').hand], [10, 5]);
  assert.equal(RRI_HATCHET.scale, 0.88);
  for (const bad of ['520_10-0_Purple', '520_3-0', '599_0-0', '520_10-0_Iron.png']) assert.equal(rriArtRecipe(bad), null, bad);
});

test('OWN-WORK4 RRI art: the light set over a made-up record - the record\'s shape kept, its mask cleared, our leather, fur and metals laid on; a mask is the record\'s hair area alone (mutants: the mask kept, a metal unread, the fur at the hem dropped)', async () => {
  const w = 12, height = 10, mask = [0, 1, 12, 13];
  const src = record(w, height, { mask });
  const shape = (p) => opaque(p).join();
  const kept = opaque(src).filter((i) => !mask.includes(i)).join();
  const leather = paintRriPicture(src, { ...rriArtRecipe('520_16-0'), width: w, height, base: [0, 0, 0, 0] });
  assert.equal(shape(leather), kept, 'the record\'s silhouette, its mask texels cleared');
  const ours = colours(RAMP.leather, RAMP.rope);
  assert.ok(opaque(leather).every((i) => ours.has(key(leather.data, i * 4))), 'every texel one of our leather or thread colours');
  const plated = (dye) => paintRriPicture(src, { ...rriArtRecipe(`520_10-0${dye ? `_${dye}` : ''}`), width: w, height, base: [0, 0, 0, 0] });
  const iron = plated('Iron'), daedric = plated('Daedric');
  assert.ok(opaque(iron).some((i) => colours(RRI_METALS.Iron).has(key(iron.data, i * 4))), 'iron plates');
  assert.ok(opaque(daedric).some((i) => colours(RAMP.red).has(key(daedric.data, i * 4))), 'daedric plates');
  assert.notDeepEqual([...iron.data], [...daedric.data], 'the dye is the metal');
  const fur = paintRriPicture(src, { ...rriArtRecipe('520_2-0'), width: w, height, base: [0, 0, 0, 0] });
  const bottom = (height - 1) * w + 6;
  assert.ok(colours(RRI_FUR).has(key(fur.data, bottom * 4)), 'the hem is fur');
  assert.ok(!colours(RRI_FUR).has(key(fur.data, (5 * w + 1) * 4)), 'the side is leather');
  const ownMask = paintRriPicture(src, { ...rriArtRecipe('522_1-0_Mask'), width: w, height, base: [0, 0, 0, 0] });
  assert.deepEqual(opaque(ownMask), mask, 'a mask: the record\'s index-255 texels, and nothing else');
  // the hatchet: the Battle Axe drawn smaller about the hand, grey to our metal, brown to our wood and grip
  const axe = record(20, 20, { tint: (i, grey) => (i % 20 < 10 ? [grey, grey, grey] : [grey, Math.round(grey * 0.6), Math.round(grey * 0.3)]) });
  const hatchet = paintRriPicture(axe, { ...rriArtRecipe('513_0-0_Mithril'), width: 20, height: 20, base: [0, 0, 0, 0], hand: [19, 0] });
  assert.ok(opaque(hatchet).length < 400 && opaque(hatchet).length > 250, 'drawn at 88% about the hand');
  assert.ok(colours(RRI_METALS.Mithril).has(key(hatchet.data, (10 * 20 + 2) * 4)), 'the grey of the head, our mithril');
  assert.ok(colours(RAMP.wood).has(key(hatchet.data, (10 * 20 + 16) * 4)), 'the brown of the haft, our wood');
  assert.ok(colours(RAMP.leather).has(key(hatchet.data, (1 * 20 + 17) * 4)), 'our grip by the hand');
  assert.equal(placeRecord(record(1, 1), 3, 2, 2, 1).data[(1 * 3 + 2) * 4 + 3], 255, 'placed at (2, 1)');
  // rriOwnPicture reads the base through `art`, and says so when the player's data has none
  const asked = [];
  const built = await rriOwnPicture('521_14-0_Steel', { picture: async (...at) => { asked.push(at); return record(46, 49); } });
  assert.deepEqual(asked, [[251, 12, 0]]);
  assert.deepEqual([built.width, built.height], [46, 49]);
  await assert.rejects(rriOwnPicture('521_14-0_Steel', { picture: async () => null }), /not in the player's data/);
  await assert.rejects(rriOwnPicture('nothing'), /no recipe/);
});

test('OWN-WORK4 RRI art: the Short Flail is painted whole - no record read, at its size, by its metal, the fist left clear for the doll\'s hand, the same every time', async () => {
  const none = { picture: async () => { throw new Error('the flail reads nothing'); } };
  const left = await rriOwnPicture('514_0-0_Steel', none), right = await rriOwnPicture('514_1-0_Steel', none);
  assert.deepEqual([left.width, left.height, right.width, right.height], [48, 76, 48, 72]);
  assert.deepEqual([...left.data], [...(await rriOwnPicture('514_0-0_Steel', none)).data], 'deterministic');
  assert.notDeepEqual([...left.data], [...(await rriOwnPicture('514_0-0_Daedric', none)).data], 'the dye is the metal');
  const [handX, handY] = RRI_FLAIL_HAND;
  const clearAt = (p, x, y) => p.data[(Math.floor(y) * p.width + Math.floor(x)) * 4 + 3] === 0;
  assert.ok(clearAt(left, handX, handY) && clearAt(right, left.width - handX, handY), 'the fist is the doll\'s own');
  assert.ok(opaque(left).length > 200 && opaque(right).length > 200);
  assert.ok(left.data[((left.height - 6) * left.width + 15) * 4 + 3] && right.data[((right.height - 6) * right.width + 32) * 4 + 3], 'the ball hangs low, under its own hand');
});

test('OWN-WORK4 RRI art with ARENA2: every one of the 280 builds from the player\'s files at its size; each base lands where its record sits on the doll, moved inside the picture; the shape is the record\'s; our two masks are the helm\'s hair area', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  const files = new Map();
  const texture = (archive) => {
    if (!files.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`, file = new TextureFile();
      file.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, null);
      files.set(archive, file);
    }
    return files.get(archive);
  };
  for (const [stem, [archive, rec, x, y]] of Object.entries(RRI_ART_BASE)) {
    const [w, height, rx, ry] = RRI_SPRITES[`${stem}-0`];
    const { width: rw, height: rh } = texture(archive).getSize(rec), off = texture(archive).getOffset(rec);
    const fit = (at, size, room) => (size <= room ? Math.max(0, Math.min(room - size, at)) : at);
    assert.deepEqual([x, y], [fit(off.x - 200 - rx, rw, w), fit(off.y - 8 - ry, rh, height)], `${stem}: TEXTURE.${archive} record ${rec}`);
  }
  for (const name of Object.keys(RRI_SPRITES)) {
    const picture = await rriOwnPicture(name, art), recipe = rriArtRecipe(name);
    assert.deepEqual([picture.width, picture.height], RRI_SPRITES[name].slice(0, 2), name);
    if (recipe.kind === 'flail' || recipe.kind === 'hatchet') continue;
    const placed = placeRecord(await art.picture(recipe.base[0], recipe.base[1], 0), picture.width, picture.height, recipe.base[2], recipe.base[3]);
    const hair = (i) => placed.data[i * 4 + 3] && !placed.data[i * 4] && !placed.data[i * 4 + 1] && !placed.data[i * 4 + 2];
    const want = opaque(placed).filter((i) => (recipe.kind === 'mask' ? hair(i) : !hair(i)));
    assert.deepEqual(opaque(picture), want, `${name}: the record's own shape`);
  }
  assert.ok(opaque(await rriOwnPicture('522_2-0_Mask', art)).length > 100, 'the helm has a hair area to clear');
});
