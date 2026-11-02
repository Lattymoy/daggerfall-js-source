// RPT1026-CLIENT (a private report, 2026-10-20: any spell landing some fourteen metres off shook the view, the player's
// or anyone's; at Dagon's Breach the shakes of many casts ran together without a pause, and the Screen Shake On Damage
// setting did not touch it). Another player's cast is drawn as a missile of its element (hostMagic.js spellVisual:
// SPELLFX1's `visual`, its caster named) and its landing runs the same impact code as mine, which kicked the camera (Better
// Ambience's weaponKick) at its whole strength. Driven through the one cast engine (createPlayerMagic) as
// test/formats/morrowind/mwspellfx1.test.js stands it, a wall across the bolt's line 3 m from me.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { betterAmbience } from '../../src/systems/betterAmbience.js';
import { setPref, _resetForTests, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { MOD_CURATED } from '../../src/systems/features.js';
import { CATEGORIES } from '../../src/ui/settings/settingsMap.js';
import { labelOf } from '../../src/ui/settings/settingsCopy.js';

afterEach(() => _resetForTests());

const dmg = { type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 };

/** The engine with a wall across z = 3, my feet at the origin. */
function engine() {
  const raycast = (pos, dir, max) => { const d = dir[2] > 0 ? (3 - pos[2]) / dir[2] : Infinity; return d >= 0 && d <= max ? d : Infinity; };
  const player = { isPlayer: true, level: 1, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
  });
  magic.update(0, [0, 0, 0]);
  const fly = () => { for (let i = 0; i < 30; i++) magic.update(1 / 30, [0, 0, 0]); };
  return { magic, fly };
}

function kicks(t) {
  const seen = [];
  t.mock.method(betterAmbience, 'weaponKick', (k) => { seen.push(k); });
  return seen;
}

test('RPT1026-CLIENT: another player\'s spell kicks the camera at the share the player chose - Half by default, Off none, Full its whole kick', (t) => {
  const seen = kicks(t);
  assert.equal(PREF_DEFAULTS.peerSpellShake, 0.5, 'Half, as the report asked');
  const peerBolt = (rangeType = 2) => { const E = engine(); E.magic.spellVisual({ from: [0, 1, 0], dir: [0, 0, 1], element: 0, rangeType, casterId: 'peer-1' }); E.fly(); };
  peerBolt();
  assert.equal(seen.length, 1, 'one kick for the landing');
  const half = seen[0];
  setPref('peerSpellShake', 1);
  peerBolt();
  assert.ok(Math.abs(seen[1] - half * 2) < 1e-9, `Full is twice Half (${seen[1]} against ${half})`);
  setPref('peerSpellShake', 0);
  peerBolt();
  peerBolt(4);   // an area blast too
  assert.equal(seen.length, 2, 'Off: no kick from any of their landings');
});

test('RPT1026-CLIENT: my own spell keeps its whole kick, whatever the other players\' share', (t) => {
  const seen = kicks(t);
  setPref('peerSpellShake', 0);
  const E = engine();
  E.magic.setReadied({ name: 'Firebolt', index: 91, element: 0, rangeType: 2, effects: [dmg] });
  E.magic.castInput([0, 1, 0], [0, 0, 1]);
  E.fly();
  assert.equal(seen.length, 1, 'my bolt on the wall kicks');
  setPref('peerSpellShake', 1);
  const P = engine();
  P.magic.spellVisual({ from: [0, 1, 0], dir: [0, 0, 1], element: 0, rangeType: 2, casterId: 'peer-1' });
  P.fly();
  assert.ok(Math.abs(seen[0] - seen[1]) < 1e-9, 'and a peer\'s at Full kicks as mine does');
});

test('RPT1026-CLIENT: the setting stands beside the recoil, the recoil says it is your own injuries, and Better Ambience\'s shake ceiling is on its tile', () => {
  const motion = CATEGORIES.flatMap((c) => c.sections).find((s) => s.id === 'motion' && s.items.includes('Controls/CameraRecoilStrength')).items;
  assert.equal(motion[motion.indexOf('Controls/CameraRecoilStrength') + 2], 'port:peerSpellShake');
  assert.equal(labelOf('Controls/CameraRecoilStrength'), 'Screen Shake When Hurt');
  assert.ok(MOD_CURATED['better-ambience'].includes('Camera Shake.maxShake'));
});
