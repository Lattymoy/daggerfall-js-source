// HOVER-NAMES (2026-10-28, bible/03-World/World-Wide.md HOVER-NAMES; the owner: "NPCs past the bay dont show name on
// tooltip hover"): the plaque names the people, on the Bay and past it. Boots headless at a Bay village, looks at its
// walkers and the road's people near from two metres and reads the plaque (`.wplaque`), then jumps past the Bay
// (`__tesaJump`) to a village, an Arena city and a capital and reads it there. A place passes when most of those looked
// at are named and no plaque stands empty. Run it where the Morrowind data is attached too: its bodies are drawn only then.
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/hoverNamesProbe.mjs
//   Env: PORT (5192), REGION and LOC the boot (Daggerfall's Arkbridge), CAPITAL the capital's index (1, Solitude), N
//   the people looked at a place (8), CHROMIUM a browser other than the pinned one
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT ?? 5192),
  N = Number(process.env.N ?? 8);
const server = await createServer({
  root: process.cwd(),
  configFile: `${process.cwd()}/vite.config.js`,
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
page.setDefaultTimeout(3600000);
// SwiftShader never finishes the default land view (grahtOakProbe.mjs): one square of it
await page.addInitScript(() => {
  localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, tutorialPopups: false }));
  localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const frames = async (n) => {
  const f0 = await ev(() => window.__frame);
  await page.waitForFunction((t) => window.__frame >= t, f0 + n, { polling: 250 });
};
const idle = async () => {
  await page.waitForFunction(() => window.__streamIdle?.() === true, null, { polling: 2000 });
  await frames(2);
};
// a message box pauses the game, and the plaque stands down under a pause (worldPlaque.js cursorActive)
const dismiss = async () => {
  for (let i = 0; i < 16 && (await ev(() => /click or press (any|a) key/i.test(document.body.innerText))); i++) {
    await page.keyboard.press('Space');
    await frames(3);
  }
};
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};

/** Look at up to N walkers of the place's pixel from two metres, and judge what the plaque says. */
async function place(tag, pixel = null) {
  await dismiss();
  const dbg = JSON.parse(await ev(() => window.__townDebug()));
  const px = dbg.pixels.find((p) => !pixel || p.pixel === pixel) ?? dbg.pixels[0];
  if (!px) {
    check(false, `${tag}: a populated town`);
    return;
  }
  // the fly camera into the town, so its street stands round it (worldTownProbe.mjs)
  await ev(
    ([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.05),
    [px.origin[0] + px.navW * 0.8, px.origin[1] + 1.7, px.origin[2] + px.navH * 0.8],
  );
  let people = [];
  for (let i = 0; i < 40 && people.length < 3; i++) {
    await frames(3);
    people = JSON.parse(await ev(() => window.__people())).filter((p) => p.visible && p.pixel === px.pixel);
  }
  const said = [];
  for (const p of people.slice(0, N)) {
    const eye = [p.pos[0] - 1.4, p.pos[1] + 1.5, p.pos[2] - 1.4];
    const dx = p.pos[0] - eye[0],
      dz = p.pos[2] - eye[2],
      dy = p.pos[1] + 1.0 - eye[1];
    await ev(
      ([x, y, z, yw, pt]) => window.__pose(x, y, z, yw, pt),
      [eye[0], eye[1], eye[2], Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))],
    );
    await frames(2);
    said.push(
      await ev(() => {
        const n = document.querySelector('.wplaque');
        const on = n && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden';
        return on ? n.innerText.replace(/\s+/g, ' ').trim() : null;
      }),
    );
  }
  const named = said.filter((t) => t && !/^To /.test(t));
  console.log(`  ${tag} (${px.loc}): ${people.length} walking near, the plaque said ${JSON.stringify(said)}`);
  check(
    said.length >= 3 && named.length * 2 >= said.length,
    `${tag}: most of those looked at named (${named.length} of ${said.length})`,
  );
  check(!said.includes(''), `${tag}: no plaque stands empty`);
}

/** The road's people near (their seats, `__roadSeats`), looked at as the walkers are; judged where any stand. */
async function travellers(tag) {
  let seats = [];
  for (let i = 0; i < 30 && !seats.length; i++) {
    await frames(3);
    seats = await ev(() => window.__roadSeats?.() ?? []);
  }
  const said = [];
  for (const p of seats.slice(0, 4)) {
    const eye = [p.pos[0] - 1.4, p.pos[1] + 1.5, p.pos[2] - 1.4];
    const dx = p.pos[0] - eye[0],
      dz = p.pos[2] - eye[2],
      dy = p.pos[1] + 1.0 - eye[1];
    await ev(
      ([x, y, z, yw, pt]) => window.__pose(x, y, z, yw, pt),
      [eye[0], eye[1], eye[2], Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))],
    );
    await frames(2);
    said.push(
      await ev(() => {
        const n = document.querySelector('.wplaque');
        const on = n && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden';
        return on ? n.innerText.replace(/\s+/g, ' ').trim() : null;
      }),
    );
  }
  console.log(`  ${tag}: ${seats.length} on the road near, the plaque said ${JSON.stringify(said)}`);
  if (said.length)
    check(
      said.filter((t) => t && !/^To /.test(t)).length * 2 >= said.length && !said.includes(''),
      `${tag}: the road's people named`,
    );
}
async function jump(tag, find, arg = null) {
  let at = null;
  for (let i = 0; i < 2400 && !at; i++) {
    at = await ev(find, arg).catch(() => null);
    if (!at) await frames(1);
  }
  if (!at) {
    check(false, `${tag}: a place to jump to`);
    return;
  }
  await ev(([x, y]) => window.__tesaJump(x, y), at);
  await frames(2);
  await idle();
  await place(tag, `${at[0]},${at[1]}`);
  await travellers(tag);
}

await page.goto(
  `http://localhost:${PORT}/play/?world&shot&region=${encodeURIComponent(process.env.REGION ?? 'Daggerfall')}&loc=${encodeURIComponent(process.env.LOC ?? 'Arkbridge')}&class=1&novideo&nofoes&grass=off&tod=13:00&weather=sunny&skin=enhanced&touch=off`,
);
await page.waitForFunction(() => window.__shotReady === true, null, { polling: 2000 });
await idle();
await place('the Bay');
await travellers('the Bay');
await jump('a village past the Bay', () => {
  const v = (window.__tesaPlaces?.(-4000, -4000, 8000, 8000) ?? []).filter((p) => p.type === 2);
  return v.length ? [v[Math.floor(v.length / 3)].x, v[Math.floor(v.length / 3)].y] : null;
});
await jump('an Arena city past the Bay', async () => {
  const st = (await import('/src/world/arenaPlaces.js')).arenaPixels()?.stood ?? [];
  const c = st.filter((p) => p.kind === 'city-state' && !p.pinned);
  return c.length ? [c[Math.floor(c.length / 3)].bx, c[Math.floor(c.length / 3)].by] : null;
});
await jump(
  'a capital past the Bay',
  async (k) => {
    const at = (await import('/src/world/tamrielCapitals.js')).capitalCentrePixel(k);
    return at ? [at.px, at.py] : null;
  },
  Number(process.env.CAPITAL ?? 1),
);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
await server.close();
process.exit(failures.length ? 1 : 0);
