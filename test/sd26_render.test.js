// SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md): AUDIT SD IV's sync and render
// lenses - each finding measured before it was fixed. Where the Rift stands read the doors open on the frame it was
// stood; the Hour's light was drawn under the flats that came after it; the Stomp's dust rose from the void past the
// arena's rim; the lamps' heads and the stones' caps were open underneath; the Hour's fog and trilight made garbage a
// frame; section 7 named six records fewer than the Hour's archive holds.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realmArt } from '../src/world/sdRealmArt.js';
import { hallArt } from '../src/world/sdHallArt.js';
import { stepsArt } from '../src/world/sdStepsArt.js';
import { remnantArt } from '../src/world/sdRemnantArt.js';
import { sdRiftArt } from '../src/world/sdRiftArt.js';
import { Collider } from '../src/player/collider.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { sdRiftPlace, sdReturnPlace, sdLandingPlace } from '../src/world/sdDungeon.js';
import { floorLanding } from '../src/player/enterExit.js';
import { trs } from '../src/world/mat4.js';
import { glslFunctions } from './glsl.mjs';
import { GateFxRenderer, FX_SPARK_VS, FX_SPARKS, FX_BURST_MS, sparkAt } from '../src/render/gateFx.js';
import { createSdFx, SD_FX_KINDS, SD_FX_EDGE, SD_FX_FLOOR_Y, SD_RING_DUST } from '../src/scenes/sdFx.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { SD_BLOWS, SD_BODY, SD_REM } from '../src/net/sdRemnant.js';

const read = (p) => readFileSync(p, 'utf8');

test('AUDIT SD IV (R6): section 7 names every record the Hour\'s one pseudo-archive holds - its ranges are the art\'s own, each range one producer\'s, none left out (mutants: the Rift\'s red re-numbered; the Endings\' lights dropped from the sentence)', () => {
  const doc = read('bible/11-Multiplayer/Super-Dungeons.md').replace(/\s+/g, ' ');
  const said = /one pseudo-archive, 38151 - records (.*?)\) laid/.exec(doc);
  assert.ok(said, 'section 7 names the archive\'s records');
  const owner = new Map();
  for (const [who, art] of [['realm', realmArt()], ['hall', hallArt()], ['steps', stepsArt()], ['remnant', remnantArt()], ['rift', sdRiftArt()]]) {
    for (const [rec] of art) { assert.ok(!owner.has(rec), `record ${rec} made once`); owner.set(rec, who); }
  }
  const named = [];
  for (const [, a, b] of said[1].matchAll(/(\d+)-(\d+)/g)) {
    const run = [];
    for (let r = Number(a); r <= Number(b); r++) run.push(r);
    assert.equal(new Set(run.map((r) => owner.get(r))).size, 1, `${a}-${b} is one producer's`);
    named.push(...run);
  }
  assert.deepEqual(named.sort((x, y) => x - y), [...owner.keys()].sort((x, y) => x - y), 'the sentence\'s records are the archive\'s, every one');
});

/** An axis-aligned box as a collider mesh. */
function box(x0, y0, z0, x1, y1, z1) {
  const P = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const I = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}

test('AUDIT SD IV (S1): THE END IS STOOD WITH THE LEVEL - the Rift, the Return and the landing back are placed by the host\'s own probe as the context is built, its doors shut, before a save or the room can open one; a door opened first moves all three (mutants: the stand left to the first unpaused frame)', () => {
  const D = read('src/scenes/dungeonContext.js');
  const at = D.indexOf('function standSdEnd()');
  const p0 = D.indexOf('const probe = {', at), p1 = D.indexOf('};', p0) + 2;
  const makeProbe = new Function('collider', `${D.slice(p0, p1)}; return probe;`);
  const I = trs(0, 0, 0, 0, 0, 0);
  // a closet 3 m across round the end, its east doorway shut by an action door onto a wider hall
  const level = () => {
    const collider = new Collider(() => -Infinity);
    for (const b of [box(-1.5, -0.2, -1.5, 13.5, 0, 6), box(-1.5, -0.2, -6, 13.5, 0, -1.5), box(-1.7, 0, -1.7, -1.5, 4, 1.7), box(-1.7, 0, 1.5, 1.5, 4, 1.7),
      box(-1.7, 0, -1.7, 1.5, 4, -1.5), box(1.5, 0, 0.6, 1.7, 4, 1.7), box(1.5, 0, -1.7, 1.7, 4, -0.6), box(1.5, 2.3, -0.6, 1.7, 4, 0.6), box(-1.7, 4, -6, 13.5, 4.2, 6)]) {
      collider.addMesh('dungeon', b.positions, b.indices, I);
    }
    const actions = new ActionSystem(collider, {});
    const door = box(1.55, 0, -0.6, 1.65, 2.3, 0.6);
    const o = actions.addDoor({ positions: door.positions, indices: door.indices }, I, { positionKey: 1 });
    return { collider, actions, key: o.key };
  };
  const round = (v) => v.map((n) => +n.toFixed(2));
  const stand = (collider) => {
    const probe = makeProbe(collider);
    const rift = sdRiftPlace(floorLanding(collider, [0, 0.2, 0]), probe), ret = sdReturnPlace(rift, probe);
    return { at: round(rift.at), size: +rift.size.toFixed(2), ret: round(ret), landing: round(sdLandingPlace(rift, ret, probe)) };
  };
  const built = level(), opened = level();
  opened.actions.restoreSaveData([{ key: opened.key, state: 'end', t: 1 }]);   // the path applyWorld takes, a save's or the room's
  const shut = stand(built.collider), open = stand(opened.collider);
  assert.deepEqual(shut.at, [0, 0, 0], 'built: the Rift in the closet, on the end');
  assert.notDeepEqual(open.at, shut.at, 'a door opened first moves the Rift');
  assert.notDeepEqual(open.landing, shut.landing, 'and the landing back');
  // so the host stands it as the level is built: after the api (every door the level has) and before it is handed back -
  // nothing outside can apply a state to a context it does not yet hold
  const api = D.indexOf('\n  const api = {'), handed = D.indexOf('\n  return api;\n}');
  const stood = D.indexOf('\n  if (sdEnd && !_sdEndAsked) { _sdEndAsked = true; standSdEnd(); }\n  return api;\n}');
  assert.ok(api > 0 && stood > api && stood < handed, 'the end stood at the build\'s end, latched');
  assert.match(D, /if \(playerFeet && !_sdEndAsked\) \{ _sdEndAsked = true; standSdEnd\(\); \}/, 'the first frame finds it stood');
  const applies = [...D.matchAll(/(?<!function )\bapplyWorld\(/g)].map((m) => m.index);
  assert.ok(applies.length >= 2 && applies.every((i) => i > api && i < stood), 'a save\'s or the room\'s doors reach it only through the api it hands back');
});

test('AUDIT SD IV (R1): THE HOUR\'S LIGHT AFTER THE LAST FLAT - its blows, spoils\' lines, motes, sparks and beam (no depth written) drawn in drawFoes\' late slot, after the foes\', the piles\', the portals\' and the missiles\' flats and before the water; the Rift\'s window before them; drawn by the arm itself only when a window skips drawFoes (mutants: drawn before the flats again; the late slot forgets it; none under a window)', () => {
  const M = read('src/scenes/worldModes.js'), D = read('src/scenes/dungeonContext.js');
  // the late slot, run from its own text: the veiled peers, then the Hour's light - in the Hour alone
  const slot = /lateWorldDraw: (\(\) => \{[^\n]*?\}),/.exec(M);
  assert.ok(slot, 'the dungeon context\'s late slot');
  for (const on of [true, false]) {
    const calls = [], late = { on, proj: 'P', view: 'V', eye: 'E' };
    const host = { drawVeiledPeerBodies: () => calls.push('veiled'), drawSdTelegraph: (a) => calls.push(a === late ? 'hour' : 'other') };
    new Function('host', '_sdLate', `return ${slot[1]};`)(host, late)();
    assert.deepEqual(calls, on ? ['veiled', 'hour'] : ['veiled'], on ? 'in the Hour: after the veiled peers, with the frame\'s own record' : 'out of it: nothing');
  }
  // the arm: the record filled every frame, after the Rift's window; the Hour's light drawn here only under a window
  const rift = M.indexOf('if (dungeonCtx.sdEndLook) host.drawSdRift?.(');
  const kept = M.indexOf('_sdLate.on = isSdRealm(dungeonLoc); _sdLate.proj = proj; _sdLate.view = view; _sdLate.eye = mwv.eye;');
  const under = M.indexOf('if (_sdLate.on && dungeonCtx.uiOverlayActive) host.drawSdTelegraph?.(_sdLate);');
  const overlay = M.indexOf('if (dungeonCtx.uiOverlayActive) { dungeonCtx.hideHudText?.();');
  const foes = M.indexOf('dungeonCtx.drawFoes(dt, canvas, proj, view,');
  assert.ok(rift > 0 && kept > rift && under > kept && overlay > under && foes > overlay, 'kept after the window, drawn under a window before its return, else left to drawFoes');
  assert.equal((M.match(/host\.drawSdTelegraph\?\.\(/g) ?? []).length, 2, 'two doors, never both in a frame');
  // drawFoes: the flats, the spells' light, then the late slot, then the water
  const flats = D.indexOf('renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],');
  const fx = D.indexOf('magic.drawFx?.();'), hook = D.indexOf('opts.lateWorldDraw?.();'), water = D.indexOf('renderer.drawWater(waterQuads, DUNGEON_WATER_COLOR,');
  assert.ok(flats > 0 && fx > flats && hook > fx && water > hook, 'after every flat drawFoes draws, before the water');
});

test('AUDIT SD IV (R3): THE ARENA\'S FLOOR HAS AN EDGE - past its rim a spark rests on nothing (flying, it flies on down; at rest, it slides off and falls), the shader\'s own flight and its JS mirror the same; a burst with no edge rests as before (the court\'s); the Stomp\'s ring throws no dust past the rim, a Stomp at the Remnant\'s keep as well (mutants: the edge never handed to the pass; the rest kept past it; the dust past the rim kept; the Hour\'s bursts edgeless)', () => {
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const shader = (i, t, at, floor, edge, power) => {
    const f = glslFunctions(FX_SPARK_VS, { aI: i, uVP: I4, uAt: at, uFloor: floor, uEdge: edge, uT: t, uPower: power, uPxPerM: 100, uColor: [1, 1, 1], uGrit: 0 });
    f.main();
    return f.globals.vWorld;
  };
  const [cx, , cz] = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z), R = SD_ARENA.r, floor = SD_FX_FLOOR_Y;
  assert.deepEqual([...SD_FX_EDGE], [cx, cz, R], 'the arena\'s centre in the dungeon\'s frame, its rim');
  // the Stomp's ring dust a metre in from the rim: some of its sparks cross it flying, some after they came to rest
  const power = SD_FX_KINDS.ring.power, at = [cx + (R - 1), floor + 0.1, cz], rest = floor + 0.05;
  let past = 0, slid = 0;
  for (let i = 0; i < FX_SPARKS; i++) {
    for (let t = 0.05; t < FX_BURST_MS / 1000; t += 0.1) {
      const g = shader(i, t, at, floor, SD_FX_EDGE, power);
      const j = sparkAt(i, t, power, floor - at[1], [cx - at[0], cz - at[2], R]);
      assert.ok(Math.abs(g[0] - (at[0] + j.at[0])) < 1e-3 && Math.abs(g[1] - (at[1] + j.at[1])) < 1e-3 && Math.abs(g[2] - (at[2] + j.at[2])) < 1e-3, `spark ${i} at ${t}: the mirror is the shader`);
      const d = Math.hypot(g[0] - cx, g[2] - cz);
      if (d < R) assert.ok(g[1] >= rest - 1e-4, 'on the arena: never through its floor');
      else if (d > R + 0.2) { past++; assert.ok(Math.abs(g[1] - rest) > 1e-3, `spark ${i} at ${t}: past the rim, never at rest on the air`); if (g[1] < rest) slid++; }
      const open = shader(i, t, at, floor, [0, 0, 0], power), old = sparkAt(i, t, power, floor - at[1]);
      assert.ok(Math.abs(open[1] - (at[1] + old.at[1])) < 1e-3 && old.at[1] >= floor - at[1] + 0.05 - 1e-9, 'no edge: the floor as it always was');
    }
  }
  assert.ok(past > 50 && slid > 20, `a burst a metre in from the rim runs sparks past it (${past}), and they fall (${slid})`);
  // the pass hands each burst's edge, and none for a burst that says none
  const calls = [];
  const gl = new Proxy({ BLEND: 9, ONE: 10, CULL_FACE: 11, POINTS: 0, TRIANGLES: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7 }, { get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const pass = new GateFxRenderer(gl);
  calls.length = 0;
  pass.draw([{ at, t: 0.2, kind: SD_FX_KINDS.volley, color: [1, 1, 1], floor, edge: SD_FX_EDGE }, { at: [0, 0, 0], t: 0.2, kind: SD_FX_KINDS.volley, color: [1, 1, 1] }], null, I4, I4, [0, 0, 0], 0);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uEdge').map((c) => c.slice(2)), [[cx, cz, R], [0, 0, 0]], 'the Hour\'s edge, then the court\'s none');
  // the Stomp's dust: none past the rim - at its keep the far points dropped, the near ones kept on the front
  const T0 = 1_800_000_000_000;
  for (const [x, z, n] of [[3, 4, SD_RING_DUST.n], [0, SD_REM.keep, null]]) {
    let t = T0;
    const s = { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x, z, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0 };
    const fx = createSdFx({ link: { state: () => s, now: () => t }, feet: () => null, shake: () => {} });
    fx.frame();
    s.rem.atk = { k: 'atk', b: SD_BODY.remnant, i: 9, a: SD_BLOWS.stomp.id, at: T0 + 200, x, z, yw: 0, tg: [] };
    t += 220; fx.frame();
    t += SD_RING_DUST.after; fx.frame();
    const all = fx.bursts(t), dust = all.filter((q) => q.kind === SD_FX_KINDS.ring);
    assert.ok(all.length > 0 && all.every((q) => q.edge === SD_FX_EDGE), 'every burst of the Hour says where its floor ends');
    assert.ok(dust.every((q) => Math.hypot(q.at[0] - cx, q.at[2] - cz) <= R), 'no dust past the rim');
    if (n != null) assert.equal(dust.length, n, 'a Stomp well inside throws all its dust');
    else assert.ok(dust.length > 0 && dust.length < SD_RING_DUST.n, `at its keep, ${dust.length} of ${SD_RING_DUST.n}: the far ones over the void dropped`);
  }
});
