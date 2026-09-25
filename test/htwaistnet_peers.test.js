// HT-WAIST-NET (2026-09-24): THE OTHERS SEE YOUR LANTERN AT THE WAIST.
//
// HT-WAIST hangs a lit lantern at the waist (Handheld Torches' port-own
// Handling.LanternsAtWaist) and draws it swinging at the hip of the local
// Morrowind third-person body and the local Eye Of The Beholder sprite. Mac
// asked for it to be seen on the character - and online, the OTHER players
// are drawn in the Morrowind body too (MWBODY1: net/peerBodies.js, one
// createFpArm() per peer, posed in third person). HT-WAIST left the wire
// untouched ("peers show no held light"), so nobody else saw it.
//
// The pose carries it now: `hl` 1 while the sender's lit light is a lantern
// hung at the waist (systems/playerTorch.js waistLanternPoseBit - the one
// question, lanternAtWaist, asked of PlayerEntity.LightSource), OMITTED
// otherwise; validPose admits it, poseChanged sends its edge at once,
// lerpPose carries it; and a peer's body hangs the lantern through the rig's
// own door (`b.rig.setHipLight(!!shown.hl)` in `_arm`), swung off that
// body's own stub camera as the local one swings off the motor. world108 (world106 on its branch; main's DISC23-B took world106 and DUEL1 world107 first).
//
// Driven through the real code: the wire's door, two OnlineSessions over
// fake sockets either side of the real relay Room (test/fakeRoom.mjs), and
// PeerBodies over whole createFpArm() rigs on the fixture body with a pelvis
// and a LIGH lantern (test/fixtures/mw/bodyRig.mjs hipLanternBodyDeps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validPose, poseChanged, parseClient } from '../src/net/wire.js';
import { lerpPose, OnlineSession } from '../src/net/online.js';
import { PeerBodies } from '../src/net/peerBodies.js';
import { createFpArm, HIP_LIGHT_SLOT } from '../src/combat/fpArm.js';
import * as playerTorch from '../src/systems/playerTorch.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { fakeRoom } from './fakeRoom.mjs';
import { countingRenderer, hipLanternBodyDeps } from './fixtures/mw/bodyRig.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const V = 'handheld-torches';
const KEY = 'Handling.LanternsAtWaist';
const lantern = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, currentCondition: 100, maxCondition: 100 });
const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 });
const candle = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Candle, currentCondition: 16, maxCondition: 16 });
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------
// the wire
// ---------------------------------------------------------------
test('HT-WAIST-NET wire: `hl` survives the door and the relay\'s pose frame, clamped to 1, and is OMITTED at 0 - a pose without a lantern at the waist is the bytes it always was; each edge goes out at once; lerpPose carries it (mutants: the field dropped at the door; the edge not sent; the lerp dropping it)', () => {
  const base = validPose(P);
  assert.equal('hl' in base, false, 'no lantern at the waist: no field');
  assert.equal(JSON.stringify(validPose({ ...P, hl: 0 })), JSON.stringify(base), 'a zero serializes to the old bytes');
  assert.equal(JSON.stringify(validPose({ ...P, hl: undefined })), JSON.stringify(base), 'and so does the sender\'s absent bit');
  assert.equal(validPose({ ...P, hl: 1 }).hl, 1, 'lit at the waist: 1');
  assert.equal(validPose({ ...P, hl: 7 }).hl, 1, 'clamped by uint, as lh is');
  for (const junk of [-1, '1', true, NaN, {}]) assert.equal('hl' in validPose({ ...P, hl: junk }), false, `${String(junk)}: no lantern`);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'pose', p: { ...P, hl: 1 } }), { hasHello: true }).p.hl, 1, 'the relay\'s own door keeps it');
  assert.equal(poseChanged(base, validPose({ ...P, hl: 1 })), true, 'lit at the waist: sent at once, not at the heartbeat');
  assert.equal(poseChanged(validPose({ ...P, hl: 1 }), base), true, 'put out: sent at once');
  assert.equal(poseChanged(validPose({ ...P, hl: 1 }), validPose({ ...P, hl: 1 })), false, 'still lit: no news');
  const eased = lerpPose(base, validPose({ ...P, x: 3, hl: 1 }), 0.5);
  assert.equal(eased.hl, 1, 'the drawn pose carries it whole - nothing to ease');
  assert.equal(eased.x, 2);
  assert.equal('hl' in lerpPose(validPose({ ...P, hl: 1 }), base, 0.5), false, 'and drops it with the pose it rode');
});

test('HT-WAIST-NET sender: the bit is 1 ONLY while a lit lantern hangs at the waist - the lantern, the mod on and its switch on - and absent for a held torch, a candle, no light, the switch or the mod off; world.js puts it on every pose it sends (mutants: the bit for any light; the switch ignored; the sender line gone)', () => {
  const bit = playerTorch.waistLanternPoseBit;
  assert.equal(typeof bit, 'function', 'systems/playerTorch.js waistLanternPoseBit - the pose\'s producer, beside the one question');
  _resetModSettings();
  try {
    assert.equal(bit(lantern()), 1, 'shipped on (HT-WAIST-ON): the lit lantern hangs at the waist, and the pose says so');
    setModSetting(V, KEY, false);
    assert.equal(bit(lantern()), undefined, 'the switch off: the lantern is held, and no held light rides the wire');
    setModSetting(V, KEY, true);
    assert.equal(bit(lantern()), 1, 'on: the lit lantern hangs at the waist, and the pose says so');
    assert.equal(bit(torch()), undefined, 'a torch is held - MW-D51\'s held light still rides nothing');
    assert.equal(bit(candle()), undefined, 'a candle is held');
    assert.equal(bit(null), undefined, 'no light lit (PlayerEntity.LightSource null): nothing at the waist');
    assert.equal(validPose({ ...P, hl: bit(lantern()) }).hl, 1, 'what the producer mints, the door admits');
    assert.equal(JSON.stringify(validPose({ ...P, hl: bit(torch()) })), JSON.stringify(validPose(P)), 'and a held torch\'s pose is the bytes it always was');
    setModSetting(V, 'Enabled', false);
    assert.equal(bit(lantern()), undefined, 'the mod off: its switch goes with it');
  } finally { _resetModSettings(); }
  const w = rd('src/scenes/world.js');
  const arm = w.slice(w.indexOf('    const arm = {\n      mv,'), w.indexOf('};   // the wire\'s move bit'));
  assert.ok(arm.length > 0, 'the pose\'s arm block');
  assert.match(arm, /\n\s*hl: waistLanternPoseBit\(playerEntity\.lightSource\),/, 'the arm the host spreads into every pose and the hello asks the player\'s lit light');
});

// ---------------------------------------------------------------
// the whole wire: a session, the relay, a session
// ---------------------------------------------------------------
/** A fake WebSocket class (test/online.test.js's): records what was sent, lets the test drive the events. */
function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

test('HT-WAIST-NET end to end: my lantern lit at the waist leaves my session THE MOMENT it is lit, passes the real relay Room, and stands on the drawn pose of the player watching me; put out, it is gone from theirs (mutants: the edge waiting for the heartbeat; the relay\'s door or the receiver\'s lerp dropping it)', async () => {
  const ROOM = 'town:m4242';
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const me = new OnlineSession({ url: 'wss://relay.test', name: 'lamp-0001', id: 'lamp-0001', secret: 'secret-of-lamp-0001', WebSocketImpl: FakeWS, now: () => now });
  const them = new OnlineSession({ url: 'wss://relay.test', name: 'seer-0001', id: 'seer-0001', secret: 'secret-of-seer-0001', WebSocketImpl: FakeWS, now: () => now });
  me.join(ROOM, P); them.join(ROOM, P);
  const [mine, theirs] = sockets;
  mine.open(); theirs.open();
  // the relay, with each session's socket on it (the harness mints the hello's token; the poses are the sessions' own)
  const r = fakeRoom(ROOM);
  const relayMine = r.connect(), relayTheirs = r.connect();
  await r.hello(relayMine, 'lamp-0001', P); await r.hello(relayTheirs, 'seer-0001', P);
  let heard = 0;
  const hear = () => { for (; heard < relayTheirs.sent.length; heard++) theirs.receive(relayTheirs.sent[heard]); };
  const relayLast = async () => {
    const f = mine.sent.filter((m) => m.t === 'pose').at(-1);
    await r.room.webSocketMessage(relayMine, JSON.stringify(f));
    hear();
  };
  hear();
  assert.deepEqual(them.drawable().map((p) => p.id), ['lamp-0001'], 'they see me, from the welcome');
  assert.equal('hl' in them.drawable()[0].shown, false, 'no lantern yet');
  _resetModSettings();
  try {
    setModSetting(V, KEY, true);
    now += 150; me.sendPose({ ...P });
    now += 150;
    assert.equal(me.sendPose({ ...P }), false, 'standing still, the lantern unlit: nothing to say before the heartbeat');
    assert.equal(me.sendPose({ ...P, hl: playerTorch.waistLanternPoseBit?.(lantern()) }), true, 'lit at the waist, still standing, long before the heartbeat: sent at once (poseChanged)');
    const out = mine.sent.filter((m) => m.t === 'pose').at(-1);
    assert.equal(out.p.hl, 1, 'my socket carries the bit');
    await relayLast();
    const relayed = relayTheirs.sent.filter((m) => m.t === 'pose' && m.id === 'lamp-0001').at(-1);
    assert.equal(relayed?.p?.hl, 1, 'the relay fans it on');
    now += 150; them.tick();
    assert.equal(them.drawable()[0].shown.hl, 1, 'and it stands on the pose they draw me from');
    now += 150;
    assert.equal(me.sendPose({ ...P, hl: playerTorch.waistLanternPoseBit?.(lantern()) }), false, 'still lit, still standing: no news');
    assert.equal(me.sendPose({ ...P, hl: playerTorch.waistLanternPoseBit?.(null) }), true, 'put out: sent at once too');
    await relayLast();
    now += 150; them.tick();
    assert.equal('hl' in them.drawable()[0].shown, false, 'and gone from theirs');
  } finally { _resetModSettings(); }
});

// ---------------------------------------------------------------
// the peer's body
// ---------------------------------------------------------------
const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
/** PeerBodies over whole createFpArm() rigs on the fixture body with a pelvis and a LIGH lantern, one deps per peer. */
function peerRig(ids) {
  const deps = new Map(ids.map((id) => [id, hipLanternBodyDeps()]));
  const looks = new Map(ids.map((id) => [id, { ...LOOK }]));
  const idOf = new Map(ids.map((id) => [looks.get(id), id]));
  const renderer = countingRenderer();
  renderer.updateParticleEffect = () => {};
  const pb = new PeerBodies({ renderer, createRig: createFpArm, buildOpts: (look) => ({ race: 'fprace', deps: deps.get(idOf.get(look)) }), now: () => 0 });
  const peer = (id, shown) => ({ id, name: id, look: looks.get(id), shown });
  return { pb, deps, peer };
}
const toScene = (p) => [p.x, p.y, p.z];
const NEAR = [0, 0, 0];
const hipRange = (rig) => rig.thirdMesh()?.ranges.find((r) => r.slot === HIP_LIGHT_SLOT) ?? null;
/** Sync until every body stands and every lantern bind in flight has landed. */
async function settle(pb, peers, frames = 30) {
  for (let i = 0; i < frames; i++) { pb.sync(peers, toScene, 1 / 60, NEAR); await pb._queue; await flush(); }
}

test('HT-WAIST-NET peer body: a peer whose pose says `hl` has the lantern hung at its body\'s pelvis through the rig\'s own door - bound once, shown; cleared, hidden; set again, shown on the fast path; a peer without it binds none (mutants: _arm never asks; the bit read inverted)', async () => {
  const { pb, deps, peer } = peerRig(['lamp-0001', 'dark-0001']);
  let lit = lerpPose(null, validPose({ ...P, hl: 1 }));
  const dark = lerpPose(null, validPose({ ...P, x: 2 }));
  await settle(pb, [peer('lamp-0001', lit), peer('dark-0001', dark)]);
  const lamp = pb._bodies.get('lamp-0001'), other = pb._bodies.get('dark-0001');
  assert.equal(lamp?.state, 'ok', 'the lit peer stands in a body'); assert.equal(other?.state, 'ok', 'and the other');
  assert.equal(pb.has('lamp-0001'), true);
  assert.deepEqual(lamp.rig.built().third.hipLight, { id: 'lantern_01', name: 'Lantern', model: 'l/lantern_01.nif', bone: 'Bip01 Pelvis', fire: false }, 'the LIGH lantern, bound at the pelvis of the peer\'s body');
  assert.equal(deps.get('lamp-0001').counters.opened, 2, 'the build, then the one bind (the slow path, once)');
  assert.equal(lamp.rig.status().hipShown, true);
  assert.equal(hipRange(lamp.rig)?.hidden, false, 'and drawn');
  assert.equal(other.rig.built().third.hipLight, null, 'no bit: no lantern bound on the other body');
  assert.equal(other.rig.status().hipLit, false);
  assert.equal(hipRange(other.rig), null, 'nothing at its hip to draw');
  assert.equal(deps.get('dark-0001').counters.opened, 1, 'its build alone - nothing reopened for a lantern it does not carry');
  // put out
  lit = lerpPose(lit, validPose(P), 1);
  await settle(pb, [peer('lamp-0001', lit), peer('dark-0001', dark)], 3);
  assert.equal(lamp.rig.status().hipLit, false, 'put out: the body follows');
  assert.equal(hipRange(lamp.rig)?.hidden, true, 'hidden, not unbound');
  // lit again: the fast path
  lit = lerpPose(lit, validPose({ ...P, hl: 1 }), 1);
  await settle(pb, [peer('lamp-0001', lit), peer('dark-0001', dark)], 3);
  assert.equal(hipRange(lamp.rig)?.hidden, false, 'lit again: shown');
  assert.equal(deps.get('lamp-0001').counters.opened, 2, 'on the fast path - no archive reopened for a lantern already hanging there');
  pb.destroy();
  assert.equal(pb._bodies.size, 0, 'released with the bodies (the lantern is the body\'s own mesh - its owner frees it)');
});

test('HT-WAIST-NET peer swing: a peer\'s lantern swings off its OWN body\'s stub camera - a peer that walks off throws it back as the local body\'s walk does, a peer standing lets it hang plumb (mutants: the peer\'s camera fed no movement; the lantern never hung)', async () => {
  const { pb, peer } = peerRig(['lamp-0001']);
  const shown = lerpPose(null, validPose({ ...P, x: 0, hl: 1 }));
  await settle(pb, [peer('lamp-0001', shown)]);
  const b = pb._bodies.get('lamp-0001');
  assert.equal(b.rig.status().hipShown, true, 'the lantern hangs');
  assert.deepEqual(b.rig.status().hipSwing, { fore: 0, side: 0 }, 'standing: plumb');
  // the peer walks off along its facing at 5 m/s: the drawn pose moves, `mv` 1 - the body reads its camera off both
  shown.mv = 1;
  let fore = 0;
  for (let i = 0; i < 20; i++) {
    shown.z += 5 / 60;
    pb.sync([peer('lamp-0001', shown)], toScene, 1 / 60, NEAR);
    fore = Math.min(fore, b.rig.status().hipSwing.fore);
  }
  assert.ok(b.speed > 1, `the body measured the peer's pace off the drawn pose (${b.speed})`);
  assert.ok(fore < -0.05, `a walk begun: the lantern lags back, as the local body's does (${fore})`);
});

// ---------------------------------------------------------------
// the record
// ---------------------------------------------------------------
test('HT-WAIST-NET: recorded - the deferral is retired where HT-WAIST wrote it (Handheld-Torches.md, Morrowind-Rules.md, the Ledger A row), the arc names the bit and the version, and the RELAY_VERSION chain carries it (mutant: the stale "wire untouched" sentence kept beside the retiring one)', () => {
  const arc = rd('bible/06-Systems/Handheld-Torches.md');
  const sec = arc.slice(arc.indexOf('## HT-WAIST - THE LANTERN AT THE WAIST'));
  assert.doesNotMatch(sec, /The wire is untouched|Online: NOT carried/, 'RETIRING A FLAG DELETES THE SENTENCE');
  assert.match(sec, /HT-WAIST-NET/); assert.match(sec, /`hl`/); assert.match(sec, /world108/);
  const mw = rd('bible/02-Formats/Morrowind-Rules.md');
  const mws = mw.slice(mw.indexOf('## HT-WAIST (2026-09-24)'));
  assert.doesNotMatch(mws.slice(0, 4000), /\*\*Peers\*\*: unchanged/, 'the body\'s record no longer says peers never ask');
  const ledger = rd('bible/01-Overview/Port-Ledger.md');
  const row = ledger.split('\n').find((l) => l.startsWith('|') && /\(HT-WAIST, 2026-09-24/.test(l));
  assert.ok(row, 'HT-WAIST\'s Ledger A row');
  assert.doesNotMatch(row, /the wire is untouched/);
  assert.match(row, /HT-WAIST-NET/);
  const online = rd('bible/06-Systems/Online-Arc.md');
  assert.match(online, /^## HT-WAIST-NET \(2026-09-24[^\n]*world108$/m, 'the online arc\'s section');
  const w = rd('src/net/wire.js');
  assert.match(w, /\nexport const RELAY_VERSION = 'world\d+';[^\n]*HT-WAIST-NET \(2026-09-24[^\n]*? - world108 /, 'the relay\'s version chain names it at world108');
});
