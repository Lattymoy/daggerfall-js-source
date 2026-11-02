// BOSS-TRAITS (2026-10-25, the owner: "boss types that might be shielded, have resistances, curb power, etc for more
// artifical difficulty"; asked where, "Raid leaders", "Elite foes", "Relay bosses"; bible/05-Combat/Boss-Traits.md):
// A HARD FOE'S OWN RULES, run - each trait's rule, the striker's half and the owner's, the mask on the wire, the draw,
// the words.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_TRAITS, ELEMENT_TRAITS, WARD_SHARE, WARD_REGROW_S, WARD_REFILL_S, RESIST_SHARE, WEAPON_RESIST_SHARE, CURB_SHARE, WRATH_AFTER_S, WRATH_X,
  THORN_SHARE, BOSS_TRAIT_MASK_MAX, RELAY_BOSS_TRAITS, bossTraitMask, bossTraitsOfMask, rollBossTraits, giveBossTraits, bossWardNow, bossStrike, bossTake,
  bossWrathDue, markBossWrath, bossTraitWords, bossTraitRules, relayBossTraits, eliteTraits, bossStrikeAt, bossTakeAt,
} from '../../src/systems/bossTraits.js';
import { FOE_TRAITS_MAX, validFoeRecord } from '../../src/net/wire.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { foeTitle } from '../../src/systems/foeTitle.js';

const foe = (traits, maxHealth = 1000) => { const e = { maxHealth, health: maxHealth, damageScale: 3 }; giveBossTraits(e, traits); return e; };
const sword = () => createWeapon(WEAPONS.Longsword, 0, () => 0.5);
const mace = () => createWeapon(WEAPONS.Mace, 0, () => 0.5);

test('BOSS-TRAITS THE TABLE: eleven traits in the mask\'s order (append only), the five resistances the spells\' own element order, the numbers the page names; the mask round-trips, an unknown name or bit dropped, and the wire\'s ceiling is the mask\'s (mutants: a trait moved; an element out of order; the ceiling unpinned)', () => {
  assert.deepEqual([...BOSS_TRAITS], ['warded', 'flameproof', 'frostproof', 'venomproof', 'stormproof', 'spellproof', 'bladeturning', 'stoneskin', 'curbing', 'wrathful', 'thorned']);
  assert.deepEqual([...ELEMENT_TRAITS], ['flameproof', 'frostproof', 'venomproof', 'stormproof', 'spellproof'], 'fire, frost, poison, shock, magic - systems/effects.js ELEMENT_EFFECT_FLAG');
  assert.deepEqual([WARD_SHARE, WARD_REGROW_S, WARD_REFILL_S, RESIST_SHARE, WEAPON_RESIST_SHARE, CURB_SHARE, WRATH_AFTER_S, WRATH_X, THORN_SHARE], [0.3, 10, 4, 0.25, 0.5, 0.05, 75, 1.6, 0.2]);
  assert.equal(BOSS_TRAIT_MASK_MAX, 0x7ff);
  assert.equal(FOE_TRAITS_MAX, BOSS_TRAIT_MASK_MAX, 'net/wire.js holds the same ceiling');
  assert.equal(bossTraitMask(['warded', 'thorned', 'nope']), 1 | (1 << 10));
  assert.deepEqual(bossTraitsOfMask(bossTraitMask(['thorned', 'warded'])), ['warded', 'thorned']);
  assert.deepEqual(bossTraitsOfMask(0), []);
  assert.deepEqual(bossTraitsOfMask(-1), []);
  // on the wire: `bt` within the mask, `bw` a bit; anything else refuses the record whole
  assert.equal(validFoeRecord({ i: 1, bt: 5, bw: 1 }).bt, 5);
  assert.equal(validFoeRecord({ i: 1, bt: FOE_TRAITS_MAX + 1 }), null);
  assert.equal(validFoeRecord({ i: 1, bt: 1.5 }), null);
  assert.equal(validFoeRecord({ i: 1, bw: 2 }), null);
  assert.equal(validFoeRecord({ i: 1, rl: 1 }).rl, 1);
});

test('BOSS-TRAITS THE DRAW: n distinct traits off the stream, never both weapon resistances; a seeded stream draws alike on every machine; the relay bosses draw the striker\'s traits alone, off their own name (mutants: a trait drawn twice; both weapon resistances; the relay\'s a stateful trait)', () => {
  for (let s = 0; s < 400; s++) {
    let x = s; const roll = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const t = rollBossTraits(3, roll);
    assert.equal(new Set(t).size, 3, 'distinct');
    assert.ok(!(t.includes('bladeturning') && t.includes('stoneskin')), 'never both');
  }
  assert.deepEqual(relayBossTraits('Valkynaz Ruhn', 7), relayBossTraits('Valkynaz Ruhn', 7), 'the same on every machine');
  assert.equal(relayBossTraits('Valkynaz Ruhn', 7).length, 2);
  for (const n of ['Valkynaz Ruhn', 'The Brass Remnant', 'Lord Ash', 'A', 'B', 'C', 'D', 'E']) for (const id of relayBossTraits(n, 1)) assert.ok(RELAY_BOSS_TRAITS.includes(id), `${n}: ${id} is a striker's trait`);
  assert.ok(!RELAY_BOSS_TRAITS.includes('warded') && !RELAY_BOSS_TRAITS.includes('curbing') && !RELAY_BOSS_TRAITS.includes('wrathful'), 'the relay keeps their health');
  const e = { maxHealth: 100, health: 100 }; eliteTraits(e, 12345);
  const e2 = { maxHealth: 100, health: 100 }; eliteTraits(e2, 12345);
  assert.deepEqual(e.bossTraits, e2.bossTraits, 'a dungeon\'s seed: every client alike');
  assert.equal(e.bossTraits.length, 1, 'an elite carries one');
});

test('BOSS-TRAITS THE STRIKER\'S HALF: a spell of its element lands a quarter, another element whole; a blade or an arrow half on the blade-turning, a mace or a fist whole; a blunt blow half on the stoneskinned; the thorns a fifth of what landed, a weapon\'s blow alone; a kill untouched (mutants: the element unread; the blade-turning blind to arrows; a fist read as a blade; the thorns on a spell; a kill resisted)', () => {
  const fire = foe(['flameproof']);
  assert.deepEqual(bossStrike(fire, 100, { kind: 'spell', element: 0 }), { damage: 100 * RESIST_SHARE, thorns: 0 });
  assert.deepEqual(bossStrike(fire, 100, { kind: 'spell', element: 1 }), { damage: 100, thorns: 0 }, 'frost: whole');
  assert.deepEqual(bossStrike(fire, 100, { kind: 'melee', weapon: sword() }), { damage: 100, thorns: 0 }, 'a blade: whole');
  const bt = foe(['bladeturning']);
  assert.equal(bossStrike(bt, 100, { kind: 'melee', weapon: sword() }).damage, 50);
  assert.equal(bossStrike(bt, 100, { kind: 'arrow' }).damage, 50, 'an arrow too');
  assert.equal(bossStrike(bt, 100, { kind: 'melee', weapon: mace() }).damage, 100, 'blunt: whole');
  assert.equal(bossStrike(bt, 100, { kind: 'melee', weapon: null }).damage, 100, 'a fist: whole');
  const st = foe(['stoneskin']);
  assert.equal(bossStrike(st, 100, { kind: 'melee', weapon: mace() }).damage, 50);
  assert.equal(bossStrike(st, 100, { kind: 'melee', weapon: null }).damage, 50, 'a fist is blunt');
  assert.equal(bossStrike(st, 100, { kind: 'melee', weapon: sword() }).damage, 100);
  assert.equal(bossStrike(st, 100, { kind: 'arrow' }).damage, 100, 'an arrow is no blunt blow');
  const th = foe(['thorned']);
  assert.deepEqual(bossStrike(th, 100, { kind: 'melee', weapon: sword() }), { damage: 100, thorns: 100 * THORN_SHARE });
  assert.equal(bossStrike(th, 100, { kind: 'spell', element: 0 }).thorns, 0, 'a spell: no thorns');
  assert.deepEqual(bossStrike(foe(['bladeturning', 'thorned']), 100, { kind: 'arrow' }), { damage: 50, thorns: 10 }, 'the thorns of what landed');
  assert.deepEqual(bossStrike(fire, 100, { kind: 'spell', element: 0, whole: true }), { damage: 100, thorns: 0 }, 'a kill is no blow');
  assert.equal(bossStrike(fire, 1, { kind: 'spell', element: 0 }).damage, 1, 'never under one');
  assert.deepEqual(bossStrike({}, 40, { kind: 'melee' }), { damage: 40, thorns: 0 }, 'no traits: untouched');
});

test('BOSS-TRAITS THE OWNER\'S HALF: the curb holds a blow to 5% of its health; the ward takes blows first, breaks once, and grows back whole WARD_REGROW_S after the last blow on it over WARD_REFILL_S; the wrath turns WRATH_AFTER_S after the first wound, once, its blows WRATH_X as hard (mutants: the curb off; the ward skipped; the regrow at once; the wrath twice; the wrath from the first blow\'s second)', () => {
  const cb = foe(['curbing'], 2000);
  assert.deepEqual(bossTake(cb, 500), { damage: 2000 * CURB_SHARE, ward: 0, broke: false });
  assert.equal(bossTake(cb, 40).damage, 40, 'under the curb: whole');
  const w = foe(['warded'], 1000);
  assert.deepEqual(bossWardNow(w, 0), { now: 300, max: 300 });
  assert.deepEqual(bossTake(w, 200, { nowS: 1 }), { damage: 0, ward: 200, broke: false });
  assert.deepEqual(bossTake(w, 150, { nowS: 2 }), { damage: 50, ward: 100, broke: true }, 'the ward breaks');
  assert.deepEqual(bossTake(w, 80, { nowS: 3 }), { damage: 80, ward: 0, broke: false }, 'broken: through');
  assert.equal(bossWardNow(w, 3 + WARD_REGROW_S).now, 0, 'not yet');
  assert.equal(bossWardNow(w, 3 + WARD_REGROW_S + WARD_REFILL_S / 2).now, 150, 'halfway back');
  assert.equal(bossWardNow(w, 3 + WARD_REGROW_S + WARD_REFILL_S + 5).now, 300, 'whole again');
  const wr = foe(['wrathful']);
  bossTake(wr, 10, { nowS: 100 });
  bossTake(wr, 10, { nowS: 120 });   // PIN MOVED - AUDIT WORLD-EVENTS L2-5: inside WRATH_COOL_S of the first (a fight dropped that long starts again)
  assert.equal(bossWrathDue(wr, 100 + WRATH_AFTER_S - 1), false);
  assert.equal(bossWrathDue(wr, 100 + WRATH_AFTER_S), true, 'from its first wound');
  assert.equal(wr.damageScale, 3 * WRATH_X);
  assert.equal(bossWrathDue(wr, 1000), false, 'once');
  assert.equal(wr.damageScale, 3 * WRATH_X);
  const p = { damageScale: 2 }; assert.equal(markBossWrath(p), true); assert.equal(p.damageScale, 2 * WRATH_X);
  assert.equal(markBossWrath(p), false, 'a puppet\'s word twice is one wrath'); assert.equal(p.damageScale, 2 * WRATH_X);
  assert.deepEqual(bossTake(w, 100, { whole: true, nowS: 50 }), { damage: 100, ward: 0, broke: false }, 'a kill is no blow');
  // a puppet takes no ward of its own
  const pup = { maxHealth: 1000, health: 1000 }; giveBossTraits(pup, ['warded'], { own: false });
  assert.equal(bossWardNow(pup, 0), null);
});

test('BOSS-TRAITS THE DOORS\' ONE CALL EACH: bossStrikeAt hands the thorns to the striker and answers what goes on; bossTakeAt says the ward\'s break and the wrath in the foe\'s name and answers what reaches its health (mutants: the thorns unsent; the break unsaid)', () => {
  const said = [], hurt = [];
  const e = foe(['thorned', 'warded'], 100);
  assert.equal(bossStrikeAt(e, 20, 'melee', sword(), null, false, (n) => hurt.push(n)), 20);
  assert.deepEqual(hurt, [4]);
  assert.equal(bossTakeAt(e, 20, false, 1, (l) => said.push(l), () => 'Orc'), 0);
  assert.equal(bossTakeAt(e, 20, false, 2, (l) => said.push(l), () => 'Orc'), 10);
  assert.deepEqual(said, ['The ward on Orc breaks!']);
});

test('BOSS-TRAITS SEEN: the title wears the first trait\'s word before the rest ("Warded Elite Orc"), the target frame every word, the tip every rule (mutants: the title bare; a word out of order)', () => {
  const e = { maxHealth: 100, health: 100, eliteFoe: true };
  giveBossTraits(e, ['thorned', 'warded']);
  assert.equal(foeTitle(e, 'Orc'), 'Warded Elite Orc');
  assert.deepEqual(bossTraitWords(e), ['Warded', 'Thorned']);
  assert.equal(bossTraitRules(e).length, 2);
  assert.match(bossTraitRules(foe(['curbing']))[0], /5% of its health/);
  assert.equal(foeTitle({ eliteFoe: true }, 'Orc'), 'Elite Orc', 'no traits: as before');
});
