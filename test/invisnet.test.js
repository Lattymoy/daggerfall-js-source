// INVIS-NET (2026-09-27, Mac relaying reports: "Other player's still see other players who are suppose to be
// invisible"). A player's magical concealment - Invisibility, Chameleon, Shadow - lived on their own entity alone: the
// pose carried none of it, so every other player drew them whole (the body, the sprite, the rider, the name), could
// press F on them, and their own foes hunted them as if they stood in the open (enemyMotor's own note: "a peer's flags
// are a later slice's wire field"). The pose carries it now (`cv`: 1 invisible, 2 blending, 4 a shade, omitted at 0),
// and a reader draws a concealed peer as DFU draws every concealed entity that is not the player - not at all - and
// hands its foes the flags. (INVIS-LOOK, the same day: that is the classic lane's draw; under Enhanced Combat Visuals the
// peer is drawn translucent, as a concealed foe is - test/invislook.test.js.) Driven through the wire's door, two sessions either side of the real relay Room, the
// dungeon's peer candidates mounted over its own statements, and the world host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

import { validPose, poseChanged, parseClient } from '../src/net/wire.js';
import { lerpPose, OnlineSession } from '../src/net/online.js';
import { concealBits, concealFlagsOfBits, concealmentFlags } from '../src/systems/effects.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { RemotePlayers } from '../src/net/remotePlayers.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const withEffects = (...kinds) => ({ activeEffects: kinds.map((kind) => ({ kind, roundsRemaining: 5 })) });

test('INVIS-NET wire: `cv` survives the door and the relay\'s pose frame, bounded to the three bits and OMITTED at 0 - an unconcealed pose is the bytes it always was; each edge goes out at once; lerpPose carries it', () => {
  const base = validPose(P);
  assert.equal('cv' in base, false, 'unconcealed: no field');
  assert.equal(JSON.stringify(validPose({ ...P, cv: 0 })), JSON.stringify(base), 'a zero is the old bytes');
  assert.equal(validPose({ ...P, cv: 1 }).cv, 1, 'invisible');
  assert.equal(validPose({ ...P, cv: 6 }).cv, 6, 'blending and a shade together');
  assert.equal(validPose({ ...P, cv: 99 }).cv, 7, 'clamped to the three bits');
  for (const junk of [-1, '1', true, NaN, {}]) assert.equal('cv' in validPose({ ...P, cv: junk }), false, `${String(junk)}: nothing`);
  assert.equal(parseClient(JSON.stringify({ t: 'pose', p: { ...P, cv: 1 } }), { hasHello: true }).p.cv, 1, 'the relay\'s own door keeps it');
  assert.equal(poseChanged(base, validPose({ ...P, cv: 1 })), true, 'vanishing is news at once');
  assert.equal(poseChanged(validPose({ ...P, cv: 1 }), base), true, 'and so is coming back');
  assert.equal(poseChanged(validPose({ ...P, cv: 2 }), validPose({ ...P, cv: 2 })), false, 'still blending: no news');
  assert.equal(lerpPose(base, validPose({ ...P, x: 3, cv: 4 }), 0.5).cv, 4, 'the drawn pose carries it whole');
  assert.equal('cv' in lerpPose(validPose({ ...P, cv: 4 }), base, 0.5), false, 'and drops it with the pose it rode');
});

test('INVIS-NET sender and reader: my own concealment packs into the three bits DaggerfallEntity names, normal or true power, and a reader unpacks the flags the foes\' senses read', () => {
  assert.equal(concealBits(withEffects()), 0);
  assert.equal(concealBits(withEffects('invisNormal')), 1);
  assert.equal(concealBits(withEffects('invisTrue')), 1);
  assert.equal(concealBits(withEffects('chameleonNormal')), 2);
  assert.equal(concealBits(withEffects('shadeTrue')), 4);
  assert.equal(concealBits(withEffects('invisNormal', 'chameleonTrue', 'shadeNormal')), 7);
  for (const kinds of [[], ['invisTrue'], ['chameleonNormal'], ['shadeNormal'], ['invisNormal', 'shadeTrue']]) {
    const en = withEffects(...kinds);
    assert.deepEqual(concealFlagsOfBits(concealBits(en)), concealmentFlags(en), `the round trip is the entity's own flags (${kinds.join('+') || 'none'})`);
  }
  assert.equal(validPose({ ...P, cv: concealBits(withEffects('invisTrue')) || undefined }).cv, 1, 'what the sender packs, the door admits');
  assert.equal(JSON.stringify(validPose({ ...P, cv: concealBits(withEffects()) || undefined })), JSON.stringify(validPose(P)), 'and an unconcealed pose is the old bytes');
});

test('INVIS-NET end to end: my invisibility leaves my session the moment it lands, passes the real relay Room, and stands on the pose the other player draws me from; ended, it is gone from theirs', async () => {
  const ROOM = 'world:3,12';
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const at = { x: 3 * 32768 + 10, y: 0, z: 12 * 32768 + 10, yaw: 0, pitch: 0, mv: 0 };
  const me = new OnlineSession({ url: 'wss://relay.test', name: 'ghost-0001', id: 'ghost-0001', secret: 'secret-of-ghost-0001', WebSocketImpl: FakeWS, now: () => now });
  const them = new OnlineSession({ url: 'wss://relay.test', name: 'seer-0001', id: 'seer-0001', secret: 'secret-of-seer-0001', WebSocketImpl: FakeWS, now: () => now });
  const info = console.info; console.info = () => {};
  try {
    me.join(ROOM, at); them.join(ROOM, at);
    const [mine, theirs] = sockets;
    mine.open(); theirs.open();
    const r = fakeRoom(ROOM);
    const relayMine = r.connect(), relayTheirs = r.connect();
    await r.hello(relayMine, 'ghost-0001', at); await r.hello(relayTheirs, 'seer-0001', at);
    let heard = 0;
    const hear = () => { for (; heard < relayTheirs.sent.length; heard++) theirs.receive(relayTheirs.sent[heard]); };
    const relayLast = async () => {
      const f = mine.sent.map((m) => (typeof m === 'string' ? JSON.parse(m) : m)).filter((m) => m.t === 'pose').at(-1);   // test/fakeSocket.mjs keeps the text sent
      await r.room.webSocketMessage(relayMine, JSON.stringify(f));
      hear();
    };
    hear();
    assert.deepEqual(them.drawable().map((p) => p.id), ['ghost-0001'], 'they see me, from the welcome');
    now += 150; me.sendPose({ ...at });
    now += 150;
    assert.equal(me.sendPose({ ...at, cv: 1 }), true, 'invisible, standing still, long before the heartbeat: sent at once');
    await relayLast();
    const relayed = relayTheirs.sent.filter((m) => m.t === 'pose' && m.id === 'ghost-0001').at(-1);
    assert.equal(relayed?.p?.cv, 1, 'the relay fans it on');
    now += 150; them.tick();
    assert.equal(them.drawable()[0].shown.cv, 1, 'and it stands on the pose they draw me from');
    now += 150;
    assert.equal(me.sendPose({ ...at }), true, 'the spell ends: sent at once too');
    await relayLast();
    now += 150; them.tick();
    assert.equal('cv' in them.drawable()[0].shown, false, 'and gone from theirs');
  } finally { console.info = info; }
});

// the dungeon's peer candidates, mounted over the context's own statements
const D = rd('src/scenes/dungeonContext.js');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });
function fnSrc(name) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  assert.ok(hit, `src has function ${name}`);
  return D.slice(hit.start, hit.end);
}

test('INVIS-NET foes: a peer candidate carries its concealment off its pose, so a foe\'s senses read a concealed peer as they read any concealed target - and it moves with the peer', () => {
  let list = [{ id: 'ghost-0001', feet: [1, 0, 1], height: 1.8, cv: 1 }, { id: 'seer-0002', feet: [2, 0, 2], height: 1.8 }];
  const state = { opts: { peers: () => list }, _peerCands: new Map(), _peerRead: -1, _peerFrame: 0, CAPSULE_HEIGHT: 1.8, concealFlagsOfBits };
  const scoped = new Proxy(state, { has: (t, k) => k !== '__s', get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])), set: (t, k, v) => { t[k] = v; return true; } });
  const peerCandidates = new Function('__s', `with (__s) { ${fnSrc('peerCandidates')}\nreturn peerCandidates; }`)(scoped);
  const cands = peerCandidates();
  const ghost = cands.find((c) => c.id === 'ghost-0001'), seer = cands.find((c) => c.id === 'seer-0002');
  assert.deepEqual(ghost.concealment(), { invisible: true, blending: false, shade: false }, 'the invisible peer reads invisible');
  assert.deepEqual(seer.concealment(), { invisible: false, blending: false, shade: false }, 'an open one reads open');
  list = [{ id: 'ghost-0001', feet: [1, 0, 1], height: 1.8 }];
  state._peerFrame++;
  peerCandidates();
  assert.equal(ghost.concealment().invisible, false, 'the spell ended: the same candidate reads open');
  // the exterior pool reads the same way
  const X = rd('src/scenes/exteriorFoes.js');
  assert.match(X, /health: 1, cv: 0, concealment: \(\) => concealFlagsOfBits\(c\.cv\) \};/);
  assert.match(X, /c\.health = 1;\n\s*c\.cv = q\.cv \| 0;/);
});

test('INVIS-NET by source: the host packs my concealment onto every pose; on the classic lane draws no rider, body, walker, sprite or name for a concealed peer (its cast still seen; INVIS-LOOK draws it translucent on the enhanced one); hands the foes the peer\'s bits; and a concealed peer is not there to press', () => {
  const w = rd('src/scenes/world.js');
  const arm = w.slice(w.indexOf('    const arm = {\n      mv,'), w.indexOf('};   // the wire\'s move bit'));
  assert.match(arm, /\n\s*cv: concealBits\(playerEntity\) \|\| undefined,/, 'the arm spread into every pose');
  assert.match(w, /const drawable = online\.drawable\(\);\n\s*peerCastVisuals\(drawable\);[^\n]*\n(?:[^\n]*\n){0,4}?\s*const seen = \[\];\n\s*for \(const d of drawable\) \{\n\s*const look = peerDraw\(d\.shown\?\.cv \| 0, veilOn, _veilT, d\.id\);\n\s*if \(look\.kind === 'hidden'\) \{ _hiddenPeers\.add\(d\.id\); continue; \}/, 'the cast off every peer, the draw off the seen - a concealed peer hidden where the look says so (the classic lane)');
  assert.match(w, /peerRiders\.sync\(seen, onlineToScene,/);
  assert.match(w, /const afoot = seen\.filter\(/);
  assert.match(w, /peerWalkers\.sync\(seen, onlineToScene,/);
  assert.match(w, /remotePlayers\.sync\(drawable, onlineToScene, \{[^\n]*conceal: veilOf, hidden: \(id\) => _hiddenPeers\.has\(id\) \}\);/, 'the sprite and the name pass - every peer HEARD, the hidden drawn nowhere (AUDIT pre-merge I-G)');
  assert.doesNotMatch(w, /(?:peerRiders|peerWalkers)\.sync\(drawable,/, 'nothing draws off the whole list any more (the sprite pass hears it, and skips the hidden itself)');
  // the merge with main's PEERLIGHT2: a Light spell's candle (a sprite and its light) hangs before a player DRAWN here -
  // off the whole list, the classic lane's invisible player walked behind a floating candle
  assert.match(w, /seen\.push\(d\);\n\s*\}\n\s*peerCandlesFrame\(seen, dt\);/, 'the candles off the seen');
  assert.doesNotMatch(w, /peerCandlesFrame\(drawable/, 'never off the whole list');
  assert.match(w, /out\.push\(\{ id: p\.id, feet: onlineToScene\(p\.shown\), height: _peerHeights\.get\(p\.id\), cv: p\.shown\?\.cv \| 0 \}\);/, 'the peers the foes read carry it');
  assert.match(w, /pickPeerInFront\(eye, dir, \(peersNear\(\) \?\? \[\]\)\.filter\(\(q\) => !q\.cv\), SOCIAL_REACH, rayPersonDistance\);/, 'the F door and the plaque skip a concealed peer');
});

// ---- AUDIT (the pre-merge audit, 2026-09-27, Mac: "Audit before we merge"): what else named or showed a concealed player.

test('AUDIT pre-merge I-G executed: a peer the classic lane stands nowhere is still HEARD - its steps at it, as a concealed foe\'s sounds play in DFU (the renderer off, not the audio) - and has no doll and no name', () => {
  const calls = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: { playOneShot() { calls.push('flat'); }, play3d(clip, at) { calls.push(at); } } }, compose: async () => null });
  const peer = (x) => ({ id: 'amy-0002', name: 'amy', shown: { x, y: 0, z: 4, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0, cv: 1 }, look: null });
  for (let i = 0; i < 200; i++) rp.sync([peer(i * 0.1)], (p) => [p.x, p.y, p.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 30, hidden: () => true });   // a body's height: the name pass would stand her at it
  assert.ok(calls.length > 0 && calls.every((c) => c !== 'flat'), 'her steps, at her');
  assert.equal(rp._shown.length, 0, 'no name');
  rp.sync([peer(20)], (p) => [p.x, p.y, p.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 30, hidden: () => false });
  assert.equal(rp._shown.length, 1, 'drawn, she is named (the control)');
  assert.equal(rp._batches.size, 0, 'no sprite, no doll');
});

test('AUDIT pre-merge I-A + I-E + I-F by source: a building\'s sheet opens the building\'s pack; the maps mark the party drawn here; the Nearby list and the page\'s readers skip a concealed player (the F key\'s law)', () => {
  const w = rd('src/scenes/world.js'), m = rd('src/scenes/worldModes.js');
  assert.match(w, /const makeCharSheetWindow = \(\{ inventory = null \} = \{\}\) => createCharSheetWindow\(\{[\s\S]*?inventory: inventory \?\? \(\(\) => \(inventoryDoorReady\(\) \? makeInventoryWindow\(\) : null\)\),/);
  assert.match(w, /makeCharSheet: \(doors\) => \(charSheetDoorReady\(\) \? makeCharSheetWindow\(doors\) : null\),/);
  assert.match(m, /const interiorSheetDoors = \(\) => \(\{ inventory: \(\) => interiorInventory\(\) \}\);/);
  assert.equal((m.match(/host\.makeCharSheet\?\.\(interiorSheetDoors\(\)\)/g) ?? []).length, 3, 'the level-up arm, the F5 page\'s sheet key and the sheet key');
  assert.doesNotMatch(m, /host\.makeCharSheet\?\.\(\)/, 'none left on the street\'s pack');
  assert.match(w, /const partyOnMaps = \(\) => partyNear\(\)\.filter\(\(m\) => !_hiddenPeers\.has\(m\.id\)\);/);
  assert.match(w, /townParty: \(\) => partyOnMaps\(\)\.map\(/, 'the town map');
  assert.match(w, /partyNear: \(\) => partyOnMaps\(\),/, 'the dungeon\'s and the building\'s plans');
  assert.match(w, /if \(tabId === 'local'\) return localRosterSource\(s, \(peersNear\(\) \?\? \[\]\)\.filter\(\(q\) => !q\.cv\), player\.feetAt\(\)\);/, 'the Nearby list');
  assert.match(w, /return near\.filter\(\(p\) => !p\.cv\)\.map\(\(p\) => \(\{ id: p\.id, name: peerName\(p\.id\)/, 'the page\'s readers');
});
