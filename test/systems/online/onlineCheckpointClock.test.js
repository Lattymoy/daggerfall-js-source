// SEAT-SAVES at the seat's loss (bible/06-Systems/Realm-Arc.md): a tab that loses the seat saves its realm character at
// once, so a lease another device took is heard then and the tab goes to the Online door - not up to a checkpoint period
// later, playing on with nothing saved. Driven through the real session (systems/realmSaves.js createRealmSession) over a
// service that answers as the account Worker does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRealmSession } from '../../../src/systems/realmSaves.js';
import { createOnlineCheckpointClock, askCheckpoint } from '../../../src/systems/online/onlineCheckpointClock.js';
import { ONLINE_CHECKPOINT_MS } from '../../../src/systems/online/onlineCheckpoint.js';
import { realmNotSavedText } from '../../../src/systems/online/realmUnsavedNotice.js';

const ID = `r${'cd'.repeat(10)}`;

/** A realm session over a service answering each put with `answer()` - 'ok', or 'lease' (another device joined). */
function realm(answer = () => 'ok') {
  const clock = { at: 0 };
  let seq = 1;
  const json = (status, body) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => body });
  const puts = [];
  const fetch = async (url) => {
    puts.push(url);
    if (answer() === 'lease') return json(409, { error: 'lease' });
    seq += 1;
    return json(200, { seq });
  };
  const storage = new Map();
  const io = {
    fetch, base: 'https://accounts.invalid', secret: 's'.repeat(32), player: null,
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k), get length() { return storage.size; }, key: (i) => [...storage.keys()][i] ?? null },
  };
  const lost = [];
  const session = createRealmSession({
    io, id: ID, lease: 'a'.repeat(32), seq: 1, onLost: (why) => lost.push(why),
    later: () => () => {}, hidden: () => false, watchHidden: () => {}, now: () => clock.at,
  });
  return { session, clock, puts, lost };
}

/** The host's checkpoint, as world.js onlineCheckpoint runs it: the gate, then the save handed to the session. */
function host(r, { open = () => true, stands = undefined } = {}) {
  let lastAt = -Infinity;
  const said = [];
  const checkpoint = () => {
    if (!open()) return false;
    lastAt = r.clock.at;
    r.session?.checkpoint(JSON.stringify({ at: r.clock.at }));
    return true;
  };
  const clock = createOnlineCheckpointClock({ session: r.session, checkpoint, lastAt: () => lastAt, say: (text) => said.push(text), now: () => r.clock.at, stands });
  return { clock, said };
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

test('SEAT-SAVES: the seat lost saves at once, and a lease another device took sends the tab to the door then', async () => {
  const r = realm(() => 'lease');
  const { clock } = host(r);
  clock.seatLost();
  await settle();
  assert.equal(r.puts.length, 1, 'one put, at the seat\'s loss');
  assert.deepEqual(r.lost, ['lease'], 'the dead lease heard now');
  clock.seatLost();
  await settle();
  assert.equal(r.puts.length, 1, 'a lost session saves nothing more');
});

test('SEAT-SAVES: a seat lost to another of the account\'s characters saves as any checkpoint does', async () => {
  const r = realm();
  const { clock } = host(r);
  clock.seatLost();
  await settle();
  assert.equal(r.session.seq, 2, 'landed');
  assert.deepEqual(r.lost, []);
});

test('SEAT-SAVES: a character saved to its slots saves nothing at the seat\'s loss - a slot has no lease to check', async () => {
  let ran = 0;
  const clock = createOnlineCheckpointClock({ session: null, checkpoint: () => { ran += 1; }, lastAt: () => -Infinity, say: () => {} });
  clock.seatLost();
  assert.equal(ran, 0);
  clock.frame(1);
  assert.equal(ran, 1, 'but its periodic checkpoint still runs');
});

test('the frame runs the periodic checkpoint when due, then says a realm that has held nothing new for a period', async () => {
  const r = realm();
  let open = true;
  const { clock, said } = host(r, { open: () => open });
  clock.frame(0);
  await settle();
  assert.equal(r.puts.length, 1, 'the first frame checkpoints');
  r.clock.at = ONLINE_CHECKPOINT_MS - 1;
  clock.frame(r.clock.at);
  assert.equal(r.puts.length, 1, 'not due yet');
  open = false;   // a duel: the gate shut
  r.clock.at = ONLINE_CHECKPOINT_MS;
  clock.frame(r.clock.at);
  await settle();
  assert.equal(r.puts.length, 1);
  assert.deepEqual(said, [realmNotSavedText(5)], 'the shut gate is said');
  open = true;
  r.clock.at += 1;
  clock.frame(r.clock.at);
  await settle();
  assert.equal(r.puts.length, 2);
});

test('the first checkpoint waits for the world to stand: a classic start\'s first frame is outdoors, before its dungeon', async () => {
  const r = realm();
  let stands = false;
  const { clock } = host(r, { stands: () => stands });
  clock.frame(0);
  clock.frame(ONLINE_CHECKPOINT_MS * 2);
  await settle();
  assert.equal(r.puts.length, 0, 'due, but nothing is saved before the world stands');
  stands = true;
  clock.frame(ONLINE_CHECKPOINT_MS * 2 + 1);
  await settle();
  assert.equal(r.puts.length, 1, 'the first frame that stands checkpoints at once');
  assert.equal(r.session.seq, 2);
});

test('a seat lost before the world stands saves nothing then; the first standing frame saves and hears the lease', async () => {
  const r = realm(() => 'lease');
  let stands = false;
  const { clock } = host(r, { stands: () => stands });
  clock.seatLost();
  await settle();
  assert.equal(r.puts.length, 0);
  stands = true;
  clock.frame(1);
  await settle();
  assert.equal(r.puts.length, 1);
  assert.deepEqual(r.lost, ['lease'], 'heard on the first standing frame');
});

test('a start that stands at once (a town, a load) still checkpoints on its first frame - the hold never starves', async () => {
  const r = realm();
  const { clock } = host(r, { stands: () => true });
  clock.frame(0);
  await settle();
  assert.equal(r.puts.length, 1);
});

test('AUDIT-STOREFRONT II (lane D 2): a checkpoint asked runs on the next standing frame though none is due, once; not before the world stands; never for a lost session (mutants: the ask unread; the ask kept; asked before the world stands)', async () => {
  const r = realm();
  let stands = false;
  const { clock } = host(r, { stands: () => stands });
  stands = true;
  clock.frame(0);
  await settle();
  assert.equal(r.puts.length, 1, 'the first frame\'s');
  r.clock.at = 1000;
  stands = false;
  askCheckpoint();
  clock.frame(r.clock.at);
  await settle();
  assert.equal(r.puts.length, 1, 'nothing before the world stands');
  stands = true;
  clock.frame(r.clock.at);
  await settle();
  assert.equal(r.puts.length, 2, 'asked: saved, a period early');
  clock.frame(r.clock.at + 1);
  await settle();
  assert.equal(r.puts.length, 2, 'once');
  const gone = realm(() => 'lease');
  host(gone).clock.seatLost();
  await settle();
  assert.deepEqual(gone.lost, ['lease']);
  let ran = 0;
  const lost = createOnlineCheckpointClock({ session: gone.session, checkpoint: () => { ran += 1; }, lastAt: () => 0, say: () => {} });
  askCheckpoint();
  lost.frame(1);
  assert.equal(ran, 0, 'a lost session is asked nothing');
});
