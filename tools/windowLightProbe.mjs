// WL1 (2026-10-29): THE WINDOWS' LIGHT, PHOTOGRAPHED ON A REAL GPU (SwiftShader) - no ARENA2.
//
//     node tools/windowLightProbe.mjs            shots in tools/shots/windowlight-*.png
//
// Synthetic scenes drawn through the REAL Renderer on both sets: a street at night (a house front of window tiles over
// a ground plane, the window picture's four panes behind a cross of lead - its mask uploaded as DFU's window mask) seen
// with the window light on and off (`?windowlight=off`); a room by day whose window wall's glass lets a sun from outside
// in onto its floor past a table (renderer.captureOutsideLight's scene, the shadow map's glass cut); and a mock room
// by day, the sun on its facade and behind it. Each is judged by numbers: the pool's brightness on and off, the lead's
// shadow across it, the patch on the floor and the table's shadow in it. SwiftShader's milliseconds are not a player's;
// the counts (lights, cells, draws) are.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const W = 640,
  H = 400;
const server = await createServer({
  server: { port: 5309, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
}); // a source saved mid-run reloads no page
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failed = false;
const fail = (m) => {
  console.log(`FAIL: ${m}`);
  failed = true;
};
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400));
  });
  await page.goto('http://localhost:5309/play/');
  await page.evaluate(
    async ({ W, H }) => {
      const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
      const { EL_LANE } = await import('/src/render/enhancedLighting.js');
      const { windowEmissionRGB } = await import('/src/render/windowEmission.js');
      const { createViewOut, viewOutFrame } = await import('/src/render/realWindows.js');
      const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.id = 'wlc';
      canvas.style.position = 'fixed';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.zIndex = '99999';
      document.body.style.margin = '0';
      document.body.appendChild(canvas);
      canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
      const r = new Renderer(canvas);
      const gl = r.gl;
      const S = 64;
      const paint = (fn) => {
        const colors = new Uint8Array(S * S * 4);
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            const c = fn(x, y);
            const i = (y * S + x) * 4;
            colors[i] = c[0];
            colors[i + 1] = c[1];
            colors[i + 2] = c[2];
            colors[i + 3] = c[3] ?? 255;
          }
        return { width: S, height: S, colors };
      };
      const n = (x, y) => (((x * 7 + y * 13) ^ (x * y)) % 9) - 4;
      // the window: a frame from x 12-52, y 14-56 (rows bottom-up), four panes behind a cross of lead three texels wide
      const isFrame = (x, y) => x >= 12 && x < 52 && y >= 14 && y < 56;
      const isGlass = (x, y) =>
        isFrame(x, y) && x >= 15 && x < 49 && y >= 17 && y < 53 && !(x >= 30 && x < 34) && !(y >= 33 && y < 37);
      const wall = (x, y) => {
        const v = 170 + n(x, y) * 3;
        return y % 16 === 0 ? [112, 80, 50] : [v, v - 14, v - 34];
      };
      r.uploadTexture(
        4001,
        0,
        paint((x, y) => (isGlass(x, y) ? [36, 48, 62] : isFrame(x, y) ? [70, 48, 30] : wall(x, y))),
        { opaque: true },
      );
      r.uploadEmissionTexture(
        4001,
        0,
        paint((x, y) => (isGlass(x, y) ? [255, 255, 255] : [0, 0, 0])),
        { window: true },
      );
      r.uploadTexture(
        4001,
        1,
        paint((x, y) => {
          const v = 120 + n(x, y) * 4;
          return [v, v - 2, v - 10];
        }),
        { opaque: true },
      ); // the ground: mid grey
      r.uploadTexture(
        4002,
        0,
        paint((x, y) => (isGlass(x, y) ? [36, 48, 62] : isFrame(x, y) ? [70, 48, 30] : [150, 150, 150])),
        { opaque: true },
      );
      r.uploadGlassMask(
        4002,
        0,
        paint((x, y) => (isGlass(x, y) ? [255, 255, 255] : [0, 0, 0])),
      );
      r.uploadTexture(
        4002,
        1,
        paint((x, y) => {
          const v = 150 + n(x, y) * 3;
          return [v, v, v];
        }),
        { opaque: true },
      ); // the room: pale
      r.uploadTexture(
        4002,
        2,
        paint(() => [90, 60, 40]),
        { opaque: true },
      ); // the table
      const build = (fill) => {
        const P = [],
          N = [],
          UV = [],
          IDX = [],
          subs = [];
        const quad = (a, b, c, d, nrm, su, sv) => {
          const base = P.length / 3;
          for (const v of [a, b, c, d]) P.push(...v);
          for (let k = 0; k < 4; k++) N.push(...nrm);
          UV.push(0, 0, su, 0, su, sv, 0, sv);
          IDX.push(base, base + 1, base + 2, base, base + 2, base + 3);
        };
        const sub = (archive, record, f) => {
          const start = IDX.length;
          f(quad);
          if (IDX.length > start)
            subs.push({
              textureArchive: archive,
              textureRecord: record,
              startIndex: start,
              primitiveCount: (IDX.length - start) / 3,
            });
        };
        fill(sub, quad);
        return r.createMesh({
          positions: new Float32Array(P),
          normals: new Float32Array(N),
          uvs: new Float32Array(UV),
          indices: new Uint32Array(IDX),
          subMeshes: subs,
        });
      };
      const T = 2.5; // a tile's side, metres
      // a house front facing +z at z = -10, six tiles across from x = -7.5, two storeys
      const street = build((sub) => {
        sub(4001, 0, (q) => q([-7.5, 0, -10], [7.5, 0, -10], [7.5, 2 * T, -10], [-7.5, 2 * T, -10], [0, 0, 1], 6, 2));
        sub(4001, 1, (q) => q([-30, 0, 30], [30, 0, 30], [30, 0, -30], [-30, 0, -30], [0, 1, 0], 24, 24));
      });
      // a room 6 x 3 x 6 round the origin, its walls facing in; its east wall (x = 3, facing -x) carries two windows, a
      // table stands on the floor in the sun's way
      const room = build((sub) => {
        sub(4002, 0, (q) => q([3, 0, -3], [3, 0, 3], [3, 3, 3], [3, 3, -3], [-1, 0, 0], 2, 1));
        sub(4002, 1, (q) => {
          q([3, 0, 3], [-3, 0, 3], [-3, 3, 3], [3, 3, 3], [0, 0, -1], 2, 1);
          q([-3, 0, 3], [-3, 0, -3], [-3, 3, -3], [-3, 3, 3], [1, 0, 0], 2, 1);
          q([-3, 0, -3], [3, 0, -3], [3, 3, -3], [-3, 3, -3], [0, 0, 1], 2, 1);
          q([-3, 0, 3], [3, 0, 3], [3, 0, -3], [-3, 0, -3], [0, 1, 0], 2, 2);
          q([-3, 3, -3], [3, 3, -3], [3, 3, 3], [-3, 3, 3], [0, -1, 0], 2, 2);
        });
        sub(4002, 2, (q) => {
          // the table: a top 1 m square at 0.8 m, its edges down to the floor
          const x0 = 0.2,
            x1 = 1.2,
            z0 = -0.5,
            z1 = 0.5,
            y = 0.8;
          q([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], 1, 1);
          q([x0, 0, z1], [x1, 0, z1], [x1, y, z1], [x0, y, z1], [0, 0, 1], 1, 1);
          q([x1, 0, z0], [x0, 0, z0], [x0, y, z0], [x1, y, z0], [0, 0, -1], 1, 1);
          q([x1, 0, z1], [x1, 0, z0], [x1, y, z0], [x1, y, z1], [1, 0, 0], 1, 1);
          q([x0, 0, z0], [x0, 0, z1], [x0, y, z1], [x0, y, z0], [-1, 0, 0], 1, 1);
        });
      });
      const I = identity();
      const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.05, 500));
      const read = () => {
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return Array.from(px);
      };
      const door = (on) => history.replaceState(null, '', on ? '/play/' : '/play/?windowlight=off');
      const lane = (on) => {
        r.setLightingLane(on ? EL_LANE : null);
        r.setAir?.(!!on);
        if (r.air) r.air._now = () => 1000;
      };
      window.__wl = {
        // the street at night from across it
        street(laneOn, lightOn) {
          lane(laneOn);
          door(lightOn);
          r.setLighting(new Float32Array([0.16, 0.16, 0.2]), 0, new Float32Array([0.8, 0.9, 1]));
          r.setMoonlight(null);
          r.setIndirectLight([0, 0, 0], 0, new Float32Array(3));
          r.setFog('linear', 0, 60, 300, new Float32Array([0.03, 0.04, 0.08]));
          r.setWindowEmission(windowEmissionRGB('night'));
          r.setPointLights(new Float32Array(0), new Float32Array([1, 1, 1]));
          r.setClearColor([0.02, 0.03, 0.06, 1]);
          const view = lookAt([0, 4.2, 0], [0, 0.3, -8.5], [0, 1, 0]); // over the street, down on the ground before the house
          let px = null;
          for (let f = 0; f < 4; f++) {
            r.beginFrame(proj, view, new Float32Array([0.35, 0.8, 0.25]), WORLD_FRAME);
            r.setWindowRooms('full');
            r.drawMesh(street, I, null);
            if (laneOn) r.resolveFrame();
            px = read();
          }
          return { gl: gl.getError(), px, wl: { ...r._wl.stats, live: r._wlLive } };
        },
        // the room by day, the sun low in the east through the east wall's windows
        room(laneOn, lightOn) {
          lane(laneOn);
          door(lightOn);
          const sunDir = [0.8, 0.45, 0.1],
            len = Math.hypot(...sunDir),
            sd = sunDir.map((v) => v / len);
          const scene = {
            setup: (rr) => {
              rr.setLighting(new Float32Array([0.85, 0.85, 0.9]), 0.9, new Float32Array([1, 0.95, 0.85]));
              return new Float32Array(sd);
            },
            draw: () => {},
          };
          const view = lookAt([-2.5, 1.7, 2.4], [0.8, 0.2, -0.6], [0, 1, 0]);
          const state = createViewOut();
          let px = null,
            now = 1000;
          for (let f = 0; f < 4; f++) {
            now += 300;
            r.setLighting(new Float32Array([0.18, 0.18, 0.18]), 0);
            r.setMoonlight(null);
            r.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
            r.setWindowEmission(windowEmissionRGB('disabled'));
            r.setPointLights(new Float32Array(0), new Float32Array([1, 1, 1]));
            r.setClearColor([0, 0, 0, 1]);
            const vo = viewOutFrame(state, { renderer: r, mode: 'rooms', proj, view, now, scene });
            r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME);
            r.setGlassView(vo);
            r.drawMesh(room, I, null);
            if (laneOn) r.resolveFrame();
            px = read();
          }
          return { gl: gl.getError(), px, wl: { ...r._wl.stats, live: r._wlLive, sun: !!r._wlSun } };
        },
        // the house's mock rooms by day, the sun on the facade or behind it
        mock(laneOn, sunFront) {
          lane(laneOn);
          door(true);
          r.setLighting(new Float32Array([0.7, 0.7, 0.75]), 0.9, new Float32Array([1, 0.95, 0.85]));
          r.setMoonlight(null);
          r.setIndirectLight([0, 0, 0], 0, new Float32Array(3));
          r.setFog('linear', 0, 60, 300, new Float32Array([0.6, 0.7, 0.85]));
          r.setWindowEmission(windowEmissionRGB('day'));
          r.setPointLights(new Float32Array(0), new Float32Array([1, 1, 1]));
          r.setClearColor([0.53, 0.7, 0.92, 1]);
          const view = lookAt([-1.2, 1.9, -6.4], [-1.25, 1.9, -10], [0, 1, 0]);
          const sun = sunFront ? new Float32Array([0.25, 0.55, 0.8]) : new Float32Array([0.25, 0.55, -0.8]);
          const l = Math.hypot(sun[0], sun[1], sun[2]);
          sun[0] /= l;
          sun[1] /= l;
          sun[2] /= l;
          let px = null;
          for (let f = 0; f < 3; f++) {
            r.beginFrame(proj, view, sun, WORLD_FRAME);
            r.setWindowRooms('full');
            r.drawMesh(street, I, null);
            if (laneOn) r.resolveFrame();
            px = read();
          }
          return { gl: gl.getError(), px };
        },
      };
    },
    { W, H },
  );
  mkdirSync('tools/shots', { recursive: true });
  const shot = async (name) => {
    writeFileSync(`tools/shots/windowlight-${name}.png`, await page.locator('#wlc').screenshot());
  };
  // the image's rows are GL's (bottom-up); (x, y) here is the screen's (top-down)
  const at = (px, x, y) => {
    const i = ((H - 1 - y) * W + x) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };
  const mean = (px, x0, y0, x1, y1) => {
    const s = [0, 0, 0];
    let k = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const c = at(px, x, y);
        s[0] += c[0];
        s[1] += c[1];
        s[2] += c[2];
        k++;
      }
    return s.map((v) => Math.round(v / k));
  };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const out = {};
  const only = process.env.WL_ONLY ?? ''; // 'street': the night street alone, for a quick look
  for (const laneOn of [false, true]) {
    const tag = laneOn ? 'lane' : 'classic';
    const on = await page.evaluate((a) => window.__wl.street(...a), [laneOn, true]);
    await shot(`street-${tag}-on`);
    const off = await page.evaluate((a) => window.__wl.street(...a), [laneOn, false]);
    await shot(`street-${tag}-off`);
    // the ground one to four metres before the house: the frame's middle rows
    const gOn = mean(on.px, 100, 200, 540, 270),
      gOff = mean(off.px, 100, 200, 540, 270);
    // the brightest ground row's profile across: the lead's shadow is a dip between two bright panes
    let best = 0,
      bestY = 200;
    for (let y = 192; y < 330; y += 2) {
      const v = lum(mean(on.px, 0, y, W, y + 2));
      if (v > best) {
        best = v;
        bestY = y;
      }
    }
    const row = [];
    for (let x = 0; x < W; x += 4) row.push(Math.round(lum(at(on.px, x, bestY)) - lum(at(off.px, x, bestY))));
    out[`street-${tag}`] = {
      gl: [on.gl, off.gl],
      ground: { on: gOn, off: gOff },
      lights: on.wl,
      gainRow: bestY,
      profile: row.join(' '),
    };
    if (!(lum(gOn) > lum(gOff) + 2))
      fail(`street ${tag}: the ground is no brighter with the windows' light on (${gOn} vs ${gOff})`);
    if (!(on.wl.lights > 0)) fail(`street ${tag}: no window light stood (${JSON.stringify(on.wl)})`);
    if (off.wl.lights !== 0 && off.wl.live) fail(`street ${tag}: the door shut, a window still lit`);
    if (only === 'street') continue;
    const roomOn = await page.evaluate((a) => window.__wl.room(...a), [laneOn, true]);
    await shot(`room-${tag}-on`);
    const roomOff = await page.evaluate((a) => window.__wl.room(...a), [laneOn, false]);
    await shot(`room-${tag}-off`);
    const fOn = mean(roomOn.px, 0, 260, W, 400),
      fOff = mean(roomOff.px, 0, 260, W, 400);
    out[`room-${tag}`] = { gl: [roomOn.gl, roomOff.gl], floor: { on: fOn, off: fOff }, lights: roomOn.wl };
    if (!(lum(fOn) > lum(fOff) + 2))
      fail(`room ${tag}: the floor is no brighter with the sun through the glass (${fOn} vs ${fOff})`);
    const front = await page.evaluate((a) => window.__wl.mock(...a), [laneOn, true]);
    await shot(`mock-${tag}-sunlit`);
    const behind = await page.evaluate((a) => window.__wl.mock(...a), [laneOn, false]);
    await shot(`mock-${tag}-shaded`);
    out[`mock-${tag}`] = {
      gl: [front.gl, behind.gl],
      centre: { sunlit: mean(front.px, 220, 120, 420, 300), shaded: mean(behind.px, 220, 120, 420, 300) },
    };
  }
  console.log(JSON.stringify(out, null, 1));
  const known = (e) => /GPU stall|Must have element array buffer bound/.test(e);
  const real = errors.filter((e) => !known(e));
  if (real.length) fail(`page errors:\n${real.join('\n')}`);
  for (const [k, v] of Object.entries(out)) if (v.gl.some((e) => e !== 0)) fail(`${k}: GL error ${v.gl}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
