# AUDIT WATCH-KIT - the watch aboard, the sea by night and the companions' kit, before the merge, 2026-10-01

Mac: *"Just want to audit this to make sure it's perfection"*, of PR #502 (SHIP-WATCH and COMPANION-KIT,
`03-World/Naval-Combat.md`), and where the fixes go: *"Onto #502's branch"* - the audit rides the PR it audits, as
AUDIT CREW rode #493. Six lenses read its head (9ee11d46, frozen) against its record on the arc's own harnesses: the
watch aboard (W), the sea by night (N), the companions' gifts (M), their packs (P), their bars and the party panel (U),
and the record and the tests (D) - the last with 66 fresh mutants thrown at the new code, of which 64 survived the
suites named for their files: each an untested behaviour, now pinned or recorded equivalent with its reason.

Every finding was re-run before it was fixed and is pinned by a test that fails on the code as it stood:
`test/systems/naval/auditwatchkit_crew.test.js` (W, D1, D5 and the crew's safety net), `auditwatchkit_sea.test.js` (N, W2, W6, W10's
wiring, W12), `auditwatchkit_magic.test.js` (M and the gifts' safety net), `auditwatchkit_ui.test.js` (U1, U2, U4,
U6, U8, U9, P1, P2, P6 and the panel's safety net), `auditwatchkit_world.test.js` (U3, U5, U7, P3-P5) and
`auditwatchkit_net.test.js` (the host's, the captains' and the world's safety net). Mutation-proven: their six lists,
`tools/mutants/auditwatchkit_*.json` - 190 mutants, 188 dead and 2 recorded equivalent with their reasons - and
`companionkit.json` corrected to 43, all dead; every older record the fixes moved re-aimed by content and killed again
(PIN MOVED, below). Each fix carries an `AUDIT WK-` comment.

The relay law holds: nothing under `server/src` changed, and no field the relay reads - the companions' names ride the
foes frame's own scenes-side field. One file under `src/net` changed, `realmGoldLaw.js` (P1), which the account
service bundles: see The deploy.

## The watch aboard (`systems/naval/crewLife.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1, D1 | Major | **By day no crew had a lookout at her bow.** He was chosen only at nightfall, at a call, or by a probe no host called, and nobody replaced one who fell or went ashore: at noon 0 of 6000 frames had a man at her bow, and the first SAIL HO! was cried by whoever was picked, wherever he stood. The suite hid it by calling the probe first. | Asked at every step (a loop, no list made), never a man on his way below; nobody draws him into talk. Pinned without the probe. |
| W3 | Minor | **By night nobody worked.** Under a repair order the hull mended while one hand slept below and the watch never swung; after a night fight five of eight were below within 6 s and nothing was patched - Mac asked that they "patch damage after a fight". | A repair order keeps every hand up; the watch works her hurts by night, never a chore. |
| W4 | Minor | A struck or sinking crew took up chores, swung at them and said their words between its "We yield!" lines - a regression of AUDIT NAV2 F46. | A quiet crew takes up nothing and stops what it was at. |
| W5, D5 | Minor | The guns ended neither the lookout's watch (up to 22 s more at the bow) nor a walk to a job (up to 58 s); and at the guns the lookout never stood at a post - his zero idle, meant for taking the bow, moved him 91% of steps against the others' 32-40%. | The guns end both at once; at the guns he idles as the rest. |
| W7 | Minor | A crew stood for the first time by night - every ship come into range, a load at 23:00, my hands home after a fight - stood every hand on deck, then walked the sleepers below in front of the player (30 s on a war galley). | Its first step by night puts the sleepers below at once, a paused first frame too. |
| W8 | Minor | The morning and the alarm stood every sleeper on one point - five men merged in one sprite on the hatch for 5 s (AUDIT NAV2 F41: "no two stand on one spot"). | In the morning one at a time out of her hatch, never into the player standing on it, each straight to a free spot; at the alarm each at the hatch or a clear point beside it; the watch kept a third of her whole crew. |
| W9 | Minor | A hand the guns took while he was below kept `below`: mended back, he was counted but never drawn until the next 05:00. | `trim` clears it. |
| W10 | Minor | SHIP-CREW names one hand Lookout, but SHIP-WATCH's lookout ignored roles: the Bosun kept the bow and cried "Sail ho!" over the head of the card's Lookout. | Her card's Lookout keeps her bow whenever he can (`ctx.lookout`, from the host's `myCrew`); the one who kept it for him leaves it - never two at her bow. |

## The sea by night (`scenes/naval/navalHost.js`, `systems/naval/navalAI.js`, `world.js where()`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| N1 | Major | **A player firing by night was never seen by her flashes.** A volley's report was heard under the shooter's boat key (`me:42`, `peer:<owner>`), which names no contact: a dark Large Galley shelling a merchantman at 240 m by night struck 26% of her hull and was never answered. | The report is heard as the contact names her (`gunfireBy`): mine by my id, a peer's by theirs. |
| W2 | Major | **A dark pirate cruising unseen at 495 m woke my crew with "All hands on deck!"** before any "Sail ho!", and near the 700 m line the alarm came and went. | By night my crew is called to the guns only by a hostile the night shows (her lanterns, her flashes) or one coming for me (`crewAlarm`, in the crew and in my word); a rest and a journey still read every hostile near. |
| N2 | Minor | By night a navy answering the guns stopped at half her DAY lookout (375 m) and turned away from a fight her night's lookout (220 m for a dark ship) could not see. | Half the lookout she sees a dark ship by (`nightSight`): she sails on to 110 m. |
| N3 | Minor | A merchantman running from a dark pirate relit her lanterns the moment the pirate dropped past her 220 m sight, and was found again: twelve lantern switches in one chase. | By night a ship that ran runs on `RUN_ON_S` (60 s) from where she last saw the threat, dark; the day ends it. |
| N4 | Minor | Come Sail Away's carrack carries no lanterns, yet a merchant carrack was a lit ship to every captain - a black hull engaged from 598 m. | A boat is lit only by lanterns she carries (`carriesLanterns`; one not yet built by her hull) - mine and a peer's too. |
| N5 | Minor | The captains', the errands' and the lookout's "night" was the lanterns' hours, 17:00-07:59: at 07:30 in daylight a dark pirate was unseen past 220 m and a merchantman held her berth. | The dark is DFU's own (`where().night`, the world clock's `isNight`); the lanterns keep their hours. |
| N6, W6, D8 | Minor | My lookout kept the captains' law for lanterns only: a dark pirate firing on a merchantman 400 m off for 40 s was never hailed. | Her flashes show her to my lookout as to the captains (`showsLight`). |
| N7 | Minor | Another player's lit boat drew no far lamps, though my captains saw her by them. | Their lit boats' lanterns join the far lamps. |
| W12 | Nit | Another player's battered boat: her hands mended on her owner's screen and did chores on everyone else's. | Her word's hull loss is her work on every screen (`peerBoat`'s `work`). |

## The companions' gifts (`scenes/hostMagic.js`, `systems/allyCast.js`, `scenes/crewAshore.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| M1 | Major | **My gift was applied with me as its caster**, so the incoming-spell chain ALLY-CAST's receiver skips ran: a companion carrying a Spell Reflection gift bounced my heals onto me (mine 20 -> 40, hers unmoved, "You cast Heal on Hilda."), and a Heal+Fortify landed on both of us - against AUDIT ALLY-CAST B6. | Applied with no caster, the receiver's own call. |
| M2, D3 | Minor | A ByTouch gift aimed level at his face did nothing - nothing spent, the spell left readied - while a CasterOnly one landed: the click's gate asked only the touch pick's centre point. Every gift pin aimed from mid-height. | The gate asks his whole height too (`companionInReach`); pinned from `EYE_HEIGHT`. |
| M3 | Minor | **Every spell on a companion was lost at every change of place** - a door, a dungeon, the helm, a sweep, a quickload: each place stands a fresh body. Buffing him at a dungeon's door paid for nothing. | His live entries ride to his next body (the layer keeps them by the party member). Not through a save - said. |
| M4 | Minor | Light, Detect and Comprehend Languages, which only the player's own readers read, armed and landed on him: with a companion near, my CasterOnly Light armed instead of lighting me, and the click gave it to him ("You cast Light on Hilda.", 24 magicka, no light). | His gifts are what he can use (`companionCastable`, `COMPANION_UNREAD_TYPES`): those three alone are never his, and are stripped from a gift that carries more. |
| M5, D4 | Minor | The record's missile and burst gifts were unpinned - three mutants survived every companionkit test - and its one "equivalent" mutant was not: a graze 0.65 m off his axis reaches the touch arm alone. | Pinned: a bolt past 24 m, a burst, the graze. 43 mutants, all dead. |
| M6 | Nit | A companion knocked out still stands one frame: a release or a bolt then healed a man being carried aboard, magicka spent. | Never one knocked out. |
| M9 | Nit | With a party mate under the crosshair and a companion near, the ready said "Aim at your companion..." - and the click gave it to the mate. | Both crosshair targets first (the mate's, then mine), then the near ones, the mate's line first. |

## The packs (`world.js`, `navalHost.js`, `worldModes.js`, `player/mobileEnemyActivate.js`, `net/realm/realmGoldLaw.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | Major | **Realm customs and the account service's first-save gate never read a companion's pack**: 1,000,000 gold stored in his pack crossed into the realm uncapped, where the hold is capped at the level's allowance - the hole AUDIT REALM2 T2 closed for the hold. | Each companion's pack is one of the stashes (`stashedItemLists`, the naval save's vendor pinned equal to the host's); the load's repair passes reach them too. |
| P2, D2 | Major | **In a building or a dungeon a tap on my companion locked onto him** and ate the press - only the street's arm passed him by. On a phone his pack never opened indoors, and the camera turned to face him every frame. | Both tap picks pass him by; all three hosts pinned. |
| P3 | Major | **His pack window kept the list it opened on: a quickload under it, then one click, duplicated the pack** - every F9/F11. | His pack read by his key at every look. |
| P4 | Major | A same-dungeon load never lifted the party (AUDIT CC-A8's fix sat in `worldQuickLoad` alone): the save patched companions' bodies by number, and a knock still waiting landed on the restored companion, his saved pack lost with him. | The dungeon's own load lifts the party first, at its OnStartLoad door (`modStartLoad`). |
| P5 | Minor | His pack given up with no boat of his found and my pack full was thrown away while the HUD said "stowed in your pack"; his gold arrived as an unspendable pile. | Never thrown away: into my pack past its gate if it must ("more than you can carry"), his gold to my purse, said as it went. |
| P6 | Minor | His pack opened from 76.8 m away; every other storage asks 3.2 m. | Past `TREASURE_ACTIVATION_DISTANCE`, "You are too far away", as any storage. |

## The bars and the party panel (`ui/partyPanel.js`, `ui/naval/navalHud.js`, `world.js`, `exteriorFoes.js`, `dungeonContext.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| U1 | Major | **After any window closed, his card's next heal floated no "+N" and his next blow did not flare**: the cover nulled its memory and offline nothing repainted it. The "+N" is the visible proof of Mac's "gain the players healing spells". | One repaint as the cover lifts. |
| U2 | Major | **His whole was re-rolled at every door** (94, 86, 76, 105, 86, 54, 83, 81 over eight doors) and read by the card and the bar as blows and heals - five flares and two "+12" with none struck or healed; a fresh Take ashore painted a 100/100 stand-in, then floated or flared. | Each place stands him with his whole (`crewAshore.js`); on the card a changed whole is a new baseline, never a blow or a heal. |
| U3, D9 | Minor | Another player's companion wore his CLASS's name ("Warrior") over his head, with health digits - the record said "his name alone". | His owner's foes frame names him (`cn`, beside `cp`), on the street's lane and the dungeon's; his bar his own name, no digits. |
| U4 | Minor | The role's letter (about 2.0:1) and the role line (2.49:1 over snow) failed text contrast, and a screen reader read the letter as a stray word. | The letter at full contrast (15.5:1) and hidden from a reader; the role line as a member's place line. |
| U5 | Major | **On a phone, sailing with companions, their cards lay over the ship's plate** (20,570 px² at 390x844): hull, sails and guns unreadable. | No companion cards while I sail - the party is aboard. |
| U6 | Minor | At the panel's height limit my companions were always cut first, and whole: a party of eight on a landscape phone lost both. | Their cards in their own list after the seats; the seats give way. |
| U7 | Minor | Online with no social picture (no account, no hub tab), no panel was ever made for my companions. | The panel stands down for the social one only where there is one. |
| U8 | Minor | The bar drew the 16px icon pixelated in a 12px box - 8 of its 16 columns at dpr 1 - against UI1's law in `iconFit.js`. | 16px tiles fitted by `spellIconPicture` at the bar's dpr and scale. |
| U9 | Nit | On the bar a debuff was shown by colour alone, its ring 1.75:1 against a buff's. | The card's `#e2554c` (5.44:1). |

## The record and the tests

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D6, M8 | Minor | THE FOUR HOSTS RULE: COMPANION-KIT named no host but world.js - and D2 is exactly the miss the rule exists to catch (precedent: Audit-Guide K9). | Each seam names its hosts: world.js (the street, and a building's mode through worldModes.js), dungeonContext.js (its own cast engine and lane), exterior.js FLAGGED (no Come Sail Away runtime, so no companion stands there). |
| D7 | Minor | Neither DECLARED slice had a Ledger A row. | Both rows. |
| D10 | Minor | A fallen hand's pack (the prune) was untested - the test's title promised a mutant that did not exist. | Pinned. |
| D11 | Nit | The item codec was written twice: "the cargo's own" only while the two stayed in step. | One `packedItemsCodec`. |
| D12, M7, W11 | Nit | Four statements of the record were not the code's: a gift "never" crossing a wall (a blast and a burst meet him through one, as they meet a foe - DFU's OverlapSphere), the pack given up by `takePack` (the send-back's alone), the HATCH at "her main deck's middle" (the middle of her whole deck), the bow "on her centre line" (the Carrack's stands 1.68 m to port). | Worded as the code does. |
| D13 | Major | **The safety net**: 64 of 66 fresh mutants survived - the declared missile and burst gifts, the crosshair's geometry, the pack's stow paths, the panel's online repaint and the host's offline panel frame, the watch's work and night guards, the captains' night laws. | Every one pinned but two, recorded equivalent with their reasons: `LD-H-cry-any-boat` (an uncrewed boat has no crew stood to hear a call) and `LD-HM-gift-dead-guard` (every mark the receiver is handed was made in the same call by `companionMarksFor`, which already passes the dead and the knocked out). |

## For Mac

Kept as the PR has them - design questions rather than defects:

- **His pack** (ANSWERED 2026-10-01, COMPANION-WEIGHT, `03-World/Naval-Combat.md`): he carries what a person of
  his strength can - DFU's MaxEncumbrance of his live body, 67-97 kg by class - where the PR left it uncapped; Info and Talk both open it; a
  droppable quest item handed to him counts as dropped, as in a chest (the wagon is exempt); another player's
  companion answers DFU's "You see..." and trades nothing.
- **The night's HUD** (N8): the tags and the compass still name a dark pirate out to 700/900 m while her lanterns,
  the lamps and the lookout show nothing - kept for the player's safety; gating them by the lookout's law is one line
  each.
- **My boat dark by default** (#502's own "your call"): Come Sail Away's switch is off when she is built.

## Checked and sound

- **The watch**: below is not gone - the count, the trim (last of the roster first) and the restore read the sleepers;
  a taken sleeper comes up out of the hatch and one going ashore comes home on deck; ALL_HANDS fires only on a
  sleep-to-wake turn, never twice in a fight; the swing is an animation edge only (no latch read, no sound, no
  DFRandom draw, no foe pool); every hull's bow and hatch are deck cells. Twelve crews of eight cost 0.06-0.13 ms a
  frame.
- **The night**: `nightSight` is never farther than the day's; the flashes share the sea clock; sea ships' and peers'
  puppets' flashes match their contact ids; the far lamps go through the real naval pass with no new GL state, none by
  day, none near; a prize stays a sea hulk (no double lamps).
- **The gifts**: never a harmful or mixed spell, a free ready, or another's companion; the crosshair, the touch and a
  bolt never cross a wall; no save, no blow, no crime, no renown, no team change; nothing lands twice; magicka is
  spent once, at the price fixed when the spell was readied, and every arm clears the readied spell. Gifts tick,
  expire, cap and shield on his own sinks in all three places.
- **The packs**: the codec is the cargo's (a shallow copy, then `setItemFields`); an old save loads an empty pack; two
  knocks, or a prune and a knock, stow once; quest items, summoned items and transport follow DFU's law; a new game
  starts an empty party.
- **The bars and the cards**: `companionKey` covers everything the card draws; no DOM writes in steady state (the panel
  with two companions 1.8 µs a frame, 32 bars 21 µs); the panel ignores the pointer, hides under every window, and
  fits a full party with two companions on desktop and a phone held upright.

## Not fixed

- **The watch**: a man walking to the hatch at nightfall may still say a night-watch word on his way; a crew sleeps
  through fires on her own deck (the record claims nothing, not driven); `navalCrew.batches()` walks its entries every
  frame (F59's "no garbage" not measured).
- **The night**: a sinking ship's far lamps are emitted below the sea for about 12 s (hidden by the classic ground's
  depth test; with Deep Waters' translucent top, drawn attenuated - not proven in pixels); `GUNFIRE_KEEP` (24 volleys)
  could evict a recent flash in a great night melee; the merchantmen held overnight all sail at 08:00 - neither driven.
- **The gifts**: his spells do not ride a save (a load stands him without them - said); a few other gifts (Water
  Breathing, Jumping, Slowfall, the concealments) may have no reader on him - not traced. Pre-existing, outside this
  PR and the root of M2: `pickTouchTarget` refuses a level ByTouch aim at any 1.8 m foe, where DFU's SphereCast meets
  the whole capsule.
- **The packs**: after a quickload into a save without him the open window reads an empty list, and what is put into
  it then is lost when it closes; the hold's window captures its cargo once (P3's shape, pre-existing, not driven). The
  general fix - a load closing every storage window - is every load path's. Not driven: F5 from his pack indoors
  opening the street's pages; a companion held at 1 HP while a window pauses his layer.
- **The panel**: its cover ignores the held map and the travel view (as it did for an online party); the classic
  skin's SmallVertRight and SmallDeckRight icon schemes sit under its corner; the party card's own 16px effect tile
  still draws the 2x cut pixelated (U8's law, older code); the effects row's letters are read aloud.
- **Older survivors**: `navaudit_captains.json`'s NAV1-the-tacks-carry-dropped, NAV1-no-pay-off and NAV1-never-warped
  survive on main too (AUDIT NAV1's); `shiplife.json`'s SHIPLIFE-AI-no-hold gave no verdict in 48 minutes on main and
  on the PR alike.

## PIN MOVED

`shipwatch` (the morning one at a time; the dark's hours named apart from the lanterns'; a boat lit by lanterns she
carries), `auditnav2_crew` (F41's talk with #2, her lookout #1 now), `allycast` (the touch gate; the ready's arms),
`audit23_magic` and `fparm` (the ready's arms), `audit62_touch` (each tap pick's pool), `auditcrew` (CC-A2: his whole
rides; CC-E2: his name beside his place), `companionkit` (his pack by key; another's companion his own name; the one
codec), `csa_close` (the load's door lifts the party first), and `questparty3c`, `keptkill` and `summonsync` (the own lane's names) - each marked in
its own line with its law intact. Re-aimed by content and killed again: `shipwatch`, `auditnav2_crew`,
`auditnav2_online`, `allycast`, `spell_gift`, `companionkit`, `crewcompanions`, `auditcrew`, `auditqp`, `csa_close`,
`deckwalk`, `navaudit_presentation`, `questparty3c`, `raid2` and `seapeace`.

## The deploy

The account service bundles `src/net/realm/realmGoldLaw.js` (the account deploy's path filter carries it): from its next
deploy the first-save gate counts a companion's pack as customs does (P1). No migration, no relay change; the account
version is unchanged, as at EMPIRE-ACCOUNT. The site and the service may land in either order - until the service
deploys, its gate counts what it counted before. Server-account's own suites: 858 of 858.
