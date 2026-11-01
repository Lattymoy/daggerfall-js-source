// AUDIT FB1031 III W1 (bible/01-Overview/audits/Audit-FB1031.md, lane III): a band that catches the traveller stands
// outside the view as the EYE sees it. In third person the eye stands behind the feet (mwCamera.js: 2.7 m, 11.4 m
// zoomed out), and from there a member at the feet's edge stood in view: at 21:9 zoomed out 96% of bands.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bands from '../../src/systems/travel/travelBands.js';
import { campAnchorSpot, PACK_SPACING, PACK_ALERT_RADIUS } from '../../src/systems/campEncounters.js';
import { hostText } from '../hostText.mjs';

const deg = Math.PI / 180;
const halfOf = (vfov, aspect) => Math.atan(Math.tan((vfov / 2) * deg) * aspect) / deg;

test('AUDIT FB1031 III W1 the law: the edge turned out by the eye\'s distance behind the feet - by the law of sines, so the nearest member clears the view from the eye; none behind, the K6 edge (mutants: the eye unread; the turn unscaled)', () => {
  const bsb = bands.bandStandBearing, near = bands.BAND_STAND_M - PACK_SPACING, r = near - PACK_SPACING;
  const base = bsb(0.7, 0.7, 60, false, 21 / 9, near, PACK_SPACING).bearingDegrees;
  assert.equal(bsb(0.7, 0.7, 60, false, 21 / 9, near, PACK_SPACING, 0).bearingDegrees, base, 'no eye behind: the K6 edge');
  const back = 11.43, got = bsb(0.7, 0.7, 60, false, 21 / 9, near, PACK_SPACING, back).bearingDegrees;
  assert.ok(Math.abs(got - (base + Math.asin(back * Math.sin(base * deg) / r) / deg)) < 1e-9, `the turn (${base.toFixed(1)} -> ${got.toFixed(1)})`);
  // from the eye, a member r off the feet at the feet's bearing `got` stands at the base edge exactly
  const mx = r * Math.sin(got * deg), mz = r * Math.cos(got * deg) + back;
  assert.ok(Math.abs(Math.atan2(mx, mz) / deg - base) < 1e-9, 'the nearest member at the edge, seen from the eye');
});

test('AUDIT FB1031 III W1 the host: bandStand, lifted, over the real anchor law - the eye 11.4 m behind the feet (the renderer\'s), at 21:9 and 32:9, stands no member in the view the eye has (mutants: the eye unasked)', () => {
  const w = hostText('src/scenes/world.js');
  const m = /\n {2}function bandStand\([^)]*\) \{\n[\s\S]*?\n {2}\}\n/.exec(w);
  assert.ok(m, 'bandStand lifted');
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const [name, cw, ch, FOV, back] of [['21:9', 21, 9, 60, 11.43], ['32:9', 32, 9, 60, 11.43], ['16:9', 16, 9, 60, 2.74]]) {
    const camYaw = 0.7, half = halfOf(FOV, cw / ch), anchors = [];
    const eye = [-Math.sin(camYaw) * back, 0, -Math.cos(camYaw) * back];
    const scope = {
      bandRoom: () => true, player: { feetAt: () => [0, 0, 0] }, BAND_STAND_MIN_M: bands.BAND_STAND_MIN_M, PACK_SPACING, PACK_ALERT_RADIUS,
      wildFoes: { alert() {} }, exteriorFoes: { noticedPlayer() {} }, performance: { now: () => 0 }, bandStandBearing: bands.bandStandBearing,
      cam: { yaw: camYaw }, fieldOfView: () => FOV * deg, travelView: { active: false }, renderer: { _camPos: eye },
      largeHudWorldAspect: (cwi, chi) => cwi / chi, canvas: { clientWidth: cw, clientHeight: ch },
      _standCampEncounter: (hit, feet) => {
        anchors.push(campAnchorSpot({ feet, yawRad: hit.yawRad ?? camYaw, fovDegrees: FOV, groundAt: () => 0, minDistance: hit.minDistance, maxDistance: hit.maxDistance, bearingDegrees: hit.bearingDegrees, rolls: rnd }));
        return { foes: Promise.resolve([]) };
      },
    };
    const stand = new Function('s', `const { ${Object.keys(scope).join(', ')} } = s; ${m[0]} return bandStand;`)(scope);
    const offFromEye = (x, z) => Math.abs((((Math.atan2(x - eye[0], z - eye[2]) - camYaw) / deg % 360) + 540) % 360 - 180);
    let inView = 0;
    for (let i = 0; i < 400; i++) {
      stand({ mobileTypes: [1, 2] }, camYaw + (rnd() - 0.5) * 2 * half * deg, bands.BAND_STAND_M);
      const a = anchors[anchors.length - 1];
      for (let k = 0; k < 4; k++) { const t = rnd() * 2 * Math.PI, r = 1 + rnd() * (PACK_SPACING - 1); if (offFromEye(a.x + Math.sin(t) * r, a.z + Math.cos(t) * r) < half) inView++; }
    }
    assert.equal(inView, 0, `${name}, the eye ${back} m back: no member in the eye's ${half.toFixed(1)} degrees`);
  }
});
