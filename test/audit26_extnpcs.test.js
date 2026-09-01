// AUDIT 26 (F019, with F190 its exact duplicate): THE STREET'S STATIC
// NPCs. collectExteriorNpcs was a faithful port of RMBLayout's
// non-zero-FactionID rule (RMBLayout.cs:366-378 / :442-454) with ZERO
// production callers - a ported function with no caller is a comment,
// so no exterior NPC was ever stood, and none could be activated or
// talked to above ground.
//
// These pins are the law and the wiring: the exterior overload of
// StaticNPC.SetLayoutData (StaticNPC.cs:180-207), the record the hosts
// stand, and the fact that the two hosts owning RMB blocks collect
// them and the mode machine's exterior ray clicks them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectBlockFlats } from '../src/world/rmbFlats.js';
import { collectExteriorNpcs, exteriorNpcRecord } from '../src/characters/exteriorNpcs.js';
import {
  exteriorNpcFlags, staticNpcData, NPC_CONTEXT, ZERO_NPC_DATA,
} from '../src/characters/staticNpc.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { RACES } from '../src/systems/races.js';

const src = (f) => readFileSync(join(process.cwd(), f), 'utf8');

/** A one-block RMB with an NPC flat in EACH of RMBLayout's two flat
 *  sites, plus one unfactioned flat that must not be collected. */
function block() {
  const scenery = Array.from({ length: 16 }, () =>
    Array.from({ length: 16 }, () => ({ textureRecord: -1 })));
  return {
    rmbBlock: {
      fldHeader: { groundData: { groundScenery: scenery } },
      miscFlatObjectRecords: [
        // the misc-site NPC (AddMiscBlockFlats :366-378)
        { textureArchive: 179, textureRecord: 5, xPos: 100, yPos: -4, zPos: 200, factionID: 42, flags: 32, position: 12345 },
        // scenery: faction 0, never an NPC
        { textureArchive: 212, textureRecord: 1, xPos: 0, yPos: 0, zPos: 0, factionID: 0, flags: 0, position: 7 },
      ],
      subRecords: [{
        xPos: 0, zPos: 0,
        exterior: {
          blockFlatObjectRecords: [
            // the subrecord-site NPC (AddExteriorBlockFlats :442-454)
            { textureArchive: 181, textureRecord: 2, xPos: 8, yPos: 0, zPos: 8, factionID: 510, flags: 0, position: 99 },
            // an EDITOR flat is skipped before the faction check
            { textureArchive: 199, textureRecord: 1, xPos: 0, yPos: 0, zPos: 0, factionID: 777, flags: 0, position: 1 },
          ],
        },
      }],
    },
  };
}

test('AUDIT 26 F019: SetLayoutData exterior overload - FLATS.CFG owns the gender flag (StaticNPC.cs:185-194)', () => {
  // `flatCFG.gender.Contains("2")` sets bit 32; anything else CLEARS it
  // with `flags &= 223`. Both directions, and the other bits stand.
  assert.equal(exteriorNpcFlags(0, { gender: '2' }), 32, 'a female flat must gain bit 32');
  assert.equal(exteriorNpcFlags(32, { gender: '1' }), 0, 'a male flat must LOSE the record bit - the flag is invalid outdoors');
  assert.equal(exteriorNpcFlags(0, { gender: '1' }), 0);
  assert.equal(exteriorNpcFlags(32, { gender: '2' }), 32);
  // Contains, not equals: "?2" is the ChildGard censor mark on a female flat.
  assert.equal(exteriorNpcFlags(0, { gender: '?2' }), 32);
  assert.equal(exteriorNpcFlags(32, { gender: '?1' }), 0);
  // 223 is ~32 in a byte: every other bit survives the clear.
  assert.equal(exteriorNpcFlags(0b11111111, { gender: '1' }), 0b11011111);
  assert.equal(exteriorNpcFlags(0b11011111, { gender: '2' }), 0b11111111);
  // C# only enters the branch when GetFlatData answered true.
  assert.equal(exteriorNpcFlags(32, null), 32, 'a flat FLATS.CFG does not carry keeps its own flags');
  assert.equal(exteriorNpcFlags(5, null), 5);
});

test('AUDIT 26 F019: the collected flats carry the RAW record triple the position hash reads', () => {
  const flats = collectBlockFlats(block(), 504);
  const npcs = collectExteriorNpcs(flats);
  // both flat sites, the unfactioned flat and the editor flat excluded
  assert.deepEqual(npcs.map((n) => n.archive), [179, 181]);
  // GetPositionHash reads the UNSCALED XPos/YPos/ZPos (StaticNPC.cs:210,
  // :333-336) - the scaled billboard position cannot answer it.
  assert.deepEqual(
    { rawX: npcs[0].rawX, rawY: npcs[0].rawY, rawZ: npcs[0].rawZ },
    { rawX: 100, rawY: -4, rawZ: 200 });
  assert.deepEqual(
    { rawX: npcs[1].rawX, rawY: npcs[1].rawY, rawZ: npcs[1].rawZ },
    { rawX: 8, rawY: 0, rawZ: 8 });
});

test('AUDIT 26 F019: one collected flat derives the exterior NPCData (StaticNPC.cs:180-224)', () => {
  const npc = collectExteriorNpcs(collectBlockFlats(block(), 504))[0];
  // FLATS.CFG says MALE for this flat; the record's own bit 32 says
  // female and is invalid outdoors.
  const pn = exteriorNpcRecord(npc, { gender: '1' });
  const data = staticNpcData(pn, {
    mapId: 999, locationIndex: 7, buildingKey: 0, context: pn.context,
    getFaction: (id) => (id === 42 ? { race: 2, type: 0 } : null),   // FactionRaces.Redguard
    raceOfCurrentRegion: () => RACES.Nord,
  });
  assert.deepEqual(data, {
    ...ZERO_NPC_DATA,
    // GetPositionHash(100, -4, 200) = 100 ^ (-4 << 2) ^ (200 >> 2)
    //                               = 100 ^ -16 ^ 50 = -90
    hash: -90,
    flags: 0,                       // 32 & 223 - the FLATS.CFG repair
    factionID: 42,
    billboardArchiveIndex: 179,
    billboardRecordIndex: 5,
    // position ^ (buildingKey + locationIndex) = 12345 ^ (0 + 7)
    nameSeed: 12350,
    gender: GENDERS.Male,           // the repaired flag, not the record's
    race: RACES.Redguard,           // FactionRaces 2, not the region's Nord
    // the exterior overload's own two: no building above ground
    context: NPC_CONTEXT.Custom,
    buildingKey: 0,
    mapID: 999,
  });
  // ...and the record itself stamps Context.Custom (:206), which is
  // what the click reads to pick the overload.
  assert.equal(pn.context, NPC_CONTEXT.Custom);
});

test('AUDIT 26 F019: the wiring - collectExteriorNpcs has production callers in every host that owns RMB blocks', () => {
  // THE FOUR HOSTS. exterior.js and world.js are the only hosts that
  // lay out RMB blocks (RMBLayout is a block layout); the dungeon
  // hosts are RDB and the standalone interior scene builds one
  // building, so neither has an exterior flat to collect.
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const host = src(f);
    // NPC4c added isExteriorNpcFlat to the same import - the ONE
    // predicate, because the batch loop now asks the same question
    // ("is this flat a person?") to keep them out of the shared flat
    // groups, and two spellings of it is how the two lists drift.
    assert.match(host, /import \{ collectExteriorNpcs, exteriorNpcRecord(, isExteriorNpcFlat)? \}/, `${f}: the collection is not imported`);
    assert.ok(host.includes('collectExteriorNpcs(blockFlats)'), `${f}: the collection is never called on the block's flats`);
    assert.ok(host.includes('exteriorNpcRecord('), `${f}: no NPC record is ever stood`);
    assert.ok(host.includes('npcTargets: ()'), `${f}: the NPCs never reach the mode machine`);
  }
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    assert.ok(!src(f).includes('collectBlockFlats'), `${f}: N/A only holds while this host lays out no RMB block`);
  }
});

test('AUDIT 26 F019: the exterior activation ray clicks them (PlayerActivate.cs:87, :741-767)', () => {
  const wm = src('src/scenes/worldModes.js');
  const from = wm.indexOf('async function tryEnter()');
  const to = wm.indexOf('function rayAabbProbe(');
  assert.ok(from > 0 && to > from, 'tryEnter changed shape');
  const ray = wm.slice(from, to);
  assert.ok(ray.includes('npcTargets?.()'), 'the exterior ray never asks the host for its static NPCs');
  assert.ok(ray.includes('personAabb(pn)'), 'the NPCs are not activation targets');
  assert.ok(ray.includes('distance: STATIC_NPC_ACTIVATION_DISTANCE'),
    'an exterior NPC must take the 256-unit reach (PlayerActivate.cs:87), not the door default');
  assert.ok(/activateStaticNpc\(npcs\[/.test(ray), 'a hit NPC never opens StaticNPCClick');
  // The NPC arm ends the activation - it must be decided BEFORE the
  // door entry it would otherwise fall through into.
  assert.ok(ray.indexOf('activateStaticNpc(npcs[') < ray.indexOf('const hit = entries[key]'),
    'the NPC hit is routed after the door lookup - a click on a person would enter a building');
  // The derivation picks the overload off the record (Context.Custom
  // outdoors, Context.Building inside).
  assert.ok(wm.includes('...(pn?.context != null ? { context: pn.context } : {})'),
    'the click always derives a BUILDING record - the exterior overload stamps Context.Custom');
});
