// PADHD1 (2026-09-25): THE HIGH-DEFINITION PAD GLYPHS - Enhanced Plus only.
//
// ui/padGlyphs.js draws every button as an 11x11 bitmap, which is the right
// answer for the plain Enhanced skin's pixel language and the wrong one for
// Plus: blown up to a 20-28px prompt or a crossbar badge it reads as mush
// (the report: "the controller buttons shown are not high quality"). These are
// VECTORS - circles, pills, stroked letters - so they are sharp at any size and
// any device pixel ratio, and they are still OUR drawings (no licensed glyph
// font, no vendor artwork): a dark stone body, a brass rim, and the face
// buttons' letter in the colour every player already reads for it.
//
// Same seam as padGlyphs.js: pure strings, no DOM, cacheable, testable in node.
// `hdGlyphSvg(family, code, { size })` answers a data URL or null; the codes are
// the Unity names the poller speaks (JoystickButton0..9, the six axis keys) plus
// a handful of PROMPT-ONLY pseudo codes for things that are not one button
// ('StickL', 'StickR', 'Dpad', 'Bumpers', 'Triggers').

/** A tiny stroke font on a 6 x 10 box - only the characters the prompts use. */
const STROKES = Object.freeze({
  A: 'M0 10 L3 0 L6 10 M1.1 6.6 H4.9',
  B: 'M0 0 V10 H3.6 Q6 10 6 7.5 Q6 5 3.4 5 H0 M0 5 H3.1 Q5.5 5 5.5 2.5 Q5.5 0 3.1 0 H0',
  X: 'M0 0 L6 10 M6 0 L0 10',
  Y: 'M0 0 L3 5 L6 0 M3 5 V10',
  L: 'M0 0 V10 H6',
  R: 'M0 10 V0 H3.4 Q6 0 6 2.6 Q6 5.2 3.4 5.2 H0 M3 5.2 L6 10',
  T: 'M0 0 H6 M3 0 V10',
  S: 'M6 1.3 Q5 0 3 0 Q0 0 0 2.6 Q0 5 3 5 Q6 5 6 7.5 Q6 10 3 10 Q1 10 0 8.7',
  1: 'M1.2 2 L3.6 0 V10 M1.2 10 H6',
  2: 'M0 2.3 Q0.6 0 3 0 Q6 0 6 2.8 Q6 5 0 10 H6',
  3: 'M0 1 Q1 0 3 0 Q6 0 6 2.5 Q6 5 3 5 Q6 5 6 7.5 Q6 10 3 10 Q1 10 0 9',
});

/** The letters of `word` centred on (cx, cy), `h` tall, as one stroked path. */
function lettering(word, cx, cy, h, color, sw) {
  const s = h / 10;
  const adv = 6 * s, gap = 2.4 * s;
  const w = word.length * adv + (word.length - 1) * gap;
  let x0 = cx - w / 2;
  const y0 = cy - h / 2;
  let d = '';
  for (const ch of word) {
    const p = STROKES[ch];
    if (p) {
      d += p.replace(/([MLHVQ])([^MLHVQ]*)/g, (_, cmd, args) => {
        const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (cmd === 'H') return `H${(x0 + n[0] * s).toFixed(2)} `;
        if (cmd === 'V') return `V${(y0 + n[0] * s).toFixed(2)} `;
        const out = [];
        for (let i = 0; i < n.length; i += 2) out.push(`${(x0 + n[i] * s).toFixed(2)} ${(y0 + n[i + 1] * s).toFixed(2)}`);
        return `${cmd}${out.join(' ')} `;
      });
    }
    x0 += adv + gap;
  }
  return `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ── the palette ────────────────────────────────────────────────────
const BONE = '#ece3c8';
const RIM = '#b08a4a';        // brass
const RIM_LO = '#5c4526';
const FACE_XBOX = Object.freeze({ A: '#7ad05a', B: '#f0604a', X: '#56a2f0', Y: '#f4cf48' });
const FACE_PS = Object.freeze({ cross: '#8fb8f4', circle: '#f07a7a', square: '#ee9ad8', triangle: '#62d6ae' });

const DEFS = `<defs><radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#3a352c"/><stop offset="1" stop-color="#0f0e0b"/></radialGradient>`
  + `<linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a352c"/><stop offset="1" stop-color="#12100d"/></linearGradient></defs>`;

const round = (inner, ring = RIM) => `<circle cx="16" cy="16" r="14.2" fill="#000" opacity="0.45"/>`
  + `<circle cx="16" cy="15.4" r="13.4" fill="url(#g)" stroke="${ring}" stroke-width="1.8"/>`
  + `<path d="M6.5 11 A10.5 10.5 0 0 1 25.5 11" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="1.4"/>${inner}`;

const pill = (inner) => `<rect x="1.5" y="8.6" width="29" height="16" rx="6" fill="#000" opacity="0.45"/>`
  + `<rect x="1.5" y="7.4" width="29" height="16" rx="6" fill="url(#p)" stroke="${RIM}" stroke-width="1.6"/>${inner}`;

const trigger = (inner) => `<path d="M5 28 V13 Q5 4 16 4 Q27 4 27 13 V28 Z" fill="#000" opacity="0.45" transform="translate(0 1)"/>`
  + `<path d="M5 27.5 V13 Q5 4 16 4 Q27 4 27 13 V27.5 Z" fill="url(#p)" stroke="${RIM}" stroke-width="1.6" stroke-linejoin="round"/>${inner}`;

function faceXbox(letter) {
  return round(lettering(letter, 16, 15.6, 11, FACE_XBOX[letter], 2.3), FACE_XBOX[letter]);
}
function facePs(sign) {
  const c = FACE_PS[sign];
  const st = `fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  const mark = {
    cross: `<path d="M11 10.6 L21 20.6 M21 10.6 L11 20.6" ${st}/>`,
    circle: `<circle cx="16" cy="15.6" r="5.4" ${st}/>`,
    square: `<rect x="11" y="10.6" width="10" height="10" rx="0.6" ${st}/>`,
    triangle: `<path d="M16 9.8 L21.8 20 H10.2 Z" ${st}/>`,
  }[sign];
  return round(mark, c);
}
function dpad(dir) {
  const arms = { up: 'M13 4 H19 V12 L16 15 L13 12 Z', down: 'M13 28 H19 V20 L16 17 L13 20 Z',
    left: 'M4 13 V19 H12 L15 16 L12 13 Z', right: 'M28 13 V19 H20 L17 16 L20 13 Z' };
  const body = `<path d="M12.5 3.5 H19.5 V12.5 H28.5 V19.5 H19.5 V28.5 H12.5 V19.5 H3.5 V12.5 H12.5 Z" fill="url(#p)" stroke="${RIM}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const lit = dir && arms[dir] ? `<path d="${arms[dir]}" fill="${BONE}"/>` : '';
  return `<path d="M12.5 4.5 H19.5 V13.5 H28.5 V20.5 H19.5 V29.5 H12.5 V20.5 H3.5 V13.5 H12.5 Z" fill="#000" opacity="0.45"/>${body}${lit}`;
}
function stick(label, click = false) {
  const core = click
    ? `<circle cx="16" cy="15.4" r="7.2" fill="${RIM}" opacity="0.35"/>`
    : '';
  const arrows = click ? '' : `<path d="M16 3.6 l-2 2.4 h4 z M16 27.2 l-2 -2.4 h4 z M4.2 15.4 l2.4 -2 v4 z M27.8 15.4 l-2.4 -2 v4 z" fill="${BONE}" opacity="0.8"/>`;
  return round(`<circle cx="16" cy="15.4" r="8.4" fill="none" stroke="${RIM_LO}" stroke-width="1.4"/>${core}${arrows}`
    + lettering(label, 16, 15.6, label.length > 1 ? 7 : 8, BONE, 1.8));
}
const VIEW_MARK = `<rect x="10" y="11" width="8" height="6" rx="1" fill="none" stroke="${BONE}" stroke-width="1.6"/><rect x="14" y="14.4" width="8" height="6" rx="1" fill="url(#p)" stroke="${BONE}" stroke-width="1.6"/>`;
const MENU_MARK = `<path d="M10.5 12 H21.5 M10.5 15.4 H21.5 M10.5 18.8 H21.5" stroke="${BONE}" stroke-width="1.8" stroke-linecap="round"/>`;
const SHARE_MARK = `<path d="M16 10.4 V17 M13.4 12.6 L16 10 L18.6 12.6 M11 15 V20 H21 V15" fill="none" stroke="${BONE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The body of every glyph, per family, on a 32 x 32 viewBox. */
const BODIES = Object.freeze({
  xbox: Object.freeze({
    JoystickButton0: () => faceXbox('A'),
    JoystickButton1: () => faceXbox('B'),
    JoystickButton2: () => faceXbox('X'),
    JoystickButton3: () => faceXbox('Y'),
    JoystickButton4: () => pill(lettering('LB', 16, 15.4, 8.2, BONE, 1.8)),
    JoystickButton5: () => pill(lettering('RB', 16, 15.4, 8.2, BONE, 1.8)),
    JoystickButton6: () => round(VIEW_MARK),
    JoystickButton7: () => round(MENU_MARK),
    JoystickButton8: () => stick('LS', true),
    JoystickButton9: () => stick('RS', true),
    JoystickAxis9Button0: () => trigger(lettering('LT', 16, 17, 8.2, BONE, 1.8)),
    JoystickAxis10Button0: () => trigger(lettering('RT', 16, 17, 8.2, BONE, 1.8)),
  }),
  ps: Object.freeze({
    JoystickButton0: () => facePs('cross'),
    JoystickButton1: () => facePs('circle'),
    JoystickButton2: () => facePs('square'),
    JoystickButton3: () => facePs('triangle'),
    JoystickButton4: () => pill(lettering('L1', 16, 15.4, 8.2, BONE, 1.8)),
    JoystickButton5: () => pill(lettering('R1', 16, 15.4, 8.2, BONE, 1.8)),
    JoystickButton6: () => round(SHARE_MARK),
    JoystickButton7: () => round(MENU_MARK),
    JoystickButton8: () => stick('L3', true),
    JoystickButton9: () => stick('R3', true),
    JoystickAxis9Button0: () => trigger(lettering('L2', 16, 17, 8.2, BONE, 1.8)),
    JoystickAxis10Button0: () => trigger(lettering('R2', 16, 17, 8.2, BONE, 1.8)),
  }),
});
const SHARED = Object.freeze({
  JoystickAxis7Button0: () => dpad('up'),
  JoystickAxis7Button1: () => dpad('down'),
  JoystickAxis6Button1: () => dpad('left'),
  JoystickAxis6Button0: () => dpad('right'),
  Dpad: () => dpad(null),
  StickL: () => stick('L'),
  StickR: () => stick('R'),
});

/** Every code this module can draw. */
export const HD_GLYPH_CODES = Object.freeze([...Object.keys(BODIES.xbox), ...Object.keys(SHARED)]);

/** The glyph's SVG markup (not a URL), or null. */
export function hdGlyphMarkup(family, code, { size = 24 } = {}) {
  const fam = family === 'ps' ? 'ps' : 'xbox';
  const body = BODIES[fam][code] ?? SHARED[code];
  if (!body) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${DEFS}${body()}</svg>`;
}

const _cache = new Map();
/** The glyph as a data URL, cached per family, code and size - or null for a code it does not draw. */
export function hdGlyphSvg(family, code, { size = 24 } = {}) {
  const key = `${family === 'ps' ? 'ps' : 'xbox'}|${code}|${size}`;
  if (_cache.has(key)) return _cache.get(key);
  const m = hdGlyphMarkup(family, code, { size });
  const url = m ? `data:image/svg+xml;utf8,${encodeURIComponent(m)}` : null;
  _cache.set(key, url);
  return url;
}

/** A short name for a code, for alt text and titles. */
export function hdGlyphName(family, code) {
  const ps = family === 'ps';
  const names = {
    JoystickButton0: ps ? 'Cross' : 'A', JoystickButton1: ps ? 'Circle' : 'B', JoystickButton2: ps ? 'Square' : 'X',
    JoystickButton3: ps ? 'Triangle' : 'Y', JoystickButton4: ps ? 'L1' : 'LB', JoystickButton5: ps ? 'R1' : 'RB',
    JoystickButton6: ps ? 'Create' : 'View', JoystickButton7: ps ? 'Options' : 'Menu',
    JoystickButton8: ps ? 'L3' : 'Left stick click', JoystickButton9: ps ? 'R3' : 'Right stick click',
    JoystickAxis9Button0: ps ? 'L2' : 'LT', JoystickAxis10Button0: ps ? 'R2' : 'RT',
    JoystickAxis7Button0: 'D-pad up', JoystickAxis7Button1: 'D-pad down', JoystickAxis6Button1: 'D-pad left', JoystickAxis6Button0: 'D-pad right',
    Dpad: 'D-pad', StickL: 'Left stick', StickR: 'Right stick',
  };
  return names[code] ?? String(code ?? '');
}

/** Test seam. */
export function _clearHdGlyphCache() { _cache.clear(); }
