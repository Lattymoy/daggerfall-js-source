// AUDIT YARD-HEIGHT (2026-10-06, Mac: "Audit"): YARD-HEIGHT and DECOR-TURN read again before their deploy
// (`06-Systems/Online-Arc.md` AUDIT YARD-HEIGHT). Y1: a placed piece's turn was a write to the account service on every
// press - four statements on its database, one of the hour's DECOR_OPS_MAX - and the piece stood still until it
// answered; now it turns at once and its turning is written once the presses settle (scenes/decorTool.js turnPlaced,
// writeTurn), on the piece as it then stands. Y2: an answer that came after the piece's removal stood it again. Y3 (the
// shared sentence) is pinned with the law (yardheight.test.js). Each pin failed on the build before it.
// tools/mutants/audityardheight.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DECOR_TURN_STEP } from '../src/systems/decorPlacer.js';
import { DECOR_TURN_SETTLE_MS } from '../src/scenes/decorTool.js';
import { settle, all, one, rows, toolRig, placeFrom } from './decorFakes.mjs';

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

/** An online home over a service whose moves are answered at once, refused (`refuse`), or held until `release()`. */
async function online(key = 'm41000') {
  const calls = [];
  const held = [];
  const svc = {
    refuse: null, hold: false,
    async place(a) { return { ok: true, data: { piece: a.piece } }; },
    move(a) {
      calls.push(a);
      if (svc.refuse) return Promise.resolve({ ok: false, error: svc.refuse });
      if (svc.hold) return new Promise((r) => held.push(() => r({ ok: true, data: {} })));
      return Promise.resolve({ ok: true, data: {} });
    },
    async remove() { return { ok: true, data: {} }; },
  };
  const q = [];
  const waits = [];
  const later = (fn, ms) => { q.push(fn); waits.push(ms); };
  const run = async () => { while (q.length) { q.shift()(); await settle(); await settle(); } };
  const release = async () => { held.shift()(); await settle(); await settle(); };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 1000, later });
  await placeFrom(rig, key);
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  calls.length = 0;
  rig.frame();
  return { rig, svc, calls, run, release, waits, piece: rig.standing.at(-1) };
}

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

test('AUDIT Y1 a light put out while a turn waits is never written back over by it; a refused turn undoes the turn alone - the piece turned back as the service holds it, its light as it is - and the service\'s word is said (mutants: the turn written from the press\'s piece, the refusal undoing all, the refusal standing)', async () => {
  const o = await online('f210.3');
  const lit = o.piece.light;
  assert.ok(lit, 'a candle stands lit');
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Light: on');
  await settle();
  await settle();
  assert.equal(o.calls.length, 1, 'the light: written at once');
  assert.equal(o.calls[0].place.light, null);
  await o.run();
  assert.equal(o.calls.length, 2);
  assert.deepEqual([o.calls[1].place.rot, o.calls[1].place.light], [[DECOR_TURN_STEP, 0, 0], null], 'the turn on the piece as it stands - put out');
  // refused, after the light was lit again while it waited: turned back, lit as it stands
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Light: off');
  await settle();
  await settle();
  assert.deepEqual([o.rig.standing[0].rot, o.rig.standing[0].light], [[2 * DECOR_TURN_STEP, 0, 0], lit], 'lit again - written at once');
  o.svc.refuse = 'decor-rate';
  await o.run();
  assert.deepEqual([o.rig.standing[0].rot, o.rig.standing[0].light], [[DECOR_TURN_STEP, 0, 0], lit], 'turned back as the service holds it, lit as it stands');
  assert.equal(o.rig.said.at(-1), 'refused: decor-rate');
});

test('AUDIT Y2 a piece removed while its turn waits is never written; one removed while its turn is answered is never stood again by the answer (mutants: the removed piece written, the answer standing it again)', async () => {
  const o = await online();
  roomPress(o.rig, o.piece.id, 'Turn right');
  roomPress(o.rig, o.piece.id, 'Remove');
  await settle();
  await settle();
  assert.equal(o.rig.standing.length, 0);
  await o.run();
  assert.deepEqual(o.calls, [], 'nothing written for a piece gone');
  const p = await online();
  roomPress(p.rig, p.piece.id, 'Turn right');
  p.svc.hold = true;
  await p.run();
  assert.equal(p.calls.length, 1);
  roomPress(p.rig, p.piece.id, 'Remove');
  await settle();
  await settle();
  assert.equal(p.rig.standing.length, 0);
  await p.release();
  assert.equal(p.rig.standing.length, 0, 'the answer stands nothing');
});
