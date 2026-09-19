// SW1 - SHIELD WIDGET 1.6, RedRoryOTheGlen, ported 1:1 off the shipped
// DLL's IL (bible/05-Combat/Shield-Widget.md). These pin the arithmetic
// the IL states, the four bugs kept bug for bug, and the gate ladder -
// the part of the mod a reader is most likely to "tidy" into something
// that is no longer the mod.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

import {
  createShieldWidget, readShieldWidgetSettings, shieldTextureIndex, shieldTextureName,
  shieldArchiveBase, shieldMaterialOffset, shieldConditionOffset, shieldAnimationGroup,
  isPartShielded, SHIELD_TEMPLATES, SHIELD_POSE, ANIM_DIRECTION, SHIELD_RECOIL_CONDITION,
  SHIELD_TEXTURE_COUNT, PARRY_CLIP_FIRST, PARRY_CLIP_COUNT,
} from '../src/combat/shieldWidget.js';

const RAW = {
  Enabled: true, 'Shield.OffsetHorizontal': 0.5, 'Shield.OffsetVertical': 0.5, 'Shield.Scale': 1,
  'Shield.Speed': 1, 'Shield.WhenSheathed': 1, 'Shield.WhenAttacking': 1, 'Shield.WhenCasting': 1,
  'Shield.LockAspectRatio': true, 'Shield.ConditionThresholdUpper': 75, 'Shield.ConditionThresholdLower': 25,
  'Modules.Bob': true, 'Modules.Inertia': false, 'Modules.Animation': false, 'Modules.Step': false, 'Modules.Recoil': false,
  'Bob.Length': 100, 'Bob.Offset': 0, 'Bob.SizeX': 1, 'Bob.SizeY': 1, 'Bob.SpeedMove': 1, 'Bob.SpeedState': 1,
  'Bob.Shape': 0, 'Bob.BobWhileIdle': true,
  'Inertia.Scale': 1, 'Inertia.Speed': 1, 'Inertia.ForwardDepth': 1, 'Inertia.ForwardSpeed': 1,
  'Animation.Speed': 1, 'Animation.Direction': 0, 'Step.Length': 1, 'Step.Condition': 0,
  'Recoil.Scale': 1, 'Recoil.Offset': false, 'Recoil.Speed': 1, 'Recoil.Condition': 2,
  'Compatibility.TextureScaleFactor': 1,
};
const settingsOf = (over = {}) => () => readShieldWidgetSettings(() => ({ ...RAW, ...over }));
const SHIELD = { templateIndex: SHIELD_TEMPLATES.Kite, nativeMaterialValue: 513, conditionPercentage: 100, isShield: true };

function rig(over = {}, deps = {}) {
  const sounds = [];
  const widget = createShieldWidget({
    settings: settingsOf(over),
    textures: { size: () => ({ width: 100, height: 100 }) },
    audio: { playOneShot: (clip, vol, pitch) => sounds.push({ clip, vol, pitch }) },
    rolls: () => 0.5, handedness: () => false, ...deps,
  });
  return { widget, sounds };
}
const frame = (o = {}) => ({
  dt: 1 / 60, time: 0, screenRect: { x: 0, y: 0, width: 640, height: 400 }, largeHudHeight: 0,
  item: SHIELD, attacking: false, sheathed: false, castingAnim: false, hasReadySpell: false,
  equipCountdownLeftHand: 0, isClimbing: false, isPaused: false, loadInProgress: false,
  entity: { stats: { speed: 50 } },   // LiveSpeed drives both the ease and the animation clock
  motor: { speed: 0, baseSpeed: 3, isGrounded: true, isCrouching: false, isRiding: false, isStandingStill: true, moveDirectionLocal: [0, 0, 0] },
  look: { x: 0, y: 0, cursorActive: false, swingAction: false }, ...o,
});
const settle = (widget, o = {}, n = 200) => { for (let i = 0; i < n; i++) widget.lateUpdate(frame(o)); };

test('SW1: the sheet index is archive x 150 + record x 5 + frame, and a record is a material group plus a condition tier', () => {
  // the four templates' bases (UpdateShieldTextures IL 0x15)
  assert.equal(shieldArchiveBase(SHIELD_TEMPLATES.Buckler), 0);
  assert.equal(shieldArchiveBase(SHIELD_TEMPLATES.Round), 150);
  assert.equal(shieldArchiveBase(SHIELD_TEMPLATES.Kite), 300);
  assert.equal(shieldArchiveBase(SHIELD_TEMPLATES.Tower), 450);
  // a template that is not one of the four falls to the Buckler's block,
  // as the switch's own default does
  assert.equal(shieldArchiveBase(-1), 0);

  // the material table (IL 0x51), INCLUDING the author's silver
  assert.deepEqual([0, 256, 512, 513, 514, 515, 516, 517, 518, 519, 520, 521].map(shieldMaterialOffset),
    [0, 0, 5, 10, 0, 15, 20, 25, 30, 35, 40, 45]);
  // KEPT BUG FOR BUG: silver (514) lands on group 0 with leather and
  // chain, so a silver shield draws the leather art.
  assert.equal(shieldMaterialOffset(514), shieldMaterialOffset(0), 'silver shares leather’s group, as the mod has it');

  // the three tiers (IL 0xcf)
  assert.equal(shieldConditionOffset(100, 75, 25), 0);
  assert.equal(shieldConditionOffset(75, 75, 25), 50, 'at the upper threshold is already the worn art');
  assert.equal(shieldConditionOffset(26, 75, 25), 50);
  assert.equal(shieldConditionOffset(25, 75, 25), 100, 'at the lower threshold is already the battered art');

  // and the whole walk back out to archive/record/frame
  const i = shieldTextureIndex(SHIELD, 75, 25);
  assert.equal(i, 310);
  assert.deepEqual(shieldTextureName(i), { archive: 112362, record: 2, frame: 0 });
  assert.deepEqual(shieldTextureName(SHIELD_TEXTURE_COUNT - 1), { archive: 112363, record: 29, frame: 4 },
    'the last of the 600 is the Tower’s last record, last frame');
});

test('SW1: LoadSettings’ multipliers, and the INVERTED animation speed', () => {
  const s = readShieldWidgetSettings(() => RAW);
  assert.equal(s.offsetSpeed, 5000, 'Shield.Speed x5000');
  assert.equal(s.bobLength, 1, 'Bob.Length /100');
  assert.equal(s.bobSizeXMod, 2); assert.equal(s.bobSizeYMod, 2);
  assert.equal(s.moveSmoothSpeed, 4); assert.equal(s.bobSmoothSpeed, 500);
  assert.equal(s.inertiaScale, 500); assert.equal(s.inertiaSpeed, 500);
  assert.equal(s.inertiaForwardScale, 0.2); assert.equal(s.inertiaForwardSpeed, 0.2);
  assert.equal(s.recoilScale, 2); assert.equal(s.recoilSpeed, 0.5);
  // a BIGGER Animation.Speed is a SHORTER animation: `1 - v * 0.5`
  assert.equal(s.animationTime, 0.5);
  assert.equal(readShieldWidgetSettings(() => ({ ...RAW, 'Animation.Speed': 0 })).animationTime, 1);
  assert.equal(readShieldWidgetSettings(() => ({ ...RAW, 'Animation.Speed': 2 })).animationTime, 0);
  // TextureScaleFactor is floored at 1 - the mod's range opens at 0 and
  // a 0 would divide the sprite's size by nothing
  assert.equal(readShieldWidgetSettings(() => ({ ...RAW, 'Compatibility.TextureScaleFactor': 0 })).scaleTextureFactor, 1);
});

test('SW1: the guard rect is the settings’ own offsets, and the sprite scales off 320x200', () => {
  const { widget } = rig();
  settle(widget);
  // x = screenX + width * 0.5 * offsetX; y = bottom - height * 0.25 * offsetY
  assert.equal(widget.target.x, 640 * 0.5 * 0.5);
  assert.equal(widget.target.y, 400 - 400 * 0.25 * 0.5);
  // 100px sprite, scale 1, weaponScaleX = 640/320 = 2
  assert.equal(widget.target.width, 200);
  assert.equal(widget.target.height, 200, 'LockAspectRatio takes the X scale for Y');

  // without the lock, Y measures against 200
  const { widget: w2 } = rig({ 'Shield.LockAspectRatio': false });
  settle(w2);
  assert.equal(w2.target.height, 100 * (400 / 200));

  // left-handed mirrors the x about the screen's right edge
  const { widget: w3 } = rig({}, { handedness: () => true });
  settle(w3);
  assert.equal(w3.target.x, 640 - 640 * 0.5 * 0.5);
  assert.ok(w3.flipped);
});

test('SW1: the three away poses - Corner sits on the edge, Off-screen sits past it, Ready keeps the guard rect', () => {
  const corner = rig({ 'Shield.WhenSheathed': SHIELD_POSE.Corner });
  settle(corner.widget, { sheathed: true });
  assert.equal(corner.widget.target.x, 0, 'Corner: the screen’s own x');
  assert.equal(corner.widget.target.y, 400, 'Corner: the bottom, with no offset applied');

  const off = rig({ 'Shield.WhenSheathed': SHIELD_POSE.OffScreen });
  settle(off.widget, { sheathed: true });
  assert.equal(off.widget.target.x, -200, 'Off-screen: a full sprite width past the edge');
  assert.equal(off.widget.target.y, 400 + 200);

  // Ready (3) names no rect of its own, so the guard rect stands
  const ready = rig({ 'Shield.WhenSheathed': SHIELD_POSE.Ready });
  settle(ready.widget, { sheathed: true });
  assert.equal(ready.widget.target.x, 640 * 0.5 * 0.5);
  assert.ok(ready.widget.drawRect(), 'and Ready still draws');
});

test('SW1: the gate ladder - Hide hides, Off-screen still draws while it leaves, and each state yields in the IL’s order', () => {
  // without the Animation module: only Hide hides
  for (const [pose, shows] of [[SHIELD_POSE.Hide, false], [SHIELD_POSE.OffScreen, true], [SHIELD_POSE.Corner, true], [SHIELD_POSE.Ready, true]]) {
    const { widget } = rig({ 'Shield.WhenSheathed': pose });
    settle(widget, { sheathed: true });
    assert.equal(!!widget.drawRect(), shows, `sheathed, pose ${pose}`);
  }
  // attacking and casting have their own, and they are read from their
  // own settings rather than the sheathed one
  const a = rig({ 'Shield.WhenAttacking': SHIELD_POSE.Hide, 'Shield.WhenSheathed': SHIELD_POSE.Ready });
  settle(a.widget, { attacking: true });
  assert.equal(a.widget.drawRect(), null, 'attacking reads WhenAttacking');
  const c = rig({ 'Shield.WhenCasting': SHIELD_POSE.Hide, 'Shield.WhenSheathed': SHIELD_POSE.Ready });
  settle(c.widget, { hasReadySpell: true });
  assert.equal(c.widget.drawRect(), null, 'casting reads WhenCasting');

  // the four refusals that come before any of that
  for (const o of [{ equipCountdownLeftHand: 1 }, { isClimbing: true }, { isPaused: true }, { loadInProgress: true }]) {
    const { widget } = rig();
    settle(widget);                       // settle FIRST, then raise the gate
    widget.lateUpdate(frame(o));
    assert.equal(widget.drawRect(), null, `gated by ${Object.keys(o)[0]}`);
  }
  // no shield in the hand draws nothing, and forgets the template
  const { widget } = rig();
  settle(widget);
  widget.lateUpdate(frame({ item: null }));
  assert.equal(widget.drawRect(), null);
  assert.equal(widget._w.lastTemplate, -1, 'the next shield re-reads the sheet');
  // third person draws nothing (Eye of the Beholder's onToggleOffset)
  const eye = rig();
  settle(eye.widget);
  eye.widget.setThirdPerson(true);
  assert.equal(eye.widget.drawRect(), null);
});

test('SW1: with the Animation module a leaving sprite still draws, because `animating` holds it on screen', () => {
  // the raise plays on an AWAY pose: Hide and Ready call SetGuard, which
  // at frame 0 has nothing to animate, and the sprite simply stops being
  // drawn. Off-screen is the pose that plays out and then leaves.
  const { widget } = rig({ 'Modules.Animation': true, 'Shield.WhenSheathed': SHIELD_POSE.OffScreen });
  settle(widget);
  assert.ok(widget.drawRect(), 'the guard draws');
  widget.lateUpdate(frame({ sheathed: true }));
  assert.ok(widget.animating, 'sheathing starts the raise');
  assert.ok(widget.drawRect(), 'and it is still on screen while it plays');
  // once the animation is done the Hide pose hides it
  for (let i = 0; i < 40; i++) widget.lateUpdate(frame({ sheathed: true, dt: 0.1 }));
  assert.equal(widget.animating, false);
  assert.equal(widget.drawRect(), null);
});

test('SW1: Animation.Direction - Forward Only and Reverse Only snap instead of playing', () => {
  // Forward Only (1): the return to guard SNAPS to frame 0
  const fwd = rig({ 'Modules.Animation': true, 'Animation.Direction': ANIM_DIRECTION.ForwardOnly, 'Shield.WhenSheathed': SHIELD_POSE.OffScreen });
  settle(fwd.widget, { sheathed: true }, 400);
  assert.equal(fwd.widget.frame, 4, 'sheathing played out to frame 4');
  fwd.widget.lateUpdate(frame());
  assert.equal(fwd.widget.frame, 0, 'and the return snapped');
  assert.equal(fwd.widget.animating, false, 'with no coroutine');

  // Reverse Only (2): the sheathe SNAPS to frame 4 and the return plays
  const rev = rig({ 'Modules.Animation': true, 'Animation.Direction': ANIM_DIRECTION.ReverseOnly, 'Shield.WhenSheathed': SHIELD_POSE.OffScreen });
  settle(rev.widget);
  rev.widget.lateUpdate(frame({ sheathed: true }));
  assert.equal(rev.widget.frame, 4);
  assert.equal(rev.widget.animating, false);
});

test('SW1: the recoil conditions, and the ring is one of the nine parry clips', () => {
  const hit = { targetIsPlayer: true, bodyPart: 2, damage: 7, item: SHIELD };   // Buckler/Round/Kite cover LeftArm(2)
  const miss = { ...hit, damage: 0 };

  // AnyAttack (5): hit or miss, it rings
  for (const ev of [hit, miss]) {
    const { widget, sounds } = rig({ 'Modules.Recoil': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AnyAttack });
    settle(widget);
    widget.onAttackDamageCalculated(ev);
    assert.equal(sounds.length, 1, 'AnyAttack rings either way');
    assert.ok(sounds[0].clip >= PARRY_CLIP_FIRST && sounds[0].clip < PARRY_CLIP_FIRST + PARRY_CLIP_COUNT);
    assert.equal(sounds[0].pitch, 1.1);
    assert.equal(sounds[0].vol, 0, 'the IL really does pass volume 0');
  }
  // AnyHit (3) wants damage, AnyMiss (4) wants none
  const anyHit = rig({ 'Modules.Recoil': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AnyHit });
  settle(anyHit.widget);
  anyHit.widget.onAttackDamageCalculated(miss);
  assert.equal(anyHit.sounds.length, 0);
  anyHit.widget.onAttackDamageCalculated(hit);
  assert.equal(anyHit.sounds.length, 1);

  const anyMiss = rig({ 'Modules.Recoil': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AnyMiss });
  settle(anyMiss.widget);
  anyMiss.widget.onAttackDamageCalculated(hit);
  assert.equal(anyMiss.sounds.length, 0);
  anyMiss.widget.onAttackDamageCalculated(miss);
  assert.equal(anyMiss.sounds.length, 1);

  // the first three ask whether the shield COVERS the part that was struck
  const onShield = rig({ 'Modules.Recoil': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AttackOnShield });
  settle(onShield.widget);
  onShield.widget.onAttackDamageCalculated({ ...hit, bodyPart: 0 });   // Head - a Kite does not cover it
  assert.equal(onShield.sounds.length, 0, 'a blow to a part the shield does not cover does not ring');
  onShield.widget.onAttackDamageCalculated(hit);
  assert.equal(onShield.sounds.length, 1);
  // ...and the last three do not
  assert.ok(isPartShielded(SHIELD, 2));
  assert.ok(!isPartShielded(SHIELD, 0));

  // the module off rings nothing at all
  const off = rig();
  settle(off.widget);
  off.widget.onAttackDamageCalculated(hit);
  assert.equal(off.sounds.length, 0);
});

test('SW1: a DOWNWARD crossing of either threshold repoints the sheet mid-fight', () => {
  const { widget } = rig({ 'Modules.Recoil': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AnyAttack });
  settle(widget);
  const pristine = widget.indexCurrent;
  // a blow that leaves it above the upper threshold changes nothing
  widget.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: 2, damage: 1, item: { ...SHIELD, conditionPercentage: 80 } });
  assert.equal(widget.indexCurrent, pristine);
  // one that takes it under the upper threshold moves to the worn art
  widget.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: 2, damage: 1, item: { ...SHIELD, conditionPercentage: 70 } });
  assert.equal(widget.indexCurrent, pristine + 50, 'the worn tier');
  // and under the lower, the battered
  widget.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: 2, damage: 1, item: { ...SHIELD, conditionPercentage: 20 } });
  assert.equal(widget.indexCurrent, pristine + 100, 'the battered tier');
});

test('SW1 KEPT BUG FOR BUG: SetBlock’s left-handed animated branch writes CURRENT, not TARGET', () => {
  // The other three branches ease; this one snaps, and BlockCoroutine -
  // which waits for current to reach target - therefore falls straight
  // through its wait. Pinned so a tidy-up cannot quietly "fix" the mod.
  const src = readFileSync('src/combat/shieldWidget.js', 'utf8');
  assert.match(src, /if \(w\.s\.animated && w\.flipped\) w\.shieldPositionCurrent = rect;/,
    'the slip is still written, and still named as the author’s');
  assert.match(src, /KEPT BUG FOR BUG/, 'and still labelled');

  const left = rig({ 'Modules.Animation': true, 'Modules.Recoil': true, 'Recoil.Offset': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AnyAttack },
    { handedness: () => true });
  settle(left.widget);
  const before = { ...left.widget.rect };
  left.widget.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: 2, damage: 5, item: SHIELD });
  assert.notDeepEqual({ ...left.widget.rect }, before, 'the left-handed animated block SNAPPED current');
});

test('SW1: the shield opens in its stance rather than sliding in from the origin (Awake’s tail)', () => {
  const { widget } = rig();
  widget.lateUpdate(frame());
  assert.deepEqual(widget.rect, widget.target, 'the first frame that knows a shield snaps current to target');
  assert.ok(widget.rect.width > 0);
});

test('SW1: the FPS-models seam is recorded and not carried', () => {
  // The animation-group helper is kept because the day that mod lands it
  // is the row it needs; nothing calls it now.
  assert.equal(shieldAnimationGroup({ templateIndex: SHIELD_TEMPLATES.Buckler }), 'ShieldHand_');
  for (const t of [SHIELD_TEMPLATES.Round, SHIELD_TEMPLATES.Kite, SHIELD_TEMPLATES.Tower]) {
    assert.equal(shieldAnimationGroup({ templateIndex: t }), 'ShieldArm_');
  }
  assert.equal(shieldAnimationGroup(null), 'Unarmed_');
  assert.equal(shieldAnimationGroup({ templateIndex: 999 }), 'Unarmed_');
  const src = readFileSync('src/combat/shieldWidget.js', 'utf8');
  assert.match(src, /41284af0-81c7-4630-bbc5-a976efa162a0/, 'the GUID is recorded in the source');
  const live = src.split('\n').filter((l) => /fpsModelsAnimator/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.deepEqual(live, [], 'the animator is named in a comment and nowhere else');
});

// ---- the sprite door -------------------------------------------------

import {
  shieldTextureFileName, shieldWidgetSize, shieldSpritePath, SHIELD_ARCHIVE_SIZES,
  SHIELD_WIDGET_MOD, SHIELD_ARCHIVES,
} from '../src/combat/shieldWidgetAssets.js';

test('SW1: the 600 sprites are VENDORED, and every one is on disk under the name the mod asks for', () => {
  // They are the modder's own art, not a render of ARENA2 - classic
  // Daggerfall draws no first-person shield, so there is no original for
  // them to repaint. That is what separates them from Weapon Widget's
  // 173 and Seasons of the Iliac Bay's flats, which the doctrine keeps
  // out of the repo; these ship with the port and it works out of the box.
  const dir = 'vendor/shield-widget/Textures';
  const names = readdirSync(dir);
  assert.equal(names.length, SHIELD_TEXTURE_COUNT, `${names.length} sprites vendored`);
  for (let i = 0; i < SHIELD_TEXTURE_COUNT; i++) {
    assert.ok(existsSync(`${dir}/${shieldTextureFileName(i)}.png`), `${shieldTextureFileName(i)}.png is missing`);
  }
  // and every one is an INDEXED png with a transparent index - the
  // encoding the README's measurement rests on
  for (const n of ['112360_0-0.png', '112362_2-0.png', '112363_29-4.png']) {
    const b = readFileSync(`${dir}/${n}`);
    assert.equal(b[25], 3, `${n} is colour type 3 (indexed)`);
    assert.ok(b.includes(Buffer.from('PLTE')), `${n} carries a palette`);
    assert.ok(b.includes(Buffer.from('tRNS')), `${n} carries the transparent index`);
  }
});

test('SW1: a flat index spells TextureReplacement\u2019s own name, and every size is known up front', () => {
  assert.equal(shieldTextureFileName(0), '112360_0-0');
  assert.equal(shieldTextureFileName(4), '112360_0-4', 'five frames to a record');
  assert.equal(shieldTextureFileName(5), '112360_1-0');
  assert.equal(shieldTextureFileName(149), '112360_29-4', 'thirty records to an archive');
  assert.equal(shieldTextureFileName(150), '112361_0-0');
  assert.equal(shieldTextureFileName(599), '112363_29-4');
  assert.deepEqual([...SHIELD_ARCHIVES], [112360, 112361, 112362, 112363]);
  assert.equal(SHIELD_WIDGET_MOD.guid, 'e59d8114-e9a2-4e8e-84e8-4666475dbb9f');
  // the size is known for all 600 WITHOUT loading one - the widget
  // measures before it uploads, and a shield with no size draws nothing
  for (let i = 0; i < SHIELD_TEXTURE_COUNT; i++) assert.ok(shieldWidgetSize(i), `no size for ${i}`);
  assert.deepEqual(shieldWidgetSize(0), SHIELD_ARCHIVE_SIZES[112360]);
  assert.deepEqual(shieldWidgetSize(599), SHIELD_ARCHIVE_SIZES[112363]);
  assert.equal(shieldWidgetSize(-1), null);
  assert.equal(shieldWidgetSize(SHIELD_TEXTURE_COUNT), null);
  // and the path is the vendored one the bundler carries
  assert.equal(shieldSpritePath(0), 'vendor/shield-widget/Textures/112360_0-0.png');
  // the URL is built the way handheldTorches.js builds its own - the
  // archive, record and frame interpolated separately inside a
  // `new URL(..., import.meta.url)`, which is what lets the bundler
  // carry them. Measured over a real build: all 600 names reach it.
  const door = readFileSync('src/combat/shieldWidgetAssets.js', 'utf8');
  assert.match(door, /new URL\(`\.\.\/\.\.\/vendor\/shield-widget\/Textures\/\$\{archive\}_\$\{record\}-\$\{frame\}\.png`, import\.meta\.url\)/);
});

test('SW1: a widget whose door answers no size draws nothing', () => {
  // The vendored sizes mean this cannot happen in the game; the law is
  // kept because the widget must never draw a rect it could not measure.
  const bare = createShieldWidget({
    settings: settingsOf(), textures: { size: () => null }, audio: null, rolls: () => 0.5, handedness: () => false,
  });
  for (let i = 0; i < 20; i++) bare.lateUpdate(frame());
  assert.equal(bare.drawRect(), null, 'no size, no draw');
});

// ---- the rig ---------------------------------------------------------

test('SW1: the rig runs the shield beside the weapon’s clone - its own frame, its own draw step, the same end-of-frame edge', () => {
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /const shield = createShieldWidget\(\{ textures: shieldWidgetTextures, audio \}\);/);
  assert.match(rig, /const shieldOn = \(\) => modSetting\('shield-widget', 'Enabled'\);/);
  // the Recoil module's trigger: PCAAO's event, at the tail of every
  // resolution of an enemy's attack on the player
  assert.match(rig, /setAttackOnPlayerHook\(\(attacker, target, damage, struckBodyPart\) => \{/);
  assert.match(rig, /shield\.onAttackDamageCalculated\(\{ targetIsPlayer: true, bodyPart: struckBodyPart, damage, item: shieldItem\(\) \}\);/);
  // the frame feed, and the draw before the torch hand
  assert.match(rig, /if \(shieldOn\(\)\) shield\.lateUpdate\(\{/);
  assert.match(rig, /shield\.setThirdPerson\(eotbHidesWeapon\(\)\);/);
  assert.match(rig, /shield\.endOfFrame\(\);/);
});

test('SW1: the left hand is read WITHOUT materialising the equip table', () => {
  // `equipTableOf` is `entity.equip ??= createEquipTable()`. Asking it
  // every frame GREW an empty table on an entity that had none, and
  // syncWorn then read that empty table and nulled the player's weapon -
  // the unsheathe went silent. The optional chain asks without writing.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  const fn = rig.slice(rig.indexOf('const shieldItem = () => {'));
  const body = fn.slice(0, fn.indexOf('\n  };'));
  assert.match(body, /entity\?\.equip\?\.slots\?\.\[EQUIP_SLOTS\.LeftHand\] \?\? null/, 'read, not created');
  assert.doesNotMatch(body, /equipTableOf\(/, 'and never through the materialising helper');
});

test('SW1: the attack-resolution seam fires on EVERY resolution, hit or miss, with the struck part', () => {
  const f = readFileSync('src/combat/formulas.js', 'utf8');
  // V3's hook above it is gated on damage; this one must not be - three
  // of the six Recoil conditions are MISS conditions.
  assert.match(f, /if \(target\?\.isPlayer && !attacker\.isPlayer\) \{\s*_attackOnPlayerHook\?\.\(attacker, target, damage, struckPart\);/);
  assert.match(f, /export function setAttackOnPlayerHook\(fn\) \{ _attackOnPlayerHook = fn \?\? null; \}/);
  // and the struck part is carried out of the block the roll is made in
  assert.match(f, /struckPart = struck;/);
});

// ---- the two gates the rig kept shut (audit, 2026-09-19) -------------
//
// Both were found by AUDIT after `npm run check` was green, and both
// killed the mod outright on a plain profile. They are pinned here
// BEHAVIOURALLY - a real rig, the real mod settings, the real draw seam -
// because a source-text pin would have matched the broken code too.

import { createWeaponRig } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

/** A rig with a kite shield in the left hand and the weapon SHEATHED,
 *  watched at the shield's own draw call. `drawRect` is left REAL, so
 *  the mod's gate ladder is what decides; only the paint is spied. */
function shieldRig({ sheathed = true, whenSheathed = 3, enabled = true, weaponWidget = false, torches = false } = {}) {
  _resetModSettings();
  setModSetting('shield-widget', 'Enabled', enabled);
  setModSetting('shield-widget', 'Shield.WhenSheathed', whenSheathed);
  setModSetting('weapon-widget', 'Enabled', weaponWidget);
  setModSetting('handheld-torches', 'Enabled', torches);
  const entity = {
    items: [], stats: { speed: 50 },
    equip: { slots: { [EQUIP_SLOTS.LeftHand]: { templateIndex: SHIELD_TEMPLATES.Kite, nativeMaterialValue: 513, currentCondition: 100, maxCondition: 100 } } },
  };
  const r = createWeaponRig({
    renderer: { uploadTexture: () => null, drawScreenQuad: () => {} },
    canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 },   // the ELEMENT, as every host passes it
    fetchBytes: () => { throw new Error('no art in tests'); }, palette: null,
    audio: { playOneShot() {} }, entity,
    camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
  });
  if (!sheathed) r.toggleSheath();
  const seen = [];
  const realDraw = r.shield.draw;
  r.shield.draw = (paint) => { const v = realDraw(paint); if (v) seen.push('shield'); return v; };
  for (let i = 0; i < 240; i++) r.frame(1 / 60);   // settle the ease into its sheathed stance
  r.draw();
  return { rig: r, seen, entity };
}

test('SW1-FEED: the shield gets a frame on its OWN switch, not on the weapon clone’s or the torch’s', () => {
  // The frame block (`if (widgetOn() || _torchesOn || shieldOn())`)
  // assembles the camera, the motor and the look that all three mods
  // share. It used to be opened by the other two alone, so a profile
  // that enabled ONLY Shield Widget never called `shield.lateUpdate` -
  // `ctx` stayed null and `drawRect()` answered null for ever.
  const { rig: r } = shieldRig({ weaponWidget: false, torches: false });
  assert.ok(r.shield.settings, 'the widget exists');
  assert.notEqual(r.shield.position[0], undefined);
  // the proof the frame arrived: a settled sheathed widget has left the
  // origin for its stance, which only LateUpdate can do
  assert.ok(r.shield.drawRect(), 'the mod would draw, with no other mod enabled');
});

test('SW1-GATE: a SHEATHED player sees the shield in Ready, and still sees no weapon', () => {
  // `Shield.WhenSheathed` and `Shield.WhenCasting` describe frames in
  // which the WEAPON's `shown()` is false. Gating the shield behind that
  // early return left `WhenAttacking` the only live setting in the mod.
  const { rig: r, seen } = shieldRig({ sheathed: true, whenSheathed: 3 });
  assert.equal(r.playerWeapon.sheathed, true, 'sheathed, so `shown()` is false');
  assert.deepEqual(seen, ['shield'], 'the shield drew anyway');
});

test('SW1-GATE: and Hide still hides - the relaxation is the mod’s own verdict, not a hole', () => {
  const { seen } = shieldRig({ sheathed: true, whenSheathed: 0 });   // Hide
  assert.deepEqual(seen, [], 'nothing drawn, and the seam returned as it always did');
});

test('SW1-GATE: the switch off is still off', () => {
  const { seen } = shieldRig({ sheathed: true, whenSheathed: 3, enabled: false });
  assert.deepEqual(seen, [], 'no frame, no draw');
});

test('SW1-GATE: the shield alone is not a weapon - the seam stops before the clone and the sprite', () => {
  // `if (!shown()) return;` after the torch's own return. A no-op for
  // every path that predates it, and the whole point for the new one.
  const rigSrc = readFileSync('src/combat/weaponRig.js', 'utf8');
  const seam = rigSrc.slice(rigSrc.indexOf('if (shieldRect) shield.draw('));
  const upTo = seam.slice(0, seam.indexOf('if (widgetOn() && c && widget.draw('));
  assert.match(upTo, /if \(torchOnly\) return;/, 'the torch still stops first');
  assert.match(upTo, /if \(!shown\(\)\) return;/, 'and the shield-only frame stops here');
});

test('SW1-RECT: the screen rect is the CANVAS\u2019s, not the 320x200 fallback', () => {
  // `c` is the canvas ELEMENT - `drawFpsWeapon` beside this reads
  // `canvas.width` off the same object - so `c.canvas.width` was
  // undefined and the mod ran its whole geometry on 320x200: the sprite
  // drew at native size whatever the window was, and the rect's own
  // clamp (`y <= sr.height`) pinned it near the TOP of a tall canvas.
  const { rig: r } = shieldRig({ sheathed: true, whenSheathed: 3 });
  const rect = r.shield.drawRect();
  assert.ok(rect, 'it draws');
  assert.ok(rect.y > 400, `the shield hangs in the LOWER half of an 800px canvas, got y=${rect.y}`);
  assert.ok(rect.width > 200, `and it is scaled up with the window (1280/320 = 4x a ~134px sprite), got w=${rect.width}`);
});

test('SW1-GATE: the shield’s verdict carries the draw step’s OWN two conditions, or the arm draws in a frame that drew nothing', () => {
  // AUDIT-FIELD F1's shape, and the one law here no behavioural pin can
  // hold: `fpArm` is a module singleton with a real skeleton behind it and
  // cannot be made active headlessly, so a `shieldRect` computed WITHOUT
  // `!fpArm.active()` survives every test in the repo - while in a browser
  // it opens the early return on a sheathed Morrowind frame and
  // `fpArm.draw(c); return;` takes it, above the shield's own step. The
  // mutant is recorded (tools/mutants/sw1.json, SW1b-2b) and this is what
  // kills it, read out of the source so it cannot go vacuous.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  const at = rig.indexOf('const shieldRect =');
  assert.ok(at > 0, 'the verdict is computed before the gate');
  const decl = rig.slice(at, rig.indexOf(';', at) + 1);
  for (const leg of ['shieldOn()', '&& c', '!eotbHidesWeapon()', '!fpArm.active()']) {
    assert.ok(decl.includes(leg), `the verdict must carry ${leg} - the draw step below re-imposes it`);
  }
  // ...and it is not a literal that satisfies a regex: each of those two
  // really does return above the shield's step in the seam below.
  const seam = rig.slice(rig.indexOf('if (paralyzed || (!shown()'));
  const eotbAt = seam.indexOf('if (eotbHidesWeapon()) return;');
  const armAt = seam.indexOf('if (fpArm.active()) { fpArm.draw(c); return; }');
  const shieldAt = seam.indexOf('if (shieldRect) shield.draw(');
  assert.ok(eotbAt > 0 && armAt > eotbAt && shieldAt > armAt,
    'the EotB body returns, then the arm returns, and only then does the shield paint');
});

test('SW1-LOOK: the frame’s look reaches the shield as the ARRAY it is, or Inertia only ever sees the feet', () => {
  // `takeFrameLook()` answers `[yaw, pitch]` - the clone one block below
  // reads `look[0]` and `look[1]` off the very same value. The shield's
  // feed asked it for `.x`/`.y`, which on an array is undefined, so the
  // Inertia module's lean had the movement term and a constant zero for
  // the look. `Modules.Inertia` is off by default, which is the only
  // reason no pin and no player said so.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  const feed = rig.slice(rig.indexOf('if (shieldOn()) shield.lateUpdate({'));
  const body = feed.slice(0, feed.indexOf('\n        });'));
  assert.match(body, /look: \{ x: look\?\.\[0\] \?\? 0, y: look\?\.\[1\] \?\? 0,/, 'indexed, as the clone reads it');
  assert.doesNotMatch(body, /look\?\.x/, 'and never by a name the value does not carry');
  // not vacuous: the clone really does read it positionally
  assert.match(readFileSync('src/combat/weaponWidget.js', 'utf8'), /\(look\[0\] \+ mx\)/);
  // and the widget really does spend both terms
  const sw = readFileSync('src/combat/shieldWidget.js', 'utf8');
  assert.match(sw, /\(\(Number\(look\.x\) \|\| 0\) \+ mx\) \* -0\.5 \* w\.s\.inertiaScale,/);
  assert.match(sw, /\(\(Number\(look\.y\) \|\| 0\) \+ my\) \* 0\.5 \* w\.s\.inertiaScale,/);
});
