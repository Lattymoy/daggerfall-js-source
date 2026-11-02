// AUDIT-STOREFRONT III (lane B, 2026-10-30; bible/01-Overview/audits/Audit-Storefront.md): THE FINDS AS THE PAGE ASKS
// THEM (systems/pass/passClient.js). B4: an answer counted on another UTC day says nothing of today's. B5: a find is its
// own account's, never paid to one signed in meanwhile. B6: a find the service has not answered survives the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bindPass, passState, askPassFind, _resetPassClientForTests, PASS_FINDS_STORE, PASS_FIND_KEEP_MS } from '../../../src/systems/pass/passClient.js';
import { passSeasonById, PASS_DAY_AURUM } from '../../../src/net/battlePassLaw.js';
import { utcDay } from '../../../src/net/marksLaw.js';

const S1 = passSeasonById('s1');
const DAY2 = S1.fromMs + 3 * 86_400_000;   // a midnight inside the season
const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
const card = (today) => ({ ok: true, data: { season: 's1', open: true, stage: 0, tracks: { free: true, premium: false }, bought: [], today, dayMax: PASS_DAY_AURUM, challenges: [] } });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, m }; };

test('AUDIT-STOREFRONT III B4: a find asked again past midnight, its answer yesterday\'s capped day - today is not told full, nor shown as yesterday\'s; the card is read again (mutants: the answer\'s day unread; the card not read again)', async () => {
  _resetPassClientForTests();
  const now = DAY2 + 10_000;
  let reads = 0;
  const events = [];
  const yesterday = utcDay(Math.floor((DAY2 - 10_000) / 1000));
  bindPass({
    online: () => true, nowMs: () => now, onEvent: (e) => events.push(e), storage: null,
    api: { me: () => 'acct-1', guest: () => false, mine: async () => { reads++; return card(0); }, find: async () => ({ ok: true, data: { gained: 0, found: 0, today: PASS_DAY_AURUM, day: yesterday, capped: true, done: [], season: 's1', repeat: true } }) },
  });
  await settle();
  const before = reads;
  await askPassFind('foe');
  await settle();
  assert.deepEqual(events, [], 'no "found all you can today"');
  assert.equal(passState().today, 0, 'today as the card says it, not yesterday\'s 100');
  assert.equal(reads, before + 1, 'the card read again');
});

test('AUDIT-STOREFRONT III B5: a find held while the service could not be reached is never asked for another account signed in meanwhile (mutants: the account not kept with the find)', async () => {
  _resetPassClientForTests();
  let who = 'acct-A', reach = false;
  const asked = [];
  bindPass({
    online: () => true, nowMs: () => DAY2, storage: null, wait: async () => { who = 'acct-B'; reach = true; },
    api: { me: () => who, guest: () => false, mine: async () => card(0), find: async (source) => { asked.push([who, source]); return reach ? { ok: true, data: { gained: 20, found: 20, today: 20, day: utcDay(DAY2 / 1000), done: [], season: 's1' } } : { ok: false, error: 'offline' }; } },
  });
  await settle();
  await askPassFind('endgame');
  await settle();
  assert.deepEqual(asked, [['acct-A', 'endgame']], 'asked once as A; never as B');
});

test('AUDIT-STOREFRONT III B6: a find the service never answered is kept on the device and asked again, with its own id, when the page is next bound; an answered one is let go; a day-old one is never asked (mutants: nothing kept; kept past an answer)', async () => {
  _resetPassClientForTests();
  const store = memory();
  const rids = [];
  const offline = { me: () => 'acct-1', guest: () => false, mine: async () => card(0), find: async (_s, rid) => { rids.push(rid); return { ok: false, error: 'offline' }; } };
  let n = 0;
  bindPass({ online: () => true, nowMs: () => DAY2, storage: store, rid: () => `rid${++n}`.padEnd(16, '0'), wait: () => new Promise(() => {}), api: offline });   // the page closes mid-retry
  await settle();
  askPassFind('quest');
  await settle();
  const kept = JSON.parse(store.getItem(PASS_FINDS_STORE));
  assert.deepEqual(kept['acct-1'].map((x) => [x.rid, x.source]), [['rid1000000000000', 'quest']], 'kept on the device');
  // the page loads again: the kept find asked with its own id, and let go once answered
  _resetPassClientForTests();
  const asked = [];
  bindPass({ online: () => true, nowMs: () => DAY2 + 60_000, storage: store, api: { me: () => 'acct-1', guest: () => false, mine: async () => card(0), find: async (s, rid) => { asked.push([s, rid]); return { ok: true, data: { gained: 1, found: 1, today: 1, day: utcDay(DAY2 / 1000), done: [], season: 's1' } }; } } });
  await settle();
  assert.deepEqual(asked, [['quest', 'rid1000000000000']]);
  assert.equal(JSON.parse(store.getItem(PASS_FINDS_STORE) ?? '{}')['acct-1'], undefined, 'answered: let go');
  // a day-old kept find is never asked: the service may have forgotten its id
  store.setItem(PASS_FINDS_STORE, JSON.stringify({ 'acct-1': [{ rid: 'old0000000000000', source: 'quest', at: DAY2 - PASS_FIND_KEEP_MS - 1 }] }));
  _resetPassClientForTests();
  const late = [];
  bindPass({ online: () => true, nowMs: () => DAY2, storage: store, api: { me: () => 'acct-1', guest: () => false, mine: async () => card(0), find: async (s, rid) => { late.push(rid); return { ok: true, data: {} }; } } });
  await settle();
  assert.deepEqual(late, []);
});
