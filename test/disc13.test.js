// DISC13 - four Discord reports (2026-09-23, Mac: "Got some bugs for you"). Each was reproduced against the real
// modules before it was touched, and every pin here fails at a40d13e0 and passes with its fix - except A's first,
// which measures the cause through the motor's own law and stands either way
// (bible/01-Overview/Field-Bugs-2026-09-23.md, DISC13).
//
// ── DISC13-A: "The shadows seem to flicker when i move" (icebreyker, a torch in a dungeon) ──
// The camera draws from the motor's INTERPOLATED eye (motor.js eyeAt, EV1) and every host built the lights in the
// hand - the torch, the Thunderlock's flash, the Light spell's candle - off the raw 60 Hz stepped feet
// (`player.pos`). On any screen faster than 60 Hz, or a 60 Hz frame that jitters, the light slid back and forth
// against the view every frame while walking (standing still, it did not), and the wall beside the torch pulsed:
// 9% frame to frame at 120 Hz. The hand light casts no shadow map by design, so the "shadows" are its own falloff.
//
// ── DISC13-B: "Cant heal with bandages" (icebreyker) ──
// The pack's card for a Bandage showed DROP and nothing else. The heal itself worked: Roleplay & Realism: Items
// registers UseBandage for the template (ItemHelper.RegisterItemUseHandler) and useItem asks that handler ahead of
// its ladder. But the card's Use button is drawn only where `usableItem` says the law has an arm, and that predicate
// had never been told about registered handlers - so the one door to the heal was never drawn.
//
// ── DISC13-C: "When I'm walking with torch it looks torn down. Half of it just dissapeared." (Ilvi) ──
// The Morrowind arm was rendered into a frame exactly the screen's size and pasted into the rect the Weapon Widget's
// bob, inertia and step had moved. The bob always pushes right, so the frame's left edge came into the screen on every
// stride and the torch in the left hand ended in a straight cut there (up to 77 px of a 1920 screen walking, 126
// running; with Diverse Weapons' preset, on by default since DW-CLIP, the inertia opens either side). MAC-R1 had
// padded the top for a raised blade; the sides never were. The pass now renders the pixels of the lens's own grid that
// the moved rect shows on the screen (fpArm.js fpFrameWindow) and lays them where the rect puts them: no frame edge is
// inside the screen, the arm still slides at the widget's sub-pixel pace, and the frame is a column and a row bigger at most.
//
// ── DISC13-D: "cant access my boat" (Sir McMobdon), and "Nether has options for the boat" ──
// Roleplay & Realism's shipPorts asks where the player stands: on the ship, yes; in a loaded location, a port and an
// owned ship; anywhere else, no. world.js answered `{ loaded, portTown, onShip }` and the delegate reads
// `locationLoaded`, so every port read as the wilderness and the Ship row stayed dark unless you were already aboard.
// Travel Options' OnlyFromPorts (which they turned off) rules the travel map's sea passage, never boarding your own
// ship. SHIP-PORTS (main, the same day, the same report) ships the rule off and put its switch on the tile; this is
// the other half - with the rule on, a port now answers as a port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setModSetting, _resetModSettings, modSettingsOf } from '../src/systems/modSettings.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { installRoleplayRealismModules } from '../src/systems/rriInstall.js';
import { isShipAvailable } from '../src/systems/ship.js';
import { usableItem, useItem } from '../src/systems/useItem.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { SKILLS } from '../src/systems/skills.js';
import { modDials } from '../src/systems/features.js';
import { withDom } from './invdrag.mjs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { PAGE_IDS } from '../src/ui/packPages.js';
import { PlayerMotor, FIXED_DT, walkSpeed, runSpeed } from '../src/player/motor.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, FP_FIELD_OF_VIEW } from '../src/combat/fpArm.js';
import { createWeaponWidget, readWidgetSettings } from '../src/combat/weaponWidget.js';
import { WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { createWeaponMachine } from '../src/characters/weaponStates.js';
import { perspective } from '../src/world/mat4.js';
import { CHAR_SPRITE_RT_SIZE } from '../src/render/renderer.js';
import { Collider } from '../src/player/collider.js';
import { playerTorchLight } from '../src/systems/playerTorch.js';
import { thunderlockMuzzleLight } from '../src/systems/thunderlock.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { candleBase, CANDLE } from '../src/scenes/magicCandle.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

installRoleplayRealism();
installRoleplayRealismModules();

// ── DISC13-A ─────────────────────────────────────────────────────────

const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const WALK = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
/** test/motorinterp.test.js's walker: landed on a floor, then up to walking speed. */
function walker() {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-500, 0, -500, 500, 0, -500, 500, 0, 500, -500, 0, 500], [0, 1, 2, 0, 2, 3], I4);
  const m = new PlayerMotor(col);
  m.spawn(0, 0.5, 0);
  for (let i = 0; i < 90; i++) m.update(FIXED_DT, { ...WALK, forward: 0 }, 0);
  for (let i = 0; i < 60; i++) m.update(FIXED_DT, WALK, 0);
  return m;
}
/** The worst frame-to-frame change in a hand light's offset from the camera's eye, walking at the given frame times. */
function slide(dts, feetOf, lightOf) {
  const m = walker();
  let prev = null, worst = 0;
  for (const dt of dts) {
    m.update(dt, WALK, 0);
    const e = m.eyeAt(), l = lightOf(feetOf(m));
    const o = [l.x - e[0], l.y - e[1], l.z - e[2]];
    if (prev) worst = Math.max(worst, Math.hypot(o[0] - prev[0], o[1] - prev[1], o[2] - prev[2]));
    prev = o;
  }
  return worst;
}
let seed = 7;
const jitter = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const RATES = {
  '120 Hz': Array(120).fill(1 / 120),
  '144 Hz': Array(144).fill(1 / 144),
  '60 Hz, +-1 ms': Array.from({ length: 120 }, () => 1 / 60 + (jitter() - 0.5) * 0.002),
};
const torchIn = { _torch: { range: 14 } }, gunIn = { _thunderlockFlash: 1 };
const HAND = {
  torch: (feet) => playerTorchLight(torchIn, feet, 0),
  'Thunderlock flash': (feet) => thunderlockMuzzleLight(gunIn, feet, 0),
};

test('DISC13-A: the torch and the Thunderlock\'s flash hold still against the camera while walking when built on the render feet; on the stepped feet (the hosts\' old read) they slide every frame', () => {
  for (const [name, lightOf] of Object.entries(HAND)) {
    for (const [rate, dts] of Object.entries(RATES)) {
      assert.ok(slide(dts, (m) => m.feetAt(), lightOf) < 1e-6, `${name}, ${rate}: rigid to the eye on feetAt`);
      const raw = slide(dts, (m) => m.pos, lightOf);
      assert.ok(raw > 0.03, `${name}, ${rate}: on player.pos it slides ${raw.toFixed(3)} a frame - the flicker icebreyker saw`);
    }
  }
});

test('DISC13-A: every host builds the hand lights off the render feet - both builders in every light array, and no host hands them player.pos (mutants: any one site back to player.pos)', () => {
  let sites = 0;
  for (const [file, n] of [['src/scenes/world.js', 2], ['src/scenes/worldModes.js', 2], ['src/scenes/exterior.js', 1], ['src/scenes/dungeon.js', 1]]) {
    const src = rd(file);
    for (const b of ['playerTorchLight(playerEntity, player.feetAt(), cam.yaw)', 'thunderlockMuzzleLight(playerEntity, player.feetAt(), cam.yaw)']) {
      assert.equal(src.split(b).length - 1, n, `${file}: ${b.slice(0, b.indexOf('('))} in all ${n} arrays`);   // AUDIT DISC19: counted apart - the world host's dungeon arm tints each with the dungeon's colour
    }
    assert.doesNotMatch(src, /(?:playerTorchLight|thunderlockMuzzleLight)\(playerEntity, player\.pos,/, `${file} hands no builder the stepped feet`);
    sites += n;
  }
  assert.equal(sites, 6);
});

/** The real engine over the stubs its candle needs (test/hostmagic.test.js's rig, trimmed). */
function engineWithCandle() {
  const player = { isPlayer: true, level: 1, health: 50, maxHealth: 50, magicka: 50, maxMagicka: 50, skills: new Array(40).fill(50),
    skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50 }, career: {}, activeEffects: [{ kind: 'light' }] };
  const sink = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} };
  return createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => null, uploadRecord() {}, collider: { raycast: () => Infinity },
    playerEntity: player, playerSinks: sink, say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => sink,
    absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.5,
  });
}
const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= r + 1e-9;

test('DISC13-A: the Light spell\'s candle hangs off the render feet the host hands magic.update, and a caller that passes none keeps the old answer (mutants: the candle back on playerFeet; a host that passes no render feet)', () => {
  const magic = engineWithCandle();
  const stepped = [0, 0, 0], render = [3, 0, 0], fwd = [0, 0, 1];
  magic.update(1 / 60, stepped, fwd, 1.8, render);
  const c = magic.candleLight();
  assert.ok(c, 'the Light effect lights the candle');
  assert.ok(near([c.x, c.y, c.z], candleBase(render, 1.8, fwd), CANDLE.jitterRadius), 'the candle is where the camera sees the player');
  assert.ok(!near([c.x, c.y, c.z], candleBase(stepped, 1.8, fwd), 2), 'not where the physics step left them');
  magic.update(1 / 60, stepped, fwd, 1.8);
  const d = magic.candleLight();
  assert.ok(near([d.x, d.y, d.z], candleBase(stepped, 1.8, fwd), CANDLE.jitterRadius * 2), 'a caller that passes no render feet keeps the old answer');
  // the four hosts: world, exterior and the world's interior arm hand the render feet; the dungeon context takes them from
  // both of its mounts (the standalone dungeon and the world's dungeon arm) and passes them on
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(f), /magic\.update\(dt, player\.pos, _mfwd, player\.height, player\.feetAt\(\)\);/, f);
  assert.match(rd('src/scenes/worldModes.js'), /magic\.update\(dt, player\.pos, eyeDir\(\), player\.height, player\.feetAt\(\)\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /magic\.update\(dt, playerFeet, \[-view\[2\], -view\[6\], -view\[10\]\], playerHeight, playerRenderFeet\);/);
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) assert.match(rd(f), /drawFoes\(dt, canvas[^\n]*!!player\.crouching, player\.feetAt\(\)\);/, f);
});

// ── DISC13-B ─────────────────────────────────────────────────────────

const bandage = (n = 10) => mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: 249, name: 'Bandage', stackCount: n }));
const medic = (items) => ({
  name: 'Fenger', career: { name: 'Knight' }, level: 3, stats: { strength: 50, endurance: 48 }, activeEffects: [], spells: [],
  items, goldPieces: 0, health: 20, maxHealth: 100, skills: new Array(35).fill(45), skillUses: new Array(35).fill(0),
});

/** The pack mounted over test/invdrag.mjs's document (QS2's harness): open Misc, pick the bandage, read the card. */
function withBandageCard(entity, fn) {
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    mountEnhancedInventory(host, { entity, items: () => entity.items, onExit: () => {} });
    const one = (cls) => dom.doc.querySelectorAll('.' + cls)[0] ?? null;
    one('packtabs').querySelectorAll('.packtab')[PAGE_IDS.indexOf('misc')].onclick({});
    one('packlists').querySelectorAll('.itemrow')[0].onclick?.({});
    const buttons = () => one('packdetail')?.querySelectorAll('.acts')[0]?.querySelectorAll('.act') ?? [];
    return fn({ acts: () => buttons().map((b) => b.textContent), press: (label) => buttons().find((b) => b.textContent === label).onclick({}) });
  });
}

test('DISC13-B: the Bandage card offers Use, and Use heals Min(medical/3, MaxHealth*0.4), takes one off the stack and tallies Medical (mutants: the handler arm dropped from usableItem; the arm ignoring `usable`)', () => {
  _resetModSettings();
  const e = medic([bandage()]);
  withBandageCard(e, ({ acts, press }) => {
    assert.deepEqual(acts(), ['Drop', 'Use'], 'the card icebreyker saw showed Drop alone');
    press('Use');
  });
  assert.equal(e.health, 35, 'medical 45 / 3 = 15 healed');
  assert.equal(e.items[0].stackCount, 9, 'RemoveOne');
  assert.equal(e.skillUses[SKILLS.Medical], 1, 'Medical tallied once');
});

test('DISC13-B: with bandaging off the handler hands the click back, so the card offers no Use (the ladder has no arm for a bandage)', () => {
  _resetModSettings();
  setModSetting('roleplay-realism-items', 'bandaging', false);
  assert.equal(usableItem(bandage()), false);
  assert.equal(useItem(bandage(), [bandage()], { entity: medic([]) }).kind, 'none', 'and a Use would have said nothing');
  withBandageCard(medic([bandage()]), ({ acts }) => assert.deepEqual(acts(), ['Drop']));
  setModSetting('roleplay-realism-items', 'bandaging', true);
  assert.equal(usableItem(bandage()), true, 'back on: back');
  setModSetting('roleplay-realism-items', 'Enabled', false);
  assert.equal(usableItem(bandage()), false, 'the mod off: its module is off with it');
  _resetModSettings();
});

// ── DISC13-C ─────────────────────────────────────────────────────────

const fixture = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
/** The real arm over the MW fixtures, built as test/fparm.test.js's MW-D9f builds it, on a renderer that records the
 *  pass's lens and size and the composite's rects. */
async function fixtureArm() {
  const files = new Map([
    [fpSkeletonPath({}), fixture('armfp.nif')], [FP_CLIP_PATH, fixture('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', fixture('armfphand.nif')], ['meshes/fixture/armfparm.nif', fixture('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'], loadMorrowindFile: async () => fixture('armfp.esm'),
  };
  const seen = { sprite: null, quad: null, overlay: 0 };
  const renderer = {
    gl: null, createCharacterMesh: () => ({ vao: {}, buffers: [] }), updateCharacterMesh: () => {},
    renderCharacterSprite: (mesh, model, proj, view, pw, ph) => { seen.sprite = { proj, pw, ph }; return { tex: {} }; },
    drawScreenOverlayQuad: () => { seen.overlay++; }, drawScreenQuad: (tex, dst, src) => { seen.quad = { dst: { ...dst }, src: { ...src } }; },
    createCharacterTexture: (mips) => ({ mips }),
  };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, move: { grounded: true } }));
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  for (let i = 0; i < 3; i++) if (arm.ready()) arm.update(1 / 60);
  return { arm, seen };
}
const SW = 1920, SH = 1080;
const screen = { width: SW, height: SH, clientWidth: SW, clientHeight: SH };
const clipOf = (m, p) => { const c = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) c[r] = m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]; return c; };
/** One frame under the widget's `rect`, read at the screen's four edge midpoints: the arm there is where the moved
 *  rect shows it, inside the rendered frame (outside it is the cut), and composited onto that very pixel. */
function edgesHold(arm, seen, rect) {
  const lens = perspective(FP_FIELD_OF_VIEW, SW / SH, 0.01, 1000);   // the screen's own lens
  const at = (nx, ny) => [nx * 30 / lens[0], ny * 30 / lens[5], -30];   // a rig point that lens puts at (nx, ny)
  seen.quad = null;
  assert.notEqual(arm.draw(screen), false);
  const { dst, src } = seen.quad;
  assert.ok(Math.abs(src.u1 * CHAR_SPRITE_RT_SIZE - seen.sprite.pw) < 1e-9 && Math.abs(src.v0 * CHAR_SPRITE_RT_SIZE - seen.sprite.ph) < 1e-9,
    'the composite samples exactly the columns and rows the pass rendered');
  for (const [sx, sy] of [[1, SH / 2], [SW - 1, SH / 2], [SW / 2, 1], [SW / 2, SH - 1]]) {
    const nx = (sx - rect.x) / rect.w * 2 - 1, ny = 1 - (sy - rect.y) / rect.h * 2;
    const c = clipOf(seen.sprite.proj, at(nx, ny)), fx = c[0] / c[3], fy = c[1] / c[3];
    assert.ok(fx >= -1 && fx <= 1 && fy >= -1 && fy <= 1,
      `rect at ${rect.x.toFixed(1)},${rect.y.toFixed(1)}: the arm at screen (${sx},${sy}) falls outside the rendered frame (NDC ${fx.toFixed(3)},${fy.toFixed(3)}) - a straight cut`);
    const x = dst.x + (fx + 1) / 2 * dst.w, y = dst.y + (1 - fy) / 2 * dst.h;
    assert.ok(Math.abs(x - sx) < 0.5 && Math.abs(y - sy) < 0.5, `and lands on that pixel: (${x.toFixed(2)},${y.toFixed(2)}) vs (${sx},${sy})`);
  }
}

test('DISC13-C: wherever the widget moves the arm - right as the bob does, left, down under a raised blade (MAC-R1), scaled - the screen\'s four edges show arm, not a cut, and a rect with no area shows nothing (mutants: the lens back to the symmetric one; the composite back on the moved rect; each edge of the window left unextended; the area guard)', async () => {
  const { arm, seen } = await fixtureArm();
  const rects = [
    { x: 0.04 * SW, y: 0.04 * SH, w: SW, h: SH },   // the widget's walking bob at its extreme
    { x: 0.066 * SW, y: 0, w: SW, h: SH },           // a run
    { x: -0.05 * SW, y: 0, w: SW, h: SH },           // inertia to the left
    { x: 0, y: 0.3 * SH, w: SW, h: SH },             // well down: MAC-R1's raised blade
    { x: 0, y: -0.03 * SH, w: SW, h: SH },           // up past the top: the widget's clamp allows its weaponOffsetHeight
    { x: 0.03 * SW, y: 0.02 * SH, w: 0.9 * SW, h: 0.9 * SH },   // inertia's depth scale
  ];
  for (const r of rects) {
    arm.setScreenTransform(() => r);
    edgesHold(arm, seen, r);
  }
  arm.setScreenTransform(() => ({ x: 0, y: 0, w: 0, h: SH }));   // a rect with no area (inertia's depth at its far end)
  seen.quad = null;
  assert.equal(arm.draw(screen), false, 'shows nothing, as its composite did - no lens divided by zero');
  assert.equal(seen.quad, null);
  arm.setScreenTransform(null);
});

test('DISC13-C: the arm slides as smoothly as the widget moves it, on the grid it always had - a sub-pixel shift moves the composite by exactly that and renders the same frame; at rest it is the screen\'s own frame; a moved one is at most a column and a row bigger, and still covers a 4K screen; with no transform it is the overlay it always was (mutants: the grid snapped to the screen; the spare column and row; a window with no transform)', async () => {
  const { arm, seen } = await fixtureArm();
  const drawAt = (r, canvas = screen) => {
    arm.setScreenTransform(() => r);
    seen.quad = null;
    assert.notEqual(arm.draw(canvas), false);
    return { dst: seen.quad.dst, proj: Array.from(seen.sprite.proj), pw: seen.sprite.pw, ph: seen.sprite.ph };
  };
  const rest = drawAt({ x: 0, y: 0, w: SW, h: SH });
  assert.deepEqual([rest.pw, rest.ph], [640, 360], 'at rest: the screen\'s own frame, MW_ARM_PIXEL 3');
  assert.deepEqual(rest.dst, { x: 0, y: 0, w: SW, h: SH }, 'laid on the screen');
  assert.ok(Math.abs(rest.proj[8]) < 1e-6 && Math.abs(rest.proj[9]) < 1e-6, 'through the symmetric lens');
  arm.setScreenTransform(null);   // the widget off: the fullscreen overlay, as it always was
  seen.quad = null; seen.overlay = 0;
  assert.notEqual(arm.draw(screen), false);
  assert.deepEqual([seen.sprite.pw, seen.sprite.ph, seen.overlay, seen.quad], [640, 360, 1, null], 'no transform, no window: the screen\'s frame through the overlay');
  const a = drawAt({ x: 10.4, y: 5.2, w: SW, h: SH }), b = drawAt({ x: 10.9, y: 5.7, w: SW, h: SH });
  assert.ok(Math.abs(b.dst.x - a.dst.x - 0.5) < 1e-9 && Math.abs(b.dst.y - a.dst.y - 0.5) < 1e-9, 'half a pixel of widget is half a pixel of arm');
  assert.deepEqual(b.proj, a.proj, 'and the same picture: the arm is not re-rasterised on its coarse grid as it moves (that would step it 3 px at a time)');
  const run = drawAt({ x: 0.066 * SW, y: 0.04 * SH, w: SW, h: SH });
  assert.ok(run.pw <= 641 && run.ph <= 361, `a moved frame is the screen's plus a column and a row at most (${run.pw}x${run.ph})`);
  const W4 = 3840, H4 = 2160, uhd = { width: W4, height: H4, clientWidth: W4, clientHeight: H4 };
  for (const dx of [0.04 * W4, -0.04 * W4]) {
    const f = drawAt({ x: dx, y: 0.03 * H4, w: W4, h: H4 }, uhd);
    assert.ok(f.pw <= CHAR_SPRITE_RT_SIZE && f.ph <= CHAR_SPRITE_RT_SIZE, 'inside the target');
    assert.ok(f.dst.x <= 0 && f.dst.x + f.dst.w >= W4 && f.dst.y <= 0 && f.dst.y + f.dst.h >= H4, `4K, shifted ${dx}: the frame still covers the screen (${f.dst.x.toFixed(1)}..${(f.dst.x + f.dst.w).toFixed(1)})`);
  }
  arm.setScreenTransform(null);
});

test('DISC13-C: walking, running, backing up and strafing under the Weapon Widget\'s own settings and under Diverse Weapons\' preset, every frame keeps the screen\'s edges', async () => {
  const { arm, seen } = await fixtureArm();
  const walk = walkSpeed(50), run = runSpeed(50, 50);
  let widest = 0;
  for (const preset of [false, true]) {
    _resetModSettings();
    setModSetting('diverse-weapons', 'WeaponWidgetPreset', preset);
    const widget = createWeaponWidget({ settings: () => readWidgetSettings(() => modSettingsOf('weapon-widget')), audio: { playOneShot() {} }, handedness: () => false, bowDrawback: () => true });
    const ctx = {
      renderer: null, canvas: screen, entity: null, art: null, weapon: null, weaponType: WEAPON_TYPES.None, material: -1, machine: createWeaponMachine(false, false),
      sheathed: true, usingRightHand: true, equipCountdown: 0, shown: false, castPlaying: false, spellArmed: false, thirdPerson: false, reach: 2.5,
      look: [0, 0], swingHeld: false, cursorActive: false, camera: () => ({ pos: [0, 1, 0], forward: [0, 0, 1] }), activateStarted: () => false, motion: null,
    };
    arm.setScreenTransform((b) => widget.armsTransform(b));   // weaponRig.js's own seam
    for (const [vel, ratio] of [[[0, 0, walk], 1], [[0, 0, run], run / walk], [[0, 0, -walk], 1], [[walk, 0, 0], 1]]) {
      ctx.motion = { grounded: true, crouching: false, riding: false, standing: false, speedRatio: ratio, baseSpeed: walk, localVel: vel };
      for (let i = 0; i < 120; i++) {
        widget.lateUpdate(1 / 60, ctx); widget.endOfFrame(); arm.update(1 / 60);
        const r = widget.armsTransform({ x: 0, y: 0, w: SW, h: SH });
        widest = Math.max(widest, r.x, SW - (r.x + r.w));
        edgesHold(arm, seen, r);
      }
    }
  }
  assert.ok(widest > 40, `the widget really did open the sides (${widest.toFixed(1)} px at most) - the frames above are the case`);
  arm.setScreenTransform(null);
  _resetModSettings();
});

// ── DISC13-D ─────────────────────────────────────────────────────────

/** world.js's own `shipLocation`, cut from the host and run over stand-ins for what it reads. */
function shipLocationOf({ loc = null, travelOptions = false, ports = [], onShip = false } = {}) {
  const line = rd('src/scenes/world.js').split('\n').find((l) => l.includes('shipLocation: () => {'));
  assert.ok(line, 'world.js answers shipLocation');
  const src = line.slice(line.indexOf('() => {'), line.lastIndexOf('; },') + 3);
  const make = new Function('_questLoc', 'modSetting', 'hasPort', 'isOnShip', 'playerEntity', 'playerTravelPixel', `return (${src});`);
  return make(() => loc, (v, k) => (v === 'travel-options' && k === 'Enabled' ? travelOptions : undefined),
    (mapId) => ports.includes(mapId), () => onShip, { boardShipPosition: null }, () => ({ x: 0, y: 0 }))();
}
const port = { mapTableData: { mapId: 7 }, exterior: { exteriorData: { portTownAndUnknown: 1 } } };
const inland = { mapTableData: { mapId: 8 }, exterior: { exteriorData: { portTownAndUnknown: 0 } } };
const yourShip = { mapTableData: { mapId: 9, locationType: 14 }, exterior: { exteriorData: { portTownAndUnknown: 0 } } };   // region 31's "Your Ship" (locationEntrance.js)
const boardable = (where) => isShipAvailable({ canSail: true, ownsShip: true, ...where });

test('DISC13-D: with shipPorts on, a port town boards your ship - world.js\'s answer is the one the delegate reads (mutants: the key back to `loaded` in either branch)', () => {
  _resetModSettings();
  setModSetting('roleplay-realism', 'shipPorts', true);   // SHIP-PORTS ships it off; a player who asks for the port rule gets it
  assert.equal(boardable(shipLocationOf({ loc: port })), true, 'in a port with a ship: board it (it read false - the port was the wilderness)');
  assert.equal(boardable(shipLocationOf({ loc: inland })), false, 'inland: the mod\'s own no');
  assert.equal(boardable(shipLocationOf({ loc: null })), false, 'the wilderness: no');
  assert.equal(boardable(shipLocationOf({ loc: yourShip, onShip: true })), true, 'aboard (the ship\'s pixel is a location, "Your Ship"): yes - the way back off');
  assert.equal(boardable(shipLocationOf({ loc: inland, travelOptions: true, ports: [8] })), true, 'Travel Options\' port table answers where it is on');
  // the shape itself: every key the host answers is one the delegate reads
  const params = rd('src/systems/ship.js').match(/export function isShipAvailable\(\{ ([^}]*) \}/)[1].split(',').map((p) => p.trim().split(' ')[0]);
  for (const k of [...Object.keys(shipLocationOf({ loc: port })), ...Object.keys(shipLocationOf({ loc: null }))]) {
    assert.ok(params.includes(k), `shipLocation's "${k}" is read by isShipAvailable (${params.join(', ')})`);
  }
});

test('DISC13-D: shipPorts has a row on Roleplay & Realism\'s tile and ships off (SHIP-PORTS), and off hands the question back to HasShip', () => {
  _resetModSettings();
  assert.ok(modDials('roleplay-realism').includes('shipPorts'), 'the tile\'s drawer carries the switch');
  assert.equal(modSettingsOf('roleplay-realism').shipPorts, false, 'off until a player asks for the port rule');
  assert.equal(boardable(shipLocationOf({ loc: inland })), true, 'off: an owned ship boards anywhere, as DFU\'s HasShip');
  assert.equal(isShipAvailable({ canSail: true, ownsShip: false, ...shipLocationOf({ loc: port }) }), false, 'and no ship is still no ship');
  _resetModSettings();
});
