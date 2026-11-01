# Elite Gates

The Elite Breach: the Oblivion Gate's Elite tier, a procedural, endless run for a company of up to eight through the
torn halls of the Fractured Battlespire, with one life each. A Weir Key opens an arch at the opener's feet; the company
answers the call and fights, climbs and solves its way down hall after hall, five to a circle, each circle ending in a
Court whose lord's fall takes a Redoubt. Online only. How it looks is `Elite-Gates-Look.md`; how halls climb is
`Elite-Gates-Ascent.md`.

## How it works

**The tiers** (`src/systems/gateTier.js`). The gate has the dungeons' three tiers: Regular (Dagon's Breach, the world
boss in `World-Bosses.md`), Elite (this page) and Abyss (`'super'`, reserved and not built).

**The Weir Key** (`src/systems/eliteGates/weirKey.js` `WEIR_KEY_ROW`, template 575). The balance is the account's
(`players.eg_keys`); the item in the pack is its face, restacked to the service's count on every answer. It is bound,
pack-only, weightless, never traded and never lost to a death; every character on the account shares it. The service
rolls every key (`server-account/src/eg.js`):

- a recorded gate kill at `EG_KEY_ODDS` (`EG_KEY_ODDS_RITE` for one who broke the rite, `EG_KEY_ODDS_PORTENT` on a
  portent night), with a pity count of `EG_KEY_PITY`;
- the Abyss Dungeon's Remnant at `EG_KEY_ODDS_SD`; a fallen Valkynaz at `EG_VALK_KEY_ODDS`
  (`src/net/eliteGates/egPay.js`);
- a dungeon elite's find by tier (`EG_FIND_ODDS`), capped at `EG_FIND_PER_DAY` asks a tier a day and
  `EG_FIND_KEYS_PER_WEEK` keys a week.

A day's Rehearsal opens a breach with no key.

**The breach** (`src/net/eliteGates/egLaw.js`). `/v1/eg/open` stakes a key and signs an open order. The hub freezes the
company from the opener's party (at most `EG_PARTY_MAX`) and opens the room `eg:<breach>`. The arch is sealed
`EG_SEALED_MS` (one game hour, five real minutes), then open at most `EG_ADMIT_MAX_MS`; each member is admitted by its own
order (`/v1/eg/admit`) and answers the call from anywhere outdoors. Only the opener spends a key.

- **The count** starts at `EG_COUNT_START_MS` (30 real minutes) when the first hall wakes, gains `EG_REDOUBT_HOLD_MS`
  at each Redoubt, never more than `EG_COUNT_CAP_MS` in hand, runs while the company plays and holds between halls.
- **The last word** ends every breach `EG_LAST_WORD_MS` (three real hours) after the opening.
- **Starting deeper** (`src/net/eliteGates/egStartLaw.js`): Hall 1 always; any Redoubt the account took this season; or
  half its all-time best until it takes one. A member who cannot make a start is refused there.
- **The Wager**: up to `EG_WAGER_MAX` decrees from three families for the whole breach; a wagered breach ranks on the
  Depths alone.

**A hall** runs arrival, gather (`EG_GATHER_MS`), the trial, the door, the closing (`EG_CLOSING_FIGHT_MS` or
`EG_CLOSING_SPAN_MS`), the pull and the swap. Each hall is generated from the breach's seed as a made level.

**The bands** (`EG_BANDS`): the Broken Galleries (halls 1-25), the Soul Cairn, the Shade Perilous and the Havoc Wellhead,
which never ends and deepens by strata. Brink halls (`EG_BRINK_HALLS`) carry the company from band to band.

**The halls** (`EG_HALL_KINDS`). Each circle runs a fixed rhythm: fight, traverse, mixed, fight, Court.

| Kind | What |
|---|---|
| Rift-Yard | relentless waves; variants unlock by band (`EG_VARIANTS`) |
| Span | generated platforming (`src/net/eliteGates/egSpanLaw.js`) through fragments |
| Rampart | a walkway under fire; five variants |
| Athenaeum | a seeded Orrery under pressure |
| Proving Walk | span, a champion of the Kyn (`EG_CHAMPIONS`), span |
| Deepway | a hall of fragments |
| Court | a lord; its fall takes a Redoubt |
| Brink | crossing into the next band |

Twists (`EG_TWISTS`) turn about one trial hall in four from circle 2: a Reliquary Vault, Dagon's Bargain, a Kynval Squad,
the Scriptorium, a Battlemage's Ghost, the Deserter, the Kyn Mimic, the Captive Battlemage, the Sutler.

**Fragments** (`src/net/eliteGates/egFragLaw.js`, `src/net/eliteGates/egHeroFrags.js`). Modelled areas a course passes
through: the Oblivion Caverns and their kin, each band's set-piece passages, engines to turn on the legion, alcoves and
false walls. From circle `EG_FORK_FROM_C` a span forks into the High Road over the void and the Low Road through the
caverns beneath.

**The legion** (`src/net/eliteGates/egLegion.js`). Nine kinds of add the relay runs in one wave runner, each read by its
silhouette.

**The lords** (`EG_LORDS`, `src/net/eliteGates/egLords.js`). Nine Court lords - three in the Galleries, two in each band
below (`EG_BAND_LORDS`) - each with three phases and a signature, and four Valkynaz (`EG_VALKYNAZ`), one a band on its own
ground, holding every fifth Court. Each is its own brain on one relay boss seam, and every errand scales from one member
to eight. A lord's fall is the gate's (`src/scenes/eliteGates/egLordFall.js`).

**Decrees** (`EG_DECREES`). Dagon's rules on the next circle, in five families (`EG_DECREE_FAMILIES`), chosen by the
company's word from the ones the beacon offers, at most `EG_DECREES_MAX`. A weekly Proclamation (`EG_PROCLAMATIONS`)
changes no seed.

**Vestiges** (`src/net/eliteGates/egVestige.js`). Run-only powers in five families: three offered at every Redoubt, one
taken; Masteries that change what a member does; Accords between two members' choices; capstones. Capped, never stacking
eightfold (`EG_BUCKET_X_MAX`, `EG_DR_MAX`). Vestige shards (`EG_SHARDS_PER`) buy a rank and a second pick.

**One life, Redoubts and Reliquaries.** One life a member. A fall is recalled once a breach: at the next Redoubt the
living take, or sooner when a living member carries the fallen's Memento to a Battlemage's niche. A second fall is final.
The fallen watch as witnesses with their own camera, pings and a vote. At a Redoubt each earner - by share of the
circle's damage or by activity in three of its five halls (`egActiveIn`) - gets an `e1` receipt
(`src/net/eliteGates/egReceipt.js`). A sealed Reliquary waits for each earner whose Redoubt pays this week, opened only
by pressing the way home. The rest holds the count (`EG_REST_MS`).

**Every hall pays.** A cache on every trial's end plate: a Vestige shard, a Spire Tonic, a Cantrip (up to three held:
Sight, Stillness, Mending, Severance, Long Step) or lumen for the Sutler.

**The potion clock** (`src/combat/pvpPotions.js`, registered by `src/systems/eliteGates/spireKit.js`). Every potion is
drunk, but each kind (health, magicka, other) waits `PVP_POTION_MS` (15 s) after the last of its kind. A bottle lands
whole, so it counts as every kind its effects are (`potionKindsOf`). A refused bottle is kept and the pip says the wait.
A Spire Tonic stands outside the clock. A health bottle is told to the room (`pot`), which believes at most a Heal
True's heal at the member's level once in its own 15 s (`src/net/eliteGates/egBrain.js` `egPotion`).

**The kit's might** (`src/net/kitMight.js` `kitMightOf`, `src/net/mightLaw.js`). The account service's judge reads what
the lawful kit worn at once can add to one blow or one spell, in whole per cent from 100 to `MIGHT_MOST` (1000), and the
mint signs it (`mg`). The relay grows a member's purse (depth, rate and one-blow cap) by `mg / 100` beside the Vestiges'
factor, and the member's share of every body's health by the might's square root (`src/net/eliteGates/egMight.js`
`EG_MIGHT_HEALTH_EXP`). A geared company lands its real numbers and kills faster. Receipts judge damage at the
reference (`egRefDealt`), so a bare member of a geared company earns the same. A character with no signed might lands
as one of none.

**Depth.** Depth adds decrees, kinds, pieces, waves and strata; it never shortens a wind-up, a piece's timing or a
crumble. The wall is the count and the last word, not a multiplier; a Court in progress may finish.

**Rewards** (`server-account/src/egEconomy.js`, `src/systems/eliteGates/egSpoils.js`). Each Redoubt pays once a week:
spoils (`EG_SPOILS_GOLD_PER_LEVEL` gold a level) and `EG_PAY_MARKS` Marks; Deadlands Embers at the Valkynaz Redoubts and
for new depth. The Battlemage's Panoply - nine Aetheric pieces (`EG_PANOPLY_KEYS`) - with a pity count
(`EG_PANOPLY_PITY`) and the Broker's weekly sale for `EG_SINK_EMBERS` embers. Each lord has a named Legendary
(`src/systems/eliteGates/egLordArms.js`), a tavern card and three feats. Titles and auras by depth
(`server-account/src/egHonours.js`): Spirewalker, Beacon-Lighter, Kynbane (with its aura), Battlemage, Wellhead-Walker
(with its aura), The Unfallen, The Lone Beacon, each band's Master, Spire Champion, and First of the Spire with its
aura. No Gilded piece.

**The boards** (`/v1/eg/board`, the arena's eight-week season). The Descent - the deepest hall cleared in one unwagered
breach begun at Hall 1, in three brackets (Alone, the Few, the Company); the Depths - the deepest hall from any start;
and the Deepest Redoubts, all time. Each bracket's top `EG_CHAMPIONS_TOP` hold Spire Champion through the next season.
The herald (`src/net/eliteGates/egHerald.js`) posts firsts.

**Integrity.** Every blow on a lord or the legion goes through the gate's hand and purse, by the level claim times the
Vestiges' capped factor and the kit's signed might, from a pose on the current fight floor; the striker's screen shows
what the room says landed. The lords' blows are judged on members' poses (`src/net/bossRef.js`). A span crossing is
proven by its route (`src/net/eliteGates/egRouteProof.js`); the relay believes no member faster than the fastest
build runs. The room is durable across restarts (`src/net/eliteGates/egDurable.js`).

**The made level's rules** (`src/systems/madeLevel.js`, row `spire`). No save, rest, automap, Mark, Recall, Portal Stone or
companions; regeneration held; potions timed (`potions: 'timed'`); no Levitate or Slowfall, and their bottles are
refused too.

**Readable by everyone.** Five lights with five meanings: gold the way and safety, Dagon red his blows (every Spire
telegraph line is `TELEGRAPH_EDGE_DAGON`), Battlemage blue yours, white the place's timed hazard, and the band's own
light where you are. Shapes never rely on hue, a danger palette serves colour-blind players, a telegraph budget drops
nothing aimed at you, and every event has sight, sound and words. A recap ends every run. The score and the hall's sound
are `src/systems/eliteGates/egScore.js` and `src/scenes/eliteGates/egAir.js`.

## Rules

- Timed like the Oblivion Gate but a step above; a party of 8; checkpoints; a key from regular gates and a super-rare
  dungeon drop by tier (Mac).
- Five laws keep every blow fair: the wind-up floor, the union floor, the errand floor (every errand works for one to
  eight), the CHECK class of whole-court blows, and the width rule (every aimed blow wide enough for the relay to see).
- Nothing gets faster with depth (Mac).
- Run-only powers: yes, capped; death saves recover only at a Redoubt (Mac left it to the record).
- Every hall pays something; none of it outlives the breach.
- Potions are allowed, each kind on its own cooldown (the owner).
- Gear counts: a member's purse grows with its kit (the owner).
- The chance, not the promise: rewards pay once a week a Redoubt.
- Lords and champions are Daggerfall sprites drawn oversized, never models (Mac).
- Lore: the Battlespire's fall in 3E 398 is canon; the torn halls the Kyn hold as a proving ground are the port's own.

## Daggerfall Unity

Daggerfall has no Elite Breach, no torn halls and no other players; none of this is a DFU member (Ledger A,
ELITE-GATES). The departures inside: Resurrect refused, Levitate and Slowfall banned, a technique's flight refused on
traversal ground, Stendarr's AvoidDeath refused, a 15-second clock on each kind of potion, a jump buffer and a late
press, and no death penalty inside.

## Code and tests

- `src/net/eliteGates/` - the law (`egLaw.js`), brain, legion, lords, bodies, spans, fragments, vestiges, route proofs,
  receipts, durability, herald
- `src/systems/eliteGates/` - the Weir Key, spoils, lords' arms, kit, Orrery, vestiges on the client, score
- `src/scenes/eliteGates/` - the client, call, arch, circle host, fight, span, swap, look
- `src/world/eliteGates/` - halls, ruin, wreck, platforms, hero fragments
- `server-account/src/eg.js`, `egEconomy.js`, `egHonours.js`, `egStarts.js` - keys, opens, claims, pay, honours, boards
- `test/net/eliteGates/` - the law, relay, client, service, economy and every audit's pins
- `tools/egSpanSolve.mjs` - the span solver the deploy's sweep runs
