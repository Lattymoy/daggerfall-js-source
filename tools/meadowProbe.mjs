// MEADOW1 (2026-10-06): THE MEADOW, PHOTOGRAPHED ON A REAL GPU.
//
//     node tools/meadowProbe.mjs            shots in tools/shots/meadow-*.png
//
// The grass pins run on a fake GL that compiles anything and draws nothing,
// and this container has no ARENA2, so the exterior cannot be booted here.
// What can be driven is what MEADOW1 changes: `LabGrassRenderer` and
// `createGrassField` over a SYNTHETIC ground - a plane where every point is
// grass, in the default skin's temperate grass base (the colour the owner's
// sprites are moved onto), with a faint mottle so the eye has a ground to read -
// on SwiftShader's WebGL2, as tools/grassFieldProbe.mjs drives the lab's
// field. It photographs the meadow from a walker's eye, close up, from
// above (where the patches show) and under a low sun (where the cards'
// facets show), beside the pixel style from the same eye; and it counts
// what each frame submits, so the meadow's cost is a number and not a
// guess. SwiftShader's milliseconds are not a player's and are never
// reported; the counts are exact.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const W = 960, H = 540;
const server = await createServer({ server: { port: 5299, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400)); });
  await page.goto('http://localhost:5299/play/');
  const out = await page.evaluate(async ({ W, H }) => {
    const { LabGrassRenderer, createGrassField, LAB_GRASS } = await import('/src/render/labGrass.js');
    const { perspective, lookAt } = await import('/src/world/mat4.js');
    const { EL_CODEC_GLSL, EL_TONEMAP_GLSL, EL_EXPOSURE, elDecode3, elDecodeN } = await import('/src/render/enhancedLighting.js');
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    document.body.append(canvas);
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return { error: 'no webgl2' };
    // the ground: one big quad at y = 0 in the temperate grass base's mean under Vanilla Enhanced (public/art/vanilla-
    // enhanced/base/302_2-0.png, measured: 49.3, 72.8, 39.1 - the default skin's lawn), mottled a little, lit as the
    // classic lane lights a tile - or, under the lane, through its own decode, exposure, curve and encode
    const GROUND = [49.3 / 255, 72.8 / 255, 39.1 / 255];
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const gp = gl.createProgram();
    gl.attachShader(gp, sh(gl.VERTEX_SHADER, `#version 300 es
in vec2 aP; uniform mat4 uVP; out vec2 vP;
void main(){ vP = aP; gl_Position = uVP * vec4(aP.x, 0.0, aP.y, 1.0); }`));
    gl.attachShader(gp, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; in vec2 vP; uniform vec3 uG, uAmb, uSunCol, uSunDir; uniform float uSunScale, uLane; out vec4 o;
${EL_CODEC_GLSL}
${EL_TONEMAP_GLSL}
float h(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  float m = 0.88 + 0.16 * n(floor(vP * 6.4) / 6.4 * 1.3) + 0.08 * n(vP * 0.15);
  vec3 light = uAmb + uSunCol * uSunScale * max(normalize(uSunDir).y, 0.0);
  vec3 c = uLane > 0.5 ? elEncode(elTonemapRGB(elDecode(uG * m) * light * ${EL_EXPOSURE.toFixed(3)})) : uG * m * light;
  o = vec4(c, 1.0);
}`));
    gl.linkProgram(gp);
    const gq = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gq);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-600, -600, 600, -600, 600, 600, -600, -600, 600, 600, -600, 600]), gl.STATIC_DRAW);
    const gvao = gl.createVertexArray(); gl.bindVertexArray(gvao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const grass = new LabGrassRenderer(gl);
    const keep = () => 0;
    const ground = () => GROUND;
    const field = createGrassField(grass, { keep, ground, perFrame: 1e9 });
    field.update(0, 0, keep, ground);
    const noon = { sunDir: [0.3, 0.8, 0.5], amb: [0.42, 0.44, 0.45], sunCol: [1, 0.97, 0.9], dim: 1, sunScale: 0.85 };
    const dusk = { sunDir: [0.95, 0.22, 0.2], amb: [0.30, 0.27, 0.30], sunCol: [1, 0.72, 0.45], dim: 1, sunScale: 0.9 };
    const wind = { dir: [1, 0], speed: 70, windV: [0.01, 0] };
    const vpOf = (proj, view) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3]; return o; };
    const LANE = { decode3: elDecode3, decodeN: elDecodeN };   // the lane as the renderer hands it (renderer.lightingLane)
    const shot = (name, eye, target, style, lit = noon, fov = Math.PI / 3, sky = [0.52, 0.66, 0.86]) => {
      field.update(eye[0], eye[2], keep, ground);
      const proj = perspective(fov, W / H, 0.05, 4000);
      const view = lookAt(eye, target, [0, 1, 0]);
      gl.viewport(0, 0, W, H);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(gp);
      gl.uniformMatrix4fv(gl.getUniformLocation(gp, 'uVP'), false, vpOf(proj, view));
      gl.uniform3fv(gl.getUniformLocation(gp, 'uG'), GROUND);
      gl.uniform3fv(gl.getUniformLocation(gp, 'uAmb'), lit.lane ? elDecode3(lit.amb, new Float32Array(3)) : lit.amb);
      gl.uniform3fv(gl.getUniformLocation(gp, 'uSunCol'), lit.lane ? elDecode3(lit.sunCol, new Float32Array(3)) : lit.sunCol);
      gl.uniform1f(gl.getUniformLocation(gp, 'uLane'), lit.lane ? 1 : 0);
      gl.uniform3fv(gl.getUniformLocation(gp, 'uSunDir'), lit.sunDir);
      gl.uniform1f(gl.getUniformLocation(gp, 'uSunScale'), lit.sunScale);
      gl.bindVertexArray(gvao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null);
      grass.draw(proj, view, new Float32Array(eye), 2.0, lit, wind, LAB_GRASS.range, style);
      gl.finish();
      const err = gl.getError();
      return { name, style, err, drawn: { ...grass.drawn }, png: canvas.toDataURL('image/png') };
    };
    const shots = [
      shot('eye', [0, 1.7, 0], [0, 1.1, -12], 'meadow'),
      shot('eye-pixel', [0, 1.7, 0], [0, 1.1, -12], 'pixel'),
      shot('close', [0.4, 0.9, 2.0], [0.0, 0.35, -1.5], 'meadow', noon, Math.PI / 3.2),
      shot('high', [0, 14, 30], [0, 0, -30], 'meadow'),
      shot('dusk', [0, 1.7, 0], [-6, 1.0, -10], 'meadow', dusk, Math.PI / 3, [0.80, 0.58, 0.45]),
      shot('horizon', [0, 1.7, 0], [0, 1.6, -100], 'meadow'),
      shot('lane', [0, 1.7, 0], [0, 1.1, -12], 'meadow', { ...noon, lane: LANE }),
      shot('lane-pixel', [0, 1.7, 0], [0, 1.1, -12], 'pixel', { ...noon, lane: LANE }),
    ];
    return { shots, perCell: grass.perCell, cells: field.live.size, vertsCards: grass.vertsCards, vertsCardsFar: grass.vertsCardsFar, vertsFar: grass.vertsFar, verts: grass.verts };
  }, { W, H });
  if (out.error) throw new Error(out.error);
  mkdirSync('tools/shots', { recursive: true });
  for (const s of out.shots) {
    writeFileSync(`tools/shots/meadow-${s.name}.png`, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`${s.name.padEnd(10)} ${s.style.padEnd(7)} gl error ${s.err}  slots ${s.drawn.slots}  instances ${s.drawn.blades}  verts ${(s.drawn.verts / 1e6).toFixed(2)}M  (card slots ${s.drawn.cardSlots ?? 0}, on two cards ${s.drawn.cardsFarSlots ?? 0})`);
  }
  console.log(`cells ${out.cells}, ${out.perCell} blades a cell; ${out.vertsCards} verts a near meadow tuft, ${out.vertsCardsFar} a far one, ${out.vertsFar} a pixel tuft, ${out.verts} a near smooth blade`);
  if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); process.exitCode = 1; }
} finally {
  await browser.close();
  await server.close();
}
