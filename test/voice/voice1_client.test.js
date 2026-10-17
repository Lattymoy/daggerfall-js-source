// THE CLIENT'S LAW - the proximity arithmetic, the state the
// HUD reads, the settings' projection, the wire's shapes, the spatial graph over fake nodes and the client over a fake
// transport and a fake service. Every pin fails under a one-character mutation of its law (Home.md, A PIN MUST FAIL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  VOICE_FULL_RANGE, VOICE_SILENT_RANGE, VOICE_RESUB_RANGE, VOICE_SUBS_MAX, VOICE_PLACE_MS,
  voiceGainAt, feetDistance, panFor, proximitySet, subscriptionDiff,
} from '../../src/voice/voiceProximity.js';
import { VoiceState, VOICE_STATUS } from '../../src/voice/voiceState.js';
import { VOICE_DEFAULTS, VOICE_PREF_KEY, projectVoiceSettings, loadVoiceSettings, saveVoiceSetting } from '../../src/voice/voiceSettings.js';
import { PREF_DEFAULTS, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { VOICE_V, VOICE_CHANNELS, VOICE_TOKEN_TTL_S, VOICE_REMINT_AHEAD_S, voiceRoomName, validTokenAsk, validPlaceAsk, validTokenAnswer, voiceUrlOk, VOICE_PLACE_MAX } from '../../src/voice/voiceWire.js';
import { VoiceSpatialAudio, VOICE_RAMP_S } from '../../src/voice/voiceSpatialAudio.js';
import { VoiceTransport, _setVoiceSdkForTests } from '../../src/voice/voiceTransport.js';
import { VoiceClient, VOICE_TEXT, VOICE_RETRY_MIN_MS, DEFAULT_VOICE_SERVICE } from '../../src/voice/voiceClient.js';
import { CHAT_SAY_RANGE } from '../../src/net/chat.js';
import { DEFAULT_BINDINGS } from '../../src/systems/inputActions.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

// ─── THE PROXIMITY LAW ──────────────────────────────────────────────────────────────────────────────────────────────

test('voice proximity: the curve is 1 inside the full range, 0 at and past the silent range, a straight fall between, and a whisper reaches less far than a typed /say', () => {
  assert.equal(voiceGainAt(0), 1);
  assert.equal(voiceGainAt(VOICE_FULL_RANGE), 1);
  assert.equal(voiceGainAt(VOICE_SILENT_RANGE), 0);
  assert.equal(voiceGainAt(VOICE_SILENT_RANGE + 100), 0);
  const mid = (VOICE_FULL_RANGE + VOICE_SILENT_RANGE) / 2;
  assert.ok(Math.abs(voiceGainAt(mid) - 0.5) < 1e-12, 'halfway is half');
  assert.equal(voiceGainAt(3, 3, 15), 1); assert.equal(voiceGainAt(9, 3, 15), 0.5); assert.equal(voiceGainAt(15, 3, 15), 0);   // the plan's own numbers through the same curve
  assert.equal(voiceGainAt(NaN), 0); assert.equal(voiceGainAt(-1), 0);
  assert.ok(VOICE_SILENT_RANGE < CHAT_SAY_RANGE, 'a voice is never heard from a body whose /say would not be delivered');
  assert.ok(VOICE_RESUB_RANGE > VOICE_SILENT_RANGE, 'hysteresis: held a little past silence');
  assert.equal(VOICE_SUBS_MAX, 8, 'the design\'s party');
  assert.equal(VOICE_PLACE_MS, 500);
});

test('voice proximity: distance is the ground plane between feet, as earshot measures; a pan is the listener\'s right', () => {
  assert.equal(feetDistance([0, 0, 0], [3, 100, 4]), 5, 'y is not in it');
  assert.ok(Number.isNaN(feetDistance(null, [0, 0, 0])));
  // facing -Z (yaw 0): a speaker at +X is on the right, at -X the left, straight ahead or behind centred
  assert.ok(Math.abs(panFor([0, 0, 0], [5, 0, 0], 0) - 1) < 1e-12);
  assert.ok(Math.abs(panFor([0, 0, 0], [-5, 0, 0], 0) + 1) < 1e-12);
  assert.ok(Math.abs(panFor([0, 0, 0], [0, 0, -5], 0)) < 1e-12);
  // turned a quarter right (yaw pi/2): forward is +X, so a speaker at +Z is on the right
  assert.ok(Math.abs(panFor([0, 0, 0], [0, 0, 5], Math.PI / 2) - 1) < 1e-9);
  assert.equal(panFor([0, 0, 0], [0, 0, 0], 0), 0, 'on top of me: centred, not NaN');
  assert.equal(panFor(null, [1, 0, 0], 0), 0);
});

test('voice proximity: the set is the eligible near bodies, nearest first, at most the bound, with hysteresis for the held and no one from another place', () => {
  const here = [0, 0, 0];
  const peers = [
    { id: 'far', feet: [VOICE_SILENT_RANGE + 1, 0, 0] },
    { id: 'near', feet: [2, 0, 0] },
    { id: 'mid', feet: [20, 0, 0] },
    { id: 'edge', feet: [VOICE_SILENT_RANGE + 1, 0, 0] },          // outside silence, but HELD: hysteresis keeps it
    { id: 'gone', feet: [VOICE_RESUB_RANGE + 1, 0, 0] },           // held, and past the resub edge: dropped
    { id: 'elsewhere', feet: [1, 0, 0], here: false },             // another place: never, however near
    { id: 'nowhere', feet: null },
    null, { feet: [1, 0, 0] },
  ];
  const set = proximitySet(here, peers, new Set(['edge', 'gone']));
  assert.deepEqual(set.map((s) => s.id), ['near', 'mid', 'edge']);
  assert.equal(set[0].gain, 1);
  assert.ok(set[1].gain > 0 && set[1].gain < 1);
  assert.equal(set[2].gain, 0, 'held past silence plays at zero until it leaves the resub edge');
  // the bound: the nearest eight of twelve
  const crowd = Array.from({ length: 12 }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, feet: [i + 1, 0, 0] }));
  assert.deepEqual(proximitySet(here, crowd, new Set()).map((s) => s.id), crowd.slice(0, VOICE_SUBS_MAX).map((p) => p.id));
  assert.deepEqual(proximitySet(null, crowd, new Set()), [], 'no feet, nobody');
  // ties break by id so two listeners with the same picture compute the same set
  assert.deepEqual(proximitySet(here, [{ id: 'b', feet: [1, 0, 0] }, { id: 'a', feet: [1, 0, 0] }], new Set()).map((s) => s.id), ['a', 'b']);
});

test('voice proximity: the diff names what to open and what to drop, nothing twice', () => {
  assert.deepEqual(subscriptionDiff(['a', 'b'], [{ id: 'b' }, { id: 'c' }]), { open: ['c'], drop: ['a'] });
  assert.deepEqual(subscriptionDiff([], []), { open: [], drop: [] });
  assert.deepEqual(subscriptionDiff(['a'], [{ id: 'a' }, { id: 'a' }]), { open: [], drop: [] });
});

// ─── THE STATE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('voice state: the words, the version that bumps on a shape change alone, transmitting under push-to-talk, and a peer mute that outlives the voice', () => {
  const s = new VoiceState({ now: () => 1000 });
  assert.deepEqual(VOICE_STATUS, ['off', 'connecting', 'open', 'reconnecting', 'denied', 'error']);
  assert.equal(s.status, 'off'); assert.equal(s.pushToTalk, true, 'push-to-talk by default - the plan\'s section 8'); assert.equal(s.enabled, false, 'opt-in');
  const kinds = []; s.onChange = (k) => kinds.push(k);
  let v = s.version;
  s.setStatus('connecting'); assert.equal(s.version, v + 1); s.setStatus('connecting'); assert.equal(s.version, v + 1, 'unchanged: no bump');
  assert.throws(() => s.setStatus('weird'), TypeError);
  s.setStatus('error', 'boom'); assert.equal(s.lastError, 'boom'); s.setStatus('open'); assert.equal(s.lastError, null, 'any other status clears the error');
  s.setMicOpen(true); assert.equal(s.transmitting, false, 'push-to-talk: silent until held');
  s.setTalking(true); assert.equal(s.transmitting, true);
  s.setMuted(true); assert.equal(s.transmitting, false, 'mute wins over the key');
  s.setMuted(false); s.setPushToTalk(false); assert.equal(s.talking, false, 'open mic: the key\'s edge is forgotten'); assert.equal(s.transmitting, true, 'open mic transmits');
  assert.throws(() => s.setChannel('world'), TypeError);
  // a remote row: speaking and gain bump the LEVEL version, not the panel's
  s.addRemote('p1', 'proximity'); v = s.version; const lv = s.levelVersion;
  s.setSpeaking('p1', true); s.setGain('p1', 0.5); assert.equal(s.version, v); assert.equal(s.levelVersion, lv + 2);
  s.setGain('p1', 7); assert.equal(s.remotes.get('p1').gain, 1, 'clamped');
  assert.equal(s.addRemote('p1', 'party'), s.remotes.get('p1'), 'idempotent');
  assert.equal(s.addRemote('p2', 'party').gain, 1, 'a party voice starts at full gain');
  s.mutePeer('p3', true); s.addRemote('p3', 'proximity'); assert.equal(s.remotes.get('p3').muted, true, 'a mute set before the voice arrived is on its row');
  s.dropRemote('p3'); assert.ok(s.mutedPeers.has('p3'), 'and survives its leave');
  assert.deepEqual(s.rows().map((r) => r.id), ['p1', 'p2'], 'speaking first');
  s.clearConnection(); assert.equal(s.remotes.size, 0); assert.equal(s.micOpen, false); assert.ok(s.mutedPeers.has('p3'), 'the player\'s choices stay');
  assert.ok(kinds.includes('status') && kinds.includes('remote') && kinds.includes('mute-peer') && kinds.includes('clear'));
});

// ─── THE SETTINGS ───────────────────────────────────────────────────────────────────────────────────────────────────

test('voice settings: opt-in, push-to-talk, a free key, one pref row; the projection drops what it does not know and clamps what it does', () => {
  assert.equal(VOICE_DEFAULTS.enabled, false); assert.equal(VOICE_DEFAULTS.pushToTalk, true); assert.equal(VOICE_DEFAULTS.channel, 'proximity');
  assert.ok(!DEFAULT_BINDINGS.some(([code]) => code === VOICE_DEFAULTS.pttCode), `${VOICE_DEFAULTS.pttCode} is not a default binding of the game's`);
  assert.equal(VOICE_PREF_KEY, 'voice');
  assert.ok(VOICE_PREF_KEY in PREF_DEFAULTS, 'the prefs table carries the one row');
  assert.deepEqual(PREF_DEFAULTS.voice, null, 'null: every choice its default');
  const p = projectVoiceSettings({ enabled: true, pushToTalk: 'yes', pttCode: 'Key V', channel: 'guild', volume: 3, mutedPeers: ['ok_peer_1', 'x', 5], inputDevice: 'mic1', junk: 1 });
  assert.deepEqual(p, { ...VOICE_DEFAULTS, enabled: true, volume: 1, mutedPeers: ['ok_peer_1'], inputDevice: 'mic1' });
  assert.deepEqual(projectVoiceSettings(null), { ...VOICE_DEFAULTS, mutedPeers: [] });
  // the shelf: a save writes the whole set back under the one key
  resetPrefs();
  const store = new Map(); globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    assert.deepEqual(loadVoiceSettings(), { ...VOICE_DEFAULTS, mutedPeers: [] });
    saveVoiceSetting('enabled', true); saveVoiceSetting('muted', true);
    assert.equal(loadVoiceSettings().enabled, true); assert.equal(loadVoiceSettings().muted, true);
    assert.equal(JSON.parse([...store.values()][0]).voice.pushToTalk, true, 'the whole set is on the shelf');
  } finally { delete globalThis.localStorage; resetPrefs(); }
});

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('voice wire: the room\'s name is derived, never taken; the asks are projected; the answer is refused unless whole', () => {
  assert.equal(VOICE_V, 1); assert.deepEqual(VOICE_CHANNELS, ['proximity', 'party']);
  assert.ok(VOICE_TOKEN_TTL_S <= 300 && VOICE_REMINT_AHEAD_S < VOICE_TOKEN_TTL_S);
  assert.equal(voiceRoomName('proximity', 'cell:12.34:5'), 'vx_cell_12_34_5');
  assert.equal(voiceRoomName('party', 'q1abc2def3'), 'vp_q1abc2def3');
  assert.equal(voiceRoomName('party', 'cell:1'), null, 'a party room needs a party id');
  assert.equal(voiceRoomName('proximity', '../etc'), null);
  assert.equal(voiceRoomName('guild', 'x'), null);
  const t = 'v1.abc.def';
  assert.deepEqual(validTokenAsk({ token: t, room: 'cell:1.2', channel: 'proximity' }), { token: t, channel: 'proximity', room: 'cell:1.2', party: null });
  assert.equal(validTokenAsk({ token: t, room: 'cell:1.2', channel: 'proximity', party: 'q1abc2def3' }), null, 'a party on a proximity ask is a wrong shape');
  assert.deepEqual(validTokenAsk({ token: t, channel: 'party', party: 'q1abc2def3' }), { token: t, channel: 'party', party: 'q1abc2def3', room: null });
  assert.equal(validTokenAsk({ token: t, channel: 'party' }), null);
  assert.equal(validTokenAsk({ token: '', room: 'cell:1', channel: 'proximity' }), null);
  assert.equal(validTokenAsk({ token: t, room: 'cell:1', channel: 'proximity', playerId: 'x' })?.playerId, undefined, 'a playerId is not read');
  assert.deepEqual(validPlaceAsk({ token: t, room: 'cell:1', near: ['abcd', 'abcd', 'efgh'] }), { token: t, room: 'cell:1', near: ['abcd', 'efgh'] });
  assert.equal(validPlaceAsk({ token: t, room: 'cell:1', near: ['a'] }), null, 'a short id refuses the frame');
  assert.equal(validPlaceAsk({ token: t, room: 'cell:1', near: Array(VOICE_PLACE_MAX + 1).fill('abcd') }), null);
  const good = { ok: true, v: 1, url: 'wss://voice.example', token: 'jwt', identity: 'me', room: 'vx_x', ttl: 120 };
  assert.deepEqual(validTokenAnswer(good), { url: 'wss://voice.example', token: 'jwt', identity: 'me', room: 'vx_x', ttl: 120 });
  for (const bad of [{ ...good, v: 2 }, { ...good, ok: false }, { ...good, ttl: 0 }, { ...good, ttl: 4000 }, { ...good, url: 'http://x' }, { ...good, token: '' }]) assert.equal(validTokenAnswer(bad), null);
  assert.ok(voiceUrlOk('wss://a.b') && voiceUrlOk('ws://localhost:7880') && voiceUrlOk('ws://127.0.0.1:7880'));
  assert.ok(!voiceUrlOk('ws://evil.example') && !voiceUrlOk('https://a.b') && !voiceUrlOk('nope'));
});

// ─── THE SPATIAL GRAPH ──────────────────────────────────────────────────────────────────────────────────────────────

function fakeContext() {
  const log = [];
  const param = (name) => ({ value: 0, setTargetAtTime(v, t, c) { log.push([name, v, c]); this.value = v; } });
  const node = (kind) => ({ kind, out: null, connect(d) { this.out = d; return d; }, disconnect() { this.out = null; log.push(['disconnect', kind]); }, gain: kind === 'gain' ? param('gain') : undefined, pan: kind === 'pan' ? param('pan') : undefined });
  return { log, currentTime: 2, destination: { kind: 'dest' }, createGain: () => node('gain'), createStereoPanner: () => node('pan'), createMediaStreamSource: () => node('source') };
}

test('voice spatial: source -> gain -> pan -> master -> destination per voice, a party voice at 1, placement ramped and clamped, every node freed on drop and destroy', () => {
  const ctx = fakeContext();
  const sp = new VoiceSpatialAudio(ctx);
  assert.equal(sp.master.out, ctx.destination);
  sp.add('a', {}, {}); sp.add('b', {}, { party: true });
  const a = sp.voices.get('a'), b = sp.voices.get('b');
  assert.equal(a.source.out, a.gain); assert.equal(a.gain.out, a.pan); assert.equal(a.pan.out, sp.master);
  assert.equal(a.gain.gain.value, 0, 'a proximity voice starts silent until placed'); assert.equal(b.gain.gain.value, 1);
  assert.ok(sp.place('a', 0.5, -2)); assert.equal(a.gain.gain.value, 0.5); assert.equal(a.pan.pan.value, -1, 'pan clamped');
  assert.ok(ctx.log.some(([n, , c]) => n === 'gain' && c === VOICE_RAMP_S), 'ramped, not stepped');
  assert.equal(sp.place('zz', 1), false);
  const el = { srcObject: null, muted: false, paused: false, play() { return Promise.resolve(); }, pause() { this.paused = true; }, remove() { this.removed = true; } };
  sp.add('c', { s: 1 }, { el }); assert.equal(el.srcObject.s, 1); assert.equal(el.muted, true, 'the element holds the stream alive and plays nothing itself');
  assert.ok(sp.drop('c')); assert.equal(el.srcObject, null); assert.ok(el.removed);
  sp.add('a', {}, {});   // re-add replaces: the old nodes are disconnected first
  const disconnects = ctx.log.filter(([n]) => n === 'disconnect').length;
  sp.destroy();
  assert.equal(sp.voices.size, 0);
  assert.ok(ctx.log.filter(([n]) => n === 'disconnect').length > disconnects);
  // no StereoPanner (an old context): gain straight to master
  const ctx2 = fakeContext(); delete ctx2.createStereoPanner;
  const sp2 = new VoiceSpatialAudio(ctx2); sp2.add('a', {}, {}); assert.equal(sp2.voices.get('a').gain.out, sp2.master); assert.equal(sp2.voices.get('a').pan, null);
});

test('voice spatial: place() is a dirty-check, not a per-frame schedule - the same gain/pan asked again costs the audio thread nothing', () => {
  const ctx = fakeContext();
  const sp = new VoiceSpatialAudio(ctx);
  sp.add('a', {}, {});
  assert.ok(sp.place('a', 0.5, -0.5));
  const scheduledAfterFirst = ctx.log.filter(([n]) => n === 'gain' || n === 'pan').length;
  assert.equal(scheduledAfterFirst, 2, 'first place schedules both gain and pan');
  // two players standing still: the exact same numbers, frame after frame
  for (let i = 0; i < 10; i++) assert.ok(sp.place('a', 0.5, -0.5));
  assert.equal(ctx.log.filter(([n]) => n === 'gain' || n === 'pan').length, scheduledAfterFirst, 'ten identical frames schedule nothing new');
  // only the field that actually moved is scheduled
  sp.place('a', 0.9, -0.5);
  assert.equal(ctx.log.filter(([n]) => n === 'gain').length, 2, 'gain changed - one more gain schedule');
  assert.equal(ctx.log.filter(([n]) => n === 'pan').length, 1, 'pan unchanged - still just the first pan schedule');
  // a context with no panner: an unused 'pan' argument changing every frame never blocks the gain's own dirty-check
  const ctx2 = fakeContext(); delete ctx2.createStereoPanner;
  const sp2 = new VoiceSpatialAudio(ctx2);
  sp2.add('a', {}, {});
  sp2.place('a', 0.4, 0.1);
  const afterFirst = ctx2.log.filter(([n]) => n === 'gain').length;
  sp2.place('a', 0.4, 0.9);   // pan moved, but there is no panner to move - gain must still skip
  assert.equal(ctx2.log.filter(([n]) => n === 'gain').length, afterFirst, 'no panner: a changing pan argument cannot defeat the gain dirty-check');
});

// ─── THE TRANSPORT OVER A FAKE SDK ──────────────────────────────────────────────────────────────────────────────────

function fakeSdk() {
  const rooms = [];
  const RoomEvent = { TrackSubscribed: 'ts', TrackUnsubscribed: 'tu', ParticipantDisconnected: 'pd', ActiveSpeakersChanged: 'as', Reconnecting: 'rc', Reconnected: 'rd', Disconnected: 'dc', TrackPublished: 'tp' };
  const Track = { Kind: { Audio: 'audio', Video: 'video' }, Source: { Microphone: 'microphone' } };
  class Room {
    constructor(opts) { this.opts = opts; this.handlers = new Map(); this.remoteParticipants = new Map(); this.connected = null; this.localParticipant = { published: [], publishTrack: async (t, o) => { this.localParticipant.published.push([t, o]); } }; rooms.push(this); }
    on(ev, fn) { this.handlers.set(ev, fn); }
    emit(ev, ...a) { this.handlers.get(ev)?.(...a); }
    async connect(url, token, o) { if (url.includes('refuse')) throw new Error('could not connect'); this.connected = { url, token, o }; }
    async disconnect() { this.connected = null; this.disconnected = true; }
    addParticipant(identity) { const pubs = new Map(); const p = { identity, trackPublications: pubs }; pubs.set('T' + identity, { subscribed: null, setSubscribed(on) { this.subscribed = on; } }); this.remoteParticipants.set(identity, p); return p; }
  }
  const createLocalAudioTrack = async (o) => { if (o.deviceId === 'refuse') { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; } return { o, muted: false, stopped: false, async mute() { this.muted = true; }, async unmute() { this.muted = false; }, stop() { this.stopped = true; }, async setDeviceId(id) { this.o.deviceId = id; } }; };
  return { Room, RoomEvent, Track, createLocalAudioTrack, rooms };
}

test('voice transport: autoSubscribe off, a track received only for a named identity (and remembered for one that arrives later), speakers, a dropped participant, the mic published once and stopped on leave', async () => {
  const sdk = fakeSdk();
  const got = [], gone = [], speakers = [], states = [];
  const t = new VoiceTransport({ sdk, onTrack: (id, s) => got.push([id, s]), onTrackGone: (id) => gone.push(id), onSpeakers: (ids) => speakers.push(ids), onLeft: (id) => gone.push('left:' + id), onState: (s) => states.push(s) });
  const room = await t.connect('wss://x', 'tok', { identity: 'me' });
  assert.equal(room.connected.o.autoSubscribe, false, 'nothing is received unasked');
  assert.deepEqual(states, ['connected']);
  const p1 = room.addParticipant('p1');
  assert.equal(t.subscribe('p1', true), true); assert.equal(p1.trackPublications.get('Tp1').subscribed, true);
  assert.equal(t.subscribe('p2', true), false, 'not here yet - remembered'); assert.ok(t.subscribed.has('p2'));
  const pub2 = { subscribed: null, setSubscribed(on) { this.subscribed = on; } };
  room.emit('tp', pub2, { identity: 'p2' }); assert.equal(pub2.subscribed, true, 'marked wanted as it appears');
  room.emit('tp', { setSubscribed() { throw new Error('never'); } }, { identity: 'p9' });   // not wanted: not asked
  room.emit('ts', { kind: 'audio', mediaStream: { id: 's1' } }, {}, { identity: 'p1' });
  room.emit('ts', { kind: 'video', mediaStream: { id: 'v' } }, {}, { identity: 'p1' });
  assert.deepEqual(got, [['p1', { id: 's1' }]], 'audio alone');
  room.emit('as', [{ identity: 'p1' }]); assert.deepEqual(speakers, [['p1']]);
  room.emit('tu', { kind: 'audio' }, {}, { identity: 'p1' }); room.emit('pd', { identity: 'p2' });
  assert.deepEqual(gone, ['p1', 'left:p2']); assert.ok(!t.subscribed.has('p2'));
  const mic = await t.openMic({ deviceId: 'd1' });
  assert.equal(await t.openMic({}), mic, 'once');
  assert.equal(room.localParticipant.published.length, 1); assert.equal(room.localParticipant.published[0][1].source, 'microphone');
  await t.setMicMuted(true); assert.equal(mic.muted, true); await t.setMicDevice('d2'); assert.equal(mic.o.deviceId, 'd2');
  room.emit('rc'); room.emit('rd'); assert.deepEqual(states, ['connected', 'reconnecting', 'connected']);
  assert.deepEqual(t.participants(), ['p1']);
  await t.disconnect(); assert.ok(mic.stopped); assert.equal(t.room, null); assert.ok(room.disconnected);
  await t.disconnect();   // twice is fine
  await assert.rejects(() => t.openMic({}), /no room/);
});

// ─── THE CLIENT OVER A FAKE TRANSPORT AND A FAKE SERVICE ────────────────────────────────────────────────────────────

function fakeService({ answer = null, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push([new URL(url).pathname, body]);
    if (status !== 200) return { ok: false, status, json: async () => ({}) };
    if (url.endsWith('/token')) return { ok: true, json: async () => answer ?? { ok: true, v: 1, url: 'wss://sfu.test', token: 'lk', identity: 'me', room: 'vx_' + body.room, ttl: 120 } };
    return { ok: true, json: async () => ({ ok: true, v: 1, allow: [] }) };
  };
  return { calls, fetchImpl };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(c) { for (let i = 0; i < 10; i++) { await tick(); if (!c._connecting) break; await c._connecting?.catch(() => {}); } }

function makeClient({ svc, sdk = fakeSdk(), mintToken = async () => 'v1.body.sig', clock = { t: 100_000 }, ctx = fakeContext(), rand = () => 0.5 } = {}) {
  const transport = new VoiceTransport({ sdk });
  const c = new VoiceClient({ service: 'https://voice.test/', mintToken, fetch: svc.fetchImpl, transport, now: () => clock.t, rand, audioContext: () => ctx, setTimeout: () => 0, clearTimeout: () => {} });
  return { c, sdk, transport, clock, ctx };
}

test('voice client: a NULL OBJECT when off - no fetch, no SDK, no microphone, the frame returns at once', async () => {
  const svc = fakeService();
  const { c, sdk } = makeClient({ svc });
  c.setRoom('cell:1'); c.frame([0, 0, 0], 0, [{ id: 'p1', feet: [1, 0, 0] }]);
  await settle(c);
  assert.deepEqual(svc.calls, []); assert.equal(sdk.rooms.length, 0); assert.equal(c.state.status, 'off');
  assert.equal(c.state.micOpen, false);
  assert.equal(DEFAULT_VOICE_SERVICE.startsWith('https://'), true);
});

test('voice client: on, in a room - the relay token minted, the service asked for the room\'s credential, the SFU joined, the mic published and muted until the key; off again tears it all down', async () => {
  const svc = fakeService();
  const { c, sdk } = makeClient({ svc });
  c.setEnabled(true); c.setRoom('cell:1.2');
  c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.status, 'open');
  assert.deepEqual(svc.calls[0], ['/v1/voice/token', { token: 'v1.body.sig', room: 'cell:1.2', channel: 'proximity' }]);
  const room = sdk.rooms[0];
  assert.equal(room.connected.url, 'wss://sfu.test'); assert.equal(room.connected.token, 'lk');
  assert.equal(c.identity, 'me'); assert.equal(c.state.micOpen, true);
  assert.equal(c.transport.micTrack.muted, true, 'push-to-talk: muted until the key');
  c.setTalking(true); await tick(); assert.equal(c.transport.micTrack.muted, false);
  c.setTalking(false); await tick(); assert.equal(c.transport.micTrack.muted, true);
  c.setPushToTalk(false); await tick(); assert.equal(c.transport.micTrack.muted, false, 'open mic');
  c.setMuted(true); await tick(); assert.equal(c.transport.micTrack.muted, true);
  assert.equal(c.stats.mints, 1); assert.equal(c.stats.connects, 1);
  c.setEnabled(false); await tick();
  assert.equal(c.state.status, 'off'); assert.ok(room.disconnected); assert.equal(c.spatial, null); assert.equal(c.state.remotes.size, 0);
});

test('voice client: the proximity frame subscribes the near, drops the far, tells the service once per place period, and places each voice\'s gain and pan every frame', async () => {
  const svc = fakeService();
  const { c, sdk, clock, ctx } = makeClient({ svc });
  c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  const room = sdk.rooms[0];
  room.addParticipant('p1'); room.addParticipant('p2');
  const peers = [{ id: 'p1', feet: [2, 0, 0] }, { id: 'p2', feet: [VOICE_SILENT_RANGE + 5, 0, 0] }];
  clock.t += VOICE_PLACE_MS;
  c.frame([0, 0, 0], 0, peers); await tick();
  assert.equal(room.remoteParticipants.get('p1').trackPublications.get('Tp1').subscribed, true);
  assert.equal(room.remoteParticipants.get('p2').trackPublications.get('Tp2').subscribed, null, 'the far one is never asked for');
  const places = svc.calls.filter(([p]) => p === '/v1/voice/place');
  assert.deepEqual(places.at(-1)[1], { token: 'v1.body.sig', room: 'cell:1', near: ['p1'] });
  // the track arrives: a row, a graph node, a place
  room.emit('ts', { kind: 'audio', mediaStream: {} }, {}, { identity: 'p1' });
  assert.ok(c.state.remotes.has('p1')); assert.ok(c.spatial.voices.has('p1'));
  c.frame([0, 0, 0], 0, peers);
  assert.equal(c.state.remotes.get('p1').gain, 1); assert.equal(c.spatial.voices.get('p1').gain.gain.value, 1);
  assert.ok(Math.abs(c.spatial.voices.get('p1').pan.pan.value - 1) < 1e-9, 'at +X facing -Z: the right ear');
  // p1 walks halfway out: the gain falls, the subscription holds
  const half = (VOICE_FULL_RANGE + VOICE_SILENT_RANGE) / 2;
  c.frame([0, 0, 0], 0, [{ id: 'p1', feet: [half, 0, 0] }]);
  assert.ok(Math.abs(c.state.remotes.get('p1').gain - 0.5) < 1e-9);
  // inside the period nothing more is said to the service
  const n = svc.calls.length; c.frame([0, 0, 0], 0, [{ id: 'p1', feet: [half, 0, 0] }]); assert.equal(svc.calls.length, n);
  // p1 past the resub edge: dropped, unsubscribed, the service told
  clock.t += VOICE_PLACE_MS;
  c.frame([0, 0, 0], 0, [{ id: 'p1', feet: [VOICE_RESUB_RANGE + 1, 0, 0] }]); await tick();
  assert.equal(room.remoteParticipants.get('p1').trackPublications.get('Tp1').subscribed, false);
  assert.ok(!c.state.remotes.has('p1')); assert.ok(!c.spatial.voices.has('p1'));
  assert.deepEqual(svc.calls.at(-1), ['/v1/voice/place', { token: 'v1.body.sig', room: 'cell:1', near: [] }]);
  // a peer the player muted plays at zero whatever the distance
  room.addParticipant('p3'); clock.t += VOICE_PLACE_MS;
  c.mutePeer('p3', true);
  c.frame([0, 0, 0], 0, [{ id: 'p3', feet: [1, 0, 0] }]); await tick();
  room.emit('ts', { kind: 'audio', mediaStream: {} }, {}, { identity: 'p3' });
  c.frame([0, 0, 0], 0, [{ id: 'p3', feet: [1, 0, 0] }]);
  assert.equal(c.spatial.voices.get('p3').gain.gain.value, 0); assert.equal(c.state.remotes.get('p3').gain, 1, 'the row still says how near');
  c.mutePeer('p3', false); assert.equal(c.spatial.voices.get('p3').gain.gain.value, 1);
  // speakers
  room.emit('as', [{ identity: 'p3' }]); assert.equal(c.state.remotes.get('p3').speaking, true);
  assert.ok(ctx.log.length > 0);
});

test('voice client: a room change re-mints for the new room; the party channel joins the party\'s room and subscribes everyone in it; no party, nothing joined', async () => {
  const svc = fakeService();
  const { c, sdk } = makeClient({ svc });
  c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  c.setRoom('dun:7'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(svc.calls.filter(([p]) => p === '/v1/voice/token').length, 2);
  assert.equal(svc.calls.at(-1)[1].room, 'dun:7'); assert.ok(sdk.rooms[0].disconnected, 'the old session is left first');
  c.setChannel('party'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.status, 'off', 'no party: nothing to join'); assert.equal(c.state.partyJoined, false);
  sdk.Room.prototype.connect = async function (url, token, o) { this.connected = { url, token, o }; this.addParticipant('mate'); };
  c.setParty('q1abc2def3'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.status, 'open'); assert.equal(c.state.partyJoined, true);
  assert.deepEqual(svc.calls.at(-1)[1], { token: 'v1.body.sig', room: 'dun:7', channel: 'party', party: 'q1abc2def3' });
  const room = sdk.rooms.at(-1);
  assert.equal(room.remoteParticipants.get('mate').trackPublications.get('Tmate').subscribed, true, 'a party room: everyone in it is heard');
  room.emit('ts', { kind: 'audio', mediaStream: {} }, {}, { identity: 'mate' });
  assert.equal(c.state.remotes.get('mate').channel, 'party'); assert.equal(c.state.remotes.get('mate').gain, 1);
  c.frame([0, 0, 0], 0, [{ id: 'mate', feet: [500, 0, 0] }]);
  assert.equal(c.spatial.voices.get('mate').gain.gain.value, 1, 'a party voice is never attenuated');
  assert.equal(svc.calls.filter(([p]) => p === '/v1/voice/place').length, 0, 'a party session places nobody');
  c.setParty(null); c.frame([0, 0, 0], 0, []); await tick();
  assert.equal(c.state.status, 'off', 'the party left: the channel closes at once');
});

test('voice client: a voice failure never stops the game - the service away, a bad answer, the SFU refusing, the token unminted - each said in words, backed off, retried; a refused microphone is a listener\'s session', async () => {
  // the service away
  let svc = fakeService({ status: 503 });
  let { c, clock } = makeClient({ svc });
  c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.status, 'error'); assert.equal(c.state.lastError, VOICE_TEXT.noService); assert.equal(c.stats.failures, 1);
  c.frame([0, 0, 0], 0, []); await settle(c); assert.equal(c.stats.connects, 1, 'inside the backoff: not asked again');
  clock.t += VOICE_RETRY_MIN_MS; c.frame([0, 0, 0], 0, []); await settle(c); assert.equal(c.stats.connects, 2, 'past it: tried again');
  clock.t += VOICE_RETRY_MIN_MS; c.frame([0, 0, 0], 0, []); await settle(c); assert.equal(c.stats.connects, 2, 'the backoff doubled');
  // a bad answer
  svc = fakeService({ answer: { ok: true, v: 1, url: 'ws://evil.example', token: 'x', identity: 'me', room: 'r', ttl: 60 } });
  ({ c } = makeClient({ svc })); c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.lastError, VOICE_TEXT.badAnswer);
  // the SFU refusing
  svc = fakeService({ answer: { ok: true, v: 1, url: 'wss://refuse.test', token: 'x', identity: 'me', room: 'r', ttl: 60 } });
  ({ c } = makeClient({ svc })); c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.match(c.state.lastError, new RegExp(`^${VOICE_TEXT.sfu}`));
  // no token
  svc = fakeService(); ({ c } = makeClient({ svc, mintToken: async () => null })); c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.lastError, VOICE_TEXT.noToken); assert.deepEqual(svc.calls, [], 'nothing asked without an identity');
  // a refused microphone: open, listening, denied said
  svc = fakeService(); ({ c } = makeClient({ svc })); c.setInputDevice('refuse');
  c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.state.status, 'denied'); assert.equal(c.state.lastError, VOICE_TEXT.denied); assert.equal(c.state.micOpen, false);
  assert.equal(c.transport.room?.connected != null, true, 'still in the room, hearing the others');
  // a transport drop mid-session: an error, cleared, retried later
  svc = fakeService(); ({ c, clock } = makeClient({ svc })); c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  c.transport.room.emit('dc', 'SERVER_SHUTDOWN'); await tick();
  assert.equal(c.state.status, 'error'); assert.match(c.state.lastError, /voice dropped: SERVER_SHUTDOWN/);
  clock.t += VOICE_RETRY_MIN_MS; c.frame([0, 0, 0], 0, []); await settle(c); assert.equal(c.state.status, 'open', 'back');
  // a reconnecting transport is said, and open again when it lands
  c.transport.room.emit('rc'); assert.equal(c.state.status, 'reconnecting'); c.transport.room.emit('rd'); assert.equal(c.state.status, 'open');
});

test('voice client: a failed retry is jittered, not a lockstep doubling - a relay deploy or SFU outage must not have every client ask again in the same instant', async () => {
  // rand() pinned low (0) and high (0.999...) brackets jittered()'s own [ms/2, 3ms/2) law onto the client's real wait
  const svc = fakeService({ status: 503 });
  const low = makeClient({ svc, rand: () => 0 });
  low.c.setEnabled(true); low.c.setRoom('cell:1'); low.c.frame([0, 0, 0], 0, []); await settle(low.c);
  assert.equal(low.c._retryAt, low.clock.t + VOICE_RETRY_MIN_MS / 2, 'rand=0: the floor of the jitter window');
  const high = makeClient({ svc, rand: () => 0.999999 });
  high.c.setEnabled(true); high.c.setRoom('cell:1'); high.c.frame([0, 0, 0], 0, []); await settle(high.c);
  assert.ok(high.c._retryAt > high.clock.t + VOICE_RETRY_MIN_MS, 'rand near 1: close to the ceiling of the jitter window, strictly past the unjittered wait');
  // two clients failing at the same instant under the SAME doubling schedule land on DIFFERENT retry times - the
  // thundering herd this fixes is every client asking again at once; distinct rand draws must give distinct _retryAt
  const a = makeClient({ svc, rand: () => 0.1 });
  a.c.setEnabled(true); a.c.setRoom('cell:1'); a.c.frame([0, 0, 0], 0, []); await settle(a.c);
  const b = makeClient({ svc, clock: a.clock, rand: () => 0.9 });
  b.c.setEnabled(true); b.c.setRoom('cell:1'); b.c.frame([0, 0, 0], 0, []); await settle(b.c);
  assert.notEqual(a.c._retryAt, b.c._retryAt, 'the same failure at the same instant retries at different times');
  // the doubling itself is still exact - only the applied wait is jittered, never the stored exponential base
  assert.equal(a.c._retryMs, VOICE_RETRY_MIN_MS * 2); assert.equal(b.c._retryMs, VOICE_RETRY_MIN_MS * 2);
});

test('voice client: the credential is re-minted before its end', async () => {
  const svc = fakeService();
  const { c, clock } = makeClient({ svc });
  c.setEnabled(true); c.setRoom('cell:1'); c.frame([0, 0, 0], 0, []); await settle(c);
  clock.t += (120 - VOICE_REMINT_AHEAD_S - 1) * 1000; c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.stats.mints, 1);
  clock.t += 2000; c.frame([0, 0, 0], 0, []); await settle(c);
  assert.equal(c.stats.mints, 2); assert.equal(c.state.status, 'open');
});

// ─── BY SOURCE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('voice by source: livekit-client is named in the transport\'s lazy import alone; every voice module opts into the type seam; the package is a dev dependency and nothing of src/ imports it statically', () => {
  const files = readdirSync(new URL('../../src/voice/', import.meta.url)).filter((f) => f.endsWith('.js')).sort();
  assert.deepEqual(files, ['voiceClient.js', 'voiceProximity.js', 'voiceSettings.js', 'voiceSpatialAudio.js', 'voiceState.js', 'voiceTransport.js', 'voiceWire.js']);
  for (const f of files) {
    const s = rd(`src/voice/${f}`);
    assert.ok(s.startsWith('// @ts-check'), `${f} opts in`);
    const names = (s.match(/livekit-client/g) ?? []).length;
    if (f === 'voiceTransport.js') { assert.equal(names, 1, 'the lazy import alone'); assert.match(s, /import\('livekit-client'\)/, 'lazy'); assert.doesNotMatch(s, /^import .* from 'livekit-client'/m); } else assert.equal(names, 0, `${f} does not know the SDK`);
  }
  const pkg = JSON.parse(rd('package.json'));
  assert.ok(pkg.devDependencies['livekit-client'], 'bundled by vite into its own chunk, loaded on the first connect');
  assert.equal(pkg.dependencies, undefined, 'the root has no runtime dependencies, as before');
  _setVoiceSdkForTests(null);
});
