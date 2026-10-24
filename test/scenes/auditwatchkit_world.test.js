import { giveNavalItems } from '../../src/systems/naval/navalTransfer.js';
import { goldStack } from '../../src/systems/inventory.js';
import { mintStores } from '../../src/systems/naval/navalStores.js';
// AUDIT WATCH-KIT (2026-10-01, Mac: "Just want to audit this to make sure it's perfection") - the audit of PR #502
// (SHIP-WATCH, COMPANION-KIT; bible/01-Overview/audits/Audit-Watch-Kit.md). This suite pins the HOSTS' side of the companions
// (lenses U and P): another player's companion by his own name, the cards off the ship's plate while I sail, the panel
// online with no account, his pack read by his key, a dungeon's load lifting the party, and a pack never thrown away -
// his gold into my purse. Each test fails on the code as #502 stood, for its finding's reason.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createExteriorFoes, companionNames, COMPANION_NAME_MAX } from '../../src/scenes/exteriorFoes.js';
import { HULL } from '../../src/systems/naval/navalShips.js';
import { sea } from '../navalSea.mjs';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const DUNGEON = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const FOES = readFileSync(new URL('../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
const HOST = readFileSync(new URL('../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');

/** A `const name = (...) => {...};` of world.js, lifted whole by its braces - the source the game runs. */
function lift(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `found: ${head}`);
  let i = src.indexOf('{', src.indexOf('=>', at)), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(src.indexOf('(', at), i + 1);
}

// ── U3: another player's companion by his own name ─────────────────────────────────────────────────────────────────

function craftClass(name) {
  const b = new Uint8Array(74), v = new DataView(b.buffer);
  for (let i = 0; i < name.length; i++) b[28 + i] = name.charCodeAt(i);
  v.setUint16(52, 14, true); v.setUint32(54, 0x10000, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'CLASS16.CFG') return craftClass('Warrior'); throw new Error(`no ${n}`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 6, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const netAs = (id) => ({ selfId: () => id, room: () => 'world:3,12', onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });

test('AUDIT WK-U3 another player\'s companion wears his own name on my screen - his owner\'s foes frame names him (`cn`, in `cp`\'s order) - never his class\'s, and his bar carries no health digits (mutants: the names unsent, unread, the class\'s name kept, the digits drawn)', async () => {
  const A = createExteriorFoes(poolRig()), B = createExteriorFoes(poolRig());
  A.setNet(netAs('mac-0001')); B.setNet(netAs('bob-0002'));
  const mate = await A.spawnFoe(144, [10, 0, 10], { feetGiven: true, allied: true, loose: true, transient: true, gender: 'female' });
  mate.companion = '42:Hilda'; mate.shipmate = true; mate.entity.name = 'Hilda Moyle';
  const frame = A.foesFrame(true);
  assert.deepEqual(frame.cn, ['Hilda Moyle'], 'his name beside his number');
  B.applyFoes('mac-0001', frame);
  await new Promise((r) => setTimeout(r, 0));
  const there = B.foes.find((f) => f.puppet === 'mac-0001');
  assert.ok(there?.companion, 'a companion on my screen');
  assert.equal(there.companionName, 'Hilda Moyle');
  assert.notEqual(there.entity.name, 'Hilda Moyle', 'his entity keeps its class - the name is the bar\'s');
  // a frame again (the update arm): each frame's word is his name - a new one taken
  mate.entity.name = 'Hilda the Bold';
  B.applyFoes('mac-0001', A.foesFrame(true));
  assert.equal(there.companionName, 'Hilda the Bold');
  // the bar's point world.js builds for him: his name, no digits
  assert.match(WORLD, /\.\.\.\(mate \? \(f\.puppet \? \{ name: f\.companionName \|\| 'Companion', fx: \[\] \} : \{ name: f\.entity\.name \|\| 'Companion', hp: f\.entity\.health, hpMax: max, fx: composePartyFx\(f\.entity\) \}\) : \{\}\) \}\);/);
  // the dungeon's own lane says and reads them the same
  assert.match(DUNGEON, /if \(!qt && f\.companion != null && !f\.dead\) \{ cp\.push\(i\); cn\.push\(f\.entity\?\.name \?\? ''\); \}/);
  assert.match(DUNGEON, /\.\.\.\(cp\.length \? \{ cp, cn \} : \{\}\) \};/);
  assert.match(DUNGEON, /const compNames = companionNames\(data\.cp, data\.cn\);/);
  assert.match(DUNGEON, /companionPuppet\(f, lo && comp\.has\(r\.i\), compNames\.get\(r\.i\)\)/);
  assert.match(DUNGEON, /companionPuppet\(f, true, newest\._compName \?\? r\._compName\)/);
  assert.match(DUNGEON, /f\.shipmate = true; f\.companionName = name \?\? null;/);
  assert.match(FOES, /\.\.\.\(cp\.length \? \{ cp, cn \} : \{\}\)/);
});

test('AUDIT WK-U3 the names\' law: in `cp`\'s order, at most COMPANION_NAME_MAX characters, control characters dropped, a bad entry none (mutants: the order, the bound, the sanitising)', () => {
  assert.deepEqual([...companionNames([3, 5, 'x', 9], ['Hilda', '\u0001Olaf \u007f', 'a', 7])], [[3, 'Hilda'], [5, 'Olaf']]);
  assert.deepEqual([...companionNames([1], ['x'.repeat(90)])][0][1].length, COMPANION_NAME_MAX);
  assert.deepEqual([...companionNames([1, 2], ['   '])], [], 'blank: none');
  assert.deepEqual([...companionNames(null, ['a'])], []);
  assert.deepEqual([...companionNames([1], null)], []);
  assert.equal(COMPANION_NAME_MAX, 40);
});

// ── U5, U7: the panel ──────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-U5/U7 the companions\' cards: none while I sail (the party is aboard - its cards stood over the ship\'s plate on a phone); and online with no social picture the panel is still made for them (mutants: the sailing unread, the chat alone standing the panel down)', () => {
  assert.match(WORLD, /const party = navalOn\(\) && !csaRuntime\?\.isSailing\?\.\(\) \? naval\?\.companions\?\.party \?\? \[\] : \[\];/);
  assert.match(WORLD, /function companionPanelFrame\(\) \{\n\s*if \(chatLinks && social\) return;/);
});

// ── P3: his pack by his key ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-P3 his pack is read by his key at every look: a quickload under the window stands the restored party, and the window shows the restored pack - never the unloaded list taken once (mutants: the list captured at the open)', () => {
  const body = WORLD.slice(WORLD.indexOf('const openCompanionPack = (rec) => {'), WORLD.indexOf('const csaOpenListPicker'));
  const expr = body.match(/items: (\(\) => naval\?\.companionPack\?\.\(key\)\?\.items \?\? \(orphan \?\?= \[\]\)),/);
  assert.ok(expr, 'the read by key');
  const before = { items: ['Claymore'] }, after = { items: ['Claymore'] };
  let party = new Map([['42:Hilda', before]]);
  const naval = { companionPack: (k) => party.get(k) ?? null };
  const items = new Function('naval', 'key', `let orphan = null; return ${expr[1]};`)(naval, '42:Hilda');
  assert.equal(items(), before.items);
  party = new Map([['42:Hilda', after]]);   // the quickload: a restored party, its own lists
  assert.equal(items(), after.items, 'the restored pack');
  assert.notEqual(items(), before.items);
  party = new Map();   // a save without him: one list for the window's life, never a fresh one a look
  assert.equal(items(), items());
});

// ── P4: a dungeon's load lifts the party ───────────────────────────────────────────────────────────────────────────

test('AUDIT WK-P4 a same-dungeon load lifts the party first, as worldQuickLoad does (AUDIT CC-A8): its OnStartLoad door runs ahead of the save\'s player and world (mutants: the dungeon\'s load leaving the party standing)', () => {
  assert.match(WORLD, /modStartLoad: \(\) => \{ crewAshore\.clear\(\); (?:(?:revenantAshore\.clear|clearSworn)\(\); )?if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnStartLoad\(\)\); \},/);
  const load = DUNGEON.slice(DUNGEON.indexOf('opts.modStartLoad?.();'));
  assert.ok(load.indexOf('opts.modStartLoad?.();') < load.indexOf('restorePlayer(playerEntity, snap'), 'ahead of the player');
  assert.ok(load.indexOf('restorePlayer(playerEntity, snap') < load.indexOf('this.restoreSaved(extras'), 'and of the world');
  assert.match(WORLD, /travelOptions\?\.clearTravelDestination\(\);\n\s*if \(worldTimeScale\(\) !== 1\) resetTimeScale\(\);\n\s*crewAshore\.clear\(\);/, 'the street\'s own, as it was');
});

// ── P5: a pack never thrown away ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-P5 a companion\'s pack is never thrown away: with no boat of his found it goes into my pack past its gate if it must ("more than you can carry"), with her hold it goes there - and his gold into my purse (mutants: the leftovers dropped, the force unasked, the gold a pile)', async () => {
  const s = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  const calls = [];
  s.deps.board.giveItems = (items, boat, o) => { calls.push({ n: items.length, boat: boat?.uid ?? null, force: !!o?.force }); return boat ? { left: [] } : { left: o?.force ? [] : items.slice(0), over: o?.force ? items.length : 0 }; };
  const claymores = () => Array.from({ length: 6 }, (_, i) => ({ name: `Claymore ${i}` }));
  s.host.companionKnocked({ boat: 77, name: 'Hilda', gender: 'female', items: claymores() });   // her boat gone (purged)
  assert.deepEqual(calls, [{ n: 6, boat: null, force: true }], 'into my pack, forced');
  assert.ok(s.log.say.some((t) => t === 'Hilda\'s pack is stowed in your pack (more than you can carry).'), s.log.say.join(' | '));
  calls.length = 0;
  s.host.companionKnocked({ boat: 42, name: 'Olaf', gender: 'male', items: claymores() });   // her boat at hand
  assert.deepEqual(calls, [{ n: 6, boat: 42, force: false }]);
  assert.ok(s.log.say.some((t) => t === 'Olaf\'s pack is stowed in the hold.'));
  // the world's door: gold into the purse, the rest past the gate when forced
  const give = new Function('playerEntity', 'giveNavalItems', 'surfacePlayer', `return ${lift(WORLD, 'const navalGiveItems = (items, boat, { force = false } = {}) => {')};`);
  const me = { items: [], goldPieces: 10, stats: { strength: 1 }, activeEffects: [] };
  const fn = give(me, giveNavalItems, () => {});
  const gold = goldStack(500), stores = mintStores(100);
  assert.deepEqual(fn([gold, stores], null), { left: [stores], over: 0 }, 'unforced: what will not go is answered');
  assert.equal(me.goldPieces, 510, 'his gold in my purse');
  assert.ok(!me.items.includes(gold));
  assert.deepEqual(fn([stores], null, { force: true }), { left: [], over: 1 });
  assert.equal(me.items[0].stackCount, 100, 'past the gate');
  assert.match(HOST, /const mine = rest\.length \? deps\.board\?\.giveItems\?\.\(rest, null, \{ force: true \}\) \?\? null : null;/);
});
