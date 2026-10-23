// FIX-D (2026-09-08, Mac: "the enhanced font number 5 looks like an 8").
// Pixelify Sans, the enhanced skin's face, draws its 5 with a cut
// top-left corner, and at every size and weight it reads as an 8 or an
// S - a rendering of the digits proved it is the glyph, not the
// smoothing, the weight or the shadow. The face ships no alternate. So
// the FIVE comes from Silkscreen (OFL 1.1, vendor/silkscreen-five/),
// subset to the one code point and carried here as a data URI: no
// request, 520 bytes, one glyph. The family is declared over
// unicode-range U+0035 only and stands FIRST in every Pixelify stack,
// so the browser takes the 5 from it and everything else from Pixelify.
//
// TWO (2026-10-18, Dudey: "the number 2 looks like a Z"). Pixelify's 2
// is its Z with one corner changed, so the two read alike. The family
// gets a second face over U+0032 and U+005A: a 2 with a rounded top and
// a stepped diagonal, and a Z with a flat top and a straight diagonal,
// drawn for us on Pixelify's own grid (vendor/pixelify-glyphs/, built by
// tools/pixelifyGlyphs.py, 416 bytes). Same family name, so every stack
// that already puts the five first takes the 2 and the Z from it too.
export const PIXELIFY_FIVE_FAMILY = 'Pixelify Five';
export const PIXELIFY_FIVE_WOFF2_BASE64 = 'd09GMgABAAAAAAIIAA0AAAAABKQAAAG5AAEAQgAAAAAAAAAAAAAAAAAAAAAAAAAAGyAcIAZgADQRCAo8UQE2AiQDCAsGAAQgBYQEByAb0gMRFZQRZF8mbyrtyKnsmUtW0uh5eajRkkYiwmd9zzwevvZ7PXd3A4jjU0BFqJDHE1p0Mq4uqiyrUX1VpBcA/QCAwLv/sfo5F6Rn9t09Ls65/8pEjkFdE/m2A84AIXIHmiZwJJFm0pbQC2cFlGjCRS2xqAUWJRAZpScLgtmEN4H2INg9T6DZqHGxacuuvRoVqAhYvaSloI70IIWdVRLHLfgNBOxl356deyxZYUWpr+rJNb8JiK/pmJSRkNErC/QqJlEUgRWVXLV6ESBEVQESKEjoRA+gAFJrOROtuU2rFi1ORpsvt1y9+lW3f3N7TL8NBMKGS6Nj8yes/za5Bg8HfwuvHq+zWX05l2uol0Dwz5V3RP1cQJeUzrud3rstkMyqCwJGSQINDsuiNGGRJvRaJGn3iGytlxSz0U6dvbHww+rNxh0babDbhyLLJzB13YBvnsCnqKuRDUnSwnPAMmETnOcpx2EEPp+mbgw1LSumfKYqw0bLELM6SbGdRm08TAsa7XeSzTUZDFX+dPS7X+6RR5RVmJvg9p8MY4EtHAlMk2kyC+YFf/8E/GKovmqrnuLEDhW0/Ak2MwEAAA==';
export const PIXELIFY_GLYPHS_WOFF2_BASE64 = 'd09GMgABAAAAAAGgAAoAAAAAAxAAAAFVAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAAPAqBJIEfATYCJAMKCwgABCAFaQcoG08CEK4G7CZ4Jq7VZnqPaS6YXuWQw1RbJh6+H/t27nvrmtQMbRCLt0hnKJGdvlT+z5/rbZqg29elVx1WpXCJB/CNL2EDTlNMNbGZr4i7wsrKf1Qlsx1PdmMc+kB2w92NINLQ3/I4DzSggLvLbQzxeALBIZ3X3J0op6mYYkWkA21shWnP+fr/hfwzOID4lQKdICGjSRZoUmQQJYqEZNpzAflL4Y8FADIoQSVGsQwoApTJRWg/BOVjEKpJt/zRejXl4RPResYon4PypSPKH6ezwgzNirNnNhfmUC4f5rlc/pHOPd3f5P95UE+t19nX6YofP9MAgeB3e0qV0f6R8wv8LSXHVguvqTEFZAkEBz1d7mKtI1ileMUFqwJZpzKQABWZFyBUUDgpVSGLonKhSX2hpEbfbhBlI6P9rLf8Vr0BeAJRrAMjezM9SwltXWsjdQs4kyybrQEAAAA=';
/** The @font-face rules (the five, then the 2 and the Z); go at the top of any
 *  stylesheet that sets Pixelify Sans.
 *
 *  AUDIT FONT F10: IT IS INTERPOLATED INTO FIVE SHEETS AND THAT IS THE
 *  DESIGN, not a drift. ui/enhanced/enhancedStyle.js's ENHANCED_CSS and the four
 *  online surfaces' own sheets (chatPanel, socialPanel, partyPanel,
 *  socialMenu) are each injected ALONE - the chat mounts on a document
 *  that may never have mounted the skin's stylesheet - so each has to
 *  be able to draw its own 5. There is one HOME (this constant, these
 *  520 bytes and the 2 and Z's 416) and five USES, which is the law, not five copies of the
 *  bytes; @font-face is idempotent and the browser loads the data URI
 *  once. The "one home" sentence under PIXEL_FONT_CSS below is about
 *  the DECLARATION TRIO - the stack, the smoothing and the ligatures -
 *  which is a rule every sheet would otherwise retype and one of them
 *  would retype wrong. An `ensurePixelifyFive(doc)` injector keyed by a
 *  style id was considered and refused: it would put a JS call between
 *  a sheet and a face it already carries, for no byte saved. */
export const PIXELIFY_FIVE_FACE = `@font-face { font-family: '${PIXELIFY_FIVE_FAMILY}'; unicode-range: U+0035; font-display: swap; src: url(data:font/woff2;base64,${PIXELIFY_FIVE_WOFF2_BASE64}) format('woff2'); }
@font-face { font-family: '${PIXELIFY_FIVE_FAMILY}'; unicode-range: U+0032, U+005A; font-display: swap; src: url(data:font/woff2;base64,${PIXELIFY_GLYPHS_WOFF2_BASE64}) format('woff2'); }`;
/** The two faces, the five first - for a stack that falls back to something other than monospace (FONT3: the two
 *  inline-only cards, ui/enhanced/enhancedChunk.js and ui/charSheetDoor.js, fall to the system face if the request never came). */
export const PIXEL_FAMILIES = `'${PIXELIFY_FIVE_FAMILY}', 'Pixelify Sans'`;
/** The stack every enhanced rule sets - the five first, then the face. */
export const PIXEL_STACK = `${PIXEL_FAMILIES}, monospace`;

// FONT1 (2026-09-16, Mac: "Enhanced mode UI. Especially the new online
// interfaces font use our enhanced font ... Any enhanced UI or text
// must be our enhanced version").
//
// THE DECLARATION, NOT JUST THE STACK. Every enhanced surface that
// wears this face sets three things together and has since PX1: the
// stack, `-webkit-font-smoothing: none` (a pixel glyph that is
// antialiased is a blurred pixel glyph), and ligatures OFF - the same
// trio ui/enhanced/enhancedStyle.js writes at `.talk-shell` and `.hud`. The
// online surfaces each inject a sheet of their OWN (ui/chatPanel.js,
// ui/socialPanel.js, ui/partyPanel.js, ui/socialMenu.js), so without
// one home for the trio there would be five copies of it and the
// fifth would forget the smoothing.
// FONT3 (2026-10-02, Mac: "improve the readability of our ingame font as
// im recieving a lot of complaints"): THE READING PAIR. Pixelify Sans at
// weight 400 draws a stroke thinner than one screen pixel at every size
// the skin uses under 16px, so a browser greys it out rather than lighting
// it (measured in Chromium: at 10px only 16% of a glyph's inked pixels
// reach full brightness at 400, 24% at 500; at 13px 29% against 32%), and
// its sidebearings leave about one pixel between letters, which the
// greying closes. 500 is the request's own second weight (ENHANCED_FONTS_URL
// asks for 400;500, so nothing new is fetched) and half a pixel of
// tracking reopens the gap. A rule that says its own weight or spacing
// AFTER this keeps it - so this goes FIRST in a rule (ui/touch/touch.js was the
// one place that wrote a weight before the trio, and was turned round).
export const PIXEL_READ_CSS = 'font-weight: 500; letter-spacing: 0.5px;';
/** AUDIT FONT3 F2: the face without the reading pair - for a rule on an element INSIDE a surface that already wears
 *  the trio (a toolbar's buttons), where restating the pair would outrank the element's own spacing. Roots take
 *  PIXEL_FONT_CSS. */
export const PIXEL_FACE_CSS = `font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none;
  font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;`;
export const PIXEL_FONT_CSS = `${PIXEL_FACE_CSS} ${PIXEL_READ_CSS}`;
/** The classic shadowed pair the enhanced skin uses for text over the
 *  world - hard, one pixel-step, never a blur (ui/enhanced/enhancedStyle.js
 *  `.hud`). A blurred shadow under a pixel face is the one thing that
 *  makes it read as a mistake. */
export const PIXEL_TEXT_SHADOW = '2px 2px 0 rgba(0,0,0,0.85)';
