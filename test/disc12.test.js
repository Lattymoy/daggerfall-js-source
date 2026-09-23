// DISC12 (2026-09-23, Mac: "Those open tasks? ... tackle it"): the two online gaps DISC10 left - a peer fighting
// with the LEFT hand was drawn and heard with the right hand's weapon (or a fist), and a peer in beast form was
// drawn as the person. The pose carries both now (`lh`, `wb`, world101). 01-Overview/Field-Bugs-2026-09-23.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPose, poseChanged } from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { peerWeaponOf, peerBuildOpts, PeerBodies } from '../src/net/peerBodies.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const sword = { templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand };
const dagger = { templateIndex: 113, group: 'Weapons', material: 3, equipSlot: EQUIP_SLOTS.LeftHand };
const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [sword, dagger] };

test('DISC12 wire: `lh` and `wb` survive the door, clamped, and are OMITTED at 0 - a right-handed human\'s pose is the bytes it always was; each edge goes out at once (mutants: a field dropped at the door; the edge not sent)', () => {
  const base = validPose(P);
  assert.equal('lh' in base, false); assert.equal('wb' in base, false);
  assert.equal(JSON.stringify(validPose({ ...P, lh: 0, wb: 0 })), JSON.stringify(base), 'zeros serialize to the old bytes');
  assert.equal(validPose({ ...P, lh: 1 }).lh, 1);
  assert.equal(validPose({ ...P, wb: 1 }).wb, 1);
  assert.equal(validPose({ ...P, wb: 2 }).wb, 2);
  assert.equal(validPose({ ...P, wb: 9 }).wb, 2, 'clamped by uint, as rd and rv are');
  assert.equal('wb' in validPose({ ...P, wb: -1 }), false, 'a negative is no shape');
  assert.ok(poseChanged(validPose(P), validPose({ ...P, lh: 1 })), 'a hand switch goes out at once');
  assert.ok(poseChanged(validPose(P), validPose({ ...P, wb: 1 })), 'a change of shape goes out at once');
  const eased = lerpPose(validPose(P), validPose({ ...P, lh: 1, wb: 2 }), 0.5);
  assert.equal(eased.lh, 1); assert.equal(eased.wb, 2);
  assert.equal('lh' in lerpPose(validPose(P), validPose(P), 0.5), false);
});

test('DISC12 body: the weapon the peer\'s body holds is the hand in USE - the look carries both, the pose says which; a switch mid-play moves the body\'s weapon through setWeapon (mutants: the right hand always; the switch never followed)', () => {
  assert.equal(peerWeaponOf(LOOK, { lh: 0 })?.templateIndex, 120);
  assert.equal(peerWeaponOf(LOOK, { lh: 1 })?.templateIndex, 113);
  assert.equal(peerBuildOpts(LOOK).weapon?.templateIndex, 120, 'built on the right hand by default');
  const set = [];
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const b = { weapon: peerWeaponOf(LOOK), ammo: 0, held: false, swing: null, cast: null, rig: { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: (w) => { set.push(w?.templateIndex ?? null); return true; } } };
  pb._arm(b, { wd: 1, an: 0, cn: 0, lh: 1 }, LOOK);
  assert.deepEqual(set, [113], 'the left hand\'s dagger');
  assert.equal(b.weapon.templateIndex, 113);
  pb._arm(b, { wd: 1, an: 0, cn: 0, lh: 1 }, LOOK);
  assert.deepEqual(set, [113], 'no re-set while the hand stands');
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.deepEqual(set, [113, 120], 'and back to the right');
});

test('DISC12 doll: a peer in beast form stands as the werewolf or the wereboar - whatever the class-sprite card says - and never takes a Morrowind body; a human peer is untouched (mutants: the beast drawn as the person; the body kept)', () => {
  const asked = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: null }, compose: async () => null });
  rp._mobileFor = (id, mobileType) => { asked.push([id, mobileType]); return null; };
  rp._syncDollPeer = () => {};
  const mk = (id, wb) => ({ id, name: id, look: { ...LOOK, class: '' }, shown: { ...P, ...(wb ? { wb } : {}) } });
  rp.sync([mk('wolf', 1), mk('boar', 2), mk('man', 0)], (p) => [p.x, p.y, p.z], {});
  assert.deepEqual(asked.filter(([id]) => id !== 'man'), [['wolf', MOBILE_TYPES.Werewolf], ['boar', MOBILE_TYPES.Wereboar]]);
  assert.equal(asked.some(([id]) => id === 'man'), false, 'a human with no class keeps the doll');
  assert.match(rd('src/scenes/world.js'), /const afoot = drawable\.filter\(\(d\) => !peerRiders\.isRiding\(d\.id\) && !d\.shown\?\.wb\);/, 'a beast takes no body');
  assert.match(rd('src/scenes/world.js'), /lh: rig\.playerWeapon\.usingRightHand \? undefined : 1,\n\s*wb: \(\(\) => \{ const l = liveLycanthropy\(playerEntity\); return l\?\.isTransformed \? \(l\.infectionType \| 0\) \|\| undefined : undefined; \}\)\(\),/, 'the sender: the live rig\'s hand, the curse\'s form');
});

test('DISC12 pack: the enhanced pack hands the Morrowind figure the weapon of the hand in USE - the live rig\'s, handed by the host (mutant: the right hand always)', async () => {
  const { withDom } = await import('./invdrag.mjs');
  const { mountEnhancedInventory } = await import('../src/ui/enhancedInventory.js');
  const { equipItem } = await import('../src/systems/equip.js');
  const mk = () => ({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', currentCondition: 800, maxCondition: 1000 });
  const dag = () => ({ group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', currentCondition: 50, maxCondition: 100 });
  for (const [right, want] of [[true, 120], [false, 113]]) {
    const e = { isPlayer: true, items: [mk(), dag()], stats: {}, level: 1, career: {}, activeEffects: [], spells: [] };
    equipItem(e, e.items[0]); equipItem(e, e.items[1]);
    const got = [];
    const fpArm = { setWorn() {}, setWeapon: (w) => { got.push(w?.templateIndex ?? null); return true; }, figure: () => null, subscribe: () => () => {} };
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, fpArm, usingRightHand: () => right });
      view.unmount();
    });
    assert.ok(got.length > 0, 'the pack told the figure');
    assert.equal(got.at(-1), want, right ? 'the right hand' : 'the LEFT hand, the one in use');
  }
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(f), /usingRightHand: \(\) => \(modes\?\.liveArm\?\.\(\)\?\.rig \?\? weaponRig\)\.playerWeapon\.usingRightHand,/, f);
  assert.match(rd('src/scenes/dungeonContext.js'), /usingRightHand: \(\) => weaponRig\.playerWeapon\.usingRightHand,/);
});

test('DISC12: U with nothing usable SAYS so, as DFU does (DaggerfallUI.cs:584-585, Internal_Strings.csv:959 verbatim) - in all three hosts; the port opened nothing and said nothing (mutant: a host silent again)', async () => {
  const { NO_ITEM_TO_ACTIVATE_TEXT, createUseMagicItemWindow } = await import('../src/ui/useMagicItemWindow.js');
  assert.equal(NO_ITEM_TO_ACTIVATE_TEXT, 'You have no usable magic item');
  assert.equal(createUseMagicItemWindow({ items: [] }), null, 'no window with nothing usable');
  assert.match(rd('src/scenes/world.js'), /if \(win\) townTalk\.showOverlay\(win\);\n\s*else townTalk\.say\(NO_ITEM_TO_ACTIVATE_TEXT\);/);
  assert.match(rd('src/scenes/worldModes.js'), /if \(win\) mountInterior\(win\);\n\s*else townTalk\?\.say\?\.\(NO_ITEM_TO_ACTIVATE_TEXT\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(win\) activeOverlay = win;\n\s*else hudText\.add\(NO_ITEM_TO_ACTIVATE_TEXT\);/);
});
