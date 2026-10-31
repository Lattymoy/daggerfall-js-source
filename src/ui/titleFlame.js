// @ts-check
// SHOP (2026-10-28, the owner: "Genesis ... an extremely detailed title with a blueish purple animated flame effect that
// acts as the background"; bible/06-Systems/Shop.md): A TITLE'S FLAME PLATE. The fire is painted once, off a seeded
// noise, into a strip of frames (flameSheetPixels, pure, so a pin can read it), and every DOM face shows it as one CSS
// background stepped a frame at a time - a background-position animation, no script a frame, however many names burn.
// The frames loop whole: the noise is periodic round the strip and over the loop, so the plate tiles and never jumps.
import { TITLE_FLAME } from './playerBadge.js';

/** WYRM-RIDER (the owner: "naw just make the name plate", "perfect titles"): A TITLE ON A METAL PLATE (plateCss, below;
 *  kept here, not in ui/playerBadge.js, so its sheet is built at this module's load) - a pointed plate, its `rim` and its
 *  `face` (CSS colours, top to bottom, or left to right where `across`), a rivet each end, the letters' dark `ink` edge,
 *  and a `glow` round it where it names one. */
export const TITLE_PLATE = Object.freeze({
  wyrmrider: Object.freeze({
    rim: ['#f2d48a', '#8a5a1e'],
    face: ['#c8913a', '#7a4f18', '#5c3a10'],
    rivet: '#ffe7a6',
    ink: '#3a2208',
    glow: null,
  }),
  aetherrider: Object.freeze({
    rim: ['#bfefff', '#2f7fd0'],
    face: ['#2a5f9e', '#1b3c78', '#3b2470'],
    rivet: '#c9a9ff',
    ink: '#0b1638',
    glow: '#7fd4ff',
  }),
  firstwyrmrider: Object.freeze({
    rim: ['#ffe8a0', '#d9a441', '#7fd4ff', '#9b6bff'],
    across: true,
    face: ['#6a4310', '#23305e', '#3b2470'],
    rivet: '#ffe8a0',
    ink: '#2a1a05',
    glow: '#ffe8a0',
  }),
  firstaetherrider: Object.freeze({
    rim: ['#e8fbff', '#7fd4ff', '#9b6bff', '#e8fbff'],
    across: true,
    face: ['#1b3c78', '#2a1f5e', '#1b3c78'],
    rivet: '#e8fbff',
    ink: '#0b1638',
    glow: '#9b6bff',
  }),
});

/** A seeded number in 0..1 for an integer pair - the lattice's own, so a sheet is the same on every machine. */
const hash2 = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ seed) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (/** @type {number} */ t) => t * t * t * (t * (t * 6 - 15) + 10);
/** Value noise on a lattice periodic in x by `px` cells and in y by `py`. */
function noise(
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {number} */ px,
  /** @type {number} */ py,
  /** @type {number} */ seed,
) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    fx = fade(x - xi),
    fy = fade(y - yi);
  const w = (/** @type {number} */ a, /** @type {number} */ b) =>
    hash2(((a % px) + px) % px, ((b % py) + py) % py, seed);
  const a = w(xi, yi),
    b = w(xi + 1, yi),
    c = w(xi, yi + 1),
    d = w(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Four octaves, each periodic in the same box, so the sum tiles as each octave does. 0..1. */
function fbm(
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {number} */ px,
  /** @type {number} */ py,
  /** @type {number} */ seed,
) {
  let s = 0,
    amp = 0.5,
    k = 1;
  for (let o = 0; o < 4; o++, amp *= 0.5, k *= 2) s += amp * noise(x * k, y * k, px * k, py * k, seed + o * 101);
  return s / 0.9375;
}
const mix = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) =>
  [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
/** A ramp's colour at `t` (0..1), its stops evenly spaced. */
function ramp(/** @type {ReadonlyArray<readonly number[]>} */ stops, /** @type {number} */ t) {
  const f = Math.max(0, Math.min(1, t)) * (stops.length - 1),
    i = Math.min(stops.length - 2, Math.floor(f));
  return mix(/** @type {number[]} */ ([...stops[i]]), /** @type {number[]} */ ([...stops[i + 1]]), f - i);
}

/**
 * THE SHEET: `spec.frames` frames of `spec.w` x `spec.h` pixels, stacked top to bottom, as unpremultiplied RGBA. Each
 * frame is the fire at one moment of its loop: tongues rising out of a bed at the foot, their roots in `root` (the
 * blue a hot flame burns at its base), their bodies and tips in `tips` (into violet and its white heart), swaying,
 * with embers rising past them. Pure. @param {any} spec one of TITLE_FLAME
 */
export function flameSheetPixels(spec) {
  const data = new Uint8ClampedArray(spec.w * spec.h * spec.frames * 4);
  for (let f = 0; f < spec.frames; f++) flameFramePixels(spec, f, data);
  return { width: spec.w, height: spec.h * spec.frames, data };
}
/** Frame `f` of the sheet painted into `data`, the whole sheet's buffer - a few milliseconds, one idle moment's work. */
export function flameFramePixels(
  /** @type {any} */ spec,
  /** @type {number} */ f,
  /** @type {Uint8ClampedArray} */ data,
) {
  const { w, h, frames: n, seed, root, tips, tongues, embers, haze } = spec;
  const GUTTER = 2; // clear rows at a frame's foot, so a scaled plate never samples the next frame's fire
  const PX = tongues * 2,
    PY = 2,
    LOOP = 4; // noise cells round the strip, up one plate, and plates climbed a loop
  const t = f / n;
  for (let y = 0; y < h - GUTTER; y++) {
    const up = 1 - (y + 0.5) / (h - GUTTER); // 0 at the foot, 1 at the top
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      // the edges curl: a slower noise pushes the fast one sideways, more the higher the flame
      const warp = (noise(u * tongues, up * PY - t * LOOP, tongues, LOOP, seed + 9) - 0.5) * 0.22 * (0.3 + up);
      const nz = fbm((u + warp) * PX, up * PY - t * LOOP, PX, LOOP, seed);
      const lick = 0.5 + 0.5 * Math.cos(2 * Math.PI * (u * tongues + warp * 2));
      const heat = nz * 0.98 + lick * 0.18 - up ** 1.15 * 0.9 + 0.02;
      const at = ((f * h + y) * w + x) * 4;
      // THE BACKDROP: a smoke of the fire's deep the whole plate over, slowly rolling - the letters' ground on any sky
      const smoke =
        haze[3] *
        (0.75 + 0.5 * (noise(u * 4, up * 2 - t * 2, 4, 2, seed + 3) - 0.5)) *
        Math.min(1, (1 - up) / 0.25 + 0.35);
      data[at] = haze[0] * 255;
      data[at + 1] = haze[1] * 255;
      data[at + 2] = haze[2] * 255;
      data[at + 3] = smoke * 255;
      if (heat <= 0.06) continue;
      const k = Math.min(1, Math.max(0, (heat - 0.06) / 0.98));
      const c = mix(ramp(root, k), ramp(tips, k), Math.min(1, up * 1.4 + 0.15));
      const edge = Math.min(1, (heat - 0.06) / 0.16); // a tongue's edge crisp, a few pixels soft
      const floor = 0.55 + 0.45 * Math.min(1, up / 0.12); // the foot a glow, never a hard bar
      const fa = edge * floor * Math.min(1, 0.55 + k),
        ba = data[at + 3] / 255,
        oa = fa + ba * (1 - fa); // the fire over the smoke
      for (let i = 0; i < 3; i++) data[at + i] = (c[i] * 255 * fa + data[at + i] * ba * (1 - fa)) / Math.max(oa, 1e-3);
      data[at + 3] = oa * 255;
    }
  }
  // EMBERS: each rising a whole number of times a loop from its own place, swaying, fading as it climbs
  for (let e = 0; e < embers; e++) {
    const laps = 1 + (e % 2),
      phase = hash2(e, 7, seed),
      x0 = hash2(e, 3, seed);
    const climb = (t * laps + phase) % 1;
    const ex = ((((x0 + 0.04 * Math.sin(2 * Math.PI * (t * laps * 2 + phase))) % 1) + 1) % 1) * w,
      ey = (1 - climb) * (h - GUTTER);
    const glow = (1 - climb) ** 1.4 * (0.6 + 0.4 * Math.sin(2 * Math.PI * (t * 4 + phase)));
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const py = Math.round(ey) + dy,
          px = (((Math.round(ex) + dx) % w) + w) % w;
        if (py < 0 || py >= h - GUTTER) continue;
        const g = glow * Math.exp(-(dx * dx + dy * dy) / 1.1);
        if (g < 0.02) continue;
        const at = ((f * h + py) * w + px) * 4;
        const top = tips[tips.length - 1];
        const a = data[at + 3] / 255,
          na = Math.min(1, a + g);
        for (let i = 0; i < 3; i++)
          data[at + i] = Math.min(255, (data[at + i] * a + top[i] * 255 * g) / Math.max(na, 1e-3));
        data[at + 3] = na * 255;
      }
  }
}

/** The class a flame title wears, and its key's own - every face that paints a title adds or takes them off. */
export const FLAME_CLASS = 'dftitle-flame';
export const flameClassOf = (/** @type {string} */ key) => `${FLAME_CLASS}-${key}`;

/** An idle moment of the page's, or the next task where it keeps none. */
const idle = () =>
  new Promise((done) =>
    globalThis.requestIdleCallback
      ? globalThis.requestIdleCallback(() => done(null), { timeout: 400 })
      : setTimeout(done, 0),
  );
/** A title's sheet as an image URL, painted a frame an idle moment - the whole sheet at once is a long frame in a running
 *  game - or null where the page has no canvas. */
async function flameSheetUrl(/** @type {string} */ key, /** @type {any} */ doc, /** @type {any} */ canvas) {
  const spec = /** @type {any} */ (TITLE_FLAME)[key];
  const data = new Uint8ClampedArray(spec.w * spec.h * spec.frames * 4);
  for (let f = 0; f < spec.frames; f++) {
    await idle();
    flameFramePixels(spec, f, data);
  }
  canvas.width = spec.w;
  canvas.height = spec.h * spec.frames;
  canvas.getContext('2d').putImageData(new ImageData(data, spec.w, spec.h * spec.frames), 0, 0);
  return canvas.toDataURL('image/png');
}

/** The plate's sheet: every flame title's rule - its sheet as the background, a frame the plate's height, stepped
 *  through its frames - and none of it moving where the player asked for less motion. */
export function flameCss(/** @type {(key: string) => string|null} */ urlOf) {
  const rules = [
    `.${FLAME_CLASS} { position: relative; width: fit-content; line-height: 1; padding: .26em .62em .24em; border-radius: .3em;
  background-repeat: repeat-x; background-position: 0 0;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 .55em, #000 calc(100% - .55em), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 .55em, #000 calc(100% - .55em), transparent); }`,
  ];
  for (const [key, spec] of Object.entries(TITLE_FLAME)) {
    const url = urlOf(key);
    if (!url) continue;
    const H = 1.5,
      all = (H * spec.frames).toFixed(2);
    rules.push(`.${flameClassOf(key)} { background-image: url("${url}"); background-size: auto ${all}em;
  animation: ${flameClassOf(key)} ${spec.seconds}s steps(${spec.frames}) infinite; }
@keyframes ${flameClassOf(key)} { from { background-position: 0 0; } to { background-position: 0 -${all}em; } }`);
  }
  rules.push(`@media (prefers-reduced-motion: reduce) { .${FLAME_CLASS} { animation: none !important; } }`);
  return rules.join('\n');
}

export const FLAME_STYLE_ID = 'dagger-title-flames';
/** @type {Promise<void>|null} the sheets being painted - asked once, however many faces ask meanwhile */
let laying = null;
/** The plates' sheet in the document, once - the first face that paints a flame title asks for it. Until the sheets are
 *  painted the letters stand on their own edge and glow; no canvas here (a pin, a probe), and nothing is laid. */
export function ensureTitleFlames(/** @type {any} */ doc = globalThis.document) {
  if (!doc?.head || doc.getElementById?.(FLAME_STYLE_ID) || laying) return laying;
  const keys = Object.keys(TITLE_FLAME),
    canvases = keys.map(() => doc.createElement?.('canvas'));
  if (!canvases.every((c) => c?.getContext?.('2d'))) return null;
  laying = Promise.all(keys.map((k, i) => flameSheetUrl(k, doc, canvases[i])))
    .then((urls) => {
      if (doc.getElementById?.(FLAME_STYLE_ID)) return;
      const st = doc.createElement('style');
      st.id = FLAME_STYLE_ID;
      st.textContent = flameCss((k) => urls[keys.indexOf(k)] ?? null);
      doc.head.append(st);
    })
    .finally(() => {
      laying = null;
    });
  return laying;
}

/** WYRM-RIDER: A TITLE'S METAL PLATE, all CSS - the rim and the face are the element's two pseudo-elements, cut to the
 *  plate's points behind the letters, so its glow (a drop shadow on the element) follows the points. */
export const PLATE_CLASS = 'dftitle-plate';
export const plateClassOf = (/** @type {string} */ key) => `${PLATE_CLASS}-${key}`;
const PLATE_CUT = 'polygon(.62em 0, calc(100% - .62em) 0, 100% 50%, calc(100% - .62em) 100%, .62em 100%, 0 50%)';
export function plateCss() {
  const rules = [
    `.${PLATE_CLASS} { position: relative; isolation: isolate; width: fit-content; line-height: 1; padding: .3em 1.45em .28em; }
.${PLATE_CLASS}::before, .${PLATE_CLASS}::after { content: ''; position: absolute; clip-path: ${PLATE_CUT}; pointer-events: none; }
.${PLATE_CLASS}::after { inset: 0; z-index: -2; }
.${PLATE_CLASS}::before { inset: 2px; z-index: -1; }`,
  ];
  for (const [key, p] of Object.entries(/** @type {Record<string, any>} */ (TITLE_PLATE))) {
    const way = p.across ? '90deg' : '180deg',
      c = `.${plateClassOf(key)}`,
      cc = `.${PLATE_CLASS}${c}`;
    const rivet = (/** @type {string} */ at) =>
      `radial-gradient(circle at ${at} 50%, ${p.rivet} .12em, transparent .16em)`;
    rules.push(`${c}::after { background: linear-gradient(${way}, ${p.rim.join(', ')}); }
${c}::before { background: ${rivet('.82em')}, ${rivet('calc(100% - .82em)')}, linear-gradient(${way}, ${p.face.join(', ')}); }
${cc} { text-shadow: 1px 1px 0 ${p.ink}, 0 0 3px #000; }${
      p.glow
        ? `
${cc} { filter: drop-shadow(0 0 .3em ${p.glow}a0); }`
        : ''
    }`);
  }
  return rules.join('\n');
}
/** The sheet itself, laid once (an export, so the sheets' walk reads its rules - test/sheetRules.mjs). */
export const TITLE_PLATE_CSS = plateCss();
export const PLATE_STYLE_ID = 'dagger-title-plates';
/** The plates' sheet in the document, once - plain CSS, laid at the first face that wears one. */
export function ensureTitlePlates(/** @type {any} */ doc = globalThis.document) {
  if (typeof doc?.head?.append !== 'function' || doc.getElementById?.(PLATE_STYLE_ID) || !doc.createElement) return;
  const st = doc.createElement('style');
  st.id = PLATE_STYLE_ID;
  st.textContent = TITLE_PLATE_CSS;
  doc.head.append(st);
}

/** A title's element given its plate, or none: `key` the title worn (the classes of any other flame come off). */
export function setTitleFlame(/** @type {any} */ node, /** @type {string|null|undefined} */ key) {
  const cl = node?.classList;
  if (!cl) return;
  const on = typeof key === 'string' && Object.hasOwn(TITLE_FLAME, key);
  for (const k of Object.keys(TITLE_FLAME)) cl.toggle?.(flameClassOf(k), on && k === key);
  cl.toggle?.(FLAME_CLASS, on);
  if (on) ensureTitleFlames(node.ownerDocument);
  const plate = typeof key === 'string' && Object.hasOwn(TITLE_PLATE, key); // WYRM-RIDER: or its metal plate
  for (const k of Object.keys(TITLE_PLATE)) cl.toggle?.(plateClassOf(k), plate && k === key);
  cl.toggle?.(PLATE_CLASS, plate);
  if (plate) ensureTitlePlates(node.ownerDocument);
}
