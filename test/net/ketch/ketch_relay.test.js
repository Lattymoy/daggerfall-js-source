// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 10): A CREW'S SHIP AT THE RELAY - the real Room over its
// fake storage (test/fakeRoom.mjs): the door (the captain, the captain's party by the hub's word, staff; a stranger
// refused before anything is written; the ninth refused), the ship told whole at the hello, a word judged by the wire and
// its bucket, the brain's number, the alarm's beat fanning the Watch to the crew, the fall's receipts minted once and
// handed (again at a late hello), and the voyage gone - everyone told and closed. tools/mutants/ketch_relay.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, KT_VOYAGE_KEY, KT_RELAY_MIN, RELAY_VERSION, relaySupportsKetch, ketchReceiptKey } from '../../../src/net/wire.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { ketchRoomKey, ketchVoyageOf, KT_TEXT, KT_STAGE, KT_CREW_MAX } from '../../../src/net/ketch/ketchLaw.js';
import { deckToDungeon } from '../../../src/net/ketch/ketchDeck.js';
import { KETCH_SEAM } from '../../../src/net/ketch/ketchWarden.js';
import { readKetchReceipt } from '../../../src/net/ketch/ketchReceipt.js';
import { KT_POSE_FRESH_MS, KT_PLACE_KEEP_MS, KT_SAILWALK_LEAST_MS } from '../../../src/net/ketch/ketchBrain.js';
import { KT_GANGWAY } from '../../../src/net/ketch/ketchDeck.js';

const V1 = ketchVoyageOf(1);
const T0 = V1.at + 60_000;
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const refusal = (ws) => ws.sent.find((m) => m.t === 'error')?.m ?? null;
const welcomed = (ws) => ws.sent.some((m) => m.t === 'welcome');
const kt = (ws, k) => ws.sent.filter((m) => m.t === 'kt' && (!k || m.k === k));
const at = (x, y, z) => { const [dx, dy, dz] = deckToDungeon(x, y, z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, mv: 0 }; };
const word = (k, extra = {}) => JSON.stringify({ t: 'kt', k, ...extra });
/** A world on the voyage's clock, its hub seating party p1 (`members`, accounts `acct-<name>`), the captain alice's ship. */
async function withShip(fn, members = ['acct-alice', 'acct-bobby']) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const world = fakeRooms({ now: () => clock });
      const hub = world.room(SOCIAL_ROOM);
      for (const m of members) hub.store.set(`acct:${m}`, { name: m.slice(5), party: 'p1' });
      hub.store.set('party:p1', { id: 'p1', leader: members[0], members, invites: [], away: {} });
      const key = ketchRoomKey(1, await instanceOwnerOf('acct-alice'));
      const ship = world.room(key);
      await fn({ world, hub, ship, key, set: (t) => { clock = t; }, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('KETCH THE RELAY KEEPS SHIPS FROM world255: a page boards no ship whose relay is older (mutants: the floor an older relay\'s)', () => {
  assert.equal(KT_RELAY_MIN, 255);
  assert.ok(relaySupportsKetch(RELAY_VERSION));
  assert.equal(relaySupportsKetch('world252'), false);
  assert.equal(relaySupportsKetch(null), false);
  const src = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(src, /if \(key\.startsWith\('kt:'\) && !ketchRoomHolds\(key, Date\.now\(\)\)\) return json\(\{ error: 'the Ketch is gone' \}, 404\);/, 'no object minted for a voyage the clock has not brought');
});

test('KETCH THE DOOR: its captain and the captain\'s party by the hub\'s word come aboard and are told the ship whole; a stranger is refused before anything is written; each taken into the crew once (mutants: a stranger let in; the ship untold; a pose unstamped)', async () => {
  await withShip(async ({ hub, ship }) => {
    hub.store.set('acct:acct-carol', { name: 'carol', party: null });
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 6), { charLevel: 30 });
    assert.ok(welcomed(alice), 'its captain');
    const st = kt(alice, 'st')[0];
    assert.ok(st, 'told the ship whole');
    assert.deepEqual([st.n, st.sg, st.cr.map((c) => c[0])], [1, KT_STAGE.watch, ['acct-alice']]);
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(0, 0, 6), { charLevel: 22 });
    assert.ok(welcomed(bob), 'the captain\'s party');
    const carol = ship.connect(); await ship.hello(carol, 'carol', at(0, 0, 6));
    assert.equal(refusal(carol), KT_TEXT.refuse.crew);
    assert.ok(!welcomed(carol));
    const V = ship.room._kt;
    assert.deepEqual(V.crew, ['acct-alice', 'acct-bobby']);
    assert.deepEqual([V.players['acct-alice'].lv, V.players['acct-bobby'].lv], [30, 22], 'the level its token signs');
    assert.deepEqual(ship.store.get(KT_VOYAGE_KEY).crew, ['acct-alice', 'acct-bobby'], 'kept at the admission');
    const again = ship.connect(); await ship.hello(again, 'bobby', at(0, 0, 6));
    assert.deepEqual(V.crew, ['acct-alice', 'acct-bobby'], 'once a voyage');
  });
});

test('KETCH A POSE KEEPS A MEMBER ABOARD: every pose stamped with its moment, so the census counts a member who keeps posing long past its hello (KT_POSE_FRESH_MS) - and drops one gone quiet (mutants: a pose unstamped)', async () => {
  await withShip(async ({ ship, step, now }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30), { charLevel: 30 });
    for (let k = 0; k < 8; k++) { step(5000); await ship.pose(alice, at(0, 0, 30 + (k % 2))); }
    const V = ship.room._kt;
    assert.deepEqual(ship.room._ktBodies(V, now()).map((b) => b.sub), ['acct-alice'], 'forty seconds aboard, posing: counted');
    step(KT_POSE_FRESH_MS + 1000);
    assert.deepEqual(ship.room._ktBodies(V, now()), [], 'quiet past it: no body');
  });
});

test('KETCH THE CREW\'S EIGHT: a ninth of the party is refused a full ship (mutants: the ninth let in)', async () => {
  const names = ['alice', 'bobby', 'cyrus', 'delia', 'egbert', 'fiona', 'gareth', 'hilda', 'ivor'];
  await withShip(async ({ ship }) => {
    for (const n of names.slice(0, KT_CREW_MAX)) { const ws = ship.connect(); await ship.hello(ws, n, at(0, 0, 6)); assert.ok(welcomed(ws), n); }
    const ninth = ship.connect(); await ship.hello(ninth, 'ivor', at(0, 0, 6));
    assert.equal(refusal(ninth), KT_TEXT.refuse.full);
    assert.equal(ship.room._kt.crew.length, KT_CREW_MAX);
  }, names.map((n) => `acct-${n}`));
});

test('KETCH A FULL SHIP FREES A QUITTER\'S PLACE: a member gone from the captain\'s party and from the ship KT_PLACE_KEEP_MS gives its place to a newcomer of the party; one still of the party, one gone a moment, and the captain keep theirs (AUDIT KETCH L1-5; mutants: no place freed; a member of the party freed)', async () => {
  const names = ['alice', 'bobby', 'cyrus', 'delia', 'egbert', 'fiona', 'gareth', 'hilda', 'ivor'];
  await withShip(async ({ ship, hub, step }) => {
    const ws = {};
    for (const n of names.slice(0, KT_CREW_MAX)) { ws[n] = ship.connect(); await ship.hello(ws[n], n, at(0, 0, 6)); assert.ok(welcomed(ws[n]), n); }
    const party = hub.store.get('party:p1');
    hub.store.set('party:p1', { ...party, members: party.members.filter((m) => m !== 'acct-delia') });
    hub.store.set('acct:acct-delia', { name: 'delia', party: null });
    hub.wake();   // the hub's records as stored now
    await ship.drop(ws.delia); await ship.drop(ws.cyrus); await ship.drop(ws.alice);
    step(KT_PLACE_KEEP_MS - 1000);
    const early = ship.connect(); await ship.hello(early, 'ivor', at(0, 0, 6));
    assert.equal(refusal(early), KT_TEXT.refuse.full, 'gone a moment: kept');
    step(2000);
    const ivor = ship.connect(); await ship.hello(ivor, 'ivor', at(0, 0, 6));
    assert.ok(welcomed(ivor), 'the quitter\'s place');
    const V = ship.room._kt;
    assert.ok(!V.crew.includes('acct-delia') && V.crew.includes('acct-ivor') && V.crew.includes('acct-cyrus') && V.crew.includes('acct-alice'), 'cyrus of the party (ahead of the quitter) and alice the captain kept');
    assert.equal(V.crew.length, KT_CREW_MAX);
    assert.ok(kt(ws.bobby, 'st').at(-1).cr.every(([s]) => s !== 'acct-delia'), 'the crew aboard told');
    const delia = ship.connect(); await ship.hello(delia, 'delia', at(0, 0, 6));
    assert.equal(refusal(delia), KT_TEXT.refuse.crew, 'and a stranger now');
  }, names.map((n) => `acct-${n}`));
});

test('KETCH A WORD ABOARD: the wire projects it (junk refused), the brain\'s number on an `in` (an older game told so), a cell or a blow off its stage nothing; the alarm\'s beat - a member in the waist - fans the Watch\'s first wave to the crew (mutants: the wire refusing its words; an `in` with no brain number joined; the beat unarmed)', async () => {
  await withShip(async ({ ship, step }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30), { charLevel: 30 });
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(0, 0, 30), { charLevel: 30 });
    assert.ok(ship.alarm.at != null, 'its beat armed at the admission');
    await ship.raw(alice, word('in', { lv: 30 }));
    assert.deepEqual(kt(alice, 'no').map((m) => m.m), [2], 'no brain number: an older Ketch');
    const before = alice.sent.length;
    await ship.raw(alice, word('pick', { c: 0 }));
    await ship.raw(alice, word('in', { lv: 30, bv: 1 }));
    assert.equal(alice.sent.filter((m) => m.t === 'kt').length, kt(alice).length);
    assert.equal(alice.sent.length, before, 'off its stage: nothing said');
    await ship.pose(alice, at(0, 0, 30)); await ship.pose(bob, at(0, 0, 30));
    step(250); await ship.fire();
    const waves = kt(bob, 'wave');
    assert.deepEqual(waves.map((m) => m.w), [1], 'the first wave, to the whole crew');
    assert.ok(kt(bob, 'nb').length >= 3);
    assert.ok(ship.alarm.at != null, 'beating while a member stands aboard');
  });
});

test('KETCH THE FRAMES IN THEIR ORDER: a frame for one member said after every frame before it - a fight begun (`wf`) before the joiner\'s own `ws` - never ahead of them (AUDIT SHIP 7; mutants: a member\'s own frame said first)', async () => {
  await withShip(async ({ ship }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30), { charLevel: 30 });
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(0, 0, 30), { charLevel: 30 });
    const from = alice.sent.length;
    ship.room._ktFan([{ k: 'wf', fi: 1, at: 1 }, { k: 'ws', to: 'acct-alice', me: 1 }, { k: 'wl', at: 2 }]);
    assert.deepEqual(alice.sent.slice(from).filter((m) => m.t === 'kt').map((m) => m.k), ['wf', 'ws', 'wl']);
    assert.deepEqual(kt(bob).slice(-2).map((m) => m.k), ['wf', 'wl'], 'hers alone');
  });
});

test('KETCH THE VOYAGE KEPT AS IT MOVES: a word the brain refuses writes nothing; a stage the beat reaches is written at once, not at the next checkpoint (AUDIT KETCH L1-9, L1-10; mutants: a refused word written; a stage left to the checkpoint)', async () => {
  await withShip(async ({ ship, step, now }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30), { charLevel: 30 });
    const put = ship.state.storage.put.bind(ship.state.storage);
    let writes = 0;
    ship.state.storage.put = async (...a) => { writes++; return put(...a); };
    for (let k = 0; k < 16; k++) await ship.raw(alice, word('pick', { c: 0 }));
    assert.equal(writes, 0, 'sixteen picks off their stage: nothing written');
    const V = ship.room._kt;
    V.sg = KT_STAGE.sailwalk; V.sgAt = now() - KT_SAILWALK_LEAST_MS - 1000;
    await ship.pose(alice, at(KT_GANGWAY.ax, 0, KT_GANGWAY.az));
    ship.room._ktSavedAt = now();   // a checkpoint just written: an unforced save waits
    step(250); await ship.fire();
    assert.equal(V.sg, KT_STAGE.bridge, 'the bridge reached');
    assert.equal(ship.store.get(KT_VOYAGE_KEY).sg, KT_STAGE.bridge, 'and kept at once');
  });
});

test('KETCH THE FALL: its receipts minted for each earner once, kept before they are said, handed to each earner aboard - and again at a late hello; nobody else\'s (mutants: the receipt to every socket; a late hello untold)', async () => {
  await withShip(async ({ ship, step, now }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 200), { charLevel: 30 });
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(0, 0, 200), { charLevel: 30 });
    const V = ship.room._kt;
    // the ship carried to its bridge's fight, alice the fight's only fighter, the Warden falling
    V.sg = KT_STAGE.bridge; V.bridge = { at: now(), by: 'alice' };
    V.wf = KETCH_SEAM.new({ room: V.key, fi: 1, now: now() });
    KETCH_SEAM.join(V.wf, 'acct-alice', 'alice', 30, now());
    V.wf.players['acct-alice'].dealt = V.wf.players['acct-alice'].share;
    V.wf.liveMs = 60_000;
    V.wf.fell = { at: now(), top: ['alice'], n: 1 };
    await ship.pose(alice, at(0, 0, 200)); await ship.pose(bob, at(0, 0, 200));
    step(250); await ship.fire();
    assert.ok(kt(alice, 'fell').length === 1 && kt(bob, 'fell').length === 1, 'said to the crew');
    assert.ok(kt(bob, 'sg').some((m) => m.sg === KT_STAGE.vault));
    const r = kt(alice, 'rcpt');
    assert.equal(r.length, 1);
    const c = readKetchReceipt(r[0].r);
    assert.deepEqual([c.d, c.b, c.o, c.s, c.x, c.l], [1, 'warden', V.owner, 'acct-alice', 'dealt', 30]);
    assert.equal(kt(bob, 'rcpt').length, 0, 'bob stood off the fight: none');
    assert.equal(ship.store.get(KT_VOYAGE_KEY).said, true, 'kept before it is said');
    step(250); await ship.fire();
    assert.equal(kt(alice, 'rcpt').length, 1, 'once');
    assert.equal(ship.alarm.at, V1.endAt, 'the fall said: the beat rests till her end (AUDIT KETCH L1-11)');
    const late = ship.connect(); await ship.hello(late, 'alice', at(0, 0, 200));
    assert.deepEqual(kt(late, 'rcpt').map((m) => m.r), [r[0].r], 'handed again at a late hello');
  });
});

test('KETCH THE HUB KEEPS THE RECEIPTS: the fall told to the hub, which keeps each earner\'s for its life and hands it to the account\'s hub socket at once and at every hello - an earner off the ship who never boards her again still has it; its account\'s `spent` word stands over it, from the hub alone (AUDIT KETCH L1-2; mutants: the hub never told; a spent receipt handed again; a ship\'s room keeping a spent word)', async () => {
  await withShip(async ({ ship, hub, step, now }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 200), { charLevel: 30 });
    const V = ship.room._kt;
    V.sg = KT_STAGE.bridge; V.bridge = { at: now(), by: 'alice' };
    V.wf = KETCH_SEAM.new({ room: V.key, fi: 1, now: now() });
    KETCH_SEAM.join(V.wf, 'acct-alice', 'alice', 30, now());
    V.wf.players['acct-alice'].dealt = V.wf.players['acct-alice'].share;
    V.wf.liveMs = 60_000;
    V.wf.fell = { at: now(), top: ['alice'], n: 1 };
    await ship.drop(alice);   // off the ship at the fall - and she never boards again
    const away = hub.connect(); await hub.hello(away, 'alice');
    const before = away.sent.length;
    step(250); await ship.fire();
    assert.equal(V.told, true, 'the hub told');
    const kept = hub.store.get(ketchReceiptKey('acct-alice'));
    assert.deepEqual([kept?.n, typeof kept?.r], [1, 'string'], 'kept at the hub');
    assert.deepEqual(away.sent.slice(before).filter((m) => m.t === 'kt' && m.k === 'rcpt').map((m) => m.r), [kept.r], 'handed to her hub socket at once');
    const later = hub.connect(); await hub.hello(later, 'alice');
    assert.deepEqual(kt(later, 'rcpt').map((m) => m.r), [kept.r], 'and at her next hello');
    await hub.raw(later, word('spent', { n: 1 }));
    assert.equal(hub.store.get(ketchReceiptKey('acct-alice')).spent, true, 'its share given: spent');
    const again = hub.connect(); await hub.hello(again, 'alice');
    assert.equal(kt(again, 'rcpt').length, 0, 'never handed again');
    const aboard = ship.connect(); await ship.hello(aboard, 'alice', at(0, 0, 200));
    await ship.raw(aboard, word('spent', { n: 1 }));
    assert.ok(!ship.store.has(ketchReceiptKey('acct-alice')), 'a ship\'s room keeps no spent word');
  });
});

test('KETCH THE VOYAGE GONE: past its crews\' last minutes every socket aboard is told and closed; a word in its last minutes is answered `no` once it holds no crew (mutants: a ship outliving its voyage)', async () => {
  await withShip(async ({ ship, set }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30));
    assert.ok(ship.store.get(KT_VOYAGE_KEY));
    set(V1.endAt + 1);
    await ship.fire();
    assert.equal(refusal(alice), KT_TEXT.refuse.gone);
    assert.equal(ship.store.get(KT_VOYAGE_KEY), undefined, 'her record goes with her (AUDIT KETCH L1-11)');
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(0, 0, 30));
    assert.equal(refusal(bob), KT_TEXT.refuse.gone, 'nobody once she is gone');
  });
});
