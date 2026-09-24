// DISC10-E - THE WEREWOLF, DRIVEN THROUGH THE LIVE DOORS.
//
// Mac (2026-09-23): "vampires and werewolf. I think these systems are completely broken and not wired correctly".
// Every pin here EXECUTES the port's own modules the way a host drives them - the real city watch pool on a synthetic
// CLASS18.CFG, the real encounter pool on a crafted MONSTER.BSA (test/watch1.test.js's rig), the real PlayerWeapon
// resolving the swing, the real worldTick round, the real inventory/trade doors - and each one failed on the code
// that shipped (DISC10 audits, HEAD e09a775d0):
//
//   H1  the curse's hit hook fired INSIDE the damage formula, before any door took the health, so KilledInnocent
//       (LycanthropyEffect.cs:383-407, `CurrentHealth <= 0`) could never see a dead innocent: the urge to kill could
//       not be satisfied by any kill, and the health ceiling fell to 4 and stayed there. A civilian's murder
//       (WeaponManager.cs:514-521) never reached the hook at all.
//   L2  the beast struck WITH the claws item: the material gate and a 0-0 weapon range, where DFU's strikingWeapon is
//       the empty hand (WeaponManager.cs:909) - ApplyWeapon (:735-739) only changes the SCREEN weapon.
//   L3  the inventory refusal was per door and most doors missed it; DFU refuses in the window itself
//       (DaggerfallInventoryWindow.cs:583-587/:355-362, inherited by DaggerfallTradeWindow.cs:355-376).
//   L4  the shrinking ceiling was written and read by nothing: DaggerfallEntity.MaxHealth (:258, :463-472) applies
//       the limiter, RawMaxHealth (:261, :495-498) does not, and the save keeps the raw one (SerializablePlayer:118).
//   V9  going online shifted the save's markers but not the curse's own clocks.
//   V11 a save between the dream's push and its close kept `dreamScheduled` and stalled for ever
//       (LycanthropyInfection.cs:143-149 saves the Played flag only).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import {
  createLycanthropyCurse, liveLycanthropy, morphSelf, racialFpsWeapon,
  NEED_TO_KILL_PERIOD, INVENTORY_WHILE_SHAPECHANGED_TEXT, NEED_TO_KILL_HEALTH_LIMIT_MINIMUM,
} from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES, INFECTION, startInfection, runInfections, setInfectionHost } from '../src/systems/infection.js';
import { runMagicRoundsFor, setWorldMinutes, worldMinutes, alignEntityClocks, resetMagicRoundMarker } from '../src/systems/worldTick.js';
import { createInventoryWindow } from '../src/ui/inventoryDoor.js';
import { createTradeWindow } from '../src/ui/tradeDoor.js';
import { assignQuickslot, clearQuickslots, swapQuickslot, useQuickslot, QUICKSLOT_TEXT } from '../src/systems/quickslots.js';
import { equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import * as chargen from '../src/systems/chargen.js';   // a namespace: each pin fails on its own law, not on an import
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { registerPresenter, _resetNotifyForTests } from '../src/systems/notify.js';
import { MINUTES_PER_DAY, isFullMoonFromMinutes } from '../src/systems/gameDate.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const NOW = 523530 + 40 * MINUTES_PER_DAY;   // the classic start plus forty days - a month past any curse minted at the start

// ---- the rig: test/watch1.test.js's crafted watch and encounter data --------------------------------------------
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const rig = (playerEntity, said, rand = () => 0) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => worldMinutes(), currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: rand, rand, say: (t) => said.push(t),
});

/** A level-10 player at full strength with a HandToHand of 100 - every connect a hit (the 97 clamp) - and a
 *  werewolf's curse minted at the classic start: forty days on, the urge has been rising for ten. */
function werewolf() {
  const p = {
    isPlayer: true, name: 'Mac', race: 'Nord', gender: 'male', level: 10, reflexes: 2,
    skills: new Array(40).fill(100), skillUses: new Array(40).fill(0),
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 },
    items: [], activeEffects: [], spells: [], health: 100, maxHealth: 100, crimeCommitted: 0,
  };
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: 523530 });
  return p;
}
const settle = () => new Promise((r) => setTimeout(r, 0));
/** The rig's melee swing: the used hand's item, and the racial override's screen weapon over it - weaponRig's
 *  syncWorn, verbatim (UpdateHands then ApplyWeapon). */
function swing(entity) {
  const pw = new PlayerWeapon({});
  const slots = equipTableOf(entity);
  pw.updateHands(slots[EQUIP_SLOTS.RightHand] ?? null, slots[EQUIP_SLOTS.LeftHand] ?? null);
  pw.applyWeapon(racialFpsWeapon(entity));
  return pw;
}
const EYE = [0, 1.6, 0], FEET = [0, 0, 0], FWD = [0, 0, 1];
const inView = () => true;

// ── H1: THE KILL IS SEEN DEAD ─────────────────────────────────────────────────────────────────────────────────────

test('DISC10-E H1: killing a WATCHMAN through the watch pool\'s own swing satisfies the urge - the hook runs after the door took the health (WeaponManager.cs:627-635), stamped with the live clock', async () => {
  setWorldMinutes(NOW);
  const p = werewolf();
  // the urge is up: one round at the live clock raises the ceiling's limit
  runMagicRoundsFor(p, NOW - 1, NOW, { sinks: {} });
  assert.equal(liveLycanthropy(p).urgeToKillRising, true, 'ten days past the month: the urge is rising');
  assert.ok(p.maxHealthLimiter < 100, 'and the ceiling is falling');
  const guards = createCityGuards(rig(p, []));
  await guards.spawnCityGuards(true, { playerFeet: FEET, playerFwd: FWD, pool: [{ pos: [0, 0, 1.2], fwdYaw: Math.PI, guard: true, disable: () => {} }] });
  await settle();
  const g = guards.guards[0];
  assert.ok(g, 'a watchman stands off the synthetic CLASS18.CFG');
  g.entity.health = 1;
  assert.equal(guards.resolvePlayerHit(swing(p), EYE, FWD, FEET, inView), true, 'the swing connected');
  assert.equal(g.dead, true, 'the watchman fell to it');
  const entry = liveLycanthropy(p);
  assert.equal(entry.lastKilledInnocent, NOW, 'KilledInnocent read the watchman DEAD and UpdateSatiation stamped the live minute');
  assert.equal(entry.urgeToKillRising, false);
  assert.equal(p.maxHealthLimiter, null, 'the ceiling lifts');
});

test('DISC10-E H1: murdering a TOWNSPERSON through resolveCivilianHit satisfies the urge - SetHealth(0) then OnWeaponHitEntity (WeaponManager.cs:514-521)', async () => {
  setWorldMinutes(NOW + 7);
  const p = werewolf();
  runMagicRoundsFor(p, NOW + 6, NOW + 7, { sinks: {} });
  assert.equal(liveLycanthropy(p).urgeToKillRising, true);
  const guards = createCityGuards(rig(p, []));
  let disabled = 0, murders = 0;
  const pool = [{ pos: [0, 0, 1.4], fwdYaw: Math.PI, guard: false, disable: () => { disabled++; } }];
  const r = await guards.resolveCivilianHit(swing(p), EYE, FWD, FEET, pool, { onMurder: () => { murders++; } });
  assert.deepEqual(r, { crime: 'murder' });
  assert.equal(disabled, 1); assert.equal(murders, 1);
  assert.equal(liveLycanthropy(p).lastKilledInnocent, NOW + 7, 'the murdered civilian is an innocent killed (EntityTypes.CivilianNPC)');
  assert.equal(p.maxHealthLimiter, null);
});

test('DISC10-E H1: a monster killed is NOT an innocent, and a watchman merely wounded is not killed - the gate is the dead innocent, read after the door', async () => {
  setWorldMinutes(NOW + 20);
  const p = werewolf();
  const said = [];
  const pool = createExteriorFoes(rig(p, said));
  const rat = await pool.spawnFoe(0, [0, 0, 1.2], { feetGiven: true });
  rat.entity.health = 1;
  pool.resolvePlayerHit(swing(p), EYE, FWD, FEET, inView);
  assert.equal(rat.dead, true, 'the rat died');
  assert.equal(liveLycanthropy(p).lastKilledInnocent, 523530, 'a rat is nobody\'s innocent');
  const guards = createCityGuards(rig(p, []));
  await guards.spawnCityGuards(true, { playerFeet: FEET, playerFwd: FWD, pool: [{ pos: [0, 0, 1.2], fwdYaw: Math.PI, guard: true, disable: () => {} }] });
  await settle();
  const g = guards.guards[0];
  g.entity.health = 10000;
  guards.resolvePlayerHit(swing(p), EYE, FWD, FEET, inView);
  assert.equal(g.dead, false);
  assert.equal(liveLycanthropy(p).lastKilledInnocent, 523530, 'a watchman still standing is not a kill');
});

test('DISC10-E H1: the formula no longer carries the hook, and the dispatcher is called after each strike door', () => {
  const formulas = rd('src/combat/formulas.js');
  assert.doesNotMatch(formulas, /racialOverride\s*\)\s*\{[\s\S]{0,80}HitHook/, 'no racial hook inside CalculateAttackDamage');
  assert.doesNotMatch(formulas, /targetIsCivilian/, 'the dead option is gone');
  assert.match(rd('src/systems/worldTick.js'), /export function playerWeaponHitEntity\(/, 'one dispatcher');
});

// ── L2: THE BEAST STRIKES WITH ITS HANDS ──────────────────────────────────────────────────────────────────────────

test('DISC10-E L2: a transformed werewolf\'s swing is HAND-TO-HAND - the same damage as the empty hand, and silver-to-hit foes take it', async () => {
  setWorldMinutes(NOW + 30);
  const p = werewolf();
  morphSelf(p, { force: true, nowMinutes: NOW + 30 });
  assert.equal(liveLycanthropy(p).isTransformed, true);
  const beast = swing(p);
  assert.equal(beast.weapon?.werecreatureClaws, true, 'the SCREEN weapon is the claws (SetFPSWeapon)');
  assert.equal(beast.strikingWeapon, null, 'but the striking weapon is the empty hand (WeaponManager.cs:909)');
  // the same foe struck twice on one roll stream: once in beast form, once by the bare hand
  // the struck part, the critical roll, a HIT, the damage roll
  const stream = () => { let i = 0; const v = [0.1, 0.2, 0.05, 0.6, 0.3, 0.4, 0.7]; return () => v[i++ % v.length]; };
  const foe = () => ({ entity: { health: 1000, maxHealth: 1000, level: 1, stats: { agility: 50, luck: 50 }, skills: 0, armorValues: new Array(7).fill(0), minMetalToHit: WEAPON_MATERIALS.Silver }, ai: { feet: [0, 0, 1] } });
  const see = () => ({ dist: 1, inView: true, losClear: true });
  const clawed = beast.resolveHit([foe()], p, see, stream());
  const bare = new PlayerWeapon({ weapon: null });
  bare.applyWeapon(null);
  const fisted = bare.resolveHit([foe()], p, see, stream());
  assert.ok(fisted[0].damage > 0, 'the bare hand lands on a silver-to-hit foe (hand-to-hand has no material)');
  assert.equal(clawed[0].damage, fisted[0].damage, 'the claws ARE the hand');
});

// ── L3: EVERY DOOR REFUSES THE BEAST ──────────────────────────────────────────────────────────────────────────────

test('DISC10-E L3: the pack and the counter refuse a transformed lycanthrope AT THE DOOR - loot, wagon, sheet, trade and all', () => {
  _resetNotifyForTests();
  const boxes = [];
  const unreg = registerPresenter({ mount: (w) => { boxes.push(w); return true; }, hudText: (l) => { boxes.push(l); return true; } });
  try {
    const p = werewolf();
    morphSelf(p, { force: true, nowMinutes: NOW });
    for (const extra of [{}, { loot: { items: [] } }, { chooseOne: [] }]) {
      assert.equal(createInventoryWindow({ entity: p, items: () => p.items, ...extra }), null, `the pack refuses (${Object.keys(extra)[0] ?? 'plain'})`);
    }
    for (const mode of ['Buy', 'Sell', 'Repair', 'Identify']) {
      assert.equal(createTradeWindow({ entity: p, mode, items: () => p.items }), null, `the ${mode} counter refuses`);
    }
    const said = boxes.map((b) => (typeof b === 'string' ? b : (b.rows ?? b.lines ?? []).map((r) => (typeof r === 'string' ? r : r.text)).join(' ')));
    assert.ok(said.length >= 7 && said.every((t) => t.includes(INVENTORY_WHILE_SHAPECHANGED_TEXT)), `the classic line, every time: ${JSON.stringify(said)}`);
    // back in the flesh the doors open
    morphSelf(p, { nowMinutes: NOW + 2 * MINUTES_PER_DAY });
    assert.notEqual(createInventoryWindow({ entity: p, items: () => p.items }), null, 'the untransformed lycanthrope opens the pack');
  } finally { unreg(); }
});

test('DISC10-E L3: the quickslots are inventory doors too - no swap into the claws, no potion out of a pack the beast cannot open', () => {
  clearQuickslots();
  const p = werewolf();
  const sword = { group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', currentCondition: 800, maxCondition: 1000 };
  const potion = { group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: 1, stackCount: 2, currentCondition: 1, maxCondition: 1 };
  p.items.push(sword, potion);
  assignQuickslot('swap', sword);
  assignQuickslot('c1', potion);
  morphSelf(p, { force: true, nowMinutes: NOW });
  const said = [];
  const s = swapQuickslot({ entity: p, say: (t) => said.push(t) });
  assert.equal(s.kind, 'refused');
  assert.equal(equipTableOf(p)[EQUIP_SLOTS.RightHand] ?? null, null, 'nothing went into the hand');
  const u = useQuickslot('c1', { entity: p, hooks: { drinkPotion: () => { throw new Error('drunk'); } }, say: (t) => said.push(t) });
  assert.equal(u.kind, 'refused');
  assert.equal(potion.stackCount, 2, 'no bottle left the pack');
  assert.deepEqual(said, [INVENTORY_WHILE_SHAPECHANGED_TEXT, INVENTORY_WHILE_SHAPECHANGED_TEXT]);
  assert.ok(QUICKSLOT_TEXT, 'the module\'s own lines are untouched');
  clearQuickslots();
});

test('DISC10-E L3: no host keeps a per-door copy of the refusal, and no host mounts a refused (null) window', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    const s = rd(host);
    assert.doesNotMatch(s, /racialSuppressInventory\(/, `${host}: the door refuses, not the host`);
    assert.doesNotMatch(s, /showOverlay\(makeInventoryWindow\(/, `${host}: a refused pack is null and must not be mounted`);
  }
  // the dungeon's slot holds the refusal's box - a null written over it would drop the line
  assert.doesNotMatch(rd('src/scenes/dungeonContext.js'), /activeOverlay = openInventory\(/, 'the dungeon mounts only a window');
  // and a counter the trade door refused is no window to the service door (the popup reads it as a dispatch)
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /function mountServiceWindow\(win\) \{\s*if \(!win \|\| win\.refusedByDoor\) return null;/);
  assert.match(wm, /const w = openTradeWindow\(shelf, b, 'Buy'\);\s*if \(!w\) return;/, 'the shelf\'s counter');
  assert.match(wm, /win = openTradeWindow\(target, b, 'Sell'\);\s*if \(!win\) return true;/, 'the merchant\'s');
  assert.match(wm, /'Identify',\s*\{ identifySpell: \{ chance: chance \?\? 0, cost: refund \?\? 0 \} \}\);\s*if \(!win\) return true;/, 'the Identify spell\'s');
});

// ── L4: THE CEILING IS READ ───────────────────────────────────────────────────────────────────────────────────────

test('DISC10-E L4: MaxHealth reads the limiter, RawMaxHealth does not, a heal stops at the limit and the save keeps the raw one', () => {
  setWorldMinutes(NOW);
  const p = chargen.defineLiveMaxHealth(werewolf());
  // ONE day into the urge: the reduction is 24 (NEED_TO_KILL_HEALTH_LOSS_PER_MINUTE x 1440), well above the floor of 4
  liveLycanthropy(p).lastKilledInnocent = NOW - NEED_TO_KILL_PERIOD - MINUTES_PER_DAY;
  const heals = [];
  const sinks = { heal: (n) => { heals.push(n); p.health = Math.min(p.maxHealth, p.health + n); } };
  runMagicRoundsFor(p, NOW - 1, NOW, { sinks });
  const lim = p.maxHealthLimiter;
  assert.equal(lim, 100 - 24, `the urge limits the ceiling: ${lim}`);
  assert.ok(lim > NEED_TO_KILL_HEALTH_LIMIT_MINIMUM);
  assert.equal(p.maxHealth, lim, 'DaggerfallEntity.MaxHealth is the LIMITED value');
  assert.equal(p.rawMaxHealth, 100, 'RawMaxHealth is not');
  sinks.heal(1000);
  assert.equal(p.health, lim, 'a heal stops at the limited ceiling');
  // the limiter is computed off the RAW maximum, never off itself (LycanthropyEffect.cs:234)
  runMagicRoundsFor(p, NOW, NOW + 1, { sinks });
  assert.ok(Math.abs(p.maxHealthLimiter - lim) <= 1, `a round later the limit has not collapsed onto itself: ${p.maxHealthLimiter}`);
  const snap = snapshotPlayer(p, { classicMinutes: NOW + 1 });
  assert.equal(snap.maxHealth, 100, 'SerializablePlayer.cs:118 writes RawMaxHealth');
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snap)));   // through the envelope's own JSON, as the slot stores it
  assert.equal(q.rawMaxHealth, 100);
  assert.equal(q.maxHealth, 100, 'the limiter is not saved: the next round rebuilds it');
});

test('DISC10-E L4: the accessor is installed where MaxMagicka\'s is - chargen and the load path', () => {
  assert.match(rd('src/systems/chargen.js'), /^ {2}defineLiveMaxHealth\(playerEntity\);/m);
  assert.match(rd('src/systems/save.js'), /^ {2}defineLiveMaxHealth\(entity\);/m);
});

// ── V9 / V11: THE CURSE'S CLOCKS ──────────────────────────────────────────────────────────────────────────────────

test('DISC10-E V9: going online SHIFTS the werewolf\'s kill clock and the lycanthropy infection\'s start day with the rest', () => {
  const p = werewolf();
  p.lastGameMinutes = 523530 + 10;
  const entry = liveLycanthropy(p);
  entry.lastKilledInnocent = 523530;
  entry.lastCastMorphSelf = 523530 + 5;
  const shift = 100 * MINUTES_PER_DAY;
  alignEntityClocks(p, 523530 + 10 + shift);
  assert.equal(entry.lastKilledInnocent, 523530 + shift, 'the kill is as long ago as it was');
  assert.equal(entry.lastCastMorphSelf, 523530 + 5 + shift, 'and so is the last change');
  const q = { isPlayer: true, level: 5, activeEffects: [], lastGameMinutes: 523530 + 10 };
  const inf = startInfection(q, INFECTION.Werewolf, { day: Math.floor((523530 + 10) / MINUTES_PER_DAY) });
  const day0 = inf.startingDay;
  alignEntityClocks(q, 523530 + 10 + shift);
  assert.equal(inf.startingDay, day0 + 100, 'the incubation neither jumps nor freezes');
  resetMagicRoundMarker(null);
});

test('DISC10-E V11: a save taken while the dream is up restores with the dream UNSCHEDULED, so the infection dreams again rather than stalling', () => {
  const p = { isPlayer: true, level: 5, activeEffects: [], health: 50, maxHealth: 50 };
  const inf = startInfection(p, INFECTION.Werewolf, { day: 100 });
  const pushed = [];
  const prev = setInfectionHost({ playVideo: (name) => pushed.push(name) });   // the dream is up and never closes
  try {
    runInfections(p, 102);
    assert.equal(inf.dreamScheduled, true);
    assert.equal(pushed.length, 1);
    const snap = snapshotPlayer(p, { classicMinutes: 102 * MINUTES_PER_DAY });
    const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snap)));   // through the envelope's own JSON, as the slot stores it
    const back = q.activeEffects.find((a) => a.infection === INFECTION.Werewolf);
    assert.equal(back.dreamScheduled, false, 'only the Played flags are saved');
    runInfections(q, 103);
    assert.equal(pushed.length, 2, 'the restored infection pushes its dream again');
  } finally { setInfectionHost(prev); }
});

// ── MORE OF THE SAME ROOTS ────────────────────────────────────────────────────────────────────────────────────────

test('DISC10-E V2: a werewolf infection ticked day by day through playerTicker turns INSIDE a round, and the curse\'s kill clock is that round\'s WorldTime.Now - the tick\'s own clock, not a past round\'s minute', async () => {
  const { createPlayerTicker } = await import('../src/scenes/shared.js');
  const prev = setInfectionHost({ playVideo: (name, onClose) => onClose() });   // the dream closes at once
  try {
    const day0 = Math.floor(523530 / MINUTES_PER_DAY) + 50;
    const t0 = day0 * MINUTES_PER_DAY + 10 * 60;
    setWorldMinutes(t0); resetMagicRoundMarker(t0);
    // the REAL host seam (scenes/shared.js), whose `nowMinutes` reads the world clock - which, INSIDE the tick, still
    // stands where the tick began: the round's own clock is the one the turn must be minted at
    const { wireInfectionVideos } = await import('../src/scenes/shared.js');
    wireInfectionVideos({ canvas: null }, { textAt: () => null });
    const p = { isPlayer: true, level: 5, activeEffects: [], spells: [], items: [], health: 1e6, maxHealth: 1e6, fatigue: 1e6, stats: { strength: 50, endurance: 50 }, lastGameMinutes: t0 };
    startInfection(p, INFECTION.Werewolf, { day: day0 });
    const ticker = createPlayerTicker(p, {});
    let turned = null;
    for (let d = 0; d < 8 && !turned; d++) {
      ticker.advance(MINUTES_PER_DAY);
      await settle(); await settle();   // the dream closes off the frame, as the seam closes it
      if (liveLycanthropy(p)) turned = Math.floor(worldMinutes());
    }
    assert.ok(turned, 'the fourth day turned the player');
    assert.equal(liveLycanthropy(p).lastKilledInnocent, turned, 'LycanthropyEffect.Start\'s UpdateSatiation read the clock (:159)');
  } finally { setInfectionHost(prev); resetMagicRoundMarker(null); }
});

test('DISC10-E V1: a catch-up window that CROSSED a full moon, arriving on a day that is not one, forces no change - the moon is read off the live clock', () => {
  // find an arrival minute whose day is NOT a full moon, with a full moon inside the 2880 rounds behind it
  let arrive = null;
  for (let m = 523530 + 10 * MINUTES_PER_DAY; m < 523530 + 400 * MINUTES_PER_DAY; m += MINUTES_PER_DAY) {
    if (!isFullMoonFromMinutes(m) && isFullMoonFromMinutes(m - MINUTES_PER_DAY)) { arrive = m; break; }
  }
  assert.ok(arrive, 'a moon to have crossed');
  const p = werewolf();
  liveLycanthropy(p).lastCastMorphSelf = 0;
  runMagicRoundsFor(p, arrive - 2880, arrive, { sinks: {} });
  assert.equal(liveLycanthropy(p).isTransformed, false, 'ForceTransformDuringFullMoon asks WorldTime.Now (LycanthropyEffect.cs:565-575)');
  runMagicRoundsFor(p, arrive - MINUTES_PER_DAY - 1, arrive - MINUTES_PER_DAY, { sinks: {} });
  assert.equal(liveLycanthropy(p).isTransformed, true, 'and on the full moon itself it forces the change');
});

test('DISC10-E L4: a level gained under the urge adds its hit points to the RAW maximum, never through the limiter', async () => {
  const { applyLevelUp } = await import('../src/systems/advancement.js');
  const p = chargen.defineLiveMaxHealth({ isPlayer: true, level: 5, readyToLevelUp: true, pendingLevel: 6, career: { hitPointsPerLevel: 10 }, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, health: 20, maxHealth: 100, activeEffects: [] });
  p.maxHealthLimiter = 30;
  assert.equal(p.maxHealth, 30);
  applyLevelUp(p, () => {}, () => 0.5);
  assert.ok(p.rawMaxHealth > 100, `the raw ceiling grew from 100: ${p.rawMaxHealth}`);
  assert.equal(p.maxHealth, 30, 'and the urge still holds it down');
  // ...and the Oblivion leveling lane's commit, the same law (ORL1 keeps Daggerfall's hit points)
  const { commitVirtueLevelUp } = await import('../src/systems/oblivionLeveling.js');
  const q = chargen.defineLiveMaxHealth({ isPlayer: true, level: 5, readyToLevelUp: true, pendingLevel: 6, career: { hitPointsPerLevel: 10 }, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, health: 20, maxHealth: 100, activeEffects: [], levelProgress: 0 });
  q.maxHealthLimiter = 30;
  assert.equal(commitVirtueLevelUp(q, {}, 0, null, () => 0.5), true);
  assert.ok(q.rawMaxHealth > 100, `the virtue lane too: ${q.rawMaxHealth}`);
});

test('DISC10-E L3: quick loot takes nothing into a beast\'s pack - it answers "open the window", and the window refuses', async () => {
  const { quickLootTake, foldQuickLoot, resetQuickLoot } = await import('../src/systems/quickLoot.js');
  const { hoverLines } = await import('../src/systems/worldHover.js');
  const { setPref, PREF_DEFAULTS } = await import('../src/systems/uiPrefs.js');
  setPref('quickLoot', true); resetQuickLoot();
  try {
    const items = [{ name: 'Longsword', group: 'Weapons', templateIndex: 121 }];
    const frame = () => { const { shown, rest, empty } = hoverLines(items); return { key: 'pile:1', kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty }; };
    const p = werewolf();
    morphSelf(p, { force: true, nowMinutes: NOW });
    foldQuickLoot(frame());
    assert.equal(quickLootTake('pile:1', { items: () => items }, p, () => {}), null);
    assert.equal(items.length, 1, 'the sword stayed on the pile');
    assert.equal(p.items.length, 0);
    // the same take in the flesh goes through (the control)
    morphSelf(p, { nowMinutes: NOW + 2 * MINUTES_PER_DAY });
    foldQuickLoot(frame());
    assert.equal(quickLootTake('pile:1', { items: () => items }, p, () => {})?.name, 'Longsword');
  } finally { resetQuickLoot(); setPref('quickLoot', PREF_DEFAULTS.quickLoot); }
});

test('DISC10-D H1: every player strike site calls the one dispatcher AFTER its door - the dungeon\'s swing (both arms), the encounter pool\'s, the watch\'s, the civilian\'s, the arrow\'s', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /attackFromPlayer\(foe, playerFeet\);[^\n]*\n\s*playerWeaponHitEntity\(playerEntity, foe\.entity, \{ mobileType: foe\.mobileType \}\);[^\n]*\n\s*continue;/, 'the dungeon\'s zero-damage connect');
  assert.match(d, /damageFoe\(foe, damage, playerFeet, lookDir\);[^\n]*\n\s*playerWeaponHitEntity\(playerEntity, foe\.entity, \{ mobileType: foe\.mobileType \}\);/, 'the dungeon\'s damaging connect');
  assert.match(rd('src/combat/arrowFlight.js'), /playerWeaponHitEntity\(playerEntity, foe\.entity, \{ mobileType: foe\.mobileType \?\? null \}\);\n\s*return dmg;/, 'the arrow, last');
});

// ── THE BEAST'S BLOW SOUNDS AS THE HAND'S, AND THE SMITH'S GIFT IS A DISPATCH ────────────────────────────────────

import { zeroDamageHitSound } from '../src/scenes/hostCombat.js';
import { hitSoundFor, SOUND } from '../src/systems/soundClips.js';

test('DISC10-E: the beast\'s blow SOUNDS as the empty hand\'s - PlayHitSound(currentRightHandWeapon) and :611\'s strikingWeapon, never the claws marker; the interior pool\'s hit sound reads the hand, at the foe', () => {
  setWorldMinutes(NOW + 30);
  const p = werewolf();
  morphSelf(p, { force: true, nowMinutes: NOW + 30 });
  const beast = swing(p);
  const lo = () => 0.99;
  assert.equal(hitSoundFor(beast.strikingWeapon, lo), hitSoundFor(null, lo), 'the landed blow: the weaponless family (Hit3/Hit4)');
  assert.ok(hitSoundFor(beast.strikingWeapon, lo) <= SOUND.Hit1 + 3, 'not the weapon family\'s top clip');
  const z = zeroDamageHitSound({ weapon: beast.strikingWeapon, arrowHit: false, parrySounds: true, roll: 0.5 });
  assert.deepEqual(z, zeroDamageHitSound({ weapon: null, arrowHit: false, parrySounds: true, roll: 0.5 }), 'the zero-damage arm: the swing, as a bare hand has (strikingWeapon == null)');
  // every player-strike site reads the hand (source: the hosts cannot run in node)
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const f of ['src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(src(f), /weapon: playerWeapon\.strikingWeapon, arrowHit: false,/, `${f}: the zero-damage arm reads the hand`);
    assert.doesNotMatch(src(f), /weapon: playerWeapon\.weapon, arrowHit: false,/, `${f}: and not the screen`);
  }
  assert.match(src('src/scenes/dungeonContext.js'), /audio\.play3d\(hitSoundFor\(playerWeapon\.strikingWeapon\), foe\.ai\.feet,/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /const guardHitSound = \(g\) => audio\.play3d\(hitSoundFor\(weaponRig\.playerWeapon\.strikingWeapon\), g\.ai\.feet,/, `${f}: the street's hit sound`);
  }
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const interiorHitSound = \(g\) => audio\.play3d\(hitSoundFor\(interiorWeapon\.playerWeapon\.strikingWeapon\), g\.ai\.feet, ENEMY_HIT_VOLUME,/, 'indoors: one hit sound, on the struck foe, with the hand');
  assert.doesNotMatch(wm, /\(wpn\) => audio\.playOneShot\(hitSoundFor\(wpn\)/, 'the foe pool\'s callback no longer reads the struck FOE as a weapon');
  assert.equal((wm.match(/makeInView\(proj, view, multiply\), interiorHitSound(?:, \{ swing \})?\)\)/g) ?? []).length, 2, 'both interior pools');   // AUDIT DISC18: the one swing's token rides beside it
});

test('DISC10-E: the knightly smith\'s gift, refused to a beast by the pack\'s own door, is a DISPATCH - not "That service is not available yet." on top of the refusal', () => {
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /if \(!win\) return inventoryDoorReady\(\) \? DOOR_REFUSED : null;/, 'a READY door that built nothing refused - by the door\'s own gate, never the curse asked at the host (L3\'s law)');
  assert.match(wm, /import \{ inventoryDoorReady \} from '\.\.\/ui\/inventoryDoor\.js';/);
  // and the door's two nulls are the two the host tells apart: its refusal, and nothing else once ready
  const door = readFileSync(new URL('../src/ui/inventoryDoor.js', import.meta.url), 'utf8');
  const body = door.slice(door.indexOf('export function createInventoryWindow'));
  assert.deepEqual(body.slice(0, body.indexOf('\n}\n')).match(/return null/g), ['return null'], 'the only null a ready door answers is the refusal');
});
