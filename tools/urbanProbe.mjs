// URBANIZER (bible/03-World/Urban-Fabric.md) - THE TOWNS PAST THE BAY, PHOTOGRAPHED: the world host boots in a small town
// of the Bay, the trace lands, and the probe jumps to a capital past the Bay (the Imperial City aside) or to a city of a
// province, and photographs it - from above, down a street either way and over a yard - frame-synced on shot mode's
// `__frame` counter, never a sleep (bible/Home.md, Process). Each target in a browser of its own: SwiftShader's renderer
// holds the streamed world in a few gigabytes, and a session that jumps from place to place outgrows a shared machine.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 node tools/urbanProbe.mjs <out dir> [only]
//   `only`: a comma list of the targets' names to take (the capitals' keys, or `town:<province>`); none, all of them.
//   PORT (default 5189); CHROMIUM a browser other than the pinned Playwright's; REGION and LOC the Bay town it boots in
//   (Daggerfall's Gothway Garden); W and H the view (880 x 550). The trees and the grass are off (`?trees=off&grass=off` -
//   the same towns at a third of the memory). The shots are the player's own data rendered: never commit them
//   (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node tools/urbanProbe.mjs <out dir> [only]');
  process.exit(2);
}
const ONLY = (process.argv[3] ?? '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = Number(process.env.PORT ?? 5189);
const ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--autoplay-policy=no-user-gesture-required',
];
const URL = `http://localhost:${PORT}/play/?world&shot&play&region=${encodeURIComponent(process.env.REGION ?? 'Daggerfall')}&loc=${encodeURIComponent(process.env.LOC ?? 'Gothway Garden')}&class=1&novideo&tod=13:00&weather=sunny&season=summer&skin=enhanced&touch=off&fps&trees=off&grass=off`;

const server = await createServer({
  root: process.cwd(),
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const stats = {},
  errors = [];

/** A browser booted on the Bay's street with the trace landed: its page, and its doors. */
async function boot() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
    args: ARGS,
  });
  try {
    return await bootIn(browser);
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

/** @param {import('playwright').Browser} browser */
async function bootIn(browser) {
  const page = await browser.newPage({
    viewport: { width: Number(process.env.W ?? 880), height: Number(process.env.H ?? 550) },
  });
  page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
  page.on('crash', () => {
    console.log('  the renderer crashed');
    browser.close().catch(() => {});
  }); // a wait on a crashed page never ends: the browser closed under it, it throws
  page.on('console', (m) => {
    const t = m.text();
    if (/^\[(urban|places|capitals)\]/.test(t)) console.log(`  console: ${t.slice(0, 240)}`);
    if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t))
      errors.push(`[console] ${t.slice(0, 300)}`);
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, tutorialPopups: false })); // the tutorial's pages off (systems/tutorials.js)
      localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
    } catch {
      /* none */
    }
  });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const until = async (fn, arg, ms = 900000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 1000 });
  /** `n` more frames drawn (shot mode's counter - never a sleep). */
  const frames = async (n) => {
    const f = await ev(() => window.__frame ?? 0);
    await page.waitForFunction(([f0, k]) => (window.__frame ?? 0) >= f0 + k, [f, n], { timeout: 900000, polling: 500 });
  };
  const t0 = Date.now();
  await page.goto(URL);
  // the street stood: the boot's stream drained (shot mode's `__streamIdle`) on the street - said once a minute while it is not
  for (let tries = 0; ; tries++) {
    try {
      await until(() => window.__mode?.() === 'exterior' && window.__streamIdle?.() === true, null, 60000);
      break;
    } catch (e) {
      const st = await ev(() => ({
        mode: window.__mode?.() ?? null,
        idle: window.__streamIdle?.() ?? null,
        frame: window.__frame ?? null,
        overlay: window.__overlayKind?.() ?? null,
      }));
      if (st.overlay) await ev(() => window.__arenaCloseOverlays?.()); // the class start's opening boxes put away (no key: a key opens the next)
      console.log(`  waiting for the street (${tries + 1} min): ${JSON.stringify(st)}`);
      if (tries > 40) throw e;
    }
  }
  await ev(() => window.__arenaCloseOverlays?.());
  // the trace landed: the capitals have pixels and the places stand
  await until(async () => {
    const c = await import('/src/world/tamrielCapitals.js');
    const a = await import('/src/world/arenaPlaces.js');
    return !!c.capitalCentrePixel(1) && !!a.arenaPixels();
  });
  console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return { browser, page, ev, until, frames };
}

/** The targets: every capital past the Bay but the Imperial City, and the first city of each province. */
async function targetsOf(ev) {
  return ev(async () => {
    const c = await import('/src/world/tamrielCapitals.js'),
      a = await import('/src/world/arenaPlaces.js');
    const out = [];
    c.CAPITALS.forEach((cap, k) => {
      if (k === 0) return;
      const p = c.capitalCentrePixel(k);
      if (p) out.push({ name: cap.key, px: p.px, py: p.py });
    });
    const seen = new Set();
    for (const p of a.arenaPixels().stood) {
      if (p.pinned || seen.has(p.province) || p.kind !== 'city-state') continue;
      seen.add(p.province);
      out.push({ name: `town:${p.province}`, px: p.bx, py: p.by, place: p.name });
    }
    return out;
  });
}

/** One target, photographed. */
async function shoot({ page, ev, until, frames }, t) {
  const tag = t.name.replace(/[^a-z0-9]+/gi, '-');
  const j0 = Date.now();
  await ev(([x, y]) => window.__tesaJump(x, y), [t.px, t.py]);
  await until(
    ([x, y]) =>
      window.__currentPixel?.() === `${x},${y}` && window.__tesaPlace?.(x, y)?.built && window.__streamIdle?.(),
    [t.px, t.py],
  );
  await frames(3);
  const at = await ev(() => {
    const eye = window.__cam(),
      doors = window.__doors().filter((d) => Math.hypot(d.pos[0] - eye[0], d.pos[2] - eye[2]) < 700 && d.type === 0);
    const c = doors.reduce(
      (s, d) => [s[0] + d.pos[0] / doors.length, s[1] + d.pos[1] / doors.length, s[2] + d.pos[2] / doors.length],
      [0, 0, 0],
    );
    const near = doors
      .slice()
      .sort((a, b) => Math.hypot(a.pos[0] - c[0], a.pos[2] - c[2]) - Math.hypot(b.pos[0] - c[0], b.pos[2] - c[2]));
    return {
      eye,
      centre: c,
      doors: doors.length,
      near: near.slice(0, 12).map((d) => ({ pos: d.pos, normal: d.normal })),
    };
  });
  const place = await ev(([x, y]) => window.__tesaPlace(x, y), [t.px, t.py]);
  stats[t.name] = {
    place: place.name,
    blocks: place.blocks,
    buildings: place.buildings,
    doors: at.doors,
    jumpS: Math.round((Date.now() - j0) / 1000),
  };
  console.log(
    `${t.name}: ${place.name} ${JSON.stringify(place.blocks)} ${place.buildings} buildings, ${at.doors} doors, built in ${stats[t.name].jumpS} s`,
  );
  if (!at.doors) {
    errors.push(`${t.name}: no door within 700 m of the landing`);
    return;
  }
  const shot = async (name) => {
    await frames(4);
    await page.screenshot({ path: join(OUT, `${tag}-${name}.png`) });
    const st = await ev(() => (window.__fpsStats ? window.__fpsStats() : null)); // the counter's last second: draws, binds, frame ms (SwiftShader - relative only)
    (stats[t.name].poses ??= {})[name] = st && {
      draws: st.draws,
      binds: st.binds,
      frameMs: st.meanMs,
      scriptMs: st.scriptMs,
    };
  };
  const [cx, cy, cz] = at.centre;
  // from above, south of the middle, looking north and down
  await ev(([p]) => window.__pose(p[0], p[1], p[2], Math.PI, -0.95), [[cx, cy + 170, cz + 120]]);
  await shot('above');
  // at a street's mouth: before the door nearest the middle, looking along the street either way
  const d = at.near[0],
    n = d.normal,
    foot = [d.pos[0] + n[0] * 7, d.pos[1], d.pos[2] + n[2] * 7];
  const along = Math.atan2(-n[2], n[0]);
  await ev(([p, yaw]) => window.__pose(p[0], p[1] + 1.2, p[2], yaw, -0.04), [foot, along]);
  await shot('street-a');
  await ev(([p, yaw]) => window.__pose(p[0], p[1] + 1.2, p[2], yaw, -0.04), [foot, along + Math.PI]);
  await shot('street-b');
  // behind a house: the far door's back, looking at the houses' backs (a yard where one stands)
  const e = at.near[Math.min(5, at.near.length - 1)],
    m = e.normal;
  const back = [e.pos[0] - m[0] * 26, e.pos[1], e.pos[2] - m[2] * 26];
  await ev(([p, yaw]) => window.__pose(p[0], p[1] + 7, p[2], yaw, -0.35), [back, Math.atan2(m[0], m[2])]);
  await shot('yard');
}

let list = null;
for (let k = 0, tries = 0; ; k++) {
  // a renderer the shared machine's memory took (`Target crashed`) is booted again, three times a target at the most
  let s = null;
  try {
    s = await boot();
  } catch (err) {
    console.log(`boot: ${String(err?.message ?? err).split('\n')[0]}`);
    if (++tries > 3) break;
    k--;
    continue;
  }
  list ??= (await targetsOf(s.ev)).filter((t) => !ONLY.length || ONLY.includes(t.name));
  if (k === 0 && !tries)
    console.log(`targets: ${list.map((t) => `${t.name}@${t.px},${t.py}${t.place ? ` (${t.place})` : ''}`).join(' ')}`);
  const t = list[k];
  try {
    if (t) await shoot(s, t);
    tries = 0;
  } catch (err) {
    console.log(`${t?.name}: ${String(err?.message ?? err).split('\n')[0]}`);
    if (/Target crashed|has been closed|Target closed/.test(String(err?.message)) && ++tries <= 3) {
      await s.browser.close().catch(() => {});
      k--;
      continue;
    }
    errors.push(`${t?.name}: ${err?.message ?? err}`);
    tries = 0;
  }
  await s.browser.close().catch(() => {});
  writeFileSync(join(OUT, 'stats.json'), JSON.stringify({ stats, errors: errors.slice(0, 40) }, null, 1));
  if (!t || k + 1 >= list.length) break;
}
await server.close();
// judged: every target photographed from each of its four poses, a door at each, and no page error on the way
const missed = (list ?? []).filter((t) => Object.keys(stats[t.name]?.poses ?? {}).length !== 4).map((t) => t.name);
if (!list?.length || missed.length || errors.length) {
  console.log(
    `FAIL: ${list?.length ?? 0} targets, ${missed.length} not photographed (${missed.join(' ')}), ${errors.length} errors: ${errors.slice(0, 3).join(' | ')}`,
  );
  process.exit(1);
}
console.log(`ok: ${list.length} targets photographed, no page errors`);
process.exit(0);
