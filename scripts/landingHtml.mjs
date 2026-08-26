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
// page's own <style> only ever says var(--brass).
//
// The transform is a pure function over the html so the test can run
// it without Vite and assert the tokens on the page ARE the skin's.
import { readFileSync } from 'node:fs';
import { ENHANCED_TOKENS, ENHANCED_FONTS_URL } from '../src/ui/enhancedStyle.js';

/** The page this plugin is for - only the root document. `/play/index.html`
 *  is the game and gets nothing from here. */
export const LANDING_PATH = '/index.html';

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

/** What the page needs to be a landing page: a <style> holding the
 *  skin's tokens, the skin's font link, and the build stamp filled in.
 *  Returns Vite's { html, tags } shape. The stamp is a data attribute
 *  on the element the page styles as the build line, and the page hides
 *  it when empty, so a dev serve shows no stamp rather than a lie. */
export function transformLanding(html, { sha = '', tokens = ENHANCED_TOKENS, fontsUrl = ENHANCED_FONTS_URL } = {}) {
  // Every empty stamp on the page, not the first: the rail's foot hides
  // on a phone and the page's end carries the same line for that case.
  // A stamp that links to `.../commit/` gets the sha on the end of it.
  const stamped = sha
    ? html.replace(/<(\w+)([^>]*)\sdata-build=""([^>]*)>\s*<\/\1>/g,
      (_m, tag, pre, post) => {
        const linked = post.replace(/href="([^"]*\/commit\/)"/, (_h, base) => `href="${base}${sha}"`);
        return `<${tag}${pre} data-build="${sha}"${linked}>${sha}</${tag}>`;
      })
    : html;
  const ink = tokens.match(/--ink:\s*(#[0-9a-fA-F]{6})/)?.[1];
  return {
    html: stamped,
    tags: [
      { tag: 'style', attrs: { id: 'enhanced-tokens' }, children: tokens, injectTo: 'head-prepend' },
      // The phone's address bar takes the page's ground - read from the
      // same block rather than typed, so it cannot disagree with it.
      ...(ink ? [{ tag: 'meta', attrs: { name: 'theme-color', content: ink }, injectTo: 'head' }] : []),
      { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'stylesheet', href: fontsUrl }, injectTo: 'head' },
    ],
  };
}

export function landingHtml() {
  return {
    name: 'landing-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path !== LANDING_PATH) return html;
        // BUILD ONLY for the stamp, as build-tag-meta is: on a dev serve
        // src/buildTag.js holds whatever the last build left behind, and
        // a page that names a commit it was not built from is a lie.
        return transformLanding(html, { sha: ctx.server ? '' : readBuildSha() });
      },
    },
  };
}
