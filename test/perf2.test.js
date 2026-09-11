// PERF2 (2026-09-11, Mac: "find ways we can improve performance without
// downgrading across the board"). Two optimisations that change no
// pixel: the sky drawn AFTER the ground as a depth-tested far-plane
// pass (so it shades only the pixels nothing nearer claimed), and the
// grass field drawn one cell at a time, only the cells in view and in
// range. The grass EXECUTES against a stub GL that records the draws;
// the sky passes, the ring and the hosts' order are text-pinned. Every
// pin names its mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LabGrassRenderer, createGrassField, grassPerCell, GRASS_CELL } from '../src/render/labGrass.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** A WebGL2 just deep enough for the grass renderer: every call a
 *  no-op that answers what the constructor checks, the draws and the
 *  attribute pointers recorded. */
function stubGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, NEAREST: 14, TRIANGLES: 15, BLEND: 16, SRC_ALPHA: 17, ONE_MINUS_SRC_ALPHA: 18, CULL_FACE: 19, TEXTURE0: 20, TEXTURE3: 23 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}

/** a cell's blades, as the placer shapes them: perCell roots inside the cell, height h, root y. */
function cellPlaced(cx, cz, perCell, { h = 50, y = 10, cell = GRASS_CELL } = {}) {
  const inst = new Float32Array(perCell * 4), inst2 = new Float32Array(perCell * 4), rootY = new Float32Array(perCell), ground = new Float32Array(perCell * 3);
  for (let i = 0; i < perCell; i++) {
    inst[i * 4] = cx * cell + (i % 7) / 7 * cell; inst[i * 4 + 1] = cz * cell + Math.floor(i / 7) % 7 / 7 * cell; inst[i * 4 + 2] = h; inst[i * 4 + 3] = i / perCell;
    rootY[i] = y;
  }
  return { inst, inst2, rootY, ground, count: perCell, perCell };
}

test('PERF2 grass: only the cells in the frustum and inside the range are drawn - a cell behind the eye, a corner past the range, and an empty slot cost nothing (mutant: any cull dropped, or the pointers not moved)', () => {
  const { gl, calls } = stubGl();
  const r = new LabGrassRenderer(gl);
  const perCell = 49;
  r.allocSlots(perCell, 16);
  // the eye at the origin looking down +z (the port's forward), the frame every host builds
  const eye = [0, 12, 0];
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt(eye, [0, 12, 1], [0, 1, 0]);
  const cells = { ahead: [0, 3], behind: [0, -4], farAhead: [0, 9], left: [-6, 3] };   // cell coords; ahead = 90..120 m out; left = 150..180 m to the side at that depth, past a 46-degree half-cone but inside the range
  const slotOf = {};
  let slot = 0;
  for (const [name, [cx, cz]] of Object.entries(cells)) { r.writeSlot(slot, cellPlaced(cx, cz, perCell)); slotOf[name] = slot++; }
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, { sunDir: [0, 1, 0], amb: [0.2, 0.2, 0.2], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] }, 200);
  const draws = calls.filter((c) => c[0] === 'drawArraysInstanced');
  assert.equal(draws.length, 1, `one cell drawn: ${draws.length}`);
  assert.equal(draws[0][4], perCell, 'a cell is one instanced draw of its own blades');
  // the pointers moved to the drawn slot's run: buffer 0 holds 4 floats a blade
  const ptr = calls.filter((c) => c[0] === 'vertexAttribPointer' && c[1] === 1).pop();
  assert.equal(ptr[6], slotOf.ahead * perCell * 4 * 4, 'the instance pointer is the ahead cell\'s byte offset');
  assert.deepEqual(r.drawn, { slots: 1, blades: perCell });
  // turn round: the behind cell is the one drawn now
  calls.length = 0;
  r.draw(proj, lookAt(eye, [0, 12, -1], [0, 1, 0]), new Float32Array(eye), 0, { sunDir: [0, 1, 0], amb: [0.2, 0.2, 0.2], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] }, 200);
  const ptr2 = calls.filter((c) => c[0] === 'vertexAttribPointer' && c[1] === 1).pop();
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 1);
  assert.equal(ptr2[6], slotOf.behind * perCell * 4 * 4, 'the behind cell');
  // a wider range brings the far cell in; the left cell stays outside the cone either way
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, { sunDir: [0, 1, 0], amb: [0.2, 0.2, 0.2], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] }, 400);
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 2, 'ahead and far-ahead');
  // a cleared slot draws nothing
  r.clearSlot(slotOf.ahead);
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, { sunDir: [0, 1, 0], amb: [0.2, 0.2, 0.2], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] }, 200);
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 0);
  // the lab's whole scatter still draws whole, at offset 0
  r.set({ inst: new Float32Array(8), inst2: new Float32Array(8), rootY: new Float32Array(2), ground: new Float32Array(6), count: 2 });
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, { sunDir: [0, 1, 0], amb: [0.2, 0.2, 0.2], sunCol: [1, 1, 1], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] }, 200);
  const lab = calls.filter((c) => c[0] === 'drawArraysInstanced');
  assert.equal(lab.length, 1); assert.equal(lab[0][4], 2);
  assert.equal(calls.filter((c) => c[0] === 'vertexAttribPointer' && c[1] === 1).pop()[6], 0, 'the lab draws from the start');
});

test('PERF2 grass: the field hands the renderer cells through the same doors, so the world host needs no change (mutant: the box not recorded on write, or not cleared)', () => {
  const { gl } = stubGl();
  const r = new LabGrassRenderer(gl);
  const perCell = grassPerCell(1200000, 210, GRASS_CELL);
  const f = createGrassField(r, { keep: () => true, ground: null, density: 1200000 });
  assert.equal(r.slotBox.length, f.slots);
  assert.ok(perCell > 5000 && perCell < 7000, `the lab's density is ~6,100 blades a cell: ${perCell}`);
  f.update(0, 0);
  const live = r.slotBox.filter(Boolean).length;
  assert.ok(live > 0, 'the nearest cells arrived');
  for (const box of r.slotBox) if (box) { assert.ok(box[3] - box[0] <= GRASS_CELL * 1.5 && box[5] - box[2] <= GRASS_CELL * 1.5, `a box is about one cell: ${box}`); assert.ok(box[4] > box[1], 'and stands up'); }
});

test('PERF2 pins: the sky passes, the clouds\' composite and the ring sit AT the far plane and depth-test LEQUAL with the mask off; both hosts draw the sky after the ground and before the water (mutant: any pass back to a depth-blind first draw)', () => {
  for (const f of ['src/render/enhancedSky.js', 'src/render/dynamicSkiesRenderer.js']) {
    const s = read(f);
    assert.match(s, /gl_Position = vec4\(aPos, 1\.0, 1\.0\); \}`;/, `${f}: z at the far plane`);
    assert.match(s, /gl\.depthMask\(false\);\n\s+gl\.enable\(gl\.DEPTH_TEST\); gl\.depthFunc\(gl\.LEQUAL\);/, `${f}: tested, not written`);
    assert.match(s, /gl\.depthFunc\(gl\.LESS\);[^\n]*\n\s+gl\.depthMask\(true\);/, `${f}: the renderer's compare back`);
    assert.doesNotMatch(s, /gl\.disable\(gl\.DEPTH_TEST\)/, `${f}: no depth-blind draw left`);
  }
  const sr = read('src/render/skyRenderer.js');
  assert.match(sr, /gl_Position = vec4\(aPos, 1\.0, 1\.0\);/, 'the classic sky too');
  assert.match(sr, /gl\.enable\(gl\.DEPTH_TEST\); gl\.depthFunc\(gl\.LEQUAL\);/);
  const vc = read('src/render/volumetricClouds.js');
  assert.match(vc, /void main\(\) \{ vNdc = aPos; gl_Position = vec4\(aPos, 1\.0, 1\.0\); \}`;/, 'the clouds\' quad at the far plane');
  assert.match(vc, /gl\.useProgram\(this\.compositeProgram\);\n\s+gl\.enable\(gl\.DEPTH_TEST\); gl\.depthFunc\(gl\.LEQUAL\); gl\.depthMask\(false\);/, 'the composite tests');
  const ring = read('src/render/farRing.js');
  assert.match(ring, /void main\(\) \{\n\s+gl_FragDepth = 1\.0;/, 'the ring\'s fragments at the far plane - the "streamed world repaints everything nearer" law, by depth');
  assert.match(ring, /gl\.enable\(gl\.DEPTH_TEST\); gl\.depthFunc\(gl\.LEQUAL\);[^\n]*\n\s+gl\.depthMask\(false\);/);
  // the hosts: terrain, then the sky block, then the water
  const w = read('src/scenes/world.js');
  const terrainAt = w.indexOf('renderer.drawTerrain(p.terrain, pixelMatrix,');
  const skyAt = w.indexOf('sky.draw(cam.yaw, cam.pitch, fieldOfView(), worldAspect');
  const ringAt = w.indexOf('farRing.draw(view, {');
  const waterAt = w.indexOf('if (waterOn) {');
  const billAt = w.indexOf('renderer.drawBillboards(allBatches, camRight, UP_Y);');
  assert.ok(terrainAt > 0 && terrainAt < skyAt && skyAt < ringAt && ringAt < waterAt && waterAt < billAt, `world: terrain ${terrainAt} < sky ${skyAt} < ring ${ringAt} < water ${waterAt} < flats ${billAt}`);
  assert.equal((w.match(/renderer\.markForeignPass\(\);/g) || []).length, 3, 'moved, not added: glstate counts the seams');
  const e = read('src/scenes/exterior.js');
  const eTerrain = e.indexOf('renderer.drawTerrain(groundSurface, identityMatrix,');
  const eSky = e.indexOf('sky.draw(Math.atan2(dx, dz), Math.atan2(dy, horiz)');
  const eWater = e.indexOf('if (waterOn) {');
  assert.ok(eTerrain > 0 && eTerrain < eSky && eSky < eWater, `exterior: terrain ${eTerrain} < sky ${eSky} < water ${eWater}`);
  assert.match(w, /window\.__grassStats = \(\) => \(\{ blades: labGrass\.count, drawn: labGrass\.drawn,/, 'the probe reports what was drawn');
});
