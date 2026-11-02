// CLIMB-HANDS (2026-10-02, Mac: "Here are two textures for the first person view (not morrowind)" / "whenever you look
// away from the wall" / "mirrored" / "Definitely animate the arms for when you are climbing, or shifting left to right
// climbing/on a ledge"): THE CLASSIC LANE'S HANDS ON THE WALL. Design: bible/03-World/Parkour-Arc.md (CLIMB-HANDS).
// THE LAW EXECUTES: which climbs draw hands, the two fists (the painting a left hand, the right its mirror - thumbs in),
// never a cut sleeve, the look off the wall (the angled arm alone - CLIMB-HANDS II: the right arm, mirrored, looked right;
// the left as painted looked left), a stopped shimmy's hand onto its stone, the free climb's one hand at a time, a
// catch's hands coming up, the trembling grip, the hands off the wall; the draw; and the wiring by source. AUDIT
// CLIMB-HANDS's pins: test/player/climb/auditclimbhands.test.js; CLIMB-HANDS II's (the hands on the wall): test/combat/climbhands2.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ClimbHands, createClimbHands, climbHandsWanted, lookOffWall, wallYawOf, HANDS, GRIP_ART, REACH_ART } from '../../../src/combat/climbHands.js';
import { climbRigInput } from '../../../src/player/climb/climbPose.js';
import { PARKOUR_HAND_SPAN } from '../../../src/player/parkour.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const DEG = Math.PI / 180;
const NATIVE_W = 320, NATIVE_H = 200;   // DFU's design surface
const N = [0, 0, -1];   // the wall's face points -z: facing it is yaw 0, and the climber's right along it is +x
const hang = (track = [0, 1, 0], extra = {}) => ({ mode: 'hang', normal: N, track, feet: track, grip: 1, move: null, ...extra });
const climb = (track = [0, 1, 0], extra = {}) => ({ ...hang(track, extra), mode: 'climb' });
const settle = (h, c, view = { yaw: 0, pitch: 0 }, s = 1) => { for (let i = 0; i < s * 60; i++) h.update(1 / 60, c, view); return h.out; };
const grip = (out, side) => out.grips.find((g) => g.side === side) ?? null;

test('CLIMB-HANDS which climbs draw: the motor\'s hang and free climb, and a move in flight - never DFU\'s own climb, a leap\'s free flight or off the wall', () => {
  assert.equal(climbHandsWanted(null), false);
  assert.equal(climbHandsWanted(hang()), true);
  assert.equal(climbHandsWanted(climb()), true);
  assert.equal(climbHandsWanted({ move: { kind: 'mantle', t: 0 } }), true);
  assert.equal(climbHandsWanted({ mode: 'climb', classic: true, normal: N }), false, 'DFU\'s climb keeps WeaponManager\'s empty screen');
  assert.equal(climbHandsWanted({ mode: null, flight: { dir: [0, 0, 1] } }), false);
  // the snapshot says which climb it is
  assert.equal(climbRigInput({ climb: { isClimbing: true }, bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0 }, 0).classic, true);
  assert.equal(climbRigInput({ onWall: true, hanging: true, wallNormal: N, bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0 }, 0).classic, false);
});

test('CLIMB-HANDS the hold: two fists come up from below, the left as painted and the right mirrored (thumbs in), each sleeve running off the bottom', () => {
  const h = new ClimbHands();
  h.update(1 / 60, hang(), { yaw: 0 });
  const first = h.out.present;
  assert.ok(first > 0 && first < 1, 'eased in, not cut');
  const out = settle(h, hang());
  assert.equal(out.present, 1);
  const L = grip(out, 'L'), R = grip(out, 'R');
  assert.ok(L && R, 'both hands');
  assert.deepEqual([L.flip, R.flip], [false, true], 'the painting is a left hand (its thumb on its right): the right is the mirror');
  assert.ok(L.x + L.w / 2 < NATIVE_W / 2 && R.x + R.w / 2 > NATIVE_W / 2, 'each on its own side');
  assert.ok(Math.abs(R.w / R.h - GRIP_ART.w / GRIP_ART.h) < 1e-9, 'the painting\'s aspect');
  for (const g of out.grips) assert.ok(g.y + g.h > NATIVE_H + HANDS.BOTTOM_SLACK / 2, 'the sleeve runs off the bottom');
  assert.equal(out.reach, null, 'facing the wall, no reach');
});

test('CLIMB-HANDS looking away: past LOOK_FROM_DEG the hand on that side lets go and the reaching arm alone comes up there - the right arm (mirrored) looked right, the left as painted looked left', () => {
  const near = settle(new ClimbHands(), hang(), { yaw: (HANDS.LOOK_FROM_DEG - 5) * DEG });
  assert.equal(near.reach, null, 'a glance along the wall is no reach');
  // PIN MOVED (CLIMB-HANDS II, Mac: "the hands should stay on whatever your climbing"): the fists are on the wall, so a
  // glance this far along it has carried the far one's stone out of the view - the near one holds on (was: both, fixed)
  assert.deepEqual(near.grips.map((g) => g.side), ['R'], 'the near fist still on its stone, the far one\'s gone off the side');
  const right = settle(new ClimbHands(), hang(), { yaw: 85 * DEG });
  assert.ok(right.reach, 'turned right: the reach');
  // PIN MOVED (CLIMB-HANDS II, Mac: "The single arm out is also inverted for both directions"): looked right, the RIGHT
  // arm - the painting (a left arm) mirrored - up from the right edge (was: the left arm, as painted, from the left edge)
  assert.deepEqual([right.reach.side, right.reach.flip], ['R', true]);
  assert.ok(right.reach.x + right.reach.w <= NATIVE_W && right.reach.x + right.reach.w > NATIVE_W - 10 && right.reach.x + right.reach.w / 2 > NATIVE_W / 2, 'looked right: at the right edge');
  assert.equal(right.reach.w, 190, 'the size it was drawn at before (Mac: "they need to be the originasl size")');
  assert.ok(Math.abs(right.reach.w / right.reach.h - REACH_ART.w / REACH_ART.h) < 1e-9);
  assert.equal(right.grips.length, 0, 'the angled arm alone - no fist (Mac: "Only use the angled arm")');
  const left = settle(new ClimbHands(), hang(), { yaw: -85 * DEG });
  assert.deepEqual([left.reach.side, left.reach.flip], ['L', false], 'turned left: the left arm, as painted');
  assert.ok(left.reach.x >= 0 && left.reach.x < 10 && left.reach.x + left.reach.w / 2 < NATIVE_W / 2, 'looked left: at the left edge');
  assert.equal(left.grips.length, 0);
  // on the free climb too, and a move in flight keeps the hold's hands
  assert.ok(settle(new ClimbHands(), climb(), { yaw: 90 * DEG }).reach);
  assert.equal(settle(new ClimbHands(), { ...hang(), move: { kind: 'mantle', t: 0.1, split: 0.5 } }, { yaw: 90 * DEG }).reach, null);
  // the turn is read off the wall's own face, wrapped
  assert.ok(Math.abs(wallYawOf([1, 0, 0]) + Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(lookOffWall(hang(), 2 * Math.PI + 0.3) - 0.3) < 1e-12);
});

test('CLIMB-HANDS the shimmy stopped mid-reach: the hand finishes onto the nearer stone - most of the way there it lands, barely off its stone it takes it back (ClimbPose._settled) - and stays there, no lift left', () => {
  for (const [stopAt, lands] of [[0.06, false], [0.17, true]]) {
    const h = new ClimbHands();
    settle(h, hang([0, 1, 0]));
    const restX = grip(h.out, 'R').x;
    const v = 0.01;
    for (let x = v; x <= stopAt + 1e-9; x += v) h.update(1 / 60, hang([x, 1, 0]), { yaw: 0 });
    for (let i = 0; i < 60; i++) h.update(1 / 60, hang([stopAt, 1, 0]), { yaw: 0 });
    const xs = [];
    for (let i = 0; i < 30; i++) xs.push(grip(h.update(1 / 60, hang([stopAt, 1, 0]), { yaw: 0 }), 'R').x);
    assert.ok(Math.max(...xs) - Math.min(...xs) < 2 * HANDS.SWAY_X + 1e-6, 'stopped: on its stone (the sway alone moves it)');
    const stone = (lands ? 2 * PARKOUR_HAND_SPAN : 0) - stopAt;   // the stone it took, along the lip from the body now
    assert.ok(Math.abs(xs[0] - restX - stone * HANDS.GAIT_PX) < 2 * HANDS.SWAY_X + 1e-6, `${lands ? 'onto the next stone' : 'back onto its own'} (${(xs[0] - restX).toFixed(1)} px)`);
  }
});

test('CLIMB-HANDS the free climb: one hand off the face at a time (POSE.CLIMB_DUTY), the reaching hand the only one going up the view - and no reach shows the cut sleeve', () => {
  const h = new ClimbHands();
  settle(h, climb([0, 1, 0]));
  let y = 1, prev = null, both = 0, reaches = 0;
  for (let i = 0; i < 180; i++) {
    y += 0.01;
    h.update(1 / 60, climb([0, y, 0]), { yaw: 0 });
    const now = { L: grip(h.out, 'L').y, R: grip(h.out, 'R').y };
    if (prev) {
      const up = ['L', 'R'].filter((k) => now[k] < prev[k] - 1e-9);
      if (up.length === 2) both++;
      reaches += up.length;
    }
    prev = now;
    for (const g of h.out.grips) assert.ok(g.y >= NATIVE_H - g.h - 1e-9, 'never lifted past the slack');
  }
  assert.ok(reaches > 30, 'the hands reach');
  assert.equal(both, 0, 'one at a time');
});

test('CLIMB-HANDS the moves and the grip: a catch from the air brings the hands up from below onto the hold, a mantle presses them down off the screen, a failing grip trembles them, and off the wall they go', () => {
  const h = new ClimbHands();
  settle(h, null);
  h.update(1 / 60, { ...hang(), move: { kind: 'catch', t: 0.02 } }, { yaw: 0 });
  h.update(1 / 60, { ...hang(), move: { kind: 'catch', t: 0.05 } }, { yaw: 0 });
  assert.ok(!grip(h.out, 'R') || grip(h.out, 'R').y > 200 - HANDS.GRIP_H + HANDS.BOTTOM_SLACK + 30, 'a catch from the air starts with the hands below');
  const c = { kind: 'catch', t: 0 };
  for (let i = 1; i <= 30; i++) { c.t = i / 30; h.update(1 / 60, { ...hang(), move: c }, { yaw: 0 }); }
  settle(h, hang(), { yaw: 0, pitch: 0 }, 3);
  const rest = grip(h.out, 'R').y;
  assert.ok(Math.abs(rest - (200 - HANDS.GRIP_H + HANDS.BOTTOM_SLACK)) < HANDS.SWAY_Y + 0.5, 'on the hold');
  const m = { kind: 'mantle', t: 0, split: 0.5 };
  for (let i = 1; i <= 50; i++) { m.t = i / 50; h.update(1 / 60, { ...hang(), move: m }, { yaw: 0 }); }
  assert.equal(h.out.grips.length, 0, 'over the top the hands are gone down off the screen');
  // the grip failing
  const steady = new ClimbHands(), weak = new ClimbHands();
  let dSteady = 0, dWeak = 0;
  settle(steady, hang()); settle(weak, hang([0, 1, 0], { grip: 0.05 }));
  for (let i = 0; i < 30; i++) {
    const a = grip(steady.update(1 / 60, hang(), { yaw: 0 }), 'R').x, b = grip(weak.update(1 / 60, hang([0, 1, 0], { grip: 0.05 }), { yaw: 0 }), 'R').x;
    if (i) { dSteady += Math.abs(a - steady._px); dWeak += Math.abs(b - weak._px); }
    steady._px = a; weak._px = b;
  }
  assert.ok(dWeak > dSteady * 3, 'the weak grip shakes');
  // off the wall: eased out, then nothing
  h.update(1 / 60, null, { yaw: 0 });
  assert.ok(h.out.present > 0 && h.out.present < 1);
  settle(h, null);
  assert.deepEqual([h.out.present, h.out.grips.length, h.out.reach], [0, 0, null]);
  // looked straight down off the wall, the hands are over the head
  assert.equal(settle(new ClimbHands(), hang(), { yaw: 0, pitch: -85 * DEG }).grips.length, 0);
});

test('CLIMB-HANDS the draw: Mac\'s two paintings, loaded once, each box a screen quad on DFU\'s design surface, the mirror by its uv', async () => {
  const quads = [], uploads = [];
  const renderer = { uploadTexture: (kind, key, img) => { uploads.push(key); return { key, img }; }, drawScreenQuad: (tex, rect, uv) => quads.push({ tex, rect, uv }) };
  const png = (w, h) => ({ width: w, height: h, data: new Uint8Array(w * h * 4) });   // decodePng's shape
  const asked = [];
  const hands = createClimbHands({ renderer, fetchBytes: async (f) => { asked.push(f); return f; }, decode: async (f) => (f.includes('grip') ? png(GRIP_ART.w, GRIP_ART.h) : png(REACH_ART.w, REACH_ART.h)) });
  const canvas = { width: 640, height: 400 };
  for (let i = 0; i < 60; i++) hands.update(1 / 60, hang(), { yaw: 85 * DEG });
  assert.equal(hands.draw(canvas), false, 'the first ask draws nothing');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(hands.draw(canvas), true);
  assert.deepEqual(asked, ['art/climb-reach.png']);
  assert.equal(uploads.length, 1, 'only what is drawn is asked for');
  assert.equal(quads.length, 1, 'the reach alone');
  const reach = quads.find((q) => q.tex.key.includes('reach'));
  assert.deepEqual(reach.uv, { u0: 1, v0: 0, u1: 0, v1: 1 }, 'looked right: the right arm, the painting mirrored');   // PIN MOVED (CLIMB-HANDS II): was as painted
  for (let i = 0; i < 60; i++) hands.update(1 / 60, hang(), { yaw: 0 });
  hands.draw(canvas);
  await new Promise((r) => setTimeout(r, 0));
  quads.length = 0;
  hands.draw(canvas);
  assert.deepEqual(quads.map((q) => q.uv ?? null), [null, { u0: 1, v0: 0, u1: 0, v1: 1 }], 'facing the wall: the left as painted, the right its mirror');
  assert.equal(quads[0].rect.h, HANDS.GRIP_H * 2, 'scaled to the canvas');
  assert.equal(uploads.length, 2, 'each painting once');
  assert.equal(hands.draw(null), false);
});

test('CLIMB-HANDS by source: the rig steps the law on the frame\'s climb and draws it on the classic lane under the spell hands\' vetoes, above the sheathe gates; the paintings are on the allow-list', () => {
  const rig = rd('src/combat/weapon/weaponRig.js');
  // PIN MOVED (CLIMB-HANDS II): the view the law is handed is the look and the frame's world lens (climbhands2.test.js
  // drives it through the rig). PIN MOVED (FIELD BUGS 2026-10-22c SPELL-CLIMB): and no climb while a cast's hands play
  // (test/combat/weapon/fb1022c_spellclimb.test.js drives it)
  assert.match(rig, /_climbLower = climbLowerStep\(_climbLower, climbing \|\| \(handsLane && climbHands\.showing\(\)\), dt\);\n(?:\s*\/\/[^\n]*\n)*\s*const castTakesHands = fpsSpellCasting\.isPlayingAnim && !eotbHidesSpellHands\(\);\n\s*const handsClimb = handsLane && _climbLower >= CLIMB_HANDS_AFTER && !castTakesHands \? \(camNow\?\.climb \?\? null\) : null;\n\s*const handsLens = handsClimb \|\| climbHands\.law\.present > 0 \? climbLens\(cv\(\), \{ fov: fieldOfView\(\), viewport: renderer\?\.worldViewportRect \?\? null, aspect: renderer\?\.worldProjAspect \?\? null, offsetHeight: weaponOffsetHeight\(\) \}\) : null;\n\s*climbHands\.update\(dt, handsClimb, \{ yaw: camNow\?\.yaw, pitch: camNow\?\.pitch, lens: handsLens \}\);/);
  // PIN MOVED (FIELD BUGS 2026-10-22c SPELL-CLIMB): and never under a spell's hands
  assert.match(rig, /if \(c && !paralyzed && !spellHandsDrawn && !fpArm\.active\(\) && !eotbHidesWeapon\(\) && !sheetWindowUp\(\)\) climbHands\.draw\(c, \{ tint: fpTint \}\);/);
  assert.ok(rig.indexOf('climbHands.draw(c') < rig.indexOf('const torchOnly = !shown()'), 'above the sheathe gates');
  const doctrine = rd('test/tooling/doctrine.test.js');
  assert.match(doctrine, /'public\/art\/climb-grip\.png', "OURS - Mac's own/);
  assert.match(doctrine, /'public\/art\/climb-reach\.png', "OURS - Mac's own/);
});
