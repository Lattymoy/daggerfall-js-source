// SAVES-SAID (FIELD BUGS 2026-10-25, guild standing and quests reset; bible/06-Systems/Realm-Arc.md): THE PLAYER IS
// TOLD WHEN THEIR PROGRESS HAS NOT REACHED THE REALM. A realm session's puts that the service refuses for a while or
// never answers wait on the device, and only a save pressed by hand said so - a player could play for hours with
// nothing reaching the realm. Driven here through the real session (systems/realmSaves.js createRealmSession) over a
// service that answers as the account Worker does, on a clock by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRealmSession } from '../../../src/systems/realmSaves.js';
import {
  watchRealmUnsaved, realmUnsavedText, realmSavedAgainText, REALM_UNSAVED_SAY_AFTER_MS, REALM_UNSAVED_SAY_EVERY_MS,
} from '../../../src/systems/online/realmUnsavedNotice.js';
import { ONLINE_CHECKPOINT_MS } from '../../../src/systems/online/onlineCheckpoint.js';

const MINUTE = 60_000;
const ID = `r${'ab'.repeat(10)}`;

/** A realm session over a service whose next answers are queued: 'ok' (landed), 'busy' (503, its storage away),
 *  'offline' (no answer) or 'lease' (another device has the character). */
function realm() {
  const clock = { at: 0 };
  const answers = [];
  let seq = 1;
  const json = (status, body) => ({
    ok: status < 400, status,
    headers: { get: (name) => (name === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  });
  const fetch = async () => {
    const next = answers.shift() ?? 'ok';
    if (next === 'offline') throw new TypeError('network');
    if (next === 'busy') return json(503, { error: 'no-storage' });
    if (next === 'lease') return json(409, { error: 'lease' });
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
  const said = [];
  watchRealmUnsaved(session, { say: (text) => said.push(text), now: () => clock.at });
  /** A checkpoint at minute `minutes`, answered `answer`. */
  const checkpointAt = async (minutes, answer) => {
    clock.at = minutes * MINUTE;
    answers.push(answer);
    return session.checkpoint(JSON.stringify({ v: 1, minutes }));
  };
  return { session, said, lost, checkpointAt };
}

test('SAVES-SAID: the session says when its puts began to fail, and forgets it when one lands', async () => {
  const { session, checkpointAt } = realm();
  assert.equal(session.missedSince, null);
  assert.equal((await checkpointAt(2, 'busy')).ok, false);
  assert.equal(session.missedSince, 2 * MINUTE, 'the first put that failed');
  await checkpointAt(7, 'offline');
  assert.equal(session.missedSince, 2 * MINUTE, 'still the first - not the latest');
  assert.equal((await checkpointAt(9, 'ok')).ok, true);
  assert.equal(session.missedSince, null, 'a put landed: nothing waits on the device');
});

test('SAVES-SAID: one failed put is silent; a whole checkpoint period of them is said, again each period, and the landing after is said once', async () => {
  assert.equal(REALM_UNSAVED_SAY_AFTER_MS, ONLINE_CHECKPOINT_MS, 'one period: the next periodic checkpoint usually lands');
  assert.equal(REALM_UNSAVED_SAY_EVERY_MS, ONLINE_CHECKPOINT_MS);
  const { said, checkpointAt } = realm();
  await checkpointAt(0, 'ok');
  assert.deepEqual(said, [], 'a landing with nothing said before it says nothing');
  await checkpointAt(1, 'busy');
  assert.deepEqual(said, [], 'one failed put');
  await checkpointAt(5, 'offline');
  assert.deepEqual(said, [], 'four minutes: not yet a period');
  await checkpointAt(6, 'busy');
  assert.deepEqual(said, [realmUnsavedText(5)], 'a whole period failing');
  await checkpointAt(9, 'busy');
  assert.deepEqual(said, [realmUnsavedText(5)], 'not again inside the period');
  await checkpointAt(11, 'offline');
  assert.deepEqual(said, [realmUnsavedText(5), realmUnsavedText(10)], 'again a period on');
  await checkpointAt(12, 'ok');
  assert.deepEqual(said.at(-1), realmSavedAgainText(), 'the landing after a warning');
  await checkpointAt(13, 'ok');
  assert.equal(said.length, 3, 'said once');
});

test('SAVES-SAID: a landing after failures nobody was told of says nothing', async () => {
  const { said, checkpointAt } = realm();
  await checkpointAt(1, 'busy');
  await checkpointAt(3, 'ok');
  assert.deepEqual(said, []);
});

test('SAVES-SAID: the session\'s own end (another device took the character) is the Online door\'s to say - nothing here', async () => {
  const { said, lost, checkpointAt } = realm();
  await checkpointAt(1, 'busy');
  await checkpointAt(30, 'lease');
  assert.deepEqual(lost, ['lease']);
  assert.deepEqual(said, []);
});

test('SAVES-SAID: the warning says how long, that the device keeps it, and where to play - in the player\'s language, English here', () => {
  assert.equal(realmUnsavedText(1), 'Your progress has not reached the realm for 1 minute. This device is keeping it. Play this character only here until the realm takes it.');
  assert.equal(realmUnsavedText(12), 'Your progress has not reached the realm for 12 minutes. This device is keeping it. Play this character only here until the realm takes it.');
});
