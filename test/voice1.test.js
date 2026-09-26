// VOICE1: server-authoritative player speech, from chat command to positional playback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RELAY_VERSION, VOICE_RELAY_MIN, relaySupportsVoice,
  VOICE_HZ_MAX, VOICE_BURST_MAX, VOICE_ROOM_HZ_MAX, voiceGate, voiceInGate,
  validVoiceRequest, validVoicePlayback, voicePlaybackForLook,
  parseClient,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { parseChatLine, VOICE_CHAT_COMMANDS } from '../src/net/chatCommands.js';
import { parseMorrowindVoicePath, buildMorrowindVoiceCatalog, resolveMorrowindVoice } from '../src/systems/morrowindVoices.js';
import { VoiceChannels, VOICE_DISTANCE_MIN, VOICE_DISTANCE_MAX, VOICE_VOLUME_MIN, VOICE_VOLUME_MAX, voiceSoundProfile, voiceInEarshot, voiceDistance, voiceVolume } from '../src/systems/voiceChannels.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const pose = (x = 0) => ({ x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });

test('VOICE1 wire: client asks only for a closed voice key; relay resolves Daggerfall clips and stamps Morrowind race/gender', () => {
  assert.equal(VOICE_RELAY_MIN, 103);
  assert.equal(relaySupportsVoice('world102'), false);
  assert.equal(relaySupportsVoice('world103'), true);
  assert.ok(relaySupportsVoice(RELAY_VERSION));

  assert.deepEqual(validVoiceRequest({ source: 'df', type: 'attack', index: 2, clip: 999, path: 'x' }), { source: 'df', type: 'attack', index: 2 });
  assert.deepEqual(validVoiceRequest({ source: 'mw', collection: 'tb', type: 'hello', voiceId: '12a', path: 'Sound/evil.mp3' }), { source: 'mw', collection: 'tb', type: 'hello', voiceId: '12a' });
  assert.equal(validVoiceRequest({ source: 'mw', collection: 'default', type: 'hello', voiceId: '../evil' }), null);
  assert.equal(validVoiceRequest({ source: 'df', type: 'music', index: 1 }), null);

  const look = { race: 'Redguard', gender: 'female', faceIndex: 0, items: [] };
  assert.deepEqual(voicePlaybackForLook(look, { source: 'df', type: 'attack', index: 2 }), { source: 'df', clip: 44 });
  assert.deepEqual(voicePlaybackForLook(look, { source: 'mw', collection: 'default', type: 'hello', voiceId: '3' }),
    { source: 'mw', collection: 'default', type: 'hello', voiceId: '3', race: 'Redguard', gender: 'female' });
  assert.deepEqual(voicePlaybackForLook(look, { source: 'mw', collection: 'global', type: 'werewolf', voiceId: '2' }),
    { source: 'mw', collection: 'global', type: 'werewolf', voiceId: '2' });

  assert.deepEqual(validVoicePlayback({ source: 'df', clip: 44, id: 'peer-a', at: 1 }), { source: 'df', clip: 44 });
  assert.equal(validVoicePlayback({ source: 'df', clip: 999 }), null);
  assert.equal(validVoicePlayback({ source: 'mw', collection: 'default', type: 'hello', voiceId: '1', race: 'Nord', gender: 'other' }), null);

  assert.deepEqual(parseClient(JSON.stringify({ t: 'voice', source: 'df', type: 'pain', index: 1 }), { hasHello: true }),
    { t: 'voice', source: 'df', type: 'pain', index: 1 });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'voice', source: 'df', type: 'pain', index: 1 })), { error: 'voice before hello' });
});


test('VOICE1 polish: human recall never sees the old one-second throttle, while obvious macro floods still hit sender and room gates', () => {
  assert.equal(VOICE_HZ_MAX, 50);
  assert.equal(VOICE_BURST_MAX, 3);
  assert.equal(VOICE_ROOM_HZ_MAX, 256);

  let bucket = null;
  for (let i = 0; i < VOICE_BURST_MAX; i++) {
    const g = voiceGate(bucket, 1000);
    assert.equal(g.pass, true, `burst ${i + 1} passes`);
    bucket = g.bucket;
  }
  let g = voiceGate(bucket, 1000);
  assert.equal(g.pass, false, 'a zero-time macro beyond the small burst is cut');
  bucket = g.bucket;
  g = voiceGate(bucket, 1020);
  assert.equal(g.pass, true, '20 ms refills one token at 50/s - far faster than a human Y/Up/Enter cycle');

  let room = null;
  for (let i = 0; i < VOICE_ROOM_HZ_MAX; i++) {
    const x = voiceInGate(room, 2000);
    assert.equal(x.pass, true);
    room = x.bucket;
  }
  assert.equal(voiceInGate(room, 2000).pass, false, 'the room still has a hard instantaneous flood ceiling');
});

test('VOICE1 relay: the real room resolves from the hello look, echoes the sender, fans in range, and never rebroadcasts a client path', async () => {
  const room = fakeRoom('town:m1');
  const a = room.connect(), b = room.connect();
  const redguard = { race: 'Redguard', gender: 'female', faceIndex: 0, items: [] };
  await room.hello(a, 'peer-a', pose(0), { name: 'Ann', look: redguard });
  await room.hello(b, 'peer-b', pose(2), { name: 'Bob' });
  a.sent.length = 0; b.sent.length = 0;

  await room.raw(a, JSON.stringify({ t: 'voice', source: 'df', type: 'attack', index: 2, clip: 999, path: 'Sound/evil.mp3' }));
  const dfA = a.sent.find((m) => m.t === 'voice');
  const dfB = b.sent.find((m) => m.t === 'voice');
  assert.deepEqual({ id: dfA.id, source: dfA.source, clip: dfA.clip }, { id: 'peer-a', source: 'df', clip: 44 });
  assert.deepEqual({ id: dfB.id, source: dfB.source, clip: dfB.clip }, { id: 'peer-a', source: 'df', clip: 44 });
  assert.equal('path' in dfA, false);
  assert.equal('type' in dfA, false);

  // voiceGate is one per second; move the room clock far enough by replacing Date.now for the second ask.
  const realNow = Date.now;
  let now = realNow() + 2000;
  Date.now = () => now;
  try {
    a.sent.length = 0; b.sent.length = 0;
    await room.raw(a, JSON.stringify({ t: 'voice', source: 'mw', collection: 'tb', type: 'hello', voiceId: '4', path: '../evil' }));
    const mw = a.sent.find((m) => m.t === 'voice');
    assert.deepEqual(
      { id: mw.id, source: mw.source, collection: mw.collection, type: mw.type, voiceId: mw.voiceId, race: mw.race, gender: mw.gender },
      { id: 'peer-a', source: 'mw', collection: 'tb', type: 'hello', voiceId: '4', race: 'Redguard', gender: 'female' },
    );
    assert.equal('path' in mw, false);
  } finally { Date.now = realNow; }
});



test('VOICE-RANGE2: speech range and global voice volume are listener-side prefs, live and clamped', () => {
  const oldDistance = getPref('voiceDistance');
  const oldVolume = getPref('voiceVolume');
  try {
    setPref('voiceDistance', 45);
    setPref('voiceVolume', 1);
    assert.deepEqual(voiceSoundProfile(), { refDistance: 8, maxDistance: 45, distanceModel: 'linear' });
    assert.equal(voiceInEarshot([0, 0, 44], [0, 0, 0]), true);
    assert.equal(voiceInEarshot([0, 0, 46], [0, 0, 0]), false);
    assert.equal(voiceVolume(), 1);

    setPref('voiceDistance', 80);
    setPref('voiceVolume', 1.5);
    assert.equal(voiceSoundProfile().maxDistance, 80);
    assert.equal(voiceInEarshot([0, 0, 79], [0, 0, 0]), true);
    assert.equal(voiceVolume(), 1.5);

    setPref('voiceDistance', 9999);
    setPref('voiceVolume', 99);
    assert.equal(voiceDistance(), VOICE_DISTANCE_MAX);
    assert.equal(voiceVolume(), VOICE_VOLUME_MAX);

    setPref('voiceDistance', -50);
    setPref('voiceVolume', -2);
    assert.equal(voiceDistance(), VOICE_DISTANCE_MIN);
    assert.equal(voiceVolume(), VOICE_VOLUME_MIN);
  } finally {
    setPref('voiceDistance', oldDistance);
    setPref('voiceVolume', oldVolume);
  }
});

test('VOICE-CUT1: each speaker owns one interruptible line; replacement cuts immediately and stale async completions are killed', () => {
  const ch = new VoiceChannels();
  const stopped = [];
  const moved = [];
  const handle = (name, mobile = false) => ({ stop: () => stopped.push(name), ...(mobile ? { move: (p) => moved.push([name, p]) } : {}) });

  const a1 = ch.replace('alice');
  assert.equal(ch.attach('alice', a1, handle('alice-1')), true);

  const b1 = ch.replace('bob');
  assert.equal(ch.attach('bob', b1, handle('bob-1')), true);
  assert.deepEqual(stopped, [], 'different speakers may overlap');

  const a2 = ch.replace('alice');
  assert.deepEqual(stopped, ['alice-1'], 'a new line cuts only that speaker immediately');

  assert.equal(ch.attach('alice', a1, handle('alice-stale')), false);
  assert.deepEqual(stopped, ['alice-1', 'alice-stale'], 'a late async decode from the old generation is stopped');

  assert.equal(ch.attach('alice', a2, handle('alice-2', true)), true);
  ch.syncPositions(new Map([['alice', { shown: [4, 5, 6] }], ['bob', { shown: [1, 1, 1] }]]), (p) => p.map((n) => n + 1));
  assert.deepEqual(moved, [['alice-2', [5, 6, 7]]], 'VOICE-MOVE1: only positional handles follow the current remote pose');
  const a3 = ch.replace('alice');
  assert.equal(a3, a2 + 1);
  assert.deepEqual(stopped, ['alice-1', 'alice-stale', 'alice-2']);

  const c1 = ch.replace('carol');
  assert.equal(ch.attach('carol', c1, handle('carol-1', true)), true);
  ch.syncPositions(new Map(), (p) => p);
  assert.deepEqual(stopped, ['alice-1', 'alice-stale', 'alice-2', 'carol-1'], 'VOICE-MOVE1: a positional line stops when its speaker leaves the roster');

  ch.clear();
  assert.deepEqual(stopped, ['alice-1', 'alice-stale', 'alice-2', 'carol-1', 'bob-1'], 'clear stops the other speaker too');
});

test('VOICE1 client: a presence session sends only to a capable relay, validates inbound playback, and channel sessions cannot emit voices', () => {
  const rig = (presence = true, version = RELAY_VERSION) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({
      url: 'wss://relay.test', name: 'Ann', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001',
      look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] },
      presence, WebSocketImpl: FakeWS, now: () => 1_000_000,
    });
    const heard = [];
    s.onVoice = (line) => heard.push(line);
    s.join('town:m1', pose());
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v: version });
    return { s, ws: sockets[0], heard, out: () => sockets[0].sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'voice') };
  };

  const old = rig(true, 'world102');
  assert.equal(old.s.sendVoice({ source: 'df', type: 'attack', index: 1 }), false);
  assert.equal(old.out().length, 0);

  const current = rig();
  assert.equal(current.s.sendVoice({ source: 'df', type: 'attack', index: 1 }), true);
  assert.deepEqual(current.out().at(-1), { t: 'voice', source: 'df', type: 'attack', index: 1 });
  current.ws.receive({ t: 'join', id: 'bbbb-0002', name: 'Bob', look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, pose: pose(2) });
  current.ws.receive({ t: 'voice', id: 'bbbb-0002', source: 'df', clip: 390, at: 1 });
  current.ws.receive({ t: 'voice', id: 'ghost-0003', source: 'df', clip: 390, at: 2 });
  current.ws.receive({ t: 'voice', id: 'bbbb-0002', source: 'df', clip: 999, at: 3 });
  assert.equal(current.heard.length, 1);
  assert.deepEqual(current.heard[0].playback, { source: 'df', clip: 390 });

  const channel = rig(false);
  assert.equal(channel.s.sendVoice({ source: 'df', type: 'attack', index: 1 }), false);
});

test('VOICE1 chat grammar: /speech mirrors the server command, /voice and /v alias it, while /s remains Local chat', () => {
  assert.deepEqual(parseChatLine('/speech hello 1', VOICE_CHAT_COMMANDS),
    { kind: 'voice', request: { source: 'mw', collection: 'default', type: 'hello', voiceId: '1' } });
  assert.deepEqual(parseChatLine('/voice tb_hello 12a', VOICE_CHAT_COMMANDS),
    { kind: 'voice', request: { source: 'mw', collection: 'tb', type: 'hello', voiceId: '12a' } });
  assert.deepEqual(parseChatLine('/v df attack 2', VOICE_CHAT_COMMANDS),
    { kind: 'voice', request: { source: 'df', type: 'attack', index: 2 } });
  assert.deepEqual(parseChatLine('/speechhelp', VOICE_CHAT_COMMANDS), { kind: 'voicehelp' });
  assert.deepEqual(parseChatLine('/speech extra 2', VOICE_CHAT_COMMANDS),
    { kind: 'voice', request: { source: 'mw', collection: 'global', type: 'special', voiceId: '2' } });
  assert.equal(parseChatLine('/speech nope', VOICE_CHAT_COMMANDS).kind, 'badvoice');
  assert.deepEqual(parseChatLine('/s hello', VOICE_CHAT_COMMANDS), { kind: 'channel', tab: 'local', text: 'hello', wrap: null });
});

test('VOICE1 Morrowind catalog: Sound/Vo paths are parsed by race, gender, expansion collection and globals, then resolved by the relay-stamped key', () => {
  assert.deepEqual(parseMorrowindVoicePath('Sound/Vo/B/F/Hlo_BF1.mp3'),
    { collection: 'default', type: 'hello', voiceId: '1', race: 'Breton', gender: 'female', path: 'sound/vo/b/f/hlo_bf1.mp3' });
  assert.deepEqual(parseMorrowindVoicePath('Sound/Vo/B/F/THlo_BF2.wav'),
    { collection: 'tb', type: 'hello', voiceId: '2', race: 'Breton', gender: 'female', path: 'sound/vo/b/f/thlo_bf2.wav' });
  assert.deepEqual(parseMorrowindVoicePath('Sound/Vo/V/Hlo_VBF3.mp3'),
    { collection: 'vampire', type: 'hello', voiceId: '3', race: 'Breton', gender: 'female', path: 'sound/vo/v/hlo_vbf3.mp3' });
  assert.deepEqual(parseMorrowindVoicePath('Sound/Vo/Ord/Hlo_Orm4.mp3'),
    { collection: 'ord', type: 'hello', voiceId: '4', race: 'DarkElf', gender: 'any', path: 'sound/vo/ord/hlo_orm4.mp3' });
  assert.deepEqual(parseMorrowindVoicePath('Sound/Vo/WW/howl01.mp3'),
    { collection: 'global', type: 'werewolf', path: 'sound/vo/ww/howl01.mp3' });

  const bytes = new Uint8Array([1, 2, 3]);
  const archive = {
    names: ['Sound/Vo/B/F/Hlo_BF1.mp3', 'Sound/Vo/B/F/THlo_BF2.wav', 'Sound/Vo/Misc/a.mp3', 'Sound/Vo/Misc/b.mp3'],
    get: () => bytes,
  };
  const c = buildMorrowindVoiceCatalog([archive]);
  assert.equal(resolveMorrowindVoice(c, { source: 'mw', collection: 'default', type: 'hello', voiceId: '1', race: 'Breton', gender: 'female' }).path,
    'sound/vo/b/f/hlo_bf1.mp3');
  assert.equal(resolveMorrowindVoice(c, { source: 'mw', collection: 'tb', type: 'hello', voiceId: '2', race: 'Breton', gender: 'female' }).path,
    'sound/vo/b/f/thlo_bf2.wav');
  assert.equal(resolveMorrowindVoice(c, { source: 'mw', collection: 'global', type: 'misc', voiceId: '2' }).path,
    'sound/vo/misc/b.mp3');
});
