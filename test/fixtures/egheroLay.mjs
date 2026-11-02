// EG-HERO-LAY (2026-10-13; bible/11-Multiplayer/Elite-Gates.md section 31, EG-HERO-LAY): THE LAYING'S TEST HEROES - written
// as every hero is (a scene from numbers - tools/egRefFragScene.mjs refFragMesh and writeRefFragFbx - baked by
// tools/fragBake.mjs bakeFrag, the producer's own shape: TEST THE SHAPE THE PRODUCER MINTS), never committed as assets and
// never registered: test/net/eliteGates/eghero_lay.test.js lays them through net/eliteGates/egLaw.js egHeroSeam and draws them through
// world/eliteGates/egHall.js egHeroMeshSeam. Beside the reference re-labelled layable (`{ ...egRefFrag, variant: 'test' }`):
//   egLayChamber  an Oblivion Caverns CHAMBER: a 32 m square fight floor about its middle (its court reaches 16 m), a mouth
//                 and an exit 5 m wide on thresholds, a balcony 3.5 m up on the +x wall and its stair (play `balcony`),
//                 five rifts set in the walls, a Caster on the balcony, a Lurker, the Sluice's anchor, falling basalt, a
//                 ceiling 10 m up over all of it;
//   egLayShaft    an Oblivion Caverns SHAFT: a 3 m rim, three ledges each 0.9 m down, a Drop of 3.5 m onto a 6 m landing, a
//                 3 m foot whose exit stands 6.2 m under the mouth, a fire fall across the rim, open to the sky.
// Each scene in Blender's frame: metres, Z up, the course along +Y, the mouth at Y 0 on X 0.
import { refFragMesh, writeRefFragFbx } from '../../tools/egRefFragScene.mjs';
import { bakeFrag } from '../../tools/fragBake.mjs';

/** Both fixtures' specs (tools/fragBake.mjs bakeFrag's). */
export const LAY_CHAMBER_SPEC = Object.freeze({ id: 'egLayChamber', kit: 'caverns', class: 'chamber', variant: 'test-chamber', play: Object.freeze(['balcony']), source: 'test/fixtures/egheroLay.mjs#chamber' });
export const LAY_SHAFT_SPEC = Object.freeze({ id: 'egLayShaft', kit: 'caverns', class: 'shaft', variant: 'test-shaft', play: Object.freeze([]), source: 'test/fixtures/egheroLay.mjs#shaft' });

const cube = (out, name, x, y, z, s = 0.3) => out.push(refFragMesh(name).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s));

/** THE CHAMBER's scene. */
export function layChamberScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  // ── the art
  add(refFragMesh('Floor', ['arena', 'floor'])).level(-16, 1, 16, 33, 0).level(-3, 0, 3, 1, 0, 1).level(-3, 33, 3, 34, 0, 1);
  add(refFragMesh('Balcony', ['cobble', 'pillar'])).level(16, 14, 20, 20, 3.5).along(16, 14, 20, 0, 3.5, 1).face([[12, 15, 0], [16, 15, 3.5], [16, 17, 3.5], [12, 17, 0]], 0);
  add(refFragMesh('Walls', ['pillar'])).box(-17, 0, -0.6, -16, 34, 10).box(20, 0, -0.6, 21, 34, 10).box(-16, 0, -0.6, -3, 1, 10).box(3, 0, -0.6, 20, 1, 10).box(-16, 33, -0.6, -3, 34, 10).box(3, 33, -0.6, 20, 34, 10);
  add(refFragMesh('Vault', ['root'])).box(-17, 0, 10, 21, 34, 10.6);
  add(refFragMesh('Edge_Lines', ['edge'])).level(16, 14, 16.15, 20, 3.51);
  // ── the law
  add(refFragMesh('socket.in')).across(-2.5, 2.5, 0, 0, 4);
  add(refFragMesh('socket.out.main')).across(-2.5, 2.5, 34, 0, 4, 0, true);
  add(refFragMesh('floor.threshold')).level(-3, 0, 3, 1, 0);
  add(refFragMesh('floor.fight.court')).level(-16, 1, 16, 33, 0);
  add(refFragMesh('floor.exit')).level(-3, 33, 3, 34, 0);
  add(refFragMesh('floor.fight.balcony')).level(16, 14, 20, 20, 3.5);
  add(refFragMesh('ramp.stair')).face([[12, 15, 0], [16, 15, 3.5], [16, 17, 3.5], [12, 17, 0]]);
  add(refFragMesh('ceil.vault')).level(-17, 0, 21, 34, 10, 0, true);
  add(refFragMesh('open.mouth')).box(-3.1, -0.05, -0.05, 3.1, 0.05, 0.05);
  add(refFragMesh('open.exit')).box(-3.1, 33.95, -0.05, 3.1, 34.05, 0.05);
  add(refFragMesh('open.balconylip')).box(15.95, 13.95, 3.45, 16.05, 20.05, 3.55);
  const N = { mouth: [0, 3, 0], court: [0, 17, 0], west: [-12, 17, 0], far: [0, 31, 0], foot: [10, 16, 0], balcony: [18, 17, 3.5] };
  for (const [k, p] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(p[0], p[1], p[2], 0.5);
  for (const [k, a, b] of [['mouth', 'mouth', 'court'], ['west', 'court', 'west'], ['far', 'court', 'far'], ['foot', 'court', 'foot'], ['stair', 'foot', 'balcony']]) add(refFragMesh(`edge.${k}`)).strip(N[a], N[b], 0.2);
  cube(out, 'anchor.rift.a', -15.5, 8, 1); cube(out, 'anchor.rift.b', 15.5, 8, 1); cube(out, 'anchor.rift.c', -15.5, 26, 1); cube(out, 'anchor.rift.d', 15.5, 26, 1); cube(out, 'anchor.rift.e', -15.5, 17, 1);
  cube(out, 'anchor.caster.balcony', 18, 18, 3.5);
  cube(out, 'anchor.lurker.corner', -14, 31, 0);
  cube(out, 'anchor.engine.sluice', 0, 9, 0);
  add(refFragMesh('hazard.basalt.court.ph700')).disc(5, 10, 0, 2.5).disc(-5, 24, 0, 2.5);
  cube(out, 'light.lava.court', 0, 17, 6, 0.2);
  cube(out, 'light.band.balcony', 18, 17, 6, 0.2);
  add(refFragMesh('collider.proxy'))
    .level(-16, 1, 16, 33, 0).level(-3, 0, 3, 1, 0).level(-3, 33, 3, 34, 0).level(16, 14, 20, 20, 3.5).along(16, 14, 20, 0, 3.5)
    .face([[12, 15, 0], [16, 15, 3.5], [16, 17, 3.5], [12, 17, 0]])
    .along(-16, 0, 34, 0, 10, 0, true).along(20, 0, 34, 0, 10).level(-17, 0, 21, 34, 10, 0, true);
  return out;
}

/** THE SHAFT's scene. */
export function layShaftScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  // ── the art
  add(refFragMesh('Rim', ['floor'])).level(-3, 0, 3, 3, 0);
  add(refFragMesh('Foot', ['floor'])).level(-3, 25.4, 3, 28.4, -6.2);
  add(refFragMesh('Walls', ['pillar'])).box(-3.5, 0, -6.8, -3, 28.4, 4).box(3, 0, -6.8, 3.5, 28.4, 4);
  add(refFragMesh('Edge_Lines', ['edge'])).level(-3, 2.85, 3, 3, 0.01);
  // ── the law
  add(refFragMesh('socket.in')).across(-2.5, 2.5, 0, 0, 4);
  add(refFragMesh('socket.out.foot')).across(-2.5, 2.5, 28.4, -6.2, -2.2, 0, true);
  add(refFragMesh('floor.rim')).level(-3, 0, 3, 3, 0);
  add(refFragMesh('floor.foot')).level(-3, 25.4, 3, 28.4, -6.2);
  add(refFragMesh('open.mouth')).box(-3.1, -0.05, -0.05, 3.1, 0.05, 0.05);
  add(refFragMesh('open.lip')).box(-3.1, 2.95, -0.05, 3.1, 3.05, 0.05);
  add(refFragMesh('open.landing')).box(-3.1, 25.35, -6.25, 3.1, 25.45, -6.15);
  add(refFragMesh('open.exit')).box(-3.1, 28.35, -6.25, 3.1, 28.45, -6.15);
  add(refFragMesh('node.rim')).disc(0, 1.5, 0, 0.5);
  add(refFragMesh('node.foot')).disc(0, 27, -6.2, 0.5);
  add(refFragMesh('course.ledge.a')).box(-1.2, 5.6, -1.7, 1.2, 7.6, -0.9);
  add(refFragMesh('course.ledge.b')).box(-1.2, 10.2, -2.6, 1.2, 12.2, -1.8);
  add(refFragMesh('course.ledge.c')).box(-1.2, 14.8, -3.5, 1.2, 16.8, -2.7);
  add(refFragMesh('course.drop.d')).box(-3, 19.4, -7, 3, 25.4, -6.2);
  add(refFragMesh('hazard.fall.rim.ph1500')).level(-3, 1.8, 3, 3, 0);
  cube(out, 'light.lava.rim', 0, 1.5, 3, 0.2);
  cube(out, 'light.lava.foot', 0, 27, -3.2, 0.2);
  add(refFragMesh('collider.proxy')).level(-3, 0, 3, 3, 0).level(-3, 25.4, 3, 28.4, -6.2).along(-3, 0, 28.4, -6.8, 4, 0, true).along(3, 0, 28.4, -6.8, 4);
  return out;
}

let _baked = null;
/** Both fixtures baked (kept): `{ chamber: { law, mesh }, shaft: { law, mesh } }`. */
export function layFixtures() {
  _baked ??= { chamber: bakeFrag(writeRefFragFbx(layChamberScene()), LAY_CHAMBER_SPEC), shaft: bakeFrag(writeRefFragFbx(layShaftScene()), LAY_SHAFT_SPEC) };
  return _baked;
}
