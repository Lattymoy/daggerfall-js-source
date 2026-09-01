// THE BUILD MOVED WHILE THE PAGE WAS OPEN, in a real browser.
//
// A player reported `boot failed: Failed to fetch dynamically imported
// module` on the deployed site. Nothing was wrong with the build - a
// fresh one fetches every chunk - so no test that loads ONE build can
// see this. It only exists BETWEEN two of them:
//
//   index.html hard-references seventeen hashed chunk URLs. Every
//   deploy renames eight of them (main and the four enhanced screens
//   among them, because the build sha is stamped into a module main
//   imports). GitHub Pages DELETES the old artifact. main is
//   redeployed several times a day.
//
// So this probe builds the site TWICE and serves deploy N+1 while
// handing the browser deploy N's index.html on its first document -
// which is exactly what a returning player's cache does. The page
// starts, asks for a lazy chunk that is gone, and must RELOAD onto the
// current build rather than die.
//
// It needs no ARENA2: the failure and the recovery both happen before
// any game data is read.
//
//     node tools/staleChunkProbe.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const TAG = 'src/buildTag.js';
const savedTag = readFileSync(TAG, 'utf8');
const work = mkdtempSync(join(tmpdir(), 'stalechunk-'));

/** One build of the site, stamped with `sha` so its chunk hashes
 *  differ from the other's exactly as two deploys' do. */
function buildAs(sha, out) {
  writeFileSync(TAG, `export const BUILD_TAG = '${sha}';\n`);
  execFileSync('npx', ['vite', 'build'], { stdio: 'pipe' });
  cpSync('dist', out, { recursive: true });
}

/** A dead-simple static server: no caching headers of its own, so the
 *  only cache in play is the one this probe fakes on purpose. */
function serve(root, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = createServer((req, res) => {
    // A directory serves its index - the game is /play/ now (U60), and
    // GitHub Pages answers a trailing slash the same way.
    let path = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!path.startsWith(root) || !existsSync(path)) { res.statusCode = 404; return res.end('not found'); }
    const ext = path.slice(path.lastIndexOf('.'));
    res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
    res.end(readFileSync(path));
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

let server = null;
const browser = await chromium.launch();
try {
  const dN = join(work, 'deployN');
  const dN1 = join(work, 'deployN1');
  const site = join(work, 'site');
  buildAs('aaaaaaa', dN);
  buildAs('bbbbbbb', dN1);

  // THE SITE IS DEPLOY N+1 - the old artifact is gone, which is what
  // Pages does - plus the chunks deploy N's index names, because those
  // are the ones the returning player's browser already holds. What it
  // does NOT have is deploy N's LAZY chunks: never fetched on a first
  // visit, so never cached, and renamed by the newer deploy.
  cpSync(dN1, site, { recursive: true });
  const staleIndex = readFileSync(join(dN, 'play', 'index.html'), 'utf8');
  const freshIndex = readFileSync(join(dN1, 'play', 'index.html'), 'utf8');
  const named = [...new Set(staleIndex.match(/assets\/[A-Za-z0-9_-]+\.js/g) ?? [])];
  for (const f of named) if (!existsSync(join(site, f))) cpSync(join(dN, f), join(site, f));

  check('the two builds really differ', staleIndex !== freshIndex);
  check('deploy N\'s eager chunks are all present (the page can start)',
    named.every((f) => existsSync(join(site, f))), `${named.length} chunks`);

  server = await serve(site, 5299);
  const base = 'http://127.0.0.1:5299/play/';

  /** One visit. `recovers` says whether the page under test carries
   *  the reload; the control run proves the pin is not vacuous. */
  async function visit(label, firstDoc) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const page = await ctx.newPage();
    let docs = 0;
    const gone = [];
    await page.route('**/', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      docs++;
      // The FIRST document is the player's cache. Every one after it is
      // a real fetch - which is what a reload performs.
      await route.fulfill({
        status: 200, contentType: 'text/html', body: docs === 1 ? firstDoc : freshIndex,
      });
    });
    page.on('response', (r) => { if (r.status() === 404) gone.push(r.url().split('/').pop()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await new Promise((r) => setTimeout(r, 4000));
    const out = {
      docs,
      gone: [...new Set(gone)],
      mounted: await page.locator('#enhanced-menu .doorbtn').count(),
      body: (await page.evaluate(() => document.body.textContent)).trim(),
    };
    await ctx.close();
    return out;
  }

  // ── THE FAILURE IS REAL ────────────────────────────────────────
  const run = await visit('stale', staleIndex);
  check('a lazy chunk of the old build is 404 - the reported failure',
    run.gone.length > 0, run.gone.join(', ') || 'nothing 404d, the scenario did not arm');

  // ── AND THE PAGE RECOVERS ──────────────────────────────────────
  check('the page RELOADS onto the current build', run.docs === 2,
    `${run.docs} documents (1 = never reloaded)`);
  check('...and the front door mounts', run.mounted > 0);
  check('...on the NEW build, not the one that was cached',
    run.body.includes('bbbbbbb'), run.body.slice(0, 80));
  check('the player is never shown the browser\'s sentence',
    !/Failed to fetch dynamically imported module/i.test(run.body));

  // ── THE CONTROL: the same page with the recovery removed ───────
  // Without this the checks above pass for a build that simply never
  // had the problem, which is the vacuous shape this repo keeps
  // finding.
  const src = readFileSync('src/systems/staleChunk.js', 'utf8');
  try {
    writeFileSync('src/systems/staleChunk.js',
      src.replace("  if (!isStaleChunk(err)) return 'rethrow';\n  return reloaded ? 'explain' : 'reload';",
        "  return 'rethrow';   // control"));
    const dOld = join(work, 'deployOld');
    buildAs('aaaaaaa', dOld);
    // The control is a DIFFERENT build (its source differs), so its
    // own eager chunks have to be cached for it too - or the entry
    // itself 404s, the page never boots at all, and the check passes
    // for the wrong reason. That is what the first run of this probe
    // did: an empty body, and a control proving nothing.
    const controlIndex = readFileSync(join(dOld, 'play', 'index.html'), 'utf8');
    for (const f of new Set(controlIndex.match(/assets\/[A-Za-z0-9_-]+\.js/g) ?? [])) {
      if (!existsSync(join(site, f))) cpSync(join(dOld, f), join(site, f));
    }
    const control = await visit('control', controlIndex);
    check('CONTROL: it really booted (the entry was cached)', control.body.length > 0,
      'an empty body proves nothing - the page never ran');
    check('CONTROL: without the recovery the page dies', control.docs === 1 && control.mounted === 0,
      `${control.docs} documents, ${control.mounted} rail buttons`);
    check('CONTROL: ...with the exact error that was reported',
      /Failed to fetch dynamically imported module/i.test(control.body), control.body.slice(0, 100));
  } finally {
    writeFileSync('src/systems/staleChunk.js', src);
  }
} finally {
  writeFileSync(TAG, savedTag);
  server?.close();
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
