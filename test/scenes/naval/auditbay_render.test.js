// AUDIT BAY (2026-10-02, Mac: "Audit this. Must be perfect") - SHIPS OF THE BAY (ea3a7361e) audited, the drawing's lens:
// a ship fading out of the world (SHIP-FADE) took her shadow, her lanterns' light, her far lamps, her fire and smoke,
// her wake and her colours with her at full - only her hull and her flats faded - and the aside card's state line ran to
// a second. The real renderer and shadow pass over a recording GL (test/render/el2_shadows.test.js's), Come Sail Away's real
// pool, the real host (test/navalSea.mjs), and world.js's particle lists lifted from its source. Each pin is red on the
// record's code (ea3a7361e). `01-Overview/audits/Audit-Ships-of-the-Bay.md`.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sea } from '../../navalSea.mjs';
import * as SHADOW from '../../../src/render/shadowPass.js';
import { Renderer, WORLD_FRAME } from '../../../src/render/renderer.js';
import { EL_LANE } from '../../../src/render/enhancedLighting.js';
import { DISSOLVE_GLSL, BAYER_GLSL } from '../../../src/render/orderedDither.js';
import { createComeSailAwayPool, FADE_FLATS } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat, setLights } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createNavalFlames } from '../../../src/scenes/naval/navalFlames.js';
import { navalWireRecord } from '../../../src/systems/naval/navalWire.js';
import { NAVAL_HUD_CSS } from '../../../src/ui/naval/navalHud.js';
import { SHIP_FADE_S } from '../../../src/scenes/naval/navalHost.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('AUDIT BAY A10: THE CARD\'S STATE ON ONE LINE - cut at the card\'s edge, never wrapped: the aside card\'s "Friendly - patrolling off Copperhold Orchard" ran to a second line and stood the card twelve pixels taller under the plate (mutants: the wrap let back)', () => {
  const rule = NAVAL_HUD_CSS.slice(NAVAL_HUD_CSS.indexOf('.dfnaval-card-state {'), NAVAL_HUD_CSS.indexOf('}', NAVAL_HUD_CSS.indexOf('.dfnaval-card-state {')) + 1);
  assert.match(rule, /white-space: nowrap;/);
  assert.match(rule, /overflow: hidden;/);
  assert.match(rule, /text-overflow: ellipsis;/);
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-card \{[^}]*width: 400px;/, 'a card of its own width to cut at');
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-hud\.aside \.dfnaval-card \{[^}]*width: 300px;/);
});

/** A recording fake GL (test/render/el2_shadows.test.js's). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE_CUBE_MAP_POSITIVE_X: 100, TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('AUDIT BAY A12: A FADING SHIP\'S SHADOW FADES WITH HER - a mesh drawn or recorded under the renderer\'s dissolve carries its cut into the maps, never a cache\'s; the maps draw it with the depth program that cuts by the lit pass\'s own bayer4, its cut uploaded once a record a replay; a whole one\'s the plain depth program, nothing uploaded; before, she cast a whole shadow from a hull half gone, and on as she was gone (mutants: the cut unrecorded; the plain program for it; its cut unsent; a whole one cut)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, 0.2]);
  r.beginFrame(I, I, sun, WORLD_FRAME);
  r.textures.set('1_1', { id: 't11' });
  const mk = (id) => ({ vao: { id }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] });
  const whole = mk('vao-whole'), fading = mk('vao-fading'), off = mk('vao-off');
  r.drawMesh(whole, I, null);
  r.setDissolve(0.25);
  r.drawMesh(fading, I, null);
  r.recordShadowMesh(off, I, null);   // off screen, for the maps alone (the pool's own)
  r.setDissolve(1);
  const rec = (m) => sp.records.slice(0, sp.count).find((x) => x.mesh === m);
  assert.equal(rec(whole).cut, 0, 'whole: no cut');
  assert.equal(rec(fading).cut, 0.75, 'her share\'s cut');
  assert.equal(rec(off).cut, 0.75, 'off screen too');
  assert.ok(rec(fading).dynamic && rec(off).dynamic, 'never a cache\'s');
  const { DEPTH_CUT_FS } = SHADOW;
  assert.ok(typeof DEPTH_CUT_FS === 'string', 'the cutting depth program');
  assert.ok(DEPTH_CUT_FS.includes(DISSOLVE_GLSL) && DEPTH_CUT_FS.includes(BAYER_GLSL) && /void main\(\) \{ dissolveCut\(\); \}/.test(DEPTH_CUT_FS), 'the lit pass\'s own cut');
  calls.length = 0;
  r.beginFrame(I, I, sun, WORLD_FRAME);   // the maps drawn from those records
  const P = sp.programs;
  assert.ok(P.meshCut?.p && P.meshCut.p !== P.mesh.p, 'its own program');
  let prog = null, vao = null;
  const drawnWith = new Map(), cuts = [], plain = [];
  for (const c of calls) {
    if (c[0] === 'useProgram') prog = c[1];
    else if (c[0] === 'bindVertexArray') vao = c[1]?.id ?? null;
    else if (c[0] === 'uniform1f' && c[1] === 'uDissolveCut' && prog === P.meshCut.p) cuts.push(c[2]);
    else if (c[0] === 'uniform1f' && prog === P.mesh.p) plain.push(c);
    else if (c[0] === 'drawElements' && vao) { if (!drawnWith.has(vao)) drawnWith.set(vao, new Set()); drawnWith.get(vao).add(prog); }
  }
  const cascades = SHADOW.SHADOW_CASCADES.length;
  assert.deepEqual([...drawnWith.get('vao-fading')], [P.meshCut.p], 'hers with the cut');
  assert.deepEqual([...drawnWith.get('vao-off')], [P.meshCut.p]);
  assert.deepEqual([...drawnWith.get('vao-whole')], [P.mesh.p], 'a whole one\'s plain');
  assert.deepEqual(cuts, new Array(2 * cascades).fill(0.75), 'once a record a cascade');
  assert.deepEqual(plain, [], 'a whole one\'s: nothing uploaded');
});

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const textureFiles = new Map(), cpuModels = new Map();
  return {
    textureFiles, cpuModels,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture()); return textureFiles.get(a); },
    uploadRecord() {},
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); return { classic: id }; },
  };
}

test('AUDIT BAY A13: HER LANTERNS\' LIGHT GOES WITH HER LANTERN FLATS - under FADE_FLATS a fading ship lights nothing (the pool\'s light list) and shows no far lamp (the host\'s points of light); over it, as she was; before, a ship a tenth in the world lit the sea about her with every lantern at full (mutants: the light list unfaded; the far lamps unfaded)', async () => {
  const renderer = {
    createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
    drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (a, rr, size, c, o) => ({ a, rr, size, c, o }), destroyBillboardBatch() {}, destroyMesh() {},
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  const b = await pool.spawn(new Boat(2), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  setLights(b, true);
  pool.frame(0.5, { playerPosition: [0, 0, 0], cityLightsOn: true });
  const full = pool.lights([0, 0, 0]).length;
  assert.ok(full > 0, `her lanterns lit: ${full}`);
  b.fade = FADE_FLATS - 0.01;
  assert.equal(pool.lights([0, 0, 0]).length, 0, 'under FADE_FLATS: none');
  b.fade = FADE_FLATS;
  assert.equal(pool.lights([0, 0, 0]).length, full, 'over it: as she was');
  // the far lamps, by the real host
  const h = await sea({ hull: HULL.SmallShip, where: { cityLights: true } });
  const m = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 400, bearing: 1 }));
  h.run(SHIP_FADE_S + 0.3);
  const lamps = () => h.host.drawFrame().particles.filter((q) => q.kind === 'lamp' && Math.hypot(q.pos[0] - m.ship.pos[0], q.pos[2] - m.ship.pos[2]) < 60).length;
  assert.ok(lamps() >= 1, 'whole: her lamps');
  m.fade = FADE_FLATS - 0.01;
  assert.equal(lamps(), 0, 'under FADE_FLATS: none');
});

test('AUDIT BAY A14: HER FIRE, SMOKE, WAKE AND COLOURS GO WITH HER FLATS - under FADE_FLATS a fading ship\'s deck fires stand down (a flame is a flat), her embers, smoke and founder are not raised, her burning glow lights nothing, and her wake, splashes and flag are not drawn; over it, all again; before, a ship a twentieth in the world burned, smoked, foamed and flew her colours at full (mutants: the flames shown; the embers raised; the glow kept; the particles drawn)', async () => {
  // the real host: a peer's burning ship, fading
  const h = await sea({ hull: 2 });
  const shown = [];
  h.deps.flame = () => ({ move() {}, retire() {}, show: (on) => shown.push(on) });
  const fx = h.host._effects;
  const raised = { burn: 0, smolder: 0, founder: 0 };
  for (const k of Object.keys(raised)) { const was = fx[k].bind(fx); fx[k] = (...a) => { raised[k]++; return was(...a); }; }
  const word = navalWireRecord({ ships: [{ n: 1, classId: 'merchantGalleon', variant: 0, pos: [120, 0, 0], yaw: 0, speed: 0, sails: 0, hull: 0.3, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 77, fire: true, runOut: 0, gen: 0, region: -1 }] });
  assert.equal(h.host.applyWord('peer', word), true);
  h.run(SHIP_FADE_S + 0.5);
  const e = [...h.host._sea.values()].find((x) => x.owner === 'peer');
  assert.ok(e?.fires?.length && e.boat, 'burning, built');
  const glow = () => h.host.lights().filter((l) => Math.hypot(l.x - e.ship.pos[0], l.z - e.ship.pos[2]) < 1 && l.range > 5).length;
  assert.ok(raised.burn > 0 && raised.smolder > 0 && glow() > 0 && shown.at(-1) !== false, 'whole: she burns and smokes, her glow lit');
  for (const k of Object.keys(raised)) raised[k] = 0;
  e.retiring = true; e.fade = FADE_FLATS - 0.05;
  shown.length = 0;
  h.host.frame(0.01);
  assert.ok(shown.length > 0 && shown.every((on) => on === false), 'her flames stood down');
  assert.deepEqual(raised, { burn: 0, smolder: 0, founder: 0 }, 'no embers, smoke nor founder raised');
  assert.equal(glow(), 0, 'her glow lights nothing');
  e.retiring = false; e.fade = FADE_FLATS + 0.05;
  shown.length = 0;
  h.host.frame(0.01);
  assert.ok(shown.at(-1) === true && raised.burn > 0, 'over it: all again');
  // going down: her founder goes with her flats too
  const down = navalWireRecord({ ships: [{ n: 1, classId: 'merchantGalleon', variant: 0, pos: [120, 0, 0], yaw: 0, speed: 0, sails: 0, hull: 0, sail: 1, crew: 1, state: 'sinking', heel: 0, seed: 77, fire: true, runOut: 0, gen: 0, region: -1 }] });
  assert.equal(h.host.applyWord('peer', down), true);
  assert.equal(e.ship.damage.state, 'sinking');
  e.retiring = true; e.fade = FADE_FLATS - 0.05; raised.founder = 0;
  h.host.frame(0.01);
  assert.equal(raised.founder, 0, 'no founder under FADE_FLATS');
  e.retiring = false; e.fade = FADE_FLATS + 0.05;
  h.host.frame(0.01);
  assert.ok(raised.founder > 0, 'over it, her founder');
  // the flames' own door
  const made = [];
  const flames = createNavalFlames({ renderer: { createBillboardBatch: (...a) => { const bb = { a }; made.push(bb); return bb; }, destroyBillboardBatch() {} }, getTexture: () => ({ getFrameCount: () => 1, getSize: () => ({ width: 10, height: 10 }) }) });
  const f = flames.flame([0, 0, 0]);
  await new Promise((res) => setTimeout(res, 10));
  assert.equal(flames.batches().length, 1);
  assert.equal(typeof f.show, 'function', 'a flame stood down and up');
  f.show(false);
  assert.equal(flames.batches().length, 0, 'stood down: no batch drawn');
  f.show(true);
  assert.equal(flames.batches().length, 1, 'up again');
  // her wake, splashes and colours: world.js's particle lists, lifted
  const i = WORLD.indexOf('  function csaParticleLists() {');
  const j = WORLD.indexOf('    return lists;\n  }\n', i);
  assert.ok(i > 0 && j > i, 'the lists lifted');
  const src = WORLD.slice(i, j + '    return lists;\n  }\n'.length);
  const ps = (material, mode = 0) => ({ particleCount: 1, renderer: { m_Enabled: true, m_RenderMode: mode, m_Materials: [{ material }] }, renderList: () => [{ position: [0, 0, 0] }] });
  const boat = (fade) => ({ fade, flagColor: [1, 0, 0], particleSystems: [ps('WakeMaterial'), ps('Default-Particle'), ps('Flag', 4)] });
  const whole = boat(1), going = boat(FADE_FLATS - 0.01), coming = boat(FADE_FLATS);
  // eslint-disable-next-line no-new-func
  // PIN MOVED (SHIP-COLOURS): the host's flags in scope - none flown here, so every pennant is drawn
  const lists = new Function('naval', 'csaRuntime', 'CSA_RENDER_MODE', 'CSA_FADE_FLATS', 'shipFlags', `${src}\nreturn csaParticleLists();`)(
    { enabled: true, boats: () => [going, coming] }, { AllBoats: [whole] }, { Mesh: 4 }, FADE_FLATS, { flies: () => false });
  assert.deepEqual([lists.wake.length, lists.drops.length, lists.flags.length], [2, 2, 2], 'mine and the one over FADE_FLATS - never the one under it');
  assert.match(WORLD, /import \{ createComeSailAwayPool, CULL_DETAIL_PX, FADE_FLATS as CSA_FADE_FLATS \} from '\.\/comeSailAway\/comeSailAwayPool\.js';/);
});
