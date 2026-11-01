// THE SKY'S DRAW MAKES NOTHING. DynamicSkiesRenderer.draw runs every frame the sky is up; it hands the state's own arrays
// to the GL and builds no array, string or iterator of its own (measured by test/allocChild.mjs's child).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';

test('the sky\'s draw allocates nothing a frame - the moons\' uniforms named once, not spelled each draw', () => {
  const script = `
    const { DynamicSkiesRenderer } = await import(${JSON.stringify(new URL('../../src/render/dynamicSkiesRenderer.js', import.meta.url).href)});
    const { skyFrame, skyWeatherRow } = await import(${JSON.stringify(new URL('../../src/systems/dynamicSkies/dynamicSkies.js', import.meta.url).href)});
    const build = new Proxy({}, { get: (_t, k) => (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : (...args) => (k === 'getUniformLocation' ? { name: args[1] } : k === 'getShaderParameter' || k === 'getProgramParameter' ? true : {})) });
    const sky = new DynamicSkiesRenderer(build);
    const nop = () => {};
    const gl = { DEPTH_TEST: 1, LEQUAL: 2, LESS: 3, TEXTURE0: 4, TEXTURE_2D: 5, CULL_FACE: 6, TRIANGLES: 7 };
    for (const k of ['useProgram', 'depthMask', 'enable', 'disable', 'depthFunc', 'uniform1f', 'uniform1i', 'uniform3fv', 'uniform4fv', 'uniform4f', 'activeTexture', 'bindTexture', 'bindVertexArray', 'drawArrays']) gl[k] = nop;
    sky.gl = gl;
    sky.setState(skyFrame({ minuteOfDay: 1300, row: skyWeatherRow('cloudy') }));
    const bytes = (fn) => {
      for (let f = 0; f < 50000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const sink = [];
    const control = bytes(() => { sink[0] = [sky.fogMix + 0.5, 1, 2]; });
    const draw = bytes(() => sky.draw(0.3, 0.2, 1.1, 16 / 9));
    console.log(JSON.stringify({ control, draw }));
  `;
  const run = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const r = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(r.control >= 40, `the control made ${r.control.toFixed(2)} bytes a frame - the measure is blind`);
  assert.ok(r.draw < 2, `draw(): ${r.draw.toFixed(2)} bytes a frame (the control ${r.control.toFixed(2)})`);
});
