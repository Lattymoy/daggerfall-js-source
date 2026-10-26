// PARTY-LOOT OVER THE WIRE - the room's shared base and the host's arbitration (bible/06-Systems/Online-Arc.md
// PARTY-LOOT), driven through the network path the game runs instead of a queue. test/systems/partyloot.test.js holds the law
// between two mounted peers whose frames a queue hands across; here nothing between the two players stands in:
//   - each player is the dungeon's REAL loot doors and the PARTY-LOOT block (createRoomLoot, sliced from
//     src/scenes/roomLootHost.js with the host's construction of it, as test/systems/partyloot.test.js mounts them), over the
//     REAL producers, AND the dungeon's own death and stream path - damageFoe, spawnCorpse, setFoeDead, applyFoeRecord,
//     foesFrame and applyFoes - so the joiner's copy of a body falls when the host's foes frame says it fell, never by
//     a test's call;
//   - the inventory window is a stand-in holding the window's REAL close (openInventory's onClose), and a take from it
//     is the window's own transfer (systems/item/itemTransfer.js);
//   - the dungeon's frame is drawFoes' two PARTY-LOOT lines, the sweep and the claims' tick, sliced as they stand;
//   - scenes/world.js: actSend with its pending set and actFlush's heal (AUDIT WORLD3 A3), foesStream, and the
//     session's onAct and onFoes handlers; scenes/worldModes.js: placeActionRecords, applyPlaceActions,
//     applyDungeonFoes and dungeonFoesFrame;
//   - each over a REAL net/online.js OnlineSession - its hello with a token it mints, its act gate (ACT_HZ_MAX) and its
//     foes gate - into ONE REAL relay Room (server/src/index.js over test/fakeRoom.mjs's Durable Object state), which
//     meters each socket and fans each frame to the other. The wire is in order and loses nothing (but the one word the fourth test has it lose),
//     as one socket's frames are; the sessions, the Room and the doors share one clock (Date.now is that clock here).
// PORTED (OUTDOOR-LOOT, 2026-10-18) from test/partyloot_wire.test.js, written against a main before src/ and test/ went into
// folders, onto the tree that carries OUTDOOR-LOOT slice 3's law (roomLootHost.js; DESIGN-REVIEW.md D-2.1): a claimer's
// words are consecutive words of ROOM_CLAIMS_MAX, a claim is SAID AGAIN every ROOM_PUT_RESAY_MS until it is answered, a
// host's verdicts go out in consecutive words of ROOM_ANSWERS_KEPT, and `srch:` is a carried kind. What that changed here:
//   - the mount's scope THROWS for a name it lacks (it read it as undefined, and `x >= undefined` is false: a mount
//     without CLAIM_KEEP_MS would never give a claim up, and no test would have known);
//   - the third test ends on the new law (an answered claim is never said again), and a fourth plays the claim the wire
//     LOST: said again, the same claim, granted once. Take all's consecutive words and the dropped verdict frame are
//     test/systems/partyloot.test.js's (OUTDOOR-LOOT D-2.1) - there is no body here that holds 33 pieces.
// What is not here: a browser (tools/partyLootProbe.mjs plays the report in two), and buildDungeonContext itself, which
// nothing in the tree can stand up outside one. Mutants: tools/mutants/partyloot_wire.json.
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { OnlineSession, FOES_MS, FOES_FULL_MS } from '../../src/net/online.js';
import { isWorldRoom, isCellRoom, actFrameFits, ACT_HZ_MAX, respawnDue, sharedClassicMinutes, validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, FOES_STALE_MS } from '../../src/net/wire.js';
import { quietFoesGate } from '../../src/net/foesQuiet.js';
import { createSeatClock } from '../../src/net/seatLive.js';   // PIN MOVED: FIELD BUGS 2026-10-18d SEAT-LIVE - onFoes tells the seat clock it heard the seat (world.js `seatClock`), where it stamped `_foesInAt`
import { ARENA_PUPPET_OWNER } from '../../src/net/arena/arenaLaw.js';
import { foeSeed, applyWireLook } from '../../src/characters/foeBodies.js';
import { generateItems, addPileLootExtras, validLootList, LOOT_LIST_MAX, DUNGEON_LOOT_KEYS, LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { peerHanded, neverPeerHanded, notCarried } from '../../src/systems/peerWord.js';
import { addItem, stacksWith, isGoldPieces, addGoldPieces } from '../../src/systems/inventory.js';
import { isEquipped, unequipItem } from '../../src/systems/equip.js';
import { planTake, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { spawnEnemyLoot, wildLootAfter, rollRoomBonus } from '../../src/scenes/hostCombat.js';
import { raiseEnemyDeath, corpseTextureOf } from '../../src/scenes/corpseMarker.js';
import { rollCorpseKit, capFoeLoot } from '../../src/systems/foeLootCap.js';
import { championTraitFor } from '../../src/systems/champions.js';   // PIN MOVED (CHAMP-BASE): the room block's import - a body's mark at the room's level
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { effectiveLevel } from '../../src/systems/mentorMode.js';
import { liveStat } from '../../src/systems/statMods.js';
import { setSigilOnline, setSigilRenown } from '../../src/systems/sigil/sigil.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { setModSetting } from '../../src/systems/modSettings.js';
import { FORAGING_VENDOR } from '../../src/systems/foraging/foragingLaw.js';
import { installForaging } from '../../src/systems/foraging/foragingInstall.js';
import { installSmithing } from '../../src/systems/smithItems.js';
import { installHealingSupply } from '../../src/systems/healingSupply.js';
import { installRestItemLoot, isDeepPileKey } from '../../src/systems/rest/restItems.js';
import { installSurvivalLoot } from '../../src/systems/survival/loot.js';
import { grantEliteLoot } from '../../src/systems/eliteFoes.js';
import { wildPileMore } from '../../src/systems/wild/wildZone.js';
import { seaPileMore } from '../../src/systems/sea/seaSpoils.js';   // PIN MOVED (SEA-SET): the room's base rolls the deep's Tidemail last (roomLootHost.js)
import { markRoomCarried } from '../../src/systems/loot/roomCarriedList.js';   // PIN MOVED (GOLD-WIRE): the room block marks the list it composes (roomLootHost.js)
import { asTheRoom } from '../../src/systems/online/onlineLane.js';
import { withRollerLevel } from '../../src/systems/loot/lootLevelGate.js';   // AUDIT UPDATE L1: the room's base at the room's level (roomLootHost.js rollRoomBase)
import { CLAIM_KEEP_MS, CLAIMS_KEPT_MAX } from '../../src/systems/loot/claimLedger.js';
import { SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX } from '../../src/systems/searchables.js';
import * as RL from '../../src/systems/roomLoot.js';
const { ROOM_PUT_RESAY_MS } = RL;
import { egFindStruck, egFindKill } from '../../src/systems/eliteGates/egFind.js';   // the dungeon's find asks (a room's body's kill goes here, unregistered: false)
import { fakeRoom } from '../fakeRoom.mjs';
import '../../src/systems/card/cardSources.js';   // CARDS9's death handler registers at import, as the hosts load it
import '../../src/scenes/physicalItemsLayer.js';   // PI1's
import { isClassEnemyId, enemyEntityType } from '../../src/characters/enemy/enemyBasics.js';   // DEX1: the hosts' class test and entity type (the mount's free names)
import { appliedOwnerTm } from '../../src/net/ownerClock.js';   // PIN MOVED (OWNER-CLOCK): the stream door copies its frame's owner clock beside the feet - a free name of the mount
import { bossStrikeAt, bossTakeAt, bossClockS } from '../../src/systems/bossTraits.js';
import { strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame } from '../../src/scenes/foeTraitsHost.js';   // AUDIT WORLD-EVENTS: the dungeon host's trait doors, in the harness's scope   // BOSS-TRAITS: the damage door's two halves, in the harness's scope

installForaging(); installSmithing(); installHealingSupply(); installRestItemLoot(); installSurvivalLoot();   // the hosts' order (scenes/shared.js)
setPref(LOOT_RARITY_KEY, true);   // the loot ladder - forced on online (OL1)
setSigilOnline(true);   // an online page: the sigils' and the Renown's door

// ---- THE SOURCE, sliced as test/systems/partyloot.test.js slices it -------------------------------------------------------------
const SRC = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(SRC, { ecmaVersion: 'latest', sourceType: 'module' });
const MOD = readFileSync(new URL('../../src/scenes/roomLootHost.js', import.meta.url), 'utf8');
const MOD_AST = acorn.parse(MOD, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred, ast = AST) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  return hit;
}
const fnNode = (name) => find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
const fnSrc = (name) => { const n = fnNode(name); assert.ok(n, `dungeonContext.js has function ${name}`); return SRC.slice(n.start, n.end); };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `dungeonContext.js declares ${name}`); return SRC.slice(n.start, n.end); };
const memberSrc = (name) => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  assert.ok(n, `dungeonContext.js has the api's ${name}`);
  const body = SRC.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
/** The PARTY-LOOT block as the dungeon host runs it: the host's counters and its construction of the module, under the
 *  module's own createRoomLoot (test/systems/partyloot.test.js's PARTS, read the same way). */
const BLOCK = (() => {
  const ctor = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.init?.type === 'CallExpression' && d.init.callee?.name === 'createRoomLoot'));
  const fn = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === 'createRoomLoot', MOD_AST);
  const a = SRC.indexOf('  let _roomMintHold = 0;');
  assert.ok(ctor && fn && a >= 0 && a < ctor.start, 'the dungeon host constructs the PARTY-LOOT block (roomLootHost.js createRoomLoot) below its counters');
  return `${SRC.slice(a, ctor.start)}${MOD.slice(fn.start, fn.end)}\n  ${SRC.slice(ctor.start, ctor.end)}\n`;
})();
/** The window's close, as openInventory hands it to the window. */
const ON_CLOSE = (() => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === 'onClose', fnNode('openInventory'));
  assert.ok(n, 'openInventory hands its window an onClose');
  return SRC.slice(n.value.start, n.value.end);
})();
/** The dungeon's frame for the room's loot: drawFoes' clock and its two PARTY-LOOT lines - the sweep (WORLD8's hour and
 *  the unborn's mint, once a second) and the claims' tick - as they stand there. */
const DRAW_TICK = (() => {
  const m = /\n(\s*_ecvT \+= dt;\n\s*respawnSweep\(_ecvT\);[^\n]*\n\s*roomClaimTick\(_ecvT \* 1000\);[^\n]*)\n/.exec(fnSrc('drawFoes'));
  assert.ok(m, 'drawFoes runs the sweep and the claims\' tick each frame');
  return m[1];
})();
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  // a name the mount lacks THROWS (as the module's own scope would for an import it never had) - never reads as undefined:
  // OUTDOOR-LOOT's claim ledger reads CLAIM_KEEP_MS in the claims' tick, and `x >= undefined` is false, so a mount without
  // it would never give a claim up and no test here would know
  get: (t, k) => {
    if (k === Symbol.unscopables) return undefined;
    if (k in t) return t[k];
    if (!(k in globalThis)) throw new ReferenceError(`${String(k)} is not in the mount's scope`);
    return globalThis[k];
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

const ROOM = 'dungeon:m7';
const DUNGEON_TYPE = 12;   // a Natural Cave (test/systems/partyloot.test.js's)
const ORC = 7;             // a humanoid foe with a table ('A'), a kit and PLAIN-LOOT's keep
const POSE = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const HOST = 'host-0001', JOINER = 'join-0002';   // a peer id the relay takes (parseClient's bound)

// ONE CLOCK for the sessions, the Room and the doors - the Room's meters read Date.now(). Each room starts it at T0, so a
// body's base (seeded by its name and its death's stamp, roomLoot.js) is the same roll at every run
const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);
const clock = { t: T0 };
const realNow = Date.now;
Date.now = () => clock.t;
after(() => { Date.now = realNow; });
// the session's token race (TOKEN_WAIT_MS) leaves an eight-second timer behind every hello - no clock here is that
// timer's, so a long one is unref'd: the file ends when its tests do
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => { const h = realSetTimeout(fn, ms, ...args); if (ms >= 1000) h.unref?.(); return h; };
after(() => { globalThis.setTimeout = realSetTimeout; });
// THE SESSION SWALLOWS A HANDLER'S THROW (online.js _deliver - one bad frame never takes the socket down), so a door
// that throws here - a name the mount lacks, a stand-in grown stale - would look like a word that never landed. Every
// throw under onAct and onFoes is kept, and a test that leaves one fails by it.
const handlerErrors = [];
afterEach(() => { const e = handlerErrors.splice(0); assert.deepEqual(e, [], 'no handler the wire called threw'); });

/** ONE PLAYER'S DUNGEON: a character (its level, Luck, Renown, dice and mod switch) and the real dungeon's loot doors,
 *  PARTY-LOOT block, death and stream over `foes` layout foes - built as the build builds them, on this player's own
 *  roll. `send` is its act door out (world.js actSend); `seat` names the room's host (world.js's online.host). */
function dungeon(id, { authority, level, luck, renown, seed, foraging, partners, characterId, foes: nFoes, send, seat }) {
  const player = { level, gender: 'male', name: id, characterId, stats: { luck, strength: 60 }, activeEffects: [], items: [], goldPieces: 0, isPlayer: true };
  const said = [];
  const told = [];   // every act the dungeon handed its door out (opts.onActions), before world.js or the session saw it
  const windows = [];
  const own = lcg(seed);
  const as = (fn) => {
    const realRandom = Math.random;
    Math.random = own;
    setSigilRenown(renown);
    setModSetting(FORAGING_VENDOR, 'Enabled', foraging);
    try { return fn(); } finally { Math.random = realRandom; }
  };
  const state = {
    appliedOwnerTm,   // PIN MOVED (OWNER-CLOCK): the stream door's frame clock (net/ownerClock.js) - null outside a frame
    foes: [], _layoutFoes: nFoes, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: authority, playerEntity: player, dfLocation: { mapTableData: { dungeonType: DUNGEON_TYPE } }, lootKey: DUNGEON_LOOT_KEYS[DUNGEON_TYPE],
    _superTier: false, _wildDungeon: false, _wildRing: null, _deepCleared: new Set(), _deepFoeCleared: new Set(),
    SUPER_LOOT_DROP_MULT: 1.5, ELITE_LOOT_DROP_MULT: 1.2, SUPER_LOOT_QUALITY_MULT: 1.5, ELITE_LOOT_QUALITY_MULT: 1.2,
    opts: { selfId: () => id, onActions: (data) => { told.push(JSON.parse(JSON.stringify(data))); return send(data); }, onLootClaimed: () => {}, partyLevels: () => partners, roomHost: () => seat(), onFoeHit: () => assert.fail('the host applies its own blows') },
    _sharedStamp: `st${seed}`, clearSurplus: () => {},
    addItem, stacksWith, isGoldPieces, addGoldPieces, isEquipped, unequipItem, neverPeerHanded, notCarried,   // AUDIT AUTO-HOLD: the give asks it (no realm session here: no filter)
    _wallNow: () => clock.t, performance: { now: () => clock.t }, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, ENEMY_BASICS, corpseTextureOf,   // AUDIT DEX A1: the corpse mints read it
    isClassEnemyId, enemyEntityType,
    generateLootItems: generateItems, addPileLootExtras, rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons,
    spawnEnemyLoot, wildLootAfter, grantEliteLoot, rollCorpseKit, raiseEnemyDeath, capFoeLoot, rollRoomBonus, egFindStruck, egFindKill, championTraitFor,
    CLAIM_KEEP_MS, CLAIMS_KEPT_MAX, SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX, sharedClassicMinutes,   // OUTDOOR-LOOT: the claim ledger's and the search find's constants the room block reads
    wildPileMore, seaPileMore, isDeepPileKey, effectiveLevel, liveStat, asTheRoom, withRollerLevel, markRoomCarried, ...RL,
    eliteLootOpts: () => ({}), searchHeard: () => {}, settleLootFlat: () => {}, _sharedFoe: () => false, fightN: () => 1,
    spawnCorpseNow: async (f) => { f.corpsePos = [...f.ai.feet]; }, renderer: { destroyBillboardBatch: () => {} }, billboardBatches: [], renownFoeRevived: () => {},
    respawnFoe: () => false, camps: { applyOwner: () => {}, activate: () => false }, roomEncounterAsked: () => false, actions: { applyRemote: () => 0, collectSaveData: () => [] },
    droppedLoot: { physical: { owns: () => false }, pileFor: () => null, lootFinds: () => [], releaseEmptied: () => {} }, lootCrown: (pos) => pos, droppedTorches: { activate: () => false }, plaqueActionFor: () => null,
    activateSearchable: () => 0, setMidScreenText: (t) => said.push(t), activeOverlay: null, silverFindKey: () => null, silverFindAt: () => {},
    quickLootTake: () => false, showPickups: null, lootPile: () => null, pileBody: () => null, RANDOM_TREASURE_ARCHIVE: 216, surfacePlayer: () => {},
    // the kill door's neighbours (test/systems/loot7check.test.js's killDoor): nothing here reads a loot law
    feudWeakBlow: () => false, blowClassOf: () => null, lastPlayerFeet: [0, 0, 0], foeDeps: null, audio: {},
    renownFoeStruck: () => {}, renownFoeDied: () => {}, reportPlayerKill: () => {}, takeWholeBlow: () => false, bossStrikeAt, bossTakeAt, bossClockS, strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame, markFoeStruck: () => {}, markConcealedHit: () => {},
    handleAttackFromPlayer: () => {}, damageShieldPool: (e, n) => n, noteFighter: () => {}, PARTY_ME: 'me', partyFoeLoses: (f, n) => n,
    peerSoulTrapOf: () => null, attemptSoulTrap: () => ({ allowDeath: true }), isAzurasStarEquipped: () => false, fillEmptyTrap: () => false,
    hudText: { add: () => {} }, SOUL_TRAP_TEXT: {}, setEnemyAlert: () => {}, sayEnemyDied: () => null, playRareDrop: () => {}, addCorpseFood: () => {},
    // the joiner's stream doors around the records (test/net/seatheal.test.js's, test/net/restsync.test.js's): no surplus, one species
    validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, ARENA_PUPPET_OWNER, foeSeed, applyWireLook,
    _foesSeq: 0, _foesSeqIn: -1, _foesFrom: null, _keyMismatchSaid: false, _retypeFails: new Map(), RETYPE_TRIES: 3, GENDER_BIT: ['male', 'female'], _retyping: new Set(),
    _surplus: new Map(), _surplusPending: new Map(), hideBeyondHostLayout: () => {}, surplusRecord: () => {}, dropSurplus: () => {},
    _sharedSeq: 0, _sharedPending: new Map(), canStandFoe: () => true,
    standSharedPuppet: async () => assert.fail('the encounter stands here already'), dropSharedFoe: () => assert.fail('the room lists no encounter'),
    retypeFoe: async () => assert.fail('one species at the marker'), console,
    setAuthority: () => assert.fail('the seat does not move here'),
    sharedRecord: (r) => r, ownRides: () => false,
    windows,
  };
  const h = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${declSrc('onlineRoom')}
    ${declSrc('isRoomFoe')}
    ${declSrc('REMOTE_KILL')}
    ${declSrc('SHARED_FOES_MAX')} ${declSrc('q2')} ${declSrc('q3')}
    ${declSrc('FOES_FRAME_SLACK')} ${declSrc('FOE_MAX_PER_FRAME')} ${declSrc('_maxLeft')} ${declSrc('foeMaxOf')}
    ${['lootKeyOf', 'lootableBody', 'lootHolder', 'roomLootKey', 'lootRecords', 'publishLoot', 'sayRoomWord', 'applyLoot', 'applyActions'].map(fnSrc).join('\n')}
    ${BLOCK}
    function grants() { return null; }   // FOE-BOUNDS: applyFoeRecord asks the grants' host - none open here (src/scenes/grantHost.js's own tests judge it)
    ${['_runsFoe', 'damageFoe', 'freeCorpse', 'setFoeDead', 'spawnCorpse', 'applyFoeRecord', 'fitMaxima', 'roomRecord', 'foesFrame', 'applyFoesFrame', 'applySharedRecords', 'applyFoes', 'rollPileItems'].map(fnSrc).join('\n')}
    let _respawnSweptAt = -Infinity;
    const RESPAWN_BURST = 4;
    ${fnSrc('respawnSweep')}
    function openInventory(lootItems, onEmptied = null, { lootHooks = null, lootKey = null } = {}) {
      const onClose = ${ON_CLOSE};
      const w = { done: false, items: lootItems, lootKey, close: () => { if (w.done) return; w.done = true; onClose(); } };
      windows.push(w);
      return w;
    }
    const api = { lootContents: ${memberSrc('lootContents')}, takeLoot: ${memberSrc('takeLoot')} };
    const actionRecords = ${memberSrc('actionRecords')};
    let _ecvT = 0;
    function tick(dt) {
      ${DRAW_TICK}
    }
    return { api, damageFoe, foesFrame, applyFoes, applyActions, actionRecords, tick, lootBuiltOf: typeof lootBuiltOf === 'function' ? lootBuiltOf : null };   // AUDIT OUTDOOR-LOOT L3: the build's own record of what each body rolled (partyloot.test.js's mount returns it too)
  `, state);
  // THE BUILD, as dungeonContext builds it: buildFoeAt's chain on THIS player's dice (test/systems/partyloot.test.js's)
  as(() => {
    for (let i = 0; i < nFoes; i++) {
      const entity = makeEnemyEntity(ORC, ENEMY_BASICS[ORC], null, effectiveLevel(player), Math.random);
      spawnEnemyLoot(entity, ORC, ENEMY_BASICS[ORC], player, { where: 'dungeon' });
      const f = { mobileType: ORC, gender: 'male', entity, dead: false, corpse: false, batch: null, src: { mobileType: ORC }, ai: { feet: [i, 0, 3], yaw: 0, moving: false, target: null, isHostile: true } };
      if (h.lootBuiltOf) f._lootBuilt = h.lootBuiltOf(entity);
      state.foes.push(f);
    }
  });
  return { id, h, state, player, as, said, told, windows, foes: state.foes };
}

/** The relay and the wire to it: ONE real Room, and each session's socket joined to a socket of the Room's - a frame
 *  either way delivered in order through one queue, the Room's async handler awaited before the next. */
function wire() {
  const r = fakeRoom(ROOM, { now: () => Date.now() });
  const q = [];
  const post = (fn) => { q.push(fn); };
  /** Every frame delivered and every promise the doors started given time to land (a token's signature): a quiet wire. */
  const settle = async () => {
    for (let quiet = 0; quiet < 10;) {
      if (q.length) { quiet = 0; await q.shift()(); continue; }
      quiet++;
      await new Promise((res) => setTimeout(res, 2));
    }
  };
  class WireWS {
    constructor(url) {
      assert.ok(url.endsWith(`/room/${ROOM}`), `the session opens this room's socket (${url})`);
      this.url = url;
      this.lose = 0; this.lost = 0;
      this.readyState = 0;
      const s = r.connect();
      this.server = s;
      const said = s.send.bind(s), shut = s.close.bind(s);
      s.send = (frame) => { said(frame); post(() => this.onmessage?.({ data: frame })); };
      s.close = (code, reason) => { shut(code, reason); post(() => { this.readyState = 3; this.onclose?.({ code, reason }); }); };
      post(() => { this.readyState = 1; this.onopen?.(); });
    }
    // OUTDOOR-LOOT (D-2.1): a socket that loses its next `lose` ACT frames - the relay never hears them, as a dropped word
    send(frame) {
      if (this.lose > 0 && String(frame).startsWith('{"t":"act"')) { this.lose--; this.lost++; return; }
      post(() => r.room.webSocketMessage(this.server, frame));
    }
    close() { this.readyState = 3; post(() => r.drop(this.server)); }
  }
  return { r, WireWS, settle };
}

const W = (() => {
  const path = 'src/scenes/world.js';
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const all = (pred) => { const hits = []; (function walk(n) { if (!n || typeof n.type !== 'string') return; if (pred(n)) hits.push(n); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast); return hits; };
  const one = (pred, what) => { const hits = all(pred); assert.equal(hits.length, 1, `${path}: ${what} stands once`); return text.slice(hits[0].start, hits[0].end); };
  return {
    decl: (name) => one((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name), `the declaration of ${name}`),
    assigned: (lhs) => { const hits = all((x) => x.type === 'AssignmentExpression' && text.slice(x.left.start, x.left.end) === lhs); assert.equal(hits.length, 1, `${path}: the assignment to ${lhs} stands once`); return text.slice(hits[0].right.start, hits[0].right.end); },
  };
})();
const WM = (() => {
  const path = 'src/scenes/worldModes.js';
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  return {
    member: (name) => {
      const hits = [];
      (function walk(n) { if (!n || typeof n.type !== 'string') return; if (n.type === 'Property' && !n.computed && n.key?.name === name && n.method) hits.push(n); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast);
      assert.equal(hits.length, 1, `${path}: the method ${name} stands once`);
      return `function ${text.slice(hits[0].value.start, hits[0].value.end)}`;
    },
  };
})();

/** One player: the dungeon, the mode's dungeon arms around it, a real session, and the world host's own act and foes
 *  doors on that session. `frame(dt)` is one host frame's share of it - world.js's foesStream and actFlush, in the
 *  frame's order, then the dungeon's drawFoes lines. Everything the wire hands this player runs on its own dice. */
function player(id, net, o) {
  let doors = null, online = null;
  const d = dungeon(id, { ...o, send: (data) => doors.actSend(data), seat: () => online.host ?? null });
  const dungeonCtx = { applyActions: d.h.applyActions, actionRecords: d.h.actionRecords, applyFoes: d.h.applyFoes, foesFrame: d.h.foesFrame };
  const modes = mount(`
    const mode = 'dungeon';
    return { mode, applyPlaceActions: ${WM.member('applyPlaceActions')}, placeActionRecords: ${WM.member('placeActionRecords')},
      applyDungeonFoes: ${WM.member('applyDungeonFoes')}, dungeonFoesFrame: ${WM.member('dungeonFoesFrame')} };
  `, { dungeonCtx, interiorCtx: null, _intShared: null });
  let sock = null;
  class MyWS extends net.WireWS { constructor(url) { super(url); sock = this; } }
  online = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: `secret-of-${id}`, look: net.r.look,
    mintToken: () => net.r.token(id, { n: id }), WebSocketImpl: MyWS, now: () => clock.t });
  doors = mount(`
    ${['_actPend', '_actLive', '_actRoom', '_actTooBig', 'actTooBig', 'actSend', 'actFlush', '_foesSentAt', '_foesQuiet', 'foesStream'].map(W.decl).join('\n')}
    online.onAct = ${W.assigned('online.onAct')};
    online.onFoes = ${W.assigned('online.onFoes')};
    return { actSend, actFlush, foesStream, pending: () => [..._actPend] };
  `, { online, _onlineKey: ROOM, modes, isWorldRoom, isCellRoom, actFrameFits, quietFoesGate, FOES_MS, FOES_FULL_MS, console, seatClock: createSeatClock(FOES_STALE_MS),
    performance: { now: () => clock.t }, exteriorFoes: null, csaPeers: null, csaAboard: null, campToScene: null });
  // what the wire hands this player lands on its own dice, Renown and switches, as on its own machine
  for (const k of ['onAct', 'onFoes']) {
    const door = online[k];
    online[k] = (...a) => d.as(() => { try { return door(...a); } catch (e) { handlerErrors.push(`${id} ${k}: ${e?.message ?? e}`); throw e; } });
  }
  const frame = (dt = FOES_MS / 1000) => d.as(() => { doors.foesStream(clock.t); doors.actFlush(); d.h.tick(dt); });
  /** The wire loses this player's next `n` act frames (the relay never hears them); answers how many it has lost so far. */
  const loseActs = (n) => { sock.lose = n; return () => sock.lost; };
  return { ...d, online, doors, frame, loseActs };
}

/** A room of two in one party: the host (level 30, Luck 70, Ascendant Renown, Foraging on) and a joiner (level 3,
 *  Luck 30, Faint Renown, Foraging OFF) - test/systems/partyloot.test.js's two, each its own roll of every foe. */
async function party(foes = 1) {
  RL._resetRoomLootForTests();
  clock.t = T0;
  const net = wire();
  const H = player(HOST, net, { authority: true, level: 30, luck: 70, renown: 45, seed: 11, foraging: true, partners: [3], characterId: 'char-h', foes });
  const J = player(JOINER, net, { authority: false, level: 3, luck: 30, renown: 1, seed: 29, foraging: false, partners: [30], characterId: 'char-j', foes });
  H.online.join(ROOM, POSE);
  await net.settle();
  J.online.join(ROOM, POSE);
  await net.settle();
  assert.equal(H.online.status, 'open', 'the host\'s hello was taken (its token verified by the Room)');
  assert.equal(J.online.status, 'open');
  assert.equal(H.online.isHost(), true, 'the first in the room holds the seat');
  assert.equal(J.online.host, HOST, 'and the joiner was told so in its welcome');
  return { net, H, J };
}

const sig = (it) => JSON.stringify(it);
const baseRows = (list) => (list ?? []).filter((it) => !RL.isPersonalLoot(it)).map(sig);
const shown = (p, key) => p.as(() => p.h.api.lootContents(key));
/** A body's base once the room's word for it has LANDED here - its plaque names a list (an unborn body names null, which
 *  is never read as an empty base: a body whose base rolled nothing is named [] only when its word came). */
const named = (p, key) => { const l = shown(p, key); assert.ok(Array.isArray(l), `${key} is named on ${p.id} - the room's word for it landed`); return baseRows(l); };
const kill = (p, i) => p.as(() => p.h.damageFoe(p.foes[i], 9999));
/** The host kills the room's foes in turn until a body's base holds something (a body's roll may be empty), and names
 *  it: each death's birth goes on the wire as it falls. */
function lootedKill(p) {
  for (let i = 0; i < p.foes.length; i++) {
    kill(p, i);
    if (named(p, `corpse:${i}`).length) return i;
  }
  assert.fail(`none of the room's ${p.foes.length} bodies rolled a base at T0 - stand more foes, or another T0`);
}
/** The window's take, as its click makes it: the plan, then the transfer. */
const take = (p, w, item) => p.as(() => { const plan = planTake(item, { bag: p.player.items }); assert.ok(plan.ok, `${p.id} may take ${item.name}`); return applyTransfer(item, plan, w.items, p.player.items, {}); });

test('PARTY-LOOT OVER THE WIRE: the report - the host\'s kill reaches the party member through the real session and relay, its birth BEFORE the body (held, and landed when the host\'s frame lays the body), and the body opens on the host\'s base; the party member\'s open and close tell the wire nothing and leave the host\'s list as it was', async () => {
  const { net, H, J } = await party(4);
  const i = lootedKill(H);
  const key = `corpse:${i}`;
  assert.equal(H.foes[i].dead && H.foes[i].corpse, true, 'the host\'s foe fell');
  const base = named(H, key);
  assert.equal(H.online.stats.acts, i + 1, 'the host said each body\'s birth at its death, through world.js\'s actSend and the session\'s gate');
  assert.equal(H.told.length, i + 1, 'one birth a body, told by the dungeon');
  const saidBefore = J.online.stats.acts, toldBefore = J.told.length;
  await net.settle();
  assert.equal(J.foes[i].dead, false, 'the birth crossed the Room first: no foes frame has said the foe fell, so the word waits for the body');
  // the host's next frame lays the body on the joiner, and the word that came first lands on it
  clock.t += FOES_MS;
  H.frame();
  await net.settle();
  assert.equal(J.foes[i].dead && J.foes[i].corpse, true, 'the host\'s foes frame laid the body, through the Room and onFoes');
  assert.deepEqual(named(J, key), base, 'the joiner sees the host\'s base, piece for piece - not "Empty"');
  assert.ok(J.as(() => J.h.api.takeLoot(key)) > 0, 'the press opens it');
  assert.equal(J.windows.length, 1);
  assert.deepEqual(baseRows(J.windows[0].items), base, 'the window opens on the room\'s base');
  J.windows[0].close();
  await net.settle();
  assert.deepEqual(J.told.slice(toldBefore), [], 'an open and a close with nothing taken tell the wire nothing - not even a word world.js could drop');
  assert.equal(J.online.stats.acts, saidBefore, 'and nothing went out on the joiner\'s session');
  H.frame();
  await net.settle();
  assert.deepEqual(named(H, key), base, 'the host\'s list is as it was - the close wiped nothing');
  assert.deepEqual(named(J, key), base, 'and the joiner\'s too');
});

test('PARTY-LOOT OVER THE WIRE: a blast that kills more than the act bucket says in a second - the session refuses the last bodies\' births, world.js keeps their keys, the bodies the host\'s frame lays first stand UNBORN on the party member (no window, no word, none of its own roll), and actFlush\'s heal re-reads the host\'s word through placeActionRecords and they open on the host\'s base', async () => {
  const n = ACT_HZ_MAX + 5;
  const { net, H, J } = await party(n);
  for (let i = 0; i < n; i++) kill(H, i);   // one blast, one frame
  const refused = Array.from({ length: n - ACT_HZ_MAX }, (_, k) => ACT_HZ_MAX + k);
  const keys = refused.map((i) => `corpse:${i}`);
  assert.equal(H.online.stats.acts, ACT_HZ_MAX, `ACT_HZ_MAX births went (${ACT_HZ_MAX} a second)`);
  assert.deepEqual(H.doors.pending(), keys, 'the refused ones are held by their keys');
  const bases = H.foes.map((_, i) => named(H, `corpse:${i}`));
  assert.ok(refused.some((i) => bases[i].length), 'a refused body holds something of the room\'s base');
  H.frame();   // the blast's own frame: its foes stream lays every body, and its actFlush finds no token yet
  await net.settle();
  assert.deepEqual(H.doors.pending(), keys, 'still held: the bucket has not refilled');
  assert.deepEqual(J.foes.map((f) => f.dead && f.corpse), J.foes.map(() => true), 'every body laid on the joiner');
  for (let i = 0; i < ACT_HZ_MAX; i++) assert.deepEqual(named(J, `corpse:${i}`), bases[i], `corpse:${i}: its birth landed on its body`);
  // the refused: laid, their words still on the host's side of the wire
  const said = J.online.stats.acts, toldBefore = J.told.length;
  for (const i of refused) {
    const key = `corpse:${i}`;
    assert.equal(shown(J, key), null, `${key} names nothing yet - its list is the room's, still on its way`);
    assert.deepEqual(J.foes[i].entity.items, [], `${key} holds none of the joiner's own roll`);
    assert.equal(J.as(() => J.h.api.takeLoot(key)), 0, `${key}: the press opens nothing - no "Empty" window`);
  }
  assert.equal(J.windows.length, 0);
  J.frame();
  await net.settle();
  assert.deepEqual(J.told.slice(toldBefore), [], 'and the joiner\'s dungeon tells the wire nothing for them');
  assert.equal(J.online.stats.acts, said);
  clock.t += FOES_MS;   // one token's refill at ACT_HZ_MAX
  H.frame();   // the next stream frame, and the heal behind it
  await net.settle();
  assert.deepEqual(H.doors.pending(), [], 'the heal went');
  for (const i of refused) assert.deepEqual(named(J, `corpse:${i}`), bases[i], `corpse:${i}: the heal landed - the host's base`);
  const open = refused.find((i) => bases[i].length);
  assert.ok(J.as(() => J.h.api.takeLoot(`corpse:${open}`)) > 0, 'a refused body\'s press opens it now');
  assert.deepEqual(baseRows(J.windows[0].items), bases[open], 'on the host\'s base');
});

/** Both players' clocks run `ms` on: the one clock (Date.now, the sessions', the Room's) AND each dungeon's own frame clock
 *  (drawFoes' `_ecvT`, which the claims' tick reads - a claim's resay interval is measured on it, not on Date.now). */
async function run(net, ms, ...ps) {
  clock.t += ms;
  for (const p of ps) p.frame(ms / 1000);
  await net.settle();
}

/** How much of a piece a player holds: its coin in the purse, else its count across the pack (test/systems/partyloot.test.js's). */
const pieceKey = (it) => `${it.group}.${it.templateIndex}.${it.material ?? ''}.${it.name ?? ''}`;
const holding = (p, it) => (isGoldPieces(it) ? (p.player.goldPieces ?? 0) : p.player.items.filter((x) => pieceKey(x) === pieceKey(it)).reduce((s, x) => s + RL.pieceCount(x), 0));

test('PARTY-LOOT OVER THE WIRE: the party member\'s take is a claim the host grants over the wire - the window\'s close tells a claim and never the room\'s state, the piece leaves the party member\'s pack until the grant, the host\'s list loses that one piece and keeps the rest, and the verdict comes back through the Room with the piece the party member\'s alone', async () => {
  const { net, H, J } = await party(4);
  const i = lootedKill(H);
  const key = `corpse:${i}`;
  clock.t += FOES_MS;
  H.frame();
  await net.settle();
  const base = named(H, key);
  assert.deepEqual(named(J, key), base, 'both see one base');
  assert.ok(J.as(() => J.h.api.takeLoot(key)) > 0);
  const w = J.windows[0];
  const piece = w.items.find((it) => !RL.isPersonalLoot(it) && !isGoldPieces(it)) ?? w.items.find((it) => !RL.isPersonalLoot(it));
  assert.ok(piece, 'a base piece to take');
  const had = { J: holding(J, piece), H: holding(H, piece) };
  take(J, w, piece);
  assert.ok(holding(J, piece) > had.J, 'the window\'s transfer put it in the pack');
  const toldBefore = J.told.length, saidBefore = J.online.stats.acts;
  w.close();   // the close tells what was taken: a claim of the host
  assert.equal(holding(J, piece), had.J, 'the close lifted it back out of the pack - it is the joiner\'s only on the host\'s grant');
  const told = J.told.slice(toldBefore);
  assert.equal(told.length, 1, 'the close told one word');
  assert.equal(told[0].l?.length, 1);
  const word = told[0].l[0];
  assert.equal(word.k, key, 'about this body');
  assert.equal(word.q?.length, 1, 'one claim');
  assert.ok(!('s' in word) && !('x' in word) && !('y' in word), `a claim, never the room's state (${Object.keys(word).join(',')})`);
  await net.settle();
  assert.equal(J.online.stats.acts, saidBefore + 1, 'the claim went out on the joiner\'s own session');
  for (let k = 0; k < 3; k++) { clock.t += FOES_MS; H.frame(); J.frame(); await net.settle(); }   // the host's verdict, said and landed
  const expect = base.slice(); expect.splice(expect.indexOf(sig(piece)), 1);
  assert.deepEqual(named(H, key), expect, 'the host\'s list lost the one piece and kept every other');
  assert.deepEqual(named(J, key), expect, 'and the joiner sees the same list');
  assert.ok(holding(J, piece) > had.J, `the joiner holds the ${piece.name} it was granted`);
  assert.equal(holding(H, piece), had.H, 'and the host does not');
  // OUTDOOR-LOOT D-2.1 (the law this assertion now meets): a claim is SAID AGAIN every ROOM_PUT_RESAY_MS until it is
  // answered (roomClaimTick) - and this one was answered, so the close's one word stays the only word however long the
  // clocks run on: no second claim to dupe the piece, nothing taken twice
  for (let k = 0; k < 8; k++) { await run(net, ROOM_PUT_RESAY_MS, H, J); }
  assert.equal(J.told.length, toldBefore + 1, 'an answered claim is never said again - the close\'s word is the only one');
  assert.deepEqual(named(H, key), expect, 'the host\'s list is as the grant left it, however long the clocks run');
  assert.deepEqual(named(J, key), expect);
  assert.equal(holding(J, piece), had.J + RL.pieceCount(piece), 'the piece was granted once');
});

test('PARTY-LOOT OVER THE WIRE (OUTDOOR-LOOT D-2.1): a claim the wire LOST is said again every ROOM_PUT_RESAY_MS until the host answers - the piece stays out of the pack while it waits, the second word is the same claim, the host grants it once, and nothing is said after the verdict (the claimer said it once; a dropped word lost the piece for good)', async () => {
  const { net, H, J } = await party(4);
  const i = lootedKill(H);
  const key = `corpse:${i}`;
  clock.t += FOES_MS;
  H.frame();
  await net.settle();
  const base = named(H, key);
  assert.ok(J.as(() => J.h.api.takeLoot(key)) > 0);
  const w = J.windows[0];
  const piece = w.items.find((it) => !RL.isPersonalLoot(it) && !isGoldPieces(it)) ?? w.items.find((it) => !RL.isPersonalLoot(it));
  assert.ok(piece, 'a base piece to take');
  const had = holding(J, piece);
  take(J, w, piece);
  const lost = J.loseActs(1);   // the claim's word never reaches the relay
  const toldBefore = J.told.length;
  w.close();
  assert.equal(J.told.length, toldBefore + 1, 'the close said one word');
  const first = JSON.stringify(J.told[toldBefore].l[0].q);
  await net.settle();
  assert.equal(lost(), 1, 'and the wire lost it');
  assert.deepEqual(named(H, key), base, 'the host never heard: its list is whole');
  assert.equal(holding(J, piece), had, 'the piece is out of the pack while the claim waits');
  // not yet due: the resay waits its ROOM_PUT_RESAY_MS
  await run(net, ROOM_PUT_RESAY_MS - FOES_MS, H, J);
  assert.equal(J.told.length, toldBefore + 1, 'nothing said again before the interval is up');
  assert.deepEqual(named(H, key), base);
  // due: the same claim, said again - it reaches the host this time
  await run(net, 2 * FOES_MS, H, J);
  assert.equal(J.told.length, toldBefore + 2, 'the claim is said again');
  assert.equal(JSON.stringify(J.told[toldBefore + 1].l[0].q), first, 'the very same claim - its id is the first word\'s, so the host judges it once');
  for (let k = 0; k < 3; k++) await run(net, FOES_MS, H, J);
  const expect = base.slice(); expect.splice(expect.indexOf(sig(piece)), 1);
  assert.deepEqual(named(H, key), expect, 'the host\'s list lost the one piece and kept every other');
  assert.deepEqual(named(J, key), expect);
  assert.equal(holding(J, piece), had + RL.pieceCount(piece), 'the verdict came back and the piece is the joiner\'s');
  // answered: silence, and no piece twice
  for (let k = 0; k < 8; k++) { await run(net, ROOM_PUT_RESAY_MS, H, J); }
  assert.equal(J.told.length, toldBefore + 2, 'an answered claim is never said again');
  assert.equal(holding(J, piece), had + RL.pieceCount(piece), 'and the piece is not granted twice');
  assert.deepEqual(named(H, key), expect);
});
