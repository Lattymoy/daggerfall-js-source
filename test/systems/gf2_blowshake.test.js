// GATHER-FEEL II - BLOW-SHAKE (2026-10-13, Mac: "Do the not done" - GATHER-FEEL's open "a blow shakes no camera";
// bible/06-Systems/Professions-Arc.md section 45): A LANDED BLOW MOVES THE VIEW. The table (systems/gatherBlow.js
// GATHER_BLOW_FEEL) under every technique's hit; its gates (the enhanced skin, the player's technique motion, the
// system's reduced motion); the springs' one door (combat/technique/techniqueFx.js kickFx) - the peaks the table names, the
// technique's own moments through it still; the clean blow off the real machines (landedBlow); and the host over the real
// kinds (scenes/gatherHost.js stepAct) - the kick on the frame the ear clacks, never at the press, nothing for a blow
// Escape took or an act that swings nothing, the last blow's too.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATHER_BLOW_FEEL, gatherBlowFeel, landedBlow } from '../../src/systems/gatherBlow.js';
import { TECH_FX, kickFx, techniqueCue, stepTechniqueFx, techniqueView, techniqueHands, resetTechniqueFx } from '../../src/combat/technique/techniqueFx.js';
import { createChopAct } from '../../src/systems/chopAct.js';
import { createMineAct, MINE_POINTS } from '../../src/systems/mineAct.js';
import { CHOP_ACT, MINE_ACT } from '../../src/net/professionLaw.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { PX, rig, arrive, strikeOut, lands, sfxOf, tick, dice } from '../gatherRig.mjs';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const DEG = Math.PI / 180;
const ON = { enhanced: () => true, reduced: () => false, motion: () => 1 };

test('GF2-BLOWSHAKE B1: the table - an axe\'s and a pick\'s blow, plain and clean, each a dip of the look, the eye and the hands, the clean one deeper on every channel, the pick\'s deeper than the axe\'s; no roll, no lens, no shake; every dip under the least any technique\'s hit dips its channel (mutants: a blow that looks up, a clean one no deeper, a shake on a tool)', () => {
  assert.deepEqual(Object.keys(GATHER_BLOW_FEEL).sort(), ['chop', 'mine']);
  // PIN MOVED (AUDIT GATHER-FEEL F5/R1): every channel against the least a technique's hit moves it - the hands alone were
  // read, and three of the look's dips stood at or past cleave's; and the table's own numbers (a row at a tenth passed)
  const least = (read) => Math.min(...Object.values(TECH_FX).map((t) => read(t.hit ?? {})).filter((v) => v > 0));
  const lightest = least((h) => h.hands?.y ?? 0), look = least((h) => -(h.cam?.pitch ?? 0)), eye = least((h) => -(h.cam?.eye ?? 0));
  assert.deepEqual([lightest, look, eye], [0.04, 0.8, 0.06], 'the whirlwind\'s hands, cleave\'s look, execute\'s eye');
  assert.deepEqual(JSON.parse(JSON.stringify(GATHER_BLOW_FEEL)), {
    chop: { plain: { cam: { pitch: -0.45, eye: -0.012 }, hands: { y: 0.022 } }, clean: { cam: { pitch: -0.65, eye: -0.018 }, hands: { y: 0.03 } } },
    mine: { plain: { cam: { pitch: -0.5, eye: -0.014 }, hands: { y: 0.025 } }, clean: { cam: { pitch: -0.7, eye: -0.02 }, hands: { y: 0.034 } } },
  }, 'the record\'s table');
  for (const [kind, rows] of Object.entries(GATHER_BLOW_FEEL)) {
    assert.deepEqual(Object.keys(rows).sort(), ['clean', 'plain'], kind);
    for (const [k, r] of Object.entries(rows)) {
      assert.deepEqual(Object.keys(r).sort(), ['cam', 'hands'], `${kind} ${k}: no shake, no burst, no sound`);
      assert.deepEqual(Object.keys(r.cam).sort(), ['eye', 'pitch'], `${kind} ${k}: no roll, no lens`);
      assert.ok(r.cam.pitch < 0 && r.cam.eye < 0 && r.hands.y > 0, `${kind} ${k}: down, every channel`);
      assert.ok(r.hands.y < lightest && -r.cam.pitch < look && -r.cam.eye < eye, `${kind} ${k}: under every technique's hit, on every channel`);
    }
    assert.ok(rows.clean.cam.pitch < rows.plain.cam.pitch && rows.clean.cam.eye < rows.plain.cam.eye && rows.clean.hands.y > rows.plain.hands.y, `${kind}: the clean blow deeper`);
  }
  for (const k of ['plain', 'clean']) {
    const a = GATHER_BLOW_FEEL.chop[k], p = GATHER_BLOW_FEEL.mine[k];
    assert.ok(p.cam.pitch < a.cam.pitch && p.cam.eye < a.cam.eye && p.hands.y > a.hands.y, `${k}: the pick's heavier head`);
  }
});

test('GF2-BLOWSHAKE B2: the gates - the row kicked at the player\'s own technique motion; nothing on the classic skin, under reduced motion, at Off, or for an act that swings nothing (mutants: the skin unread, reduced motion unread, the motion unscaled, the clean row crossed)', () => {
  const kicks = [];
  const kick = (cam, hands, m) => kicks.push({ cam, hands, m });
  for (const kind of ['chop', 'mine']) {
    for (const clean of [false, true]) {
      kicks.length = 0;
      assert.equal(gatherBlowFeel(kind, clean, { ...ON, kick }), true);
      const row = GATHER_BLOW_FEEL[kind][clean ? 'clean' : 'plain'];
      assert.deepEqual(kicks, [{ cam: row.cam, hands: row.hands, m: 1 }], `${kind} ${clean}`);
    }
  }
  kicks.length = 0;
  assert.equal(gatherBlowFeel('mine', false, { ...ON, motion: () => 0.5, kick }), true);
  assert.equal(kicks[0].m, 0.5, 'the motion scales it');
  kicks.length = 0;
  assert.equal(gatherBlowFeel('mine', true, { ...ON, enhanced: () => false, kick }), false, 'the classic skin: DFU moves no camera for a blow');
  assert.equal(gatherBlowFeel('mine', true, { ...ON, reduced: () => true, kick }), false, 'reduced motion: none');
  assert.equal(gatherBlowFeel('mine', true, { ...ON, motion: () => 0, kick }), false, 'Off: none');
  for (const kind of ['hand', 'steady', 'basket', 'trace', 'fish', null]) assert.equal(gatherBlowFeel(kind, false, { ...ON, kick }), false, `${kind}: swings nothing`);
  assert.equal(kicks.length, 0);
});

test('GF2-BLOWSHAKE B3: the springs\' one door - a blow peaks at the table\'s own numbers (the look, the eye, the hands; no roll, no lens), half at half motion, and settles; a technique\'s moment comes through the same door, its roll mirrored once (mutants: the kick\'s degrees unconverted, the door skipped)', () => {
  const peaks = (fn) => {
    resetTechniqueFx();
    fn();
    const p = { pitch: 0, eye: 0, hands: 0, roll: 0, fov: 0 };
    for (let i = 0; i < 600; i++) {
      stepTechniqueFx(0.001);
      const v = techniqueView();
      p.pitch = Math.min(p.pitch, v.pitch); p.eye = Math.min(p.eye, v.eye[1]); p.hands = Math.max(p.hands, techniqueHands().y);
      p.roll = Math.max(p.roll, Math.abs(v.roll)); p.fov = Math.max(p.fov, Math.abs(v.fov));
    }
    return p;
  };
  const row = GATHER_BLOW_FEEL.mine.clean;
  const p = peaks(() => assert.equal(gatherBlowFeel('mine', true, ON), true));
  assert.ok(Math.abs(p.pitch - row.cam.pitch * DEG) < Math.abs(row.cam.pitch * DEG) * 0.01, `the look ${p.pitch}`);
  assert.ok(Math.abs(p.eye - row.cam.eye) < Math.abs(row.cam.eye) * 0.01, `the eye ${p.eye}`);
  assert.ok(Math.abs(p.hands - row.hands.y) < row.hands.y * 0.01, `the hands ${p.hands}`);
  assert.equal(p.roll, 0); assert.equal(p.fov, 0);
  for (let i = 0; i < 1500; i++) stepTechniqueFx(0.001);
  assert.equal(techniqueView().pitch, 0, 'settled, put to rest exactly');
  const half = peaks(() => gatherBlowFeel('mine', true, { ...ON, motion: () => 0.5 }));
  assert.ok(Math.abs(half.pitch - p.pitch / 2) < Math.abs(p.pitch) * 0.01);
  // the technique's moments through the same door: Cleave's hit leans the screen right (its roll mirrored, once)
  const viaCue = peaks(() => techniqueCue('cleave', 'hit'));
  const viaDoor = peaks(() => kickFx(TECH_FX.cleave.hit.cam, TECH_FX.cleave.hit.hands, 1));
  assert.deepEqual(viaCue, viaDoor);
  resetTechniqueFx();
  techniqueCue('cleave', 'hit');
  for (let i = 0; i < 60; i++) stepTechniqueFx(0.001);
  assert.ok(techniqueView().roll < 0, 'the camera\'s own roll negated: the screen leans right');
  resetTechniqueFx();
  const fx = src('src/combat/technique/techniqueFx.js');
  assert.equal(fx.match(/-\(c\.roll \?\? 0\)/g)?.length, 1, 'the mirror said once');
  assert.match(fx, /kickFx\(row\.cam, row\.hands, m\);/, 'techniqueCue kicks through the door');
});

test('GF2-BLOWSHAKE B4: the clean blow off the real machines - a Clean Cut and a strike on the glint are clean, a plain chop and a plain strike not, and an act that swings nothing has no blow (mutants: the glint read as plain, the Clean Cut as plain)', () => {
  const chop = createChopAct({ tier: 1 });
  chop.tick(CHOP_ACT.ringS, {});   // the ring on the notch: in the band
  assert.equal(chop.inBand, true);
  chop.tick(0.0001, { attack: true });
  assert.deepEqual(landedBlow(chop.state), { kind: 'chop', clean: true });
  const plainChop = createChopAct({ tier: 1 });
  plainChop.tick(0.0001, { attack: true });
  assert.equal(plainChop.state.last, 'plain');
  assert.deepEqual(landedBlow(plainChop.state), { kind: 'chop', clean: false });
  const mine = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });   // the glint on MINE_POINTS[0] (a constant roll would never move it on)
  mine.tick(0.0001, { attack: true, aim: { yaw: MINE_POINTS[0][0], pitch: MINE_POINTS[0][1] } });
  assert.deepEqual(landedBlow(mine.state), { kind: 'mine', clean: true });
  const off = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  off.tick(0.0001, { attack: true, aim: { yaw: 20, pitch: 20 } });
  assert.deepEqual(landedBlow(off.state), { kind: 'mine', clean: false });
  assert.deepEqual(landedBlow({ kind: 'hand', last: null }), { kind: 'hand', clean: false });
  assert.deepEqual(landedBlow(null), { kind: null, clean: false });
  assert.ok(CHOP_ACT.swingS > 0 && MINE_ACT.swingS > 0);
});

test('GF2-BLOWSHAKE B5: through the host - a strike moves the view on the frame its blow lands, with the ear\'s clack (never at the press); a strike on the glint the clean one, its clip the ore\'s ring; every blow to the last - the one the act ended on lands its kick through the follow-through (mutants: the kick at the press, the follow\'s blow unstepped)', async () => {
  try {
    const spy = { calls: [] };
    const t = await rig({ feel: (kind, clean) => { spy.calls.push({ kind, clean, shots: t.audio.shots.length }); return true; } });
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    assert.ok(v);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    assert.equal(spy.calls.length, 0, 'not at the press');
    t.host.tick(lands - 0.02);
    assert.equal(spy.calls.length, 0, 'not before it lands');
    const before = t.audio.shots.length;
    t.host.tick(0.03);
    assert.equal(spy.calls.length, 1, 'on the frame it lands');
    assert.equal(spy.calls[0].kind, 'mine');
    const clack = t.audio.shots.slice(before).find((s) => /gather:pick/.test(s.key));
    assert.ok(clack, 'the clack the same frame');
    assert.equal(spy.calls[0].clean, sfxOf(clack.key) === 'pickGlint', 'the clean one the glint\'s');
    t.host.cancel();
    // the rest of a vein, to its end: one kick a blow, each with its clack, the last through the follow-through
    const calls2 = [];
    const t2 = await rig({ feel: (kind, clean) => { calls2.push({ kind, clean }); return true; } });
    const v2 = t2.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t2, v2);
    strikeOut(t2, v2);
    const struck = () => t2.audio.shots.filter((s) => /gather:pick/.test(s.key));
    assert.equal(calls2.length, struck().length, 'every blow but the last landed, each kicked with its clack');
    t2.host.tick(lands + 0.01);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(calls2.length, struck().length, 'the last blow too, through the follow-through');
    assert.ok(calls2.length >= 2);
    assert.deepEqual(calls2.map((c) => c.clean), struck().map((s) => sfxOf(s.key) === 'pickGlint'), 'each kick the blow its clip says');
    t.host.dispose(); t2.host.dispose();
  } finally { setForagingHost(null); }
});

test('GF2-BLOWSHAKE B6: through the host - Escape mid-swing takes its blow with the hand (no kick); a patch\'s act swings nothing (no kick); a tree\'s chop lands as the axe\'s (mutants: a cancelled act stepped on, the herb kicked)', async () => {
  try {
    const calls = [];
    const t = await rig({ feel: (kind, clean) => { calls.push({ kind, clean }); return true; } });
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    assert.equal(t.host.cancel(), true, 'Escape, the blow in the air');
    t.host.tick(MINE_ACT.swingS);
    assert.equal(calls.length, 0, 'the blow went with the hand');
    // a patch: the hand's act swings nothing
    // AUDIT GATHER-FEEL R16: asserted, never guarded - a guard that stopped running would pass silently
    const patch = t.host.nodesOf(PX, 150).find((n) => n.kind === 'herb' && n.tier === 1);
    assert.ok(patch, 'a tier-1 patch');
    await arrive(t, patch);
    t.face(patch);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true, 'the herb\'s act');
    for (let i = 0; i < 40 && t.host.acting(); i++) t.host.tick(0.05);
    assert.equal(t.host.acting(), false, 'pulled');
    assert.equal(calls.length, 0, 'a herb swings nothing');
    // a tree: the axe's blow
    const tree = t.host.nodesOf(PX, 150).find((n) => n.kind === 'tree');
    assert.ok(tree, 'a tree');
    await arrive(t, tree);
    t.face(tree);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    t.host.tick(CHOP_ACT.swingS);
    assert.deepEqual(calls.map((c) => c.kind), ['chop'], 'the axe\'s');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GF2-BLOWSHAKE B7: the seams - the host steps its machines through stepAct alone and feels a landed blow by default through gatherBlowFeel; the springs are the view\'s, never the look the glint is aimed with; the player\'s setting names the tool\'s blow (mutants: a machine ticked behind stepAct\'s back, the default feel dropped)', () => {
  const host = src('src/scenes/gatherHost.js');
  assert.equal(host.match(/\.act\.tick\(/g)?.length, 1, 'one tick: stepAct\'s');
  assert.match(host, /function stepAct\(a, dt, input\) \{\n\s+const was = a\.act\.state\?\.landed \| 0;\n\s+a\.act\.tick\(dt, input\);/);   // PIN MOVED (AUDIT GATHER-FEEL LANDING): a blow landed is the machine's count
  assert.match(host, /const feel = deps\.feel \?\? gatherBlowFeel;/);
  const blow = src('src/systems/gatherBlow.js');
  assert.match(blow, /import \{ kickFx, techniqueMotion \} from '\.\.\/combat\/technique\/techniqueFx\.js';/, 'the springs\' one door');
  assert.doesNotMatch(blow, /\b(cam|camera|view)\.(pitch|yaw)\s*[-+*/]?=/, 'no camera written: the springs are folded into the view by every host (player/climb/climbFeel.js)');
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  // PIN MOVED (AUDIT GATHER-FEEL F8): the note says what a blow does, and where - a dip, never a shake or a tilt, on the Enhanced skin alone
  assert.match(menu, /choiceRow\('techniqueMotion', 'Technique camera motion',\n\s+'How much a weapon technique shakes and tilts the view and dips your hands\. On the Enhanced skin, it also sets how far your hands dip when you gather\.',/);
});

test('GF2-BLOWSHAKE B8: a blow\'s answer never stops an act - a feel that throws, and the vein is struck out and goes as its last blow lands all the same (mutant: the throw let through)', async () => {
  try {
    let thrown = 0;
    const t = await rig({ feel: () => { thrown++; throw new Error('the view would not move'); } });
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    const drawn = t.centers();
    strikeOut(t, v);
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 4; i++) await tick();
    assert.ok(thrown >= 2, 'every blow asked');
    assert.equal(t.centers(), drawn - 3, 'the vein went as its last blow landed');
    t.host.dispose();
  } finally { setForagingHost(null); }
});
