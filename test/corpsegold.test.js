// CORPSE-GOLD (2026-09-27, a player on the Discord: "out of sync dungeons can generate infinite gold upon entry if there
// are dead corpses of monsters"). Mounted, not matched: the room's memory is restored through the REAL
// restoreSharedWorld, applyWorld, patchFoe, applyLoot, retypeFoe and buildFoeAt's `stand`, sliced out of
// src/scenes/dungeonContext.js (the context cannot be stood up here). buildFoeAt's art await and its fresh loot roll are
// the one stand-in. Recorded in bible/01-Overview/Field-Bugs-2026-09-27f.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validSharedFoe, respawnDue } from '../src/net/wire.js';
import { validActionRecord } from '../src/world/actionSystem.js';
import { validLootList } from '../src/systems/loot.js';
import { unbound } from '../src/systems/itemBound.js';   // SS3 (the Sigil Stones merge): the lifted loot seams drop a bound piece from a peer's list
import { keepRebuiltSpawn } from '../src/characters/enemyAnchor.js';
import { renownFoeCarry, renownFoeRevived } from '../src/net/renownTracker.js';
import { registerFoeDoor } from '../src/systems/artifactEffects.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { goldStack, isGoldPieces } from '../src/systems/inventory.js';

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });

function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => {
  const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
  assert.ok(n, `src has function ${name}`);
  return D.slice(n.start, n.end);
};
const declSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name));
  assert.ok(n, `src declares ${name}`);
  return D.slice(n.start, n.end);
};
const initSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclarator' && x.id?.name === name);
  assert.ok(n, `src declares ${name}`);
  return D.slice(n.init.start, n.init.end);
};
const memberSrc = (name) => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name
    && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  assert.ok(n, `src has member ${name}`);
  const body = D.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const tick = () => new Promise((r) => setTimeout(r, 0));

// Two species one random marker can hold: dungeonEnemies.js bands the pick on the player's level, so the room's roster
// (whoever built the room first) and a player at another level stand different kinds at the same index.
const RAT = 0, IMP = 1;
const goldIn = (items) => items.filter(isGoldPieces).reduce((s, it) => s + (it.stackCount ?? 0), 0);

/** A layout foe as this entry's build stands it: alive at its marker with its OWN loot roll (spawnEnemyLoot's gold). */
const built = (mobileType, roll) => ({
  mobileType, gender: 'male', dead: false, src: { mobileType },
  entity: { health: 10, maxHealth: 10, items: [goldStack(roll)], activeEffects: [], team: 'PlayerEnemy' },
  ai: { feet: [0, 0, 0], yaw: 0, isHostile: true },
});
/** The room's memory of a layout foe: dead, of `mobileType` (a record as sharedWorld writes it - no items). */
const deadRecord = (mobileType) => ({ health: 0, maxHealth: 10, dead: true, feet: [0, 0, 0], yaw: 0, mobileType, gender: 'male', team: 'PlayerEnemy' });

function restoreHarness(foes) {
  let roll = 500;
  const state = {
    foes, _layoutFoes: foes.length, _locationKey: 'dungeon:7', _sharedStamp: 'mine', _sharedApplied: false,
    _lootSeen: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(), _retyping: new Set(), _sharedById: new Map(),
    lootPiles: [], billboardBatches: [], _ctxDead: false, playerEntity: { isPlayer: true, items: [] },
    validSharedFoe, respawnDue, validActionRecord, validLootList, unbound, keepRebuiltSpawn, renownFoeCarry, renownFoeRevived, registerFoeDoor, ENEMY_BASICS,
    _wallNow: () => null,   // no shared clock: nothing is due back (WORLD8's hour is not this seam)
    liveStat: () => 50,
    addCorpseFood: () => {}, stampWonWeapons: () => {},   // the body's food and sigils: rolled on the copy, not this seam
    spawnCorpseNow: async () => {},   // the flat's mint; the corpse FLAG is spawnCorpse's own, raised before it
    applyCampMemory: () => {}, clearOwnPuppets: () => {}, respawnFoe: () => false, dropCandidate: () => {}, damageFoe: () => {}, settleLootFlat: () => {},
    actions: { restoreSaveData: () => {} },
    renderer: { destroyBillboardBatch: () => {} },
    built, nextRoll: () => { roll += 1; return roll; },
  };
  const api = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${declSrc('canStandFoe')}
    ${fnSrc('lootKeyOf')}
    ${fnSrc('bodyRecords')}
    ${fnSrc('lootableBody')}
    ${fnSrc('lootHolder')}
    ${fnSrc('applyLoot')}
    ${fnSrc('freeCorpse')}
    ${fnSrc('spawnCorpse')}
    ${fnSrc('setFoeDead')}
    ${fnSrc('patchFoe')}
    ${fnSrc('applyWorld')}
    ${fnSrc('retypeFoe')}
    // buildFoeAt, as far as a rebuild reads it: the art's await, then a FRESH record with its own roll, stood in the
    // old one's place by the real stand()
    const buildFoeAt = async (e, fallbackFlat, { at = -1 } = {}) => {
      await null;
      const rec = built(e.mobileType, nextRoll());
      (${initSrc('stand')})(rec);
      return rec;
    };
    const restoreSharedWorld = ${memberSrc('restoreSharedWorld')};
    return { restoreSharedWorld, lootHolder };
  `, state);
  return { ...api, state };
}
const memory = (foes, loot = []) => ({ locationKey: 'dungeon:7', stamp: 'the room', world: { foes, loot, actions: [] } });

test('CORPSE-GOLD: a body the room emptied stays empty when it stands as another species - the rebuild used to lay its own fresh roll down (gold on every entry) because the room\'s word had been read before the body existed (mutants: no word after the rebuild; the word before the death)', async () => {
  // This entry's build rolled a Rat at marker 0 with 250 gold; the room remembers an Imp there, dead and emptied.
  const h = restoreHarness([built(RAT, 250)]);
  assert.equal(h.restoreSharedWorld(memory([deadRecord(IMP)], [{ k: 'corpse:0', r: [] }])), true);
  assert.equal(h.lootHolder('corpse:0'), null, 'while the rebuild awaits its art the foe at 0 is the fresh build\'s, alive - no container yet');
  await tick();
  const body = h.state.foes[0];
  assert.equal(body.mobileType, IMP, 'the room\'s species');
  assert.equal(body.dead && body.corpse, true, 'dead, a body');
  assert.deepEqual(h.lootHolder('corpse:0'), [], 'what the room said is left in it: nothing');
  assert.equal(goldIn(body.entity.items), 0, 'no gold minted by coming back in');
  assert.equal(h.state._lootSeen.has('corpse:0'), true, 'the room has spoken about it - a claim on it is refused (WORLD4 C2)');
});

test('CORPSE-GOLD: a body the room never opened is still this copy\'s own roll after the rebuild, as WORLD4 says of every unopened container', async () => {
  const h = restoreHarness([built(RAT, 250)]);
  h.restoreSharedWorld(memory([deadRecord(IMP)], []));
  await tick();
  const body = h.state.foes[0];
  assert.equal(body.dead, true);
  assert.equal(goldIn(body.entity.items), 501, 'the rebuilt record\'s own roll');
  assert.equal(h.state._lootSeen.has('corpse:0'), false, 'the room knows nothing of it');
});

test('CORPSE-GOLD: the rebuild lands the BODY\'s record alone - a container taken from since the restore is not filled back up (mutants: the whole list again; any corpse\'s record)', async () => {
  // Marker 0 stands another species (a rebuild), marker 1 the same (patched at once).
  const h = restoreHarness([built(RAT, 250), built(IMP, 300)]);
  h.restoreSharedWorld(memory([deadRecord(IMP), deadRecord(IMP)], [{ k: 'corpse:0', r: [] }, { k: 'corpse:1', r: [goldStack(90)] }]));
  assert.equal(goldIn(h.lootHolder('corpse:1')), 90, 'the same species\' body takes the room\'s list with the restore');
  h.lootHolder('corpse:1').length = 0;   // I take the 90 before the rebuild at 0 has landed
  await tick();
  assert.deepEqual(h.lootHolder('corpse:0'), [], 'the rebuilt body has its record');
  assert.deepEqual(h.lootHolder('corpse:1'), [], 'and the body I emptied stays empty');
});

test('CORPSE-GOLD: a foe record the restore refuses is a hole at its own index - the rest do not move up onto the next foe (mutants: filter(Boolean) back; the hole not skipped)', () => {
  // The memory's record 0 is out of the law (feet past the world's bound); record 1 is a dead Rat, emptied.
  const h = restoreHarness([built(RAT, 250), built(RAT, 300)]);
  const bad = { ...deadRecord(RAT), feet: [1e9, 0, 0] };
  assert.equal(validSharedFoe(bad), null, 'the door refuses it');
  assert.equal(h.restoreSharedWorld(memory([bad, deadRecord(RAT)], [{ k: 'corpse:1', r: [] }])), true);
  assert.equal(h.state.foes[0].dead, false, 'the refused record is nobody\'s: foe 0 stands as it is');
  assert.equal(h.state.foes[1].dead, true, 'record 1 lands on foe 1');
  assert.deepEqual(h.lootHolder('corpse:1'), [], 'with its own record');
  assert.equal(h.lootHolder('corpse:0'), null, 'and no body at 0 holds its own fresh roll');
});
