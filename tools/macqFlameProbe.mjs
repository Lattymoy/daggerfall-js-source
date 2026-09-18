// MAC-Q IN A REAL GL CONTEXT: a particle system becomes pixels.
//
// This container has no Morrowind data, so the torch's own file cannot be
// drawn here. What CAN be proved is everything between a NIF and the
// screen: a hand-built file with one particle geometry, an active
// controller, a grow/fade and a colour modifier goes through the flattener's
// sink, the descriptor, the simulation, the quad stream, the renderer's
// particle program and the character pass's own effect draw - and a pixel
// where the flame stands comes back lit in the flame's colour, while a pixel
// beside it does not, and a HIDDEN effect draws nothing at all.
//
//     npx vite --port 5199 &
//     node tools/macqFlameProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const { Renderer } = await import('/src/render/renderer.js');
  const P = await import('/src/formats/mwParticles.js');
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  document.body.append(canvas);
  const r = new Renderer(canvas);
  r._lightDir = new Float32Array([0, 1, 0]);
  r.setLighting([0.05, 0.05, 0.05], 0, [0, 0, 0]);   // a dark room - a flame is its own light
  r.setPointLights(new Float32Array(0), [1, 1, 1], null);

  // THE FILE: a NiBSParticleNode (AutoPlay | LocalSpace) over one
  // NiAutoNormalParticles whose controller emits straight up (+Z in the
  // file) at speed 0 - the particles stay where they are born - with 16
  // slots, a colour ramp from orange to dark red, and additive blending.
  const I3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const node = (o = {}) => ({ type: 'NiNode', name: '', flags: 0, translation: [0, 0, 0], rotation: I3, scale: 1, properties: [], children: [], effects: [], controller: -1, ...o });
  const slots = Array.from({ length: 16 }, () => ({ velocity: [0, 0, 0], rotationAxis: [0, 0, 0], age: 0, lifeSpan: 0, lastUpdate: 0, spawnGeneration: 0, code: 0 }));
  const nif = { roots: [0], records: [
    node({ name: 'Root', children: [1] }),
    { ...node({ name: 'Fire', flags: 0x20 | 0x80, children: [2] }), type: 'NiBSParticleNode' },
    { ...node({ name: 'Flame', properties: [5, 6] }), type: 'NiAutoNormalParticles', data: 3, skin: -1, controller: 4 },
    { type: 'NiAutoNormalParticlesData', numVertices: 16, vertices: new Float32Array(48), normals: null, colors: null, uvSets: [], numParticles: 16, particleRadius: 1, numActive: 0, sizes: null },
    { type: 'NiParticleSystemController', next: -1, flags: 0x8, frequency: 1, phase: 0, startTime: 0, stopTime: 1e9, target: 2,
      speed: 0, speedVariation: 0, declination: 0, declinationVariation: 0, planarAngle: 0, planarAngleVariation: 0,
      initialNormal: [0, 0, 1], initialColor: [1, 0.55, 0.1, 1], initialSize: 0.6, emitStartTime: 0, emitStopTime: 1e9, resetParticleSystem: 0,
      birthRate: 0, lifetime: 1, lifetimeVariation: 0, useBirthRate: 0, spawnOnDeath: 0, emitterDimensions: [0, 0, 0], emitter: 1,
      numSpawnGenerations: 0, percentageSpawned: 0, spawnMultiplier: 0, spawnSpeedChaos: 0, spawnDirChaos: 0, numValid: 0, particles: slots,
      emitterModifier: -1, particleModifier: 7, particleCollider: -1, staticTargetBound: 0 },
    { type: 'NiAlphaProperty', name: '', flags: 1 | (6 << 1) | (0 << 5), threshold: 0 },   // blend on, SRC_ALPHA, ONE
    { type: 'NiVertexColorProperty', name: '', flags: 0, vertexMode: 1, lightingMode: 0 },
    { type: 'NiParticleGrowFade', next: -1, controller: 4, grow: 0.05, fade: 0.3 },
  ] };
  const [desc] = P.particleSystemsOf(nif);
  const sim = P.createParticleSystem(desc, { rolls: () => 0.5 });
  let t = 0;
  for (let i = 0; i < 20; i++) { sim.update(1 / 60, t); t += 1 / 60; }
  const quads = sim.quads();
  const packed = P.packParticleQuads(quads);

  // a black body (a dark quad far behind the flame) so the flame is the
  // only light in the frame, and the read-back is unambiguous
  const V = [];
  const vert = (x, y) => V.push(x, y, -0.5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
  vert(-2, -2); vert(2, -2); vert(2, 2); vert(-2, -2); vert(2, 2); vert(-2, 2);
  const mesh = r.createCharacterMesh(new Float32Array(V), { uv: true });
  mesh.ranges = [{ first: 0, count: 6, tex: null, hidden: false }];
  const effect = r.createParticleEffect(sim.quota, P.particleDrawState(desc.material));
  r.updateParticleEffect(effect, packed.packed, packed.count);
  mesh.effects = [effect];

  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
  const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
  const read = (x, y) => { const px = new Uint8Array(4); r.gl.readPixels(x, y, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, px); return [...px]; };
  const frame = () => {
    const tex = r.renderCharacterSprite(mesh, I, proj, view, 64, 64, { lensLocal: true });
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawScreenQuad(tex, { x: 0, y: 0, w: 128, h: 128 }, { u0: 0, v0: 64 / 1024, u1: 64 / 1024, v1: 0 });
    return { centre: read(64, 64), corner: read(4, 4) };
  };
  const lit = frame();
  effect.hidden = true;
  const hidden = frame();
  effect.hidden = false;
  return { live: quads.length, quota: sim.quota, rate: sim.rate, size: quads[0]?.size, lit, hidden, packedCount: packed.count };
});

check('MAC-Q: the file emits - 16 slots over a one-second life is sixteen a second', out.rate === 16, `rate ${out.rate}`);
check('MAC-Q: a third of a second in, particles are alive', out.live > 0 && out.live <= out.quota, `${out.live} of ${out.quota}`);
check('MAC-Q: grow/fade has the newest one still growing', out.size !== undefined && out.size > 0, `size ${out.size}`);
check('MAC-Q: the flame is LIT where it stands', out.lit.centre[0] > 100 && out.lit.centre[0] > out.lit.centre[2] * 2, JSON.stringify(out.lit.centre));
check('MAC-Q: and the room beside it is dark', out.lit.corner[0] < 30, JSON.stringify(out.lit.corner));
check('MAC-Q: a hidden effect draws nothing', out.hidden.centre[0] < 30, JSON.stringify(out.hidden.centre));
check('no page errors', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: `${shots}/macq-flame.png` });
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} ok`);
process.exit(bad.length ? 1 : 0);
