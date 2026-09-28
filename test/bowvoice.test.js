// BOW-VOICE (2026-09-26, Mac: "Bow is still double shooting arrows"): ONE LOOSE, ONE SOUND. The bow's loose is
// FPSWeapon's own frame-4 PlaySwingSound - the machine's `bowSound`, which every host plays as ArrowShoot - and the
// Weapon Widget's clone played the same ArrowShoot again at ITS release. On the classic sprite the two landed a tick
// apart; under the Morrowind arm (MW-D42d) the machine's is held for the arm's release key while the clone's went at
// the click, so every shot was heard twice, the draw's length apart - the first twang with no arrow. The clone's bow
// release is silent now (a duplicate of the original's, which the port runs once - the page's own list); its melee
// swing keeps its voice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { fpArm } from '../src/combat/fpArm.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { SOUND } from '../src/systems/soundClips.js';

const LONG_BOW = () => ({ name: 'Long Bow', templateIndex: 130, material: 0 });
const ARROWS = () => ({ name: 'Arrow', templateIndex: 131, stackCount: 20 });
const SWORD = () => ({ name: 'Longsword', templateIndex: 120, material: 0 });

/** A real rig (and, switched on, the real Weapon Widget) with its audio counted; `arm` stands the Morrowind arm in. */
function rigOf({ weapon, drawback = false, widget = true, arm = null }) {
  resetToDefaults(); _resetModSettings();
  setValue('Controls', 'BowDrawback', drawback ? 'True' : 'False');
  setModSetting('weapon-widget', 'Enabled', widget);
  const played = [];
  const entity = { items: [ARROWS()], equip: { slots: { [EQUIP_SLOTS.RightHand]: weapon } }, stats: { speed: 50 } };
  const r = createWeaponRig({
    renderer: { uploadTexture: (_k, name) => name, drawScreenQuad: () => {} },
    canvas: { width: 320, height: 200, clientWidth: 320, clientHeight: 200 },
    entity, audio: { playOneShot: (clip) => played.push(clip), play: () => {}, play3d: () => {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
    fetchBytes: async () => { throw new Error('no art in this pin'); }, activateHeld: () => false,
  });
  r.toggleSheath();
  for (let i = 0; i < 90; i++) r.frame(1 / 60);
  played.length = 0;
  return { r, played };
}

/** One click; every ArrowShoot the player hears (the host's for `bowSound`, the rig's own audio) and every hit, with the frame. */
function shootOnce({ r, played }, { frames = 240, release = null } = {}) {
  const heard = [];
  const hits = [];
  for (let i = 0; i < frames; i++) {
    r.attackInput(0, 0, i === 0);
    if (release && i === release.at) release.go();
    const before = played.length;
    const evs = r.frame(1 / 60);
    for (const clip of played.slice(before)) if (clip === SOUND.ArrowShoot) heard.push(i);
    for (const ev of evs) {
      if (ev === 'bowSound') heard.push(i);   // world.js / worldModes / dungeonContext / exterior: SOUND.ArrowShoot
      if (ev === 'hit') hits.push(i);
    }
  }
  return { heard, hits };
}

for (const drawback of [false, true]) {
  for (const widget of [false, true]) {
    test(`BOW-VOICE: one loose, one ArrowShoot, on the sprite bow (drawback ${drawback}, widget ${widget})`, () => {
      const rig = rigOf({ weapon: LONG_BOW(), drawback, widget });
      // a drawback bow draws while the button is held: hold it through the draw
      const { heard, hits } = drawback ? holdAndLoose(rig) : shootOnce(rig);
      assert.equal(hits.length, 1, 'one arrow');
      assert.equal(heard.length, 1, `one twang, not ${heard.length} (frames ${heard.join(', ')})`);
      assert.ok(Math.abs(heard[0] - hits[0]) <= 8, 'with its arrow');
    });
  }
}

function holdAndLoose({ r, played }) {
  const heard = [];
  const hits = [];
  for (let i = 0; i < 300; i++) {
    r.attackInput(0, 0, i < 40);
    const before = played.length;
    const evs = r.frame(1 / 60);
    for (const clip of played.slice(before)) if (clip === SOUND.ArrowShoot) heard.push(i);
    for (const ev of evs) { if (ev === 'bowSound') heard.push(i); if (ev === 'hit') hits.push(i); }
  }
  return { heard, hits };
}

test('BOW-VOICE: under the Morrowind arm the one twang waits for the arm\'s release key, with the arrow - nothing at the click', () => {
  const keys = ['ready', 'active', 'thirdActive', 'attack', 'takeShootRelease', 'update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setWeapon', 'setScreenTransform', 'draw'];
  const saved = Object.fromEntries(keys.map((k) => [k, fpArm[k]]));
  let released = false;
  Object.assign(fpArm, {
    ready: () => true, active: () => true, thirdActive: () => false, attack: () => 'shoot', setWeapon: () => true,
    takeShootRelease: () => { if (!released) return false; released = false; return true; },
  });
  for (const k of ['update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setScreenTransform', 'draw']) fpArm[k] = () => {};
  try {
    for (const widget of [false, true]) {
      released = false;
      const rig = rigOf({ weapon: LONG_BOW(), widget });
      const { heard, hits } = shootOnce(rig, { release: { at: 45, go: () => { released = true; } } });
      assert.deepEqual(hits, [45], `widget ${widget}: the arrow leaves at the arm's release`);
      assert.deepEqual(heard, [45], `widget ${widget}: and the one twang with it - never at the click`);
    }
  } finally {
    Object.assign(fpArm, saved);
  }
});

test('BOW-VOICE: the clone\'s melee swing keeps its voice - only the bow\'s release was a duplicate', () => {
  const w = readFileSync(new URL('../src/combat/weaponWidget.js', import.meta.url), 'utf8');
  const body = (name) => w.slice(w.indexOf(name), w.indexOf('\n  }\n', w.indexOf(name)));
  assert.doesNotMatch(body('function* playBowAnimation()'), /playSwingSound\(\)/, 'the bow\'s release is the machine\'s voice alone');
  assert.match(body('function* playVanillaWeaponAnimation(state)'), /if \(w\.currentFrame === hitFrame\(\)\) \{\s*playSwingSound\(\);/, 'the vanilla swing\'s voice at its hit frame');
  assert.match(w, /changeWeaponState\(state\);\n    playSwingSound\(\);/, 'the modded swing\'s voice at its strike');
});
