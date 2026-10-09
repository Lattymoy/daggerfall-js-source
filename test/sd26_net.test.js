// SD26 - AUDIT SD IV, the net lifecycle, the fight's laws and the relay lens (bible/11-Multiplayer/Super-Dungeons.md).
// SD-HELLO held `_send` and the realm's own words behind the welcome, and the rest of the page's senders wrote their
// socket directly: a look, every directed frame (`_socketFor`: trade, cast, card, page, duel, wed), a `who` and the
// parked team's word went down a realm socket before its welcome - each a frame before hello, refused for good, and the
// page cast out of the Hour. The park word went on EVERY entry: world.js says it again in every room joined.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession } from '../src/net/online.js';
import { RELAY_VERSION, WHO_RETRY_MS, parseClient, validSdOut, SD_KEY, SOCIAL_ROOM, PIXEL_UNITS, worldRoom, chatRegionRoom } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { fakeRooms } from './fakeRoom.mjs';
import { SD_BLOWS, SD_BODY, SD_STUN_MS, SD_LOST_MS, SD_POSE_FRESH_MS, newRemnantFight, joinRemnant, stepRemnant, remnantStateOf, applyHeartHit, applyRemnantHit, heartsOpen } from '../src/net/sdRemnant.js';
import { HIT_KINDS, STATE_SEND_MS } from '../src/net/gateBrain.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { createSdFightLink, SD_OWED_MAX, SD_FIGHT_HEARD_MS, SD_IN_RETRY_MS } from '../src/net/sdFightLink.js';
import { createSdRemnantBlows, sdBlowsInFlight } from '../src/scenes/sdRemnantBlows.js';

const T0 = 1_800_000_000_000;
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 2, items: [] };
const HELM = { ...LOOK, items: [{ templateIndex: 102, group: 'Armor', material: 0, dye: 0, variant: 0, equipSlot: 1 }] };
const pose = (x) => ({ x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 });
const HEAL = { name: 'Heal', element: 4, rangeType: 1, icon: 0, effects: [{ type: 9, subType: -1 }] };
/** A session over fake sockets on a clock the test turns; console.info quiet. */
function session() {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: T0 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', look: LOOK, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  return { s, sockets, clock };
}
const quiet = (fn) => { const i = console.info; console.info = () => {}; try { return fn(); } finally { console.info = i; } };
const kinds = (ws) => ws.sent.map((x) => JSON.parse(x).t).filter((t) => t !== 'ping');   // the runtime's own, never the room's
/** What the relay's own parse says of each frame a socket sent while it had no name (its hello awaiting the hub). */
const beforeHello = (ws) => ws.sent.map((x) => parseClient(x, { hasHello: false })).filter((m) => m.t !== 'hello' && m.t !== 'ping').map((m) => m.error ?? m.t);

test('AUDIT SD IV (0): A REALM SOCKET BLINKS, AND ITS RETRY SAYS NOTHING PAST ITS HELLO UNTIL ITS WELCOME - a look, an ally\'s heal, a card, a `who` all held (the relay would refuse each as before hello, and the page be cast out); the peer still reached (a trade is not ended by a hello\'s round trip); the welcome lets each go, the look once (mutants SD26-0-directed-ungated, SD26-0-reach-welcomed-only, SD26-0-look-ungated, SD26-0-look-dropped, SD26-0-who-ungated)', () => {
  const { s, sockets, clock } = session();
  quiet(() => {
    s.join('sd:7', pose(0));
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [{ id: 'bob-0001', name: 'Bob', look: LOOK, pose: pose(3) }] });
    sockets[0].receive({ t: 'pose', id: 'zed-0001', p: pose(4) });   // a stranger stood by its pose, not yet introduced
  });
  assert.equal(s.lookOk && s.castOk && s.cardOk, true, 'the first welcome said this relay knows each frame');
  sockets[0].drop(1006);   // the blink: the roster kept on purpose (SLAM12)
  clock.now += 10_000; quiet(() => s.tick(clock.now));
  const ws = sockets[1];
  assert.ok(ws, 'the retry opened a socket'); ws.open();
  assert.equal(s.status, 'open'); assert.deepEqual(kinds(ws), ['hello']);
  clock.now += WHO_RETRY_MS + 1;
  assert.equal(s.setLook(HELM), true, 'the look changed');
  quiet(() => s.tick(clock.now));   // the tick's flush and the who round
  assert.equal(s.sendCast({ to: 'bob-0001', level: 30, spell: HEAL }), false, 'no heal down an unwelcomed socket');
  assert.equal(s.sendCard({ to: 'bob-0001', ask: true }), false, 'nor a card');
  assert.equal(s.reachesPeer('bob-0001'), true, 'Bob is still reached - a socket that said its hello counts');
  assert.deepEqual(kinds(ws), ['hello'], 'nothing past the hello');
  assert.deepEqual(beforeHello(ws), []);
  quiet(() => ws.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [{ id: 'bob-0001', name: 'Bob', look: LOOK, pose: pose(3) }] }));
  quiet(() => s.tick(clock.now));
  assert.equal(s.sendCast({ to: 'bob-0001', level: 30, spell: HEAL }), true, 'welcomed: the heal goes');
  assert.equal(s.sendCard({ to: 'bob-0001', ask: true }), true);
  const sent = ws.sent.map((x) => JSON.parse(x));
  assert.deepEqual(sent.filter((f) => f.t === 'look').map((f) => f.look), [s.look], 'the held look went once the socket was welcomed, the latest');
  assert.deepEqual(sent.filter((f) => f.t === 'who').map((f) => f.id), ['zed-0001'], 'and the stranger is asked for');
});

test('AUDIT SD IV (0): THE PARKED TEAM\'S WORD IS SAID IN EVERY ROOM JOINED, AND THE REALM IS A ROOM - from a cell into the Hour it waits for the realm\'s welcome (it went on the first frame after the hello: park before hello, every entry); a halo\'s cell not yet welcomed takes no record, the anchor goes down mine (mutants SD26-0-park-ungated, SD26-0-park-halo-ungated)', () => {
  const { s, sockets, clock } = session();
  quiet(() => {
    s.join('world:100,200', pose(0));
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] });
  });
  assert.equal(s.parkOk, true);
  // a halo opening on the next cell: its hello said, its welcome not yet come
  quiet(() => s.setHalo(['world:101,200']));
  const halo = sockets[1]; halo.open();
  assert.deepEqual(kinds(halo), ['hello']);
  assert.equal(s.sendPark({ c: 'char-0001', a: [1601, 3201] }, 'world:101,200'), 'room', 'the anchor alone, down my own welcomed socket');
  assert.deepEqual(kinds(halo), ['hello'], 'nothing down the halo before its welcome');
  assert.deepEqual(beforeHello(halo), []);
  quiet(() => halo.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] }));
  assert.equal(s.sendPark({ c: 'char-0001', a: [1601, 3201] }, 'world:101,200'), 'cell', 'welcomed: the cell keeps it');
  // into the Hour
  quiet(() => s.join('sd:7', pose(0)));
  const realm = sockets.at(-1); realm.open();
  assert.equal(s.status, 'open');
  clock.now += 1_000;   // the park bucket full again: what holds the word below is the welcome alone
  assert.equal(s.sendPark({ c: 'char-0001' }), false, 'the realm has not welcomed me: nothing said');
  assert.deepEqual(kinds(realm), ['hello']);
  assert.deepEqual(beforeHello(realm), []);
  quiet(() => realm.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] }));
  clock.now += 1_000;   // the park bucket's
  assert.equal(s.sendPark({ c: 'char-0001' }), 'room', 'welcomed: said');
});

test('AUDIT SD IV (0): A HALO MID-HELLO HOLDS THE LOOK ON EVERY SOCKET - the halo said its hello in the look before, and a look down it now is a look before hello; its welcome lets the latest go down both (mutant SD26-0-look-halo-ungated)', () => {
  const { s, sockets, clock } = session();
  quiet(() => {
    s.join('world:100,200', pose(0));
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] });
    s.setHalo(['world:101,200']);
  });
  const halo = sockets[1]; halo.open();
  assert.equal(s.setLook(HELM), true);
  clock.now += 5_000; quiet(() => s.tick(clock.now));
  assert.deepEqual(kinds(sockets[0]).filter((t) => t === 'look'), [], 'held on my own socket too');
  assert.deepEqual(kinds(halo), ['hello']);
  quiet(() => halo.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [] }));
  quiet(() => s.tick(clock.now));
  assert.deepEqual(kinds(sockets[0]).filter((t) => t === 'look'), ['look']);
  assert.deepEqual(kinds(halo).filter((t) => t === 'look'), ['look']);
});

// ── AUDIT SD IV (5): the whole arena's blows, however late ──────────────────────────────────────────────────────────
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
/** THE LAW, THE LINK AND THE BLOWS DRIVER over one fight, a fighter alone 22 m south of the Remnant (only the whole arena's
 *  blows reach): the realm's beat every 250 ms, each word through the wire's own projection into the link as online.js
 *  delivers it - hidden or not - and a frame every 50 ms but while `hidden(t)` (t from the fight's opening). `beat(f, now)`
 *  the frames the relay fans beside the beat's; `drop(w)` a word the page never heard; `hurt` the blow whose strikes take health. */
function hour({ phase3 = false, endsIn = null, noPulse = false, hidden = () => false, beat = () => [], drop = () => false, hurt = null, ms = 70_000 } = {}) {
  let clock = T0;
  const f = newRemnantFight(1, 1, clock, null);
  joinRemnant(f, 'a', 'A', 20, clock);
  if (phase3) { f.phase = 3; f.hp = 0.3 * f.max; f.outUntil = 0; f.resetAt = f.op + 20_000; }
  if (endsIn != null) f.endsAt = f.op + endsIn;
  if (noPulse) f.pulseAt = f.op + 1e9;
  const link = createSdFightLink({ now: () => clock });
  link.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  const me = { maxHealth: 1000, health: 1000 };
  const feet = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z - 22);
  const struck = [], back = [], landed = {};
  const blows = createSdRemnantBlows({ link, feet: () => feet, player: () => me, strike: (d, how) => { if (how.name === hurt?.name) me.health = Math.max(0, me.health - d); struck.push({ name: how.name, t: clock - f.op, hp: me.health }); } });
  const rng = seeded(5);
  let away = false;
  for (let t = 0; t < ms; t += 50) {
    clock += 50;
    if (t % 250 === 0) {
      for (const w of [...stepRemnant(f, clock, me.health > 0 ? [{ sub: 'a', x: 0, z: -22, dead: false }] : [], rng), ...beat(f, clock)]) {
        if (w.k === 'atk') landed[w.i] = { a: w.a, at: w.at - f.op };
        if (!drop(w)) link.word(validSdOut(w));
      }
    }
    if (hidden(clock - f.op) || !(me.health > 0)) { away = true; continue; }
    if (away) { away = false; back.push({ t: clock - f.op, inFlight: sdBlowsInFlight(link.state()).map((x) => x.atk.i) }); }
    blows.frame();
  }
  return { f, link, struck, back, landed, me };
}
const firstOf = (r, A) => Object.entries(r.landed).find(([, x]) => x.a === A.id);
const named = (r, A) => r.struck.filter((s) => s.name === A.name);

test('AUDIT SD IV (5): A TAB HIDDEN ACROSS A LANDING IS STRUCK WHEN IT COMES BACK - law, link and driver: the Pulse\'s `clk` and the Reset\'s blow gone from the fight\'s state seconds after they land (the next `st`, the next blow), and SD20a F3\'s "however late" held only while the state kept them; each is owed by its number and judged once on the first frame back, however long the tab was away; seen live, once (mutants SD26-5-never-owed, SD26-5-driver-owes-nothing, SD26-5-reset-not-owed, SD26-5-never-paid)', () => {
  for (const [A, phase3] of [[SD_BLOWS.pulse, false], [SD_BLOWS.reset, true]]) {
    const live = hour({ phase3 });
    const [i, x] = firstOf(live, A);
    assert.deepEqual(named(live, A).slice(0, 1).map((s) => s.t), [x.at], `${A.key}: seen live, struck as it lands`);
    assert.equal(named(live, A).filter((s) => s.t < x.at + 5000).length, 1, `${A.key}: once`);
    for (const away of [7_000, 25_000]) {
      const r = hour({ phase3, hidden: (t) => t >= x.at - 500 && t < x.at - 500 + away });
      const b = r.back.find((y) => y.t >= x.at);
      assert.ok(!b.inFlight.includes(Number(i)), `${A.key}, ${away / 1000} s away: the state let it go before I came back`);
      assert.deepEqual(named(r, A).filter((s) => s.t < x.at + away).map((s) => s.t), [b.t], `${A.key}, ${away / 1000} s away: struck once, on the first frame back`);
      assert.deepEqual(r.link.owed(), [], 'and paid');
    }
  }
});

test('AUDIT SD IV (5): THE HOUR\'S END THROUGH ITS LOSS - a tab hidden from a second before the End until the fight is lost comes back to its strikes, one after another until it falls, and none past its fall (mutant SD26-5-struck-dead)', () => {
  const r = hour({ endsIn: 20_000, noPulse: true, hurt: SD_BLOWS.end, hidden: (t) => t >= 19_000 && t < 52_000 });
  assert.ok(r.f.lost, 'the fight was lost while the tab was away');
  assert.ok(r.link.state().lost, 'the page heard it');
  const ends = named(r, SD_BLOWS.end);
  assert.ok(ends.length >= 1 && ends.every((s) => s.t === 52_000), 'struck on the first frame back');
  assert.equal(r.me.health, 0, 'the End killed');
  assert.deepEqual(ends.map((s) => s.hp === 0), [...ends.slice(1).map(() => false), true], 'and nothing struck the fallen');
});

test('AUDIT SD IV (5): WHAT THE LAW TOOK OUT OF FLIGHT IS OWED NOTHING - a Reset broken by its stun (heard, or told only by the next `st` after a reconnect), one the End\'s word called off, a Pulse winding up as the Remnant fell; the rest of the Hour\'s own still struck (mutants SD26-5-stun-ignored, SD26-5-stun-by-its-end-ignored, SD26-5-end-ignored, SD26-5-fell-ignored)', () => {
  const RESET_AT = 30_550;
  const breakHearts = (f, now) => {
    if (!f.cx || !heartsOpen(f, now)) return [];
    f.players.a.bucket = 1e9;
    const out = [];
    f.cx.c.forEach((q, c) => { out.push(...applyHeartHit(f, 'a', c, 1e6, HIT_KINDS.Spell, { x: q.x, z: q.z }, now + c, 100 + c)); });
    return out;
  };
  const awayReset = (t) => t >= RESET_AT - 9_000 && t < RESET_AT + 7_000;
  assert.equal(firstOf(hour({ phase3: true }), SD_BLOWS.reset)[1].at, RESET_AT, 'the Reset this fight calls');
  assert.equal(named(hour({ phase3: true, hidden: awayReset }), SD_BLOWS.reset).length, 1, 'control: unbroken, it lands on the tab that comes back');
  const stunned = hour({ phase3: true, hidden: awayReset, beat: breakHearts });
  assert.ok(stunned.f.stunUntil > 0, 'every Heart broken: stunned');
  assert.deepEqual(named(stunned, SD_BLOWS.reset), [], 'a broken Reset never lands');
  const told = hour({ phase3: true, hidden: awayReset, beat: breakHearts, drop: (w) => w.k === 'stun' || w.k === 'cxb' });
  assert.deepEqual(named(told, SD_BLOWS.reset), [], 'the stun said by the next `st` alone: its end less its span is its moment');
  assert.deepEqual(told.link.owed(), []);
  // the End said inside the Reset's wind-up calls it off
  const ended = hour({ phase3: true, endsIn: 30_000, noPulse: true, hidden: (t) => t >= 22_000 && t < 40_000 });
  assert.ok(firstOf(ended, SD_BLOWS.reset), 'the Reset was called');
  assert.deepEqual(named(ended, SD_BLOWS.reset), [], 'and the End took it');
  assert.ok(named(ended, SD_BLOWS.end).length >= 1, 'the End struck');
  // the Remnant falls inside a Pulse's wind-up
  const fall = (f, now) => {
    if (f.fell || !f.clock || f.clock.a !== SD_BLOWS.pulse.id || now >= f.clock.at) return [];
    f.hp = 1; f.players.a.bucket = 1e9;
    applyRemnantHit(f, 'a', 1e6, HIT_KINDS.Spell, { x: f.rem.x, z: f.rem.z - 3 }, now, 900);
    return f.fell ? [{ k: 'fell', at: f.fell.at, top: f.fell.top, n: f.fell.n }] : [];
  };
  const fell = hour({ phase3: true, noPulse: false, hidden: (t) => t >= 27_000 && t < 40_000, beat: fall });
  assert.ok(fell.f.fell, 'it fell');
  assert.deepEqual(named(fell, SD_BLOWS.pulse), [], 'its Pulse never landed');
});

test('AUDIT SD IV (5): THE LINK\'S OWED BLOWS - the whole arena\'s alone, by number, while the realm counts me; a stun takes a Reset landing after it and not one landed before; the End\'s word the Reset after its saying; the fall and the loss what lands past them; a fresh fight the last one\'s; a page not counted owes nothing; bounded (mutants SD26-5-uncounted-owed, SD26-5-lost-ignored, SD26-5-fight-carried, SD26-5-unbounded)', () => {
  let clock = T0;
  const f = newRemnantFight(1, 1, clock, null);
  joinRemnant(f, 'a', 'A', 20, clock);
  f.phase = 3; f.hp = 0.3 * f.max;
  const st = (o = {}) => validSdOut({ ...remnantStateOf(f), ...o });
  const atk = (b, A, i, at) => validSdOut({ k: 'atk', b, i, a: A.id, at, x: 0, z: 0, yw: 0, tg: [] });
  const ids = (L) => L.owed().map((o) => o.atk.i);
  const counted = () => { const L = createSdFightLink({ now: () => clock }); L.word(st({ me: 1 })); return L; };
  const A0 = f.op + 20_000;
  // not counted: nothing owed
  const guest = createSdFightLink({ now: () => clock });
  guest.word(st()); guest.word(atk(SD_BODY.hour, SD_BLOWS.pulse, 5, A0));
  assert.deepEqual(ids(guest), [], 'a page the realm never counted owes nothing');
  // the whole arena's alone, by number
  let L = counted();
  L.word(atk(SD_BODY.remnant, SD_BLOWS.stomp, 4, A0 - 3000));
  L.word(atk(SD_BODY.hour, SD_BLOWS.pulse, 5, A0 - 2000));
  L.word(atk(SD_BODY.remnant, SD_BLOWS.reset, 6, A0));
  L.word(atk(SD_BODY.hour, SD_BLOWS.pulse, 5, A0 - 2000));
  assert.deepEqual(ids(L), [5, 6]);
  // a stun after the Pulse landed and before the Reset does: the Reset alone goes
  L.word(validSdOut({ k: 'stun', at: A0 - 1000, until: A0 - 1000 + SD_STUN_MS }));
  assert.deepEqual(ids(L), [5]);
  L.paid(5);
  assert.deepEqual(ids(L), [], 'paid');
  // the End said: a Reset landing after its saying goes, one landing before stays
  L = counted();
  L.word(atk(SD_BODY.remnant, SD_BLOWS.reset, 6, A0));
  L.word(atk(SD_BODY.hour, SD_BLOWS.end, 7, A0 + SD_BLOWS.end.windup + 1));
  assert.deepEqual(ids(L), [6, 7], 'said a moment after the Reset lands: owed');
  L = counted();
  L.word(atk(SD_BODY.remnant, SD_BLOWS.reset, 6, A0));
  L.word(atk(SD_BODY.hour, SD_BLOWS.end, 7, A0 + SD_BLOWS.end.windup - 1));
  assert.deepEqual(ids(L), [7], 'said before: called off');
  // the loss: what lands past it goes
  L = counted();
  L.word(atk(SD_BODY.hour, SD_BLOWS.end, 7, A0));
  L.word(atk(SD_BODY.hour, SD_BLOWS.end, 8, A0 + 2000));
  L.word(validSdOut({ k: 'lost', at: A0 + 1000 }));
  assert.deepEqual(ids(L), [7]);
  // a fresh fight: the last one's go
  f.fi = 2;
  L.word(st({ me: 1 }));
  assert.deepEqual(ids(L), [], 'a fresh fight owes nothing of the last');
  // bounded
  for (let k = 0; k < SD_OWED_MAX + 3; k++) L.word(atk(SD_BODY.hour, SD_BLOWS.pulse, 100 + k, A0 + k));
  assert.equal(L.owed().length, SD_OWED_MAX);
  assert.equal(ids(L)[0], 103, 'the oldest go first');
  L.leave();
  assert.deepEqual(ids(L), []);
});

// ── AUDIT SD IV (8): a fight lost where no socket of mine heard it ──────────────────────────────────────────────────
const PX = 300, PY = 200;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * (PIXEL_UNITS / PIXEL_M), y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -12) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0 }; };
const hush = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
/** The fake world driven to a FOUND Hollow and its realm standing, past the Orrery (sd20a_fight.test.js's). */
async function withRealm(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await hush(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room(chatRegionRoom(17)); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h);
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      const hello = async (id, pose) => { const ws = realm.connect(); await realm.hello(ws, id, pose, { name: id.replace('peer-', '') }); return ws; };
      await fn({ realm, beat, hello, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
/** A page in the Hour: its own fight link, fed every fight word a socket of its heard (wire.js validSdOut, as net/online.js
 *  routes them), and its `in` said when the link says it is due, as scenes/sdRemnant.js says it (from the arena). */
function hourPage(realm, now) {
  const link = createSdFightLink({ now });
  const read = new Map();
  return {
    link,
    hear(ws) {
      for (const m of ws.sent.slice(read.get(ws) ?? 0)) { const w = m.t === 'sd' ? validSdOut(m) : null; if (w && w.k !== 'pz' && w.k !== 'rcpt' && w.k !== 'ev') link.word(w); }
      read.set(ws, ws.sent.length);
    },
    /** What `ws` said so far never reached the page. */
    skip(ws) { read.set(ws, ws.sent.length); },
    async frame(ws) { this.hear(ws); if (link.inDue(now())) { await realm.raw(ws, JSON.stringify({ t: 'sd', k: 'in', lv: 30, bv: 1 })); link.sentIn(now()); } this.hear(ws); },
  };
}

test('AUDIT SD IV (8): A COUNTED PAGE BACK FROM A LOST FIGHT IS NOT LEFT IN IT - the realm\'s hello says nothing of a fight lost (stale at the hello, or lost by the beat into a socket that was half-open), so the page stayed counted in a dead fight, its `in` never due, its blows landing on nothing; a fight unheard SD_FIGHT_HEARD_MS makes its `in` due, and the realm answers with a fresh fight that counts it. A living fight\'s silence costs one `in`: the same fight answers (mutants SD26-8-silence-ignored, SD26-8-span)', async () => {
  assert.equal(SD_FIGHT_HEARD_MS, 3 * STATE_SEND_MS, 'three of a living fight\'s whole states');
  assert.equal(SD_FIGHT_HEARD_MS, 15_000);
  for (const how of ['stale at the hello', 'lost into a half-open socket']) {
    await withRealm(async ({ realm, beat, hello, now }) => {
      const ann = hourPage(realm, now);
      let ws = await hello('peer-ann', inArenaAt());
      for (let k = 0; k < 24; k++) { await realm.pose(ws, inArenaAt()); await ann.frame(ws); await beat(500); }
      assert.equal(ann.link.state().fi, 1); assert.equal(ann.link.joined(), true, `${how}: counted in fight 1`);
      if (how === 'stale at the hello') { await realm.drop(ws); await beat(40_000); }
      else {   // the relay holds the socket; the page hears none of it and poses nothing - its fight lost by emptiness
        await beat(SD_POSE_FRESH_MS + SD_LOST_MS + 5_000);
        assert.ok(ws.sent.some((m) => m.t === 'sd' && m.k === 'lost'), 'the loss went down the socket the page lost');
      }
      ws = await hello('peer-ann', inArenaAt());
      ann.hear(ws);
      assert.ok(realm.room._sdFight.lost, `${how}: the realm's fight is lost`);
      assert.equal(ann.link.state().lost, 0, `${how}: and the page was never told`);
      for (let k = 0; k < 8; k++) { await realm.pose(ws, inArenaAt()); await ann.frame(ws); await beat(500); }
      assert.equal(realm.room._sdFight.fi, 2, `${how}: its \`in\` made a fresh fight`);
      assert.deepEqual([ann.link.state().fi, ann.link.joined()], [2, true], `${how}: and the page is counted in it`);
    });
  }
  // a living fight the page missed a while of: one `in`, the same fight answers
  await withRealm(async ({ realm, beat, hello, now }) => {
    const ann = hourPage(realm, now);
    const ws = await hello('peer-ann', inArenaAt());
    for (let k = 0; k < 24; k++) { await realm.pose(ws, inArenaAt()); await ann.frame(ws); await beat(500); }
    for (let k = 0; k < 16; k++) { await realm.pose(ws, inArenaAt()); await beat(1000); }   // still posing; its fight's words lost on the way
    ann.skip(ws);
    assert.equal(ann.link.inDue(now()), true, 'a living fight unheard the span: my `in` is due');
    await ann.frame(ws);
    assert.equal(realm.room._sdFight.fi, 1, 'the same fight answers it');
    assert.deepEqual([ann.link.state().fi, ann.link.joined(), ann.link.inDue(now())], [1, true, false], 'counted in it, and held again');
  });
});

test('AUDIT SD IV (8): THE LINK\'S SILENCE - a counted fight heard holds my `in`; unheard SD_FIGHT_HEARD_MS, it does not; an Hour Ended likewise; a fallen fight never (it beats no more); a refusal said in a fight gone silent lapses, one for good never, and one said before any fight was heard stands however long (mutants SD26-8-refusal-holds, SD26-8-silent-before-any-fight, SD26-8-ended-holds, SD26-8-fallen-silent-due)', () => {
  let clock = T0;
  const f = newRemnantFight(1, 1, clock, null);
  joinRemnant(f, 'a', 'A', 20, clock);
  const L = createSdFightLink({ now: () => clock });
  L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  L.sentIn(clock);
  assert.equal(L.inDue(clock + SD_FIGHT_HEARD_MS - 1), false, 'counted, heard: held');
  assert.equal(L.inDue(clock + SD_FIGHT_HEARD_MS), true, 'unheard the span: due');
  clock += 10_000; L.word(validSdOut({ k: 'hp', h: 1, m: 2 }));
  assert.equal(L.inDue(clock + SD_FIGHT_HEARD_MS - 1), false, 'any word heard holds it again');
  // the End: refused to a newcomer, held while it beats, not once silent
  const E = createSdFightLink({ now: () => clock });
  E.word(validSdOut({ ...remnantStateOf(f), ended: clock }));
  assert.equal(E.inDue(clock + SD_IN_RETRY_MS), false, 'an Hour Ended heard: no `in`');
  assert.equal(E.inDue(clock + SD_FIGHT_HEARD_MS), true, 'gone silent: the next is fresh');
  // fallen: it beats no more, and its silence is no loss
  const F = createSdFightLink({ now: () => clock });
  F.word(validSdOut({ ...remnantStateOf(f), me: 1, fell: { at: clock, top: [], n: 1 } }));
  assert.equal(F.inDue(clock + 10 * SD_FIGHT_HEARD_MS), false, 'a fallen fight: never');
  // refusals
  const R = createSdFightLink({ now: () => clock });
  R.word(validSdOut({ ...remnantStateOf(f) }));
  R.word(validSdOut({ k: 'no', m: 'the arena is full' }));
  assert.equal(R.inDue(clock + SD_IN_RETRY_MS), false, 'refused while the fight stands');
  assert.equal(R.inDue(clock + SD_FIGHT_HEARD_MS), true, 'the fight gone silent: the refusal lapses');
  const G = createSdFightLink({ now: () => clock });
  G.word(validSdOut({ ...remnantStateOf(f) }));
  G.word(validSdOut({ k: 'no', m: 'the Hour has closed' }));
  assert.equal(G.inDue(clock + 10 * SD_FIGHT_HEARD_MS), false, 'one for good: never');
  const N = createSdFightLink({ now: () => clock });
  N.word(validSdOut({ k: 'no', m: 'the arena is full' }));
  assert.equal(N.inDue(clock + 10 * SD_FIGHT_HEARD_MS), false, 'refused before any fight was heard: no silence to read - it stands');
});
