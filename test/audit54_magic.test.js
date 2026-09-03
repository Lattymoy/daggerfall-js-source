// AUDIT 54 f3 (magic, effects, quest actions) - the seven laws this
// wave paid, each pinned at the exact value the port had wrong. Every
// assertion here is RED under the pre-fix source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assignStartingGear, ARCHER_CLASS_INDEX, ARCHER_ARROWS } from '../src/systems/startingGear.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { calculateCastCost } from '../src/systems/spellcost.js';
import { damageShieldPool } from '../src/characters/playerEntity.js';
import { effectByKey } from '../src/systems/spellEffects.js';
import { restDecision } from '../src/systems/restSession.js';
import { QuestMachine, QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { noteOfferPending, giveOffer, pendingOfferSender, clearPendingOffer } from '../src/ui/pendingOffer.js';
import { getRandomFullName, getNameBankOfRegion, fullName, GENDERS } from '../src/characters/nameHelper.js';
import { srand, randomRangeInclusive } from '../src/formats/dfRandom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

// ── F1: the archer's arrow pile ───────────────────────────────────

test('AUDIT 54: the archer\'s starting arrows come off CreateWeapon\'s arrow arm - condition ZERO', () => {
  // ItemHelper.cs:1342-1344 builds the pile through
  // ItemBuilder.CreateWeapon(Weapons.Arrow, Iron) and only THEN writes
  // stackCount; the arrow arm's three writes include
  // `newItem.currentCondition = 0;` ("not sure if this is necessary,
  // but classic does it", ItemBuilder.cs:359-364) and skip
  // ApplyWeaponMaterial, so maxCondition stays the template's
  // hitPoints - 1 for Arrow (template 131). The port hand-minted the
  // literal instead and mintCondition paid it FULL condition.
  const e = { gender: 'male', items: [] };
  const added = assignStartingGear(e, { classIndex: ARCHER_CLASS_INDEX, rolls: () => 0.5 });
  const pile = added.find((i) => i.templateIndex === 131);
  assert.ok(pile, 'the archer gets a pile of arrows');
  assert.equal(pile.stackCount, ARCHER_ARROWS, 'stackCount is written AFTER the mint (:1343)');
  assert.equal(pile.currentCondition, 0, 'ItemBuilder.cs:361 - currentCondition 0');
  assert.equal(pile.maxCondition, 1, 'and maxCondition is the template hitPoints, unmultiplied');
  // ...and it is the SAME arm, not a fourth copy of it.
  const one = createWeapon(131, 0, () => 0.5);
  assert.equal(pile.currentCondition, one.currentCondition);
  assert.equal(pile.maxCondition, one.maxCondition);
  assert.equal(pile.value, one.value);
  assert.match(src('systems/startingGear.js'), /add\(\{ \.\.\.createWeapon\(ARROW, 0, rolls\), stackCount: ARCHER_ARROWS \}\)/,
    'the pile is minted through the one home');
});

// ── F2: readySpellCastingCost ─────────────────────────────────────

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const spellOf = (rangeType, effects) => ({ name: 'T', index: 90, element: 0, rangeType, effects });
const mkPlayer = (over = {}) => ({
  isPlayer: true, level: 1, health: 50, maxHealth: 50,
  maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 },
  career: {}, activeEffects: [], ...over,
});
function magicRig(player) {
  const world = { said: [], missiles: 0 };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l) },
    say: (l) => world.said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
    startCastAnim: null,
  });
  return { magic, world };
}

test('AUDIT 54: CastReadySpell has NO magicka gate - a drain after the ready still fires, clamped at 0', () => {
  // EntityEffectManager.cs:337-343 is the ONLY sufficiency test in the
  // file and it is SetReadySpell's ("Daggerfall does this when setting
  // ready spell"). CastReadySpell (:401-425) has three gates - silence,
  // ready/castInProgress, the ByTouch probe - then
  // DecreaseMagicka(readySpellCastingCost) unconditionally, and
  // SetMagicka clamps at 0 (DaggerfallEntity.cs:374-381). The port had
  // a fourth gate that ate the click.
  const player = mkPlayer();
  const sp = spellOf(2, [damageEffect()]);
  const cost = calculateCastCost(sp, player).sp;
  assert.ok(cost > 5, 'the spell costs something to spend');
  player.magicka = cost;              // exactly enough at the ready
  const { magic } = magicRig(player);
  magic.readySpell(sp);
  assert.equal(magic.readied(), sp, 'the ready passed its own gate');
  player.magicka = cost - 5;          // a Damage Spell Points hit lands mid-aim
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true, 'DFU fires anyway - there is no gate here');
  assert.equal(player.magicka, 0, 'DecreaseMagicka -> SetMagicka clamps at zero, it never refuses');
  assert.equal(magic.missileCount(), 1, 'and the missile left the hands');
});

test('AUDIT 54: the spell is priced ONCE, at the ready - a skill change mid-aim does not re-bill', () => {
  // :326-328 computes CalculateTotalEffectCosts and STORES it in
  // readySpellCastingCost; :423-425 spends that number. The port
  // recomputed at click time off the live entity.
  const player = mkPlayer();
  const sp = spellOf(2, [damageEffect()]);
  const quoted = calculateCastCost(sp, player).sp;
  const { magic } = magicRig(player);
  magic.readySpell(sp);
  player.skills = new Array(40).fill(100);   // an EnhancesSkill item comes off / a tally lands
  const reprice = calculateCastCost(sp, player).sp;
  assert.notEqual(reprice, quoted, 'the two moments really do price differently');
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(player.magicka, 500 - quoted, 'the READY price is the one billed');
});

// ── F3: the Shield pool on the foe doors ──────────────────────────

test('AUDIT 54: all three foe damage doors consult the Shield pool, and the zeroing door bypasses it', () => {
  // DaggerfallEntity.DecreaseHealth (:313-328) carries the hook on the
  // ABSTRACT BASE - "Allow an active shield effect to mitigate incoming
  // damage from all sources" - so a foe carrying the bundle absorbs
  // exactly as the player does. Only the player's door consumed it.
  for (const [file, sub] of [
    ['scenes/dungeonContext.js', 'const healthDamage = bypassShield ? damage : damageShieldPool(foe.entity, damage);'],
    ['scenes/exteriorFoes.js', 'const healthDamage = bypassShield ? damage : damageShieldPool(f.entity, damage);'],
    ['scenes/cityGuards.js', 'const healthDamage = bypassShield ? damage : damageShieldPool(g.entity, damage);'],
  ]) {
    const s = src(file);
    assert.ok(s.includes(sub), `${file} consults the pool before the subtraction`);
    assert.ok(!/\.entity\.health -= damage;/.test(s), `${file} no longer subtracts the RAW damage`);
    assert.ok(/import \{ damageShieldPool \}|damageShieldPool, setDeathPresenter/.test(s), `${file} imports the one home`);
  }
  // the SetHealth(0) door says bypassShield, the hurtPlayer idiom
  for (const file of ['scenes/dungeonContext.js', 'scenes/exteriorFoes.js']) {
    assert.match(src(file), /zeroFoeHealth: \(f\) => \{ if \(!f\.dead\) damageFoe\(f, f\.entity\.health, null, null, \{ bypassShield: true \}\); \}/,
      `${file}'s zeroFoeHealth is a kill, not a mitigated blow`);
  }
  // and the pool itself is the all-or-overflow consumer DamageShield is
  const foe = { activeEffects: [{ kind: 'shield', startingShield: 30, shieldRemaining: 30, roundsRemaining: 5 }] };
  assert.equal(damageShieldPool(foe, 12), 0, 'a blow inside the pool passes nothing through');
  assert.equal(foe.activeEffects[0].shieldRemaining, 18);
  assert.equal(damageShieldPool(foe, 20), 2, 'the blow that busts it passes only the overflow');
  assert.equal(foe.activeEffects[0].ended, true);
});

// ── F4/F5: the effect catalogue ───────────────────────────────────

test('AUDIT 54: the six concealment effects carry DFU\'s parenthesised DisplayName override', () => {
  // Six classes and only six override DisplayName, all at :41, all as
  // string.Format("{0} ({1})", GroupName, SubGroupName) - and the Spell
  // Maker's filled slot is DisplayName's one reader
  // (DaggerfallSpellMakerWindow.cs:461).
  const want = {
    '13,0': 'Invisibility (Normal)', '13,1': 'Invisibility (True)',
    '23,0': 'Chameleon (Normal)', '23,1': 'Chameleon (True)',
    '24,0': 'Shadow (Normal)', '24,1': 'Shadow (True)',
  };
  for (const [key, name] of Object.entries(want)) assert.equal(effectByKey(key).name, name, key);
  // GetDisplayName's DEFAULT arm is untouched everywhere else
  assert.equal(effectByKey('8,0').name, 'Elemental Resistance Fire');
  assert.equal(effectByKey('33,1').name, 'Pacify Undead');
  assert.equal(effectByKey('14,255').name, 'Levitate');
  // ...and the two pickers and the spellbook still read the parts, not
  // the DisplayName (DaggerfallSpellMakerWindow.cs:732/:947,
  // DaggerfallSpellBookWindow.cs:646-647).
  assert.equal(effectByKey('13,0').group, 'Invisibility');
  assert.equal(effectByKey('13,0').subgroup, 'Normal');
});

test('AUDIT 54: MorphSelf declares no support flag at all', () => {
  // MorphSelf.SetProperties (MorphSelf.cs:24-33) assigns no
  // properties.Support*, so BaseEntityEffect's ctor leaves all three
  // false (EntityEffect.cs:293-297) - the zero-component effect the
  // cost fudge exists for (FormulaHelper.cs:2330-2334).
  const e = effectByKey('29,255');
  assert.equal(e.duration, false, 'SupportDuration is false');
  assert.equal(e.chance, false);
  assert.equal(e.magnitude, false);
  assert.equal(e.craftable, false, 'AllowedCraftingStations = None keeps it out of the pickers');
  const teleport = effectByKey('43,255');   // the identically shaped sibling
  assert.deepEqual([e.duration, e.chance, e.magnitude], [teleport.duration, teleport.chance, teleport.magnitude]);
});

// ── F6: GivePc's pending offer ────────────────────────────────────

const VENDOR = join(root, 'vendor', 'dfu-quests');
const readFile = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFile(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
const HEADER = ['Quest: __O', 'QRC:', 'Message:  1011', ' x', '',
  `QuestComplete:  [${QUEST_MESSAGES.QuestComplete}]`, ' done', '', 'QBN:'];

function offerMachine() {
  const calls = [];
  const m = new QuestMachine({
    nowSeconds: () => m.now,
    showPopup: () => calls.push(['showPopup']),
    isPlayerInTown: () => m.inTown,
    giveItemToPlayer: (item, front) => calls.push(['giveItemToPlayer', item, front]),
    onOfferPending: (sender) => { calls.push(['onOfferPending', sender]); noteOfferPending(sender); },
  });
  m.now = 12 * 3600;
  m.inTown = false;
  m.calls = calls;
  m.of = (n) => calls.filter((c) => c[0] === n);
  return m;
}

test('AUDIT 54: GivePc raises OnOfferPending, and the next rest/travel press spends the latch', () => {
  // GivePc.cs:91-97 - the delay roll's LAST line is
  // RaiseOnOfferPendingEvent(this); DaggerfallUI latches the sender
  // (:352, :1731-1735) and GiveOffer() (:1717-1726) hands the item over
  // and consumes the press. Neither half existed.
  clearPendingOffer();
  const m = offerMachine();
  m.scheduleQuest([...HEADER, 'Item _l_ letter', '', ' give pc _l_ notify 1011'], 0, { rolls: () => 0.5 });
  m.tick();
  assert.equal(m.of('onOfferPending').length, 0, 'out of town: nothing pending yet');
  assert.equal(pendingOfferSender(), null);
  m.inTown = true;
  m.tick();
  assert.equal(m.of('onOfferPending').length, 1, 'the raise rides the same tick as the delay roll');
  assert.equal(m.of('giveItemToPlayer').length, 0, 'and the item has NOT been handed over yet');
  assert.equal(pendingOfferSender(), m.of('onOfferPending')[0][1], 'the UI latched the sender');
  m.tick();
  assert.equal(m.of('onOfferPending').length, 1, 'the raise is once per wait, not once per tick');

  // the press
  assert.equal(giveOffer(), true, 'GiveOffer answers TRUE, so the press is consumed');
  assert.equal(pendingOfferSender(), null, 'and the latch is spent');
  m.tick();
  assert.equal(m.of('giveItemToPlayer').length, 1, 'offerImmediately skipped the rest of the delay');
  assert.equal(giveOffer(), false, 'a second press finds nothing and rests/travels normally');
});

test('AUDIT 54: GiveOffer is a RUNG in both ladders - after the prevented message, before the racial override', () => {
  // Rest: DaggerfallUI.cs:680 `else if (!GiveOffer())`. Travel: :612
  // `if (!GiveOffer())`, between AreEnemiesNearby and the sun-damage box.
  const yes = () => true;
  assert.deepEqual(restDecision({ giveOffer: yes }), { kind: 'offer' });
  assert.deepEqual(restDecision({ giveOffer: yes, racialOverrideBlocks: true }), { kind: 'offer' },
    'the offer outranks the racial override, as :680 sits above it');
  assert.deepEqual(restDecision({ giveOffer: yes, preventedMessage: 'no' }), { kind: 'prevented', message: 'no' },
    'but the prevented-rest message outranks the offer');
  assert.deepEqual(restDecision({ giveOffer: yes, enemiesNearby: true }).kind, 'enemies');
  assert.deepEqual(restDecision({ giveOffer: () => false }), { kind: 'rest' });
  let calls = 0;
  restDecision({ enemiesNearby: true, giveOffer: () => { calls++; return true; } });
  assert.equal(calls, 0, 'GiveOffer has a SIDE EFFECT - it must not run on a press the enemies arm answered');

  // all four rest hosts take the rung, and the one travel host too
  for (const f of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const s = src(f);
    assert.match(s, /from '\.\.\/ui\/pendingOffer\.js'/, `${f} imports the latch`);
    assert.match(s, /^\s*giveOffer,$/m, `${f} passes the producer into restDecision`);
    assert.match(s, /if \(d\.kind === 'offer'\) return;/, `${f} swallows the press`);
  }
  const w = src('scenes/world.js');
  const travel = w.slice(w.indexOf('const toggleTravelMap'), w.indexOf('const ftb = racialFastTravelBlock'));
  assert.ok(travel.indexOf('areEnemiesNearby(') < travel.indexOf('if (giveOffer()) return;'),
    'the travel rung sits BELOW AreEnemiesNearby');
  assert.ok(travel.includes('if (giveOffer()) return;'), 'and ABOVE the racial fast-travel block');
  // the bridge IS DaggerfallUI's one subscription
  assert.match(src('scenes/questBridge.js'), /onOfferPending: \(givePc\) => noteOfferPending\(givePc\)/);
  assert.match(src('systems/quest/actions.js'), /hooks\?\.onOfferPending\?\.\(this\);/);
});

// ── F7: the talk MCP's random name ────────────────────────────────

test('AUDIT 54: GetRandomFullName draws the gender - the talk fallback is not always a man', () => {
  // MacroHelper.cs:333-341: `Genders gender =
  // (DFRandom.random_range_inclusive(0, 1) == 1) ? Female : Male;`
  // The port hardcoded Male, which both lost every woman AND left the
  // unspent draw shifting every later value on the stream.
  const bank = getNameBankOfRegion(17);
  const both = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    srand(seed);
    const got = getRandomFullName(17);
    srand(seed);
    const coin = randomRangeInclusive(0, 1);
    const want = fullName(bank, coin === 1 ? GENDERS.Female : GENDERS.Male);
    assert.equal(got, want, `seed ${seed} follows the coin`);
    both.add(coin);
  }
  assert.deepEqual([...both].sort(), [0, 1], 'both genders really are drawn');
  // the draw is SPENT even when it lands Male: a Male-only port would
  // have skipped it and produced the no-coin name instead.
  srand(3);
  const withCoin = getRandomFullName(17);
  srand(3);
  const noCoin = fullName(bank, GENDERS.Male);
  assert.notEqual(withCoin, noCoin, 'the coin draw shifts the stream, as C# spends it');
  // the -1 guard is GetRandomFullName's own (Breton), verbatim
  srand(9);
  const wild = getRandomFullName(-1);
  srand(9);
  const coin = randomRangeInclusive(0, 1);
  assert.equal(wild, fullName(getNameBankOfRegion(-1), coin === 1 ? GENDERS.Female : GENDERS.Male));
  // ...and the talk MCP calls it, over PlayerGPS.CurrentRegionIndex
  const w = src('scenes/world.js');
  assert.match(w, /randomFullName: \(\) => getRandomFullName\(_questRegionIndex\(\)\)/);
  assert.match(w, /const talkFullName = \(gender\) => nameHelperFullName\(getNameBankOfRegion\(_questRegionIndex\(\)\), gender\);/);
  assert.ok(!/talkFullName\(GENDERS\.Male\)/.test(w), 'no hardcoded Male fallback survives');
  // one home: the %rn arm calls it too rather than repeating the body
  assert.match(src('systems/quest/questMacros.js'), /return getRandomFullName\(w\.currentRegionIndex\?\.\(\) \?\? -1\);/);
});
