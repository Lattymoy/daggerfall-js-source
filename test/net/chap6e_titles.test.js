// @ts-nocheck
// CHAP6e (2026-10-09, Mac: "continue", the Chapters arc's sixth slice - bible/11-Multiplayer/Chapters-Arc.md 6 and 7):
// THE SEASON'S TWO TITLES. A Master in its chapter's Ascendancy is its High Master for the Season - signed in the
// Master's place, never worn on its own - and a Master who held the seat a whole Season keeps "Master of the Fighters
// Guild, Anticlere, Season 3" for good. Two generic ids more on the token, the seats' claim beside each; the relay
// carrying them (world182, grown in place - undeployed); the client wording them; the service deriving them.
// GUILD3e (2026-10-11, bible/11-Multiplayer/Guilds-Made-Plain.md): the Ascendancy event folded into the Ascendant band -
// a High Master is the Master of a chapter standing Ascendant (Strength 90 or more), read off the chapter's Strength.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAPTER_TITLES, SEAT_TITLES, TITLES, titleClaimed, claimsValid } from '../../src/net/identityToken.js';
import { badged, readBadge, RELAY_VERSION } from '../../src/net/wire.js';
import { chapterTitleText, chapterTitlesOf, meritWeekOf } from '../../src/net/npcChapterLaw.js';
import { titleBadge, TITLE_TEXT, TITLE_RGBA } from '../../src/ui/playerBadge.js';
import { chapterTitlesOfAccount } from '../../server-account/src/npcChapters.js';
import { standService, T0, confirmChapters } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const FIGHTERS = 41, MAGES = 40, THIEVES = 42, ANTICLERE = 21, DAGGERFALL = 17, BETONY = 19;
const DAY = 86_400;
const NOW = T0 + 30 * 7 * DAY;   // late enough that Season 3 has a Season 0 to count from
const WEEK = meritWeekOf(NOW);
/** Season 3 from WEEK - 1 (Season 0 four weeks, each after it eight). */
const ZERO = WEEK - 21;

// ── THE VOCABULARY AND THE RELAY ────────────────────────────────────

test('CHAP6e the vocabulary: a High Master and a Season\'s Master, last in the closed list, each riding with the seats\' claim; the relay stamps and reads it back (mutants: an id dropped, the claim\'s law)', () => {
  assert.deepEqual([...CHAPTER_TITLES], ['chaptermaster', 'chapterofficer', 'formermaster', 'highmaster', 'seasonmaster']);
  assert.deepEqual(TITLES.slice(-28, -26) /* PIN MOVED (KETCH): the Skyfarer joined the list last */ /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */ /* PIN MOVED (STAR8): the Starwarden joined the list after the questlines' five, before the festival's two */, ['highmaster', 'seasonmaster']);   // PIN MOVED (QL12): the questlines' five joined the list last, after the WikiMaid; PIN MOVED (SERPENT5): Coilbreaker last; PIN MOVED (LAMP-KEEPER II): I Love Lamp joined the list last, after them; PIN MOVED (KG6): The King's Gambit's Grandmaster after it; PIN MOVED (EG-E2, the merges of main): the Spire's thirteen after the Coilbreaker; PIN MOVED (WIKIMAID): the WikiMaid joined the list last
  assert.deepEqual([...TITLES.filter(titleClaimed)], [...SEAT_TITLES, ...CHAPTER_TITLES]);
  const base = { v: 1, s: 'acct-c6e', n: 'Alda', k: 'linked', i: 1000, e: 1060 };
  assert.equal(claimsValid({ ...base, t: 'highmaster', ts: [4121, 3] }), true);
  assert.equal(claimsValid({ ...base, t: 'seasonmaster', ts: [4121, 3] }), true);
  assert.equal(claimsValid({ ...base, t: 'seasonmaster' }), false, 'no claim');
  assert.equal(claimsValid({ ...base, t: 'highmaster', ts: [4121, 10000] }), false, 'past its bounds');
  for (const t of ['highmaster', 'seasonmaster']) {
    const row = {};
    badged(row, { title: t, ts: [4017, 2] });
    assert.deepEqual(row.ts, [4017, 2], `${t}: stamped`);
    assert.deepEqual(readBadge({ title: t, ts: [4017, 2], glyphs: [] }).ts, [4017, 2], `${t}: read back`);
  }
  assert.equal(RELAY_VERSION, 'world266');   // PIN MOVED: world266, AUDIT KETCH II (the airship raid: the whole state word carries the wave to five, a sweep by the ship says sw, the number of a voyage is a receipt bound, the last minutes of her crews forty-five, a fight lost after two minutes, the receipts of a fall told before her record goes; world265 on its branch, renumbered past GATE-COURTS at the merge; NOT YET DEPLOYED); PIN MOVED: world265, GATE-COURTS (the night of a gate held in courts of fifty, each seated by the book of the first; NOT YET DEPLOYED); PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD's world260, #1281's world261 and #1238's world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1's world253 and AUDIT FOE-KEEPS' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED: world185, INT7-INT10 (the INTEGRITY arc's lane 2 - world183, then world184, on its branch, renumbered past CHAP4c's world183 and PERF-RELAY1's world184 at the merges); PIN MOVED: world183 - past CARDS10's world182 at the merge of main
});

// ── THE WORDS ───────────────────────────────────────────────────────

test('CHAP6e the words: "High Master of the Fighters Guild, Anticlere"; "Master of the Mages Guild, Daggerfall, Season 3" - never a Season 0, never past the claim\'s bound, never a hidden guild\'s; the plain words, the colours (mutants: the words, the Season\'s guard, each colour)', () => {
  assert.equal(chapterTitleText('highmaster', [4121, 3]), 'High Master of the Fighters Guild, Anticlere');
  assert.equal(chapterTitleText('seasonmaster', [4017, 3]), 'Master of the Mages Guild, Daggerfall, Season 3');
  assert.equal(chapterTitleText('seasonmaster', [4017, 1]), 'Master of the Mages Guild, Daggerfall, Season 1');
  assert.equal(chapterTitleText('seasonmaster', [4017, 9999]), 'Master of the Mages Guild, Daggerfall, Season 9999');
  assert.deepEqual([chapterTitleText('seasonmaster', [4017, 0]), chapterTitleText('seasonmaster', [4017, 10000]), chapterTitleText('seasonmaster', [4017, 2.5]),
    chapterTitleText('seasonmaster', [4017]), chapterTitleText('seasonmaster', [4221, 3]), chapterTitleText('highmaster', [4221, 3])], [null, null, null, null, null, null]);
  assert.equal(chapterTitleText('chaptermaster', [4121, 3]), 'Master of the Fighters Guild, Anticlere', 'the Master\'s own, unchanged');
  assert.equal(titleBadge({ title: 'seasonmaster', ts: [4017, 2] }).text, 'Master of the Mages Guild, Daggerfall, Season 2');
  assert.equal(titleBadge({ title: 'highmaster', ts: [4121, 3] }).text, 'High Master of the Fighters Guild, Anticlere');
  assert.equal(titleBadge({ title: 'seasonmaster', ts: [4017, 0] }).text, 'Season Master', 'a claim it cannot word: the plain word');
  assert.deepEqual([TITLE_TEXT.highmaster, TITLE_TEXT.seasonmaster], ['High Master', 'Season Master']);
  const hex = (t) => TITLE_RGBA[t].slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  assert.deepEqual(['highmaster', 'seasonmaster'].map(hex), ['5d9cec', '6f8fb8']);
});

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP6e the titles a character\'s seats and Seasons give it: a Master\'s seat in an Ascendancy marked high and first among the Masters\'; an officer\'s never high; each Season held whole, last, newest first, once - never a Season 0, a hidden guild\'s, or a Season it cannot read (mutants: the mark, the order, each guard)', () => {
  const seats = [{ f: MAGES, region: DAGGERFALL, seat: 'master' }, { f: FIGHTERS, region: ANTICLERE, seat: 'master', high: true }, { f: MAGES, region: ANTICLERE, seat: 'officer', high: true },
    { f: FIGHTERS, region: DAGGERFALL, seat: 'master', high: 'yes' }];
  const kept = [{ f: FIGHTERS, region: ANTICLERE, season: 1 }, { f: MAGES, region: BETONY, season: 1 }, { f: MAGES, region: DAGGERFALL, season: 2 },
    { f: MAGES, region: DAGGERFALL, season: 2 }, { f: THIEVES, region: ANTICLERE, season: 2 }, { f: FIGHTERS, region: DAGGERFALL, season: 0 }, { f: FIGHTERS, region: DAGGERFALL, season: NaN }];
  assert.deepEqual(chapterTitlesOf(seats, [], 3, kept), [
    { title: 'chaptermaster', ts: [4121, 3], high: true },
    { title: 'chaptermaster', ts: [4017, 3] }, { title: 'chaptermaster', ts: [4117, 3] },
    { title: 'chapterofficer', ts: [4021, 3] },
    { title: 'seasonmaster', ts: [4017, 2] }, { title: 'seasonmaster', ts: [4019, 1] }, { title: 'seasonmaster', ts: [4121, 1] },
  ]);
  assert.deepEqual(chapterTitlesOf([], [], 3, [{ f: FIGHTERS, region: ANTICLERE, season: 4 }]), [{ title: 'seasonmaster', ts: [4121, 4] }], 'a Season\'s title with no seat now');
  assert.deepEqual(chapterTitlesOf([{ f: FIGHTERS, region: ANTICLERE, seat: 'master' }], [], 3), [{ title: 'chaptermaster', ts: [4121, 3] }], 'none kept: CHAP4c\'s own');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** A service with the Chapters open, CHAPTER_TITLES `titles` and Season 3 counted; a registered account with realm
 *  characters `R` and `other`. */
async function stand(t, { titles = 'on', zero = ZERO } = {}) {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const svc = await standService({ CHAPTERS_OPEN: 'on', CHAPTER_TITLES: titles, ...(zero == null ? {} : { SEASON_ZERO_WEEK: String(zero) }) });
  const raw = svc.env.DB._raw;
  confirmChapters(raw, [DAGGERFALL, ANTICLERE]);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 1);
  const who = await svc.registered('Alda');
  const R = await seatRealm(svc.env, who.secret, 'Alda');
  const other = await seatRealm(svc.env, who.secret, 'Bryn');
  const seat = (char, f, region, s) => raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(f, region, char, who.id, s, WEEK, WEEK, NOW);
  const event = (f, region, ev, season) => raw.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at, event, event_season, event_data) VALUES (?, ?, 50, ?, 0, 0, ?, ?, '{}')
    ON CONFLICT (faction, region) DO UPDATE SET event = excluded.event, event_season = excluded.event_season`).run(f, region, WEEK - 1, ev, season);
  // GUILD3e: a chapter's Strength - an Ascendant chapter's Master is its High Master
  const strength = (f, region, n) => raw.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (?, ?, ?, ?, 0, 0)
    ON CONFLICT (faction, region) DO UPDATE SET strength = excluded.strength`).run(f, region, n, WEEK - 1);
  const held = (char, f, region, data) => raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'season', ?, ?, ?)").run(f, region, WEEK - 2, char, typeof data === 'string' ? data : JSON.stringify(data), NOW);
  const mint = async (character) => (await svc.call('/v1/auth/token', { character }, who.secret)).body;
  const titlesOf = async (character = null) => (await chapterTitlesOfAccount(svc.env.DB, who.id, NOW, zero, character)).map((x) => [x.char === R.id ? 'R' : 'other', x.title, x.ts, x.high ?? false]);
  return { svc, raw, who, R, other, seat, event, strength, held, mint, titlesOf };
}

test('CHAP6e a High Master - GUILD3e (bible/11-Multiplayer/Guilds-Made-Plain.md): a Master\'s seat at a chapter standing Ascendant (Strength 90 or more, as the sheet carries it - the Ascendancy event folded into the band) is signed "highmaster" in the Master\'s place - its claim the Master\'s; never worn on its own; never under 90, at another chapter, an officer\'s; a retired Decline or Ascendancy row moves nothing (mutants: the floor, the narrowing)', async (t) => {
  const s = await stand(t);
  s.seat(s.R.id, MAGES, DAGGERFALL, 'master');
  s.seat(s.R.id, FIGHTERS, ANTICLERE, 'master');
  s.seat(s.other.id, MAGES, ANTICLERE, 'officer');
  s.strength(FIGHTERS, ANTICLERE, 90);
  s.strength(MAGES, ANTICLERE, 95);
  s.strength(MAGES, DAGGERFALL, 89);
  s.event(MAGES, DAGGERFALL, 'ascendancy', 3);   // a retired event's row: no High Master by it
  // PIN MOVED: GUILD3e (bible/11-Multiplayer/Guilds-Made-Plain.md) - a High Master by the band, not the Season's event; marked by AUDIT GUILD3 R4
  assert.deepEqual(await s.titlesOf(s.R.id), [['R', 'chaptermaster', [4121, 3], true], ['R', 'chaptermaster', [4017, 3], false]], 'Ascendant from 90 exactly; 89 is Thriving');
  assert.deepEqual(await s.titlesOf(s.other.id), [['other', 'chapterofficer', [4021, 3], false]], 'an officer\'s at an Ascendant chapter: an officer\'s');
  assert.equal((await s.svc.call('/v1/account/title', { title: 'highmaster' }, s.who.secret)).status, 403, 'never worn on its own');
  const equip = await s.svc.call('/v1/account/title', { title: 'chaptermaster' }, s.who.secret);
  assert.equal(equip.status, 200, JSON.stringify(equip.body));
  assert.ok(!equip.body.titles.includes('highmaster'));
  const m = await s.mint(s.R.id);
  assert.deepEqual([m.title, m.ts], ['highmaster', [4121, 3]], 'the Ascendant chapter\'s seat first, signed High');
  const claims = JSON.parse(Buffer.from(m.token.split('.')[1], 'base64url').toString());
  assert.deepEqual([claims.t, claims.ts], ['highmaster', [4121, 3]], 'in the signed claims');
  s.strength(FIGHTERS, ANTICLERE, 89);
  assert.deepEqual([(await s.mint(s.R.id)).title, (await s.titlesOf(s.R.id)).map((x) => x[3])], ['chaptermaster', [false, false]], 'fallen to Thriving: a Master');
  const none = await stand(t, { zero: null });
  none.seat(none.R.id, FIGHTERS, ANTICLERE, 'master');
  none.strength(FIGHTERS, ANTICLERE, 92);
  assert.deepEqual(await none.titlesOf(none.R.id), [['R', 'chaptermaster', [4121, 0], true]], 'the band is the week\'s, Season or none');
});

test('CHAP6e a Season\'s Master: every Season a character held a Master\'s seat whole titles it for good - with no seat now, at a chapter struck since; its newest signed; never a hidden guild\'s, a dead character\'s, another character\'s, a row it cannot read, nor with the titles shut (mutants: the rows read, the kept chapter, the order, the switch)', async (t) => {
  const shut = await stand(t, { titles: 'off' });
  shut.held(shut.R.id, FIGHTERS, ANTICLERE, { season: 1 });
  assert.equal((await shut.svc.call('/v1/account/title', { title: 'seasonmaster' }, shut.who.secret)).status, 403, 'shut: not held');
  const s = await stand(t);
  assert.equal((await s.svc.call('/v1/account/title', { title: 'seasonmaster' }, s.who.secret)).status, 403, 'none yet');
  s.held(s.R.id, FIGHTERS, ANTICLERE, { season: 1 });
  s.held(s.R.id, MAGES, DAGGERFALL, { season: 2 });
  s.held(s.R.id, MAGES, BETONY, { season: 1 });   // a region whose chapters are not confirmed now
  s.held(s.R.id, THIEVES, ANTICLERE, { season: 2 });   // a hidden guild's
  s.held(s.R.id, FIGHTERS, DAGGERFALL, 'not json');
  s.held(s.other.id, FIGHTERS, DAGGERFALL, { season: 2 });
  assert.deepEqual(await s.titlesOf(s.R.id), [['R', 'seasonmaster', [4017, 2], false], ['R', 'seasonmaster', [4019, 1], false], ['R', 'seasonmaster', [4121, 1], false]]);
  const equip = await s.svc.call('/v1/account/title', { title: 'seasonmaster' }, s.who.secret);
  assert.equal(equip.status, 200, JSON.stringify(equip.body));
  assert.ok(equip.body.titles.includes('seasonmaster') && !equip.body.titles.includes('chaptermaster'));
  const m = await s.mint(s.R.id);
  assert.deepEqual([m.title, m.ts], ['seasonmaster', [4017, 2]], 'the newest Season signed');
  assert.deepEqual([(await s.mint(s.other.id)).ts], [[4117, 2]], 'the other character its own');
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(NOW, s.R.id);
  assert.deepEqual(await s.titlesOf(s.R.id), [], 'a dead character holds nothing');
});

test('CHAP6e the wiring: the relay\'s world182 re-hashed in place, undeployed; the mint signs a High Master in the Master\'s place; the service reads the Chronicle\'s Season rows (mutants: each seam)', () => {
  assert.match(rd('test/net/relayversion.test.js'), /\n  world183: '[0-9a-f]{64}',   \/\/ CHAP4c \(world182 on its branch[^\n]*\(re-hashed in place, undeployed - bytes 3012337d\.\.\. before it: CHAP6e /)   // PIN MOVED: world183 - past CARDS10's world182 at the merge of main;
  assert.match(rd('server-account/src/index.js'), /: CHAPTER_TITLES\.includes\(wornT\) \? \(chapterT \? \{ t: chapterT\.high \? 'highmaster' : wornT, ts: chapterT\.ts \} : \{\}\)/);
  assert.match(rd('server-account/src/npcChapters.js'), /SELECT x\.char_id, x\.faction, x\.region, x\.data FROM npc_chapter_history x \$\{who\}\n\s+AND x\.kind = 'season'`\)/);
  assert.match(rd('server-account/wrangler.toml'), /\nCHAPTER_TITLES = "off"\n/);
});
