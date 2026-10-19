// PARTY-SKIN (PR B): THE DUNGEON'S MOUNT for test/net/partyskin_dungeon.test.js - test/net/partyloot_wire.test.js's mount (the real dungeon
// doors and the PARTY-LOOT block sliced out of src/scenes/dungeonContext.js and roomLootHost.js, the dungeon's own death and stream path, a
// real OnlineSession each, ONE real relay Room), carried over unchanged in kind and grown for skinning:
//   - the HIT LANE: a joiner's blow or claim leaves the dungeon through `opts.onFoeHit` into the real hit queue (net/hitPend.js) and the
//     session's `sendHit`; the Room routes it to the host; the host's session applies it with the dungeon's own `applyHit` (world.js
//     `online.onHit` -> `modes.applyDungeonHit`). The blow's ring, blood and pain (landPeerBlow) are not under test: it lands the blow through the
//     kill door as a peer's, as landPeerBlow's last line does;
//   - the SEAT: the dungeon's own `setAuthority`, called as world.js calls it when the host changes;
//   - the KILL CREDIT is the game's (`reportPlayerKill`), not a stand-in;
//   - the foes' species (`species`: a Rat skins, an Orc has no hide);
//   - Hunting's bodies: `bodiesHere('dungeon', { dungeon })` over the api the dungeon hands the host.
// Not a .test.js on purpose (the manifest counts suites): the shared precondition of the dungeon's pins.
import { after, afterEach } from 'node:test';
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
import { raiseEnemyDeath } from '../../src/scenes/corpseMarker.js';
import { rollCorpseKit, capFoeLoot } from '../../src/systems/foeLootCap.js';
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
import { asTheRoom } from '../../src/systems/online/onlineLane.js';
import { CLAIM_KEEP_MS, CLAIMS_KEPT_MAX } from '../../src/systems/loot/claimLedger.js';
import { SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX } from '../../src/systems/searchables.js';
import * as RL from '../../src/systems/roomLoot.js';
const { ROOM_PUT_RESAY_MS } = RL;
import { egFindStruck, egFindKill } from '../../src/systems/eliteGates/egFind.js';   // the dungeon's find asks (a room's body's kill goes here, unregistered: false)
import { fakeRoom } from '../fakeRoom.mjs';
import { makeHitPend } from '../../src/net/hitPend.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { bodiesHere } from '../../src/scenes/huntHost.js';
import { actor } from './bodyLootHarness.mjs';
import { order } from './skinHarness.mjs';
import '../../src/systems/card/cardSources.js';   // CARDS9's death handler registers at import, as the hosts load it
import '../../src/scenes/physicalItemsLayer.js';   // PI1's

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
const optMemberSrc = (name) => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  if (!n) return null;
  const b = SRC.slice(n.value.start, n.value.end);
  return n.method ? `function ${b}` : b;
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
function dungeon(id, { authority, level, luck, renown, seed, foraging, partners, characterId, foes: nFoes, send, seat, species = ORC }) {
  let foeHit = () => assert.fail('the host applies its own blows');   // PARTY-SKIN: a joiner's blow and claim, out of the dungeon's own door (opts.onFoeHit), set by the player
  const player = { level, gender: 'male', name: id, characterId, stats: { luck, strength: 60 }, activeEffects: [], items: [], goldPieces: 0, isPlayer: true };
  const said = [];
  const told = [];   // every act the dungeon handed its door out (opts.onActions), before world.js or the session saw it
  const windows = [];
  const own = lcg(seed);
  const as = (fn) => {
    const realRandom = Math.random, prevActor = actor.id;
    actor.id = id;   // PARTY-SKIN: whose machine runs (a kill report is told to the one who struck)
    Math.random = own;
    setSigilRenown(renown);
    setModSetting(FORAGING_VENDOR, 'Enabled', foraging);
    try { return fn(); } finally { Math.random = realRandom; actor.id = prevActor; }
  };
  const state = {
    foes: [], _layoutFoes: nFoes, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: authority, playerEntity: player, dfLocation: { mapTableData: { dungeonType: DUNGEON_TYPE } }, lootKey: DUNGEON_LOOT_KEYS[DUNGEON_TYPE],
    _superTier: false, _wildDungeon: false, _wildRing: null, _deepCleared: new Set(), _deepFoeCleared: new Set(),
    SUPER_LOOT_DROP_MULT: 1.5, ELITE_LOOT_DROP_MULT: 1.2, SUPER_LOOT_QUALITY_MULT: 1.5, ELITE_LOOT_QUALITY_MULT: 1.2,
    opts: { selfId: () => id, onActions: (data) => { told.push(JSON.parse(JSON.stringify(data))); return send(data); }, onLootClaimed: () => {}, partyLevels: () => partners, roomHost: () => seat(), onFoeHit: (hit) => foeHit(hit) },
    _sharedStamp: `st${seed}`, clearSurplus: () => {},
    addItem, stacksWith, isGoldPieces, addGoldPieces, isEquipped, unequipItem, neverPeerHanded, notCarried,   // AUDIT AUTO-HOLD: the give asks it (no realm session here: no filter)
    _wallNow: () => clock.t, performance: { now: () => clock.t }, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, ENEMY_BASICS,
    generateLootItems: generateItems, addPileLootExtras, rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons,
    spawnEnemyLoot, wildLootAfter, grantEliteLoot, rollCorpseKit, raiseEnemyDeath, capFoeLoot, rollRoomBonus, egFindStruck, egFindKill,
    CLAIM_KEEP_MS, CLAIMS_KEPT_MAX, SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX, sharedClassicMinutes,   // OUTDOOR-LOOT: the claim ledger's and the search find's constants the room block reads
    wildPileMore, isDeepPileKey, effectiveLevel, liveStat, asTheRoom, ...RL,
    eliteLootOpts: () => ({}), searchHeard: () => {}, settleLootFlat: () => {}, _sharedFoe: () => false, fightN: () => 1,
    spawnCorpseNow: async (f) => { f.corpsePos = [...f.ai.feet]; }, renderer: { destroyBillboardBatch: () => {} }, billboardBatches: [], renownFoeRevived: () => {},
    respawnFoe: () => false, camps: { applyOwner: () => {}, activate: () => false }, roomEncounterAsked: () => false, actions: { applyRemote: () => 0, collectSaveData: () => [] },
    droppedLoot: { physical: { owns: () => false }, pileFor: () => null, lootFinds: () => [], releaseEmptied: () => {} }, lootCrown: (pos) => pos, droppedTorches: { activate: () => false }, plaqueActionFor: () => null,
    activateSearchable: () => 0, setMidScreenText: (t) => said.push(t), activeOverlay: null, silverFindKey: () => null, silverFindAt: () => {},
    quickLootTake: () => false, showPickups: null, lootPile: () => null, pileBody: () => null, RANDOM_TREASURE_ARCHIVE: 216, surfacePlayer: () => {},
    // the kill door's neighbours (test/systems/loot7check.test.js's killDoor): nothing here reads a loot law
    feudWeakBlow: () => false, blowClassOf: () => null, lastPlayerFeet: [0, 0, 0], foeDeps: null, audio: {},
    renownFoeStruck: () => {}, renownFoeDied: () => {}, reportPlayerKill, takeWholeBlow: () => false, markFoeStruck: () => {}, markConcealedHit: () => {},
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
    HIT_DMG_MAX: 10000, HIT_POS_MAX: 1e6, FOES_STALE_MS,
    sharedRecord: (r) => r, ownRides: () => false,
    windows,
  };
  const h = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${declSrc('onlineRoom')}
    ${declSrc('isRoomFoe')}
    ${declSrc('REMOTE_KILL')}
    ${declSrc('KILLED_BY_MS')}
    ${declSrc('SHARED_FOES_MAX')} ${declSrc('q2')} ${declSrc('q3')}
    ${declSrc('FOES_FRAME_SLACK')} ${declSrc('FOE_MAX_PER_FRAME')} ${declSrc('_maxLeft')} ${declSrc('foeMaxOf')}
    ${['lootKeyOf', 'lootableBody', 'lootHolder', 'roomLootKey', 'lootRecords', 'publishLoot', 'sayRoomWord', 'applyLoot', 'applyActions'].map(fnSrc).join('\n')}
    ${BLOCK}
    function grants() { return null; }   // FOE-BOUNDS: applyFoeRecord asks the grants' host - none open here (src/scenes/grantHost.js's own tests judge it)
    ${['_runsFoe', 'damageFoe', 'freeCorpse', 'setFoeDead', 'spawnCorpse', 'applyFoeRecord', 'fitMaxima', 'roomRecord', 'foesFrame', 'applyFoesFrame', 'applySharedRecords', 'applyFoes', 'rollPileItems', 'applyHit', 'setAuthority', 'corpseAt'].map(fnSrc).join('\n')}
    function landPeerBlow(f, who, data, dmg) { damageFoe(f, dmg, null, null, { fromPlayer: true, peer: true, peerId: who, kind: 'melee' }); return true; }   // PARTY-SKIN: the blow's ring, blood and pain are not under test: the kill door is
    function allyTurn() {}
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
    const skinOfMember = ${optMemberSrc('skinOf') ?? 'null'};   // the api's door for Hunting's bodies (absent before PARTY-SKIN)
    const bodiesApi = { foes, corpseAt: (f) => corpseAt(f), corpseKeyOf: ${memberSrc('corpseKeyOf')}, ...(skinOfMember ? { skinOf: skinOfMember } : {}) };
    return { api, bodiesApi, applyHit, setAuthority, damageFoe, foesFrame, applyFoes, applyActions, actionRecords, tick, lootBuiltOf: typeof lootBuiltOf === 'function' ? lootBuiltOf : null };   // AUDIT OUTDOOR-LOOT L3: the build's own record of what each body rolled (partyloot.test.js's mount returns it too)
  `, state);
  // THE BUILD, as dungeonContext builds it: buildFoeAt's chain on THIS player's dice (test/systems/partyloot.test.js's)
  as(() => {
    for (let i = 0; i < nFoes; i++) {
      const entity = makeEnemyEntity(species, ENEMY_BASICS[species], null, effectiveLevel(player), Math.random);
      spawnEnemyLoot(entity, species, ENEMY_BASICS[species], player, { where: 'dungeon' });
      const f = { mobileType: species, gender: 'male', entity, dead: false, corpse: false, batch: null, src: { mobileType: species }, ai: { feet: [i, 0, 3], yaw: 0, moving: false, target: null, isHostile: true } };
      if (h.lootBuiltOf) f._lootBuilt = h.lootBuiltOf(entity);
      state.foes.push(f);
    }
  });
  return { id, h, state, player, as, said, told, windows, foes: state.foes, setFoeHit: (fn) => { foeHit = fn; } };
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
  const built = [];   // the foes frames this dungeon built, in the pins' order of events
  const dungeonCtx = { applyActions: d.h.applyActions, actionRecords: d.h.actionRecords, applyFoes: d.h.applyFoes, foesFrame: (full) => { const f = d.h.foesFrame(full); if (f) built.push({ order: ++order.n, at: clock.t, bs: JSON.parse(JSON.stringify(f.bs ?? null)) }); return f; } };
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
  // PARTY-SKIN: the hit lane, as world.js has it - a joiner's blow or claim through the hit queue to the host (`opts.onFoeHit`), and a hit
  // the host is sent applied by its dungeon (world.js online.onHit: `modes.applyDungeonHit`)
  const pend = makeHitPend({ send: (h) => online.sendHit(h), room: () => ROOM, now: () => clock.t, warn: () => {} });
  d.setFoeHit((hit) => pend.send(hit));
  online.onHit = (from, data) => d.as(() => { try { return d.h.applyHit(from, data); } catch (e) { handlerErrors.push(`${id} onHit: ${e?.message ?? e}`); throw e; } });
  const frame = (dt = FOES_MS / 1000) => d.as(() => { pend.flush(clock.t); doors.foesStream(clock.t); doors.actFlush(); d.h.tick(dt); });
  /** The wire loses this player's next `n` act frames (the relay never hears them); answers how many it has lost so far. */
  const loseActs = (n) => { sock.lose = n; return () => sock.lost; };
  /** The seat moved (world.js: the host changed - `dungeonCtx.setAuthority(online.isHost())`). */
  const reseat = () => d.as(() => d.h.setAuthority(online.isHost()));
  // what crossed this player's session, for the pins: the foes frames it heard and the hits it sent
  const foesIn = [], hitsOut = [];
  const heard = online.onFoes;
  const hear = { stripBs: false };   // an older HOST's frames carry no `bs`
  online.onFoes = (from, data) => { if (hear.stripBs) delete data.bs; foesIn.push({ from, data: JSON.parse(JSON.stringify(data)), at: clock.t }); return heard(from, data); };
  const sendHit = online.sendHit.bind(online);
  online.sendHit = (data) => { const ok = sendHit(data); if (ok) hitsOut.push({ from: id, data: JSON.parse(JSON.stringify(data)), at: clock.t }); return ok; };
  return { ...d, online, doors, frame, loseActs, pend, reseat, feet: [0, 0, 0], foesIn, hitsOut, built, hear, bodies: (stamps) => bodiesHere('dungeon', { dungeon: d.h.bodiesApi }, stamps) };
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

// ═══ PARTY-SKIN ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
export { clock, ROOM, T0, HOST, JOINER, POSE, RL, handlerErrors };
/** A room of players (the first is the host): each its own roll, joined in order through the real Room. `ids` names them. */
export async function skinParty({ foes = 4, species = 0, ids = [HOST, JOINER, 'join-0003'] } = {}) {
  RL._resetRoomLootForTests();
  clock.t = T0;
  const net = wire();
  const ps = ids.map((id, i) => player(id, net, { authority: i === 0, level: 30 - 9 * i, luck: 70 - 20 * i, renown: i === 0 ? 45 : 1, seed: 11 + 18 * i, foraging: i === 0, partners: [3], characterId: `char-${i}`, foes, species }));
  for (const p of ps) {
    p.online.join(ROOM, POSE);
    await net.settle();
  }
  for (const p of ps) assert.equal(p.online.status, 'open', `${p.id}'s hello was taken`);
  assert.equal(ps[0].online.isHost(), true, 'the first in the room holds the seat');
  return { net, ps, H: ps[0], J: ps[1], K: ps[2] ?? null, foes };
}
/** The cell run on `ms`: every dungeon's frame (the stream, the act flush, the claims' tick), `hunters` offered theirs, the wire given time. */
export async function drive(net, ms, ps, hunters = []) {
  clock.t += ms;
  for (const p of ps) p.frame(ms / 1000);
  for (const h of hunters) h.click();
  await net.settle();
}
/** A blow of `p`'s that kills foe `i`: the host's through its own door, a joiner's through the divert, the hit queue and the Room. */
export const fell = (p, i) => p.as(() => p.h.damageFoe(p.foes[i], 9999, [0, 0, 0], [0, 0, 1], { kind: 'melee' }));
/** A dungeon's streamed skin entry as `p` holds the foes frames: the host's last frame carrying `bs` for the body. */
