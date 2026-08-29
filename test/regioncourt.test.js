// CQ1 - THE REGION'S NOBLE COURT (2026-08-29).
//
// PlayerGPS.GetCourtOfCurrentRegion (PlayerGPS.cs:469-483) finds the
// one Courts faction whose guild group is Region and whose region is
// the player's, and DFU throws if it does not find exactly one.
//
// The port hardcoded `courtOfCurrentRegion: () => 0` in world.js, and
// that is worse than absent: 0 IS A REAL FACTION ID, so a palace
// interior and the three generic Random_* factions npcSession routes
// through this getter resolved to whatever faction 0 happens to be,
// silently, rather than to nothing.
//
// The lookup itself needed no new machinery - findFactions is already
// PersistentFactionData.FindFactions verbatim and its People sibling
// two functions up is the same shape. What CQ1 adds is the Courts
// query and the honest refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCourtOfCurrentRegion, getPeopleOfCurrentRegion } from '../src/systems/talk.js';
import { FACTION_TYPES, GUILD_GROUPS, SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { FactionFile } from '../src/formats/factionFile.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

/** A dict of synthetic factions, keyed as the reader keys them. */
const dictOf = (...rows) => new Map(rows.map((r) => [r.id, r]));
const court = (id, region) => ({
  id, name: `Court ${region}`, type: FACTION_TYPES.Courts,
  ggroup: GUILD_GROUPS.Region, sgroup: 0, region,
});

test('CQ1: the court is matched on type, guild group AND region', () => {
  const d = dictOf(
    court(101, 17),
    court(102, 18),
    // same region, wrong TYPE
    { id: 103, name: 'x', type: FACTION_TYPES.People, ggroup: GUILD_GROUPS.Region, sgroup: 0, region: 17 },
    // same region and type, wrong GUILD GROUP
    { id: 104, name: 'y', type: FACTION_TYPES.Courts, ggroup: GUILD_GROUPS.HolyOrder, sgroup: 0, region: 17 },
  );
  assert.equal(getCourtOfCurrentRegion(d, 17)?.id, 101);
  assert.equal(getCourtOfCurrentRegion(d, 18)?.id, 102);
  // each of the three columns is load-bearing: drop any one and the
  // decoys above would answer for region 17.
  assert.equal(getCourtOfCurrentRegion(d, 19), null, 'a region with no court answers null');
});

test('CQ1: SOCIAL GROUP is deliberately unconstrained - DFU passes -1', () => {
  // The People lookup two functions up pins Commoners; this one does
  // NOT, because DFU's call is FindFactions(Courts, -1, Region, index).
  // Pinned because "make it match its sibling" is the plausible wrong
  // tidy-up, and it would drop courts whose sgroup is anything else.
  const d = dictOf({ ...court(200, 5), sgroup: SOCIAL_GROUPS.Nobility ?? 5 });
  assert.equal(getCourtOfCurrentRegion(d, 5)?.id, 200,
    'a court is found whatever its social group');
});

test('CQ1: NOT EXACTLY ONE means null - the caller decides, as its sibling does', () => {
  // DFU throws "did not find exactly 1 match". The port answers null
  // and world.js turns that into the bridge's own no-faction 0, which
  // is the same split getPeopleOfCurrentRegion already uses: a host
  // that cannot name a court shows no court rather than taking down
  // the frame.
  assert.equal(getCourtOfCurrentRegion(dictOf(), 3), null, 'none');
  assert.equal(getCourtOfCurrentRegion(dictOf(court(1, 3), court(2, 3)), 3), null, 'two is not one');
  assert.equal(getCourtOfCurrentRegion(dictOf(court(1, 3)), 3)?.id, 1, 'exactly one');
});

test('CQ1: the host no longer hardcodes 0 - and 0 was never "absent"', () => {
  const world = readFileSync(join(HERE, '..', 'src', 'scenes', 'world.js'), 'utf8');
  assert.equal(/courtOfCurrentRegion: \(\) => 0,/.test(world), false,
    '0 is a real faction id, so the hardcode resolved to a real faction rather than to nothing');
  assert.match(world, /courtOfCurrentRegion: \(\) => getCourtOfCurrentRegion\(/,
    'it reads the store now');
  // ...through the SAME store and region index its People sibling
  // uses, so the two cannot disagree about where the player stands.
  const line = world.split('\n').find((l) => l.includes('courtOfCurrentRegion: () => getCourtOfCurrentRegion('));
  const peopleLine = world.split('\n').find((l) => l.includes('peopleOfCurrentRegion: () => getPeopleOfCurrentRegion('));
  for (const frag of ['_questStore()?.dict', '_questLoc()?.regionIndex']) {
    assert.ok(line.includes(frag) && peopleLine.includes(frag), `both read ${frag}`);
  }
});

test('CQ1: every region in the real FACTION.TXT has EXACTLY ONE court', { skip: skipReal }, () => {
  // DFU's own comment says "Should always find a single court" and
  // throws otherwise - so on the shipped corpus the refusal path must
  // never be reachable. This is the arm that proves the query right
  // rather than merely self-consistent.
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  const dict = ff.factionDict;
  const regions = new Set([...dict.values()]
    .filter((f) => f.type === FACTION_TYPES.Courts && f.ggroup === GUILD_GROUPS.Region)
    .map((f) => f.region));
  assert.ok(regions.size > 30, `found courts in ${regions.size} regions`);
  for (const r of regions) {
    const c = getCourtOfCurrentRegion(dict, r);
    assert.ok(c, `region ${r} resolves a single court`);
    assert.equal(c.type, FACTION_TYPES.Courts);
  }
  // and the court is NOT the People faction - the two getters must not
  // collapse onto each other
  for (const r of [...regions].slice(0, 5)) {
    const c = getCourtOfCurrentRegion(dict, r);
    const p = getPeopleOfCurrentRegion(dict, r);
    if (p) assert.notEqual(c.id, p.id, `region ${r}'s court and people are different factions`);
  }
});
