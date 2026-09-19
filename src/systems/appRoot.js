// THE SITE ROOT, off a module's own URL - and nothing else in here.
//
// An asset in `public/` is served at `<root>/...`, and a bare relative
// path is resolved against the DOCUMENT. The game's document is
// `/play/index.html`, so `art/held-map.png` asked for
// `/play/art/held-map.png`, the host answered with the page itself,
// the decode failed and the map window stood with no parchment: ink on
// black (MAP-FIELD, 2026-09-18, Mac: "The sprite I gave to be used is
// nowhere to be seen at all"). The build's `base` is './', so there is
// no absolute path to hardcode either.
//
// AUDIT-THUNDERLOCK F7: the port's own weapon walked into the same
// hole four weeks later - its sheet and its icons were fetched against
// `document.baseURI`, which is right on the lab's page and wrong in
// the game, so the weapon would have drawn nothing and shown no icon
// under `/play/`. Twice is a law, so the law moved here, out of a
// 700-line window module that nothing in combat/ can afford to import.
// ui/heldMap.js re-exports it and reads the same as it always did.

/** MAP-FIELD (2026-09-18, Mac: "The sprite I gave to be used is nowhere
 *  to be seen at all"): THE SITE ROOT, READ OFF THIS MODULE.
 *
 *  The sprite lives in `public/`, so it is served at `<root>/art/held-map.png`.
 *  A bare relative `art/held-map.png` is resolved against the DOCUMENT,
 *  and the game's document is `/play/index.html` - so the browser asked
 *  for `/play/art/held-map.png`, the host answered with the page itself,
 *  the decode failed, `onload` never fired, and the window stood with no
 *  parchment and no hands: ink on black. The build's `base` is './', so
 *  there is no absolute path to hardcode either.
 *
 *  The MODULE's own URL knows where the root is under any base: a build
 *  serves it from `<root>/assets/`, the dev server from `<root>/src/`.
 *  Cutting that segment off gives the root, and the sprite hangs off it.
 *  Pure, so the pin can drive it with the shapes both lanes produce. */
export function appRootFrom(moduleUrl) {
  let u;
  // AUDIT-FIELD F4: a module URL that cannot be a base (blob:, data:)
  // has no pathname to cut, and `new URL('art/...', it)` THROWS - at
  // module evaluation, in a file scenes/world.js imports statically
  // through travelMapDoor.js, so the throw would not cost the map, it
  // would cost the whole scene. There is no root to find in such a URL.
  try { u = new URL(moduleUrl); } catch { return null; }
  if (!u.pathname.startsWith('/')) return null;   // an opaque path: cannot-be-a-base
  u.search = ''; u.hash = '';
  // AUDIT-FIELD F3: THE LAST such segment, not the first. JS regex
  // matching is leftmost-first, and `.*$` being greedy only decides the
  // tail - so the first cut cut at the FIRST `/assets/` or `/src/` on
  // the path. Unpack `dist/` into `~/public_html/assets/dfjs/` - or any
  // tree with a directory named exactly `assets` or `src` above the
  // build's own - and `/assets/dfjs/assets/main-x.js` collapsed to `/`,
  // and the sprite 404'd again, one directory up from where it lives. A
  // greedy leading group takes the last one instead. A path with neither
  // segment is not a shape this app is served from, and guessing the
  // module's own directory there is how the bug this helper exists for
  // looked; answer null and let the caller fall back out loud.
  const cut = u.pathname.replace(/^(.*)\/(?:assets|src)\/[^/]*(?:\/.*)?$/, '$1/');
  if (cut === u.pathname) return null;
  u.pathname = cut;
  return u.href;
}
/** The root the sprite hangs off, or null when this module's URL names
 *  none - the sprite then falls back to the document's own base, which
 *  is right at a site root and is at least a URL rather than a throw. */
export const APP_ROOT = appRootFrom(import.meta.url);
