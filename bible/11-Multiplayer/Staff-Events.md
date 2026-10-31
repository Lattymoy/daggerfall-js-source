# Staff events - monsters staged on a town or an area, a hidden kill meter and a yellow mini boss (STAFF-EVENT)

> Design page and record, written 2026-10-24 with the build. The owner then asked for a meter staff can size and see, every monster in the game on offer,
> a mini boss staff can pick, and its health on the start panel.
>
> OFFLINE ONLY until mob tries it live. Staff work: no player patch notes describe it.

## 1. What staff set (the Staff Panel's Events page, Admins only)

| Field | Bounds | Default |
|---|---|---|
| Place | a town or any named place (picked off the game's own map, over the game), or an AREA - one map pixel. A town (city, village or hamlet) is said as a CITY (`ct` 1, the panel's pick off the game's map kind), anything else - a dungeon, a temple, a pixel - as an AREA | - |
| Monsters | any of the game's, up to 12 kinds, mixed evenly: MobileTypes 0-42 and 128-145, Enemy Expansion's 256-290 and 384-398. Horse_Invalid (39) and the City Watch (146) are barred | - |
| How many in all | 1-500 | 50 |
| Kills to fill the meter | 1 to the total | 25 |
| Mini boss | any kind | the first monster picked |
| Its size | 150-300 % of its kind | 200 % |
| Its health | 1-100 x its kind's, or an EXACT number 1-1,000,000 (`hp`, BOSS-HP - it wins) | 10 x |
| Ends when it falls | yes / no | yes |
| Runs for | until ended, 15 min - 1 day | until ended |

Up to four events run at once (`STAFF_EVENTS_MAX`). The page lists every event with its meter (kills / kills to the
boss, kills / total), its boss's state (not yet, due, up, fallen), the players fighting, and **Spawn mini boss now** and
A staging the law refuses is answered with the field it is refused for (`event-bad-<field>`, EVENT-FAULT:
`staffEventLaw.js` `staffEventFault`), and the panel says which. **End**, and on an event that is over **Clear** (EVENT-CLEAR, 2026-10-25, as the owner asked - one row, or **Clear ended events** for every one over; a running one never; the hub is not asked; audited
`event-clear`). The list is read again every 5 s while an event runs, and only a row whose words moved is drawn again,
in place (Staff Panel 0.2.9; as the owner asked). Players never see the meter.

## 2. One law, three readers (`src/net/staffEvent/staffEventLaw.js`)

The event's shape (`validStaffEvent`), the words each way, and the cell's ledger are one pure module the account
service, the relay and the game all import. It imports nothing (`raidLaw.js`'s rule: the worker's graph stays flat).

## 3. The path of an order

1. **The account service** (`server-account/src/staffEvents.js`, routes `/v1/staff/event` `{op: start|end|boss}` and
   `/v1/staff/events`, Admins only) mints the event's id, checks it by the law, stores the row (`staff_events`,
   migration 0167) and its audit row in one batch, then pushes a signed order of its own kind
   (`identityToken.js` `mintStaffEventOrder`, `o: 'sevent'`, `op`, `ev` or `ei`) through the relay's law door
   (`sanctions.js` `pushLaw`). The door answers with the hub's book, each event with its live meter, so every answer
   the panel reads is the hub's. A refusal's why (a full book) comes back through `pushLaw`'s `refused`. The list's read
   pushes a `look` order; a row the book no longer names is marked ended there (`ended_by` 'game'). Rows keep 30 days
   (`cron.js` `staff-events`).
2. **The hub** (`server/src/staffEvents.js`) verifies the order with its own key, keeps the book in storage
   (`sevents`), lapses an event past its end, and says the book to everyone online (`{t:'sev', k:'ev', l}`) and at each
   hello; an end as `{t:'sev', k:'end', id, why}` (`staff`, `boss`, `time`, `done`). A hand boss call (`fb` + 1) is told
   to the event's cell.
3. **The place's cell** keeps the event's **kill meter**, a raid ledger's law (RAID3): each player standing in the place
   says, every 5 s or at once when it moved, the deaths of the monsters THEY stand (`{t:'sev', k:'w'}`). The cell hears
   a word only in the cell the event's pixel stands in, never in a layer, credits it only from a socket whose pose stands
   on the pixel, the most each account said, under a cap of 10 at once and four a second after. At the meter it calls
   the boss (`bd`), and again each time the meter fills - every `m` kills - once the last boss fell (BOSS-AGAIN, 2026-10-25,
   as the owner asked; `mc` the meter's calls); each hand call is one more (`hc` the hands taken).
   Every call is the next `fc`. It hears the boss stand (`bu`) and fall (`bk`) from the one who
   stands it, says its ledger to the place (`k:'st'` - the game reads the count only to stop standing monsters at the
   total), and tells the hub (at once for a boss moment, else every 3 s). Done by its ledger - the boss fell with
   "ends when it falls", or every monster fell and no boss stands - the hub ends it.

## 4. The game: an event run as a raid (`src/systems/staffEvents.js`, `src/systems/raidingParties.js`)

Each event in the book is held as a raid of its own (`key` `s.<id>`, `type` 9, no clock) and RAID2's machinery runs
it: one player in the place runs it (the raid's election, by its words) and stands its monsters, every other player
there stands them as puppets. A town's event runs while the player stands outdoors in its rect (the raid's own test);
an area's while the player stands outdoors on its pixel (`townHere(true)`). Differences from a day's raid:

- its monsters are staff's kinds, stood in PACKS (`raidingParties.js` `staffPackStep`; as the owner asked; a pack may mix any of the
  selected monsters): 3-5 a pack, each one any of staff's kinds, its leader stood anywhere around the runner (any bearing, 20-60
  units off, in view too - nearer when no spot is that far), the rest within 6 of the leader 0.15 s apart, the packs
  paced so the raid's cap of 25 stands 20-45 s in (the pace rolled once an event); PACK-SPREAD (2026-10-25, as the owner asked): each pack is led from around the next player in the town in turn - the
  runner, then each peer standing in its rect, by id (`raidingParties.js` `staffPackPlayer`, the host's `peerFeetInTown`) - never more standing or killed than its total
  (`staffRaidRoom`). A day's raid keeps the mod's one foe at a time just out of view;
- no town guards come out to defend it;
- the boss is stood when the cell calls it and none stands for that call (`staffBossWanted`), before any raider;
- the boss's death is its own word (`bk`), never a kill on the meter;
- its end comes from the hub; its monsters are routed out of sight and the end is said.

Lines said in the place (through `t()`, `staffEvent.*`), each naming a city or an area (as the owner asked): "The city of X is
under attack!" / "The area of X is under attack!", "A mighty KIND has come to the city of X!", and at the end "The KIND
has fallen. The city of X is safe." or "The attack on the city of X is over." ("the area of X" for an area). A city is
the event's `ct` or a town of the player's own map.

## 5. The mini boss (`src/systems/eliteFoes.js` `promoteStaffBoss`)

An elite (the flag, the 3x blows, the elite's drop), staff's size and health, and named "Mighty KIND"
(`systems/foeTitle.js`). Its glow rides the elite channel with an offset of 2 (`STAFF_BOSS_GLOW`: 2.55-3 living,
-2.05 to -3 as a corpse); the shader (`systems/hitFlash.js`) decodes the offset and draws `STAFF_BOSS_RIM` yellow in
place of the elite's blue. A puppet boss is promoted from the frame's `sb` side list (`[[record, size %]]`,
`world/raidShared.js` `validStaffBossTags`, one a frame); its health is its owner's.

BOSS-LOST (2026-10-25, as the owner asked): a boss stand that does not answer in
`PENDING_TIMEOUT_S` is given up and asked again (`raidingParties.js` `cancelPending`); and a boss that stood but stands
nowhere now - not fallen, not mine, no puppet of it - for `STAFF_BOSS_LOST_MS` (a jump's sweep, a removal, a runner
gone) is stood again by the one who runs the event, for the same call (`staffEvents.js` `staffBossLost`). The wait lets
a fallen runner's boss come over first.

BOSS-CLEAR (2026-10-25, as the owner asked; then BOSS-CLEAR-CALL, mob:
"no only the mini boss need to wait for everything to be dead to count to spawn"): the packs come on all the while; the
meter's boss waits until every monster of the event that stood at its call is dead or gone - mine and the puppets of it,
taken once at the first ask (`clearWait`), so a pack stood since never holds it - or `STAFF_BOSS_CLEAR_MAX_MS` (2 min)
for one nobody can reach. Staff's **Spawn mini boss now** stands
at once (`staffBossByHand`: the book's `fb` past the last I stood). Its line is said once it stands (`bu`), not at its
call.

BOSS-UNSHAKEN (2026-10-25, as the owner asked): a mini boss takes no shove and no Hurt from a player's blow
(`scenes/exteriorFoes.js`) or a foe's (`scenes/hostCombat.js`), a struck wind-up never staggers it (`ai/tactics.js`
`windupStruck` - the held blow only), a puppet of it plays no Hurt on its health's fall, and Paralysis never holds it
(`systems/effects.js` `isImmuneToParalysis`). A departure: DFU has no such foe. Only a staff event's mini boss - every
other foe and boss is unchanged.

BOSS-HARD (2026-10-25, as the owner asked): every mini boss is held to the Enemy Expansion Troll's rules (`MonsterBase.mdb.csv` row 272) on top of its
health - `STAFF_BOSS_MIN_METAL` Silver (a blade below Silver does nothing, `combat/formulas.js`
`dropWeaponIfTargetImmune`; hand-to-hand lands, as DFU's does) and `STAFF_BOSS_ARMOR` 10 (the Troll's ArmorValue 2 x 5,
EnemyEntity.cs:264-267) as its worst armour on any part. Owner and puppet alike, so a peer's blow is held to it too.

BOSS-BOUND (2026-10-25, as the owner asked):
FOE-BOUNDS (`net/foeBounds.js`, Spawn-Grants section 19) judged a peer's mini boss as a plain elite of its kind, so every
copy but its owner's took a boss past that bound - an exact health of 10,000, or a large multiplier - down as impossible.
A record its frame tags both the event's raider (`rz`) and its boss (`sb`), of an event live in my own book, is held
instead to that event's health: its `hp`, or its kind's bound times its `bh`, whichever is more
(`systems/staffEvents.js` `staffBossBound`, read by `scenes/grantHost.js` `statsRefused`). Past it, or of no event I
hold, the plain bound stands. The relay's strip (`grantStrip`, off) still judges it plain.

BOSS-SPOT (2026-10-25, as the owner asked; card:
"Biggest group, ties by level"): the one who runs the event stands its mini boss beside the player with the most players
within `STAFF_BOSS_GROUP_M` (30 m) of them, themselves counted - a tie to the group whose highest level is higher, then
the lower id (`raidingParties.js` `staffBossSpot`, off the host's `peerFeetInTown`: me first, then each player in the
place's rect, each with their level). Beside me when it is me.

PACK-SCALE (2026-10-25, as the owner asked; card: "Scale with players in town"): an event's packs
by the players in its place, me counted (`raidingParties.js` `staffPackScale`) - one alone as ever (`MAX_RAID_ENEMIES`
standing, the event's pace); each more player `STAFF_PACK_CAP_PER` (5) more standing, to `STAFF_PACK_CAP_MAX` (40), and
the pace a quarter quicker, to twice. A reader stands as many of a runner's raiders (`world/raidShared.js`
`RAID_PUPPETS_MAX`, 40; a runner's raiders, its watch and its loose stands still ride one frame).

BOSS-EXACT (2026-10-25, as the owner asked): a
mini boss's health is the exact number staff typed, so the players fighting it never make it tougher - its owner's
damage door and heal skip PSCALE1's toughness (`scenes/exteriorFoes.js` `_toughFoe`). Eight fighting a 10,000-health
boss divided every blow by 4.5: a Daedric blow of about 20 took 4, and the bar did not move. Its blows at the players
still weigh by how many fight it (`partyHit`). A departure from PSCALE1 for this one foe alone.

BOSS-BIG-HIT and BOSS-BAR (2026-10-25, as the owner asked): the
owner refuses a peer's blow past `PEER_HIT_DMG_MAX` (10,000) whole - a mini boss takes it at 10,000 instead (every other
foe still refuses it). And a foe's record says its health within the wire's `FOE_HEALTH_MAX` (100,000): a mini boss
past it is said at the same share of 100,000 (`wireHealth`), so every player's bar falls with the owner's - clamped,
a 1,000,000-health boss read full until 900,000 were gone. Both in `scenes/exteriorFoes.js`.

BOSS-SPELL-WARD (2026-10-25, as the owner asked): a mini
boss takes `STAFF_BOSS_SPELL_TAKEN` (a tenth, `systems/eliteFoes.js`) of every spell's damage - a peer's and the
owner's, a lasting spell's rounds, a weapon's strike spell - at least 1; a whole-health spell (a Disintegrate) takes a
tenth of its health and never kills it. Cut once, where its health is (`scenes/exteriorFoes.js` `damageFoe`): a puppet
sends its owner the spell whole. A departure: DFU has no such foe.

BOSS-HIT-SHARE (2026-10-25, as the owner asked): one hit on a mini boss - a blade's, a
spell's after its cut, a round's, a peer's or the owner's - takes at most `STAFF_BOSS_HIT_SHARE` (1%) of its maximum
divided by the players fighting it (`systems/eliteFoes.js` `staffBossHit`; PSCALE1's 30-second window, counted to
`STAFF_BOSS_FIGHTERS_MAX` 100, not the party's eight seats: `systems/party/partyScale.js` `foeFightersUpTo`), at least 1.
Alone a hit takes up to 1%; forty fighting, 0.025% each - a round of everyone's hits about 1% whatever the crowd. Always
on, every mini boss; no switch.

## 6. The place picker (`src/net/staffPlaces.js`)

The places are the player's own game data (MAPS.BSA), never in the panel or this repository, so the panel over the
game asks the game through the staff hook's door: `places?` (a region's named places, towns first) and `here?` (the
staff member's region, the place on their pixel or -1, their pixel). The boot hands its maps over with
`gameMaps(new MapsFile())`. A panel in a tab of its own can stage an area alone.

PAST THE BAY (AUDIT RELEASE R2-7, 2026-10-26, `01-Overview/audits/Audit-Release-R2.md`; the owner: "Take care of
exclusions and gaps"). An event's pixel is the world's (the law's STAFF_EVENT_PIXEL_BOUND, the wire's WORLD_PIXEL_BOUND -
the event, and its place's `sev` word to the place's cell), so an AREA's event stands in a province as on the Bay. A
TOWN's event runs as the town's raid (section 4), and since WW6 (2026-10-27, `03-World/World-Wide.md` WW6) the raids
stand past the Bay, so a TOWN's event does too: a Bay town by its MAPS.BSA location (0..9999) on the Bay's own map, as
it always was, a town past the Bay by its place's own location index (negative - no MAPS.BSA row holds it) on the world's
grid off the Bay, in a province's region (62..70; `staffEventLaw.js staffTownPixelOk`). A town's location and its pixel on
two sides of the Bay's edge is refused by name (`event-bad-town`; it was `event-bad-town-past-bay`), and an area is `loc`
-1 alone. The picker lists a province's region (62..70) from the world's registry (`gamePlaces`, kept as the boot makes
it - its listed places in the province's theatre: the capitals, cities, towns and villages) and offers a town as itself
(its registry `location`; Solitude by `capitalLocationIndex(1, 0)`), a place with no index of its own as an area at its
pixel (`loc` -1), so what it offers runs; `here?` past the Bay names the town, or the area, on the staff member's pixel.
The game stands a town's event past the Bay in its town by its index, as the raid stands there - its rect, the town's
watch, its word to the town's cell (`systems/staffEvents.js staffRaidHere`, `world/raidShared.js raidTownIs`). Staff may
bring one to any province's town, Cyrodiil's included (staff's call: the open zone's rule is the day's roll's).

## 7. Versions and what a deploy does

- Relay `world256` (`STAFF_EVENT_RELAY_MIN`): `staffEventLaw.js`, `staffEventReceipt.js` and `server/src/staffEvents.js` join the bundle. An
  older relay closes a socket on a `sev` frame, so the game sends one only to world256 on. A relay deploy drops every
  player for about 40 s.
- Account service `acct182`, migration 0167: drops nobody.
- Staff Panel 0.2.7: the Events page.
- STAFF-EVENT BOSS: relay `world257` (the law's `hp` and the meter's boss each fill), account service `acct184` (`hp`
  staged, `clear`), Staff Panel 0.2.9 (the exact health box, Clear, the quiet list). The relay first; an older relay
  drops `hp`, so the boss reads its times.
- REWARD-KILLS: relay `world264` alone (world258 then world262 on its branch, renumbered past main at the merges) (the reward earned by kills alone) - drops every connected player for about 40 s;
  no account or site change.

## 8. Known limits

- A kill is the player's machine's word (co-op's law); a forged word can bring a boss early, never stage, move or end
  an event.
- If the runner changes while a boss is being stood, two bosses may stand for one call.
- An event past its end lapses at the hub's next touch (a hello, an order, a cell's word or tell).
- Size, health and the 10x default are first guesses, set per event on the start form.
- THE REWARD (section 9): the earning is the player's machine's word too (the kills and the stand it says). A receipt the
  relay hands again after a reconnect needs the place's ledger, which an event that ends at its boss's fall drops at
  once - so a fighter who drops at that moment misses theirs. The spoils are spent once a receipt on a device, not once
  an account: no account service claim, as a town raid's has.

## 9. The reward (THE REWARD - 2026-10-24, as the owner asked)

Dagon's way, without Dagon's gear. At the FIRST fall of an event's mini boss the place's cell
(`server/src/staffEvents.js` `payReward`) pays before it says a word of the fall:

- **Who earns** (`staffEventLaw.js` `staffEventEarned`): every account (never a guest's socket) with
  `STAFF_EVENT_EARN_KILLS` (3) kills of its own - a monster that fell after a blow of theirs, whoever stood it (a word's
  `h`: `raidingParties.js` counts its own struck monsters and a fallen puppet it struck, once; the meter's `n` is the
  runner's, who stands them all). One reward an account an event. REWARD-KILLS (2026-10-25, as the owner asked; card "Kills only (3+)"; world264, world258 then world262 on its branch): a stand alone - a word every
  `STAFF_EVENT_STAND_TICK_MS` (4 s) from a pose on the pixel, half the run - earned it before and earns nothing now; it
  still breaks a tie on the board.
- **The board** (`staffEventBoard`): the earners' top `STAFF_EVENT_BOARD_MAX` (10) by kills, the killing blow before
  an equal count, then the longest stand, as `[name, kills, killer]`. Said to the place (`sev` `bd`), said on screen
  once (`raidingParties.js` `staffBoardLine`), told to the hub, which keeps the newest `SEV_BOARDS_KEPT` past the
  event's end for staff's look, and the account service keeps it on the row (`staff_events.top`) for the panel.
- **The receipt** (`staffEventReceipt.js`, `e1`): one an earner, `{ v, s, c, r, i, e }` - the event, the account, a
  seed, the rank (0 past the board) - signed with the relay's one key (GATE_SIGNING_KEY), handed to the account's
  newest socket (`sev` `rc`), and again to that account's next word while the ledger lasts.
- **The spoils** (`src/systems/staffEventSpoils.js`, `STAFF_SPOILS_TABLE` - THE DROP TABLE, the one place to tweak it):
  rolled on the device off the receipt's seed, straight into the pack through the town's thanks' spoils pool
  (`scenes/world.js` `onRaidReceipt`, keyed `sev:<id>`), once a receipt. Every earner: gold at 100 a level (the seed
  moving it a fifth either way) and one Magic-or-better piece; the board: one more Rare-or-better; first place: one
  more, Legendary a tenth of the time, else Rare or better. None of Dagon's: no Sigil Stone, no Regalia, no Dragonfire
  Oath, nothing gilded.

## 10. Play as boss (STAFF-PILOT - 2026-10-26, as the owner asked, the card's pick "Take over the boss", with no relay update, in the same PR)

A staff member steers their event's mini boss. A departure from DFU, which has no such thing. Game page and Staff Panel
only - no relay, no account service: it rides words the wire already carries (`src/systems/staffBossPilot.js`, the page's
half `src/scenes/staffPilotHost.js`).

- **Start**: the Events page's Play as boss posts `pilot` (`net/staffHook.js`) with the event's id. A hidden game is shown
  first (a hidden game's frames reach no one). The game answers whether a boss of mine already stood; if not, Play as
  boss is armed (PILOT-ARM): the meter's next boss, or Spawn mini boss now pressed by hand, stands on my machine.
- **The run is mine**: while I steer, my claim on the event's raid says `PILOT_CLAIM_AGE` (= `RAID_CLAIM_AGE_MAX`, the
  oldest the wire carries), so every game in the place - an old page too, which reads the same oldest-claim law
  (`world/raidShared.js` `raidRunnerOf`) - hands me the run (`raidingParties.js` `runsRaid`). A claim's age on the wire
  is now held to that bound: past it `validRaidWords` dropped the word, and a runner two hours in fell silent.
- **The boss is me** (`scenes/exteriorFoes.js`): after its motor steps, its feet are my feet and its facing my camera's
  (`pilotSteer`); its own swings and casts are held (`pilotHolds`). A left click is its swing now (the brain's forced
  swing, the path every foe's blow already rides to the players, each judging it on their own feet), at the player
  nearest my facing within `PILOT_TARGET_M` (8 m, 60 degrees). A right click lets its spell decision run for
  `PILOT_CAST_MS`. My own copy of the boss is not drawn: the camera stands inside it.
- **My body is no one**: my pose's concealment says 7 (all three bits - `effects.js` `concealBits`); this build draws no
  body and no name for a 7 (`combatVisuals.js` `peerDraw`), an older one the shimmer of an invisible player inside the
  boss. Foes do not sense me (`playerEntity.staffHidden`).
- **The end**: the boss falls (its reward and lines as ever), or Leave boss - the
  boss, if it still stands, goes back to its own brain where it stands. The game tells the panel why (`left`, `fell`,
  `none`).
- **PILOT-ECHO** (2026-10-28, live: the list redrew without end, Leave boss lost, a boss called on every pass): the game's
  answer (`{ on, ev, boss }`, `{ on: false, ev, why }`) goes out on the same window the panel's ask comes in on, so the
  door (`net/staffHook.js`) takes `pilot` only without `boss` or `why` - its own answer is never heard as an ask.
- **PILOT-ON-ME / PILOT-ARM / BOSS-ONE** (2026-10-28: "only spawn on on my position", "just only spawn once", "we ether
  become the boss at kill", card "Both"): the boss of the event I steer stands about me, never by the biggest group
  (`staffBossPlace`). Play as boss is armed until a boss stands - the meter's next, or Spawn mini boss now - and never
  gives up on its own (the panel calls no boss at the press since Admin Tools 0.2.185). While any boss of the event stands,
  mine or a peer's puppet, a later call stands no second one, on any game.
- **PILOT-BAR** (2026-10-28: "let me see the bosses bar so i know when im hurt"): while I steer it, my boss's name and
  health stand on the gate's boss bar (`ui/staffPilotBar.js`, drawn by `scenes/staffPilotHost.js`), marks at half and a
  quarter, put away when it falls or I leave.
- **Known limits**: the boss walks at my pace, not its kind's; a game that ran the event before keeps the monsters it had
  stood (they fight on as theirs); my own weapon still swings at a click if drawn.

## 11. The Dwarven Dragon (DWARVEN-DRAGON - 2026-10-28)

The game's own monster for staff: a Dwemer clockwork dragon with a Daedric rider (`src/characters/dwarvenDragon.js`).
It is kind **512**, a monster past Enemy Expansion's ids, and its pictures are archive 1800 under
`public/art/dwarven-dragon/`, in Daggerfall's mobile layout: five facings of a walk and a claw attack (eight frames each,
the werewolf's Bloodmoon walk and slash), a hurt frame and an idle frame. Its row is the Iron Atronach's career made a
boss (level 24, 300-500 health, 20-45 damage, the atronach's sounds and remains). No encounter table names it: staff
bring it as an event's kind or its mini boss, and Play as boss steers it. Its soul fills no trap, as the item law knows
no soul past Enemy Expansion's (`systems/mysticism.js` `fillEmptyTrap`). The Staff Panel's kind list is regenerated by
`tools/eventKinds.mjs`, which reads the game's own registry.

## 12. Riding the Dwarven Dragon (DRAGON-RIDE - 2026-10-28)

An Admin rides the Dwarven Dragon with `/dragon` (`/dragon on`, `/dragon off`; a bare `/dragon` turns the ride over).
Only the Developer's and Shadow Fang's glyphs may ride (`systems/staffDragon.js` `DRAGON_GLYPHS`); any other staff
member is told so, and a player without staff glyphs never sees the command.

- **Flight.** Mounting turns `/fly` on and flies at ten times levitation's pace (4 m/s to 40 m/s), through the motor's
  levitating-pace registry (`player/motor.js` `registerFlySpeedMod`). Landing gives `/fly` back what it was before.
- **The saddle.** The rider's view of the saddle, the dragon's head and its shoulder cannons is drawn along the bottom
  of the screen where the mount is drawn (`scenes/staffDragonHost.js`, pictures `saddle-0.png` and `saddle-1.png`);
  the firing picture shows for a moment after each volley.
- **The cannons.** While riding, every attack press fires both cannons (`scenes/hostMagic.js` `fireDragon`): two shock
  balls, from left and right of the eye, crossing 40 m down the look, flying 120 m/s, at most one volley each 0.35 s.
  A ball meets **monsters alone** - the foes my spells may reach - and takes 999,999 health off the first it meets,
  with no save or resistance. It passes through party mates, duel opponents, bosses of the court and other players.
  It costs no magicka.
- **This page alone.** The ride, its pace and its balls are never sent; the relay judges no pose speed outside an arena
  bout, so the flight needs no relay change. **Others see the dragon** from world281: my pose's `rd` says 3
  (`dragonPoseRide`, the wire's `POSE_RIDE.Dragon`), and their games draw me as the Dwarven Dragon's own sprite, its
  rider in the art. An older relay would clamp 3 to the cart, so the pose says it only to a relay the wire's own gate
  names (`relaySupportsDragonRide`, read by `noteDragonRelay`); before that, others see me fly on foot.
- **DRAGON1 (2026-10-29, `11-Multiplayer/Dwarven-Dragon.md` section 12).** This section first said world276. The wire's
  half was on #1360, which did not merge, and this file kept its own copy of the number; main's relay reached world280
  with no dragon in its pose law, so other players saw an Admin on a cart. The gate now lives in `net/wire.js` beside
  `POSE_RIDE`, the relay that keeps the dragon is world281, and `test/net/dragonride_wire.test.js` holds the gate and
  the law to each other at this wire's own version.
- **DRAGON-SHOTS (2026-10-29, as the owner asked).** The pose's cast count
  (`cn`) was the rig's alone, counted as the hands play a cast, and the cannons play none, so no other player saw a ball.
  Each volley now counts (`systems/staffDragon.js` `dragonWireCast`, a ranged shock), and another screen draws a dragon
  rider's cast from both barrels (`drawPeerCast`, `dragonVolley`); a rider the relay draws on foot shows one ball from the eye.
- **DRAGON-BLUE (2026-10-29, as the owner asked).** `/dragon blue` (or `aether`,
  `aetherbright`) mounts the Aetherbright, `/dragon brass` the brass, and either changes the look in the saddle. The look
  rides the pose's `rc` (1 the Aetherbright), as a tamed dragon's does (`Dwarven-Dragon.md` section 11), and the saddle
  takes its colours.
- **DRAGON-AIM (2026-10-29, the owner: the shots crossed at one distance).** The balls met 40 m down the look and split
  past it. They now meet on the nearest body within `DRAGON_AIM_SLACK` of the look (`dragonAimDistance`), else 300 m
  away, so they fly near level.

