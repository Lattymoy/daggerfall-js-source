// YC4 (bible/11-Multiplayer/Yard-Cells.md section 14.5) - THE CLIENT READS A TOWN'S HOMES BY CELL AND ITS OWN PART.
// Over the real registry (systems/online/onlineHomes.js) and its reads (systems/online/homeCellSync.js), with a fake
// account door: the own row stands over the shared one, Open Gates opens a shared home's door but never a hall's, a deed
// the own part hides is no home; the cells are asked with the versions held and the own part on its own clock; a hub word
// asks a held town's cell at once, its own part only where it holds a row there; a home let go stays gone over a cell
// answered from before; a service from before acct219 is read by `/v1/homes/town` as before. The push's carrier and the
// account door's part are at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createOnlineHomes, HOME_TOWN_TTL_MS } from '../../../src/systems/online/onlineHomes.js';
import { HOME_TOWN_CELLS, HOME_OWN_TTL_MS, HOME_GONE_HOLD_MS, HOME_CELLS_ROUNDS_MAX } from '../../../src/systems/online/homeCellSync.js';
import {
  homeCellLinkWelcomed, homeCellLinkClosed, homeCellLinkHears, carryHomeCellOrders, hearHomeCellFrame, onHomeCellWords, _resetHomeCellPush,
  HOME_CELL_SEND_MS, HOME_CELL_ORDER_KEEP_MS,
} from '../../../src/net/homeCellPush.js';
import { HOME_CELL_WELCOME_FIELD, HOME_CELL_WORDS_MAX } from '../../../src/net/homeCellWordLaw.js';
import { accountHomes, SESSION_KEY } from '../../../src/net/accountClient.js';
import { yardCellOf, YARD_CELLS_ASK_MAX } from '../../../src/net/yardCellLaw.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';

const TOWN = 7;
const OTHER_TOWN = 8;
const ME = 'r0123456789abcdef0123';
const A = makeBuildingKey(1, 1, 1);
const B = makeBuildingKey(1, 1, 2);
const C = makeBuildingKey(2, 3, 4);
const D = makeBuildingKey(2, 3, 5);
const CELL_AB = yardCellOf(A);
const CELL_CD = yardCellOf(C);
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

/** A fake account door over a town's cells and the caller's own part, recording every request. */
function door() {
  const state = {
    /** @type {Map<number, { ver: number, homes: any[] }>} */
    cells: new Map([
      [CELL_AB, { ver: 3, homes: [
        { buildingKey: A, owner: 'Olga', entry: 'private' },
        { buildingKey: B, owner: 'The Silver Hand', entry: 'guild', hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null } },
      ] }],
      [CELL_CD, { ver: 2, homes: [
        { buildingKey: C, owner: 'Arde', entry: 'private', deed: true },
        { buildingKey: D, owner: 'Mira', entry: 'private' },
      ] }],
    ]),
    own: { openGates: true, homes: [{ buildingKey: D, owner: 'Mira', entry: 'private', mine: true, character: ME, refund: 900 }], hidden: [C] },
    /** @type {Array<Array<[number, number]>>} */
    cellAsks: [],
    /** @type {Array<string | null>} */
    ownAsks: [],
    townAsks: 0,
    /** @type {any} */
    cellsReply: null,
    /** @type {any} */
    ownReply: null,
  };
  const api = {
    town: async () => {
      state.townAsks++;
      return { ok: true, data: { homes: [{ buildingKey: A, owner: 'Olga', entry: 'party' }] } };
    },
    cells: async (/** @type {number} */ mapId, /** @type {Array<[number, number]>} */ asked) => {
      state.cellAsks.push(asked.map(([cell, ver]) => [cell, ver]));
      if (state.cellsReply) return state.cellsReply(asked);
      const moved = asked.filter(([cell, have]) => (state.cells.get(cell)?.ver ?? 0) > have);
      return { ok: true, data: { mapId, cells: moved.map(([cell]) => ({ cell, ...state.cells.get(cell) })), more: [] } };
    },
    own: async (/** @type {number} */ mapId, /** @type {string | null} */ character) => {
      state.ownAsks.push(character);
      if (state.ownReply) return state.ownReply;
      return { ok: true, data: { mapId, ...state.own } };
    },
    release: async () => ({ ok: true, data: {} }),
  };
  return { state, api };
}

/** The registry over `api` at a clock the test moves, and the ear it hands the hub's words to. */
function registry(api, { character = ME } = {}) {
  const clock = { now: 1_000_000, character };
  /** @type {((words: number[][]) => void) | null} */
  let ear = null;
  const homes = createOnlineHomes({ api, character: () => clock.character, now: () => clock.now, homeCellWords: (listener) => { ear = listener; } });
  return { homes, clock, hear: (/** @type {number[][]} */ words) => ear?.(words), heard: () => ear !== null };
}

test('YC4 a town read in two parts: every cell at version 0 and the own part at once; the own row stands over the shared one; Open Gates opens a shared home but never a hall; a hidden deed is no home (mutants: own over shared, the gates on a hall, the hidden kept)', async () => {
  const { state, api } = door();
  const { homes } = registry(api);
  assert.equal(await homes.ensure(TOWN), true);
  assert.equal(HOME_TOWN_CELLS.length, YARD_CELLS_ASK_MAX, 'a whole town, in one request');
  assert.deepEqual(state.cellAsks, [HOME_TOWN_CELLS.map((cell) => [cell, 0])], 'every cell a town can hold, none held yet');
  assert.ok(HOME_TOWN_CELLS.includes(CELL_AB) && HOME_TOWN_CELLS.includes(CELL_CD) && HOME_TOWN_CELLS.includes(yardCellOf(1 << 24)));
  assert.deepEqual(state.ownAsks, [ME], 'the own part, for the character playing');
  assert.equal(state.townAsks, 0, 'never the whole town');
  assert.equal(homes.homeAt(TOWN, A)?.entry, 'public', 'Open Gates: another\'s home opens to anyone');
  assert.equal(homes.homeAt(TOWN, A)?.own, false);
  assert.equal(homes.homeAt(TOWN, B)?.entry, 'guild', 'a hall keeps its own door under Open Gates');
  assert.equal(homes.homeAt(TOWN, B)?.hall?.name, 'The Silver Hand');
  assert.equal(homes.homeAt(TOWN, C), null, 'a deed the own part hides is no online home');
  const mine = homes.homeAt(TOWN, D);
  assert.deepEqual([mine?.own, mine?.entry, mine?.refund], [true, 'private', 900], 'my own row, not the shared one opened by the gates');
});

test('YC4 the clocks: the cells each HOME_TOWN_TTL_MS with the versions held, the own part each HOME_OWN_TTL_MS or for another character; a version older than the one held never takes a cell back (mutants: versions unsent, the own part every read, the character unread, an older version believed)', async () => {
  const { state, api } = door();
  const { homes, clock } = registry(api);
  await homes.ensure(TOWN);
  clock.now += HOME_TOWN_TTL_MS;
  await homes.ensure(TOWN);
  assert.equal(state.cellAsks.length, 2);
  const held = new Map(state.cellAsks[1]);
  assert.deepEqual([held.get(CELL_AB), held.get(CELL_CD), held.get(0)], [3, 2, 0], 'the versions held, 0 for a cell that never held a home');
  assert.equal(state.ownAsks.length, 1, 'the own part waits its own clock');
  clock.now += HOME_OWN_TTL_MS;
  await homes.ensure(TOWN);
  assert.equal(state.ownAsks.length, 2, 'and is asked when it runs out');
  clock.now += HOME_TOWN_TTL_MS;
  clock.character = 'r9999999999abcdef0123';
  await homes.ensure(TOWN);
  assert.deepEqual(state.ownAsks.slice(2), ['r9999999999abcdef0123'], 'another character: its own part at once');
  // a replica behind the page answers an older version: the cell stands as held
  state.cellsReply = (asked) => ({ ok: true, data: { mapId: TOWN, cells: [{ cell: CELL_AB, ver: 1, homes: [] }], more: [] } });
  await homes.ensure(TOWN, { force: true });
  assert.equal(homes.homeAt(TOWN, A)?.owner, 'Olga', 'an older version never takes a cell back');
});

test('YC4 a hub word asks a held town\'s cell at once - its own part only where it holds a row there; a word at the version held, or for a town not held, asks nothing; one ask a town for a frame (mutants: the version rule, the own part on every word, a word per ask)', async () => {
  const { state, api } = door();
  const { homes, hear, heard } = registry(api);
  assert.equal(heard(), true, 'the registry listens for home cell words');
  await homes.ensure(TOWN);
  const asked = () => [state.cellAsks.length, state.ownAsks.length];
  hear([[TOWN, CELL_AB, 3], [OTHER_TOWN, CELL_AB, 9]]);
  await flush();
  assert.deepEqual(asked(), [1, 1], 'the version held, and a town never read: nothing asked');
  state.cells.set(CELL_AB, { ver: 4, homes: [{ buildingKey: A, owner: 'Olga', entry: 'party' }] });
  hear([[TOWN, CELL_AB, 4]]);
  await flush();
  assert.deepEqual(asked(), [2, 1], 'the cells asked at once; no own row there, no own ask');
  assert.equal(homes.homeAt(TOWN, A)?.entry, 'public', 'the new row, under the gates');
  state.cells.set(CELL_CD, { ver: 5, homes: [] });
  hear([[TOWN, CELL_AB, 6], [TOWN, CELL_CD, 5]]);
  await flush();
  assert.deepEqual(asked(), [3, 2], 'one ask for the frame, and the own part with it: my home stands in that cell');
});

test('YC4 a home I let go stays gone over a cell answered from before the sale, for HOME_GONE_HOLD_MS (mutants: the release unforgotten)', async () => {
  const { state, api } = door();
  const { homes, clock } = registry(api);
  await homes.ensure(TOWN);
  assert.equal(homes.homeAt(TOWN, D)?.own, true);
  state.own = { openGates: false, homes: [], hidden: [C] };
  const sold = await homes.release(TOWN, D);
  assert.equal(sold.ok, true);
  await flush();
  assert.ok(state.ownAsks.length >= 2, 'the own part asked after the write');
  assert.equal(homes.homeAt(TOWN, D), null, 'the cell still held from before the sale does not bring it back');
  clock.now += HOME_GONE_HOLD_MS;
  await homes.ensure(TOWN, { force: true });
  assert.equal(homes.homeAt(TOWN, D)?.owner, 'Mira', 'the hold is bounded: a cell that still names it is believed');
});

test('YC4 a full answer\'s `more` cells are asked in the same read, HOME_CELLS_ROUNDS_MAX requests at most', async () => {
  const { state, api } = door();
  state.cellsReply = (asked) => {
    const first = state.cellAsks.length === 1;
    const cells = first ? [{ cell: CELL_AB, ...state.cells.get(CELL_AB) }] : asked.map(([cell]) => ({ cell, ...state.cells.get(cell) }));
    return { ok: true, data: { mapId: TOWN, cells, more: first ? [CELL_CD] : [] } };
  };
  const { homes } = registry(api);
  await homes.ensure(TOWN);
  assert.deepEqual(state.cellAsks[1], [[CELL_CD, 0]], 'the cell left for later, asked alone');
  assert.equal(homes.homeAt(TOWN, D)?.own, true);
  state.cellsReply = () => ({ ok: true, data: { mapId: TOWN, cells: [], more: [CELL_CD] } });
  state.cellAsks.length = 0;
  await homes.ensure(TOWN, { force: true });
  assert.equal(state.cellAsks.length, HOME_CELLS_ROUNDS_MAX, 'a service that keeps saying `more` is not asked for ever');
});

test('YC4 a service from before acct219 (404, or its write routes\' refusals) is read by /v1/homes/town from then on; an overload, a ban or a freeze is a failure, not an older service; a door with no cell routes never asks them (mutants: the fallback, a 503 or a ban read as older, the write routes\' refusals unread)', async () => {
  for (const [status, error] of [[404, 'not-found'], [400, 'bad-entry'], [403, 'homes-need-account']]) {
    const { state, api } = door();
    state.cellsReply = () => ({ ok: false, error, status });
    const { homes } = registry(api);
    assert.equal(await homes.ensure(TOWN), true, `${status}: the town known all the same`);
    assert.equal(state.townAsks, 1);
    assert.equal(homes.homeAt(TOWN, A)?.entry, 'party', 'the old answer, believed as before');
    await homes.ensure(TOWN, { force: true });
    assert.deepEqual([state.cellAsks.length, state.townAsks], [1, 2], 'never the cells again');
  }
  {
    const { state, api } = door();
    state.ownReply = { ok: false, error: 'no-home', status: 400 };
    const { homes } = registry(api);
    await homes.ensure(TOWN);
    assert.equal(state.townAsks, 1, 'the own part refused as unknown: the old route too');
  }
  for (const [status, error] of [[503, 'server'], [403, 'banned']]) {
    const { state, api } = door();
    state.cellsReply = () => ({ ok: false, error, status });
    const { homes } = registry(api);
    assert.equal(await homes.ensure(TOWN), false, `${error}: the town not known`);
    assert.equal(state.townAsks, 0, 'and no fallback - the cells are asked again next time');
    state.cellsReply = () => ({ ok: true, data: {} });
    assert.equal(await homes.ensure(TOWN, { force: true }), false, 'a body not the route\'s shape is a failure');
  }
  {
    let asked = 0;
    let listened = false;
    const homes = createOnlineHomes({ api: { town: async () => { asked++; return { ok: true, data: { homes: [] } }; } }, homeCellWords: () => { listened = true; } });
    assert.equal(await homes.ensure(TOWN), true);
    assert.deepEqual([asked, listened], [1, false], 'a door without the cell routes: the town route, and no ear');
  }
});

test('YC4 the carrier: home cell orders go only down a link whose welcome said `hc`, one each HOME_CELL_SEND_MS, dropped past HOME_CELL_ORDER_KEEP_MS; a close stops them (mutants: the welcome unread, the spacing)', (t) => {
  _resetHomeCellPush();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  t.after(() => _resetHomeCellPush());
  const sent = [];
  const session = {};
  const send = (/** @type {string} */ frame) => {
    sent.push(JSON.parse(frame));
    return true;
  };
  assert.equal(carryHomeCellOrders(['o1']), 0, 'no link');
  homeCellLinkWelcomed(session, { v: 'world282' }, send);
  assert.equal(homeCellLinkHears(), false);
  assert.deepEqual(sent, [], 'an older relay: never a frame it would close the socket on');
  homeCellLinkWelcomed(session, { [HOME_CELL_WELCOME_FIELD]: 1 }, send);
  assert.deepEqual(sent, [{ t: 'hcell', order: 'o1' }], 'the held order, at the welcome');
  assert.equal(carryHomeCellOrders(['o2', 'o3', 7, '']), 0, 'inside HOME_CELL_SEND_MS: held; what is no order dropped');
  t.mock.timers.tick(HOME_CELL_SEND_MS);
  assert.equal(sent.length, 2);
  t.mock.timers.tick(HOME_CELL_SEND_MS);
  assert.deepEqual(sent.map((frame) => frame.order), ['o1', 'o2', 'o3'], 'spaced, in order');
  homeCellLinkClosed({});
  assert.equal(homeCellLinkHears(), true, 'another session\'s close is not this link\'s');
  homeCellLinkClosed(session);
  assert.equal(homeCellLinkHears(), false);
  carryHomeCellOrders(['o4']);
  t.mock.timers.tick(HOME_CELL_ORDER_KEEP_MS);
  homeCellLinkWelcomed(session, { [HOME_CELL_WELCOME_FIELD]: 1 }, send);
  assert.equal(sent.length, 3, 'past its keep: dropped');
});

test('YC4 the hub\'s home cell frames: checked, HOME_CELL_WORDS_MAX a frame, gated, heard only on the link\'s own session', () => {
  _resetHomeCellPush();
  const session = {};
  homeCellLinkWelcomed(session, { [HOME_CELL_WELCOME_FIELD]: 1 }, () => true, 0);
  const heard = [];
  const off = onHomeCellWords((words) => heard.push(words));
  hearHomeCellFrame({}, { t: 'hcell', l: [[TOWN, 1, 2]] }, 0);
  assert.equal(heard.length, 0, 'another session');
  hearHomeCellFrame(session, { t: 'hcell', l: [[TOWN, 1, 0]] }, 0);
  hearHomeCellFrame(session, { t: 'hcell', l: Array.from({ length: HOME_CELL_WORDS_MAX + 1 }, () => [TOWN, 1, 2]) }, 0);
  assert.equal(heard.length, 0, 'a bad word, a frame too long');
  for (let i = 0; i < 10; i++) hearHomeCellFrame(session, { t: 'hcell', l: [[TOWN, 1, 2 + i]] }, 0);
  assert.ok(heard.length >= 1 && heard.length < 10, `gated (${heard.length} of 10 in one instant)`);
  assert.deepEqual(heard[0], [[TOWN, 1, 2]]);
  off();
  _resetHomeCellPush();
});

test('YC4 the account door: a home write\'s homeCellOrders carried to the hub; the cells and own routes asked as the service takes them', async (t) => {
  _resetHomeCellPush();
  t.after(() => _resetHomeCellPush());
  const sent = [];
  homeCellLinkWelcomed({}, { [HOME_CELL_WELCOME_FIELD]: 1 }, (frame) => {
    sent.push(JSON.parse(frame));
    return true;
  });
  const posts = [];
  const session = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    posts.push([new URL(url).pathname, JSON.parse(init.body)]);
    const body = url.endsWith('/v1/homes/entry') ? { ok: true, homeCellOrders: ['signed'] } : { ok: true };
    return { ok: true, status: 200, json: async () => body };
  };
  const door = accountHomes({ fetch, storage: { getItem: (key) => session.get(key) ?? null } });
  await door.entry(TOWN, A, 'public');
  assert.deepEqual(sent, [{ t: 'hcell', order: 'signed' }], 'the write\'s order, down the hub link');
  await door.cells(TOWN, [[CELL_AB, 3]]);
  await door.own(TOWN, ME);
  await door.own(TOWN, null);
  assert.deepEqual(posts.slice(1), [
    ['/v1/homes/cells', { mapId: TOWN, cells: [[CELL_AB, 3]] }],
    ['/v1/homes/own', { mapId: TOWN, character: ME }],
    ['/v1/homes/own', { mapId: TOWN }],
  ]);
});
