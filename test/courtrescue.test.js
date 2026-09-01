// CR1 - THE COURT GUILD RESCUES (2026-08-28). DaggerfallCourtWindow
// .cs:177-221, the arm court.js's header FLAGGED to the guilds arc:
// assault or murder may be forgiven by the Dark Brotherhood, a
// thieving crime by the Thieves Guild - `guild.Rank >= Random.Range
// (0, 20)`, the roll drawn ONLY for a member (IsMember() stands
// outside it), and the exit is the acquittal's own trio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  guildRescue, CRIMES,
  TEXT_RESCUE_TG, TEXT_RESCUE_DB, THIEVES_GUILD_FACTION_ID, DARK_BROTHERHOOD_FACTION_ID,
} from '../src/systems/court.js';

const read = (p) => readFileSync(p, 'utf8');

const member = (fid, rank) => (id) => (id === fid ? rank : null);

test('CR1: the crime-to-guild routing, verbatim (:177-221)', () => {
  // crimeType = crime - 1. Assault (4) / murder (3) -> DB;
  // <=2 (attempted B&E, trespassing, B&E) or 11 (pickpocketing) -> TG.
  const db = member(DARK_BROTHERHOOD_FACTION_ID, 19);
  const tg = member(THIEVES_GUILD_FACTION_ID, 19);
  const roll = () => 0;   // Range(0,20) = 0 - any member rank passes
  assert.deepEqual(guildRescue({ crime: CRIMES.Assault }, { guildRankOf: db, roll }),
    { guild: 'DarkBrotherhood', textId: TEXT_RESCUE_DB });
  assert.deepEqual(guildRescue({ crime: CRIMES.Murder }, { guildRankOf: db, roll }),
    { guild: 'DarkBrotherhood', textId: TEXT_RESCUE_DB });
  assert.equal(guildRescue({ crime: CRIMES.Assault }, { guildRankOf: tg, roll }), null,
    'the Thieves Guild does not rescue violence');
  for (const crime of [CRIMES.Attempted_Breaking_And_Entering, CRIMES.Trespassing, CRIMES.Breaking_And_Entering, CRIMES.Pickpocketing]) {
    assert.deepEqual(guildRescue({ crime }, { guildRankOf: tg, roll }),
      { guild: 'ThievesGuild', textId: TEXT_RESCUE_TG }, `crime ${crime}`);
    assert.equal(guildRescue({ crime }, { guildRankOf: db, roll }), null,
      'and the Brotherhood does not rescue thieving');
  }
  // a crime neither table names rescues nobody
  assert.equal(guildRescue({ crime: CRIMES.Vagrancy }, { guildRankOf: () => 19, roll }), null);
});

test('CR1: rank >= Range(0,20) - the boundary, and the roll is a MEMBER\'s alone', () => {
  const court = { crime: CRIMES.Murder };
  // rank 10 vs a draw of 10: >= passes
  assert.ok(guildRescue(court, { guildRankOf: member(DARK_BROTHERHOOD_FACTION_ID, 10), roll: () => 10 / 20 }));
  // rank 10 vs a draw of 11: fails
  assert.equal(guildRescue(court, { guildRankOf: member(DARK_BROTHERHOOD_FACTION_ID, 10), roll: () => 11 / 20 }), null);
  // rank 0 (a new member) vs a draw of 0: still rescued - C#'s own >=
  assert.ok(guildRescue(court, { guildRankOf: member(DARK_BROTHERHOOD_FACTION_ID, 0), roll: () => 0 }));
  // a NON-member never draws: IsMember() gates the Range call (:181-183)
  let draws = 0;
  assert.equal(guildRescue(court, { guildRankOf: () => null, roll: () => { draws++; return 0; } }), null);
  assert.equal(draws, 0, 'the stream is untouched - C#\'s short-circuit kept');
});

test('CR1: the flow arm - before the plead box, with the acquittal exit trio', () => {
  const flow = read('src/scenes/arrestFlow.js');
  const from = flow.indexOf('const rescue = court ? guildRescue(court, { guildRankOf, roll: rolls }) : null;');
  assert.ok(from > 0, 'the arm exists, on the startCourt record');
  const body = flow.slice(from, from + 500);
  assert.match(body, /clearArrest\(\);\s*\n\s*fillVitalSigns\(playerEntity\);\s*\n\s*raiseRepForSentence\(playerEntity, court\);/,
    'FillVitalSigns + RaiseReputationForDoingSentence + release (:191-193)');
  assert.match(body, /courtLines\(rescue\.textId,/, 'TEXT.RSC 550/551 through the court macro pass');
  assert.match(body, /return;\s*\n\s*\}\s*\n\s*townTalk\.showOverlay/,
    'a rescued player never sees the plead box');
  // the default member read is the one guild home
  assert.match(flow, /guildOfFaction\(factionId, resolveVariantGuild\(dict\), dict\)/,
    'GuildManager.GetGuild through the port\'s own resolver');
  assert.ok(!/guild rescues \(Thieves\/Dark Brotherhood\) pend/.test(read('src/systems/court.js')),
    'the FLAGGED clause is GONE - retiring a flag deletes the sentence');
});
