// AUDIT 19 F4: does a dungeon actually BOOT?
//
// The four scene hosts have zero execution coverage in node, so a crash
// in one is invisible to 990 passing tests. This drives the real boot in
// a real browser and reports any pageerror, the crash overlay, and
// whether music started.
//
// Usage: node tools/bootProbe.mjs [query]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const query = process.argv[2] || 'nomenu&class=1&novideo';
const server = await createServer({ server: { port: 5208, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /music|MIDI|unavailable/i.test(t)) errors.push(`[${m.type()}] ${t}`);
});

await page.goto(`http://localhost:5208/?${query}`);
await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 12000));
await page.mouse.click(640, 400);
await page.waitForTimeout(3000);

const state = await page.evaluate(async () => {
  const mod = await import('/src/systems/music.js');
  const aud = await import('/src/systems/audio.js');
  // Diagnose the archive directly through the app's own data seam.
  let probe = 'ok';
  try {
    const { fetchBytes } = await import('/src/scenes/shared.js');
    const b = await fetchBytes('MIDI.BSA');
    probe = `bytes=${b?.length} ctor=${b?.constructor?.name}`;
    const { MidiBsaFile } = await import('/src/formats/hmiFile.js');
    const m2 = new MidiBsaFile(); m2.load(b);
    probe += ` songs=${m2.getSongName(0)}`;
  } catch (e) { probe = 'THREW: ' + (e?.message ?? e); }
  // Decisive: ensure() is memoised, so awaiting it returns the SAME boot.
  // If enabled flips true here, the earlier read was simply too early.
  const { fetchBytes: fb } = await import('/src/scenes/shared.js');
  await mod.music.ensure(fb);
  const afterAwait = { enabled: mod.music.enabled, pending: mod.music._pending ?? null, bootError: mod.music.bootError ?? null };
  return { title: document.title, ready: window.__shotReady === true,
           music: mod.music.current, playing: !!mod.music.player?.playing,
           enabled: mod.music.enabled, pending: mod.music._pending ?? null,
           ctx: aud.audio.ctx ? aud.audio.ctx.state : 'none', probe, afterAwait };
});
console.log(JSON.stringify({ ...state, errors: errors.slice(0, 6) }, null, 2));
await browser.close();
await server.close();
