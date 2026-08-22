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
