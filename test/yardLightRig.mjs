// YARD-LIGHT's rig: the world host's own night light composition, run out of its source over a real Renderer on a fake
// GL (audit0928_render.test.js's R2 harness, with the yards in its scope) - test/scenes/yardlight.test.js and
// test/world/audityardlight.test.js share it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer } from '../src/render/renderer.js';
import { EL_LANE, lanternColor } from '../src/render/enhancedLighting.js';
import { CITY_LIGHT_COLOR, fillLanternPool, nearestLights, rangesFor, capFadeColors, capFadePairs } from '../src/world/city/cityLights.js';
import { withPlayerLights } from '../src/scenes/magicCandle.js';
import { wodLightColors } from '../src/world/worldOfDaggerfall/worldOfDaggerfall.js';
import { yardLampRows } from '../src/scenes/homeYards.js';
import { adoptLight } from '../src/render/lightId.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
/** The pool and its helpers (from the lantern pool's declaration to _wodSetLights' end) and the frame's composition
 *  (from `const wodLit` to the pool frame that follows it) - world.js's own text. */
function exteriorLightsSource() {
  const from = W.indexOf('  const _sceneLights = [];');
  const setAt = W.indexOf('const _wodSetLights = (data, sel) => {', from);
  const helpers = W.slice(from, W.indexOf('\n  };', setAt) + 5);
  const at0 = W.indexOf('    const wodLit = wod ? _wodLitCount() : 0;');
  const block = W.slice(at0, W.indexOf('    csaPoolFrame(dt);', at0));
  assert.ok(from > 0 && setAt > from && at0 > setAt && block.includes('yards.lamps()'), 'the exterior light code is where this reads it');
  // SHIPYARDS: the port's lamps go through the host's own helper (world.js portLightsInto - PERF-V8 keeps it out of the frame)
  const portAt = W.indexOf('  function portLightsInto(out) {');
  const port = W.slice(portAt, W.indexOf('\n', portAt));
  assert.ok(portAt > 0 && block.includes('portLightsInto(csaLit)'), 'the port\'s lamps are where this reads them');
  return new Function('__scope', `with (__scope) {\n${helpers}\n${port}\n${block}\n}`);
}
function fakeCanvas() {
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
}
/** The street lanterns' colour as the renderer uploads it on a lane (decoded) or the classic set. */
export function streetColor(lane) {
  const c = lanternColor(lane, new Float32Array(CITY_LIGHT_COLOR));
  return lane ? [...EL_LANE.decode3(c, new Float32Array(3))] : [...c];
}
/** One exterior frame through world.js's composition: `town` the street's lanterns (pixel-local, one pixel at the
 *  origin), `lamps` what the yards hand (scene space - the lights a yard's pool keeps: x, y, z, range, slot), `night`
 *  the lanterns' hours, `ranges` the town's animator and `tick` what its tick does to them; SHIPYARDS: `ports` what a
 *  port's pool hands (scenes/portHost.js lights - x, y, z, range), none by default. Answers each light the renderer
 *  took - its place, range and uploaded colour. */
export function exteriorFrame({ lane, night, town, lamps, eye, ranges, tick = () => {}, ports = null }) {
  const renderer = new Renderer(fakeCanvas());
  if (lane) renderer.setLightingLane(EL_LANE);
  const scope = {
    renderer, cam: { pos: eye, yaw: 0 }, minute: night ? 60 : 720, dt: 1 / 60, lightsOnAt: () => night,
    built: new Map([['0,0', { px: 0, py: 0, lights: town.map((l) => [l.x, l.y, l.z]) }]]),
    state: { pixelTranslation: (_px, _py, out = [0, 0, 0]) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; } },
    worldLightAnimator: { tick: () => tick(ranges), ranges },
    wod: null, csaOn: () => false, csa: { lights: () => [] },
    magic: null, _dwFogP: null, playerTorchLight: () => null, thunderlockMuzzleLight: () => null, playerEntity: {}, player: { feetAt: () => [0, 0, 0] },
    peerTorchLights: () => [], gatePool: null, riteHost: null, camps: { lights: () => [] }, droppedTorches: { lights: () => [] },
    naval: null, festivalStage: null, quays: null,
    poiHost: null,   // PIN MOVED (POI-2): a POI's own lights join the scene's - no POI in this rig
    starfall: null,   // PIN MOVED (STAR4): a fallen star's beacon and its camp's braziers join the scene's - no star in this rig
    portHost: ports ? { lights: () => ports } : null,   // SHIPYARDS: the lighthouses' lamps and the shipyards' lanterns, beside the quays'
    yards: { lamps: () => lamps }, yardLampRows,
    CITY_LIGHT_COLOR_F32: lanternColor(lane, new Float32Array(CITY_LIGHT_COLOR)),
    fillLanternPool, nearestLights, rangesFor, capFadeColors, capFadePairs, withPlayerLights, wodLightColors,
    meterFor: () => null,   // PIN MOVED (PERF-SIM3): the frame's CPU meter marks its spans inside this source - no meter in this rig
    adoptLight,   // PIN MOVED (LIGHT-ID): the pools name each entry by its light, and a quay's lantern its own (render/lightId.js)
  };
  exteriorLightsSource()(scope);
  const L = renderer._pointLights, n = Math.min(L.length / 4, renderer.maxPointLights);
  const colors = renderer._pointColorData(n);
  return Array.from({ length: n }, (_, i) => ({ at: [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]], range: L[i * 4 + 3], color: [...colors.subarray(i * 3, i * 3 + 3)] }));
}
export const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
