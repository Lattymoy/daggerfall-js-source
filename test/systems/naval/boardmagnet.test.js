// BOARD-MAGNET (2026-10-26, the owner: "I want to remove the ship ramming feature as its broken and instead with a ship
// is damaged enough, a prompt to board should show within range and properly magnitize to the other ship";
// bible/03-World/Naval-Refit.md BOARD-MAGNET) - THE RAM IS GONE, AND THE GRAPPLES DRAW HER IN, on the real naval host over
// Come Sail Away's real pool (test/navalSea.mjs): no stem rams - mine, a galley's - and none fouls a ship; a ship struck
// within the grapples' reach is "E: board" at any way, never a heave-to first; the grapples' haul draws her to the ship
// as it lies each frame while my way comes off under haulBrake, so she ends side by side where I came to rest - her hull
// clear of mine, her middle level with mine; a captain's Long Lines and Grappling Irons reach farther; a sound ship being
// boarded (a repel) is said afloat, her mode 'boarded'; an older build's ram blow is a blow alone. AUDIT BOARD-MAGNET
// (2026-10-26, the owner: "Audit this"): the haul drawn out to her lane and along it, kept clear of my hull from every
// start in reach (the eased line drove a galley 39.7 m into another); her side and heading kept against a turning helm;
// the helm held under a haul thrown from rest.
// tools/mutants/boardmagnet.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HULL, hullBuild } from '../../../src/systems/naval/navalShips.js';
import { SHIP_STATES, STRUCK_AT } from '../../../src/systems/naval/navalDamage.js';
import {
  BOARD_RANGE, BERTH_GAP, GRAPPLE_S, HULL_CLEAR, HAUL_SPEED, HAUL_TURN, HAUL_MAX_S, berthHull, berthPose, haulBrake, drawHaul, boardableState, createBoarding,
} from '../../../src/systems/naval/navalBoarding.js';
import { wrapAngle } from '../../../src/world/mat4.js';
import { hullGap } from '../../../src/systems/naval/navalAI.js';
import { starStats } from '../../../src/systems/naval/captainTree.js';
import { CSA_BRAKE_MAX } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { navalHudText, navalPadPrompts } from '../../../src/ui/naval/navalHud.js';
import { validNavalRecord, navalHitData, validNavalHit } from '../../../src/systems/naval/navalWire.js';
import { sea, freshPool } from '../../navalSea.mjs';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);

async function helm(o = {}) {
  const h = await sea({ hull: o.hull ?? HULL.SmallShip, ...o, settings: { ShipsAtSea: 'off', Boarders: false, ...(o.settings ?? {}) } });
  const e = h.host._sea.get(h.host.spawnShip(o.ship ?? 'merchantGalleon', { range: 900 }));
  return { ...h, e };
}
/** Frames with each ship held where the test put her (navaudit_helm.test.js's). */
function frames(h, held, n = 1) {
  for (let i = 0; i < n; i++) {
    for (const [e, p] of held) { e.ship.pos = [...p.pos]; e.ship.yaw = p.yaw ?? 0; e.ship.speed = p.speed ?? 0; e.ship.yawRate = 0; }
    h.host.frame(0.1);
  }
}
/** Her side `gap` (m of water past the two beams, as the helm's reach reckons it) off my starboard beam, heading as I do. */
const abeam = (h, gap) => ({ pos: [hullBuild(h.boat.hull).beam + hullBuild(h.e.ship.hull).beam + gap, 0, 0], yaw: 0 });
/** Her colours struck where she lies. */
function strike(h, at) {
  frames(h, [[h.e, at]], 2);
  h.e.ship.damage.apply({ hull: Math.ceil(h.e.ship.damage.maxHull * (1 - STRUCK_AT)) + 1, sail: 0, crew: 0 }, 0);
  assert.equal(h.e.ship.damage.state, SHIP_STATES.struck);
}
const myPose = (h) => ({ pos: [...h.boat.GameObject.position], yaw: Math.atan2(2 * (h.boat.GameObject.rotation[1] * h.boat.GameObject.rotation[3]), 1 - 2 * h.boat.GameObject.rotation[1] ** 2) });
/** Where her middle lies along my keel from my middle (m) - 0 when the two lie level. */
function alongOf(mine, her, myHull, herHull) {
  const f = [Math.sin(mine.yaw), Math.cos(mine.yaw)];
  const mid = (pose, hull) => { const b = hullBuild(hull), m = (b.bowZ + b.aftZ) / 2, g = [Math.sin(pose.yaw), Math.cos(pose.yaw)]; return [pose.pos[0] + g[0] * m, pose.pos[2] + g[1] * m]; };
  const a = mid(mine, myHull), b = mid(her, herHull);
  return (b[0] - a[0]) * f[0] + (b[1] - a[1]) * f[1];
}

test('BOARD-MAGNET the law: only a ship whose colours are struck takes the grapples - never a sound one, one boarded already, a prize or a wreck going down; a berth lies the two hulls side by side, the half beams and BERTH_GAP apart and never nearer than HULL_CLEAR at their widest (a Large Galley\'s planking swells 2.4 m past her deck), middle to middle, on either heading; the haul brake takes a way off over GRAPPLE_S, never past the runtime\'s bound; a side and a heading kept (`lie`); and the haul draws her to the berth as it lies NOW, laid in it by GRAPPLE_S on open water (mutants: a sound ship boardable, the clearance dropped, the middles dropped, the brake halved, the haul blind to the berth moving, the lie unkept, the haul unbounded in time)', () => {
  const ship = (state, boarded = false) => ({ boarded, damage: { state } });
  assert.equal(boardableState(ship('struck')), true);
  for (const st of ['afloat', 'prize', 'sinking', 'sunk', 'wrecked']) assert.equal(boardableState(ship(st)), false, st);
  assert.equal(boardableState(ship('struck', true)), false, 'boarded already');
  assert.equal(boardableState(null), false);
  // the berth, over the hulls' own builds
  const g = hullBuild(HULL.LargeGalley), c = hullBuild(HULL.Carrack), s = hullBuild(HULL.SmallShip);
  assert.deepEqual(berthHull([1, 2, 3], 0.5, HULL.SmallShip), { pos: [1, 2, 3], yaw: 0.5, beam: s.beam, halfWidth: s.halfWidth, midZ: (s.bowZ + s.aftZ) / 2 });
  const small = berthPose(berthHull([0, 0, 0], 0, HULL.SmallShip), berthHull([30, 0, 5], 0.2, HULL.SmallShip));
  near(small.pos[0], 2 * s.beam + BERTH_GAP, 1e-9, 'two Small Ships: the beams and BERTH_GAP');
  assert.ok(hullGap(small.pos, small.yaw, HULL.SmallShip, [0, 0, 0], 0, HULL.SmallShip) > HULL_CLEAR);
  const wide = berthPose(berthHull([0, 0, 0], 0, HULL.LargeGalley), berthHull([40, 0, 0], 0.1, HULL.Carrack));
  near(wide.pos[0], g.halfWidth + c.halfWidth + HULL_CLEAR, 1e-9, 'a galley and a Carrack: by their widest');
  assert.ok(g.beam + c.beam + BERTH_GAP < g.halfWidth + c.halfWidth, 'by the beams alone the two hulls stood in each other');
  near(hullGap(wide.pos, wide.yaw, HULL.Carrack, [0, 0, 0], 0, HULL.LargeGalley), HULL_CLEAR, 1e-9, 'HULL_CLEAR of water between them');
  for (const yaw of [0.1, Math.PI - 0.1]) {
    const b = berthPose(berthHull([5, 0, -7], 0, HULL.LargeGalley), berthHull([-40, 0, 0], yaw, HULL.Carrack));
    near(alongOf({ pos: [5, 0, -7], yaw: 0 }, b, HULL.LargeGalley, HULL.Carrack), 0, 1e-9, `middle to middle, her heading ${yaw.toFixed(1)}`);
  }
  // the haul brake
  near(haulBrake(6) * GRAPPLE_S, 6, 1e-12);
  assert.equal(haulBrake(1e3, CSA_BRAKE_MAX), CSA_BRAKE_MAX);
  assert.equal(haulBrake(0), 0);
  // a side and a heading kept: her lie against an anchor turned past 90 degrees off her
  const her = berthHull([-30, 0, 4], 1.4, HULL.SmallShip), lie = { side: 1, same: true };
  const kept = berthPose(berthHull([0, 0, 0], -0.4, HULL.SmallShip), her, lie);
  assert.deepEqual([kept.side, kept.same], [1, true]);
  near(wrapAngle(kept.yaw - -0.4), 0, 1e-12, 'its own heading, not the reciprocal she lies nearer now');
  assert.deepEqual([berthPose(berthHull([0, 0, 0], -0.4, HULL.SmallShip), her).side, berthPose(berthHull([0, 0, 0], -0.4, HULL.SmallShip), her).same], [-1, false], 'chosen afresh, both flip');
  // the haul toward a berth that moves, the hull it is hauled to far off: laid in it by GRAPPLE_S
  const far = { pos: [0, 0, -5000], yaw: 0, hull: HULL.SmallShip };
  const b = createBoarding({ kind: 'board', shipId: 'x', from: { pos: [40, 0, 0], yaw: 1 }, to: { pos: [10, 0, 0], yaw: 0 }, hull: HULL.SmallShip });
  for (let i = 0; i < 11; i++) {
    const to = { pos: [10, 0, 0.6 * i], yaw: 0.02 * i };
    b.haul(to, far, 0.2); b.step(0.2);
    assert.deepEqual(b.to, to, 'kept as the haul\'s');
  }
  near(b.at.pos[0], 10, 1e-6, 'in the berth as it lies at the haul\'s end'); near(b.at.pos[2], 6, 1e-6);
  near(b.at.yaw, 0.2, 1e-9);
  assert.equal(b.phase, 'fight', 'over her rail on time');
  // a berth past what HAUL_SPEED reaches in HAUL_MAX_S: laid in it then, whatever held her
  const long = createBoarding({ kind: 'board', shipId: 'y', from: { pos: [1000, 0, 0], yaw: 0 }, to: { pos: [10, 0, 0], yaw: 0 }, hull: HULL.SmallShip });
  while (long.phase === 'grapple') { long.haul(long.to, far, 0.1); long.step(0.1); }
  near(long.t, HAUL_MAX_S, 0.1 + 1e-9, 'at HAUL_MAX_S');
  assert.deepEqual(long.at.pos, [10, 0, 0], 'in her berth');
});

test('BOARD-MAGNET AUDIT THE HAUL KEPT CLEAR: from every start in reach of every pair of hulls - any side, any heading, ahead, abeam and astern - the drawn haul never brings her within HULL_CLEAR of the hull she is hauled to, never moves her faster than HAUL_SPEED and the push that keeps her clear, and lays her in her berth within HAUL_MAX_S - most by GRAPPLE_S (the eased straight line it replaced drove a galley 39.7 m into another from across her stern) (mutants: the straight line back, the lane dropped, the push dropped, the push at the bare hull)', () => {
  const pairs = [[HULL.SmallShip, HULL.SmallShip], [HULL.LargeGalley, HULL.Carrack], [HULL.Carrack, HULL.LargeGalley], [HULL.LargeBoat, HULL.SmallShip], [HULL.SmallShip, HULL.LargeBoat], [HULL.LargeGalley, HULL.LargeGalley]];
  const dt = 1 / 30, anchor = (hull) => ({ pos: [0, 0, 0], yaw: 0, hull });
  let starts = 0, onTime = 0, worst = Infinity, fastest = 0, longest = 0;
  for (const [mine, hers] of pairs) {
    const reach = BOARD_RANGE + hullBuild(mine).beam + hullBuild(hers).beam;
    for (let x = -reach; x <= reach; x += 7) for (let z = -reach; z <= reach; z += 7) {
      if (Math.hypot(x, z) > reach) continue;
      for (let yd = 0; yd < 360; yd += 45) {
        const from = { pos: [x, 0, z], yaw: (yd * Math.PI) / 180 };
        if (hullGap(from.pos, from.yaw, hers, [0, 0, 0], 0, mine) < HULL_CLEAR) continue;   // the sea's hulls kept apart
        starts++;
        const to = berthPose(berthHull([0, 0, 0], 0, mine), berthHull(from.pos, from.yaw, hers));
        const b = createBoarding({ kind: 'board', shipId: 'x', from, to, hull: hers });
        let prev = from.pos;
        while (b.phase === 'grapple') {
          const p = b.haul(to, anchor(mine), dt);
          b.step(dt);
          worst = Math.min(worst, hullGap(p.pos, p.yaw, hers, [0, 0, 0], 0, mine));
          fastest = Math.max(fastest, Math.hypot(p.pos[0] - prev[0], p.pos[2] - prev[2]) / dt);
          prev = p.pos;
        }
        longest = Math.max(longest, b.t);
        if (b.t <= GRAPPLE_S + dt + 1e-9) onTime++;
        near(b.at.pos[0], to.pos[0], 1e-3); near(b.at.pos[2], to.pos[2], 1e-3);
      }
    }
  }
  assert.ok(starts > 1500, `${starts} starts`);
  assert.ok(worst >= HULL_CLEAR - 1e-6, `never within HULL_CLEAR of my hull (${worst.toFixed(3)} m)`);
  assert.ok(longest <= HAUL_MAX_S + dt, `in her berth by HAUL_MAX_S (${longest.toFixed(2)} s)`);
  assert.ok(onTime / starts > 0.4, `most by GRAPPLE_S (${(100 * onTime / starts).toFixed(0)}%)`);
  assert.ok(fastest < HAUL_SPEED * 3, `no leap (${fastest.toFixed(1)} m/s at the most, the push with it)`);
});

test('BOARD-MAGNET NO STEM RAMS: my stem driven into a sound ship\'s side at a ram\'s way deals her nothing and takes nothing back, fouls nothing, charges nobody and offers no boarding; a galley\'s stem into my hull at speed does nothing either - the ram is gone from every bow (RAM-BOARD\'s foul with it)', async () => {
  const h = await helm();
  frames(h, [[h.e, { pos: [0, 0, 90], yaw: Math.PI / 2 }]]);
  const full = h.e.ship.damage.hull, mine = h.host.hudModel().ship.hull;
  const touching = { pos: [0, 0, hullBuild(HULL.SmallShip).bowZ + hullBuild(h.e.ship.hull).halfWidth + 0.2], yaw: Math.PI / 2 };
  h.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h, [[h.e, { pos: [0, 0, 40], yaw: Math.PI / 2 }]]);
  h.runtime.state.velocityCurrent = [0, 0, 0.1];
  frames(h, [[h.e, touching]], 5);
  assert.equal(h.e.ship.damage.hull, full, 'her hull whole');
  assert.equal(h.host.hudModel().ship.hull, mine, 'mine whole');
  assert.equal(h.e.ship.fouled, undefined, 'nothing fouled');
  assert.ok(!h.e.charged?.has('fire'), 'no charge of piracy');
  assert.equal(h.host.hudModel().board, null, 'a sound ship is no boarding');
  assert.equal(h.host.activate(), false);
  // a galley at speed, her stem at my stern
  const g = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  const gal = g.host._sea.get(g.host.spawnShip('pirateGalley', { range: 200, bearing: 0 }));
  const b = hullBuild(HULL.LargeGalley);
  gal.ship.pos = [0, 0, -(b.bowZ + 2)]; gal.ship.yaw = 0; gal.ship.speed = 6; gal.ship.course = [0, 5000];
  const h0 = g.host.hudModel().ship.hull;
  g.run(0.5);
  assert.equal(g.host.hudModel().ship.hull, h0, 'my hull whole');
  assert.equal(gal.ship.damage.hullShare(), 1, 'hers whole');
});

test('BOARD-MAGNET THE PROMPT IN REACH, AT ANY WAY: a struck ship within the grapples\' reach of my helm is "E: board" on the plate, her card and the pad - at my way of 6 m/s and of 16, where the helm offered "heave to" and boarded only under BOARD_SPEED; past the reach no prompt; and Activate throws the grapples at that way (mutants: the way gate back)', async () => {
  const h = await helm();
  const at = abeam(h, BOARD_RANGE - 2);
  strike(h, at);
  const name = h.e.ship.names.name;
  for (const v of [6, 16]) {
    h.runtime.state.velocityCurrent = [0, 0, v];
    frames(h, [[h.e, at]]);
    const m = h.host.hudModel();
    assert.deepEqual(m.board, { name, kind: 'board' }, `at ${v} m/s`);
    const words = navalHudText({ ...m, target: { ...m.target, name, state: 'struck' } }, { board: 'E' });
    assert.equal(words.plate.hint, `E: board ${name}`);
    assert.equal(words.card.state, 'Colors struck - E: board');
    assert.deepEqual(navalPadPrompts({ ...m, aiming: false }, { board: 'A' }).at(-1), [['A'], `Board ${name}`]);
    assert.equal(h.host.takesActivate(), true);
  }
  // past the reach
  const far = abeam(h, BOARD_RANGE + 1);
  frames(h, [[h.e, far]]);
  assert.equal(h.host.hudModel().board, null, 'past the grapples\' reach');
  assert.equal(h.host.activate(), false);
  // in reach at 16 m/s: the grapples
  frames(h, [[h.e, at]]);
  assert.equal(h.host.activate(), true);
  assert.equal(h.host.boarding?.phase, 'grapple');
  assert.match(h.log.say.at(-1), /^Grapples away! Hauling .* alongside\.\.\.$/);
});

test('BOARD-MAGNET THE HAUL DRAWS HER TO ME AS I LIE: the grapples thrown at 6 m/s strike my canvas and take my way off under haulBrake (nothing driving her on), and she is hauled to her berth beside my boat as it lies each frame - at the haul\'s end side by side where I came to rest, never where I lay when the lines went over; her hull clear of mine, her middle level with mine; the brake let go with the haul; a Large Galley hauls a Carrack in clear of her swell (mutants: the berth where the lines went over, the brake unset, the sails left set, driven on while hauling, the brake held through the fight)', async () => {
  for (const [hull, ship] of [[HULL.SmallShip, 'merchantGalleon'], [HULL.LargeGalley, 'merchantCarrack']]) {
    const h = await helm({ hull, ship });
    const at = abeam(h, BOARD_RANGE - 4);
    strike(h, at);
    let lowered = 0;
    h.runtime.state.sailPosition = 1;
    h.runtime.LowerSails = () => { lowered++; h.runtime.state.sailPosition = 0; };
    let v = 6;
    h.runtime.state.velocityCurrent = [0, 0, v];
    frames(h, [[h.e, at]]);
    const thrown = berthPose(berthHull(myPose(h).pos, myPose(h).yaw, hull), berthHull(h.e.ship.pos, h.e.ship.yaw, h.e.ship.hull));
    assert.equal(h.host.activate(), true);
    assert.equal(lowered, 1, 'my canvas struck');
    near(h.host.brake(), haulBrake(6, CSA_BRAKE_MAX), 1e-12, 'my way off over the haul');
    assert.deepEqual([h.host.wayScale(true), h.host.wayScale(false)], [0, 0], 'nothing driving her on');
    // Come Sail Away's stand-in: my boat sails on at her way, coming off at the host's brake
    const dt = 0.1;
    for (let t = 0; h.host.boarding?.phase === 'grapple' && t < 10; t += dt) {
      const brake = h.host.brake();
      v = Math.max(0, v - brake * dt);
      h.boat.GameObject.position = [h.boat.GameObject.position[0], 0, h.boat.GameObject.position[2] + v * dt];
      h.runtime.state.velocityCurrent = [0, 0, v];
      h.host.frame(dt);
    }
    assert.equal(h.host.boarding?.phase, 'fight', `${hull}: over her rail`);
    assert.ok(v < 0.2, `${hull}: my way off by the haul's end (${v.toFixed(2)} m/s)`);
    assert.equal(h.host.brake(), 0, 'the brake let go with the haul');
    h.runtime.sailing = true;   // back at my helm through the fight: she answers it
    assert.equal(h.host.brake(), 0, 'no brake past the haul, at the helm');
    assert.ok(h.host.wayScale(false) > 0, 'her oars hers again');
    h.runtime.sailing = false;
    const now = berthPose(berthHull(myPose(h).pos, myPose(h).yaw, hull), berthHull(at.pos, at.yaw, h.e.ship.hull));
    near(h.e.ship.pos[0], now.pos[0], 1e-6, `${hull}: alongside where I lie`);
    near(h.e.ship.pos[2], now.pos[2], 1e-6, `${hull}: alongside where I lie`);
    near(h.e.ship.yaw, now.yaw, 1e-9);
    assert.ok(Math.hypot(now.pos[0] - thrown.pos[0], now.pos[2] - thrown.pos[2]) > 5, `${hull}: never where I lay when the lines went over`);
    assert.ok(hullGap(h.e.ship.pos, h.e.ship.yaw, h.e.ship.hull, myPose(h).pos, myPose(h).yaw, hull) >= HULL_CLEAR - 1e-6, `${hull}: her hull clear of mine`);
    near(alongOf(myPose(h), { pos: h.e.ship.pos, yaw: h.e.ship.yaw }, hull, h.e.ship.hull), 0, 1e-6, `${hull}: middle to middle`);
  }
});

test('BOARD-MAGNET AUDIT A TURNING HELM, A HELM AT REST, A SHIP ACROSS MY BOW: thrown with her lying 85 degrees off my heading while my helm swings 10 degrees a second, her side and heading are the ones she chose when the lines went over - her heading never leaps (chosen afresh each frame it flipped 28 degrees in one) and she lies on my starboard at my own heading; thrown from rest, nothing drives my boat on under the haul (the oars gathered way through it); a struck ship lying across my bow is hauled round it to my side, never through my planking, and over her rail by HAUL_MAX_S (mutants: the lie unkept, the helm held only under a brake)', async () => {
  const h = await helm();
  const at = { pos: [2 * hullBuild(HULL.SmallShip).beam + 10, 0, 0], yaw: (85 * Math.PI) / 180 };
  strike(h, at);
  frames(h, [[h.e, at]]);
  assert.equal(h.host.activate(), true);
  let prev = h.e.ship.yaw, myYaw = 0, worstTurn = 0;
  for (let t = 0; h.host.boarding?.phase === 'grapple' && t < HAUL_MAX_S + 1; t += 0.1) {
    myYaw -= (10 * Math.PI) / 180 * 0.1;
    h.boat.GameObject.rotation = [0, Math.sin(myYaw / 2), 0, Math.cos(myYaw / 2)];
    h.host.frame(0.1);
    worstTurn = Math.max(worstTurn, Math.abs(wrapAngle(h.e.ship.yaw - prev)));
    prev = h.e.ship.yaw;
  }
  assert.equal(h.host.boarding?.phase, 'fight', 'over her rail');
  assert.ok(worstTurn <= HAUL_TURN * 0.1 + 1e-9, `her heading ${((worstTurn * 180) / Math.PI).toFixed(1)} degrees in a frame at the most`);
  near(wrapAngle(h.e.ship.yaw - myYaw), 0, 1e-6, 'at my own heading, as she chose');
  const across = (h.e.ship.pos[0] - h.boat.GameObject.position[0]) * Math.cos(myYaw) - (h.e.ship.pos[2] - h.boat.GameObject.position[2]) * Math.sin(myYaw);
  assert.ok(across > 0, `on my starboard, as she began (${across.toFixed(1)} m)`);
  // thrown from rest
  const r = await helm();
  const lie = abeam(r, 10);
  strike(r, lie);
  r.runtime.state.velocityCurrent = [0, 0, 0];
  frames(r, [[r.e, lie]]);
  assert.equal(r.host.activate(), true);
  assert.equal(r.host.brake(), 0, 'no way to take off');
  assert.deepEqual([r.host.wayScale(true), r.host.wayScale(false)], [0, 0], 'and nothing drives her on while the lines haul');
  // across my bow
  const c = await helm();
  const bow = { pos: [0, 0, hullBuild(HULL.SmallShip).bowZ + hullBuild(c.e.ship.hull).halfWidth + 8], yaw: Math.PI / 2 };
  strike(c, bow);
  frames(c, [[c.e, bow]]);
  assert.equal(c.host.activate(), true, 'in reach across my bow');
  let least = Infinity;
  for (let t = 0; c.host.boarding?.phase === 'grapple' && t < HAUL_MAX_S + 1; t += 0.1) {
    c.host.frame(0.1);
    least = Math.min(least, hullGap(c.e.ship.pos, c.e.ship.yaw, c.e.ship.hull, [0, 0, 0], 0, HULL.SmallShip));
  }
  assert.equal(c.host.boarding?.phase, 'fight', 'over her rail by HAUL_MAX_S');
  assert.ok(least >= HULL_CLEAR - 1e-6, `round my bow, never through it (${least.toFixed(2)} m of water at the least)`);
});

test('BOARD-MAGNET the grapples\' reach is the captain\'s: Long Lines and Grappling Irons (the stars that were the ram\'s and its foul, their ids the save\'s) reach BOARD_RANGE farther by their shares - a struck ship a fifth past BOARD_RANGE is out of reach without them and boarded with them (mutants: the reach unread)', async () => {
  const stars = starStats(['helm', 'c_board1', 'c_ram1', 'c_irons']);
  near(stars.reach, 0.4, 1e-9);
  const h = await helm();
  const at = abeam(h, BOARD_RANGE * 1.2);
  strike(h, at);
  frames(h, [[h.e, at]]);
  assert.equal(h.host.hudModel().board, null, 'no stars: out of reach');
  h.deps.captain = { stats: () => stars };
  frames(h, [[h.e, at]]);
  assert.equal(h.host.hudModel().board?.kind, 'board', 'Long Lines and Grappling Irons: in reach');
});

test('BOARD-MAGNET a sound ship being boarded - a pirate\'s repel, the one way a ship afloat is boarded now - is said afloat on the room\'s word, her captain\'s mode \'boarded\': a reader holds her boarded with her colours flying, never struck, and no grapple of theirs takes her under the fight (RAM-BOARD\'s word, kept for the repel; mutants: the word boarded, the mode unsaid, the reader\'s mode)', async () => {
  const h = await sea({ hull: HULL.SmallShip, save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  const e = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 16, bearing: Math.PI / 2, yaw: 0 }));
  e.ship.pos = [16, 0, 0];
  for (let t = 0; t < 30 && h.host.boarding?.kind !== 'repel'; t += 0.1) h.host.frame(0.1);
  assert.equal(h.host.boarding?.kind, 'repel', 'she grapples me');
  assert.equal(e.ship.damage.state, SHIP_STATES.afloat);
  const raw = h.host.word((p) => p);
  const rec = validNavalRecord(raw);
  assert.equal(rec.ships.find((x) => x.n === e.n)?.state, SHIP_STATES.afloat, 'said afloat: her colours fly');
  assert.equal(rec.captains.get(e.n)?.mode, 'boarded', 'her captain\'s mode says the boarding');
  const reader = await sea({ hull: HULL.SmallShip, online: { id: () => 'b-player', peers: () => [], sendHit: () => true }, pool: await freshPool(), settings: { ShipsAtSea: 'off' } });
  assert.equal(reader.host.applyWord('a-player', raw, (p) => p), true);
  const copy = [...reader.host._sea.values()].find((x) => x.owner === 'a-player' && x.n === e.n);
  assert.deepEqual([copy?.ship.boarded, copy?.ship.damage.state], [true, SHIP_STATES.afloat], 'held boarded, her colours flying');
  assert.equal(boardableState(copy.ship), false, 'no peer grapples her under the fight');
});

test('BOARD-MAGNET online: a blow never says a foul (`u`) - and an older build\'s ram blow that still says one is taken as the blow alone: her hull holed, nothing fouled, and she is no boarding of anyone\'s while her colours fly', async () => {
  assert.equal('u' in navalHitData('b', { n: 3, hull: 40, crew: 1, zone: 'holed' }).nv, false);
  const old = { to: 'local', nv: { n: 0, h: 40, s: 0, c: 1, f: 0, z: 2, u: 20 } };
  assert.deepEqual(validNavalHit(old), { n: 0, hull: 40, sail: 0, crew: 1, fire: false, zone: 'holed', grapple: false, cask: null, answer: false });
  const h = await helm();
  const at = abeam(h, 4);
  frames(h, [[h.e, at]]);
  const full = h.e.ship.damage.hull;
  assert.equal(h.host.applyPeerHit('peer', { ...old, nv: { ...old.nv, n: h.e.n } }), true);
  assert.ok(h.e.ship.damage.hull < full, 'the blow lands');
  assert.equal(h.e.ship.fouled, undefined);
  frames(h, [[h.e, at]]);
  assert.equal(h.host.hudModel().board, null, 'a sound ship: no boarding');
});
