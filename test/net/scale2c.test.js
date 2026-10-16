// SCALE2c (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE2c): A RELAY DEPLOY'S RECONNECT, SPREAD BY THE
// ROOM'S OWN COUNT - client only. #755's deploy dropped every player and their reconnect wave overloaded the one D1
// primary 23 s later (SCALE4e): every page's first retry was uniform over [1 s, 2 s], so every token was asked for at
// once. A page that sees a wave (two of its open sockets dropped together, the browser online) now waits one offset,
// drawn once and shared by all its sockets (so they still share one token), over a window as long as the hub takes to
// admit everyone online at its own gate. A lone drop, a busy refusal, and a drop with the network gone go as before.
// net/reconnectWave.js; the session's half driven over the pins' fake socket. tools/mutants/scale2c.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OnlineSession, BACKOFF_MIN_MS } from '../../src/net/online.js';
import { reconnectWave, waveSpreadMs, WAVE_MINTS_PER_S, WAVE_SPREAD_MAX_MS, WAVE_WINDOW_MS, WAVE_DROPS } from '../../src/net/reconnectWave.js';
import { CHAT_HELLO_HZ_MAX, CLOSE_BUSY, SOCIAL_ROOM, RELAY_VERSION } from '../../src/net/wire.js';
import { TOKEN_REUSE_MS } from '../../src/net/accountClient.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { quietFoesFrame, quietFoesGate, FOES_FRAME_OWN } from '../../src/net/foesQuiet.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { hccWireRecord } from '../../src/systems/horse/horseCartWire.js';

const quiet = (fn) => { const keep = [console.info, console.warn, console.log]; console.info = console.warn = console.log = () => {}; try { return fn(); } finally { [console.info, console.warn, console.log] = keep; } };

test('SCALE2c the spread is as long as the hub takes to admit everyone online at its own gate, capped under the token\'s reuse (mutants: the hub\'s rate unread; no cap)', () => {
  assert.equal(WAVE_MINTS_PER_S, CHAT_HELLO_HZ_MAX, 'the hub\'s own hello gate');
  assert.ok(WAVE_SPREAD_MAX_MS < TOKEN_REUSE_MS, 'a page\'s sockets still share one token across the spread');
  assert.equal(waveSpreadMs(500), 10_000, '500 online: ten seconds, as long as the hub takes to welcome them');
  assert.equal(waveSpreadMs(1_000), 20_000);
  assert.equal(waveSpreadMs(2_000), WAVE_SPREAD_MAX_MS, 'capped');
  assert.equal(waveSpreadMs(10_000), WAVE_SPREAD_MAX_MS);
  for (const none of [0, 1, -5, NaN, undefined, null, 'many']) assert.equal(waveSpreadMs(none), 0, `${String(none)}: nothing to spread`);
});

test('SCALE2c a wave is two drops inside the window while the browser is online; one offset for the whole wave, drawn once (mutants: one drop a wave; the window unread; the browser\'s word unread; an offset a drop)', () => {
  assert.equal(WAVE_DROPS, 2);
  assert.equal(WAVE_WINDOW_MS, 2_000);
  let rolls = 0;
  const w = reconnectWave({ rand: () => { rolls++; return 0.5; }, online: () => true });
  w.noteOnline(500);
  const t0 = 1_000_000;
  const a = w.dropped(t0);
  assert.equal(w.holdUntil(a, t0 + 1_500), null, 'one drop is no wave');
  const b = w.dropped(t0 + 30);
  assert.equal(rolls, 1, 'the second drop makes the wave and draws its one offset');
  w.dropped(t0 + 60);
  assert.equal(rolls, 1, 'a third drop inside it draws nothing');
  for (const d of [a, b, t0 + 60]) assert.equal(w.holdUntil(d, t0 + 1_500), t0 + 5_000, 'every drop inside it holds to the same instant: half of ten seconds');
  assert.equal(w.holdUntil(a, t0 + 5_000), null, 'past the slot, nothing more to wait for');
  assert.equal(w.holdUntil(t0 + WAVE_WINDOW_MS + 500, t0 + 3_000), null, 'a drop outside the wave is not held');

  const apart = reconnectWave({ rand: () => 0.5, online: () => true });
  apart.noteOnline(500);
  const x = apart.dropped(t0);
  apart.dropped(t0 + WAVE_WINDOW_MS + 1);
  assert.equal(apart.holdUntil(x, t0 + 1_500), null, 'two drops further apart than the window are two blips');

  const offline = reconnectWave({ rand: () => 0.5, online: () => false });
  offline.noteOnline(500);
  const y = offline.dropped(t0);
  offline.dropped(t0 + 10);
  assert.equal(offline.holdUntil(y, t0 + 1_500), null, 'the browser offline: the player\'s network, not the relay - back as soon as it can');

  const unknown = reconnectWave({ rand: () => 0.5, online: () => true });
  const z = unknown.dropped(t0);
  unknown.dropped(t0 + 10);
  assert.equal(unknown.holdUntil(z, t0 + 1_500), null, 'no count known: nothing to spread');

  const neg = reconnectWave({ rand: () => 0.5, online: () => true });
  for (const bad of [-1, 2.5, NaN, '500']) neg.noteOnline(bad);
  assert.equal(neg.online, 0, 'only a count is taken');
});

/** A page: its presence session (a cell and one halo) and its hub link, sharing one wave and one clock. */
function page({ online = () => true, roll = 0.5 } = {}) {
  let t = 1_000_000;
  const now = () => t;
  const wave = reconnectWave({ rand: () => roll, online });
  const { FakeWS, sockets } = fakeSocketClass();
  const presence = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now, rand: () => 0, wave });
  const hub = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now, rand: () => 0, presence: false, wave });
  quiet(() => {
    presence.join('world:2,12', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    presence.setHalo(['world:3,12']);
    hub.join(SOCIAL_ROOM, null);
    for (const ws of sockets) ws.open();
    hub._ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 500, v: RELAY_VERSION, now: t });
    hub.tick();
  });
  const opened = () => sockets.length;
  return { presence, hub, sockets, wave, advance: (ms) => { t += ms; quiet(() => { presence.tick(); hub.tick(); }); }, at: () => t, opened };
}

test('SCALE2c a relay deploy\'s wave: every socket the page holds - the cell, its halo, the hub - waits for the page\'s one slot and reopens in the same instant, so the page asks one token (mutants: the slot never asked; the halo not held; the hub\'s count never noted)', () => {
  const p = page();
  assert.equal(p.wave.online, 500, 'the hub link noted everyone online');
  assert.equal(p.opened(), 3);
  const [cell, halo, hub] = p.sockets;
  quiet(() => { cell.drop(1006); halo.drop(1006); hub.drop(1006); });
  p.advance(BACKOFF_MIN_MS * 2 + 100);
  assert.equal(p.opened(), 3, 'past the old [1 s, 2 s] retry, nobody has reopened: the wave holds them');
  p.advance(5_000 - (BACKOFF_MIN_MS * 2 + 100) - 1);
  assert.equal(p.opened(), 3, 'still held, a moment before the slot');
  p.advance(1);
  assert.equal(p.opened(), 6, 'at the slot - half of the ten seconds 500 online take at the hub\'s gate - all three reopen together');
  assert.deepEqual(p.sockets.slice(3).map((ws) => ws.url.split('/room/')[1]).sort(), ['chat:world', 'world:2,12', 'world:3,12']);
});

test('SCALE2c a lone drop, a busy refusal, and a drop with the network gone are no wave - back at the old retry (mutants: one drop a wave; a busy close a drop; the browser\'s word unread)', () => {
  const lone = page();
  quiet(() => lone.sockets[2].drop(1006));
  lone.advance(BACKOFF_MIN_MS * 2 + 1);
  assert.equal(lone.opened(), 4, 'one socket dropped: it is back inside [1 s, 2 s], as before');

  const busy = page();
  quiet(() => { busy.sockets[0].drop(CLOSE_BUSY, 'busy'); busy.sockets[1].drop(CLOSE_BUSY, 'busy'); busy.sockets[2].drop(1006); });
  busy.advance(BACKOFF_MIN_MS * 2 + 1);
  assert.equal(busy.opened(), 6, 'two busy refusals are a gate\'s word, not drops: the hub\'s one drop is alone and not held - everyone back at their old retries');
  assert.ok(busy.sockets.slice(3).some((ws) => ws.url.endsWith('/room/chat:world')), 'the hub among them');

  const off = page({ online: () => false });
  quiet(() => { off.sockets[0].drop(1006); off.sockets[1].drop(1006); off.sockets[2].drop(1006); });
  off.advance(BACKOFF_MIN_MS * 2 + 1);
  assert.equal(off.opened(), 6, 'the browser offline when they dropped: all back at the old retry');
});

test('SCALE2c the world host hands the page\'s one wave to the presence session and to every chat link - and a session made without one weighs only its own sockets (mutant: a link left on its own wave)', () => {
  const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /^import \{ pageWave \} from '\.\.\/net\/reconnectWave\.js';/m);
  assert.match(src, /mintToken: identityMinter,\n {6}wave: pageWave,/, 'the presence session');
  const links = src.match(/new OnlineSession\(\{[^\n]*presence: false[^\n]*\}\)/g) ?? [];
  assert.equal(links.length, 2, 'the chat links and the arena hall');
  for (const l of links) assert.match(l, /wave: pageWave/);
  const online = readFileSync(new URL('../../src/net/online.js', import.meta.url), 'utf8');
  assert.match(online, /rand = Math\.random, wave = reconnectWave\(\)(?:, wire2 = false)? \} = \{\}\) \{/, 'its own, by default: a test\'s or a tool\'s session shares nothing');   // PIN MOVED (SCALE5b): the second wire's offer beside it
});

// ═══ A FULL FOES FRAME THAT SAYS NOTHING, SAID ONCE ════════════════════════════════════════════════════════════════════

/** The frame an idle player's world host builds in a cell: the pool's own frame (nothing of mine), the camps' empty
 *  list, the horse's word for nothing standing, and the wagon's riders' none - each from its producer. */
async function idleFrame(full = true) {
  const rig = { renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() }, collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false }, fetchBytes: async (n) => { throw new Error(`no ${n} in this pin`); }, getTexture: async () => null, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } }, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5 };
  const pool = createExteriorFoes(rig);
  pool.setNet({ selfId: () => 'mac-0001', room: () => 'world:3,12', onPeerHit: () => true, toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]] });
  const frame = pool.foesFrame(full);
  if (frame && full) { frame.c = []; frame.hv = hccWireRecord({ wagon: null, horse: null }); frame.wr = null; }
  return frame;
}

test('SCALE2c an idle player\'s full foes frame - the producers\' own words for nothing - says nothing; any foe, camp, horse or unknown word is news (mutants: a number read as nothing; an object read as nothing; the bookkeeping counted as news)', async () => {
  assert.deepEqual([...FOES_FRAME_OWN], ['n', 'k', 'full']);
  const idle = await idleFrame(true);
  assert.deepEqual(idle, { n: 1, k: 'world:3,12', full: 1, f: [], c: [], hv: null, wr: null }, 'the producers\' none');
  assert.equal(quietFoesFrame(idle), true);
  assert.equal(quietFoesFrame({ ...idle, f: [{ i: 1 }] }), false, 'a foe');
  assert.equal(quietFoesFrame({ ...idle, c: [[1, 2, 3]] }), false, 'a camp');
  assert.equal(quietFoesFrame({ ...idle, hv: hccWireRecord({ horse: { position: [1, 2, 3], forward: [0, 0, 1], walking: false } }) }), false, 'a horse standing');
  assert.equal(quietFoesFrame({ ...idle, du: { s: 'x', c: [0, 0], p: 'bob' } }), false, 'a ring');
  assert.equal(quietFoesFrame({ ...idle, zz: 0 }), false, 'a word this does not know is news, whatever it says');
  assert.equal(quietFoesFrame({ ...idle, zz: {} }), false);
  assert.equal(quietFoesFrame({ ...idle, du: null, sa: null, ab: null }), true, 'a "none" word alone says nothing new');
  for (const bad of [null, undefined, [], 'frame', 3]) assert.equal(quietFoesFrame(bad), false);
});

test('SCALE2c "none" is said once to each room: the first quiet full frame goes, the next in the same cell does not; anything else - a delta, a foe, another room, a refused send, a world room - resets it (mutants: never said once; said in a dungeon; the room unread; a refusal remembered as said)', async () => {
  const g = quietFoesGate();
  const idle = await idleFrame(true);
  const cell = { full: true, cell: true, room: 'world:3,12' };
  assert.equal(g.skip(idle, cell), false, 'the first "none" goes');
  g.sent(idle, cell);
  assert.equal(g.skip(idle, cell), true, 'the next full "none" to the same cell is left unsaid');
  assert.equal(g.skip(idle, { ...cell, room: 'world:4,12' }), false, 'another cell hears it once');
  g.sent({ ...idle, f: [{ i: 1 }] }, { ...cell, full: false });
  assert.equal(g.skip(idle, cell), false, 'after a delta with a foe, the cell hears "none" again - the full frame takes that foe down');
  g.sent(idle, cell);
  g.sent(idle, cell, false);
  assert.equal(g.skip(idle, cell), false, 'a refused send said nothing');
  const host = { full: true, cell: false, room: 'dungeon:m1234' };
  g.sent(idle, host);
  assert.equal(g.skip(idle, host), false, 'a world room\'s host frame is its heartbeat - never left unsaid');
  g.sent(idle, cell);
  assert.equal(g.skip({ ...idle, full: 0 }, { ...cell, full: false }), false, 'a delta is never left unsaid');
});

test('SCALE2c the world host asks the gate before its foes frame goes and tells it after, in the cell stream alone (mutant: the skip never asked)', () => {
  const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /^import \{ quietFoesGate \} from '\.\.\/net\/foesQuiet\.js';/m);
  const at = src.indexOf('  const foesStream = (now) => {');
  const body = src.slice(at, src.indexOf('\n  };', at));
  assert.match(body, /const said = \{ full, cell, room: online\.room \};\n {4}if \(_foesQuiet\.skip\(frame, said\)\) \{ _foesFullAt = now; return false; \}\n {4}if \(!online\.sendFoes\(frame\)\) \{ _foesFullAt = -Infinity; _foesQuiet\.sent\(frame, said, false\); return false; \}/);
  assert.match(body, /if \(full\) _foesFullAt = now;\n {4}_foesQuiet\.sent\(frame, said\);\n {4}return true;/);
  assert.equal((src.match(/_foesQuiet\.skip\(/g) ?? []).length, 1, 'the cell stream alone: the own lane and the dungeon host keep every frame');
});
