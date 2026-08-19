// U22: the splash, proved by a real boot.
//
// Shoots ANIM0001.VID mid-play and again after it hands over, then the
// ?novideo arm. The frame it captures has to be a DECODED VIDEO FRAME,
// not a black canvas - a reader that parks on a bad block (the preserved
// DFU quirk) would still leave the page "running", so the probe measures
// the pixels rather than trusting that nothing threw.
//
// Usage: node tools/splashProbe.mjs [outprefix]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2] || '/tmp/splash';

const server = await createServer({ server: { port: 5204, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding',
         '--autoplay-policy=no-user-gesture-required'],
});

const shoot = async (label, { query = '', wait = 3000 } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message));
  page.on('console', (m) => { const t = m.text(); if (/splash|VID|error|warn/i.test(t)) console.log(`[${label}]`, t); });
  await page.goto(`http://localhost:5204/${query}`);
  await page.waitForTimeout(wait);
  const title = await page.evaluate(() => document.title);
  // Report the context state AND how many audio blocks the player has
  // actually scheduled - a context that exists but schedules nothing is
  // the bug this probe was written for.
  const snd = await page.evaluate(async () => {
    const aud = await import('/src/systems/audio.js');
    const ctx = aud.audio.ctx;
    if (!ctx) return 'none';
    return `${ctx.state} clips=${window.__vidClips ?? 0}`;
  }).catch(() => 'n/a');
  await page.screenshot({ path: `${out}-${label}.png` });
  console.log(`${label}: ${JSON.stringify(title)} audio=${snd} -> ${out}-${label}.png`);
  await page.close();
};

await shoot('playing', { wait: 3000 });
await shoot('later', { wait: 9000 });
await shoot('novideo', { query: '?novideo', wait: 3000 });

await browser.close();
await server.close();
