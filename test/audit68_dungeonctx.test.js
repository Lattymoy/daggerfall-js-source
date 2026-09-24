// AUDIT 68 (2026-09-24) - cluster "dungeonctx", S19 src/scenes/dungeonContext.js. Mounted, not matched: the
// statements below are sliced out of the context's source and run against the real systems they call - a corpse
// takes no blow, the exhaustion guard is the box, a rebuilt record takes its body with it, a Destroy()ed foe is no
// container, a load and the teardown end this context's own flights, a magic round is nobody's blow unless its tick
// says so, the rest decays the alert on the session's minute, and a bow shot's hit frame skips no draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { makeWindowStack, pauseWhileOpen } from '../src/ui/windowStack.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { attemptSoulTrap, fillEmptyTrap, SOUL_TRAP_TEMPLATE } from '../src/systems/mysticism.js';
import { applySpell } from '../src/systems/effects.js';
import { inflictPoison, POISONS } from '../src/systems/poisons.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { killIfAnyLiveStatZero } from '../src/systems/statMods.js';
import { decayEnemyAlert, setEnemyAlert, ALERT_DECAY_MINUTES } from '../src/systems/encounters.js';
import { PLAYER_TARGET, resetAllyTeamOnPlayerAttack, isLocalPlayerTarget } from '../src/characters/enemyTargets.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { CORPSE_ACTIVATION_DISTANCE } from '../src/scenes/hostCombat.js';

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });

/** The first node the predicate names, walked in source order. */
function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const has = (name) => !!find((n) => n.type === 'FunctionDeclaration' && n.id?.name === name);
const fnSrc = (name) => {
  const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
  assert.ok(n, `src has function ${name}`);
  return D.slice(n.start, n.end);
};
/** `const name = ...;` - the whole declaration. */
const declSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name));
  assert.ok(n, `src declares ${name}`);
  return D.slice(n.start, n.end);
};
/** The initialiser of `const name = <init>` wherever it sits (buildFoeAt's `stand`). */
const initSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclarator' && x.id?.name === name);
  assert.ok(n, `src declares ${name}`);
  return D.slice(n.init.start, n.init.end);
};
/** An object-literal member as a function expression: `name(...) {...}` or `name: (...) => ...` - the first whose
 *  body carries `mark`, when two objects name one member. */
const memberSrc = (name, mark = '') => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name
    && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression')
    && D.slice(x.value.start, x.value.end).includes(mark));
  assert.ok(n, `src has member ${name}`);
  const body = D.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
/** Run `body` (source text ending in a `return {...}`) with `state` as its free variables. */
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const tick = () => new Promise((r) => setTimeout(r, 0));
const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; };

/** A dungeon foe record as buildFoeAt stands it, as far as these doors read it. */
const foeRec = (over = {}) => ({
  mobileType: 0, dead: false, gender: 'male',
  entity: { health: 5, maxHealth: 5, level: 5, items: [], activeEffects: [], stats: { willpower: 50 }, career: {}, skills: {}, team: 'Vermin' },
  ai: { feet: [0, 0, 0], yaw: 0, isHostile: true, target: null },
  ...over,
});

/** The kill door and the corpse chain: damageFoe + handleAttackFromPlayer + the round sink bag, with the REAL
 *  spawnCorpse / spawnCorpseNow / freeCorpse / setFoeDead / dropCandidate and buildFoeAt's `stand`. */
function killHarness({ foes, foeDeps = null, getTexture = async () => ({ recordCount: 99 }) } = {}) {
  const log = { deaths: 0, chimes: 0, freed: [], minted: 0, hud: [] };
  const state = {
    foes, foeDeps, _authority: true, _layoutFoes: foes.length, opts: {}, lastPlayerFeet: [0, 0, 0], _ecvT: 0, _ctxDead: false,
    playerEntity: { isPlayer: true, items: [], luck: 50 },
    markFoeStruck: () => {}, markConcealedHit: () => {}, makeEnemiesHostile: () => {}, peerCandidate: () => null,
    damageShieldPool: (e, n) => n, attemptSoulTrap, fillEmptyTrap, isAzurasStarEquipped: () => false,
    hudText: { add: (l) => log.hud.push(l) }, SOUL_TRAP_TEXT: { trapSuccess: 'ok', trapFail: 'fail', trapNoneEmpty: 'none' },
    setEnemyAlert, playRareDrop: () => { log.chimes++; }, raiseEnemyDeath: () => { log.deaths++; }, liveStat: () => 50,
    audio: {}, ENEMY_BASICS, weaponKnockbackApplies: () => false, maxFatigue: () => 100, q2: (x) => x, q3: (x) => x,
    _wallNow: () => null, floorLanding: (c, p) => p, collider: null, getTexture,
    uploadRecord: () => {}, billboardSize: () => ({ w: 1, h: 1 }), armFlatAnim: () => {}, flatAnims: { remove: () => {} }, uploadRecordFrame: () => {},
    billboardBatches: [], corpses: [], _lootSeen: new Set(), _lootAt: new Map(),   // corpses: the base's second owner list (AUDIT 68 S19-corpses-array-dead retired it)
    renderer: {
      createBillboardBatch: (archive, record) => { log.minted++; return { archive, record, id: log.minted }; },
      destroyBillboardBatch: (b) => { log.freed.push(b); },
    },
  };
  const api = mount(`
    ${declSrc('foeDrainMagicka')}
    ${declSrc('foeSinks')}
    ${fnSrc('handleAttackFromPlayer')}
    ${fnSrc('damageFoe')}
    ${fnSrc('spawnCorpse')}
    ${fnSrc('spawnCorpseNow')}
    ${fnSrc('freeCorpse')}
    ${fnSrc('setFoeDead')}
    ${fnSrc('dropCandidate')}
    const standAt = (at, rec) => (${initSrc('stand')})(rec);
    return { foeSinks, damageFoe, setFoeDead, spawnCorpse, standAt };
  `, state);
  return { ...api, state, log };
}

test('AUDIT 68 S19-damagefoe-dead-reentry: a corpse takes no blow - a second hurt in the same round does not run the death arm again, fill a second gem, or bring the body back to 1 HP', async () => {
  // The frame loop's round: a poison tick kills, the DoT tick after it in the SAME runMagicRoundsFor round enters
  // the door again. The foe carries a live Soul Trap (the entry applySpell's arm mints) and the player two empty gems.
  const gem = () => ({ group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: null });
  const rat = foeRec();
  rat.entity.activeEffects.push({ kind: 'soulTrap', chance: 100, roundsRemaining: 5 });
  const h = killHarness({ foes: [rat] });
  h.state.playerEntity.items = [gem(), gem()];
  const sinks = h.foeSinks(rat, false);
  sinks.hurt(6);
  sinks.hurt(3);
  await tick();
  assert.equal(rat.dead, true);
  assert.equal(h.log.deaths, 1, 'OnEnemyDeath once');
  assert.equal(h.log.chimes, 1, 'the rare-drop chime once');
  assert.equal(h.log.minted, 1, 'one corpse');
  assert.deepEqual(h.state.playerEntity.items.map((g) => g.trappedSoulType), [0, null], 'one soul, one gem');
  assert.equal(rat.entity.health, -1, 'the killing blow\'s number, nothing after it');
  // ...and the guard is the corpse's, not the tether's: a trapped foe with no empty gem left stands at 1 HP ALIVE,
  // and the next blow rolls again (EnemyEntity.SetHealth's intercept)
  const bat = foeRec({ mobileType: 3 });
  bat.entity.activeEffects.push({ kind: 'soulTrap', chance: 100, roundsRemaining: 5 });
  h.state.foes.push(bat);
  h.state.playerEntity.items = [];
  h.foeSinks(bat, false).hurt(9);
  assert.equal(bat.dead, false);
  assert.equal(bat.entity.health, 1);
  h.state.playerEntity.items.push(gem());
  h.foeSinks(bat, false).hurt(9);
  assert.equal(bat.dead, true);
  assert.equal(h.log.deaths, 2, 'its own one death');
});

/** drainFatigue + onExhausted + the push door + the host's close and tick, over the REAL window stack. */
function exhaustionHarness() {
  const log = { collapses: 0 };
  const state = {
    playerEntity: { fatigue: 100, health: 50, maxHealth: 50, magicka: 0, maxMagicka: 0 },
    surfacePlayer: () => {}, areEnemiesNearby: () => false, foes: [], _activity: { swimming: false },
    exhaustionOutcome: () => { log.collapses++; return { kind: 'rest', textId: 1, health: 0, fatigue: 0, magicka: 0 }; },
    EXHAUSTED_IN_WATER: 'water', rscLines: () => ['You collapse from exhaustion.'], ActionTextBox,
    classicMinutesRef: { value: 1000 }, maxFatigue: () => 100, tallySkill: () => {}, SKILLS: { Medical: 0 },
    hurtEntity: () => {}, fatigueLossMultiplierFor: () => 1, makeWindowStack, pauseWhileOpen,
    activeOverlay: null, _ctxDead: false,
  };
  const i = D.indexOf('let _exhausted');
  const decl = D.slice(i, D.indexOf('function drainFatigue(', i));
  const api = mount(`
    ${declSrc('dungeonWindows')}
    ${declSrc('dungeonPaused')}
    ${decl}
    ${fnSrc('pushDungeonWindow')}
    ${fnSrc('drainFatigue')}
    ${fnSrc('onExhausted')}
    const overlayInput = ${memberSrc('overlayInput')};
    const tickOverlay = ${memberSrc('tickOverlay')};
    // the hosts' two gates (worldModes.js' dungeon frame): the paused arm ticks and draws the overlay, else an
    // unpaused one; neither draws an EMPTY slot
    const frame = () => {
      if (dungeonPaused()) { tickOverlay(1 / 60); return; }
      if (!!activeOverlay && !dungeonPaused()) tickOverlay(1 / 60);
    };
    return { drainFatigue, overlayInput, frame, pushDungeonWindow, dungeonWindows };
  `, state);
  return { ...api, state, log };
}

test('AUDIT 68 S19-exhaustion-latch-stuck: the second exhaustion in the same dungeon collapses too - the guard is the box, and the box is gone once dismissed', () => {
  const h = exhaustionHarness();
  h.state.playerEntity.fatigue = 3;
  h.drainFatigue(5);
  assert.equal(h.log.collapses, 1);
  assert.ok(h.state.activeOverlay instanceof ActionTextBox, 'the collapse box is up');
  h.drainFatigue(5);
  assert.equal(h.log.collapses, 1, 'a drain under the standing box stacks nothing (displayingExhaustedPopup)');
  for (let f = 0; f < 3; f++) h.frame();
  h.overlayInput('confirm');
  assert.equal(h.state.activeOverlay, null, 'dismissed');
  for (let f = 0; f < 100; f++) h.frame();
  h.state.playerEntity.fatigue = 1;
  h.drainFatigue(5);
  assert.equal(h.log.collapses, 2, 'OnExhausted again - DFU clears the flag in the popup\'s OnClose');
  assert.ok(h.state.activeOverlay instanceof ActionTextBox && !h.state.activeOverlay.done, 'and its box is up');
});

test('AUDIT 68 S19-exhaustion-latch-stuck: the collapse box is PUSHED over a window already open (DaggerfallUI.MessageBox), and that window returns when it closes', () => {
  const h = exhaustionHarness();
  const under = new ActionTextBox(['a quest line']);
  h.pushDungeonWindow(under);
  h.state.playerEntity.fatigue = 1;
  h.drainFatigue(5);
  assert.equal(h.log.collapses, 1);
  assert.notEqual(h.state.activeOverlay, under, 'the collapse box is on top');
  assert.ok(h.state.activeOverlay instanceof ActionTextBox);
  assert.ok(h.dungeonWindows.containsWindow(under), 'over the window beneath, not instead of it');
  h.overlayInput('confirm');
  assert.equal(h.state.activeOverlay, under, 'PopWindow uncovers it');
});

test('AUDIT 68 S19-retype-orphans-corpse: a rebuild at the index takes the old record\'s BODY with it - the flat freed and undrawn, the body\'s loot record forgotten', async () => {
  const old = foeRec();
  const h = killHarness({ foes: [old] });
  h.setFoeDead(old, true);   // the stream's d:1 / the kill door's corpse
  await tick();
  const body = old.corpseBatch;
  assert.ok(body && h.state.billboardBatches.includes(body), 'the corpse draws');
  h.state._lootSeen.add('corpse:0'); h.state._lootAt.set('corpse:0', 123);
  const rec = foeRec();
  h.standAt(0, rec);   // retypeFoe's stand: the stream's un-death, a species mismatch, the hour's respawn
  assert.equal(h.state.foes[0], rec);
  assert.ok(!h.state.billboardBatches.includes(body), 'no host draws the old corpse');
  assert.ok(h.log.freed.includes(body), 'its VAO is freed');
  assert.equal(old.corpseBatch, null);
  assert.equal(old.corpse, false);
  assert.equal(h.state._lootSeen.has('corpse:0'), false, 'the next body at this index is a new container');
  assert.equal(h.state._lootAt.has('corpse:0'), false);
});

test('AUDIT 68 S19-retype-orphans-corpse: a corpse mint still warming lands on nothing once its record has been replaced', async () => {
  const warm = deferred();
  const old = foeRec();
  const h = killHarness({ foes: [old], getTexture: () => warm.p });
  h.setFoeDead(old, true);   // the mint awaits its archive
  h.standAt(0, foeRec());
  warm.resolve({ recordCount: 99 });
  await tick(); await tick();
  assert.equal(h.log.minted, 0, 'no batch minted for a record the pool no longer holds');
  assert.deepEqual(h.state.billboardBatches, []);
  assert.ok(!old.corpseBatch);
});

test('AUDIT 68 S19-removed-foe-lootable: a Destroy()ed foe (dispel, Wabbajack, a quest\'s removal) is no container - only a body the kill minted is', async () => {
  const lich = foeRec({ mobileType: 32 });
  lich.entity.items = [{ name: 'Lich loot' }];
  const rat = foeRec();
  rat.entity.items = [{ name: 'Rat loot' }];
  const h = killHarness({ foes: [lich, rat] });
  Object.assign(h.state, {
    lootPiles: [], RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE, CORPSE_ACTIVATION_DISTANCE,
    droppedLoot: { lootTargets: () => [] }, droppedTorches: { targets: () => [] }, camps: { targets: () => [] },
  });
  const loot = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${fnSrc('lootKeyOf')}
    ${has('lootableBody') ? fnSrc('lootableBody') : ''}
    ${fnSrc('lootHolder')}
    ${fnSrc('lootTargets')}
    ${fnSrc('dropCandidate')}
    const removeFoe = ${memberSrc('removeFoe')};
    return { lootHolder, lootTargets, removeFoe };
  `, h.state);
  loot.removeFoe(lich);   // questPoolOps.removeFoe: GameObject.Destroy - no corpse, no loot, no death
  h.foeSinks(rat, true).hurt(9);   // a kill, through the one door
  await tick();
  assert.equal(lich.dead, true);
  assert.deepEqual(loot.lootTargets().map((t) => t.key), ['corpse:1'], 'the rat\'s body alone');
  assert.equal(loot.lootHolder('corpse:0'), null, 'the room is told of no container at the lich\'s feet');
  assert.equal(loot.lootHolder('corpse:1'), rat.entity.items);
});

test('AUDIT 68 S19-removed-foe-lootable: every corpse door asks the one predicate', () => {
  const lc = memberSrc('lootContents');
  assert.match(lc, /if \(kind === 'corpse'\) \{ const f = foes\[i\]; return lootableBody\(f\) \?/, 'the hover plaque\'s contents');
  const tl = memberSrc('takeLoot');
  assert.match(tl, /\} else if \(kind === 'corpse'\) \{\s*const f = foes\[i\];\s*if \(!lootableBody\(f\)\) return 0;/, 'the open');
  assert.match(tl, /describe: \(k\) => \{ const b = foes\[Number\(k\.split\(':'\)\[1\]\)\]; return lootableBody\(b\) \? pileBody\(b\) : null; \}/, 'the pile\'s tabs');
  assert.match(fnSrc('_dungeonHoverName'), /return lootableBody\(f\) \? \{ title: corpseName\(enemyDisplayName\(f\.mobileType\)\) \} : null;/, 'the namer');
});

/** retireMissile + ensureMissileBatch + the local sweep, over one archive that may still be warming. */
function missileHarness(getTexture) {
  const state = {
    missiles: [], _pendingCasts: [], billboardBatches: [], dynamicDraws: [], freed: [],
    flatAnims: { remove: () => {} }, getTexture, missileArchive: () => 375, ORB_RECORD: 0, uploadRecord: () => {},
    noteOrbColour: () => {}, billboardSize: () => ({ w: 1, h: 1 }), ORB_SCALE: 1, centredBase: (p) => p, armFlatAnim: () => {}, MISSILE_FPS: 5,
    flatAnimsFps: 0, uploadRecordFrame: () => {},
  };
  state.renderer = { createBillboardBatch: () => ({ id: 'late' }), destroyBillboardBatch: (b) => { state.freed.push(b); } };
  const api = mount(`
    ${fnSrc('retireMissile')}
    ${fnSrc('ensureMissileBatch')}
    ${has('clearLocalMissiles') ? fnSrc('clearLocalMissiles') : 'const clearLocalMissiles = undefined;'}
    return { ensureMissileBatch, clearLocalMissiles };
  `, state);
  return { ...api, state };
}

test('AUDIT 68 S19-restore-missiles-survive: the context\'s own flights end - an enemy spell in the air, one whose archive is still warming, and a queued trap cast', async () => {
  const warm = deferred();
  const h = missileHarness(() => warm.p);
  const flying = { batch: { id: 'fireball' }, draw: null, spell: { element: 0 } };
  const warming = { batch: null, draw: null, spell: { element: 1 }, pos: [0, 0, 0] };
  h.state.billboardBatches.push(flying.batch);
  h.state.missiles.push(flying, warming);
  h.state._pendingCasts.push({ index: 7, origin: [0, 0, 0] });
  h.ensureMissileBatch(warming);
  assert.equal(typeof h.clearLocalMissiles, 'function', 'the context owns a sweep of its own flights');
  h.clearLocalMissiles();
  warm.resolve({ recordCount: 1, getColor32: () => 0, getDFBitmap: () => null });
  await tick();
  assert.deepEqual(h.state.missiles, []);
  assert.deepEqual(h.state._pendingCasts, [], 'a trap cast queued in the abandoned timeline does not fire');
  assert.deepEqual(h.state.billboardBatches, [], 'nothing left drawing, nothing minted late');
  assert.deepEqual(h.state.freed, [flying.batch], 'freed once');
  assert.equal(flying.dead, true);
  assert.equal(warming.dead, true);
  assert.equal(warming.batch, null, 'the warming continuation saw it dead');
});

test('AUDIT 68 S19-restore-missiles-survive: a same-dungeon load sweeps them beside the player\'s own, ahead of the world restore; the teardown before its batch loop', () => {
  const rs = memberSrc('restoreSaved');
  assert.match(rs, /magic\.clearMissiles\(\);\s*clearLocalMissiles\(\);/, 'the load');
  assert.ok(rs.indexOf('clearLocalMissiles();') < rs.indexOf('applyWorld(extras.world)'), 'OnStartLoad comes first');
  const ds = memberSrc('destroy', '_ctxDead = true;');
  assert.ok(ds.includes('clearLocalMissiles();') && ds.indexOf('clearLocalMissiles();') < ds.indexOf('for (const b of billboardBatches) renderer.destroyBatch(b);'),
    'retired - spliced, freed and dead - before the batch loop frees the rest');
  assert.doesNotMatch(ds, /for \(const m of missiles\) if \(m\.batch\) renderer\.destroyBillboardBatch/, 'and no second free after it');
});

const bleed = { type: 1, subType: 0, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 6, durationMod: 0, durationPerLevel: 1 };
const noSave = () => 0.99;
/** The frame body's foe half, sliced whole: the claimed window's rounds and the stat-zero kill, per live foe. */
function foeRoundBlock() {
  const i = D.indexOf('runMagicRoundsFor(f.entity, _tick.magicRoundWindow.from');
  const from = D.lastIndexOf('for (const f of foes) {', i);
  const kill = D.indexOf('killIfAnyLiveStatZero(f.entity, foeSinks(f', i);
  const to = D.indexOf('\n', kill);
  assert.ok(from > 0 && i > from && kill > i && to > kill, 'the frame body\'s foe rounds were found whole');
  return D.slice(from, to);
}
function roundHarness(foes) {
  const aggro = [];
  for (const f of foes) f.ai.makeEnemyHostileToAttacker = (t) => aggro.push({ foe: f, t });
  const h = killHarness({ foes, foeDeps: { PLAYER_TARGET, resetAllyTeamOnPlayerAttack, isLocalPlayerTarget, withinYaw: () => true } });
  Object.assign(h.state, { runMagicRoundsFor, killIfAnyLiveStatZero, dt: 1 / 60, foeSinks: h.foeSinks });
  const block = foeRoundBlock();
  const frame = mount(`const run = (from, to) => { const _tick = { magicRoundWindow: { from, to } };\n${block}\n}; return { run };`, h.state);
  // the call site's own statements; only the dice are fixed - every round's saving throw rolls Math.random
  // (tickActiveEffects' default), and a roll under the save would land no tick at all
  const run = (from, to) => { const dice = Math.random; Math.random = noSave; try { frame.run(from, to); } finally { Math.random = dice; } };
  return { ...h, aggro, frame: { run } };
}

test('AUDIT 68 S19-round-ticks-player-provenance: a monster\'s poison on the player\'s ally ticks as nobody\'s blow - the ally stays allied and passive', () => {
  const ally = foeRec({ mobileType: 13 });
  Object.assign(ally.entity, { health: 900, maxHealth: 900, team: 'PlayerAlly' });
  ally.ai.isHostile = false;
  const r = roundHarness([ally]);
  assert.ok(inflictPoison(ally.entity, POISONS.Nux_Vomica, true, { currentMinute: 0, rolls: () => 0.5 }), 'dosed by a monster\'s blade');
  r.frame.run(0, 120);
  assert.ok(ally.entity.health < 900, 'the poison bit');
  assert.equal(ally.entity.team, 'PlayerAlly', 'no ally-team reset (resetAllyTeamOnPlayerAttack is the PLAYER\'s attack)');
  assert.equal(ally.ai.isHostile, false);
  assert.deepEqual(r.aggro, [], 'and nobody was turned on the player');
});

test('AUDIT 68 S19-round-ticks-player-provenance: each Continuous Damage tick is billed to its CASTER - the player\'s bleed turns its foe every round, a monster\'s bleed on the foe beside it never does', () => {
  const mine = foeRec({ mobileType: 13 });
  const theirs = foeRec({ mobileType: 13 });
  for (const f of [mine, theirs]) Object.assign(f.entity, { health: 900, maxHealth: 900 });
  const monster = foeRec({ mobileType: 13 });
  const r = roundHarness([mine, theirs]);
  applySpell({ element: 0, rangeType: 2, effects: [bleed] }, 1, mine.entity, {}, noSave, { entity: r.state.playerEntity, sinks: {} });
  applySpell({ element: 0, rangeType: 2, effects: [bleed] }, 1, theirs.entity, {}, noSave, { entity: monster.entity, sinks: {} });
  const perRound = [];
  for (let m = 0; m < 3; m++) { const n = r.aggro.length; r.frame.run(m, m + 1); perRound.push(r.aggro.length - n); }
  assert.ok(mine.entity.health < 900 && theirs.entity.health < 900, 'both bled');
  assert.deepEqual(perRound, [1, 1, 1], 'one turn a round - the player\'s tick (DamageHealthFromSource -> HandleAttackFromSource), never the monster\'s');
  assert.ok(r.aggro.every((a) => a.foe === mine && a.t === PLAYER_TARGET), 'on the foe the PLAYER bled, at the player');
});

test('AUDIT 68 S19-round-ticks-player-provenance: the rest window\'s rounds and the frame\'s stat-zero kill are nobody\'s blow either', () => {
  assert.match(declSrc('_restAdvance'), /runMagicRoundsFor\(f\.entity, _w\.from, _w\.to, \{ sinks: foeSinks\(f, false\) \}\);/, 'the rest window');
  assert.match(foeRoundBlock(), /killIfAnyLiveStatZero\(f\.entity, foeSinks\(f, false\), dt\);/, 'SetHealth(0), no source');
});

test('AUDIT 68 S19-rest-alert-decay-wrong-clock: online, the rest decays the alert on the SESSION\'s minute - an alert past eight hours of rested night goes out, and the night rolls unarmed', () => {
  const rolled = [];
  const state = {
    // the shared clock REFUSES the write (worldTick.setWorldMinutes) and reads the live world minute
    classicMinutesRef: { get value() { return 5000; }, set value(v) { /* refused under the shared clock */ } },
    playerEntity: { level: 1, restAsks: 1 },
    claimMagicRounds: (a, b) => ({ from: a, to: b }), runMagicRoundsFor: () => 0, playerSinks: {}, hudText: { add: () => {} },
    survivalFeed: () => null, survivalEnvNow: () => null, runSurvivalMinutes: () => {}, foes: [], foeSinks: () => ({}),
    decayEnemyAlert, dfLocation: { mapTableData: { dungeonType: 0 } }, _spawnEncounter: () => {},
    intermittentEnemySpawn: (ctx) => { rolled.push(ctx.enemyAlertActive); return null; },
  };
  setEnemyAlert(state.playerEntity, true, 5000);
  const { restAdvance } = mount(`${declSrc('_restAdvance')} return { restAdvance: _restAdvance };`, state);
  const sessionEnd = 5000 + ALERT_DECAY_MINUTES + 10;   // restSession's _onlineSimMinutes, ten minutes past the decay
  restAdvance(10, sessionEnd);
  assert.equal(state.playerEntity.enemyAlertActive, false, 'PlayerEntity.Update:380-384 at the rest\'s own minute');
  assert.deepEqual(rolled, Array(10).fill(false), 'every sub-tick\'s IntermittentEnemySpawn rolls unarmed');
});

test('AUDIT 68 S19-archer-hit-frame-continue: a bow shot\'s hit frame gates the melee resolution and skips nothing after it - the mobile update and draw run that frame', () => {
  const at = D.indexOf("if (playerFeet && f.events.includes('hit')");
  const end = D.indexOf("}   // WORLD2: the end of the authority's own step", at);
  assert.ok(at > 0 && end > at, 'the hit-frame block was found');
  const block = D.slice(at, end);
  assert.doesNotMatch(block, /\bcontinue;/, 'a `continue` here is the foe LOOP\'s - it skipped f.mobile.update and _mobileBatches.push');
  assert.match(block, /^if \(playerFeet && f\.events\.includes\('hit'\) && !f\.attack\.firedRanged\) \{/, 'the ranged swing is gated out');
  assert.ok(block.includes('if (!f.mobile) resolveFoeMelee(f, _pf);'), 'the rig path keeps its clock');
});
