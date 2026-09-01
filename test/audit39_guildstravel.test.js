// AUDIT 39 - the guilds/travel cluster (F96, F98, F99, F100, F101/F115,
// F114).
//
// F96:  GuildManager's ctor-registered OnQuestEnded listener (:45-67)
//       is the ONLY door into the Thieves Guild and the Dark
//       Brotherhood. Unported, both guilds were unjoinable and every
//       law keyed on their membership was dead.
// F98:  DaggerfallCourtWindow calls FillVitalSigns on every court exit
//       but the execution (:249, :276, :347, :478); four of the port's
//       arms skipped it, and surrender forces health to 1.
// F99:  Banishment writes SeverePunishmentFlags |= 1 (:272) - the bit
//       PlayerEntity.cs:506-511 rolls a guard spawn against for ever.
// F100: The three guild-service gold gates are GetGoldAmount (coins
//       PLUS letters of credit), not the purse alone.
// F101/F115: CalculateTripCost consults KnightlyOrder.FreeTavernRooms
//       (:163); the port's parameter had no caller.
// F114: GetPlayerTravelPosition (:47-56) reckons from the BOARDING
//       pixel whenever the player is aboard their own ship.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUILDS, guildInitiationQuestEnded } from '../src/systems/guilds.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { canAffordTraining, donate, payForCure } from '../src/systems/guildServiceActions.js';
import { calculateTripCost, playerTravelPosition } from '../src/systems/travel.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { SEVERE_PUNISHMENT_BANISHED, SEVERE_PUNISHMENT_EXECUTED } from '../src/systems/encounters.js';
import { createArrestFlow } from '../src/scenes/arrestFlow.js';
import { CRIMES } from '../src/systems/court.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F96 ───────────────────────────────────────────────────────────

/** A live date, the shape joinGuild's daySinceZero reads. */
const DAY = { year: 405, month: 0, day: 0, dayOfYear: 1 };

test('F96: a SUCCESSFUL initiation quest is the join - one guild per name', () => {
  // AddMembership keys by GUILD GROUP - GeneralPopulace for the
  // Thieves Guild, DarkBrotherHood for the other, exactly as DFU's
  // CreateGuildObj(GuildGroups.X) pair does.
  const tg = {};
  assert.deepEqual(guildInitiationQuestEnded(tg, 'O0A0AL00', true, DAY).map((g) => g.name),
    ['ThievesGuild']);
  assert.equal(tg[GUILD_GROUPS.GeneralPopulace].guild, 'ThievesGuild');
  assert.equal(tg[GUILD_GROUPS.GeneralPopulace].rank, 0,
    'AddMembership -> Guild.Join() is rank 0, not a rank the quest awarded');

  const db = {};
  assert.deepEqual(guildInitiationQuestEnded(db, 'L0A01L00', true, DAY).map((g) => g.name),
    ['DarkBrotherhood']);
  assert.equal(db[GUILD_GROUPS.DarkBrotherHood].guild, 'DarkBrotherhood');
});

test('F96: a FAILED initiation joins nothing, and no other quest does either', () => {
  const m = {};
  assert.deepEqual(guildInitiationQuestEnded(m, 'O0A0AL00', false, DAY), [],
    'the whole listener sits inside `if (quest.QuestSuccess)`');
  assert.deepEqual(guildInitiationQuestEnded(m, 'L0A01L00', false, DAY), []);
  assert.deepEqual(guildInitiationQuestEnded(m, '_BRISIENA', true, DAY), []);
  assert.deepEqual(m, {}, 'nothing was written to the book on any of the three');
});

test('F96: the two quest names come from the guild records, which now have a reader', () => {
  // ThievesGuild.cs:24 / DarkBrotherhood.cs:24. Pinned against the
  // RECORDS rather than re-stated here, because the whole finding was
  // that these two fields had no consumer.
  assert.equal(GUILDS.ThievesGuild.initiationQuest, 'O0A0AL00');
  assert.equal(GUILDS.DarkBrotherhood.initiationQuest, 'L0A01L00');
  const g = src('systems/guilds.js');
  const fn = g.slice(g.indexOf('export function guildInitiationQuestEnded'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /GUILDS\.ThievesGuild, GUILDS\.DarkBrotherhood/,
    'the names are read off the records - a second literal here would let the two drift');
});

test('F96: the host runs the listener off the quest-end event, before the HUD sweep', () => {
  const w = src('scenes/world.js');
  const at = w.indexOf('onQuestEnded: (q) => {');
  assert.ok(at > 0, 'the escort sweep is no longer the only quest-end consumer');
  const arm = w.slice(at, at + 900);
  assert.match(arm, /guildInitiationQuestEnded\(activeMemberships\(playerEntity\), q\?\.questName \?\? '',\s*\n\s*!!q\?\.questSuccess,/,
    'success and name come off the quest, and the book is the vampire-aware one');
  assert.ok(arm.indexOf('guildInitiationQuestEnded(') < arm.indexOf('escortQuestEnded(q)'),
    'GuildManager is constructed long before the HUD, so it listens first');
});

// ── F98 / F99 ─────────────────────────────────────────────────────

const finishArm = (marker) => {
  const a = src('scenes/arrestFlow.js');
  const at = a.indexOf(marker);
  assert.ok(at > 0, `arm not found: ${marker}`);
  return a.slice(at, a.indexOf('release();', at) + 'release();'.length);
};

test('F98: banishment, prison and the zero-day release all refill vitals', () => {
  // :276 ("Refill player vitals after banishment, otherwise player
  // left with 1HP outside city gates"), :478 (UpdatePrisonScreen when
  // daysInPrisonLeft hits 0), :249 and :347 (the two zero-day arms).
  // Surrender forces health to 1, so each of these walked the player
  // back outside on exactly 1 HP.
  for (const marker of ["if (result.outcome === 'banished')", "if (result.outcome === 'prison')"]) {
    assert.match(finishArm(marker), /fillVitalSigns\(playerEntity\);/, marker);
  }
  const a = src('scenes/arrestFlow.js');
  const tail = a.slice(a.indexOf('showed 8055 TWICE on the failed-defense path.'));
  assert.match(tail.slice(0, 600), /fillVitalSigns\(playerEntity\);\n\s*release\(\);/,
    "the 'released' tail covers both DFU zero-day arms");
});

test('F98: the EXECUTION is the one exit DFU does not refill', () => {
  const arm = finishArm("if (result.outcome === 'executed')");
  assert.equal(/fillVitalSigns/.test(arm), false,
    'state 5 (:280-291) has no FillVitalSigns - a corpse is not topped up');
  // ...and the refill is therefore NOT inside release(), which every
  // arm including the execution funnels through.
  const a = src('scenes/arrestFlow.js');
  // PIN MOVED (Road to 1:1, a3): release() took ReleaseFromPrison's
  // last two lines and with them a parameter - `repositionPlayer` is
  // set by every arm EXCEPT the guild rescue (:191-194), so the door is
  // `release({ reposition = true })`. The finding this pins is
  // unchanged: no FillVitalSigns inside it.
  const rel = a.slice(a.indexOf('  function release({ reposition = true } = {}) {'));
  assert.equal(/fillVitalSigns/.test(rel.slice(0, 300)), false);
  assert.ok(rel.includes("// the port's own floor, not DFU's"),
    'ReleaseFromPrison (:482-490) never touches health, so the clamp stays the port\'s own');
});

test('F99: banishment sets bit 1 and execution bit 2, on the COURT\'S region', () => {
  const banished = finishArm("if (result.outcome === 'banished')");
  assert.match(banished, /severePunishment\(SEVERE_PUNISHMENT_BANISHED\);/);
  assert.match(finishArm("if (result.outcome === 'executed')"), /severePunishment\(SEVERE_PUNISHMENT_EXECUTED\);/);
  assert.equal(SEVERE_PUNISHMENT_BANISHED, 1);
  assert.equal(SEVERE_PUNISHMENT_EXECUTED, 2);
  const a = src('scenes/arrestFlow.js');
  const fn = a.slice(a.indexOf('  function severePunishment(bit) {'));
  // PIN MOVED DELIBERATELY, AUDIT-39r (R0): this used to demand the RAW
  // `regionConditions?.[regionIndex]`, which cemented a merge collision.
  // #21 (world-legal-talk) landed the region() thunk in the same wave and
  // converted every other consumer; this one write, landed here, kept the
  // parameter - so under the streaming host (world.js passes a getter) the
  // store was keyed by a Function and both bits silently no-oped. DFU reads
  // the index live too (DaggerfallCourtWindow.cs:118), so region() IS the
  // law, and the old spelling would have failed the fix.
  assert.match(fn.slice(0, 420), /playerEntity\.regionConditions\?\.\[region\(\)\]/,
    'DFU writes RegionData[regionIndex] - the region the court sits in, read live');
  assert.match(fn.slice(0, 420), /if \(r\) r\.severePunishmentFlags \|= bit;/,
    'an OR into the field, never an assignment - the two bits share it');
  // the FLAGGED marker that licensed the gap is gone: the consumer
  // (encounters.passiveGuardSpawns) has been live for slices.
  assert.equal(a.includes('SeverePunishmentFlags |= 1 consequences pend (FLAGGED)'), false);
});

test('F99 (AUDIT-39r): the bit lands in the region the GETTER host names', () => {
  // The source pin above cannot see the host contract, and the raw
  // parameter read the same in it. This drives the arm end to end under
  // world.js's shape - `regionIndex` is a thunk - and would have written
  // nothing at all before the fix: regionConditions[<function>] is
  // undefined, so `if (r)` is false and banishment cost nothing.
  let region = 3;
  const player = {
    name: 'Mack', health: 1, maxHealth: 40,
    crimeCommitted: CRIMES.Murder, haveShownSurrenderDialogue: true,
    // legalRep < 0 opens startCourt's thresholds; roll 0 fails the
    // FIRST one, which is punishmentType 0 - Banishment.
    legalRep: { 12: -50 },
    regionConditions: { 3: { severePunishmentFlags: 0 }, 12: { severePunishmentFlags: 0 } },
  };
  let win = null;
  const flow = createArrestFlow({
    townTalk: { texts: () => null, showOverlay: (w) => { win = w; } },
    playerEntity: player,
    regionIndex: () => region,
    rolls: () => 0,
    guildRankOf: () => null,            // no guild rescue arms
    advanceDays: () => {}, advanceMinutes: () => {},
  });

  region = 12;                          // the court sits where the player IS
  flow.startCourtFlow();
  win.input('KeyG');                    // guilty plea -> punishmentType 0 -> banished

  assert.equal(player.regionConditions[12].severePunishmentFlags, SEVERE_PUNISHMENT_BANISHED,
    'PlayerEntity.cs:506-511 rolls the 10% Criminal_Conspiracy spawn off this bit, for ever');
  assert.equal(player.regionConditions[3].severePunishmentFlags, 0,
    'and never against the province the session booted in');
});

// ── F100 ──────────────────────────────────────────────────────────

/** A purse of `coins` plus one letter of credit worth `letter`. */
const purse = (coins, letter = 0) => ({
  level: 1,
  items: [
    { group: 'Currency', stackCount: coins },
    ...(letter ? [{ templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: letter }] : []),
  ],
  stats: { personality: 50 },
});

test('F100: all three guild-service gates are GetGoldAmount - letters are tender', () => {
  // PlayerEntity.cs:1313-1316 `goldPieces + items.GetCreditAmount()`,
  // read by Training.cs:79, CureDisease.cs:122 and Donation.cs:60 -
  // and all three then pay through DeductGoldAmount, which the port's
  // deductGold already mirrors. Gating on coins made the gate and the
  // payment disagree.
  const membership = { rank: 0 };
  const priced = canAffordTraining(purse(100000), membership);
  assert.equal(priced, true, 'a fat purse can always train (guards the fixture, not the law)');
  assert.equal(canAffordTraining(purse(0), membership), false);
  assert.equal(canAffordTraining(purse(0, 100000), membership), true,
    'a letter of credit pays for training');

  const store = { dict: new Map() };
  assert.equal(donate(purse(10, 5000), store, 26, 400, () => 0.99).kind, 'thanks',
    'a letter of credit pays a donation the purse cannot');
  assert.equal(donate(purse(10), store, 26, 400, () => 0.99).kind, 'tooGenerous');

  assert.equal(payForCure(purse(10, 5000), 400).kind, 'cured');
  assert.equal(payForCure(purse(10), 400).kind, 'notEnoughGold');
});

test('F100: the coins-only reader is gone from the service module', () => {
  const g = src('systems/guildServiceActions.js');
  assert.equal(/\bgoldAmount\(/.test(g), false,
    'goldAmount is DFU\'s goldPieces alone; every gate here is GetGoldAmount');
  assert.match(g, /import \{ totalGoldAmount, deductGold \} from '\.\/court\.js';/);
});

// ── F101 / F115 ───────────────────────────────────────────────────

test('F101: a knight with free tavern rooms pays no inn leg of the fare', () => {
  // TravelTimeCalculator.cs:159-168. Six days of inn nights is
  // 5 * (144/24) + 5 = 35 pieces; the perk zeroes the whole term and
  // leaves the ocean charge alone.
  assert.equal(calculateTripCost(8640, 0, { sleepModeInn: true }).piecesCost, 35);
  assert.equal(calculateTripCost(8640, 0, { sleepModeInn: true, freeTavernRooms: true }).piecesCost, 0);
  const ship = { sleepModeInn: true, travelShip: true, hasShip: false, freeTavernRooms: true };
  assert.equal(calculateTripCost(8640, 48, ship).totalCost, 75,
    'the 25-per-24-ocean-pixel charter is not the tavern\'s and survives the perk');
});

test('F101/F115: both fast-travel callers now supply the perk', () => {
  const pop = src('ui/travelPopUp.js');
  const cost = pop.indexOf('calculateTripCost(');
  assert.ok(cost > 0);
  assert.match(pop.slice(cost, cost + 500), /freeTavernRooms: this\.freeTavernRooms\(\),/);
  const ow = src('ui/overworldMap.js');
  const owCost = ow.indexOf('const cost = calculateTripCost(');
  assert.match(ow.slice(owCost, owCost + 400), /freeTavernRooms: !!this\.deps\.freeTavernRooms\?\.\(\),/,
    'the enhanced skin bills the same fare as the native popup');
  // the native window is opened by travelMapWindow, so the hook has to
  // ride the popup's own dep bag too
  assert.match(src('ui/travelMapWindow.js'), /freeTavernRooms: this\.deps\.freeTavernRooms,/);
  // and the host answers it with the KnightlyOrder read, the one
  // hasShip's FreeShipTravel arm already makes
  const w = src('scenes/world.js');
  const hook = w.slice(w.indexOf('      freeTavernRooms: () => {'));
  assert.match(hook.slice(0, 800), /joinedGuildOfGroup\(activeMemberships\(playerEntity\), GUILD_GROUPS\.KnightlyOrder\)/);
  assert.match(hook.slice(0, 800), /orderRegion: townTalk\.factionDict\?\.get\(order\.factionId\)\?\.region \?\? null/,
    'the home-region half of the perk needs the order\'s own faction region');
  // the comment that licensed the gap is retired
  assert.equal(src('systems/travel.js').includes('false until the guild perk wires'), false);
});

// ── F114 ──────────────────────────────────────────────────────────

test('F114: aboard an owned ship, travel reckons from the BOARDING pixel', () => {
  // TransportManager.IsOnShip (:79-84) = a remembered boarding AND
  // standing on GetShipCoords(); DaggerfallBankManager's two moorings
  // are (2,2) and (5,5), open ocean either way, so the live pixel
  // would price a mid-map city as a couple of hundred ocean pixels.
  const owner = { ownedShip: 0 };   // ShipType.Small, moored at (2,2)
  const boarded = { mapPixel: { x: 210, y: 210 }, pos: [0, 0, 0], yaw: 0 };
  assert.deepEqual(playerTravelPosition(owner, boarded, { x: 2, y: 2 }), { x: 210, y: 210 });
  // ...and off the ship's pixel the memory is stale: IsOnShip is false,
  // so a player who boarded, saved and loaded elsewhere travels from
  // where they stand. DFU's behaviour, kept.
  assert.deepEqual(playerTravelPosition(owner, boarded, { x: 40, y: 60 }), { x: 40, y: 60 });
  // no boarding, no ship, no memory - all the same live pixel
  assert.deepEqual(playerTravelPosition(owner, null, { x: 2, y: 2 }), { x: 2, y: 2 });
  assert.deepEqual(playerTravelPosition({}, boarded, { x: 2, y: 2 }), { x: 2, y: 2 },
    'GetShipCoords() is null without a ship, so IsOnShip cannot be true');
});

test('F114: the host routes the travel map AND the quest clock through the origin', () => {
  const w = src('scenes/world.js');
  assert.match(w, /function playerTravelOrigin\(\) \{\n\s*return playerTravelPosition\(playerEntity, playerEntity\.boardShipPosition \?\? null, playerTravelPixel\(\)\);/);
  const map = w.slice(w.indexOf('function buildTravelMapWindow'));
  assert.match(map.slice(0, 900), /getPlayerPixel: playerTravelOrigin,/,
    'DFU\'s travel map reads GetPlayerTravelPosition for the crosshair (:864), the region (:1611) and the journey');
  assert.match(w, /playerPixel: \(\) => playerTravelOrigin\(\),/,
    'the quest bridge declares this hook as GetPlayerTravelPosition "incl. its on-ship arm"');
  // playerTravelPixel stays PlayerGPS itself - loot piles, the climate
  // read and the location index all want the live pixel.
  assert.ok(w.includes('function playerTravelPixel() {'));
  assert.match(src('systems/quest/clock.js'), /calculateTravelTime\(world\.playerPixel\(\), endPos,/);
});
