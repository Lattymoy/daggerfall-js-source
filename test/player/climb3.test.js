// CLIMB3 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "Take care of the remaining items", "I
// really want you to go all in on this"): LEAPS, Mac's "Parkour leap, skill-scaled" - "a leap from a hang or a sprint
// off an edge has its own longer, flatter arc scaled by Jumping; the plain jump is unchanged". From a hold a fresh Jump
// leaps: with Left or Right to a hand-hold along the wall past where the lip ends, up to a lip over the one held (no
// top to climb onto), with Back off the wall (the eject). Running, Jump at an edge is a running leap (and a beat after
// the edge, the late press), Jump at a wall runs up it. A leap to a hand-hold is a move along a proven path; the eject
// and the running leap are flights with the catch armed and reaching further (magnetism). Driven on a real Collider and
// a real PlayerMotor, the body measured exactly against the boxes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, GRAVITY } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import {
  registerParkourGate, runLeapLaunch, ejectLaunch, leapSideReach, leapUpReach, wallRunHeight,
  PARKOUR_LEAP_GRIP, PARKOUR_RUNLEAP_DIST_MIN, PARKOUR_RUNLEAP_DIST_MAX, PARKOUR_COYOTE_S, PARKOUR_GRIP_MIN, PARKOUR_QUIET_STEPS,
} from '../../src/player/parkour.js';
import { tickPlayerMinutes } from '../../src/systems/worldTick.js';
import { SKILLS } from '../../src/systems/skills.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

/** A terrain at y 0 and solid boxes, kept for the exact overlap measure. */
function world() {
  const col = new Collider(() => 0), boxes = [];
  let n = 0;
  const box = (...b) => { boxes.push(b); col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX_IDX, I); };
  return { col, box, boxes };
}
function overlap(boxes, feet, height, r = 0.35) {
  let worst = 0;
  for (let y = feet[1] + r; y <= feet[1] + height - r + 1e-9; y += 0.01) {
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      const dx = Math.max(x0 - feet[0], 0, feet[0] - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - feet[2], 0, feet[2] - z1);
      worst = Math.max(worst, r - Math.hypot(dx, dy, dz));
    }
  }
  return worst;
}
const state = (m) => (m._pkMove ? `move:${m._pkMove.kind}` : m._wall ? m._wall.mode : m.grounded ? 'ground' : 'air');
function climber(col, { skill = 50, jumping = skill, enabled = true, said = [] } = {}) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => enabled, inputs: () => ({ climbing: skill, jumping }), say: (l) => said.push(l), tally: () => {} },
  });
}
/** Drive `m` facing `yaw` (or `yaw(i, m, ctx)`, a view that turns) by `script(i, m, ctx)`; answers the states passed
 *  (each once in a row), the moves billed, the hardest landing, the deepest the body went into `boxes` while held or
 *  moved, and the log of positions. */
function drive(m, boxes, yaw, script, steps) {
  const seen = [], billed = [], ctx = {}, log = [];
  let fell = 0, deepest = 0;
  for (let i = 0; i < steps; i++) {
    const input = script(i, m, ctx);
    m.update(1 / 60, { ...blank, ...input }, typeof yaw === 'function' ? yaw(i, m, ctx) : yaw);
    if (m.parkoured) billed.push(m.parkoured);
    if (m.landedFallDistance) fell = Math.max(fell, m.landedFallDistance);
    if ((m._pkMove || m._wall) && i % 2 === 0) deepest = Math.max(deepest, overlap(boxes, m.pos, m.height));
    const s = state(m);
    if (seen[seen.length - 1] !== s) seen.push(s);
    log.push({ s, pos: [...m.pos], grip: m.grip });
  }
  return { seen, billed, fell, deepest, log, ctx };
}
/** Catch the lip in front with Jump held, then, 20 steps into the hang, press `input` once. */
const hangThen = (input) => (i, m, c) => {
  if (c.h == null) { if (m.hanging) { c.h = i; c.grip = m.grip; return {}; } return { jump: i > 5 && i < 40 }; }
  if (i === c.h + 20) { c.before = m.grip; c.at = [...m.pos]; c.n = [...m._wall.normal]; return input; }
  return {};
};
/** AUDIT CLIMB-FIELD J1 (Mac: "You cant jump from a wall"): a press with no hold that way leaps nowhere - it pushes
 *  off: the hands let go of the hang and the body flies out from the wall it hung on. */
const pushedOff = (r, m) => {
  const after = r.seen.slice(r.seen.indexOf('hang'));
  const out = (m.pos[0] - r.ctx.at[0]) * r.ctx.n[0] + (m.pos[2] - r.ctx.at[2]) * r.ctx.n[2];
  return !r.seen.includes('move:leap') && !m.onWall && after.includes('air') && out > 0.5;
};

test('CLIMB3 L1: Jump with Left or Right from a hang leaps to a hand-hold along the wall past where the lip ends - none that way, no leap; the shimmy\'s own lip is never leapt along', () => {
  const w = world();
  w.box(-6, 0, 1, -0.3, 2.4, 4); w.box(0.9, 0, 1, 6, 2.4, 4); w.box(-6, 0, 1.5, 6, 6, 4);   // two ledges, a 1.2 m gap
  const m = climber(w.col);
  m.spawn(-1, 0.02, 0.45);
  const r = drive(m, w.boxes, 0, hangThen({ jump: true, strafe: 1 }), 200);
  assert.deepEqual(r.seen.slice(-3), ['hang', 'move:leap', 'hang'], `leapt and held (${r.seen.join(' > ')})`);
  assert.ok(near(m.pos[0], 0.9, 0.05) && m.hanging, `across the gap, the hands on the far ledge (x ${m.pos[0].toFixed(2)})`);
  assert.ok(r.billed.includes('leap'), 'billed as a leap');
  assert.ok(r.ctx.before - r.log[r.ctx.h + 21].grip >= PARKOUR_LEAP_GRIP - 1e-6, 'the leap spends its grip at once');
  assert.ok(r.deepest < 0.035, `never into the stone (${r.deepest.toFixed(3)})`);
  // Left: the lip runs on that way past the reach - the shimmy's, no leap
  const l = climber(w.col);
  l.spawn(-1, 0.02, 0.45);
  const rl = drive(l, w.boxes, 0, hangThen({ jump: true, strafe: -1 }), 200);
  assert.ok(pushedOff(rl, l), `no leap along the lip held - the press pushes off (${rl.seen.join(' > ')})`);
  // a gap past the reach: no leap (Jumping 0 reaches 1.5 m from the hands)
  const g = world();
  g.box(-6, 0, 1, -0.3, 2.4, 4); g.box(1.6, 0, 1, 6, 2.4, 4); g.box(-6, 0, 1.5, 6, 6, 4);
  const f = climber(g.col, { skill: 50, jumping: 0 });   // Climbing 50 catches the 2.4 m lip (at 0 it never hung, and the pin read nothing)
  f.spawn(-1, 0.02, 0.45);
  const rf = drive(f, g.boxes, 0, hangThen({ jump: true, strafe: 1 }), 200);
  assert.ok(rf.ctx.at, 'hung, and pressed');
  assert.ok(pushedOff(rf, f), `a 1.9 m gap past Jumping 0's ${leapSideReach(0)} m: no leap, pushed off`);
});

test('CLIMB3 L2: Jump from a hang with no top to climb onto leaps up to a lip in the Jumping skill\'s reach over the one held', () => {
  const sill = (top) => {
    const w = world();
    w.box(-3, 0, 1.3, 3, 9, 4); w.box(-3, 2.2, 1.15, 3, 2.4, 1.3); w.box(-3, top - 0.3, 1.15, 3, top, 1.3);
    return w;
  };
  for (const [top, skill, leaps] of [[3.7, 50, true], [4.0, 50, false], [4.0, 100, true]]) {
    const w = sill(top);
    const m = climber(w.col, { skill });
    m.spawn(0, 0.02, 0.6);
    const r = drive(m, w.boxes, 0, hangThen({ jump: true }), 200);
    const reach = leapUpReach(skill);
    if (leaps) {
      assert.ok(r.seen.includes('move:leap') && m.hanging && near(m._wall.lipY, top, 0.02), `Jumping ${skill}: up to the lip ${(top - 2.4).toFixed(1)} m over, in its ${reach} m (${r.seen.join(' > ')})`);
      assert.ok(r.deepest < 0.035, `never into the stone (${r.deepest.toFixed(3)})`);
    } else {
      assert.ok(pushedOff(r, m), `Jumping ${skill}: ${(top - 2.4).toFixed(1)} m over is past its ${reach} m - no leap, pushed off (${r.seen.join(' > ')})`);
    }
  }
});

test('CLIMB3 L3: Jump with Back ejects off the wall - across an alley the catch takes the far ledge (a tap hangs from it, Jump held steps onto it); into nothing, the fall counts from the wall', () => {
  const w = world();
  w.box(-3, 0, 1, 3, 8, 4); w.box(-3, 0, -8, 3, 7.0, -1.9);   // an 8 m roof; a 2.5 m alley; a ledge at 7.0 on the far wall
  const lowerThen = (input) => (i, m, c) => {
    if (i === 0) return { crouch: true };
    if (c.h == null) { if (m.hanging) { c.h = i; return {}; } return { forward: 1 }; }
    if (i === c.h + 20) return input;
    if (i > c.h + 20 && input.hold) return { jump: true };
    return {};
  };
  const tap = climber(w.col);
  tap.spawn(0, 8.02, 2.5);
  const rt = drive(tap, w.boxes, Math.PI, lowerThen({ jump: true, forward: -1 }), 240);
  assert.deepEqual(rt.seen.slice(-4), ['hang', 'air', 'move:catch', 'hang'], `ejected, caught (${rt.seen.join(' > ')})`);
  assert.ok(tap.pos[2] < -1.4 && near(tap._wall.lipY, 7.0, 0.02), 'hanging from the far ledge');
  assert.ok(rt.billed.includes('leap') && rt.fell < 0.5, 'a leap, and no fall');
  const held = climber(w.col);
  held.spawn(0, 8.02, 2.5);
  const rh = drive(held, w.boxes, Math.PI, lowerThen({ jump: true, forward: -1, hold: true }), 240);
  assert.ok(rh.seen.includes('move:mantle') && held.grounded && near(held.pos[1], 7.0, 0.05), `Jump held steps onto the far ledge (${rh.seen.join(' > ')})`);
  // the launch is the Jumping skill's
  assert.ok(ejectLaunch(100).out > ejectLaunch(0).out && ejectLaunch(100).up > ejectLaunch(0).up);
  // an open alley: the eject is a fall from the wall
  const o = world();
  o.box(-3, 0, 1, 3, 8, 4);
  const e = climber(o.col);
  e.spawn(0, 8.02, 2.5);
  const re = drive(e, o.boxes, Math.PI, lowerThen({ jump: true, forward: -1 }), 300);
  assert.ok(e.grounded && e.pos[1] < 0.05 && re.fell > 5.5 && re.fell < 6.6, `fell to the street, billed from the wall's height (${re.fell.toFixed(2)} m)`);
});

test('CLIMB3 L4: running, Jump at an edge is a running leap - longer and flatter than the plain jump, the Jumping skill\'s - and across a gap the far roof is reached', () => {
  for (const skill of [0, 50, 100]) {
    const w = world();
    w.box(-3, 0, -12, 3, 8, 0); w.box(-3, 0, 3, 3, 8, 15);   // two roofs, a 3 m gap
    const m = climber(w.col, { skill });
    m.spawn(0, 8.02, -8);
    const r = drive(m, w.boxes, 0, (i, mm) => ({ forward: mm.pos[2] < 4 || !mm.grounded ? 1 : 0, run: true, jump: mm.pos[2] > -0.9 && mm.pos[2] < -0.4 }), 240);
    assert.ok(r.billed.includes('leap'), `Jumping ${skill}: a leap`);
    assert.ok(m.grounded && near(m.pos[1], 8, 0.05) && m.pos[2] > 3, `Jumping ${skill}: across the gap, on the far roof (z ${m.pos[2].toFixed(2)})`);
    assert.ok(r.fell < 0.5, 'no fall');
  }
  // the law: distance and apex - longer than the plain running jump at every skill, its apex under the plain jump's
  for (const skill of [0, 50, 100]) {
    const { along, up } = runLeapLaunch(skill, GRAVITY);
    const dist = (along * 2 * up) / GRAVITY, apex = (up * up) / (2 * GRAVITY);
    const plainUp = 4.5 * (1 + skill * 0.005), plainApex = (plainUp * plainUp) / (2 * GRAVITY);
    assert.ok(dist >= PARKOUR_RUNLEAP_DIST_MIN - 1e-9 && dist <= PARKOUR_RUNLEAP_DIST_MAX + 1e-9);
    assert.ok(dist > 7.59 * (2 * plainUp) / GRAVITY, `Jumping ${skill}: ${dist.toFixed(2)} m, longer than the plain running jump's`);
    assert.ok(apex <= plainApex + 1e-9 || skill === 0, `Jumping ${skill}: flatter (apex ${apex.toFixed(2)} against ${plainApex.toFixed(2)})`);
  }
  // pressed 2.5 m before the edge: the plain jump, into the gap, as ever
  const w = world();
  w.box(-3, 0, -12, 3, 8, 0); w.box(-3, 0, 5, 3, 8, 15);
  const p = climber(w.col);
  p.spawn(0, 8.02, -8);
  const rp = drive(p, w.boxes, 0, (i, mm) => ({ forward: mm.pos[1] > 7 ? 1 : 0, run: true, jump: mm.pos[2] > -2.8 && mm.pos[2] < -2.3 }), 200);
  assert.ok(!rp.billed.includes('leap') && rp.fell > 7, 'no leap: into the gap');
});

test('CLIMB3 L5: the late press - a fresh Jump a beat after running off an edge leaps as at the edge; a press past the beat is no leap', () => {
  const w = world();
  w.box(-3, 0, -12, 3, 8, 0); w.box(-3, 0, 4, 3, 8, 15);   // a 4 m gap
  const late = (after) => {
    const m = climber(w.col);
    m.spawn(0, 8.02, -8);
    const r = drive(m, w.boxes, 0, (i, mm, c) => {
      if (!mm.grounded && mm.pos[1] < 8 && c.off == null) c.off = i;
      return { forward: mm.pos[2] < 6 || !mm.grounded ? 1 : 0, run: true, jump: c.off != null && i - c.off >= after && i - c.off < after + 4 };
    }, 240);
    return { m, r };
  };
  const ok = late(Math.floor(PARKOUR_COYOTE_S * 60 * 0.5));
  assert.ok(ok.r.billed.includes('leap') && ok.m.grounded && near(ok.m.pos[1], 8, 0.05), `a press ${Math.floor(PARKOUR_COYOTE_S * 30)} steps after the edge leapt across`);
  const lateNo = late(Math.ceil(PARKOUR_COYOTE_S * 60) + 3);
  assert.ok(!lateNo.r.billed.includes('leap'), 'a press past the beat: no leap (the tap catch\'s own press, at most)');
  assert.ok(!(lateNo.m.grounded && lateNo.m.pos[1] > 7.9 && lateNo.m.pos[2] > 4 && lateNo.r.fell < 0.5 && !lateNo.r.billed.length), 'not across on its own');
});

test('CLIMB3 L6: running, Jump at a wall runs up it - into the hang at a lip the hands then reach, or onto the wall itself; a climb, so Roleplay & Realism asks', () => {
  for (const [skill, ends] of [[100, 'hang'], [0, 'climb']]) {
    const w = world();
    w.box(-3, 0, 2, 3, 4.2, 5);
    const m = climber(w.col, { skill });
    m.spawn(0, 0.02, -6);
    const r = drive(m, w.boxes, 0, (i, mm, c) => (c.on ? {} : (mm.onWall ? ((c.on = 1), {}) : { forward: 1, run: true, jump: mm.pos[2] > 0.6 && mm.pos[2] < 1.1 })), 200);
    assert.ok(r.seen.includes('move:wallrun'), `ran up the wall (${r.seen.join(' > ')})`);
    assert.equal(m._wall?.mode, ends, `Climbing/Jumping ${skill}: ends ${ends === 'hang' ? 'hanging from the 4.2 m lip' : 'on the wall'} (run ${wallRunHeight(skill, skill)} m)`);
    if (ends === 'hang') assert.ok(near(m._wall.lipY, 4.2, 0.02));
    assert.ok(r.billed.includes('wallrun') && r.deepest < 0.035, `billed, and never into the wall (${r.deepest.toFixed(3)})`);
  }
  const said = [];
  registerParkourGate(() => 'You can\'t climb whilst holding your weapon.');
  try {
    const w = world();
    w.box(-3, 0, 2, 3, 4.2, 5);
    const m = climber(w.col, { skill: 100, said });
    m.spawn(0, 0.02, -6);
    const r = drive(m, w.boxes, 0, (i, mm) => ({ forward: 1, run: true, jump: mm.pos[2] > 0.6 && mm.pos[2] < 1.1 }), 100);
    assert.ok(!r.seen.includes('move:wallrun') && !r.seen.includes('climb'), 'refused: no run, and no climb');
    assert.ok(said.length >= 1 && said.every((l) => l === said[0]), `the refusal said (${said.length})`);
  } finally { registerParkourGate(null); }
});

test('CLIMB3 L7: Forward from a hang on a sill under a wall that goes on up climbs on up past it (CLIMB2\'s open item) - and over the sill the hands press the wall again (mutant: the sill passed for good)', () => {
  const w = world();
  w.box(-3, 0, 1.3, 3, 6, 4); w.box(-3, 2.2, 1.15, 3, 2.4, 1.3);
  const m = climber(w.col);
  m.spawn(0, 0.02, 0.6);
  const r = drive(m, w.boxes, 0, (i, mm, c) => {
    if (c.h == null) { if (mm.hanging) { c.h = i; return {}; } return { jump: i > 5 && i < 40 }; }
    return i > c.h + 20 && mm.pos[1] < 4 ? { forward: 1 } : {};
  }, 600);
  assert.ok(r.seen.includes('climb') && m.onWall && m.pos[1] >= 4, `climbing on up the wall over the sill (at ${m.pos[1].toFixed(2)}, ${r.seen.join(' > ')})`);
  assert.ok(r.deepest < 0.035, `never into the sill (${r.deepest.toFixed(3)})`);
  // the sill is passed once the feet are over it: from there the climb is the wall's own, pressed to its face (1.3 m)
  // as every free climb is - not standing off it where the body rose in front of the sill
  assert.ok(near(m.pos[2], 1.3 - 0.35, 0.02), `pressed to the wall again, 1.6 m over the sill (z ${m.pos[2].toFixed(3)})`);
});

test('CLIMB3 L8: leaps from the free climb - Jump up to a lip in reach, Jump with Back off the wall', () => {
  // a 9 m wall with a moulding at 5.0; free climbing below it, Jump leaps to it
  const w = world();
  w.box(-3, 0, 1.3, 3, 9, 4); w.box(-3, 4.7, 1.15, 3, 5.0, 1.3);
  const m = climber(w.col, { skill: 100 });
  m.spawn(0, 0.02, 0.75);
  const r = drive(m, w.boxes, 0, (i, mm, c) => {
    if (c.at == null) { if (mm.onWall && mm.pos[1] > 1.5) { c.at = i; return {}; } return { forward: 1 }; }
    return { jump: i === c.at + 5 };
  }, 300);
  assert.ok(r.seen.includes('move:leap') && m.hanging && near(m._wall.lipY, 5.0, 0.02), `leapt up to the moulding (${r.seen.join(' > ')})`);
  // Back: off the wall
  const b = climber(w.col);
  b.spawn(0, 0.02, 0.75);
  const rb = drive(b, w.boxes, 0, (i, mm, c) => {
    if (c.at == null) { if (mm.onWall && mm.pos[1] > 1.5) { c.at = i; return {}; } return { forward: 1 }; }
    return i === c.at + 5 ? { jump: true, forward: -1 } : {};
  }, 300);
  assert.ok(rb.billed.includes('leap') && !b.onWall && b.grounded && b.pos[2] < 0.2, 'ejected, down in front of the wall');
});

test('CLIMB3 L9: the plain jump is unchanged - a running jump in the open flies the same on and off the enhanced lane', () => {
  const fly = (enabled) => {
    const m = climber(world().col, { enabled });
    m.spawn(0, 0.02, -6);
    const ys = [];
    for (let i = 0; i < 90; i++) { m.update(1 / 60, { ...blank, forward: 1, run: true, jump: i === 30 }, 0); ys.push([...m.pos]); }
    return ys;
  };
  const on = fly(true), off = fly(false);
  for (let i = 0; i < on.length; i++) assert.ok(on[i].every((v, k) => near(v, off[i][k], 1e-9)), `step ${i}: the same flight`);
});

test('CLIMB3 L10: a leap is billed as the Jumping skill\'s exertion - a jump\'s fatigue, the Jumping tally; the wall run as the Climbing skill\'s', () => {
  const run = (activity) => {
    const entity = { level: 1, health: 50, maxHealth: 50, fatigue: 6400, magicka: 0, stats: {}, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), items: [], activeEffects: [] };
    let drained = 0;
    tickPlayerMinutes({ entity, classicMinutes: 10.2, dt: 0.001, activity, fatigueMultiplier: 1, rolls: () => 0.5, sinks: { drainFatigue: (d) => { drained += d; } } });
    return { drained, uses: entity.skillUses };
  };
  const jump = run({ standing: true, jumped: true });
  const leap = run({ standing: true, parkoured: 'leap' });
  const wallrun = run({ standing: true, parkoured: 'wallrun' });
  assert.equal(leap.drained, jump.drained, 'a leap costs a jump\'s fatigue');
  assert.equal(leap.uses[SKILLS.Jumping], 1, 'and trains Jumping');
  assert.equal(leap.uses[SKILLS.Climbing], 0);
  assert.equal(wallrun.uses[SKILLS.Climbing], 1, 'a wall run trains Climbing');
});

// ---- the mutation run's pins (CLIMB3's own list, tools/mutants/climb3.json: each law below was a survivor) --------

/** L1's two ledges along a wall 6 m high: the one held, 2.4 m high, ending at x -0.3; the other beginning at `x0`, its
 *  top at `top`. */
function ledges(x0, { top = 2.4 } = {}) {
  const w = world();
  w.box(-6, 0, 1, -0.3, 2.4, 4); w.box(x0, 0, 1, 6, top, 4); w.box(-6, 0, 1.5, 6, 6, 4);
  return w;
}
/** Hang from the held ledge's lip at 2.4, then press Jump with Right. */
const sideLeap = (w, opts) => {
  const m = climber(w.col, opts);
  m.spawn(-1, 0.02, 0.45);
  return { m, r: drive(m, w.boxes, 0, hangThen({ jump: true, strafe: 1 }), 160) };
};

test('CLIMB3 L11: a leap\'s reach and pace are the Jumping skill\'s, Climbing held at 50 - a hold 2.2 m along is past Jumping 0\'s reach and in Jumping 100\'s, the same up leap flies quicker at 100, and the reach is the leap\'s whole way, along and up (mutants: the side reach flat, the pace flat, the reach unbudgeted)', () => {
  for (const [jumping, leaps] of [[0, false], [100, true]]) {
    const { m, r } = sideLeap(ledges(1.1), { skill: 50, jumping });
    assert.ok(r.ctx.h != null, `Jumping ${jumping}: the sill held first`);
    if (leaps) assert.ok(r.seen.includes('move:leap') && m.hanging && m.pos[0] > 1.1, `Jumping ${jumping}: across a 1.4 m gap (x ${m.pos[0].toFixed(2)})`);
    else assert.ok(pushedOff(r, m), `Jumping ${jumping}: a 1.4 m gap is past its ${leapSideReach(jumping)} m - no leap, pushed off`);
  }
  // the pace: up from the sill to a moulding 0.8 m over it - the same leap at both skills, flown at 4 m/s and at 6
  const leapSteps = (jumping) => {
    const w = world();
    w.box(-3, 0, 1.3, 3, 9, 4); w.box(-3, 2.2, 1.15, 3, 2.4, 1.3); w.box(-3, 2.9, 1.15, 3, 3.2, 1.3);
    const m = climber(w.col, { skill: 50, jumping });
    m.spawn(0, 0.02, 0.6);
    const r = drive(m, w.boxes, 0, hangThen({ jump: true }), 200);
    assert.ok(m.hanging && near(m._wall.lipY, 3.2, 0.02), `Jumping ${jumping}: up to the moulding (${r.seen.join(' > ')})`);
    return r.log.filter((e) => e.s === 'move:leap').length;
  };
  const slow = leapSteps(0), quick = leapSteps(100);
  assert.ok(quick < slow - 2, `Jumping 100 flies it quicker (${quick} steps against ${slow})`);
  // the reach is the whole way: a ledge 0.6 m higher, its hold 1.9 m along - 2.2 m of leap, past Jumping 50's 2.0 m
  for (const [jumping, leaps] of [[50, false], [100, true]]) {
    const { m, r } = sideLeap(ledges(0.8, { top: 3.0 }), { skill: 50, jumping });
    if (leaps) assert.ok(r.seen.includes('move:leap') && m.hanging && near(m._wall.lipY, 3.0, 0.02), `Jumping ${jumping}: up and along to the higher ledge`);
    else assert.ok(pushedOff(r, m), `Jumping ${jumping}: along and up together is past its reach - no leap, pushed off`);
  }
});

test('CLIMB3 L12: a leap\'s way is proven - a pillar across the gap, no leap; from a ledge standing 0.3 m proud of the wall to one flush with it, the way goes out from the wall first (mutants: the path unproven, the way not out from the wall)', () => {
  const p = ledges(0.9);
  p.box(0.2, 0, 0.2, 0.4, 6, 1.5);   // a pillar in the gap, standing out from the wall behind it
  const { m, r } = sideLeap(p);
  assert.ok(pushedOff(r, m), `no leap through the pillar - pushed off (${r.seen.join(' > ')})`);
  assert.ok(r.deepest < 0.035, `never into it (${r.deepest.toFixed(3)})`);
  // held on a ledge 0.3 m proud of the one beyond the gap: straight across, the body would cut the proud ledge's end
  const w = world();
  w.box(-6, 0, 0.7, -0.3, 2.4, 4); w.box(0.9, 0, 1, 6, 2.4, 4); w.box(-6, 0, 1.5, 6, 6, 4);
  const o = climber(w.col);
  o.spawn(-1, 0.02, 0.15);
  const ro = drive(o, w.boxes, 0, hangThen({ jump: true, strafe: 1 }), 160);
  assert.ok(ro.seen.includes('move:leap') && o.hanging && o.pos[0] > 0.85 && o.pos[2] > 0.55, `leapt to the flush ledge (x ${o.pos[0].toFixed(2)}, z ${o.pos[2].toFixed(2)}; ${ro.seen.join(' > ')})`);
  assert.ok(ro.deepest < 0.035, `never into the proud ledge's end (${ro.deepest.toFixed(3)})`);
});

test('CLIMB3 L13: a wall run is proven and ends held - a rail across its way, no run; a lip with no hold under it (a steep roof), no run (mutants: the path unproven, the run on past a lip it cannot hold)', () => {
  const runAt = (i, mm, c) => (c.on ? {} : (mm.onWall ? ((c.on = 1), {}) : { forward: 1, run: true, jump: mm.pos[2] > 0.6 && mm.pos[2] < 1.1 }));
  const w = world();
  w.box(-3, 0, 2, 3, 4.2, 5); w.box(-3, 1.0, 1.5, 3, 1.2, 1.7);   // L6's wall, a rail standing off it at the hips
  const m = climber(w.col, { skill: 100 });
  m.spawn(0, 0.02, -6);
  const r = drive(m, w.boxes, 0, runAt, 200);
  assert.ok(!r.seen.includes('move:wallrun') && !r.billed.includes('wallrun'), `no run through the rail (${r.seen.join(' > ')})`);
  assert.ok(r.deepest < 0.035, `never into it (${r.deepest.toFixed(3)})`);
  // a 3.4 m wall under a 60-degree roof: the face ends in the run's reach, and there is no hold at its top
  const s = world();
  s.box(-3, 0, 2, 3, 3.4, 5);
  const ridge = 3.4 + 1.5 * Math.tan(Math.PI / 3);
  s.col.addMesh('roof', new Float32Array([-3, 3.4, 2, 3, 3.4, 2, 3, ridge, 3.5, -3, ridge, 3.5, -3, 3.4, 5, 3, 3.4, 5]), [0, 2, 1, 0, 3, 2, 4, 5, 2, 4, 2, 3], I);
  const q = climber(s.col, { skill: 100 });
  q.spawn(0, 0.02, -6);
  const rq = drive(q, s.boxes, 0, runAt, 200);
  assert.ok(!rq.seen.includes('move:wallrun') && !rq.billed.includes('wallrun'), `no run to a lip with no hold (${rq.seen.join(' > ')})`);
});

test('CLIMB3 L14: the late press is the RUNNING edge\'s, once - walked off the edge, a press a beat after is no leap; a plain running jump\'s second press is no leap; crouched (DFU runs crouched), a running Jump at the edge is no leap (mutants: the walk\'s edge, the press after a jump, the crouched run)', () => {
  const roofs = (far) => { const w = world(); w.box(-3, 0, -12, 3, 8, 0); w.box(-3, 0, far, 3, 8, 15); return w; };
  const walked = roofs(4);
  const m = climber(walked.col);
  m.spawn(0, 8.02, -3);
  const r = drive(m, walked.boxes, 0, (i, mm, c) => {
    if (!mm.grounded && mm.pos[1] < 8 && c.off == null) c.off = i;
    return { forward: 1, jump: c.off != null && i - c.off >= 2 && i - c.off < 6 };
  }, 200);
  assert.ok(r.ctx.off != null && !r.billed.includes('leap'), 'walked off the edge: a press 2 steps after is no leap');
  // a plain running jump in the open, the key let go and pressed again 3 steps up: a jump, never a leap off it
  const j = climber(world().col);
  j.spawn(0, 0.02, -6);
  const rj = drive(j, [], 0, (i) => ({ forward: 1, run: true, jump: i === 30 || i === 33 }), 90);
  assert.ok(!rj.billed.includes('leap') && !rj.billed.length, `a plain jump's second press: no leap (${rj.billed.join(',')})`);
  // crouched, running at the edge of L4's gap
  const c = roofs(3);
  const k = climber(c.col);
  k.spawn(0, 8.02, -8);
  const rk = drive(k, c.boxes, 0, (i, mm, ctx) => {
    const press = mm.pos[2] > -0.9 && mm.pos[2] < -0.4;
    if (press && ctx.at == null) ctx.at = { crouching: mm.crouching, running: mm.isRunning };
    return { crouch: i === 0, forward: 1, run: true, jump: press };
  }, 240);
  assert.ok(rk.ctx.at?.crouching && rk.ctx.at.running, 'pressed crouched and running');
  assert.ok(!rk.billed.includes('leap'), 'crouched: no leap');
});

test('CLIMB3 L15: the grip - a hold with less than a leap\'s grip left above the least leaps nowhere; the eject spends a leap\'s grip as it goes (mutants: a leap on a spent grip, the eject free)', () => {
  const w = ledges(0.9);
  const m = climber(w.col);
  m.spawn(-1, 0.02, 0.45);
  const r = drive(m, w.boxes, 0, (i, mm, c) => {
    if (c.h == null) { if (mm.hanging) { c.h = i; return {}; } return { jump: i > 5 && i < 40 }; }
    if (i === c.h + 20) { mm.grip = PARKOUR_GRIP_MIN + PARKOUR_LEAP_GRIP / 2; return { jump: true, strafe: 1 }; }
    return {};
  }, 100);
  assert.ok(!r.seen.includes('move:leap') && r.log[r.ctx.h + 21].s === 'hang', `no leap on ${(PARKOUR_GRIP_MIN + PARKOUR_LEAP_GRIP / 2).toFixed(2)} of grip: the hands keep the sill`);
  // the eject off L3's roof
  const e = world();
  e.box(-3, 0, 1, 3, 8, 4); e.box(-3, 0, -8, 3, 7.0, -1.9);
  const x = climber(e.col);
  x.spawn(0, 8.02, 2.5);
  const rx = drive(x, e.boxes, Math.PI, (i, mm, c) => {
    if (i === 0) return { crouch: true };
    if (c.h == null) { if (mm.hanging) { c.h = i; return {}; } return { forward: 1 }; }
    if (i === c.h + 20) { c.before = mm.grip; return { jump: true, forward: -1 }; }
    return {};
  }, 120);
  const after = rx.log[rx.ctx.h + 20];
  assert.equal(after.s, 'air', 'ejected');
  assert.ok(rx.ctx.before - after.grip >= PARKOUR_LEAP_GRIP - 1e-9, `the eject spent its grip (${rx.ctx.before.toFixed(3)} to ${after.grip.toFixed(3)})`);
});

test('CLIMB3 L16: the leap\'s flight - its catch reaches further (a ledge 0.2 m over the roof left), looks the way it flew (the view turned along the wall), keeps the quiet clear of the wall left (a ledge within reach as the hands leave), and is over once the body is down (mutants: no magnetism, the view\'s look, no quiet, the flight never ending)', () => {
  const ejectAt = (H, zf, yaw = () => Math.PI) => {
    const w = world();
    w.box(-3, 0, 1, 3, 8, 4); w.box(-3, 0, -8, 3, H, zf);
    const m = climber(w.col);
    m.spawn(0, 8.02, 2.5);
    const r = drive(m, w.boxes, yaw, (i, mm, c) => {
      if (i === 0) return { crouch: true };
      if (c.h == null) { if (mm.hanging) { c.h = i; return {}; } return { forward: 1 }; }
      return i === c.h + 20 ? { jump: true, forward: -1 } : {};
    }, 240);
    return { m, r };
  };
  // magnetism: across a 2.9 m alley, a ledge 0.2 m higher than the roof the eject left
  const g = ejectAt(8.2, -1.9);
  assert.ok(g.r.seen.includes('move:catch') && g.m.hanging && near(g.m._wall.lipY, 8.2, 0.02), `caught the far ledge (${g.r.seen.join(' > ')})`);
  // the look: the view turned along the wall before the press - the catch still looks across the alley
  const t = ejectAt(7.0, -1.9, (i, mm, c) => (c.h != null && i >= c.h + 10 ? Math.PI / 2 : Math.PI));
  assert.ok(t.m.hanging && near(t.m._wall.lipY, 7.0, 0.02) && t.r.fell < 0.5, `caught the far ledge, the view turned away (${t.r.seen.join(' > ')})`);
  // the quiet: across a 1.2 m alley the far ledge is in reach as the hands leave - caught once the quiet is over
  const q = ejectAt(8.0, -0.2);
  const press = q.r.ctx.h + 20, caught = q.r.log.findIndex((e, i) => i >= press && e.s === 'move:catch');
  assert.ok(caught > press + PARKOUR_QUIET_STEPS && q.m.hanging, `the catch waited out the quiet (${caught - press} steps)`);
  // the flight is over on the ground: a running leap across L4's gap, then a plain jump at a wall to the right on the
  // far roof - its catch looks where the view does, not the way the leap flew
  const w = world();
  w.box(-3, 0, -12, 3, 8, 0); w.box(-3, 0, 3, 3, 8, 15); w.box(0.55, 8, 3, 3, 10.4, 15);
  const m = climber(w.col);
  m.spawn(0, 8.02, -8);
  const r = drive(m, w.boxes, (i, mm, c) => (c.land != null && i >= c.land + 20 ? Math.PI / 2 : 0), (i, mm, c) => {
    if (c.land == null) {
      if (c.leapt && mm.grounded) { c.land = i; return {}; }
      if (mm.parkoured === 'leap') c.leapt = true;
      return { forward: 1, run: true, jump: mm.pos[2] > -0.9 && mm.pos[2] < -0.4 };
    }
    return { jump: i >= c.land + 30 && i < c.land + 90 };
  }, 260);
  assert.ok(r.ctx.land != null && m.pos[2] > 3, 'leapt the gap and landed');
  assert.ok(m.hanging && near(m._wall.lipY, 10.4, 0.02), `the plain jump caught the wall to the right (${r.seen.join(' > ')})`);
});

test('CLIMB3 L17: a held Jump is no press - a free climb taken with Jump held (the grab) climbs and never leaps; a refused leap from a hang holds its step, the body not moved (mutants: the held key leaping, the refused press letting the step go)', () => {
  const w = world();
  w.box(-3, 0, 1.3, 3, 9, 4); w.box(-3, 4.7, 1.15, 3, 5.0, 1.3);   // L8's wall and moulding
  const m = climber(w.col, { skill: 100 });
  m.spawn(0, 0.02, 0.75);
  const r = drive(m, w.boxes, 0, (i) => ({ forward: 1, jump: i > 5 }), 300);
  assert.ok(!r.seen.includes('move:leap'), `Jump held through the climb: no leap (${r.seen.join(' > ')})`);
  assert.ok(r.billed.includes('catch') && m.onWall && m.pos[1] > 1.5, `grabbed the wall and climbing on it (at ${m.pos[1].toFixed(2)})`);
  // L1's Left: no hold that way and no grip left to push off with (AUDIT CLIMB-FIELD J1: with it, the press pushes off)
  // - the press is spent and the hands hold, the body exactly where it hung
  const l = climber(ledges(0.9).col);
  l.spawn(-1, 0.02, 0.45);
  const weak = hangThen({ jump: true, strafe: -1 });
  const rl = drive(l, [], 0, (i, mm, c) => { if (c.h != null && i === c.h + 20) mm.grip = PARKOUR_GRIP_MIN + PARKOUR_LEAP_GRIP - 0.01; return weak(i, mm, c); }, 80);
  const was = rl.log[rl.ctx.h + 19].pos, now = rl.log[rl.ctx.h + 20].pos;
  assert.ok(l.hanging && Math.hypot(now[0] - was[0], now[1] - was[1], now[2] - was[2]) < 1e-9, `the refused press held the step (moved ${Math.hypot(now[0] - was[0], now[1] - was[1], now[2] - was[2]).toExponential(2)} m)`);
});
