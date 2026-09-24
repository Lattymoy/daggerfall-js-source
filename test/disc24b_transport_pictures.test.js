// DISC24-B (2026-09-24, kurkku on Discord: "Horse and Wagon don't have sprites in GrimoireUI" - "presumably applies to
// the normal vanilla UI as well").
//
// THE BUG: MAC-D2 answered the Small Cart's tomato (its template's 213/1 is the Wine Rack's world sprite) by giving the
// WHOLE Transportation group no picture. That took the Horse with it, whose 201/0 was never borrowed - it is the
// animal archive's own horse. And the cart was left with nothing, because no TEXTURE archive carries a cart.
//
// THE FIX: the Horse draws its own record again; the cart's picture is its model - classic 41214, the wagon Horse Cart
// and Cargo trails - baked once on the CPU (ui/modelIcon.js) and drawn by the classic list (every native window,
// vanilla and Grimoire) and the enhanced one through their own doors.
//
// Driven through the real item address, the real bake, the real classic drawer and the real enhanced line and picture
// door. ARENA2 is not in this checkout, so the model and its texture are built here in the pipeline's own shapes
// (meshReader's record, getColor32's RGBA rows bottom first); the door's loader is the seam the test hands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventoryItemImage, inventoryItemModel, GROUP_TEMPLATE_INDICES, TRANSPORT_HORSE, TRANSPORT_SMALL_CART } from '../src/systems/itemTemplates.js';
import { WAGON_MODEL_ID } from '../src/systems/horseCartLaw.js';
import { bakeModelIcon, requestModelIcon, requestModelIconUrl, _resetModelIcons, ICON_SIZE } from '../src/ui/modelIcon.js';
import { makeIconDrawer, MODEL_ICON_ARCHIVE } from '../src/ui/itemScroller.js';
import { itemLine, linePictureUrl } from '../src/ui/enhancedInventory.js';
import { TRANSPORT_HORSE as SHOP_HORSE, TRANSPORT_SMALL_CART as SHOP_CART } from '../src/systems/shopStock.js';

const cartItem = () => ({ templateIndex: TRANSPORT_SMALL_CART, group: 'Transportation', name: 'Small Cart' });
const horseItem = () => ({ templateIndex: TRANSPORT_HORSE, group: 'Transportation', name: 'Horse' });
const settle = () => new Promise((r) => setTimeout(r, 0));

/** A texture in getColor32's shape: RGBA, row 0 the picture's BOTTOM. `rowsTopDown` are the picture's rows as seen. */
function color32(rowsTopDown) {
  const h = rowsTopDown.length, w = rowsTopDown[0].length;
  const colors = new Uint8ClampedArray(w * h * 4);
  rowsTopDown.forEach((row, yTop) => row.forEach(([r, g, b], x) => colors.set([r, g, b, 255], ((h - 1 - yTop) * w + x) * 4)));
  return { width: w, height: h, colors };
}
/** A picture's pixel as seen: (x, y from the TOP). */
const at = (pic, x, yTop) => { const i = ((pic.height - 1 - yTop) * pic.width + x) * 4; return [...pic.colors.slice(i, i + 4)]; };

/** A quad facing the viewer (z = +1), textured with UVs in meshReader's convention: u = U/width, v = -(V/height). */
function facingQuad({ archive = 1, record = 0 } = {}) {
  return {
    positions: new Float32Array([-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]),
    // corner by corner: bottom-left, bottom-right, top-right, top-left - V runs DOWN the texture from its top row
    uvs: new Float32Array([0, -1, 1, -1, 1, -0, 0, -0]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    subMeshes: [{ textureArchive: archive, textureRecord: record, startIndex: 0, primitiveCount: 2 }],
  };
}

test('DISC24-B: the Horse draws its own record again; the cart and the boats still borrow nothing', () => {
  assert.equal(SHOP_HORSE, TRANSPORT_HORSE, 'one home for the template ids - the shop re-exports them');
  assert.equal(SHOP_CART, TRANSPORT_SMALL_CART);
  const horse = inventoryItemImage(horseItem());
  assert.deepEqual([horse.archive, horse.record], [201, 0], 'TEXTURE.201 record 0: the animal archive\'s horse');
  for (const i of GROUP_TEMPLATE_INDICES.Transportation.filter((t) => t !== TRANSPORT_HORSE)) {
    assert.equal(inventoryItemImage({ templateIndex: i, group: 'Transportation' }), null, `template ${i}: the Wine Rack is not its picture`);
  }
  assert.equal(inventoryItemModel(cartItem()), WAGON_MODEL_ID, 'the cart is pictured by the wagon the world draws');
  assert.equal(inventoryItemModel(horseItem()), null, 'the horse has art of its own');
  assert.equal(inventoryItemModel({ templateIndex: 95 }), null, 'no boat is sold, so none is pictured');
  assert.equal(inventoryItemModel({ templateIndex: 121, group: 'Weapons' }), null);
});

test('DISC24-B: the bake draws the model textured the right way up, in color32 order, cropped to what it drew', () => {
  const RED = [200, 0, 0], BLUE = [0, 0, 200];
  const tex = color32([[RED, RED], [BLUE, BLUE]]);   // red on top, blue below, as the texture is SEEN
  const pic = bakeModelIcon(facingQuad(), () => tex, { yaw: 0, pitch: 0, size: 20, pad: 0 });
  assert.ok(pic && pic.width === 20 && pic.height === 20, 'a facing square fills the square');
  const top = at(pic, 10, 2), bottom = at(pic, 10, 17);
  assert.ok(top[0] > 0 && top[2] === 0 && top[3] === 255, `the texture's top is the picture's top (${top})`);
  assert.ok(bottom[2] > 0 && bottom[0] === 0, `and its bottom the bottom (${bottom})`);
  // the light: the facing quad is lit at ICON_AMBIENT plus its share of the key light - never black, never over
  assert.ok(top[0] < 200 && top[0] > 90, `shaded, not raw and not dark (${top[0]})`);

  // an off-square model is CROPPED, so a list fits it by its real shape
  const wide = facingQuad();
  wide.positions = new Float32Array([-2, -1, 1, 2, -1, 1, 2, 1, 1, -2, 1, 1]);
  const w = bakeModelIcon(wide, () => tex, { yaw: 0, pitch: 0, size: 40, pad: 0 });
  assert.equal(w.width, 40);
  assert.equal(w.height, 20, 'half as tall as wide, with no transparent rows around it');

  // the default view is the item angle, at item size
  const def = bakeModelIcon(facingQuad(), () => tex);
  assert.ok(def.width <= ICON_SIZE && def.height <= ICON_SIZE);
  assert.ok(def.width < ICON_SIZE || def.height < ICON_SIZE, 'the three-quarter turn foreshortens the face');
});

test('DISC24-B: the nearer face wins, a missing texture is wood not a hole, and an empty model is no picture', () => {
  const RED = [220, 0, 0], GREEN = [0, 220, 0];
  const near = facingQuad({ archive: 1 }), far = facingQuad({ archive: 2 });
  far.positions = far.positions.map((v, i) => (i % 3 === 2 ? -1 : v));   // the same square, behind (z = -1)
  const both = {
    positions: new Float32Array([...far.positions, ...near.positions]),
    uvs: new Float32Array([...far.uvs, ...near.uvs]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
    subMeshes: [{ textureArchive: 2, textureRecord: 0, startIndex: 0, primitiveCount: 2 }, { textureArchive: 1, textureRecord: 0, startIndex: 6, primitiveCount: 2 }],
  };
  const texOf = (a) => color32([[a === 1 ? RED : GREEN]]);
  const pic = bakeModelIcon(both, texOf, { yaw: 0, pitch: 0, size: 16, pad: 0 });
  const c = at(pic, 8, 8);
  assert.ok(c[0] > 0 && c[1] === 0, `the near (red) face, drawn second, wins - and drawn FIRST it still wins (${c})`);
  both.subMeshes.reverse();
  both.indices = new Uint32Array([4, 5, 6, 4, 6, 7, 0, 1, 2, 0, 2, 3]);
  both.subMeshes = [{ textureArchive: 1, textureRecord: 0, startIndex: 0, primitiveCount: 2 }, { textureArchive: 2, textureRecord: 0, startIndex: 6, primitiveCount: 2 }];
  const pic2 = bakeModelIcon(both, texOf, { yaw: 0, pitch: 0, size: 16, pad: 0 });
  assert.deepEqual(at(pic2, 8, 8), c, 'the depth test, not the draw order');

  const wood = at(bakeModelIcon(facingQuad(), () => null, { yaw: 0, pitch: 0, size: 8, pad: 0 }), 4, 4);
  assert.ok(wood[3] === 255 && wood[0] > wood[2], `an unreadable texture draws as wood (${wood})`);
  assert.equal(bakeModelIcon({ positions: new Float32Array(0), indices: new Uint32Array(0) }, () => null), null);
});

test('DISC24-B: the door loads a model once, wakes every list that asked while it loaded, and caches a miss', async () => {
  _resetModelIcons();
  let loads = 0;
  const source = async (id) => { loads++; return id === WAGON_MODEL_ID ? { model: facingQuad(), texels: () => color32([[[90, 60, 30]]]) } : null; };
  const woke = [];
  assert.equal(requestModelIcon(WAGON_MODEL_ID, { source, onReady: () => woke.push('pack') }), null, 'not here yet');
  assert.equal(requestModelIcon(WAGON_MODEL_ID, { source, onReady: () => woke.push('shop') }), null, 'still loading - no second load');
  await settle();
  assert.equal(loads, 1);
  assert.deepEqual(woke, ['pack', 'shop'], 'every list that asked repaints');
  const pic = requestModelIcon(WAGON_MODEL_ID, { source });
  assert.ok(pic?.width > 0);
  assert.equal(requestModelIcon(WAGON_MODEL_ID, { source }), pic, 'the same picture, never baked twice');

  const warn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  try {
    requestModelIcon(99999, { source });
    await settle();
    assert.equal(requestModelIcon(99999, { source }), null);
    await settle();
    assert.equal(loads, 2, 'a model that will not draw is asked for once');
    assert.match(warns.join(' '), /model 99999 would not draw/);
  } finally { console.warn = warn; }
  _resetModelIcons();
});

test('DISC24-B: the classic list (vanilla and Grimoire) draws the Horse from its record and the cart from its model', async () => {
  _resetModelIcons();
  const pictured = requestModelIcon(WAGON_MODEL_ID, { source: async () => ({ model: facingQuad(), texels: () => color32([[[90, 60, 30]]]) }) });
  assert.equal(pictured, null);
  await settle();
  const uploads = [], drawn = [];
  const renderer = {
    textures: new Map(),
    uploadTexture(a, r, c, o = {}) {
      const k = `${a}_${r}${o.mips === false ? (o.variant ?? '#ui') : ''}`;
      if (!this.textures.has(k)) { uploads.push({ k, w: c.width, h: c.height }); this.textures.set(k, { k }); }
      return this.textures.get(k);
    },
    drawScreenQuad(tex, rect, uv) { drawn.push({ k: tex.k, rect, uv }); },
  };
  // the icons object as the scenes build it - a TEXTURE.201 with a horse-sized record 0
  const icons = {
    getTexture: async (archive) => (archive === 201 ? { recordCount: 2, getSize: () => ({ width: 30, height: 22 }) } : { recordCount: 0 }),
    uploadRecord: (archive, record) => { renderer.uploadTexture(archive, record, { width: 30, height: 22 }, { mips: false }); return '#ui'; },
    preloadRecord: async () => null,
    textures: renderer.textures,
  };
  const draw = makeIconDrawer(icons);
  const m = { ox: 0, oy: 0, s: 1 };
  assert.equal(draw(renderer, m, cartItem(), [0, 0, 60, 200], 0), true, 'the cart draws a picture');
  const pic = requestModelIcon(WAGON_MODEL_ID);
  assert.deepEqual(uploads[0], { k: `${MODEL_ICON_ARCHIVE}_${WAGON_MODEL_ID}#ui`, w: pic.width, h: pic.height }, 'uploaded once, as UI art, under its own key');
  assert.deepEqual(drawn[0].uv, { u0: 0, v0: 1, u1: 1, v1: 0 }, 'the V-flipped quad every color32 picture is drawn with');
  assert.ok(drawn[0].rect.w <= 50 - 4 && drawn[0].rect.h <= 38 - 4, 'fitted inside the cell\'s margin');
  draw(renderer, m, cartItem(), [0, 0, 60, 200], 0);
  assert.equal(uploads.length, 1, 'the next frame draws the uploaded texture');

  draw(renderer, m, horseItem(), [0, 0, 60, 200], 1);
  await settle();
  assert.equal(draw(renderer, m, horseItem(), [0, 0, 60, 200], 1), true, 'the horse draws');
  assert.equal(drawn.at(-1).k, '201_0#ui', 'from the animal archive\'s record 0');
  // a boat, still no picture and no model
  assert.equal(draw(renderer, m, { templateIndex: 96, group: 'Transportation' }, [0, 0, 60, 200], 2), false);
  _resetModelIcons();
});

test('DISC24-B: the enhanced lists (pack, detail, shop, player trade) picture the cart through the pack\'s one door', async () => {
  _resetModelIcons();
  const cart = itemLine(cartItem());
  assert.equal(cart.image, null);
  assert.equal(cart.model, WAGON_MODEL_ID, 'the line carries the model the picture is baked from');
  const horse = itemLine(horseItem());
  assert.deepEqual([horse.image.archive, horse.image.record, horse.model], [201, 0, null]);

  const painted = [];
  globalThis.document = {
    createElement: () => {
      const cv = { width: 0, height: 0, toDataURL: () => `data:image/png;cart-${cv.width}x${cv.height}` };
      cv.getContext = () => ({
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img) => painted.push(img), drawImage() {}, imageSmoothingEnabled: true,
      });
      return cv;
    },
  };
  try {
    requestModelIcon(WAGON_MODEL_ID, { source: async () => ({ model: facingQuad(), texels: () => color32([[[200, 0, 0]], [[0, 0, 200]]]) }) });
    let woke = 0;
    assert.equal(linePictureUrl(cart, { scale: 2, onReady: () => woke++ }), null, 'not here yet');
    await settle();
    assert.equal(woke, 1, 'the list repaints when it lands');
    const pic = requestModelIcon(WAGON_MODEL_ID);
    assert.equal(linePictureUrl(cart, { scale: 2 }), `data:image/png;cart-${pic.width * 2}x${pic.height * 2}`, 'a picture at the list\'s scale');
    const img = painted[0];
    const px = (x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
    // down the middle column, the first pixel drawn is the texture's top (red), the last its bottom (blue)
    const mid = Math.trunc(img.width / 2);
    const column = Array.from({ length: img.height }, (_, y) => px(mid, y)).filter((p) => p[3] === 255);
    assert.ok(column.length > 4, 'the column crosses the picture');
    assert.ok(column[0][0] > 0 && column[0][2] === 0, `a canvas's row 0 is its top - the picture is not upside down (${column[0]})`);
    assert.ok(column.at(-1)[2] > 0 && column.at(-1)[0] === 0, `${column.at(-1)}`);
  } finally { delete globalThis.document; _resetModelIcons(); }

  // every enhanced list reads the door, not its own copy of the ternary
  const ROOT = new URL('..', import.meta.url);
  for (const f of ['src/ui/enhancedTrade.js', 'src/ui/enhancedPlayerTrade.js']) {
    assert.match(readFileSync(new URL(f, ROOT), 'utf8'), /linePictureUrl\(line, \{ scale: 2,/, f);
  }
  const inv = readFileSync(new URL('src/ui/enhancedInventory.js', ROOT), 'utf8');
  assert.equal((inv.match(/linePictureUrl\(line, \{ scale: [24], onReady: render \}\)/g) ?? []).length, 2, 'the pack\'s tile and its detail card');
});
