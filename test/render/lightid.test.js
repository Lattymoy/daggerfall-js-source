// LIGHT-ID (2026-10-14, Mac: "Engine fix (Recommended)" - FIELD BUGS 2026-10-13e AOE-PERF's follow-up, the gate boss's
// lights): A LIGHT IS SOMEBODY'S LIGHT. bible/07-Rendering/Enhanced-Lighting-Arc.md LIGHT-ID.
//
// Pinned: THE ONE CONSTRUCTION SEAM - no light is written into a frame's list but through render/lightId.js (the source
// swept), each composer's list carrying its records' identities, and the pools that refill in order naming each entry
// by the light it stands for; the identity's own laws (a record keeps it and never shows it, a copy or a fresh record
// is another light unless it adopts, a pool adopts, a reused record is relit, a frozen record has one); the renderer lifting it for the shadow pass
// and keeping it through the flash and a snapshot; THE MOVER - a light that moved, by its identity, draws its cube whole
// (no static cache, no copy), the same casters into the same layers, and goes back to its cache when it stops, while a
// light with no name (an anonymous list, a new record each frame) keeps the cached path; and the court's own counts
// (tools/courtShadowProbe.mjs) before and after. The lo tier's half (a light holding a 512 slot draws no lo map) is
// disc15.test.js's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lightIdOf, relight, adoptLight, lightList, packLight, copyLights, lightIdsOf, NO_LIGHT_ID } from '../../src/render/lightId.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { SHADOW_TUNING, SHADOW_POINT_CASTERS } from '../../src/render/shadowPass.js';
import { nearestLights, fillLanternPool } from '../../src/world/city/cityLights.js';
import { withPlayerLights } from '../../src/scenes/magicCandle.js';
import { withCourtLights, courtLights } from '../../src/world/gate/gateArena.js';
import { realmLightsWith, realmLightsNear } from '../../src/world/superDungeon/sdRealm.js';
import { bossGlow } from '../../src/world/gate/gateBoss.js';
import { GATE_STATE_EMPTY } from '../../src/net/gate/gateLink.js';
import { courtShadowCounts, meanOf, worstOf, CASE_FRAMES } from '../../tools/courtShadowProbe.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ids = (list) => [...lightIdsOf(list)];

test('LIGHT-ID: THE ONE CONSTRUCTION SEAM - no light is written into a frame\'s list but by render/lightId.js: a record\'s place written into a vec4 (`out[i * 4] = l.x`, `data.set([l.x, l.y, l.z, l.range]`, `out[0] = f.x; out[1] = f.y`) stands in no other file of src/, and every composer that once wrote one goes through the seam (mutants: any composer written back by hand)', () => {
  const LITERAL = [
    /\[\s*[A-Za-z_.]+\s*\*\s*4\s*\]\s*=\s*[A-Za-z_.]+\.x\b/,
    /\.set\(\[\s*[A-Za-z_.]+\.x\s*,\s*[A-Za-z_.]+\.y\s*,\s*[A-Za-z_.]+\.z\s*,\s*[A-Za-z_.]+\.range\s*\]/,
    /\w+\[0\]\s*=\s*\w+\.x;\s*\w+\[1\]\s*=\s*\w+\.y;/,
  ];
  const hits = [];
  for (const f of walk(join(ROOT, 'src'))) {
    const rel = f.slice(ROOT.length);
    if (rel === 'src/render/lightId.js') continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (LITERAL.some((re) => re.test(code))) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, [], 'a light written into a list outside the seam');
  assert.match(rd('src/render/lightId.js'), /out\[i \* 4\] = l\.x; out\[i \* 4 \+ 1\] = l\.y; out\[i \* 4 \+ 2\] = l\.z; out\[i \* 4 \+ 3\] = range;\n\s+if \(out\.ids\) out\.ids\[i\] = lightIdOf\(l\);/, 'the seam writes the place and the identity side by side');
  for (const [file, re] of [
    ['src/world/city/cityLights.js', /packLight\(out, i, l, Number\.isFinite\(w\) \? w : CITY_LIGHT_RANGE\);/],
    ['src/scenes/magicCandle.js', /packLight\(out, i, l\);[\s\S]*copyLights\(out, live\.length, base, 0, keep \/ 4\);/],
    ['src/world/gate/gateArena.js', /packLight\(data, n \+ i, l\);/],
    ['src/world/superDungeon/sdRealm.js', /packLight\(H\.data, i, l\);/],
    ['src/render/renderer.js', /packLight\(out, 0, f\);/],
    ['src/tools/abyssLab.js', /packLight\(data, i, l\);/],
  ]) assert.match(rd(file), re, `${file}: through the seam`);
});

test('LIGHT-ID: THE POOLS THAT REFILL IN ORDER NAME EACH ENTRY BY THE LIGHT IT STANDS FOR - the street\'s lantern pool, the World of Daggerfall lights and the boats\' lanterns in it, the yards\' lamp rows, the Hour\'s burst lights - and the records made each frame for a light that lives on (a thrown torch, a burning foe, a camp, a ship\'s lantern, a quay\'s, a piece of the spoils, the gate\'s fire) take their source\'s; a burst\'s slot given to the next burst is relit (mutants: an entry left with its slot\'s name; a reused slot\'s light not relit)', () => {
  // the lantern pool, by its real fill: an entry is its lantern's, whichever slot the stream puts it in
  const a = [1, 2, 3], b = [4, 5, 6], c = [7, 8, 9];
  const pool = [];
  fillLanternPool([{ px: 1, py: 1, lights: [a, b] }], () => [0, 0, 0], pool, new Float32Array(4), new Float32Array([18]));
  assert.deepEqual([lightIdOf(pool[0]), lightIdOf(pool[1])], [lightIdOf(a), lightIdOf(b)]);
  fillLanternPool([{ px: 2, py: 2, lights: [c] }, { px: 1, py: 1, lights: [a, b] }], () => [0, 0, 0], pool, new Float32Array(4), new Float32Array([18]));   // a pixel streamed in ahead of it
  assert.deepEqual([lightIdOf(pool[0]), lightIdOf(pool[1]), lightIdOf(pool[2])], [lightIdOf(c), lightIdOf(a), lightIdOf(b)], 'each entry its lantern\'s after the reshuffle - never the slot\'s');
  const world = rd('src/scenes/world.js');
  assert.match(world, /e\.wodRange = l\.range; e\.wodColor = l\.color;\n\s+adoptLight\(e, l\);[^\n]*\n[\s\S]*?e\.wodRange = l\.range; e\.wodColor = l\.color;\n\s+adoptLight\(e, l\);/, 'the World of Daggerfall lights and the boats\' lanterns in the pool');
  assert.match(world, /csaLit\.push\(adoptLight\(\{ x: l\.x, y: l\.y, z: l\.z, range: l\.range, color: CITY_LIGHT_COLOR_F32 \}, l\)\)/, 'a quay\'s lantern, copied each frame');
  assert.match(rd('src/scenes/homeYards.js'), /e\.x = l\.x; e\.y = l\.y; e\.z = l\.z;\n\s+adoptLight\(e, l\);/, 'the yards\' rows');
  const fx = rd('src/scenes/superDungeon/sdFx.js');
  assert.match(fx, /o\.color\[2\] = b;\n\s+adoptLight\(o, src\);/, 'the Hour\'s pooled lights, each its burst\'s');
  assert.match(fx, /else \{ b\.edge = SD_FX_EDGE; relight\(b\); \}/, 'a burst slot reused is another light');
  const court = rd('src/scenes/gate/gateCourt.js');
  assert.match(court, /bossGlow\(s, t, _glow\)/, 'his glow, one kept record');
  assert.match(court, /else if \(b\.light\) relight\(b\.light\);/, 'a burst slot reused: its flash another light');
  assert.match(court, /const L = \(b\.light \?\?= \{ x: 0, y: 0, z: 0, range: 0, color: \[0, 0, 0\], carried: true \}\)/, 'each burst its own flash (GATE-MIX: a flash, casting no shadow)');
  for (const [file, src] of [['src/scenes/droppedTorches.js', 'd'], ['src/scenes/droppedTorches.js', 'p'], ['src/scenes/droppedTorches.js', 'fl'], ['src/scenes/camps.js', 'c.rec'], ['src/scenes/gate/gatePool.js', 'place'], ['src/scenes/spoilsPool.js', 'f']]) {
    assert.ok(new RegExp(`adoptLight\\(\\{ x: [^\\n]*\\}, ${src.replace('.', '\\.')}\\)`).test(rd(file)), `${file}: a frame's record named by ${src}`);
  }
  assert.match(rd('src/scenes/comeSailAway/comeSailAwayPool.js'), /map\(\(\{ _d, _src, \.\.\.l \}\) => adoptLight\(l, _src\)\)/, 'a ship\'s lantern, as she sails');
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /const _dgTint = \(l\) => \(l && !l\.aura \? adoptLight\(\{ \.\.\.l, color: [^\n]*\}, l\) : l\);/, 'the dungeon\'s flame tint, a copy a frame');
  assert.match(modes, /const abyssCandle = \(l, abyss\) => \(l && abyss \? adoptLight\(\{ \.\.\.l, range: [^\n]*\}, l\) : l\);/, 'the abyss\'s candle, a copy a frame');
});

test('LIGHT-ID: an identity is its record\'s - kept while the record lives and never seen in it (a deep-equal, a spread, Object.keys and JSON see the record it was), another for another record and for a copy unless the copy adopts it (a host\'s tint, `adoptLight({ ...l, color }, l)`); adoptLight takes a source\'s, relight makes a new one, and a frozen record (the court\'s braziers) has one all the same (mutants: an identity minted per ask; the identity shown in the record; relight a no-op; adopt a no-op)', () => {
  const glow = { x: 1, y: 2, z: 3, range: 7 };
  const id = lightIdOf(glow);
  assert.ok(id > NO_LIGHT_ID);
  glow.x = 9; glow.range = 18;
  assert.equal(lightIdOf(glow), id, 'refilled in place - the same light');
  assert.deepStrictEqual(glow, { x: 9, y: 2, z: 3, range: 18 }, 'the record compares as it was');
  assert.deepEqual([Object.keys(glow), JSON.stringify(glow)], [['x', 'y', 'z', 'range'], '{"x":9,"y":2,"z":3,"range":18}'], 'its fields and its wire form');
  assert.notEqual(lightIdOf({ ...glow, color: [1, 0, 0] }), id, 'a copy is another record - another light');
  assert.equal(lightIdOf(adoptLight({ ...glow, color: [1, 0, 0] }, glow)), id, 'a copy that says whose light it is is that light');
  assert.notEqual(lightIdOf({ x: 9, y: 2, z: 3, range: 18 }), id, 'a new record is another light, wherever it stands');
  const e = { x: 0, y: 0, z: 0 };
  assert.equal(lightIdOf(adoptLight(e, glow)), id, 'adopted');
  relight(glow);
  assert.notEqual(lightIdOf(glow), id, 'relit: another light');
  const brazier = courtLights()[0];
  assert.ok(Object.isFrozen(brazier));
  assert.equal(lightIdOf(brazier), lightIdOf(courtLights()[0]), 'a frozen record keeps one');
});

test('LIGHT-ID: every composer\'s list carries its lights\' identities in its own order - nearestLights\' selection, withPlayerLights\' player lights before the base\'s, withCourtLights\' and realmLightsWith\'s after the arm\'s - not enumerable (a list is its places), and copyLights keeps them or leaves an anonymous list\'s none (mutants: an identity left at 0; the base\'s dropped)', () => {
  const lamps = [{ x: 5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }];
  const near = nearestLights(lamps, [0, 0, 0], 16, 18);
  assert.deepEqual(ids(near), [lamps[1], lamps[2], lamps[0]].map(lightIdOf), 'nearest first, each its own');
  assert.equal(Object.keys(near).includes('ids'), false, 'not the list\'s value');
  assert.deepEqual(near, new Float32Array([1, 0, 0, 18, 3, 0, 0, 18, 5, 0, 0, 18]), 'the same vec4s');
  const torch = { x: 0, y: 1, z: 0, range: 4, carried: true };
  const lit = withPlayerLights(near, torch);
  assert.deepEqual(ids(lit), [torch, lamps[1], lamps[2], lamps[0]].map(lightIdOf));
  const glow = { x: 0, y: 3, z: 0, range: 7, color: [1, 0.4, 0.1] };
  const court = withCourtLights({ data: lit, colors: new Float32Array(12) }, [glow, ...courtLights().slice(0, 2)]);
  assert.deepEqual(ids(court.data), [torch, lamps[1], lamps[2], lamps[0], glow, ...courtLights().slice(0, 2)].map(lightIdOf));
  const hour = realmLightsWith({ data: lit, colors: new Float32Array(12) }, [glow], null);
  const lampsHere = realmLightsNear(null);
  assert.deepEqual(ids(hour.data), [torch, lamps[1], lamps[2], lamps[0], glow, ...lampsHere].map(lightIdOf));
  const out = lightList(3);
  copyLights(out, 0, new Float32Array([1, 2, 3, 4]), 0, 1);
  copyLights(out, 1, near, 1, 2);
  assert.deepEqual([...out.ids], [NO_LIGHT_ID, lightIdOf(lamps[2]), lightIdOf(lamps[0])], 'an anonymous list\'s none, a named one\'s its own');
});

/** A recording fake GL: the bound framebuffer and vertex array at every draw. */
function drawingGl() {
  let ids = 0, vao = null, fbo = null;
  const draws = [];
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (k === 'bindVertexArray') return (v) => { vao = v; };
      if (k === 'bindFramebuffer') return (t, f) => { if (t !== 36008) fbo = f; };
      if (k === 'drawArrays' || k === 'drawElements') return () => { draws.push({ fbo, vao }); };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { draws, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** A room lit by four lamps - `mover` (stepped by the scene), three still and far - a body posed beside the mover every frame;
 *  `name`: 'kept' (the mover one record, refilled), 'fresh' (a new record each frame), 'anonymous' (raw vec4s). */
function room({ name = 'kept' } = {}) {
  const { draws, canvas } = drawingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.18, 0.18, 0.18]), 0);
  const walls = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 40]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const body = { vao: { id: 'vao-body' }, count: 300, ranges: [{ first: 0, count: 300 }], _poseGen: 0 };
  const mover = { x: 0, y: 2, z: 3, range: 12 };
  const still = [{ x: 30, y: 2, z: 3, range: 12 }, { x: -30, y: 2, z: 3, range: 12 }, { x: 0, y: 2, z: 30, range: 12 }];   // the body out of their reach
  const frame = (dx = 0) => {
    mover.x += dx;
    let L;
    if (name === 'anonymous') { L = new Float32Array(16); [mover, ...still].forEach((l, i) => L.set([l.x, l.y, l.z, l.range], i * 4)); }
    else {
      L = lightList(4);
      [name === 'fresh' ? { x: mover.x, y: mover.y, z: mover.z, range: mover.range } : mover, ...still].forEach((l, i) => packLight(L, i, l));   // fresh: a new record (a copy, `{ ...mover }`, would be the same light)
    }
    r.setPointLights(L, new Float32Array([1, 1, 1]));
    r.everyLightCasts();
    draws.length = 0;
    r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
    const st = { ...r.shadows.stats, draws: draws.slice(), slot: r.shadows.casterOf[0] };
    r.drawMesh(walls, I, null);
    body._poseGen++;
    r.recordShadowBody(body, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, mover.x + 1, 0, 3, 1]), [mover.x + 1, 0.9, 3, 1.1]);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp: r.shadows, frame };
}

test('LIGHT-ID: THE MOVER - a light that moved (its own slot by its identity, another place) draws its cube whole, straight into the layers it is read from: six faces, no static face, no copy - and the frame it stands still it takes the cached path, which builds its cache once; the still lamps keep theirs (mutants: the mover judged by place alone; the slot found by place first; the mover drawn through its cache; its cache claimed after the move)', () => {
  const s = room();
  s.frame(); s.frame(); s.frame();
  for (let f = 0; f < 4; f++) {
    const st = s.frame(0.5);
    assert.equal(st.moverFaces, 6, `moving frame ${f}: its six faces drawn whole`);
    assert.equal(st.staticFaces, 0, `moving frame ${f}: no static cache drawn for it`);
    assert.equal(st.blits, 0, `moving frame ${f}: nothing copied`);
    assert.equal(st.facesDrawn, 6, `moving frame ${f}: and nothing else (the still lamps' bodies out of reach are none)`);
  }
  const stop = s.frame();
  assert.equal(stop.moverFaces, 0, 'still again: no mover');
  assert.equal(stop.staticFaces, 6, 'its cache built, once');
  assert.ok(stop.blits >= 6, 'and copied into its layers');
  const after = s.frame();
  assert.equal(after.staticFaces + after.moverFaces, 0, 'then served');
});

test('LIGHT-ID: A LIGHT WITH NO NAME IS NO MOVER - the same lamp moved in an anonymous list (raw vec4s), or handed as a new record every frame, takes the cached path every frame it moves, as every light did before (mutants: a mover claimed for an anonymous light; for a new record)', () => {
  for (const name of ['anonymous', 'fresh']) {
    const s = room({ name });
    s.frame(); s.frame(); s.frame();
    for (let f = 0; f < 3; f++) {
      const st = s.frame(0.5);
      assert.equal(st.moverFaces, 0, `${name} ${f}: no claim it moved`);
      assert.equal(st.staticFaces, 6, `${name} ${f}: its cache drawn`);
      assert.ok(st.blits >= 6, `${name} ${f}: and copied`);
    }
  }
});

test('LIGHT-ID: THE SAME MAP - a moving light\'s faces take, drawn whole, exactly the casters the cached path draws into its cache and its live layers between them (the room, the body beside it), face for face (mutants: the whole draw a static replay; or a dynamic one)', () => {
  const run = (direct) => {
    SHADOW_TUNING.moverDirect = direct;
    try {
      const s = room();
      s.frame(); s.frame(); s.frame();
      const st = s.frame(0.5);
      const k = st.slot;
      assert.ok(k >= 0 && k < SHADOW_POINT_CASTERS, 'the mover holds a 512 slot');
      const copy = s.sp._copyVao;
      return [0, 1, 2, 3, 4, 5].map((face) => {
        const into = new Set([s.sp.pointFbos[k * 6 + face], s.sp.cacheFbos?.[k * 6 + face]].filter(Boolean));
        return st.draws.filter((d) => into.has(d.fbo) && d.vao !== copy).map((d) => d.vao?.id).sort();
      });
    } finally { SHADOW_TUNING.moverDirect = true; }
  };
  const whole = run(true), cached = run(false);
  assert.deepEqual(whole, cached, 'face for face, the same casters');
  assert.ok(whole.flat().includes('vao-room') && whole.flat().includes('vao-body'), 'the room and the body beside it');
});

test('LIGHT-ID: the renderer lifts the identities off the list for the shadow pass (an anonymous list: none), shifts them under the storm\'s flash (its own first), and keeps them through a snapshot (mutants: not lifted; the flash\'s shift dropped)', () => {
  const { canvas } = drawingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const a = { x: 1, y: 2, z: 3, range: 10 }, b = { x: 4, y: 5, z: 6, range: 10 };
  const L = lightList(2); packLight(L, 0, a); packLight(L, 1, b);
  r.setPointLights(L, new Float32Array([1, 1, 1]));
  assert.deepEqual([...r._pointIds], [lightIdOf(a), lightIdOf(b)]);
  const flash = { x: 0, y: 50, z: 0, range: 900, color: [1, 1, 1] };
  r.setFlashLight(flash);
  assert.deepEqual([...r._pointIds], [lightIdOf(flash), lightIdOf(a), lightIdOf(b)], 'the flash first, then the list');
  assert.deepEqual([...r._pointLights.subarray(0, 4)], [0, 50, 0, 900]);
  r.setPointLights(new Float32Array([1, 2, 3, 10]), new Float32Array([1, 1, 1]));
  assert.equal(r._pointIds, null, 'an anonymous list names nothing');
  r.setPointLights(L, new Float32Array([1, 1, 1]));
  const rr = rd('src/render/renderer.js');
  assert.match(rr, /pointIds: this\._pointIds,/, 'a snapshot keeps them');
  assert.match(rr, /this\._pointIds = s\.pointIds \?\? null;/);
  assert.match(rr, /ids: this\._pointIds,   \/\/ LIGHT-ID/, 'and the pass is handed them');
});

test('LIGHT-ID: his glow is one kept record - bossGlow refills the court\'s own and answers the same numbers a fresh one has (mutants: a new record each call)', () => {
  const s = { ...GATE_STATE_EMPTY, day: 1, phase: 1, x: 2, z: -3, shieldUntil: 0, hp: 100, max: 100 };
  const out = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] };
  const got = bossGlow(s, 5000, out);
  assert.equal(got, out, 'the court\'s record, refilled');
  assert.deepEqual({ ...got, color: [...got.color] }, bossGlow(s, 5000), 'the numbers a fresh one has');
  const id = lightIdOf(out);
  bossGlow({ ...s, x: 6 }, 6000, out);
  assert.equal(lightIdOf(out), id, 'he moved - the same light');
});

test('LIGHT-ID: THE COURT, COUNTED (tools/courtShadowProbe.mjs) - while he walks among the crowd his glow draws six cube faces a frame, all of them whole, and no lo face and no copy (before: twelve - six static, six of movers - six lo, six copies); a Hellfire landing on five draws the same cube faces and, at its worst frame, 54 lo faces where 126 were (mutants: either law off)', () => {
  const walksNow = courtShadowCounts('walks', 'now'), walksBefore = courtShadowCounts('walks', 'before');
  assert.equal(walksNow.length, CASE_FRAMES);
  for (const x of walksNow) assert.deepEqual([x.faces, x.mover, x.stat, x.lo, x.blits], [6, 6, 0, 0, 0], 'now, every frame');
  for (const x of walksBefore) assert.deepEqual([x.faces, x.mover, x.stat, x.dyn, x.lo, x.blits], [12, 0, 6, 6, 6, 6], 'before, every frame');
  assert.deepEqual(walksNow.map((x) => x.bodyCorners), walksBefore.map((x) => x.bodyCorners), 'the same bodies in his maps');
  const fireNow = courtShadowCounts('hellfire', 'now'), fireBefore = courtShadowCounts('hellfire', 'before');
  assert.equal(meanOf(fireNow, 'faces'), meanOf(fireBefore, 'faces'), 'the flashes stand still - the same cube faces');
  assert.deepEqual([worstOf(fireNow, 'lo'), worstOf(fireBefore, 'lo')], [54, 126], 'the landing\'s worst lo frame (the lo array grown): the lamps that read lo maps alone');
  assert.ok(meanOf(fireNow, 'lo') < meanOf(fireBefore, 'lo'));
  const still = courtShadowCounts('still', 'now');
  assert.ok(still.every((x) => x.faces === 0 && x.lo === 0 && x.blits === 0), 'a still court draws nothing');
});
