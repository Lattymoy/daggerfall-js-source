// AUDIT LIGHT-REACH (2026-10-30, the owner: "Audit"): the street's lamps and windows read cold, each finding fixed and
// pinned here by its ID (`bible/01-Overview/audits/Audit-Light-Reach.md`). The tiers summing to one through every
// frame of a walk and beside a wall whose lists overflow (W1, W2, W6); the far tier's own reach, its life without a
// near window, a shift of the origin, its lit rows, the cap's numbers (R1); a row against its tiles behind an
// off-centre curtained pane and on a front covered in part (W3, R1); the far rows' mips (W4); the shader's row walk
// whole (R2); the frame's builds making nothing (A1, W5); and the harbour's lamps at the lane's reach (S5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';
import { LC_BOX, CLUSTER_FAR, CLUSTER_Z, createClusterSpace, buildLightClusters, cellLights, cellOfPoint } from '../../src/render/lightClusters.js';
import {
  WindowLightPass, windowLightAt, windowRowAt, writeWindowLight, windowLightGlsl,
  WL_VEC4, WL_MAX_LIGHTS, WL_FAR_MAX, WL_FAR_GATHER, WL_ROW_TILES, WL_ROW_CURTAIN, WL_LAMP_GOBO, WL_GATHER,
} from '../../src/render/windowLight.js';
import { elAttenuation } from '../../src/render/enhancedLighting.js';
import { perspective, mirrorProjectionX, lookAt, identity } from '../../src/world/mat4.js';
import { STREET_LIGHT_REACH, streetLightReach, streetLightRange } from '../../src/world/city/cityLights.js';
import { hostText } from '../hostText.mjs';
import { createPortHost, LAMP_RANGE, OFFICE_LAMP_RANGE } from '../../src/scenes/portHost.js';
import { rng, norm, inBox, fakeGl, crossMask, highAt, glassAt, front, frontMesh, place, town, watchTiers, tierWeights } from '../lightReachRig.mjs';

const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
const LAMP = [1, 0.8, 0.5], PROJ = perspective(1.1, 16 / 9, 0.1, 500);
const viewAt = (eye, dir) => lookAt(eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], [0, 1, 0]);
function newPass(log) {
  const pass = new WindowLightPass(fakeGl(log), { activeTexture: () => {} });
  pass.addMask('m', crossMask());
  return pass;
}
/** `frames` street frames of a walk from `eye0` along `step` (m a frame), looking `dir`; `each(f, eye)` after each. */
function walk(pass, T, eye0, step, dir, frames, each) {
  let now = 1000;
  for (let f = 0; f < frames; f++) {
    const eye = [eye0[0] + step[0] * f, eye0[1] + step[1] * f, eye0[2] + step[2] * f];
    for (const { mesh, m } of T) pass.note(mesh, m, null, 'street', now);
    pass.frame({ kind: 'street', eye, view: viewAt(eye, dir), proj: PROJ, now, lamp: LAMP, glass: () => 'window' });
    now += 16;
    each?.(f, eye);
  }
}

test('AUDIT LIGHT-REACH W1, W2, W6: EVERY LIT TILE TAKES ITS WHOLE, EVERY FRAME - its near fade and its row\'s rest sum to what it is owed walking and running down a town\'s street (the near and far caps binding, their cuts easing), beside a long wall of glass (the near band\'s list overflowing, the far rows beside the eye) and before ten tall fronts (the far band\'s list overflowing): no tile dims or doubles, the near cut a light was faded by is the one the far rows read, no tile inside a cut is left out of its block, a cut held where its list overflowed, and beside the wall the far tier keeps its reach (mutants: LR-audit-fit-old-cut, LR-audit-no-refade, LR-audit-near-cap-unclamped, LR-audit-far-cap-unclamped, LR-audit-far-fit-word, LR-audit-no-hold, LR-audit-row-box-whole)', () => {
  const T = town();
  const wall = frontMesh(48, 6, 2.5, 2.5), W = [{ mesh: wall, m: place(-2, 0, 60, Math.PI / 2) }, { mesh: wall, m: place(2, 0, -60, -Math.PI / 2) }, ...T];
  const huge = frontMesh(48, 12, 2.5, 2.5), H = Array.from({ length: 10 }, (_, i) => ({ mesh: huge, m: place(-60, 0, -3 - 2 * i, 0) }));
  for (const [name, scene, eye0, step, dir, look, tilesMin, farMin] of [
    ['a town street, walking', T, [0, 1.7, 150], [0, 0, -0.05], [0, 0, -1], 30, 200, 100],
    ['a town street, running', T, [0, 1.7, 150], [0, 0, -0.1], [0, 0, -1], 30, 200, 100],
    ['beside a wall of glass, walking', W, [0, 1.7, 40], [0, 0, -0.024], [0, 0, -1], 40, 200, 100],
    ['before ten tall fronts, looking up', H, [0, 1.7, 0], [0, 0, 0], [0, 0.3, -1], 10, 100, 30],
  ]) {
    const pass = newPass(), watch = watchTiers(pass), fit = pass._fitBand.bind(pass);
    let farTrims = 0;
    pass._fitBand = (b, n, v, p, sp, cut) => { const k = fit(b, n, v, p, sp, cut); if (sp === pass.farSpace && k < n) farTrims++; return k; };
    let checked = 0, tiles = 0, dropped = 0, overflows = 0, minCutF = Infinity, far = 0;
    walk(pass, scene, eye0, step, dir, 60 + look, (f, eye) => {
      const r = tierWeights(pass, watch, eye, LAMP);
      watch.reset();
      if (f < 60) { farTrims = 0; return; }   // the cells built, the cuts eased
      checked++; tiles += r.tiles; dropped += pass.stats.dropped; far += pass.farCount; overflows += pass.stats.dropped > 0;
      minCutF = Math.min(minCutF, r.cutF);
      assert.deepEqual(r.gaps.slice(0, 3), [], `${name}, frame ${f}: tiles short of their whole (near cut ${r.cut.toFixed(2)}, far ${r.cutF.toFixed(2)})`);
      assert.deepEqual(r.doubles.slice(0, 3), [], `${name}, frame ${f}: tiles lit twice`);
    });
    assert.ok(checked === look && tiles > tilesMin * look && far > farMin * look, `${name}: ${tiles} tiles weighed over ${checked} frames, ${far} rows`);
    if (scene === H) assert.ok(farTrims > 0, 'the far band\'s list overflowed (the path under test)');
    if (scene === W) {
      assert.ok(dropped > 0, 'the near band\'s list overflowed at least once (the path under test)');
      assert.ok(overflows <= look / 8, `held where it overflowed, not eased back into it every other frame (${overflows} of ${look})`);
      assert.ok(minCutF > 40, `the far tier kept its reach beside the wall (${minCutF.toFixed(1)} m)`);
    }
  }
});

test('AUDIT LIGHT-REACH W6: A ROW\'S BOX THIS FRAME holds every point the row lights by this frame\'s words - over its lit tiles past the near fade\'s start and inside the far cut alone - on a walk down a street, its rows beside the eye trimmed to their far tiles (mutants: LR-audit-row-from-cut, LR-audit-row-to-gather, LR-audit-row-box-dark)', () => {
  const pass = newPass(), watch = watchTiers(pass), R = rng(12), mAt = (u, v) => (glassAt(u, v) ? 1 : 0);
  const h = WL_FAR_MAX * WL_VEC4 * 4;
  let lit = 0, trimmed = 0;
  walk(pass, town(), [0, 1.7, 150], [0, 0, -0.5], [0, 0, -1], 64, (f) => {
    if (f % 8 === 7) {
      const F = pass.farData, words = Array.from(F.subarray(h, h + 8));
      for (let i = 0; i < pass.farCount; i++) {
        const rec = F.subarray(i * WL_VEC4 * 4, (i + 1) * WL_VEC4 * 4);
        const { row } = watch.rows.find((x) => x.row.rec[0] === rec[0] && x.row.rec[1] === rec[1] && x.row.rec[2] === rec[2] && x.row.rec[27] === rec[27]);
        const B = row.box, vol = (b, at) => Math.hypot(b[at + 3], b[at + 4], b[at + 5]);
        if (vol(pass.farBoxes, i * LC_BOX) < vol(B, 0) - 1e-3) trimmed++;
        for (let k = 0; k < 120; k++) {
          const a = [R() * 2.2 - 1.1, R() * 2.2 - 1.1, R() * 2.2 - 1.1];
          const wp = [0, 1, 2].map((c) => B[c] + a[0] * B[3 + c] + a[1] * B[6 + c] + a[2] * B[9 + c]), n = norm([R() - 0.5, 0.3 + R(), R() - 0.5]);
          if (windowRowAt(rec, words, wp, n, mAt, elAttenuation)[0] <= 0) continue;
          lit++;
          assert.ok(inBox(pass.farBoxes, i * LC_BOX, wp), `row ${i} lights ${wp.map((v) => v.toFixed(2))} outside its frame box`);
        }
      }
    }
    watch.reset();
  });
  assert.ok(lit > 2000 && trimmed > 20, `${lit} lit points, ${trimmed} rows trimmed`);
});

test('AUDIT LIGHT-REACH R1: THE FAR TIER\'S OWN REACH - on a long street of sparse fronts its rows are written out past 140 m and none at WL_FAR_GATHER or beyond; with the eye farther than WL_GATHER from every window the near tier is empty and the far rows still light and upload; and every row it gathers has a lit tile (mutants: LR-audit-gather-near-reach, LR-audit-no-far-alone, LR-audit-dark-rows)', () => {
  assert.equal(WL_FAR_GATHER, 160, 'the record\'s 160 m');
  assert.equal(WL_FAR_MAX, 127, 'and its 127 rows');
  assert.equal(WL_ROW_TILES, 10, 'of up to 10 tiles');
  const mesh = frontMesh(8, 2, 2.5, 2.5), thin = frontMesh(1, 8, 2.5, 2.5), T = [];
  for (let i = 0; i < 16; i++) T.push({ mesh, m: place(-8, 0, -15 * i, Math.PI / 2) }, { mesh: thin, m: place(8, 0, -15 * i - 5, -Math.PI / 2) });   // 240 m of street, a front every 15 m; across it a tower of one-tile rows
  const log = [], pass = newPass(log);
  walk(pass, T, [0, 1.7, 2], [0, 0, 0], [0, 0, -1], 40);
  const fd = Array.from(pass._fd.subarray(0, pass.farCount));
  assert.ok(pass.farCount > 0 && fd.every((d) => d < WL_FAR_GATHER), `${pass.farCount} rows inside ${WL_FAR_GATHER} m`);
  assert.ok(Math.max(...fd) > 140, `the farthest row's nearest tile ${Math.max(...fd).toFixed(1)} m`);
  let dark = 0;
  for (const [, list] of pass.sources.street) for (const s of list) for (const p of s.subs ?? []) if (p) for (const t of p.tiles) if (t) dark += t.rows.filter((r) => !r.lit).length;
  assert.ok(dark > 10, `${dark} rows with no lit tile stand in the street`);
  for (let i = 0; i < pass._farUsed; i++) assert.ok(pass._farPool[i].row.lit, 'a gathered row has a lit tile');
  // the eye 100 m down the street from the last front: no near window, the far rows alone
  const lone = [{ mesh, m: place(-8, 0, 0, Math.PI / 2) }, { mesh, m: place(8, 0, -20, -Math.PI / 2) }];
  const log2 = [], pass2 = newPass(log2);
  let lit = 0;
  walk(pass2, lone, [0, 1.7, 100], [0, 0, 0], [0, 0, -1], 40, (f) => { if (f === 39) lit = log2.length; });
  log2.length = 0;
  const all = pass2.frame({ kind: 'street', eye: [0, 1.7, 100], view: viewAt([0, 1.7, 100], [0, 0, -1]), proj: PROJ, now: 1000 + 40 * 16, lamp: LAMP, glass: () => 'window' });
  assert.ok(lit > 0 && pass2.count === 0 && pass2.farCount > 0 && all === pass2.farCount, `near ${pass2.count}, far ${pass2.farCount}, answered ${all}`);
  assert.ok(log2.some((c) => c[0] === 'bufferSubData' && c[2] === 0 && c[5] === pass2.farCount * WL_VEC4 * 4), 'the far rows uploaded');
});

test('AUDIT LIGHT-REACH R1: A SHIFT OF THE ORIGIN makes the rows again - after `shift` the far block\'s rows and boxes are those a pass that only ever saw the moved town writes (mutant: LR-audit-shift-keeps-rows)', () => {
  const T = town(3, 8), off = [1024, 0, -2048];
  const moved = T.map(({ mesh, m }) => { const k = Float32Array.from(m); k[12] += off[0]; k[13] += off[1]; k[14] += off[2]; return { mesh, m: k }; });
  const a = newPass(), b = newPass();
  walk(a, T, [0, 1.7, 0], [0, 0, 0], [0, 0, -1], 30);
  a.shift(off);
  const eye = [off[0], 1.7, off[2]];
  walk(a, [], eye, [0, 0, 0], [0, 0, -1], 1);   // the moved placements are the pass's own now
  walk(b, moved, eye, [0, 0, 0], [0, 0, -1], 30);
  walk(b, [], eye, [0, 0, 0], [0, 0, -1], 1);
  assert.ok(a.farCount > 20 && a.farCount === b.farCount, `${a.farCount} rows against ${b.farCount}`);
  for (let i = 0; i < a.farCount * WL_VEC4 * 4; i++) assert.ok(near(a.farData[i], b.farData[i], 2e-3), `row word ${i}: ${a.farData[i]} against ${b.farData[i]}`);
  for (let i = 0; i < a.farCount * LC_BOX; i++) assert.ok(near(a.farBoxes[i], b.farBoxes[i], 2e-3), `box word ${i}`);
});

/** One front's rows against the sum of their tiles' near lights (glow aside, curtains at the row's mean edges) at
 *  random points - answers [rows, lit points]. */
function rowsAgainstTiles(sub, maskAt, mask, R) {
  const pass = new WindowLightPass(fakeGl(), { activeTexture: () => {} });
  pass.masks.set('m', mask);
  const s = { m: identity(), remap: null, seen: 0, subs: null }, frame = [0, 0, 0, 1e-3, 1, 1, 1, 1e6];
  let rows = 0, lit = 0;
  for (let ci = 0; ci < sub.cells.length / 6; ci++) {
    const t = pass._cellTiles(s, sub, ci), first = sub.cells[ci * 6 + 4];
    for (const row of t.rows) {
      const partial = row.js.some((j) => sub.ap[(first + j) * 18 + 14] > 1e-4 || sub.ap[(first + j) * 18 + 16] < 1 - 1e-4);
      if (partial) assert.equal(row.js.length, 1, 'a tile covered in part is a row alone');
      if (!row.lit || !pass._rowRecord({ row, s, sub, ci, t, mask })) continue;
      rows++;
      const tiles = row.js.map((j) => {
        if (!t.street[j]) return null;
        const keep = t.curtains[j];
        if (keep) t.curtains[j] = WL_ROW_CURTAIN;
        const l = pass._lampLight({ ap: sub.ap, k: (first + j) * 18, s, mask, t, j }, [1, 1, 1], 1 / WL_LAMP_GOBO);
        t.curtains[j] = keep;
        if (!l) return null;
        l.spill = [0, 0, 0];
        const r = new Float32Array(WL_VEC4 * 4);
        writeWindowLight(r, 0, l);
        return r;
      });
      for (let k = 0; k < 1500; k++) {
        const [x, z] = sub.rot((R() - 0.5) * 50, -10 + R() * 14), wp = [x, R() * 6, z], n = norm([R() - 0.5, 0.3 + R(), R() - 0.5]);
        const a = windowRowAt(row.rec, frame, wp, n, maskAt, elAttenuation)[0];
        let b = 0;
        for (const r of tiles) if (r) b += windowLightAt(r, wp, n, maskAt, elAttenuation)[0];
        assert.ok(near(a, b, 1e-5), `row ${row.js} at ${wp.map((v) => v.toFixed(2))}: ${a} against its tiles' ${b}`);
        if (a > 0) { lit++; assert.ok(inBox(row.box, 0, wp), 'inside the row\'s box'); }
      }
    }
  }
  return [rows, lit];
}

test('AUDIT LIGHT-REACH W3, R1: A ROW LIGHTS WHAT ITS TILES LIGHT behind an off-centre pane with curtains (the room\'s lamp behind the whole glass in both tiers - a curtain hides it, it does not move it) and on a front whose first and last tiles the mesh covers in part, each of those a row alone (mutants: LR-audit-lamp-in-gap, LR-audit-partial-in-run)', () => {
  const R = rng(31), mk = (at) => { const p = new WindowLightPass(fakeGl(), { activeTexture: () => {} }); p.addMask('m', crossMask(64, at)); const m = p.masks.get('m'); m.layer = 0; return m; };
  const off = mk(highAt), offAt = (u, v) => (highAt(u, v) ? 1 : 0);
  const [r1, l1] = rowsAgainstTiles(front(14, 0.7), offAt, off, R);
  const cross = mk(glassAt), crossAt = (u, v) => (glassAt(u, v) ? 1 : 0);
  const [r2, l2] = rowsAgainstTiles(front(14, -0.4, 2.5, -17.5, 0.3), crossAt, cross, R);
  assert.ok(r1 >= 3 && l1 > 300 && r2 >= 3 && l2 > 300, `${r1} rows / ${l1} points off-centre, ${r2} / ${l2} in part`);
});

test('AUDIT LIGHT-REACH W4: A MASK THE FAR ROWS ALONE READ HAS ITS MIPS THE FRAME IT GOES UP - the layers put up for the far tier are mipped after it, not a frame late (mutant: LR-audit-mips-before-far)', () => {
  const log = [], pass = new WindowLightPass(fakeGl(log), { activeTexture: () => {} });
  pass.addMask('m', crossMask());
  pass.addMask('f', crossMask(64, highAt));
  const T = [{ mesh: frontMesh(8, 2, 2.5, 2.5, 'm'), m: place(-8, 0, 0, Math.PI / 2) }, { mesh: frontMesh(8, 2, 2.5, 2.5, 'f'), m: place(-8, 0, -110, Math.PI / 2) }];
  let seen = false;
  walk(pass, T, [0, 1.7, 2], [0, 0, 0], [0, 0, -1], 30, () => {
    const up = log.map((c, i) => (c[0] === 'texSubImage3D' ? i : -1)).filter((i) => i >= 0), mip = log.map((c, i) => (c[0] === 'generateMipmap' ? i : -1)).filter((i) => i >= 0);
    if (pass.masks.get('f').layer >= 0 && up.length && !seen) {
      seen = true;
      assert.ok(mip.length && Math.max(...mip) > Math.max(...up), 'the frame\'s last upload is mipped in that frame');
    }
    log.length = 0;
  });
  assert.ok(seen && pass.farCount > 0, 'the far rows\' own mask went up');
});

test('AUDIT LIGHT-REACH R2: THE SHADER\'S ROW WALK, WHOLE - winRow as tools/winRowTwin.mjs proved it against its JS twin (windowRowAt) in WebGL2: a change to it runs that tool and moves this pin', () => {
  const g = windowLightGlsl({ atten: 'elAttenuation(rl, r)' });
  const from = g.indexOf('vec3 winRow('), body = g.slice(from, g.indexOf('\n}\n', from) + 2);
  assert.equal(body, WIN_ROW);
});

test('AUDIT LIGHT-REACH A1, W5: A FRAME\'S BUILDS MAKE NOTHING - the lanterns\' slices, the window boxes\' grid and the boxes themselves allocate nothing a light (a float handed across a call was a heap number, a box\'s corners a closure and a literal), against a control that must show', () => {
  const url = (p) => new URL(`../../${p}`, import.meta.url).href;
  const script = `
    const LC = await import(${JSON.stringify(url('src/render/lightClusters.js'))});
    const WL = await import(${JSON.stringify(url('src/render/windowLight.js'))});
    const M = await import(${JSON.stringify(url('src/world/mat4.js'))});
    const P = M.perspective(1.1, 16 / 9, 0.1, 500), V = M.lookAt([0, 1.7, 0], [0.3, 1.6, -1], [0, 1, 0]);
    let s = 7; const R = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const L = new Float32Array(48 * 4); for (let i = 0; i < 48; i++) L.set([(R() - 0.5) * 300, 4.1, -R() * 300, 27], i * 4);
    const B = new Float32Array(128 * 12); for (let i = 0; i < 128; i++) B.set([(R() - 0.5) * 140, 4, -R() * 140, 1, 0, 0, 0, 1.5, 0, 0, 0, 6], i * 12);
    const a = LC.createClusterSpace(64), b = LC.createClusterSpace(128), out = new Float32Array(128 * 12);
    const lights = Array.from({ length: 128 }, (_, i) => ({ c: [i, 2, -5], U: [1.2, 0, 0.1], V: [0, 1.4, 0], nf: [0, 0, 1], src: [i, 3, -6.8], kind: i % 2 ? 0 : 1, reach: 12, halfDiag: 0.9 }));
    const bytes = (fn, per) => { for (let f = 0; f < 400; f++) fn(); let least = Infinity;
      for (let w = 0; w < 5; w++) { globalThis.gc(); globalThis.gc(); const h0 = process.memoryUsage().heapUsed; for (let f = 0; f < 200; f++) fn(); least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 200 / per); }
      return least; };
    const sink = [];
    const r = {
      control: bytes(() => { sink[0] = [R(), R(), R()]; }, 1),
      lanterns: bytes(() => LC.buildLightClusters(L, 48, V, P, a), 48),
      boxes: bytes(() => LC.buildLightClusterBoxes(B, 128, V, P, b), 128),
      box: bytes(() => { for (let i = 0; i < 128; i++) WL.windowLightBox(lights[i], i % 3 > 0, out, i * 12); }, 128),
    };
    console.log(JSON.stringify(r));`;
  const child = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const r = JSON.parse(child.stdout.trim().split('\n').pop());
  assert.ok(r.control > 16, `the measure sees an allocation (${r.control} bytes)`);
  for (const k of ['lanterns', 'boxes', 'box']) assert.ok(r[k] < 2, `${k}: ${r[k].toFixed(2)} bytes a light`);
});

test('AUDIT LIGHT-REACH S5: THE HARBOUR\'S LAMPS TAKE THE LANE\'S REACH WITH THE STREET\'S - lit beside the town\'s lanterns in their hours and colour, the quays\' lanterns, the shipyard\'s office lantern and the lighthouse\'s lamp reach half again their own on the lane and their own on the classic set, so each keeps its size to its neighbours (mutants: LR-audit-quay-classic, LR-audit-port-classic, LR-audit-reach-lane-unread)', () => {
  assert.equal(streetLightReach(false), 1);
  assert.equal(streetLightReach(true), STREET_LIGHT_REACH);
  assert.equal(streetLightRange(true) / streetLightRange(false), streetLightReach(true), 'the street\'s by the same share');
  const host = hostText('src/scenes/world.js');
  assert.ok(host.includes('csaLit.push(adoptLight({ x: l.x, y: l.y, z: l.z, range: l.range * streetLightReach(lightingOn), color: CITY_LIGHT_COLOR_F32 }, l));'), 'the quays\' lanterns');
  assert.ok(host.includes('for (const l of portHost.lights(streetLightReach(lightingOn))) { l.color = CITY_LIGHT_COLOR_F32; out.push(l); }'), 'the port\'s lamps');
  // the port's own lamps, a shipyard and a lighthouse stood (shipyards1_audit_port.test.js's rig, cut down)
  const renderer = { textures: new Map(), uploadTexture: () => {}, createMesh: () => ({}), destroyMesh: () => {}, drawMesh: () => {}, recordShadowMesh: () => {}, createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} };
  const sites = [
    { key: '9:shipyard', kind: 'shipyard', x: 160, z: 100, yaw: 90, comp: 0, race: 'Breton', name: 'Y', keeper: { name: 'K', sex: 'male', variant: 0 }, crewmaster: { name: 'C', sex: 'male', variant: 1 } },
    { key: '9:lighthouse', kind: 'lighthouse', x: 100, z: 100, yaw: 0, comp: 0, race: 'Breton', name: 'L', keeper: { name: 'K', sex: 'male', variant: 0 } },
  ];
  const port = createPortHost({ renderer, collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), sites: () => sites, groundAt: () => 2, lit: () => true, now: () => 0 });
  port.frame();
  const ranges = (reach) => port.lights(reach).map((l) => l.range).sort((a, b) => a - b);
  assert.deepEqual(ranges(), [OFFICE_LAMP_RANGE, LAMP_RANGE], 'the classic set: their own');
  for (let i = 0; i < 3; i++) assert.deepEqual(ranges(STREET_LIGHT_REACH), [OFFICE_LAMP_RANGE * STREET_LIGHT_REACH, LAMP_RANGE * STREET_LIGHT_REACH], 'the lane: half again, every frame (never compounded)');
});

test('AUDIT LIGHT-REACH W7: AFTER A RELEASE NO TWO MASKS SHARE A LAYER - the free list and the holders are let go with the layers, so a layer freed before the release is not given out again beside the counter (mutant: LR-audit-release-keeps-free)', () => {
  const pass = new WindowLightPass(fakeGl(), { activeTexture: () => {} });
  for (const k of ['a', 'b', 'c']) { pass.addMask(k, crossMask()); assert.ok(pass._resident(pass.masks.get(k), 1)); }
  pass.dropMask('b');   // its layer waits on the free list
  pass.release();
  const layers = ['d', 'e', 'f'].map((k) => { pass.addMask(k, crossMask()); assert.ok(pass._resident(pass.masks.get(k), 2)); return pass.masks.get(k).layer; });
  assert.equal(new Set(layers).size, layers.length, `layers ${layers}`);
});

test('AUDIT LIGHT-REACH R1: A LANTERN PAST THE LAST SLICE\'S START is listed where a fragment past CLUSTER_FAR lands - the last slice reaches to infinity, as the shader\'s sliceOf (mutant: LR-audit-last-slice-bounded)', () => {
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.1, 2000)), view = lookAt([0, 1.7, 0], [0, 1.7, -1], [0, 1, 0]);
  const L = new Float32Array([2, 4, -(CLUSTER_FAR + 60), 27]), sp = createClusterSpace(4);
  assert.ok(buildLightClusters(L, 1, view, proj, sp));
  for (const z of [CLUSTER_FAR + 40, CLUSTER_FAR + 60, CLUSTER_FAR + 80]) {
    const cell = cellOfPoint([2, 4, -z], view, proj, [0, 0, 1920, 1080]);
    assert.equal(cell[2], CLUSTER_Z - 1, 'the last slice');
    assert.ok(cellLights(sp, cell[0], cell[1], cell[2]).includes(0), `a point ${z} m out finds the lantern`);
  }
});

/** The row walk tools/winRowTwin.mjs proved (AUDIT LIGHT-REACH R2). */
const WIN_ROW = `vec3 winRow(int i, vec3 wp, vec3 n, float isFlat) {
  int o = i * 7;
  vec4 r0 = uWinF[o], r3 = uWinF[o + 3], r4 = uWinF[o + 4];
  vec3 rel = wp - r0.xyz, lr = r4.xyz - r0.xyz;
  float s = dot(rel, r3.xyz), sl = dot(lr, r3.xyz);
  if (s <= 0.0 || sl >= 0.0) return vec3(0.0);   // behind the wall
  float tt = s / (s - sl);   // where a ray to any of the row's lamps crosses the glass's plane
  vec4 r1 = uWinF[o + 1], r2 = uWinF[o + 2];
  vec3 w0 = rel * (1.0 - tt) + lr * tt;   // ... from tile 0's glass centre; tile j's is this less PU j (1 - tt)
  float pw = 0.2 * tt, pa = pw * length(r1.xyz), pb = pw * length(r2.xyz);
  float b = dot(w0, r2.xyz);   // the same for every tile: the row runs along the glass's u
  if (abs(b) > 0.5 + pb) return vec3(0.0);
  float a0 = dot(w0, r1.xyz), stp = (1.0 - tt) / r3.w;   // tile j's a is a0 - j stp (u* . PU is 1 / span-u)
  vec4 r5 = uWinF[o + 5], r6 = uWinF[o + 6];
  highp int code = int(r6.w + 0.5);
  highp int cnt = code / 59049;
  int j0 = int(clamp(ceil((a0 - 0.5 - pa) / stp), 0.0, float(cnt))), j1 = int(clamp(floor((a0 + 0.5 + pa) / stp), -1.0, float(cnt - 1)));
  float lod = log2(max(max(pa * r3.w, pb * r4.w) * 128.0, 1.0)), layer = float(int(r5.w + 0.5) & 255), r = r0.w;
  vec3 acc = vec3(0.0);
  for (int j = j0; j <= j1; j++) {
    highp int st = (code / WL_P3[j]) % 3;
    if (st == 0) continue;   // a dark room
    float dq = length(r0.xyz + r6.xyz + r5.xyz * float(j) - uWinFrame[0].xyz);
    float wt = (1.0 - clamp((uWinFrame[0].w - dq) / (uWinFrame[0].w * 0.2), 0.0, 1.0)) * clamp((uWinFrame[1].w - dq) / (uWinFrame[1].w * 0.2), 0.0, 1.0);
    if (wt <= 0.0) continue;   // the near tier's, or past the far cut
    float u = r1.w + (a0 - float(j) * stp) * r3.w;
    if (st == 2 && (u < 0.25 - pa * r3.w || u > 0.75 + pa * r3.w)) continue;   // behind a curtain
    vec3 ray = r4.xyz + r5.xyz * float(j) - wp;
    float rl = length(ray);
    if (rl >= r) continue;
    float ndl = isFlat > 0.5 ? 1.0 : max(dot(n, ray), 0.0) / max(rl, 1e-4);
    if (ndl <= 0.0) continue;
    float m = textureLod(uWinMask, vec3(u, r2.w + b * r4.w, layer), lod).r;
    acc += uWinFrame[1].rgb * (m * ndl * (elAttenuation(rl, r)) * wt);
  }
  return acc;
}`;
