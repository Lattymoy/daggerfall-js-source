// GLOW-SET (2026-10-30; bible/05-Combat/Weapon-Glow.md
// law 9). Pinned here: /glow's grammar, the word it writes on the weapon or Hand Wraps in hand, that word over every
// other law in both hands and on the look, the item law's words equal to the wire's, and the host's wiring.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as WG from '../../src/systems/weaponGlow.js';
import { parseGlowCommand, runGlowCommand, heldGlowItems, GLOW_HELP_LINE } from '../../src/systems/staffGlow.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { createHandWraps } from '../../src/systems/handWraps.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { mintHourlock } from '../../src/systems/gilded.js';
import { ITEM_FIELDS, validItemField } from '../../src/systems/item/itemFields.js';
import { validLook, LOOK_GLOW_RE } from '../../src/net/wire.js';
import { composeLook } from '../../src/net/remotePlayers.js';
import { staffHelpLines } from '../../src/scenes/staffTp.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const body = () => ({ isPlayer: true, items: [], race: 'Breton', gender: 'male', faceIndex: 0, stats: {}, skills: new Array(35).fill(30), career: {}, activeEffects: [] });

test('GLOW-SET: /glow reads a colour, a strength for the three banded ones, and off', () => {
  assert.deepEqual(parseGlowCommand('/glow fire'), { cmd: 'glow', word: 'fire3' });
  assert.deepEqual(parseGlowCommand('/GLOW Frost 1'), { cmd: 'glow', word: 'frost1' });
  assert.deepEqual(parseGlowCommand('/glow crimson'), { cmd: 'glow', word: 'gilded2' });
  assert.deepEqual(parseGlowCommand('/glow arcane'), { cmd: 'glow', word: 'arcane2' });
  assert.deepEqual(parseGlowCommand('/glow edge'), { cmd: 'glow', word: 'edge2' });
  assert.deepEqual(parseGlowCommand('/glow off'), { cmd: 'glow', word: null });
  for (const bad of ['/glow', '/glow poison', '/glow fire 4', '/glow fire 0', '/glow arcane 3', '/glow fire 2 x']) assert.ok('error' in parseGlowCommand(bad), bad);
  for (const other of ['/glowing', 'glow fire', '/tp Daggerfall']) assert.equal(parseGlowCommand(other), null, other);
  assert.ok(staffHelpLines().includes(GLOW_HELP_LINE));
});

test('GLOW-SET: every word /glow writes is one the wire and the item law take, and the law takes no other', () => {
  const words = [];
  for (const c of ['fire', 'frost', 'shock']) for (const n of [1, 2, 3]) words.push(parseGlowCommand(`/glow ${c} ${n}`).word);
  for (const c of ['arcane', 'crimson', 'brand', 'edge']) words.push(parseGlowCommand(`/glow ${c}`).word);
  assert.deepEqual([...ITEM_FIELDS.glowSet.values].sort(), [...words].sort());
  for (const w of words) { assert.ok(LOOK_GLOW_RE.test(w), w); assert.ok(WG.glowFromWord(w), w); assert.equal(validItemField('glowSet', w), w); }
  assert.equal(validItemField('glowSet', 'fire4'), undefined);
});

test('GLOW-SET: the set word shows over the element, the Gilded crimson and the arcane look, in both hands', () => {
  on();
  const me = body();
  const sword = createWeapon(120, 0, () => 0.5);
  me.items.push(sword); equipItem(me, sword);
  assert.equal(WG.meshGlow(sword), null, 'a plain sword glows not');
  assert.equal(runGlowCommand(me, parseGlowCommand('/glow shock 2')).endsWith('glow set.'), true);
  assert.equal(sword[WG.GLOW_SET_FIELD], 'shock2');
  assert.equal(WG.meshGlow(sword)?.word, 'shock2');
  assert.equal(WG.spriteGlow(sword)?.word, 'shock2');
  const look = validLook(composeLook(me, { eotbSet: null }));
  assert.equal(look.items.find((x) => x.group === 'Weapons').glow, 'shock2', 'peers see it');
  setPref(WG.WEAPON_GLOW_PREF, false);
  assert.equal(WG.meshGlow(sword), null, 'the viewer\'s switch still answers');
  on();
  const gilded = mintHourlock();
  gilded[WG.GLOW_SET_FIELD] = 'frost3';
  assert.equal(WG.meshGlow(gilded)?.word, 'frost3', 'over law 8');
  gilded[WG.GLOW_SET_FIELD] = 'nonsense';
  assert.equal(WG.meshGlow(gilded)?.word, 'gilded2', 'a word the wire does not take is ignored');
  let saved = 0;
  assert.match(runGlowCommand(me, { word: null }, () => saved++), /removed/);
  assert.equal(WG.GLOW_SET_FIELD in sword, false);
  assert.equal(saved, 1);
});

test('GLOW-SET: Hand Wraps take it, and an empty pair of hands is told so', () => {
  on();
  const me = body();
  assert.equal(runGlowCommand(me, { word: 'fire3' }), 'Hold a weapon or wear Hand Wraps first.');
  const wraps = createHandWraps();
  me.items.push(wraps); equipItem(me, wraps);
  assert.deepEqual(heldGlowItems(me), [wraps]);
  runGlowCommand(me, parseGlowCommand('/glow crimson'));
  assert.equal(WG.spriteGlow(wraps)?.word, 'gilded2');
  assert.equal(WG.meshGlow(wraps)?.word, 'gilded2');
});

test('GLOW-SET: the world host asks /glow of staff alone and runs it on my own body', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /isStaffT\(staffGlyphs\(\)\) \? \(parseDragonCommand\(text\) \?\? parseStaffLine\(/);
  assert.match(read('src/scenes/staffTp.js'), /if \(!m\) return parseGlowCommand\(text\) \?\? parseStaffCommand\(text, now\);/);
  assert.match(w, /return c\.cmd === 'glow' \? say\(runGlowCommand\(playerEntity, c, saveSoon\.changed\)\) : staffDragon\.command\(c, say\);/);
});

test('ARMORY-FISTS: a bare fist wears the kit\'s weapon piece - mine and a peer\'s - and wraps or a weapon keep their own', async () => {
  on();
  const { PeerBodies, peerBuildOpts } = await import('../../src/net/peer/peerBodies.js');
  assert.deepEqual(WG.fistGlow('0000a', true), WG.glowSpec('brand', WG.ARMORY_LEVEL));
  assert.deepEqual(WG.fistGlow('0000b', true), WG.glowSpec('edge', WG.ARMORY_LEVEL));
  assert.equal(WG.fistGlow('0000a', false), null, 'my switch off');
  assert.equal(WG.fistGlow('a0000', true), null, 'no weapon piece');
  assert.equal(WG.fistGlow(null, true), null);
  const hand = [];
  const rig = { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: () => true, setWeaponGlow() {}, setOffWeaponGlow() {}, setHandGlow: (s) => hand.push(s) };
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const bare = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
  pb._arm({ weapon: null, ammo: 0, held: false, swing: null, cast: null, rig }, { wd: 1, an: 0, cn: 0 }, bare, '0000b');
  assert.deepEqual(hand.at(-1), WG.glowSpec('edge', WG.ARMORY_LEVEL), 'a peer\'s bare fists, by their kit');
  pb._arm({ weapon: null, ammo: 0, held: false, swing: null, cast: null, rig }, { wd: 1, an: 0, cn: 0 }, bare, null);
  assert.equal(hand.at(-1), null, 'no kit, no glow');
  const sword = { templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand };
  pb._arm({ weapon: sword, ammo: 0, held: false, swing: null, cast: null, rig }, { wd: 1, an: 0, cn: 0 }, { ...bare, items: [sword] }, '0000b');
  assert.equal(hand.at(-1), null, 'a weapon in hand: the fists are not bare');
  const rigSrc = read('src/combat/weapon/weaponRig.js');
  assert.match(rigSrc, /heldGlow = heldFor \? spriteGlow\(heldFor\) : fistGlow\(\);/);
  assert.match(rigSrc, /return w \? glowOf\(w\) : fistGlow\(\); \};/);
  assert.match(rigSrc, /fpArm\.setHandGlow\?\.\(wrapsMeshGlow\(\) \?\? \(armItem \? null : fistGlow\(\)\)\);/);
});
