// AUDIT 24 (the seven-slice sweep), the SEAM GATE.
//
// The quest machine declares a `deps.world` contract and every action,
// resource and macro reaches the host through it with optional
// chaining - `world?.discoverLocation?.(...)`. That shape is the
// port's charter (a seam the host cannot honestly answer yet stays
// ABSENT and the law idles) and it is also a trapdoor: a seam nobody
// mounts is a ported law that evaporates silently, and nothing fails.
//
// It had happened four times over. The corpus's 193 `reveal` lines
// discovered nothing and filed no note; %oth had no TEXT.RSC to read;
// every Person whose faction race does not map fell to -1 instead of
// the region's race. All four seams were declared in Q3, wired to
// nothing, and green.
//
// So this gate reads the source both ways: every `world.x` the quest
// system calls must be MOUNTED on the host's questWorld, or named in
// PENDING below with the reason it cannot be answered yet. A new seam
// is a one-line decision either way - it cannot be forgotten.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Seams the machine declares that the HOST cannot answer yet, each
 *  with the slice that owns it. Removing a row means mounting it. */
const PENDING = new Map([
  ['createFoeGameObjects', 'quest foe spawning - GameObjectHelper.CreateFoeGameObjects (Port-Ledger)'],
  ['tryPlaceFoe', 'quest foe placement - TryPlacement + PlaceFoeFreely (Port-Ledger)'],
  ['raiseOnEncounterEvent', 'rides the foe spawn seam above'],
  ['respawnPlayerAtSite', 'TeleportPc transport - PlayerEnterExit.RespawnPlayer'],
  ['isRespawning', 'rides the respawn seam above'],
  ['setPlayerScenePosition', 'rides the respawn seam above'],
  ['getClassicSpellEffects', 'CastSpellDo needs the SPELLS.STD classic records'],
  ['spellHasMatchForClassicEffect', 'rides the readied-bundle seam above'],
  ['readiedSpell', 'RETIRED by AUDIT 24 - the latch is the action\'s now; the name survives only in a comment'],
  ['isHouseOwned', 'the residence-ownership half of the Place arc'],
  ['showClocksAsCountdown', 'a settings read the launcher does not expose yet'],
  ['buildingNameOpts', 'the building-name option bag'],
  ['currentRegionCourt', 'GetCourtOfCurrentRegion - the region faction trio'],
  ['currentRegionFaction', 'GetCurrentRegionFaction - the region faction trio'],
  ['currentRegionPeople', 'GetPeopleOfCurrentRegion - the region faction trio'],
  ['currentRegionVampireClan', 'GetCurrentRegionVampireClan - the vampirism arc'],
  ['playerVampireClan', 'the vampirism racial effect - the vampirism arc'],
  ['playerVampireClanName', 'rides the vampirism arc above'],
]);

/** Every `world.<name>` the quest system reaches for. */
function calledSeams() {
  const dir = 'src/systems/quest';
  const names = new Set();
  for (const f of readdirSync(join(ROOT, dir))) {
    if (!f.endsWith('.js')) continue;
    for (const m of read(join(dir, f)).matchAll(/\bworld\??\.(\w+)/g)) names.add(m[1]);
  }
  return names;
}

/** The keys the host actually mounts on questWorld. */
function mountedSeams() {
  const src = read('src/scenes/world.js');
  const i = src.indexOf('const questWorld = {');
  assert.ok(i > 0, 'questWorld is where the host answers the contract');
  let depth = 0;
  let j = src.indexOf('{', i);
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) break;
  }
  const body = src.slice(start, j + 1);
  return new Set([
    ...[...body.matchAll(/^ {4}(\w+)\s*[:(]/gm)].map((m) => m[1]),
    ...[...body.matchAll(/^ {4}(\w+),\s*$/gm)].map((m) => m[1]),
  ]);
}

test('audit24 seams: every world seam the quest system calls is MOUNTED or declared PENDING', () => {
  const called = calledSeams();
  const mounted = mountedSeams();
  assert.ok(mounted.size >= 14, `questWorld mounts ${mounted.size} seams`);
  const orphans = [...called].filter((n) => !mounted.has(n) && !PENDING.has(n)).sort();
  assert.deepEqual(orphans, [],
    'a seam the quest system calls that nothing answers and nobody declared pending');
});

test('audit24 seams: the four AUDIT 24 mounts are live, and PENDING carries no dead rows', () => {
  const mounted = mountedSeams();
  for (const seam of ['discoverLocation', 'addNote', 'currentRegionRace', 'getRandomText']) {
    assert.ok(mounted.has(seam), `${seam} is mounted - it was declared in Q3 and answered by nothing`);
  }
  // a PENDING row for a seam that IS mounted is a stale excuse; a row
  // for a seam nobody calls any more is dead weight
  const called = calledSeams();
  for (const [seam, why] of PENDING) {
    assert.ok(!mounted.has(seam), `${seam} is mounted now - drop its PENDING row (${why})`);
    assert.ok(called.has(seam), `nothing calls ${seam} any more - drop its PENDING row (${why})`);
  }
});

// ---- the questorData STRUCT ----

test('audit24: `add X as questor` leaves the ZERO struct, and the three unguarded reads survive it', async () => {
  // StaticNPC.NPCData is a C# STRUCT (StaticNPC.cs:88-107): there is no
  // null for it, and an un-setup questor holds all zeros. The port used
  // null, and three reads dereference it WITHOUT a guard - topicTree's
  // GetPersonBuildingKey (:350) and its quest-topic rebuild (:773), and
  // sceneMount's questor billboard pick (:63). Every one is reachable:
  // the OTHER route to isQuestor is `add <sym> as questor`
  // (Quest.addQuestor), which sets the flag and never calls
  // SetupQuestorNPC - exactly as C#'s Quest.cs:472 does, because there
  // the struct is already sitting in the field.
  const { ZERO_NPC_DATA } = await import('../src/characters/staticNpc.js');
  const { Person } = await import('../src/systems/quest/person.js');
  const { questNpcFlatData } = await import('../src/systems/quest/sceneMount.js');
  const { TopicTree } = await import('../src/systems/topicTree.js');

  // a Person straight out of the CONSTRUCTOR - nothing has set up a
  // questor NPC, which is precisely the `add X as questor` state
  const p = new Person(null);
  p.isQuestor = true;
  assert.deepEqual(p.questorData, ZERO_NPC_DATA, 'the ctor holds the struct, not null');
  for (const [k, v] of Object.entries(ZERO_NPC_DATA)) assert.equal(v, 0, `${k} is its zero`);

  // sceneMount's billboard pick - an unguarded .billboardArchiveIndex
  assert.deepEqual(questNpcFlatData(p), { archive: 0, record: 0 },
    'the zero struct answers zeros, where null threw');

  // topicTree's building key - an unguarded .buildingKey. The zero key
  // falls through to the home-building name lookup, which is the whole
  // point of C#'s `!== 0`.
  const tree = Object.create(TopicTree.prototype);
  tree.deps = {};
  tree.listBuildings = [{ name: 'BLANK', buildingKey: 4242 }];   // a home-less Person's name
  assert.equal(tree.getPersonBuildingKey(p), 4242, 'buildingKey 0 means "look me up by name"');
  tree.listBuildings = [];
  assert.equal(tree.getPersonBuildingKey(p), 0, 'and a miss reads the struct default, 0');

  // and the quest-topic rebuild's unguarded .mapID
  assert.equal(p.questorData.mapID, 0, 'the third read');

  // the save envelope carries the struct, and a pre-AUDIT-24 save whose
  // questorData is null restores to the struct rather than to null
  const restored = new Person({ hooks: {} });
  restored.restoreSaveData({ ...restored.getSaveData(), questorData: null });
  assert.deepEqual(restored.questorData, ZERO_NPC_DATA, 'an old null envelope restores to zeros');
});
