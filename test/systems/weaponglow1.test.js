// WEAPON-GLOW1 (2026-10-16, Mac: "What if we designed our own sort of animated outline for each element? And even
// introduced the same, more detailed design for the morrowind weapons?" ... "this is your baby"; bible/05-Combat/
// Weapon-Glow.md; the audit, bible/01-Overview/audits/Audit-Weapon-Glow.md). The laws pinned here:
//   - THE ELEMENT IS THE BLOW'S: a weapon's `elemental` lines, rolled or socketed, read as the blow reads them
//     (lootRarity.js readLines - lootPowers.js linesOf is the same reader); the most of one element shows, a tie in
//     PROC_ELEMENTS' order; its level the band its total reads in; nothing for a piece not yet identified, with the
//     switch off, or with the ladder off; the Morrowind hand's arcane look (one level) for a weapon DFU calls enchanted.
//   - THE CLASSIC HAND swings the plain sheet while an element shows (plainWeaponType) and draws the outline over the
//     frame, on its rect and its mirror, measured in the frame's own pixels; the clone and the Thunderlock the same.
//   - THE RENDERER: drawScreenQuadGlow is the fourth 2D primitive, reading a field baked once a frame and look; the
//     Morrowind pass draws the rings (instanced, a D16 step apart, at a depth the body quad keeps) BEFORE the body and
//     the charge after, the weapon's shown ranges alone, in a sprite pass alone, and hands every state back.
//   - THE ARM lays the glow only on the weapon it was asked of, and only in hand; a third-person picture is padded for it.
//   - THE WIRE carries a held weapon's glow as one of ten words, a weapon in a hand's alone, omitted when none; a peer's
//     body reads it off the look by the viewer's own switch.
//   - THE CLOCK: every scroll is whole over GLOW_CLOCK_PERIOD (its noise periodic over exactly the rows it scrolls),
//     every pulse and turn a whole number of turns.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import * as WG from '../../src/systems/weaponGlow.js';
import * as GL from '../../src/render/weaponGlowGlsl.js';
import { isEnchanted } from '../../src/systems/inventory.js';
import { mintHourlock, mintGilded, DRAGONFIRE_OATH } from '../../src/systems/gilded.js';
import { createRegularMagicItem } from '../../src/systems/loot/loot.js';
import { MAGIC_ITEM_RECORD_SIZE, ENCHANTMENT_TYPES, readMagicDef } from '../../src/formats/magicDef.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPON_TYPES, plainWeaponType, weaponTypeForItem, drawFpsWeapon, getWeaponAnims } from '../../src/combat/fpsWeapon.js';
import { atlasFileName, moddedWeaponFilename } from '../../src/combat/diverseWeapons/diverseWeapons.js';
import { createFpArm } from '../../src/combat/fpArm.js';
import { validLookItem, validLook, LOOK_GLOW_RE, LOOK_GLOW_SLOTS, lookGlowOk } from '../../src/net/wire.js';
import { composeLook, peerStubEntity } from '../../src/net/remotePlayers.js';
import { PeerBodies, peerWeaponOf, peerBuildOpts } from '../../src/net/peer/peerBodies.js';
import { GATHER_POSE_ACTS } from '../../src/net/peer/peerGather.js';
import { OnlineSession } from '../../src/net/online.js';
import { Renderer } from '../../src/render/renderer.js';
import { drawRigSpriteBox } from '../../src/render/characterSprite.js';
import { perspective, lookAt } from '../../src/world/mat4.js';
import { FEATURES } from '../../src/systems/features.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const ELEMENT_ROLL = { fire: 0, frost: 0.4, shock: 0.8 };
const sword = () => createWeapon(120, 0, () => 0.5);   // a Longsword, as a body drops it

/** A Magic longsword minted at a door whose last pass took a line of `element` at the band's top - the producer's own
 *  shape (applyRarity, then addProcLine: the kind, the value, the param). */
function mintMagic(element, top = true) {
  const it = sword();
  LR.applyRarity(it, 'magic', lcg(7));
  const line = LR.addProcLine(it, seq(0, top ? 0.99 : 0, ELEMENT_ROLL[element]));
  return { it, line };
}
/** A Rare longsword, identified, two sockets empty. */
function mintRare() {
  const it = sword();
  LR.applyRarity(it, 'rare', lcg(11));
  it.isIdentified = true;
  it.sockets = [LR.SOCKET_EMPTY, LR.SOCKET_EMPTY];
  return it;
}
/** MAGIC.DEF's bytes for these records (MagicItemsFile.ReadNextMagicItem's 62 bytes each - fb1001_identify's). */
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = 0;
  }
  return buf;
}
/** DFU's own magic weapon, as CreateRegularMagicItem mints it off MAGIC.DEF - a group 2 record (always Weapons). */
const dfuMagicWeapon = () => createRegularMagicItem(readMagicDef(magicDefBytes([{ name: '%it of Flames', type: 0, group: 2, ench: [[ENCHANTMENT_TYPES.CastWhenStrikes, 14]], uses: 1000, value: 800 }])), 1, 'male', seq(0, 0.2, 0.3, 0.5));

test('WEAPON-GLOW1: the element is the blow\'s - a minted line names it, at the band it reads in', () => {
  on();
  for (const el of LR.PROC_ELEMENTS) {
    const { it, line } = mintMagic(el);
    assert.deepEqual([line.id, line.param, line.value], ['elemental', el, LR.AFFIX_RANGES.elemental.magic[1]]);
    assert.deepEqual(WG.weaponElement(it), { element: el, total: 3 });
    assert.deepEqual(WG.weaponGlow(it, { on: true }), { look: el, level: 1 });
    // the blow's own reader agrees on the number
    assert.equal(LP.linesOf(it, 'elemental').filter((a) => a.param === el).reduce((n, a) => n + a.value, 0), 3);
  }
  // law 3: the bands' own edges
  assert.deepEqual(WG.GLOW_LEVEL_EDGES, [LR.AFFIX_RANGES.elemental.magic[1], LR.AFFIX_RANGES.elemental.rare[1]]);
  assert.deepEqual([1, 3, 4, 6, 7, 10, 16].map(WG.glowLevel), [1, 1, 2, 2, 3, 3, 3]);
  // a weapon with no element shows nothing, and no other kind names one
  const plain = sword();
  LR.applyRarity(plain, 'magic', lcg(7));
  assert.equal(LR.addProcLine(plain, seq(0.3, 0.5)).id, 'leech');
  assert.equal(WG.weaponElement(plain), null);
  assert.equal(WG.weaponGlow(plain, { on: true }), null);
  // AUDIT WEAPON-GLOW LAW-1: a line the law does not hold names nothing - past the Legendary band, a param no blow
  // carries, a value that is no count
  for (const bad of [{ param: 'fire', value: LR.AFFIX_RANGES.elemental.legendary[1] + 1 }, { param: 'poison', value: 3 }, { param: 'fire', value: 2.5 }, { param: 'fire', value: 0 }]) {
    const forged = sword();
    LR.applyRarity(forged, 'magic', lcg(7));
    forged.affixes = [{ id: 'elemental', ...bad }];
    assert.equal(WG.weaponElement(forged), null, JSON.stringify(bad));
  }
});

test('WEAPON-GLOW1: the Legendary band reads level 3 - an Exalted\'s own elemental line, and the Hourlock\'s', () => {
  on();
  // exaltLegendary, the producer of the Exalted line, aimed at its elemental kind
  const it = sword();
  LR.applyRarity(it, 'legendary', lcg(5));
  it.isIdentified = true;   // its lines read - a Legendary drops unknown, as every enchanted piece does
  const pool = LR.AFFIX_IDS.filter((id) => LR.AFFIX_KINDS[id].groups.includes(it.group) && !it.affixes.some((a) => a?.id === id));
  assert.ok(pool.includes('elemental'), 'the fixture\'s Legendary carries no element of its own');
  assert.equal(WG.weaponGlow(it, { on: true }), null);
  assert.equal(LR.exaltLegendary(it, seq((pool.indexOf('elemental') + 0.5) / pool.length, 0.99, 0)), true);
  const line = it.affixes.find((a) => a.id === 'elemental');
  assert.ok(line.value > LR.AFFIX_RANGES.elemental.rare[1]);
  assert.deepEqual(WG.weaponGlow(it, { on: true }), { look: line.param, level: 3 });
  // the Gilded rung's: the Hourlock's line is the Legendary band's top - and it carries no DFU enchantment
  const hour = mintHourlock();
  assert.deepEqual(WG.weaponGlow(hour, { on: true }), { look: 'shock', level: 3 });
  assert.equal(WG.spriteGlow(hour, { on: true }), WG.glowSpec('shock', 3));
  // AUDIT WEAPON-GLOW LAW-2: a Gilded piece with no element is BARE in both hands - its powers are its record's, and
  // it carries no enchantment for the arcane look to say (bible/05-Combat/Weapon-Glow.md "Not done")
  const oath = mintGilded(DRAGONFIRE_OATH);
  assert.equal(isEnchanted(oath), false);
  assert.equal(WG.meshGlow(oath, { on: true }), null);
});

test('WEAPON-GLOW1: gems count as the blow reads them - capped; the most wins, a tie in PROC_ELEMENTS\' order', () => {
  on();
  const tie = mintRare();
  LR.setGem(tie, 'sapphire'); LR.setGem(tie, 'ruby');   // frost 3 then fire 3: a tie, and fire is first
  assert.deepEqual(WG.weaponElement(tie), { element: 'fire', total: 3 });
  const more = mintRare();
  LR.setGem(more, 'ruby'); LR.setGem(more, 'perfect-sapphire');   // fire 3, frost 6
  assert.deepEqual(WG.weaponElement(more), { element: 'frost', total: 6 });
  assert.deepEqual(WG.weaponGlow(more, { on: true }), { look: 'frost', level: 2 });
  const capped = mintRare();
  LR.setGem(capped, 'perfect-ruby'); LR.setGem(capped, 'perfect-ruby');   // 6 + 6, and law 6 holds the gems to one Rare line
  assert.deepEqual(WG.weaponElement(capped), { element: 'fire', total: LR.gemPieceCap('elemental') });
  // a line and its gem together read past the Rare band: the Legendary's strength
  const { it } = mintMagic('fire');
  it.sockets = [LR.SOCKET_EMPTY];
  LR.setGem(it, 'perfect-ruby');
  assert.deepEqual(WG.weaponGlow(it, { on: true }), { look: 'fire', level: 3 });
});

test('WEAPON-GLOW1: law 4 - the outline says no more than the card; law 5 - the Morrowind hand\'s arcane, DFU\'s enchantment\'s', () => {
  on();
  const it = mintRare();
  LR.setGem(it, 'ruby');
  it.isIdentified = false;
  assert.ok(isEnchanted(it), 'a Rare carries its DFU enchantment');
  assert.equal(WG.weaponElement(it), null, 'unidentified, its lines are hidden');
  assert.equal(WG.spriteGlow(it, { on: true }), null, 'the classic hand swings what DFU swings');
  assert.equal(WG.meshGlow(it, { on: true }), WG.glowSpec('arcane', WG.ARCANE_LEVEL), 'the Morrowind hand glows as enchanted');
  it.isIdentified = true;
  assert.equal(WG.spriteGlow(it, { on: true }).look, 'fire');
  assert.equal(WG.meshGlow(it, { on: true }).look, 'fire');
  // a Magic piece carries no enchantment: no arcane for it, ever
  const plain = sword();
  LR.applyRarity(plain, 'magic', lcg(7));
  assert.equal(WG.meshGlow(plain, { on: true }), null);
  // AUDIT WEAPON-GLOW LAW-1: DFU's own magic weapon (MAGIC.DEF, CreateRegularMagicItem) - no ladder line, its enchantment
  // DFU's: the arcane look in the Morrowind hand with the ladder ON and OFF, as its WEAPO1xx sheet is swung either way;
  // the classic hand never draws it (its sheet is the enchanted look)
  const dfu = dfuMagicWeapon();
  assert.equal(dfu.group, 'Weapons');
  assert.ok(isEnchanted(dfu));
  for (const ladder of [true, false]) {
    _resetForTests(); setPref('lootRarity', ladder);
    assert.equal(WG.meshGlow(dfu), WG.glowSpec('arcane', 2), `the ladder ${ladder ? 'on' : 'off'} - read off the pref`);
    assert.equal(WG.spriteGlow(dfu), null);
  }
  // the arcane look has one strength (law 5), and only it
  assert.equal(WG.ARCANE_LEVEL, 2);
  assert.deepEqual([1, 2, 3].map((l) => WG.glowSpec('arcane', l)?.level ?? null), [null, 2, null]);
});

test('WEAPON-GLOW1: the switch, its kill door and the ladder\'s own switch', () => {
  on();
  const { it } = mintMagic('shock');
  assert.ok(WG.weaponGlow(it));
  setPref(WG.WEAPON_GLOW_PREF, false);
  assert.equal(WG.weaponGlowOn(''), false);
  assert.equal(WG.weaponGlow(it), null);
  assert.equal(WG.spriteGlow(it), null);
  setPref(WG.WEAPON_GLOW_PREF, true);
  assert.equal(WG.weaponGlowOn(''), true);
  assert.equal(WG.weaponGlowOn('?weaponglow=off'), false, 'the kill door');
  assert.equal(WG.weaponGlow(it, { ladder: false }), null, 'the ladder off reads no line');
  // AUDIT WEAPON-GLOW LAW-1: and the ladder's PREF off, asked with no option - the ask every drawer makes
  setPref('lootRarity', false);
  assert.equal(WG.weaponGlow(it), null, 'the ladder\'s own pref off');
  assert.equal(WG.meshGlow(it), null, 'no line, and a Magic piece no enchantment');
  setPref('lootRarity', true);
  // the Features row stores the switch's own key, on by default, the player's own online
  const row = FEATURES.find((f) => f.id === 'weapon-glow');
  assert.deepEqual([row.control.key, row.control.initial, row.control.online], [WG.WEAPON_GLOW_PREF, true, 'player']);
});

test('WEAPON-GLOW1: a spec is built once a look and level - the frame asks and allocates nothing; the words are the wire\'s ten', () => {
  const a = WG.glowSpec('fire', 2), b = WG.glowSpec('fire', 2);
  assert.equal(a, b);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.ramp), 'the spec and its ramp frozen whole');
  assert.deepEqual([a.look, a.code, a.level, a.word, [...a.ramp], a.win], ['fire', WG.GLOW_CODE.fire, 2, 'fire2', WG.GLOW_RAMPS.fire.flat(), GL.GLOW_SPRITE_WINDOW.fire]);
  assert.equal(WG.glowSpec('none', 1), null);
  assert.equal(WG.glowSpec('poison', 1), null, 'no element but the blow\'s three and the arcane');
  for (const level of [0, 4, 1.5, '2', null, undefined, -1]) assert.equal(WG.glowSpec('fire', level), null, `level ${String(level)}`);
  assert.equal(WG.glowSpec('hasOwnProperty', 1), null, 'no prototype key is a look');
  assert.deepEqual(WG.GLOW_LOOKS, ['none', 'fire', 'frost', 'shock', 'arcane']);
  for (const look of ['fire', 'frost', 'shock', 'arcane']) {
    const r = WG.GLOW_RAMPS[look];
    assert.equal(r.length, 4);
    const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    for (let i = 1; i < 4; i++) assert.ok(lum(r[i]) > lum(r[i - 1]), `${look}: the ramp climbs, dark to hot`);
  }
  // AUDIT WEAPON-GLOW LAW-7 / NET-4: the specs' words are EXACTLY the words the wire's pattern takes - ten
  const words = [];
  for (const look of WG.GLOW_LOOKS) for (let l = 0; l <= 4; l++) words.push(`${look}${l}`);
  const specWords = words.filter((w) => WG.glowFromWord(w));
  assert.equal(specWords.length, 10);
  assert.deepEqual(words.filter((w) => LOOK_GLOW_RE.test(w)), specWords);
  for (const w of specWords) assert.equal(WG.glowWord(WG.glowFromWord(w)), w, 'the word reads back to itself');
  for (const bad of [null, 3, '', 'FIRE1', 'fire1 ']) assert.equal(WG.glowFromWord(bad), null);
});

test('WEAPON-GLOW1: the classic hand swings the PLAIN sheet while an element shows', () => {
  const T = WEAPON_TYPES;
  // AUDIT WEAPON-GLOW DOC-12: every type the table knows - a *_Magic its plain twin, every other itself
  for (const [k, v] of Object.entries(T)) assert.equal(plainWeaponType(v), k.endsWith('_Magic') ? T[k.slice(0, -'_Magic'.length)] : v, k);
  assert.ok(Object.keys(T).filter((k) => k.endsWith('_Magic')).length >= 8);
  // Diverse Weapons asks its plain set too, and the item's own answer is unchanged when nothing is said
  on();
  const it = mintRare();
  assert.equal(weaponTypeForItem(it), T.LongBlade_Magic);
  assert.equal(moddedWeaponFilename(it), 'LONGSWORDMAGIC.CIF');
  assert.equal(moddedWeaponFilename(it, false), 'LONGSWORD.CIF');
  assert.equal(atlasFileName(it, 'WEAPON04.CIF', true, false), 'LONGSWORD.CIF');
  assert.equal(atlasFileName(it, 'WEAPON04.CIF', true), 'LONGSWORDMAGIC.CIF');
  // the rig: one ask a frame, the art's type and key and loader all off it, the clone told the plain set
  const rig = strip(read('src/combat/weapon/weaponRig.js'));
  assert.match(rig, /const askHeld = \(\) => \{ heldFor = playerWeapon\.weapon; heldGlow = spriteGlow\(heldFor\); \};/);
  assert.match(rig, /const glowOf = \(item\) => \(item && item === heldFor \? heldGlow : spriteGlow\(item\)\);/, 'the weapon it was asked of, never another\'s');
  assert.match(rig, /const heldGlowNow = \(\) => \{ if \(playerWeapon\.weapon !== heldFor\) askHeld\(\); return heldGlow; \};/);
  assert.match(rig, /syncWorn\(\);[^\n]*\n\s*askHeld\(\);/, 'asked once a frame, after the hand is synced');
  assert.match(rig, /const heldType = \(item\) => \(glowOf\(item\) \? plainWeaponType\(weaponTypeForItem\(item\)\) : weaponTypeForItem\(item\)\);/);
  assert.match(rig, /const plain = !!glowOf\(item\);\s*const type = heldType\(item\);/);
  assert.match(rig, /atlasFileName\(item, WEAPON_FILE\[type\] \?\? '', undefined, plain \? false : undefined\)/);
  assert.match(rig, /loadFpsWeaponArt\(fetchBytes, palette, renderer, type, item\?\.material \?\? 0, item, \{ plain \}\)/);
  // PIN MOVED (TWO-HANDS): a clone's frame is built per hand's item (weaponRig.js cloneFrame - the one hand's, or each of
  // a pair's), its set and outline that item's own
  assert.match(rig, /weaponType: heldType\(item\), material: item\?\.material \?\? -1, glow: glowOf\(item\),/, 'the clone told the set and the outline');
  // PIN MOVED (PISTOLET): the frame drawn through the hand's mirror (`uv`), each pistol of a pair outlined by its own
  // glow, and the field in the art's NATIVE pixels - the Thunderlock's union box, the Pistolet's own texture size (AUDIT
  // PISTOLET B4: its union box is in design pixels)
  assert.match(rig, /renderer\.drawScreenQuad\(tex, rect, uv, lit \?\? undefined\);\s*const elementGlow = hand \? glowOf\(playerWeapon\.handItem\(hand\)\) : heldGlowNow\(\);[^\n]*\n\s*if \(elementGlow\) renderer\.drawScreenQuadGlow\?\.\(tex, rect, uv, elementGlow, \{ art: art\.native \? \[art\.native\.w, art\.native\.h\] : \[art\.unionBox\.w, art\.unionBox\.h\], view: \[canvas\.width, canvas\.height\] \}\);/, 'the Thunderlock\'s frame, then its outline - in its art\'s native pixels');
  assert.match(rig, /\{ tint: fpTint, offsetHeight: weaponOffsetHeight\(\) - climbDrop\(_climbLower, c\.height\), glow: heldGlowNow\(\) \}/);
  const widget = strip(read('src/combat/weapon/weaponWidget.js'));
  assert.match(widget, /renderer\.drawScreenQuad\(tex, getWeaponRect\(\), w\.curAnimRect, tint \?\? undefined\);\s*if \(ctx\.glow\) renderer\.drawScreenQuadGlow\?\.\(tex, getWeaponRect\(\), w\.curAnimRect, ctx\.glow, \{ art: \[rec\.width, rec\.height\], view: \[canvas\.width, canvas\.height\] \}\);/, 'the clone\'s frame, then its outline, on its rect and mirror, in the record\'s pixels');
  // PIN MOVED (TWO-HANDS): the item the arm HOLDS (armItem: the one hand's, or a pair's right hand's whichever strikes),
  // and a pair's left blade its own
  assert.match(rig, /fpArm\.setWeaponGlow\?\.\(meshGlow\(armItem\), armItem\);\s*fpArm\.setOffWeaponGlow\?\.\(offItem \? meshGlow\(offItem\) : null, offItem\);/, 'the Morrowind hand told the spec and the weapon it is of');
  assert.match(widget, /atlasFileName\(w\.specificWeapon, classic, undefined, ctx\?\.glow \? false : undefined\)/);
});

test('WEAPON-GLOW1: drawFpsWeapon draws the outline over the frame - its rect, its mirror, its record\'s pixels, after the frame', () => {
  const calls = [];
  const renderer = {
    drawScreenQuad: (tex, rect, src, tint) => calls.push(['quad', tex, rect, src, tint]),
    drawScreenQuadGlow: (tex, rect, src, glow, frame) => calls.push(['glow', tex, rect, src, glow, frame]),
  };
  const art = { weaponType: WEAPON_TYPES.LongBlade, anims: getWeaponAnims(WEAPON_TYPES.LongBlade), records: Array.from({ length: 7 }, (_, r) => ({ width: 100, height: 80, frames: [`r${r}f0`, `r${r}f1`, `r${r}f2`, `r${r}f3`, `r${r}f4`] })) };
  const spec = WG.glowSpec('fire', 2);
  drawFpsWeapon(renderer, { width: 640, height: 400 }, art, 'Idle', 0, { flipHorizontal: true, offsetHeight: 0, tint: [0.5, 0.5, 0.5], glow: spec });
  assert.deepEqual(calls.map((c) => c[0]), ['quad', 'glow']);
  assert.equal(calls[1][1], calls[0][1], 'the same frame');
  assert.deepEqual(calls[1][2], calls[0][2], 'the same rect');
  assert.deepEqual(calls[1][3], calls[0][3], 'the same mirror');
  assert.deepEqual(calls[1][3], { u0: 1, v0: 0, u1: 0, v1: 1 });
  assert.equal(calls[1][4], spec);
  assert.deepEqual(calls[1][5], { art: [100, 80], view: [640, 400] }, 'measured in the record\'s own pixels, on the screen it is laid out on');
  calls.length = 0;
  drawFpsWeapon(renderer, { width: 640, height: 400 }, art, 'Idle', 0, { flipHorizontal: false, offsetHeight: 0 });
  assert.deepEqual(calls.map((c) => c[0]), ['quad'], 'no glow, no second draw');
});

/** A WebGL2 stub that RECORDS: every call's name and arguments, an enum read as its own name. */
function loggingRenderer() {
  const log = [];
  let id = 0;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ uniform: name });
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'drawingBufferWidth') return 800;
      if (k === 'drawingBufferHeight') return 600;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 800, clientHeight: 600, width: 800, height: 600 };
  return { r: new Renderer(canvas), log };
}
const I = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('WEAPON-GLOW1: drawScreenQuadGlow - the fourth 2D primitive: a field baked once a frame and look, then one read a pixel', () => {
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  const tex = { id: 'frame' };
  const spec = WG.glowSpec('fire', 3);
  const [wx, up, down] = GL.GLOW_SPRITE_WINDOW.fire;
  r.setScreenOffset?.(10, 20);
  log.length = 0;
  const frame = { art: [60, 48], view: [800, 600] };
  r.drawScreenQuadGlow(tex, { x: 100, y: 50, w: 300, h: 240 }, { u0: 1, v0: 0, u1: 0, v1: 1 }, spec, frame);
  const names = log.map((c) => c[0]);
  const draws = names.flatMap((n, i) => (n === 'drawElements' ? [i] : []));
  assert.equal(draws.length, 2, 'the bake, then the outline');
  const [bake, draw] = draws;
  const uniAt = (name, from, to) => log.slice(from, to).find((c) => c[1]?.uniform === name);
  // the bake: its own target, the field's size, its program; the frame's target and viewport handed back after
  const fieldTex = log.find((c) => c[0] === 'texImage2D');
  assert.deepEqual(fieldTex.slice(3, 6), ['RGBA8', 60 + 2 * wx, 48 + down], 'the field: the frame, the window either side and over its top');
  const fbAt = log.findIndex((c) => c[0] === 'bindFramebuffer' && c[2]?.kind === 'createFramebuffer');
  assert.ok(fbAt >= 0 && fbAt < bake);
  assert.ok(log.slice(0, bake).some((c) => c[0] === 'useProgram' && c[1] === r.weaponGlowFieldProgram));
  assert.deepEqual(uniAt('uArt', fbAt, bake).slice(2), [60, 48]);
  assert.deepEqual(uniAt('uWin', fbAt, bake).slice(2), [wx, up, down]);
  assert.deepEqual(uniAt('uFieldPad', fbAt, bake).slice(2), [wx, down, wx, 0]);
  assert.deepEqual(uniAt('uCut', fbAt, bake).slice(2), [0, 0, 1], 'the bottom alone is cut - a frame mid-screen');
  assert.equal(uniAt('uDmax', fbAt, bake)[2], GL.glowFieldReach('fire'));
  const back = log.slice(bake, draw);
  assert.ok(back.some((c) => c[0] === 'bindFramebuffer' && c[2] === null), 'the frame\'s target (the canvas) back');
  assert.ok(back.some((c) => c[0] === 'viewport' && c[3] === 800 && c[4] === 600), 'and the world\'s viewport');
  // the outline: its program, the frame's rect and mirror, its pads, the field on unit 1
  assert.ok(log.slice(bake, draw).some((c) => c[0] === 'useProgram' && c[1] === r.weaponGlowQuadProgram), 'its own program');
  assert.deepEqual(uniAt('uDst', bake, draw).slice(2), [110, 70, 300, 240], 'the rect, the screen offset on it');
  assert.deepEqual(uniAt('uSrc', bake, draw).slice(2), [1, 0, 0, 1], 'the mirror');
  assert.deepEqual(uniAt('uPad', bake, draw).slice(2), [wx, down, wx, 0], 'the top grows by the rows a cell looks down; the bottom is the arm\'s cut');
  assert.deepEqual(uniAt('uArt', bake, draw).slice(2), [60, 48]);
  assert.deepEqual(uniAt('uFieldAt', bake, draw).slice(2), [wx, down]);
  assert.deepEqual([uniAt('uLook', bake, draw)[2], uniAt('uLevel', bake, draw)[2]], [WG.GLOW_CODE.fire, 3]);
  assert.equal(uniAt('uReachMax', bake, draw)[2], GL.GLOW_REACH_MAX.fire);
  assert.equal(uniAt('uRamp', bake, draw)[2], spec.ramp);
  const field = log.find((c) => c[0] === 'framebufferTexture2D')[4];
  const unit1 = log.findIndex((c, i) => i > bake && c[0] === 'activeTexture' && c[1] === 'TEXTURE1');
  assert.ok(unit1 > bake && log[unit1 + 1][0] === 'bindTexture' && log[unit1 + 1][2] === field, 'the field on unit 1');
  const blendAt = log.findIndex((c, i) => i > bake && c[0] === 'blendFunc' && c[1] === 'ONE' && c[2] === 'ONE_MINUS_SRC_ALPHA');
  assert.ok(blendAt > bake && blendAt < draw, 'premultiplied, set before the draw');
  assert.ok(log.slice(draw).some((c) => c[0] === 'blendFunc' && c[1] === 'SRC_ALPHA'), 'and the blend handed back');
  assert.ok(log.slice(draw).some((c) => c[0] === 'disable' && c[1] === 'BLEND'));
  // the next frame of the same picture reads the field it baked: one draw
  log.length = 0;
  r.drawScreenQuadGlow(tex, { x: 100, y: 50, w: 300, h: 240 }, { u0: 1, v0: 0, u1: 0, v1: 1 }, WG.glowSpec('fire', 1), frame);
  assert.equal(log.filter((c) => c[0] === 'drawElements').length, 1, 'a level is a band over the same field');
  assert.equal(log.filter((c) => c[0] === 'texImage2D').length, 0);
  // another look is another field
  log.length = 0;
  r.drawScreenQuadGlow(tex, { x: 100, y: 50, w: 300, h: 240 }, undefined, WG.glowSpec('frost', 1), frame);
  assert.equal(log.filter((c) => c[0] === 'drawElements').length, 2);
  // AUDIT WEAPON-GLOW SPR-3: a frame flush with the screen's right is cut there - no pad, and the bake's cut on the
  // TEXTURE's side: the right unmirrored, the left mirrored
  for (const [mirror, cut] of [[false, [0, 1, 1]], [true, [1, 0, 1]]]) {
    log.length = 0;
    const t2 = { id: `flush${mirror}` };
    r.drawScreenQuadGlow(t2, { x: 500, y: 360, w: 300, h: 240 }, mirror ? { u0: 1, v0: 0, u1: 0, v1: 1 } : undefined, spec, frame);
    const [b2] = log.flatMap((c, i) => (c[0] === 'drawElements' ? [i] : []));
    assert.deepEqual(log.slice(0, b2).find((c) => c[1]?.uniform === 'uCut').slice(2), cut, mirror ? 'mirrored' : 'as drawn');
    assert.deepEqual(log.slice(b2).find((c) => c[1]?.uniform === 'uPad').slice(2), [wx, down, 0, 0], 'no band into the screen\'s edge or the pillar past it');
  }
  // nothing to draw without a glow, a texture or a look
  log.length = 0;
  r.drawScreenQuadGlow(tex, { x: 0, y: 0, w: 1, h: 1 }, undefined, null);
  r.drawScreenQuadGlow(null, { x: 0, y: 0, w: 1, h: 1 }, undefined, spec);
  assert.equal(log.filter((c) => c[0] === 'drawElements').length, 0);
  // the source law's own list knows the primitive and its bake
  assert.match(read('test/render/glstate.test.js'), /'drawScreenQuadGlow', '_ensureWeaponGlowQuadProgram', '_glowField'/);
});

test('WEAPON-GLOW1: the fields kept are GLOW_FIELDS_MAX - the least recently drawn deleted first', () => {
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  const spec = WG.glowSpec('shock', 2);
  const texs = Array.from({ length: GL.GLOW_FIELDS_MAX + 1 }, (_, i) => ({ id: `f${i}` }));
  const fieldOf = new Map();
  for (const t of texs) {
    log.length = 0;
    r.drawScreenQuadGlow(t, { x: 100, y: 50, w: 60, h: 48 }, undefined, spec, { art: [60, 48] });
    fieldOf.set(t, log.find((c) => c[0] === 'framebufferTexture2D')?.[4]);
    if (t === texs[1]) r.drawScreenQuadGlow(texs[0], { x: 100, y: 50, w: 60, h: 48 }, undefined, spec, { art: [60, 48] });   // the first drawn again: the second is now the oldest
  }
  const deleted = log.filter((c) => c[0] === 'deleteTexture').map((c) => c[1]);
  assert.deepEqual(deleted, [fieldOf.get(texs[1])], 'one over the cap: the least recently drawn goes');
  assert.equal(r._glowFieldList.length, GL.GLOW_FIELDS_MAX);
});

test('WEAPON-GLOW1: the sprite\'s window holds every cell its band and embers reach, the reach clamped where it stops (SPR-2)', () => {
  // the reach's top, off gwReach's own numbers at level 3 and its noise at 1 - a change to them fails here
  const src = GL.GLOW_LOOK_GLSL;
  assert.match(src, /return \(1\.2 \+ 1\.0 \* lv\) \* \(0\.5 \+ n1 \* \(0\.75 \+ 0\.5 \* n2\)\);/);
  assert.match(src, /return 0\.8 \+ 0\.8 \* lv \+ spike \* \(0\.6 \+ 0\.6 \* lv\) \+ 0\.5 \* breath;/);
  assert.match(src, /return 1\.6 \+ 0\.3 \* lv \+ smoothstep\(0\.55, 0\.85, arc\) \* \(2\.0 \+ 1\.5 \* lv\) \+ surge;/);
  assert.match(src, /return 1\.6 \+ 0\.6 \* lv \* \(0\.7 \+ 0\.3 \* w\);/);
  const top = { fire: (1.2 + 3) * (0.5 + 1 * (0.75 + 0.5)), frost: 0.8 + 2.4 + 2.4 + 0.5, shock: 1.6 + 0.9 + 6.5 + 1, arcane: 1.6 + 0.6 * 2 };
  for (const look of Object.keys(top)) assert.ok(Math.abs(GL.GLOW_REACH_MAX[look] - top[look]) < 1e-9, `${look}: ${top[look]}`);
  // the shader clamps there, and an ember rises the slack past it
  assert.match(GL.GLOW_SPRITE_FS, /float reach = min\(gwReach\(uLook, c, t, lv\), uReachMax\);/);
  assert.ok(GL.GLOW_SPRITE_FS.includes(`d < reach + ${GL.GLOW_EMBER_SLACK.toFixed(1)}`));
  // every cell within the reach, in the look's metric (gwMetric: o from the cell to the solid, y up), is in its window
  const metric = (look, ox, oy) => {
    if (look === 'fire') return Math.hypot(ox, oy * (oy < 0 ? 1 / GL.GLOW_FIRE_UP : 1 / GL.GLOW_FIRE_DOWN));
    if (look === 'frost') return Math.max(Math.abs(ox), Math.abs(oy));
    if (look === 'shock') return Math.abs(ox) + Math.abs(oy);
    return Math.hypot(ox, oy);
  };
  for (const look of ['fire', 'frost', 'shock', 'arcane']) {
    const [wx, up, down] = GL.GLOW_SPRITE_WINDOW[look];
    const r = GL.GLOW_REACH_MAX[look];
    for (let dy = -30; dy <= 30; dy++) {
      for (let dx = -30; dx <= 30; dx++) {
        const m = metric(look, dx, -dy);   // dy > 0: the solid is BELOW the cell
        const needed = m <= r || (look === 'fire' && dy > 0 && m < r + GL.GLOW_EMBER_SLACK);
        if (needed) assert.ok(Math.abs(dx) <= wx && dy >= -up && dy <= down, `${look}: (${dx}, ${dy}) at ${m.toFixed(2)} is outside [${wx}, ${up}, ${down}]`);
      }
    }
  }
  // AUDIT WEAPON-GLOW DOC-12: fire looks far down (its flame stands over the weapon) and a little way up
  const [, fUp, fDown] = GL.GLOW_SPRITE_WINDOW.fire;
  assert.ok(fDown > 3 * fUp);
});

test('WEAPON-GLOW1: the field\'s bake - a cell a Daggerfall pixel, a cut side no silhouette (SPR-3, SPR-4)', () => {
  const fs = GL.GLOW_FIELD_FS;
  // a cell is the texel at its middle, the texture's texels over the frame's cells - an HD frame's cell is many texels
  assert.match(fs, /vec2 k = vec2\(textureSize\(uTex, 0\)\) \/ vec2\(uArt\);\s*return texelFetch\(uTex, ivec2\(\(vec2\(a\) \+ 0\.5\) \* k\), 0\)\.a >= 0\.5;/);
  // a cell past a cut side reads as the edge cell beside it
  assert.match(fs, /if \(uCut\.x == 1 && a\.x < 0\) a\.x = 0;\s*if \(uCut\.y == 1 && a\.x >= uArt\.x\) a\.x = uArt\.x - 1;\s*if \(uCut\.z == 1 && a\.y >= uArt\.y\) a\.y = uArt\.y - 1;/);
  // the outline reads the frame's cell, not its texel, for its place and its noise
  assert.match(GL.GLOW_SPRITE_FS, /ivec2 a = ivec2\(floor\(uv \* vec2\(uArt\)\)\);[\s\S]*vec2 c = vec2\(float\(a\.x\), -float\(a\.y\)\);/);
  // and its quad's pad is in cells
  assert.match(GL.GLOW_SPRITE_VS, /vec2 q = mix\(-uPad\.xy \/ art, 1\.0 \+ uPad\.zw \/ art, p\);/);
});

test('WEAPON-GLOW1: the Morrowind pass - rings before the body (one instanced draw a range), the charge after, the weapon\'s shown ranges alone', () => {
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  const ranges = [
    { first: 0, count: 30, slot: 'body', tex: null },
    { first: 30, count: 12, slot: 'weapon', tex: null },
    { first: 42, count: 6, slot: 'arrow', tex: null },
    { first: 48, count: 9, slot: 'weapon', tex: null, hidden: true },
  ];
  const mesh = { vao: { id: 'arm' }, ranges, weaponGlow: WG.glowSpec('fire', 2) };
  const draws = () => log.filter((c) => c[0] === 'drawArrays').map((c) => [c[2], c[3]]);
  const instanced = () => log.filter((c) => c[0] === 'drawArraysInstanced').map((c) => [c[2], c[3], c[4]]);
  // outside a sprite pass (the world pass): none
  log.length = 0;
  r.drawCharacter(mesh, I());
  assert.deepEqual(draws(), [[0, 30], [30, 12], [42, 6]], 'the world pass draws the body alone');
  assert.deepEqual(instanced(), []);
  // in the real sprite pass (the arm's picture, a third-person body's)
  log.length = 0;
  r.renderCharacterSprite(mesh, I(), I(), I(), 800, 600);
  const ringDraws = GL.glowRingDraws('fire');
  assert.deepEqual(instanced(), [[30, 12, ringDraws.length]], 'AUDIT MW-5: every ring and ember one instance of the shown weapon range');
  assert.deepEqual(draws(), [[0, 30], [30, 12], [42, 6], [30, 12]], 'then the body, then the charge');
  const ringsAt = log.findIndex((c) => c[0] === 'drawArraysInstanced');
  const firstBody = log.findIndex((c) => c[0] === 'drawArrays' && c[2] === 0);
  assert.ok(ringsAt < firstBody, 'the rings BEFORE the body');
  // each instance's row: its shift in NDC at the unit (this picture's rows: glowUnit(600) = 3), its depth, its band
  const rowsCall = log.find((c) => c[0] === 'uniform4fv' && c[1]?.uniform === 'uGlowDraw');
  assert.deepEqual([rowsCall[3], rowsCall[4]], [0, ringDraws.length * 4]);
  const rows = rowsCall[2], unit = GL.glowUnit(600);
  assert.equal(unit, 3);
  ringDraws.forEach((d, i) => {
    const got = [...rows.subarray(i * 4, i * 4 + 4)], want = [d.shift[0] * 2 * unit / 800, d.shift[1] * 2 * unit / 600, d.far, d.ring];
    for (let k = 0; k < 4; k++) assert.ok(Math.abs(got[k] - want[k]) < 1e-6, `row ${i}: ${got} vs ${want}`);
  });
  assert.equal(log.find((c) => c[0] === 'uniform1f' && c[1]?.uniform === 'uUnit')[2], 3);
  assert.deepEqual(log.find((c) => c[0] === 'uniform2f' && c[1]?.uniform === 'uGlowOrigin').slice(2), [0, 0], 'a lone picture\'s corner');
  // the charge: additive, alpha masked, no depth written, LEQUAL; every state handed back
  const charge = log.findLastIndex((c) => c[0] === 'drawArrays');
  const between = log.slice(firstBody, charge);
  assert.ok(between.some((c) => c[0] === 'colorMask' && c[4] === false), 'the charge leaves alpha alone');
  assert.ok(between.some((c) => c[0] === 'blendFunc' && c[1] === 'ONE' && c[2] === 'ONE'), 'additive');
  assert.ok(between.some((c) => c[0] === 'depthFunc' && c[1] === 'LEQUAL'));
  assert.ok(between.some((c) => c[0] === 'depthMask' && c[1] === false), 'AUDIT DOC-12: the charge writes no depth');
  assert.ok(between.some((c) => c[0] === 'uniform1f' && c[1]?.uniform === 'uGlowPull' && c[2] === GL.GLOW_CHARGE_PULL));
  assert.ok(GL.GLOW_CHARGE_PULL < 0, 'the pull is toward the eye');
  const after = log.slice(charge);
  for (const want of [['depthFunc', 'LESS'], ['depthMask', true], ['colorMask', true, true, true, true], ['disable', 'BLEND']]) {
    assert.ok(after.some((c) => want.every((v, i) => c[i] === v)), `handed back: ${want.join(' ')}`);
  }
  assert.ok(after.some((c) => c[0] === 'useProgram' && c[1] === r.charProgram), 'charProgram back for drawCharacter\'s own lines');
  // AUDIT MW-8: the arm's lens's unit, when it lays one on the mesh
  log.length = 0;
  r.renderCharacterSprite({ ...mesh, glowUnit: 2 }, I(), I(), I(), 800, 600);
  assert.equal(log.find((c) => c[0] === 'uniform1f' && c[1]?.uniform === 'uUnit')[2], 2);
  const rows2 = log.find((c) => c[0] === 'uniform4fv' && c[1]?.uniform === 'uGlowDraw')[2];
  assert.ok(Math.abs(rows2[0] - ringDraws[0].shift[0] * 4 / 800) < 1e-6);
  // the weapon sheathed: nothing of the glow
  log.length = 0;
  r.renderCharacterSprite({ ...mesh, ranges: ranges.map((x) => (x.slot === 'weapon' ? { ...x, hidden: true } : x)) }, I(), I(), I(), 800, 600);
  assert.deepEqual(draws(), [[0, 30], [42, 6]]);
  assert.deepEqual(instanced(), []);
  // a picture read back (the inventory's figure, an icon - the studio bake) is a still: no glow is baked into it
  log.length = 0;
  try { r.renderCharacterSpriteImage(mesh, I(), I(), I(), 800, 600); } catch { /* the stub reads back no pixels to make an image of */ }
  assert.deepEqual(draws(), [[0, 30], [30, 12], [42, 6]], 'a read-back draws the body alone');
  assert.deepEqual(instanced(), []);
  // and after the passes, the world's draw is the body alone again
  log.length = 0;
  r.drawCharacter(mesh, I());
  assert.deepEqual(draws(), [[0, 30], [30, 12], [42, 6]], 'the passes leave nothing on');
});

test('WEAPON-GLOW1: a batched body\'s glow is counted from its own tile (MW-4)', () => {
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  const mesh = { vao: { id: 'b' }, ranges: [{ first: 0, count: 12, slot: 'weapon', tex: null }], weaponGlow: WG.glowSpec('frost', 1) };
  const quad = { at: [0, 0, 0], halfW: 1, halfH: 1, right: [1, 0, 0] };
  const items = [{ mesh, model: I(), proj: I(), view: I(), pw: 100, ph: 200, quad }, { mesh, model: I(), proj: I(), view: I(), pw: 120, ph: 180, quad }];
  r.beginCharacterSpriteBatch();
  for (const it of items) r.queueCharacterSprite(it);
  log.length = 0;
  r.flushCharacterSpriteBatch();
  const origins = log.filter((c) => c[0] === 'uniform2f' && c[1]?.uniform === 'uGlowOrigin').map((c) => c.slice(2));
  assert.deepEqual(origins, items.flatMap((it) => [[it.tx, it.ty], [it.tx, it.ty]]), 'its rings and its charge, each tile its own corner');
  assert.ok(items[1].tx > 0, 'the second tile stands off the corner');
  assert.match(GL.GLOW_MESH_FS, /vec2 c = \(gl_FragCoord\.xy - uGlowOrigin\) \/ uUnit;/);
});

test('WEAPON-GLOW1: the rings - outermost first and farthest, a D16 step apart, behind the body\'s floor; fire stretched up, its nine embers last', () => {
  for (const look of ['frost', 'shock', 'arcane']) {
    const d = GL.glowRingDraws(look);
    assert.equal(d.length, GL.GLOW_RINGS.length * GL.GLOW_DIRS);
    for (let k = 0; k < GL.GLOW_RINGS.length; k++) {
      const ring = d.slice(k * GL.GLOW_DIRS, (k + 1) * GL.GLOW_DIRS);
      assert.ok(ring.every((x) => x.ring === GL.GLOW_RINGS[k]));
      assert.ok(ring.every((x) => Math.abs(Math.hypot(...x.shift) - x.ring) < 1e-9), `${look}: a ring is round`);
    }
  }
  assert.deepEqual([...GL.GLOW_RINGS], [...GL.GLOW_RINGS].sort((a, b) => b - a), 'outermost first');
  const fire = GL.glowRingDraws('fire');
  const up = fire.find((x) => x.ring === 1 && Math.abs(x.shift[0]) < 1e-9 && x.shift[1] > 0);
  const down = fire.find((x) => x.ring === 1 && Math.abs(x.shift[0]) < 1e-9 && x.shift[1] < 0);
  assert.ok(Math.abs(up.shift[1] - GL.GLOW_FIRE_UP) < 1e-9 && Math.abs(down.shift[1] + GL.GLOW_FIRE_DOWN) < 1e-9);
  const embers = fire.filter((x) => x.ring === -1);
  assert.equal(embers.length, 9, 'three heights, each straight up and a hair to either side');
  assert.deepEqual(new Set(embers.map((e) => e.shift[1])), new Set(GL.GLOW_EMBER_RISE));
  assert.deepEqual(fire.slice(-embers.length), embers, 'the embers last');
  for (const look of ['fire', 'frost', 'shock', 'arcane']) assert.ok(GL.glowRingDraws(look).length <= GL.GLOW_DRAWS_MAX, `${look} fits the instanced array`);
  // AUDIT WEAPON-GLOW MW-2: the sprite target's depth is D16 - every two depths the rings stand at (an ember's the
  // front) at least GLOW_DEPTH_STEPS steps apart in window depth, an outer ring farther, all inside the clip
  const d16 = (ndc) => Math.round(((ndc + 1) / 2) * 65535);
  const levels = [...new Set(fire.map((x) => x.far))].sort((a, b) => a - b);
  assert.equal(levels.length, GL.GLOW_RINGS.length + 1);
  for (let i = 1; i < levels.length; i++) assert.ok(d16(levels[i]) - d16(levels[i - 1]) >= GL.GLOW_DEPTH_STEPS, `${levels[i - 1]} and ${levels[i]}`);
  assert.ok(levels.at(-1) < 1);
  for (const x of fire) assert.equal(x.far, x.ring < 0 ? GL.GLOW_RING_FAR : GL.GLOW_RING_FAR + x.ring * GL.GLOW_RING_STEP);
  // AUDIT WEAPON-GLOW MW-1: the body quad gives a texel at the floor or past it the quad's own depth - and the floor
  // stands under every ring's depth, the nearest by GLOW_DEPTH_STEPS
  assert.ok(Math.round(GL.GLOW_DEPTH_FLOOR * 65535) <= d16(levels[0]) - GL.GLOW_DEPTH_STEPS + 1e-9);
  assert.ok(GL.GLOW_DEPTH_FLOOR > (GL.GLOW_RING_FAR + 1) / 2 - 3 / 65535);
  assert.ok(read('src/render/renderer.js').includes('if (d >= ${GLOW_DEPTH_FLOOR.toFixed(8)}) return gl_FragCoord.z;'));
  // the unit: a Daggerfall pixel of the rows asked, never under half a texel nor over eight (DOC-12)
  assert.deepEqual([10, 200, 400, 1080, 1e5].map(GL.glowUnit), [GL.GLOW_UNIT_MIN, 1, 2, 5.4, GL.GLOW_UNIT_MAX]);
});

test('WEAPON-GLOW1: a third-person picture is padded for its outline, in texels - a texel the size it was (MW-3)', () => {
  const PROJ = perspective(1.1, 640 / 480, 0.1, 500);
  const VIEW = lookAt([0, 1.6, 6], [0, 1, 0], [0, 1, 0]);
  const queued = [];
  const r = { characterSpriteBatchOpen: true, queueCharacterSprite: (it) => queued.push(it) };
  const canvas = { clientHeight: 480 };
  const box = (opts) => drawRigSpriteBox(r, canvas, {}, I(), { center: [0, 1, -4], halfW: 0.4, halfH: 0.9, ...opts }, PROJ, VIEW, [0, 1, 0]);
  const plain = box({});
  for (const look of ['fire', 'frost', 'shock', 'arcane']) {
    const pad = GL.glowPad(look, plain.ph);
    assert.ok(pad >= 1);
    const g = box({ glowLook: look });
    assert.equal(g.ph, plain.ph + 2 * pad, `${look}: ${pad} texels top and bottom`);
    assert.equal(g.pw, plain.pw + 2 * pad, 'and either side');
    assert.ok(Math.abs(g.halfH / g.ph - plain.halfH / plain.ph) < 1e-9, 'a texel stays the size it was');
    // the pad holds the reach at the unit the PADDED picture draws at
    assert.ok(pad >= GL.glowReach(look) * GL.glowUnit(g.ph), `${look}: ${pad} holds ${GL.glowReach(look)} units of ${GL.glowUnit(g.ph)}`);
  }
  assert.ok(GL.glowPad('fire', plain.ph) > GL.glowPad('frost', plain.ph), 'fire\'s embers stand farther off');
  // a foe's tells and a glow: the larger room, not both
  const both = box({ glowLook: 'frost', fx: { elite: 1 } });
  assert.equal(both.ph, plain.ph + 2 * Math.max(20, GL.glowPad('frost', plain.ph)));
  // the arm hands its picture the look it shows, in both of its draws
  const arm = strip(read('src/combat/fpArm.js'));
  assert.match(arm, /const glow = glowShown\(\);\s*thirdMesh\.weaponGlow = glow;\s*const glowLook = glow \? glow\.look : null;/);
  // PIN MOVED (TWO-HANDS): the pad's looks - the held weapon's, and a pair's left blade's beside it (padLooks)
  assert.equal(arm.match(/drawRigSpriteBox\(renderer, canvas, thirdMesh, model, \{[^\n]*, glowLook: padLooks \}, proj, view, eye, MW_ARM_PIXEL\)/g)?.length, 2, 'the horse\'s rider and the body alone');
});

test('WEAPON-GLOW1: the arm lays the glow only on the weapon it was asked of, and only in hand (NET-1, NET-2)', async () => {
  const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
  const rig = createFpArm(); rig.attach(countingRenderer(), cam);
  const blade = sword(), dagger = createWeapon(113, 0, () => 0.5);
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps(), weapon: blade })).ok, true);
  const run = () => { for (let i = 0; i < 200; i++) rig.update(0.05); };
  const spec = WG.glowSpec('fire', 2);
  rig.setWeaponGlow(spec, blade);
  assert.equal(rig.weaponGlow(), null, 'built sheathed: nothing in hand');
  rig.setSheathed(false); run();
  assert.equal(rig.weaponGlow(), spec, 'drawn: its glow');
  rig.setWeaponGlow(spec, dagger);
  assert.equal(rig.weaponGlow(), null, 'another weapon\'s glow is not laid on this one');
  rig.setWeaponGlow(spec, blade);
  rig.setSheathed(true); run();
  assert.equal(rig.weaponGlow(), null, 'sheathed: none (nor its room in a third-person picture)');
  rig.setSheathed(false); run();
  assert.equal(rig.weaponGlow(), spec);
  // a swap waits on its archives: the arm still holding the sword never wears the dagger's glow, and wears it once it holds it
  const swap = rig.setWeapon(dagger);
  rig.setWeaponGlow(spec, dagger);
  assert.equal(rig.weaponGlow(), null, 'mid-swap');
  await swap; run();
  assert.equal(rig.weaponGlow(), spec, 'the dagger in hand');
  rig.readySpell(true); run();
  assert.equal(rig.weaponGlow(), null, 'the spell stance holds no weapon');
  // the first-person draw lays the unit of its LENS on the mesh
  const arm = strip(read('src/combat/fpArm.js'));
  assert.match(arm, /mesh\.weaponGlow = glowShown\(\);\s*mesh\.glowUnit = glowUnit\(ph\);\s*const tex = renderer\.renderCharacterSprite\(mesh,/);
});

test('WEAPON-GLOW1: the clock - every scroll whole over the period, its noise periodic over the rows it scrolls', () => {
  const P = GL.GLOW_CLOCK_PERIOD;
  const src = GL.GLOW_LOOK_GLSL;
  // a scroll: `... - t * K), py)` - K x P rows a period, and the noise repeats over exactly those
  const scrolls = [...src.matchAll(/- t \* ([\d.]+)\), ([\d.]+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(scrolls.length >= 4, `the scrolls are found (${scrolls.length})`);
  for (const [k, py] of scrolls) assert.equal(k * P, py, `a scroll of ${k} a second wraps at ${py} rows`);
  // a pulse: sin(t * w ...), and the arcane swirl's turn (`float a = t * w;` - AUDIT DOC-4) - a whole number of turns
  const pulses = [...src.matchAll(/sin\(t \* ([\d.]+)/g), ...src.matchAll(/float a = t \* ([\d.]+);/g)].map((m) => Number(m[1]));
  assert.ok(pulses.length >= 4);
  assert.ok(pulses.includes(0.2617994), 'the swirl is counted');
  for (const w of pulses) { const turns = (w * P) / (2 * Math.PI); assert.ok(Math.abs(turns - Math.round(turns)) < 1e-4, `${w}: ${turns} turns`); }
  // a step: floor(t * n) - whole steps a period
  for (const m of src.matchAll(/floor\(t \* ([\d.]+)\)/g)) assert.equal((Number(m[1]) * P) % 1, 0);
  // the embers' rise counts its steps over the same modulus
  assert.match(src, /mod\(floor\(c\.y\) - floor\(t \* 6\.0\), 1440\.0\)/);
  assert.equal(6 * P, 1440);
  // and the renderer wraps its seconds there
  assert.ok(read('src/render/renderer.js').includes('export const glowSeconds = (now = globalThis.performance?.now?.() ?? Date.now()) => (now / 1000) % GLOW_CLOCK_PERIOD;'));
});

test('WEAPON-GLOW1: the Morrowind shaders - the body\'s own vertex shader, instanced after it; derivatives before any discard', () => {
  const body = 'out vec3 vEmissive;\nvoid main() {\n  vec4 world = vec4(0.0);\n  gl_Position = uProj * uView * world;\n}';
  const vs = GL.glowMeshVs(body);
  const at = vs.indexOf('gl_Position = uProj * uView * world;');
  assert.ok(at > 0 && vs.indexOf('gl_Position.xy += gwD.xy * gl_Position.w;') > at, 'the body\'s expression first');
  assert.ok(vs.includes(`uniform vec4 uGlowDraw[${GL.GLOW_DRAWS_MAX}];\nuniform int uGlowInstanced;\nuniform float uGlowPull;`));
  assert.ok(vs.includes('vec4 gwD = uGlowInstanced == 1 ? uGlowDraw[gl_InstanceID] : vec4(0.0);'), 'AUDIT MW-5: an instance\'s row');
  assert.ok(vs.includes('gl_Position.z = gwD.z > 0.0 ? gwD.z * gl_Position.w : gl_Position.z + uGlowPull * gl_Position.w;'));
  assert.ok(vs.includes('vRingD = gwD.w;'));
  assert.throws(() => GL.glowMeshVs('void main() {}'), /WEAPON-GLOW1/);
  assert.throws(() => GL.glowMeshVs(`${body}\n${body}`), /WEAPON-GLOW1/);
  // AUDIT WEAPON-GLOW MW-7: the charge's derivatives in uniform control flow - before the first discard
  const fs = GL.GLOW_MESH_FS;
  assert.ok(fs.indexOf('dFdx(vViewPos)') > 0 && fs.indexOf('dFdx(vViewPos)') < fs.indexOf('discard'));
  // the renderer builds from the character's own vertex shader
  assert.match(read('src/render/renderer.js'), /this\._buildProgram\(glowMeshVs\(CHAR_SKIN_VS\), GLOW_MESH_FS\)/);
  // AUDIT WEAPON-GLOW MW-6 / SPR-6: both glows' programs are warmed at idle, before the first glowing weapon
  const { r } = loggingRenderer();
  const steps = r.lazyWarmSteps();
  for (const s of steps.slice(-2)) s();
  assert.ok(r.weaponGlowMeshProgram && r.weaponGlowQuadProgram && r.weaponGlowFieldProgram);
});

test('WEAPON-GLOW1: the wire carries the word - a weapon in a hand\'s alone, omitted when none; a peer\'s body reads it', () => {
  on();
  assert.deepEqual([...LOOK_GLOW_SLOTS], [EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand], 'the hands');
  const base = { templateIndex: 120, group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand };
  assert.equal(validLookItem({ ...base, glow: 'fire2' }).glow, 'fire2');
  assert.equal(validLookItem({ ...base, equipSlot: EQUIP_SLOTS.LeftHand, glow: 'shock3' }).glow, 'shock3');
  for (const bad of ['fire4', 'arcane1', 'arcane3', 'poison1', 'FIRE2', ' fire2', 2, null]) assert.equal('glow' in validLookItem({ ...base, glow: bad }), false, String(bad));
  assert.equal('glow' in validLookItem({ templateIndex: 102, group: 'Armor', equipSlot: 1, glow: 'fire2' }), false, 'a weapon\'s alone');
  assert.equal('glow' in validLookItem({ templateIndex: 109, group: 'Armor', equipSlot: EQUIP_SLOTS.LeftHand, glow: 'fire2' }), false, 'a shield in the left hand is no weapon');
  assert.equal('glow' in validLookItem({ ...base, equipSlot: 3, glow: 'fire2' }), false, 'AUDIT NET-4: a weapon in a hand\'s alone');
  assert.equal(lookGlowOk({ ...base, glow: 'frost1' }), true);
  assert.deepEqual(Object.keys(validLookItem(base)), ['templateIndex', 'group', 'equipSlot'], 'a plain weapon keeps its bytes');
  // the owner's look says it - from the card, whatever the owner's own switch
  const body = () => ({ isPlayer: true, items: [], race: 'Breton', gender: 'male', faceIndex: 0, stats: {}, skills: new Array(35).fill(30), career: {}, activeEffects: [] });
  const me = body();
  const { it } = mintMagic('frost');
  me.items.push(it); equipItem(me, it);
  setPref(WG.WEAPON_GLOW_PREF, false);
  const look = validLook(composeLook(me, { eotbSet: null }));
  const held = look.items.find((x) => x.group === 'Weapons');
  assert.ok(LOOK_GLOW_SLOTS.includes(held.equipSlot));
  assert.equal(held.glow, 'frost1');
  assert.equal(held.glow, WG.glowWord(WG.meshGlow(it, { on: true })));
  setPref(WG.WEAPON_GLOW_PREF, true);
  // a foe's look says nothing - its kit's record carries no glow, so no screen draws one
  const foe = { ...body(), isPlayer: false };
  const { it: foeSword } = mintMagic('fire');
  foe.items.push(foeSword); equipItem(foe, foeSword);
  assert.equal('glow' in composeLook(foe, { eotbSet: null }).items.find((x) => x.group === 'Weapons'), false);
  // a plain weapon says nothing
  const you = body();
  const bare = sword(); you.items.push(bare); equipItem(you, bare);
  assert.equal('glow' in composeLook(you, { eotbSet: null }).items.find((x) => x.group === 'Weapons'), false);
  // the peer's stand-in keeps it, and the word reads back to the spec
  const stub = peerStubEntity(look);
  assert.equal(stub.items.find((x) => x.group === 'Weapons').glow, 'frost1');
  assert.equal('glow' in peerStubEntity({ ...look, items: look.items.map((x) => (x.group === 'Weapons' ? { ...x, equipSlot: 3 } : x)) }).items.find((x) => x.group === 'Weapons'), false, 'the stand-in reads the wire\'s one law');
  assert.equal(WG.glowFromWord('frost1'), WG.glowSpec('frost', 1));
  // a glow-only change is a new look, said again (setLook's compare is the validated look's whole)
  const sent = { look: validLook({ ...look, items: look.items.map((x) => { const { glow, ...rest } = x; return rest; }) }), _flushLook() { this.flushed = (this.flushed ?? 0) + 1; } };
  assert.equal(OnlineSession.prototype.setLook.call(sent, look), true, 'the word arriving is a change');
  assert.equal(sent.flushed, 1);
  assert.equal(OnlineSession.prototype.setLook.call(sent, look), false, 'and the same look again is none');
});

test('WEAPON-GLOW1: a peer\'s body wears the word off the look NOW - the hand in use, by MY switch; no tool, claws or creature (NET-6)', () => {
  on();
  const right = { templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand, glow: 'fire2' };
  const left = { templateIndex: 113, group: 'Weapons', material: 3, equipSlot: EQUIP_SLOTS.LeftHand };
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [right, left] };
  const said = [];
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const rig = { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: () => true, setWeaponGlow: (spec, item) => said.push([spec, item]) };
  const b = () => ({ weapon: peerWeaponOf(LOOK), ammo: 0, held: false, swing: null, cast: null, rig });
  pb._arm(b(), { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.deepEqual(said.at(-1), [WG.glowSpec('fire', 2), right], 'the right hand\'s word, and the weapon it is of');
  pb._arm(b(), { wd: 1, an: 0, cn: 0, lh: 1 }, LOOK);
  assert.deepEqual(said.at(-1), [null, left], 'the left hand in use: its own word, none');
  pb._arm(b(), { wd: 0, an: 0, cn: 0 }, LOOK);
  assert.equal(said.at(-1)[0], WG.glowSpec('fire', 2), 'sheathed: the word stands - the arm hides it while the weapon is put away');
  pb._arm(b(), { wd: 1, an: 0, cn: 0, ga: GATHER_POSE_ACTS.indexOf('chop') + 1 }, LOOK);
  assert.deepEqual(said.at(-1), [null, null], 'a gatherer\'s tool carries none');
  pb._arm({ ...b(), wolf: true }, { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.deepEqual(said.at(-1), [null, null], 'a werewolf\'s claws');
  pb._arm(b(), { wd: 1, an: 0, cn: 0 }, { ...LOOK, creature: 'rat' });
  assert.deepEqual(said.at(-1), [null, null], 'a creature\'s body');
  setPref(WG.WEAPON_GLOW_PREF, false);
  pb._arm(b(), { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.equal(said.at(-1)[0], null, 'MY switch off: no peer\'s glow');
  setPref(WG.WEAPON_GLOW_PREF, true);
  // a weapon identified or socketed is a new look with the same template in the same hand: the word follows it
  pb._arm(b(), { wd: 1, an: 0, cn: 0 }, { ...LOOK, items: [{ ...right, glow: 'fire3' }, left] });
  assert.equal(said.at(-1)[0], WG.glowSpec('fire', 3));
});
