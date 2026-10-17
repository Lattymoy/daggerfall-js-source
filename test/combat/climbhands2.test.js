// CLIMB-HANDS II (2026-10-13, Mac: "With climbing. The sprite hands should be spread out more and the morrowind model
// should use climbing hands in first person. Additionally, the hands should stay on whatever your climbing and not rotate
// with the screen. The only one that should rotate with the screen is the single arm out. The single arm out is also
// inverted for both directions"). Record: bible/03-World/Parkour-Arc.md (CLIMB-HANDS II).
// THE LAW EXECUTES: the fists as far apart as the 3D body's wrists on the lip; pinned to the wall through the world's
// lens - carried across the screen by the view's turn exactly where an independent rotation of the eye puts the stone
// they hold, down it by a look up, up it by a look down only as far as the sleeve's slack (a hand gone under the edge
// stays under it); the frame they are pinned in the body's facing on the climb; the reaching arm the screen's alone and
// the arm of the side looked to (the paintings' own pixels say which arm each is), its hand letting go as it comes up and
// the other holding on; the lens off the frame's canvas; the rig handing the law that lens; and the Morrowind arms drawn
// while they climb sheathed, the weapon's sway off them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { ClimbHands, climbLens, pinToView, DESIGN_LENS, HANDS, GRIP_ART, REACH_ART } from '../../src/combat/climbHands.js';
import { POSE } from '../../src/player/climb/climbPose.js';
import { SETTINGS_DEFAULTS } from '../../src/systems/settings/settingsDefaults.js';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { fieldOfView } from '../../src/ui/viewSettings.js';
import { weaponOffsetHeight } from '../../src/ui/hud/hudLarge.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';
import { resetToDefaults } from '../../src/systems/settings/settings.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const DEG = Math.PI / 180, DT = 1 / 60;
const NATIVE_W = 320, NATIVE_H = 200;   // DFU's design surface
const N = [0, 0, -1];   // the wall's face points -z: facing it is yaw 0, the climber's right along it +x
const hang = (extra = {}) => ({ mode: 'hang', classic: false, normal: N, lipY: 2.8, track: [0, 1, 0], feet: [0, 1, 0], grip: 1, move: null, ...extra });
const climb = (extra = {}) => ({ ...hang(extra), mode: 'climb', lipY: null });   // the free climb, still: no sway, no gait
const REST_TOP = NATIVE_H - HANDS.GRIP_H + HANDS.BOTTOM_SLACK;   // a fist's top at rest, square to the wall and level
const GRIP_Y = REST_TOP + HANDS.GRIP_AT * HANDS.GRIP_H;   // ...and its grip's height there
const side = (out, s) => out.grips.find((g) => g.side === s) ?? null;
const settle = (c, view, n = 120) => { const h = new ClimbHands(); for (let i = 0; i < n; i++) h.update(DT, c, view); return h.out; };
/** Two laws stepped alike - the same clock, the same sway - one seen square and level through `lens`, one through `view`. */
const twin = (c, view, n = 90) => {
  const a = new ClimbHands(), b = new ClimbHands();
  for (let i = 0; i < n; i++) { a.update(DT, c, { yaw: c.yaw ?? 0, pitch: 0, lens: view.lens }); b.update(DT, c, view); }
  return [a.out, b.out];
};

/** THE EYE'S OWN PICTURE, by the rotation itself (not pinToView's closed form): a design point seen square to `face` and
 *  level is a way in the world; found again through the view at (`yaw`, `pitch`) - the world view's own frame, forward
 *  [sin yaw cos pitch, sin pitch, cos yaw cos pitch], right [cos yaw, 0, -sin yaw] (fpArm's climbRequestToFirstPerson). */
function seen(x, y, lens, face, yaw, pitch) {
  const a = ((x - lens.cx) / lens.hx) * lens.tanX, b = ((lens.cy - y) / lens.hy) * lens.tanY;
  const right = (t) => [Math.cos(t), 0, -Math.sin(t)];
  const fwd = (t, p) => [Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p)];
  const up = (t, p) => [-Math.sin(t) * Math.sin(p), Math.cos(p), -Math.cos(t) * Math.sin(p)];
  const r0 = right(face), f0 = fwd(face, 0);
  const d = [a * r0[0] + f0[0], b + f0[1], a * r0[2] + f0[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const X = dot(d, right(yaw)), Y = dot(d, up(yaw, pitch)), Z = dot(d, fwd(yaw, pitch));
  return { x: lens.cx + (X / Z / lens.tanX) * lens.hx, y: lens.cy - (Y / Z / lens.tanY) * lens.hy, z: Z };
}

/** An 8-bit RGBA PNG's pixels (the paintings' own format), unfiltered - its rows, 4 bytes a pixel. */
function png(path) {
  const buf = readFileSync(new URL('../../' + path, import.meta.url));
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); assert.deepEqual([data[8], data[9], data[12]], [8, 6, 0], `${path}: 8-bit RGBA, not interlaced`); }
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4 + 1, rows = [];
  let prev = Buffer.alloc(w * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride], cur = Buffer.from(raw.subarray(y * stride + 1, (y + 1) * stride));
    for (let i = 0; i < cur.length; i++) {
      const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      if (f === 1) cur[i] = (cur[i] + a) & 255;
      else if (f === 2) cur[i] = (cur[i] + b) & 255;
      else if (f === 3) cur[i] = (cur[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      else assert.equal(f, 0, `filter ${f}`);
    }
    rows.push(cur); prev = cur;
  }
  const at = (x, y) => { const r = rows[Math.round(y)], i = Math.round(x) * 4; return { r: r[i], g: r[i + 1], b: r[i + 2], a: r[i + 3] }; };
  return { w, h, at, opaque: (y) => Array.from({ length: w }, (_, x) => x).filter((x) => at(x, y).a > 200) };
}

test('CLIMB-HANDS II the spread: the fists as far apart as the 3D body\'s wrists on the lip, seen through DFU\'s own lens - a hand\'s breadth and more between them, where at 52 their boxes met in the middle', () => {
  const half = POSE.HANDS_APART / 2, ahead = POSE.FACE_BACK - POSE.WRIST_OUT;
  assert.equal(HANDS.GRIP_APART, Math.round((NATIVE_W / 2) * (half / ahead) / DESIGN_LENS.tanX), 'the body\'s grip, where the picture has it');
  const fov = Number(SETTINGS_DEFAULTS.Video.FieldOfView) * DEG;
  assert.ok(Math.abs(DESIGN_LENS.tanY - Math.tan(fov / 2)) < 1e-12 && Math.abs(DESIGN_LENS.tanX / DESIGN_LENS.tanY - NATIVE_W / NATIVE_H) < 1e-12,
    'DFU\'s own lens: defaults.ini\'s field of view, vertical, over the 320x200 surface');
  const out = settle(climb(), { yaw: 0, pitch: 0 });
  const L = side(out, 'L'), R = side(out, 'R');
  assert.ok(Math.abs(L.x + L.w / 2 - (NATIVE_W / 2 - HANDS.GRIP_APART)) < 1e-9 && Math.abs(R.x + R.w / 2 - (NATIVE_W / 2 + HANDS.GRIP_APART)) < 1e-9, 'each centred GRIP_APART off the middle');
  assert.ok(R.x - (L.x + L.w) > 60, `the boxes well apart (${(R.x - (L.x + L.w)).toFixed(1)} px between them)`);
  // the grip - the point of the fist pinned to the wall - is the hand, not the sleeve: the painting's glove there
  const art = png('public/art/climb-grip.png');
  const px = art.at(art.w / 2, HANDS.GRIP_AT * art.h);
  assert.ok(px.a > 200 && px.r - px.b > 20, `the grip on the glove (rgba ${px.r},${px.g},${px.b},${px.a})`);
  assert.deepEqual([art.w, art.h], [GRIP_ART.w, GRIP_ART.h]);
});

test('CLIMB-HANDS II the fists stay on the wall: the view\'s turn carries each across the screen exactly where the eye\'s own rotation puts the stone it holds - through DFU\'s lens, a 16:9 screen\'s and a docked bar\'s widescreen strip - and a stone out of the view takes its hand with it', () => {
  const lenses = {
    dfu: DESIGN_LENS,
    '16:9': climbLens({ width: 1920, height: 1080 }, { fov: 65 * DEG }),
    'docked 21:9 at 90': climbLens({ width: 2560, height: 1080 }, { fov: 90 * DEG, viewport: { x: 0, y: 0.12, w: 1, h: 0.88 }, offsetHeight: 130 }),
  };
  let checked = 0, left = 0;
  for (const [name, lens] of Object.entries(lenses)) {
    for (const deg of [-35, -20, -8, 4, 15, 30, 38]) {
      const yaw = deg * DEG;
      const [sq, turned] = twin(hang(), { yaw, pitch: 0, lens });
      for (const s of ['L', 'R']) {
        const a = side(sq, s), b = side(turned, s);
        const want = seen(a.x + a.w / 2, GRIP_Y, lens, 0, yaw, 0);
        if (!b) {   // its stone has gone out of the view: off the side (the box clear of the screen) or behind
          assert.ok(want.z <= 0 || want.x - a.w / 2 >= NATIVE_W || want.x + a.w / 2 <= 0, `${name} ${deg}: the ${s} hand gone while its stone is in the view (${want.x.toFixed(1)})`);
          left++;
          continue;
        }
        assert.ok(Math.abs(b.x + b.w / 2 - want.x) < 1e-6, `${name} ${deg}: the ${s} hand across on its stone (${(b.x + b.w / 2).toFixed(3)} against ${want.x.toFixed(3)})`);
        assert.ok(Math.abs(b.y - a.y - Math.max(want.y - GRIP_Y, -HANDS.BOTTOM_SLACK)) < 1e-6, `${name} ${deg}: and up or down with it`);
        checked++;
      }
    }
  }
  assert.ok(checked > 25 && left > 5, `hands checked on their stones (${checked}) and leaving with them (${left})`);
  // turning right the wall goes left: so do the hands
  const [sq, right] = twin(hang(), { yaw: 15 * DEG, pitch: 0 });
  for (const s of ['L', 'R']) if (side(right, s)) assert.ok(side(right, s).x < side(sq, s).x - 20, `${s} carried left by a turn right`);
  // and pinToView itself answers the same (the closed form the law draws with)
  const p = pinToView(200, 120, DESIGN_LENS, 0.4, 0), q = seen(200, 120, DESIGN_LENS, 0, 0.4, 0);
  assert.ok(Math.abs(p[0] - q.x) < 1e-9 && Math.abs(p[1] - q.y) < 1e-9);
  assert.equal(pinToView(300, 100, DESIGN_LENS, Math.PI, 0), null, 'behind the eye: nowhere');
  assert.ok(seen(300, 190, DESIGN_LENS, 0, 2.4, 0).z < 0, 'a point the turn puts behind the eye, low in the picture...');
  assert.equal(pinToView(300, 190, DESIGN_LENS, 2.4, -0.5), null, '...is nowhere (no column to keep it on), though a look down brings its height back into range');
});

test('CLIMB-HANDS II the frame they are pinned in is the body\'s facing on the climb - the snapshot\'s yaw, the motor\'s eased turn to the wall - and with none given, the wall\'s own', () => {
  // the body still turning to the wall (0.3 rad short of it), the view with the body: the hands where they rest
  const [restWall] = twin(climb(), { yaw: 0, pitch: 0 });
  const withBody = settle(climb({ yaw: 0.3 }), { yaw: 0.3, pitch: 0 });
  for (const s of ['L', 'R']) assert.ok(Math.abs(side(withBody, s).x - side(restWall, s).x) < 1e-9 && Math.abs(side(withBody, s).y - side(restWall, s).y) < 1e-9, `${s} at rest before the body it is on`);
  // the view held on the wall's facing while the body is turned off it: the hands are the body's - turned with it
  const offBody = settle(climb({ yaw: 0.3 }), { yaw: 0, pitch: 0 });
  const R = side(restWall, 'R'), want = seen(R.x + R.w / 2, GRIP_Y, DESIGN_LENS, 0.3, 0, 0);
  assert.ok(Math.abs(side(offBody, 'R').x + R.w / 2 - want.x) < 1e-6, 'pinned to the body, not to the wall');
});

test('CLIMB-HANDS II looked up the fists go down the wall with it (exactly, and never sideways); looked down they rise with it only to the sleeve\'s slack and wait there - a hand gone under the edge stays under it - and steeply down they leave the view as before', () => {
  for (const deg of [6, 12, 25, -4, -9]) {
    const pitch = deg * DEG;
    const [sq, tilted] = twin(hang(), { yaw: 0, pitch });
    for (const s of ['L', 'R']) {
      const a = side(sq, s), b = side(tilted, s);
      const want = seen(a.x + a.w / 2, GRIP_Y, DESIGN_LENS, 0, 0, pitch);
      if (!b) { assert.ok(want.y - GRIP_Y + REST_TOP > NATIVE_H - 1, `${deg}: gone only under the bottom edge`); continue; }
      assert.ok(Math.abs(b.x - a.x) < 1e-9, `${deg}: ${s} never slid sideways`);
      assert.ok(Math.abs(b.y - a.y - Math.max(want.y - GRIP_Y, -HANDS.BOTTOM_SLACK)) < 1e-6, `${deg}: ${s} with the wall (${(b.y - a.y).toFixed(3)} against ${(want.y - GRIP_Y).toFixed(3)})`);
    }
  }
  assert.ok(side(twin(hang(), { yaw: 0, pitch: 12 * DEG })[1], 'R').y > REST_TOP + 25, 'a look up takes them well down');
  // looked down past the slack: the fists wait at its top - the cut sleeve never shows
  for (const deg of [-15, -30, -45]) {
    const out = settle(hang(), { yaw: 0, pitch: deg * DEG });
    assert.equal(out.grips.length, 2);
    for (const g of out.grips) assert.ok(g.y >= NATIVE_H - g.h - 1e-9 && g.y <= NATIVE_H - g.h + 2 * HANDS.SWAY_Y + 1e-6, `${deg}: at the slack's top (${g.y.toFixed(2)})`);
  }
  // the free climb's reach up the view, looked down: past the slack's top it would show the cut - it never does
  const law = new ClimbHands();
  let lifted = 0;
  for (let i = 0; i < 180; i++) {
    law.update(DT, climb({ track: [0, 1 + i * 0.01, 0], feet: [0, 1 + i * 0.01, 0] }), { yaw: 0, pitch: -20 * DEG });
    for (const g of law.out.grips) { assert.ok(g.y >= NATIVE_H - g.h - 1e-9, 'never lifted past the slack'); if (g.y < NATIVE_H - g.h + 1e-6) lifted++; }
  }
  assert.ok(lifted > 30, `held at the slack's top while the reach would go on up (${lifted} frames)`);
  // a pull-up's hands gone down over the top stay gone however far down the eye looks - up to the steep look-down's own
  // exit (DOWN_FROM_DEG) a look down would lift a hand out from under the edge by more than the let-go put it there
  for (const deg of [0, -30, -40, -45, -48]) {
    const m = { kind: 'mantle', from: [0, 1, 0], up: [0, 2.85, 0], to: [0, 2.8, -0.5], split: 0.6, exit: null, t: 0, dur: 0.9 };
    const pull = new ClimbHands(), view = { yaw: 0, pitch: deg * DEG };
    for (let i = 0; i < 40; i++) pull.update(DT, hang(), view);
    for (let i = 1; i <= 54; i++) { m.t = i / 54; pull.update(DT, { ...hang(), move: m }, view); }
    assert.equal(pull.out.grips.length, 0, `${deg}: over the top, gone`);
    for (let i = 0; i < 10; i++) assert.equal(pull.update(DT, null, view).grips.length, 0, `${deg}: and off the wall, still gone`);
  }
  assert.ok(-48 > -HANDS.DOWN_FROM_DEG, 'the look down short of the steep exit');
  // steeply down: out of the view
  assert.equal(settle(hang(), { yaw: 0, pitch: -80 * DEG }).grips.length, 0);
});

test('CLIMB-HANDS II the single arm out is the side looked to, and the screen\'s alone - looked right the right arm (the painting mirrored) up from the right edge reaching in across the view, looked left the left arm as painted from the left edge; the turn and the pitch never move it', () => {
  // the painting is a LEFT arm: its sleeve comes in along the bottom's left, its open hand is up at the right
  const art = png('public/art/climb-reach.png');
  assert.deepEqual([art.w, art.h], [REACH_ART.w, REACH_ART.h]);
  const rows = Array.from({ length: art.h }, (_, y) => art.opaque(y));
  const top = rows.findIndex((r) => r.length), bottom = art.h - 1 - [...rows].reverse().findIndex((r) => r.length);
  assert.ok(rows[bottom].every((x) => x < art.w / 2), 'the sleeve enters at the bottom-left');
  assert.ok(rows[top].every((x) => x > art.w / 2), 'the hand is up at the right');
  const right = settle(hang(), { yaw: 85 * DEG, pitch: 0 }), left = settle(hang(), { yaw: -85 * DEG, pitch: 0 });
  assert.deepEqual([right.reach.side, right.reach.flip], ['R', true], 'looked right: the right arm - the left one mirrored (Mac: "inverted for both directions")');
  assert.deepEqual([left.reach.side, left.reach.flip], ['L', false], 'looked left: the left arm, as painted');
  const slack = HANDS.REACH_X_IN + HANDS.SEARCH_X + 1e-9;
  assert.ok(NATIVE_W - (right.reach.x + right.reach.w) <= slack && NATIVE_W - (right.reach.x + right.reach.w) >= HANDS.REACH_X_IN - HANDS.SEARCH_X - 1e-9, 'at the right edge');
  assert.ok(left.reach.x <= slack && left.reach.x >= HANDS.REACH_X_IN - HANDS.SEARCH_X - 1e-9, 'at the left edge');
  // as drawn, each arm's sleeve comes up from its own side and its hand is out toward the middle
  const sleeveX = (b) => { const xs = rows[bottom].map((x) => (b.flip ? 1 - (x + 0.5) / art.w : (x + 0.5) / art.w)); return b.x + b.w * (xs.reduce((s, v) => s + v, 0) / xs.length); };
  const handX = (b) => { const xs = rows[top].map((x) => (b.flip ? 1 - (x + 0.5) / art.w : (x + 0.5) / art.w)); return b.x + b.w * (xs.reduce((s, v) => s + v, 0) / xs.length); };
  assert.ok(sleeveX(right.reach) > NATIVE_W * 0.75 && handX(right.reach) < sleeveX(right.reach) - 80, `looked right: the sleeve at the right (${sleeveX(right.reach).toFixed(0)}), the hand in toward the middle (${handX(right.reach).toFixed(0)})`);
  assert.ok(sleeveX(left.reach) < NATIVE_W * 0.25 && handX(left.reach) > sleeveX(left.reach) + 80, `looked left: the sleeve at the left (${sleeveX(left.reach).toFixed(0)}), the hand in (${handX(left.reach).toFixed(0)})`);
  // the screen's: turned on from 80 to 120 degrees, or the eye up and down, the same box frame for frame
  const views = [{ yaw: 80 * DEG, pitch: 0 }, { yaw: 120 * DEG, pitch: 0 }, { yaw: 95 * DEG, pitch: 25 * DEG }, { yaw: 95 * DEG, pitch: -25 * DEG }];
  const laws = views.map(() => new ClimbHands());
  for (let i = 0; i < 90; i++) laws.forEach((l, k) => l.update(DT, hang(), views[k]));
  for (const l of laws.slice(1)) assert.deepEqual(l.out.reach, laws[0].out.reach, 'the arm out never moves with the view');
});

test('CLIMB-HANDS II looked away, the hand on the arm\'s side lets go of the stone as its arm comes up - in the same measure - and the other holds on: the view back on the wall finds it there at once', () => {
  // at 60 degrees the right hand's stone is still in the view - and the hand is not on it: it is the arm
  const at60 = settle(hang(), { yaw: 60 * DEG, pitch: 0 });
  const stone = seen(NATIVE_W / 2 + HANDS.GRIP_APART, GRIP_Y, DESIGN_LENS, 0, 60 * DEG, 0);
  assert.ok(stone.z > 0 && stone.x > 0 && stone.x < NATIVE_W, `its stone in the view (${stone.x.toFixed(1)})`);
  assert.equal(side(at60, 'R'), null, 'the right hand let go');
  assert.equal(at60.reach?.side, 'R', 'it is the arm out');
  // Mac's "Only use the angled arm" still holds with the fists on the wall: the far hand's stone has carried its box out
  // of the view before the look reaches LOOK_FROM_DEG, on every field of view the setting allows and every screen
  for (const fovDeg of [60, 65, 90, 120]) {
    for (const [w, h] of [[1024, 768], [1920, 1080], [3440, 1440], [5120, 1440]]) {
      const lens = climbLens({ width: w, height: h }, { fov: fovDeg * DEG });
      for (const sgn of [1, -1]) {
        const out = settle(hang(), { yaw: sgn * HANDS.LOOK_FROM_DEG * DEG, pitch: 0, lens });
        assert.equal(side(out, sgn > 0 ? 'L' : 'R'), null, `${fovDeg} degrees on ${w}x${h}, looked ${sgn > 0 ? 'right' : 'left'}: the far hand out of the view`);
        assert.ok(side(out, sgn > 0 ? 'R' : 'L'), '...the near one still on its stone');
      }
    }
  }
  // frame by frame through the turn, the hand off the stone exactly as far as its arm is up
  const law = new ClimbHands();
  for (let i = 0; i < 60; i++) law.update(DT, hang(), { yaw: 0, pitch: 0 });
  let rising = 0;
  for (let i = 0; i < 60; i++) {
    law.update(DT, hang(), { yaw: Math.min(85, i * 3) * DEG, pitch: 0 });
    assert.equal(law.letGo.R, law.arm, `frame ${i}: the hand goes as the arm comes`);
    if (law.arm > 0 && law.arm < 1) rising++;
  }
  assert.ok(rising > 5 && law.letGo.L === 0, 'through the rise, and the left never let go');
  // the view snapped back onto the wall: the left hand on its stone that very frame, the right still coming back
  const snap = new ClimbHands();
  for (let i = 0; i < 90; i++) snap.update(DT, hang(), { yaw: 60 * DEG, pitch: 0 });
  const back = snap.update(DT, hang(), { yaw: 0, pitch: 0 });
  assert.ok(side(back, 'L') && Math.abs(side(back, 'L').y - REST_TOP) < HANDS.SWAY_Y + 1e-6, 'the left was on the wall all along');
  assert.ok(!side(back, 'R') || side(back, 'R').y > REST_TOP + 30, 'the right is coming back onto it');
});

test('CLIMB-HANDS II the lens is the frame\'s: the strip the world was drawn into, brought back through the hands\' own scale and lift - the whole canvas, a docked bar\'s strip, the retro pillarbox, a projection\'s own aspect', () => {
  const fov = 65 * DEG, t = Math.tan(fov / 2);
  const close = (a, b) => Object.keys(b).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
  assert.ok(close(climbLens({ width: 1280, height: 720 }, { fov }), { tanX: t * 1280 / 720, tanY: t, cx: 160, cy: 100, hx: 160, hy: 100 }), 'the whole canvas');
  // the docked large HUD: the world in the top 90 per cent, the hands lifted by the bar - a design point at the lens's
  // centre, drawn where the draw puts it (x * sx, y * sy - offsetHeight), is the strip's centre
  const docked = climbLens({ width: 1280, height: 720 }, { fov, viewport: { x: 0, y: 0.1, w: 1, h: 0.9 }, offsetHeight: 72 });
  assert.ok(Math.abs(docked.cx * 4 - 640) < 1e-9 && Math.abs(docked.cy * 3.6 - 72 - 324) < 1e-9, 'its centre the strip\'s');
  assert.ok(Math.abs(docked.hy * 3.6 - 324) < 1e-9 && Math.abs(docked.tanX - t * 1280 / 648) < 1e-12, 'its height and its aspect the strip\'s');
  // the retro pillarbox: the 2D layer on a canvas of the pillarbox's size, at its place on the real one
  const ui = { width: 960, height: 720, clientWidth: 1280, clientHeight: 720, uiRect: { x: 160, y: 0, w: 960, h: 720 }, canvas: { width: 1280, height: 720 } };
  assert.ok(close(climbLens(ui, { fov, viewport: { x: 0.125, y: 0, w: 0.75, h: 1 } }), { tanX: t * 960 / 720, tanY: t, cx: 160, cy: 100, hx: 160, hy: 100 }), 'the pillarbox');
  // a retro world projected at its texture's shape: the projection's aspect over the strip's (muzzleRay's law)
  assert.ok(Math.abs(climbLens({ width: 1280, height: 720 }, { fov, aspect: 1.25 }).tanX - t * 1.25) < 1e-12);
  for (const bad of [null, { width: 0, height: 720 }]) assert.equal(climbLens(bad, { fov }), null);
  assert.equal(climbLens({ width: 1280, height: 720 }, { fov: 0 }), null);
});

test('CLIMB-HANDS II through the rig: the law is handed the frame\'s look and its world lens - the setting\'s field of view on this canvas, the bar the hands stand on - so a fist stands where the eye sees its stone', () => {
  resetToDefaults(); _resetModSettings();
  const canvas = { width: 1024, height: 768, clientWidth: 1024, clientHeight: 768 };   // 4:3 - a lens the design surface's 16:10 is not
  const yaw = 0.25;
  const r = createWeaponRig({
    renderer: { uploadTexture: () => ({}), drawScreenQuad: () => {} }, canvas, entity: { items: [], stats: { speed: 50 } },
    audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) }, fetchBytes: async () => new Uint8Array(0),
    camera: () => ({ pos: [0, 1.7, 0], yaw, pitch: 0, climbing: true, move: { grounded: false }, climb: climb() }),
  });
  for (let i = 0; i < 90; i++) r.frame(DT);
  const R = side(r.climbHands.law.out, 'R');
  assert.ok(R, 'the hands are up on the classic lane');
  const lens = climbLens(canvas, { fov: fieldOfView(), offsetHeight: weaponOffsetHeight() });
  const want = seen(NATIVE_W / 2 + HANDS.GRIP_APART, GRIP_Y, lens, 0, yaw, 0);
  assert.ok(Math.abs(R.x + R.w / 2 - want.x) < 1e-6, `on its stone through the frame's lens (${(R.x + R.w / 2).toFixed(3)} against ${want.x.toFixed(3)})`);
  const flat = seen(NATIVE_W / 2 + HANDS.GRIP_APART, GRIP_Y, DESIGN_LENS, 0, yaw, 0);
  assert.ok(Math.abs(flat.x - want.x) > 4, `a lens this canvas tells apart from the design surface's (${Math.abs(flat.x - want.x).toFixed(2)} px)`);
  resetToDefaults();
});

test('CLIMB-HANDS II the Morrowind arms climb sheathed: drawn while their pose is on the stone (the gate was the weapon\'s - climbing sheathed drew no arm at all), not off the wall, not paralysed, and the weapon\'s sway off them while they climb', async () => {
  resetToDefaults(); _resetModSettings();   // the Weapon Widget on, as it ships
  const { fpArm } = await import('../../src/combat/fpArm.js');
  const saved = { active: fpArm.active, thirdActive: fpArm.thirdActive, climbPosed: fpArm.climbPosed, draw: fpArm.draw, setScreenTransform: fpArm.setScreenTransform, screenTransform: fpArm.screenTransform };
  let posed = false, drew = 0, transform = 'never set';
  Object.assign(fpArm, {
    active: () => true, thirdActive: () => false, climbPosed: () => posed, draw: () => { drew++; return true; },
    setScreenTransform: (fn) => { transform = fn; }, screenTransform: () => (typeof transform === 'function' ? transform : null),
  });
  try {
    const r = createWeaponRig({ renderer: {}, canvas: { width: 1000, height: 800, clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); }, palette: null, audio: { playOneShot() {} }, entity: { items: [], stats: { speed: 50 }, activeEffects: [] } });
    assert.equal(r.playerWeapon.sheathed, true, 'sheathed, as a climber walks about');
    r.draw();
    assert.equal(drew, 0, 'off the wall and sheathed: no arm, as before');
    posed = true;
    r.draw();
    assert.equal(drew, 1, 'on the stone: the arm, its hands on it');
    assert.equal(transform, null, 'the Weapon Widget\'s channels off the hands on the stone');
    r.draw({ paralyzed: true });
    assert.equal(drew, 1, 'paralysis still takes everything');
    // drawn, off the wall, the widget moves the arms as it always has; on the wall, not
    posed = false;
    r.toggleSheath();
    r.draw();
    assert.equal(drew, 2);
    assert.equal(typeof transform, 'function', 'the widget\'s Bob and Inertia on the weapon\'s arms');
    posed = true;
    r.draw();
    assert.equal(drew, 3);
    assert.equal(transform, null, 'and off them again on the stone');
  } finally {
    Object.assign(fpArm, saved);
    resetToDefaults(); _resetModSettings();
  }
  // the gate's sixth exception, beside the five, and the lowering reads the same answer
  const rig = rd('src/combat/weapon/weaponRig.js');
  // PIN MOVED (TWO-HANDS): the running hands' two exceptions are named between them and join the gate after it (was: the
  // gate on the next line, ending at `!armsClimb`)
  assert.match(rig, /const armsClimb = fpArm\.active\(\) && !!fpArm\.climbPosed\?\.\(\);\n(?:\s+\/\/[^\n]*\n)*\s+const runHands = [^\n]*\n\s+const armsRun = [^\n]*\n\s+if \(paralyzed \|\| \(!shown\(\) && !torchOnly && !sheetOnly && !shieldRect && !gunSliding && !armCasts && !armsClimb && !runHands && !armsRun\)\) return;/);
  assert.match(rig, /if \(_climbLower > 0 && !armsClimb\) \{/);
  assert.match(rd('src/combat/fpArm.js'), /climbPosed\(\) \{ return climbHands && viewMode === 'first' && !held; \},/, 'the arm says it is posed on the climb: first person, the hands on the stone, no sheet');
});
