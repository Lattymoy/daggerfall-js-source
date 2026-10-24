// BEACON-TOWER (2026-10-11, Mac: "The lighthouse model is insanely good but way too modern for daggerfall's lore") - THE
// ILIAC BAY'S LIGHT IS A BEACON: world/lighthouseModel.js's tower of bare stone, its corbel table and battlemented
// parapet, its open arched lantern under a slate cone, the brazier's coals and the flames over them; world/portArt.js's
// flame (a cutout) and embers (their own light); scenes/portHost.js's draw, collider, upload and words. Each pinned on the
// producer's own output - the built model, the host's own frames, the real collider's rays (TEST THE SHAPE THE PRODUCER
// MINTS). bible/03-World/Shipyards.md, BEACON-TOWER.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLighthouseModel, buildLighthouseFire, LIGHTHOUSE, LIGHTHOUSE_POINTS, GALLERY_Y, LANTERN_H, ARCH_CROWN, TOWER_SIDES,
} from '../../src/world/lighthouseModel.js';
import { PORT_REC, PORT_HOW, PORT_ARCHIVE, PORT_PAINTERS, portFlameArt, portEmbersArt } from '../../src/world/portArt.js';
import { YARD_TILE_M } from '../../src/world/merchantYards/merchantYardModels.js';
import { createPortHost, feetInPort, PORT_TEXT } from '../../src/scenes/portHost.js';
import { Collider } from '../../src/player/collider.js';
import { CROUCH_HEIGHT, CAPSULE_RADIUS } from '../../src/player/motor.js';

const T = LIGHTHOUSE.tower, G = LIGHTHOUSE.gallery, L = LIGHTHOUSE.lantern, B = LIGHTHOUSE.brazier;
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const recName = Object.fromEntries(Object.entries(PORT_REC).map(([k, v]) => [v, k]));
/** Each triangle of a built model: its corners, its picture, its outward normal (its winding's). */
function trisOf(m) {
  const P = m.positions, I = m.indices, out = [];
  for (const sm of m.subMeshes) for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
    const v = [0, 1, 2].map((k) => { const i = I[t + k]; return [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; });
    const e = v[1].map((x, k) => x - v[0][k]), g = v[2].map((x, k) => x - v[0][k]);
    const n = [e[1] * g[2] - e[2] * g[1], e[2] * g[0] - e[0] * g[2], e[0] * g[1] - e[1] * g[0]], l = Math.hypot(...n) || 1;
    out.push({ v, rec: sm.textureRecord, n: n.map((x) => x / l), uv: [0, 1, 2].map((k) => { const i = I[t + k]; return [m.uvs[i * 2], m.uvs[i * 2 + 1]]; }) });
  }
  return out;
}
/** The model standing alone in the real collider (no ground), in its own frame. */
function colliderOf(m) {
  const col = new Collider();
  col.addMesh('lighthouse', m.positions, m.indices, I4);
  return col;
}
const hits = (col, o, d, max) => Number.isFinite(col.raycastHit(o, d, max).dist);
const atAxis = (r, ang, y) => [T.x + Math.cos(ang) * r, y, T.z + Math.sin(ang) * r];

test('BEACON-TOWER THE TOWER IS STONE: over the cottage\'s chimney every face of the lighthouse wears stone, its slit windows\' leaded panes, the roof\'s slate, iron, the hatch\'s timber and the coals - never whitewash, red bands, glass, copper or brass; and the port\'s art keeps no red band and no copper (mutants: the tower whitewashed, the roof whitewashed)', () => {
  // every face that rises over the chimney - the shaft is one face from the plinth to the corbels, so ANY corner over it
  const worn = new Set(trisOf(buildLighthouseModel()).filter((t) => t.v.some((p) => p[1] > LIGHTHOUSE.cottage.ridge + 1)).map((t) => recName[t.rec] ?? t.rec));
  assert.deepEqual([...worn].sort(), ['door', 'embers', 'iron', 'slate', 'stone', 'window', 'wood']);
  assert.ok(!('redband' in PORT_REC) && !('copper' in PORT_REC), 'the age of steam\'s two pictures gone');
  assert.deepEqual([PORT_REC.flame, PORT_REC.embers], [28, 29]);
  assert.equal(new Set(PORT_PAINTERS.map(([rec]) => rec)).size, Object.keys(PORT_REC).length, 'every picture painted once');
});

test('BEACON-TOWER THE BATTLEMENTS: the parapet round the gallery stands its crenels on the town\'s and the sea\'s bearings (where the hatch is and where the climb comes out, facing the sea) and a merlon between each two - eight of each - its stone from parapetR to the slab\'s edge (mutants: merlons all round, crenels all round)', () => {
  const col = colliderOf(buildLighthouseModel()), mid = (G.parapetR + G.r) / 2, step = (Math.PI * 2) / TOWER_SIDES;
  const topAt = (ang) => { const o = atAxis(mid, ang, GALLERY_Y + 5); return +(o[1] - col.raycastHit(o, [0, -1, 0], 10).dist).toFixed(4); };
  const crenel = +(GALLERY_Y + G.parapetH).toFixed(4), merlon = +(GALLERY_Y + G.parapetH + G.merlonH).toFixed(4);
  assert.equal(topAt(-Math.PI / 2), crenel, 'to the sea (-z): a crenel');
  assert.equal(topAt(Math.PI / 2), crenel, 'to the town (+z): a crenel');
  const tops = Array.from({ length: TOWER_SIDES }, (_, k) => topAt(k * step));
  assert.deepEqual(tops, tops.map((_, k) => (k % 2 ? merlon : crenel)), 'crenel, merlon, crenel... round the walk');
  assert.ok(G.parapetR < G.r && G.merlonH > 0);
});

test('BEACON-TOWER THE WALK IS CLEAR: from the lantern\'s faces out to the guard\'s band, from the gallery\'s floor to the guard\'s lid, no stone of the parapet, the lantern, its roof or the corbels stands in the walk - every bearing, three heights - so the climb\'s spot and the guard keep the ground they had (mutants: the parapet in the walk, the eaves at head height)', () => {
  const col = colliderOf(buildLighthouseModel()), ao = L.r * Math.cos(Math.PI / L.sides), rIn = G.parapetR - 0.08;
  for (let i = 0; i < 64; i++) {
    const ang = (i / 64) * Math.PI * 2, d = [Math.cos(ang), 0, Math.sin(ang)];
    for (const h of [0.3, 1.1, G.guardH - 0.05]) {
      const from = L.r + 0.02, o = atAxis(from, ang, GALLERY_Y + h);
      assert.ok(!hits(col, o, d, rIn * Math.cos(Math.PI / TOWER_SIDES) - from - 0.01), `the walk at ${ang.toFixed(2)} rad, ${h} m up`);
    }
    // ...and over the walk, the roof's eaves never hang down into a body's head on it
    const o = atAxis(ao + CAPSULE_RADIUS, ang, GALLERY_Y + 0.05);
    assert.ok(!hits(col, o, [0, 1, 0], G.guardH - 0.1), `no eave over the walk at ${ang.toFixed(2)}`);
  }
  // the climb's spot and the hatch on the walk, a body's capsule clear of the lantern's faces
  for (const p of [LIGHTHOUSE_POINTS.gallery, LIGHTHOUSE_POINTS.hatch]) assert.ok(Math.abs(p[2] - T.z) - CAPSULE_RADIUS > ao, 'clear of the arches');
});

test('BEACON-TOWER THE LANTERN IS OPEN: from the fire\'s middle a ray out along each of its eight faces passes through the arch and away over the parapet, and one toward each of its eight corners meets the pier there; the arch\'s crown stands over the fire\'s middle and under the guard\'s lid by less than a crouching body, so nobody passes over the lid through it (mutants: the arches walled up, the crown raised)', () => {
  const col = colliderOf(buildLighthouseModel()), lamp = LIGHTHOUSE_POINTS.lamp, step = (Math.PI * 2) / L.sides;
  for (let k = 0; k < L.sides; k++) {
    const face = (k + 1) * step, pier = face - step / 2;
    assert.ok(!hits(col, lamp, [Math.cos(face), 0, Math.sin(face)], 50), `face ${k}: the fire seen through its arch`);
    const h = col.raycastHit(lamp, [Math.cos(pier), 0, Math.sin(pier)], 50).dist;
    assert.ok(h <= L.r + 0.01 && h >= L.r - L.t / Math.cos(step / 2) - 0.01, `corner ${k}: the pier at ${h.toFixed(2)}`);
  }
  assert.ok(ARCH_CROWN > lamp[1] - GALLERY_Y, 'the crown over the fire');
  assert.ok(ARCH_CROWN - G.guardH < CROUCH_HEIGHT, `${(ARCH_CROWN - G.guardH).toFixed(2)} m over the lid`);
  assert.ok(ARCH_CROWN < L.sillH + L.archH, 'under the cornice');
});

test('BEACON-TOWER THE ROOF\'S POINT IS THE LANTERN\'S TOP: the slate\'s highest corner stands at GALLERY_Y + LANTERN_H over the lantern\'s middle, and the host holds a place back inside the lantern up to it and no higher (AUDIT SHIPYARDS L4-5\'s law, the roof the dome was) (mutants: LANTERN_H short of the roof)', () => {
  const slate = trisOf(buildLighthouseModel()).filter((t) => t.rec === PORT_REC.slate && t.v.every((p) => p[1] > GALLERY_Y));
  const top = Math.max(...slate.flatMap((t) => t.v.map((p) => p[1])));
  assert.ok(Math.abs(top - (GALLERY_Y + LANTERN_H)) < 1e-4, `the point at ${top.toFixed(3)}`);
  const apex = slate.flatMap((t) => t.v).find((p) => p[1] === top);
  assert.ok(Math.hypot(apex[0] - T.x, apex[2] - T.z) < 1e-4, 'over the axis');
  const site = { kind: 'lighthouse', yaw: 0 };
  assert.equal(feetInPort(site, [0, 0, 0], [T.x + 0.5, GALLERY_Y + LANTERN_H - 0.05, T.z]), true, 'under the point: held');
  assert.equal(feetInPort(site, [0, 0, 0], [T.x + 0.5, GALLERY_Y + LANTERN_H + 0.05, T.z]), false, 'over it: stood');
  // the roof's eaves over the arches, the steep cone of the Bay's towers
  assert.ok(L.roofH / (L.r + L.eaves) > 1.2, 'steeper than it is wide');
});

test('BEACON-TOWER THE FIRE: the brazier\'s coals lie in the bowl under the lamp, the flames are three sheets crossing over them, both ways, wearing the flame alone - their foot at the coals, the lamp\'s light inside them; and the gallery\'s floor and the slab\'s underside wear the stone flat off the world\'s axes (each slice wore the whole picture from the middle and showed a star of seams) (mutants: the flames one way, the flames off the coals, the star of seams)', () => {
  const lamp = LIGHTHOUSE_POINTS.lamp, coals = GALLERY_Y + B.pedestalH + B.h - B.coals;
  const fire = trisOf(buildLighthouseFire());
  assert.ok(fire.length === 12 && fire.every((t) => t.rec === PORT_REC.flame), 'three sheets of two faces, the flame');
  const ys = fire.flatMap((t) => t.v.map((p) => p[1]));
  assert.ok(Math.abs(Math.min(...ys) - coals) < 1e-4, 'their foot at the coals');
  assert.ok(Math.min(...ys) < lamp[1] && Math.max(...ys) > lamp[1], 'the lamp within them');
  // each sheet both ways: its normals in opposite pairs
  const ns = fire.map((t) => t.n.map((x) => +x.toFixed(4)).join());
  for (const n of ns) assert.ok(ns.includes(n.split(',').map((x) => +(-x).toFixed(4)).map((x) => (Object.is(x, -0) ? 0 : x)).join()), `a sheet's back for ${n}`);
  const m = trisOf(buildLighthouseModel());
  const coal = m.filter((t) => t.rec === PORT_REC.embers);
  assert.ok(coal.length === 8 && coal.every((t) => t.v.every((p) => Math.abs(p[1] - coals) < 1e-4) && t.n[1] > 0.99), 'the coals, up');
  // the floor's stone off the world's axes
  const floorTris = m.filter((t) => t.rec === PORT_REC.stone && t.n[1] > 0.99 && t.v.every((p) => Math.abs(p[1] - GALLERY_Y) < 1e-4));
  assert.ok(floorTris.length >= TOWER_SIDES);
  for (const t of floorTris) t.v.forEach((p, k) => assert.ok(Math.abs(t.uv[k][0] - p[0] / YARD_TILE_M) < 1e-4 && Math.abs(t.uv[k][1] - p[2] / YARD_TILE_M) < 1e-4, 'planar'));
});

test('BEACON-TOWER THE ART: the flame is its tongues on nothing - alpha 0 round them, whole in their middle - and uploaded a cutout; the flame and the embers are their own light (the gate\'s fires\' law: uploadEmissionTexture, white) and nothing else of the port\'s is either (mutants: the flame solid, the flame without holes, the fire unlit, the cutout unread, the glow unread)', () => {
  const f = portFlameArt(), a = (x, y) => f.colors[(y * f.width + x) * 4 + 3];
  assert.deepEqual([f.width, f.height], [32, 64]);
  assert.equal(a(0, 0), 0, 'the corner: nothing');
  assert.equal(a(16, 60), 255, 'over the coals: flame');
  const holes = Array.from({ length: f.width * f.height }, (_, i) => f.colors[i * 4 + 3]).filter((x) => x === 0).length;
  assert.ok(holes > f.width * f.height * 0.3 && holes < f.width * f.height * 0.85, `${holes} holes`);
  assert.deepEqual(portFlameArt().colors, f.colors, 'the same fire on every client');
  assert.ok(portEmbersArt().colors.every((x, i) => i % 4 !== 3 || x === 255), 'the coals: no hole');
  assert.deepEqual(Object.keys(PORT_HOW).map(Number).sort((x, y) => x - y), [PORT_REC.flame, PORT_REC.embers]);
  assert.deepEqual({ ...PORT_HOW[PORT_REC.flame] }, { cutout: true, glows: true });
  assert.deepEqual({ ...PORT_HOW[PORT_REC.embers] }, { cutout: false, glows: true });
  // the host's upload, as it paints
  const ups = [], glows = [];
  const renderer = {
    textures: new Map(), uploadTexture: (ar, r, img, o) => ups.push([ar, r, o ?? null]), uploadEmissionTexture: (ar, r, img, o) => glows.push([ar, r, o]),
    createMesh: (m) => ({ tris: m.indices.length / 3 }), destroyMesh: () => {}, drawMesh: () => {}, createBillboardBatch: () => ({}), destroyBillboardBatch: () => {},
  };
  const host = createPortHost({ renderer, collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), now: () => 0,
    sites: () => [{ key: '9:lighthouse', kind: 'lighthouse', x: 0, z: 0, yaw: 0, comp: 0, race: 'Breton', name: 'L', keeper: { name: 'K', sex: 'male', variant: 0 } }], groundAt: () => 0 });
  for (let i = 0; i < 40 && ups.length < PORT_PAINTERS.length; i++) host.frame();
  assert.equal(ups.length, PORT_PAINTERS.length);
  assert.deepEqual(ups.filter(([, , o]) => o).map(([ar, r, o]) => [ar, r, { ...o }]), [[PORT_ARCHIVE, PORT_REC.flame, { cutout: true }]]);
  assert.deepEqual(glows.map(([ar, r, o]) => [ar, r, { ...o }]), [[PORT_ARCHIVE, PORT_REC.flame, { white: true }], [PORT_ARCHIVE, PORT_REC.embers, { white: true }]]);
});

test('BEACON-TOWER THE WORDS: the keeper\'s stair, the light\'s hours and the lock all speak of the beacon - never a lamp, its oil or its glass - and the eye names it the beacon (mutants: the lamp\'s words back)', () => {
  for (const k of ['lampLit', 'lampDark', 'stair']) assert.match(PORT_TEXT[k], /beacon/, k);
  assert.match(PORT_TEXT.lightSteal, /beacon's oil/);
  for (const k of ['lampLit', 'lampDark', 'stair', 'lightSteal', 'hatch']) assert.doesNotMatch(PORT_TEXT[k], /\blamp\b|\bglass\b|\blens\b/i, k);
  const host = createPortHost({ sites: () => [{ key: '9:lighthouse', kind: 'lighthouse', x: 0, z: 0, yaw: 0, comp: 0, race: 'Breton', name: 'The Wayrest Light', keeper: { name: 'K', sex: 'male', variant: 0 } }], groundAt: () => 0, collider: () => ({ addMesh: () => {}, removeBucket: () => {} }) });
  host.frame();
  assert.equal(host.hoverName('port:9:lighthouse|lamp').title, 'The beacon');
});
