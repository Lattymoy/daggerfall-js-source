// The free camera's menu: Move, Duplicate and Remove for a placed piece. The building's own furniture offers
// Take out alone. A cancelled action writes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorAimKind, decorLookOffers, decorPlaque, decorUseLabel, decorUseNext, decorUseCircle, decorHallRankNext, decorHallUseLabel } from '../../../src/systems/decor/decorLook.js';
import { decorListKey, primeDecorList, primedDecorList } from '../../../src/scenes/decor/decorRoom.js';
import { toolRig, placeFrom, all, settle, text, one } from '../../decorFakes.mjs';
import { loadDecorHotbar, saveDecorHotbar } from '../../../src/systems/decor/decorHotbar.js';

const piece = { id: 'p', model: 41000, item: null, storage: false, station: null, door: false };

test('the look tells a placed piece from the building\'s own furniture, a cupboard and the structure', () => {
  assert.equal(decorAimKind('decor:p', piece), 'decor');
  assert.equal(decorAimKind('decor:p', { ...piece, storage: true }), 'container');
  assert.equal(decorAimKind('decor:p', { ...piece, station: 'alchemy' }), 'station');
  assert.equal(decorAimKind('decor:p', { ...piece, door: true }), 'door');
  assert.equal(decorAimKind('base:chair'), 'base');
  assert.equal(decorAimKind('container:3'), 'container');
  assert.equal(decorAimKind('exit:0'), 'structural');
  assert.equal(decorAimKind('act:door'), 'structural');
  assert.equal(decorAimKind('intdoor:2'), 'roomdoor');
  assert.deepEqual(decorLookOffers({ key: 'intdoor:2', kind: 'roomdoor', mayEdit: true }), { move: false, duplicate: false, remove: true, out: false });
  assert.equal(decorLookOffers({ key: 'intdoor:2', kind: 'roomdoor', mayEdit: false }).remove, false);
  assert.deepEqual(decorLookOffers({ piece, kind: 'decor', holds: false, mayEdit: true }), { move: true, duplicate: true, remove: true, out: false, rename: true });
  assert.equal(decorLookOffers({ piece, kind: 'container', holds: true, mayEdit: true }).remove, false);
  assert.equal(decorLookOffers({ piece: { ...piece, item: { id: 1 } }, kind: 'decor', mayEdit: true }).duplicate, false);
  assert.deepEqual(decorLookOffers({ piece, kind: 'base', mayEdit: true }), { move: false, duplicate: false, remove: false, out: true });
  assert.equal(decorPlaque(null, { key: 'm1:41000', kind: 'base', mayEdit: true, name: 'Chair', holds: true }).actions[0].disabled, true);
  assert.deepEqual(decorLookOffers({ key: 'exit:0', mayEdit: true }), { move: false, duplicate: false, remove: false, out: false });
  assert.equal(decorLookOffers({ piece, kind: 'decor', mayEdit: false }).move, false);
  assert.equal(decorLookOffers({ piece, kind: 'station', holds: false, mayEdit: true }).move, true);
  assert.equal(decorPlaque(null, { piece: { ...piece, station: 'alchemy' }, mayEdit: true, name: 'Bed' }).actions.at(-1).label, 'Who may use: Me');
  assert.equal(decorPlaque(null, { piece: { ...piece, station: 'alchemy' }, mayEdit: true, name: 'Bed', use: decorUseLabel('guild') }).actions.at(-1).label, 'Who may use: Guild');
  assert.deepEqual(['private', 'friends', 'party', 'guild'].map((m, i, a) => decorUseNext(a[i])), ['friends', 'party', 'guild', 'private']);
  assert.deepEqual([3, 2, 1, 0].map((rank) => decorHallRankNext(rank)), [2, 1, 0, 3]);
  assert.equal(decorHallUseLabel(1), 'Who may use: Officers');
  assert.deepEqual(decorUseCircle({ name: 'Aldric', friends: new Map([['m', { name: 'Mara' }]]), party: { members: [{ name: 'Aldric' }, { name: 'Sven' }] } }), { friends: ['Mara'], party: ['Sven'] });
  assert.deepEqual(decorPlaque(null, { piece, mayEdit: true, name: 'Chair' }).actions.map((a) => a.id), ['move', 'duplicate', 'remove', 'rename']);
  assert.deepEqual(decorPlaque(null, { key: 'm1:41000', kind: 'base', mayEdit: true, name: 'Stool' }).actions.map((a) => a.label), ['Take out']);
  assert.equal(decorPlaque({ title: 'Chest' }, null).title, 'Chest');
  assert.equal(decorPlaque(null, null), null);
});

test('duplicating from the flight copies nothing until it is placed, and there is no button menu', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'm41000');
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  const first = rig.standing[0];
  const gold = rig.w.gold;
  rig.slots.at(-1)[1].input('Escape');
  rig.frame();
  rig.doc.body.children.find((c) => String(c.className).includes('dfdecor-open')).fire('click');
  rig.frame();
  assert.equal(rig.tool.act('duplicate', first.id), true);
  rig.frame();
  await settle();
  rig.frame();
  const g = rig.tool.ghost();
  assert.ok(g && g.id !== first.id && g.model === first.model);
  assert.equal(rig.standing.length, 1);
  assert.equal(rig.w.gold, gold);
  assert.equal(rig.doc.body.children.some((c) => String(c.className).split(/\s+/).includes('dfdecor-look')), false);
  rig.tool.back();
  assert.equal(rig.standing.length, 1);
  assert.equal(rig.w.gold, gold);
});

test('a duplicate stands before the scan has measured it, from what the piece cost, and the eye looks through the original', async () => {
  const stood = { id: 'abcdefghijkl', model: 41000, flat: null, pos: [1, 0, 1], rot: [15, 0, 0], scale: 1, light: null, storage: false, paid: 150 };
  const cold = toolRig({ gold: 5000, radius: () => null });
  cold.standing.push(stood);
  cold.frame();
  cold.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-open')).fire('click');
  cold.frame();
  assert.equal(cold.tool.act('duplicate', stood.id), true);
  cold.frame();
  await settle();
  cold.frame();
  const g = cold.tool.ghost();
  assert.ok(g && g.id !== stood.id && g.model === 41000 && g.rot[0] === 15);
  assert.notEqual(cold.tool.why(), 'It cannot stand there.');
  assert.ok(cold.rays.some((f) => f?.skip?.includes('decor:abcdefghijkl')));
  assert.equal(cold.standing.length, 1);

  const late = toolRig({ gold: 5000 });
  late.standing.push({ ...stood, id: 'latepiece000', paid: 0 });
  late.frame();
  late.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-open')).fire('click');
  late.frame();
  assert.equal(late.tool.act('duplicate', 'latepiece000'), true);
  assert.equal(late.tool.ghost(), null);
  for (let i = 0; i < 6; i++) { late.frame(); await settle(); }
  assert.equal(late.tool.ghost()?.model, 41000);
  assert.notEqual(late.tool.why(), 'It cannot stand there.');
});

test('decorating starts as a flight, the catalogue opens from the bar and closing it stays in the flight', () => {
  const rig = toolRig({ gold: 5000 });
  rig.frame();
  const before = rig.cursorOffs();
  rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-open')).fire('click');
  rig.frame();
  assert.equal(rig.tool.flying(), true);
  const openBar = rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
  assert.equal(one(openBar, 'dfdecor-bar-count').textContent, '0 of 200');
  assert.ok(rig.cursorOffs() > before);
  assert.equal(rig.tool.panelOpen(), false);
  assert.equal(rig.tool.ghost(), null);
  const bar = rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
  const catalog = all(bar, 'dfdecor-chip').find((c) => c.textContent === 'Catalogue');
  assert.equal(catalog.hidden, false);
  assert.equal(all(bar, 'dfdecor-btn').find((b) => b.textContent === 'Place').hidden, true);
  const pressed = rig.win.fire('keydown', { code: 'Tab' });
  assert.equal(pressed.stopped, true);
  assert.equal(rig.tool.panelOpen(), true);
  rig.win.fire('keydown', { code: 'Tab' });
  assert.equal(rig.tool.panelOpen(), false);
  assert.equal(rig.tool.flying(), true);
  rig.win.fire('keydown', { code: 'Tab' });
  assert.equal(rig.tool.panelOpen(), true);
  const atClose = rig.cursorOffs();
  rig.win.fire('keydown', { code: 'Escape' });
  assert.equal(rig.tool.flying(), true);
  assert.equal(rig.tool.panelOpen(), false);
  assert.ok(rig.cursorOffs() > atClose);
  const atUp = rig.cursorOffs();
  rig.win.fire('keyup', { code: 'Escape' });
  assert.ok(rig.cursorOffs() > atUp);
  rig.frame();
  rig.win.fire('keydown', { code: 'Escape' });
  rig.frame();
  assert.equal(rig.tool.flying(), false);
});

test('a guild hall holds 300 pieces and a Charter Room keeps the cap it was given', () => {
  const hall = toolRig({ room: { kind: 'home', hall: true, where: "Your guild's hall" } });
  hall.frame();
  assert.equal(hall.tool.openPanel(), true);
  assert.match(text(one(hall.doc.body, 'dfdecor-foot')), /0 of 300/);
  const seat = toolRig({ room: { kind: 'home', hall: true, seat: true, cap: 100, where: 'Charter Room' } });
  seat.frame();
  seat.tool.openPanel();
  assert.match(text(one(seat.doc.body, 'dfdecor-foot')), /0 of 100/);
});

test('moving a piece returns to the flight with the catalogue closed', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'm41000');
  await rig.tool.commit();
  const id = rig.standing[0].id;
  rig.tool.back();
  rig.slots.at(-1)[1].input('Escape');
  rig.frame();
  rig.doc.body.children.find((c) => String(c.className).includes('dfdecor-open')).fire('click');
  rig.frame();
  assert.equal(rig.tool.act('move', id), true);
  rig.frame();
  await settle();
  rig.frame();
  assert.ok(rig.tool.ghost());
  assert.equal(await rig.tool.commit(), true);
  assert.equal(rig.tool.panelOpen(), false);
  assert.equal(rig.tool.flying(), true);
  assert.equal(rig.tool.ghost(), null);
});

test('a removal takes the piece down before the service answers, and puts it back when the service refuses', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let answer = { ok: false, error: 'decor-rate' };
  const homeDecor = { remove: () => gate.then(() => answer) };
  const rig = toolRig({ room: { kind: 'home', mapId: 1, buildingKey: 2, where: 'Your home' }, homeDecor, gold: 100 });
  rig.standing.push({ id: 'p', model: 41000, pos: [10, 0, 12], rot: [0, 0, 0], scale: 1, paid: 40, storage: false, item: null, station: null, door: false });
  rig.frame();
  rig.doc.body.children.find((c) => String(c.className).includes('dfdecor-open')).fire('click');
  rig.frame();
  assert.equal(rig.tool.act('remove', 'p'), true);
  await settle();
  assert.equal(rig.standing.length, 0);
  assert.equal(rig.w.gold, 100);
  release();
  await settle();
  assert.equal(rig.standing.length, 1);
  assert.equal(rig.w.gold, 100);
  assert.match(rig.said.at(-1), /refused: decor-rate/);
});

test('the list asked at the door is the one the room stands, and a different door does not take it', async () => {
  let n = 0;
  primeDecorList(decorListKey(7, 3, false), () => { n += 1; return { ok: true, data: { pieces: [] } }; });
  assert.equal(primedDecorList(decorListKey(7, 3, true)), null);
  const same = primedDecorList(decorListKey(7, 3, false));
  assert.deepEqual(await same, { ok: true, data: { pieces: [] } });
  assert.equal(n, 1);
  assert.equal(primedDecorList(decorListKey(7, 3, false)), null);
  primeDecorList(null, () => { n += 1; });
  assert.equal(n, 1);
});

test('Decorate is a binding, and it starts the flight only where the button would', () => {
  const rig = toolRig({ gold: 5000, keys: [['F6', 'Decorate']] });
  const press = () => rig.win.fire('keydown', { code: 'F6' });
  assert.equal(press().stopped, false);
  rig.frame({ overlayUp: true });
  assert.equal(press().stopped, false);
  assert.equal(rig.tool.flying(), false);
  rig.frame();
  assert.equal(press().stopped, true);
  assert.equal(rig.tool.flying(), true);
  press();
  assert.equal(rig.tool.flying(), true);
  const away = toolRig({ room: null, keys: [['F6', 'Decorate']] });
  away.frame();
  assert.equal(away.win.fire('keydown', { code: 'F6' }).stopped, false);
  assert.equal(away.tool.flying(), false);
});

test('the hotbar keeps ten catalogue ids on this device', () => {
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => { box.set(k, v); } };
  assert.deepEqual(loadDecorHotbar(storage), Array(10).fill(null));
  saveDecorHotbar(['m41000', 'nope', 'f210.3'], storage);
  assert.deepEqual(loadDecorHotbar(storage).slice(0, 3), ['m41000', null, 'f210.3']);
});

test('the hotbar keeps a catalogue piece, the wheel does not move along it, and leaving a placement from it stays in the flight', async () => {
  const rig = toolRig({ gold: 5000, keys: [['Digit1', 'QuickUse1']] });
  rig.frame();
  rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-open')).fire('click');
  rig.frame();
  const hot = () => all(rig.doc.body, 'hb-slot');
  const barRoot = () => rig.doc.body.children.find((c) => String(c.className).split(/\s+/).includes('hb-decor'));
  assert.equal(hot().length, 10);
  assert.equal(barRoot().dataset.up, '1');
  assert.equal(all(hot()[0], 'hb-icon').length, 1);
  rig.win.fire('wheel', { deltaY: 100 });
  assert.equal(String(hot()[0].className).includes('hb-active'), true);
  assert.equal(String(hot()[1].className).includes('hb-active'), false);
  assert.equal(rig.tool.ghost(), null);
  all(rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar')), 'dfdecor-chip').find((c) => c.textContent === 'Catalogue').fire('click');
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  all(root, 'dfdecor-row').find((r) => r.dataset.key === 'm41000').fire('click');
  rig.win.fire('keydown', { code: 'Digit1' });
  assert.equal(hot()[0].dataset.filled, '1');
  assert.equal(hot()[0].textContent.includes('41000'), false);
  assert.equal(barRoot().dataset.up, '1');
  rig.win.fire('keydown', { code: 'Escape' });
  rig.frame();
  assert.equal(rig.tool.flying(), true);
  assert.equal(rig.tool.panelOpen(), false);
  hot()[0].fire('click');
  rig.frame();
  await settle();
  rig.frame();
  assert.equal(rig.tool.ghost()?.model, 41000);
  assert.equal(barRoot().dataset.up, '0');
  rig.win.fire('keydown', { code: 'Escape' });
  assert.equal(rig.tool.flying(), true);
  assert.equal(rig.tool.panelOpen(), false);
});
