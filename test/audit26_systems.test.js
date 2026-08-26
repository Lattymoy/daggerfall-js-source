// AUDIT 26 - the SYSTEMS wave's pins. Each one asserts the DFU law
// the finding named, against DFU's own literals, and each fails when
// the ported law is reverted to what the audit found.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PAINTING_TEXT_BASE, PAINTING_RECORD_COUNT, paintingRecordPart, initPaintingInfo,
  paintingMacros, expandItemInfo, itemInfoRows, itemInfoTextId, INFO_TEXT, setPaintFile,
} from '../src/systems/itemInfo.js';
import { PAINTING_MESSAGE_RANGE, rollPaintingMessage } from '../src/systems/itemTemplates.js';
import { srand, rand, getSeed } from '../src/formats/dfRandom.js';
import { fullName } from '../src/characters/nameHelper.js';

import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import {
  claimMagicRounds, resetMagicRoundMarker, setWorldMinutes, MAX_CATCHUP_ROUNDS,
} from '../src/systems/worldTick.js';

import { applyCreationExtras } from '../src/systems/chargenSession.js';
import { REGION_COUNT, REGION_FLAGS, conditionFlag } from '../src/systems/regionConditions.js';
import { updateRegionalPrices, PRICE_ADJUSTMENT_MIN } from '../src/systems/shopStock.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

import { GUILDS, numHighLowSkills, calculateNewRank } from '../src/systems/guilds.js';
import { tooSkilledToTrain } from '../src/systems/guildServiceActions.js';
import { trainingMax } from '../src/systems/guildServices.js';
import { SKILLS, SKILL_COUNT, skillValue, permanentSkillValue } from '../src/systems/skills.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';

import { createArtifact } from '../src/systems/loot.js';
import { itemIsIdentified } from '../src/systems/tradeModes.js';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { QuestListsManager } from '../src/systems/quest/questLists.js';
import { QuestOfferFlow } from '../src/systems/quest/offerFlow.js';

// ── F208: the painting identity (DaggerfallUnityItemMCP.cs:37-74, :185-218) ──

/** A record whose four slots each hold exactly ONE choice - the
 *  terminator sits at start+1, so GetPaintingRecordPart takes the byte
 *  without spending a draw. */
function oneChoiceRecord({ sub = 5, adj = 7, pp1 = 1, pp2 = 2 } = {}) {
  const r = new Uint8Array(40).fill(0);
  r[0] = sub; r[1] = 0xff;
  r[10] = adj; r[11] = 0xff;
  r[20] = pp1; r[21] = 0xff;
  r[30] = pp2; r[31] = 0xff;
  return r;
}

test('AUDIT 26 F208: InitPaintingInfo mints the painting identity off the message seed (:37-66)', () => {
  // The four TEXT.RSC bases (:59-62) and the record count (:43),
  // verbatim - a shifted base moves every painting's words.
  assert.deepEqual({ ...PAINTING_TEXT_BASE }, { sub: 6100, adj: 6200, pp1: 6300, pp2: 6400 });
  assert.equal(PAINTING_RECORD_COUNT, 180);
  // SetItem's own seed draw (DaggerfallUnityItem.cs:571):
  // `Random.Range(0, 65536)` for Paintings, 0 for everything else.
  assert.equal(PAINTING_MESSAGE_RANGE, 65536);
  assert.equal(rollPaintingMessage(() => 0), 0);
  assert.equal(rollPaintingMessage(() => 0.999999), 65535);

  const rec = oneChoiceRecord();
  const item = { group: 'Paintings', message: 1234 };
  let reads = 0;
  const info = initPaintingInfo(item, (i) => { reads++; return rec; }, () => [{ text: 'row' }]);
  assert.ok(info, 'a Paintings item with a PAINT.DAT reader mints an identity');
  // `paintingIndex & 7` is the CIF record and `(paintingIndex >> 3) +
  // 'A'` the file letter (:44-46).
  srand(1234);
  const paintingIndex = rand() % PAINTING_RECORD_COUNT;
  assert.equal(info.fileIdx, paintingIndex & 7);
  assert.equal(info.filename, `${String.fromCharCode((paintingIndex >> 3) + 65)}PAINT.CIF`);
  // record byte + base, per slot (:59-62)
  assert.deepEqual(
    { sub: info.sub, adj: info.adj, pp1: info.pp1, pp2: info.pp2 },
    { sub: 6105, adj: 6207, pp1: 6301, pp2: 6402 });
  // `dataSource.paintingInfo == null` (:40) - minted ONCE per item
  assert.equal(reads, 1);
  assert.equal(initPaintingInfo(item, () => rec, () => []), info, 'the cached identity comes back');
  assert.equal(reads, 1, 'the second look reads no record');

  // GetPaintingRecordPart (:68-74): a one-choice slot spends NO draw.
  srand(99); const control = rand();
  srand(99); paintingRecordPart(rec, 0, 9); const after = rand();
  assert.equal(after, control, 'the single-choice slot is taken without a draw');
  // ...and a wider slot draws over the whole walked run.
  const wide = new Uint8Array(40).fill(0);
  wide[0] = 11; wide[1] = 22; wide[2] = 33; wide[3] = 0xff;
  srand(7); const drawn = paintingRecordPart(wide, 0, 9); const spent = rand();
  srand(7); assert.notEqual(spent, rand(), 'a multi-choice slot DID spend a draw');
  assert.ok([11, 22, 33].includes(drawn), 'the draw lands inside the walked run');
});

test('AUDIT 26 F208: painting record 70 gets DFU\'s known-buggy patch (:47-57)', () => {
  // "Known buggy paintingRecord ... not fixed in PAINT.DAT": record 70
  // with an immediate 0xFF in its fourth slot is overwritten with
  // summer/spring/afternoon/Highrock.
  let seed = -1;
  for (let m = 0; m < 65536; m++) {
    srand(m);
    if (rand() % PAINTING_RECORD_COUNT === 70) { seed = m; break; }
  }
  assert.ok(seed >= 0, 'some message seed draws record 70');
  const rec = oneChoiceRecord();
  rec[30] = 0xff;
  initPaintingInfo({ group: 'Paintings', message: seed }, () => rec, () => []);
  assert.deepEqual([rec[30], rec[31], rec[32], rec[33]], [3, 6, 8, 10],
    'summer / spring / afternoon / Highrock, verbatim');
});

test('AUDIT 26 F208: the five painting macros burn DFU\'s draws and fill the panel (:185-218)', () => {
  const rec = oneChoiceRecord();
  const info = initPaintingInfo({ group: 'Paintings', message: 1234 }, () => rec, () => []);

  // Every macro opens with a bare rand() ("Classic uses every other
  // value"); %an burns one more, then reads gender from `rand() & 1`
  // and the name bank from `rand() & 7` (:212-217). Replayed by hand
  // here, and the SEED the replay leaves is compared - so an added,
  // dropped or reordered draw fails the pin even when the words match.
  srand(4242);
  const r = [];
  for (let i = 0; i < 7; i++) r.push(rand());       // four parts, the %an burn, gender, bank
  const expectedArtist = fullName(r[6] & 7, r[5] & 1);   // FullName draws off the same stream
  const expectedSeed = getSeed();

  srand(4242);
  const ids = [];
  const macros = paintingMacros(info, (id) => { ids.push(id); return `W${id}`; });
  assert.equal(getSeed(), expectedSeed, 'the walk spent exactly DFU\'s draws, in DFU\'s order');
  assert.deepEqual(ids, [info.sub, info.adj, info.pp1, info.pp2],
    'the four record readers run in DFU\'s order');
  assert.deepEqual(macros, {
    sub: `W${info.sub}`, adj: `W${info.adj}`, pp1: `W${info.pp1}`, pp2: `W${info.pp2}`,
    artist: expectedArtist,
  });

  // ...and the panel's macro pass fills all five (they printed raw).
  const item = { group: 'Paintings', message: 1234 };
  const text = expandItemInfo('%an painted a %adj %pp1 %pp2 %sub', item, { painting: macros });
  assert.equal(text, `${macros.artist} painted a W6207 W6301 W6402 W6105`);
  assert.ok(!/%(sub|adj|pp1|pp2|an)/.test(text), 'no raw painting macro survives');
});

test('AUDIT 26 F208: the Info panel routes a painting through its own identity (ItemHelper.cs:788-789)', () => {
  const item = { group: 'Paintings', message: 777 };
  assert.equal(itemInfoTextId(item), INFO_TEXT.painting);
  assert.equal(INFO_TEXT.painting, 250);
  const rec = oneChoiceRecord();
  setPaintFile({ read: () => rec });
  try {
    const rows = itemInfoRows(item, (id) => (id === INFO_TEXT.painting
      ? [{ text: 'A %adj %pp1 %pp2 %sub by %an.' }]
      : [{ text: `word${id}` }]));
    assert.equal(rows.length, 1);
    assert.ok(!/%(sub|adj|pp1|pp2|an)/.test(rows[0].text), rows[0].text);
    assert.ok(rows[0].text.startsWith('A word6207 word6301 word6402 word6105 by '), rows[0].text);
  } finally {
    setPaintFile(null);
  }
});

// ── F084: the magic-round marker re-anchors on LOAD ───────────────

const savePlayer = () => ({ stats: {}, skills: new Array(SKILL_COUNT).fill(30), items: [] });

test('AUDIT 26 F084: a load re-anchors the broker marker - zero catch-up rounds (EntityEffectBroker.cs:817-823)', () => {
  // InitMagicRoundTimer, "Called when game starts or loaded, after
  // world time has been set/restored": lastGameMinute takes the
  // RESTORED clock, so a load fires no catch-up rounds whichever way
  // the clock moved. Without it a load FORWARD of the session clock
  // left the marker behind and the next tick claimed the gap.
  resetMagicRoundMarker(1000);
  setWorldMinutes(1000);
  claimMagicRounds(1000, 1000);   // the session sits at minute 1000

  const snap = snapshotPlayer(savePlayer(), { classicMinutes: 50000 });
  const extras = restorePlayer(savePlayer(), snap);
  assert.ok(extras, 'the snapshot restores');
  assert.equal(extras.classicMinutes, 50000);

  setWorldMinutes(extras.classicMinutes);
  assert.deepEqual(claimMagicRounds(50000, 50001), { from: 50000, to: 50001, rounds: 1 },
    'the first tick after the load claims ONE minute, not the catch-up cap');
  // the cap is what the un-anchored marker would have delivered
  assert.equal(MAX_CATCHUP_ROUNDS, 2880);
});

test('AUDIT 26 F084: without the load re-anchor the same jump would burst the cap', () => {
  // The counter-case, so the pin above cannot pass by accident: an
  // un-anchored marker really does yield MAX_CATCHUP_ROUNDS.
  resetMagicRoundMarker(1000);
  claimMagicRounds(1000, 1000);
  assert.deepEqual(claimMagicRounds(50000, 50001),
    { from: 50001 - MAX_CATCHUP_ROUNDS, to: 50001, rounds: MAX_CATCHUP_ROUNDS });
});

// ── F106: the region-condition store is minted at NEW GAME ────────

test('AUDIT 26 F106: a new character is born with the region-condition store (PlayerEntity.cs:2189-2218)', () => {
  // StartGameBehaviour.cs:432-433 "Initialize region data" runs at
  // every new game, so the PricesHigh/PricesLow writes work from day
  // one. The store's only other assignment was the save restore, so a
  // session started FRESH ran with none.
  const e = { stats: {}, skills: [], items: [] };
  applyCreationExtras(e, { careerIndex: 0, isCustom: false }, null, { rolls: () => 0 });
  assert.ok(Array.isArray(e.regionConditions), 'the store exists before any load');
  assert.equal(e.regionConditions.length, REGION_COUNT);
  assert.equal(REGION_COUNT, 62);
  const r = e.regionConditions[0];
  // THE THREE WIDTHS (:1575-1585): Values 29, Flags 29, Flags2 14.
  assert.equal(r.values.length, 29);
  assert.equal(r.flags.length, 29);
  assert.equal(r.flags2.length, 14);
  assert.ok(r.flags.every((b) => b === false), 'blank, as InitializeRegionData mints it');

  // ...and the flag half of UpdateRegionalPrices (FormulaHelper.cs
  // :2075-2087) really does execute against it now.
  e.regionPrices = new Array(REGION_COUNT).fill(PRICE_ADJUSTMENT_MIN);
  const dict = new Map();
  dict.set(510, { id: 510, type: FACTION_TYPES.Group, region: -1, power: 0 });
  dict.set(20, { id: 20, type: FACTION_TYPES.Province, region: 0, power: 100 });
  updateRegionalPrices(e, dict, 1, () => 0, e.regionConditions);
  assert.equal(conditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesLow), true,
    'a floored price adjustment lights PricesLow on a fresh character');
});

// ── F110 / F111: PERMANENT skill reads, not live ──────────────────

/** An entity whose guild skills are all `v`, wearing an EnhancesSkill
 *  item worth +15 on every one of them (the port's live-mod channel,
 *  which DFU's GetPermanentSkillValue does not see). */
function enchanted(guild, v, mod = 15) {
  const skills = {}, skillMods = {};
  for (const s of guild.skills) { skills[s] = v; skillMods[s] = mod; }
  return { name: 'Tester', skills, _enchantMods: { skillMods } };
}

test('AUDIT 26 F110: guild rank reads GetPermanentSkillValue - a worn enchantment never ranks (Guild.cs:124)', () => {
  const g = GUILDS.FightersGuild;
  // Permanent 10 is below the rank-0 HIGH bar (22) and above the LOW
  // bar (4); +15 would put every guild skill over the high bar.
  const e = enchanted(g, 10);
  assert.equal(permanentSkillValue(e, g.skills[0]), 10);
  assert.equal(skillValue(e, g.skills[0]), 25, 'the LIVE value really is enchant-lifted');
  assert.deepEqual(numHighLowSkills(e, g, 0), { high: 0, low: g.skills.length },
    'the mods are invisible to the rank walk');

  // ...and the rank the walk feeds does not move with the equipment.
  const dict = new Map();
  for (const gg of Object.values(GUILDS)) {
    dict.set(gg.factionId, { id: gg.factionId, parent: 0, rep: 0, flags: 0, power: 50,
      ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 });
  }
  const store = createFactionRep(dict);
  for (const gg of Object.values(GUILDS)) setReputation(store, gg.factionId, 50);
  assert.equal(calculateNewRank(e, g, store), -1,
    'no high skill: expelled, exactly as the permanent values earn');
  const bare = { name: 'Tester', skills: Object.fromEntries(g.skills.map((s) => [s, 10])) };
  assert.equal(calculateNewRank(e, g, store), calculateNewRank(bare, g, store),
    'equipping the item changed nothing');
});

test('AUDIT 26 F111: the training gate reads GetPermanentSkillValue (DaggerfallGuildServiceTraining.cs:101)', () => {
  const g = GUILDS.FightersGuild;
  assert.equal(trainingMax(), 50);
  const e = {
    skills: { [SKILLS.Axe]: 45 },
    _enchantMods: { skillMods: { [SKILLS.Axe]: 15 } },
  };
  assert.equal(permanentSkillValue(e, SKILLS.Axe), 45);
  assert.equal(skillValue(e, SKILLS.Axe), 60, 'the LIVE value is over the cap');
  assert.equal(tooSkilledToTrain(e, g, SKILLS.Axe), false,
    'DFU trains a permanent-45 player however much the enchantment adds');
  // the cap itself is unmoved: permanent 51 is still refused
  const high = { skills: { [SKILLS.Axe]: 51 }, _enchantMods: { skillMods: { [SKILLS.Axe]: -20 } } };
  assert.equal(tooSkilledToTrain(high, g, SKILLS.Axe), true,
    'and a DRAINING enchantment does not buy training either');
});

// ── F127: an artifact is BORN identified (DaggerfallUnityItem.cs:617) ──

test('AUDIT 26 F127: SetArtifact writes `artifactMask | identifiedMask` (:617)', () => {
  const T = (i, over = {}) => ({ index: i, name: `A${i}`, type: 1, group: 14, groupIndex: 0,
    enchantments: [{ type: 3, param: 7 }], uses: 100, value: 500, material: 0, ...over });
  const templates = Array.from({ length: 12 }, (_, i) => T(i));
  const art = createArtifact(templates, 0);
  assert.equal(art.isIdentified, true, 'DFU\'s own comment: "Set as artifact & identified."');
  assert.equal(itemIsIdentified(art), true,
    'so the derived state reads identified even though it is enchanted');
  // An unidentified enchanted item gives up its own name (ResolveItemName
  // :265-292); an identified artifact keeps it.
  assert.equal(expandItemInfo('%it', art), art.name);
  // ...which is why the trade window's Identify service never stages
  // one (DaggerfallTradeWindow.cs:823-826, `if (!item.IsIdentified)`).
  const unknown = { ...art, isIdentified: false };
  assert.equal(itemIsIdentified(unknown), false, 'the flag is what decides - the pin is not vacuous');
});

// ── F132: the daedric offer has no guild (DaggerfallQuestPopupWindow.cs:272-279) ──

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
{
  // The static-message table the parser reads; the daedra quests
  // themselves are vendored beside it (Quests/X0C00Y00.txt).
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^\ufeff/, '');
  }
  loadQuestTables(sources);
}

const DAEDRA_SRC = [
  'Quest: __DAED',
  'DisplayName: The Prince\'s Errand',
  'QRC:',
  `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`,
  '<ce> Will you serve?',
  '',
  `RefuseQuest:  [${QUEST_MESSAGES.RefuseQuest}]`,
  '<ce> Then go.',
  '',
  `AcceptQuest:  [${QUEST_MESSAGES.AcceptQuest}]`,
  '<ce> It is done.',
  '',
  'QBN:',
  'variable _done_',
];

test('AUDIT 26 F132: offerNamedQuest offers a real daedric quest - no guild to dereference (:600-622)', () => {
  const machine = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1, getReputation: () => 0 });
  const lists = new QuestListsManager({
    readListTable: () => null,
    getQuestSourceLines: (name) => (name === '__DAED' ? DAEDRA_SRC : null),
    parseQuest: (l, f, p) => machine.parseQuestForLists(l, f, { rolls: () => 0, partialParse: p }),
    rolls: () => 0,
  });
  const flow = new QuestOfferFlow(machine, lists, {});

  // The ExternalMCP assignment exists only in the GUILD popup's
  // OfferQuest (:608), where `guild` is the window's own non-null
  // field; the daedra path sets none. offerNamedQuest clears _guild,
  // so a bare `this._guild.isMember()` threw a TypeError here - after
  // the gold was spent and the Summoned flag set.
  const step = flow.offerNamedQuest('__DAED', 42);
  assert.equal(step.kind, 'offer', 'the daedric quest is actually offered');
  assert.ok(step.prompt, 'with its QuestorOffer prompt');
  assert.ok(flow.offeredQuest, 'and the drawn quest is held');
  assert.equal(flow.offeredQuest.externalMCP ?? null, null,
    'no guild rides along on the daedric offer');

  // ...and the null-quest arm is still DFU's silent close (:273-279).
  assert.deepEqual(flow.offerNamedQuest('__NOPE', 42), { kind: 'close' });
});
