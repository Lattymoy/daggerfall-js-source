// WD3 (2026-10-01): FLATS DAGGERFALL DRAWS NOTHING LIKE - the port's own sprites, drawn in code.
//
// Daggerfall Expanded Textures fills the towns Beautiful Villages and Beautiful Cities lay out with its own flats - a
// farm's chickens and sheep, the rock doves on a city's walls, a table's cheese and grapes and porridge - and a few
// of them stand on Detailed Ships' decks. Where Daggerfall has a sprite of the same thing (a horse, a cow, a dog, a
// sack, a globe) the stand-in is that sprite, rebuilt from the player's own files (world/detStandIns.js); where it
// has none, it is one of these: small pictures at Daggerfall's own pixel (one pixel is 2.5 cm at a record scale of
// 0), outlined and lit from the upper left like the game's own, transparent round the subject (a flat is a cut-out).
// Deterministic: the same picture every time, no file.

class Sprite {
  constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8Array(w * h * 4); }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
  }
  opaque(x, y) { return this.inside(x, y) && this.data[(y * this.width + x) * 4 + 3] !== 0; }
  /** A filled ellipse centred (cx, cy), radii rx, ry; `shade` lightens toward the upper left and darkens away. */
  ellipse(cx, cy, rx, ry, c, shade = 0.25) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
      if (u * u + v * v > 1) continue;
      this.set(x, y, lit(c, (-u - v) * 0.5 * shade));
    }
  }
  /** A filled polygon (even-odd), flat colour. */
  poly(points, c) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = 0; x < this.width; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, c);
    }
  }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c);
  }
  /** The game's outline: every opaque pixel with a clear neighbour darkened. */
  outline(amount = 0.45) {
    const edge = [];
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (!this.opaque(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !this.opaque(x + a, y + b))) edge.push((y * this.width + x) * 4);
    }
    for (const i of edge) for (let k = 0; k < 3; k++) this.data[i + k] = Math.round(this.data[i + k] * (1 - amount));
    return this;
  }
  picture() { return { width: this.width, height: this.height, data: this.data }; }
}
const lit = (c, t) => c.map((v) => Math.max(0, Math.min(255, Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)))));

// ---- colours -------------------------------------------------------------------------------------------------------
const K = Object.freeze({
  cheese: [222, 178, 62], rind: [176, 120, 40], hole: [168, 120, 40], cream: [226, 214, 176], bowl: [112, 74, 42],
  red: [168, 28, 34], stem: [70, 90, 36], pear: [176, 178, 64], plum: [94, 42, 96], peach: [226, 140, 92], olive: [70, 86, 40],
  grape: [86, 40, 92], whiteGrape: [170, 190, 92], cabbage: [96, 150, 70], cabbageDark: [58, 104, 48], glassGreen: [60, 120, 70],
  glassBrown: [118, 76, 36], wood: [140, 96, 54], woodDark: [92, 60, 32], platter: [150, 150, 156], roast: [150, 82, 40],
  grain: [206, 168, 84], straw: [214, 186, 102], canvas: [222, 210, 182], brownFur: [118, 80, 48], white: [232, 228, 218],
  feather: [140, 96, 56], comb: [196, 34, 30], beak: [218, 168, 48], greyFeather: [150, 152, 158], dove: [128, 132, 142],
  wool: [226, 222, 206], face: [64, 56, 52], rat: [112, 92, 72], blackRat: [52, 50, 52], toyRed: [178, 52, 40], toyBlue: [58, 88, 160],
  toyYellow: [216, 180, 60], sky: [126, 160, 200], hill: [90, 120, 70], dark: [40, 34, 30],
});

// ---- the food ------------------------------------------------------------------------------------------------------
function cherries() {
  const s = new Sprite(8, 8);
  s.line(3, 0, 2, 4, K.stem); s.line(4, 0, 5, 4, K.stem);
  s.ellipse(2, 5.5, 2, 2, K.red); s.ellipse(5.5, 5.5, 2, 2, K.red);
  return s.outline().picture();
}
function pear() { const s = new Sprite(8, 12); s.line(4, 0, 4, 2, K.stem); s.ellipse(4, 4, 2, 2.5, K.pear); s.ellipse(4, 8, 3.5, 3.5, K.pear); return s.outline().picture(); }
function plum() { const s = new Sprite(8, 8); s.line(4, 0, 4, 1, K.stem); s.ellipse(4, 4.5, 3.5, 3.2, K.plum, 0.4); return s.outline().picture(); }
function peach() { const s = new Sprite(9, 9); s.ellipse(4.5, 4.8, 4, 3.8, K.peach, 0.35); s.line(4, 1, 5, 4, lit(K.peach, -0.25)); return s.outline().picture(); }
function olives() {
  const s = new Sprite(12, 7);
  s.ellipse(6, 4.5, 6, 2.5, K.platter, 0.2);
  for (const [x, y] of [[3, 3], [5, 2.5], [7, 3], [9, 3.2], [4.5, 4], [6.5, 4], [8, 4.2]]) s.ellipse(x, y, 1.1, 0.9, K.olive, 0.3);
  return s.outline(0.35).picture();
}
/** A cheese wheel, lying: its top face, its rind round the side; `missing` cuts a wedge out of the front. */
function cheeseWheel(missing = false) {
  const s = new Sprite(16, 10);
  s.ellipse(8, 6, 7.5, 3.5, K.rind, 0.1);
  s.rect(1, 3, 15, 6, K.rind);
  s.ellipse(8, 3.5, 7.5, 3, K.cheese, 0.2);
  if (missing) {   // the wedge cut: the two cut faces, paler than the rind and lit across
    s.poly([[8, 3.5], [11.5, 6.5], [11.5, 9.2], [8, 6.2]], lit(K.cheese, 0.18));
    s.poly([[8, 3.5], [15.5, 4.6], [15.5, 7.2], [8, 6.2]], lit(K.cheese, -0.08));
    s.line(8, 3.5, 8, 6.2, K.rind);
  }
  return s.outline().picture();
}
function cheeseSlice(holes = false) {
  const s = new Sprite(10, 7);
  s.poly([[0, 6], [9.5, 6], [9.5, 3], [1, 1]], K.cheese);
  s.line(0, 6, 9, 6, K.rind); s.line(9, 3, 9, 6, K.rind);
  if (holes) for (const [x, y] of [[3, 4], [6, 3], [7, 5]]) s.set(x, y, K.hole);
  return s.outline().picture();
}
function softCheese() { const s = new Sprite(11, 7); s.ellipse(5.5, 4, 5, 2.5, K.cream, 0.25); s.rect(1, 4, 9, 5, lit(K.cream, -0.1)); return s.outline().picture(); }
function roastPlatter() {
  const s = new Sprite(24, 11);
  s.ellipse(12, 7.5, 11.5, 3, K.platter, 0.25);
  s.ellipse(12, 5, 7, 3.5, K.roast, 0.35);
  s.ellipse(18, 4.5, 2.6, 2.2, lit(K.roast, -0.1), 0.3);   // the head
  s.set(20, 4, K.red);                                     // the apple in its mouth
  s.line(7, 7, 6, 9, lit(K.roast, -0.3)); s.line(15, 7, 16, 9, lit(K.roast, -0.3));
  return s.outline(0.35).picture();
}
function porridge() { const s = new Sprite(12, 8); s.ellipse(6, 5, 5.5, 3, K.bowl, 0.2); s.rect(1, 3, 10, 5, K.bowl); s.ellipse(6, 3, 5, 1.7, K.cream, 0.15); return s.outline().picture(); }
function grapes(c) {
  const s = new Sprite(9, 12);
  s.line(4, 0, 5, 2, K.stem);
  for (const [x, y] of [[2.5, 3.5], [4.5, 3], [6.5, 3.5], [3.5, 5.5], [5.5, 5.5], [2.8, 7.4], [4.6, 7.6], [6.2, 7.2], [4, 9.5], [5.4, 9.6]]) s.ellipse(x, y, 1.3, 1.3, c, 0.45);
  return s.outline(0.35).picture();
}
function cabbage() {
  const s = new Sprite(12, 11);
  s.ellipse(6, 6, 5.5, 4.8, K.cabbage, 0.35);
  for (const k of [-3, 0, 3]) s.line(6, 2, 6 + k, 10, K.cabbageDark);
  return s.outline().picture();
}
function brokenBottles() {
  const s = new Sprite(18, 6);
  s.poly([[0, 5], [4, 3], [6, 5]], K.glassGreen); s.poly([[5, 5], [8, 1], [10, 5]], K.glassBrown);
  s.poly([[11, 5], [13, 3], [17, 5]], K.glassGreen); s.ellipse(14.5, 2, 1.2, 1, K.glassGreen, 0.5);   // a neck, whole
  s.set(7, 2, lit(K.glassBrown, 0.5)); s.set(3, 4, lit(K.glassGreen, 0.5));
  return s.outline(0.3).picture();
}
function rollingPin() { const s = new Sprite(16, 4); s.rect(3, 1, 12, 2, K.wood); s.rect(0, 1, 2, 2, K.woodDark); s.rect(13, 1, 15, 2, K.woodDark); s.line(3, 1, 12, 1, lit(K.wood, 0.25)); return s.outline().picture(); }
function blockToy() {
  const s = new Sprite(11, 8);
  s.rect(0, 4, 3, 7, K.toyRed); s.rect(4, 4, 7, 7, K.toyBlue); s.rect(2, 0, 5, 3, K.toyYellow); s.rect(8, 5, 10, 7, K.toyYellow);
  return s.outline(0.35).picture();
}
function grainPile() { const s = new Sprite(16, 7); s.ellipse(8, 6, 7.5, 5, K.grain, 0.3); for (let k = 0; k < 12; k++) s.set(2 + ((k * 7) % 13), 3 + ((k * 3) % 4), lit(K.grain, 0.3)); return s.outline(0.3).picture(); }
function wheatBundle() {
  const s = new Sprite(11, 20);
  for (let k = -4; k <= 4; k++) s.line(5.5, 19, 5.5 + k * 0.9, 4, K.straw);
  for (let k = -4; k <= 4; k += 2) s.ellipse(5.5 + k * 0.95, 3, 1, 2.5, K.grain, 0.3);
  s.rect(3, 12, 8, 13, K.woodDark);   // the band that ties it
  return s.outline(0.3).picture();
}
function firewood() {
  const s = new Sprite(20, 11);
  for (const [x, y] of [[3, 8], [8, 8], [13, 8], [17, 8], [5.5, 4], [10.5, 4], [15, 4], [8, 1.2]]) { s.ellipse(x, y, 2.6, 2.4, K.woodDark, 0.1); s.ellipse(x, y, 1.6, 1.4, K.wood, 0.2); }
  return s.outline().picture();
}
/** A painter's canvas on its easel: three legs, the canvas with a landscape begun on it. */
function easel() {
  const s = new Sprite(22, 34);
  s.line(4, 33, 9, 2, K.woodDark); s.line(17, 33, 12, 2, K.woodDark); s.line(11, 33, 11, 20, K.woodDark);
  s.rect(2, 4, 19, 19, K.canvas);
  s.rect(4, 6, 17, 11, K.sky); s.poly([[4, 17], [4, 12], [9, 9], [13, 12], [17, 10], [17, 17]], K.hill);
  s.rect(1, 19, 20, 20, K.wood);   // the ledge it stands on
  return s.outline(0.4).picture();
}

// ---- the animals ---------------------------------------------------------------------------------------------------
/** A chicken side-on, facing left; `pose` 'stand' | 'peck' | 'look'; a rooster has the comb, the wattle and the tail. */
function chicken(body, pose = 'stand', rooster = false) {
  const s = new Sprite(14, 14);
  const head = pose === 'peck' ? [3, 9.5] : pose === 'look' ? [4.5, 3.2] : [3.2, 4];
  if (rooster) for (const [x, y] of [[11, 2], [12, 4], [12.5, 6]]) s.ellipse(x, y, 1.4, 2.6, lit(body, -0.35), 0.2);   // the tail's sickles
  s.ellipse(8, 8, 5, 3.6, body, 0.3);
  s.ellipse(head[0], head[1], 2.1, 2, body, 0.3);
  s.line(head[0] + 1, head[1] + 1, 6, 7, body);   // the neck
  s.set(head[0] - 2.4, head[1] + 0.3, K.beak); s.set(head[0] - 3, head[1] + 0.6, K.beak);
  s.set(head[0] - 0.6, head[1] - 0.4, K.dark);
  s.set(head[0], head[1] - 2, K.comb); if (rooster) { s.set(head[0] + 1, head[1] - 2.2, K.comb); s.set(head[0] - 1, head[1] - 2, K.comb); s.set(head[0] - 1.3, head[1] + 1.8, K.comb); }
  s.line(7, 11, 7, 13, K.beak); s.line(9, 11, 9, 13, K.beak);
  return s.outline(0.4).picture();
}
/** A sheep: 'side' facing left, 'front', or 'rest' (lying down). */
function sheep(pose = 'side') {
  if (pose === 'front') {
    const s = new Sprite(20, 22);
    s.ellipse(10, 11, 8.5, 7, K.wool, 0.25);
    s.ellipse(10, 9, 3.2, 4, K.face, 0.2); s.set(8.6, 8, K.white); s.set(11.4, 8, K.white);
    s.ellipse(5.6, 6.5, 1.8, 1, K.face, 0.1); s.ellipse(14.4, 6.5, 1.8, 1, K.face, 0.1);   // the ears
    s.rect(6, 17, 7, 21, K.face); s.rect(13, 17, 14, 21, K.face);
    return s.outline(0.4).picture();
  }
  if (pose === 'rest') {
    const s = new Sprite(28, 14);
    s.ellipse(15, 8.5, 11.5, 5, K.wool, 0.25);
    s.ellipse(4, 6.5, 3, 2.6, K.face, 0.2); s.set(3, 5.8, K.white);
    s.rect(9, 12, 13, 13, K.face);
    return s.outline(0.4).picture();
  }
  const s = new Sprite(30, 22);
  s.ellipse(16, 10, 11, 7, K.wool, 0.25);
  s.ellipse(5, 8, 3.2, 3.8, K.face, 0.2); s.set(3.8, 7, K.white); s.ellipse(6.8, 5.4, 1.8, 0.9, K.face, 0.1);
  for (const x of [9, 12, 20, 23]) s.rect(x, 15, x + 1, 21, K.face);
  return s.outline(0.4).picture();
}
/** A rat side-on, facing left; `sitting` up on its haunches. */
function rat(fur, sitting = false) {
  if (sitting) {
    const s = new Sprite(10, 11);
    s.ellipse(5, 7, 3.2, 3.6, fur, 0.3); s.ellipse(4, 3, 2.2, 2, fur, 0.3);
    s.set(2.5, 2.5, K.dark); s.set(3, 0.8, lit(fur, 0.2)); s.set(5, 0.8, lit(fur, 0.2));
    s.line(8, 10, 9.5, 8, lit(fur, 0.15));
    return s.outline(0.4).picture();
  }
  const s = new Sprite(14, 6);
  s.ellipse(7, 3.2, 4.2, 2.4, fur, 0.3); s.ellipse(2.8, 3, 2, 1.6, fur, 0.3);
  s.set(1.8, 2.4, K.dark); s.set(3.2, 1.2, lit(fur, 0.25));
  s.line(11, 3.5, 13.6, 5, lit(fur, 0.2));
  return s.outline(0.4).picture();
}
/** A rock dove on a wall top: 'stand', 'peck' or 'wing' (a wing half lifted). */
function dove(pose = 'stand') {
  const s = new Sprite(10, 8);
  s.ellipse(5.5, 4.8, 3.6, 2.4, K.dove, 0.3);
  if (pose === 'peck') s.ellipse(2, 5.5, 1.6, 1.4, K.dove, 0.3); else s.ellipse(2.4, 2.6, 1.6, 1.5, K.dove, 0.3);
  s.poly([[8, 4], [10, 2.5], [10, 5.5]], lit(K.dove, -0.25));   // the tail
  if (pose === 'wing') s.poly([[4, 4], [7, 0.5], [8, 3.5]], lit(K.dove, 0.2));
  s.set(pose === 'peck' ? 0.6 : 1, pose === 'peck' ? 6 : 2.8, K.beak);
  s.set(pose === 'peck' ? 2 : 2.2, pose === 'peck' ? 5 : 2.2, K.dark);
  s.set(4, 4.2, [74, 120, 110]);   // the neck's sheen
  s.line(5, 7, 5, 7.6, K.red); s.line(6.4, 7, 6.4, 7.6, K.red);
  return s.outline(0.4).picture();
}
/** A monkey sitting, facing out. */
function monkey() {
  const s = new Sprite(14, 16);
  s.line(11, 14, 13, 8, K.brownFur); s.line(13, 8, 12, 5, K.brownFur);   // the tail
  s.ellipse(7, 10.5, 4.2, 4.5, K.brownFur, 0.3);
  s.ellipse(7, 4.5, 3.4, 3.3, K.brownFur, 0.3);
  s.ellipse(7, 5.3, 2.2, 1.8, [196, 156, 120], 0.2);   // the face
  s.set(6, 4.5, K.dark); s.set(8, 4.5, K.dark);
  s.ellipse(3.3, 4, 1.1, 1.3, [196, 156, 120], 0.1); s.ellipse(10.7, 4, 1.1, 1.3, [196, 156, 120], 0.1);
  return s.outline(0.4).picture();
}

/** Every drawn sprite by name - what world/detStandIns.js's tables point at. */
export const STAND_IN_SPRITES = Object.freeze({
  cherries, pear, plum, peach, olives, cheeseWheel: () => cheeseWheel(false), cheeseWheelCut: () => cheeseWheel(true),
  cheeseSlice: () => cheeseSlice(false), cheeseSliceHoles: () => cheeseSlice(true), softCheese, roastPlatter, porridge,
  grapes: () => grapes(K.grape), whiteGrapes: () => grapes(K.whiteGrape), cabbage, brokenBottles, rollingPin, blockToy,
  grainPile, wheatBundle, firewood, easel, monkey,
  brownRooster: () => chicken(K.feather, 'stand', true), brownChickenPecking: () => chicken(K.feather, 'peck'),
  brownChicken: () => chicken(K.feather, 'stand'), brownChickenLooking: () => chicken(K.feather, 'look'),
  whiteChickenLooking: () => chicken(K.white, 'look'), whiteChicken: () => chicken(K.white, 'stand'),
  whiteChickenPecking: () => chicken(K.white, 'peck'), whiteRooster: () => chicken(K.white, 'stand', true),
  sheep: () => sheep('side'), sheepFront: () => sheep('front'), sheepResting: () => sheep('rest'),
  brownRat: () => rat(K.rat), blackRat: () => rat(K.blackRat), blackRatSitting: () => rat(K.blackRat, true),
  dove: () => dove('stand'), dovePecking: () => dove('peck'), doveWing: () => dove('wing'),
});
