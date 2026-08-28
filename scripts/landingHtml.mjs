// THE LANDING PAGE'S BUILD SEAM (U60).
//
// index.html at the site root is a page in front of the game: what it
// is, how to play, credits, Play. It is a static document - it mounts
// no game code, so it cannot call injectEnhancedStyle() - and it has
// to be the SAME product as the menu behind it, which is exactly the
// drift the skin module was written to stop. So the page carries no
// palette and no font URL of its own. This plugin puts the skin's
// ENHANCED_TOKENS block and ENHANCED_FONTS_URL into it at serve/build
// time, the way build-tag-meta puts the sha into every page, and the
// page's own <style> only ever says var(--brass). Its fonts are the
// skin's BRAND face and DATA face through the skin's own URL builder.
//
// The transform is a pure function over the html so the test can run
// it without Vite and assert the tokens on the page ARE the skin's.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ENHANCED_TOKENS, ENHANCED_FONTS_URL } from '../src/ui/enhancedStyle.js';

/** U63: the landing page asks for THE SKIN'S OWN REQUEST, not a subset.
 *  It used to load the brand + data faces, because the site was set in
 *  Grenze Gotisch and the menu was not; PX1 made the menu pixel art and
 *  U63 made the site follow, so both now want Jacquard 12 and Pixelify
 *  Sans. One URL for both pages means one cache entry and no way for the
 *  site to be set in a face the game does not have. */
export const LANDING_FONTS_URL = ENHANCED_FONTS_URL;

/** The page this plugin is for - only the root document. `/play/index.html`
 *  is the game and gets nothing from here but the icon. */
export const LANDING_PATH = '/index.html';
export const GAME_PATH = '/play/index.html';

/** THE ICON: the section fitting - a brass diamond on ink - as an SVG
 *  data URI, drawn from the tokens so it cannot disagree with the
 *  page. No file, so nothing for the doctrine allow-list to weigh. */
export function iconTag(tokens = ENHANCED_TOKENS) {
  const hex = (name) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  const ink = hex('ink'); const brass = hex('brass');
  if (!ink || !brass) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`
    + `<rect width="32" height="32" fill="${ink}"/><path d="M16 5l11 11-11 11L5 16z" fill="${brass}"/></svg>`;
  return { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `data:image/svg+xml,${encodeURIComponent(svg)}` }, injectTo: 'head' };
}

/** The build sha `scripts/buildTag.mjs` stamped at prebuild, or '' when
 *  it has not run (a dev serve - the stamp is build-only and nothing
 *  verifies dev). Shared with build-tag-meta, which used to read it
 *  itself. */
export function readBuildSha(read = (p) => readFileSync(p, 'utf8')) {
  try {
    return read('src/buildTag.js').match(/'([^']*)'/)?.[1] ?? '';
  } catch {
    return '';
  }
}

/* ── THE LEDGER STRIP (U60c) ──────────────────────────────────
   Two figures beside the sha, COUNTED at build rather than typed:
   the size of the suite and the size of the port. Both come from the
   tree the build is made of, the way the sha does, so the page can
   never claim a number the repository does not hold. The test count
   uses the manifest gate's own definition (test/manifest.test.js:
   top-of-line `test(` calls in test/*.test.js), which that gate pins
   equal to bible/09-Testing/Testing.md - so the strip, the doc and
   the runner agree or the suite is red. */
export function countTests(dir = 'test', read = (p) => readFileSync(p, 'utf8')) {
  let n = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.test.js')) continue;
    n += (read(`${dir}/${f}`).match(/^test\(/gm) || []).length;
  }
  return n;
}

/** Lines of JavaScript under src/ - TRACKED files only (`git ls-files`),
 *  so a scratch file or the build's own stamp cannot inflate it. */
export function countSrcLines(read = (p) => readFileSync(p, 'utf8')) {
  const files = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.js'));
  let n = 0;
  for (const f of files) n += read(f).split('\n').length - 1;
  return n;
}

/** The figures as the page shows them: grouped digits, no decimals. */
export const figure = (n) => new Intl.NumberFormat('en-US').format(n);

/* ── THE NIGHT, IN CSS (U63, 2026-08-27) ──────────────────────────
   The menu's home face stands on `ui/pixelGround.js`: a vertical
   gradient quantized through a six-step RAMP by 4x4 Bayer thresholds,
   two drifting fog blobs, and stars scattered on a seeded LCG so every
   load sees the same sky. The landing page cannot run it - it is a
   DOCUMENT, with no script and no canvas, and that is a pin - so the
   same sky is built here out of CSS and injected: the ramp as a
   hard-stopped gradient, the blobs as two radial gradients at the same
   relative homes, the dither as a 2px checker, and the stars as a
   box-shadow list from THE SAME SEED AND THE SAME LCG. The constants
   are pinned against pixelGround's own text, so the site's sky cannot
   drift from the menu's. What it does not have is the drift and the
   twinkle: those need a clock, and a clock needs a script. */
export const GROUND_RAMP = ['#07080d', '#0b0d14', '#10141d', '#161c27', '#1e2632', '#28313f'];
export const GROUND_SEED = 0xda66e4;

/** pixelGround's own generator, at the page's scale: the upper 55% of
 *  the sky, density by area, a bright quarter. Returns CSS box-shadow
 *  parts, deterministic for a given size. */
export function groundStars(w = 1920, h = 1080, scale = 4) {
  const W = Math.ceil(w / scale), H = Math.ceil(h / scale);
  let seed = GROUND_SEED;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const n = Math.round((W * H) / 1440);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (rnd() * W) | 0, y = (rnd() * H * 0.55) | 0;
    const bright = rnd() < 0.25;
    rnd();                                  // the phase draw, kept so the stream matches pixelGround's
    const b = bright ? 200 : 120;
    out.push(`${x * scale}px ${y * scale}px 0 0 rgb(${b},${b},${b - 10})`);
  }
  return out;
}

/** The whole ground as one <style> block: ramp, fog, dither, stars. */
export function groundCss(w, h) {
  const stops = GROUND_RAMP.map((c, i) => {
    const a = Math.round((i / GROUND_RAMP.length) * 100), b = Math.round(((i + 1) / GROUND_RAMP.length) * 100);
    return `${c} ${a}% ${b}%`;
  }).join(', ');
  return `.night {
  background:
    radial-gradient(46% 34% at 78% 35%, rgba(40,49,63,0.55) 0%, transparent 100%),
    radial-gradient(58% 42% at 30% 72%, rgba(40,49,63,0.75) 0%, transparent 100%),
    linear-gradient(180deg, ${stops});
}
.night::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 2px, transparent 2px 4px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 2px, transparent 2px 4px);
}
.night::after {
  content: ''; position: absolute; left: 0; top: 0; width: 4px; height: 4px;
  pointer-events: none; border-radius: 0;
  box-shadow: ${groundStars(w, h).join(', ')};
}`;
}

/** What the page needs to be a landing page: a <style> holding the
 *  skin's tokens, the skin's font link, and the build stamp filled in.
 *  Returns Vite's { html, tags } shape. The stamp is a data attribute
 *  on the element the page styles as the build line, and the page hides
 *  it when empty, so a dev serve shows no stamp rather than a lie. */
export function transformLanding(html, {
  sha = '', tokens = ENHANCED_TOKENS, fonts = LANDING_FONTS_URL, stats = null,
} = {}) {
  // Every empty stamp on the page, not the first: the rail's foot hides
  // on a phone and the page's end carries the same line for that case.
  // A stamp that links to `.../commit/` gets the sha on the end of it.
  let stamped = sha
    ? html.replace(/<(\w+)([^>]*)\sdata-build=""([^>]*)>\s*<\/\1>/g,
      (_m, tag, pre, post) => {
        const linked = post.replace(/href="([^"]*\/commit\/)"/, (_h, base) => `href="${base}${sha}"`);
        return `<${tag}${pre} data-build="${sha}"${linked}>${sha}</${tag}>`;
      })
    : html;
  // The ledger figures: every `data-stat="tests"` / `data-stat="lines"`
  // element gets its number. Absent figures leave the element empty,
  // and the page hides an empty one, as it hides an empty stamp.
  for (const [key, value] of Object.entries(stats ?? {})) {
    stamped = stamped.replace(new RegExp(`<(\\w+)([^>]*)\\sdata-stat="${key}"([^>]*)>\\s*<\\/\\1>`, 'g'),
      (_m, tag, pre, post) => `<${tag}${pre} data-stat="${key}"${post}>${figure(value)}</${tag}>`);
  }
  const ink = tokens.match(/--ink:\s*(#[0-9a-fA-F]{6})/)?.[1];
  return {
    html: stamped,
    tags: [
      { tag: 'style', attrs: { id: 'enhanced-tokens' }, children: tokens, injectTo: 'head-prepend' },
      // A viewport, not a page: `.night` is fixed, so the field covers
      // one screen. 1920x1080 gives the same 90 stars pixelGround draws
      // at that size - the same law at the same density.
      { tag: 'style', attrs: { id: 'pixel-ground' }, children: groundCss(1920, 1080), injectTo: 'head' },
      // The phone's address bar takes the page's ground - read from the
      // same block rather than typed, so it cannot disagree with it.
      ...(ink ? [{ tag: 'meta', attrs: { name: 'theme-color', content: ink }, injectTo: 'head' }] : []),
      ...(iconTag(tokens) ? [iconTag(tokens)] : []),
      { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'stylesheet', href: fonts }, injectTo: 'head' },
    ],
  };
}

export function landingHtml() {
  return {
    name: 'landing-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path === GAME_PATH) return { html, tags: [iconTag()].filter(Boolean) };   // the tab's mark, nothing else
        if (ctx.path !== LANDING_PATH) return html;
        // BUILD ONLY for the stamp, as build-tag-meta is: on a dev serve
        // src/buildTag.js holds whatever the last build left behind, and
        // a page that names a commit it was not built from is a lie.
        return transformLanding(html, {
          sha: ctx.server ? '' : readBuildSha(),
          // Counted fresh on every serve and build: they are true whenever
          // they are counted, unlike the sha, which is true only of a build.
          stats: { tests: countTests(), lines: countSrcLines() },
        });
      },
    },
  };
}
