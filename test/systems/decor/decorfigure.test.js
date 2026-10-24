// DECOR-FIGURE (2026-10-10, the owner: "remove the scaling option for npc sprites with house decoration
// interior/exterior"). One of Daggerfall's people placed as decor - a flat in a person's archive (RDBLayout.NPCFlatArchives,
// now in the leaf world/npcFlatArchives.js; the catalogue's Vendors), never one's own item - stands at its own size: the
// placer takes no size step for it (systems/decor/decorPlacer.js decorEntrySized), the bar hides Smaller and Bigger and says no
// Size key (ui/decorPanel.js createDecorBar `sized`), the room and the yard draw one grown before at its own size
// (net/decorLaw.js decorDrawnScale - scenes/decor/decorRoom.js), and the service refuses a figure written at another
// (decorScaleOk - server-account/src/decor.js placeDecor, moveDecor), a turn of one grown before kept. Each pin failed on
// the build before it. tools/mutants/decorfigure.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decorIsFigure, decorDrawnScale, decorScaleOk, decorWhatOf } from '../../../src/net/decorLaw.js';
import { REFUSALS } from '../../../src/net/accountClient.js';
import { NPC_FLAT_ARCHIVES, isNpcFlat } from '../../../src/world/rdbLayout.js';
import * as leaf from '../../../src/world/npcFlatArchives.js';
import { createDecorPlacer, decorEntrySized } from '../../../src/systems/decor/decorPlacer.js';
import { decorCatalogue, collectDecor } from '../../../src/systems/decor/decorCatalogue.js';
import { decorEditPrice } from '../../../src/scenes/decor/decorTool.js';
import { createDecorBar } from '../../../src/ui/decorPanel.js';
import { standService, T0 } from '../../accountDb.mjs';
import { fakeDoc, all, text, settle, toolRig, placeFrom, yardWorld, live, sized, rmb, rows } from '../../decorFakes.mjs';

const figure = (over = {}) => ({ id: 'fig1', model: null, flat: [184, 17], pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 40, ...over });

test('DECOR-FIGURE the law: a figure is a flat of a person\'s archive, never a model, one\'s own item or another flat; it is drawn at its own size whatever its record says, and the service writes it at 1 alone; RDBLayout.NPCFlatArchives has one home, a leaf, re-exported (mutants: no figure, drawn at its record, the scale unasked)', () => {
  assert.equal(decorIsFigure(figure()), true);
  for (const a of NPC_FLAT_ARCHIVES) assert.equal(decorIsFigure(figure({ flat: [a, 0] })), true, String(a));
  assert.equal(decorIsFigure(figure({ flat: [210, 3] })), false, 'a candle');
  assert.equal(decorIsFigure({ ...figure(), model: 41000, flat: null }), false, 'a model');
  assert.equal(decorIsFigure(figure({ item: { t: 1 } })), false, 'one\'s own item');
  assert.equal(decorIsFigure(null), false);
  assert.equal(decorDrawnScale(figure({ scale: 2.5 })), 1, 'a figure grown before: its own size');
  assert.equal(decorDrawnScale(figure({ flat: [209, 0], scale: 2.5 })), 2.5, 'a book: its record\'s');
  assert.equal(decorDrawnScale({ model: 41000, flat: null, scale: 0.5 }), 0.5);
  assert.equal(decorScaleOk(figure()), true);
  assert.equal(decorScaleOk(figure({ scale: 1.1 })), false);
  assert.equal(decorScaleOk(figure({ flat: [209, 0], scale: 3 })), true, 'any other piece: the law\'s range');
  assert.equal(NPC_FLAT_ARCHIVES, leaf.NPC_FLAT_ARCHIVES, 'one list, re-exported');
  assert.equal(isNpcFlat, leaf.isNpcFlat);
});

test('DECOR-FIGURE the placer: every Vendors entry the catalogue mints (and a person\'s flat moved before the catalogue is read) takes no size step and starts at 1 - a figure grown before brought back to its own size - while any other piece steps as before; one law, the archive (AUDIT C3: the room and the service read no kind) (mutants: the step taken, the old size kept, no figure)', () => {
  const entries = decorCatalogue(collectDecor([rmb([], [[209, 0]], [], [[184, 17], [176, 4], [182, 33]])]));
  const vendors = entries.filter((e) => e.kind === 'people');
  assert.equal(vendors.length, 3, 'the catalogue\'s own Vendors');
  for (const e of vendors) assert.equal(decorEntrySized(e), false, e.key);
  const vendor = vendors.find((e) => e.key === 'f184.17');
  assert.equal(decorEntrySized({ ...vendor, kind: 'decor' }), false, 'its flat alone says it');
  assert.equal(decorEntrySized(entries.find((e) => e.key === 'f209.0')), true, 'a book');
  const p = createDecorPlacer(vendor, { radius: 0.4 });
  p.rescale(true); p.rescale(true); p.rescale(false);
  assert.equal(p.state().scale, 1, 'no step');
  assert.equal(p.pieceAt([2, 0, 2], [0, 0, 0], 'v1').scale, 1);
  const moved = createDecorPlacer(vendor, { radius: 0.4, from: figure({ scale: 2.2, rot: [30, 0, 0] }) });
  assert.equal(moved.state().scale, 1, 'grown before: its own size again');
  assert.equal(moved.state().yaw, 30, 'its turn kept');
  const book = createDecorPlacer({ key: 'f209.0', model: null, flat: [209, 0], kind: 'books' }, { radius: 0.4, from: figure({ flat: [209, 0], scale: 2 }) });
  assert.equal(book.state().scale, 2, 'any other piece keeps its size');
  book.rescale(true);
  assert.equal(book.state().scale, 2.2);
});

test('DECOR-FIGURE the bar: `sized` false hides Smaller and Bigger and drops the Size key from the keys line; true shows them again (mutant: the buttons kept)', () => {
  const doc = fakeDoc();
  const bar = createDecorBar({ on: {}, doc });
  const chip = (label) => all(bar.root, 'dfdecor-chip').find((c) => c.textContent === label);
  const keys = () => text(all(bar.root, 'dfdecor-bar-keys')[0]);   // MENU-ORDER: a legend of pairs, read whole
  bar.show({ name: 'Bed', price: 100 });
  assert.equal(!!chip('Smaller').hidden, false);
  assert.match(keys(), /Size: - and =/);
  bar.show({ name: 'Vendor', price: 40, sized: false });
  assert.equal(chip('Smaller').hidden, true);
  assert.equal(chip('Bigger').hidden, true);
  assert.doesNotMatch(keys(), /Size:/);
  bar.show({ name: 'Bed', price: 100, sized: true });
  assert.equal(chip('Bigger').hidden, false);
  assert.match(keys(), /Size: - and =/);
});

test('DECOR-FIGURE the decorator: a Vendor flown shows no Smaller or Bigger, a Bigger pressed (or = held) moves nothing, and it stands at 1; a book flown keeps both (mutant: the tool never tells the bar)', async () => {
  const rig = toolRig({ extraPeople: [[184, 17]] });
  await placeFrom(rig, 'f184.17');
  const bar = rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
  const chip = (label) => all(bar, 'dfdecor-chip').find((c) => c.textContent === label);
  rig.frame();
  assert.equal(chip('Bigger').hidden, true, 'no Bigger for a figure');
  chip('Bigger').fire('click');
  rig.win.fire?.('keydown', { code: 'Equal' });
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  const stood = rig.standing.at(-1);
  assert.deepEqual(stood.flat, [184, 17]);
  assert.equal(stood.scale, 1);
  const other = toolRig({ extraPeople: [[184, 17]] });
  await placeFrom(other, 'f209.0');
  other.frame();
  const bar2 = other.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
  const bigger = all(bar2, 'dfdecor-chip').find((c) => c.textContent === 'Bigger');
  assert.equal(!!bigger.hidden, false, 'a book: Bigger');
  bigger.fire('click');
  other.frame();
  assert.equal(await other.tool.commit(), true);
  assert.equal(other.standing.at(-1).scale, 1.1, 'and a step taken');
});

test('DECOR-FIGURE the room: a figure whose record says 2 stands at its own size; a book at 2 stands twice its size (mutant: the record\'s scale drawn)', async () => {
  const w = yardWorld({ pieces: [{ id: 'f', model: null, flat: [184, 17], pos: [8, 0, 2], rot: [0, 0, 0], scale: 2, light: null, storage: false, paid: 40 },
    { id: 'b', model: null, flat: [209, 0], pos: [9, 0, 3], rot: [0, 0, 0], scale: 2, light: null, storage: false, paid: 40 }] });
  await w.run();
  await settle();
  const fig = live(w.made).find((b) => b.a === 184);
  const book = live(w.made).find((b) => b.a === 209);
  assert.deepEqual(fig.size, sized(16, 32), 'its own size');
  assert.deepEqual(book.size, sized(16, 32, 2), 'twice its own');
});

test('DECOR-FIGURE the service: a figure placed at any size but its own is refused (`bad-decor`) and at 1 it stands; moved to another size it is refused; one grown before keeps its record on a turn, and is brought to its own size by a move; AUDIT HOME-VOTE II: an own item said beside a person\'s flat is refused (C1), and a move off its size is refused in its own word (C2) (mutants: the place unguarded, the move unguarded, a turn of the old refused, the item a way past, the word unsaid, a shrunk figure taken)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (piece) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), piece }, owner.secret);
  const move = (id, pl) => svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: o.character, id, place: pl }, owner.secret);
  const placeOf = (p) => ({ pos: p.pos, rot: p.rot, scale: p.scale, light: p.light, storage: p.storage, paid: p.paid });
  assert.equal((await place(figure({ scale: 2 }))).body.error, 'bad-decor', 'grown: refused');
  assert.equal((await place(figure({ scale: 0.5 }))).body.error, 'bad-decor', 'AUDIT HOME-VOTE II D7: shrunk: refused - a build from before still has Smaller');
  assert.equal((await place(figure({ id: 'book', flat: [209, 0], scale: 2 }))).status, 200, 'a book grown: stands');
  assert.equal((await place(figure())).status, 200, 'at its own size: stands');
  assert.equal((await move('fig1', placeOf(figure({ scale: 1.5 })))).body.error, 'decor-figure', 'moved to another size: refused');   // PIN MOVED (AUDIT HOME-VOTE II C2): in its own word
  // one grown before DECOR-FIGURE, as its row stands
  svc.env.DB._raw.prepare('UPDATE home_decor SET place = ? WHERE id = ?').run(JSON.stringify(placeOf(figure({ scale: 2 }))), 'fig1');
  const turned = await move('fig1', placeOf(figure({ scale: 2, rot: [45, 0, 0] })));
  assert.equal(turned.status, 200, `a turn of the old: kept (${JSON.stringify(turned.body)})`);
  assert.equal((await move('fig1', placeOf(figure({ scale: 3 })))).body.error, 'decor-figure', 'grown further: refused');   // PIN MOVED (AUDIT HOME-VOTE II C2)
  assert.equal((await move('fig1', placeOf(figure()))).status, 200, 'brought to its own size');
  assert.equal(JSON.parse(svc.env.DB._raw.prepare('SELECT place FROM home_decor WHERE id = ?').get('fig1').place).scale, 1);
  // AUDIT HOME-VOTE II C1: an own item said beside a person's flat is no item - refused, never stood at any size
  assert.equal(decorWhatOf({ flat: [184, 17], item: { t: 1 } }), null);
  assert.deepEqual(decorWhatOf({ flat: [209, 0], item: null }), { model: null, flat: [209, 0] }, 'a book stands as ever');
  const giant = await place(figure({ id: 'giant', item: { t: 1 }, scale: 4 }));
  assert.deepEqual([giant.status, giant.body.error], [400, 'bad-decor'], 'C1: the item no way past the figure\'s law');
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE id = ?').get('giant').n, 0);
  // AUDIT HOME-VOTE II C2: the stale copy's refusal said in words that send the player to look again
  assert.match(REFUSALS['decor-figure'], /^That figure has been set back to its normal size\. Look at the room again\.$/);
});

test('DECOR-FIGURE AUDIT C1: a figure brought back to its own size by a move pays nothing where it was shrunk before (it stands at that size for everyone already) and gives its half back where it was grown, as any shrink; any other piece grown pays as ever (mutants: the shrunk figure charged, the grown one\'s refund kept)', () => {
  assert.deepEqual(decorEditPrice(0.2, figure({ scale: 0.25, paid: 20 }), 1), { pay: 0, refund: 0, paid: 20 }, 'shrunk before: free, its cost as paid');
  assert.deepEqual(decorEditPrice(0.2, figure({ scale: 2, paid: 60 }), 1), { pay: 0, refund: 15, paid: 30 }, 'grown before: half back');
  assert.ok(decorEditPrice(0.2, figure({ flat: [209, 0], scale: 0.25, paid: 20 }), 1).pay > 0, 'a book grown: paid');
});

test('DECOR-FIGURE AUDIT C2: a figure grown before is turned where it stands on the ground it is drawn on - its own size - never refused for a footprint it no longer has (mutant: the record\'s scale read)', async () => {
  const asked = [];
  const rig = toolRig({ extraPeople: [[184, 17]], placeOk: (piece, foot) => { asked.push(foot); return null; } });
  await placeFrom(rig, 'f184.17');
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  rig.standing[rig.standing.length - 1] = { ...rig.standing.at(-1), scale: 2 };   // as one grown before DECOR-FIGURE stands
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  const roomTab = all(root, 'dfdecor-chip').find((c) => /^In this (room|yard)/.test(c.textContent));
  if (all(root, 'dfdecor-card')[0].dataset.mode !== 'room') roomTab.fire('click');
  rows(root).find((r) => r.dataset.key === rig.standing.at(-1).id).fire('click');
  rig.frame();
  asked.length = 0;
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Turn right').fire('click');
  const foot = asked.at(-1);
  assert.ok(foot?.length === 4, 'the turn asked the lot');
  assert.ok(Math.abs(Math.max(...foot.map(([x]) => Math.abs(x))) - 0.2) < 1e-9, `its own size's ground (${JSON.stringify(foot)})`);
});
