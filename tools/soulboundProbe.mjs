import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = process.env.SOULBOUND_EVIDENCE;
if (!out) throw new Error('Set SOULBOUND_EVIDENCE to the output directory');
const server = await createServer({
  cacheDir: '.vite-soulbound',
  server: { host: '127.0.0.1', port: 5289, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const results = [];
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:5289/tools/fixtures/soulbound-probe.html');
    await page.waitForFunction(() => !!window.fixture && !!window.view);
    await page.evaluate(() => {
      window.fixture.breakRepeatedly();
      window.view.repaint();
    });
    assert.equal(await page.evaluate(() => window.fixture.spawns()), 1);
    assert.equal(await page.evaluate(() => window.fixture.plain.currentCondition), 1);
    assert.equal(await page.evaluate(() => window.fixture.reloadAndBreak()), true);
    assert.equal(await page.evaluate(() => window.fixture.spawns()), 1);
    await page.getByRole('button', { name: /^Magic/ }).click();
    await page.locator('.itemrow').filter({ hasText: 'Soulbound Blade' }).first().click();
    await page.getByRole('button', { name: 'Info', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Item information' });
    await dialog.waitFor();
    const released = dialog.locator('p').filter({ hasText: '(released)' });
    assert.equal(await released.count(), 1);
    const fit = await released.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        text: node.textContent,
      };
    });
    assert.ok(
      fit.left >= 0 && fit.right <= viewport.width && fit.top >= 0 && fit.bottom <= viewport.height,
      JSON.stringify(fit),
    );
    assert.ok(fit.scrollWidth <= fit.clientWidth + 1, 'release label fits without horizontal clipping');
    await page.screenshot({ path: `${out}/soulbound-ui-${viewport.width}.png` });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await dialog.count(), 0);
    assert.deepEqual(errors, []);
    results.push({ viewport, checks: 9, passed: true, fit, errors });
    await page.close();
  }
} finally {
  writeFileSync(`${out}/browser-ui.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(results));
