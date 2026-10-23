// STAFF-PANEL-SPEED (2026-10-23, mob: "slow when moving in menus", "The click takes a while before the new page shows
// (it's waiting on the server)", "it need to not hurt server performance") - THE TRIPS A PLAYERS CLICK WAITS ON: the search
// (server-account/src/staffPlayers.js), a profile opened and each of its tabs, the devices, and the desk's reads
// (server-account/src/staffDesk.js: notes, the watchlist and its events, your settings, the reported board notes and
// market listings, the AI check's scorecard). Counted over the real Worker on test/accountDb.mjs with
// test/server/staffTrips.mjs, the session fresh (its touch is staff.js's). Before this the search took 4, a profile opened
// 7 and a tab 4 to 6, the devices and the notes 4, every other read page 3, each read's audit row a trip of its own; then
// a profile opened 4 (5 by a name, 6 by a guest's) and a tab 3, until the account, its characters and the badges' facts
// (or the tab named) were one batch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { PLAYER_TABS } from '../../server-account/src/staffPlayers.js';
import { countTrips } from './staffTrips.mjs';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

/** The Worker with mob an owner and Admin, signed in; Brisk a realm character whose law finding stands (so a tab reads
 *  it), with a staff note and on mob's watchlist. */
async function stand() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  const s = await standService({ DEVELOPER_HANDLES: 'SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${pub}` });
  await s.registered('SirMcMobdon');
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ts = nowS();
  const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords('login', 'sirmcmobdon', ts)))));
  const login = await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: 'a good long one', pub, ts, sig });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const brisk = await s.seated('Brisk', { save: { name: 'Brisk', level: 12, goldPieces: 500, items: [{ name: 'Steel Longsword', group: 'Weapons', templateIndex: 120, material: 2, value: 300, equipSlot: 9 }] } });
  await s.seated('Sylvia');
  const raw = s.env.DB._raw;
  const seq = raw.prepare('SELECT seq FROM realm_characters WHERE id = ?').get(brisk.character).seq;
  raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, ?, ?, 1, 'law', ?)")
    .run(brisk.id, brisk.character, seq, ts - 60, JSON.stringify({ count: 1, findings: [{ code: 'ceiling', list: 0, at: 0, t: 120 }] }));
  raw.prepare("UPDATE realm_characters SET law_sig = 'ceiling:120' WHERE id = ?").run(brisk.character);
  assert.equal((await staff('/v1/staff/notes/add', { target: brisk.id, text: 'warned in person' }, login.body.session)).status, 200);
  assert.equal((await staff('/v1/staff/watch/add', { target: brisk.id }, login.body.session)).status, 200);
  return { ...s, staff, token: login.body.session, raw, brisk };
}

/** The trips one call waits on, and its answer. */
async function counted(s, path, body) {
  const real = { prepare: s.env.DB.prepare, batch: s.env.DB.batch };
  const c = countTrips(s.env.DB);
  try {
    const r = await s.staff(path, body, s.token);
    return { ...r, trips: c.take().trips };
  } finally { Object.assign(s.env.DB, real); }
}

test('STAFF-PANEL-SPEED players: the search, a profile and every tab, the devices and the desk\'s reads, each in the fewest trips - a read\'s audit row rides its read, a profile asked by id reads its characters beside the account (mutants: each fold a trip after)', async () => {
  const s = await stand();
  const B = s.brisk.id;
  /** [path, body, the most trips it may take: the session's one, then the route's] */
  const pages = [
    ['/v1/staff/players', { q: 'bri' }, 2], ['/v1/staff/players', {}, 2], ['/v1/staff/players', { online: true }, 2], ['/v1/staff/players', { q: 'syl', online: true }, 2],
    // opened: the account, its characters and the badges' facts at once, then the tab they choose with its row
    ['/v1/staff/player', { target: B }, 3],
    // a tab named: the account, its characters and the tab with its row, one batch
    ...PLAYER_TABS.map((tab) => /** @type {[string, object, number]} */ (['/v1/staff/player', { target: B, tab }, 2])),
    // by a name: the account found first, its characters beside it, the tab after
    ['/v1/staff/player', { name: 'brisk', tab: 'overview' }, 3],
    ['/v1/staff/player/devices', { target: B }, 3], ['/v1/staff/notes', { target: B }, 3],
    ['/v1/staff/watch', {}, 2], ['/v1/staff/watch/events', {}, 2], ['/v1/staff/settings', {}, 2],
    ['/v1/staff/board/reported', {}, 2], ['/v1/staff/market/reported', {}, 2], ['/v1/staff/ai-score', {}, 2],
  ];
  for (const [path, body, most] of pages) {
    const r = await counted(s, path, body);
    assert.equal(r.status, 200, `${path} ${JSON.stringify(body)}: ${JSON.stringify(r.body)}`);
    assert.ok(r.trips <= most, `${path} ${JSON.stringify(body)}: ${r.trips} trips, ${most} at most`);
  }
  // every read still wrote its row, in the batch with its read
  const rows = (act) => s.raw.prepare('SELECT COUNT(*) AS n FROM staff_audit WHERE act = ?').get(act).n;
  assert.deepEqual(['players-search', 'player-read', 'devices-read', 'notes-read', 'watch-read', 'watch-events', 'reported-read', 'ai-score-read'].map(rows),
    [4, PLAYER_TABS.length, 1, 1, 1, 1, 2, 1]);
  // an account with no realm character: its Skills, Equipment and Inventories answer none and still write their row
  const none = (await s.registered('Emptyhand')).id;
  for (const tab of ['skills', 'equipment', 'inventories']) {
    const r = await counted(s, '/v1/staff/player', { target: none, tab });
    assert.deepEqual([r.status, r.body?.data, r.trips <= 2], [200, { character: null }, true], `${tab} of an account with no character: ${r.trips} trips`);
  }
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_audit WHERE act = 'player-read' AND target = ?").get(none).n, 3);
});

test('STAFF-PANEL-SPEED players: the folded search answers each account\'s characters as the separate read did - newest first, playing, dead and held - and only the page\'s', async () => {
  const s = await stand();
  const t = nowS();
  const second = 'r' + '0'.repeat(19) + '1';
  s.raw.prepare("INSERT INTO realm_characters (id, player, name, created_at, updated_at, dead_at, held) VALUES (?, ?, 'Bristle', ?, ?, ?, 'law')").run(second, s.brisk.id, t, t + 5, t);
  const r = await s.staff('/v1/staff/players', { q: 'bri' }, s.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.players.map((p) => [p.handle, p.characters]), [['Brisk', [
    { id: second, name: 'Bristle', playing: false, dead: true, held: 'law' },
    { id: s.brisk.character, name: 'Brisk', playing: true, dead: false, held: null },
  ]]]);
  const none = await s.staff('/v1/staff/players', { q: 'zzz' }, s.token);
  assert.deepEqual([none.status, none.body], [200, { players: [], next: null }]);
});

test('STAFF-PANEL-SPEED players: a profile by a name, a guest\'s name, a tab of a tie or of a list past its cut answers as the reads one after another did, in the fewest trips; a tab of no account writes no row (mutants: each fold a trip after; the character unchecked; the row unguarded)', async () => {
  const s = await stand();
  const B = s.brisk.id, t = nowS();
  const ok = async (body, most) => {
    const r = await counted(s, '/v1/staff/player', body);
    assert.equal(r.status, 200, `${JSON.stringify(body)}: ${JSON.stringify(r.body)}`);
    assert.ok(r.trips <= most, `${JSON.stringify(body)}: ${r.trips} trips, ${most} at most`);
    return r.body;
  };
  const read = (target, tab) => s.raw.prepare("SELECT COUNT(*) AS n FROM staff_audit WHERE act = 'player-read' AND target = ? AND json_extract(detail, '$.tab') = ?").get(target, tab).n;
  // by a handle: the badges' facts keyed on it, beside the account - the same card, badges and tab as by its id
  const byName = await ok({ name: 'BRISK ' }, 3);
  const byId = await ok({ target: B }, 3);
  assert.deepEqual(byName, byId);
  for (const tab of PLAYER_TABS) assert.deepEqual(await ok({ name: 'brisk', tab }, 3), await ok({ target: B, tab }, 2), tab);
  // a guest named as a handle is: the handle's account, as findAccount answers (the guests read beside it find none)
  s.raw.prepare("UPDATE players SET guest_name = 'Brisk' WHERE id = ?").run((await s.guest()).id);
  assert.deepEqual(await ok({ name: 'Brisk' }, 3), byId);
  // a guest's name: the handle misses, findAccount's own read of the guests beside it finds the guest, its reads by its id
  const fox = await s.guest();
  s.raw.prepare("UPDATE players SET guest_name = 'Wandering Fox' WHERE id = ?").run(fox.id);
  s.raw.prepare("INSERT INTO realm_characters (id, player, name, created_at, updated_at) VALUES ('r00000000000000000077', ?, 'Foxy', ?, ?)").run(fox.id, t, t);
  const guest = await ok({ name: 'Wandering Fox' }, 4);
  assert.deepEqual([guest.target, guest.tab, guest.card.name], [fox.id, 'overview', 'Wandering Fox']);
  assert.deepEqual(guest, await ok({ target: fox.id }, 3));
  assert.deepEqual(await ok({ name: 'Wandering Fox', tab: 'economy' }, 3), await ok({ target: fox.id, tab: 'economy' }, 2));
  // two guests of one name, and a name nobody wears, refused as findAccount refuses them
  const owl = [await s.guest(), await s.guest()];
  s.raw.prepare("UPDATE players SET guest_name = 'Twin Owl' WHERE id IN (?, ?)").run(owl[0].id, owl[1].id);
  for (const [body, status, error] of [[{ name: 'Twin Owl' }, 409, 'ambiguous'], [{ name: 'nobody-here' }, 404, 'no-player'], [{ name: 'Twin Owl', tab: 'skills' }, 409, 'ambiguous']]) {
    const r = await counted(s, '/v1/staff/player', body);
    assert.deepEqual([r.status, r.body?.error, r.trips <= 2], [status, error, true], `${JSON.stringify(body)}: ${r.trips} trips`);
  }
  // a tab of an account that is not there: refused, and no row written for it
  for (const tab of [null, ...PLAYER_TABS]) {
    const r = await counted(s, '/v1/staff/player', { target: 'NoSuchAccount1234', ...(tab ? { tab } : {}) });
    assert.deepEqual([r.status, r.body?.error, r.trips <= 2], [404, 'no-player', true], `${tab}: ${r.trips} trips`);
  }
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_audit WHERE target = 'NoSuchAccount1234'").get().n, 0);
  // two living characters saved the same second: the tab beside the list shows the one chosen() takes from it
  const twin = await s.registered('Twin');
  const ins = s.raw.prepare('INSERT INTO realm_characters (id, player, name, created_at, updated_at, dead_at) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run('r00000000000000000081', twin.id, 'TwinA', t, t - 100, null);
  ins.run('r00000000000000000082', twin.id, 'TwinB', t, t - 100, null);
  for (const tab of ['skills', 'economy']) assert.deepEqual(await ok({ target: twin.id, tab }, 2), await ok({ name: 'Twin', tab }, 3), tab);
  // a list past its cut, every character in it dead and one living past it: chosen() takes the list's first, and so does
  // PICK_SQL, which chooses over the list's own cut - beside the list, never the living one past the cut read and thrown
  // away (the checker's review: it was 3 trips, the reads of the one past the cut unused)
  const many = await s.registered('Manyfold');
  ins.run('r00000000000000000099', many.id, 'Alive', t, t - 10_000, null);
  s.raw.prepare('INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, checkpoints) VALUES (?, ?, ?, 3, 10, 0, 600, 2)').run('r00000000000000000099', Math.floor(t / 3600) * 3600, many.id);
  for (let i = 0; i < 90; i++) ins.run(`r1${String(i).padStart(19, '0')}`, many.id, `Fallen${i}`, t, t - i, t);
  for (const body of [{}, { char: 'r00000000000000000099' }]) {
    assert.deepEqual(await ok({ target: many.id, tab: 'skills', ...body }, 2), await ok({ name: 'Manyfold', tab: 'skills', ...body }, 3), `skills ${JSON.stringify(body)}`);
  }
  const econ = (await ok({ target: many.id, tab: 'economy' }, 2)).data;
  assert.deepEqual([econ.char, econ.hours, econ.characters.length], ['r1' + '0'.repeat(19), [], 90]);
  assert.deepEqual(econ, (await ok({ name: 'Manyfold', tab: 'economy' }, 3)).data);
  // no character, by a name: the tab answers none and still writes its row
  const none = (await s.registered('Emptyhand')).id;
  for (const tab of ['skills', 'equipment', 'inventories']) {
    assert.deepEqual((await ok({ name: 'Emptyhand', tab }, 3)).data, { character: null });
    assert.equal(read(none, tab), 1, `${tab}: its row`);
  }
});
