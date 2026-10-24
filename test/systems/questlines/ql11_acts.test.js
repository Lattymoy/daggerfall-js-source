// QL11 (bible/06-Systems/Questlines-Arc.md section 4.5): THE ACTS - what the player did in one of the game's features,
// said in one line where it is FINISHED (systems/questlines/qlActs.js noteAct) and heard by every running stamped quest.
// The pins: the sweep, both ways (every kind has its producer, every producer names a kind, and every call names its
// kind as a literal - so this sweep can read it); the leaf's own law; and the producers whose moment a node can drive,
// each heard once, and nothing heard when the moment did not come.
// AUDIT QUESTLINES ACTS-3 (2026-10-19): EVERY PRODUCER DRIVEN - the lane found 19 of the 31 sites driven by no case here
// and 15 probe mutants (its M1-M15) living through this file; each site now has its case below, through its own module
// as the gate's case drives gateClaims, and each names the mutants it kills (`ACTS Mn` the lane's). ACTS-4/5/6/8 pinned too.
import '../../modsOff.js';
import { modsOff } from '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

import { parseModule, findHostFunction } from '../../../tools/hostScope.mjs';
import { ACT_KINDS, ACT_IDS, noteAct, setActSink } from '../../../src/systems/questlines/qlActs.js';
import { hearEliteFoesIn, QL_ELITE_FOE } from '../../../src/systems/questlines/qlEliteFoe.js';
import { reportPlayerKill, registerPlayerKillListener } from '../../../src/systems/playerKills.js';
import { createSdClaims } from '../../../src/net/superDungeon/sdClaims.js';
import { mintSdReceipt } from '../../../src/net/superDungeon/sdReceipt.js';
import { createSerpentClaims } from '../../../src/net/serpent/serpentClaims.js';
import { mintSerpentReceipt } from '../../../src/net/serpent/serpentReceipt.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { mintEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { validEgOut, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { createProfBook, PROF_KEPT_KEY } from '../../../src/net/profBook.js';
import { recipeById } from '../../../src/net/recipeLaw.js';
import { createArenaBouts } from '../../../src/scenes/arena/arenaBouts.js';
import { ARENA_FLOOR_CENTRE } from '../../../src/net/arena/arenaLaw.js';
import { newArenaLadder, nextLadderBout } from '../../../src/systems/arena/arenaLadder.js';
import { openGambitTableGame } from '../../../src/scenes/gambitTableGame.js';
import { newGambitTable, gambitSit, gambitReady, gambitTick, gambitForfeit, GAMBIT_FIRST_MS } from '../../../src/net/gambit/gambitTable.js';
import { autoFill, KG_POINT_BUDGET } from '../../../src/net/kingsGambit.js';
import { GAMBIT_RESULT_MS } from '../../../src/systems/gambit/gambitTableSession.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../../src/world/card/cardTableProp.js';
import { xorshift } from '../../../tools/kgMeasure.mjs';
import { fakeDoc } from '../../decorFakes.mjs';
import { createDeepWatersFish } from '../../../src/scenes/deepWater/deepWatersFish.js';
import { PASSIVE_FISH_SPECIES } from '../../../src/world/passiveFish.js';
import { createFishItem } from '../../../src/systems/deepWater/deepWatersFishItems.js';
import { RAIDING_PARTIES_VENDOR, setRaidingPartiesHost, restoreRaidSaveData, raidFrame, raidState, _resetRaidingParties } from '../../../src/systems/raidingParties.js';
import { renownFoeStruck, _resetRenownKillsForTests } from '../../../src/net/renownTracker.js';
import { setSharedClock, setWorldMinutes } from '../../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../../src/systems/gameDate.js';
import { setModSetting } from '../../../src/systems/modSettings.js';
import { IliacTableSession, ILIAC_REVEAL_MS } from '../../../src/systems/iliac/iliacTableSession.js';
import { patronDeck, patronPlays, seededUnit } from '../../../src/systems/iliac/iliacPatrons.js';
import { STARTER_DECK } from '../../../src/net/iliac/iliacCards.js';
import { ILIAC_TURNS } from '../../../src/net/iliac/iliacHand.js';
import { CardTableSession } from '../../../src/systems/card/cardTableSession.js';
import { fishKind } from '../../../src/scenes/fishHost.js';
import { haulKey } from '../../../src/net/nodeLaw.js';
import { useForagingTool, createForagingItem, setForagingHost, _setForagingRandomForTests } from '../../../src/systems/foraging/foragingInstall.js';
import { FT, FORAGING_VENDOR } from '../../../src/systems/foraging/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import * as RVN from '../../../src/systems/revenant/revenant.js';
import { beginYield } from '../../../src/systems/revenant/revenantFate.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { sea } from '../../navalSea.mjs';
import { hullBoxOf } from '../../../src/scenes/naval/navalHost.js';
import { navalHitData, NAVAL_HIT_MAX } from '../../../src/systems/naval/navalWire.js';
import { SHIP_STATES, STRUCK_AT } from '../../../src/systems/naval/navalDamage.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import { mintGem } from '../../../src/systems/gems.js';
import { reforgePiece, setGemPiece, unsetGemPiece } from '../../../src/systems/reforge.js';
import { welkyndShards } from '../../../src/systems/gate/gateSpoils.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { createFirmamentBook } from '../../../src/net/firmament/firmamentBook.js';
import { createHarbourOffice, PORT_VOYAGE_M } from '../../../src/scenes/harbourOffice.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { boardFor, takeContract } from '../../../src/systems/naval/harbourBoard.js';
import { createGateClaims } from '../../../src/net/gate/gateClaims.js';
import { mintReceipt } from '../../../src/net/gate/gateReceipt.js';
import { RemoteCardTable } from '../../../src/systems/card/cardRemoteTable.js';
import { RemoteIliacTable } from '../../../src/systems/iliac/iliacRemoteTable.js';
import { herbKind } from '../../../src/scenes/herbHost.js';
import { mineKind } from '../../../src/scenes/mineHost.js';
import { treeKind } from '../../../src/scenes/treeHost.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LEAF = 'src/systems/questlines/qlActs.js';

/** What the sink heard, `[kind, n]` each - the bridge's own shape (scenes/quest/questBridge.js setActSink). */
const heard = [];
const listen = () => { heard.length = 0; setActSink((kind, n) => { heard.push([kind, n]); return 1; }); };
const done = () => setActSink(null);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── THE SWEEP ──────────────────────────────────────────────────

function srcFiles(dir) {
  const out = [];
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${f}`;
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...srcFiles(p));
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
function walk(n, fn) {
  if (!n || typeof n.type !== 'string') return;
  fn(n);
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (Array.isArray(v)) for (const c of v) walk(c, fn);
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
}
/** Every `noteAct(...)` call in src/ (the leaf aside), read off the parse - never a comment's mention: kind -> files,
 *  and the calls whose kind is no literal; and every file that imports noteAct, with the name it binds. */
function sweep() {
  const kinds = new Map(), loose = [], imports = [];
  for (const f of srcFiles('src')) {
    if (f === LEAF) continue;
    const text = readFileSync(join(ROOT, f), 'utf8');
    if (!text.includes('noteAct')) continue;
    walk(parseModule(text), (n) => {
      if (n.type === 'ImportDeclaration' && /(^|\/)qlActs\.js$/.test(n.source.value)) {   // a feature's `../questlines/qlActs.js`, a questlines module's own `./qlActs.js` (qlEliteFoe.js)
        for (const s of n.specifiers) if (s.imported?.name === 'noteAct') imports.push([f, s.local.name]);
      }
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || n.callee.name !== 'noteAct') return;
      const a = n.arguments[0];
      if (a?.type === 'Literal' && typeof a.value === 'string') {
        if (!kinds.has(a.value)) kinds.set(a.value, new Set());
        kinds.get(a.value).add(f);
      } else loose.push(`${f}:${n.loc.start.line}`);
    });
  }
  return { kinds, loose, imports };
}

test('QL11 THE SWEEP, both ways: every kind has a producer in src/; every producer names a kind; every call names it as a literal; noteAct is imported from the leaf under its own name; AUDIT QUESTLINES ACTS-8: no host the ceiling holds says one in its own scope but createNavalHost, once, and the dungeon host hands its place to the elite foe\'s module (mutants: a kind with no producer; a producer\'s kind misspelt; a kind passed in a variable; an alias; the elite foe\'s condition back in buildDungeonContext; the Redoubt\'s acts back in createEgClient)', () => {
  const { kinds, loose, imports } = sweep();
  assert.deepEqual(loose, [], 'a kind is a literal at its call, so this sweep reads it');
  const unknown = [...kinds.keys()].filter((k) => !Object.hasOwn(ACT_KINDS, k)).map((k) => `${[...kinds.get(k)].join(', ')}: noteAct('${k}')`);
  assert.deepEqual(unknown, [], 'every producer names a kind the leaf holds');
  assert.deepEqual(ACT_IDS.filter((k) => !kinds.has(k)), [], 'every kind the leaf holds is said somewhere');
  assert.deepEqual(imports.filter(([, name]) => name !== 'noteAct'), [], 'no alias - a call under another name would pass this sweep unread');
  const callers = new Set([...kinds.values()].flatMap((s) => [...s]));
  assert.deepEqual([...callers].filter((f) => !imports.some(([g]) => g === f)), [], 'each caller imports the leaf\'s noteAct');
  // WHERE EACH IS SAID (the slice's record): the feature's own module where one knows the moment; a host only where the
  // host alone does (navalHost's struck colours, the dungeon's tier) - one line each
  const where = Object.fromEntries([...kinds].map(([k, s]) => [k, [...s].sort()]).sort(([a], [b]) => (a < b ? -1 : 1)));
  assert.deepEqual(where, {
    'arena-won': ['src/scenes/arena/arenaBouts.js'],
    'breach-closed': ['src/net/gate/gateClaims.js'],
    'cards-won': ['src/systems/card/cardRemoteTable.js', 'src/systems/card/cardTableSession.js', 'src/systems/iliac/iliacRemoteTable.js', 'src/systems/iliac/iliacTableSession.js'],
    'cargo-delivered': ['src/scenes/harbourOffice.js'],
    'elite-foe-slain': ['src/systems/questlines/qlEliteFoe.js'],
    'fish-caught': ['src/scenes/deepWater/deepWatersFish.js', 'src/scenes/fishHost.js', 'src/systems/foraging/foragingInstall.js'],
    'gambit-won': ['src/scenes/gambitTableGame.js'],
    'gem-socketed': ['src/systems/reforge.js'],
    'herb-gathered': ['src/scenes/herbHost.js', 'src/systems/foraging/foragingInstall.js'],
    'heart-star-held': ['src/net/starfall/starClaims.js'],   // T-A: the Heart-Star held, beside its `star-held` in one turn (test/net/starfall/star7_claims.test.js)
    'hour-broken': ['src/net/superDungeon/sdClaims.js'],
    'ore-mined': ['src/scenes/mineHost.js'],
    'piece-crafted': ['src/net/profBook.js'],
    'piece-reforged': ['src/systems/reforge.js'],
    'port-reached': ['src/scenes/harbourOffice.js'],
    'raid-repelled': ['src/systems/raidingParties.js'],
    'redoubt-taken': ['src/scenes/eliteGates/egClient.js'],
    'revenant-knelt': ['src/systems/revenant/revenantFate.js'],
    'rite-broken': ['src/net/gate/gateClaims.js'],
    'serpent-slain': ['src/net/serpent/serpentClaims.js'],
    'ship-struck': ['src/scenes/naval/navalHost.js'],
    'star-held': ['src/net/starfall/starClaims.js'],   // STAR8: a fallen star's receipt the service counted (STAR7's carrier - test/net/starfall/star7_claims.test.js)
    'star-taken': ['src/net/firmament/firmamentBook.js'],
    'valkynaz-felled': ['src/scenes/eliteGates/egClient.js'],
    'wood-chopped': ['src/scenes/treeHost.js', 'src/systems/foraging/foragingInstall.js'],
    'wyrd-met': ['src/scenes/witchesHost.js'],   // AUDIT STAR8 T1: a Wyrd Sister's window opened, the festival's own module (test/scenes/witch1_host.test.js drives it)
  });
  // the hosts that carry one: a line each, never more (test/scenes/hostceiling.test.js holds their length)
  const lines = (f) => readFileSync(join(ROOT, f), 'utf8').split('\n').filter((l) => /\bnoteAct\(/.test(l) && !/^\s*(\/\/|\*)/.test(l)).length;
  assert.deepEqual(['src/scenes/naval/navalHost.js'].map(lines), [1]);
  for (const host of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/exterior.js', 'src/systems/comeSailAway/comeSailAway.js', 'src/scenes/dungeonContext.js']) assert.ok(!callers.has(host), `${host} says no act`);
  // AUDIT QUESTLINES ACTS-8 (HOST-SPLIT): inside the functions the ceiling holds, the acts said - createNavalHost's in the
  // crew's own arm, and no other: the elite foe's condition is systems/questlines/qlEliteFoe.js's (buildDungeonContext hands
  // it the place it built, one line), the Redoubt's acts egClient.js's module scope (redoubtActs, one call)
  const HOSTS = [['src/scenes/naval/navalHost.js', 'createNavalHost'], ['src/scenes/eliteGates/egClient.js', 'createEgClient'], ['src/scenes/exteriorFoes.js', 'createExteriorFoes'], ['src/combat/fpArm.js', 'createFpArm']];
  const said = Object.fromEntries(HOSTS.map(([f, fn]) => {
    if (!callers.has(f)) return [fn, 0];
    let n = 0;
    walk(findHostFunction(parseModule(readFileSync(join(ROOT, f), 'utf8')), fn).fn, (c) => { if (c.type === 'CallExpression' && c.callee.type === 'Identifier' && c.callee.name === 'noteAct') n++; });
    return [fn, n];
  }));
  assert.deepEqual(said, { createNavalHost: 1, createEgClient: 0, createExteriorFoes: 0, createFpArm: 0 });
  const dc = readFileSync(join(ROOT, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.equal(dc.match(/^\s*hearEliteFoesIn\(dfLocation\);/gm)?.length, 1, 'the dungeon host hands its place to the act\'s module, once');
  assert.ok(!/registerPlayerKillListener\(/.test(dc), 'and listens for no kill itself');
});

test('QL11 the kinds: ACT_IDS is the leaf\'s keys, frozen; each kind lower-case words (a script\'s `ql act <kind>` reads them); a wagon\'s load is no kind - nothing in the game finishes one (mutants: the list unfrozen; a kind re-added with no producer)', () => {
  assert.deepEqual(ACT_IDS, Object.keys(ACT_KINDS));
  assert.ok(Object.isFrozen(ACT_KINDS) && Object.isFrozen(ACT_IDS));
  for (const k of ACT_IDS) assert.match(k, /^[a-z]+(-[a-z]+)*$/, k);
  for (const k of ACT_IDS) assert.ok(typeof ACT_KINDS[k] === 'string' && ACT_KINDS[k].length > 0, `${k} has its family`);
  assert.equal(ACT_IDS.length, 26);   // PIN MOVED (STAR8): and star-held, a fallen star held; PIN MOVED (AUDIT STAR8 T1): and wyrd-met, a Wyrd Sister's window; PIN MOVED (T-A): and heart-star-held, the Heart-Star held
  assert.equal(ACT_KINDS['heart-star-held'], ACT_KINDS['star-held'], 'T-A: the Heart-Star\'s act the endgame\'s, as its star\'s - one family, so the festival\'s finds hear the two as one deed');
  assert.ok(!Object.hasOwn(ACT_KINDS, 'wagon-hauled'), 'no feature sells a wagon\'s load (qlActs.js says why)');
  assert.ok(Object.hasOwn(ACT_KINDS, 'valkynaz-felled'), 'the Weir Road\'s third step waits on it');
});

// ── THE LEAF'S LAW ─────────────────────────────────────────────

test('QL11 noteAct: an unknown kind is refused with a warning and never reaches the sink; no sink counts nothing; `n` floored, and none or less is no act; the sink\'s answer is the count (a whole number); a throwing sink costs only the act; a non-function unregisters (mutants: an unknown kind counted; n unfloored; a throw carried out)', () => {
  const warned = [];
  const was = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    setActSink(null);
    assert.equal(noteAct('fish-caught'), 0, 'no sink - a page with no quests hears nothing');
    listen();
    assert.equal(noteAct('fish-cought'), 0);
    assert.equal(noteAct(undefined), 0);
    assert.equal(noteAct('toString'), 0, 'an own kind only - never the prototype\'s');
    assert.deepEqual(heard, [], 'a refused kind never reaches the sink');
    assert.equal(warned.length, 3);
    assert.match(warned[0], /no act "fish-cought"/);
    warned.length = 0;
    assert.equal(noteAct('fish-caught'), 1);
    assert.equal(noteAct('ore-mined', 2.9), 1);
    assert.equal(noteAct('star-taken', '3'), 1);
    for (const n of [0, -2, 0.5, NaN, 'x', null]) assert.equal(noteAct('fish-caught', n), 0, `n ${n}`);
    assert.deepEqual(heard, [['fish-caught', 1], ['ore-mined', 2], ['star-taken', 3]], 'n floored; none or less is no act');
    setActSink(() => 2.7);
    assert.equal(noteAct('cards-won'), 2, 'the count a whole number');
    setActSink(() => undefined);
    assert.equal(noteAct('cards-won'), 0);
    setActSink(() => { throw new Error('a layer broke'); });
    assert.doesNotThrow(() => noteAct('arena-won'));
    assert.equal(noteAct('arena-won'), 0);
    assert.match(warned.at(-1), /the act "arena-won" was not heard \(a layer broke\)/);
    listen();
    setActSink('not a function');
    assert.equal(noteAct('fish-caught'), 0, 'unregistered');
    assert.deepEqual(heard, []);
  } finally {
    console.warn = was;
    done();
  }
});

// ── THE PRODUCERS, DRIVEN ──────────────────────────────────────

const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const lootOn = () => { _resetForTests(); setPref('lootRarity', true); LR._setSocketForTests(null); LR._setWeaponSocketsForTests(null); };

test('QL11 piece-reforged (systems/reforge.js reforgePiece): heard once when the line is rolled again and paid; a refused reforge says nothing (mutants: the act before the refusals)', () => {
  lootOn();
  listen();
  try {
    const piece = known(LR.applyRarity(createWeapon(113, 1), 'rare', lcg(7)));
    const me = { items: [piece, welkyndShards(3)], goldPieces: 1000 };
    assert.equal(reforgePiece(piece, 2, me, lcg(2)).ok, false, 'too few shards');
    assert.deepEqual(heard, [], 'refused: no act');
    me.items.push(welkyndShards(5));
    assert.equal(reforgePiece(piece, 2, me, lcg(2)).ok, true);
    assert.deepEqual(heard, [['piece-reforged', 1]]);
  } finally { done(); _resetForTests(); }
});

test('QL11 gem-socketed (systems/reforge.js setGemPiece): heard once when the gem is set; no gem to set says nothing; an unsetting is no setting (mutants: the act before the refusals; unset saying it)', () => {
  lootOn();
  listen();
  try {
    const holder = known(LR.applyRarity(createWeapon(122, 1), 'rare', lcg(3)));
    holder.sockets = Array(LR.socketMax(holder)).fill(LR.SOCKET_EMPTY);
    const me = { isPlayer: true, items: [holder], goldPieces: 0 };
    assert.equal(setGemPiece(holder, 'ruby', me, 0).ok, false, 'no Ruby in the pack');
    assert.deepEqual(heard, []);
    me.items.push(mintGem('ruby'));
    assert.equal(setGemPiece(holder, 'ruby', me, 0).ok, true);
    assert.deepEqual(heard, [['gem-socketed', 1]]);
    assert.equal(unsetGemPiece(holder, me, 0).ok, true);
    assert.deepEqual(heard, [['gem-socketed', 1]], 'the gem shattered out is no gem set');
  } finally { done(); _resetForTests(); }
});

/** A door over a pretend Firmament service (test/net/firmament/firm1_book.test.js's shape). */
function firmDoor({ refuse = null } = {}) {
  let tree = '';
  const answer = (t) => ({ ok: true, data: { tree: t, renown: 20, stars: 19, craft: 4, ranks: {}, refund: { freeBelow: 10, perStar: 10 } } });
  return {
    account: () => 'acct-1',
    state: async () => answer(tree),
    set: async (_c, t) => { if (refuse) return { ok: false, error: refuse }; tree = t; return answer(t); },
  };
}

test('QL11 star-taken (net/firmament/firmamentBook.js): each star the service now holds that it did not, counted once on its answer; a star given back, the same sky again or a refused change, none (mutants: every key counted; the act before the answer)', async () => {
  listen();
  try {
    let n = 0;
    const b = createFirmamentBook({ door: firmDoor(), character: () => 'char-1', rid: () => `fql11test${String(++n).padStart(4, '0')}` });
    await b.read();
    assert.equal((await b.commit({ start: 'wr.start', keys: ['wr.s1'] })).ok, true);
    assert.equal((await b.commit({ start: 'wr.start', keys: ['wr.s1', 'wr.s2', 'wr.g'] })).ok, true);
    assert.equal((await b.commit({ start: 'wr.start', keys: ['wr.s1', 'wr.s2', 'wr.g'] })).ok, true);
    assert.equal((await b.commit({ start: 'wr.start', keys: ['wr.s1'] })).ok, true);
    assert.deepEqual(heard, [['star-taken', 1], ['star-taken', 2]], 'the first star, then two more; the same sky and a star given back are none');
    heard.length = 0;
    const r = createFirmamentBook({ door: firmDoor({ refuse: 'firm-law' }), character: () => 'char-1', rid: () => `fql11test${String(++n).padStart(4, '0')}` });
    await r.read();
    assert.equal((await r.commit({ start: 'wr.start', keys: ['wr.s1'] })).ok, false);
    assert.deepEqual(heard, [], 'refused: no star taken');
  } finally { done(); }
});

const WAYREST = { key: '100,100', name: 'Wayrest', px: 100, py: 100, region: 23, crown: 'Wayrest' };
const SENTINEL = { key: '120,100', name: 'Sentinel', px: 120, py: 100, region: 20, crown: 'Sentinel' };
const PORTS = [WAYREST, SENTINEL, { key: '103,100', name: 'Near', px: 103, py: 100, region: 23, crown: 'Wayrest' }];
const seaAt = (x, y) => x >= 100 || y >= 104;
const officeOver = (ledger) => createHarbourOffice({
  ledger, now: () => 0, day: () => 3, level: () => 5, gold: () => 10000, pay: () => {}, credit: () => {}, say: () => {}, mid: () => {},
  notorietyOf: () => 0, port: () => WAYREST, ports: () => PORTS, seaAt, waters: () => 'Wayrest',
});
const berth = (office, port) => office.event({ type: 'berth', port: port.key, boat: 42 });

test('QL11 port-reached (scenes/harbourOffice.js): a berth at another port than the last, a quarter league of way made at the helm since - never the first berth, one lying at the quay (a berth a second), a short hop, a return to the same port, nor the first after a load (mutants: the threshold; the port test; the load\'s log)', () => {
  assert.equal(PORT_VOYAGE_M, 4828 / 4, 'a quarter league');
  listen();
  try {
    const L = createCaptainLedger();
    const o = officeOver(L);
    berth(o, WAYREST);
    assert.deepEqual(heard, [], 'the first berth marks where she lies');
    L.sailed(PORT_VOYAGE_M - 1);
    berth(o, SENTINEL);
    assert.deepEqual(heard, [], 'short of a quarter league');
    L.sailed(PORT_VOYAGE_M);
    berth(o, WAYREST);
    assert.deepEqual(heard, [['port-reached', 1]]);
    berth(o, WAYREST); L.sailed(2); berth(o, WAYREST);
    assert.equal(heard.length, 1, 'lying at the quay, a berth a second: no voyage');
    L.sailed(PORT_VOYAGE_M * 4);
    berth(o, WAYREST);
    assert.equal(heard.length, 1, 'out and home to the same port: no port reached');
    // PIN MOVED (FIELD BUGS 2026-10-21b VOYAGE-HOLD): a load keeps the voyage its save was on - the departure is its log's
    // own (it had read the first berth after a load as only where she lies, and a relog or a crash between two ports lost
    // the voyage) - and a departure past its log's way is no departure
    L.sailed(PORT_VOYAGE_M / 2);
    const mid = JSON.parse(JSON.stringify(L.getSaveData()));
    L.restoreSaveData(mid);
    L.sailed(PORT_VOYAGE_M / 2);
    berth(o, SENTINEL);
    assert.deepEqual(heard, [['port-reached', 1], ['port-reached', 1]], 'loaded half way, the voyage kept');
    L.restoreSaveData({ ...mid, log: { ...mid.log, departed: { port: SENTINEL.key, sailed: mid.log.sailed + 1 } } });
    assert.equal(L.log.departed, null, 'a departure further on than its log: none');
    berth(o, WAYREST);
    assert.equal(heard.length, 2, 'the first berth with none marks where she lies');
  } finally { done(); }
});

test('QL11 cargo-delivered (scenes/harbourOffice.js): a delivery\'s contract done at its port, paid by its harbourmaster - once; another kind done, or a cargo berthed at another port, none (mutants: every contract done counted; the act on the berth alone)', () => {
  listen();
  try {
    const L = createCaptainLedger();
    const o = officeOver(L);
    const offers = boardFor({ port: WAYREST, crown: 'Wayrest', day: 3, level: 5, perks: { offers: 2 }, ports: PORTS, seaAt, regionIndex: 23 });
    const del = offers.find((x) => x.kind === 'delivery');
    const hunt = offers.find((x) => x.kind === 'hunt');
    assert.ok(del && hunt, 'the board posts a cargo and a hunt');
    assert.equal(L.holdContract(takeContract(del, { now: 0, boat: 42 })), true);
    assert.equal(L.holdContract(takeContract({ ...hunt, need: 1 }, { now: 0 })), true);
    const away = PORTS.find((p) => p.key !== del.to.key && p.key !== WAYREST.key);
    o.event({ type: 'berth', port: away.key, boat: 42 });
    assert.deepEqual(heard, [], 'berthed elsewhere: the cargo still in her hold');
    assert.equal(o.event({ type: 'end', act: 'sink', faction: 'pirate', crown: hunt.crown }).done.length, 1, 'the hunt done');
    assert.deepEqual(heard, [], 'a hunt is no cargo');
    assert.equal(o.event({ type: 'berth', port: del.to.key, boat: 42 }).done.length, 1);
    assert.deepEqual(heard.filter(([k]) => k === 'cargo-delivered'), [['cargo-delivered', 1]]);
    o.event({ type: 'berth', port: del.to.key, boat: 42 });
    assert.equal(heard.filter(([k]) => k === 'cargo-delivered').length, 1, 'delivered once');
  } finally { done(); }
});

test('QL11 breach-closed and rite-broken (net/gate/gateClaims.js): said off the receipt the service counted (`recorded`) - a fight\'s closed the breach, its `r` broke the rite too, a rite\'s own broke the rite alone; one counted before, none (mutants: the rite as a breach; `r` unread; a re-claim counted)', async () => {
  const { subtle } = webcrypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const T0 = 1_800_000_000;
  const receipt = (d, x, r) => mintReceipt({ d, b: 'ruhn', s: 'acct-me', c: 4242, x, ...(r ? { r } : {}) }, kp.privateKey, { subtle, nowS: T0 });
  // the service as server-account/src/accounts.js claimGate answers: a receipt counted once (`recorded`), and `claimed`
  // every time after - its embers (`stones`) said either way, so the queue lets it go
  const counted = new Set();
  const claim = async (r) => {
    if (counted.has(r)) return { ok: true, data: { recorded: false, why: 'claimed', stones: 1, closed: counted.size } };
    counted.add(r);
    return { ok: true, data: { recorded: true, stones: 1, closed: counted.size } };
  };
  const q = createGateClaims({ claim, nowS: () => T0 + 10, nowMs: () => 0, me: () => 'acct-me' });
  listen();
  try {
    const kinds = async (r) => { heard.length = 0; assert.equal(q.add(r), true); await tick(); await tick(); return heard.map(([k]) => k); };
    assert.deepEqual(await kinds(await receipt(701, 'dealt')), ['breach-closed']);
    assert.deepEqual(await kinds(await receipt(702, 'stood', 1)), ['breach-closed', 'rite-broken']);
    assert.deepEqual(await kinds(await receipt(703, 'rite')), ['rite-broken']);
    const before = await receipt(704, 'dealt');
    counted.add(before);
    assert.deepEqual(await kinds(before), [], 'counted before (another device, a lost answer): no act');
  } finally { done(); }
});

test('QL11 cards-won (the relay\'s tables, systems/card/cardRemoteTable.js and systems/iliac/iliacRemoteTable.js): a showdown whose main pot my chair takes, an end that names my seat - once each; a hand lost, a watcher, a game voided, none (mutants: any showdown counted; the main pot\'s winners unread; any end counted)', () => {
  listen();
  try {
    const showdown = (winners) => ({ t: 'showdown', hand: 4, seats: [0, 1], result: { shown: true, pots: [{ amount: 20, eligible: [0, 1], winners }], payouts: [0, 0], hands: {} } });
    const frame = (events) => ({ state: { seats: [{ id: 'them' }, { id: 'me' }], handNo: 4, hand: null, handSeats: [0, 1], button: 0, sb: 1, bb: 2 }, events, now: 0, at: 0 });
    const t = new RemoteCardTable({ myId: 'me', chair: 1 });
    t.ingest(frame([showdown([0])]));
    assert.deepEqual(heard, [], 'the pot went to the other chair');
    t.ingest(frame([showdown([1])]));
    assert.deepEqual(heard, [['cards-won', 1]]);
    const watcher = new RemoteCardTable({ myId: 'someone', chair: -1 });
    watcher.ingest(frame([showdown([1])]));
    assert.equal(heard.length, 1, 'a watcher wins nothing');
    heard.length = 0;
    const state = { seats: [{ id: 'me' }, { id: 'them' }], gameNo: 1 };
    const i = new RemoteIliacTable({ myId: 'me' });
    i.apply({ state, events: [{ t: 'end', gameNo: 1, winner: 1, how: 'board' }] }, 0);
    i.apply({ state, events: [{ t: 'end', gameNo: 1, winner: null, how: 'void' }] }, 0);
    assert.deepEqual(heard, [], 'lost, and no contest');
    i.apply({ state, events: [{ t: 'end', gameNo: 1, winner: 0, how: 'board' }] }, 0);
    assert.deepEqual(heard, [['cards-won', 1]]);
    new RemoteIliacTable({ myId: 'watching' }).apply({ state, events: [{ t: 'end', gameNo: 1, winner: 0, how: 'board' }] }, 0);
    assert.equal(heard.length, 1, 'a watcher sits in no seat');
  } finally { done(); }
});

test('QL11 herb-gathered, ore-mined, wood-chopped (the gathering kinds\' `answered`, which the gathering host calls once for each harvest the service answered): each its own kind, once (mutants: a kind\'s act swapped; the Motherlode alone counted)', () => {
  listen();
  try {
    herbKind({ book: {} }).answered?.({ kind: 'herbs' }, () => {});
    mineKind({ book: {} }).answered?.({ kind: 'ore' }, () => {});
    mineKind({ book: {} }).answered?.({ kind: 'stone' }, () => {});
    treeKind({ book: {} }).answered?.({ kind: 'logs' }, () => {});
    assert.deepEqual(heard, [['herb-gathered', 1], ['ore-mined', 1], ['ore-mined', 1], ['wood-chopped', 1]]);
  } finally { done(); }
});

// ── AUDIT QUESTLINES ACTS-3: EVERY PRODUCER DRIVEN ─────────────

const SUBTLE = webcrypto.subtle;
const T0S = 1_800_000_000;
const edKey = async () => (await SUBTLE.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey;
const settled = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r)); };
const kinds = () => heard.map(([k]) => k);

test('QL11 hour-broken (net/superDungeon/sdClaims.js): said off an Hour receipt the service counted (`recorded`) - once; one counted before (`claimed`: another device, a lost answer), another account\'s, a guest\'s kept for its registration, none (mutants: ACTS M2 a re-claim counted; the act on any answer)', async () => {
  const key = await edKey();
  const hour = (d, s = 'acct-me') => mintSdReceipt({ d, s, c: 7, x: 'dealt', l: 30 }, key, { subtle: SUBTLE, nowS: T0S });
  const counted = new Set();
  let guest = false;
  const claim = async (r) => {
    if (guest) return { ok: true, data: { recorded: false, why: 'guest' } };
    if (counted.has(r)) return { ok: true, data: { recorded: false, why: 'claimed', broken: counted.size } };
    counted.add(r);
    return { ok: true, data: { recorded: true, broken: counted.size } };
  };
  const q = createSdClaims({ claim, nowS: () => T0S + 10, nowMs: () => 0, me: () => 'acct-me' });
  const added = async (r) => { heard.length = 0; assert.equal(q.add(r), true); await settled(); return kinds(); };
  listen();
  try {
    assert.deepEqual(await added(await hour(801)), ['hour-broken']);
    const before = await hour(802);
    counted.add(before);
    assert.deepEqual(await added(before), [], 'counted before: no act');
    assert.deepEqual(await added(await hour(803, 'acct-other')), [], 'another account\'s waits for its own sign-in');
    guest = true;
    assert.deepEqual(await added(await hour(804)), [], 'a guest\'s: kept, not counted');
  } finally { done(); }
});

test('QL11 serpent-slain (net/serpent/serpentClaims.js): said off a serpent receipt the service counted (`recorded`) - once; one counted before, a guest\'s, none (mutants: ACTS M3 a re-claim counted; the act on any answer)', async () => {
  const key = await edKey();
  const serpent = (d) => mintSerpentReceipt({ d, b: 'sethrakul', s: 'acct-me', c: 9, x: 'dealt', h: 4, l: 20 }, key, { subtle: SUBTLE, nowS: T0S });
  const counted = new Set();
  let guest = false;
  const claim = async (r) => {
    if (guest) return { ok: true, data: { recorded: false, why: 'guest' } };
    if (counted.has(r)) return { ok: true, data: { recorded: false, why: 'claimed' } };
    counted.add(r);
    return { ok: true, data: { recorded: true, slain: counted.size, renown: { credited: 0 } } };
  };
  const q = createSerpentClaims({ claim, nowS: () => T0S + 10, nowMs: () => 0, me: () => 'acct-me' });
  const added = async (r) => { heard.length = 0; assert.equal(q.add(r, 'char-1', 'Ama', 20), true); await settled(); return kinds(); };
  listen();
  try {
    assert.deepEqual(await added(await serpent(901)), ['serpent-slain']);
    const before = await serpent(902);
    counted.add(before);
    assert.deepEqual(await added(before), [], 'counted before: no act');
    guest = true;
    assert.deepEqual(await added(await serpent(903)), [], 'a guest\'s: kept, not counted');
  } finally { done(); }
});

test('QL11 redoubt-taken and valkynaz-felled (scenes/eliteGates/egClient.js redoubtActs, off this screen\'s claim loop): a Redoubt receipt the service counted (`recorded`) - every fifth Court\'s a Valkynaz\'s besides; a Rehearsal\'s, one answered `again` (counted before), none (mutants: ACTS M1 a Valkynaz\'s on every Redoubt; the Rehearsal counted; a re-claim counted)', async (t) => {
  let clock = T0S * 1000;
  t.mock.method(Date, 'now', () => clock);
  const B = '0123456789abcdef', ME = 'acct-mac';
  const answers = [];
  const mem = new Map();
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => mem.delete(k) };
  const modes = { mode: 'exterior', stepping: false, egHallBreach: () => null, egHallCircle: () => null, stepThroughFire: async () => true, enterEgHall: () => true };
  const account = { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), claim: async () => answers.shift() ?? { ok: false, error: 'offline' } };
  // the rig of test/net/eliteGates/egaudit4_net_client.test.js: this screen's client on open ground, every door a stand-in
  const client = createEgClient({ modes: () => modes, online: () => ({ sendEg: () => true }), hub: () => ({ egOk: true, sendEg: () => true }), account, now: () => clock,
    entity: { level: 20, health: 100, maxHealth: 100, items: [] }, player: { pos: [0, 0, 0] }, cam: { pos: [0, 0, 0], yaw: 0 }, say: () => {}, site: () => ({}),
    wire: () => ({ px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 }), landAt: () => true, hurt: () => {}, store, paid: () => {},
    callPortal: { open: () => ({ at: [0, 0, 0] }), clear: () => {}, tick: () => {}, standing: () => false }, feet: () => [0, 0, 0] });
  const redoubt = (w, o = {}) => mintEgReceipt({ q: 'w', b: B, s: ME, z: 'z'.repeat(20), c: 7, w, h: 5 * w, t: 600, n: 1, ew: 0, l: 20, ...o }, null, { subtle: SUBTLE, nowS: T0S });
  const claimed = async (r, data) => {
    heard.length = 0;
    answers.push({ ok: true, data: { q: 'w', b: B, keys: 0, paid: true, ...data } });
    client.word(validEgOut({ k: 'rcpt', r }), SOCIAL_ROOM);
    await settled();
    assert.equal(answers.length, 0, 'claimed');
    return kinds();
  };
  listen();
  try {
    assert.deepEqual(await claimed(await redoubt(4), { recorded: true, w: 4 }), ['redoubt-taken']);
    assert.deepEqual(await claimed(await redoubt(5), { recorded: true, w: 5 }), ['redoubt-taken', 'valkynaz-felled'], 'the fifth Court: a Valkynaz\'s');
    assert.deepEqual(await claimed(await redoubt(10, { rh: 1 }), { recorded: true, w: 10 }), [], 'a Rehearsal\'s is practice');
    assert.deepEqual(await claimed(await redoubt(15), { recorded: false, again: true, w: 15 }), [], 'answered `again`: counted before');
  } finally { done(); }
});

test('QL11 elite-foe-slain (systems/questlines/qlEliteFoe.js - the dungeon host hands it its place, AUDIT QUESTLINES ACTS-8): a kill of my blow (systems/playerKills.js) of an elite foe of an Elite-tier dungeon - once; an Elite dungeon\'s plain foe, an elite rolled outside one, a Super dungeon\'s six, a regular dungeon\'s, no dungeon at all, none; the next dungeon\'s place replaces the last (mutants: ACTS M4 any dungeon\'s elite - a Super dungeon\'s six; the `elite` mark unread; the `eliteFoe` mark unread)', () => {
  const ELITE = { hasDungeon: true, elite: true }, SUPER = { hasDungeon: true, elite: true, superTier: true }, REGULAR = { hasDungeon: true };
  const champion = () => ({ eliteFoe: true, elite: true });   // promoteEliteFoe's mark, and the Elite dungeon's record's (applyEliteScaling)
  const killed = (loc, ...foes) => { heard.length = 0; hearEliteFoesIn(loc); for (const f of foes) reportPlayerKill(f, { kind: 'melee' }); return kinds(); };
  listen();
  try {
    assert.deepEqual(killed(ELITE, champion(), { elite: true }, { eliteFoe: true }, {}), ['elite-foe-slain'], 'the champion alone - an Elite dungeon\'s plain foe, an overworld elite and a plain foe are none');
    assert.deepEqual(killed(SUPER, champion()), [], 'a Super dungeon\'s six carry both marks: no Elite dungeon\'s');
    assert.deepEqual(killed(REGULAR, champion()), [], 'a regular dungeon\'s');
    assert.deepEqual(killed(null, champion()), [], 'out of every dungeon');
    assert.deepEqual(killed(ELITE, champion(), champion()), ['elite-foe-slain', 'elite-foe-slain'], 'each kill its own; the listener one by name (re-registered, never twice heard)');
  } finally { done(); registerPlayerKillListener(QL_ELITE_FOE, null); }
});

test('QL11 piece-crafted (net/profBook.js craftOne): a kept craft the service answered, minted by the tab that lets it go - once; a dish cooked (AUDIT QUESTLINES ACTS-4), a potion brewed, a craft another tab let go first, a refusal, none (mutants: ACTS M6 another tab\'s craft counted; ACTS-4 the dish counted)', async () => {
  assert.equal(recipeById('dagger:iron')?.kind, 'weapon');
  assert.equal(recipeById('stew:north')?.kind, 'dish', 'Cooking\'s recipes are crafts (recipeLaw.js dishRecipe)');
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  let otherTab = false, refuse = false;
  const ok = () => (refuse ? { ok: false, error: 'prof-recipe' } : { ok: true, data: {} });
  const door = {
    account: () => 'acct',
    // another tab lets the craft go while this one's ask is on the wire
    craft: async () => { if (otherTab) mem.set(PROF_KEPT_KEY, JSON.stringify({ 'acct|char': { crafts: [] } })); return ok(); },
    brew: async () => ok(),
  };
  const settledCraft = async (w) => {
    heard.length = 0;
    mem.set(PROF_KEPT_KEY, JSON.stringify({ 'acct|char': { crafts: [w] } }));
    const book = createProfBook({ door, storage, character: () => 'char', sleep: async () => {} });
    await book.settle(() => {}, () => {});
    assert.equal(JSON.parse(mem.get(PROF_KEPT_KEY))['acct|char']?.crafts?.length ?? 0, 0, 'let go');
    return kinds();
  };
  listen();
  try {
    assert.deepEqual(await settledCraft({ rid: 'c1', recipe: 'dagger:iron', character: 'char' }), ['piece-crafted']);
    assert.deepEqual(await settledCraft({ rid: 'c2', recipe: 'stew:north', character: 'char' }), [], 'a stew is no piece');
    assert.deepEqual(await settledCraft({ rid: 'c3', brew: true, recipe: 'Cure Disease', keys: [], character: 'char' }), [], 'a brew\'s potions are no piece');
    otherTab = true;
    assert.deepEqual(await settledCraft({ rid: 'c4', recipe: 'dagger:iron', character: 'char' }), [], 'another tab let it go - its piece minted there');
    otherTab = false; refuse = true;
    assert.deepEqual(await settledCraft({ rid: 'c5', recipe: 'dagger:iron', character: 'char' }), [], 'refused');
  } finally { done(); }
});

test('QL11 star-taken, each star once (net/firmament/firmamentBook.js `held`, AUDIT QUESTLINES ACTS-5): a star taken, given back (free below Renown 10) and taken again counts once - across a reload too, the stars kept by account and character; a change whose answer was lost, carried again by read(), counts the star it took; a sky read is remembered uncounted - another device\'s star too - and a book that knows none (a store cleared) learns it uncounted (mutants: the toggle counted again - the diff against the last answer; the kept change uncounted; the stars unkept across a reload; the sky read counted)', async () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  let tree = 'wr.start|wr.s1,wr.s2', lose = false, n = 0;   // the sky as the service holds it: two stars taken before
  const answer = (sky) => ({ ok: true, data: { tree: sky, renown: 5, stars: 6, craft: 0, ranks: {}, refund: { freeBelow: 10, perStar: 10 } } });
  const door = { account: () => 'acct-1', state: async () => answer(tree), set: async (_c, sky) => { tree = sky; return lose ? { ok: false, error: 'offline' } : answer(sky); } };
  const book = () => createFirmamentBook({ door, storage, character: () => 'char-1', rid: () => `fql11acts${String(++n).padStart(4, '0')}` });
  const sky = (...keys) => ({ start: 'wr.start', keys: ['wr.s1', 'wr.s2', ...keys] });
  listen();
  try {
    const b = book();
    await b.read();
    assert.deepEqual(heard, [], 'the sky read: its two stars taken before, uncounted');
    for (let i = 0; i < 3; i++) { assert.equal((await b.commit(sky('wr.g'))).ok, true); assert.equal((await b.commit(sky())).ok, true); }
    assert.deepEqual(heard, [['star-taken', 1]], 'taken, given back and taken again three times: one star');
    // a reload: the stars this device has seen kept - the same star again is none, a new one counts
    const b2 = book();
    await b2.read();
    await b2.commit(sky('wr.g'));
    assert.equal(heard.length, 1, 'a reload forgets no star');
    // a star taken on another device (counted there): this book's next read learns it, uncounted
    tree = `${tree},wr.r1`;
    await b2.read();
    assert.ok(b2.state.tree.keys.includes('wr.r1'));
    assert.equal(heard.length, 1, 'another device\'s star is its own count');
    // a change whose answer was lost - it landed: kept, and counted as read() carries it again (the service's `repeat`)
    lose = true;
    assert.equal((await b2.commit(sky('wr.g', 'wr.bt'))).ok, false);
    assert.equal(heard.length, 1, 'no answer, no star yet');
    lose = false;
    const b3 = book();
    await b3.read();
    assert.deepEqual(b3.state.tree.keys, ['wr.bt', 'wr.g', 'wr.s1', 'wr.s2']);
    assert.deepEqual(heard, [['star-taken', 1], ['star-taken', 1]], 'the lost answer\'s star, counted once read() carries it');
    // a store cleared: the book knows no sky - learnt uncounted, never a whole sky at once; then a new star counts
    mem.clear();
    heard.length = 0;
    const b4 = book();
    await b4.read();
    assert.deepEqual(heard, []);
    await b4.commit(sky('wr.g', 'wr.bt', 'wr.r1'));
    assert.deepEqual(heard, [['star-taken', 1]]);
  } finally { done(); }
});

const ARENA_O = '0123456789abcdef';
/** A relay's bout on a fake floor (test/net/arena/arena4_client.test.js's driver): 'pve' a ladder bout (me against the
 *  relay's a0), 'pvp' players' (Alva p0 against Brann p1) - `u` a casual pair's. Answers the verdict's press. */
async function relayBout({ kind = 'pve', me = 'p0', u = false } = {}) {
  const c = [...ARENA_FLOOR_CENTRE];
  const stage = { kind: 'floor', centre: () => c, remove: () => {}, heightAt: () => null,
    spawn: async (mobile, feet, o) => ({ mobile, entity: { health: 20, maxHealth: 20 }, ai: { feet: [...feet], yaw: o.yaw ?? 0, isHostile: true } }) };
  const D = createArenaBouts({ now: () => 1000, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, notice() {}, drawHud() {}, heal() {}, pay() {} });
  D.setStage(stage);
  D.startRelay({ o: ARENA_O, kind, me, next: kind === 'pve' ? { tier: 0, bout: 1, purse: 50, champion: false, grand: false } : null, names: (i) => ({ name: `Rogue${i}`, home: 'Wayrest', epithet: '' }),
    send: { hit: () => true, yield: () => true }, myHealth() {} });
  const f = kind === 'pve' ? [['p0', 'Ceryn', 0, 90, 90, '', 0, -1, 0, '', ''], ['a0', '-', 1, 26, 26, '', 1, 136, 50, '', '']]
    : [['p0', 'Alva', 0, 340, 340, '', 0, -1, 0, '', ''], ['p1', 'Brann', 1, 360, 360, '', 0, -1, 0, '', '']];
  D.relayWord({ k: 'st', o: ARENA_O, kind, ph: 'call', pa: 5000, fa: null, lim: 180000, ...(kind === 'pve' ? { tier: 0, bout: 1 } : {}), ...(u ? { u: 1 } : {}), f, me, sp: 0 });
  await new Promise((r) => setTimeout(r, 0));
  return (side) => { heard.length = 0; D.relayWord({ k: 'ev', e: [{ k: 'fight', at: 9000 }, { k: 'end', at: 20_000, side, how: 'fall' }, { k: 'verdict', at: 21_500, side, how: 'fall' }] }); return kinds(); };
}

test('QL11 arena-won at the relay (scenes/arena/arenaBouts.js relayVerdict): a ladder bout (`pve`) my side won - once; one lost, a watcher\'s, a bout between players won - rated or casual (AUDIT QUESTLINES ACTS-6: no step of the ladder), none (mutants: ACTS M5 a relay bout lost counted; ACTS-6 a players\' bout counted; a watcher\'s counted)', async () => {
  listen();
  try {
    assert.deepEqual((await relayBout())(0), ['arena-won']);
    assert.deepEqual((await relayBout())(1), [], 'lost');
    assert.deepEqual((await relayBout({ me: 'p9' }))(0), [], 'a watcher has no side');
    assert.deepEqual((await relayBout({ kind: 'pvp' }))(0), [], 'a rated bout between players is no ladder bout');
    assert.deepEqual((await relayBout({ kind: 'pvp', u: true }))(0), [], 'nor a casual pair\'s');
  } finally { done(); }
});

/** This screen's own bout on a fake floor (test/systems/arena/arena2_driver.test.js's rig), run to its fight. */
async function ownBout(kind) {
  let t = 1000;
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder() };
  const foes = [];
  const stage = { kind: 'floor', centre: () => [50, 0, 40], remove: () => {}, heightAt: () => null,
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: 60, maxHealth: 60, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null, isHostile: true } }; foes.push(f); return f; } };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, setPlayerBout: () => {}, say: () => {}, notice: () => {}, pay: () => {}, heal: () => { P.health = P.maxHealth; },
    crime: () => {}, drawHud: () => {}, sound: { cue: () => {}, bed: () => {}, stop: () => {} } });
  A.setStage(stage);
  A.ask({ where: 'floor', kind, next: nextLadderBout(P.arenaLadder) });
  await settled();
  const step = (ms) => { t += ms; A.frame(ms / 1000, { playerFeet: [44, 0, 40], sheathed: false }); };
  for (let i = 0; i < 200 && A.bout()?.phase !== 'fight'; i++) step(100);
  assert.equal(A.bout()?.phase, 'fight');
  const toDone = () => { for (let i = 0; i < 100 && A.bout().phase !== 'done'; i++) step(100); assert.equal(A.bout().phase, 'done'); return kinds(); };
  return {
    win: () => { heard.length = 0; const f = foes[0]; f.entity.health = 1; f.entity.bout.out = true; f.entity.bout.hooks.floor(f, { fromPlayer: true }); step(100); return toDone(); },
    lose: () => { heard.length = 0; P.health = 1; A.playerSpare().spare(P); step(100); return toDone(); },
  };
}

test('QL11 arena-won on this screen\'s floor (scenes/arena/arenaBouts.js verdict): a ladder bout won - once; one lost, the training pit\'s practice won, none (mutants: the act on any ladder verdict; the pit\'s practice counted)', async () => {
  listen();
  try {
    assert.deepEqual((await ownBout('ladder')).win(), ['arena-won']);
    assert.deepEqual((await ownBout('ladder')).lose(), [], 'lost');
    assert.deepEqual((await ownBout('practice')).win(), [], 'the pit\'s practice is no bout of the Arena\'s');
  } finally { done(); }
});

test('QL11 gambit-won (scenes/gambitTableGame.js settle, a game the relay decided): the seat that won - once; the seat that lost, and a watcher at the cloth (whose board is the host\'s, side 0), none (mutants: ACTS M8 a watcher\'s board counted; the winner unread)', () => {
  const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
  const CHAIRS = [[0, 0, -0.9], [0.9, 0, 0], [0, 0, 0.9], [-0.9, 0, 0]];
  // the relay's table (net/gambit/gambitTable.js), two seated and dealt (test/net/kg5_client.test.js `dealt`), its frames kept
  const table = newGambitTable({ chairs: 4 });
  const frames = [];
  const keep = (m) => { for (const x of m) frames.push({ t: 'gambit', table: 0, now: 0, ...x.frame }); return m; };
  keep(gambitSit(table, { id: 'a', name: 'Ana', chair: 0, crown: 0, now: 0 }));
  keep(gambitSit(table, { id: 'b', name: 'Bors', chair: 2, crown: 2, now: 0 }));
  keep(gambitReady(table, { id: 'a', army: autoFill([], KG_POINT_BUDGET, xorshift(3)), now: 0 }));
  keep(gambitReady(table, { id: 'b', army: autoFill([], KG_POINT_BUDGET, xorshift(4)), now: 0 }));
  keep(gambitTick(table, GAMBIT_FIRST_MS, xorshift(3)));
  const page = (id, chair) => {
    let local = 0;
    const g = openGambitTableGame({
      doc: fakeDoc(), renderer: { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} },
      entity: { name: id, items: [], goldPieces: 100 }, say: () => {}, holdCursor: () => () => true, relock() {}, rand32: xorshift(9), now: () => local, day: () => 100,
      key: 'town:7:0', friendly: true, regulars: [{ name: 'Cael', seed: 3, chair: 3 }], frame: FRAME, mySeatFeet: CHAIRS[chair], touch: () => false, onHoldem() {}, onIliac() {}, onStand() {},
      online: { send: () => true, myId: () => id, now: () => GAMBIT_FIRST_MS + 1000, table: 0, chairs: 4, chair, chairFeet: (k) => CHAIRS[k], welcomes: () => 1 },
    });
    for (const f of frames) g.relay(f);
    return { g, step: (ms) => { local += ms; g.frame(local); } };
  };
  const seats = { a: page('a', 0), b: page('b', 2), watcher: page('c', 3) };
  assert.equal(seats.watcher.g.g.watcher, true, 'the third chair watches');
  const forfeit = gambitForfeit(table, { id: 'b', gameNo: table.gameNo, now: GAMBIT_FIRST_MS + 5000 }).map((x) => ({ t: 'gambit', table: 0, now: 0, ...x.frame }));
  listen();
  try {
    const out = {};
    for (const [who, p] of Object.entries(seats)) {
      heard.length = 0;
      for (const f of forfeit) p.g.relay(f);
      p.step(10); p.step(GAMBIT_RESULT_MS);
      assert.equal(p.g.g.phase, 'over', `${who}: decided`);
      out[who] = kinds();
    }
    assert.deepEqual(out, { a: ['gambit-won'], b: [], watcher: [] }, 'the host won by the guest\'s forfeit');
  } finally { done(); }
});

test('QL11 fish-caught (scenes/deepWater/deepWatersFish.js remove): a fish whose item was taken (its loot emptied - only the player\'s loot window empties one) - once, as it goes; one that swam off whole (the pulse\'s despawn), none (mutants: ACTS M9 a despawned fish counted; counted at every remove)', () => {
  const host = createDeepWatersFish({
    settings: () => ({ frequency: 3, maxLive: 50, waterDepth: 200 }), canRunHeavy: () => true, exteriorWaterContext: () => true, playerPosition: () => [0, 0, 0],
    loadedPixels: () => [{ px: 1, py: 1 }], isWaterPixel: () => true, pixelOrigin: () => [0, 0, 0], keyOf: () => '1,1', climateIndexOf: () => 223,
    pictures: { loaded: () => true, spawnable: () => [PASSIVE_FISH_SPECIES[4]] }, makeItem: (s) => createFishItem(s), roll: () => 0.25,
  });
  const col = { oceanY: 34, seafloorY: -26, depth: 60, entry: {} };
  const f = { time: 0, dt: 0.1, frame: 1, roll: () => 0.5, playerPos: [400, 20, 400], column: () => col, renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 1e6, raycast: () => null };
  listen();
  try {
    host.pump(f);
    host.pump({ ...f, frame: 2, time: 0.05 });   // test/systems/item/dwe_fish.test.js: the schools stand the next frame
    assert.ok(host.count >= 2, 'fish to take');
    const [taken, swam] = host.fishes;
    taken.loot.items.length = 0;
    host.pump({ ...f, frame: 3, time: 0.06 });
    assert.ok(!host.fishes.includes(taken), 'taken: gone');
    assert.deepEqual(heard, [['fish-caught', 1]]);
    taken.destroy();
    assert.equal(heard.length, 1, 'once');
    swam.destroy();
    assert.equal(heard.length, 1, 'a fish that swam off is no catch');
  } finally { done(); }
});

test('QL11 raid-repelled (systems/raidingParties.js cleanse): a raid I fought (a blow of mine on its raider), cleansed while I stand on its town\'s pixel - once; one cleansed unfought, or fought and cleansed with me off the pixel, none (mutants: ACTS M10 a raid cleansed anywhere, unfought; the pixel unread)', async () => {
  const DAY = 400, AT = (min) => DAY * MINUTES_PER_DAY + min;
  // test/systems/raid1_raidingParties.test.js's recording host, the raid of one raider
  const cleansed = async ({ pixel, fight }) => {
    _resetRaidingParties(); _resetRenownKillsForTests(); setSharedClock(null);
    const raiders = [];
    setRaidingPartiesHost({
      now: () => AT(610), random: () => 0, regionIndex: () => 3, regionName: (r) => `Region${r}`, townHere: () => ({ regionIndex: 3, locationIndex: 7 }), playerPixel: () => pixel,
      standRaider: (mobileType) => { const r = { mobileType, dead: false, corpse: false, entity: { health: 10 }, ai: { feet: [raiders.length, 0, 0] }, uid: raiders.length + 1 }; raiders.push(r); return Promise.resolve(r); },
      standDefender: () => Promise.resolve(null), defenderCount: () => 0, defendersAllowed: () => false, removeFoe: (r) => { r.dead = true; }, outOfSight: () => true,
      reputation: () => ({ player: { legalRep: {} }, store: { dict: new Map() } }), say: () => {},
    });
    restoreRaidSaveData({ lastSelectedDay: DAY, raids: [{ regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: 'Gothway Garden', type: 2, startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 1, cleansed: false, announced: false, struck: false, px: 200, py: 100 }] });
    raidFrame(1);
    await new Promise((r) => setImmediate(r));
    assert.ok(raiders[0], 'a raider stood');
    if (fight) renownFoeStruck(raiders[0]);
    raidFrame(0);
    heard.length = 0;
    raiders[0].dead = true; raiders[0].corpse = true;
    raidFrame(0);
    assert.equal(raidState().raids[0].cleansed, true);
    return kinds();
  };
  setModSetting(RAIDING_PARTIES_VENDOR, 'Enabled', true);
  listen();
  try {
    assert.deepEqual(await cleansed({ pixel: { x: 200, y: 100 }, fight: true }), ['raid-repelled']);
    assert.deepEqual(await cleansed({ pixel: { x: 200, y: 100 }, fight: false }), [], 'unfought');
    assert.deepEqual(await cleansed({ pixel: { x: 201, y: 100 }, fight: true }), [], 'fought, but off the town\'s pixel at the cleanse');
  } finally { done(); _resetRaidingParties(); _resetRenownKillsForTests(); modsOff(); }
});

test('QL11 cards-won offline (systems/iliac/iliacTableSession.js _finish): an Iliac game against a regular won - once each; a game lost or drawn, none (mutants: ACTS M11 a lost game counted; a draw counted)', () => {
  const src32 = (seed) => { const u = seededUnit(seed); return () => Math.floor(u() * 4294967296); };
  const ends = { won: 0, lost: 0, draw: 0 };
  listen();
  try {
    for (let seed = 1; seed <= 12; seed++) {
      const s = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:1', name: 'Bors', temper: 'loose', grade: 0, deck: patronDeck(4, 'loose', 0) }, rand32: src32(seed), now: 0 });
      const u = seededUnit(seed + 100);
      for (let turn = 1; turn <= ILIAC_TURNS && !s.over; turn++) { const at = s.thinkAt; s.tick(at); s.playerCommit(patronPlays(s.state, 0, 'tight', 2, u), at); s.tick(at + ILIAC_REVEAL_MS); }
      ends[s.over]++;
    }
    assert.ok(ends.won > 0 && ends.lost > 0 && ends.draw > 0, `won, lost and drawn among them: ${JSON.stringify(ends)}`);
    assert.deepEqual(heard, Array(ends.won).fill(['cards-won', 1]), 'one a game won');
  } finally { done(); }
});

test('QL11 cards-won offline (systems/card/cardTableSession.js, a Hold\'em evening against the regulars): each hand whose main pot I take (or share) - once; a hand I fold or lose, none (mutants: ACTS M12 any showdown counted)', () => {
  const seeded = (seed) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 300 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'loose', stack: 300 }, { id: 'patron:1', name: 'Bors', temper: 'tight', stack: 300 }], stakes: { sb: 5, bb: 10 }, rand32: seeded(7), now: 0 });
  let won = 0, lost = 0;
  listen();
  try {
    // 'cautious' (test/systems/card/cards4_session.test.js): checks, calls up to two big blinds, folds the rest
    for (let now = 0; now < 2_000_000 && !s.over && s.handNo <= 12; now += 100) {
      s.tick(now);
      const legal = s.legal();
      if (legal) s.playerAct(legal.check ? { type: 'check' } : legal.call <= 20 ? { type: 'call' } : { type: 'fold' }, now);
      for (const e of s.drain()) {
        if (e.t !== 'showdown') continue;
        const k = e.seats.indexOf(s.playerSeat);
        if (k >= 0 && e.result.pots[0]?.winners.includes(k)) won++; else lost++;
      }
    }
    assert.ok(won > 0 && lost > 0, `hands won and lost: ${won}, ${lost}`);
    assert.deepEqual(heard, Array(won).fill(['cards-won', 1]), 'one a hand won');
  } finally { done(); }
});

test('QL11 fish-caught (scenes/fishHost.js, the net\'s answered haul): every haul the service answered - a trophy\'s or not - once (mutants: ACTS M13 only a trophy haul counted)', () => {
  const kind = fishKind({ book: {}, host: { climateAt: () => 0, trophy: () => true } });
  listen();
  try {
    kind.answered({ node: haulKey({ x: 1, y: 1, day: 3, id: 'a1' }), trophy: false }, () => {});
    assert.deepEqual(heard, [['fish-caught', 1]], 'a plain haul is a catch');
    kind.answered({ node: haulKey({ x: 1, y: 1, day: 3, id: 'a2' }), trophy: true }, () => {});
    assert.deepEqual(heard, [['fish-caught', 1], ['fish-caught', 1]], 'and a trophy\'s');
  } finally { done(); }
});

test('QL11 wood-chopped, fish-caught, herb-gathered (systems/foraging/foragingInstall.js useForagingTool, offline - Foraging\'s own): the Wood-Axe\'s bundles, the net\'s catch, the Basket\'s find, in the pack - once each; an empty swing, an empty net, an empty basket, none (mutants: ACTS M14 an empty net counted; an axe that gathered nothing counted; an empty basket counted; ACTS-10 an egg counted a plant)', () => {
  const OPEN = { inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false, hour: 12, climate: CLIMATES.Woodlands, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
  const WET = { ...OPEN, exteriorWater: 'WaterWalking' };
  // test/systems/forage2_tools.test.js: the draws, each the index wanted of a list of that length
  const draws = (...pairs) => { let i = 0; return () => { const [k, n] = pairs[i++] ?? [0, 1]; return (k + 0.5) / n; }; };
  const used = (tool, world, ...pairs) => {
    heard.length = 0;
    setForagingHost({ world: () => world, monthValue: () => 9, entity: () => null, startQuest: () => true });
    _setForagingRandomForTests(draws(...pairs));
    const e = { stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45 }, items: [], wagonItems: [], fatigue: 40 * 64, health: 20, maxHealth: 100, magicka: 5, maxMagicka: 50 };
    useForagingTool(createForagingItem(tool), [], { entity: e });
    return [e.items.length, kinds()];
  };
  setModSetting(FORAGING_VENDOR, 'Enabled', true);
  listen();
  try {
    assert.deepEqual(used(FT.WoodAxe, OPEN, [3, 5]), [2, ['wood-chopped']]);
    assert.deepEqual(used(FT.WoodAxe, OPEN, [0, 5]), [0, []], 'no usable wood');
    assert.deepEqual(used(FT.FishingNet, WET, [5, 6]), [2, ['fish-caught']]);
    assert.deepEqual(used(FT.FishingNet, WET, [0, 6]), [0, []], 'an empty net');
    assert.deepEqual(used(FT.Basket, OPEN, [3, 6], [1, 5]), [2, ['herb-gathered']]);
    assert.deepEqual(used(FT.Basket, OPEN, [0, 6], [0, 5]), [0, []], 'nothing to forage');
    assert.deepEqual(used(FT.Basket, OPEN, [3, 6], [3, 5]), [2, []], 'AUDIT QUESTLINES ACTS-10: eggs in the basket - no plant');
  } finally { done(); _setForagingRandomForTests(null); setForagingHost(null); modsOff(); }
});

test('QL11 ship-struck online, the striker (scenes/naval/navalHost.js applyWord, AUDIT CC-E4; AUDIT QUESTLINES ACTS-11): a ship another captain stands, struck in her stander\'s word within SINK_CREDIT_S of my blow - mine, once; one I never struck, none (mutants: the act left out of the word\'s arm)', async () => {
  const h = await sea({ hull: 2, online: { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: () => true } });
  const frames = (s) => { for (let t = 0; t < s - 1e-9; t += 0.1) h.host.frame(0.1); };
  const cls = ['pirateSloop', 'pirateBrig', 'pirateGalley', 'pirateFlagship', 'merchantCoaster', 'merchantGalleon'].indexOf('merchantGalleon');
  // test/systems/naval/nav_h_host.test.js's word: her number, class, place, heading, hull and state (WIRE_STATES: 1 struck)
  const word = (n, z, state = 0, hull = 100) => ({ s: [[n, cls, 0, 70, 0, z, Math.PI / 2, 0, 1, hull, 100, 100, state, 0, 999, 0]], v: [], b: [] });
  h.host.applyWord('a-player', word(4, 0), (p) => p);
  const e = h.host._sea.get('a-player:4');
  frames(0.3);
  assert.ok(e?.boat, 'her puppet, on her hull');
  const box = hullBoxOf(e.boat, h.pool.models);
  h.host._shots.fireVolley({ id: 'acts11', shooter: 'me:42', launches: [{ gun: 'long', index: 0, p0: [box.c[0] - 40, 4, box.c[2]], v0: [80, 0.4, 0], delay: 0 }] });
  frames(1);
  assert.ok(Number.isFinite(e.myBlowAt), 'my blow on her');
  listen();
  try {
    h.host.applyWord('a-player', word(4, 0, 1, 20), (p) => p);   // she strikes in a-player's world
    assert.deepEqual(heard, [['ship-struck', 1]], 'mine, once');
    h.host.applyWord('a-player', word(4, 0, 1, 20), (p) => p);
    assert.deepEqual(heard, [['ship-struck', 1]], 'the same word again: nothing new');
    h.host.applyWord('a-player', word(5, 400), (p) => p);
    frames(0.3);
    h.host.applyWord('a-player', word(5, 400, 1, 20), (p) => p);
    assert.deepEqual(heard, [['ship-struck', 1]], 'one I never struck');
  } finally { done(); }
});

test('QL11 revenant-knelt (systems/revenant/revenantFate.js beginYield): one of mine, beaten, its record answering the yield - once; a body whose record is none of mine (a stranger\'s, a forgotten one), none (mutants: ACTS M15 noted before the record answers)', () => {
  const NOW = 1440 * 5;
  _resetForTests(); setPref('lootRarity', true);
  RVN._resetRevenantForTests(); setWorldMinutes(NOW);
  const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-ql11acts', level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 };
  // test/systems/revenant/lair_home.test.js: a marked champion that got away is a revenant of mine; its next body wears it
  const r = RVN.revenantDeed(me, { mobileType: MOBILE_TYPES.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: MOBILE_TYPES.Orc, rolls: () => 0 });
  assert.ok(r, 'a revenant of mine');
  const body = { mobileType: MOBILE_TYPES.Orc, level: 6, health: 100, maxHealth: 100, items: [], team: 'Monster' };
  RVN.applyRevenant(body, r, { now: NOW });
  listen();
  try {
    assert.equal(beginYield(me, { entity: { mobileType: MOBILE_TYPES.Orc, health: 9, maxHealth: 9, items: [], revenant: { id: 'rv-none-of-mine' } }, ai: {} }, { rolls: () => 0 }), null);
    assert.deepEqual(heard, [], 'no record answers: no kneel');
    assert.ok(beginYield(me, { entity: body, ai: {} }, { rolls: () => 0 }), 'it kneels');
    assert.deepEqual(heard, [['revenant-knelt', 1]]);
  } finally { done(); RVN._resetRevenantForTests(); _resetForTests(); }
});

test('QL11 ship-struck (scenes/naval/navalHost.js, a ship\'s state changed - the crew\'s arm, AUDIT QUESTLINES ACTS-8): a ship struck by my guns - once; one a peer\'s guns struck, none (mutants: ACTS M7 a peer\'s guns counted)', async () => {
  const h = await sea({ hull: 2 });
  // test/systems/naval/navaudit_boarding.test.js's `place` and `blow` - a ball's hits through the peers' door, by `from`
  const place = (classId, pos) => {
    const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw: 0 });
    const e = h.host._sea.get(id);
    e.ship.pos = [...pos];
    h.host.frame(0.1);
    return e;
  };
  const strike = (e, from) => {
    const d = e.ship.damage;
    let left = Math.ceil(d.hull - d.maxHull * STRUCK_AT + 1);
    while (left > 0) { const hull = Math.min(left, NAVAL_HIT_MAX); h.host.applyPeerHit(from, navalHitData('local', { n: e.n, hull })); left -= hull; }
    assert.equal(d.state, SHIP_STATES.struck, `${from}: struck`);
  };
  listen();
  try {
    strike(place('merchantGalleon', [300, 0, 0]), 'peer-x');
    assert.deepEqual(heard, [], 'a peer\'s prize');
    strike(place('merchantGalleon', [-300, 0, 0]), 'local');
    h.run(1);
    assert.deepEqual(heard, [['ship-struck', 1]], 'mine, once');
  } finally { done(); }
});
