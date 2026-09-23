// NT1 - the resource-safety batch. Three teardown paths dropped
// allocations the 17e ownership rule assigns them (F213 the dungeon
// destroy's warm-window orphans, F054 the interior build leaked at the
// no-landing throw, F214 the cast engine's missiles with no destroy
// surface), and AudioEngine.ensure guarded its await with a boolean
// (F215) - the exact race its sibling MusicService diagnosed at AUDIT
// 19: "a guard set before its own async work is not idempotence, it is
// a race with a flag on it."

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { AudioEngine } from '../src/systems/audio.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');
const flush = async (n = 4) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

// ---------------------------------------------------------------
// 1. F215 - the boot latch is the PROMISE
// ---------------------------------------------------------------

test('NT1 (F215): every ensure caller rides the SAME boot promise', async () => {
  const eng = new AudioEngine();
  const f = async () => { throw new Error('no archive in this test'); };
  const p1 = eng.ensure(f);
  const p2 = eng.ensure(f);
  assert.equal(p1, p2, 'the flag IS the promise - two callers, one boot');
  await p1;
});

test('NT1 (F215): a second caller does not resolve before init has finished', async () => {
  const eng = new AudioEngine();
  let releaseFetch;
  const gate = new Promise((res) => { releaseFetch = res; });
  // the boolean version resolved caller 2 IMMEDIATELY, while this fetch
  // (and therefore `enabled`) was still pending - its one-shots dropped
  const fetchBytes = async () => { await gate; throw new Error('resolved late'); };
  eng.ensure(fetchBytes);
  let settled = false;
  eng.ensure(fetchBytes).then(() => { settled = true; });
  await flush();
  assert.equal(settled, false, 'caller 2 waits on the archive load');
  releaseFetch();
  await flush();
  assert.equal(settled, true, 'and resolves once init has actually run');
  assert.equal(eng.enabled, false, 'the failed load left the engine disabled - but VISIBLY, after the await');
});

// ---------------------------------------------------------------
// 2. F214 - the cast engine's own destroy
// ---------------------------------------------------------------

function rig() {
  const world = { made: 0, freed: 0 };
  const player = {
    isPlayer: true, level: 5, health: 100, maxHealth: 100,
    maxMagicka: 500, magicka: 500,
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
    stats: { intelligence: 50, willpower: 50, endurance: 50 },
    career: {}, activeEffects: [],
  };
  const magic = createPlayerMagic({
    renderer: {
      createBillboardBatch: () => { world.made++; return { origin: null }; },
      destroyBillboardBatch: () => { world.freed++; },
    },
    audio: { playOneShot: () => {}, play3d: () => {}, playOneShotId: () => {}, play3dId: () => {} },   // AUDIT 58: the ID door twins
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord: () => {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say: () => {},
    surfacePlayer: () => {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
  });
  return { magic, world };
}
const rangedSpell = () => ({
  name: 'Test Spell', index: 90, element: 0, rangeType: 2,
  effects: [{
    type: 4, subType: 0,
    magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  }],
});

test('NT1 (F214): destroy() frees a missile still in flight - batch, list and count', async () => {
  const { magic, world } = rig();
  magic.setReadied(rangedSpell());
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true, 'the missile fired');
  magic.update(0.05, [0, 0, -5]);
  await flush();   // ensureMissileBatch's texture warm publishes the batch
  assert.ok(world.made > 0, 'the flight owns a live batch');
  assert.ok(magic.missileCount() > 0);
  magic.destroy();
  assert.equal(world.freed, world.made, 'every batch the engine minted is freed');
  assert.equal(magic.missileCount(), 0);
  assert.equal(magic.batches().length, 0, 'nothing left for a host to draw');
  // the candle drops through its OWN retire path (dropSprite -> onRetire),
  // never a raw free out from under its internal state
  assert.match(src('scenes/hostMagic.js'), /destroy\(\) \{[^}]*candle\.clear\(\);/,
    'destroy extinguishes the candle through clear()');
});

test('NT1 (F214): a texture warming ACROSS destroy publishes nothing after it', async () => {
  const { magic, world } = rig();
  magic.setReadied(rangedSpell());
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  magic.update(0.05, [0, 0, -5]);
  magic.destroy();   // before the async warm lands - retireMissile marked it dead
  await flush();
  assert.equal(world.made, 0, 'the dead check stops the orphan mint');
  assert.equal(magic.batches().length, 0);
});

// ---------------------------------------------------------------
// 3. F213 + F054 - the scene teardown order (source pins; the
//    behaviors ride droppedLoot's own pinned dead-latch protocol)
// ---------------------------------------------------------------

test('NT1 (F213): dungeonContext.destroy latches FIRST and marks piles dead before freeing', () => {
  const dc = src('scenes/dungeonContext.js');
  const body = dc.slice(dc.indexOf('    destroy() {'));
  assert.match(body, /destroy\(\) \{\n      _ctxDead = true;/,
    'the context dead latch is the first act of destroy');
  assert.ok(body.indexOf("for (const p of droppedLoot._piles) { p.dead = true; if (p.batch) renderer.destroyBillboardBatch(p.batch); }") > 0,
    'dead BEFORE free - the droppedLoot removal protocol, so a warming pile cannot mint onto the orphan');
  assert.ok(body.includes('magic.destroy();'),
    'the context-minted cast engine dies with the scene (F214 wired)');
  // and the corpse warm-window reads the latch
  assert.ok(dc.includes('if (!f.dead || _ctxDead) return;'),
    'spawnCorpse stops publishing once the context is torn down');
});

test('NT1 (F054): the no-landing throw frees the interior build it abandons', () => {
  const wm = src('scenes/worldModes.js');
  assert.ok(wm.includes("if (!landing) { ctx.destroy(); throw new Error('no interior landing'); }"),
    'the fully-built context is freed before the throw the hosts only log');
});

// ---------------------------------------------------------------
// 4. AUDIT-WH R6 - THE PLAQUE'S OWN ALLOCATION, and the six doors
//    that are supposed to close it
// ---------------------------------------------------------------
//
// This file is the 17e ownership rule's gate and it had no opinion
// about the world plaque, which is a `document.body` child with a
// module-level handle - the exact shape NT1 exists for. The audit
// found ONE of its six doors pinned anywhere in the tree: the modal
// arms' mode exits. The five that were not are the two above-ground
// hosts' unwinds, the standalone dungeon's, and the dungeon context's
// own destroy - and `world.js` had imported the door without ever
// calling it while `exterior.js` had no teardown at all.

test('NT1 / AUDIT-WH R6: the world plaque has ONE owner per host, and every one of them frees it', () => {
  const plaque = src('ui/worldPlaque.js');
  // The node is module state with one creator and one destroyer.
  assert.match(plaque, /function ensure\(\) \{\n  if \(node \|\| typeof document === 'undefined'\) return node;/,
    'one creator, idempotent');
  assert.match(plaque, /export function destroyWorldPlaque\(\) \{[\s\S]{0,400}node = null;/,
    'one destroyer, and it drops the handle');
  // ...and the destroyer resets EVERY piece of module state, or the
  // next host inherits a guard that says the plaque already shows what
  // it does not.
  const destroy = plaque.slice(plaque.indexOf('export function destroyWorldPlaque() {'));
  for (const slot of ['node = null;', 'shownSig = null;', 'lastX = null;', 'lastTop = null;',
    '_faults = 0;', '_faultSaid = false;', '_gateMark = null;', '_gateOn = false;']) {
    assert.ok(destroy.includes(slot), `destroyWorldPlaque leaves ${slot.split(' ')[0]} behind`);
  }
  // THE SIX DOORS. Five of them were unpinned before AUDIT-WH R6, and
  // two of those were not merely unpinned - they did not exist.
  const DOORS = [
    ['scenes/world.js', /if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}/, 'the streaming host\'s unwind'],
    ['scenes/exterior.js', /if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}/, 'the fixed city\'s unwind'],
    ['scenes/dungeon.js', /if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}/, 'the dev door\'s unwind'],
    ['scenes/worldModes.js', /destroyWorldPlaque\(\);   \/\/ WORLD-HOVER/, 'the modal arms\' mode exits'],
    ['scenes/dungeonContext.js', /destroyWorldPlaque\(\);/, 'the dungeon context\'s destroy'],
  ];
  for (const [f, re, what] of DOORS) assert.match(src(f), re, `${what} does not free the plaque`);
  // The modal machine has THREE exits, not one - two back to the
  // street and the machine's own destroy - and all three say it.
  assert.equal((src('scenes/worldModes.js').match(/destroyWorldPlaque\(\);/g) ?? []).length, 3,
    'every way out of a mode frees it');
  // The seam itself allocates nothing that outlives a frame: the only
  // persistent handles are the node and the watchdog's timer, and the
  // only growing state is a fault COUNT.
  //
  // AUDIT-WH2 L3-F2: `_watchdog` is the second handle this module owns -
  // a pending setTimeout - and `_schedule`/`_cancel` are the two clocks
  // a test swaps for it. All three are in the allowlist BECAUSE the
  // destroy-slot list below names the one that is a live resource.
  assert.doesNotMatch(plaque, /^let (?!node|shownSig|lastX|lastTop|_faults|_faultSaid|_gateMark|_gateOn|_watchdog|_schedule|_cancel)/m,
    'a new module-level slot needs an owner and a line in destroyWorldPlaque');
  // ...and the timer is CANCELLED, not merely forgotten: a dropped
  // handle keeps firing, and in a test run it holds the event loop
  // open past the last assertion.
  assert.match(plaque, /export function destroyWorldPlaque\(\) \{\n(?:\s*\/\/[^\n]*\n)*\s+_cancel\(_watchdog\);\n\s+_watchdog = null;/,
    'the teardown frees the watchdog before anything else');
  assert.match(plaque, /export function hideWorldPlaque\(\) \{\n(?:\s*\/\/[^\n]*\n)*\s+_cancel\(_watchdog\);\n\s+_watchdog = null;/,
    'and so does the hide - the heartbeat stops with the thing it watches');
  // QUICK-LOOT B3/B4: the highlight is ABOUT a key in the world this
  // teardown is unmaking, so it dies with it - a selection carried
  // across a mode change points the take at a pile that is gone, and a
  // pending nudge spent in a dungeon would move the highlight in the
  // street. The STATE is the feature's (systems/quickLoot.js, where the
  // take can reach it without a systems module importing a draw); the
  // teardown that frees it is still this module's, because this is the
  // door the hosts call.
  assert.match(plaque, /export function destroyWorldPlaque\(\)[\s\S]{0,1400}?\n\s+resetQuickLoot\(\);/,
    'the teardown frees the feature\'s selection and pending nudge');
  const ql = src('systems/quickLoot.js');
  // ...and that is what freeing them means - EVERY slot the feature
  // owns, held the same way the plaque's own destroy-slot list above
  // holds its own: a name here per `let` there, and a new `let` with no
  // line in the reset fails the second half.
  const reset = ql.slice(ql.indexOf('export function resetQuickLoot() {'));
  for (const slot of ['_sel = null;', '_nudge = 0;', '_pending = null;', '_actionIds = null;', '_lastKey = null;', '_tookSound = null;']) {   // ACT-MENU: the lit list's verbs; SND1: the press's pending sound
    assert.ok(reset.slice(0, reset.indexOf('}')).includes(slot), `resetQuickLoot leaves ${slot.split(' ')[0]} behind`);
  }
  assert.doesNotMatch(ql, /^let (?!_sel|_nudge|_pending|_actionIds|_lastKey|_tookSound)/m,
    'a new module-level slot needs an owner and a line in resetQuickLoot');
  assert.doesNotMatch(ql, /from '\.\.\/ui\//,
    'the feature owns its own state, so it never has to reach into a draw to read it');
});
