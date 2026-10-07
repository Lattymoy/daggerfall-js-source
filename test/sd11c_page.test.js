// SD11c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II): THE
// HOSTS, THE PAGE AND THE REWARDS, AUDITED AGAIN - each finding reproduced before it was fixed. The Hollow's end cast a
// resting player out with the rest window still holding `isResting`; a player dead at the end and raised where they lay
// was latched as cast out, and stood in an ended Hollow for good; a step under the veil could land in a Hollow or an Hour
// the end had already taken down; a receipt the hub's link handed while I stood in my Hour went straight to the pack and
// the floor said "No spoils"; the Hour's cast-out took no veil, and its death woke with a plain dungeon's words; the
// Inspect card never said the towns, the serpents or the Hours; a spent word that could not go was never said again; the
// claims book held eight receipts for the whole device; the Ghost-King's Vigil healed on top of a death a save had turned
// aside; the floor's last spoils were said over the way home's line; the Rift forgot at a reload who had gone through it;
// the way back from the Hour stood a player on the Return's own foot; a mark or save in a Hollow gone since entered the
// nearest dungeon. With them, the page's untested arms (the lens on the tests): the whole state folded in the shadow, the
// world host's fight seams run from their own text, the End in the Dragon Break, and the smaller gaps.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdHost } from '../src/scenes/sdHost.js';
import { sdCities, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, sdFoundLine, SD_COLLAPSE_MS, SD_CAST_OUT_LINE, SD_NO_CLOSED, isSdRoom, sdRoomKey } from '../src/net/sdLaw.js';
import { sdRiftWord, sdReturnStands, sdRiftCount, sdRiftPlace, sdReturnPlace, sdLandingPlace, inSdPortal, SD_LANDING_PAST_M, SD_RETURN_REACH_M, SD_ENTERED_KEY, SD_ENTERED_MAX } from '../src/world/sdDungeon.js';
import { SD_REALM_TEXT } from '../src/world/sdRealm.js';
import { createSpoilsPool, spoilsStore, spoilsLevel, SPOILS_SPENT_RESEND_MS, SPOILS_SPENT_MAX, SPOILS_KEYS } from '../src/scenes/spoilsPool.js';
import { createSdClaims, SD_CLAIMS_MAX, SD_CLAIMS_ALL_MAX } from '../src/net/sdClaims.js';
import { createDuelRecords } from '../src/net/duelRecord.js';
import { profileView, profileRenown, profileDuelLine, profileGateLine, profileRaidLine, profileSerpentLine, profileSdLine } from '../src/ui/profileWindow.js';
import { mintSdReceipt, readSdReceipt } from '../src/net/sdReceipt.js';
import { sdSpoilsDay, sdSpoilsList, SD_SPOILS_TEXT } from '../src/systems/sdSpoils.js';
import { SOCIAL_ROOM, validSdOut } from '../src/net/wire.js';
import {
  newRemnantFight, joinRemnant, stepRemnant, applyRemnantHit, applyEchoHit, applyHeartHit, heartsOpen, remnantStateOf,
  SD_PHASE_AT, SD_OPENING_MS, SD_BREAK_MS, SD_BLOWS, SD_BODY,
} from '../src/net/sdRemnant.js';
import { HIT_KINDS, dpsRef } from '../src/net/gateBrain.js';
import { SD_FIGHT_EMPTY, SD_FIGHT_TEXT, foldSdFight, createSdFightLink, sdBodyAt, sdBlowDone, sdHeartsOf } from '../src/net/sdFightLink.js';
import { sdBlowsInFlight } from '../src/scenes/sdRemnantBlows.js';
import { SD_BAR_TEXT } from '../src/ui/sdRemnantBar.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as LP from '../src/systems/lootPowers.js';
import { _resetSetPowersForTests } from '../src/systems/sigilSetPowers.js';
import { _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { dungeonStartDoorFor } from '../src/systems/save.js';
import { respawnFlavorText } from '../src/systems/deathRespawn.js';
import { SD_FIGHT_TEXT as FIGHT_WORDS } from '../src/net/sdFightLink.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const tick = () => new Promise((r) => setImmediate(r));
const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = warn; } };
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const M = 60_000, H = 3_600_000, T0 = 1_800_000_000_000;
const W = read('src/scenes/world.js');
const WM = read('src/scenes/worldModes.js');
/** A `function name(` of a host's own (two-space indent), its text. */
const fnIn = (src, name) => { const at = src.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return src.slice(at + 1, src.indexOf('\n  }\n', at) + 4); };
const fnOf = (name) => fnIn(W, name);
/** A `const name = (` of world.js's own, its text (an arrow whose body closes `\n  };`). */
const constOf = (name) => { const at = W.indexOf(`\n  const ${name} = `); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  };\n', at) + 5); };
/** A property of world.js's Hollow host (createSdHost's own arguments), its arrow's text - one line, or a block. */
function hostProp(name) {
  const from = W.indexOf('const sdHost = params.has(\'online\') ? createSdHost({');
  assert.ok(from > 0, 'the Hollow host');
  const at = W.indexOf(`\n    ${name}: `, from);
  assert.ok(at > 0, name);
  const head = `    ${name}: `;
  const line = W.slice(at + 1, W.indexOf('\n', at + 1));
  if (/=> \{\s*(\/\/.*)?$/.test(line)) return W.slice(at + 1 + head.length, W.indexOf('\n    },', at) + 6);
  return line.slice(head.length).replace(/\s*\/\/.*$/, '').replace(/,\s*$/, '');
}
/** An expression's value over `env`'s names. */
const evalIn = (expr, env) => new Function(...Object.keys(env), `return (${expr});`)(...Object.values(env));

// ── the fixture world (SD2d's own) ─────────────────────────────────────
const T = LOCATION_TYPES;
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});
function world(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return { regionCount: 2, getRegion: (r) => regions[r], getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231), getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)), getRegionIndexAt: (x) => (x < 500 ? 0 : 1) };
}
const CITY = place(0, 0, 300, 200, T.TownCity, { name: 'Copperham', w: 3, h: 3, buildings: 80 });
const LAB = place(0, 1, 450, 400, T.DungeonLabyrinth, { name: 'The Old Maze', blocks: 14 });
const SCAN = scanGatePixels(world([CITY, LAB]), { heightAt: () => 90 });

/**
 * The real Hollow host over world.js's own castOut, inside and standing (from their text), on a page whose mode machine
 * the test sets: `s.mode`, `s.loc` (the dungeon I stand in), `s.dead` / `s.deathUp`, and whether the machine's way out
 * takes the word (`s.exits`).
 */
function hollowRig({ templates = () => sdTemplates([LAB], isMainStoryDungeon), regionName = () => '' } = {}) {
  const s = { clock: T0, mode: 'exterior', loc: null, health: 50, deathUp: false, exits: true, realmSlot: null };
  const log = [];
  const playerEntity = { get health() { return s.health; } };
  const modes = {
    get mode() { return s.mode; }, get dungeonLocation() { return s.loc; }, deathUp: () => s.deathUp, sdRealmSlot: () => s.realmSlot,
    unstuck: () => { log.push('unstuck'); return s.exits; },
  };
  const env = { playerEntity, modes, setMidScreenText: (t) => log.push(['said', t]), sdSay: (t) => log.push(['said', t]), SD_CAST_OUT_LINE, gateVeil: { flash: () => log.push('veil') } };
  const castOut = evalIn(hostProp('castOut'), env);
  const inside = evalIn(hostProp('inside'), env);
  const standing = evalIn(hostProp('standing'), env);
  const host = createSdHost({
    now: () => s.clock, scan: () => SCAN, cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }), templates,
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }), stand: () => {}, unstand: (k) => log.push(['unstand', k]),
    inside, door: () => null, feet: () => null, sendFound: () => true, say: (t) => log.push(['line', t]), regionName,
    castOut: (key) => { log.push(['castOut', key]); return castOut(key); }, standing,
  });
  return { s, log, host };
}
/** A Hollow risen, found, felled and gone - its end at `s.clock` (with `inside` standing in it as each frame runs). */
function endOf(rig, { stand = (h) => { rig.s.mode = 'dungeon'; rig.s.loc = { sdSlot: h.s, name: h.loc.name }; } } = {}) {
  const { s, host } = rig;
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...r }); host.frame();
  const h = host.hollow();
  stand(h);
  const f = sdFind(r, T0, 'Mara'); host.heard({ k: 'ev', ...f }); host.frame();
  const k = sdFell(f, T0 + H, { top: 'Mara', n: 3 }); host.heard({ k: 'ev', ...k });
  s.clock = T0 + H + SD_COLLAPSE_MS;
  host.heard({ k: 'ev', ...sdGone(k, s.clock) });
  return { r, f, k, h };
}

// ── L1 F1: the cast-out closes the window ──────────────────────────────

test('SD11c THE CAST-OUT CLOSES THE WINDOW (L1 F1): the Hollow\'s end casts out through the dungeon\'s own way out (`unstuck`, drained at the modal frame\'s safe point whatever window holds the slot) - and that way out now pops the slot\'s window as forceExitToExterior does: a rest left `isResting` up for good (no fatigue drain, held enchantments eating their items at the rest\'s rate), and an open pack painted over the street with its hooks on a context destroyed (mutants: the window left standing)', () => {
  const exitText = fnIn(WM, 'exitDungeonNow');
  const at = WM.indexOf('    unstuck: () => {');
  const unstuckText = WM.slice(at, WM.indexOf('\n    },', at) + 7);
  const drainLine = WM.split('\n').find((l) => l.includes('if (pendingDungeonExit) { pendingDungeonExit = false; if (aliveUnder()) { exitDungeonNow(); return true; } }'));
  assert.ok(unstuckText.includes('pendingDungeonExit = true; return true;') && drainLine, 'the texts found');
  // the page: in the Hollow, RESTING - the dungeon's rest window holds the slot (scenes/shared.js setResting(true) at its
  // open; ui/restWindow.js clears it in its own dispose)
  const playerEntity = { health: 50, isResting: true };
  const rest = { disposed: 0, dispose() { this.disposed++; playerEntity.isResting = false; } };
  const log = [];
  const ctx = { overlayWindow: () => rest, deathUp: () => false, destroy() { log.push('destroyed'); }, camps: { packOwnFires: () => 0 } };
  const env = {
    ctx, playerEntity, unleveledLootPreTransition: () => {}, returnLanding: () => ({ pos: [0, 0, 0], normal: [0, 0, 1] }), dungeonPose: () => null,
    host: {}, teardownDungeonQuestFlats: () => {}, say: () => {}, CAMP_TEXT: {}, destroyWorldPlaque: () => {},
    rrDouseOnDungeonExit: () => null, isDayFromMinutes: () => true, skyMinutes: () => 0, townTalk: null, ActionTextBox: class {}, expandItemMacro: () => '', USE_TEXT: {},
    mwViewTransition: () => {}, immersiveFootsteps: { onTransitionExterior() {} }, betterAmbience: { onTransition() {} }, questBridge: null, npcSession: null,
    player: { spawn() {}, collider: null, eyeAt: () => [0, 0, 0] }, baseCollider: () => ({ heightAt: () => 0 }), repositionFeetY: (h, y) => y, cam: {},
  };
  const body = `
    let mode = 'dungeon', dungeonCtx = ctx, dungeonLoc = { sdSlot: 1 }, pendingDungeonExit = false, pendingDungeonWagonOpen = false, crownHall = null;
    const aliveUnder = () => playerEntity.health > 0 && !dungeonCtx?.deathUp?.();
    const setMode = (m) => { mode = m; };
    ${exitText}
    const api = { ${unstuckText} };
    function dungeonFrame() { if (mode === 'dungeon') {\n${drainLine.trim()}\n} return 'drew'; }
    return { api, dungeonFrame, mode: () => mode };`;
  const machine = new Function(...Object.keys(env), body)(...Object.values(env));
  assert.equal(machine.api.unstuck(), true, 'the end\'s word: the way out asked');
  assert.equal(playerEntity.isResting, true, 'nothing yet - drained at the frame');
  assert.equal(machine.dungeonFrame(), true, 'drained under the rest window');
  assert.equal(machine.mode(), 'exterior');
  assert.deepEqual([rest.disposed, playerEntity.isResting, log], [1, false, ['destroyed']], 'the window popped before the context went');
  const ex = exitText.indexOf('dungeonCtx.overlayWindow?.()?.dispose?.();'), de = exitText.indexOf('dungeonCtx.destroy();');
  assert.ok(ex > 0 && ex < de, 'OnPop before the destroy');
  // one law for both doors out: forceExitToExterior's own line, unchanged
  assert.match(WM, /dungeonCtx\.overlayWindow\?\.\(\)\?\.dispose\?\.\(\);   \/\/ the same OnPop, for the dungeon context's own slot/);
});

// ── L1 F2, F9: cast out once it acts, under the Hour's veil ───────────

test('SD11c CAST OUT ONCE IT ACTS (L1 F2, F9): a player dead in the Hollow at its end is the death\'s - the host asks again each frame, and casts them out the frame a Resurrect raises them where they lay (it latched "cast out" on the refused word, and the risen stood in an ended Hollow for good); once out, never again; out of the Hour, under its veil, as every other way out of it (mutants: latched on the refusal; asked every frame after it acted; no veil)', () => {
  const a = hollowRig();
  a.s.health = 0; a.s.deathUp = true;
  endOf(a);
  a.host.frame(); a.host.frame();
  assert.equal(a.log.filter((x) => x === 'unstuck').length, 0, 'dead: the death\'s door, never the way out');
  assert.equal(a.log.filter((x) => Array.isArray(x) && x[0] === 'castOut').length, 2, 'asked again, each frame');
  // a party member's Resurrect lands (world.js resurrectInPlace: revived, the death screen closed - no exit)
  a.s.health = 30; a.s.deathUp = false;
  a.host.frame();
  assert.equal(a.log.filter((x) => x === 'unstuck').length, 1, 'risen where they lay: cast out');
  assert.deepEqual(a.log.at(-1), ['said', SD_CAST_OUT_LINE]);
  assert.ok(!a.log.includes('veil'), 'out of the Hollow: no veil (its door is a dungeon\'s)');
  const n = a.log.length;
  a.host.frame(); a.host.frame();
  assert.equal(a.log.length, n, 'once it acted: never again');
  // in the Hour when it ends: the veil, then the line
  const b = hollowRig();
  endOf(b, { stand: (h) => { b.s.mode = 'dungeon'; b.s.loc = { sdRealm: h.s, name: 'The Shattered Hour' }; b.s.realmSlot = h.s; } });
  b.host.frame();
  const u = b.log.indexOf('unstuck');
  assert.ok(u >= 0, 'cast out of the Hour');
  assert.deepEqual(b.log.slice(u, u + 3), ['unstuck', 'veil', ['said', SD_CAST_OUT_LINE]], 'through the veil');
  // a way out the mode machine would not take (no context): asked again, nothing said
  const c = hollowRig();
  c.s.exits = false;
  endOf(c);
  c.host.frame(); c.host.frame();
  assert.equal(c.log.filter((x) => x === 'unstuck').length, 2, 'refused: asked again');
  assert.ok(!c.log.some((x) => Array.isArray(x) && x[0] === 'said'), 'and nothing said');
});

test('SD11c THE END JUDGED WHERE I STAND (L1 F3): a step under the veil - into the Hour, or back into its Hollow - that lands after the end took the Hollow down is cast out on the frame it lands, once; a Hollow or Hour that still stands keeps me; a page that has heard no record judges nothing (mutants: never judged; judged before the hub\'s word; cast out of a standing Hollow)', () => {
  const a = hollowRig();
  const { h } = endOf(a, { stand: () => {} });   // outside when it ends: taken down, nobody cast out
  a.host.frame();
  assert.ok(a.log.some((x) => Array.isArray(x) && x[0] === 'unstand'), 'taken down');
  assert.equal(a.log.filter((x) => x === 'unstuck').length, 0);
  // the step lands in its Hour now - built under the veil while the end came
  a.s.mode = 'dungeon'; a.s.loc = { sdRealm: h.s, name: 'The Shattered Hour' }; a.s.realmSlot = h.s;
  a.host.frame();
  assert.deepEqual(a.log.filter((x) => Array.isArray(x) && x[0] === 'castOut').map((x) => x[1]), [`slot:${h.s}`], 'cast out where I stand');
  assert.equal(a.log.filter((x) => x === 'unstuck').length, 1);
  a.host.frame();
  assert.equal(a.log.filter((x) => x === 'unstuck').length, 1, 'once');
  // a standing Hollow keeps whoever stands in it
  const b = hollowRig();
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  b.host.heard({ k: 'ev', ...r }); b.host.frame();
  b.s.mode = 'dungeon'; b.s.loc = { sdSlot: r.s, name: 'x' };
  for (let i = 0; i < 3; i++) b.host.frame();
  assert.equal(b.log.filter((x) => x === 'unstuck').length, 0, 'it stands: kept');
  // a page that has heard nothing yet (a Recall into a Hollow on a fresh page): no end known, nothing judged
  const c = hollowRig();
  c.s.mode = 'dungeon'; c.s.loc = { sdSlot: 9, name: 'x' };
  c.host.frame();
  assert.equal(c.log.filter((x) => x === 'unstuck').length, 0, 'no record heard: nothing judged');
  c.host.heard({ k: 'ev', ...r });   // the hub's word: slot 1 risen - slot 9 is no Hollow now
  c.host.frame();
  assert.equal(c.log.filter((x) => x === 'unstuck').length, 1, 'the record heard: an ended one casts out');
});

// ── L1 F3 (the step), the latent site guard, L6 F17 (the Rift's memory) ─

/** world.js's Rift memory (its own text) over `storage`. */
function enteredOf(storage) {
  const at = W.indexOf('\n  const sdSlotsKept = (key) => {');   // SD-ONELIFE (PIN MOVED): one memory for the slots entered and died in
  assert.ok(at > 0, 'sdSlotsKept');
  const text = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  assert.match(W, /\n  const _sdEntered = sdSlotsKept\(SD_ENTERED_KEY\);\n/);
  return new Function('appStorage', 'SD_ENTERED_KEY', 'SD_ENTERED_MAX', `${text}\nreturn sdSlotsKept(SD_ENTERED_KEY);`)(() => storage, SD_ENTERED_KEY, SD_ENTERED_MAX);
}
const memStorage = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

/** world.js's Rift and its step through, from its own text (SD5a's harness) - the record moving under the walk. */
function riftHost({ rec, hollow, storage = memStorage(), entered = true } = {}) {
  const log = [];
  let step = null;
  const h = { rec };
  const modes = {
    mode: 'dungeon', dungeonLocation: null, stepThroughFire: (go) => { step = go; },
    forceExitToExterior: () => log.push('out'), enterSdRealm: async () => { log.push('realm'); return entered; },
  };
  const env = {
    sdHost: { record: () => h.rec, hollow: () => hollow }, _sharedOffsetMs: 0, sdRiftWord, sdReturnStands, sdRiftCount, modes, playerEntity: { health: 10 },
    INTERIOR_SEASON: 3, SD_REALM_TEXT, setMidScreenText: (t) => log.push(['said', t]), sdSay: (t) => log.push(['said', t]), _sdEntered: enteredOf(storage), _sdFallen: new Set(),   // SD-ONELIFE (PIN MOVED)
    _teleportToPixel: async () => { log.push('pixel'); if (h.onWalk) h.rec = h.onWalk; },
  };
  const body = `${constOf('sdRiftOf')}\n${fnOf('sdEnterRealm')}\nreturn { sdRiftOf, sdEnterRealm };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  return { ...api, log, h, storage, entered: env._sdEntered, run: () => step?.(), stepped: () => step != null };
}

test('SD11c THE STEP ASKS AGAIN AFTER THE WALK, AND THE RIFT REMEMBERS ACROSS A RELOAD (L1 F3, the site guard, L6 F17): the Rift\'s word is asked again once the walk to the Hollow\'s pixel is done - an end that overtook it refuses the Hour there; a Hollow known by another slot\'s memo (no site) is never stepped from; who went through is kept on the device, the last SD_ENTERED_MAX slots - a reload no longer forgets it, and a store that will not read or write keeps it in the session (mutants: asked before the walk alone; the site unguarded; the memory the session\'s)', async () => {
  const found = { s: 7, ph: 'found', r: 3, at: T0 - 60_000, until: T0 + 3_600_000, next: T0 + 9_000_000 };
  const hollow = { s: 7, key: 'k', site: { px: 303, py: 202 }, loc: { name: 'The Hollow', regionName: 'Daggerfall' } };
  const realNow = Date.now;
  Date.now = () => T0 + 1000;
  try {
    // the kill overtakes the walk - the Hour closed to a newcomer: refused outside, at its pixel
    const a = riftHost({ rec: found, hollow });
    a.h.onWalk = sdFell(found, T0 + 500, { top: 'Ann', n: 2 });
    assert.equal(a.sdEnterRealm(7), true);
    assert.equal(await a.run(), false);
    assert.deepEqual(a.log, ['out', 'pixel', ['said', SD_NO_CLOSED]], 'asked again after the walk: refused, never built');
    assert.equal(a.entered.has(7), false);
    // no site: never stepped from
    const b = riftHost({ rec: found, hollow: { s: 7, key: 'k', loc: { name: 'x' } } });
    assert.equal(b.sdEnterRealm(7), false);
    assert.equal(b.stepped(), false);
    // through: remembered on the device - a reload (a new memory over the same store) still knows it
    const storage = memStorage();
    const c = riftHost({ rec: found, hollow, storage });
    c.sdEnterRealm(7);
    assert.equal(await c.run(), true);
    assert.deepEqual(JSON.parse(storage.getItem(SD_ENTERED_KEY)), [7]);
    const reloaded = riftHost({ rec: sdFell(found, T0, { top: 'Ann', n: 2 }), hollow, storage });
    assert.equal(reloaded.sdRiftOf(7).word, null, 'in its collapse, after a reload: admitted again');
    assert.equal(riftHost({ rec: sdFell(found, T0, { top: 'Ann', n: 2 }), hollow }).sdRiftOf(7).word, SD_NO_CLOSED, 'another device: a newcomer');
  } finally { Date.now = realNow; }
  // the last few, the oldest out; a store that throws or holds junk
  const st = memStorage();
  const e = enteredOf(st);
  for (let s = 1; s <= SD_ENTERED_MAX + 3; s++) e.add(s);
  assert.equal(SD_ENTERED_MAX, 8);
  assert.deepEqual(JSON.parse(st.getItem(SD_ENTERED_KEY)), Array.from({ length: SD_ENTERED_MAX }, (_, i) => i + 4), 'the last eight');
  assert.equal(enteredOf(st).has(3), false);
  assert.equal(enteredOf(st).has(11), true);
  st.setItem(SD_ENTERED_KEY, '{"junk": true');
  assert.equal(enteredOf(st).has(4), false, 'junk: nothing, never a throw');
  st.setItem(SD_ENTERED_KEY, JSON.stringify([5, 'x', 2.5, 6]));
  const kept = enteredOf(st);
  assert.deepEqual([kept.has(5), kept.has(6), kept.has('x'), kept.has(2.5)], [true, true, false, false], 'slots alone');
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const mem = enteredOf(broken);
  mem.add(9);
  assert.equal(mem.has(9), true, 'a store that refuses: the session holds it');
  const none = enteredOf(null);
  none.add(4);
  assert.equal(none.has(4), true);
});

// ── L6 F18: the way back stands me past the Return ────────────────────

/** An axis-aligned hall (SD4b's): x in [x0, x1], z in [z0, z1], its floor at y0. */
function hall({ x0 = 0, x1 = 10, z0 = 0, z1 = 10, y0 = 0, h = 8 } = {}) {
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  return {
    floor: (at) => (inside(at[0], at[2]) ? y0 : null),
    ray: (o, dir, max) => {
      let t = Infinity;
      if (dir[0] > 0) t = Math.min(t, (x1 - o[0]) / dir[0]); else if (dir[0] < 0) t = Math.min(t, (x0 - o[0]) / dir[0]);
      if (dir[2] > 0) t = Math.min(t, (z1 - o[2]) / dir[2]); else if (dir[2] < 0) t = Math.min(t, (z0 - o[2]) / dir[2]);
      if (dir[1] > 0) t = Math.min(t, (y0 + h - o[1]) / dir[1]); else if (dir[1] < 0) t = Math.min(t, (o[1] - y0) / -dir[1]);
      return t <= max ? t : null;
    },
  };
}

test('SD11c THE WAY BACK STANDS ME PAST THE RETURN (L6 F18): one back from the Hour is stood SD_LANDING_PAST_M on from the Return, along the line from the Rift through it - outside the Return\'s reach and farther from the Rift than it (it stood them on the Return\'s own foot: one step off and back carried them home again); a wall there, the first bearing that leads away from the Rift; boxed in, the Return\'s foot; the dungeon host stands the Return at its own place and keeps the landing apart (mutants: on the Return\'s foot; toward the Rift; through the wall)', () => {
  const big = hall({ x1: 40, z1: 40, h: 12 });
  const rift = sdRiftPlace([20, 0, 20], big);
  const ret = sdReturnPlace(rift, big);
  const land = sdLandingPlace(rift, ret, big);
  assert.equal(SD_LANDING_PAST_M, 1.5);
  const dir = [ret[0] - rift.at[0], ret[2] - rift.at[2]], len = Math.hypot(...dir);
  assert.ok(near(land[0], ret[0] + (dir[0] / len) * 1.5) && near(land[2], ret[2] + (dir[1] / len) * 1.5) && land[1] === 0, JSON.stringify(land));
  assert.equal(inSdPortal(land, ret, SD_RETURN_REACH_M, 3), false, 'outside the Return\'s reach');
  assert.equal(inSdPortal(ret, ret, SD_RETURN_REACH_M, 3), true, 'its foot was inside it');
  assert.ok(Math.hypot(land[0] - rift.at[0], land[2] - rift.at[2]) > len, 'and farther from the Rift');
  // a wall just past a Return west of its Rift: east (the first bearing) leads back toward the Rift - passed over - and
  // the first that leads away is taken
  const west = { at: [20, 0, 20], size: 7 }, wret = [15, 0, 20];
  const t = sdLandingPlace(west, wret, hall({ x0: 14, x1: 40, z1: 40, h: 12 }));
  assert.ok(near(t[0], 15) && near(t[2], 21.5), `north, away: ${JSON.stringify(t)}`);
  assert.ok(Math.hypot(t[0] - 20, t[2] - 20) > 5, 'away from the Rift');
  // boxed in: its foot
  assert.deepEqual(sdLandingPlace({ at: [1, 0, 1], size: 2.6 }, [1.6, 0, 1], hall({ x1: 2, z1: 2 })), [1.6, 0, 1]);
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /_sdRetAt = sdReturnPlace\(rift, probe\);\n\s*_sdLanding = sdLandingPlace\(rift, _sdRetAt, probe\);\n\s*sdEnd\.stand\(\{ rift, retAt: _sdRetAt \}\);/);
  assert.match(D, /return _sdLanding \? \[_sdLanding\[0\], _sdLanding\[1\], _sdLanding\[2\]\] : null;/, 'the way back reads the landing');
});

// ── L1 F8: never a neighbour's door ────────────────────────────────────

test('SD11c A MARK IN A HOLLOW GONE ENTERS NOTHING (L1 F8): a save\'s or a Mark\'s dungeon whose pixel holds no dungeon of its own now (a Hollow taken down) enters nothing - every caller has its "all else fails" arm - never the first door in the stream (it entered the nearest dungeon, at the Hollow\'s position); its own door, and a door on its own pixel, as before (mutants: the first door kept)', () => {
  const NEIGHBOUR = { i: 1, group: 'g-next', door: { doorType: 2 }, dfLocation: { dungeon: { recordElement: { header: { locationId: 9 } } } } };
  const OWN = { i: 2, group: 'g-own', door: { doorType: 2 }, dfLocation: { dungeon: { recordElement: { header: { locationId: 4040 } } } } };
  assert.equal(dungeonStartDoorFor([NEIGHBOUR], null, 'dungeon:4040'), null, 'its dungeon gone: nothing');
  assert.equal(dungeonStartDoorFor([NEIGHBOUR], { group: 'g-gone' }, 'dungeon:4040')?.group, 'g-gone', 'a doorless site: the site itself');
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, OWN], null, 'dungeon:4040'), OWN, 'its own door');
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, OWN], { group: 'g-own' }, null), OWN, 'a door on its own pixel');
  assert.match(read('src/systems/save.js'), /\n  return here \?\? site \?\? null;\n\}/);
});

// ── L1 F4 / L5 C2: my Hour's receipt waits for its throw ──────────────

/** world.js's receipts, from its own text (SD10b's harness): kept in my realm, granted out of it. */
function receiptHost() {
  let slot = null;
  const grants = [];
  const env = {
    readSdReceipt, isSdRoom, modes: { sdRealmSlot: () => slot }, spoilsLevel, playerEntity: { level: 30 }, spoilsLock: (f) => Promise.resolve().then(f),
    sdSpoilsPool: { grant: (o) => { grants.push(o); return true; } }, sdSpoilsDay, sdSpoilsList, SD_SPOILS_TEXT, _sdReceipts: new Map(),
  };
  const body = `${fnOf('sdSpoilsReceipt')}\n${fnOf('grantSdSpoils')}\n${fnOf('sdReceiptsLeft')}\nreturn { sdSpoilsReceipt, sdReceiptsLeft };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  return { ...api, grants, kept: env._sdReceipts, at: (s) => { slot = s; } };
}
const unsigned = (d, s = 'acct-a') => mintSdReceipt({ d, s, c: 1234, x: 'dealt', l: 7 }, null, { subtle: globalThis.crypto.subtle, nowS: 1_700_000_000 });

test('SD11c MY HOUR\'S RECEIPT WAITS FOR ITS THROW, WHICHEVER LINK HANDS IT (L1 F4, L5 C2): standing in the Hour of its slot, a receipt the hub\'s own link handed (my realm\'s socket blinking at the kill) is kept for the burst as the realm\'s is - it went straight into the pack, and the floor then said "No spoils"; outside that Hour, straight into the pack, once (mutants: the hub\'s hand granted in my Hour)', async () => {
  const h = receiptHost();
  h.at(7);
  h.sdSpoilsReceipt(await unsigned(7), SOCIAL_ROOM);
  h.sdSpoilsReceipt(await unsigned(7), sdRoomKey(7));
  await tick();
  assert.deepEqual([h.grants.length, h.kept.size], [0, 1], 'in my Hour: kept for the burst, whichever link');
  h.sdSpoilsReceipt(await unsigned(8), SOCIAL_ROOM);
  await tick();
  assert.equal(h.grants.length, 1, 'another Hour\'s: into the pack');
  h.at(null);
  h.sdReceiptsLeft();
  await tick();
  assert.equal(h.grants.length, 2, 'left before the burst: into the pack');
  assert.doesNotMatch(strip(fnOf('sdSpoilsReceipt')), /isSdRoom/, 'the link never asked');
});

// ── L5 F1: the Inspect card says all four ─────────────────────────────

test('SD11c THE INSPECT CARD SAYS THE TOWNS, THE SERPENTS AND THE HOURS (L5 F1): the account service\'s one answer carries the duels, the gates, the towns defended, the serpents slain and the Hours broken - the page\'s reads kept only the first two, and no host laid the other three; now each is kept (a malformed count dropped) and the world host lays all off the same record (mutants: each dropped; each unlaid)', async () => {
  const recs = createDuelRecords({ read: async () => ({ ok: true, data: { wins: 4, losses: 1, gates: { closed: 2 }, raids: { defended: 3 }, serpents: { slain: 5 }, sds: { broken: 6 } } }), now: () => 0 });
  recs.get('acct-x');
  await tick();
  const rec = recs.get('acct-x');
  assert.deepEqual(rec, { wins: 4, losses: 1, gates: { closed: 2 }, raids: { defended: 3 }, serpents: { slain: 5 }, sds: { broken: 6 } });
  const bad = createDuelRecords({ read: async () => ({ ok: true, data: { wins: 1, losses: 0, raids: { defended: 1.5 }, serpents: { slain: '9' }, sds: null } }), now: () => 0 });
  bad.get('b');
  await tick();
  assert.deepEqual(bad.get('b'), { wins: 1, losses: 0 }, 'a malformed count: dropped');
  // the world host's card, from its own text
  const env = {
    profileRenown, online: null, _profileSub: 'acct-x', duelRecords: { get: () => rec }, duelButtonFor: () => null, wedButtonFor: () => null,
    profileDuelLine, profileGateLine, profileRaidLine, profileSerpentLine, profileSdLine,
  };
  const withDuel = new Function(...Object.keys(env), `let _profileView = null;\n${constOf('withDuel')}\nreturn withDuel;`)(...Object.values(env));
  const v = withDuel('peer-x', profileView({ name: 'Ann', state: 'answered' }));
  assert.deepEqual([v.gates, v.raids, v.serpents, v.hours], ['Breaches closed: 2', 'Towns defended: 3', 'Serpents slain: 5', 'Hours broken: 6']);
  assert.match(v.duels, /4/);
});

// ── L5 F4: the spent word owed ─────────────────────────────────────────

const mapStorage = () => { const disk = new Map(); return { disk, getItem: (k) => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, v), removeItem: (k) => disk.delete(k) }; };
function owedPool({ me = () => 'acct-a', goes = () => false } = {}) {
  const said = [];
  const store = spoilsStore(mapStorage());
  const p = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store, who: () => 'char-1', wall: () => 1_700_000_000_000, me, onSpent: (d) => { said.push(d); return goes(d); } });
  return { p, store, said };
}

test('SD11c THE SPENT WORD IS OWED UNTIL IT GOES (L5 F4): a spend whose word could not go (the hub\'s link between sockets, its bucket spent) is kept on the device under the pool\'s own key, with its account, and said again until it goes - it was said again only if the hub handed this device the receipt, and past the hold another device of the account was handed it and granted the same spoils; said on its own account\'s socket alone (another account\'s waits); a word that throws is owed; the host says the owed words again every few seconds while its hub link is open, for both pools (mutants: the word forgotten; said under another account; never re-said; re-said every frame)', () => {
  let going = false;
  const a = owedPool({ goes: () => going });
  assert.equal(a.p.grant({ day: 700, seed: 3, level: 5, acct: 'acct-a' }), true);
  assert.deepEqual(a.said, [700], 'said at once - and it did not go');
  const OWED = `${SPOILS_KEYS.day}.owed`;
  assert.deepEqual(a.store.get(OWED), [{ d: 700, a: 'acct-a' }], 'owed, on the device, with its account');
  assert.equal(a.p.resendSpent(), 1, 'still owed');
  assert.deepEqual(a.said, [700, 700]);
  going = true;
  assert.equal(a.p.resendSpent(), 0, 'it went');
  assert.equal(a.store.get(OWED), null, 'nothing owed');
  assert.equal(a.p.resendSpent(), 0);
  assert.deepEqual(a.said, [700, 700, 700], 'and never said again');
  // another account signed in on this device: its own words alone
  let me = 'acct-a';
  const b = owedPool({ me: () => me, goes: () => false });
  b.p.grant({ day: 701, seed: 3, level: 5, acct: 'acct-a' });
  me = 'acct-b';
  b.p.grant({ day: 702, seed: 3, level: 5, acct: 'acct-c' });
  assert.deepEqual(b.said, [701], 'acct-c\'s word never said on acct-b\'s socket');
  assert.deepEqual(b.store.get(OWED), [{ d: 701, a: 'acct-a' }, { d: 702, a: 'acct-c' }]);
  b.p.resendSpent();
  assert.deepEqual(b.said, [701], 'neither is acct-b\'s');
  me = 'acct-c';
  b.p.resendSpent();
  assert.deepEqual(b.said, [701, 702], 'acct-c signed in: its own');
  // a throw is owed; the list is bounded
  const c = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store: spoilsStore(mapStorage()), who: () => 'char-1', onSpent: () => { throw new Error('gone'); } });
  for (let d = 1; d <= SPOILS_SPENT_MAX + 4; d++) c.grant({ day: d, seed: 1, level: 1, acct: 'z' });
  assert.equal(c.resendSpent(), SPOILS_SPENT_MAX, 'owed, the oldest out past the bound');
  // the old door - an `onSpent` that answers nothing (a town's thanks tell the hub nothing): nothing owed
  const quietPool = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store: spoilsStore(mapStorage()), who: () => 'char-1' });
  quietPool.grant({ day: 9, seed: 1, level: 1, acct: 'z' });
  assert.equal(quietPool.resendSpent(), 0);
  // the host: both pools' words said again every SPOILS_SPENT_RESEND_MS while the hub's link is open
  assert.equal(SPOILS_SPENT_RESEND_MS, 5000);
  let t = 0, status = 'closed';
  const calls = [];
  const env = {
    performance: { now: () => t }, SPOILS_SPENT_RESEND_MS, socialLink: () => ({ status }),
    spoilsPool: { resendSpent: () => calls.push('gate') }, sdSpoilsPool: { resendSpent: () => calls.push('sd') },
  };
  const resend = new Function(...Object.keys(env), `let _spentResendAt = -Infinity;\n${constOf('resendSpentWords')}\nreturn resendSpentWords;`)(...Object.values(env));
  resend();
  assert.deepEqual(calls, [], 'the link closed: nothing');
  status = 'open';
  t = 4999; resend();
  assert.deepEqual(calls, [], 'inside the throttle');
  t = 5000; resend(); resend();
  assert.deepEqual(calls, ['gate', 'sd'], 'both pools, once');
  t = 9999; resend();
  assert.deepEqual(calls.length, 2);
  t = 10_000; resend();
  assert.equal(calls.length, 4);
  const w = strip(W);
  assert.match(w, /onSpent: \(day\) => socialLink\(\)\?\.sendGateSpent\?\.\(day\) === true,\s*\n\s*me: _accountGates\.me,/);
  assert.match(w, /onSpent: \(day\) => \{ const s = sdSpoilsSlot\(day\); return s == null \|\| socialLink\(\)\?\.sendSdSpent\?\.\(s\) === true; \},\s*\n\s*me: _accountGates\.me,/);
  assert.match(w, /gateClaims\?\.tick\(\);\s*\n\s*if \(gateOmen\) reportGateSite\(\);\s*\n\s*resendSpentWords\(\);/, 'on the gate frame');   // (PIN MOVED: after DISCORD-GATES' report, whose own pin holds its line to the claims' tick)
});

// ── L5 F6: a week for each account ─────────────────────────────────────

test('SD11c THE CLAIMS BOOK HOLDS A WEEK FOR EACH ACCOUNT (L5 F6): SD_CLAIMS_MAX receipts an account (a Hollow every two hours at the fastest - 84 a week), its own oldest out first - never another account\'s (eight for the whole device: a guest\'s ninth Hour pushed the first out before it registered, and one account\'s pushed out another\'s); SD_CLAIMS_ALL_MAX for every account the device holds (mutants: one bound for the device; another\'s pushed out)', async () => {
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(Date.now() / 1000);
  const mint = (d, s) => mintSdReceipt({ d, s, c: 5, x: 'dealt', l: 30 }, kp.privateKey, { subtle, nowS });
  assert.deepEqual([SD_CLAIMS_MAX, SD_CLAIMS_ALL_MAX], [96, 256]);
  const book = createSdClaims({ claim: async () => ({ ok: false, error: 'offline' }), me: () => null });
  const other = await mint(1, 'acct-b');
  assert.equal(book.add(other), true);
  for (let d = 1; d <= SD_CLAIMS_MAX + 1; d++) assert.equal(book.add(await mint(d, 'acct-a')), true);
  const kept = book.kept().map((r) => readSdReceipt(r));
  const mine = kept.filter((c) => c.s === 'acct-a');
  assert.equal(mine.length, SD_CLAIMS_MAX, 'a week of one account\'s');
  assert.equal(mine[0].d, 2, 'its oldest out');
  assert.ok(kept.some((c) => c.s === 'acct-b' && c.d === 1), 'another account\'s kept');
  // the device's bound
  const many = createSdClaims({ claim: async () => ({ ok: false }), me: () => null });
  for (let k = 0; k < 3; k++) for (let d = 1; d <= SD_CLAIMS_MAX; d++) many.add(await mint(d, `acct-${k}`));
  assert.equal(many.kept().length, SD_CLAIMS_ALL_MAX, 'every account the device holds: bounded');
});

// ── L5 F7: no Vigil for a death turned aside ──────────────────────────

const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const lootPlayer = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
function legendary(id) {
  const rec = LR.legendaryById(id);
  const t = rec.templates?.[0];
  const base = rec.group === 'Weapons' ? createWeapon(t ?? 120, 0, () => 0.5)
    : mintCondition({ group: rec.group, templateIndex: t ?? (rec.group === 'Armor' ? 102 : 135), material: rec.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };

test('SD11c NO VIGIL FOR A DEATH TURNED ASIDE (L5 F7): a killing blow a death save turned aside (Divine Grace here; The Hour Turns and Unbroken the same) leaves 1 and heals by the save\'s own law - the Ghost-King\'s Vigil no longer heals on top and spends its minute on a death that never happened (AUDIT 625 P1\'s law for Shed Skin); a real hurt under its line still wakes it (mutants: `saved` unread)', () => {
  _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests(); setPlayerDoor(null);
  LP._setLootPowersClockForTests(() => 0);
  const said = [];
  LP.setLootPowersVoice({ say: (l) => said.push(l) });
  const me = lootPlayer();
  wear(me, legendary('amulet-of-the-nine'));
  wear(me, legendary('lysandus-visor'));
  hurtPlayer(me, 500);
  assert.equal(me.health, 26, 'left at 1, Divine Grace\'s quarter - and no Vigil on top (46)');
  assert.ok(!said.some((l) => /Vigil/.test(l)), 'the Vigil unsaid');
  me.health = 100;
  hurtPlayer(me, 70);
  assert.equal(me.health, 50, 'a real hurt under its line: the Vigil, ready');
  assert.ok(said.some((l) => /Vigil/.test(l)));
  LP._resetLootPowersForTests();
});

// ── L5 F5, L8 G3: the world host's fight, from its own text ───────────

/** world.js's fight seams from their own text over fakes: the realm's slot, the link, the floor, the blows. */
function fightHost() {
  let slot = null;
  const log = [];
  const env = {
    modes: { sdRealmSlot: () => slot },
    sdFightLink: { word: (w) => log.push(['word', w.k, w.s ?? null]), leave: () => log.push('link.leave'), state: () => SD_FIGHT_EMPTY, now: () => 0 },
    _sdReceipts: new Map(), sdReceiptsLeft: () => log.push('receipts'),
    sdSpoilsBurst: { leave: () => log.push('floor.leave'), frame: () => log.push('floor.frame') }, saveSoon: { changed: () => log.push('save') },
    sdBlows: { leave: () => log.push('blows.leave'), frame: () => log.push('blows.frame') },
    sdRemVoice: { leave: () => log.push('voice.leave'), frame: () => log.push('voice.frame') },   // SD14a (PIN MOVED): its voice beside its blows
    sdFx: { leave: () => log.push('fx.leave'), frame: () => log.push('fx.frame') },   // SD16 (PIN MOVED): its sparks beside its voice
    sdDungeonToRealm: () => [0, 0, 0], player: { pos: [0, 0, 0] }, sdBarNear: () => false, remnantBarModel: () => null,
    drawGateBossBar: () => log.push('bar'), gamePaused: () => false, townTalk: {},
    // SD15 (PIN MOVED): the arena read beside the bar - nothing to read in an empty fight
    playerEntity: { health: 10 }, SD_ARENA: { x: 0, z: 0 }, cam: { yaw: 0 }, sdPerilAt: () => null, sdGroundModel: () => null,
    sdBeats: { frame: () => null, leave: () => {} }, titleCardModel: () => null, drawGateGround: () => log.push('ground'), drawSdTitleCard: () => log.push('card'),
  };
  const body = `let _sdFightHeld = false, _sdBarUp = false, _sdGroundUp = false, _sdCardUp = false;\n${fnOf('sdFightHeard')}\n${constOf('sdFightFrame')}\nreturn { sdFightHeard, sdFightFrame, held: () => _sdFightHeld };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  return { ...api, log, at: (s) => { slot = s; }, receipts: env._sdReceipts };
}

test('SD11c THE WORLD HOST\'S FIGHT, RUN FROM ITS OWN TEXT (L8 G3, L5 F5): in the Hour of slot 4 its fight\'s words are folded and another slot\'s whole state dropped; nothing outside the Hour; each frame in it the blows and the floor frame; the frame I leave, the floor gathered, A CHECKPOINT ASKED (the Hour refuses every save - what it gave stood on the device alone until the next, minutes on), the link and the blows left - once (mutants: the slot unread; the realm never known; no checkpoint; left every frame)', () => {
  const h = fightHost();
  h.sdFightHeard({ k: 'st', s: 4 });
  assert.deepEqual(h.log, [], 'outside the Hour: nothing folded');
  h.at(4);
  h.sdFightHeard({ k: 'st', s: 5 });
  h.sdFightHeard({ k: 'st', s: 4 });
  h.sdFightHeard({ k: 'hp' });
  assert.deepEqual(h.log, [['word', 'st', 4], ['word', 'hp', null]], 'its own slot\'s, and the fight\'s deltas');
  assert.equal(h.held(), true);
  h.log.length = 0;
  h.sdFightFrame(); h.sdFightFrame();
  assert.deepEqual(h.log, ['blows.frame', 'voice.frame', 'fx.frame', 'floor.frame', 'blows.frame', 'voice.frame', 'fx.frame', 'floor.frame'], 'in the Hour: each frame');   // SD14a (PIN MOVED): and its voice   // SD16 (PIN MOVED): and its sparks
  h.log.length = 0;
  h.receipts.set(4, 'r');
  h.at(null);
  h.sdFightFrame();
  assert.deepEqual(h.log, ['receipts', 'floor.leave', 'save', 'link.leave', 'blows.leave', 'voice.leave', 'fx.leave'], 'out: the receipts, the floor gathered, a checkpoint asked, the fight left');   // SD14a (PIN MOVED): its voice too   // SD16 (PIN MOVED): its sparks
  h.log.length = 0;
  h.receipts.clear();
  h.sdFightFrame(); h.sdFightFrame();
  assert.deepEqual(h.log, [], 'once');
  assert.equal(h.held(), false);
});

// ── L6 F4, F14: the Hour's death, the floor's last words ──────────────

test('SD11c A DEATH IN THE HOUR IS THE HOUR\'S, AND THE FLOOR\'S LAST WORDS GO TO THE CHAT (L6 F4, F14): the respawn reads the Hour before it leaves it, and wakes under the veil with the Hour\'s own words (it woke with a plain dungeon\'s); what the floor still held, gathered as I leave, is said in the chat - over the screen it took the place of the way home\'s line or the cast-out\'s a frame after (mutants: read after the exit; the dungeon\'s words; the gathered line over the screen)', () => {
  assert.equal(SD_REALM_TEXT.died, 'The Shattered Hour casts you out for good. You wake before the Hollow\'s door.');   // SD-ONELIFE (PIN MOVED): one life
  const w = strip(W);
  const at = w.indexOf('const diedInHour = modes?.sdRealmSlot?.() != null;');
  const go = w.indexOf('Promise.resolve().then(async () => {', at);
  const out = w.indexOf('if (mode !== \'exterior\') modes?.forceExitToExterior();', go);
  assert.ok(at > 0 && go > at && out > go, 'read before the exit');
  assert.match(w.slice(out, out + 4000), /if \(diedInHour\) \{ gateVeil\?\.flash\('brass'\); kind = 'hour'; \}\s*\n\s*townTalk\.showOverlay\(new ActionTextBox\(\[respawnFlavorText\(kind\), deathPenaltyText\(goldLost\), took\?\.line\]\.filter\(Boolean\)\)\);/);
  assert.equal(respawnFlavorText('hour', () => 0), SD_REALM_TEXT.died, 'the Hour\'s own kind of waking');
  assert.equal(respawnFlavorText('hour', () => 0.999), SD_REALM_TEXT.died);
  // the Hour's pool's voice, from its own text
  const from = W.indexOf('const sdSpoilsPool = createSpoilsPool({');
  const line = W.slice(from, W.indexOf('\n  });', from)).split('\n').find((l) => l.includes('say: (text) =>'));
  const sayText = /say: (\(text\) => \(text === SD_SPOILS_TEXT\.gathered \? chatNotice\(text\) : sdSay\(text, SD_VOICE_RANK\.note\)\))/.exec(line)?.[1];   // (SD11d, PIN MOVED): the rest through the Hour's voice
  assert.ok(sayText, 'its say');
  const log = [];
  const say = evalIn(sayText, { SD_SPOILS_TEXT, SD_VOICE_RANK: { note: 1 }, chatNotice: (t) => log.push(['chat', t]), sdSay: (t) => log.push(['screen', t]) });
  say(SD_SPOILS_TEXT.gathered);
  say('No spoils.');
  assert.deepEqual(log, [['chat', SD_SPOILS_TEXT.gathered], ['screen', 'No spoils.']]);
});

// ── L8 G2: the page keeps the whole state ─────────────────────────────

/** SD8c's shadow, with EVERY word folded - the whole state the law says every STATE_SEND_MS among them (the relay fans
 *  it to every socket in production) - and the page's view checked against the law's at every beat. */
function shadowWhole({ n = 8, dpsX = 1, hearts = true, seed = 7 } = {}) {
  const rng = seeded(seed), f = newRemnantFight(4, 1, T0);
  const subs = Array.from({ length: n }, (_, k) => `p${k}`);
  for (const sub of subs) joinRemnant(f, sub, sub, 30, T0);
  const pos = subs.map((_, k) => { const a = (k / n) * Math.PI * 2; return [Math.sin(a) * 6, Math.cos(a) * 6]; });
  let s = foldSdFight(SD_FIGHT_EMPTY, validSdOut(remnantStateOf(f)), T0);
  let whole = 0, wholeInReset = 0, wholeInStun = 0;
  const hear = (frames, now) => {
    for (const x of frames) {
      const w = validSdOut(x);
      assert.ok(w, `the wire takes the law's ${x.k}`);
      if (w.k === 'st') { whole++; if (f.cx) wholeInReset++; if (now < f.stunUntil) wholeInStun++; }
      s = foldSdFight(s, w, now);
    }
  };
  const d = dpsRef(30) * 0.5 * dpsX;
  let q = 0, now = T0;
  for (let step = 0; step < 4 * 20 * 60 && !f.fell; step++) {
    now += 250;
    hear(stepRemnant(f, now, subs.map((sub, k) => ({ sub, x: pos[k][0], z: pos[k][1], dead: false })), rng), now);
    const tol = f.ended ? 1 : 0.05;
    assert.equal(s.ph, f.phase, `the phase at ${now - T0}`);
    assert.equal(s.h, Math.round(f.hp), `the health at ${now - T0}`);
    assert.ok(dist2(sdBodyAt(s.rem, now), sdBodyAt(f.rem, now)) <= tol, `the Remnant where it stands at ${now - T0}`);
    if (f.rem.atk) assert.equal(s.rem.atk?.i, f.rem.atk.i, 'its blow in flight');
    else assert.ok(!s.rem.atk || sdBlowDone(s.rem.atk, now), 'none in flight');
    assert.equal(!!s.ec, !!f.ec, 'the Echoes stand while the law\'s do');
    if (f.ec) {
      for (let k = 0; k < 2; k++) {
        const E = f.ec[k], P = s.ec[k];
        assert.deepEqual([P.up, P.dn, P.h, P.m], [E.up, E.downAt ?? 0, Math.ceil(E.h), Math.ceil(E.m)], `Echo ${k}'s rising, fall and health`);
        if (E.h > 0) assert.ok(dist2(sdBodyAt(P, now), sdBodyAt(E.body, now)) <= tol, `Echo ${k} where it stands`);
        if (E.h > 0 && E.body.atk) assert.equal(P.atk?.i, E.body.atk.i, `Echo ${k}'s blow`);
      }
    }
    assert.equal(sdHeartsOf(s, now)?.i ?? null, f.cx?.i ?? null, `the Hearts standing while the Reset winds up at ${now - T0}`);
    if (f.cx) f.cx.c.forEach((o, c) => { assert.deepEqual([s.cx.c[c][0], s.cx.c[c][1]], [o.x, o.z]); assert.equal(s.cx.c[c][2], Math.ceil(o.h), `Heart ${c}'s health`); });
    if (f.stunUntil > 0) assert.equal(s.su, f.stunUntil, 'the stun');
    assert.equal(!!s.ended, !!f.ended, 'the Hour\'s end');
    if (f.clock) assert.equal(s.clk?.i, f.clock.i, 'the Hour\'s blow');
    if ((now - T0) % 500) continue;
    for (const [k, sub] of subs.entries()) {
      const pose = { x: pos[k][0], z: pos[k][1] };
      q++;
      if (f.phase === 2 && f.ec) { const e = k % 2; hear(applyEchoHit(f, sub, f.ec[e].h > 0 ? e : 1 - e, d, HIT_KINDS.Spell, pose, now, q), now); }
      else if (hearts && f.cx && heartsOpen(f, now)) { const c = f.cx.c.findIndex((o) => o.h > 0); if (c >= 0) hear(applyHeartHit(f, sub, c, d * 4, HIT_KINDS.Spell, pose, now, q), now); }
      else {
        applyRemnantHit(f, sub, d, HIT_KINDS.Spell, pose, now, q);
        if (f.fell && !s.fell) hear([{ k: 'fell', ...f.fell }], now);
      }
    }
  }
  return { f, s, whole, wholeInReset, wholeInStun };
}

test('SD11c THE PAGE KEEPS THE WHOLE STATE (L8 G2): the whole fight folded with every word the law says - the whole state every five seconds among them, as the relay fans it - keeps the page the law\'s at every beat: through the Hearts (a whole state mid-Reset keeps them standing), the stun and the Hour\'s end (SD8c\'s shadow skipped every `st`: a fold that dropped the Hearts went unseen, and every page would lose them within 5 s of their rising); word by word, a whole state mid-stun keeps when the stun was first heard (mutants: the Hearts unfolded; the stun\'s moment moved)', () => {
  const full = shadowWhole();
  assert.ok(full.f.fell && full.s.fell, 'felled on the page as in the law');
  assert.ok(full.whole > 20 && full.wholeInStun > 0, `whole states folded: ${full.whole}, mid-stun ${full.wholeInStun}`);
  const landed = shadowWhole({ hearts: false });
  assert.ok(landed.f.fell && landed.wholeInReset > 0, `the Reset left to land: whole states mid-Reset ${landed.wholeInReset}`);
  const ends = shadowWhole({ dpsX: 0.5 });
  assert.ok(ends.f.ended && !ends.f.fell && ends.s.ended === ends.f.ended.at, 'the Hour ends on the page as in the law');
  // word by word: the stun's moment kept through a whole state of the same stun, a new one heard now
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  let s = foldSdFight(SD_FIGHT_EMPTY, validSdOut(remnantStateOf(f)), T0);
  s = foldSdFight(s, validSdOut({ k: 'stun', until: T0 + 9000, at: T0 + 1000 }), T0 + 1000);
  const heardAt = s.stunAt;
  f.stunUntil = T0 + 9000;
  s = foldSdFight(s, validSdOut(remnantStateOf(f)), T0 + 4000);
  assert.equal(s.stunAt, heardAt, 'the same stun: its moment kept');
  f.stunUntil = T0 + 20_000;
  s = foldSdFight(s, validSdOut(remnantStateOf(f)), T0 + 12_000);
  assert.equal(s.stunAt, T0 + 12_000, 'another: heard now');
});

// ── L8 G10: the End stops the Echoes ──────────────────────────────────

test('SD11c THE HOUR\'S END STOPS THE ECHOES TOO (L8 G10): an End that comes in the Dragon Break stops both Echoes where they stand - no walk, no blow - on the law and on the page, and nothing moves them again (the shadow\'s End came in the Last Moment alone) (mutants: the End leaves the Echoes walking or striking, at either end)', () => {
  const rng = seeded(11), f = newRemnantFight(4, 1, T0);
  const subs = ['a', 'b', 'c', 'd'];
  for (const sub of subs) joinRemnant(f, sub, sub, 30, T0);
  const at = [[-7, 4], [-5, 6], [7, 4], [5, 6]];
  const bodies = () => subs.map((sub, k) => ({ sub, x: at[k][0], z: at[k][1], dead: false }));
  let s = foldSdFight(SD_FIGHT_EMPTY, validSdOut(remnantStateOf(f)), T0);
  const hear = (frames, now) => { for (const x of frames) { const w = validSdOut(x); if (w) s = foldSdFight(s, w, now); } };
  let now = T0;
  while (now < T0 + SD_OPENING_MS + 500) { now += 250; hear(stepRemnant(f, now, bodies(), rng), now); }
  f.hp = SD_PHASE_AT[0] * f.max - 1;
  now += 250; hear(stepRemnant(f, now, bodies(), rng), now);
  assert.equal(f.phase, 2, 'the Dragon Break');
  let busy = false;
  for (let i = 0; i < 400 && !busy; i++) { now += 250; hear(stepRemnant(f, now, bodies(), rng), now); busy = f.ec.some((E) => E.body.atk || E.body.mv); }
  assert.ok(busy, 'an Echo walking or striking');
  f.endsAt = now + SD_BLOWS.end.windup + 250;
  for (let i = 0; i < 4 && !f.ended; i++) { now += 250; hear(stepRemnant(f, now, bodies(), rng), now); }
  assert.ok(f.ended && f.phase === 2 && f.ec, 'the End, in the Dragon Break');
  const stilled = () => {
    assert.ok(f.ec.every((E) => !E.body.atk && !E.body.mv), 'the law: both Echoes still');
    assert.ok(s.ended && s.ec.every((E) => !E.atk && !E.mv), 'the page: both still');
  };
  stilled();
  for (let i = 0; i < 40; i++) { now += 250; hear(stepRemnant(f, now, bodies(), rng), now); }
  stilled();
  assert.deepEqual(sdBlowsInFlight(s).map((x) => x.b), [SD_BODY.hour], 'the Hour\'s blow alone in flight');
});

// ── L8 G13: the smaller gaps ──────────────────────────────────────────

test('SD11c THE SMALLER GAPS (L8 G13): a fallen Echo strikes nothing (its blow in flight dropped from the arena\'s blows); the Silver Echo is named Silver - its fall, its rising and its bar; a world that offers no Hollow for the slot (no template) stands nothing, warns once, and still says the find with the region\'s name (mutants: a fallen Echo striking; Silver named Gold; the line unsaid)', () => {
  const s = { fi: 1, ph: 2, rem: { x: 0, z: 0 }, clk: null, ec: [{ h: 0, atk: { i: 3 } }, { h: 5, atk: { i: 4 } }] };
  assert.deepEqual(sdBlowsInFlight(s).map((x) => [x.b, x.atk.i]), [[SD_BODY.silver, 4]], 'the fallen Gold\'s blow dropped');
  assert.equal(FIGHT_WORDS.echoFell('Bo', 1), 'Bo fells the Silver Echo.');
  assert.equal(FIGHT_WORDS.echoFell('Bo', 0), 'Bo fells the Gold Echo.');
  assert.equal(FIGHT_WORDS.echoRose(1), 'The Silver Echo rises again!');
  assert.equal(SD_BAR_TEXT.echo(1, 'x'), 'Silver Echo: x');
  const said = [];
  const L = createSdFightLink({ now: () => T0, say: (t) => said.push(t) });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut(remnantStateOf(f)));
  L.word(validSdOut({ k: 'ec', e: [[0, 9, T0, 0], [0, 9, T0, T0]], d: 1, n: 'Bo', at: T0 }));
  assert.ok(said.includes('Bo fells the Silver Echo.'), JSON.stringify(said));
  // a world with no Hollow for the slot
  const rig = hollowRig({ templates: () => [], regionName: () => 'the Alik\'r Desert' });
  const warns = [];
  const warn = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
    rig.host.heard({ k: 'ev', ...r });
    rig.host.frame();
    rig.host.heard({ k: 'ev', ...sdFind(r, T0, 'Mara') });
    rig.host.frame(); rig.host.frame();
    assert.equal(rig.host.hollow(), null, 'nothing stood');
    assert.equal(warns.filter((m) => /offers no Hollow/.test(m)).length, 1, 'warned once');
    assert.deepEqual(rig.log.filter((x) => Array.isArray(x) && x[0] === 'line').map((x) => x[1]), [sdFoundLine({ who: 'Mara', near: 'the Alik\'r Desert' })], 'the find said, by its region');
  } finally { console.warn = warn; }
  void quiet; void near;
});

// ── the words: an older Hour (L1 F5, L6 F12) ──────────────────────────

test('SD11c AN OLDER HOUR SAYS WHAT CAN BE DONE (L1 F5, L6 F12): a game older than the Hour is told to leave it and reload or update - it said "save", in the one place that refuses a save (mutants: the old words)', () => {
  assert.equal(SD_FIGHT_TEXT.no['an older Hour'], 'Your game is older than this Hour. Leave it, then reload or update the app to fight.');
  assert.doesNotMatch(SD_FIGHT_TEXT.no['an older Hour'], /save/i);
});
