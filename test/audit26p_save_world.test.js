// AUDIT 26 parity, the save-world wave: the DFU laws this batch
// restored, each pinned against the C# literal rather than against the
// port's own answer.
//
//   F219/F100  SerializablePlayer.cs:164-165, :332-333 - the coven's
//              daedra-of-the-day round-trips through the save.
//   F099       PlayerGPS.UndiscoverBuilding (:986-1019) - the three
//              refusals (onlyIfResidence, TG/DB hideout, matchName).
//   F183       PlayerAmbientLight.UpdateAmbientLight (:84-92) - the
//              castle/special-area ambient the port never selected.
//   F184       DaggerfallActionDoor.OnCompleteClose (:339-346) - the
//              close sound lands with the door, not with the swing.
//   F038       DaggerfallCourtWindow.cs:425 - the acquittal fills
//              vital signs.
//   F042/F096  TalkManager.cs:664-667 - questionTypeReactionMods is
//              indexed by GetClassicQuestionIndex(qt), not by 0.
//   F043       TalkManager.cs:669-673 - the reaction roll is seeded by
//              the CURRENT talk partner, static NPCs included.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import {
  discoverBuilding, undiscoverBuilding, hasDiscoveredBuilding, restoreDiscovery,
} from '../src/systems/discovery.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { THE_THIEVES_GUILD, THE_DARK_BROTHERHOOD } from '../src/systems/factionRep.js';
import {
  DUNGEON_AMBIENT, CASTLE_AMBIENT, SPECIAL_AREA_AMBIENT,
  SPECIAL_AREA_BLOCK_NAME, isSpecialAreaBlock, dungeonAmbient,
} from '../src/world/dungeonLights.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { createArrestFlow, fillVitalSigns } from '../src/scenes/arrestFlow.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { QUESTION_TYPE } from '../src/systems/topicTree.js';
import { CRIMES } from '../src/systems/court.js';
import { setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';

// ---------------------------------------------------------------
// F219 / F100 - SerializablePlayer writes DaedraSummonDay and
// DaedraSummonIndex one for one (:164-165) and reads them back
// (:332-333). The port keeps the coven's remembered roll on the same
// entity (daedraForSummoner mutates it, worldModes passes
// `state: playerEntity`) but the envelope carried neither, so a load
// left both undefined and daedraSummoning.js's
// `day !== today || !index` guard re-rolled - reload until the prince
// you want answers.
// ---------------------------------------------------------------
test('audit26p save: the coven daedra roll round-trips (SerializablePlayer.cs:164-165, :332-333)', () => {
  const src = {
    name: 'Mack', stats: { strength: 50, endurance: 50 }, skills: [30], skillUses: [0],
    items: [], health: 10, maxHealth: 20,
    daedraSummonDay: 213, daedraSummonIndex: 9,
  };
  const snap = snapshotPlayer(src, {});
  // The pair is IN the envelope, not re-derived at the far end.
  assert.equal(snap.daedraSummonDay, 213);
  assert.equal(snap.daedraSummonIndex, 9);

  const dst = {};
  restorePlayer(dst, snap, new Map());
  assert.equal(dst.daedraSummonDay, 213);
  assert.equal(dst.daedraSummonIndex, 9);

  // ...and a backward load OVERWRITES a later in-session roll rather
  // than leaving it standing (C# assigns, it does not merge).
  const live = { ...src, daedraSummonDay: 300, daedraSummonIndex: 3 };
  restorePlayer(live, snap, new Map());
  assert.equal(live.daedraSummonDay, 213);
  assert.equal(live.daedraSummonIndex, 9);
});

// ---------------------------------------------------------------
// F099 - UndiscoverBuilding (PlayerGPS.cs:986-1019) is not a delete.
// Its quest callers pass (buildingKey, true, buildingName)
// (TalkManager.cs:2958, Quest.cs:655); the bank's sold-house caller
// passes the key alone (DaggerfallBankManager.cs:460).
// ---------------------------------------------------------------
test('audit26p discovery: UndiscoverBuilding keeps DFU\'s three refusals (PlayerGPS.cs:1005-1016)', () => {
  const LOC = '17:Daggerfall';
  const put = (key, over = {}) => discoverBuilding(LOC, {
    buildingKey: key, name: 'The Odd Dog', factionId: 0,
    buildingType: BUILDING_TYPES.House2, ...over,
  });

  restoreDiscovery(null);

  // (a) the bank's caller - no guards asked for, the record goes.
  put(1);
  undiscoverBuilding(LOC, 1);
  assert.equal(hasDiscoveredBuilding(LOC, 1), false);

  // (b) onlyIfResidence and the building is NOT a residence (:1005-1007):
  // a tavern a quest sites stays on the map. RMBLayout.IsResidence is
  // House1-House4 only.
  put(2, { buildingType: BUILDING_TYPES.Tavern });
  undiscoverBuilding(LOC, 2, true, 'The Odd Dog');
  assert.equal(hasDiscoveredBuilding(LOC, 2), true);
  // ...and the same building with no residence gate still goes.
  undiscoverBuilding(LOC, 2, false, 'The Odd Dog');
  assert.equal(hasDiscoveredBuilding(LOC, 2), false);

  // (c) a Thieves Guild / Dark Brotherhood hideout is never
  // undiscovered (:1009-1012) - not even by the ungated caller.
  put(3, { factionId: THE_THIEVES_GUILD });
  undiscoverBuilding(LOC, 3);
  assert.equal(hasDiscoveredBuilding(LOC, 3), true);
  put(4, { factionId: THE_DARK_BROTHERHOOD });
  undiscoverBuilding(LOC, 4, true, 'The Odd Dog');
  assert.equal(hasDiscoveredBuilding(LOC, 4), true);
  assert.deepEqual([THE_THIEVES_GUILD, THE_DARK_BROTHERHOOD], [42, 108]);   // FactionFile.FactionIDs

  // (d) matchName given and different from the stored displayName
  // (:1014-1016): the other quest's name is still running on it.
  put(5, { name: "Alnaya's House" });
  undiscoverBuilding(LOC, 5, true, "Cirion's House");
  assert.equal(hasDiscoveredBuilding(LOC, 5), true);
  undiscoverBuilding(LOC, 5, true, "Alnaya's House");
  assert.equal(hasDiscoveredBuilding(LOC, 5), false);

  restoreDiscovery(null);
});

// ---------------------------------------------------------------
// F183 - PlayerAmbientLight.UpdateAmbientLight's dungeon arm (:84-92)
// is THREE branches, and the port shipped only the last one, so a
// castle wing rendered at 0.12 instead of 0.58.
// ---------------------------------------------------------------
test('audit26p world: the dungeon ambient arm selects castle/special/floor (PlayerAmbientLight.cs:84-92)', () => {
  // The constants, verbatim (PlayerAmbientLight.cs:31-33).
  assert.deepEqual([...DUNGEON_AMBIENT], [0.12, 0.12, 0.12]);
  assert.deepEqual([...CASTLE_AMBIENT], [0.58, 0.58, 0.58]);
  assert.deepEqual([...SPECIAL_AREA_AMBIENT], [0.58, 0.58, 0.58]);

  // The branch order: castle first, then special area, then the floor.
  assert.deepEqual([...dungeonAmbient({ insideDungeonCastle: true })], [0.58, 0.58, 0.58]);
  assert.deepEqual([...dungeonAmbient({ insideSpecialArea: true })], [0.58, 0.58, 0.58]);
  assert.deepEqual([...dungeonAmbient({})], [0.12, 0.12, 0.12]);
  assert.deepEqual([...dungeonAmbient()], [0.12, 0.12, 0.12]);

  // PlayerEnterExit.SpecialAreaCheck (:1221-1237): one block name.
  assert.equal(SPECIAL_AREA_BLOCK_NAME, 'S0000161.RDB');
  assert.equal(isSpecialAreaBlock('S0000161.RDB'), true);
  assert.equal(isSpecialAreaBlock('S0000040.RDB'), false);
});

// ---------------------------------------------------------------
// F184 - DaggerfallActionDoor.Close (:311-332) plays NO sound; the
// CloseSound is OnCompleteClose's (:339-346), after the swing. The
// open side is unchanged (Open plays at the start, :296-302).
// ---------------------------------------------------------------
const stubCollider = () => {
  const buckets = new Map();
  return {
    buckets,
    addMesh: (key, p, i, m) => buckets.set(key, m),
    removeBucket: (key) => buckets.delete(key),
  };
};
const tick = (a, seconds, step = 1 / 60) => {
  for (let t = 0; t < seconds; t += step) a.update(step);
};

test('audit26p world: the door CLOSE sound fires on completion, the OPEN sound at the start (DaggerfallActionDoor.cs:296-302, :339-346)', () => {
  const a = new ActionSystem(stubCollider());
  const states = [];
  a.onDoorState = (o, opening) => states.push(opening);
  const base = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const door = a.addDoor({ positions: [], indices: [] }, base);

  // Open: the sound is immediate, before the 1.5 s swing runs.
  a.toggleDoor(door, true);
  assert.deepEqual(states, [true]);
  tick(a, 1.6);
  assert.equal(door.state, 'end');
  assert.deepEqual(states, [true], 'the open swing completing plays nothing more');

  // Close: NOTHING at the start...
  a.toggleDoor(door, true);
  assert.equal(door.state, 'reverse');
  assert.deepEqual(states, [true], 'Close plays no sound');
  tick(a, 1.4);
  assert.equal(door.state, 'reverse');
  assert.deepEqual(states, [true], 'still silent while the door is still swinging');
  // ...and exactly one, at the moment it lands closed.
  tick(a, 0.2);
  assert.equal(door.state, 'start');
  assert.deepEqual(states, [true, false]);
  tick(a, 2);
  assert.deepEqual(states, [true, false], 'and it does not repeat while the door sits closed');
});

// ---------------------------------------------------------------
// F038 - the acquittal arm is DaggerfallCourtWindow state 6
// (:412-427) and it calls FillVitalSigns (:425) before
// RaiseReputationForDoingSentence (:426). SurrenderToCityGuards forced
// health to 1 on the way in (PlayerEntity.cs:2321), so without it the
// player who wins the case walks out at 1 HP.
// ---------------------------------------------------------------
test('audit26p court: FillVitalSigns is all three vitals (DaggerfallEntity.cs:442-447)', () => {
  const e = {
    health: 1, maxHealth: 44, magicka: 0, maxMagicka: 31, fatigue: 0,
    stats: { strength: 50, endurance: 30 },
  };
  fillVitalSigns(e);
  assert.equal(e.health, 44);
  assert.equal(e.magicka, 31);
  assert.equal(e.fatigue, (50 + 30) * 64);   // MaxFatigue, FatigueMultiplier 64
});

test('audit26p court: an ACQUITTED player leaves court at full vitals (DaggerfallCourtWindow.cs:425)', () => {
  const before = worldMinutes();
  try {
    setWorldMinutes(0);
    const boxes = [];
    let win = null, onClosed = null;
    const townTalk = {
      texts: () => null,
      locationName: 'Daggerfall',
      showOverlay: (w, cb) => { boxes.push(w); win = w; onClosed = cb ?? null; },
    };
    const playerEntity = {
      name: 'Mack Cothran', health: 30, maxHealth: 44, magicka: 0, maxMagicka: 31, fatigue: 0,
      crimeCommitted: CRIMES.Pickpocketing, haveShownSurrenderDialogue: false,
      legalRep: { 17: 0 }, skills: 30, skillUses: [], stats: { personality: 50, strength: 50, endurance: 30 },
      items: [{ group: 'Currency', name: 'Gold Pieces', stackCount: 500 }],
    };
    // A surrender floors health at 1 (PlayerEntity.cs:2321) - which is
    // the whole reason the court refills.
    // 0.99 fails both court rolls (punishmentType 2 - prison/fine),
    // then 0.10 PASSES the defense: chance = 0 + (30 + 50)/2 = 40.
    const rolls = ((seq) => () => (seq.length ? seq.shift() : 0.99))([0.99, 0.99, 0.10]);
    const flow = createArrestFlow({
      townTalk, playerEntity, regionIndex: 17, rolls,
    });
    const press = (code) => {
      const cur = win;
      cur.input(code);
      if (win === cur && cur.done) { const cb = onClosed; onClosed = null; win = null; cb?.(); }
    };
    flow.onGuardHit(5, () => {});
    press('KeyY');
    assert.equal(playerEntity.health, 1, 'the surrender really did floor health');

    // Not guilty -> debate.
    press('KeyN');
    press('KeyD');

    assert.equal(playerEntity.health, 44, 'the acquitted player is HEALED, not left at 1 HP');
    assert.equal(playerEntity.magicka, 31);
    assert.equal(playerEntity.fatigue, (50 + 30) * 64);
    assert.equal(playerEntity.arrested, false, 'and still funnels through the OnPop flags');
    assert.equal(playerEntity.crimeCommitted, 0);
    assert.equal(worldMinutes(), 240, 'ReleaseFromPrison\'s four hours still ride the acquittal');
  } finally {
    setWorldMinutes(before);
  }
});

// ---------------------------------------------------------------
// F042 / F096 and F043 - GetReactionToPlayer_0_1_2 (TalkManager.cs:
// 663-675).
//
//   reaction = LivePersonality/5
//            + questionTypeReactionMods[GetClassicQuestionIndex(qt)]
//            + toneModifier
//
// with questionTypeReactionMods = {5,0,0,0,5,0,0,0} (:96) - the +5 is
// index 0 (LocalBuilding/Regional) and index 4 (QuestLocation/
// OrganizationInfo) ALONE. And the roll it is compared against is
// seeded by the CURRENT partner (:669-673), lastTargetStaticNPC
// included.
//
// Personality 50 and the Normal tone give toneModifier 0 and no skill
// roll, so reaction is 10 for a Work question and 15 for a where-is.
// Seed 4's rollToBeat is 11: it lands BETWEEN them, so the wrong
// question index is a different tier, not a different arithmetic.
// ---------------------------------------------------------------
const townTalkFor = (seed) => {
  const tt = createTownTalk({
    renderer: { uploadTexture: () => ({}) },
    canvas: { width: 320, height: 200 },
    fetchBytes: async () => { throw new Error('headless: no ARENA2'); },
    playerEntity: { name: 'Mack Cothran', gender: 'male', race: 'Breton', stats: { personality: 50 } },
    regionIndex: 17,
    palette: null,
    rolls: () => 0.5,
  });
  // B7's ONE window opener is where DFU's lastTarget*NPC is recorded -
  // the static-NPC click (worldModes) arrives here with its nameSeed.
  tt.openTalkWindow('Hail.', { npcSeed: seed, npcName: 'Ryn Sethyl' });
  return tt;
};

test('audit26p talk: computeTier indexes questionTypeReactionMods by question (TalkManager.cs:664-667)', () => {
  // Work is classic index 3 -> mod 0 -> reaction 10 < rollToBeat 11 -> tier 0.
  assert.equal(townTalkFor(4).computeTier(QUESTION_TYPE.Work, 0), 0);
  // LocalBuilding is index 0 -> mod +5 -> reaction 15 -> tier 1.
  assert.equal(townTalkFor(4).computeTier(QUESTION_TYPE.LocalBuilding, 0), 1);
  // The other index-0/index-4 members take the +5 with them...
  assert.equal(townTalkFor(4).computeTier(QUESTION_TYPE.Regional, 0), 1);
  assert.equal(townTalkFor(4).computeTier(QUESTION_TYPE.QuestLocation, 0), 1);
  assert.equal(townTalkFor(4).computeTier(QUESTION_TYPE.OrganizationInfo, 0), 1);
  // ...and every other question gets NOTHING.
  for (const qt of [QUESTION_TYPE.Person, QUESTION_TYPE.Thing, QUESTION_TYPE.QuestPerson,
    QUESTION_TYPE.QuestItem, QUESTION_TYPE.News]) {
    assert.equal(townTalkFor(4).computeTier(qt, 0), 0, `question type ${qt} takes no bonus`);
  }

  // The cache is DFU's own: toneReactionForTalkSession holds the FIRST
  // reaction of a tone, so a later question of another type re-uses it
  // (:676-680) rather than recomputing with its own mod.
  const tt = townTalkFor(4);
  assert.equal(tt.computeTier(QUESTION_TYPE.Work, 0), 0);
  assert.equal(tt.computeTier(QUESTION_TYPE.LocalBuilding, 0), 0, 'the session-cached reaction stands');
});

test('audit26p talk: the reaction roll is seeded by the CURRENT partner (TalkManager.cs:669-673)', () => {
  // Same question, same player, two static NPCs: the band follows the
  // partner's seed. Seed 4 -> rollToBeat 11 (reaction 10 -> tier 0);
  // seed 2 -> rollToBeat 5 (reaction 10 -> tier 1).
  assert.equal(townTalkFor(4).computeTier(QUESTION_TYPE.Work, 0), 0);
  assert.equal(townTalkFor(2).computeTier(QUESTION_TYPE.Work, 0), 1);

  // And it is STABLE per partner: re-opening on the same NPC re-rolls
  // the same band (DFRandom is re-seeded every call).
  const tt = townTalkFor(2);
  assert.equal(tt.computeTier(QUESTION_TYPE.Work, 0), 1);
  tt.openTalkWindow('Hail.', { npcSeed: 2, npcName: 'Ryn Sethyl' });
  assert.equal(tt.computeTier(QUESTION_TYPE.Work, 0), 1);
});
