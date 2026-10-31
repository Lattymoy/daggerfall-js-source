// @ts-check
// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased";
// bible/06-Systems/Aurum.md): THE AURUM'S PICTURES, drawn in code - the coin itself (struck with the sun of Aetherius,
// its rim milled), which stands beside every balance and price, and a pack's picture by how much it gives: one coin, a
// fan of three, a heap, a coffer brimming. A reward on the pass shows the coin. Not a DFU member.

const NS = 'http://www.w3.org/2000/svg';
let _ids = 0;
/** @type {Readonly<Record<string, [string, Record<string, string|number>, Array<[number, string, number?]>]>>} each paint: its kind, its frame, its stops */
const COIN_PAINT = Object.freeze({
  face: ['radialGradient', { cx: '38%', cy: '32%', r: '72%' }, [[0, '#fffbe6'], [0.25, '#ffe58a'], [0.6, '#e8b23a'], [0.9, '#a8661a'], [1, '#6a3a0a']]],
  rim: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff6c8'], [0.4, '#f2c25a'], [0.7, '#b8781e'], [1, '#5a3008']]],
  sun: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff'], [0.5, '#fff2b0'], [1, '#f2c25a']]],
  glow: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffe58a', 0.55], [1, '#ffe58a', 0]]],
  wood: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#7a4a24'], [0.5, '#4a2a12'], [1, '#2a1608']]],
  band: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#fff0c0'], [0.4, '#c9963a'], [1, '#5a3a12']]],
});
const f = (/** @type {number} */ n) => Math.round(n * 100) / 100;
/** The sun of Aetherius struck on a coin's face at (cx, cy), `r` its reach: twelve rays about a disc. */
const sunRays = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r) => {
  const pts = [];
  for (let i = 0; i < 24; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 12, rr = i % 2 ? r * 0.55 : r; pts.push(`${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`); }
  return `M${pts.join(' L')} Z`;
};
/** One coin's shapes at (cx, cy), `r` its radius, `tilt` its squash (1 face on, less seen at a slant). */
const coin = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r, tilt = 1) => {
  const ry = r * tilt;
  return [
    ['ellipse', { cx, cy: cy + r * 0.12, rx: r, ry, fill: '#3a2006' }],
    ['ellipse', { cx, cy, rx: r, ry, fill: 'url(#rim)', stroke: '#3a2006', 'stroke-width': r * 0.06 }],
    ['ellipse', { cx, cy, rx: r * 0.98, ry: ry * 0.98, fill: 'none', stroke: '#fff6c8', 'stroke-width': r * 0.05, 'stroke-dasharray': `${f(r * 0.06)} ${f(r * 0.1)}`, opacity: 0.6 }],
    ['ellipse', { cx, cy, rx: r * 0.8, ry: ry * 0.8, fill: 'url(#face)', stroke: '#8a5212', 'stroke-width': r * 0.05 }],
    ['g', { transform: `translate(${cx} ${cy}) scale(1 ${tilt}) translate(${-cx} ${-cy})` }, [
      ['path', { d: sunRays(cx, cy, r * 0.62), fill: '#c9861e', opacity: 0.55 }],
      ['circle', { cx, cy, r: r * 0.28, fill: 'url(#sun)', stroke: '#a8661a', 'stroke-width': r * 0.04 }],
    ]],
    ['path', { d: `M${f(cx - r * 0.62)} ${f(cy - ry * 0.3)} Q${f(cx - r * 0.5)} ${f(cy - ry * 0.68)} ${f(cx - r * 0.1)} ${f(cy - ry * 0.72)}`, stroke: '#ffffff', 'stroke-width': r * 0.09, fill: 'none', 'stroke-linecap': 'round', opacity: 0.75 }],
  ];
};
/** A pack's or a reward's picture, by its Aurum: the coin, three fanned, a heap, a coffer brimming. */
function sceneOf(/** @type {number} */ n) {
  if (n >= 5000) {
    return [
      ['ellipse', { cx: 32, cy: 50, rx: 25, ry: 6, fill: '#000000', opacity: 0.35 }],
      ['path', { d: 'M10 30 L54 30 L51 52 L13 52 Z', fill: 'url(#wood)', stroke: '#1a0c04', 'stroke-width': 1 }],
      ['path', { d: 'M10 30 L54 30 L53.4 34 L10.6 34 Z M12 45 L52 45 L51.4 49 L12.6 49 Z', fill: 'url(#band)', stroke: '#2a1806', 'stroke-width': 0.6 }],
      ['rect', { x: 29, y: 34, width: 6, height: 8, rx: 1, fill: 'url(#band)', stroke: '#2a1806', 'stroke-width': 0.6 }],
      ['circle', { cx: 32, cy: 38, r: 1.2, fill: '#1a0c04' }],
      ['path', { d: 'M12 30 Q14 20 22 21 Q26 14 33 17 Q40 13 44 19 Q52 18 52 30 Z', fill: '#e8b23a', stroke: '#8a5212', 'stroke-width': 0.8 }],
      ...coin(22, 22, 6, 0.55), ...coin(40, 20, 6.4, 0.6), ...coin(31, 15, 6.8, 0.7), ...coin(46, 26, 5, 0.5), ...coin(16, 27, 4.6, 0.5),
      ['path', { d: 'M48 10 L49 13 L52 14 L49 15 L48 18 L47 15 L44 14 L47 13 Z', fill: '#ffffff' }],
    ];
  }
  if (n >= 2000) {
    return [
      ['ellipse', { cx: 32, cy: 50, rx: 22, ry: 5, fill: '#000000', opacity: 0.35 }],
      ['path', { d: 'M10 50 Q14 34 24 30 Q32 22 40 30 Q50 34 54 50 Z', fill: '#e8b23a', stroke: '#8a5212', 'stroke-width': 0.8 }],
      ...coin(20, 44, 6.4, 0.5), ...coin(44, 44, 6.4, 0.5), ...coin(32, 42, 7, 0.55), ...coin(26, 33, 6.4, 0.55), ...coin(38, 33, 6.4, 0.55), ...coin(32, 24, 7.2, 0.7),
    ];
  }
  if (n >= 1000) return [...coin(20, 36, 10, 0.8), ...coin(44, 36, 10, 0.8), ...coin(32, 30, 12.4, 0.92)];
  return coin(32, 32, 19, 1);
}

/**
 * THE AURUM'S PICTURE, `size` px: the coin alone (`n` 0, the balance's mark), or a pack's or a reward's by its Aurum,
 * set in a field of its own light. An `<svg>`, or null for a document that cannot make one.
 * @param {any} doc @param {number} [n] @param {number} [size] @param {string} [cls]
 */
export function aurumArtNode(doc, n = 0, size = 48, cls = 'aurum-art') {
  if (typeof doc?.createElementNS !== 'function') return null;
  const id = `aurum-${++_ids}`;
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}) => { const e = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
  const own = (/** @type {unknown} */ v) => (typeof v === 'string' ? v.replace(/url\(#(\w+)\)/g, (_, m) => `url(#${id}-${m})`) : v);
  /** @returns {any} */
  const build = (/** @type {any} */ [tag, attrs, kids = []]) => {
    const e = node(tag, Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, own(v)])));
    for (const k of kids) e.append(build(k));
    return e;
  };
  const svg = node('svg', { viewBox: '0 0 64 64', width: size, height: size, class: cls, 'aria-hidden': 'true' });
  const defs = node('defs');
  for (const [name, [type, attrs, stops]] of Object.entries(COIN_PAINT)) {
    const g = node(type, { id: `${id}-${name}`, ...attrs });
    for (const [o, c, a = 1] of stops) g.append(node('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }));
    defs.append(g);
  }
  svg.append(defs);
  if (n > 0) svg.append(build(['circle', { cx: 32, cy: 34, r: 30, fill: 'url(#glow)' }]));
  for (const s of n > 0 ? sceneOf(n) : coin(32, 32, 30, 1)) svg.append(build(s));
  return svg;
}
