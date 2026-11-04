import test from 'node:test';
import assert from 'node:assert/strict';
import { playerBodyOn, itemIconsOn } from '../../src/characters/npcBodies.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';
import { modelIconUrl } from '../../src/ui/item/itemIconUrl.js';
import { mwCanThirdPerson, eotbLane } from '../../src/player/mwView.js';

test('mwPlayerBody toggle: player 3D body switches on and off live', () => {
  const origBody = getPref('mwPlayerBody');
  try {
    setPref('mwPlayerBody', true);
    assert.equal(getPref('mwPlayerBody'), true);

    setPref('mwPlayerBody', false);
    assert.equal(getPref('mwPlayerBody'), false);
    assert.equal(playerBodyOn(), false, 'playerBodyOn is false when mwPlayerBody pref is false');
    assert.equal(mwCanThirdPerson(), false, 'mwCanThirdPerson is false when playerBodyOn is false');

    setPref('mwPlayerBody', true);
    assert.equal(getPref('mwPlayerBody'), true);
  } finally {
    setPref('mwPlayerBody', origBody);
  }
});

test('mwItemIcons toggle: 3D item icons switch on and off live', () => {
  const origIcons = getPref('mwItemIcons');
  try {
    setPref('mwItemIcons', true);
    assert.equal(getPref('mwItemIcons'), true);

    setPref('mwItemIcons', false);
    assert.equal(getPref('mwItemIcons'), false);
    assert.equal(itemIconsOn(), false, 'itemIconsOn is false when mwItemIcons pref is false');

    // modelIconUrl must immediately return null when toggle is off
    const fakeArm = { itemIcon: () => ({ width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) }) };
    const fakeItem = { templateIndex: 1, group: 'Weapons' };
    assert.equal(modelIconUrl(fakeItem, 32, fakeArm), null, 'modelIconUrl returns null when mwItemIcons is off');

    setPref('mwItemIcons', true);
    assert.equal(getPref('mwItemIcons'), true);
  } finally {
    setPref('mwItemIcons', origIcons);
  }
});

function createMockCif(recs) {
  const parts = recs.map(({ w, h, frames }) => {
    const head = 12 + 31 * 2 + 2, runs = Math.ceil((w * h) / 127) + 1;
    const b = new Uint8Array(head + runs * 2); const v = new DataView(b.buffer);
    v.setUint16(0, w, true); v.setUint16(2, h, true);
    for (let f = 0; f < frames; f++) v.setUint16(12 + f * 2, head, true);
    for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
    v.setUint16(12 + 62, b.length, true);
    return b;
  });
  const wield = new Uint8Array(12 + 40 * 30); const wv = new DataView(wield.buffer);
  wv.setUint16(4, 40, true); wv.setUint16(6, 30, true); wv.setUint16(10, 40 * 30, true); wield.fill(1, 12);
  const all = [wield, ...parts];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

test('mwPlayerBody=false: classic first-person weapon draws when Morrowind arm is built', async () => {
  const { createWeaponRig } = await import('../../src/combat/weapon/weaponRig.js');
  const { fpArm } = await import('../../src/combat/fpArm.js');
  const { EQUIP_SLOTS } = await import('../../src/systems/equip.js');

  const origBody = getPref('mwPlayerBody');
  const savedReady = fpArm.ready;
  const savedActive = fpArm.active;
  const savedThirdActive = fpArm.thirdActive;
  const savedCanThirdPerson = fpArm.canThirdPerson;

  try {
    setPref('mwPlayerBody', false);

    // fpArm has ready=true when built with Morrowind data
    fpArm.ready = () => true;

    // Because mwPlayerBody is false, player fpArm methods must return false:
    assert.equal(fpArm.active(), false);
    assert.equal(fpArm.thirdActive(), false);
    assert.equal(fpArm.canThirdPerson(), false);

    const MELEE = createMockCif(Array.from({ length: 7 }, () => ({ w: 120, h: 100, frames: 5 })));
    const quads = [];
    const renderer = { uploadTexture: (_k, n) => n, drawScreenQuad: (t, r, u) => quads.push({ t, r, u }) };
    const canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200 };

    const r = createWeaponRig({
      renderer, canvas, audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
      fetchBytes: async () => MELEE,
      entity: { items: [], equip: { slots: { [EQUIP_SLOTS.RightHand]: { templateIndex: 120 } } } }
    });

    r.toggleSheath();
    for (let i = 0; i < 20; i++) {
      r.frame(1 / 60);
      r.draw();
      await new Promise((res) => setTimeout(res, 0));
    }

    assert.ok(quads.length > 0, 'classic weapon quad was drawn despite fpArm being built and thirdActive');
  } finally {
    setPref('mwPlayerBody', origBody);
    fpArm.ready = savedReady;
    fpArm.active = savedActive;
    fpArm.thirdActive = savedThirdActive;
    fpArm.canThirdPerson = savedCanThirdPerson;
  }
});

