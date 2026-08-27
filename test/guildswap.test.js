// V2e - THE VAMPIRE GUILD-BOOK SWAP + THE CEMETERY RESPAWN, pinned
// against GuildManager.Memberships (:107-115, the per-READ book pick)
// and VampirismInfection's DeployFullBlownVampirism transfer
// (:164-175) with GetRandomCemetery (:194-217). The two-book store
// shipped structurally at AUDIT 21 F9; this slice ADOPTS it - every
// call site reads through activeMemberships - and lands the transfer
// through the infection host's new arm.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  activeMemberships, membershipsFor, newMembershipStore, isMembershipStore,
  clearMembershipData, joinGuild, membershipOf, GUILDS,
} from '../src/systems/guilds.js';
import { createVampirismCurse, cureVampirism } from '../src/systems/vampirism.js';
import { VAMPIRE_CLANS, deployInfection, randomCemeteryLocationIndex, INFECTION } from '../src/systems/infection.js';
import { setRacialQuestHost } from '../src/systems/racialQuests.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { DUNGEON_TYPES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});

beforeEach(() => setRacialQuestHost(null));

// ── 1. GuildManager.Memberships (:109-112), per READ ──────────────

test('V2e: activeMemberships picks the book by LIVE vampirism - a curse hides the mortal ranks, a cure hands them back', () => {
  const p = P();
  const mortalBook = activeMemberships(p);
  assert.ok(isMembershipStore(p.guildMemberships), 'the store is minted on first touch');
  joinGuild(mortalBook, GUILDS.FightersGuild, 100);
  assert.ok(membershipOf(activeMemberships(p), GUILDS.FightersGuild), 'the mortal reads their own book');
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(membershipOf(activeMemberships(p), GUILDS.FightersGuild), null,
    'the vampire opens an EMPTY book - the mortal ranks are hidden, not lost');
  joinGuild(activeMemberships(p), GUILDS.MagesGuild, 200);
  assert.ok(membershipOf(activeMemberships(p), GUILDS.MagesGuild), 'a vampire join lands in the vampire book');
  cureVampirism(p, {});
  assert.ok(membershipOf(activeMemberships(p), GUILDS.FightersGuild), 'the cure reads the mortal book again');
  assert.equal(membershipOf(activeMemberships(p), GUILDS.MagesGuild), null, 'the vampire ranks wait in theirs');
  assert.ok(membershipOf(p.guildMemberships.vampire, GUILDS.MagesGuild), 'both books persist - DFU serializes both');
});

test('V2e: a pre-V2e plain book migrates IN PLACE as the mortal book', () => {
  const p = P();
  const legacy = {};
  joinGuild(legacy, GUILDS.ThievesGuild, 50);
  p.guildMemberships = legacy;   // the shape every save before this slice carries
  const book = activeMemberships(p);
  assert.ok(isMembershipStore(p.guildMemberships), 'migrated to the two-book store');
  assert.equal(p.guildMemberships.mortal, legacy, 'the plain book IS the mortal book, same object');
  assert.ok(membershipOf(book, GUILDS.ThievesGuild), 'nothing lost');
  // and a live curse on top of a legacy book cannot read the wrong one
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(membershipOf(activeMemberships(p), GUILDS.ThievesGuild), null);
});

test('V2e: the save carries BOTH books, deep-copied; a legacy snap restores as the mortal book', () => {
  const p = P();
  joinGuild(activeMemberships(p), GUILDS.FightersGuild, 100);
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  joinGuild(activeMemberships(p), GUILDS.MagesGuild, 200);
  const snap = snapshotPlayer(p);
  assert.ok(isMembershipStore(snap.guildMemberships), 'the store shape rides the envelope');
  const q = P();
  restorePlayer(q, snap);
  assert.ok(membershipOf(q.guildMemberships.mortal, GUILDS.FightersGuild), 'the mortal book restores');
  assert.ok(membershipOf(q.guildMemberships.vampire, GUILDS.MagesGuild), 'the vampire book restores');
  q.guildMemberships.mortal[GUILDS.FightersGuild.guildGroup].rank = 9;
  assert.notEqual(snap.guildMemberships.mortal[GUILDS.FightersGuild.guildGroup].rank, 9,
    'rows are COPIES - the restored book cannot mutate the snapshot');
  // legacy: a plain-object snap (every save before this slice) - from
  // a MORTAL snapshot, because the snap above carries the curse in
  // activeEffects and a restored vampire correctly reads the OTHER book
  const legacyBook = {};
  joinGuild(legacyBook, GUILDS.ThievesGuild, 0);
  const r = P();
  restorePlayer(r, { ...snapshotPlayer(P()), guildMemberships: legacyBook });
  assert.ok(!isMembershipStore(r.guildMemberships), 'restores as the plain book it was...');
  assert.ok(membershipOf(activeMemberships(r), GUILDS.ThievesGuild), '...which activeMemberships migrates and reads as mortal');
});

test('V2e: clearMembershipData still clears BOTH books (:298-302)', () => {
  const store = newMembershipStore();
  joinGuild(membershipsFor(store, false), GUILDS.FightersGuild, 1);
  joinGuild(membershipsFor(store, true), GUILDS.MagesGuild, 1);
  clearMembershipData(store);
  assert.deepEqual(store, { mortal: {}, vampire: {} });
});

// ── 2. GetRandomCemetery (:194-217) + the deploy's transfer slot ──

test('V2e: the cemetery pick walks the mapTable for dungeonType 18, uniform; none answers null where DFU throws', () => {
  const mapTable = [
    { dungeonType: DUNGEON_TYPES.NoDungeon },
    { dungeonType: DUNGEON_TYPES.Cemetery },
    { dungeonType: DUNGEON_TYPES.Prison },
    { dungeonType: DUNGEON_TYPES.Cemetery },
  ];
  assert.equal(randomCemeteryLocationIndex(mapTable, () => 0), 1, 'the first cemetery at the roll floor');
  assert.equal(randomCemeteryLocationIndex(mapTable, () => 0.99), 3, 'the last at the ceiling');
  assert.equal(randomCemeteryLocationIndex([{ dungeonType: 0 }]), null, 'a crypt is not a cemetery');
  assert.equal(randomCemeteryLocationIndex([]), null, 'no cemetery: null, never a throw');
});

test('V2e: the deploy transfers BETWEEN the clock raise and the popup - vampirism only', () => {
  const order = [];
  const opts = {
    hourNow: () => 12,
    raiseTime: () => order.push('raise'),
    transferToCemetery: () => order.push('transfer'),
    messageBox: () => order.push('popup'),
  };
  const p = P();
  deployInfection({ infection: INFECTION.Vampirism, regionIndex: 17, deployed: false }, p, opts);
  assert.deepEqual(order, ['raise', 'transfer', 'popup'], 'DFU\'s own order (:159-190)');
  assert.ok(p.racialOverridePending, 'the pending marker still lands');
  // the werewolf's deploy is the quiet one - no raise, no transfer
  const w = P();
  order.length = 0;
  deployInfection({ infection: INFECTION.Werewolf, regionIndex: 17, deployed: false }, w, opts);
  assert.deepEqual(order, [], 'DeployFullBlownLycanthropy (:120-126) does none of it');
});

test('V2e: the transfer arm is the WORLD host\'s, and survives worldModes\' re-registration', () => {
  const sh = read('src/scenes/shared.js');
  assert.ok(sh.includes('transferToCemetery = null') && sh.includes('transferToCemetery,'),
    'wireInfectionVideos passes the arm through to setInfectionHost');
  const w = read('src/scenes/world.js');
  assert.ok(w.includes('function transferToCemeteryArm()'), 'the world host implements it');
  assert.ok(w.includes('randomCemeteryLocationIndex(mapTable)'), 'over the pure pick');
  assert.ok(w.includes("(modes?.mode ?? 'exterior') !== 'exterior'"), 'interior/dungeon modes skip loudly');
  assert.ok(w.includes('_lastEncMinutes = Math.floor(playerTicker.classicMinutes);'),
    'PreventEnemySpawns parity - the player is the monster in the crypt');
  assert.ok(w.includes('transferToCemetery: transferToCemeteryArm'), 'wired at the infection mount AND the modes bag');
  const wm = read('src/scenes/worldModes.js');
  assert.ok(wm.includes('transferToCemetery: host.transferToCemetery ?? null'),
    'worldModes\' re-registration forwards the outer host\'s arm instead of dropping it');
});
