// DECOR-SHELL (2026-09-26, a player over the house decorator, relayed by Mac: "decor they go poof", "They are there /
// But its model disappearing / Placing models is different then the ones after"): A PLACED PIECE STAYS IN THE ROOM.
//
// The free camera flew through walls, floor and ceiling - nothing but the forty-metre leash held it - and a room's
// faces are one-sided, so from outside it the room is an open dollhouse: a piece set on the ceiling's top or behind a
// wall looked placed from up there and was gone from the body's own eye, still listed, still solid, still named
// through the ceiling. And from INSIDE, a model aimed at the ceiling stood on it - above it, out of the room. Three
// more: an online home's list, landing after a placement, stood the room over it whole (the piece taken down, its
// item sent back to the pack); and a model that would not load once was remembered as nothing for the session.
//
// Pinned over a REAL collider room (player/collider.js - two-sided, as the room's own is): the eye is cut short of
// every face and slides along it; a model aimed at a ceiling hangs from it, its top at the face; a flat cannot hang;
// a failed load is asked again; and the host's gate by source.
//
// AUDIT DECOR-SHELL (2026-09-27): the skin was measured along the step - a glide a degree down rested 3.5 mm over the
// floor, and under 1e-4 the next step went through it - so the end of a step is pushed off every face (flyKeep), and
// where the eye cannot stand it stays; a failed list opened the decorator, and the first piece taken out wiped the
// service's list - the list is asked until it stands, and waited for ten seconds at most; the decorator's own model
// cache kept a failed load for the session, and a standing piece of a failed model stood undrawn for the visit; a
// hung piece raised went into the ceiling. And the pins the audit's surviving mutants walked past.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { flyClip, flyStep, DECOR_FLY_SKIN, DECOR_FLY_SPEED, DECOR_FLY_GIVE } from '../src/scenes/decorTool.js';
import { createDecorPlacer, DECOR_HANG_NY, DECOR_RAISE_STEP } from '../src/systems/decorPlacer.js';
import { createDecorRoom, askDecorList, DECOR_MODEL_RETRY_MS, DECOR_LIST_RETRY_MS, DECOR_LIST_RETRY_MAX_MS } from '../src/scenes/decorRoom.js';
import { accountDecor, SESSION_KEY, DECOR_LIST_WAIT_MS } from '../src/net/accountClient.js';
import { settle, toolRig, placeFrom } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A closed box - the room's shell, floor to ceiling - as the collider takes a mesh. */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const p = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const i = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  return { p, i };
}
/** A room ten metres a side and three high, its floor at y=0, centred on the rig's building origin (10, 0, 10);
 *  AUDIT DECOR-SHELL: `extra` more closed boxes, each its own bucket ([key, [x0, y0, z0, x1, y1, z1]]). */
function room(extra = []) {
  const c = new Collider();
  for (const [key, b] of [['room', [5, 0, 5, 15, 3, 15]], ...extra]) {
    const { p, i } = boxMesh(...b);
    c.addMesh(key, p, i, IDENTITY);
  }
  return c;
}
/** AUDIT DECOR-SHELL 1: a hall twenty metres wide, sixty long and four high - room for a long glide. */
function hall() {
  const c = new Collider();
  const { p, i } = boxMesh(0, 0, 0, 20, 4, 60);
  c.addMesh('hall', p, i, IDENTITY);
  return c;
}
/** `frames` of the free camera at sixty a second, `move` held, looking along `yaw` and `pitchDeg` - the tool's own
 *  step (flyStep) and cut (flyClip). */
function fly(c, pos, move, yaw, pitchDeg, frames) {
  const start = [...pos];
  for (let f = 0; f < frames; f++) pos = flyClip(c, pos, flyStep(pos, start, move, yaw, (pitchDeg * Math.PI) / 180, DECOR_FLY_SPEED, 1 / 60));
  return pos;
}

test('DECOR-SHELL flyClip: a step through a face is cut DECOR_FLY_SKIN short of it, either side, and what is left slides along it; a step that meets nothing is the step; no collider, no cut (mutants: no cut, the skin lost, no slide)', () => {
  const c = room();
  const up = flyClip(c, [10, 1.6, 10], [10, 4, 10]);
  assert.ok(near(up[1], 3 - DECOR_FLY_SKIN), `straight up: under the ceiling by the skin (${up[1]})`);
  const wall = flyClip(c, [14, 1.6, 10], [17, 1.6, 10]);
  assert.ok(near(wall[0], 15 - DECOR_FLY_SKIN) && near(wall[2], 10), `into a wall: short of it (${wall})`);
  const slid = flyClip(c, [10, 1.6, 10], [10, 4, 12]);
  assert.ok(slid[1] < 3 && slid[1] > 2.5, `a climb into the ceiling stops under it (${slid[1].toFixed(3)})`);
  assert.ok(near(slid[2], 12), `and slides along it the rest of the way (${slid[2].toFixed(3)})`);
  const out = flyClip(c, [10, 3.5, 10], [10, 4, 10]);
  assert.deepEqual(out, [10, 4, 10], 'above the room, going up: nothing across the step');
  const back = flyClip(c, [10, 3.5, 10], [10, 2, 10]);
  assert.ok(near(back[1], 3 + DECOR_FLY_SKIN), 'and the ceiling met from ABOVE stops it too - the collider is two-sided');
  const open = [11, 1.6, 10];
  assert.equal(flyClip(c, [10, 1.6, 10], open), open, 'a step that meets nothing is the step itself');
  assert.equal(flyClip(null, [10, 1.6, 10], [10, 9, 10])[1], 9, 'no collider: no cut');
  // a piece being moved is no face for the eye either
  const { p, i } = boxMesh(9, 0, 11, 11, 2, 12);
  c.addMesh('decor:m1', p, i, IDENTITY);
  assert.ok(flyClip(c, [10, 1, 10], [10, 1, 13])[2] < 11, 'a piece stops the eye');
  assert.deepEqual(flyClip(c, [10, 1, 10], [10, 1, 13], ['decor:m1']), [10, 1, 13], '...unless it is the one being moved');
});

test('DECOR-SHELL the placer: a model aimed at a face that looks down HANGS from it - its top at the face, turned and scaled - never stands on top of it; a flat cannot hang; a floor and a wall are as they were; AUDIT DECOR-SHELL 5: the normal read at its unit length, and a face looking down less than the bound stood on (mutants: the ceiling stood on, the hang at the bottom, a flat hung, the normal unscaled, the bound at 0.2)', () => {
  const box = [-0.5, -0.1, -0.5, 0.5, 0.9, 0.5];
  const entry = { key: 'm41000', model: 41000, name: 'Chest' };
  const pl = createDecorPlacer(entry, { radius: 1, box });
  const origin = [10, 0, 10];
  const ceiling = pl.pieceAt([10, 3, 10], origin, 'a', [0, -1, 0], 0);
  assert.ok(near(ceiling.pos[1], 3 - 0.9), `its top at the ceiling (${ceiling.pos[1]})`);
  // AUDIT DECOR-SHELL 5: the normal read at its unit length - [0, -2, 0.3] hung either way. A long normal that looks
  // down less than the bound (y -0.37 at unit length) stands; a short one that looks down more (y -0.95) hangs
  assert.ok(near(pl.pieceAt([10, 3, 10], origin, 'b', [0, -0.8, 2], 0).pos[1], 3.1), 'a long normal, looking down less than the bound: it stands, as on a wall');
  assert.ok(near(pl.pieceAt([10, 3, 10], origin, 'b2', [0, -0.3, 0.1], 0).pos[1], 2.1), 'a short one, looking down more: it hangs');
  const floor = pl.pieceAt([10, 0, 10], origin, 'c', [0, 1, 0], 0);
  assert.ok(near(floor.pos[1], 0.1), 'a floor: its bottom on it, as before');
  assert.ok(near(pl.pieceAt([10, 1, 10], origin, 'd', [0, 0, -1], 0).pos[1], 1.1), 'a wall: as before');
  assert.ok(near(pl.pieceAt([10, 1, 10], origin, 'e', null, 0).pos[1], 1.1), 'no surface: as before');
  const tilted = pl.pieceAt([10, 3, 10], origin, 'f', [0, -Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)], 0);
  assert.ok(near(tilted.pos[1], 2.1), `a face looking down at 45 degrees is hung from (the bound, ${DECOR_HANG_NY})`);
  const overhang = pl.pieceAt([10, 3, 10], origin, 'f2', [0, -Math.sin(Math.PI / 9), Math.cos(Math.PI / 9)], 0);
  assert.ok(near(overhang.pos[1], 3.1), 'AUDIT DECOR-SHELL 5: one looking down 20 degrees is not - it stands, as on a wall');
  const big = createDecorPlacer(entry, { radius: 1, box });
  big.rescale(true);
  assert.ok(near(big.pieceAt([10, 3, 10], origin, 'g', [0, -1, 0], 0).pos[1], 3 - 0.9 * 1.1, 1e-3), 'scaled, its scaled top');
  const flat = createDecorPlacer({ key: 'f210.3', model: null, flat: [210, 3], name: 'Lamp' }, { radius: 0.3 });
  assert.equal(flat.pieceAt([10, 3, 10], origin, 'h', [0, -1, 0], 0), null, 'a flat has no top to hang by: it cannot stand there');
  assert.deepEqual(flat.pieceAt([10, 0, 10], origin, 'i', [0, 1, 0], 0).pos, [0, 0, 0], 'on a floor it stands, as before');
});

test('DECOR-SHELL the tool over a real room: holding Jump flies the eye to the ceiling and no further; looking down the ghost stands on the floor, looking up it hangs from the ceiling - inside the room both ways (mutants: the flight unclipped)', async () => {
  const rig = toolRig({ gold: 5000, collider: room() });
  const model = rig.entries.find((e) => e.model != null);
  await placeFrom(rig, model.key);
  assert.equal(rig.tool.flying(), true);
  rig.win.fire('keydown', { code: 'Space', target: rig.doc.body });
  for (let k = 0; k < 40; k++) rig.frame();
  rig.win.fire('keyup', { code: 'Space', target: rig.doc.body });
  rig.tool.cameraOverride(rig.cam);
  assert.ok(rig.cam.pos[1] <= 3 - DECOR_FLY_SKIN + 1e-6, `four seconds of Jump: the eye under the ceiling (${rig.cam.pos[1].toFixed(3)}) - the bug flew it out`);
  rig.cam.pitch = -Math.PI / 2 + 1e-3;
  rig.frame();
  const down = rig.tool.ghost();
  assert.ok(down && near(down.pos[1], 0.1, 1e-3), `looking down: on the floor, its bottom on it (${down?.pos[1]})`);
  rig.cam.pitch = Math.PI / 2 - 1e-3;
  rig.frame();
  const up = rig.tool.ghost();
  assert.ok(up && near(up.pos[1], 3 - 0.9, 1e-3), `looking up: hung from the ceiling, inside the room (${up?.pos[1]})`);
});

test('DECOR-SHELL the room: a model that would not load is asked again by the next piece of it, never remembered as nothing (mutants: the failure cached)', async () => {
  let calls = 0;
  const drawn = [];
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => { calls++; if (calls === 1) throw new Error('the archive was not in hand yet'); return { gpu: 'mesh' }; }, cpuModels: new Map() },
    renderer: { drawMesh: (g) => drawn.push(g) },
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => [0, 0, 0],
  });
  const piece = (id) => ({ id, model: 41000, flat: null, item: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 });
  pool.put(piece('a'));
  await settle();
  assert.equal(pool.draw(), 0, 'the first load failed: nothing to draw');
  pool.put(piece('b'));
  await settle();
  assert.equal(calls, 2, 'the next piece of it asked again');
  assert.equal(pool.draw(), 1, 'and it stands');
  pool.put(piece('a'));
  await settle();
  assert.equal(pool.draw(), 2, 'the first one too, put again (a move, a restore)');
  assert.equal(calls, 2, 'and a model that loaded is kept');
});

test('DECOR-SHELL the host by source: an online home is decorated only once its list has STOOD this visit - AUDIT DECOR-SHELL 2: a refusal or the service unreachable opens nothing (the room stood none of the service\'s pieces and none of its owner\'s taken-out furniture, whose whole list the first piece taken out wrote over the service\'s); the list asked through askDecorList, only while the visit that asked goes on and its list has not stood; the flight cut by the room\'s collider (mutants: the gate gone, the answer never marked, the gate open before the list, a left visit\'s list stood, the list asked after it stood)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /let _decorListed = -1;/);
  assert.match(m, /if \(interiorHome && _decorListed !== _decorVisit\) return null;\n    if \(interiorHome\) return \{ kind: 'home'/);
  const at = m.indexOf('function loadHomeDecor() {');
  const load = m.slice(at, m.indexOf('\n  }\n', at));
  assert.match(load, /const visit = _decorVisit;\n    askDecorList\(\{\n      ask: \(\) => host\.homeDecor\.list\(homeTownOf\(b\), b\.buildingKey\),\n      live: \(\) => visit === _decorVisit && interiorBuilding === b && _decorListed !== visit,\n      stand: \(r\) => \{\n        _decorListed = visit;/, 'the gate opens where the list stands, and nowhere else');
  assert.equal([...m.matchAll(/_decorListed = visit/g)].length, 1, 'one door to the gate: no answer but a list opens it');
  assert.doesNotMatch(m, /\.catch\(\(\) => \{ if \(visit === _decorVisit\) _decorListed = visit; \}\)/, 'a failure never opens it');
  const t = src('src/scenes/decorTool.js');
  assert.match(t, /p\.fly = flyClip\(deps\.collider\?\.\(\), p\.fly, next, through\);/, 'the flight cut by the room\'s own collider, through what the eye looks through');
});

test('AUDIT DECOR-SHELL 1 flyClip: the skin is kept from the face, not along the step - a glide forward looking a degree down rests DECOR_FLY_SKIN over the floor (it rested 3.5 mm over it), a flight along a wall turned five degrees to it rests the skin off the wall (1.7 cm, 39% of the screen past it), and that glide flattened to a fiftieth of a degree, then Crouch, stays in the room (under 1e-4 the ray no longer met the floor, and the eye went through it) (mutants: an uncut step unkept, the push gone)', () => {
  const glide = fly(hall(), [10, 0.5, 2], { forward: 1 }, 0, -1, 1200);
  assert.ok(near(glide[1], DECOR_FLY_SKIN, 1e-3), `gliding a degree down: ${glide[1].toExponential(3)} over the floor`);
  const wall = fly(hall(), [1, 1.6, 2], { forward: 1 }, (-5 * Math.PI) / 180, 0, 240);
  assert.ok(near(wall[0], DECOR_FLY_SKIN, 1e-3), `along a wall turned five degrees to it: ${wall[0].toExponential(3)} off it`);
  assert.ok(wall[2] > 13, `and it slides on along the wall (${wall[2].toFixed(2)})`);
  const c = hall();
  let p = fly(c, [10, 0.5, 2], { forward: 1 }, 0, -1, 700);
  p = fly(c, p, { forward: 1 }, Math.PI, -0.02, 400);
  p = fly(c, p, { rise: -1 }, Math.PI, -0.02, 20);
  assert.ok(near(p[1], DECOR_FLY_SKIN, 1e-3), `flattened to a fiftieth of a degree, then Crouch: in the room, the skin over the floor (${p[1].toFixed(4)}) - it went under it, to -1`);
});

test('AUDIT DECOR-SHELL 1 flyKeep: where the eye cannot stand it stays - a step into a gap narrower than twice the skin (a wardrobe a quarter metre off the wall: it stood 5 cm off one side or the other), a corner the pushes cannot settle, an end a ray from the start does not reach (a push across a face); a gap wider than twice the skin is flown into, and a corner two pushes settle is too (mutants: no look, the look at the push\'s own radius, the unsettled kept, one push, two pushes, no reach ray)', () => {
  const from = [14.8, 1, 8.5];
  assert.deepEqual(flyClip(room([['decor:w', [13.5, 0, 9, 14.75, 2, 11]]]), from, [14.8, 1, 10]), from, 'a long step along the wall into the quarter-metre gap: it stays');
  const wide = flyClip(room([['decor:w', [13.5, 0, 9, 14.5, 2, 11]]]), from, [14.8, 1, 10]);
  assert.deepEqual(wide.map((v) => +v.toFixed(4)), [14.8, 1, 10], 'into a half-metre gap: it goes, the skin off the wall and more off the wardrobe');
  // a slope meeting the floor along z = 12 - `deg` degrees - and a step toward where they meet, from the floor's skin
  const wedge = (deg) => {
    const c = room();
    const a = (deg * Math.PI) / 180, t = Math.tan(a);
    c.addMesh('slope', new Float32Array([5, 0, 12, 15, 0, 12, 15, 2, 12 - 2 / t, 5, 2, 12 - 2 / t]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
    const z = 12 - DECOR_FLY_SKIN / Math.sin(a) - DECOR_FLY_SKIN / t - 0.02;   // just short of where the skins of both meet
    const start = [10, 0.2, z - 0.3];
    return { c, start, end: flyClip(c, start, [10, 0.15, z + 0.05]), off: (q) => Math.abs(q[1] * Math.cos(a) + (q[2] - 12) * Math.sin(a)) };
  };
  const sixty = wedge(60);
  assert.notDeepEqual(sixty.end, sixty.start, 'into a corner of 60 degrees, which two pushes settle: it goes');
  assert.ok(sixty.end[1] >= DECOR_FLY_SKIN - DECOR_FLY_GIVE && sixty.off(sixty.end) >= DECOR_FLY_SKIN - DECOR_FLY_GIVE, `the skin off both, to the give (${sixty.end[1].toFixed(4)}, ${sixty.off(sixty.end).toFixed(4)})`);
  const acute = wedge(45);
  assert.deepEqual(acute.end, acute.start, 'into a corner of 45 degrees, which the pushes do not settle: it stays');
  const fourth = wedge(55);
  assert.deepEqual(fourth.end, fourth.start, 'into a corner of 55 degrees, which only a fourth push would settle: it stays (AUDIT2 DECOR-SHELL 1: DECOR_FLY_PUSHES is the bound)');
  // a stub room: a sheet at y = 1, and a push that lifts the end through it (as a push off a face below might)
  const sheet = {
    raycastHit: (o, d, max) => { const t = (1 - o[1]) / d[1]; return d[1] > 0 && t > 1e-4 && t <= max ? { dist: t, key: 'sheet', normal: [0, -1, 0] } : { dist: Infinity, key: null, normal: null }; },
    _resolveSphere: (q, radius) => { if (radius === DECOR_FLY_SKIN && q[1] < 1) q[1] += 0.3; },
  };
  const below = [0, 0.8, 0];
  assert.deepEqual(flyClip(sheet, below, [0, 0.85, 0.1]), below, 'pushed across the sheet, the end a ray from the start does not reach: it stays');
});

test('AUDIT DECOR-SHELL 1 and 5 flyClip: a still eye stays where it is, even inside the skin; a press into a face from inside the skin never runs the eye back; a moved piece is looked through by the push and the reach ray as by the cut; a step head-on into a wall at its two triangles\' diagonal stops straight in front of it; a climb into the corner of wall and ceiling is cut under the ceiling and kept off the wall (mutants: a still eye pushed, the clamp gone, the push or the ray through the moved piece, the collider\'s skip gone, the reach without the skin, the ray to the step alone, the slide uncut, the slid end unkept)', () => {
  const c = room();
  assert.deepEqual(flyClip(c, [10, 2.9, 10], [10, 2.9, 10]), [10, 2.9, 10], 'a still eye 0.1 under the ceiling: left there');
  assert.deepEqual(flyClip(c, [10, 2.9, 10], [10, 3.2, 10]), [10, 2.9, 10], 'Jump from there: it does not move - never back down the step');
  const piece = room([['decor:m1', [9, 0, 11, 11, 2, 12]]]);
  assert.deepEqual(flyClip(piece, [10, 1, 10], [10, 1, 11.9], ['decor:m1']), [10, 1, 11.9], 'into the piece being moved, which is no face for the push or the ray either');
  // AUDIT2 DECOR-SHELL 1: and a piece placed after it still is one - the push looks past the moved piece's bucket, not
  // stops at it (a moved piece is followed in the collider by every piece set after it)
  const after = room([['decor:m1', [9, 0, 11, 11, 2, 12]], ['decor:m2', [10.15, 0, 11.5, 12, 2, 12.5]]]);
  const past = flyClip(after, [10, 1, 10], [10, 1, 11.9], ['decor:m1']);
  assert.ok(past[0] <= 10.15 - DECOR_FLY_SKIN + DECOR_FLY_GIVE, `pushed off the piece set after the moved one (${past}) - it rested 15 cm into its skin`);
  const head = flyClip(c, [10, 1.52, 14.8], [10, 1.52, 14.9]);
  assert.ok(near(head[0], 10, 1e-9) && near(head[1], 1.52, 1e-9) && near(head[2], 14.8, 1e-9), `head-on into a wall 2 cm over its diagonal: straight in front of it, the skin off it (${head}) - a push at the diagonal slid it aside`);
  const climb = flyClip(c, [14.5, 2.6, 10], [16, 3.5, 10]);
  assert.ok(near(climb[0], 15 - DECOR_FLY_SKIN) && near(climb[1], 3 - DECOR_FLY_SKIN) && near(climb[2], 10), `a climb into the corner: the skin off the wall and the ceiling (${climb}) - 0.17 off the wall before, and through the ceiling with the slide uncut`);
});

test('AUDIT DECOR-SHELL 2 the list, asked until it stands: a refusal, a throw or an answer without pieces stands nothing - the gate stays shut - and it is asked again DECOR_LIST_RETRY_MS on, twice as long each time to DECOR_LIST_RETRY_MAX_MS; the list that stands stands once, its taken-out furniture with it, and nothing is asked after; a visit that ended stands and asks nothing; the client waits DECOR_LIST_WAIT_MS for it and no longer, answering offline (mutants: a failed list stood, a refusal never asked again, a throw never asked again, the wait never grows, the wait unbounded, a left visit asked again, a retry after the visit, a late answer stood, the list waited for forever, the wait dropped)', async () => {
  const waits = [];
  const later = (f, ms) => { waits.push({ f, ms }); return null; };
  const piece = { id: 'p1', model: 41000, flat: null, pos: [1, 0, 1] };
  const script = [
    () => ({ ok: false, error: 'server' }),
    () => { throw new Error('the service is down'); },
    () => ({ ok: true, data: { hidden: [] } }),
    () => ({ ok: true, data: { pieces: [piece], hidden: ['m0:41100'] } }),
  ];
  let listed = -1;
  const asked = [], stood = [];
  await askDecorList({ ask: () => { asked.push(1); return script.shift()(); }, live: () => listed !== 1, stand: (r) => { listed = 1; stood.push(r); }, later });
  assert.deepEqual([stood.length, waits.map((w) => w.ms)], [0, [DECOR_LIST_RETRY_MS]], 'a 502: nothing stands, the gate stays shut, asked again in a while');
  for (const ms of [2 * DECOR_LIST_RETRY_MS, 4 * DECOR_LIST_RETRY_MS]) {
    waits.shift().f();
    await settle();
    assert.deepEqual([stood.length, waits.map((w) => w.ms)], [0, [ms]], 'a throw, an answer without pieces: the same, a longer wait each time');
  }
  waits.shift().f();
  await settle();
  assert.equal(stood.length, 1, 'the list that stands stands once');
  assert.deepEqual(stood[0].data.hidden, ['m0:41100'], 'and the owner\'s taken-out furniture with it - no list is written over the service\'s from nothing');
  assert.deepEqual([waits.length, asked.length], [0, 4], 'stood: nothing is asked after it');
  // the waits grow to the most, and stay there
  const gaps = [];
  await askDecorList({ ask: () => ({ ok: false, error: 'offline' }), live: () => true, stand: () => {}, later: (f, ms) => { gaps.push(ms); if (gaps.length < 7) f(); return null; } });
  for (let i = 0; i < 20; i++) await settle();
  assert.deepEqual(gaps, [2000, 4000, 8000, 16000, DECOR_LIST_RETRY_MAX_MS, DECOR_LIST_RETRY_MAX_MS, DECOR_LIST_RETRY_MAX_MS]);
  // the visit ends: an answer landing after it, a throw after it, a wait running out after it - nothing stands or is asked
  let visit = 1;
  const late = [], lateAsks = [];
  let land = null;
  const pending = askDecorList({ ask: () => { lateAsks.push(1); return new Promise((res) => { land = res; }); }, live: () => visit === 1, stand: (r) => late.push(r), later });
  await settle();
  visit = 2;
  land({ ok: true, data: { pieces: [piece], hidden: [] } });
  await pending;
  assert.deepEqual([late.length, waits.length, lateAsks.length], [0, 0, 1], 'the list landed after the owner walked out: not stood, not asked again');
  visit = 1;
  const threw = askDecorList({ ask: () => new Promise((_, rej) => { land = rej; }), live: () => visit === 1, stand: (r) => late.push(r), later });
  await settle();
  visit = 2;
  land(new Error('the service is down'));
  await threw;
  assert.equal(waits.length, 0, 'a throw after the visit: no wait');
  visit = 1;
  await askDecorList({ ask: () => { lateAsks.push(1); return { ok: false, error: 'server' }; }, live: () => visit === 1, stand: (r) => late.push(r), later });
  visit = 2;
  waits.shift().f();
  await settle();
  assert.deepEqual([late.length, waits.length, lateAsks.length], [0, 0, 2], 'a wait running out after the visit: not asked again');
  // the client's door: the list is waited for DECOR_LIST_WAIT_MS at most, and a write as ever
  const seen = [];
  const storage = { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 'sek', id: 'p' }) : null) };
  const stall = (url, init) => { seen.push(init); return new Promise((_, rej) => { init.signal?.addEventListener?.('abort', () => rej(new Error('aborted'))); }); };
  let timer = null;
  const wait = new Promise((res) => { timer = setTimeout(() => res('still waiting'), 2000); });
  const answer = await Promise.race([accountDecor({ fetch: stall, storage, listWaitMs: 20 }).list(7, 9), wait]);
  clearTimeout(timer);
  assert.deepEqual(answer, { ok: false, error: 'offline' }, 'a list that stalled is given up, answered as a request that never reached the service');
  assert.equal(DECOR_LIST_WAIT_MS, 10000);
  await accountDecor({ fetch: async (url, init) => { seen.push(init); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }, storage }).place({ mapId: 7, buildingKey: 9, character: 'c', piece });
  assert.equal(seen.at(-1).signal, undefined, 'a write is never given up half way - the service may have it');
});

test('AUDIT DECOR-SHELL 3 the decorator\'s own model cache: a model that would not load - it threw, or answered no mesh - is asked again DECOR_MODEL_RETRY_MS on, not every frame, and then it places (the bar said "Loading..." for the session, no ghost, the preview blank) (mutants: a throw kept for good, no mesh kept for good, asked every frame, never asked again)', async () => {
  for (const fail of [() => { throw new Error('the texture archive was not in hand yet'); }, () => null]) {
    let calls = 0, clock = 0;
    const rig = toolRig({ getGpuMesh: async (id) => { calls++; return calls === 1 ? fail() : { gpu: id }; }, now: () => clock });
    const model = rig.entries.find((e) => e.model != null);
    await placeFrom(rig, model.key);
    for (let i = 0; i < 5; i++) { rig.frame(); await settle(); }
    assert.deepEqual([calls, rig.tool.why(), !!rig.tool.ghost()], [1, 'Loading...', false], 'the load failed: no ghost yet, and the frames do not ask every frame');
    clock = DECOR_MODEL_RETRY_MS - 1;
    rig.frame();
    await settle();
    assert.equal(calls, 1, 'not before the wait');
    clock = DECOR_MODEL_RETRY_MS;
    rig.frame();
    await settle();
    rig.frame();
    assert.equal(calls, 2, 'asked again');
    assert.ok(rig.tool.placer() && rig.tool.ghost(), 'and it places');
  }
});

test('AUDIT2 DECOR-SHELL 1 the decorator\'s own model cache: a load still pending across frames is asked once - the frame asks every frame, and the cache holds the asking (mutants: the in-flight mark dropped)', async () => {
  let calls = 0, release = null;
  const rig = toolRig({ getGpuMesh: (id) => { calls++; return new Promise((res) => { release = () => res({ gpu: id }); }); } });
  const model = rig.entries.find((e) => e.model != null);
  await placeFrom(rig, model.key);
  for (let i = 0; i < 5; i++) { rig.frame(); await settle(); }
  assert.deepEqual([calls, rig.tool.why()], [1, 'Loading...'], 'five frames over a load not yet answered: asked once');
  release();
  await settle();
  rig.frame();
  assert.equal(calls, 1);
  assert.ok(rig.tool.placer() && rig.tool.ghost(), 'answered, it places');
});

test('AUDIT DECOR-SHELL 3 the room: a standing piece whose model would not load asks again DECOR_MODEL_RETRY_MS on, and stands drawn and solid once it loads (it stood undrawn, not solid and not pointable for the visit); one taken away before then stands nothing and asks no more (mutants: a standing piece never asked again)', async () => {
  const waits = [];
  const tries = new Map();
  const solid = [];
  const cpu = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint16Array([0, 1, 2]) };
  const pool = createDecorRoom({
    meshes: {
      // 41002 fails five times over (AUDIT2 DECOR-SHELL 7: the retry's wait doubles, to its bound)
      getGpuMesh: async (id) => { tries.set(id, (tries.get(id) ?? 0) + 1); if (tries.get(id) <= (id === 41002 ? 5 : 1)) throw new Error('the archive was not in hand yet'); return { gpu: `mesh${id}` }; },
      cpuModels: new Map([[41000, cpu], [41001, cpu], [41002, cpu]]),
    },
    renderer: { drawMesh: () => {} },
    collider: () => ({ addMesh: (k) => solid.push(k), removeBucket: () => {} }), origin: () => [0, 0, 0],
    later: (f, ms) => { waits.push({ f, ms }); return null; },
  });
  const piece = (id, model) => ({ id, model, flat: null, item: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 });
  pool.put(piece('a', 41000));
  await settle();
  assert.deepEqual([pool.draw(), waits.map((w) => w.ms)], [0, [DECOR_MODEL_RETRY_MS]], 'the load failed: undrawn, and asked again in a while');
  waits.shift().f();
  await settle();
  assert.deepEqual([pool.draw(), solid, tries.get(41000)], [1, ['decor:a'], 2], 'it loaded: drawn, and solid');
  pool.put(piece('b', 41001));
  await settle();
  pool.remove('b');
  waits.shift().f();
  await settle();
  assert.deepEqual([pool.draw(), solid, waits.length], [1, ['decor:a'], 0], 'taken away while it waited: nothing stands, and nothing more is asked');
  // AUDIT2 DECOR-SHELL 7: a build that keeps failing is asked twice as long on each time - it was every two seconds, a
  // piece, for the whole visit
  pool.put(piece('c', 41002));
  const asked = [];
  for (let n = 0; n < 5; n++) {
    await settle();
    const w = waits.shift();
    asked.push(w.ms);
    w.f();
  }
  await settle();
  assert.deepEqual([asked, pool.draw(), tries.get(41002)], [[DECOR_MODEL_RETRY_MS, 2 * DECOR_MODEL_RETRY_MS, 4 * DECOR_MODEL_RETRY_MS, 8 * DECOR_MODEL_RETRY_MS, DECOR_LIST_RETRY_MAX_MS], 2, 6], 'waited 2, 4, 8 and 16 seconds, then the bound, then it stands');
});

test('AUDIT DECOR-SHELL 4 the placer: a hung piece is only lowered - the owner\'s lift is world-up and kept from surface to surface, so raised half a metre and aimed at the ceiling it went half into it, and a metre wholly above it, out of the room; a standing piece rises and sinks as before (mutants: a hung piece raised, a hung piece never lowered)', () => {
  const box = [-0.5, -0.1, -0.5, 0.5, 0.9, 0.5];   // a metre tall, its origin 0.1 over its bottom
  const pl = createDecorPlacer({ key: 'm41000', model: 41000, name: 'Chest' }, { radius: 1, box });
  const origin = [0, 0, 0];
  const top = (p) => p.pos[1] + 0.9, bottom = (p) => p.pos[1] - 0.1;
  for (let i = 0; i < 10; i++) pl.raise(DECOR_RAISE_STEP);
  assert.ok(near(bottom(pl.pieceAt([0, 0, 0], origin, 'a', [0, 1, 0], 0)), 0.5), 'raised half a metre, a standing piece stands half a metre up');
  assert.ok(near(top(pl.pieceAt([0, 3, 0], origin, 'b', [0, -1, 0], 0)), 3), 'aimed at the ceiling it hangs from it, its top at the face - not half into it');
  for (let i = 0; i < 20; i++) pl.raise(DECOR_RAISE_STEP);
  assert.ok(near(top(pl.pieceAt([0, 3, 0], origin, 'c', [0, -1, 0], 0)), 3), 'a metre: still at the face, never above it and out of the room');
  // AUDIT2 DECOR-SHELL 2: the lift it carried in is let go as it hangs - the very first Lower lowers it (it stayed at the
  // face for twenty presses from a metre, sixty from the most)
  assert.equal(pl.state().raise, 0, 'hung, the lift is let go');
  pl.raise(-DECOR_RAISE_STEP);
  assert.ok(near(top(pl.pieceAt([0, 3, 0], origin, 'd', [0, -1, 0], 0)), 3 - DECOR_RAISE_STEP), 'the first Lower lowers it');
  for (let i = 0; i < 5; i++) pl.raise(-DECOR_RAISE_STEP);
  assert.ok(near(pl.state().raise, -6 * DECOR_RAISE_STEP));
  assert.ok(near(top(pl.pieceAt([0, 3, 0], origin, 'e', [0, -1, 0], 0)), 3 - 6 * DECOR_RAISE_STEP), 'lowered, it hangs lower');
  assert.ok(near(bottom(pl.pieceAt([0, 0, 0], origin, 'f', [0, 1, 0], 0)), -6 * DECOR_RAISE_STEP), 'and a standing piece sinks as before');
});

/** AUDIT2 DECOR-SHELL 8: a rig over a real room with a piece grown past the eye's height and placed round it, looking
 *  straight down - and the free camera's `eyeZ`, `hold` a key for `frames`, and the piece's +z `face` (a box a metre a
 *  side, scaled, round the eye at (10, 1.6, 10)). */
async function placedRound(opts = {}) {
  const rig = toolRig({ gold: 5000, collider: room(), ...opts });
  await placeFrom(rig, rig.entries.find((e) => e.model != null).key);
  for (let k = 0; k < 8; k++) rig.win.fire('keydown', { code: 'Equal', target: rig.doc.body });
  rig.cam.pitch = -Math.PI / 2 + 1e-3;
  rig.frame();
  const scale = rig.tool.ghost()?.scale;
  rig.win.fire('keydown', { code: 'KeyE', target: rig.doc.body });
  rig.win.fire('keyup', { code: 'KeyE', target: rig.doc.body });
  await settle();
  const hold = (code, frames) => {
    rig.win.fire('keydown', { code, target: rig.doc.body });
    for (let f = 0; f < frames; f++) rig.frame();
    rig.win.fire('keyup', { code, target: rig.doc.body });
  };
  const eyeZ = () => { rig.tool.cameraOverride(rig.cam); return rig.cam.pos[2]; };
  const face = rig.standing.length === 1 ? 10 + rig.standing[0].pos[2] + 0.5 * scale : NaN;
  return { rig, scale, hold, eyeZ, face };
}

test('AUDIT2 DECOR-SHELL 8 the tool over a real room: a piece placed round the eye is flown and looked through until the eye is out of it and its skin - the room\'s collider is two-sided, so every step from inside was cut at its own faces and the eye was shut in it until Escape; out, it is solid; an online home\'s the same (mutants: the piece never looked through, the look not through it, never solid again, solid at its box and not its skin, the online piece never looked through)', async () => {
  const { rig, scale, hold, eyeZ, face } = await placedRound();
  assert.ok(scale > 2, `grown to ${scale}: taller than the eye stands (1.6)`);
  assert.ok(Number.isFinite(face), 'placed, and standing round the eye');
  rig.cam.pitch = Math.PI / 2 - 1e-3;
  rig.frame();
  const up = rig.tool.ghost();
  assert.ok(up && near(up.pos[1], 3 - 0.9 * scale, 1e-3), `looking up from inside it, the next hangs from the ceiling - not from its own top (${up?.pos[1]})`);
  rig.cam.pitch = 0;
  rig.cam.yaw = 0;   // forward is +z
  hold('KeyW', 10);
  assert.ok(eyeZ() > face + DECOR_FLY_SKIN, `flown out of it (${eyeZ().toFixed(3)}; its face ${face.toFixed(3)}) - the bug held it inside`);
  rig.cam.yaw = Math.PI;
  hold('KeyW', 10);
  assert.ok(near(eyeZ(), face + DECOR_FLY_SKIN, 1e-3), `out of it, it is solid: flying back stops the skin short of its face (${eyeZ().toFixed(3)})`);

  // out of its box but not its skin, it is still looked through: the eye goes back in
  const again = await placedRound();
  again.rig.cam.pitch = 0;
  again.rig.cam.yaw = 0;
  for (let f = 0; f < 40 && again.eyeZ() <= again.face; f++) again.hold('KeyW', 1);
  assert.ok(again.eyeZ() > again.face && again.eyeZ() < again.face + DECOR_FLY_SKIN, `just out of its box, within its skin (${again.eyeZ().toFixed(3)})`);
  again.rig.cam.yaw = Math.PI;
  again.hold('KeyW', 1);
  assert.ok(again.eyeZ() < again.face, `within its skin it is looked through still - back in (${again.eyeZ().toFixed(3)})`);

  // an online home stands the service's piece the same
  const svc = { place: async (a) => ({ ok: true, data: { piece: a.piece } }), remove: async () => ({ ok: true }) };
  const home = await placedRound({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc });
  assert.ok(Number.isFinite(home.face), 'placed online, round the eye');
  home.rig.cam.pitch = 0;
  home.rig.cam.yaw = 0;
  home.hold('KeyW', 10);
  assert.ok(home.eyeZ() > home.face + DECOR_FLY_SKIN, `flown out of the online piece (${home.eyeZ().toFixed(3)})`);
});
