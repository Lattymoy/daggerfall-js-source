// COMPANION-KIT (2026-10-01, Mac: "crew member companions need the ability to gain the players healing spells/buffs, act
// as storage, improved detailed health bar with buffs and their name, and also an integration into the party UI"):
//
//   THE GIFTS (scenes/hostMagic.js) - a beneficial spell (ALLY-CAST's own test) reaches my companion as it reaches a
//   party mate - under the crosshair, armed near, by touch, in a blast - applied HERE as ALLY-CAST's receiver's record
//   (a self-cast, no save), tagged an ally's bundle, through his own sinks; a harmful one, a free ready and another
//   player's companion never.
//   THE PACK (systems/naval/crewCompanions.js, scenes/naval/navalHost.js, player/mobileEnemyActivate.js) - his live list,
//   saved with the party through the item codec, opened by activating him, stowed in his boat's hold when he goes
//   back aboard, is knocked out or falls.
//   THE BAR (ui/naval/navalHud.js drawCrewBars) - his name, his health in digits and his effects' icons.
//   THE PARTY PANEL (ui/partyPanel.js) - his card under the party's seats, offline as well.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { COMPANION_ARMED_LINE, ALLY_TOUCH_REACH } from '../../src/systems/allyCast.js';
import { PRESS_BUTTON_TO_FIRE_SPELL } from '../../src/systems/mysticism.js';
import { createCompanions } from '../../src/systems/naval/crewCompanions.js';
import { activateMobileEnemy } from '../../src/player/mobileEnemyActivate.js';
import { drawCrewBars, MATE_FX_MAX } from '../../src/ui/naval/navalHud.js';
import { createPartyPanel, companionKey } from '../../src/ui/partyPanel.js';
import { composePartyFx } from '../../src/net/partyBuffs.js';
import { HULL } from '../../src/systems/naval/navalShips.js';
import { sea } from '../navalSea.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const fx = (type, subType = 0, mag = 20, dur = 0) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8);           // Heal Health
const DAMAGE = fx(4, 0);          // Damage Health
const FORTIFY = fx(9, 0, 10, 10); // Fortify Strength, ten rounds
const spellOf = (rangeType, effects, name = 'Balyna\'s Balm') => ({ name, index: 90, element: 4, rangeType, effects, icon: 7 });

// ── the gifts ───────────────────────────────────────────────────────────────────────────────────────────────────

const mkPlayer = () => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
/** My companion Hilda, `at` her feet (the aim runs from [0, 0.9, 0] along +z). */
const hilda = (at = [0, 0, 2], over = {}) => ({
  companion: '42:Hilda', shipmate: true, dead: false,
  entity: { name: 'Hilda', health: 10, maxHealth: 60, magicka: 0, maxMagicka: 0, fatigue: 100, maxFatigue: 100, level: 3, activeEffects: [],
    stats: { strength: 50, intelligence: 40, willpower: 40, agility: 50, endurance: 50, personality: 40, speed: 50, luck: 40 }, skills: new Array(40).fill(30), career: {}, team: 'PlayerAlly' },
  ai: { feet: [...at], height: 1.8 }, ...over,
});
function rig(player, bodies, { wall = () => Infinity } = {}) {
  const said = [];
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: (eye, dir, d) => wall(d) },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l), surfacePlayer() {},
    foes: () => [],
    foeSinks: (f, fromPlayer) => ({ fromPlayer, hurt(n) { f.entity.health -= n; f.hurtBy = fromPlayer; }, heal(n) { f.healBy = fromPlayer; f.entity.health = Math.min(f.entity.maxHealth, f.entity.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99, startCastAnim: null,
    companionBodies: () => bodies,
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, said };
}

test('COMPANION-KIT THE GIFT UNDER THE CROSSHAIR: a CasterOnly Heal readied with my companion under the crosshair arms, and the click heals HER, not me - spent once, said by her name, through her own sinks as no blow of mine (mutants: the companion never looked for, the gift through my blow\'s sinks, the caster healed)', () => {
  const p = mkPlayer(), h = hilda();
  const { magic, said } = rig(p, [h]);
  const sp = spellOf(0, [HEAL, EMPTY, EMPTY]);
  magic.readySpell(sp);
  assert.equal(magic.readied(), sp, 'armed, not fired');
  assert.equal(said.at(-1), PRESS_BUTTON_TO_FIRE_SPELL);
  assert.equal(p.health, 20); assert.equal(h.entity.health, 10);
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.equal(h.entity.health, 30, 'Hilda healed 20');
  assert.equal(h.healBy, false, 'through her sinks as no blow of mine');
  assert.equal(p.health, 20, 'not me');
  assert.ok(p.magicka < 500, 'paid for');
  assert.ok(said.includes('You cast Balyna\'s Balm on Hilda.'), said.join(' | '));
  assert.equal(magic.readied(), null);
});

test('COMPANION-KIT ARMED NEAR, AND A BUFF\'S ICON: my companion near (not under the crosshair) arms a CasterOnly buff with COMPANION_ARMED_LINE - aimed away it is mine; aimed at her a Fortify lands on her as an ALLY\'s bundle with its icon, a buff on her bar (mutants: the near arm dropped, the bundle untagged)', () => {
  const p = mkPlayer(), h = hilda([3, 0, 1]);
  const { magic, said } = rig(p, [h]);
  const sp = spellOf(0, [FORTIFY, EMPTY, EMPTY], 'Strength of the Bear');
  magic.readySpell(sp);
  assert.equal(magic.readied(), sp);
  assert.ok(said.includes(COMPANION_ARMED_LINE), said.join(' | '));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);   // aimed away from her
  assert.equal(h.entity.activeEffects.length, 0, 'aimed away: mine');
  assert.ok(p.activeEffects.length > 0);
  // aimed at her
  const p2 = mkPlayer(), h2 = hilda([0, 0, 2]);
  const r2 = rig(p2, [h2]);
  r2.magic.readySpell(sp);
  r2.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.ok(h2.entity.activeEffects.length > 0, 'on her');
  assert.ok(h2.entity.activeEffects.every((a) => a.bundleAlly === true), 'an ally\'s bundle');
  const icons = composePartyFx(h2.entity);
  assert.equal(icons.length, 1); assert.equal(icons[0].i, 7, 'its icon'); assert.equal(icons[0].d, undefined, 'a buff, not a debuff');
});

test('COMPANION-KIT BY TOUCH, IN A BLAST, AND NEVER HARM: a ByTouch heal at her lands on her; an AreaAroundCaster heal reaches her in its radius (and not one far off); a damage spell is never a gift; a wall between us stops the crosshair\'s pick; another player\'s companion (a puppet) is never mine to give to (mutants: the touch marks without her, the blast without her, the wall unread, the puppet given)', () => {
  const p = mkPlayer(), h = hilda([0, 0, 2]);
  const { magic } = rig(p, [h]);
  magic.readySpell(spellOf(1, [HEAL, EMPTY, EMPTY]));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(h.entity.health, 30, 'by touch');
  // a gift is a SELF-CAST on her (ALLY-CAST's receiver's record): no save scales it - an immune career heals whole
  const pi = mkPlayer(), hi = hilda([0, 0, 2]);
  hi.entity.career = { immunityFlags: 0xff };
  const ri = rig(pi, [hi]);
  ri.magic.readySpell(spellOf(1, [HEAL, EMPTY, EMPTY]));
  ri.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(hi.entity.health, 30, 'no save on a gift');
  // a mixed spell (a Heal riding a Damage) is no gift at all - she is not even looked for
  const pm = mkPlayer(), hm = hilda([0, 0, 2]);
  const rm = rig(pm, [hm]);
  rm.magic.readySpell(spellOf(1, [HEAL, DAMAGE, EMPTY]));
  rm.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(hm.entity.health, 10, 'a Heal + Damage touch never lands on her');
  const p2 = mkPlayer(), near = hilda([2, 0, -1]), far = hilda([40, 0, 0], { companion: '42:Olaf' });
  far.entity.name = 'Olaf';
  const r2 = rig(p2, [near, far]);
  r2.magic.readySpell(spellOf(3, [HEAL, EMPTY, EMPTY]));
  r2.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(near.entity.health, 30, 'in the blast');
  assert.equal(far.entity.health, 10, 'out of it');
  const p3 = mkPlayer(), h3 = hilda([0, 0, 2]);
  const r3 = rig(p3, [h3]);
  r3.magic.readySpell(spellOf(1, [DAMAGE, EMPTY, EMPTY]));
  r3.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(h3.entity.health, 10, 'a harmful touch passes her by');
  const p4 = mkPlayer(), h4 = hilda([0, 0, 2]);
  const r4 = rig(p4, [h4], { wall: (d) => d / 2 });
  r4.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  r4.magic.castInput([0, 0.9, 0], [0, 0, 1]);   // near, so armed - and the click at her meets the wall
  assert.equal(p4.health, 40, 'behind a wall she is not under the crosshair: mine');
  assert.equal(h4.entity.health, 10);
  const p5 = mkPlayer(), puppet = hilda([0, 0, 2], { puppet: true, companion: 'peer:x:42:Hilda' });
  const r5 = rig(p5, [puppet]);
  r5.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(p5.health, 40, 'another\'s companion: mine, on the spot');
  assert.equal(puppet.entity.health, 10);
  assert.ok(ALLY_TOUCH_REACH > 2);
});

// ── the pack ────────────────────────────────────────────────────────────────────────────────────────────────────

const hand = (name) => ({ name, role: 'Bosun', mobile: 2, gender: 'male' });

test('COMPANION-KIT THE PACK IN THE PARTY: a companion comes ashore with an empty pack - the live list the window stows into; the save keeps it through the codec and a load brings it back through it; an older save\'s companion has none; his pack given up empties it (mutants: no pack, the codec unread either way, the list copied out of the window\'s reach, the pack kept after it was given up)', () => {
  const codec = { serialize: (items) => items.map((it) => ({ ...it, packed: true })), deserialize: (data) => data.map((d) => ({ ...d, unpacked: true })) };
  const p = createCompanions(null, codec);
  const c = p.take(7, hand('A'), 0);
  assert.deepEqual(c.items, []);
  const pack = p.packOf(7, 'A');
  assert.equal(pack, c.items, 'the live list');
  pack.push({ name: 'Rope' }, { name: 'Torch' });
  const snap = p.snapshot();
  assert.deepEqual(snap.party[0].items, [{ name: 'Rope', packed: true }, { name: 'Torch', packed: true }]);
  const back = createCompanions(JSON.parse(JSON.stringify(snap)), codec);
  assert.deepEqual(back.packOf(7, 'A'), [{ name: 'Rope', packed: true, unpacked: true }, { name: 'Torch', packed: true, unpacked: true }]);
  assert.deepEqual(createCompanions({ party: [{ boat: 7, name: 'B', role: 'Cook', mobile: 1 }] }).packOf(7, 'B'), [], 'an older save');
  const given = p.takePack(7, 'A');
  assert.equal(given.length, 2);
  assert.equal(p.packOf(7, 'A').length, 0, 'emptied');
  assert.deepEqual(p.takePack(7, 'A'), []);
  assert.equal(p.packOf(7, 'Nobody'), null);
});

test('COMPANION-KIT HIS PACK OPENED: activating my companion in Info, Grab or Talk opens his pack (the host\'s window) and is consumed; Steal from him is the shipmate\'s silent break; another player\'s companion and an ordinary foe say DFU\'s line (mutants: the arm dropped, Steal opening it, a peer\'s opened)', () => {
  const opened = [], hud = [];
  const deps = { hud: (t) => hud.push(t), openCompanion: (f) => { opened.push(f); return true; } };
  const me = { companion: '42:Hilda', shipmate: true, mobileType: 128, entity: { isClass: true } };
  for (const mode of ['info', 'grab', 'talk']) assert.equal(activateMobileEnemy(me, 1, mode, {}, deps), true);
  assert.equal(opened.length, 3);
  assert.equal(activateMobileEnemy(me, 1, 'steal', {}, deps), true);
  assert.equal(opened.length, 3, 'Steal never opens it');
  const peer = { companion: 'peer:x:42:Hilda', shipmate: true, mobileType: 128, entity: { isClass: true } };
  activateMobileEnemy(peer, 1, 'info', {}, deps);
  assert.equal(opened.length, 3, 'another\'s companion');
  activateMobileEnemy({ mobileType: 0, entity: {} }, 1, 'info', {}, deps);
  assert.equal(opened.length, 3);
  assert.ok(hud.length >= 2, 'DFU\'s line for them');
});

test('COMPANION-KIT THE PACK ON THE REAL HOST: his pack by his layer key; sent back aboard it is stowed in his boat\'s hold and said; knocked out, the same; a fallen hand\'s pack is not lost (mutants: the pack left on a companion gone, the knock dropping it, the prune dropping it)', async () => {
  const h = await sea({ hull: HULL.SmallShip });
  h.boat.crewed = true;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  h.run(0.2);
  h.runtime.sailing = false;
  const name = h.host.crewOf(h.boat).hands[0].name;
  assert.equal(h.host.companionPress(h.boat, name, 0), 'take');
  const pack = h.host.companionPack(`42:${name}`);
  assert.ok(pack && Array.isArray(pack.items) && pack.name === name);
  pack.items.push({ name: 'Rope' });
  assert.equal(h.host.companionPress(h.boat, name, 0), 'back');
  assert.deepEqual(h.log.given.at(-1), [1, h.boat], 'into her hold');
  assert.ok(h.log.say.some((t) => t.includes('pack is stowed in the hold')));
  // knocked out
  h.host.companionPress(h.boat, name, 0);
  h.host.companionPack(`42:${name}`).items.push({ name: 'Lamp' }, { name: 'Bread' });
  const c = h.host.companions.party[0];
  h.host.companions.knock(42, name, 0);
  h.host.companionKnocked(c);
  assert.deepEqual(h.log.given.at(-1), [2, h.boat], 'his pack with him');
  assert.equal(c.items.length, 0);
});

// ── the bar ─────────────────────────────────────────────────────────────────────────────────────────────────────

const WRITES = { n: 0 };
function fakeNode(tag) {
  const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; }, addEventListener(t, fn) { n.listeners.set(t, fn); }, remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); } };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); WRITES.n++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); WRITES.n++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; WRITES.n++; return true; } });
  if (n.tagName === 'CANVAS') n.getContext = () => null;
  return n;
}
function fakeDocument() {
  const doc = { createElement: (t) => fakeNode(t) };
  doc.head = fakeNode('head'); doc.body = fakeNode('body'); doc.documentElement = doc.body;
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

test('COMPANION-KIT THE DETAILED BAR: a companion\'s point draws the wider bar with his name and his health in digits over it and his effects under it (the letters while the icon art is on its way), at most MATE_FX_MAX; a deck hand\'s bar stays bare (mutants: no name, no digits, no effects, every bar a mate\'s)', () => {
  const doc = fakeDocument();
  const fxs = Array.from({ length: 8 }, (_, k) => ({ i: k, r: 5, n: `Fortify ${k}` }));
  drawCrewBars([
    { x: 10, y: 10, share: 0.5, distance: 5, name: 'Hilda', hp: 30, hpMax: 60, fx: fxs },
    { x: 50, y: 10, share: 1, distance: 5 },
  ], { doc });
  const bars = find(doc.body, 'dfnaval-crew');
  assert.equal(bars.length, 2);
  assert.equal(bars[0].className, 'dfnaval-crew mate');
  assert.equal(bars[0].children[0].style.width, '50%');
  assert.equal(find(bars[0], 'dfnaval-crew-name')[0].children[0].textContent, 'Hilda');
  assert.equal(find(bars[0], 'dfnaval-crew-hp')[0].textContent, '30/60');
  const tiles = find(bars[0], 'dfnaval-crew-fxe');
  assert.equal(tiles.length, MATE_FX_MAX);
  assert.ok(tiles.every((t) => t.textContent.length > 0 || t.children.length > 0));
  assert.equal(bars[1].className, 'dfnaval-crew');
  assert.equal(find(bars[1], 'dfnaval-crew-name')[0].children[0].textContent, '');
  assert.equal(find(bars[1], 'dfnaval-crew-hp')[0].textContent, '');
  assert.equal(find(bars[1], 'dfnaval-crew-fxe').length, 0);
  drawCrewBars([], { doc });
});

// ── the party panel ─────────────────────────────────────────────────────────────────────────────────────────────

test('COMPANION-KIT THE PARTY PANEL: with no party a companion ashore stands the panel for himself - his card his name, his role where a place goes, the role\'s letter on the plate, his health bar (no stamina or magicka), its digits while low and his effects; repainted only when his card\'s words move; gone with him (mutants: the panel hidden offline, the role unwritten, the card never repainted, the card kept)', () => {
  const doc = fakeDocument();
  let list = [{ key: '42:Hilda', name: 'Hilda', role: 'Bosun', h: 20, hm: 60, fx: [{ i: 3, r: 4, n: 'Fortify Strength' }] }];
  let asked = 0;
  const panel = createPartyPanel({ social: null, doc, faceLoader: async () => null, fxIcon: () => null, companions: () => { asked++; return list; } });
  const root = doc.body.children.at(-1);
  assert.equal(root.style.display, 'none');
  panel.render({});
  assert.equal(root.style.display, '', 'drawn for my companion alone');
  const card = find(root, 'dfparty-card')[0];
  assert.equal(card.className, 'dfparty-card mate');
  assert.equal(find(card, 'dfparty-name')[0].textContent, 'Hilda');
  assert.equal(find(card, 'dfparty-where')[0].textContent, 'Bosun');
  assert.equal(find(card, 'dfparty-where')[0].className, 'dfparty-where');
  assert.equal(find(card, 'dfparty-facemark')[0].textContent, 'B');
  assert.equal(find(card, 'dfparty-fill')[0].style.width, '33%');
  assert.equal(find(card, 'dfparty-hp')[0].className, 'dfparty-hp', 'low: the digits drawn');
  assert.equal(find(card, 'dfparty-fxe').length, 1);
  WRITES.n = 0; asked = 0;
  panel.render({});
  panel.render({});
  assert.equal(WRITES.n, 0, 'nothing moved: nothing written');
  assert.equal(asked, 2, 'and no repaint walked: the seam asked once a frame for the key alone');
  list = [{ ...list[0], h: 50 }];
  panel.render({});
  assert.equal(find(card, 'dfparty-fill')[0].style.width, '83%', 'repainted');
  assert.equal(find(card, 'dfparty-hp')[0].className, 'dfparty-hp off');
  assert.ok(companionKey(list[0]).includes('50/60'));
  list = [];
  panel.render({});
  assert.equal(panel.cardCount(), 0);
  assert.equal(root.style.display, 'none', 'gone with him');
  panel.setCompanions(() => [{ key: '42:Olaf', name: 'Olaf', role: 'Cook', h: 60, hm: 60, fx: [] }]);
  panel.render({});
  assert.equal(panel.cardCount(), 1, 'a seam handed in after the build');
  panel.render({ covered: true });
  assert.equal(root.style.display, 'none', 'under a window');
  panel.destroy();
});

test('COMPANION-KIT THE WORLD\'S WIRING: both cast engines are handed my companions\' bodies; activating one opens his pack as a Backpack storage over whatever the mode draws, in the street, a building and a dungeon; a tap never locks onto him; the bars carry his name, health and effects; the party panel is made in one place, over the party or none, with my companions under its seats (mutants: an engine without them, the pack never opened, the lock-on onto him, the bars bare, a second panel)', () => {
  const w = rd('src/scenes/world.js'), m = rd('src/scenes/worldModes.js'), d = rd('src/scenes/dungeonContext.js'), n = rd('src/scenes/naval/navalHost.js');
  assert.equal((w.match(/companionBodies: \(\) => (?:crewAshore\.bodies\(\)|\[\.\.\.crewAshore\.bodies\(\), \.\.\.revenantAshore\.bodies\(\)\]),/g) ?? []).length, 2, 'the world\'s engine and the dungeon\'s (REVENANT-COMPANION: the sworn with the crew)');
  assert.match(m, /companionBodies: \(\) => host\.companionBodies\?\.\(\) \?\? null,/);
  assert.match(d, /companionBodies: opts\.companionBodies \? \(\) => opts\.companionBodies\(\) : null,/);
  // AUDIT WK-P3 (PIN MOVED): his pack read by his key at every look, never a list taken once; COMPANION-WEIGHT (PIN
  // MOVED): and its capacity, his body's (companion_weight.test.js)
  assert.match(w, /const w = makeInventoryWindow\(\{ loot: \{ items: \(\) => naval\?\.companionPack\?\.\(key\)\?\.items \?\? \(orphan \?\?= \[\]\), containerImage: \(\) => CONTAINER_IMAGES\.Backpack, playerOwned: true, storage: true, capacity \} \}\);/);
  assert.match(w, /openCompanion: \(rec\) => openCompanionPack\(rec\),/);
  assert.match(w, /openCompanionPack: \(rec\) => openCompanionPack\(rec\),/);
  assert.equal((m.match(/openCompanion: \(rec\) => !!host\.openCompanionPack\?\.\(rec\),/g) ?? []).length, 2, 'a building and a dungeon');
  assert.match(w, /\[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards\]\.filter\(\(f\) => f\.companion == null\), collider, LOCK_PICK_DISTANCE\)/);
  // AUDIT WK-U3 (PIN MOVED): mine his name, health and effects; another player's his own name alone
  assert.match(w, /\.\.\.\(mate \? \(f\.puppet \? \{ name: f\.companionName \|\| 'Companion', fx: \[\] \} : \{ name: f\.entity\.name \|\| 'Companion', hp: f\.entity\.health, hpMax: max, fx: composePartyFx\(f\.entity\) \}\) : \{\}\)/);
  assert.equal((w.match(/createPartyPanel\(/g) ?? []).length, 1);
  assert.match(w, /partyPanel\.setCompanions\(partyCompanions\);/);
  assert.match(w, /if \(!partyCompanions\(\)\.length\) return;\n\s*makePartyPanel\(null\);/);
  assert.match(n, /packedItems \?\? null\);   \/\/ CREW-COMPANIONS: the party ashore/);
  // AUDIT WK-D11 (PIN MOVED): the one codec, the cargo's and the packs' both
  assert.match(w, /const packedItemsCodec = Object\.freeze\(\{ serialize: \(items\) => \(items \?\? \[\]\)\.map\(\(it\) => \(\{ \.\.\.it \}\)\), deserialize: \(records\) => \(records \?\? \[\]\)\.map\(\(it\) => setItemFields\(\{ \.\.\.it \}\)\) \}\);/);
  assert.equal((w.match(/packedItems: packedItemsCodec,/g) ?? []).length, 2, 'Come Sail Away\'s and the naval host\'s');
  assert.match(w, /packedItems: packedItemsCodec,   \/\/ COMPANION-KIT/);
});
