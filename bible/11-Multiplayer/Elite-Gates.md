# Elite Gates - the Elite Breach and the Battlespire's torn halls (EG)

> Design page, written 2026-10-11 before the arc's first slice. The same day it was revised by AUDIT EG0 (five cold
> lanes on the first draft, 177a3acd6, 105 findings, then a sixth lane on the revision, 28 more:
> `01-Overview/audits/Audit-EG0.md`), widened by EG0b (the fragments), and polished by AUDIT EG II (six cold lanes on
> 14b3b172f, 282 findings: `01-Overview/audits/Audit-EG-II.md`). The code's comments will cite this page by section number;
> where the page and a pin disagree, the pin is what runs. Each slice adds its record under section 31. A path that
> exists today is written from the repository root (`src/net/gate/gateBrain.js`); a path this arc will create is written
> without `src/` (`net/egLaw.js`).

## What Mac asked for

Mac, 2026-10-11: *"I want to talk about expanding the oblivion gates idea into a procedural endless experience, where
you fight bosses, relentless adds, traverse platforming sections and see how far you can delve with one life on the
line. This would be of elite tier, but like how dungeons recieve 3 tiers. Normal, Elite, and Abyss"*. Then, asked five
questions (the tier reading, the party size, what a death costs, run-only powers, how a run is entered):

1. *"Its basically timed like oblivion gates, but its considered a step above as an elite gate, more challenging and a
   different experience"*
2. *"Party of 8"*
3. *"Checkpoints"*
4. *"Your decision"*
5. *"Yes, a key item you can obtain from regular oblivion gates, a super rare drop from dungeons based on dungeon tier"*

And: *"I want you to make any and all decisions and make this the best content that it can be. Utilize all available
resources, be extremely detailed and dont half ass the work"*. Of the first draft: *"Do a comprehensive audit and
ensure this is the best and most detailed it can be"*. Of the spans: *"I really want to enhance the experience where
sometimes platforms can lead to oblivion caverns, or different types of modeled areas instead of simple platforms"*. Of
the whole: *"Im really looking for AAA grace quality when it comes to everything implemented. Do a detailed polish pass
and audit"*.

So, as decided here (each decision is argued in its section):

- **The gate gets the dungeons' three tiers.** Dagon's Breach (`World-Bosses.md`) is the gate's Regular tier. This arc
  builds the **Elite Breach**, the tier above it. The Abyss tier is named and reserved (section 2).
- **Where it leads.** Canon: the Battlespire was taken by Dagon's legions in 3E 398, then partly destroyed, and the
  Empire sealed its gates with every link to Oblivion broken. **The port's invention**, marked as such: the halls that
  tore away when those links broke fell back along the road the legions came, and the Kyn still hold them as a proving
  ground (section 3).
- **The key: the Weir Key.** In canon, the Imperial Secretary surrendered the Spire's portal keys to the invaders. The
  Kyn carry them still; Dagon's covens hoard them.
  - It is ACCOUNT-HELD: the account service keeps the balance, and the item is its face.
  - The service rolls every drop: from Dagon's Breach (with a pity count), from the Abyss Dungeon's Remnant, from a
    fallen Valkynaz, and very rarely from elite foes in dungeons, by tier (section 5).
- **Timed like a gate.** The arch rises at the opener's feet, sealed for one game hour, then opens for one game hour
  at most. The company answers THE CALL from anywhere outdoors.
  - **The count** starts when the first hall wakes: 30 minutes, +15 for each Redoubt taken, never more than 30 in
    hand. It runs while the company plays and holds while it travels between halls.
  - **The last word** ends every breach three hours after the opening (section 6).
- **A company of eight.** The opener's party when the open reaches the hub, frozen, up to `PARTY_MAX` (8). Only the
  opener spends a key (section 6).
- **Endless, procedural, one hall at a time.**
  - A run is halls, five to a circle. Each circle ends in a **Court**, whose fall takes a **Redoubt**.
  - Each hall is generated from the breach's seed: a made level like the Burning Court and the Shattered Hour.
  - Halls follow a fixed rhythm: fight, traverse, mixed, fight, Court (sections 7-9).
- **Six kinds of hall and a Court** (section 8), the Rift-Yard and the Rampart each in five variants: the Rift-Yard
  (relentless waves), the Span (generated platforming), the Rampart (a walkway under fire), the Athenaeum (a seeded
  Orrery under pressure), the Proving Walk (span, champion, span) and the Deepway (a hall of fragments). Twists turn
  about one hall in four from circle 2, and three Brink halls carry the company from band to band.
- **Fragments** (section 11): modelled areas a course passes through. Oblivion Caverns and nine kin stand across the
  bands as passages, chambers and shafts, each with a hazard of its own; a set-piece passage a band; every platform a
  modelled object; a fork at every span from circle 2 (the High Road over the void, the Low Road through the caverns
  beneath); engines to turn on the legion; and secrets behind false walls.
- **Four bands deep**, retracing the legions' march of 3E 398 in reverse: the Broken Galleries, the Soul Cairn, the
  Shade Perilous, and the Havoc Wellhead, which never ends and deepens by strata (sections 7, 18).
- **Relentless adds the relay runs.** Nine kinds, three of them the gate's own (the Harriers, Sappers and
  Ward-Bearers of its Legion-Lord trial, `World-Bosses.md` section 17), in one wave runner widened from the gate's,
  each kind read by its silhouette (section 12).
- **Thirteen lords and the champions.**
  - Nine Court lords: three in the Galleries, two in each band below, each with three phases and a signature.
  - Four Valkynaz, warrior dukes of Dagon's council, each on its band's own ground with its own kit, holding every
    fifth Court.
  - Three Proving champions, one per Kyn rank, each with its own signature.
  - Every one is its own brain on ONE relay boss seam, and every errand scales from one member to eight (section 13).
- **Five laws keep every blow fair** (sections 11.7, 13.2): the wind-up floor (a shape you can always run out of); the
  union floor (never a trap of several shapes at once, judged in time); the errand floor (every errand works for one to
  eight); the CHECK class (whole-court blows with fixed wind-ups and damage); and THE WIDTH RULE (every aimed blow is
  wide enough for the relay to see).
- **NOTHING GETS FASTER** (Mac, WBX: *"I dont think making mechanics faster is the play"*). Depth adds decrees, kinds,
  pieces, waves and strata. It never shortens a wind-up, a piece's timing or a crumble (sections 13, 18).
- **Decrees** lay Dagon's rules on the next circle, chosen by the company's word from the ones the beacon offers
  (section 14).
- **Vestiges** are run-only powers: three offered at every Redoubt, one taken, Mastery Vestiges that change what a
  member does, and Accords between two members' choices. This page's decision on question 4 (Mac: *"Your decision"*):
  yes. They are capped, never stack eightfold, and death saves recover only at a Redoubt (section 15).
- **Redoubts and the one life**, read through Mac's answer to *what a death costs*: *"Checkpoints"* (section 16).
  - One life a member. A fall is recalled ONCE a breach: at the next Redoubt the living take, or sooner, when a living
    member carries the fallen's Memento to a Battlemage's niche. A second fall is final.
  - The fallen watch as witnesses, with their own camera, pings and a vote.
- **Reliquaries**, sealed at every Redoubt that pays this week and opened only by walking home, are what a company risks
  by going on (section 16).
- **Every hall pays something.** A cache on every trial's end plate, Cantrips to hold, lumen to spend at the Sutler, and
  a limit of two potions a hall that makes the one life matter (section 17).
- **The wall is the count and the last word, not a multiplier.** A model of the pace says where companies stop, and THE
  COVENANT'S PATIENCE lets a Court in progress finish (section 18).
- **The chance, not the promise** (section 19):
  - Spoils and Marks at every Redoubt, paid once a week for each Redoubt; Deadlands Embers at the Valkynaz Redoubts
    and for new depth.
  - THE BATTLEMAGE'S PANOPLY (nine Aetheric pieces, with a pity count and a weekly sale).
  - Each lord's named Legendary, its tavern card, and three feats.
  - Titles and auras by depth. No Gilded piece: the Hourlock stays the one.
- **Two season boards and an all-time one** (section 20), with a weekly Proclamation that changes no seed.
- **Readable by everyone** (sections 25-27): one danger colour that no hall's light shares; shapes that never rely on
  hue; a danger palette for colour-blind players; a telegraph budget that drops nothing aimed at you; sight, sound
  and words for every event; a recap at every run's end.

Daggerfall has no Elite Breach, no torn halls and no other players, so none of this is a DFU member. Its Ledger A row,
ELITE-GATES, is opened by the first file that cites it, and every later file that cites it is added to the row by name
in the same change: `test/tooling/doctrine.test.js` fails a file citing Ledger A that no row names (SD2a's record). The row
lists the Spire's departures from DFU: Resurrect refused, Levitate and Slowfall banned, a technique's flight refused on
traversal ground, Stendarr's AvoidDeath refused, a limit of two potions a hall, a jump buffer and a late press, and no
DEATH-PENALTY inside.

## 1. The shape, end to end

```
 a WEIR KEY (account-held) ─► used outdoors, online ─► /v1/eg/open: one staked, an OPEN ORDER signed
   │
   ▼
 the HUB: verifies the order ─► freezes the COMPANY from its party record (≤ 8) ─► EG_INTERNAL_OPEN to eg:<b>
   │ the ARCH rises at the opener's feet: sealed 1 game hour (5 real min)
   │ OPEN ≤ 1 game hour: the opener steps through the arch; the company answers THE CALL from anywhere outdoors
   │ each member: /v1/eg/admit ─► an ADMIT ORDER ─► the room spends it ─► the first hall is built behind the veil
   ▼
 the first hall WAKES (the count starts) ─► the arch sinks behind the company
   │
   │  each hall: ARRIVAL ─► GATHER 8 s ─► the TRIAL ─► the DOOR ─► the CLOSING (20-45 s) ─► the PULL ─► the SWAP
   │  the rhythm:  fight · traverse (a Span through fragments, or the Deepway) · mixed · fight · the COURT
   │
 the COURT's lord falls ─► a REDOUBT taken
   │  ├─ an e1 RECEIPT to every living EARNER: the depth, the week's spoils, Marks, embers for new depth
   │  ├─ a sealed RELIQUARY to each earner whose Redoubt pays this week
   │  ├─ the COUNT +15 min (30 in hand at most); the REST holds the count
   │  ├─ three VESTIGES offered, one taken; the next circle's DECREES chosen
   │  ├─ the FALLEN recalled (once each)
   │  └─ the WAY HOME (pressed, never walked into): leave, keeping all, the Reliquaries opened
   ▼
 ... Hall 25: a VALKYNAZ ─► Hall 26: a BRINK ─► ... the Havoc Wellhead and its strata, without end
   │
   ▼
 the END: every member out (fallen twice, forsaken, gone home), a WIPE, the COUNT spent (the tear),
          THE SEAL, the LAST WORD or a VOID ─► each entrant's end receipt and the RECAP ─► the room keeps its tombstone
```

## 2. The tiers of the gate - Regular, Elite, Abyss

The dungeons have three tiers and one law that names them: `dungeonTier` in `src/systems/dungeon/dungeonTier.js`, with the
words *Regular Dungeon*, *Elite Dungeon* and *Abyss Dungeon* (ABYSS-NAME). Mac said *"Normal"*; the player reads
*Regular*, the word the game already shows (`DUNGEON_TIER_TEXT`). The gate gets the same shape: one leaf law,
`systems/gateTier.js` (EG1), with `gateTier(x)`:

| tier | code | the event | what it is | built |
|---|---|---|---|---|
| Regular | `'regular'` | **Dagon's Breach** | the world boss on the shared clock: one a game day, everyone, the Warden | shipped (WB) |
| Elite | `'elite'` | **Elite Breach** | a key's breach for one company: the torn halls, endless, one life and its one recall | this arc |
| Abyss | `'super'` | **Abyss Breach** | reserved; the code keeps `super` for the Abyss tier, as the dungeons do | NOT this arc |

`GATE_TIER_TEXT` holds the words. The Regular tier's word is its own name, because the event already has one. Shown:

- **the arch's plaque** (World Tooltips): *Elite Breach*, sub *The Battlespire*; to anyone outside the company, a
  second sub *<opener>'s company*;
- **the sight line**: *You see an Elite Breach 140 metres to the North!* (the Elite Dungeon's line, its law);
- **the Timers row** (`eventTimerRows` in `src/systems/eventTimers.js`, a new kind `'elite'` beside `'gate'` and
  `'super'`, the company's alone): *Elite Breach opens 4:12*, then *Hall 17 - 24:10 left*;
- **the held map**: the arch's mark for the company while it stands (it is not a place in MAPS.BSA);
- **on entering a hall**: the arrival card (section 27.3).

**Why the Abyss tier is not built here.** The Abyss Dungeon's Rift is already the otherworldly door at the top of the
content: one Hollow at a time, for the whole world. An Abyss Breach would be the pinnacle of the gate's own ladder, a
world-scale event and not a company's. It is named so it is not mistaken for missing. The tier law answers `'super'`
for nothing until it is built.

## 3. The lore - canon, and what the port adds

The gate's own lore law (`World-Bosses.md` section 19) is binding. The Covenant of Akatosh bars every Prince from
forcing a door into Tamriel; it never barred a door opened from within, and it fights every breach. The port's shipped
book on the breaches (`src/systems/portBooks.js`) is canon for this game. Three of its lines bind this page:

- *"No Prince walks through such a wound himself. He sends a lord of his house... a Dremora of the rank they call
  valkynaz."*
- *"Should the Warden fall... the breach fails at once. It is his will that holds the door."*
- Of the Battlespire: *"his legions took the Battlespire itself... and held it until a single apprentice drove them
  out."*

**Canon** (UESP: Lore:Battlespire, Lore:Weir Gate, Lore:Kyn, Lore:Soul Cairn, Lore:Shade Perilous, Lore:Havoc Wellhead,
Lore:Imago Storm):

- The Battlespire was the war academy of the Imperial Battlemages and a testing ground for the Imperial Guard: a
  void-castle in a slipstream realm, with a council whose masters bore titles such as Armsmaster and Spellmaster.
- The Impostor, Jagar Tharn, gave it to Mehrunes Dagon. In 3E 398 Dagon's legions, led by Imago Storm of Clan Dremora,
  mustered in the **Havoc Wellhead** (whose arena hosted honourable fights between clans), rampaged through the
  **Shade Perilous** (a pocket realm of Nocturnal's Evergloam) and the **Soul Cairn** (the Ideal Masters' realm of
  the dead), and took the Spire, killing nearly every Battlemage.
- The Imperial Secretary surrendered the Spire's **portal keys**, and the invaders sealed its **Weir Gate** against
  the Legion with Dagon's own sigil.
- An apprentice drove them out. The Spire was partly destroyed; the Empire reclaimed the ruins and sealed its gates,
  every link to Oblivion broken. Imago Storm later turned on his Prince.
- The Dremora, the Kyn, keep eight major ranks: Varlet, Churl, Caitiff, Kynval, Kynreeve (a clan's officer or
  sheriff), Kynmarcher (the officer of a citadel or outpost, the lowest called lord), Markynaz (a grand duke) and
  Valkynaz (a warrior duke of his Prince's council). Valkynaz Ruhn, the Warden, is one.
- Dagon gave the Dark Seducers (Daggerfall's Daedra Seducer) their bat wings. The Fire and Frost Daedra are clans of
  their own, and rivals.

**The port's invention** (said so, everywhere it is said):

- **The torn halls.** When the Spire's links to Oblivion broke, the halls that hung on them tore away. They fell back
  along the road the legions came: the Soul Cairn, then the Shade Perilous, then the Havoc Wellhead itself. The
  Imperial ruin stays sealed. The Elite Breach goes to what tore away, and to descend it is to walk the invasion of
  3E 398 backwards (the bands, section 7). They did not fall as stepping stones: whole caverns of the Deadlands,
  collapsed wings of the academy and the vaults of the dead came with them, and a course passes through them (the
  fragments, section 11).
- **The Kyn hold them as a proving ground**, as the Wellhead's own arena was one. The Spire was a proving ground for
  the Battlemages too. A Dremora rises in rank by holding a Court there, so the deeper halls are held by higher ranks:
  Kynreeves, then Kynmarchers, then Markynaz, and a Valkynaz at every fifth Court. These are the Kyn who stayed
  Dagon's when Imago Storm did not.
- **The Weir Keys.** The portal keys the Secretary surrendered still open the Weir Gate's road from this side. That
  road no longer reaches the sealed Spire; it reaches its torn halls. The Kyn carry the keys as trophies: Ruhn wears
  one, which is why his fall can drop one, and so does every Valkynaz of the halls. Dagon's covens hoard others in the
  deep places, which is why the hardest dungeons give them up likeliest.
- **The door is the key's, not a lord's.** Dagon's Breach is held by the Warden's will, and fails when he falls. The
  Elite door is held by the key and by the Battlemages' old Redoubts, so felling a lord does not close it. Each Redoubt
  taken makes the door more the Battlemages' own, and the Covenant presses on it less: the count gains time. In the
  first circle no Redoubt is taken yet, and the count's thirty minutes are the key's own strength. When the count is
  spent, the Covenant tears the door shut, though a lit Court's fight holds it a while (THE COVENANT'S PATIENCE,
  section 18). The last word is the most any key can hold against it.
- **The Vestiges** are what the Battlemages left in their Redoubts: a lesson that clings to whoever takes one, until
  the breach closes.
- **The raised masters.** Two of the Spire's council, killed in 3E 398, were raised as undead by the Kyn and bound to
  their Courts: the Last Spellmaster and the Last Armsmaster.
- **The Annals of 3E 398** (section 11.10): thirty pages the Battlemages left in the torn halls, found behind their
  false walls. Each is the port's own, two sentences long, and never contradicts the canon above.

## 4. The words

The words most likely to be misread: what each means on this page and in the game, and what it is NOT. AUDIT EG0's
word lane and AUDIT EG II's checked every new word against `src/` and the player's existing vocabulary.

| word | means | is not | why this word |
|---|---|---|---|
| **Elite Breach** | the event: a key's breach | "Oblivion Gate" (retired by WB12) | the gate tier's word |
| **Elite Gates** | this arc's name only; never player text | the event | - |
| **the gate** | Dagon's Breach and its systems (`World-Bosses.md`): its model, court, trials and brain | the Elite Breach's arch | WB12 |
| **the arch** | the Elite Breach's door at the opener's feet: the gate's model at 0.62 scale, white marble and gold | the gate | - |
| **the Battlespire**, **the Spire** | where the torn halls came from | the sealed Imperial ruin | canon place, invented fate |
| **the Burning Court** | Dagon's Breach's made level and its rules (`src/systems/courtRules.js`) | an Elite Court | - |
| **Weir Key** | the key item, template 575, account-held | a sigil stone (retired by WB12) | canon's portal keys and the Weir Gate |
| **the balance** | how many Weir Keys an account holds | - | - |
| **a stake** | a key held against a breach until it settles | - | CARDS6's stake orders |
| **the company** | the opener's party, frozen at the hub when the open is accepted (section 6.1) | the party later | - |
| **the opener** | the member who used the key | - | - |
| **the open**, **the opening**, **the open window** | the open request; the moment the room accepts it (the arch begins to rise); the hour after the rise in which members may enter | the phase name `'open'` | - |
| **hall**; **Hall 12** | one level of the run; numbered when named | a guild hall | lowercase in prose |
| **circle** | five halls, the fifth a Court | - | - |
| **slot** | a circle's place 1-5 in the rhythm | a hall's stage | - |
| **stage** | a hall's part: arrival, gather, trial, door, closing, pull | a slot; a lord's phase | - |
| **trial** | a hall's challenge, from its wake to its door | the gate's trials (its boss modifiers) | - |
| **the wake** | the moment a hall's trial begins | a relay re-woken | - |
| **the closing** | the window after a hall's door opens, before the pull | a lord's fall | replaces "the descent" (AUDIT EG II L5-7) |
| **the pull** | the closing's end: everyone left is pulled down, at the toll's cost | - | - |
| **the swap** | the hall-to-hall transition behind the veil | a dungeon transition | section 7 |
| **Court** | a circle's fifth hall, where its lord stands; capitalised | a court disc (lowercase); the Burning Court | the gate's own word |
| **court disc** | a round fight floor | a Court | - |
| **lord** | a Court's boss | "Kyn" (only Dremora are Kyn) | AUDIT EG0 L5 |
| **champion** | the Proving Walk's foe, one per Kyn rank | the title *Spire Champion* | - |
| **Kynval elite** | one of a Kynval Squad's four | a champion | - |
| **Redoubt**; **Redoubt 5** | the checkpoint a Court's fall takes; its beacon is lit | a Ward-Bearer's ward | "redoubt" is unused |
| **R** | in a formula, a Redoubt's number | the blow kind `r`; a radius (`r 14`) | - |
| **the count** | the breach's timer | the key balance; the relay's census | - |
| **the census** | `BOSS_BODY`'s body count (`src/net/bossBody.js`) | the count | - |
| **the last word** | the three-hour bound on any breach | - | - |
| **the tear** | the count spent: the Covenant shuts the breach | a fall | - |
| **a fall**; **a final fall** | a member's death or 180 s absence in a trial; the second, or any with no recall left | a cast-back | - |
| **a wipe** | no living member: the breach ends | - | - |
| **a cast-back** | the void returning a member to their last island or plate, at a cost | a fall | - |
| **an island** | a span's rest point between sections; a cast-back returns there | a Redoubt | "checkpoint" is the Redoubt's |
| **the recall** | a fallen member's one return a breach | Recall the spell | - |
| **Memento** | the gold mote a fall leaves, carried to a niche (section 16) | - | - |
| **witness** | a fallen member who watches the run | - | - |
| **forsake** | a witness leaving for good | the way home | - |
| **bequest** | a fallen member's Vestige offered to the living | - | - |
| **the way home** | the Redoubt's pressed arch: leave, keeping all, the Reliquaries opened | the tear | - |
| **earner** | a member whose part in a circle earns its receipt (section 16.1) | an entrant | - |
| **entrant** | anyone admitted to the breach | - | - |
| **landing** | where a member answered the call; a fall or the end lands them there | the arrival plate; by context also a blow's landing (when it lands) and the Drop's landing (its floor) | - |
| **the rest**; **a respite** | a Redoubt's 90 s pause; a longer pause, spent from the respite budget | the others | - |
| **Surplus** | five minutes the count's cap turned away, spent at a Redoubt | - | - |
| **decree** | a rule laid on the next circle (the code's *marks*) | a Sigil Set (Dagon's Brand); Marks the currency | "brand" collided three ways |
| **tide**; **stratum** | the Wellhead's per-circle rule past circle 20; a rule that joins for good at Redoubt 20 and every fifth after | a decree | - |
| **Proclamation** | the week's one rule, from circle 1 | a seed | - |
| **Vestige** | a run-only power | a Vestige aura; a cosmetic aura | - |
| **Mastery Vestige**; **Accord** | a Vestige that changes what its holder does; a bonus two members' Vestiges grant together | - | - |
| **Stone, Blade, Hunt, Arcana, Fellowship** | the Vestige families | the Sigil Sets' Bulwark, Brand, Shroud, Mantle | - |
| **Reliquary** | a sealed spoils roll, opened only by the way home | - | - |
| **cache** | a trial's end-plate reward | a Reliquary | - |
| **Cantrip**; **lumen**; **the Sutler** | a run-only consumable; the run's currency; the Kyn quartermaster who sells for it | - | - |
| **the Span**; **a span** | the traverse hall kind; any platform course (a Span's, a Proving Walk's, a side span) | - | - |
| **piece** | one kind of span platform or hazard (section 10.3) | a Panoply piece | - |
| **the Drop** | the piece that drops to a walled landing | the closing | renamed from "Descent" (AUDIT EG II L5-7) |
| **fragment** | a modelled area a course passes through: a **passage**, a **chamber** or a **shaft** (section 11) | a shader's fragment (the code says `egFrag`) | the halls fell in fragments |
| **fight floor** | a flat floor where blows may land | traversal ground | - |
| **traversal ground** | platforms, stairs, ledges and passages' walkways: never aimed at | - | - |
| **the High Road**, **the Low Road** | a span's fork: over the void, or through the caverns beneath | - | - |
| **the Deepway** | a hall built of fragments end to end | - | - |
| **engine** | a hall's interactable that turns on the legion | the Bound Colossus | - |
| **errand** | a lord's coordination mechanic (runes, gems, seals) | - | - |
| **CHECK** | a blow with fixed wind-up and damage (section 13.2) | - | - |
| **the escape build**; **the span build**; **the fast build** | Speed 40/Running 20; Speed 10/Running 0; the fastest legal (section 10.2) | - | - |
| **fury** | a slow fight's growing pressure (section 13.2) | speed | - |
| **aspect** | a lord's element (`GATE_ASPECTS`) | a decree | - |
| **the legion** | the adds | the Imperial Legion | lowercase |
| **the Legion-Lord** | the gate's ninth trial, whose host the relay runs (`World-Bosses.md` section 17) | a lord | - |
| **ward** | the shield a Ward-Bearer holds on what it guards | a Redoubt | - |
| **Marks** | the guilds' combat currency (`src/net/marksLaw.js`) | decrees (the code's marks) | - |
| **Deadlands Embers** | the Broker's currency | lumen | - |
| **arrow** | a bow's blow kind | a shaft (a fragment class); the HUD's peril arrow | - |

**Imported words**, defined on other pages: the Hour (the Shattered Hour), the Remnant (the Brass Remnant), a Hollow,
the Steps (the Unmoored Steps), all in `Super-Dungeons.md`; the Warden (Valkynaz Ruhn) in `World-Bosses.md`; the
serpent in `Sea-Serpent.md`.

**Capitalisation.** Court, Redoubt, the band names, hall kinds (the Span, the Rampart), fragment names (the Oblivion
Caverns, the Fallen Stacks), piece names (a Drift, a Pendulum), twist names, the Kynval Squad and the Proving champion
are capitalised. Hall, circle, decree, the count, the legion and a proving court are not, except when numbered or named
(*Hall 12*, *Redoubt 5*).

**The shouted rules.** A rule's name is shouted wherever it names the rule: THE WIND-UP FLOOR, THE UNION FLOOR, THE
ERRAND FLOOR, THE CHECK CLASS, THE WIDTH RULE, NOTHING GETS FASTER, THE ENVELOPE, THE TIMED SOLVER, THE FORK, THE GOLD
RUN, THE CALL, THE SWAP, THE TELEGRAPH BUDGET, THE SPIRE DANGER EDGE, THE EDGE LINE, THE SEAL, THE POTION LAW, THE
COVENANT'S PATIENCE, THE QUIET COMPANY, THE FALL, THE RECALL, THE WITNESS VIEW, THE FAIR TRAIL, THE HOLD, THE DRAIN,
THE COUNT CHIP, THE RECAP, THE REHEARSAL, RIDDEN POSES, THE SPIRE MIX, ROLE READS.

## 5. The Weir Key

**The item.** Template **575**, free today (the gate's 570-572 and the Ayleid stones' 573-574 come before it). It is a
row beside `PORTAL_STONE_TEMPLATES` in `src/systems/gate/gateSpoils.js`:

- `{index:575, baseWeight:0.25, hitPoints:1000, basePrice, rarity:20, bound:true, stackable:true}`, in the miscellany
  group (`UselessItems2`), never a gem (PORTAL1's lesson: every Gems piece is a crystal a slot takes);
- its art: a key of black iron and gold, painted in code into the Spire's first pseudo-archive (section 25), which
  EG1's registry holds. EG2 ships it with that art, never a borrowed record, because Port-Doctrine allows no
  placeholder shipped silently;
- named in `BOUND_TEMPLATES` (`src/net/realm/realmTradeLaw.js`), so the realm's trade refuses it as the client does;
- its line: *One of the Spire's portal keys, surrendered to the Kyn in 3E 398. It opens the Weir Gate's road from
  this side.*

**The balance is the account's.** Every dungeon drop is the client's own `Math.random`: the Integrity arc's ledger
(`06-Systems/Integrity-Arc.md`) measures it after the fact and does not enforce. A key from a forged drop would open a
real relay instance, so the key is a service-side balance and the item is its face.

- `players.eg_keys` (migration, EG2) is the balance. The service-side precedent is the Broker's purse: `insigniaPurse`
  over `EMBERS_EARNED_SQL`, which is gate and serpent embers less `insignia_spent` (`server-account/src/accounts.js`).
- **No code today restacks a pack to a service count.** `restackStones` is SS1's load-time fold in the save, and on
  an insignia sale the client simply takes the stones from the pack. EG2 builds the restack: every service answer
  that carries the balance (`/v1/eg/keys`, a claim, an open) sets the Weir Key stack on the account's character to
  the balance, single-flight and coalesced (ASYNC NEVER DROPS).
- A key the service does not count does nothing (*The key turns to rust.*) and the stack is restacked.
- It is bound to the account, never traded, and never lost to a death.

**Where they come from.** The service rolls every one with its own `rand`, at a claim it already verifies. This is
the `sdHonoursRoll` way: AUDIT SD III R4 moved the Hour's honours off the receipt seed because the page can read the
seed. `claimGate`'s context gains `rand`, which it lacks today (`claimSd`'s has it).

| source | when the service rolls | odds | what that means |
|---|---|---|---|
| **Dagon's Breach** | `claimGate`, a recorded kill (`earned != 'rite'`) | **1 in 6** | at one or two gates a real day, a key every three to six days |
| **...having broken the rite** | the same, with `r=1` | **1 in 4** (instead) | the rite is the gate's harder half (WB12d) |
| **...the first ever** | the account's first `gate_kills` row with `earned != 'rite'` | **certain** | every gatebreaker sees the Spire once |
| **...the pity** | after `EG_KEY_PITY` (5) recorded kills in a row without a key, the sixth gives one (`players.eg_key_miss`) | **certain** | nobody goes a week of gates with nothing: (5/6)^12 left 11% with no key in twelve kills |
| **a Valkynaz's Redoubt** | `claimEg`, a `w` receipt for a Valkynaz's Redoubt | **1 in 4**, at most one a week (`EG_VALK_KEYS_PER_WEEK`) | the Kyn wear the keys (section 3): a company deep enough keeps itself in keys |
| **the Abyss Dungeon's Remnant** | `claimSd`, a recorded Hour | **1 in 3** | the hardest fight the port has, witnessed by the relay |
| **an Abyss Dungeon's elite foe** | `/v1/eg/find`, below | **1 in 60** | six elites a Hollow: about one Hollow in ten |
| **an Elite Dungeon's elite foe** | `/v1/eg/find` | **1 in 150** | three or four a dungeon: about one in forty |
| **a Regular Dungeon's elite foe** | `/v1/eg/find` | **1 in 400** | one dungeon in five has one: about one in two thousand |

**The first breach's mercy.** An account's first opened breach that ends before Redoubt 1 is taken returns its stake,
once ever (`players.eg_mercy`). A solo player who falls in Hall 2 has learned the Spire, not lost a week.

**The dungeon's find.** No relay witnesses an ordinary dungeon, so the killer's client asks for the find. When an
elite foe (`eliteFoe`) dies in a dungeon online:

1. **who asks**: the death handler (`registerEnemyDeathHandler`, the seam `dropFoeCard` uses for a foe's card) runs
   on the foe's owner, which names the striking joiner's peer id on the foes stream (`_killedBy`, the record's `v`,
   for `KILLED_BY_MS`). The client whose `selfId` it names asks `/v1/eg/find` with the dungeon's tier, not the
   owner's. When `v` is null the owner struck, and asks itself;
2. **the roll**: the service rolls at that tier's odds;
3. **a yes** adds one to the balance and throws the item from the body, as a card is thrown.

A forged client can lie about a kill and a tier, so:

- asks are capped at **6 a tier, per account, per real day** (`EG_FIND_PER_DAY`). At the cap a forger's ceiling is
  6/400 + 6/150 + 6/60 ≈ **0.155 keys a day**, under an honest gatebreaker's 0.17-0.5;
- finds pay at most **2 keys a week** (`EG_FIND_KEYS_PER_WEEK`);
- `/v1/eg/find` and `/v1/eg/open` both need a handle and either a non-rite `gate_kills` row or a Redoubt taken, so a
  fresh account cannot farm or open.

The Integrity arc's budget measures the asks.

**The launch gift.** When EG2 ships, every account with a non-rite `gate_kills` row gets one key. The migration adds
it to `eg_keys` itself, and a server-post letter (`server_post`) only words it, *From the Battlespire*. The send is
HOURS-FIRST's precedent (migration 0094). PORTAL-GIFT is not: it is a client-side gift given at save load.

**Using it.** Use is a registered arm (`registerItemUseHandler` -> `{kind:'openBreach'}`), routed on every reader as
the Portal Stone's is. Its refusals, in order, each a line of `EG_TEXT`:

1. offline, or on the `?exterior` bench: *The key is cold here.*
2. not in the open world (an interior, a dungeon, a made level): *The key wants open sky.*
3. the Portal Stone's holds (`portalHold` in `src/systems/portalStone.js`: busy, duel, siege, enemies, journey),
   water, or a boat;
4. inside a location's own footprint (a town's walls, a farm's yard): *Not within <place>.*
5. within 300 m of a standing Dagon's Breach, or 150 m of another Elite arch: *Another breach stands near.*
6. the opener already in a breach, or with a stake unsettled: *You hold a breach already.*
7. the hub at `EG_LIVE_MAX` live breaches, or a deploy's drain (section 22): *The Spire's road is shut. Try again
   soon.*
8. no room for the arch: the Portal Stone's `portalPlace` law (ground probe, wall gap) at the arch's clearance,
   `EG_ARCH_CLEAR_M` 8 m: *There is no room for it here.*

Then the **start window** asks where in the Spire:

- **the choices**: *Hall 1*, and every Redoubt the opener may start at (section 16.6), deepest first, each named with
  its band (*Redoubt 12 - the Soul Cairn*);
- **the company's ticks**: a preflight (`/v1/eg/starts`) answers, for each member of the opener's party, which starts
  they may make. Each choice shows a tick or a cross per member. A start some member cannot make asks once: *Go
  without Mara?*;
- **the stake**: *Weir Keys: 3 - one will be staked.*;
- **the Wager** (section 18): up to three decrees of the company's choosing, from three families, for the whole breach;
  a wagered breach ranks on the Depths alone, and the order carries it (`wg`);
- **the Rehearsal** (section 27.7): *Rehearse - Halls 1-5, no key* (once a real day);
- **the classic skin** asks with DFU's DaggerfallListPickerWindow (`src/ui/listPicker.js`, PICK00I0.IMG; the boat
  variant picker is the precedent), so the native-window rule holds: a list of DFU's own, no free-styled geometry;
- **the enhanced skin** asks with `src/ui/enhanced/enhancedPicker.js`;
- **a warning line**, when one of the opener's quests falls due before the last word (36 game hours, three real
  hours): *A quest falls due before the breach can close.*

The answer goes to `/v1/eg/open` (section 23), which stakes one key.

## 6. The breach - the company, the count, the arch, the call

### 6.1 The company

- **Who.** The opener's party at the moment the HUB accepts the open, from the hub's own `party:` record.
  - The hub is the one room every client always holds, and it already keeps the rosters, so no other room needs to
    ask it anything and its silence cannot freeze the wrong company.
  - The company is FROZEN there, up to `PARTY_MAX` (8). One who joins the party later is not in it; one who leaves the
    party is still in it.
  - A party of one is a company.
- **Numerals.** Each member takes a numeral I-VIII at the open, in the party's order. It is drawn over their head in
  Battlemage blue, on their party row and on every errand they are given (section 13.2).
- **Admission** (section 23):
  - Each member asks `/v1/eg/admit` and gets an **admit order**. The service checks:
    - a handle (no guests: the Spire's feats are recorded);
    - that the member may start at the breach's start Redoubt (section 16.6);
    - no other live breach (`eg_live`).
  - The member's hello to `eg:<b>` carries the order. The room spends it once, then checks the member is in the
    company, not fallen twice, not forsaken, not gone home, and the open window.
  - The level claim (`lv`, 1-60) is frozen at the first admission.
- **Outside the company.** Touching the arch: *The breach answers only to <opener>'s company.*
- **One breach at a time** for every account, opener or member, enforced by the service's `eg_live` (section 23).
- **The absent.** A member whose socket is gone keeps their body at its last pose (the socket flap rule, section 22).
  - They are counted fallen only after **180 s gone in a trial** (`EG_ABSENT_TRIAL_S`). Absence on the stair or at a
    rest never counts. A reload, or a slow machine on the stair, is not a fall.
  - An absent body is never chosen as a target. A shape aimed at another member still lands on it, so a tab closed
    before a blow is not a life saved.
  - Their party row shows an amber ring draining the 180 s (section 27.4).
- **Return.** A member whose page reloaded is offered *Return to the Spire* (section 22), into the current hall.

### 6.2 The clock - the count

On the shared clock (`sharedClassicMinutes`: a game minute is 5 real seconds, a game day 2 real hours). The breach
counts from **the opening**, the moment the room accepts the open order, as the gate counts from its day:

| phase (`egPhase`) | game | real | what |
|---|---|---|---|
| **rising** | - | 20 s | the arch climbs out of the ground (`GATE_RISE_MS`) |
| **sealed** | to 60 min from the opening | to 5 min | the arch stands sealed: *The breach opens in 4:12.* The company gathers. (The gate's own rise-to-open is the same hour.) |
| **open** | until the first hall wakes, at most 60 min more | at most 5 min | the opener steps through; the company answers the call |
| **deep** | from the first hall's wake | - | the count starts at 360 game min (30 real min): *The count: 30:00.* The arch sinks |
| **torn** | when the count is spent | - | *The Covenant tears the breach shut.* Everyone inside is cast out to their landing |
| **ended** | - | - | the room mints the end receipts and keeps its tombstone |

What moves the count:

| event | the count | rule |
|---|---|---|
| a Redoubt taken | +180 game min (+15 real min) | `remaining = min(remaining + EG_REDOUBT_HOLD_MIN, EG_COUNT_CAP_MIN, lastWord - elapsed)` |
| THE GOLD RUN (section 8.2) | +12 game min (+1 real min) | past the cap, it counts toward a Surplus |
| the closing | runs its first `EG_CLOSING_COUNT_S` 15 s, then HOLDS | a straggler costs the company 15 s, not 45 |
| the pull to the wake (the swap and the gather together) | HOLDS, at most `EG_STAIR_HOLD_S` 40 s | a slow machine's loading is never the company's time |
| the rest (90 real s) | HOLDS | *The Redoubt holds the count* is shown by the count's chip, never said |
| a respite | HOLDS | from the breach's respite budget (below); the last word does not hold |
| a deploy's hold (section 22) | HOLDS | the gap is given back |
| a Court's fight when the count is spent | THE COVENANT'S PATIENCE (section 18) | the Court finishes under the Covenant's Weight |

Constants (`net/egLaw.js`): `EG_RISE_MIN` 60, `EG_ADMIT_MAX_MIN` 60, `EG_COUNT_START_MIN` 360, `EG_REDOUBT_HOLD_MIN`
180, `EG_COUNT_CAP_MIN` 360, `EG_REST_S` 90, `EG_CLOSING_COUNT_S` 15, `EG_STAIR_HOLD_S` 40, `EG_RESPITE_BUDGET_S` 900,
`EG_RESPITE_VALK_S` 600, `EG_LAST_WORD_MIN` 2160. `egTimes(rec)` answers every phase's relay time and `egPhase(rec,
ms)` the phase: `'rising' | 'sealed' | 'open' | 'deep' | 'torn' | 'ended'`. These are `gateTimes` and `gatePhase`
again, for a record instead of a day.

**The respite budget.** Every breach has `EG_RESPITE_BUDGET_S` (900 s, 15 minutes) of respite, and each Valkynaz
Redoubt adds `EG_RESPITE_VALK_S` (600 s). It is spent at any Redoubt, in pieces, by the company's word (section 16.4):
the count holds while it runs, the last word does not. A three-hour run with one life must leave room for ordinary
life; FFXIV's deep dungeons save between sets of floors for the same reason.

**The surplus.** Time the cap turns away is not wasted. Every 5 real minutes the cap refuses becomes a **Surplus** (at
most `EG_SURPLUS_MAX` 3). At any Redoubt, a Surplus buys a fourth Vestige card or a reroll of the three. A fast company
is paid for its speed in choices, not in hours.

**Why the count is shaped so.** "Timed like oblivion gates" is a window with an end the company can see coming, and an
endless run needs that end to come from the run:

- a fixed window would cap every company at the same clock;
- a count that only grows would let a perfect company stand in the Spire for ever, and the relay pays for every awake
  second (RELAY-H1);
- with thirty minutes to start, fifteen for each Redoubt and thirty in hand at most, early circles bank time (and
  Surplus) for a company faster than reference, and deep circles drain it;
- the count runs while the company plays and holds while it travels, so a phone's loading or a straggler on the stair
  is never the company's time.

How deep a company gets is where its pace meets the Spire's (section 18). The tear is not a death: nobody is killed,
no DEATH-PENALTY runs, and what was banked stays banked. The Reliquaries are lost (section 16.3).

### 6.3 The arch

The gate's own model, `buildGateModel` in `src/world/gate/gateModel.js` (Mac's Blender bake), drawn at **0.62 scale**:
10.04 m tall and 4.79 m to each side.

- **The skin**: Imperial white marble inlaid with gold, cracked through with the Warden's basalt.
- **The pass** (`src/render/gate/gatePass.js`) compiles the membrane's colours and the arch's heights into its shader, and
  the beacon's column with them: it runs `BEACON_HEIGHT_M` (1200) from `BEACON_BELOW_M` (400) under the foot, so it
  stands 800 m over the ground, its light starting at `BEACON_START_M` (15). Its colour is the uniform `uColor`, set
  once a frame from `BEACON_COLOR` before the loop over the gates, and its `draw()` takes at most `GATE_PASS_MAX` (2)
  gates. EG9 widens it: the membrane's tint and scale, and the beacon's height, foot (scaled with the arch, so its
  light starts at the lintel) and colour, become per-draw values set inside the loop; the gate's own draw passes the
  gate's. `GATE_PASS_MAX` rises to 4, since the day's gate and several arches can stand in one view.
- **The beacon**: gold, standing 400 m over its foot, half the gate's 800, seen from kilometres away. A company's door
  should not outshine Dagon's.
- **Rising and sinking**: it climbs out of the ground over `GATE_RISE_MS` (20 s) and sinks over `GATE_COLLAPSE_MS`
  (10 s).
- **Its clearing**: `createGateClearSweep` (`src/world/gate/gateClearance.js`) tracks one key today. EG9 widens it to a set
  of keys, the clock's gate and every standing arch, each keyed by its breach id.
- **Where it stands**: at the opener's feet, ahead (the Portal Stone's `portalPlace`, `PORTAL_AHEAD` 2 m), facing the
  opener.
- **How peers see it**: the hub's signed call travels on the opener's world cell (section 23) while the opener stands
  there. Peers stand only an arch whose call verifies, at most two a cell, so no client can stand a false arch under
  another's name.
- **How long it stands**: through the rising, the sealed hour and the open window only. When the first hall wakes, the
  arch sinks behind the company. A breach is a door, not a monument, and nothing outside needs to stand for three hours.
- **What the room keeps**: the arch's site in its state, so a cast-out member is landed at it with the arch gone.

### 6.4 The call

Eight players across the Bay cannot all walk to one arch in ten minutes. So the company **answers the call** (THE
CALL):

- **The opener** steps through the arch.
- **Every other member**, standing outdoors in the open world during the open window (the Portal Stone's holds
  apply), may answer. The Portal Stone's portal (`src/scenes/portalGates.js`, drawn with `src/scenes/portalFx.js`'s
  vortex) opens at their feet for `PORTAL_OPEN_MS` (30 s, `src/systems/portalStone.js`), and stepping into it is their
  admission.
- **The word.** The hub tells the company `{t:'eg', k:'call', b, ew, site, riseAt, openAt, sg}` on the party channel,
  `sg` being the hub's signature over the rest. Each member's client then:
  - sounds a horn and writes one chat line, *<opener> opens an Elite Breach.*;
  - shows a prompt that stays until answered or the window ends, *Answer the call - 4:12* (Enter, the pad's A, or a
    tap), and comes back after any window closes over it;
  - marks the arch on the compass;
  - indoors, reads *Answer from open ground.*
- **Answering** asks `/v1/eg/admit` for the order the portal is stepped through with.
- **Admission never depends on place**: the room checks orders and the company, never where a member stood.
- **Landing**: where each member answered is stored as their LANDING. A fall, the way home, the tear or the end lands
  them there. The opener lands at the arch's site: `gateLandingFor` (`src/world/gate/gateArena.js`) is widened to take an
  arch record (a site and a yaw), since today it takes only a gate's day.
- **Late.** A member who answers after the open window reads: *The breach has closed behind <opener>'s company.*

## 7. A run - halls, circles, bands, the stages

**Halls and circles.** Hall *h* (1, 2, 3...) belongs to circle *c* = ceil(*h*/5). Halls 5*c*-4 to 5*c*-1 are the
circle's four trials. Hall 5*c* is the **Court**, whose fall takes **Redoubt c**. A breach that starts at Redoubt *R*
begins at Hall 5*R*+1, *the first hall* of that breach.

**The rhythm.** Every circle fills the same five slots, so a company can feel its place:

| slot | kind of hall | drawn from |
|---|---|---|
| 1 | **fight** | the Rift-Yard or the Rampart, in one of its variants; in circles 6, 11 and 16, a Brink hall (section 8.9) |
| 2 | **traverse** | the Span; from circle 3, the Deepway one time in three |
| 3 | **mixed** | the Proving Walk, or the Athenaeum (at most one a circle, never in circle 1) |
| 4 | **fight** | the Rift-Yard or the Rampart, drawn apart from slot 1: never the same kind and variant twice running |
| 5 | **the Court** | the circle's lord (section 13) |

**The first circle** is fixed while any admitted member has never taken Redoubt 1: a Rift-Yard, a Span through an
Oblivion Caverns passage (a fire-fall curtain, a chasm on ledges, an opening onto the burning sky), a Proving Walk, a
Rampart, and Grath's Court in the magma chamber. In circles 1 and 2 every span carries a passage. A first breach shows
the place Mac asked for in its first five minutes.

**One hall at a time, the company together.** The room holds one live hall, and the company moves through its stages
as one:

| stage | what | how long |
|---|---|---|
| **arrival** | each member steps off the swap onto the hall's ARRIVAL PLATE (gold) and says `here` | as they come |
| **gather** | a ring fills over the plate, *3 of 6 here*. The hall wakes once every living member has said `here`, or `EG_ARRIVE_MAX_S` (30 s) after the pull: *The hall wakes.* After two halls in a row that a member woke late, the wait for them drops to 10 s | `EG_GATHER_S` 8 s after the last `here` |
| **the trial** | the hall's kind (section 8), its objective on the arrival card and the objective chip (section 27.3) | the trial's |
| **the door** | the relay judges the trial done, and a gold door opens at the hall's END PLATE: a beam seen hall-wide, a compass and screen-edge marker, *The way down opens.*, and a door's sound | - |
| **the closing** | each member steps through the door when ready (`down`, accepted only within `EG_DOOR_REACH_M` 3 m of it, from a fair trail, section 21) | `EG_CLOSING_FIGHT_S` 20 s; `EG_CLOSING_SPAN_S` 45 s after a span or the Deepway |
| **the pull** | at the closing's end, every living member still in the hall is pulled down | after a span, the toll (section 10.6) |

**The breach's first hall** wakes when every company member has said `here`, or when the open window ends
(`EG_ADMIT_MAX_MIN`); a member not admitted by then is out.

No member is targeted or judged before their `here`. A span's door opens when the FIRST living member stands on its end
plate with a fair trail (section 21). The closing then gives the others 45 s to cross, and the pull carries whoever did
not, at the toll's cost. Skill is paid and nobody is stranded. Nothing waits on the slowest player for ever, and
nothing is skipped for free.

**THE SWAP.** Between halls, the made level is replaced in place. Every made level today is entered only from the
exterior: `enterSdRealm` (`src/scenes/worldModes.js`) refuses unless the mode is `'exterior'`, and the world host's
`sdEnterRealm` forces the player out to the exterior and teleports to a pixel first. Reused as it is, every stair would
stream an exterior pixel, switch the presence socket to a world cell, fire every exterior-transition hook and leak the
old dungeon context (`dungeonTransition` never destroys the context it replaces). So EG10 builds `swapEgHall(spec)`:

- the old hall's context is torn down (the teardown of `exitDungeonNow`, without `setMode('exterior')`, a landing or
  streaming) and the next is stood;
- no exterior pixel is streamed, and no exterior-transition, HCC, quest or unlevelled-loot hook runs;
- every hall of a breach keeps one presence room, `{kind:'eg', b}`, so the swap never switches the presence socket;
- **the next hall is built during the closing** (`egHallOf(seed, h+1)` is known), time-sliced at no more than 4 ms a
  frame, with the mesh kit writing straight into typed arrays (section 11.6); the swap only uploads it. A
  40,000-triangle build costs 41-53 ms and 21-30 MB of garbage on a desktop in one task (AUDIT EG II L4-27), so it must
  never land in one frame;
- at most two halls are resident;
- pinned: after 20 swaps the live mesh, texture and collider counts are back at their baseline, and no world-cell hello
  was sent.

**The stair** is what the swap shows. The full fall through the void, past the Spire's broken underside, plays at the
first hall of each band. Every other swap closes the veil (`stepThroughFire`) in a 0.8 s dither with the band's chime,
holds on *Hall 13* centred while the upload lands, and opens in 0.8 s. Under `prefers-reduced-motion`, or a new
`port:reducedMotion` in the Accessibility tab's Motion section (EG16), every swap is a plain dither cut. A company sees
the stair 30 to 75 times a run; it must never be the thing that makes them sick.

**The bands.** Every 25 halls (five Redoubts) the halls have fallen further down the legions' road. Each band adds
kinds; earlier kinds stay.

| band | halls | what it is | look | its legion adds | its lords | its champion |
|---|---|---|---|---|---|---|
| **the Broken Galleries** | 1-25 | the academy's upper halls, still over the Deadlands | white marble and gold, burnt Battlemage blue, the fire-sea below | Harriers, Sappers, Ward-Bearers, Breakers, Casters, Lurkers | Grath, the Hound; the Last Spellmaster; the Last Armsmaster; Valkynaz Ilthys at Redoubt 5 | a Kynreeve |
| **the Soul Cairn** | 26-50 | halls fallen into the Ideal Masters' realm of the dead | violet-grey stone, soul-gem light, a sea of mist | Binders, Wraiths | the Cairn-Keeper; the Twin Lords; Valkynaz Morvayn at Redoubt 10 | a Kynmarcher |
| **the Shade Perilous** | 51-75 | halls fallen into Nocturnal's dusk | near-black, moon-silver, light only where braziers burn | Divers | the Mother of Dusk; the Night-Stalker; Valkynaz Seyth at Redoubt 15 | a Markynaz |
| **the Havoc Wellhead** | 76 onward | the muster-ground of 3E 398, the Spire's last fragments in it | basalt and molten iron, eruptions | a Daedra Lord as an elite add, one wave in six | the Bound Colossus; the Wellhead Wyrm; Valkynaz Garoth at Redoubt 20 and every fifth after | a Markynaz |

The bands are the arc's progression: each changes the look, the score, the legion, the lords, the champion, the
pieces, the fragments and the hall variants. The Wellhead is the Spire's endless depth. From Hall 76 its band does not
change again, and depth grows by decrees, the Wellhead's tides and its strata (section 18). A decree never draws a
kind, a piece, a variant or a lord its band has not unlocked.

## 8. The halls

Every hall is laid along +Z, from its arrival plate (z = 0) to its end plate, over the void. Falling below a hall's
floor (y < `SD_VOID_Y`, -30), into magma or into the mist is never a death. It casts back to the last island or plate
stood on, at the Spire's own cost: 10% of max health, never below 25% health (`EG_CAST_BACK_LOSS`,
`EG_CAST_BACK_FLOOR`). That is gentler than the Steps' 15%, because in the Spire it is a long run's attrition, not one
course's. The void punishes in time and health. It does not take the one life.

**Health between halls.** The Spire keeps the Burning Court's rule: no natural regeneration
(`src/systems/courtRules.js`, WBX6), as the Hour does. Health comes back from:

- a Redoubt's rest;
- the member's own potions, at most two a hall (THE POTION LAW, section 17.4), and spells;
- Vestiges (Rally, Second Wind, Mender's Grace);
- the Low Road's Battlemage's niche (section 11.4), a cache's Spire Tonic and the Mending Cantrip (section 17);
- the Scriptorium twist.

### 8.1 The Rift-Yard (`yard`) - relentless waves

A court disc of radius 22-28 m (the gate's `COURT_R` is 24), with **Wellhead rifts** on its rim: tears into the Havoc
Wellhead the legions came through, each a standing body.

- **Rifts**: `clamp(2 + ceil(n/3), 3, 5)` for *n* living members.
- **The rifts' health**: together they hold 36 s of the company's reference damage, split evenly (each `36 / rifts`
  s), through `hostTeamHpFor` (the gate's, with its `HOST_HP_MIN` floor), times the depth `(1 + 0.04(c-1))`. A larger
  company has more rifts to split over, never more to break.
- **Each rift pours a wave** every `max(9, 20 - 0.5(c-1))` s while it stands: the band's kinds, sized by *n* (section
  12). The waves never wait for the last body to die. That is the relentlessness. A wave's cadence is "more at once",
  not a faster blow: NOTHING GETS FASTER binds every wind-up and every piece, and the waves' cadence is depth's own
  knob (section 18).
- **The legion's cap**: no more than `min(14, 2 + ceil(1.5n) + floor((c-1)/5))` standing. A rift whose wave would pass
  the cap holds it, and the next wave is one body larger. A company of eight stands at 14 from circle 1; depth reaches
  it through decrees and kinds, never more bodies (the telegraph budget, section 25.4, is why).
- **The end**: the last rift closed. Every add still standing crumbles (the host's `adie`), and the door opens.

**Variants**, drawn by `egCircleOf` (section 9); one more unlocks with each band:

| variant | band | what |
|---|---|---|
| **the Rift-Yard** | the Galleries | as above |
| **the Wellspring** | the Galleries | one great rift worth 30 s of the company's reference damage, shielded while any of its three anchors stand (each 4 s); Sappers walk to broken anchors and relight them at a third |
| **the Muster** | the Cairn | no rifts: a Kynreeve standard-bearer walks between three rally points (3.0 m/s, a new point every 20 s), and every rally point pours waves while the standard stands. It holds 20 s of the company's reference damage, times the depth. Fell it and the waves stop |
| **the Holdfast** | the Shade | hold a Battlemage relic (a gold disc, r 6) for 75 s against waves from three rifts. Each add that reaches it takes 4 of its 100. A broken relic opens two more rifts and the hold restarts at half; it never fails the hall |
| **the Wellmouth** | the Wellhead | the rifts wander: each moves between three sockets on the rim every 20 s, at a fixed 2.0 m/s, so the groups that close them must follow |

From circle 2, one Yard in three stands in a chamber (section 11.4), its rifts set in the walls.

Split up and close rifts in parallel, or stand together and be buried. An eight-member company closes five rifts in
three groups; a pair closes three, back to back, against a legion sized for two.

### 8.2 The Span (`span`) - platforming

A generated course (section 10) of 12-28 platforms in two to four sections, with islands between them, from the
arrival plate to the end plate.

- **Harriers** (Imps, hovering at `HOST_HOVER_M` 0.9 m) shadow the company along the course. Over platforms they
  body-block and never bite; they bite only on islands and plates (traversal ground is never aimed at, section 11.7).
- **Divers** dive at it from the air, from the Shade: only at its islands and plates, under the Diver's rule (ground at
  least the shape's width plus 2 m: 6 m).
- **The door** opens on the first living member at the end with a fair trail (section 21).
- **Fragments**: a span may pass through fragments, and from circle 2 every span forks into a High Road and a Low Road
  (THE FORK, section 11.4).
- **THE GOLD RUN**: if every living member is across, by either road, before the closing's 15th second, the count
  gains one real minute; past the cap, that minute counts toward a Surplus. A company of one is exempt: its own arrival
  opens the door. A pose-gated credit needs a fair trail from the last island (section 21).
- **The trail**: once the door opens, the first across's route (from the relay's poses) draws as a faint gold ribbon
  for the others.
- **Members never block each other**: peers are not in the collider (`src/net/remotePlayers.js`). Allies draw at 60%
  opacity on traversal ground, so an ally never hides an edge line.

### 8.3 The Rampart (`rampart`) - a walkway under fire

A walkway 90-160 m long over the void: 3-4.5 m wide for a company of up to four, 5-6 m for five to eight.

- **Fire vents** cross it on a cycle: each a lane 4 m deep, laid across the walkway and at least 4 m long, past a
  narrow walkway's edges (THE WIDTH RULE, section 11.7),
  telegraphed 1.0 s before it erupts (20% of max health, fire).
- **The legion marches along it** toward the company. The relay runs them on a line, the walkway's own axis, so it
  needs no navmesh.
- **Bastions** every 35-45 m: fight floors (r 6) off the walkway's side, where the march halts and Breakers enter. The
  back of an eight-member line always has somewhere to fight.
- **Casters** stand on `1 + ceil(n/3)` pillars beside it, 10-18 m out, throwing discs. Reach them by short side spans,
  or answer them with arrows and spells.
- **Breakers** charge ACROSS the walkway from the side spans, never along it. A lane along a walkway would leave no
  floor to escape to (AUDIT EG0 G4). Their push is 6 m, and a push off the edge is a cast-back, not a death.
- **Waystones** every 30 m, lit gold when they are a member's cast-back point: a push off the edge returns them to the
  nearest one behind, never to the arrival plate 160 m back.
- **At its end, a portcullis** held by two Ward-Bearers (the gate's Legion-Lord kind, pulsing). When both fall, the
  door opens.

**Variants**:

| variant | band | what |
|---|---|---|
| **the Siege-Walk** | the Galleries | as above |
| **the Falling Wall** | the Galleries | 20 s after the wake, the walkway falls behind the company, segment by segment, at a fixed 1.5 m/s. A member caught is cast to the nearest standing segment ahead, at the cast-back's cost |
| **the Winch** | the Cairn | the portcullis rises only while `min(2, n)` members stand on its winch plates, over 60 s, under the march |
| **the Gauntlet** | the Shade | no march: `2 + ceil(n/2)` caster pillars, each silenced by standing 3 s on its side span's plate |
| **the Forge Bridge** | the Wellhead | the walkway is a conveyor running toward the arrival plate at a fixed 1.0 m/s, under the march and the vents |

### 8.4 The Athenaeum (`athenaeum`) - the lock

The Battlemages' library, its heart an **Orrery** drawn by `orreryOf` (`src/net/superDungeon/sdBrain.js`).

- **Today**, `orreryOf(s)` takes a Hollow's slot. It reads its fray from that slot's own Hour marks
  (`sdMarksLaw(sdMarksOf(s)).fray`) and its turns range from the module constants `SD_TRUTH_TURNS_MIN`/`_MAX`, with a
  64-entry cache.
- **EG4 widens it** to `orreryOf(s, {turnsMin, turnsMax, fray})`. The Hour's call and its golden draw are unchanged;
  the cache is keyed on the seed and the band.
- **The Spire's knobs**: the turns range starts at 16-28 and rises by 2 every five Redoubts. The fray is the Hour's
  default unless the circle carries the Hour's decree The Fraying (section 14).
- **The judge**: EG4 extracts the pure judge, `orreryJudge`, out of `_sdTurn` in `server/src/index.js` (reach,
  settle, rights, `orreryStep`). The Hour's room and the Spire's both call it.
- **Pressure**: `ceil(n/4)` Harriers rise every 15 s while the lock stands, so the members off the stones guard the
  members on them.
- **Everyone works**: any member in reach may turn any stone. The rights (`orreryMayTurn`) only hold back a turner who
  keeps lengthening the road while another turns.
- **The reward**: solving it in no more turns than the band's minimum grants every member one free Vestige rank at the
  next Redoubt.

### 8.5 The Proving Walk (`proving`) - span, champion, span

The Battlespire was a proving ground. A short span (6-10 platforms) leads to a **proving court** (r 14), where the
band's **champion** stands: a Kynreeve in the Galleries, a Kynmarcher in the Cairn, a Markynaz below.

- It is one foe the relay runs: `PROVE_HP_S` 40 s of the company's reference damage, times the depth.
- Its body is the Warden's look at 2.5 scale (Ruhn's 3 is his own), with the boss mark ring. Its shapes are the Warden's
  own Cleave, Slam and Charge from `ATTACKS`, each lengthened to its wind-up floor and the Charge widened to 4 m (THE
  WIDTH RULE).
- It wakes at the wake ring (section 8.6).
- It brings an escort of `1 + ceil(n/3)` adds from its band (2 to 4).
- Each rank has a signature:
  - **the Kynreeve, Shield-Wall**: blows on his front 120° deal 75% less, blows from behind 30% more (the relay knows
    both poses), and he turns to the top of threat, so one member holds him while the others flank;
  - **the Kynmarcher, the Citadel**: he plants three standards, each 4 s of the company's reference damage; each
    standing standard takes 20% off every blow on him;
  - **the Markynaz, the Grand Duke's Decree**: he lays one lord-family decree (section 14) on his own fight, named on
    his card.
- Its fall opens a second span, whose end is the door.
- From circle 2, one proving court in three is a chamber: the Fallen Stacks' broken dome, with two balconies (section
  11.4).

### 8.6 The Court (`court`) - every fifth hall

A short approach (3-5 platforms of the band's first two pieces) leads to the **Court**: a court disc of radius 26, or
the lord's own ground (section 13).

- **The wake ring**: a gold ring at the court's edge. The lord wakes when every living member stands inside it, or
  `EG_WAKE_RING_S` (20 s) after the first does, with the gate's wake beats: the roar, and the lord's card (its name and
  epithet). The fastest member never meets the lord alone.
- Its fall raises the **Redoubt's beacon** at the court's heart, and the Redoubt is taken for every living member at
  once (the Redoubt's sequence, section 16.2). Touching the beacon is not needed.

### 8.7 The twists

From circle 2, about one hall in four (seeded, never the Court, never two running) carries a **twist**:

| twist | what | on |
|---|---|---|
| **Reliquary Vault** | a side span to a cache: an extra Reliquary for each member who reaches it with a fair trail, at the count's cost | a Span or a Proving Walk |
| **Dagon's Bargain** | a shrine on the arrival plate: the company's word (section 16.4) accepts one more decree for the rest of the circle, and each member who voted yes gains one Reliquary if it passes. At most one a circle, and none when no family is free (section 14) | any trial hall |
| **Kynval Squad** | four Kynval elites in place of a wave, each with one affix: **Searing** (its strike leaves a pool, r 2.5, for 6 s), **Shielded** (a shield of a quarter of its health that only blows from behind break), **Wrathful** (shares +10%, inside the 1.5 cap), **Unshaken** (immune to push and to Fade) | a Rift-Yard or a Rampart |
| **The Scriptorium** | a quiet hall: heals 30%, no trial, and the door opens after 30 s (the count runs) | slot 3, in place of its kind |
| **A Battlemage's Ghost** | a friendly ghost (the relay's host runner, a friendly flag) fights beside the company for the hall | any trial hall |
| **The Deserter** | a Dremora deserter races the company to close rifts. If the company closes more, each member gains a Vestige shard (section 17.1); otherwise he takes the hall's cache | a Rift-Yard |
| **The Kyn Mimic** | one cache in eight is a Lurker; its tell is a lid that breathes red | any trial hall |
| **The Captive Battlemage** | three chains, each 4 s of the company's reference damage; break them all and each member gains a Cantrip (section 17.2) | any trial hall |
| **The Sutler** | the Kyn quartermaster on the arrival plate, selling for lumen (section 17.3) | any trial hall |

### 8.8 The Deepway (`deepway`) - a hall of fragments

From circle 3, the traverse slot draws the Deepway one time in three instead of the Span. It is a hall built of four
fragments end to end (section 11), a crawl through the band's deep places:

1. a passage;
2. a chamber, whose objective is one of: rifts at the Rift-Yard's law with the legion's cap halved; a champion; or an
   engine held for 45 s against waves;
3. a shaft down, or a set-piece passage (section 11.3);
4. a passage, to the end plate.

The chamber's objective is the trial's: the door cannot open until it is done, so one runner cannot skip the fight.
Then the door opens on the first fair arrival, and the closing is 45 s, as after a span. The toll is by distance
(section 10.6). Each band has its own: the Oblivion Caverns in the Galleries; the Ossuary and the Mist Stair in the
Cairn; the Gloam Thicket and its Hollow Trunk in the Shade; the Forge Gut and its Slag Chute in the Wellhead.

### 8.9 The Brink halls - from band to band

Halls 26, 51 and 76, the first of each new band, are a **Brink**: a fixed traversal of about 60 s at the span build,
with no fight (the count runs). The hall tears loose from one realm into the next as the company crosses it: Galleries
marble giving way to Cairn mist, the Cairn's slate to the Shade's dark, the Shade's glass to the Wellhead's fire. Its
course is a set-piece passage (section 11.3) solved like any other, and its end plate shows the new band's card. Every
hall's sky holds the Spire's broken underside, drawn smaller with each band, so depth is something the company can see.

## 9. The generator - the hall spec

**One pure law, read by both sides.** `egHallOf(seed, hall)` (`net/egLaw.js`) answers the **hall spec**:

- the kind, its variant, the band, the circle, the slot and the twist;
- the hall's geometry: its plates, court discs, rifts, walkway, bastions, pillars, side spans and span course;
- its fragments: each one's kind, class, socket and seed, and so its law half (section 11.5);
- its cache's kind, its engines and its alcoves (sections 11.10, 17);
- its decrees, as numbers.

The relay reads it to run the hall's brains: where a court's clamp is, where a rift stands, the walkway's line, where
a platform is at time *t*. Every client reads it to build the hall (`buildEgHallModel(spec)`,
`egHallColliderTris(spec)`, the Steps' records for a span). Those builders are ONE construction seam,
`egHallParts(spec)`, which builds the model, the collider buckets and the riders together (THE ONE CONSTRUCTION SEAM).

**The relay and the clients must compute the same spec, so the law is exact.** `Math.sin`, `cos`, `tan`, `atan2`,
`hypot`, `pow`, `exp`, `log` and `cbrt` are implementation-approximated: V8's results and an iPhone's JavaScriptCore's
can differ in the last bit, and one flipped threshold in the solver (the 0.5 s window, the eight retries, the budget's
sum) would give the relay and a phone different halls. So:

- the law files decide only in integers: positions quantized to centimetres, times to milliseconds, costs as
  integers;
- their trigonometry runs through a polynomial `lawSin`/`lawCos` of their own, exact in integer arithmetic;
- a source sweep refuses any of the functions above in `net/egLaw.js`, `net/egSpanLaw.js` and `net/egFragLaw.js`;
- the state frame carries `sd`, an FNV-1a digest of the quantized spec. A client whose own spec disagrees asks
  `{k:'spec'}` and builds from the relay's bytes, and the mismatch rides the next receipt's measures.

**Seeds.** The breach's `seed` is drawn by the relay's CSPRNG when the room accepts the open order, and said in its
state. A hall's own seed is `egSeed(seed, hall)`, the `sdSeed` mix. EG5 exports `sdSeed` from `src/net/superDungeon/sdBrain.js`
(today it is private), and the Spire imports it rather than copying it (ONE DFU MEMBER, ONE EXPORT). The receipts'
seeds are not the breach's (section 22).

**The law's version.** `EG_SPEC` is the spec law's number, recorded per breach as `egv` at the open (section 22).

**The circle law** (`egCircleOf(seed, c)`) fills the rhythm's slots (section 7) from their kinds, weighted by band.
Slot 2 is always the traverse; the weights below draw slots 1, 3 and 4:

| | yard | rampart | proving | athenaeum |
|---|---|---|---|---|
| the Broken Galleries | 3 | 2 | 3 | 1 |
| the Soul Cairn | 3 | 3 | 2 | 1 |
| the Shade Perilous | 2 | 3 | 3 | 1 |
| the Havoc Wellhead | 3 | 3 | 3 | 1 |

A kind's variant is drawn from those its band has unlocked, never one of the kind's last `min(2, unlocked - 1)`
draws, so the Galleries' two alternate and the Wellhead's five never repeat within three.

**A hall's budget.** Every piece the generator places carries an integer cost: a platform kind, a rift, a vent lane, a
caster pillar, a fragment and each of its hazards, an engine. A hall's pieces sum to `egBudget(h)`, which grows with
the circle and the decrees. The Spire therefore has no lucky seeds: two companies at Hall 40 face halls of the same
weight, drawn differently. The budget is the measured knob of EG's tuning pass (EG21).

**Where the law lives.** The relay draws halls too, so the span law must not pull client code into the relay bundle.
Today `src/world/superDungeon/sdSteps.js`, which holds the platform clock (`stepAt`, `beatStands`), imports `src/world/superDungeon/sdHall.js`,
and through it the Hour's art; the union floor's bearing search lives in `src/scenes/gate/gateCourt.js`, which imports
`render/`, `ui/` and `world/` modules. Neither is in `RELAY_GRAPH` (`test/net/relayversion.test.js`). So:

- EG4 moves the platform clock (`stepAt`, `beatStands`, `beatBlinks`, `crumbleAfter`, `gustAt`) into
  `net/egSpanLaw.js`, a leaf, and `src/world/superDungeon/sdSteps.js` re-exports it;
- the fragments' law is another leaf beside it, `net/egFragLaw.js` (section 11.5);
- EG8 moves the bearing search into `net/egFloor.js` and widens it there (THE UNION FLOOR, section 13.2);
  `src/scenes/gate/gateCourt.js` imports it back for the arrow;
- the span law's motor numbers are copied as `EG_*` constants and held equal to the motor's by a test;
- the solver is part of that law, so the relay and the client draw the same course;
- the CLI `egSpanSolve.mjs` (under tools/, as `tools/sdScoreProbe.mjs` is) only drives it;
- pinned: `RELAY_GRAPH` gains no `world/*Art*`, `scenes/*` or `render/*` file.

**Pins.**

- The spec law is pinned against golden specs for fixed seeds.
- Every spec field the relay reads is pinned against the brain that reads it.
- A change to the draw changes the relay version, as the Orrery's golden draw does (`test/net/relayversion.test.js`).

## 10. The spans - generated platforming

### 10.1 The course is the Steps' own record

`src/world/superDungeon/sdSteps.js` lays the Unmoored Steps as a uniform array, `{i, kind, span, x, y, z, w, d, amp, period,
phase, beat}`, plus checkpoints `{x, y, z, r}` (the Spire's islands): exactly what a generator emits.

- **Today** it is frozen at import (`layCourse`, `SD_STEPS_COURSE`). Its module-scope readers are `SD_GHOST_STEPS`
  (the pass's uniform count), `SD_WAYSTONES` and `SD_VANE`, `sdFx`'s `SD_REWIND_EDGES`, `sdIslandModel` and
  `abyssLab`. The motes read `SD_COURSE_END` lazily. At build time, `createSdSteps` (`src/scenes/superDungeon/sdSteps.js`, the
  riders) and `src/world/superDungeon/sdStepsModel.js`'s check and breath builders (`buildChecksModel`, `checkFloorTris`,
  `buildBreathModel`) read it too.
- **EG4 turns it into data**:
  - `courseOf(courseSpec)` lays a course;
  - the Hour's course is `courseOf(SD_COURSE_SPEC)`, byte for byte the frozen one, pinned;
  - every reader above takes a course, and the pass's ghost count becomes a maximum.
- **The generator**: `egSpanOf(seed, hall, budget, band)` emits a course from the pieces below, one per road when the
  span forks.

### 10.2 Three builds, each for its reason

- **THE SPAN BUILD** is SD7b's: Speed 10, Running 0, Jumping 0, the worst build the game makes. Every gap, the solver's
  windows and the CI sweep use it. A gap is binary, so every build must cross every gap.
- **THE ESCAPE BUILD** is Speed 40, Running 20, `runSpeed` 6.975 m/s. The wind-up floor uses it (section 13.2),
  because escaping is continuous and a slow build has Speed and the Fleetfoot Vestige to answer it.
- **THE FAST BUILD** is the fastest legal one: Speed 100, Running 100, Jumping 100, Fleetfoot III, athleticism with
  Improved Athleticism (an ImprovesTalents enchantment), and the Jump spell's flat +0.6 (`jumpSpeedMultiplier` 2.3 in
  `src/systems/skills.js`: a 2.68 m apex), steering in the
  air. It bounds what a player can do: the Drop's walls, a fragment's headroom, and the crossing's lower bound (section
  10.5).

### 10.3 The pieces, and what each shows

NOTHING GETS FASTER: every piece keeps the Steps' timing at every depth. Depth adds pieces, combines them in one
section, spaces the islands further apart, and puts the legion overhead. **Every piece shows what it will do next**
(SD-LOOK section 8's law), in its band's dress:

| piece | from | what | its numbers, at every depth | its tell |
|---|---|---|---|---|
| **Drift** | the Steps | a platform swinging side to side, `stepAt` | `amp` (half the swing) 1.0-2.0 m, period 4-7 s | hangs on two chains from an anchor 18 m up (an arch rib, a ribcage, a moon-shard, a crane hook), leaning as it swings |
| **Beat** | the Steps | there on the beat only, `beatStands` | cycle `SD_BEAT_CYCLE` 3.6 s, solid `SD_BEAT_SOLID` 2.4 s, blink `SD_BEAT_BLINK` 0.4 s, alternate steps `SD_BEAT_HALF` apart | the band's glyph on its face, a sector sweeping through the solid time; the last 0.4 s white, faltering at most 2.5 Hz; a gold ghost (`sdStepsPass`) while it is gone |
| **Riser** | the Steps | a wall `SD_RISER_H` 2.3 m, run up (CLIMB3) or climbed | the engine's range | a gold lip along its top |
| **Crumble** | the Steps | shakes and falls after a foot | delay `SD_CRUMBLE_DELAY` 0.7 s, back `SD_CRUMBLE_BACK` 5 s, platforms 2.6 m deep | three crack stages, and the rewind as it returns |
| **Gust** | the Steps (the breath) | a span-wide push, warned 1 s | every `SD_GUST_EVERY` 6 s, `SD_GUST_SPEED` 3 m/s for 1 s | a streamer banner on every island pointing the push 1 s ahead; the wind rising (`AmbientWindMoanDeep`); streaks at the screen's edge |
| **Rail** | new | a platform that travels along the course between two plates, ridden (`carryBy`) | period 6-9 s | a dashed gold track between its plates, ticked at each end |
| **Pendulum** | new (`egPendulum`, a hazard; not the Drift's `SD_PENDULUM` dressing) | a chained weight swinging across a GAP | period 3-5 s; a touch is a cast-back unless Iron Footing III | a white hatched lane over the gap, brightening over its last 0.8 s |
| **Vent** | new | a vent under a platform at least 4 m across, erupting on a cycle | 20% fire; cycle 4-6 s | a white ring closing over 1.0 s |
| **Drop** | new | a drop to a walled landing | at most 4.5 m, onto a landing at least 6 m deep, walled on its far side and flanks to at least 7.5 m over it | the landing's edge line, gold; the wall's face lit |

**Islands** carry the Steps' waystone, lit gold while it is a member's cast-back point. A lab view, `span-far` (30 m),
proves that solid, white and gone are told apart under `?grey`.

Pieces unlock by band:

- the Broken Galleries: Drift, Beat, Riser, Crumble, Drop;
- the Soul Cairn adds the Gust and the Rail;
- the Shade Perilous adds the Pendulum;
- the Havoc Wellhead adds the Vent, all nine.

### 10.4 THE ENVELOPE

SD7a's law, made the generator's. Every number is a bound, never a target:

- **a gap** is 2.4-3.2 m. SD7b crosses 3.2 m at the span build; the plain running jump at the escape build reaches
  more, so training buys margin, not entry;
- **a riser** is taller than the Jumping-100 apex plus 0.5 m, and no taller than `wallRunHeight(0,0) +
  PARKOUR_REACH_MIN` (2.5 m);
- **a step down** within a run is under 1 m;
- **a Drop** is at most 4.5 m. The motor bills fall damage on distance from the takeoff (`fallStart`), over
  `FALL_DAMAGE_THRESHOLD` (5 m), so 4.5 m bills nothing. A run carries the body on: stepping off at the escape build
  lands 4.7 m out, jumping off at Speed 100 lands 11.1 m out, and the fast build's steered Jump-spell flight 17.9 m
  out, its apex 7.2 m over the landing. So the landing is at least 6 m deep and walled on its far side and flanks to at
  least 7.5 m: a body that carries too far meets the wall and drops onto the landing;
- **depth never widens a gap or shortens a time.**

### 10.5 THE TIMED SOLVER

In `net/egSpanLaw.js`. SD7a checks distance and SD7b runs the real motor; neither checks time. The generator emits only
what the solver proves, road by road:

- **jumps**: for every consecutive pair, a launch window of at least `EG_WINDOW_MIN` 0.5 s in every 12 s of the clock,
  in which the span build's running jump lands (the motor's closed form, over the platforms' positions at *t*);
- **no queues**: from any moment on a platform, the next launch window opens within `EG_WAIT_MAX` 4 s. Eight members
  waiting at different gaps must still be running, not queueing;
- **the median**: a road's median crossing time, swept over start phases, is at most 1.6 times its fastest;
- **Beats**: a Beat pair's window is the solid time less `SD_BEAT_HALF` plus the flight, 1.05 s at the Steps' 2.4 s.
  That is why the Beat never shortens;
- **Crumbles**: the delay covers the crossing. A 2.6 m platform at the span build's run (5.47 m/s) takes 0.48 s, plus
  0.15 s of slack is 0.63 s, inside the 0.7 s delay;
- **Pendulums**: a gap's lane leaves a window of at least 0.8 s to pass;
- **Vents**: only under platforms at least 4 m across, and a ring leaves the platform's farthest point 1.5 m from its
  edge;
- **Rails**: a Rail's ride ends on a plate it reaches, at the speed the carry gives;
- **ceilings**: inside a fragment, every flight is clamped by its `ceil` (section 11.5);
- **shafts**: a shaft takes at most 15 s at the span build;
- **failure**: a course that fails is drawn again from the next sub-seed, at most 8 times, then laid from the band's
  first two pieces alone.

**The crossing's lower bound** (`EG_CROSS_MIN(spec, road)`) is the solver's fastest crossing at THE FAST BUILD, less
15%, per road. It is a measure in the receipt's `m`, never a door's gate, until EG21 has field data. A bound taken at
the span build would refuse every honest faster player (AUDIT EG II L2-5).

**The sweep.** CI runs SD7b's harness (the real `PlayerMotor` on the real `Collider` over `stepTris` slabs). A course
costs about 182 ms of motor (a falling one 2.5 s), so a pull request runs 25 seeds a band plus every changed golden
spec, and the 500-seed sweep per band runs nightly and before every relay deploy. EG6a sweeps the Galleries' pieces;
each band's slice adds its own.

### 10.6 The toll and the fall

- **The pull's toll**: a member pulled before reaching the end pays 5% of max health for each quarter of their road
  still ahead of their furthest fair point, at most 20%. It is waived for a member who reached a new island, or a
  fragment's node, in their last 15 s: only the idle pay, and trying and falling short costs less than standing
  still.
- **A cast-back**: 10%, never below 25% health (section 8). Featherstep lowers it.

### 10.7 Flight and the air

- **Levitate is banned.** `applyMotorEffectFlags` (`src/scenes/shared.js`) holds Levitate under `levitateWarded()`.
  `registerLevitateWard` keeps ONE function, and registering again replaces it, so the Spire's predicate is OR'd into
  `src/scenes/world.js`'s one registration, beside the siege and the Hour.
- **Slowfall is banned too.** It is not banned in the Hour today: it drifts down at a flat `SLOWFALL_VELOCITY` and
  keeps a run's momentum off an edge, so a Drop would be a glide. EG10 adds the Spire's ban to the same flags write
  (`player.slowFalling`).
- **The Jump spell is allowed**, and it steers. The motor has no air control (`airControl = false`, AcrobatMotor's
  default) except under the Jump spell: `enhancedJumping` restores steering in the air (AUDIT 64 F2,
  `CheckAirControl`). It is a build, and the Steps accept it (*"a Jump spell is a way up too"*), so THE FAST BUILD
  carries it: the Drop's walls, the headroom and the crossing's bound are all taken with it.
- **Technique flights are refused on traversal ground.** A weapon technique's leap or dash (the motor's
  `techniqueLaunch`, called by `src/combat/techniques.js`) flies its own arc at up to `TECHNIQUE_MAX_SPEED` (12 m/s,
  `src/combat/technique/techniqueRoster.js`) toward a target. On a fight
  floor it is a technique; on a span it would be a bridge. The Spire refuses its launch while the member stands on
  traversal ground.
- The staff command `/fly` is exempt.

### 10.8 The shared clock, the ridden poses, the forgiveness

- **The shared clock.** Platforms move on the anchored clock (`anchoredClock`, `deadlandsSeconds`), so every member
  sees every platform in the same place at the same time. A crumble is each member's own, as on the Steps.
- **The shared clock is corrected.** Today a client sets `clockOffsetMs = m.now - Date.now()` from the welcome
  (`src/net/online.js`), so its clock runs late by the welcome's one-way latency. In an `eg:` room the client keeps
  shared time as NTP does: a ping and its answer, half the round trip, the median of five, refreshed every 30 s.
- **RIDDEN POSES.** Peers are drawn 160-550 ms behind their real time, in world space, while platforms move on the
  local clock: a peer on a Drift swinging at 3.1 m/s would float 0.5-1.7 m beside it. So a pose on a moving piece
  carries `pl`, the piece's index, and its offset from that piece's top at the sender's time. A receiver draws
  `stepAt(piece, tDraw) + offset`. The field joins `validPose` (a relay version, EG8). A peer on a crumble the viewer
  has seen fall is drawn on a ghost slab.
- **The forgiveness.** DFU's grounded gate (`GROUNDED_JUMP_GATE_S` 0.1, `src/player/motor.js`) swallows a jump
  pressed just before landing, and the parkour's late press (`PARKOUR_COYOTE_S` 0.15) covers only the running leap.
  Chained Beats and Crumbles would eat presses. In `eg:` halls:
  - a jump pressed up to `EG_JUMP_BUFFER_S` 0.12 s before landing fires on landing;
  - the late press covers a plain jump off any edge, for 0.12 s;
  - both are departures from DFU, listed in the Ledger A row;
  - the solver proves every course without them, so they are margin, never entry.

**The relay judges the end, not the jumps** (section 21).

## 11. The fragments - modelled areas

Mac, 2026-10-11: *"I really want to enhance the experience where sometimes platforms can lead to oblivion caverns, or
different types of modeled areas instead of simple platforms"*.

### 11.1 What a fragment is

A course of platforms alone is a path over the void. The torn halls did not fall as stepping stones: they fell in
**fragments** - whole caverns, collapsed rooms, broken stairs - and a course passes through them. A fragment is a
modelled area with a mouth and an exit, its own floors, walls and ceilings, its own hazard, and room for the legion.
There are three classes:

| class | what | where it stands | blows land |
|---|---|---|---|
| **passage** | a tunnel, a collapsed corridor, a toppled colonnade: entered at its mouth and left at its exit, with ledges, gaps and hazards inside | in place of a span section | on its landings only (its fight floors) |
| **chamber** | a room with one or more flat fight floors inside walls: a magma chamber, a crypt, a pit | in place of a court disc (a Rift-Yard's, a proving court, a lord's ground), or inside a Deepway | yes |
| **shaft** | a vertical fragment: down through ledges and drops | the Low Road's way down, and the Deepway's | no |

**Every platform is dressed too.** The law decides each platform's footprint, and the model fills it exactly: a
toppled column drum in the Galleries, a bone raft in the Cairn, a black-glass shard in the Shade, a slag raft or a
chained anvil in the Wellhead. **The top you see is the top you stand on**: the model's walkable face is the
collider's face, and its rim carries THE EDGE LINE (section 25.3), so a handsome platform never lies about where it
ends.

### 11.2 The library, band by band

Ten fragments. Each has a signature: one thing it asks that no other place asks.

| band | fragment | classes | what it is | its signature (the place's white light) |
|---|---|---|---|---|
| the Broken Galleries | **the Oblivion Caverns** | passage, chamber, shaft | the Deadlands' lava tubes under the torn halls: basalt walls, magma channels cut in the floor, chained bridges over magma, openings onto the burning sky | **magma surges** along a channel (a lane 4 m wide, ringed 1.0 s, 20% fire); **fire falls**, curtains across a passage on a cycle (2 s burning, 3 s out; a white shimmer 1 s before each burns; a touch is 15% fire): a timed traversal hazard, like the Pendulum, never a blow the relay counts; **falling basalt** (a disc r 2.5, 1.2 s) |
| | **the Fallen Stacks** | passage, chamber | an Athenaeum wing fallen on its side: floors become walls, bookcases become platforms, a broken dome becomes a chamber with two balconies | **the cascade**: shelves topple along the passage one after another (lanes 4 m deep, each told 1.2 s, 1.5 s apart); run the gap between the falls |
| | **the Broken Colonnade** | passage | a colonnade toppled across the void: drums as steps, arches to run along | **the rolling drums**: column drums roll along the course on the shared clock at a fixed 2.0 m/s, ridden as Rails, the arches climbed as Risers |
| the Soul Cairn | **the Ossuary** | passage, chamber | the vaults of the dead: ribcage bridges, skull pillars, soul-gem niches where Binders stand | **bone bridges** that crumble (the Crumble's law); **soul-wisps** drifting a fixed path, which tether a member on a fight floor (the Wraith's drain), never on traversal ground, and break at 6 m or after 4 s |
| | **the Mist Stair** | shaft, passage | stairs wound down a pit of mist | **mist surges**: a rising band that hides the depth below a line for 3 s. It never hides footing: edge lines and inner platforms draw over it, and it stops 0.3 m below any landing within one jump |
| the Shade Perilous | **the Gloam Thicket** | passage, chamber, shaft (**the Hollow Trunk**) | a wood of black glass, its branches the platforms, moonbeams the only light | **moon-bound branches**, solid only while a moving moonbeam lies on them (the Beat's law, driven by the beam); the beam's lit branch wears the gold rim (gold on what you stand on means it holds) |
| | **the Eclipse Vault** | chamber | a dark hall crossed by moving shafts of moonlight | **the Eclipse**, a CHECK: every 40 s, everyone outside the moon-shafts takes 30%. The shafts (r 3, walking at a fixed 1.5 m/s) are havens in the haven grammar from 6 s out; the nearest is never more than 20 m away (20/6.975 + 1.5 = 4.4 s, inside the 6 s lead) |
| the Havoc Wellhead | **the Forge Gut** | passage, chamber, shaft (**the Slag Chute**) | Dagon's war-forges: conveyors, molten channels, anvils as platforms | **hammer drops** (a disc r 3, 1.4 s); **conveyors** (Rails); **slag that cools**: a spill is a lane of magma 4 m wide, told 1.2 s (floor 0.79 s), for 6 s, then a platform for 10 s, so the way across exists only after a spill |
| | **the Clan Pit** | chamber | the Wellhead's arena of honourable fights between clans (canon), sunk in basalt, its tiers full of Kyn | **the Honour Horn**: a Kynval steps into a ring (r 6) and calls one member. If that member alone fights him, the tiers throw a Reliquary to every member; if another member enters, the crowd throws fire (Ashfall in the Pit for the hall). At *n* = 1 it is always honourable |
| | **the Oblivion Caverns, deep** | passage, chamber, shaft | the Wellhead's own magma caverns: wider, brighter, the magma higher | **the magma tide**: the low floor floods for 15 s on a 60 s cycle, told 5 s ahead (no point of it more than 24 m from a stair: 24/6.975 + 1.5 = 4.95 s); two fight floors 2.5 m up, on stairs, stay dry, so the fight moves up and down |

Every hazard keeps the wind-up floor, the union floor and THE WIDTH RULE (sections 11.7, 13.2): the surges' and the
shelves' lanes are 4 m (floor 0.79 s), the basalt's disc r 2.5 (floor 0.86 s), the hammer's r 3 (floor 0.94 s).
NOTHING GETS FASTER: depth adds hazards and fragments, never shorter cycles.

### 11.3 The set-piece passages

One a band, at most one a circle, each a normal law record on the shared clock, proven by the solver at the span build
with at least 25% margin. A member it catches is cast forward to its last standing node at the cast-back's cost, never
killed. Each opens with a sting and carries its own short music cue (section 26).

| band | passage | what |
|---|---|---|
| the Galleries | **the Collapsing Tube** | the vault falls behind the company at a fixed 4.0 m/s (the span build runs 5.47) for 60-80 m, ending at an opening onto the burning sky |
| the Cairn | **the Sinking Stair** | each flight sinks into the mist at 0.5 m/s after a foot, each member's own, as a Crumble is |
| the Shade | **the Moon Path** | a beam walks the Thicket at 2.5 m/s, and the branches stand only under it: follow the light |
| the Wellhead | **the Forge Line** | three conveyors through hammer drops into the forge's mouth |

The Brink halls (section 8.9) are built from them.

### 11.4 Where fragments stand

- **In a span** (section 8.2). A span's platforms run up to a fragment's mouth (a cavern opening in a floating rock
  mass, a fallen doorway) and on from its exit, to more platforms or the end plate. How many: in circles 1-2 every
  span carries one passage; in circles 3-10, one or two; deeper, up to three, under the hall's cap of four fragments.
- **THE FORK: the High Road and the Low Road.** From circle 2, every span forks at an island. A plaque there shows each
  road's two icons:
  - **the High Road** stays over the void: harder (more pieces in one section, each at the Steps' own timing) and
    shorter. At its hardest point a cache gives one Reliquary to each member who touches it with a fair trail;
  - **the Low Road** drops into the deep, by a Drop or a shaft, into an Oblivion Caverns passage (or the band's own)
    beneath the course. It is half as long again, with fewer falls and more foes (Lurkers in alcoves, Harriers along
    its graph). Its **Battlemage's niche**, the one niche that heals, heals 15% once a member, holds a Vestige shard for
    each member who reaches it, and is a Memento niche (section 16.5);
  - **each road is its own course**: its own islands, toll and crossing bound. Their graphs join at the sockets'
    nodes. The end plate stands at the Low Road's height, and the High Road reaches it by a Drop;
  - **the door** opens on the first fair arrival by either road. A Low Road member's closing starts at the first Low
    Road arrival, or at the door's opening plus the difference between the two roads' fastest crossings, whichever
    comes first. THE GOLD RUN counts arrivals by either road;
  - the count's 15 counted seconds and THE GOLD RUN run on the door's own closing; the pull comes per road, at each
    road's closing's end (the door frame's `until` and `ul`, section 23);
  - the company may split: the fast and the safe are its choice. The hall's cap of four fragments counts the Low
    Road's.
- **The Deepway** (`deepway`, section 8.8): four fragments end to end.
- **Chambers in other halls**: from circle 2, one Rift-Yard in three stands in a chamber, its rifts set in the walls,
  and one proving court in three is a chamber (the Fallen Stacks' broken dome). The lords fight on modelled ground
  (section 13.3).
- **A chamber is never a disc with walls.** Its record names its `play`, at least one of:
  - a second fight floor 3-4 m up, on two stairs, where Casters stand;
  - a chokepoint: an arch 6 m wide splitting the floor;
  - a moving hazard: the Caverns' channels surging across the floor in thirds every 20 s;
  - an engine (section 11.10).
- **Never**: a fragment in the Athenaeum (the lock is the hall), or two chambers running.

### 11.5 The fragment record - the law half

Every fragment, built in code or authored in Blender, has a **law half** the relay reads and a **mesh half** only the
client draws. The relay has no ARENA2 and never reads a BSA: none of the relay bundle's files does. So it cannot know a
real Daggerfall block's shape, and every fragment is the port's own geometry. Its law is a small, pure, integer record
(section 9):

```
{ id, band, class, variant, play,
  sockets: { in: {x, y, z, yaw, w, h}, out: [{x, y, z, yaw, w, h}, ...] },   // where it joins the course
  floors:  [{ y, poly: [[x, z], ...], fight: bool }],                          // walkable regions; edges are walls
  ramps:   [{ poly, y0, y1 }],                                                 // stairs and slopes: support, not fight
  open:    [[a, b], ...],                                                      // floor edges open to the void
  ceil:    [{ y, poly }],                                                      // headroom; null where open to the sky
  graph:   { nodes: [[x, y, z, r], ...], edges: [[a, b], ...] },               // where the legion walks
  anchors: { rift: [...], caster: [...], lurker: [...], niche: [...], engine: [...], hazard: [...] },
  hazards: [{ kind, shape, size, at, period, windup, pct }],                   // on the shared clock
  course:  [ ... ],                                                            // inner platforms, the Steps' records
  alcoves: [{ at, seal, holds }],                                              // section 11.10
  proof:   { crossFast, crossSlow, moves },                                    // the timed solver's answer
  cost, reverb, lights: [[x, y, z, kind], ...] }
```

- **Sockets** join it to the course. The exit socket faces +Z and the entry -Z, so a hall stays laid along +Z
  (section 8) whatever a fragment does inside; a joined piece's `w` and `h` match the socket's within 0.1 m. A socket
  may change height: that is how a Low Road goes down.
- **Volumes stand apart.** Each fragment's bounding box plus 2 m is disjoint from every other fragment's and from every
  piece's swept box (a Drift's amplitude, a Rail's path, a hanging underside's depth, `SD_ROOT_DEPTH` 22 m). A Low
  Road's vault stands at least 3 m below the lowest underside above it. The generator rejects anything else.
- **Floors** are polygons, each at one height. Those marked `fight` are where blows may land (section 11.7). **Ramps**
  are support for the fair trail (section 21), never fight floors.
- **The graph** is where the legion walks (section 11.7).
- **The course** is the fragment's own platforms (a chasm crossed on ledges), in the Steps' record shape, proven by
  the timed solver like any span (section 10.5).
- **The proof** gives the crossing's bounds (section 10.5).
- It lives in `net/egFragLaw.js`, beside the span law in the relay bundle. A change to a fragment's law is a relay
  version; a change to its mesh is not.

### 11.6 How a fragment is built

Two sources, one record:

1. **Code-built kits** (EG6b first, then each band's). A kit is a generator. `egFragOf(seed, kind, class, budget)`
   emits the law half (pure, and the relay's too), and `buildEgFragModel(law, seed)` the mesh half (the client's).
   An Oblivion Caverns passage, for example:
   - a profile (a flat floor 4-8 m wide, walls and a vault at least 3.5 m clear above it) swept along a seeded path
     that leaves facing +Z;
   - the walls and the vault displaced by noise OUTWARD only, never the floor: blows land on flat ground, and the
     collider's proxy is the inner envelope, so neither the camera nor the body ever sits inside visible rock;
   - features placed by the budget: a magma channel cut in the floor, basalt pillars (collider cylinders), fire
     falls, a chasm crossed on ledges, an opening onto the burning sky;
   - its collider a low-poly PROXY of the floors, the wall planes and the vault (at most 3,000 triangles, a fine cell
     averaging at most 64, the vault at most two quads across), never the visual mesh. This is the
     `realmColliderTris` pattern: the Hour collides on 386 proxy triangles and draws 7,700. A 3,360-triangle passage
     measured 47 triangles a 2 m cell and 133 µs a motor step against the Hour's 84 µs (AUDIT EG II L4-22);
   - pinned: no drawn vertex lies inside the proxy, and headroom is measured on the drawn mesh.
2. **Authored hero fragments** (EG6c, as Mac authors them), modelled in Blender:
   - **the bake**: `tools/fbxMesh.mjs` keeps UVs and normals, but its `bakeMesh` takes exactly one Mesh Geometry, writes
     the Morrowind basis and feeds only the Morrowind lane's NIF bakes (`bakeThunderlock.mjs`, `bakeBrigandine.mjs`,
     `bakeEbonyPlate.mjs`, `bakeSteelPlate.mjs`, `bakeCloak.mjs`); its polygon helpers serve `tools/shipBake.mjs`, which
     reads a scene of many objects in the world frame but drops UVs and normals. The gate, the ships and the wagons bake
     through it, and their model modules lay the art in code. So EG6c builds `fragBake.mjs` (under tools/): shipBake's
     `sceneObjects`, fbxMesh's UV and normal weld, a submesh per material, and the named markers;
   - **the law half**: authored in the same scene as named markers (`floor.*` planes, `floor.fight.*` for fight
     floors, `ramp.*`, `socket.in`, `socket.out.*`, `node.*`, `anchor.*`, `hazard.*`, `light.*`) and baked to a small
     JSON beside the mesh;
   - **each fragment its own bake script and byte-for-byte test**, as every bake in the port has;
   - **each fragment its own `.fbx`**. The gate's 8.6 MB whole-scene source (1,905 meshes) is the warning.

**One kit of mesh tools.** Today every made level carries its own box, extrude and pack helpers (`packFaces` in
`src/world/gate/gateArena.js`, `packRealmFaces` and `quadFacing` in `src/world/superDungeon/sdRealm.js`, `away` in
`src/world/superDungeon/sdIslandModel.js`, `facing` in `src/world/superDungeon/sdHall.js`). The fragments use one shared kit, `world/meshKit.js`:
box, prism, extrude, lathe, sweep, and the pack into `createMesh`'s shape with Uint32 indices, writing straight into
typed arrays so a hall can be built a slice at a time (THE SWAP, section 7). The court and the Hour may move onto it
later; that is not required.

**One registry of pseudo-archives.** The pseudo-archive numbers are scattered constants today: the port's art
archives, 38001-38221, the abyss lab's 38990 (`LAB_ARCHIVE`), and the mods' 112358, 112359 and 112395. They have already
collided once (AUDIT SD IV R6: the large boat moved from 38151 to 38171). EG1 adds `world/pseudoArchives.js`, the one
place every archive is registered, with a test that refuses a collision. The Spire's 38231-38279 (section 25) are
registered there.

**Daggerfall's own fire.** The Oblivion Caverns' fire falls wear Daggerfall's own TEXTURE.356, the Mantellan Crux's
fire walls, read from the player's own ARENA2 at runtime through the data pipeline (`getTexture`), never shipped.
Vanilla Enhanced does not repaint 356. DFU's table (`src/world/emissiveTextures.js`) marks its records 0, 2 and 3
emissive, but DFU lights them through `TextureReader.GetFireWallColors32`, which the port has not ported: so
`src/scenes/dataPipeline.js` skips `FIRE_WALLS_ARCHIVE` at both upload arms, `test/render/audit39_render.test.js` pins the
skip, and 356 draws unlit today. EG6b ports `GetFireWallColors32` (the fire falls are its first consumer) and re-pins
audit39. Everything else is painted in code into the band's archives (section 25).

### 11.7 Fighting in a fragment

- **Fight floors.** Blows land only on flat **fight floors** (`floors[].fight`), each a polygon at one height.
  - Today the telegraph pass (`src/render/gate/gateTelegraph.js`) draws each shape on one plane at one height:
    `TELEGRAPH_LIFT` (0.05 m) over the court frame's origin (`centre`). A shape on a higher ledge hides under it; on a
    lower one it floats.
  - EG6b widens it: each fight floor is triangulated once (a static buffer). For each shape and each floor it touches,
    the floor's triangles are clipped on the CPU to the shape's bounds into one dynamic buffer a frame, and the vertex
    shader reads them at the floor's height plus the lift. At most 32 shape-floor draws a frame, in THE TELEGRAPH
    BUDGET's order (section 25.4).
  - Stairs, slopes, ledges and inner platforms are traversal ground. No lord or add aims a blow at a member standing
    there; only the place's own hazards reach them, each drawn by its own pass on its own surface.
- **Walls bound the escape.** `perilAt` and `wayOut` (`src/scenes/gate/gateCourt.js`) search 24 bearings
  (`PERIL_BEARINGS`) bounded only by a court's circle, straight through walls. In a fragment, the union floor
  (`net/egFloor.js`, section 13.2) and the client's arrow search the fight floor's polygon, whose edges are walls,
  and open edges bound the search like walls: an escape never runs into rock or off the edge.
- **The relay's judge is 2D, per floor.** Today the relay keeps trails as `[t, x, y, z]`, but `_trailOf`
  (`server/src/index.js`) and `posAt`/`posAfter` (`src/net/bossRef.js`) hand the judges `[t, x, z]`. EG3 keeps y. A
  member is on a floor while its polygon holds them and their height lies in [the floor - 0.5 m, the floor + 3.0 m]; the
  floor taken is the highest at or below their height plus 0.5 m. A jumper (Jumping 100 peaks at 1.14 m, the fast
  build at 2.68 m) is still on their floor.
- **THE WIDTH RULE.** `deepIn` (`src/net/bossBody.js`) counts a body only when its point and eight probes at
  `BODY_MARGIN` (1.5 m), on world-fixed bearings, all lie inside the shape.
  - A 3 m lane is counted only on a strip 0-0.23 m wide, and never when it lies along a probe bearing (any multiple of
    45°: every hall-axis lane). A 4 m lane is counted on a strip 1.0-1.2 m wide at every bearing.
  - So every aimed blow is at least **4 m across at its narrowest**: a disc of r 2 or more, a lane 4 m wide, a cone
    whose inscribed circle is 4 m across. A lane's wind-up floor is then 2/6.975 + 0.5 = 0.79 s, and every listed
    wind-up (1.0 s or more) clears it.
  - Widened to 4 m: the Breakers' Charge, the Divers' Dive, the Armsmaster's Lunge, Grath's Gore, the Arcane Lattice,
    the Rampart's vents, and the Warden's Charge (3.5 m) where the Spire throws it. The Armsmaster's Riposte becomes a
    cone of 5 m.
  - Pinned: every shape kind's counted share, swept over bearings, is at least 25%.
- **The legion walks the graph.**
  - Ground kinds walk a fragment's graph from node to node (a search over a dozen nodes), as the Rampart's legion
    walks its line.
  - Harriers hover along the graph, never through rock.
  - Lurkers wait at `anchors.lurker`, Casters stand at `anchors.caster` (raised where the chamber has a second floor),
    and rifts open at `anchors.rift`.
  - Divers dive only in fragments open to the sky.
- **The fragment keeps its own clamp.** Climbing and wall-runs would carry a player up a chamber's walls, and a safe
  perch over the fight would make traversal's immunity a ranged build's fortress. So each floor polygon is extruded to
  its `ceil` (to the motor's arena ring `ceilAbove` where it is open to the sky) as the motor's clamp
  (`player.arena.clamp`), with open edges released. `hit` and `ahit` are accepted only from a pose on a fight floor of
  the current fight, and a member off the fight floors for more than 6 s in a fight is hunted by the Harriers.

### 11.8 Moving through a fragment

- **Headroom.** Every passage keeps at least **3.5 m** clear over its floors, **4.5 m** where it carries an inner
  course (the fast build's 2.68 m apex plus the capsule's 1.8 m), and every chamber **6 m**. The solver clamps flights
  by `ceil` (section 10.5). The third-person cameras collide:
  - the Morrowind body's camera pivot rides 1.77 m up (`FOCAL_HEIGHT` 124 units) and drops at most 0.14 m under a
    ceiling (`FOCAL_OBSTACLE_LIMIT` 10 units, `src/player/mwCamera.js`);
  - the Eye Of The Beholder camera rides 0.5 m over the eye and 2 m behind it, and casts twice its offset upward
    (`checkBounds`, `src/player/eyeOfTheBeholder/eotbCamera.js`), so it wants about 2.7 m for its whole offset.
  - 3.5 m gives both their whole offset with room for a ledge's step. No fragment asks for a crouch.
- **The camera in rock.** In the Spire both cameras pull in at once against a wall and ease back out over 0.25 s,
  never snapping. Occluders between the camera and the body dither out (`setDissolve`). On a shaft's ledge facing a
  drop, the pitch biases 20° down and the camera rises to look over the edge, so the landing is seen, not the back.
- **The collider** takes the proxy (section 11.6) in one bucket per fragment: `addMesh`, then `removeBucket` at the
  hall's end.
- **The clamp** is the fragment's own (section 11.7), never the made levels' analytic clamps (the Hour's
  `realmClamp`, the Burning Court's `courtArena`).
- **Magma is the void.** Falling into magma, a chasm or the mist is a cast-back (section 8), with the place's fire on
  the magma's.
- **The fair trail** (section 21) knows fragments: a pose near a floor's height must lie inside that floor's polygon,
  on a ramp, or on an inner platform's footprint at that time.
- **A reconnect** in traversal resumes at the member's last island or plate, with no cast-back's cost (section 22).

### 11.9 Light, sound and budgets

- **Light.** A fragment's light markers join the hall's list, sorted past the cap by the eye's distance outside each
  light's reach (the Hour's `realmLightsWith`, AUDIT SD III V9), under the renderer's cap (16 in
  `src/render/renderer.js`, `EL_MAX_LIGHTS` 48 in `src/render/enhancedLighting.js`).
  - At most 12 lights stand within 40 m of any point. Fragment lights cast no shadow except two a hall, and the
    point-light caches warm over the 8 s gather instead of in a burst at the wake.
  - Magma glows by emission, never by a light, so the cap is spent on gold (the way) and on the band's own colour.
  - Wherever magma borders a fight floor, its luminance stays at or under 0.45, and a non-emissive basalt kerb 0.6 m
    wide carries the edge line between them. Magma is the band's molten orange; the danger edge is Dagon's red, a hue
    no hall's light shares (THE SPIRE DANGER EDGE, section 25.2).
- **Sound.** The reverb is the hall's, set behind the veil at the swap from its fragments' presets
  (`src/systems/reverbPresets.js`: Cave, 2.91 s, in caverns; Stoneroom in the Stacks and the Ossuary; Quarry in open
  fragments).
  - `audio.setReverb` builds a new ConvolverNode and synthesises its impulse on every call (Cave: 25-41 ms on a
    desktop, AUDIT EG II L4-21), so within a hall the reverb changes only by crossfading two convolvers made at the
    swap, each preset's buffer cached for the breach, over 0.4 s at a mouth with 1 m of hysteresis.
  - `audio.holdReverb(owner)`: while the Spire holds the reverb, Better Ambience (which re-asserts its own preset
    whenever its own wish changes, against its `reverbOn` cache) yields, and its cache is cleared on release. Every exit
    path releases.
- **Budgets.** None are documented for the port today. The Spire's are measured, not guessed: EG6b measures the
  Caverns kit and the Hour on SwiftShader and a reference phone (frame time, GL draws, shadow replays) and fixes the
  budgets before EG13. Its starting bounds:
  - a fragment: at most 12,000 drawn triangles, 3,000 collider triangles, 4 lights and 12 draws;
  - a hall: at most four fragments (a fork's Low Road counted), 50,000 drawn triangles, and no more GL draws than the
    Hour's own frame on the reference phone (its 25 steps stand 79 dynamic draws, 82 GL draws).
- **The moving pieces are instanced.** Every dressed moving platform is its own draw today, so a 28-platform span alone
  would pass the Hour's whole frame. EG6b adds an instanced moving-piece pass: one draw per piece kind, per-instance
  matrices from `stepAt`, no shadow. Crumble chunks and Pendulums count against the budget.
- **The cull.** The dungeon arm reads `d.culled` (`src/scenes/worldModes.js`), and nothing sets it today. EG6b sets
  it from each fragment's and each section's bounds against the frustum. Today the arm skips a culled draw entirely,
  and `renderer.drawMesh` is the shadow record's only path (it takes only `{noShadow}`), so a culled draw would leave
  the record too. EG6b adds a shadow-only draw and changes that line, so a culled draw skips the main pass only and
  is still recorded as a shadow caster, because the point-light caches sign themselves over their records'
  identities, and a draw that left the record would make every lantern redraw on every camera turn. Every moving
  piece and dressed platform is `noShadow`.
- **Freed on every exit**: the swap, the tear, the way home, a fall, forsaking, a void and a reload each free the hall's
  meshes, telegraph buffers and reverb buffers; the band's textures are freed at the breach's end. Pinned: after ten
  halls and every exit kind, the live mesh and texture counts return to baseline.

### 11.10 Engines, alcoves and the Annals

- **Engines.** One relay-run interactable per band kit, worked as an Orrery turn is (`{k:'use', i}`, within 2 m, a
  30 s cooldown). An engine aims at the legion; a member caught takes the place's 20%, ringed white 1.5 s, at least
  4 m across:

  | band | engine | what |
  |---|---|---|
  | the Galleries | **the sluice** (the Caverns) | floods a channel for 6 s; adds in it lose 40% of their health |
  | the Galleries | **the shelf** (the Stacks) | topples once: a lane 4 m wide onto adds, 50% |
  | the Cairn | **the soul-bell** (the Ossuary) | stuns Wraiths and Binders for 4 s |
  | the Shade | **the moon-mirror** (the Gloam) | makes a branch solid for 6 s, or blinds Divers for 4 s |
  | the Wellhead | **the drop-hammer** (the Forge) | a disc of r 3, 50% to adds; once a phase it stuns a lord 2 s |

- **Alcoves.** Zero to two in each passage or chamber, behind a false wall (one blow; a faint gold seam shows within
  4 m) or past an optional hard jump. Each holds lumen, a Vestige shard or a page of the Annals. Witnesses see them
  (section 16.5).
- **The Annals of 3E 398.** Thirty pages, each two sentences, kept in the account's service bits
  (`players.eg_annals`), readable at a Redoubt and in the journal: a Battlemage's last note, the Secretary's
  surrender, the apprentice's passage. A lord's first fall adds a page.
- **Vignettes.** Each kit places one to three: a Battlemage dead at a barricade, a Kyn shrine, a rack of broken staves.
  The lore of section 3 is told by the halls, not only by this page.

## 12. The legion - relentless adds

**One wave runner, widened from the gate's.** In `src/net/gate/gateBrain.js`, the private `stepHost` runs the
Legion-Lord's three kinds, tied to the gate's phase, court and trial.

- **EG8 lifts their law** into `net/egHost.js`: a runner driven by a hall's geometry (a court's rim, a rift's place, a
  walkway's line, a fragment's graph, a span's islands).
- **EG8 exports the shared pieces** it needs (`rimSpots`, the spacing law) from the gate's brain, beside the already
  exported `hostTeamHpFor`, and imports them. The gate's `stepHost` stays, its frames and pins unchanged. This is
  SERPENT1's rule again: widen a seam whose default is the gate's own bytes.

**The kinds.** Bodies are Daggerfall's own mobiles (`MOBILE_TYPES` in `src/characters/mobile/mobileTypes.js`), so every player
can draw them. A Morrowind body (`CREATURE_MATCH` in `src/characters/creatureBodies.js`) re-skins one where the
player's data and the budget allow. Every blow is a shape the telegraph pass draws, every wind-up keeps its floor
(section 13.2), and every shape is at least 4 m across (THE WIDTH RULE, section 11.7). Floors are ceiled to 10 ms.

| id | kind | does | bodies (band) | body | move | its blow (wind-up / floor) |
|---|---|---|---|---|---|---|
| 0 | **Harrier** | runs at the living member farthest from its anchor (in a Court, from the lord, as the gate's runs from the Warden; elsewhere, from itself), hovering; on a span it bites only on islands and plates | Imp (1); Giant Bat (3) in the Shade | r 0.5, h 1.5 | 5.0 m/s | Bite: disc r 2, 12% + 4 (0.9 s / 0.79 s) |
| 1 | **Sapper** | walks to its OBJECTIVE: a Court's lord (heals it, the gate's law), a Yard's nearest closed rift (opens it again at a third), or a Wellspring's broken anchor | the Atronachs (35, 37, 38) | r 0.7, h 2.3 | 1.6 m/s | none: it is the objective |
| 2 | **Ward-Bearer** | stands and pulses, holding a ward on what it guards (a lord, a portcullis) | Frost Daedra (25); Daedra Seducer (29) in the Shade | r 0.6, h 2.2 | stands | Pulse: disc r 3.5, 18% + 6 of the band's element (1.4 s / 1.01 s) |
| 3 | **Breaker** | winds a charge at a member, runs it, pushes | Daedroth (27) | r 0.8, h 2.4 | 3.0 m/s; the charge 12 m/s | Charge: lane w 4 x 14, 25% + 8, push 6 m (1.1 s / 0.79 s) |
| 4 | **Caster** | stands off 10-18 m, on a raised anchor where the hall has one, and throws at a member every 6-9 s | Fire Daedra (26); Lich (32) in the Cairn | r 0.6, h 2.2 | 2.0 m/s | Bolt: disc r 3 at the member's feet, 20% + 6, the element, leaving a pool (`POOLS` hellfire's) (1.6 s / 0.94 s) |
| 5 | **Diver** | flies at 6-10 m, circles, dives a lane at a member; never onto ground narrower than the lane plus 2 m (6 m) | Harpy (13), Dragonling (34) | r 0.6 | 6.0 m/s | Dive: lane w 4 x 10, 18% + 5 (1.0 s / 0.79 s) |
| 6 | **Lurker** | dormant until a member passes within 6 m (an ambush), then slow and heavy | Gargoyle (22); Iron Atronach (36) in the Wellhead | r 0.9, h 2.6 | 2.2 m/s | Smash: disc r 3, 30% + 10 (1.3 s / 0.94 s) |
| 7 | **Binder** | stands back and raises the last fallen add of its wave once, a 6 s cast broken by a blow worth a tenth of its health | Ancient Lich (33) | r 0.6, h 2.2 | 1.2 m/s | none: the raise |
| 8 | **Wraith** | drifts in and tethers the nearest member on a fight floor: 3% of max health a second while within 8 m, broken by putting 10 m between | Wraith (23), Ghost (18) | r 0.5 | 2.5 m/s | Drain: a tether (the pull-apart grammar, section 25.5) |

**ROLE READS.** Kill priority in every horde mode is read from silhouette, so among the legion's kinds one sprite never
plays two roles in a band, and every role also carries a mark that is not a colour (a lord that shares an add's
sprite is told apart by its scale of 2.5 or more and the boss ring):

- the Ward-Bearer stands at 1.15 scale with a ward ring at its feet;
- the Caster flares its hand 0.4 s before each Bolt;
- the Binder draws a violet beam to the body it raises, with a bar for its 6 s cast;
- the Sapper walks at 1.1 scale over dashes that show its path;
- the Lurker, dormant, keeps no rim light: a statue's pose, dust, and a low grind within 10 m. Waking, it rises over
  0.6 s and its rim light comes up before its wind-up begins. *Something stirs.*, once a hall;
- a lord stands at 2.5 times or more, always with the boss mark ring.

**The push** is a new blow effect, applied by the struck client as the Steps' gust is (`collider.move`, capped per
frame), and resisted by the Iron Footing Vestige. Near an edge it is a cast-back.

**Health and the waves.**

- **Health**: a kind's health is seconds of reference damage, as the gate's are (the Harrier's `HARRIER_S`, 3 s of the
  hall's mean reference damage). It is shared over a wave where the kind is a team's, through `hostTeamHpFor`, and
  scaled by the depth `x (1 + 0.04(c-1))`.
- **Size**: a wave counts the living company, as the gate's do, clamped by kind.
- **Cadence and cap**: the hall's (section 8.1), the cadence quickening with depth (section 18).
- **Targets**: an absent body is never chosen (section 6.1).

**Unlocks by band**:

- Galleries: kinds 0, 1, 2, 3, 4, 6;
- Cairn: + 7, 8;
- Shade: + 5;
- Wellhead: all of them, with a Daedra Lord (31) as an elite add (x5 health, the Warden's Cleave, never under its
  floor) one wave in six.

**Pure, and the relay's.** The runner's dice are the tick's rng (the relay's CSPRNG), as every brain's are.

- **Frames out**: the Legion-Lord's: `ad` (a wave risen), `amv` (the walks), `aatk` (a blow), `ah` (a health), `adie`
  (gone).
- **Frames in**: blows on adds arrive as `ahit` through `applyHostHit`'s hand and purse.

A hall with no legion draws no dice.

## 13. The lords - the bosses

### 13.1 One seam for every boss

The relay hosts three bosses today, each by hand:

- `_gateTick`, `_gateFrame`, `_gateFall`;
- `_sdFightTick`, `_sdFightFrame`, `_sdFightFall`;
- the serpent's.

A realm holds ONE fight (`this._sdFight`). The Spire needs a different lord every fifth hall, so EG3 builds **one boss
seam** (`net/bossSeam.js`). It is the shape every brain already keeps by convention, made a contract:

```
new(profile, rng)            join(f, sub, name, lv, now, present)      hit(f, sub, d, r, pose, now, seq)
step(f, now, bodies, rng) -> frames[]      stateOf(f)      judge(f, blow, trails) -> [{sub, share}]      earned(f, sub)
```

The gate, the Remnant and the serpent are re-plugged into it with their pins unchanged and their frames byte for
byte. The Spire's lords are written to it. The gate's brain already exports the hand and the purse (`spendBlow`,
`spendPurse`), the share's retirement for absence (`retireShare`/`restoreShare`), the seat (`freeSeat`), the chart
(`damageChart`) and the choice of blow (`chooseAttack`), and the Remnant imports them.

### 13.2 The law every lord keeps

- **Health**: `ttkRef(c)` seconds of reference damage per fighter (`dpsRef(lv)`, the gate's level claim), added as the
  gate adds its fighters. `ttkRef(c) = 180 x 1.07^(c-1)` to circle 20, then `x 1.03` a circle (`EG_TTK_S`,
  `EG_TTK_GROWTH`, `EG_TTK_GROWTH_DEEP`).
- **A fall retires a share, which is new.** Both the gate and the Remnant call `retireShare` only for absence
  (`ABSENT_RETIRE_MS`), and the Remnant restores the share of every body in its arena, alive or fallen. The Spire
  retires a fallen member's share at the fall and restores it at the recall; its seen-and-restore step skips the
  fallen, or the next tick would restore the share. Seven members never face a lord sized for eight.
- **The bucket**: the gate's (`BUCKET_RATE_X` 3, `BUCKET_DEPTH_X` 15, `HIT_CAP_X` 12), each member's times their
  Vestiges' factors (section 15): the client-declared at most 1.25, the relay-established at most 1.6, and **together
  at most `EG_BUCKET_ALL_MAX` 1.6**.
- **Blows**: shares of the struck member's own maximum health, resolved on the struck member's machine (co-op's law).
  Depth adds 2% a circle; depth and fury together multiply a share by at most **1.5** (`EG_SHARE_X_MAX`), reached at
  circle 26.
- **Phases**: at the gate's `PHASE_AT` (0.66, 0.33) unless the lord says otherwise, each turn shielded `SHIELD_MS`
  (3 s). Each phase adds a mechanic and never a faster one. A signature errand starts at its phase's turn: the shield
  holds until the errand is called, and blows past the next threshold are refused until it resolves, so a strong
  company cannot burn past what makes a lord itself.
- **Targeting**: the gate's. 60% to the top of threat (`THREAT_PICK`) and 40% to a random living member, threat
  forgetting `THREAT_DECAY` a second. An absent body is never chosen.
- **FURY**, the endless lord's answer to a slow company. At `EG_FURY_RATIO` (1.5) x `ttkRef(c)` seconds into the
  fight (so a company at reference damage, at 80% uptime, finishes before it), a lord turns to fury: *Grath rages.*
  Every 30 s after:
  - it raises one wave of its band's legion;
  - its shares grow by a tenth, within the 1.5 cap;
  - from the second step, its aimed blows chain a second shape. The second shape's dim outline appears with the first
    shape's (the gate's "dim outline at once" grammar); its fill starts when the first lands and lasts `max(the blow's
    own wind-up, its wind-up floor + 0.3 s, 1.0 s)`, so a chained shape never counts down faster than the same blow
    alone.
  - Fury NEVER shortens a wind-up (NOTHING GETS FASTER; Mac, WBX: *"I dont think making mechanics faster is the
    play"*). It makes a slow fight crowded and costly, not unreadable.
- **THE WIND-UP FLOOR** holds for every blow of every lord and add, under every phase, decree and fury:
  - `windup >= escapeS(shape) + EG_REACT_S (0.5)`, where `escapeS` is the farthest interior point's distance to the
    shape's edge over the escape build's run (6.975 m/s), ceiled to 10 ms;
  - a disc's farthest point is its radius away; a lane's is half its width; a ring's, half its band; a cone's, its
    inscribed radius;
  - the floor CLAMPS: it lengthens a wind-up and never refuses a blow;
  - what the gate ships does not all keep it. The Warden's third-phase Slam (disc r 7, 1.6 s x `PHASE3_WINDUP` 0.8 =
    1.28 s) has a floor of 1.51 s at the escape build, and Colossal's (r 8.5) one of 1.72 s; the third-phase Crushing
    Leap (disc r 6, 1.2 s) has one of 1.37 s. In the Spire the gate's `PHASE3_WINDUP` is not applied: every blow
    keeps its own wind-up in every phase (each phase adds a mechanic, never a faster one), so the Valkynaz's Cleave,
    Slam and Meteor stand at the gate's phase-1 wind-ups, at or above their floors;
  - the 0.5 s slack is a human's reaction plus a one-way latency. A smaller slack, like the gate's 0.35, is fine where
    a death is cheap, but not in a long one-life run.
- **THE UNION FLOOR**, judged in time. Each shape being escapable alone is not enough: a Breaker's lane, a Bolt and a
  Slam together can trap a member, and a sequenced blow (the Lattice, Chained Blows, a fury chain, Twin Charge) is a
  trap only in time.
  - Every tick, the relay sorts the shapes pending on each member by when they land. A set of 1 m cells over the
    member's fight floor starts at the cells they can reach before the first landing; between landings it dilates by
    the escape build's speed times the gap less `EG_REACT_S`, and at each landing it loses that shape's cells. Walls
    and open edges bound it. A new blow is held only if it would empty the set.
  - A held blow waits a tick (250 ms), at most four ticks, then is dropped. A blow held after its `tell` went out sends
    `{k:'untell', i}`, so no ghost outline stays on the floor.
  - Pendulums, vents and the place's hazards are tested in the same set.
  - The search lives in `net/egFloor.js` (section 9), the client's arrow beside it, both over the fight floor's polygon.
  - Pinned: the Arcane Lattice and Chained Blows are passable at *n* = 1.
- **THE WIDTH RULE** (section 11.7): every aimed blow is at least 4 m across at its narrowest, or the relay's census
  could never see it.
- **THE CHECK CLASS.** A whole-court blow (no edge to run to), a haven blow, or an errand's failure blow is a CHECK
  (the Covenant's Weight, section 18, is the one CHECK without a feasibility pin: it is a fight's end, not an errand):
  - its wind-up and its damage are fixed: no phase, fury, decree or depth shortens or raises them;
  - it carries its own feasibility pin for *n* = 1 to 8 (THE ERRAND FLOOR, below), which a haven's route obeys too;
  - the gate exempts its own the same way (`isDagons`, `windupOf`).
- **THE ERRAND FLOOR** (pinned beside the wind-up floor):
  - an errand that needs *k* bodies needs `min(k, n)`;
  - its window is at least a lone runner's route at the escape build plus 1.5 s;
  - CI solves every lord's errands for *n* = 1 to 8, as the span solver solves spans;
  - a party of one is a company, and the Alone board is real (section 20).
- **Errands by numeral.** The relay gives every errand to the nearest unassigned living member and draws it with their
  numeral (*III - Mira* on rune III). An errand for two groups splits the numerals at `ceil(n/2)` (the Twins' courts
  from *n* = 3, the Cairn-Keeper's gems). Eight strangers with text chat need to know who stands where without a word.
- **Tells only the engine can give.** What lands is what the ground shows, and EVERY real blow glints with its WIND
  cue (the gate's wind-up sound, `World-Bosses.md` WB13d). A feint follows Feud-Arc section 7.3 exactly: its mark
  fills to `FEINT_AT` (0.55), is cut, and fades out dashed over 0.15 s, with no glint and no WIND. The lord's `atk`
  frame carries no feint flag: the relay sends `{k:'cut', i}` at `FEINT_AT`, so a modified client cannot read the
  feint early. No tell depends on a shadow, which a billboard and a phone cannot promise.
- **The beats.** Every lord wakes with its card (its name and epithet), turns each phase with the gate's phase card
  (the numeral, the phase's name, one order: *The bridges burn.*), and falls with the gate's fall beats (WB13e), then
  the damage chart (section 27.6).
- **Marks on members.** A lord's mark on a member (the Scent, a soul-mark, Fire-touched, a chain, the cage) shows as a
  chip with a radial timer beside their vitals and a sigil over their head that the company sees, always in Dagon's
  red with its own shape (section 25.5). The marked member hears the personal sting and reads one order: *Hunted -
  run!*, *Lay your soul in a gem!*, *Strike Isk!*

### 13.3 The roster

`egBossOf(seed, c)` draws a Court's lord:

- **the pool**: the band's own lords at weight 2, plus every earlier band's at weight 1, re-aspected;
- **no repeat**: never one of the last `min(2, pool - 1)` Courts';
- **the Valkynaz**: every fifth Court (Halls 25, 50, 75, 100...) is a Valkynaz's, outside the draw, and its fall takes
  a Valkynaz Redoubt;
- **THE SEAL**: until a band ships, its predecessor's Valkynaz Redoubt ends the breach as a victory: *The way down is
  sealed. The Galleries are yours.* Everyone living is sent home holding their Reliquaries, and the Descent ranks
  those runs by the fewest seconds to that last Redoubt. The seal lifts with each band's slice, and the herald says so.
  An endless mode never launches as a loop of one band.

Bodies are Daggerfall's, drawn large, as Ruhn is (`BOSS_LOOKS` in `src/world/gate/gateBoss.js`: a mobile and a scale). Each
lord's errand rules are given for *n* = 1, and its numbers keep the floors.

#### The Broken Galleries

1. **Grath, the Hound** (`hound`; Daedroth 27, x3), loosed from the Wellhead's arena to hold the Galleries. The Court
   is an Oblivion Caverns magma chamber (section 11): three basalt islands (r 11) joined by bridges 6 m wide over the
   magma, all fight floors. No lane is ever laid along a bridge.
   - It bounds from island to island (the Warden's Leap). The island it leaves cracks, told 3.7 s (the wind-up floor's
     class: the escape to a bridge is at most 22 m, 3.66 s), and falls for 15 s. A cast-back from a fallen island
     lands on a standing one.
   - Gore: a lane 4 m wide and 18 m long, 1.3 s (floor 0.79 s), push 6 m.
   - Savage: a cone, 7 m, 110°, 1.2 s (floor 0.96 s).
   - **The Scent**: a mark on one member, who is hunted for 8 s at 5.2 m/s, under every build's run (the span build's
     is 5.47). A catch is a **Maul** (a disc of r 3, 1.2 s, 35%). Leading Grath onto a burning bridge or a cracking
     island leaves him **Scorched**: stunned 4 s, taking x1.3. *n* = 1: no Scent; it gores twice as often instead.
   - Phase 2, *the bridges burn*: the bridges burn by turns, the place's own fire and not an aimed lane: a bridge (at
     most 24 m long) is told 3.0 s and burns for 12 s; the escape runs along it to an island (12/6.975 + 0.5 = 2.23 s).
     Phase 3, *the pack*: two Scents at once (when *n* ≥ 3).
   - *A fight about ground.*
2. **The Last Spellmaster** (`spellmaster`; Ancient Lich 33, x2.5): the Spire's master of spells, raised by the Kyn.
   - **Havens**: two to four gold discs (r 3) at radius 13 of the court; everywhere else takes the Haven Nova, 60%. The
     gate's dodge, turned inside out. A CHECK, so its wind-up is THE ERRAND FLOOR's: the longest route to the nearest
     haven plus 1.5 s, which is 5.3 s for two havens (26.1 m), 4.3 s for three (19.5 m) and 3.9 s for four (16.2 m).
   - **Arcane Lattice**: parallel lanes 4 m wide, swept across the court in sequence (the LANES shape; 1.4 s each,
     floor 0.79 s).
   - **Mirror Images**: three images whose blows are feints under Feud's grammar. A blow shatters an image.
   - **Blink**: across the court.
   - Phase 2, **the Examination**: runes light on the rim in an order shown above him, with numerals I-IV and a chime
     each.
     - Each lit rune must be stood on, in the shown order, by a member. With fewer members than runes, one member
       stands several in turn.
     - Runes: `min(4, max(2, n))`. When *n* is under the rune count, the runes stand on a ring of r 8.
     - The window: `10 + 4 x max(0, runes - n)` s, pinned by the errand solver. On the rim the longest route is 52 m:
       7.5 s at the escape build, 9.0 s with THE ERRAND FLOOR's 1.5 s.
     - Failed: 60% to all (a CHECK). Passed: he is stunned 8 s and takes x1.5 (the crystals' law, `STUN_MS`,
       `STUN_HIT_X`).
   - Phase 3, **the Final Examination**: he binds a member in a cage for 8 s. The company breaks `clamp(n-1, 1, 3)`
     seals, and the bound member may shoot seals from inside. *n* = 1: no bind; three seals rise within 6 m, 8 s to
     break them. Failed: 70% to the bound (a CHECK; never Dagon's Wrath's 999%, `World-Bosses.md`).
   - *A fight about reading.*
3. **The Last Armsmaster** (`armsmaster`; Skeletal Warrior 15, x2.6): the Spire's master of arms, raised.
   - **The Challenge**: he marks a member, and a ring of fire (r 6) rises around the two. This is the duel's own ring
     law (DUEL1's `_keepInArena`, `clampToRing`).
     - The challenged must last 15 s or deal a tenth of his health inside it.
     - Outside, the company breaks the ring's `clamp(n - challenged, 1, 3)` braziers (each 4 s of the company's
       reference damage) to open it early, while the legion presses.
     - *n* = 1: no ring; he duels in the open with his whole kit.
   - **Riposte**: a cone (5 m, 90°) that answers a blow landed in the 0.6 s after his guard rises, 0.9 s (floor
     0.80 s). The tell: his blade raised, glinting.
   - **Lunge**: a lane 4 m wide and 10 m long, 1.0 s (floor 0.79 s). **Whirl**: a disc of r 4, 1.3 s (floor 1.08 s).
   - Phase 2, *the second challenge*: two Challenges at once (when *n* ≥ 4).
   - Phase 3, **the Last Lesson**: the court's edge closes 1 m every 6 s, to r 12.
   - *A fight about the duel.*
4. **Valkynaz Ilthys of the Galleries**: Redoubt 5 (section 13.4).

#### The Soul Cairn

5. **The Cairn-Keeper** (`cairnkeeper`; Lich 32, x3), in an Ossuary crypt (r 14).
   - **The Soul Tithe**: every 25 s each member takes a soul-mark. It must be laid in one of four soul-gems on the rim
     (stand 1.5 s) within 9 s. An unfilled gem is never farther than the crypt is wide (28 m: 28/6.975 + 1.5 + 1.5 =
     7.02 s). Otherwise it bursts: 30%, and a Wraith rises.
   - Each gem holds *n* souls, so there are four tithes at any *n*. When all four gems are full he is laid bare:
     stunned 8 s, x1.5.
   - Phase 2, **the Cracked Gem**: one gem shatters, and the other three share its souls: `4n` between them, as
     even as whole souls allow, so there are still four tithes.
   - Phase 3, **the Double Tithe**: two marks a member at each tithe when *n* ≥ 2, and a burst raises two Wraiths.
   - Wraiths drain.
   - *A fight about eight people's errands.*
6. **The Twin Lords, Vael of the Fire Clan and Isk of the Frost Clan** (`twins`; Fire Daedra 26 and Frost Daedra 25,
   x2.6 each), rival clans. Two courts (r 14) joined by a walkway 6 m wide.
   - They must fall within 15 s of each other, or the survivor raises the other at half (the Echoes' law,
     `SD_ECHO_PAIR_MS`).
   - **Fire-touched and Frost-touched**: a member struck by Vael is Fire-touched for 12 s. They deal +25% to Isk and
     take +25% from Vael. The reverse holds for Isk.
   - **The Crossing**: every 60 s they cross the walkway (at most 24 m long) and change courts. The walkway is struck
     along its length, 3.0 s; the escape runs along it to either court (floor 12/6.975 + 0.5 = 2.23 s).
   - Phase 2, **Rivalry**: the healthier twin's shares rise by a tenth until the two stand within a tenth of each
     other's health.
   - Phase 3, **Both Courts Burn**: the third of each court nearest the walkway becomes the other twin's pool for the
     rest of the fight, told 3.0 s (its deepest point is 10.3 m from safe ground: floor 1.98 s).
   - *n* ≤ 2: they share one court, with a 20 s window.
   - *A fight about splitting the company.*
7. **Valkynaz Morvayn of the Cairn**: Redoubt 10.

#### The Shade Perilous

8. **The Mother of Dusk** (`dusk`; Daedra Seducer 29, x3, winged; Morrowind's Winged Twilight, which flies). Dagon
   gave her kind its wings. She circles over a Gloam glade open to the sky, beyond the court and out of a blade's reach.
   - Dives (lanes 4 m wide; never onto ground narrower than 6 m) and Hellfire.
   - **Three anchors** hold her to the rim. They are bodies a blade strikes, each 6 s of the company's reference
     damage. With all three broken she is dragged down and grounded for 30 s, x1.3.
   - **Gutterdark**: the braziers gutter in turn. The floor goes dark; telegraphs keep their light (section 25.6), and
     every foe keeps a rim light.
   - Phase 2, **Wingbeat**: a glade-wide gust every 8 s, told 1 s, 3 m/s for 1 s (the Steps' gust).
   - Phase 3, **Moonfall**: the anchors rise again 40 s after a grounding, two Divers with each.
   - *A fight about the air.*
9. **The Night-Stalker** (`stalker`; Vampire Ancient 30, x2.5).
   - He vanishes. Where he stands is drawn as an umbral disc on the floor, the telegraph pass's mark kind.
   - **Blood Tether** on two members, broken by standing 14 m apart for 2 s; it heals him (the pull-apart grammar).
     *n* = 1: it binds a Blood Thrall (a Harrier body) 4 m away; kill it or put 14 m between.
   - Bat swarms: Harriers as Giant Bats.
   - Phase 2, **Three Shadows**: three umbral discs; the true one glints with his WIND.
   - Phase 3, **Blood Moon**: tethers on three members, broken at 16 m.
   - *A fight about distance.*
10. **Valkynaz Seyth of the Shade**: Redoubt 15.

#### The Havoc Wellhead

11. **The Bound Colossus** (`colossus`; Iron Atronach 36, x4): the Battlemages' war-engine, Dagon's now.
    - It walks a fixed route down the Forge Gut's long forge chamber (55 m), stamping lanes 4 m wide and 12 m long ahead
      of it (1.4 s; floor 0.79 s).
    - Its vent-hearts, `4 + 2·floor(n/3)` (4 to 8, always even), are on its back, in pairs within 6 m of each other.
      **Rails rise along its flank every 15 s** (`carryBy`) and carry members up to them: the Spire's own platforming,
      inside the fight.
    - Break every heart before its Overload (every 75 s; 70% to all, a CHECK) and it is stunned 8 s, x1.5.
    - Chain lightning: a disc of r 2.5 on a member (1.2 s; floor 0.86 s) that leaps to the nearest member within 6 m.
      Spread.
    - Phase 2, **Paired Hearts**: the two hearts of a pair must break within 5 s of each other, or both relight. One
      member breaks a pair alone in time (6/6.975 + 1.5 = 2.37 s).
    - Phase 3, **Breakdown**: it kneels for 20 s at x1.5, then walks half its route.
    - *A fight you climb.*
12. **The Wellhead Wyrm** (`wyrm`; Dragonling 34, x5, flying).
    - In an open-sky cavern, it perches on three pillars, breathing lanes (4 m x 16 m, 1.4 s; floor 0.79 s) and cones
      (10 m, 90°, 1.5 s; floor 1.10 s); it takes flight and drops meteors (discs of r 4, 1.8 s; floor 1.08 s).
    - Each pillar is reached by a side span and broken from on top. With its perch broken it lands, x1.3, for 25 s,
      until it finds another.
    - Phase 2, **Burning Perches**: the pillar it leaves erupts (a disc of r 6, 2.0 s; floor 1.37 s).
    - Phase 3, **Grounded**: no perch; a breath of 180° and 12 m (inscribed r 6; floor 1.37 s; wind-up 1.6 s).
    - *A fight for every build.*
13. **Valkynaz Garoth of the Wellhead**: Redoubt 20, and every fifth after.

### 13.4 The Valkynaz

ONE brain (`net/egLord.js`) with a signature for each Valkynaz. Each fights on its band's own ground, with three of
the gate's blows (Cleave, Slam and the Meteor from `ATTACKS`, at the depth's shares, each lengthened to its floor), two
of its own, its signature, and a third-phase set-piece. Each wears its own look (`BOSS_LOOKS`: Daedra Lord 31 at 3.0,
3.3, 3.6 and 4.0, tinted by band) and its own WIND set. The deepest boss of the endless mode is never the commonest
fight of the game again.

| Valkynaz | Redoubt | aspect (`GATE_ASPECTS`) | ground | its own blows | signature | phase 3 |
|---|---|---|---|---|---|---|
| **Ilthys of the Galleries** | 5 | Burning | **the Council Rotunda**: a floor of r 24 and three balconies 4 m up, two stairs each | **Spear of the Conquest** (a lane 4 m x 22 m, 1.3 s); **the Muster-Call** (a wave from the balconies) | **the Conquest**: he plants a banner (a Ward-Bearer body) on each balcony that claims a third of the floor. Claimed ground burns (a pool, told 3.5 s: the longest way off a third of the floor is 20.8 m) until its banner is broken, and while two banners stand they hold his ward (25 s at most) | **the Last Charge**: a third of the floor falls every 20 s, told 5 s ahead, and rises again when the next falls |
| **Morvayn of the Cairn** | 10 | Venom-Blooded | **the Soul-Bridge**: two Ossuary crypts (r 14) joined by a rib bridge 30 m long | **Venom Lash** (a cone 8 m, 90°, 1.3 s); **Soul Rend** (a disc of r 4 on a chained pair's midpoint, 1.5 s) | **the Chaining**: pairs of members are bound by soul-chains for 20 s (the stay-close grammar). A pair stretched past 8 m both take 30% (a CHECK), and a blow on one is shared with the other. An odd member, or a member alone, is chained to a Wraith; kill it to break the chain | **the Last Rites**: Wraiths rise at both crypts every 20 s, and chains bind threes |
| **Seyth of the Shade** | 15 | Rime-Wrought | **the Eclipse Vault** (section 11.2), the Eclipse running | **Frost Lance** (a lane 4 m x 18 m, 1.2 s); **Moonshatter** (three discs of r 2.5 at members' feet, 1.4 s) | **the Mirrorcourt**: two mirror lords fight beside him and throw real blows at half share. Only the true lord casts his ground mark and his bar's pip; the mirrors shimmer (a 2 Hz dither line) and crack audibly when struck. A mirror shatters after 8 s of the company's reference damage and returns 20 s later | **the Long Night**: Gutterdark over the whole vault, while the moon-shafts walk at a fixed 1.5 m/s |
| **Garoth of the Wellhead** | 20, 25, 30... | each of the four in turn | **the Clan Pit** (section 11.2) | **Wellfire** (two lanes 4 m wide crossing at his feet, 1.4 s); **the Kyn's Due** (a disc of r 5 on the top of threat, 1.6 s) | **the Clan Muster**: each phase turn calls an honour duel (one member, the Armsmaster's ring law, r 6, 15 s; none at *n* = 1) | one of the three older signatures, by turns from one Garoth Redoubt to the next, under the next aspect, with every decree the circle bears |

A Valkynaz's Redoubt rolls its spoils twice and may give a key (sections 5, 19). The first Valkynaz a company fells is
its first true feat in the Spire.

## 14. Decrees - what deepens a circle

At each Redoubt the next circle's **decrees** are chosen and shown on the beacon: *The next circle bears: Gale-Swept,
Hunting Pack.* With them the beacon names the next lord: *The next Court: Grath, the Hound.* The company knows what is
coming before it chooses to go on.

- **How many**: circle 1, none. From circle 2, `min(4, 1 + floor((c-2)/2))`.
- **One per family**: never two from one of the five families, so a company can track every one. Dagon's Bargain
  (section 8.7) may add one more for its circle, from a free family.
- **Standing decrees.** The week's Proclamation (section 20) and a Wager's decrees (section 18) stand for the whole
  breach and hold their families: a circle's drawn decrees, and a Bargain's, come only from the families they leave
  free, and a Wager's three come from three different families. So a circle bears at most nine (four drawn, a
  Bargain's, the Proclamation and three wagered), and the frames carry nine under their own validator.
- **The company chooses.** For each family the circle draws, the beacon offers two of its decrees, and the company's
  word (section 16.4) takes one; a tie takes the first shown. Dagon chooses which families; the company chooses how
  it suffers them.
- **Ranks**: from circle 10, one decree a circle ranks up to II instead (the table's last column).
- **Tides and strata**: past circle 20, the Wellhead's tide joins them, and from Redoubt 20 its strata (section 18).

Every decree but the lord family's changes what a member does or sees; the lord family's are named on the lord's
card.

| family | decree | what | at rank II |
|---|---|---|---|
| **blows** | **Chained Blows** | the legion's blows chain a second shape, its outline shown with the first's, filling as the first lands and landing `max(the blow's own wind-up, its floor + 0.3 s, 1.0 s)` later | a third shape after the second |
| | **Twin Charge** | a Breaker's charge is followed by a second lane, its outline shown with the first's, landing 1.2 s after the first | a third lane, 1.2 s after the second |
| | **Pyre-Bound** | a slain add bursts: a disc of r 2.5, 1.0 s (floor 0.86 s), 10% | a disc of r 3.5, 1.2 s (floor 1.01 s), 15% |
| | **Vengeful Shades** | a slain add's shade follows its slayer at 3 m/s for 6 s, then bursts: a disc of r 2, 1.0 s (floor 0.79 s), 10% | 15% |
| **legion** | **Hunting Pack** | Harriers on every hall, a wave every 30 s | a wave every 20 s |
| | **Swarm-Mother** | every wave carries a Binder (from the Cairn) | two Binders |
| | **Kyn's Vigil** | every hall's trial begins with the band's champion on the arrival plate | with its escort doubled |
| | **Kyn's Rally** | a slain add gives its wave's living +10% health, up to three stacks, shown as pips over them | +15% a stack |
| | **Soul-Pools** | a slain add leaves a pool (r 2.5) for 8 s that heals adds 3% a second unless a member stands in it | r 3.5 |
| **ground** | **Ashfall** | fire falls on court discs: a meteor's disc every 12 s | every 8 s |
| | **Gale-Swept** | every span (a Span's, a Proving Walk's) carries a Gust section (from the Cairn) | two Gust sections |
| | **Crumbling Halls** | every span carries a Crumble section, and has one island fewer | two Crumble sections, two islands fewer |
| | **Wellhead Sparks** | every 20 s, `ceil(n/2)` sparks rise, each felled by one blow; any left after 8 s bursts (a disc of r 2.5, 1.2 s, 15%) | `n` sparks |
| **the Covenant** | **The Covenant's Press** | the next Redoubt adds 10 minutes, not 15; the count's chip says so (*+10:00 - the Covenant's Press*) | 5 minutes |
| | **Ashen Vigil** | the next rest heals half; the rest card says so | a quarter |
| **lord** | **Colossal**, **Unyielding**, **Vengeful**, **Grudge-Bearer** | the gate's boss-general trials, recast as laws (below), on the Court's lord alone | the laws' rank II values (below) |

A wave's cadence and a decree's own cadence (Hunting Pack, Ashfall) are "more at once", which depth may add. NOTHING
GETS FASTER binds every wind-up, every piece's timing and every crumble, never the number of things at once (section
18).

**The merge.** The gate's trials carry no `.law`, and their keys (`hp`, `dmg`, `hit`, `size`, `slamR`, `groundMs`,
`shieldMs`, `threatPick`, `threatDecay`, `heal`, `feeds`, `legion`) do not end in `X`. So `sdMarksLaw`'s rule (a key
ending in `X` multiplies; any other is overridden by the last mark that names it) cannot fold them as they stand. EG5
recasts the four boss-general trials as X-keyed laws:

- Colossal: `sizeX` 1.25, `hpX` 1.25, `radiusX` 1.2 (II: 1.4, 1.4, 1.3). The Slam becomes 8.4 m (floor 1.71 s); the
  floor lengthens every wind-up it widens;
- Unyielding: `shieldX` 2, `hitX` 0.85 (II: 3, 0.75), in place of the trial's `shieldMs`;
- Vengeful: `dmgX` 1.25 (II: 1.4). Every share multiplier, depth's, fury's and Vengeful's, together is at most 1.5;
- Grudge-Bearer: `threatPick` 0.85, `threatDecay` 0 (II: `threatPick` 0.95).

The gate's trials written against the Warden's own attacks (Scarring, Dagon's Favoured, Echoing, Soul-Hungry) are not
drawn, nor is the ninth, Legion-Lord: the Spire's legion is its own (section 12). The Hour's decree **The Fraying**
(`SD_OMENS`, fray 36) is drawn only for a circle with an Athenaeum, through `orreryOf`'s fray parameter. The Spire's
new decrees (every family but lord) never reuse the name of one of the gate's trials or one of the Hour's omens.

**The profile.** `egFightProfile(decrees)` folds them as `sdFightProfile` does. Its cache is keyed by the sorted decree
string and bounded (LRU 256): the gate's and the Hour's caches assume a bounded set of 185 or 216, and the Spire's is
not. The Spire's frames carry up to nine decrees, the tide and the strata under their own validator. The gate's
`validGateMods` (three words) is not touched.

Every decree is relay-side, the shared clock's law, or a word the relay says (a rest's heal). None asks the client to
handicap itself.

## 15. Vestiges - what the Battlemages left

**This page's decision on question 4: yes.** An endless run without a build that changes inside it plays the same at
Hall 60 as at Hall 6, and eight members choosing what to become is what makes a company more than eight builds.

- At each Redoubt, every living member is offered **three Vestiges**, drawn by the relay's rng from three different
  families, and takes **one** within the rest. Unpicked, the first is taken.
- Taking one already held ranks it, **I -> II -> III**. An offer never shows one held at III.
- **The lean**: at the first Redoubt, one of the three is always drawn from the family of the member's most-used blow
  kind in the circle (the hit's `r`): melee leans to Blade, an arrow to Hunt, a spell to Arcana. It nudges and never
  decides; the room knows nothing of classes and should not.
- **More cards**: Surplus (section 6.2) buys a fourth card or a reroll. A **bequest** (section 16.5) adds the fallen's
  card. A Mastery (below) adds one more. They stack: an offer holds at most six cards. Three Vestige shards (section
  17.1) make a rank of a held Vestige, or a pick of two new ones.
- They last until the breach closes. The room holds each member's, says them to the company (auras need it), and the
  Redoubt's receipt carries them.

**The trust law.** A player owns their body (co-op's law). A Vestige that changes only the holder's body is as honest
as their save. Every Vestige that raises damage on a relay foe does so through the relay:

- a **conditional** one (a condition the relay cannot see) declares its EXPECTED gain as a bucket factor;
- one whose condition the relay itself establishes (a distance between poses, an add's health, an ally's place, an
  ally fallen) is applied by the relay to that blow;
- the product of the client-declared factors on a member is capped at **`EG_BUCKET_X_MAX` 1.25**. A modified client's
  ceiling rises by a quarter at most;
- the relay-established factors cannot be forged, and are capped on their own: their product at **`EG_RELAY_X_MAX`
  1.6** (Culling Edge III alone reaches it);
- **both together are capped at `EG_BUCKET_ALL_MAX` 1.6**, the column section 18's model carries.

| family | Vestige | I / II / III | applied by |
|---|---|---|---|
| **Stone** | **Stoneskin** | +10 / 18 / 25% max health | client |
| | **Iron Footing** | push taken -35 / 65 / 100% (Breakers, Pendulums, Gusts) | client |
| | **Second Wind** | once a hall, falling under 30% heals 15 / 25 / 35% | client |
| | **Bastion** | allies within 6 m take 4 / 8 / 12% less from blows | allies' clients, from the room's word; the relay's census applies it too |
| | **Challenger's Oath** | your threat x1.5 / 2 / 2.5; lords' blows on you -5 / 10 / 15% | relay (threat), client (blows) |
| **Blade** | **Searing Edge** | melee blows +3 / 6 / 9 fire | client; expected factor 1.04 / 1.07 / 1.10 |
| | **Momentum** | blows on one target +4% each, to 3 / 4 / 5 stacks | client; expected 1.05 / 1.07 / 1.09 |
| | **Sweeping Arc** | melee blows splash 20 / 35 / 50% to adds within 3 m of the target | relay (host hits) |
| | **Bloodied Fury** | under half health +10 / 18 / 25% damage | client; expected 1.03 / 1.05 / 1.07 |
| | **Culling Edge** | +30 / 45 / 60% on adds under a quarter health | relay (it knows the add's health) |
| **Hunt** | **Long Sight** | arrows and spells from beyond 12 m +8 / 14 / 20% | relay (it knows both poses) |
| | **Featherstep** | your crumbles wait +0.2 / 0.35 / 0.5 s; cast-backs cost 8 / 6 / 4% | client (crumbles are private) |
| | **Fade** | after you strike, adds lose you for 1.5 / 2.5 / 3.5 s, once every `EG_FADE_CD_S` 8 s | relay (targeting) |
| | **Hunter's Mark** | your first arrow on a foe marks it 8 s: the company deals +5 / 8 / 12% to it | relay |
| | **Fleetfoot** | run speed +4 / 7 / 10% | client (spans are laid for the span build) |
| **Arcana** | **Battlemage's Focus** | spell cost -10 / 18 / 25% | client |
| | **Overcharge** | spell blows +8 / 14 / 20% | client; expected 1.08 / 1.14 / 1.20 |
| | **Spellbane** | every resistance +10 / 18 / 25 | client (the saving throw) |
| | **Shieldweaver** | your Shield spell soaks +20 / 35 / 50% | client (`hurtPlayer`'s pool) |
| | **Arcane Echo** | a damage spell repeats at half, 10 / 16 / 22% of casts | client; expected 1.05 / 1.08 / 1.11 |
| **Fellowship** | **Rally** | when a hall's door opens, the company heals 8 / 14 / 20% | each client, from the room's word |
| | **Spire's Standard** | allies within 10 m +4 / 7 / 10% damage | relay (a factor while near) |
| | **Watchfire** | blows aimed within 12 m of you are told early to the company (below) | relay |
| | **Fallen's Due** | when an ally falls, the living deal +10 / 15 / 20% for the rest of the hall | relay |
| | **Steadfast Line** | with three allies within 8 m, you take 5 / 10 / 15% less | client, from poses; the relay's census applies it too |
| | **Mender's Grace** | heals you cast on allies +15 / 25 / 35% | the receiver's client, from the room's word (ALLY-CAST's law) |
| | **Lifeline** | a heal you cast on an ally under 30% gives them 3 s of 20 / 30 / 40% less from blows | the receiver's client; the relay's census applies it too |

The Redoubt's card shows the circle's damage chart with the gate's Healed column (`src/ui/gate/gateDamageChart.js`,
GATE-HEAL), so a company of eight sees what its healer did.

**Mastery Vestiges** change what their holder does, not a number. One is offered as a fourth card at Redoubt 3 and at
every Valkynaz Redoubt; a member holds one at a time, and taking another replaces it.

| family | Mastery | what | applied by |
|---|---|---|---|
| **Stone** | **Immovable** | stand still for 1 s on a fight floor, and blows on you deal 25% less and pushes do nothing until you move | client; the relay's census applies it too |
| **Blade** | **Counterstroke** | a melee blow on a lord within 0.6 s after one of its blows lands within 6 m of you deals x1.4 | relay (it knows both), inside the 1.6 cap |
| **Hunt** | **Spotter** | your arrows wake Lurkers at any range, and a woken or struck foe is marked +10% for 8 s | relay |
| **Arcana** | **Spillover** | a spell's overkill on an add carries to the nearest add within 6 m | relay (host hits) |
| **Fellowship** | **Spirebridge** | once a span, a gold bridge over the next gap for the company, for 6 s | the room's word; known to the fair trail, and the crossing's bounds are solved with it |

**Accords.** Two members within 10 m, holding a named pair from two different families, gain an Accord while they
stand together. The offer card names it: *Takes an Accord with Mira's Hunter's Mark.* Every Accord is applied by the
relay, inside the caps:

| Accord | the pair | what |
|---|---|---|
| **Hammer and Anvil** | Challenger's Oath + Hunter's Mark | a foe the mark's holder marked takes +8% from the oath's holder |
| **Shield-Hymn** | Bastion + Rally | Rally's heal also gives the company 4 s of Bastion's protection |
| **Ambush** | Fade + Spire's Standard | the first blow after a Fade, within 10 m of the Standard's holder, deals +15% |
| **Kindled Steel** | Searing Edge + Overcharge | the Edge holder's melee fire splashes 2 m (relay host hits) |
| **Far Watch** | Long Sight + Watchfire | Watchfire's lead grows by 0.05 s for blows aimed at the Long Sight holder, never past the 0.4 s the brain commits |
| **Living Wall** | Stoneskin + Mender's Grace | heals on the Stoneskin holder +10% |
| **No Quarter** | Culling Edge + Fallen's Due | while Fallen's Due burns, Culling Edge reaches adds under a third of their health |
| **War-Chorus** | Arcane Echo + Spire's Standard | within 10 m of the Standard, an Echo repeats at full |

**Watchfire.** Every lord's brain commits each blow `EG_TELL_LEAD_MS` (400 ms) before its wind-up begins, whether or
not anyone holds Watchfire, so the blow's timing never depends on who does. The holder's company sees the early
outline as a PULSING solid red line (a dashed line is a feint's), and a blue pip marks the holder (blue is yours,
section 25.2). The warning itself is never blue, since blue on a danger shape reads as safe (WB13a T8). Rank sets how
much of the lead is shown: 0.15 / 0.25 / 0.35 s. A member sees another's Watchfire lines only for blows within 12 m of
themselves.

**Stacking.** Eight holders of one aura are not eight auras:

- the same Vestige aura from several holders applies the strongest, plus 2% for each other holder, at most +6% over
  it;
- every Vestige's damage reduction together is at most 30%;
- the client-declared damage factors together are at most 1.25, the relay-established ones at most 1.6, and both
  together at most 1.6;
- a Vestige aura draws as one thin blue ring (0.6 m) at its holder's feet, never a cloud over the floor the telegraphs
  live on.

**Resonance.** Three different Vestiges of one family (ranks and Masteries do not count) grant that family's capstone,
for the breach:

- **Stone, Rooted**: immune to push, and your threat doubles;
- **Blade, Bladestorm**: every fifth melee blow strikes every foe within 3 m (relay host hits);
- **Hunt, Deadeye**: an arrow from beyond 12 m pierces the add behind its target;
- **Arcana, Spellweave**: every fourth damage spell costs nothing;
- **Fellowship, Rallying Cry**: Rally's heal and every Second Wind in the company refresh when a hall's door opens.

**Death saves.** Divine Grace (`src/systems/loot/lootPowers.js`, `lootDeathSave`, registered with
`registerPlayerDeathSave`), The Hour Turns (the Brass of Numidium's) and Unbroken (Malacath's)
(`src/systems/sigil/sigilSetPowers.js`) are not timers in the Spire. In an `eg:` room each recovers at the next Redoubt
taken, and its chip reads *Redoubt*; so do the Ghost-King's Vigil, a low-health heal that never answers a killing
blow (`lootHurt`), Shed Skin (Sethrakul's Coilscale, `src/systems/sigil/sigilSets.js`) and the Panoply's Battlemage's
Reprieve. As timers they would hand out a fresh life every few minutes, and make the Brass of Numidium
mandatory. **Stendarr's AvoidDeath** (`avoidDeath` in `src/systems/guild/guildServices.js`, a rank-in-fifty roll the hosts
consult through `setAvoidDeathHook`) is refused in an `eg:` room: every host's hook answers false there, or a temple
rank would cancel a fall.

## 16. Redoubts, one life, the fallen, the Reliquaries

### 16.1 A Redoubt is a checkpoint

When a Court's lord falls, the Redoubt is taken for every living member at once. Each **earner** gets an `e1`
**receipt** (section 23). An earner, in that circle:

- dealt at least `1/(2n)` of the damage the company dealt in the circle (the relay's chart, lords and legion), *n*
  being the living company at its Court; or
- was ACTIVE in at least three of its five halls: dealt at least `1/(8n)` of the hall's damage, healed others for at
  least `1/(8n)` of what the company took, stood 1.5 s in an errand's mark, or crossed a span with a fair trail.

The rule is the seam's `earned(f, sub)`, over the circle. An idle account pulled from hall to hall earns nothing (AUDIT
EG0 A6), and a scripted wiggle is not activity (AUDIT EG II L4-18). A receipt banks:

- **the depth**: the Redoubt joins the member's taken Redoubts, this season and all time;
- **the week's spoils** of that Redoubt, rolled from the receipt's secret seed (section 22) and thrown at the beacon
  like the gate's spew (section 19);
- **Marks**, and the embers section 19 pays;
- **a sealed Reliquary**, when that Redoubt pays this week (section 16.3);
- **the board's standing** (section 20).

### 16.2 The Redoubt's sequence

The mode's heartbeat fires in an order, timed from the lord's `fell`:

| at | what |
|---|---|
| 0 s | the gate's fall beats (WB13e): *FELLED*, the body down |
| 1.5 s | the beacon climbs at the court's heart with SPIRREDT's first chord, under the card *Redoubt 5* / *The Broken Galleries* |
| 3 s | the count's chip takes its time: *+15:00* (or *+10:00 - the Covenant's Press*, or *+3:00 - the last word* when the last word clamps it) |
| 3.5 s | the spoils thrown at the beacon, at least 12 m from the way home |
| 4.5 s | the recalls: each fallen member rises in the beacon's light, one by one |
| 6 s | the rest window opens: the Vestige offer, then the decrees' vote, then the way home and the respite |

The rest's 90 s run from the window's opening. A Ready vote (the company's word, section 16.4) ends it early and saves
last-word time.

### 16.3 The rest, the Reliquaries and the way home

**The rest** (`EG_REST_S` 90 s, the count held):

- health, magicka and fatigue restored (the room's word, each client its own body; half under Ashen Vigil). The
  relay's census is restored with it, outside the mend budget;
- the Vestige offer (section 15);
- the next circle's decrees, chosen by the company's word, and the next lord, both shown on the beacon;
- **the recall** of the fallen (section 16.5);
- **the way home**: a gold arch at least 12 m from where the spoils land, pressed, never walked through. This is
  SS3's lesson (`World-Bosses.md`: the gate's way home became a pressed door after a player walking in for loot
  walked out); here it would end a run for good. Its plaque reads *The way home*. A press opens a confirm in both
  skins, *Walk home? Your Reliquaries open: 4.*, with *Walk home* and *Stay*, the focus on *Stay*. It ends the member's
  run, keeps everything, and OPENS their Reliquaries;
- **a respite**, from the breach's budget (section 6.2);
- then the stair down opens, and the closing's law takes everyone left.

The way home, a fall and forsaking are the only ways out before the tear or the last word.

**The Reliquaries** are what a company risks. Each Redoubt that pays this week (section 19) seals one Reliquary into
each earner's satchel: one more spoils roll at that Redoubt's depth, at twice the Panoply chance. A Redoubt already
paid this week seals none, or a company with keys would farm Reliquaries (AUDIT EG II L2-15).

- It opens only at a good end: the end receipt with `why` `'home'`, `'seal'`, `'last'` or `'void'` carries how many it
  opens, rolled from that
  receipt's secret seed.
- A fall, the tear or a wipe loses every one. The way home, THE SEAL, the last word and a void open them, and THE
  COVENANT'S PATIENCE ends a breach as the way home (section 18).
- **Every Reliquary**, whatever gives it (a Redoubt, the Reliquary Vault, Dagon's Bargain, the Honour Horn, the High
  Road's cache), is sealed only in a circle whose Redoubt pays this week, and rolls at that Redoubt's depth. In a
  circle already paid, each gives 20 lumen instead.
- The HUD shows them: *Reliquaries: 4*. The rest card shows the stake: *4 Reliquaries - 1 Valkynaz - a Panoply piece
  about 1 in 2.*
- Every Redoubt is now the question the Spire was built to ask: walk home with four, or push for a fifth. One member
  walking home weakens the company, and that is the social tension a company of eight should feel.

### 16.4 The company's word

**The living ping.** Every living member may ping every 3 s (`lping`): *here*, *danger* or *mine* (an errand claimed),
a blue pillar 6 m tall whose glyph names the kind, with a chime (blue is the company's, section 25.2).

A company choice (the decrees, Dagon's Bargain, a respite, the Ready vote) is a prompt at the beacon or the shrine,
open for 10 s to every member, the witnesses included. It passes on a majority of those who answer; silence abstains,
and a tie refuses (for the decrees, a tie takes the first shown). One silent player never blocks the company, and
nobody decides for eight alone.

### 16.5 One life, one recall, the witness

**A fall.** A death in the Spire (the pose's `dd`), or 180 s gone in a trial, is a FALL:

- the fallen's Reliquaries are lost, and their lord's share is retired (section 13.2);
- they become a **witness** (below);
- **THE FALL**, their own screen. Today the world host's online death runs the death screen
  (`src/ui/deathScreen.js`, counting `ONLINE_RESPAWN_SECONDS`, 60 s, to a respawn; the enhanced skin's *YOU DIED*
  veil is `src/ui/enhanced/enhancedDeath.js`); in the Spire that respawn never comes. So in
  an `eg:` room there is no death screen. The camera sinks for 1.2 s as the screen drains to a fifth of its colour;
  then the gate's title card (`src/ui/gate/gateTitleCard.js`) reads *FALLEN*, with *The next Redoubt can call you back.* (a
  first fall) or *The Spire will not take you back.* (a final one), and *Reliquaries lost: 4* in red. 2.5 s later the
  witness view dithers in. The company hears a low toll (clip 107, pitch 0.42) and reads *<name> falls.* once.

**THE RECALL**: each fallen member returns ONCE a breach.

- **At the next Redoubt** the living take: they rise at the rest with full health. They earn nothing for the circle
  they were out, and their newest Vestige is lost.
- **Or sooner, by the Memento.** A fall leaves a gold mote where the member fell. A living member passing within 2 m
  carries it (the relay judges by pose; the carrier's fall drops it where they fall). Carried to a **Battlemage's
  niche**, it spends the fallen's recall there: they return at 50% health, their newest Vestige lost, earning from the
  next hall. Niches stand on the Low Road, in the Scriptorium, in the Deepway's chamber, and on every slot-3 arrival
  plate. If nobody carries it, the Redoubt's recall stands as it was.
- A second fall is final: *The Spire will not take you back.*

**The rest of the law.**

- **A wipe** (no living member) ends the breach: there is no one to take the Redoubt.
- **Solo stays literally one life**: no one living can recall you, or carry your Memento.
- **No Resurrect** in the Spire (SD-ONELIFE's reason: a body raised in place stands in a fight its death has left).
- **No DEATH-PENALTY** either: that is the port's own (Ledger A, AN ONLINE DEATH COSTS A TENTH OF THE PURSE), and the
  world host's respawn runs it before it reads the realm. EG10 exempts a Spire fall there.

This reads Mac's *"Checkpoints"* as what a death costs, and *"one life on the line"* as the company's: a fall costs the
fallen their spoils at risk and the company a member until the next Redoubt, or until someone carries them home.
Losing the whole company still costs the run.

- **The Unfallen**: a company that takes Redoubt 10 with no fall, in a breach begun at Hall 1, holds the title *the
  Unfallen* and a flame on its board row (section 20).
- **The Lone Beacon**: a Court felled by one living member, in a company of four or more, gives that member the title
  *the Lone Beacon* and a herald line (section 20).

**THE WITNESS VIEW.** The fallen stay in `eg:<b>` as witnesses, with no body and no blows (the room already refuses
them). A fallen member may watch for an hour, so the seat is built, not improvised:

- **the camera**: a third-person orbit 4 m behind and 1.5 m above the watched member's relayed pose, critically damped
  (0.35 s), colliding as the Morrowind body's camera does, over the hall built from the spec. Never a first-person ride
  of a pose that bobs at 10 Hz;
- **whom**: cycle with Q and E, the pad's shoulders, or a tap on a party row; look input frees the orbit;
- **the swap**: the stair cross-dissolves with the watched member;
- **the HUD**: the count, the watched member's name and vitals, and *You will be called back at Redoubt 6* (or *Your
  Memento lies in Hall 22*);
- **the witness's sight**: witnesses see Lurkers' anchors, alcoves and the next hall's twist that the living cannot;
- **the ping**: every 3 s, one of three kinds (*here*, *danger*, *cache*), a blue pillar 6 m tall with a chime, its
  cooldown shown;
- **the vote**: witnesses answer the company's word (section 16.4);
- **a bequest**: at the fall, the fallen names one of their Vestiges. It joins the living's offers at the next
  Redoubt as a fourth card;
- **forsaking**: a witness may forsake the breach, behind the same confirm as the way home. Their end receipt is
  minted, `eg_live` is cleared, and the recall is forfeited. Nobody is held in a run they no longer want.

### 16.6 Starting deeper

A breach may start at any Redoubt its opener may start at:

- any Redoubt they have taken this season;
- or, until they take one this season, `floor(best / 2)` of their all-time best.

Every member must be able to start there too, or the admit is refused: *You have not taken Redoubt 12 this season.*
The start window's ticks (section 5) show it before the key is staked. No carries: a member who has not reached the
start cannot be brought past it. The ratchet is per season, so a new season's first breaches start at half depth and
the season's boards start level.

## 17. Every hall pays - caches, Cantrips, lumen, potions

Rewards that come once every five halls leave four halls in five ending in a door and nothing to take. Every hall pays
something the company can see coming; none of it outlives the breach.

### 17.1 Caches and Vestige shards

- **A cache** stands on every trial hall's end plate. Its kind is shown on the door's plaque during the trial: a
  **Vestige shard**, a **Spire Tonic** (restores 25% of health and of magicka, outside THE POTION LAW, held two at
  most), a **Cantrip**, or **lumen**.
- It gives one to each member who touches it during the closing, from a fair trail (section 21). The hall's budget
  (section 9) weighs it, and the relay records what each member took.
- **Vestige shards**: three, spent at a Redoubt, make a rank of a held Vestige or a pick of two new ones.
- A cache may be the Kyn Mimic's (section 8.7).

### 17.2 Cantrips

Run-only consumables. A member holds up to three and may use one anywhere outside a lord's shield (`{k:'cant', i}`,
the relay's word):

| Cantrip | what |
|---|---|
| **Sight** | caches, alcoves and Lurkers' anchors are shown to the company for the hall |
| **Stillness** | the next hall's first wave and rift pour 10 s late |
| **Mending** | the company heals 15% |
| **Severance** | the next lord's Sappers do not rise in its first phase |
| **Long Step** | your crumbles wait +0.5 s for one span (private, as crumbles are) |

### 17.3 Lumen and the Sutler

- **Lumen** is each member's run currency, from adds and rifts, counted by the relay and shown on the HUD. It is lost
  when the breach ends.
- **The Sutler**, a chained Kyn quartermaster (a twist, section 8.7), stands on an arrival plate and sells for lumen:
  a Cantrip (20), a Spire Tonic (15), a Vestige shard (30).

### 17.4 THE POTION LAW

"No natural regeneration" is what makes one life matter, and the port has no potion cooldown anywhere: with fifty
potions there is no attrition, and without them there is nothing else. So the Spire keeps a `MADE_LEVEL_RULES` row
(section 24), client-enforced like the Burning Court's no-regeneration rule:

- at most `EG_POTIONS_PER_HALL` (2) restoring potions a hall, refilled at each wake and at the rest;
- a *Potions 2/2* pip on the HUD;
- spells are untouched, and magicka comes back at the rest, from a Spire Tonic and from the member's own potions.

It is a departure from DFU, in the Ledger A row.

## 18. Depth - what grows, and the wall

**Mechanics first, and nothing faster.** Balance-Arc: *"a band-aid is a multiplier on every foe's health"*. Mac, WBX:
*"I dont think making mechanics faster is the play"*. What grows with the circle *c*, in the order a company feels it:

1. **decrees**: none, then one to four, then ranks (section 14);
2. **new kinds, pieces, variants, fragments and lords**, by band (sections 7, 8, 10, 11, 12, 13);
3. **more at once**: a rift's wave every `max(9, 20 - 0.5(c-1))` s; the legion's cap `min(14, 2 + ceil(1.5n) +
   floor((c-1)/5))`; spans combining pieces with fewer islands;
4. **the Wellhead's tides**: past circle 20, one tide a circle, from four:
   - **The Wellhead Erupts**: vents in every court;
   - **Clan Feud**: a Court's lord comes with its band's champion beside it (a host body with the Proving champion's
     kit, on the lord's own ground: one seam, one fight);
   - **The Warband**: every hall begins with a Kynval Squad;
   - **Hungering Dark**: the rest heals half and Rally a third;
5. **the Wellhead's strata**: at Redoubt 20 and every fifth after, one stratum joins for the rest of the breach, drawn
   without repeat each season from six:
   - **The Twin Court**: two lords from two bands at 0.6 health each, the union floor over both;
   - **The Mingled Legion**: waves draw every band's kinds;
   - **The Old Masters**: the Last Spellmaster and the Last Armsmaster rise together as one Court, under the Twins'
     15 s law. The Last Lesson stops at r 17, the havens keep their r 13 ring, the Examination's runes stand on a
     ring of r 16, and the errand solver pins that court;
   - **The Molten Rim**: the outer 3 m of every court disc is magma;
   - **Kyn Champions**: Clan Feud at every Court;
   - **The Hollow Offer**: two Vestige cards instead of three, one of them always a Mastery;
6. **numbers, gently**: lord health `ttkRef(c)` (x1.07 a circle, x1.03 past 20); add health `x (1 + 0.04(c-1))`;
   shares `x (1 + 0.02(c-1))` within the 1.5 cap;
7. **fury**, for a company slow against its lord: waves and chained blows, never speed (section 13.2).

**The Wager.** At the start window (section 5), a company may take up to three decrees of its choosing for the whole
breach. A wagered breach ranks on the Depths board alone, with its Wager shown on the row (section 20). The best
companies choose their own pain, as Hades' Heat does; the Descent stays the same test for everyone.

All of it is bounded by THE WIND-UP FLOOR, THE UNION FLOOR, THE CHECK CLASS and THE ERRAND FLOOR (section 13.2), and by
THE ENVELOPE and THE TIMED SOLVER (section 10). Nothing shortens a wind-up, a piece's timing or a crumble below its
value in circle 1.

**The lords' clock** (`ttkRef`, at the company's reference damage and at the trust law's cap, the gate's
`(BOSS_TTK_S - BUCKET_DEPTH_X) / BUCKET_RATE_X` widened per circle, with the Vestiges' factors):

| circle | ttkRef (at reference) | at the cap | at the cap, x1.25 | at the cap, x1.6 (`EG_BUCKET_ALL_MAX`) |
|---|---|---|---|---|
| 1 | 3:00 (180 s) | 55 s | 43 s | 33 s |
| 5 | 3:56 (236 s) | 1:14 | 58 s | 44 s |
| 10 | 5:31 (331 s) | 1:45 | 1:23 | 1:04 |
| 15 | 7:44 (464 s) | 2:30 | 1:59 | 1:32 |
| 20 | 10:51 (651 s) | 3:32 | 2:49 | 2:11 |
| 25 | 12:35 (755 s) | 4:07 | 3:16 | 2:32 |
| 30 | 14:35 (875 s) | 4:47 | 3:48 | 2:57 |

**THE COVENANT'S PATIENCE.** A count spent while a Court's lord is awake does not tear. It arms *The Covenant
presses.*: the lord turns to fury at once, and the **Covenant's Weight** lands every 30 s, 30% to all (fixed, a 3.0 s
wind-up, a CHECK that promises no escape: it is the fight's end coming, not an errand). When the lord falls, the
Redoubt is taken and paid but adds no time; the rest runs; then the breach ends as the way home for everyone living
(`why:'home'`, their Reliquaries opened). A wipe under the Weight still loses everything. Outside a Court the tear works
as written, and the count warns five minutes ahead when it will not hold through the next Court: *The count will not
hold through the next Court.* The median run no longer ends by cutting off its own climax (Mythic+ finishes a dungeon
past its timer; no AAA mode cuts a boss with a clock).

**The wall is the count and the last word.** AUDIT EG II re-ran AUDIT EG0's model under the polished rules:

- the count runs only the closing's first 15 s, and holds from the pull to the wake;
- THE COVENANT'S PATIENCE, bounded by the Weight: a Court that would outlast the count by more than 120 s is a wipe;
- the combined bucket at most 1.6;
- lord health x1.03 a circle past 20; the rifts 36 s together; at most four decrees.

Its assumptions:

- a trial is a fixed part (traversal and errands: 55 s, growing with pieces and decrees) plus a damage part (70 s at
  reference, growing with add health, cadence and decrees, over the company's damage);
- 15 s of the closing counted a hall, 14 s of stair and gather not;
- 26 s of shields and approach a Court;
- a 90 s rest;
- 80% uptime.

Company size drops out of the lords, whose health is counted per fighter, and out of the Yard, whose rifts hold a
fixed 36 s; a large company's straggler costs it 15 s of each closing. EG21 measures it in the field.

| company | last Redoubt in one breach from Hall 1 | stopped by | with the count alone | the season's ceiling, starting deeper each breach |
|---|---|---|---|---|
| at reference damage | about 6 (Hall 30) | the count: its seventh Court outlasts THE COVENANT'S PATIENCE | 6 | about 16, after 10 breaches |
| at twice reference | about 11 (Hall 55) | the last word | 16 | about 39, after 22 breaches |
| at the cap (3x) | about 12 (Hall 60) | the last word | 23 | about 57, after 27 breaches |
| at the cap, x1.6 | about 15 (Hall 75) | the last word | 50 | about 88, after 30 breaches |

The model leaves out the Covenant's Press, THE GOLD RUN, the Low Road's longer road and the open window's minutes;
each moves a stop by about one Redoubt, so read the column as 5-7, 10-11, 12 and 14-15.

So from Hall 1, one breach reaches the Galleries' Valkynaz at reference and the Shade's first halls at the cap. **The
last word, not the count, stops a strong company.** **Starting deeper is how the Wellhead is reached**: each breach
begins with a fresh thirty minutes at the company's deepest Redoubt, and a season of breaches carries it to where one
circle's counted time outlasts a fresh count and THE COVENANT'S PATIENCE. That is about Redoubt 16 at reference, 39 at
twice reference, 57 at the cap and 88 with the Vestiges, and it is where the Depths board's rows will stand. No law
sets a ceiling: the trust law sets the cap, the count sets the pace, and the floors keep every blow readable. How far a
company gets is how well it plays.

## 19. Rewards and the economy

**What a Redoubt pays**, to each earner, at the claim of their `e1` receipt. **A Redoubt's number pays once per
account per arena week**: `arenaWeekOf(nowS) = floor((nowS - ARENA_SEASON_EPOCH_S) / 604800)`, a new helper beside
`arenaSeasonOf` (`src/net/arena/arenaLaw.js`, whose seasons are eight weeks). Taken again in the same week it pays gold alone
and seals no Reliquary. This is also the weekly reason to come back. Without it, a company with keys could farm one
Redoubt daily (AUDIT EG0 G6).

| what | how much | its law |
|---|---|---|
| **spoils** | rolled on the receipt's secret seed and thrown at the beacon: `rollEgSpoils(seed, level, R)` | below |
| **a Reliquary** | sealed; opens at the way home | section 16.3 |
| **Marks** | 20 | a new faucet, `MARKS_FAUCETS.eg` (`eg` joins `MARKS_COMBAT.kinds`), inside `MARKS_COMBAT.perDay` (150), shared with the gate, the raids and the serpent (`src/net/marksLaw.js`) |
| **a guild's deed** | 25 to the treasury, when three members of one guild, each 7 days in it (`tenureS`), take the same Redoubt | the gate's deed law, at most 4 a guild a day |
| **Deadlands Embers** | at a Valkynaz's Redoubt, `1 + floor(R/10)`; and 1 for each Redoubt taken for the first time this season | the Broker's currency (`BROKER_PRICES`, `src/systems/sigil/sigilBroker.js`). The Spire's embers join `EMBERS_EARNED_SQL` (today gate and serpent embers alone), so the insignia and the sink spend them |
| **a Weir Key** | at a Valkynaz's Redoubt, 1 in 4, at most one a week | section 5 |

Embers are paid where they are earned, not by the hour. A gate pays one or two. The insignia (30 and 50 embers, Mac's
*"expensive and sought after"*) stay a season's work, not a week's.

**The spoils** (`systems/egSpoils.js`, in `rollSdSpoils`' order; every new draw after the last, as SET6's law requires):

- gold;
- one Rare or Legendary piece; the Legendary's chance is 20% at Redoubt 1, +3% a Redoubt, to 65% (Redoubt 16);
- one to three `magicOrBetter`;
- **a Panoply piece**: 1 in `max(4, 12 - floor(R/2))`, so 1 in 12 at Redoubt 1 and 1 in 4 from Redoubt 16; **1 in 3**
  at a Valkynaz's Redoubt;
- **the lord's named Legendary**: 1 in 8 at its Redoubt (below);
- **the lord's card**: `bossCardRoll(bossKey, rolls)`, each lord its own key in `BOSS_CARDS`
  (`src/systems/bossCards.js`, which holds one card per kind today: gate, serpent, abyss), and in `BOSS_CARD_PER_MILLE`
  at 200, the gate's rate (a key missing there never drops);
- sockets, gems and the technique pass, as the gate's.

A Valkynaz's Redoubt rolls its spoils **twice**, two seeds from the receipt's. At 1 in 3 each, a Panoply piece comes
5 times in 9.

**The lords' named Legendaries** (`EG_LORD_ARMS`): each lord drops one named piece, a fixed base and name. Its
technique line is rolled by the loot ladder at the Redoubt's door like every Legendary's (TECH1 law 4: a technique is
found, never chosen), so a lord's piece is a chase, not a recipe.

| lord | piece | base |
|---|---|---|
| Grath, the Hound | *The Houndfang* | Saber |
| the Last Spellmaster | *The Examiner's Staff* | Staff |
| the Last Armsmaster | *The Last Lesson* | Longsword |
| Valkynaz Ilthys | *Conquest* | War Axe |
| the Cairn-Keeper | *Tithe* | Mace |
| the Twin Lords | *Rivalry* | Dai-Katana |
| Valkynaz Morvayn | *Soulchain* | Flail |
| the Mother of Dusk | *Duskwing* | Long Bow |
| the Night-Stalker | *Bloodmoon* | Tanto |
| Valkynaz Seyth | *Mirrorshard* | Shortsword |
| the Bound Colossus | *The Engine's Heart* | Warhammer |
| the Wellhead Wyrm | *Wyrmbreath* | Claymore |
| Valkynaz Garoth | *The Clan-Breaker* | Battle Axe |

**The pity count.** The service counts each account's Panoply misses (`eg_pity`). After 10 rolls without a piece, the
next roll gives one.

**The sink.** The Sigil Broker sells one Panoply piece of the buyer's choice, once an account a week, for 20 Deadlands
Embers. It is a new law and the service's (`eg_sink`), not her day's stock: SET7's stock is the day's, shared, and
kept by the client.

**THE BATTLEMAGE'S PANOPLY**: the war-gear the Imperial Battlemages wore in the Spire, taken by the Kyn. Nine Aetheric
pieces of Mithril make, light enough for a spellsword. It is a Sigil Set: each piece's sigil names the set, and the
set's stage is its lowest worn piece's (`Sigil-Sets.md` section 2), levelled as a whole (`Sigil-Sets.md` section 5).

| piece | template |
|---|---|
| The Battlemage's Warhelm | Helm |
| The Battlemage's Right Pauldron, The Battlemage's Left Pauldron | Pauldrons |
| The Battlemage's Cuirass | Cuirass |
| The Battlemage's Gauntlets | Gauntlets |
| The Battlemage's Greaves | Greaves |
| The Battlemage's Boots | Boots |
| The Spire-Shield | Kite Shield |
| The Spire-Saber | Saber |

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Battlemage's Bearing**: every resistance, and your magicka | +5 -> +15; +10 -> +30 magicka |
| 4 | **Battlemage's Discipline**: a spell cast arms your next weapon blow with its element; a weapon blow returns some of your last spell's cost | +20% -> +50% of the blow; 5% -> 15% of the cost |
| 6 | **Battlemage's Reprieve**: a blow that takes you under 20% (never a killing blow) raises a shield that soaks part of your max health for 6 s, half of it shared with allies within 8 m; then it must recover | 15% -> 40%; recovers 240 -> 120 s |

**No Gilded piece.** Mac, of the Hourlock: *"The most rare and gilded item in the entire game"*. GILDED1 made it the
one, and the Spire's top drop is the Panoply.

**Feats of the Spire.** Each lord has three feats, each an honours bit, written with its slice: a thing to master, not
only survive. Examples: Grath felled with no member caught by a burning bridge; the Examination passed with no rune
missed at *n* = 8; the Twin Lords falling within 3 s of each other. A band's feats, all held, grant *Master of the
Galleries*, *of the Cairn*, *of the Shade*, *of the Wellhead*.

**The honours** (service-recorded: `players.eg_honours` bits, beside the deepest Redoubts). They are added as
`server-account/src/titles.js` adds every honour:

- the id in `TITLES`/`AURAS` (in `src/net/identityToken.js`, which is in the relay bundle, so this takes a relay
  version);
- the branch in `titlesHeld`/`aurasHeld`;
- the words in `src/ui/playerBadge.js`.

| at | title | aura |
|---|---|---|
| Redoubt 2 (Hall 10) | **Spirewalker** | - |
| Redoubt 5 (Hall 25, the first Valkynaz) | **Beacon-Lighter** | - |
| Redoubt 10 (Hall 50) | **Kynbane** | **Beaconlight** (gold-white motes) |
| Redoubt 10 with no fall, in a breach begun at Hall 1 | **the Unfallen** | - |
| a Court felled alone, in a company of four or more | **the Lone Beacon** | - |
| Redoubt 15 (Hall 75) | **Battlemage of the Spire** | - |
| Redoubt 20 (Hall 100) | **Wellhead-Walker** | **The Burning Stair** (falling embers) |
| a band's feats, all held | **Master of the Galleries** (and its kin) | - |
| a season's top ten on the Descent, any bracket (section 20) | **Spire Champion**, held through the next season | - |
| the first company ever to take Redoubt 10 | **First of the Spire** | **Firstlight** |

*First of the Spire* is granted as *Hour's First* was: a list in the service's config, and the mailbox. Titles are
earned, never bought. The Broker's insignia stay the gate's. Cosmetic auras draw at nothing during a trial (THE QUIET
COMPANY, section 25.4).

## 20. The boards and the herald

**The boards** (`/v1/eg/board`, `egBoardOf`). The season is the arena's (`arenaSeasonOf`, eight weeks). Rows come from
`topWithMe`, which EG14 exports from `server-account/src/arena.js` (it is private today), and names from
`boardNamesOf`; `iliacBoardOf` is the precedent.

| board | who | ranked by | the row |
|---|---|---|---|
| **The Descent** | three brackets: Alone (1), the Few (2-4), the Company (5-8) | the deepest hall cleared in one unwagered breach BEGUN AT HALL 1, this season; then the fewest seconds from Hall 1's wake to that hall's door | the company's names (up to 8), the band, the Unfallen's flame, the week's Proclamation |
| **The Depths** | every account | the deepest hall cleared this season, from any start | the name, the hall, the start Redoubt, the Wager |
| **The Deepest Redoubts** | every account, all time | the deepest Redoubt ever taken | the name, the Redoubt, when |

- **The Descent is "how far with one life"**: the same thirty minutes and the same Hall 1 for every company. The
  start-Redoubt ratchet and the Wager cannot buy a row there (AUDIT EG0 A12). The Depths is theirs.
- **Clearing**: a hall counts when the relay clears it (sections 7 and 21), whether or not the next Redoubt was taken.
- **Who counts**: a company's size counts its earning entrants. The receipt carries `co` (the company's subs), and a
  company's row takes the deepest `h` of its members.
- **Champions**: each bracket's top ten at a season's end hold *Spire Champion* through the next season
  (`iliacHonoursOf`'s pattern).
- **The sealed band**: until a band ships, a run that reaches THE SEAL (section 13.3) ranks on the Descent by its
  seconds to the sealed Redoubt.

**The week's Proclamation.** One rule a week, active from circle 1 for every breach, drawn from eight (Kyn's Rally,
Wellhead Sparks, Soul-Pools, Vengeful Shades, Pyre-Bound, Crumbling Halls, Ashfall, Hunting Pack, each at rank I, none
of them drawing a kind or a piece the Galleries lack), shown on
the start window and on each Descent row. It is a rule, never a seed: the halls stay every breach's own, so there is
nothing to scout (section 30).

**The board window**, reached from the Timers row and from the start window: the three boards as tabs, the member's own
row pinned at the foot (`topWithMe`), the company's names, the flame, and *Your best: Hall 47 - 1:44:12*. The classic
skin builds it from DFU windows, as the start window uses DaggerfallListPickerWindow (`src/ui/listPicker.js`);
`src/ui/iliacTableHud.js`, one DOM panel outside the window stack, is the precedent for the enhanced skin only.

**The herald** (`net/egHerald.js`: pure builders, as `src/net/gate/gateHerald.js` is). Like the Hour's and the serpent's
heralds, it posts to the gate's webhook and falls back to the gate's role, pinging no one:

- a company taking Redoubt 10, 20, 30...: *<opener>'s company took Redoubt 10 of the Battlespire (Hall 50) in
  1:51:20.*
- a new top of the Descent in any bracket;
- *First of the Spire*, and *the Lone Beacon*;
- a band's seal lifted: *The way below the Galleries is open.*

An opening is never heralded: a company's breach is its own.

## 21. Integrity - what the relay judges

The gate's trust law, kept whole, and where it was not enough for one life, widened:

- **Blows on lords and the legion**: `applyHit`'s hand and purse, the bucket by the level claim times the Vestiges'
  capped factor, a melee pose within reach, from a pose on a fight floor of the current fight (section 11.7). The
  blow's kind `r` is the client's word (`HIT_KINDS`), so a Vestige that reads it must not gain from a lie. Sweeping
  Arc, Bladestorm and Counterstroke read melee, and the relay already checks a melee blow's reach. Long Sight, Hunter's
  Mark, Spotter and Deadeye read arrows and spells, and also need more than 12 m between the poses (Spotter's wake
  aside), where a forged kind gains nothing a real one would not. The lean reads it too, and changes no damage.
- **The lords' blows on members**: ONE judge for every shape. `src/net/bossRef.js` holds a judge for each boss
  (`judgeGate`, `judgeRemnant`, `judgeSerpent`).
  - Every Spire blow travels with a FULL shape stamp, its kind and every number, which is new. The Remnant's
    `shapeStamp` carries only what its marks changed.
  - So one `judgeShapes` tests any blow, per fight floor (section 11.7), against the pose trails the relay holds
    (`posAt`/`posAfter`, `deepIn`, `BODY_AFTER_MS`) and feeds `src/net/bossBody.js` (`bodyStruck`, `bodyCensus`).
  - It also judges the hall's own hazards at their landing on a fight floor, and a cast-back (a trail below
    `SD_VOID_Y`), into the census. A modified client that ignores vents and magma is seen.
- **Time, before enforcement.** The relay keeps trails timed by arrival, and a client draws and resolves a landing on
  a clock that runs late by the welcome's one-way latency, so today both poses the judge reads can predate the
  client's landing: a dodge in its last round trip would be counted as a hit. `BOSS_BODY`'s enforcement is off
  today (`BODY_DEFAULT.enforce`), so this error has never been paid. Before EG14 turns it on for `eg:` rooms:
  - trail entries become `[tShared, x, y, z]`, `tShared` being the pose's own `ts` plus the socket's offset (below);
  - `posAfter` is the first pose SENT after the blow's `at`, waited for up to 800 ms; a body with no pose within
    ±300 ms of `at` is not counted;
  - the client's clock is corrected (section 10.8);
  - pinned: a dodge at the client's `at` less 50 ms, at a 300 ms round trip, is never counted.
- **THE FAIR TRAIL** (`spanFair`, new, on every `eg:` pose). The relay's body trails (`BODY_TRAIL_MS` 2000,
  `BODY_TRAIL_MAX` 24) are seconds long, and a crossing takes tens of seconds, so the room keeps an ONLINE accumulator
  per member: the fastest step, the air time since the last support, the last island. Its law:
  - **its clock**: every measure is taken in the sender's `ts` (differences mod 2^24, `POSE_TS_MOD`, which wraps every
    4.66 h). A socket's offset to relay time is the least `arrival - ts` over its last 32 poses;
  - **support**: a pose must lie on a floor, a ramp or a platform's top (its footprint at that time by `stepAt` and
    `beatStands`, inflated by 0.35 m, the capsule, and by the platform's speed times 0.15 s), or on a ballistic arc
    from the last support. Stairs and slopes are support (`ramps`, section 11.5);
  - **speed**: no step faster than the fast build's run times 1.1, plus a push;
  - **air**: no airborne stretch past `EG_AIR_MAX_S` (2.5 s);
  - **blindness**: a `ts` gap over 0.4 s is BLIND and judges nothing either way. A crossing more than 30% blind opens
    no door, and records `m.blind`;
  - **the crossing**: its time against `EG_CROSS_MIN(spec, road)` (section 10.5) rides the receipt's `m`, and gates
    nothing until EG21;
  - **after a restart**: the accumulator is saved to storage. After the room is re-woken, a member at the end plate
    whose last saved accumulator was fair counts as a fair arrival; failing that, the door opens on the first arrival,
    recorded as `m.wake`. A hall woken after every member passed the last island never deadlocks;
  - **repeats**: a member whose trail breaks the law again within a hall has their hits refused for 5 s;
  - poses between a member's `down` and their next `here` are never judged; a pose sent mid-stair belongs to no hall;
  - an unfair trail opens no door, and its measures ride the receipt (`m`).
- **Every pose-gated credit needs a fair trail** from the last island: the door, `down`, a cache, THE GOLD RUN, a
  niche, a Memento carried, the Reliquary Vault, the High Road's cache.
- **A hall cleared**: only the relay says so (the legion broken, the lock solved, the champion or the lord fallen, a
  fair end).
- **The board and the Redoubts**: from receipts alone. The service never takes a client's word for a depth.
- **The key**: the service's balance and stake (sections 5 and 23).
- **The census**: the relay's census applies Bastion, Challenger's Oath, Steadfast Line, Immovable and Lifeline itself,
  and the rest restores it, so holders do not drain their budgets or skew the measures staff read.

A modified client can still refuse to take damage (a player owns their body). Under `BOSS_BODY` enforcement, the
relay's census fells it as it fells a gate's fighter. The Spire's boards are measured with enforcement on: EG14 turns
it on for `eg:` rooms when the boards open, whatever the gate's setting, and only once the time law above is in.

## 22. Failure and recovery

A breach is a three-hour instance on infrastructure that restarts. Every failure has a rule (AUDIT EG0 A5, A10, A17;
AUDIT EG II L4-31, L4-42).

**A deploy.** `.github/workflows/relay-deploy.yml` drops every socket and restarts every Durable Object. The client
deploys on every merge. A drain of up to 3 h 10 min for every relay deploy would close the Spire for much of each day,
so:

- **THE HOLD** (the usual deploy): the deploy waits until every live breach is between trials (a closing, a swap or a
  rest), asks each room to hold, then goes. A held room freezes the count and gives the gap back, and waits until
  every living member has returned or 180 s have passed. A member who returns finds the hall where they left it.
- **THE DRAIN** (an `EG_SPEC` change beyond `EG_LAWS` only): the deploy waits on `/v1/eg/live`, as it waits on
  `/v1/seats/sieges/live`. Opens are refused meanwhile (*The Spire's road is shut. Try again soon.*), and the deploy
  waits until no breach is live, or the last word of the longest has passed.
- **A `force` deploy** voids every live breach. Their stakes are returned, and their Redoubts taken stay taken.
- **A LAW PIN PER BREACH**: the breach records `egv`, the spec law it was opened under.
  - Both sides keep `EG_LAWS`, every `EG_SPEC` younger than seven days (pinned), for `egHallOf`, `egFragOf` and
    `courseOf`. A client deployed ahead of the relay, or behind it, still draws the breach's own halls.
  - A client that cannot draw its breach's `egv` asks `{k:'spec'}` and builds from the relay's bytes (section 9).
  - CI also sweeps the previous law's courses with the current motor, since the motor reaches clients at once.
  - Frames are self-describing (a full shape stamp), so a brain's tuning needs no pin.
  - A woken relay that does not know a breach's `egv` ends it with `why:'void'`: the stake is returned, and the
    Redoubts taken stay.

**A restart or an eviction.** A Durable Object can be evicted or restarted at any time.

- **Saves to storage**: every `CHECKPOINT_MS` (2 s, the gate's), and also at the open, every admission, every stage
  change, a fall, a pick and the end, and at a Redoubt BEFORE its receipts go out.
- **Deterministic, secret receipts**: a receipt's seed is `HMAC(rs, sub, R, kind)`. `rs` is a 32-byte secret the room
  draws at the open, keeps in storage and never sends. The breach's `seed` is public in `st`, and a seed derived from
  it would let every client compute every future spoils, Reliquary and Panoply roll: the exact leak AUDIT SD III R4
  moved the Hour's honours off (section 5). A re-woken room sends the same receipt and never a second roll. Pinned: no
  frame or receipt carries `rs`.
- **Storage, not memory**: offers, picks, spent order ids, the fallen, the witnesses, the Mementos, the Reliquaries,
  the caches taken, the Cantrips, the lumen, the fair-trail accumulators and the Athenaeum's hall all live in storage
  (hibernation keeps nothing else).
- **Time survives the restart**: a member's absence is counted from `max(lastSeen, wakeAt)`, and any tick gap over
  `EG_GAP_MS` (2 s) is given back: the count and the hall's timers do not run across it.

**A dropped socket.** A closed socket would drop its body from the census, and returning at the arrival plate would
dodge a lord's blow. So the body stays at its last pose for the absence window and takes what lands there, though no
blow is aimed at it (section 6.1). On a fight floor it resumes there. In traversal it resumes at its last island or
plate, with no cast-back's cost: a platform has moved on, and a reconnect is not a fall.

**A reload.** Saves are refused inside (the Burning Court's law, WBX W6), so a reloaded page boots outside.
`/v1/eg/keys` answers the account's live breach, and the world host offers *Return to the Spire*: a hello as an entrant
(no new order), resumed by the dropped socket's rule; between trials, at the current hall's arrival plate.

**A key's loss.** A key is never lost to an infrastructure fault:

- the hub retries `EG_INTERNAL_OPEN` idempotently on `ez`, and members may ask for the call again;
- an end with no hall ever woken is a void, never the opener's `'empty'`, unless the room had its call out and nobody
  answered;
- a client that boots with a stake the room never accepted asks the room to void it (`{k:'void', z}`).

**Unknown rooms.** An `eg:<16hex>` the hub never opened writes nothing and arms no alarm, except a void (section 23),
which writes its one tombstone.

**The cost.** One Durable Object per breach, awake for up to three hours. So:

- the tick is 250 ms only while a trial runs, 1 s otherwise, and none while the arch rises;
- the hub enforces `EG_LIVE_MAX` (64) live breaches at once, the Rehearsals among them;
- every breach ends at the last word.

## 23. The wire

**The room family.** `eg:<16hex>`, the breach id the service mints with the open order.

- **The room-key law**: `isEgRoom` (`/^eg:[0-9a-f]{16}$/`) in `net/egLaw.js`.
- **The Worker's prefix gate**: a `startsWith('eg:')` line beside `gate:` and `sd:`, so an unknown key mints no
  object.
- **The tick**: `_egTick`, in the `alarm()` chain before `_alarmRest`.
- **Presence**: the room is each entrant's presence room for the whole breach (`roomIdentity` `{kind:'eg', b}`).

**Opening runs through the hub** (AUDIT EG0 A4). The hub holds every client's socket and every party's roster.

1. The client sends `{t:'eg', k:'open', z, site}` to the hub.
2. The hub verifies the order, freezes the company from its own `party:` record, and checks `EG_LIVE_MAX` and the
   drain.
3. It forwards the order, the company and the arch's site to `eg:<b>` by internal fetch (`EG_INTERNAL_OPEN`), the
   DO-to-DO pattern `_wdunKinOf` uses, retried idempotently on `ez` until the room answers.
4. It keeps `eglive:<sub>` for each member, and tells the company the call (`k:'call'`, signed) on the party channel.
5. Receipts for a member with no socket in the room are held by the hub as `egrc:<sub>` for their next hello, under
   the gate's receipt law (the `gaterc` sweep, widened by one prefix).

**Orders**, signed by the service with `IDENTITY_PRIVATE_KEY` and checked by the relay with `verifyOrder` against
`IDENTITY_PUBLIC_KEY` (`src/net/identityToken.js`). Every order already carries `i` and `e` (issued and expires, at
most `ORDER_TTL_S` 60 s apart). `egopen` and `egadmit` join the frozen `ORDER_KINDS`, which is a relay-bundle edit and
a version. Their fields are `EG_ORDER_FIELDS`, exclusive as `STAKE_FIELDS` are, so no other kind carries them and they
carry no other kind's. The first draft's `st` is a siege pass field (`SIEGE_PASS_FIELDS`) and would have been refused.

| order | fields | life |
|---|---|---|
| `o:'egopen'` | `s` (the opener's sub), `eb` (the breach id), `ez` (the order id, `[a-z0-9]{16,32}`), `ew` (the start Redoubt), `wg` (the Wager's decrees, at most three), `rh` (a Rehearsal), `i`, `e` | 60 s |
| `o:'egadmit'` | `s` (the member's sub), `eb`, `ez`, `ew`, `i`, `e` | 60 s |

The room checks `eb` against its own key, `s` against the hello's subject, `ew` against the breach's, and spends `ez`
once. `ew` names the start Redoubt everywhere: orders, frames and receipts.

**The stake** (AUDIT EG0 A1; CARDS6's void law). The key is never returned by a clock:

- **Open** (`/v1/eg/open`) is idempotent on the client's request id `rq`. A crashed client asking again gets the same
  order back. One conditional `UPDATE ... RETURNING` (the insignia-spend pattern) takes one key, writes the stake
  `eg_stakes(ez, account, b, until, state)` and sets `eg_live`.
- **SPENT**: on the first `w` naming its `ez`, or the first `x` whose `why` is not `'void'`; except an account's first
  opened breach that ends with no `w` (the first breach's mercy, section 5), whose stake is RETURNED, once ever.
- **RETURNED**: on a relay-signed **void** (`e1`, kind `'v'`), or an `x` with `why:'void'`, even after `w` receipts
  (a force deploy, an unknown `egv`: the company keeps its Redoubts and the opener gets the key back). `eg:<b>` mints a
  void for an order it never accepted. It writes the order spent first, as `_holdemVoid` does, so it can never accept
  it after.
- **The clock** spends a stake only after `EG_VOID_MAX_S` (7 days) with no receipt naming it.
- **The opening** is the moment the room accepts the open order, when the arch begins to rise. A stake's `until`, and
  `eg_live`'s, is the opening plus `EG_LAST_WORD_MIN` plus `EG_LIVE_SLACK` (10 min): about 3 h 10 min.
- **The tombstone**: after the end the room keeps `egdone` for `EG_VOID_MAX_S` (7 days) and refuses older voids (the
  `HOLDEM_STAKE_VOID_S` precedent).

**`eg_live`** (AUDIT EG0 A2) is `{b, until}`, `until` being the stake's. `/v1/eg/open` and `/v1/eg/admit` each write
it in one conditional `UPDATE` (`WHERE eg_live IS NULL OR b = ? OR until < now`). An end receipt or a void clears it,
and a lapsed one counts as clear. No lost receipt can lock an account out.

**The arch on the cell.** The opener's client says the hub's signed call on its world cell (`{t:'eg', k:'arch', b,
site, riseAt, openAt, o, sg}`) on full frames while it stands there, as `portalWire` rides a peer's frame. Peers check
`sg` and stand only a verified arch, at most two a cell, until the open window ends. The relay reads none of it, and
admission never depends on seeing it.

**Poses.** A pose on a moving piece carries `pl` and its offset (RIDDEN POSES, section 10.8); the field joins
`validPose`, a relay version (EG8).

**Frames** (`{t:'eg', k, ...}`; `EG_KINDS` and `EG_OUT_KINDS` in `src/net/wire.js`, each with its validator):

| frame | way | what |
|---|---|---|
| `{k:'open', z, site}` | opener -> hub | the open order (its Wager and Rehearsal inside) and the arch's site |
| `{k:'call', b, ew, site, riseAt, openAt, sg}` | hub -> the company | the call (section 6.4), signed |
| `{k:'in', z, lv}` | member -> room | the admit order and the level claim (frozen at the first admission) |
| `{k:'here', h}` / `{k:'down'}` | member -> room | arrived in hall `h` / stepped through the door |
| `{k:'st', ...}` | room -> all | the breach: seed, `sd` (the spec's digest), `egv`, hall, kind, variant, slot, twist, stage, the count's end, the respite left, the company (each `m1..`: numeral, alive, witness, home, forsaken, road), each member's Reliquaries, Cantrips and lumen, the Mementos lying, the decrees, the Proclamation, the Wager, the arch's site |
| `{k:'spec'}` / `{k:'specb', b}` | member -> room / room -> one | a spec asked for, and its bytes |
| `{k:'wake', at}` / `{k:'door', at, until, ul}` | room -> all | the trial begins / the door opens (`at`), the closing ends (`until`), and on a forked span the Low Road's closing ends (`ul`) |
| `{k:'hit', q, d, r}` / `{k:'ahit', i, q, d, r}` | member -> room | a blow on the lord / on add `i` |
| `ad`, `amv`, `aatk`, `ah`, `adie` | room -> all | the legion (the Legion-Lord's frames) |
| `{k:'atk', i, a, sh, at}` | room -> all | a lord's blow: the body, the attack, its full shape, when it lands |
| `{k:'cut', i}` | room -> all | a feint cut at `FEINT_AT` (section 13.2) |
| `{k:'tell', i, a, sh, at}` / `{k:'untell', i}` | room -> a Watchfire holder's company | the blow told early (section 15) / a told blow the union floor dropped |
| `hp`, `ph`, `fury`, `fell` | room -> all | the lord's bar, phase, fury and fall |
| `{k:'pz', ...}` | member -> room | an Athenaeum turn (the Orrery's `SD_PZ_*` bounds) |
| `{k:'use', i}` | member -> room | an engine worked (section 11.10) |
| `{k:'cant', i}` | member -> room | a Cantrip used (section 17.2) |
| `{k:'redoubt', w}` | room -> all | the Redoubt taken |
| `{k:'rcpt', r}` | room -> one | that member's `e1` |
| `{k:'offer', v:[...]}` / `{k:'pick', v}` | room -> one / one -> room | the Vestiges, Masteries and shards |
| `{k:'surplus', use}` | member -> room | a Surplus spent (a fourth card, or a reroll) |
| `{k:'ask', q, opts}` / `{k:'vote', q, y}` | room -> all / member -> room | the company's word: decrees, a Bargain, a respite, Ready |
| `{k:'lping', x, z, kind}` | member -> room | a living member's ping, every 3 s (*here*, *danger*, *mine*; section 16.4) |
| `{k:'buy', i}` | member -> room | a purchase from the Sutler (section 17.3) |
| `{k:'mast'}` | member -> room | a Mastery used (Spirebridge, section 15) |
| `{k:'ping', x, z, kind}` / `{k:'bequest', v}` / `{k:'forsake'}` | witness -> room | the witness's acts |
| `{k:'home'}` | member -> room | the way home, confirmed |
| `{k:'void', z}` | client -> room | an order never accepted, asked to be voided |
| `{k:'end', why}` | room -> all | why: `'tear'` (the count spent), `'gone'` (every member out: fallen twice, forsaken or home), `'wipe'` (no living member), `'home'` (THE COVENANT'S PATIENCE), `'seal'` (THE SEAL), `'rehearsal'` (a Rehearsal's end), `'last'` (the last word) or `'void'` (a force deploy, an unknown `egv`, no hall ever woken) |

**The receipt** `e1` (`net/egReceipt.js`: `mintEgReceipt`/`verifyEgReceipt`, signed by `GATE_SIGNING_KEY` as every
relay receipt is):

| kind | claims |
|---|---|
| `k:'w'`, a Redoubt taken | `b`, `w` (the Redoubt), `h` (the hall), `s` (the sub), `c` (this receipt's seed), `sh` (the share dealt), `t` (seconds since the first hall woke), `n` (earning entrants), `ew` (the start Redoubt), `vs` (the Vestiges), `m` (the measures), `z` (the order id), `co` (the company's subs), `fl`, `lb`, `ft`, `wg` |
| `k:'x'`, the member's end | `b`, `h` (the deepest hall cleared), `s`, `t`, `n`, `ew`, `co`, `rl` (Reliquaries opened, with `why` `'home'`, `'seal'`, `'last'` or `'void'`), `fl` (the falls in the breach), `lb` (a Court felled alone), `ft` (feat bits), `td` (seconds from Hall 1's wake to `h`'s door), `wg` (the Wager), `c`, `why` (`'fall'` (a final fall), `'home'`, `'tear'`, `'wipe'`, `'last'`, `'seal'`, `'forsake'`, `'empty'` (the opener's, when the call went out and nobody was admitted before the open window ended) or `'void'`), `z`. A first fall, which a recall can undo, mints no `x` |
| `k:'v'`, a void | `b`, `z`, `s` (the opener) |

**The account service** (EG2, EG8, EG14):

| route | does |
|---|---|
| `/v1/eg/keys` | the balance and the live breach, for restacking and *Return to the Spire* |
| `/v1/eg/find` | a dungeon's find: the tier, the roll, the caps |
| `/v1/eg/starts` | the start window's preflight: which starts each member of the opener's party may make |
| `/v1/eg/open` | idempotent on `rq`: stakes one, signs `egopen`, sets `eg_live` |
| `/v1/eg/admit` | checks the handle, the start Redoubt and `eg_live`; signs `egadmit`; sets `eg_live` |
| `/v1/eg/claim` | `claimEg`: verifies `e1`, refuses another's, answers guests `guest`. For `w`: one row in `eg_redoubts (b, account, w)` with its embers, the week's pay, Marks, the deed, the depth, the honours, the pity, the Valkynaz's key roll. For `x`: `eg_runs (b, account)`, the board's row, the Reliquaries, settles the stake (the mercy included), clears `eg_live`. For `v`: returns the stake |
| `/v1/eg/board` | `egBoardOf` |
| `/v1/eg/live` | the drain's question: any breach live, and until when |

**Migrations**: the next free numbers when each slice lands, today 0109 (EG2: `players.eg_keys`, `eg_finds`,
`players.eg_key_miss`, the launch gift) and 0110-0111 (EG8 and EG14: `eg_stakes`, `players.eg_live`,
`players.eg_mercy`, `eg_redoubts`, `eg_runs`, `eg_pity`, the depths, `eg_honours`, `players.eg_annals`).

**Versions.** Each slice that moves the relay bundle bumps `RELAY_VERSION` (`world194` when this page was last revised,
in `src/net/wire.js`) with its `LAW` row, and a game that does not know it is told to reload. Each that moves the
service bumps `ACCOUNT_VERSION` (`acct114` then, in `server-account/src/service.js`). The new titles and auras join
`TITLES` and `AURAS` in `src/net/identityToken.js`.

## 24. The made level's rules

The world host gates the Burning Court and the Hour at many separate sites today: 19 for `gateArenaDay` and 38 for
`sdRealmSlot` in `src/scenes/world.js`. A third made level would add a third copy of each, and one would be forgotten
(THE FOUR HOSTS RULE's own failure). EG7 makes them one law:

- `madeLevelOf(loc)` answers `'court'`, `'hour'`, `'spire'` or null;
- a table, `MADE_LEVEL_RULES`, says what each turns off;
- a source-sweep test refuses any new per-level check outside it (THE ONE CONSTRUCTION SEAM).

The Burning Court and the Hour are re-plugged with their behaviour unchanged.

| rule | the Burning Court | the Hour | the Spire |
|---|---|---|---|
| saves (the exit autosave included) | refused | refused | refused |
| rest, the travel map's journeys | refused | refused | refused |
| the automap | off | off | off |
| Mark and Recall | refused | refused | refused |
| the Portal Stone | refused | refused | refused |
| companions (GATE-ALONE, SD-ALONE) | kept out | kept out | kept out |
| natural regeneration (`courtRules`) | off | off | off |
| restoring potions | as today | as today | two a hall (THE POTION LAW) |
| Levitate | as today | banned | banned |
| Slowfall | as today | as today | banned |
| a technique's flight on traversal ground | as today | as today | refused |
| the jump buffer and the late press | none | none | 0.12 s each |
| Resurrect | as today | refused | refused |
| Stendarr's AvoidDeath | as today | as today | refused |
| a death | cast out | final for the Hollow | a fall (section 16.5) |
| DEATH-PENALTY | as today | as today | none |

**The world's clock does not stop.** The shared clock turns during a three-hour breach (36 game hours, a game day and
a half). A quest's deadline can lapse inside, which is why the start window warns of it (section 5).

## 25. The look

### 25.1 The rules and the archives

SD-LOOK's four rules are kept (`Super-Dungeons-Look.md`): the void is dark, structure does not glow, light appears only
where it means something, and every surface reads as Daggerfall pixel art. Textures are painted in code into the
Spire's pseudo-archives, registered in `world/pseudoArchives.js` (EG1, section 11.6), free today from **38231** (after
the merchant yard's 38221):

- 38231-38239: the arch, the key and the beacon;
- 38241-38249: the Galleries;
- 38251-38259: the Cairn;
- 38261-38269: the Shade;
- 38271-38279: the Wellhead.

**The bands' ramps** (sRGB, at least five steps each, as SD-LOOK's are):

- the Galleries: marble `[150,146,138]`-`[214,210,200]`, gold leaf `[140,98,40]`-`[246,206,120]` (the Hour's brass,
  reused), Battlemage blue `[36,52,96]`-`[92,124,196]`, the Deadlands' red sky;
- the Cairn: slate violet `[34,28,44]`-`[120,108,140]`, soul-light `[120,200,230]`;
- the Shade: `[6,6,10]`-`[60,64,80]`, moon-silver `[160,166,176]`-`[214,220,228]`;
- the Wellhead: basalt (SD-LOOK's) and iron, molten `[255,120,30]`.

### 25.2 Five lights, five meanings, and no others

| light | means | where | never |
|---|---|---|---|
| **gold** | the way, safety, and "it holds" | arrival and end plates, doors, the Redoubt's beacon, islands and waystones, havens, the way home, THE EDGE LINE, a moonlit branch's rim | an enemy's ward |
| **Dagon red** | his blows, his wards, his marks | every telegraph line (THE SPIRE DANGER EDGE, below), wards and their tethers, lords' marks on members | magma |
| **Battlemage blue** | yours | a pip, a ring or a pillar over heads and at feet: Vestige auras, numerals, a witness's ping, the Watchfire holder's pip | anything on the floor that hurts |
| **white** | the place's own timed hazard | vents ringing, Pendulums' lanes, a Beat's last 0.4 s, a fragment's hazards: hatched, and throbbing at most 3 Hz | a haven |
| **the band's own** | where you are | soul-gem violet in the Cairn, moon-silver in the Shade, molten orange in the Wellhead; the Galleries keep marble and gold | a warning |

**THE SPIRE DANGER EDGE.** Every Spire telegraph line is `TELEGRAPH_EDGE_DAGON` ([1.0, 0.24, 0.28], crimson), never
`TELEGRAPH_EDGE` ([1.0, 0.36, 0.05], orange), which most lords' and every legion outline uses today (Dagon's Wrath and
Reckoning, and the Remnant's Reset and End, already draw the crimson) and which the burning
ground's `POOL_COLOR` shares (`src/world/gate/gateBoss.js`). The pass blends additively, and orange over the Caverns' and the
Wellhead's emissive orange would vanish. Spire pools take the band's ramp, darkened, with a dashed rim, never
`POOL_COLOR`.

**The contradictions the first look had, resolved:**

- **wards are red, not gold.** A Ward-Bearer's tether and glow are the gate's `WARD_COLOR` gold today, and the lord's
  ward cage is gold: an enemy shield would read as safe. In the Spire both are Dagon-red dashes flowing to what they
  guard, and the cage on the lord's bar is red-bronze and hatched;
- **blue is never danger.** Rime-Wrought's ice-blue fills and pools (`ASPECT_COLORS.rime`, its pool [0.28, 0.6, 1.0])
  become a pale cyan-grey with the frost's grain and the dashed danger rim, the misread WB13a T8 fixed for edges only;
- **moonlight that holds is gold-rimmed.** The Shade's moon-silver is near-white, and there moonlight means solid.
  The beam's own light stays the band's; the branch it makes solid wears the gold rim. White stays the timed hazard,
  hatched and throbbing;
- **the Wellhead's orange is never the danger edge** (THE SPIRE DANGER EDGE).

**The lab check** (SD-LOOK's lab law): the danger edge against magma against a pool, a haven against a danger fill,
and solid against white against gone, each told apart at 10 m and 30 m under `?grey` and under deuteranopia and
protanopia filters.

### 25.3 THE EDGE LINE

Every edge a member could fall from (a platform's rim, a floor's `open` edge, a magma channel's lip, a walkway's side)
carries a gold line 2 px wide (3 px on phones), its luminance 0.3-0.45, emissive, kept by the fog as telegraphs are
(section 25.6), never pulsing. Walls and parapets carry none. The Steps carry a gold line under each rim in their mesh
(`SD_STEP_LINE`, `src/world/superDungeon/sdStepsArt.js`); the Spire's 2 px line reuses `sdStepsPass`'s line-quad technique (which
today draws only the ghosts of gone steps) on every edge of every hall. In the Shade's near-black and under the
mist, it is the only read.

### 25.4 The telegraph pass, THE TELEGRAPH BUDGET, THE QUIET COMPANY

**The pass** (`src/render/gate/gateTelegraph.js`) draws one shape a call. The Burning Court already draws several a frame:
its pools, his mark, his blow, and up to `HOST_SHAPES_MAX` (8) host shapes (`src/scenes/gate/gateHost.js`), cut in array
order. A Ward-Bearer's tether is drawn today as a lane in the path pool (`TELEGRAPH_KIND.lane`, `HOST_PATH_HALF_W`
0.35, `TELEGRAPH_POOL.path`). The Spire adds three kinds to `TELEGRAPH_KIND`, each a seam whose default draws the
gate's own:

- **haven**: a gold disc with a dark keyline and inward chevrons, safe while everything else fills red;
- **lanes**: parallel lanes, a Lattice;
- **tether**: a line between two bodies, in two grammars (section 25.5).

The callers' caps rise to 24 shapes, and at most 32 shape-floor draws a frame (section 11.7). `TELEGRAPH_POINTS_MAX`
(10) and `TELEGRAPH_SPOKES_MAX` (8) stay per-shape limits.

**THE TELEGRAPH BUDGET.** A Court at the legion's cap of 14 adds under Chained Blows, with Pyre-Bound, the Casters'
pools, the lord and a fury chain, passes 24 shapes, and a shape dropped unseen still bites (WB13a T1's class). So
`egShapeOrder(shapes, me, now)` decides what each member's screen draws:

1. every shape whose field holds my feet, or that is aimed at me, always;
2. CHECKs and lords' blows;
3. the soonest to land;
4. the nearest to my feet; ties by id.

Before anything is dropped, same-kind discs merge into one `discs` shape (`TELEGRAPH_POINTS_MAX` 10). The union floor
holds a blow that would be the 25th pending on one member. Pinned: the set drawn for a member always includes every
shape the union floor counted for that member.

**THE QUIET COMPANY.** Eight players' effects must not drown the five lights. During a trial:

- cosmetic auras (Beaconlight's motes, the Burning Stair's embers, Firstlight, the insignia's) draw at nothing, and
  return on plates, at rests and in the recap;
- allies' spell effects draw at 60% alpha with no emission, and allies' hit numbers are off unless
  `port:allyEffects` is *Full*;
- a Vestige aura is one thin blue ring (0.6 m) at its holder's feet;
- a shape aimed at another member fills at 0.55 with its full line, and the shape aimed at you draws on top with a
  brighter rim;
- another member's Watchfire lines show only for blows within 12 m of you.

### 25.5 The grammars

- **Havens**: gold, a dark keyline, inward chevrons; never relying on gold against red, a deuteranopia pair.
- **Tethers, pull-apart** (the Wraith's Drain, the Blood Tether, the soul-wisps): a red line with chevrons pointing
  outward from its midpoint and a tick at the break distance. It thins as the pair nears the break, and snaps with a
  glass's sound.
- **Tethers, stay-close** (Morvayn's Chaining): chain links, slack and dim under 6 m, taut and throbbing (at most 3 Hz)
  from 6 to 8 m, a chip *6.8/8 m*, and *Chained to <name>* under the crosshair. Pinned: the two never share a pattern.
- **Marks on members** (section 13.2): Dagon-red sigils over the head, each its own shape: a hound's tooth (the Scent),
  a gem with its seconds (a soul-mark), a flame or a snowflake with its rim's tint (Fire-touched, Frost-touched), a
  chain, a cage.
- **The peril arrow** (*Cleave - move!*): it searches the union floor's polygon, never crosses a wall or an open edge,
  and prefers a bearing that also clears every other pending shape. Under a CHECK with no exit it shows the CHECK's
  order instead (*Stand in the light!*).
- **The Eclipse** (section 11.2): each moon-shaft's footprint is a haven from 6 s out; the bar shows a chip, *The
  Eclipse - 5*; a wind rises from 3 s out and a toll sounds at the strike; the screen darkens over the last 2 s,
  except the havens.

### 25.6 Readable in the dark and the fog

- Today the pass multiplies every shape by `fogFactorAt`, so the Shade's fog and the Cairn's haze fade it, and it is
  depth-tested, so mist drawn after it covers it. In the Spire, telegraphs, edge lines and white hazards keep a fog
  visibility of at least 0.85 within 30 m, and draw after every transparent volume (mist, smoke, fire falls). A render
  probe pins it.
- In the Shade's dark every foe keeps a rim light, the dormant Lurker aside (section 12). Darkness takes the floor,
  never the warning or the foe.
- Danger shapes keep their grain.

### 25.7 Accessibility

The port's Accessibility tab (`src/ui/settings/settingsMap.js`) holds Motion, Readability (swapping the health and fatigue
colours among it) and the large HUD today, and no danger-colour option. The Spire adds:

- **`port:dangerPalette`**: *Standard*, *High contrast*, *Deutan-Protan*, *Tritan*. High contrast draws the danger
  edge magenta ([1.0, 0.15, 0.75]) with a double keyline and a 45° hatch in the fill, safety solid white-gold with
  chevrons, and the place's hazard dashed cyan. The colour-blind presets are pinned to separate under simulation. Its
  colours ride the pass's existing `uEdgeCol` and `uColor` uniforms; the double keyline and the hatch are a new style
  bit in its fragment shader (EG16);
- **`port:telegraphFill`**: a danger fill's opacity, 50-100%;
- **`port:allyEffects`**: *Full* or *Quiet* (THE QUIET COMPANY);
- **`port:reducedMotion`**, new: today only the system's `prefers-reduced-motion` is read (`src/ui/windowMotion.js`),
  and the Motion section holds head bobbing, recoil, technique motion, motion blur and the vignette. It, or the
  system's setting, governs the stair (section 7) and the shakes;
- the Examination's order is told by numerals and a chime per rune as well as light;
- every blow aimed at you gives you a personal sound (THE SPIRE MIX, section 26).

### 25.8 The rest of the look

- **Fragments** (section 11): painted in each band's kit. The Caverns' fire falls are Daggerfall's own TEXTURE.356,
  lit once EG6b ports `GetFireWallColors32` (section 11.6); magma is the band's molten orange, kept under 0.45 where it
  meets a fight floor.
- **The arch** (section 6.3) and **the stair** (section 7).
- **Weight.** The heavy blows (Savage, Smash, Whirl, Gore, the Maul) shake the screen within 8-10 m by the gate's
  `LAND_SHAKE` law, capped by the player's shake setting. The Spire keeps WB13d's decision of no hit-stop: your own
  hits flash a foe fully, allies' at 0.4. A Drop's landing plays a designed thud and dust, not DFU's hard-landing grunt
  (`applyFallLanding`'s FallHard, past 2.5 m), on a drop the course asked for.

## 26. The score and the sound

Written as notes for the game's own player and FM bank, in `systems/egScore.js`. Each score module writes its own
`makeSong`, as `src/systems/superDungeon/sdScore.js` and `src/systems/gate/gateScore.js` do. The mode is E Phrygian, the Kyn's colour
against the Imperial brass: the Battlemages' fanfare, broken, answered by the legion's drums. A pure law,
`spireScoreFor(place)`, chooses the song. The names are 8-character stems, as every made song's are (GATEWAR1,
HOURWAR1):

| song | where | tempo / length |
|---|---|---|
| SPIREGAL | the Galleries' halls | 100 BPM, 96 bars: three 32-bar variants, seeded |
| SPIRECRN | the Cairn's halls | 88 BPM, 96 bars, the same |
| SPIRESHD | the Shade's halls | 92 BPM, 96 bars, the same |
| SPIREWEL | the Wellhead's halls | 110 BPM, 96 bars, the same |
| SPIREYRD | a Rift-Yard's or a Rampart's trial (the band's motif in the brass) | 132 BPM, 32 bars |
| SPIRESET | a set-piece passage, one 8-bar cue a band | 140 BPM, 8 bars each |
| SPIRLRD1 / 2 / 3 | a Court, by phase, with each lord's own 4-bar motif written into the bed | 138 / 144 / 152 BPM, 32 bars each |
| SPIRVALK | a Valkynaz, all phases, rising, each Valkynaz's own motif | 148 BPM, 48 bars |
| SPIRREDT | a Redoubt taken, and its rest: the Battlemages' hymn | 72 BPM, 16 bars |
| SPIRECNT | the count's last 2 minutes | 160 BPM, 16 bars |
| SPIREEND | the tear, a fall, the end | 70 BPM, 12 bars |

- **One song at a time.** The player plays one song and fades between them, so SPIRECNT REPLACES the song at 2:00,
  except under SPIRVALK and SPIRREDT. The priority table is pinned.
- **Silence is scored too**: the gather and the closing play the band's ambience alone, and a lord's wake is a 2-bar
  drum swell before SPIRLRD1.
- The songs are measured as the Hour's were, by `egScoreProbe.mjs` (under tools/, `tools/sdScoreProbe.mjs`'s law):
  every song sounding, peaks under the ceiling, the war louder by phase, and the end decaying in its time.

**THE SPIRE MIX.** The audio engine (`src/systems/audio.js`) has no voice cap, ducking or priority today, and the gate
stings only for a Meteor or a Leap on your ground (`BOSS_CUES.sting`). Fourteen adds, eight players and the score would
mask the cues that matter. So:

- a personal sting, always, for a lord's blow or a CHECK on your feet; for an add's, at most one each 1.5 s;
- Watchfire's tell at pitch 1.4;
- a critical bus (stings, WIND and release cues, CHECKs) ducks the score by 6 dB for 300 ms and is never culled;
- barks capped at four a kind, nearest first; peers' sounds 4 dB down;
- the reverb is the hall's (section 11.9).

## 27. The HUD, the beats and the first breach

### 27.1 The HUD, by form factor

Today the gate's row (`src/ui/gate/gateBossBar.js`, `BOSS_BAR_WIDTH` 460) sits at 44 px on a landscape phone and drops
its marks row there (`max-height: 480px`), and no gate UI reads the HUD's scale. The Spire's is laid out per form
factor, every part reading `--hud-scale`:

- **desktop**: the count's chip and the Reliquaries' beside the compass, the decrees under them, the potion pip, the
  objective chip; the lord's bar only in a Court;
- **a phone held upright**: one 18 px tabular chip (the count and the Reliquaries), the decrees collapsed to a
  tappable *4 decrees*;
- **a phone held sideways**: the count's chip and a 44 px lord's bar; the decrees in the pause sheet and on each
  arrival card;
- the company's state lives on the party rows (section 27.4), never in a second row of pips; the hall and its band
  only on the arrival card.

Pinned at 1280x720, 390x844 and 844x390.

### 27.2 THE COUNT CHIP

- mm:ss in tabular figures at 18 px: gold above 10:00, white to 2:00, red below, pulsing at 1 Hz in the last 30 s;
- *Held*, with a pause glyph, while the count holds;
- gains fly in: *+15:00*, *+10:00 - the Covenant's Press*, *+3:00 - the last word*, *+1:00* for THE GOLD RUN, and
  *Surplus +1* in blue at the cap;
- warnings, each once a count and never again after a Redoubt raises it: *The Covenant presses. Five minutes.* at
  5:00, a toll at 1:00 and at 0:10, and *The count will not hold through the next Court.*;
- when the last word is nearer than the count, the chip shows the last word's figure with a seal glyph.

### 27.3 The arrival card, the objective, the door

- **The arrival card** (`src/ui/gate/gateTitleCard.js`): *Hall 12 - the Broken Galleries*, the objective beneath, the
  twist as a second line, and at a band's first hall its card; *Hall 15 - the Court* and the lord's card at a Court.
- **The objective**, from `EG_TEXT.objective`, stays as a chip with its progress: *Close the rifts.* (*Rifts 3 of 5*),
  *Fell the standard.*, *Hold the relic.* (*1:12*), *Cross.*, *Break the wards at the portcullis.*, *Turn the Orrery
  true.*, *Fell the champion.*, *Find the way down.*
- **The door** (section 7): a gold beam seen hall-wide, a compass and screen-edge marker, *The way down opens.*, a
  door's sound, and the closing's ring in every hall kind, not only spans.

### 27.4 The party rows

The party panel (`src/ui/partyPanel.js`, PARTY8-B's quiet rows) learns the Spire's states:

- each member's numeral;
- a cracked gold sigil on the portrait once their recall is spent: the company must see who is on their last life;
- a grey row with an eye for a witness; an arch for home; a struck-through name for the forsaken;
- an amber ring draining the 180 s for an absent body;
- the place line reads *High Road* or *Low Road* while the company is split;
- Fire-touched or Frost-touched as its sigil.

### 27.5 Every event is seen, heard and said

Sight, sound and words, for each (`EG_BEATS`, pinned):

| event | sight | sound | words |
|---|---|---|---|
| a cast-back | a 0.4 s dither cut to the waystone, the Steps' rewind burst | the Steps' rewind | *-10%* |
| the pull | the veil's flash | the veil's close | *The Spire pulls you down.* and the toll |
| the door | the beam, the markers | a door's sound | *The way down opens.* |
| a cache | its icon on the door's plaque; taken: the loot banner | a chime | the item's name |
| the fork | two banners on the island: a Reliquary's glint high, a brazier and a stair low | - | *The way divides.* |
| a niche | a blue alcove, dimmed once used | a soft chime | - |
| a Memento | a gold mote; carried, it trails the carrier; set, the niche flares | a bell | *<name> carries Mara's Memento.* |
| THE GOLD RUN | the count's chip | a fanfare | *Gold run. +1:00* |
| a phase turn | the lord's phase card | the drum's turn | its one order |
| a fall | THE FALL (section 16.5) | a low toll | *<name> falls.* |
| a recall | a flare at the beacon, a blue pillar | a chime | *<name> is called back.* |
| a Redoubt | its sequence (section 16.2) | SPIRREDT | *Redoubt 5* |
| a key found | the *Weir Key* banner | the Rare chime (`playRareDrop`) | - |
| the Athenaeum's reward | the Orrery's light | a chord | *The Orrery turns true. A Vestige waits.* |
| a twist | the arrival card's second line | - | its line |
| another walks home | their row's arch | - | *<name> walks home.* |
| the last word | the chip's seal | a toll | *The last word. The breach closes.* |

### 27.6 THE RECAP

A run of up to three hours never ends on a receipt alone. On `end`, and for a member who walks home, both skins show:

- the depth (the hall, the Redoubt, the band), the time from Hall 1's wake, and why it ended;
- a strip per circle: the hall kinds' glyphs, the lord, the falls marked;
- the company: each member's share, healing, falls, recall and how they left;
- the Vestiges held, and the Accords;
- the Reliquaries opening one each 400 ms with the Rare chime;
- the board's line: *The Descent, the Few: 14th*.

The last five runs are kept. At every lord's fall the damage chart shows as the gate's does (FELLED, then the chart,
`src/ui/gate/gateDamageChart.js`, with its Healed column).

### 27.7 The first breach

- **The fixed first circle** (section 7): the Caverns, Grath, every system in its first five halls.
- **First-time lines**, once an account (service bits, `EG_TEXT_FIRST`), each at its first occurrence, never in a card
  before it applies:
  - *The count runs. Take a Redoubt to hold it back.*
  - *The first across opens the door. The others have 45 seconds.*
  - *The void casts you back.*
  - *High and fast, or low and safe.*
  - *A slow lord turns to fury.*
  - *Choose the circle's decrees.*
  - *A Redoubt can call the fallen back once.*
  - *Carry a fallen friend's Memento to a niche.*
  - *Walk home to open your Reliquaries.*
- **THE REHEARSAL**: once a real day, a keyless breach of Halls 1-5 (`/v1/eg/open` with `rh` in its order: no stake),
  with the count and one life but no spoils, receipts or boards. It ends at Redoubt 1 (`why:'rehearsal'`), a wipe or
  the tear, and counts against `EG_LIVE_MAX`. It sets `eg_live` for its life, like any breach, and is never the first
  breach's mercy, having no stake. A scarce key is never the price of learning.

### 27.8 Touch and the pad

Today the right half of the screen is look and Jump is a held button in its corner (`src/ui/touch/touch.js`), so a jump
with a camera correction needs two right thumbs, and the stick sprints only past `RUN_THROW` (0.8). No gamepad rumbles
anywhere in the port. In the Spire:

- a Jump press that keeps sliding becomes look;
- an upward flick on the look half (40 px or more in 150 ms or less) jumps too;
- on spans the stick runs at full throw;
- haptics, behind the existing `touchHaptics` setting: 15 ms when the Beat you stand on enters its last 0.4 s, 30 ms
  on a peril; a pad's dual rumble for the same two, behind the same toggle.

### 27.9 Words

Lines are short (Mac, WB12: *"less explanatory and less AI"*), in the Elder Scrolls' own voice, and follow WB13b's
rules. Every player-facing line is a constant in `EG_TEXT`, worded once and pinned.

## 28. The four hosts

- `src/scenes/world.js` - WIRED:
  - the key's arm and its refusals; the start window and its preflight; the arch pool (`egArchPool`, the gate pool's
    law, standing only verified arches); the call's prompt, horn and portal;
  - the Timers row, the sight line, the company's map mark;
  - the hub's open and the room link; the swap's caller;
  - the HUD and its layouts, the count's chip, the arrival card, the rest window, the recap; the claim queue
    (`createEgClaims`, as `createGateClaims` in `src/net/gate/gateClaims.js` is); *Return to the Spire*;
  - the score, THE SPIRE MIX and the reverb's hold; the flight bans (OR'd into the one ward registration) and the
    technique refusal; the jump buffer; THE POTION LAW's counter; no Resurrect; the AvoidDeath hook answering false;
    a death as a fall;
  - DEATH-PENALTY exempted; THE FALL; the witness view.
- `src/scenes/worldModes.js` - WIRED: `swapEgHall(spec)` beside `enterSdRealm`; `standEgHall(ctx)` beside
  `standSdRealm` (meshes, collider buckets, lights and the hall's fragments, through `egHallParts`); the next hall's
  build during the closing; every swap under `stepThroughFire`; each fragment's clamp; the cull; `madeLevelOf`; the
  AvoidDeath hook.
- `src/scenes/dungeonContext.js` - WIRED: the span's riders (`sdStepsRide`, generalised in EG4) and RIDDEN POSES; no
  foes stream in a made level (every foe is the relay's); the AvoidDeath hook.
- `src/scenes/exterior.js` - FLAGGED: the `?exterior` bench is offline. There is no Elite Breach there, and the key says
  so (*The key is cold here.*).

`scenes/egHall.js` (EG10) is a helper the hosts call, not a fifth host. Every slice record below names all four, each
wired or flagged.

## 29. How the arc keeps the Process rules

`bible/Home.md`'s Process rules bind every change. Where this arc meets each:

- **THE FOUR HOSTS RULE**: section 28, and every slice record names all four.
- **THE MODAL CONTRACT**: `worldModes.frame()`'s Spire branch returns the same type from every exit, and EG10 pins it in
  a test.
- **THE NATIVE-WINDOW RULE**: on the classic skin, the start window is DFU's list picker (section 5). The rest window,
  the Vestige offer, the company's word, the confirm, the board window and the recap are each built from DFU windows
  named per element in their slice's record, or do not draw on the classic skin until they are looked up.
- **THE ONE CONSTRUCTION SEAM**: `egHallParts(spec)` builds every hall's model, collider buckets and riders together
  (section 9), and `madeLevelOf` is the one law of the made levels' rules (section 24).
- **ONE DFU MEMBER, ONE EXPORT**:
  - the gate's constants (`BUCKET_*`, `PHASE_AT`, `SHIELD_MS`, `THREAT_*`, `ATTACKS`, `POOLS`) are imported, never
    copied;
  - `sdSeed`, `rimSpots` and `topWithMe` are exported once and imported (`hostTeamHpFor` already is);
  - the platform clock moves to `net/egSpanLaw.js` once, and `src/world/superDungeon/sdSteps.js` re-exports it;
  - `EG_ESCAPE_MPS` is computed from `runSpeed` at the escape build, never a literal;
  - the span law's copied motor numbers are held equal by a test;
  - one mesh kit (`world/meshKit.js`) and one registry of pseudo-archives (`world/pseudoArchives.js`).
- **A PIN MUST FAIL**: every slice ships `eg<N>_*.test.js` under test/ and its mutant records, `eg<N>.json` under
  tools/mutants/, every mutant dead; laws are pinned with deepEqual against their tables, never inequalities.
- **TEST THE SHAPE THE PRODUCER MINTS**: receipts, orders, specs, fragments and courses are tested as
  `mintEgReceipt`, `identityToken`, `egHallOf`, `egFragOf` and `courseOf` mint them, never as hand-built literals.
- **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD**: the start window, the rest window, the Vestige offer, the
  company's word and the confirm are overlays. Each is closed by the room's `st` or `end`, with the slot nulled first
  and one callback.
- **ASYNC NEVER DROPS**:
  - the open is single-flight on `rq`, and the hub's forward is retried on `ez`;
  - claims are coalesced per (breach, Redoubt, kind);
  - the restack coalesces;
  - every refusal is checked again when its async answer lands.
- **EVERY ALLOCATION HAS AN OWNER**:
  - every exit path (the swap, the tear, the way home, a fall, forsaking, a void, a reload) frees the hall's meshes,
    colliders, riders, telegraph buffers and reverb buffers, its fragments' with them (the court's and the Hour's
    meshes are built once and never freed today; the Spire's are not);
  - band textures are cached per band and freed at the breach's end;
  - the arch pool owns its arches; the reverb's hold is released on every exit.
- **SWEEPS THE SOURCE**: the made levels' rules (section 24), the law files' banned functions (section 9) and
  `RELAY_GRAPH`'s contents are each held by a source sweep, not a reviewer's memory.
- **RETIRING A FLAG DELETES THE SENTENCE**: any INTERIM this arc opens (EG8c's interim Court lord among them) is
  retired by deleting its sentence.
- **A SLICE CLOSES ITS LEDGER ROW**: ELITE-GATES (Ledger A) is narrowed slice by slice, every citing file named in it.
- **A CITE NAMES WHAT IT POINTS AT**: the slices' docs cite by anchor.
- **PATCH NOTES LIVE ON THE PULL REQUEST**: each player-facing slice writes its notes in its pull request's
  description, under `## Patch notes: <title>`, never as a file.
- **UPDATES ARE NUMBERED, AND NOBODY BUMPS THEM**: no slice writes an update number.
- **DO NOT FIX WHILE THE VERIFIER IS READING** (17l): every audit of this page, EG21's included, freezes the page
  before its lanes read and edits nothing until every lane has returned.
- **Frame-synced probes**: EG10's and EG16's Playwright probes of the halls frame-sync on the shot-mode `__frame`
  counter, never sleep.
- **Scripted bible edits ASSERT their needle**: every scripted edit of this page or its record checks that its needle
  matches exactly once.

## 30. What it does not do, said so

- **No Abyss Breach.** The gate's third tier is named (section 2) and not built.
- **No revive past the recall.** One recall a breach, at a Redoubt or by a Memento; no Vestige, spell, Cantrip or power
  raises the fallen again.
- **No company changes.** One who joins the party after the open is not in the breach.
- **No trading or selling keys.** They are the account's.
- **No Elite Breach offline**, the Rehearsal included. Offline there is no relay to run it.
- **No ordinary dungeon foes inside.** Every foe in the Spire is the relay's, or the one life would be a client's word.
- **No Gilded piece.** The Hourlock stays the one.
- **No Morrowind architecture.** The Morrowind layer has no statics, cell or collision path (it reads `STAT` records
  only for spell effects), so every fragment is the port's own geometry.
- **No real Daggerfall blocks inside.** The relay reads no BSA and could not know their floors.
- **No weekly seed.** The budget (section 9) makes halls of a depth weigh the same, and a shared seed would make the
  boards a race to scout it. The week's Proclamation (section 20) is a rule, not a seed.
- **No pause.** The count holds by its own rules and the respite budget, never on a member's word.
- **Nothing gets faster.** No depth, decree, tide, stratum or fury shortens a wind-up, a piece's timing or a crumble.

## 31. Slices and their records

The order the arc ships in. Each slice can ship and be checked without the next, and the content arrives band by band.
Every slice ships its tests (`eg<N>_*.test.js` under test/) and mutant records (`eg<N>.json` under tools/mutants/),
every mutant dead, and its record names the four hosts and the Ledger rows it opened or moved. Each band's kit ships
its band's art: no slice ships a placeholder. EG8 to EG12 ship behind `EG_OPEN=false`, opened by EG13.

| slice | what | moves |
|---|---|---|
| **EG0** | this page | the bible |
| **EG0a** | AUDIT EG0 | the bible |
| **EG0b** | the fragments (sections 11 and 8.8 as first written) | the bible |
| **EG0c** | AUDIT EG II, the polish pass | the bible |
| **EG1** | THE GATE'S TIERS: `systems/gateTier.js`, `GATE_TIER_TEXT`, the Regular tier's words unchanged; THE REGISTRY: `world/pseudoArchives.js`, every port archive in it, and its collision test | client |
| **EG2** | THE WEIR KEY: template 575 and its art; the balance (migration); the rolls in `claimGate` (which gains `rand`) and `claimSd`; the pity; `/v1/eg/find`, the killer's ask and the caps; `/v1/eg/keys`; the restack, new; the launch gift (a send migration) | client, service |
| **EG3** | THE BOSS SEAM: `net/bossSeam.js`; the gate, the Remnant and the serpent re-plugged, frames and pins unchanged; the trails keep y | relay (a version) |
| **EG4** | THE COURSE AS DATA: `courseOf`, with the Hour's course byte for byte, and every reader fed; the platform clock moved into `net/egSpanLaw.js`; `orreryOf` widened and `orreryJudge` extracted, with the Hour's draw and judge unchanged | client, relay (a version) |
| **EG5** | THE HALL LAW: `net/egLaw.js` (the record, the clock and its holds, the rhythm, the circle, the variants, the bands, the spec, the decrees, the recast trials and their effects, `egFightProfile` and its validator, the waves); the law's integers, `lawSin`/`lawCos`, the source sweep and the spec's digest; `sdSeed` exported; `arenaWeekOf`; the standing decrees and the frames' nine | client, relay bundle |
| **EG6a** | THE SPAN GENERATOR AND THE TIMED SOLVER: `egSpanOf`, the solver in the law (windows, no queues, the median, ceilings, shafts, the crossing's bound at the fast build), `egSpanSolve.mjs`, the Drop and the other Galleries pieces, the toll, the Galleries' sweep (25 seeds a pull request, 500 nightly) | client |
| **EG6b** | THE FRAGMENTS: `net/egFragLaw.js`, the sockets and the volumes; the Oblivion Caverns kit (passage, chamber, shaft) with its art; the dressed platforms and their tells; THE EDGE LINE; THE FORK (its foes from EG11); the Collapsing Tube; `world/meshKit.js`; the instanced moving-piece pass; the cull; telegraphs per fight floor; THE WIDTH RULE; the fragment's clamp; the camera in rock; the reverb's hold and crossfade; `GetFireWallColors32`, with audit39 re-pinned; the budgets measured on SwiftShader and a reference phone | client, relay bundle |
| **EG6c** | HERO FRAGMENTS: `fragBake.mjs` (under tools/), and each fragment Mac authors with its law markers and its byte-for-byte test | client |
| **EG7** | THE MADE LEVEL'S RULES: `madeLevelOf`, `MADE_LEVEL_RULES` (THE POTION LAW, AvoidDeath, technique flights and the jump buffer among them) and the sweep test; the Burning Court and the Hour re-plugged unchanged | client |
| **EG8a** | THE ROOM AND ITS ORDERS: the `eg:` family, the orders (`ORDER_KINDS`, `EG_ORDER_FIELDS`), the hub's open (`EG_INTERNAL_OPEN` retried, `eglive`, `egrc`, the signed call), presence, the tick, the Rehearsal's `rh` | relay (a version), service |
| **EG8b** | STAKES AND `eg_live`: stakes, voids, the first breach's mercy, `eg_live`, `claimEg`'s `x` and `v` arms (a void returns a key from this slice on), the key-loss paths | service, relay (a version) |
| **EG8c** | THE DIRECTOR AND THE WAVES: `net/egBrain.js` (the stages, the count and its holds, the closing, the pull, the company's word), `net/egHost.js` with the gate's three kinds lifted, THE GOLD RUN, the numerals, the secret receipt seeds, and an INTERIM Court lord (the Proving champion's kit) so a Redoubt can be reached before EG13 | relay (a version) |
| **EG8d** | INTEGRITY: THE FAIR TRAIL and its time law, `judgeShapes` and the full shape stamp, the hazards judged, `net/egFloor.js` (THE UNION FLOOR in time), RIDDEN POSES (`pl` in `validPose`), the clock's correction, the feint's `cut`, `untell` | relay (a version), client |
| **EG8e** | DURABILITY: saves to storage, THE HOLD, THE DRAIN, the law pin (seven days of `EG_SPEC`, `{k:'spec'}`), time across a restart | relay (a version), deploy |
| **EG9** | THE ARCH AND THE CALL: the arm, the refusals, the start window (`/v1/eg/starts`, the ticks, the Wager, the Rehearsal's choice), the arch pool, the pass's per-draw membrane and beacon and `GATE_PASS_MAX`, the clear sweep's keys, the signed cell word, the call's prompt and horn, the portal, the landings, the Timers row, the sight line, the map mark | client, service |
| **EG10** | THE HALLS ON THE PAGE: `world/egHall.js`, `scenes/egHall.js`, `egHallParts`, THE SWAP (the build during the closing, the free pins), the stair and reduced motion, arrival, gather, closing and pull, the HUD's layouts and THE COUNT CHIP, the arrival card and the objective, the flight bans and the technique refusal, the jump buffer, the cast-back, THE FALL, DEATH-PENALTY exempted, *Return to the Spire*, the fixed first circle and the first-time lines, the Rehearsal, touch and the pad, `EG_BEATS`, the modal contract's pin, frame-synced probes | client |
| **EG11** | THE HALL KINDS, THE TWISTS AND THE LEGION: the Rift-Yard and the Wellspring, the Span, the Rampart and the Falling Wall (bastions, waystones), the Athenaeum, the Proving Walk and its champions, the Deepway, the chambers and their play; kinds 3, 4 and 6 and ROLE READS; the push; haven, lanes and tether; the callers' 24 shapes, THE TELEGRAPH BUDGET, THE QUIET COMPANY, THE SPIRE DANGER EDGE; caches, Cantrips, lumen and the Sutler; the Caverns' sluice and the alcoves; the potion pip | client, relay (a version) |
| **EG12** | THE REDOUBT: receipts, the spoils (`systems/egSpoils.js`), Reliquaries, the sequence, the rest, the pressed way home, the Vestiges (law, offers, Masteries, Accords, shards, effects, the relay's half, the caps, resonance, the death saves), the fallen (the recall, the Memento and the niches, THE WITNESS VIEW, the bequest, forsaking), the company's word and the living ping, the surplus and the respite budget, the party rows, the receipts' fields (`fl`, `lb`, `ft`, `td`, `wg`), THE RECAP | client, relay (a version) |
| **EG13** | THE GALLERIES' LORDS: Grath, the Last Spellmaster, the Last Armsmaster, Valkynaz Ilthys (`net/egLord.js`), each with its phases, beats, marks and errand pins for *n* = 1 to 8; fury; errands by numeral; the wake ring; THE COVENANT'S PATIENCE; THE SEAL; the Galleries' other fragments (the Fallen Stacks and its shelf, the Broken Colonnade); the INTERIM Court lord retired; `EG_OPEN` opened | relay (a version), client |
| **EG14** | THE CLAIM, THE ECONOMY, THE HONOURS, THE BOARDS: `claimEg`'s `w` arm, the migrations, the week's pay, the embers, the pity, the Valkynaz's key, the Broker's sink, the named Legendaries, the feats, titles and auras, the three boards and the board window, the Proclamation, the Wager, the season's champions, the Annals, `BOSS_BODY` on in `eg:` rooms (after EG8d), the herald | service, relay (a version), client |
| **EG15** | THE PANOPLY AND THE CARDS | client |
| **EG16** | THE LOOK: the arch's skin, the stair, the skies (the Spire's underside in every sky, smaller each band), `port:dangerPalette`, `port:telegraphFill`, `port:allyEffects`, the lab checks, frame-synced probes | client |
| **EG17** | THE SCORE AND THE SPIRE MIX | client |
| **EG18** | THE SOUL CAIRN: the Cairn-Keeper, the Twin Lords, Valkynaz Morvayn, Binders and Wraiths (kinds 7 and 8), the Gust and the Rail with their sweep, the Ossuary, the Mist Stair and the Sinking Stair, the Muster and the Winch, the soul-bell, Hall 26's Brink, the Cairn's art | relay (a version), client |
| **EG19** | THE SHADE PERILOUS: the Mother of Dusk, the Night-Stalker, Valkynaz Seyth, the Divers (kind 5), the Pendulum with its sweep, the Gloam Thicket and its Hollow Trunk, the Eclipse Vault, the Moon Path, the Holdfast and the Gauntlet, the moon-mirror, Hall 51's Brink, the Shade's art | relay (a version), client |
| **EG20** | THE HAVOC WELLHEAD: the Bound Colossus, the Wellhead Wyrm, Valkynaz Garoth, the Vent with its sweep, the Daedra Lord elite add, the tides, the strata, the Forge Gut and its Slag Chute, the Clan Pit, the deep Caverns, the Forge Line, the drop-hammer, Hall 76's Brink, the Wellmouth and the Forge Bridge, the Wellhead's art | relay (a version), client |
| **EG21** | THE TUNING PASS AND AUDIT EG III: the budget, the count and the pace measured in the field; whether the crossing's bound becomes a gate | all |

Each slice's record goes below as it lands: what shipped, its pins and mutant records, the four hosts, the Ledger rows
it opened or moved, and where it departs from this page.

### EG0 - written 2026-10-11 (the page)

The design, whole, before any code. Grounded in the shipped tree at `d9a3ced2`:

- the gate's clock (`src/net/gate/gateLaw.js`);
- the made levels (`src/world/gate/gateArena.js`, `src/world/superDungeon/sdRealm.js`);
- the brains and their shared hand (`src/net/gate/gateBrain.js`, `src/net/superDungeon/sdRemnant.js`);
- the marks (`src/net/gate/gateMods.js`, `src/net/superDungeon/sdMarks.js`);
- the Steps (`src/world/superDungeon/sdSteps.js`) and the engine's envelope (`src/player/motor.js`, `src/player/parkour.js`);
- the party (`PARTY_MAX` 8) and the hub's rosters;
- the receipts and their claims, the boards (`server-account/src/arena.js`) and the Portal Stone.

THE FOUR HOSTS: `src/scenes/world.js`, `src/scenes/worldModes.js`, `src/scenes/dungeonContext.js` and
`src/scenes/exterior.js` are all untouched. A page moves no host.

### EG0a - AUDIT EG0 - 2026-10-11 (Mac: "Do a comprehensive audit and ensure this is the best and most detailed it can be")

Five cold lanes on the frozen first draft (177a3acd6), no edit made until every lane had returned (17l):

- code truth, about 210 claims checked;
- numbers and consistency, with simulations of the pace, the motor and the drifts;
- architecture, trust and failure;
- game design and the player's experience;
- lore, words and the bible's rules.

There were **105 findings**: 31, 23, 17, 16 and 18. A sixth cold lane then re-read the revision against every
row and found **28** more (3 HIGH), each fixed in place. Each was verified against the tree, the maths or UESP, and each
has its verdict and its place in the revision in `01-Overview/audits/Audit-EG0.md`. The revision moved the page whole:

- **the lore** set right: the Spire's fate, a Valkynaz a warrior duke, the door held by the key and not a lord's will,
  and the torn halls marked as the port's invention;
- **the words** renamed: Weir Key, Redoubt, decree, the Vestige families, lord;
- **the protocol** rebuilt: the hub's open, stakes and voids, `eg_live`'s expiry, orders fit to `identityToken`, the
  drain, the law pin, durability;
- **the floors**: the escape build, the union floor, the CHECK class, the errand floor, and nothing faster;
- **the fallen** given a recall, a witness's seat and a bequest;
- **the risk**: Reliquaries;
- **the economy** rebalanced: weekly pay, embers where earned, a pity count, a sink;
- **the boards** made honest: the Descent from the first hall, by bracket;
- **the pace** re-modelled: the walls now stand where the rules put them.

THE FOUR HOSTS: untouched, as at EG0.

### EG0b - 2026-10-11 (the fragments; Mac: "sometimes platforms can lead to oblivion caverns, or different types of modeled areas instead of simple platforms")

The fragments were written as sections 10.1-10.8 and 8.8 (section 11 and section 8.8 since EG0c):

- **fragments** (passages, chambers and shafts), with a library of ten across the four bands;
- every platform dressed, the top you see being the top you stand on;
- THE FORK (the High Road and the Low Road);
- the Deepway;
- chambers for Yards, proving courts and the lords' grounds;
- the fragment record, a law half the relay reads and a mesh half it never sees;
- code-built kits and authored hero fragments, with one mesh kit and one registry of pseudo-archives;
- fight floors, telegraphs per floor, walls that bound the escape, and THE WIDTH RULE (the Charge, the Dive, the Lunge
  and the Rampart's vents widened to 3 m; EG0c widened every aimed blow to 4 m);
- headroom for both third-person cameras;
- light, sound, budgets and the cull.

They are grounded in:

- the gate's and the ships' bakes (`tools/bakeGate.mjs`, `tools/shipBake.mjs`, `tools/fbxMesh.mjs`);
- the collider (`src/player/collider.js`);
- the telegraph pass, and how flat it is (`src/render/gate/gateTelegraph.js`);
- `deepIn`'s margin (`src/net/bossBody.js`);
- the cameras (`src/player/mwCamera.js`, `src/player/eyeOfTheBeholder/eotbCamera.js`);
- the light caps;
- the reverb presets;
- TEXTURE.356, the Mantellan Crux's fire walls.

THE FOUR HOSTS: untouched.

### EG0c - AUDIT EG II - 2026-10-11 (Mac: "Im really looking for AAA grace quality when it comes to everything implemented. Do a detailed polish pass and audit")

Six cold lanes on the frozen page (14b3b172f), no edit made until every lane had returned (17l):

- code truth, about 240 claims checked;
- numbers and consistency, with the pace model, the motor's carries and `deepIn` swept;
- AAA game design, against Hades, FFXIV's deep dungeons, Mythic+, Destiny, Elden Ring and their kin;
- architecture, performance, netcode and failure, with the collider, the mesh build and the reverb measured;
- prose, structure and the bible's rules;
- presentation, feel and accessibility.

There were **282 findings**: 25, 37, 44, 46, 90 and 40. Each has its verdict and its place in this revision in
`01-Overview/audits/Audit-EG-II.md`. The polish moved the page whole:

- **the structure**: section 6 numbered, the fragments their own section (11), and every section after it renumbered
  once, before any code cites the page; the words table rebuilt, with five overloaded words split ("the descent"
  became the closing, the Descent piece the Drop);
- **the truth**: TEXTURE.356 draws unlit today, the fall's share retirement is new, `fbxMesh.mjs` cannot bake a scene,
  the Jump spell steers in the air, AvoidDeath must be refused, a 3 m lane is invisible to the relay (4 m now);
- **the netcode**: THE SWAP in place of an exterior round-trip, RIDDEN POSES, the corrected clock, the fair trail's
  time law, secret receipt seeds, an exact law with a spec digest, THE UNION FLOOR in time, THE HOLD;
- **the halls**: variants for the Yard and the Rampart, bastions and waystones, champions with signatures, the wake
  ring, the Brink halls, twists from circle 2;
- **the fragments**: a signature each, set-piece passages, a fork at every span, chambers that play, engines, alcoves
  and the Annals, measured budgets, instanced pieces, a fragment's own clamp;
- **the lords**: phases for every lord, the Valkynaz on their own ground with their own kits, the Scent and the havens
  made fair, errands by numeral;
- **the run**: the count held between halls, THE COVENANT'S PATIENCE, the respite budget, the Memento, the witness
  view, the company's word, Mastery Vestiges and Accords, healer Vestiges, caches, Cantrips, lumen, the Sutler, THE
  POTION LAW, key pity and the first breach's mercy, the Valkynaz's key, strata, the Wager, the Proclamation, THE SEAL,
  named Legendaries and feats;
- **the presentation**: THE SPIRE DANGER EDGE, the five lights' contradictions resolved, THE EDGE LINE, THE TELEGRAPH
  BUDGET, THE QUIET COMPANY, two tether grammars, the danger palette, THE COUNT CHIP, layouts per form factor, a beat
  for every event, THE FALL, THE RECAP, the first-time lines, the Rehearsal, touch and the pad, THE SPIRE MIX, and a
  score that does not loop to death;
- **the pace** re-modelled again (`pace3`): about 6 / 11 / 12 / 15 from Hall 1, and a season's ceiling of about 16 /
  39 / 57 / 88;
- **the slices**: EG8 split five ways, every system given a slice, each kit with its band's art, the registry in EG1,
  and an INTERIM Court lord so the Redoubt can be reached before EG13.

THE FOUR HOSTS: untouched. A page moves no host.
