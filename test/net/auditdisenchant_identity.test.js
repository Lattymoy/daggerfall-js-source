import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(process.env.DFO_REPO ?? new URL('../../', import.meta.url).pathname);
const { createProfBook } = await import(pathToFileURL(resolve(root, 'src/net/profBook.js')));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture({ answer, sleep = async () => {} } = {}) {
  let character = 'character-A', account = 'account-A';
  let calls = 0;
  const book = createProfBook({ character: () => character, now: () => 100000, rid: () => 'audit-disenchant-request', sleep,
    door: { account: () => account,
      state: async c => ({ ok: true, data: { character: c, day: 0, tracks: [{ profession: 'enchanting', rank: 0, xp: 0 }], stores: [{ material: 'essence:arcane', own: 1, bought: 0 }] } }),
      disenchant: async (...args) => { calls++; return answer(...args); } } });
  return { book, setCharacter: c => character = c, setAccount: a => account = a, calls: () => calls };
}
const success = () => ({ ok: true, data: { store: { material: 'essence:arcane', own: 99, bought: 0 }, track: { profession: 'enchanting', rank: 80, xp: 123456 } } });
for (const kind of ['character', 'account']) {
  test(`late disenchant success cannot alter the next ${kind}'s state and is marked elsewhere`, async () => {
    const d = deferred(); const f = fixture({ answer: () => d.promise }); await f.book.refresh();
    const pending = f.book.disenchant('aaaaaaaaaaaaaaaa');
    if (kind === 'character') f.setCharacter('character-B'); else f.setAccount('account-B');
    await f.book.refresh({ force: true }); d.resolve(success()); const result = await pending;
    assert.equal(f.book.held('essence:arcane'), 1);
    assert.equal(f.book.track('enchanting').rank, 0);
    assert.equal(result.ok, true, 'retain the remote success for realm transaction settlement'); assert.equal(result.elsewhere, true);
  });
}
test('late disenchant refusal cannot close the next character professions page', async () => {
  const d=deferred(); const f=fixture({answer:()=>d.promise}); await f.book.refresh();
  const pending=f.book.disenchant('aaaaaaaaaaaaaaaa'); f.setCharacter('character-B'); await f.book.refresh({force:true});
  d.resolve({ok:false,error:'prof-closed'}); await pending; assert.equal(f.book.state.open,true);
});
test('disenchant retry stops before asking under a different account', async () => {
  const pause=deferred(); const f=fixture({answer:async()=>({ok:false,error:'offline'}),sleep:()=>pause.promise});
  await f.book.refresh(); const pending=f.book.disenchant('aaaaaaaaaaaaaaaa');
  await new Promise(r=>setImmediate(r)); f.setAccount('account-B'); pause.resolve();
  const r=await pending; assert.equal(f.calls(),1); assert.equal(r.elsewhere,true);
});
test('same identity success still updates Essence and Enchanting once for duplicate concurrent presses', async () => {
  const d=deferred();const f=fixture({answer:()=>d.promise});await f.book.refresh();
  const a=f.book.disenchant('aaaaaaaaaaaaaaaa'),b=f.book.disenchant('aaaaaaaaaaaaaaaa');d.resolve(success());
  const results=await Promise.all([a,b]);assert.equal(f.calls(),1);assert.ok(results.every(r=>r.ok));
  assert.equal(f.book.held('essence:arcane'),99);assert.equal(f.book.track('enchanting').rank,80);
});
test('realm disenchant response is also scoped to its initiating identity', async () => {
  const d=deferred();const f=fixture({answer:()=>d.promise});await f.book.refresh();
  const pending=f.book.disenchant('aaaaaaaaaaaaaaaa',{id:'realm-record',seq:1});
  await new Promise(r=>setImmediate(r));f.setCharacter('character-B');await f.book.refresh({force:true});
  d.resolve(success());const r=await pending;assert.equal(f.book.held('essence:arcane'),1);assert.equal(r.ok,true);assert.equal(r.elsewhere,true);
});
