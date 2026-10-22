// SD-THROUGH (2026-10-21, the owner: "So the abyss dungeon. When someone finds and enters the portal. I want a portal to
// show up for anyone in the dungeon and anyone entering that automatically leads them there."; bible/11-Multiplayer/
// Super-Dungeons.md section 6, SD-THROUGH and AUDIT SD-THROUGH): THE FIRST SOUL THROUGH, ON THE RELAY. A Hollow's realm
// (`sd:<s>`) tells the hub at an admission (SD_INTERNAL_IN - unawaited, a hello never waits on it); a tell that does not
// land is OWED and told again on the realm's alarm (AUDIT SD-THROUGH A1), never once the realm's own Remnant has fallen
// (A4), a 400 the hub's last word (A5); the hub stamps its record's `inAt` once (net/superDungeon/sdLaw.js sdEnter) and says
// it to everyone online, and every client in the Hollow or entering it stands the Way Through beside them (the client's
// half: test/world/superDungeon/sdthrough_way.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validSdRecord, validSdOut, validSdInTell, SD_INTERNAL_IN, SD_KEY, SD_REALM_KEY, SD_TELL_RETRY_MS, SOCIAL_ROOM, chatRegionRoom, worldRoom, PIXEL_UNITS,
} from '../../../src/net/wire.js';
import { sdRise, sdFind, sdEnter, sdFell, sdGone, sdRoomKey, SD_COLLAPSE_MS, SD_NO_CLOSED } from '../../../src/net/superDungeon/sdLaw.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const T0 = 1_800_000_000_000;
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
/** A pose `east` metres east of pixel (px, py)'s centre - where a spawned dungeon stands (MapsFile's frame). */
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const sds = (ws) => ws.sent.filter((m) => m.t === 'sd');
/** Every unawaited tell let land (a fetch across fake objects is a few turns of the queue). */
const settle = async () => { for (let k = 0; k < 30; k++) await new Promise((r) => setImmediate(r)); };

test('SD-THROUGH the wire and the law: the record keeps `inAt` - a relay instant, never without a find - and the hub\'s frame carries it; the director stamps it once, while the Hollow is found and its boss stands; the realm\'s tell names its slot alone (mutants: the wire drops it; an unfound record kept with it; stamped twice; stamped unfound; the tell of slot 0)', () => {
  const risen = sdRise(null, T0, 3);
  const found = sdFind(risen, T0 + 60_000, 'Mara');
  const inn = sdEnter(found, T0 + 90_000);
  assert.deepEqual(inn, { ...found, inAt: T0 + 90_000 });
  assert.deepEqual(validSdRecord(inn), inn, 'kept');
  assert.deepEqual(validSdOut({ k: 'ev', ...inn }), { k: 'ev', ...inn }, 'the hub\'s frame carries it to every client');
  assert.equal(validSdRecord({ ...inn, inAt: -1 }), null, 'a relay instant');
  assert.equal(validSdRecord({ ...inn, inAt: 1.5 }), null);
  assert.equal(validSdRecord({ ...inn, inAt: '9' }), null);
  assert.equal(validSdRecord({ ...risen, inAt: T0 + 1 }), null, 'nobody steps through an unfound Hollow\'s Rift');
  assert.equal(validSdRecord(found).inAt, undefined, 'none said: none kept');
  assert.equal(sdEnter(null, T0), null);
  assert.equal(sdEnter(risen, T0 + 1), null, 'risen: no Hour to enter');
  assert.equal(sdEnter(inn, T0 + 100_000), null, 'stamped once - the first soul\'s');
  const fell = sdFell(found, T0 + 100_000, { top: 'Ann', n: 1 });
  assert.equal(sdEnter(fell, T0 + 100_001), null, 'after the kill');
  assert.equal(sdEnter(found, found.until), null, 'faded');
  assert.equal(sdEnter(sdGone(found, found.until), found.until + 1), null);
  assert.equal(SD_INTERNAL_IN, '/internal/sd/in');
  assert.deepEqual(validSdInTell({ s: 4, x: 1 }), { s: 4 }, 'projected');
  for (const bad of [null, [], { s: 0 }, { s: '4' }, { s: 1.5 }, { s: 1_000_000_000 }]) assert.equal(validSdInTell(bad), null, JSON.stringify(bad));
});

/** A world driven to a FOUND Hollow - slot 1, region 17 - with a hub socket listening; `tells` the realm's tells, each
 *  answered by `hubDoor(n)` when it answers (a Response, a promise of one, or a rejection), else by the hub. */
async function withFound(fn, { hubDoor = null } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const world = fakeRooms({ now: () => clock });
      const hub = world.room(SOCIAL_ROOM);
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      const h = hub.connect(); await hub.hello(h, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const n of [1, 2]) { const room = world.room(chatRegionRoom(17)); const ws = room.connect(); await room.hello(ws, `peer-r${n}`, null, { kind: 'linked', tokenSub: `acct-r${n}` }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      assert.equal(hub.store.get(SD_KEY).ph, 'found');
      const realm = world.room(sdRoomKey(rec.s));
      const tells = [];
      const ROOMS = realm.room.env.ROOMS;
      realm.room.env.ROOMS = { idFromName: ROOMS.idFromName, get: (id) => ({ fetch: async (q) => {
        if (new URL(q.url).pathname === SD_INTERNAL_IN) { tells.push(await q.clone().json()); if (hubDoor) { const r = hubDoor(tells.length); if (r) return r; } }
        return ROOMS.get(id).fetch(q);
      } }) };
      const enter = async (id, extra = {}) => { const ws = realm.connect(); await realm.hello(ws, id, null, { name: id, ...extra }); await settle(); return ws; };
      const door = (body) => hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_IN}`, { method: 'POST', body: JSON.stringify(body) }));
      await fn({ hub, h, realm, rec: () => hub.store.get(SD_KEY), tells, enter, door, fire, settle, step: (ms) => { clock += ms; }, set: (t) => { clock = t; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('SD-THROUGH the relay: the hub\'s door moves nothing for another slot or a bad body; the realm\'s first admission tells the hub, which stamps `inAt` and says it to everyone online; the next admission tells nothing; a hello the realm refuses tells nothing (mutants: the tell never made; the door unrouted; never stamped; never fanned; told at every hello; the hub\'s slot unasked)', async () => {
  await withFound(async (W) => {
    const before = W.rec();
    assert.equal(before.inAt, undefined, 'found, nobody through');
    // AUDIT SD-THROUGH (C11): the door asked BEFORE the first stamp - another slot's tell, a bad body: nothing moves
    assert.equal((await W.door({ s: before.s + 1 })).status, 200);
    assert.equal((await W.door({ s: 0 })).status, 400);
    assert.equal(W.rec().inAt, undefined, 'another slot\'s tell stamps nothing');
    const t0 = W.now();
    const ann = await W.enter('peer-ann');
    assert.equal(ann.closed, null, 'admitted');
    assert.deepEqual(W.tells, [{ s: before.s }], 'the realm told the hub - its slot alone');
    const after = W.rec();
    assert.deepEqual(after, { ...before, inAt: t0 }, 'stamped, at the hub\'s own instant');
    assert.deepEqual(sds(W.h).at(-1), { t: 'sd', k: 'ev', ...after }, 'said to everyone online');
    W.step(1000);
    await W.enter('peer-bo');
    assert.equal(W.tells.length, 1, 'the next admission tells nothing - the hub answered');
    assert.equal(W.rec().inAt, t0, 'the first soul\'s instant kept');
  });
  // a refused hello tells nothing: the Hour closed under it (the kill)
  await withFound(async (W) => {
    await W.hub.room._sdSave(sdFell(W.rec(), W.now(), { top: 'Ann', n: 1 }));
    W.step(10_001);   // past the realm's kept answer
    const late = await W.enter('peer-late');
    assert.equal(late.closed?.reason, SD_NO_CLOSED, 'a newcomer after the kill');
    assert.deepEqual(W.tells, [], 'refused: nothing told');
    assert.equal(W.rec().inAt, undefined);
  });
});

test('SD-THROUGH A TELL THAT DID NOT LAND IS OWED (AUDIT SD-THROUGH A1): admissions while a tell is in flight tell nothing more; the tell failing - a 5xx, a refused fetch, an older hub\'s 404 (A5) - arms the realm\'s alarm, which tells again once SD_TELL_RETRY_MS has passed and the hub stamps; a woken instance asks again from its own sockets; a 400 is the hub\'s last word (mutants: one in flight unkept; told once whatever the answer; the alarm never told; the rejection unowed; a 404 final; a 400 owed)', async () => {
  // a party of three through together: the first tell held in flight, then failing - one tell, then the alarm's
  let release = null;
  await withFound(async (W) => {
    await W.enter('peer-a');
    await W.enter('peer-b');
    await W.enter('peer-c');
    assert.equal(W.tells.length, 1, 'one tell in flight - the two after it tell nothing');
    release(new Response('busy', { status: 503 }));
    await W.settle();
    assert.equal(W.rec().inAt, undefined, 'the hub was busy: not stamped');
    assert.ok(W.realm.alarm.at != null && W.realm.alarm.at <= W.now() + SD_TELL_RETRY_MS, 'the retry armed');
    await W.realm.fire();   // an alarm sooner than the retry - a fight's beat
    await W.settle();
    assert.equal(W.tells.length, 1, 'not before its time');
    assert.ok(W.realm.alarm.at != null, 'and the retry still armed');
    W.step(SD_TELL_RETRY_MS);
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.tells.length, 2, 'the alarm tells again');
    assert.equal(W.rec().inAt, W.now(), 'and the hub stamps');
    W.step(SD_TELL_RETRY_MS);
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.tells.length, 2, 'told: never again');
  }, { hubDoor: (n) => (n === 1 ? new Promise((r) => { release = r; }) : null) });
  // a refused fetch (the hub unreachable): owed the same
  await withFound(async (W) => {
    await W.enter('peer-a');
    assert.equal(W.tells.length, 1);
    W.step(SD_TELL_RETRY_MS);
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.tells.length, 2, 'told again');
    assert.ok(W.rec().inAt != null);
  }, { hubDoor: (n) => (n === 1 ? Promise.reject(new Error('the hub is down')) : null) });
  // an older hub mid-deploy answers the door 404: owed, never told for good
  await withFound(async (W) => {
    await W.enter('peer-a');
    W.step(SD_TELL_RETRY_MS);
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.tells.length, 2, 'a 404 is owed');
    assert.ok(W.rec().inAt != null);
  }, { hubDoor: (n) => (n === 1 ? new Response('no such room', { status: 404 }) : null) });
  // a realm that woke (its memory forgotten) with its tell owed: its alarm asks again by its own sockets' room
  await withFound(async (W) => {
    await W.enter('peer-a');
    assert.equal(W.tells.length, 1);
    W.realm.wake();
    W.step(SD_TELL_RETRY_MS);
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.tells.length, 2, 'the woken realm tells');
    assert.ok(W.rec().inAt != null);
  }, { hubDoor: (n) => (n === 1 ? new Response('busy', { status: 503 }) : null) });
  // a 400: the hub's last word - never told again, by an admission or the alarm
  await withFound(async (W) => {
    await W.enter('peer-a');
    await W.enter('peer-b');
    W.step(SD_TELL_RETRY_MS);
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.tells.length, 1, 'a 400: never told again');
  }, { hubDoor: () => new Response('no', { status: 400 }) });
});

test('SD-THROUGH NEVER IN THE COLLAPSE: a returner after the hub\'s word of the kill tells nothing, nor one after the realm\'s own fall before the hub has heard it (AUDIT SD-THROUGH A4); the returner\'s own admission tells while it is found (mutants: a returner never tells; told in the collapse; told after the realm\'s own fall)', async () => {
  // the first tell lost; a returner tells it again while found
  await withFound(async (W) => {
    await W.enter('peer-ann');
    assert.equal(W.tells.length, 1);
    const t1 = W.now() + 2000;
    W.set(t1);
    await W.enter('peer-ann', { tokenSub: 'acct-peer-ann' });   // a fighter coming back (a reload)
    assert.equal(W.tells.length, 2, 'told again');
    assert.equal(W.rec().inAt, t1, 'stamped at last');
  }, { hubDoor: (n) => (n === 1 ? new Response('busy', { status: 503 }) : null) });
  // the hub's record fallen: a returner admitted in the collapse tells nothing
  await withFound(async (W) => {
    await W.enter('peer-ann');
    await W.hub.room._sdSave(sdFell(W.rec(), W.now(), { top: 'Ann', n: 1 }));
    W.step(10_001);
    const back = await W.enter('peer-ann', { tokenSub: 'acct-peer-ann' });
    assert.equal(back.closed, null, 'one who went through, admitted in the collapse');
    assert.equal(W.tells.length, 1, 'the collapse tells nothing');
    assert.deepEqual(W.realm.store.get(SD_REALM_KEY).in, ['acct-peer-ann']);
    W.set(W.rec().fellAt + SD_COLLAPSE_MS);
  }, { hubDoor: (n) => (n === 1 ? new Response('busy', { status: 503 }) : null) });
  // the realm's own Remnant fallen, its word not yet the hub's (the hub still says found): nothing told
  await withFound(async (W) => {
    await W.enter('peer-ann');
    assert.equal(W.tells.length, 1);
    W.realm.room._sdFight = { s: W.rec().s, fell: { at: W.now(), top: ['Ann'], n: 1 } };
    W.step(SD_TELL_RETRY_MS);
    await W.enter('peer-ann', { tokenSub: 'acct-peer-ann' });
    await W.fire(W.realm);
    await W.settle();
    assert.equal(W.rec().inAt, undefined, 'never stamped after the realm\'s own fall');
  }, { hubDoor: (n) => (n === 1 ? new Response('busy', { status: 503 }) : null) });
});

test('SD-THROUGH the relay by source: the hub\'s door routed; the realm tells from its admission\'s two exits, unawaited, in Room methods of their own - never in `_message`; the owed tell on the realm\'s alarm before its fight\'s beat; the hub moves its record by the law (mutants: awaited; inside _message; the alarm unwired)', () => {
  const R = read('server/src/index.js');
  assert.match(R, /if \(path === SD_INTERNAL_IN\) return this\._sdInInternal\(request\);/);
  assert.match(R, /if \(sub && realm\.in\.includes\(sub\)\) \{ this\._sdTellIn\(s, rec, now\); return null; \}/, 'a returner\'s admission');
  assert.match(R, /await this\.state\.storage\.put\(SD_REALM_KEY, realm\); \}\n\s*this\._sdTellIn\(s, rec, now\);[^\n]*\n\s*return null;/, 'a newcomer\'s');
  assert.doesNotMatch(R, /await this\._sdTellIn\(/, 'a hello never waits on it');
  const msg = R.slice(R.indexOf('  async _message(ws, message) {'), R.indexOf('\n  }\n', R.indexOf('  async _message(ws, message) {')));
  assert.ok(msg.length > 1000 && !/_sdTellIn|_sdInBeat|sdEnter\(/.test(msg), 'never in the dispatcher');
  const tell = R.slice(R.indexOf('  _sdTellIn(s, rec, now) {'), R.indexOf('\n  }\n', R.indexOf('  _sdTellIn(s, rec, now) {')));
  assert.match(tell, /rec\?\.inAt != null \|\| !sdAdmits\(rec, now\) \|\| this\._sdInTold === s \|\| this\._sdInTelling === s/, 'only while found, unstamped, untold, one in flight');
  const now = R.slice(R.indexOf('  async _sdTellInNow(s, rooms) {'), R.indexOf('\n  }\n', R.indexOf('  async _sdTellInNow(s, rooms) {')));
  assert.match(now, /if \(\(await this\._sdFightOf\(\)\)\?\.fell\) return;/, 'never after the realm\'s own fall');
  assert.match(now, /if \(res && \(res\.ok \|\| res\.status === 400\)\) \{ this\._sdInTold = s; this\._sdInOwed = null; return; \}/, 'answered: told');
  assert.match(R, /await this\._sdInBeat\(Date\.now\(\)\);[^\n]*\n\s*if \(await this\._sdFightTick\(\)\) return;/, 'the realm\'s alarm, before its fight\'s beat');
  assert.match(R, /const inn = rec && rec\.s === c\.s \? sdEnter\(rec, Date\.now\(\)\) : null;\n\s*if \(inn\) \{ await this\._sdSave\(inn\); this\._sdFan\(inn\); \}/);
});
