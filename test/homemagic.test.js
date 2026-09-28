// HOME-MAGIC (2026-09-27, Discord: "Players can use magic in player non owned houses").
//
// A VISITOR CASTS NOTHING IN ANOTHER'S ONLINE HOME. The one cast engine (scenes/hostMagic.js) asks its host's word on
// the place (`castRefusal`) at the ready, at the click - a spell readied outside is not fired inside - and at an item's
// cast on its user; an item about to cast asks first (`barCast`), so it spends no durability on a spell that never goes
// (systems/enchantments.js CastWhenUsed). The word is worldModes.js visitorMagicRefusal: HOUSE-DROP's own test of who
// is a visitor. The owner's home, an offline house and every other building cast as they did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { ENCHANTMENT_TYPES, setDefaultEnchantCtx, DURABILITY_LOSS_ON_USE } from '../src/systems/enchantments.js';
import { useItem } from '../src/systems/useItem.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NO = 'You cannot cast spells in another\'s home.';

const healEffect = () => ({
  type: 10, subType: 8,
  magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const spellOf = (rangeType) => ({ name: 'Test Spell', index: 90, element: 0, rangeType, effects: [healEffect()] });
const mkPlayer = () => ({
  isPlayer: true, level: 1, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 },
  career: {}, activeEffects: [],
});

function rig(place) {
  const player = mkPlayer();
  const said = [];
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal: (n) => { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
    castRefusal: () => place.no,
  });
  return { magic, player, said };
}

test('HOME-MAGIC the engine: barred, nothing readies, a spell readied outside does not fire inside, an item\'s spell on its user does not land - each said, nothing spent; unbarred, all three as ever (mutants: each gate dropped)', () => {
  const place = { no: NO };
  const { magic, player, said } = rig(place);
  assert.equal(magic.readySpell(spellOf(2)), false, 'nothing readies');
  assert.equal(said.at(-1), NO);
  assert.equal(magic.spellArmed(), false);
  // readied outside, walked in, clicked
  place.no = null;
  assert.equal(magic.readySpell(spellOf(2)), true);
  place.no = NO;
  const mana = player.magicka;
  assert.equal(magic.castInput([0, 1, 0], [0, 0, 1]), false, 'the click fires nothing');
  assert.equal(player.magicka, mana, 'and spends nothing');
  assert.equal(magic.spellArmed(), false, 'the ready is dropped, as the silence gate drops it');
  assert.equal(said.at(-1), NO);
  // a free ready (an item's spell) is barred too
  assert.equal(magic.readySpell(spellOf(2), { free: true }), false);
  // an item's spell on its user
  const hp = player.health;
  assert.equal(magic.castByItemSelf(spellOf(0)), null);
  assert.equal(player.health, hp, 'no heal landed');
  assert.equal(magic.barCast(), true);
  // unbarred: as ever
  place.no = null;
  assert.equal(magic.barCast(), false);
  assert.equal(magic.readySpell(spellOf(2)), true);
  assert.ok(magic.castByItemSelf(spellOf(0)));
  assert.ok(player.health > hp, 'the item\'s heal lands where casting is allowed');
});

test('HOME-MAGIC an item: where the place bars casting, Cast When Used casts nothing and spends no durability; elsewhere it casts and wears (mutant: the ask dropped)', () => {
  const record = { index: 7, name: 'Wand Spell', rangeType: 0, element: 4, effects: [] };
  const wand = { name: 'Wand', templateIndex: 135, group: ITEM_GROUPS.Jewellery, currentCondition: 100, maxCondition: 100, enchantments: [{ type: ENCHANTMENT_TYPES.CastWhenUsed, param: 7 }] };
  const casts = [];
  const ctxOf = (barred) => ({
    spellsByIndex: () => new Map([[7, record]]),
    applySpellToSelf: (r) => casts.push(r.index),
    setReadySpell: (r) => casts.push(-r.index),
    castBarred: () => barred,
  });
  const user = { name: 'W', health: 20, maxHealth: 30, items: [wand], level: 5, stats: {}, skills: 40, career: {} };
  try {
    setDefaultEnchantCtx(ctxOf(true));
    useItem(wand, user.items, { entity: user, isEnchanted: () => true });
    assert.deepEqual(casts, [], 'nothing cast');
    assert.equal(wand.currentCondition, 100, 'no durability spent');
    setDefaultEnchantCtx(ctxOf(false));
    useItem(wand, user.items, { entity: user, isEnchanted: () => true });
    assert.deepEqual(casts, [7]);
    assert.equal(wand.currentCondition, 100 - DURABILITY_LOSS_ON_USE, 'a cast wears the item as ever');
  } finally { setDefaultEnchantCtx(null); }
});

test('HOME-MAGIC the host: a visitor in another\'s online home is barred - HOUSE-DROP\'s test - and the world host\'s engine asks the building\'s word (sweep)', () => {
  const M = src('src/scenes/worldModes.js');
  assert.match(M, /const HOME_VISITOR_MAGIC_TEXT = 'You cannot cast spells in another\\'s home\.';/);
  // the visitor is HOUSE-DROP's own, asked through its refusal - one test of who is a visitor, not a copy of it
  assert.match(M, /const visitorDropRefusal = \(\) => \(interiorHome && !interiorHome\.own && mode === 'interior' \? HOME_VISITOR_DROP_TEXT : null\);/);
  assert.match(M, /const visitorMagicRefusal = \(\) => \(visitorDropRefusal\(\) \? HOME_VISITOR_MAGIC_TEXT : null\);/);
  assert.match(M, /castRefusal: \(\) => visitorMagicRefusal\(\),/);
  assert.match(src('src/scenes/world.js'), /castRefusal: \(\) => modes\?\.castRefusal\?\.\(\) \?\? null,/);
  assert.match(src('src/scenes/hostEnchant.js'), /castBarred: \(\) => magic\.barCast\?\.\(\) === true,/);
});
