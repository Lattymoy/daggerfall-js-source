// WB4a (2026-09-25, Mac: "a large boss arena with an oversized enemy with telegraphed attacks (like wind ups, etc)"):
// THE BOSS FIGHTS YOU, DRIVEN. The strike's law on the struck player's own machine (net/gateStrike.js - each shape
// against a point, the charge swept between frames, the verdict decided at the landing and never late, the share of
// one's own health, fire through the saving throw and the Wrath through nothing); his look (world/gateBoss.js - the
// wind-up's held frames, the landing's played ones, the run, the walk, the flinch, the fall; the frame an eye sees; the
// glow; his voice); the telegraph (render/gateTelegraph.js - the shader's own reading held to the strike's law point
// for point, its shape over time, its pass); the bar (ui/gateBossBar.js); the court's driver (scenes/gateCourt.js -
// each attack judged once, cued at its word and its landing, his body at three times its size, put away out of the
// court); and the seams in the world host, the dungeon arm and the dungeon context, by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ATTACKS, ATTACK_BY_ID, BOSS_R, COURT_CENTRE, COURT_R, PHASE_AT, PHASE3_WINDUP } from '../src/net/gateBrain.js';
import {
  inAttack, chargeHead, chargeStrikes, strikeVerdict, blowOf, strikeDamage, fireShare, telegraphAt, segmentDistance, STRIKE_LATE_MS,
} from '../src/net/gateStrike.js';
import {
  bossAct, bossFrame, bossGlow, bossPlace, bossLookOf, BOSS_LOOKS, BOSS_CUES, ATTACK_COLORS, WARD_COLOR, EMBER_COLOR, FALL_MS, FLINCH_MS,
  GLOW_UP, GLOW_RANGE, RUN_ANIM_SPEED, FIRE_CAST_ID, BURNING,
} from '../src/world/gateBoss.js';
import {
  telegraphShape, telegraphField, telegraphQuad, GateTelegraphRenderer, TELEGRAPH_KIND, TELEGRAPH_FS, TELEGRAPH_VS, TELEGRAPH_POINTS_MAX,
  TELEGRAPH_FADE_IN_MS, TELEGRAPH_FLASH_MS, TELEGRAPH_MARGIN,
} from '../src/render/gateTelegraph.js';
import { bossBarModel, drawGateBossBar, destroyGateBossBar, BOSS_BAR_TEXT, WRATH_WARN_MS } from '../src/ui/gateBossBar.js';
import { createGateCourt, bossOf, COURT_STRIKE_TEXT } from '../src/scenes/gateCourt.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { gateBossOf } from '../src/net/gateLaw.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { PRIMARY_ATTACK_ANIMS, MOVE_ANIMS, HURT_ANIMS, IDLE_ANIMS, mobileOrientation } from '../src/characters/mobileUnit.js';
import { mobileBillboardSize } from '../src/world/rmbFlats.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });

test('WB4 the shapes: a cone holds his body and its arc about his facing and nothing past its reach; a disc is his own or each target\'s; the lane is the charge\'s ground end to end; the ring is safe at his feet and past its edge; the Wrath is everywhere (mutants: the body out of the cone; the arc doubled; the targets\' discs about him; the ring\'s inner edge dropped)', () => {
  const c = W('cleave', { x: 2, z: -1, yw: Math.PI / 2 });   // facing +x
  assert.ok(inAttack(c, 2 + 8.5, -1), 'straight ahead, inside the reach');
  assert.ok(!inAttack(c, 2 + 9.5, -1), 'past the reach');
  assert.ok(!inAttack(c, 2 - 5, -1), 'behind him');
  assert.ok(inAttack(c, 2 - 1.5, -1), 'his own body is always in it - a player hugging his back is not safe from the swing');
  const half = (ATTACKS.cleave.arc / 2) * (Math.PI / 180);
  const at = (a, r) => [2 + Math.sin(Math.PI / 2 + a) * r, -1 + Math.cos(Math.PI / 2 + a) * r];
  assert.ok(inAttack(c, ...at(half - 0.02, 6)) && inAttack(c, ...at(-(half - 0.02), 6)), 'the arc\'s edges, both sides');
  assert.ok(!inAttack(c, ...at(half + 0.05, 6)) && !inAttack(c, ...at(-(half + 0.05), 6)), 'and not past them');
  const slam = W('slam', { x: -3, z: 4 });
  assert.ok(inAttack(slam, -3 + 6.9, 4) && !inAttack(slam, -3 + 7.1, 4), 'the slam about his own feet');
  const hf = W('hellfire', { x: 0, z: 0, tg: [[10, 10], [-8, 3]] });
  assert.ok(inAttack(hf, 10 + 3.4, 10) && inAttack(hf, -8, 3 - 3.4), 'under each target');
  assert.ok(!inAttack(hf, 0, 0), 'not about him - he is not under his own fire');
  assert.ok(!inAttack(W('hellfire', { tg: [] }), 0, 0), 'no targets, no fire');
  const ch = W('charge', { x: -5, z: -5, tg: [[5, 15]] });
  assert.ok(inAttack(ch, 0, 5) && inAttack(ch, 5, 15), 'down the lane to its end');
  assert.ok(!inAttack(ch, 5, 5), 'beside it');
  assert.ok(!inAttack(W('charge', { tg: [] }), 0, 0), 'a lane with no end is none');
  const nova = W('nova', { x: 1, z: 1 });
  assert.ok(!inAttack(nova, 1 + 3.9, 1), 'safe at his feet');
  assert.ok(inAttack(nova, 1 + 4.1, 1) && inAttack(nova, 1 + 20, 1), 'the ring');
  assert.ok(!inAttack(nova, 1 + 30.5, 1), 'and past it');
  assert.ok(inAttack(W('wrath'), 23, -3), 'the whole court');
  assert.ok(!inAttack(W('cleave'), NaN, 0) && !inAttack({ a: 99 }, 0, 0), 'nothing for a point that is none or an attack that is none');
  assert.equal(segmentDistance(0, 5, 0, 0, 0, 0), 5);
});

test('WB4 the verdict: nothing before the landing; decided at the first frame on it, inside or not, and never judged late; the charge strikes the ground he runs over between two frames - not ahead of him, not behind him, and a slow frame sweeps all it missed (mutants: judged before the landing; a late frame struck; the charge a ray from where he stood)', () => {
  const s = W('slam', { x: 0, z: 0 });
  assert.equal(strikeVerdict(s, 1, 1, 9999, 9980), 'wait');
  assert.equal(strikeVerdict(s, 1, 1, 10000, 9990), 'hit');
  assert.equal(strikeVerdict(s, 9, 1, 10010, 9990), 'miss', 'outside it at the landing');
  const span = ATTACKS.slam.active;
  assert.equal(strikeVerdict(s, 1, 1, 10000 + span + STRIKE_LATE_MS, 9990), 'hit', 'the last frame that may judge it');
  assert.equal(strikeVerdict(s, 1, 1, 10000 + span + STRIKE_LATE_MS + 1, 9990), 'miss', 'a stalled screen is not struck by what it never saw land');
  assert.equal(strikeVerdict({ a: 42, at: 10000 }, 0, 0, 10000), 'miss', 'no such attack');
  // the charge: 22 m in 900 ms down +z from the centre
  const ch = W('charge', { x: 0, z: 0, tg: [[0, 22]] });
  const A = ATTACKS.charge;
  assert.deepEqual(chargeHead(ch, 10000), [0, 0]);
  assert.deepEqual(chargeHead(ch, 10000 + A.active), [0, 22]);
  assert.equal(chargeHead(ch, 9999), null); assert.equal(chargeHead(ch, 10000 + A.active + 1), null);
  const tAt = (z) => 10000 + (z / 22) * A.active;   // when his head reaches z
  assert.equal(strikeVerdict(ch, 0, 15, tAt(5), tAt(4)), 'wait', 'the lane ahead of him is safe until he gets there');
  assert.equal(strikeVerdict(ch, 0, 15, tAt(15), tAt(14)), 'hit', 'the frame he runs over me');
  assert.equal(strikeVerdict(ch, 0, 3, tAt(15), tAt(14)), 'wait', 'the ground behind him is safe again (the run goes on)');
  assert.equal(strikeVerdict(ch, 0, 15, tAt(20), tAt(10)), 'hit', 'a slow frame sweeps the whole stretch it missed');
  assert.equal(strikeVerdict(ch, BOSS_R - 0.05, 15, tAt(15), tAt(14)), 'hit', 'his body\'s width, not a line');
  assert.equal(strikeVerdict(ch, BOSS_R + 0.05, 15, tAt(15), tAt(14)), 'wait', 'and no wider than his body (the lane\'s half-width is less)');
  assert.ok(ATTACKS.charge.width / 2 < BOSS_R);
  assert.equal(strikeVerdict(ch, 0, 3, 10000 + A.active, tAt(21)), 'miss', 'the run over, it passed me');
  assert.ok(!chargeStrikes(W('slam'), 0, 0, 10000), 'only the charge runs');
});

test('WB4 what a strike does: a share of the struck player\'s own maximum health, at least one; fire through the saving throw, and the Wrath through nothing; the telegraph\'s clock by the phase\'s wind-up (mutants: the Wrath saved; the damage off a fixed health; phase three\'s wind-up the full one)', () => {
  assert.deepEqual(blowOf(W('cleave')), { pct: ATTACKS.cleave.pct, base: ATTACKS.cleave.base, el: null, name: 'Cleave', saved: false }, 'WBX4: a share and the points beside it');
  assert.equal(blowOf(W('hellfire')).saved, true);
  assert.equal(blowOf(W('nova')).saved, true);
  assert.equal(blowOf(W('wrath')).saved, false, 'Dagon\'s Wrath is answered by nothing');
  assert.equal(blowOf({ a: 42 }), null);
  assert.equal(strikeDamage(0.3, 40), 12); assert.equal(strikeDamage(0.3, 400), 120, 'a level-1 and a level-30 read the same share');
  assert.equal(strikeDamage(0.35, 40, 8), 22); assert.equal(strikeDamage(0.35, 400, 8), 148, 'WBX4: the base beside the share');
  assert.equal(strikeDamage(0.3, 40, -5), 12, 'a base is never a heal');
  assert.equal(strikeDamage(0.001, 10), 1, 'at least one');
  assert.ok(strikeDamage(ATTACKS.wrath.pct, 900) > 900, 'more than any health');
  assert.equal(fireShare(40, 50), 20); assert.equal(fireShare(40, 0), 0); assert.equal(fireShare(40, 250), 40); assert.equal(fireShare(41, 50), 20);
  const t1 = telegraphAt(W('slam'), 1, 10000 - ATTACKS.slam.windup / 2);
  assert.equal(t1.t, 0.5); assert.equal(t1.landing, false); assert.equal(t1.key, 'slam');
  const w3 = Math.round(ATTACKS.slam.windup * PHASE3_WINDUP);
  assert.equal(telegraphAt(W('slam'), 3, 10000 - w3).t, 0, 'phase three winds up shorter - the word comes later for the same landing');
  assert.equal(telegraphAt(W('wrath'), 3, 10000 - ATTACKS.wrath.windup).t, 0, 'the Wrath is the clock\'s, never shortened');
  const land = telegraphAt(W('slam'), 1, 10000 + 10);
  assert.ok(land.landing && !land.over && land.t === 1);
  assert.ok(telegraphAt(W('slam'), 1, 10000 + ATTACKS.slam.active).over);
});

const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });

test('WB4 his look: the wind-up holds the attack\'s first frame then its second, the landing plays the rest at the clip\'s rate, the charge runs the walk\'s frames down its lane and stands at its end, a walk walks, a blow of mine makes him flinch but never breaks a wind-up, and the fall plays the hurt frames and leaves nothing (mutants: the raise held from the word; the charge left at its start; the flinch over a wind-up)', () => {
  const s = state({ atk: W('slam') });
  const w = ATTACKS.slam.windup;
  let a = bossAct(s, 10000 - w + 10);
  assert.equal(a.act, 'windup'); assert.equal(a.anims, PRIMARY_ATTACK_ANIMS); assert.equal(a.frame, 0); assert.equal(a.atk, 'slam');
  assert.equal(bossAct(s, 10000 - w / 2 + 10).frame, 1, 'the raise from half way');
  assert.equal(bossAct(s, 10000 - 10, 10000 - 20).act, 'windup', 'a blow of mine never breaks a wind-up');
  assert.deepEqual([10000, 10100, 10200].map((t) => bossAct(s, t)).map((x) => [x.act, x.frame]), [['strike', 2], ['strike', 3], ['strike', 4]], 'the swing at the clip\'s 10 a second');
  assert.equal(bossAct(s, 10300).act, 'idle', 'the recovery stands');
  // the charge
  const ch = state({ atk: W('charge', { x: -5, z: 0, tg: [[15, 0]] }), x: -5, z: 0 });
  a = bossAct(ch, 10000 + 450);
  assert.equal(a.act, 'run'); assert.equal(a.anims, MOVE_ANIMS); assert.ok(a.loop);
  assert.equal(a.frame, Math.floor(0.45 * RUN_ANIM_SPEED));
  assert.deepEqual(bossPlace(ch, 10000 + 450), [5, 0], 'half way down his lane');
  assert.deepEqual(bossPlace(ch, 10000 + 5000), [15, 0], 'and at its end after, where the brain holds him');
  assert.deepEqual(bossPlace(ch, 9000), [-5, 0], 'where he stood through the wind-up');
  // a walk
  const walk = state({ x: 0, z: 0, move: { x: 0, z: 0, tx: 0, tz: 10, v: 3.2, at: 20000 } });
  assert.equal(bossAct(walk, 21000).act, 'walk');
  assert.equal(bossAct(walk, 30000).act, 'idle', 'arrived, he stands');
  assert.equal(bossAct(walk, 21000, 20800).act, 'flinch', 'a blow of mine');
  assert.equal(bossAct(walk, 21000, 21000 - FLINCH_MS).act, 'walk', 'for a moment');
  // the fall
  const fell = state({ fell: { at: 50000, top: [], n: 3 } });
  assert.equal(bossAct(fell, 50000 + 100).act, 'fall'); assert.equal(bossAct(fell, 50000 + 100).anims, HURT_ANIMS);
  assert.equal(bossAct(fell, 50000 + FALL_MS).act, 'gone');
  assert.equal(bossAct(GATE_STATE_EMPTY, 1).act, 'gone');
  assert.equal(bossAct(state(), 1).anims, IDLE_ANIMS);
});

test('WB4 the frame an eye sees: the record his facing turns to the eye, mirrored where the table mirrors, a held frame held at the record\'s last and a loop wrapped; the look is a Daedra Lord three times over (mutants: the loop not wrapped; the held frame past the record)', () => {
  const act = bossAct(state({ atk: W('cleave') }), 10000 + 250);   // the swing's last frame
  assert.deepEqual(bossFrame(act, 0, [0, 0, 0], [0, 1.7, 10], () => 5), { record: 5, frame: 4, flip: false }, 'facing the eye: the front record');
  assert.deepEqual(bossFrame(act, 0, [0, 0, 0], [0, 1.7, 10], () => 3), { record: 5, frame: 2, flip: false }, 'held at the record\'s last');
  assert.deepEqual(bossFrame(act, Math.PI, [0, 0, 0], [0, 1.7, 10], () => 5), { record: 9, frame: 4, flip: false }, 'his back');
  for (let k = 0; k < 8; k++) {
    const yaw = (k * Math.PI) / 4, o = mobileOrientation(yaw, [0, 0, 0], [0, 1.7, 10]);
    const f = bossFrame(act, yaw, [0, 0, 0], [0, 1.7, 10], () => 5);
    assert.deepEqual([f.record, f.flip], [PRIMARY_ATTACK_ANIMS[o].record, PRIMARY_ATTACK_ANIMS[o].flip], `turned ${k} eighths: the table's own record and mirror`);
  }
  assert.ok(PRIMARY_ATTACK_ANIMS.some((x) => x.flip), 'the back diagonals are mirrored');
  const idle = bossAct(state(), 1234567);
  assert.equal(bossFrame(idle, 0, [0, 0, 0], [0, 0, 5], () => 4).frame, idle.frame % 4, 'a loop wraps');
  assert.equal(bossFrame(idle, 0, [0, 0, 0], [0, 0, 5], () => 0).frame, 0, 'a record with no count is one frame');
  assert.deepEqual(bossLookOf('ruhn'), { mobile: 31, scale: 3 }); assert.equal(bossLookOf('nobody'), BOSS_LOOKS.ruhn);
  assert.equal(ENEMY_BASICS[31].maleTexture, 286, 'the Daedra Lord\'s own archive');
});

test('WB4 the glow on him: a light at his chest in the court\'s channel - the attack\'s colour climbing through its wind-up and flaring at the landing, dying after it, gold while the ward stands, a low ember otherwise, going out with his fall (mutants: the glow flat through the wind-up; the ward\'s gold never shown)', () => {
  const s = state({ atk: W('nova', { x: 2, z: 3 }), x: 2, z: 3, phase: 2 });
  const w = ATTACKS.nova.windup;
  const early = bossGlow(s, 10000 - w + 100), late = bossGlow(s, 10000 - 100), land = bossGlow(s, 10000 + 50);
  const [x, y, z] = courtToDungeon(2, GLOW_UP, 3);
  assert.deepEqual([early.x, early.y, early.z], [x, y, z], 'at his chest');
  const k = (g) => g.color[0] / ATTACK_COLORS.nova[0];
  assert.ok(k(late) > k(early) * 3, 'climbing through the wind-up');
  assert.ok(k(land) > k(late), 'flaring at the landing');
  assert.equal(land.range, GLOW_RANGE.landing); assert.equal(early.range, GLOW_RANGE.windup);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(early.color[i] / ATTACK_COLORS.nova[i] - k(early)) < 1e-9, 'the attack\'s own colour');
  const after = bossGlow(s, 10000 + ATTACKS.nova.active + 300);
  assert.ok(k(after) < k(land), 'dying after');
  const ward = bossGlow(state({ shieldUntil: 5000 }), 4000);
  assert.ok(Math.abs(ward.color[1] / ward.color[0] - WARD_COLOR[1] / WARD_COLOR[0]) < 1e-9, 'the ward\'s gold');
  const ember = bossGlow(state(), 4000);
  assert.ok(Math.abs(ember.color[1] / ember.color[0] - EMBER_COLOR[1] / EMBER_COLOR[0]) < 1e-9); assert.equal(ember.range, GLOW_RANGE.ember);
  assert.equal(bossGlow(state({ fell: { at: 1000, top: [], n: 1 } }), 1000 + FALL_MS), null, 'out with his fall');
  assert.equal(bossGlow(GATE_STATE_EMPTY, 1), null);
});

test('WB4 his voice: the Daedra Lord\'s own bark and attack, pitched down for his size, loud and far; the fire\'s cast by its sound ID; the burning under each Hellfire target (mutants: a cue off his own voice)', () => {
  const B = ENEMY_BASICS[31];
  for (const k of ['cleave', 'slam', 'wrath']) assert.equal(BOSS_CUES.windup[k].clip, B.barkSound);
  assert.equal(BOSS_CUES.windup.charge.clip, B.moveSound);
  for (const k of ['cleave', 'slam', 'charge']) assert.equal(BOSS_CUES.land[k].clip, B.attackSound);
  assert.equal(BOSS_CUES.windup.hellfire.id, FIRE_CAST_ID); assert.equal(BOSS_CUES.windup.nova.id, FIRE_CAST_ID);
  assert.equal(BOSS_CUES.land.hellfire.clip, BURNING); assert.equal(BOSS_CUES.land.hellfire.at, 'targets');
  for (const set of [BOSS_CUES.windup, BOSS_CUES.land]) for (const c of Object.values(set)) { assert.ok(c.pitch < 1, 'pitched down'); assert.ok(c.reach >= 40); }
  for (const key of Object.keys(ATTACKS)) { assert.ok(BOSS_CUES.windup[key] && BOSS_CUES.land[key], `${key} has its cues`); assert.ok(ATTACK_COLORS[key], `${key} has its colour`); }
});

test('WB4 the telegraph: the shader\'s own reading agrees with the strike\'s law at every point of the floor, for every attack; it comes up at the word, fills with the wind-up, flashes at the landing and is gone after (mutants: the reading\'s cone without his body; the discs about him; the flash kept)', () => {
  const cases = [
    W('cleave', { x: 2, z: -3, yw: 0.7 }), W('slam', { x: -4, z: 1 }), W('charge', { x: 1, z: 1, yw: 0.3, tg: [[7, 18]] }),
    W('hellfire', { tg: [[5, 5], [-8, 2], [0, -12], [9, -9], [-3, 14], [6, 6], [-9, 1], [1, -11], [10, -8], [-2, 13]] }), W('nova', { x: 3, z: -2 }), W('wrath'),
  ];
  for (const atk of cases) {
    const sh = telegraphShape(atk, 2, 9500);
    let n = 0;
    for (let x = -COURT_R; x <= COURT_R; x += 0.53) {
      for (let z = -COURT_R; z <= COURT_R; z += 0.61) {
        if (Math.hypot(x, z) > COURT_R) continue;
        n++;
        assert.equal(telegraphField(sh, x, z).inside, inAttack(atk, x, z), `${ATTACK_BY_ID[atk.a].key} at ${x.toFixed(2)},${z.toFixed(2)}`);
      }
    }
    assert.ok(n > 5000);
  }
  const hf = telegraphShape(cases[3], 3, 9500);
  assert.equal(hf.kind, TELEGRAPH_KIND.discs); assert.equal(hf.points.length, TELEGRAPH_POINTS_MAX, 'phase three\'s two volleys, all drawn');
  assert.equal(telegraphShape(cases[1], 1, 9500).kind, TELEGRAPH_KIND.disc);
  const slam = W('slam'), w = ATTACKS.slam.windup;
  assert.equal(telegraphShape(slam, 1, 10000 - w).alpha, 0, 'it comes up at the word');
  assert.equal(telegraphShape(slam, 1, 10000 - w + TELEGRAPH_FADE_IN_MS).alpha, 1);
  assert.equal(telegraphShape(slam, 1, 10000 - w / 4).t, 0.75, 'filling with the wind-up');
  assert.equal(telegraphShape(slam, 1, 10000 - w / 4).flash, 0);
  assert.equal(telegraphShape(slam, 1, 10000).flash, 1, 'the landing');
  const fading = telegraphShape(slam, 1, 10000 + ATTACKS.slam.active + TELEGRAPH_FLASH_MS / 2);
  assert.ok(Math.abs(fading.alpha - 0.5) < 1e-9, 'dying after its span');
  assert.equal(telegraphShape(slam, 1, 10000 + ATTACKS.slam.active + TELEGRAPH_FLASH_MS), null, 'and gone');
  assert.equal(telegraphShape(null, 1, 0), null);
  assert.deepEqual(telegraphShape(slam, 1, 9000).color, ATTACK_COLORS.slam);
  // the fill's coordinate runs out from him, down the lane, out from the ring's inner edge
  const lane = telegraphShape(cases[2], 1, 9500);
  assert.ok(Math.abs(telegraphField(lane, 1, 1).s) < 1e-9 && Math.abs(telegraphField(lane, 7, 18).s - 1) < 1e-9);
  const ring = telegraphShape(cases[4], 1, 9500);
  assert.ok(Math.abs(telegraphField(ring, 3 + 4, -2).s) < 1e-9);
  // the quad covers the floor
  const q = telegraphQuad();
  assert.equal(q.length, 12); assert.equal(Math.max(...q), COURT_R + TELEGRAPH_MARGIN); assert.equal(Math.min(...q), -(COURT_R + TELEGRAPH_MARGIN));
});

test('WB4 the shader\'s text says what the reading says: each shape\'s inside, the floor\'s edge, the fill against the wind-up, the flash, the fog (mutants: the cone\'s body dropped from the shader)', () => {
  for (const re of [
    /inside = d <= uR && \(d <= uBody \|\| ang <= uHalfArc\);/,
    /float ang = abs\(wrapAngle\(atan\(rel\.x, rel\.y\) - uYaw\)\);/,
    /for \(int i = 0; i < 10; i\+\+\) \{ if \(i >= uCount\) break; m = min\(m, length\(vCourt - uPts\[i\]\)\); \}\n\s*inside = m <= uR;/,
    /float ld = length\(vCourt - \(uOrigin \+ v \* h\)\);\n\s*inside = ld <= uHalfW;/,
    /inside = d >= uR0 && d <= uR1;/,
    /if \(c > uFloorR\) discard;/,
    /float filled = fin \* step\(s, uT\);/,
    /light = mix\(light, 1\.1 \* fin \+ 0\.6 \* rim, uFlash\);/,
    /o = vec4\(uColor \* light \* uAlpha \* fogFactorAt\(vWorld\), 1\.0\);/,
  ]) assert.match(TELEGRAPH_FS, re);
  assert.match(TELEGRAPH_VS, /vWorld = uCentre \+ vec3\(aCourt\.x, uLift, aCourt\.y\);/);
  assert.match(TELEGRAPH_FS, /uniform vec2 uPts\[10\];/);
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('WB4 the pass: one quad added onto the frame, no depth written, lifted off the floor by an offset, the discs handed whole, the state put back - and nothing touched for no shape (mutants: the depth written; the offset left on)', () => {
  const { gl, calls } = fakeGl();
  const pass = new GateTelegraphRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  pass.draw(null, I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0); assert.equal(pass.drawn, 0);
  pass.draw(telegraphShape(W('hellfire', { tg: [[1, 2], [3, 4]] }), 2, 9500), I, I, [0, 0, 0], 3.5, { mode: 2, density: 0.009, range: [0, 1], camPos: [1, 2, 3] });
  assert.equal(pass.drawn, 1);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 1);
  assert.deepEqual(calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1)), [[gl.ONE, gl.ONE]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true]);
  const names = calls.map((c) => c[0]);
  const on = calls.findIndex((c) => c[0] === 'enable' && c[1] === gl.POLYGON_OFFSET_FILL), off = calls.findIndex((c) => c[0] === 'disable' && c[1] === gl.POLYGON_OFFSET_FILL);
  assert.ok(on >= 0 && on < names.indexOf('drawArrays') && off > names.indexOf('drawArrays'), 'the offset around the draw alone');
  const pts = calls.find((c) => c[0] === 'uniform2fv' && c[1] === 'uPts');
  assert.deepEqual(Array.from(pts[2]).slice(0, 5), [1, 2, 3, 4, 0]);
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uCount' && c[2] === 2));
  assert.ok(calls.some((c) => c[0] === 'uniform3f' && c[1] === 'uCentre' && c[2] === COURT_CENTRE[0] && c[4] === COURT_CENTRE[2]));
  assert.ok(names.lastIndexOf('enable') > names.indexOf('drawArrays'), 'culling back on after');
});

test('WB4 the bar: his name over his health, the phase marks, the ward, the attack being wound up in its colour, the Wrath\'s countdown near the midnight, the fall - and drawn by updating one node, hidden with the HUD (mutants: the callout after the landing; the countdown always)', () => {
  const boss = gateBossOf(700);
  const m = bossBarModel(state({ hp: 250, max: 1000, atk: W('slam'), phase: 2 }), 9500, boss);
  assert.equal(m.name, 'Valkynaz Ruhn'); assert.equal(m.title, 'Warden of the Burning Gate');
  assert.equal(m.frac, 0.25); assert.deepEqual(m.marks, [...PHASE_AT]);
  assert.equal(m.callout.text, 'Ground Slam'); assert.equal(m.callout.color, 'rgb(255, 133, 26)');
  assert.equal(bossBarModel(state({ atk: W('slam') }), 10000 + ATTACKS.slam.active, boss).callout, null, 'said while it is coming, not after');
  assert.equal(bossBarModel(state({ shieldUntil: 5000 }), 4000, boss).warded, true);
  assert.equal(bossBarModel(state({ wrathAt: 1000 + WRATH_WARN_MS + 1 }), 1000, boss).wrath, null);
  assert.equal(bossBarModel(state({ wrathAt: 1000 + 61_000 }), 1000, boss).wrath, BOSS_BAR_TEXT.wrathIn('1:01'));
  const fell = bossBarModel(state({ fell: { at: 1, top: [], n: 1 }, atk: W('slam') }), 9000, boss);
  assert.equal(fell.frac, 0); assert.equal(fell.fallen, true); assert.equal(fell.callout, null);
  assert.equal(bossBarModel(GATE_STATE_EMPTY, 1, boss), null);
  // the node: made once, written on change, hidden with the HUD
  const made = [];
  const node = () => { const n = { style: {}, textContent: '', children: [], append(...c) { this.children.push(...c); }, remove() { this.gone = true; } }; made.push(n); return n; };
  const doc = { createElement: node, body: node() };
  destroyGateBossBar();
  drawGateBossBar(null, { doc });
  assert.equal(made.length, 1, 'nothing made for nothing');
  drawGateBossBar(m, { doc });
  const count = made.length;
  const root = doc.body.children[0];
  assert.ok(count > 5);
  drawGateBossBar(m, { doc });
  drawGateBossBar({ ...m, frac: 0.2 }, { doc });
  assert.equal(made.length, count, 'updated, not rebuilt');
  drawGateBossBar(m, { doc, hidden: true });
  assert.equal(root.style.display, 'none');
  drawGateBossBar(m, { doc });
  assert.equal(root.style.display, '');
  destroyGateBossBar();
  assert.ok(root.gone);
  assert.equal(bossOf({ boss: 'ruhn', day: 3 }).name, 'Valkynaz Ruhn');
});

/** A court driven by hand: a link whose state the test writes, a clock, feet, a player, a renderer and a sprite. */
function court({ feet = [0, 0, 0], health = 100, maxHealth = 100, save = 100, sprite = true } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const struck = [], said = [], sounds = [], uploads = [], batches = [], destroyed = [];
  const me = { health, maxHealth };
  const tex = { archive: 286, getFrameCount: () => 5, getSize: () => ({ width: 40, height: 60 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, bounds: new Float32Array([0, 0, 0, Math.hypot(size.w, size.h) * 0.5]) }; batches.push(b); return b; },
    destroyBillboardBatch: (b) => destroyed.push(b),
  };
  const c = createGateCourt({
    renderer, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, p, o]), play3dId: (id, p, v, o) => sounds.push(['id', id, p, o]) },
    getTexture: async () => (sprite ? tex : null), uploadRecordFrame: (a, r, f) => uploads.push([a, r, f]),
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20),
    feet: () => (feet ? courtToDungeon(feet[0], 0, feet[2]) : null), player: () => me, save: () => save,
    strike: (dmg, how) => { struck.push([dmg, how]); me.health -= dmg; }, say: (t) => said.push(t),
  });
  return { c, link, clock, struck, said, sounds, uploads, batches, destroyed, me, tex };
}
const tick = async (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); await new Promise((r) => setImmediate(r)); };

test('WB4 the court\'s driver, the strikes: each attack judged once against my feet at its landing - struck for its share of my own health, fire through my throw, a full resist said in words; nothing lands on the dead or the absent; the Wrath lands by its own word when it overtakes its attack (mutants: an attack judged twice; the throw skipped; the Wrath\'s word ignored)', async () => {
  destroyGateBossBar();
  const h = court({ feet: [1, 0, 1], maxHealth: 200, health: 200, save: 50 });
  const slam = W('slam', { i: 5 });
  await tick(h, 9000, state({ atk: slam }));
  assert.equal(h.struck.length, 0, 'nothing before the landing');
  await tick(h, 10005);
  assert.deepEqual(h.struck, [[90, { fire: false, name: 'Ground Slam' }]], 'WBX4: 40% of my 200, and its 10');
  await tick(h, 10050); await tick(h, 10100);
  assert.equal(h.struck.length, 1, 'judged once');
  const nova = W('nova', { i: 6, at: 12001 });
  await tick(h, 12000, state({ atk: nova, phase: 2 }));
  await tick(h, 12001);
  assert.equal(h.struck.length, 1, 'safe at his feet - the nova\'s ring passes me');
  const hf = W('hellfire', { i: 7, at: 13001, tg: [[1, 1]] });
  await tick(h, 13000, state({ atk: hf, phase: 2 }));
  await tick(h, 13001);
  assert.deepEqual(h.struck[1], [33, { fire: true, name: 'Hellfire' }], 'WBX4: 30% of 200 and its 6, halved by my throw');
  const r = court({ feet: [1, 0, 1], save: 0 });
  await tick(r, 13000, state({ atk: hf, phase: 2 })); await tick(r, 13001);
  assert.deepEqual(r.struck, []); assert.deepEqual(r.said, [COURT_STRIKE_TEXT.resisted('Hellfire')]);
  const dead = court({ health: 0 });
  await tick(dead, 9000, state({ atk: slam })); await tick(dead, 10001);
  assert.deepEqual(dead.struck, [], 'the dead take nothing');
  const away = court({ feet: null });
  await tick(away, 9000, state({ atk: slam })); await tick(away, 10001);
  assert.deepEqual(away.struck, []);
  // the Wrath: its word overtakes its attack on this screen - it lands all the same, and once
  const w = court({ feet: [0, 0, 0], save: 0 });
  const wrath = W('wrath', { i: 9, at: 60000 });
  await tick(w, 57000, state({ atk: wrath }));
  await tick(w, 59990, state({ atk: null, wrath: 59990 }));
  assert.equal(w.struck.length, 1, 'the Wrath lands through nothing - no throw answers it');
  assert.ok(w.struck[0][0] >= 999);
  await tick(w, 60010);
  assert.equal(w.struck.length, 1, 'once');
  const w2 = court({ feet: [0, 0, 0] });
  await tick(w2, 57000, state({ atk: wrath })); await tick(w2, 60001);
  await tick(w2, 60300, state({ atk: null, wrath: 60000 }));
  assert.equal(w2.struck.length, 1, 'landed at its own moment, not again at its word');
  destroyGateBossBar();
});

test('WB4 the court\'s driver, the voice and the body: the wind-up cued at the word and the landing at the landing, once each; a roar for a phase crossed, never for the phase first heard; the body three times the sprite\'s size where the relay says he stands, its cull sphere with it, hidden when he is gone; put away out of the court (mutants: the landing cued twice; the roar on first sight; the body at the sprite\'s own size)', async () => {
  destroyGateBossBar();
  const h = court();
  const slam = W('slam', { i: 5, x: 4, z: -2 });
  await tick(h, 9000, state({ atk: slam, x: 4, z: -2, phase: 2 }));
  assert.deepEqual(h.sounds.map((s) => s[1]), [BOSS_CUES.windup.slam.clip], 'the word\'s cue; no roar for the phase first heard');
  assert.deepEqual(h.sounds[0][2], courtToDungeon(4, 2.5, -2), 'at him');
  assert.equal(h.sounds[0][3].pitch, BOSS_CUES.windup.slam.pitch);
  await tick(h, 9500);
  assert.equal(h.sounds.length, 1, 'once');
  await tick(h, 10001);
  assert.deepEqual(h.sounds.map((s) => s[1]), [BOSS_CUES.windup.slam.clip, BOSS_CUES.land.slam.clip, BOSS_CUES.quake.clip], 'WB7: and the ground\'s shock under a slam');
  await tick(h, 10100);
  assert.equal(h.sounds.length, 3, 'the landing once');
  await tick(h, 11000, state({ atk: null, x: 4, z: -2, phase: 3, shieldUntil: 14000 }));
  assert.equal(h.sounds.at(-1)[1], BOSS_CUES.roar.clip, 'the roar of a phase crossed');
  const hf = W('hellfire', { i: 8, at: 21000, tg: [[1, 1], [-5, 6]] });
  await tick(h, 20000, state({ atk: hf, phase: 3 }));
  await tick(h, 21001);
  assert.deepEqual(h.sounds.filter((s) => s[0] === 'id').map((s) => s[1]), [FIRE_CAST_ID], 'the fire\'s cast by its ID');
  assert.deepEqual(h.sounds.slice(-2).map((s) => [s[1], s[2]]), [[BURNING, courtToDungeon(1, 0.5, 1)], [BURNING, courtToDungeon(-5, 0.5, 6)]], 'the burning under each target');
  await tick(h, 26000);
  const heard = h.sounds.length;
  await tick(h, 27000, state({ atk: W('slam', { i: 9, at: 26000 }), phase: 3 }));
  assert.equal(h.sounds.length, heard, 'an attack first heard after its landing is not cued at all - late words are not played');
  // the body
  assert.equal(h.batches.length, 1, 'one batch, made once');
  const b = h.batches[0];
  assert.equal(b.archive, 286);
  const own = mobileBillboardSize(h.tex, Number(String(b.record).split('#')[0]));
  assert.ok(own.h > 0);
  assert.ok(Math.abs(Math.abs(b.size.w) - own.w * 3) < 1e-9 && Math.abs(b.size.h - own.h * 3) < 1e-9, 'three times the sprite\'s own size');
  assert.ok(Math.abs(b.bounds[3] - Math.hypot(b.size.w, b.size.h) * 0.5) < 1e-6, 'the cull sphere follows the frame\'s own size');
  const [px, pz] = bossPlace(h.link.st, h.clock.t);
  assert.deepEqual(b.origin, courtToDungeon(px, 0, pz));
  assert.deepEqual(h.c.batches(), [b]);
  assert.ok(h.uploads.length >= 1 && h.uploads.every((u) => u[0] === 286));
  assert.equal(h.c.lights().length, 1, 'his glow');
  // the fall, then gone
  await tick(h, 30000, state({ fell: { at: 30000, top: ['Mac'], n: 3 } }));
  assert.equal(h.sounds.at(-1)[1], BOSS_CUES.fall.clip);
  await tick(h, 30000 + FALL_MS);
  assert.deepEqual(h.c.batches(), [], 'gone');
  assert.deepEqual(h.c.lights(), []);
  // out of the court
  await tick(h, 40000, GATE_STATE_EMPTY);
  assert.deepEqual(h.destroyed, [b], 'put away');
  assert.equal(h.c.state().day, null);
  const none = court({ sprite: false });
  await tick(none, 9000, state({ atk: slam }));
  await tick(none, 9100);
  assert.equal(none.batches.length, 0, 'no sprite, no body - and the fight goes on');
  destroyGateBossBar();
});

test('WB4 the seams, by source: the world host makes the court on the link, frames it with the gate\'s frame, draws its body with the peers, hands its glow and its telegraph to the dungeon arm, judges fire by the saving throw and lands a blow through the dungeon context\'s door; the dungeon arm lights and draws it in the court; the door has the three signs a foe\'s blow has (mutants: each seam removed)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const gateCourt = gateLink \? createGateCourt\(\{/);
  assert.match(w, /save: \(e\) => savingThrow\(ELEMENTS\.Fire, EFFECT_FLAGS\.Fire, e\),/);
  assert.match(w, /strike: \(dmg, how\) => modes\?\.dungeonCtx\?\.strikePlayer\?\.\(dmg, how\),/);
  assert.match(w, /feet: \(\) => \(playerSpawned && modes\?\.gateArenaDay\?\.\(\) != null \? player\.feetAt\(\) : null\),/);
  assert.match(w, /try \{ gateCourt\?\.frame\(\); \} catch/);
  assert.match(w, /extraBillboards: \(\) => \[[^\n]*\.\.\.\(gateCourt\?\.batches\(\) \?\? \[\]\)\],/);
  assert.match(w, /gateCourtLights: \(\) => gateCourt\?\.lights\(\) \?\? \[\],/);
  // WB6b: the telegraph's pass and the air's life share the hook - either drawn marks the seam, once
  assert.match(w, /const told = gateCourt\?\.drawPass\(proj, view, eye, [^\n]*\);\n[^\n]*\n[^\n]*\n\s+if \(told \|\| lived\) renderer\.markForeignPass\(\);/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /withCourtLights\(_dgLit, \[\.\.\.courtLights\(\), \.\.\.\(host\.gateCourtLights\?\.\(\) \?\? \[\]\)\]\)/);
  const bb = wm.indexOf('renderer.drawBillboards([...dungeonCtx.billboardBatches'), tg = wm.indexOf('if (isGateArena(dungeonLoc)) host.drawGateCourt?.({ proj, view, eye: mwv.eye });'), foes = wm.indexOf('dungeonCtx.drawFoes(dt, canvas');
  assert.ok(bb > 0 && tg > bb && tg < foes, 'the telegraph after the court and its billboards, before drawFoes\' screen quads end the world pass');
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /strikePlayer\(dmg, \{ fire = false \} = \{\}\) \{\n\s*if \(!\(dmg > 0\)\) return;\n\s*audio\.playOneShot\(fire \? SOUND\.Burning : hitSoundFor\(null\), PLAYER_HIT_VOLUME\);\n\s*hurtPlayer\(dmg\);\n\s*if \(!fire\) flashPlayerDamage\(dmg\);\n\s*playPlayerVoice\(audio, playerPainVoice\(playerEntity, dmg\)\);/);
});
