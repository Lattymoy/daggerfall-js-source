// TESA-LANDS (bible/03-World/Tamriel-Lands.md) - THE LANDS PAST THE BAY, PHOTOGRAPHED in the real game. Boots the streaming
// world headless on SwiftShader at a ONE-square land view (TerrainDistance 1: the 3x3 - SwiftShader never finishes the
// default 121), and for each zone asked jumps past the Bay to a pixel deep in it (`__tesaJump`, as a fast travel lands) and
// photographs it standing level, looking down at the ground at its feet, and from 330 m over it. Every wait is on the
// shot-mode frame counter (`__frame`) or the stream's own idle flag, never a sleep (Home.md, Process).
//
// Needs ARENA2_PATH (the game's data, which never enters this tree) and the provisioned Chromium. Renders of game data
// are game data (Port-Doctrine) - write them outside the tree.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 OUT=/tmp/lands ZONES=morrowindAshlands,skyrimTundra node tools/landsProbe.mjs
//
// Env: OUT the directory the PNGs go to (`<TAG><zone>_<view>.png`); TAG a prefix; ZONES the zones (tamrielBiomes.js keys;
// default every zone tamrielLands.js names); VIEWS (level, ground, far, prop - the nearest landmark, seen whole from past
// its reach and from over it: scenes/landPropsHost.js `__landProps`; default all); TOD the clock (`tod=`, 12:00); WEATHER
// (`sunny`); Q extra query (`&lands=off` for the before); W/H the viewport; PORT the dev server's; CHROMIUM a browser other
// than the pinned Playwright's; JSFLAGS V8 flags for the page.
//
// THE PIXEL a zone is photographed at: of every pixel of the continent's frame (every STRIDE-th) the zone holds, the one
// whose 5 x 5 the zone holds whole and no place stands in, nearest the zone's own middle - read through the game's own
// tamrielBiomeAt on the page, so a refit of the map moves it with the land.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const port = Number(process.env.PORT || 5185);
const OUT = process.env.OUT || '/tmp/lands';
const TAG = process.env.TAG || '';
const TOD = process.env.TOD || '12:00';
const VIEWS = new Set(
  (process.env.VIEWS || 'level,ground,far,prop')
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
page.on('console', (m) => {
  const t = m.text();
  if ((process.env.DEBUG || m.type() === 'error' || /lands|dress/i.test(t)) && !/404|cursor|CERT|GL Driver/i.test(t))
    console.log(`[page:${m.type()}]`, t.slice(0, 300));
});
await page.addInitScript(() => {
  // and survival off (the Climates & Calories law reads a zone's ground climate: the Ashlands' Mountain reads -45 at noon)
  // and no foes (the query's `nofoes`) - the HUD and the road quiet
  localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, survival: false })); // survival/difficulty.js SURVIVAL_STORED's Off
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
const q = `world&shot&play&fps&region=${encodeURIComponent(process.env.REGION || 'Daggerfall')}&loc=${encodeURIComponent(process.env.LOC || 'Arkbridge')}&class=1&novideo&nofoes&tod=${TOD}&skin=enhanced&touch=off&season=summer&weather=${process.env.WEATHER || 'sunny'}${process.env.Q || ''}`;
await page.goto(`http://localhost:${port}/play/?${q}`, { timeout: 900000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
await page.addStyleTag({ content: '#fps-counter { display: none !important; }' });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(0), 's');
// the land photographed, not the body: the staff's god and fly (characters/playerEntity.js setStaffPowers - the page's own
// module) - a pose over the land neither falls nor hurts (a landmark's side and 40 m over it: walk mode spawns the body at
// a pose, and the fall killed the character between zones)
await ev(async () => (await import('/src/characters/playerEntity.js')).setStaffPowers({ god: true, fly: true }));
// the trace and the fit land a little after the world mounts: the zones read the trace's land
await page.waitForFunction(
  async () => {
    const L = await import('/src/world/tamriel/tamrielLand.js');
    return !!L.tamrielTrace();
  },
  null,
  { timeout: 900000, polling: 2000 },
);
const zones = process.env.ZONES
  ? process.env.ZONES.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : await ev(async () => Object.keys((await import('/src/world/tamriel/tamrielLands.js')).LANDS));
/** stand at the pixel's middle-most ground (a grass square if the archive has one), at `lift` over it, looking `yaw`, `pitch` */
const stand = async (yaw, pitch, lift = 1.7) => {
  const s = await ev(() => window.__grassSpot?.(3, 0) ?? null);
  const at = s?.feet ?? (await ev(() => window.__player.pos));
  await ev(([x, y, z, yaw, pitch]) => window.__pose(x, y, z, yaw, pitch), [at[0], at[1] + lift, at[2], yaw, pitch]);
  await frames(6);
};
/** the zones whose landmarks the probe could not see framed - a zone that names landmarks and stands none, or none drawn */
const unseen = [];
for (const zone of zones) {
  const at = await ev(async (key) => {
    const B = await import('/src/world/tamriel/tamrielBiomes.js'),
      F = await import('/src/world/tamriel/tamrielFrame.js');
    const f = F.tamrielFrameInBay(),
      STRIDE = 6,
      hits = [],
      x0 = Math.ceil(f.x0),
      y0 = Math.ceil(f.y0);
    for (let y = y0; y < f.y0 + f.h; y += STRIDE)
      for (let x = x0; x < f.x0 + f.w; x += STRIDE) if (B.tamrielBiomeAt(x, y)?.key === key) hits.push([x, y]);
    if (!hits.length) return null;
    const mx = hits.reduce((a, h) => a + h[0], 0) / hits.length,
      my = hits.reduce((a, h) => a + h[1], 0) / hits.length;
    hits.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
    const whole = (x, y) => {
      for (let j = -2; j <= 2; j++)
        for (let i = -2; i <= 2; i++) if (B.tamrielBiomeAt(x + i, y + j)?.key !== key) return false;
      return !(window.__tesaPlaces?.(x - 2, y - 2, x + 2, y + 2) ?? []).length;
    };
    for (const [x, y] of hits) if (whole(x, y)) return [x, y];
    return hits[0];
  }, zone);
  if (!at) {
    console.log('no pixel of', zone);
    continue;
  }
  await ev(([x, y]) => window.__tesaJump(x, y), at);
  await ev(() => window.__look(0, -1.45));
  await idle();
  console.log(zone, 'at', at.join(','), 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  // a dead character photographs a death screen for every zone after - the run ends there, judged
  if (await ev(() => /YOU DIED/i.test(document.body.innerText))) {
    errors.push(`the character died on the way to ${zone}`);
    break;
  }
  if (VIEWS.has('level')) {
    await stand(0.4, 0.06);
    await shot(`${zone}_level`);
  }
  if (VIEWS.has('ground')) {
    await stand(2.2, -0.55);
    await shot(`${zone}_ground`);
  }
  if (VIEWS.has('far')) {
    await stand(0.9, -0.22, 330);
    await shot(`${zone}_far`);
  }
  if (VIEWS.has('prop')) {
    // the nearest landmark of the zone, seen from its own reach and a half off, from the south, eye at a man's height
    const me = await ev(() => window.__player.pos);
    const lm = await ev(([x, z]) => window.__landProps?.near(null, x, z) ?? null, [me[0], me[2]]);
    const named = await ev(
      async (key) => ((await import('/src/world/tamriel/tamrielLands.js')).LANDS[key]?.props.length ?? 0) > 0,
      zone,
    );
    if (!lm) {
      if (named) unseen.push(`${zone}: no landmark framed`);
    } else {
      // its whole height in the frame: backed off past its reach and its height, the eye a share of the way up it (over
      // the crowns of the trees about it), looking at its middle
      const back = Math.max(12, lm.reach * 2.4 + lm.top * 1.1),
        ex = lm.at[0],
        ez = lm.at[2] - back,
        eye = lm.at[1] + Math.max(1.7, lm.top * 0.6);
      const pitch = Math.atan2(lm.at[1] + lm.top * 0.5 - eye, back);
      await ev(([x, y, z, p]) => window.__pose(x, y, z, 0, p), [ex, eye, ez, pitch]);
      await frames(8);
      const stats = await ev(() => window.__landProps.stats());
      console.log(
        zone,
        'landmark',
        lm.kind,
        lm.look,
        'top',
        lm.top.toFixed(1),
        'reach',
        lm.reach.toFixed(1),
        JSON.stringify(stats),
      );
      if (!(stats.drawn > 0)) unseen.push(`${zone}: ${stats.props} landmarks framed, none drawn`);
      await shot(`${zone}_prop`);
      // and from over it: 40 m up and back, looking down on it and the land about it
      await ev(
        ([x, y, z, p]) => window.__pose(x, y, z, 0, p),
        [ex, lm.at[1] + lm.top + 40, lm.at[2] - lm.top - 40, -0.6],
      );
      await frames(8);
      await shot(`${zone}_propover`);
    }
  }
}
console.log(
  'errors:',
  errors.length ? errors.join(' | ') : 'none',
  'unseen:',
  unseen.length ? unseen.join(' | ') : 'none',
  'in',
  ((Date.now() - t0) / 1000).toFixed(0),
  's',
);
await browser.close();
await server.close();
// THE VERDICT: no page error, and every zone that names landmarks had them framed and drawn
if (errors.length || unseen.length) process.exit(1);
