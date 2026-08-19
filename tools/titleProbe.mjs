// U21c: the title screen, proved by a real boot and a real click.
//
// The menu path is the BARE url, so there is no __shotReady flag to wait
// on (that belongs to the scene hosts) - this probe waits for the status
// line instead, which runTitle/runMenu set as they hand off.
//
// It shoots THREE frames: the title screen, the menu it advances to on a
// click, and - with the logo file moved aside - the boot with no logo at
// all, which must land on the menu directly rather than on a black hole.
// The NEVER TRAPS law is the one worth a live proof; a pin can only
// assert that runTitle returns early, not that the boot survives it.
//
// Usage: node tools/titleProbe.mjs [outdir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, renameSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2] || '/tmp/title';
const LOGO = new URL('../public/logo.png', import.meta.url).pathname;
const HIDDEN = `${LOGO}.hidden`;

const server = await createServer({ server: { port: 5203, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding'],
});

const shoot = async (label, { click = false } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', (m) => console.log(`[${label}]`, m.text()));
  page.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message));
  await page.goto('http://localhost:5203/');
  await page.waitForTimeout(2500);
  const status = await page.evaluate(() => document.title);
  if (click) {
    await page.mouse.click(700, 450);
    await page.waitForTimeout(1500);
  }
  const after = await page.evaluate(() => document.title);
  await page.screenshot({ path: `${out}-${label}.png` });
  console.log(`${label}: status=${JSON.stringify(status)} -> ${JSON.stringify(after)}  ${out}-${label}.png`);
  await page.close();
};

if (existsSync(LOGO)) {
  await shoot('title');
  await shoot('menu', { click: true });
  renameSync(LOGO, HIDDEN);
} else {
  console.log('no public/logo.png - shooting the missing-asset arm only');
}
try {
  await shoot('nologo');
} finally {
  if (existsSync(HIDDEN)) renameSync(HIDDEN, LOGO);
}

await browser.close();
await server.close();
