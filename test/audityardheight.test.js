// AUDIT YARD-HEIGHT (2026-10-06, Mac: "Audit"): YARD-HEIGHT and DECOR-TURN read again before their deploy
// (`06-Systems/Online-Arc.md` AUDIT YARD-HEIGHT). Y1: a placed piece's turn was a write to the account service on every
// press - four statements on its database, one of the hour's DECOR_OPS_MAX - and the piece stood still until it
// answered; now it turns at once and its turning is written once the presses settle (scenes/decorTool.js turnPlaced,
// writeTurn), on the piece as it then stands. Y2: an answer that came after the piece's removal stood it again. Y5: a
// turn and a station (or a light) of one piece in flight at once - the later wrote the earlier out; now each write of a
// piece waits for the one before it (pieceWrite). Y6: a picture turned fifteen degrees showed nothing. Y7: the service's
// move wrote a room's place onto a yard's row placed again under its id meanwhile. Y3 (the shared sentence) is pinned
// with the law (yardheight.test.js). Each pin failed on the build before it. tools/mutants/audityardheight.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DECOR_TURN_STEP } from '../src/systems/decorPlacer.js';
import { DECOR_TURN_SETTLE_MS } from '../src/scenes/decorTool.js';
import { settle, all, one, rows, toolRig, placeFrom } from './decorFakes.mjs';
import { standService, T0 } from './accountDb.mjs';

const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent)));
const roomTab = (root) => all(root, 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent));
function roomPress(rig, id, label) {
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'room') roomTab(root).fire('click');
  rows(root).find((r) => r.dataset.key === id).fire('click');
  rig.frame();
  btn(root, label).fire('click');
}

/** An online home over a service whose moves are answered at once, refused (`refuse`), or held until `release()`;
 *  `sent` every move and removal, in the order asked. */
async function online(key = 'm41000') {
  const calls = [];
  const sent = [];
  const held = [];
  const svc = {
    refuse: null, hold: false,
    async place(a) { return { ok: true, data: { piece: a.piece } }; },
    move(a) {
      calls.push(a);
      sent.push(['move', a.place]);
      if (svc.refuse) return Promise.resolve({ ok: false, error: svc.refuse });
      if (svc.hold) return new Promise((r) => held.push(() => r({ ok: true, data: {} })));
      return Promise.resolve({ ok: true, data: {} });
    },
    async remove(a) { sent.push(['remove', a.id]); return { ok: true, data: {} }; },
  };
  const q = [];
  const waits = [];
  const later = (fn, ms) => { q.push(fn); waits.push(ms); };
  const run = async () => { while (q.length) { q.shift()(); await settle(); await settle(); } };
  const release = async () => { held.shift()(); await settle(); await settle(); };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 300_000, later });
  await placeFrom(rig, key);
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  calls.length = 0;
  rig.frame();
  return { rig, svc, calls, sent, run, release, waits, piece: rig.standing.at(-1) };
}
const ticks = async () => { await settle(); await settle(); };

test('AUDIT Y1 a turning is one write: the presses wait DECOR_TURN_SETTLE_MS after the last, and only the last press\'s wait writes; presses while that write is answered are written after it - once, on the piece as it then stands - and never lost (mutants: the wait, every wait writing, the write under way written over, the presses during it lost)', async () => {
  const o = await online();
  roomPress(o.rig, o.piece.id, 'Turn right');
  btn(panelOf(o.rig), 'Turn right').fire('click');
  btn(panelOf(o.rig), 'Turn left').fire('click');
  assert.deepEqual(o.waits, [DECOR_TURN_SETTLE_MS, DECOR_TURN_SETTLE_MS, DECOR_TURN_SETTLE_MS]);
  assert.ok(DECOR_TURN_SETTLE_MS >= 250 && DECOR_TURN_SETTLE_MS <= 1000, 'a turning\'s presses, never a pause the player waits on');
  await o.run();
  assert.deepEqual(o.calls.map((c) => c.place.rot), [[DECOR_TURN_STEP, 0, 0]], 'three presses, one write - the last\'s');
  o.calls.length = 0;
  roomPress(o.rig, o.piece.id, 'Turn left');
  o.svc.hold = true;
  await o.run();
  assert.equal(o.calls.length, 1, 'the first written');
  btn(panelOf(o.rig), 'Turn right').fire('click');
  btn(panelOf(o.rig), 'Turn right').fire('click');
  await o.run();
  assert.equal(o.calls.length, 1, 'never over the write under way');
  assert.deepEqual(o.rig.standing[0].rot, [2 * DECOR_TURN_STEP, 0, 0], 'shown at once all the same');
  o.svc.hold = false;
  await o.release();
  await o.run();
  assert.equal(o.calls.length, 2, 'written after its answer, once');
  assert.deepEqual(o.calls[1].place.rot, [2 * DECOR_TURN_STEP, 0, 0]);
  await o.run();
  assert.equal(o.calls.length, 2, 'and nothing more');
});

test('AUDIT Y1 a light lit while a turn waits is never written back out by it; a refused turn undoes the turn alone - the piece turned back as the service holds it, its light as it stands - and the service\'s word is said (mutants: the turn written from the press\'s piece, the refusal undoing all, the refusal standing)', async () => {
  const o = await online();
  assert.equal(o.piece.light, null, 'a chair stands unlit');
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Light: off');
  await ticks();
  assert.equal(o.calls.length, 1, 'the light: written at once');
  const lamp = o.calls[0].place.light;
  assert.ok(lamp, 'lit - a warm lamp\'s');
  await o.run();
  assert.equal(o.calls.length, 2);
  assert.deepEqual([o.calls[1].place.rot, o.calls[1].place.light], [[DECOR_TURN_STEP, 0, 0], lamp], 'the turn on the piece as it stands - lit');
  // refused, after the light was put out while it waited: turned back, unlit as it stands
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Light: on');
  await ticks();
  assert.deepEqual([o.rig.standing[0].rot, o.rig.standing[0].light], [[2 * DECOR_TURN_STEP, 0, 0], null], 'put out - written at once');
  o.svc.refuse = 'decor-rate';
  await o.run();
  assert.deepEqual([o.rig.standing[0].rot, o.rig.standing[0].light], [[DECOR_TURN_STEP, 0, 0], null], 'turned back as the service holds it, unlit as it stands');
  assert.equal(o.rig.said.at(-1), 'refused: decor-rate');
});

test('AUDIT Y2 a piece removed while its turn waits is never written; a removal pressed while its turn is answered goes after that answer, which stands nothing again (mutants: the removed piece written, the removal sent under the turn)', async () => {
  const o = await online();
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Remove');
  await ticks();
  assert.equal(o.rig.standing.length, 0);
  await o.run();
  assert.deepEqual(o.calls, [], 'nothing written for a piece gone');
  const p = await online();
  roomPress(p.rig, p.piece.id, 'Turn right');
  p.svc.hold = true;
  await p.run();
  roomPress(p.rig, p.piece.id, 'Remove');
  await ticks();
  assert.deepEqual(p.sent.map(([k]) => k), ['move'], 'the removal waits on the turn\'s answer');
  assert.equal(p.rig.standing.length, 1);
  await p.release();
  await ticks();
  assert.deepEqual(p.sent.map(([k]) => k), ['move', 'remove']);
  assert.equal(p.rig.standing.length, 0, 'removed, and stood again by nothing');
});

test('AUDIT Y5 one write of a piece at a time: a turn settled while a station is being made waits for it, and carries the station - the licence paid once and kept; a light pressed while a turn is answered waits for that answer (mutants: the turn sent under the station, the light sent under the turn)', async () => {
  const o = await online();
  roomPress(o.rig, o.piece.id, 'Turn right');
  o.svc.hold = true;
  roomPress(o.rig, o.piece.id, /^Make station/);
  await ticks();
  assert.equal(o.calls.length, 1);
  assert.equal(o.calls[0].place.station, 'alchemy');
  await o.run();
  assert.equal(o.calls.length, 1, 'the turn waits on the station\'s answer');
  o.svc.hold = false;
  await o.release();
  await ticks();
  assert.equal(o.calls.length, 2);
  assert.deepEqual([o.calls[1].place.rot, o.calls[1].place.station], [[DECOR_TURN_STEP, 0, 0], 'alchemy'], 'the turn carries the station');
  assert.deepEqual([o.rig.standing[0].station, o.rig.w.paid.filter((g) => g === 50_000).length], ['alchemy', 1]);
  // a light pressed while a turn is answered
  roomPress(o.rig, o.piece.id, 'Turn right');
  o.svc.hold = true;
  await o.run();
  assert.equal(o.calls.length, 3);
  roomPress(o.rig, o.piece.id, 'Light: off');
  await ticks();
  assert.equal(o.calls.length, 3, 'the light waits on the turn\'s answer');
  o.svc.hold = false;
  await o.release();
  await ticks();
  assert.equal(o.calls.length, 4);
  assert.deepEqual(o.calls[3].place.rot, [2 * DECOR_TURN_STEP, 0, 0], 'the light on the piece as it then stands');
  assert.ok(o.calls[3].place.light);
});

test('AUDIT Y5 a piece moved while a turn waits writes its own turn: the turn owed is written no more once the move stands (mutant: the stale turn written over the move)', async () => {
  const o = await online();
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Move');
  o.rig.frame();
  await ticks();
  o.rig.frame();
  assert.equal(await o.rig.tool.commit(), true);
  assert.equal(o.calls.length, 1, 'the move');
  await o.run();
  assert.equal(o.calls.length, 1, 'and nothing after it');
  assert.deepEqual(o.rig.standing[0].rot, o.calls[0].place.rot);
});

test('AUDIT Y6 a picture standing on its own turns to face the other way - a billboard shows nothing of fifteen degrees; a yard\'s tree and a model turn a step (mutants: the picture stepped, the tree flipped)', async () => {
  const rig = toolRig({ gold: 1000 });
  await placeFrom(rig, 'f210.3');
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  const candle = rig.standing.at(-1);
  rig.frame();
  roomPress(rig, candle.id, 'Turn right');
  await ticks();
  assert.deepEqual(rig.standing[0].rot, [180, 0, 0], 'faces the other way');
  roomPress(rig, candle.id, 'Turn left');
  await ticks();
  assert.deepEqual(rig.standing[0].rot, [0, 0, 0], 'and back');
  rig.standing.push({ id: 'tree1', model: null, flat: [504, 12], pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 50 });
  rig.frame();
  roomPress(rig, 'tree1', 'Turn right');
  await ticks();
  assert.deepEqual(rig.standing[1].rot, [DECOR_TURN_STEP, 0, 0], 'a tree turns in earnest');
});

test('AUDIT Y7 the service\'s move writes the row it read: a room\'s piece removed and placed again in the yard under its id between the move\'s read and its write is never given the room\'s place - past the yard\'s height (mutant: the write unbound to the yard it read)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const raw = svc.env.DB._raw;
  const at = () => ({ id: o.character, ...raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const piece = { id: 'x1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 };
  const placed = await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), piece }, owner.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const db = svc.env.DB;
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    // between the move's read and its write: the piece removed and placed again in the yard, under its id
    if (/^UPDATE home_decor SET place = \? WHERE/.test(sql)) raw.prepare('UPDATE home_decor SET yard = 1 WHERE id = ?').run('x1');
    return prepare(sql);
  };
  const high = { pos: [8, 40, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 };
  const moved = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: o.character, id: 'x1', place: high }, owner.secret);
  assert.equal(moved.body.error, 'no-decor', 'the row it read is gone');
  const row = raw.prepare('SELECT yard, place FROM home_decor WHERE id = ?').get('x1');
  assert.deepEqual([row.yard, JSON.parse(row.place).pos], [1, [8, 0, 2]], 'the yard\'s piece as it was placed');
});
