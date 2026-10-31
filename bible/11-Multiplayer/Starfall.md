# The Starfall

An online wave-defense world event that runs during the Witches' Festival. On Mephala's day the covens work a rite to
snare stars. Each real hour is a night on the sky, and three stars fall in the wilds of one coven's region, near
different towns. Players who reach a fallen star defend its light against four waves of the coven's foes and then its
master. Each defender of a held star gets a signed receipt that pays Renown and Silver, and on the device gold,
Starfall Glass, gear and sometimes a piece of the Starspun Weave. A seasonal questline, The Thirteenth of Frostfall,
runs beside it.

## How it works

**When** (`src/net/starfall/starfallLaw.js`). The Starfall runs only inside the festival's dated window
(`src/net/festivalLaw.js` `FESTIVALS`, `starfallRuns`); a star counts only if it lands inside it (`starInWindow`).
Night N is the sky's night whose midnight falls at `N x STAR_HOUR_MS`. Its three stars fall at `STAR_FALLS_MS` from
midnight (sky 18:00, 21:00 and 00:00), each after a `STAR_OMEN_MS` (90 s) omen, and each stands `STAR_LIFE_MS`
(15 minutes). The law reads wall time alone, so the relay needs no sky. On the sky's 13th of Frostfall the third star is
the **Heart-Star**: its master's circle is twice the size and its rewards double
(`src/systems/starfall/starfallNight.js`, client only).

**Where** (`src/systems/starfall/starfallCovens.js`, `src/systems/starfall/starfallSites.js`). On the Bay each night's
coven is drawn from a bag over the Bay's covens (Glenmoril serves Hircine and stands apart), never twice running, and its
three stars fall in its region's wilds, apart from each other and from the day's gate. Each province with a lane
(`SITE_EVENT_LANES`) has its own night at the same instants, with its own authored coven (`STAR_PROVINCE_COVENS`), on its
front's turn only (`starFrontDay`). A star's number names its lane (`starOfLane`, `starLaneOf`). Cyrodiil's open zone has
none.

**A fallen star.** A crater, a stone bound in black thread and a beacon, with a streak and an impact at its fall, a mark
on the map and a tracker (`src/ui/starfall/starMapMark.js`, `src/ui/starfall/starTracker.js`, `src/ui/starfall/starBar.js`).

**The defense.** The first player within `STAR_SAY_M` (55 m) springs the coven and owns its foes, by the World of
Daggerfall's camp law; others fight them through the owner, and an owner who leaves hands them on after
`STAR_ORPHAN_MS`. The cell room the star stands in keeps its ledger. The first wave starts `STAR_GATHER_MS` after the
first word. There are `STAR_WAVES` (4) waves sized by `starWaveSize` from the defenders present
(`STAR_WAVE_MIN` 4 to `STAR_WAVE_MAX` 24), then the master. Foes are Daggerfall's own, chosen from a band by the
defenders' median level (`STAR_BAND_TOPS`), at `STAR_FOE_HEALTH` (2x) health; the master is an elite. A wave ends when
its foes are dead, never faster than `STAR_KILL_MIN_MS` a foe, or after `STAR_WAVE_MAX_MS`. Each blow the coven lands drinks
the star's light (`STAR_LIGHT` 100, `STAR_BLOW_LIGHT` a blow). The star is **held** when the master falls, or **lost** if its light reaches zero or
dawn comes.

**Receipts and rewards.** Each defender who struck and stood gets a `j1` receipt (`src/net/starfall/starReceipt.js`),
signed with the relay's key. The account service (`server-account/src/stars.js`, `/v1/star/claim`) counts a (night,
star, account) once, at most `STAR_CLAIMS_DAY_MAX` (9) a UTC day, pays three quests' Renown and 30 Silver under the day's
combat cap, and the cards say *Stars held*. On the device, rolled from the receipt's seed
(`src/systems/starfall/starSpoils.js`): gold (60 a level), one to three Starfall Glass (template 576, a trade good), a
known Magic-or-better piece, and a Starspun Weave piece a quarter of the time. The Heart-Star doubles the gold and glass
and always gives a Starspun piece.

**The questline** (`thirteenthFrostfall` in `src/systems/questlines/qlLines.js`). Tier 3, from level 6, online, a
registered account, open only while the Starfall runs. Morwen, a Wyrd Sister of Glenmoril, gives it at the Glenmoril
Coven; the villains are the Sisters of the Bluff. A step whose deed is a star waits out of season. The covens have no
quest markers, so its scripts meet there by arrival (`pc at`).

## Rules

- A lore-accurate defense: something falls from the sky, players defend it in waves, and a boss ends it (the owner).
- A seasonal questline ties into the event (the owner).
- Several encounters spread through the region, not one (the owner).
- Text and UI are enhanced plus, plain and not over-explained (the owner).
- Online only; the relay holds the ledger and signs receipts.
- Foes are owned by a player's machine, a departure from the world bosses' relay-run body: a star stands in open
  country, where a relay body has no path, spells or melee.
- No site-bound world event stands in Cyrodiil's open PvP zone; each province's coven is authored content (the owner).

## Daggerfall Unity

DFU has no other players and no fallen stars. The event rests on DFU's own data: the Witches' Festival (`HOLIDAYS`, day
283), Mephala's summoning day on the same day (`DaedraSummoningService`), the Bay's covens in MAPS.BSA and FACTION.TXT,
and female coven members (DFU's quest `person`). Departure: the questline meets at the open-air covens by arrival, since
DFU's `place` actions need a site marker the covens do not have.

## Code and tests

- `src/net/starfall/starfallLaw.js` - window, nights, lanes, waves, light, phases
- `src/net/starfall/starReceipt.js`, `src/net/starfall/starClaims.js` - receipts and their carrier
- `src/systems/starfall/starfallCovens.js`, `src/systems/starfall/starfallSites.js`, `src/systems/starfall/starCoven.js` - covens, sites, the coven's foes and master
- `src/systems/starfall/starfallClient.js`, `src/systems/starfall/starSpoils.js`, `src/systems/starfall/starglass.js` - the page's word, spoils, the glass
- `src/scenes/starfall/starfallHost.js`, `src/scenes/starfall/starRewards.js` - the world host's Starfall, the rewards
- `server-account/src/stars.js` - claims
- `test/net/starfall/star1_law.test.js`, `test/net/starfall/star3_relay.test.js` - the law, the relay
- `test/systems/starfall/star5_defense.test.js`, `test/systems/starfall/star7_rewards.test.js`, `test/net/starfall/star7_service.test.js` - defense, rewards, the service
- `test/systems/questlines/star8_frostfall.test.js` - the questline
- `test/world/worldWide/ww5_stars.test.js` - every theatre's night

## Open

- No Discord herald: three stars an hour would flood the channel; how much it wants is the owner's call.
- A modified owner's client can clear waves early, drain the star or call the master fallen, within the relay's pace
  limits; the service bounds what receipts are worth.
- Four accounts at four forged stars in one cell can make a fifth, real star there wait while they stand.
