// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - BOARDING, the audit's fourth slice
// (bible/03-World/Naval-Combat.md "Boarding"): Warm Ashes' raid on the open sea, the pirate flagship's raid that could
// hang for ever, a raid let go of ending with its boarders, a crewed boat's hands in every repel - the laws, the real
// quest parser, the world host's own code lifted and run, and the host through real frames over Come Sail Away's real
// pool (test/navalSea.mjs).
import { byClass } from './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { sea } from './navalSea.mjs';
import { raidQuestWon, raidQuestRetreated, raidQuestOf, handsOf, HAND, GRAPPLE_S, ABANDON_RANGE, SURRENDER_SHARE, WA_SMALLRAID, WA_ATTACK_PIRATE, RAID_WIN_TASKS, RAID_RETREAT_TASKS } from '../src/systems/naval/navalBoarding.js';
import { WA_RAID_QUESTS, WA_SEA_REGION, LeaveShip } from '../src/systems/warmAshesShips.js';
import { SPARE_S } from '../src/systems/naval/navalAI.js';
import { crownOf, classById } from '../src/systems/naval/navalShips.js';
import { RAIDER_SHEER_M, STRUCK_GRACE_S, DECK_SPOTS, SWIMMER } from '../src/scenes/navalHost.js';
import { navalHudText, drawNavalHud, destroyNavalHud } from '../src/ui/navalHud.js';
import { choiceOffer, choiceEffect, CHOICES, PAPERS_NOTORIETY, PIRATE_PAPERS_TITLE } from '../src/systems/naval/navalPlunder.js';
import { SHIP_STATES, STRUCK_AT } from '../src/systems/naval/navalDamage.js';
import { navalHitData, NAVAL_HIT_MAX } from '../src/systems/naval/navalWire.js';
import { NAVAL_CLASSIC } from '../src/systems/naval/navalSounds.js';
import { NOTORIETY } from '../src/systems/naval/navalLaw.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { Place } from '../src/systems/quest/place.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const WORLD = read('src/scenes/world.js');
const questFile = (name) => read(`vendor/warm-ashes-ships/Quests/${name}.txt`);
/** A function declaration of world.js's, lifted whole (the suites' own way - test/ows3_raiders.test.js). */
const lift = (name) => {
  const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(WORLD);
  assert.ok(m, `${name} lifted`);
  return m[0];
};

/** The player's boat wrecked where a pirate alongside boards her at once (nav_h's own save). */
const WRECKED = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };
/** A raid quest the host starts: its tasks the machine's (a task's trigger value), set by the test. */
const raidQuest = (uid) => (name) => ({ uid, name, tasks: new Map() });
const trip = (quest, task) => quest.tasks.set(task, { getTriggerValue: () => true });
/** A ship stood where a test wants her, built and settled a frame. */
function place(h, classId, pos, yaw = 0) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw });
  const e = h.host._sea.get(id);
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}
/** A pirate of `classId` alongside my wrecked boat, grappled and the fight begun - with the raid a quest or refused. */
async function boarded(classId, o = {}) {
  const h = await sea({ hull: o.hull ?? 2, save: WRECKED, raidQuest: o.quest ? raidQuest(o.quest) : undefined });
  const p = place(h, classId, [16, 0, 0], 0);
  h.run(0.5);
  assert.equal(h.host.boarding?.kind, 'repel', 'a wrecked boat is boarded at once');
  h.run(GRAPPLE_S + 0.2);
  return { h, p, quest: h.host.boarding?.quest ?? null };
}

// ── the laws ────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 (B5) the raids by the names the quest machine gives them: each raid file\'s own `Quest:` header (the parser names a quest by it) is one "one raid at a time" reads - the pirate attack\'s file WAQ_SHIP_ATTACK_PIRATE.txt names itself WAQ_SHIP_PIRATEATTACK, and listed by its file\'s name its raid was never read as running (mutants: the flagship\'s file name listed)', () => {
  const header = (name) => /^Quest:\s*(\S+)/.exec(questFile(name))?.[1];
  assert.equal(header(WA_ATTACK_PIRATE), 'WAQ_SHIP_PIRATEATTACK', 'the file and its header differ');
  for (const file of [WA_SMALLRAID, WA_ATTACK_PIRATE]) assert.ok(WA_RAID_QUESTS.includes(header(file)), `${file} runs as ${header(file)}`);
  assert.equal(raidQuestOf(classById('pirateFlagship')), WA_ATTACK_PIRATE, 'the flagship starts the pirate attack by its file');
  assert.equal(raidQuestOf(classById('pirateBrig')), WA_SMALLRAID);
  assert.equal(WA_RAID_QUESTS.length, 2);
});

test('AUDIT NAV1 (B5) a raid GIVEN UP: the pirate attack\'s `_retreat_` - started with its second wave, it clears the waves and stops the clock that would end it - triggered and not won; won, never given up; the small raid never starts its clock (mutants: the retreat unread, a won raid given up)', () => {
  const q = { tasks: new Map() };
  assert.deepEqual(RAID_RETREAT_TASKS, ['retreat']);
  assert.equal(raidQuestRetreated(q), false);
  trip(q, 'retreat');
  assert.equal(raidQuestRetreated(q), true);
  trip(q, 'winner');
  assert.equal(raidQuestWon(q), true);
  assert.equal(raidQuestRetreated(q), false, 'its leader down first: won');
  assert.equal(raidQuestRetreated(null), false);
  assert.ok(RAID_WIN_TASKS.includes('winner'));
  const small = questFile(WA_SMALLRAID);
  assert.match(small, /Clock _retreat_ 1:00/);
  assert.doesNotMatch(small, /start timer _retreat_/, 'declared, never started');
  assert.match(questFile(WA_ATTACK_PIRATE), /start timer _retreat_\r?\n\s*stop timer _cooldown_/, 'the attack\'s retreat stops its own end');
});

// ── the raid at sea (B2) ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 (B2) the real quest parser: both of Warm Ashes\' raids FAIL in the sea\'s region (31: no house for `_KnightlyGuard_`, message 1013\'s "on your way to ..."), and parse in a crown\'s region with its houses - so a raid started at sea is parsed in the crown of these waters (mutants: none - this is the law the host\'s pin answers)', () => {
  const T = new URL('vendor/dfu-quests/Tables/', root);
  loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
  const faction = (id) => ({ id, parent: 0, type: id === 844 ? 10 : id === 450 ? 9 : 15, name: `F${id}`, region: 17, rep: 0, face: 0, race: 0, flat1: 0, flat2: 0, sgroup: 0, ggroup: 0, minf: 0, maxf: 0, vam: 0, rank: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: [] });
  const worldAt = (region) => {
    const atSea = region === WA_SEA_REGION;
    // the sea's region: the Crux (a dungeon) and the two "Your Ship" moorings (Testing.md road_maps_record); a crown's: a town
    const mapTable = atSea
      ? [{ locationType: LOCATION_TYPES.DungeonLabyrinth, mapId: 1001 }, { locationType: LOCATION_TYPES.HomeYourShips, mapId: 1050578 }, { locationType: LOCATION_TYPES.HomeYourShips, mapId: 2102157 }]
      : [{ locationType: LOCATION_TYPES.TownCity ?? 0, mapId: 5 }];
    const loc = (i) => ({
      loaded: true, name: atSea ? (i === 0 ? 'Mantellan Crux' : 'Your Ship') : 'Somewhere', regionName: atSea ? 'High Rock sea coast' : 'Daggerfall', regionIndex: region, locationIndex: i,
      mapTableData: { mapId: mapTable[i].mapId, locationType: mapTable[i].locationType },
      exterior: { exteriorData: { width: 1, height: 1, locationId: 100 + i }, buildings: atSea ? [{ buildingType: 24, factionId: 0, nameSeed: 1 }] : [{ buildingType: 17, factionId: 0, nameSeed: 1 }] },
    });
    return {
      currentRegionIndex: () => region, currentRegionName: () => (atSea ? 'High Rock sea coast' : 'Daggerfall'),
      currentRegionPeople: () => (atSea ? -1 : 201), currentRegionFaction: () => (atSea ? -1 : 201), currentRegionCourt: () => (atSea ? -1 : 201), currentRegionRace: () => 0,
      findFactionsOfType: () => [faction(201)], currentLocation: () => null, currentLocationIndex: () => -1, playerVampireClan: () => -1, currentRegionVampireClan: () => -1,
      getFactionData: (id) => (id > 0 ? faction(id) : null),
      maps: { getRegion: () => ({ name: atSea ? 'High Rock sea coast' : 'Daggerfall', locationCount: mapTable.length, mapTable }), getLocation: (_r, i) => loc(i), getRmbBlockName: () => (atSea ? 'SHIPAA00.RMB' : 'HOUSE.RMB') },
      getBlock: () => null, createFoeGameObjects: (foe, count) => Array.from({ length: count }, () => ({ foe })), tryPlaceFoe: () => true,
    };
  };
  // the block walk is data plumbing (RMB blocks, markers): stood in by its answer - a quest site where a house stands
  const walk = Place.prototype._collectQuestSitesOfBuildingType;
  Place.prototype._collectQuestSitesOfBuildingType = function (_world, location) {
    const house = (location.exterior?.buildings ?? []).find((b) => b.buildingType >= 17 && b.buildingType <= 22);
    return house ? [{ questUID: 0, siteType: 1, mapId: location.mapTableData.mapId, locationId: 1, regionIndex: location.regionIndex, regionName: location.regionName, locationName: location.name, buildingKey: 1, buildingName: 'A house', magicNumberIndex: 0, questSpawnMarkers: [{}], questItemMarkers: [], selectedMarker: { targetResources: null } }] : [];
  };
  const warn = console.warn;
  try {
    console.warn = () => {};
    for (const file of [WA_SMALLRAID, WA_ATTACK_PIRATE]) {
      const parse = (region) => {
        const m = new QuestMachine({ nowSeconds: () => 43200, world: worldAt(region) });
        m.registerAction(new LeaveShip(null));
        return m.parseQuestForLists(questFile(file).split(/\r?\n/), 0, { rolls: () => 0.3 });
      };
      assert.equal(parse(WA_SEA_REGION), null, `${file}: no raid in the sea's region`);
      const q = parse(crownOf(100, 100, null, 17).region);
      assert.ok(q, `${file}: parsed in the crown's region`);
      assert.ok(WA_RAID_QUESTS.includes(q.questName), `${file} runs as ${q.questName}`);
    }
  } finally {
    console.warn = warn;
    Place.prototype._collectQuestSitesOfBuildingType = walk;
  }
});

test('AUDIT NAV1 (B2) the world host, run: a raid parsed at sea reads the crown of these waters\' region for the length of its parse alone - on land the player\'s own, as the mod parses it on a voyage\'s arrival; the pin let go even when the parse throws; both starters parse through it, the pin declared before townTalk\'s load can reach the region (mutants: the pin unread, the pin kept, the sea unasked, a starter around it)', () => {
  const d = {
    region: WA_SEA_REGION, px: { x: 820, y: 300 }, seen: [], boom: false,
    maps: { getRegionIndexAt: () => d.region }, playerTravelPixel: () => d.px, WA_SEA_REGION, navalCrownOf: crownOf,
    navalCapitals: () => [{ region: 17, x: 200, y: 200 }, { region: 23, x: 800, y: 290 }, { region: 20, x: 300, y: 450 }],
  };
  const h = new Function('d', `const { maps, playerTravelPixel, WA_SEA_REGION, navalCrownOf, navalCapitals } = d;
    let _questRegionPin = null;
    const questBridge = { questLists: { getQuest: (name, faction) => { d.seen.push([name, faction, _questRegionIndex()]); if (d.boom) throw new Error('parse'); return { name }; } } };
    ${lift('_questRegionIndex')}${lift('waRaidQuest')}
    return { waRaidQuest, region: () => _questRegionIndex() };`)(d);
  assert.deepEqual(h.waRaidQuest(WA_SMALLRAID), { name: WA_SMALLRAID });
  assert.deepEqual(d.seen, [[WA_SMALLRAID, 0, 23]], 'at sea by Wayrest: parsed in Wayrest\'s region');
  assert.equal(h.region(), WA_SEA_REGION, 'and the sea\'s again once parsed');
  d.region = 17; d.seen.length = 0;
  h.waRaidQuest(WA_ATTACK_PIRATE, 5);
  assert.deepEqual(d.seen, [[WA_ATTACK_PIRATE, 5, 17]], 'on land: the region it is in');
  d.region = WA_SEA_REGION; d.boom = true;
  assert.throws(() => h.waRaidQuest(WA_SMALLRAID));
  assert.equal(h.region(), WA_SEA_REGION, 'a throw lets the pin go');
  assert.match(WORLD, /const q = waRaidQuest\(name\);/, 'the sea fight\'s boarders');
  assert.match(WORLD, /getQuest: \(name, factionId\) => waRaidQuest\(name, factionId\),/, 'Warm Ashes\' own coroutine (an Overworld raider alongside)');
  assert.ok(WORLD.indexOf('let _questRegionPin = null;') < WORLD.indexOf('const townTalk = createTownTalk('), 'declared before townTalk can read the region');
});

test('AUDIT NAV1 (B2) a crewed boat\'s hands stand in EVERY repel - Warm Ashes\' raid refused (one at a time, or no quest to be had) and the arc\'s own boarders come over, her hands beside the player; an uncrewed boat none; a raid its own `_ally_` (mutants: the fallback\'s hands never stood)', async () => {
  const { h } = await boarded('pirateBrig');
  assert.deepEqual(h.log.raids, [WA_SMALLRAID], 'the raid asked, and refused');
  const allies = h.log.foes.filter((f) => f.side === 'ally');
  assert.equal(allies.length, handsOf(24, true), 'her hands');
  assert.ok(allies.length > 0 && allies.every((f) => f.mobile === HAND));
  assert.ok(h.log.foes.some((f) => f.side === 'enemy'), 'against the boarders');
  const bare = await boarded('pirateBrig', { hull: 1 });
  assert.equal(bare.h.boat.crewed, false);
  assert.equal(bare.h.log.foes.filter((f) => f.side === 'ally').length, 0, 'no crew, no hands');
  const raid = await boarded('pirateBrig', { quest: 901 });
  assert.ok(raid.quest, 'the raid is the fight');
  assert.equal(raid.h.log.foes.length, 0, 'its own foes, its own allies');
});

// ── the raid's end (B5, B6, B7) ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 (B5) a raid WON the moment its winning task fires - the flagship\'s leader down, never waiting on the quest\'s own end twenty-five seconds on; its "Leave Ship", when it comes, still the sea fight\'s (mutants: the win waited on)', async () => {
  const { h, p, quest } = await boarded('pirateFlagship', { quest: 902 });
  assert.equal(h.log.raids.at(-1), WA_ATTACK_PIRATE);
  h.run(1);
  assert.ok(h.host.boarding, 'fighting');
  trip(quest, 'winner');
  h.run(0.2);
  assert.equal(h.host.boarding, null, 'won');
  assert.ok(h.log.mid.includes('The boarders are thrown back!'));
  assert.equal(p.ship.boarded, false);
  assert.deepEqual(h.log.ended, [], 'a won raid ends itself');
  assert.equal(h.host.leaveShipGate(quest), 'naval');
});

test('AUDIT NAV1 (B5, B6, B7) a raid GIVEN UP - the flagship\'s retreat sounded - CASTS OFF: its quest ended with its living boarders withdrawn (never a quest that holds every other boarding off, nor its waves following the player), she hauls off RAIDER_SHEER_M away and leaves me be SPARE_S - never grappling again the moment she lets go, my boat still a wreck beside her (mutants: the retreat unread, the quest left running, the boarders left, grappling again, the sheer off)', async () => {
  const { h, p, quest } = await boarded('pirateFlagship', { quest: 903 });
  trip(quest, 'retreat');
  h.run(0.2);
  assert.equal(h.host.boarding, null);
  assert.deepEqual(h.log.ended, [[quest, { withdraw: true }]], 'the raid ends, its boarders withdrawn');
  assert.equal(p.ship.boarded, false);
  assert.ok(p.ship.spare.get('local') >= p.ship.clock + SPARE_S - 1, 'she leaves me be');
  const wp = p.ship.waypoint;
  assert.ok(wp, 'a waypoint away');
  assert.ok(Math.abs(Math.hypot(wp[0] - p.ship.pos[0], wp[1] - p.ship.pos[2]) - RAIDER_SHEER_M) < 60, 'RAIDER_SHEER_M off');
  assert.ok(wp[0] - p.ship.pos[0] > 0, 'straight away from me');
  assert.ok(h.log.say.some((t) => /fall back to .+ and cast off/.test(t)));
  assert.deepEqual(h.host.getSaveData().raids, [], 'no raid of mine left for a load to answer');
  h.run(20);
  assert.equal(h.host.boarding, null, 'never grappled again');
});

test('AUDIT NAV1 (B6, B7) a raid\'s own hour run out, my deck left to them, the sea emptied: each casts off the same way - the hour\'s quest already over, the deck\'s and the sea\'s ended with its boarders withdrawn; "You leave your deck to them" said for my own deck, never "her crew stands down" (mutants: lying alongside to grapple again, a quest left running on the swim, a quest outliving the sea)', async () => {
  const hour = await boarded('pirateBrig', { quest: 904 });
  hour.h.host.raidEnded(hour.quest);
  assert.equal(hour.h.host.boarding, null);
  assert.deepEqual(hour.h.log.ended, [[hour.quest, { withdraw: true }]], 'its boarders withdrawn (the world host ends no quest already over)');
  assert.ok(hour.p.ship.spare.get('local') > hour.p.ship.clock, 'cast off, not lying alongside');
  const swim = await boarded('pirateBrig', { quest: 905 });
  swim.h.view.feet = [0, 0, -(ABANDON_RANGE + 40)];
  swim.h.run(0.3);
  assert.equal(swim.h.host.boarding, null);
  assert.deepEqual(swim.h.log.ended, [[swim.quest, { withdraw: true }]]);
  assert.ok(swim.h.log.say.some((t) => t.startsWith('You leave your deck to them.')));
  assert.ok(!swim.h.log.say.some((t) => /stands down/.test(t)));
  assert.ok(swim.p.ship.spare.get('local') > swim.p.ship.clock);
  const gone = await boarded('pirateBrig', { quest: 906 });
  gone.h.host.clear();
  assert.deepEqual(gone.h.log.ended, [[gone.quest, { withdraw: true }]], 'the sea emptied under the raid');
  assert.deepEqual(gone.h.host.getSaveData().raids, []);
});

test('AUDIT NAV1 (B6) the world host\'s endRaid, run: its living boarders withdrawn (the quest\'s own foes, alive), then the quest tombstoned through the machine; a quest already over only withdrawn (mutants: the dead or another quest\'s foes removed, a tombstoned quest ended twice)', () => {
  const m = /\n {6}endRaid: (\(quest, \{ withdraw = false \} = \{\}\) => \{\n[\s\S]*?\n {6}\}),\n/.exec(WORLD);
  assert.ok(m, 'endRaid lifted');
  const mine = (uid, dead = false) => ({ dead, questBehaviour: { questUID: uid } });
  const foes = [mine(7), mine(7, true), mine(8), { dead: false }, mine(7)];
  const removed = [], ended = [];
  const endRaid = new Function('d', `const { exteriorFoes, questBridge } = d; return ${m[1]};`)({
    exteriorFoes: { foes, removeFoe: (f) => { removed.push(f); foes.splice(foes.indexOf(f), 1); } },
    questBridge: { machine: { tombstoneQuest: (q) => { ended.push(q); q.questTombstoned = true; } } },
  });
  const q = { uid: 7, questTombstoned: false };
  endRaid(q, { withdraw: true });
  assert.equal(removed.length, 2, 'the two living boarders of this raid');
  assert.ok(removed.every((f) => f.questBehaviour.questUID === 7 && !f.dead));
  assert.deepEqual(ended, [q]);
  endRaid(q, { withdraw: true });
  assert.deepEqual(ended, [q], 'over already: not ended again');
  const r = { uid: 8, questTombstoned: false };
  endRaid(r);
  assert.equal(foes.some((f) => f.questBehaviour?.questUID === 8), true, 'no withdraw asked: its boarders stand');
  assert.deepEqual(ended, [q, r]);
});

// ── the prize, the fire, the founder (B3, B4) ──────────────────────────────────────────────────────────────────

/** A blow on a ship I stand, landed through the host's own strike - `from` the striker ('local': mine). */
/** A peer's blow - PIN MOVED (TOUGHER-SHIPS): one past a hit's most (navalWire.js NAVAL_HIT_MAX, a broadside's worth) lands
 *  as several, her fire and her men with the first; a toughened hull outweighs one hit. The pieces after one that strikes
 *  her are the same volley's (STRUCK_GRACE_S: floored at 1) - a blow meant to take her from afloat straight under is
 *  two blows a grace apart, never one. */
const blow = (h, e, from, o) => {
  let left = Math.max(0, o.hull ?? 0), first = true;
  do {
    const hull = Math.min(left, NAVAL_HIT_MAX);
    h.host.applyPeerHit(from, navalHitData('local', first ? { n: e.n, ...o, hull } : { n: e.n, hull, zone: o.zone }));
    left -= hull; first = false;
  } while (left > 0);
};
/** A merchant struck alongside, boarded from my helm and the fight begun. */
async function boarding() {
  const h = await sea({ hull: 2 });
  const e = place(h, 'merchantGalleon', [7.4 + 7.4 + 12, 0, 0], 0);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true, 'the grapples');
  h.run(GRAPPLE_S + 0.3);
  assert.equal(h.host.boarding?.phase, 'fight');
  return { h, e, enemies: h.log.foes.filter((f) => f.side === 'enemy') };
}

test('AUDIT NAV1 (B3) her crew SURRENDERS: her captain and SURRENDER_SHARE of her men down, the living rest throw down their arms - stood down before her window opens over them, never swinging at a prize screen - and stand on her deck, not spirited away; her dead never asked (mutants: the survivors left hostile)', async () => {
  const { h, enemies } = await boarding();
  const fall = Math.ceil(enemies.length * SURRENDER_SHARE);   // her captain first among them
  for (const f of enemies.slice(0, fall)) f.dead = true;
  let atWindow = null;
  const open = h.deps.board.openPlunder;
  h.deps.board.openPlunder = (m) => { atWindow = enemies.map((f) => !!f.yielded); return open(m); };
  h.run(0.2);
  assert.equal(h.host.boarding, null, 'taken');
  assert.ok(fall < enemies.length, 'some still stood');
  assert.deepEqual(atWindow, enemies.map((_, i) => i >= fall), 'the living yielded before the window; the dead never asked');
  assert.ok(h.log.say.includes('The rest of her crew throw down their arms.'));
  assert.ok(!enemies.slice(fall).some((f) => h.log.removed.includes(f)), 'standing on her deck');
});

test('AUDIT NAV1 (B4) a ship the FIRE finishes is announced and reckoned as a ball\'s - her colours struck with her bell, then going down with what floats free of her and the law\'s due to whoever set her afire; another\'s fire never charged to me (mutants: the fire\'s changes unannounced, the setter unkept, charged to no one)', async () => {
  const h = await sea({ hull: 2 });
  const e = place(h, 'merchantGalleon', [300, 0, 0], 0);
  assert.equal(e.id, `local:${e.n}`, 'a ship I stand');
  const d = e.ship.damage;
  blow(h, e, 'peer-x', { hull: Math.floor(d.hull - d.maxHull * STRUCK_AT - 6) });   // just above the struck line
  assert.equal(d.state, SHIP_STATES.afloat);
  blow(h, e, 'local', { fire: 'barrel' });   // my barrel sets her afire
  h.run(5);
  assert.equal(d.state, SHIP_STATES.struck, 'the fire struck her');
  assert.ok(h.log.say.includes(`${e.ship.names.name} strikes her colours!`), 'said');
  assert.ok(h.log.sounds.some(([k]) => k === NAVAL_CLASSIC.bell), 'her bell');
  assert.equal(d.fire, 0, 'struck: her fires put out');
  h.run(STRUCK_GRACE_S + 1);
  const crown = e.ship.names.crown ?? 'Wayrest';
  const before = h.host.notoriety.get(crown);
  blow(h, e, 'peer-x', { hull: Math.floor(d.hull - 6) });
  blow(h, e, 'local', { fire: 'barrel' });   // lit again - mine
  h.run(4);
  assert.equal(d.state, SHIP_STATES.sinking, 'the fire took her under');
  assert.ok(h.log.say.includes(`${e.ship.names.name} is going down!`));
  assert.ok(h.host._shots.floaters().some((f) => f.kind === 'flotsam'), 'what floats free of her');
  assert.equal(h.host.notoriety.get(crown), Math.min(NOTORIETY.max, before + NOTORIETY.sink), 'her sinking is mine: I set her afire');
  // another's fire: announced and floated, never charged to me
  const o = await sea({ hull: 2 });
  const f = place(o, 'merchantGalleon', [300, 0, 0], 0);
  blow(o, f, 'peer-x', { hull: Math.floor(f.ship.damage.hull - 6) });
  o.run(STRUCK_GRACE_S + 1);
  blow(o, f, 'peer-x', { fire: 'barrel' });
  const was = o.host.notoriety.get(f.ship.names.crown ?? 'Wayrest');
  o.run(4);
  assert.equal(f.ship.damage.state, SHIP_STATES.sinking);
  assert.ok(o.log.say.includes(`${f.ship.names.name} is going down!`));
  assert.equal(o.host.notoriety.get(f.ship.names.crown ?? 'Wayrest'), was, 'a peer\'s fire, not my crime');
});

test('AUDIT NAV1 (B4) a ship I BOARDED going down under the fight ends it: "Back to your ship!", her living men over the side, my hands home and me set back on my own deck; the grapple itself puts her fires out (mutants: the founder unheeded, the boarded fire unannounced, no way home, a burning deck grappled)', async () => {
  const { h, e, enemies } = await boarding();
  assert.equal(e.ship.damage.fire, 0, 'grappled: her fires fought');
  h.run(STRUCK_GRACE_S + 1);
  blow(h, e, 'peer-x', { hull: Math.floor(e.ship.damage.hull - 4) });
  blow(h, e, 'peer-x', { fire: 'barrel' });
  const placed = h.log.placed.length;
  h.run(3);
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking, 'her fire took her under, boarded');
  assert.equal(h.host.boarding, null, 'the fight is over');
  assert.ok(h.log.mid.includes(`${e.ship.names.name} is going down! Back to your ship!`));
  assert.ok(enemies.every((f) => h.log.removed.includes(f)), 'her men over the side');
  assert.equal(h.log.placed.length, placed + 1);
  assert.deepEqual(h.log.placed.at(-1), [[0, 5, 0], 0], 'back on my own deck');
  // the grapple on a burning prize: her fires put out as the hooks bite
  const g = await sea({ hull: 2 });
  const b = place(g, 'merchantGalleon', [7.4 + 7.4 + 12, 0, 0], 0);
  b.ship.damage.apply({ hull: Math.ceil(b.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  g.run(STRUCK_GRACE_S + 1);
  blow(g, b, 'peer-x', { fire: 'barrel' });
  assert.ok(b.ship.damage.fire > 0, 'burning');
  assert.equal(g.host.activate(), true);
  assert.equal(b.ship.damage.fire, 0, 'the grapple douses her');
});

test('AUDIT NAV1 (B4, B6) a raider\'s ship gone under her boarders: they fight on stranded, and her raid sends no more (never its waves round a player whose deck they hold) (mutants: the stranded raid left running)', async () => {
  const { h, p, quest } = await boarded('pirateBrig', { quest: 907 });
  h.host._sea.delete(p.id);   // she is gone (sunk and dropped)
  h.run(0.2);
  assert.equal(h.host.boarding, null);
  assert.deepEqual(h.log.ended, [[quest, { withdraw: false }]], 'her raid ends; her boarders stand');
  assert.deepEqual(h.host.getSaveData().raids, []);
});

test('AUDIT NAV1 (B3) the world host\'s stand-down, run: a boarder who yields is hostile no more where he stands (the quest system\'s own restrain), one still standing up yields as he arrives, and one who is gone never comes (mutants: the late one left hostile)', async () => {
  const pick = (re) => { const m = re.exec(WORLD); assert.ok(m, `${re} lifted`); return m[1]; };
  const spawnSrc = pick(/\n {2}const navalSpawnFoe = (\(mobile, feet, yaw, side, \{ name = null, team = null, boat = null, gender = null \} = \{\}\) => \{\n[\s\S]*?\n {2}\});\n/);
  const downSrc = pick(/\n {2}const navalStandDown = (\(handle\) => \{\n[\s\S]*?\n {2}\});\n/);
  let arrive = null;
  const removed = [], decked = [], asked = [];
  const d = { exteriorFoes: { spawnFoe: (m, feet, opts) => { asked.push(opts); return new Promise((r) => { arrive = r; }); }, removeFoe: (f) => removed.push(f) }, navalDeckBody: (f, b) => decked.push([f, b]) };
  const h = new Function('d', `const { exteriorFoes, navalDeckBody } = d; const navalStandDown = ${downSrc}; const navalSpawnFoe = ${spawnSrc}; return { navalSpawnFoe, navalStandDown };`)(d);
  const standing = { foe: { dead: false, ai: { isHostile: true } }, yielded: false };
  h.navalStandDown(standing);
  assert.equal(standing.foe.ai.isHostile, false, 'yields where he stands');
  const late = h.navalSpawnFoe(3, [0, 0, 0], 0, 'enemy');
  h.navalStandDown(late);
  const f = { dead: false, ai: { isHostile: true } };
  arrive(f);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(late.foe, f);
  assert.equal(f.ai.isHostile, false, 'yields as he arrives');
  assert.match(WORLD, /standDown: navalStandDown,/);
  // AUDIT NAV1 (B9): her captain by name - the target bar reads the entity's
  const named = h.navalSpawnFoe(7, [0, 0, 0], 0, 'enemy', { name: 'Captain Irna Vosk' });
  const cap = { dead: false, ai: { isHostile: true }, entity: { name: undefined } };
  arrive(cap);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(named.foe.entity.name, 'Captain Irna Vosk');
  // DECK-WALK: a muster stands as one crew, on the deck it stands on - an ally's crew is the player's own, no team of its own
  const hull = { hull: 4 };
  const crewman = h.navalSpawnFoe(9, [0, 0, 0], 0, 'enemy', { team: 'Pirates', boat: hull });
  assert.deepEqual([asked.at(-1).team, asked.at(-1).allied], ['Pirates', false], 'the muster\'s one crew');
  const man = { dead: false, ai: { isHostile: true }, entity: {} };
  arrive(man);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(crewman.foe, man);
  assert.deepEqual(decked.at(-1), [man, hull], 'on her deck');
  h.navalSpawnFoe(9, [0, 0, 0], 0, 'ally', { team: 'Pirates', boat: hull });
  assert.deepEqual([asked.at(-1).team, asked.at(-1).allied], [null, true], 'my crew: the player\'s side, no crew of its own');
});

// ── the fight's flow (B9-B14, the minors) ───────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 (B14) NO SAVE MID-FIGHT: a boarding under way, or the player on a ship of the sea\'s deck (a prize\'s among them), refuses a save - the sea is never a save\'s and the load set them over open water, the ship and her prize gone; my own deck, or the sea, saves; F9 and the pause window both ask it (mutants: the fight saved, her deck saved, a door around it)', async () => {
  const { h, e, enemies } = await boarding();
  assert.equal(h.host.saveRefused(), true, 'the fight');
  for (const f of enemies) f.dead = true;
  h.run(0.2);
  assert.equal(h.host.boarding, null, 'taken');
  const box = h.host._sea.get(e.id).boat && (await import('../src/scenes/navalHost.js')).hullBoxOf(e.boat, h.pool.models);
  h.view.feet = [box.c[0], box.c[1] + box.h[1], box.c[2]];   // on her deck
  assert.equal(h.host.saveRefused(), true, 'her deck, the prize window open over it');
  h.view.feet = [0, 0, -400];
  assert.equal(h.host.saveRefused(), false, 'away from her');
  h.host.setEnabled(false);
  assert.equal(h.host.saveRefused(), false, 'no sea');
  assert.match(WORLD, /if \(naval\?\.saveRefused\?\.\(\)\) \{ if \(!quiet\) townTalk\.say\('You cannot save now\.'\); return false; \}/, 'F9 and the checkpoints');
  assert.match(WORLD, /savingPrevented: \(\) => !!naval\?\.saveRefused\?\.\(\),/, 'the pause window greys its Save');
});

test('AUDIT NAV1 (B11) BACK AT THE HELM: her fate decided, "Leave her" pressed, or her going down under the fight - over my own rail and at my wheel (Come Sail Away\'s StartSailing); the back key and the scrim only shut her window, her deck still underfoot (mutants: the wheel never taken, Leave her a plain close)', async () => {
  const { h, enemies } = await boarding();
  for (const f of enemies) f.dead = true;
  h.run(0.2);
  const m = h.log.plunder.at(-1);
  assert.deepEqual(h.log.helm, [], 'on her deck while her window stands');
  m.leave();
  assert.deepEqual(h.log.helm, [h.boat], 'Leave her: my wheel');
  m.fate('adrift');
  assert.deepEqual(h.log.helm, [h.boat, h.boat], 'her fate decided: my wheel');
  assert.equal(h.runtime.sailing, true);
  assert.match(WORLD, /if \(reason === 'leave'\) model\.leave\?\.\(\);/, 'the door\'s Leave her reaches the model');
  assert.match(WORLD, /takeHelm: \(boat\) => \{ if \(boat && csaRuntime\) csaCall\(\(\) => csaRuntime\.StartSailing\(boat\)\); \},/);
});

test('AUDIT NAV1 (B10) THE DECK DEALT: a raid\'s waves take the boarded deck\'s DECK_SPOTS shuffled once and dealt round - never a spot a body holds (the world\'s occupancy asked); every spot held, the wave waits; a raid of mine whose fight is over is stood nowhere, never the open ground\'s ring; her muster and my hands each a spot of their own (mutants: a spot stacked, a held spot taken, the ring for a raid that is over)', async () => {
  const { h, quest } = await boarded('pirateBrig', { quest: 908 });
  const held = new Set();
  const key = (sp) => sp[0].join(',');
  const wave = [];
  for (let i = 0; i < 13; i++) { const sp = h.host.placeQuestFoe(quest, (x) => !held.has(key(x))); wave.push(key(sp)); held.add(key(sp)); }
  assert.equal(new Set(wave).size, 13, 'a wave of thirteen on thirteen spots');
  for (let i = 0; i < DECK_SPOTS - 13; i++) held.add(key(h.host.placeQuestFoe(quest, (x) => !held.has(key(x)))));
  assert.equal(held.size, DECK_SPOTS);
  assert.equal(h.host.placeQuestFoe(quest, (x) => !held.has(key(x))), false, 'every spot held: the wave waits');
  assert.equal(h.host.placeQuestFoe({ uid: 1 }), null, 'not a raid of mine');
  trip(quest, 'winner');
  h.run(0.2);
  assert.equal(h.host.placeQuestFoe(quest), false, 'its fight over: stood nowhere');
  // the arc's own boarding: every body its own spot
  const { h: b } = await boarding();
  const spots = b.log.foes.map((f) => f.pos.join(','));
  assert.equal(new Set(spots).size, spots.length, 'her muster and my hands apart');
  assert.match(WORLD, /const _deck = naval\?\.placeQuestFoe\(handle\.foe\?\.parentQuest \?\? null, \(s\) => !_held\(/);
  assert.match(WORLD, /if \(_deck === false\) return false;/);
  assert.match(WORLD, /holdSpotWhile\(collider, \{ x: _deck\[0\]\[0\], y: _deck\[0\]\[1\] \+ 0\.9, z: _deck\[0\]\[2\] \}, \(\) => exteriorFoes\.spawnFoe\(/);
});

test('AUDIT NAV1 (B9) THE FIGHT ON SCREEN: on foot over her rail the HUD\'s card is the fight - whose deck, her captain standing or down, how many of her crew are down and at what count the rest yield; her captain by name on the target bar; the haul, the boarders, a raid\'s own count, each in words (mutants: the fight undrawn, the captain unnamed, the tally unread)', async () => {
  const { h, e, enemies } = await boarding();
  assert.equal(enemies[0].name, `Captain ${e.ship.names.captain}`, 'her captain named');
  assert.ok(enemies.slice(1).every((f) => f.name === null));
  const m = h.host.hudModel();
  const n = enemies.length;
  assert.deepEqual(m.boarding, { kind: 'board', phase: 'fight', name: e.ship.names.name, captain: e.ship.names.captain, captainDown: false, down: 0, total: n, yieldAt: Math.ceil(n * SURRENDER_SHARE), raid: false });
  enemies[0].dead = true; enemies[1].dead = true;
  h.host.frame(0.05);
  assert.deepEqual([h.host.hudModel().boarding.captainDown, h.host.hudModel().boarding.down], [true, 2]);
  const t = navalHudText(h.host.hudModel());
  assert.deepEqual(t.fight, { name: `Boarding ${e.ship.names.name}`, sub: `Captain ${e.ship.names.captain} - down`, state: `2 of ${n} down - they yield at ${Math.ceil(n * SURRENDER_SHARE)}`, kind: 'board' });
  assert.equal(navalHudText({ ...m, boarding: { ...m.boarding, captainDown: false } }).fight.state, `0 of ${n} down - cut down her captain`);
  assert.equal(navalHudText({ ...m, boarding: { ...m.boarding, phase: 'grapple' } }).fight.name, `Grappling ${e.ship.names.name}`);
  const repel = navalHudText({ ...m, boarding: { kind: 'repel', phase: 'fight', name: 'Red Wake', captain: null, captainDown: false, down: 1, total: 4, yieldAt: 3, raid: false } }).fight;
  assert.deepEqual(repel, { name: 'Repel the boarders', sub: 'From Red Wake', state: '1 of 4 down', kind: 'sinking' });
  assert.equal(navalHudText({ ...m, boarding: { kind: 'repel', phase: 'fight', name: 'Red Wake', raid: true } }).fight.state, 'Hold your deck', 'a raid keeps its own count');
  // drawn in the card's place, its ship's bars put away
  destroyNavalHud();
  drawNavalHud(h.host.hudModel());
  const [root] = byClass(globalThis.document.body, 'dfnaval-hud');
  const [card] = byClass(root, 'dfnaval-card');
  assert.equal(card.style.display, '');
  assert.equal(card.className, 'dfnaval-card fight');
  assert.equal(byClass(card, 'dfnaval-card-name')[0].textContent, `Boarding ${e.ship.names.name}`);
  assert.equal(byClass(card, 'dfnaval-track')[0].style.display, 'none', 'no hull bar for a fight');
  destroyNavalHud();
});

test('AUDIT NAV1 (B13) THE PRIZE\'S FOURTH CHOICE - Black Flag\'s "lower your wanted level": a lawful prize\'s papers burned, a pirate\'s crew handed to the crown - PAPERS_NOTORIETY off my notoriety in her crown\'s waters, never below nought, greyed where no one hunts me; the one choice as ever (mutants: the papers unread, the notoriety unlowered)', async () => {
  assert.deepEqual([...CHOICES], ['repair', 'powder', 'press', 'papers']);
  const mine = { maxHull: 100, hull: 100, maxSail: 50, sail: 50, maxCrew: 10, crew: 10 };
  assert.deepEqual(choiceEffect('papers', mine, { notoriety: 40 }), { notoriety: -PAPERS_NOTORIETY });
  assert.deepEqual(choiceEffect('papers', mine, { notoriety: 6 }), { notoriety: -6 });
  assert.deepEqual(choiceOffer('papers', mine, {}, { notoriety: 30, lawful: true, crown: 'Wayrest' }), { id: 'papers', title: 'Burn her papers', useful: true, detail: `Your notoriety in Wayrest's waters falls by ${PAPERS_NOTORIETY}` });
  assert.deepEqual(choiceOffer('papers', mine, {}, { notoriety: 0, lawful: false, crown: 'Sentinel' }), { id: 'papers', title: PIRATE_PAPERS_TITLE, useful: false, detail: "No one hunts you in Sentinel's waters" });
  // through the host: a merchantman taken - Piracy's notoriety, then her papers burned
  const { h, e, enemies } = await boarding();
  for (const f of enemies) f.dead = true;
  h.run(0.2);
  const crown = e.ship.names.crown ?? 'Wayrest';
  const before = h.host.notoriety.get(crown);
  assert.ok(before >= PAPERS_NOTORIETY, 'taking a lawful ship made me wanted');
  const m = h.log.plunder.at(-1);
  const offer = m.offers().find((o) => o.id === 'papers');
  assert.deepEqual([offer.title, offer.useful], ['Burn her papers', true]);
  assert.equal(m.choose('papers'), true);
  assert.equal(h.host.notoriety.get(crown), before - PAPERS_NOTORIETY);
  assert.ok(h.log.say.some((t) => t.startsWith('Her papers burn')));
  assert.equal(m.choose('repair'), false, 'one choice');
});

test('AUDIT NAV1 (the boarding audit\'s minors): the sea keeps track of my boat off her helm - a fight on her deck, the boat I boarded from; a swimmer hauls a cask in by hand, into the pack; a rowboat\'s powder is for no gun (mutants: the boat lost off the helm, the swimmer never a collector, "your guns are loaded" on a rowboat)', async () => {
  const { h } = await boarding();
  assert.equal(h.runtime.sailing, false, 'off the helm, over her rail');
  const pirate = place(h, 'pirateBrig', [0, 0, 300], 0);
  h.run(3);
  assert.equal(pirate.ship.target, 'local', 'a pirate still has my boat for her enemy');
  // a swimmer's cask
  const s = await sea({ hull: null });
  s.deps.swimming = () => true;
  s.host._shots.dropFlotsam({ id: 'c1', pos: [0.3, 0, 0.2], lot: 'merchant_goods', from: 'merchantGalleon' });
  s.run(0.3);
  assert.ok(s.log.given.some(([n, b]) => n > 0 && b === null), 'into the pack');
  assert.ok(s.log.say.some((t) => t.startsWith('You break open a floating cask')));
  assert.equal(SWIMMER, 'me:swim');
  const mine = { maxHull: 10, hull: 10, maxSail: 0, sail: 0, maxCrew: 0, crew: 0 };
  assert.deepEqual(choiceOffer('powder', mine, { guns: false, loaded: true }), { id: 'powder', title: 'Powder and shot', useful: false, detail: 'No guns aboard' });
});
