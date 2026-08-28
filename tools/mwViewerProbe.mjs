// MW-IMPORT SLICE 2 LIVE PROOF: the whole path at once - fixture.bsa in
// through the picker, MwBsaFile -> parseNif -> flattenNif -> three.js,
// fixture.dds decoded and mapped - by asserting the four quadrant colors
// of the fixture texture actually reach pixels on screen. A green suite
// says every stage answers correctly in isolation; this says the wiring
// between them draws.
//
// Usage: node tools/mwViewerProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5219, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => {
  console.log(`${cond ? 'ok ' : 'FAIL'} ${label}`);
  if (!cond) fails.push(label);
};

await page.goto('http://localhost:5219/mw-viewer.html');
await page.setInputFiles('#file', 'test/fixtures/mw/fixture.bsa');
await page.waitForFunction(
  () => window.__mwviewer && (window.__mwviewer.loaded || window.__mwviewer.error),
  null,
  { timeout: 15000 },
);

// Deterministic pose for sampling: stop the spin, tip the pitch high so
// the up-facing quad fills the view.
await page.click('#spin');
// Straight down at the up-facing quad: four equal quadrants, even light.
await page.evaluate(() => window.__mwviewerView(0, 1.45));
const status1 = await page.textContent('#status');
console.log('status:', status1.replace('\n', ' | '));
ok(/1 batch, 2 tris, 1 textured/.test(status1), 'quad loads: 1 batch, 2 tris, textured');

// The pure texture path: plain.nif carries no vertex colors, so with
// apply mode 2 (MODULATE) the quadrants reach the screen unmixed.
await page.selectOption('#meshsel', 'meshes/fixture/plain.nif');
await page.evaluate(() => window.__mwviewerView(0, 1.45));
await page.waitForTimeout(600);
const shot = PNG.sync.read(await page.screenshot());
const counts = { red: 0, green: 0, blue: 0, white: 0 };
for (let i = 0; i < shot.data.length; i += 4) {
  const [r, g, b] = [shot.data[i], shot.data[i + 1], shot.data[i + 2]];
  if (r > 110 && g < 70 && b < 70) counts.red++;
  else if (g > 110 && r < 70 && b < 70) counts.green++;
  else if (b > 110 && r < 70 && g < 70) counts.blue++;
  else if (r > 165 && g > 165 && b > 165) counts.white++;
}
console.log('quadrant pixel counts:', counts);
for (const k of ['red', 'green', 'blue', 'white']) {
  ok(counts[k] > 200, `${k} quadrant of fixture.dds reaches the screen (${counts[k]}px)`);
}
writeFileSync('/tmp/mw-viewer-probe.png', PNG.sync.write(shot));
console.log('shot: /tmp/mw-viewer-probe.png');

// The skinned fixture: untextured path, bind-pose preview marker.
await page.selectOption('#meshsel', 'meshes/fixture/skinned.nif');
await page.waitForTimeout(300);
const status2 = await page.textContent('#status');
ok(/skinned \(bind-pose preview\)/.test(status2), 'skinned fixture loads as bind-pose preview');

ok(crashes.length === 0, `no pageerrors${crashes.length ? `: ${crashes[0]}` : ''}`);

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
