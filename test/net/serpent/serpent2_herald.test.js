// SERPENT2 (2026-10-04, the owner, on the sea serpent: "So this also shows in the pause menu timer?", then "This needs to
// happen, the discord integration needs to happen"): THE SERPENT'S HERALD AND ITS TIMERS, DRIVEN. The law
// (net/serpent/serpentHerald.js: the bells' post and the kill's, when each is owed, the site the accounts agree on and the kill
// AT it), the wire's `site` word (net/wire.js), the hub over the real Room with Discord stubbed (server/src/index.js: the
// alarm at the bells, the posts, a forged site's kill never posted, a refusal posted again, nothing without a webhook),
// the client's word (net/online.js sendSerpentSite, systems/serpent/serpentOmen.js ahead, scenes/world.js), and the Timers
// window's rows (systems/eventTimers.js, ui/enhanced/enhancedTimers.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  serpentHeraldRole, serpentOmenPost, serpentFellPost, serpentHeraldOmenDue, serpentHeraldFellLive, serpentSiteDayOk, agreedSerpentSite, serpentHeraldKill,
} from '../../../src/net/serpent/serpentHerald.js';
import { foldGateSite, HERALD_RETRY_MS, HERALD_FELL_KEEP_MS, GATE_SITE_SKEW_MS } from '../../../src/net/gate/gateHerald.js';
import { serpentTimes, serpentAt, serpentPhase, SERPENT_DIVE_MS, SERPENT_EVERY_DAYS, SERPENT_SURFACE_MS } from '../../../src/net/serpent/serpentLaw.js';
import {
  validSerpentIn, parseClient, relaySupportsSerpentSite, SERPENT_SITE_RELAY_MIN, SERPENT_KINDS, SERPENT_INTERNAL_FELL, SOCIAL_ROOM, RELAY_VERSION, POSE_BOUND, ACCOUNT_SWEEP_MS, SD_KEY,
} from '../../../src/net/wire.js';
import { createSerpentOmen } from '../../../src/systems/serpent/serpentOmen.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { TIMER_KINDS } from '../../../src/ui/enhanced/enhancedTimers.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';
import { SERPENT_RING_MAP_CSS } from '../../../src/ui/serpentMapMark.js';
import { fakeRoom } from '../../fakeRoom.mjs';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const ROLE = '112233445566778899', OWN = '998877665544332211';
const DAY = 611;   // the owner's own serpent: its bells 15:02:30 UTC 2026-10-04, rising 15:17:30, storm 15:32:30, dive 15:42:30
const T = serpentTimes(DAY);
const s = (ms) => Math.floor(ms / 1000);
const SITE = { sx: 81_000, sz: -42_000, place: 'Sentinel' };
const FORGED = { sx: 81_400, sz: -42_000 };

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 law: THE ROLE - the serpent\'s own when the operator names one, else the gate\'s, else none; a role is a Discord id or nothing (mutants: the gate\'s role first; the own role unread)', () => {
  assert.equal(serpentHeraldRole(OWN, ROLE), OWN);
  assert.equal(serpentHeraldRole('', ROLE), ROLE, 'none named: the gate\'s');
  assert.equal(serpentHeraldRole(undefined, ROLE), ROLE);
  assert.equal(serpentHeraldRole('not-an-id', ROLE), ROLE, 'a role that is no id is none');
  assert.equal(serpentHeraldRole('', ''), null, 'neither: nobody pinged');
  assert.equal(serpentHeraldRole(` ${OWN} `, null), OWN);
});

test('SERPENT2 law: THE BELLS\' POST - the role pinged first and the ONLY mention Discord may make; where it is sighted, when it rises (in each reader\'s own time, and how soon), when it dives (SERPENT4: its waters open till then - the storm closed them once); no place: ringed on the map (mutants: a ping with no role named; every mention allowed; the dive\'s time the rising\'s)', () => {
  assert.equal(new Date(T.omenAt).toISOString(), '2026-10-04T15:02:30.000Z', 'the owner\'s own serpent, on the wall');
  const p = serpentOmenPost({ day: DAY, place: 'Sentinel', role: ROLE });
  assert.equal(p.content, `<@&${ROLE}> **Bells ring in the harbors: a great serpent is sighted off Sentinel.** Sethrakul, the Old Coil, rises <t:${s(T.riseAt)}:R> (<t:${s(T.riseAt)}:t>). It hunts until it dives at <t:${s(T.soundAt)}:t>, and every ship may join until then. One ship alone cannot bring it down: sail out together.`);
  assert.deepEqual(p.allowed_mentions, { roles: [ROLE] }, 'the one role, and nothing else');
  const bare = serpentOmenPost({ day: DAY });
  assert.ok(bare.content.startsWith('**Bells ring in the harbors: a great serpent is sighted on the packet lanes.**'), 'no role: no ping; no place: the lanes');
  assert.ok(bare.content.endsWith(' Its waters are ringed on your map.'));
  assert.deepEqual(bare.allowed_mentions, { parse: [] }, 'nobody');
  assert.equal(serpentOmenPost({ day: DAY, place: 'Sentinel**<@&1>' }).content.includes('off Sentinel1.'), true, 'a place is held to letters and the like');
});

test('SERPENT2 law: THE KILL\'S POST - slain, where, by its top dealers and how many more; pings nobody; a name is letters, digits, spaces, apostrophes and hyphens; no more names than the wire carries (mutants: a ping on the kill; the others miscounted; a name taken raw)', () => {
  const p = serpentFellPost({ day: DAY, place: 'Sentinel', top: ['Ann', 'Bran', 'Cid'], n: 9 });
  assert.equal(p.content, '**Sethrakul is slain** off Sentinel by Ann, Bran, Cid and 6 others. Its hoard goes to the ships that fought it.');
  assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.equal(serpentFellPost({ day: DAY, place: 'Sentinel', top: ['Ann', 'Bran'], n: 3 }).content, '**Sethrakul is slain** off Sentinel by Ann, Bran and 1 other. Its hoard goes to the ships that fought it.');
  assert.equal(serpentFellPost({ day: DAY, top: ['Ann'], n: 1 }).content, '**Sethrakul is slain** by Ann. Its hoard goes to the ships that fought it.');
  assert.equal(serpentFellPost({ day: DAY, top: ['@everyone', '**Bo**', 'Cy', 'Dee'], n: 4 }).content, '**Sethrakul is slain** by everyone, Bo, Cy and 1 other. Its hoard goes to the ships that fought it.', 'three names at most; the rest counted');
  assert.equal(serpentFellPost({ day: DAY }).content, '**Sethrakul is slain**. Its hoard goes to the ships that fought it.');
  assert.equal(serpentFellPost({ day: DAY, top: 'Ann', n: 'x' }).content, '**Sethrakul is slain**. Its hoard goes to the ships that fought it.', 'a bad list is none');
});

test('SERPENT2 law: WHEN THE BELLS ARE OWED - at their own instant; late while it has not risen (a hub asleep through them, a deploy); never twice; never once it has risen; a serpent day alone (mutants: posted after the rising; posted again; the bells\' instant ignored; a quiet day owed)', () => {
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt - 60_000, -1), { day: DAY, at: T.omenAt }, 'before them: at their instant');
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt + 5000, -1), { day: DAY, at: T.omenAt + 5000 }, 'past their instant, unposted: now');
  assert.deepEqual(serpentHeraldOmenDue(T.riseAt - 1, -1), { day: DAY, at: T.riseAt - 1 }, 'until it rises');
  const N = serpentTimes(DAY + SERPENT_EVERY_DAYS);
  assert.deepEqual(serpentHeraldOmenDue(T.riseAt, -1), { day: DAY + SERPENT_EVERY_DAYS, at: N.omenAt }, 'risen: let go, the next owed');
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt + 5000, DAY), { day: DAY + SERPENT_EVERY_DAYS, at: N.omenAt }, 'posted: the next');
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt + 5000, DAY + 40), { day: DAY, at: T.omenAt + 5000 }, 'a day not yet come was no post made');
  assert.equal(serpentHeraldOmenDue(T.omenAt, -1).day % SERPENT_EVERY_DAYS, DAY % SERPENT_EVERY_DAYS);
  assert.equal(N.omenAt - T.omenAt, 4 * 3600_000, 'every four real hours');
  assert.ok(serpentHeraldFellLive(DAY, T.riseAt + 1000));
  assert.ok(serpentHeraldFellLive(DAY, T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS - 1), 'a hub told late, still news');
  assert.ok(!serpentHeraldFellLive(DAY, T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS), 'and then not');
  assert.ok(!serpentHeraldFellLive(DAY + 1, T.riseAt), 'no serpent that day');
});

test('SERPENT2 law: WHERE IT LIES AND WHICH KILL - a word taken for the serpent the clock is about (and the next a moment before the turn); the gate\'s vote law (one account names nothing, two agree); the kill posted is the one AT the agreed site, a forged site\'s waits for ever, once a day while it is news (mutants: any site\'s kill posted; one account enough; a posted day posted again; a stale kill posted)', () => {
  const quiet = T.omenAt - 3600_000;
  assert.equal(serpentAt(quiet).day, DAY);
  assert.ok(serpentSiteDayOk(DAY, quiet), 'the serpent the clock is about');
  assert.ok(!serpentSiteDayOk(DAY + 2, quiet) && !serpentSiteDayOk(DAY - 2, quiet));
  const turn = T.soundAt + SERPENT_DIVE_MS;   // the clock turns to the next serpent here
  assert.ok(serpentSiteDayOk(DAY + 2, turn - GATE_SITE_SKEW_MS + 1), 'the next, a moment before the turn');
  assert.ok(!serpentSiteDayOk(DAY + 2, turn - GATE_SITE_SKEW_MS - 1000));
  assert.ok(!serpentSiteDayOk(DAY, turn), 'a gone serpent\'s');
  assert.ok(!serpentSiteDayOk('611', quiet) && !serpentSiteDayOk(null, quiet));
  let rec = foldGateSite(null, DAY, 'a', SITE.sx, SITE.sz, SITE.place);
  assert.equal(agreedSerpentSite(rec, DAY), null, 'one account: nothing');
  rec = foldGateSite(rec, DAY, 'b', SITE.sx, SITE.sz, SITE.place);
  assert.deepEqual(agreedSerpentSite(rec, DAY), SITE, 'two agree: its native point and its port');
  assert.equal(agreedSerpentSite(rec, DAY + 2), null);
  const at = T.riseAt + 60_000;
  const real = { at, top: ['Ann'], n: 2, sx: SITE.sx, sz: SITE.sz, d: DAY, k: 'fell' };
  const forged = { ...real, top: ['Liar'], n: 1, ...FORGED };
  assert.equal(serpentHeraldKill(null, rec, -1, at), null, 'no kill kept');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [forged] }, rec, -1, at), { wait: true }, 'a forged site\'s kill alone: nothing posted');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [forged, real] }, rec, -1, at), { day: DAY, place: 'Sentinel', top: ['Ann'], n: 2 }, 'the agreed site\'s');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [{ ...real, sx: SITE.sx + 0.4 }] }, rec, -1, at).place, 'Sentinel', 'its native point to the whole unit');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [real] }, null, -1, at), { wait: true }, 'no site agreed yet: it waits');
  assert.equal(serpentHeraldKill({ d: DAY, list: [real] }, rec, DAY, at), null, 'posted already');
  assert.equal(serpentHeraldKill({ d: DAY, list: [real] }, rec, -1, T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS), null, 'no news');
  assert.equal(serpentHeraldKill({ d: 'x', list: [real] }, rec, -1, at), null);
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: 'x' }, rec, -1, at), { wait: true }, 'a bad list holds no kill');
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 wire: the `site` word - its day, its native point to the whole unit and a port its law leaves as it is (never rewritten at the relay); parseClient projects it and drops the rest; said only to a relay that hears it (mutants: a raw place taken; the point unbounded or fractional; the version floor off)', () => {
  assert.ok(SERPENT_KINDS.includes('site'));
  const ok = { k: 'site', d: DAY, sx: SITE.sx, sz: SITE.sz, pl: 'Sentinel' };
  assert.deepEqual(validSerpentIn(ok), ok);
  assert.equal(validSerpentIn({ ...ok, pl: 'Alik\'r Desert, Sentinel' }).pl, 'Alik\'r Desert, Sentinel');
  for (const bad of [{ pl: 'Sentinel**' }, { pl: '<@&1> Sentinel' }, { pl: 'Sen  tinel' }, { pl: ' Sentinel' }, { pl: ', Sentinel' }, { pl: '' }, { pl: 'x'.repeat(65) }, { pl: 5 },
    { sx: POSE_BOUND + 1 }, { sz: -POSE_BOUND - 1 }, { sx: 1.5 }, { sz: '1' }, { d: -1 }, { d: '611' }, { d: 1.5 }]) assert.equal(validSerpentIn({ ...ok, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'serpent', ...ok, extra: 1 }), { hasHello: true }), { t: 'serpent', ...ok });
  assert.equal(SERPENT_SITE_RELAY_MIN, 166);
  assert.equal(RELAY_VERSION, 'world241');   // PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED: world183, CHAP4c (the chapters' seats' titles on the token - past THE WROTHGARIAN ZONE's world177, TAVERN CARDS' world178, HOURS-FIRST's world179, TAVERN-TABLES' world180, TV-BEYOND's world181 and CARDS10's world182 at the merges); SHADOW-CLOAK moved it on after (world167, the cloak's word - PIN MOVED), SERAPH-WINGS after that (world168, the wings word - PIN MOVED), AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED), FEUD after that (world170, the foe record's wind-ups and a revenant's fields - PIN MOVED); CRYSTAL-FIST after it (world171, the Crystal Fist's words - world170 on its branch, renumbered past FEUD's at the merge - PIN MOVED); WATCH-FIX after it (world172, the watch record names its resident - PIN MOVED); SERPENT3 after that (world173, the sea serpent brain - world171 on its branch, renumbered past CRYSTAL-FIST's and WATCH-FIX's at the merges - PIN MOVED); LEGACY7 after that (world174, the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's and SERPENT3's at the merge - PIN MOVED); TEXT-F1 after that (world175, the words a player types starred - PIN MOVED; SUPER-DUNGEONS after that (world176, a re-laid dungeon's room of its own - world171 on its branch, renumbered past CRYSTAL-FIST's at one merge and past WATCH-FIX's, SERPENT3's and LEGACY7's at the next - PIN MOVED); the site's floor stays world166
  assert.ok(relaySupportsSerpentSite('world166') && relaySupportsSerpentSite(RELAY_VERSION) && !relaySupportsSerpentSite('world165') && !relaySupportsSerpentSite(null), 'never said to a relay that would close the socket on it');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
/** The hub over a driven clock with Discord stubbed - the serpent's herald alone (the gate's, on the same door, is
 *  discordgates.test.js's): `posts` is every body sent, `answer` what Discord says. */
async function withHerald(fn, { env = { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE }, start = T.omenAt - 10 * 60_000 } = {}) {
  const r = fakeRoom(SOCIAL_ROOM);
  Object.assign(r.env, env);
  r.room._heraldBeat = async () => {}; r.room._heraldNextAt = () => null;
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = start;
  // SD3: the Super dungeon's director beats on the hub's one alarm too (server/src/index.js _sdBeat) - its record seeded
  // with a rise ten years off, so this harness's alarms are the sweep's and the heralds' alone (the director's own are
  // sd3_relay.test.js's)
  r.store.set(SD_KEY, { s: 0, ph: 'gone', r: -1, at: clock, until: clock, next: clock + 10 * 365 * 86_400_000 });
  const posts = [];
  const discord = { answer: () => ({ ok: true, status: 204 }) };
  Date.now = () => clock;
  globalThis.fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), method: init.method, type: init.headers['content-type'] });
    const a = discord.answer();
    if (a instanceof Error) throw a;
    return a;
  };
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); clock += 10; return ws; };
  const site = (ws, d, sx, sz, pl) => r.raw(ws, JSON.stringify({ t: 'serpent', k: 'site', d, sx, sz, pl }));
  const fell = (d, top, n, at = Date.now(), where = SITE) => r.room.fetch(new Request(`https://relay.internal${SERPENT_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d, at, top, n, sx: where.sx, sz: where.sz, rc: [], here: [] }) }));
  try { await quiet(() => fn({ r, join, site, fell, posts, discord, now: () => clock, set: (t) => { clock = t; } })); } finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('SERPENT2 relay: THE BELLS - the hub\'s alarm armed for them at its first hello; the place two accounts agree on (one lying names nothing); posted once at their instant with the serpent\'s role pinged, the next armed; a refusal or a throw posted again HERALD_RETRY_MS on; a serpent that rose unposted let go (mutants: the alarm left at the sweep\'s; one account naming the place; posted twice; a refusal marked posted; the gate\'s role pinged over the serpent\'s own)', async () => {
  await withHerald(async ({ r, join, site, posts, discord, set }) => {
    const a = await join('a'), b = await join('b'), c = await join('c');
    assert.equal(r.alarm.at, T.omenAt, 'armed for the bells, hours before the sweep');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place);
    await site(c, DAY, FORGED.sx, FORGED.sz, 'Daggerfall');
    await site(a, DAY, FORGED.sx, FORGED.sz, 'Daggerfall');   // a's second word: nothing
    assert.equal(agreedSerpentSite(r.store.get('serpentsite'), DAY), null, 'one account each: nothing named yet');
    await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    assert.deepEqual(agreedSerpentSite(r.store.get('serpentsite'), DAY), SITE, 'two accounts agree');
    await site(b, DAY + 2, SITE.sx, SITE.sz, SITE.place);   // a day the clock is not about
    assert.equal(r.store.get('serpentsite').d, DAY, 'another day\'s word is not kept');
    assert.equal(r.store.has('gatesite'), false, 'the gate\'s record untouched');
    assert.equal(posts.length, 0, 'nothing said before the bells');
    set(T.omenAt); await r.fire();
    assert.equal(posts.length, 1, 'the bells, at their instant');
    assert.equal(posts[0].url, HOOK); assert.equal(posts[0].method, 'POST'); assert.equal(posts[0].type, 'application/json');
    assert.deepEqual(posts[0].body, serpentOmenPost({ day: DAY, place: 'Sentinel', role: OWN }));
    assert.ok(posts[0].body.content.startsWith(`<@&${OWN}> **Bells ring in the harbors: a great serpent is sighted off Sentinel.**`), 'the serpent\'s own role');
    assert.equal(r.store.get('sherald').omen, DAY);
    const N = serpentTimes(DAY + 2);
    assert.equal(r.alarm.at, N.omenAt, 'the next serpent\'s bells armed');
    await r.fire();
    assert.equal(posts.length, 1, 'never twice');
    // Discord refuses, then throws, then takes it
    discord.answer = () => ({ ok: false, status: 429 });
    set(N.omenAt); await r.fire();
    assert.equal(posts.length, 2); assert.equal(r.store.get('sherald').omen, DAY, 'a refusal is no post');
    assert.equal(r.alarm.at, N.omenAt + HERALD_RETRY_MS, 'posted again HERALD_RETRY_MS on');
    discord.answer = () => new Error('network');
    set(N.omenAt + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 3); assert.equal(r.store.get('sherald').omen, DAY);
    discord.answer = () => ({ ok: true, status: 204 });
    set(N.omenAt + 2 * HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 4); assert.equal(r.store.get('sherald').omen, DAY + 2);
    assert.ok(posts[3].body.content.includes('sighted on the packet lanes'), 'nobody said where the next one lies');
    // a serpent that rose while nothing fired
    const T4 = serpentTimes(DAY + 4);
    set(T4.riseAt + 1000); await r.fire();
    assert.equal(posts.length, 4, 'let go - it has risen');
    assert.equal(r.alarm.at, serpentTimes(DAY + 6).omenAt);
  }, { env: { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE, SERPENT_DISCORD_ROLE: OWN } });
  // no role of its own: the gate's
  await withHerald(async ({ posts, set, join, r }) => {
    await join('a');
    set(T.omenAt); await r.fire();
    assert.ok(posts[0].body.content.startsWith(`<@&${ROLE}> **Bells ring`));
    assert.deepEqual(posts[0].body.allowed_mentions, { roles: [ROLE] });
  });
});

test('SERPENT2 relay: THE KILL - posted the moment the hub hears it AT THE AGREED SITE, with its port, its top dealers and no ping, once a day however often a cell tells it; a FORGED site\'s kill is never posted (waited on, then let go once it is no news); a kill told long after is not posted; a refusal posted again (mutants: any site\'s kill posted; posted twice; a refusal marked posted; the wait never re-armed)', async () => {
  await withHerald(async ({ r, join, site, fell, posts, discord, now, set }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place); await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.omenAt); await r.fire();
    assert.equal(posts.length, 1, 'the bells');
    // a liar's fight at a site of its own ends first
    set(T.riseAt + 4 * 60_000);
    assert.equal((await fell(DAY, ['Liar'], 1, now(), FORGED)).status, 200);
    assert.ok(r.alarm.at <= now(), 'the alarm armed now');
    await r.fire();
    assert.equal(posts.length, 1, 'a forged site\'s kill: nothing posted');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS, 'and looked at again');
    assert.equal(r.store.get('sherald').fell, -1);
    // the honest fight's kill, Discord refusing it first
    set(now() + 60_000);
    discord.answer = () => ({ ok: false, status: 500 });
    await fell(DAY, ['Ann', 'Bran', 'Cid'], 15);
    await r.fire();
    assert.equal(posts.length, 2); assert.ok(posts[1].body.content.includes('is slain'));
    assert.equal(r.store.get('sherald').fell, -1, 'a refusal is no post');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS);
    discord.answer = () => ({ ok: true, status: 204 });
    set(now() + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 3);
    assert.deepEqual(posts[2].body, serpentFellPost({ day: DAY, place: 'Sentinel', top: ['Ann', 'Bran', 'Cid'], n: 15 }));
    assert.ok(!posts[2].body.content.includes('Liar'), 'never the liar\'s');
    assert.deepEqual(posts[2].body.allowed_mentions, { parse: [] }, 'no ping');
    assert.equal(r.store.get('sherald').fell, DAY);
    await fell(DAY, ['Ann', 'Bran', 'Cid'], 15);
    await r.fire();
    assert.equal(posts.length, 3, 'once a day');
    assert.equal(r.alarm.at, serpentTimes(DAY + 2).omenAt, 'nothing owed but the next bells');
  });
  // a forged site's kill alone: waited on while it is news, then let go
  await withHerald(async ({ r, join, site, fell, posts, set, now }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place); await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.riseAt + 60_000);
    await fell(DAY, ['Liar'], 1, now(), FORGED);
    await r.fire();
    set(T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS); await r.fire();
    assert.equal(posts.length, 0, 'never posted');
    assert.equal(r.alarm.at, serpentTimes(DAY + 2).omenAt, 'no news: no longer looked at');
  }, { start: T.riseAt });
  // no site agreed: a kill waits, and is posted the moment a second account names its site
  await withHerald(async ({ r, join, site, fell, posts, set, now }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.riseAt + 60_000);
    await fell(DAY, ['Ann'], 2);
    await r.fire();
    assert.equal(posts.length, 0, 'one account: no site, no post');
    await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(now() + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body.content, '**Sethrakul is slain** off Sentinel by Ann and 1 other. Its hoard goes to the ships that fought it.');
  }, { start: T.riseAt });
  // told long after: not news
  await withHerald(async ({ r, join, site, fell, posts, set }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place); await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS + 1);
    await fell(DAY, ['Late'], 1, T.riseAt + 60_000);
    await r.fire();
    assert.equal(posts.filter((p) => p.body.content.includes('slain')).length, 0);
  }, { start: T.riseAt });
});

test('SERPENT2 relay: NO WEBHOOK, NO HERALD - nothing posted, nothing kept of what was posted, the sweep armed as it always was; a webhook that is not Discord\'s is none; a `site` outside the hub is junk (mutants: the herald ignoring its door; a cell taking a site)', async () => {
  for (const env of [{}, { GATE_DISCORD_WEBHOOK: 'https://example.com/hook', SERPENT_DISCORD_ROLE: OWN }]) {
    await withHerald(async ({ r, join, site, fell, posts, now, set }) => {
      const a = await join('a');
      assert.equal(r.alarm.at, now() - 10 + ACCOUNT_SWEEP_MS, 'the sweep\'s, untouched');
      await site(a, DAY, SITE.sx, SITE.sz, SITE.place);
      set(T.omenAt); await r.fire();
      set(T.riseAt + 1000); await fell(DAY, ['Ann'], 1); await r.fire();
      assert.equal(r.store.has('sherald'), false);
      assert.equal(posts.length, 0);
    }, { env });
  }
  const cell = fakeRoom('world:6,9');
  const ws = cell.connect(); await cell.hello(ws, 'peer-x', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { acct: 'acct-x', asecret: 'secret-of-acct-x' });
  await quiet(() => cell.raw(ws, JSON.stringify({ t: 'serpent', k: 'site', d: DAY, sx: 1, sz: 1, pl: 'Sentinel' })));
  assert.equal(ws.meters.junk, 1, 'a cell takes no site');
  assert.equal(cell.store.has('serpentsite'), false);
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 client: the game says where it found the serpent to the hub - once a socket and day, a reconnect says it again; its point to the whole unit and its port as the wire\'s law leaves it; never without an account, to a relay that would close on it, or when the send fails (mutants: said every frame; said to world165; the place sent raw)', () => {
  const link = (v = RELAY_VERSION, acct = 'acct-me') => {
    const { FakeWS, sockets } = fakeSocketClass();
    const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, acct, asecret: 'secret-of-acct-me' });
    o.join(SOCIAL_ROOM, null);
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
    const sites = () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'serpent' && m.k === 'site');
    return { o, ws, sites, sockets };
  };
  const { o, sites, ws } = link();
  assert.equal(o.sendSerpentSite(DAY, 81_000.4, -42_000.6, 'St. Olms*'), true);
  assert.deepEqual(sites(), [{ t: 'serpent', k: 'site', d: DAY, sx: 81_000, sz: -42_001, pl: 'St Olms' }], 'its point to the whole unit, the port as the wire\'s law leaves it');
  assert.equal(o.sendSerpentSite(DAY, 81_000, -42_000, 'Sentinel'), true, 'said already');
  assert.equal(sites().length, 1, 'once a socket and day');
  assert.equal(o.sendSerpentSite(DAY + 2, 5, 6, 'Wayrest'), true); assert.equal(sites().length, 2, 'the next serpent');
  o._ws = { send: () => { throw new Error('gone'); } };
  assert.equal(o.sendSerpentSite(DAY + 4, 5, 6, 'Wayrest'), false, 'a send that fails is said again');
  o._ws = ws;
  assert.equal(link('world165').o.sendSerpentSite(DAY, 1, 1, 'Wayrest'), false, 'a relay that would close the socket on it');
  assert.equal(link('world165').sites().length, 0);
  assert.equal(link(RELAY_VERSION, null).o.sendSerpentSite(DAY, 1, 1, 'Wayrest'), false, 'no account, no word');
  const off = link();
  assert.equal(off.o.sendSerpentSite(DAY, POSE_BOUND * 2, 1, 'Wayrest'), false, 'off the world');
  assert.equal(off.o.sendSerpentSite(DAY, POSE_BOUND * 2, 1, 'Wayrest'), true, 'and asked no more that day');
  assert.equal(off.o.sendSerpentSite(DAY + 2, NaN, 1, 'Wayrest'), false, 'no point');
  assert.equal(off.sites().length, 0);
});

test('SERPENT2 client: the omen finds the site AHEAD of the bells (from its quiet on, once it is settled) - the one the omen will name, asked once a day; the scene says it to the hub on the serpent\'s frame (mutants: ahead before the omen settles; another day\'s site; said only from the bells)', () => {
  let clock = T.omenAt - 3600_000, ready = false, asked = 0;
  const site = (day) => { asked++; return { day, sx: SITE.sx, sz: SITE.sz, near: 'Sentinel', place: 'Sentinel, Alik\'r Desert', ring: { cx: 0, cy: 0, r: 3 } }; };
  const omen = createSerpentOmen({ now: () => clock, site, say: () => {}, ready: () => ready, settleMs: 1000 });
  omen.frame();
  assert.equal(omen.ahead(), null, 'not ready: nothing');
  ready = true; omen.frame();
  assert.equal(omen.ahead(), null, 'settling');
  clock += 1000; omen.frame();
  assert.equal(omen.current().phase, 'quiet');
  const a = omen.ahead();
  assert.equal(a.day, DAY); assert.equal(a.site.near, 'Sentinel');
  omen.ahead(); clock = T.omenAt; omen.frame();
  assert.equal(asked, 1, 'the omen\'s own site, found once');
  clock = T.soundAt + SERPENT_DIVE_MS; omen.frame();
  assert.equal(omen.ahead().day, DAY + 2, 'the next serpent once this one is gone');
  const none = createSerpentOmen({ now: () => clock, site: () => null, say: () => {} });
  none.frame();
  assert.equal(none.ahead(), null, 'no site found: nothing said');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const serpentFrame = \(\) => \{\n\s*try \{ serpentOmen\?\.frame\(\); \}[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*try \{ const a = serpentOmen\?\.ahead\?\.\(\); if \(a\) socialLink\(\)\?\.sendSerpentSite\?\.\(a\.day, a\.site\.sx, a\.site\.sz, a\.site\.near\); \}/, 'on the serpent\'s frame, after its omen');
});

test('SERPENT2 config: the role is a var beside the gate\'s, empty by default (the gate\'s pinged); the webhook is the gate\'s secret; the relay reads the serpent\'s role by the name the bible gives', () => {
  const toml = rd('server/wrangler.toml');
  assert.match(toml, /^SERPENT_DISCORD_ROLE = "\d*"$/m);
  assert.ok(!/^SERPENT_DISCORD_WEBHOOK\s*=/m.test(toml) && !/discord(?:app)?\.com\/api\/webhooks\/\d/.test(toml), 'no webhook written down');
  assert.match(rd('server/src/index.js'), /serpentHeraldRole\(role\('serpentRole'\), role\('gateRole'\)\)/);   // PIN MOVED (SCALE5b): SERPENT_DISCORD_ROLE and GATE_DISCORD_ROLE through relayCfgValue - the hub's settings over the vars (net/relayCfg.js)
});

// ═══ THE TIMERS WINDOW ═══════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 timers: the serpent\'s row through its day - its rising counted down (the port named from its bells on), its hunt to its dive (SERPENT4: to the storm once, then its closed waters to the dive), and the next serpent beside it once this one is under way; a kill ends it early (mutants: the place named before the bells; the hunt counting to the storm; no next row)', () => {
  const rowsAt = (now, serpent = null) => eventTimerRows({ now, serpent }).filter((r) => r.kind === 'serpent');
  const src = { place: 'Sentinel', fellAt: () => null };
  const q = rowsAt(T.omenAt - 60_000, src);
  assert.deepEqual(q, [{ id: `serpent:${DAY}`, kind: 'serpent', title: 'Sethrakul rises', where: null, detail: 'The harbor bells ring 15 minutes before', live: false, at: T.riseAt, until: null }], 'quiet: the rising alone, nowhere named');
  const o = rowsAt(T.omenAt + 1000, src);
  assert.deepEqual(o[0], { id: `serpent:${DAY}`, kind: 'serpent', title: 'Sethrakul rises', where: 'Off Sentinel', detail: 'The harbor bells are ringing. Its waters are circled on your map', live: false, at: T.riseAt, until: null });
  const N = serpentTimes(DAY + 2);
  assert.deepEqual(o[1], { id: `serpent:${DAY + 2}`, kind: 'serpent', title: 'Next sea serpent rises', where: null, detail: null, live: false, at: N.riseAt, until: null });
  for (const at of [T.riseAt + 1, T.riseAt + SERPENT_SURFACE_MS + 1]) {
    const h = rowsAt(at, src);
    assert.equal(h[0].live, true); assert.equal(h[0].title, 'Sethrakul hunts'); assert.equal(h[0].until, T.soundAt); assert.equal(h[0].where, 'Off Sentinel');
  }
  // PIN MOVED: SERPENT4 - no storm closes its waters: past the storm's breaking it hunts on to its dive, one row
  const l = rowsAt(T.sealAt + 1, src);
  assert.equal(l[0].title, 'Sethrakul hunts'); assert.equal(l[0].until, T.soundAt); assert.equal(l[0].detail, 'It dives when this runs out. Sail out to join the hunt');
  assert.deepEqual(rowsAt(T.soundAt + 1, src).map((r) => r.title), ['Next sea serpent rises'], 'sounding: the next alone');
  const fellAt = T.riseAt + 5 * 60_000;
  assert.equal(serpentPhase(T, fellAt + 1, fellAt), 'slain');
  assert.deepEqual(rowsAt(fellAt + 1, { place: 'Sentinel', fellAt: (d) => (d === DAY ? fellAt : null) }).map((r) => r.title), ['Next sea serpent rises'], 'slain: its row ends');
  assert.equal(rowsAt(T.omenAt + 1000)[0].where, null, 'no host: nowhere named');
  assert.deepEqual(rowsAt(T.soundAt + SERPENT_DIVE_MS).map((r) => [r.id, r.title, r.at]), [[`serpent:${DAY + 2}`, 'Sethrakul rises', N.riseAt]], 'gone: the clock is about the next');
  // its kind in the window: after the gate's, in its waters' own colour, named in the button
  assert.deepEqual(TIMER_KINDS.slice(0, 2), ['gate', 'serpent']);
  assert.ok(ENHANCED_CSS.includes(`.px-timerswin .tm-serpent { --tm-kind: ${SERPENT_RING_MAP_CSS}; }`));
  assert.match(rd('src/ui/enhanced/enhancedTimers.js'), /'Timers: gates, the sea serpent, the Abyss Dungeon, the Starfall, raids, battles and resets'/);   // PIN MOVED (SD2c): the Super dungeon's row beside the serpent's; ABYSS-NAME: named the player's way; STAR6: the Starfall's
  const w = rd('src/scenes/world.js');
  assert.match(w, /serpent: \{ place: serpentOmen\?\.current\?\.\(\)\?\.site\?\.near \?\? null, fellAt: \(day\) => \{ const site = serpentOmen\?\.current\?\.\(\)\?\.site; return site && site\.day === day \? serpentLink\?\.fellAt\?\.\(day, site\) \?\? null : null; \} \},/, 'the host hands the omen\'s port and its own site\'s kill');
});
