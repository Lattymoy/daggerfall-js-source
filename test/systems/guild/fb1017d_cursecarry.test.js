// FIELD BUGS 2026-10-17d (CURSE-CARRY) - "I lost access to the guild after transforming": a Dark Brotherhood member who
// became a vampire was shut out of the Brotherhood. GuildManager.Memberships (:109-112) hands a vampire an EMPTY book,
// and the Brotherhood and the Thieves Guild are the two a player cannot ask to join - the one invitation each sends parks
// its tally at InviteSent - so the swap locked them out for the whole curse. The two now ride the swap: the record MOVES
// to whichever book the curse reads, one record, never two. Every other guild still swaps, as DFU's do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUILDS, activeMemberships, joinGuild, membershipOf, membershipKey, guildInitiationQuestEnded,
} from '../../../src/systems/guild/guilds.js';
import { createVampirismCurse, cureVampirism } from '../../../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../../../src/systems/infection.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { rollEntityDoors } from '../../../src/net/npcRollTracker.js';
import { GUILD_FACTION_IDS } from '../../../src/systems/guild/guildFactions.js';

const P = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});
const DB = GUILDS.DarkBrotherhood;
const TG = GUILDS.ThievesGuild;
const turn = (p) => createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });

test('CURSE-CARRY: the report - a Brotherhood member who turns keeps the Brotherhood, rank and all, the one record moved; the Fighters Guild still hides; the cure reads the rank the vampire earned (mutants: no carry; copied, not moved; every guild carried)', () => {
  const p = P();
  const db = joinGuild(activeMemberships(p), DB, 100);
  db.rank = 4;
  joinGuild(activeMemberships(p), GUILDS.FightersGuild, 100);
  turn(p);
  assert.equal(membershipOf(activeMemberships(p), DB), db, 'the vampire reads the Brotherhood - the same record, rank 4');
  assert.equal(Object.hasOwn(p.guildMemberships.mortal, membershipKey(DB)), false, 'moved, not copied: one record, never two');
  assert.equal(membershipOf(activeMemberships(p), GUILDS.FightersGuild), null, 'a guild that can be asked again still swaps');
  db.rank = 5;   // a promotion while the curse holds
  cureVampirism(p, {});
  assert.equal(membershipOf(activeMemberships(p), DB)?.rank, 5, 'the cure reads the rank the vampire earned');
  assert.equal(Object.hasOwn(p.guildMemberships.vampire, membershipKey(DB)), false, 'and the vampire book gives it up');
  assert.ok(membershipOf(activeMemberships(p), GUILDS.FightersGuild), 'the Fighters Guild back with the mortal book');
});

test('CURSE-CARRY: the Thieves Guild rides the curse the same way, and an initiation finished AS a vampire comes home at the cure (mutants: one guild of the two)', () => {
  const p = P();
  joinGuild(activeMemberships(p), TG, 100);
  turn(p);
  assert.ok(membershipOf(activeMemberships(p), TG), 'the Thieves Guild kept through the turn');
  const q = P();
  turn(q);
  assert.deepEqual(guildInitiationQuestEnded(activeMemberships(q), DB.initiationQuest, true, 200), [DB], 'joined as a vampire');
  cureVampirism(q, {});
  assert.ok(membershipOf(activeMemberships(q), DB), 'and still a member once cured - the invitation is never sent twice');
});

test('CURSE-CARRY: where both books hold one, each keeps its own, as DFU\'s do (mutants: the active book\'s record overwritten)', () => {
  const p = P();
  activeMemberships(p);
  joinGuild(p.guildMemberships.mortal, DB, 100).rank = 6;
  joinGuild(p.guildMemberships.vampire, DB, 100).rank = 1;   // a classic import can carry both
  turn(p);
  assert.equal(membershipOf(activeMemberships(p), DB).rank, 1, 'the vampire reads its own');
  assert.equal(membershipOf(p.guildMemberships.mortal, DB).rank, 6, 'the mortal\'s waits');
  cureVampirism(p, {});
  assert.equal(membershipOf(activeMemberships(p), DB).rank, 6, 'and comes back at the cure');
});

test('CURSE-CARRY: the save keeps the one record where it stands, and the Roll\'s door reads the carried guild awake before any other read (mutants: the door\'s carry dropped)', () => {
  const p = P();
  joinGuild(activeMemberships(p), DB, 100).rank = 3;
  turn(p);
  assert.ok(Object.hasOwn(p.guildMemberships.mortal, membershipKey(DB)), 'nothing has read the books since the turn');
  const members = rollEntityDoors(() => p).members();
  assert.deepEqual(members.find((m) => m.f === GUILD_FACTION_IDS.DarkBrotherhood), { f: GUILD_FACTION_IDS.DarkBrotherhood, rank: 3 },
    'awake for the vampire - no dormant mark, so the chapter gives it Merit, its writ and its seat');
  const q = P();
  restorePlayer(q, snapshotPlayer(p));
  assert.equal(membershipOf(activeMemberships(q), DB)?.rank, 3, 'the restored vampire reads it');
  assert.equal(Object.hasOwn(q.guildMemberships.mortal, membershipKey(DB)), false, 'one record across the save');
});
