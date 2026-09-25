// EVENT1 — A LIVE EVENT, STAGED FOR EVERYONE ONLINE: THE DREAD (2026-09-25).
//
// Mac: "I wanna do a fun live event for the server. Wanna setup the infastructure for this without breaking
// anything. ... turn the skies of Daggerfall into a detailed oblivion styled dread in prep for the world bosses. Red
// lightning and such." Asked how it is switched: a staff command (/event dread on|off, the dev glyph, as /red) -
// and who sees it: online players only.
//
// THE PINS, BY THE DOOR THEY GUARD:
//   the wire     - the `stage` frame's shape, the event words, the version gate an old relay needs
//   the relay    - a REAL Room with a REAL key: only a dev, only in the hub; kept in storage past a drain; said to a
//                  late joiner on the hub welcome; ended by a dev; metered
//   the session  - the hub's word handed on once per change, a welcome's whole and a frame's faded; sent only to a
//                  relay that knows the frame, only on the hub
//   the command  - /event's grammar
//   the look     - the grade (the JS law and its GLSL twin from the same numbers), the fade, the red storm's shared
//                  schedule, its coloured channel and light through the weather's own bolt field
//   the host     - the sky controller grades every pass and wears the storm's word; world.js reads the hub alone
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { parseClient, chatRegionRoom, LIVE_EVENTS, EVENT_KEY, EVENT_HZ_MAX, EVENT_RELAY_MIN, eventGate, relaySupportsEvent, validLiveEvent, RELAY_VERSION, CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { parseEventCommand, HOST_COMMANDS, HELP_LINES } from '../src/net/chatCommands.js';
import {
  DREAD_EVENT, DREAD_FADE_S, DREAD_RAMP, DREAD_DIM, DREAD_GLSL, DREAD_SKY_WORD, DREAD_BOLT_COLOR, DREAD_FLASH_COLOR,
  DREAD_SLOT_MS, DREAD_STRIKE_CHANCE, DREAD_SLOTS_MAX, DREAD_NEAR_M, DREAD_FAR_M, DREAD_KEY_DIM, DREAD_CLOUD_GLOW,
  dreadRamp, dreadGrade, createDread, dreadStrikes, createDreadStorm, dreadLight, dreadCloudGlow,
} from '../src/world/dreadSky.js';
import { createBoltField, createStormLights, FLASH_COLOR } from '../src/systems/lightning.js';
import { boltGroups, BOLT_COLOR } from '../src/render/lightningBolts.js';
import { thunderOf } from '../src/systems/distantStorms.js';
import { COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../src/render/volumetricClouds.js';
import { UNIFORM_NAMES as DYNAMIC_UNIFORMS, FS as DYNAMIC_FS } from '../src/render/dynamicSkiesRenderer.js';
import { relayVersionAtLeast } from './relayVersion.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const stage = (kind) => JSON.stringify({ t: 'stage', kind });

// ── THE WIRE ─────────────────────────────────────────────────────────

test('EVENT1 wire: `stage` is a known event word or "" (the end), after a hello - its SHAPE alone; whether the socket may is the relay\'s question (mutants: an unknown word taken; "" refused; before a hello taken)', () => {
  assert.deepEqual(LIVE_EVENTS, ['dread']);
  assert.equal(DREAD_EVENT, 'dread', 'the look draws the word the relay carries');
  assert.deepEqual(parseClient(stage('dread'), { hasHello: true }), { t: 'stage', kind: 'dread' });
  assert.deepEqual(parseClient(stage(''), { hasHello: true }), { t: 'stage', kind: '' }, 'the end of an event');
  for (const bad of ['nope', 'DREAD', 7, null, undefined, ['dread']]) assert.deepEqual(parseClient(JSON.stringify({ t: 'stage', kind: bad }), { hasHello: true }), { error: 'bad stage' }, `kind ${JSON.stringify(bad)}`);
  assert.deepEqual(parseClient(stage('dread'), { hasHello: false }), { error: 'stage before hello' });
  const wire = rd('src/net/wire.js');
  const arm = wire.slice(wire.indexOf("if (m.t === 'stage')"), wire.indexOf("if (m.t === 'mute')"));
  assert.doesNotMatch(arm, /await|verify|glyph/, 'the parser answers no question only the relay can');
  // a live event as the relay says it
  assert.equal(validLiveEvent({ kind: 'dread', at: 1_700_000_000_000 }), true);
  for (const bad of [null, undefined, 'dread', [], { kind: 'dread' }, { kind: 'nope', at: 1 }, { kind: 'dread', at: 0 }, { kind: 'dread', at: -5 }, { kind: 'dread', at: 1.5 }, { kind: 'dread', at: '1' }]) assert.equal(validLiveEvent(bad), false, JSON.stringify(bad));
});

test('EVENT1 wire: the frame is sent only to a relay that knows it (an older one CLOSES the socket on it), and this relay does; the stage is rated like the server line (mutants: the gate at world109; RELAY_VERSION not bumped; the rate below one)', () => {
  assert.equal(EVENT_RELAY_MIN, 110);
  assert.equal(relaySupportsEvent('world109'), false, 'world109 answers `stage` with unknown message and a close');
  assert.equal(relaySupportsEvent('world110'), true);
  assert.equal(relaySupportsEvent(RELAY_VERSION), true, 'the relay this build ships knows it');
  assert.ok(relayVersionAtLeast(110), 'the relay-changing slice bumped the version');
  for (const v of [null, '', 'world', 'worldx', 110]) assert.equal(relaySupportsEvent(v), false);
  assert.ok(EVENT_HZ_MAX >= 1, 'tokenGate cannot express a rate below one a second');
  const t0 = 1_000_000;
  const a = eventGate(null, t0);
  assert.equal(a.pass, true);
  assert.equal(eventGate(a.bucket, t0).pass, false, 'two in one instant is one too many');
  assert.equal(eventGate(a.bucket, t0 + 1000 / EVENT_HZ_MAX).pass, true);
  // the key is apart from every prefix a drain or the hub's sweep deletes
  for (const p of ['hellos', 'look:', 'secret:', 'party:', 'world:', 'acct:', 'asecret:', 'sweep:', 'hub']) assert.equal(EVENT_KEY.startsWith(p), false, p);
});

// ── THE RELAY, over a real room with a real key ─────────────────────

test('EVENT1 relay: a dev stages the dread in the hub - kept in its storage, fanned to every hub socket (the stager\'s receipt included); ended by a dev the same way (mutants: the fan skipped; the store skipped; the end not cleared)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const dev = r.connect(), one = r.connect(), two = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(one, 'peer-0002');
  await r.hello(two, 'peer-0003');
  for (const ws of [dev, one, two]) ws.sent.length = 0;
  await r.raw(dev, stage('dread'));
  const kept = r.store.get(EVENT_KEY);
  assert.equal(kept?.kind, 'dread', 'kept in the hub\'s storage');
  assert.ok(Number.isSafeInteger(kept.at) && kept.at > 0);
  for (const [who, ws] of [['the stager', dev], ['a player', one], ['another', two]]) {
    const ev = ofType(ws, 'event');
    assert.equal(ev.length, 1, `${who} heard it`);
    assert.deepEqual(ev[0], { t: 'event', kind: 'dread', at: kept.at });
  }
  assert.equal(one.closed, null);
  for (const ws of [dev, one, two]) ws.sent.length = 0;
  await new Promise((res) => setTimeout(res, 1000 / EVENT_HZ_MAX + 20));   // the stager's own bucket refills
  await r.raw(dev, stage(''));
  assert.equal(r.store.has(EVENT_KEY), false, 'ended: forgotten');
  for (const ws of [dev, one, two]) assert.equal(ofType(ws, 'event')[0]?.kind, '', 'and everyone told');
});

test('EVENT1 relay: a player without the dev glyph is ignored in SILENCE, a hello that TYPES the glyph gets nothing, and a stage outside the hub is junk (mutants: the glyph check dropped; the hub check dropped)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const one = r.connect(), two = r.connect();
  await r.hello(one, 'peer-0002');
  await r.hello(two, 'peer-0003');
  two.sent.length = 0;
  await r.raw(one, stage('dread'));
  assert.equal(r.store.has(EVENT_KEY), false, 'a player staged an event');
  assert.equal(ofType(two, 'event').length, 0);
  assert.equal(one.closed, null, 'and was not closed - a refusal is a signal too');
  const liar = r.connect();
  await r.hello(liar, 'peer-0004', null, { tok: await r.token('peer-0004', { n: 'peer-0004' }), glyphs: ['dev'] });
  await r.raw(liar, stage('dread'));
  assert.equal(r.store.has(EVENT_KEY), false, 'a typed glyph is not a signed one');
  // a dev in any other room: nothing staged, and counted as junk
  const place = fakeRoom('world:3,12');
  const dev = place.connect(), peer = place.connect();
  await place.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await place.hello(peer, 'peer-0005');
  peer.sent.length = 0;
  await place.raw(dev, stage('dread'));
  assert.equal(place.store.has(EVENT_KEY), false, 'only the hub - the room every online player holds - keeps an event');
  assert.equal(ofType(peer, 'event').length, 0);
  assert.equal(dev.meters.junk, 1, 'a correct client stages nowhere but the hub');
});

test('EVENT1 relay: a player who joins mid-event reads it off the hub welcome (`ev`); the event outlives a drain and a wake; a welcome after the end says none; a place room\'s welcome never says one (mutants: ev not on the welcome; the drain sweeping it; ev on every room)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const dev = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.raw(dev, stage('dread'));
  const at = r.store.get(EVENT_KEY).at;
  const late = r.connect();
  await r.hello(late, 'peer-0009');
  assert.deepEqual(ofType(late, 'welcome')[0].ev, { kind: 'dread', at }, 'the late joiner is told');
  // everyone leaves: the room drains (its sweep runs), the object sleeps and wakes - the event stands
  await r.drop(dev); await r.drop(late);
  await r.room._sweep();
  r.wake();
  assert.equal(r.store.get(EVENT_KEY)?.kind, 'dread', 'a quiet night does not end it');
  const back = r.connect();
  await r.hello(back, 'peer-0010');
  assert.deepEqual(ofType(back, 'welcome')[0].ev, { kind: 'dread', at }, 'read back from storage after a wake');
  // a dev ends it: the next welcome carries no `ev` at all (an old client reads none either way)
  const dev2 = r.connect();
  await r.hello(dev2, 'peer-0011', null, { glyphs: ['dev'] });
  await r.raw(dev2, stage(''));
  const after = r.connect();
  await r.hello(after, 'peer-0012');
  assert.equal('ev' in ofType(after, 'welcome')[0], false);
  // storage that does not hold a known event is none
  r.store.set(EVENT_KEY, { kind: 'plague', at: 5 });
  r.wake();
  const odd = r.connect();
  await r.hello(odd, 'peer-0013');
  assert.equal('ev' in ofType(odd, 'welcome')[0], false, 'a word this relay does not know is no event');
  // a region's channel is a chat room too, and not the hub: its welcome says none
  const region = fakeRoom(chatRegionRoom(0));
  const rp = region.connect();
  region.store.set(EVENT_KEY, { kind: 'dread', at: 5 });
  await region.hello(rp, 'peer-0015');
  assert.equal('ev' in ofType(rp, 'welcome')[0], false, 'the hub alone says the event');
  // a place room says nothing of events
  const place = fakeRoom('world:3,12');
  const p = place.connect();
  place.store.set(EVENT_KEY, { kind: 'dread', at: 5 });
  await place.hello(p, 'peer-0014');
  assert.equal('ev' in ofType(p, 'welcome')[0], false);
});

test('EVENT1 relay: even a dev is rated, on the stage\'s own bucket - a flood is dropped, not fanned (mutant: the meter skipped)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const dev = r.connect(), other = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(other, 'peer-0002');
  other.sent.length = 0;
  for (let i = 0; i < 4; i++) await r.raw(dev, stage(i % 2 ? '' : 'dread'));
  assert.equal(ofType(other, 'event').length, 1, 'one a second');
  assert.equal(dev.meters.evdrops, 3, 'the rest struck');
});

// ── THE SESSION ─────────────────────────────────────────────────────

const session = () => {
  const s = new OnlineSession({ url: 'wss://example.test', name: 'Mac', id: 'peer-0001', secret: 'x'.repeat(32), presence: false });
  s.room = CHAT_WORLD_ROOM;
  const heard = [];
  s.onEvent = (ev, o) => heard.push([ev, o]);
  return { s, heard };
};
const welcome = (extra = {}) => JSON.stringify({ t: 'welcome', id: 'peer-0001', peers: [], n: 1, v: RELAY_VERSION, now: Date.now(), ...extra });

test('EVENT1 session: the hub\'s welcome says the event WHOLE (not live), a frame says it LIVE, "" ends it, each said once; a welcome without one ends it; leaving the server leaves the event (mutants: live on the welcome; the repeat said twice; the welcome\'s silence ignored; leave() keeping it)', () => {
  const { s, heard } = session();
  s._receive(welcome({ ev: { kind: 'dread', at: 1234 } }));
  assert.deepEqual(heard, [[{ kind: 'dread', at: 1234 }, { live: false }]], 'a player who joins mid-event did not watch it come');
  assert.equal(s.eventOk, true, 'this relay knows the frame');
  s._receive(welcome({ ev: { kind: 'dread', at: 1234 } }));
  assert.equal(heard.length, 1, 'a reconnect\'s same word says nothing');
  s._receive(JSON.stringify({ t: 'event', kind: '', at: 2000 }));
  assert.deepEqual(heard[1], [null, { live: true }], 'the end, watched');
  s._receive(JSON.stringify({ t: 'event', kind: 'dread', at: 3000 }));
  assert.deepEqual(heard[2], [{ kind: 'dread', at: 3000 }, { live: true }], 'the start, watched');
  s._receive(JSON.stringify({ t: 'event', kind: 'plague', at: 4000 }));
  assert.equal(heard.length, 3, 'a word this build does not know is no change');
  s._receive(welcome());
  assert.deepEqual(heard[3], [null, { live: false }], 'a hub welcome without one: there is none');
  s._receive(JSON.stringify({ t: 'event', kind: 'dread', at: 5000 }));
  s.leave();
  assert.deepEqual(heard.at(-1), [null, { live: false }], 'a player who leaves the server leaves its event');
  assert.equal(s.liveEvent, null);
});

test('EVENT1 session: a room that is not the hub says nothing of events, a welcome or a frame (mutant: the hub check dropped)', () => {
  const { s, heard } = session();
  s.room = 'world:3,12';
  s._receive(welcome({ ev: { kind: 'dread', at: 1234 } }));
  s._receive(JSON.stringify({ t: 'event', kind: 'dread', at: 1234 }));
  assert.deepEqual(heard, []);
  // nor a halo room's frame on the hub's session
  const h = session();
  h.s._receive(JSON.stringify({ t: 'event', kind: 'dread', at: 1234 }), 'world:3,13');
  assert.deepEqual(h.heard, []);
});

test('EVENT1 session: /event is sent only to a relay that knows the frame and only on the hub, as {t:\'stage\', kind}, under its own gate (mutants: sent to an older relay; sent off the hub; the gate skipped; an unknown word sent)', () => {
  const { s } = session();
  const out = [];
  s._send = (f) => { out.push(f); return true; };
  assert.equal(s.sendStage('dread'), false, 'not before a welcome says the relay knows it');
  s._receive(welcome({ v: 'world109' }));
  assert.equal(s.eventOk, false, 'world109 would close the socket on it');
  assert.equal(s.sendStage('dread'), false);
  s._receive(welcome());
  assert.equal(s.sendStage('plague'), false, 'no such event');
  assert.equal(s.sendStage('dread'), true);
  assert.deepEqual(out, [{ t: 'stage', kind: 'dread' }]);
  assert.equal(s.sendStage(''), false, 'the gate, run at home first');
  const off = session();
  off.s.room = 'world:3,12';
  off.s.eventOk = true;
  off.s._send = () => { throw new Error('sent off the hub'); };
  assert.equal(off.s.sendStage('dread'), false, 'only the hub');
});

// ── THE COMMAND ─────────────────────────────────────────────────────

test('EVENT1 command: /event <name> [on|off] and /event off; anything else is refused in words; not /event is not this; a host command, not in /help (mutants: off not ending; a bad switch taken)', () => {
  assert.deepEqual(parseEventCommand('/event dread'), { kind: 'dread' });
  assert.deepEqual(parseEventCommand('/event dread on'), { kind: 'dread' });
  assert.deepEqual(parseEventCommand('/EVENT Dread ON'), { kind: 'dread' });
  assert.deepEqual(parseEventCommand('/event dread off'), { kind: '' });
  assert.deepEqual(parseEventCommand('  /event off  '), { kind: '' });
  for (const bad of ['/event', '/event nope', '/event dread maybe', '/event dread on now', '/event on']) assert.ok('error' in parseEventCommand(bad), bad);
  for (const not of ['/events dread', 'event dread', '/red dread', '']) assert.equal(parseEventCommand(not), null, not);
  assert.ok(HOST_COMMANDS.includes('event'));
  assert.equal(HELP_LINES.some((l) => l.startsWith('/event')), false, 'a staff command, as /red is - not offered to every player');
});

// ── THE LOOK ────────────────────────────────────────────────────────

test('EVENT1 grade: 0 is the colour untouched and never written; 1 is the ramp at the colour\'s dimmed luminance; the day\'s blue turns blood red, the horizon burns, the night goes black-maroon (mutants: the weight ignored; the input written; the dim dropped)', () => {
  const blue = Object.freeze([0.17, 0.35, 0.72]);
  assert.deepEqual(dreadGrade(blue, 0), [0.17, 0.35, 0.72]);
  const g = dreadGrade(blue, 1);
  const l = (0.2126 * 0.17 + 0.7152 * 0.35 + 0.0722 * 0.72) * DREAD_DIM;
  const r = dreadRamp(l);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(g[i] - r[i]) < 1e-12, 'the ramp at the dimmed luminance');
  assert.ok(g[0] > 4 * g[1] && g[0] > 4 * g[2], `red rules: ${g}`);
  const half = dreadGrade(blue, 0.5);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(half[i] - (blue[i] + g[i]) / 2) < 1e-12, 'linear in the weight');
  assert.deepEqual(dreadGrade(blue, 7), g, 'the weight is clamped');
  const horizon = dreadGrade([0.66, 0.78, 0.92], 1), night = dreadGrade([0.02, 0.03, 0.06], 1);
  assert.ok(horizon[0] > g[0] && horizon[1] > g[1], 'the bright horizon burns brighter than the zenith');
  assert.ok(night[0] < 0.12 && night[1] < 0.02, `the night stays dark: ${night}`);
  // the ramp's ends
  assert.deepEqual(dreadRamp(-1), [...DREAD_RAMP[0].color]);
  assert.deepEqual(dreadRamp(5), [...DREAD_RAMP[2].color]);
  assert.deepEqual(dreadRamp(DREAD_RAMP[1].at), [...DREAD_RAMP[1].color]);
  // a light
  const key = dreadLight([0.8161765, 0.954361, 1], 1);
  assert.ok(key instanceof Float32Array && key[0] > key[1] && key[1] > key[2]);
  assert.ok(DREAD_KEY_DIM > 0 && DREAD_KEY_DIM < 1);
});

test('EVENT1 grade: the GLSL twin is made from the same stops, dim and weights, and every pass that draws the sky grades its last colour with it by its own uDread (mutants: a pass left ungraded; the cloud graded premultiplied)', () => {
  for (const s of DREAD_RAMP) for (const v of s.color) assert.ok(DREAD_GLSL.includes(v.toFixed(4)), `stop ${v}`);
  assert.ok(DREAD_GLSL.includes(DREAD_DIM.toFixed(4)));
  assert.match(DREAD_GLSL, /vec3 dreadGrade\(vec3 c, float w\)/);
  assert.match(DREAD_GLSL, /if \(w <= 0\.0\) return c;/, 'no event: the colour as it was');
  // the four passes
  assert.ok(COMPOSITE_FS.includes(DREAD_GLSL) && COMPOSITE_UNIFORMS.includes('uDread'));
  assert.match(COMPOSITE_FS, /float op = 1\.0 - c\.a;[\s\S]*dreadGrade\(c\.rgb \/ op, uDread\) \* op/, 'the cloud\'s own colour is graded, its opacity put back');
  assert.ok(DYNAMIC_FS.includes(DREAD_GLSL) && DYNAMIC_UNIFORMS.includes('uDread'));
  assert.match(DYNAMIC_FS, /outColor = vec4\(dreadGrade\(enc, uDread\), 1\.0\);/);
  const enhanced = rd('src/render/enhancedSky.js'), classic = rd('src/render/skyRenderer.js');
  assert.match(enhanced, /outColor = vec4\(dreadGrade\(out3, uDread\), 1\.0\);/);
  assert.match(enhanced, /gl\.uniform1f\(u\.uDread, this\.dread\);/);
  assert.match(classic, /outColor = vec4\(dreadGrade\(mix\(color, uFogColor, uFogMix\), uDread\), 1\.0\);/);
  assert.match(classic, /gl\.uniform1f\(this\.uDread, this\.dread\);/);
});

test('EVENT1 fade: a change the player watched walks over DREAD_FADE_S each way; a welcome\'s word is whole; any other word is no dread (mutants: live snapped; the welcome faded; another event read as dread)', () => {
  const d = createDread();
  assert.equal(d.tick(1), 0);
  d.set({ kind: 'dread', at: 1 }, { live: true });
  assert.equal(d.on, true);
  assert.ok(Math.abs(d.tick(DREAD_FADE_S / 2) - 0.5) < 1e-12, 'half way at half the fade');
  assert.equal(d.tick(DREAD_FADE_S), 1, 'and whole, never past it');
  d.set(null, { live: true });
  assert.ok(Math.abs(d.tick(DREAD_FADE_S / 4) - 0.75) < 1e-12, 'lifting the same way');
  d.set({ kind: 'dread', at: 2 }, { live: false });
  assert.equal(d.weight, 1, 'joined into it: whole at once');
  d.set(null);
  assert.equal(d.weight, 0);
  d.set({ kind: 'plague', at: 3 }, { live: false });
  assert.equal(d.weight, 0);
  assert.equal(d.tick(-5), 0, 'time never runs back');
});

test('EVENT1 storm: the strikes are a pure function of the SHARED clock - every client reads the same seconds; none at weight 0; about DREAD_STRIKE_CHANCE a slot; a long gap fires the last few slots only (mutants: seeded off the local clock; the weight ignored; the backlog unbounded)', () => {
  const t0 = 1_758_800_000_000;
  const a = dreadStrikes(t0, t0 + 600_000, 1), b = dreadStrikes(t0, t0 + 600_000, 1);
  assert.deepEqual(a, b, 'the same seconds for everyone');
  assert.equal(dreadStrikes(t0, t0 + 600_000, 0).length, 0);
  // a window cut into frames fires exactly what the whole one did (inside the backlog bound)
  const span = (DREAD_SLOTS_MAX - 1) * DREAD_SLOT_MS, split = [];
  for (let t = t0; t < t0 + span; t += 16) split.push(...dreadStrikes(t, Math.min(t + 16, t0 + span), 1));
  assert.deepEqual(split, dreadStrikes(t0, t0 + span, 1), 'a frame rate changes nothing');
  const slots = 20_000;
  let n = 0;
  for (let t = t0; t < t0 + slots * DREAD_SLOT_MS; t += DREAD_SLOT_MS) n += dreadStrikes(t, t + DREAD_SLOT_MS, 1).length;
  assert.ok(Math.abs(n / slots - DREAD_STRIKE_CHANCE) < 0.02, `about the chance a slot: ${n / slots}`);
  let half = 0;
  for (let t = t0; t < t0 + slots * DREAD_SLOT_MS; t += DREAD_SLOT_MS) half += dreadStrikes(t, t + DREAD_SLOT_MS, 0.5).length;
  assert.ok(half < n * 0.6 && half > n * 0.4, 'the fade thins the storm');
  for (const s of a) {
    assert.ok(s.atMs > t0 && s.atMs <= t0 + 600_000);
    assert.ok(s.distance >= DREAD_NEAR_M && s.distance <= DREAD_FAR_M);
    assert.ok(s.kind === 'cg' || s.kind === 'ic');
  }
  const long = dreadStrikes(t0, t0 + 3_600_000, 1);
  assert.ok(long.length <= DREAD_SLOTS_MAX, 'a tab asleep an hour does not fire the hour');
  assert.ok(long.every((s) => s.atMs > t0 + 3_600_000 - DREAD_SLOTS_MAX * DREAD_SLOT_MS));
});

test('EVENT1 storm: the red storm places each strike around the eye in the event\'s colour, fires nothing on its first tick, and its thunder arrives its distance over the speed of sound later (mutants: the first tick\'s backlog fired; the thunder undelayed; the colour dropped)', () => {
  const storm = createDreadStorm();
  const eye = [100, 20, -50];
  const t0 = 1_758_800_000_000;
  assert.deepEqual(storm.tick({ sharedMs: t0, eye, weight: 1 }), { strikes: [], sounds: [] }, 'arriving fires no backlog');
  const want = [];   // the schedule as the frames walk it - each frame's window, never past the backlog bound
  for (let t = t0 + 50; t <= t0 + 120_000; t += 50) want.push(...dreadStrikes(t - 50, t, 1));
  assert.ok(want.length > 10);
  const strikes = [], sounds = [];
  for (let t = t0 + 50; t <= t0 + 120_000 + 30_000; t += 50) {
    const f = storm.tick({ sharedMs: t, eye, weight: t <= t0 + 120_000 ? 1 : 0 });
    for (const s of f.strikes) strikes.push({ ...s, t });
    for (const s of f.sounds) sounds.push({ ...s, t });
  }
  assert.equal(strikes.length, want.length, 'every strike, once');
  for (const [i, s] of strikes.entries()) {
    const w = want[i];
    assert.equal(s.color, DREAD_BOLT_COLOR);
    assert.ok(Math.abs(Math.hypot(s.x - eye[0], s.z - eye[2]) - w.distance) < 1e-6, 'at its distance from the eye');
    assert.equal(s.seed, w.seed);
  }
  const heard = want.filter((w) => thunderOf(w.distance));
  assert.equal(sounds.length, heard.length, 'each audible strike\'s thunder, once');
  for (const snd of sounds) {
    const w = want.find((x) => Math.abs(Math.hypot(snd.x - eye[0], snd.z - eye[2]) - x.distance) < 1e-6);
    const due = w.atMs + thunderOf(w.distance).delay * 1000;
    assert.ok(snd.t >= due && snd.t < due + 50 + 1e-6, 'when the sound would arrive');
  }
  storm.reset();
  assert.deepEqual(storm.tick({ sharedMs: t0 + 200_000, eye, weight: 1 }), { strikes: [], sounds: [] }, 'a jump forgets the place');
});

test('EVENT1 bolts: a coloured strike keeps its colour through the weather\'s own bolt field - the channel and the light it throws - and the renderer draws each colour apart; an uncoloured one is the storm\'s blue-white as it was (mutants: the colour dropped in the field; the flash colour ignored; the groups merged)', () => {
  const lights = createStormLights();
  const eye = [0, 0, 0];
  const f = lights.frame({ seconds: 10, eye, distant: [{ x: 500, z: 0, seed: 7, kind: 'cg', strength: 1, color: DREAD_BOLT_COLOR, flashColor: DREAD_FLASH_COLOR }, { x: 0, z: 900, seed: 9, kind: 'cg', strength: 1 }] });
  const t = lights.frame({ seconds: 10.01, eye });
  const bolts = [...f.bolts, ...t.bolts];
  assert.ok(bolts.some((b) => b.color === DREAD_BOLT_COLOR), 'the red channel');
  assert.ok(bolts.some((b) => !('color' in b)), 'the weather\'s own, untouched');
  const field = createBoltField();
  field.add({ x: 300, z: 0, baseY: 500, groundY: 0, seed: 7, kind: 'cg', strength: 1, at: 0, color: DREAD_BOLT_COLOR, flashColor: DREAD_FLASH_COLOR });
  let red = null;
  for (let s = 0; s < 0.5 && !red; s += 0.005) red = field.tick(s, eye).flash;
  assert.ok(red, 'a near strike throws light');
  const k = red.color[0] / DREAD_FLASH_COLOR[0];
  assert.ok(Math.abs(red.color[1] - DREAD_FLASH_COLOR[1] * k) < 1e-9 && red.color[0] > red.color[1], 'in its own colour');
  const plain = createBoltField();
  plain.add({ x: 300, z: 0, baseY: 500, groundY: 0, seed: 7, kind: 'cg', strength: 1, at: 0 });
  let blue = null;
  for (let s = 0; s < 0.5 && !blue; s += 0.005) blue = plain.tick(s, eye).flash;
  const kb = blue.color[0] / FLASH_COLOR[0];
  assert.ok(Math.abs(blue.color[2] - FLASH_COLOR[2] * kb) < 1e-9, 'the storm\'s light as it was');
  const groups = boltGroups([{ segs: [], bright: 1 }, { segs: [], bright: 1, color: DREAD_BOLT_COLOR }, { segs: [], bright: 1 }]);
  assert.deepEqual(groups.map(([c, g]) => [c, g.length]), [[BOLT_COLOR, 2], [DREAD_BOLT_COLOR, 1]]);
  // the deck's glow from the red strikes alone
  assert.equal(dreadCloudGlow([{ bright: 1 }]), 0, 'the weather\'s own strikes are the storm\'s business');
  assert.equal(dreadCloudGlow([{ bright: 0.4, color: DREAD_BOLT_COLOR }, { bright: 3, color: DREAD_BOLT_COLOR }]), DREAD_CLOUD_GLOW);
  assert.equal(dreadCloudGlow(undefined), 0);
});

// ── THE HOST ────────────────────────────────────────────────────────

test('EVENT1 host: the sky controller grades every pass and the fog by the one weight, and under it the SKY wears the storm while the wind keeps the sim\'s word (mutants: a renderer skipped; the fog ungraded; the wind given the storm)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.equal(DREAD_SKY_WORD, 'thunder');
  assert.match(shared, /setDread\(w, glow = 0\) \{\s*dreadW = Math\.max\(0, Math\.min\(1, Number\(w\) \|\| 0\)\);\s*\n\s*dreadGlow = [^\n]*\n\s*for \(const r of \[sky, enhancedSky, dynamicSky, clouds\]\) if \(r\) r\.dread = dreadW;/);
  assert.match(shared, /waterSky\(\) \{\s*\n\s*if \(enhancedSky\?\.state\) return dreaded\(/, 'the water mirrors the dread on the dome\'s lane');
  assert.match(shared, /return dreaded\(\{ zenith: \[h\[0\] \* 0\.55/, 'and on the mod\'s');
  assert.match(shared, /return dreadW > 0 \? dreadGrade\(c, dreadW\) : c;/, 'the fog');
  assert.match(shared, /dreadGlow = dreadW > 0 \? Math\.max\(0, Math\.min\(1, Number\(glow\) \|\| 0\)\) : 0;/, 'no glow without the dread');
  assert.equal((shared.match(/\(extra\?\.flash \?\? 0\) \+ dreadGlow/g) ?? []).length, 2, 'the deck lit by the red strikes under both skies');
  assert.match(shared, /const skyWord = dreadW > 0 \? DREAD_SKY_WORD : weatherName;\s*const want = weatherRow\(skyWord\);/);
  assert.match(shared, /windModel\.tick\(extra\?\.classicMinutes \?\? 0, weatherName,/, 'the wind is the weather\'s');
  assert.match(shared, /weather: skyWord, seconds, dt: dtReal,/, 'Dynamic Skies wears it');
  assert.equal((shared.match(/const cb = dreadW > 0 \? \{ word: skyWord, row: weatherRowNow \} : cloudBaseOf\(extra, weatherName, weatherRowNow\);/g) ?? []).length, 2, 'the clouds under both skies');
});

test('EVENT1 host: world.js hears the event from the HUB link alone, walks it each exterior frame into the sky, the land\'s light and the red storm, and parses /event beside /red, never guarded (mutants: every link hears it; the light ungraded; the stage sent to an old relay)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /if \(tab\.room === SOCIAL_ROOM\) link\.onEvent = \(ev, o\) => dread\.set\(ev, o\);/);
  assert.equal((world.match(/\.onEvent = /g) ?? []).length, 1, 'no other session sets the event');
  assert.match(world, /const dreadW = dread\.tick\(dt\);/);
  assert.match(world, /sky\.setDread\(dreadW, dreadCloudGlow\(boltFrame\.bolts\)\);/, 'the grade and the red strikes\' glow, once the strikes are known');
  assert.ok(world.indexOf('sky.setDread(dreadW,') > world.indexOf('boltFrame = isEnhanced()') && world.indexOf('sky.setDread(dreadW,') < world.indexOf('sky.use(('), 'after the bolts, before the sky\'s frame');
  assert.match(world, /dreadLight\(withMoonAmbient\([\s\S]*?\), dreadW\), sunScale\(minute\) \* wxNow\.sun \* flash \* sky\.sunFactor\(\) \* \(1 - DREAD_KEY_DIM \* dreadW\)/);
  assert.match(world, /dreadLight\(SUN_RIG_COLOR, dreadW\)\);/);
  assert.match(world, /dreadStorm\.tick\(\{ sharedMs: Date\.now\(\) \+ _sharedOffsetMs, eye: mwv\.eye, weight: dreadW \}\)/, 'on the shared clock');
  assert.match(world, /if \(isEnhanced\(\)\) for \(const s of ds\.strikes\) struckFar\.push\(\{ \.\.\.s, flashColor: DREAD_FLASH_COLOR \}\);/);
  assert.match(world, /flash: flash - 1, pos:/, 'the host\'s flash is the storm\'s alone');
  const cmd = world.slice(world.indexOf('const staged = parseEventCommand(text);'), world.indexOf('return hub.sendStage(staged.kind);'));
  assert.match(cmd, /if \(!hub\?\.eventOk\) return say\('The server cannot stage live events yet\.'\);/);
  assert.doesNotMatch(cmd, /glyph|dev/, 'never guarded here - the relay asks the token');
  assert.ok(world.indexOf('const staged = parseEventCommand(text);') > world.indexOf("const red = /^\\/red"), 'parsed beside /red');
});
