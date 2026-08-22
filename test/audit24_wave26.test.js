// AUDIT 24, wave 26: the two SPLIT findings from the seven-slice
// sweep - the ones where the two independent refuters disagreed and
// the adjudication was mine - plus the seam gate's alias hole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const sources = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) {
  if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
}
loadQuestTables(sources);
const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const HEADERLESS = ['Quest: __NOHDR', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _x_', ''];
const NAMED = ['Quest: __HDR', 'DisplayName: The Sunken Ship', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _x_', ''];

test('audit24 wave26: a quest with no displayname: header has a NULL displayName', () => {
  // Quest.cs:56 is a bare `string displayName;` - null until
  // Parser.cs:86-89 assigns it, and only a `displayname:` line does.
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const bare = m.parseQuestForLists(HEADERLESS, 0, { rolls: () => 0 });
  assert.equal(bare.displayName, null, "not '' - the C# field has no initialiser");
  const named = m.parseQuestForLists(NAMED, 0, { rolls: () => 0 });
  assert.equal(named.displayName, 'The Sunken Ship');

  // which is the whole point: `'' ?? x` is `''`, so the port's default
  // made DaggerfallGuildServicePopupWindow.cs:640's fallback dead code
  // and a header-less quest would have offered a BLANK picker row.
  assert.equal(bare.displayName ?? bare.questName, '__NOHDR', 'the ?? arm is live again');
  assert.equal('' ?? '__NOHDR', '', 'which it was not with the empty-string default');
  assert.match(rd('src/systems/quest/offerFlow.js'), /entries\.push\(displayName \?\? quest\.questName\);/);
});

test('audit24 wave26: a null displayName round-trips, and never renders as "null"', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.parseQuestForLists(HEADERLESS, 0, { rolls: () => 0 });
  const data = q.getSaveData();
  assert.equal(data.displayName, null, 'Quest.cs:930 stores the field as-is');
  assert.equal(JSON.parse(JSON.stringify(data)).displayName, null, 'and JSON keeps it null');

  // C#'s two log sites use LogWarningFormat / string.Format, which
  // render a null argument as EMPTY. A bare `${null}` in JS is the
  // four-letter string "null" - so both needed the ?? ''.
  assert.match(rd('src/systems/quest/quest.js'), /is already a questor for quest \$\{this\.uid\} \[\$\{this\.displayName \?\? ''\}\]/);
  assert.match(rd('src/systems/quest/machine.js'), /const dn = questData\.displayName \?\? '';/);
  assert.doesNotMatch(rd('src/systems/quest/machine.js'), /\$\{questData\.displayName\}/);

  // and the notebook's `||` treats '' and null alike, so it is untouched
  assert.match(rd('src/systems/notebook.js'), /const questName = quest\.displayName \|\| EN\.quest;/);
});

test('audit24 wave26: the seam gate resolves world ALIASES', () => {
  // THE ALIAS HOLE. calledSeams() scanned for the literal `world.` /
  // `world?.` only, so a module that binds the seam to a local first -
  // `const w = hooks?.world;` - was invisible to the gate entirely.
  // questMacros.js is written that way throughout.
  const gate = rd('test/audit24_questseams.test.js');
  assert.match(gate, /Locals bound to the world seam ITSELF/);
  assert.match(gate, /const aliases = new Set\(/);

  // The tightening matters as much as the widening: a local bound to
  // something world RETURNS is not the seam. `const loc =
  // world\?\.currentLocation\?\.\(\)` must NOT contribute `building`
  // and `dungeon` as missing seams, which the first draft did.
  const seen = new Set();
  const dir = new URL('../src/systems/quest/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const mm of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*?)\s*;/g)) {
      if (/^[\w$]*(\??\.[\w$]+)*\??\.?world(\?\.)?(\(\))?$/.test(mm[2]) && mm[1] !== 'world') seen.add(`${mm[1]}=${mm[2]}`);
    }
  }
  assert.deepEqual([...seen].sort(), ['w=hooks?.world', 'w=world()'],
    'exactly the two shapes questMacros.js uses, and nothing derived');
});

// ---- the three seams the alias hole hid ----------------------------

test('audit24 wave26: DirectionVector2DirectionHintString, band for band', async () => {
  const { directionHintString, DIRECTION_HINTS } = await import('../src/systems/talk.js');
  // TalkManager.cs:1163-1187. Eight 45-degree bands off EAST,
  // counter-clockwise, the caller having already inverted y.
  assert.equal(directionHintString(1, 0), 'east');
  assert.equal(directionHintString(1, 1), 'northeast');
  assert.equal(directionHintString(0, 1), 'north');
  assert.equal(directionHintString(-1, 1), 'northwest');
  assert.equal(directionHintString(-1, 0), 'west');
  assert.equal(directionHintString(-1, -1), 'southwest');
  assert.equal(directionHintString(0, -1), 'south');
  assert.equal(directionHintString(1, -1), 'southeast');

  // THE BANDS ARE HALF-OPEN UPWARDS, and east owns both ends of the
  // circle - so the seam at 22.5 belongs to northeast, and the one at
  // 337.5 to east. A pin aimed at the middle of a band says nothing
  // about its edge.
  const at = (deg) => directionHintString(Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180));
  assert.equal(at(22.4999), 'east');
  assert.equal(at(22.5001), 'northeast');
  assert.equal(at(337.4999), 'southeast');
  assert.equal(at(337.5001), 'east');

  // C# EDGE KEPT: a ZERO vector divides by a zero magnitude, 0/0 is
  // NaN, every band comparison against NaN is false, and the chain
  // falls to its else. "Exactly where you are" is never-mind, not a
  // direction.
  assert.equal(directionHintString(0, 0), DIRECTION_HINTS.resolvingError);
  assert.equal(DIRECTION_HINTS.resolvingError, '...never mind...', 'Internal_Strings_en 425');

  // The near-edge probes above straddle 22.5 but never LAND on it, and
  // no vector I can build makes acos return exactly 22.5, so they say
  // nothing about whether the comparison is `>=` or `>`. Weakening one
  // to `>` survived them. The bands' inclusivity is pinned on the
  // source instead - C# is `>=` on every lower bound, `<` on every
  // upper, and `<=` only on the 360 that closes the circle.
  const fn = readFileSync(new URL('../src/systems/talk.js', import.meta.url), 'utf8');
  const body = fn.slice(fn.indexOf('export function directionHintString'), fn.indexOf('/** GetLocationCompassDirection'));
  const bounds = [...body.matchAll(/angle (>=|>|<=|<) (\d+(?:\.\d+)?)/g)].map((m) => `${m[1]}${m[2]}`);
  assert.deepEqual(bounds, [
    '>=0.0', '<22.5', '>=337.5', '<=360.0',
    '>=22.5', '<67.5', '>=67.5', '<112.5', '>=112.5', '<157.5',
    '>=157.5', '<202.5', '>=202.5', '<247.5', '>=247.5', '<292.5',
    '>=292.5', '<337.5',
  ], 'TalkManager.cs:1169-1184, comparison for comparison');
});

test('audit24 wave26: FindFactionByTypeAndRegion - exact first, partial LAST', async () => {
  const { findFactionByTypeAndRegion } = await import('../src/systems/talk.js');
  // PersistentFactionData.cs:236-265. An exact type+region match
  // RETURNS immediately, so the first in dictionary order wins.
  const dict = new Map([
    [1, { id: 1, type: 7, region: -1 }],
    [2, { id: 2, type: 7, region: 17 }],
    [3, { id: 3, type: 7, region: 17 }],
    [4, { id: 4, type: 7, region: -1 }],
    [5, { id: 5, type: 4, region: 17 }],
  ]);
  assert.equal(findFactionByTypeAndRegion(dict, 7, 17).id, 2, 'the FIRST exact match');

  // No exact match: the loop keeps OVERWRITING the partial, so the
  // LAST region-less faction of that type wins - not the first.
  assert.equal(findFactionByTypeAndRegion(dict, 7, 99).id, 4, 'the LAST region == -1 of that type');

  // a type with no partial and no exact match is the zero struct
  assert.equal(findFactionByTypeAndRegion(dict, 4, 99), null);
  assert.equal(findFactionByTypeAndRegion(new Map(), 7, 17), null);

  // AN EQUIVALENT MUTANT, recorded rather than dressed up as a kill:
  // swapping the two `if`s inside the loop passes every pin here, and
  // it really is equivalent. The only item that could satisfy both is
  // one with `item.region === -1` when `regionIndex` is ALSO -1, and
  // in that case the exact-match `return` fires either way.

  // and the mount delegates here rather than rolling its own
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /return s \? findFactionByTypeAndRegion\(s\.dict, type, regionIndex\) : null;/);
});

test('audit24 wave26: locationCompassDirection keeps the last-match and (0,0) shapes', async () => {
  const { locationCompassDirection } = await import('../src/systems/talk.js');
  // A region whose map table puts "Privys" at longitude/latitude that
  // land EAST of the player. longitudeLatitudeToMapPixel is
  // {x: trunc(lon/128), y: 499 - trunc(lat/128)}.
  const maps = {
    regionCount: 62,
    getPoliticIndex: () => 128 + 17,          // region 17
    getRegion: (i) => (i === 17 ? region : null),
  };
  const mkRegion = (mapNames, mapTable) => {
    // MapsFile.cs:1082-1083 builds MapNameLookup FIRST-WINS, and
    // mapsFile.js:519 does the same; the fixture must too or it is
    // not the shape under test.
    const mapNameLookup = new Map();
    mapNames.forEach((n, i) => { if (!mapNameLookup.has(n)) mapNameLookup.set(n, i); });
    return { mapNames, mapTable, mapNameLookup };
  };
  const region = mkRegion(
    ['Privys', 'Elsewhere'],
    [{ longitude: 400 * 128, latitude: (499 - 300) * 128 }, { longitude: 1 * 128, latitude: 498 * 128 }],
  );
  const at = (x, y) => locationCompassDirection({ playerMapPixel: () => ({ x, y }), maps }, 'Privys');
  assert.equal(at(300, 300), 'east', 'the target is at pixel x=400, y=300');
  assert.equal(at(500, 300), 'west');
  // map pixels grow SOUTHWARDS, and C# inverts y before the hint - so
  // a target at a SMALLER y is NORTH of the player
  assert.equal(at(400, 400), 'north');
  assert.equal(at(400, 200), 'south');

  // the name match is case-insensitive, and a name the region does not
  // carry leaves positionLocation at zero -> never-mind
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 300, y: 300 }), maps }, 'privys'), 'east');
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 300, y: 300 }), maps }, 'Nowhere'), '...never mind...');

  // THE SHAPE WAVE 26 GOT WRONG AND THE SCOUT CAUGHT. The loop does not
  // break - but the row is looked up BY NAME
  // (`MapTable[MapNameLookup[locations[i]]]`, TalkManager.cs:1263-1266),
  // and MapNameLookup is first-wins, so every iteration for a duplicated
  // name resolves the SAME first row. Wave 26 indexed mapTable by the
  // loop counter, which really is last-wins, and pinned that as the law.
  const twice = mkRegion(
    ['Privys', 'Privys'],
    [{ longitude: 400 * 128, latitude: (499 - 300) * 128 }, { longitude: 100 * 128, latitude: (499 - 300) * 128 }],
  );
  const mapsTwice = { ...maps, getRegion: () => twice };
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 300, y: 300 }), maps: mapsTwice }, 'Privys'),
    'east', 'the FIRST Privys (x=400) wins - MapNameLookup is first-wins');

  // and two names differing only in CASE still take the last, because
  // the ToLower compare matches both while the dictionary keys stay
  // exact-case, so the lookup really is per-iteration
  const cased = mkRegion(
    ['Privys', 'privys'],
    [{ longitude: 400 * 128, latitude: (499 - 300) * 128 }, { longitude: 100 * 128, latitude: (499 - 300) * 128 }],
  );
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 300, y: 300 }), maps: { ...maps, getRegion: () => cased } }, 'PRIVYS'),
    'west', 'the second, differently-cased Privys wins');

  // a name the lookup does not hold is SKIPPED, not defaulted to row 0
  const orphan = { ...mkRegion(['Privys'], [{ longitude: 400 * 128, latitude: (499 - 300) * 128 }]), mapNameLookup: new Map() };
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 300, y: 300 }), maps: { ...maps, getRegion: () => orphan } }, 'Privys'),
    '...never mind...');

  // and a region record with NO lookup at all answers never-mind rather
  // than throwing. C# always builds MapNameLookup at load
  // (MapsFile.cs:1063), but the port's getRegion can hand back a
  // partially-built record, and `lookup.get` on a missing one is a
  // TypeError that would take the whole macro expansion down. Dropping
  // the `lookup?.has` guard survived every other pin here.
  const noLookup = { mapNames: ['Privys'], mapTable: [{ longitude: 400 * 128, latitude: (499 - 300) * 128 }] };
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 300, y: 300 }), maps: { ...maps, getRegion: () => noLookup } }, 'Privys'),
    '...never mind...');
  // and no region at all, which is the out-of-range politic case
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 1, y: 1 }), maps: { ...maps, getRegion: () => null } }, 'Privys'),
    '...never mind...');

  // an out-of-range politic index reads region -1, which has no map
  const bad = { ...maps, getPoliticIndex: () => 128 + 999 };
  assert.equal(locationCompassDirection({ playerMapPixel: () => ({ x: 1, y: 1 }), maps: bad }, 'Privys'), '...never mind...');
});

test('audit24 wave26: %rt and %nrn take the ZERO STRUCT on a lookup miss, not null', async () => {
  const { getContextValue } = await import('../src/systems/quest/questMacros.js');
  // RegentTitle (MacroHelper.cs:644-650) discards the lookup's bool
  // and reads the out struct, which PersistentFactionData.cs:239 has
  // already set to `new FactionData()`. GetRulerTitle(0) hits its
  // `default:` and answers Lord.
  const worldMiss = {
    currentRegionIndex: () => 17,
    findFactionByTypeAndRegion: () => null,       // the miss: zero struct
    getFactionData: () => null,
    currentRegionFaction: () => 0,
  };
  assert.equal(getContextValue('%rt', null, { world: worldMiss }), 'Lord');
  assert.equal(getContextValue('%t', null, { world: worldMiss }), 'Lord');

  // and a real ruler still reads its own title
  const worldHit = { ...worldMiss, findFactionByTypeAndRegion: () => ({ ruler: 2 }) };
  assert.equal(getContextValue('%rt', null, { world: worldHit }), 'Queen');

  // %nrn: GetLordNameForFaction has NO null path. The zero struct
  // gives ruler 0 -> gender (0+1)%2 = 1 = Female, race 0 ->
  // FactionRaces.Nord, seed 0 & 0xffff = 0.
  const nrn = getContextValue('%nrn', null, { world: worldMiss });
  assert.ok(typeof nrn === 'string' && nrn.length > 1, `a generated name, got ${JSON.stringify(nrn)}`);
  assert.doesNotMatch(nrn, /nullMCP|undefined/);

  // NO WORLD AT ALL is the other nothing, and it stays the port's loud
  // headless pending - this is the distinction %rn already drew and
  // these two conflated.
  assert.match(String(getContextValue('%rt', null, { world: null })), /nullMCP/);
  assert.match(String(getContextValue('%nrn', null, { world: null })), /nullMCP/);
});
