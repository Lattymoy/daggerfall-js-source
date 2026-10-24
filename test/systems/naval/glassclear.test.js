// GLASS-SPOT / GLASS-CLEAR (2026-10-11, the owner: "You can spot ships before you even decide to use the spyglass and
// the ship blocks your view most of the time when using your spyglass") - bible/03-World/Captains-Sea.md "GLASS-SPOT and
// GLASS-CLEAR". A sail not yet made out gives no card - not under the look, not under the laid guns - so nothing names
// her, or ranges her, at a glance. And the glass focuses past the ship I stand aboard: as its lens comes on the world's
// near plane stands out to just past her extent along the look (ui/spyglassView.js glassClearDepth, glassNear), so her
// masts, sails and hands leave the view and every ship beyond her stays in it - never so far that the sea at the
// view's foot is cut. tools/mutants/glassclear.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glassNear, glassClearDepth, glassEyeOverSea, glassFov, GLASS_NEAR_MIN, GLASS_NEAR_MAX, GLASS_CLEAR_PAD, GLASS_SEA_MARGIN, GLASS_SEA_SHARE, GLASS_FIELD } from '../../../src/ui/spyglassView.js';
import { KNOW, GLASS_ZOOM, GLASS_STUDY_S, NAKED_EYE_M } from '../../../src/systems/naval/shipKnowledge.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { orientedBox, segmentBoxEntry } from '../../../src/systems/naval/navalBallistics.js';
import { sparsOf, rigBoxesOf, hullBoxOf, GLASS_AIM_LIFT, OWN_SPARS_S } from '../../../src/scenes/naval/navalHost.js';
import { meshLocalBounds, animatorOf } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { stowSail } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { EYE_HEIGHT, CAPSULE_HEIGHT } from '../../../src/player/motor.js';
import { sea } from '../../navalSea.mjs';

const DEG = Math.PI / 180;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const box = (c, h) => orientedBox(I, c, h);
const corners = (b) => Array.from({ length: 8 }, (_, i) => [0, 1, 2].map((d) => b.c[d] + (i & 1 ? 1 : -1) * b.ax[d] * b.h[0] + (i & 2 ? 1 : -1) * b.ay[d] * b.h[1] + (i & 4 ? 1 : -1) * b.az[d] * b.h[2]));
const holds = (b, p, eps = 1e-6) => { const d = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]]; return [b.ax, b.ay, b.az].every((a, i) => Math.abs(a[0] * d[0] + a[1] * d[1] + a[2] * d[2]) <= b.h[i] + eps); };
/** The frame's field (world.js's) and the glass's x4 lens through it. */
const FOV = 65 * DEG;
const fieldOf = (fovY) => Math.atan(Math.tan(fovY / 2) * GLASS_FIELD);
const spawn = (s, cls, range, bearing = Math.PI / 2) => s.host._sea.get(s.host.spawnShip(cls, { range, bearing }));
const toward = (from, to) => [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
const lookOf = (dir) => ({ yaw: Math.atan2(dir[0], dir[2]), pitch: Math.atan2(dir[1], Math.hypot(dir[0], dir[2])) });
/** A sea with my ship of `hull` at her helm, her canvas set, and the eye at her helm (the world's: the capsule's centre
 *  at her DrivePosition, comeSailAway.js; the eye EYE_HEIGHT over its feet). */
async function atHelm(hull) {
  const s = await sea({ hull });
  for (const sail of s.boat.Sails ?? []) stowSail(animatorOf(sail), false);
  s.run(0.3);
  const c = s.boat.DrivePosition.position;
  const eye = [c[0], c[1] - CAPSULE_HEIGHT / 2 + EYE_HEIGHT, c[2]];
  return { s, eye };
}
/** Every part of a boat as a box: each rigid mesh of hers (a MeshFilter's model on an active node) and her set canvas. */
function partsOf(s) {
  const parts = [];
  for (const node of s.boat.MeshObject.walk()) {
    const local = node.activeInHierarchy ? meshLocalBounds({ models: s.pool.models }, node.getComponent('MeshFilter')?.m_Mesh) : null;
    if (local) parts.push(orientedBox(node.worldMatrix(), local.center, local.extent));
  }
  return [...parts, ...rigBoxesOf(s.boat)];
}

// ── GLASS-SPOT: a sail not made out gives no card ──────────────────────────────────────────────────────────────────

test('GLASS-SPOT the look\'s card: a sail past the naked eye\'s reach gives none - no name, no range - however long the look rests on her; the glass held on her GLASS_STUDY_S makes out her colours, and the card is hers; a hull within NAKED_EYE_M is made out by the eye (mutants: the look\'s gate)', async () => {
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'merchantGalleon', 600);
  const o = s.view.look.origin;
  const aim = () => { s.view.look = { origin: o, dir: toward(o, [e.ship.pos[0], e.ship.pos[1] + GLASS_AIM_LIFT, e.ship.pos[2]]) }; };
  for (let i = 0; i < 20; i++) { aim(); s.run(0.1); }
  assert.equal(e.known, KNOW.hull);
  assert.equal(s.host.hudModel().target, null, 'two seconds on her: a sail, nothing more');
  for (let t = 0; t < GLASS_STUDY_S + 0.15; t += 0.1) { aim(); s.host.glass(0.1, { up: true }); s.run(0.1); }
  s.host.glass(0.1, { up: false });
  assert.equal(e.known, KNOW.colours, 'the glass made her out');
  const card = s.host.hudModel().target;
  assert.deepEqual([card.id, card.name], [e.id, e.ship.names.name], 'her card, by her name');
  // the naked eye: a sail within its reach is made out by it, and gives her card with no glass raised
  const t = await sea({ hull: 2 });
  const c = spawn(t, 'merchantCoaster', NAKED_EYE_M - 20);
  t.view.look = { origin: o, dir: toward(o, [c.ship.pos[0], c.ship.pos[1] + GLASS_AIM_LIFT, c.ship.pos[2]]) };
  t.run(0.3);
  assert.equal(t.host.hudModel().target?.id, c.id);
});

test('GLASS-SPOT the laid guns\' card: a broadside laid on a hull not made out gives no card - never the card of another ship the look runs on to; made out, hers (mutants: the laid gate, the fall to the look)', async () => {
  const s = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const a = spawn(s, 'merchantGalleon', 900);
  const b = spawn(s, 'merchantCarrack', 900, 0);
  const at = { a: [90, 0, 0], b: [320, 0, 0] };   // my starboard beam, the Carrack beyond her on the same line
  const frame = () => { for (const [e, p] of [[a, at.a], [b, at.b]]) { e.ship.pos = [...p]; e.ship.yaw = 0; e.ship.speed = 0; e.ship.yawRate = 0; } s.host.frame(0.1); };
  for (let i = 0; i < 3; i++) frame();
  const eye = [0, 5, 0], box = hullBoxOf(a.boat, s.pool.models);
  s.view.look = { origin: eye, dir: toward(eye, [box.c[0] - box.h[0], 1.2, 0]) };   // on her near side, 1.2 m over the sea
  s.host.attackInput(true);
  frame();
  assert.equal(s.host.hudModel().aim.hot, true, 'laid on her');
  b.known = KNOW.colours;   // the Carrack made out, on the same line past her
  a.known = KNOW.hull;      // and her, not
  assert.equal(s.host.hudModel().target, null, 'no card - never the Carrack\'s');
  a.known = KNOW.colours;
  assert.equal(s.host.hudModel().target?.id, a.id, 'made out: hers');
  s.host.cancelAim();
});

// ── GLASS-CLEAR: the glass focuses past her ───────────────────────────────────────────────────────────────────────

test('GLASS-CLEAR the depth a box reaches into the glass: the deepest of it within the square about the glass\'s circle, along the look - her far face dead ahead, none behind or beside, a slanted wall to where the view\'s side meets it, a box round the eye to its far face; turned with the look\'s yaw and pitch (mutants: the sides, the faces, the deepest, the frame)', () => {
  const field = 0.15, k = Math.tan(field);
  const at = (b, yaw = 0, pitch = 0, eye = [0, 0, 0]) => glassClearDepth({ box: b, eye, yaw, pitch, field });
  near(at(box([0, 0, 20], [2, 2, 2])), 22, 1e-9, 'dead ahead: her far face');
  assert.equal(at(box([0, 0, -20], [2, 2, 2])), 0, 'behind the eye');
  assert.equal(at(box([10, 0, 20], [2, 2, 2])), 0, 'beside the view');
  assert.equal(at(box([0, -10, 20], [2, 2, 2])), 0, 'under it');
  near(at(box([0, 0, 0], [5, 5, 5])), 5, 1e-9, 'round the eye: her far face');
  // a wall slanting away to the left (z = 20 - x): the view's left side meets it deepest, at 20 / (1 - k)
  const s2 = Math.SQRT1_2;
  const wall = orientedBox([s2, 0, -s2, 0, 0, 1, 0, 0, s2, 0, s2, 0, 0, 0, 20, 1], [0, 0, 0], [40, 2, 1e-4]);
  near(at(wall), 20 / (1 - k), 1e-3, 'the slanted wall');
  near(at(box([20, 0, 0], [2, 2, 2]), Math.PI / 2), 22, 1e-9, 'yawed to +x');
  near(at(box([0, 0, 20], [2, 2, 2]), Math.PI / 2), 0, 1e-9, 'and off her');
  near(at(box([0, 10, 10 * Math.sqrt(3)], [1, 1, 1]), 0, 30 * DEG), 20 + 0.5 + Math.cos(30 * DEG), 1e-9, 'pitched up 30 degrees to her');
  near(at(box([3, 1, 20], [2, 2, 2]), 0, 0, [3, 1, 0]), 22, 1e-9, 'from where the eye stands');
  assert.equal(glassClearDepth({ box: null, field }), 0, 'aboard nothing');
  assert.equal(glassClearDepth({ box: box([0, 0, 20], [2, 2, 2]), field: 0 }), 0, 'no field');
});

test('GLASS-CLEAR the focus: the eye\'s own (GLASS_NEAR_MIN) aboard nothing or with the lens off; just past her (GLASS_CLEAR_PAD) as the lens comes on, eased with it; never past GLASS_NEAR_MAX, and NEVER SO FAR THAT THE SEA AT THE VIEW\'S FOOT IS CUT - over every eye, magnification, pitch and ship (mutants: the pad, the gate, the ease, the sea\'s hold, the cap, the margin, the share)', () => {
  assert.deepEqual([GLASS_NEAR_MIN, GLASS_NEAR_MAX, GLASS_CLEAR_PAD, GLASS_SEA_MARGIN, GLASS_SEA_SHARE], [0.2, 120, 0.5, 0.6, 0.85]);
  const fovY = glassFov(FOV, GLASS_ZOOM), half = fovY / 2;
  const n = (o) => glassNear({ lens: GLASS_ZOOM, zoom: GLASS_ZOOM, fovY, pitch: 0, eyeOverSea: 12, own: 10, ...o });
  assert.equal(n({ own: 0 }), GLASS_NEAR_MIN, 'aboard nothing');
  assert.equal(n({ lens: 1 }), GLASS_NEAR_MIN, 'the lens off');
  assert.equal(n({ zoom: 1, lens: 1 }), GLASS_NEAR_MIN);
  near(n(), 10 + GLASS_CLEAR_PAD, 1e-9, 'just past her');
  near(n({ lens: 1 + (GLASS_ZOOM - 1) / 2 }), GLASS_NEAR_MIN + (10 + GLASS_CLEAR_PAD - GLASS_NEAR_MIN) / 2, 1e-9, 'half way with the lens');
  const foot = (h, pitch) => ((h - GLASS_SEA_MARGIN) * Math.cos(half)) / Math.sin(half - pitch);
  near(n({ own: 500 }), GLASS_SEA_SHARE * foot(12, 0), 1e-9, 'held by the sea at the view\'s foot');
  near(n({ own: 500, pitch: -3 * DEG }), GLASS_SEA_SHARE * foot(12, -3 * DEG), 1e-9, 'the look lowered: nearer');
  near(n({ own: 90, pitch: half + DEG }), 90 + GLASS_CLEAR_PAD, 1e-9, 'the foot over the horizon: her whole depth');
  assert.equal(n({ own: 500, pitch: half + DEG }), GLASS_NEAR_MAX, 'and never past the cap');
  assert.equal(n({ eyeOverSea: GLASS_SEA_MARGIN }), GLASS_NEAR_MIN, 'an eye at the swell: the eye\'s own');
  // the law that keeps the sea whole: wherever the view's foot meets the sea, it meets it past the focus
  let held = 0;
  for (const h of [0.5, 1, 1.6, 3.3, 6, 9.5, 12.7, 20, 40]) {
    for (const zoom of [2, 4, 8]) {
      const fy = glassFov(FOV, zoom), hf = fy / 2;
      for (const pd of [-30, -12, -6, -2, 0, 1, 3, 6]) {
        for (const own of [0.5, 3, 12, 45, 90, 300]) {
          const pitch = pd * DEG, got = glassNear({ lens: zoom, zoom, fovY: fy, pitch, eyeOverSea: h, own });
          assert.ok(got >= GLASS_NEAR_MIN && got <= Math.max(GLASS_NEAR_MIN, Math.min(GLASS_NEAR_MAX, own + GLASS_CLEAR_PAD)) + 1e-9, `never past her (${h}, ${zoom}, ${pd}, ${own}): ${got}`);
          const dip = hf - pitch;
          if (dip <= 1e-3) continue;
          const seaAt = ((h - GLASS_SEA_MARGIN) * Math.cos(hf)) / Math.sin(dip);
          assert.ok(got <= Math.max(GLASS_NEAR_MIN, GLASS_SEA_SHARE * seaAt) + 1e-9, `the sea cut (${h}, ${zoom}, ${pd}, ${own}): ${got} vs ${seaAt}`);
          if (got < own + GLASS_CLEAR_PAD - 1e-9) held++;
        }
      }
    }
  }
  assert.ok(held > 50, `the sea held the focus short of her somewhere: ${held}`);
});

test('GLASS-CLEAR the eye over the sea: where the view\'s foot meets the sea along the look\'s bearing, over the ground there where it stands higher - a shore, a shoal; the bed under the sea, no ground, or a foot over the horizon, the sea alone (mutants: the bearing, the higher, the run)', () => {
  const fovY = glassFov(FOV, GLASS_ZOOM), half = fovY / 2;
  const run = 12 / Math.tan(half);
  const o = { eyeX: 0, eyeZ: 0, yaw: 0, eyeY: 12, seaY: 0, fovY, pitch: 0 };
  assert.equal(glassEyeOverSea(o), 12, 'no ground: the sea');
  near(glassEyeOverSea({ ...o, groundAt: (x, z) => (z > run - 1 && z < run + 1 && Math.abs(x) < 1 ? 4 : -10) }), 8, 1e-9, 'a bank 4 m up where the foot meets the sea');
  assert.equal(glassEyeOverSea({ ...o, groundAt: (x, z) => (z > run + 1 ? 4 : -10) }), 12, 'a bank past it: the sea');
  assert.equal(glassEyeOverSea({ ...o, groundAt: () => -10 }), 12, 'the bed under the sea');
  assert.equal(glassEyeOverSea({ ...o, groundAt: () => NaN }), 12, 'no answer');
  near(glassEyeOverSea({ ...o, yaw: Math.PI / 2, groundAt: (x, z) => (x > run - 1 && x < run + 1 && Math.abs(z) < 1 ? 4 : -10) }), 8, 1e-9, 'along the look\'s own bearing');
  near(glassEyeOverSea({ ...o, eyeX: 5, eyeZ: 7, seaY: 2, eyeY: 14, groundAt: (x, z) => (Math.abs(x - 5) < 1 && z > 7 + run - 1 && z < 7 + run + 1 ? 6 : -10) }), 8, 1e-9, 'from where the eye stands, over the sea\'s own level');
  assert.equal(glassEyeOverSea({ ...o, pitch: half + DEG, groundAt: () => 4 }), 12, 'the foot over the horizon');
});

test('GLASS-CLEAR her box: the ship I stand aboard as one box in her own frame - every rigid mesh of her hull and rig and her set canvas within it, for every hull, at her helm or on foot on her deck; a sea ship\'s I stand on; none ashore (mutants: the spars, the canvas, the deck, the sea ship\'s)', async () => {
  for (const hull of Object.values(HULL)) {
    const { s } = await atHelm(hull);
    const b = s.host.ownExtent();
    assert.ok(b, `hull ${hull}: her box`);
    for (const p of sparsOf(s.boat, s.pool.models).points) assert.ok(holds(b, s.boat.MeshObject.transformPoint(p), 1e-4), `hull ${hull}: a spar within`);
    const rig = rigBoxesOf(s.boat);
    for (const r of rig) for (const p of corners(r)) assert.ok(holds(b, p, 1e-4), `hull ${hull}: her canvas within`);
    if (hull >= HULL.SmallShip) assert.ok(rig.length > 0, `hull ${hull}: canvas set`);
    // on foot on her deck, the helm let go: the same box
    s.runtime.sailing = false;
    const c = s.boat.DrivePosition.position;
    s.view.feet = [c[0], c[1] - CAPSULE_HEIGHT / 2, c[2]];
    assert.deepEqual(s.host.ownExtent(), b, `hull ${hull}: on her deck`);
    s.view.feet = [c[0] + 400, 0, c[2]];
    assert.equal(s.host.ownExtent(), null, `hull ${hull}: ashore`);
  }
  // a sea ship's deck I stand on (boarded)
  const s = await sea({ hull: null });
  const e = spawn(s, 'merchantGalleon', 300);
  s.run(0.2);
  const hb = hullBoxOf(e.boat, s.pool.models);
  s.view.feet = [...hb.c];
  const b = s.host.ownExtent();
  assert.ok(b && holds(b, hb.c) && corners(hb).every((p) => holds(b, p, 1e-4)), 'her hull within her box');
});

test('GLASS-CLEAR her box keeps her spars OWN_SPARS_S - a spar raised over her highest is not in it till they are taken again, then it is - and another ship\'s are taken at once; her canvas every frame (mutants: never kept, never taken again, another ship\'s kept)', async () => {
  assert.equal(OWN_SPARS_S, 0.5);
  const s = await sea({ hull: HULL.SmallShip });
  s.run(0.2);
  const mo = s.boat.MeshObject;
  // her spars by how high each stands in her own frame: the highest (the flagstaff, which her colours stand on) and the next
  const tops = [];
  for (const node of mo.walk()) {
    const local = node.activeInHierarchy ? meshLocalBounds({ models: s.pool.models }, node.getComponent('MeshFilter')?.m_Mesh) : null;
    if (local) tops.push([Math.max(...corners(orientedBox(I, local.center, local.extent)).map((c) => mo.inverseTransformPoint(node.transformPoint(c))[1])), node]);
  }
  tops.sort((a, b) => b[0] - a[0]);
  const [[highest], [next, spar]] = tops;
  const top = (b) => b.c[1] + b.h[1];
  const before = s.host.ownExtent();
  near(top(before), highest, 1e-4, 'her box to her highest spar');
  const home = spar.position;
  spar.position = [home[0], home[1] + highest - next + 5, home[2]];   // the next spar raised 5 m over her highest
  assert.deepEqual(s.host.ownExtent(), before, 'kept');
  s.run(OWN_SPARS_S / 2);
  assert.deepEqual(s.host.ownExtent(), before, 'still kept half way');
  s.run(OWN_SPARS_S / 2 + 0.1);   // past it (the sea's clock in its own steps)
  near(top(s.host.ownExtent()), highest + 5, 1e-3, 'taken again: the raised spar in her box');
  spar.position = home;
  // her canvas set, the frame it is set
  for (const sail of s.boat.Sails ?? []) stowSail(animatorOf(sail), false);
  s.host.frame(0.01);
  const set = s.host.ownExtent();
  for (const r of rigBoxesOf(s.boat)) for (const p of corners(r)) assert.ok(holds(set, p, 1e-4), 'her canvas within, the frame it is set');
  // on a sea ship's deck - a galley, twice my galleon's length - the helm let go: her spars at once, never mine kept
  const e = spawn(s, 'navyGalley', 300);
  s.run(0.1);
  s.runtime.sailing = false;
  const hb = hullBoxOf(e.boat, s.pool.models);
  s.view.feet = [...hb.c];
  const hers = s.host.ownExtent();
  for (const p of sparsOf(e.boat, s.pool.models).points) assert.ok(holds(hers, e.boat.MeshObject.transformPoint(p), 1e-4), 'her spars within her box');
});

test('GLASS-CLEAR from her helm through the x4 glass, every hull: nothing of her reaches past its focus on any bearing - unless the sea at the view\'s foot holds it, which is only off the galley\'s long bow - where at the eye\'s own focus her parts filled the glass (the owner\'s "most of the time"); another ship beyond her is drawn and held at 45 m, and a ship nearer the focus than she is never held (mutants: her depth unread, the pad, the hold\'s focus)', async () => {
  const fovY = glassFov(FOV, GLASS_ZOOM), field = fieldOf(fovY);
  const seaHeld = [];
  for (const [name, hull] of Object.entries(HULL)) {
    const { s, eye } = await atHelm(hull);
    const parts = partsOf(s), b = s.host.ownExtent();
    for (const pd of [0, 8]) {
      for (let bd = 0; bd < 360; bd += 30) {
        const yaw = bd * DEG, pitch = pd * DEG;
        const own = glassClearDepth({ box: b, eye, yaw, pitch, field });
        const n = glassNear({ lens: GLASS_ZOOM, zoom: GLASS_ZOOM, fovY, pitch, eyeOverSea: eye[1], own });
        if (n < own + GLASS_CLEAR_PAD - 1e-9) { seaHeld.push(`${name}@${bd}/${pd}`); continue; }
        for (const p of parts) {
          const d = glassClearDepth({ box: p, eye, yaw, pitch, field });
          assert.ok(d <= n - GLASS_CLEAR_PAD + 1e-6, `${name} at ${bd}/${pd}: a part of her ${d.toFixed(2)} m into the glass, past its focus ${n.toFixed(2)}`);
        }
      }
    }
  }
  assert.deepEqual(seaHeld, ['LargeGalley@0/0', 'LargeGalley@30/0', 'LargeGalley@330/0'], 'only her long bow, looking level along it');
  // the owner's view: the galleon at the eye's own focus - her parts in the glass on every bearing forward of the quarter
  const { s, eye } = await atHelm(HULL.SmallShip);
  const parts = partsOf(s).filter((p) => !holds(p, eye, 0));
  const share = (yaw) => {
    const f = [Math.sin(yaw), 0, Math.cos(yaw)], r = [Math.cos(yaw), 0, -Math.sin(yaw)], u = [0, 1, 0], R = Math.tan(field);
    let n = 0, hit = 0;
    for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
      const x = (i / 16) * R, y = (j / 16) * R;
      if (Math.hypot(x, y) > R) continue;
      n++;
      const far = [0, 1, 2].map((d) => eye[d] + (f[d] + r[d] * x + u[d] * y) * 300);
      if (parts.some((p) => { const out = segmentBoxEntry(far, eye, p); return !!out && (1 - out.t) * 300 > GLASS_NEAR_MIN; })) hit++;
    }
    return hit / n;
  };
  const shares = [0, 30, 60, 90].map((bd) => share(bd * DEG));
  assert.ok(shares.every((x) => x > 0.12), `her own parts in the glass: ${shares.map((x) => x.toFixed(2))}`);
  // another ship 45 m off her beam: past the focus, drawn and held
  const e = spawn(s, 'merchantGalleon', 45);
  for (let i = 0; i < 2; i++) { e.ship.pos = [45, 0, 0]; e.ship.speed = 0; s.run(0.1); }
  const her = [e.ship.pos[0], e.ship.pos[1] + GLASS_AIM_LIFT, e.ship.pos[2]];
  const dir = toward(eye, her), { yaw, pitch } = lookOf(dir);
  s.view.look = { origin: eye, dir };
  const n = glassNear({ lens: GLASS_ZOOM, zoom: GLASS_ZOOM, fovY, pitch, eyeOverSea: eye[1], own: glassClearDepth({ box: s.host.ownExtent(), eye, yaw, pitch, field }) });
  const hb = hullBoxOf(e.boat, s.pool.models);
  assert.ok(corners(hb).every((p) => (p[0] - eye[0]) * dir[0] + (p[1] - eye[1]) * dir[1] + (p[2] - eye[2]) * dir[2] > n * Math.hypot(...dir)), `she lies wholly past the focus (${n.toFixed(1)} m)`);
  s.host.glass(0.1, { up: true, field, near: n });
  assert.equal(s.host._glass().on, e.id, 'and the glass holds her');
  s.host.glass(0.1, { up: true, field, near: Math.hypot(...dir) + 1 });
  assert.equal(s.host._glass().on, null, 'a ship nearer than the focus is not held');
  s.host.glass(0.1, { up: false });
});

test('GLASS-CLEAR the world: the glass\'s focus taken each frame from the ship I stand aboard through its circle (navalHost.js ownExtent, glassClearDepth), the eye over the sea there (heightAt), into the frame\'s lens and the glass\'s hold; the eye\'s own while it is down or the ships are off; and no tag, bar, line or name stands over what the focus cut away (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const field = Math\.atan\(Math\.tan\(fovY \/ 2\) \* GLASS_FIELD \* [^\n]*\n(\s+\/\/[^\n]*\n)+\s+const pitch = cam\.pitch \+ climbFeel\.pitch\(\);\n\s+spyglass\.near = spyglass\.lens > 1 && navalOn\(\) && naval \? glassNear\(\{ lens: spyglass\.lens, zoom: spyglass\.zoom, fovY, pitch,\n\s+own: glassClearDepth\(\{ box: naval\.ownExtent\(\), eye: cam\.pos, yaw: cam\.yaw, pitch, field \}\),\n\s+eyeOverSea: glassEyeOverSea\(\{ eyeX: cam\.pos\[0\], eyeZ: cam\.pos\[2\], yaw: cam\.yaw, eyeY: cam\.pos\[1\], seaY: tvSeaY\(\), fovY, pitch, groundAt: heightAt \}\) \}\) : GLASS_NEAR_MIN;\n\s+const card = navalOn\(\) && naval \? naval\.glass\(dt, \{ up: spyglass\.up, zoom: spyglass\.zoom, field, near: spyglass\.near \}\) : null;/);
  assert.match(w, /const fovY = glassFov\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), spyglass\.lens\);/, 'the lens the frame draws');
  assert.match(w, /const glassCuts = \(at\) => at\.front && at\.depth < spyglass\.near;/);
  assert.equal((w.match(/\n\s+if \(glassCuts\(at\)\) continue;/g) || []).length, 3, 'the ships\' tags, the crew\'s bars and their lines');
  assert.match(w, /const at = projectToScreen\(t\.point, w, h, proj, view, rect\);\n[^\n]*\n\s+if \(glassCuts\(at\)\) continue;/, 'the tags');
  assert.match(w, /const at = projectToScreen\(head, w, h, proj, view, rect\);\n[^\n]*\n\s+if \(glassCuts\(at\)\) continue;/, 'the bars');
  assert.match(w, /const at = projectToScreen\(l\.head, w, h, proj, view, rect\);\n[^\n]*\n\s+if \(glassCuts\(at\)\) continue;/, 'the lines');
  assert.match(w, /const blocked = \(head, id\) => glassCuts\(projectToScreen\(head, 1, 1, proj, view\)\) \|\| nameSight\.blocked\(player\.collider, eye, id, head\);/, 'the players\' names');
  assert.match(w, /const proj = horizonProj\(glassFov\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), spyglass\.lens\), worldAspect, spyglass\.near, tvf\);/, 'the frame\'s lens');   // PIN MOVED (OW-HORIZON, 2026-10-20): through scenes/travelHorizon.js horizonProj - the glass's near on the ground, the planes grown under the travel view
  const nh = rd('src/scenes/naval/navalHost.js');
  assert.match(nh, /const boat = boatInPlay\(\) \?\? seaDeckUnderMe\(\)\?\.boat \?\? deps\.aboardPeer\?\.\(\) \?\? null;/, 'my deck, a sea ship\'s, another player\'s I ride');
  assert.match(nh, /\n\s+ownExtent,\n/, 'the host\'s door');
});
