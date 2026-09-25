// DECOR2a (2026-09-25, Mac: "rare misc artifacts and other items in the world can also be placed"; asked, placing one
// is "Free and can be picked back up", and a home, house or ship sold with them standing gives them "Back to pack"):
// YOUR OWN THINGS IN A ROOM. The piece's law (net/decorLaw.js: which item, as the game's own numbers; free; holding
// nothing), what of the pack can stand and as what (systems/decorItems.js), the room and the scene keeping the thing
// itself (scenes/decorRoom.js, systems/sceneCache.js), the panel's "Your things" (ui/decorPanel.js), the tool setting
// one down and taking it back, offline and online (scenes/decorTool.js), and the host's wiring by source. The
// service's half is pinned with the service (decor1.test.js). `06-Systems/Online-Arc.md` DECOR2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorItemOf, decorWhatOf, decorPieceOf, DECOR_CAP } from '../src/net/decorLaw.js';
import { decorEditPrice } from '../src/scenes/decorTool.js';
import {
  decorStandOf, decorItemFlat, decorDescriptorOf, decorItemName, decorOwnEntry, decorOwnBackLine, DECOR_OWN_NEVER_GROUPS, DECOR_OWN_KEPT_BACK,
} from '../src/systems/decorItems.js';
import { setMagicItemTemplates } from '../src/systems/loot.js';
import { bookTitle } from '../src/systems/books.js';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { createSceneCache, cacheScene, restoreCachedScene, takeSceneOwn } from '../src/systems/sceneCache.js';
import { createDecorPanel, DECOR_OWN_LINE, decorPlacedSub } from '../src/ui/decorPanel.js';
import { settle, fakeDoc, fakeWin, all, one, chipNamed, catalogue, rows, toolRig } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const statue = () => ({ templateIndex: 265, group: 'ReligiousItems', stackCount: 1 });
const candles = (n = 3) => ({ templateIndex: 253, group: 'UselessItems2', stackCount: n });
const ruby = () => ({ templateIndex: 0, group: 'Gems', stackCount: 1 });
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const barOf = (rig) => rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent)));
const tab = (root, re) => all(root, 'dfdecor-chip').find((c) => re.test(c.textContent));
const pick = (root) => ['dfdecor-pick-name', 'dfdecor-pick-line', 'dfdecor-pick-price', 'dfdecor-pick-why'].map((c) => one(root, c).textContent);
const key = (rig, code) => rig.win.fire('keydown', { code, target: rig.doc.body });

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2a the piece\'s law: which item an own piece shows is the game\'s own numbers alone - a template, and its group, material, variant, artifact and message, each bounded or null; it rides a flat and nothing else, and a bad one refuses the piece; an own piece costs nothing and holds nothing, or it is no piece - a catalogue flat keeps its cost (mutants: a bound unread, an item on a model, a bad item passed over, the cost or the hold allowed)', () => {
  assert.deepEqual(decorItemOf({ t: 265 }), { t: 265, g: null, m: null, v: null, a: null, p: null });
  assert.deepEqual(decorItemOf({ t: 0, g: 63, m: 0xffff, v: 255, a: 255, p: 0xffff }), { t: 0, g: 63, m: 0xffff, v: 255, a: 255, p: 0xffff });
  for (const bad of [null, 'x', {}, { t: -1 }, { t: 10000 }, { t: 1.5 }, { t: 1, g: 64 }, { t: 1, m: 0x10000 }, { t: 1, v: 256 }, { t: 1, a: 256 }, { t: 1, p: 0x10000 }, { t: 1, p: -1 }, { t: 1, m: 'iron' }]) {
    assert.equal(decorItemOf(bad), null, JSON.stringify(bad));
  }
  const item = { t: 265, g: 10 };
  assert.deepEqual(decorWhatOf({ model: null, flat: [202, 5], item }), { model: null, flat: [202, 5], item: { t: 265, g: 10, m: null, v: null, a: null, p: null } });
  assert.deepEqual(decorWhatOf({ model: null, flat: [202, 5] }), { model: null, flat: [202, 5] }, 'a catalogue flat carries none');
  assert.equal(decorWhatOf({ model: 41000, flat: null, item }), null, 'never on a model');
  assert.equal(decorWhatOf({ model: null, flat: [202, 5], item: { t: -1 } }), null, 'a bad item refuses the piece');
  const place = { id: 'o1', model: null, flat: [202, 5], item, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 };
  assert.ok(decorPieceOf(place));
  assert.equal(decorPieceOf({ ...place, paid: 1 }), null, 'an own piece costs nothing');
  assert.equal(decorPieceOf({ ...place, storage: true }), null, 'and holds nothing');
  assert.equal(decorPieceOf({ ...place, item: undefined, paid: 40 })?.paid, 40, 'a catalogue flat keeps its cost');
  assert.deepEqual(decorEditPrice(0.8, { item: { t: 265 }, paid: 0 }, 2), { pay: 0, refund: 0, paid: 0 }, 'one\'s own, resized whatever its size, stays free');
  assert.ok(decorEditPrice(0.8, { paid: 120 }, 2).pay > 0, 'a bought piece\'s growth is paid for');
});

// ─── WHAT CAN STAND ──────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2a what of the pack can stand, and as what: a statue, a painting, a gem, a lit candle, a book, a plant - each as Daggerfall\'s own world picture (the item\'s own first: an artifact\'s, a potion\'s bottle), lit where the catalogue\'s would be; never anything worn, a quest\'s, a summoned thing, a map, a weapon or armour (they are mounted), coin, a vehicle, a deed, a letter of credit, the spellbook, or anything without a picture; named from its numbers alone as the list names it - an artifact\'s own, a book\'s title, a plant\'s northern or southern, a blade\'s material (mutants: a worn item listed, a weapon stood, the spellbook set down, the template\'s picture over the item\'s own, the group dropped, the artifact index misread, a message kept on a statue)', () => {
  const s = decorStandOf(statue());
  assert.deepEqual(s, { flat: [202, 5], light: null, item: { t: 265, g: 10, m: null, v: null, a: null, p: null } });
  const c = decorStandOf(candles());
  assert.deepEqual(c.flat, [210, 3]);
  assert.ok(c.light && c.light.range > 0, 'a candle is lit, as the catalogue\'s is');
  assert.deepEqual(decorStandOf({ templateIndex: 284, group: 'Paintings', message: 4321 })?.item, { t: 284, g: 13, m: null, v: null, a: null, p: 4321 });
  assert.equal(decorStandOf({ ...statue(), message: 77 })?.item.p, null, 'a message only where it names the thing');
  for (const [why, item] of [
    ['worn', { templateIndex: 135, group: 'Jewellery', equipSlot: 'Ring0' }],
    ['a quest\'s', { ...statue(), questItem: true }],
    ['summoned', { ...statue(), timeForItemToDisappear: 100 }],
    ['a map', { templateIndex: 287, group: 'MiscItems' }],
    ['a weapon', { templateIndex: 120, group: 'Weapons', material: 5 }],
    ['armour', { templateIndex: 111, group: 'Armor' }],
    ['coin', { templateIndex: 276, group: 'Currency' }],
    ['a letter of credit', { templateIndex: 275, group: 'MiscItems' }],
    ['a deed', { templateIndex: 285, group: 'MiscItems' }],
    ['the spellbook', { templateIndex: 132, group: 'MiscItems' }],
    ['no picture', { templateIndex: 221, group: 'Furniture' }],
    ['unknown', { templateIndex: 99999, group: 'MiscItems' }],
  ]) assert.equal(decorStandOf(item), null, why);
  assert.ok(DECOR_OWN_NEVER_GROUPS.has('Weapons') && DECOR_OWN_KEPT_BACK.has(132));
  // the item's own picture first
  assert.deepEqual(decorItemFlat({ templateIndex: 83, group: 'UselessItems1', worldTextureArchive: 205, worldTextureRecord: 33 }), [205, 33], 'a potion\'s own bottle');
  assert.deepEqual(decorItemFlat({ templateIndex: 83, group: 'UselessItems1' }), [205, 11], 'else the template\'s');
  const star = { templateIndex: 0, group: 'Gems', artifact: true, artifactIndexBitfield: (9 << 1) | 1, worldTextureArchive: 432, worldTextureRecord: 9 };
  assert.deepEqual(decorStandOf(star), { flat: [432, 9], light: null, item: { t: 0, g: 14, m: null, v: null, a: 9, p: null } });
  assert.equal(decorDescriptorOf({ ...star, artifactIndexBitfield: 18 })?.a, null, 'an index without its flag bit is no index');
  // names from the numbers alone
  const artifacts = Array.from({ length: 12 }, (_, i) => ({ type: 1, name: i === 9 ? 'Azura\'s Star' : `Artifact ${i}` }));
  try {
    setMagicItemTemplates([{ type: 0, name: 'Not an artifact' }, ...artifacts]);
    assert.equal(decorItemName(decorStandOf(star).item), 'Azura\'s Star', 'counted among the artifacts alone');
  } finally { setMagicItemTemplates(null); }
  assert.equal(decorItemName(decorStandOf(star).item), 'Ruby', 'MAGIC.DEF unread: the template\'s');
  assert.equal(decorItemName({ t: 277, g: 7, p: 5 }), bookTitle(5));
  assert.equal(decorItemName({ t: 8, g: 15 }), 'Twigs (northern)');
  assert.equal(decorItemName({ t: 8, g: 16 }), 'Twigs (southern)');
  assert.match(decorItemName({ t: 120, g: 3, m: 7 }), /^Ebony Longsword$/);
  assert.equal(decorItemName({ t: 99999 }), null);
  assert.equal(decorItemName({ t: -1 }), null);
  // the panel's row
  const e = decorOwnEntry(candles(), 4);
  assert.deepEqual([e.key, e.kind, e.name, e.count, e.flat, e.storage, !!e.light], ['own:4', 'own', 'Candle', 3, [210, 3], false, true]);
  assert.ok(e.icon && Number.isInteger(e.icon.archive), 'the pack\'s own picture');
  assert.equal(decorOwnEntry(ruby(), 0).icon.archive, 254, 'a gem with no pack picture draws its world one');
  const armbands = decorOwnEntry({ templateIndex: 142, group: 'MensClothing' }, 1);
  assert.deepEqual([armbands.flat, armbands.icon.archive !== armbands.flat[0], Number.isInteger(armbands.icon.dye)], [[204, 0], true, true], 'the pack\'s own picture, dye and all - not the world\'s');
  assert.equal(decorOwnEntry({ templateIndex: 120, group: 'Weapons' }, 0)?.mount, true, 'a blade stands not - it hangs (DECOR2c)');
  assert.equal(decorOwnBackLine(1), 'One of your things that stood in it came back to your pack.');
  assert.equal(decorOwnBackLine(3), '3 of your things that stood in it came back to your pack.');
});

// ─── THE ROOM AND THE SCENE KEEP THE THING ───────────────────────────────────────────────────────────────────────────

test('DECOR2a the room keeps the owner\'s own things by piece id and the scene carries them: kept, named, taken back once, written as copies and read back detached, forgotten at the teardown; the scene\'s copy is its own, and a sold room gives them up once (mutants: the record shared, taken twice, kept through the teardown, a sold room giving them twice)', () => {
  const room = createDecorRoom({ meshes: { getGpuMesh: async () => null, cpuModels: new Map() }, renderer: null, getTexture: async () => null, uploadRecord() {}, collider: () => null, origin: () => [0, 0, 0] });
  const s = statue();
  room.keepOwn('o1', s);
  room.keepOwn('o2', ruby());
  assert.equal(room.ownOf('o1'), s);
  assert.deepEqual(room.ownIds(), ['o1', 'o2']);
  const snap = room.ownSnapshot();
  assert.deepEqual(snap.o1, s);
  assert.notEqual(snap.o1, s, 'written as copies');
  assert.equal(room.takeOwn('o1'), s);
  assert.equal(room.takeOwn('o1'), null, 'once');
  room.setOwn({ o3: { templateIndex: 253, group: 'UselessItems2' }, bad: null });
  assert.deepEqual(room.ownIds(), ['o3'], 'restored as the record says, the rest dropped');
  room.destroyAll();
  assert.deepEqual(room.ownIds(), [], 'the room goes, and its record with it (the scene already wrote it)');
  // the scene
  const cache = createSceneCache();
  const entry = { decorOwn: { o1: s } };
  cacheScene(cache, 'House', entry);
  entry.decorOwn.o1.stackCount = 99;
  const back = restoreCachedScene(cache, 'House');
  assert.equal(back.decorOwn.o1.stackCount, 1, 'detached at the store');
  cacheScene(cache, 'House', { decorOwn: { o1: statue(), o2: ruby() } });
  assert.deepEqual(takeSceneOwn(cache, 'House').map((x) => x.templateIndex), [265, 0]);
  assert.deepEqual(takeSceneOwn(cache, 'House'), [], 'a sold room gives them up once');
  assert.deepEqual(takeSceneOwn(cache, 'Nowhere'), []);
  assert.deepEqual(restoreCachedScene(cache, 'Old'), null);
  cacheScene(cache, 'Old', {});
  assert.deepEqual(restoreCachedScene(cache, 'Old').decorOwn, {}, 'a scene written before DECOR2 holds none');
});

// ─── THE PANEL ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2a the panel\'s "Your things": a third tab with its count; each thing with its pack picture, its count, free; one chosen says so and Place stands ready - idle, and saying why, when the room is full - and places it, the panel going first; showOwn chooses one; in the room, an own piece says it is yours and goes back to the pack - "Take down", never holding things (mutants: the tab uncounted, a price shown, the cap unread, Place under the panel, the room\'s words a cost, Holds things open to one\'s own)', async () => {
  const doc = fakeDoc();
  const win = fakeWin();
  const calls = [];
  let closed = 0;
  const panel = createDecorPanel({
    doc, win, onPlace: (e) => calls.push(['place', e.key]), onClose: () => { closed++; },
    onMove: (p) => calls.push(['move', p.id]), onRemove: (p) => calls.push(['remove', p.id]), onToggle: (p, w) => calls.push([w, p.id]),
    thumbOf: async (e) => `data:${e.key}`,
  });
  const own = [decorOwnEntry(statue(), 0), decorOwnEntry(candles(), 2)];
  const mine = { id: 'o9', model: null, flat: [202, 5], item: { t: 265, g: 10 }, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 };
  let count = 1;
  const view = () => ({
    where: 'Your house', entries: catalogue(), progress: 1, ready: true, gold: 0, count, cap: DECOR_CAP, radiusOf: () => 0.5, priceOf: () => 75,
    placed: [{ piece: mine, name: 'Small Statue', entry: null, holds: false, own: true }], own,
  });
  panel.open(view());
  const root = panel.root;
  tab(root, /^Your things/).fire('click');
  assert.deepEqual([panel.mode(), one(root, 'dfdecor-card').dataset.mode, tab(root, /^Your things/).textContent], ['own', 'own', 'Your things (2)']);
  const line = (r) => [one(r, 'dfdecor-row-name').textContent, one(r, 'dfdecor-row-sub').textContent, one(r, 'dfdecor-row-price').textContent];
  assert.deepEqual(rows(root).map(line), [['Small Statue', DECOR_OWN_LINE, 'free'], ['Candle (3)', DECOR_OWN_LINE, 'free']]);
  await settle();
  assert.equal(one(rows(root)[0], 'dfdecor-thumb').children[0].getAttribute('src'), 'data:own:0', 'its pack picture');
  assert.equal(pick(root)[0], 'Choose one of your things');
  rows(root)[1].fire('click');
  assert.deepEqual(pick(root), ['Candle', DECOR_OWN_LINE, 'Free', '']);
  const place = btn(root, 'Place');
  assert.equal(place.disabled, false, 'free - whatever the gold (none here)');
  count = DECOR_CAP;
  panel.update(view());
  assert.deepEqual([btn(root, 'Place').disabled, pick(root)[3]], [true, `This room already holds ${DECOR_CAP} pieces.`], 'a full room is full');
  count = 1;
  panel.update(view());
  btn(root, 'Place').fire('click');
  assert.deepEqual([closed, panel.isOpen(), calls], [1, false, [['place', 'own:2']]], 'the panel goes, then the placing begins');
  panel.open(view());
  panel.showOwn('own:0');
  assert.deepEqual([panel.mode(), pick(root)[0]], ['own', 'Small Statue']);
  // in the room
  panel.showRoom('o9');
  assert.deepEqual(line(rows(root)[0]), ['Small Statue', 'yours - back to your pack when taken down', 'yours']);
  assert.deepEqual(pick(root).slice(0, 3), ['Small Statue', 'yours - back to your pack when taken down', 'Take down: back to your pack']);
  assert.deepEqual([btn(root, /^Take down$/)?.disabled, btn(root, /^Holds things/).disabled, btn(root, 'Move').disabled], [false, true, false]);
  calls.length = 0;
  btn(root, 'Take down').fire('click');
  assert.deepEqual(calls, [['remove', 'o9']], 'the tool\'s taking-down, through the one door');
  assert.equal(decorPlacedSub({ piece: { ...mine, light: { color: [1, 1, 1], range: 5, intensity: 1 } }, holds: false }), 'yours - back to your pack when taken down - gives light');
  panel.destroy();
});

// ─── THE TOOL ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** From the panel's "Your things": choose the thing named `name` and press Place; the flight's first frames. */
async function setDown(rig, name) {
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'own') tab(root, /^Your things/).fire('click');
  rows(root).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith(name)).fire('click');
  btn(root, 'Place').fire('click');
  rig.frame();
  await settle();
  rig.frame();
}
async function openAll(rig) {
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
}

test('DECOR2a setting one\'s own thing down offline: from "Your things" the same free camera flies it, the bar saying it is free; set down, it stands - its piece the item\'s numbers, costing nothing - and the thing itself leaves the pack (one of a stack) into the room\'s keeping, and the panel is the pack\'s list again; a candle stands lit; moved or resized it stays free; made to hold things, no; taken down, it is back in the pack, the same thing (mutants: gold asked, the item left in the pack, the whole stack taken, the record unkept, a resize charged, the thing not given back)', async () => {
  const rig = toolRig({ gold: 0 });
  const s = statue();
  const c = candles(3);
  const fiery = { templateIndex: 0, group: 'Gems', stackCount: 1, name: '%it of Fire', isIdentified: true };
  rig.pack.push(s, { templateIndex: 120, group: 'Weapons' }, c, fiery);
  await openAll(rig);
  assert.equal(tab(panelOf(rig), /^Your things/).textContent, 'Your things (4)', 'the blade is listed to hang (DECOR2c), not to stand');
  tab(panelOf(rig), /^Your things/).fire('click');
  const candleKey = rows(panelOf(rig)).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith('Candle')).dataset.key;
  await setDown(rig, 'Small Statue');
  assert.equal(rig.tool.flying(), true);
  assert.equal(one(barOf(rig), 'dfdecor-bar-what').textContent, 'Small Statue - free');
  assert.equal(rig.tool.why(), null, 'no gold needed');
  const ghost = rig.tool.ghost();
  assert.deepEqual([ghost.flat, ghost.item, ghost.paid], [[202, 5], { t: 265, g: 10, m: null, v: null, a: null, p: null }, 0]);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.standing.map((p) => p.id), rig.w.paid], [[ghost.id], []], 'standing, and nothing paid');
  assert.equal(rig.owned.get(ghost.id), s, 'the thing itself in the room\'s keeping');
  assert.ok(!rig.pack.includes(s), 'and out of the pack');
  assert.equal(rig.tool.flying(), false);
  assert.deepEqual([one(panelOf(rig), 'dfdecor-card').dataset.mode, rig.said.at(-1)], ['own', 'Small Statue set down.'], 'back to the pack\'s list');
  // the rows keep their keys by the thing, not its place: the statue gone, the candle's row is the candle's still
  const keyOf = (name) => rows(panelOf(rig)).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith(name))?.dataset.key;
  assert.equal(keyOf('Candle'), candleKey, 'a thing set down moves no other row\'s key (the picture rides the key)');
  // one candle of three, lit
  await setDown(rig, 'Candle');
  key(rig, 'KeyE');
  await settle();
  const candle = rig.standing[1];
  assert.ok(candle.light, 'lit, as a candle stands');
  assert.equal(c.stackCount, 2, 'one of the stack');
  assert.equal(rig.owned.get(candle.id).stackCount, 1);
  // moved and resized: free
  rig.frame();
  const root = panelOf(rig);
  tab(root, /^In this room/).fire('click');
  rows(root).find((r) => r.dataset.key === candle.id).fire('click');
  btn(root, 'Move').fire('click');
  rig.frame();
  await settle();
  rig.frame();
  key(rig, 'Equal');
  rig.frame();
  assert.equal(one(barOf(rig), 'dfdecor-bar-what').textContent, 'Moving Candle - free');
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.standing[1].scale, rig.standing[1].paid, rig.w.paid], [1.1, 0, []], 'resized, and still free');
  // the owner reads the thing's own name - what the room keeps - where a visitor reads its numbers
  await setDown(rig, 'Ruby of Fire');
  key(rig, 'KeyE');
  await settle();
  rig.frame();
  const gem = rig.standing.find((p) => p.flat[0] === 254);
  assert.equal(rows(panelOf(rig)).find((r) => r.dataset.key === gem.id), undefined, 'the pack\'s list, not the room\'s');
  tab(panelOf(rig), /^In this room/).fire('click');
  assert.equal(one(rows(panelOf(rig)).find((r) => r.dataset.key === gem.id), 'dfdecor-row-name').textContent, 'Ruby of Fire', 'its own name, not "Ruby"');
  // holding things: never
  rig.frame();
  rows(panelOf(rig)).find((r) => r.dataset.key === candle.id).fire('click');
  assert.equal(btn(panelOf(rig), /^Holds things/).disabled, true);
  // taken down
  rows(panelOf(rig)).find((r) => r.dataset.key === ghost.id).fire('click');
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([rig.standing.map((p) => p.id), rig.pack.includes(s), rig.owned.has(ghost.id)], [[candle.id, gem.id], true, false], 'back in the pack, the same thing');
  assert.equal(rig.said.at(-1), 'Small Statue is back in your pack.');
});

test('DECOR2a one\'s own thing and an online home: the account service has the piece first and only then does the thing leave the pack - refused, it never leaves and the bar says the word; the room left, or the thing gone from the pack, while the service was asked, the piece is taken back out; taken down, the service first - refused, it stays; a piece this save never kept is only taken down (mutants: the thing gone before the answer, a refusal taking it, the undo skipped, a refused taking-down given back)', async () => {
  const calls = [];
  const svc = {
    placeAnswer: null,
    removeAnswer: null,
    async place(a) { calls.push(['place', a.piece.id]); return svc.placeAnswer ? svc.placeAnswer(a) : { ok: true, data: { piece: a.piece } }; },
    async move(a) { calls.push(['move', a.id]); return { ok: true, data: { piece: a.place } }; },
    async remove(a) { calls.push(['remove', a.id]); return svc.removeAnswer ? svc.removeAnswer(a) : { ok: true, data: {} }; },
  };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 0 });
  const s = statue();
  const r1 = ruby();
  rig.pack.push(s, r1);
  await openAll(rig);
  // refused
  svc.placeAnswer = () => ({ ok: false, error: 'decor-rate' });
  await setDown(rig, 'Small Statue');
  key(rig, 'KeyE');
  await settle();
  rig.frame();
  assert.deepEqual([rig.pack.includes(s), rig.standing.length, rig.tool.why()], [true, 0, 'refused: decor-rate'], 'refused: it never leaves');
  // the room left while the service was asked
  svc.placeAnswer = (a) => { rig.setVisit(2); return { ok: true, data: { piece: a.piece } }; };
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([calls.map((x) => x[0]), rig.pack.includes(s), rig.standing.length], [['place', 'remove'], true, 0], 'taken back out');
  rig.setVisit(1);
  // the thing gone from the pack meanwhile
  svc.placeAnswer = (a) => { rig.pack.splice(rig.pack.indexOf(s), 1); return { ok: true, data: { piece: a.piece } }; };
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([calls.map((x) => x[0]), rig.standing.length], [['place', 'remove'], 0]);
  rig.frame();
  assert.equal(rig.tool.why(), 'It is no longer in your pack.', 'the bar says why');
  rig.pack.unshift(s);
  // set down
  svc.placeAnswer = null;
  key(rig, 'Escape');
  await setDown(rig, 'Small Statue');
  key(rig, 'KeyE');
  await settle();
  const piece = rig.standing[0];
  assert.ok(piece && !rig.pack.includes(s) && rig.owned.get(piece.id) === s, 'the service had it, then the pack gave it up');
  // taken down: refused, then done
  svc.removeAnswer = () => ({ ok: false, error: 'no-decor' });
  rig.frame();
  tab(panelOf(rig), /^In this room/).fire('click');
  rows(panelOf(rig)).find((r) => r.dataset.key === piece.id).fire('click');
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([rig.standing.length, rig.pack.includes(s), rig.said.at(-1)], [1, false, 'refused: no-decor'], 'refused: it stays');
  svc.removeAnswer = null;
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([rig.standing.length, rig.pack.includes(s)], [0, true]);
  // a piece this save never kept (an older save than the placing): only taken down
  rig.standing.push({ id: 'ghost1', model: null, flat: [254, 0], item: { t: 0, g: 14, m: null, v: null, a: null, p: null }, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  rig.frame();
  rows(panelOf(rig)).find((r) => r.dataset.key === 'ghost1').fire('click');
  const before = rig.pack.length;
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([rig.standing.length, rig.pack.length, rig.said.at(-1)], [0, before, 'Ruby taken down.'], 'named from its numbers, nothing given');
});

// ─── THE HOST ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2a the host (worldModes.js) by source: the tool\'s pack is the player\'s, a thing leaves it as a drop moves it and comes back through the pack\'s own door; the save writes and restores the room\'s own things; an online home\'s owner gets back any thing its room no longer stands, a visitor never; a piece is named by the owner\'s own record, else its numbers; a sold house, ship or online home gives its own things back to the pack and pays only for what was bought; the pack\'s pictures wear their dye (mutants: the transfer bypassed, the save forgetting them, a visitor handed another\'s things, a sale keeping them)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /pack: \(\) => playerEntity\.items \?\? \[\], identity: \(\) => playerEntity,/);
  assert.match(m, /packHas: \(item\) => decorHome\(item\)\.includes\(item\), packTake: \(item\) => decorPackTake\(item\), packGive: \(item\) => decorPackGive\(item\),/);   // DECOR2b: furniture lives among the deliveries
  assert.match(m, /return applyTransfer\(item, \{ ok: true, amount: 1 \}, pack, \[\], \{ entity: playerEntity, fromLocal: true \}\) \?\? null;/, 'as a drop moves it');
  assert.match(m, /function decorPackGive\(item\) \{\n\s*if \(isFurnishing\(item\)\) \{ decorHome\(item\)\.push\(item\); return; \}\n\s*playerEntity\.items \?\?= \[\];\n\s*addItem\(playerEntity\.items, item\);/);   // DECOR2b: furniture first
  assert.match(m, /const decorOwn = interiorDecor\.ownSnapshot\(\);/);
  assert.match(m, /decor, decorItems, decorOwn, frame: 'building'/);
  assert.match(m, /interiorDecor\.setItems\(data\.decorItems\);\n\s*interiorDecor\.setOwn\(data\.decorOwn\);/);
  assert.match(m, /interiorDecor\.set\(pieces\);\n\s*if \(interiorHome\?\.own\) decorReturnStrays\(pieces\);/, 'the owner alone');
  assert.match(m, /for \(const id of interiorDecor\.ownIds\(\)\) \{\n\s*if \(standing\.has\(id\)\) continue;\n\s*const item = interiorDecor\.takeOwn\(id\);\n\s*if \(item\) \{ decorPackGive\(item\); back\.push\(item\); \}/);
  assert.match(m, /const kept = interiorDecor\.ownOf\(piece\.id\);\n\s*const n = \(kept \? itemLongName\(kept\) : null\) \|\| decorItemName\(piece\.item\);/);
  assert.match(m, /const own = takeSceneOwn\(sceneCache\(\), sceneName\);[^\n]*\n\s*for \(const item of own\) decorPackGive\(item\);/, 'a sold house or ship');
  assert.match(m, /const own = takeSceneOwn\(sceneCache\(\), homeSceneName\(mapId, bd\.buildingKey\)\);[^\n]*\n\s*for \(const item of own\) decorPackGive\(item\);\n\s*removePermanentScene\(sceneCache\(\), homeSceneName\(mapId, bd\.buildingKey\)\);/, 'an online home, before its scene goes');
  assert.match(m, /iconUrl: \(a, r, dye = null\) => loadIcon\(a, r, \{ scale: 1, dye \}\),/);
  assert.equal(chipNamed != null, true);
});
