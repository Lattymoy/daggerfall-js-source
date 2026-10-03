// LOOT7 - CHAMPION FOES (2026-10-01; bible/06-Systems/Loot-Arc.md section 9, Mac: "Do you wanna turn this into an arc
// and do all of the above?" - "Champion foes. Single named foes with visible traits (Fiery, Swift, Vampiric) and a
// guaranteed Rare"). The laws pinned here:
//   - THE TRAITS: five, each a name that is its id's (the HUD's leaf spells it), each what its sentence says.
//   - WHO: about one foe in fourteen (CHAMP-RATE, was twenty) - a dungeon's by a hash of the place and the marker (every client the same), the
//     street's by its owner's roll and carried to every puppet (`cp`), a save's kept; never under level 3, the watch,
//     an ally; off, none.
//   - WHAT: twice its health and its blows a quarter harder (on any elite's), its trait on top; its name everywhere.
//   - ITS LOOT: a stronger source, and a Rare or better always - never its worn kit.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as CH from '../src/systems/champions.js';
import * as LR from '../src/systems/lootRarity.js';
import { spawnEnemyLoot, ensureChampionLoot } from '../src/scenes/hostCombat.js';
import { equipTableOf } from '../src/systems/equip.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { validFoeRecord } from '../src/net/wire.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';
import { sayEnemyDied } from '../src/scenes/corpseMarker.js';
import { markFoeStruck, foeTarget, clearFoeTarget } from '../src/ui/hudFoeTarget.js';
import { liveEntityName } from '../src/systems/worldTooltips.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { isAmmunition } from '../src/systems/itemTemplates.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const on = () => { _resetForTests(); setPref('lootRarity', true); CH._resetStreetChampionsForTests(); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const foe = (level = 10, extra = {}) => ({ level, health: 40, maxHealth: 40, stats: { speed: 50 }, mobileType: 7, ...extra });
const player = { level: 10, gender: 'male', stats: { luck: 50 }, activeEffects: [] };
const seq = (...v) => () => v.shift();

test('LOOT7: the traits - five, each named as its id reads, the wire\'s order its index', () => {
  assert.deepEqual(CH.CHAMPION_TRAITS.map((t) => t.id), ['mighty', 'stalwart', 'swift', 'vampiric', 'thorned']);
  for (const t of CH.CHAMPION_TRAITS) {
    assert.equal(t.name, t.id.charAt(0).toUpperCase() + t.id.slice(1), `${t.id}: the HUD's leaf title-cases the id`);
    assert.ok(t.text, t.id);
    assert.equal(CH.championIndex(t.id), CH.CHAMPION_TRAITS.indexOf(t));
  }
  assert.equal(CH.CHAMPION_PER_MILLE, 70, 'CHAMP-RATE: 70, was 50');
  assert.equal(CH.CHAMPION_MIN_LEVEL, 3);
  assert.equal(CH.CHAMPION_TRAITS.length - 1 <= 15, true, 'the wire has room for every index');
});

test('LOOT7: the dungeon\'s - a hash of the place and the marker, the same every time, about one in fourteen; never an ally; off none', () => {
  on();
  const layout = (n) => Array.from({ length: n }, (_, i) => ({ mobileType: 7, x: i, y: 0, z: 0 }));
  let marked = 0, total = 0;
  for (let loc = 1; loc <= 400; loc++) {
    const a = layout(25), b = layout(25);
    const na = CH.markDungeonChampions(a, loc * 7919);
    CH.markDungeonChampions(b, loc * 7919);
    assert.deepEqual(a.map((e) => e.champion ?? null), b.map((e) => e.champion ?? null), 'every client the same');
    for (const e of a) if (e.champion != null) assert.ok(Number.isInteger(e.champion) && CH.CHAMPION_TRAITS[e.champion]);
    marked += na; total += 25;
  }
  assert.ok(Math.abs(marked / total - 0.07) < 0.01, `about one in fourteen (${marked} of ${total})`);
  const seen = new Set();
  for (let loc = 1; loc <= 400; loc++) { const a = layout(25); CH.markDungeonChampions(a, loc); for (const e of a) if (e.champion != null) seen.add(e.champion); }
  assert.equal(seen.size, 5, 'every trait stands somewhere');
  const allies = layout(200).map((e) => ({ ...e, allied: true }));
  assert.equal(CH.markDungeonChampions(allies, 3), 0, 'never an ally');
  // THE HASH IS THE BUILD'S WORD: a client on another build must stand the same champions - these never move
  const forty = (loc) => { const a = Array.from({ length: 40 }, () => ({})); CH.markDungeonChampions(a, loc); return a.flatMap((e, i) => (e.champion != null ? [[i, e.champion]] : [])); };
  assert.deepEqual(forty(2), [[2, 2], [3, 0], [12, 3], [21, 1], [30, 3]]);   // CHAMP-RATE: 70 per mille keeps every pick of 50's and adds
  assert.deepEqual(forty(7), [[5, 0], [17, 4], [36, 0]]);
  const first = [{}];
  CH.markDungeonChampions(first, 39);
  assert.equal(first[0].champion, 4, 'location 39 marks its first marker the Thorned');
  const kept = [{ champion: 2 }];
  assert.equal(CH.markDungeonChampions(kept, 39), 0);
  assert.equal(kept[0].champion, 2, 'a mark rides its record - a rebuild keeps it');
  off();
  assert.equal(CH.markDungeonChampions(layout(500), 5), 0, 'off: none');
});

test('LOOT7: the street\'s - a hash of where it stands, its type and the count, never a draw; one in fourteen; the record carries it and refuses a forged one', () => {
  on();
  const r = lcg(4);
  const spots = Array.from({ length: 20000 }, () => [r() * 4000 - 2000, 0, r() * 4000 - 2000]);
  const real = Math.random;
  Math.random = () => { throw new Error('a draw'); };
  let first;
  try { first = spots.map((p, i) => CH.rollStreetChampion(p, i % 40)); } finally { Math.random = real; }
  const marked = first.filter((c) => c != null);
  assert.ok(Math.abs(marked.length / 20000 - 0.07) < 0.006, `about one in fourteen (${marked.length})`);
  assert.equal(new Set(marked).size, 5, 'every trait');
  CH._resetStreetChampionsForTests();
  assert.deepEqual(spots.map((p, i) => CH.rollStreetChampion(p, i % 40)), first, 'the same street stands the same champions - a seeded test\'s too');
  CH._resetStreetChampionsForTests();
  const street = [];
  for (let i = 0; i < 200; i++) { const c = CH.rollStreetChampion([i * 7.5, 0, i * -3.25], 7); if (c != null) street.push([i, c]); }
  assert.deepEqual(street, [[2, 4], [6, 2], [12, 2], [26, 4], [28, 1], [33, 0], [37, 2], [56, 2], [67, 2], [74, 0], [78, 4], [79, 2], [103, 3], [118, 3], [139, 2], [141, 3], [159, 2], [163, 3], [168, 1], [178, 0], [181, 1], [199, 0]], 'golden (CHAMP-RATE: 50\'s twelve kept, ten more)');
  CH._resetStreetChampionsForTests();
  assert.notDeepEqual(Array.from({ length: 200 }, (_, i) => CH.rollStreetChampion([i * 7.5, 0, i * -3.25], 8)), Array.from({ length: 200 }, (_, i) => street.find(([j]) => j === i)?.[1] ?? null), 'its type is in the hash');
  off();
  assert.ok(Array.from({ length: 200 }, (_, i) => CH.rollStreetChampion([i * 7.5, 0, i * -3.25], 7)).every((c) => c === null), 'off: none');
  on();
  assert.deepEqual(validFoeRecord({ i: 3, cp: 4 }), { i: 3, cp: 4 });
  for (const bad of [-1, 16, 1.5, 'x']) assert.equal(validFoeRecord({ i: 3, cp: bad }), null, `cp ${bad}`);
  assert.deepEqual(validFoeRecord({ i: 3 }), { i: 3 }, 'none when none');
  const ef = strip(read('src/scenes/exteriorFoes.js'));
  assert.match(ef, /if \(!allied && !entity\.eliteFoe\) applyChampion\(entity, champion !== undefined \? champion : revenant \? \(revenant\.trait \? championIndex\(revenant\.trait\) : null\) : \(capped \? rollStreetChampion\(pending\.feet, mobileType\) : null\)\);\s*(?:if \(revenant && !puppet\) applyRevenant\(entity, revenant\);\s*)?if \(puppet\) entity\.items = \[\];/, 'the owner rolls an encounter\'s, a puppet takes its owner\'s word - before the loot (ELITE FOES: never on an elite - one or the other)');
  assert.match(ef, /if \(!onWatch && f\.entity\?\.champion\) r\.cp = championIndex\(f\.entity\.champion\);/, 'the record carries it');
  assert.equal((ef.match(/champion: r\.cp \?\? null/g) ?? []).length, 2, 'both of a puppet\'s stands read it');
  assert.match(ef, /champion: f\.entity\.champion \?\? null,/, 'a save keeps it');
  assert.match(ef, /champion: sf\.champion \? championIndex\(sf\.champion\) : null/, 'and a load stands it again, never rolled');
});

test('LOOT7: what a champion is - twice the health, a quarter harder on any elite\'s, its trait on top; never the low, the watch, an ally, off', () => {
  on();
  const m = foe();
  assert.equal(CH.applyChampion(m, 0), true);
  assert.deepEqual([m.champion, m.maxHealth, m.health, m.damageScale], ['mighty', 80, 80, 1.25 * 1.5]);
  assert.equal(m.stats.speed, 50, 'only the Swift is quicker');
  const s = foe();
  CH.applyChampion(s, 1);
  assert.equal(s.maxHealth, 120, 'the Stalwart: half again on the double');
  const elite = foe(10, { damageScale: 2, maxHealth: 80, health: 80 });
  CH.applyChampion(elite, 3);
  assert.equal(elite.damageScale, 2.5, 'onto the elite\'s double, never over it');
  assert.equal(elite.maxHealth, 160);
  const w = foe(10, { stats: { speed: 90 } });
  CH.applyChampion(w, 2);
  assert.equal(w.stats.speed, 100, 'the Swift: thirty more, never past a hundred');
  for (const [e, why] of [[foe(2), 'under level 3'], [foe(10, { mobileType: KNIGHT_CITY_WATCH }), 'the watch'], [foe(10, { team: 'PlayerAlly' }), 'an ally']]) {
    assert.equal(CH.applyChampion(e, 0), false, why);
    assert.equal(e.champion, undefined);
  }
  assert.equal(CH.applyChampion(foe(), null), false, 'no trait');
  assert.equal(CH.applyChampion(foe(), 9), false, 'a trait the table does not have');
  off();
  const o = foe();
  assert.equal(CH.applyChampion(o, 0), false, 'off: none');
  assert.equal(o.maxHealth, 40);
});

test('LOOT7: its name everywhere - the hover, the HUD\'s target, the death line, the body', () => {
  on();
  const e = foe(10, { career: { name: 'Orc' } });
  CH.applyChampion(e, 0);
  assert.equal(CH.championName(e, 'Orc'), 'Mighty Orc');
  assert.equal(CH.championName(foe(), 'Orc'), 'Orc', 'anyone else as it was');
  markFoeStruck({ entity: e });
  assert.equal(foeTarget().name, 'Mighty Orc', 'the HUD\'s target frame');
  clearFoeTarget();
  assert.equal(liveEntityName({ entity: e }, 'Orc'), 'Mighty Orc', 'the hover\'s namer - every pool\'s one (HOVER-PLAIN: the plaque asks it only at peace)');
  assert.equal(liveEntityName({ entity: foe() }, 'Orc'), 'Orc');
  assert.equal(sayEnemyDied(() => {}, 7, e), 'Mighty Orc just died.');
  assert.equal(sayEnemyDied(() => {}, 7), 'Orc just died.');
  const dc = strip(read('src/scenes/dungeonContext.js'));
  assert.match(dc, /corpseName\(championName\(f\.entity, corpseEntityName\(f\.mobileType\)\)\)/, 'the dungeon\'s body');
  assert.match(strip(read('src/scenes/exteriorFoes.js')), /corpseName\(properName\(e\.entity\) \?\? championName\(e\.entity, corpseEntityName\(e\.mobileType\)\)\)/, 'the street\'s - AUDIT WB12d (D2): a foe\'s own name first');
});

test('LOOT7: the traits that answer a blow - the Vampiric drinks its blow, the Thorned hurts my blow back; registered', () => {
  on();
  const v = foe(10);
  CH.applyChampion(v, 3);
  v.health = 30;
  CH.championStruck(v, { isPlayer: true }, 20);
  assert.equal(v.health, 40, 'half of its blow heals it');
  CH.championStruck(v, { isPlayer: true }, 200);
  assert.equal(v.health, v.maxHealth, 'never past its maximum');
  v.health = 30;
  CH.championStruck(v, { health: 50 }, 20);
  assert.equal(v.health, 30, 'only a blow on me');
  const me = { isPlayer: true, health: 100, maxHealth: 100, activeEffects: [] };
  const t = foe(10);
  CH.applyChampion(t, 4);
  CH.championStrike(me, t, 70);
  assert.equal(me.health, 90, 'a seventh of my blow, back through my own damage door');
  CH.championStrike(me, foe(10), 70);
  assert.equal(me.health, 90, 'never a plain foe');
  const peer = { ...me, peer: true, health: 100 };
  CH.championStrike(peer, t, 70);
  assert.equal(peer.health, 100, 'a peer\'s blow is its own client\'s');
  const pet = { health: 50, maxHealth: 50, activeEffects: [] };
  CH.championStrike(pet, t, 70);
  assert.equal(pet.health, 50, 'never an ally\'s blow');
  const src = strip(read('src/systems/champions.js'));
  assert.match(src, /registerPlayerStruckListener\(CHAMPIONS, championStruck\);/);
  assert.match(src, /registerPlayerStrikeListener\(CHAMPIONS, championStrike\);/);
});

test('LOOT7: its loot - a Rare or better always, never its worn kit; a stronger source; nothing off', () => {
  on();
  let wornSeen = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const mobileType of [7, 0, 26]) {   // an orc (a table and a kit), a rat (no table), a Fire Daedra
      const e = { items: [], level: 10, careerIndex: mobileType, isClass: false, stats: { strength: 50, speed: 50 }, skills: 30, health: 50, maxHealth: 50, mobileType };
      CH.applyChampion(e, seed % 5);
      spawnEnemyLoot(e, mobileType, ENEMY_BASICS[mobileType], player, { rolls: lcg(seed) });
      const worn = new Set(e.equip ? equipTableOf(e).filter(Boolean) : []);
      const carried = e.items.filter((it) => !worn.has(it));
      assert.ok(carried.some((it) => LR.rarityRank(it) >= LR.RARITIES.rare.rank), `seed ${seed}, foe ${mobileType}: a Rare or better on the body`);
      for (const it of worn) assert.equal(it.rarity, undefined, 'its worn kit stays DFU\'s');
      wornSeen += worn.size;
    }
  }
  assert.ok(wornSeen > 100, `worn kit to keep (${wornSeen})`);
  // the guarantee alone: a Magic piece made Rare, a body with nothing minted one
  const m = LR.applyRarity(createWeapon(120, 1), 'magic', lcg(2));
  const e = { items: [m], level: 8 };
  assert.equal(ensureChampionLoot(e, 8, lcg(3)), m, 'its best piece made Rare');
  assert.equal(m.rarity, 'rare');
  const cheap = createWeapon(113, 1), dear = createWeapon(120, 1);
  cheap.value = 10; dear.value = 500;
  assert.equal(ensureChampionLoot({ items: [cheap, dear], level: 8 }, 8, lcg(6)), dear, 'its most valuable');
  let weapons = 0, armour = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const bare = { items: [], level: 8 };
    const minted = ensureChampionLoot(bare, 8, lcg(seed));
    assert.ok(minted && bare.items.includes(minted) && minted.rarity === 'rare', `seed ${seed}: carrying none, one minted and made Rare`);
    assert.ok(!isAmmunition(minted), `seed ${seed}: never ammunition`);
    if (minted.group === 'Weapons') weapons++; else armour++;
  }
  assert.ok(weapons > 60 && armour > 60, `a weapon or a piece of armour (${weapons}, ${armour})`);
  // THE STRONGER SOURCE: the champion's corpse door is the plain door with four tiers more and half again its quality
  for (let seed = 1; seed <= 80; seed++) {
    const a = { items: [createWeapon(113, 1), createWeapon(127, 1)], level: 6, mobileType: 7, champion: 'mighty' };
    const b = [createWeapon(113, 1), createWeapon(127, 1)];
    LR.rollCorpseLoot(a, { level: 6 }, { rolls: lcg(seed), luck: 50 });
    const src = LR.corpseSource({ level: 6 }, 6, 7);
    LR.rollLootRarity(b, { ...src, tier: src.tier + 4, qualityMult: 1.5 }, { rolls: lcg(seed), luck: 50 });
    const said = (list) => list.map((it) => [it.rarity ?? null, it.legendary ?? null, JSON.stringify(it.affixes ?? null)]);
    assert.deepEqual(said(a.items), said(b), `seed ${seed}`);
  }
  assert.equal(ensureChampionLoot({ items: [LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(1))], level: 8 }, 8, lcg(5)), null, 'a Legendary already: nothing');
  assert.deepEqual(LR.CHAMPION_SOURCE, { tier: 4, quality: 1.5 });
  assert.match(strip(read('src/systems/lootRarity.js')), /rollLootRarity\(loot, \{ \.\.\.source, tier: source\.tier \+ \(champ \? CHAMPION_SOURCE\.tier : 0\), qualityMult: qualityMult \* \(champ \? CHAMPION_SOURCE\.quality : 1\) \}/, 'the corpse door reads it');
  off();
  assert.equal(ensureChampionLoot({ items: [], level: 8 }, 8, lcg(4)), null, 'off: nothing');
  const dc = strip(read('src/scenes/dungeonContext.js'));
  assert.match(dc, /markDungeonChampions\(enemies, dfLocation\.dungeon\.recordElement\.header\.locationId\);/, 'the layout marked');
  assert.match(dc, /if \(!e\?\.elite \|\| !entity\) return void applyChampion\(entity, e\?\.champion\);[\s\S]{0,400}entity\.elite = true; applyChampion\(entity, e\.champion\);/, 'every build arm stands it, an elite\'s too');
});
