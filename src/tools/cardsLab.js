// THE CARD TABLE LAB (CARDS3, bible/11-Multiplayer/Tavern-Cards.md section 3). A tavern table with no tavern: a plain
// felt-topped box on a plain floor, its seats stood by world/cardTables.js, a seeded evening of the table
// (systems/cardTableSession.js - the player checking and calling, the patrons by their tempers) played to a pinned
// clock, and the cards and chips drawn by render/cardTableDraw.js through the game's own renderer, with the table's
// panel (ui/cardTableHud.js) over it. No game data: the felt and the floor are flat colours, the cards our own paint.
//     cards.html?t=<seconds>&cam=seat|over&seed=<n>&patrons=<n>&nohud     (tools/cardsProbe.mjs pins them)
import { Renderer } from '../render/renderer.js';
import { perspective, lookAt, mirrorProjectionX } from '../world/mat4.js';
import { cardTableSeats, tableFrame } from '../world/cardTables.js';
import { tablePlaces, CardScene } from '../world/cardScene.js';
import { CardTableSession } from '../systems/cardTableSession.js';
import { createCardTableDraw } from '../render/cardTableDraw.js';
import { createCardTableHud, cardHudModel, eventLine } from '../ui/cardTableHud.js';
import { INTERIOR_AMBIENT, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { heldMatrices } from '../world/cardHand.js';   // CARDS3b: the player's two held before the eye, as the host draws them

const params = new URLSearchParams(location.search);
const T = Number(params.get('t') ?? 14);
const camKind = params.get('cam') ?? 'seat';
const seed = Number(params.get('seed') ?? 4) >>> 0;
const patronCount = Math.max(1, Math.min(5, Number(params.get('patrons') ?? 3)));

const canvas = document.getElementById('c');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
const renderer = new Renderer(canvas);

/** A flat colour as a 4x4 color32. */
const flat = (r, g, b) => ({ width: 4, height: 4, colors: new Uint8ClampedArray(Array.from({ length: 16 }, () => [r, g, b, 255]).flat()) });
renderer.uploadTexture('cardslab', 'felt', flat(28, 92, 52));
renderer.uploadTexture('cardslab', 'wood', flat(92, 60, 34));
renderer.uploadTexture('cardslab', 'floor', flat(70, 56, 44));

/** A box from `min` to `max` on one texture: `top` its top face's texture, the rest `side`. */
function boxModel(min, max, top, side) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const faces = [
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], top],
    [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], side],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], side],
    [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], side],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], side],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], side],
  ];
  const positions = [], normals = [], uvs = [], indices = [], subMeshes = [];
  for (const tex of [top, side]) {
    const start = indices.length;
    for (const f of faces) {
      if (f[5] !== tex) continue;
      const base = positions.length / 3;
      for (let i = 0; i < 4; i++) { positions.push(...f[i]); normals.push(...f[4]); uvs.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    subMeshes.push({ textureArchive: 'cardslab', textureRecord: tex, startIndex: start, primitiveCount: (indices.length - start) / 3 });
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices), subMeshes };
}

// The table: 2 m by 1 m, its top at 0.8 m, on a floor.
const table = { aabb: { min: [-1, 0, -0.5], max: [1, 0.8, 0.5] } };
const tableMesh = renderer.createMesh(boxModel([-1, 0.74, -0.5], [1, 0.8, 0.5], 'felt', 'wood'));
const legs = [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].map(([x, z]) => renderer.createMesh(boxModel([x - 0.04, 0, z - 0.04], [x + 0.04, 0.74, z + 0.04], 'wood', 'wood')));
const floorMesh = renderer.createMesh(boxModel([-6, -0.02, -6], [6, 0, 6], 'floor', 'floor'));
const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const seats = cardTableSeats(table, () => true);
const frame = tableFrame(table);
const seatOf = Array.from({ length: patronCount + 1 }, (_, i) => i);
const places = tablePlaces(frame, seats, seatOf);
let x = seed || 1;
const rand32 = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; };
const names = ['Ana Vell', 'Bors Thane', 'Cael Dunmore', 'Dun Arbek', 'Eira Moss'].slice(0, patronCount);
const session = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: names.map((n, i) => ({ id: `patron:${i}`, name: n, temper: ['loose', 'tight', 'bluffer'][i % 3], stack: 400 + 100 * i })), stakes: { sb: 5, bb: 10 }, rand32, now: 0 });
const scene = new CardScene({ places, playerSeat: 0, tableSeed: seed });
const draw = createCardTableDraw(renderer);
const log = [];
const holeOf = (seat, k) => { const v = session.view(); const i = v.handSeats.indexOf(seat); return v.hand && i >= 0 && v.hand.seats[i].hole ? v.hand.seats[i].hole[k] : -1; };
// Play the evening to the pinned clock, 50 ms a step, the player checking and calling.
for (let now = 0; now <= T * 1000; now += 50) {
  session.tick(now);
  const l = session.legal();
  if (l) session.playerAct(l.check ? { type: 'check' } : { type: 'call' }, now);
  for (const e of session.drain()) { scene.onEvent(e, holeOf); const line = eventLine(e, session.seats.map((s) => s.name), session.playerSeat); if (line) log.push(line); }
  scene.poses(now / 1000, session.view());
}

if (!params.has('nohud')) {
  const hud = createCardTableHud({ onPress: () => {} });
  hud.render(cardHudModel({ phase: 'playing', view: session.view(), legal: session.legal(), stakes: { sb: 5, bb: 10 }, log }));
}

/** AUDIT CARDS-2 M10: the frame read back - what the probe can check of the picture itself. */
const readFrame = () => { const px = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };

function frameDraw(withCards = true, asBacks = false) {
  const aspect = canvas.width / canvas.height;
  const proj = mirrorProjectionX(perspective((60 * Math.PI) / 180, aspect, 0.02, 100));
  const s = seats[0];
  // 'near': straight down over the player's own cards and the board's head, close; 'over': the whole table; 'seat': his eye
  const near = places.seats[0].holes[0];
  const eye = camKind === 'over' ? [frame.centre[0] + 0.9, 2.2, frame.centre[2] + 1.4] : camKind === 'near' ? [near[0] - 0.12, 1.15, near[2] + 0.001] : camKind === 'board' ? [frame.centre[0], 1.35, frame.centre[2] + 0.001] : s.eye;
  const at = camKind === 'near' ? [near[0] - 0.12, 0.8, near[2]] : camKind === 'board' ? [frame.centre[0], 0.8, frame.centre[2]] : [frame.centre[0], frame.centre[1], frame.centre[2]];
  const view = lookAt(eye, at, camKind === 'near' ? [-1, 0, 0] : camKind === 'board' ? [0, 0, -1] : [0, 1, 0]);   // 'near' reads as the sitter does: the cards' tops away from him
  renderer.setLighting(new Float32Array([0.42, 0.40, 0.36]), 0.9, new Float32Array([1, 0.95, 0.85]));
  renderer.setFog('exp2', 0.0001, 0, 0, [0, 0, 0, 1]);
  renderer.setClearColor([0.05, 0.04, 0.03, 1]);
  renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
  renderer.drawMesh(floorMesh, IDENT, null);
  renderer.drawMesh(tableMesh, IDENT, null);
  for (const m of legs) renderer.drawMesh(m, IDENT, null);
  const p = scene.poses(T, session.view());
  // CARDS3b: from the seat, the player's settled two held up (`peek` 0..1 from the page's query), as worldModes cardDrawGame
  if (camKind === 'seat') {
    const held = p.cards.filter((c) => c.seat === 0 && c.settled && Math.cos(c.roll) > 0.5).sort((a, b) => (a.id < b.id ? -1 : 1));
    const mats = heldMatrices(view, held.length, Number(params.get('peek') ?? 0));
    p.cards = [...p.cards.filter((c) => !held.includes(c)), ...held.map((c, i) => ({ card: c.card, matrix: mats[i] }))];
  }
  if (withCards) draw.draw(asBacks ? { ...p, cards: p.cards.map((c) => ({ ...c, card: -1 })) } : p);
}
// The table alone, its cards drawn every one as a back, then as dealt: the pixels the cards and chips change, and the
// pixels a FACE paints (the dealt frame against the all-backs one) - a frame that culls or loses the faces has none of
// those, and the probe fails it
const differ = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >= 24;
frameDraw(false);
const bare = readFrame();
frameDraw(true, true);
const backs = readFrame();
frameDraw(true);
const shown = readFrame();
let cardPixels = 0, facePixels = 0;
for (let i = 0; i < shown.length; i += 4) { if (differ(shown, bare, i)) cardPixels++; if (differ(shown, backs, i)) facePixels++; }
const poses = scene.poses(T, session.view());
window.__cardsReady = true;
window.__cardsState = { street: session.view().hand?.street ?? null, cards: poses.cards.length, faceUp: poses.cards.filter((c) => Math.cos(c.roll) > 0.5).length, chips: poses.chips.length, cardPixels, facePixels, log: log.slice(-4), ambient: INTERIOR_AMBIENT };
