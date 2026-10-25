// DECOR-BATCH: the session's final differences, and Confirm / Discard on the decorator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorDelta, decorDraftGold, decorDraftParts, decorDraftText, decorHallDraftText } from '../../../src/systems/decor/decorDraft.js';
import { toolRig } from '../../decorFakes.mjs';

const piece = (extra = {}) => ({ id: 'p1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });

test('DECOR-BATCH the differences: several edits of one piece are its last state, and a piece added then removed is neither', () => {
  const before = [piece()];
  const moved = piece({ pos: [2, 0, 2] });
  const again = piece({ pos: [3, 0, 3], scale: 2, paid: 360 });
  assert.deepEqual(decorDelta(before, [again]).drop, []);
  assert.equal(decorDelta(before, [again]).put.length, 1);
  assert.equal(decorDelta(before, [again]).put[0].pos[0], 3);
  assert.deepEqual(decorDelta(before, before), { put: [], drop: [] }, 'added and then removed, the room matches how it started');
  assert.equal(decorDelta(before, [piece({ name: 'The red chest' })]).put.length, 1, 'a new name is a change Confirm keeps');
  assert.equal(decorDraftGold([], [piece()]), -180);
  assert.equal(decorDraftGold(before, []), 90, 'half of what it cost comes back');
  const mixed = decorDraftParts(before, [piece({ id: 'p2', pos: [4, 0, 4] })]);
  assert.deepEqual(mixed, { delta: -90, pay: 180, back: 90 }, 'a hall pays the new piece and gives the old one\'s half to the guild');
  assert.match(decorHallDraftText(mixed), /180 gold to confirm, 90 to the guild/);
  assert.match(decorDraftText(-180), /180 gold to confirm/);
  assert.match(decorDraftText(90), /90 gold back/);
});

test('DECOR-BATCH the decorator: Confirm sends the difference once, a refusal keeps the draft, Discard puts the room back and Escape will not throw it away', async () => {
  const sent = [];
  let rev = 4;
  let fail = true;
  const room = { kind: 'home', mapId: 11, buildingKey: 22 };
  const rig = toolRig({
    room, gold: 1000,
    homeDecor: {
      list: async () => ({ ok: true, data: { rev, pieces: [] } }),
      batch: async (body) => {
        sent.push(body);
        if (fail) return { ok: false, error: 'decor-rev' };
        rev = body.rev + 1;
        return { ok: true, data: { rev, gold: -180 } };
      },
    },
    realm: async (act) => {
      act.reserve?.();
      const res = await act.call({ id: 'char-me', lease: 'lease', seq: 1 });
      if (!res?.ok) return res;
      act.apply?.(res);
      return res;
    },
  });
  rig.frame();
  rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
  assert.equal(rig.tool.flying(), true);
  rig.standing.push(piece());
  const kept = await rig.tool.confirmDraft();
  assert.equal(kept, false, `a refusal keeps the session (${JSON.stringify(rig.said)} gold ${rig.w.gold})`);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].put.length, 1);
  assert.deepEqual(sent[0].drop, []);
  assert.equal(sent[0].rev, 4);
  const txn = sent[0].txn;
  assert.equal(rig.w.gold, 1000, 'the purse is not charged for a change the service refused');
  rig.win.fire('keydown', { code: 'Escape', repeat: false });
  assert.equal(rig.tool.flying(), true, 'leaving the mode does not throw the draft away');
  fail = false;
  assert.equal(await rig.tool.confirmDraft(), true);
  assert.equal(sent[1].txn, txn, 'the same Confirm is asked again');
  assert.equal(sent.length, 2);
  assert.equal(rig.w.gold, 820);
  rig.standing.push(piece({ id: 'gone' }));
  rig.tool.discardDraft();
  assert.deepEqual(rig.standing.map((p) => p.id), ['p1']);
  rig.win.fire('keydown', { code: 'Escape', repeat: false });
  assert.equal(rig.tool.flying(), false, 'a kept room leaves the mode');
});

test('DECOR-BATCH a copy\'s access waits until Confirm has written the piece', async () => {
  const use = [];
  const rig = toolRig({
    room: { kind: 'home', mapId: 11, buildingKey: 22 }, gold: 1000,
    homeDecor: {
      list: async () => ({ ok: true, data: { rev: 4, pieces: [] } }),
      batch: async (body) => ({ ok: true, data: { rev: body.rev + 1, gold: -180 } }),
      use: async (body) => { use.push(body); return body.op === 'grants' ? { ok: true, data: { use: [] } } : { ok: true, data: { mode: body.mode, names: body.names } }; },
    },
  });
  rig.frame();
  rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
  const copy = piece({ id: 'w5qa926ueywi', storage: true });
  rig.standing.push(copy);
  assert.equal(rig.tool.act('access', copy.id), true);
  await Promise.resolve();
  assert.deepEqual(use.filter((b) => b.op === 'set'), [], 'the service has no row for a copy until Confirm');
  assert.ok(rig.said.includes('Who may use: Friends.'));
  assert.equal(await rig.tool.confirmDraft(), true);
  assert.deepEqual(use.filter((b) => b.op === 'set'), [{ mapId: 11, buildingKey: 22, character: 'char-me', op: 'set', id: copy.id, kind: 'storage', mode: 'friends', names: [], realm: null }]);
});
