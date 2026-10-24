# World Events - Raiding Parties (RAID1, RAID2, RAID3, 2026-09-27; RAID4, 2026-09-28)

Kamer's **World Events - Raiding Parties 1.1**, made for this port. Mac, 2026-09-27: "World event mod was specially built
for us. I want to talk about how this can properly be integrated into online in a detailed way." Asked the design's six
questions, Mac answered "1. Server 2. Keep 3. We can also add renown and it's own atheric + armor sets 4. 4 5. Yes
6. Kamer made this for us". RAID1 is answer 5, the offline port with the mod's own bugs fixed. Provenance is
`vendor/world-events-raiding-parties/README.md` (permission: Kamer made the mod for this port). The code is
`systems/raidingParties.js`.

## What it does

Each game day, towns across the Iliac Bay are raided. The roll picks a region evenly among the travel map's regions
that hold a city, hamlet or village, then a town evenly in that region; a town is raided at most once a day. Each raid
starts between 00:00 and 22:00, lasts two game hours (ten real minutes), and brings one party - knights (Knights),
bandits (Rogue 50%, Thief 30%, Burglar 20%) or orcs (Orc 70%, Sergeant 25%, Warlord 5%) - with 15 to 25 deaths to
drive it off.

- A raid on in the player's region is announced once: "Gothway Garden in Daggerfall is under attack by orcs!" (EVENTS1,
  2026-10-23, `10-UI/Event-Board.md`: the mod's lines - this, the withdrawal and the cleansing - open the HUD's event
  board's news now, with their raid, and are still filed in the journal, as AddHUDText files them; the board off, or
  with no room for its news, the HUD's line again. The board also names every raid of the day a quarter of an hour
  before it starts, the nearest two on its plate.)
- While the player stands outdoors in the raided town, raiders come one at a time, 10-35 units off and just outside
  the view: every 1-10 s (orcs 1-8 s) while fewer than 25 stand. The town's defenders come the same way, every 1-10 s
  while fewer than 8 stand. A defender's clock is checked first.
- Any raider's death counts. At the target the town "has been cleansed of the orc attack!" A player who fought and
  stands on the town's map pixel gains +5 legal reputation in the region, +5 with its People, +3 with the region's
  knightly order (the first one listed, if the region has one) and +3 with the Fighters Guild.
- A raid that runs out its two hours says "The attackers have withdrawn from Gothway Garden in Daggerfall." to a player
  in the region who was told of it.

One switch, `Enabled`, on by default (`systems/modSettings.js` `world-events-raiding-parties`; the Features row under
World, "Takes effect at once"). The mod had no settings.

**The pace (Mac's "4").** A region is raided about once every four real hours: a game day is two real hours at DFU's
clock, so a day rolls half a raid per eligible region (`raidsPerDay`, `RAID_REGION_REAL_HOURS`). The mod's own count
was 23 a day, which is 3.8 real hours at 44 regions. With the travel map's 43-44 eligible regions the port rolls 22.

## How the port carries it

`systems/raidingParties.js` is TownRaids read off its IL (`vendor/world-events-raiding-parties/il/`), and each number
cites its offset: `SelectRaids` [IL_0bd4] as `raidRegions` + `rollRaids`, `Update` [IL_0428] as `raidFrame(dt)`,
`ChooseEnemy` [IL_137c] as `chooseRaider`, `OnEnemyDeath` [IL_0fec] as a poll of the raid's own records,
`GrantReputation` [IL_1240] as `grantRaidReputation`, and `RaidSaveData` on DFU's per-mod slot
(`systems/modSaveData.js`, registered at boot in every host by `installRaidingParties`).

The world host (`scenes/world.js`) answers the seams:

- **the towns** - MAPS.BSA's reader, the game's own rows only (`baseLocationCount`, the gate scan's law, so every client
  reads the same list), and the picker's bytes from the travel map's art (`travelMapPickerData`, TRAV0I01.IMG);
- **the GPS** - the region (and -1 at sea, fix 8), the town while outdoors in its rect (FindCurrentRaid's three tests),
  the map pixel;
- **the raiders** - the street's own pool, placed by DFU's loose-foe law (`hostEnchant.js standLooseFoe`, twelve tries)
  on the mod's 10-35 band, `loose` (no encounter cap refuses one; they still count toward it, so a raid crowds out the
  wilderness rolls) and `transient` (no save carries one; after a load the raid stands them again);
- **the defenders** - the town watch's own (`cityGuards.standDefender`, new here: one watchman at a time, minted as
  DISC19-F's `summonDefenders` mints its fallback arm - the player's ally, sent at the nearest raider). The cap of 8
  counts every defender standing, the watch's own among them. The watch's switch would send each one home on the frame
  it came, so `_townWatchFrame` keeps the watch up while a raid is on in the town (`raidDefendingHere`). A crime on the
  player or a transformed beast gets no defenders, as with the watch;
- **the reward** - the player and the faction store (`_questStore`);
- **the frames** - once in the street, after the pools move and the watch answers (so a death counts on the frame it
  falls), and once in the modal branch (the roll, the announcements and the expiry run indoors too; nothing is stood
  there). Both are given the frame's time, held by a pause.

## The mod's bugs, and what each is here

These are departures, and Port-Ledger section A carries them.

1. **The day's raids are the day's.** The roll draws from the day's own generator (`worldTick.js dayRng`, a new
   `DAY_SALT.raids`). The mod's `UnityEngine.Random` re-rolled a day's towns at every reload. The same day now rolls
   the same towns for every player, which is what RAID2 needs. The spawn clocks and species stay under THE ENGINE-PRNG
   RULE (an injectable roll).
2. **"Withdrawn" only of a raid the player was told of.** On a day's first frame the mod expired every raid whose hours
   had passed and announced each in the player's region: a new game at 13:30 heard of about half a day's raids at once.
3. **Announced once, remembered in the save.** The mod forgot at every load and announced the raid again.
4. **The defenders are the town's watch.** The mod's were Knights re-skinned every three seconds. Killing one was no
   crime, their Knight loot could be farmed, and after a load they showed a Knight's sprite and bow for three seconds.
5. **The reward needs a player who fought.** A blow on one of the raid's raiders (the Renown tracker's own stamp,
   `renownStruckAt`) is required as well as the mod's map pixel. The mod paid a player standing indoors on the pixel
   while the watch did the work. Any death still counts toward the cleanse.
6. **What is left stands down out of sight.** The mod destroyed every raider and defender at the cleanse, the timeout
   and midnight, mid-swing and in view. Here an ended raid's raiders fight on, uncounted, while seen, and go at the first
   3-second sweep that finds them out of the view's cone (`outOfSight`, the view plus a 10-degree margin). Defenders
   stand down by the watch's own law.
7. **The spawn clocks hold with the game.** They ran on `Time.realtimeSinceStartup` through a pause, so raiders piled up
   to the caps behind an open menu.
8. **Nothing is announced or withdrawn at sea.** PlayerGPS reads the sea's politic 64 as region 31 and an unmapped pixel
   as 0.
9. **A raid ending on the day's last minute gets its "withdrawn".** The mod's day roll discarded it before its expiry
   pass could see it. Here the old day's raids expire first.
10. **A spot not found costs nothing.** The mod's spawner searched for eight seconds and then held both clocks ten more,
    so a cramped street starved the raid. The placement here is whole in one call, and a miss waits for the clock's own
    next tick. The 8 s lapse and 10 s back-off remain for a spawn that never lands.
11. **"The orc attack"**, not the mod's "the orcs attack".

**Kept as the mod has it.** The region is picked evenly, not the town, so towns in small regions are raided more often.
Mac's "4" is a per-region pace. A day skipped whole (a long rest or journey) never rolls. A raid is two game hours
however fast the clock runs, and a cleansed raid stays in the list, inert, until its end.

## Online (RAID2, 2026-09-27)

Mac's answers set the plan: RAID2 puts the raid on the online world; RAID3 ("Server") has the relay keep each raid's
count, cleanse and participants and sign the rewards (a relay deploy); RAID4 adds Renown and the raids' own Aetheric
items and armor sets. RAID2 needed no wire or relay change - the relay reads a foes frame's record count and nothing
else (`world/raidShared.js` validates everything new, at the reader). RAID3 is below.

- **The same raids everywhere.** The roll is the shared day's (fix 1), so every client names the same towns, times,
  parties and targets. Announcements and "withdrawn" stay each client's own, off that shared list.
- **One runner.** A player standing in a raided town runs its raid only if it wins WOD7's claim law
  (`raidRunnerOf`): every claim heard, oldest first - a later claim takes it only inside `RAID_CLAIM_WINDOW_MS`
  (5 s) and with the smaller id. With no claim, the smallest id standing in the town claims it, and a larger one
  claims once a smaller has left it unclaimed `RAID_CLAIM_GRACE_MS` (10 s: a client without RAID2, or gone quiet,
  must not hold a town unraided). A claim unheard for `RAID_WORD_STALE_MS` (6 s, three full frames) is gone. Everyone
  else stands by (`'standing-by'`): nothing stood, nothing pending.
- **The runner's raiders ride its frame named.** A raider carries its raid (`raidKey`), the frame names each one
  (`rz: [[record, key]]`), and a reader stands them under `RAID_PUPPETS_MAX` (25, the mod's cap, Mac's "Keep") apart
  from the twelve a reader stands of an owner's plain foes. A raider taken over from a fallen runner keeps its raid.
- **Defenders stand as allies.** The frame names the owner's allied watchmen (`al`), and a reader stands them as its
  own allies (`alliedWatchPuppet`); a later frame that no longer names one (a crime turned him) stands him as the watch
  again. This closes WATCH1's recorded limit for every town-watch defender, not only a raid's.
- **The deaths are every owner's, summed.** Each owner counts its own raiders' deaths, and its word (`rk: [[key,
  deaths, claim age]]`, on every frame it sends) says its share and its claim (-1: none). A raid's deaths are mine
  plus the most each peer has said (`raidKillTotal`), and the raid is cleansed wherever the sum meets its target - so
  a runner who walks out or loses a race keeps its share, and the next counts on from it.
- **Who fought.** A blow of mine on one of the raid's raiders - my own, or a peer's raider standing here as a puppet -
  marks the raid fought (the Renown stamp), and RAID1's reward follows on the pixel.
- **The switch is the room's** (`ONLINE_ROOM_MOD_KEYS`, forced on), with a world event's own words on the lock: a
  player with it off would walk a raided town the others fight in, unable to see the raiders striking him.

**Limits, recorded.** Outdoor cells have no memory: if every player leaves a raided town its shares go with them
(at a relay that keeps raids, RAID3's ledger holds them now - below). A runner who loses a race or leaves keeps its
standing raiders until they die or are culled, so for a moment two owners' raiders can stand together. A frame's word
is a client's: nothing stops a modified client saying a false share - at a RAID3 relay the count is the relay's, and
RAID4's rewards pay from its signed receipt.

## The relay holds the raid (RAID3, 2026-09-27)

Mac's "1. Server": the relay tracks each raid's kill count, kept even if everyone leaves, the cleanse and the
participants, and signs the rewards. `RELAY_VERSION` world122 (a relay deploy - it drops every connected player once).

- **Where.** A raid's LEDGER lives in the raided town's CELL (`worldRoom(px, py)` - every player standing in the town
  is in that room), in the cell object's storage (`raid:<key>`), for the raid's window and `RAID_KEEP_MS` (10 min)
  past it; the cell's alarm forgets it then. A cell keeps `RAID_LEDGERS_MAX` (4) - a new raid takes the stalest one's
  place. The law is `net/raid/raidLaw.js`, pure; the relay's half is `server/src/index.js` (`_raidWord`, `_raidClean`,
  `_raidSweep`).
- **The word.** A player standing in a raided town while it runs says `{t:'raid', k:'w', key, st, tg, ty, px, py, n,
  s}` to the town's cell - the raid as the day's roll made it (its start, target, party and town pixel), the deaths of
  ITS OWN raiders so far (`raid.killed`, saved with the character) and `s` 1 once it has struck a raider - at once
  when `n` or `s` moves, else every `RAID_WORD_MS` (5 s). Every player sends it, whoever runs the raid; RAID2's `rk`
  words still elect the runner.
- **What the relay checks.** A word said in another cell, or in any other room, is junk (struck). One outside its
  raid's day and window (the shared clock, `RAID_SLACK_MINUTES` either side - ten real seconds of skew) is kept
  nowhere and answered nothing; for a raid it already keeps, the ledger's own window is the one asked. One from a
  socket whose pose is not on the town's map pixel is answered but counts nothing and names nobody. The first word
  keeps what the raid is (WOD7's law); later words add only deaths and speakers.
- **The count.** Each ACCOUNT's share is the most it has said (the verified `sub`; a socket no account vouched for
  counts as itself and earns nothing), credited no faster than raiders can stand: the raid's total may not pass
  `RAID_KILLS_BURST` (3) + one a second from its first word (`RAID_KILL_MS` - the mod stands a raider every one to ten
  seconds) - clipped, not refused, and credited later as the raid runs on - and never past the target. A count that
  moved is written at once and fanned to the cell (`st`); a word that moved nothing is answered to its speaker alone.
  So the count outlives every player leaving the town, and the object's own sleep: the next player to walk in fights
  on from it.
- **The cleanse, said once.** At the target the cell mints a receipt for each account that EARNED it - struck a raider
  (its word said so) and said so from the town within `RAID_PRESENT_MS` (15 s) of the cleanse: the mod paid a player on
  the town's pixel at the cleanse, and RAID1's fix 5 asks that they fought - writes the ledger WITH them (the gate's
  AUDIT WB A10 law: kept before it is said), fans `cl` (`at`, the earners' names with the most deaths first, their
  count) to the cell, hands each earner's receipt to its account's newest socket there (AUDIT WBX S4's one tab), and
  tells the hub (`RAID_INTERNAL_CLEAN`) until it answers (the cell's alarm tells it again every `RAID_TELL_RETRY_MS`).
  A word after it is answered with the cleanse and its speaker's receipt again (a dropped link's), and counts nothing.
  Any word that finds the count at its target with no cleanse stamped starts it (a ledger written at its target just
  before an eviction), and a word that lands while the receipts are being minted is not heard - an object's input
  gate holds for storage alone, and the mint awaits the key and the signature - so a raid is cleansed once.
- **The receipt** (`net/raid/raidReceipt.js`): `w1.<base64url({ w, s, c, y, i, e })>.<signature>` - the raid's key, the
  account, a seed from the relay's CSPRNG (RAID4 rolls the spoils off it), the party, issued and expiry (a week).
  Signed by the relay's one key, `GATE_SIGNING_KEY`, which now signs two things - the version is inside the signed
  bytes, so the gate's verifier refuses a `w1` and this one an `r1` before a byte of either body is read, and neither
  passes as an identity. A relay with no key sends it unsigned; the client still reads it.
- **The hub** says every cleanse to everyone online (`cl`) and keeps today's and yesterday's for a hello (`cls`). A
  client closes the raid on hearing it: the mod's line, with who held the town ("Defended by Ann, Bran and 2
  others."), where RAID1 says a raid's lines - from the town's own cell, or to a player told of the raid who stands in
  its region; quietly anywhere else and from a hello's list. So nobody's machine says a cleansed raid withdrew. A
  ledger's `st` naming a cleanse the machine missed closes it too. RAID1's reward is RAID1's law (struck, on the
  pixel) whichever word closes the raid.
- **The client** (`systems/raidingParties.js raidRelayWord`, `net/online.js sendRaid`): at a relay that keeps raids
  (`relaySupportsRaid`, off the primary socket's welcome) the count and the cleanse are the relay's alone - no sum of
  words here cleanses a town; offline, and at an older relay (which closes a socket on the frame, so none is sent to
  it), RAID2's law runs the raid as it did. The receipts are kept, one a raid (`RAID_RECEIPTS_KEPT`), and handed to
  RAID4.

**Limits, recorded.** The relay cannot see a kill or a blow: a player's deaths and its strike are its own machine's
word (co-op's law - the relay has no world to see them in), bounded by the cap, the town's pixel and the raid's
window. It has no copy of the day's schedule (no game data), so it keeps a raid it was told of in its day, its cell
and its pose, and no other; the account service (RAID4) bounds what a receipt is worth. A tab loaded before the deploy
fights by RAID2's law, and its raiders' deaths reach the relay's count only once it reloads.

## The rewards (RAID4, 2026-09-28)

Mac's "3. We can also add renown and it's own atheric + armor sets". A town defended pays in two ways, both off RAID3's
receipt - one a raid, to each account that struck a raider and stood in the town at the cleanse.

- **RAID4a - the record and the Renown** (account service acct17, no relay change). The device carries each receipt
  with the character that fought it (`net/raid/raidClaims.js`) to `/v1/raid/claim` (`server-account/src/raids.js`), which
  verifies it with the relay's public half, counts it once a (raid, account) and at most `RAID_CLAIMS_DAY_MAX` (6) a
  game day - the relay holds no schedule, so this is the record's bound - and pays that character `renownRaidXp`:
  three quests' worth at the top quest level, under RENOWN3's ceiling (780 at Renown 1, 1,860 at 10, 3,900 from 27),
  outside the hour's bound (the receipt is the relay's word, not the client's), in the same transaction as the row, so
  a receipt claimed twice at once pays once. The chat says *The town will remember you. Towns defended: 3. +780 Renown
  XP.*; the account card and the Inspect card say *Towns defended: 3*. A guest is counted once it registers.
- **RAID4b - a town's thanks and the raiding parties' own sets** (client only: no relay or service change). The
  receipt the relay hands the socket at the cleanse rolls a town's thanks off its seed (`systems/raidSpoils.js`, the
  gate's spoils' law): gold, 80 a level and a fifth either way; one piece Magic or better, known (a treasure pile's
  source halfway up the ladder); and last, a quarter of the time, a piece of the raiding party's own Aetheric set -
  the knights' **Broken Oath** (Mithril: Riposte, Hold the Line), the bandits' **Thief-Taker's Garb** (Elven: Run Them
  Down, No Escape), the orcs' **Orcsbane Harness** (Orcish: Blood for Blood, Iron Hide) - nine pieces each, their
  tiers at 2 / 4 / 6 (`11-Multiplayer/Sigil-Sets.md` section 6b). Straight into the pack, *The town's thanks are in
  your pack.*, once a receipt and account (the relay hands the same receipt again after a reconnect), one tab at a
  time, rolled for the character standing there at its level. The spoils pool carries it under keys of its own
  (`raid4.spoils`, `raid4.spoilsDay`), so a town's receipts never push a boss's out of the list of those spent: the
  pieces ride the device's record until a save holds them, and a crash hands them back at the next boot.

## AUDIT RAID - the online arm, audited (2026-09-28)

Mac: *"1. Audit this properly 2. Ensure online functionality is perfect"*. A read-only lens drove the real relay object
(`test/fakeRoom.mjs`), the real account service over node:sqlite and the real device queue against RAID3-RAID4b's
tree, and reproduced what it reported. Everything below is fixed and pinned (`test/net/auditraid.test.js`, 13 tests; 36
mutants, all dead), one relay deploy (**world123**) and one account deploy (**acct18**, migration 0017):

- **R1 (high): a socket's first word decided an honest raid.** The first word to reach the town's cell made the ledger
  and kept its start, target, party and pixel - from any socket in the cell, standing anywhere. A word naming the
  honest raid's key off its pixel left the defenders counting nothing (their pose never matched); one naming the
  wrong target left the raid uncleansable; a forged tuple on the griefer's own pixel cleansed in seconds and its `cl`
  closed the real raid on every machine (matched by key alone). Now a raid is its whole **tuple** - its key and its
  signature (`raidLaw.js raidSig`: start, target, party, town pixel, which every honest machine computes alike off the
  day's roll) - its ledger lives under that identity, a ledger is made only by a word whose socket's pose stands on
  its town's pixel, and `st`, `cl` and the hub's `cls` carry the signature: a client hears only its own raid's.
- **R2 (medium): an earner away from the cell had no receipt.** The receipt went only to the account's socket in the
  town's cell at the cleanse - a player who struck and stepped into the tavern (an interior: no cell socket), whose
  link dropped, or whose halo closed, was minted a receipt nobody ever handed them. The receipts now ride the
  cleanse's word to the hub, which keeps them under the account (`raidrc:<account>`, the newest eight, a day each),
  hands each to the account's hub socket at once and to its every hello, and sweeps the spent keeps; the session takes
  a receipt from the hub too.
- **R3 (medium): a fresh key took a live raid's place.** Past four ledgers the cell deleted the stalest, whatever it
  was - one being fought (its shares lost, its cap restarted) or one cleansed (the next word re-minted its receipts
  off a new seed; its hub never told). Now eight places; a place is given only by a ledger nobody has fought for a
  minute and that is not cleansed, one that counted nothing first; with none the new raid waits; one speaker holds
  two places at most.
- **R4 (medium): a town's thanks once a device, not once an account.** The relay hands an account's receipt to every
  socket of it, and the thanks were rolled on arrival and marked spent on that device alone - a second browser or a
  phone rolled them again. The thanks are now the **account service's** word: each kept receipt carries the device's
  claim id (`cid`), the first claim of a (raid, account) - a guest's too - writes the thanks row with it
  (`raid_spoils`, migration 0017) and is answered `spoils: true`, the same device again (an answer it lost) the same,
  any other device never. The page gives the thanks on that answer, rolled at the level the character fought at, into
  that character's pack - or, another character standing here, kept on the device for it and handed over at its next
  stand-up (the crash's door). A receipt the device has settled is remembered, so a hub's hello that hands it again
  asks nothing.
- **R5 (medium): forged raids paid half an hour's bound again.** Six claims a game day at up to 3,900 each, outside the
  hour's bound, is 11,700 an hour for a modified client naming raids the day never rolled (the relay holds no
  schedule). A raid's Renown is now **charged to the account's hour** as every report is - counted whatever the hour
  has left, paid what it has left, the row saying what it paid. And the raid key is canonical (`3:07:0600` was forty
  spellings of one raid, at the relay and at the service's primary key).
- **R6 (low): a word out of its time cost a read.** The ledger was read (and its miss kept) before the window was
  asked, so a stream of stale keys was a storage read each and an instance map without end. A word is judged by its
  own law first: one no day could roll (its start outside its key's day) is struck, one out of its time dropped - no
  read, nothing kept - and the cell's copies are bounded.
- **R7 (low): the hub's copy moved before its list was written.** A put that threw left the hub's copy holding a
  cleanse storage never had, and the cell's retry was answered "known" - nobody told. The list is written first.
- **R8 (low):** the raid pool keeps its own crash records (32 - a boss's eight is one a day, a town's thanks come many
  a session); a halo's raid word waits on the halo's own relay's word (a halo on an older object during a deploy closed
  on the frame); a page's hook that throws is kept from the carrier (the receipt stayed unsettled, the retry was
  answered "claimed").

Not changed, said so: the relay still holds no copy of the day's schedule, so a modified client can still name a raid
the day never rolled and stand on its own pixel - the account service bounds what that pays (six a game day, the
hour's bound), and a many-socket griefer could still fill a cell's eight places with raids it keeps "fought". A
device clock more than a week ahead lets a receipt go unasked (the gate's carrier's own rule). *All three are fixed
since - RAID-ROLL and AUDIT ONLINE 2, below.*

## RAID-ROLL - the day's roll, the relay's too (2026-09-28)

Mac: *"Fix it and do another audit"* - AUDIT RAID's "not changed". A raid is five draws of the day's own generator - its
region, its town, its start, its party, its target - and the last three are the GENERATOR'S ALONE. So the relay (world124)
reads every raid word against:

- **the day's slots, always** (`net/raid/raidLaw.js raidDaySlots`): a start, target and party the day never drew is no raid,
  dropped before any read and without a strike (a data-modded world rolls its own raids, and they are its own). It
  needs no game data. The generator is ONE copy for relay and client (`raidDayRandom`, pinned equal to
  `systems/worldTick.js dayRng` for the raids' salt), and the client's roll is the law's (`rollRaidTowns` -
  `systems/raidingParties.js rollRaids` speaks it).
- **the day's whole roll, once the hub holds the towns table.** The region and town are the player's game data
  (MAPS.BSA's rows, the travel map's picker), which the relay never holds and the repository never carries. The
  operator pins the table's SHA-256 (`RAID_TOWNS_SHA256` in `server/wrangler.toml` - `node tools/raidTowns.mjs
  --arena2 <folder>` says it, and the game says it once in the browser console); the hub asks every hello for the
  table by that hash (`raid` `tw`); a client whose own table (`raidTownsCanon` - regions ascending, each town its row
  and map pixel) hashes to it hands it over in pieces (`raidtowns`, RAID_TOWNS_CHUNK each, a whole table in one
  burst); the hub keeps the first whole one that hashes to the pin, in its storage, read back only while it still
  does; and each cell asks the hub for the day's roll (`RAID_INTERNAL_DAY` - once a day an instance, a "none" asked
  again after RAID_DAY_ASK_MS). A word whose key, start, target, party and pixel are not one of the day's raids is
  nobody's: a modified client can no longer name a raid the day never rolled, and a griefer cannot fill a cell's
  places with invented ones (the account service's six a game day and the hour's bound stay beside it). An empty pin
  is a legal state: the slots alone are read.

Pinned in `test/systems/raidroll.test.js` (9 tests; `tools/mutants/raidroll.json`, 25 mutants, all dead).

## AUDIT ONLINE 2 - what AUDIT ONLINE left, fixed (2026-09-28)

- **F2: a receipt's life is the RELAY's clock.** The raid and gate carriers (`net/raid/raidClaims.js`, `net/gate/gateClaims.js`)
  let a receipt go unasked by the device's clock, so a device a week ahead lost every receipt's Renown. A receipt is
  now expired only by the relay's clock (`world.js relayNowS`, heard at the welcome); unheard, it is kept and the
  account service judges it.
- **F3 (AUDIT RAID R8d): a load in the session is a stand-up.** A town's thanks given, a save from before them loaded,
  then a save: the pool's `saved` cleared the record with its pieces in no pack. A load now says so
  (`systems/save/saveSlots.js slotLoaded`, from the world's load and the dungeon's); the pools let go of what they held in
  the old pack (`scenes/spoilsPool.js loaded`), and the crash's door asks again for the loaded character. (Online, a
  load is refused; this is a session that went on offline, or a later one.)
- **F4 (AUDIT SETS M2's other half): a body's pile the taker cannot read comes back.** A corpse's grant holding a
  piece the taker's build did not know was refused whole - and lost, the owner having taken it off the body. The
  taker that asked answers `back`, and is told to reload; the owner puts the pieces back on the body for that grant
  alone, within GRANT_BACK_MS (`scenes/exteriorFoes.js`). A build before this one answers nothing, as before.
- **F5: a refused trade says whose.** The maker of an offer the reader could not read was told "*X's offer was not
  valid*" - blaming the reader. The maker now reads "*X's game refused the trade - nothing was traded*", and the reader
  that its game does not know something in the offer, and to reload (`net/tradeSession.js`).

Pinned in `test/net/auditonline2.test.js` (F2, F3, F5) and `test/net/world6biiic.test.js` (F4); `tools/mutants/auditonline2.json`,
18 mutants, all dead.

## Open

- **Not seen in the running game.** This container has no ARENA2 data, so no town, picker or watchman has been stood
  here, and no two browsers have raided a town together. The pins drive the runner through a recording host, trade real
  frames between two foe pools, drive RAID3's ledger over the real relay object and its hub, and read the wiring by
  source. The relay's half ships with its deploy (world124 - RAID-ROLL's; world123 AUDIT RAID's; world122 never deployed), the account service's with acct18.
- **The towns table's pin is the operator's to set.** Until `RAID_TOWNS_SHA256` holds the hash of the table from real
  game files (`tools/raidTowns.mjs`), the relay reads the day's slots alone; this container has no ARENA2 to take it
  from.
- The travel map's eligible-region count (and so the day's count) has not been measured against the data.

## On the held map (EVENT-TIP, 2026-09-28)

Mac, folding #414 into the gate's branch: *"I also want to add a tooltip to the map for these type of events. I think we
should fold in the raid PR in the repo, since it has a new type of world event also"*. The enhanced (held) map marks
every raid RUNNING now - `raidActive`: begun, not withdrawn, not cleansed, on the raids' own clock - at its town: a
crimson ring about the town's mark with two blades crossed above it, *Town under attack* in the legend. A hover over it
answers with a card: *RAIDING PARTY* / the town and its province / the party attacking / how many of the target were
driven off (said only once this machine knows some) / *Withdraws at* the raid's end on the game's clock [TIME1: online in this machine's local time, "... your time"; offline
the game clock's]. The host hands
the map `raids` (`ui/eventMapMarks.js raidMapMarks` over `raidState()`), none while the mod is off; the classic region
page, DFU's window, draws no raids. The gate's ring answers the same way. `01-Overview/bugs/Field-Bugs-2026-09-28b.md`
EVENT-TIP.

## FIELD-RAID-FT - a fast travel into a raided town crashed (2026-09-28)

Discord (lumin): "Fast traveled to a raid and got a crash" - `TypeError: Cannot read properties of null (reading
'filter') at Object.peersInTown`. A fast travel leaves the old cell's room before the new one opens, and the world
host's `peersNear()` answers null while no room is open (every other reader guards it); RAID2's `peersInTown` seam
walked it, and the raid's Update asks it the first frame the player stands in a raided town - which a fast travel's
arrival reaches while the rooms change over. Walking in never met the gap. The seam now reads no room as nobody in
town. Pinned by `test/scenes/field_raid_ft.test.js` (red before), one mutant dead.

## FB0929 - the swing no longer finds the town's defenders (2026-09-29)

Discord (Satranath): "Even with 'protect civilians from melee attacks' enabled, guards get hit in big battles and will
arrest you. Nuked my rep trying to protect a town from a raid." The setting is DFU's MeleeAttackFriendlyProtection. The
world host offered each swing to the watch, the monsters, then the defenders alone (DISC19-F), and that last pass took
the NEAREST defender in reach and view - Audit 28's stand-in for DFU's look ray - so every swing that met no raider at
its hit frame fell on one. A blow on a defender is Assault (AUDIT DISC19 W2): the squad turned, the watch's first blow
raised the Halt box and its LowerRepForCrime, and the court followed. Under the protection the watch's pool now spares
its defenders on every pass (`cityGuards.resolvePlayerHit`), as the player's spells, shafts and torches always have,
and a defender on the look ray stops the swing short of the townsperson behind him. `scenes/world.js` is the host
wired; `scenes/exterior.js` and `scenes/worldModes.js` stand no defender and take the pool's law as it is, and
`scenes/dungeonContext.js` has no watch. Online nothing changes on the wire: a peer's blow on my defender was already
refused by its owner (AUDIT FINAL F12). Port-Ledger A carries the departure (DFU's ray still strikes an ally alone in
front). Pinned by `test/scenes/fb0929_raidguards.test.js` (red before), five mutants dead.

**RAID-GUARDS (the same day, Mac: "Raids shouldnt let you damage the guards").** While a raid is on in the town, its
defenders take none of the player's blows WHATEVER the setting. `cityGuards.playerSpares` is the one question - a
defender, under friendly protection or with a raid on here (`raidHere`, which `scenes/world.js` answers with
`raidDefendingHere`) - and the swing's pass and the riding charge's list (EnhancedRiding's charge struck a defender it
met) ask it, while the guards' damage door refuses any blow of the player's on a raid's defender by whatever road it
came: it lands nothing and raises no Assault. The crime watch is never spared, and with no raid on and the protection
off the watch's pass strikes a defender as DFU's does (the DISC19-F watch against a monster). Kamer's defenders were
passive watch-skinned Knights, re-pacified every three seconds and never a crime to strike; this is that, for the
player's own hand. `test/scenes/fb0929_raidguards.test.js`, `tools/mutants/raidguards.json` (8, 8 dead).

**RAID-REP (the same day, Mac: "I think it improves rep in all regions").** Checked, and it does not: GrantReputation
raises the raided region's legal reputation, that region's People and its first knightly order, for a player who
fought and stands on the town's pixel - no other region's. The one standing that is no region's is Kamer's +3 with the
Fighters Guild, which the Standing page shows wherever the player is. Pinned in the same file with the other region's
factions first in the dictionary, so a law that forgot the region would pay them.

**Left, online:** my swing can still land on another player's defender standing here as a puppet (the encounter
pool's own fallback) - a flash on my screen and nothing more: its owner refuses the blow, so no guard takes damage and
no crime crosses the wire.

## RAID-WORD - the deaths reach the ledger, a jump frees the raid's places (FIELD BUGS 2026-10-11g)

The Discord's "Doesn't register raid 20%ish of the time". Two roads left the relay's count short while the raid looked
over here: a raider of mine that fell past the location's rect - still on the town's map pixel, where the relay credits
a word - was tallied and never said (step F said the word from inside the rect alone); and a jump's sweep
(`scenes/world.js` `exteriorFoes.clearLive()`) took every raider out of the pool without a death, so the raid kept them
standing and stood no one under its cap. Step F says a raid I fought from anywhere on its pixel now, and
`raidPoolCleared()` runs beside the sweep. The held map's card counts the town's ledger (`raidRelayState`) against the
town's target, not this machine's share. The record: `01-Overview/bugs/Field-Bugs-2026-10-11g.md` RAID-WORD.
