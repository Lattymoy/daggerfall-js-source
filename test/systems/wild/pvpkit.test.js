// PVP-KIT (the PvP rework, 2026-10-29): the PvP spell bar's law (systems/wild/pvpKit.js), its cast (ui/pvpSpellMenu.js), the
// cost door (systems/spellcost.js), the 15 m gift (scenes/hostMagic.js pvpReach), the bar's Poison Damage at a player
// (combat/siegeCombat.js), Reflect and Absorb in the ward's report and the Shield's share (combat/pvpGuard.js, the referee).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PVP_KIT, KIT_SPELLS, KIT_IDS, KIT_ELEMENTS, KIT_DEFAULT_BAR, kitScale, kitCost, kitMagnitude, kitSpell, kitSlotOf, kitBarOf,
  kitSlotName, kitRefusal, isKitSpell, kitSchool,
} from '../../../src/systems/wild/pvpKit.js';
import { rollMagnitude } from '../../../src/systems/spellcast.js';
import { applySpell, rollDuration } from '../../../src/systems/effects.js';
import { elementalResistanceChance } from '../../../src/systems/spellcast.js';
import { calculateCastCost } from '../../../src/systems/spellcost.js';
import { pvpFirstEffect } from '../../../src/combat/siegeCombat.js';
import { pvpWardKept, pvpShieldShare, pvpReflectChance, pvpAbsorbChance } from '../../../src/combat/pvpGuard.js';
import { shieldedBlow, takeHealthReport, HEALTH_SHARE_WHOLE, PVP_SHIELD } from '../../../src/net/siege/refereeHealthShare.js';
import { newFighter } from '../../../src/net/siege/siegeRef.js';
import { VIT_SHIELD_MIN, VIT_SHIELD_MAX, CAST_LEVEL_MAX, validVitIn } from '../../../src/net/wire.js';
import { createRefereeHealthMirror } from '../../../src/net/siege/refereeHealthMirror.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { castKitSlot, loadPvpStore, PVP_KIT_STORE_V1 } from '../../../src/ui/pvpSpellMenu.js';
import { HOTBAR_SLOT_ACTIONS } from '../../../src/systems/inputActions.js';
import { pvpSpellRefusal } from '../../../src/systems/wild/pvpRules.js';
import { hasResurrect, resurrectionSpell, pickFallenBody, RESURRECT_REACH, RESURRECT_TYPE, RESURRECT_SUBTYPE } from '../../../src/systems/resurrect.js';

const stats = (v) => ({ strength: v, intelligence: 50, willpower: v, agility: 50, endurance: v, personality: 50, speed: 50, luck: 50 });
const body = (o = {}) => ({ isPlayer: true, level: 30, stats: stats(50), skills: {}, items: [], health: 500, maxHealth: 1000, magicka: 400, maxMagicka: 400, activeEffects: [], ...o });
const quiet = () => {};
const sinks = { hurt: quiet, heal: quiet, drainFatigue: quiet, restoreFatigue: quiet, drainMagicka: quiet, restoreMagicka: quiet };

test('PVP-KIT THE LAW: eight slots, 15 m, a minute, skill 100 to 300; the costs and the scaling the owner approved (mutants: a cost; a scale end; the clamp; the reach)', () => {
  assert.deepEqual(PVP_KIT, { slots: 8, reachM: 15, rounds: 12, lo: 100, hi: 300 });
  assert.deepEqual(Object.fromEntries(KIT_IDS.map((id) => [id, KIT_SPELLS[id].cost])),
    { damage: 8, heal: 12, shield: 15, resist: 12, reflect: 12, absorb: 12, fortify: 10, regen: 10, jump: 6, speed: 6, resurrect: 25 });
  const ends = (id) => [kitScale(id, 100), kitScale(id, 300)];
  assert.deepEqual(ends('heal'), [25, 35]);
  assert.deepEqual(ends('shield'), [10, 25]);
  assert.deepEqual(ends('resist'), [30, 90]);
  assert.deepEqual(ends('reflect'), [10, 30]);
  assert.deepEqual(ends('absorb'), [10, 30]);
  assert.deepEqual(ends('fortify'), [5, 20]);
  assert.deepEqual(ends('regen'), [2, 4]);
  assert.equal(kitScale('resist', 200), 60, 'straight between');
  assert.equal(kitScale('resist', 40), 30, 'held at the low end');
  assert.equal(kitScale('resist', 900), 90, 'held at the high end');
  assert.equal(kitScale('jump', 300), 0, 'Jump does not scale');
  assert.equal(kitCost('shield', 400), 60);
  assert.equal(kitCost('jump', 10), 1, 'never under 1');
  assert.equal(KIT_ELEMENTS.length, 5);
});

test('PVP-KIT A NUMBER EXACTLY: the classic settings roll the number asked at the level it lands at, no dice (mutants: the base; the plus)', () => {
  for (const [n, L] of [[0, 30], [13, 30], [350, 30], [350, 45], [1049, 37], [7, 1]]) {
    const e = kitMagnitude(n, L);
    assert.equal(rollMagnitude(e, L, () => 0.99), n, `${n} at ${L}`);
    assert.equal(rollMagnitude(e, L, () => 0), n, 'no dice');
    assert.ok(e.magnitudeBaseLow <= 255 && e.magnitudeLevelBase <= 255, 'a classic byte each');
  }
});

test('PVP-KIT THE SPELLS: Damage is the classic Fireball at Area at Range in the picked element; every other spell a CasterOnly gift to 15 m, a minute long (mutants: Damage not an area; the element unread; the gift reach; a heal of the wrong share)', () => {
  const at = { skill: 300, level: 30, maxHealth: 1000, maxMagicka: 400 };
  const dmg = kitSpell({ id: 'damage', pick: 3 }, at);
  assert.equal(dmg.rangeType, 4);
  assert.equal(dmg.element, 3);
  assert.equal(dmg.pvpReach, undefined, 'Damage is aimed, never given');
  assert.deepEqual([dmg.effects[0].type, dmg.effects[0].subType], [4, 0], 'SPELLS.STD 14');
  // PVP-CAST-SKILL: no level dice - 0.15 x live Destruction, to 875 and past
  assert.equal(rollMagnitude(dmg.effects[0], 30, () => 0.99), 45, '0.15 x 300');
  assert.equal(rollMagnitude(dmg.effects[0], 30, () => 0), 45, 'no dice');
  assert.equal(rollMagnitude(kitSpell({ id: 'damage', pick: 0 }, { ...at, skill: 875, level: 45 }).effects[0], 45), 131, '0.15 x 875');
  assert.equal(dmg.pvpKitCost, 32);
  const heal = kitSpell({ id: 'heal' }, at);
  assert.deepEqual([heal.rangeType, heal.pvpReach, heal.element], [0, 15, 4]);
  assert.equal(rollMagnitude(heal.effects[0], 30), 350, '35% of 1,000 at skill 300');
  assert.equal(rollMagnitude(kitSpell({ id: 'heal' }, { ...at, skill: 100 }).effects[0], 30), 250);
  assert.equal(rollMagnitude(kitSpell({ id: 'heal' }, { ...at, maxHealth: 600 }).effects[0], 30), 210, 'a share of the health it is cast for');
  const resist = kitSpell({ id: 'resist', pick: 1 }, { ...at, skill: 100 });
  assert.deepEqual([resist.effects[0].type, resist.effects[0].subType, resist.effects[0].chanceBase], [8, 1, 30]);
  assert.equal(rollDuration(resist.effects[0], 30), PVP_KIT.rounds, 'a minute');
  const fort = kitSpell({ id: 'fortify', pick: 3 }, at);
  assert.deepEqual([fort.effects[0].type, fort.effects[0].subType, rollMagnitude(fort.effects[0], 30)], [9, 3, 20]);
  assert.deepEqual(kitSpell({ id: 'speed' }, at).effects.map((e) => [e.type, e.subType]), [[9, 6]]);
  const regen = kitSpell({ id: 'regen' }, at);
  assert.deepEqual([regen.rangeType, regen.pvpReach, regen.effects[0].type, regen.effects[0].subType & 0xff], [0, 15, 18, 255], 'PVP-KIT-REGEN: the classic Regenerate, a gift');
  assert.equal(rollMagnitude(regen.effects[0], 30), 40, '4% of 1,000 a round at skill 300');
  assert.equal(rollDuration(regen.effects[0], 30), PVP_KIT.rounds, 'a minute');
  assert.equal(kitSchool('regen'), SKILLS.Restoration);
  assert.deepEqual(kitSlotOf({ id: 'cure', icon: 49 }), { id: 'regen', pick: null, icon: 1 }, 'a saved Cure is Regenerate, its old default icon the new one');
  assert.equal(kitSlotOf({ id: 'cure', icon: 7 }).icon, 7, 'a chosen icon kept');
  assert.deepEqual(kitSpell({ id: 'jump' }, at).effects.map((e) => e.type), [27]);
  assert.deepEqual(kitSpell({ id: 'reflect' }, at).effects.map((e) => [e.type, e.chanceBase]), [[21, 30]]);
  assert.deepEqual(kitSpell({ id: 'absorb' }, at).effects.map((e) => [e.type, e.chanceBase]), [[20, 30]]);
  assert.equal(kitSchool('heal'), SKILLS.Restoration);
  assert.equal(kitSchool('damage'), SKILLS.Destruction);
  assert.equal(kitSlotName({ id: 'damage', pick: 1 }), 'Damage (Frost)');
  assert.equal(kitSlotName({ id: 'fortify', pick: 6 }), 'Fortify Speed');
});

test('PVP-KIT THE SPELLS LAND: a Resist, a Shield and a Heal through the one spell door give the numbers the law says (mutants: the school past 100 read on the bar)', () => {
  const me = body({ skillOverrides: { [SKILLS.Alteration]: 300, [SKILLS.Restoration]: 300, [SKILLS.Thaumaturgy]: 300 } });
  applySpell(kitSpell({ id: 'resist', pick: 0 }, { skill: 300, level: 30 }), 30, me, sinks, () => 0.5, { entity: me });
  assert.equal(elementalResistanceChance(me, 0), 90);
  applySpell(kitSpell({ id: 'shield' }, { skill: 300, level: 30, maxHealth: 1000 }), 30, me, sinks, () => 0.5, { entity: me });
  assert.equal(pvpShieldShare(me), 25, 'a pool of 250 on 1,000');
  let healed = 0;
  applySpell(kitSpell({ id: 'heal' }, { skill: 100, level: 30, maxHealth: 1000 }), 30, me, { ...sinks, heal: (n) => { healed += n; } }, () => 0.5, { entity: me });
  assert.equal(healed, 250);
});

test('PVP-KIT A SLOT AS SAVED: eight slots, unknown spells and picks the default, an icon 0..68, a pick only where the spell has one (mutants: the pick kept on Heal; a bad icon kept)', () => {
  assert.equal(kitBarOf(null).length, 8);
  assert.deepEqual(kitBarOf(null), KIT_DEFAULT_BAR.map((s) => ({ ...s })));
  assert.deepEqual(kitSlotOf({ id: 'heal', pick: 2, icon: 7 }), { id: 'heal', pick: null, icon: 7 });
  assert.deepEqual(kitSlotOf({ id: 'damage', pick: 9, icon: 99 }), { id: 'damage', pick: 0, icon: KIT_SPELLS.damage.icon });
  assert.deepEqual(kitSlotOf({ id: 'fortify', pick: 7, icon: 0 }), { id: 'fortify', pick: 7, icon: 0 });
  assert.equal(kitSlotOf({ id: 'nope' }, 1).id, 'heal', 'the slot\'s default');
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  store.set(PVP_KIT_STORE_V1, JSON.stringify([{ id: 'jump', icon: 4 }]));
  assert.deepEqual(loadPvpStore([], { key: 'none' }).set[2].kit, { id: 'jump', pick: null, icon: 4 }, 'an old bar is read');
  delete globalThis.localStorage;
  assert.equal(loadPvpStore([], { key: 'none' }).set.filter((e) => e?.type === 'kit').length, 8, 'no store: the default');
});

test('PVP-KIT THE PRICE AND THE WORD: the bar\'s price replaces the classic sum; under the flag every other spell is refused (mutants: the price unread; the refusal never said; a kit spell refused)', () => {
  const me = body({ skills: {} });
  const sp = kitSpell({ id: 'heal' }, { skill: 100, level: 30, maxHealth: 1000, maxMagicka: 400 });
  assert.equal(calculateCastCost(sp, me, { portMods: false }).sp, 48, '12% of 400');
  assert.notEqual(calculateCastCost({ ...sp, pvpKitCost: undefined }, me, { portMods: false }).sp, 48);
  assert.ok(isKitSpell(sp));
  assert.equal(kitRefusal(sp, true), null);
  assert.match(kitRefusal({ effects: [] }, true), /PvP bar/);
  assert.equal(kitRefusal({ effects: [] }, false), null, 'outside PvP the book casts as before');
});

test('PVP-KIT POISON ON THE BAR: the bar\'s Poison Damage reaches a player; any other poison spell still does not (mutants: the kit exemption)', () => {
  const dmg = kitSpell({ id: 'damage', pick: 2 }, { level: 30 });
  assert.equal(pvpFirstEffect(dmg)?.type, 4);
  assert.equal(pvpFirstEffect({ ...dmg, pvpKit: undefined }), null, 'PVP-NO-POISON for the rest');
});

test('PVP-KIT REFLECT, ABSORB AND THE SHIELD\'S SHARE: what they take off rides the ward report; the Shield its share, 10 to 25 (mutants: reflect unread; absorb unread; the share unclamped)', () => {
  const plain = pvpWardKept(body());
  const warded = pvpWardKept(body({ activeEffects: [{ kind: 'spellReflection', chance: 30 }, { kind: 'spellAbsorption', chanceBase: 20, chanceMod: 0, chancePerLevel: 1 }] }));
  assert.deepEqual(warded, plain.map((n) => Math.round(n * 0.7 * 0.8)));
  assert.equal(pvpReflectChance(body({ activeEffects: [{ kind: 'spellReflection', chance: 30, ended: true }] })), 0);
  assert.equal(pvpAbsorbChance(body({ activeEffects: [{ kind: 'spellAbsorption', chanceBase: 90, chanceMod: 0, chancePerLevel: 1 }] })), 50, 'absorption\'s own cap');
  const shield = (pool) => body({ activeEffects: [{ kind: 'shield', startingShield: pool, shieldRemaining: pool }] });
  assert.equal(pvpShieldShare(body()), 0);
  assert.equal(pvpShieldShare(shield(40)), 10, 'a classic Shield reads the floor');
  assert.equal(pvpShieldShare(shield(150)), 15);
  assert.equal(pvpShieldShare(shield(900)), 25);
  assert.deepEqual([VIT_SHIELD_MIN, VIT_SHIELD_MAX], [PVP_SHIELD.min, PVP_SHIELD.max], 'pinned equal');
  assert.deepEqual([validVitIn({ n: 1, s: 5000, seen: [], sh: 1 })?.shield, validVitIn({ n: 1, s: 5000, seen: [], sh: 12 })?.shield], [25, 12], 'an older client\'s Shield is the strongest');
});

test('PVP-KIT THE REFEREE: a Shield\'s share takes that part of the strongest Shield\'s off a blow; a report carries it (mutants: the share read as whole; the shaft read as a swing)', () => {
  const now = 1_000_000;
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], shield: 10 }, now);
  assert.equal(shieldedBlow(b, false, 1000), 900, '10% off a swing');
  assert.equal(shieldedBlow(b, true, 1000), 860, '14% off a shaft');
  takeHealthReport(b, { report: 2, share: HEALTH_SHARE_WHOLE, seen: [], shield: 25 }, now);
  assert.deepEqual([shieldedBlow(b, false, 1000), shieldedBlow(b, true, 1000)], [750, 650]);
  let sh = 0, t = 0; const sent = [];
  const m = createRefereeHealthMirror({ read: () => ({ health: 50, maxHealth: 100 }), write: () => {}, send: (r) => { sent.push(r); return true; }, now: () => t, shield: () => sh });
  m.frame(true); sh = 15; t += 1000; m.frame(true);
  assert.deepEqual(sent.map((r) => r.sh), [0, 15], 'a new share is reported at once');
});

test('PVP-KIT THE PRESS: the old bar\'s keys 3 to 0 are the PvP set\'s slots 3 to 10; a press readies the slot\'s spell and fires it, at an ally\'s frame level when one is aimed at (mutants: the gift level unclamped; a refusal read as a cast)', () => {
  const set = loadPvpStore([]).set;
  assert.deepEqual(HOTBAR_SLOT_ACTIONS.slice(2, 10), ['QuickSpell', 'QuickOffHand', 'Hotbar5', 'Hotbar6', 'Hotbar7', 'Hotbar8', 'Hotbar9', 'Hotbar10']);
  assert.deepEqual(set.slice(2, 10).map((e) => e.kit.id), KIT_DEFAULT_BAR.map((s) => s.id), 'the old bar where its keys were');
  const readied = [];
  let armed = false, fired = 0;
  const magic = { readySpell: (sp) => { readied.push(sp); armed = sp.rangeType !== 0; return true; }, spellArmed: () => armed, interceptAttack: () => { fired++; return true; } };
  const me = body({ level: 45, skillOverrides: { [SKILLS.Restoration]: 300 } });
  assert.equal(castKitSlot({ magic, entity: me, allyAimed: () => true }, { id: 'heal' }), 'cast');
  assert.equal(rollMagnitude(readied[0].effects[0], CAST_LEVEL_MAX), 350, 'the ally\'s frame lands at 30');
  assert.equal(castKitSlot({ magic, entity: me }, { id: 'heal' }), 'cast');
  assert.equal(rollMagnitude(readied[1].effects[0], 45), 350, 'on me at my own level');
  assert.equal(fired, 0, 'a CasterOnly spell casts at the ready');
  assert.equal(castKitSlot({ magic, entity: me }, { id: 'damage', pick: 0 }), 'cast');
  assert.equal(fired, 1, 'Damage fires at once, the hotbar\'s way');
  assert.equal(castKitSlot({ magic: { readySpell: () => false }, entity: me }, { id: 'heal' }), 'refused');
});

test('PVP-KIT THE WIRING: one host line; the cast engine reads the gift reach; only the bar\'s spells reach a player in the zone; the bar\'s gifts are a party member\'s; the hotbar presses a made spell (source)', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const pvpKit = createPvpSpellMenu\(\(\) => \[online, magic, modes\?\.mode, allyTargetPick, cam, socialFwd\], pvpFlag, playerEntity\);/);
  assert.match(w, /SIEGE_SPELL_BARRED_TEXT : null\) \?\? pvpKit\.refusal\(sp\);/);
  assert.match(w, /if \(!wildFair\(peerId\) \|\| !sp\?\.pvpKit\) return false;/);
  assert.match(w, /const strangers = !!sp && !sp\.pvpKit && strangerCastable\(sp\);/);
  const h = readFileSync(new URL('../../../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.match(h, /const allyReach = sp\.pvpReach \?\? allyReachFor\(sp\.rangeType\);/);
  const hb = readFileSync(new URL('../../../src/ui/enhanced/enhancedHotbar.js', import.meta.url), 'utf8');
  const qs = readFileSync(new URL('../../../src/systems/quickslots.js', import.meta.url), 'utf8');
  assert.match(qs, /if \(e\.type === 'kit'\) \{\n\s*const r = kitPress\?\.\(i, \{ \.\.\.e\.kit \}\) \?\? 'none';/);
  assert.doesNotMatch(hb, /keyClaim/, 'no second bar takes the keys');
  const fx = readFileSync(new URL('../../../src/systems/effects.js', import.meta.url), 'utf8');
  assert.match(fx, /\|\| spell\?\.pvpKit != null;/);
});

test('PVP-KIT-REZ THE SLOT: Resurrect is on the bar\'s list at 25% of maximum magicka, the shop\'s own spell by touch, no 15 m gift (mutants: the cost; not by touch; the gift reach; no effect; the name)', () => {
  assert.ok(KIT_IDS.includes('resurrect'));
  assert.equal(kitSlotName({ id: 'resurrect' }), 'Resurrect');
  assert.deepEqual(kitSlotOf({ id: 'resurrect', pick: 3, icon: 99 }), { id: 'resurrect', pick: null, icon: 10 });
  assert.equal(kitCost('resurrect', 400), 100);
  const sp = kitSpell({ id: 'resurrect' }, { skill: 200, level: 30, maxHealth: 1000, maxMagicka: 400 });
  assert.ok(hasResurrect(sp));
  assert.deepEqual([sp.effects[0].type, sp.effects[0].subType], [RESURRECT_TYPE, RESURRECT_SUBTYPE]);
  assert.deepEqual([sp.rangeType, sp.element], [resurrectionSpell().rangeType, 4], 'by touch, as the shop sells it');
  assert.equal(sp.pvpReach, undefined, 'the reach is RESURRECT_REACH, never the gift\'s 15 m');
  assert.equal(kitSchool('resurrect'), SKILLS.Restoration);
  assert.equal(calculateCastCost(sp, body(), { portMods: false }).sp, 100, 'the bar\'s price');
});

test('PVP-KIT-REZ UNDER THE FLAG: neither the bar\'s law nor the flag\'s limits refuse it; a press readies it and fires it at once, no ally frame asked (mutants: an ally frame asked)', () => {
  const sp = kitSpell({ id: 'resurrect' }, { level: 30, maxMagicka: 400 });
  assert.equal(kitRefusal(sp, true), null);
  assert.equal(pvpSpellRefusal(sp, true), null);
  assert.ok(isKitSpell(sp));
  const readied = []; let armed = false, fired = 0, asked = 0;
  const magic = { readySpell: (s) => { readied.push(s); armed = s.rangeType !== 0; return true; }, spellArmed: () => armed, interceptAttack: () => { fired++; return true; } };
  assert.equal(castKitSlot({ magic, entity: body({ level: 45 }), allyAimed: () => { asked++; return true; } }, { id: 'resurrect' }), 'cast');
  assert.ok(hasResurrect(readied[0]));
  assert.deepEqual([fired, asked], [1, 0]);
});

test('PVP-KIT-REZ A PARTY MEMBER ALONE, IN THE OLD REACH: the cast engine asks the host for fallen party members\' bodies within RESURRECT_REACH; the host hands none but a party member\'s (mutants: a stranger raised)', () => {
  assert.equal(RESURRECT_REACH, 6);
  const near = { feet: [0, 0, 4] }, far = { feet: [0, 0, 7] };
  assert.equal(pickFallenBody([0, 1.6, 0], [0, -0.3, 1], [far])?.feet ?? null, null, 'past the reach');
  assert.deepEqual(pickFallenBody([0, 1.6, 0], [0, -0.3, 1], [near, far])?.feet, near.feet);
  const h = readFileSync(new URL('../../../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.match(h, /bodies = fallenTarget\(eye, dir, RESURRECT_REACH\) \?\? null;/);
  assert.match(h, /if \(hasResurrect\(sp\) && !readiedFree\) \{/, 'the release frame raises before any ally arm');
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const mate = cAcct \? social\.others\(\)\.find\(\(m\) => m\.acct === cAcct\) : null; if \(!mate\) continue;/);
});
