// SETT live probe: does the launcher come up before the game, draw the
// REAL settings, take input and persist a change?
//
// Reads window.__launcher (the screen's own state - the __talk/__climb
// house pattern) rather than guessing from a canvas: the first draft of
// this probe asserted on document.body.innerText, which is empty for a
// canvas app, so three of its four checks were meaningless and passed
// or failed for the wrong reasons.
//
// Usage: node tools/launcherProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5217, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; };

await page.goto('http://localhost:5217/?launcher&novideo');

// wait for the screen itself, not a clock
const upBy = Date.now() + 90000;
let state = null;
while (Date.now() < upBy) {
  state = await page.evaluate(() => (window.__launcher ? JSON.parse(window.__launcher()) : null));
  if (state?.up) break;
  await page.waitForTimeout(500);
}
check(!!state?.up, `the launcher is UP before the game (section ${state?.section ?? '-'})`);
if (!state?.up) { await browser.close(); await server.close(); process.exit(1); }

// it draws the real settings, with tiers
const tiers = new Set(state.rows.map((r) => r.tier));
check(state.rows.length > 0 && tiers.has('unavailable'),
  `it lists real settings WITH their tiers (${state.rows.length} rows, tiers: ${[...tiers].join('/')})`);

// the store behind it reports DFU's shipped defaults
const before = await page.evaluate(async () => {
  const m = await import('/src/systems/settings.js');
  return { voices: m.getBool('Enhancements', 'CombatVoices'), sens: m.getFloat('Controls', 'MouseLookSensitivity', 0.1, 4) };
});
check(before.voices === true && before.sens === 2,
  `the store reports DFU's defaults (CombatVoices=${before.voices}, sensitivity=${before.sens})`);

// drive the REAL keyed surface to a LIVE bool and toggle it
const findLive = async () => (await page.evaluate(() => JSON.parse(window.__launcher())))
  .rows.findIndex((r) => r.tier === 'live' && (r.value === 'True' || r.value === 'False'));
let idx = await findLive();
check(idx >= 0, `a LIVE toggle is on screen (row ${idx})`);
const cur = (await page.evaluate(() => JSON.parse(window.__launcher()))).cursor;
for (let i = 0; i < idx - cur; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60); }
const rowBefore = (await page.evaluate(() => JSON.parse(window.__launcher()))).rows[idx];
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
const rowAfter = (await page.evaluate(() => JSON.parse(window.__launcher()))).rows[idx];
check(rowBefore.value !== rowAfter.value,
  `a keypress CHANGED it on screen (${rowBefore.key}: ${rowBefore.value} -> ${rowAfter.value})`);

// ...the store agrees, and it persisted
const after = await page.evaluate(async () => {
  const m = await import('/src/systems/settings.js');
  const eff = m.effectiveSettings();
  const changed = [];
  for (const [sec, keys] of Object.entries(eff)) {
    for (const [k, v] of Object.entries(keys)) if (String(m.DEFAULTS[sec][k]) !== String(v)) changed.push(`${sec}/${k}=${v}`);
  }
  return { changed, stored: !!localStorage.getItem('dagger.settings.v1') };
});
check(after.changed.length > 0, `the STORE agrees (${after.changed.join(', ') || 'nothing changed'})`);
check(after.stored, 'and it persisted to storage');

// an UNAVAILABLE setting refuses WITH its reason rather than moving
await page.keyboard.press('BracketRight');   // any section; find an unavailable row
await page.waitForTimeout(200);
for (let s = 0; s < 13; s++) {
  const st = await page.evaluate(() => JSON.parse(window.__launcher()));
  const u = st.rows.findIndex((r) => r.tier === 'unavailable');
  if (u >= 0) {
    for (let i = 0; i < u - st.cursor; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(50); }
    const was = (await page.evaluate(() => JSON.parse(window.__launcher()))).rows[u].value;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const now = await page.evaluate(() => JSON.parse(window.__launcher()));
    check(now.rows[u].value === was && !!now.notice,
      `an unavailable setting REFUSES with its reason ("${(now.notice ?? '').slice(0, 52)}")`);
    break;
  }
  await page.keyboard.press('BracketRight');
  await page.waitForTimeout(150);
}

// Enter launches
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
const gone = await page.evaluate(() => JSON.parse(window.__launcher()));
check(gone.up === false, 'Enter LAUNCHED past the settings screen');

const real = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource|ANIM0001/.test(e));
check(real.length === 0, real.length ? `page errors: ${real.slice(0, 3).join(' | ')}` : 'zero page errors (the guarded CURSOR.IMG 404 filtered)');

await browser.close();
await server.close();
console.log(fails === 0 ? 'SETT LAUNCHER PROBE: ALL GREEN' : `SETT LAUNCHER PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
