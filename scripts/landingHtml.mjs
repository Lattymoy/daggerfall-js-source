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
import { ENHANCED_TOKENS, FONT_BRAND, FONT_DATA, fontsUrl } from '../src/ui/enhancedStyle.js';

/** The landing page's own request: the brand face and the data face,
 *  through the skin's URL builder. The woff2 files Google serves are
 *  shared with the game by file URL, so the data face is fetched once
 *  for both pages whatever the css2 URL says. */
export const LANDING_FONTS_URL = fontsUrl([FONT_BRAND, FONT_DATA]);

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
