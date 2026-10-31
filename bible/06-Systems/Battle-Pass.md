# The Folios (the season pass)

A season of the online game, with two reward tracks the player opens as folios. Season One is **Dwemer's Breach**:
for sixty days old Dwemer works crack open across Tamriel, constructs climb out, and a Brass Colossus wakes in the
last stage. Its free track is **the Brass Folio** and its premium track **the Gilded Folio**; every item is bought with
Aurum (`06-Systems/Aurum.md`). The player meets it in the shop's first section, **Folios**, and in the world as
tremors and Brass Fissures. The player reads "folio" and "page"; the code keeps its `pass` names
(`src/net/battlePassLaw.js`, `/v1/pass/*`). DFU has no seasons, accounts or passes.

## How it works

**The season** (`PASS_SEASONS`). Season One runs from 10 November 2026 (UTC) for sixty days in three stages of twenty:
I. The Tremor, II. The Brass Halls, III. The Heart Wakes. The season's days bound its world and its challenges. Its
tracks stay on sale for good (`passTracksOpen`), and finds never stop.

**The tracks** (`PASS_PANELS`). The free track is every registered account's. The premium track opens once for
`PASS_PREMIUM_AURUM` (1,000 Aurum). Each item is bought once for its own Aurum. A page (panel) opens when its own track
has had its `open` Aurum spent on it; the first page of each is open from the start. Items are the account's for good,
on every character (`players.pass_items`).

| Track | Page (opens at) | Items (Aurum) |
| --- | --- | --- |
| Free | I (0) | Dwemer Cog, glyph (200); Aetherium Shard, profile icon (300) |
| Free | II (300) | Tremor-Born, title (400); Brass Gate, portal skin (700) |
| Free | III (1,000) | Tonal Shatter, kill effect (700) |
| Premium | I (0) | Tonal Fork, glyph (200); Dwemer Lexicon, profile icon (300); Aetherium Coil, aura (1,000) |
| Premium | II (600) | Gearheart, profile icon (400); Brass Crown, glyph (300); Heart-Waker, title (600); Gilded Coil, aura (1,200) |
| Premium | III (2,000) | Echo of Numidium, title (800); Brass Automaton, mount look (1,600) |
| Premium | IV (6,400) | Aetherium Wings, aura (2,000) |

Page IV opens only once every item before it is bought. The Aetherium Wings are the developers' Seraph Wings in
aetherium's pale blue (`src/render/auraRing.js` `AETHER_WING_RGB`); the developers keep the gold.

**Finds** (`server-account/src/battlePass.js`). The page asks with a deed's source; the service answers with the Aurum
found (`PASS_SOURCES`: 1 for a foe or a gathering, 2 for a construct, 3 for a tavern game or the sea, 4 for an elite,
8 for a world event, 10 for a quest or bounty, 20 for an endgame deed). At most `PASS_DAY_AURUM` (100) a UTC day, in
one `find` ledger line, and `PASS_DAY_ASKS` (2,000) asks. A find carries its own id and is retried with it while the
service is unreachable; the service keeps the id with its answer (`pass_asks`), so a retry is counted once. Acts with
no receipt behind them pay no find (`src/systems/questlines/qlActs.js` `ACT_NOT_FOUND`).

**Challenges** (`PASS_CHALLENGES`). Five a stage, counted while the stage runs, each paying once (`challenge` lines):
470 Aurum in the first stage, 560 in the second, 710 in the third.

**The world** (`src/scenes/seasonHost.js`, law `src/systems/pass/seasonWorld.js`). Online only, and nothing stands
before the relay's clock is heard.
- *Tremor.* The first `TREMOR_MS` (6 s) of every hour on the shared clock: camera kicks harder each stage
  (`TREMOR_KICK` 1.5, 2.5, 4), a rumble, dust, and a news line on the event board.
- *Brass Fissures.* `FISSURES_BY_STAGE` (2, 3, 3) in each area: a Bay region, or a province's district past the Bay.
  Pixels are drawn by hash from the scan Dagon's Breaches use in that theatre, `FISSURE_APART_PX` apart and
  `FISSURE_ROAD_M` (12 m) off roads, so every machine finds the same. A fissure gives way to its theatre's gate of the
  day. Past the Bay a province's area is drawn once every region that may lay a road on it has landed. The map shows
  each as a brass cog crossed by a blue crack. The model is `src/world/fissureModel.js`.
- *Constructs.* Each fissure's camp is Daggerfall Enemy Expansion's Centurion Sphere (289), Iron Golem (270) and, from
  the second stage, Steam Centurion (290). The first player within `SEASON_SPRING_M` (90 m) springs it on the camp law;
  others see the owner's. A camp cleared with bodies quiets that fissure for that character for `SEASON_QUIET_MS`
  (20 minutes), kept across a reload. A stander walking past `SEASON_LEAVE_M` (260 m) gives the camp up with no
  hand-over, as the Starfall's leash does.
- *The Brass Colossus.* In the third stage each area's first fissure is its Heart Fissure: two Spheres, a Golem, and a
  Steam Centurion raised to raid leader, with three times a raid leader's health and the Warded, Stormproof and
  Blade-turning traits. It is not tinted brass: the surface has no tint, so its size, name, traits and bar say what
  it is. Every screen names it, stands its traits and bar, and says its fall.
- *The Resonant Maul* (`src/systems/pass/resonantMaul.js`). A character whose blow landed on the Colossus asks the
  service (`POST /v1/season/maul`, `server-account/src/seasonClaim.js`): yes once a UTC day per account, inside the
  Heart stage, on the service's clock. A Legendary Dwarven warhammer: +30% damage, +12 Strength, +25 Blunt Weapon,
  Resist Shock while held, and Resonance, +40% against the season's constructs. It is unrolled: no warhammer roll lands
  on it. It is kept on the device from its mint until a save holds it, and asked again by its id if lost.

**The window** (`src/ui/enhanced/enhancedPass.js`). The season's name, story, stages and today's finds against 100,
then the two folio covers. A cover opens its folio page by page (arrows, dots, arrow keys, swipe), on the first page
with an item still to buy. Items show Buy, Owned or Wear; a locked page shows its items greyed with the Aurum still to
spend. Under reduced motion pages change without turning.

## Rules

- A themed pass, not a plain battle pass: a season changes the world, with its own foes, boss and weapon, in three
  stages of twenty days (the owner).
- A free track and a premium track, both bought with Aurum; pages open by spending on their track; tracks never
  expire; no levels, experience, boosters or money passes (the owner).
- Named **Folios**, opened like a panel to reveal the rewards; locked pages preview their items (the owner).
- No glut of titles and profile icons: one title free, two premium, three icons in all (the owner).
- The capstone is the developer wing aura in light blue (the owner).
- TAMRIEL-WIDE: fissures stand in the Bay and the eight provinces' theatres, Cyrodiil's open zone none
  (`src/net/wire.js` `SITE_EVENT_LANES`). The camp, Colossus, Maul and tremor read only the fissure's own place.
- `/v1/pass/find` and the Maul claim are progression claims, asked of the seated realm character (`pass` stream).
- A refusal rests the page (`src/net/askRest.js`); a shut pass is read again ten minutes on.

## Code and tests

- `src/net/battlePassLaw.js` - seasons, sources, challenges, panels, buy blocks
- `server-account/src/battlePass.js`, `server-account/src/seasonClaim.js` - finds and the Maul claim
- `src/scenes/seasonHost.js`, `src/systems/pass/seasonWorld.js` - the world: tremor, fissures, camps, Colossus
- `src/systems/pass/resonantMaul.js` - the Maul
- `src/ui/enhanced/enhancedPass.js` - the Folios window
- `test/net/passpanels_law.test.js`, `test/server/passpanels_service.test.js` - the panels and their service
- `test/systems/pass/passclient.test.js`, `test/server/storefront_passaudit.test.js`,
  `test/server/storefront_audit2_pass.test.js` - finds, retries, refusals
- `test/scenes/seasonaudit_world.test.js`, `test/scenes/storefront_audit2_world.test.js`,
  `test/world/gate/seasonclear.test.js`, `test/systems/pass/fissureroads.test.js` - the world
- `test/server/seasonmaul_service.test.js` - the Maul's day
- `test/world/worldWide/season_tamriel.test.js` - fissures in every theatre
