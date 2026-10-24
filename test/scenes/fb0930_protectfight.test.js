// PROTECT-FIGHT (2026-09-30, FIELD BUGS 2026-09-30 - a player's list through Mac: "Protect bystanders needs to work again
// - lost rep for no reason"; bible/01-Overview/bugs/Field-Bugs-2026-09-30.md). The menu's Protect Bystanders is DFU's
// MeleeAttackFriendlyProtection ("Protect Friendlies and Neutrals"), which spares a pacified foe and an ally and, outside
// a raid (RAID-GUARDS-NPC), never the street's walkers: a swing at a foe just past the reach landed on the townsperson on
// the look ray - Murder, -20 of the region's law at the arrest - or on a walking guard, Assault and the watch. Under the
// protection a fight (enemies near - the rest's own AreEnemiesNearby) now passes the walkers by as a raid does; with no
// enemy near, a blow at a townsperson is meant (a vampire's feeding, the Brotherhood's count) and DFU's rule stands, as it
// does with the protection off. A declared departure.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCityGuards } from '../../src/scenes/cityGuards.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { setValue } from '../../src/systems/settings/settings.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const townsman = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [],
  stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, health: 40, maxHealth: 40,
  crimeCommitted: 0, factionData: null, regionData: [] });
const rig = (playerEntity, host) => createCityGuards({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { throw new Error(`no ${n} in this pin`); }, getTexture: async () => ({}), uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...host,
});
const FEET0 = [0, 0, 0], EYE0 = [0, 1.6, 0], FWD0 = [0, 0, 1];
const inView = () => true;

test('PROTECT-FIGHT the law: under the protection, a fight spares the street\'s walkers - no Murder, no Assault, the swing stopped on them; no fight, or the protection off, and a blow at a townsperson is DFU\'s Murder (mutants: the fight unread; the protection unread; every blow spared)', async () => {
  const run = async ({ protection, fight }) => {
    setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', protection);
    const p = townsman();
    const guards = rig(p, { fightHere: () => fight });
    const hit = [];
    const townsperson = { pos: [0, 0, 1.5], fwdYaw: Math.PI, guard: false, disable: () => hit.push('townsperson') };
    let murders = 0;
    const r = await guards.resolveCivilianHit(new PlayerWeapon({}), EYE0, FWD0, FEET0, [townsperson], { onMurder: () => { murders++; }, inViewFn: inView });
    return { r, spares: guards.playerSparesPerson(townsperson), hit, murders, crime: p.crimeCommitted };
  };
  try {
    assert.deepEqual(await run({ protection: true, fight: true }), { r: { spared: true }, spares: true, hit: [], murders: 0, crime: 0 }, 'a fight, protected: passed by');
    assert.deepEqual(await run({ protection: true, fight: false }), { r: { crime: 'murder' }, spares: false, hit: ['townsperson'], murders: 1, crime: 5 }, 'no fight: the blow was meant');
    assert.deepEqual(await run({ protection: false, fight: true }), { r: { crime: 'murder' }, spares: false, hit: ['townsperson'], murders: 1, crime: 5 }, 'the protection off: DFU\'s rule');
  } finally { setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', true); }
});

test('PROTECT-FIGHT the hosts: both street hosts ask the rest\'s own AreEnemiesNearby over both street pools, and both riding tramples ask the walkers\' and the defenders\' rule (mutants: a host\'s fight unwired; the fixed-city host\'s trample unfiltered)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    const make = s.slice(s.indexOf('const cityGuards = createCityGuards({'), s.indexOf('\n  });', s.indexOf('const cityGuards = createCityGuards({')));
    assert.match(make, /\n {4}fightHere: \(\) => areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\),/, `${f}: the fight is the rest's own`);
    assert.match(s, /livePersons: \(\) => _livePersons\.filter\(\(seat\) => !cityGuards\.playerSparesPerson\(seat\.person\)\),/, `${f}: the trample passes the spared walkers by`);
    assert.match(s, /guards: \(\) => cityGuards\.guards\.filter\(\(g\) => !cityGuards\.playerSpares\(g\)\)/, `${f}: and the spared defenders`);
  }
});
