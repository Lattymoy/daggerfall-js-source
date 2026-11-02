// FIELD BUGS 2026-09-29h (TEMPLE-SHELF) - "Can't use Temple library despite meeting rank requirements. I hit rank 4
// (Curate) in the temple of Stendarr and was told that I had library access. Bookshelves were telling me I was the
// wrong rank, though."
//
// The rank law was right (Temple.cs:466-469, Stendarr's library at 4, guildVariants.js). The shelf never reached it:
// DaggerfallBookshelf.ReadBook asks GuildManager.GetGuild(factionID), whose GetGuildGroup (GuildManager.cs:269-291)
// turns a DIVINE's faction - what a temple's building carries, ggroup None in FACTION.TXT - into its first child's
// group, the HolyOrder. The port's openBookshelf read the record's own ggroup, None, so createGuildForGroup answered no
// guild and bookshelfAccess refused every member of every temple at every rank with accessMembersOnly.
//
// The pin runs openBookshelf's own resolution, lifted off worldModes.js, over the real guild modules, a faction record
// shaped as FACTION.TXT's (the divine's ggroup None, the templar order its child) and a membership the real producers
// mint (joinGuild, then the rank the promotion writes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGuildForGroup } from '../../../src/systems/guild/guildVariants.js';
import { guildGroupOfFaction, membershipOf, activeMemberships, joinGuild } from '../../../src/systems/guild/guilds.js';
import { bookshelfAccess } from '../../../src/systems/bookshelf.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';

const WM = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
const ACCESS_TEXT = 'You need to be a member of sufficient rank to access this.';

/** openBookshelf's resolution, from its first line to the access answer, as the host runs it. */
function shelfGate() {
  const at = WM.indexOf('  function openBookshelf(shelf, b) {');
  assert.ok(at > 0, 'openBookshelf moved');
  const end = WM.indexOf('    if (!access.allowed) {', at);
  assert.ok(end > at, 'openBookshelf no longer asks access.allowed');
  const body = WM.slice(WM.indexOf('\n', at) + 1, end);
  // eslint-disable-next-line no-new-func
  const run = new Function('townTalk', 'playerEntity', 'b', 'createGuildForGroup', 'guildGroupOfFaction', 'membershipOf', 'activeMemberships', 'bookshelfAccess', `${body}\nreturn access;`);
  return (townTalk, playerEntity, b) => run(townTalk, playerEntity, b, createGuildForGroup, guildGroupOfFaction, membershipOf, activeMemberships, bookshelfAccess);
}

// FACTION.TXT's shape for two of the eight: the divine (type God, ggroup None) over its templar order (HolyOrder)
const STENDARR = 33, ARKAY = 21;
const dict = new Map([
  [STENDARR, { id: STENDARR, type: FACTION_TYPES.God, ggroup: GUILD_GROUPS.None, children: [990] }],
  [990, { id: 990, parent: STENDARR, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.HolyOrder, children: [] }],
  [ARKAY, { id: ARKAY, type: FACTION_TYPES.God, ggroup: GUILD_GROUPS.None, children: [991] }],
  [991, { id: 991, parent: ARKAY, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.HolyOrder, children: [] }],
]);
const templeShelf = (factionId) => ({ factionId, buildingType: BUILDING_TYPES.Temple });
/** A player in `divine`'s temple at `rank`, as joinGuild mints the membership and a promotion writes its rank. */
function memberOf(factionId, rank) {
  const player = {};
  const temple = createGuildForGroup(GUILD_GROUPS.HolyOrder, factionId, dict);
  const m = joinGuild(activeMemberships(player), temple, { year: 405, month: 0, day: 0 });
  m.rank = rank;
  return player;
}

test('TEMPLE-SHELF: a Curate of Stendarr reads Stendarr\'s shelves - the library\'s own rank, 4 (mutant: the record\'s own ggroup)', () => {
  const gate = shelfGate();
  const townTalk = { factionDict: dict };
  assert.equal(gate(townTalk, memberOf(STENDARR, 4), templeShelf(STENDARR)).allowed, true, 'rank 4, the Curate the report names');
  assert.equal(gate(townTalk, memberOf(STENDARR, 9), templeShelf(STENDARR)).allowed, true, 'and every rank above');
  const low = gate(townTalk, memberOf(STENDARR, 3), templeShelf(STENDARR));
  assert.deepEqual([low.allowed, low.text], [false, ACCESS_TEXT], 'an Acolyte is still below Stendarr\'s library (Temple.cs:140)');
});

test('TEMPLE-SHELF: GetGuild\'s other answers stand - another temple\'s member and a stranger are refused, a Library is public', () => {
  const gate = shelfGate();
  const townTalk = { factionDict: dict };
  assert.equal(gate(townTalk, memberOf(ARKAY, 9), templeShelf(STENDARR)).allowed, false, 'a Patriarch of Arkay is no member of Stendarr\'s temple');
  assert.equal(gate(townTalk, {}, templeShelf(STENDARR)).allowed, false, 'a stranger');
  assert.equal(gate(townTalk, {}, { factionId: STENDARR, buildingType: BUILDING_TYPES.Library }).allowed, true, 'a Library asks no guild');
  assert.equal(gate({ factionDict: null }, memberOf(STENDARR, 9), templeShelf(STENDARR)).allowed, false, 'no faction file yet: no guild to ask');
});
