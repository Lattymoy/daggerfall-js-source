// SCALE4f part two (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while
// also increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE4f): THE CHARACTER'S MEMBERSHIP, READ ONCE BY THE
// MINT. The guild's badge (guilds.js guildBadgeOf), the seat badge (seatTurning.js seatBadgeOf) and the Season's ribbon
// (seatRibbons.js ribbonOf) each read the named character's guild_members row for itself - three statements of one row
// on every mint. The mint now reads it once (guilds.js mintMemberOf) and hands it to each, which keeps its own law over
// it; asked without it, each reads as it always has. Held here: the three asked with the one read answer exactly what
// they answer reading for themselves, over every state a membership can be in, and the mint reads the row once.
// tools/mutants/scale4f_guild.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { d1, standService, T0 } from '../accountDb.mjs';
import { mintMemberOf, guildBadgeOf } from '../../server-account/src/guilds.js';
import { seatBadgeOf } from '../../server-account/src/seatTurning.js';
import { ribbonOf } from '../../server-account/src/seatRibbons.js';
import { GUILD_RANK_MASTER } from '../../src/net/guild/guildLaw.js';

const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

const P = 'player-0001', C = 'char-0001';
const HERALDRY = JSON.stringify({ field: 'azure', border: 'gold', device: 'wolf' });   // a lawful banner (heraldryLaw.js heraldryOf) - its ribbon azure and gold, not the plain one

/** A database standing one membership state. */
function stood({ member = true, guild = true, rank = 3, joined = 1_000, heraldry = HERALDRY, holds = [], ribbons = [] } = {}) {
  const db = d1();
  const raw = db._raw;
  raw.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'Aldric', 0, 0)").run(P);
  if (!guild) raw.exec('PRAGMA foreign_keys = OFF');   // a member whose guild's row is gone - D1 refuses to leave one, but the read is held to it all the same
  if (guild) raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at, realm_gold, heraldry) VALUES ('gbloodborn1', 'Bloodborne', 'bloodborne', 'BLD', '[]', 0, 0, 0, ?)").run(heraldry);
  if (member) raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at, vault_limit, vault_day, vault_taken) VALUES (?, ?, 'gbloodborn1', ?, 'Aldric', ?, 0, 0, 0)").run(P, C, rank, joined);
  for (const [key, tier, region] of holds) raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, at, tithe, owed) VALUES (?, 'gbloodborn1', ?, ?, 1, 0, 0, 0, 0)").run(key, region, tier);
  for (const [season, at] of ribbons) raw.prepare("INSERT INTO town_seat_ribbons (season, guild_id, at) VALUES (?, 'gbloodborn1', ?)").run(season, at);
  return db;
}

const STATES = [
  ['no membership', { member: false }],
  ['a member, no seats, no ribbon', {}],
  ['the guildmaster, holding a ward and a crown seat', { rank: GUILD_RANK_MASTER, holds: [[101, 'palace', 7], [202, 'crown', 7]] }],
  ['a member under a seat-holding guild', { holds: [[101, 'palace', 7]] }],
  ['a ribbon earned while a member', { ribbons: [[2, 5_000]] }],
  ['a ribbon earned before it joined', { joined: 9_000, ribbons: [[2, 5_000]] }],
  ['a ribbon earned the instant it joined', { joined: 5_000, ribbons: [[2, 5_000]] }],
  ['a ribbon of another Season', { ribbons: [[1, 5_000]] }],
  ['ribbons of two Seasons', { ribbons: [[1, 500], [2, 5_000]] }],
  ['a guild with no heraldry', { heraldry: null, ribbons: [[2, 5_000]] }],
  ['a guild whose heraldry is no JSON', { heraldry: '{nope', ribbons: [[2, 5_000]] }],
  ['a member whose guild is gone', { guild: false, holds: [[101, 'palace', 7]], ribbons: [[2, 5_000]] }],
];

test('SCALE4f part two: the three asked with the mint\'s one read answer what each answers reading for itself - over every state a membership can be in, every Season (mutants: the guild badge off a guild that is gone; the seat badge without the member\'s rank; the ribbon\'s joined bound unread; the ribbon\'s Season unread; the ribbon off a guild that is gone; the heraldry the read\'s)', async () => {
  let worn = 0, badged = 0, ribboned = 0;
  for (const [what, state] of STATES) {
    const db = stood(state);
    const member = await mintMemberOf({ db }, P, C);
    for (const season of [null, { n: 1 }, { n: 2 }, { n: 3 }]) {
      for (const sn of [0, 1, 2]) {
        assert.deepEqual(await seatBadgeOf(db, P, C, sn, member), await seatBadgeOf(db, P, C, sn), `${what}: the seat badge, Season ${sn}`);
      }
      const rb = await ribbonOf(db, P, C, season, member);
      assert.deepEqual(rb, await ribbonOf(db, P, C, season), `${what}: the ribbon, ${JSON.stringify(season)}`);
      if (rb) ribboned++;
    }
    const gb = await guildBadgeOf({ db }, P, C, member);
    assert.deepEqual(gb, await guildBadgeOf({ db }, P, C), `${what}: the guild's badge`);
    if (gb) badged++;
    if ((await seatBadgeOf(db, P, C, 0, member)).glyphs.length) worn++;
  }
  assert.ok(worn >= 3 && badged >= 8 && ribboned >= 3, `both sides of every arm reached (${worn} seat badges, ${badged} guild badges, ${ribboned} ribbons)`);
  for (const bad of [null, 7, 'x', 'has a space']) assert.equal(await mintMemberOf({ db: stood() }, P, bad), null, String(bad));
});

test('SCALE4f part two: the mint reads the character\'s membership ONCE - the seat badge, the ribbon and the guild\'s badge from it - and signs what it signed (mutant: each read again)', async () => {
  const S = await standService({ SEATS_OPEN: 'on' });
  const who = await S.registered('Aldric');
  const { seatRealm } = await import('../realmSeat.mjs');
  const R = await seatRealm(S.env, who.secret, 'Aldric', { name: 'Aldric', level: 9, goldPieces: 100, items: [] });
  S.env.DB._raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at, realm_gold, heraldry) VALUES ('gbloodborn1', 'Bloodborne', 'bloodborne', 'BLD', '[]', 0, 0, 0, ?)").run(HERALDRY);
  S.env.DB._raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at, vault_limit, vault_day, vault_taken) VALUES (?, ?, 'gbloodborn1', 3, 'Aldric', 0, 0, 0, 0)").run(who.id, R.id);
  S.env.DB._sessions.length = 0;
  const r = await S.call('/v1/auth/token', { character: R.id, guild: true }, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.guild, 'BLD', 'the guild\'s tag signed');
  // the character's membership - by its char_id (seatTitlesOf's account-wide read of every guildmaster character is its own)
  const members = S.env.DB._sessions[0].statements.filter((q) => /guild_members/.test(q) && /char_id = \?/.test(q));
  assert.equal(members.length, 1, `one read of the membership (${members.length}): ${members.map((q) => q.replace(/\s+/g, ' ').slice(0, 120)).join(' | ')}`);
});
