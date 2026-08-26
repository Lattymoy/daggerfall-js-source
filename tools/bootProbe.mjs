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
// T3: TWO lists, not one. This probe exists to answer "does a dungeon
// actually BOOT" - and it collected page errors and then exited 0
// whatever they said, so the crash it was written to catch would have
// been reported as a successful run.
//
// It cannot simply fail on everything it collects, and the first draft
// of this fix did, which the very first run disproved: the list
// deliberately greps for INFORMATIONAL music lines, and the browser
// logs a console error for any 404 - including CURSOR.IMG, which this
// port HANDLES ("the OS cursor stands in"). A handled 404 is not a
// crash. So `pageerror` - an uncaught exception - is the only console
// signal that decides the exit code; everything else is a note.
const crashes = [];
const notes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /music|MIDI|unavailable/i.test(t)) notes.push(`[${m.type()}] ${t}`);
});

await page.goto(`http://localhost:5208/play/?${query}`);
await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 12000));
await page.mouse.click(640, 400);
await page.waitForTimeout(3000);
// Optional: walk into a building and report the song on each side.
if (process.env.PROBE_ENTER) {
  const before = await page.evaluate(async () => (await import('/src/systems/music.js')).music.current);
  const what = await page.evaluate(process.env.PROBE_ENTER);
  await page.waitForTimeout(Number(process.env.PROBE_ENTER_WAIT ?? 2500));
  const after = await page.evaluate(async () => (await import('/src/systems/music.js')).music.current);
  console.log(`ENTER[${what}]: ${before} -> ${after} | mode=${await page.evaluate(() => window.__mode?.() ?? 'n/a')}`);
}

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
  // T3: the crash overlay the header promised to report. main.js
  // stands a `#crash` <pre> on any uncaught error or rejection, and it
  // is the ONE boot-failure signal that does not depend on the query.
  const crashEl = document.getElementById('crash');
  return { title: document.title, ready: window.__shotReady === true,
           crashOverlay: crashEl ? crashEl.textContent.slice(0, 300) : null,
           music: mod.music.current, playing: !!mod.music.player?.playing,
           enabled: mod.music.enabled, pending: mod.music._pending ?? null,
           ctx: aud.audio.ctx ? aud.audio.ctx.state : 'none', probe, afterAwait };
});
console.log(JSON.stringify({ ...state, crashes: crashes.slice(0, 6), notes: notes.slice(0, 6) }, null, 2));

// ...and what "it booted" actually means. THE READY FLAG IS NOT IT:
// `__shotReady` is set only in shot mode (exterior.js:1847 and its
// siblings all gate on `shotMode`), and this probe's default query is
// `nomenu&class=1&novideo` - so the first draft of this check failed a
// dungeon that had plainly booted, titled "Privateer's Hold - 5
// blocks, 303 draws" with music playing. Ask for it only when the
// query asked for a shot.
const verdict = [];
if (state.crashOverlay) verdict.push(`the crash overlay is up: ${state.crashOverlay.split('\n')[1] ?? ''}`);
if (crashes.length) verdict.push(`${crashes.length} uncaught error(s): ${JSON.stringify(crashes.slice(0, 3))}`);
if (state.afterAwait?.bootError) verdict.push(`music boot error: ${state.afterAwait.bootError}`);
// The title is the scene's own receipt - main.js writes the status
// line into it, and a host that died half-way never gets that far.
if (!/ - .+/.test(state.title ?? '')) verdict.push(`the scene set no status title: ${JSON.stringify(state.title)}`);
if (/shot/.test(query) && !state.ready) verdict.push('shot mode was asked for and __shotReady never came');
if (verdict.length) for (const v of verdict) console.log(`FAIL: ${v}`);
else console.log(`BOOT OK: ${query}`);

await browser.close();
await server.close();
process.exit(verdict.length ? 1 : 0);
