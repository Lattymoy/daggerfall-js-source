// @ts-check
// PVP-SKULL (the owner, 2026-10-29: "no skull when not", "when you agro skull turns gold", "make the gold and red glow
// sloightly", the mockup he picked - /mnt/project-files/pvp-rework/skull-mockup-3.png): the 16-pixel skull over a flagged
// player's name and on the flag button - white flagged, gold in aggro, red a villain. One drawing, three tints, as an
// SVG data URL so any face can wear it as an image. A departure: DFU has no PvP mark.

/** The drawing: O outline, E socket, L bone, S shade, H light. */
export const SKULL_ROWS = Object.freeze([
  '....OOOOOOOO....',
  '..OOLLLLLLLLOO..',
  '.OLHHLLLLLLLLSO.',
  'OLHHLLLLLLLLLLSO',
  'OLHLLLLLLLLLLLSO',
  'OLLEEEELLEEEELSO',
  'OLEEEEELLEEEEESO',
  'OLEEEEELLEEEEESO',
  'OLLEEELLLLEEELSO',
  'OSLLLLLEELLLLLSO',
  '.OSLLLLEELLLLSO.',
  '..OSSLLLLLLSSO..',
  '...OLLOLLOLLO...',
  '...OSSOSSOSSO...',
  '...OOOOOOOOOO...',
  '................',
]);

/** Each kind's bone, shade and light. */
export const SKULL_TINTS = Object.freeze({
  white: ['#ece6d6', '#b3a88f', '#ffffff'],
  gold: ['#e8b62c', '#a0720e', '#ffe27a'],
  red: ['#d42a1e', '#86120a', '#ff7d6b'],
});

const cache = new Map();

/** The skull of `kind` as an SVG data URL, or '' for no kind. */
export function skullSrc(kind) {
  const tint = SKULL_TINTS[kind];
  if (!tint) return '';
  if (cache.has(kind)) return cache.get(kind);
  const ink = { O: '#140f0b', E: '#140f0b', L: tint[0], S: tint[1], H: tint[2] };
  let rects = '';
  SKULL_ROWS.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (ink[c]) rects += `<rect x='${x}' y='${y}' width='1' height='1' fill='${ink[c]}'/>`;
    }),
  );
  const src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'>${rects}</svg>`)}`;
  cache.set(kind, src);
  return src;
}

/** The soft glow gold and red wear (white none), as a CSS filter. */
export const skullGlow = (kind) =>
  kind === 'gold' || kind === 'red' ? `drop-shadow(0 0 3px ${SKULL_TINTS[kind][0]})` : '';
