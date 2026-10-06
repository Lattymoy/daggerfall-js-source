// YARD-HEIGHT and DECOR-TURN (2026-10-06, Mac: "limit the height at which players can build, along with adding the
// ability to rotate objects on the ground. People currently can build towers that seem out of place"; Mac's calls: 4 m,
// and "Turn placed pieces"). A yard's piece stands at most DECOR_YARD_HIGH over the ground - refused at both ends
// (net/decorLaw.js decorYardHighOk: server-account/src/decor.js placeDecor and moveDecor, scenes/homeYards.js
// yardWhyNot) - each piece stood on the one below had climbed as far as DECOR_YARD_POS_MAX. And a placed piece is turned
// where it stands from the panel's "In this room" view (ui/decorPanel.js Turn left / Turn right, scenes/decorTool.js
// turnPlaced) - free, never picked up; online, written once its presses settle (AUDIT Y1). Each pin failed on the build
// before it. tools/mutants/yardheight.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DECOR_YARD_HIGH, decorYardHighOk } from '../src/net/decorLaw.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { yardWhyNot, YARD_TOO_HIGH, YARD_IN_HOUSE } from '../src/scenes/homeYards.js';
import { DECOR_TURN_STEP } from '../src/systems/decorPlacer.js';
import { createDecorPanel } from '../src/ui/decorPanel.js';
import { standService, T0 } from './accountDb.mjs';
import { settle, fakeDoc, fakeWin, all, one, catalogue, rows, toolRig, placeFrom } from './decorFakes.mjs';

const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });
const placeOf = (p) => ({ pos: p.pos, rot: p.rot, scale: p.scale, light: p.light, storage: p.storage, paid: p.paid });

test('YARD-HEIGHT the law: a yard\'s piece stands at most DECOR_YARD_HIGH (4 m) over the ground - its place\'s height, from the building\'s own origin on the town\'s ground; the client refuses it in its own words, after the lot\'s own reasons; the service\'s refusal is worded (mutants: the bound, the comparison, the client unasked)', () => {
  assert.equal(DECOR_YARD_HIGH, 4, 'Mac\'s call');
  assert.equal(decorYardHighOk({ pos: [0, 4, 0] }), true, 'at the bound: stands');
  assert.equal(decorYardHighOk({ pos: [0, 4.001, 0] }), false, 'past it: never');
  assert.equal(decorYardHighOk({ pos: [0, -0.5, 0] }), true, 'sunk a little: stands');
  assert.equal(decorYardHighOk({}), false, 'no place: never');
  const lot = { house: [-4, -3, 4, 3], lot: [-10, -9, 10, 9], y: 0 };
  assert.equal(yardWhyNot([8, 4, 2], lot), null);
  assert.equal(yardWhyNot([8, 4.5, 2], lot), YARD_TOO_HIGH);
  assert.equal(yardWhyNot([0, 9, 0], lot), YARD_IN_HOUSE, 'a roof is the house first');
  assert.match(YARD_TOO_HIGH, /4 m/);
  assert.equal(REFUSALS['yard-high'], YARD_TOO_HIGH, 'AUDIT Y3: the service\'s refusal, the decorator\'s own sentence');
});

test('YARD-HEIGHT the service: a yard\'s piece placed past DECOR_YARD_HIGH is refused (`yard-high`) and none stands; at it, it stands; a yard\'s piece moved up past it is refused and stands where it stood; a room\'s piece is never asked (mutants: the place unguarded, the move unguarded, the room\'s piece capped)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), ...body }, owner.secret);
  const move = (id, pl) => svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: o.character, id, place: pl }, owner.secret);
  const high = await place({ piece: piece({ pos: [8, DECOR_YARD_HIGH + 0.5, 2] }), yard: true });
  assert.equal(high.body.error, 'yard-high', 'a tower\'s piece');
  const yards = async () => (await svc.call('/v1/homes/yards', { mapId: 7 })).body.yards;
  assert.deepEqual(await yards(), [], 'none stands');
  const top = await place({ piece: piece({ pos: [8, DECOR_YARD_HIGH, 2] }), yard: true });
  assert.equal(top.status, 200, JSON.stringify(top.body));
  const up = await move('yard1', placeOf(piece({ pos: [8, DECOR_YARD_HIGH + 2, 2] })));
  assert.equal(up.body.error, 'yard-high', 'moved up into a tower');
  const raw = svc.env.DB._raw.prepare('SELECT place FROM home_decor WHERE id = ?').get('yard1');
  assert.deepEqual(JSON.parse(raw.place).pos, [8, DECOR_YARD_HIGH, 2], 'it stands where it stood');
  const turned = await move('yard1', placeOf(piece({ pos: [8, DECOR_YARD_HIGH, 2], rot: [45, 0, 0] })));
  assert.equal(turned.status, 200, 'turned where it stands');
  const shelf = await place({ piece: piece({ id: 'room1', pos: [1, 9, 1] }) });
  assert.equal(shelf.status, 200, 'a room\'s high shelf: never a yard\'s bound');
});

// ─── DECOR-TURN ──────────────────────────────────────────────────────────────────────────────────────────────────────

const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => b.textContent === label);
const roomTab = (root) => all(root, 'dfdecor-chip').find((c) => /^In this (room|yard)/.test(c.textContent));
async function placedOne(rig, key = 'm41000') {
  await placeFrom(rig, key);
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  return rig.standing.at(-1);
}
function roomPress(rig, id, label) {
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'room') roomTab(root).fire('click');
  rows(root).find((r) => r.dataset.key === id).fire('click');
  rig.frame();
  btn(root, label).fire('click');
}

test('DECOR-TURN the panel: a placed piece chosen is turned where it stands, Turn left and Turn right - a step each way, the panel staying up; nothing chosen, or a door (turned by its doorway), they stand idle (mutants: the direction, the door turned, the panel closed)', () => {
  const doc = fakeDoc();
  const calls = [];
  let closed = 0;
  const panel = createDecorPanel({ doc, win: fakeWin(), onPlace() {}, onClose: () => { closed++; }, onTurn: (p, dir) => calls.push([p.id, dir]) });
  const entries = catalogue();
  const chair = { id: 'c1', model: 41000, flat: null, pos: [1, 0, 1], rot: [30, 0, 0], scale: 1, light: null, storage: false, paid: 120 };
  const door = { ...chair, id: 'd1', model: 9000 };
  const placed = [{ piece: chair, name: 'Chair', entry: entries[0], holds: false }, { piece: door, name: 'Door', entry: null, holds: false }];
  const view = () => ({ where: 'Your house', entries, progress: 1, ready: true, gold: 1000, count: 2, cap: 100, radiusOf: () => 0.5, priceOf: () => 75, placed });
  panel.open(view());
  const root = panel.root;
  roomTab(root).fire('click');
  panel.update(view());
  assert.ok(btn(root, 'Turn left').disabled && btn(root, 'Turn right').disabled, 'nothing chosen');
  rows(root).find((r) => r.dataset.key === 'c1').fire('click');
  panel.update(view());
  btn(root, 'Turn right').fire('click');
  btn(root, 'Turn left').fire('click');
  assert.deepEqual(calls, [['c1', 1], ['c1', -1]]);
  assert.equal(closed, 0, 'the panel stays up');
  assert.ok(panel.isOpen());
  rows(root).find((r) => r.dataset.key === 'd1').fire('click');
  panel.update(view());
  assert.ok(btn(root, 'Turn left').disabled && btn(root, 'Turn right').disabled, 'a door: by its doorway');
  btn(root, 'Turn right').fire('click');
  assert.equal(calls.length, 2);
});

test('DECOR-TURN offline: Turn right turns the piece DECOR_TURN_STEP about its upright, Turn left back past it - where it stands, its scale and cost as they were, free; turned past half a turn it wraps (mutants: the step, the axis, the wrap, the place moved, a price)', async () => {
  const rig = toolRig({ gold: 1000 });
  const chair = await placedOne(rig);
  const gold = rig.w.gold;
  rig.frame();
  roomPress(rig, chair.id, 'Turn right');
  await settle();
  assert.deepEqual(rig.standing[0].rot, [DECOR_TURN_STEP, 0, 0]);
  assert.deepEqual([rig.standing[0].pos, rig.standing[0].scale, rig.standing[0].paid], [chair.pos, chair.scale, chair.paid], 'where it stood, as it was');
  rig.frame();
  roomPress(rig, chair.id, 'Turn left');
  await settle();
  rig.frame();
  roomPress(rig, chair.id, 'Turn left');
  await settle();
  assert.deepEqual(rig.standing[0].rot, [-DECOR_TURN_STEP, 0, 0]);
  assert.equal(rig.standing.length, 1, 'never a second piece');
  assert.equal(rig.w.gold, gold, 'free');
  for (let i = 0; i < 180 / DECOR_TURN_STEP; i++) { rig.frame(); roomPress(rig, chair.id, 'Turn right'); await settle(); }
  assert.deepEqual(rig.standing[0].rot, [180 - DECOR_TURN_STEP, 0, 0]);
  rig.frame();
  roomPress(rig, chair.id, 'Turn right');
  await settle();
  rig.frame();
  roomPress(rig, chair.id, 'Turn right');
  await settle();
  assert.deepEqual(rig.standing[0].rot, [-180 + DECOR_TURN_STEP, 0, 0], 'wrapped into the law\'s half turn');
});

/** A clock a pin turns by hand: each call waits until `run()`, in the order asked. */
function handClock() {
  const q = [];
  return {
    later: (fn) => { q.push(fn); },
    async run() { while (q.length) { q.shift()(); await settle(); await settle(); } },
    waiting: () => q.length,
  };
}

test('DECOR-TURN online: the piece turns at once as each press is made, and the turning is written once its presses settle (DECOR_TURN_SETTLE_MS) - the piece\'s whole place, only its turn changed, the account service\'s - never a write a press (mutants: the write skipped, a write a press, the turn shown late)', async () => {
  const calls = [];
  const svc = {
    async place(a) { return { ok: true, data: { piece: a.piece } }; },
    async move(a) { calls.push(a); return { ok: true, data: { piece: { ...rig.standing[0], ...a.place } } }; },
    async remove() { return { ok: true, data: {} }; },
  };
  const clock = handClock();
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 1000, later: clock.later });
  const chair = await placedOne(rig);
  calls.length = 0;
  rig.frame();
  roomPress(rig, chair.id, 'Turn right');
  btn(panelOf(rig), 'Turn right').fire('click');
  btn(panelOf(rig), 'Turn right').fire('click');
  await settle();
  assert.deepEqual(rig.standing[0].rot, [3 * DECOR_TURN_STEP, 0, 0], 'turned at once, each press');
  assert.deepEqual(calls, [], 'nothing written while the presses come');
  await clock.run();
  assert.deepEqual(calls, [{ mapId: 77, buildingKey: 9, character: 'char-me', id: chair.id, place: placeOf({ ...chair, rot: [3 * DECOR_TURN_STEP, 0, 0] }) }], 'one write, the turning whole');
  assert.deepEqual(rig.standing[0].rot, [3 * DECOR_TURN_STEP, 0, 0]);
  assert.equal(rig.standing.length, 1);
});

test('DECOR-TURN in a yard: a piece whose turned footprint would reach the house is refused in the lot\'s words and the service never asked; one clear of it turns (mutant: the lot unasked)', async () => {
  const calls = [];
  const svc = {
    async place(a) { return { ok: true, data: { piece: a.piece } }; },
    async move(a) { calls.push(a); return { ok: true, data: {} }; },
    async remove() { return { ok: true, data: {} }; },
  };
  // the house's footprint stands from x = 0.55 east (0.6 past the edge's pad): the metre-wide chair at the origin clears
  // it square (0.5), turned a step its corner reaches 0.61
  const lot = { house: [0.55, -5, 5, 5], lot: [-6, -6, 6, 6], y: 0 };
  const clock = handClock();
  const rig = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 1000, placeOk: (p, foot) => yardWhyNot(p.pos, lot, [], foot), later: clock.later });
  rig.standing.push({ id: 'c1', model: 41000, flat: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 });
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  roomTab(panelOf(rig)).fire('click');
  rows(panelOf(rig)).find((r) => r.dataset.key === 'c1').fire('click');
  rig.frame();   // the chosen piece's model asked (its box, the ground it covers)
  await settle();
  for (let i = 0; i < 3; i++) { roomPress(rig, 'c1', 'Turn right'); await settle(); }
  await clock.run();
  assert.deepEqual(calls, [], 'never asked');
  assert.equal(rig.said.at(-1), YARD_IN_HOUSE);
  assert.deepEqual(rig.standing[0].rot, [0, 0, 0]);
  rig.standing[0] = { ...rig.standing[0], pos: [-2, 0, 0] };
  rig.frame();
  roomPress(rig, 'c1', 'Turn right');
  await clock.run();
  assert.equal(calls.length, 1);
  assert.deepEqual(rig.standing[0].rot, [DECOR_TURN_STEP, 0, 0]);
});
