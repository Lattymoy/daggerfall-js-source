// The transfer is asked in the game's own windows. A form on the page sits under the canvas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openHomeTransfer, answerHomeTransfer } from '../../src/ui/homeTransferWindow.js';

const flush = () => new Promise((r) => { setTimeout(r, 0); });

test('transfer ownership asks in the game windows and sends the offer without a character of its own', async () => {
  const shown = [];
  const sent = [];
  const said = [];
  const host = { onlineHomes: { transfer: async (b) => { sent.push(b); return { ok: true, data: {} }; } } };
  assert.equal(openHomeTransfer(9, 3, host, (t) => said.push(t), (c) => c, null, (w) => shown.push(w)), true);
  shown.at(-1).onSubmit('Ada');
  shown.at(-1).onSubmit('25');
  shown.at(-1).input('KeyN');
  shown.at(-1).input('KeyY');
  await flush();
  assert.deepEqual(sent, [{ op: 'offer', mapId: 9, buildingKey: 3, to: 'Ada', price: 25, keepDecor: false, keepItems: false }]);
  assert.match(said.at(-1), /offer is out/);
  shown.length = 0;
  openHomeTransfer(9, 3, host, (t) => said.push(t), (c) => c, null, (w) => shown.push(w));
  shown.at(-1).onSubmit('A');
  assert.match(said.at(-1), /not an account name/);
  assert.equal(sent.length, 1, 'a short name is asked again and not sent');
});

test('an offer already out is withdrawn by its id, and an answer goes through the realm act only when accepted', async () => {
  const shown = [];
  const sent = [];
  const said = [];
  const host = {
    onlineHomes: { transfer: async (b) => { sent.push(b); return { ok: true, data: {} }; } },
    realmAct: async ({ call }) => call({ id: 'r', lease: 'L', seq: 4 }),
  };
  const show = (w) => shown.push(w);
  openHomeTransfer(9, 3, host, (t) => said.push(t), (c) => c, 'abc', show);
  shown.at(-1).input('KeyW');
  await flush();
  assert.deepEqual(sent[0], { op: 'cancel', id: 'abc', mapId: 9, buildingKey: 3 });
  // the buyer's purse: the price is held through the realm act (walletReserve), and a purse short of it sends nothing
  const purse = { gold: 10, pay: (n) => { purse.gold -= n; }, credit: (n) => { purse.gold += n; } };
  answerHomeTransfer(9, 3, { offer: { id: 'off', price: 10, keepDecor: true, keepItems: false } }, true, host, (t) => said.push(t), (c) => c, show, purse);
  shown.at(-1).input('KeyY');
  await flush();
  assert.equal(sent[1].op, 'accept');
  assert.equal(sent[1].realm.seq, 4);
  assert.equal(sent[1].character, undefined);
  answerHomeTransfer(9, 3, { offer: { id: 'off', price: 0, keepDecor: false, keepItems: false } }, false, host, (t) => said.push(t), (c) => c, show);
  shown.at(-1).input('KeyY');
  await flush();
  assert.deepEqual(sent[2].op, 'decline');
  assert.equal(sent[2].realm, undefined, 'a decline moves no gold');
});
