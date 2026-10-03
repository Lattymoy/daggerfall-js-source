// L10N3d (2026-09-27): THE EFFECTS BATCH - DFU'S MAGIC, ACTIVATION AND BODY WORDS IN THE PLAYER'S LANGUAGE. Every
// literal-key TextManager read in Game/MagicAndEffects/**, PlayerActivate, EnemyDeath, FPSWeapon, EnablePlayerTorch,
// PlayerEntity, ClimbingMotor and the Sanguine Rose/Skull that the port shows, read where it is shown. Pinned, through
// the port's own functions: each answers a translation's row in French and its own English, byte for byte, before
// French is chosen and after English is chosen again. The effect catalogue reads each class's own GroupName and
// SubGroupName key (the variant families by the English word, Cure's `poison` and Dispel's `undead` by theirs) while
// it keeps matching, sorting and naming DFU's effect Key in English; the port's own words (Resurrect, "True", the
// enchantment names it spells its own way) stay English.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { routedWords } from '../tools/l10nRouted.mjs';
import { SPELL_MAKER_EFFECTS, effectByKey, spellMakerGroups, spellMakerSubgroups, dfuEffectKeyOf } from '../src/systems/spellEffects.js';
import { applySpell, BUFF_START_TEXT, spellReflectedText } from '../src/systems/effects.js';
import { SPELL_ABSORPTION } from '../src/systems/absorption.js';
import { silencedText, pressButtonToFireSpellText } from '../src/systems/mysticism.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { POTION_RECIPES, knownRecipes, potionRecipeKeys, potionBundle, potionRecipeKey } from '../src/systems/potions.js';
import { sunlightTravelText, racialFastTravelBlock, liveRaceTemplate } from '../src/systems/vampirism.js';
import { racialSuppressInventory, racialSuppressTalk } from '../src/systems/lycanthropy.js';
import { enchantmentName, enchantmentParams, enchantmentParamName } from '../src/systems/enchantmentCatalogue.js';
import { lookAtLockText } from '../src/world/actionSystem.js';
import { tooFarAwayText, presentNpcInfoText } from '../src/player/activate.js';
import { youSeeEnemyText, activateMobileEnemy } from '../src/player/mobileEnemyActivate.js';
import { MODES, interactionModeText } from '../src/player/interactionMode.js';
import { buildingClosedText, lockedExteriorDoorText } from '../src/systems/buildingLocks.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { sayEnemyDied, openCorpseLoot } from '../src/scenes/corpseMarker.js';
import { BROKER_TEXT } from '../src/scenes/sigilBrokerPool.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { midScreenText } from '../src/ui/midScreenText.js';
import { tickPlayerTorch } from '../src/systems/playerTorch.js';
import { announceSkillRaise } from '../src/ui/levelNotice.js';
import { SKILLS } from '../src/systems/skills.js';
import { ClimbingState } from '../src/player/climbing.js';
import { SPECIAL_ARTIFACT_HANDLERS, ARTIFACTS } from '../src/systems/artifactEffects.js';

beforeEach(() => tm._resetTextManagerForTests());

/** A French row for each key: the key itself in guillemets, so every assertion names the row it expects. */
const FR = (key) => `«${key}»`;
const french = (...keys) => tm.patchLocaleTable('fr', 'Internal_Strings', keys.map((k) => [k, FR(k)]));
/** `read()` in English (the rows loaded, English chosen), in French, and in English again. */
function inEachLanguage(keys, read) {
  french(...keys);
  const en = read();
  tm.setLocale('fr');
  const fr = read();
  tm.setLocale('en');
  return { en, fr, back: read() };
}
/** The law every routed word keeps: English is `want` before and after, French the row. */
function routes(keys, read, want, wantFr) {
  const { en, fr, back } = inEachLanguage(keys, read);
  assert.deepEqual(en, want, 'English, before French is chosen');
  assert.deepEqual(fr, wantFr, 'French');
  assert.deepEqual(back, want, 'English again');
}

// ─── the effect catalogue: GroupName / SubGroupName / DisplayName ─────────────────────────────────────────────────

test('L10N3d effects: each effect class\'s GroupName and SubGroupName read by the key its class names, DisplayName built from them; the port\'s own Resurrect and DFU\'s "true" stay English; the catalogue still matches, sorts and names DFU\'s effect Key in English', () => {
  const keys = routedWords().filter((w) => w.file === 'src/systems/spellEffects.js').map((w) => w.key);
  assert.equal(keys.length, 68, 'every GroupName and SubGroupName key the classes name, "true" aside');
  const snap = () => SPELL_MAKER_EFFECTS.map((e) => [e.key, e.group, e.subgroup, e.name, dfuEffectKeyOf(e.type, e.subType)]);
  const english = snap();
  assert.deepEqual(effectByKey('13,0').name, 'Invisibility (Normal)');
  assert.deepEqual(effectByKey('9,5').name, 'Fortify Attribute Personality');
  const { en, fr, back } = inEachLanguage(keys, () => ({
    rows: snap(), groups: spellMakerGroups(), pacify: spellMakerSubgroups(FR('pacify')).map((e) => [e.key, e.subgroup]),
  }));
  assert.deepEqual(en.rows, english, 'English, byte for byte, with every row loaded');
  assert.deepEqual(back.rows, english, 'and again');
  const row = (k) => fr.rows.find(([key]) => key === k);
  assert.deepEqual(row('7,0'), ['7,0', FR('drain'), FR('strength'), `${FR('drain')} ${FR('strength')}`, 'Drain-Strength']);
  assert.deepEqual(row('3,1').slice(1, 3), [FR('cure'), FR('poison')], 'CurePoison.cs:38 reads "poison"');
  assert.deepEqual(row('8,2').slice(1, 3), [FR('elementalResistance'), FR('Poison')], 'ElementalResistance.cs:27 keys it "Poison"');
  assert.deepEqual(row('6,1').slice(1, 3), [FR('dispel'), FR('undead')], 'DispelUndead.cs:41 reads "undead"');
  assert.deepEqual(row('33,1').slice(1, 3), [FR('pacify'), FR('Undead')], 'PacifyEffect.cs:27 keys it "Undead"');
  assert.equal(row('13,0')[3], `${FR('invisibility')} (${FR('normal')})`, 'the six concealment classes\' "{0} ({1})"');
  assert.equal(row('23,1')[3], `${FR('chameleon')} (True)`, '"true" is the vendored table\'s TRUE: English');
  assert.deepEqual(row('45,255').slice(1, 4), ['Resurrect', '', 'Resurrect'], 'the port\'s own effect');
  assert.deepEqual(row('46,255').slice(1, 4), ['Shared Cartography', '', 'Shared Cartography'], 'PARTY-MAP\'s, the port\'s own too');
  for (const [k, g, s, , dfuKey] of fr.rows) {
    const [, gEn, sEn, , dfuEn] = english.find(([key]) => key === k);
    assert.equal(dfuKey, dfuEn, `${k}: DFU's effect Key stays English`);
    if (k !== '45,255' && k !== '46,255') assert.ok(g.startsWith('«'), `${k}: ${gEn} reads its row`);   // PARTY-MAP's Shared Cartography (46,255) is the port's own too
    if (sEn && sEn !== 'True') assert.ok(s.startsWith('«'), `${k}: ${sEn} reads its row`);
  }
  assert.deepEqual(fr.groups, [...new Set(fr.rows.filter(([k]) => effectByKey(k).craftable).map(([, g]) => g))].sort(),
    'GetGroupNames: the shown names, sorted');
  assert.deepEqual(fr.pacify, [['33,0', FR('Animal')], ['33,3', FR('Daedra')], ['33,2', FR('Humanoid')], ['33,1', FR('Undead')]],
    'GetEffectTemplates matches the shown GroupName; the subgroups sort by the shown SubGroupName');
});

// ─── the effects' HUD lines ────────────────────────────────────────────────────────────────────────────────────────

const effectRec = (type, subType, { mag = 5, dur = 0, chance = 0 } = {}) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: chance, chanceMod: 0, chancePerLevel: 1,
});
const target = (over = {}) => ({
  career: {}, maxHealth: 100, health: 100, maxMagicka: 100, magicka: 50, level: 1,
  skills: new Array(40).fill(50), stats: { intelligence: 50, willpower: 50, strength: 50 }, activeEffects: [], ...over,
});
const said = (effects, t = target()) => {
  const out = [];
  applySpell({ element: 0, rangeType: 0, effects }, 1, t, { say: (m) => out.push(m), hurt() {}, heal() {} }, () => 0.5, { name: 'caster' }, { day: false, inside: true });
  return out;
};

test('L10N3d effects: the drain, regeneration, absorption and landing lines, and the reflected line, in the player\'s language', () => {
  routes(['youFeelDrained'], () => said([effectRec(7, 0)]), ['You feel drained.'], [FR('youFeelDrained')]);   // DrainEffect.cs:106
  routes(['youAreRegenerating'], () => said([effectRec(18, 255, { dur: 10 })]), ['You are regenerating.'], [FR('youAreRegenerating')]);   // Regenerate.cs:51
  const absorber = () => target({ career: { spellAbsorptionFlags: SPELL_ABSORPTION.Always }, magicka: 0 });
  routes(['spellAbsorbed'], () => said([effectRec(4, 0, { mag: 20 })], absorber()), ['Spell was absorbed.'], [FR('spellAbsorbed')]);   // EntityEffectManager.cs:515
  routes(['youAreInvisible'], () => said([effectRec(13, 0, { dur: 3 })]), ['You are invisible.'], [FR('youAreInvisible')]);   // ConcealmentEffect.cs:70
  const landing = { invisNormal: 'youAreInvisible', invisTrue: 'youAreInvisible', chameleonNormal: 'youAreBlending', chameleonTrue: 'youAreBlending', shadeNormal: 'youAreAShade', shadeTrue: 'youAreAShade', silenced: 'youAreSilenced' };
  const english = { ...BUFF_START_TEXT };
  assert.deepEqual(Object.keys(english), [...Object.keys(landing), 'sharedCartography'], 'DFU\'s seven, and PARTY-MAP\'s own line - the port\'s (L10N4)');
  routes(Object.values(landing), () => ({ ...BUFF_START_TEXT }), english, { ...Object.fromEntries(Object.entries(landing).map(([k, key]) => [k, FR(key)])), sharedCartography: english.sharedCartography });
  assert.ok(Object.isFrozen(BUFF_START_TEXT));
  routes(['spellReflected'], () => spellReflectedText(), 'Spell was reflected.', FR('spellReflected'));   // EntityEffectManager.cs:1234
  routes(['youAreSilenced', 'pressButtonToFireSpell'], () => [silencedText(), pressButtonToFireSpellText()],
    ['You are silenced.', 'Press button to fire spell.'], [FR('youAreSilenced'), FR('pressButtonToFireSpell')]);
});

// the cast engine over stubs (the rig test/hostmagic.test.js builds), with its rolls handed in
const mkPlayer = (over = {}) => ({
  isPlayer: true, level: 1, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [], ...over,
});
function magicRig({ player = mkPlayer(), rolls = () => 0.99 } = {}) {
  const world = { said: [] };
  const say = (l) => world.said.push(l);
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {}, collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say },
    say, surfacePlayer() {}, foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: true, day: false }),
    rolls, startCastAnim: null,
  });
  return { magic, world };
}
const spellOf = (rangeType, effects) => ({ name: 'Test Spell', index: 90, element: 0, rangeType, effects });

test('L10N3d effects: the cast engine\'s own lines - silenced, no spell points, ready to fire, no spellbook, paralyzed, the failed chance and the saving throw', () => {
  const lines = (fn, opts) => { const { magic, world } = magicRig(opts); fn(magic); return world.said; };
  routes(['youAreSilenced'], () => lines((m) => m.readySpell(spellOf(2, [effectRec(4, 0)])), { player: mkPlayer({ isSilenced: true }) }),
    ['You are silenced.'], [FR('youAreSilenced')]);   // EntityEffectManager.cs:1939
  routes(['youDontHaveTheSpellPoints'], () => lines((m) => m.readySpell(spellOf(2, [effectRec(4, 0)])), { player: mkPlayer({ magicka: 0 }) }),
    ["You don't have the spell points."], [FR('youDontHaveTheSpellPoints')]);   // :339
  routes(['pressButtonToFireSpell'], () => lines((m) => m.readySpell(spellOf(2, [effectRec(4, 0)]))),
    ['Press button to fire spell.'], [FR('pressButtonToFireSpell')]);   // :355
  routes(['noSpellbook'], () => lines((m) => { m.readySpell(spellOf(0, [effectRec(10, 8)])); m.recastSpell(); }).slice(-1),
    ['You have no spellbook!'], [FR('noSpellbook')]);   // :263
  const land = (rangeType, chance, rolls) => lines((m) => m.applySpellToPlayer(spellOf(rangeType, [effectRec(0, 255, { dur: 5, chance })]), 1), { rolls });
  routes(['youAreParalyzed'], () => land(2, 100, () => 0.99), ['You are paralyzed.'], [FR('youAreParalyzed')]);   // Paralyze.cs:93
  routes(['spellEffectFailed'], () => land(0, 0, () => 0.99), ['Spell effect failed.'], [FR('spellEffectFailed')]);   // :542
  routes(['saveVersusSpellMade'], () => land(2, 0, () => 0.99), ['Save versus spell made.'], [FR('saveVersusSpellMade')]);   // :547
  routes(['saveVersusSpellMade'], () => land(2, 100, () => 0), ['Save versus spell made.'], [FR('saveVersusSpellMade')]);   // :576
});

// ─── potions, the curses, the enchantments ─────────────────────────────────────────────────────────────────────────

test('L10N3d effects: a potion\'s name is its DisplayNameKey\'s row - on the recipe, in the recipe picker\'s order and on the drink\'s bundle', () => {
  const english = POTION_RECIPES.map((r) => r.displayName);
  assert.deepEqual(english.slice(0, 5), ['Resist Fire', 'Resist Frost', 'Resist Shock', 'Resist Poison', 'Slow Falling']);
  const names = POTION_RECIPES.map((r) => r.name);
  routes(names, () => POTION_RECIPES.map((r) => r.displayName), english, names.map(FR));
  const healing = potionRecipeKey(POTION_RECIPES.find((r) => r.name === 'healing').ingredients);
  routes(['healing'], () => potionBundle(healing).name, 'Healing', FR('healing'));   // EntityEffectManager.cs:936 - Name = DisplayName
  tm.patchLocaleTable('fr', 'Internal_Strings', [['stamina', 'Aa endurance'], ['waterWalking', 'Ab marche']]);
  tm.setLocale('fr');
  assert.deepEqual(knownRecipes(potionRecipeKeys()).slice(0, 2).map((r) => r.name), ['stamina', 'waterWalking'],
    'Refresh sorts by the shown DisplayName (DaggerfallPotionMakerWindow.cs:164-170)');
});

test('L10N3d effects: the curses\' words - the day\'s travel refusal, the compound race\'s name, the shapechanged refusals', () => {
  routes(['sunlightDamageFastTravelDay'], () => [sunlightTravelText(), racialFastTravelBlock({ racialOverride: { sunDamage: true } }, 12 * 60)?.text],
    Array(2).fill('You cannot initiate fast travel during the day.'), Array(2).fill(FR('sunlightDamageFastTravelDay')));   // VampirismEffect.cs:202
  const cursed = (entry) => ({ race: 'Breton', activeEffects: [{ kind: 'racialOverride', ...entry }] });
  const vampire = cursed({ racial: 'vampirism', raceNameOverride: 'Vampire' });
  const wolf = cursed({ racial: 'lycanthropy', isTransformed: true, raceNameOverride: 'Werewolf' });
  const boar = cursed({ racial: 'lycanthropy', isTransformed: true, raceNameOverride: 'Wereboar' });
  const mortal = cursed({ racial: 'lycanthropy', isTransformed: false, raceNameOverride: null });
  routes(['vampire', 'werewolf', 'wereboar'], () => [vampire, wolf, boar].map((e) => liveRaceTemplate(e).name),
    ['Vampire', 'Werewolf', 'Wereboar'], [FR('vampire'), FR('werewolf'), FR('wereboar')]);   // VampirismEffect.cs:331, LycanthropyEffect.cs:514-516
  assert.equal(wolf.activeEffects[0].raceNameOverride, 'Werewolf', 'the entry keeps its English');
  assert.equal(liveRaceTemplate(mortal).name, liveRaceTemplate({ race: 'Breton' }).name, 'an untransformed lycanthrope is the birth race');
  routes(['inventoryWhileShapechanged', 'youGetNoResponse'], () => [racialSuppressInventory(wolf).text, racialSuppressTalk(wolf).text],
    ['You cannot access the inventory while shapechanged...', 'You get no response.'], [FR('inventoryWhileShapechanged'), FR('youGetNoResponse')]);   // LycanthropyEffect.cs:413, :427
});

test('L10N3d effects: an enchantment\'s names read TextManager where the port holds DFU\'s English; the names it spells its own way stay as they are', () => {
  const keys = ['FeatherWeight', 'IncreasedWeightAllowance', 'commoners', 'merchants', 'scholars', 'nobility', 'underworld', 'all',
    'add25Percent', 'add50Percent', 'allTheTime', 'inSunlight', 'inHolyPlaces', 'inDarknessLower', 'undead', 'daedra', 'humanoid',
    'animalsUpper', 'atRange', 'whenStrikes', 'AbsorbsSpells', 'duringWinter'];
  const read = () => ({
    names: ['FeatherWeight', 'IncreasedWeightAllowance', 'AbsorbsSpells'].map(enchantmentName),
    labels: ['GoodRepWith', 'BadRepWith', 'IncreasedWeightAllowance', 'ItemDeteriorates', 'LowDamageVs', 'PotentVs', 'RegensHealth', 'UserTakesDamage', 'VampiricEffect', 'ExtraSpellPts']
      .map((t) => enchantmentParams(t).join('|')),
    one: enchantmentParamName('RegensHealth', 2),
  });
  const { en, fr, back } = inEachLanguage(keys, read);
  assert.deepEqual(en.names, ['Feather Weight', 'Increased Weight Allowance', 'Absorbs Spells']);
  assert.deepEqual(back, en);
  assert.deepEqual(fr.names, [FR('FeatherWeight'), FR('IncreasedWeightAllowance'), 'Absorbs Spells'], 'DFU\'s "Absorbs spells" is not the port\'s English: it stays');
  assert.deepEqual(fr.labels.slice(0, 9), [
    ['commoners', 'merchants', 'scholars', 'nobility', 'underworld', 'all'], ['commoners', 'merchants', 'scholars', 'nobility', 'underworld', 'all'],
    ['add25Percent', 'add50Percent'], ['allTheTime', 'inSunlight', 'inHolyPlaces'], ['undead', 'daedra', 'humanoid', 'animalsUpper'],
    ['undead', 'daedra', 'humanoid', 'animalsUpper'], ['allTheTime', 'inSunlight', 'inDarknessLower'], ['inSunlight', 'inHolyPlaces'], ['atRange', 'whenStrikes'],
  ].map((ks) => ks.map(FR).join('|')));
  assert.equal(fr.labels[9], en.labels[9], 'ExtraSpellPts\' "During Winter" is not DFU\'s "during Winter": it stays');
  assert.equal(fr.one, FR('inDarknessLower'));
});

// ─── PlayerActivate's words ────────────────────────────────────────────────────────────────────────────────────────

test('L10N3d effects: LookAtInteriorLock\'s tiers, the list and its three single rows and the magic lock, in the player\'s language', () => {
  const tiers = () => [lookAtLockText(20, 10, 50), lookAtLockText(16, 1, 5), lookAtLockText(10, 10, 32), lookAtLockText(10, 10, 40),
    lookAtLockText(10, 10, 45), lookAtLockText(0, 10, 60), lookAtLockText(10, 10, 55)];
  const english = ['This is a magically held lock...', 'This lock has nothing to fear from you...', "It'd be a miracle if you picked this lock...",
    'This lock looks to be beyond your skills...', 'You doubt your ability to open this lock...', 'This lock is an insult to your abilities...',
    'You would be challenged by this lock...'];
  const list = Array.from({ length: 10 }, (_, i) => `liste ${i}`);
  french('magicLock', 'lockpickChance1', 'lockpickChance2', 'lockpickChance3');
  tm.patchLocaleTable('fr', 'Internal_Strings', [['lockpickChance', list.join('\n')]]);
  assert.deepEqual(tiers(), english);
  tm.setLocale('fr');
  assert.deepEqual(tiers(), [FR('magicLock'), FR('lockpickChance1'), FR('lockpickChance2'), FR('lockpickChance3'), 'liste 0', 'liste 9', 'liste 2']);
  tm.setLocale('en');
  assert.deepEqual(tiers(), english);
});

test('L10N3d effects: PlayerActivate\'s lines - too far, you see, you see a/an, the mode line, the closed shop and the locked door, the dead and the empty body', () => {
  routes(['youAreTooFarAway'], () => tooFarAwayText(), 'You are too far away...', FR('youAreTooFarAway'));
  tm._resetTextManagerForTests();
  tm.patchLocaleTable('fr', 'Internal_Strings', [['youSee', 'Vous voyez %s.']]);
  routes([], () => [presentNpcInfoText('Nithella Tomarnas'), BROKER_TEXT.info], ['You see Nithella Tomarnas.', 'You see the Sigil Broker.'],
    ['Vous voyez Nithella Tomarnas.', 'Vous voyez the Sigil Broker.']);   // :1486 - the Broker's line read as it is said
  tm._resetTextManagerForTests();
  tm.patchLocaleTable('fr', 'Internal_Strings', [['youSeeA', 'Vous voyez un %s.'], ['youSeeAn', 'Vous voyez un(e) %s.']]);
  routes([], () => [youSeeEnemyText('Rat'), youSeeEnemyText('Imp'), youSeeEnemyText('Orc')], ['You see a Rat.', 'You see an Imp.', 'You see an Orc.'],
    ['Vous voyez un Rat.', 'Vous voyez un(e) Imp.', 'Vous voyez un(e) Orc.']);   // :815-817, the vowel test on the shown name
  tm._resetTextManagerForTests();
  const foeLine = (mode, distance) => {
    const out = [];
    activateMobileEnemy({ mobileType: 0, entity: { isClass: true } }, distance, mode, mkPlayer(), { hud: (l) => out.push(l), midScreen: (l) => out.push(l) });
    return out;
  };
  routes(['youSeeA', 'youAreTooFarAway'], () => [...foeLine('info', 1), ...foeLine('steal', 1000)], ['You see a Rat.', 'You are too far away...'],
    [FR('youSeeA'), FR('youAreTooFarAway')]);   // :815-825, :834
  tm._resetTextManagerForTests();
  tm.patchLocaleTable('fr', 'Internal_Strings', [['interactionIsNowInMode', 'Mode %s.'], ...MODES.map((m) => [m, `<${m}>`])]);
  routes([], () => MODES.map(interactionModeText), MODES.map((m) => `Interaction is now in ${m} mode.`), MODES.map((m) => `Mode <${m}>.`));   // :1404-1424
  tm._resetTextManagerForTests();
  tm.patchLocaleTable('fr', 'Internal_Strings', [['guildClosed', 'Guilde fermée, %d1h-%d2h.'], ['storeClosed', 'Boutique fermée, %d1h-%d2h.'], ['lockedExteriorDoor', 'Verrouillé.']]);
  const closed = () => [buildingClosedText(BUILDING_TYPES.GuildHall), buildingClosedText(BUILDING_TYPES.GeneralStore),
    buildingClosedText(BUILDING_TYPES.Palace, { subject: 'Palace' }), lockedExteriorDoorText()];
  const { en, fr, back } = inEachLanguage([], closed);
  assert.deepEqual(en, ['Guild is closed. Open from 11:00 to 23:00.', 'Store is closed. Open from 6:00 to 23:00.',
    'Palace is closed. Open from 10:00 to 16:00.', 'Locked.']);
  assert.deepEqual(back, en);
  assert.deepEqual(fr, ['Guilde fermée, 11h-23h.', 'Boutique fermée, 6h-23h.', en[2], 'Verrouillé.'],
    'DFU\'s two rows with %d1/%d2 filled (:477-480); World Tooltips\' Palace sentence is the mod\'s own');
  tm._resetTextManagerForTests();
  tm.patchLocaleTable('fr', 'Internal_Strings', [['thingJustDied', '%s est mort.']]);
  routes(['theBodyHasNoTreasure'], () => {
    const out = [];
    sayEnemyDied((l) => out.push(l), 0);
    openCorpseLoot({ entity: { items: [] } }, { playerEntity: mkPlayer(), say: (l) => out.push(l) });
    return out;
  }, ['Rat just died.', 'The body has no treasure.'], ['Rat est mort.', FR('theBodyHasNoTreasure')]);   // EnemyDeath.cs:80, PlayerActivate.cs:945
});

// ─── the body's own lines ──────────────────────────────────────────────────────────────────────────────────────────

test('L10N3d effects: the bow with no arrows, the torch that dies, the skill that rises, the climb that starts, the summon with nobody near', () => {
  const bow = { name: 'Long Bow', group: 'Weapons', templateIndex: 130, material: 0 };
  const arrowsLine = () => {
    const r = createWeaponRig({
      renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art in tests'); },
      palette: null, audio: { playOneShot() {} }, entity: { items: [], equip: { slots: { [EQUIP_SLOTS.RightHand]: bow, [EQUIP_SLOTS.LeftHand]: null } } }, say() {},
    });
    r.frame(1 / 60);
    r.toggleSheath();
    midScreenText._reset();
    r.draw();
    const text = midScreenText.text;
    midScreenText._reset();
    return text;
  };
  routes(['youHaveNoArrows'], arrowsLine, 'You have no arrows.', FR('youHaveNoArrows'));   // FPSWeapon.cs:365
  const torchLine = () => {
    const out = [];
    const torch = { group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 1, maxCondition: 1 };
    const e = { stats: { luck: 50, willpower: 50, strength: 50 }, skills: [], activeEffects: [], level: 1, health: 30, maxHealth: 30, items: [torch], lightSource: torch };
    tickPlayerTorch(e, 21, { fromItems: true, say: (l) => out.push(l) });
    return out;
  };
  tm.patchLocaleTable('fr', 'Internal_Strings', [['lightDies', 'Votre %it s\'éteint.']]);
  routes([], torchLine, ['Your Torch flickers and dies.'], ['Votre Torch s\'éteint.']);   // EnablePlayerTorch.cs:82
  tm.patchLocaleTable('fr', 'Internal_Strings', [['skillImprove', 'Votre compétence %s progresse.']]);
  const skillLine = () => { const out = []; announceSkillRaise(SKILLS.Climbing, 30, { say: (l) => out.push(l), doc: null }); return out; };
  routes([], skillLine, ['Your Climbing skill has improved.'], ['Votre compétence Climbing progresse.']);   // PlayerEntity.cs:1389
  const climbLine = () => {
    const out = [];
    const cs = new ClimbingState({ tally() {}, inputs: () => ({ climbing: 50, luck: 0 }), rolls: () => 0, say: (l) => out.push(l) });
    const ctx = { forward: true, back: false, anyMove: true, falling: false, grounded: true, levitating: false, riding: false, touchingSides: true, horizontalPos: [0, 0], tooCloseToGround: () => false };
    for (let i = 0; i < 200 && !cs.isClimbing; i++) cs.step(1 / 60, ctx);
    cs.step(1 / 60, ctx);
    return out;
  };
  routes(['climbingMode'], climbLine, ['Climbing mode.'], [FR('climbingMode')]);   // ClimbingMotor.cs:603
  const roseLine = (subtype) => { const out = []; SPECIAL_ARTIFACT_HANDLERS.get(subtype).used({ ctx: { nearbyFoes: () => [], say: (l) => out.push(l) } }); return out; };
  routes(['noMonstersNearby'], () => [...roseLine(ARTIFACTS.SanguineRose), ...roseLine(ARTIFACTS.SkullOfCorruption)],
    Array(2).fill('There are no monsters nearby.'), Array(2).fill(FR('noMonstersNearby')));   // SanguineRoseEffect.cs:51, SkullOfCorruptionEffect.cs:89
});
