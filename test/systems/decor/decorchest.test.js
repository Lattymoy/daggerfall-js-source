// A shared chest opens on the peeked rows, then the service's list replaces them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindDecorHouse, noteDecorBin, openSharedChest } from '../../../src/systems/decor/decorGrants.js';
import { applyTransfer } from '../../../src/systems/item/itemTransfer.js';
import { realmGoldAct } from '../../../src/systems/realmSaves.js';

test('DECOR-ACCESS the first take uses the row the window drew', async () => {
  const shown = { uid: 'aaaaaaaaaaaaaaaa', stackCount: 2, templateIndex: 12 };
  const fresh = { uid: shown.uid, stackCount: 5, templateIndex: 12 };
  const potion = { stackCount: 3, templateIndex: 41 };
  const potionFresh = { stackCount: 3, templateIndex: 41 };
  let release;
  const listed = new Promise((r) => { release = r; });
  let opened = null;
  bindDecorHouse({
    use: (body) => (body.op === 'list' ? listed : Promise.resolve({ ok: true })),
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => [], take() {}, give() {}, say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
  });
  noteDecorBin('chest-first', [shown, potion]);
  assert.equal(await openSharedChest('chest-first'), true);
  const go = (item) => {
    const from = opened.loot.items();
    if (!from.includes(item)) return null;
    from.splice(from.indexOf(item), 1);
    return item;
  };
  const take = opened.loot.commit('take', shown, 1, () => go(shown));
  const takePotion = opened.loot.commit('take', potion, 1, () => go(potion));
  release({ ok: true, data: { items: [fresh, potionFresh] } });
  assert.equal(await take, true);
  assert.equal(shown.stackCount, 5, 'the row keeps its place and takes the service\'s count');
  assert.equal(await takePotion, true);
  assert.deepEqual(opened.loot.items(), []);
});

test('DECOR-ACCESS gold in a chest is written with the other goods and taken back as purse', async () => {
  const pack = [];
  const given = [];
  const lying = { uid: 'dddddddddddddddd', group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 };
  const sent = [];
  let opened = null;
  bindDecorHouse({
    use: (req) => { if (req.op === 'settle') sent.push(req); return req.op === 'list' ? Promise.resolve({ ok: true, data: { items: req.id === 'chest-lying' ? [lying] : [] } }) : Promise.resolve({ ok: true }); },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => pack,
    take(uid) { const i = pack.findIndex((it) => it?.uid === uid); if (i >= 0) pack.splice(i, 1); },
    give(it) { given.push(it); },
    say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => { call({ id: 'r', seq: 2 }); apply(); return { ok: true }; },
  });
  noteDecorBin('chest-gold', []);
  assert.equal(await openSharedChest('chest-gold'), true);
  const dropped = opened;
  const pile = { group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 };
  const goods = dropped.loot.items();
  assert.equal(await dropped.loot.commit('put', pile, 4, () => { goods.push(pile); return pile; }), true);
  assert.equal(pack.includes(pile), true, 'the save carries the pile until the chest keeps it');
  assert.equal(await dropped.loot.commit('take', pile, 4, () => { goods.splice(goods.indexOf(pile), 1); return null; }), true);
  assert.equal(pack.includes(pile), false, 'taking the same pile back leaves the pack');
  dropped.loot.closed();
  noteDecorBin('chest-lying', [lying]);
  assert.equal(await openSharedChest('chest-lying'), true);
  const from = opened.loot.items();
  assert.equal(await opened.loot.commit('take', from[0], 4, () => { from.splice(0, 1); return null; }), true);
  opened.loot.closed();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].take, [lying.uid]);
  assert.equal(given.length, 0, 'the purse already has the coins');
});

test('DECOR-ACCESS a take still waiting for the list is settled when the chest closes', async () => {
  const gold = { uid: 'ffffffffffffffff', group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 };
  let release;
  const listed = new Promise((r) => { release = r; });
  const sent = [];
  let opened = null;
  let purse = 0;
  bindDecorHouse({
    use: (req) => {
      if (req.op === 'settle') sent.push(req);
      return req.op === 'list' ? listed : Promise.resolve({ ok: true });
    },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => [], take() {}, give() {}, say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => { call({ id: 'r', seq: 2 }); apply(); return { ok: true }; },
  });
  noteDecorBin('chest-race', [gold]);
  assert.equal(await openSharedChest('chest-race'), true);
  const from = opened.loot.items();
  const take = opened.loot.commit('take', from[0], 4, () => { purse += from[0].stackCount; from.splice(0, 1); return null; });
  opened.loot.closed();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.length, 0, 'the close waits while the take is still reading the chest');
  assert.equal(purse, 0);
  release({ ok: true, data: { items: [{ uid: gold.uid, group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 }] } });
  assert.equal(await take, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(purse, 4);
  assert.deepEqual(sent.map((s) => s.take), [[gold.uid]]);
});

test('DECOR-ACCESS two portions of one stack settle as its last remainder', async () => {
  const pile = { uid: 'eeeeeeeeeeeeeeee', group: 'Gems', templateIndex: 0, stackCount: 10 };
  const sent = [];
  const given = [];
  let opened = null;
  bindDecorHouse({
    use: (req) => {
      if (req.op === 'settle') sent.push(req);
      return req.op === 'list' ? Promise.resolve({ ok: true, data: { items: [pile] } }) : Promise.resolve({ ok: true });
    },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => [], take() {}, give(it) { given.push(it); }, say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => { call({ id: 'r', seq: 2 }); apply(); return { ok: true }; },
  });
  noteDecorBin('chest-cut', [pile]);
  assert.equal(await openSharedChest('chest-cut'), true);
  const row = opened.loot.items()[0];
  const portion = (n) => { row.stackCount -= n; return { group: 'Gems', templateIndex: 0, stackCount: n }; };
  assert.equal(await opened.loot.commit('take', row, 4, () => portion(4)), true);
  assert.equal(await opened.loot.commit('take', row, 2, () => portion(2)), true);
  opened.loot.closed();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(sent[0].cut, [{ uid: pile.uid, leave: 4 }]);
  assert.deepEqual(sent[0].take, []);
  assert.equal(given.length, 1);
  assert.equal(given[0].stackCount, 6);
});

test('DECOR-ACCESS the rest of a cut stack leaves as one take', async () => {
  const pile = { uid: '1111111111111111', group: 'Gems', templateIndex: 0, stackCount: 10 };
  const sent = [];
  const given = [];
  let opened = null;
  bindDecorHouse({
    use: (req) => {
      if (req.op === 'settle') sent.push(req);
      return req.op === 'list' ? Promise.resolve({ ok: true, data: { items: [pile] } }) : Promise.resolve({ ok: true });
    },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => [], take() {}, give(it) { given.push(it); }, say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => { call({ id: 'r', seq: 2 }); apply(); return { ok: true }; },
  });
  noteDecorBin('chest-rest', [pile]);
  assert.equal(await openSharedChest('chest-rest'), true);
  const from = opened.loot.items();
  const row = from[0];
  assert.equal(await opened.loot.commit('take', row, 4, () => { row.stackCount -= 4; return { group: 'Gems', templateIndex: 0, stackCount: 4 }; }), true);
  assert.equal(await opened.loot.commit('take', row, 6, () => { from.splice(from.indexOf(row), 1); return row; }), true);
  opened.loot.closed();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(sent[0].take, [pile.uid]);
  assert.equal(sent[0].cut, undefined);
  assert.equal(given.length, 1);
  assert.equal(given[0].stackCount, 10);
});

test('DECOR-ACCESS a stack put away comes back once, and the next chest waits for that save', async () => {
  const uid = 'cccccccccccccccc';
  const pile = { uid, group: 'Gems', templateIndex: 0, stackCount: 300 };
  const pack = [pile];
  let opened = null;
  let release = null;
  const gate = new Promise((r) => { release = r; });
  let listed = [];
  bindDecorHouse({
    use: (req) => {
      if (req.op === 'list') listed.push(req.id);
      return Promise.resolve({ ok: true, data: req.op === 'list' && req.id === 'chest-b' ? { items: [{ uid: 'dddddddddddddddd', group: 'Gems', templateIndex: 1, stackCount: 1 }] } : { items: [] } });
    },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => pack,
    take(id) { const i = pack.findIndex((it) => it?.uid === id); if (i >= 0) pack.splice(i, 1); },
    give(it) { if (!pack.some((x) => x?.uid === it?.uid)) pack.push(it); },
    say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => { call({ id: 'r', seq: 2 }); await gate; apply(); return { ok: true }; },
  });
  assert.equal(await openSharedChest('chest-a'), true);
  const goods = opened.loot.items();
  assert.equal(await opened.loot.commit('put', pile, 300, () => { goods.push(pile); return pile; }), true);
  assert.equal(pack.length, 1);
  assert.equal(pack[0].stackCount, 300);
  const saving = opened.loot.finish();
  assert.equal(opened.loot.busy, 'Saving the chest...');
  let openedNext = false;
  const next = openSharedChest('chest-b').then((ok) => { openedNext = ok; });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(openedNext, false, 'the second chest does not open while the first is still saving');
  assert.deepEqual(listed, ['chest-a']);
  release();
  await saving;
  assert.equal(pack.length, 0, 'the save takes the parked stack out of the pack');
  await next;
  assert.equal(openedNext, true);
  assert.deepEqual(listed, ['chest-a', 'chest-b']);
  const gear = opened.loot.items()[0];
  const draft = opened.items();
  assert.equal(draft.unstacked, true);
  applyTransfer(gear, { amount: 1 }, opened.loot.items(), draft);
  assert.equal(pack.reduce((n, it) => n + (it.stackCount ?? 1), 0), 0, 'the window does not add the next chest onto the pack');
});

test('DECOR-ACCESS a shared chest keeps each stack whole until the settle joins them', () => {
  const chest = Object.assign([{ uid: 'aaaaaaaaaaaaaaaa', group: 'Gems', templateIndex: 0, stackCount: 98 }], { unstacked: true });
  const pile = { uid: 'bbbbbbbbbbbbbbbb', group: 'Gems', templateIndex: 0, stackCount: 54 };
  applyTransfer(pile, { amount: 54 }, [pile], chest);
  assert.equal(chest.length, 2);
  assert.equal(chest[0].stackCount, 98);
  assert.equal(chest[1].stackCount, 54);
});

test('DECOR-ACCESS a settle that landed unheard still moves the pack once', async () => {
  const uid = 'aaaaaaaaaaaaaaaa';
  const pile = { uid, group: 'Gems', templateIndex: 0, stackCount: 1 };
  const pack = [pile];
  const takes = [];
  const sent = [];
  let opened = null;
  bindDecorHouse({
    use: (req) => {
      if (req.op === 'settle') {
        sent.push(req.realm.seq);
        return Promise.resolve(sent.length === 1 ? { ok: false, error: 'offline' } : { ok: false, error: 'seq', seq: req.realm.seq + 1 });
      }
      return Promise.resolve({ ok: true, data: { items: sent.length ? [pile] : [] } });
    },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => pack,
    take(id) { takes.push(id); const i = pack.findIndex((it) => it?.uid === id); if (i >= 0) pack.splice(i, 1); },
    give(it) { if (!pack.some((x) => x?.uid === it?.uid)) pack.push(it); },
    say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => (asked) => realmGoldAct({
      session: { transact: (fn) => fn({ id: 'r', lease: 'L', seq: 7 }) },
      checkpoint() {},
      wait: () => Promise.resolve(),
      ...asked,
    }),
  });
  noteDecorBin('chest-lost', []);
  assert.equal(await openSharedChest('chest-lost'), true);
  const goods = opened.loot.items();
  assert.equal(await opened.loot.commit('put', pile, 1, () => { goods.push(pile); return pile; }), true);
  await opened.loot.closed();
  assert.deepEqual(sent, [7, 7]);
  assert.deepEqual(takes, [uid]);
  assert.equal(pack.length, 0);
  assert.equal(await openSharedChest('chest-lost'), true);
  assert.deepEqual(opened.loot.items().map((it) => it.uid), [uid]);
});

test('DECOR-ACCESS a refused settle reads the chest again', async () => {
  const pile = { uid: 'bbbbbbbbbbbbbbbb', group: 'Gems', templateIndex: 0, stackCount: 1 };
  const pack = [pile];
  let release = null;
  let lists = 0;
  let opened = null;
  bindDecorHouse({
    use: (req) => {
      if (req.op === 'settle') return Promise.resolve({ ok: false, error: 'no-item' });
      lists += 1;
      if (lists === 1) return Promise.resolve({ ok: true, data: { items: [] } });
      return new Promise((done) => { release = () => done({ ok: true, data: { items: [pile] } }); });
    },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => pack,
    take() {}, give() {}, say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => {
      const answered = await call({ id: 'r', lease: 'L', seq: 3 });
      if (answered?.ok) apply?.();
      return answered;
    },
  });
  noteDecorBin('chest-refused', []);
  assert.equal(await openSharedChest('chest-refused'), true);
  const goods = opened.loot.items();
  assert.equal(await opened.loot.commit('put', pile, 1, () => { goods.push(pile); return pile; }), true);
  await opened.loot.closed();
  assert.equal(pack.includes(pile), true, 'a refusal leaves the good in the pack');
  let openedAgain = false;
  const again = openSharedChest('chest-refused').then((ok) => { openedAgain = ok; });
  await new Promise((done) => { setTimeout(done, 0); });
  assert.equal(openedAgain, false, 'the refused chest is read again');
  release();
  await again;
  assert.equal(openedAgain, true);
  assert.equal(opened.loot.items()[0].uid, pile.uid);
});
