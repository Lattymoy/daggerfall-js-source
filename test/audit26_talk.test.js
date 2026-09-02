// AUDIT 26 - the talk/reaction cluster (F016, F020, F042/F096, F043,
// F046/F047, F048, F097).
//
// F016: a static NPC's name bank is the CURRENT REGION's, never the
//       race's - DFU has no race->bank path at all.
// F020: IsChildNPCData - the texture pair or faction 514.
// F042/F096: the reaction adds questionTypeReactionMods[classic index].
// F043: the reaction roll is seeded from the PARTNER, static or mobile.
// F046/F047: GetRandomText POOLS a record's Text tokens.
// F048: the steal distance test is nested INSIDE the attempt gate.
// F097: potentialQuestorGender is copied only on a Work question.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  staticNpcName, staticNpcData, isChildNPCData, isChildNPCTexture, CHILDREN_FACTION_ID,
} from '../src/characters/staticNpc.js';
import { getNameBankOfRegion } from '../src/characters/nameHelper.js';
import { RACES } from '../src/systems/races.js';
import { getClassicQuestionIndex } from '../src/systems/answerPipeline.js';
import { QUESTION_TYPE } from '../src/systems/topicTree.js';
import { QUESTION_TYPE_REACTION_MODS } from '../src/systems/talkTopics.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F016 ──────────────────────────────────────────────────────────

test('F016: the static NPC name bank is the REGION\'s, and the race path is gone', () => {
  const mk = (race) => {
    const d = staticNpcData({ x: 1, y: 2, z: 3, position: 10, buildingKey: 1, locationIndex: 1, factionId: 0 });
    d.race = race;
    return d;
  };
  // Same seed + same region bank = same name, whatever the race.
  const bank = getNameBankOfRegion(17);
  assert.equal(staticNpcName(mk(RACES.Nord), { nameBank: bank }),
    staticNpcName(mk(RACES.Redguard), { nameBank: bank }),
    'the race does not enter GetDisplayName at all');
  // the fallback is GetNameBankOfCurrentRegion's own (Breton), not a race guess
  assert.equal(staticNpcName(mk(RACES.Nord)), staticNpcName(mk(RACES.Nord), { nameBank: getNameBankOfRegion(-1) }));
  // and the invented helper is gone from the module
  const sn = src('characters/staticNpc.js');
  assert.equal(sn.includes('export const bankForRace'), false, 'bankForRace went with the default that invented it');
  // both host call sites pass the region's bank
  const wm = src('scenes/worldModes.js');
  assert.equal((wm.match(/nameBank: currentNameBank\(\)/g) ?? []).length, 2, 'both static-NPC name sites');
  assert.ok(wm.includes('const currentNameBank = () => getNameBankOfRegion('), 'GetNameBankOfCurrentRegion');
});

// ── F020 ──────────────────────────────────────────────────────────

test('F020: IsChildNPCData - the texture pairs and faction 514', () => {
  assert.equal(CHILDREN_FACTION_ID, 514);
  // TextureReader.IsChildNPCTexture (:1076-1137) - a spot check of
  // every archive, with a NEAR MISS in each so the record sets matter.
  // the WHOLE table, record by record - a spot check let a dropped
  // entry through the first time this was pinned.
  const TABLE = {
    181: [3],
    182: [4, 5, 6, 18, 36, 37, 38, 42, 43, 52, 53],
    184: [15],
    186: [4, 5, 6, 7, 19, 37, 38, 39, 43, 44, 53, 54],
    197: [3],
    334: [2, 3, 6, 9, 12],
    346: [2, 3, 12, 15, 16, 18],
    357: [5, 6, 7, 8],
  };
  for (const [archive, records] of Object.entries(TABLE)) {
    const a = Number(archive);
    for (const r of records) assert.equal(isChildNPCTexture(a, r), true, `archive ${a} record ${r} is a child`);
    // and every OTHER record in a plausible range is not
    for (let r = 0; r <= 60; r++) {
      if (records.includes(r)) continue;
      assert.equal(isChildNPCTexture(a, r), false, `archive ${a} record ${r} is NOT`);
    }
  }
  assert.equal(isChildNPCTexture(999, 3), false, 'an archive with no children at all');
  // the data-level predicate ORs the faction in
  assert.equal(isChildNPCData({ billboardArchiveIndex: 182, billboardRecordIndex: 36, factionID: 0 }), true);
  assert.equal(isChildNPCData({ billboardArchiveIndex: 0, billboardRecordIndex: 0, factionID: 514 }), true);
  assert.equal(isChildNPCData({ billboardArchiveIndex: 0, billboardRecordIndex: 0, factionID: 0 }), false);
  assert.equal(isChildNPCData(null), false);
});

test('F020: the questor doors ask the predicate, not a flag nobody writes', () => {
  const wm = src('scenes/worldModes.js');
  assert.equal((wm.match(/isChildNPC: isChildNPCData\(npcData\)/g) ?? []).length, 2, 'both talk-to-static paths');
  assert.equal(wm.includes('isChildNPC: !!pn.isChildNPC'), false, 'the unwritten flag is gone');
});

// ── F042 / F096 ───────────────────────────────────────────────────

test('F042: the reaction takes the QUESTION TYPE\'s modifier', () => {
  // questionTypeReactionMods (TalkManager.cs:96) + GetClassicQuestionIndex
  // (:691-724): +5 only for index 0 and 4.
  assert.deepEqual([...QUESTION_TYPE_REACTION_MODS], [5, 0, 0, 0, 5, 0, 0, 0]);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.LocalBuilding), 0);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Regional), 0);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Person), 1);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Work), 3);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.QuestLocation), 4);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.OrganizationInfo), 4);
  // ...so a Work question takes 0, not the +5 the port used to give
  // every question by hardcoding index 0.
  assert.equal(QUESTION_TYPE_REACTION_MODS[getClassicQuestionIndex(QUESTION_TYPE.Work)], 0);
  assert.equal(QUESTION_TYPE_REACTION_MODS[getClassicQuestionIndex(QUESTION_TYPE.LocalBuilding)], 5);
  const tt = src('scenes/townTalk.js');
  assert.ok(tt.includes('questionIndex: getClassicQuestionIndex(questionType), toneIndex: tone,'),
    'computeTier feeds the real index');
  assert.equal(tt.includes('void questionType;'), false, 'the type is no longer thrown away');
});

// ── F043 ──────────────────────────────────────────────────────────

test('F043: the reaction seed comes from the CURRENT partner, both paths', () => {
  // DFRandom.Seed = lastTargetStaticNPC/MobileNPC.GetHashCode()
  // (:669-673). openTalkWindow is the one door both paths use, and
  // both already hand it the seed.
  const tt = src('scenes/townTalk.js');
  assert.ok(tt.includes('_talkSeed = npcSeed;'), 'the door latches whoever we are talking to');
  assert.ok(tt.includes('npcSeed: _talkSeed,'), 'and computeTier reads it');
  assert.equal(tt.includes('npcSeed: _talkNpc?._talkSeed ?? 0,\n      socialGroup'), false,
    'no longer only the mobile path\'s NPC');
  // the static host passes a per-NPC seed into that door
  const wm = src('scenes/worldModes.js');
  assert.equal((wm.match(/openTalkWindow\([^)]*npcSeed: npcData\.nameSeed/g) ?? []).length, 2,
    'both static paths seed from their own NPC');
});

// ── F046 / F047 ───────────────────────────────────────────────────

test('F046/F047: the three pooled-token sites use GetRandomText, not a variant pick', () => {
  const tt = src('scenes/townTalk.js');
  const picker = tt.slice(tt.indexOf('const randomPooledText = (id, fallback) =>'));
  assert.ok(picker.length > 0, 'the pooled picker exists');
  // the BODY, not just any occurrence - the module also exports a
  // `randomText` that calls the same function, and a loose needle let
  // the picker be swapped for a variant pick undetected.
  assert.ok(picker.slice(0, 200).includes('const t = textRsc?.randomTextById(id, rolls);'),
    'and it is TextProvider.GetRandomText, pooling the record\'s tokens');
  assert.equal(picker.slice(0, 200).includes('plainText('), false, 'not the subrecord picker');
  // the pickpocket line (8999) and BOTH %oth expansions
  assert.ok(tt.includes('randomPooledText(FOUND_NOTHING_VALUABLE_TEXT_ID'), 'PlayerActivate.cs:1645');
  // RP1 made the race a LIVE read (npcRaceNow()) where it was a boot
  // constant, so the pin anchors on the pooled picker and the oath id
  // - the law - rather than on how the race is spelled at the call.
  assert.equal((tt.match(/randomPooledText\(oathTextId\(.*?\), ''\)/g) ?? []).length, 2,
    'both %oth sites - TalkManagerMCP.Oath :133-143');
  // and randomVariant SURVIVES for the records that really are
  // variant-picked (the greeting/question ladders) - this is not a
  // blanket swap.
  assert.ok(tt.includes("randomVariant(7225 + tone,"), 'the question ladder still picks a variant');
});

// ── F048 ──────────────────────────────────────────────────────────

test('F048: an already-pickpocketed NPC is SILENT at any range', () => {
  // ActivateMobileNPC nests the distance test inside
  // `if (!mobileNpc.PickpocketByPlayerAttempted)` (:785-795).
  const tt = src('scenes/townTalk.js');
  assert.ok(tt.includes("!best.person?.pickpocketAttempted\n        && bestDist > PICKPOCKET_DISTANCE"),
    'the pre-gate asks the attempt flag FIRST');
  // and the inner arm too: the flag is tested before the range
  const arm = tt.slice(tt.indexOf("if (getInteractionMode() === 'steal') {"));
  const attempted = arm.indexOf('if (target.person.pickpocketAttempted) return;');
  const far = arm.indexOf("if (dist > PICKPOCKET_DISTANCE)");
  assert.ok(attempted > -1 && far > -1 && attempted < far, 'attempted, THEN distance - DFU\'s nesting');
});

// ── F097 ──────────────────────────────────────────────────────────

test('F097: the questor gender is read only on a Work question', () => {
  // GetMacroDataSource copies potentialQuestorGender only when the
  // question is Work AND HasNPCsWithWork (TalkManagerMCP.cs:32-36);
  // otherwise the enum default (Male) stands, so %g in a non-Work
  // record says "he".
  const w = src('scenes/world.js');
  const arm = w.slice(w.indexOf('questorGender: () => {'));
  assert.ok(arm.slice(0, 400).includes('q?.questionType !== QUESTION_TYPE.Work || !npcSession.workAvailable'),
    'both halves of the gate');
  assert.ok(arm.slice(0, 400).includes('return null;'), 'and a refusal falls to the male branch');
  // the macro's own male default is what null lands on
  const tm = src('systems/talkMacros.js');
  // E7 moved the shared read into one helper - the four pronoun
  // overrides all fork on it - but the law is unchanged: only
  // 'female' takes the female arm, and C#'s `default:` shares Male.
  assert.ok(tm.includes("const female = () => ctx.questorGender?.() === 'female';"),
    'the questor-gender read is one helper');
  assert.ok(tm.includes("pronoun() { return text(female() ? 'pronounShe' : 'pronounHe'); }"),
    'anything but female is the male pronoun');
});
