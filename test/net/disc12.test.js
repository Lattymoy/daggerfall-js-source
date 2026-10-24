// DISC12 (2026-09-23, Mac: "Those open tasks? ... tackle it"): the two online gaps DISC10 left - a peer fighting
// with the LEFT hand was drawn and heard with the right hand's weapon (or a fist), and a peer in beast form was
// drawn as the person. The pose carries both now (`lh`, `wb`, world101). 01-Overview/bugs/Field-Bugs-2026-09-23.md.
import { test } from 'node:test';
import { poseHandsOf } from '../../src/net/wire.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPose, poseChanged } from '../../src/net/wire.js';
import { lerpPose } from '../../src/net/online.js';
import { peerWeaponOf, peerBuildOpts, PeerBodies } from '../../src/net/peer/peerBodies.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
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

test('DISC12 body: the weapon the peer\'s body holds is the hand in USE - the look carries both, the pose says which; a switch mid-play moves the body\'s weapon through setWeapon (mutants: the right hand always; the switch never followed). PIN MOVED (AUDIT MIXED-PAIR L4-3): a look with a weapon in EACH hand is a pair now - the body holds the right hand\'s and mirrors the left\'s (the local arm\'s own law), so the hand-in-use rule is pinned on one weapon (was: the sword and dagger pair)', () => {
  const LEFT_ONLY = { ...LOOK, items: [dagger] };
  assert.equal(peerWeaponOf(LEFT_ONLY, { lh: 0 }), null, 'the right hand in use: a fist');
  assert.equal(peerWeaponOf(LEFT_ONLY, { lh: 1 })?.templateIndex, 113);
  assert.equal(peerBuildOpts(LOOK).weapon?.templateIndex, 120, 'built on the right hand by default');
  const set = [], offs = [], modes = [];
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const rig = { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: (w) => { set.push(w?.templateIndex ?? null); return true; }, setOffWeapon: (w) => { offs.push(w?.templateIndex ?? null); }, setHands: (h) => { modes.push(`${h.mode}:${h.lead}`); } };
  const b = { weapon: null, ammo: 0, held: false, swing: null, cast: null, rig };
  pb._arm(b, { wd: 1, an: 0, cn: 0, lh: 1 }, LEFT_ONLY);
  assert.deepEqual(set, [113], 'the left hand\'s dagger');
  assert.equal(b.weapon.templateIndex, 113);
  pb._arm(b, { wd: 1, an: 0, cn: 0, lh: 1 }, LEFT_ONLY);
  assert.deepEqual(set, [113], 'no re-set while the hand stands');
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, LEFT_ONLY);
  assert.deepEqual(set, [113, null], 'and back to the right: its fist');
  // a pair: the right hand's sword in the body's right hand whichever leads, the dagger mirrored, the lead the pose's
  set.length = 0; offs.length = 0; modes.length = 0;
  const pair = { weapon: null, ammo: 0, held: false, swing: null, cast: null, rig };
  pb._arm(pair, { wd: 1, an: 0, cn: 0, lh: 1 }, LOOK);
  assert.deepEqual([set, offs.at(-1), modes.at(-1)], [[120], 113, 'dual:L']);
  pb._arm(pair, { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.deepEqual([set, offs.at(-1), modes.at(-1)], [[120], 113, 'dual:R'], 'H moves the lead, never the weapons');
});

test('DISC12 doll: a peer in beast form stands as the werewolf or the wereboar - whatever the class-sprite card says - and never takes a Morrowind body; a human peer is untouched (mutants: the beast drawn as the person; the body kept)', () => {
  const asked = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: null }, compose: async () => null });
  rp._mobileFor = (id, mobileType) => { asked.push([id, mobileType]); return null; };
  rp._syncDollPeer = () => {};
  const mk = (id, wb) => ({ id, name: id, look: { ...LOOK, class: '' }, shown: { ...P, ...(wb ? { wb } : {}) } });
  rp.sync([mk('wolf', 1), mk('boar', 2), mk('man', 0)], (p) => [p.x, p.y, p.z], {});
  assert.deepEqual(asked.filter(([id]) => id !== 'man'), [['wolf', MOBILE_TYPES.Werewolf], ['boar', MOBILE_TYPES.Wereboar]]);
  // the contributor's sprite fix (2026-09-23): a human with no class to go on stands as the THIEF sprite, the Unity
  // mod's own default, rather than the flat doll - and never as a beast
  assert.deepEqual(asked.filter(([id]) => id === 'man'), [['man', 138]], 'a human with no class stands as the Thief, never the beast');
  assert.match(rd('src/scenes/world.js'), /const afoot = seen\.filter\(\(d\) => \(peerRidesIn3d\(d\) \|\| !peerRiders\.isRiding\(d\.id\)\) && !d\.shown\?\.wb \|\| \(peerIsWolf\(d\.shown\) && !d\.shown\.rd\)\);/, 'a wereboar takes no body - and WEREWOLF1: a werewolf on foot goes to the bodies, which stand Bloodmoon\'s wolf for it (test/net/peer/werewolf1.test.js)');   // PIN MOVED (AUDIT COATS3D A3): a rider on the 3D horse the bodies' whether or not its sprite stood in
  // PIN MOVED (AUDIT MIXED-PAIR L4-3): `lh` from poseHandsOf beside `ah` - each omitted at 0, the wire's omission law
  assert.deepEqual(poseHandsOf(true, null), {}, 'right-handed, no left blow: the bytes it always had');
  assert.deepEqual(poseHandsOf(false, null), { lh: 1 });
  assert.deepEqual(poseHandsOf(true, 'L'), { ah: 1 }, 'a pair\'s left hand struck last');
  assert.deepEqual(poseHandsOf(false, 'R'), { lh: 1 });
  assert.match(rd('src/scenes/world.js'), /\.\.\.poseHandsOf\(rig\.playerWeapon\.usingRightHand, rig\.swing\.hand\),[^\n]*\n\s*wb: \(\(\) => \{ const l = liveLycanthropy\(playerEntity\); return l\?\.isTransformed \? \(l\.infectionType \| 0\) \|\| undefined : undefined; \}\)\(\),/, 'the sender: the live rig\'s hand, the curse\'s form');
});

test('DISC12 pack: the enhanced pack hands the Morrowind figure the weapon of the hand in USE - the live rig\'s, handed by the host (mutant: the right hand always)', async () => {
  const { withDom } = await import('../invdrag.mjs');
  const { mountEnhancedInventory } = await import('../../src/ui/enhanced/enhancedInventory.js');
  const { equipItem } = await import('../../src/systems/equip.js');
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
  const { NO_ITEM_TO_ACTIVATE_TEXT, createUseMagicItemWindow } = await import('../../src/ui/useMagicItemWindow.js');
  assert.equal(NO_ITEM_TO_ACTIVATE_TEXT, 'You have no usable magic item');
  assert.equal(createUseMagicItemWindow({ items: [] }), null, 'no window with nothing usable');
  assert.match(rd('src/scenes/world.js'), /if \(win\) townTalk\.showOverlay\(win\);\n\s*else townTalk\.say\(noItemToActivateText\(\)\);/);
  assert.match(rd('src/scenes/worldModes.js'), /if \(win\) mountInterior\(win\);\n\s*else townTalk\?\.say\?\.\(noItemToActivateText\(\)\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(win\) activeOverlay = win;\n\s*else hudText\.add\(noItemToActivateText\(\)\);/);
});
