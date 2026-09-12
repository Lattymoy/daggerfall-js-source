// WORLD2 (Mac, 2026-09-12: "Lets continue on with the next phase") -
// SLICE 2: ONE SIMULATION PER ROOM. The host's foes are everyone's: the
// host streams each changed layout foe's state a few times a second
// ({t:'foes', data}, FOES_HZ_MAX on its own bucket, to everyone but the
// host), a joiner's layout foes are PUPPETS that mirror it and decide
// nothing, a joiner's own blows on a puppet go to the host as a hit
// ({t:'hit', data}, to the host's socket alone) and are applied through
// the host's own damage door, and the seat's handover (the relay's host
// frame) makes the puppets live. THE ARM EXECUTES: the wire (the two
// frames after hello, objects, the foes frame admitted past
// MAX_FRAME_BYTES by its prefix up to FOES_FRAME_MAX, the hit under the
// small cap, the constants one home); the Room over the one fake (the
// stream fanned to everyone but the host, a non-host's ignored unparsed,
// the stream's own bucket, a hit to the host alone and never the host's
// own, a town relaying neither, the seat's move re-routing the hits);
// the session (sendFoes the host's alone in a world room under the
// stream's own gate and the cap, sendHit anyone else's, onFoes from the
// room's host alone, onHit while hosting alone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClient, frameCap, foesGate, FOES_FRAME_MAX, FOES_HZ_MAX, FOES_PREFIX, WORLD_PREFIX, WORLD_FRAME_MAX, MAX_FRAME_BYTES, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { OnlineSession, FOES_MS, FOES_FULL_MS } from '../src/net/online.js';
import { readFileSync } from 'node:fs';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnhancedEnemyAI } from '../src/ai/enhancedMotor.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('WORLD2: the wire - a foes frame and a hit are objects from a hello\'d socket; the foes frame is the other one admitted past MAX_FRAME_BYTES, by its prefix, up to FOES_FRAME_MAX and never past it whatever prefix it wore; the hit keeps the small cap; the stream\'s gate is its own; one home at both ends', () => {
  assert.equal(FOES_FRAME_MAX, 64 * 1024); assert.equal(FOES_HZ_MAX, 12); assert.equal(FOES_PREFIX, '{"t":"foes"');
  assert.ok(FOES_FRAME_MAX < WORLD_FRAME_MAX && FOES_FRAME_MAX > MAX_FRAME_BYTES, 'a delta, larger than a pose and smaller than the memory');
  for (const k of ['frameCap', 'foesGate', 'FOES_FRAME_MAX', 'FOES_HZ_MAX', 'FOES_PREFIX']) assert.equal(relay[k], { frameCap, foesGate, FOES_FRAME_MAX, FOES_HZ_MAX, FOES_PREFIX }[k], `${k} at both ends`);
  assert.equal(frameCap(WORLD_PREFIX + 'x'), WORLD_FRAME_MAX); assert.equal(frameCap(FOES_PREFIX + 'x'), FOES_FRAME_MAX); assert.equal(frameCap('{"t":"pose"'), MAX_FRAME_BYTES); assert.equal(frameCap(''), MAX_FRAME_BYTES);
  assert.ok(JSON.stringify({ t: 'foes', data: {} }).startsWith(FOES_PREFIX), 'the prefix is what the client mints');
  const foes = { seq: 1, f: [{ i: 0, f: [1, 2, 3], y: 0.5, h: 10, d: 0 }] };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: foes }), { hasHello: true }), { t: 'foes', data: foes });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: foes })), { error: 'foes before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes' }), { hasHello: true }), { error: 'bad foes' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: [1] }), { hasHello: true }), { error: 'bad foes' });
  const hit = { i: 3, dmg: 12, kind: 'melee' };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: hit }), { hasHello: true }), { t: 'hit', data: hit });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: hit })), { error: 'hit before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: 'x' }), { hasHello: true }), { error: 'bad hit' });
  assert.equal(parseClient(JSON.stringify({ t: 'foes', data: { pad: 'x'.repeat(MAX_FRAME_BYTES * 2) } }), { hasHello: true }).t, 'foes', 'a foes frame past MAX_FRAME_BYTES parses');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: { pad: 'x'.repeat(FOES_FRAME_MAX) } }), { hasHello: true }), { error: 'frame too large' }, 'and past FOES_FRAME_MAX does not');
  assert.deepEqual(parseClient('{"t":"world","pad":"' + 'x'.repeat(FOES_FRAME_MAX) + '","t":"foes","data":{}}', { hasHello: true }), { error: 'frame too large' }, 'the world prefix earns a foes frame nothing past its own cap');
  assert.deepEqual(parseClient(JSON.stringify({ data: { pad: 'x'.repeat(MAX_FRAME_BYTES * 2) }, t: 'foes' }), { hasHello: true }), { error: 'frame too large' }, 'without the prefix: the small cap, before any parse');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: { pad: 'x'.repeat(MAX_FRAME_BYTES) } }), { hasHello: true }), { error: 'frame too large' }, 'a hit keeps the small cap');
  assert.deepEqual(parseClient('{"t":"foes","pad":"' + 'x'.repeat(MAX_FRAME_BYTES * 2) + '","t":"hit","data":{}}', { hasHello: true }), { error: 'frame too large' }, 'the foes prefix earns a hit nothing (AUDIT WORLD A2\'s law)');
  let b = null, passed = 0;
  for (let i = 0; i < FOES_HZ_MAX + 5; i++) { const g = foesGate(b, 1000); b = g.bucket; if (g.pass) passed++; }
  assert.equal(passed, FOES_HZ_MAX, 'the stream\'s burst is FOES_HZ_MAX');
});

test('WORLD2: the Room - the host\'s foes frame reaches everyone hello\'d but the host, as {t:\'foes\', id, data}; a non-host\'s is ignored - a prefixed one unparsed - and no one is closed; the stream spends its own bucket, not the poses\'; a hit from anyone but the host reaches the host\'s socket alone, the host\'s own goes nowhere; a town relays neither; the seat\'s move re-routes the hits', async () => {
  const r = fakeRoom('dungeon:m187');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1)); await r.hello(c, 'cccc-0003', at(1, 1));
  const foes = { seq: 7, f: [{ i: 2, f: [10, 0, 10], y: 1, h: 5, d: 0 }] };
  await r.raw(a, JSON.stringify({ t: 'foes', data: foes }));
  assert.deepEqual(ofType(b, 'foes'), [{ t: 'foes', id: 'aaaa-0001', data: foes }], 'the stream, with the host\'s id');
  assert.deepEqual(ofType(c, 'foes'), [{ t: 'foes', id: 'aaaa-0001', data: foes }]);
  assert.equal(ofType(a, 'foes').length, 0, 'never back to the host');
  const big = { seq: 8, pad: 'p'.repeat(MAX_FRAME_BYTES * 2) };
  await r.raw(a, JSON.stringify({ t: 'foes', data: big }));
  assert.deepEqual(ofType(b, 'foes').at(-1).data, big, 'a frame past the small cap goes through by its prefix');
  await r.raw(b, JSON.stringify({ t: 'foes', data: foes }));
  await r.raw(b, FOES_PREFIX + 'x'.repeat(MAX_FRAME_BYTES * 2));
  assert.equal(ofType(c, 'foes').length, 2, 'a non-host\'s stream reaches no one (the two above are the host\'s)'); assert.equal(ofType(a, 'foes').length, 0);
  assert.equal(b.closed, null, 'and its junk after the prefix was never parsed'); assert.equal(ofType(b, 'error').length, 0);
  // the stream's own bucket: the poses' stands untouched
  const poseBucket = JSON.stringify(a.att.bucket);
  let sent = 0; for (let i = 0; i < 40; i++) { await r.raw(a, JSON.stringify({ t: 'foes', data: { seq: 100 + i } })); sent++; }
  const got = ofType(b, 'foes').length - 2;
  assert.ok(got >= FOES_HZ_MAX - 2 && got < sent, `FOES_HZ_MAX a second on the stream's bucket (two spent above): ${got} of ${sent} relayed`);
  assert.equal(JSON.stringify(a.att.bucket), poseBucket, 'the pose bucket spent nothing on the stream'); assert.ok(a.att.fbucket, 'the stream\'s own');
  assert.equal(a.closed, null, 'over the rate: dropped, the host not struck out for a burst');
  // the hit: to the host alone
  const hit = { i: 2, dmg: 9, kind: 'melee' };
  await r.raw(b, JSON.stringify({ t: 'hit', data: hit }));
  assert.deepEqual(ofType(a, 'hit'), [{ t: 'hit', id: 'bbbb-0002', data: hit }], 'the host hears the blow with the striker\'s id');
  assert.equal(ofType(c, 'hit').length, 0, 'no one else'); assert.equal(ofType(b, 'hit').length, 0, 'not the striker');
  await r.raw(a, JSON.stringify({ t: 'hit', data: hit }));
  assert.equal(ofType(b, 'hit').length + ofType(c, 'hit').length, 0, 'the host\'s own blow goes nowhere: it applies its own');
  // the seat moves: the hits follow it
  await r.drop(a);
  await r.raw(c, JSON.stringify({ t: 'hit', data: hit }));
  assert.deepEqual(ofType(b, 'hit'), [{ t: 'hit', id: 'cccc-0003', data: hit }], 'the new host hears the blow');
  const cHad = ofType(c, 'foes').length;
  await r.raw(b, JSON.stringify({ t: 'foes', data: foes }));
  assert.deepEqual(ofType(c, 'foes').at(-1), { t: 'foes', id: 'bbbb-0002', data: foes }, 'and streams'); assert.equal(ofType(c, 'foes').length, cHad + 1);
  // a town keeps no simulation
  const town = fakeRoom('town:m9');
  const t = town.connect(), u = town.connect();
  await town.hello(t, 'town-0001', at(1, 1)); await town.hello(u, 'town-0002', at(1, 1));
  await town.raw(t, JSON.stringify({ t: 'foes', data: foes })); await town.raw(u, JSON.stringify({ t: 'hit', data: hit }));
  assert.equal(ofType(u, 'foes').length + ofType(t, 'hit').length, 0, 'a town relays neither'); assert.equal(t.closed, null); assert.equal(u.closed, null);
});

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(s); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

test('WORLD2: the session - sendFoes is the host\'s alone, in a world room, under the stream\'s own gate and its cap, t first; sendHit is anyone else\'s; onFoes hears the room\'s host alone (never a peer, never myself); onHit hears anyone while I host and no one otherwise', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const foesIn = [], hitsIn = [];
  s.onFoes = (id, data) => foesIn.push([id, data]); s.onHit = (id, data) => hitsIn.push([id, data]);
  assert.equal(s.stats.foes, 0); assert.equal(s.stats.hits, 0);
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  const foes = { seq: 1, f: [] }, hit = { i: 0, dmg: 3, kind: 'arrow' };
  assert.equal(s.sendFoes(foes), false, 'not the host: no stream');
  assert.equal(s.sendHit(hit), true, 'a blow goes to the host'); assert.equal(ws.sent.at(-1), '{"t":"hit","data":{"i":0,"dmg":3,"kind":"arrow"}}');
  assert.equal(s.sendHit({ pad: 'x'.repeat(MAX_FRAME_BYTES) }), false, 'under the small cap'); assert.equal(s.sendHit([1]), false); assert.equal(s.sendHit(null), false);
  ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
  assert.deepEqual(foesIn, [['bob-0002', foes]], 'the host\'s stream in');
  ws.receive({ t: 'foes', id: 'eve-0003', data: foes }); ws.receive({ t: 'foes', id: 'mac-0001', data: foes }); ws.receive({ t: 'foes', id: 'bob-0002', data: [1] });
  assert.equal(foesIn.length, 1, 'a peer\'s, my own, a malformed one: not the world');
  ws.receive({ t: 'hit', id: 'eve-0003', data: hit });
  assert.equal(hitsIn.length, 0, 'not hosting: no blow is mine to apply');
  ws.receive({ t: 'host', id: 'mac-0001' });
  assert.equal(s.sendHit(hit), false, 'the host applies its own blows');
  assert.equal(s.sendFoes(foes), true); assert.equal(ws.sent.at(-1), '{"t":"foes","data":{"seq":1,"f":[]}}', 't first: the relay\'s door reads the prefix');
  assert.equal(s.sendFoes({ pad: 'x'.repeat(FOES_FRAME_MAX) }), false, 'past the cap: kept home');
  let passed = 1; for (let i = 0; i < FOES_HZ_MAX + 5; i++) if (s.sendFoes({ seq: i })) passed++;
  assert.equal(passed, FOES_HZ_MAX, 'the stream\'s own gate at home: the relay never strikes the host');
  now += 1000; assert.equal(s.sendFoes({ seq: 99 }), true, 'a second on: refilled');
  assert.equal(s.stats.foes, FOES_HZ_MAX + 1); assert.equal(s.stats.hits, 1);
  ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
  assert.equal(foesIn.length, 1, 'hosting: a stream from another is not the world');
  ws.receive({ t: 'hit', id: 'eve-0003', data: hit }); ws.receive({ t: 'hit', id: 'mac-0001', data: hit }); ws.receive({ t: 'hit', id: 'eve-0003', data: 'x' });
  assert.deepEqual(hitsIn, [['eve-0003', hit]], 'hosting: a blow from anyone else, with the striker\'s id');
  // a town: nothing out
  s.join('town:m9', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws2 = sockets[1]; ws2.open(); ws2.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null });
  assert.equal(s.sendFoes(foes), false, 'a town streams no foes'); assert.equal(s.sendHit(hit), false);
});

test('WORLD2: the hosts by source - the dungeon host\'s hit door first in damageFoe (a puppet\'s blow goes out with its kind, a fall\'s or a foe\'s dropped), the kind riding the spell and arrow doors; the puppet branch in the foe loop with the attack count and its ranged bit; puppetStep (eased or snapped, the hurt once, the latches cleared); the frame out (the changed alone unless full), the frame in (never the authority\'s, never stale, the attack once per count and never the count it arrived with, death through the one kill door), the hit in (the host\'s door, the layout\'s foes alone), the handover (the motor resumed, the machines idle, the stream from every foe); the mode machine and the world host; the motor resumes live from a puppet\'s pose, executed', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /let _authority = true;\s*let _foesSeq = 0;[^\n]*\n\s*let _foesSeqIn = -1;/, 'the state');
  assert.match(d, /function damageFoe\(foe, damage, playerFeet = null, knockDir = null, \{ fromPlayer = true, bypassShield = false, kind = 'melee' \} = \{\}\) \{\s*(?:\/\/[^\n]*\n\s*)*if \(!_authority\) \{\s*const pi = foes\.indexOf\(foe\);\s*if \(pi >= 0 && pi < _layoutFoes\) \{ if \(fromPlayer && damage > 0\) opts\.onFoeHit\?\.\(\{ i: pi, dmg: damage, kind \}\); return; \}\s*\}\s*markFoeStruck\(foe/, 'the hit door: first - before the HUD, the aggro, the shield, the health');
  assert.match(d, /hurt: \(n\) => damageFoe\(f, n, null, null, \{ kind: 'spell' \}\)/, 'a spell\'s kind'); assert.match(d, /damageFoe\(t, d, lastPlayerFeet, m\.dir, \{ kind: 'arrow' \}\)/, 'an arrow\'s kind');
  assert.match(d, /let _fi = -1;\s*for \(const f of foes\) \{\s*_fi\+\+;\s*if \(f\.dead\) continue;/, 'the loop counts');
  assert.match(d, /const _puppet = !_authority && _fi < _layoutFoes;\s*let _tgt = null, _strikeEdge = false;\s*if \(_puppet\) \{\s*_strikeEdge = puppetStep\(f, dt\);\s*f\.sounds \?\?= new EnemySoundSource\(f\.mobileType\);\s*tickEnemySound\([^\n]*\n\s*if \(_strikeEdge\) playEnemyClip\(audio, f\.sounds\.attack\(\), f\.ai\.feet, acuteHearingMultiplier\(playerEntity\)\);[^\n]*\n\s*\}\s*else \{/, 'the branch: a puppet steps by the stream - its barks and its swing\'s sound its own - the authority by itself');
  assert.match(d, /\}   \/\/ WORLD2: the end of the authority's own step - a puppet skipped it\s*if \(f\.mobile\) \{/, 'and the mobile arm draws both');
  assert.match(d, /if \(_strikeEdge\) f\._atkA = \(\(\(f\._atkA \| 0\) >> 1\) \+ 1\) \* 2 \+ \(f\.attack\.firedRanged \? 1 : 0\);/, 'the attack count, the ranged bit low');
  assert.match(d, /function puppetStep\(f, dt\) \{[\s\S]*?if \(d2 > PUPPET_SNAP \* PUPPET_SNAP\) \{ feet\[0\] = t\[0\]; feet\[1\] = t\[1\]; feet\[2\] = t\[2\]; \}\s*else \{ const k = Math\.min\(1, dt \/ PUPPET_EASE_S\); feet\[0\] \+= dx \* k;[\s\S]*?f\.ai\.hurtKnock = p\.hurt; p\.hurt = false;\s*if \(p\.strike != null\) \{ edge = true; if \(f\.attack\) f\.attack\.firedRanged = p\.strike === 'ranged'; p\.strike = null; \}[\s\S]*?if \(f\.mobile\) \{ f\.mobile\.doMeleeDamage = false; f\.mobile\.shootArrow = false; \}[^\n]*\n\s*f\._castPending = false;\s*return edge;/, 'the puppet: eased or snapped in place (the batch aliases the feet), the hurt once, the edge once, the latches cleared');
  assert.match(d, /const PUPPET_EASE_S = 0\.2;/, 'the stream\'s interval'); assert.equal(FOES_MS, 200, 'and it is FOES_MS'); assert.ok(FOES_FULL_MS > FOES_MS);
  assert.match(d, /function foesFrame\(full = false\) \{\s*if \(!_authority\) return null;[\s\S]*?const r = \{ i, f: \[q2\(f\.ai\.feet\[0\]\), q2\(f\.ai\.feet\[1\]\), q2\(f\.ai\.feet\[2\]\)\], y: q3\(f\.ai\.yaw\), h: f\.entity\.health, d: f\.dead \? 1 : 0, a: f\._atkA \| 0, m: f\.ai\.moving \? 1 : 0 \};[\s\S]*?if \(!full && f\._sentKey === key\) continue;[\s\S]*?if \(!out\.length\) return null;\s*return \{ n: \+\+_foesSeq, f: out \};/, 'the frame out: the changed alone unless full, nothing when nothing');
  assert.match(d, /function applyFoes\(data\) \{\s*if \(_authority \|\| !data \|\| !Array\.isArray\(data\.f\)\) return false;\s*if \(Number\.isFinite\(data\.n\)\) \{ if \(data\.n <= _foesSeqIn\) return false; _foesSeqIn = data\.n; \}/, 'the frame in: never the authority\'s, never stale');
  assert.match(d, /if \(Number\.isFinite\(r\.h\)\) \{ if \(r\.h < f\.entity\.health\) p\.hurt = true; f\.entity\.health = r\.h; \}/, 'a drop is the hurt');
  assert.match(d, /if \(r\.a != null\) \{ const a = r\.a \| 0; if \(p\.a != null && a !== p\.a\) p\.strike = \(a & 1\) \? 'ranged' : 'melee'; p\.a = a; \}/, 'the attack once per count, never the count it arrived with');
  assert.match(d, /if \(r\.d === 1\) setFoeDead\(f, true\); else if \(r\.d === 0\) setFoeDead\(f, false\);/, 'death through the one kill door');
  assert.match(d, /function applyHit\(id, data\) \{\s*if \(!_authority \|\| !data \|\| typeof data !== 'object'\) return false;[\s\S]*?if \(!f \|\| i >= _layoutFoes \|\| f\.dead \|\| !Number\.isFinite\(dmg\) \|\| dmg <= 0\) return false;\s*damageFoe\(f, dmg, null, null, \{ fromPlayer: true, kind: data\.kind === 'arrow' \|\| data\.kind === 'spell' \? data\.kind : 'melee' \}\);/, 'the hit in: the host\'s door, the layout\'s foes alone, a finite blow');
  assert.match(d, /function setAuthority\(on\) \{\s*on = !!on;\s*if \(on === _authority\) return;\s*_authority = on;\s*_foesSeqIn = -1;[\s\S]*?if \(p\) \{ f\.ai\.feet\[0\] = p\.feet\[0\];[\s\S]*?f\.ai\.resumeLive\?\.\(\);[\s\S]*?f\._prevMState = 'Idle';[\s\S]*?f\._pup = null;\s*f\._sentKey = null;/, 'the handover: the puppet\'s pose stands, the motor resumes, no phantom edge, the stream from every foe');
  assert.match(d, /function setFoeDead\(f, dead\) \{\s*if \(dead\) \{ if \(!f\.dead\) \{ f\.dead = true; spawnCorpse\(f\); \} return; \}\s*if \(!f\.dead\) return;\s*f\.dead = false;\s*if \(f\.corpseBatch\) \{/, 'one kill door for the save and the stream');
  assert.match(d, /if \(sf\.dead && !f\.dead\) setFoeDead\(f, true\);/); assert.match(d, /else if \(!sf\.dead && f\.dead\) setFoeDead\(f, false\);/);
  assert.match(d, /    foesFrame,\s*applyFoes,\s*applyHit,\s*setAuthority,\s*isAuthority: \(\) => _authority,/, 'the API');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /onFoeHit: \(hit\) => host\.onFoeHit\?\.\(hit\),/, 'the hit routed into the build');
  assert.match(m, /dungeonCtx = ctx;\s*_dungeonAuthority = host\.dungeonAuthority\?\.\(\) \?\? true; ctx\.setAuthority\?\.\(_dungeonAuthority\);/, 'a dungeon built under the seat as it stands');
  assert.match(m, /setDungeonAuthority\(on\) \{ _dungeonAuthority = !!on; dungeonCtx\?\.setAuthority\?\.\(_dungeonAuthority\); \},/, 'the seat kept for the next dungeon');
  assert.match(m, /dungeonFoesFrame\(full = false\) \{ return mode === 'dungeon' && dungeonCtx \? \(dungeonCtx\.foesFrame\?\.\(full\) \?\? null\) : null; \},/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /const foesStream = \(now\) => \{\s*if \(!online \|\| !online\.isHost\(\) \|\| online\.status !== 'open' \|\| !isWorldRoom\(online\.room\)\) return false;\s*if \(now - _foesSentAt < FOES_MS\) return false;\s*const full = now - _foesFullAt >= FOES_FULL_MS;\s*const frame = modes\?\.dungeonFoesFrame\?\.\(full\);\s*if \(!frame\) return false;\s*_foesSentAt = now;\s*if \(!online\.sendFoes\(frame\)\) return false;\s*if \(full\) _foesFullAt = now;/, 'the stream: the host\'s, in a world room, FOES_MS apart, every foe FOES_FULL_MS apart');
  assert.match(w, /const dungeonAuthority = \(\) => !\(online\?\.room && isWorldRoom\(online\.room\) && online\.status === 'open' && !online\.isHost\(\)\);/, 'the seat: mine unless a world room\'s open socket says another');
  assert.match(w, /online\.onFoes = \(id, data\) => \{ modes\?\.applyDungeonFoes\?\.\(data\); \};\s*online\.onHit = \(id, data\) => \{ modes\?\.applyDungeonHit\?\.\(id, data\); \};/, 'the stream and the hits routed');
  assert.match(w, /worldPublish\(now\);[^\n]*\n\s*foesStream\(now\);/, 'every frame asks'); assert.match(w, /onFoeHit: \(hit\) => online\?\.sendHit\(hit\) \?\? false,/, 'a puppet\'s blow out');
  // the motor's resume, executed: a puppet's pose stands, everything decided is forgotten
  for (const AI of [EnemyAI, EnhancedEnemyAI]) {
    const ai = new AI({ raycast: () => null, groundAt: () => 0 }, [1, 2, 3], 0.5, {});
    ai.feet[0] = 10; ai.feet[1] = 4; ai.feet[2] = 20; ai.yaw = 1.25;
    Object.assign(ai, { lastGroundedY: 30, _airborne: true, velY: -9, landedFall: 2, target: { x: 1 }, secondaryTarget: { x: 2 }, targetSenses: {}, lastKnownTargetPos: [0, 0, 0], oldLastKnownTargetPos: [0, 0, 0], predictedTargetPos: [0, 0, 0], _predictedTargetPosWithoutLead: [0, 0, 0], lastHadLOSTimer: 5, giveUpTimer: 5, classicTargetUpdateTimer: 5, destination: [0, 0, 0], detourDestination: [0, 0, 0], obstacleDetected: true, fallDetected: true, foundUpwardSlope: true, foundDoor: true, avoidObstaclesTimer: 5, checkingClockwiseTimer: 5, didClockwiseCheck: true, lastTimeWasStuck: 5, _acc: 0.5, knockbackSpeed: 3, hurtKnock: true, moving: true, isHostile: true, hasEncounteredPlayer: true });
    if (AI === EnhancedEnemyAI) Object.assign(ai, { path: [[0, 0, 0]], pathI: 3, repathT: 2, pathEpoch: 7 });
    ai.resumeLive();
    assert.deepEqual([ai.feet, ai.yaw], [[10, 4, 20], 1.25], `${AI.name}: the puppet's pose stands`);
    assert.deepEqual([ai.lastGroundedY, ai._airborne, ai.velY, ai.landedFall], [4, false, 0, 0], 'grounded where it stands: no phantom fall');
    assert.deepEqual([ai.target, ai.secondaryTarget, ai.targetSenses, ai.lastKnownTargetPos, ai.oldLastKnownTargetPos, ai.predictedTargetPos, ai._predictedTargetPosWithoutLead], [null, null, null, null, null, null, null], 'the target forgotten');
    assert.deepEqual([ai.lastHadLOSTimer, ai.giveUpTimer, ai.classicTargetUpdateTimer], [0, 0, 0]);
    assert.deepEqual([ai.destination, ai.detourDestination], [[10, 4, 20], [10, 4, 20]], 'the path from here');
    assert.deepEqual([ai.obstacleDetected, ai.fallDetected, ai.foundUpwardSlope, ai.foundDoor, ai.didClockwiseCheck], [false, false, false, false, false]);
    assert.deepEqual([ai.avoidObstaclesTimer, ai.checkingClockwiseTimer, ai.lastTimeWasStuck, ai._acc, ai.knockbackSpeed, ai.hurtKnock, ai.moving], [0, 0, -Infinity, 0, 0, false, false]);
    assert.deepEqual([ai.isHostile, ai.hasEncounteredPlayer], [true, true], 'the foe\'s own stand');
    if (AI === EnhancedEnemyAI) assert.deepEqual([ai.path, ai.pathI, ai.repathT, ai.pathEpoch], [null, 1, 0, undefined], 'and the cached path with it');
  }
});
