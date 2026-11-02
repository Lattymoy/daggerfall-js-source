// AUDIT LOCKPICK (2026-10-26, the owner: "Audit this" - bible/01-Overview/audits/Audit-Lockpick.md): THE LOCK'S DOORS,
// DRIVEN. The record's sites were pinned by their source text alone, and a front door that threw on every press shipped
// green (A1: the ladder's own `lockpick` - the skill - shadowed the host). Here the real worldModes `tryEnter` picks a
// locked House1's front door in Steal mode, and the real door and window (ui/lockpickDoor.js, ui/lockpickWindow.js) stand
// over test/lockDom.mjs:
//   A1 / A5 - the window opens at the door; picked, CG2's tally lands, the success line is said and the door is entered.
//   A3 - a death screen taking the slot in the opened lock's hold runs no tail; the player's own Leave does; a death
//        mid-pick under a slot that is overwritten, never disposed, takes the window down by its own frame.
//   A8 - Gentle work's timing presses are inert; the door closes once, its `done` true before its `onClose`; the last
//        pick's `out` cancels the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../lockDom.mjs';
import '../../modsOff.js';
import { Collider } from '../../../src/player/collider.js';
import { PlayerMotor } from '../../../src/player/motor.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { setInteractionMode } from '../../../src/player/interactionMode.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { lockpicks, lockpickCount } from '../../../src/systems/lockpick/lockpickItem.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { setCrimeGuildClock } from '../../../src/systems/crimeGuilds.js';
import { LOCKPICKING_SUCCESS_TEXT } from '../../../src/world/actionSystem.js';
import { createLockpickHost, OPEN_HOLD_MS } from '../../../src/scenes/lockpickHost.js';
import { createLockpickOverlay } from '../../../src/ui/lockpickDoor.js';
import { createLockpickAct } from '../../../src/systems/lockpick/lockpickAct.js';

globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
globalThis.fetch = async () => { throw new Error('no fetch'); };
const { createWorldModes } = await import('../../../src/scenes/worldModes.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = async (fn) => {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
};

// THE STREET: a stub host's worldModes (test/systems/fb1013e_doorname.test.js's rig) with one locked House1 before the player
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// House1: its 0/0 hours row never opens (world/buildingLocks.js) - locked at every hour
const HOUSE = Object.freeze({ buildingKey: 0x10303, name: '', buildingType: BUILDING_TYPES.House1, quality: 8, factionId: 0, nameSeed: 1, regionIndex: 17, locationIndex: 5 });
const DOOR = { matrix: I, centre: { x: 0, y: 1.2, z: -1.2 }, normal: { x: 0, y: 0, z: 1 }, size: { x: 0.2, y: 2.4, z: 1.4 }, doorType: 1, buildingKey: HOUSE.buildingKey };
const ENTRY = { door: DOOR, dfBlock: { index: 1 }, recordIndex: 3, pixelKey: 0, climateBase: 300, season: 0, dfLocation: null, group: 'g' };
const deep = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : deep()), apply: () => deep(), construct: () => deep() });
const street = new Collider(() => 0);
const player = new PlayerMotor(street);
const said = [];
let slot = null;
const townTalk = { say: (l) => said.push(l), showOverlay: (w) => { const out = slot && slot !== w ? slot : null; slot = w; out?.dispose?.(); }, get overlayActive() { return !!slot && !slot.done; } };
const canvas = { width: 640, height: 400, clientWidth: 640, clientHeight: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
const modes = await quiet(async () => createWorldModes({
  canvas, renderer: deep(), player, cam: { yaw: 0, pitch: 0, pos: [0, 1.6, 0] }, keys: new Set(), latch: { edge: deep() }, blocks: null, pipeline: deep(),
  townTalk, doorTargets: () => [ENTRY], baseCollider: () => street, buildingTargets: () => [],
  buildingDataForDoor: (e) => (e.recordIndex === 3 ? { ...HOUSE } : null), discoveryLocationId: () => 'testtown',
  activateDir: () => { const e = player.eye; const d = [0 - e[0], 1.2 - e[1], -1.2 - e[2]]; const l = Math.hypot(...d); return d.map((v) => v / l); },
}));
const dom = installDom();   // after the modes stand, as the game's own boot stands them headless

test('AUDIT LOCKPICK A1, A5: a locked front door in Steal mode opens the lock\'s window; picked, the break-in is tallied (CG2), the line said and the door entered, picked (mutants: the host shadowed; the tally dropped; the door never entered)', async () => {
  playerEntity.items = [lockpicks(5)];
  playerEntity.skillOverrides = { ...(playerEntity.skillOverrides ?? {}), [SKILLS.Lockpicking]: 100 };
  const uses = playerEntity.skillUses?.[SKILLS.Lockpicking] ?? 0;
  playerEntity.thievesGuildRequirementTally = 0; playerEntity.timeForThievesGuildLetter = 0;
  const clock = setCrimeGuildClock(() => 1000);
  setInteractionMode('steal');
  try {
    let threw = null;
    const answered = await quiet(async () => { try { return await modes.tryEnter(); } catch (e) { threw = e; return null; } });
    assert.equal(threw, null, `the press threw: ${threw?.message}`);
    assert.equal(answered, true, 'the press is spent');
    assert.ok(dom.doc.body.find((e) => e.className === 'lk-win'), 'the lock\'s window stands at the door');
    const roll = Math.random; Math.random = () => 0;   // the Auto attempt: DFU's own roll, under the chance
    try { dom.key('KeyQ'); } finally { Math.random = roll; }
    dom.frames(0.8);
    // the hold, then the picked door's own entry (async): waited on, never a guessed sleep - a loaded machine is slower
    await quiet(async () => { for (let t = 0; t < 5000 && !(said.includes(LOCKPICKING_SUCCESS_TEXT) && said.indexOf(LOCKPICKING_SUCCESS_TEXT) < said.length - 1); t += 50) await sleep(50); });
    assert.ok(OPEN_HOLD_MS > 0);
    assert.equal(playerEntity.thievesGuildRequirementTally, 1, 'CG2: a picked exterior lock is a break-in');
    assert.equal((playerEntity.skillUses?.[SKILLS.Lockpicking] ?? 0) - uses, 1, 'Lockpicking tallied once');
    assert.equal(lockpickCount(playerEntity.items), 5, 'an open costs no pick');
    assert.ok(said.includes(LOCKPICKING_SUCCESS_TEXT), 'the success line');
    assert.ok(said.indexOf(LOCKPICKING_SUCCESS_TEXT) < said.length - 1, 'and the door entered, picked - the house says what it holds after it');
  } finally { setCrimeGuildClock(clock); setInteractionMode('dialogue'); }
});

/** A host over the real door and window, its slot a townTalk-shaped one (a showOverlay replaces and disposes). */
function rig({ picks = 3, gentle = false, rolls = () => 0.5 } = {}) {
  const player = { items: picks ? [lockpicks(picks)] : [], level: 4, skills: new Array(35).fill(40), skillUses: new Array(35).fill(0), stats: {} };
  const slot = { overlay: null, show(w) { const out = slot.overlay && slot.overlay !== w ? slot.overlay : null; slot.overlay = w; out?.dispose?.(); return true; } };
  const host = createLockpickHost({ player, mount: (w) => slot.show(w), say: () => {}, line: () => {}, changed: () => {},
    audio: { playOneShot() {}, registerSound: async () => true }, gentle: () => gentle, reduced: () => false, rolls });
  return { host, player, slot };
}

test('AUDIT LOCKPICK A3: opened, then a death screen takes the slot in the hold - no success tail under it; the player\'s Leave in the hold runs it once (mutant: the tail on any close)', async () => {
  for (const [how, want] of [['death', 0], ['leave', 1]]) {
    const r = rig({ rolls: () => 0 });
    let tail = 0;
    r.host.inside({ lock: 4, key: `door:1:${how}`, onOpen: () => tail++ });
    dom.frames(0.1);
    dom.key('KeyQ');   // opened
    dom.frames(0.2);
    if (how === 'death') r.slot.show({ name: 'DeathScreen', dispose() {} });
    else dom.key('Escape');
    await sleep(OPEN_HOLD_MS + 60);
    assert.equal(tail, want, how);
    assert.equal(dom.listeners(), 0, `${how}: no listener left`);
  }
  // dead mid-pick where the slot is overwritten, never disposed (an interior's): the window's own frame sees it and goes
  const r = rig();
  r.host.inside({ lock: 4, key: 'door:1:dead', onOpen: () => assert.fail('no tail') });
  dom.frames(0.1);
  assert.ok(dom.doc.getElementById('lockpick-host'), 'standing');
  r.player.health = 0;
  dom.frames(0.1);
  assert.equal(dom.doc.getElementById('lockpick-host'), null, 'dead under it: the window goes (mutant: `gone` unread)');
  assert.equal(dom.listeners(), 0);
});

test('AUDIT LOCKPICK A8: Gentle work\'s timing presses are inert; the door closes once, `done` before its `onClose`; the last pick\'s `out` cancels the machine (mutants: Gentle still times; the door closes twice; done read late; out leaves the machine live)', () => {
  const act = createLockpickAct({ lock: 8, chance: 40, seed: 7, skill: 40, rng: () => 0.5 });
  const closes = [];
  let ov = null;
  ov = createLockpickOverlay({ act, what: 'the door', seed: 7, skill: 40, gentle: true, reduced: () => false, difficulty: '', picks: () => 3,
    onAnswer: () => {}, onClose: (self) => closes.push([self, ov.done, !!dom.doc.getElementById('lockpick-host')]) });
  const rest = JSON.stringify(act.state.pins.map((p) => p.phase));
  for (const k of ['Space', 'ArrowRight', 'Digit2', 'Enter', 'KeyW']) dom.key(k);
  dom.frames(0.5);
  assert.equal(JSON.stringify(act.state.pins.map((p) => p.phase)), rest, 'Gentle work: no pin lifted by a timing press');
  ov.out();
  assert.equal(act.state.cancelled === true || act.state.done === true, true, 'out: the machine is ended');
  ov.dispose(); ov.dispose(); ov.shut();
  assert.deepEqual(closes, [[false, true, false]], 'once; done and the DOM gone before the host is told; a replacement is no self-close');
});
