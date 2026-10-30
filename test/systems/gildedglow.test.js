// GILDED-GLOW (2026-10-29, #feature-feedback, "Gilded Weapons": "I feel like gilded weapons should have a cool crimson
// glow to them to match the item picture; doesn't feel right to have a crazy rare item not have a cool effect on it";
// bible/05-Combat/Weapon-Glow.md law 8). A Gilded weapon wears the rung's crimson in every hand of its owner - the
// classic sprite's outline, the Morrowind arm in first and third person - and on its owner's look to peers, as the word
// `gilded2`. It is the piece itself, so it shows over the element, the Aura Armory's piece and the arcane look. Every
// fixture from its real producer: mintGilded for every record and era, the item maker's write for an enchanted one, the
// real renderer over a recording GL stub, the arm, composeLook, the wire and a peer's body.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as WG from '../../src/systems/weaponGlow.js';
import * as GL from '../../src/render/weaponGlowGlsl.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { GILDED_RECORDS, GILDED_ERAS, HOURLOCK, DRAGONFIRE_OATH, VOLENDRUNGS_ECHO, KETCHMASTERS_WORD, mintGilded } from '../../src/systems/gilded.js';
import { applyEnchantments } from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { isEnchanted } from '../../src/systems/inventory.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPON_TYPES, plainWeaponType, weaponTypeForItem } from '../../src/combat/fpsWeapon.js';
import { thunderlockFrames } from '../../src/combat/thunderlockArt.js';
import { bledFrames } from '../../src/combat/gun/pistoletArt.js';
import { readPng } from '../../tools/pngIO.mjs';
import { createFpArm } from '../../src/combat/fpArm.js';
import { validLook, validLookItem, LOOK_GLOW_RE } from '../../src/net/wire.js';
import { composeLook, peerStubEntity } from '../../src/net/remotePlayers.js';
import { PeerBodies, peerWeaponOf, peerBuildOpts } from '../../src/net/peer/peerBodies.js';
import { Renderer } from '../../src/render/renderer.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';
import { SESSION_KEY } from '../../src/net/accountClient.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const ALL = [...GILDED_RECORDS, ...GILDED_ERAS];
const GILDED = () => WG.glowSpec('gilded', WG.GILDED_LEVEL);
const FEATHER = enchantmentSettings('FeatherWeight', -1);
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
/** The stored session a kit is read off (ARMORY's law 7), for the length of `fn`. */
function withKit(kit, fn) {
  const was = globalThis.localStorage, m = new Map();
  globalThis.localStorage = /** @type {any} */ ({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: () => null, get length() { return m.size; } });
  m.set(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'x', glyphs: [], armory: kit }));
  try { return fn(); } finally { if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was; }
}
/** A WebGL2 stub that RECORDS (weaponglow1.test.js's): every call's name and arguments, an enum read as its own name. */
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

test('GILDED-GLOW LAW 8: every Gilded record and era wears the rung\'s crimson in both hands - over its element, over the arcane look the maker\'s rows would wear, over the Aura Armory\'s piece; the switch off, none; the ladder off, no rung read (mutants: the law gone; the element first; the armory piece first; the ladder ignored)', () => {
  on();
  for (const r of ALL) {
    const it = mintGilded(r);
    assert.equal(WG.spriteGlow(it, { on: true }), GILDED(), `${r.id}: the classic hand`);
    assert.equal(WG.meshGlow(it, { on: true }), GILDED(), `${r.id}: the Morrowind hand`);
    assert.deepEqual(WG.weaponGlow(it, { on: true }), { look: 'gilded', level: 2 });
    const made = applyEnchantments(mintGilded(r), [FEATHER]);
    assert.equal(isEnchanted(made), true);
    assert.equal(WG.meshGlow(made, { on: true }), GILDED(), `${r.id}: enchanted - the crimson, never the arcane`);
  }
  // over the element: the Hourlock's, Volendrung's Echo's and the Ketchmaster's Word's +10 shock is the blow's still
  for (const r of [HOURLOCK, VOLENDRUNGS_ECHO, KETCHMASTERS_WORD]) {
    const it = mintGilded(r);
    assert.deepEqual(WG.weaponElement(it), { element: 'shock', total: 10 }, `${r.id}: its element read as before`);
    assert.equal(WG.spriteGlow(it, { on: true }).look, 'gilded');
  }
  // over the Aura Armory's piece (law 7) - which a plain weapon in the same hand still wears
  withKit('b000a', () => {
    assert.equal(WG.meshGlow(mintGilded(DRAGONFIRE_OATH), { on: true }), GILDED(), 'the piece itself over the kit');
    assert.equal(WG.meshGlow(createWeapon(120, 0, () => 0.5), { on: true }).look, 'brand', 'a plain blade wears the kit');
  });
  // the switch off: nothing
  assert.equal(WG.spriteGlow(mintGilded(HOURLOCK), { on: false }), null);
  // the ladder off, the card shows no rung, so the hand shows none - DFU's look: the arcane for a made piece, else bare
  const madeOath = applyEnchantments(mintGilded(DRAGONFIRE_OATH), [FEATHER]);
  setPref('lootRarity', false);
  assert.deepEqual([WG.spriteGlow(mintGilded(HOURLOCK), { on: true }), WG.meshGlow(mintGilded(HOURLOCK), { on: true })], [null, null]);
  assert.deepEqual([WG.spriteGlow(madeOath, { on: true }), WG.meshGlow(madeOath, { on: true })], [null, WG.glowSpec('arcane', WG.ARCANE_LEVEL)]);
  setPref('lootRarity', true);
  assert.equal(WG.meshGlow(madeOath, { on: true, ladder: false }).look, 'arcane', 'and asked with the ladder off');
  // a weapon of no rung wears none of it
  assert.equal(WG.spriteGlow(createWeapon(120, 0, () => 0.5), { on: true }), null);
});

test('GILDED-GLOW THE LOOK: the seventh look, one strength, its word gilded2; a ramp from dark garnet through the rung\'s own crimson to a hot pink-white core - never the Brand\'s gold; its reach a slow regal pulse no wider than the Brand\'s, its window holding all of it; a branch of its own in each of the shader\'s four (mutants: the level; the rung\'s colour; the core gold; the hex read wrong; the one strength; the window; the reach; each branch)', () => {
  assert.equal(WG.GLOW_LOOKS.at(-1), 'gilded');
  assert.equal(WG.GLOW_CODE.gilded, 7);
  // render/renderer.js keys a frame's field by its look's code and its cuts, the code under 8 - every look must fit
  assert.ok(read('src/render/renderer.js').includes('const flat = glow.code + 8 * ((cutL ? 1 : 0) + (cutR ? 2 : 0)) + 32 * (aw * 4096 + ah);'));   // BACK-HOLSTER GLOW: `flat`, a world picture's key its negative
  assert.ok(Math.max(...Object.values(WG.GLOW_CODE)) < 8, 'every look\'s code under the field key\'s 8');
  // one strength, as the arcane look and the armory's pieces
  assert.equal(WG.GILDED_LEVEL, 2);
  for (const level of [0, 1, 3]) assert.equal(WG.glowSpec('gilded', level), null, `level ${level}`);
  const spec = GILDED();
  assert.deepEqual([spec.look, spec.code, spec.level, spec.word, [...spec.ramp], spec.win], ['gilded', 7, 2, 'gilded2', WG.GLOW_RAMPS.gilded.flat(), GL.GLOW_SPRITE_WINDOW.gilded]);
  assert.ok(Object.isFrozen(spec) && Object.isFrozen(spec.ramp));
  assert.equal(WG.glowFromWord('gilded2'), spec);
  // the ramp: dark to hot, its third stop the rung's own crimson (lootRarity.js RARITIES.gilded, #ff3b4a) exactly
  const ramp = WG.GLOW_RAMPS.gilded;
  assert.equal(LR.RARITIES.gilded.colour, '#ff3b4a');
  assert.deepEqual(ramp[2], [1, 59 / 255, 74 / 255]);
  for (let i = 1; i < 4; i++) assert.ok(lum(ramp[i]) > lum(ramp[i - 1]), 'the ramp climbs, dark to hot');
  assert.ok(ramp[0][0] > 4 * ramp[0][1] && ramp[0][2] > ramp[0][1], 'a garnet: red, its blue over its green');
  assert.ok(ramp[3][0] === 1 && ramp[3][2] >= ramp[3][1] && lum(ramp[3]) > 0.8, 'a hot pink-white core');
  const brand = WG.GLOW_RAMPS.brand;
  assert.ok(brand[3][2] < brand[3][1] && ramp[3][2] - ramp[3][1] > 0, 'the Brand\'s core is gold, the rung\'s pink: told apart');
  // the reach: its formula's top at its one level, no wider than the Brand's or the Edge's, under every element's
  const src = GL.GLOW_LOOK_GLSL;
  assert.match(src, /if \(look == 7\) \{[^\n]*\n\s*float beat = 0\.5 \+ 0\.5 \* sin\(t \* 1\.5707963\);\n\s*float crest = pow\(0\.5 \+ 0\.5 \* sin\(t \* 1\.0471976 - \(c\.x - c\.y\) \* 0\.14\), 6\.0\);\n\s*return 1\.2 \+ 0\.4 \* lv \+ 0\.6 \* beat \+ 0\.6 \* crest;/);
  assert.ok(Math.abs(GL.GLOW_REACH_MAX.gilded - (1.2 + 0.4 * WG.GILDED_LEVEL + 0.6 + 0.6)) < 1e-9);
  assert.ok(GL.GLOW_REACH_MAX.gilded <= Math.min(GL.GLOW_REACH_MAX.brand, GL.GLOW_REACH_MAX.edge));
  for (const look of ['fire', 'frost', 'shock']) assert.ok(GL.GLOW_REACH_MAX.gilded < GL.GLOW_REACH_MAX[look], look);
  // a 4 s beat and a 6 s crest: whole turns over the clock's period
  for (const w of [1.5707963, 1.0471976]) { const turns = (w * GL.GLOW_CLOCK_PERIOD) / (2 * Math.PI); assert.ok(Math.abs(turns - Math.round(turns)) < 1e-4); }
  // its window holds every cell its reach takes, round
  const [wx, up, down] = GL.GLOW_SPRITE_WINDOW.gilded;
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
    if (Math.hypot(dx, dy) <= GL.GLOW_REACH_MAX.gilded) assert.ok(Math.abs(dx) <= wx && dy >= -up && dy <= down, `(${dx}, ${dy})`);
  }
  // its own arms in the shade (a step hotter than the others' bands - crimson by the blade, the core at the swell - and a
  // slow glint), the rim (breathing with the halo) and the Morrowind charge (a sheen)
  assert.match(src, /if \(look == 7\) col = uRamp\[int\(clamp\(floor\(h \* 4\.0 \+ 0\.5\), 0\.0, 3\.0\)\)\];/);
  assert.match(src, /int q = int\(clamp\(floor\(h \* 4\.0 - 0\.5\), 0\.0, 3\.0\)\);/, 'the others\' bands, a step cooler');
  assert.match(src, /if \(look == 7 && gwHash\(floor\(c\) \+ floor\(t \* 4\.0\) \* 2\.71\) > 0\.988\) \{ col = uRamp\[3\]; a = 1\.0; \}/);
  assert.match(src, /else if \(look == 7\) k = 0\.3 \+ 0\.25 \* \(0\.5 \+ 0\.5 \* sin\(t \* 1\.5707963\)\);/);
  assert.match(src, /if \(look == 7\) return max\(0\.35 \* \(0\.5 \+ 0\.5 \* sin\(t \* 1\.5707963\)\), pow\(0\.5 \+ 0\.5 \* sin\(t \* 1\.0471976 - uv\.y \* 8\.0\), 8\.0\)\);/);
  assert.equal(src.match(/look == 7\b/g).length, 5, 'its arms in each of the four');
});

test('GILDED-GLOW THE SPRITE OUTLINE AND THE CLASSIC HAND: the renderer draws the crimson as its own field and look; an enchanted Gilded DFU weapon swings its plain sheet under it; a Gilded gun keeps its gold frames enchanted or not - the shimmer never over the gold (mutants: the Thunderlock\'s shimmer over the gold; the Pistolet\'s)', () => {
  on();
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  const tex = { id: 'frame' }, frame = { art: [60, 48], view: [800, 600] };
  r.drawScreenQuadGlow(tex, { x: 100, y: 50, w: 300, h: 240 }, undefined, WG.glowSpec('shock', 3), frame);
  log.length = 0;
  r.drawScreenQuadGlow(tex, { x: 100, y: 50, w: 300, h: 240 }, undefined, GILDED(), frame);
  const draws = log.flatMap((c, i) => (c[0] === 'drawElements' ? [i] : []));
  assert.equal(draws.length, 2, 'a field of its own beside the shock one: the bake, then the outline');
  const uni = (name) => log.slice(draws[0], draws[1]).find((c) => c[1]?.uniform === name);
  assert.deepEqual([uni('uLook')[2], uni('uLevel')[2], uni('uReachMax')[2]], [7, 2, GL.GLOW_REACH_MAX.gilded]);
  assert.equal(uni('uRamp')[2], GILDED().ramp);
  assert.deepEqual(log.slice(0, draws[0]).find((c) => c[1]?.uniform === 'uWin').slice(2), GL.GLOW_SPRITE_WINDOW.gilded);
  // a DFU weapon made by the maker is promoted to its *_Magic sheet, and the outline swings the plain one (weaponRig.js
  // heldType - weaponglow1.test.js pins the rig's own lines)
  const oath = applyEnchantments(mintGilded(DRAGONFIRE_OATH), [FEATHER]);
  assert.equal(weaponTypeForItem(oath), WEAPON_TYPES.LongBlade_Magic);
  assert.ok(WG.spriteGlow(oath));
  assert.equal(plainWeaponType(weaponTypeForItem(oath)), WEAPON_TYPES.LongBlade);
  // the guns: promoted when made, and the rig keys a Gilded gun's art `:gilded` whatever its type (thunderlockArt.js)
  const echo = applyEnchantments(mintGilded(VOLENDRUNGS_ECHO), [FEATHER]), word = applyEnchantments(mintGilded(KETCHMASTERS_WORD), [FEATHER]);
  assert.deepEqual([weaponTypeForItem(echo), weaponTypeForItem(word)], [WEAPON_TYPES.Thunderlock_Magic, WEAPON_TYPES.Pistolet_Magic]);
  assert.match(read('src/combat/weapon/weaponRig.js'), /const gilded = thunderlock && item\?\.rarity === 'gilded';[^\n]*\n\s*const key = `\$\{type\}:\$\{item\?\.material \?\? 0\}:\$\{thunderlock \? \(gilded \? 'gilded' : ''\)/);
  const same = (a, b) => a.length === b.length && a.every((f, i) => Buffer.compare(Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength), Buffer.from(b[i].data.buffer, b[i].data.byteOffset, b[i].data.byteLength)) === 0);
  const tl = readPng(readFileSync(new URL('../../public/art/thunderlock-frames.png', import.meta.url)));
  const gold = thunderlockFrames(tl, { gilded: true }).frames;
  assert.ok(same(thunderlockFrames(tl, { gilded: true, magic: true }).frames, gold), 'the Thunderlock: an enchanted Gilded gun is gold');
  assert.ok(!same(thunderlockFrames(tl, { magic: true }).frames, gold), 'and the shimmer is another look');
  const ps = readPng(readFileSync(new URL('../../public/art/pistol-frames.png', import.meta.url)));
  const pGold = bledFrames(ps, { gilded: true }).frames;
  assert.ok(same(bledFrames(ps, { gilded: true, magic: true }).frames, pGold), 'the Pistolet: gold too');
  assert.ok(!same(bledFrames(ps, { magic: true }).frames, pGold));
});

test('GILDED-GLOW THE MORROWIND ARM AND THE PEERS: the arm wears the crimson on the weapon in hand, the pass drawing it as its own look; a third-person picture is padded for it; the owner\'s look says gilded2, the wire and the stand-in keep it, and a peer\'s body wears it back - an older word list strips it (mutants: the word off the wire)', async () => {
  on();
  // the arm: the spec as meshGlow hands it, laid on the weapon in hand
  const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
  const rig = createFpArm(); rig.attach(countingRenderer(), cam);
  const blade = createWeapon(120, 0, () => 0.5);
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps(), weapon: blade })).ok, true);
  rig.setSheathed(false);
  for (let i = 0; i < 200; i++) rig.update(0.05);
  const spec = WG.meshGlow(mintGilded(DRAGONFIRE_OATH), { on: true });
  rig.setWeaponGlow(spec, blade);
  assert.equal(rig.weaponGlow(), GILDED());
  // the pass: its rings (four bands of twelve, no embers) before the body, its look's code
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  r.renderCharacterSprite({ vao: { id: 'arm' }, ranges: [{ first: 0, count: 30, slot: 'body', tex: null }, { first: 30, count: 12, slot: 'weapon', tex: null }], weaponGlow: spec }, I(), I(), I(), 800, 600);
  assert.deepEqual(log.filter((c) => c[0] === 'drawArraysInstanced').map((c) => [c[2], c[3], c[4]]), [[30, 12, GL.glowRingDraws('gilded').length]]);
  assert.equal(GL.glowRingDraws('gilded').length, GL.GLOW_RINGS.length * GL.GLOW_DIRS);
  assert.ok(log.some((c) => c[0] === 'uniform1i' && c[1]?.uniform === 'uLook' && c[2] === 7));
  assert.ok(GL.glowPad('gilded', 120) >= GL.glowReach('gilded') * GL.glowUnit(120 + 2 * GL.glowPad('gilded', 120)), 'a third-person picture\'s room');
  // the look: a Gilded weapon in a hand says gilded2 from the owner's card, whatever the owner's own switch
  const me = { isPlayer: true, items: [], race: 'Breton', gender: 'male', faceIndex: 0, stats: {}, skills: new Array(35).fill(30), career: {}, activeEffects: [] };
  const oath = mintGilded(DRAGONFIRE_OATH);
  me.items.push(oath); equipItem(me, oath);
  setPref(WG.WEAPON_GLOW_PREF, false);
  const look = validLook(composeLook(me, { eotbSet: null }));
  setPref(WG.WEAPON_GLOW_PREF, true);
  const held = look.items.find((x) => x.group === 'Weapons');
  assert.equal(held.glow, 'gilded2');
  assert.equal(peerStubEntity(look).items.find((x) => x.group === 'Weapons').glow, 'gilded2', 'the stand-in keeps it');
  assert.ok(LOOK_GLOW_RE.test('gilded2'));
  for (const bad of ['gilded1', 'gilded3', 'Gilded2', 'gilded']) assert.equal('glow' in validLookItem({ templateIndex: 123, group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand, glow: bad }), false, bad);
  // an older relay's word list (world285's) strips it: the peer's weapon draws bare until the relay is deployed
  assert.equal(/^(?:(?:fire|frost|shock)[123]|arcane2|brand2|edge2)$/.test('gilded2'), false);
  // a peer's body wears it back, by the viewer's own switch
  const said = [];
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const peerRig = { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: () => true, setWeaponGlow: (s, item) => said.push([s, item]), setOffWeaponGlow() {} };
  pb._arm({ weapon: peerWeaponOf(look), ammo: 0, held: false, swing: null, cast: null, rig: peerRig }, { wd: 1, an: 0, cn: 0 }, look);
  assert.equal(said.at(-1)[0], GILDED());
});
