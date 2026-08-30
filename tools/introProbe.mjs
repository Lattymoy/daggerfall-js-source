// U65 THE INTRO — the live probe.
//
// Everything in test/intro.test.js is a node test over pure functions,
// and none of it proves the intro DRAWS. This drives the real page in a
// real browser and reads pixels back, because that is the only place
// the questions this file asks can be answered:
//
//   - does the enhanced door actually put the intro in front of it?
//   - does the flyover reach the screen, or is it a black canvas?
//   - do the three splashes appear, in order, at their bars?
//   - does the menu come up underneath when it is over?
//   - does a keypress skip it?
//   - and does it run on a phone?
//
// It needs NO ARENA2, which is the whole point of the slice - so unlike
// most probes in this directory it runs anywhere, on any checkout.
//
// THE CLOCK IS THE PROBLEM AND THE OVERRIDE IS THE ANSWER. Headless
// Chromium will not autoplay audio, so the intro falls to its wall
// clock and runs in real time - thirty seconds per assertion, and a
// SwiftShader frame rate that makes "wait 19 s then screenshot" a
// coin toss about which bar you land on. `?introat=<bar>` freezes the
// intro at one bar so a frame can be read deliberately. It is a probe
// hook and it says so; it does nothing without a bar.

import { chromium, devices } from 'playwright';
import { createServer } from 'vite';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'test-harness/intro';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

/** Read the canvas back as pixels. Not a screenshot: a screenshot of a
 *  2D canvas is fine, but going through the canvas itself means a
 *  failure says "the canvas is black" rather than "the page is black",
 *  which are different bugs. */
async function canvasStats(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#intro canvas');
    if (!c) return null;
    const g = c.getContext('2d');
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    let sum = 0, distinct = new Set(), topSum = 0, botSum = 0, n = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        const l = (data[o] + data[o + 1] + data[o + 2]) / 3;
        sum += l; n++;
        if (distinct.size < 200) distinct.add(`${data[o]},${data[o + 1]},${data[o + 2]}`);
        if (y < height * 0.3) topSum += l; else if (y > height * 0.7) botSum += l;
      }
    }
    return { w: c.width, h: c.height, mean: sum / n, tones: distinct.size, top: topSum, bottom: botSum };
  });
}

async function splashOpacities(page) {
  return page.evaluate(() => {
    const out = {};
    for (const img of document.querySelectorAll('#intro img')) {
      const key = (img.getAttribute('src') || '').split('/').pop().replace('.webp', '');
      out[key] = Number(img.style.opacity || 0);
    }
    return out;
  });
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
  await server.listen();
  const base = 'http://localhost:5199/play/';
  const browser = await chromium.launch();

  try {
    // ── 1. The intro mounts in front of the enhanced door ──────────
    let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // A sandbox with no cert store cannot fetch the menu's webfont;
      // that is this machine's networking, not the intro. Only
      // resource-load failures against REMOTE origins are excused -
      // anything from our own server, and any real page error, still
      // fails the run.
      const url = m.location()?.url ?? '';
      const offsite = /^https?:\/\//.test(url) && !url.includes('localhost');
      if (offsite && /Failed to load resource/.test(m.text())) return;
      errors.push(m.text());
    });

    await page.goto(`${base}?introat=2.6`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#intro canvas', { timeout: 20000 });
    check('the intro mounts in front of the enhanced door', true);

    const atBar = async (bar) => {
      await page.goto(`${base}?introat=${bar}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#intro canvas', { timeout: 20000 });
      await page.waitForTimeout(900);
    };

    // ── 2. The flyover reaches the screen ──────────────────────────
    await page.waitForTimeout(1200);
    const s = await canvasStats(page);
    check('the canvas has a buffer', !!s && s.w > 64, s ? `${s.w}x${s.h}` : 'no canvas');
    check('the flyover is not black', !!s && s.mean > 20, s ? `mean ${s.mean.toFixed(1)}` : '');
    // A dithered posterised picture over sky and land. A single flat
    // fill - the failure mode where the ray walk never ran - would come
    // back with a handful of tones.
    check('the picture is a picture, not a fill', !!s && s.tones > 12, s ? `${s.tones}+ tones` : '');
    // The order proof moved off the opening frame: at bar 2.6 the shot
    // is DESIGNED around the sun's path on the water, so the bottom
    // third out-shines the sky and 'sky brighter than ground' fails a
    // correct picture for being the intended picture. Measured at
    // 3.6/3.9/4.2 (climbing, sun over the ranges) the premise holds
    // with margin, so the check reads its own frame there.
    await atBar(3.9);
    const sc = await canvasStats(page);
    check('sky above, world below (bar 3.9, on the climb)',
      !!sc && sc.top > sc.bottom, sc ? `top ${(sc.top / 1000) | 0}k vs bottom ${(sc.bottom / 1000) | 0}k` : '');

    // ── 3. THE LOGO'S THREE BEATS, read off the real element ───────
    // The transform is the trajectory; reading it back is how a probe
    // checks a position rather than an opacity. y comes out of the
    // translate's calc() as the vh-fraction term the host wrote.
    const logoState = () => page.evaluate(() => {
      const img = [...document.querySelectorAll('#intro img')]
        .find((i) => (i.getAttribute('src') || '').includes('title'));
      if (!img) return null;
      // The y term is the SECOND calc; sign and magnitude are separate
      // tokens because that is how the host must write them (see the
      // sign-is-spelled note in introScreen) - so the probe reads the
      // same grammar it enforces.
      const m = /calc\(-50% (-|\+) ([\d.]+)px\)\) scale/.exec(img.style.transform);
      return {
        opacity: Number(img.style.opacity || 0),
        yPx: m ? Number(m[2]) * (m[1] === '-' ? -1 : 1) : null,
        vh: innerHeight,
      };
    });
    // The deck, mid-climb: white wall, no logo yet.
    await atBar(4.85);
    const s48 = await canvasStats(page);
    check('bar 4.85: inside the deck - the picture is white',
      !!s48 && s48.mean > 200, `mean ${s48?.mean?.toFixed(0)}`);

    // THE BURST: one bar-fraction past the hit, the province is there.
    await atBar(5.2);
    const s52 = await canvasStats(page);
    check('bar 5.2: burst - the map is on screen, the white is gone',
      !!s52 && s52.mean < 200 && s52.tones > 12, `mean ${s52?.mean?.toFixed(0)}, ${s52?.tones}+ tones`);
    writeFileSync(`${OUT}/bar-5.2-burst.png`, await page.screenshot());

    // THE DROP, over the finished map.
    await atBar(11.75);
    let lg = await logoState();
    check('bar 11.75: the logo is FALLING - visible, above centre',
      !!lg && lg.opacity === 1 && lg.yPx < -0.1 * lg.vh, JSON.stringify(lg));
    writeFileSync(`${OUT}/bar-11.75-drop.png`, await page.screenshot());

    await atBar(12);
    lg = await logoState();
    check('bar 12: THE SLAM - dead centre on the first big beat',
      !!lg && lg.opacity === 1 && Math.abs(lg.yPx) < 8, JSON.stringify(lg));
    const op12 = await splashOpacities(page);
    check('bar 12: the credits are gone', (op12.interkarma ?? 0) === 0 && (op12.nexus ?? 0) === 0);
    writeFileSync(`${OUT}/bar-12-slam.png`, await page.screenshot());

    // Landed and HOLDING, two bars later.
    await atBar(13.6);
    lg = await logoState();
    check('bar 13.6: landed and holding', !!lg && lg.opacity === 1 && Math.abs(lg.yPx) < 8, JSON.stringify(lg));

    // ── 4. The credits at their bars ───────────────────────────────
    for (const [bar, key] of [[2.9, 'interkarma'], [7.0, 'nexus']]) {
      await atBar(bar);
      const op = await splashOpacities(page);
      check(`bar ${bar} shows ${key} alone`,
        op[key] === 1 && Object.entries(op).every(([k, v]) => k === key || v === 0 || k === 'title'),
        JSON.stringify(op));
      writeFileSync(`${OUT}/bar-${bar}-${key}.png`, await page.screenshot());
    }

    // ── 5. A keypress skips it, and the menu is there ──────────────
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#intro canvas', { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    await page.waitForSelector('#enhanced-menu', { timeout: 10000 });
    const gone = await page.$('#intro');
    check('a keypress skips to the menu', !gone);
    writeFileSync(`${OUT}/after-skip.png`, await page.screenshot());

    // ── 6. ?nointro goes straight to the menu ──────────────────────
    await page.goto(`${base}?nointro`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#enhanced-menu', { timeout: 20000 });
    check('?nointro skips the intro entirely', !(await page.$('#intro')));

    check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    // ── 7. It runs on a phone ──────────────────────────────────────
    const phone = await browser.newContext({ ...devices['Pixel 5'] });
    const pp = await phone.newPage();
    await pp.goto(`${base}?introat=12`, { waitUntil: 'domcontentloaded' });
    await pp.waitForSelector('#intro canvas', { timeout: 20000 });
    await pp.waitForTimeout(1200);
    const ps = await canvasStats(pp);
    check('the phone draws the flyover', !!ps && ps.mean > 20, ps ? `${ps.w}x${ps.h} mean ${ps.mean.toFixed(1)}` : '');
    // THE PIXEL IS SQUARE BY CONSTRUCTION, and a portrait phone is
    // where pixelGround learned that: the buffer's aspect must follow
    // the VIEWPORT's, or every star was a vertical streak.
    const vp = pp.viewportSize();
    const bufAR = ps ? ps.w / ps.h : 0, viewAR = vp.width / vp.height;
    check('the buffer keeps the viewport aspect', Math.abs(bufAR - viewAR) < 0.06,
      `buffer ${bufAR.toFixed(2)} vs view ${viewAR.toFixed(2)}`);
    // A tap skips on touch, or the intro is a wall on a phone - the
    // exact shape of AUDIT 24's severe finding about the launcher.
    await pp.tap('#intro');
    await pp.waitForSelector('#enhanced-menu', { timeout: 10000 });
    check('a tap skips on a phone', !(await pp.$('#intro')));
    writeFileSync(`${OUT}/phone-bar-12.png`, await pp.screenshot());
    await phone.close();
  } finally {
    await browser.close();
    await server.close();
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed; shots in ${OUT}/`);
  if (bad.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
