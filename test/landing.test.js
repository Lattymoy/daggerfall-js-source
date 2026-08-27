// U60 - THE DOOR IN FRONT OF THE DOOR.
//
// index.html at the root of the site is a page about the game: what it
// is, how to play, credits, Play. The game is one directory down at
// /play/. What is pinned here is the shape of that arrangement:
//
//   - the landing page is a DOCUMENT. It mounts no game code, draws no
//     canvas, carries no image and names no game file - the doctrine's
//     "a render of game data is game data" has nothing to catch on it;
//   - it has NO PALETTE OF ITS OWN. Every colour in its stylesheet is a
//     var() the enhanced skin declares, and the block that declares them
//     is injected from src/ui/enhancedStyle.js at serve and build - one
//     source, as the skin's own header demands;
//   - the game page kept everything the mobile build put in index.html
//     (the viewport meta, the touch-action canvas) when it moved;
//   - EVERY TOOL FOLLOWED THE MOVE. Eighty-odd probes drove the game at
//     the root; one left behind would spend a session proving a landing
//     page cannot swing a sword.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { ENHANCED_TOKENS, ENHANCED_FONTS_URL, ENHANCED_CSS, FONT_BRAND, FONT_DATA, FONT_DISPLAY, fontsUrl } from '../src/ui/enhancedStyle.js';
import { transformLanding, LANDING_PATH, LANDING_FONTS_URL, countTests, countSrcLines, figure } from '../scripts/landingHtml.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const landing = read('index.html');
const game = read('play/index.html');

// ── THE TWO DOCUMENTS ─────────────────────────────────────────────
test('U60: the root document is a page about the game, and the game is at /play/', () => {
  // A document, not a host. No module, no canvas, no picture, no
  // reference into src/ - and no game file named (the data folder is
  // named, which is the point of the page; its files are not).
  assert.doesNotMatch(landing, /<script/i, 'the landing page runs no script');
  assert.doesNotMatch(landing, /<canvas|<video|<picture|url\(/i, 'the landing page draws nothing but its pictures');
  // U60c: THE PICTURES. Every image on the page is one the doctrine
  // allow-list admits by name, tracked under public/site/, and made by
  // tools/siteShots.mjs - the tool that refuses to run with game data.
  const imgs = [...landing.matchAll(/<img\s[^>]*src="([^"]+)"[^>]*>/g)];
  assert.ok(imgs.length >= 3, 'the site shows its pictures');
  const allow = read('test/doctrine.test.js');
  const shots = read('tools/siteShots.mjs');
  const tracked = execFileSync('git', ['ls-files', 'public/site'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const [tag, src] of imgs) {
    assert.match(src, /^\.\/site\/[\w-]+\.png$/, `${src}: pictures live under ./site/ and nowhere else`);
    const file = `public/${src.slice(2)}`;
    assert.ok(tracked.includes(file), `${file} is tracked`);
    assert.ok(allow.includes(`['${file}', 'OURS - `), `${file} has an OURS row on the doctrine allow-list`);
    assert.ok(shots.includes(`'${src.match(/([\w-]+)\.png$/)[1]}'`), `${file} is made by tools/siteShots.mjs`);
    assert.match(tag, /\swidth="\d+"\s+height="\d+"/, `${src} declares its size (no layout shift)`);
    assert.match(tag, /\salt="[^"]{20,}"/, `${src} is described`);
  }
  // And the tool's guard is what makes the rows true.
  assert.match(shots, /delete process\.env\.ARENA2_PATH/, 'the tool drops the data folder');
  assert.match(shots, /probe\.status !== 404[\s\S]*process\.exit\(2\)/, 'the tool aborts if the dev server can serve one game file');
  assert.match(shots, /locator\('#pick'\)\.count\(\)\)[\s\S]*throw new Error/, 'the tool aborts if the folder pick is on screen');
  assert.doesNotMatch(landing, /\.(jpe?g|gif|webp|svg|bmp)\b/i, 'no other image file is referenced');
  assert.doesNotMatch(landing, /\/src\//, 'the landing page reaches into no game code');
  assert.doesNotMatch(landing, /\.(BSA|IMG|CIF|COL|RSC|VID|DAT|PAK|SND|XMI|HMI)\b/, 'no ARENA2 file is named');
  // The door: one Play in the gate, one in the phone bar, both to ./play/.
  const plays = [...landing.matchAll(/<a class="act primary" href="([^"]+)">Play<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(plays, ['./play/', './play/']);

  // The game page is the file that used to be index.html: the mobile
  // build's meta and the canvas's touch rule came with it.
  assert.match(game, /<canvas id="c"><\/canvas>/);
  assert.match(game, /<script type="module" src="\/src\/main\.js"><\/script>/);
  assert.match(game, /viewport-fit=cover, user-scalable=no/, 'the phone viewport meta (2026-08-13) moved with the game');
  assert.match(game, /#c \{[^}]*touch-action: none/, 'the touch-action canvas rule moved with the game');
  assert.ok(existsSync(join(root, 'play/index.html')));
});

test('U60: the landing page owns no colour - every one is a token the skin declares', () => {
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.ok(css.length > 1000, 'the page carries its layout inline');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'no hex colour in the landing stylesheet');
  assert.doesNotMatch(css, /\b(rgba?|hsla?)\(/, 'no literal colour function either');
  const declared = new Set([...ENHANCED_TOKENS.matchAll(/--([\w-]+):/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1]));
  assert.ok(used.size >= 6, `the page uses the tokens (${[...used].join(', ')})`);
  for (const t of used) assert.ok(declared.has(t), `var(--${t}) is not a token the skin declares`);
  // And the page never declares one of its own.
  assert.doesNotMatch(css, /--[\w-]+:/, 'the landing declares no custom property - the skin does');
});

// ── THE SEAM ──────────────────────────────────────────────────────
test('U60: the injected block IS the skin\'s token block, and the skin still wears it', () => {
  // The skin's stylesheet is composed from the same export, so the menu
  // and the landing page cannot hold two different values of --brass.
  assert.ok(ENHANCED_CSS.includes(ENHANCED_TOKENS), 'ENHANCED_CSS must be composed from ENHANCED_TOKENS');
  assert.match(ENHANCED_TOKENS, /^:root \{[\s\S]*--brass: #c08a3e;[\s\S]*\}$/);
  assert.match(read('src/ui/enhancedStyle.js'), /link\.href = ENHANCED_FONTS_URL;/,
    'injectEnhancedFonts must use the exported URL, not a second literal');

  const out = transformLanding(landing, { sha: 'abc1234' });
  const style = out.tags.find((t) => t.tag === 'style');
  assert.equal(style?.children, ENHANCED_TOKENS, 'the style tag carries the token block verbatim');
  assert.equal(style?.injectTo, 'head-prepend', 'tokens land before the page\'s own <style>');
  const fonts = out.tags.find((t) => t.tag === 'link' && t.attrs.rel === 'stylesheet');
  assert.equal(fonts?.attrs.href, LANDING_FONTS_URL, 'the fonts request is composed, not typed');
  // U60b: the brand face. The skin's URL is unchanged by the addition -
  // the game loads nothing it does not use - and both URLs come out of
  // the same builder over the same family strings.
  assert.equal(ENHANCED_FONTS_URL, fontsUrl([FONT_DISPLAY, FONT_DATA]));
  assert.equal(ENHANCED_FONTS_URL,
    'https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;600&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap',
    'the skin\'s request is byte-identical to what it was before the brand face existed');
  assert.equal(LANDING_FONTS_URL, fontsUrl([FONT_BRAND, FONT_DATA]));
  assert.match(FONT_BRAND, /^Grenze\+Gotisch:wght@/);
  assert.match(ENHANCED_TOKENS, /--brand: 'Grenze Gotisch'/, 'the face is a token the skin declares');
  assert.match(landing, /h1, h2, h3 \{ font-family: var\(--brand\)/, 'and every heading on the page is set in it');
  const ink = ENHANCED_TOKENS.match(/--ink:\s*(#[0-9a-f]{6})/)?.[1];
  const theme = out.tags.find((t) => t.tag === 'meta' && t.attrs.name === 'theme-color');
  assert.equal(theme?.attrs.content, ink, 'the phone\'s address bar reads the ink token');
  // The tab icon is the section fitting, drawn from the same two tokens.
  const icon = out.tags.find((t) => t.tag === 'link' && t.attrs.rel === 'icon');
  const svg = decodeURIComponent(icon?.attrs.href.replace(/^data:image\/svg\+xml,/, '') ?? '');
  const brass = ENHANCED_TOKENS.match(/--brass:\s*(#[0-9a-f]{6})/)?.[1];
  assert.ok(svg.includes(`fill="${ink}"`) && svg.includes(`fill="${brass}"`), 'the icon is ink and brass, from the tokens');
  assert.match(svg, /<path d="M16 5l11 11-11 11L5 16z"/, 'a diamond');
});

test('U60: the build stamp fills every stamp on the page, links the commit, and stays empty unstamped', () => {
  const out = transformLanding(landing, { sha: 'abc1234' });
  const stamps = [...out.html.matchAll(/<a class="build" data-build="([^"]*)" href="([^"]*)">([^<]*)<\/a>/g)];
  assert.equal(stamps.length, 2, 'the rail foot and the page end each carry one');
  for (const [, data, href, text] of stamps) {
    assert.equal(data, 'abc1234');
    assert.equal(text, 'abc1234');
    assert.ok(href.endsWith('/commit/abc1234'), href);
  }
  const bare = transformLanding(landing, { sha: '' });
  assert.equal(bare.html, landing, 'no sha, no stamp - the page is left as written');
  assert.match(landing, /\.build:empty, \.stat:empty \{ display: none; \}/, 'and an empty stamp or figure is invisible');

  // U60c: THE LEDGER STRIP. Two figures beside the sha, COUNTED from the
  // tree: the suite by the manifest gate's own definition, the port by
  // tracked lines of JS under src/. Filled in every data-stat element
  // (the rail foot and the page end), grouped digits.
  const tests = countTests(join(root, 'test'));
  const suite = read('bible/09-Testing/Testing.md').match(/Suite: (\d+) tests across/)?.[1];
  assert.equal(String(tests), suite, 'the strip counts what Testing.md pins (test/manifest.test.js holds the other half)');
  const lines = countSrcLines((p) => read(p));
  assert.ok(lines > 100000, `tracked src/ JS is ${lines} lines`);
  const shown = transformLanding(landing, { stats: { tests, lines } }).html;
  const cells = [...shown.matchAll(/<span class="stat" data-stat="(\w+)">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(cells, [['tests', figure(tests)], ['lines', figure(lines)], ['tests', figure(tests)], ['lines', figure(lines)]],
    'both strips carry both figures');
  assert.equal(figure(122323), '122,323');
  assert.match(landing, /\.stat\[data-stat="tests"\]::after \{ content: ' tests'; \}/);
  assert.match(landing, /\.stat\[data-stat="lines"\]::after \{ content: ' lines of JS'; \}/);
});

test('U60: the plugin is wired, touches only the root document, and stamps only a build', async () => {
  const viteConfig = (await import('../vite.config.js')).default;
  const plugin = viteConfig.plugins.find((p) => p?.name === 'landing-html');
  assert.ok(plugin, 'vite.config.js must carry the landing-html plugin');
  const handler = plugin.transformIndexHtml.handler;
  const gamePage = handler('<html>game</html>', { path: '/play/index.html' });
  assert.equal(gamePage.html, '<html>game</html>', 'the game page\'s markup is untouched');
  assert.deepEqual(gamePage.tags.map((t) => [t.tag, t.attrs.rel]), [['link', 'icon']],
    'the game page gets the tab icon from this plugin and nothing else');
  assert.equal(handler('<html>proto</html>', { path: '/menu.html' }), '<html>proto</html>',
    'a prototype page gets nothing');
  const dev = handler(landing, { path: LANDING_PATH, server: {} });
  assert.ok(dev.tags.some((t) => t.tag === 'style'), 'the dev serve gets the tokens');
  assert.doesNotMatch(dev.html, /data-build="[0-9a-f]+"/, 'the dev serve gets NO stamp - src/buildTag.js is whatever the last build left');
  assert.match(dev.html, /data-stat="tests">[\d,]+</, 'but it gets the figures, which are true whenever counted');
  const sha = readFileSync(join(root, 'src/buildTag.js'), 'utf8').match(/'([^']*)'/)?.[1];
  const built = handler(landing, { path: LANDING_PATH });
  assert.ok(built.html.includes(`data-build="${sha}"`), 'a build is stamped with the sha scripts/buildTag.mjs wrote');
});

// ── THE LINKS ─────────────────────────────────────────────────────
test('U60: every link on the landing page goes somewhere', () => {
  const hrefs = [...landing.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 10);
  for (const h of hrefs) {
    if (h.startsWith('#')) {
      assert.match(landing, new RegExp(`id="${h.slice(1)}"`), `anchor ${h} has a target`);
    } else if (h.startsWith('./')) {
      const file = h === './' ? 'index.html' : join(h, 'index.html');
      assert.ok(existsSync(join(root, file)), `${h} resolves to a page in the repo`);
    } else {
      assert.match(h, /^https:\/\//, `${h} is neither a page here nor https`);
    }
  }
  // The credit the doctrine requires of anything public-facing.
  assert.match(landing, /github\.com\/Interkarma\/daggerfall-unity/, 'Daggerfall Unity is credited');
  assert.match(landing, /MIT licence/);
});

// ── EVERY TOOL FOLLOWED THE MOVE ──────────────────────────────────
test('U60: no probe drives the root as if it were the game', () => {
  // The game's URL, in every shape a probe writes it, must be /play/.
  // Module imports (/src/...), the data mount (/arena2/) and the
  // prototype pages (chargen.html, menu.html) still live at the root
  // and are not matched here.
  const rootAsGame = /(?:localhost|127\.0\.0\.1):(?:\d+|\$\{[A-Za-z_]+\})\/(?=[?'"`$])|\$\{BASE\}\/(?=[?'"`])/;
  // One tool drives the root ON PURPOSE - the landing page's own probe,
  // which then presses Play and expects the game one directory down.
  const DRIVES_THE_LANDING = new Set(['landingProbe.mjs']);
  const offenders = [];
  for (const f of readdirSync(join(root, 'tools')).filter((n) => n.endsWith('.mjs') && !DRIVES_THE_LANDING.has(n))) {
    const src = read(join('tools', f));
    src.split('\n').forEach((line, i) => { if (rootAsGame.test(line)) offenders.push(`tools/${f}:${i + 1}`); });
  }
  assert.deepEqual(offenders, [], 'these drive the landing page and expect a game');
  assert.match(read('tools/landingProbe.mjs'), /goto\(`\$\{BASE\}\/play\/`|waitForSelector\('#enhanced-menu/,
    'and the one that may drive the root goes on to the game');
  // And the tools that read the built game page read it from its home.
  assert.match(read('tools/verify-deploy.mjs'), /readFile\('dist\/play\/index\.html'/);
  assert.match(read('tools/verify-deploy.mjs'), /lattymoy\.github\.io\/daggerfall-js-source\/play\//);
  assert.match(read('tools/staleChunkProbe.mjs'), /join\(dN, 'play', 'index\.html'\)/);
  assert.match(read('tools/screenshot.mjs'), /localhost:5199\/play\/\?\$\{query\}/);
});

test('U60: the dev server answers the game\'s relative data fetch from /play/', async () => {
  // dataSource fetches ./arena2/<name> relative to its document. From
  // /play/ that is /play/arena2/<name>; the probes' direct imports still
  // fetch /arena2/<name>. The SAME handler must sit behind both mounts,
  // and it must serve the folder - proven against a fake one holding a
  // fake file, so no game data is involved.
  const fake = mkdtempSync(join(tmpdir(), 'u60-arena2-'));
  writeFileSync(join(fake, 'ART_PAL.COL'), 'not a palette');
  process.env.ARENA2_PATH = fake;
  try {
    // Fresh module instance: the plugin reads ARENA2_PATH when created.
    const viteConfig = (await import(`../vite.config.js?u60=${Date.now()}`)).default;
    const plugin = viteConfig.plugins.find((p) => p?.name === 'arena2-dev-server');
    const mounts = [];
    plugin.configureServer({ middlewares: { use: (mount, fn) => mounts.push([mount, fn]) } });
    assert.deepEqual(mounts.map(([m]) => m), ['/arena2', '/play/arena2']);
    for (const [mount, fn] of mounts) {
      const body = [];
      const res = new Writable({ write(chunk, _e, cb) { body.push(chunk); cb(); } });
      res.setHeader = () => {};
      res.statusCode = 200;
      await new Promise((resolve) => { res.on('finish', resolve); fn({ url: '/art_pal.col' }, res, () => resolve()); });
      assert.equal(Buffer.concat(body).toString(), 'not a palette', `${mount} serves the folder (case-blind)`);
    }
  } finally {
    delete process.env.ARENA2_PATH;
    rmSync(fake, { recursive: true, force: true });
  }
});
