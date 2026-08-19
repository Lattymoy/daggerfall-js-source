// AUDIT 18, systems-social lane. Pins for the six parity gaps found
// in the talk seam, the court flow and the player snapshot. Every
// assertion is against a DFU literal (TalkManager.cs /
// TalkManagerMCP.cs / MacroHelper.cs / MobilePersonNPC.cs /
// DaggerfallCourtWindow.cs / SerializablePlayer.cs) or against the
// real TEXT.RSC record the code draws, never a spot check of what the
// port happens to produce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TextRsc } from '../src/formats/textRsc.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { srand } from '../src/formats/dfRandom.js';
import { expandAnswerRecord, expandMacros, oathTextId } from '../src/systems/talkSession.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { createArrestFlow, RELEASE_MINUTES } from '../src/scenes/arrestFlow.js';
import { worldMinutes, setWorldMinutes, advanceWorldMinutes, MINUTES_PER_DAY } from '../src/systems/worldTick.js';
import { preloadTalkArt } from '../src/ui/nativeTalk.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { TownPopulation } from '../src/systems/townPopulation.js';
import { GENDERS, fullName, BANK_TYPES } from '../src/characters/nameHelper.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { legalRepOf, CRIMES, TEXT_FOUND_GUILTY } from '../src/systems/court.js';

const ARENA2 = process.env.ARENA2_PATH;
const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// ---------------------------------------------------------------
// A live townTalk over the REAL TEXT.RSC/FACTION.TXT, the real
// TALK01I0 panel art and a one-tavern synthetic directory. The talk
// session hooks (question/answer/npcName) are the seam DFU's
// DaggerfallTalkWindow drives, so the pins read them directly.
// ---------------------------------------------------------------
async function liveTalk({ regionIndex = 17, reactionMod = 0, rollsRef } = {}) {
  const fetchBytes = async (n) => {
    if (n === 'FONT0003.FNT') throw new Error('headless: no font');
    return bytes(n);
  };
  const renderer = { uploadTexture: () => ({}) };
  const palette = new DFPalette();
  palette.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  await preloadTalkArt({ renderer, fetchBytes, palette });
  const bd = { buildingType: BUILDING_TYPES.Tavern, nameSeed: 1234, factionId: 0, sector: 0, locationId: 0, quality: 10 };
  const dfBlock = { rmbBlock: { fldHeader: { buildingDataList: [{ ...bd }], otherNames: null }, subRecords: [{}] } };
  const blocks = [{ dfBlock, originX: 0, originZ: 0, x: 0, y: 0 }];
  const topics = {
    exteriorBuildings: [{ ...bd }],
    blocks,
    doors: [{ dfBlock, recordIndex: 0, position: [10, 0, 10] }],
    locationName: 'Daggerfall', regionName: 'Daggerfall', regionIndex,
    playerPos: () => [0, 0, 0],
  };
  const playerEntity = {
    name: 'Mack Cothran', stats: { personality: 50 }, skills: 30, skillUses: [],
    biographyReactionMod: reactionMod,
  };
  const tt = createTownTalk({
    renderer, canvas: { width: 640, height: 400 }, fetchBytes,
    playerEntity, regionIndex, topics, palette, rolls: () => rollsRef.r,
  });
  await tt.ensureLoaded();
  return { tt, playerEntity };
}

/** Push the talk window onto one townsperson; returns the session
 *  hooks (DaggerfallTalkWindow.OnPush -> SetStartConversation). */
async function talkTo(tt, person) {
  tt.tryActivate([0, 1, 0], [0, 0, 1], [{ person, pos: [0, 0, 5] }]);
  await new Promise((res) => setTimeout(res, 0));
  return tt._debug().hooks;
}
const sayGoodbye = (tt) => tt.keydown({ code: 'Escape', preventDefault() {} });

// ---------------------------------------------------------------
// F1 - the Where-is ANSWER record. TalkManager.ExpandRandomTextRecord
// (TalkManager.cs:3580-3587) runs MacroHelper.ExpandMacros over EVERY
// answer record, so %oth (MacroHelper.cs:150 -> TalkManagerMCP.cs:133
// Oath = TEXT.RSC 201 + the NPC's faction race) and %cn
// (MacroHelper.cs:566 CityName) resolve there. The port expanded
// neither: 7251 variant 13 printed a bare leading comma and variant
// 10 printed the literal "%cn".
// ---------------------------------------------------------------
test('audit18 social F1: the Where-is answer expands %oth and %cn', async (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  const rsc = new TextRsc().load(bytes('TEXT.RSC'));

  // The two commoner doesn't-know records really carry them.
  const r7251 = rsc.plainText(7251);
  assert.equal(r7251.length, 20);
  assert.equal(r7251[13], '%oth, as if I know. Ask someone else.');
  assert.equal(r7251[10], "I'm new to %cn too. Now, please excuse me.");
  assert.equal(rsc.plainText(7281)[4],
    '%oth. Such a simple question, and me not knowin\'. I begs yer forgiveness %hnr.');

  // Breton NPCs take oath record 204 (DFU's faction-race fix; classic
  // used the region race index and gave High Rock Nord oaths).
  assert.equal(oathTextId('Breton'), 204);
  assert.equal(oathTextId('Redguard'), 203);
  const bretonOaths = rsc.plainText(204);
  assert.equal(bretonOaths[9], 'By the ArchDruid');

  // The pure record chain: the oath TEXT lands, not an empty string.
  assert.equal(
    expandAnswerRecord(r7251[13], { oath: 'By the ArchDruid' }),
    'By the ArchDruid, as if I know. Ask someone else.');
  assert.equal(
    expandAnswerRecord(r7251[10], { cityName: 'Daggerfall' }),
    "I'm new to Daggerfall too. Now, please excuse me.");
  // %cn rides the greeting/question chain too (same MacroHelper pass).
  assert.equal(expandMacros('%pcf of %cn', { playerName: 'Mack Cothran', cityName: 'Daggerfall' }),
    'Mack of Daggerfall');

  // ...and the LIVE seam produces them. Sweep the roll that picks the
  // NPC seed and the roll that picks the record variant; collect every
  // distinct Where-is answer the session can emit in Daggerfall.
  const rollsRef = { r: 0.5 };
  const { tt } = await liveTalk({ rollsRef });
  const building = tt.directory[0];
  assert.equal(building.name, 'The Unfortunate Priest');
  const answers = new Set();
  for (let a = 0; a < 40; a++) {
    rollsRef.r = a / 40;
    const hooks = await talkTo(tt, { pos: [0, 0, 5] });
    for (let b = 0; b < 40; b++) {
      rollsRef.r = b / 40;
      answers.add(hooks.answer(building));
    }
    sayGoodbye(tt);
  }
  assert.ok(answers.has('By the ArchDruid, as if I know. Ask someone else.'),
    '%oth must expand to the drawn 204 oath, not to nothing');
  assert.ok(answers.has("I'm new to Daggerfall too. Now, please excuse me."),
    '%cn must expand to the current location name');
  for (const line of answers) {
    assert.ok(!/%oth|%cn\b|%pcf|%pcn|%key|%hnt/.test(line), `raw macro on screen: ${line}`);
  }
});

// ---------------------------------------------------------------
// F4 - StartNewConversation (TalkManager.cs:867-871) zeroes
// numQuestionsAsked, and DaggerfallTalkWindow.OnPush runs it through
// SetStartConversation (:654) on EVERY push. The port's counter only
// ever climbed, so GetPCGreetingOrFollowUpText (:1149-1156) took the
// greeting arm (7215 + tone) at most once per play session.
// ---------------------------------------------------------------
test('audit18 social F4: every conversation opens on the greeting, not the follow-up', async (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  const rsc = new TextRsc().load(bytes('TEXT.RSC'));
  // tone 1 (Normal) -> greeting 7216, follow-up 7219; rolls 0.5 picks
  // index floor(0.5 * count).
  assert.equal(rsc.plainText(7216)[3], 'How do you do, %n');
  assert.equal(rsc.plainText(7219)[2], 'Really');
  assert.equal(rsc.plainText(7222)[1], 'mate');       // %n at reaction <= 0 (7221 + tone)
  assert.equal(rsc.plainText(7226)[2], '%1com. Do you know where %key is?');

  const rollsRef = { r: 0.5 };
  const { tt } = await liveTalk({ rollsRef });
  const building = tt.directory[0];
  const GREET = 'How do you do, mate. Do you know where The Unfortunate Priest is?';
  const FOLLOW = 'Really. Do you know where The Unfortunate Priest is?';

  const first = await talkTo(tt, { pos: [0, 0, 5] });
  assert.equal(first.question(building), GREET);
  assert.equal(first.question(building), FOLLOW, 'the second question in ONE conversation follows up');
  sayGoodbye(tt);

  const second = await talkTo(tt, { pos: [0, 0, 5] });
  assert.equal(second.question(building), GREET, 'a NEW conversation opens on the greeting again');
  sayGoodbye(tt);

  const third = await talkTo(tt, { pos: [0, 0, 5] });
  assert.equal(third.question(building), GREET);
  sayGoodbye(tt);
});

// ---------------------------------------------------------------
// F5 - MobilePersonNPC.SetPerson (:194-217) mints every walker a name
// (`nameNPC = FullName(nameBankType, gender)`), TalkManager.cs:820
// copies it into nameNPC and DaggerfallTalkWindow.UpdateNameNPC
// (:386-392) draws it. GetPCGreetingText (:1133-1141) also puts it in
// greetingNameNPC when reactionToPlayer > 0, which %n resolves through
// TalkManagerMCP.cs:51-58. The port minted no name at all and used the
// People-of-region FACTION record ("People of Daggerfall") for both.
// ---------------------------------------------------------------
test('audit18 social F5: the townsperson carries their own minted name', async (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  // RandomiseNPC's own rolls ride the Unity-Random substitute; the
  // name parts ride DFRandom (NameHelper), exactly as in DFU.
  const pop = new TownPopulation(null, { totalBlocks: 16, race: 'Breton', makePerson: () => null, rand: seq(0.5) });
  const person = { setIdentity() {} };
  srand(7);
  pop._randomiseNPC(person);
  assert.equal(person.gender, GENDERS.Female, 'rand 0.5 -> Range(0,2) == 1 -> female');
  assert.equal(person.nameNPC, 'Belladabyth Hawksly');
  srand(7);
  assert.equal(person.nameNPC, fullName(BANK_TYPES.Breton, GENDERS.Female), 'NameHelper.FullName, female sets');
  const guardPool = new TownPopulation(null, { totalBlocks: 16, race: 'Breton', makePerson: () => null, rand: seq(0) });
  const guard = { setIdentity() {} };
  srand(7);
  guardPool._randomiseNPC(guard);
  assert.equal(guard.gender, GENDERS.Male, 'the guard arm is male (MobilePersonNPC.cs:147)');
  assert.equal(guard.nameNPC, 'Uthyrick Hawksly');
  srand(7);
  assert.equal(guard.nameNPC, fullName(BANK_TYPES.Breton, GENDERS.Male), 'NameHelper.FullName, male sets');
  assert.notEqual(guard.nameNPC, person.nameNPC, 'the gender really routes into the bank');

  // The name plate and %n both read THAT name, not the faction record.
  const rollsRef = { r: 0.5 };
  const { tt } = await liveTalk({ rollsRef, reactionMod: 20 });   // reaction > 0 -> %n = nameNPC
  const building = tt.directory[0];
  const walker = { pos: [0, 0, 5], nameNPC: person.nameNPC };
  const hooks = await talkTo(tt, walker);
  assert.equal(tt._debug().people, 'People of Daggerfall', 'the People faction is still the reaction source');
  assert.equal(hooks.npcName, 'Belladabyth Hawksly');
  assert.equal(tt._debug().npcName, 'Belladabyth Hawksly');
  assert.equal(hooks.question(building),
    'How do you do, Belladabyth Hawksly. Do you know where The Unfortunate Priest is?');
  sayGoodbye(tt);
});

// ---------------------------------------------------------------
// The court flow. A recording townTalk stub: every box the flow
// pushes is captured with its rendered lines, which is what the
// player actually reads.
// ---------------------------------------------------------------
function courtHarness({ legalRep = 0, gold = 1000, rolls, name = 'Mack Cothran' } = {}) {
  const rsc = new TextRsc().load(bytes('TEXT.RSC'));
  const boxes = [];
  let win = null, onClosed = null;
  const townTalk = {
    texts: (id) => rsc.plainText(id),
    locationName: 'Daggerfall',
    showOverlay: (w, cb) => { boxes.push(w); win = w; onClosed = cb ?? null; },
  };
  const playerEntity = {
    name, health: 30, crimeCommitted: CRIMES.Pickpocketing, haveShownSurrenderDialogue: true,
    legalRep: { 17: legalRep }, skills: 30, skillUses: [], stats: { personality: 50 },
    items: [{ group: 'Currency', name: 'Gold Pieces', stackCount: gold }],
  };
  const flow = createArrestFlow({ townTalk, playerEntity, regionIndex: 17, rolls });
  // The overlay seam: a ChoiceWindow marks itself done, then its
  // action may push the next box (townTalk.js keydown).
  const press = (code) => {
    const cur = win;
    cur.input(code);
    if (win === cur && cur.done) { const cb = onClosed; onClosed = null; win = null; cb?.(); }
  };
  const close = () => press('confirm');
  return { flow, townTalk, playerEntity, boxes, press, close, lines: () => boxes.map((b) => b.lines.join('')) };
}

// ---------------------------------------------------------------
// F2 - every court box is built with SetTextTokens, and
// DaggerfallMessageBox.SetTextTokens defaults expandMacros = true
// (DaggerfallMessageBox.cs:432-438), so DFU runs MacroHelper over all
// of them. 8055 (%dip), 8062 (%pcn) and 8063 (%pcn + %cn) went out of
// the port raw.
// ---------------------------------------------------------------
test('audit18 social F2: the verdict, acquittal and banishment boxes expand their macros', (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');

  // (a) not guilty -> free to go (8062, %pcn). legalRep 0 -> both
  // FailedRolls succeed -> punishmentType 2; chance = 0 + (30+50)/2
  // = 40, and a roll of 10 passes.
  srand(12);
  const free = courtHarness({ rolls: seq(0.99, 0.99, 0.10) });
  free.flow.startCourtFlow();
  free.press('KeyN');
  free.press('KeyD');
  assert.equal(free.lines().at(-1),
    'Mack Cothran, you have been found not guilty\n by this court. You are free to go.\n');

  // (b) a FAILED defense -> found guilty (8055, %dip). Seed 5 gives
  // the five penalty coin flips 1,1,0,1,1 -> fine 160, 3 days.
  srand(5);
  const guilty = courtHarness({ rolls: seq(0.99, 0.99, 0.99, 0.50) });
  guilty.flow.startCourtFlow();
  guilty.press('KeyN');
  guilty.press('KeyD');
  assert.equal(guilty.lines().at(-1),
    'You have been found guilty, and are sentenced to\n 3 days in prison. Starting today.\n');

  // (c) banishment (8063, %pcn AND %cn). legalRep -30 -> threshold2
  // = 15, and a roll of 5 passes it -> punishmentType 0.
  //
  // AUDIT 21 F5: only TWO rolls here, not three. C#'s `&&` short-circuits
  // (DaggerfallCourtWindow.cs:136), so a first roll that PASSES means the
  // second court roll is never drawn and the next value goes to the
  // defense. This sequence used to carry a third value written against the
  // port's old both-rolls-always behaviour; with the short-circuit fixed
  // it fed 0.05 to the defense and acquitted the player instead.
  srand(391);
  const ban = courtHarness({ legalRep: -30, rolls: seq(0.05, 0.99) });
  ban.flow.startCourtFlow();
  ban.press('KeyN');
  ban.press('KeyL');
  assert.equal(ban.lines().at(-1),
    'Mack Cothran, this court finds you guilty,\n and for your crimes you are to be banished\n from Daggerfall, never to return.\n');

  // Nothing anywhere in the sequence leaves a macro on screen.
  for (const set of [free, guilty, ban]) {
    for (const line of set.lines()) assert.ok(!/%(dip|pcn|cn|gtp|cri|pen)/.test(line), line);
  }
});

// ---------------------------------------------------------------
// F6 - DaggerfallCourtWindow's zero-days arms push NO box: the guilty
// plea (:340-348) and state 2's own release (:243-250) both go
// straight to RaiseReputationForDoingSentence + FillVitalSigns +
// ReleaseFromPrison. courtTextFoundGuilty (8055) is raised from state
// 2 only (:232-240), which a guilty PLEA never reaches.
// ---------------------------------------------------------------
test('audit18 social F6: a guilty plea with no prison time shows no verdict record', (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  const rsc = new TextRsc().load(bytes('TEXT.RSC'));
  const FOUND_GUILTY = rsc.plainText(TEXT_FOUND_GUILTY)[0];
  assert.equal(FOUND_GUILTY,
    'You have been found guilty, and are sentenced to\n %dip days in prison. Starting today.\n');

  // Seed 12 -> all five coin flips odd -> fine 200, days 0; the plea
  // halves both, so the release arm runs with daysInPrison 0.
  srand(12);
  const plea = courtHarness({ rolls: seq(0.99, 0.99) });
  plea.flow.startCourtFlow();
  plea.press('KeyG');
  assert.equal(plea.boxes.length, 1, 'only the 8050 plea prompt is ever shown');
  assert.equal(plea.playerEntity.crimeCommitted, 0, 'ReleaseFromPrison still clears the crime');
  assert.equal(plea.playerEntity.items[0].stackCount, 900, 'the halved 100-gold fine is still deducted');
  for (const line of plea.lines()) {
    assert.ok(!line.includes('days in prison. Starting today.'), `invented 8055 record: ${line}`);
  }

  // The state-2 path with zero days shows 8055 EXACTLY ONCE.
  srand(12);
  const failed = courtHarness({ rolls: seq(0.99, 0.99, 0.99, 0.50) });
  failed.flow.startCourtFlow();
  failed.press('KeyN');
  failed.press('KeyD');
  const guiltyBoxes = () => failed.lines().filter((l) => l.includes('days in prison. Starting today.'));
  assert.equal(guiltyBoxes().length, 1);
  failed.close();   // closing state 2 releases; DFU pushes nothing more
  assert.equal(guiltyBoxes().length, 1, '8055 must not be shown a second time on release');
  assert.equal(failed.boxes.length, 3, '8050 plea, 8064 how-convince, 8055 verdict - and nothing else');
});

// ---------------------------------------------------------------
// F3 - SerializablePlayer.cs:149-150 writes crimeCommitted and
// haveShownSurrenderToGuardsDialogue, :168 writes regionData (whose
// LegalRep PlayerEntity.cs:2291-2311 mutates), and :317-318 / :344-347
// read all three back. The port's snapshot carried none of them.
// ---------------------------------------------------------------
test('audit18 social F3: the quicksave carries the crime and the per-region legal reputation', () => {
  const live = {
    stats: { strength: 50, endurance: 50 }, skills: [], skillUses: [], items: [], spells: [],
    activeEffects: [], legalRep: { 17: -30, 3: 12 }, crimeCommitted: 5, haveShownSurrenderDialogue: true,
  };
  // A real quicksave round trip: writeQuicksave JSON-stringifies.
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(live)));
  assert.deepEqual(snap.legalRep, { 17: -30, 3: 12 });
  assert.equal(snap.crimeCommitted, 5);
  assert.equal(snap.haveShownSurrenderDialogue, true);

  // Restored onto a FRESH entity - the page-reload case, which is the
  // only one the module singleton does not paper over.
  const fresh = { stats: {}, skills: [], skillUses: [], items: [], spells: [], activeEffects: [] };
  restorePlayer(fresh, snap);
  assert.equal(legalRepOf(fresh, 17), -30);
  assert.equal(legalRepOf(fresh, 3), 12);
  assert.equal(fresh.crimeCommitted, 5);
  assert.equal(fresh.haveShownSurrenderDialogue, true);

  // The snapshot must hold a COPY, never alias live state.
  fresh.legalRep[17] = 0;
  assert.equal(snap.legalRep[17], -30);
  const snap2 = snapshotPlayer(live);
  live.legalRep[17] = -1;
  assert.equal(snap2.legalRep[17], -30);

  // A snapshot older than these fields restores to C#'s type defaults
  // (0 / false / an empty regionData), never to undefined.
  const old = JSON.parse(JSON.stringify(snapshotPlayer(live)));
  delete old.legalRep; delete old.crimeCommitted; delete old.haveShownSurrenderDialogue;
  const target = { stats: {}, skills: [], skillUses: [], items: [], spells: [], activeEffects: [] };
  restorePlayer(target, old);
  assert.equal(target.crimeCommitted, 0);
  assert.equal(target.haveShownSurrenderDialogue, false);
  assert.deepEqual(target.legalRep, {});
  assert.equal(legalRepOf(target, 17), 0);
});

// ===========================================================================
// AUDIT 21 F8: TIME PASSES IN CUSTODY.
//
// `advanceDays` defaulted to `() => {}` AND BOTH exterior hosts constructed
// the flow without it - so a thirty-day sentence advanced the clock by zero
// and you walked out of court on the same afternoon you walked in. The fix is
// not host wiring: F2 gave the port ONE world clock, so the flow moves time
// itself and there is no argument left to forget.
//
// The 4-hour bump is a SEPARATE law and was missing entirely:
// ReleaseFromPrison (DaggerfallCourtWindow.cs:482-491) opens with
// RaiseTime(240 * 60) on EVERY release - the zero-day guilty plea and the
// acquittal included.
// ===========================================================================

test('AUDIT 21 F8: a sentence moves the world clock, and every release costs four hours', (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');

  const before = worldMinutes();
  try {
    // (a) THE DEFAULT. Built exactly as the two hosts build it - no
    // advanceDays, no advanceMinutes - which is the shape that did nothing.
    // Seed 5 gives the penalty coin flips 1,1,0,1,1 -> fine 160, 3 days;
    // gold 0 converts the whole fine to prison time on top of that.
    setWorldMinutes(0);
    srand(5);
    const h = courtHarness({ legalRep: 0, gold: 0, rolls: seq(0.99, 0.99) });
    h.flow.startCourtFlow();
    h.press('KeyG');                 // plead guilty -> prison
    assert.equal(h.playerEntity.crimeCommitted, 0, 'sentence served, crime cleared');
    assert.ok(worldMinutes() > 0,
      'the default flow must move the clock - it used to advance it by exactly zero');
    const days = Math.floor(worldMinutes() / MINUTES_PER_DAY);
    assert.ok(days >= 1, `a no-gold sentence serves whole days (got ${days})`);
    // 240, the LITERAL. Asserting against RELEASE_MINUTES would ask the
    // mutated constant what it expects - the exact shape AUDIT 21 found in
    // eight guild text-id pins - and changing the bump to three hours would
    // pass. RaiseTime(240 * 60) is DaggerfallCourtWindow.cs:485.
    assert.equal(RELEASE_MINUTES, 240, 'four hours, in minutes');
    assert.equal(worldMinutes(), days * MINUTES_PER_DAY + 240,
      'and the release bump rides ON TOP of the whole days, exactly four hours');

    // (b) THE FOUR HOURS ALONE. An ACQUITTAL never goes to prison, and DFU
    // still calls ReleaseFromPrison - so the clock moves by exactly 240.
    setWorldMinutes(0);
    srand(12);
    const a = courtHarness({ legalRep: 0, gold: 1000, rolls: seq(0.99, 0.99, 0.10) });
    a.flow.startCourtFlow();
    a.press('KeyN');
    a.press('KeyD');                 // chance = 0 + (30+50)/2 = 40; roll 10 passes
    assert.equal(a.playerEntity.crimeCommitted, 0, 'acquitted');
    assert.equal(worldMinutes(), 240,
      'an acquittal costs four hours and not one minute more');

    // (c) BANISHMENT releases too (:263-278 -> OnPop), so it pays the bump
    // as well - the only thing it does not pay is the reputation credit.
    setWorldMinutes(0);
    srand(12);
    const b = courtHarness({ legalRep: -30, gold: 1000, rolls: seq(0.05) });
    b.flow.startCourtFlow();
    b.press('KeyG');
    assert.equal(worldMinutes(), 240, 'banishment is a release');

    // (d) THE ORDER. DFU credits the sentence at state 3 (:259) and only THEN
    // elapses the days (:475), setting PreventNormalizingReputations across
    // the skip so the elapsed days cannot decay what it just credited. With
    // nothing decaying reputation on the skip today the two orders read the
    // same from outside, so sample it FROM INSIDE the skip - which is exactly
    // where PreventNormalizingReputations would have to look.
    setWorldMinutes(0);
    srand(5);
    let repDuringSkip = null;
    const ordered = courtHarness({ legalRep: 0, gold: 0, rolls: seq(0.99, 0.99) });
    // Pickpocketing's credit is half(2) - 1 = 0, which would make the check
    // below vacuous. Murder credits half(20) - 1 = 9.
    ordered.playerEntity.crimeCommitted = CRIMES.Murder;
    const flow2 = createArrestFlow({
      townTalk: ordered.townTalk, playerEntity: ordered.playerEntity, regionIndex: 17,
      rolls: seq(0.99, 0.99),
      advanceDays: (d) => { repDuringSkip = ordered.playerEntity.legalRep[17]; advanceWorldMinutes(d * MINUTES_PER_DAY); },
    });
    flow2.startCourtFlow();
    ordered.press('KeyG');
    assert.notEqual(repDuringSkip, null, 'the sentence must actually have gone to prison');
    assert.equal(repDuringSkip, ordered.playerEntity.legalRep[17],
      'the sentence is CREDITED BEFORE the days elapse, not after');
    assert.notEqual(repDuringSkip, 0, 'and the credit is non-zero, so the check is not vacuous');

    // (e) an EXPLICIT host hook is still honoured over the default
    setWorldMinutes(0);
    let asked = null;
    createArrestFlow({
      townTalk: { texts: () => null, showOverlay: () => {} },
      playerEntity: { legalRep: { 17: 0 } }, regionIndex: 17,
      advanceDays: (d) => { asked = d; },
    });
    assert.equal(asked, null, 'constructing the flow does not itself move time');
    assert.equal(worldMinutes(), 0);
  } finally {
    setWorldMinutes(before);
  }
});
