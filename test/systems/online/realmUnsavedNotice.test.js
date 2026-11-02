// SAVES-SAID (FIELD BUGS 2026-10-25, guild standing and quests reset; bible/06-Systems/Realm-Arc.md): THE PLAYER IS
// TOLD WHEN THEIR PROGRESS HAS NOT REACHED THE REALM. A realm session's puts that the service refuses for a while or
// never answers wait on the device, and only a save pressed by hand said so - a player could play for hours with
// nothing reaching the realm. Driven here through the real session (systems/realmSaves.js createRealmSession) over a
// service that answers as the account Worker does, on a clock by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRealmSession } from '../../../src/systems/realmSaves.js';
import {
  watchRealmUnsaved, realmUnsavedText, realmNotSavedText, realmSavedAgainText, REALM_UNSAVED_SAY_AFTER_MS, REALM_UNSAVED_SAY_EVERY_MS,
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
  let gate = null;
  const fetch = async () => {
    if (gate) await gate.promise;
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
  const watch = watchRealmUnsaved(session, { say: (text) => said.push(text), now: () => clock.at });
  /** A checkpoint at minute `minutes`, answered `answer`. */
  const checkpointAt = async (minutes, answer) => {
    clock.at = minutes * MINUTE;
    answers.push(answer);
    return session.checkpoint(JSON.stringify({ v: 1, minutes }));
  };
  /** A frame at minute `minutes`, with no checkpoint in it. */
  const tickAt = (minutes) => {
    clock.at = minutes * MINUTE;
    watch.tick();
  };
  /** The service holds its answers until released - a put out. */
  const hold = () => {
    let release;
    const promise = new Promise((resolve) => { release = resolve; });
    gate = { promise, release };
  };
  const release = () => {
    gate.release();
    gate = null;
  };
  return { session, said, lost, clock, checkpointAt, tickAt, hold, release };
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

test('SAVES-SAID: a whole checkpoint period since the realm last took a save is said - at 5 minutes, again at 10 - and the landing after is said once', async () => {
  assert.equal(REALM_UNSAVED_SAY_AFTER_MS, ONLINE_CHECKPOINT_MS, 'one period: the next periodic checkpoint usually lands');
  assert.equal(REALM_UNSAVED_SAY_EVERY_MS, ONLINE_CHECKPOINT_MS);
  const { said, checkpointAt, tickAt } = realm();
  await checkpointAt(0, 'ok');
  assert.deepEqual(said, [], 'a landing with nothing said before it says nothing');
  await checkpointAt(1, 'busy');
  assert.deepEqual(said, [], 'one failed put');
  tickAt(4.9);
  assert.deepEqual(said, [], 'not yet a period since the last landing');
  tickAt(5);
  assert.deepEqual(said, [realmUnsavedText(5)], 'a period since the last landing, measured from it - not from the first failure');
  await checkpointAt(6, 'offline');
  tickAt(9.9);
  assert.deepEqual(said, [realmUnsavedText(5)], 'not again inside the period');
  tickAt(10);
  assert.deepEqual(said, [realmUnsavedText(5), realmUnsavedText(10)], 'again a period on');
  await checkpointAt(12, 'ok');
  assert.deepEqual(said.at(-1), realmSavedAgainText(), 'the landing after a warning');
  await checkpointAt(13, 'ok');
  tickAt(14);
  assert.equal(said.length, 3, 'said once');
});

test('SAVES-SAID: a gate stuck shut - nothing handed to the realm at all - is said too, in its own words, and the save after it is said', async () => {
  const { said, checkpointAt, tickAt } = realm();
  await checkpointAt(0, 'ok');
  tickAt(5);
  assert.deepEqual(said, [realmNotSavedText(5)], 'no put failed: the device keeps nothing, and the words say so');
  tickAt(10);
  assert.deepEqual(said, [realmNotSavedText(5), realmNotSavedText(10)]);
  await checkpointAt(11, 'ok');
  assert.equal(said.at(-1), realmSavedAgainText());
});

test('SAVES-SAID: the join is a save the realm holds, a put still out is waited for, and a periodic save the realm already holds counts as one', async () => {
  const quiet = realm();
  quiet.tickAt(4.9);
  assert.deepEqual(quiet.said, [], 'measured from the join');
  quiet.tickAt(5);
  assert.deepEqual(quiet.said, [realmNotSavedText(5)]);

  const slow = realm();
  slow.hold();
  slow.clock.at = 4 * MINUTE;
  const put = slow.session.checkpoint(JSON.stringify({ v: 1 }));
  slow.tickAt(6);
  assert.deepEqual(slow.said, [], 'a put out and not yet failed: its answer decides');
  slow.release();
  await put;
  slow.tickAt(7);
  assert.deepEqual(slow.said, []);

  const idle = realm();
  await idle.checkpointAt(0, 'ok');
  idle.clock.at = 4 * MINUTE;
  const answer = await idle.session.idle(() => idle.session.checkpoint(JSON.stringify({ v: 1, minutes: 0 })));
  assert.equal(answer?.idle, true, 'the realm already holds it');
  idle.tickAt(8);
  assert.deepEqual(idle.said, [], 'four minutes since the idle answer, not eight since the put');
});

test('SAVES-SAID: the words say how long and whether this device keeps it - in the player\'s language, English here', () => {
  assert.equal(realmNotSavedText(5), 'Your progress has not been saved to the realm for 5 minutes. It is saved when what you are doing ends.');
  assert.equal(realmNotSavedText(1), 'Your progress has not been saved to the realm for 1 minute. It is saved when what you are doing ends.');
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
