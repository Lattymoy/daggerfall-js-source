// GRAHT1 (bible/03-World/Graht-Oaks.md) - VALENWOOD'S GRAHT-OAKS, PHOTOGRAPHED in the real game. Boots the streaming world
// headless on SwiftShader at a ONE-square land view (TerrainDistance 1: the 3x3 - SwiftShader never finishes the default
// 121), jumps past the Bay to a Valenwood pixel (`__tesaJump`, as a fast travel lands), and photographs it from the forest
// floor (looking up, level, along the ground), from a Valenwood town, and from over the crowns. Every wait is on the
// shot-mode frame counter (`__frame`) or the stream's own idle flag, never a sleep (Home.md, Process).
//
// Needs ARENA2_PATH (the game's data, which never enters this tree) and the provisioned Chromium. The frames are a
// picture, not a frame rate: SwiftShader's milliseconds are nobody's. Renders of game data are game data (Port-Doctrine)
// - write them outside the tree.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 PORT=5184 OUT=/tmp/shots TOD=12:00 node tools/grahtOakProbe.mjs
//
// Env: OUT the directory the PNGs go to (`<TAG><view>.png`); TAG a prefix; TOD the clock (`tod=`); WEATHER (`sunny`); REGION and
// LOC the place the world boots in before the jump (Daggerfall's Arkbridge, a village of 2 x 2 - the city takes an hour); PX/PY
// the forest pixel jumped to (default: found on the page - the nearest pixel to Grahtwood's own seed, picture (128, 150),
// whose 7 x 7 is all the canopy's zones and no place's, read through the game's own tamrielBiomeAt and pictureToBay, so a
// refit of the map moves it with the land); TOWN `x,y` a town's pixel to jump to after (default: the nearest place past the
// Bay to the forest pixel whose pixel is the canopy's, `__tesaPlaces`); VIEWS which to take (comma-separated:
// up, level, ground, far, town, townup; default all); Q extra query (`&graht=off`); W/H the viewport; PORT the dev server's;
// FRAMES n: at the forest's level and upward views, the mean wall-clock milliseconds a frame over n frames (synced on
// `__frame`) and the fps counter's draws a frame (`&fps`) - SwiftShader's, relative only, A/B on one machine;
// CHROMIUM a browser other than the pinned Playwright's (`/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`);
// JSFLAGS V8 flags for the page (`--max-old-space-size=1536`: a shared machine's memory); NIGHT the views to take again at night in the same boot (`up,level,town`: `night_<view>.png`), the world's clock set to
// NIGHT_TOD (23:00) through its own setter (systems/worldTick.js setWorldMinutes) and back - a boot past the Bay is long.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const port = Number(process.env.PORT || 5184);
const OUT = process.env.OUT || '/tmp/graht';
const TAG = process.env.TAG || '';
const TOD = process.env.TOD || '12:00';
let PX = process.env.PX ? Number(process.env.PX) : null,
  PY = process.env.PY ? Number(process.env.PY) : null;
const VIEWS = new Set(
  (process.env.VIEWS || 'up,level,ground,far,town,townup')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
mkdirSync(OUT, { recursive: true });
const server = await createServer({
  root: process.cwd(),
  configFile: process.cwd() + '/vite.config.js',
  server: { port, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    ...(process.env.JSFLAGS ? [`--js-flags=${process.env.JSFLAGS}`] : []),
  ],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 600) },
});
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('[pageerror]', e.message);
});
page.on('crash', () => {
  console.log('[crash] the page crashed (out of memory?) - nothing more to photograph');
  process.exit(3);
});
let roadsLanded = null;
const roadsIn = new Promise((go) => {
  roadsLanded = go;
}); // the roads past the Bay all landed - every rolled place stands
page.on('console', (m) => {
  const t = m.text();
  if (/\[roads\].* all in /.test(t)) roadsLanded();
  if ((process.env.DEBUG || m.type() === 'error' || /graht|canopy/i.test(t)) && !/404|cursor|CERT|GL Driver/i.test(t))
    console.log(`[page:${m.type()}]`, t.slice(0, 300));
});
await page.addInitScript(() => {
  localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1 }));
  localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
});
const ev = (fn, ...a) => page.evaluate(fn, ...a);
/** wait until the page has drawn `n` more frames (shot mode's counter - never a sleep) */
const frames = async (n) => {
  const f = await ev(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame >= f0 + k, [f, n], { timeout: 900000, polling: 500 });
};
const idle = async () => {
  await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000, polling: 2000 });
  await frames(4);
};
/** put away every page the welcome tour or a notice holds up (a click or any key reads one) */
const dismiss = async () => {
  for (let i = 0; i < 16; i++) {
    if (!(await ev(() => /click or press (any|a) key/i.test(document.body.innerText)))) return;
    await page.keyboard.press('Space');
    await frames(3);
  }
};
const shot = async (name) => {
  await dismiss();
  const path = `${OUT}/${TAG}${name}.png`;
  await page.screenshot({ path, timeout: 1500000 });
  console.log('shot', path);
};
const t0 = Date.now();
const q = `world&shot&play&fps&region=${encodeURIComponent(process.env.REGION || 'Daggerfall')}&loc=${encodeURIComponent(process.env.LOC || 'Arkbridge')}&class=1&novideo&tod=${TOD}&skin=enhanced&touch=off&season=summer&weather=${process.env.WEATHER || 'sunny'}${process.env.Q || ''}`;
await page.goto(`http://localhost:${port}/play/?${q}`, { timeout: 900000, waitUntil: 'domcontentloaded' }); // a loaded machine transforms slowly
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(0), 's');
/** stand on the forest floor of the pixel jumped to: a square of grass the archive calls grass, off any place's tiles */
const stand = async (yaw, pitch, lift = 1.7, r = 3, skip = 0) => {
  const s = await ev(([r, skip]) => window.__grassSpot?.(r, skip) ?? null, [r, skip]);
  const at = s?.feet ?? (await ev(() => window.__player.pos));
  await ev(([x, y, z, yaw, pitch]) => window.__pose(x, y, z, yaw, pitch), [at[0], at[1] + lift, at[2], yaw, pitch]);
  await frames(6);
  return at;
};
await page.addStyleTag({ content: '#fps-counter { display: none !important; }' }); // the counter still counts (__fpsStats); the picture is the world's
if (PX == null) {
  await Promise.race([roadsIn, new Promise((go) => setTimeout(go, 3600000))]); // the places the roads roll stand first
  // the forest: the nearest pixel to Grahtwood's seed whose 7 x 7 is all canopy and none of it a place
  const at = await ev(async () => {
    const F = await import('/src/world/tamriel/tamrielFrame.js'),
      B = await import('/src/world/tamriel/tamrielBiomes.js');
    const [sx, sy] = F.pictureToBay(128, 150).map(Math.round);
    const whole = (x, y) => {
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) if (!B.tamrielBiomeAt(x + i, y + j)?.canopy) return false;
      return !(window.__tesaPlaces?.(x - 3, y - 3, x + 3, y + 3) ?? []).length;
    };
    for (let r = 0; r < 80; r++)
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++)
          if (Math.max(Math.abs(i), Math.abs(j)) === r && whole(sx + i, sy + j))
            return [sx + i, sy + j, B.tamrielBiomeAt(sx + i, sy + j).name, sx, sy];
    return null;
  });
  if (!at) {
    console.log("no whole canopy pixel found near Grahtwood's seed");
    process.exit(4);
  }
  [PX, PY] = at;
  console.log('forest pixel', PX, PY, `(${at[2]}; the seed at ${at[3]}, ${at[4]})`);
}
await ev(([x, y]) => window.__tesaJump(x, y), [PX, PY]);
await ev(() => window.__look(0, -1.45)); // the build's frames looking at the ground: SwiftShader draws a frame of the forest in seconds
await idle();
console.log(
  'jumped to',
  PX,
  PY,
  'in',
  ((Date.now() - t0) / 1000).toFixed(0),
  's; pixel',
  await ev(() => window.__currentPixel()),
);
const stats = async () =>
  ev(() => {
    const f = window.__renderer?.lptDrawnFrames?.()?.[2];
    return { grahtRuns: f ? f.runs.map((r) => r.drawCount) : null, fps: window.__fpsStats?.() ?? null };
  });
const FRAMES = Number(process.env.FRAMES || 0);
const NIGHT = new Set(
  (process.env.NIGHT || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
/** the world's clock to `hhmm` today, through the tick's own setter (the module the game itself imported) */
const clock = async (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  await ev(
    async (mins) => {
      const w = await import('/src/systems/worldTick.js');
      w.setWorldMinutes(Math.floor(w.worldMinutes() / 1440) * 1440 + mins);
    },
    h * 60 + (m || 0),
  );
  await frames(8);
};
const NIGHT_TOD = process.env.NIGHT_TOD || '23:00';
/** the mean wall-clock ms a frame over FRAMES frames, frame-synced, and the fps counter's draws a frame */
const measure = async (label) => {
  if (!FRAMES) return;
  await frames(2);
  const f0 = await ev(() => window.__frame),
    t0 = Date.now();
  await page.waitForFunction(([a, k]) => window.__frame >= a + k, [f0, FRAMES], { timeout: 900000, polling: 100 });
  const ms = (Date.now() - t0) / FRAMES,
    st = await ev(() => window.__fpsStats?.() ?? null);
  console.log(
    `perf ${TAG}${label}: ${ms.toFixed(0)} ms a frame over ${FRAMES} frames; draws ${st?.draws != null ? Math.round(st.draws) : '?'}`,
  );
};
if (VIEWS.has('up')) {
  await stand(0.4, 1.15);
  await shot('up');
  console.log(JSON.stringify(await stats()));
  await measure('up');
}
if (VIEWS.has('level')) {
  await stand(0.4, 0.12);
  await shot('level');
  await measure('level');
}
if (VIEWS.has('ground')) {
  await stand(2.2, 0.32);
  await shot('ground');
}
if (VIEWS.has('far')) {
  await stand(0.9, -0.12, 330);
  await shot('far');
}
if (NIGHT.has('up') || NIGHT.has('level')) {
  await clock(NIGHT_TOD);
  if (NIGHT.has('up')) {
    await stand(0.4, 1.15);
    await shot('night_up');
    await measure('night_up');
  }
  if (NIGHT.has('level')) {
    await stand(0.4, 0.12);
    await shot('night_level');
  }
  await clock(TOD);
}
if (VIEWS.has('town') || VIEWS.has('townup')) {
  let town = process.env.TOWN ? process.env.TOWN.split(',').map(Number) : null;
  if (!town) {
    const places = await ev(
      async ([x, y]) => {
        const B = await import('/src/world/tamriel/tamrielBiomes.js');
        return (window.__tesaPlaces?.(x - 60, y - 60, x + 60, y + 60) ?? []).filter(
          (p) => B.tamrielBiomeAt(p.x ?? p.px ?? p.pixel?.[0], p.y ?? p.py ?? p.pixel?.[1])?.canopy,
        );
      },
      [PX, PY],
    );
    const list = (Array.isArray(places) ? places : [])
      .map((p) => [p.x ?? p.px ?? p.pixel?.[0], p.y ?? p.py ?? p.pixel?.[1], p])
      .filter((p) => Number.isFinite(p[0]));
    list.sort((a, b) => Math.hypot(a[0] - PX, a[1] - PY) - Math.hypot(b[0] - PX, b[1] - PY));
    town = list[0] ? [list[0][0], list[0][1]] : null;
    console.log('places near:', list.length, list[0] ? JSON.stringify(list[0][2]).slice(0, 200) : '');
  }
  if (town) {
    await ev(([x, y]) => window.__tesaJump(x, y), town);
    await ev(() => window.__look(0, -1.45));
    await idle();
    const place = await ev(([x, y]) => window.__tesaPlace?.(x, y), town);
    console.log('town', town, JSON.stringify(place).slice(0, 200));
    const p = await ev(() => window.__player.pos);
    if (VIEWS.has('town')) {
      await ev(([x, y, z]) => window.__pose(x, y + 1.7, z, 0.6, 0.18), p);
      await frames(6);
      await shot('town');
    }
    if (VIEWS.has('townup')) {
      await ev(([x, y, z]) => window.__pose(x, y + 1.7, z, 0.6, 0.85), p);
      await frames(6);
      await shot('townup');
    }
    if (NIGHT.has('town')) {
      await clock(NIGHT_TOD);
      await ev(([x, y, z]) => window.__pose(x, y + 1.7, z, 0.6, 0.18), p);
      await frames(6);
      await shot('night_town');
    }
  }
}
console.log(JSON.stringify(await stats()));
console.log(
  'done in',
  ((Date.now() - t0) / 1000).toFixed(0),
  's',
  errors.length ? `${errors.length} page errors: ${errors[0]}` : 'no page errors',
);
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
