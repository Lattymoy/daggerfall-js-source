// RSH1 (2026-10-11, Mac: "can we implement this mod into the source") - READIED SPELLCASTING HANDS 1.3 (jefetienne,
// MIT): while a spell that is not CasterOnly is readied and the cast is not
// playing, the element's casting hands stand at frame 0 (Modded_FPSSpellCasting_Ready.cs AnimateSpellCast). Driven
// through the REAL weapon rig over a synthetic six-record casting CIF, whose records differ in width so a drawn quad
// names its own frame; and the one condition the port reads, as the mod's source read (OWN-WORK1 retired the
// vendored copy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { fpsSpellCasting, readiedHandsFrame, READIED_HANDS_FRAME, SpellCastAnim, SMALL_FRAME_ADJUST } from '../../src/combat/fpsSpellCasting.js';
import { resetToDefaults } from '../../src/systems/settings/settings.js';
import { setModSetting, _resetModSettings, MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { ONLINE_PLAYERS_OWN_MODS } from '../../src/systems/online/onlineLane.js';
import { CREDITS } from '../../src/ui/credits.js';
import { featureForControl } from '../../src/systems/features.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url));

/** A plain casting CIF: six single-frame records of (20 + r) x 30, uncompressed, every pixel palette index 1. */
function castCif() {
  const parts = [];
  for (let r = 0; r < 6; r++) {
    const w = 20 + r, h = 30;
    const b = new Uint8Array(12 + w * h);
    const v = new DataView(b.buffer);
    v.setInt16(4, w, true); v.setInt16(6, h, true); v.setUint16(8, 0, true); v.setUint16(10, w * h, true);
    b.fill(1, 12);
    parts.push(b);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** The real rig, a readied spell the test sets, and one frame's quads. */
async function handsRig() {
  resetToDefaults(); _resetModSettings();
  fpsSpellCasting.currentFrame = -1; fpsSpellCasting._hold = null; fpsSpellCasting._recover = 0;
  const quads = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex, rect, uv) => quads.push({ tex, rect, uv }) };
  const canvas = { width: 600, height: 400, clientWidth: 600, clientHeight: 400 };
  const state = { ready: null };
  const fetched = [];
  const r = createWeaponRig({
    renderer, canvas, entity: { items: [], equip: { slots: {} }, stats: { speed: 50 } }, audio: { playOneShot() {} },
    palette: { get: () => ({ r: 200, g: 100, b: 50 }) },
    fetchBytes: async (name) => { fetched.push(name); return castCif(); },
    spellArmed: () => state.ready != null, readiedSpell: () => state.ready,
  });
  const frame = async () => {
    r.frame(1 / 60);
    quads.length = 0;
    r.draw();
    await new Promise((res) => setTimeout(res, 0));   // a first ask starts the archive's load; it lands before the next
    quads.length = 0;
    r.draw();
    return quads.filter((q) => typeof q.tex === 'string' && q.tex.startsWith('fpsc:')).map((q) => ({ tex: q.tex, mirrored: !!q.uv && q.uv.u0 === 1 }));
  };
  return { r, state, frame, fetched };
}

test('RSH1: the mod\'s condition, as one answer - frame 0 while a spell that is not CasterOnly is readied and the cast is not playing; nothing otherwise (mutants: CasterOnly raising hands, hands over the cast, an element with no archive drawn)', () => {
  assert.equal(READIED_HANDS_FRAME, 0, 'frame 0 - the small frame the cast starts from');
  assert.equal(readiedHandsFrame(null, false), -1, 'no readied spell (HasReadySpell false): no hands');
  for (const element of [0, 1, 2, 3, 4]) {
    for (const rangeType of [1, 2, 3, 4]) assert.equal(readiedHandsFrame({ element, rangeType }, false), 0, `element ${element}, range ${rangeType}`);
    assert.equal(readiedHandsFrame({ element, rangeType: 0 }, false), -1, 'TargetTypes.CasterOnly raises nothing');
    assert.equal(readiedHandsFrame({ element, rangeType: 2 }, true), -1, 'the cast owns the hands while it plays (IsPlayingAnim)');
  }
  assert.equal(readiedHandsFrame({ element: null, rangeType: 2 }, false), -1, 'ElementTypes.None: no archive, no hands - as for the cast');
  assert.equal(readiedHandsFrame({ element: 7, rangeType: 2 }, false), -1);
});

test('RSH1: through the real rig - a readied spell raises its element\'s frame 0 in both hands, the right mirrored; the cast plays on from it; put away, they go (mutants: the draw at the wrong frame, a second pair over the cast, hands left after the spell)', async () => {
  const { r, state, frame, fetched } = await handsRig();
  assert.deepEqual(await frame(), [], 'nothing readied: an empty screen, as DFU');
  state.ready = { element: 0, rangeType: 2, name: 'Fireball' };
  let q = await frame();
  assert.deepEqual(q, [{ tex: 'fpsc:FIRE00C6.CIF:0', mirrored: false }, { tex: 'fpsc:FIRE00C6.CIF:0', mirrored: true }], 'fire\'s frame 0, both hands');
  assert.ok(fetched.includes('FIRE00C6.CIF'), 'the element\'s own casting archive');
  state.ready = { element: 4, rangeType: 3, name: 'Magicka bolt' };
  q = await frame();
  assert.deepEqual(q.map((x) => x.tex), ['fpsc:MJIC00C6.CIF:0', 'fpsc:MJIC00C6.CIF:0'], 'another element, its own archive');
  // the click: the cast takes the hands from the same frame, and only one pair is ever drawn
  assert.equal(r.castSpellAnim(3, 4, () => {}), true, 'the cast starts');
  for (let i = 0; i < 40; i++) {
    q = await frame();
    assert.ok(q.length <= 2, 'one pair of hands, never the readied pair under the cast');
    if (!fpsSpellCasting.isPlayingAnim) break;
  }
  state.ready = null;   // the release clears the ready
  for (let i = 0; i < 40 && fpsSpellCasting.isPlayingAnim; i++) await frame();
  assert.deepEqual(await frame(), [], 'the spell gone: the hands go with it');
});

test('RSH1: a CasterOnly spell raises nothing, and the switch takes them away at once (mutants: the target type unread, the switch ignored)', async () => {
  const { state, frame } = await handsRig();
  state.ready = { element: 1, rangeType: 0, name: 'Heal' };
  assert.deepEqual(await frame(), [], 'CasterOnly - it cast as it was readied');
  state.ready = { element: 1, rangeType: 1, name: 'Frost touch' };
  assert.equal((await frame()).length, 2);
  setModSetting('readied-spellcasting-hands', 'Enabled', false);
  assert.deepEqual(await frame(), [], 'off: DFU\'s empty screen');
  setModSetting('readied-spellcasting-hands', 'Enabled', true);
  assert.equal((await frame()).length, 2, 'on again, on the frame');
});

test('RSH1: the rig reads the readied hands under the cast hands\' own two lane gates, after the cast\'s draw, and every host hands it the engine\'s readied() (mutants: the Morrowind arm or the Beholder drawing them too, a host left out)', () => {
  const rig = read('src/combat/weapon/weaponRig.js').toString();
  const at = rig.indexOf('if (c && !fpArm.active() && !eotbHidesSpellHands()) {');
  const end = rig.indexOf('// PROF1', at);
  const block = rig.slice(at, end);
  assert.ok(at > 0 && end > at);
  assert.ok(block.indexOf('drawSpellCastHands(renderer, c, spellArtFor(fpsSpellCasting.element)') < block.indexOf('readiedHandsFrame('), 'the cast first, then the readied hands');
  // PIN MOVED (FIELD BUGS 2026-10-22c SPELL-CLIMB): and they yield to the fists on the wall
  // (test/combat/weapon/fb1022c_spellclimb.test.js drives it)
  assert.match(block, /if \(readiedHandsOn\(\) && !fpsSpellCasting\.isPlayingAnim && !climbHands\.showing\(\)\) \{/);
  assert.match(rig, /const readiedHandsOn = \(\) => modSetting\('readied-spellcasting-hands', 'Enabled'\);/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    assert.match(read(host).toString(), /readiedSpell: \(\) => magic\??\.readied\?\.\(\) \?\? null,/, `${host} hands the rig the readied record`);
  }
  assert.match(read('src/scenes/hostMagic.js').toString(), /readied: \(\) => readiedSpell,/, 'the engine\'s own PlayerEffectManager.ReadySpell');
});

test('RSH1: the mod\'s one condition, its frame and the cast\'s layout, as its source read (mutants: a leg of the condition dropped, the inset moved)', () => {
  // OWN-WORK1 (2026-10-31): vendor/readied-spellcasting-hands is retired. Modded_FPSSpellCasting_Ready.cs, at 1b97b3a8f:
  //   if (pef.HasReadySpell && pef.ReadySpell.Settings.TargetType != TargetTypes.CasterOnly && !psc.IsPlayingAnim)
  //     currentFrame = 0;
  // and `const float smallFrameAdjust = 0.134f;`, the cast's own layout.
  const SHIPPED = { frame: 0, smallFrameAdjust: 0.134 };
  for (const ready of [false, true]) for (const casterOnly of [false, true]) for (const playing of [false, true]) {
    const spell = ready ? { element: 1, rangeType: casterOnly ? 0 : 2 } : null;
    const want = ready && !casterOnly && !playing ? SHIPPED.frame : -1;
    assert.equal(readiedHandsFrame(spell, playing), want, `HasReadySpell ${ready}, CasterOnly ${casterOnly}, IsPlayingAnim ${playing}`);
  }
  assert.equal(SMALL_FRAME_ADJUST, SHIPPED.smallFrameAdjust, 'the cast\'s own layout - the port\'s SMALL_FRAME_ADJUST');
  assert.equal(new SpellCastAnim().frameIndex, -1);
});

test('RSH1: registered as every vendored mod is - its switch on by default, its tile in Combat, its credit, the player\'s own online (mutants: any one left out)', () => {
  const mod = MOD_SETTINGS['readied-spellcasting-hands'];
  assert.equal(mod.author, 'jefetienne');
  assert.equal(mod.keys.Enabled.default, true, 'MO1: on by default');
  assert.deepEqual(Object.keys(mod.keys), ['Enabled'], 'the mod ships no settings - the switch is the port\'s alone');
  const row = featureForControl('mods', 'Enabled', 'readied-spellcasting-hands');
  assert.equal(row.group, 'combat');
  assert.equal(row.effect, 'Takes effect at once.');
  const credit = CREDITS.mods.find((c) => c.retired?.includes('readied-spellcasting-hands'));   // OWN-WORK1: a retired credit
  assert.ok(credit && credit.author === 'jefetienne' && credit.version === '1.3' && /mods\/91$/.test(credit.link));
  assert.ok(ONLINE_PLAYERS_OWN_MODS.includes('readied-spellcasting-hands'), 'hands on my own screen - the room shares nothing of it');
});
