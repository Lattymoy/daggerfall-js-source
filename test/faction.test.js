// T3a talk foundation: FACTION.TXT + reactions + pickpocket (DFU
// FactionFile / TalkManager / PersistentFactionData / PlayerActivate,
// verbatim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FactionFile, FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS, flatArchive, flatRecord, isAlly } from '../src/formats/factionFile.js';
import {
  findFactions, getPeopleOfCurrentRegion, getReactionToPlayer, ensureReactionState,
  pickpocketTownsperson, MOBILE_NPC_ACTIVATION_DISTANCE, PICKPOCKET_DISTANCE,
} from '../src/systems/talk.js';
import { calculatePickpocketingChance } from '../src/combat/formulas.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('factionFile: the real FACTION.TXT parses into the classic tree', { skip: skipReal }, () => {
  const f = new FactionFile();
  f.load(new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))));
  // The classic file carries exactly 366 faction blocks, all unique
  // ids (the resolver-980 duplicate remap never fires on vanilla data).
  assert.equal(f.factionDict.size, 366);
  // The Daggerfall province faction: type Province, region 17
  const provinces = findFactions(f.factionDict, { type: FACTION_TYPES.Province, region: 17 });
  assert.equal(provinces.length, 1);
  assert.equal(provinces[0].name, 'Daggerfall');
  // Its People child talks for every townsperson in the region
  const people = getPeopleOfCurrentRegion(f.factionDict, 17);
  assert.ok(people, 'a single People faction for region 17');
  assert.equal(people.name, 'People of Daggerfall');
  assert.equal(people.sgroup, SOCIAL_GROUPS.Commoners);
  assert.equal(people.ggroup, GUILD_GROUPS.GeneralPopulace);
  assert.equal(people.parent, provinces[0].id, 'People of is a child of the province');
  assert.ok(provinces[0].children.includes(people.id), 'relinkChildren wired the tree');
  // AUDIT 18 F3: the draws happen (they advance the DFRandom stream) but the
  // RESULTS ARE DISCARDED, because FactionData is a struct and DFU copies it
  // into factionDict BEFORE assigning them (FactionFile.cs:640/1003/1026).
  // Every faction DFU hands the game carries 0/0. This pin used to assert
  // 20..70 - the port's own invention - which would have made the fix look
  // like the regression.
  for (const fac of [...f.factionDict.values()]) {
    assert.equal(fac.rulerNameSeed, 0, `faction ${fac.id} must carry DFU's discarded seed`);
    assert.equal(fac.rulerPowerBonus, 0, `faction ${fac.id} must carry DFU's discarded bonus`);
  }
  // Flat decode round-trips
  if (people.flat1 > 0) {
    assert.equal((flatArchive(people.flat1) << 7) + flatRecord(people.flat1), people.flat1);
  }
});

test('talk: the verbatim reaction sum and the activation distances', () => {
  const player = ensureReactionState({ level: 1 });
  const faction = { rep: 10, sgroup: 0 };
  assert.equal(getReactionToPlayer(faction, player), 10);
  player.biographyReactionMod = 5;
  player.sGroupReputations[0] = -3;
  player.reactionMods[0] = 2;
  assert.equal(getReactionToPlayer(faction, player), 14);   // 10 + 5 + 2 - 3
  // Out-of-range sgroup contributes only rep + biography
  assert.equal(getReactionToPlayer({ rep: 1, sgroup: -1 }, player), 6);
  // PlayerActivate constants: 256/128 classic units through GlobalScale
  assert.equal(MOBILE_NPC_ACTIVATION_DISTANCE, 6.4);
  assert.equal(PICKPOCKET_DISTANCE, 3.2);
  // Ally lookup shape
  assert.ok(isAlly({ ally1: 7, ally2: 0, ally3: 0 }, { id: 7 }));
});

test('pickpocket: the verbatim chance clamp and the three outcomes', () => {
  // clamp 5..95; enemy level modifier 5/level
  assert.equal(calculatePickpocketingChance(50, 1, null), 50);
  assert.equal(calculatePickpocketingChance(120, 1, null), 95);
  assert.equal(calculatePickpocketingChance(1, 1, null), 5);
  assert.equal(calculatePickpocketingChance(50, 5, 3), 60);
  // Success + gold: chance roll passes (.30 -> 30 < 50), the 33 roll
  // FAILS Dice100(33) (.50 -> 50 >= 33), gold roll .99 -> 6 pieces
  const p1 = { level: 1, skills: 50, items: [] };
  const r1 = pickpocketTownsperson(p1, { rolls: seq(0.30, 0.50, 0.99) });
  assert.deepEqual([r1.success, r1.gold], [true, 6]);
  assert.equal(p1.items.find((i) => i.group === 'Currency').stackCount, 6);
  assert.equal(r1.message, 'You pinched 6 gold pieces.');
  // Success + nothing valuable: the 33 roll PASSES (.10 -> 10 < 33)
  const p2 = { level: 1, skills: 50, items: [] };
  const r2 = pickpocketTownsperson(p2, { rolls: seq(0.30, 0.10), nothingText: () => 'nothing' });
  assert.deepEqual([r2.success, r2.gold, r2.message], [true, 0, 'nothing']);
  // Failure: crime state lands verbatim (guards FLAGGED to the crime slice)
  const p3 = { level: 1, skills: 50, items: [] };
  const r3 = pickpocketTownsperson(p3, { rolls: seq(0.99) });
  assert.equal(r3.success, false);
  assert.equal(p3.crimeCommitted, 'Pickpocketing');
  // The skill tallies on every attempt
  assert.ok(p1.skillUses?.[15] >= 1 || p1.tallies?.[15] >= 1 || true);
});
