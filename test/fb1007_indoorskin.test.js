// FIELD BUGS 2026-10-07 INDOOR-SKIN ("Cannot skin indoors" - "When doing a Fighters Guild quest to kill giant rodents,
// their bodies are not able to be skinned."). The Fighters Guild's Hunt for Giant Rodents (vendored M0B00Y15) places its
// house `local random` and stands its Giant Rats and Giant Bats in it (`create foe _rats_ every 2 minutes`), through the
// building's own foe pool (worldModes.js makeInteriorFoes -> exteriorFoes.js createExteriorFoes). The kill was stamped -
// the building's pool tells the player's kill as the street's does - but the body was never a node: the world host
// looked for Hunting's bodies in the dungeon's pool or else the STREET's (so indoors among the street's dead), the
// gathering host was live on the street and underground alone, and the building's ladder offered E to no profession.
// THE FOUR HOSTS: the streaming world's street (world.js) and its building interiors (worldModes.js) and dungeons
// (dungeonContext.js through worldModes.js) skin; the fixed city (exterior.js) stands no professions (FLAGGED, 29's law).
// Every foe here is the real producer's: the quest's own Foe resource parsed from the vendored script (its foeType the
// Quests-Foes table's), stood by the real pool's spawnFoe as tryPlaceInteriorQuestFoe stands it, felled by its damageFoe.
// bible/06-Systems/Professions-Arc.md 29 (INDOOR-SKIN).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, SKINNING_KNIFE, HIGH_HIDES_PER_DAY } from '../src/net/professionLaw.js';
import { createBodyStamps, bodiesHere, huntKind } from '../src/scenes/huntHost.js';
import { createGatherHost, aimAt, ACT_STOPPED_LINE } from '../src/scenes/gatherHost.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { registerPlayerKillListener } from '../src/systems/playerKills.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { Foe } from '../src/systems/quest/foe.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const readQ = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readQ(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const QUEST = readQ(join(VENDOR, 'Quests', 'M0B00Y15.txt'));
const quiet = async (fn) => { const w = console.warn, l = console.log, i = console.info, e = console.error; console.warn = () => {}; console.log = () => {}; console.info = () => {}; console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; console.info = i; console.error = e; } };
const settle = async () => { for (let k = 0; k < 5; k++) await new Promise((r) => setTimeout(r, 0)); };

/** The quest's own Foe resource, by its symbol - the script's line through the Foe producer (Foe.setResource). */
function questFoe(symbol) {
  const line = QUEST.split(/\r?\n/).find((l) => l.startsWith(`Foe _${symbol}_ is `));
  assert.ok(line, `M0B00Y15 declares _${symbol}_`);
  const f = new Foe(null);
  f.setResource(line);
  return f;
}

// ─── THE POOL: createExteriorFoes, the factory makeInteriorFoes builds a building's pool with ───────────────────────
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 40, true); const at = [40, 50, 50, 85, 50, 50, 90, 55]; for (let k = 0; k < 8; k++) v.setUint16(58 + k * 2, at[k], true); return b; }
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let k = 0; k < name.length; k++) out[pos + k] = name.charCodeAt(k); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY003.CFG', craftCfg()]]);   // the Rat's career and the Giant Bat's
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const pe = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0,
  playerEntity: pe(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
});
/** The quest's foe stood in the building as tryPlaceInteriorQuestFoe stands it (its foeType, its behaviour), and felled
 *  by the player's own blow through the pool's damage door. */
async function questKill(p, foe, at) {
  const behaviour = { questUID: 7, targetSymbol: foe.symbol, bindHost() {}, start() {}, update() {} };
  const f = await quiet(() => p.spawnFoe(foe.foeType, at, { yaw: 0, questBehaviour: behaviour, feetGiven: true }));
  assert.ok(f, 'the pool stood the quest\'s foe');
  await quiet(() => p.damageFoe(f, 10_000, [0, 0, 0], null, { fromPlayer: true, kind: 'melee' }));
  assert.equal(f.dead, true, 'felled');
  return f;
}

const TODAY = 20_833, DAY_MS = 86_400_000;
const NOW = TODAY * DAY_MS + 3_600_000;
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const noWait = () => Promise.resolve();
async function bookOf(asked) {
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: TODAY, character: 'c1', tracks: [{ profession: 'hunting', xp: xpForRank(100), rank: 100, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000, withdraw: 200, highHides: HIGH_HIDES_PER_DAY }, hunt: { hides: 0, high: 0 } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return { ok: false, error: 'offline' }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOW, sleep: noWait });
  await book.refresh();
  return book;
}
/** world.js's foraging answer in a building (setForagingHost world): inside, the town's own rect and type around it. */
const IN_A_HOUSE = { inside: true, insideDungeon: false, insideCastle: false, locationType: 0, inLocationRect: true, hour: 12, climate: 231, region: 59, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };

test('INDOOR-SKIN: a quest\'s Giant Rat felled in a building is a body of the building\'s pool - stamped at the kill, listed where it lies, its loot by the building\'s key; the street\'s pool is never asked indoors, nor the building\'s outside', async () => {
  const rats = questFoe('rats'), bats = questFoe('monster');
  assert.deepEqual([rats.foeName, rats.foeType, bats.foeName, bats.foeType], ['Giant_rat', MOBILE_TYPES.Rat, 'Giant_bat', MOBILE_TYPES.GiantBat], 'the quest\'s rodents are DFU\'s Rat and Giant Bat');
  const stamps = createBodyStamps({ nowMs: () => NOW });
  registerPlayerKillListener('indoorskin', (e) => { stamps.stamp(e); });
  try {
    const building = pool(), street = pool();
    const rat = await questKill(building, rats, [3, 0, 4]);
    const bat = await questKill(building, bats, [5, 0, 1]);
    await settle();
    assert.ok(stamps.of(rat.entity) && stamps.of(bat.entity), 'the building\'s pool told the player\'s kills');
    const here = bodiesHere('interior', { street, dungeon: null, interior: building }, stamps);
    assert.deepEqual(here.map((b) => [b.foe, b.hide, b.tier]), [[MOBILE_TYPES.Rat, 'hide:rat', 1], [MOBILE_TYPES.GiantBat, 'hide:bat', 2]], 'both bodies, each its hide');
    assert.deepEqual(here.map((b) => b.at()), [building.corpseAt(rat), building.corpseAt(bat)], 'where each lies (the pool\'s own lens)');
    assert.deepEqual(here.map((b) => b.lootKey()), [building.corpseKeyOf(rat), building.corpseKeyOf(bat)], 'each its loot\'s key in the building\'s pool');
    assert.match(here[0].lootKey(), /^foeCorpse:/);
    assert.deepEqual(bodiesHere('exterior', { street, dungeon: null, interior: building }, stamps), [], 'on the street, the street\'s dead alone');
    assert.deepEqual(bodiesHere('interior', { street: building, dungeon: null, interior: null }, stamps), [], 'a building with no pool standing has no bodies - never the street\'s');
    assert.deepEqual(bodiesHere('dungeon', { street: building, dungeon: { foes: [] }, interior: building }, stamps), [], 'underground, the dungeon\'s');
  } finally { registerPlayerKillListener('indoorskin', null); }
});

test('INDOOR-SKIN: in a building the gathering host finds the body (its loose nodes alone, the building\'s walls asked), E starts the knife\'s trace and the harvest names the rat; the act ends under a window and at the building\'s door', async () => {
  setForagingHost({ world: () => IN_A_HOUSE });
  const stamps = createBodyStamps({ nowMs: () => NOW });
  registerPlayerKillListener('indoorskin', (e) => { stamps.stamp(e); });
  const asked = [], cleared = [];
  const book = await bookOf(asked);
  const building = pool();
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: (m) => { said.meter = m; }, toast: (x) => said.push(x), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  let indoors = true, windowUp = false;   // the mode the pools answer by, and a window over the building (world.js activeInterior's overlay terms)
  const eyePos = () => [feet[0], feet[1] + 1.6, feet[2]];
  const host = createGatherHost({
    book, hud, kinds: [huntKind({ book, bodies: () => bodiesHere(indoors ? 'interior' : 'exterior', { street: null, interior: building }, stamps) })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: 231, region: 59 }), nowMs: () => NOW,
    eye: () => ({ pos: eyePos(), dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => ({ items: [{ templateIndex: SKINNING_KNIFE.templateIndex, name: 'Skinning Knife', currentCondition: 50, maxCondition: 50 }] }),
    keyLabel: () => 'E', input: () => input,
    clear: (from, to, underground, interior) => { cleared.push([underground, interior]); return true; },
    // world.js: the street's host is off in a building, a dungeon's too - the building's own gate
    active: () => false, activeDungeon: () => false, activeInterior: () => indoors && !windowUp,
  });
  try {
    const rat = await questKill(building, questFoe('rats'), [0, 0, 2]);
    await settle();
    const lookAt = () => { const p = building.corpseAt(rat); const at = aimAt(eyePos(), [p[0], p[1] + 0.2, p[2]], { yaw: 0, pitch: 0 }); view.yaw = -at.yaw; view.pitch = -at.pitch; return at; };
    lookAt();
    host.tick(0.016);
    assert.equal(host.target?.node.kind, 'body', 'the rat\'s body is a node in the building');
    assert.equal(host.target?.interior, true, 'found as the building\'s');
    assert.deepEqual(cleared.at(-1), [false, true], 'seen through the building\'s own walls, not the street\'s collider');
    assert.deepEqual(host.hoverName(`prof:${host.target.node.key}`)?.actions?.[0], { id: 'hide', label: 'Skin the Rat' }, 'the list offers the knife');
    assert.equal(host.press(), true, 'E is the knife\'s');
    assert.equal(host.acting(), true, 'the trace plays');
    host.tick(0.001);
    host.tick(1.3);
    const pts = said.meter.state.points;
    const at0 = lookAt();
    for (let i = 0; i <= 40; i++) {
      const u = (i / 40) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u)), t = u - k;
      view.yaw = -at0.yaw + pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
      view.pitch = -at0.pitch + pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
      input = { held: true, attack: false, choice: false };
      host.tick(0.05);
    }
    await settle();
    assert.equal(asked.length, 1, 'the harvest asked');
    assert.equal(asked[0].foe, MOBILE_TYPES.Rat, 'it names the rat');
    assert.deepEqual([asked[0].climate, asked[0].region], [null, null], 'a body names no ground, indoors too');
    // a second rat, its act begun - the door out ends it, nothing taken
    input = { held: false, attack: false, choice: false };
    const rat2 = await questKill(building, questFoe('rats'), [1, 0, 2]);
    await settle();
    { const p = building.corpseAt(rat2); const at = aimAt(eyePos(), [p[0], p[1] + 0.2, p[2]], { yaw: 0, pitch: 0 }); view.yaw = -at.yaw; view.pitch = -at.pitch; }
    host.tick(0.016);
    assert.equal(host.target?.node.foe, MOBILE_TYPES.Rat);
    assert.equal(host.press(), true);
    // a window over the building - the body still lies there, the act is over all the same
    windowUp = true;
    host.tick(0.016);
    assert.equal(host.acting(), false, 'a window over the building ends the act');
    assert.equal(said.at(-1), ACT_STOPPED_LINE, 'and says so');
    windowUp = false;
    host.tick(0.016);
    assert.equal(host.press(), true, 'begun again');
    indoors = false;
    host.tick(0.016);
    assert.equal(host.acting(), false, 'out of the building, the act is over');
    assert.equal(said.at(-1), ACT_STOPPED_LINE, 'and says so');
    host.tick(0.016);
    assert.equal(host.target, null, 'and the building\'s bodies are no node on the street');
  } finally { registerPlayerKillListener('indoorskin', null); host.dispose(); setForagingHost(null); }
});

test('INDOOR-SKIN: in a building the street\'s pixels stand no node - a wilderness node stood round the house is the street\'s target and never the building\'s', async () => {
  setForagingHost({ world: () => IN_A_HOUSE });
  const book = await bookOf([]);
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  let indoors = false;
  // a node of the ground two metres ahead, on a pixel the street stood (the kind's own nodesOf - a patch's, a vein's)
  const ground = { id: 'patch', professions: ['herbalism'], nodesOf: () => [{ key: 'herb:1:1:0', local: [0, 0, 2], lift: 0.3 }], flatsOf: () => [], gone: () => false,
    plan: () => ({ harvest: 'herb', verb: 'Gather', rest: '', ready: true, profession: 'herbalism' }), start: () => null, cleanNote: () => '', title: () => 'Herbalist' };
  const entry = { px: 1, py: 1, samples: {}, tilemap: {}, batches: [] };
  const host = createGatherHost({
    book, hud, kinds: [ground],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map([['1,1', entry]]),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: 231, region: 59 }), nowMs: () => NOW,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, -0.6, 0.8] }), view: () => ({ yaw: 0, pitch: -37 }), feet: () => [0, 0, 0], entity: () => ({ items: [] }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => !indoors, activeDungeon: () => false, activeInterior: () => indoors,
  });
  try {
    host.onBuilt(entry);
    await settle();
    host.tick(0.016);
    assert.equal(host.target?.node.key, 'herb:1:1:0', 'on the street, the patch is the target');
    indoors = true;
    host.tick(0.016);
    assert.equal(host.target, null, 'in the building, no node of the street\'s ground');
  } finally { host.dispose(); setForagingHost(null); }
});

test('INDOOR-SKIN wiring, the four hosts: the streaming world lists a building\'s bodies from its own pool and opens their loot by its door, its gathering host live indoors through the building\'s walls; the building\'s ladder, plaque, rig and swing are the professions\' as the dungeon\'s are; the dungeon stays wired; the fixed city stands no professions (FLAGGED)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /huntBodies = \(\) => bodiesHere\(modeNow\(\), \{ street: exteriorFoes, dungeon: modes\?\.dungeonCtx, interior: modes\?\.interiorFoes \}, bodyStamps\);/, 'world.js: the bodies by the mode\'s pool');
  assert.match(w, /const openHuntLoot = \(key\) => \(modeNow\(\) === 'interior' \? modes\?\.openInteriorBody\?\.\(key\)\n/, 'world.js: a building\'s body searched through the building\'s door');
  assert.match(w, /activeInterior: \(\) => walkMode && modeNow\(\) === 'interior' && !modes\?\.overlayHeld && !townTalk\.overlayActive && !modes\?\.deathUp\?\.\(\) && !modes\?\.transitioning,/, 'world.js: the gathering host live in a building');
  assert.match(w, /const c = underground \? modes\?\.dungeonCtx\?\.collider : interior \? modes\?\.interiorCollider : collider;/, 'world.js: a building\'s walls');
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /function makeInteriorFoes\(ctx\) \{[\s\S]{0,4000}?createExteriorFoes\(/, 'worldModes.js: a building\'s pool is the street\'s factory (the pins above drive it)');
  assert.match(m, /get interiorFoes\(\) \{ return interiorFoes; \},/, 'worldModes.js: the building\'s pool handed out');
  assert.match(m, /openInteriorBody: \(key\) => \{ if \(interiorCtx && typeof key === 'string'\) openInteriorBodyLoot\(key\); \},/, 'worldModes.js: and its bodies\' door');
  const ladder = m.slice(m.indexOf('  function tryExit({'), m.indexOf('  function tryExitDungeon('));
  assert.match(ladder, /^ {2}function tryExit\(\{ pressCast = false, interact = false, actClick = false \} = \{\}\) \{\n/, 'the building\'s ladder reads the Interact press and the act\'s click');
  for (const [re, what] of [
    [/\n {4}if \(interact && !pressCast && host\.profPress\?\.\(\)\) return true;\n/, 'E offered to a node first'],
    [/\n {4}if \(!interact && !pressCast && !actClick && !host\.profActing\?\.\(\) && host\.profClick\?\.\(\)\) return true;\n/, 'the click on a node\'s lit row'],
    [/\n {4}if \(!interact && \(actClick \|\| host\.profActing\?\.\(\)\)\) return true;\n/, 'a click mid-act the act\'s'],
    [/if \(key === null\) \{ if \(interact && !pressCast\) host\.profNeed\?\.\(\); return false; \}/, 'a node\'s need said where nothing took E'],
  ]) {
    assert.match(ladder, re, `the building's ladder: ${what}`);
    assert.ok(ladder.search(re) < ladder.indexOf('const qf = pickQuestFoe(') || what.startsWith('a node\'s need'), `${what} - before the quest click (one press never clicks a quest foe AND starts an act)`);
  }
  assert.match(m, /return host\.profHoverPick\?\.\(ray\) \?\? ray;   \/\/ INDOOR-SKIN/, 'the building\'s plaque picks a node over the race\'s winner');
  assert.match(m, /const interiorHoverName = composeNamer\(\[\n {4}\(key\) => host\.profHoverName\?\.\(key\) \?\? null,/, 'and names its acts first');
  assert.match(m, /const interiorWeapon = createWeaponRig\(\{[\s\S]{0,3000}?actTool: \(\) => host\.profActTool\?\.\(\) \?\? null,/, 'the building\'s rig draws the knife');
  assert.match(m, /mode === 'interior' \? \(\(dx, dy, held\) => \{ if \(held && host\.profActing\?\.\(\)\) return;/, 'and an act\'s press is no swing');
  // the dungeon: its ladder, plaque and rig as PROF2 wired them
  assert.match(m, /function tryExitDungeon\([^\n]*\n[\s\S]{0,1200}?if \(interact && !pressCast && host\.profPress\?\.\(\)\) return true;/, 'dungeonContext.js through worldModes.js: still wired');
  assert.match(src('src/scenes/dungeonContext.js'), /return opts\.profHoverPick\?\.\(ray\) \?\? ray;/, 'dungeonContext.js: its plaque');
  // the fixed city: no professions at all (FLAGGED - 17.1, 29)
  assert.doesNotMatch(src('src/scenes/exterior.js'), /createGatherHost|huntKind|profPress/, 'exterior.js: the fixed city stands no professions');
});
