// DISC10-D - THE VAMPIRE, DRIVEN THROUGH THE LIVE DOORS.
//
// Mac (2026-09-23): "vampires and werewolf. I think these systems are completely broken and not wired correctly".
// These pins EXECUTE the port's own modules the way a host drives them - playerTicker's days through the real
// worldTick, the real infection host seam (scenes/shared.js wireInfectionVideos), the real encounter and watch pools
// with the real PlayerWeapon - and each failed on the code that shipped (DISC10 audits, HEAD e09a775d0):
//
//   H1  the feeding hook sat INSIDE the damage formula, past an early return for an ineffective weapon material, so
//       a vampire striking a silver-to-hit foe with iron never fed, and a civilian's murder never reached it
//       (WeaponManager.cs:514-521, :627-635 - OnWeaponHitEntity on EVERY connect, after the health is taken).
//   V1  catch-up magic rounds read DAYLIGHT at each past round's minute: a fast travel that arrived at night burned
//       a vampire for ~4320 (EntityEffectBroker.cs:210-232 raises every catch-up round at the CURRENT WorldTime;
//       PassiveSpecialsEffect.cs:149-172 reads WorldTime.Now.IsDay).
//   V2  the curse was only minted in the NEXT window's first round, 2879 minutes in the past, so a new vampire woke
//       unfed and could not rest (VampirismInfection.cs:176-184 assigns it inside the deploy, after the RaiseTime;
//       VampirismEffect.cs:95-96 UpdateSatiation at the new clock).
//   V3  the clan never depended on the region: neither bite site passed it (VampirismInfection.cs:91), and -1 asked
//       FACTION.TXT for "any province" (FormulaHelper.GetVampireClan :400-427 reads the player's own faction data).
//   V4  the cemetery transfer ran in exterior mode only (VampirismInfection.cs:164-174 RespawnPlayer from anywhere).
//   V5  the character sheet showed the birth race (PlayerEntity.RaceTemplate IS the compound race, :151, :233-241).
//   V8  the rest window survived the turn (VampirismInfection.cs:152-154 closes it first).
//   V9  going online shifted every marker but the infection's own start day.
//   V11 the save kept `dreamScheduled` (VampirismInfection.cs:221-251 saves the two Played flags).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { createPlayerTicker, wireInfectionVideos } from '../src/scenes/shared.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import {
  createVampirismCurse, liveVampirism, racialRestBlock, isVampireSatiated, NOT_SATED_TEXT_ID,
} from '../src/systems/vampirism.js';
import * as vampirism from '../src/systems/vampirism.js';   // a namespace: a pin fails on its law, not on an import
import {
  VAMPIRE_CLANS, INFECTION, startInfection, runInfections, setInfectionHost, liveInfection,
} from '../src/systems/infection.js';
import {
  setWorldMinutes, worldMinutes, resetMagicRoundMarker, alignEntityClocks,
} from '../src/systems/worldTick.js';
import { setPassiveSpecialsHost, SUN_DAMAGE_AMOUNT, SUN_DAMAGE_PER_ROUNDS } from '../src/systems/passiveSpecials.js';
import { MINUTES_PER_DAY, isDayFromMinutes } from '../src/systems/gameDate.js';
import { SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';   // VAMP-DAY: V1's burn is the career's now
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { _resetNotifyForTests } from '../src/systems/notify.js';
import * as vampirismWorld from '../src/systems/worldTick.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const START = 523530;   // CLASSIC_GAME_START_TIME
/** The minute of `hour`:00 on classic day `day`. */
const at = (day, hour) => day * MINUTES_PER_DAY + hour * 60;
const settle = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

// ---- the rig (test/watch1.test.js's crafted pools, a vampire's career beside the rat's) --------------------------
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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY028.CFG', craftCfg({ speed: 10 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const rig = (playerEntity, extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  // a floor that holds a walker where it stands (the bite pin re-poses the vampire every frame anyway)
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, move: () => ({ grounded: true, hitCeiling: false }),
    capsuleCast: () => ({ dist: Infinity, normal: null }), sphereCast: () => ({ dist: Infinity, normal: null }) },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => worldMinutes(), currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0, rand: () => 0, say: () => {},
  ...extra,
});
const EYE = [0, 1.6, 0], FEET = [0, 0, 0], FWD = [0, 0, 1];

function mortal(over = {}) {
  return {
    isPlayer: true, name: 'Mac', race: 'Breton', gender: 'male', level: 10, reflexes: 2,
    skills: new Array(40).fill(100), skillUses: new Array(40).fill(0),
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 },
    items: [], activeEffects: [], spells: [], health: 1e6, maxHealth: 1e6, fatigue: 1e6, crimeCommitted: 0,
    ...over,
  };
}
function vampire(clan = VAMPIRE_CLANS.Lyrezi, now = START) {
  const p = mortal();
  createVampirismCurse(p, clan, { now });
  return p;
}
/** The player's own FACTION.TXT store (PersistentFactionData), two provinces held by two clans. */
const REGION_A = 17, REGION_B = 18;
function withProvinces(p) {
  const dict = new Map([
    [201, { id: 201, type: FACTION_TYPES.Province, region: REGION_A, vam: VAMPIRE_CLANS.Haarvenu, rep: 0 }],
    [202, { id: 202, type: FACTION_TYPES.Province, region: REGION_B, vam: VAMPIRE_CLANS.Khulari, rep: 0 }],
  ]);
  p.factionRep = { dict };
  return p;
}

// ── H1: EVERY CONNECT FEEDS ───────────────────────────────────────────────────────────────────────────────────────

test('DISC10-D H1: a vampire\'s iron blade on a silver-to-hit foe does no damage and STILL FEEDS - OnWeaponHitEntity is outside the formula (WeaponManager.cs:627-635)', async () => {
  setWorldMinutes(START + 3 * MINUTES_PER_DAY);
  const p = vampire();
  assert.equal(isVampireSatiated(p, worldMinutes()), false, 'three days unfed');
  const pool = createExteriorFoes(rig(p));
  const rat = await pool.spawnFoe(0, [0, 0, 1.2], { feetGiven: true });
  rat.entity.minMetalToHit = WEAPON_MATERIALS.Silver;   // a ghost's hide
  const pw = new PlayerWeapon({ weapon: { group: 'Weapons', templateIndex: 120, material: WEAPON_MATERIALS.Iron, name: 'Longsword' } });
  const before = rat.entity.health;
  assert.equal(pool.resolvePlayerHit(pw, EYE, FWD, FEET, () => true), true, 'the swing connected');
  assert.equal(rat.entity.health, before, 'the material gate took the damage to nothing');
  assert.equal(liveVampirism(p).lastTimeFed, Math.floor(worldMinutes()), 'and the vampire fed at the live minute');
  assert.equal(racialRestBlock(p, worldMinutes()), null, 'so it may rest');
});

test('DISC10-D H1: a vampire who murders a townsperson feeds - the civilian arm reaches the hook after SetHealth(0) (WeaponManager.cs:514-521)', async () => {
  setWorldMinutes(START + 5 * MINUTES_PER_DAY + 11);
  const p = vampire();
  const guards = createCityGuards(rig(p));
  const pool = [{ pos: [0, 0, 1.4], fwdYaw: Math.PI, guard: false, disable: () => {} }];
  const r = await guards.resolveCivilianHit(new PlayerWeapon({ weapon: null }), EYE, FWD, FEET, pool, {});
  assert.deepEqual(r, { crime: 'murder' });
  assert.equal(liveVampirism(p).lastTimeFed, START + 5 * MINUTES_PER_DAY + 11);
});

test('DISC10-D H1: a SPELL is not a weapon strike - the damage door alone feeds no one', async () => {
  setWorldMinutes(START + 5 * MINUTES_PER_DAY);
  const p = vampire();
  const pool = createExteriorFoes(rig(p));
  const rat = await pool.spawnFoe(0, [0, 0, 1.2], { feetGiven: true });
  pool.damageFoe(rat, 1, FEET, null, { kind: 'spell' });
  assert.equal(liveVampirism(p).lastTimeFed, START, 'a Fireball is not a bite');
});

// ── V1: THE CATCH-UP ROUNDS READ TODAY'S SKY ──────────────────────────────────────────────────────────────────────

test('DISC10-D V1: a two-day fast travel that ARRIVES AT NIGHT burns a sun-damaged career for nothing; one that arrives by day burns every 4th round - and (VAMP-DAY) a vampire burns in neither, its catch-up reading the arrival\'s hour for its +20 or -20', () => {
  const prevHost = setPassiveSpecialsHost({ isInside: () => false, inPrison: () => false });
  try {
    const day = Math.floor(START / MINUTES_PER_DAY) + 10;
    const t0 = at(day, 19);   // 19:00, a vampire's waking hour
    const t1 = at(day + 5, 1);
    assert.equal(isDayFromMinutes(t0 + 2 * MINUTES_PER_DAY), false, 'the arrival is night');
    // the two windows through the real ticker: a travel raised whole to a night arrival, then 01:00 to a noon arrival
    const run = (p) => {
      setWorldMinutes(t0); resetMagicRoundMarker(t0); p.lastGameMinutes = t0;
      const ticker = createPlayerTicker(p, {});
      ticker.advance(2 * MINUTES_PER_DAY);   // the travel window, raised whole
      assert.equal(Math.floor(worldMinutes()), t0 + 2 * MINUTES_PER_DAY);
      const night = { hurt: 1e6 - p.health, mod: p.racialOverride?.statMods?.strength };
      setWorldMinutes(t1); resetMagicRoundMarker(t1); p.lastGameMinutes = t1;
      ticker.advance(at(day + 5, 12) - t1);
      return { night, noon: { hurt: 1e6 - p.health - night.hurt, mod: p.racialOverride?.statMods?.strength } };
    };
    // the law V1 pinned, on the career's DamageFromSunlight (the vampire's own sun arm is gone - VAMP-DAY)
    const sun = run(mortal({ career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.sunDamage } }));
    assert.equal(sun.night.hurt, 0, 'no sun reaches one who arrives in the dark');
    // ...and the same law by day: the live clock says day, so every 4th round of the window burns
    const burns = Math.floor((at(day + 5, 12) - t1) / SUN_DAMAGE_PER_ROUNDS);   // under the 2880 cap
    assert.ok(Math.abs(sun.noon.hurt - burns * SUN_DAMAGE_AMOUNT) <= SUN_DAMAGE_AMOUNT, `noon arrival: ${sun.noon.hurt} ~ ${burns * SUN_DAMAGE_AMOUNT}`);
    // VAMP-DAY: the vampire - no burn either way, and its stats read the arrival's hour
    const v = run(vampire(VAMPIRE_CLANS.Lyrezi, t0));
    assert.deepEqual([v.night.hurt, v.noon.hurt], [0, 0], 'the sun burns a vampire no more');
    assert.deepEqual([v.night.mod, v.noon.mod], [20, -20], 'a night arrival wakes strong, a noon arrival weak');
  } finally { setPassiveSpecialsHost(prevHost); }
});

// ── V2 / V8: THE TURN, THROUGH THE TICKER'S DAYS ──────────────────────────────────────────────────────────────────

test('DISC10-D V2: an infection ticked day by day through playerTicker turns, and the new vampire WAKES FED at the risen clock - the curse is minted in the deploy, not 2879 minutes in the past', async () => {
  _resetNotifyForTests();
  const prev = setInfectionHost(null);
  const unhost = wireInfectionVideos({ canvas: null }, { textAt: () => ['Death is not eternal.'] });
  try {
    const day0 = Math.floor(START / MINUTES_PER_DAY) + 20;
    const t0 = at(day0, 10);
    setWorldMinutes(t0); resetMagicRoundMarker(t0);
    const p = withProvinces(mortal());
    p.lastGameMinutes = t0;
    const inf = startInfection(p, INFECTION.Vampirism, { day: day0, regionIndex: REGION_A });
    assert.ok(inf, 'bitten');
    const ticker = createPlayerTicker(p, {});
    let turnedAt = null;
    for (let d = 0; d < 8 && turnedAt === null; d++) {
      ticker.advance(MINUTES_PER_DAY);
      await settle();   // the dream's and the death's videos close off the frame, as the seam closes them
      if (!liveInfection(p)) turnedAt = worldMinutes();   // the deploy ENDED the disease - the turn is over
    }
    assert.ok(turnedAt, 'the fourth day turned the player');
    const curse = liveVampirism(p);
    assert.ok(curse, 'the curse is on the player the moment the deploy ends - no later round owes it');
    assert.equal(curse.lastTimeFed, Math.floor(turnedAt), 'UpdateSatiation ran at the RISEN clock (VampirismEffect.cs:95-96)');
    assert.equal(new Date(0).getTime(), 0);
    assert.equal(Math.floor((turnedAt % MINUTES_PER_DAY) / 60), 19, 'the fortnight raise lands at 19:00');
    assert.equal(p.racialOverridePending ?? null, null, 'no marker left standing for a later round');
    // the next frame's catch-up window runs the fortnight's rounds - and the vampire is still fed
    ticker.tick(0.016);
    assert.equal(racialRestBlock(p, worldMinutes()), null, `a new vampire may rest (TEXT.RSC ${NOT_SATED_TEXT_ID} is for the unfed)`);
    assert.equal(curse.clan, VAMPIRE_CLANS.Haarvenu, 'and belongs to the clan of the province it was bitten in');
    assert.equal(liveInfection(p), null, 'the disease ended with the turn');
  } finally { unhost && setInfectionHost(unhost); setInfectionHost(prev); }
});

test('DISC10-D V8: the deploy closes the rest window FIRST, then raises, transfers, mints and speaks - DeployFullBlownVampirism\'s order (VampirismInfection.cs:148-192)', () => {
  const order = [];
  const p = mortal();
  startInfection(p, INFECTION.Vampirism, { day: 100 });
  const inf = liveInfection(p);
  inf.dreamPlayed = true;
  const prev = setInfectionHost({
    playVideo: (name, onClose) => onClose(),
    cancelRest: () => order.push('cancelRest'),
    raiseTime: () => { order.push('raise'); },
    transferToCemetery: () => order.push('transfer'),
    messageBox: () => order.push(liveVampirism(p) ? 'box+curse' : 'box'),
    nowMinutes: () => 105 * MINUTES_PER_DAY,
    hourNow: () => 10,
  });
  try {
    runInfections(p, 105);
    assert.deepEqual(order, ['cancelRest', 'raise', 'transfer', 'box+curse']);
  } finally { setInfectionHost(prev); }
});

test('DISC10-D V8: every host that can hold a rest window hands the deploy its cancelRest', () => {
  // world.js registers it TWICE - its own seam, and the bag worldModes re-registers the session's seam from
  assert.equal((rd('src/scenes/world.js').match(/^\s*cancelRest: cancelRestArm,/gm) ?? []).length, 2, 'world.js: its seam and the mode machine\'s bag');
  assert.match(rd('src/scenes/worldModes.js'), /cancelRest: \(\) => \{ if \(interiorOverlay\?\.isRestWindow\) interiorOverlay\.dispose\?\.\(\); host\.cancelRest\?\.\(\); \},/, 'worldModes closes a building\'s and forwards the street\'s');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(host), /cancelRest: (?:\(\) => \{[^\n]*isRestWindow\) [^\n]*\.dispose\?\.\(\)|cancelRestArm)/, `${host} registers cancelRest`);
  }
});

// ── V3: THE CLAN IS THE REGION'S ──────────────────────────────────────────────────────────────────────────────────

test('DISC10-D V3: the clan is read off the PLAYER\'s own faction store by the region the bite happened in - two provinces, two clans, even through the dungeon\'s lean host', async () => {
  const prev = setInfectionHost(null);
  try {
    for (const [region, clan] of [[REGION_A, VAMPIRE_CLANS.Haarvenu], [REGION_B, VAMPIRE_CLANS.Khulari], [-1, VAMPIRE_CLANS.Lyrezi]]) {
      setWorldMinutes(at(104, 10));
      // the dungeon's registration: no FACTION.TXT of its own (dungeonContext.js)
      wireInfectionVideos({ canvas: null }, { textAt: () => null });
      const p = withProvinces(mortal());
      startInfection(p, INFECTION.Vampirism, { day: 100, regionIndex: region });
      liveInfection(p).dreamPlayed = true;
      runInfections(p, 104);   // the death video, pushed; the turn hangs off its close
      await settle();
      assert.equal(liveVampirism(p)?.clan ?? p.racialOverridePending?.clan, clan, `region ${region}`);
    }
  } finally { setInfectionHost(prev); }
});

test('DISC10-D V3: a vampire\'s bite above ground records the pool\'s CURRENT region on the infection (VampirismInfection.cs:91)', async () => {
  setWorldMinutes(START + 30 * MINUTES_PER_DAY);
  const p = mortal({ level: 5, health: 1e6 });
  const pool = createExteriorFoes(rig(p, { regionIndex: () => REGION_B, playerSinks: { hurt: () => {}, drainFatigue: () => {} } }));
  const v = await pool.spawnFoe(28, [0, 0, 1.0], { feetGiven: true, yaw: Math.PI });
  assert.ok(v, 'a vampire stands off the crafted MONSTER.BSA');
  let inf = null;
  for (let i = 0; i < 40 && !inf; i++) {
    v.ai.feet[0] = 0; v.ai.feet[2] = 1.0; v.ai.yaw = Math.PI; v.ai._dist = 1.0; v.ai.inSight = true;
    v.mobile.doMeleeDamage = true;
    pool.update(0.016, FEET, EYE);
    inf = liveInfection(p);
  }
  assert.ok(inf, 'the bite took (SPECIAL_INFECTION_CHANCE on a zero roll)');
  assert.equal(inf.infection, INFECTION.Vampirism);
  assert.equal(inf.regionIndex, REGION_B, 'the region the player stood in');
});

test('DISC10-D V3: the dungeon\'s bite passes its location\'s region too', () => {
  const d = rd('src/scenes/dungeonContext.js');
  const i = d.indexOf('onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {');
  assert.ok(i > 0);
  assert.match(d.slice(i, i + 400), /regionIndex: /, 'the rider carries PlayerGPS.CurrentRegionIndex');
});

// ── V4: THE CEMETERY FROM ANYWHERE ────────────────────────────────────────────────────────────────────────────────

test('DISC10-D V4: the cemetery transfer forces the exterior first (RespawnPlayer from any context), and the dungeon host carries the arm', () => {
  const w = rd('src/scenes/world.js');
  const i = w.indexOf('function transferToCemeteryArm()');
  const body = w.slice(i, w.indexOf('\n  }\n', i));
  assert.doesNotMatch(body, /!== 'exterior'\) \{\s*console\.warn/, 'no exterior-only refusal');
  assert.match(body, /forceExitToExterior\(\)/, 'the port\'s own _respawnAtSite shape');
  assert.match(rd('src/scenes/worldModes.js'), /transferToCemetery: \(\) => host\.transferToCemetery\?\.\(\)/, 'worldModes hands the arm to buildDungeonContext');
  assert.match(rd('src/scenes/dungeonContext.js'), /transferToCemetery: opts\.transferToCemetery \?\? null/, 'the dungeon registers it');
});

// ── V5: THE SHEET SHOWS THE COMPOUND RACE ─────────────────────────────────────────────────────────────────────────

test('DISC10-D V5: the character sheet reads the LIVE race - "Vampire" for the vampire, the beast\'s name while transformed', async () => {
  const p = vampire();
  assert.equal(vampirism.liveRaceTemplate?.(p)?.name, 'Vampire');
  assert.equal(sheetModel(p).race, 'Vampire', 'the enhanced sheet');
  assert.equal(sheetModel(mortal()).race, 'Breton', 'a mortal keeps the birth race');
  assert.match(rd('src/ui/charsheet.js'), /label\(liveRaceTemplate\(e\)/, 'the classic sheet reads the same');
  // CreateCompoundRace (VampirismEffect.cs:326-338): the flags ride the live template too
  const t = vampirism.liveRaceTemplate(p);
  assert.equal(t.immunityFlags & 1, 1, 'immune to Paralysis');
  assert.equal(t.immunityFlags & 64, 64, 'immune to Disease');
});

// ── V9 / V11 ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('DISC10-D V9: going online shifts the infection\'s start day with the save\'s own clock', () => {
  const p = mortal({ lastGameMinutes: START + 10 });
  const inf = startInfection(p, INFECTION.Vampirism, { day: Math.floor((START + 10) / MINUTES_PER_DAY) });
  const d0 = inf.startingDay;
  alignEntityClocks(p, START + 10 + 30 * MINUTES_PER_DAY);
  assert.equal(inf.startingDay, d0 + 30);
  resetMagicRoundMarker(null);
});

test('DISC10-D V11: a vampire\'s dream interrupted by a save dreams again after the load', () => {
  const p = mortal();
  const inf = startInfection(p, INFECTION.Vampirism, { day: 100 });
  const pushed = [];
  const prev = setInfectionHost({ playVideo: (name) => pushed.push(name) });
  try {
    runInfections(p, 101);
    assert.equal(inf.dreamScheduled, true);
    const q = { isPlayer: true };
    restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 101 * MINUTES_PER_DAY }))));
    runInfections(q, 102);
    assert.deepEqual(pushed, ['ANIM0004.VID', 'ANIM0004.VID']);
  } finally { setInfectionHost(prev); }
});

test('DISC10-D H1: a vampire\'s ARROW feeds like the swing - BowDamage is a WeaponDamage (DaggerfallMissile.cs:680-687), and the zero-damage shaft into a ghost counts', async () => {
  const { playerArrowHitFoe } = await import('../src/combat/arrowFlight.js');
  setWorldMinutes(START + 9 * MINUTES_PER_DAY + 3);
  const p = vampire();
  const foe = { entity: { health: 50, maxHealth: 50, level: 1, stats: { agility: 50, luck: 50 }, skills: 0, armorValues: new Array(7).fill(0), minMetalToHit: WEAPON_MATERIALS.Silver, items: [] }, ai: { feet: [0, 0, 5], yaw: 0 }, mobileType: 0 };
  const shaft = { weapon: { group: 'Weapons', templateIndex: 131, name: 'Arrow', material: WEAPON_MATERIALS.Iron }, pos: [0, 1, 4], dir: [0, 0, 1] };
  let dealt = null;
  const dmg = playerArrowHitFoe(shaft, foe, { playerEntity: p, dealDamage: (f, d) => { dealt = d; }, rolls: () => 0 });
  assert.equal(dmg, 0, 'iron on a ghost');
  assert.equal(dealt, null, 'no damage door for a zero shaft');
  assert.equal(liveVampirism(p).lastTimeFed, START + 9 * MINUTES_PER_DAY + 3, 'and still a feed');
});

test('DISC10-D V2: a save restored between the turn and the curse (the pending marker standing) is minted by the next window at the LIVE clock, not its first past round', () => {
  const t = at(Math.floor(START / MINUTES_PER_DAY) + 70, 21);
  const p = mortal();
  p.racialOverridePending = { key: INFECTION.Vampirism, lycanthropy: 0, clan: VAMPIRE_CLANS.Selenu };
  setWorldMinutes(t);
  const { runMagicRoundsFor } = vampirismWorld;
  runMagicRoundsFor(p, t - 2880, t, { sinks: {} });
  const curse = liveVampirism(p);
  assert.ok(curse, 'consumed');
  assert.equal(curse.clan, VAMPIRE_CLANS.Selenu);
  assert.equal(curse.lastTimeFed, t, 'VampirismEffect.Start\'s UpdateSatiation reads WorldTime.Now (:95-96)');
});
