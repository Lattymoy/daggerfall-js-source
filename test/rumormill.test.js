// TK-i - THE RUMOR MILL (TalkManager.cs's rumor family + the
// RUMOR.DAT reader). The reader's exact record layout over a
// synthetic fixture; TokensToString's separator law; the import
// gates with THE BULLETIN HOLE; AddNonQuestRumor's frozen variant +
// the 43140 TTL literal; GetFlagsForNewRumor's seven sign types;
// THE REFRESH CULL killing quest rumors (timeLimit 0) verbatim; the
// GetValidRumors filters (region gate, the sign/spoken flags&1
// split, the 75% faction-flag suppression, quest entries bypassing
// every common filter, the bulletin textID gate); the region ladder;
// WeightedRandomRumor's running choice; GetNewsOrRumors' one-answer
// gate with the spymaster/know-everything bypasses, both arms and
// the resolvingError quirk; the six QUEST seams with their throw
// literals and the replace-keeps-fields law; the save round-trip.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RumorFile, CLASSIC_RUMOR_TYPES } from '../src/formats/rumorFile.js';
import { TextRsc } from '../src/formats/textRsc.js';
import {
  RumorMill, RUMOR_TYPE, ALLOWED_BULLETIN_TEXT_IDS, OUT_OF_NEWS_RECORD_INDEX,
  MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS, NON_QUEST_RUMOR_TTL_MINUTES,
  DEFAULT_QUEST_RUMOR_WEIGHT, RESOLVING_ERROR, tokensToString,
} from '../src/systems/rumorMill.js';
import { readTokens, RSC, TOKEN_TEXT } from '../src/formats/textRsc.js';

const t = (text) => ({ formatting: TOKEN_TEXT, text, x: 0, y: 0 });

/** Build one synthetic RUMOR.DAT record's bytes. */
function rumorRecord({ faction1 = 0, faction2 = 0, type = 100, regionID = 0, flags = 8, questID = 0, questName = '', unknown = 0, npcID = 0, timeLimit = 0, text = 'hi' } = {}) {
  const textBytes = [...text].map((c) => c.charCodeAt(0));
  const b = new Uint8Array(2 + 2 + 4 + 1 + 1 + 1 + 9 + 2 + 4 + 4 + 4 + textBytes.length);
  const v = new DataView(b.buffer);
  let p = 0;
  v.setUint16(p, faction1, true); p += 2;
  v.setUint16(p, faction2, true); p += 2;
  v.setUint32(p, type, true); p += 4;
  b[p++] = regionID; b[p++] = flags; b[p++] = questID;
  for (let i = 0; i < Math.min(questName.length, 8); i++) b[p + i] = questName.charCodeAt(i);
  b[p + Math.min(questName.length, 8)] = 0;
  // garbage AFTER the NUL proves the cursor advances the full 9
  for (let i = questName.length + 1; i < 9; i++) b[p + i] = 0xaa;
  p += 9;
  v.setUint16(p, unknown, true); p += 2;
  v.setUint32(p, npcID, true); p += 4;
  v.setUint32(p, textBytes.length, true); p += 4;
  v.setUint32(p, timeLimit, true); p += 4;
  b.set(textBytes, p);
  return b;
}

function makeMill(over = {}) {
  const calls = [];
  const mill = new RumorMill({
    nowClassicMinutes: () => 100000,
    getFactionData: () => null,
    currentRegionIndex: () => 17,
    getRandomTokens: (id) => { calls.push(['getRandomTokens', id]); return [t(`rumor:${id}`)]; },
    expandCommonTokens: (tokens, ctx) => { calls.push(['expandCommon', ctx]); return tokens; },
    expandQuestTokens: (questID, tokens) => { calls.push(['expandQuest', questID]); return tokensToString(tokens); },
    expandRandomTextRecord: (id) => { calls.push(['expandRandom', id]); return `record:${id}`; },
    rolls: () => 0,
    ...over,
  });
  return { mill, calls };
}

const mockMessage = (variantTokens, calls = []) => ({
  variants: variantTokens.map((tokens) => ({ tokens })),
  getTextTokensByVariant(i, expand) { calls.push(['byVariant', i, expand]); return variantTokens[i].map((x) => ({ ...x })); },
  getTextTokens(variant, roll, expand) { calls.push(['getTextTokens', variant, expand]); return variantTokens[0].map((x) => ({ ...x })); },
});

// ---------------------------------------------------------------
// The RUMOR.DAT reader (RumorFile.cs:137-160)
// ---------------------------------------------------------------

test('RumorFile: the exact record layout, the 9-byte CString advance, multi-record streams', () => {
  const r1 = rumorRecord({ faction1: 41, faction2: 42, type: 11, regionID: 17, flags: 8, questID: 3, questName: 'S0000011', unknown: 7, npcID: 0, timeLimit: 999, text: 'crime wave' });
  const r2 = rumorRecord({ faction1: 1, text: 'x' });
  const joined = new Uint8Array(r1.length + r2.length);
  joined.set(r1, 0); joined.set(r2, r1.length);
  const f = new RumorFile().load(joined);
  assert.equal(f.rumors.length, 2, 'the while loop steps records to the stream end');
  const a = f.rumors[0];
  assert.equal(a.faction1, 41);
  assert.equal(a.faction2, 42);
  assert.equal(a.type, 11);
  assert.equal(a.regionID, 17);
  assert.equal(a.flags, 8);
  assert.equal(a.questID, 3);
  assert.equal(a.questName, 'S0000011', 'the CString stops at the NUL, never the 0xAA tail');
  assert.equal(a.unknown, 7);
  assert.equal(a.timeLimit, 999);
  assert.equal(String.fromCharCode(...a.rumorText), 'crime wave');
  assert.equal(f.rumors[1].faction1, 1, 'the cursor advanced the FULL 9 name bytes - record 2 aligns');
});

test('RumorFile: a NUL-less 9-char questName reads all 9 and stops there; the tail stays little-endian', () => {
  const r = rumorRecord({ questName: '', unknown: 0x0102, text: 'z' });
  // overwrite the name field with 9 printable bytes and NO NUL
  for (let i = 0; i < 9; i++) r[11 + i] = 65 + i;   // 'ABCDEFGHI'
  const f = new RumorFile().load(r);
  assert.equal(f.rumors[0].questName, 'ABCDEFGHI', 'ReadCString caps at 9, never bleeding into unknown');
  assert.equal(f.rumors[0].unknown, 258, '0x0102 read little-endian');
  assert.equal(String.fromCharCode(...f.rumors[0].rumorText), 'z');
  const g = new RumorFile().load(rumorRecord({ npcID: 0x0102, text: 'z' }));
  assert.equal(g.rumors[0].npcID, 258, 'npcID reads little-endian too');
});

test('CLASSIC_RUMOR_TYPES: RumorFile.RumorTypes verbatim', () => {
  assert.deepEqual({ ...CLASSIC_RUMOR_TYPES }, {
    Plague: 4, Famine: 7, WitchBurnings: 10, CrimeWave: 11, NewRuler: 12,
    PersecutedTemple: 18, AllianceSignMessage: 26, EnemySignMessage: 27,
    WarSignMessage: 28, FactionRumor: 100,
  });
});

// ---------------------------------------------------------------
// TextProvider.GetRandomTokens' token face (textRsc.variantTokensById)
// ---------------------------------------------------------------

test('variantTokensById: the pick law, the operand skip, and the FTD-1 step-back', () => {
  const rsc = new TextRsc();
  const bytes = (arr) => new Uint8Array(arr);
  const T = (s) => [...s].map((c) => c.charCodeAt(0));
  // three variants: 'aa' | 'bb' (with a PositionPrefix whose operand
  // is 0xFF - it must NOT split the variant) | 'cc'
  rsc.bytesById = () => bytes([...T('aa'), RSC.SubrecordSeparator, RSC.PositionPrefix, 0xff, ...T('bb'), RSC.SubrecordSeparator, ...T('cc'), RSC.EndOfRecord]);
  const text = (tokens) => tokens.filter((x) => x.formatting === TOKEN_TEXT).map((x) => x.text).join('');
  assert.equal(text(rsc.variantTokensById(1, () => 0)), 'aa', 'pick 0 takes the first variant');
  assert.equal(text(rsc.variantTokensById(1, () => 0.5)), 'bb', 'floor(0.5*3)=1 - and the 0xFF operand did not split it');
  assert.equal(text(rsc.variantTokensById(1, () => 0.999)), 'cc', 'the top pick clamps to the last variant');
  // a record ending 0xFF 0xFE mints an empty trailing variant - the
  // top pick steps BACK one (TextProvider.cs:231)
  rsc.bytesById = () => bytes([...T('aa'), RSC.SubrecordSeparator, ...T('bb'), RSC.SubrecordSeparator, RSC.EndOfRecord]);
  assert.equal(text(rsc.variantTokensById(1, () => 0.999)), 'bb', 'the empty stream steps back to the last real variant');
  // a single-variant record ignores the pick entirely
  rsc.bytesById = () => bytes([...T('solo'), RSC.EndOfRecord]);
  assert.equal(text(rsc.variantTokensById(1, () => 0.999)), 'solo');
  // bytes AFTER EndOfRecord never parse
  rsc.bytesById = () => bytes([...T('in'), RSC.EndOfRecord, ...T('out')]);
  assert.equal(text(rsc.variantTokensById(1, () => 0)), 'in');
  rsc.bytesById = () => null;
  assert.deepEqual(rsc.variantTokensById(1, () => 0), [], 'a missing record answers empty');
});

test('variantTokensById: the walk classifies EVERY byte - odd lengths, leading prefixes, two-variant records, the step-back edges', () => {
  const rsc = new TextRsc();
  const bytes = (arr) => new Uint8Array(arr);
  const T = (s) => [...s].map((c) => c.charCodeAt(0));
  const text = (tokens) => tokens.filter((x) => x.formatting === TOKEN_TEXT).map((x) => x.text).join('');
  // ODD-length variants: a walk that double-steps text bytes misses
  // the separator at an odd index and fuses the variants
  rsc.bytesById = () => bytes([...T('abc'), RSC.SubrecordSeparator, ...T('d'), RSC.EndOfRecord]);
  assert.equal(text(rsc.variantTokensById(1, () => 0.999)), 'd', 'the separator at index 3 splits - two variants, the top pick is d');
  assert.equal(text(rsc.variantTokensById(1, () => 0)), 'abc');
  // a LEADING FontPrefix whose operand is 0xFF: the operand skip must
  // fire at index 0, and the count must stay TWO
  rsc.bytesById = () => bytes([RSC.FontPrefix, 0xff, ...T('b'), RSC.SubrecordSeparator, ...T('cc'), RSC.EndOfRecord]);
  assert.equal(text(rsc.variantTokensById(1, () => 0.5)), 'cc', 'n=2: floor(0.5*2)=1 - the 0xFF operand did not mint a third variant');
  assert.equal(text(rsc.variantTokensById(1, () => 0)), 'b');
  // a plain TWO-variant record honours the pick (no n<=2 shortcut)
  rsc.bytesById = () => bytes([...T('aa'), RSC.SubrecordSeparator, ...T('bb'), RSC.EndOfRecord]);
  assert.equal(text(rsc.variantTokensById(1, () => 0.999)), 'bb');
  // a LEADING empty variant at pick 0 answers empty - the step-back
  // only fires for want > 0, never off the front
  rsc.bytesById = () => bytes([RSC.SubrecordSeparator, ...T('b'), RSC.EndOfRecord]);
  assert.deepEqual(rsc.variantTokensById(1, () => 0), [], 'want 0 never steps to ranges[-1]');
  // an empty SECOND variant of two steps back exactly one - and the
  // re-read is the EXACT previous range: one text token, no stray
  // separator/EndOfRecord tokens bleeding in from a loose slice
  rsc.bytesById = () => bytes([...T('aa'), RSC.SubrecordSeparator, RSC.EndOfRecord]);
  assert.deepEqual(rsc.variantTokensById(1, () => 0.999),
    [{ formatting: TOKEN_TEXT, text: 'aa', x: 0, y: 0 }],
    'want 1 empty steps back to variant 0, token-exact');
});

// ---------------------------------------------------------------
// TokensToString (:3561-3578)
// ---------------------------------------------------------------

test('tokensToString: text appends; an empty token appends the separator - space by default, nothing when false', () => {
  const tokens = [t('a'), { formatting: 2, text: '', x: 0, y: 0 }, t('b')];
  assert.equal(tokensToString(tokens), 'a b');
  assert.equal(tokensToString(tokens, false), 'ab');
  assert.equal(tokensToString([]), '');
  assert.equal(tokensToString(null), '');
});

// ---------------------------------------------------------------
// ImportClassicRumor (:2665-2693) + AddNonQuestRumor (:2695-2733)
// ---------------------------------------------------------------

test('importClassicRumor: the three skip gates, the carried fields, THE BULLETIN HOLE', () => {
  const { mill } = makeMill();
  const rt = (bytes) => readTokens(bytes, 0, RSC.EndOfRecord);
  mill.importClassicRumor({ flags: 4, npcID: 0, rumorText: new Uint8Array([65]) }, rt);
  mill.importClassicRumor({ flags: 1, npcID: 0, rumorText: new Uint8Array([65]) }, rt);
  mill.importClassicRumor({ flags: 8, npcID: 9, rumorText: new Uint8Array([65]) }, rt);
  assert.equal(mill.listRumorMill.length, 0, 'quest rumor, sign message, NPC-specific: none import');
  mill.importClassicRumor({ faction1: 41, faction2: 0, type: 11, regionID: 17, flags: 8, npcID: 0, timeLimit: 500000, rumorText: new Uint8Array([72, 105]) }, rt);
  assert.equal(mill.listRumorMill.length, 1);
  const e = mill.listRumorMill[0];
  assert.equal(e.rumorType, RUMOR_TYPE.CommonRumor);
  assert.equal(tokensToString(e.listRumorVariants[0]), 'Hi');
  assert.equal(e.faction1, 41);
  assert.equal(e.type, 11);
  assert.equal(e.regionID, 17);
  assert.equal(e.timeLimit, 500000);
  assert.equal(e.textID, 0, 'imports never set textID...');
  assert.equal(e.questID, 0, 'and carry no quest id - ambient weight 1 in the news draw');
  assert.equal(mill.getNewsOrRumorsForBulletinBoard(), null, '...so a board can never show one (flags 8 is spoken anyway; textID 0 fails first)');
});

test('addNonQuestRumor: ONE variant frozen at add, the 43140 TTL literal, the stamped textID', () => {
  const { mill, calls } = makeMill();
  mill.addNonQuestRumor(41, 42, -1, 100, 1400);
  assert.deepEqual(calls.filter((c) => c[0] === 'getRandomTokens'), [['getRandomTokens', 1400]], 'the variant draw happens ONCE, at add time');
  const e = mill.listRumorMill[0];
  assert.equal(e.timeLimit, 100000 + NON_QUEST_RUMOR_TTL_MINUTES);
  assert.equal(NON_QUEST_RUMOR_TTL_MINUTES, 43140, 'the literal is 43140, a hair under 30 days - not 43200');
  assert.equal(e.textID, 1400);
  assert.equal(e.flags, 8, 'type 100 is a spoken rumor');
  assert.equal(e.questID, 0);
  // a mill with NO clock seam stamps the headless zero + the TTL
  const bare = new RumorMill({ getRandomTokens: () => [t('x')] });
  bare.addNonQuestRumor(0, 0, -1, 100, 1400);
  assert.equal(bare.listRumorMill[0].timeLimit, NON_QUEST_RUMOR_TTL_MINUTES, 'the absent clock reads 0, never a phantom minute');
});

test('getFlagsForNewRumor: EXACTLY the seven sign types answer 1, everything else 8', () => {
  const { mill } = makeMill();
  for (const signType of [10, 18, 7, 4, 28, 27, 26]) assert.equal(mill.getFlagsForNewRumor(signType), 1, `type ${signType} posts`);
  for (const spoken of [100, 0, 11, 12, 25]) assert.equal(mill.getFlagsForNewRumor(spoken), 8, `type ${spoken} speaks`);
});

// ---------------------------------------------------------------
// RefreshRumorMill (:2735-2743) - THE REFRESH CULL
// ---------------------------------------------------------------

test('refreshRumorMill: expiry is timeLimit < now - and the QUEST entries (timeLimit 0) die too, verbatim', () => {
  const { mill } = makeMill();
  mill.addNonQuestRumor(0, 0, -1, 100, 1475);                       // expires at 143140
  mill.listRumorMill.push({ rumorType: RUMOR_TYPE.CommonRumor, listRumorVariants: [[t('old')]], questID: 0, timeLimit: 99999, faction1: 0, faction2: 0, regionID: -1, flags: 8, type: 100, textID: 0 });
  mill.addQuestRumorTokensToRumorMill(7n === 7n ? 7 : 7, [[t('quest rumor')]]);
  assert.equal(mill.listRumorMill.length, 3);
  mill.refreshRumorMill();
  // 99999 < 100000 gone; the quest entry's 0 < 100000 gone TOO -
  // TalkManager.cs:2742 has no type filter, and PlayerEntity's
  // regional sim calls this every few game days. DFU's quest rumors
  // are short-lived by its own hand. KEPT.
  assert.equal(mill.listRumorMill.length, 1);
  assert.equal(mill.listRumorMill[0].textID, 1475);
});

// ---------------------------------------------------------------
// GetValidRumors (:1468-1519)
// ---------------------------------------------------------------

const commonEntry = (over = {}) => ({
  rumorType: RUMOR_TYPE.CommonRumor, listRumorVariants: [[t('x')]], questID: 0,
  timeLimit: 999999, faction1: 0, faction2: 0, regionID: -1, flags: 8, type: 100, textID: 1475, ...over,
});

test('getValidRumors: the region gate, the sign/spoken split, quest entries bypass every common filter', () => {
  const { mill } = makeMill();
  mill.listRumorMill.push(
    commonEntry(),                                    // -1 region, spoken: talks
    commonEntry({ regionID: 17 }),                    // current region: talks
    commonEntry({ regionID: 3 }),                     // foreign region: never
    commonEntry({ flags: 1 }),                        // sign message: boards only
    { rumorType: RUMOR_TYPE.QuestRumorMill, listRumorVariants: [[t('q')]], questID: 9, timeLimit: 0, faction1: 0, faction2: 0, regionID: 3, flags: 1, type: 0, textID: 0 },
  );
  const talking = mill.getValidRumors();
  assert.deepEqual(talking.map((e) => e.regionID), [-1, 17, 3], 'two commons talk; the quest entry rides through its foreign region AND its sign flag');
  assert.equal(talking[2].rumorType, RUMOR_TYPE.QuestRumorMill);
  const board = mill.getValidRumors(true);
  assert.equal(board.length, 1, 'boards: only the sign-flagged common with an allowed textID');
  assert.equal(board[0].flags, 1);
});

test('getValidRumors: the 75% faction-flag suppression rolls ONLY when a flagged faction rides the entry', () => {
  let rollCount = 0;
  const { mill } = makeMill({
    getFactionData: (id) => (id === 41 ? { flags: 1, region: -1 } : { flags: 0, region: -1 }),
    rolls: () => { rollCount++; return 0; },   // floor(0*100)=0 < 75: SuccessRoll -> suppressed
  });
  mill.listRumorMill.push(commonEntry({ faction1: 41 }));
  assert.equal(mill.getValidRumors().length, 0, 'the flagged faction suppresses at a successful 75 roll');
  assert.equal(rollCount, 1);
  rollCount = 0;
  mill.listRumorMill = [commonEntry({ faction1: 0, faction2: 0, type: 100 })];
  assert.equal(mill.getValidRumors().length, 1);
  assert.equal(rollCount, 0, 'no factions and type 100: the suppression clause never rolls');
  mill.listRumorMill = [commonEntry({ faction1: 41 })];
  mill.deps.rolls = () => 0.99;   // floor(99)=99 >= 75: the roll fails, the rumor stays
  assert.equal(mill.getValidRumors().length, 1);
});

test('the suppression boundaries: faction id 1 passes the zero gate, the faction2 side rolls too, and 75 fails at its own value', () => {
  const flagged = (id) => ({ flags: id === 1 || id === 41 ? 1 : 0, region: -1 });
  // faction1 = 1 is a REAL id - the clause gate is !== 0, never !== 1
  const { mill } = makeMill({ getFactionData: flagged, rolls: () => 0 });
  mill.listRumorMill.push(commonEntry({ faction1: 1 }));
  assert.equal(mill.getValidRumors().length, 0, 'faction id 1 suppresses like any other');
  // the faction2 side is checked on its own
  const { mill: m2 } = makeMill({ getFactionData: flagged, rolls: () => 0 });
  m2.listRumorMill.push(commonEntry({ faction1: 0, faction2: 41, type: 26 }));
  assert.equal(m2.getValidRumors().length, 0, 'a flagged faction2 suppresses alone');
  // Dice100.SuccessRoll(75): floor(roll*100) < 75 - a roll landing
  // exactly ON 75 FAILS, the rumor stays
  const { mill: m3 } = makeMill({ getFactionData: flagged, rolls: () => 0.75 });
  m3.listRumorMill.push(commonEntry({ faction1: 41 }));
  assert.equal(m3.getValidRumors().length, 1, '75 >= 75: the suppression roll fails at its own boundary');
  // faction2 = 1 through the OUTER gate (the !== 0 test, never !== 1)
  // - at TYPE 100, so the type arm cannot mask the faction2 arm
  const { mill: m4 } = makeMill({ getFactionData: flagged, rolls: () => 0 });
  m4.listRumorMill.push(commonEntry({ faction1: 0, faction2: 1, type: 100 }));
  assert.equal(m4.getValidRumors().length, 0, 'faction2 id 1 enters the clause alone and suppresses');
  // faction2 alone at TYPE 100 - the clause is a three-way OR, so a
  // lone faction2 enters whatever the type
  const { mill: m5 } = makeMill({ getFactionData: flagged, rolls: () => 0 });
  m5.listRumorMill.push(commonEntry({ faction1: 0, faction2: 41, type: 100 }));
  assert.equal(m5.getValidRumors().length, 0, 'faction2 at type 100 still suppresses (each OR arm stands alone)');
});

test('the bulletin textID gate matches the allowed ids exactly', () => {
  assert.deepEqual([...ALLOWED_BULLETIN_TEXT_IDS], [1475, 1476, 1477, 1478, 1479, 1482, 1483]);
  const { mill } = makeMill();
  mill.listRumorMill.push(commonEntry({ flags: 1, textID: 1474 }), commonEntry({ flags: 1, textID: 1483 }));
  const board = mill.getValidRumors(true);
  assert.equal(board.length, 1);
  assert.equal(board[0].textID, 1483);
});

// ---------------------------------------------------------------
// The region ladder + the news faces (:1355-1440)
// ---------------------------------------------------------------

test('the region ladder: entry region, else faction1 region, else faction2, else current', () => {
  const { mill, calls } = makeMill({
    getFactionData: (id) => ({ 41: { flags: 0, region: 5 }, 42: { flags: 0, region: 9 }, 43: { flags: 0, region: -1 } })[id] ?? null,
  });
  // the ladder itself (the valid-rumor region GATE means an entry
  // with a foreign regionID can only reach the ladder in its own
  // region - probing the arms directly keeps them distinguishable)
  assert.equal(mill._resolveRegionID({ regionID: 12, faction1: 41, faction2: 42 }), 12, 'the entry region wins over both factions');
  assert.equal(mill._resolveRegionID({ regionID: -1, faction1: 41, faction2: 42 }), 5, 'faction1 next');
  assert.equal(mill._resolveRegionID({ regionID: -1, faction1: 43, faction2: 42 }), 9, 'a -1 faction1 region falls to faction2');
  assert.equal(mill._resolveRegionID({ regionID: -1, faction1: 0, faction2: 0 }), 17, 'nothing resolves: the CURRENT region (DFU dropped classic random)');
  assert.equal(mill._resolveRegionID({ regionID: -1, faction1: 43, faction2: 43 }), 17, 'BOTH factions at region -1 fall through to current, never returning the -1');
  // ...and the bulletin face threads the resolved region into the
  // macro context
  mill.listRumorMill = [commonEntry({ flags: 1, regionID: -1, faction1: 41 })];
  mill.getNewsOrRumorsForBulletinBoard();
  assert.deepEqual(calls.filter((c) => c[0] === 'expandCommon').at(-1)[1], { faction1: 41, faction2: 0, regionID: 5 });
});

test('the bulletin face answers the FIRST valid CommonRumor as TOKENS; empty answers null', () => {
  const { mill } = makeMill();
  assert.equal(mill.getNewsOrRumorsForBulletinBoard(), null);
  mill.listRumorMill.push(commonEntry({ flags: 1, textID: 1475, listRumorVariants: [[t('first')]] }), commonEntry({ flags: 1, textID: 1476, listRumorVariants: [[t('second')]] }));
  assert.equal(tokensToString(mill.getNewsOrRumorsForBulletinBoard()), 'first', 'FirstOrDefault, never the weighted draw');
});

test('getNewsOrRumors: the one-answer gate, the bypasses, and the 1457 out-of-news face', () => {
  const { mill, calls } = makeMill();
  const session = { numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false };
  assert.equal(mill.getNewsOrRumors(session), 'record:1457', 'an empty mill is out of news');
  assert.equal(OUT_OF_NEWS_RECORD_INDEX, 1457);
  assert.equal(session.numAnswersGivenTellMeAboutOrRumors, 0, 'out-of-news through the empty mill spends nothing');
  mill.listRumorMill.push(commonEntry({ listRumorVariants: [[t('word'), { formatting: 2, text: '', x: 0, y: 0 }, t('up')]] }));
  assert.equal(mill.getNewsOrRumors(session), 'wordup', 'the common arm strings WITHOUT the separator (TokensToString(tokens, false))');
  assert.equal(session.numAnswersGivenTellMeAboutOrRumors, 1);
  assert.equal(mill.getNewsOrRumors(session), 'record:1457', 'the second ask hits the one-answer gate');
  assert.equal(MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS, 1);
  assert.equal(mill.getNewsOrRumors({ numAnswersGivenTellMeAboutOrRumors: 5, isSpyMaster: true }), 'wordup', 'the spymaster never runs dry');
  const { mill: mill2 } = makeMill({ npcsKnowEverything: () => true });
  mill2.listRumorMill.push(commonEntry());
  assert.equal(mill2.getNewsOrRumors({ numAnswersGivenTellMeAboutOrRumors: 5 }), 'x', 'the debug setting bypasses too');
  void calls;
});

test('getNewsOrRumors: the quest arm expands through the quest seam at a rolled variant; null variants answer resolvingError AND spend the answer', () => {
  const { mill, calls } = makeMill({ rolls: () => 0.5 });
  mill.addQuestRumorTokensToRumorMill(77, [[t('v0')], [t('v1')], [t('v2')], [t('v3')]]);
  const session = { numAnswersGivenTellMeAboutOrRumors: 0 };
  assert.equal(mill.getNewsOrRumors(session), 'v2', 'Range(0,4) at 0.5 picks variant 2');
  assert.deepEqual(calls.filter((c) => c[0] === 'expandQuest'), [['expandQuest', 77]]);
  const { mill: m3 } = makeMill();
  m3.listRumorMill.push(commonEntry({ listRumorVariants: null }));
  const s3 = { numAnswersGivenTellMeAboutOrRumors: 0 };
  assert.equal(m3.getNewsOrRumors(s3), RESOLVING_ERROR, "'...never mind...' - the C# init literal surfaces");
  assert.equal(s3.numAnswersGivenTellMeAboutOrRumors, 1, 'and the NPC still spent its one answer (kept quirk)');
  // a PROGRESS rumor draws through the same quest arm (the :1423 OR)
  const { mill: m4, calls: c4 } = makeMill();
  m4.addOrReplaceQuestProgressRumor(88, mockMessage([[t('going well')]]));
  assert.equal(m4.getNewsOrRumors({ numAnswersGivenTellMeAboutOrRumors: 0 }), 'going well');
  assert.deepEqual(c4.filter((c) => c[0] === 'expandQuest'), [['expandQuest', 88]], 'QuestProgressRumor rides the quest expansion too');
});

test('the variant pick FLOORS (Random.Range int law) and the bare default session is fresh', () => {
  const { mill } = makeMill({ rolls: () => 0.4 });
  mill.addQuestRumorTokensToRumorMill(77, [[t('v0')], [t('v1')], [t('v2')], [t('v3')]]);
  const session = { numAnswersGivenTellMeAboutOrRumors: 0 };
  assert.equal(mill.getNewsOrRumors(session), 'v1', 'floor(0.4*4)=1, never round');
  // the parameterless call carries C#'s fresh npcData shape: zero
  // answers given, not a spymaster - the gate passes
  assert.equal(mill.getNewsOrRumors(), 'v1', 'the default session answers, never out-of-news');
});

test('the bulletin face refuses a null-variant sign entry with the C# && guard, never a throw', () => {
  const { mill } = makeMill();
  mill.listRumorMill.push(commonEntry({ flags: 1, textID: 1475, listRumorVariants: null }));
  assert.equal(mill.getNewsOrRumorsForBulletinBoard(), null);
});

test('the three quest creators stamp the EXACT zero-filled envelope shape (the save-file law)', () => {
  const { mill } = makeMill();
  mill.addQuestRumorTokensToRumorMill(5, [[t('a')]]);
  assert.deepEqual(mill.listRumorMill[0], {
    rumorType: RUMOR_TYPE.QuestRumorMill, questID: 5, listRumorVariants: [[t('a')]],
    timeLimit: 0, faction1: 0, faction2: 0, regionID: 0, flags: 0, type: 0, textID: 0,
  });
  mill.addQuestRumorToRumorMill(6, mockMessage([[t('b')]]));
  assert.deepEqual(mill.listRumorMill[1], {
    rumorType: RUMOR_TYPE.QuestRumorMill, questID: 6, listRumorVariants: [[t('b')]],
    timeLimit: 0, faction1: 0, faction2: 0, regionID: 0, flags: 0, type: 0, textID: 0,
  });
  mill.addOrReplaceQuestProgressRumor(7, mockMessage([[t('c')]]));
  assert.deepEqual(mill.listRumorMill[2], {
    rumorType: RUMOR_TYPE.QuestProgressRumor, questID: 7, listRumorVariants: [[t('c')]],
    timeLimit: 0, faction1: 0, faction2: 0, regionID: 0, flags: 0, type: 0, textID: 0,
  });
});

test('weightedRandomRumor: the running choice - rolls at 0 keep the first, rolls at the top take the last; quest weight defaults 50', () => {
  const entries = [commonEntry(), { ...commonEntry(), questID: 9 }, commonEntry()];
  const { mill } = makeMill({ rolls: () => 0 });
  assert.equal(mill.weightedRandomRumor(entries), entries[0], 'r=0 >= 0 selects the first, then never again');
  const { mill: hi } = makeMill({ rolls: () => 0.999999 });
  assert.equal(hi.weightedRandomRumor(entries), entries[2], 'a top roll re-selects at every step - the LAST wins');
  assert.equal(DEFAULT_QUEST_RUMOR_WEIGHT, 50);
  const ranges = [];
  const { mill: cap } = makeMill({ rolls: () => 0 });
  cap._range = (n) => { ranges.push(n); return 0; };
  cap.weightedRandomRumor(entries);
  assert.deepEqual(ranges, [1, 51, 52], 'the ranges walk total+weight: 0+1, 1+50 (the quest entry), 51+1');
});

// ---------------------------------------------------------------
// The quest seams (:1558-1690)
// ---------------------------------------------------------------

test('addQuestRumorToRumorMill: the null throw literal; every variant lands UNEXPANDED', () => {
  const { mill } = makeMill();
  assert.throws(() => mill.addQuestRumorToRumorMill(1, null), { message: 'AddQuestRumorToRumorMill(): Message cannot be null.' });
  const calls = [];
  mill.addQuestRumorToRumorMill(5, mockMessage([[t('a')], [t('b')]], calls));
  assert.deepEqual(calls, [['byVariant', 0, false], ['byVariant', 1, false]], 'GetTextTokensByVariant(i, false) - macros stay raw in the mill');
  const e = mill.listRumorMill[0];
  assert.equal(e.rumorType, RUMOR_TYPE.QuestRumorMill);
  assert.equal(e.questID, 5);
  assert.equal(e.listRumorVariants.length, 2);
});

test('the token-list overload: an EMPTY list adds nothing, silently', () => {
  const { mill } = makeMill();
  mill.addQuestRumorTokensToRumorMill(5, []);
  assert.equal(mill.listRumorMill.length, 0);
  mill.addQuestRumorTokensToRumorMill(5, [[t('x')]]);
  assert.equal(mill.listRumorMill.length, 1);
});

test('addOrReplaceQuestProgressRumor: the FIRST matching entry swaps ONLY its variants; none appends', () => {
  const { mill } = makeMill();
  assert.throws(() => mill.addOrReplaceQuestProgressRumor(1, null), { message: 'AddOrReplaceQuestProgressRumor(): Message cannot be null.' });
  mill.addOrReplaceQuestProgressRumor(5, mockMessage([[t('one')]]));
  assert.equal(mill.listRumorMill.length, 1);
  assert.equal(mill.listRumorMill[0].rumorType, RUMOR_TYPE.QuestProgressRumor);
  // plant a marker on the standing entry, and a SECOND progress entry
  // for the same quest behind it
  mill.listRumorMill[0].faction1 = 7;
  mill.listRumorMill.push({ ...mill.listRumorMill[0], faction1: 8, listRumorVariants: [[t('shadow')]] });
  mill.addOrReplaceQuestProgressRumor(5, mockMessage([[t('two')]]));
  assert.equal(mill.listRumorMill.length, 2, 'replace, not append');
  assert.equal(tokensToString(mill.listRumorMill[0].listRumorVariants[0]), 'two', 'the FIRST match swapped');
  assert.equal(mill.listRumorMill[0].faction1, 7, 'and kept its other fields (:1628-1632 swaps variants alone)');
  assert.equal(tokensToString(mill.listRumorMill[1].listRumorVariants[0]), 'shadow', 'the second untouched');
});

test('the remove sweeps filter on type AND quest id', () => {
  const { mill } = makeMill();
  mill.addQuestRumorTokensToRumorMill(5, [[t('a')]]);
  mill.addQuestRumorTokensToRumorMill(6, [[t('b')]]);
  mill.addOrReplaceQuestProgressRumor(5, mockMessage([[t('c')]]));
  mill.listRumorMill.push(commonEntry());
  mill.removeQuestRumorsFromRumorMill(5);
  assert.deepEqual(mill.listRumorMill.map((e) => [e.rumorType, e.questID]),
    [[RUMOR_TYPE.QuestRumorMill, 6], [RUMOR_TYPE.QuestProgressRumor, 5], [RUMOR_TYPE.CommonRumor, 0]],
    'quest 5 QuestRumorMill entries alone left');
  mill.removeQuestProgressRumorsFromRumorMill(5);
  assert.equal(mill.listRumorMill.length, 2);
});

test('the questor-post slot: variant 0 unexpanded, one per quest, last write wins', () => {
  const { mill } = makeMill();
  assert.throws(() => mill.addQuestorPostQuestMessage(1, null), { message: 'AddQuestorPostQuestMessage(): Message cannot be null.' });
  const calls = [];
  mill.addQuestorPostQuestMessage(5, mockMessage([[t('done')]], calls));
  assert.equal(calls[0][0], 'getTextTokens');
  assert.equal(calls[0][1], 0, 'variant 0');
  assert.equal(calls[0][2], false, 'unexpanded');
  assert.equal(tokensToString(mill.getQuestorPostQuestMessage(5)), 'done');
  mill.addQuestorPostQuestMessage(5, mockMessage([[t('redone')]]));
  assert.equal(tokensToString(mill.getQuestorPostQuestMessage(5)), 'redone');
  mill.removeQuestorPostQuestMessage(5);
  assert.equal(mill.getQuestorPostQuestMessage(5), null);
  assert.doesNotThrow(() => mill.removeQuestorPostQuestMessage(5), 'removing an absent slot is a no-op');
});

// ---------------------------------------------------------------
// The save halves
// ---------------------------------------------------------------

test('the SaveDataConversation halves round-trip as a fixed point, deep-copied', () => {
  const { mill } = makeMill();
  mill.addNonQuestRumor(41, 0, -1, 100, 1400);
  mill.addQuestRumorTokensToRumorMill(5, [[t('q')]]);
  mill.addQuestorPostQuestMessage(5, mockMessage([[t('post')]]));
  const snap = mill.getSaveData();
  const { mill: fresh } = makeMill();
  fresh.restoreSaveData(structuredClone(snap));
  assert.deepEqual(fresh.getSaveData(), snap, 'restore(save) is a fixed point');
  fresh.listRumorMill[0].faction1 = 999;
  assert.equal(mill.listRumorMill[0].faction1, 41, 'the copies are detached');
  const { mill: noop } = makeMill();
  noop.restoreSaveData(null);
  assert.equal(noop.listRumorMill.length, 0, 'restore(null) is a no-op');
});
