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
export const PIXELIFY_FIVE_FAMILY = 'Pixelify Five';
export const PIXELIFY_FIVE_WOFF2_BASE64 = 'd09GMgABAAAAAAIIAA0AAAAABKQAAAG5AAEAQgAAAAAAAAAAAAAAAAAAAAAAAAAAGyAcIAZgADQRCAo8UQE2AiQDCAsGAAQgBYQEByAb0gMRFZQRZF8mbyrtyKnsmUtW0uh5eajRkkYiwmd9zzwevvZ7PXd3A4jjU0BFqJDHE1p0Mq4uqiyrUX1VpBcA/QCAwLv/sfo5F6Rn9t09Ls65/8pEjkFdE/m2A84AIXIHmiZwJJFm0pbQC2cFlGjCRS2xqAUWJRAZpScLgtmEN4H2INg9T6DZqHGxacuuvRoVqAhYvaSloI70IIWdVRLHLfgNBOxl356deyxZYUWpr+rJNb8JiK/pmJSRkNErC/QqJlEUgRWVXLV6ESBEVQESKEjoRA+gAFJrOROtuU2rFi1ORpsvt1y9+lW3f3N7TL8NBMKGS6Nj8yes/za5Bg8HfwuvHq+zWX05l2uol0Dwz5V3RP1cQJeUzrud3rstkMyqCwJGSQINDsuiNGGRJvRaJGn3iGytlxSz0U6dvbHww+rNxh0babDbhyLLJzB13YBvnsCnqKuRDUnSwnPAMmETnOcpx2EEPp+mbgw1LSumfKYqw0bLELM6SbGdRm08TAsa7XeSzTUZDFX+dPS7X+6RR5RVmJvg9p8MY4EtHAlMk2kyC+YFf/8E/GKovmqrnuLEDhW0/Ak2MwEAAA==';
/** The @font-face rule; goes at the top of any stylesheet that sets
 *  Pixelify Sans.
 *
 *  AUDIT FONT F10: IT IS INTERPOLATED INTO FIVE SHEETS AND THAT IS THE
 *  DESIGN, not a drift. ui/enhancedStyle.js's ENHANCED_CSS and the four
 *  online surfaces' own sheets (chatPanel, socialPanel, partyPanel,
 *  socialMenu) are each injected ALONE - the chat mounts on a document
 *  that may never have mounted the skin's stylesheet - so each has to
 *  be able to draw its own 5. There is one HOME (this constant, these
 *  520 bytes) and five USES, which is the law, not five copies of the
 *  bytes; @font-face is idempotent and the browser loads the data URI
 *  once. The "one home" sentence under PIXEL_FONT_CSS below is about
 *  the DECLARATION TRIO - the stack, the smoothing and the ligatures -
 *  which is a rule every sheet would otherwise retype and one of them
 *  would retype wrong. An `ensurePixelifyFive(doc)` injector keyed by a
 *  style id was considered and refused: it would put a JS call between
 *  a sheet and a face it already carries, for no byte saved. */
export const PIXELIFY_FIVE_FACE = `@font-face { font-family: '${PIXELIFY_FIVE_FAMILY}'; unicode-range: U+0035; font-display: swap; src: url(data:font/woff2;base64,${PIXELIFY_FIVE_WOFF2_BASE64}) format('woff2'); }`;
/** The stack every enhanced rule sets - the five first, then the face. */
export const PIXEL_STACK = `'${PIXELIFY_FIVE_FAMILY}', 'Pixelify Sans', monospace`;

// FONT1 (2026-09-16, Mac: "Enhanced mode UI. Especially the new online
// interfaces font use our enhanced font ... Any enhanced UI or text
// must be our enhanced version").
//
// THE DECLARATION, NOT JUST THE STACK. Every enhanced surface that
// wears this face sets three things together and has since PX1: the
// stack, `-webkit-font-smoothing: none` (a pixel glyph that is
// antialiased is a blurred pixel glyph), and ligatures OFF - the same
// trio ui/enhancedStyle.js writes at `.talk-shell` and `.hud`. The
// online surfaces each inject a sheet of their OWN (ui/chatPanel.js,
// ui/socialPanel.js, ui/partyPanel.js, ui/socialMenu.js), so without
// one home for the trio there would be five copies of it and the
// fifth would forget the smoothing.
export const PIXEL_FONT_CSS = `font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none;
  font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;`;
/** The classic shadowed pair the enhanced skin uses for text over the
 *  world - hard, one pixel-step, never a blur (ui/enhancedStyle.js
 *  `.hud`). A blurred shadow under a pixel face is the one thing that
 *  makes it read as a mistake. */
export const PIXEL_TEXT_SHADOW = '2px 2px 0 rgba(0,0,0,0.85)';
