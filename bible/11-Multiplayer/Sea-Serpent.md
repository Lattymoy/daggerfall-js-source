# The Sea Serpent

Sethrakul, the Old Coil: an online world boss on the open sea, fought by players from their ships. Every four real
hours bells ring, a ring is drawn on the map over a packet lane, and the serpent rises there for up to twenty-five
minutes. Ships sail in from anywhere and fight it with their guns; hands aboard strike it with bows and spells. Its
kill pays each earner a signed receipt for a hoard, Renown and silver.

## How it works

**The schedule** (`src/net/serpent/serpentLaw.js`). The serpent runs on the shared clock. It rises every
`SERPENT_EVERY_DAYS` game days on the odd days: every four real hours, at the same six UTC times. Every client and the
relay compute the instants with nothing sent (`serpentTimes`, `serpentPhase`).

| game time | real time (UTC) | what |
|---|---|---|
| 02:00 | HH:02:30 | the sighting: a news line and a map ring |
| 05:00 | HH:17:30 | it rises; the fight begins |
| 08:00 | HH:32:30 | a storm line; ships may still join |
| 10:00 | HH:42:30 | unslain, it dives and is gone |

(HH is 03, 07, 11, 15, 19 and 23.) It takes the dawn watch, the gate's quiet half, so the two never stand at once.
A ship may join at any time until it dives (`serpentAdmits`).

**The sighting** (`src/systems/serpent/serpentOmen.js`). Each line is said once a day in the event board's news (the
chat when the board is off): the sighting with the local rising time, the rising with time left, the storm, the dive.
The map ring has radius `SERPENT_RING_PIXELS`, its centre shifted off the site by the day's roll. Inside it the HUD's
compass shows a sea-green diamond. The pause menu's Timers window carries its row (`src/systems/eventTimers.js`).

**Where it rises** (`src/systems/serpent/serpentSite.js`). It hunts the world's packet lanes - the Bay's, those past
it, and those across its edge - scored by their ends' world keys, best first (`serpentLaneTries`), at a place along
`SERPENT_ALONG` of the way where the sea is open all round. After `SERPENT_LANE_TRIES` lanes with no site there is no
serpent that day. A game without the land past the Bay takes the hub's word of the site the accounts agree on
(`serpentSiteWordOk`, `SERPENT_SITE_LAW`). The relay never reads a map: a forged site stands a fight nobody else
folds.

**The body** (`src/net/serpent/serpentBody.js`, shared by relay and clients). The head runs legs - lines and arcs -
and the body of `SEG_N` segments of `SEG_LEN` follows its track, its girth `SERPENT_GIRTH` times its first build.
It never leaps: every leg after its rising is swum from where the last left its head. Its mode (deep, cruise, breach,
rear, coil, dying) sets how it rides the sea. A segment above the sea may be struck; a ball on its thrown-up head lands
at `HEAD_X`.

**Its blows** (`SERPENT_ATTACK_TABLE`, `src/net/serpent/serpentBrain.js`). The relay says each attack's shape, landing
and target; each client judges its own ship and feet (`src/systems/serpent/serpentStrike.js`). A hurt is a share of
her whole hull plus points; braced, half.

| attack | phase | shape | wind-up | hurt |
|---|---|---|---|---|
| Tail Lash | 1 | sector 85 m, 120 degrees | 2.6 s | 6% + 6, a throw |
| Breaching Ram | 1 | lane 18 m wide | 3.6 s | 14% + 12, a throw across the lane |
| Rising Maw | 1 | disc 20 m | 3.2 s | 7% + 8; dives and bursts up under its mark |
| Venom Spit | 1 | disc 13 m | 2.6 s | 1.5% + 2; a venom pool for 9 s |
| Constrict | 2 | ring 36 m | 4.8 s | the coil |
| Abyssal Roar | 3 | rings 22-120 m | 2.8 s | 5% + 5, canvas torn; safe under its jaws |

A throw and a torn canvas are `SERPENT_THROW_X` and `SERPENT_CANVAS_X` of the table's. A pair of ships takes
`SERPENT_PAIR_SHARE` of every blow (`fleetShare`); one ship alone, and three or more, the whole.

- **The coil.** At 66% it cries and winds about a ship (the most hated `SERPENT_THREAT_PICK` of the time). Inside the
  ring she is held. The coil has its own health, `COIL_TEAM_S` seconds of the fleet's broadsides (at least
  `COIL_HP_MIN`), half of each blow passing to the serpent (`SERPENT_COIL_PASS`). Broken, the serpent is stunned
  `SERPENT_STUN_MS` and takes `STUN_X`; left whole `COIL_MS`, it crushes her.
- **The maelstrom.** At 33% a whirl forms beside it and pulls every ship within `MAEL_R` toward its eye
  (`MAEL_PULL`, `MAEL_SWIRL`); the eye grinds a hull (`MAEL_GRIND`). Every hull can sail out.

**Its gale** (`src/scenes/serpentHost.js` `SERPENT_GALE`). Within `SERPENT_NEAR_M` of its waters while it swims, my ship
sails as on her quarter on every heading, in at least 1.15 of the rated wind, her helm half again quicker - through Come
Sail Away's `gale` seam. Other players' hulls pass through mine outside a PvP zone (`src/scenes/comeSailAway/peerHulls.js`),
so ships in the fight never collide.

**The relay's fight.** The fight lives in the cell room its site stands in, stepped every `SERPENT_TICK_MS`. A ship
within `ADMIT_R` joins (`in`) with its hull and level. Each fighter brings `SERPENT_TTK_S` seconds of its ship's
reference fire to the serpent's health and deals through a bucket (`SERPENT_BUCKET_RATE_X`, `SERPENT_BUCKET_DEPTH_X`,
`SERPENT_HIT_CAP_X`); a late ship joins at the fight's fraction with an empty bucket. A hand aboard another's ship
deals from a hand's purse (`SERPENT_HAND_REF`) within `SERPENT_HAND_REACH_M`: its arrows and missiles are judged against
the serpent's segment boxes on the hand's machine. The relay also judges each blow on the captain's pose and keeps its
own hull count (`src/net/bossRef.js`, `src/net/bossBody.js`), measuring until staff enforce it.

**The kill.** A fighter earns as a dealer at `SERPENT_RECEIPT_SHARE` of its own share, as a stander at
`SERPENT_PART_SHARE` dealt or `SERPENT_STOOD_SHARE` of the fight within `SERPENT_STAND_R`. A dealer's party members who
came and earned nothing get a stander's receipt from the hub. The receipt is `l1` (`src/net/serpent/serpentReceipt.js`),
Ed25519 under the relay's key. The hub keeps each account's latest and hands it to every hello while good, and says
the kill to everyone online. A kill not yet said is tried again (`SERPENT_TELL_RETRY_MS`).

**The claim** (`server-account/src/serpents.js`, `/v1/serpent/claim`). One row a day and account. It pays the
character `RENOWN_SERPENT_QUESTS` quests' Renown (`src/net/renown.js`), half for a stander, and the kill's silver under
the day's combat cap. On a dealer's first write it rolls Coilbreaker (`SERPENT_TITLE_CHANCE`) and The Maelstrom aura
(`SERPENT_AURA_CHANCE`) from its own randomness. A guest gets its hoard once and nothing counted.

**The hoard** (`src/systems/serpent/serpentSpoils.js`), rolled on the receipt's seed at the admitted level, never past
the character's: `SERPENT_SPOILS_GOLD_PER_LEVEL` gold a level, a Rare-or-better and a Magic-or-better piece for a
dealer, less for a stander, and a Deadlands Ember for everyone (`SERPENT_EMBERS`, `src/net/serpent/serpentHoardLaw.js`).
A dealer may find a Sethrakul's Coilscale set piece, and last of all the Sunken Sovereign, a Gilded saber
(`SERPENT_GILDED_CHANCE`, `src/systems/gilded.js`). The device carries the receipt (`src/net/serpent/serpentClaims.js`)
until the service settles it.

**Drawn and heard.** `src/render/serpentRender.js` draws the body as a swept tube; `src/systems/serpent/serpentSounds.js`
gives it the Dreugh's and the Lamia's voices.

## Rules

- Online only: the relay keeps the fight and signs each kill; the account service pays (Mac).
- A ship's fight, one beast named; the table `SERPENT_BOSSES` holds more later without a new mechanism (Mac).
- One ship alone cannot win; two or more ships can (Mac). The validated rebalance's numbers stand (Mac).
- Must be in the fight to earn: a share dealt or a share of the fight stood near it (Mac).
- It never leaps: a head placed somewhere new with its body laid behind it in one frame cannot be sailed out of (from
  Mac's report that it teleported).
- Its own equipment and the gate's currency: Coilscale and the Deadlands Ember (Mac); a Gilded weapon and a rare
  title or aura for a dealer (Mac).
- The relay never reads a map; a word of the fight names its site, and a client folds its own site's alone.

## Daggerfall Unity

Daggerfall has no other players and no sea serpent; none of this is a DFU member.

## Code and tests

- `src/net/serpent/` - the law (clock, sites), body, brain, receipt, claims, herald, hoard law
- `src/systems/serpent/` - omen, site finder, strike judging, spoils, sounds
- `src/scenes/serpentHost.js` - the client host: gale, hand strikes, the fight on this screen
- `server-account/src/serpents.js` - claim, Renown, honours
- `src/render/serpentRender.js` - the body drawn
- `tools/serpentFleetSim.mjs` - fleet simulations against the relay's brain
- `test/net/serpent/` - law, relay, audits, herald, the leap, the players' fight, honours, retry, the set's service

## Open

- A lone galleon at gunnery well past the measured wins some fights in the gale; Mac's call on whether that stands.
- No frame of the fight has been profiled on a live relay.
- The relay's hull count measures and does not yet wreck a ship.
