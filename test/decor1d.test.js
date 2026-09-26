// DECOR1d (2026-09-25, Mac: the decorator opens from "A UI element that can be clicked to open the decorate panel.
// Allows free cam mode for placement and an intuitive scrolling menu with filters"; decor "Gold per placement", priced
// "By size"; online and offline, "kept in the save"): THE DECORATOR. The catalogue read out of the game's own blocks a
// few at a time (systems/decorScan.js), where a new piece stands (systems/decorPlacer.js), the three surfaces
// (ui/decorPanel.js) driven headless over a fake document, the tool that joins them (scenes/decorTool.js) over fakes of
// the host's seams, and the host's wiring by source. `06-Systems/Online-Arc.md` DECOR1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDecorScan, DECOR_SCAN_BLOCKS_A_STEP, DECOR_SCAN_MODELS_A_STEP } from '../src/systems/decorScan.js';
import {
  createDecorPlacer, wrapTurn, DECOR_TURN_STEP, DECOR_TURN_FINE, DECOR_RAISE_STEP, DECOR_RAISE_MAX, DECOR_RAISE_MIN, DECOR_GRID,
} from '../src/systems/decorPlacer.js';
import { createDecorButton, createDecorPanel, createDecorBar, decorWhyNot, decorRowSub, decorPriceText } from '../src/ui/decorPanel.js';
import {
  flyStep, eyePoint, lookDir, DECOR_FLY_LEASH, DECOR_FLOAT_AT, DECOR_EYE_REACH, DECOR_FLY_SPEED, DECOR_FLY_FAST,
  DECOR_FLY_ACTIONS, DECOR_REFUSAL_MS,
} from '../src/scenes/decorTool.js';
import { DECOR_CAP, DECOR_SCALE_MAX, DECOR_SCALE_MIN, decorPrice } from '../src/net/decorLaw.js';
import { decorMatrix } from '../src/scenes/decorRoom.js';

import {
  settle, near, rmb, TOWN, DUNGEON, fakeBlocks, fakeDoc, fakeWin, all, one, text, chipNamed, catalogue, panelRig, rows, toolRig, placeFrom,
} from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');


// ─── THE SCAN ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1d the scan: the town blocks a few a step (a dungeon block and a block the file cannot read are skipped), counted into ONE catalogue across the steps; the catalogue stands when the last block is read and not before; then each model measured a few a step, then each flat (asynchronously) - a piece with no measure has no radius, never a guessed one; the progress climbs to one (mutants: the step unbounded, a dungeon block read, the count kept per step, the flats not awaited, a zero radius kept)', async () => {
  const list = [];
  for (let i = 0; i < 20; i++) list.push({ type: TOWN, block: rmb([41000 + (i % 3)], i % 2 ? [[210, 3]] : []) });
  list.push({ type: DUNGEON, block: rmb([99999]) });
  list.push({ type: TOWN, throws: true });
  const read = [];
  const blocks = fakeBlocks(list);
  const getBlock = blocks.getBlock;
  blocks.getBlock = (i) => { read.push(i); return getBlock(i); };
  let flatAsks = 0;
  const scan = createDecorScan({
    blocks, isTownBlock: (t) => t === TOWN,
    modelRadius: (id) => (id === 41002 ? 0 : id === 41001 ? (() => { throw new Error('no'); })() : 0.8),
    flatRadius: async (a, r) => { flatAsks++; return a === 210 && r === 3 ? 0.2 : null; },
  });
  assert.deepEqual([scan.phase(), scan.entries(), scan.progress()], ['blocks', null, 0]);
  scan.step();
  assert.equal(read.length, DECOR_SCAN_BLOCKS_A_STEP, 'a few blocks a step');
  assert.equal(scan.entries(), null, 'no catalogue until every block is read');
  const p1 = scan.progress();
  while (scan.phase() === 'blocks') scan.step();
  assert.ok(p1 > 0 && p1 < scan.progress(), 'the progress climbs');
  assert.ok(!read.includes(20), 'a dungeon block is not read');
  const e = scan.entries();
  assert.deepEqual(e.find((x) => x.model === 41000).count, 7, 'counted across every step into one catalogue');
  assert.equal(e.some((x) => x.model === 99999), false);
  assert.equal(e.find((x) => x.flat?.[0] === 210).count, 10);
  assert.equal(scan.phase(), 'models');
  scan.step({ modelsPerStep: 1 });
  assert.equal(scan.phase(), 'models', 'a few models a step');
  while (scan.phase() === 'models') scan.step();
  assert.equal(scan.phase(), 'flats');
  assert.equal(scan.step(), false, 'waiting on the flats');
  await settle();
  assert.equal(scan.phase(), 'done');
  assert.equal(scan.step(), true);
  assert.equal(scan.progress(), 1);
  assert.equal(flatAsks, 1);
  const r = (m) => scan.radiusOf(e.find((x) => x.model === m));
  assert.deepEqual([r(41000), r(41001), r(41002)], [0.8, null, null], 'measured; a throwing measure and a zero one give none');
  assert.equal(scan.radiusOf(e.find((x) => x.flat)), 0.2);
  assert.equal(scan.radiusOf(null), null);
  assert.equal(DECOR_SCAN_MODELS_A_STEP > 0, true);
});

// ─── THE PLACER ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1d where a new piece stands: a model lifted by its own bottom (turned and scaled as it will stand), a flat on its base, the owner\'s lift added; the turn in steps (fine held), wrapped to a half-circle each way; the lift and the scale within their bounds; the grid snaps across the floor and never the height; priced by the law at its scale; its light and storage the entry\'s, copied; unpriced or outside the law, no piece (mutants: the lift unread, the grid on the height, the turn unwrapped, the scale unbounded, the light shared, the price at one scale)', () => {
  const entry = { key: 'm41000', model: 41000, flat: null, name: 'Chair', kind: 'furniture', storage: true, light: { color: [1, 0.5, 0], range: 5, intensity: 1 } };
  const box = [-0.5, -0.2, -0.5, 0.5, 1.8, 0.5];
  const pl = createDecorPlacer(entry, { radius: 1, box });
  const origin = [8, 5, 8];
  const p = pl.pieceAt([10.1, 5, 9.9], origin, 'abc');
  assert.deepEqual(p.pos, [2.1, 0.2, 1.9], 'lifted by its bottom: the box sits on the surface');
  assert.deepEqual([p.rot, p.scale, p.paid, p.storage], [[0, 0, 0], 1, decorPrice(1, 1), true]);
  assert.deepEqual(p.light, entry.light);
  p.light.color[0] = 0;
  assert.equal(entry.light.color[0], 1, 'the light is the piece\'s own copy');
  pl.rescale(true);
  assert.equal(pl.state().scale, 1.1);
  const big = pl.pieceAt([10, 5, 10], origin, 'abc');
  assert.ok(near(big.pos[1], 0.22, 1e-3), 'the lift is the scaled bottom');
  assert.equal(big.paid, decorPrice(1, 1.1), 'priced at its scale');
  for (let i = 0; i < 40; i++) pl.rescale(true);
  assert.equal(pl.state().scale, DECOR_SCALE_MAX);
  for (let i = 0; i < 80; i++) pl.rescale(false);
  assert.equal(pl.state().scale, DECOR_SCALE_MIN);
  const turned = createDecorPlacer(entry, { radius: 1, box });
  turned.turn(DECOR_TURN_STEP);
  turned.turn(DECOR_TURN_FINE);
  assert.equal(turned.state().yaw, 16);
  for (let i = 0; i < 11; i++) turned.turn(DECOR_TURN_STEP);
  assert.equal(turned.state().yaw, -179, 'wrapped to a half-circle each way');
  assert.deepEqual([wrapTurn(180), wrapTurn(-180), wrapTurn(540), wrapTurn(-190)], [180, 180, 180, 170]);
  const lifted = createDecorPlacer(entry, { radius: 1, box });
  lifted.raise(DECOR_RAISE_STEP);
  assert.ok(near(lifted.pieceAt([8, 5, 8], origin, 'x').pos[1], 0.25, 1e-3), 'the owner\'s lift on top');
  lifted.raise(100);
  assert.equal(lifted.state().raise, DECOR_RAISE_MAX);
  lifted.raise(-100);
  assert.equal(lifted.state().raise, DECOR_RAISE_MIN);
  const snapped = createDecorPlacer(entry, { radius: 1, box });
  assert.equal(snapped.toggleSnap(), true);
  const s = snapped.pieceAt([10.13, 5.37, 9.88], origin, 'x');
  assert.deepEqual([s.pos[0], s.pos[2]], [2.25, 2], `snapped to the ${DECOR_GRID} m grid across the floor (2.13 and 1.88)`);
  assert.ok(near(s.pos[1], 0.57, 1e-3), 'and never the height - a piece on a table stays on it');
  const flat = createDecorPlacer({ ...entry, key: 'f210.3', model: null, flat: [210, 3], light: null, storage: false }, { radius: 0.2 });
  assert.deepEqual(flat.pieceAt([9, 6, 9], origin, 'y').pos, [1, 1, 1], 'a flat stands on its base');
  assert.equal(createDecorPlacer(entry, { radius: null, box }).pieceAt([9, 5, 9], origin, 'z'), null, 'unmeasured: no price, no piece');
  assert.equal(pl.pieceAt([9000, 5, 9], origin, 'z'), null, 'outside what a piece may be');
  assert.equal(pl.pieceAt(null, origin, 'z'), null);
});

// ─── THE SURFACES ────────────────────────────────────────────────────────────────────────────────────────────────────


test('DECOR1d the panel: it opens over the room as the host slot\'s window (it pauses; Escape through the slot or the window closes it, once), lists the catalogue with each piece\'s kind, size and price, filters by kind, words, size, holds-things and gives-light and sorts; a piece chosen shows its name, line and price, and Place stands idle with the reason when the size is unread, the room full or the gold short; placing closes the panel and names the piece; the foot says the count, the gold and the scan (mutants: a disabled Place placing, the cap unread, the gold unread)', async () => {
  const { panel, view, placed, closed, doc, win, entries } = panelRig({ gold: 1000 });
  const slot = panel.open(view());
  assert.equal(slot.isChoiceWindow, true);
  assert.equal(slot.done, false);
  const root = panel.root;
  assert.equal(root.dataset.state, 'open');
  assert.equal(rows(root).length, entries.length, 'every piece listed');
  const firstRow = rows(root)[0];
  assert.match(text(firstRow), /gold$/);
  // filters
  chipNamed(root, 'Lights').fire('click');
  assert.deepEqual(rows(root).map((r) => r.dataset.key), ['f210.3'], 'a kind');
  chipNamed(root, 'All').fire('click');
  const search = one(root, 'dfdecor-search');
  search.value = 'book';
  search.fire('input');
  assert.deepEqual(rows(root).map((r) => r.dataset.key), ['f209.0'], 'the words');
  search.value = '';
  search.fire('input');
  chipNamed(root, 'Holds things').fire('click');
  assert.ok(rows(root).every((r) => entries.find((e) => e.key === r.dataset.key).storage), 'holds things');
  chipNamed(root, 'Holds things').fire('click');
  chipNamed(root, 'Gives light').fire('click');
  assert.deepEqual(rows(root).map((r) => r.dataset.key), ['f210.3']);
  chipNamed(root, 'Gives light').fire('click');
  chipNamed(root, 'Small').fire('click');
  assert.deepEqual(rows(root).map((r) => r.dataset.key), [entries[0].key], 'a size band (the first is 0.3 m)');
  chipNamed(root, 'Any size').fire('click');
  chipNamed(root, 'By name').fire('click');
  const names = rows(root).map((r) => entries.find((e) => e.key === r.dataset.key).name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'sorted by name');
  // choose, then place
  const place = all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place');
  assert.equal(place.disabled, true, 'nothing chosen');
  const chest = entries.find((e) => e.storage);
  rows(root).find((r) => r.dataset.key === chest.key).fire('click');
  assert.equal(rows(root).find((r) => r.dataset.key === chest.key).getAttribute('aria-selected'), 'true');
  assert.equal(one(root, 'dfdecor-pick-name').textContent, chest.name);
  assert.match(one(root, 'dfdecor-pick-line').textContent, /holds things/);
  assert.equal(place.disabled, false);
  panel.update(view({ gold: 1 }));
  assert.equal(place.disabled, true, 'the gold short');
  assert.match(one(root, 'dfdecor-pick-why').textContent, /more gold/);
  place.fire('click');
  assert.equal(placed.length, 0, 'an idle Place places nothing');
  panel.update(view({ count: DECOR_CAP }));
  assert.match(one(root, 'dfdecor-pick-why').textContent, /already holds 200/);
  panel.update(view({ gold: 1000, count: 3 }));
  assert.equal(place.disabled, false);
  assert.match(text(one(root, 'dfdecor-foot')), /3 of 200 pieces placed/);
  assert.match(text(one(root, 'dfdecor-foot')), /1000 gold to spend/);
  place.fire('click');
  assert.deepEqual([placed.map((e) => e.key), panel.isOpen(), slot.done, closed()], [[chest.key], false, true, 1], 'placing closes it and names the piece');
  // Escape: through the slot, and through the window - said once
  const slot2 = panel.open(view());
  slot2.input('Escape');
  assert.deepEqual([panel.isOpen(), closed()], [false, 2]);
  panel.open(view());
  const seen = win.fire('keydown', { code: 'Escape', target: doc.body });
  assert.deepEqual([panel.isOpen(), closed(), seen.stopped], [false, 3, true]);
  panel.close();
  assert.equal(closed(), 3, 'a closed panel closes nothing');
  assert.equal(win.fire('keydown', { code: 'Escape', target: doc.body }).stopped, false, 'a closed panel takes no key');
});

test('DECOR1d the panel reads the scan as it goes: "reading" while the blocks are read, a price of "..." until a size is measured and none placed until it is; a flat\'s row and preview wear its own picture; the preview follows the pointer and tells the host the piece it shows (mutants: an unmeasured piece placeable, the host never told)', async () => {
  const { panel, view, pointed, entries, radius } = panelRig();
  panel.open(view({ entries: null, ready: false, progress: 0.4 }));
  assert.match(text(panel.root), /Reading the catalogue/);
  assert.match(text(one(panel.root, 'dfdecor-foot')), /Reading the catalogue - 40%/);
  radius.delete(entries[0].key);
  panel.update(view({ ready: false, progress: 0.9 }));
  assert.equal(rows(panel.root).length, entries.length, 'the list the moment the blocks are read');
  const r0 = rows(panel.root).find((r) => r.dataset.key === entries[0].key);
  assert.match(text(r0), /\.\.\.$/, 'no size yet: no price yet');
  r0.fire('click');
  assert.equal(all(panel.root, 'dfdecor-btn').find((b) => b.textContent === 'Place').disabled, true);
  assert.match(one(panel.root, 'dfdecor-pick-why').textContent, /still being read/);
  panel.update(view({ ready: true }));
  assert.match(one(panel.root, 'dfdecor-pick-why').textContent, /cannot be read/);
  await settle();
  const flat = entries.find((e) => e.flat);
  const flatRow = rows(panel.root).find((r) => r.dataset.key === flat.key);
  flatRow.fire('mouseenter');
  assert.equal(panel.pointed().key, flat.key, 'the preview follows the pointer');
  assert.equal(pointed.at(-1), flat.key, 'and the host is told');
  const img = one(panel.root, 'dfdecor-preview').children[0];
  assert.equal(img.getAttribute('src'), `data:${flat.key}`, 'a flat previews as its own picture');
  flatRow.fire('mouseleave');
  assert.equal(panel.pointed().key, entries[0].key, 'back to the chosen one');
  assert.equal(decorPriceText(null), '...');
  assert.equal(decorPriceText(40), '40 gold');
  assert.equal(decorWhyNot({ price: 40, ready: true, gold: 40, count: 199, cap: 200 }), null);
  assert.equal(decorRowSub({ kind: 'light', storage: false, light: {} }, 0.3), 'Lights - Small - gives light');
});

test('DECOR1d a flat\'s picture is asked for when its row comes into view, never every picture at once when the list is drawn; a piece chosen out of view gets its picture all the same, and each is asked for once (mutants: every picture at once, the chosen piece pictureless)', async () => {
  const doc = fakeDoc();
  const win = fakeWin();
  const watched = [];
  win.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(t) { watched.push({ t, io: this }); } unobserve() {} disconnect() {} };
  const asked = [];
  const entries = catalogue();
  const panel = createDecorPanel({ doc, win, onPlace() {}, thumbOf: async (e) => { asked.push(e.key); return `data:${e.key}`; } });
  panel.open({ where: '', entries, progress: 1, ready: true, gold: 1000, count: 0, cap: DECOR_CAP, radiusOf: () => 0.5, priceOf: () => 75 });
  const flats = entries.filter((e) => e.flat);
  assert.equal(asked.length, 0, 'nothing asked for while no row is in view');
  assert.equal(watched.length, flats.length, 'every flat\'s row watched');
  const w = watched.find((x) => x.t.dataset.key === flats[0].key);
  w.io.cb([{ isIntersecting: true, target: w.t }]);
  await settle();
  assert.deepEqual(asked, [flats[0].key], 'its row came into view');
  assert.equal(one(w.t, 'dfdecor-thumb').children[0].getAttribute('src'), `data:${flats[0].key}`);
  panel.select(flats[1].key);
  await settle();
  assert.ok(asked.includes(flats[1].key), 'the chosen piece, out of view');
  assert.equal(one(panel.root, 'dfdecor-preview').children[0].getAttribute('src'), `data:${flats[1].key}`, 'and it previews');
  w.io.cb([{ isIntersecting: true, target: w.t }]);
  await settle();
  assert.equal(asked.filter((k) => k === flats[0].key).length, 1, 'asked for once');
});

test('DECOR1d the button and the bar: the button stands only when the host says, and a press on it while it stands opens the panel; the bar shows what is placed, its price and why it cannot be yet, and its buttons are the keys\' twins; both swallow a press (mutants: a hidden button opening, a bar button unwired)', () => {
  const doc = fakeDoc();
  let pressed = 0;
  const btn = createDecorButton({ doc, onPress: () => { pressed++; } });
  btn.root.fire('click');
  assert.equal(pressed, 0, 'a hidden button does nothing');
  btn.render(true);
  assert.equal(btn.isUp(), true);
  btn.root.fire('click');
  assert.equal(pressed, 1);
  btn.render(false);
  assert.equal(btn.root.dataset.up, '0');
  const calls = [];
  const on = Object.fromEntries(['place', 'back', 'turnLeft', 'turnRight', 'raise', 'lower', 'smaller', 'bigger', 'grid'].map((k) => [k, () => calls.push(k)]));
  const bar = createDecorBar({ doc, on });
  bar.show({ name: 'Chair', price: 120, why: 'You need 20 more gold.', snap: true });
  assert.equal(bar.isUp(), true);
  assert.equal(one(bar.root, 'dfdecor-bar-what').textContent, 'Chair - 120 gold');
  assert.equal(one(bar.root, 'dfdecor-bar-why').textContent, 'You need 20 more gold.');
  for (const b of all(bar.root, 'dfdecor-chip').concat(all(bar.root, 'dfdecor-btn'))) b.fire('click');
  assert.deepEqual([...calls].sort(), Object.keys(on).sort(), 'every button is a key\'s twin');
  assert.equal(chipNamed(bar.root, 'Grid').getAttribute('aria-pressed'), 'true');
  bar.hide();
  assert.equal(bar.isUp(), false);
  assert.ok(btn.root.listeners.mousedown?.length && bar.root.listeners.mousedown?.length, 'a press on either is theirs');
});

// ─── THE TOOL ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1d the free camera\'s arithmetic: forward along the look, sideways along the motor\'s right, up and down, no faster on a diagonal, leashed; the eye meets a surface within its reach, else the piece hangs ahead (mutants: the strafe mirrored, the leash unread, a diagonal faster)', () => {
  const at = [0, 0, 0];
  const f = flyStep(at, at, { forward: 1 }, 0, 0, 2, 0.5);
  assert.deepEqual(f.map((v) => +v.toFixed(6)), [0, 0, 1], 'yaw 0 looks down +z');
  const right = flyStep(at, at, { strafe: 1 }, 0, 0, 2, 0.5);
  assert.deepEqual(right.map((v) => +v.toFixed(6)), [1, 0, 0], 'right is (cos, 0, -sin) - the motor\'s');
  const turned = flyStep(at, at, { strafe: 1 }, Math.PI / 2, 0, 2, 0.5);
  assert.deepEqual(turned.map((v) => +v.toFixed(6)), [0, 0, -1]);
  const up = flyStep(at, at, { rise: 1 }, 0, 0, 2, 0.5);
  assert.deepEqual(up.map((v) => +v.toFixed(6)), [0, 1, 0]);
  const diag = flyStep(at, at, { forward: 1, strafe: 1 }, 0, 0, 2, 0.5);
  assert.ok(near(Math.hypot(...diag), 1), 'a diagonal is no faster');
  const climb = flyStep(at, at, { forward: 1 }, 0, Math.PI / 4, 2, 0.5);
  assert.ok(climb[1] > 0.7, 'it flies where it looks');
  const far = flyStep([0, 0, DECOR_FLY_LEASH], at, { forward: 1 }, 0, 0, 10, 1);
  assert.ok(near(Math.hypot(...far), DECOR_FLY_LEASH), 'leashed to where it began');
  assert.equal(flyStep(at, at, {}, 0, 0, 2, 0.5), at, 'no keys, no move');
  const eye = [1, 2, 3];
  const dir = lookDir(0, 0);
  assert.deepEqual(eyePoint({ raycastHit: (e, d, max) => ({ dist: max === DECOR_EYE_REACH ? 2 : 0 }) }, eye, dir), [1, 2, 5]);
  assert.deepEqual(eyePoint({ raycastHit: () => ({ dist: Infinity }) }, eye, dir), [1, 2, 3 + DECOR_FLOAT_AT], 'no surface: it hangs ahead');
  assert.deepEqual(eyePoint({ raycastHit: () => { throw new Error('x'); } }, eye, dir), [1, 2, 3 + DECOR_FLOAT_AT]);
  assert.deepEqual(eyePoint(null, eye, dir), [1, 2, 3 + DECOR_FLOAT_AT]);
  assert.ok(DECOR_FLY_FAST > DECOR_FLY_SPEED);
});


test('DECOR1d the tool: the button stands in a room the player may decorate and no other, and not under a window; the panel opens into the host\'s overlay slot and leaves it on its close; the scan runs while it is open and names every piece for the host\'s hover; a room with pieces names them for a visitor too (mutants: the button over a window, the slot never left, the names never filled)', async () => {
  const rig = toolRig();
  rig.frame();
  const button = rig.doc.body.children.find((c) => String(c.className).includes('dfdecor-open'));
  assert.equal(button.dataset.up, '1', 'the owner\'s room');
  rig.frame({ overlayUp: true });
  assert.equal(button.dataset.up, '0', 'not under a window');
  rig.state.room = null;
  rig.frame();
  assert.equal(button.dataset.up, '0', 'nobody else\'s room');
  assert.equal(rig.tool.openPanel(), false);
  rig.state.room = { kind: 'house', where: 'Your house' };
  rig.frame();
  button.fire('click');
  assert.equal(rig.slots[0][0], 'open');
  assert.equal(rig.tool.panelOpen(), true);
  for (let i = 0; i < 4; i++) { rig.frame({ overlayUp: true }); await settle(); }
  assert.equal(rig.names.get('m41000'), rig.entries.find((e) => e.key === 'm41000').name, 'the hover names, from the catalogue');
  rig.slots[0][1].input('Escape');
  assert.deepEqual(rig.slots.map((s) => s[0]), ['open', 'close']);
  assert.equal(rig.slots[1][1], rig.slots[0][1], 'the same slot back out');
  // a visitor, in a room with pieces
  const visitor = toolRig({ room: null });
  visitor.standing.push({ id: 'x' });
  for (let i = 0; i < 3; i++) visitor.frame();
  assert.ok(visitor.names.size > 0, 'named for whoever stands in it');
});

test('DECOR1d placing offline: Place starts the free camera (the body still, the cursor put away), the walk keys fly the eye and it leads the camera, the piece stands where the eye meets the room - lifted by its bottom - and a click places it, paid from the wallet and stood in the room\'s pool, and the next is a new piece; short of gold or at the cap nothing is paid or stood and the bar says why (mutants: the eye unled, paying without placing, placing without paying, the cap unread)', async () => {
  const rig = toolRig({ gold: 500 });
  await placeFrom(rig, 'm41000');
  assert.equal(rig.tool.flying(), true);
  assert.equal(rig.cursorOffs(), 1, 'a cursor freed for the button is put away');
  assert.equal(rig.win.fire('keydown', { code: 'KeyW', target: rig.doc.body }).stopped, true, 'the walk key is the flight\'s, never the body\'s');
  rig.frame();
  assert.equal(rig.win.fire('keyup', { code: 'KeyW', target: rig.doc.body }).stopped, false, 'its release is the host\'s too');
  rig.frame();
  rig.tool.cameraOverride(rig.cam);
  assert.ok(near(rig.cam.pos[2], 10 + DECOR_FLY_SPEED * 0.1), 'the eye flies forward, and the camera is the eye');
  const ghost = rig.tool.ghost();
  assert.ok(ghost, 'a piece where the eye meets the room');
  assert.ok(near(ghost.pos[2], rig.cam.pos[2] + 2 - 10, 1e-3), 'two metres ahead, where the fake room is met');
  assert.ok(near(ghost.pos[1], 1.6 - 0 + 0.1, 1e-3), 'lifted by its own bottom (-0.1)');
  assert.ok(rig.tool.draw(), 'the ghost is drawn');
  assert.deepEqual([...rig.draws.at(-1).m], [...decorMatrix(ghost, [10, 0, 10])]);
  const price = ghost.paid;
  const seen = rig.win.fire('mousedown', { button: 0 });
  assert.equal(seen.stopped, true, 'the click is the decorator\'s - never a swing');
  await settle();
  assert.deepEqual([rig.w.paid, rig.standing.length, rig.standing[0].id], [[price], 1, ghost.id]);
  assert.match(rig.said.at(-1), /placed for/);
  rig.frame();
  assert.notEqual(rig.tool.ghost().id, ghost.id, 'the next of the same piece is a new piece');
  // short
  rig.w.gold = 1;
  rig.win.fire('mousedown', { button: 0 });
  await settle();
  assert.deepEqual([rig.w.paid.length, rig.standing.length], [1, 1]);
  rig.frame();
  assert.match(rig.tool.why(), /more gold/);
  // full
  rig.w.gold = 10000;
  while (rig.standing.length < DECOR_CAP) rig.standing.push({ id: `p${rig.standing.length}` });
  rig.win.fire('keydown', { code: 'KeyE', target: rig.doc.body });
  await settle();
  assert.equal(rig.w.paid.length, 1, 'a full room takes nothing');
  rig.frame();
  assert.match(rig.tool.why(), /already holds 200/);
});

test('DECOR1d placing into an online home: the account service first (the home, the character, the piece), then paid, then stood; refused, nothing paid and the bar says the service\'s word a while; short once the answer came, the piece is taken back out; a room left before the answer is paid for and not stood in (mutants: paying before the write, paying on a refusal, the short piece left standing)', async () => {
  const calls = [];
  let answer = (piece) => ({ ok: true, data: { piece } });
  const homeDecor = {
    place: async (a) => { calls.push(['place', a]); return answer(a.piece); },
    remove: async (a) => { calls.push(['remove', a]); return { ok: true }; },
  };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor, gold: 500 });
  await placeFrom(rig, 'm41000');
  rig.frame();
  const ghost = rig.tool.ghost();
  await rig.tool.commit();
  assert.deepEqual(calls[0], ['place', { mapId: 77, buildingKey: 9, character: 'char-me', piece: ghost }]);
  assert.deepEqual([rig.w.paid, rig.standing.map((p) => p.id)], [[ghost.paid], [ghost.id]]);
  // refused
  answer = () => ({ ok: false, error: 'decor-rate' });
  rig.frame();
  await rig.tool.commit();
  assert.equal(rig.w.paid.length, 1, 'refused: nothing paid');
  rig.frame();
  assert.equal(rig.tool.why(), 'refused: decor-rate');
  // short once the answer came
  answer = (piece) => { rig.w.gold = 0; return { ok: true, data: { piece } }; };
  rig.frame();
  const g2 = rig.tool.ghost();
  await rig.tool.commit();
  assert.deepEqual(calls.at(-1), ['remove', { mapId: 77, buildingKey: 9, character: 'char-me', id: g2.id }], 'taken back out');
  assert.equal(rig.w.paid.length, 1);
  // a room left before the answer
  rig.w.gold = 500;
  answer = (piece) => { rig.setVisit(2); return { ok: true, data: { piece } }; };
  rig.frame();
  await rig.tool.commit();
  assert.equal(rig.w.paid.length, 2, 'the service has it: paid');
  assert.equal(rig.standing.length, 1, 'but not stood in a room left');
  assert.ok(DECOR_REFUSAL_MS > 0);
});

test('DECOR1d the keys and presses while the camera flies, read as the actions they are bound to: Turn Left/Right or the wheel turn (Shift fine), Float Up/Down lift, - and = size, / the grid (the three keys no action has), Interact or a click places, Escape or a right press goes back to the panel with the piece still chosen; every press is the flight\'s and no release is; the walk keys fly the eye (Jump up, Crouch down, Run faster) until let go; a press while the pointer is free is the host\'s relock, never a placement; a window over the flight suspends it; a room no longer the player\'s ends it (mutants: a release kept from the host, a flight key never let go, an unlocked press placing, a window not suspending)', async () => {
  const rig = toolRig();
  const root = await placeFrom(rig, 'm41000');
  const key = (code, extra = {}) => rig.win.fire('keydown', { code, target: rig.doc.body, ...extra });
  const up = (code) => rig.win.fire('keyup', { code, target: rig.doc.body });
  key('ArrowLeft');
  assert.equal(rig.tool.placer().state().yaw, -DECOR_TURN_STEP);
  key('ArrowRight', { shiftKey: true });
  assert.equal(rig.tool.placer().state().yaw, -DECOR_TURN_STEP + DECOR_TURN_FINE);
  key('ArrowLeft', { repeat: true });
  assert.equal(rig.tool.placer().state().yaw, -2 * DECOR_TURN_STEP + DECOR_TURN_FINE, 'held, a turn goes on');
  key('PageUp');
  assert.equal(rig.tool.placer().state().raise, DECOR_RAISE_STEP);
  key('Equal');
  assert.equal(rig.tool.placer().state().scale, 1.1);
  key('Minus');
  assert.equal(rig.tool.placer().state().scale, 1);
  key('Slash');
  assert.equal(rig.tool.placer().state().snap, true);
  key('Slash', { repeat: true });
  assert.equal(rig.tool.placer().state().snap, true, 'the grid is once a press');
  rig.win.fire('wheel', { deltaY: 100 });
  assert.equal(rig.tool.placer().state().yaw, -2 * DECOR_TURN_STEP + DECOR_TURN_FINE + DECOR_TURN_STEP);
  assert.equal(key('KeyI').stopped, true, 'every press is the decorator\'s - no sheet opens under a placement');
  assert.equal(key('Enter').stopped, true, 'nor the cursor toggle');
  assert.equal(up('KeyI').stopped, false, 'no release is: a key held into the flight is let go of at the host');
  // the walk keys fly the eye until let go
  rig.cam.pos = [10, 1.6, 10];
  key('Space');
  rig.frame();
  const risen = rig.tool.ghost();
  rig.tool.cameraOverride(rig.cam);
  const y1 = rig.cam.pos[1];
  assert.ok(y1 > 1.6, 'Jump lifts the eye');
  up('Space');
  rig.frame();
  rig.tool.cameraOverride(rig.cam);
  assert.equal(rig.cam.pos[1], y1, 'let go, it stops');
  key('KeyC');
  rig.frame();
  rig.tool.cameraOverride(rig.cam);
  assert.ok(rig.cam.pos[1] < y1, 'Crouch lowers it');
  up('KeyC');
  assert.ok(risen);
  assert.deepEqual(DECOR_FLY_ACTIONS.includes('Jump') && DECOR_FLY_ACTIONS.includes('Crouch') && DECOR_FLY_ACTIONS.includes('Run'), true);
  // a free pointer: the press is the host's
  rig.state.locked = false;
  rig.frame();
  assert.equal(rig.tool.why(), 'Click to look around again.');
  const free = rig.win.fire('mousedown', { button: 0 });
  await settle();
  assert.deepEqual([free.stopped, rig.w.paid.length], [false, 0], 'never a placement');
  rig.state.locked = true;
  // a window over the flight
  rig.frame({ overlayUp: true });
  assert.equal(rig.tool.flying(), false);
  assert.equal(key('KeyI').stopped, false, 'the window has the keys');
  rig.frame();
  assert.equal(rig.tool.flying(), true, 'and it resumes');
  // back
  rig.win.fire('mousedown', { button: 2 });
  assert.deepEqual([rig.tool.flying(), rig.tool.panelOpen()], [false, true]);
  assert.equal(rows(root).find((r) => r.getAttribute('aria-selected') === 'true').dataset.key, 'm41000', 'the piece still chosen');
  assert.equal(key('KeyI').stopped, false, 'the flight took its listeners with it');
  // Escape
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame();
  key('Escape');
  assert.equal(rig.tool.panelOpen(), true);
  // the room is no longer theirs
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame();
  rig.state.room = null;
  rig.frame();
  assert.deepEqual([rig.tool.flying(), rig.tool.panelOpen()], [false, false]);
  // touch: a tap is never a placement
  const t = toolRig({ touch: true });
  await placeFrom(t, 'm41000');
  const tap = t.win.fire('mousedown', { button: 0 });
  await settle();
  assert.deepEqual([tap.stopped, t.w.paid.length], [false, 0]);
});

test('DECOR1d a flat is placed the same way, its ghost a billboard moved to the piece\'s base and sized by its scale; the panel\'s preview draws the pointed model turning in the preview\'s own box on the canvas; the room\'s teardown ends it all (mutants: the flat ghost unmoved, the preview in the wrong box)', async () => {
  const rig = toolRig();
  await placeFrom(rig, 'f210.3');
  await settle();
  rig.frame();
  const [ghost] = rig.tool.batches();
  const piece = rig.tool.ghost();
  assert.ok(ghost && piece, 'a flat ghost');
  assert.deepEqual(ghost.origin, [10 + piece.pos[0], 0 + piece.pos[1], 10 + piece.pos[2]]);
  rig.win.fire('keydown', { code: 'Equal', target: rig.doc.body });
  rig.frame();
  assert.ok(near(ghost.size.h, rig.tool.batches()[0].size.h) && ghost.size.h > 0);
  rig.tool.close();
  assert.equal(ghost.destroyed, true, 'the room\'s teardown takes the ghost');
  assert.deepEqual([rig.tool.flying(), rig.tool.panelOpen(), rig.tool.batches().length], [false, false, 0]);
  // the preview
  const p = toolRig();
  p.frame();
  p.tool.openPanel();
  for (let i = 0; i < 6; i++) { p.frame({ overlayUp: true }); await settle(); }
  const root = p.doc.body.children.find((c) => c.className === 'dfdecor');
  const preview = one(root, 'dfdecor-preview');
  preview.getBoundingClientRect = () => ({ left: 400, top: 100, width: 200, height: 150 });
  rows(root).find((r) => r.dataset.key === 'm41000').fire('click');
  p.frame({ overlayUp: true });
  await settle();
  const copies = [];
  const gl = preview.children.find((c) => c.tag === 'canvas');
  gl.getContext = () => ({ drawImage: (...a) => copies.push(a) });
  assert.equal(preview.dataset.model, '1', 'a model shows the turning canvas');
  assert.equal(p.tool.drawPreview('remap'), true);
  const pass = p.draws.find((d) => d.panel);
  assert.deepEqual(pass.panel.rect, { x: 800, y: 200, w: 400, h: 300 }, 'the preview\'s box, in canvas pixels');
  assert.equal(p.draws.at(-1).remap, 'remap');
  assert.equal(copies.length, 1, 'and copied into the preview\'s own canvas - the card over the game is opaque');
  assert.deepEqual(copies[0].slice(1), [800, 200, 400, 300, 0, 0, 400, 300]);
  assert.deepEqual([gl.width, gl.height], [400, 300]);
});

// ─── THE HOST ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1d the host (worldModes.js, world.js) by source: one tool on the room\'s own pool, collider and origin; the owner\'s room kinds; the scan\'s measures (a town block; a model\'s ARCH3D radius in metres; a flat\'s billboard half-diagonal); the wallet the purse then the bank; the frame hooks it every frame, the motor call is the four hosts\' own (the flight takes every press, so the body is handed none), the camera is the eye after the death sink; the ghost and the preview drawn; all three teardowns close it; world.js names the character that writes (mutants: the camera unled, the view over the shoulder)', () => {
  const m = src('src/scenes/worldModes.js');
  const w = src('src/scenes/world.js');
  assert.match(m, /const decorTool = createDecorTool\(\{/);
  assert.match(m, /pool: interiorDecor, names: decorNames,/);
  assert.match(m, /collider: \(\) => interiorCtx\?\.collider \?\? null, origin: \(\) => buildingOrigin\(\), eye: \(\) => cam\.pos,/);
  assert.match(m, /openSlot: \(o\) => \{ interiorOverlay = o; \}, closeSlot: \(o\) => \{ if \(interiorOverlay === o\) interiorOverlay = null; \},/);
  assert.match(m, /if \(mode !== 'interior' \|\| !b \|\| !decorOwnerHere\(\)\) return null;\n    if \(interiorHome\) return \{ kind: 'home', where: 'Your home', mapId: homeTownOf\(b\), buildingKey: b\.buildingKey \};/);
  assert.match(m, /isTownBlock: \(t\) => t === BLOCK_TYPES\.Rmb,/);
  assert.match(m, /return r > 0 \? r \* GLOBAL_SCALE : null;/);
  assert.match(m, /return Math\.hypot\(size\.w, size\.h\) \/ 2;/);
  assert.match(m, /pay: \(n\) => \{ const short = purse\.deductGold\(n\); if \(account\) account\.accountGold -= short; \},/);
  assert.match(m, /decorTool\.frame\(\{ dt, cam, overlayUp: overlayHeld, interior: mode === 'interior' \}\);/);
  assert.doesNotMatch(m, /_decorFly/, 'the motor is untouched - the flight never hands it a press');
  assert.match(m, /if \(mode === 'dungeon'\) dungeonCtx\?\.deathTilt\?\.\(cam\);\n    if \(mode === 'interior'\) decorTool\.cameraOverride\(cam\);/);
  assert.match(m, /\n    \}\);\n    if \(decorTool\.flying\(\)\) mwv\.eye = cam\.pos;/, 'and the view is the free camera\'s in third person too');
  assert.match(m, /interiorDecor\.draw\(renderer, interiorCtx\.texRemap\);[^\n]*\n    decorTool\.draw\(renderer, interiorCtx\.texRemap\);/);
  assert.match(m, /interiorWeapon\.draw\(\{ paralyzed \}\);[^\n]*\n    decorTool\.drawPreview\(interiorCtx\.texRemap\);/);
  assert.equal([...m.matchAll(/interiorDecor\.destroyAll\(\); _decorVisit\+\+; decorTool\.close\(\);/g)].length, 3);
  assert.match(w, /decorCharacter: \(\) => characterIdOf\(playerEntity\),/);
});
