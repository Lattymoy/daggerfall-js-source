// MAC-BUG4 IN A REAL GL CONTEXT: is a blood splash black because of the
// RENDERER, or because of the texture it is handed?
//
// Mac, 2026-09-20: "Also blood is black."
//
// The splash is TEXTURE.380 through scenes/hitEffects.js - a one-shot
// animated billboard - and this container has no ARENA2, so the real
// archive cannot be decoded here. What CAN be settled is the half that
// does not need it: hand the port's OWN billboard path a texture whose
// colour is known, under the lighting a dungeon actually sets, and read
// the pixel back. Red in, red out means the plumbing is sound and the
// fault is in what the texture decodes to. Red in, BLACK out means the
// fault is here.
//
//     npx vite --port 5199 &
//     node tools/bloodProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// THE MODULE GRAPH IS ALL THIS NEEDS. The menu cannot come up in this
// container (no ARENA2), and it does not have to: the renderer and the
// effect pool are plain modules, and the page is only here to be an
// ORIGIN the dev server will serve them from with a real WebGL2 context
// behind it.
await page.goto(`${BASE}/gun-proto.html`, { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async () => {
  const { Renderer } = await import('/src/render/renderer.js');
  const { createHitEffects, BLOOD_ARCHIVE } = await import('/src/scenes/hitEffects.js');
  const { DUNGEON_AMBIENT } = await import('/src/world/dungeonLights.js');

  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  document.body.append(canvas);
  const r = new Renderer(canvas);

  // A KNOWN TEXTURE: 8x8 of Daggerfall's own blood red, fully opaque.
  const W = 8, H = 8;
  const colors = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { colors[i * 4] = 168; colors[i * 4 + 1] = 16; colors[i * 4 + 2] = 16; colors[i * 4 + 3] = 255; }
  const red = { colors, width: W, height: H };

  // The pool's own door, driven exactly as a host drives it - so the
  // key the batch asks for is the key the pool uploads under, which is
  // half of what this probe is for.
  const uploaded = [];
  const fx = createHitEffects({
    renderer: r,
    getTexture: async () => ({ recordCount: 8, getFrameCount: () => 1, getSize: () => ({ width: W, height: H }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: (archive, record, frame) => {
      uploaded.push(`${archive}_${record}#${frame}`);
      r.uploadTexture(archive, `${record}#${frame}`, red);
    },
  });

  const shot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);   // a BLUE page: anything red or black came from the draw
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawBillboards(fx.batches(), [1, 0, 0], [0, 1, 0]);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };

  fx.showBloodSplash(0, [0, 0, 0]);
  await new Promise((res) => setTimeout(res, 50));   // the pool warms its archive async

  const frames = [];
  frames.push(shot('clockless (no setLighting - full bright)', () => {}));
  frames.push(shot('EXTERIOR noon', () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9])));
  const dungeon = () => r.setLighting([...(DUNGEON_AMBIENT ?? [0.12, 0.12, 0.12])], 0, [0, 0, 0]);
  frames.push(shot('DUNGEON ambient, no lights', dungeon));
  // ...and the same splash with a TORCH on it: the player's own light is
  // a point light like any other, and this is what says whether the
  // darkness above is the scene's or the splash's.
  frames.push(shot('DUNGEON ambient + a torch at the splash', dungeon, new Float32Array([0, 0, 0, 14])));
  // A FOE STANDS IN THE SAME PASS. If a splash is black where a sprite
  // beside it is not, the difference is not the lighting - so the
  // comparison is made rather than assumed.
  r.uploadTexture(199, '8#0', { colors: (() => { const c = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { c[i * 4] = 168; c[i * 4 + 1] = 16; c[i * 4 + 2] = 16; c[i * 4 + 3] = 255; } return c; })(), width: W, height: H });
  const foe = r.createBillboardBatch(199, 8, { w: 2, h: 2 }, [[0, 0, 0]]);
  foe.frame = 0;
  const foeShot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawBillboards([foe], [1, 0, 0], [0, 1, 0]);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };
  frames.push(foeShot('a SPRITE (not the pool) in the same dungeon', dungeon));

  // ── THE DECAL PASS (BLOOD1a) ────────────────────────────────────
  // The mark on the floor and the gib in the air above it are the same
  // blood from the same blow, and they go through DIFFERENT passes:
  // bloodMarks.draw calls drawDecals for the marks and drawBillboards
  // for the chunks. This reads the mark's pixel in the same light the
  // rows above read a sprite's.
  const { createDecalBatch: _mk } = r;
  const decalTex = r.uploadTexture(777, 'mark', red);
  const batch = r.createDecalBatch(1);
  {
    const quad = new Float32Array(4 * 9);
    const corner = (i, x, y) => {
      const o = i * 9;
      quad[o] = x; quad[o + 1] = y; quad[o + 2] = 0;
      quad[o + 3] = i === 0 || i === 1 ? 0 : 1; quad[o + 4] = i === 0 || i === 3 ? 0 : 1;
      quad[o + 5] = 1; quad[o + 6] = 1; quad[o + 7] = 1; quad[o + 8] = 1;
    };
    corner(0, -1, -1); corner(1, -1, 1); corner(2, 1, 1); corner(3, 1, -1);
    r.writeDecalSlot(batch, 0, quad);
  }
  const decalShot = (label, setup, lights = null) => {
    setup();
    r.setPointLights(lights ?? new Float32Array(0), [1, 1, 1], null);
    const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
    r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawDecals(batch, decalTex);
    const px = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { label, px: [...px] };
  };
  frames.push(decalShot('DECAL: dungeon ambient, no lights', dungeon));
  frames.push(decalShot('DECAL: dungeon ambient + a torch on it', dungeon, new Float32Array([0, 0, 0, 14])));
  frames.push(decalShot('DECAL: exterior noon', () => r.setLighting([0.55, 0.55, 0.55], 1, [1, 0.96, 0.9])));

  return {
    archive: BLOOD_ARCHIVE,
    uploaded,
    batches: fx.batches().length,
    textureKeys: [...r.textures.keys()].filter((k) => String(k).startsWith('380')),
    frames,
  };
});

console.log('archive           ', out.archive);
console.log('uploaded keys     ', out.uploaded);
console.log('renderer tex keys ', out.textureKeys);
console.log('live batches      ', out.batches);
for (const f of out.frames) console.log(`  ${f.label.padEnd(38)} -> rgba ${f.px.join(',')}`);

check('the pool uploaded a texture for the splash', out.uploaded.length > 0, out.uploaded.join(' '));
check('the key the pool uploads is the key the billboard pass asks for',
  out.textureKeys.includes('380_0#0'), out.textureKeys.join(' '));
check('a batch reached the draw', out.batches === 1, String(out.batches));
const lit = out.frames[0]?.px ?? [];
check('full-bright: a RED texture comes back RED, not black',
  lit[0] > 100 && lit[0] > lit[2], `rgba ${lit.join(',')}`);
const noon = out.frames[1]?.px ?? [];
check('exterior noon: still red', noon[0] > 60 && noon[0] > noon[2], `rgba ${noon.join(',')}`);
const dark = out.frames[2]?.px ?? [];
const torch = out.frames[3]?.px ?? [];
const sprite = out.frames[4]?.px ?? [];
check('dungeon ambient with NO light: a splash is ambient x albedo, which reads BLACK',
  dark[0] < 40, `rgba ${dark.join(',')}`);
check('...and a TORCH on it brings it back', torch[0] > dark[0] * 3, `rgba ${torch.join(',')}`);
check('A SPRITE IN THE SAME LIGHT IS EXACTLY AS DARK - the pool is not the difference',
  Math.abs(sprite[0] - dark[0]) <= 1, `splash ${dark.join(',')} vs sprite ${sprite.join(',')}`);
// MAC-BUG W4: the mark and the chunk are the same blood from the same
// blow, through two passes. They have to agree about the light.
const dDark = out.frames[5]?.px ?? [];
const dTorch = out.frames[6]?.px ?? [];
const dNoon = out.frames[7]?.px ?? [];
check('DECAL in a dark dungeon is as dark as the sprite beside it - no darker',
  Math.abs(dDark[0] - dark[0]) <= 2, `decal ${dDark.join(',')} vs sprite ${dark.join(',')}`);
check('A TORCH LIGHTS THE MARK, as it lights the chunk above it',
  Math.abs(dTorch[0] - torch[0]) <= 2, `decal ${dTorch.join(',')} vs sprite ${torch.join(',')}`);
check('and at noon the mark takes the SUN, not the ambient alone',
  Math.abs(dNoon[0] - noon[0]) <= 2, `decal ${dNoon.join(',')} vs sprite ${noon.join(',')}`);
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
