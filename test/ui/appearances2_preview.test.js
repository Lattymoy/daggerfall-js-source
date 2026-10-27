// APPEARANCES-II (2026-10-27; bible/04-Characters/Wardrobe.md section 4): A PREVIEW BEFORE PAYING. A look's name in the
// Wardrobe is a press that tries it on: the window shows the character wearing it on the piece picked - the paper doll, or
// on Enhanced Plus the Morrowind body where the pack shows one - drawn off a stand-in through drawnPiece, and nothing is
// changed until Wear is paid. The doll is the real compositor over a synthetic art set (no ARENA2: every file one palette
// index, so a colour in the composite names the record it came from); the body is the real rig on the fixture data.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DFPalette } from '../../src/formats/dfPalette.js';
import { preloadPaperDollArt, refreshPaperDoll, composeDollFor, paperDollPixels, paperdollItemImage } from '../../src/ui/paperDoll.js';
import { previewWearer, noteHeldLooks, wearAppearance, clearAppearance } from '../../src/systems/appearances.js';
import { createWardrobePreview, PREVIEW_FIGURE_H } from '../../src/ui/wardrobe/wardrobePreview.js';
import { mountWardrobeWindow } from '../../src/ui/wardrobe/wardrobeWindow.js';
import { drawnPiece, lookOfKey } from '../../src/net/appearanceLaw.js';
import { armBuildOptsOf, armRenderer, createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { appearanceOf } from '../../src/net/appearanceLaw.js';
import { createFpArm, fpArm } from '../../src/combat/fpArm.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';
import { withDom } from '../invdrag.mjs';
import { addVendorTextures, clearVendorTextures, setTextureDeriveContext } from '../../src/systems/textureReplacement.js';
import { DYE_COLORS } from '../../src/characters/dyes.js';

const KATANA = '121.7.0', SABER = '119.9.0', DAEDRIC_CHEST = `102.${ARMOR_MATERIAL.Daedric}.3`;
const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));
/** A Breton wearing a Steel longsword and an Iron cuirass, an Ebony katana, a Daedric saber and a Daedric cuirass in the
 *  pack - their looks collected off the pack as the Wardrobe opens - and gold for any of them. */
function wearer() {
  const me = { race: 'Breton', gender: 'male', faceIndex: 0, items: [], activeEffects: [], goldPieces: 20000 };
  const sword = createWeapon(WEAPONS.Longsword, 1), chest = armour(102, ARMOR_MATERIAL.Iron, 1);
  me.items.push(sword, chest, createWeapon(WEAPONS.Katana, 7), createWeapon(WEAPONS.Saber, 9), armour(102, ARMOR_MATERIAL.Daedric, 3));
  equipItem(me, sword); equipItem(me, chest);
  noteHeldLooks(me);
  return { me, sword, chest };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('APPEARANCES-II THE PREVIEW\'S WEARER: a stand-in that reads as the character - its curses, its pack, its race - whose slot holds a copy of the piece wearing the look tried (its own look for none), drawn through drawnPiece; the piece and the character untouched (mutants: the piece itself dressed; the look not laid on the copy; the own look not stripped)', () => {
  const { me, sword, chest } = wearer();
  const stand = previewWearer(me, sword, lookOfKey(KATANA));
  assert.equal(stand.race, 'Breton');
  assert.equal(stand.items, me.items, 'its pack the character\'s');
  const copy = equipTableOf(stand)[EQUIP_SLOTS.RightHand];
  assert.notEqual(copy, sword, 'a copy in the slot');
  assert.deepEqual(copy.appearance, { t: 121, m: 7, v: 0 });
  assert.deepEqual([drawnPiece(copy).templateIndex, drawnPiece(copy).material], [WEAPONS.Katana, 7], 'drawn as the katana');
  assert.equal(equipTableOf(stand)[EQUIP_SLOTS.ChestArmor], chest, 'the rest as worn');
  assert.equal(sword.appearance, undefined, 'the piece as it was');
  assert.equal(equipTableOf(me)[EQUIP_SLOTS.RightHand], sword, 'the character\'s table as it was');
  assert.equal(me.goldPieces, 20000, 'and nothing paid');
  wearAppearance(me, sword, lookOfKey(KATANA));
  const own = equipTableOf(previewWearer(me, sword, null))[EQUIP_SLOTS.RightHand];
  assert.equal('appearance' in own, false, 'its own look tried: the copy wears none');
  assert.deepEqual(sword.appearance, { t: 121, m: 7, v: 0 }, 'while the piece still does');
  // the Morrowind body's build reads the same stand-in: the hand and the worn armour as the looks
  const opts = armBuildOptsOf(previewWearer(me, chest, lookOfKey(DAEDRIC_CHEST)));
  assert.deepEqual(opts.armor.find((p) => p.templateIndex === 102), { templateIndex: 102, material: ARMOR_MATERIAL.Daedric, kind: 'armor' });
  assert.deepEqual(opts.weapon.appearance, { t: 121, m: 7, v: 0 }, 'and the hand what it wears now');
});

// ---- the synthetic art set (test/systems/paperdollloadidentity.test.js's): one palette index a file ------------------
function img(w, h, ox, oy, index) {
  const bytes = new Uint8Array(12 + w * h);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, ox, true); v.setInt16(2, oy, true); v.setInt16(4, w, true); v.setInt16(6, h, true);
  v.setUint16(8, 0, true); v.setUint16(10, w * h, true);
  bytes.fill(index, 12);
  return bytes;
}
function faceCif(base) {
  const parts = Array.from({ length: 10 }, (_, r) => img(20, 20, 240, 20, base + r));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const palette = new DFPalette();
{ const raw = new Uint8Array(768); for (let i = 0; i < 256; i++) raw.fill(i, i * 3, i * 3 + 3); palette.load(raw); }
const ART = { 'SCBG00I0.IMG': 10, 'BODY00I0.IMG': 20, 'BODY00I1.IMG': 21 };
const fetchBytes = async (name) => {
  if (name in ART) return name.startsWith('SCBG') ? img(320, 200, 0, 0, ART[name]) : img(60, 150, 225, 28, ART[name]);
  if (name === 'FACE00I0.CIF') return faceCif(40);
  throw new Error(`no such art: ${name}`);
};
/** An item record's colour: 140 + its record - past the dye bands, so the composite names the record drawn. */
const RECORD_INDEX = (record) => 140 + record;
const getTexture = async () => ({
  recordCount: 64,
  getOffset: (record) => ({ x: 205 + (record % 8) * 13, y: 30 + Math.floor(record / 8) * 13 }),   // each record its own place, so no layer hides another
  getSize: () => ({ width: 12, height: 12 }),
  getDFBitmap: (record) => ({ width: 12, height: 12, data: new Uint8Array(144).fill(RECORD_INDEX(record)) }),
});
const indices = (px) => { const seen = new Set(); for (let i = 0; i < px.rgba.length; i += 4) if (px.rgba[i + 3]) seen.add(px.rgba[i]); return seen; };

test('APPEARANCES-II THE DOLL TRIED ON: the player\'s doll composed for the stand-in draws the look\'s layer where the piece\'s stood, with the player\'s own art - and the inventory\'s own composite, its click mask and the piece are untouched (mutants: the compose reads the piece; the preview recomposes the inventory\'s doll)', async () => {
  const { me, sword } = wearer();
  assert.equal(await composeDollFor(me), null, 'no art loaded: nothing to draw');
  await preloadPaperDollArt({ renderer: { uploadTexture: () => ({}), releaseTexture: () => {} }, palette, fetchBytes, getTexture }, {});
  await refreshPaperDoll(me);
  const inventory = paperDollPixels(), version = inventory?.version;
  assert.ok(inventory, 'the inventory\'s doll composed');
  const own = await composeDollFor(previewWearer(me, sword, null));
  const katana = await composeDollFor(previewWearer(me, sword, lookOfKey(KATANA)));
  const ownRecord = paperdollItemImage(sword).record;
  const lookRecord = paperdollItemImage({ ...sword, appearance: { t: 121, m: 7, v: 0 } }).record;
  assert.notEqual(ownRecord, lookRecord);
  assert.ok(indices(own).has(RECORD_INDEX(ownRecord)) && !indices(own).has(RECORD_INDEX(lookRecord)), 'its own look: the longsword\'s layer');
  assert.ok(indices(katana).has(RECORD_INDEX(lookRecord)) && !indices(katana).has(RECORD_INDEX(ownRecord)), 'tried on: the katana\'s layer');
  assert.ok(indices(katana).has(ART['SCBG00I0.IMG']) && indices(katana).has(40), 'the player\'s own backdrop and face');
  assert.equal(paperDollPixels(), inventory, 'the inventory\'s composite untouched');
  assert.equal(paperDollPixels().version, version);
  assert.ok(indices(inventory).has(RECORD_INDEX(ownRecord)) && !indices(inventory).has(RECORD_INDEX(lookRecord)), 'and still the longsword');
  assert.equal(sword.appearance, undefined);
});

test('AUDIT HORIZONTAL E6: the doll asks a texture pack for a layer in the look\'s metal - an Iron cuirass dressed as a Daedric one draws the pack\'s Daedric picture, never its Iron one (mutant: the ask by the piece\'s own dye)', async () => {
  const { me, chest } = wearer();
  await preloadPaperDollArt({ renderer: { uploadTexture: () => ({}), releaseTexture: () => {} }, palette, fetchBytes, getTexture }, {});
  wearAppearance(me, chest, lookOfKey(DAEDRIC_CHEST));
  const { archive, record } = paperdollItemImage({ ...chest });
  // a dyed pack's two pictures of that record (DW3's names: <archive>_<record>-0_<Dye>), each one flat colour
  const flat = (v) => () => ({ width: 12, height: 12, data: new Uint8Array(12 * 12 * 4).map((_, i) => (i % 4 === 3 ? 255 : v)) });
  setTextureDeriveContext({});
  addVendorTextures([{ archive, record, dye: DYE_COLORS.Daedric, build: flat(77) }, { archive, record, dye: DYE_COLORS.Iron, build: flat(88) }]);
  try {
    await refreshPaperDoll(me);
    const seen = indices(paperDollPixels());
    assert.ok(seen.has(77), 'the pack\'s Daedric cuirass');
    assert.ok(!seen.has(88), 'never its Iron one, the piece\'s own metal');
  } finally { clearVendorTextures(); setTextureDeriveContext(null); }
});

test('APPEARANCES-II THE PREVIEW: it draws the figure the pack shows on this skin - the doll, or on Enhanced Plus the Morrowind body where one stands for the player - and says it is drawing until it lands; a figure is drawn once a look and again when anything worn changes; with no art, none; shut, it draws nothing more (mutants: the body on the classic skin; the doll\'s memo blind to the worn table; the drawing never told; no art drawing anyway)', async () => {
  const { me, sword, chest } = wearer();
  const asked = [];
  const doll = (stand) => { asked.push(equipTableOf(stand)[EQUIP_SLOTS.RightHand]?.appearance ?? null); return Promise.resolve({ width: 2, height: 2, rgba: new Uint8Array(16).fill(7) }); };
  let told = 0;
  const preview = createWardrobePreview({ entity: me, composeDoll: doll, dollArt: () => true, plus: () => false, arm: { canThirdPerson: () => true } });
  assert.deepEqual(preview.figure(sword, lookOfKey(KATANA), () => { told++; }), { kind: 'doll', data: null }, 'drawing');
  await settle();
  assert.equal(told, 1, 'told once it lands');
  const fig = preview.figure(sword, lookOfKey(KATANA));
  assert.deepEqual([fig.kind, fig.width, fig.height, fig.data.length], ['doll', 2, 2, 16]);
  assert.deepEqual(asked, [{ t: 121, m: 7, v: 0 }], 'composed for the look tried');
  preview.figure(sword, lookOfKey(KATANA));
  assert.equal(asked.length, 1, 'a look drawn is kept');
  wearAppearance(me, chest, lookOfKey(DAEDRIC_CHEST));
  preview.figure(sword, lookOfKey(KATANA));
  assert.equal(asked.length, 2, 'the cuirass dressed since: drawn again');
  assert.equal(createWardrobePreview({ entity: me, composeDoll: doll, dollArt: () => false, plus: () => false }).figure(sword, null), null, 'no art: no preview');
  preview.dispose();
  assert.equal(preview.figure(sword, lookOfKey(SABER)), null, 'shut: nothing more');
  // the Morrowind body on Enhanced Plus: a rig of the preview's own, built off the stand-in, unloaded with the window
  const built = [];
  const rig = { attach() {}, build: async (opts) => { built.push(opts); return { ok: true }; }, figure: ({ height }) => ({ width: 1, height, data: new Uint8ClampedArray(4 * height) }), unloaded: 0, unload() { this.unloaded++; } };
  const plus = createWardrobePreview({ entity: me, plus: () => true, arm: { canThirdPerson: () => true }, createRig: () => rig, renderer: () => ({}), composeDoll: doll, dollArt: () => true });
  assert.deepEqual(plus.figure(sword, lookOfKey(SABER), () => {}), { kind: 'body', data: null });
  await settle();
  const body = plus.figure(sword, lookOfKey(SABER));
  assert.deepEqual([body.kind, body.height], ['body', PREVIEW_FIGURE_H], 'the body\'s figure, the pack\'s height');
  assert.deepEqual(drawnPiece(built[0].weapon).templateIndex, WEAPONS.Saber, 'built holding the look tried');
  assert.deepEqual(built[0].armor.find((p) => p.templateIndex === 102).material, ARMOR_MATERIAL.Daedric, 'and wearing the cuirass\'s');
  const classic = createWardrobePreview({ entity: me, plus: () => false, arm: { canThirdPerson: () => true }, createRig: () => { throw new Error('no body on the classic skin'); }, composeDoll: doll, dollArt: () => true });
  assert.equal(classic.figure(sword, null).kind, 'doll', 'the classic skin: the doll');
  plus.dispose();
  assert.equal(rig.unloaded, 1, 'the rig unloaded with the window');
});

test('APPEARANCES-II THE BODY, BUILT: the preview\'s own rig on the fixture data stands the body and renders its portrait at the pack\'s height; a look tried while one builds waits its turn, one passed over is never built (mutants: a second build on top of the first; the passed-over look built)', async () => {
  const { me, sword } = wearer();
  const renderer = countingRenderer();
  renderer.updateParticleEffect = () => {};
  const shots = [];
  renderer.renderCharacterSpriteImage = (mesh, model, proj, view, w, h) => { shots.push([w, h]); return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
  const rigs = [], opts = [];
  const preview = createWardrobePreview({
    entity: me, plus: () => true, arm: { canThirdPerson: () => true }, renderer: () => renderer,
    createRig: () => { const r = createFpArm(); rigs.push(r); return r; },
    buildOpts: (stand) => { const o = { race: 'fprace', deps: fixtureBodyDeps(), weapon: equipTableOf(stand)[EQUIP_SLOTS.RightHand] }; opts.push(o); return o; },
    dollArt: () => false,
  });
  let told = 0;
  preview.figure(sword, lookOfKey(KATANA), () => { told++; });
  preview.figure(sword, lookOfKey(SABER), () => { told++; });   // passed over while the katana builds...
  preview.figure(sword, null, () => { told++; });   // ...by its own look
  for (let i = 0; i < 50 && told < 2; i++) await settle();
  assert.equal(told, 2);
  assert.equal(rigs.length, 1, 'one rig');
  assert.deepEqual(opts.map((o) => o.weapon.appearance ?? null), [{ t: 121, m: 7, v: 0 }, null], 'the katana, then its own look - the saber never built');
  const fig = preview.figure(sword, null);
  assert.equal(fig.kind, 'body');
  assert.equal(fig.height, PREVIEW_FIGURE_H);
  assert.ok(shots.length >= 2 && shots.every(([, h]) => h === PREVIEW_FIGURE_H), 'its portrait');
  // the look passed over is built when it is asked again - never left drawing
  preview.figure(sword, lookOfKey(SABER), () => { told++; });
  for (let i = 0; i < 50 && told < 3; i++) await settle();
  assert.ok(preview.figure(sword, lookOfKey(SABER)).data, 'drawn');
  assert.deepEqual(opts.at(-1).weapon.appearance, { t: 119, m: 9, v: 0 });
  preview.dispose();
  assert.equal(rigs[0].status().reason, 'unloaded');
  // the renderer it draws with: the one every host's weapon rig binds the player's arm to, the last binding's
  const CANVAS = { clientWidth: 800, clientHeight: 600 };
  const mkRig = (r) => createWeaponRig({ renderer: r, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); }, palette: null, audio: { playOneShot() {} }, entity: { items: [] }, camera: () => null });
  const exterior = { id: 'exterior' }, dungeon = { id: 'dungeon' };
  const outside = mkRig(exterior);
  assert.equal(armRenderer(), exterior);
  mkRig(dungeon);
  assert.equal(armRenderer(), dungeon);
  outside.frame(0.016);
  assert.equal(armRenderer(), exterior, 'the stepping rig\'s');
  fpArm.attach(null, null);
});

const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;

test('APPEARANCES-II THE WINDOW TRIES IT ON: a look\'s name and picture is a press that shows the character wearing it, said in the card\'s preview - nothing paid and the piece unchanged; its own look tried the same; Wear pays as ever and the preview shows what is worn; another piece starts at what it wears; no figure, no preview; shut, the preview goes (mutants: the preview never shown; a Try that dresses the piece; the Try\'s look not handed on; the preview kept across pieces; the preview never let go)', () => {
  const { me, sword } = wearer();
  const asked = [];
  let fig = { kind: 'doll', width: 2, height: 4, data: new Uint8ClampedArray(32) };
  let disposed = 0;
  const preview = { figure: (item, look) => { asked.push([item, look]); return fig; }, dispose: () => { disposed++; } };
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountWardrobeWindow(host, { entity: me, picture: () => null, nameOf: (it) => it.name, preview, wear: (item, look) => wearAppearance(me, item, look), clear: (item) => clearAppearance(me, item) });
    try {
      const shell = one(host, 'wardrobe-shell');
      kids(shell, 'wardrobe-piece')[1].onclick();
      let card = one(shell, 'wardrobe-card');
      assert.equal(one(card, 'wardrobe-preview-name').textContent, 'Steel Longsword', 'the piece as it looks now');
      assert.equal(asked.at(-1)[1], null, 'its own look');
      const tries = kids(card, 'wardrobe-try');
      assert.deepEqual(tries.map((t) => one(t, 'wardrobe-name').textContent), ['Its own look', 'Daedric Saber', 'Ebony Katana']);
      assert.deepEqual(tries.map((t) => t.attrs['aria-pressed']), ['true', 'false', 'false']);
      assert.equal(tries[2].attrs['aria-label'], 'Try Ebony Katana');
      tries[2].onclick({ stopPropagation() {} });
      card = one(shell, 'wardrobe-card');
      assert.equal(asked.at(-1)[0], sword);
      assert.equal(asked.at(-1)[1], lookOfKey(KATANA), 'the look tried, handed on');
      assert.equal(one(card, 'wardrobe-preview-name').textContent, 'Ebony Katana');
      const cv = one(card, 'wardrobe-figure');
      assert.equal(cv.tagName, 'CANVAS');
      assert.deepEqual([cv.className, cv.width, cv.height, cv.attrs['aria-label']], ['wardrobe-figure doll', 2, 4, 'Preview of Ebony Katana']);
      assert.deepEqual(kids(card, 'wardrobe-try').map((t) => t.attrs['aria-pressed']), ['false', 'false', 'true']);
      assert.equal(sword.appearance, undefined, 'tried, not worn');
      assert.equal(me.goldPieces, 20000, 'nothing paid');
      kids(card, 'wardrobe-try')[0].onclick({ stopPropagation() {} });
      assert.equal(one(one(shell, 'wardrobe-card'), 'wardrobe-preview-name').textContent, 'Steel Longsword', 'its own look tried');
      kids(one(shell, 'wardrobe-card'), 'wardrobe-try')[1].onclick({ stopPropagation() {} });
      kids(one(shell, 'wardrobe-card'), 'wardrobe-press')[2].onclick({ stopPropagation() {} });   // Wear the katana
      card = one(shell, 'wardrobe-card');
      assert.deepEqual(sword.appearance, { t: 121, m: 7, v: 0 }, 'Wear pays and dresses');
      assert.equal(one(card, 'wardrobe-preview-name').textContent, 'Ebony Katana', 'the preview shows what is worn');
      kids(one(shell, 'wardrobe-card'), 'wardrobe-try')[1].onclick({ stopPropagation() {} });   // the saber tried
      kids(shell, 'wardrobe-piece')[0].onclick();
      assert.equal(asked.at(-1)[1], null, 'another piece: what it wears');
      kids(shell, 'wardrobe-piece')[1].onclick();
      assert.equal(asked.at(-1)[1], appearanceOf(sword), 'and back again: what it wears, not the look last tried');
      fig = { kind: 'body', data: null };
      view.repaint();
      assert.equal(one(one(shell, 'wardrobe-card'), 'wardrobe-figure').className, 'wardrobe-figure body busy', 'drawing: its frame');
      fig = null;
      view.repaint();
      assert.equal(one(one(shell, 'wardrobe-card'), 'wardrobe-preview'), null, 'nothing to draw it with: no preview');
    } finally { view.unmount(); }
    assert.equal(disposed, 1, 'shut, it goes');
  });
});
