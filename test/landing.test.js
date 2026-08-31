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
import { ENHANCED_TOKENS, ENHANCED_FONTS_URL, ENHANCED_CSS, FONT_DATA, FONT_DISPLAY, FONT_PIXEL_BRAND, FONT_PIXEL_DATA, fontsUrl } from '../src/ui/enhancedStyle.js';
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
  // THE DA SITE CLEANUP (Mac, 2026-08-31) retired the pictures whole:
  // the U60c chain - three menu screens under public/site/, their
  // doctrine rows, tools/siteShots.mjs and the pins tying them
  // together - is gone, and the law got SIMPLER: this page carries no
  // raster at all. Its only drawings are CSS (the night, the gem, the
  // cup), which is the strongest shape of "a render of game data is
  // game data" a page about the game can hold.
  // <img\s, not <img: the Ko-fi comment SAYS "<img>" while explaining
  // why the cup is drawn in box-shadow instead of being one.
  assert.doesNotMatch(landing, /<img\s|<canvas|<video|<picture|url\(/i, 'the landing page draws nothing but CSS');
  assert.doesNotMatch(landing, /\.(png|jpe?g|gif|webp|svg|bmp)\b/i, 'no image file is referenced at all');
  assert.equal(execFileSync('git', ['ls-files', 'public/site'], { cwd: root, encoding: 'utf8' }).trim(), '',
    'public/site/ is empty - the retired pictures may not quietly return without re-earning their doctrine rows');
  assert.ok(!existsSync(join(root, 'tools/siteShots.mjs')), 'the shots tool went with its pictures');
  assert.doesNotMatch(landing, /\/src\//, 'the landing page reaches into no game code');
  assert.doesNotMatch(landing, /\.(BSA|IMG|CIF|COL|RSC|VID|DAT|PAK|SND|XMI|HMI)\b/, 'no ARENA2 file is named');
  // The door: one Play in the gate, one in the phone bar, both to ./play/.
  // U63: the door has ONE Play - the pixel face's one box, the About
  // plaque's own shape. (The old page had two: a gate button and a
  // phone bar, because the shell put them in different places.)
  const plays = [...landing.matchAll(/<a class="plaque" href="([^"]+)">Play<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(plays, ['./play/']);

  // The game page is the file that used to be index.html: the mobile
  // build's meta and the canvas's touch rule came with it.
  assert.match(game, /<canvas id="c"><\/canvas>/);
  assert.match(game, /<script type="module" src="\/src\/main\.js"><\/script>/);
  assert.match(game, /viewport-fit=cover, user-scalable=no/, 'the phone viewport meta (2026-08-13) moved with the game');
  assert.match(game, /#c \{[^}]*touch-action: none/, 'the touch-action canvas rule moved with the game');
  assert.ok(existsSync(join(root, 'play/index.html')));
});

test('U63: the landing page owns no colour - every one is the SKIN\'s, token or literal', () => {
  // U60's rule was "every colour is a var()", which held while the site
  // wore the enhanced shell's four tokens. PX1 made the menu PIXEL ART,
  // and the pixel face's palette is LITERALS in enhancedStyle.js -
  // rgb(243,239,44) over rgb(93,77,12), #d8cfae, #7d7460 - not tokens,
  // because they are a drawing's colours rather than a theme's. So the
  // rule is the same rule, stated where it now bites: every colour on
  // this page must be one the SKIN itself uses. A colour the game does
  // not have is the drift the injection exists to stop.
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.ok(css.length > 1000, 'the page carries its layout inline');
  const skin = read('src/ui/enhancedStyle.js');
  const norm = (c) => c.toLowerCase().replace(/\s+/g, '');
  const skinColours = new Set([
    ...[...skin.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => norm(m[0])),
    ...[...skin.matchAll(/rgba?\([^)]*\)/g)].map((m) => norm(m[0])),
  ]);
  const pageColours = [
    ...[...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => norm(m[0])),
    ...[...css.matchAll(/rgba?\([^)]*\)/g)].map((m) => norm(m[0])),
  ];
  assert.ok(pageColours.length > 10, 'the page does draw in colour');
  const foreign = [...new Set(pageColours)].filter((c) => !skinColours.has(c));
  assert.deepEqual(foreign, [], 'colours on the landing page that the skin does not use');
  // The tokens it does take are the skin's, and it declares none itself.
  const declared = new Set([...ENHANCED_TOKENS.matchAll(/--([\w-]+):/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1]));
  assert.ok(used.size >= 2, `the page uses the tokens (${[...used].join(', ')})`);
  for (const t of used) assert.ok(declared.has(t), `var(--${t}) is not a token the skin declares`);
  assert.doesNotMatch(css, /^\s*--[\w-]+:/m, 'the landing declares no custom property - the skin does');
  // U63: and it is set in the PIXEL faces, which is what the menu wears.
  assert.match(css, /font-family: 'Pixelify Sans', monospace/, 'the body face is the menu\'s list face');
  assert.match(css, /font-family: 'Jacquard 12', var\(--brand\)/, 'and the headings are the menu\'s wordmark face');
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
  // PX1: the pixel faces (Jacquard 12 + Pixelify Sans) folded into
  // the SAME request - one request is the Ledger row's own claim.
  assert.equal(ENHANCED_FONTS_URL, fontsUrl([FONT_DISPLAY, FONT_DATA, FONT_PIXEL_BRAND, FONT_PIXEL_DATA]));
  // MEASURED beside the pin: still exactly one URL, and it names
  // all four families.
  assert.equal((ENHANCED_FONTS_URL.match(/family=/g) || []).length, 4);
  assert.equal(ENHANCED_FONTS_URL,
    'https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;600&family=Barlow+Semi+Condensed:wght@400;500;600&family=Jacquard+12&family=Pixelify+Sans:wght@400;500&display=swap',
    'the skin\'s request is these bytes exactly - PX1 added the two pixel faces; the landing\'s brand face still adds nothing to it');
  // U63: the site takes THAT request, whole - one URL, one cache entry,
  // and no way for the site to be set in a face the game does not have.
  // It used to take a subset (brand + data), because the site was set in
  // Grenze Gotisch and the menu was not; PX1 made the menu pixel art and
  // U63 made the site follow.
  assert.equal(LANDING_FONTS_URL, ENHANCED_FONTS_URL, 'one request for both pages');
  assert.equal(LANDING_FONTS_URL, fontsUrl([FONT_DISPLAY, FONT_DATA, FONT_PIXEL_BRAND, FONT_PIXEL_DATA]));
  assert.match(FONT_PIXEL_BRAND, /^Jacquard\+12/);
  assert.match(FONT_PIXEL_DATA, /^Pixelify\+Sans/);
  assert.match(ENHANCED_TOKENS, /--brand: 'Grenze Gotisch'/, 'the --brand token stays as the wordmark face\'s fallback');
  assert.match(landing, /h1, h2, h3 \{ font-family: 'Jacquard 12', var\(--brand\)/, 'the headings are the menu\'s wordmark face, with --brand behind it');
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
  // U63: the door's foot is the home face's THREE ZONES - build and the
  // test count on the left, the line count dead centre, Source on the
  // right - and the page's end carries the build alone. So the figures
  // appear once each, not twice, and the stamp is what appears twice.
  assert.deepEqual(cells, [['tests', figure(tests)], ['lines', figure(lines)]],
    'the foot carries both figures, once each');
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
  assert.match(read('tools/landingProbe.mjs'), /waitForSelector\('\.px-menu button'/,
    'and the one that may drive the root goes on to the game - the PIXEL home now (U63)');
  // And the tools that read the built game page read it from its home.
  assert.match(read('tools/verify-deploy.mjs'), /readFile\('dist\/play\/index\.html'/);
  // U64: the live site is the custom domain now. The path is what this
  // pin is for - the verifier must poll the GAME, one directory down -
  // and the host follows the domain.
  assert.match(read('tools/verify-deploy.mjs'), /'https:\/\/daggerfalljs\.dev\/play\/'/);
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

// ── U63: THE SITE WEARS THE GAME'S FACE ───────────────────────────
// Mac: "update our website, reorganized and bring it inline with our new
// UI." PX1 made the enhanced menu pixel art - a Bayer-dithered night, a
// Jacquard 12 blackletter wordmark, Pixelify Sans lists, the classic
// shadowed-label pair - and the site was still wearing the shell it
// replaced, down to three screenshots of a menu that no longer exists.
import { groundCss, groundStars, GROUND_RAMP, GROUND_SEED } from '../scripts/landingHtml.mjs';

test('U63: the night is the MENU\'s night - pixelGround\'s ramp, seed and star law, in CSS', () => {
  // The page is a DOCUMENT: it cannot run pixelGround.js, and that is a
  // pin above. So the same sky is BUILT - and the constants are pinned
  // against pixelGround's own text, because a sky that drifts from the
  // menu's is worse than no sky at all.
  const ground = read('src/ui/pixelGround.js');
  for (const c of GROUND_RAMP) assert.ok(ground.includes(c), `${c} is pixelGround's own ramp step`);
  assert.match(ground, new RegExp(`let seed = 0x${GROUND_SEED.toString(16)}`), 'and the same seed');
  assert.match(ground, /seed \* 1664525 \+ 1013904223/, 'and the same LCG');
  assert.match(read('scripts/landingHtml.mjs'), /seed = \(seed \* 1664525 \+ 1013904223\) >>> 0\) \/ 0x100000000/);
  assert.match(read('scripts/landingHtml.mjs'), /const n = Math\.round\(\(W \* H\) \/ 1440\);/, 'and the same density law');
  // Deterministic, in the upper half, and at the menu's own count for a
  // 1920x1080 viewport: (480*270)/1440 = 90.
  const stars = groundStars(1920, 1080);
  assert.equal(stars.length, 90);
  assert.deepEqual(groundStars(1920, 1080), stars, 'the same sky every build');
  // ...and it is THE MENU'S sky, not merely a deterministic one: the
  // first star lands where pixelGround's own stream puts it, which is
  // what makes the seed a shared law rather than a shared style.
  const first = (seed) => {
    let s0 = seed; const rnd = () => (s0 = (s0 * 1664525 + 1013904223) >>> 0) / 0x100000000;
    return [(rnd() * 480) | 0, (rnd() * 270 * 0.55) | 0];
  };
  const [fx, fy] = first(GROUND_SEED);
  assert.equal(stars[0], `${fx * 4}px ${fy * 4}px 0 0 rgb(200,200,190)`, 'the first star is pixelGround\'s first star');
  const ys = stars.map((s) => Number(s.split(' ')[1].replace('px', '')));
  assert.ok(Math.max(...ys) <= 1080 * 0.56, 'the field is the upper half, as pixelGround draws it');
  // The whole ground as one block: ramp, fog, dither, stars.
  const css = groundCss(1920, 1080);
  for (const c of GROUND_RAMP) assert.ok(css.includes(c), 'the ramp is in the gradient');
  assert.equal((css.match(/radial-gradient/g) ?? []).length, 2, 'two fog blobs, as the menu has');
  assert.match(css, /repeating-linear-gradient\(0deg[^)]*\) 0 2px/, 'the dither is a 2px checker');
  assert.match(css, /\.night::after \{[\s\S]*box-shadow:/, 'and the stars are one box-shadow list');
  assert.doesNotMatch(css, /url\(/, 'no image, on a page that may not carry one');
  // ...injected, not typed into the page.
  const out = transformLanding(landing, {});
  const block = out.tags.find((t) => t.tag === 'style' && t.attrs.id === 'pixel-ground');
  assert.ok(block?.children.includes(GROUND_RAMP[0]), 'the ground is injected beside the tokens');
  assert.doesNotMatch(landing, /repeating-linear-gradient|box-shadow: \d+px \d+px 0 0 rgb/, 'and the page itself holds no sky');
  assert.match(landing, /\.night \{ position: fixed; inset: 0; z-index: -1; \}/, 'the page just declares where it goes');
});

test('U63: the page is the pixel face\'s own idioms, not the shell it replaced', () => {
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const skin = read('src/ui/enhancedStyle.js');
  // The shell is GONE: no rail, no two-column grid, no .act buttons.
  for (const dead of ['.shell', '.railbtn', '.side {', '.pane {', '.act.primary', '.thumb']) {
    assert.ok(!css.includes(dead), `${dead} belongs to the shell the menu replaced`);
  }
  // The idioms it took instead, each one the menu's own:
  assert.match(css, /\.rule::before, \.rule::after \{ content: ''; flex: 1; height: 2px;/, 'the rule');
  assert.match(skin, /\.px-rule::before, \.px-rule::after \{ content: ''; flex: 1; height: 2px;/, '...which is the menu\'s rule');
  assert.match(css, /0 -4px 0 var\(--brass\), 0 4px 0 var\(--brass\)/, 'the gem, drawn as a box-shadow cross');
  assert.match(skin, /0 -4px 0 var\(--brass\), 0 4px 0 var\(--brass\)/, '...which is the menu\'s gem');
  assert.match(css, /letter-spacing: 0\.5em; text-indent: 0\.5em/, 'the wordmark\'s tracked sub-line');
  assert.match(css, /rgb\(243,239,44\)/, 'the classic shadowed-label pair, for what is live');
  assert.match(css, /text-shadow: 2px 2px 0 rgb\(93,77,12\)/);
  assert.match(skin, /color: rgb\(243,239,44\); text-shadow: 2px 2px 0 rgb\(93,77,12\)/, '...which is the menu\'s pair');
  // TWO box SHAPES, and both are plaques: the .plaque rule (worn by
  // the door's Play/Install pair - DA shipped the downloadable app
  // and its Install stands beside Play, same shape) and the Ko-fi
  // mark at the top right - the same shape the About plaque has on
  // the home face, which is what makes a box read as a plaque here.
  // Nothing else on the page declares a box.
  const boxes = (css.match(/border: 2px solid #7d7460/g) ?? []).length;
  assert.equal(boxes, 2, 'the plaque shape and the Ko-fi mark - no third box rule');
  assert.match(css, /\.plaque \{/);
  assert.match(css, /\.kofi \{/);
  // The door's pair, exactly: Play into the browser, Install onto the
  // desk, in that order, both wearing the one plaque shape.
  const doorPlaques = [...landing.matchAll(/<a class="plaque" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(doorPlaques, [
    ['Play', './play/'],
    ['Install', 'https://github.com/Lattymoy/daggerfall-js-source/releases/latest'],
  ], 'the door carries Play and Install, and nothing else wears the plaque');
  assert.match(skin, /\.px-about \{[\s\S]{0,400}border: 2px solid #7d7460/, '...which is the About plaque\'s own shape');
  // The foot is the home face's three zones.
  assert.match(css, /grid-template-columns: 1fr auto 1fr/, 'build left, a figure centre, Source right');
  assert.match(skin, /\.px-foot \{[\s\S]{0,200}grid-template-columns: 1fr auto 1fr/, '...which is the menu\'s foot');
});

test('U63: the fi ligature is off - "files" is not "Ales", on the site AND in the game', () => {
  // Pixelify Sans ships an `fi` ligature whose glyph reads as a capital
  // A. Caught on this page's first render and magnified: "files" read
  // "Ales", "first" read "Arst". Every enhanced screen is set in this
  // face, so the fix is at the root of both.
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.match(css, /font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;/);
  const skin = read('src/ui/enhancedStyle.js');
  const shell = skin.slice(skin.indexOf('.shell { font-family:'), skin.indexOf('.shell { font-family:') + 600);
  assert.match(shell, /font-variant-ligatures: none/, 'the enhanced shell');
  const home = skin.slice(skin.indexOf('.px-home {'), skin.indexOf('.px-home {') + 400);
  assert.match(home, /font-variant-ligatures: none/, 'and the pixel home');
});

// (U63's pictures test retired with the pictures themselves - the DA
// site cleanup; the no-raster law above is its successor.)

// ── U64: THE DOMAIN, AND THE HAT ──────────────────────────────────
test('U64: the Ko-fi mark is a plaque with a drawn cup, near the top, and it is the only ask', () => {
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  // ONE link, and one in the credits with a reason attached - not a
  // banner, not a badge, and not an <img>: an image would be the page's
  // only raster, and a raster is the one thing this site does not carry.
  const asks = [...landing.matchAll(/href="(https:\/\/ko-fi\.com\/[\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(asks, ['https://ko-fi.com/dfjs', 'https://ko-fi.com/dfjs'], 'the mark, and the credits line');
  assert.match(landing, /<a class="kofi" href="https:\/\/ko-fi\.com\/dfjs" rel="noopener">/);
  assert.doesNotMatch(landing, /<img[^>]*ko-fi/i, 'no badge image');
  // Near the top, out of the wordmark's way, and a thumb's target.
  assert.match(css, /\.kofi \{[\s\S]{0,200}position: absolute; top: 0; right: 0;/);
  assert.match(css, /\.kofi \{[\s\S]{0,400}min-height: 44px;/);
  assert.match(css, /\.door \{ padding-bottom: 140px; padding-top: 84px; \}/, 'and the door makes room for it on a phone');
  // The cup is DRAWN: one box-shadow pixel list, in the skin's own brass
  // and dim, on the same 4px grid the rest of the page uses.
  const cup = css.slice(css.indexOf('.cup {'), css.indexOf('.cup {') + 900);
  assert.match(cup, /box-shadow:/);
  const px = (cup.match(/-?\d+px -?\d+px 0 (var\(--brass\)|#7d7460)/g) ?? []);
  assert.ok(px.length >= 9, `${px.length} shadow pixels drawn (the element itself is the tenth)`);
  assert.ok(px.filter((p) => p.includes('#7d7460')).length === 2, 'two of them are steam');
  for (const p of px) {
    const [x, y] = p.split(' ').slice(0, 2).map((v) => Math.abs(Number(v.replace('px', ''))));
    assert.equal(x % 2, 0, `${p}: on the grid`);
    assert.equal(y % 2, 0, `${p}: on the grid`);
  }
  assert.ok(cup.includes('#7d7460'), 'the steam is dim, not brass');
});

test('U64: the live site is the custom domain, and the build does not care which', () => {
  // `base: './'` means the SAME build serves from a project path and
  // from an apex, so the domain moved with no rebuild - which is why
  // the vite comment says so rather than naming a host.
  assert.match(read('vite.config.js'), /base is '\.\/' - RELATIVE, so the same build serves from a project path/);
  assert.match(read('vite.config.js'), /base: '\.\/',/);
  assert.match(read('README.md'), /Play it: https:\/\/daggerfalljs\.dev\//);
  assert.match(read('tools/verify-deploy.mjs'), /'https:\/\/daggerfalljs\.dev\/play\/'/);
  // The page's own links are RELATIVE, so nothing on it names a host at
  // all - the domain could move again and the page would not notice.
  const internal = [...landing.matchAll(/href="(\.\/[^"]*)"/g)].map((m) => m[1]);
  assert.ok(internal.includes('./play/'), 'Play is relative');
  assert.doesNotMatch(landing, /https?:\/\/(daggerfalljs\.dev|lattymoy\.github\.io)/, 'the page names no host of its own');
});
