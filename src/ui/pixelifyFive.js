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
 *  Pixelify Sans. */
export const PIXELIFY_FIVE_FACE = `@font-face { font-family: '${PIXELIFY_FIVE_FAMILY}'; unicode-range: U+0035; font-display: swap; src: url(data:font/woff2;base64,${PIXELIFY_FIVE_WOFF2_BASE64}) format('woff2'); }`;
/** The stack every enhanced rule sets - the five first, then the face. */
export const PIXEL_STACK = `'${PIXELIFY_FIVE_FAMILY}', 'Pixelify Sans', monospace`;
