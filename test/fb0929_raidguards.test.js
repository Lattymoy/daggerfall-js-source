// FB0929 RAID-GUARDS (2026-09-29, Discord #bug-reports through Mac - Satranath: "Defending vs raids impossible, guards
// arrest you. Even with 'protect civilians from melee attacks' enabled, guards get hit in big battles and will arrest
// you. Nuked my rep trying to protect a town from a raid."). The setting is DFU's MeleeAttackFriendlyProtection
// ("Protect Friendlies and Neutrals"; the menu's "Protect Bystanders"). The world host offered one swing to the watch
// (its defenders spared), the monsters, then THE DEFENDERS ALONE (DISC19-F), and that last pass handed them to
// PlayerWeapon.resolveHit, whose protected fallback takes the NEAREST protected body anywhere in reach and view -
// Audit 28's stand-in for DFU's SphereCast down the look ray (WeaponManager.cs:1057-1064). So in a raid every swing
// that met no raider at its hit frame landed on whichever defender stood within the reach in view, and DISC19 W2 makes
// a blow on a defender Assault: the squad turns, the watch's first blow raises the Halt box (LowerRepForCrime, the
// region's legal reputation and its People), and the court follows. Under the protection the defenders now take none
// of the player's swing, whatever pass a host makes - as they take none of the player's spells, shafts and torches
// (AUDIT DISC19 W4) - and a defender on the look ray stays a swing that would otherwise fall on the townsperson behind
// him, the body DFU's SphereCast meets first. With the protection off the watch's own pass strikes him as DFU's box
// pass does, and a blow is still Assault (Mac's call, recorded).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { setValue } from '../src/systems/settings.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { chooseRaider, RAID_SPAWN_MIN_DISTANCE, RAID_SPAWN_MAX_DISTANCE, grantRaidReputation } from '../src/systems/raidingParties.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// the watch1 rig (auditdisc19.test.js's): a synthetic CLASS18.CFG and MONSTER.BSA holding the orc's ENEMY007.CFG,
// a flat open world
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
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
const ORCS = 2;   // the raid's party type (raidTypeName)
const ORC = chooseRaider(ORCS, () => 0);   // ChooseEnemy [IL_137c]: roll 0 of the orcs' table
const bsa = craftMonsterBsa([[`ENEMY${String(ORC).padStart(3, '0')}.CFG`, craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const townsman = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, health: 100, maxHealth: 100, crimeCommitted: 0 });
const rig = (playerEntity) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});
const FEET0 = [0, 0, 0], EYE0 = [0, 1.6, 0], FWD0 = [0, 0, 1];
/** The camera's view, as a cone about the look: a body 50 degrees off it is still on the screen. */
const inView = (c) => { const dx = c[0] - EYE0[0], dz = c[2] - EYE0[2]; return dz > 0 && Math.abs(Math.atan2(dx, dz)) < (50 * Math.PI) / 180; };

/** A raided town's street: an orc of the raid's own party six metres ahead (out of the swing's reach, hunting the
 *  player), and the raid's defenders minted by the raid's own producer (cityGuards.standDefender, RAID1) - one beside
 *  the player off the look ray, one in front on it, both inside the reach and the view. */
async function raidStreet(p, host = {}) {
  const guards = createCityGuards({ ...rig(p), ...host });
  const monsters = createExteriorFoes(rig(p));
  const orc = await monsters.spawnFoe(ORC, [0, 0, 6], { feetGiven: true, loose: true, transient: true });   // the raid host's standRaider: loose, transient
  orc.ai.target = PLAYER_TARGET;
  const stand = () => guards.standDefender({ playerFeet: FEET0, playerFwd: FWD0, threats: [orc], minDistance: RAID_SPAWN_MIN_DISTANCE, maxDistance: RAID_SPAWN_MAX_DISTANCE });
  const beside = await stand(), front = await stand();
  assert.ok(beside && front, 'the raid stood its two defenders');
  const put = (g, x, z) => { g.ai.feet[0] = x; g.ai.feet[1] = 0; g.ai.feet[2] = z; g.entity.health = 10000; };
  put(beside, 0.9, 1.3);   // 35 degrees off the look, 1.6 m out: in reach and in view, off the ray
  put(front, 0, 1.6);      // straight ahead
  return { guards, monsters, orc, beside, front };
}

/** Every option bag a host hands a WATCH pool's resolvePlayerHit, read off the hosts' own source - the world host's
 *  passes, the fixed-city host's, the interior's, and the pool's own carried swing (a wandering guard's Assault). */
function watchPassBags() {
  const bags = [];
  for (const [file, re] of [
    ['src/scenes/world.js', /cityGuards\.resolvePlayerHit\(/g],
    ['src/scenes/exterior.js', /cityGuards\.resolvePlayerHit\(/g],
    ['src/scenes/worldModes.js', /interiorGuards\?\.resolvePlayerHit\(/g],
    ['src/scenes/cityGuards.js', /carriedHit = resolvePlayerHit\(/g],
  ]) {
    const src = rd(file);
    for (const m of src.matchAll(re)) {
      let i = m.index + m[0].length, depth = 1;
      const start = i;
      for (; i < src.length && depth > 0; i++) { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; }
      const args = src.slice(start, i - 1).trim();
      const bag = args.endsWith('}') ? args.slice(args.lastIndexOf('{')) : '{}';
      bags.push({ file, text: bag, bag: new Function('swing', `return (${bag});`)({}) });
    }
  }
  return bags;
}

test('FB0929: under the protection a raid\'s defenders take none of a swing that met no raider, whatever pass a host makes - no blow, no Assault, the squad still the player\'s', async () => {
  const bags = watchPassBags();
  assert.ok(bags.filter((b) => b.file === 'src/scenes/world.js').length >= 1 && bags.length >= 4, `the hosts' watch passes read: ${bags.map((b) => `${b.file} ${b.text}`).join(' | ')}`);
  for (const { file, text, bag } of bags) {
    const p = townsman();
    const { guards, monsters, beside, front } = await raidStreet(p);
    const w = new PlayerWeapon({});
    const struck = [];
    w.onAttackResult = ({ foe }) => struck.push(foe);   // every connect resolveHit makes, the zero-damage one too
    assert.equal(monsters.resolvePlayerHit(w, EYE0, FWD0, FEET0, inView, null, {}), false, 'the orc is out of reach: the monsters\' pool misses');
    assert.equal(guards.resolvePlayerHit(w, EYE0, FWD0, FEET0, inView, null, bag), false, `${file} ${text}: the pass strikes nobody`);
    assert.equal(struck.length, 0, `${file} ${text}: no connect at all`);
    for (const d of [beside, front]) {
      assert.equal(d.entity.health, 10000, `${file} ${text}: no blow on a defender`);
      assert.equal(d.defender, true, 'still a defender');
      assert.deepEqual([d.entity.team, d.entity.mobileTeam], ['PlayerAlly', 'PlayerAlly'], 'still the player\'s ally');
    }
    assert.equal(p.crimeCommitted, 0, `${file} ${text}: no Assault - nothing for the Halt box to lower the region's reputation for`);
    assert.equal(guards.anyWatchStanding(), false, 'no watch turned on the player');
  }
});

test('FB0929: with the protection off and NO raid on in the town (DISC19-F\'s watch against a monster) the watch\'s pass strikes a defender in reach as DFU\'s box pass does - and a blow is still Assault (DISC19 W2, Mac\'s call)', async () => {
  const p = townsman();
  const { guards, beside, front } = await raidStreet(p);
  setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', false);
  try {
    const w = new PlayerWeapon({});
    const struck = [];
    w.onAttackResult = ({ foe }) => struck.push(foe);
    assert.equal(guards.resolvePlayerHit(w, EYE0, FWD0, FEET0, inView, null, { swing: {} }), true, 'the box pass reaches them');
    assert.deepEqual(new Set(struck), new Set([beside, front]), 'every body in reach, as MeleeDamage\'s OverlapBox takes them');
    assert.equal(p.crimeCommitted, 4, 'Assault');
  } finally { setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', true); }
});

test('FB0929: a defender on the look ray stays the swing - the townsperson behind him is not struck (the body DFU\'s SphereCast meets first) - and with nobody in front the townsperson is', async () => {
  const p = townsman();
  const guards = createCityGuards(rig(p));
  const monsters = createExteriorFoes(rig(p));
  const orc = await monsters.spawnFoe(ORC, [0, 0, 6], { feetGiven: true, loose: true, transient: true });
  const d = await guards.standDefender({ playerFeet: FEET0, playerFwd: FWD0, threats: [orc], minDistance: RAID_SPAWN_MIN_DISTANCE, maxDistance: RAID_SPAWN_MAX_DISTANCE });
  d.ai.feet[0] = 0; d.ai.feet[1] = 0; d.ai.feet[2] = 1.0;
  const struck = [];
  const townsperson = { pos: [0, 0, 2.0], fwdYaw: Math.PI, guard: false, disable: () => struck.push('townsperson') };
  let murders = 0;
  const w = new PlayerWeapon({});
  assert.deepEqual(await guards.resolveCivilianHit(w, EYE0, FWD0, FEET0, [townsperson], { onMurder: () => { murders++; }, inViewFn: inView }), { spared: true }, 'the swing stops on the defender (AUDIT 29g: said as stopped, not as met-nobody)');
  assert.deepEqual([struck, murders, p.crimeCommitted], [[], 0, 0], 'nobody behind him is murdered');
  guards.dismissDefenders();
  assert.deepEqual(await guards.resolveCivilianHit(w, EYE0, FWD0, FEET0, [townsperson], { onMurder: () => { murders++; }, inViewFn: inView }), { crime: 'murder' }, 'nobody in front: the townsperson is the only body there (DFU\'s own fallback)');
  assert.deepEqual([struck, murders, p.crimeCommitted], [['townsperson'], 1, 5]);
});

// RAID-GUARDS (2026-09-29, Mac, after FB0929: "Raids shouldnt let you damage the guards"): while a raid is on in the
// town, its defenders take none of the player's blows WHATEVER the setting - one question, cityGuards.playerSpares,
// asked by the swing, the riding charge's list and the damage door itself. The crime watch is never spared.
test('RAID-GUARDS: while a raid is on in the town its defenders take none of the player\'s blows whatever the setting - the swing, the charge\'s list and the damage door (no Assault) - and the crime watch is never spared', async () => {
  setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', false);
  try {
    const p = townsman();
    let raid = true;
    const { guards, beside, front } = await raidStreet(p, { raidHere: () => raid });
    const w = new PlayerWeapon({});
    const struck = [];
    w.onAttackResult = ({ foe }) => struck.push(foe);
    assert.equal(guards.resolvePlayerHit(w, EYE0, FWD0, FEET0, inView, null, { swing: {} }), false, 'the raid\'s defenders are not the swing\'s, the setting off');
    assert.equal(struck.length, 0);
    for (const d of [beside, front]) assert.equal(guards.playerSpares(d), true, 'spared');
    // the damage door: a blow of the player's that reaches it anyway lands nothing and is no crime; a raider's lands
    guards.hurtGuard(front, 50, FEET0);
    assert.deepEqual([front.entity.health, p.crimeCommitted, guards.anyWatchStanding()], [10000, 0, false], 'refused at the door - no Assault');
    guards.hurtGuard(front, 50, FEET0, null, { fromPlayer: false });
    assert.equal(front.entity.health, 9950, 'a raider\'s blow is the raid\'s');
    // the crime watch is never spared, raid or not
    const watchman = await guards.spawnCityGuard([0, 0, 1.2], 0, FEET0);
    assert.ok(watchman && !watchman.defender, 'a crime watchman, as spawnCityGuard mints him');
    assert.equal(guards.playerSpares(watchman), false);
    // the raid over, the setting decides again (off: DFU's box pass)
    raid = false;
    assert.equal(guards.playerSpares(front), false, 'no raid, no protection: DFU\'s ally rule');
  } finally { setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', true); }
  // THE HOST: the world host tells the pool where a raid is on, and the riding charge takes its guards through the rule
  const w = rd('src/scenes/world.js');
  assert.match(w, /createCityGuards\(\{[\s\S]{0,600}?raidHere: \(\) => raidDefendingHere\(\),/, 'world.js hands the pool the raid');
  assert.match(w, /guards: \(\) => cityGuards\.guards\.filter\(\(g\) => !cityGuards\.playerSpares\(g\)\),/, 'the charge asks the one rule');
});

test('RAID-REP: a cleanse raises the raided region\'s own standing and touches no other region\'s - its legal reputation, its People and its knightly order alone; the Fighters Guild\'s +3 is the one standing that is not a region\'s (Kamer\'s)', () => {
  const f = (id, o) => [id, { id, rep: 0, region: -1, type: 0, ggroup: 0, parent: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...o }];
  const store = { dict: new Map([
    // the other region's first in the dictionary, so a law that forgot the region would pay it
    f(519, { type: FACTION_TYPES.People, region: 18 }), f(518, { type: FACTION_TYPES.People, region: 17 }),
    f(410, { region: 18, ggroup: GUILD_GROUPS.KnightlyOrder }), f(409, { region: 17, ggroup: GUILD_GROUPS.KnightlyOrder }),
    f(41, { ggroup: GUILD_GROUPS.FightersGuild }),
  ]) };
  const player = { legalRep: { 17: 10, 18: 10, 20: -3 } };
  assert.equal(grantRaidReputation({ player, store }, 17), true);
  assert.deepEqual(player.legalRep, { 17: 15, 18: 10, 20: -3 }, 'the raided region alone');
  const rep = (id) => store.dict.get(id).rep;
  assert.deepEqual([rep(518), rep(519), rep(409), rep(410)], [5, 0, 3, 0], 'its People and its order, no other region\'s');
  assert.equal(rep(41), 3, 'the Fighters Guild, the Bay\'s own guild');
});

// RAID-GUARDS-NPC (FIELD BUGS 2026-09-29g, ! OG: "Hit a guard killed him in a raid", "so u can totaly kill citizens now,
// just fucked my rep in a raid ... Protect bystanders was on tooo"). RAID-GUARDS spared the raid's defenders and left
// the town's WALKING guard to DFU's mobile-NPC branch: one swing was Assault and minted a watchman from him, and the
// crime turned every defender into the crime watch on the next frame. While a raid is on the walking guard is spared
// too - the swing and the trample - and, first on the ray, he stops the swing as a defender does. And (Mac, on 29g's
// first draft: "Spare townspeople in raid") every townsperson the same: no Murder in a raid.
test('RAID-GUARDS-NPC: while a raid is on, the town\'s walkers take none of the player\'s swing - the walking guard (no Assault, no watchman minted) and the townsperson (no Murder), the defenders still the player\'s, nobody behind struck; no raid, DFU\'s Assault and Murder stand', async () => {
  const p = townsman();
  let raid = true;
  const { guards, beside, front } = await raidStreet(p, { raidHere: () => raid });
  // the defenders off the ray, so only the walking guard stands on it
  for (const d of [beside, front]) { d.ai.feet[0] = 3; d.ai.feet[2] = -3; }
  const w = new PlayerWeapon({});
  const hit = [];
  const guardNpc = { pos: [0, 0, 1.4], fwdYaw: Math.PI, guard: true, disable: () => hit.push('guard') };
  const townsperson = { pos: [0, 0, 2.0], fwdYaw: Math.PI, guard: false, disable: () => hit.push('townsperson') };
  let murders = 0;
  const before = guards.guards.length;
  assert.equal(guards.playerSparesPerson(guardNpc), true, 'a raid on: spared');
  assert.equal(guards.playerSparesPerson(townsperson), true, 'a townsperson too (Mac: "Spare townspeople in raid")');
  assert.deepEqual(await guards.resolveCivilianHit(w, EYE0, FWD0, FEET0, [guardNpc, townsperson], { onMurder: () => { murders++; }, inViewFn: inView }), { spared: true }, 'the swing passes him by, and stops on him');
  assert.deepEqual([hit, murders, p.crimeCommitted, guards.guards.length], [[], 0, 0, before], 'no Assault, no watchman minted, nobody behind him struck');
  assert.deepEqual(await guards.resolveCivilianHit(w, EYE0, FWD0, FEET0, [townsperson], { onMurder: () => { murders++; }, inViewFn: inView }), { spared: true }, 'the townsperson alone on the ray: spared');
  assert.deepEqual([hit, murders, p.crimeCommitted], [[], 0, 0], 'no Murder, no guards called');
  guards.update(0.016, FEET0, EYE0);
  for (const d of [beside, front]) assert.deepEqual([d.defender, d.entity.team], [true, 'PlayerAlly'], 'the squad still the player\'s');
  // the raid over: DFU's mobile-NPC branch - Assault, and the watchman minted from him; a townsperson, Murder
  raid = false;
  assert.equal(guards.playerSparesPerson(guardNpc), false);
  assert.equal(guards.playerSparesPerson(townsperson), false);
  const r = await guards.resolveCivilianHit(w, EYE0, FWD0, FEET0, [guardNpc], { inViewFn: inView });
  assert.equal(r.crime, 'assault');
  assert.deepEqual([hit, p.crimeCommitted], [['guard'], 4]);
  assert.deepEqual(await guards.resolveCivilianHit(w, EYE0, FWD0, FEET0, [townsperson], { onMurder: () => { murders++; }, inViewFn: inView }), { crime: 'murder' });
  assert.deepEqual([hit, murders, p.crimeCommitted], [['guard', 'townsperson'], 1, 5]);
  // THE HOST: the riding trample asks the same rule of the street's walkers
  assert.match(rd('src/scenes/world.js'), /livePersons: \(\) => _livePersons\.filter\(\(seat\) => !cityGuards\.playerSparesPerson\(seat\.person\)\),/, 'the trample passes a raid\'s walkers by');
  // AUDIT 29g: THE HOSTS' TAIL, RUN. A swing that stopped on a spared body met someone: no door behind him is bashed (a
  // break-in in town) and no HUD surfacing - it whooshes. A swing that met nobody is the door's; a crime surfaces.
  for (const [file, doorArgs] of [['src/scenes/world.js', 'cam.pos, lookFwd'], ['src/scenes/exterior.js', 'eye, fwd']]) {
    const src = rd(file);
    const at = src.indexOf('{ onMurder: () => _crimeResponse(), onHitSound: guardHitSound, swing }).then((r) => {');
    assert.ok(at > 0, `${file}: the civilian arm's tail`);
    const body = src.slice(src.indexOf('{\n', at) + 1, src.indexOf("}).catch((e) => console.error('[civil]', e));", at));
    const tail = (r) => {
      const d = { bashed: 0, whoosh: 0, surfaced: 0, tallied: 0 };
      new Function('r', 'modes', 'audio', 'surfacePlayer', 'tallySwingSkills', 'swingSoundFor', 'weaponRig', 'playerEntity', 'cam', 'lookFwd', 'eye', 'fwd', 'livingStrikeRoad', body)(
        r, { attemptExteriorDoorBash: () => { d.bashed++; return true; } }, { playOneShot: () => { d.whoosh++; } }, () => { d.surfaced++; }, () => { d.tallied++; },
        () => 'swing', { playerWeapon: {} }, {}, { pos: [0, 0, 0] }, [0, 0, 1], [0, 0, 0], [0, 0, 1], () => false);   // LW7: world.js offers a swing that met nobody to the road's travellers first - none here
      return d;
    };
    assert.ok(body.includes(`attemptExteriorDoorBash?.(${doorArgs})`));
    assert.deepEqual(tail({ spared: true }), { bashed: 0, whoosh: 1, surfaced: 0, tallied: 0 }, `${file}: stopped on a spared body - no door bashed`);
    assert.deepEqual(tail(false), { bashed: 1, whoosh: 0, surfaced: 0, tallied: 0 }, `${file}: met nobody - the door's`);
    assert.deepEqual(tail({ crime: 'murder' }), { bashed: 0, whoosh: 0, surfaced: 1, tallied: 0 }, `${file}: a crime surfaces`);
  }
});
