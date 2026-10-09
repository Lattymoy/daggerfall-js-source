// SD25 S7 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 9): THE LAST
// MOMENT'S ARENA, its rest - the pillars dressed as clock-towers inside the law's squares, their dials' hands watching the
// Remnant, their lanterns, the bodies' marks, the Reset's dimming. Every law run from its own code; the pass's dial
// through test/glsl.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { glslFunctions } from './glsl.mjs';
import { SD_ARENA, SD_REALM_ORIGIN, SD_PILLAR_W, SD_PILLAR_H, SD_PILLAR_R, realmToDungeon, dungeonToRealm } from '../src/net/sdBrain.js';
import { SD_BLOWS, SD_REM, SD_ECHO, SD_REM_START, SD_BREAK_MS } from '../src/net/sdRemnant.js';
import { SD_FIGHT_EMPTY, sdBodyAt } from '../src/net/sdFightLink.js';
import {
  buildRealmModel, realmPillarTris, realmFloorTris, realmLampTris, realmColliderTris, realmLights, realmLightsWith, arenaLamp,
  SD_REALM_PILLAR_RECORD, SD_REALM_BRASS_RECORD, SD_LAMPS,
} from '../src/world/sdRealm.js';
import { realmArt, realmPillarArt } from '../src/world/sdRealmArt.js';
import { pillarCentre, sdPillarDials, sdLanterns, SD_PILLAR_LOOK, SD_PILLAR_DIAL, SD_LANTERN, SD_PILLAR_FACES } from '../src/world/sdPillarModel.js';
import { SD_RAMP } from '../src/world/sdLook.js';
import { paletteOf, offPalette } from '../src/world/sdPixelKit.js';
import { SD_PILLAR_FS, SD_DIAL_TEXELS, SD_DIAL_PART, SD_DIAL_HAND, SD_DIAL_RINGS, SD_PILLAR_DIALS, SD_LANTERNS, SD_LANTERN_SPILLS, sdPillarPassGeometry } from '../src/render/sdPillarPass.js';
import {
  sdPillarHandsAt, sdWatchedAt, handToward, sdLampDimAt, sdLampDimInto, sdPillarLookAt, sdPillarLook, sdArenaMarksAt, SD_RESET_DIM, SD_MARK_COLOR, SD_WATCH_HOME_Y,
} from '../src/scenes/sdArenaWatch.js';
import { SD_HEART_LIGHT } from '../src/scenes/sdRemnant.js';
import { SD_BLOW_COLOR } from '../src/scenes/sdRemnantBlows.js';
import { clearOfPillars } from '../src/scenes/sdSpoils.js';
import { SD_REMNANT_BODY, remnantScale } from '../src/world/sdRemnantModel.js';
import { TELEGRAPH_KIND, BOSS_MARK_R, telegraphField } from '../src/render/gateTelegraph.js';
import { BOSS_R } from '../src/net/gateBrain.js';
import { Collider } from '../src/player/collider.js';
import { identity } from '../src/world/mat4.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const T0 = 1_800_000_000_000;   // a whole second of the relay's clock
const HALF = SD_PILLAR_W / 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
/** A model's triangles: `[P (realm frame), record]`. */
function trisOf(model) {
  const out = [];
  for (const sm of model.subMeshes) {
    for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k += 3) {
      out.push([[0, 1, 2].map((j) => dungeonToRealm(model.positions[(k + j) * 3], model.positions[(k + j) * 3 + 1], model.positions[(k + j) * 3 + 2])), sm.textureRecord]);
    }
  }
  return out;
}
/** The pillar a triangle of the dress belongs to (its stone, or brass over the rim within reach of a square), or -1. */
const pillarOf = ([P, rec]) => {
  if (rec !== SD_REALM_PILLAR_RECORD && rec !== SD_REALM_BRASS_RECORD) return -1;
  for (let k = 0; k < 4; k++) {
    const [cx, cz] = pillarCentre(k);
    if (P.some((p) => Math.abs(p[0] - cx) < 1.2 && Math.abs(p[2] - cz) < 1.2 && p[1] > 0.2)) return k;
  }
  return -1;
};
/** A live fight, the page's own shape (net/sdFightLink.js), its clocks about T0. */
const live = (o = {}) => ({ ...SD_FIGHT_EMPTY, fi: 3, op: T0 - 60_000, ends: T0 + 840_000, ph: 1, rem: { x: 0, z: 8, yw: Math.PI, mv: null, atk: null }, ...o });

// ── the pillars dressed ─────────────────────────────────────────────────

test('S7 THE PILLARS DRESSED INSIDE THE LAW: every face of each pillar\'s dress (its basalt, its brass) inside its square from the floor to SD_PILLAR_H - the plinth flush with the square at the floor, the cap flat across the whole square at its top, the shaft chamfered in from it with three brass bands and a conduit in each chamfer, its stone wound out; the collider the four squares exactly (pillarQuads\' boxes), and nothing of the dress on it (mutants: a band past the square; the cap over the law\'s top; the plinth in from the square; a prism wound in; the collider drawn in to the shaft)', () => {
  const tris = trisOf(buildRealmModel()), dress = [[], [], [], []];
  for (const t of tris) { const k = pillarOf(t); if (k >= 0) dress[k].push(t); }
  for (let k = 0; k < 4; k++) {
    const [cx, cz] = pillarCentre(k), d = dress[k];
    assert.ok(d.length > 250, `pillar ${k}: dressed (${d.length} faces)`);
    for (const [P] of d) assert.ok(P.every((p) => Math.abs(p[0] - cx) <= HALF + 1e-4 && Math.abs(p[2] - cz) <= HALF + 1e-4 && p[1] >= -1e-6 && p[1] <= SD_PILLAR_H + 1e-4), `pillar ${k}: a face outside its square (${JSON.stringify(P.map((p) => [+(p[0] - cx).toFixed(3), +p[1].toFixed(3), +(p[2] - cz).toFixed(3)]))})`);
    const stone = d.filter(([, r]) => r === SD_REALM_PILLAR_RECORD);
    assert.ok(stone.some(([P]) => P.some((p) => p[1] < 1e-6 && Math.abs(Math.abs(p[0] - cx) - HALF) < 1e-4)), `pillar ${k}: its plinth flush with the square at the floor`);
    const top = d.filter(([P, r]) => r === SD_REALM_BRASS_RECORD && P.every((p) => Math.abs(p[1] - SD_PILLAR_H) < 1e-4));
    const area = top.reduce((a, [P]) => a + Math.hypot(...cross(sub(P[1], P[0]), sub(P[2], P[0]))) / 2, 0);
    assert.ok(Math.abs(area - SD_PILLAR_W * SD_PILLAR_W) < 1e-3, `pillar ${k}: its cap the whole square at its top (${area.toFixed(4)} m2)`);
    // the shaft: eight sides (four faces, four chamfers), inside the plinth
    const shaft = stone.filter(([P]) => P.some((p) => p[1] > 5) && P.some((p) => p[1] < 1));
    const ways = new Set(shaft.map(([P]) => { const n = cross(sub(P[1], P[0]), sub(P[2], P[0])); return Math.round(Math.atan2(n[2], n[0]) / (Math.PI / 4)); }));
    assert.equal(ways.size, 8, `pillar ${k}: a chamfered shaft`);
    assert.ok(shaft.every(([P]) => P.every((p) => Math.max(Math.abs(p[0] - cx), Math.abs(p[2] - cz)) <= SD_PILLAR_LOOK.shaft.w + 1e-4)), 'in from the square');
    const bands = new Set(d.filter(([P, r]) => r === SD_REALM_BRASS_RECORD && P.every((p) => p[1] > 1 && p[1] < 10 && Math.abs(Math.max(Math.abs(p[0] - cx), Math.abs(p[2] - cz)) - SD_PILLAR_LOOK.band.w) < 1e-4)).flatMap(([P]) => P.map((p) => Math.round(p[1] * 100))));
    assert.equal(bands.size, 6, `pillar ${k}: three brass bands (their feet and tops)`);
    const conduits = d.filter(([P, r]) => r === SD_REALM_BRASS_RECORD && Math.max(...P.map((p) => p[1])) - Math.min(...P.map((p) => p[1])) > 9);
    assert.equal(conduits.length, 4 * SD_PILLAR_LOOK.conduit.sides * 2, `pillar ${k}: a conduit in each chamfer`);
    for (const [P] of stone) {   // the stone is prisms about the pillar's axis: every side faces away from it, every top up
      const n = cross(sub(P[1], P[0]), sub(P[2], P[0])), c = [(P[0][0] + P[1][0] + P[2][0]) / 3 - cx, 0, (P[0][2] + P[1][2] + P[2][2]) / 3 - cz];
      const len = Math.hypot(...n), hz = Math.hypot(n[0], n[2]) / len;
      if (hz > 0.5) assert.ok(n[0] * c[0] + n[2] * c[2] > 0, `pillar ${k}: a stone side wound in`);
    }
  }
  // the collider: the four squares as they were (their sides and tops), nothing of the dress
  const want = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, px = SD_ARENA.x + Math.cos(a) * SD_PILLAR_R, pz = SD_ARENA.z + Math.sin(a) * SD_PILLAR_R;
    const C = (dx, y, dz) => realmToDungeon(px + dx, y, pz + dz), sq = [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]];
    const q = [];
    for (let i = 0; i < 4; i++) { const [ax, az] = sq[i], [bx, bz] = sq[(i + 1) % 4]; q.push([C(ax, 0, az), C(ax, SD_PILLAR_H, az), C(bx, SD_PILLAR_H, bz), C(bx, 0, bz)]); }
    q.push([C(-HALF, SD_PILLAR_H, -HALF), C(-HALF, SD_PILLAR_H, HALF), C(HALF, SD_PILLAR_H, HALF), C(HALF, SD_PILLAR_H, -HALF)]);
    for (const [A, B, Cc, D] of q) want.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
  }
  assert.deepEqual([...realmPillarTris()], [...new Float32Array(want)], 'the collider\'s pillars: the law\'s squares');
  const all = realmColliderTris();
  assert.equal(all.length, realmFloorTris().length + realmPillarTris().length + realmLampTris().length, 'the floors, the squares and the lamps\' posts: the lanterns stand on nothing');
});

test('S7 THE PILLARS\' STONE: basalt ashlar, a metre long in courses half a metre high (32 texels a metre), every texel in the basalt ramp, each course\'s joint dark across the whole picture, matte - no light of its own; the same every boot, among the realm\'s art (mutants: a light of its own; a course\'s joint gone)', () => {
  const a = realmPillarArt(), B = SD_RAMP.basalt, dark = B[0];
  assert.equal(a.albedo.width, 64); assert.equal(a.albedo.height, 64);
  assert.equal(offPalette(a.albedo, paletteOf(B)), 0, 'in the basalt ramp');
  assert.ok(a.emission.colors.every((v, i) => i % 4 === 3 || v === 0), 'matte');
  for (const y of [0, 16, 32, 48]) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4; assert.deepEqual([...a.albedo.colors.slice(i, i + 3)], dark, `row ${y}: a course's joint`); }
  const mid = (8 * 64 + 10) * 4;
  assert.notDeepEqual([...a.albedo.colors.slice(mid, mid + 3)], dark, 'a block\'s face');
  assert.deepEqual(realmPillarArt().albedo.colors, a.albedo.colors, 'the same pixels every boot');
  assert.deepEqual(realmArt().find(([r]) => r === SD_REALM_PILLAR_RECORD)?.[1].albedo.colors, a.albedo.colors, 'the realm wears it as its record');
});

test('S7 THE DIALS AND THE LANTERNS, where the pass draws them: sixteen dials, one on each face of each clock stage, a hair out of its stone and inside the square, facing out, their right along the face, wholly on it; four flames in the lanterns\' middles; the pass\'s quads exactly there (the housing\'s lit faces inside the square); and from the arena\'s heart nothing of the dress stands before a flame - the cage turned so no bar is on the pillar\'s diagonal (mutants: a dial past the square; a dial facing in; the cage\'s bars on the diagonals; a flame out of its cage)', () => {
  const D = sdPillarDials(), L = SD_PILLAR_LOOK, R = SD_PILLAR_DIAL.r;
  assert.equal(D.length, SD_PILLAR_DIALS);
  D.forEach((d, i) => {
    assert.deepEqual([d.k, d.j], [Math.floor(i / 4), i % 4]);
    const [cx, cz] = pillarCentre(d.k), at = dungeonToRealm(...d.at), [nx, nz] = SD_PILLAR_FACES[d.j];
    const out = (at[0] - cx) * nx + (at[2] - cz) * nz;
    assert.ok(out > L.clock.w && out < HALF, `dial ${i}: out of its stone (${out}), inside the square`);
    assert.deepEqual([d.n[0], d.n[2]], [nx, nz]);
    assert.ok(nx * (at[0] - cx) + nz * (at[2] - cz) > 0, 'facing out');
    assert.ok(Math.abs(d.right[0] * nx + d.right[2] * nz) < 1e-12 && Math.abs(Math.hypot(d.right[0], d.right[2]) - 1) < 1e-12 && d.right[1] === 0, 'its right along the face');
    assert.ok(R < L.clock.w && at[1] - R > L.step.y1 && at[1] + R < L.clock.y1, `dial ${i}: wholly on the clock stage`);
  });
  const F = sdLanterns();
  assert.equal(F.length, SD_LANTERNS);
  F.forEach((p, k) => {
    const [cx, cz] = pillarCentre(k), at = dungeonToRealm(...p);
    assert.ok(Math.abs(at[0] - cx) < 1e-9 && Math.abs(at[2] - cz) < 1e-9 && at[1] > SD_LANTERN.y0 && at[1] < SD_LANTERN.y1, `flame ${k} in its cage`);
  });
  const g = sdPillarPassGeometry();
  assert.equal(g.length, (SD_PILLAR_DIALS + SD_LANTERNS + SD_LANTERN_SPILLS) * 6 * 6);
  for (let v = 0; v < g.length / 6; v++) {
    const at = dungeonToRealm(g[v * 6], g[v * 6 + 1], g[v * 6 + 2]), kind = g[v * 6 + 5];
    if (kind < SD_PILLAR_DIALS) {
      const d = D[kind], c = dungeonToRealm(...d.at), u = g[v * 6 + 3], w = g[v * 6 + 4];
      assert.ok(Math.abs(at[0] - (c[0] + d.right[0] * u * R)) < 1e-4 && Math.abs(at[1] - (c[1] + w * R)) < 1e-4 && Math.abs(at[2] - (c[2] + d.right[2] * u * R)) < 1e-4, `dial ${kind}'s quad on its face`);
    } else if (kind >= SD_PILLAR_DIALS + SD_LANTERNS) {
      const [cx, cz] = pillarCentre((kind - SD_PILLAR_DIALS) % 4);
      assert.ok(Math.abs(at[0] - cx) < HALF && Math.abs(at[2] - cz) < HALF && at[1] < SD_PILLAR_H, 'a lit face of the housing inside the square');
    }
  }
  // from the arena's heart, at a flame's height, nothing of the dress before the flame
  const col = new Collider(() => -Infinity), tris = trisOf(buildRealmModel()).filter((t) => pillarOf(t) >= 0).flatMap(([P]) => P.flatMap((p) => realmToDungeon(...p)));
  const pos = new Float32Array(tris), idx = new Uint32Array(pos.length / 3);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  col.addMesh('dress', pos, idx, identity());
  F.forEach((p, k) => {
    const from = realmToDungeon(SD_ARENA.x, SD_LANTERN.flameY, SD_ARENA.z), d = sub(p, from), len = Math.hypot(...d);
    const hit = col.raycast(from, d.map((x) => x / len), len + 0.05);
    assert.ok(!(hit < len - 1e-3), `flame ${k}: seen from the arena's heart (met at ${hit} of ${len.toFixed(2)})`);
  });
});

// ── the dial and its hand ───────────────────────────────────────────────

test('S7 THE DIAL, run from the pass\'s own shader: a dark enamel face inside a brass bezel, twelve ticks (the quarters broad), a boss, and ONE HAND - its spade and its shaft out along its angle (0 at XII, a quarter at III on the dial\'s own u right, v up), its counterweight short behind; nothing of it the other way (mutants: the hand turned the wrong way round; no spade; the quarters thin)', () => {
  const f = glslFunctions(SD_PILLAR_FS, { uHands: new Array(16).fill(0) }), N = SD_DIAL_TEXELS, P = SD_DIAL_PART, H = SD_DIAL_HAND;
  assert.equal(N, 21);
  const at = (a, along, side = 0) => [Math.sin(a) * along + Math.cos(a) * side, Math.cos(a) * along - Math.sin(a) * side];
  for (const a of [0, 0.4, Math.PI / 2, 2.2, Math.PI, -1.1, -2.6]) {
    for (let k = H.boss + 1; k <= H.reach; k++) assert.equal(f.dialPart(at(a, k), a), P.hand, `angle ${a}: the shaft at ${k}`);
    assert.equal(f.dialPart(at(a, (H.spade0 + H.spade1) / 2, H.spadeW * 0.8), a), P.hand, `angle ${a}: the spade's breadth`);
    assert.equal(f.dialPart(at(a, (H.spade0 + H.spade1) / 2, H.spadeW + 1.5), a) === P.hand, false, 'and no broader');
    assert.equal(f.dialPart(at(a, -H.tail - 1), a), P.hand, 'its counterweight');
    for (const k of [-H.tail - H.weight - 1.5, -H.reach]) assert.notEqual(f.dialPart(at(a, k), a), P.hand, `angle ${a}: nothing of it at ${k}`);
  }
  assert.equal(f.dialPart([0, 0], 1), P.boss);
  assert.equal(f.dialPart([0, N + 0.5], 1), P.off);
  assert.equal(f.dialPart([0.3, N - 1], 2), P.bezel);
  const tickR = N - (SD_DIAL_RINGS.tick0 + SD_DIAL_RINGS.tick1) / 2;
  assert.equal(f.dialPart([0, tickR], 2), P.tick, 'XII');
  assert.equal(f.dialPart([SD_DIAL_RINGS.tickW + 0.3, tickR], 2), P.tick, 'the quarters broad');
  assert.equal(f.dialPart(at(Math.PI / 6, tickR, SD_DIAL_RINGS.tickW + 0.3), 2), P.enamel, 'the others thin');
  assert.equal(f.dialPart(at(Math.PI / 12, tickR), 2), P.enamel, 'enamel between');
});

test('S7 THE WATCHING HANDS: every dial\'s hand points at the Remnant\'s heart as seen on its own plane - where it waits, where it walked to at the last whole second (the escapement: taken at each anchored second, eased over its first quarter and held, never where it stands this instant); outside time each pillar at the Echo standing nearest it, at an Echo\'s heart; once it has fallen at the way home\'s place (the host\'s own, clear of the pillars); nothing to watch, XII (mutants: on now, no lag; the right turned over; the first Echo, never the nearest; its heart\'s height at the floor; the way home at the fall unmoved; the tick never eased)', () => {
  const D = sdPillarDials(), out = new Float32Array(16);
  const toward = (d, at) => { const v = sub(at, d.at), u = v[0] * d.right[0] + v[2] * d.right[2], s = Math.hypot(u, v[1]); return [u / s, v[1] / s]; };
  const pointsAt = (hands, target, why) => D.forEach((d, i) => {
    const t = typeof target === 'function' ? target(d) : target, [u, v] = toward(d, t);
    assert.ok(Math.sin(hands[i]) * u + Math.cos(hands[i]) * v > 0.9999, `${why}: dial ${i} (${hands[i].toFixed(3)} toward ${Math.atan2(u, v).toFixed(3)})`);
  });
  const heart = (x, z, y = SD_REMNANT_BODY.heartY) => realmToDungeon(SD_ARENA.x + x, y, SD_ARENA.z + z);
  sdPillarHandsAt(SD_FIGHT_EMPTY, T0 + 600, out);
  pointsAt(out, heart(SD_REM_START[0], SD_REM_START[1]), 'waiting where a fight begins it');
  assert.ok(new Set([...out].map((a) => a.toFixed(3))).size > 4, 'each dial its own way');
  // walking: at the second's whole the hands take where it stood then, eased in; held to the next
  const mv = { x: 0, z: 8, tx: 0, tz: -10, v: 2.6, at: T0 - 2000 }, s = live({ rem: { x: 0, z: 8, yw: Math.PI, mv, atk: null } });
  const at = (ms) => { const [x, z] = sdBodyAt(s.rem, ms); return heart(x, z); };
  for (const dt of [300, 600, 999]) { sdPillarHandsAt(s, T0 + 1000 + dt, out); pointsAt(out, at(T0 + 1000), `held at the last second (+${dt} ms)`); }
  sdPillarHandsAt(s, T0 + 1000, out);
  pointsAt(out, at(T0), 'at the tick, where it stood a second before');
  const was = Float32Array.from(sdPillarHandsAt(s, T0 + 1000, new Float32Array(16))), now = Float32Array.from(sdPillarHandsAt(s, T0 + 1250, new Float32Array(16))), mid = sdPillarHandsAt(s, T0 + 1100, new Float32Array(16));
  assert.ok(D.some((_, i) => Math.abs(now[i] - was[i]) > 0.01), 'a tick moves them');
  D.forEach((_, i) => assert.ok((mid[i] - was[i]) * (now[i] - mid[i]) >= -1e-9, `dial ${i}: eased from the one to the other`));
  // outside time: each pillar the Echo standing nearest it
  const ec = [{ x: -6, z: 0, yw: Math.PI, mv: null, atk: null, h: 100, m: 100, up: T0 - 9000, dn: 0 }, { x: 6, z: 2, yw: Math.PI, mv: null, atk: null, h: 100, m: 100, up: T0 - 9000, dn: 0 }];
  const br = live({ ph: 2, ec });
  sdPillarHandsAt(br, T0 + 500, out);
  pointsAt(out, (d) => { const [cx] = pillarCentre(d.k); const E = ec[cx > SD_ARENA.x ? 1 : 0]; return heart(E.x, E.z, SD_REMNANT_BODY.heartY * remnantScale(true)); }, 'the nearest Echo');
  // fallen: the way home's place (scenes/sdSpoils.js clearOfPillars - the world host's sdHomeAt), its window's middle
  const fx = SD_PILLAR_R * Math.SQRT1_2 + 0.3, fell = live({ fell: { at: T0 - 20_000, top: [], n: 0 }, rem: { x: fx, z: fx, yw: 0, mv: null, atk: null } });
  const [hx, hz] = clearOfPillars(fx, fx);
  assert.ok(Math.hypot(hx - fx, hz - fx) > 0.5, 'a fall inside a square is put clear of it');
  sdPillarHandsAt(fell, T0 + 500, out);
  pointsAt(out, heart(hx, hz, SD_WATCH_HOME_Y), 'the way home');
  const box = new Float64Array(3);
  assert.equal(sdWatchedAt(live({ ph: 2, ec: [] }), T0, 0, box), false, 'nothing to watch');
  assert.deepEqual([...sdPillarHandsAt(live({ ph: 2, ec: [] }), T0, out)], new Array(16).fill(0), 'XII');
  assert.deepEqual([...sdPillarHandsAt(null, T0, out)], new Array(16).fill(0));
  assert.equal(handToward(D[0], [D[0].at[0], D[0].at[1] + 5, D[0].at[2]]), 0, 'straight up is XII');
});

// ── the Reset's dimming ─────────────────────────────────────────────────

test('S7 THE RESET\'S DIMMING: the arena\'s lamps and lanterns at their whole light at rest; from the Reset\'s call down to 40% over its first SD_RESET_DIM.inMs, held through its wind-up, so its Hearts are the brightest things in the world; back over outMs from its landing, or from the stun its last Heart broken calls; nothing in a fight fallen or lost. The light list keeps its twenty and the arena\'s eight lamps alone are dimmed (realmLightsWith\'s dim): never the arm\'s own lights, the Hour\'s (the hearts\', the spoils\'), nor the other stages\' lamps; whole, the court\'s composition as it was. The pass dims with them (mutants: every lamp dimmed; the Hour\'s own dimmed; no ease in; the landing not bringing them back; the stun not bringing them back)', () => {
  const R = SD_BLOWS.reset, D = SD_RESET_DIM, called = T0, at = T0 + R.windup;
  const s = live({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: { a: R.id, at, x: 0, z: 0, yw: 0, i: 4 } } });
  assert.equal(D.to, 0.4);
  assert.equal(sdLampDimAt(live(), T0), 1, 'at rest');
  assert.equal(sdLampDimAt(s, called - 1), 1, 'before its call');
  assert.equal(sdLampDimAt(s, called), 1, 'at its call');
  const half = sdLampDimAt(s, called + D.inMs / 2);
  assert.ok(half < 1 && half > D.to, `dimming (${half})`);
  for (const t of [called + D.inMs, called + 4000, at - 1]) assert.ok(Math.abs(sdLampDimAt(s, t) - D.to) < 1e-12, `held through the wind-up (${t - called} ms)`);
  assert.ok(Math.abs(sdLampDimAt(s, at) - D.to) < 1e-12, 'at its landing');
  const back = sdLampDimAt(s, at + D.outMs / 2);
  assert.ok(back > D.to && back < 1, 'coming back');
  assert.equal(sdLampDimAt(s, at + D.outMs), 1, 'back');
  const st = live({ su: T0 + 9000, stunAt: T0 + 1000 });
  assert.ok(Math.abs(sdLampDimAt(st, T0 + 1000) - D.to) < 1e-12 && sdLampDimAt(st, T0 + 1000 + D.outMs / 2) > D.to && sdLampDimAt(st, T0 + 1000 + D.outMs) === 1, 'back from the stun');
  assert.equal(sdLampDimAt({ ...s, fell: { at: T0, top: [], n: 0 } }, called + 4000), 1, 'fallen');
  assert.equal(sdLampDimAt({ ...s, lost: T0 }, called + 4000), 1, 'lost');
  assert.equal(sdLampDimAt(null, T0), 1);
  // the light list: twenty, and the arena's eight alone dimmed
  const lamps = realmLights();
  assert.equal(lamps.length, 20, 'the Hour\'s light list keeps its count: the lanterns light nothing');
  assert.equal(lamps.filter(arenaLamp).length, SD_LAMPS.arena, 'the arena\'s lamps');
  const lit = { data: Object.assign(Float32Array.of(1, 2, 3, 4, 5, 6, 7, 8), { carried: Uint8Array.of(1, 0) }), colors: Float32Array.of(0.5, 0.6, 0.7, 0.8, 0.9, 1) };
  const hearts = [{ x: SD_REALM_ORIGIN[0], y: 4, z: SD_REALM_ORIGIN[2] + SD_ARENA.z, range: 9, color: [0.4, 1, 0.6] }];
  for (const eye of [realmToDungeon(0, 1.7, SD_ARENA.z), realmToDungeon(0, 1.7, 0), null]) {
    const copy = (v) => ({ data: [...v.data], colors: [...v.colors], carried: [...v.carried] });
    const whole = copy(realmLightsWith(lit, hearts, eye)), one = copy(realmLightsWith(lit, hearts, eye, Float64Array.of(1))), dim = copy(realmLightsWith(lit, hearts, eye, Float64Array.of(0.4)));
    assert.deepEqual(one, whole, 'whole, as it was');
    assert.deepEqual(dim.data, whole.data, 'the same lights in the same places');
    let dimmed = 0;
    for (let i = 0; i < whole.data.length / 4; i++) {
      const l = { x: whole.data[i * 4], z: whole.data[i * 4 + 2] }, own = i < 2, heart = Math.abs(whole.data[i * 4 + 3] - 9) < 1e-6;
      const k = !own && !heart && arenaLamp(l) ? 0.4 : 1;
      if (k < 1) dimmed++;
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(dim.colors[i * 3 + c] - whole.colors[i * 3 + c] * k) < 1e-6, `light ${i}: ${k < 1 ? 'dimmed' : 'whole'}`);
    }
    assert.equal(dimmed, SD_LAMPS.arena, 'the arena\'s eight');
  }
  // the pass's look: the hands, the dimming, the End's red from the numerals' own word
  const look = sdPillarLook(), into = new Float64Array(1);
  sdPillarLookAt(s, called + 4000, look, { end: 1 });
  assert.ok(Math.abs(look.k[0] - D.to) < 1e-6 && look.k[1] === 1 && look.hands.length === 16);
  sdPillarLookAt(live(), T0, look, { end: 0 });
  assert.deepEqual([...look.k], [1, 0]);
  assert.equal(sdLampDimInto(s, called + D.inMs / 2, into), into, 'into a kept array');
  assert.equal(into[0], half);
});

// ── the mark ────────────────────────────────────────────────────────────

test('S7 THE MARK: the Warden\'s WBX4 mark under the Remnant, always while it stands - waiting where a fight begins it, fighting, kneeling - a ring about its feet a little wider than its body and a chevron where it faces, in its brass; smaller under each Echo standing, each in its own metal; none outside time, rising out of the floor, fallen, its fight lost, nor under a fallen Echo; one kept shape each, refilled (mutants: the Echoes\' metals swapped; a mark under a fallen Echo; the Remnant marked outside time; its facing unset)', () => {
  let m = sdArenaMarksAt(SD_FIGHT_EMPTY, T0);
  assert.equal(m.length, 1);
  assert.equal(m[0].kind, TELEGRAPH_KIND.mark);
  assert.deepEqual([...m[0].origin], [...SD_REM_START]);
  assert.equal(m[0].yaw, Math.PI);
  assert.ok(Math.abs(m[0].r - (SD_REM.r + BOSS_MARK_R - BOSS_R)) < 1e-12, 'a little wider than its body');
  assert.equal(m[0].color, SD_MARK_COLOR.remnant);
  assert.equal(SD_MARK_COLOR.remnant, SD_BLOW_COLOR.stomp, 'its brass');
  const ahead = telegraphField(m[0], SD_REM_START[0] + Math.sin(Math.PI) * (m[0].r + 0.4), SD_REM_START[1] + Math.cos(Math.PI) * (m[0].r + 0.4));
  const behind = telegraphField(m[0], SD_REM_START[0] - Math.sin(Math.PI) * (m[0].r + 0.4), SD_REM_START[1] - Math.cos(Math.PI) * (m[0].r + 0.4));
  assert.ok(ahead.chevron && !behind.chevron && !behind.inside, 'its chevron where it faces');
  const s = live({ rem: { x: 3, z: -4, yw: 0.7, mv: null, atk: null } });
  m = sdArenaMarksAt(s, T0);
  assert.deepEqual([[...m[0].origin], m[0].yaw], [[3, -4], 0.7], 'where it stands, as it faces');
  assert.equal(sdArenaMarksAt({ ...s, su: T0 + 4000 }, T0 + 4000 - 8000 + 1000).length, 1, 'kneeling');
  const ec = [{ x: -6, z: 0, yw: 1, mv: null, atk: null, h: 100, m: 100, up: T0 - 9000, dn: 0 }, { x: 6, z: 2, yw: 2, mv: null, atk: null, h: 100, m: 100, up: T0 - 9000, dn: 0 }];
  m = sdArenaMarksAt(live({ ph: 2, ec }), T0);
  assert.equal(m.length, 2, 'outside time: the Echoes\', not the Remnant\'s');
  m.forEach((k, e) => {
    assert.deepEqual([[...k.origin], k.yaw], [[ec[e].x, ec[e].z], ec[e].yw]);
    assert.equal(k.color, SD_HEART_LIGHT.echo[e], `Echo ${e}: in its metal`);
    assert.ok(Math.abs(k.r - (SD_ECHO.r + BOSS_MARK_R - BOSS_R)) < 1e-12 && k.r < SD_REM.r + BOSS_MARK_R - BOSS_R, 'smaller');
  });
  const one = sdArenaMarksAt(live({ ph: 2, ec: [{ ...ec[0], h: 0, dn: T0 - 100 }, ec[1]] }), T0);
  assert.deepEqual(one.map((k) => k.color), [SD_HEART_LIGHT.echo[1]], 'none under a fallen Echo');
  assert.equal(sdArenaMarksAt(live({ ph: 2, ec: [{ ...ec[0], up: T0 + SD_BREAK_MS - 10 }, ec[1]] }), T0).length, 1, 'none under one still rising out of the floor');
  assert.equal(sdArenaMarksAt(live({ ou: T0 + SD_BREAK_MS }), T0).length, 0, 'none as it rises for the Last Moment');
  assert.equal(sdArenaMarksAt(live({ ou: T0 + 50 }), T0).length, 1, 'there once its legs are out');
  assert.equal(sdArenaMarksAt(live({ fell: { at: T0 - 100, top: [], n: 0 } }), T0).length, 0, 'none once it has fallen');
  assert.equal(sdArenaMarksAt(live({ lost: T0 - 100 }), T0).length, 0, 'none in a fight lost');
  const a = sdArenaMarksAt(SD_FIGHT_EMPTY, T0), a0 = a[0], b = sdArenaMarksAt(s, T0);
  assert.ok(a === b && b[0] === a0, 'one kept list, one kept shape a body');
});

// ── the hosts ───────────────────────────────────────────────────────────

test('S7 THE HOSTS BY SOURCE: the world host draws the pillars\' watch in the arena\'s reads (the hands, the dimming, the End off the numerals\' own word) and lays the bodies\' marks under the blows; the dungeon arm dims the arena\'s lamps by the world host\'s word; the blows\' pass draws the marks first, whether or not a blow is in flight; the lab draws all three and its ?law the pillars\' squares; the dungeon host and the exterior host untouched (mutants: the pillars\' watch undrawn; the marks never handed; the dimming never asked; the marks drawn under nothing)', () => {
  const W = read('src/scenes/world.js');
  assert.match(W, /_sdPillarPass = new SdPillarPassRenderer\(renderer\.gl\);/);
  assert.match(W, /if \(_sdPillarPass\.draw\(proj, view, sdPillarLookAt\(s, t, _sdPillarLook, _sdGlowMemo\), fog, [^\n]*\)\) drew = true;/);
  assert.match(W, /bodyMarks: \(\) => sdArenaMarksAt\(sdFightLink\.state\(\), sdFightLink\.now\(\)\),/);
  assert.match(W, /sdLampDim: \(\) => \(sdFightLink \? sdLampDimInto\(sdFightLink\.state\(\), sdFightLink\.now\(\), _sdLampDim\) : null\),/);
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /realmLightsWith\(_dgLit, host\.sdRealmLights\?\.\(\) \?\? NO_LIGHTS, cam\.pos, host\.sdLampDim\?\.\(\) \?\? null\)/);
  const B = read('src/scenes/sdRemnantBlows.js');
  assert.match(B, /const under = bodyMarks\(\);\n\s+if \(!shapes\.length && !under\.length\) return false;/);
  assert.match(B, /for \(let i = 0; i < under\.length; i\+\+\) \{ pass\.draw\(under\[i\], [^\n]*\n\s+for \(const sh of shapes\) \{ pass\.draw\(sh,/);
  const L = read('src/tools/abyssLab.js');
  assert.match(L, /if \(pillarPass\.draw\(proj, view, sdPillarLookAt\(labS, clock \* 1000, _pillarLook, _glowMemo\)/);
  assert.match(L, /for \(const m of sdArenaMarksAt\(labS, clock \* 1000\)\) \{ telegraph\.draw\(m,/);
  assert.match(L, /realmLightsWith\(EMPTY_LIT, \[[^\n]*\], cam\.pos, sdLampDimInto\(labFight\(\) \?\? SD_FIGHT_EMPTY, clock \* 1000, _labDim\)\)/);
  assert.match(L, /pillarTris = realmPillarTris\(\)/);
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js']) assert.doesNotMatch(read(host), /sdArenaWatch|sdPillarPass/, `${host}: flagged, not wired`);
  // the realm's model wears the dress, and its collider keeps the squares
  const R = read('src/world/sdRealm.js');
  assert.match(R, /for \(let k = 0; k < 4; k\+\+\) pillarVisual\(f, k, PILLAR_RECORDS\);/);
  assert.match(R, /for \(let k = 0; k < 4; k\+\+\) for \(const \[a, b, c, d\] of pillarQuads\(k\)\) out\.push/);
});

test('S7 THE ARENA\'S WATCH MAKES NOTHING - L2 F9\'s measure (a child with a 64 MB young space, the least of six windows, against a control that must show): the watching hands over a walking Remnant and over the Dragon Break, the dimming through a Reset, the marks, the pass\'s look, the lights dimmed - none past 2 bytes a frame (mutants: the hands\' target made a frame; the look\'s dimming made a frame; the marks\' list made a frame)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    const W = await import(${url('src/scenes/sdArenaWatch.js')});
    const { realmLightsWith } = await import(${url('src/world/sdRealm.js')});
    const { SD_FIGHT_EMPTY } = await import(${url('src/net/sdFightLink.js')});
    const { SD_BLOWS } = await import(${url('src/net/sdRemnant.js')});
    const { realmToDungeon } = await import(${url('src/net/sdBrain.js')});
    const T0 = ${T0};
    const clock = Array.from({ length: 4096 }, (_, k) => T0 + k * 16.7); clock.push('tagged');
    let k = 0;
    const tick = () => clock[(k = (k + 1) & 4095)];
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const base = { ...SD_FIGHT_EMPTY, fi: 3, op: T0 - 60000, ends: T0 + 840000, ph: 1 };
    const walk = { ...base, rem: { x: 0, z: 8, yw: Math.PI, mv: { x: 0, z: 8, tx: 0, tz: -10, v: 2.6, at: T0 }, atk: null } };
    const brk = { ...base, ph: 2, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: [{ x: -6, z: 0, yw: 1, mv: null, atk: null, h: 100, m: 100, up: T0 - 9000, dn: 0 }, { x: 6, z: 2, yw: 2, mv: { x: 6, z: 2, tx: -3, tz: 9, v: 3, at: T0 }, atk: null, h: 100, m: 100, up: T0 - 9000, dn: 0 }] };
    const reset = { ...base, rem: { x: 0, z: 0, yw: 0, mv: null, atk: { a: SD_BLOWS.reset.id, at: T0 + 8000, x: 0, z: 0, yw: 0, i: 4 } } };
    const out = {}, sink = [], hands = new Float32Array(16), look = W.sdPillarLook(), glow = { end: 0 };
    const feet = realmToDungeon(0, 1.7, 246), lit = { data: Object.assign(new Float32Array(8), { carried: new Uint8Array(2) }), colors: new Float32Array(6) }, none = Object.freeze([]);
    out.control = bytes(() => { sink[0] = [feet[0] + 0.5, feet[1] + 0.5, feet[2] + 0.5]; });
    // the hands' once-a-second path warmed as a long fight warms it (run a second at a time, it is still in the
    // interpreter after the measure's own warm-up, and the interpreter boxes every number it reckons)
    const box = new Float64Array(3);
    for (const f of [walk, brk, reset]) for (let n = 0; n < 40000; n++) W.sdWatchedAt(f, tick(), n & 3, box);
    out.handsWalk = bytes(() => W.sdPillarHandsAt(walk, tick(), hands));
    out.handsBreak = bytes(() => W.sdPillarHandsAt(brk, tick(), hands));
    const dimK = new Float64Array(1);
    out.dim = bytes(() => W.sdLampDimInto(reset, tick(), dimK));
    out.marks = bytes(() => { W.sdArenaMarksAt(walk, tick()); W.sdArenaMarksAt(brk, tick()); });
    out.look = bytes(() => W.sdPillarLookAt(reset, tick(), look, glow));
    out.lights = bytes(() => realmLightsWith(lit, none, feet, dimK));
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
  for (const [path, b] of Object.entries(m)) if (path !== 'control') assert.ok(b < 2, `${path}: ${b.toFixed(2)} bytes a frame (the control ${m.control.toFixed(2)})`);
});
