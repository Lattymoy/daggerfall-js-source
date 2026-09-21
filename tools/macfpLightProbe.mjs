// MAC-I IN A REAL GL CONTEXT: the tint exists, it is the light, and it
// actually multiplies the sprite.
//
// The tint reaches the screen through one channel - drawScreenQuad's
// `color` - and a source sweep cannot say whether that channel does
// anything. This one makes a real Renderer on a real canvas, lights the
// scene the way a host does, asks `flatLightAt` what a flat at the
// camera would take, draws a WHITE texel under that tint and reads the
// pixel back.
//
//     npx vite --port 5199 &
//     node tools/macfpLightProbe.mjs
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
await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const { Renderer, FLAT_LIGHT_FLOOR } = await import('/src/render/renderer.js');
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  document.body.append(canvas);
  const r = new Renderer(canvas);
  const white = { width: 1, height: 1, colors: new Uint8Array([255, 255, 255, 255]) };
  const tex = r.uploadTexture('probe', 'white', white);

  const read = () => {
    const gl = r.gl;
    const px = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...px];
  };
  const drawWith = (tint) => {
    const gl = r.gl;
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawScreenQuad(tex, { x: 0, y: 0, w: 64, h: 64 }, undefined, tint);
    return read();
  };

  const res = { floor: FLAT_LIGHT_FLOOR };
  // 1. a clockless scene answers white, as its flats draw white
  res.clockless = r.flatLightAt([0, 0, 0]);
  // 2. daylight: the ambient plus the sun's Lambert-average half
  r.setLighting([0.4, 0.4, 0.4], 1, [0.6, 0.6, 0.6]);
  r.setPointLights(new Float32Array(0), [1, 1, 1], null);
  res.day = r.flatLightAt([0, 0, 0]);
  // 3. a dark room: the floor is what stops a sprite going to nothing
  r.setLighting([0.02, 0.02, 0.02], 0, [0, 0, 0]);
  res.dark = r.flatLightAt([0, 0, 0]);
  // 4. a torch two units away, and the same torch far off
  r.setPointLights(new Float32Array([0, 0, 2, 8]), [1, 1, 1], new Float32Array([1, 0.6, 0.2]));
  res.nearTorch = r.flatLightAt([0, 0, 0]);
  res.farFromTorch = r.flatLightAt([0, 0, 40]);
  // 5. and the channel really multiplies the sprite
  res.pixelWhite = drawWith([1, 1, 1, 1]);
  res.pixelQuarter = drawWith([0.25, 0.25, 0.25, 1]);
  res.pixelTorch = drawWith([...r.flatLightAt([0, 0, 0]), 1]);

  // ---- MAC-P: the Morrowind arm's own pass -------------------------
  //
  // A white, untextured quad facing the camera, packed the way
  // packFpArm packs an arm (14 floats: pos, diffuse, normal, uv,
  // emission), rendered through the SAME call fpArm makes - once with
  // the room at full light and once with it nearly dark. If the
  // viewmodel light does nothing, the two come back identical, which is
  // precisely the "consistently dark" that was reported.
  const V = [];
  const vert = (x, y) => V.push(x, y, 0, /* diffuse */1, 1, 1, /* normal */0, 0, 1, /* uv */0, 0, /* emission */0, 0, 0);
  vert(-1, -1); vert(1, -1); vert(1, 1);
  vert(-1, -1); vert(1, 1); vert(-1, 1);
  const mesh = r.createCharacterMesh(new Float32Array(V), { uv: true });
  mesh.ranges = [{ first: 0, count: 6, tex: null, hidden: false }];
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1];
  const proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.02, -1, 0, 0, -0.2, 0];
  // beginFrame is the only producer of `_lightDir` and this probe runs no
  // world pass, so the sun's direction is set by hand - the studio overrides
  // it anyway whenever a viewmodel light is handed in.
  r._lightDir = new Float32Array([0, 1, 0]);
  const armPixel = (light) => {
    const tex = r.renderCharacterSprite(mesh, I, proj, view, 32, 32, { lensLocal: true, viewmodelLight: light });
    const gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 64, 64);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    r.drawScreenQuad(tex, { x: 0, y: 0, w: 64, h: 64 }, { u0: 0, v0: 32 / 1024, u1: 32 / 1024, v1: 0 });
    return read();
  };
  r.setLighting([0.02, 0.02, 0.02], 0, [0, 0, 0]);   // a black room
  r.setPointLights(new Float32Array(0), [1, 1, 1], null);
  res.armNoLight = armPixel(null);              // the switch off: the studio, as it was
  res.armDark = armPixel(r.flatLightAt([0, 0, 0]));
  r.setLighting([0.9, 0.9, 0.9], 1, [1, 1, 1]);   // noon
  res.armBright = armPixel(r.flatLightAt([0, 0, 0]));
  // and the borrow is RETURNED - the frame's own light survives the pass
  res.lightAfter = [...r._ambient];
  return res;
});

const near = (a, b, eps = 0.001) => Math.abs(a - b) <= eps;
check('MAC-I: a clockless scene is white, as its flats are', out.clockless.every((v) => v === 1), JSON.stringify(out.clockless));
check('MAC-I: daylight is the ambient plus the sun’s half', out.day.every((v) => near(v, 0.7)), JSON.stringify(out.day));
check('MAC-I: a black room lands on the floor, not on nothing', out.dark.every((v) => near(v, out.floor)), `${JSON.stringify(out.dark)} floor ${out.floor}`);
check('MAC-I: a torch two units off is warm and bright', out.nearTorch[0] > out.nearTorch[2] && out.nearTorch[0] > 0.5, JSON.stringify(out.nearTorch));
check('MAC-I: the same torch forty units off reaches nothing', out.farFromTorch.every((v) => near(v, out.floor)), JSON.stringify(out.farFromTorch));
check('MAC-I: white tint leaves the sprite alone', out.pixelWhite[0] === 255 && out.pixelWhite[1] === 255, JSON.stringify(out.pixelWhite));
check('MAC-I: a quarter tint really is a quarter on screen', Math.abs(out.pixelQuarter[0] - 64) <= 2, JSON.stringify(out.pixelQuarter));
check('MAC-I: the torch’s own light reaches the sprite as colour', out.pixelTorch[0] > out.pixelTorch[2], JSON.stringify(out.pixelTorch));
// THE DEFECT, MEASURED. With no viewmodel light the pass takes the FRAME's
// light on geometry that sits at the origin of a camera-local space: a black
// room's ambient and nothing else, because every point light in it is a room
// away in world space. Five of 255 is Mac's "consistently dark".
check('MAC-P: the old path is nearly black in a dark room', out.armNoLight[0] < 16, `${out.armNoLight[0]}/255`);
check('MAC-P: the room\u2019s light makes the arm readable without making it bright', out.armDark[0] > 40 && out.armDark[0] < 160, `${out.armDark[0]}/255 on the floor`);
check('MAC-P: and noon is a lit arm', out.armBright[0] > out.armDark[0] * 2, `${out.armBright[0]} vs ${out.armDark[0]}`);
check('MAC-P: the frame\u2019s own light survives the borrow', Math.abs(out.lightAfter[0] - 0.9) < 1e-6, JSON.stringify(out.lightAfter));
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} ok`);
process.exit(bad.length ? 1 : 0);
