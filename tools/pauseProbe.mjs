// I3: the pause window LIVE - Escape opens OPTN00I0 in the dungeon
// host, the sound bar writes, N declines the exit confirm, Continue
// closes, Escape toggles. Frame-synced like the fleet.
import { chromium } from 'playwright';
import { createServer } from 'vite';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5209, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto('http://localhost:5209/?nomenu&class=0&novideo&shot&play');
await page.waitForFunction(() => window.__frame > 5, { timeout: 120000 });
const frames = async (n) => {
  const f0 = await page.evaluate(() => window.__frame ?? 0);
  for (let i = 0; i < 100; i++) { await page.waitForTimeout(150); if (await page.evaluate(() => window.__frame ?? 0) >= f0 + n) break; }
};
await frames(5);
const overlay = () => page.evaluate(() => JSON.parse(window.__overlay() ?? 'null'));
const out = { steps: {} };
out.steps.boot = await overlay();
await page.keyboard.press('Escape');
await frames(2);
out.steps.open = await overlay();
// the sound bar: a quarter-click writes 0.25 (OPTN00I0 is 150x84 ->
// panelX 85). NOT the mid-point: 0.5 IS the ini default and the
// sparse store drops default-equal writes, which made the first
// version of this probe read the default back and call it proof.
// The store persists ON CLOSE (the saveSettings latch = DFU's OnPop).
await page.evaluate(() => window.__overlayClick(85 + 6.15 + 109.1 * 0.25, 40 + 23.2 + 2));
await frames(1);
// exit -> confirm -> N declines
await page.evaluate(() => window.__overlayClick(85 + 101 + 2, 40 + 4 + 2));
await frames(1);
await page.evaluate(() => window.__overlayKey('KeyN'));
await frames(1);
out.steps.declined = await overlay();
// Escape toggles closed
await page.keyboard.press('Escape');
await frames(2);
out.steps.closed = await overlay();
out.steps.sound = await page.evaluate(() => JSON.parse(localStorage.getItem('dagger.settings.v1') ?? '{}').Controls?.SoundVolume ?? null);
// and reopens
await page.keyboard.press('Escape');
await frames(2);
out.steps.reopened = await overlay();
// I4: the CONTROLS door, a live rebind, and the round trip back.
// Reopen, click CONTROLS (5,60 inside the panel), rebind MoveForwards
// (the grid's first button at 57,13) to KeyP, then CONTINUE (240,190)
// and confirm the registry persisted it.
await page.evaluate(() => window.__overlayClick(85 + 5 + 2, 40 + 60 + 2));
await frames(2);
out.steps.controls = await overlay();
await page.evaluate(() => window.__overlayClick(57 + 2, 13 + 2));   // MoveForwards
await frames(1);
await page.evaluate(() => window.__overlayKey('KeyP'));
await frames(1);
await page.evaluate(() => window.__overlayClick(240 + 2, 190 + 2));  // CONTINUE
await frames(2);
out.steps.backToPause = await overlay();
out.steps.rebound = await page.evaluate(() => JSON.parse(localStorage.getItem('dagger.keybinds') ?? '{}').actionKeyBinds?.KeyP ?? null);
out.steps.oldGone = await page.evaluate(() => JSON.parse(localStorage.getItem('dagger.keybinds') ?? '{}').actionKeyBinds?.KeyW ?? null);
await page.keyboard.press('Escape');
await frames(2);

out.ok = !!(out.steps.boot === null
  && out.steps.open && out.steps.open.kind === 'PauseOptionsWindow'
  && out.steps.sound === '0.25'
  && out.steps.declined && out.steps.declined.kind === 'PauseOptionsWindow'
  && out.steps.closed === null
  && out.steps.reopened && out.steps.reopened.kind === 'PauseOptionsWindow'
  && out.steps.controls && out.steps.controls.kind === 'ControlsWindow'
  && out.steps.backToPause && out.steps.backToPause.kind === 'PauseOptionsWindow'
  && out.steps.rebound === 'MoveForwards'
  && out.steps.oldGone === null
  && errors.length === 0);
out.errors = errors.slice(0, 6);
console.log(JSON.stringify(out, null, 2));
await browser.close(); await server.close();
process.exit(out.ok ? 0 : 1);
