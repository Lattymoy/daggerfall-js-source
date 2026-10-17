// WIDGET-LOOK + WIDGET-RECOIL (FIELD BUGS 2026-10-03, SlipperyPeasant on Discord: "The inertia module for the weapon
// and shield widget mods dont work, the sprites dont sway back and forth when you look around." / "I think the recoil
// module isnt working either.")
//
// INERTIA. The mods read InputManager.LookX/LookY - DFU's look AXES, which PlayerMouseLook.ApplyLook turns into degrees
// at sensitivity (2) * MouseLookSensitivity - and the port handed them the frame latch's RADIANS: a turn swayed them a
// fourteenth of their own while a strafe (the mods' own units) swayed them whole. Driven through the real latch
// (lookFilter.add / takeFrameLook), the real conversion and the mod's own inertia step.
//
// RECOIL. PCAAO (on by default) rolls its own struck body part, and the tail's hook - the Shield Widget's "Attack On
// Shield" Recoil, its default condition - was handed -1 on every blow. Driven through the real calculateAttackDamage
// with the overhaul installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LookFilter, takeFrameLook } from '../../../src/player/lookFilter.js';
import { dfuLookAxes, lookScale } from '../../../src/ui/lookSettings.js';
import { setValue, _resetForTests as resetSettings } from '../../../src/systems/settings/settings.js';
import { inertiaStep, readWidgetSettings } from '../../../src/combat/weapon/weaponWidgetMotion.js';
import { calculateAttackDamage, setAttackOnPlayerHook } from '../../../src/combat/formulas.js';
import { installPcaao, uninstallPcaao } from '../../../src/combat/pcaao.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { makeEnemyEntity } from '../../../src/characters/enemy/enemyEntity.js';

const DEG = Math.PI / 180;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** The settings shelf for one test (the in-memory store), torn down after. */
function withSettings(values, fn) {
  resetSettings();
  for (const [k, v] of Object.entries(values)) setValue('Controls', k, v);
  try { return fn(); } finally { resetSettings(); }
}

test('WIDGET-LOOK: the frame\'s look reaches the mods as DFU\'s axes - degrees over 2 x MouseLookSensitivity, the vertical invert undone (mutants: the radians handed over; the field 2 dropped; the invert kept)', () => {
  withSettings({ MouseLookSensitivity: 2, InvertMouseVertical: false }, () => {
    takeFrameLook();   // the latch empty
    const f = new LookFilter();
    // a mouse turned 4 degrees right and 2 up, as every host feeds it: pixels at lookScale(), the pitch already inverted
    const px = (4 * DEG) / lookScale(), py = (2 * DEG) / lookScale();
    f.add(px * lookScale(), py * lookScale());
    const axes = dfuLookAxes(takeFrameLook());
    assert.ok(Math.abs(axes[0] - 1) < 1e-9, `4 degrees at sensitivity 2 is ONE LookX (2 x 2 degrees a unit) - got ${axes[0]}`);
    assert.ok(Math.abs(axes[1] - 0.5) < 1e-9, `2 degrees up is half a LookY - got ${axes[1]}`);
  });
  withSettings({ MouseLookSensitivity: 0.5, InvertMouseVertical: true }, () => {
    // the same 4 degrees at a quarter the sensitivity is four units; the inverted pitch (the camera's) comes back to the
    // mouse's own axis - DFU applies InvertMouseVertical after LookY, in ApplyLook
    const axes = dfuLookAxes([4 * DEG, -2 * DEG]);
    assert.ok(Math.abs(axes[0] - 4) < 1e-9);
    assert.ok(Math.abs(axes[1] - 2) < 1e-9, 'the invert undone');
  });
});

test('WIDGET-LOOK: through the mod\'s own inertia step, a turn sways the sprite in the mod\'s own measure - 4 degrees at the default 2.0 is the -250 a whole look unit asks at Scale 1, where the radians asked -17.5 (mutant: the rig hands the radians)', () => {
  withSettings({ MouseLookSensitivity: 2 }, () => {
    const s = readWidgetSettings(() => ({ 'Modules.Inertia': true, 'Inertia.Scale': 1, 'Inertia.Speed': 1, 'Inertia.ForwardDepth': 1, 'Inertia.ForwardSpeed': 1 }));
    const state = { inertiaCurrent: [0, 0], inertiaTarget: [0, 0], inertiaForwardCurrent: [0, 0], inertiaForwardTarget: [0, 0], screenRect: { width: 1920, height: 1080 } };
    const still = { localVel: [0, 0, 0], grounded: true };
    const turned = inertiaStep({ ...state, look: dfuLookAxes([4 * DEG, 0]) }, s, still, 1 / 60);
    assert.ok(Math.abs(turned.inertiaTarget[0] + 250) < 1e-6, `the target: ${turned.inertiaTarget[0]}`);
    const raw = inertiaStep({ ...state, look: [4 * DEG, 0] }, s, still, 1 / 60);
    assert.ok(Math.abs(raw.inertiaTarget[0] + 0.5 * 500 * 4 * DEG) < 1e-6, `the radians were the bug: ${raw.inertiaTarget[0]} - a fourteenth of the mod's sway`);
  });
  // the rig: one read of the latch, the radians to the Thunderlock (its lab's), the axes to the three mods
  const rig = rd('src/combat/weapon/weaponRig.js');
  assert.match(rig, /const look = takeFrameLook\(\);[^\n]*\n\s*const lookAxes = dfuLookAxes\(look\);/);
  assert.match(rig, /thunderlockFeel\(dt, \{ width: c\?\.width \?\? 320, height: c\?\.height \?\? 200, motion: frameMotion, look \}\);/, 'the gun keeps the radians its lab is tuned on');
  assert.match(rig, /look: lookAxes, swingHeld: _held, cursorActive: cursorActive\(\), camera: camThunk, collider:/, 'Handheld Torches');
  assert.match(rig, /look: \{ x: lookAxes\[0\], y: lookAxes\[1\], cursorActive: cursorActive\(\), swingAction: _held \}/, 'Shield Widget');
  // PIN MOVED (TWO-HANDS, bible/05-Combat/Two-Hands.md): the clone's frame is built by cloneFrame, once for each hand of
  // a pair, from the frame's own inputs - the axes among them
  assert.match(rig, /look: f\.look, swingHeld: _held, cursorActive: cursorActive\(\), camera: f\.camera,\n\s*activateStarted:/, 'Weapon Widget');
  assert.match(rig, /const pair = pairUp\(\), cf = \{ c, motion: frameMotion, look: lookAxes, camera: camThunk \};/, 'Weapon Widget: the axes into its frame');
  assert.equal((rig.match(/= takeFrameLook\(\);/g) ?? []).length, 1, 'the latch read once a frame');
});

test('WIDGET-RECOIL: under PCAAO (the default armour core) a foe\'s blow at the player hands the struck hook the part the core rolled, never -1 - the Shield Widget\'s "Attack On Shield" asks it (mutants: the part not handed back; the stock core\'s own lost)', () => {
  const player = { isPlayer: true, level: 5, raceId: 1, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, 40])), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 },
    health: 50, maxHealth: 60, items: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0 };
  const foe = makeEnemyEntity(15, ENEMY_BASICS[15], { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 }, 5, () => 0.5);
  const parts = [];
  setAttackOnPlayerHook((_a, _t, _d, part) => parts.push(part));
  let seed = 7; const lcg = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };
  const blows = (n) => { parts.length = 0; for (let i = 0; i < n; i++) calculateAttackDamage(foe, player, { rolls: lcg, dfRand: () => 0 }); return [...parts]; };
  try {
    uninstallPcaao();
    const stock = blows(12);
    assert.ok(stock.length === 12 && stock.every((p) => Number.isInteger(p) && p >= 0 && p <= 6), `the stock core: ${stock}`);
    installPcaao({ read: () => true });
    const overhaul = blows(12);
    assert.equal(overhaul.length, 12);
    assert.ok(overhaul.every((p) => Number.isInteger(p) && p >= 0 && p <= 6), `PCAAO's core hands its part back: ${overhaul}`);
    assert.ok(new Set(overhaul).size > 1, 'rolled, not a constant');
  } finally {
    setAttackOnPlayerHook(null);
    uninstallPcaao();
  }
});
