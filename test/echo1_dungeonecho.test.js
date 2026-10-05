// ECHO1 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "no logical interaction moments").
//
// THE CHAIN'S ECHO, AND ITS EXAMINE. A lever that works something out of sight says which way (one popup line a press),
// marks the place on the dungeon map until it is found, and lights it when it is; in Info mode a lever's plaque says
// which way its work lies (systems/dungeonEcho.js, the action system's `onPlayed`, scenes/dungeonContext.js).
// bible/03-World/Delve-Arc.md, ECHO1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ECHO_NEAR_M, ECHO_VERT_M, ECHO_FLAT_M, ECHO_FIND_M, ECHO_MAP_MAX, ECHO_LOOK_S, ECHO_CHAIN_MAX, ECHO_PREF, ECHO_WAYS,
  echoWay, wayWord, isEchoMover, echoVerb, echoLine, chainMovers, boxMiddle, examineLine, createEchoBook,
} from '../src/systems/dungeonEcho.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { TRIGGER_FLAGS, ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { compassMarkerLerp } from '../src/ui/hud.js';
import { FEATURES } from '../src/systems/features.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('ECHO1: the constants', () => {
  assert.deepEqual([ECHO_NEAR_M, ECHO_VERT_M, ECHO_FLAT_M, ECHO_FIND_M, ECHO_MAP_MAX, ECHO_LOOK_S, ECHO_CHAIN_MAX], [3, 2.5, 1.5, 12, 8, 0.25, 32]);
  assert.equal(ECHO_PREF, 'dungeonEchoes');
  assert.deepEqual(ECHO_WAYS, ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']);
});

test('ECHO1: the compass way, in the frame the compass reads (+x east, +z north)', () => {
  assert.equal(echoWay(0, 5), 'north');
  assert.equal(echoWay(5, 5), 'north-east');
  assert.equal(echoWay(5, 0), 'east');
  assert.equal(echoWay(5, -5), 'south-east');
  assert.equal(echoWay(0, -5), 'south');
  assert.equal(echoWay(-5, -5), 'south-west');
  assert.equal(echoWay(-5, 0), 'west');
  assert.equal(echoWay(-5, 5), 'north-west');
  assert.equal(echoWay(1, 10), 'north', 'a little east of north is north');
  // and it agrees with the compass itself: facing north (heading 0), a place to the east stands to the RIGHT
  assert.ok(compassMarkerLerp([5, 0], [0, 0], 0) > 0.5, 'east is on the right when facing +z');
  assert.ok(compassMarkerLerp([-5, 0], [0, 0], 0) < 0.5);
});

test('ECHO1: which way a place lies, said - level, above, below, both, or close by', () => {
  assert.equal(wayWord(0, 0, 8), 'to the north');
  assert.equal(wayWord(0, 4, 0), 'above you');
  assert.equal(wayWord(0, -4, 0.5), 'below you', 'under the level threshold: straight down');
  assert.equal(wayWord(-6, -4, 0), 'below you, to the west');
  assert.equal(wayWord(6, 3, 6), 'above you, to the north-east');
  assert.equal(wayWord(0.5, 2.5, 0.5), 'close by', 'the vertical threshold is strict');
  assert.equal(wayWord(1.5, 0, 0), 'to the east', 'the level threshold is not');
});

test('ECHO1: what moves, and what it is heard as', () => {
  for (const k of ['action', 'moveFlat', 'door']) assert.equal(isEchoMover({ kind: k }), true, k);
  for (const k of ['relay', 'effect', undefined]) assert.equal(isEchoMover({ kind: k }), false, String(k));
  assert.equal(isEchoMover(null), false);
  assert.equal(echoVerb({ kind: 'door' }), 'A door swings');
  assert.equal(echoVerb({ kind: 'moveFlat' }), 'Something shifts');
  assert.equal(echoVerb({ kind: 'action' }), 'Stone grinds');
  assert.equal(echoLine({ kind: 'action' }, [0, 1, 0], [-10, -4, 0]), 'Stone grinds somewhere below you, to the west.');
  assert.equal(echoLine({ kind: 'door' }, [0, 1, 0], [6, 1, 6]), 'A door swings somewhere to the north-east.');
  assert.deepEqual(boxMiddle({ min: [0, 2, 4], max: [2, 4, 8] }), [1, 3, 6]);
});

test('ECHO1: the chain\'s movers, walked without playing it - in order, itself excluded, a loop ends it', () => {
  const objs = {
    a: { key: 'a', kind: 'action', next: 'b' }, b: { key: 'b', kind: 'relay', next: 'c' }, c: { key: 'c', kind: 'door', next: 'd' },
    d: { key: 'd', kind: 'moveFlat', next: 'b' }, e: { key: 'e', kind: 'action', next: 'e' },
  };
  const next = (o) => objs[o.next] ?? null;
  assert.deepEqual(chainMovers(next, objs.a).map((o) => o.key), ['c', 'd'], 'the relay passes it on; the loop back to b ends it');
  assert.deepEqual(chainMovers(next, objs.e), [], 'a self link moves nothing');
  assert.deepEqual(chainMovers(next, null), []);
  // a long chain stops at the walk's depth
  const long = Array.from({ length: 50 }, (_, i) => ({ key: `n${i}`, kind: 'action' }));
  const step = (o) => long[Number(o.key.slice(1)) + 1] ?? null;
  assert.equal(chainMovers(step, long[0]).length, ECHO_CHAIN_MAX);
});

test('ECHO1: the examine\'s line - the way to the first mover the chain reaches, from the object itself', () => {
  const boxes = {
    lever: { min: [0, 0, 0], max: [0.4, 1, 0.4] }, wall: { min: [-12, -5, -0.5], max: [-10, -3, 0.5] }, near: { min: [2, 0, 0], max: [3, 1, 1] },   // within ECHO_NEAR_M, but far enough across to have a compass way
  };
  const objs = { lever: { key: 'lever', kind: 'action', next: 'relay' }, relay: { key: 'relay', kind: 'relay', next: 'wall' }, wall: { key: 'wall', kind: 'action' }, near: { key: 'near', kind: 'action' } };
  const next = (o) => objs[o.next] ?? null;
  const boxOf = (o) => boxes[o.key] ?? null;
  assert.equal(examineLine(objs.lever, next, boxOf), 'Works something below you, to the west');
  objs.lever.next = 'near';
  assert.equal(examineLine(objs.lever, next, boxOf), 'Works something close by');
  objs.lever.next = 'relay'; objs.relay.next = null;
  assert.equal(examineLine(objs.lever, next, boxOf), null, 'a chain that moves nothing says nothing');
  assert.equal(examineLine(objs.wall, next, () => null), null, 'no box, no word');
});

test('ECHO1: the book - by key, the last heard kept, the oldest out first, taken when found', () => {
  const b = createEchoBook({ max: 3 });
  assert.equal(b.size, 0);
  b.add('a', [1, 2, 3]); b.add('b', [4, 5, 6]); b.add('a', [7, 8, 9]);
  assert.deepEqual(b.points(), [[4, 5, 6], [7, 8, 9]], 'a heard again moves to where it was heard last');
  b.add('c', [0, 0, 0]); b.add('d', [1, 1, 1]);
  assert.equal(b.size, 3);
  assert.equal(b.has('b'), false, 'the oldest left first');
  const at = [5, 5, 5];
  b.add('e', at); at[0] = 99;
  assert.deepEqual(b.points()[2], [5, 5, 5], 'the place is copied');
  const found = b.take((e) => e.key === 'c' || e.key === 'e');
  assert.deepEqual(found.map((e) => e.key), ['c', 'e']);
  assert.deepEqual([...b.points()], [[1, 1, 1]]);
  b.clear();
  assert.equal(b.size, 0);
  assert.equal(createEchoBook().add('x', [0, 0, 0]), 1);
  const big = createEchoBook();
  for (let i = 0; i < 20; i++) big.add(`k${i}`, [i, 0, 0]);
  assert.equal(big.size, ECHO_MAP_MAX);
});

test('ECHO1: the action system says what it set going, by which trigger - after the gate, never on a refusal', () => {
  const collider = { addMesh() {}, removeBucket() {} };
  const a = new ActionSystem(collider);
  const cpu = { positions: new Float32Array(9), indices: new Uint16Array([0, 1, 2]) };
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const rec = (next, trig) => ({ index: 0, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: next, triggerFlag: trig, actionFlag: ACTION_FLAGS.Translation });
  a.addAction(0, 1, cpu, I, rec(2, TRIGGER_FLAGS.Direct));
  a.addAction(0, 2, cpu, I, rec(-1, TRIGGER_FLAGS.None));
  const heard = [];
  a.onPlayed = (o, t) => heard.push([o.key, t]);
  a.receive(a.objects.get('act:0:1'), 'WalkOn');
  assert.deepEqual(heard, [], 'a Direct lever refuses a WalkOn: nothing played, nothing heard');
  a.receive(a.objects.get('act:0:1'), 'Direct');
  assert.deepEqual(heard, [['act:0:1', 'Direct'], ['act:0:2', 'ActionObject']], 'the press, then what its chain set going');
  assert.equal(a.nextOf(a.objects.get('act:0:1')), a.objects.get('act:0:2'));
  assert.equal(a.nextOf(a.objects.get('act:0:2')), null);
  // another player's change lands through applyRemote and is not heard
  heard.length = 0;
  a.applyRemote([{ key: 'act:0:2', state: 'forward', t: 0.5 }]);
  assert.deepEqual(heard, []);
});

test('ECHO1: the dungeon hears the cascade alone, says one line a press, marks and finds - and the examine keeps the author\'s hide', () => {
  const s = src('src/scenes/dungeonContext.js');
  assert.match(s, /actions\.onPlayed = \(o, triggerType\) => \{ if \(triggerType === 'ActionObject' && _echoPlayed\.length < 64\) _echoPlayed\.push\(o\); \};/);
  assert.match(s, /if \(Math\.hypot\(at\[0\] - eye\[0\], at\[1\] - eye\[1\], at\[2\] - eye\[2\]\) <= ECHO_NEAR_M\) continue;\n\s+if \(inPlainSight\(collider, eye, box, \{ skip: o\.key \}\)\) continue;\n\s+echoBook\.add\(o\.key, at\);\n\s+if \(!said\) \{ hudText\.add\(echoLine\(o, eye, at\)\); said = true; \}/);
  assert.match(s, /return !box \|\| \(boxDistance\(box, eye\) <= ECHO_FIND_M && inPlainSight\(collider, eye, box, \{ skip: e\.key \}\)\);/);
  assert.match(s, /if \(lit\.length && echoesOn\(\)\) echoPulse\.pulse\(t, lit\);/);
  assert.match(s, /const echoesOn = \(\) => isEnhanced\(\) && getPref\(ECHO_PREF\) !== false;/);
  assert.match(s, /const why = named && !hide && getInteractionMode\(\) === 'info' && echoesOn\(\) \? examineLine\(o, \(x\) => actions\.nextOf\(x\), objectAabb\) : null;/);
  assert.match(s, /echoes: \(\) => \(echoesOn\(\) \? echoBook\.points\(\) : null\),/);
  assert.match(s, /echoPulse\.clear\(\); echoBook\.clear\(\);[^\n]*actions\.onPlayed = null;/);
  assert.match(src('src/ui/automapDoor.js'), /echoes: deps\.echoes \?\? null,/);
});

test('ECHO1: the Features row - Enhanced, on by default, the player\'s own online', () => {
  const f = FEATURES.find((x) => x.id === 'dungeon-echoes');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual({ ...f.control }, { store: 'prefs', key: ECHO_PREF, initial: true, online: 'player' });
});
