// AUDIT 29 (2026-09-28, Mac: "Lets audit everything so far before we continue") - THE PROFESSIONS' CLIENT, AS THE
// AUDIT FOUND IT: the book's state read once at a time and never in a loop; stale for another account, and a shut
// switch asked again slowly; a kept withdrawal minted by the tab that let it go, never by two; a smelt's kept id
// forgotten after the service's ten minutes; a paid change asked as the client saw the track. Each pin failed on the
// code before its fix. bible/06-Systems/Online-Arc.md AUDIT 29.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createProfBook, PROF_REFRESH_BACKOFF_MS, PROF_CLOSED_RECHECK_MS } from '../src/net/profBook.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { HARVEST_LATE_S } from '../src/net/professionLaw.js';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DAY_MS = 86_400_000;
const T = 20500 * DAY_MS + 12 * 3600_000;
const okState = (day = 20500, extra = {}) => ({ ok: true, data: { day, character: 'c1', tracks: [], today: {}, taken: [], stores: [], caps: { stores: 5000 }, ...extra } });

test('AUDIT 29 C1: the state is read one at a time - presses while a read is on the wire share it; a failed read is not asked again for its backoff', async () => {
  let asked = 0, t = T;
  let answer = { ok: false, error: 'offline' };
  const door = { account: () => 'acct-1', state: async () => { asked++; await noWait(); return answer; } };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => t, sleep: noWait });
  await Promise.all([book.refresh(), book.refresh(), book.refresh()]);
  assert.equal(asked, 3, 'one read, its own three tries (PROF_TRIES)');
  await book.refresh();
  assert.equal(asked, 3, 'inside the backoff: the last answer, no ask');
  t += PROF_REFRESH_BACKOFF_MS;
  answer = okState();
  assert.equal((await book.refresh()).ok, true);
  assert.equal(asked, 4);
  assert.equal(book.stale(), false);
});

test('AUDIT 29 C1: a read the service answers for another UTC day (the clocks either side of midnight) is not stale again for the backoff - the pages never loop', async () => {
  let asked = 0, t = 20501 * DAY_MS + 20_000;
  const door = { account: () => 'acct-1', state: async () => { asked++; return okState(20500); } };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => t, sleep: noWait });
  await book.refresh();
  assert.equal(book.stale(), false, 'just read: not stale, whatever day the service said');
  t += PROF_REFRESH_BACKOFF_MS + 1;
  assert.equal(book.stale(), true, 'the backoff past: read again');
  assert.equal(asked, 1);
});

test('AUDIT 29 C8: the state is another account\'s once the account changes; a shut switch is asked again, slowly', async () => {
  let acct = 'acct-1', t = T, answer = okState();
  const door = { account: () => acct, state: async () => answer };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => t, sleep: noWait });
  await book.refresh();
  assert.equal(book.stale(), false);
  acct = 'acct-2';
  assert.equal(book.stale(), true, 'another account signed in');
  answer = { ok: false, error: 'prof-closed' };
  await book.refresh({ force: true });
  assert.equal(book.state.open, false);
  assert.equal(book.stale(), false, 'a shut switch is not asked every frame');
  t += PROF_CLOSED_RECHECK_MS;
  assert.equal(book.stale(), true, 'but it is asked again');
});

test('AUDIT 29 C5: two tabs settling one kept withdrawal mint it once - the tab that finds the row still kept mints it', async () => {
  const storage = memStorage();
  let made = 0;
  const door = {
    account: () => 'acct-1', state: async () => okState(),
    withdraw: async (c, m, q, rid) => { await noWait(); made++; return { ok: true, data: { material: m, qty: q, repeat: made > 1, store: { material: m, own: 0, bought: 0 } } }; },
  };
  storage.setItem('prof1.kept', JSON.stringify({ 'acct-1|c1': { harvests: [], withdrawals: [{ rid: 'pwwwwwwwwwwwwwwww', material: 'metal:iron', qty: 5, character: 'c1' }] } }));
  const minted = [];
  const a = createProfBook({ door, storage, character: () => 'c1', now: () => T, sleep: noWait });
  const b = createProfBook({ door, storage, character: () => 'c1', now: () => T, sleep: noWait });
  await Promise.all([a.settle((k, n) => minted.push(['A', k, n])), b.settle((k, n) => minted.push(['B', k, n]))]);
  assert.equal(minted.length, 1, JSON.stringify(minted));
  assert.equal(a.pendingWithdrawals + b.pendingWithdrawals, 0);
});

test('AUDIT 29 C6: a smelt\'s kept id is forgotten after the service\'s ten minutes - a later smelt of the same count is a new smelt, never an old one\'s repeat', async () => {
  let t = T;
  const ids = [];
  let fail = true;
  const door = { account: () => 'acct-1', state: async () => okState(), smelt: async (c, r, n, rid) => { ids.push(rid); return fail ? { ok: false, error: 'offline' } : { ok: true, data: { recipe: r, count: n, xp: 10, stores: [] } }; } };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => t, sleep: noWait });
  await book.smelt('ingot:iron', 10);
  await book.smelt('ingot:iron', 10);
  assert.equal(new Set(ids).size, 1, 'a press after a lost answer is the same smelt');
  t += HARVEST_LATE_S * 1000 + 1;
  fail = false;
  await book.smelt('ingot:iron', 10);
  assert.equal(new Set(ids).size, 2, 'past the ten minutes: a smelt of its own');
});

test('AUDIT 29 A15: a specialisation is asked with the choice the client saw standing; a stale one reads the track again', async () => {
  const asked = [];
  let reads = 0;
  const door = {
    account: () => 'acct-1',
    state: async () => { reads++; return okState(20500, { tracks: [{ profession: 'herbalism', xp: 25000, rank: 50, specs: { 50: 'gardener', 100: null }, respec: null }] }); },
    spec: async (c, p, r, s, from, rid) => { asked.push({ p, r, s, from, rid }); return { ok: false, error: 'prof-spec-stale' }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => T, sleep: noWait });
  await book.refresh();
  const r = await book.choose('herbalism', 50, 'botanist');
  assert.equal(asked[0].from, 'gardener');
  assert.equal(r.error, 'prof-spec-stale');
  assert.equal(reads, 2, 'the track read again');
  for (const e of ['prof-spec-stale', 'prof-spec-taken', 'prof-account-cap', 'prof-deep-cap']) assert.doesNotMatch(accountRefusalText(e), /problem|could not be read/, e);
});

test('AUDIT 29 C1: a page drawn over a stale state it cannot read draws again only when a NEW read answers - never on the backoff\'s last answer (the loop that starved the tab)', async () => {
  const { setProfessionsPages, drawStoresPage, drawProfessionsPage } = await import('../src/ui/profPages.js');
  let asked = 0, t = T;
  const door = { account: () => 'acct-1', state: async () => { asked++; return { ok: false, error: 'no-session' }; } };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => t, sleep: noWait });
  book.state.open = true;   // the pages up, the session gone since
  setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }) });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let draws = 0;
  const draw = () => { draws++; if (draws > 50) return; const d = el('div'); drawStoresPage(d, draw, kit); drawProfessionsPage(d, draw, kit); };
  draw();
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  assert.ok(draws <= 3, `drew ${draws} times`);
  assert.ok(asked <= 3, `asked ${asked} times (one read, its three tries)`);
  setProfessionsPages(null);
});

test('AUDIT 29 B2: a home\'s Forge station is offered, and sold, only where a Forge works - the pages shown (online, the trades open); CLASSIC-PAGES: on either skin', async () => {
  const { setProfessionsPages, forgeOffered, FORGE_COLD_LINE } = await import('../src/ui/profPages.js');
  const { stationsOffered } = await import('../src/ui/decorPanel.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setProfessionsPages(null);
  assert.equal(forgeOffered(), false);
  assert.deepEqual(stationsOffered(), ['alchemy', 'spells', 'enchant'], 'offline, or the switch shut: no Forge in the cycle');
  const book = { state: { open: true } };
  setProfessionsPages({ book });
  setPref('skin', 'classic');
  assert.equal(forgeOffered(), true, 'CLASSIC-PAGES: the Stores page opens on the classic skin too (ui/pauseDoor.js)');
  setPref('skin', 'enhanced');
  assert.equal(forgeOffered(), true);
  // PIN MOVED (PROF11): the mason's bench is a seventh home station, offered by the same gate
  assert.deepEqual(stationsOffered(), ['alchemy', 'spells', 'enchant', 'forge', 'workbench', 'loom', 'mason', 'jeweller', 'vendor'], 'PROF4: the workbench by the same gate; PROF7: the loom; PROF11: the mason\'s bench; PIN MOVED (PROF10): the jeweller\'s bench; PIN MOVED (HOME-VENDOR): the hired trader, where the market trades');
  assert.match(FORGE_COLD_LINE, /Stores page/);
  setProfessionsPages(null);
  const src = (await import('node:fs')).readFileSync(new URL('../src/scenes/decorTool.js', import.meta.url), 'utf8');
  assert.match(src, /if \(PROF_STATIONS\.includes\(want\) && !forgeOffered\(\)\) \{ deps\.say\?\.\(stationColdLine\(want\)\); return false; \}/, 'the tool sells none where the panel offers none (PROF4: a workbench neither)');
  assert.match(src, /if \(want === VENDOR_STATION && \(r\?\.kind !== 'home' \|\| !forgeOffered\(\)\)\) \{ deps\.say\?\.\(VENDOR_COLD_LINE\); return false; \}/, 'HOME-VENDOR: nor a trader - WAGONS2 (FINAL AUDIT): and in a home alone');
});
