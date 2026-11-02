// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections
// 5, 6.3, 16.6 and 18): THE ARCH AND THE CALL'S LAWS, PURE - where a breach may start and the Wager (net/eliteGates/egStartLaw.js),
// the key's refusals in the page's order and where the arch stands (scenes/eliteGates/egArch.js), its life from the rise to the
// sink, the gate's pass widened to per-draw values with the gate's own draw what it was (render/gate/gatePass.js), the clear
// sweep over a set of keys (world/gate/gateClearance.js), the hub's signature on the call (net/eliteGates/egCallSig.js), the opener's
// landing (world/gate/gateArena.js gateLandingFor, an arch record), the Timers row, the sight line, the arch's skin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egStartsFrom, egMayStart, egWagerOf, egWagerTakes, EG_WAGER_MAX, EG_WAGER_FAMILY_OF } from '../../../src/net/eliteGates/egStartLaw.js';
import { EG_DECREES, EG_TEXT, egStartHall, egFirstHallOf, EG_SEALED_MS, EG_ADMIT_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { orderValid, mintEgOrder, verifyOrder, EG_ORDER_WAGER_MAX, EG_ORDER_FIELDS } from '../../../src/net/identityToken.js';
import { egKeyRefusal, egArchPlace, egArchSite, egArchSceneAt, egArchLife, egArchPlacement, egArchDraw, egArchModel, egArchLandingFor, validEgArchWord,
  EG_ARCH_SCALE, EG_ARCH_HEIGHT, EG_ARCH_HALF_W, EG_ARCH_CLEAR_M, EG_ARCH_BEACON, EG_ARCH_BEACON_UP_M, EG_ARCH_TINT, EG_ARCH_GOLD, EG_ARCH_LANDING_M } from '../../../src/scenes/eliteGates/egArch.js';
import { PORTAL_AHEAD } from '../../../src/systems/portalStone.js';
import { GATE_RISE_MS, GATE_COLLAPSE_MS } from '../../../src/net/gate/gateLaw.js';
import { GatePassRenderer, gatePassValues, GATE_PASS_GATE, GATE_PASS_MAX, BEACON_COLOR, BEACON_BELOW_M, BEACON_HEIGHT_M, BEACON_START_M,
  MEMBRANE_VS, MEMBRANE_FS, BEACON_VS, BEACON_FS, MEMBRANE_DRAW_VS, MEMBRANE_DRAW_FS, BEACON_DRAW_VS, BEACON_DRAW_FS,
  MEMBRANE_SCALE_DECL, MEMBRANE_TINT_DECL, MEMBRANE_TINT_LINE, BEACON_COLUMN_DECL, BEACON_FOOT_DECL } from '../../../src/render/gate/gatePass.js';
import { gateArchProfile, buildGateModel, GATE_HEIGHT, GATE_HALF_W, GATE_ARCHIVE, GATE_STONE_RECORD, GATE_SPINE_RECORD, GATE_RIM_RECORD, GATE_PLINTH_RECORD,
  EG_ARCH_STONE_RECORD, EG_ARCH_SPINE_RECORD, EG_ARCH_RIM_RECORD, EG_ARCH_RECORD_OF } from '../../../src/world/gate/gateModel.js';
import { archArt, ARCH_GOLD, ARCH_CRACK, ARCH_INLAY_TEXELS } from '../../../src/world/gate/gateArt.js';
import { gateClearFor, gateClearSet, boxNearGate, createGateClearSweep, EG_ARCH_ROCK_M, GATE_CLEAR_M } from '../../../src/world/gate/gateClearance.js';
import { signEgCall, verifyEgCall, egCallBytes, EG_CALL_SIG_V } from '../../../src/net/eliteGates/egCallSig.js';
import { gateLandingFor, GATE_LANDING_M } from '../../../src/world/gate/gateArena.js';
import { gateYaw } from '../../../src/net/gate/gateLaw.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { sightLineOf, dungeonSightLine } from '../../../src/world/spawnedDungeons.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const SITE = { px: 300, py: 200, x: 409.6, y: 12, z: 380.25, yaw: 1.5 };

test('EG-F WHERE A BREACH MAY START AND THE WAGER: Hall 1 always; the Redoubts taken this season deepest first, else floor(best/2); a Wager is up to three decrees of three families, its families the hall law\'s own (held equal); the open\'s order carries it (`ewg`) and no other order may (mutants: the season ignored for the half best; Hall 1 dropped; a second decree of a family taken; the fourth taken; the Wager on a Rehearsal)', async () => {
  assert.deepEqual(egStartsFrom([], 0), [0], 'nothing taken: Hall 1 alone');
  assert.deepEqual(egStartsFrom([3, 7, 3], 25), [7, 3, 0], 'this season\'s, deepest first, once each - the best waits on them');
  assert.deepEqual(egStartsFrom([], 25), [12, 0], 'none this season: half the best (floor)');
  assert.deepEqual(egStartsFrom([], 1), [0], 'half of one is none');
  assert.deepEqual(egStartsFrom([0, -1, 2.5, 1000], 4), [2, 0], 'nothing out of the law is a start');
  assert.equal(egMayStart([7, 3, 0], 0), true);
  assert.equal(egMayStart([7, 3, 0], 7), true);
  assert.equal(egMayStart([7, 3, 0], 5), false, 'no carries: a start not taken');
  assert.equal(egMayStart(null, 3), false);
  assert.equal(egMayStart(null, 0), true, 'Hall 1 is everyone\'s');
  assert.deepEqual([...EG_WAGER_FAMILY_OF], EG_DECREES.map((d) => d.fam), 'the families copied by number, held equal to the hall law');
  assert.equal(EG_WAGER_MAX, 3);
  assert.equal(EG_ORDER_WAGER_MAX, EG_WAGER_MAX, 'the order\'s bound is the law\'s (pinned equal)');
  assert.deepEqual(egWagerOf([9, 0, 4]), [0, 4, 9], 'three families (blows, legion, ground), sorted');
  assert.deepEqual(egWagerOf(null), [], 'none is no Wager');
  assert.equal(egWagerOf([0, 1]), null, 'two of the blows');
  assert.equal(egWagerOf([0, 4, 9, 13]), null, 'a fourth');
  assert.equal(egWagerOf([99]), null, 'no such decree');
  assert.equal(egWagerOf([0, 0]), null, 'one decree twice');
  assert.equal(egWagerTakes([0], 1), false);
  assert.equal(egWagerTakes([0], 4), true);
  assert.equal(egWagerTakes([0, 4, 9], 13), false);
  // the order
  assert.ok(EG_ORDER_FIELDS.includes('ewg'));
  const base = { s: 'acct-1234', i: 100, e: 160, eb: '0123456789abcdef', ez: 'z'.repeat(16), ew: 7 };
  assert.ok(orderValid({ o: 'egopen', ...base, ewg: [0, 4, 9] }));
  assert.ok(!orderValid({ o: 'egopen', ...base, ewg: [0, 4, 9, 13] }), 'a fourth');
  assert.ok(!orderValid({ o: 'egopen', ...base, ewg: [4, 4] }), 'one decree twice');
  assert.ok(!orderValid({ o: 'egopen', ...base, ewg: [] }), 'an empty Wager is none, said by leaving it out');
  assert.ok(!orderValid({ o: 'egadmit', ...base, ewg: [0] }), 'an admission carries no Wager');
  assert.ok(!orderValid({ o: 'egopen', ...base, ew: 0, rh: 1, ewg: [0] }), 'a Rehearsal carries none');
  assert.ok(!orderValid({ o: 'remains', s: 'acct-1234', i: 100, e: 160, wr: 'x', wh: 'y', wn: 1, wm: 'z', ewg: [0] }), 'no other kind carries it');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintEgOrder({ o: 'egopen', s: 'acct-1234', eb: '0123456789abcdef', ez: 'z'.repeat(20), ew: 7, ewg: [0, 4] }, kp.privateKey, { subtle, nowS: 1000 });
  const v = await verifyOrder(tok, kp.publicKey, { subtle, nowS: 1000, kind: 'egopen' });
  assert.ok(v.ok);
  assert.deepEqual([v.claims.ew, v.claims.ewg], [7, [0, 4]]);
  const none = await verifyOrder(await mintEgOrder({ o: 'egopen', s: 'acct-1234', eb: '0123456789abcdef', ez: 'z'.repeat(20), ewg: [] }, kp.privateKey, { subtle, nowS: 1000 }), kp.publicKey, { subtle, nowS: 1000, kind: 'egopen' });
  assert.equal(none.claims.ewg, undefined, 'no Wager, no field');
  // a breach that starts at Redoubt w begins the next circle
  assert.equal(egStartHall(0), 1);
  assert.equal(egStartHall(12), egFirstHallOf(13));
  assert.equal(egStartHall(12), 61);
});

test('EG-F THE KEY\'S REFUSALS IN THE PAGE\'S ORDER: cold; open sky; the Portal Stone\'s holds, the water, a boat; a location\'s footprint; another breach near; a breach held; the road shut; no room - each the first that stands, each a line of EG_TEXT (mutants: any two of the eight swapped; a hold\'s own words lost)', () => {
  const all = { online: true, guest: false, exterior: true, hold: 'enemies', water: true, aboard: true, within: 'Daggerfall', nearGate: true, nearArch: true, held: true, opening: true, shut: true, room: false };
  // peel them off in order: each refusal is the answer until it is taken away
  const ladder = [
    [{ online: false }, EG_TEXT.cold],
    [{ guest: true }, EG_TEXT.guest],
    [{ exterior: false }, EG_TEXT.sky],
    [{ hold: 'enemies' }, EG_TEXT.holds.enemies],
    [{ water: true }, EG_TEXT.water],
    [{ aboard: true }, EG_TEXT.aboard],
    [{ within: 'Daggerfall' }, EG_TEXT.within('Daggerfall')],
    [{ nearGate: true }, EG_TEXT.near],
    [{ nearArch: true }, EG_TEXT.near],
    [{ held: true }, EG_TEXT.held],
    [{ opening: true }, EG_TEXT.opening],
    [{ shut: true }, EG_TEXT.shut],
    [{ room: false }, EG_TEXT.room],
  ];
  const f = { ...all, online: false, guest: true, exterior: false };
  for (const [step, line] of ladder) {
    const k = Object.keys(step)[0];
    Object.assign(f, step);
    assert.equal(egKeyRefusal(f), line, `${k} stands first`);
    f[k] = k === 'online' || k === 'exterior' ? true : k === 'room' ? true : k === 'within' || k === 'hold' ? null : false;
  }
  assert.equal(egKeyRefusal(f), null, 'none stands: the key turns');
  assert.equal(egKeyRefusal({ online: true }), null, 'a host with no facts refuses nothing it does not know');
  for (const [k, line] of Object.entries({ busy: 'You cannot turn the key right now.', duel: 'You cannot open a breach in a duel.', siege: 'The wards of this battle hold the key cold.', enemies: 'You cannot open a breach with enemies nearby.', journey: 'You cannot open a breach while you travel.' })) {
    assert.equal(egKeyRefusal({ online: true, hold: k }), line);
  }
  assert.equal(EG_TEXT.within('Daggerfall'), 'You cannot open a breach within Daggerfall.');
  assert.equal(EG_TEXT.room, 'There is no room for it here.');
  assert.equal(EG_TEXT.near, 'Another breach stands near.');
  assert.equal(EG_TEXT.cold, 'The key is cold. Go online to turn it.');
  assert.equal(EG_TEXT.sky, 'The key wants open sky.');
});

test('EG-F THE ARCH STANDS: the gate at 0.62 (10.04 m, 4.79 m a side) at the Portal Stone\'s place ahead of the opener, facing them, EG_ARCH_CLEAR_M clear about its foot and grounded under both feet; its site in its pixel\'s own frame, stood the same in any scene; the opener\'s landing before it (mutants: the arch not turned to the opener; the clearing unasked; a foot over a drop)', () => {
  assert.equal(EG_ARCH_SCALE, 0.62);
  assert.equal(EG_ARCH_HEIGHT.toFixed(2), '10.04');
  assert.equal(EG_ARCH_HALF_W.toFixed(2), '4.79');
  assert.equal(EG_ARCH_HEIGHT, GATE_HEIGHT * 0.62);
  assert.equal(EG_ARCH_HALF_W, GATE_HALF_W * 0.62);
  assert.equal(EG_ARCH_CLEAR_M, 8);
  const ground = (o) => o[1] - 0;   // flat ground at y 0: the probe's distance down to it
  const asked = [];
  const wall = (o, d, m) => { asked.push(m); return null; };
  const p = egArchPlace([10, 0, 20], 0, { ground, wall });
  assert.deepEqual(p.at.map((v) => +v.toFixed(6)), [10, 0, 20 + PORTAL_AHEAD], 'the Portal Stone\'s place, ahead');
  assert.equal(+p.yaw.toFixed(6), +Math.PI.toFixed(6), 'its fire faces the opener (turned half round from their facing)');
  assert.equal(asked.filter((m) => m === EG_ARCH_CLEAR_M).length, 4, 'its clearing asked across it either way, before and behind');
  const p2 = egArchPlace([0, 0, 0], Math.PI / 2, { ground, wall: () => null });
  assert.equal(+p2.yaw.toFixed(6), +(-Math.PI / 2).toFixed(6), 'facing east, the arch faces west back at them');
  assert.deepEqual(egArchPlace([0, 0, 0], 0, { ground, wall: (o, d, m) => (m === EG_ARCH_CLEAR_M && d[0] > 0.5 ? 5 : null) }), { refused: 'room' }, 'a wall 5 m to one side');
  assert.deepEqual(egArchPlace([0, 0, 0], 0, { ground: (o) => (o[0] > 3 ? null : o[1]), wall: () => null }), { refused: 'room' }, 'one foot over a drop');
  assert.deepEqual(egArchPlace([0, 0, 0], 0, { ground: () => null, wall: () => null }), { refused: 'room' }, 'no ground ahead at all');
  // the site, and back
  const t = [-5000, 37, 8000];
  const s = egArchSite([-4590.4, 49, 8380.25], 1.5, 300, 200, t);
  assert.deepEqual(s, { px: 300, py: 200, x: 409.6, y: 12, z: 380.25, yaw: 1.5 });
  assert.deepEqual(egArchSceneAt(s, [100, 37, 200]), [509.6, 49, 580.25], 'another scene stands it on the same pixel spot');
  assert.equal(egArchSite([0, 0, 0], 4 * Math.PI + 0.25, 1, 1, [0, 0, 0]).yaw, 0.25, 'its turn wrapped into one round');
  // the opener's landing (world/gate/gateArena.js gateLandingFor - widened to an arch record)
  const at = { pixelTranslation: () => [0, 0, 0], heightAt: () => 3 };
  const l = egArchLandingFor(SITE, at);
  assert.equal(EG_ARCH_LANDING_M, GATE_LANDING_M * 0.62);
  assert.deepEqual(l.pos.map((v) => +v.toFixed(6)), [+(409.6 + Math.sin(1.5) * EG_ARCH_LANDING_M).toFixed(6), 3, +(380.25 + Math.cos(1.5) * EG_ARCH_LANDING_M).toFixed(6)], 'before the arch, on the side its fire faces');
  assert.deepEqual(l.normal, [Math.sin(1.5), 0, Math.cos(1.5)], 'turned away from it');
  assert.equal(gateLandingFor({ px: 1, py: 1, spot: [0, 0] }, at), null, 'a record with neither day nor turn lands nowhere');
  const g = gateLandingFor({ day: 700, px: 1, py: 1, spot: [0, 0], yaw: 0 }, at);
  assert.deepEqual(g.normal, [Math.sin(gateYaw(700)), 0, Math.cos(gateYaw(700))], 'a gate\'s day still turns it, whatever else it carries');
});

test('EG-F THE ARCH\'S LIFE: it climbs out of the ground over GATE_RISE_MS from the opening, stands sealed to the open, open until the first hall wakes (or its end, or the open window\'s end), then sinks over GATE_COLLAPSE_MS - sunk whole before it rises, a beacon alone off the built ground (mutants: the rise or the sink at the wrong rate; the wake not sinking it; its foot not sunk)', () => {
  const a = { op: T0 };
  assert.equal(egArchLife(a, T0 - 1), null, 'before its opening');
  const r = egArchLife(a, T0 + GATE_RISE_MS / 2);
  assert.deepEqual([r.phase, r.rise, r.open], ['rising', 0.5, false]);
  assert.equal(egArchLife(a, T0 + GATE_RISE_MS).phase, 'sealed');
  assert.deepEqual([egArchLife(a, T0 + EG_SEALED_MS).phase, egArchLife(a, T0 + EG_SEALED_MS).open], ['open', true]);
  const end = T0 + EG_SEALED_MS + EG_ADMIT_MAX_MS;
  assert.equal(egArchLife(a, end - 1).phase, 'open');
  assert.deepEqual([egArchLife(a, end + GATE_COLLAPSE_MS / 2).phase, egArchLife(a, end + GATE_COLLAPSE_MS / 2).rise], ['sinking', 0.5], 'the window over: it sinks');
  assert.equal(egArchLife(a, end + GATE_COLLAPSE_MS), null, 'and is gone');
  const woke = { op: T0, wk: T0 + EG_SEALED_MS + 20_000 };
  assert.deepEqual([egArchLife(woke, woke.wk + 2500).phase, egArchLife(woke, woke.wk + 2500).rise], ['sinking', 0.75], 'the first hall wakes: it sinks behind the company');
  assert.equal(egArchLife(woke, woke.wk + GATE_COLLAPSE_MS), null);
  assert.equal(egArchLife({ op: T0, end: T0 + 60_000 }, T0 + 65_000).phase, 'sinking', 'an end before the open sinks it too');
  // in the scene
  const at = { pixelTranslation: () => [1000, 5, -2000], heightAt: () => 40 };
  const rising = egArchPlacement({ op: T0, site: SITE }, { ...at, now: T0 });
  assert.equal(rising.origin[1], 40 - (EG_ARCH_HEIGHT + 0.3), 'sunk whole under its ground before it climbs');
  const up = egArchPlacement({ op: T0, site: SITE }, { ...at, now: T0 + 60_000 });
  assert.deepEqual(up.origin, [1409.6, 40, -1619.75], 'risen: on the ground under its site');
  assert.deepEqual([up.yaw, up.fade, up.risen, up.coarse], [1.5, 1, true, false]);
  const far = egArchPlacement({ op: T0, site: SITE }, { pixelTranslation: () => [1000, 5, -2000], heightAt: () => NaN, now: T0 + 60_000 });
  assert.deepEqual([far.coarse, far.origin[1]], [true, 17], 'a pixel not built: the beacon alone at its site\'s height');
  assert.equal(egArchPlacement({ op: T0, site: SITE }, { ...at, now: T0 + 3_600_000 }), null);
  assert.equal(GATE_RISE_MS, 20_000);
  assert.equal(GATE_COLLAPSE_MS, 10_000);
});

/** A GL that records every call (the gate pass's own test's). */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('EG-F THE PASS, PER DRAW: the membrane\'s tint and scale and the beacon\'s height, foot and colour set inside the loop; the gate\'s record draws with the gate\'s own values, its sources the gate\'s byte for byte with those values written back; an arch\'s record its own, gold, 400 m over its foot; GATE_PASS_MAX 4 (mutants: the arch\'s colour on the gate; the scale lost; the beacon\'s height compiled in again; the cap left at 2)', () => {
  assert.equal(GATE_PASS_MAX, 4);
  assert.deepEqual(GATE_PASS_GATE, { scale: 1, tint: [1, 1, 1], below: BEACON_BELOW_M, height: BEACON_HEIGHT_M, foot: 0.3458, color: BEACON_COLOR });
  assert.equal(GATE_PASS_GATE.foot, Number(((BEACON_BELOW_M + BEACON_START_M) / BEACON_HEIGHT_M).toFixed(4)), 'the literal the gate\'s shader held');
  const gateRec = { origin: [0, 0, 0], yaw: 0.3, open: 1, fade: 1, spin: 0.2 };
  assert.equal(gatePassValues(gateRec), GATE_PASS_GATE, 'a record that names none is the gate\'s');
  const place = egArchPlacement({ op: T0, site: SITE }, { pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: T0 + 60_000 });
  const arch = egArchDraw(place, 0.4, 0.1);
  assert.deepEqual(gatePassValues(arch), { scale: 0.62, tint: [...EG_ARCH_TINT], below: 400, height: 400 + EG_ARCH_BEACON_UP_M, foot: Number(((400 + BEACON_START_M * 0.62) / 800).toFixed(4)), color: [...EG_ARCH_GOLD] });
  assert.equal(EG_ARCH_BEACON_UP_M, 400, 'half the gate\'s 800 over the ground');
  assert.equal(EG_ARCH_BEACON.height - EG_ARCH_BEACON.below, 400);
  assert.equal(BEACON_HEIGHT_M - BEACON_BELOW_M, 800);
  assert.ok(EG_ARCH_GOLD[1] > 0.6 && EG_ARCH_GOLD[0] >= EG_ARCH_GOLD[1] && EG_ARCH_GOLD[2] < 0.5, 'gold, not the gate\'s red');
  // the sources: the per-draw ones ARE the gate's with each per-draw place a uniform
  assert.equal(MEMBRANE_DRAW_VS.replace(MEMBRANE_SCALE_DECL, '').replace(' * uScale;', ';'), MEMBRANE_VS);
  assert.equal(MEMBRANE_DRAW_FS.replace(MEMBRANE_TINT_DECL, '').replace(MEMBRANE_TINT_LINE, ''), MEMBRANE_FS);
  assert.equal(BEACON_DRAW_VS.replace(BEACON_COLUMN_DECL, '').replace('-uBelow + aUV.y * uHeight', `-${BEACON_BELOW_M.toFixed(1)} + aUV.y * ${BEACON_HEIGHT_M.toFixed(1)}`), BEACON_VS);
  assert.equal(BEACON_DRAW_FS.replace(BEACON_FOOT_DECL, '').replace('float foot = uFoot;', `float foot = ${GATE_PASS_GATE.foot.toFixed(4)};`), BEACON_FS);
  // the calls: the gate's draw sets the gate's values; the arch's its own, in its turn
  const { gl, calls } = fakeGl();
  const pass = new GatePassRenderer(gl, gateArchProfile());
  assert.deepEqual(calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]), [MEMBRANE_DRAW_VS, MEMBRANE_DRAW_FS, BEACON_DRAW_VS, BEACON_DRAW_FS], 'the per-draw sources compiled');
  calls.length = 0;
  pass.draw([gateRec], I, I, [0, 0, 0], 5);
  const u = (name) => calls.filter((c) => c[1] === name).map((c) => (c[0].endsWith('fv') ? Array.from(c[2]) : c.slice(2).length === 1 ? c[2] : c.slice(2)));
  assert.deepEqual(u('uScale'), [1]);
  assert.deepEqual(u('uTint'), [[1, 1, 1]]);
  assert.deepEqual(u('uBelow'), [400]);
  assert.deepEqual(u('uHeight'), [1200]);
  assert.deepEqual(u('uFoot'), [0.3458]);
  assert.deepEqual(u('uColor'), [[...BEACON_COLOR]]);
  calls.length = 0;
  pass.draw([gateRec, arch], I, I, [0, 0, 0], 5);
  assert.deepEqual(u('uScale'), [1, 0.62], 'each fire its own scale, the gate first');
  assert.deepEqual(u('uHeight'), [1200, 800]);
  assert.deepEqual(u('uColor'), [[...BEACON_COLOR], [...EG_ARCH_GOLD]]);
  assert.deepEqual(u('uTint'), [[1, 1, 1], [...EG_ARCH_TINT]]);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 4, 'two beacons, two fires');
});

test('EG-F THE CLEAR SWEEP\'S KEYS: the gate\'s clearing and every standing arch\'s, one set keyed by its members; a box near an arch\'s foot is in it; a built pixel is built again only for what changed - an arch come that its pieces reach, a clearing gone that cost it something - and the gate alone sweeps as it did (mutants: a set\'s arch unasked; an arch\'s reach the gate\'s; a pixel rebuilt for a far arch; a gone clearing\'s cost forgotten)', () => {
  const gate = gateClearFor({ day: 700, px: 10, py: 10, spot: [400, 400] });
  assert.equal(gateClearSet(null, []), null);
  assert.equal(gateClearSet(gate, []), gate, 'the gate alone is the gate\'s own clearing, its key unchanged');
  const set = gateClearSet(gate, [{ b: 'bbbbbbbbbbbbbbbb', px: 20, py: 20, x: 100, z: 100 }, { b: 'aaaaaaaaaaaaaaaa', px: 30, py: 30, x: 50, z: 60 }]);
  assert.equal(set.key, `${gate.key}|eg:aaaaaaaaaaaaaaaa|eg:bbbbbbbbbbbbbbbb`, 'keyed by its members, the arches by breach');
  assert.equal(set.list[1].r, EG_ARCH_ROCK_M);
  assert.equal(gateClearSet(null, [{ b: 'aaaaaaaaaaaaaaaa', px: 30, py: 30, x: 50, z: 60 }]).key, 'eg:aaaaaaaaaaaaaaaa', 'an arch with no gate');
  assert.equal(boxNearGate(set, 30, 30, 50 + EG_ARCH_ROCK_M - 1, 60, 50 + EG_ARCH_ROCK_M - 1, 60), true, 'inside an arch\'s reach');
  assert.equal(boxNearGate(set, 30, 30, 50 + EG_ARCH_ROCK_M + 1, 60, 50 + EG_ARCH_ROCK_M + 1, 60), false, 'just past it - an arch\'s reach is its own, not the gate\'s');
  assert.ok(EG_ARCH_ROCK_M < GATE_CLEAR_M);
  assert.equal(boxNearGate(set, 10, 10, 400, 400, 400, 400), true, 'and the gate\'s own');
  // the sweep
  const sweep = createGateClearSweep();
  const near = { px: 30, py: 30, gateClearKey: gate.key, gateRefused: false, wodReach: [50, 62, 50, 62, 0] };
  const far = { px: 30, py: 31, gateClearKey: gate.key, gateRefused: false, wodReach: [5, 5, 5, 5, 0] };
  const refused = { px: 31, py: 30, gateClearKey: `${gate.key}|eg:aaaaaaaaaaaaaaaa`, gateRefused: true, wodReach: [] };
  const built = new Map([['n', near], ['f', far], ['r', refused]]);
  assert.deepEqual(sweep.step(gate, built).map((p) => p.px + p.py), [61], 'the turn to the gate alone: only the pixel an arch had cost something is built again');
  const withArch = gateClearSet(gate, [{ b: 'aaaaaaaaaaaaaaaa', px: 30, py: 30, x: 50, z: 60 }]);
  const again = sweep.step(withArch, built);
  assert.deepEqual(again, [near], 'an arch come: the pixel whose piece reaches it is built again');
  assert.equal(far.gateClearKey, withArch.key, 'the far pixel marked current, under the set\'s key');
});

test('EG-F THE HUB\'S SIGNATURE ON THE CALL: the arch\'s fields signed with the relay\'s key and verified with its public half; another key\'s, a moved site, another opener\'s name or no signature at all is refused; the cell\'s word read whole or not at all (mutants: the site left out of the signed bytes; any signature taken)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const c = { b: '0123456789abcdef', os: 'acct-mac', o: 'Mac', op: T0, ew: 3, site: SITE };
  assert.equal(egCallBytes(c), `${EG_CALL_SIG_V}|0123456789abcdef|acct-mac|Mac|${T0}|3|300|200|409.6|12|380.25|1.5`);
  const sg = await signEgCall(c, kp.privateKey, { subtle });
  assert.match(sg, /^[A-Za-z0-9_-]{86}$/);
  assert.equal(await verifyEgCall({ ...c, sg }, kp.publicKey, { subtle }), true);
  assert.equal(await verifyEgCall({ ...c, sg: await signEgCall(c, other.privateKey, { subtle }) }, kp.publicKey, { subtle }), false, 'a forged signature');
  assert.equal(await verifyEgCall({ ...c, site: { ...SITE, x: 410 }, sg }, kp.publicKey, { subtle }), false, 'the arch moved');
  assert.equal(await verifyEgCall({ ...c, o: 'Ann', sg }, kp.publicKey, { subtle }), false, 'under another name');
  assert.equal(await verifyEgCall({ ...c, ew: 0, sg }, kp.publicKey, { subtle }), false, 'another start');
  assert.equal(await verifyEgCall({ ...c, sg: '' }, kp.publicKey, { subtle }), false, 'unsigned');
  assert.equal(await verifyEgCall({ ...c, sg }, null, { subtle }), false, 'no key to verify with');
  assert.equal(await signEgCall(c, null, { subtle }), '', 'a relay with no key signs nothing');
  const word = { b: c.b, o: 'Mac', os: 'acct-mac', op: T0, ew: 3, site: SITE, sg };
  assert.deepEqual(validEgArchWord(word), word);
  assert.equal(validEgArchWord({ ...word, sg: '' }), null, 'no signature, no word');
  assert.equal(validEgArchWord({ ...word, site: { ...SITE, yaw: 99 } }), null, 'a site out of its law');
  assert.equal(validEgArchWord({ ...word, b: 'nope' }), null);
  assert.equal(validEgArchWord({ ...word, op: 'soon' }), null);
});

test('EG-F THE TIMERS ROW, THE SIGHT LINE, THE SKIN: "Elite Breach opens" while sealed, the window to answer, then the hall and the count; nothing once it ends; "You see an Elite Breach 140 meters to the North!" by the Elite Dungeon\'s own law; white marble inlaid with gold and cracked with the Warden\'s basalt, on the gate\'s records\' twins (mutants: the row past the end; the count\'s end lost; the sight line\'s rounding; the arch in the gate\'s basalt)', () => {
  const op = T0;
  const row = (now, el) => eventTimerRows({ now, elite: el }).filter((r) => r.kind === 'elite');
  assert.deepEqual(row(op + 60_000, { op }).map((r) => [r.title, r.live, r.at]), [['Elite Breach opens', false, op + EG_SEALED_MS]]);
  assert.deepEqual(row(op + 60_000, { op, rh: 1 }).map((r) => r.title), ['Rehearsal opens']);
  assert.deepEqual(row(op + EG_SEALED_MS + 1, { op }).map((r) => [r.title, r.live, r.at]), [['Elite Breach open', true, op + EG_SEALED_MS + EG_ADMIT_MAX_MS]]);
  assert.deepEqual(row(op + 700_000, { op, h: 17, until: op + 2_000_000 }).map((r) => [r.title, r.live, r.at, r.detail]), [['Hall 17', true, op + 2_000_000, 'Time left']]);
  assert.deepEqual(row(op + 700_000, { op, h: 17, until: op + 2_000_000, end: 'tear' }), [], 'an ended breach has no row');
  assert.deepEqual(row(op + 3_600_000, { op }), [], 'the window past with no hall: none');
  assert.deepEqual(row(op, null), []);
  assert.equal(sightLineOf(EG_TEXT.sight, 137, 'North'), 'You see an Elite Breach 140 meters to the North!');
  assert.equal(sightLineOf(EG_TEXT.sight, 2, 'East'), 'You see an Elite Breach 10 meters to the East!', 'never under ten');
  assert.equal(dungeonSightLine(137, 'North', 'elite'), 'You see an Elite Dungeon 140 meters to the North!', 'the dungeon\'s line as it was');
  // the skin
  assert.deepEqual(EG_ARCH_RECORD_OF, { [GATE_STONE_RECORD]: EG_ARCH_STONE_RECORD, [GATE_SPINE_RECORD]: EG_ARCH_SPINE_RECORD, [GATE_RIM_RECORD]: EG_ARCH_RIM_RECORD });
  assert.deepEqual([EG_ARCH_STONE_RECORD, EG_ARCH_SPINE_RECORD, EG_ARCH_RIM_RECORD], [5, 6, 7], 'past the gate\'s five records, in its archive');
  const model = buildGateModel(), am = egArchModel(model);
  assert.equal(am.positions, model.positions, 'the gate\'s own mesh');
  for (let i = 0; i < model.subMeshes.length; i++) {
    const g = model.subMeshes[i], a = am.subMeshes[i];
    assert.equal(a.textureArchive, GATE_ARCHIVE);
    assert.equal(a.textureRecord, g.textureRecord === GATE_PLINTH_RECORD ? GATE_PLINTH_RECORD : EG_ARCH_RECORD_OF[g.textureRecord], 'each face on its arch twin');
  }
  const art = new Map(archArt());
  assert.deepEqual([...art.keys()], [5, 6, 7]);
  const stone = art.get(EG_ARCH_STONE_RECORD).albedo;
  const px = (x, y) => Array.from(stone.colors.slice((y * stone.width + x) * 4, (y * stone.width + x) * 4 + 3));
  let gold = 0, crack = 0, marble = 0;
  for (let y = 0; y < stone.height; y++) for (let x = 0; x < stone.width; x++) {
    const c = px(x, y);
    if (c.join() === ARCH_GOLD.join()) gold++; else if (c.join() === ARCH_CRACK.join()) crack++; else if (c[0] > 150 && c[1] > 150 && c[2] > 140) marble++;
  }
  assert.ok(marble > stone.width * stone.height * 0.6, 'white marble, most of it');
  assert.ok(gold >= (stone.width / ARCH_INLAY_TEXELS) * stone.width, 'its gold inlay, a lattice');
  assert.ok(crack > 0, 'the Warden\'s basalt cracking through it');
  assert.equal(px(0, 5).join(), ARCH_GOLD.join(), 'the inlay on its lattice line');
});
