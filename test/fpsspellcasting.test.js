// THE CLASSIC SPELLCASTING HANDS (FPSSpellCasting.cs), pinned.
//
// The re-measurement found FPSSpellCasting.cs uncited anywhere in
// src/: its OnReleaseFrame semantics were ported and live (hostMagic's
// cast raises them), but the five ELEMENT hand animations classic
// draws when a spell fires had no port at all - combat/fpArm.js draws
// a spellcast in the MORROWIND lane only, so the 1:1 skin cast spells
// with nothing on screen.
//
// Pins here: WeaponBasics.GetMagicAnimFilename's five archives,
// PlayOneShot's one-shot refusal, the AnimateSpellCast coroutine's
// seven steps and its release frame, and the placement math - which is
// NOT the weapon's, because the hands lay out against a 300-wide
// surface where the weapon sprite uses 320.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NATIVE_SPELL_W, NATIVE_SPELL_H, RELEASE_FRAME, SMALL_FRAME_ADJUST, ANIM_SPEED,
  FRAME_INDICES, ELEMENT_TYPES, MAGIC_ANIM_FILE, magicAnimFilename,
  SpellCastAnim, fpsSpellCasting, spellHandRects, drawSpellCastHands, RIGHT_HAND_UV,
} from '../src/combat/fpsSpellCasting.js';
import { NATIVE_W, NATIVE_H } from '../src/combat/fpsWeapon.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = ARENA2 ? false : 'ARENA2_PATH not set';

test('fpsSpellCasting: GetMagicAnimFilename’s five archives, on the port’s element index', () => {
  // WeaponBasics.cs:187-204. The order is the port's classic element
  // index (systems/spellcast.js ELEMENTS, the same one missileArchive
  // walks 375..379 with) - fire, cold, poison, shock, magic.
  assert.deepEqual([...MAGIC_ANIM_FILE],
    ['FIRE00C6.CIF', 'FRST00C6.CIF', 'POIS00C6.CIF', 'SHOK00C6.CIF', 'MJIC00C6.CIF']);
  assert.equal(magicAnimFilename(ELEMENT_TYPES.Fire), 'FIRE00C6.CIF');
  assert.equal(magicAnimFilename(ELEMENT_TYPES.Cold), 'FRST00C6.CIF');
  assert.equal(magicAnimFilename(ELEMENT_TYPES.Poison), 'POIS00C6.CIF');
  assert.equal(magicAnimFilename(ELEMENT_TYPES.Shock), 'SHOK00C6.CIF');
  assert.equal(magicAnimFilename(ELEMENT_TYPES.Magic), 'MJIC00C6.CIF');
  // The default arm - "Unsupported element type." - is REACHABLE
  // (ElementTypes.None is a real settings value), and it answers null
  // here rather than throwing, so a spell with no element plays no
  // animation instead of taking the frame down.
  assert.equal(magicAnimFilename(undefined), null);
  assert.equal(magicAnimFilename(5), null);
  assert.equal(magicAnimFilename(-1), null);
});

test('fpsSpellCasting: the constants are FPSSpellCasting’s, and the surface is 300 wide', () => {
  // :44-50. The 300 is the whole reason this is not fpsWeapon's math:
  // the hands are scaled against a NARROWER design surface than the
  // weapon sprite, so they sit further in from the screen edges.
  assert.equal(NATIVE_SPELL_W, 300);
  assert.equal(NATIVE_SPELL_H, 200);
  assert.equal(NATIVE_W, 320, 'the WEAPON surface is 320 - the two differ, deliberately');
  assert.equal(NATIVE_H, NATIVE_SPELL_H, 'only the width differs');
  assert.equal(RELEASE_FRAME, 5);
  assert.equal(SMALL_FRAME_ADJUST, 0.134);
  assert.equal(ANIM_SPEED, 0.04);
  // "Animation starts and ends with frame 0" (:50).
  assert.deepEqual([...FRAME_INDICES], [0, 1, 2, 3, 4, 5, 0]);
  assert.equal(FRAME_INDICES.at(0), FRAME_INDICES.at(-1));
});

test('fpsSpellCasting: PlayOneShot is ONE shot - a second cast mid-animation is refused', () => {
  const a = new SpellCastAnim();
  assert.equal(a.isPlayingAnim, false, 'nothing plays until a cast');
  assert.equal(a.frameIndex, -1);
  assert.equal(a.playOneShot(ELEMENT_TYPES.Shock), true);
  assert.equal(a.isPlayingAnim, true);
  assert.equal(a.currentFrame, 0);
  assert.equal(a.element, ELEMENT_TYPES.Shock);
  // ":128 - Do nothing if already playing anim". The element does NOT
  // change either: a second cast cannot repaint the hands mid-motion.
  assert.equal(a.playOneShot(ELEMENT_TYPES.Fire), false);
  assert.equal(a.element, ELEMENT_TYPES.Shock);
  assert.equal(a.currentFrame, 0);
  // An element with no archive plays nothing at all.
  const b = new SpellCastAnim();
  assert.equal(b.playOneShot(undefined), false);
  assert.equal(b.isPlayingAnim, false);
});

test('fpsSpellCasting: AnimateSpellCast steps seven times at animSpeed and releases on frame 5', () => {
  const a = new SpellCastAnim();
  a.playOneShot(ELEMENT_TYPES.Magic);
  // The frame shown is frameIndices[currentFrame], and step 0 is the
  // small opening frame.
  assert.equal(a.frameIndex, 0);
  const seen = [a.frameIndex];
  const releases = [];
  for (let i = 0; i < 7; i++) {
    if (a.tick(ANIM_SPEED)) releases.push(i);
    seen.push(a.frameIndex);
  }
  // Six steps walk 1..5 and back to the closing 0; the seventh ends it.
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 0, -1]);
  // ":272-274 - Trigger cast frame when currentFrame == releaseFrame",
  // which is the step that lands on frameIndices[5] = 5.
  assert.deepEqual(releases, [4], 'the release is raised ONCE, on the step that reaches frame 5');
  assert.equal(a.isPlayingAnim, false, ':277-278 - past the last index the animation ends');
  // And a finished animation is inert: no more releases, ever.
  assert.equal(a.tick(ANIM_SPEED * 10), false);
  assert.equal(a.frameIndex, -1);
});

test('fpsSpellCasting: the clock is animSpeed, not the frame rate', () => {
  const a = new SpellCastAnim();
  a.playOneShot(ELEMENT_TYPES.Cold);
  // Half a period advances nothing...
  a.tick(ANIM_SPEED / 2);
  assert.equal(a.frameIndex, 0);
  // ...and the other half steps exactly once.
  a.tick(ANIM_SPEED / 2);
  assert.equal(a.frameIndex, 1);
  // A long frame CATCHES UP rather than dropping steps: a stall worth
  // three and a half periods advances three frames, which is what a
  // coroutine yielding WaitForSeconds does when the frame is late. A
  // one-step-per-call stepper would answer 2 here.
  a.tick(ANIM_SPEED * 3.5);
  assert.equal(a.frameIndex, 4);
  // The whole cast is seven steps from PlayOneShot - 0.28s at 0.04.
  const b = new SpellCastAnim();
  b.playOneShot(ELEMENT_TYPES.Cold);
  for (let i = 0; i < 6; i++) b.tick(ANIM_SPEED);
  assert.equal(b.isPlayingAnim, true, 'still playing one step short of the end');
  b.tick(ANIM_SPEED);
  assert.equal(b.isPlayingAnim, false);
});

test('fpsSpellCasting: UpdateSpellCast/AlignLeftHand/AlignRightHand, verbatim', () => {
  const canvas = { width: 600, height: 400 };   // exactly 2x the 300x200 surface
  const rec = { width: 60, height: 50 };
  // A WIDE frame: offsetWidth 0, so the left hand hugs x=0 and the
  // right hand's right edge hugs the far side.
  let r = spellHandRects(canvas, rec, { frameIndex: 1, element: ELEMENT_TYPES.Magic });
  assert.deepEqual(r.left, { x: 0, y: 300, w: 120, h: 100 });
  assert.deepEqual(r.right, { x: 480, y: 300, w: 120, h: 100 });
  // A SMALL frame (:220-223: "Frames 0 and 5 are always small
  // frames"): both hands move in by smallFrameAdjust of the SCREEN.
  for (const frameIndex of [0, 5]) {
    r = spellHandRects(canvas, rec, { frameIndex, element: ELEMENT_TYPES.Magic });
    assert.ok(Math.abs(r.left.x - 600 * SMALL_FRAME_ADJUST) < 1e-9, `frame ${frameIndex} left`);
    assert.ok(Math.abs(r.right.x - (600 * (1 - SMALL_FRAME_ADJUST) - 120)) < 1e-9, `frame ${frameIndex} right`);
  }
  // ":224 - Fire frame 4 is also a small frame", and ONLY fire's.
  r = spellHandRects(canvas, rec, { frameIndex: 4, element: ELEMENT_TYPES.Fire });
  assert.ok(Math.abs(r.left.x - 600 * SMALL_FRAME_ADJUST) < 1e-9, 'fire frame 4 is small');
  for (const element of [ELEMENT_TYPES.Cold, ELEMENT_TYPES.Poison, ELEMENT_TYPES.Shock, ELEMENT_TYPES.Magic]) {
    r = spellHandRects(canvas, rec, { frameIndex: 4, element });
    assert.equal(r.left.x, 0, `element ${element} frame 4 is a WIDE frame`);
  }
  // The bottom anchor rides the large HUD's weapon offset (:88-95,
  // "Same logic as in FPSWeapon").
  r = spellHandRects(canvas, rec, { frameIndex: 1, element: ELEMENT_TYPES.Magic, offsetHeight: 40 });
  assert.equal(r.left.y, 260);
  assert.equal(r.right.y, 260);
  // The scale is the 300-wide surface's. A 320 here would give 1.875.
  const wide = spellHandRects({ width: 320, height: 200 }, { width: 300, height: 200 },
    { frameIndex: 1, element: ELEMENT_TYPES.Magic });
  assert.ok(Math.abs(wide.left.w - 320) < 1e-9, '300 units of art fill a 320-wide canvas exactly');
});

test('fpsSpellCasting: OnGUI draws BOTH hands from one record, the right one mirrored', () => {
  const calls = [];
  const renderer = { drawScreenQuad: (tex, dst, src) => calls.push({ tex, dst, src }) };
  const canvas = { width: 600, height: 400 };
  const art = {
    element: ELEMENT_TYPES.Fire,
    records: [
      { width: 40, height: 30, tex: 'r0' }, { width: 60, height: 50, tex: 'r1' },
      { width: 60, height: 50, tex: 'r2' }, { width: 60, height: 50, tex: 'r3' },
      { width: 40, height: 30, tex: 'r4' }, { width: 40, height: 30, tex: 'r5' },
    ],
  };
  assert.equal(drawSpellCastHands(renderer, canvas, art, 1, { offsetHeight: 0 }), true);
  assert.equal(calls.length, 2, 'two hands, one record - :115-116');
  assert.equal(calls[0].tex, 'r1');
  assert.equal(calls[1].tex, 'r1', 'the SAME texture, drawn twice');
  // leftHandAnimRect = Rect(0,0,1,1) - the identity, so no src at all;
  // rightHandAnimRect = Rect(1,0,-1,1) - u runs 1 -> 0 (:209-210).
  assert.equal(calls[0].src, undefined);
  assert.deepEqual(calls[1].src, { u0: 1, v0: 0, u1: 0, v1: 1 });
  assert.deepEqual({ ...RIGHT_HAND_UV }, { u0: 1, v0: 0, u1: 0, v1: 1 });
  // The two hands are apart, and the right one is the far side.
  assert.ok(calls[1].dst.x > calls[0].dst.x);
  // Nothing plays -> nothing draws. This is ReadyCheck's "Must have
  // current spell texture anims" and UpdateSpellCast's frame < 0.
  calls.length = 0;
  assert.equal(drawSpellCastHands(renderer, canvas, art, -1), false);
  assert.equal(drawSpellCastHands(renderer, canvas, null, 1), false);
  assert.equal(calls.length, 0);
});

// ── THE RIG, AND THE FOUR HOSTS ─────────────────────────────────────

const CANVAS = { clientWidth: 1000, clientHeight: 800, width: 1000, height: 800 };
const rig = (over = {}) => createWeaponRig({
  renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
  palette: null,   // spellArtFor answers null - the draw stays inert headlessly
  audio: { playOneShot() {} }, entity: { items: [] }, ...over,
});

test('fpsSpellCasting: the rig’s cast door starts the hands and its frame runs them', () => {
  fpsSpellCasting.currentFrame = -1;   // the singleton is shared - start clean
  const r = rig();
  // EntityEffectManager.CastReadySpell (:434) hands PlayOneShot the
  // readied spell's ElementType; castSpellAnim IS that call here.
  r.castSpellAnim(2, ELEMENT_TYPES.Shock);
  assert.equal(fpsSpellCasting.isPlayingAnim, true);
  assert.equal(fpsSpellCasting.element, ELEMENT_TYPES.Shock);
  assert.equal(fpsSpellCasting.frameIndex, 0);
  // The rig's own per-frame step is AnimateSpellCast's coroutine.
  r.frame(ANIM_SPEED);
  assert.equal(fpsSpellCasting.frameIndex, 1);
  for (let i = 0; i < 6; i++) r.frame(ANIM_SPEED);
  assert.equal(fpsSpellCasting.isPlayingAnim, false, 'seven steps end it, through the rig');
  // AND IT RUNS WHILE PARALYSED. FPSSpellCasting is its own component
  // in DFU - WeaponManager.ShowWeapons(false) never reached it - so a
  // cast already in flight finishes its motion.
  r.castSpellAnim(2, ELEMENT_TYPES.Fire);
  r.frame(ANIM_SPEED, { paralyzed: true });
  assert.equal(fpsSpellCasting.frameIndex, 1, 'paralysis does not freeze the casting hands');
  fpsSpellCasting.currentFrame = -1;
  // A spell with no element leaves the hands alone, and does not throw.
  r.castSpellAnim(2, undefined);
  assert.equal(fpsSpellCasting.isPlayingAnim, false);
});

test('fpsSpellCasting: WeaponManager.cs:247 - the weapon hides while the hands play', () => {
  // `HasReadySpell || PlayerSpellCasting.IsPlayingAnim`, BOTH legs.
  // DFU's own header: spellcasting animations "are never mixed with
  // weapons directly on screen at same time".
  const rigSrc = rd('src/combat/weaponRig.js');
  assert.match(rigSrc, /if \(spellArmed\(\) \|\| fpsSpellCasting\.isPlayingAnim\) v = false;\s+\/\/ HasReadySpell \/ IsPlayingAnim/);
  // And the hands are drawn OUTSIDE that gate, or a cast would show
  // nothing at all: the weapon's hidden and the hands would be too.
  const draw = rigSrc.slice(rigSrc.indexOf('    draw({ paralyzed = false } = {}) {'));
  const handsAt = draw.indexOf('drawSpellCastHands(');
  const gateAt = draw.indexOf('if (paralyzed || !shown()) return;');
  const spriteAt = draw.indexOf('drawFpsWeapon(');
  assert.ok(handsAt > 0 && gateAt > 0 && spriteAt > 0);
  assert.ok(handsAt < gateAt, 'the hands draw before the weapon’s show gate');
  assert.ok(handsAt < spriteAt, '"behind other HUD elements" (:113) - the hands go down first');
  // The Morrowind lane draws its OWN cast (MW-D39), so exactly one of
  // the two reaches the screen - the same one seam the sprite has.
  assert.match(draw, /if \(c && !fpArm\.active\(\)\) \{\n\s+drawSpellCastHands\(/);
  // ...and third person draws neither.
  assert.ok(draw.indexOf('if (fpArm.thirdActive()) return;') < handsAt,
    'the third-person gate stands above the hands too');
});

test('fpsSpellCasting: every host that draws the FPS weapon gets the hands', () => {
  // The four hosts, and how each one reaches the animation. Three
  // raise the cast moment themselves; the interior host shares its
  // parent's cast engine, which is why the animation is a SINGLETON.
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = rd(host);
    const at = h.indexOf('startCastAnim');
    assert.ok(at > 0, `${host} raises no cast moment`);
    assert.match(h.slice(at, at + 300), /castSpellAnim\??\.?\(sp\?\.rangeType, sp\?\.element, onRelease\)/,
      `${host} does not hand the cast its ELEMENT`);
  }
  // All four DRAW through the one rig, which is why the draw wiring is
  // in one file: every host that mounts a weapon rig gets the hands.
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/world.js',
    'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    const h = rd(host);
    assert.match(h, /createWeaponRig\(\{/, `${host} mounts no weapon rig`);
    assert.match(h, /\.draw\(\{ paralyzed/, `${host} never draws its rig`);
  }
  // The interior host says WHY it starts none of its own.
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /THE FOURTH HOST AND THE SPELLCASTING HANDS/);
  assert.ok(!/castSpellAnim/.test(wm),
    'the interior mode has no cast engine of its own - a second door here would be a second animation');
});

test('fpsSpellCasting: the five spell archives satisfy the animation on real data', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  for (const fileName of MAGIC_ANIM_FILE) {
    const path = join(ARENA2, fileName);
    assert.ok(existsSync(path), `${fileName} present in ARENA2`);
    const cif = new CifRciFile();
    assert.ok(cif.load(new Uint8Array(readFileSync(path)), fileName, pal), `${fileName} loads`);
    // frameIndices reaches record 5, so six records must exist...
    assert.ok(cif.recordCount > Math.max(...FRAME_INDICES),
      `${fileName} carries the ${Math.max(...FRAME_INDICES) + 1} records the animation walks (has ${cif.recordCount})`);
    for (const record of new Set(FRAME_INDICES)) {
      // ..."spells have a single frame per record unlike weapons" (:174).
      assert.equal(cif.getFrameCount(record), 1, `${fileName} r${record} is a single frame`);
      const size = cif.getSize(record);
      assert.ok(size.width > 0 && size.height > 0 && size.width <= 320 && size.height <= 200,
        `${fileName} r${record} fits the fixed 320x200 display (:227)`);
    }
    // The small-frame rule is a claim ABOUT THE ART: records 0 and 5
    // are narrower than the wide middle of the animation, which is why
    // they are pushed in. Fire's record 4 is narrow too.
    const w = (r) => cif.getSize(r).width;
    assert.ok(w(0) < w(2) && w(5) < w(2), `${fileName} r0/r5 really are the small frames`);
    if (fileName === MAGIC_ANIM_FILE[ELEMENT_TYPES.Fire]) {
      assert.ok(w(4) < w(2), 'FIRE00C6 r4 is a small frame too (:224)');
    }
  }
});
