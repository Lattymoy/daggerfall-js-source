// SOLITUDE-RELIEF (bible/03-World/Arena-Provinces.md SOLITUDE-RELIEF) - SOLITUDE'S STAND-IN VIEW: its ground and its
// landmarks drawn alone, in seconds, where the game's own boot takes many minutes on SwiftShader - the relief's terrain on
// the terrain's own grid (world/solitudeRelief.js solitudeHeight at every sample, tinted by its tiles), the sea, and every
// one of Solitude's models as the game installs them (world/capitalModels.js: built, turned north, mapped at vanilla's
// texel density) in their own painted pictures (capitalArt). No game data: Daggerfall's own city blocks stand as grey
// footprints of their cells. For shaping the city; the game's own probe (tools/solitudeProbe.mjs) is what it looks like.
//
// Usage: OUT=<dir> node tools/solitudeView.mjs
//   PORT=5183   the vite port       STATIONS=a,b   the stations (tools/solitudeProbe.mjs's)
//   W=, H=      the viewport        CHROMIUM=<path> a browser other than the pinned Playwright's
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 5183),
  OUT = process.env.OUT ?? 'solitude-view';
mkdirSync(OUT, { recursive: true });
/** [label, x east, z south (the anchor's metres), eye over the sea, yaw (degrees from north, clockwise), pitch (degrees)] */
const STATIONS = [
  ['skyrim-view', 620, 760, 230, -40, -22],
  ['image-view', 560, -380, 150, -125, -16],
  ['arch-river', -95, 420, 9, -6, 9],
  ['arch-under', -60, 150, 4, -20, 22],
  ['docks-sea', 560, -330, 22, -120, -4],
  ['docks-quay', 260, -150, 4.2, 75, 6],
  ['docks-way', 100, -131.2, 34, 80, -8], // on the causeway, down it to the quay
  ['gate-road', 330, 560, 60, 0, -8],
  ['gate-front', 318.4, 470, 62, 0, -12], // the main gate from its road
  ['gate-air', 300, 455, 260, 0, -89],
  ['palace-court', 40, 0, 59.7, -90, 4],
  ['arch-deck', -90, 0, 63.7, 90, -2],
  ['castle-dour', 250, 230, 47.7, 90, 6],
  ['city-air', 200, 150, 700, 0, -89],
  ['terraces', 160, 300, 70, 0, -22],
  ['lane-stair', 318, 300, 49, 0, 4],
  ['lane-air', 250, 330, 120, 30, -45],
  ['west-bank', -380, 260, 70, 50, -8],
];
const want = process.env.STATIONS ? new Set(process.env.STATIONS.split(',')) : null;

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id="c"></canvas><script type="module">
import { buildSolitudeArch, buildBluePalace, buildSolitudeWall, buildCastleDour, buildSolitudeDocks, buildSolitudeCliffs, buildSolitudeTerraces } from '/src/world/capitalSolitude.js';
import { vanillaTexels, northward, capitalArt, CAPITAL_ART_SIZE } from '/src/world/capitalModels.js';
import { solitudeHeight, solitudeGroundTile, SOLITUDE_PIXEL, SOLITUDE_LEVELS, SOLITUDE_TILES } from '/src/world/solitudeRelief.js';
import { CAPITALS } from '/src/world/tamrielCapitals.js';
const cv = document.getElementById('c'); cv.width = innerWidth; cv.height = innerHeight;
const gl = cv.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
const VS = \`#version 300 es
in vec3 p; in vec3 n; in vec2 uv; in vec3 col; uniform mat4 vp; out vec3 vn; out vec2 vuv; out vec3 vc; out vec3 wp;
void main(){ vn = n; vuv = uv; vc = col; wp = p; gl_Position = vp * vec4(p, 1.0); }\`;
const FS = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; in vec3 vc; in vec3 wp; uniform sampler2D tex; uniform int useTex; uniform vec3 eye; uniform float alpha; out vec4 o;
void main(){ vec3 base = useTex == 1 ? texture(tex, vuv).rgb : vc; vec3 L = normalize(vec3(-0.45, 0.75, 0.5));
  float d = max(dot(normalize(vn), L), 0.0); vec3 c = base * (0.42 + 0.75 * d);
  float f = 1.0 - exp(-length(wp - eye) / 2600.0); c = mix(c, vec3(0.66, 0.72, 0.8), f * 0.85); o = vec4(c, alpha); }\`;
const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
const U = (n) => gl.getUniformLocation(prog, n);
const draws = [];
function mesh(pos, nrm, uv, col, idx, tex, alpha = 1) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  for (const [name, data, k] of [['p', pos, 3], ['n', nrm, 3], ['uv', uv, 2], ['col', col, 3]]) {
    const loc = gl.getAttribLocation(prog, name); if (loc < 0) continue;
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0);
  }
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  draws.push({ vao, n: idx.length, tex, alpha });
}
// the pictures
const art = capitalArt(), texOf = new Map();
for (const [rec, pic] of art) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  const w = pic.width ?? CAPITAL_ART_SIZE, h = pic.height ?? (pic.data.length / 4 / w);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(pic.data.buffer ?? pic.data));
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  texOf.set(rec, t);
}
// the scene's frame: x east, y up, z north (the world's), the anchor at the origin, y 0 the sea
const city = SOLITUDE_LEVELS.city;
for (const build of [buildSolitudeArch, buildBluePalace, buildSolitudeWall, buildCastleDour, buildSolitudeDocks, buildSolitudeCliffs, buildSolitudeTerraces]) {
  const m = vanillaTexels(northward(build()));
  const pos = Float32Array.from(m.positions); for (let i = 1; i < pos.length; i += 3) pos[i] += city;
  for (const sm of m.subMeshes) {
    const idx = Uint32Array.from(m.indices.subarray(sm.startIndex, sm.startIndex + sm.primitiveCount * 3));
    mesh(pos, Float32Array.from(m.normals), Float32Array.from(m.uvs), new Float32Array(pos.length), idx, texOf.get(sm.textureRecord) ?? null);
  }
}
// the ground: the terrain's own grid over the pixel and a ring of the land past it (the sea), tinted by the relief's tile
const P = SOLITUDE_PIXEL, N = 128, cell = P.side / N;
const tint = { [SOLITUDE_TILES.water]: [0.18, 0.3, 0.42], [SOLITUDE_TILES.rock]: [0.42, 0.38, 0.33], [SOLITUDE_TILES.grass]: [0.36, 0.44, 0.27], [SOLITUDE_TILES.stone]: [0.55, 0.54, 0.5] };
{
  const pos = [], nrm = [], col = [], idx = [];
  const cap = CAPITALS[1], plan = cap.plan;
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
    const ax = P.x0 + x * cell, az = P.z0 + (N - y) * cell, h = solitudeHeight(ax, az);
    pos.push(ax, h, -az);
    const hx = solitudeHeight(ax + 1, az) - solitudeHeight(ax - 1, az), hz = solitudeHeight(ax, az - 1) - solitudeHeight(ax, az + 1), l = Math.hypot(hx / 2, 1, hz / 2);
    nrm.push(-hx / 2 / l, 1 / l, -hz / 2 / l);
    const c = Math.floor((ax - P.x0) / 102.4), r = Math.floor((az - P.z0) / 102.4), kind = plan[Math.min(7, r)]?.[Math.min(7, c)] ?? 'L';
    const t = solitudeGroundTile(ax, az, kind === 'G' ? SOLITUDE_TILES.grass : SOLITUDE_TILES.stone);
    col.push(...(t === SOLITUDE_TILES.stone && !/^(L|G|P|Q|D)/.test(kind) ? [0.5, 0.47, 0.42] : tint[t]));
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = y * (N + 1) + x, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, d, a, d, b); }
  mesh(new Float32Array(pos), new Float32Array(nrm), new Float32Array(pos.length / 3 * 2), new Float32Array(col), new Uint32Array(idx), null);
  // Daggerfall's own blocks: a grey footprint box on each house's block, a few metres high - no game data
  const bp = [], bn = [], bc = [], bi = [];
  const box = (x0, z0, x1, z1, y0, y1, c3) => { const b = bp.length / 3, P8 = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const p of P8) { bp.push(p[0], p[1], -p[2]); bn.push(0, 1, 0); bc.push(...c3); }
    for (const f of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]) bi.push(b + f[0], b + f[1], b + f[2], b + f[0], b + f[2], b + f[3]); };
  plan.forEach((row, r) => row.forEach((kind, c) => {
    if (/^(L|G|P|Q|D)/.test(kind)) return;
    const x0 = P.x0 + c * 102.4, z0 = P.z0 + r * 102.4, h0 = solitudeHeight(x0 + 51.2, z0 + 51.2);   // the block's own tier
    for (let i = 0; i < 9; i++) { const u = (i % 3) * 32 + 8, v = Math.floor(i / 3) * 32 + 8, hh = 8 + ((r * 7 + c * 3 + i * 5) % 9); box(x0 + u, z0 + v, x0 + u + 20, z0 + v + 18, h0, h0 + hh, [0.62, 0.58, 0.52]); }
  }));
  mesh(new Float32Array(bp), new Float32Array(bn), new Float32Array(bp.length / 3 * 2), new Float32Array(bc), new Uint32Array(bi), null);
  // the sea: a sheet at the water's height reaching well past the pixel
  const S = 6000;
  mesh(new Float32Array([-S, 0.05, -S, S, 0.05, -S, S, 0.05, S, -S, 0.05, S]), new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), new Float32Array(8), new Float32Array([0.16, 0.27, 0.36, 0.16, 0.27, 0.36, 0.16, 0.27, 0.36, 0.16, 0.27, 0.36]), new Uint32Array([0, 1, 2, 0, 2, 3]), null, 0.82);
}
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]; };
const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
window.__draw = (x, y, z, yaw, pitch) => {
  // the camera's forward (sin yaw, cos yaw) east and north, the game's own; Daggerfall's frame is left-handed (x east, z
  // north), so its right is +x looking north and its up forward x right
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], e = [x, y, z];
  const rl = Math.hypot(f[2], f[0]) || 1, r = [f[2] / rl, 0, -f[0] / rl];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const view = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1];
  const vp = mul(persp(1.15, cv.width / cv.height, 0.5, 9000), view);
  gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0.66, 0.72, 0.8, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  gl.uniformMatrix4fv(U('vp'), false, new Float32Array(vp)); gl.uniform3f(U('eye'), e[0], e[1], e[2]);
  for (const d of draws) {
    if (d.alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
    gl.uniform1f(U('alpha'), d.alpha); gl.uniform1i(U('useTex'), d.tex ? 1 : 0); if (d.tex) gl.bindTexture(gl.TEXTURE_2D, d.tex);
    gl.bindVertexArray(d.vao); gl.drawElements(gl.TRIANGLES, d.n, gl.UNSIGNED_INT, 0);
  }
  gl.finish(); return true;
};
window.__ready = true;
</script></body></html>`;

const server = await createServer({
  root: process.cwd(),
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
  plugins: [
    {
      name: 'solitude-view',
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url === '/__solitude.html') {
            res.setHeader('content-type', 'text/html');
            res.end(PAGE);
          } else next();
        });
      },
    },
  ],
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) },
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`http://localhost:${PORT}/__solitude.html`);
await page.waitForFunction(() => window.__ready === true || false, null, { timeout: 300000 }).catch(() => null);
if (errors.length) console.log(errors.join('\n'));
const deg = (d) => (d * Math.PI) / 180;
for (const [label, x, z, h, yaw, pitch] of STATIONS) {
  if (want && !want.has(label)) continue;
  await page.evaluate(([x, y, z, yaw, pitch]) => window.__draw(x, y, z, yaw, pitch), [x, h, -z, deg(yaw), deg(pitch)]);
  await page.screenshot({ path: `${OUT}/${label}.png` });
  console.log(`${label}`);
}
await browser.close();
await server.close();
