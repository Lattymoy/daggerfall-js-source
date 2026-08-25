import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectInteriorPeople, peopleAreVisible } from '../src/characters/interiorPeople.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { BlocksFile } from '../src/formats/blocksFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('interior people: verbatim AddPeople position + data passthrough', () => {
  const recordData = {
    interior: {
      blockPeopleRecords: [
        { xPos: 100, yPos: 50, zPos: -200, textureArchive: 182, textureRecord: 3, factionID: 510, flags: 1 },
      ],
    },
  };
  const people = collectInteriorPeople(recordData);
  assert.equal(people.length, 1);
  const p = people[0];
  // (XPos, -YPos, ZPos) * GlobalScale - the raw position is the BASE.
  assert.equal(p.x, 100 * GLOBAL_SCALE);
  assert.equal(p.y, -50 * GLOBAL_SCALE);
  assert.equal(p.z, -200 * GLOBAL_SCALE);
  assert.equal(p.textureArchive, 182);
  assert.equal(p.textureRecord, 3);
  assert.equal(p.factionID, 510);
  assert.equal(p.flags, 1);
  assert.deepEqual([p.rawX, p.rawY, p.rawZ], [100, 50, -200]);
});

test('interior people: full corpus sweep', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  blocks.load(readFileSync(join(ARENA2, 'BLOCKS.BSA')));
  let interiors = 0;
  let totalPeople = 0;
  let withPeople = 0;
  const archives = new Set();
  let peopleInEmpty = 0;
  for (let b = 0; b < blocks.count; b++) {
    if (blocks.getBlockName(b).indexOf('.RMB') === -1) continue;
    const dfBlock = blocks.getBlock(b);
    for (const sub of dfBlock.rmbBlock.subRecords) {
      // Mirror the interior corpus condition: empty interiors (no 3d
      // records) never lay out; people there could never be reached.
      if (sub.interior.header.num3dObjectRecords === 0) {
        peopleInEmpty += collectInteriorPeople(sub).length;
        continue;
      }
      interiors++;
      const people = collectInteriorPeople(sub);
      totalPeople += people.length;
      if (people.length) withPeople++;
      for (const p of people) {
        archives.add(p.textureArchive);
        // Every person mirrors its raw record exactly.
        assert.equal(p.x, p.rawX * GLOBAL_SCALE);
        assert.equal(p.y, -p.rawY * GLOBAL_SCALE);
        assert.equal(p.z, p.rawZ * GLOBAL_SCALE);
        assert.ok(Number.isInteger(p.factionID));
        assert.ok(p.textureRecord >= 0 && p.textureRecord < 128);
      }
    }
  }
  // Corpus invariants (pinned from a full ARENA2 sweep at C1):
  // 6832 interiors, people in a large fraction of them, classic
  // townsfolk archives only (175-184 range + guild/temple sets).
  assert.equal(interiors, 6832);
  // Pinned from the full ARENA2 sweep at C1.
  assert.equal(totalPeople, 14174);
  assert.equal(withPeople, 6724);
  assert.equal(peopleInEmpty, 0);
  assert.deepEqual([...archives].sort((a, b) => a - b), [176, 177, 181, 182, 183, 184]);
  console.log(`people corpus: ${totalPeople} people across ${withPeople}/${interiors} interiors, ${peopleInEmpty} in empty records, archives [${[...archives].sort((a, b) => a - b)}]`);
});

// ── P1: AddPeople's VISIBILITY TAIL (:1206-1226) ─────────────────
//
// Routed at C1 because it needed banking; H1 shipped house ownership,
// which was the last dependency, so the gate lands here.
const B = BUILDING_TYPES;
/** A guild closure of the shape buildingLocks/worldModes already use. */
const guild = (opts) => () => opts;

test('P1: a house you OWN empties itself - the one inverted primitive', () => {
  // The door ladder and the people gate read IsHouseOwned and reach
  // OPPOSITE conclusions, and both are right: buildingIsUnlocked
  // :1262 lets the owner walk in, AddPeople :1209-1212 takes the
  // previous occupants out. It is checked FIRST, ahead of every hour
  // rule, so an owned house is empty at any time of day.
  const owned = { buildingType: B.House3, factionId: 0, buildingKey: 4242 };
  for (const hour of [0, 9, 12, 23]) {
    assert.equal(peopleAreVisible(owned, { hour, isHouseOwned: (k) => k === 4242 }), false,
      `an owned house had people at ${hour}:00`);
  }
  // ...and the SAME house, unowned, keeps House3's hours (9-19)
  assert.equal(peopleAreVisible(owned, { hour: 12, isHouseOwned: () => false }), true);
  assert.equal(peopleAreVisible(owned, { hour: 3, isHouseOwned: () => false }), false);
});

test('P1: a shop reads the ENTRY LATCH, not the clock', () => {
  // IsPlayerInsideOpenShop is computed once at the door
  // (PlayerActivate.cs:1120) and then left alone, so the shopkeeper
  // does not blink out around a player still standing in the shop at
  // closing time. The hour is irrelevant to this arm - which is what
  // these two lines prove, by contradicting it.
  const shop = { buildingType: B.GeneralStore, factionId: 0, buildingKey: 7 };
  assert.equal(peopleAreVisible(shop, { hour: 3, insideOpenShop: true }), true,
    'the latch did not survive the clock');
  assert.equal(peopleAreVisible(shop, { hour: 12, insideOpenShop: false }), false,
    'a shop entered CLOSED showed its people at midday');
});

test('P1: the non-shop arm stops at House4, so a Palace keeps hours and a Ship never does', () => {
  // `buildingType <= House4` is not "residences only" - Temple,
  // Tavern and Palace are all under it. Palace is the one with real
  // hours (10-16); Tavern and Temple are 0/25, always open.
  const at = (buildingType, hour) => peopleAreVisible({ buildingType, factionId: 0 }, { hour });
  assert.equal(at(B.Palace, 12), true, 'the palace was empty at noon');
  assert.equal(at(B.Palace, 20), false, 'the palace kept its people past closing');
  assert.equal(at(B.Tavern, 3), true, 'the tavern closed - its row is 0/25');
  assert.equal(at(B.Temple, 3), true, 'the temple closed - its row is 0/25');
  // above House4 the arm does not apply at all, whatever the hours row says
  assert.equal(at(B.House5, 3), true, 'House5 was gated - it is above House4');
  assert.equal(at(B.Ship, 3), true, 'a ship was gated - it is above House4');
  // ...and House1's 0/0 row means a House1 never shows anyone
  assert.equal(at(B.House1, 12), false, 'House1 has an open-0 close-0 row; nobody is ever home');
});

test('P1: a guild hall with anytime access keeps its people after hours', () => {
  const hall = { buildingType: B.GuildHall, factionId: 40, buildingKey: 9 };
  // GuildHall's row is 11-23, so 2am is closed
  assert.equal(peopleAreVisible(hall, { hour: 2, guildForBuilding: guild({ hallAccessAnytime: false, isMember: true }) }), false,
    'a member without anytime access got in after hours');
  assert.equal(peopleAreVisible(hall, { hour: 2, guildForBuilding: guild({ hallAccessAnytime: true, isMember: true }) }), true,
    'anytime access did not exempt the hall');
  assert.equal(peopleAreVisible(hall, { hour: 12 }), true, 'the hall was empty during its own hours');
});

test('P1: a TG/DB House2 shows its people to MEMBERS only', () => {
  // House2 + a non-zero factionID is the Thieves Guild / Dark
  // Brotherhood safehouse shape. House2's row is 6-18 (the first
  // draft of this test guessed 18-23 and the gate corrected it).
  const safehouse = { buildingType: B.House2, factionId: 42, buildingKey: 11 };
  assert.equal(peopleAreVisible(safehouse, { hour: 3, guildForBuilding: guild({ isMember: true }) }), true,
    'a member was shut out of the safehouse');
  assert.equal(peopleAreVisible(safehouse, { hour: 3, guildForBuilding: guild({ isMember: false }) }), false,
    'a non-member saw inside the safehouse');
  // a PLAIN House2 - factionID 0 - is not a safehouse and keeps hours
  const plain = { buildingType: B.House2, factionId: 0, buildingKey: 12 };
  assert.equal(peopleAreVisible(plain, { hour: 3, guildForBuilding: guild({ isMember: true }) }), false,
    'membership leaked into a house with no faction');
  assert.equal(peopleAreVisible(plain, { hour: 12 }), true, 'a plain House2 was empty during its own hours');
  assert.equal(peopleAreVisible(plain, { hour: 20 }), false, 'a plain House2 kept its people past 18:00');
});

test('P1 hosts: the gate is evaluated at the DOOR and the quest hook is its ELSE branch', () => {
  const src = (f) => readFileSync(join(process.cwd(), f), 'utf8');
  const wm = src('src/scenes/worldModes.js');
  // DFU resolves the building, latches IsPlayerInsideOpenShop from it,
  // and only then transitions (PlayerActivate.cs:1119-1121). The port
  // used to resolve the identity AFTER buildInteriorContext, so the
  // gate would have had nothing to read - the order is the fix.
  const idAt = wm.indexOf('interiorBuilding = buildingDataForDoor?.(hit)');
  const ctxAt = wm.indexOf('const ctx = await buildInteriorContext(');
  assert.ok(idAt > 0 && ctxAt > 0, 'the transition changed shape');
  assert.ok(idAt < ctxAt, 'the building identity is resolved AFTER the interior stands - the people gate cannot read it');
  assert.ok(wm.includes('peopleAreVisible('), 'the host never evaluates the visibility gate');
  assert.ok(wm.includes('peopleVisible })'), 'the answer never reaches buildInteriorContext');
  // the latch is the entry-time computation, not a live clock read
  assert.match(wm, /const insideOpenShop = .*isShop\(_bt\) && isBuildingOpen\(_bt, _hour\)/,
    'the shop latch is not PlayerActivate.cs:1120');

  const ic = src('src/scenes/interiorContext.js');
  // AddPeople's else (:1224): a person the gate removed is NOT handed
  // to the quest machine
  const hookAt = ic.indexOf('opts.setupStaticNpc?.(pn, pn.host)');
  // ...matched as a LIVE line, not as text. The first draft of this
  // pin used indexOf, and commenting the guard out left the substring
  // sitting in the comment and the pin passing - the same shape that
  // has slipped through twice before in this repo.
  const guardLine = /^[ \t]*if \(!visible\) continue;$/m.exec(ic);
  assert.ok(guardLine, 'hidden people are still wired into the quest machine');
  assert.ok(guardLine.index < hookAt, 'the quest hook runs before the visibility guard');
  assert.match(ic, /active: visible/, 'the gate does not reach the person\'s active flag');
});
