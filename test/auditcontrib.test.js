// AUDIT CONTRIB (2026-09-23, Mac: "Integrate these please. My contributer made these for the codebase") - the drop's
// hotbar, player corpses, Resurrect, death screen and UI sounds, read by three lenses after the merge. Each finding
// that could be driven is driven here; the host-only lines are pinned by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { resurrectionSpell, RESURRECT_TEXT } from '../src/systems/resurrect.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { RemotePlayers, CORPSE_MS } from '../src/net/remotePlayers.js';
import { DeathScreen, ONLINE_RESPAWN_SECONDS } from '../src/ui/deathScreen.js';
import { validFoeRecord } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { audio } from '../src/systems/audio.js';
import { setUiSkin, hotbarInForce } from '../src/systems/uiSkin.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { routeAction, setBindings, keyEdges, noteKeyDown, beginInputFrame, pressed, actionOf } from '../src/ui/input.js';
import { setModSetting } from '../src/systems/modSettings.js';
import { createBindings, resetDefaults, getBinding, HOTBAR_SLOT_ACTIONS } from '../src/systems/inputActions.js';
import * as HB from '../src/systems/quickslots.js';
import { TEMPLATES } from '../src/systems/useItem.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));

// ── A1: THE RESURRECT THE TOUCH PROBE ATE ─────────────────────────────────────────────────────────────────────────

function rezRig({ bodies }) {
  const said = [], raised = [];
  const player = { isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l),
    surfacePlayer() {},
    foes: () => [],   // NO foe anywhere - the case the touch probe refused
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
    startCastAnim: null,
    fallenTarget: () => bodies,
    raiseFallen: (f) => { raised.push(f.id); return true; },
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, player, said, raised };
}

test('AUDIT CONTRIB A1: a Resurrection cast at a fallen mate\'s body with NO foe in touch reach raises them - the ByTouch probe (foes and standing mates only) no longer eats it; with no body it spends nothing and says so', () => {
  const body = { id: 'peer-0002', acct: 'acct-bran', name: 'Bran', feet: [0, 0, 2] };
  const { magic, player, said, raised } = rezRig({ bodies: [body] });
  magic.readySpell(resurrectionSpell());
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true, 'the click casts');
  assert.deepEqual(raised, ['peer-0002'], 'the call went to the body');
  assert.ok(player.magicka < 500, 'and was paid for');
  assert.ok(said.includes(RESURRECT_TEXT.cast('Bran')));
  const none = rezRig({ bodies: [] });
  none.magic.readySpell(resurrectionSpell());
  assert.equal(none.magic.castInput([0, 0.9, 0], [0, 0, 1]), false);
  assert.deepEqual(none.raised, []); assert.equal(none.player.magicka, 500, 'nothing spent on a Resurrect with no body');
  assert.equal(none.said.at(-1), RESURRECT_TEXT.noBody);
});

// ── A2: ONE DEATH, HOWEVER MANY SOCKETS CARRY IT ─────────────────────────────────────────────────────────────────

test('AUDIT CONTRIB A2: a death pose heard down the cell\'s socket AND a halo\'s is ONE death (one body, one cry, one handover); a living pose after it is a new life that may die again', () => {
  const { FakeWS } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const deaths = [];
  s.onPeerDeath = (peer, pose, room) => deaths.push([peer.id, room]);
  const pose = (over = {}) => JSON.stringify({ t: 'pose', id: 'bob-0002', p: { x: 1, y: 0, z: 2, yaw: 0, pitch: 0, mv: 0, ...over } });
  s._receive(pose(), 'world:3,12');
  s._receive(pose({ dd: 1 }), 'world:3,12');
  s._receive(pose({ dd: 1 }), 'world:4,12');
  s._receive(pose({ dd: 1 }), 'world:3,13');
  assert.deepEqual(deaths, [['bob-0002', 'world:3,12']], 'the first copy alone - the others were the same death');
  s._receive(pose(), 'world:3,12');   // risen (a respawn, a Resurrect)
  s._receive(pose({ dd: 1 }), 'world:4,12');
  assert.equal(deaths.length, 2, 'the next death is a death');
  s.leave();
  s._receive(pose({ dd: 1 }), 'world:3,12');
  assert.equal(deaths.length, 3, 'a new room is a new hearing');
});

// ── A3: THE PARTY-TOLD BODY STANDS WHEREVER IT IS MET ────────────────────────────────────────────────────────────

test('AUDIT CONTRIB A3: a party member\'s body their party pose tells of stands when I come to its room after the death, stands again after a building took it from the scene, cries ONCE, and not past its minute', async () => {
  let t = 0; const heard = [];
  const renderer = { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} };
  const rp = new RemotePlayers({ renderer, now: () => t, deps: { audio: { playOneShot: (c) => heard.push(c) } } });
  const dd = { k: 'dungeon:9', x: 1, y: 0, z: 1, at: 5 };
  rp.partyBody('acct-bran', 'peer-0002', null, dd, false);
  assert.equal(rp.hasCorpseOf('acct-bran'), false, 'outdoors: not this scene\'s');
  t = 1000;
  rp.partyBody('acct-bran', 'peer-0002', null, dd, true);
  assert.equal(rp.hasCorpseOf('acct-bran'), true, 'I walked into the dungeon: it stands (the memo used to say "seen" and never looked again)');
  assert.equal(heard.length, 1);
  rp.keepCorpses(() => false);   // a building's walls
  assert.equal(rp.hasCorpseOf('acct-bran'), false);
  rp.partyBody('acct-bran', 'peer-0002', null, dd, true);
  assert.equal(rp.hasCorpseOf('acct-bran'), true, 'back out: it stands again');
  assert.equal(heard.length, 1, 'and does not cry twice');
  rp.keepCorpses(() => false);
  t = CORPSE_MS;   // the minute ran from the first word of this death (t = 0)
  rp.partyBody('acct-bran', 'peer-0002', null, dd, true);
  assert.equal(rp.hasCorpseOf('acct-bran'), false, 'its minute is over');
  rp.partyBody('acct-bran', 'peer-0002', null, { ...dd, at: 99 }, true);
  assert.equal(rp.hasCorpseOf('acct-bran'), true, 'a NEW death is its own minute');
  rp.partyRose('acct-bran');
  assert.equal(rp.hasCorpseOf('acct-bran'), false, 'and a rise takes it away');
});

// ── A4/A5: THE DEATH SCREEN'S HOLD AND ITS VIEW ─────────────────────────────────────────────────────────────────

test('AUDIT CONTRIB A5: ONLINE the hold is the screen\'s on the CLASSIC skin too - a party mate has the body\'s minute to raise me, and Enter still rises at once; offline classic keeps DFU\'s three seconds', () => {
  let resets = 0;
  const ds = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, onReset: () => { resets++; } });
  ds.fall = false; ds.online = true;
  ds.tick(5);
  assert.equal(resets, 0, 'three seconds used to respawn and clear the body');
  assert.equal(ds.respawnIn, ONLINE_RESPAWN_SECONDS - 5, 'and the classic face says how long');
  ds.input('confirm');
  assert.equal(resets, 1, 'Enter rises at once');
  const off = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, onReset: () => { resets++; } });
  off.fall = false; off.online = false;
  off.tick(3.1);
  assert.equal(resets, 2, 'offline classic: DFU\'s TimeBeforeReset, untouched');
  assert.equal(off.respawnIn, null);
});

test('AUDIT CONTRIB A4: a rise in place hands the fall\'s pitch back on every host (the dungeon\'s clear too), and F11 online goes through the sequence\'s own reset', () => {
  const ds = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8 });
  ds.fall = true;
  const cam = { pitch: 0.2 };
  ds.tick(1); ds.tiltView(cam);
  assert.ok(cam.pitch > 0.5, 'tilted at the sky');
  ds.restoreView();
  assert.equal(cam.pitch, 0.2, 'handed back');
  assert.match(rd('src/scenes/dungeonContext.js'), /clearDeathOverlay: \(\) => \{ if \(activeOverlay instanceof DeathScreen\) \{ activeOverlay\.restoreView\(\); activeOverlay = null; \} \}/,
    'the dungeon\'s clear restores the view, as the interior\'s does');
  assert.match(rd('src/scenes/world.js'), /if \(townTalk\.overlay instanceof DeathScreen && _deathWasOnline\) townTalk\.overlay\.input\('confirm'\);/,
    'F11 online is Enter\'s path - the respawn under a screen still tilting is gone');
});

test('AUDIT CONTRIB A6: the Resurrect snapshot is taken only while DEAD - not through a respawn\'s teleport - and let go the first living frame', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!_respawning\) \{\n\s*if \(!_rezSeen\) _rezSeen = rezSnapshot\(social\?\.others\(\) \?\? \[\]\);/);
  assert.match(w, /\}   \/\/ AUDIT WORLD B6: the dungeon's and the building's death screens stand in the mode's slot[^\n]*\n\s*_rezSeen = null;   \/\/ AUDIT CONTRIB A6/);
});

// ── P1-P3: THE DYING OWNER NAMES THE HEIRS ──────────────────────────────────────────────────────────────────────

function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const poolFor = (self) => {
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
    audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
  });
  pool.setNet({ room: () => 'world:3,12', selfId: () => self, now: () => 0, staleMs: 1e9, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
  return pool;
};

test('AUDIT CONTRIB P1-P3: the dying owner\'s last frame names each foe\'s heir; the survivor it names adopts it ON THAT FRAME (no death pose, no socket order), every other survivor keeps a puppet, and the owner lets go of exactly what it handed', async () => {
  assert.equal(validFoeRecord({ i: 1, e: 'carl-0003' }).e, 'carl-0003', 'the wire carries the heir');
  assert.equal(validFoeRecord({ i: 1, e: 'not an id!' }), null, 'and refuses a record whose heir is not an id');
  const ann = poolFor('ann-0001'), bob = poolFor('bob-0002'), carl = poolFor('carl-0003');
  const near = await ann.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const far = await ann.spawnFoe(0, [90, 0, 90], { feetGiven: true });
  const frame = ann.handOverFrame((f) => (f === near ? 'carl-0003' : null));
  assert.deepEqual(frame.f.map((r) => r.e ?? null).sort(), [null, 'carl-0003'].sort(), 'one heir named, one foe nobody stood near');
  bob.applyFoes('ann-0001', frame); carl.applyFoes('ann-0001', frame);
  await settle();
  const mine = carl.foes.filter((f) => !f.dead && !f.puppet);
  assert.equal(mine.length, 1, 'Carl owns the foe Ann named him for - streamed as his, its AI his');
  assert.deepEqual(mine[0].ai.feet.map(Math.round), [10, 0, 10]);
  assert.equal(carl.foes.filter((f) => f.puppet === 'ann-0001').length, 1, 'the unnamed one stays Ann\'s puppet (it goes at her leave)');
  assert.equal(bob.foes.filter((f) => !f.puppet).length, 0, 'Bob adopts nothing - there is ONE heir, whatever his own view says');
  assert.equal(ann.dropOwnLive(), 1, 'Ann lets go of the handed foe alone');
  assert.equal(near.dead, true); assert.equal(far.dead, false, 'P3: what nobody took stays hers - a Resurrect in place finds it');
  assert.match(rd('src/scenes/exteriorFoes.js'), /if \(heirOf && !onWatch && !f\.dead\)/, 'P2: a watchman is never handed - the watch goes with its criminal');
});

// ── S1, U1, U2 ──────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT CONTRIB S1: a peer with no look yet keeps the doll path - the Thief is for a look with no class, not for a look that has not arrived', () => {
  assert.match(rd('src/net/remotePlayers.js'), /: spritesOn && peer\.look \? classMobileType\(peer\.look\.class\) : null;/);
});

test('AUDIT CONTRIB U1/U2: only a sound chosen inside an input event stamps the click\'s "already sounded" (the frame loop\'s one-shots swallowed clicks), and the click\'s window opens at its own press', () => {
  const was = audio.lastOneShotAt;
  audio.lastOneShotAt = -1;
  audio.playOneShot(0, 1);
  assert.equal(audio.lastOneShotAt, -1, 'a hit, the ambience, a foe\'s cry: not the click\'s');
  globalThis.event = { type: 'click' };
  try { audio.playOneShot(0, 1); } finally { delete globalThis.event; }
  assert.ok(audio.lastOneShotAt > -1, 'a handler\'s own sound is');
  audio.lastOneShotAt = was;
  const u = rd('src/ui/uiClickSound.js');
  assert.match(u, /win\.addEventListener\('pointerdown', \(\) => \{ pressAt = nowMs\(\); \}, true\);/);
  assert.match(u, /const at = e\.detail > 0 && now - pressAt < GESTURE_MS \? pressAt : now;/);
  assert.doesNotMatch(u, /LEAD_MS/);
});

// ── H1-H5: THE HOTBAR ───────────────────────────────────────────────────────────────────────────────────────────

const withHotbar = (fn) => {
  setUiSkin('enhanced'); setPref('quickbarStyle', 'hotbar');
  try { return fn(); } finally { setPref('quickbarStyle', 'quickbar'); setUiSkin('classic'); }
};

test('AUDIT CONTRIB H1: with the hotbar in force the diamond is put AWAY - none of its five actions routes (a pad\'s d-pad, a rebound key) and its hold machine taps nothing; on the classic skin the pref is inert', () => {
  let used = 0;
  const ctx = { quickUse: () => { used++; return true; }, quickSwap: () => true, quickOffHand: () => true, quickSpell: () => true };
  withHotbar(() => {
    assert.equal(hotbarInForce(), true);
    for (const a of ['QuickUse1', 'QuickUse2', 'QuickSwap', 'QuickOffHand', 'QuickSpell']) assert.equal(routeAction(a, ctx), false, `${a} reaches a slot nobody can see`);
    assert.equal(used, 0);
    const taps = [];
    HB.tickQuickslotHold(0.016, { isHeld: () => true, onTap: (s) => taps.push(s) });
    HB.tickQuickslotHold(0.016, { isHeld: () => false, onTap: (s) => taps.push(s) });
    assert.deepEqual(taps, [], 'the diamond\'s held keys tap nothing');
  });
  setPref('quickbarStyle', 'hotbar');
  try { assert.equal(hotbarInForce(), false, 'classic skin: the diamond is the quickbar whatever the pref'); assert.equal(routeAction('QuickUse1', ctx), true); }
  finally { setPref('quickbarStyle', 'quickbar'); }
  assert.equal(used, 1);
});

test('AUDIT CONTRIB H1 (re-aimed by KB1): a mod\'s hotkey is the mod\'s ACTION - Horse Cart and Cargo\'s two answer while it is on and not while it is off, off the digit row the bar owns; the bar reads its ten slots through the registry', () => {
  // H1 first held this with `modHotkeyCodes()`, a set of the codes the mods' TextKeys named, which the bar stepped
  // aside for. KB1 retired the TextKeys: the mods' keys are registry actions, the readers' actionLive gate answers
  // for "the mod is off", and one key is one action - so the bar's digits and HCC's keys cannot meet at all.
  const store = createBindings();
  resetDefaults(store);
  setBindings(store);
  assert.equal(getBinding(store, 'HorseMount'), 'Comma');
  assert.equal(getBinding(store, 'HorseSummon'), 'Period');
  assert.deepEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'].map((c) => actionOf({ code: c })),
    [...HOTBAR_SLOT_ACTIONS], 'the digit row is the bar\'s ten slots, and nothing else\'s');
  const keys = new Set(['Comma']);
  const edge = keyEdges();
  noteKeyDown(edge, 'Comma');
  beginInputFrame(edge);
  setModSetting('horse-cart-and-cargo', 'Enabled', true);
  try { assert.equal(pressed(edge, keys, 'HorseMount'), true, 'on, the key mounts'); }
  finally { setModSetting('horse-cart-and-cargo', 'Enabled', false); }
  assert.equal(pressed(edge, keys, 'HorseMount'), false, 'a mod switched off answers nothing on its key');
  assert.equal(actionOf({ code: 'Comma' }), null, '...and its key means nothing to a listener either');
  const b = rd('src/ui/enhancedHotbar.js');
  assert.match(b, /const i = slotOfActions\(eventActions\(e\)\);/, 'the bar asks the registry which slot a key is (AUDIT KB1: through eventAction, the event\'s own read - no latch written; UXB1-S: every action a shared key carries)');
  assert.match(b, /const slotOfActions = \(acts\) => acts\.map\(\(a\) => HOTBAR_SLOT_ACTIONS\.indexOf\(a\)\)\.find\(\(i\) => i >= 0\) \?\? -1;/, '...the first of them that is a slot');
  assert.match(b, /if \(!bar \|\| !hotbarMode\(\) \|\| dropOwners\.size \|\| lastPaused\) return;/, 'gated on the game\'s pause, not the HUD\'s visibility');
  assert.match(rd('src/ui/hud.js'), /paused: !!cursorActive,/);
  setBindings(null);
});

const lightOf = (templateIndex, name) => ({ group: 'UselessItems2', templateIndex, name, currentCondition: 40, maxCondition: 100 });
const lightDoors = (me) => ({ quickUse: () => { HB.useQuickslot('c1', { entity: me, items: me.items }); return true; } });

test('AUDIT CONTRIB H2: the light slot lights THE LIGHT IT NAMES - a Candle slot lights the candle with a lantern carried, the lit one\'s slot douses it, and a slot whose light is gone refuses before any door', () => {
  HB.clearQuickslots();
  const candle = lightOf(TEMPLATES.Candle, 'Candle'), lantern = lightOf(TEMPLATES.Lantern, 'Lantern');
  const me = { isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items: [lantern, candle], lightSource: null };
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(candle));
  HB.setHotbarSlot(1, HB.hotbarEntryForItem(lantern));
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me) }).kind, 'light');
  assert.equal(me.lightSource, candle, 'the candle - the mod\'s toggle would have picked the lantern');
  HB.hotbarPress(1, { entity: me, doors: lightDoors(me) });
  assert.equal(me.lightSource, lantern, 'the lantern slot swaps to the lantern, not douses the candle');
  HB.hotbarPress(1, { entity: me, doors: lightDoors(me) });
  assert.equal(me.lightSource, null, 'and pressing the lit one\'s slot puts it out');
  const t1 = lightOf(TEMPLATES.Torch, 'Torch'), t2 = lightOf(TEMPLATES.Torch, 'Torch');
  me.items = [lantern, t1, t2]; me.lightSource = t2;
  HB.setHotbarSlot(2, HB.hotbarEntryForItem(t1));
  HB.hotbarPress(2, { entity: me, doors: lightDoors(me) });
  assert.equal(me.lightSource, null, 'two torches, the SECOND lit: the slot puts it out, not lights the first in its place');
  me.items = [lantern];
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me) }).kind, 'refused', 'no candle left: refused');
  assert.equal(me.lightSource, null, 'and nothing else was lit in its place');
  HB.clearQuickslots();
});

test('AUDIT CONTRIB H3: a refused press is a refusal - the performers\' own answer reaches the hotbar (the doors answer true to the route whatever happened); readySpell answers as SetReadySpell does', () => {
  HB.clearQuickslots();
  const dg = { group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', currentCondition: 50, maxCondition: 100 };
  const me = { isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [{ index: 7, name: 'Heal', element: 4, rangeType: 2 }], stats: {}, items: [] };
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(dg));
  HB.setHotbarSlot(1, HB.hotbarEntryForSpell(me.spells[0]));
  const doors = { quickSwap: () => { HB.swapQuickslot({ entity: me }); return true; },
    quickSpell: () => { HB.spellQuickslotPress({ entity: me, magic: { readiedIndex: () => null, readySpell: () => false, interceptAttack: () => false } }); return true; } };
  assert.equal(HB.hotbarPress(0, { entity: me, doors }).kind, 'refused', 'no dagger in the pack: the swap said none');
  assert.equal(HB.hotbarPress(1, { entity: me, doors }).kind, 'refused', 'the engine refused the ready (silence, no spell points)');
  const h = rd('src/scenes/hostMagic.js');
  assert.match(h, /say\(SILENCED_TEXT\); return false; \}/);
  assert.match(h, /say\(PRESS_BUTTON_TO_FIRE_SPELL\);   \/\/ classic: the next attack-click CASTS\n\s*return true;/);
  HB.clearQuickslots();
});

test('AUDIT CONTRIB H4/H5: the bar\'s view keys each pack record ONCE a frame, not once per slot; its icons ask with the dye', () => {
  HB.clearQuickslots();
  const pots = Array.from({ length: 40 }, (_, i) => ({ group: 'Weapons', templateIndex: 113, material: i % 7, name: 'Dagger', currentCondition: 50, maxCondition: 100 }));
  const me = { isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items: pots };
  for (let i = 0; i < 7; i++) HB.setHotbarSlot(i, HB.hotbarEntryForItem(pots[i]));
  let reads = 0;
  const counted = pots.map((p) => new Proxy(p, { get: (t, k) => { if (k === 'material') reads++; return t[k]; } }));
  me.items = counted;
  const v = HB.hotbarView(me);
  assert.equal(v.filter((s) => !s.empty && !s.ghost).length, 7);
  assert.ok(reads <= counted.length * 3, `the pack was keyed ${reads / counted.length}x per record - once per slot again`);
  assert.match(rd('src/ui/enhancedHotbar.js'), /requestIcon\(image\.archive, image\.record, \{ scale: 2, dye: image\.dye,/);
  HB.clearQuickslots();
});
