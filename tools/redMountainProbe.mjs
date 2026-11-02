// RED-MOUNTAIN (bible/03-World/Red-Mountain.md): the volcano photographed in the real game, headless on SwiftShader at a
// one-square land view. It jumps past the Bay to each station (`__tesaJump`), faces the centre and shoots; every wait is on
// `__frame` or the stream's idle flag (Home.md, Process). Needs ARENA2_PATH; the shots are game data - keep them out of the tree.
//   ARENA2_PATH=/home/claude/dfdata/arena2 OUT=/tmp/rm node tools/redMountainProbe.mjs
// Env: OUT, TAG (a prefix), TOD (12:00), NIGHT_TOD (a second clock shot at each station), STATIONS `name:km:bearing:lift:pitch`
// comma-separated (km from the centre, bearing clockwise from north, the eye's metres over the ground, the look's pitch;
// default `far:60:225:300,mid:25:200:60,foot:9:180,rim:2.9:170:20:-0.25`), PITCH (0.08) and LIFT (1.7) their defaults,
// Q extra query, W/H, PORT, CHROMIUM (another browser), JSFLAGS (V8 flags for the page).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const port = Number(process.env.PORT || 5186);
const OUT = process.env.OUT || '/tmp/redmountain';
const TAG = process.env.TAG || '';
const TOD = process.env.TOD || '12:00';
const PITCH = Number(process.env.PITCH ?? 0.08),
  LIFT = Number(process.env.LIFT ?? 1.7);
const STATIONS = (process.env.STATIONS || 'far:60:225:300,mid:25:200:60,foot:9:180,rim:2.9:170:20:-0.25')
  .split(',')
  .map((s) => {
    const [name, km, bearing, lift, pitch] = s.split(':');
    return {
      name,
      km: Number(km),
      bearing: Number(bearing),
      lift: lift != null ? Number(lift) : LIFT,
      pitch: pitch != null ? Number(pitch) : PITCH,
    };
  });
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
page.on('console', (m) => {
  const t = m.text();
  if (
    (process.env.DEBUG || m.type() === 'error' || /red mountain|volcano/i.test(t)) &&
    !/404|cursor|CERT|GL Driver/i.test(t)
  )
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
/** the world's clock to `hhmm` today, through the tick's own setter */
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
const t0 = Date.now();
const q = `world&shot&play&region=${encodeURIComponent(process.env.REGION || 'Daggerfall')}&loc=${encodeURIComponent(process.env.LOC || 'Arkbridge')}&class=1&novideo&tod=${TOD}&skin=enhanced&touch=off&season=summer&weather=${process.env.WEATHER || 'sunny'}&nofoes${process.env.Q || ''}`;
await page.goto(`http://localhost:${port}/play/?${q}`, { timeout: 900000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(0), 's');
await page.addStyleTag({ content: '#fps-counter { display: none !important; }' });
// the volcano's frame on the page, once the land past the Bay has its trace
await page.waitForFunction(
  async () => {
    const R = await import('/src/world/tamriel/redMountain.js');
    return !!R.redMountainFrame();
  },
  null,
  { timeout: 1800000, polling: 5000 },
);
const centre = await ev(async () => {
  const R = await import('/src/world/tamriel/redMountain.js');
  const f = R.redMountainFrame();
  return [f.bx, f.by];
});
console.log("Red Mountain's centre, Bay pixels", centre.map((v) => v.toFixed(2)).join(', '));
const PIXEL_KM = 0.8192;
for (const st of STATIONS) {
  const rad = (st.bearing * Math.PI) / 180;
  const bx = centre[0] + (Math.sin(rad) * st.km) / PIXEL_KM,
    by = centre[1] - (Math.cos(rad) * st.km) / PIXEL_KM;
  const px = Math.floor(bx),
    py = Math.floor(by);
  await ev(([x, y]) => window.__tesaJump(x, y), [px, py]);
  await ev(() => window.__look(0, -1.45));
  await idle();
  const p = await ev(() => window.__player.pos);
  // face the centre: the scene's +x east, +z north, the look's forward (sin yaw, cos yaw)
  const yaw = Math.atan2(centre[0] - bx, -(centre[1] - by));
  await ev(([x, y, z, yaw, pitch]) => window.__pose(x, y, z, yaw, pitch), [p[0], p[1] + st.lift, p[2], yaw, st.pitch]);
  await frames(8);
  console.log(
    `${st.name}: pixel ${px},${py} (${st.km} km at ${st.bearing} deg), feet ${p.map((v) => v.toFixed(1)).join(', ')} at`,
    ((Date.now() - t0) / 1000).toFixed(0),
    's',
  );
  console.log(`${st.name}: the horizon`, JSON.stringify(await ev(() => window.__horizonRings?.() ?? null)));
  await shot(st.name);
  if (process.env.NIGHT_TOD) {
    await clock(process.env.NIGHT_TOD);
    await ev(
      ([x, y, z, yaw, pitch]) => window.__pose(x, y, z, yaw, pitch),
      [p[0], p[1] + st.lift, p[2], yaw, st.pitch],
    );
    await frames(8);
    await shot(`night_${st.name}`);
    await clock(TOD);
  }
}
console.log(
  'done in',
  ((Date.now() - t0) / 1000).toFixed(0),
  's',
  errors.length ? `${errors.length} page errors: ${errors[0]}` : 'no page errors',
);
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
