// L10N3d (2026-09-27): THE SHOPS AND SERVICES IN THE PLAYER'S LANGUAGE. DFU reads the words of its guilds (Temple,
// Services and the five guild classes) and of the trade, merchant, guild-service, cure, donation, banking, purchase and
// tavern windows through TextManager.GetLocalizedText at the moment it shows them; the port's laws and windows now do
// the same, each word through the text core by DFU's key with DFU's English. Pinned through the port's own functions
// and windows: every routed word answers a French row in French, and its English - with no language chosen, and with
// English chosen again - is byte for byte what it read before; a patterned line (%d, %s, {0} {1}) is filled AFTER the
// lookup, so a translation's own pattern is the one filled; a list key (the six rank-title lists, the tavern's eleven
// lines) puts a translation's lines in the English lines' places; a table stays keyed by the port's own names (the
// services, the divines) while its words come by DFU's keys; the temples' and the orders' title lists stay the one
// shared list in English. The readers the shared scene files are to call (avoidDeathText, notEnoughSpellPointsText,
// alreadyGivenHouseText, cannotBeRepairedText, interruptRepairText) are pinned here too, and the enhanced skins by
// source: they read the same readers the classic windows do.
import './modsOff.js';   // the tavern's own menu, not the survival arc's
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { GUILDS, getTitle, NON_MEMBER_TITLE } from '../src/systems/guilds.js';
import { templeOf, orderOf, DIVINES, TEMPLE_RANK_TITLES, KNIGHTLY_RANK_TITLES, getDivineLocalized } from '../src/systems/guildVariants.js';
import { DEITY_DESCRIPTIONS, AVOID_DEATH_TEXT, avoidDeathText, GUILD_SERVICES } from '../src/systems/guildServices.js';
import { SERVICE_LABEL, serviceLabel, serviceAccess, SERVICE_MEMBERS_ONLY } from '../src/systems/guildServiceFlow.js';
import { MERCHANT_SERVICE_LABEL, merchantServiceLabel } from '../src/ui/merchantServiceWindow.js';
import { QuestOfferFlow, GETTING_QUESTS_1, GETTING_QUESTS_2 } from '../src/systems/quest/offerFlow.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { receiveHouseDecision, ALREADY_GIVEN_HOUSE, alreadyGivenHouseText } from '../src/systems/knightlyGifts.js';
import { buildDonationFlow, buildCureDiseaseFlow, DONATE_HOW_MUCH, FREE_HOLIDAY_CURING, CURED_DISEASE } from '../src/ui/guildServiceWindows.js';
import { DONATION_THANKS_ID } from '../src/systems/guildServiceActions.js';
import { createFactionRep } from '../src/systems/factionRep.js';
import { startDisease } from '../src/systems/diseases.js';
import { SKILLS } from '../src/systems/skills.js';
import { repairStatusLabel, CANNOT_BE_REPAIRED_TEXT, INTERRUPT_REPAIR_TEXT, cannotBeRepairedText, interruptRepairText } from '../src/systems/repairService.js';
import {
  identifiedTallyText, NOT_ENOUGH_SPELL_POINTS_TEXT, notEnoughSpellPointsText, LETTER_OF_CREDIT_TEXT, letterOfCreditText,
  DOESNT_NEED_IDENTIFY, doesntNeedIdentifyText,
} from '../src/systems/tradeModes.js';
import { NativeTradeWindow, STEAL_SUCCESS_TEXT, STEAL_FAILURE_TEXT, stealSuccessText, stealFailureText } from '../src/ui/nativeTrade.js';
import { shopliftingLoad } from '../src/systems/theft.js';
import { calculateShopliftingChance } from '../src/combat/formulas.js';
import { BankWindow, CANNOT_CARRY_GOLD } from '../src/ui/bankWindow.js';
import { TRANSACTION_RESULT, bankingStatusRows, BANKING_STATUS_HEADERS, NO_ACCOUNT_TEXT, createBankAccounts } from '../src/systems/banking.js';
import { BankPurchaseWindow } from '../src/ui/bankPurchaseWindow.js';
import {
  TAVERN_MENU, tavernMenuLines, ROOM_FREE_FOR_KNIGHT, ROOM_FREE_HEARTS_DAY, YOU_ARE_NOT_HUNGRY,
  roomFreeForKnightText, roomFreeHeartsDayText, youAreNotHungryText,
} from '../src/systems/tavern.js';
import { TavernWindow, TAVERN_RECTS, TAVERN_PANEL_X, TAVERN_PANEL_Y } from '../src/ui/tavernWindow.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

beforeEach(() => tm._resetTextManagerForTests());
const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** French rows for the Internal_Strings keys given, and a recognisable French word for a key. */
const french = (rows) => tm.patchLocaleTable('fr', 'Internal_Strings', Object.entries(rows));
const fr = (key) => `«${key}» en français`;
/** The law every routed word keeps: `read()` answers its English before French is chosen, the French row once it
 *  is, and the English again - byte for byte - when English is chosen back. */
function speaks(read, english, inFrench, what) {
  assert.deepEqual(read(), english, `${what}: English before French is chosen`);
  tm.setLocale('fr');
  assert.deepEqual(read(), inFrench, `${what}: the French row`);
  tm.setLocale('en');
  assert.deepEqual(read(), english, `${what}: English again, byte for byte`);
}

// ── the guilds (Temple.cs, FightersGuild.cs, MagesGuild.cs, ThievesGuild.cs, DarkBrotherhood.cs, KnightlyOrder.cs) ──

const bob = { name: 'Bob' };
const bess = { name: 'Bess', gender: 'female' };
const tenLines = (key) => Array.from({ length: 10 }, (_, i) => `${key} ${i}`);

test('L10N3d services: every guild title is read where it is shown - the six rank lists by their DFU keys (RankTitles), the gendered ranks and the non-member (GetTitle)', () => {
  const lists = {
    fightersRanks: GUILDS.FightersGuild, magesRanks: GUILDS.MagesGuild, thievesRanks: GUILDS.ThievesGuild,
    darkBrotherhoodRanks: GUILDS.DarkBrotherhood, templeRanks: templeOf('Mara'), knightlyOrderRanks: orderOf('Rose'),
  };
  french(Object.fromEntries(Object.keys(lists).map((k) => [k, tenLines(k).join('\n')])));
  for (const [key, guild] of Object.entries(lists)) {
    const english = [...guild.rankTitles];
    assert.equal(english.length, 10, key);
    speaks(() => Array.from({ length: 10 }, (_, r) => getTitle({ rank: r }, bob, guild)), english, tenLines(key), key);
  }
  french({ matriarch: fr('matriarch'), sister: fr('sister'), knightSister: fr('knightSister'), darkSister: fr('darkSister'), nonMember: fr('nonMember') });
  for (const [key, read, english] of [
    ['matriarch', () => getTitle({ rank: 9 }, bess, templeOf('Arkay')), 'Matriarch'],
    ['sister', () => getTitle({ rank: 6 }, bess, templeOf('Arkay')), 'Sister'],
    ['knightSister', () => getTitle({ rank: 5 }, bess, orderOf('Owl')), 'Knight Sister'],
    ['darkSister', () => getTitle({ rank: 8 }, bess, GUILDS.DarkBrotherhood), 'Dark Sister'],
    ['nonMember', () => getTitle({ rank: -1 }, bob, templeOf('Mara')), NON_MEMBER_TITLE],
  ]) speaks(read, english, fr(key), key);
  tm.setLocale('fr');
  assert.equal(getTitle({ rank: -1 }, bob, GUILDS.FightersGuild), 'Bob', 'the base guild\'s non-member is the player\'s own name (Guild.cs:180), in any language');
  assert.equal(getTitle({ rank: 9 }, bob, templeOf('Arkay')), 'templeRanks 9', 'a man at rank 9 reads the list, not the gendered row');
});

test('L10N3d services: the temples\' and the orders\' titles stay ONE shared list in English, and a translation\'s list is the whole group\'s', () => {
  for (const d of Object.keys(DIVINES)) assert.equal(templeOf(d).rankTitles, TEMPLE_RANK_TITLES, d);
  for (const o of ['Rose', 'Owl', 'Candle']) assert.equal(orderOf(o).rankTitles, KNIGHTLY_RANK_TITLES, o);
  french({ templeRanks: tenLines('t').join('\n') });
  tm.setLocale('fr');
  assert.deepEqual(templeOf('Akatosh').rankTitles, tenLines('t'));
  assert.deepEqual(templeOf('Zenithar').rankTitles, tenLines('t'), 'every divine reads the one list');
  assert.equal(orderOf('Owl').rankTitles, KNIGHTLY_RANK_TITLES, 'no French row: the English list itself');
  assert.ok(Object.isFrozen(TEMPLE_RANK_TITLES) && Object.isFrozen(KNIGHTLY_RANK_TITLES));
});

test('L10N3d services: the temple\'s words - each deity line (%gdd) by its own DFU key, the divine\'s name through GetDivineLocalized (the key IS the name), Stendarr\'s mercy', () => {
  const descKey = {
    Akatosh: 'akatoshDesc', Arkay: 'arkayDesc', Dibella: 'dibellaDesc', Julianos: 'julianosDesc',
    Kynareth: 'kynarethDesc', Mara: 'maraDesc', Stendarr: 'stendarDesc', Zenithar: 'zenDesc',
  };
  assert.deepEqual(Object.keys(DEITY_DESCRIPTIONS).sort(), Object.keys(DIVINES).sort(), 'keyed by the divine, as the macro context asks');
  assert.ok(Object.isFrozen(DEITY_DESCRIPTIONS));
  const english = { ...DEITY_DESCRIPTIONS };
  french(Object.fromEntries(Object.values(descKey).map((k) => [k, fr(k)])));
  speaks(() => ({ ...DEITY_DESCRIPTIONS }), english, Object.fromEntries(Object.entries(descKey).map(([d, k]) => [d, fr(k)])), 'the deity lines');
  french(Object.fromEntries(Object.keys(DIVINES).map((d) => [d, `«${d}»`])));
  for (const d of Object.keys(DIVINES)) speaks(() => getDivineLocalized(d), d, `«${d}»`, d);
  tm.setLocale('fr');
  assert.equal(getDivineLocalized(''), '', 'no divine: nothing to name');
  tm.setLocale('en');
  french({ avoidDeath: fr('avoidDeath') });
  speaks(avoidDeathText, AVOID_DEATH_TEXT, fr('avoidDeath'), 'avoidDeath');
});

// ── the guild service windows (DaggerfallGuildServicePopupWindow.cs, -CureDisease.cs, -Donation.cs, Services.cs) ─

const player = (over = {}) => ({
  name: 'Bob', isPlayer: true, level: 2, health: 30, maxHealth: 30, goldPieces: 5000, items: [],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 20])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 50 }, activeEffects: [], fatigue: 3200, timeOfLastSkillTraining: 0, ...over,
});

test('L10N3d services: the cure and donation boxes - the field\'s label, the free holiday cure, the cure itself, and each box\'s %god through GetDivineLocalized', () => {
  const rows = (id) => [{ text: `rsc:${id} %god`, center: true }];
  const store = () => createFactionRep(new Map([[21, { id: 21, rep: 0, children: [] }]]));
  french({ serviceDonateHowMuch: fr('serviceDonateHowMuch'), freeHolidayCuring: fr('freeHolidayCuring'), curedDisease: fr('curedDisease'), Arkay: '«Arkay»' });
  const label = () => { const f = buildDonationFlow(player(), store(), 21, { rows, godName: 'Arkay' }); return [f.top.field.label, f._input.label]; };
  speaks(label, [DONATE_HOW_MUCH, DONATE_HOW_MUCH], [fr('serviceDonateHowMuch'), fr('serviceDonateHowMuch')], 'the donation field\'s label, read as the box is raised');
  const thanks = () => {
    const f = buildDonationFlow(player(), store(), 21, { rows, rolls: () => 0, godName: 'Arkay' });
    f.value = '100';
    f.input('Enter');
    return f.top.rows[0].text;
  };
  speaks(thanks, `rsc:${DONATION_THANKS_ID} Arkay`, `rsc:${DONATION_THANKS_ID} «Arkay»`, 'the donation box\'s %god');
  const cure = () => {
    const e = player();
    startDisease(e, 0, 0, () => 0);
    const f = buildCureDiseaseFlow(e, templeOf('Arkay'), null, { rows, now: () => 0, quality: 10, godName: 'Arkay' });
    const offer = f.top.rows[0].text.replace(/^rsc:\d+ /, '');
    f.input('KeyY');
    return [offer, f.top.rows[0].text];
  };
  speaks(cure, ['Arkay', CURED_DISEASE], ['«Arkay»', fr('curedDisease')], 'the cure offer\'s %god and the cure');
  const holiday = () => {
    const e = player();
    startDisease(e, 0, 0, () => 0);
    return buildCureDiseaseFlow(e, templeOf('Arkay'), null, { rows, now: () => 14 * 1440, quality: 10, regionIndex: 0, godName: 'Arkay' }).top.rows[0].text;
  };
  speaks(holiday, FREE_HOLIDAY_CURING, fr('freeHolidayCuring'), 'freeHolidayCuring (South Winds Prayer)');
});

test('L10N3d services: the service popups - each guild service\'s label by its DFU key while the service stays the port\'s name, the merchant\'s Sell and Banking, the members-only refusal, the quest wait box, the house already given', () => {
  const KEY = {
    Training: 'serviceTraining', Quests: 'serviceQuests', Repair: 'serviceRepairs', Identify: 'serviceIdentify',
    Donate: 'serviceDonate', CureDisease: 'serviceCure', BuyPotions: 'serviceBuyPotions', MakePotions: 'serviceMakePotions',
    BuySpells: 'serviceBuySpells', BuySpellsMages: 'serviceBuySpells', MakeSpells: 'serviceMakeSpells',
    BuyMagicItems: 'serviceBuyMagicItems', MakeMagicItems: 'serviceMakeMagicItems', SellMagicItems: 'serviceSellMagicItems',
    Teleport: 'serviceTeleport', DaedraSummoning: 'serviceDaedraSummon', Spymaster: 'serviceSpymaster',
    BuySoulgems: 'serviceBuySoulgems', ReceiveArmor: 'serviceReceiveArmor', ReceiveHouse: 'serviceReceiveHouse',
  };
  assert.deepEqual(Object.keys(SERVICE_LABEL), [...GUILD_SERVICES], 'keyed by the service');
  const english = GUILD_SERVICES.map(serviceLabel);
  french(Object.fromEntries(Object.values(KEY).map((k) => [k, fr(k)])));
  speaks(() => GUILD_SERVICES.map(serviceLabel), english, GUILD_SERVICES.map((s) => fr(KEY[s])), 'the guild service labels');
  tm.setLocale('fr');
  assert.equal(serviceLabel('BuySpellsMages'), serviceLabel('BuySpells'), 'the two share one row, as they share one arm (Services.cs:379-381)');
  assert.equal(serviceLabel('NotAService'), '?', 'DFU\'s `default:` answer, in any language');
  assert.deepEqual(Object.keys(SERVICE_LABEL), [...GUILD_SERVICES], 'the keys stay the port\'s names in French');
  assert.deepEqual(Object.keys(MERCHANT_SERVICE_LABEL), ['Sell', 'Banking']);
  tm.setLocale('en');
  french({ serviceSell: fr('serviceSell'), serviceBanking: fr('serviceBanking') });
  speaks(() => ['Sell', 'Banking', 'Other'].map(merchantServiceLabel), ['Sell', 'Banking', 'Sell'],
    [fr('serviceSell'), fr('serviceBanking'), fr('serviceSell')], 'the merchant\'s labels, the default folded into Sell');
  french({ serviceMembersOnly: fr('serviceMembersOnly'), serviceReceiveHouseAlready: fr('serviceReceiveHouseAlready') });
  speaks(() => serviceAccess(GUILDS.FightersGuild, null, 'Training'), { allowed: false, text: SERVICE_MEMBERS_ONLY },
    { allowed: false, text: fr('serviceMembersOnly') }, 'serviceMembersOnly');
  speaks(() => receiveHouseDecision({ rank: 9, flags: 2 }), { kind: 'refuse', line: ALREADY_GIVEN_HOUSE },
    { kind: 'refuse', line: fr('serviceReceiveHouseAlready') }, 'serviceReceiveHouseAlready');
  speaks(alreadyGivenHouseText, ALREADY_GIVEN_HOUSE, fr('serviceReceiveHouseAlready'), 'the house refusal\'s reader');
  french({ gettingQuests1: fr('gettingQuests1'), gettingQuests2: 'Patientez donc un moment, %pcf.' });
  const wait = () => new QuestOfferFlow(
    { isLastNPCClickedAnActiveQuestor: () => false, deps: { playerLevel: () => 1 } },
    { getGuildQuestPool: () => [] },
    { guildQuestListBox: true, getGuildFactionId: () => 41 },
  ).offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { isMember: () => false, rank: 0, getReputation: () => 0 } }).textLines;
  speaks(wait, [GETTING_QUESTS_1, GETTING_QUESTS_2], [fr('gettingQuests1'), 'Patientez donc un moment, %pcf.'],
    'the wait box, its %pcf left for the box\'s own macro pass');
});

// ── the trade window (DaggerfallTradeWindow.cs) ─────────────────────────────────────────────────────────────────────

const good = (v, kg) => ({ group: 'Weapons', templateIndex: 1, value: v, weight: kg, stackCount: 1 });
function tradeWin({ mode = 'Buy', hooks = {} } = {}) {
  const shelf = [good(100, 2)];
  const said = [];
  const w = new NativeTradeWindow({
    mode, shelfItems: () => shelf, packItems: () => [], otherItems: () => [], isEquipped: () => false,
    accepts: () => true, enchanted: () => false,
    priceCtx: () => ({ quality: 10, priceAdjustment: 1, skills: {} }),
    gold: () => 10000, rows: () => [], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 500 }), commit: () => true,
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
    entity: { stats: { strength: 50 } }, pickpocketSkill: () => 50,
    tallyPickpocket: () => {}, tallyCrimeGuild: () => {}, crimeTheft: () => {}, spawnCityGuards: () => {},
    say: (line) => said.push(line),
    ...hooks,
  });
  return { w, said };
}
/** DoSteal with the roll just past the chance (`side` +1: FailedRoll, got away with it) or just under it (-1: caught). */
function steal(side) {
  const { w, said } = tradeWin();
  w._pickRemote(0);
  const chance = calculateShopliftingChance(50, 10, shopliftingLoad(w.basket));
  const real = Math.random;
  Math.random = () => (chance + side) / 100;
  try { w._doSteal(); } finally { Math.random = real; }
  return said[0];
}

test('L10N3d services: the trade window - the repair label (its %d filled after the lookup), the refusals, the interrupt box, the identify tally (string.Format, the pattern\'s order), the letter of credit, the thief\'s two lines', () => {
  french({
    repairDone: 'FINI', repairDays: '%d jours', cannotBeRepaired: fr('cannotBeRepaired'), interruptRepair: fr('interruptRepair'),
    doesntNeedIdentify: fr('doesntNeedIdentify'), notEnoughSpellpointsLeft: fr('notEnoughSpellpointsLeft'),
    totalIdentified: '{1} objets, {0} identifiés.', letterOfCredit: fr('letterOfCredit'),
    stealSuccess: fr('stealSuccess'), stealFailure: fr('stealFailure'),
  });
  const done = { repairData: { buildingKey: 1, timeStarted: 0, repairTime: MINUTES_PER_DAY }, currentCondition: 1, maxCondition: 10 };
  const pending = { repairData: { buildingKey: 1, timeStarted: 0, repairTime: 3 * MINUTES_PER_DAY }, currentCondition: 1, maxCondition: 10 };
  speaks(() => [repairStatusLabel(done, MINUTES_PER_DAY), repairStatusLabel(pending, 0)], ['DONE', '3 days'], ['FINI', '3 jours'],
    'RepairItemLabelTextHandler');
  speaks(() => identifiedTallyText(2, 5), '2 out of 5 identified.', '5 objets, 2 identifiés.', 'totalIdentified');
  for (const [key, read, english] of [
    ['cannotBeRepaired', cannotBeRepairedText, CANNOT_BE_REPAIRED_TEXT], ['interruptRepair', interruptRepairText, INTERRUPT_REPAIR_TEXT],
    ['doesntNeedIdentify', doesntNeedIdentifyText, DOESNT_NEED_IDENTIFY], ['notEnoughSpellpointsLeft', notEnoughSpellPointsText, NOT_ENOUGH_SPELL_POINTS_TEXT],
    ['letterOfCredit', letterOfCreditText, LETTER_OF_CREDIT_TEXT],
    ['stealSuccess', stealSuccessText, STEAL_SUCCESS_TEXT], ['stealFailure', stealFailureText, STEAL_FAILURE_TEXT],
  ]) speaks(read, english, fr(key), `${key}'s reader`);
  const refusal = (r) => () => { const { w } = tradeWin(); w._refuse(r); return w.box.rows[0].text; };
  speaks(refusal('notRepairable'), CANNOT_BE_REPAIRED_TEXT, fr('cannotBeRepaired'), 'the Repair refusal the window shows');
  speaks(refusal('identified'), DOESNT_NEED_IDENTIFY, fr('doesntNeedIdentify'), 'the Identify refusal the window shows');
  const letter = () => {
    const { w } = tradeWin({ mode: 'Sell', hooks: { weight: () => ({ carriedWeightKg: 100, maxEncumbranceKg: 100 }) } });
    w._confirm(1000);
    return w.box.rows[0].text;
  };
  speaks(letter, LETTER_OF_CREDIT_TEXT, fr('letterOfCredit'), 'the letter of credit the window hands over');
  speaks(() => [steal(+1), steal(-1)], [STEAL_SUCCESS_TEXT, STEAL_FAILURE_TEXT], [fr('stealSuccess'), fr('stealFailure')], 'DoSteal\'s HUD lines');
});

// ── the bank (DaggerfallBankingWindow.cs, DaggerfallBankPurchasePopUp.cs) ──────────────────────────────────────────

test('L10N3d services: the bank - the TOO_HEAVY line, the status box\'s four headers and its empty row, the purchase list\'s price with its %s filled after the lookup', () => {
  french({
    cannotCarryGold: fr('cannotCarryGold'), region: 'Région', account: 'Compte', loan: 'Prêt', dueDate: 'Échéance',
    noAccount: 'Aucun', bankPurchasePrice: 'Prix : %s pièces d\'or',
  });
  const tooHeavy = () => {
    const w = new BankWindow({ accounts: () => createBankAccounts(62), regionIndex: () => 17, level: () => 5, now: () => 1000, rows: (id) => [{ text: `#${id}`, center: true }] });
    w._popup(TRANSACTION_RESULT.TOO_HEAVY);
    return w.box.rows[0].text;
  };
  speaks(tooHeavy, CANNOT_CARRY_GOLD, fr('cannotCarryGold'), 'cannotCarryGold');
  const status = () => {
    const rows = bankingStatusRows(createBankAccounts(3), { regionName: () => 'Daggerfall' });
    return [rows[0].cells.map((c) => c.text), rows.at(-1).text];
  };
  speaks(status, [[...BANKING_STATUS_HEADERS], NO_ACCOUNT_TEXT], [['Région', 'Compte', 'Prêt', 'Échéance'], 'Aucun'], 'the status box');
  assert.deepEqual(BANKING_STATUS_HEADERS, ['Region', 'Account', 'Loan', 'Loan Due Date'], 'the English headers themselves, unchanged');
  const ships = () => new BankPurchaseWindow({ onClose: () => {} }).rows().map((r) => r.text);
  speaks(ships, ['Price : 100000 gold', 'Price : 200000 gold'], ['Prix : 100000 pièces d\'or', 'Prix : 200000 pièces d\'or'], 'bankPurchasePrice');
});

// ── the tavern (DaggerfallTavernWindow.cs) ──────────────────────────────────────────────────────────────────────────

function tavern({ day = 100, free = false, ateMinutesAgo = null } = {}) {
  const now = (day - 1) * MINUTES_PER_DAY + 600;
  const entity = { name: 'Rin', health: 20, maxHealth: 50, rentedRooms: [], goldPieces: 5000, items: [], stats: { personality: 50 } };
  if (ateMinutesAgo != null) entity.lastTimePlayerAteOrDrankAtTavern = now - ateMinutesAgo;
  return new TavernWindow({
    entity, rows: (id) => [{ text: `#${id}`, center: true }], now: () => now,
    mapId: () => 7, buildingKey: () => 42, buildingName: () => 'The Dancing Dagger', quality: () => 10, bedCount: () => 4,
    freeRooms: () => free, skills: () => ({ mercantile: 50, personality: 50 }),
    heal: () => {}, onTalk: () => {}, onClose: () => {}, rolls: () => 0.5,
  });
}
const press = (w, key) => { const [x, y, rw, rh] = TAVERN_RECTS[key]; w.click(TAVERN_PANEL_X + x + rw / 2, TAVERN_PANEL_Y + y + rh / 2); };
const rentFor = (w, days) => {
  press(w, 'room');
  for (let i = 0; i < 12; i++) w.flow.input('backspace');
  for (const ch of String(days)) w.flow.input(`char:${ch}`);
  w.flow.input('Enter');
  return w.flow.top.rows[0].text;
};

test('L10N3d services: the tavern - its eleven menu lines each in its own place (the prices stay the index\'s), the knight\'s free room, Heart\'s Day, not hungry', () => {
  const MENU = ['tavernAle', 'tavernBeer', 'tavernMead', 'tavernWine', 'tavernBread', 'tavernBroth', 'tavernCheese',
    'tavernFowl', 'tavernGruel', 'tavernPie', 'tavernStew'];
  french({
    ...Object.fromEntries(MENU.map((k) => [k, fr(k)])), roomFreeForKnightSuchAsYou: fr('roomFreeForKnightSuchAsYou'),
    roomFreeDueToHeartsDay: fr('roomFreeDueToHeartsDay'), youAreNotHungry: fr('youAreNotHungry'),
  });
  speaks(tavernMenuLines, [...TAVERN_MENU], MENU.map(fr), 'tavernMenu');
  speaks(() => { const w = tavern(); press(w, 'food'); return w.flow.top.picker; }, [...TAVERN_MENU], MENU.map(fr), 'the food picker');
  speaks(() => { const w = tavern({ ateMinutesAgo: 60 }); press(w, 'food'); return w.flow.top.rows[0].text; }, YOU_ARE_NOT_HUNGRY, fr('youAreNotHungry'), 'youAreNotHungry');
  speaks(() => rentFor(tavern({ free: true }), 5), ROOM_FREE_FOR_KNIGHT, fr('roomFreeForKnightSuchAsYou'), 'roomFreeForKnightSuchAsYou');
  speaks(() => rentFor(tavern({ day: 46 }), 1), ROOM_FREE_HEARTS_DAY, fr('roomFreeDueToHeartsDay'), 'roomFreeDueToHeartsDay (FormulaHelper.cs:1872)');
  for (const [read, english] of [[roomFreeForKnightText, ROOM_FREE_FOR_KNIGHT], [roomFreeHeartsDayText, ROOM_FREE_HEARTS_DAY], [youAreNotHungryText, YOU_ARE_NOT_HUNGRY]]) {
    assert.equal(read(), english, 'each reader in English is its constant');
  }
  assert.deepEqual([...TAVERN_MENU], ['Ale (1 gold)', 'Beer (1 gold)', 'Mead (2 gold)', 'Wine (3 gold)', 'Bread (1 gold)', 'Broth (1 gold)',
    'Cheese (2 gold)', 'Fowl (3 gold)', 'Gruel (2 gold)', 'Pie (2 gold)', 'Stew (3 gold)'], 'the English menu itself, unchanged and in DFU\'s order');
});

// ── the enhanced skins, by source ───────────────────────────────────────────────────────────────────────────────────

test('L10N3d services by source: the enhanced trade and tavern skins read the same routed readers the classic windows do - no copy of the English left in them', () => {
  const trade = rd('src/ui/enhancedTrade.js');
  for (const reader of ['cannotBeRepairedText()', 'doesntNeedIdentifyText()', 'interruptRepairText()', 'stealSuccessText()', 'stealFailureText()']) {
    assert.ok(trade.includes(reader), `enhancedTrade.js reads ${reader}`);
  }
  assert.equal(trade.split('letterOfCreditText()').length - 1, 2, 'both letter-of-credit boxes read the reader');
  for (const en of [LETTER_OF_CREDIT_TEXT, CANNOT_BE_REPAIRED_TEXT, INTERRUPT_REPAIR_TEXT, DOESNT_NEED_IDENTIFY]) assert.ok(!trade.includes(en), `no copy of "${en}"`);
  assert.doesNotMatch(trade, /\b(CANNOT_BE_REPAIRED_TEXT|INTERRUPT_REPAIR_TEXT|DOESNT_NEED_IDENTIFY|STEAL_SUCCESS_TEXT|STEAL_FAILURE_TEXT)\b/, 'no bare constant shown');
  const tavernSkin = rd('src/ui/enhancedTavern.js');
  for (const reader of ['roomFreeForKnightText()', 'roomFreeHeartsDayText()', 'youAreNotHungryText()', 'tavernMenuLines()']) {
    assert.ok(tavernSkin.includes(reader), `enhancedTavern.js reads ${reader}`);
  }
  assert.doesNotMatch(tavernSkin, /\b(ROOM_FREE_FOR_KNIGHT|ROOM_FREE_HEARTS_DAY|YOU_ARE_NOT_HUNGRY|TAVERN_MENU)\b/, 'no bare constant shown');
});
