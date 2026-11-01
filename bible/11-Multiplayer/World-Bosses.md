# World Bosses: Dagon's Breach

An online world boss. Every game day (two real hours) at dusk, Dagon's faithful tear a breach somewhere in each
theatre. The map rings it and the event board says when it opens. Players step through the gate's fire into the
Burning Court, a made level in the Deadlands, and fight Valkynaz Ruhn, Warden of the Burning Gate. The relay runs him.
At his fall he spews per-player loot, and each fighter who earned it gets a signed receipt the account service counts.
The player reads **Dagon's Breach**; the code says gate (`gate:<n>`, `gate*`).

## How it works

**The schedule.** A pure function of the shared clock (`src/net/gate/gateLaw.js`), so the omen, ring and gate cost the
relay nothing. In game minutes of the day: the omen at `GATE_OMEN_MINUTE` (17:00), the gate rises at
`GATE_RISE_MINUTE`, opens at `GATE_OPEN_MINUTE` (20:00), seals at `GATE_SEAL_MINUTE` (22:00), and at
`GATE_WRATH_MINUTE` (24:00) Dagon's Wrath razes a court whose Warden still stands. Lines say real local times. A gate's
number is its game day plus `lane x GATE_LANE_SPAN`; each lane's day runs `GATE_LANE_STAGGER` minutes behind the last.
Offline there is no gate.

**Every theatre.** The Bay and each province in `GATE_LANES_OPEN` keep a gate of their own, with its omen, ring, court,
marks, portents, receipts and rite (`src/scenes/gate/gateLanes.js`). A province's kill counts at its own seats
(`src/scenes/gate/gateSeat.js`). Cyrodiil's open zone has no gate.

**The site.** Every client finds the same one from the game's own map rows (`src/systems/gate/gateSite.js`,
`src/systems/gate/theatreGateSite.js`): a region from a shuffle bag, so every region takes a gate before any takes a
second; a land pixel with no location on it or its neighbours, two to four pixels from a fast-travel town; and a spot up
to `GATE_SPOT_SPREAD_M` off its centre. The relay never knows the site.

**The omen.** A ring of `OMEN_RING_PIXELS` on both maps, a compass marker inside it, and lines on the event board
(`src/systems/gate/gateOmen.js`). The fall is the one line that needs the relay: the court tells the hub, which fans it.
The Discord herald posts the omen and the fall (`src/net/gate/gateHerald.js`).

**The gate.** Mac's own Blender model, baked into the tree (`src/world/gate/gateModel.js`), with a fiery membrane and a
tall red beacon. A gate on a pixel not yet built stands its beacon alone. Its plaque and a banner within 60 m count to
the opening, the seal or the collapse. It is entered by pressing or walking into the membrane while open; the step is a
veil of fire (`src/ui/gate/gateVeil.js`).

**The rite.** From the omen to the opening, 6 to 8 faithful and a Summoner work their rite in a circle 90-180 m from
the gate (`src/net/gate/gateRite.js`). Breaking it pays each helper an extra Deadlands Ember when the breach closes, and
a chest stands in their circle.

**The court.** A dungeon location made in code (`src/world/gate/gateArena.js` `gateArenaLocation`): a disc of black
flagstones over a sea of fire under the Deadlands sky (`src/render/deadlands.js`), on one shared clock. Rest, saving,
travel, the automap and Mark are refused, and companions wait outside. Its room is `gate:<n>`, never a world room, so
the dungeon's memory and foes stream do not run there.

**Courts of a night.** A night holds up to `GATE_COURTS_MAX` (16) courts, each its own fight, Warden, kill, receipts
and spoils (`src/net/gate/gateCourts.js`). The first is `gate:<n>`, the k-th after it `gate:<n>.<k>`. The first court
keeps the night's seat book, so an account fights in one court a night. A newcomer sits in the lowest court that has
not won and seats fewer than `GATE_COURT_FIGHTERS` (50), with `GATE_PARTY_SLACK` more where its party already sits.
The gate stands until every court's fight is over.

**Watchers and copies.** A fight seats up to `GATE_FIGHTERS_MAX` (256) accounts. A full court keeps the next arrivals
as watchers who see and hear the fight but take no part, and ask for a seat every `COURT_WATCH_ASK_MS`. Past a court's
sockets its crowd goes to copies (`COURT_COPY_RE` in `src/net/hubShards.js`). A court admits `GATE_HELLO_HZ_MAX` hellos
a second.

**The Warden.** The relay steps a pure brain every `BRAIN_TICK_MS` (`src/net/gate/gateBrain.js`). Each fighter adds
`BOSS_TTK_S` (240) seconds of `dpsRef(lv)` (5 + level, clamped to 1..60) to his health at his current fraction. A
fighter's damage is a bucket refilling at `BUCKET_RATE_X` times its reference, `BUCKET_DEPTH_X` deep, no blow over
`HIT_CAP_X`; over it a blow is clipped. Every attack is telegraphed on the floor (`ATTACKS`: Cleave, Ground Slam,
Charge, Hellfire, Flame Nova, Crushing Leap, Meteor of Oblivion, Spokes of Dagon, the Burning Gaze and more). Each hits
for a share of the struck player's own maximum health, judged on that player's machine. He turns phases at
`PHASE_AT` (66%, 33%), shielded for `SHIELD_MS`. Aimed attacks favour the highest threat. He cannot be pacified.

**Marks.** Each gate's Warden wears one aspect (Burning, Rime-Wrought, Storm-Crowned, Venom-Blooded) and
`GATE_TRIALS_A_DAY` trials from nine, by the cycle `gateModsOf` (`src/net/gate/gateMods.js`). No two gates running
share one. The Legion-Lord trial brings his host of Harriers, Sappers and Ward-Bearers (`src/scenes/gate/gateHost.js`).
The night's floor plan and portents are in `Breach-Portents.md`.

**Death.** A player killed in the court is cast out before the gate, not to a temple, and may step back in while it
is open. After the seal the court refuses them.

**The kill and receipts.** At zero the court stamps the kill once. Each account that dealt `RECEIPT_SHARE` (2%) of its
own share, or stood alive half the fight, or broke the rite, gets an `r1` receipt signed with the relay's
`GATE_SIGNING_KEY` (`src/net/gate/gateReceipt.js`); its prefix and key keep it from passing as an identity token. The
account service's `POST /v1/gate/claim` writes one `gate_kills` row a gate and account; the profile counts
*Breaches closed*. Guests fight and loot, but only registered accounts are counted.

**The spoils.** Rolled on the receipt's seed, seen by that player alone (`src/systems/gate/gateSpoils.js`): gold
(`SPOILS_GOLD_PER_LEVEL` a level), three pieces from the boss's loot source, a Legendary chance of `SPOILS_LEGENDARY`,
a Deadlands Ember (`SIGIL_STONE_TEMPLATE`), and last the Dragonfire Oath at `GATE_GILDED_CHANCE`. The pieces burst from
his body and bounce to rest (`src/world/gate/gateSpew.js`); walking over one takes it. Pieces left on the floor go to
the mailbox, or into the pack where post cannot go. A receipt that arrives outside the court is paid straight into the
pack. The Sigil Broker trades in Deadlands Embers.

## Rules

- The relay is the authority over the boss (Option B): it keeps his health from the fighters' blows, runs his attacks,
  stamps the kill and signs receipts (Mac). Everywhere else co-op's trust law stands.
- The event is Dagon's Breach in 3E 417, opened from within by Dagon's faithful and sealed by the Covenant; no player
  string names an Oblivion Gate or a Sigil Stone (Mac). The Ember's template id and every key keep their bytes.
- The Warden cannot be pacified and wears different marks every gate (Mac).
- No companion enters the court (Mac).
- Fifty fighters a court, placed automatically with the party together; the gate stands until every court's fight is
  over; each court's kill is said in chat and the night once on Discord (the owner).
- A full court keeps its watchers rather than casting them out; nobody is unseated for a watcher (the owner).
- A site-bound world event stands nowhere in Cyrodiil's open PvP zone (the owner).
- The relay's refusal words (`the gate is closed`, `the gate is sealed`, `the gate is closing`, `the court is full`) are
  protocol and keep their bytes.
- `src/net/gate/gateRite.js` and `src/net/gate/gateBrain.js` are in the relay's bundle: an edit to them is a relay
  change (`test/net/relayversion.test.js`).

## Daggerfall Unity

Daggerfall has no other players and no world boss, so none of this is a DFU member. The Warden is drawn with
Daggerfall's own Daedra Lord sprite at three times its size, and his sounds are Daggerfall's clips pitched for his size.

## Code and tests

- `src/net/gate/gateLaw.js` - the schedule, lanes, sites' rolls, room keys, boss table
- `src/net/gate/gateBrain.js`, `src/net/gate/gateMods.js`, `src/net/gate/gateCourts.js` - the fight, the marks, the courts and seat book
- `src/net/gate/gateReceipt.js`, `src/net/gate/gateClaims.js`, `src/net/gate/gateRite.js`, `src/net/gate/gateHerald.js` - receipts, claims, the rite, Discord
- `src/net/gate/gateLink.js` - the page's link to its court, watching included
- `src/systems/gate/gateSite.js`, `src/systems/gate/gateOmen.js`, `src/systems/gate/gateSpoils.js`, `src/systems/gate/gateScore.js` - site, omen, spoils, music
- `src/world/gate/gateArena.js`, `src/world/gate/gateModel.js`, `src/world/gate/gateBoss.js`, `src/world/gate/gateSpew.js` - court, gate, Warden, spew
- `src/scenes/gate/gateCourt.js`, `src/scenes/gate/gateLanes.js`, `src/scenes/gate/gateHost.js` - the court on the page, the lanes, his host
- `server/src/index.js` - the court's Room methods and the seat book
- `test/world/gate/wb2_gate.test.js`, `test/systems/gate/wb10a_gate_score.test.js` - the gate in the world, the score
- `test/net/gate/gatecourts.test.js`, `test/net/gate/courtwatch.test.js` - courts and watchers
- `test/net/gate/wb11_gate_host.test.js`, `test/net/gate/wb12d_rite_law.test.js` - his host, the rite
- `test/net/gate/auditwb_relay.test.js`, `test/net/gate/auditwb_spoils.test.js` - the relay's fight, the spoils

## Open

- More than 256 fighters in one fight (copies holding fighters of their own) is not built; see `Scale-Arc.md`.
- A modified client can refuse the Warden's blows on its own body; the damage bucket bounds what it can deal.
- The sea serpent follows the same law at sea: `Sea-Serpent.md`.
