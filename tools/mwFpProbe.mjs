// MW-IMPORT SLICE 5 LIVE PROOF, two halves.
//
// ALWAYS RUNS - the view itself: fixture.bsa goes into the morrowind
// store through the production storeMorrowindFiles, createMwFpView is
// constructed IN THE REAL PAGE against a real WebGL2 context and a
// drawScreenQuad spy, driven with fixed timesteps through the forced
// Move group, and the proof is read out of the GL: the stream texture
// the layer uploads is attached to a framebuffer and its pixels
// counted - non-empty, and DIFFERENT at two times, so the rig draws
// and the rig moves.
//
// ARENA2_PATH-GATED - the game: the dungeon cannot boot without the
// player's ARENA2 (ensureData is the front door), so the full in-game
// flow (boot, Z to draw, FP region pixels, the no-flag control run)
// runs only where that data lives. Same gate philosophy as every
// retail suite.
//
// Usage: node tools/mwFpProbe.mjs                    (view half)
//        ARENA2_PATH=... node tools/mwFpProbe.mjs    (both halves)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { existsSync, writeFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5221, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => {
  console.log(`${cond ? 'ok ' : 'FAIL'} ${label}`);
  if (!cond) fails.push(label);
};

// --- HALF 1: the view, driven directly in the real page -------------------
// No `nomenu` here on purpose: this load must NOT boot the dungeon (no
// ARENA2 in a bare checkout) - it only carries the mwfp params for the
// view to read, and the menu page serves the modules fine.
const viewQuery =
  'mwfp=1&mwfpbase=meshes/fixture/animated.nif&mwfpgroup=Move' +
  '&mwfpweapon=meshes/fixture/part.nif&mwfpwbone=Bone1&mwfpcam=0.5,-3.5,0.9,0.9';
await page.goto(`http://localhost:5221/play/?${viewQuery}`);
await page.evaluate(async () => {
  const ds = await import('/src/scenes/dataSource.js');
  const bytes = new Uint8Array(await (await fetch('/test/fixtures/mw/fixture.bsa')).arrayBuffer());
  await ds.storeMorrowindFiles([new File([bytes], 'fixture.bsa')]);
});
const drive = await page.evaluate(async () => {
  const out = {};
  const mod = await import('/src/combat/mwFpArms.js');
  const { WEAPON_TYPES } = await import('/src/combat/fpsWeapon.js');
  const gl = document.createElement('canvas').getContext('webgl2');
  let quadCalls = 0;
  let lastTex = null;
  const renderer = { gl, drawScreenQuad: (tex) => { quadCalls++; lastTex = tex; } };
  const view = await mod.createMwFpView(renderer);
  out.status = view.status;
  out.ready = view.ready;
  if (!view.ready) return out;

  const canvasStub = { width: 640, height: 400 };
  const readStream = () => {
    // The layer's own stream texture, read back off a framebuffer.
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lastTex, 0);
    const px = new Uint8Array(320 * 200 * 4);
    gl.readPixels(0, 0, 320, 200, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px;
  };
  const covered = (px) => {
    let n = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 8) n++;
    return n;
  };

  // Two fixed points in the forced Move loop (span 1s from 0.5).
  view.update(0.1, WEAPON_TYPES.LongBlade, 'Idle');
  view.draw(canvasStub, WEAPON_TYPES.LongBlade);
  const a = readStream();
  view.update(0.5, WEAPON_TYPES.LongBlade, 'Idle');
  view.draw(canvasStub, WEAPON_TYPES.LongBlade);
  const b = readStream();
  out.quadCalls = quadCalls;
  out.coveredA = covered(a);
  out.coveredB = covered(b);
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 12 || Math.abs(a[i + 3] - b[i + 3]) > 12) diff++;
  }
  out.diff = diff;
  return out;
});
console.log('view drive:', JSON.stringify(drive));
ok(drive.ready === true, `view ready (${drive.status})`);
ok(drive.quadCalls === 2, `stream composited through drawScreenQuad (${drive.quadCalls} calls)`);
ok(drive.coveredA > 400, `the rig covers pixels on the 320x200 stage (${drive.coveredA})`);
ok(drive.diff > 100, `the Move loop MOVES between two fixed times (${drive.diff} px changed)`);

// --- HALF 2: the full game boot, where ARENA2 lives -----------------------
const arena2 = process.env.ARENA2_PATH;
if (arena2 && existsSync(arena2)) {
  const fpQuery =
    'nomenu&class=1&novideo&mwfp=1' +
    '&mwfpbase=meshes/fixture/animated.nif&mwfpgroup=Move' +
    '&mwfpweapon=meshes/fixture/part.nif&mwfpwbone=Bone1&mwfpcam=0.5,-3.5,0.9,0.9';
  await page.goto(`http://localhost:5221/play/?${fpQuery}`);
  await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 12000));
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await page.keyboard.press('z');
  await page.waitForTimeout(1200);
  const mwfp = await page.evaluate(() => window.__mwfp || null);
  ok(mwfp && mwfp.ready === true, `in-game layer ready (${mwfp && mwfp.status})`);
  const shotA = await page.screenshot();
  await page.waitForTimeout(400);
  const shotB = await page.screenshot();
  writeFileSync('/tmp/mw-fp-probe.png', shotA);
  const sample = (buf) => {
    const png = PNG.sync.read(buf);
    const px = [];
    for (let y = Math.floor(png.height * 0.45); y < png.height * 0.95; y += 2) {
      for (let x = Math.floor(png.width * 0.3); x < png.width * 0.7; x += 2) {
        const o = (y * png.width + x) * 4;
        px.push(png.data[o], png.data[o + 1], png.data[o + 2]);
      }
    }
    return px;
  };
  const A = sample(shotA);
  const B = sample(shotB);
  let diff = 0;
  for (let i = 0; i < A.length; i++) if (Math.abs(A[i] - B[i]) > 12) diff++;
  ok(diff > 300, `in-game FP region animates (${diff} changed samples; /tmp/mw-fp-probe.png)`);

  // Default is ON now - the control run forces OFF and the layer must
  // return inert before touching anything.
  await page.goto(`http://localhost:5221/play/?nomenu&class=1&novideo&mwfp=0`);
  await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 12000));
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  ok((await page.evaluate(() => window.__mwfp ?? null)) === null, 'mwfp=0 forces the layer inert');
} else {
  console.log('skip in-game half: ARENA2_PATH not set - the dungeon cannot boot without it');
}

ok(crashes.length === 0, `no pageerrors${crashes.length ? `: ${crashes[0]}` : ''}`);

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
