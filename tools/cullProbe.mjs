// Repro probe for the sky-blue-screen bug: does the port's own 2D
// screen-quad pass survive the renderer's global GL state? Boots the
// real app data-less, then draws one solid red quad through
// renderer.drawScreenQuad and reads the pixels back.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5211, strictPort: true }, root: '/home/user/project-dagger' });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5211/?nomenu&novideo');
await page.waitForTimeout(4000);

const result = await page.evaluate(async () => {
  const { Renderer } = await import('/src/render/renderer.js');
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const r = new Renderer(canvas);
  const gl = r.gl;
  gl.viewport(0, 0, 64, 64);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // one solid red quad over the whole canvas, the UI pass's own door
  r.drawScreenQuad(null, { x: 0, y: 0, w: 64, h: 64 }, { u0: 0, v0: 0, u1: 1, v1: 1 }, [1, 0, 0, 1]);
  const px = new Uint8Array(4);
  gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const skyOk = (() => {
    // the sky pass's fullscreen triangle under the same state: emulate
    // with a raw draw using the current frontFace + CULL_FACE
    return { frontFace: gl.getParameter(gl.FRONT_FACE), cullEnabled: gl.getParameter(gl.CULL_FACE) };
  })();
  return { centerPixel: [...px], state: skyOk, CW: gl.CW, CCW: gl.CCW };
});
console.log(JSON.stringify(result));
console.log(result.centerPixel[0] > 200 ? 'QUAD DREW (pass survives)' : 'QUAD CULLED (the bug)');
await browser.close();
await server.close();
process.exit(0);
