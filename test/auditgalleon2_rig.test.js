// AUDIT GALLEON-2 (2026-10-03) - HER RIG'S ROPE, ITS BAKE, AND HER SAILS' POSES (world/galleonRig.js; systems/
// comeSailAwayBoat.js's FixDeformations holder; scenes/comeSailAwayPool.js's bake). The second audit of Mac's galleon.
// Every pin reads her AS BUILT on the runtime: the real pool's frame (FixDeformations' LateUpdate and the bake, at 60
// frames a second) for her rope and her canvas's bakes; the real Animator on her placed prefab, and on the mod's own
// boats, for her sails' poses. No formula of galleonRig.js is restated here.
//
// RG1 her running rope baked every frame (its drawn end trailed its spar 1.2-1.7 m at the auto-trim's 100 degrees a
//     second, 4.99 m through a gybe);
// RG2 a sheet hung under its sail (a hidden sail's sheets were drawn ending in the air);
// RG9 her canvases' bakes on frames of their own (all sixteen holders baked on the same frame);
// TS6 each sail's Left and Right poses bellied the way the mod's own sails of its kind are (unpinned: four mutants
//     survived).
// RG7 (a stale name in PAST_AUTO) is pinned beside that list, in test/auditgalleon_rig.test.js.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scene } from './csaScene.mjs';
import { readyPool, sea, modShipsPool } from './navalSea.mjs';
import { Boat, animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { resolveNodePointer } from '../src/world/prefabNode.js';
import { quatAngleAxis, mat4FromQuatPos } from '../src/world/quat.js';

const DT = 1 / 60;
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const fixOf = (n) => n.children.map((c) => c.getComponent('FixDeformations')).find(Boolean) ?? null;
/** Her running rope: each `*Line` renderer, its bones, its holder. */
const ropesOf = (boat) => [...boat.GameObject.walk()].filter((n) => /Line$/.test(n.name) && n.getComponent('SkinnedMeshRenderer')).map((n) => {
  const smr = n.getComponent('SkinnedMeshRenderer');
  return { n, name: n.name, smr, fix: fixOf(n), bones: smr.m_Bones.map((b) => resolveNodePointer(n, b)) };
});
/** Her canvases: each sail's `*SailMesh` renderer and its holder. */
const canvasesOf = (boat) => [...boat.GameObject.walk()].filter((n) => /SailMesh$/.test(n.name)).map((n) => ({ n, name: n.name, fix: fixOf(n) }));
/** How far the DRAWN rope's end at bone `k` (its baked ring, where the holder draws it) stands off that bone now. */
function endGap(r, k, geometry) {
  const pos = r.fix.bakedMesh?.positions;
  if (!pos) return Infinity;
  const m = mat4FromQuatPos(r.n.rotation, r.n.position);   // the bake: the renderer's frame, its scale kept (one here)
  let c = [0, 0, 0], n = 0;
  for (let v = 0; v < geometry.vertexCount; v++) if (geometry.blendIndices[v] === k) { const p = xf(m, [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]); c = [c[0] + p[0], c[1] + p[1], c[2] + p[2]]; n++; }
  const b = r.bones[k].position;
  return Math.hypot(c[0] / n - b[0], c[1] / n - b[1], c[2] / n - b[2]);
}
/** Which holders bake this frame: each one's baked buffer marked before it, read after (a bake writes every vertex). */
function bakedOn(pool, holders, dt) {
  for (const h of holders) if (h.fix.bakedMesh) h.fix.bakedMesh.positions[0] = NaN;
  pool.frame(dt);
  return holders.filter((h) => h.fix.bakedMesh && !Number.isNaN(h.fix.bakedMesh.positions[0]));
}

test('AUDIT GALLEON-2 RG1: her running rope is baked every frame, so every brace, sheet and the mainsheet ends on what it is made fast to while her booms swing - each rope\'s drawn ends 5 mm and less off their bones at every frame of a swing at the manual trim\'s 15 degrees a second, the auto-trim\'s 100 and the gaff\'s 300, through a gybe and at a creep of 0.2; never while the game is paused, nor again while it stands as it was baked; her canvas and the mod\'s holders on FixDeformations\' tenth of a second as they were (on that tenth her rope\'s drawn end trailed its spar: the mainsheet 0.25 m at 15 degrees a second, 1.69 m at 100, 4.30 at 300, 4.99 through a gybe; a course brace 0.18, 1.23, 3.13) (mutants: every rope on the tenth at the rig, the walk or the pool, every frame even paused, a rope standing still baked again, a rope moving under a metre never baked, the still check against last frame, the mod\'s timer moved)', async (t) => {
  const pool = await readyPool();
  pool.destroyAll();
  const boat = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const ropes = ropesOf(boat), geo = new Map(ropes.map((r) => [r, pool.models.geometry(r.smr.m_Mesh.mesh)]));
  assert.equal(ropes.length, 11, 'her braces (six), her course\'s and her jib\'s sheets (four) and her mainsheet');
  const worst = () => { let w = { d: 0 }; for (const r of ropes) for (const k of [0, 1]) { const d = endGap(r, k, geo.get(r)); if (d > w.d) w = { d, at: `${r.name} end ${k}` }; } return w; };
  for (let i = 0; i < 30; i++) pool.frame(DT);
  const rest = worst();
  t.diagnostic(`at rest: the worst drawn end ${rest.d.toFixed(4)} m off its bone (${rest.at})`);
  const gaff = boat.Booms.find((b) => b.name.includes('Gaff')), squares = boat.Booms.filter((b) => b.name.includes('Square'));
  const set = (sq, gf) => { for (const b of squares) b.localRotation = quatAngleAxis(sq, [0, 1, 0]); gaff.localRotation = quatAngleAxis(gf, [0, 1, 0]); };
  const bad = [];
  if (!(rest.d <= 0.005)) bad.push(`at rest ${rest.d.toFixed(3)} m (${rest.at})`);
  for (const rate of [15, 100, 300]) {
    set(0, 0);
    for (let i = 0; i < 20; i++) pool.frame(DT);
    let a = 0, w = { d: 0 };
    for (let i = 0; i < Math.ceil(30 / (rate * DT)) + 10; i++) {
      a = Math.min(30, a + rate * DT);
      set(a, -a);
      pool.frame(DT);
      const x = worst();
      if (x.d > w.d) w = x;
    }
    t.diagnostic(`swung at ${rate} deg/s: the worst drawn end ${w.d.toFixed(4)} m off its bone (${w.at})`);
    if (!(w.d <= 0.005)) bad.push(`at ${rate} deg/s ${w.d.toFixed(3)} m (${w.at})`);
  }
  // the gybe: the gaff across from -30 to 30 at 300, the squares across at 100
  let gf = -30, sq = 30, w = { d: 0 };
  for (let i = 0; i < 60; i++) {
    gf = Math.min(30, gf + 300 * DT); sq = Math.max(-30, sq - 100 * DT);
    set(sq, gf);
    pool.frame(DT);
    const x = worst();
    if (x.d > w.d) w = x;
  }
  t.diagnostic(`through a gybe: the worst drawn end ${w.d.toFixed(4)} m off its bone (${w.at})`);
  if (!(w.d <= 0.005)) bad.push(`through a gybe ${w.d.toFixed(3)} m (${w.at})`);
  // a creep - her booms eased 0.2 degrees a second for two seconds, each frame's step under a millimetre at the boom's
  // end: a rope is held to where it stood at its LAST BAKE, never to last frame
  set(0, 0);
  for (let i = 0; i < 20; i++) pool.frame(DT);
  let c = 0;
  w = { d: 0 };
  for (let i = 0; i < 120; i++) {
    c += 0.2 * DT;
    set(c, -c);
    pool.frame(DT);
    const x = worst();
    if (x.d > w.d) w = x;
  }
  t.diagnostic(`a creep at 0.2 deg/s: the worst drawn end ${w.d.toFixed(4)} m off its bone (${w.at})`);
  if (!(w.d <= 0.005)) bad.push(`a creep at 0.2 deg/s ${w.d.toFixed(3)} m (${w.at})`);
  // paused (Time.deltaTime 0): no rope baked, as the mod's timer bakes nothing
  set(0, 0);
  const paused = bakedOn(pool, ropes, 0);
  if (paused.length) bad.push(`${paused.length} ropes baked in a paused frame`);
  // and a rope that stands as it was baked is not baked again - its spar still, nothing of it moves
  for (let i = 0; i < 2; i++) pool.frame(DT);
  let again = 0;
  for (let i = 0; i < 20; i++) again += bakedOn(pool, ropes, DT).length;
  t.diagnostic(`20 frames with her booms still: ${again} rope bakes`);
  if (again) bad.push(`${again} bakes of ropes standing still in 20 frames`);
  // the cadence: her rope every frame, her canvas and every other hull's holders on the mod's tenth of a second
  if (!ropes.every((r) => r.fix.everyFrame === true)) bad.push('a rope of hers not baked every frame');
  if (!canvasesOf(boat).every((c) => !c.fix.everyFrame && c.fix.interval === 0.1)) bad.push('her canvas off the tenth');
  // SHIPS-2: the mod's own Carrack (test/navalSea.mjs modShipsPool - hull 4 as the game stands it when the new
  // carrack's model will not load); Mac's carrack's holders are hers (world/carrackRig.js BAKE: the galleon's law)
  const mod = await modShipsPool();
  try {
    const carrack = mod.pool.spawnNow(new Boat(HULL.Carrack, 0), { position: [400, 0, 0], rotation: [0, 0, 0, 1] });
    const modFix = [...carrack.GameObject.walk()].map((n) => n.getComponent('FixDeformations')).filter(Boolean);
    if (!(modFix.length === 5 && modFix.every((f) => f.interval === 0.1 && f.timer === 0 && !('everyFrame' in f)))) bad.push('the mod\'s own holders changed');
    mod.pool.remove(carrack);
  } finally { mod.restore(); }
  assert.deepEqual(bad, [], 'every rope\'s drawn end on its bone, every frame');
});

test('AUDIT GALLEON-2 RG2: a sheet hangs under its sail - the fore course\'s two under the fore course, the jib\'s two under the jib - so a sail struck from sight takes its sheets with it: a sea galleon at a sail share of 0.40 (her squares hidden) and 0 (all five) draws no sheet whose sail is hidden; her braces and mainsheet, on spars that stay, under her hull; the walk reads the same five sails - three square (two small), a large gaff and a large staysail - on four booms, each boom\'s first child its sail (the sheets hung under her hull: at 0.40 the course\'s sheets were drawn ending 4.4 m under its yard, at 0 the jib\'s over her bow) (mutants: the sheets under the hull, the rope out of its node\'s frame)', async (t) => {
  const pool = await readyPool();
  pool.destroyAll();
  const boat = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const bad = [];
  const sailOf = (b, bone) => { let s = bone; while (s && !b.Sails.includes(s)) s = s.parent; return s; };
  for (const r of ropesOf(boat)) {
    const sail = sailOf(boat, r.bones[0]), want = sail ? sail.name : 'NewGalleon';   // a sheet's sail; else her hull
    if (r.n.parent?.name !== want) bad.push(`${r.name} under ${r.n.parent?.name}, not ${want}`);
  }
  t.diagnostic(`her ropes' parents: ${ropesOf(boat).map((r) => `${r.name} < ${r.n.parent.name}`).join(', ')}`);
  assert.deepEqual(boat.Sails.map((n) => n.name), ['ForeCourseSquareSail', 'ForeTopsailSquareSmallSail', 'MainTopsailSquareSmallSail', 'MainGaffLargeSail', 'JibStayLargeSail']);
  assert.deepEqual([boat.SailsSquare.length, boat.SailsGaff.length, boat.SailsStay.length, boat.SailsLateen.length, boat.SailsSmall.length, boat.SailsLarge.length, boat.Booms.length], [3, 1, 1, 0, 2, 2, 4]);
  for (const b of boat.Booms) assert.ok(boat.Sails.includes(b.children[0]), `${b.name}'s first child its sail (${b.children[0].name})`);
  // at rest, baked, every rope's ends on its bones whatever its node's frame
  for (let i = 0; i < 12; i++) pool.frame(DT);
  for (const r of ropesOf(boat)) for (const k of [0, 1]) { const d = endGap(r, k, pool.models.geometry(r.smr.m_Mesh.mesh)); if (!(d <= 0.002)) bad.push(`${r.name}'s end ${k} ${d.toFixed(3)} m off its bone at rest`); }
  // a sea galleon losing her canvas by her sail share (navalHost poseShip hides the sail's node)
  const h = await sea({ hull: HULL.SmallShip, wind: [0, 0, 0] });
  const id = h.host.spawnShip('merchantGalleon', { range: 300, bearing: 0, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [0, 0, 300];
  const step = (n) => { for (let i = 0; i < n; i++) { h.host.frame(0.05); h.pool.frame(0.05); } };
  step(80);
  const d = e.ship.damage;
  for (const share of [0.4, 0]) {
    d.repair();
    d.apply({ hull: 0, sail: d.maxSail - Math.floor(d.maxSail * share), crew: 0 }, 0);
    step(80);
    const hidden = e.boat.Sails.filter((s) => !s.activeSelf);
    const drawn = new Set([...e.boat.GameObject.walk()].filter((n) => n.activeInHierarchy));
    const sheets = [...e.boat.GameObject.walk()].filter((n) => /Sheet\w*Line$/.test(n.name) && !/MainGaff/.test(n.name));
    const wrong = sheets.filter((n) => { const s = sailOf(e.boat, resolveNodePointer(n, n.getComponent('SkinnedMeshRenderer').m_Bones[0])); return hidden.includes(s) && drawn.has(n); });
    t.diagnostic(`sail share ${d.sailShare().toFixed(2)}: hidden ${hidden.map((s) => s.name).join(', ')}; sheets of a hidden sail drawn: ${wrong.map((n) => n.name).join(', ') || 'none'}`);
    if (!hidden.length) bad.push(`share ${share}: no sail hidden`);
    for (const n of wrong) bad.push(`share ${share}: ${n.name} drawn, its sail hidden`);
  }
  assert.deepEqual(bad, [], 'every sheet with its sail');
});

test('AUDIT GALLEON-2 RG9: her canvases bake on frames of their own - each sail\'s holder on the mod\'s tenth of a second (every eighth frame at 60 a second), no two on one frame - where all five canvases and her eleven ropes baked on the same frame (279 us at once); every other hull\'s holders together on the mod\'s own timer (mutants: her canvases on one phase, the phase dropped from the holder)', async (t) => {
  const pool = await readyPool();
  pool.destroyAll();
  const boat = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const canvases = canvasesOf(boat);
  assert.equal(canvases.length, 5);
  const frames = canvases.map(() => []);
  let most = 0;
  for (let f = 1; f <= 120; f++) {
    const baked = bakedOn(pool, canvases, DT);
    most = Math.max(most, baked.length);
    for (const c of baked) frames[canvases.indexOf(c)].push(f);
  }
  const gaps = frames.map((fs) => [...new Set(fs.slice(1).map((v, i) => v - fs[i]))]);
  t.diagnostic(`her canvases' bakes in 120 frames: ${canvases.map((c, i) => `${c.name} ${frames[i].slice(0, 3).join(',')}... every ${gaps[i].join('/')}`).join('; ')}; at most ${most} on one frame`);
  assert.ok(most <= 1, `no two of her canvases on one frame (${most})`);
  for (let i = 0; i < canvases.length; i++) {
    assert.ok(frames[i][0] <= 8, `${canvases[i].name}: its first bake within the mod's first tenth (frame ${frames[i][0]})`);
    assert.deepEqual(gaps[i], [8], `${canvases[i].name}: every eighth frame, the mod's tenth of a second`);
  }
  // the mod's own: the Carrack's five sails on the one frame, as the C# times them (SHIPS-2: the mod's own Carrack, as
  // the game stands it when the new carrack's model will not load - test/navalSea.mjs modShipsPool)
  pool.destroyAll();
  const mod = await modShipsPool();
  try {
    const carrack = mod.pool.spawnNow(new Boat(HULL.Carrack, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    const theirs = [...carrack.GameObject.walk()].filter((n) => n.getComponent('SkinnedMeshRenderer') && fixOf(n)).map((n) => ({ n, name: n.name, fix: fixOf(n) }));
    assert.equal(theirs.length, 5, 'the Carrack\'s five sails');
    const firsts = theirs.map(() => null);
    for (let f = 1; f <= 10; f++) for (const c of bakedOn(mod.pool, theirs, DT)) { const i = theirs.indexOf(c); if (firsts[i] == null) firsts[i] = f; }
    assert.deepEqual(firsts, theirs.map(() => 8), 'the mod\'s sails all first bake on the eighth frame');
  } finally { mod.restore(); }
});

/** A placed boat's sail's bones' mean (its MeshObject's frame, her booms home) at each Wind, through the real Animator. */
function poseMeans(boat, sail, winds) {
  const a = animatorOf(sail), mesh = [...sail.walk()].find((n) => n.getComponent('SkinnedMeshRenderer'));
  const bones = mesh.getComponent('SkinnedMeshRenderer').m_Bones.map((b) => resolveNodePointer(mesh, b));
  a.CrossFade('Unstowed', 2); a.SetBool('Stowed', false); a.SetFloat('Wind', 0);
  for (let i = 0; i < 400; i++) a.update(0.1);
  const out = {};
  for (const w of winds) {
    a.SetFloat('Wind', w);
    for (let i = 0; i < 4; i++) a.update(0.1);
    const pts = bones.map((b) => boat.MeshObject.inverseTransformPoint(b.position));
    out[w] = [0, 1, 2].map((k) => pts.reduce((q, p) => q + p[k], 0) / pts.length);
  }
  return out;
}

test('AUDIT GALLEON-2 TS6: each of her sails is bellied Left and Right the way the mod\'s own sails of its kind are, measured through the Animator on both - a square sail\'s Left aback (abaft its hanging), its Right full (forward), as the Carrack\'s Large Square ("Unstowed Backward" its Left); the gaff\'s and the jib\'s Left to port and Right to starboard, as the mod\'s Large Gaff and Large Staysail; the jib\'s Center Left and Center Right a part of the way, as the mod\'s staysail\'s halves (unpinned: a square\'s aback and full swapped, the gaff\'s or the jib\'s sides swapped, the jib\'s halves full - each survived every pool, Come Sail Away and galleon test) (mutants: those four)', (t) => {
  // SHIPS-2: the mod's own Carrack and Large Boat (csaScene.mjs `mod`) - hulls 4 and 1 are Mac's carrack and Tiny Ship
  // now, sailing by these same conventions (test/ships2_carrack.test.js, test/ships2_largeboat.test.js)
  const s = scene({ mod: true });
  const W = [-1, -0.5, 0, 0.5, 1];
  const mod = {
    square: ['CarrackLargeSquareSail', s.place(HULL.Carrack, 0, [400, 34, 200])],
    gaff: ['SkiffLargeGaffSail', s.place(HULL.LargeBoat, 5, [600, 34, 200])],
    stay: ['SkiffLargeStaySail (1)', s.place(HULL.LargeBoat, 4, [800, 34, 200])],
  };
  const conv = {};
  for (const [kind, [name, boat]] of Object.entries(mod)) {
    const sail = boat.Sails.find((n) => n.name === name);
    assert.ok(sail, `the mod's ${name}`);
    const m = poseMeans(boat, sail, W), k = kind === 'square' ? 2 : 0;
    conv[kind] = { axis: k, left: Math.sign(m[-1][k] - m[0][k]), right: Math.sign(m[1][k] - m[0][k]), half: kind === 'stay' ? (m[-0.5][k] - m[0][k]) / (m[-1][k] - m[0][k]) : null };
    t.diagnostic(`the mod's ${name} (${kind}): Left ${(m[-1][k] - m[0][k]).toFixed(3)} m, Right ${(m[1][k] - m[0][k]).toFixed(3)} m along ${'xyz'[k]} off its hanging${conv[kind].half != null ? `; its Center Left ${conv[kind].half.toFixed(2)} of its Left` : ''}`);
  }
  assert.deepEqual([conv.square.left, conv.square.right, conv.gaff.left, conv.gaff.right, conv.stay.left, conv.stay.right], [-1, 1, -1, 1, -1, 1], 'the mod\'s convention: a square Left aback, Right forward; gaff and staysail Left to port');
  const boat = s.place(HULL.SmallShip, 0);
  const bad = [];
  for (const sail of boat.Sails) {
    const kind = boat.SailsSquare.includes(sail) ? 'square' : boat.SailsGaff.includes(sail) ? 'gaff' : 'stay', { axis: k } = conv[kind];
    const m = poseMeans(boat, sail, W), L = m[-1][k] - m[0][k], R = m[1][k] - m[0][k];
    let said = `${sail.name} (${kind}): Left ${L.toFixed(3)} m, Right ${R.toFixed(3)} m along ${'xyz'[k]}`;
    if (!(Math.sign(L) === conv[kind].left && Math.abs(L) >= 0.02)) bad.push(`${sail.name}'s Left ${L.toFixed(3)} m along ${'xyz'[k]}`);
    if (!(Math.sign(R) === conv[kind].right && Math.abs(R) >= 0.02)) bad.push(`${sail.name}'s Right ${R.toFixed(3)} m along ${'xyz'[k]}`);
    if (kind === 'stay') {
      const hl = (m[-0.5][k] - m[0][k]) / L, hr = (m[0.5][k] - m[0][k]) / R;
      said += `; its Center Left ${hl.toFixed(2)} of its Left, Center Right ${hr.toFixed(2)} of its Right`;
      for (const [nm, v] of [['Center Left', hl], ['Center Right', hr]]) if (!(v > 0.25 && v < 0.75)) bad.push(`${sail.name}'s ${nm} ${v.toFixed(2)} of its side's full`);
    }
    t.diagnostic(said);
  }
  assert.deepEqual(bad, [], 'her sails bellied as the mod\'s');
});
