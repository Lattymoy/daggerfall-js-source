// QS3 - THE PAD GLYPHS: our own pixel buttons, drawn rather than
// licensed.
//
// The quickslot diamond tags each cell with the key that presses it,
// and when the pad is the live device a key name is the wrong answer -
// a player holding a controller wants to see the BUTTON. Every shipped
// glyph set is somebody's trademark or somebody's font, and this skin
// has a language of its own (square 2px frames, bone on a dark ground,
// every pixel on or off), so the buttons are drawn here in that
// language: one bitmap per button per family, as rows of characters.
//
// '.' is off, '#' is the SHAPE - the ring, the pill, the stick housing
// - and 'o' is the MARK inside it - the letter, the PlayStation sign,
// the hamburger bars. Two characters rather than one because the mark
// is the only place a family accent could ever go (PlayStation's four
// coloured signs); `glyphSvg` takes an `accent` and defaults it to the
// shape's colour, so the shipped glyph is bone throughout and nothing
// depends on a second hue.
//
// THE OUTPUT IS AN SVG DATA URL OF RECTS, not a canvas. A canvas needs
// a document, and a test that cannot read what was drawn pins nothing;
// a string of `<rect>`s with `shape-rendering="crispEdges"` is exactly
// as crisp, is cacheable, and can be asserted on in node. Runs of lit
// pixels merge into one rect per run, so a glyph is a dozen rects
// rather than sixty.
//
// THE FAMILY IS THE PAD'S OWN ID. `padFamilyOf` reads the Gamepad
// API's id string - which carries the vendor id for every pad a
// browser reports - and ui/gamepadInput.js writes the answer beside
// `setControllerLook` each tick, so the HUD can ask a module rather
// than reach into the input layer. It clears to null when the pad
// goes, because a glyph for a pad nobody is holding is a lie.

/** 'xbox' unless the id names Sony. 054c is Sony's USB vendor id, which
 *  Chrome puts in the id string of every DualShock and DualSense. */
export const PS_ID_RE = /playstation|dualshock|dualsense|sony|054c/i;

/** The two families this port draws. */
export const PAD_FAMILIES = Object.freeze(['xbox', 'ps']);

export function padFamilyOf(id) {
  return PS_ID_RE.test(String(id ?? '')) ? 'ps' : 'xbox';
}

let _family = null;
/** The live pad's family, or null when no pad is connected. */
export const padFamily = () => _family;
export function setPadFamily(f) { _family = f === 'ps' || f === 'xbox' ? f : null; }

// ── the bitmaps ──────────────────────────────────────────────────
//
// Eleven by eleven, every one of them, so a row's length is a law a
// test can check rather than a per-glyph fact.

const W = 11;

/** The face button's housing: a round-ish ring, its inside a 5x5 hole
 *  at rows 3-7, cols 3-7. */
const ring = (mark) => [
  '...#####...',
  '.##.....##.',
  '.#.......#.',
  ...mark.map((r) => `#..${r}..#`),
  '.#.......#.',
  '.##.....##.',
  '...#####...',
];

/** The bumper's housing: a wide low pill, its inside two 3x5 letters
 *  at rows 3-7. */
const pill = (rows) => [
  '...........',
  '...........',
  '.#########.',
  ...rows.map((r) => `#.${r}.#`),
  '.#########.',
  '...........',
  '...........',
];

/** Two 3x5 letters side by side, with one column between them. */
const word = (a, b) => a.map((r, i) => `${r}.${b[i]}`);

const L3 = ['o..', 'o..', 'o..', 'o..', 'ooo'];
const R3 = ['oo.', 'o.o', 'oo.', 'o.o', 'o.o'];
const B3 = ['oo.', 'o.o', 'oo.', 'o.o', 'oo.'];
const ONE3 = ['.o.', 'oo.', '.o.', '.o.', 'ooo'];
// PAD1: the triggers' letters - T for LT/RT, 2 for L2/R2
const T3 = ['ooo', '.o.', '.o.', '.o.', '.o.'];
const TWO3 = ['oo.', '..o', '.o.', 'o..', 'ooo'];

/** PAD1: the d-pad - a cross of '#', the pressed arm filled with the
 *  mark. One shape for both families, because a d-pad is a d-pad. */
const dpad = (dir) => {
  const u = dir === 'up' ? 'o' : '.', d = dir === 'down' ? 'o' : '.';
  const l = dir === 'left' ? 'ooo' : '...', r = dir === 'right' ? 'ooo' : '...';
  return [
    '....###....',
    `....#${u}#....`,
    `....#${u}#....`,
    `#####${u}#####`,
    `#${l}...${r}#`,
    `#${l}...${r}#`,
    `#${l}...${r}#`,
    `#####${d}#####`,
    `....#${d}#....`,
    `....#${d}#....`,
    '....###....',
  ];
};

const A5 = ['.ooo.', 'o...o', 'ooooo', 'o...o', 'o...o'];
const B5 = ['oooo.', 'o...o', 'oooo.', 'o...o', 'oooo.'];
const X5 = ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'];
const Y5 = ['o...o', '.o.o.', '..o..', '..o..', '..o..'];

const CROSS5 = ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'];
const CIRCLE5 = ['.ooo.', 'o...o', 'o...o', 'o...o', '.ooo.'];
const SQUARE5 = ['ooooo', 'o...o', 'o...o', 'o...o', 'ooooo'];
const TRIANGLE5 = ['..o..', '.o.o.', '.o.o.', 'o...o', 'ooooo'];

/** View: two rectangles, one behind the other - the Xbox button's own sign. */
const VIEW7 = ['.ooo...', '.o.o...', '.ooooo.', '...o.o.', '...ooo.'];
/** Menu / Options: three bars, which is what both pads print on them. */
const BARS7 = ['ooooooo', '.......', 'ooooooo', '.......', 'ooooooo'];
/** Create / Share: a box with a line leaving the top of it. */
const SHARE7 = ['...o...', '..ooo..', 'o..o..o', 'o.....o', 'ooooooo'];

/** The stick housing, with the ring thickened on the side the stick is
 *  - a left stick and a right stick are the same object, and which one
 *  it is is the only thing a glyph has to say. */
const stick = (side) => {
  const l = side === 'left' ? '##' : '.#';
  const r = side === 'left' ? '#.' : '##';
  return [
    '...#####...',
    '.##.....##.',
    '.#.......#.',
    `${l}.......${r}`,
    `${l}..ooo..${r}`,
    `${l}..ooo..${r}`,
    `${l}..ooo..${r}`,
    `${l}.......${r}`,
    '.#.......#.',
    '.##.....##.',
    '...#####...',
  ];
};

/**
 * The ten Unity buttons, per family. `STANDARD_TO_UNITY_BUTTON`
 * (systems/gamepad.js) maps the browser's standard mapping onto these,
 * so 0-3 are the face buttons in the browser's own order (south, east,
 * west, north), 4-5 the bumpers, 6-7 the two system buttons and 8-9
 * the stick clicks.
 */
export const PAD_GLYPHS = Object.freeze({
  xbox: Object.freeze({
    JoystickButton0: ring(A5),
    JoystickButton1: ring(B5),
    JoystickButton2: ring(X5),
    JoystickButton3: ring(Y5),
    JoystickButton4: pill(word(L3, B3)),
    JoystickButton5: pill(word(R3, B3)),
    JoystickButton6: pill(VIEW7),
    JoystickButton7: pill(BARS7),
    JoystickButton8: stick('left'),
    JoystickButton9: stick('right'),
    // PAD1: the six AXIS KEYS a standard pad presses as buttons - the
    // d-pad (axes 6/7, systems/gamepad.js unityAxes) and the triggers
    // (axes 9/10) - the codes DEFAULT_SECONDARY_BINDINGS spends.
    JoystickAxis7Button0: dpad('up'),
    JoystickAxis7Button1: dpad('down'),
    JoystickAxis6Button1: dpad('left'),
    JoystickAxis6Button0: dpad('right'),
    JoystickAxis9Button0: pill(word(L3, T3)),
    JoystickAxis10Button0: pill(word(R3, T3)),
  }),
  ps: Object.freeze({
    JoystickButton0: ring(CROSS5),
    JoystickButton1: ring(CIRCLE5),
    JoystickButton2: ring(SQUARE5),
    JoystickButton3: ring(TRIANGLE5),
    JoystickButton4: pill(word(L3, ONE3)),
    JoystickButton5: pill(word(R3, ONE3)),
    JoystickButton6: pill(SHARE7),
    JoystickButton7: pill(BARS7),
    JoystickButton8: stick('left'),
    JoystickButton9: stick('right'),
    JoystickAxis7Button0: dpad('up'),
    JoystickAxis7Button1: dpad('down'),
    JoystickAxis6Button1: dpad('left'),
    JoystickAxis6Button0: dpad('right'),
    JoystickAxis9Button0: pill(word(L3, TWO3)),
    JoystickAxis10Button0: pill(word(R3, TWO3)),
  }),
});

/** PAD1: the axis keys a glyph exists for - the four d-pad directions
 *  and the two triggers' positive halves. Named once, so the tag law,
 *  the defaults and the pin all read the same six. */
export const GLYPH_AXIS_KEYS = Object.freeze(['JoystickAxis7Button0', 'JoystickAxis7Button1', 'JoystickAxis6Button1', 'JoystickAxis6Button0', 'JoystickAxis9Button0', 'JoystickAxis10Button0']);

/** The button's bitmap, or null for anything that is not one of the
 *  ten - an axis key, a keyboard code, JoystickButton10 and up (Unity
 *  names twenty; the standard mapping reaches ten). */
export function unityButtonGlyph(family, code) {
  if (typeof code !== 'string' || !(/^JoystickButton[0-9]$/.test(code) || GLYPH_AXIS_KEYS.includes(code))) return null;
  return PAD_GLYPHS[family === 'ps' ? 'ps' : 'xbox'][code] ?? null;
}

/** The bitmap's grid, for a caller that wants to draw it itself. */
export const GLYPH_SIZE = W;

const _svgs = new Map();

/**
 * The glyph as an SVG data URL: one `<rect>` per run of lit pixels, on
 * an 11x11 viewBox, `shape-rendering="crispEdges"` so a browser paints
 * whole pixels at any size. Cached per family, code, size and colours -
 * the HUD asks for the same four glyphs sixty times a second.
 */
export function glyphSvg(family, code, { size = 12, color = '#d8cfae', accent = null } = {}) {
  const rows = unityButtonGlyph(family, code);
  if (!rows) return null;
  const ink = accent ?? color;
  const key = `${family === 'ps' ? 'ps' : 'xbox'}|${code}|${size}|${color}|${ink}`;
  const had = _svgs.get(key);
  if (had !== undefined) return had;
  let rects = '';
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${ch === 'o' ? ink : color}"/>`;
      x += run;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${W} ${W}" shape-rendering="crispEdges">${rects}</svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  _svgs.set(key, url);
  return url;
}

/** Test seam: forget the cached URLs. */
export function _clearGlyphCache() { _svgs.clear(); }
