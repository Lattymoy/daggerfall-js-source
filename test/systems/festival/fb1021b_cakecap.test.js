// FIELD BUGS 2026-10-21b CAKE-CAP-SAID (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md): "Soul Cake stopped dropping".
// The service caps a UTC day's finds at FIND_CAKES_PER_DAY, and a find past them answered a miss's own `{ found: 0 }` -
// so a player who found 120 in the first hour of undead farmed on for hours against a cap nothing named, and every kill
// was still a write to the service. The answer says it now (`today`, `capped`); this page says it once a day with the
// hour more are found, asks nothing more until the day turns, and the Wyrd Sister's window counts the day's finds.
// Driven through the real kill listener (systems/playerKills.js) and the real window.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { bindFestival, festivalFindsToday, _resetFestivalClientForTests } from '../../../src/systems/festival/festivalClient.js';
import { reportPlayerKill } from '../../../src/systems/playerKills.js';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
import { FESTIVALS, FIND_CAKES_PER_DAY } from '../../../src/net/festivalLaw.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { mountWyrdWindow, WYRD_WATCH_MS } from '../../../src/ui/wyrdWindow.js';
import { withDom } from '../../invdrag.mjs';

const store = new Map();
const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const DAY_MS = 86_400_000;
/** A service door that answers as the test says, and keeps every ask (witch1_client.test.js's own shape). */
function fakeApi(answers = {}) {
  const asked = [];
  const door = (name) => async (...a) => { asked.push([name, ...a]); const r = answers[name]; return typeof r === 'function' ? r(...a) : r ?? { ok: false, error: 'offline' }; };
  return { asked, api: { ...Object.fromEntries(['mine', 'find', 'buy', 'town', 'set', 'fill', 'takeIn', 'take'].map((n) => [n, door(n)])), me: () => 'acct-alice' } };
}
let entity, said;
const bind = (api) => bindFestival({ online: () => true, entity: () => entity, say: (l) => said.push(l), selfId: () => 'me', saved: () => {}, api });
/** A zombie my blow felled - an undead find (festivalFoes.js), through the kill listener every pool tells. */
const kill = async () => { reportPlayerKill({ mobileType: MOBILE_TYPES.Zombie }); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); };
const finds = (asked) => asked.filter(([n]) => n === 'find').length;
const fullLines = () => said.filter((l) => /a day allows/.test(l));

beforeEach(() => {
  globalThis.localStorage = mem;
  store.clear();
  store.set(SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: 'acct-alice', name: 'Alice', kind: 'linked' }));
  mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].fromMs + 3600_000 });
  _resetFestivalClientForTests();
  entity = { isPlayer: true, items: [] };
  said = [];
});
afterEach(() => { mock.timers.reset(); _resetFestivalClientForTests(); delete globalThis.localStorage; });

test('CAKE-CAP-SAID: the find that ends the day is said, then the day\'s end once - with the hour more are found - and nothing more is asked', async () => {
  let cakes = FIND_CAKES_PER_DAY - 1;
  const { api, asked } = fakeApi({ mine: { ok: true, data: { cakes, today: FIND_CAKES_PER_DAY - 1 } },
    find: () => (cakes < FIND_CAKES_PER_DAY ? { ok: true, data: { found: 1, cakes: ++cakes, today: FIND_CAKES_PER_DAY, capped: true } } : { ok: true, data: { found: 0, cakes, today: FIND_CAKES_PER_DAY, capped: true } }) });
  bind(api);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(festivalFindsToday().found, FIND_CAKES_PER_DAY - 1, 'the day\'s count, as the service said it');
  await kill();
  assert.equal(finds(asked), 1);
  assert.deepEqual(said.slice(0, 1), ['+1 Soul Cake']);
  assert.equal(fullLines().length, 1, 'the day\'s end said with it');
  assert.match(fullLines()[0], new RegExp(`all ${FIND_CAKES_PER_DAY} Soul Cakes a day allows\\. More can be found from \\S`));
  for (let i = 0; i < 5; i++) await kill();
  assert.equal(finds(asked), 1, 'no ask while the day\'s finds are spent - each was a write for nothing');
  assert.equal(fullLines().length, 1, 'said once a day');
  assert.equal(festivalFindsToday().full, true);
  // the next UTC day: asked again
  mock.timers.setTime(Date.now() + DAY_MS);
  assert.equal(festivalFindsToday().found, 0, 'a count said yesterday is today\'s nought');
  assert.equal(festivalFindsToday().full, false);
  await kill();
  assert.equal(finds(asked), 2, 'a new day asks again');
});

test('CAKE-CAP-SAID: the refusal once the day\'s asks are spent ends the day the same way', async () => {
  const { api, asked } = fakeApi({ mine: { ok: true, data: { cakes: 3 } }, find: { ok: false, error: 'capped', cakes: 3 } });
  bind(api);
  await kill();
  await kill();
  assert.equal(finds(asked), 1);
  assert.equal(fullLines().length, 1);
});

test('CAKE-CAP-SAID: a player who comes back after the day\'s finds is told at the first kill, and nothing is asked', async () => {
  const { api, asked } = fakeApi({ mine: { ok: true, data: { cakes: 122, today: FIND_CAKES_PER_DAY } }, find: { ok: true, data: { found: 0, cakes: 122 } } });
  bind(api);
  await new Promise((r) => setImmediate(r));
  await kill();
  assert.equal(finds(asked), 0);
  assert.equal(fullLines().length, 1);
});

test('CAKE-CAP-SAID: a service that says no day (before acct167) is asked every kill and nothing is said - as before', async () => {
  const { api, asked } = fakeApi({ mine: { ok: true, data: { cakes: 0 } }, find: { ok: true, data: { found: 0, cakes: 0 } } });
  bind(api);
  for (let i = 0; i < 3; i++) await kill();
  assert.equal(finds(asked), 3);
  assert.equal(fullLines().length, 0);
  assert.equal(festivalFindsToday().found, null, 'unheard');
});

const kidsOf = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kidsOf(c, cls)]);
test('CAKE-CAP-SAID: the Wyrd Sister\'s window counts the day\'s finds, and once they are spent says when more are found', () => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date', 'setInterval'], now: FESTIVALS[0].fromMs + 3600_000 });
  withDom(() => {
    let today = { found: 87, max: FIND_CAKES_PER_DAY, full: false, resetMs: 0 };
    const host = document.createElement('div');
    const view = mountWyrdWindow(host, {
      state: () => ({ cakes: 10, wares: [], given: 0, taken: 0 }), worn: () => null, shut: () => null, today: () => today,
      lastDay: () => '7 November', night: () => false, itemOf: () => null, nameOf: (it) => it?.name ?? '?',
      buy: async () => ({ ok: true, text: '' }), wear: async () => ({ ok: true, text: '' }),
    });
    try {
      const line = () => kidsOf(host, 'wyrd-today')[0];
      assert.equal(line().textContent, `Found today: 87 of ${FIND_CAKES_PER_DAY} Soul Cakes.`);
      assert.equal(line().getAttribute('hidden'), null);
      today = { found: FIND_CAKES_PER_DAY, max: FIND_CAKES_PER_DAY, full: true, resetMs: Date.UTC(2026, 9, 21) };
      view.repaint();
      assert.match(line().textContent, new RegExp(`^Found today: all ${FIND_CAKES_PER_DAY} Soul Cakes\\. More from \\S`));
      // the UTC day turns with the window open: no answer says so, the window's own watch does
      today = { found: 0, max: FIND_CAKES_PER_DAY, full: false, resetMs: Date.UTC(2026, 9, 22) };
      mock.timers.tick(WYRD_WATCH_MS);
      assert.equal(line().textContent, `Found today: 0 of ${FIND_CAKES_PER_DAY} Soul Cakes.`, 'repainted as the day turned');
      today = { found: null, max: FIND_CAKES_PER_DAY, full: false, resetMs: 0 };
      view.repaint();
      assert.notEqual(line().getAttribute('hidden'), null, 'nothing heard, nothing said');
    } finally { view.unmount(); }
  });
});
