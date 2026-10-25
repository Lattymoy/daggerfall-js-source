# Elite Gates - the Elite Breach and the Battlespire's torn halls (EG)

> Design page, written 2026-10-11 before the arc's first slice. The same day it was revised by AUDIT EG0 (five cold
> lanes on the first draft, 177a3acd6, 105 findings, then a sixth lane on the revision, 28 more:
> `01-Overview/audits/Audit-EG0.md`), widened by EG0b (the fragments), and polished by AUDIT EG II (six cold lanes on
> 14b3b172f, 282 findings: `01-Overview/audits/Audit-EG-II.md`). EG-PLAY (section 31) then built the first playable Elite
> Breach - a vertical slice through the slices below, its departures from this page listed in its record. AUDIT EG III
> audited the arc as built (six cold lanes on 6b86b534, 112 findings: `01-Overview/audits/Audit-EG-III.md`), AUDIT EG IV
> through its ten heroes (`01-Overview/audits/Audit-EG-IV.md`), and AUDIT EG V the whole arc again (nine cold lanes on
> 9a862e8d, 158 findings: `01-Overview/audits/Audit-EG-V.md`). The code's comments cite this page by section number;
> where the page and a pin disagree, the pin is what runs. Each slice adds its record under section 31. A path that
> exists today is written from the repository root (`src/net/gate/gateBrain.js`); a path this arc will create is written
> without `src/` (`net/eliteGates/egLaw.js`).

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
  about one trial hall in four from circle 2, and three Brink halls carry the company from band to band.
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
row of its own, `WEIR_KEY_ROW` in `src/systems/eliteGates/weirKey.js`:

- `{index:575, baseWeight:0.25, hitPoints:1000, basePrice:500, rarity:20, bound:true, stackable:true, packOnly:true}`
  (the leaf `WEIR_KEY_LAW_ROW`, `src/systems/eliteGates/weirKeyRow.js`, since KEY-LAW; pack-only since KEY-FACE, below), in the
  miscellany group (`UselessItems2`), never a gem (PORTAL1's lesson: every Gems piece is a crystal a slot takes);
- its art: a Battlemage's key in gold leaf with a blue stone in its bow, painted in code under the Spire's held archive
  block (`src/world/eliteGates/egKeyArt.js`, EG-ZH), which EG1's registry holds - never a borrowed record, because Port-Doctrine
  allows no placeholder shipped silently;
- named in `BOUND_TEMPLATES` (`src/net/realm/realmTradeLaw.js`), so the realm's trade refuses it as the client does;
- its line (`EG_TEXT.keyLine`), on its info card under its name and weight, as the Portal Stone's card is built
  (`src/systems/item/itemInfo.js` `survivalInfoTokens` - AUDIT EG V): *One of the Spire's portal keys, surrendered to the Kyn
  in 3E 398. It opens the Weir Gate's road from this side.*

**The balance is the account's.** Every dungeon drop is the client's own `Math.random`: the Integrity arc's ledger
(`06-Systems/Integrity-Arc.md`) measures it after the fact and does not enforce. A key from a forged drop would open a
real relay instance, so the key is a service-side balance and the item is its face.

- `players.eg_keys` (migration, EG2) is the balance. The service-side precedent is the Broker's purse: `insigniaPurse`
  over `EMBERS_EARNED_SQL`, which is gate and serpent embers less `insignia_spent` (`server-account/src/accounts.js`).
- **No code today restacks a pack to a service count.** `restackStones` is SS1's load-time fold in the save, and on
  an insignia sale the client simply takes the stones from the pack. EG2 builds the restack: every service answer
  that carries the balance (`/v1/eg/keys`, a claim, an open, the start window's preflight) sets the Weir Key stack on
  the account's character to the balance, in the order the asks went (ASYNC NEVER DROPS): each ask takes a number as it
  goes, and an answer landing after a later ask's was applied is never applied over it; a balance the screen did not
  ask for (a gate's claim's key) is as new as its landing, and the balance is asked again after it (AUDIT EG IV).
- A key the service does not count does nothing: an answer that takes a key the pack showed - past the one its own open
  staked, and those a lost open's answer took unseen (section 22) - says *The key turns to rust.*, and the stack is
  restacked (AUDIT EG IV).
- It is bound to the account, never traded, and never lost to a death.
- **The face is the pack's alone** (FIELD BUGS 2026-10-19f KEY-FACE). The restack reads the pack and nothing else
  (`weirKey.js:"  const held = items.filter(isWeirKey);"`), so a face anywhere else is a key it cannot see. The row was
  bound and not pack-only, and a bound piece goes to the wagon and the player's own storage (`itemBound.js`
  `BOUND_KEEPS`): a face stowed there left the pack showing none, the next answer gave it a new one, and the stowed ones,
  carried back, showed keys the account never held - every one of them rust at the next use (a player's private report:
  a pack of keys gone at one use). So the row is **pack-only**, the Wallet's law (`06-Systems/Wallet.md`; `isPackOnly`):
  both skins refuse the wagon and every storage (a home's chest, a ship's hold, a companion's pack) in its own words,
  *Weir Key stays in your pack.*, and the doors that are no window's - a room's decoration (`decorStandOf`), a revenant's
  take (`revenantMayTake`), the shift-drop (`physicalItems.js` `shiftDrop`) - read the same mark; the trade, the counter, a
  death in the zone, a salvage and a peer's list refuse it as a bound piece already. A save from before holds faces out
  of the pack; it loads with every one folded away (`foldStrayWeirKeys`, called from `save.js` restorePlayer beside the
  load's item repairs, over every list the save holds but the pack - the one walk, `savedItemLists` - and a room's own
  things, `decorOwn`), so the account's balance restacks the pack whole and nothing turns to rust. A face the find threw
  on a body and the player never took up is folded the same way at the next load. OPEN: that throw is the one face
  still made outside the pack - taken up only after a later answer restacked the pack to the whole balance, it leaves
  the pack one over, and the next answer says the rust line for it (the account loses nothing). Pinned:
  `test/net/eliteGates/fb1019f_keyface.test.js` (5), `tools/mutants/fb1019f_keyface.json` (13, all dead).

**Where they come from.** The service rolls every one with its own `rand`, at a claim it already verifies. This is
the `sdHonoursRoll` way: AUDIT SD III R4 moved the Hour's honours off the receipt seed because the page can read the
seed. `claimGate`'s context gains `rand`, which it lacks today (`claimSd`'s has it).

| source | when the service rolls | odds | what that means |
|---|---|---|---|
| **Dagon's Breach** | `claimGate`, a recorded kill (`earned != 'rite'`) | **1 in 6** | at one or two gates a real day, a key every three to six days |
| **...having broken the rite** | the same, with `r=1` | **1 in 4** (instead) | the rite is the gate's harder half (WB12d) |
| **...the first ever** | the account's first `gate_kills` row with `earned != 'rite'` | **certain** | every gatebreaker sees the Spire once |
| **...the pity** | after `EG_KEY_PITY` (5) recorded kills in a row without a key, the sixth gives one (`players.eg_key_miss`) | **certain** | nobody goes a week of gates with nothing: (5/6)^12 left 11% with no key in twelve kills |
| **a Valkynaz's Redoubt** | `claimEg`, a `w` receipt for a Valkynaz's Redoubt | **1 in 4** (`EG_VALK_KEY_ODDS`), at most one an account an arena week (`players.eg_valk_wk`) | the Kyn wear the keys (section 3): a company deep enough keeps itself in keys |
| **the Abyss Dungeon's Remnant** | `claimSd`, a recorded Hour | **1 in 3** | the hardest fight the port has, witnessed by the relay |
| **an Abyss Dungeon's elite foe** | `/v1/eg/find`, below | **1 in 60** | six elites a Hollow: about one Hollow in ten |
| **an Elite Dungeon's elite foe** | `/v1/eg/find` | **1 in 150** | three or four a dungeon: about one in forty |
| **a Regular Dungeon's elite foe** | `/v1/eg/find` | **1 in 400** | one dungeon in five has one: about one in two thousand |

The gate's key is written in its claim's own transaction, directly after the kill's row and only by the claim that
wrote it (`server-account/src/eg.js` `egGateWeir`): a failure takes both, and *the first ever* is decided by that row -
no recorded kill of the account's before it - so two receipts claimed together can no longer both miss it (AUDIT EG
IV). The Hour's roll still follows its row.

**The first breach's mercy.** An account's first opened breach that ends before its first Redoubt is taken returns its
stake, once ever (`players.eg_mercy`). A solo player who falls in Hall 2 has learned the Spire, not lost a week. It is
the BREACH's end, not the opener's: the relay says so on the end receipts of a breach over with no Redoubt taken (`nr`,
section 23), and the opener's own end before that word - a fall, a forsaking while the company plays on - holds the stake
for it, so the company's Redoubt 1 spends it. The first is the first key the account staked that the Spire kept: a
breach a void gave back whole is not counted (AUDIT EG III).

**The dungeon's find.** No relay witnesses an ordinary dungeon, so the killer's client asks for the find. When an
elite foe (`eliteFoe`) dies in a dungeon online:

1. **who asks**: the death handler (`registerEnemyDeathHandler`, the seam `dropFoeCard` uses for a foe's card) runs
   on the foe's owner, which names the striking joiner's peer id on the foes stream (`_killedBy`, the record's `v`,
   for `KILLED_BY_MS`). The client whose `selfId` it names asks `/v1/eg/find` with the dungeon's tier, not the
   owner's. When `v` is null the owner struck, and asks itself;
2. **the roll**: the service rolls at that tier's odds;
3. **a yes** adds one to the balance and throws the item from the body, as a card is thrown.

A body that is the dungeon room's (PARTY-LOOT, main's - the merge of main into PR #800): every client in the room rolls
its death on the room's dice and shows that base list, so the find never answers that raise (it is marked `room`,
`scenes/roomLootHost.js` roomBodyBase). The kill asks at the host instead (`systems/eliteGates/egFind.js` egFindKill - the owner
for its own kill, the joiner at its door as above), and a key found on such a body goes to the finder's pack whole: on
the copy's items nobody would see it, and on the base it would be the room's.

A forged client can lie about a kill and a tier, so:

- asks are capped at **6 a tier, per account, per real day** (`EG_FIND_PER_DAY`). At the cap a forger's ceiling is
  6/400 + 6/150 + 6/60 ≈ **0.155 keys a day**, under an honest gatebreaker's 0.17-0.5;
- finds pay at most **2 keys a week** (`EG_FIND_KEYS_PER_WEEK`);
- `/v1/eg/find` and `/v1/eg/open` both need a handle and either a non-rite `gate_kills` row or a Redoubt taken, so a
  fresh account cannot farm or open.

The Integrity arc's budget measures the asks.

**The launch gift.** When EG2 ships, every account with a non-rite `gate_kills` row gets one key. The migration adds
it to `eg_keys` itself, and a server-post letter (`server_post`, batch `spire-launch`, no item) only words it, *From
the Battlespire* - its words `server-account/src/eg.js` `EG_LAUNCH_POST`, the migration's statement held to them. The
send is HOURS-FIRST's precedent (migration 0094). PORTAL-GIFT is not: it is a client-side gift given at save load.

**Using it.** Use is a registered arm (`registerItemUseHandler` -> `{kind:'openBreach'}`), routed on every reader as
the Portal Stone's is. Its refusals, in order, each a line of `EG_TEXT`:

1. offline, or on the `?exterior` bench: *The key is cold here.*
2. not in the open world (an interior, a dungeon, a made level): *The key wants open sky.*
3. the Portal Stone's holds (`portalHold` in `src/systems/portalStone.js`: busy, duel, siege, enemies, journey),
   water, or a boat;
4. inside a location's own footprint (a town's walls, a farm's yard): *Not within <place>.*
5. within 300 m of a standing Dagon's Breach, or 150 m of another Elite arch: *Another breach stands near.*
6. the opener already in a breach - the call they hold or the Spire they stand in, and the service's `eg_live` (section
   23): *You hold a breach already.* A stake its opener's own end left held for the first breach's mercy, while the
   company plays on, holds them back no longer: they are out of that breach, as AUDIT EG IV's empty end freed them
   (AUDIT EG V).
7. the hub at `EG_LIVE_MAX` live breaches, or a deploy's drain (section 22): *The Spire's road is shut. Try again
   soon.*
8. no room for the arch: the Portal Stone's `portalPlace` law (ground probe, wall gap) at the arch's clearance,
   `EG_ARCH_CLEAR_M` 8 m: *There is no room for it here.*

Then the **start window** asks where in the Spire. `/breach` with no call of the company's standing opens it too, behind
the same refusals: a keyless player's door to *Rehearse* (AUDIT EG V). Its preflight is judged again as it lands - a
screen let go meanwhile, or a refusal come to stand (a step indoors), opens no window:

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
- **the enhanced skin** asks in a breach window of its own (`src/ui/eliteGates/egStartPanel.js`, EG-PLUS in section 31):
  a tile per start with each member's mark, the Wager's decrees as tiles by family, Open the breach on its dock;
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
    - no other live breach (`eg_live`);
    - that the breach is one an open staked, its stake unsettled and its open window not past (refused `breach`,
      `spent` - AUDIT EG III: an id no open staked read as a Hall 1 start, and a late ask locked its asker out).
  - The member's hello to `eg:<b>` carries the order. The room spends it once, then checks the member is in the
    company, not forsaken, not gone home, the open window, and that the order's start is the breach's. A member it
    counts already returns without spending anything - a reload, and a fallen member as a witness (section 16.5).
  - An order lives `ORDER_TTL_S` (a minute) from its signing, so the screen asks again for one it has kept past half of
    it (`EG_ADMIT_FRESH_MS`, `scenes/eliteGates/egClient.js`) - at the answer, and in the hall before the hello's `in`, for a portal
    stepped into late or a slow step under the veil outlives a minute - and lets a refused one go whole, asking again
    (`EG_ADMIT_ASKS` times a breach in the hall). AUDIT EG V: a dead order was reused, and once refused never asked
    again.
  - The level claim (`lv`, 1-60) is frozen at the first admission.
- **Outside the company.** Touching the arch: *The breach answers only to <opener>'s company.*
- **One breach at a time** for every account, opener or member, enforced by the service's `eg_live` (section 23). The hub
  calls the opener's whole frozen company, a member still in another breach among them: that screen keeps the call
  beside the breach it stands in, its hall and its fight untouched (`net/eliteGates/egLink.js` `egLiveHeld`), and the call is
  answerable once that breach is behind it (AUDIT EG V: the call had wiped the breach the member stood in).
- **The absent.** A member whose socket is gone keeps their body at its last pose (the socket flap rule, section 22).
  - They are counted fallen only after **180 s gone in a trial** (`EG_ABSENT_TRIAL_MS`), counted from the trial's wake.
    Absence on the stair or at a rest never counts. A reload, or a slow machine on the stair, is not a fall.
  - An absent body is never chosen as a target. A shape aimed at another member still lands on it, so a tab closed
    before a blow is not a life saved. Nor is one whose socket stays open and says nothing - a member standing still,
    a backgrounded tab, a client holding its poses back: the room holds every living member's body at its newest pose
    (section 21, AUDIT EG V).
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
| the pull to the wake (the swap and the gather together) | HOLDS - at most 38 s: the wait's `EG_ARRIVE_MAX_MS` 30 s and a gather begun in it, whole (section 7), so it needs no bound of its own | a slow machine's loading is never the company's time |
| the rest (90 real s) | HOLDS | *The Redoubt holds the count* is shown by the count's chip, never said |
| a respite | HOLDS | from the breach's respite budget (below); the last word does not hold |
| a deploy's hold (section 22) | HOLDS | the gap is given back |
| a Court's fight when the count is spent | THE COVENANT'S PATIENCE (section 18) | the Court finishes under the Covenant's Weight |

Constants (`net/eliteGates/egLaw.js`): `EG_RISE_MIN` 60, `EG_ADMIT_MAX_MIN` 60, `EG_COUNT_START_MIN` 360, `EG_REDOUBT_HOLD_MIN`
180, `EG_COUNT_CAP_MIN` 360, `EG_REST_S` 90, `EG_CLOSING_COUNT_S` 15 and `EG_LAST_WORD_MIN` 2160, each beside the
milliseconds the relay reads (`EG_SEALED_MS` the sealed hour's, the rest their own `_MS` names). The respite's are the
director's (`net/eliteGates/egBrain.js`): `EG_RESPITE_BUDGET_MS` 900 s, `EG_RESPITE_VALK_MS` 600 s, `EG_RESPITE_STEP_MS` 120 s.
`egTimes(rec)` answers every phase's relay time and `egPhase(rec,
ms)` the phase: `'rising' | 'sealed' | 'open' | 'deep' | 'torn' | 'ended'`. These are `gateTimes` and `gatePhase`
again, for a record instead of a day. A Redoubt's time is ONE law, the director's own (AUDIT EG III): `egCountRedoubt(c,
now, lastWordLeft, hold)` with `egRedoubtHold(press)` its hold under the Covenant's Press, and `egCountOver` what the cap
turns away toward a Surplus, which THE GOLD RUN banks the same way.

**The respite budget.** Every breach has `EG_RESPITE_BUDGET_MS` (900 s, 15 minutes) of respite, and each Valkynaz
Redoubt adds `EG_RESPITE_VALK_MS` (600 s). It is spent at any Redoubt's rest by the company's word (section 16.4), asked
while 30 s or more is left (`EG_RESPITE_MIN_MS`), each yes lengthening the rest by `EG_RESPITE_STEP_MS` (two minutes, or
what is left): the count holds while it runs, the last word does not. Each yes puts the respite again, and the Ready with it
(AUDIT EG V), so a company may spend the whole budget at one rest and still end a lengthened rest early. A Ready and a
respite passed in one word take the respite whole, and the rest ends `EG_READY_MS` (3 s) after it (`net/eliteGates/egBrain.js`
asksStep). A three-hour run with one life must leave room for ordinary
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
  another's name. Its site is its opener's word - the hub signs the site the open frame says, its shape alone checked,
  and the key's refusals 2-5 and 8 are the opener's own screen's - so a stranger's screen draws the arch but stands no
  stone for it: no gate, road or door is shut by one, and no body is moved out of one. The company's screens, which
  answer its call, stand it (AUDIT EG V).
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
- **The word.** The hub tells the company `{t:'eg', k:'call', b, o, os, seed, op, rh, co, site, ew, wg, sg}` on the party
  channel (section 23's table): the opener's name and account, the breach's public seed, its opening (`op` - the rise
  and the open are the clock's off it, `egTimes`), a Rehearsal's, the company, the arch's site, the start Redoubt, the
  Wager, and `sg`, the hub's signature over the arch's fields (`net/eliteGates/egCallSig.js`). Each member's client then:
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

**The first circle** is fixed: a Rift-Yard, a Span through an Oblivion Caverns passage (a fire-fall curtain, a chasm on
ledges, an opening onto the burning sky), a Proving Walk, a Rampart, and Grath's Court in the magma chamber. In circles
1 and 2 every span carries a passage. A first breach shows the place Mac asked for in its first five minutes. It is fixed
for every breach, a company of veterans' too (AUDIT EG V, lane3 #9 - first written "while any admitted member has never
taken Redoubt 1"): a hall is the law's of its seed, its number and its ground alone (section 9), so the relay and every
screen lay it alike, and a company's past is no input of it - drawing circle 1 by who was admitted would make the
company a fourth input of every reader of a hall (the relay, the screens, the swap's worker, a law-foreign client given
the relay's bytes) and move every circle after it, whose draws remember circle 1's. A breach that starts deeper (section
16.6) skips it.

**One hall at a time, the company together.** The room holds one live hall, and the company moves through its stages
as one:

| stage | what | how long |
|---|---|---|
| **arrival** | each member steps off the swap onto the hall's ARRIVAL PLATE (gold) and is `here`: the room reads it off the member's pose on the plate (`egOnArrive`, within 1.5 m) - no word of its own on the wire | as they come |
| **gather** | a ring fills over the plate, *3 of 6 here*. The hall wakes once every living member has said `here`, or `EG_ARRIVE_MAX_MS` (30 s) after the pull with a member still missing: *The hall wakes.* A gather begun before the wait ends runs whole. After two halls in a row that a member woke late, the wait for them drops to 10 s | `EG_GATHER_MS` 8 s after the last `here` |
| **the trial** | the hall's kind (section 8), its objective on the arrival card and the objective chip (section 27.3) | the trial's |
| **the door** | the relay judges the trial done, and a gold door opens at the hall's END PLATE: a beam seen hall-wide, a compass and screen-edge marker, *The way down opens.*, and a door's sound | - |
| **the closing** | each member steps through the door when ready (`down`, said by the screen and accepted by the relay only within `EG_DOOR_REACH_M` 3 m of it - the closing ring's radius, one number and never a pad; the screen says it again each second it stands there - from a fair trail, section 21) | `EG_CLOSING_FIGHT_MS` 20 s; `EG_CLOSING_SPAN_MS` 45 s after a span or the Deepway |
| **the pull** | at the closing's end, every living member still in the hall is pulled down | after a span, the toll (section 10.6) |

**The gather, as built** (AUDIT EG V): the room tells every screen each member's `here` on the company row (its eleventh,
`net/eliteGates/egBrain.js` `egCompanyOf`, said again as a pose reaches the plate), so the ring over the plate's rim fills by the
share of the members the hall waits for (`src/world/eliteGates/egLights.js`, the closing ring's gold) and the stage's line counts
them, *3 of 6 here.* (`net/eliteGates/egLink.js` `egGatherOf`); a company of one has nothing to gather.

**The breach's first hall** wakes when every company member has said `here`, or when the open window ends
(`EG_ADMIT_MAX_MIN`); a member not admitted by then is out. A gather begun before the window ends runs its 8 s whole, as
a later hall's does (AUDIT EG V).

No member is targeted, judged or credited before their `here`: a recall is the `here` of a member called back where
it rises, and every pose-gated credit asks the member's `here` in the hall beside its fair trail (`net/eliteGates/egBrain.js`
`fairOf` - AUDIT EG V: a screen that stood its member first at a span's end plate, never on the plate the pull put it
on, was never judged, so it was believed, and opened the door on the trial's first beat). A span's door opens when the FIRST living member stands on its end
plate with a fair trail (section 21). The closing then gives the others 45 s to cross, and the pull carries whoever did
not, at the toll's cost. Skill is paid and nobody is stranded. Nothing waits on the slowest player for ever, and
nothing is skipped for free.

**THE SWAP.** Between halls, the made level is replaced in place. Every made level today is entered only from the
exterior: `enterSdRealm` (`src/scenes/worldModes.js`) refuses unless the mode is `'exterior'`, and the world host's
`sdEnterRealm` forces the player out to the exterior and teleports to a pixel first. Reused as it is, every stair would
stream an exterior pixel, switch the presence socket to a world cell, fire every exterior-transition hook and leak the
old dungeon context (`dungeonTransition` never destroys the context it replaces). So the Spire never takes that road
(EG-H3's THE SWAP IN PLACE, its record in section 31):

- a circle's five halls stand in one made level, and the pull between them is a teleport under the veil's flash;
- a NEW circle is stood in the same level (`scenes/worldModes.js` `egSwapCircle`): the old circle's mesh, portcullises,
  floors and draws go first, then the new one is uploaded, laid and lit;
- no exterior pixel is streamed, and no exterior-transition, HCC, quest or unlevelled-loot hook runs;
- every hall of a breach keeps one presence room, `{kind:'eg', b}`, so the swap never switches the presence socket;
- **the next circle is built during the Court's rest, off the main thread** (`world/eliteGates/egCircleWorker.js`, scheduled by
  `scenes/eliteGates/egSwap.js`), since a circle is the unit. A 40,000-triangle build costs 41-53 ms and 21-30 MB of garbage on a
  desktop in one task (AUDIT EG II L4-27), so it never runs on the main thread: a build not ready in `EG_SWAP_WAIT_MS`
  (1.5 s) steps the old way, out under the veil and in again. The build carries the circle's five hall specs and, for a
  circle that opens a band, that band's dress painted (`world/eliteGates/egCircleParts.js` `egCircleBuild`, AUDIT EG V); the rest
  puts the dress up a record a frame and takes the specs as given a hall a frame (`net/eliteGates/egLaw.js` `egSpecGive`), and the
  swap whatever a short rest left - so nothing under the veil lays a hall again (33 ms a swap, 65 at worst) or paints a
  band (150-270 ms);
- at most two circles are resident;
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
  the cap holds it, and the next wave is one body larger (once, however long it held). Every other wave pours what the
  room under the cap holds of it (section 12). A company of eight stands at 14 from circle 1; depth reaches
  it through decrees and kinds, never more bodies (the telegraph budget, section 25.4, is why).
- **The end**: the last rift closed. Every add still standing crumbles (the host's `adie`), and the door opens.

**Variants**, drawn by `egCircleOf` (section 9); one more unlocks with each band:

| variant | band | what |
|---|---|---|
| **the Rift-Yard** | the Galleries | as above |
| **the Wellspring** | the Galleries | one great rift worth 30 s of the company's reference damage, shielded while any of its three anchors stand (each 4 s); Sappers walk to broken anchors and relight them at a third - one rises from the great rift with each of its waves while an anchor lies broken, within the cap |
| **the Muster** | the Cairn | no rifts: a standard-bearer (a Daedra Seducer bearing the Kyn's standard, section 12) walks between three rally points (3.0 m/s, a new point every 20 s), and every rally point pours waves while the standard stands. It holds 20 s of the company's reference damage, times the depth. Fell it and the waves stop |
| **the Holdfast** | the Shade | hold a Battlemage relic (a gold disc, r 6) for 75 s against waves from three rifts. Each add that reaches it takes 4 of its 100. A broken relic opens two more rifts and the hold restarts at half; it never fails the hall |
| **the Wellmouth** | the Wellhead | the rifts wander: each moves between three sockets on the rim every 20 s, at a fixed 2.0 m/s, so the groups that close them must follow |

From circle 2, one Yard in three stands in a chamber (section 11.4), its rifts set in the walls.

Split up and close rifts in parallel, or stand together and be buried. An eight-member company closes five rifts in
three groups; a pair closes three, back to back, against a legion sized for two.

### 8.2 The Span (`span`) - platforming

A generated course (section 10) of 4-18 platforms a road in three to five sections (the first circle's 18 in four;
from circle 11 the High Road's 11-18), with islands between them, from the arrival plate to the end plate. The hall's
158 m bound (`EG_HALL_LEN_MAX`, under the wire's) holds it under the 12-28 first written (AUDIT EG V, lane5 #18: the
law's own count, measured over 150 seeds).

- **Harriers** (Imps, hovering at `HOST_HOVER_M` 0.9 m) shadow the company along the course. Over platforms they
  body-block and never bite; they bite only on islands and plates (traversal ground is never aimed at, section 11.7). And
  a blow struck from a platform strikes none of them: from there every screen turns it, in the relay's own law (FIELD BUGS
  2026-10-18f TURNED-BLOW, section 11.7).
- **Divers** dive at it from the air, from the Shade: only at its islands and plates, under the Diver's rule (ground at
  least the shape's width plus 2 m: 6 m).
- **The door** opens on the first living member at the end with a fair trail (section 21).
- **Fragments**: a span may pass through fragments, and from circle 2 every span forks into a High Road and a Low Road
  (THE FORK, section 11.4).
- **THE GOLD RUN**: if every living member is across, by either road, before the closing's 15th second, the count
  gains one real minute; past the cap, that minute counts toward a Surplus. A company of one is exempt: its own arrival
  opens the door. A pose-gated credit needs a fair trail from the last island (section 21).
- **The trail**: once the door opens, the first across's route draws as a faint gold ribbon for the others. The door's
  word names the member whose arrival opened it (`esay` door, its `s`). Each screen keeps every living member's route
  over a span or a Brink, a point a metre at most and `EG_TRAIL.max` (240) points at most, a point on a moving piece kept
  on that piece (`world/eliteGates/egLook.js` egRibbonPush). In the closing it draws the first across's for the others in THE EDGE
  LINE's gold at 40%, never pulsing (`render/eliteGates/egLinePass.js`, THE TRAIL kind, its own buffer); the first across never
  sees their own (AUDIT EG V, L3-10).
- **Members never block each other**: peers are not in the collider (`src/net/remotePlayers.js`). Allies draw at 60%
  opacity on traversal ground, so an ally never hides an edge line: the host's every-peer veil (`scenes/world.js`) asks
  `scenes/eliteGates/egClient.js` allyVeil, which answers for a living companion of this hall standing off the fight floor, and
  the ally is drawn in ECV1's plain blend at 60% with its name kept (a concealed peer's look still drops the name). Its
  Sigil aura is not drawn there, as a concealed peer's is not (AUDIT EG V, L3-10).

### 8.3 The Rampart (`rampart`) - a walkway under fire

A walkway 90-120 m long over the void and 5 m wide. A hall is the law's of its seed, its number and its ground alone, so
it cannot know its company, and every hall stands inside the wire's bound (`EG_HALL_LEN_MAX`, 158 m, with its plates):
first written 90-160 m long, 3-4.5 m wide for a company of up to four and 5-6 m for five to eight (AUDIT EG V, lane1
#19).

- **Fire vents** cross it on a cycle: each a lane 4 m deep, laid across the walkway and at least 4 m long, past a
  narrow walkway's edges (THE WIDTH RULE, section 11.7),
  telegraphed 1.0 s before it erupts (20% of max health, fire).
- **The legion marches along it** toward the company. The relay runs them on a line, the walkway's own axis, so it
  needs no navmesh.
- **Bastions** every 35-45 m: fight floors (r 6) off the walkway's side, where the march halts and Breakers enter. The
  back of an eight-member line always has somewhere to fight.
- **Casters** stand on `1 + ceil(n/3)` pillars beside it, 10-18 m out, throwing discs, each pillar's top 2 m up. Reach
  them by short side spans - from spec law 8 each a stair from the walkway's edge onto its pillar's top (AUDIT EG V,
  lane5 #15: law 7's lay flat under the top, and a member walked in under it and fell) - or answer them with arrows and
  spells. A Caster keeps to its pillar, whatever the pillar's plan meets: one whose plan
  meets a bastion's has a lip onto it, and no Caster steps off (EG-ZQ).
- **Breakers** charge ACROSS the walkway from the side spans, never along it. A lane along a walkway would leave no
  floor to escape to (AUDIT EG0 G4). Their push is 6 m, and a push off the edge is a cast-back, not a death.
- **Waystones** every 30 m, lit gold when they are a member's cast-back point: a push off the edge returns them to the
  nearest one behind, never to the arrival plate 160 m back.
- **At its end, a portcullis** held by two Ward-Bearers (the gate's Legion-Lord kind, pulsing). When both fall, the
  door opens. **The march holds the gate**: while any of the march stands within `EG_GATE_HOLD_M` (20 m) of the
  portcullis its Ward-Bearers are warded (*The march holds the gate*, said once a hall), so a company that runs the
  walkway past the march breaks it at the gate before the door will give (AUDIT EG IV: the Rampart was a sprint to two
  bodies at the far end).

**Variants**:

| variant | band | what |
|---|---|---|
| **the Siege-Walk** | the Galleries | as above |
| **the Falling Wall** | the Galleries | 20 s after the wake, the walkway falls behind the company, segment by segment, at a fixed 1.5 m/s. A member caught is cast to the nearest standing segment ahead, at the cast-back's cost |
| **the Winch** | the Cairn | the portcullis rises only while `min(2, n)` members stand on its winch plates, over 60 s, under the march - *n* the living company as it stands, so a pair that loses one raises it alone (AUDIT EG V). Each plate stands gold on every screen through the trial, the room's reach (`EG_TOUCH_M`) about it, as a stood-on errand does (`scenes/eliteGates/egFight.js` `winchPlates`; FIELD BUGS 2026-10-18d WINCH-PLATES - the objective named them and nothing marked them) |
| **the Gauntlet** | the Shade | no march: `2 + ceil(n/2)` caster pillars, each silenced by standing 3 s (`EG_SILENCE_MS`) on its plate - from spec law 10 on its pillar's top beside its stair's head (laws 8 and 9: 3 m up the stair) - or by slaying its Caster (GAUNTLET-SLAIN, `01-Overview/bugs/Field-Bugs-2026-10-19d.md`: a company that killed every Caster stood at a door that never gave). Each plate in play stands gold on every screen through the trial, on its own ground's height (`egPlateY`), the room's reach (`EG_TOUCH_M`) about it, and dims once its Caster is silenced, by its plate or its death - the room says each plate's word (`pg.silenced`, in `spots.pillar`'s order; relay world232 - a screen facing an older relay, world231 or before, draws every plate the hall lays while a Caster is left); the objective and its line name the plates (section 27.3) (`scenes/eliteGates/egFight.js` `gauntletPlates`; FIELD BUGS 2026-10-19f GAUNTLET-PLATES - from a player's private report: a company slew every Caster, the line still counted three, and nothing marked a plate) |
| **the Forge Bridge** | the Wellhead | the walkway is a conveyor running toward the arrival plate at a fixed 1.0 m/s, under the march and the vents |

### 8.4 The Athenaeum (`athenaeum`) - the lock

The Battlemages' library, its heart an **Orrery** drawn by `orreryOf` (`src/net/superDungeon/sdBrain.js`).

- **Today**, `orreryOf(s)` takes a Hollow's slot. It reads its fray from that slot's own Hour marks
  (`sdMarksLaw(sdMarksOf(s)).fray`) and its turns range from the module constants `SD_TRUTH_TURNS_MIN`/`_MAX`, with a
  64-entry cache.
- **EG4 widens it** to `orreryOf(s, {turnsMin, turnsMax, fray})`. The Hour's call and its golden draw are unchanged;
  the cache is keyed on the seed and the band.
- **The Spire's knobs**: the turns range starts at 16-28 and rises by 2 every five Redoubts until its top reaches 36,
  the most turns six stones can ever need from any start (`EG_ORRERY_REACH`: each stone's way is at most half the
  hours), and stays there: 24-36 from circle 21 (`net/eliteGates/egBrain.js` `egOrreryTurns`). `orreryOf` draws a start again until
  its shortest way lies in the range it is asked, so a range past the reach is drawn for ever - an Athenaeum from circle
  56 hung its relay room until AUDIT EG V held it. The fray is the Hour's default (`SD_FRAY_MAX`, 48)
  unless the circle carries the Hour's decree The Fraying (section 14). Then it is `egFrayOf` (`net/eliteGates/egRun.js`), which
  keeps pace with the road: eight turns past its longest at rank I (the omen's 36 over the first circles' 28, two more
  every five Redoubts) and four at rank II, never past the default.
- **The judge**: EG4 extracts the pure judge, `orreryJudge`, out of `_sdTurn` in `server/src/index.js` (reach,
  settle, rights, `orreryStep`). The Hour's room and the Spire's both call it.
- **The stones on the screen** (FIELD BUGS 2026-10-20f ORRERY-STONES, `scenes/eliteGates/egOrrery.js`): the law lays the six
  stones at the Hour's own ring and bearings (11 m; 30 to 330 degrees), so each stands as the Hour's own stone j - its
  relief, dial and hand, its crown gear, its two levers - carried to its spot by a translation, on its own floor, solid.
  Its levers ARE the handles (forward on the right as one faces it), and its hand shows the room's hours. The handles
  were boxes in the air beside a gold disc, with nothing drawn there.
- **Pressure**: `ceil(n/4)` Harriers rise every 15 s while the lock stands, so the members off the stones guard the
  members on them. The wave is Harriers alone (`egWaveKinds`' `only`), with Swarm-Mother's Binder beside them.
- **Everyone works**: any member in reach may turn any stone, and the company is one thread: the Spire's judge keeps
  no rights (`orreryJudge` with none - EG-H3), and a snap lashes every living member a quarter of their health
  (`fray`). The Hour's rights (`orreryMayTurn`), which hold back a turner who keeps lengthening the road while another
  turns and lash only the turners who did not bring the Concord nearer (`orreryLashed`), are a public realm's: anyone
  may walk into a Hollow and turn. A company is the opener's own party, frozen at the open, so the Spire leaves its
  thread to it (AUDIT EG V, deciding between this sentence and EG-H3's record, which said the two apart).
- **The reward**: solving it in no more turns than the band's minimum grants every member one free Vestige rank at the
  next Redoubt.

### 8.5 The Proving Walk (`proving`) - span, champion, span

The Battlespire was a proving ground. A short span (5-7 platforms; four, or three, under the span decrees - first written
6-10: the hall's 158 m bound holds a hero chamber's longer court too, AUDIT EG V lane1 #20) leads to a **proving court**
(r 14), where the
band's **champion** stands: a Kynreeve in the Galleries, a Kynmarcher in the Cairn, a Markynaz below.

- It is one foe the relay runs: `PROVE_HP_S` 40 s of the company's reference damage, times the depth.
- Its body is the Warden's look at 2.5 scale (Ruhn's 3 is his own), with the boss mark ring. Its shapes are the Warden's
  own Cleave, Slam and Charge from `ATTACKS`, each lengthened to its wind-up floor and the Charge widened to 4 m (THE
  WIDTH RULE).
- It wakes at its court's wake ring (section 8.6): about the proving court's heart, 1 m inside its floor's edge
  (`champRing`, `net/eliteGates/egBrain.js`), as a Deepway champion chamber's champion wakes at its chamber's. The company crosses
  the first span to it; asleep, it takes no blow.
- It brings an escort of `1 + ceil(n/3)` adds from its band (2 to 4).
- Each rank has a signature:
  - **the Kynreeve, Shield-Wall**: blows on his front 120° deal 75% less, blows from behind 30% more (the relay knows
    both poses), and he turns to the top of threat, so one member holds him while the others flank - his facing rides
    his row and every walk (`yw`, section 23), so each screen draws him facing the way his Shield-Wall is judged;
  - **the Kynmarcher, the Citadel**: as he wakes he plants three standards (asleep, nothing of his errand stands to be
    broken), each 4 s of the company's reference damage; each
    standing standard takes 20% off every blow on him;
  - **the Markynaz, the Grand Duke's Decree**: he lays one lord-family decree (section 14) on his own fight, named on
    his card. It folds with the circle's lord decrees through the fight's profile (section 14), never in their place: the
    one his hall's number draws from the four, or the next his fight does not already bear.
- Its fall opens a second span, whose end is the door. Under Gale-Swept or Crumbling Halls that second span is the
  decrees' own sections, and the first runs short (section 14, THE SPAN DECREES' SECTIONS).
- From circle 2, one proving court in three is a chamber of its band's kit (section 11.4): the Caverns' or the Fallen
  Stacks' broken dome with its two balconies in the Galleries, the Ossuary in the Cairn, the Gloam Thicket or the Eclipse
  Vault in the Shade, the Forge Gut, the Clan Pit or the deep Caverns in the Wellhead (first written "the Fallen Stacks'
  broken dome" alone - AUDIT EG V, lane5 #12).

### 8.6 The Court (`court`) - every fifth hall

A short approach (3-5 platforms of the band's first two pieces) leads to the **Court**: a court disc of radius 26, or
the lord's own ground (section 13).

- **The wake ring**: a gold ring at the court's edge. The lord wakes when every living member stands inside it, or
  `EG_WAKE_RING_S` (20 s) after the first does, with the gate's wake beats: the roar, and the lord's card (its name and
  epithet). The fastest member never meets the lord alone, and a lord asleep takes no blow - none from beyond its ring,
  no burst before it wakes (`net/eliteGates/egLords.js` egLordHitX).
- Its fall raises the **Redoubt's beacon** at the court's heart, and the Redoubt is taken for every living member at
  once (the Redoubt's sequence, section 16.2). Touching the beacon is not needed.

### 8.7 The twists

From circle 2, about one trial hall in four (seeded, never the Court or a Brink, never two running) carries a **twist**.
From spec law 8 a slot rolls a third, so with never two running a quarter of the trial halls turn (0.26 over 400
seeds); the laws before rolled a quarter, one trial hall in five (AUDIT EG V, lane3 #11):

| twist | what | on |
|---|---|---|
| **Reliquary Vault** | a side span to a cache: an extra Reliquary for each member who reaches it with a fair trail, at the count's cost - taken in the trial or the closing. On a forked span (spec law 8) it stands off the fork's island, across from the Low Road's bridge, where either road's company reaches it | a Span or a Proving Walk |
| **Dagon's Bargain** | a shrine on the arrival plate: the company's word (section 16.4) accepts one more decree for the rest of the circle, and each member who voted yes gains one Reliquary if it passes. At most one a circle, and none when no family is free (section 14): the director asks only then (`egBargainOpen`), and no screen shows the shrine's line then (`egTwistShown`). It draws what the circle's draw may: never Swarm-Mother before the Cairn, The Fraying only with an Athenaeum still ahead, never Gale-Swept or Crumbling Halls | any trial hall |
| **Kynval Squad** | four Kynval elites in place of a wave, each with one affix: **Searing** (its strike leaves a pool, r 2.5, for 6 s), **Shielded** (a shield of a quarter of its health that only blows from behind break), **Wrathful** (shares +10%, inside the 1.5 cap), **Unshaken** (immune to push and to Fade). On a Rampart they stand on the walkway 30 m in; on a Rift-Yard on its floor 6 m about its heart (AUDIT EG V: the yard's never stood); either way the hall's first wave is held 30 s (`EG_SQUAD_HOLD_MS`) | a Rift-Yard or a Rampart |
| **The Scriptorium** | a quiet hall: heals 30%, no trial, and the door opens after 30 s (the count runs) | slot 3, in place of its kind |
| **A Battlemage's Ghost** | a friendly ghost (the relay's host runner, a friendly flag) fights beside the company for the hall; on a Span it flies with the company over the course, as the Span's Harriers do (AUDIT EG V: a span's never stood) | any trial hall |
| **The Deserter** | a Dremora deserter races the company to close rifts. If the company closes more, each member gains a Vestige shard (section 17.1); otherwise he takes the hall's cache | a Rift-Yard |
| **The Kyn Mimic** | one cache in eight is a Lurker; its tell is a lid that breathes red | any trial hall |
| **The Captive Battlemage** | three chains, each 4 s of the company's reference damage; break them all and each member gains a Cantrip (section 17.2). They hang on the hall's fight ground (`net/eliteGates/egBrain.js` `egCaptiveSpots`): about a court or a chamber that is its first floor as the law lays them; on a Span's islands, spread along the course; about a Deepway's chamber; along a Rampart's walkway at its quarters (AUDIT EG V: the law lays one chain where its first floor is a lane, and a span's stood none) | any trial hall |
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

Halls 26, 51 and 76, the first of each new band, are a **Brink**: a traversal of 132-151 m, about 25-35 s at the span
build (each seed draws its own; first written "a fixed traversal of about 60 s" - the hall's 158 m bound holds it, AUDIT
EG V lane5 #10), with no fight (the count runs). The hall tears loose from one realm into the next as the company crosses it: Galleries
marble giving way to Cairn mist, the Cairn's slate to the Shade's dark, the Shade's glass to the Wellhead's fire. Its
course is a set-piece passage (section 11.3) solved like any other, and its end plate shows the new band's card. Every
hall's sky holds the Spire's broken underside, drawn smaller with each band, so depth is something the company can see.

## 9. The generator - the hall spec

**One pure law, read by both sides.** `egHallOf(seed, hall)` (`net/eliteGates/egLaw.js`) answers the **hall spec**:

- the kind, its variant, the band, the circle, the slot and the twist;
- the hall's geometry: its plates, court discs, rifts, walkway, bastions, pillars, side spans and span course;
- its fragments: each one's kind, class, socket and seed, and so its law half (section 11.5);
- its cache's kind, its engines and its alcoves (sections 11.10, 17);
- its decrees, as numbers.

**Its units.** The spec says its positions in metres, from the law's centimetres, all but one field: a spot's `y` (where a
spot carries one: a fragment's anchors, a balcony's spot, the Low Road's niche) is said in centimetres, as the law lays it.
Seed 1's Hall 22 has Lurker spots at `y` -760 over floors at -7.6 m. Nothing reads it, since every body's feet are the fight
ground's (section 11.7). Saying it in metres is a spec law of its own (`EG_SPEC`, section 22), made by the first slice that
reads a spot's height; until then a reader divides by 100 (EG-ZQ's record says why).

The relay reads it to run the hall's brains: where a court's clamp is, where a rift stands, the walkway's line, where
a platform is at time *t*. Every client reads it to build the circle its halls stand in (`world/eliteGates/egHall.js`
`buildEgCircleModel`, `egCircleColliderTris`, `egCircleLights`, `egGateParts`) and its spans (`scenes/eliteGates/egSpan.js`). Those
builders are ONE construction seam: the mode machine's stand (`scenes/worldModes.js` `standEgHall`) and the swap's
worker
build (`world/eliteGates/egCircleParts.js`) both call them, so a circle built off the main thread is byte for byte the one the
stand
makes (THE ONE CONSTRUCTION SEAM).

**The relay and the clients must compute the same spec, so the law is exact.** `Math.sin`, `cos`, `tan`, `atan2`,
`hypot`, `pow`, `exp`, `log` and `cbrt` are implementation-approximated: V8's results and an iPhone's JavaScriptCore's
can differ in the last bit, and one flipped threshold in the solver (the 0.5 s window, the eight retries, the budget's
sum) would give the relay and a phone different halls. So:

- the law files decide only in integers: positions quantized to centimetres, times to milliseconds, costs as
  integers;
- their trigonometry runs through a table of their own: the hall law's `lawSin`/`lawCos` (whole degrees in steps of 5,
  sines times 10,000), exact in integer arithmetic;
- THE TIMED SOLVER decides from spec law 8 on THE LAW'S CLOCK (`net/eliteGates/egSpanLaw.js` `egLawSin`, `egPieceAtLaw`,
  `egPendAtLaw` - AUDIT EG V, lane5 #2): every piece's place at a moment of the shared clock is taken through a
  whole-degree table of sines (times a million, a literal) read between its degrees, and a reach is compared in squares,
  never by `Math.hypot`. Nothing in it runs past the arithmetic IEEE rounds exactly on every engine (+, -, x, /, the square
  root, floor). The laws before were proven on the screens' clock (`egPieceAt` moves the platforms on `Math.sin`, as the
  Hour's Steps always moved), and keep it, byte for byte; the two clocks part by under a millimetre over a 2 m swing;
- a source sweep refuses any of the functions above in the law's decisions: the hall law's generator (`net/eliteGates/egLaw.js`,
  `test/net/eliteGates/egplay_law.test.js`), the fragments' generator half (`net/eliteGates/egFragLaw.js`, `test/net/eliteGates/egfrag_law.test.js`), and the span
  generator, THE LAW'S CLOCK and the solver (`net/eliteGates/egSpanLaw.js`, `test/net/eliteGates/egaudit5_f.test.js` - which also lays law-8 halls
  with every one of them refused outright). What the screens alone run on is not swept: the platforms' and the hazards'
  motion as drawn (`stepAt`, `egPieceAt`, `egPendAt`, a wisp's path, the Eclipse's shafts) and a pose's judgements
  (`egOnFloor`, `egOnFight`);
- the state frame carries `dg`, an FNV-1a digest of the quantized spec of the hall the company stands in
  (`egSpecDigest`), and only ever that hall's: a new hall's stage lets the last one's go (`net/eliteGates/egLink.js`). A client
  whose own draw of the hall disagrees asks `{k:'spec'}` for its circle's five halls and builds from the relay's bytes
  for the rest of the breach, as under another law (`scenes/eliteGates/egClient.js` `digestOff` - AUDIT EG V: the digest was said
  and never read). The mismatch is written to the console once a hall, not to a receipt: the relay never sees a
  client's own draw, and a receipt's measures are THE FAIR TRAIL's six (section 21).

**Seeds.** The breach's `seed` is drawn by the relay's CSPRNG when the room accepts the open order, and said in its
state. A hall's own seed is `egSeed(seed, hall)`, the `sdSeed` mix: `sdSeed` is exported from `src/net/superDungeon/sdBrain.js` and
the Spire imports it rather than copying it (ONE DFU MEMBER, ONE EXPORT). The receipts'
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
  `net/eliteGates/egSpanLaw.js`, a leaf, and `src/world/superDungeon/sdSteps.js` re-exports it;
- the fragments' law is another leaf beside it, `net/eliteGates/egFragLaw.js` (section 11.5);
- EG8 moves the bearing search into `net/eliteGates/egFloor.js` and widens it there (THE UNION FLOOR, section 13.2);
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

- **It is data (EG4, shipped in EG-H3)**:
  - `courseOf(courseSpec)` (`src/net/eliteGates/egSpanLaw.js`) lays a course;
  - the Hour's course is `courseOf(SD_COURSE_SPEC)` (`SD_COURSE`), byte for byte the course it froze at import, pinned;
  - every reader takes a course, the Hour's by default - the ghosts (`sdGhostStepsOf`, the pass's count a maximum,
    `SD_GHOSTS_MAX`), the waystones and the vane, the rewind's edges and eye, the hang's islands, `abyssLab`, the
    riders (`createSdSteps`) and the check and breath builders. The motes still read `SD_COURSE_END`, the Hour's own
    sky. The Spire's islands carry the Steps' waystones, read off the Spire's own courses (EG6a, `scenes/eliteGates/egSpan.js`
    over `egCourseOf`); its timed pieces carry the Steps' ghosts, the circle's (EG-ZL).
- **The generator (EG6a)**: `egSpanOf(seed, hall, band, o)` (`src/net/eliteGates/egSpanLaw.js`) draws a hall's every course from the
  pieces below off the hall's own die, one per road when the span forks, and `courseOf` lays them: the hall law stands
  the hall about the generator's edge. `egCourseOf(spec, road)` reads a road back as the readers take it.

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

In `net/eliteGates/egSpanLaw.js`. SD7a checks distance and SD7b runs the real motor; neither checks time. The generator emits only
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
- **the ground after a run** (from spec law 8 - AUDIT EG V, lane5 #5): a step no step of its road follows says how far
  on its road's next still ground begins (`after`) and how high it stands (`ya`), and the leap to it is judged at that
  height - the laws before took it at the step's own;
- **the set pieces' margin** (from spec law 8 - section 11.3, AUDIT EG V lane5 #6): every pair of a set piece's course
  keeps a window of `EG_WINDOW_MIN` x `EG_SET_MARGIN` (1.25 - 0.625 s) in every 12 s and its next window within
  `EG_WAIT_MAX` / 1.25 (3.2 s); THE SPAN BUILD outruns the Collapsing Tube's fall by the margin (`egTubeFair`); and the
  Forge Line is crossed clear of its hammers from every start phase (`egForgeLineClear`: a search over the shared clock,
  waiting on the ground before it as long as it likes and on a conveyor only while its hammer is quiet);
- **failure**: a course that fails is drawn again from the next sub-seed, at most 8 times, then laid from the band's
  first two pieces alone. From spec law 8 no Brink falls to that last resort over the seeds and grounds the pins ask (law
  7's Brink into the Cairn did 13.5% of the time - its last leap off the Sinking Stair rose 0.5 m to an island 2-2.6 m
  out, past THE SPAN BUILD's 2.12 m).

**The crossing's lower bound** (`EG_CROSS_MIN(spec, road)`) is the solver's fastest crossing at THE FAST BUILD, less
15%, per road. It is a measure in the receipt's `m`, never a door's gate, until EG21 has field data. A bound taken at
the span build would refuse every honest faster player (AUDIT EG II L2-5).

**The sweep.** CI runs SD7b's harness (the real `PlayerMotor` on the real `Collider` over `stepTris` slabs). A course
cost about 182 ms of motor when EG6a measured it (a falling one 2.5 s); on 2026-10-19 it costs about a second, so a pull
request's 25 seeds a band plus the law pin's golden seeds take 2.5 to 3 minutes, and the 500-seed sweep per band runs
nightly and before every relay deploy. EG6a sweeps every band's pieces: the generator lays them all
(`tools/egSpanSolve.mjs --sweep`, `.github/workflows/eg-sweep.yml`).

SWEEP-FAST (2026-10-19, Mac: "Yes"): one job a band took 27 to 53 minutes over its 500 seeds, and every relay deploy that
moved the relay waited about an hour on it (54, 70 and 54 minutes that day), with the account service's deploy (which
waits for the relay to serve its version) and the site's (which waits for the account service's) behind it. Past a
hundred seeds a band now runs in six parts at once - `--part p/k`, every sixth seed of the band's list from the part's
own, the golden seeds among them, so every seed is swept by exactly one part (`test/tooling/sweepfast.test.js`) - about
84 seeds and 9 minutes a job; a pull request's 25 stay one job a band. Nothing is swept less. Found and left, for the
page's own speed: every span piece enters the collider as a mover (`scenes/eliteGates/egSpan.js` stand - each bucket's
`addMesh` takes a translation), so the broad phase (`player/collider.js` fileBucket) files 139 of a circle's 140 buckets
as `always` and every sphere and ray query walks them all; the collider's `_near` and `raycastHit` are about 40% of the
sweep's time, and the live page's Elite Breach pays the same on every body's move. Filing each piece by where it stands
(re-filed as it moves, as PERF-COL2 files a floating frame's buckets) would be the fix - a collider change, to be
measured and pinned on its own.
The pilot takes a launch onto a piece running away from it (a Rail, a Drum on its travel) only where the reach less one
capsule's radius still lands - the reach's far edge is a corner caught and stepped up onto, which a face moving away never
gives - and a launch onto a timed piece only where the launch off it follows for a launch `HOLD_S` late too, as the launch
itself is held (EG-SWEEP-RED, section 31).

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
  has seen fall is drawn on a ghost slab. RIDE-PLAY (FIELD BUGS 2026-10-23, `01-Overview/bugs/Field-Bugs-2026-10-23.md`):
  the session's play-out carries the ride (`net/online.js` lerpPose, rideAlong) - it dropped it until then, so no ridden
  peer reached `rideAt`. The relay stands a ridden pose on its piece only where the pose's own feet
  stand on it - its top as it stood within `EG_SUPPORT_LAG_S`, the capsule about it (`net/eliteGates/egFair.js` `egRideHolds`) -
  and judges the raw pose otherwise (AUDIT EG V: a pose on a fight floor claiming a far Drift was stood on it, off
  every floor, where no blow found it).
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
with at least 25% margin - from spec law 8 (section 10.5's set pieces' margin, AUDIT EG V lane5 #6; the laws before proved
each as any course, the Tube's pace checked by a test alone, the Forge Line's hammers by nothing). A member it catches is cast forward to its last standing node at the cast-back's cost, never
killed. Each opens with a sting and carries its own short music cue (section 26).

| band | passage | what |
|---|---|---|
| the Galleries | **the Collapsing Tube** | the vault falls behind the company at a fixed 4.0 m/s (the span build runs 5.47) for 60-80 m, ending at an opening onto the burning sky |
| the Cairn | **the Sinking Stair** | each flight sinks into the mist at 0.5 m/s after a foot, each member's own, as a Crumble is. From spec law 8 the island after it stands 0.5 m under its last flight, where that flight has sunk to when its leap is taken |
| the Shade | **the Moon Path** | a beam walks the Thicket at 2.5 m/s, and the branches stand only under it: follow the light |
| the Wellhead | **the Forge Line** | three conveyors through hammer drops into the forge's mouth. From spec law 8 they stand THE ENVELOPE's least gap apart (2.4 m: 3.2 m closed each on the leap half its cycle, a 3.5-4 s wait), and the hammers are crossed clear of |

The Brink halls (section 8.9) are built from them.

### 11.4 Where fragments stand

- **In a span** (section 8.2). A span's platforms run up to a fragment's mouth (a cavern opening in a floating rock
  mass, a fallen doorway) and on from its exit, to more platforms or the end plate. How many: in circles 1-2 every
  span carries one passage; in circles 3-10, one or two; deeper, up to three, under the hall's cap of four fragments.
  As laid from spec law 8 (AUDIT EG V, lane5 #11 - the laws before laid one in every span, the Low Road's from circle 2,
  so the High Road passed through none): from circle 3 the way to the fork runs through a passage of the band's library
  in place of its run, one span in two, and from circle 11 every span - both roads pass through it; from circle 11, one
  span in two, the Low Road's still ground is a second passage of the band's library where the hall has room for it, its
  run and the plate (`EG_FORK_THIRD_CM`). Under three ranks of the span decrees their sections take that room, and the
  span carries the Low Road's one. Every hall stays inside `EG_HALL_LEN_MAX`.
- **THE FORK: the High Road and the Low Road.** From circle 2, every span forks at an island. A plaque there shows each
  road's two icons:
  - **the High Road** stays over the void: harder (more pieces in one section, each at the Steps' own timing) and
    shorter. At its hardest point a cache gives one Reliquary to each member who touches it with a fair trail;
  - **the Low Road** drops into the deep, by a Drop or a shaft, into an Oblivion Caverns passage (or the band's own)
    beneath the course. It is longer - a fifth to a third again from the fork to the plate, its bridge across and back
    beside (a median of 1.22), and about a third slower at the span build (a median of 1.34, 1.06 to 1.96 times the
    High Road's crossing; first written "half as long again" - AUDIT EG V, lane5 #4, over 1,466 forks) - with fewer falls
    and more foes (Lurkers in alcoves, Harriers along its graph). Its **Battlemage's niche**, the one niche that heals, heals 15% once a member, holds a Vestige shard for
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
  and one proving court in three is a chamber of its band's kit (section 8.5). The lords fight on modelled ground
  (section 13.3).
- **A chamber is never a disc with walls.** Its record names its `play`, at least one of:
  - a second fight floor 3-4 m up, on two stairs, where Casters stand - in an Eclipse Vault, from spec law 8, only where
    its moon-shafts reach it within section 11.2's 20 m (`egEclipseHolds`: a court of 19.1 m at most; a Shade Rift-Yard's
    22-26 m court takes the arch, where law 7's balcony stood 22.5-26.3 m from a haven - AUDIT EG V, lane5 #9);
  - a chokepoint: an arch 6 m wide splitting the floor;
  - a moving hazard: the Caverns' channels surging across the floor in thirds every 20 s;
  - an engine (section 11.10).
- **A hero in a kit's place** (spec law 7, the EG-HERO-LAY record). From law 7, in a slot where the hall lays a kit's
  passage, shaft or chamber (never a set piece), a registered hero fragment of that kit and class may stand instead: a
  fair coin a slot off the hall's own hero die, in the slots' order, and the first heads whose hero fits is laid - at
  most one a hall. It stands where the kit's would: its mouth at the slot's start on the course's line, the course on
  from its lowest exit at that exit's height, a chamber's court at the hero's own size with its trial on its fight
  floors. Tails, or no hero that fits, and the kit's fragment stands, law 6's hall byte for byte but its number. The
  reference (`egRefFrag`) is laid by none, and so is a hero whose inner course leaves the slowest build no room to land and
  leap again (THE LANDING ROOM).
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
- It lives in `net/eliteGates/egFragLaw.js`, beside the span law in the relay bundle. A change to a fragment's law is a relay
  version; a change to its mesh is not.

### 11.6 How a fragment is built

Two sources, one record:

1. **Code-built kits** (EG6b first, then each band's). A kit is a generator: its law half is planned off the hall's own
   die in `net/eliteGates/egFragLaw.js` (`egFragPassage`, `egFragChamber`, `egSetPiece`, `egFragShaft` - pure, and the relay's
   too) and laid into the hall spec by `net/eliteGates/egLaw.js`; its mesh half is drawn with the circle (`world/eliteGates/egHall.js`, the
   client's).
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
   - built by EG6c: `tools/fragBake.mjs`, the record's reader in `net/eliteGates/egFragLaw.js`, the registries
     (`net/eliteGates/egHeroFrags.js`, `world/eliteGates/egHeroFragModel.js`) and a reference fragment of the port's own. How Mac names a
     fragment's art and markers so the bake accepts it is the EG6c record's (below); laying them into the halls is spec
     law 7's (section 11.4, the EG-HERO-LAY record).

**One kit of mesh tools.** Today every made level carries its own box, extrude and pack helpers (`packFaces` in
`src/world/gate/gateArena.js`, `packRealmFaces` and `quadFacing` in `src/world/superDungeon/sdRealm.js`, `away` in
`src/world/superDungeon/sdIslandModel.js`, `facing` in `src/world/superDungeon/sdHall.js`). The fragments use one shared kit, `world/eliteGates/meshKit.js`:
box, prism, extrude, lathe, sweep, and the pack into `createMesh`'s shape with Uint32 indices, writing straight into
typed arrays so a hall can be built a slice at a time (THE SWAP, section 7). The court and the Hour may move onto it
later; that is not required.

**One registry of pseudo-archives.** The pseudo-archive numbers are scattered constants today: the port's art
archives, 38001-38221, the abyss lab's 38990 (`LAB_ARCHIVE`), and the mods' 112358, 112359 and 112395. They have already
collided once (AUDIT SD IV R6: the large boat moved from 38151 to 38171). EG1 adds `world/eliteGates/pseudoArchives.js`, the one
place every archive is registered, with a test that refuses a collision. The Spire's blocks (section 25.1: the bands'
38241-38279, the key and the beacon's 38281-38289) are registered there.

**Daggerfall's own fire.** The Oblivion Caverns' fire falls wear Daggerfall's own TEXTURE.356, the Mantellan Crux's
fire walls, read from the player's own ARENA2 at runtime through the data pipeline (`getTexture`), never shipped.
Vanilla Enhanced does not repaint 356. DFU's table (`src/world/emissiveTextures.js`) marks its records 0, 2 and 3
emissive, and DFU lights them through `TextureReader.GetFireWallColors32`, which EG-ZH ported verbatim
(`src/formats/baseImageFile.js` `getFireWallColors32`): both upload arms light 356 over its classic albedo, the fire
falls its first consumer, re-pinned in `test/render/audit39_render.test.js`. Everything else is painted in code into the band's
archives (section 25).

### 11.7 Fighting in a fragment

- **Fight floors.** Blows land only on flat **fight floors** (`floors[].fight`), each a polygon at one height.
  - The telegraph pass (`src/render/gate/gateTelegraph.js`) draws a Spire shape on each fight floor it covers, never on one
    plane at the court frame's origin (where a shape on a higher ledge hid and on a lower one floated): each fight floor
    is triangulated once, for each shape and each floor it touches the floor's triangles are clipped on the CPU to the
    shape's bounds into one dynamic buffer a frame, and the vertex shader reads them at the floor's height plus
    `TELEGRAPH_LIFT`. At most 32 shape-floor draws a frame, in THE TELEGRAPH BUDGET's order (section 25.4). Built by
    EG-ZG (its record, below).
  - Stairs, slopes, ledges and inner platforms are traversal ground. No lord or add aims a blow at a member standing
    there; only the place's own hazards reach them, each drawn by its own pass on its own surface.
- **Walls bound the escape.** `perilAt` and `wayOut` (`src/scenes/gate/gateCourt.js`) search 24 bearings
  (`PERIL_BEARINGS`) bounded only by a court's circle, straight through walls. In a fragment, the union floor
  (`net/eliteGates/egFloor.js`, section 13.2) and the client's arrow search the fight floor's polygon, whose edges are walls,
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
- **The legion walks the graph, and the lords with it.**
  - Ground kinds walk a fragment's graph from node to node (a search over a dozen nodes), as the Rampart's legion
    walks its line.
  - Every lord and champion walks it too: straight within the piece of the fight ground it stands on, over the graph
    to a goal past it (an arch's gap, a stair, a bridge). A lord's run (a Charge, a Lunge) ends at an arch's wall and
    never climbs a ledge's face, and no run is aimed at a member on a floor of another height.
  - A walker set down off its walk (a charge cut at an arch's wall, a push, a pull, a lord's leap or blink) keeps no way
    on: its next walk is chosen from where it stands, so it never walks straight to a node past a wall. One rule for the
    legion and the lords (`net/eliteGates/egWalkGraph.js` `egWayOn`, EG-ZQ).
  - A stair joins its two floors: a code-built one at its foot and its top, a hero's at its own edges - its foot the point
    of its low edge nearest the edge's middle that stands on a floor of its height, its top the same of its high edge
    (`net/eliteGates/egWalkGraph.js` - AUDIT EG V, lane5 #1: the Eclipse Vault's stairs run along their floor's open chord, so the
    middle of their low corners hangs 1.5 m off the floor, and its galleries stood cut off from every walker wherever it
    was laid - a safe perch over the fight).
  - Harriers hover along the graph, never through rock.
  - Lurkers wait at `anchors.lurker`, Casters stand at `anchors.caster` (raised where the chamber has a second floor),
    and rifts open at `anchors.rift`.
  - Divers dive only in fragments open to the sky.
  - Every body's feet ride the wire: the fight ground under it (a graph walker's region, a stair climbed as it goes, a lip
    stepped off at once), a flier at its mark's height (the floor under the mark, or past that floor's band the mark's own
    feet). A lord's and a champion's ride it as a legion walker's do. Every screen draws, strikes at and hears each body
    there, never at the hall's own height. Built by EG-ZJ (its record, below).
- **The fragment keeps its own clamp.** Climbing and wall-runs would carry a player up a chamber's walls, and a safe
  perch over the fight would make traversal's immunity a ranged build's fortress. So each floor polygon is extruded to
  its `ceil` (to the motor's arena ring `ceilAbove` where it is open to the sky) as the motor's clamp
  (`player.arena.clamp`), with open edges released. `hit` (on any body, by its number) is accepted only from a pose on
  the fight ground of the current fight, and a member off the fight floors for more than 6 s in a fight is hunted by the
  Harriers (EG-ZB).
- **A blow the law turns is turned on the screen too** (FIELD BUGS 2026-10-18f TURNED-BLOW; Low_Poly_Gaming: "Imps that
  follow you around won't die after hitting several times. Its an exploit for heals if you have a vampiric weapon"). The
  relay's strike rule is one law, `net/eliteGates/egBodies.js` egStruckOff, which its egBlow calls. Every screen asks it,
  with a body's flags (a ward, a friend, a vanished lord - EG_TURNS_FL) and a lord asleep in its ring (egLordAsleep), as
  egStrikeTurned. Each frame `scenes/eliteGates/egFight.js` turnStandIn marks the stand-in of every body my blows meet
  `warded` where the relay will take nothing from a blow struck from my feet. Then no heal or power of a landed blow
  answers it (the leech, Vampiric Effect - `systems/enchantments.js` VAMPIRIC-WARD - the sets' and the martial powers),
  the swing and the shaft ring off it as off the Warden's ward (`scenes/dungeonContext.js` swingOnHost), nothing is
  sent (hostHit), and its number says "No footing" (the ground's) or "Warded" (a ward's) - at the swing, the shaft and
  the spell alike (AUDIT FB1018f L3-7, L3-2). AUDIT FB1018f L3 closed what still stood apart: the storey is one law on
  both ends (`egStoreyApart`, which egHitBody and egStrikeTurned call - a body a storey over or under me is turned, the
  screen judging it where its walk has carried it); a lord woken says its first phase in that beat (`eph`, egLordsWake),
  so no screen holds it asleep for the 2 s to the fight's next whole word; each body's radius rides beside its row
  (`ead`/`efs` `r`) so the screen judges an object by the relay's own; and a spell (the arcane riders), Cast When Strikes
  and the sets' strike refuse a warded target as the rest do. The screen judges this frame's feet, the relay the
  socket's last pose: at a platform's edge the two may differ for about a tenth of a second (L3-8). Before it the screen offered a
  span's shadowing Harriers from every platform, bled them, sent the blow and healed the whole claim: twenty blows of a
  vampiric blade with a leech line healed 264 for 240 claimed, off a Harrier that never lost a point. Still the claim's,
  not the relay's: a blow its purse clips (the bucket, the cap, the body's last points), a Shield-Wall's or a Shielded
  elite's front, a flyer out of a blade's reach - a heal of what landed wants the relay's word of it to its striker.

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
  drop, the pitch biases 20° down and the camera rises to look over the edge, so the landing is seen, not the back;
  under reduced motion it never biases at all.
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
  - At most 12 lamps stand within 40 m of any lamp of a circle (`world/eliteGates/egHall.js` `egCircleLights`, held to
    `EG_LAMP_BUDGET` - AUDIT EG V): kept in rank, a fragment's own lights and a Drop's wall first, then each court's and
    island's ring spread (two facing lamps, then those between), then the walkways', so the renderer's nearest 16 never
    cut one beside the eye. Of 1,200 circles 338 stood more than 12 about one lamp, the worst 18; 2% of
    the lamps go, none coloured. Fragment lights cast no shadow except two a hall, and the
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
- **Budgets.** The starting bounds are law:
  - a fragment: at most 12,000 drawn triangles, 3,000 collider triangles, 4 lights and 12 draws (`net/eliteGates/egFragLaw.js`
    `EG_FRAG_BUDGET`, held by the record's reader - EG6c);
  - a hall: at most four fragments (a fork's Low Road counted), 50,000 drawn triangles, and no more GL draws than the
    Hour's own frame (its 25 steps stand 79 dynamic draws, 82 GL draws).
  The draws are measured in node over 60 circles (EG-G2, EG-ZL, EG-ZN): the circle and its batched pieces, every copy in
  view, a mean of 25.5 GL draws, 39 at worst and 43 with the worst piece dithering, under the Hour's 82 (EG-HERO-LAY: with
  the ten heroes laid - 23.8, 35 and 39 before; 25.2 before AUDIT EG IV laid the Fallen Stacks). Frame time on
  SwiftShader and a reference phone is EG21's field pass, not yet measured.
- **The moving pieces are batched.** A draw a dressed moving platform would let a 28-platform span alone pass the
  Hour's whole frame. So each kind of piece is one mesh holding every copy (`scenes/eliteGates/egPieceBatch.js`, EG-G2), re-laid on
  the CPU only where a copy moved - the renderer has no instanced path - with no shadow. Crumble chunks and Pendulums
  count against the budget.
- **The cull.** The dungeon arm culls the pieces, Grath's islands and the seals against the frame's frustum
  (`dungeonContext.egSpanCull`, EG-G2), never the circle's one static mesh. Every one of them is `noShadow`, so a cull
  never moves the shadow record: the point-light caches sign themselves over their records' identities, and a draw that
  left the record would make every lantern redraw on every camera turn.
- **Freed on every exit**: the swap, the tear, the way home, a fall, forsaking, a void and a reload each free the hall's
  meshes, its fight's telegraph and crystal passes (`scenes/eliteGates/egFight.js` `leave`, AUDIT EG V - they were kept for the
  session) and reverb buffers; the band's textures are freed at the breach's end; a pass's two shaders go with its
  program (`render/glProgram.js` `buildProgram` deletes both once the link is read). Pinned (`test/net/eliteGates/egaudit5_e.test.js`):
  a screen's breach client - its fight, its look and the spans the dungeon host stands - over a recording GL, ten halls a
  breach with THE SWAP's recircle, then each way out (the way home, forsaking, the tear, the company's fall, the last
  hall, a void, the socket lost, a load): every program, vertex array, buffer, texture and shader, every mesh and every
  billboard batch back at its baseline. The band textures' own pin is EG-ZN's.
- **The frame's lists** (AUDIT EG III, AUDIT EG V): the breach client's frame keeps its lists - the occluders' pass tries
  and makes nothing in first person or with nothing dithering, the fight leaves once, the spans' Iron Footing asks the
  census only of Immovable's holder, and the client's batches, errand objects and holder and the world host's Spire
  lights are made again only when the room's word moves. AUDIT EG V kept the hot paths' own:
  - THE TELEGRAPH BUDGET's floor plan keeps its ranks, its draws, its bounds and its strip a fight (`world/eliteGates/egTelegraph.js`
    `egFloorPlanKeep`), reads the heights a shape lands on in place, and hands no double to a call: a Court's 24 shapes
    on six fight floors made ~49 KB a frame and make under 1 KB;
  - the fight's frame keeps its Map of blows, its Sets of the living bodies, the lords and the marked, its list of the
    blows the budget orders and its options, and reads a tether's ends by one function; the company where this screen
    stands it is worked out once a frame (the holder's chips asked it for every Accord twice);
  - the panel stands while what its nodes say stands, read field by field, never the whole model serialised a frame
    (`ui/eliteGates/egHud.js`), and asks nothing of a breach with no offer or vote;
  - the dungeon arm keeps the occluders' ray and the witness eye's cast; the look writes the mist's sheets into a kept
    list; the arch pool answers one empty list each with no arch standing.
  Measured in node (`--trace-gc` and V8's sampling heap profiler, a Court's fight with a pull-apart tether, a
  stay-close chain and an aura, 3,000 frames of `frame` and `drawPass`): the breach client's whole Spire frame from
  ~70 KB to ~43 KB a frame, the fight's own share (`scenes/eliteGates/egFight.js`) from ~23 KB to ~6 KB. What still allocates, a
  few small objects each: the HUD's models a frame (`ui/eliteGates/egBeats.js` `egHolderNow` and `egBeatWatch`, `ui/eliteGates/egSpireHud.js`
  `egSpireHudModel`), the client's presence and feet reads and its panel's options (`scenes/eliteGates/egClient.js` `presFrame`,
  `backFrame`, `feetInHall`), the relay's own pure laws the frame asks (`net/eliteGates/egShape.js` `egShapeOrder`'s order), a
  cleared Map's or Set's new table (V8 makes one at each `clear`), each drawn shape's small answers (`telegraphField`, a
  tether's look), the slag lanes' `realmToDungeon` arrays, `ui/eliteGates/egAccess.js` `egAccessNow`'s answer, the mode machine's
  `extraBillboards` join in a hall, the occluders' Map entries while a piece dithers, and an arch's draws and lights
  while one stands.

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
  4 m) or past an optional hard jump. A hero's alcove opens off its hero's own floor: its false wall stands in the
  hero's wall where the line from the alcove back toward the course first meets the floor it opens off, at the alcove's
  own height and flush along that wall (`world/eliteGates/egHall.js` `egHeroDoor` - AUDIT EG V, lane5 #8: the code-built niche's
  1.2 m rule stood the Mist Stair's slab over its rim floor and the Clan Pit's on its pit floor). Each holds lumen, a Vestige shard or a page of the Annals. Witnesses see them
  (section 16.5).
- **The Annals of 3E 398.** Thirty pages, each two sentences, kept in the account's service bits
  (`players.eg_annals`): a Battlemage's last note, the Secretary's surrender, the apprentice's passage. A lord's first
  fall adds a page. They are read anywhere with `/breach annals` (the list) and `/breach annals N` (a page): the
  account's pages (`/v1/eg/keys` `annals`, read at each answer) with this breach's own gifts (AUDIT EG V). The quest
  journal (`src/ui/quest/questJournal.js`) holds none of them - it is the save's quests, and the Annals are the account's.
- **Vignettes.** Each kit places one to three: a Battlemage dead at a barricade, a Kyn shrine, a rack of broken staves.
  The lore of section 3 is told by the halls, not only by this page.

## 12. The legion - relentless adds

**The Spire's own wave runner.** In `src/net/gate/gateBrain.js`, the private `stepHost` runs the Legion-Lord's three kinds,
tied to the gate's phase, court and trial. EG-PLAY lifted their law into a runner of its own; EG-FULL replaced it with
the Spire's legion (`net/eliteGates/egLegion.js`), driven by a hall's geometry: a court's rim, a rift's place, a walkway's line,
the
walk graph (`net/eliteGates/egWalkGraph.js`) and a span's islands. Its wave spots are the director's own, kept to the fight floor
(`net/eliteGates/egBrain.js` `ringSpots`). The gate's `stepHost` and its `rimSpots` stay the gate's, unshared, their frames and
pins
unchanged.

**The kinds.** Bodies are Daggerfall's own mobiles (`MOBILE_TYPES` in `src/characters/mobile/mobileTypes.js`), so every player
can draw them. A Morrowind body (`CREATURE_MATCH` in `src/characters/creatureBodies.js`) re-skins one where the
player's data and the budget allow. Every blow is a shape the telegraph pass draws, every wind-up keeps its floor
(section 13.2), and every shape is at least 4 m across (THE WIDTH RULE, section 11.7). Floors are ceiled to 10 ms.

| id | kind | does | bodies (band) | body | move | its blow (wind-up / floor) |
|---|---|---|---|---|---|---|
| 0 | **Harrier** | runs at a living member - in a Court the one farthest from the lord, as the gate's runs from the Warden; elsewhere the nearest - hovering; on a span it bites only on islands and plates | Imp (1); Giant Bat (3) in the Shade | r 0.5, h 1.5 | 5.0 m/s | Bite: disc r 2, 12% + 4 (0.9 s / 0.79 s) |
| 1 | **Sapper** | walks to its OBJECTIVE: a Court's lord (heals it the gate's `SAP_HEAL`, 2%, while its fight's feedings last - `SAP_FEEDS_MAX`, 6 - and burns out against it after; only a lord standing drinks - one fallen in a fight of two, a Twin in its window, is a body the Sapper burns out against, FB1018D TWIN-REKINDLE), a Yard's nearest closed rift (opens it again at a third of its own health), or a Wellspring's broken anchor | the Atronachs (35, 37, 38) | r 0.7, h 2.3 | 1.6 m/s | none: it is the objective |
| 2 | **Ward-Bearer** | stands and pulses before a Rampart's portcullis, holding it shut (section 8.3) | Frost Daedra (25) | r 0.6, h 2.2 | stands | Pulse: disc r 3.5, 18% + 6 of the band's element (1.4 s / 1.01 s) |
| 3 | **Breaker** | winds a charge at a member, runs it, pushes | Daedroth (27) | r 0.8, h 2.4 | 3.0 m/s; the charge 12 m/s | Charge: lane w 4 x 14, 25% + 8, push 6 m (1.1 s / 0.79 s) |
| 4 | **Caster** | stands off 10-18 m, on a raised anchor where the hall has one, and throws at a member every 6-9 s | Fire Daedra (26); Lich (32) in the Cairn | r 0.6, h 2.2 | 2.0 m/s | Bolt: disc r 3 at the member's feet, 20% + 6, the element, leaving a pool (`POOLS` hellfire's, read: 8% + 3 a tick for 6 s) (1.6 s / 0.94 s) |
| 5 | **Diver** | flies at 6-10 m, circles, dives a lane at a member; never onto ground narrower than the lane plus 2 m (6 m) | Harpy (13), Dragonling (34) | r 0.6 | 6.0 m/s | Dive: lane w 4 x 10, 18% + 5 (1.0 s / 0.79 s) |
| 6 | **Lurker** | dormant until a member passes within 6 m (an ambush) or a blow lands on it, then slow and heavy | Gargoyle (22); Iron Atronach (36) in the Wellhead | r 0.9, h 2.6 | 2.2 m/s | Smash: disc r 3, 30% + 10 (1.3 s / 0.94 s) |
| 7 | **Binder** | stands back and raises the last fallen add of its wave once, a 6 s cast broken by blows that land a tenth of its health in it (the hand's and the purse's, never the claim). The body is claimed as the cast begins, so no two Binders raise one; a broken cast spends the raise; a cast begins only with room under the cap | Ancient Lich (33) | r 0.6, h 2.2 | 1.2 m/s | none: the raise |
| 8 | **Wraith** | drifts in and tethers the nearest member on a fight floor: 3% of max health a second while within 8 m, broken by putting 10 m between | Wraith (23) | r 0.5 | 2.5 m/s | Drain: a tether (the pull-apart grammar, section 25.5) |

**ROLE READS.** Kill priority in every horde mode is read from silhouette, so among the legion's kinds one sprite never
plays two roles in a band, and every role also carries a mark that is not a colour (a lord that shares an add's
sprite is told apart by its scale of 2.5 or more and the boss ring). AUDIT EG IV (lane1 #18) held it over all sixteen
kinds, the hall's own with the nine:

- a friend is a human shape no foe of the Spire wears: the Battlemage's Ghost a Battlemage (130), the Deserter a
  Spellsword (129) - a Dremora who has shed the Kyn's armour;
- the elites, a Kynval and the Daedra Lord, are one role and the Dremora's (31) alone;
- the Muster's standard-bearer is a Daedra Seducer (29), and the Ward-Bearer a Frost Daedra (25) in every band;
- the Vengeful Shade is the Ghost (18), the Wraith a Wraith (23) in every band, and the Night-Stalker's Blood Thrall a
  Vampire (28) on its feet - the Giant Bat (3) is the Shade's Harrier.

The marks that are not a colour:

- a friend's is its human shape, and in the Shade it keeps no rim light (`world/eliteGates/egTelegraph.js` egRimOf);
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
- **Cadence and cap**: the hall's (section 8.1), the cadence quickening with depth (section 18). Every wave is held to
  the room under the cap (`egLegionRoom`, `net/eliteGates/egLegion.js`): the hall's, a lord's fury's and its summons', and Hunting
  Pack's. A friend (the Ghost, the Deserter) is no foe under it. AUDIT EG IV
  (lane1 #6): a lord's summons (Moonfall's Divers, the Soul Burst's Wraiths, the Last Rites'), a Binder's raise and the
  Low Road's foes are held to it too (`egLegionSummon`); a summons a mechanic needs - Morvayn's odd member's Wraith, the
  Night-Stalker's lone member's Blood Thrall, the Honour Horn's Kynval (section 11.2), a Kynval Squad's four elites
  (section 8.7) - stands whatever the room, and counts against it after (AUDIT EG V: a squad held to the room stood
  three of its four for a company of three). A dormant Lurker is no part of the legion until it wakes: a fragment's statue in its wall's
  shadow counts against the cap from its waking, an ambush that springs whatever the room. Counted asleep, three statues
  in a lone member's Deepway rift chamber (its cap halved to two) held every wave for good (AUDIT EG V).
- **Fade** (section 15): every kind picks among the members it sees, never one in its Fade, but an Unshaken elite
  (section 8.7). A shape aimed at another still lands on a Faded member, and a dormant Lurker wakes at anyone's
  nearness.
- **Targets**: an absent body is never chosen (section 6.1).

**Unlocks by band**:

- Galleries: kinds 0, 1, 2, 3, 4, 6;
- Cairn: + 7, 8;
- Shade: + 5;
- Wellhead: all of them, with a Daedra Lord (31) as an elite add (x5 health, the Warden's Cleave - the gate's
  `ATTACKS.cleave` read, its reach 7 - never under its floor) one wave in six (one in three under the Mingled Legion,
  section 18).

**Pure, and the relay's.** The runner's dice are the tick's rng (the relay's CSPRNG), as every brain's are.

- **Frames out**: the fight's own (section 23): `ead` (a wave risen), `emv` (the walks), `eb` (a blow), `ehp` (the
  healths), `edie` (gone).
- **Frames in**: a blow on an add arrives as `hit`, by the body's number, through the gate's hand and purse
  (`net/eliteGates/egBodies.js` `egHitBody`).

A hall with no legion draws no dice.

## 13. The lords - the bosses

### 13.1 One seam for every boss

The relay hosts three bosses, each in its own host (`_gateTick`, `_gateFrame`, `_gateFall`; `_sdFightTick`,
`_sdFightFrame`, `_sdFightFall`; the serpent's), and since EG3 (EG-H3) every one of them through **one boss seam**
(`net/bossSeam.js`). A realm holds ONE fight (`this._sdFight`). It is the shape every brain already kept by convention,
made a contract:

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
- **A lord is stood for the company on its hall's plate, and keeps what the fallen leave** (FIELD BUGS 2026-10-19e
  LORD-SHARES, `01-Overview/bugs/Field-Bugs-2026-10-19e.md`, after a company's word on its breach: *"Felt like he wasnt
  being damaged"* and *"It felt like the moment team died difficulty went down"*).
  - **As its hall wakes** a lord is stood for the members on the arrival plate (`net/eliteGates/egLords.js` egLordsStand,
    called by `net/eliteGates/egBrain.js` standFight once every lord of the hall stands). The hall's fight is still sized
    by its whole living company (its legion, its errands). A member not on the plate brings its share when the director
    first sees it in the hall, at the fraction the lord stands at, as the gate adds a fighter: a late arrival never heals
    a lord. The lord is sized in the beat the hall wakes, whose whole fight every screen hears before any health word, so
    no screen ever reads the sizing as a blow. A lord still asleep in its ring lets a fallen member's share go, and wakes
    for the company standing before it.
  - **From its wake no fall takes a share out of it.** The living finish what the fallen left, so a death makes a fight
    harder for the company, never easier. The gate and the Remnant retire a share only for absence (`ABSENT_RETIRE_MS`),
    and the Remnant keeps a fallen body's. A recall finds its member's share where it was. A member never seen whose
    absence becomes a fall (section 6.1's 180 s) takes nothing with it: it never brought any.
  - The members a hall can gain mid-fight are the late and those a Memento calls back into it (a member is admitted only
    in the open window, before the first wake: section 6.1), each bringing its share at the fraction. The last share in
    a lord is never let go. Built through the boss seam's `join` (EG-ZQ's record, below, and LORD-SHARES's).
- **The bucket**: the gate's (`BUCKET_RATE_X` 3, `BUCKET_DEPTH_X` 15, `HIT_CAP_X` 12), each member's times their
  Vestiges' factors (section 15): the client-declared at most 1.25, the relay-established at most 1.6, and **together
  at most `EG_BUCKET_ALL_MAX` 1.6**.
- **Blows**: shares of the struck member's own maximum health, resolved on the struck member's machine (co-op's law).
  Depth adds 2% a circle; depth and fury together multiply a share by at most **1.5** (`EG_SHARE_X_MAX`), reached at
  circle 26.
- **Phases**: at the gate's `PHASE_AT` (0.66, 0.33) unless the lord says otherwise, each turn shielded `SHIELD_MS`
  (3 s). Each phase adds a mechanic and never a faster one. A signature errand starts at its phase's turn: the shield
  holds until the errand is called, and blows past the next threshold are refused until it resolves, so a strong
  company cannot burn past what makes a lord itself. The Examination and Garoth's Clan Muster hold it: the lord keeps
  the least health strictly above the line (`egHoldHp` - a lord held there never reads as past it), and the Clan
  Muster's duel at his third phase's turn holds his fall. A duel is its lord's own (`net/eliteGates/egLords.js` challengeTick): each
  lord keeps its own clock, one ring stands at a time, its tally counts only blows on its own lord, and only its own lord's
  kit ends it - a duel that falls due while another lord's ring stands is called as that one falls (Garoth's under his
  ward: the errand is not yet called), and a lord's fall ends its own ring. A mirror (Seyth's, an image) turns no phase
  and runs no signature.
- **Targeting**: the gate's. 60% to the top of threat (`THREAT_PICK`) and 40% to a random living member, threat
  forgetting `THREAT_DECAY` a second. An absent body is never chosen.
- **FURY**, the endless lord's answer to a slow company. At `EG_FURY_RATIO` (1.5) x `ttkRef(c)` seconds into the
  fight (so a company at reference damage, at 80% uptime, finishes before it), a lord turns to fury: *Grath rages.*
  A champion beside it (Clan Feud's) neither turns to it nor holds it back, and keeps its own shares. Every 30 s
  after:
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
  - Pendulums, vents and the place's hazards are tested in the same set - the lords' own place with them: Grath's
    burning bridge and the Last Charge's falling third are landings like any blow (no CHECK: each has an edge to run
    to); a burning or fallen ground told and not yet down (the Conquest's thirds, Both Courts Burn, a Last Lesson's ring)
    lands at its onset; and a floor gone (a fallen island, a fallen third, the Molten Rim) is no ground to flee to while
    it stands (`net/eliteGates/egFloor.js` egZoneLandings, egFloorLess). A ground burning as a landing comes - a `burn` zone
    standing at that instant - is no ground to flee to either (`egBurnsIn`; AUDIT EG V: a member mid-bridge counted a
    burning island as safe). A new blow is held only if it is what empties the set: a set its landings empty without it
    (a court burning whole) holds nothing more.
  - The search lives in `net/eliteGates/egFloor.js` (section 9), the client's arrow beside it, both over the fight floor's polygon.
  - Pinned: the Arcane Lattice and Chained Blows are passable at *n* = 1.
- **THE WIDTH RULE** (section 11.7): every aimed blow is at least 4 m across at its narrowest, or the relay's census
  could never see it.
- **THE CHECK CLASS.** A whole-court blow (no edge to run to), a haven blow, or an errand's failure blow is a CHECK
  (the Covenant's Weight, section 18, is the one CHECK without a feasibility pin: it is a fight's end, not an errand):
  - its wind-up and its damage are fixed: no phase, fury, decree or depth shortens or raises them;
  - it carries its own feasibility pin for *n* = 1 to 8 (THE ERRAND FLOOR, below), which a haven's route obeys too;
  - the gate exempts its own the same way (`isDagons`, `windupOf`);
  - an errand's failure blow names its members (`on` - the Chain Snaps' pair, a Soul Burst's member, the Cage's bound)
    and lands on them wherever they stand, never on another: its marks ride them, and no run leaves them. The census
    counts it the same way (`net/bossRef.js` judgeShapes): on exactly the members it names, wherever their trails stand at
    its landing, never on one standing in its marks.
- **THE ERRAND FLOOR** (pinned beside the wind-up floor):
  - an errand that needs *k* bodies needs `min(k, n)`;
  - its window is at least a lone runner's route at the escape build plus 1.5 s;
  - CI solves every lord's errands for *n* = 1 to 8, as the span solver solves spans;
  - a party of one is a company, and the Alone board is real (section 20).
- **Errands by numeral.** The relay gives every errand to the nearest unassigned living member and draws it with their
  numeral (*III - Mira* on rune III). An errand for two groups splits the numerals at `ceil(n/2)` (the Twins' courts
  from *n* = 3, the Cairn-Keeper's gems). Eight strangers with text chat need to know who stands where without a word.
  - The errands given: the runes, seals, anchors, banners, braziers, hearts, pillars and standards (`EG_ERRANDS_GIVEN`).
    Each keeps its member while both stand; once every member holds one, the round begins again, so a company of one
    stands every rune. The gems go to each member's group's nearest, kept while it stands; the Twins' groups are
    Vael's (the first) and Isk's.
  - The room says them on the fight's progress (`pg.as`, net/eliteGates/egLords.js errandsGive), by the company's numerals. Each
    screen draws them over the body in Battlemage blue: one member's numeral and name (*III - Mira*), several members'
    numerals alone (*I II*) (scenes/eliteGates/egFight.js egGivenWords).
- **Tells only the engine can give.** What lands is what the ground shows, and EVERY real blow glints with its WIND
  cue (the gate's wind-up sound, `World-Bosses.md` WB13d). A feint follows Feud-Arc section 7.3 exactly: its mark
  fills to `FEINT_AT` (0.55), is cut, and fades out dashed over 0.15 s, with no glint and no WIND. The lord's blow
  (`eb`) carries no feint flag: the relay sends `ecut` at `FEINT_AT`, so a modified client cannot read the feint
  early. No tell depends on a shadow, which a billboard and a phone cannot promise.
- **The beats.** Every lord wakes with its card (its name and epithet), turns each phase with the gate's phase card
  (the numeral, the phase's name, one order: *II - The Bridges Burn - Off a bridge before it burns.*), and falls with the
  gate's fall beats (WB13e), then the damage chart (section 27.6). Every lord's two turns are named and ordered
  (`net/eliteGates/egLords.js` EG_LORD_PHASES - Garoth's third the signature he borrows), the name said at the turn (`esay` 'phase'),
  the card drawn on every screen at its `eph`, once a fight for a lord and a phase (the Twins turn each their own).
- **Marks on members.** A lord's mark on a member (the Scent, a soul-mark, Fire-touched, a chain, the cage) shows as a
  chip with a radial timer beside their vitals and a sigil over their head that the company sees, always in Dagon's
  red with its own shape (section 25.5). The marked member hears the personal sting and reads one order: *Hunted -
  run!*, *Lay your soul in a gem!*, *Strike Isk!*

### 13.3 The roster

`egBossOf(seed, c)` draws a Court's lord:

- **the pool**: the band's own lords at weight 2, plus every earlier band's at weight 1, re-aspected: every element
  of its kit is the band's aspect's, as the gate's fire is its aspect's (the Twin Lords keep their clans' fire and frost);
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
   magma, all fight floors. No lane is ever laid along a bridge: he gores only a member on the island he stands on.
   - He bounds from island to island (the Warden's Leap). The island he leaves cracks, told 3.7 s (the wind-up floor's
     class: the escape to a bridge is at most 22 m, 3.66 s), and falls for 15 s. A cast-back from a fallen island
     lands on a standing one.
   - Gore: a lane 4 m wide and 18 m long, 1.3 s (floor 0.79 s), push 6 m.
   - Savage: a cone, 7 m, 110°, 1.2 s (floor 0.96 s).
   - **The Scent**: a mark on one member, who is hunted for 8 s at 5.2 m/s, under every build's run (the span build's
     is 5.47). A catch is a **Maul** (a disc of r 3, 1.2 s, 35%). Leading Grath onto a burning bridge or a cracking
     island leaves him **Scorched**: stunned 4 s, taking x1.3. *n* = 1: no Scent; he gores twice as often instead.
   - Phase 2, *the bridges burn*: the bridges burn by turns, the place's own fire and not an aimed lane: a bridge (at
     most 24 m long) is told 3.0 s and burns for 12 s; the escape runs along it to an island (12/6.975 + 0.5 = 2.23 s).
     Phase 3, *the pack*: two Scents at once (when *n* ≥ 3).
   - *A fight about ground.*
2. **The Last Spellmaster** (`spellmaster`; Ancient Lich 33, x2.5): the Spire's master of spells, raised by the Kyn.
   - **Havens**: two to four gold discs (r 3) at radius 13 of the court; everywhere else takes the Haven Nova, 60%. The
     gate's dodge, turned inside out. A CHECK, so its wind-up is THE ERRAND FLOOR's: the longest route to the nearest
     haven plus 1.5 s. The havens are the first two, three or four of the court's four spots (two neighbours at two),
     and the route is measured over the whole court - its heart, its rim and a 0.5 m grid, plus the grid's half
     diagonal, so never under the truth (`egHavenRouteM`): 5.23 s for two havens (25.7 m), 4.31 s for three (19.2 m)
     and 2.99 s for four (10.0 m, from the court's heart). Beside another lord on a ground of many pieces (THE OLD
     MASTERS on Grath's islands, the Twins' courts, the Colossus's forge, the Wyrm's cavern) the havens and the route are
     the whole floor's (`egHavenFloor`): from the havens a court would lay, one more stands at the floor's farthest point
     (kept 3 m on it) until the route is no longer than those havens' on one court, at most eight; the route is WALKED
     over the floor's pieces on the same grid (a diagonal step its own length), never across the magma.
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
     law (DUEL1's `_keepInArena`, `clampToRing`). Every screen draws it where the room stands it (`pg.ring`): a band of
     fire 0.5 m either side of its rim, burning ground's pool on the floor under it (`scenes/eliteGates/egFight.js`
     `duelRing`; FIELD BUGS 2026-10-18d DUEL-RING - before it the rim kept the motor and nothing drew it).
     - The challenged must last 15 s or deal a tenth of his health inside it.
     - Outside, the company breaks the ring's `clamp(n - challenged, 1, 3)` braziers (each 4 s of the company's
       reference damage) to open it early, while the legion presses.
     - *n* = 1: no ring and no braziers: the Challenge is that duel in the open, with his whole kit - the member marked,
       met by a tenth of his health dealt within its 15 s, so his signature is a company of one's too. Its words say so
       (*A challenge in the open! Deal him a tenth of his health within 15 s.*, and lasted unmet *The challenge goes
       unmet.* - the `challenge` and `challengeend` words' `t`, `EG_DUEL_OPEN`), never the ring's *The ring of fire rises.*
       and *The ring falls.* (FIELD BUGS 2026-10-18d).
   - **Riposte**: a cone (5 m, 90°) that answers a blow landed in the 0.6 s after his guard rises, 0.9 s (floor
     0.80 s). The tell: his blade raised, glinting.
   - **Lunge**: a lane 4 m wide and 10 m long, 1.0 s (floor 0.79 s). **Whirl**: a disc of r 4, 1.3 s (floor 1.08 s).
   - Phase 2, *the second challenge*: two members challenged at once into the one ring (when *n* ≥ 4) - it rises about
     him and the first, the second is drawn into it, either one's blows count toward the tenth, and its braziers are
     `clamp(n - 2, 1, 3)`.
   - Phase 3, **the Last Lesson**: the court's edge closes 1 m every 6 s, to r 12, and burns there to the fight's end.
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
     `SD_ECHO_PAIR_MS`; `EG_TWIN_ONE_MS`, 20 s, in one court).
   - **Fire-touched and Frost-touched**: a member struck by Vael is Fire-touched for 12 s. They deal +25% to Isk and
     take +25% from Vael. The reverse holds for Isk. A blow struck them when the relay's reckoning of the poses finds
     them in it as it lands (the census's), and the mark is said (`emk` 2 and 3) for every screen's sigil. The +25% taken
     is the struck screen's alone: every blow of the Twins carries its clan's element, which the census sees and never
     counts (section 21).
   - **The Crossing**: every 60 s they cross the walkway (at most 24 m long) and change courts as it lands. The walkway
     is struck along its length, 3.0 s, a lord's blow at the depth's share; the escape runs along it to either court
     (floor 12/6.975 + 0.5 = 2.23 s).
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
     damage. With all three broken she is dragged down and grounded for 30 s, x1.3; they rise again 20 s after she takes
     the air, and only anchors broken drag her down.
   - **Gutterdark**: the braziers gutter in turn. The floor goes dark; telegraphs keep their light (section 25.6), and
     every foe keeps a rim light - every 30 s for 10 s (`edark`), the Eclipse's dark pool over every fight floor on every
     screen, every foe the Shade's rim.
   - Phase 2, **Wingbeat**: a glade-wide gust every 8 s, told 1 s, 3 m/s for 1 s (the Steps' gust).
   - Phase 3, **Moonfall**: the anchors rise again 40 s after a grounding ends, two Divers with each.
   - *A fight about the air.*
9. **The Night-Stalker** (`stalker`; Vampire Ancient 30, x2.5).
   - It vanishes. Where it stands is drawn as an umbral disc on the floor, the telegraph pass's mark kind.
   - **Blood Tether** on two members, broken by standing 14 m apart for 2 s; it heals the Night-Stalker (the pull-apart
     grammar).
     *n* = 1: it binds a Blood Thrall 4 m away; kill it or put 14 m between.
   - Bat swarms: Harriers as Giant Bats.
   - Phase 2, **Three Shadows**: three umbral discs; the true one glints with its WIND, 2 s before it rises on it
     (`EG_UMBRA_GLINT_MS`). Nothing on the wire tells it before: every disc is said alike, and its row stays where it
     vanished until it rises.
   - Phase 3, **Blood Moon**: tethers on three members, broken at 16 m.
   - *A fight about distance.*
10. **Valkynaz Seyth of the Shade**: Redoubt 15.

#### The Havoc Wellhead

11. **The Bound Colossus** (`colossus`; Iron Atronach 36, x4): the Battlemages' war-engine, Dagon's now.
    - It walks a fixed route down the Forge Gut's long forge chamber (55 m), stamping lanes 4 m wide and 12 m long ahead
      of it (1.4 s; floor 0.79 s).
    - Its vent-hearts, `4 + 2·floor(n/3)` (4 to 8, always even), are on its back, in pairs within 6 m of each other.
      **Rails rise along its flank every 15 s** for 8 s, drawn gold along its flanks on every screen; while they stand
      its hearts are open to blows. The climb they would carry members up is not built: the hearts are struck from the
      floor beside it while the Rails stand (section 30 says why).
    - Break every heart before its Overload (every 75 s; 70% to all, a CHECK) and it is stunned 8 s, x1.5.
    - Chain lightning: a disc of r 2.5 on a member (1.2 s; floor 0.86 s) that leaps to the nearest member within 6 m.
      Spread.
    - Phase 2, **Paired Hearts**: the two hearts of a pair must break within 5 s of each other, or both relight. One
      member breaks a pair alone in time (6/6.975 + 1.5 = 2.37 s).
    - Phase 3, **Breakdown**: it kneels for 20 s at x1.5 (a stun's stillness, and its weight never a stun's times the
      kneel's), then walks half its route: the half it knelt in.
    - *A fight you climb.*
12. **The Wellhead Wyrm** (`wyrm`; Dragonling 34, x5, flying).
    - In an open-sky cavern, it perches on three pillars, breathing lanes (4 m x 16 m, 1.4 s; floor 0.79 s) and cones
      (10 m, 90°, 1.5 s; floor 1.10 s); it takes flight and drops meteors (discs of r 4, 1.8 s; floor 1.08 s).
    - Each pillar is reached by a side span and broken from on top - from spec law 8 the span a stair from the court up
      onto the perch's top, 3 m up (AUDIT EG V, lane5 #15: law 7's lay flat at the court's height, under the perch, and
      a member walked in under it and fell). With its perch broken it lands, x1.3, for 25 s, until it finds another;
      with none left standing it stays down.
    - Phase 2, **Burning Perches**: the pillar it leaves erupts as its perch breaks under it (a disc of r 6, 2.0 s;
      floor 1.37 s).
    - Phase 3, **Grounded**: no perch; a breath of 180° and 12 m (inscribed r 6; floor 1.37 s; wind-up 1.6 s).
    - *A fight for every build.*
13. **Valkynaz Garoth of the Wellhead**: Redoubt 20, and every fifth after.

### 13.4 The Valkynaz

ONE brain (`net/eliteGates/egLords.js`) with a signature for each Valkynaz. Each fights on its band's own ground, with three of
the gate's blows (Cleave, Slam and the Meteor from `ATTACKS`, at the depth's shares, each lengthened to its floor, the
Meteor named by the aspect and leaving the gate's burning ground, `POOLS`'), two
of its own, its signature, and a third-phase set-piece. Each wears its own look (`BOSS_LOOKS`: Daedra Lord 31 at 3.0,
3.3, 3.6 and 4.0, tinted by band) and its own WIND set. The deepest boss of the endless mode is never the commonest
fight of the game again.

| Valkynaz | Redoubt | aspect (`GATE_ASPECTS`) | ground | its own blows | signature | phase 3 |
|---|---|---|---|---|---|---|
| **Ilthys of the Galleries** | 5 | Burning | **the Council Rotunda**: a floor of r 24 and three balconies 4 m up, two stairs each (from spec law 8, either side of each balcony's middle - AUDIT EG V, lane5 #14: law 7 laid none, and the banners on them stood out of every melee reach) | **Spear of the Conquest** (a lane 4 m x 22 m, 1.3 s); **the Muster-Call** (a wave from the balconies) | **the Conquest**: she plants a banner (an errand's object, struck) on each balcony that claims a third of the floor - struck on its balcony by a blade, and from the court by a shaft or a spell (FIELD BUGS 2026-10-18d BANNER-SHAFT). Claimed ground burns (a pool, told 3.5 s: the longest way off a third of the floor is 20.8 m) until its banner is broken, and while two banners stand they hold her ward (25 s at most) - her bar caged and *Warded* while it stands (section 25.2), and the Conquest's word says both | **the Last Charge**: a third of the floor falls every 20 s, told 5 s ahead, and rises again when the next falls |
| **Morvayn of the Cairn** | 10 | Venom-Blooded | **the Soul-Bridge**: two Ossuary crypts (r 14) joined by a rib bridge 30 m long | **Venom Lash** (a cone 8 m, 90°, 1.3 s); **Soul Rend** (a disc of r 4 on a chained pair's midpoint, 1.5 s) | **the Chaining**: pairs of members are bound by soul-chains for 20 s (the stay-close grammar). A pair stretched past 8 m both take 30% (a CHECK), and a blow on one is shared with the other: divided between the chain, a pair's halves (a three's thirds). An odd member, or a member alone, is chained to a Wraith; kill it to break the chain | **the Last Rites**: Wraiths rise at both crypts every 20 s, and chains bind threes |
| **Seyth of the Shade** | 15 | Rime-Wrought | **the Eclipse Vault** (section 11.2), the Eclipse running | **Frost Lance** (a lane 4 m x 18 m, 1.2 s); **Moonshatter** (three discs of r 2.5 at members' feet, 1.4 s) | **the Mirrorcourt**: two mirror lords fight beside her and throw real blows at half share. Only the true lord casts her ground mark and her bar's pip; the mirrors shimmer (a 2 Hz dither line) and crack audibly when struck. A mirror shatters after 8 s of the company's reference damage and returns 20 s later | **the Long Night**: Gutterdark over the whole vault, to the fight's end (`EG_ZONE_FIGHT_MS`), while the moon-shafts walk at a fixed 1.5 m/s, kept lit in it |
| **Garoth of the Wellhead** | 20, 25, 30... | each of the four in turn, in `GATE_ASPECTS`' order: Burning at Redoubt 20, Rime-Wrought at 25, Storm-Crowned at 30, Venom-Blooded at 35 | **the Clan Pit** (section 11.2) | **Wellfire** (two lanes 4 m wide crossing at his feet, 1.4 s); **the Kyn's Due** (a disc of r 5 on the top of threat, 1.6 s) | **the Clan Muster**: each phase turn calls an honour duel (one member, the Armsmaster's ring law, r 6, 15 s; none at *n* = 1), at the turn, inside its ward, holding the next threshold until it ends - at the third turn, his fall; his own duel, which no other lord's kit ends (another's ring standing at his turn, his waits for it under his ward) | one of the three older signatures, by turns from one Garoth Redoubt to the next, under the next aspect, with every decree the circle bears - his own, its card naming it (*The Conquest.*, *The Chaining.*, *The Mirrorcourt.*): the Mirrorcourt's mirrors in his likeness, the Chaining in pairs (chains of three are Morvayn's Last Rites), and never the Eclipse, the Vault's |

A Valkynaz's Redoubt rolls its spoils twice and may give a key (sections 5, 19). The first Valkynaz a company fells is
its first true feat in the Spire.

## 14. Decrees - what deepens a circle

At each Redoubt the next circle's **decrees** are chosen and shown on the beacon: *The next circle bears: Gale-Swept,
Hunting Pack.* With them the beacon names the next lord: *The next Court: Grath, the Hound.* The company knows what is
coming before it chooses to go on. Each family's ask closes at its 10 s, as every ask of the company's word does
(section 16.4). Its choice is kept for the next circle (`B.next.dc`, which the rest's end makes the circle's) and said on the
state as `nx`, and every screen's rest line says both (`ui/eliteGates/egHud.js` `egNextCircleText`, the lord the law's `egBossOf`, with the
second lord the strata stand beside it - `egStrataSecond`).

- **How many**: circle 1, none. From circle 2, `min(4, 1 + floor((c-2)/2))`.
- **One per family**: never two from one of the five families, so a company can track every one. Dagon's Bargain
  (section 8.7) may add one more for its circle, from a free family.
- **Standing decrees.** The week's Proclamation (section 20) and a Wager's decrees (section 18) stand for the whole
  breach and hold their families: a circle's drawn decrees, and a Bargain's, come only from the families they leave
  free, and a Wager's three come from three different families. So a circle bears at most nine (four drawn, a
  Bargain's, the Proclamation and three wagered), and the frames carry nine under their own validator. The draw's rule
  binds what Dagon chooses: a circle's draw and a Bargain never bring Swarm-Mother or Gale-Swept before the Cairn. A
  Wager is the company's own choice and may take any decree from Hall 1, and it bites from there: its Swarm-Mother's
  Binders and its Gale-Swept's Gusts stand in the Galleries too.
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
| | **Swarm-Mother** | every wave the legion draws carries a Binder - the hall's, a lord's, an escort's, the Athenaeum's Harriers' (the fight's own decree, `egWaveKinds`); a span's shadows and Hunting Pack's Harriers are their own (from the Cairn) | two Binders |
| | **Kyn's Vigil** | every hall's trial begins with the band's champion on the arrival plate, with its escort (`1 + ceil(n/3)`, section 8.5); never in a Proving Walk, a Court or a Deepway whose chamber is a champion's (their own stand there), the Scriptorium (no trial), a span or a Brink (a crossing: its plate is the crossing's start, and a champion keeps to the fight ground, so it could follow no one) | with its escort doubled |
| | **Kyn's Rally** | a slain add gives its wave's living +10% health, up to three stacks, shown as pips over them | +15% a stack |
| | **Soul-Pools** | a slain add leaves a pool (r 2.5) for 8 s that heals adds 3% a second unless a member stands in it | r 3.5 |
| **ground** | **Ashfall** | fire falls on court discs: a meteor's disc every 12 s | every 8 s |
| | **Gale-Swept** | every span (a Span's, a Proving Walk's) carries a Gust section (from the Cairn) | two Gust sections |
| | **Crumbling Halls** | every span carries a Crumble section, and has one island fewer | two Crumble sections, two islands fewer |
| | **Wellhead Sparks** | every 20 s, `ceil(n/2)` sparks rise, each felled by one blow; any left after 8 s bursts (a disc of r 2.5, 1.2 s, 15%) | `n` sparks |
| | **The Fraying** | the Hour's omen: an Athenaeum's Orrery snaps back at 36 turns in the first circles, eight past its longest road (`egFrayOf`, section 8.4); drawn only for a circle with an Athenaeum | four past its longest road |
| **the Covenant** | **The Covenant's Press** | the next Redoubt adds 10 minutes, not 15; the count's chip says so (*+10:00 - the Covenant's Press*) | 5 minutes |
| | **Ashen Vigil** | the next rest heals half; the rest card says so | a quarter |
| **lord** | **Colossal**, **Unyielding**, **Vengeful**, **Grudge-Bearer** | the gate's boss-general trials, recast as laws (below), on the Court's lord alone | the laws' rank II values (below) |

**THE SPAN DECREES' SECTIONS** (spec law 6, `EG_DECREE_LAW` in `net/eliteGates/egLaw.js`; AUDIT EG III). Gale-Swept and Crumbling Halls
lay a section a rank on every span of a hall:

- a Span's road, and both roads of THE FORK - the Low Road's after its niche, in place of its still ground, so neither road
  escapes the decree;
- a Proving Walk's second span, the one to its door, which is the decrees' sections alone. Its first span runs four pieces
  (three under two ranks), and Crumbling Halls II's second section ends it, before the court.

How each is laid:

- **a Gust section** stands on an island of its own, two pieces at least;
- **a Crumble section** is laid straight on from the ground before it and brings no island, so the span has one island
  fewer than a section brings (two at rank II);
- rank I's section is three pieces, two as the room past 102 m allows. Rank II lays two sections of two pieces each, apart
  on their road (a run, an island or a passage between them);
- under two ranks the runs before them yield their room (two pieces a run, and none beside a set piece), so every hall stays
  inside `EG_HALL_LEN_MAX`;
- a Brink's fixed course and a Deepway's fragments carry none.

Laws 4 and 5 lay as they laid (THE LAW PIN, section 22): Gale-Swept on the High Road alone, rank II one longer section, the
Proving Walk and the Low Road untouched.

A wave's cadence and a decree's own cadence (Hunting Pack, Ashfall) are "more at once", which depth may add. NOTHING
GETS FASTER binds every wind-up, every piece's timing and every crumble, never the number of things at once (section
18).

**The merge.** The gate's trials carry no `.law`, and their keys (`hp`, `dmg`, `hit`, `size`, `slamR`, `groundMs`,
`shieldMs`, `threatPick`, `threatDecay`, `heal`, `feeds`, `legion`) do not end in `X`. So `sdMarksLaw`'s rule (a key
ending in `X` multiplies; any other is overridden by the last mark that names it) cannot fold them as they stand. EG5
recasts the four boss-general trials as X-keyed laws:

- Colossal: `sizeX` 1.25, `hpX` 1.25, `radiusX` 1.2 (II: 1.4, 1.4, 1.3). The Slam becomes 8.4 m (floor 1.71 s); the
  floor lengthens every wind-up it widens. The lord stands at its size: its body's radius, and a body's row on the wire
  (`sz`), which every screen draws it at (EG-ZQ);
- Unyielding: `shieldX` 2, `hitX` 0.85 (II: 3, 0.75), in place of the trial's `shieldMs`;
- Vengeful: `dmgX` 1.25 (II: 1.4). Every share multiplier, depth's, fury's and Vengeful's, together is at most 1.5;
- Grudge-Bearer: `threatPick` 0.85, `threatDecay` 0 (II: `threatPick` 0.95).

The gate's trials written against the Warden's own attacks (Scarring, Dagon's Favoured, Echoing, Soul-Hungry) are not
drawn, nor is the ninth, Legion-Lord: the Spire's legion is its own (section 12). The Hour's decree **The Fraying**
(`SD_OMENS`, fray 36) is the ground's (AUDIT EG V). It is drawn only for a circle with an Athenaeum (`egFrayingOpen`; a
Bargain's only with one still ahead of its hall) and only while its fray is short of the Hour's default (to circle 30), and
it reaches the Orrery through `orreryOf`'s fray parameter (section 8.4). The Spire's new decrees (every family but lord,
and The Fraying, the Hour's own) never reuse the name of one of the gate's trials or one of the Hour's omens.

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
  families, and takes **one** within the rest. Unpicked, the first is taken. Every pick still in hand at the rest's end
  (a second one - the shards' or the Athenaeum's) is taken the same way, each the first card left, and the offer closes
  with the rest: a pick and a Surplus are the rest's alone (AUDIT EG V, `net/eliteGates/egRun.js` egPicksClose).
- Taking one already held ranks it, **I -> II -> III**. An offer never shows one held at III.
- **The lean**: at the breach's first Redoubt (a deeper start's first too, section 16.6), one of the three is always
  drawn from the family of the member's most-used blow kind (the hit's `r`, over the breach - `net/eliteGates/egRun.js`
  egLeanOf): melee leans to Blade, an arrow to Hunt, a spell to Arcana. A member who has landed no blow leans to
  nothing. It nudges and never decides; the room knows nothing of classes and should not.
- **More cards**: Surplus (section 6.2) buys a fourth card or a reroll. A **bequest** (section 16.5) adds the fallen's
  card. A Mastery (below) adds one more. They stack: an offer holds at most six cards (`EG_OFFER_MAX`) - a fourth card
  past it is refused and the Surplus kept, and a reroll deals the offer again by its own law (The Hollow Offer's two,
  the bequest, the shards' card, the Lean - `m.offerO`, `net/eliteGates/egRun.js` egSurplus). Three Vestige shards (section 17.1)
  add a card - one of the member's own Vestiges below III at its next rank, or a new card when none can rank - and a
  second pick: a rank of a held Vestige, or two picks of the offer.
- **Cards that act** (AUDIT EG IV, lane10 #15): an offer never shows a card that cannot act for its member, where the
  room can see it (`EG_CARD_NEEDS`, `egCardActs`, `net/eliteGates/egVestige.js`). A Vestige that works only through an ally
  (Bastion, Spire's Standard, Fallen's Due, Mender's Grace, Lifeline) is left out for a company of one, and Steadfast
  Line under four. One that reads a blow kind is left out for a member who has landed no blow of that kind in the
  breach: melee for Searing Edge, Sweeping Arc and Counterstroke, an arrow for Hunter's Mark and Spotter, a spell for
  Overcharge, Arcane Echo and Spillover, and an arrow or a spell for Long Sight. A Vestige whose use the room cannot
  see (Battlemage's Focus and Shieldweaver: any spell) is always offered, and a bequest is the fallen's own.
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
| **Stone** | **Stoneskin** | +10 / 18 / 25% max health | client; the relay's census counts its holder's whole body |
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
| | **Hunter's Mark** | your first arrow from beyond 12 m on a foe marks it 8 s: the company deals +5 / 8 / 12% to it | relay |
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
| | **Lifeline** | a heal you cast on an ally under 30% gives them 3 s of 20 / 25 / 30% less from blows - a heal believed at a twentieth of a reference body or more (`EG_LIFELINE_MIN`), so no point's heal holds it open | the receiver's client; the relay's census applies it too |

The Redoubt's card shows the circle's damage chart with the gate's Healed column (`src/ui/gate/gateDamageChart.js`,
GATE-HEAL), so a company of eight sees what its healer did.

**Mastery Vestiges** change what their holder does, not a number. One is offered as a fourth card at the breach's third
Redoubt (a deeper start's too: the Redoubt's place counts from its own first, as THE LEAN does - AUDIT EG V) and at
every Valkynaz Redoubt; a member holds one at a time, and taking another replaces it.

| family | Mastery | what | applied by |
|---|---|---|---|
| **Stone** | **Immovable** | stand still for 1 s on a fight floor, and blows on you deal 25% less and pushes do nothing until you move | client; the relay's census applies it too |
| **Blade** | **Counterstroke** | a melee blow on a lord within 0.6 s after one of its blows lands within 6 m of you deals x1.4 | relay (it knows both), inside the 1.6 cap |
| **Hunt** | **Spotter** | your arrow from beyond 12 m SPOTS a foe, once a mark: an add loses the blow it is winding (every blow of its still to land cut, a Binder's raise broken - `egSpotted`), and the company deals +10% to it for 8 s, over any Hunter's Mark | relay |
| **Arcana** | **Spillover** | a spell's overkill on an add carries to the nearest add within 6 m | relay (host hits); the carry out of the member's purse, within its blow's cap |
| **Fellowship** | **Spirebridge** | once a span, a gold bridge over the next gap for the company, for 6 s | the room's word (`ebridge`); ground on the fair trail while it stands; never asked of the solver |

**Spirebridge** (AUDIT EG III; the room's rule `egSpirebridge` in `net/eliteGates/egVestige.js`, the plank's law `egBridgeOf` in
`net/eliteGates/egSpanLaw.js`).

- **The ask.** Its living holder asks it (`mast`) in a trial or its closing, once a hall's span: B, the pad's up, the touch
  layer's button or `/breach bridge`. The screen offers it on the stage's line only while a gap lies ahead. A Proving Walk's
  two spans are one hall's, so its holder raises one there. A screen reloaded mid-span forgets a plank it raised in that
  hall: it may offer the ask again, and the room refuses it, saying nothing.
- **The gap.** The room picks the next gap ahead of the holder's own pose by `egBridgeAhead`, on the road whose line it
  stands on. The gap begins no more than 6 m ahead and no more than 1.5 m behind. A Drop's fall or a riser's face, past
  THE ENVELOPE's step down, is spanned by none. With no such gap the ask is refused and nothing is spent.
- **The plank.** It spans the gap at the far piece's rest line, 1.6-3 m wide, lapped 0.3 m onto each side, rising from one
  side's height to the other's. It stands 6 s, said to the company (`ebridge`).
- **The fair trail** counts its top as a piece's ground while it stands (`net/eliteGates/egFair.js` `egSupportAt`).
- **On every screen** (`scenes/eliteGates/egSpan.js`) it draws gold under THE EDGE LINE and stands in the collider from its raising to
  its end - the collider the dungeon host hands the spans (`egSpanCollider`, its plank's bucket taken out at its end;
  AUDIT EG V: the host's wrapper had no `removeBucket`, and an unseen plank stood for the rest of the circle). It lays itself across over 0.25 s and falters through its last second at 2 Hz. Under reduced motion it stands
  whole and steady.
- **The solver never sees it.** Every course is proven without it, and running a plank is no faster than jumping its gap.
  So the crossing's bound (section 10.5) is not solved with it: a bridge saves at most a wait, and the bound is a measure
  that gates nothing.

**Where the company stands.** The relay reads every Vestige that works by a place - an aura, an Accord, Watchfire - on
the company where it stands (`net/eliteGates/egBrain.js` egPosedHere): each living member by the pose the room holds of it in this
hall. A member gone home, a witness, or one whose last pose is an earlier hall's lends nothing by its place, and a
Fallen's Due holder gone home lends no Due (AUDIT EG V).

**Accords.** Two members within 10 m, holding a named pair from two different families, gain an Accord while they
stand together. The offer card names it and says what it does: *Takes an Accord with Mira's Hunter's Mark. Hammer and
Anvil: A foe the mark's holder marked takes +8% from the oath's holder.* Every Accord is applied by the
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

**The marks read an arrow from beyond 12 m** (section 21; AUDIT EG III, lane2 #6): Hunter's Mark's and Spotter's mark is laid by
an arrow (the blow's `r`) from more than `EG_FAR_M` 12 m between the poses (`net/eliteGates/egRun.js` `egMarkFoe`), where no melee
blow reaches, so a forged kind gains nothing a real one would not. Any blow that lands on a dormant Lurker wakes it
(`net/eliteGates/egLegion.js` `egLurkerWake`, from `egBlow`). AUDIT EG IV (lane10 #13): a mark has two layers - Hunter's Mark's share,
the first holder's arrow at its rank, and Spotter's 10% (`EG_SPOT_X`) over it - and either joins the other, standing the
mark 8 s more; a Spotter holding Hunter's Mark I no longer marks at half its Mastery.

**Watchfire.** Every lord's brain commits each blow `EG_TELL_LEAD_MS` (400 ms) before its wind-up begins, whether or
not anyone holds Watchfire, so the blow's timing never depends on who does. The holder's company sees the early
outline as a PULSING solid red line (a dashed line is a feint's), and a blue pip marks the holder (blue is yours,
section 25.2). The warning itself is never blue, since blue on a danger shape reads as safe (WB13a T8). Rank sets how
much of the lead is shown: 0.15 / 0.25 / 0.35 s. A member sees another's Watchfire lines only for blows within 12 m of
themselves.

**Stacking.** Eight holders of one aura are not eight auras:

- the same Vestige aura from several holders applies the strongest, plus 2% for each other holder, at most +6% over
  it;
- every Vestige's damage reduction together is at most 30%, and no one rank passes it: Lifeline III stands at it (AUDIT EG III,
  lane2 #5 - its 40% never applied under the cap, so its III bought nothing over its II's 30%; now 20 / 25 / 30%);
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
- **Fellowship, Rallying Cry**: Rally's heal and every Second Wind in the company come again at each of a Court's phase
  turns - the first of its lords to turn its second and its third phase, a mirror's and a champion's never (`eheal`
  `cry`, net/eliteGates/egBrain.js rallyingCry; systems/eliteGates/spireVestiges.js spireRallyingCry) - and when a hall's door opens. AUDIT EG IV
  (lane10 #14): at a door alone it gave back what the closing could not spend; the Courts are where support is tested.

A card that would be a member's third different Vestige of a family says so in the Vestiges' blue: *Completes Stone:
Rooted. Immune to push, and your threat doubles.* A capstone is said as it is first reached (*Stone resonates: Rooted.*,
section 27.5), and the recap lists the capstones held (section 27.6).

**Death saves.** Divine Grace (`src/systems/loot/lootPowers.js`, `lootDeathSave`, registered with
`registerPlayerDeathSave`), The Hour Turns (the Brass of Numidium's) and Unbroken (Malacath's)
(`src/systems/sigil/sigilSetPowers.js`) are not timers in the Spire. In an `eg:` room each recovers at the next Redoubt
taken, and its chip reads *Redoubt*; so do the Ghost-King's Vigil, a low-health heal that never answers a killing
blow (`lootHurt`), Shed Skin (Sethrakul's Coilscale, `src/systems/sigil/sigilSets.js`) and the Panoply's Battlemage's
Reprieve. As timers they would hand out a fresh life every few minutes, and make the Brass of Numidium
mandatory. A lord's or the legion's blow lands through the dungeon context's door, never the attack formula's struck
tail, so the fight marks it a foe's as it lands (`src/scenes/eliteGates/egFight.js` landShare, `src/systems/sigil/sigilSetPowers.js`
`setSpireStruck`) and Shed Skin and the Reprieve answer it; a hazard, a zone or a drain is no foe's (AUDIT EG V: neither
had ever answered a blow in the Spire, where the Panoply drops).
**Stendarr's AvoidDeath** (`avoidDeath` in `src/systems/guild/guildServices.js`, a rank-in-fifty roll the hosts
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

The rule is the seam's `earned(f, sub)`, over the circle: at each Redoubt the circle's damage and parts are begun again
for every member entered, the fallen with the living, so a member recalled at its rest carries nothing of the circle it
fell in into the next (AUDIT EG V: only the living were begun again, and a recalled member earned the next circle idle).
An idle account pulled from hall to hall earns nothing (AUDIT
EG0 A6), and a scripted wiggle is not activity (AUDIT EG II L4-18). Each hall's part is the director's (AUDIT EG III,
lane2 #3 - `net/eliteGates/egBrain.js` `egActiveIn`, counted at the pull and at the Court's fall): the hall's damage is the
company's, *n* the living company at the hall's end; what the company took is the census's shares, and a healer's part
its believed heals as shares of their receivers' bodies - each one corroborated by the room: a heal word names its
healers, and only a healer whose own socket the room relayed a cast from to that receiver within 5 s of the word
(`EG_HEAL_CAST_MS`) is credited a part (AUDIT EG IV: the receiver's word alone made an idle companion an earner); an
errand's mark is a stood-on errand's object (a rune, a gem,
an isle, an umbra, a relic, an Orrery's stone, an engine) within its own reach or 2.5 m, or a Rampart's winch or Gauntlet
plate, stood 1.5 s unbroken; and a span is crossed in a hall the pull tolls (the Span, the Deepway, a Brink, the Proving
Walk) by a step through its door - which only a fair trail takes - or its end reached on a fair trail. A step through a
fight hall's door is no part. A receipt banks:

- **the depth**: the Redoubt joins the member's taken Redoubts, this season and all time;
- **the week's spoils** of that Redoubt, rolled from the seed its claim answers - the receipt's secret seed (section 22)
  mixed with the account service's own draw, so no page rolls a receipt's spoils before the service has said which
  receipt the week pays (AUDIT EG V) - and thrown at the beacon like the gate's spew (section 19). LOST-SPOILS
  (2026-10-22, `06-Systems/Accounts-And-Cloud-Saves-Arc.md`): an item still there when the member leaves the Spire, or
  when the next Redoubt's spoils are thrown, goes to the mailbox from the Lost and Found, its gold to the purse; a
  Reliquary does not (the owner: "No, keep the risk");
- **Marks**, and the embers section 19 pays, thrown among the spoils (AUDIT EG V);
- **a sealed Reliquary**, when that Redoubt pays this week (section 16.3);
- **the board's standing** (section 20).

### 16.2 The Redoubt's sequence

The mode's heartbeat fires in an order, timed from the lord's `fell`:

| at | what |
|---|---|
| 0 s | the gate's fall beats (WB13e; on every lord since EG-FALL): *FELLED*, the body down - the cry, the burst, the white flash and the shake; its thud at 1.5 s and the column of embers; its corpse left where it fell |
| 1.5 s | the beacon climbs at the court's heart with SPIRREDT's first chord, under the card *Redoubt 5* / *The Broken Galleries* |
| 3 s | the count's chip takes its time: *+15:00* (or *+10:00 - the Covenant's Press*, or *+3:00 - the last word* when the last word clamps it) |
| 3.5 s | the spoils thrown at the beacon, at least 12 m from the way home |
| 4.5 s | the recalls: each fallen member rises in the beacon's light, one by one |
| 6 s | the rest window opens: the Vestige offer, then the decrees' vote, then the way home and the respite |

The rest's 90 s run from the window's opening. A Ready vote (the company's word, section 16.4) ends it early and saves
last-word time.

### 16.3 The rest, the Reliquaries and the way home

**The rest** (`EG_REST_S` 90 s, the count held):

- health, magicka and fatigue restored (the room's word, each client its own body; half under Ashen Vigil - a rest of
  less than whole gives magicka and fatigue back by the same share, AUDIT EG V). The relay's census is restored with it,
  outside the mend budget. The rest card - the Spire's HUD's rest line, `ui/eliteGates/egSpireHud.js` `egRestLine` - says the
  stake and a heal of less than whole with what made it so: *The rest heals 50%: Ashen Vigil.*;
- the Vestige offer (section 15);
- the next circle's decrees, chosen by the company's word, and the next lord, both shown on the beacon - the rest's
  line says *The next Court: ...* from the window and *The next circle bears: ...* once the word closes (section 14);
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
paid this week seals none, or a company with keys would farm Reliquaries (AUDIT EG II L2-15). Only the account service
knows which pay, so the relay seals one at every Redoubt, and the member's own claim of that Redoubt's receipt tells the
room when the service answered it paid already this week (`wkpaid`, AUDIT EG III): every Reliquary of that circle then
gives `EG_REL_LUMEN` (20 lumen) instead, and the HUD's count falls with it. A word that lies only turns a Reliquary that
would open into lumen. A circle whose Redoubt the member never claimed keeps its Reliquaries sealed, and the end opens
none of them that do not pay (the service's `egReliquariesOf`). A circle's Reliquaries open once an account an arena
week: the first end whose claim opens them is the only one that week (`eg_reliqs` - AUDIT EG V: an end claimed before
its Redoubt receipts opened every circle's, at every breach of the week).

- It opens only at a good end: the end receipt with `why` `'home'`, `'seal'`, `'last'` or `'void'` (`EG_OPEN_ENDS`)
  carries how many it opens, rolled from the seed its claim answers (that receipt's secret seed mixed with the service's
  own draw - AUDIT EG V) - each circle the service opens one pass at its
  depth on its own seed (`systems/eliteGates/egSpoils.js` `egReliquaryList`), its Panoply piece on its own stream at twice the
  Redoubt's odds and with no pity (the service never sees the roll), no lord's arm nor card; given through the pool a
  Redoubt's spoils use, once an end (`scenes/world.js` `egSpoilsPaid`). The recap's count is the service's once the
  end's claim answers it.
- A fall, the tear or a wipe loses every one. The way home, THE SEAL, the last word and a void open them, and THE
  COVENANT'S PATIENCE ends a breach as the way home (section 18).
- **Every Reliquary**, whatever gives it (a Redoubt, the Reliquary Vault, Dagon's Bargain, the Honour Horn, the High
  Road's cache), is sealed only in a circle whose Redoubt pays this week, and rolls at that Redoubt's depth. In a
  circle already paid, each gives 20 lumen instead.
- The HUD shows them: *Reliquaries: 4*. The rest card shows the stake: *4 Reliquaries - 1 Valkynaz - a Panoply piece
  about 1 in 2.* (on the rest's line, `ui/eliteGates/egHud.js` `egStakeText`, each Reliquary's circle on its run's row; *a Panoply
  piece likely* past two in three).
- Every Redoubt is now the question the Spire was built to ask: walk home with four, or push for a fifth. One member
  walking home weakens the company, and that is the social tension a company of eight should feel.

### 16.4 The company's word

**The living ping.** Every living member may ping every 3 s (`lping`, `net/eliteGates/egBrain.js` `EG_PING_MS` - the screen holds the
same cooldown and says its seconds): *here*, *danger* or *mine* (an errand claimed),
a blue pillar 6 m tall whose glyph names the kind, with a chime (blue is the company's, section 25.2).

A company choice (the decrees, Dagon's Bargain, a respite, the Ready vote) is a prompt at the beacon or the shrine,
open for 30 s (`EG_ASK_MS`; 10 s until FIELD BUGS 2026-10-25 ASK-LONGER - players could not read a rest's
decrees in it) to every member, the witnesses included. It passes on a majority of those who answer; silence abstains,
and a tie refuses (for the decrees, a tie takes the first shown). One silent player never blocks the company, and
nobody decides for eight alone. A respite that passes is asked again, and the Ready with it; a Ready and a respite in one
word take the respite whole (section 6.2).

### 16.5 One life, one recall, the witness

**A fall.** A death in the Spire (the pose's `dd`), or 180 s gone in a trial, is a FALL:

- the fallen's Reliquaries are lost, and their share stays in every lord awake for the living to finish (section 13.2);
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
- **Or sooner, by the Memento.** A fall leaves a gold mote where the member fell - a fall that names no place (180 s
  gone, a `fell` with no pose, the count's fall off another hall's trail) at the member's last pose in the hall (AUDIT
  EG V). A living member passing within 2 m
  carries it (the relay judges by pose; the carrier's fall drops it where they fall). Carried to a **Battlemage's
  niche**, it spends the fallen's recall there: they return at 50% health, their newest Vestige lost, earning from the
  next hall. Niches stand on the Low Road, in the Scriptorium, in the Deepway's chamber, and on every slot-3 arrival
  plate. If nobody carries it, the Redoubt's recall stands as it was.
- A second fall is final: *The Spire will not take you back.* So is a fall with no recall in hand (a Rehearsal's,
  section 27.7), and a fall that leaves nobody living - the breach's wipe, which no recall or Memento can undo: its card
  says so and it lays no Memento, its end the wipe's (AUDIT EG V).

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
  Unfallen* and a flame on its board row (section 20). AS BUILT (AUDIT COLLECTIONS-II, 2026-10-22,
  `01-Overview/audits/Audit-Collections-II.md` L1-4): the fall counted is the member's own - a Redoubt receipt's `fl`
  is its member's falls (`egBrain.js:"fl: m.falls ?? 0"`) and egHonourBitsOf grants on it
  (`egHonours.js:"c.fl === 0 && c.ew === 0"`) - so a member who never fell holds the title whoever else in the company fell. The
  Collections page says what is built; which is meant is the owner's to decide.
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
  Memento lies in Hall 22*) - built (AUDIT EG V): the stage line reads *Watching II Mara - health 64%.*, the health the
  party's pose of them;
- **the witness's sight**: witnesses see Lurkers' anchors, alcoves and the next hall's twist that the living cannot;
- **the ping**: every 3 s, one of three kinds (*here*, *danger*, *cache*), a blue pillar 6 m tall with a chime, its
  cooldown shown - the touch layer's *Ping* button carries its seconds, the pad's up pings, and a press inside it is told
  them (AUDIT EG V);
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
- **Vestige shards**: three, spent at a Redoubt, add a card of the member's own Vestiges at its next rank and a second pick (section 15).
- A cache may be the Kyn Mimic's (section 8.7).

### 17.2 Cantrips

Run-only consumables. A member holds up to three and may use one anywhere outside a lord's shield (`{k:'cant', i}`,
the relay's word) - every lord's (the second Twin's too), and the stair and the rest are anywhere. Sight alone is kept
where no hall's fight stands, since there is nothing to show:

| Cantrip | what |
|---|---|
| **Sight** | caches, alcoves and Lurkers' anchors are shown to the company for the hall |
| **Stillness** | the next hall's first wave and rift pour 10 s late (`EG_STILL_MS`), whatever sets it - a Rift-Yard's rifts, a span's shadows, a Rampart's march, an Athenaeum's pressure, a Proving Walk's escort, a Court's first escort from its ring's wake. A hall that pours none (the Scriptorium, a Brink, a Gauntlet, a Deepway's champion chamber) leaves it for the next |
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

- at most `EG_POTIONS_PER_HALL` (2) restoring potions a hall, refilled at each wake and at the rest; the count is kept
  on the device by its breach, hall and stage (`eg.potions`), so a reload refills nothing (AUDIT EG V);
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
     kit, on the lord's own ground: one seam, one fight - won when both have fallen, the lord's fury its own);
   - **The Warband**: every hall begins with a Kynval Squad;
   - **Hungering Dark**: the rest heals half and Rally a third;
5. **the Wellhead's strata**: at Redoubt 20 and every fifth after, one stratum joins for the rest of the breach. The
   six come in the order the arena season draws them (`egSeasonStrata`, a seeded shuffle of the season's number - every
   breach of a season meets the same stratum at the same Redoubt, so the Depths board ranks one test), and a breach that
   starts deeper (section 16.6) begins with every stratum of the Redoubts it starts past (`egStrataTo`, `net/eliteGates/egRun.js`):
   - **The Twin Court**: a second lord beside the Court's own, of another band than its own (`net/eliteGates/egBrain.js` egStrataSecond, one of
     the Hound, the Cairn-Keeper, the Mother of Dusk and the Colossus, turning with the circle), each lord at 0.6 health
     (`EG_PAIR_HP`; a Kyn champion beside them whole), the union floor over both, won when both have fallen; each lord
     its own aspect (the second re-aspected to the Wellhead, the Court's own lord keeping its own, the Twin Lords their
     clans' fire and frost), and a Markynaz's decree folded into the fight's one law whatever lord is stood after him;
   - **The Mingled Legion**: no wave is one kind and Harriers. Every body of a wave is drawn on its own among the lead
     kinds (Harriers, Breakers, Casters, Wraiths, and Divers under the sky - `EG_MINGLED_LEADS`), and a Daedra Lord
     leads one wave in three, not six (`net/eliteGates/egLegion.js` egWaveKinds);
   - **The Old Masters**: a master rises beside every Court's lord, as the Twin Court's second does: the Last
     Spellmaster at an odd circle and the Last Armsmaster at an even one, and the other master beside a master. The
     pair keeps the Twins' 15 s law (`F.mem.oldMasters`, read by `net/eliteGates/egLords.js` egLordsPairOf: they fall within 15 s
     of each other, or the survivor raises the other). Where both masters stand (THE MASTERS' GROUND), the Last Lesson stops at r 17
     (`EG_MASTERS_LESSON_R`), the havens keep their r 13 ring, and the Examination's runes stand on a ring of r 16
     (`EG_MASTERS_RUNE_R`) whatever the ground lays, so neither master's errand stands in the other's burning ground.
     On another lord's ground of many pieces (Grath's islands, the Twins' far court) a master lays its errands and its
     court's blows about the disc it stands on, never the ground's first (`net/eliteGates/egLords.js` mainDisc), and the
     Examination's window is never under THE ERRAND FLOOR of its route walked over the fight floor (`egRuneRouteM`). The
     Last Lesson keeps the court it turned on, and its last ring stands to the fight's end, stood again if the fight's
     later zones push it out: one keep for every zone laid to the fight's end (`egZonesKeep`: the Molten Rim, the
     Lesson's ring, Both Courts Burn) (AUDIT EG V).
     Each lord counts and tops up its own mirrors and images (Garoth's borrowed Mirrorcourt beside the Spellmaster's
     Mirror Images), and each its own duel (section 13.2). Holding the Twin Court as well, the master is the second;
   - **The Molten Rim**: the outer 3 m of every disc of a Court is magma, and 2 m past its edge (a fight hall's way in
     and out keeps its edge): every way across it - where the course's last leap lands on the disc, each end of Grath's
     bridges, each of the Wyrm's stairs, the Twin Lords' bridge - is a gold causeway over the magma, the way's width and a
     metre, from half a metre inside the magma to half a metre past it (`net/eliteGates/egLaw.js` `egMoltenRim`: a haven, THE HAVEN
     GRAMMAR's gold on what you stand on), and a screen casts back on the magma only off every causeway (`egRimCastsBack`).
     The director stands its zones again whenever the fight's newest push them out of its last few (AUDIT EG V, lane1
     #21: AUDIT EG IV's ring left every Wellhead Court's way in 5.5-6.2 m of leap against the span build's 3.26 m, and
     Grath's bridges' mouths inside it);
   - **Kyn Champions**: Clan Feud at every Court;
   - **The Hollow Offer**: two Vestige cards instead of three, one of them always a Mastery - a Surplus's reroll deals
     it again by the same law;
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
| **spoils** | rolled on the seed the claim answers (`net/eliteGates/egPay.js` `egSpoilsSeed` - the receipt's secret seed mixed with the service's own draw, AUDIT EG V) and thrown at the beacon: `rollEgSpoils(seed, level, R)` | below |
| **a Reliquary** | sealed; opens at the way home | section 16.3 |
| **Marks** | 20 | a new faucet, `MARKS_FAUCETS.eg` (`eg` joins `MARKS_COMBAT.kinds`), inside `MARKS_COMBAT.perDay` (150), shared with the gate, the raids and the serpent (`src/net/marksLaw.js`) |
| **a guild's deed** | 25 to the treasury, when three members of one guild, each 7 days in it (`tenureS`), take the same Redoubt | the gate's deed law, at most 4 a guild a day |
| **Deadlands Embers** | at a Valkynaz's Redoubt, `1 + floor(R/10)`; and 1 for each Redoubt taken for the first time this season | the Broker's currency (`BROKER_PRICES`, `src/systems/sigil/sigilBroker.js`). The Spire's embers join `EMBERS_EARNED_SQL` (today gate and serpent embers alone), so the insignia and the sink spend them; a paid Redoubt throws them among its spoils, one stack (`systems/eliteGates/egSpoils.js` `egEmberStack` - AUDIT EG V: the purse counted them and no pack held them, and the Broker takes from the pack) |
| **a Weir Key** | at a Valkynaz's Redoubt, 1 in 4, at most one a week | section 5 |

Embers are paid where they are earned, not by the hour. A gate pays one or two. The insignia (30 and 50 embers, Mac's
*"expensive and sought after"*) stay a season's work, not a week's.

**The spoils** (`systems/eliteGates/egSpoils.js`, in `rollSdSpoils`' order; every new draw after the last, as SET6's law requires):

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

**EG15 record (2026-10-12):** the set is `panoply` (`systems/sigil/sigilSets.js`), its nine records `PANOPLY_SET_PIECES`
(`systems/aetheric.js`, under `EG_PANOPLY_IDS`; `mintPanoplyPiece` picks the spoils' piece, `panoplyPieceById` the sink's),
its powers and the Spire's recovery `systems/sigil/sigilSetPowers.js`'s; the whole record is `Sigil-Sets.md` section 6e.

**No Gilded piece.** Mac, of the Hourlock: *"The most rare and gilded item in the entire game"*. GILDED1 made it the
one, and the Spire's top drop is the Panoply.

**Feats of the Spire.** Each lord has three feats, each an honours bit, written with its slice: a thing to master, not
only survive. Examples: Grath felled with no member caught by a burning bridge; the Examination passed with no rune
missed at *n* = 8; the Twin Lords falling within 3 s of each other. A band's feats, all held, grant *Master of the
Galleries*, *of the Cairn*, *of the Shade*, *of the Wellhead*. A signature reads its own lord, whatever lord stands beside
it (`net/eliteGates/egFeats.js`): the Colossus's Breakdown on its own body, Ilthys's banners by kind, the Twin Lords' falls on their
own bodies; and every one is a company of one's to earn - the Last Armsmaster's Challenge is met in the open at *n* = 1.

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

**SPIRE-FIRST (2026-10-20): the first company came.** The account Serveride - shown in the room by his character's name,
Severide - took Redoubt 10 first, alone, in 1:17:40 (the herald's post; the Descent's Alone bracket), and the owner
granted it: *"Since hes world first. He should get this title plus a custom aura"*. `EG_FIRST_HANDLES` names Serveride,
and the list is closed with him - there is one first company. Firstlight was rebuilt as that aura, its own and nobody
else's (section 31, SPIRE-FIRST). The list is ACCOUNTS' HANDLES: the herald says the name the room reads, which since
NAME-AS may be a character's, so a name off the herald is never put on it as it stands (section 31, SPIRE-FIRST-NAME).

**EG-E1 record (2026-10-12): what a Redoubt pays.** The account service pays a Redoubt's `w` receipt at its claim, by
the pay law `net/eliteGates/egPay.js`, and the Broker sells the Panoply's sink. File by file:

- **`server-account/src/egEconomy.js`** (new) holds the pay. `egRedoubtPay` gives claimEg the Redoubt's row, its pay's
  statements for the claim's own batch, and its answer. The service decides everything in SQL, in that one batch:
  - **the week's pay**: the row is paid only when the account has no paid row of that Redoubt in that arena week, and a
    Rehearsal is never paid. Every payment is written only while the row this claim stamped with its own nonce stands
    paid (the service's draw, as a raid's and a serpent's claims stamp theirs), so a refused re-claim of the same
    receipt carries none. Two claims racing take one week's pay between them;
  - **embers**: `egEmbersOf` is written to the row's `stones`. A first this season is a Redoubt with no paid row since
    the season's first week (`egSeasonWeek0`);
  - **the pity**: the row's forced passes and the account's new count are both read off `players.eg_pity` as the batch
    finds it. The passes are counted in order, so at nine a Valkynaz's first pass misses to ten and its second is
    forced;
  - **a Valkynaz's key**: 1 in 4 by the service's own die (eg.js `drawUnder`). The row is marked (`wkey`) only while the
    week has given the account no key (`players.eg_valk_wk`), and the key is counted only by a row so marked.

  `egReliquariesOf` answers an end's Reliquaries. `egSinkOf` and `egSink` are the sink.
- **`server-account/src/eg.js`**: claimEg passes `{ env, character }` through and splices the pay into the `w` arm's
  batch. A Redoubt's answer is `{ recorded, q: 'w', b, w, keys, paid, again?, marks, deed, embers, purse, weir, pity }`.
  A receipt carried again is `claimed` and `again`, with the pay its row keeps. `egKeysOf` answers the week's sale too
  (`sink: { week, piece }`).
- **`server-account/src/marks.js`** and **`src/net/marksLaw.js`**: `MARKS_FAUCETS.eg` strikes 20
  (`EG_PAY_MARKS`). `eg` joins `MARKS_COMBAT.kinds`, inside the day's 150 with the gates', the raids' and the
  serpents'. `eg` is a mint in `MARKS_KINDS`. `CLAIM_GUARDS.eg` reads the row's nonce and its pay. The line id is
  `egStrikeRid` (`eg:<week>:<Redoubt>`), so the ledger's UNIQUE (actor, rid) holds a Redoubt's silver to once a week.
  A guild's deed is the gate's law on the event `eg:<breach>:<Redoubt>`.
- **`server-account/src/accounts.js`**: `EMBERS_EARNED_SQL` (exported now) adds the Redoubts' `stones`, so the
  insignia and the sink spend the Spire's embers.
- **The end's Reliquaries (section 16.3).** A Reliquary's roll is the client's, off the end receipt's seed, but only the
  service knows which circles pay this week. The `x` claim answers `rl`: those of the relay's circles, one entry a
  Reliquary, whose Redoubt this breach recorded paid. A circle whose Redoubt this breach never recorded opens when no
  breach of the account was paid for it this week. A Rehearsal's end opens none. AUDIT EG V: and a circle another end of
  the account's opened this week opens none (`eg_reliqs`); the roll's seed is the claim's (`seed`, the receipt's mixed
  with the row's own draw - `eg_runs.nonce`), as a Redoubt's is (`eg_redoubts.nonce`).
- **The sink.** `POST /v1/eg/sink { piece }` (one of `EG_PANOPLY_IDS`) is one conditional UPDATE in the insignia's way:
  `insignia_spent + 20`, where the purse covers it and no `eg_sink` row stands this week. The week's row is written by
  that write alone. It answers `{ ok, piece, week, purse }`, or refuses `guest` 403, `piece` 400, `bought` 409 (which
  piece) or `short` 409 (the purse and the price). It is in `ROUTES`, the eg act map, `EG_STATUS` and the route comment.
- **`server-account/src/index.js`**: the claim takes `{ receipt, character }`. INT5's `grantSpoils` fires only for a
  recorded, paid Redoubt.
- **Migration 0117** (EG-PLAY's, unshipped; 0111, 0112, 0113, 0114 then 0116 on its branch, renumbered past NAME-AS's 0111, SEAT-FACTS' 0112, LAMP-KEEPER II's 0113, FIRMAMENT-ON's 0114, KG6's 0115 and POI-1's 0116 at the merges) gains a block of its own:
  - `eg_redoubts`: `wk`, `paid`, `stones`, `nonce`, `forced`, `wkey`;
  - `players`: `eg_pity`, `eg_valk_wk`;
  - the table `eg_sink (account, wk, piece, at)`.
- **The client**:
  - `net/accountClient.js`: `accountEg(...).claim(receipt, character)`, `.sink(piece)`, and the words `bought` and
    `piece`;
  - `systems/sigil/sigilBroker.js` `panoplySale`, the insignia's two halves. The host's `mint` comes first (a piece it cannot
    make is never paid for). Then the embers leave the pack before the service is asked. A refusal gives them back. A
    lost answer is asked after (`held`). A held sale adds the piece, with no Broker price on it, and is saved;
  - `ui/brokerWindow.js`: "The Battlemage's Panoply" under the insignia (`panoplyRows`, the nine pieces by section 19's
    names). It shows the price and "One a week", and its Buy says why not ("Need 15 more", "Bought", "Next week"). A
    sale in flight holds every other;
  - the combat cap's words name the Redoubts (`MARKS_TEXT.cappedEg`, `CLAIM_SOURCE.eg`, `HAUL_CAPPED_TEXT`, the Bank's
    card).
- **Departures.** The `nonce` is the service's own draw, never the receipt's `c`: a nonce read off the receipt would
  pass a refused re-claim of that receipt, which is AUDIT SILVER-WAYS A1's hole. The pity counts the Redoubt's own
  passes. A Reliquary's roll is the client's, unwitnessed, and moves no count. The world host carries the claim's
  `character`, `weirHeard` on the `w` answer, the Panoply's `mint` and the Broker's `panoply` deps (EG-E's host wiring,
  its record in section 31); the other three hosts carry no Broker or claim.

**Pins.** `test/net/eliteGates/egeco_service.test.js` (12) and `test/systems/eliteGates/egeco_broker.test.js` (3). `tools/mutants/egeco_pay.json`
(58, every one dead). `ACCOUNT_VERSION` stays EG-PLAY's (`acct121` then, `acct137` since the merges): the migration is
EG-PLAY's 0117, unshipped.

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
- **Who counts**: a company's size counts its entrants - every member its room admitted, earning or not. The receipt
  carries `co` (the entrants' count and tag, section 23), and a company's row takes the deepest `h` of its members.
- **Champions**: each bracket's top ten at a season's end hold *Spire Champion* through the next season
  (`iliacHonoursOf`'s pattern). They are kept once the season is a receipt's life (`EG_RECEIPT_TTL_S`, seven days) past
  its end: an end issued in its last hours may be claimed that much later and still lands in it, so until then the title
  follows the season's standing as it is (AUDIT EG IV).
- **The reads** (AUDIT EG III): a Worker keeps the boards' rankings `EG_BOARD_CACHE_S` (a minute), and a claim it records
  forgets them, so a crowd at the window reads the season once a minute. An end's claim still reads its season's ends to
  place its company, keyed as the board keys it (the recap's standing must count the claim itself), and the Deepest
  Redoubts read every Redoubt ever taken whenever the rankings are read: a board places the caller and says its total out
  of every company and account, so a narrower read would be a rank query over the same rows - a departure, said so.
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
`src/ui/iliacTableHud.js`, one DOM panel outside the window stack, is the precedent for the enhanced skin only. That
panel is still an enhanced door (`enhanced-egboard`, on the enhanced doors' stack), so a pad's cursor drives it, Tab puts it
away and Back closes it.

**The herald** (`net/eliteGates/egHerald.js`: pure builders, as `src/net/gate/gateHerald.js` is). Like the Hour's and the serpent's
heralds, it posts to the gate's webhook and falls back to the gate's role, pinging no one:

- a company taking Redoubt 10, 20, 30...: *<opener>'s company took Redoubt 10 of the Battlespire (Hall 50) in
  1:51:20.* - the time since the breach's first hall woke, so a breach begun deeper says where it began: *... in 20:04,
  from Redoubt 9.* (the news carries its start, `ew`; First of the Spire's post says it too - AUDIT EG V). A company of
  one is named as one: *Mara took Redoubt 20 of the Battlespire (Hall 100) alone in 40:00, from Redoubt 10.*
  (LONE-HERALD, below);
- a new top of the Descent in any bracket;
- *First of the Spire*, and *the Lone Beacon*;
- a band's seal lifted: *The way below the Galleries is open.*

An opening is never heralded: a company's breach is its own.

**LONE-HERALD (FIELD BUGS 2026-10-20d, `01-Overview/bugs/Field-Bugs-2026-10-20d.md`; audited, AUDIT FB1020d): a company
of one is posted as one.** A player says they took Redoubt 20 alone and that the Spire counted it a company. The channel's
post for every tenth Redoubt was *<opener>'s company took Redoubt N*: a Redoubt's news carried no size, so one member got
the words eight do. The news now says the company's entrants (`n` - the Descent's count, "Who counts" above: every member
admitted, earning or not). It leads with an entrant's name, the opener's where the opener entered and else the first who
did, since an opener who never stepped in is not of the company that went (`net/eliteGates/egBrain.js` `heraldCompany`;
AUDIT FB1020d L1-1 for two or more). The hub's read keeps the size (`validEgHeraldTell`, 0 when a room before this relay
did not say it) and its reckoning hands it on. Three posts word a company of one alone:
- the tenth Redoubt's: *Mara took Redoubt 20 of the Battlespire (Hall 100) alone in 40:00, from Redoubt 10.*
- First of the Spire's: *Mara is the first ever to take Redoubt 10 of the Battlespire (Hall 50), alone, in 1:17:40.*,
  with no list of one name;
- a seal's: *Mara is the first through, alone.*

Two or more, and news with no size, keep *<first entrant>'s company*. The tracker counts the same company (AUDIT FB1020d
L1-3, `ui/eliteGates/egHud.js` `egHudModel`): the whole called company until the first wake, then its entrants alone,
the gather's rule (`egGatherOf`), so a called member who never came is no row and no *of N*. First of the Spire's letter
says *You were the first ever...* (L1-4). Unchanged:
- a company of one is still a company to the law (section 13.2, THE ERRAND FLOOR; section 6.1);
- the boards rank as they did - a breach begun past Hall 1 is on the Depths, never the Descent's Alone, and a companion
  who came and went still makes a company of two.

Relay `world236` (`world235` on its branch, renumbered past the Starfall's at the merge).

**EG-E2 record (2026-10-12): the feats, the Annals, the honours and the boards.** The account's half of section 19's
honours and this section's boards, in `server-account/src/egHonours.js` (claim-time logic apart from `claimEg`, one seam
an arm: its statements appended to the arm's batch, and a `w`'s new honours merged into the answer).
- **The feats.** A `w` receipt's `lk` and `ft` kept a lord at a time (`eg_feats`, the bits OR'ed), never a Rehearsal's.
  A band's lords' feats all held (`egBandMastered`) are its Master, written on the row by the claim that completes it.
- **The Annals.** An end's `an` (a bit a page, `EG_ANNALS_BITS_MAX`; `net/eliteGates/egReceipt.js` takes it on an `x` alone, so
  `world197` is rehashed) OR'ed into `players.eg_annals` - a Rehearsal's too: a page is lore, not pay. `/v1/eg/keys`
  answers `annals` and `feats`.
- **The honours** on `players.eg_honours` (`EG_HONOUR`), written at a recorded `w` and guarded by its own row: a Redoubt
  at or past 2, 5, 10, 15 and 20 holds Spirewalker, Beacon-Lighter, Kynbane (and Beaconlight), Battlemage of the Spire
  (`battlemage`) and Wellhead-Walker (and The Burning Stair); the Unfallen asks Redoubt 10 with `fl` 0 and `ew` 0; the
  Lone Beacon `lb` 1; the four Masters (`mastergallery`, `mastercairn`, `mastershade`, `masterwellhead`). Spire Champion
  (`spirechampion`) is read onto the row as the Iliac Champion is (`withEgHonours`, `withEgHonoursAll`: the token's and
  the wardrobe's doors, a letter's, a notice's, a board's names); First of the Spire (`spirefirst`, with Firstlight) is a
  list in config, `EG_FIRST_HANDLES`, empty until the first company takes Redoubt 10. The thirteen titles and three
  auras join `TITLES` and `AURAS` last, each its words and colour (`ui/playerBadge.js` `SPIRE_*`), each aura a look of its
  own kind (`render/auraRing.js`: 8 Beaconlight's beacons lit in turn and gold-white motes rising, 9 The Burning Stair's
  burning steps turning down and its embers falling, 10 Firstlight's dawn-white ring). No glyph.
- **The boards**, `/v1/eg/board` (`egBoardOf`): the ends' rows carry `n`, `ew`, `wg`, `fl`, `td`, `rh` and the season of
  the receipt's issue - and (AUDIT EG V) `wgs`, the Wager's decrees, which the Depths' row names (`ui/eliteGates/egBoardWindow.js`;
  it had said "wagered"). The Descent's brackets, its company rows (the accounts that ended one breach, the same company's
  best breach alone, the flame when none fell), the Depths and the Deepest Redoubts, each `topWithMe` (now exported from
  `arena.js`, and taking a row's test where a row is a company); the week's Proclamation in words, each Descent row its
  breach's; the caller's best. Each bracket's top ten at a season's end are kept in `eg_champions` the first time a read
  finds the last one unkept once that season is a receipt's life past its end (AUDIT EG IV; worn as the standing is until
  then) - no cron. `accountEg(...).board()` asks it.
- **The board window** (`ui/eliteGates/egBoardWindow.js`): `egBoardLines`, the enhanced panel and the classic skin's two DFU
  pickers; `openEgBoard` opens either. The host wires it.
- **Departure, said plainly:** a Descent row's Proclamation is its company's first claim's week, not the open's.
- **Pins.** `test/net/eliteGates/egeco_honours.test.js` (8) and `test/net/eliteGates/egeco_board.test.js` (5); `tools/mutants/egeco_honours.json`
  (63, every one dead); every pinned list of the titles and auras moved (PIN MOVED); `RELAY_VERSION` `world197`
  rehashed (unshipped); `ACCOUNT_VERSION` stays EG-PLAY's (`acct121` then, `acct137` since the merges), its migration
  extended (0111 then, 0117 since), unshipped.

**EG-E3 record (2026-10-12): the herald, the receipts' bound and the dungeon's find.** (Mac: *"I said I want
everything"*.)

- **The herald** is `net/eliteGates/egHerald.js`: pure builders on `gateHerald.js`'s `heraldName` and `heraldList`, every post
  `allowed_mentions: { parse: [] }`.
  - **The posts**: *Mac's company took Redoubt 10 of the Battlespire (Hall 50) in 1:51:20.* for every tenth Redoubt;
    *First of the Spire*; *the Lone Beacon*; *A new top of the Descent (the Few)*; *The way below the Galleries is open.*
  - **The news.** The director keeps its news on the breach (`B.hq`, numbered): every Valkynaz Redoubt, a Court felled
    by the one member standing of four or more (once a member a breach), and the end of a breach begun at Hall 1,
    unwagered and not a Rehearsal, as a Descent candidate. A candidate carries the deepest hall and `td`, the seconds
    from Hall 1's wake to that hall's door (`clearHall`, at the door and at a Court's fall).
  - **The tell.** The breach's room tells the hub on a new internal door, `EG_INTERNAL_HERALD`, the way the gate's kill
    is told. An ended breach beats on until the hub has its news. A hub that does not answer is told again
    `EG_HERALD_TELL_MS` (5 s) later, never on every beat, because each tell can wait `ROOM_CALL_MS`.
  - **The hub.** It folds each tell once, by breach and number (`egHeraldFold`), into its own record (`egherald`):
    - the posts owed, at most 16;
    - First of the Spire's flag, held for good;
    - the bands open when the hub first heard of the Spire, and the last band said;
    - each bracket's best this season (the arena's `arenaSeasonOf`);
    - the news already folded.

    The hub posts off its alarm, after the gate's herald, in order. A post Discord refuses goes again `HERALD_RETRY_MS`
    later, and one an hour old (`EG_HERALD_KEEP_MS`) is let go. A hub with no webhook keeps the reckoning and owes
    nothing, so a webhook added later never calls the second company first.
  - **THE SEAL** is coded as `EG_OPEN` in `net/eliteGates/egLaw.js`, the number of bands a deploy opens. EG-FULL laid all four
    bands, so `EG_OPEN` is 4, no band is sealed, and no seal post can be owed today. A deploy that seals a band and a
    later one that opens it are both needed for the post.
- **This slice's own choices**:
  - First of the Spire is posted *instead of* that breach's Redoubt 10 post, never beside it.
  - A Descent top shallower than Hall 10 (`EG_HERALD_TOP_HALL`) is recorded but not posted. Every early-season breach
    is a new top, and the channel would get one post per hall.
  - There is no `egRole` setting. Nothing in the Spire pings anyone, so a role setting would do nothing.
- **The receipts** (`net/eliteGates/egReceipt.js`):
  - `EG_END_WHYS` gains `'forsake'` and `'seal'`. The relay already minted a forsaking (`egForsake`), and the mint
    threw on it, so a forsaken member's end receipt and stake were never sent.
  - **THE BOUND IS THE MINT'S.** `mintEgReceipt` measures every receipt at its signed length. If a receipt is over
    `EG_RECEIPT_MAX` (640, the wire's `EG_RECEIPT_WIRE_MAX` too), it trims the optional lists, oldest first, in the
    order `EG_RECEIPT_TRIMS` gives: the Vestiges (`vs`), then the Reliquaries (`rl`). It never trims a claim the
    service pays by. A claim set that no trim can fit is refused, never signed long.
  - In the worst case (a 40-character account, a 32-character order, a 16-letter lord, the Wager, the feats, and since
    EG-ZA the company's `co`, the share `sh`, the six measures `m` at their bound and the Descent's `td`), a `w` keeps 7
    of its 32 Vestiges and an `x` keeps 17 of its 64 Reliquaries (measured at AUDIT EG IV; 19 and 22 before EG-ZA's
    fields). At real sizes an end is whole: twenty-four Reliquaries are kept at 506 characters. EG-ZA packed `co` as the
    entrants' count and a tag, so a company of eight 40-character accounts costs nineteen characters, not four hundred.
  - The end receipt (`q: 'x'`) now carries `wg`, the breach's Wager (as its `w` does), and `an`, the Annals pages the
    breach gave the member. `an` is the director's own per-member bitmask (`m.pages`: bit p is `net/eliteGates/egAnnals.js` page
    p, set at an alcove's page and at a lord's first fall). It is only minted when non-zero.
  - `egReceiptValid` reads every field on its own kind, as the mint makes it (EG-E2 bounded `an`, EG-ZA `co`, `td`,
    `sh` and `m`, AUDIT EG IV the rest): `fl` 0-2; `lb` 1, a Redoubt's; `vs` at most 32 `[id, rank]` pairs, a Redoubt's;
    `rl` at most 64 Redoubt numbers, an end's; `wg` at most three decrees; `lk` and `ft`, a Redoubt's. It refuses any
    other shape, and another signed kind's fields (`n0`, `k`, `o`, `d`, `x`, `r`, `y`).
- **The dungeon's find** is `POST /v1/eg/find` `{ tier }` (`server-account/src/eg.js` `findEg`). It answers
  `{ found, keys, asks }` or one of the eg routes' refusals: `guest`, `tier`, `unproven`, or `capped` (409, with the
  balance). The two new words each have a sentence in `REFUSALS` (`net/accountClient.js`).
  - **The tiers** are the port's own (`systems/dungeon/dungeonTier.js`): `super` (the player's Abyss Dungeon) 1 in 60, `elite`
    1 in 150, `regular` 1 in 400, rolled on the service's own die.
  - **The caps**: the ask is counted before the die, 6 a tier per account per real UTC day (`EG_FIND_PER_DAY`). Finds
    pay at most 2 keys an arena week (`EG_FIND_KEYS_PER_WEEK`), and the key and the find's mark are written in one
    transaction.
  - **Storage**: the table `eg_finds`, added to EG-PLAY's migration (0111 then, 0117 since; `ACCOUNT_VERSION` stays
    EG-PLAY's).
  - **The client** door is `accountEg(...).find(tier)`, and the client logic is `systems/eliteGates/egFind.js`:
    - `registerEgFind({ ask, tierNow, selfId, online, say, throwKey })` registers a death handler (`eg-find`) for the
      owner's kills;
    - it answers `{ death, struck, dispose }`;
    - the owner asks for its own kill (the striker `null`, or its own id) and leaves a joiner's kill to the joiner,
      whose record door calls `struck`;
    - each body is asked about once;
    - `egFindThrow` throws one key onto the body, as `dropFoeCard` throws a card, and restacks the pack to the balance
      minus that key.
- **THE FOUR HOSTS.** `scenes/dungeonContext.js` is the one host with a dungeon's foes online. WIRED by EG-E's host
  wiring (its record in section 31):
  - the owner's `raiseEnemyDeath` passes `by: foe._killedBy`;
  - the joiner's record door, where `r.v` names `selfId` and `reportPlayerKill(f.entity, REMOTE_KILL)` runs, asks
    `egFindStruck(f.entity)`;
  - `world.js` registers the find (`registerEgFind`) with the account's `find`, `tierNow` the current dungeon's
    `dungeonTier` online, and a `throwKey` that throws the key and saves.

  `scenes/exterior.js`, `scenes/world.js`'s streaming exterior and `scenes/worldModes.js`'s interiors stand no dungeon
  foe (`tierNow()` is null there), so nothing is owed in them.
- **Pins**: `test/net/eliteGates/egeco_herald.test.js` (9), `test/net/eliteGates/egeco_receipts.test.js` (3), `test/systems/eliteGates/egeco_find.test.js` (4), and
  `tools/mutants/egeco_relay.json` (72, every one dead). `RELAY_VERSION` `world197` is re-hashed with
  `net/eliteGates/egHerald.js` in its graph.

**HERALD-CARDS (2026-10-22).** These posts are cards now (`net/herald/heraldCard.js`; `World-Bosses.md` THE HERALD, HERALD-CARDS): the family The Battlespire, in its colour, the moment's title, its facts as fields (the tenth Redoubt and First of the Spire: Hall, Time, Began at, Company; the Descent record: Bracket, Company, Deepest hall, Time), and content only on a post that pings. When each is owed is unchanged. Its cards may go to a thread of their own of the channel (the relay setting `egThread`), the gate's else.

## 21. Integrity - what the relay judges

The gate's trust law, kept whole, and where it was not enough for one life, widened:

- **Blows on lords and the legion**: `applyHit`'s hand and purse, the bucket by the level claim times the Vestiges'
  capped factor, a melee pose within reach, from a pose on a fight floor of the current fight (section 11.7). What
  each blow landed is told to its striker alone (`eland`, `net/eliteGates/egBrain.js` egBlow - a refused blow lands 0), and
  the striker's screen shows that number, never its claim: a blow's number is the room's word, as a duel's is the
  referee's (FIELD BUGS 2026-10-20f LANDED-WORD). A lord an errand holds at a threshold answers what it lost
  (`egLordHit`), so the word, the recap and a Court's chart count that. The
  blow's kind `r` is the client's word (`HIT_KINDS`), so a Vestige that reads it must not gain from a lie. Sweeping
  Arc, Bladestorm and Counterstroke read melee, and the relay already checks a melee blow's reach. Long Sight, Hunter's
  Mark, Spotter and Deadeye read arrows and spells, and also need more than 12 m between the poses, where a forged kind
  gains nothing a real one would not (the marks and Spotter's spotting: `net/eliteGates/egRun.js` `egMarkFoe`, an arrow alone). A
  dormant Lurker wakes at any blow that lands on it (`net/eliteGates/egLegion.js` `egLurkerWake`), reading neither. The lean and an
  offer's cards that act (section 15) read it too, and change no damage.
- **The lords' blows on members**: ONE judge for every shape. `src/net/bossRef.js` holds a judge for each boss
  (`judgeGate`, `judgeRemnant`, `judgeSerpent`).
  - Every Spire blow travels with a FULL shape stamp, its kind and every number, which is new. The Remnant's
    `shapeStamp` carries only what its marks changed.
  - So one `judgeShapes` tests any blow, per fight floor (section 11.7), against the pose trails the relay holds
    (`posAt`/`posAfter`, `deepIn`, `BODY_AFTER_MS`) and feeds `src/net/bossBody.js` (`bodyStruck`, `bodyCensus`).
  - It also judges the hall's own hazards at their landing on a fight floor, and a cast-back (a trail below
    `SD_VOID_Y`), into the census. A modified client that ignores vents and magma is seen.
- **Time, the law enforcement stands on** (EG-H1, built; AUDIT EG IV, lane1 #30, said as built). A client draws and
  resolves a landing on a clock that runs late by the welcome's one-way latency, so a trail timed by arrival would let
  both poses the judge reads predate the client's landing, and count a dodge in its last round trip as a hit. So the
  relay's trails are timed by when each pose was SENT (`net/eliteGates/egFair.js`):
  - each trail entry is `[t, x, y, z, h]`, `t` the pose's shared time - its own `ts` plus the socket's offset, less the
    one-way delay its corrected clock said (section 10.8, the `clk` word);
  - the judge's pose after a blow is the first SENT after its `at`, waited for up to `EG_POSE_WAIT_MS` (800 ms); a body
    with no pose within `EG_POSE_NEAR_MS` (±300 ms) of `at` is not counted;
  - A SILENT SOCKET'S BODY IS HELD (AUDIT EG V): a client says a pose when it moves, and every `HEARTBEAT_MS` standing
    still (`src/net/online.js` sendPose), so a member standing still had no pose near any landing and took nothing.
    Every living member's trail is held at its newest pose (`server/src/index.js` `_egTrails`): a closed socket's to
    now, an open one's to now less `EG_TS_LAG_MAX_MS` - a pose is placed at most that before it arrives, so the trail up
    to there is whole, the stand-ins never stand over a pose on its way, and a dodge in a landing's last round trip is
    still never counted. The drains read a held body, and a lingering field (a charge's run, a burning bridge) reads
    each trail to that edge (`net/bossRef.js` judgeShapes), never past a pose still on its way;
  - pinned (`test/net/eliteGates/egint_relay.test.js`): a dodge at the client's `at` less 50 ms, at a 300 ms round trip, is never
    counted.
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
    no door, and records `m.blind`. A gap from held ground to held ground within `EG_FAIR_SNAP_M` (2.5 m) is a member
    STANDING STILL and is never blind (`egStillGap` - FIELD BUGS 2026-10-20f FAIR-STILL): a client says no pose while
    nothing about it changes, and a crossing waited out at its timed pieces read as unseen, so its door never opened;
  - **the crossing**: its time against `EG_CROSS_MIN(spec, road)` (section 10.5) rides the receipt's `m`, and gates
    nothing until EG21;
  - **after a restart**: the accumulator is saved to storage. After the room is re-woken, a member at the end plate
    whose last saved accumulator was fair counts as a fair arrival; failing that, the door opens on the first arrival,
    recorded as `m.wake`. A hall woken after every member passed the last island never deadlocks;
  - **repeats**: a member whose trail breaks the law again within a hall has their hits refused for 5 s;
  - poses between a member's `down` and their next `here` are never judged; a pose sent mid-stair belongs to no hall;
  - an unfair trail opens no door, and its measures ride the receipt (`m`). A member at the door on a trail it refuses
    is told why, once a hall, to it alone (`efair`: the break's reason - `speed`, `air`, `void` - else `blind`;
    `net/eliteGates/egBrain.js` doorWord - FIELD BUGS 2026-10-20f DOOR-WORD). It had been refused in silence.
- **Every pose-gated credit needs a fair trail** from the last island: the door, `down`, a cache, THE GOLD RUN, a
  niche, a Memento carried, the Reliquary Vault, the High Road's cache.
- **A hall cleared**: only the relay says so (the legion broken, the lock solved, the champion or the lord fallen, a
  fair end).
- **The board and the Redoubts**: from receipts alone. The service never takes a client's word for a depth.
- **The key**: the service's balance and stake (sections 5 and 23).
- **A healer's part** (section 16.1): a heal word is the receiver's, so a healer is credited the hall's part only where
  the room relayed a cast from the healer's own socket to that receiver within `EG_HEAL_CAST_MS` (5 s) of the word (the
  room's memory of the casts it carried, `server/src/index.js` `_egCastSaw`). An idle account never casts, so no word
  of a companion's can make it an earner (AUDIT EG IV). The count's mend and Lifeline read only the heals a relayed cast
  backs (AUDIT EG V: a word naming a companion who cast nothing mended a modified client's count a third of a body a
  second, and refused damage stood); the recap's healing reads the word as before.
- **The census**: the relay's census applies Bastion, Challenger's Oath, Steadfast Line, Immovable and Lifeline itself,
  counts a Stoneskin holder's whole body (the cushion with it, so the holder falls where its screen falls), and the rest
  restores it, so holders do not drain their budgets or skew the measures staff read.

A modified client can still refuse to take damage (a player owns their body). Under `BOSS_BODY` enforcement, the
relay's census fells it as it fells a gate's fighter. The Spire's boards are measured with enforcement on: it is on in
`eg:` rooms (`EG_BODY_ENFORCE`, `net/eliteGates/egBrain.js`), whatever the gate's setting, on the time law above.

## 22. Failure and recovery

A breach is a three-hour instance on infrastructure that restarts. Every failure has a rule (AUDIT EG0 A5, A10, A17;
AUDIT EG II L4-31, L4-42).

**A deploy.** `.github/workflows/relay-deploy.yml` drops every socket and restarts every Durable Object. The client
deploys on every merge. A drain of up to three hours (the last word) for every relay deploy would close the Spire for much of each day,
so:

- **THE HOLD** (the usual deploy): the deploy waits until every live breach is between trials (a closing, a swap or a
  rest), then goes; each room holds itself as it wakes between trials - no deploy asks it (EG-H2's departure 2: an
  unauthenticated ask would let anyone freeze a breach). A held room freezes the count and gives the gap back, and waits until
  every living member has returned or 180 s have passed. A member who returns finds the hall where they left it. The gap
  goes back to what the hold found as it began (its deadlines however far into the hold they fell); a word its company
  stamped while it held is relay time already, and stays (AUDIT EG III). The finding is kept in the record with the hold
  (`B.hold.f` - every instant stamped before the room slept is at or before its last beat, and past it the hold keeps
  the values it found), so a room woken again inside its hold gives back what the first wake found (AUDIT EG V).
- **THE DRAIN** (an `EG_SPEC` change beyond `EG_LAWS` only): the deploy waits on `/v1/eg/live`, as it waits on
  `/v1/seats/sieges/live`. Opens are refused meanwhile (*The Spire's road is shut. Try again soon.*), and the deploy
  waits until no breach is live, or the last word of the longest has passed.
- **A `force` deploy** voids every live breach. Their stakes are returned, and their Redoubts taken stay taken.
- **A LAW PIN PER BREACH**: the breach records `egv`, the spec law it was opened under.
  - Both sides keep `EG_LAWS`, every `EG_SPEC` younger than seven days (pinned), for `egHallOf` (the fragments laid
    with it) and `courseOf`. A client deployed ahead of the relay, or behind it, still draws the breach's own halls: its
    circle's look (THE EDGE LINE, the streamers, the mist - `scenes/eliteGates/egLookDraw.js`) and its fight's hall
    (`scenes/eliteGates/egFight.js`) are made again once the room has given them, as its level is (AUDIT EG V: both were kept from
    the client's own law's draw).
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
  frame or receipt carries `rs`. The page does read its own receipt's seed, so what a receipt pays is rolled on that
  seed mixed with the account service's own draw at its claim (section 19, AUDIT EG V).
- **Storage, not memory**: offers, picks, spent order ids, the fallen, the witnesses, the Mementos, the Reliquaries,
  the caches taken, the Cantrips, the lumen, the fair-trail accumulators, the Athenaeum's hall and each member's newest
  pose (`lp` - a room woken mid-trial holds a gone member's body from it, AUDIT EG V) all live in storage (hibernation
  keeps nothing else).
- **Time survives the restart**: a member's absence is counted from `max(lastSeen, wakeAt)`, and any tick gap over
  `EG_GAP_MS` (2 s) is given back: the count and the hall's timers do not run across it. In a room that never slept, an
  instant stamped inside the gap (a word heard while the alarm was late) is the gap's own and stays.

**A dropped socket.** A closed socket would drop its body from the census, and returning at the arrival plate would
dodge a lord's blow. So the body stays at its last pose for the absence window and takes what lands there, though no
blow is aimed at it (section 6.1): the room keeps each member's trail by its account, and a member with no socket in the
room has its trail held at its last pose for `EG_ABSENT_TRIAL_MS` (AUDIT EG III), as is one whose socket stays open and
says nothing (AUDIT EG V, section 21). On a fight floor it resumes there. In
traversal it resumes at its last island or plate, with no cast-back's cost: a platform has moved on, and a reconnect is
not a fall.

**A reload.** Saves are refused inside (the Burning Court's law, WBX W6), so a reloaded page boots outside.
`/v1/eg/keys` answers the account's live breach, and the world host offers *Return to the Spire*: a hello as an entrant
(no new order), resumed by the dropped socket's rule; between trials, at the current hall's arrival plate.

**A joiner's fight.** The hello of a member who joins or reloads mid-fight hands it the breach (`st`) and the fight whole
(`efs`): every body where the room holds it at that instant and on its feet, each object's state and each lord's phase and
fall as the room said them, the zones still to burn. Its screen holds the company's fight at once, and the fight said again
every two seconds never stands a body anew. Built by EG-ZJ (its record, below).

**A key's loss.** A key is never lost to an infrastructure fault:

- the hub retries `EG_INTERNAL_OPEN` idempotently on `ez`, and members may ask for the call again;
- an end with no hall ever woken is a void, never the opener's `'empty'`, unless the room had its call out and nobody
  answered;
- a client that boots with a stake the room never accepted asks the room to void it (`{k:'void', z}`);
- an open whose answer was lost (the client's wait ended, a dropped connection, a reload mid-ask) is no lost key: the
  client keeps the open's request id on the device before it asks, and asks again by it (`again`) until the service
  answers: the stake it took comes back as an order its void can name (signed as of the stake's own issue, so it opens
  nothing), and the void gives the key back; or none was taken, and nothing is lost (AUDIT EG IV);
- an opener who never steps in is owed their end (`'empty'`, nothing cleared) at the first wake, which closes the door
  to them: their stake settles and their `eg_live` clears then, never three hours on (AUDIT EG IV).

**Unknown rooms.** An `eg:<16hex>` the hub never opened writes nothing and arms no alarm, except a void (section 23),
which writes its one tombstone.

**The cost.** One Durable Object per breach, awake for up to three hours. So:

- the tick is 250 ms only while a trial runs, 1 s otherwise, and none while the arch rises;
- the hub enforces `EG_LIVE_MAX` (64) live breaches at once, the Rehearsals among them. At the cap it asks each listed
  room where it stands and lets the ended go first, so an ended breach no longer holds its slot until its last word; and
  it keeps its answer to `/v1/eg/live` `EG_LIVE_SAID_MS` (2 s), so the public door asks the rooms at most once in that
  time, every ask meanwhile answered by it (AUDIT EG III); the Worker asks the hub that door one ask at a time an
  isolate, the requests that come meanwhile answered by that one asking - nothing kept past its answer, so the hub's
  word stands as it says it (AUDIT EG IV);
- every breach ends at the last word.

## 23. The wire

**The room family.** `eg:<16hex>`, the breach id the service mints with the open order.

- **The room-key law**: `isEgRoom` (`/^eg:[0-9a-f]{16}$/`) in `net/eliteGates/egLaw.js`.
- **The Worker's prefix gate**: a `startsWith('eg:')` line beside `gate:` and `sd:`, so a key not of the law's shape is
  refused (404). A well-formed key the hub never opened stands a room that admits nobody and writes nothing but a void's
  tombstone (section 22).
- **The tick**: `_egTick`, in the `alarm()` chain before `_alarmRest`.
- **Presence**: the room is each entrant's presence room for the whole breach (`roomIdentity` `{kind:'eg', b}`).

**Opening runs through the hub** (AUDIT EG0 A4). The hub holds every client's socket and every party's roster.

1. The client sends `{t:'eg', k:'open', z, site}` to the hub.
2. The hub verifies the order, freezes the company from its own `party:` record, and checks `EG_LIVE_MAX` and the
   drain.
3. It forwards the order, the company and the arch's site to `eg:<b>` by internal fetch (`EG_INTERNAL_OPEN`), the
   DO-to-DO pattern `_wdunKinOf` uses, retried idempotently on `ez` until the room answers. The room answers with the
   company and the site it froze, and the call is theirs: an open retried after someone joined the party calls the
   breach's first company, never the party as the retry finds it (AUDIT EG IV).
4. It keeps the breach on its live list (`eglive`: the breach's law and last word - the drain's and the cap's) and the
   call for each member's hellos (`egcall:<sub>`, swept once its open window has ended - AUDIT EG IV), and tells the
   company the call (`k:'call'`, signed) on the party channel.
5. Receipts for a member with no socket in the room are held by the hub as `egrc:<sub>` for their next hello, under
   the gate's receipt law (the `gaterc` sweep, widened by one prefix). The hub is their holder of record: the room's own
   hello hands only those it still owes the hub, and a client remembers each receipt the service counted
   (`eg.counted`, for the receipt's life) and never claims it again - it says `claimed` again instead (AUDIT EG IV).

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

- **Open** (`/v1/eg/open`) is idempotent on the client's request id `rq`. The client keeps `rq` on the device before it
  asks, and a client whose answer was lost asks again by it with `again` (AUDIT EG IV): the service answers the stake
  that request took, its order signed as of the stake's own issue (it opens nothing, and names the stake for its void),
  or `none`, and never takes a key for it. Asked again without `again` it answers the same order, signed as of the
  stake's own issue too (AUDIT EG V: re-signed fresh until the stake's `until`, a request id asked again hours on
  opened its breach past `eg_live`'s end). One conditional `UPDATE ... RETURNING` (the insignia-spend pattern) takes one key, writes the stake
  `eg_stakes(ez, account, b, until, state)` and sets `eg_live`.
- **SPENT**: on the first `w` naming its `ez`, or the opener's own `x` whose `why` is not `'void'`; except an account's
  first opened breach that ends with no Redoubt taken (the first breach's mercy, section 5), whose stake is RETURNED, once
  ever, by the first end receipt that says the breach is over with no Redoubt (`nr`), whoever's it is. The opener's own
  end before that word holds the stake while the mercy may still be paid (AUDIT EG III).
- **RETURNED**: on a relay-signed **void** (`e1`, kind `'v'`), or an `x` with `why:'void'`, even after `w` receipts
  (a force deploy, an unknown `egv`: the company keeps its Redoubts and the opener gets the key back). `eg:<b>` mints a
  void for an order it never accepted. It writes the order spent first, as `_holdemVoid` does, so it can never accept
  it after.
- **The clock** spends a stake still held `EG_STAKE_CLOCK_S` (14 days) past its `until`, on the service's hourly clock
  (`server-account/src/eg.js` spendLapsedStakes): a void may be minted up to `EG_VOID_MAX_S` (7 days) past its order's
  issue and is carried seven days more, so the clock waits both out (EG-ZM). Its letter says why: no word came back; or,
  where the opener's own end held the stake for the first breach's mercy, no word came that the breach ended with no
  Redoubt taken (`EG_STAKE_POST_HELD`, AUDIT EG IV).
- **The opening** is the moment the room accepts the open order, when the arch begins to rise. The service never sees
  it, so a stake's `until`, and `eg_live`'s, is set when the service signs the order: `EG_LIVE_S` (`server-account/src/eg.js`),
  the last word (3 h), the open window before it (10 min) and `EG_LIVE_SLACK_S` (10 min) - about 3 h 20 min, room for an
  order's minute on its way to the room, so no breach outlives it. An admission's `eg_live` ends at its stake's `until`
  (AUDIT EG III: it had been the admission's own ask plus 3 h 20 min).
- **The tombstone**: after the end the room keeps `egdone` for `EG_VOID_MAX_S` (7 days) and refuses older voids (the
  `HOLDEM_STAKE_VOID_S` precedent).

**`eg_live`** (AUDIT EG0 A2) is `{b, until}`, `until` being the stake's. `/v1/eg/open` and `/v1/eg/admit` each write
it in one conditional `UPDATE` (`WHERE eg_live IS NULL OR b = ? OR until < now`). An end receipt or a void clears it,
and a lapsed one counts as clear. No lost receipt can lock an account out. An admission is asked within
`EG_ADMIT_WINDOW_S` (20 min) of its breach's open; a member who takes an order then and never steps in holds that breach
as its live one until its stake's `until` - the service cannot see the room, and the room owes no receipt to a member it
never admitted (a departure, AUDIT EG III). The opener is no such member: an opener the first wake finds outside is owed
their end then (`'empty'`), which clears theirs (AUDIT EG IV).

**The arch on the cell.** The opener's client says its arch on its world cell as `ea` on its foes frame (`{b, o, os, op,
ew, site, sg}` - the call's arch fields and the hub's signature over them, `scenes/eliteGates/egArch.js` `validEgArchWord`; EG-F's
departure 3) while it stands within `EG_ARCH_SAY_M` of it, as `portalWire` rides a peer's frame. Peers check `sg` and
stand only a verified arch near its opener's feet, at most two a cell, until the open window ends - drawn, never a
stone (section 6.3, AUDIT EG V). The relay reads none of it, and admission never depends on seeing it.

**Poses.** A pose on a moving piece carries `pl` and its offset (RIDDEN POSES, section 10.8); the field joins
`validPose`, a relay version (EG8).

**The fight's bodies.** A body's row is `[i, role, k, pt, x, z, hp, max, fl, tx, tz, v, at, y, ty, st, sa, sz, yw]`: its feet and
its walk's end's height in whole centimetres (the law's, section 9), and its state as the room last said it with since when.
A walk (`emv`) is `[i, x, z, tx, tz, v, at, y, ty, yw]`. Its facing (`yw`, radians in hundredths, within 7 either way) rides
both, and a turn is said as a walk of its own (`net/eliteGates/egBodies.js` egFace): the relay judges the Kynreeve's Shield-Wall and a
Shielded elite's back by it, and every screen draws it (AUDIT EG V). A blow may carry its dim outline's lead (`ol`, ms, at most
30 s): a chained shape's outline stands from the first shape's word, its fill from the first's landing (AUDIT EG V). The whole fight (`efs`) carries the zones still to burn (`zs`). Every
height rides a word the fight already says, so the frames stay as many as they were. EG-ZJ. A lord's size rides its row too
(`sz`, thousandths of its look's: Colossal's 1250, at rank II 1400; 0 its look's own; bounded 500-2000 on the wire). EG-ZQ.

**Frames** (`{t:'eg', k, ...}`; `EG_KINDS` and `EG_OUT_KINDS` in `src/net/wire.js`, each with its validator):

| frame | way | what |
|---|---|---|
| `{k:'open', z, site}` | opener -> hub | the open order (its Wager and Rehearsal inside) and the arch's site |
| `{k:'void', z}` | opener -> hub | an open no call answered, asked to be voided: the hub asks the room by an internal door (EG-ZA) |
| `{k:'claimed', b, q, w}` | member -> hub | a receipt the service counted: the hub lets its held copy go (EG-ZA) |
| `{k:'call', b, o, os, seed, op, rh, co, site, ew, wg, sg}` | hub -> the company | the call (section 6.4), signed; its rise and open are the clock's off `op` |
| `{k:'in', z, lv}` | member -> room | the admit order and the level claim (frozen at the first admission) |
| `{k:'down', h}` | member -> room | stepped through hall `h`'s door. Arriving says no word: the room reads `here` off the pose on the arrival plate (section 7) |
| `{k:'home'}` | member -> room | the way home, confirmed |
| `{k:'hit', i, q, d, r}` | member -> room | a blow on body `i` - a lord, an add or an object - its number in my sequence, its damage and its kind |
| `{k:'fell'}` / `{k:'vt', v}` / `{k:'heal', h}` | member -> room | my own fall; my body's share (thousandths); my companions' heals in me, by peer |
| `{k:'clk', c, h}` | member -> room | a ping of the shared clock, with the one-way delay my clock measured (section 10.8) |
| `{k:'spec', h}` | member -> room | a hall asked of the breach's own law (section 22) |
| `{k:'pz', i, a}` / `{k:'use', i}` | member -> room | an Athenaeum turn (the Orrery's bounds) / an engine worked (section 11.10) |
| `{k:'cant', i}` / `{k:'buy', i}` | member -> room | a Cantrip used (section 17.2) / a purchase from the Sutler (section 17.3) |
| `{k:'pick', v}` / `{k:'surplus', use}` | member -> room | a card taken / a Surplus spent (a fourth card, or a reroll) |
| `{k:'vote', q, y}` | member -> room | the company's word: decrees, a Bargain, a respite, Ready |
| `{k:'lping', x, z, w}` | member -> room | a living member's ping, every 3 s (*here*, *danger*, *mine*; section 16.4) |
| `{k:'ping', x, z, w}` / `{k:'bequest', v}` / `{k:'forsake'}` | witness -> room | the witness's acts |
| `{k:'tonic'}` | member -> room | a Spire Tonic drunk (section 17.1): one of the run's spent, and `{k:'eheal', p: 0.25, why: 'tonic'}` to that member alone - its health through the census, its magicka on its screen (AUDIT EG III) |
| `{k:'mast'}` | member -> room | a Mastery used (Spirebridge, section 15) - no fields: the room reads the asker's own pose |
| `{k:'wkpaid', w}` | member -> room | the service answered my Redoubt `w`'s receipt paid already this week: that circle's Reliquaries 20 lumen each (section 16.3; AUDIT EG III) |
| `{k:'st', ...}` | room -> all | the breach: seed, `dg` (the digest of the hall's spec, section 9), `egv`, hall, kind, variant, slot, twist, stage, the count's end, the respite left, the company (each `m1..`: numeral, alive, witness, home, forsaken, road), each member's Reliquaries (each one's circle with them, AUDIT EG III), Cantrips and lumen, the Mementos lying, the decrees, the Proclamation, the Wager, the arch's site; in a rest the next circle's decrees as the company chose them (`nx`, AUDIT EG V) |
| `{k:'sg', ...}` / `{k:'co', co}` | room -> all | the stage word (the hall, its stage from when to when, the count, the hall's wake, the door's instant) / the company |
| `{k:'fall', s, n, at, fin}` | room -> all | a member fallen (`fin`: final) |
| `{k:'rd', w, h, at, cl, g, v, cov, dm}` | room -> all | the Redoubt taken: the count after it and its gain, a Valkynaz's, under the Covenant, the Court's chart (EG-ZF) |
| `{k:'rcpt', r}` | room -> one | that member's `e1` |
| `{k:'bd'}` / `{k:'clk', c, now}` / `{k:'spec', egv, h, sp}` | room -> one | the count's fall of me / the clock's answer / a hall in the breach's own law's bytes |
| `{k:'no', m}` | room -> one | a refusal, in words |
| `efs`, `ead`, `emv`, `ehp`, `edie`, `efl` | room -> all | the fight's bodies: the whole fight (a joiner's too, section 22), a wave risen, the walks, the healths, the gone, a body's flags |
| `eb` / `ecut` | room -> all | a blow - its body, its attack, its full shape, when it lands (section 13.2) / a feint cut at `FEINT_AT` |
| `tell` / `untell` | room -> a Watchfire holder's company | the blow told early (section 15) / a told blow the union floor dropped |
| `etx`, `emk`, `eph`, `efell`, `eob`, `ez` | room -> all | the tethers, the marks, a lord's phase and its fall, an object's state, a zone |
| `esay`, `egust`, `edark`, `erail` | room -> all | a beat said (`EG_SAY_KEYS`), a gust, the Gutterdark, the Rails |
| `{k:'ebridge', h, g, at, until, s, n}` | room -> all | a Spirebridge raised (section 15): its hall, its gap's number in the hall's chain (`egSpanPairs`), when it stands and until when (at most 10 s on the wire), who raised it |
| `offer` | room -> one | the Vestiges, Masteries and shards offered |
| `ask`, `asked`, `tally` | room -> all | the company's word: asked, answered, counted |
| `egot`, `run`, `rise`, `eping`, `pz`, `eheal` | room -> all (a gift to one) | a gift (a shard, a tonic, a Cantrip, lumen, a Reliquary, a page, Long Step's word), a member's run, a recall's rise, a ping, the Orrery, the room's heals |
| `{k:'toll', q, h}` | room -> one | the pull's toll (section 10.6) |
| `{k:'eland', i, d}` | room -> one | what my blow on body `i` landed, whole points - the striker's number (section 21; FIELD BUGS 2026-10-20f LANDED-WORD; world237, `EG_LAND_RELAY_MIN`) |
| `{k:'efair', w}` | room -> one | why the door will not take me: `speed`, `air`, `void` or `blind` (section 21; FIELD BUGS 2026-10-20f DOOR-WORD) |
| `{k:'end', why, at, ds, dm}` | room -> all | why: `'tear'` (the count spent), `'gone'` (every member out: fallen twice, forsaken or home), `'wipe'` (no living member), `'home'` (THE COVENANT'S PATIENCE), `'seal'` (THE SEAL), `'rehearsal'` (a Rehearsal's end), `'last'` (the last word) or `'void'` (a force deploy, an unknown `egv`, no hall ever woken); each member's part (`ds`) and a lord's fall's chart (`dm`) |

The hub's own three (`open`, `void`, `claimed`) spend a bucket of their own at the social acts' rate (`egHubGate`:
`SOCIAL_HZ_MAX`, eight deep), at the hub and at home - never the breach room's blow bucket (`EG_HZ_MAX`), where one
socket drove sixteen storage writes, verifies or calls on other objects a second at the object every client holds; and
a void asked again is answered from the hub's held copy without asking the room (AUDIT EG IV).

**The receipt** `e1` (`net/eliteGates/egReceipt.js`: `mintEgReceipt`/`verifyEgReceipt`, signed by `GATE_SIGNING_KEY` as every
relay receipt is):

| kind | claims |
|---|---|
| `k:'w'`, a Redoubt taken | `b`, `w` (the Redoubt), `h` (the hall), `s` (the sub), `c` (this receipt's seed), `sh` (the share dealt), `t` (seconds since the first hall woke), `n` (earning entrants), `ew` (the start Redoubt), `l` (the level the breach froze), `vs` (the Vestiges), `m` (the measures), `z` (the order id), `co` (the company: its entrants' count and tag), `fl` (the falls in the breach), `lb` (a Court felled alone), `lk` and `ft` (the lord and its feat bits), `wg` (the Wager) |
| `k:'x'`, the member's end | `b`, `h` (the deepest hall cleared), `s`, `t`, `n` (entrants), `ew`, `l`, `co`, `rl` (Reliquaries opened, with `why` `'home'`, `'seal'`, `'last'` or `'void'`), `fl` (the falls in the breach), `an` (the Annals' pages the breach gave), `td` (seconds from Hall 1's wake to `h`'s door), `wg` (the Wager), `rh` (a Rehearsal's), `c`, `why` (`'fall'` (a final fall), `'home'`, `'tear'`, `'wipe'`, `'gone'` (every member out), `'last'`, `'seal'`, `'rehearsal'` (a Rehearsal's end), `'forsake'`, `'empty'` (the opener's, never admitted: the call went out and nobody was admitted before the open window ended, or the first hall woke without them - AUDIT EG IV) or `'void'`), `z`, `nr` (1 when the breach is over with no Redoubt taken - an end its end owes, or the last living member's; AUDIT EG III). A first fall, which a recall can undo, mints no `x` |
| `k:'v'`, a void | `b`, `z`, `s` (the opener) |

**The account service** (EG2, EG8, EG14):

| route | does |
|---|---|
| `/v1/eg/keys` | the balance and the live breach, for restacking and *Return to the Spire* |
| `/v1/eg/find` | a dungeon's find: the tier, the roll, the caps |
| `/v1/eg/starts` | the start window's preflight: which starts each member of the opener's party may make |
| `/v1/eg/open` | idempotent on `rq`: stakes one, signs `egopen`, sets `eg_live`; `again` asks only for the stake `rq` took (a lost answer's - its order as of the stake's own issue, for its void), `none` where it took none (AUDIT EG IV) |
| `/v1/eg/admit` | checks the handle, the breach's stake (none: `breach`; settled, or its open window past: `spent`), the start Redoubt and `eg_live`; signs `egadmit`; sets `eg_live` to the stake's `until` |
| `/v1/eg/claim` | `claimEg`: verifies `e1`, refuses another's, answers guests `guest`. For `w`: one row in `eg_redoubts (b, account, w)` with its embers, the week's pay, Marks, the deed, the depth, the honours, the pity, the Valkynaz's key roll. For `x`: `eg_runs (b, account)`, the board's row, the Reliquaries (a circle's once an account an arena week, `eg_reliqs`), settles the stake (the mercy on the breach's own end, `nr`), clears `eg_live`. Each `w` and `x` answers the seed its spoils roll on (`seed` - AUDIT EG V). For `v`, and an `x` whose `why` is `'void'`: returns the stake, held or spent |
| `/v1/eg/board` | `egBoardOf` |
| `/v1/eg/sink` | the Broker's Panoply piece, once an account a week (section 19) |
| `/v1/eg/first` | the first-time lines shown, kept once an account (section 27.7) |

`/v1/eg/live` (the drain's question: any breach live, and until when) is the relay's, the hub's public door (section
22),
not the service's.

**Migration 0117** (EG-PLAY's, unshipped; 0111, 0112, 0113, 0114 then 0116 on its branch, renumbered past NAME-AS's 0111, SEAT-FACTS' 0112, LAMP-KEEPER II's 0113, FIRMAMENT-ON's 0114, KG6's 0115 and POI-1's 0116 at the merges) holds every
table and column of the arc: the keys (`players.eg_keys`, `eg_key_miss`), `eg_live` (`players.eg_live_b`,
`eg_live_until`), the Rehearsal's day, the mercy, `eg_stakes`, `eg_redoubts`, `eg_runs`, the feats, the champions, the
honours, the Annals, the week's pay, the pity, the sink, `eg_finds` and the first-time lines; and (AUDIT EG V) an end's
own draw and its Wager's decrees (`eg_runs.nonce`, `wgs`) and the Reliquaries a week opened (`eg_reliqs`).

**Versions.** Each slice that moves the relay bundle bumps `RELAY_VERSION` (`src/net/wire.js`) with its `LAW` row, and a
game that does not know it is told to reload. Each that moves the service bumps `ACCOUNT_VERSION`
(`server-account/src/service.js`). The arc ships under one of each, EG-PLAY's, re-hashed in place by every later slice
while unshipped: `world213` (`world195` on its branch, then `world206`, `world211` and `world212`, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT
ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges) and `acct149` (`acct116` to `acct122` on its branch, `acct124`, `acct126`, `acct127`, `acct133`, `acct134`, `acct135`, `acct136`, `acct137`, `acct141`, `acct146` and `acct148` after
earlier merges, renumbered past main's slices to MAKER-KEPT's `acct148` at the merges), its migration `0124_elite_breach.sql` (0119 until main's SERPENT5 took it, 0120 until main's AUTO-HOLD took that, 0121 until FIELD BUGS 2026-10-16b took 0121 and 0122, 0123 until MAKER-KEPT took that). The new titles and auras join `TITLES` and `AURAS` in `src/net/identityToken.js`.
A client sends an `eg` frame only to a relay at or past the arc's own (`EG_RELAY_MIN` 213, `src/net/wire.js` - AUDIT EG
V: it read 197, its branch's first, and main's world197 to world212 carry no breach).
Shipped, the arc's later slices each move the relay on as any slice does: EG-PERFECT's `world219` (section 31's EG-PERFECT
record, "The relay").

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
| Mark (Recall's mark) | refused | refused | refused |
| Recall | as today | refused | refused |
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
Spire's pseudo-archives, registered in `world/eliteGates/pseudoArchives.js` (EG1, section 11.6). The page first reserved
38231-38279, but the harbour's art took 38231 (`world/portArt.js` `PORT_ARCHIVE`) before the Spire was built, so the
arch's block moved past the bands (`EG_BAND_ARCHIVES`, `EG_ARCH_ARCHIVES`):

- 38241-38249: the Galleries;
- 38251-38259: the Cairn;
- 38261-38269: the Shade;
- 38271-38279: the Wellhead;
- 38281-38289: the arch, the key and the beacon (`EG_ARCH_BLOCK`: 38281, 38282, 38283). The arch's skin itself wears the
  gate's archive (`GATE_ARCHIVE` records 5-7, the gate's records' twins - EG-F), not this block.

**The bands' ramps** (sRGB, at least five steps each, as SD-LOOK's are):

- the Galleries: marble `[150,146,138]`-`[214,210,200]`, gold leaf `[140,98,40]`-`[246,206,120]` (the Hour's brass,
  reused), Battlemage blue `[36,52,96]`-`[92,124,196]`, the Deadlands' red sky;
- the Cairn: slate violet `[44,37,56]`-`[134,121,158]`, soul-light `[120,200,230]`;
- the Shade: `[18,18,28]`-`[86,90,112]`, moon-silver `[160,166,176]`-`[214,220,228]`;
- the Wellhead: basalt `[26,22,20]`-`[94,85,76]` (SD-LOOK's a step lighter and warmer) and iron, molten `[255,120,30]`.

EG-LOOK (2026-10-16, `Elite-Gates-Look.md`): the three dark bands' stone was lifted a step (the Cairn's from
`[34,28,44]`-`[120,108,140]`, the Shade's from `[6,6,10]`-`[60,64,80]`, the Wellhead's from SD-LOOK's basalt): under
each realm's own light the old ramps read as the void itself, so the halls' architecture vanished; they stay the
darkest stone of their kind.

### 25.2 Five lights, five meanings, and no others

| light | means | where | never |
|---|---|---|---|
| **gold** | the way, safety, and "it holds" | arrival and end plates, doors, the Redoubt's beacon, islands and waystones, havens, the way home, THE EDGE LINE, a moonlit branch's rim | an enemy's ward |
| **Dagon red** | his blows, his wards, his marks | every telegraph line (THE SPIRE DANGER EDGE, below), wards and their tethers, lords' marks on members | magma |
| **Battlemage blue** | yours | a pip, a ring or a pillar over heads and at feet: Vestige auras, numerals, a witness's ping, the Watchfire holder's pip | anything on the floor that hurts |
| **white** | the place's own timed hazard | vents ringing, Pendulums' lanes, a Beat's last 0.4 s, a fragment's hazards (told and landing, their element in their grain - AUDIT EG V): hatched, and throbbing at most 3 Hz | a haven |
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
  guard, and the cage on the lord's bar is red-bronze and hatched, *Warded* after its name (`ui/eliteGates/egSpireHud.js`,
  FIELD BUGS 2026-10-18d WARD-BAR - before it no Spire bar said a ward at all);
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
mist, it is the only read. Its pixels are the world image's (`renderer._worldViewportPx` - Retro Picture Mode's 320x200
or 640x400 - handed through `scenes/eliteGates/egLookDraw.js` `drawOver`, AUDIT EG V), as the spans' ghosts drawn in the same pass
are; the canvas's when no world image is set.

### 25.4 The telegraph pass, THE TELEGRAPH BUDGET, THE QUIET COMPANY

**The pass** (`src/render/gate/gateTelegraph.js`) draws one shape a call. The Burning Court already draws several a frame:
its pools, his mark, his blow, and up to `HOST_SHAPES_MAX` (8) host shapes (`src/scenes/gate/gateHost.js`), cut in array
order. A Ward-Bearer's tether is drawn today as a lane in the path pool (`TELEGRAPH_KIND.lane`, `HOST_PATH_HALF_W`
0.35, `TELEGRAPH_POOL.path`). The Spire adds three kinds to `TELEGRAPH_KIND`, each a seam whose default draws the
gate's own:

- **haven**: a gold disc with a dark keyline and inward chevrons, safe while everything else fills red;
- **lanes**: parallel lanes, a Lattice;
- **tether**: a line between two bodies, in two grammars (section 25.5).

The callers' caps rise to 24 shapes, and at most 32 shape-floor draws a frame (section 11.7).

**The thin shapes' ground** (AUDIT EG V; FIELD BUGS 2026-10-13e AOE-PERF's law, "a path's or a tether's quad is its own
strip"): a pull-apart tether and a stay-close chain are strips (`telegraphStrip` - the chain its links' half-width, the
pull-apart twice its half-width and `TELEGRAPH_TICK_REACH`, its break tick's reach), each fight floor under them cut to
the strip (`world/eliteGates/egTelegraph.js` `egClipTris`); a Vestige aura's ring draws nothing past `TELEGRAPH_RING_REACH` (0.5 m)
from its ring - its two pixels whole within ~18 m at a grazing look on a 1080p screen - and its own quad is that square.
Hall 10's Blood Tether shaded 360 m2 of fight floor for its ~10 m2 strip and shades 12; the chain 310 for 9; an aura's
ring 85 for 5. `TELEGRAPH_POINTS_MAX`
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
  system's setting, governs the stair (section 7) and the shakes, and the HUD's motion - the gate's title cards in the
  Spire with it (a lord's wake, its fall, THE FALL's card: no name flying in, no rule sweeping - `src/ui/gate/gateTitleCard.js`
  reads it itself, AUDIT EG V); the absent's ring still drains, a count and not a motion;
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

Written as notes for the game's own player and FM bank, in `systems/eliteGates/egScore.js`. Each score module writes its own
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
- **Silence is scored too**: the gather and the closing play the band's ambience alone (EG-ROAR: THE SPIRE'S AIR,
  below - until then the dungeon's drips), and a lord's wake is a 2-bar drum swell before SPIRLRD1 - timed from the lord's own wake (the room's `wake`, as the company steps into its ring),
  with the band's ambience while it sleeps (AUDIT EG V). A fall plays SPIREEND on the fallen's own screen for its time,
  then the hall's song again.
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

**THE SCORE'S OWN VOICES (EG-ROAR).** Each song carries its own instruments over the FM bank's one pair a note
(`SPIRE_VOICES`, `SPIRE_KIT` - `systems/song/songPlayer.js` `songVoices`, `songKit`, `08-Audio/Audio.md` EG-ROAR): the
sections in unison laid either side of their place, a sub under the hit and the spiccato, the taiko, the kick and the toms
long with their beater's click, the snare a crack over a skin, the hats, the shaker and the woodblocks. Three voices fill
GM's last channels: the tremolo strings (the shrieks, B5 over C6 - the Kyn's half step high), the reverse cymbal (a swell
into each phrase) and the voices (the legion's chant on the chord's root and fifth). Every song is written to climb: the
spiccato under everything in the 3-3-2, a braam at each phrase (the low brass's cluster, E under the Kyn's F - never on
the brass, whose bars hold the motifs), a swell into each eight; the halls' four eights a variant (the descent, the motif,
the gathering, the height); the trial's call, drive, break, build and height. The press lets a drum's first 12 ms through
(ratio 3).

**THE SPIRE'S AIR (EG-ROAR, `scenes/eliteGates/egAir.js`).** Under the score and between its songs, in place of the
dungeon's drips, doors and birds (DFU's AmbientEffectsPlayer is silent in a circle, as in the court and the Hour). Its beds,
made at runtime and each a loop that meets itself: THE VOID (a roar swept through a resonant band over a brown rumble,
breathing); THE SPIRE'S DRONE, each band's chord tuned to the score's E (the Galleries' fifths with the ward's whine, E5
against F5; the Cairn's sung "oh"; the Shade's glass, B4 against C5; the Wellhead's furnace on E1's harmonics, the bellows
pulsing); THE BAND'S VOICE from DAGGER.SND's own (the colonnades' wind, the souls' moan, the Shade's howl, the forge's fire
and grind); THE LORD'S BREATH while a Court's lord sleeps. Its events, far off on the breach's clock, the same on every
screen of a company (the Hour's law): the legion's horn, drums and roar, the Spire's stone tearing below and its debris
falling, and each band's own (a cracked bell; wails and a toll; howls and whispers; hammers and a forge's blasts). Its
mix by the score's place: whole where the score is silent, under the war in a trial, hushed to the breath while the lord
sleeps, low at a rest, falling away at the end and at a fall - eased over 1.5 s.

## 27. The HUD, the beats and the first breach

### 27.1 The HUD, by form factor

Today the gate's row (`src/ui/gate/gateBossBar.js`, `BOSS_BAR_WIDTH` 460) sits at 44 px on a landscape phone and drops
its marks row there (`max-height: 480px`), and no gate UI reads the HUD's scale. The Spire's is laid out per form
factor, every part reading `--hud-scale`:

- **desktop**: the count's chip and the Reliquaries' beside the compass, the decrees under them, the potion pip, the
  objective chip; the lord's bar only in a Court;
- **a phone held upright**: one 18 px tabular chip (the count and the Reliquaries), the decrees collapsed to a
  tappable *4 decrees*;
- **a phone held sideways**: the count's chip and a 44 px lord's bar (`EG_LAYOUTS` `lordH`, the bar's own height); the
  decrees folded to a tappable press, as upright, and on each arrival card (AUDIT EG V: the pause sheet is the port's
  menu, which holds no breach's readout, and the press is the same words one tap away);
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
  FIELD BUGS 2026-10-19f GAUNTLET-PLATES: the Gauntlet's names both ways a Caster is silenced, *Silence each caster: stand on
  its plate, or slay it.* (*Casters left: 3. Hold a plate 3 s or slay its caster*) - *Silence the casters.* (*Casters left:
  3*) named neither, and no plate was marked (section 8.3; a slain Caster silenced since GAUNTLET-SLAIN,
  `01-Overview/bugs/Field-Bugs-2026-10-19d.md`). They are the first objective's words in the player's language
  (`eg.objective.gauntlet`, `eg.progress.gauntlet` - `ui/eliteGates/egHud.js` `egObjectiveText`, both trackers and the
  arrival card). The law's own word stays as laid (`EG_OBJECTIVES`): every spec carries it, so it is a hall's bytes
  (section 22's law pin), and the screen's words are the screen's.
- **The door** (section 7): a gold beam seen hall-wide, a compass and screen-edge marker, *The way down opens.*, a
  door's sound, and the closing's ring in every hall kind, not only spans.

### 27.4 The party rows

The party panel (`src/ui/partyPanel.js`, PARTY8-B's quiet rows) learns the Spire's states:

- each member's numeral;
- a dagger for each of their falls (the room's count; AUDIT EG V);
- a cracked gold sigil on the portrait once their recall is spent: the company must see who is on their last life;
- a grey row with an eye for a witness; an arch for home; a struck-through name for the forsaken;
- an amber ring draining the 180 s for an absent body, from the trial's wake as the room counts it (section 6.1);
- a witness's tap on a living companion's row watches them (section 16.5);
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
| a lord's wake | the lord's card | the score's swell (SPIRWAKE) | *Grath wakes.* in the chat (AUDIT EG V) |
| a phase turn | the lord's phase card | the drum's turn | its one order |
| a fall | THE FALL (section 16.5) | a low toll | *<name> falls.* |
| a recall | a flare at the beacon, a blue pillar | a chime | *<name> is called back.* |
| a Redoubt | its sequence (section 16.2) | SPIRREDT | *Redoubt 5* |
| a key found | the *Weir Key* banner | the Rare chime (`playRareDrop`) | - |
| the Athenaeum's reward | the Orrery's light | a chord | *The Orrery turns true. A Vestige waits.* |
| a twist | the arrival card's second line | - | its line |
| another walks home | their row's arch | - | *<name> walks home.* |
| the last word | the chip's seal | a toll | *The last word. The breach closes.* |
| a Second Wind | the health bar's rise | a chime | *Second Wind! 350 health returns.* |
| Rally's heal | the health bar's rise | a chime | *Rally! The company heals 14%.* |
| a Lifeline window on me | its blue chip and its seconds | a soft chime | *Lifeline! 30% less from blows for 3 seconds.* |
| a Shield-Hymn window on me | its blue chip and its seconds | a soft chime | *Shield-Hymn! Bastion's guard for 4 seconds.* |
| Spellweave's free spell | its blue chip while the next is free, the book's 0 | a soft chime | *Spellweave! The spell costs nothing.* |
| Rallying Cry's refresh | the door's beam | a chime | *Rallying Cry! Your Second Wind is ready again.* |
| a Bladestorm | the struck foes' flash | the low swing, lower | *Bladestorm!* |
| a Deadeye | the pierced add's flash | the bow's loose, higher | *Deadeye! The arrow runs through.* |
| an Accord forms | its blue chip while the pair stands | a soft chime | *Kindled Steel, with Mira.* |
| an Accord lapses | its chip gone | - | *Kindled Steel lapses.* |
| resonance reached | the card's blue line before it, the recap's capstones | a chord | *Stone resonates: Rooted.* |

The pull's toll rings the bell (clip 107) with its line (AUDIT EG V). A cast-back and the toll say what they took of the health bar: the quarter's floor, the last point the toll never takes
and Stoneskin's cushion all make it less than the law's share, and a toll that takes nothing says nothing. The Vestiges'
rows are the holder's alone, on the screen and never in the chat, each on THE SPIRE MIX's critical bus:

- the relay tells a Bladestorm's or a Deadeye's striker alone (`esay` `storm` and `deadeye`, `s` the striker), and only
  when it struck another foe; Kindled Steel's splash, which comes with every melee blow its pair lands, is said by its
  Accord's chip and its forming, never blow by blow;
- an Accord stands by the pair law where the screen draws the company (`accordMates`); its forming and its lapsing are each
  said once a hall, and the first look in a hall only learns what stands, so a company gathering at a plate says nothing;
- a window's chip reads its whole seconds left, and Shield-Hymn's shows only while another's Bastion guards me.

### 27.6 THE RECAP

A run of up to three hours never ends on a receipt alone. On `end`, and for a member who walks home, both skins show:

- the depth (the hall, the Redoubt, the band), the time from Hall 1's wake, and why it ended;
- a strip per circle: the hall kinds' glyphs, the lord, the falls marked;
- the company: each member's share, healing, falls, recall and how they left;
- the Vestiges held, the capstones, and the Accords;
- the Reliquaries opening one each 400 ms with the Rare chime;
- the board's line: *The Descent, the Few: 14th*.

The strip's falls are the room's - every member's, each on the hall the company stood in - and its log is kept on the
device with its breach (`eg.log`), so a reload's recap keeps its earlier circles. The recap closes by its own button
(a tap) as by Enter. The last five runs are kept on the device and read on the boards' sixth tab, *Your last runs*
(`src/ui/eliteGates/egBoardWindow.js` `egRunsLines`) (AUDIT EG V). At every lord's fall the damage chart shows as the gate's does
(FELLED, then the chart, `src/ui/gate/gateDamageChart.js`, with its Healed column).

### 27.7 The first breach

- **The fixed first circle** (section 7): the Caverns, Grath, every system in its first five halls.
- **First-time lines**, once an account (service bits, `EG_TEXT_FIRST` - the device keeps each account's own, OR'd in
  and told the service, so a word lost before a reload never shows a line twice; AUDIT EG V), each at its first
  occurrence, never in a card before it applies:
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
  with the count and one life but no spoils, receipts or boards. Its members enter with no recall, so a fall is final:
  its card, the witness's line and the first-time lines say so (AUDIT EG V - a Rehearsal ends at Redoubt 1, before any
  rest could call one back). It ends at Redoubt 1 (`why:'rehearsal'`), a wipe or
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

The company's word on every input (AUDIT EG V): the pad's focus runs over every choice the panel shows - the cards, a
Surplus's two, then each open choice's options - up takes the one it stands on, down says no to a yes-or-no; Y (and
`/breach vote yes`) answers the Ready at a rest, R (`/breach respite`) a respite, which is its own word; a witness's
shoulders change whom it watches and its up pings; the recap closes by a tap. No line tells a screen in hand to type.

### 27.9 Words

Lines are short (Mac, WB12: *"less explanatory and less AI"*), in the Elder Scrolls' own voice, and follow WB13b's
rules. Each is worded once: the law's own in `EG_TEXT` (`net/eliteGates/egLaw.js`, in the relay's bundle), the screen's in
`EG_PRES_TEXT` (`ui/eliteGates/egBeats.js`) and the client modules' own constants, a few still written where they are said. They
reach a player in English today, whatever language they chose: the Spire's accessibility rows, the refusals the
account's catalog holds and every line AUDIT EG V added go through the text core (`t(key, en, args)`), and the rest is
EG-L10N's debt (section 31).

## 28. The four hosts

As built (each slice's record in section 31 names what it wired):

- `src/scenes/world.js` - WIRED:
  - the key's arm and its refusals; the start window and its preflight; the arch pool (`egArchPool`, the gate pool's
    law, standing only verified arches); the call's prompt, horn and portal;
  - the Timers row, the sight line, the company's map mark;
  - the hub's open and the room link (`createEgClient`, built online, which holds the HUD and its layouts, the count's
    chip, the arrival card, the recap and the receipts' claims - `scenes/eliteGates/egClient.js` `claimAdd`, kept on the device
    until counted); *Return to the Spire*;
  - the score, THE SPIRE MIX and the reverb's hold; the flight bans (OR'd into the one ward registration) and the
    technique refusal; the jump buffer; THE POTION LAW's counter; no Resurrect; a death as a fall;
  - DEATH-PENALTY exempted (`madeRuleHere('deathPenalty')`); THE FALL; the witness view (`egWitnessEye`, `egWitness`).
- `src/scenes/worldModes.js` - WIRED: `enterEgHall` and `standEgHall` beside `enterSdRealm` and `standSdRealm` (meshes,
  collider buckets, lights and the circle's fragments, through `world/eliteGates/egHall.js`'s builders - section 9); the next
  circle's build during the Court's rest and the swap in place (`egPrebuild`, `egSwapCircle`, `egSwapDrop`), under the
  veil's flash; the cull (`egSpanCull`); `madeLevelOf`; the witness's eye and THE FALL's sink in the dungeon arm, off
  the
  world host's `egWitnessEye` and `egWitness` (AUDIT EG III).
- `src/scenes/dungeonContext.js` - WIRED: the spans' riders (`egSpanRide`, the Hour keeping `sdStepsRide`) and RIDDEN
  POSES; the new circle's spans (`egRecircle`); no foes stream in a made level (every foe is the relay's); AvoidDeath
  refused (its hook reads `madeLevelRule(_made, 'avoidDeath')` - the one host whose hook a made level reaches).
- `src/scenes/exterior.js` - FLAGGED: the `?exterior` bench is offline. There is no Elite Breach there, and the key says
  so (*The key is cold here.*).

A fragment's own clamp is the breach client's (`scenes/eliteGates/egClient.js` sets `player.arena`, EG-ZH), not a host's.
`scenes/eliteGates/egClient.js` and `scenes/eliteGates/egSpan.js` are helpers the hosts call, not fifth hosts. Every slice record below names
all four, each wired or flagged.

## 29. How the arc keeps the Process rules

`bible/Home.md`'s Process rules bind every change. Where this arc meets each:

- **THE FOUR HOSTS RULE**: section 28, and every slice record names all four.
- **THE MODAL CONTRACT**: a hall is a made dungeon level, so `worldModes.frame()` keeps no Spire branch of its own: the
  dungeon arm's return holds for it. The Spire's own refusals answer one type (`test/scenes/eliteGates/egaudit3_client.test.js`, AUDIT EG
  III).
- **THE NATIVE-WINDOW RULE**: on the classic skin, the start window is DFU's list picker and its one question DFU's YesNo
  box (section 5), and the board window DFU's pickers (EG-ZM). The Vestige offer, the company's word and the recap are one
  DOM panel (`ui/eliteGates/egHud.js` `drawEgPanel`) on both skins, its rows text: a departure from the rule, said here (AUDIT EG III)
  - no DFU window holds three cards, a timed vote or the recap's strip. There is no rest window (the rest is the
  Redoubt's sequence, on the HUD), and the confirm is a second press of the same word within `EG_HOME_CONFIRM_MS` (the way
  home, forsaking), asked on the mid-screen line.
- **THE ONE CONSTRUCTION SEAM**: `world/eliteGates/egHall.js`'s builders make a circle's model, collider buckets and lights for the
  mode machine's stand and the swap's worker alike (section 9), and `madeLevelOf` is the one law of the made levels'
  rules (section 24).
- **ONE DFU MEMBER, ONE EXPORT**:
  - the gate's constants (`BUCKET_*`, `PHASE_AT`, `SHIELD_MS`, `THREAT_*`, `ATTACKS`, `POOLS`) are imported, never
    copied;
  - `sdSeed` and `topWithMe` are exported once and imported (`hostTeamHpFor` already is); the gate's `rimSpots` stays
    private, since the Spire's wave spots are its own (section 12);
  - the platform clock moves to `net/eliteGates/egSpanLaw.js` once, and `src/world/superDungeon/sdSteps.js` re-exports it;
  - `EG_ESCAPE_MPS` is the escape build's run written as `runSpeed`'s own formula (`net/eliteGates/egShape.js` imports no motor),
    and
    a test holds it equal to `runSpeed(40, 20)`;
  - the span law's copied motor numbers are held equal by a test;
  - one mesh kit (`world/eliteGates/meshKit.js`) and one registry of pseudo-archives (`world/eliteGates/pseudoArchives.js`).
- **A PIN MUST FAIL**: every slice ships `eg<N>_*.test.js` under test/ and its mutant records, `eg<N>.json` under
  tools/mutants/, every mutant dead; laws are pinned with deepEqual against their tables, never inequalities.
- **TEST THE SHAPE THE PRODUCER MINTS**: receipts, orders, specs, fragments and courses are tested as
  `mintEgReceipt`, `identityToken`, `egHallOf`, `tools/fragBake.mjs` and `courseOf` mint them, never as hand-built
  literals.
- **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD**: the start window is the arc's one overlay - its list on the mode
  machine's window slot, its question on the host's overlay - each slot emptied before its occupant is told, its choice
  made once however many doors call it, and a question put out of its slot unanswered ending it as a cancel
  (`ui/eliteGates/egStartWindow.js` `egStartAsk`, AUDIT EG III). It ends by its own choice, a cancel, or the online frame going
  (`away` - which takes it out of the slot before it closes it, AUDIT EG V), never by the room's word. The panel is redrawn from the room's state each frame and taken down when the state
  holds nothing for it.
- **ASYNC NEVER DROPS**:
  - the open is single-flight on `rq` - kept on the device before it is asked, and asked again by it when its answer is
    lost (AUDIT EG IV) - and the hub's forward is retried on `ez`;
  - claims are coalesced per (breach, Redoubt, kind);
  - the restack applies the balance in its asks' order, never an older answer over a newer (AUDIT EG IV);
  - every refusal is checked again when its async answer lands - the start window's preflight among them: a window the
    screen let go of, or one a refusal came to stand over, never opens (AUDIT EG V).
- **EVERY ALLOCATION HAS AN OWNER**:
  - every exit path (the swap, the tear, the way home, a fall, forsaking, a void, a reload) frees the hall's meshes,
    colliders, riders, telegraph buffers and reverb buffers, its fragments' with them (the court's and the Hour's
    meshes are built once and never freed today; the Spire's are not) - the fight's telegraph and crystal passes as the
    breach is left (AUDIT EG V, section 11.9's pin), a Spirebridge's plank out of the collider at its own end;
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
- **Frame-synced probes**: the Spire lab's Playwright probe of the halls (`tools/spireLabProbe.mjs`) frame-syncs on the
  shot-mode `__frame` counter, never sleeps.
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
- **No climb on the Colossus's Rails.** Section 13.3's Bound Colossus raises its Rails, and its hearts open while they
  stand, but no member rides them up its flank: the hearts are struck from the floor beside it. A ridden piece today is
  a span's, laid by the hall's law on the fight's clock (`net/eliteGates/egFair.js` egRideAt, THE FAIR TRAIL); a Rail on a body
  walking its own route is a new kind of piece the motor, the fair trail and the solver would each have to learn, more
  than the followups that found it (AUDIT EG V, L1-13 and group H).

## 31. Slices and their records

The order the arc ships in. Each slice can ship and be checked without the next, and the content arrives band by band.
Every slice ships its tests (`eg<N>_*.test.js` under test/) and mutant records (`eg<N>.json` under tools/mutants/),
every mutant dead or recorded equivalent with its reason (`egz_camera`, `egz_ends`, `egz_lords` and `egz_mastery` hold
the arc's equivalents), and its record names the four hosts and the Ledger rows it opened or moved. Each band's kit
ships its band's art: no slice ships a placeholder. Every band is open (`net/eliteGates/egLaw.js` `EG_OPEN`, the bands' count).

**The table is the plan as written.** The arc shipped in the slices whose records follow - EG-PLAY, EG-FULL's three
layers, EG-E, EG-F, EG-G, EG-H, the EG-Z wave, the EG-HERO wave and EG-HERO-LAY - each saying which planned pieces it
took. Some planned names do not stand under them. `net/egHost.js` and `net/egLord.js` were built by EG-PLAY and retired
by layer one (the legion is `net/eliteGates/egLegion.js`, the lords `net/eliteGates/egLords.js`). `scenes/egHall.js` and `egHallParts` were
never built (the circle is built by `world/eliteGates/egHall.js` and its worker, section 9). **The arc's audits as built** have
pages of their own, not records here: AUDIT EG III (`01-Overview/audits/Audit-EG-III.md`) and AUDIT EG IV
(`01-Overview/audits/Audit-EG-IV.md`, 2026-10-13: the Fallen Stacks laid and the legion, lords and net groups). AUDIT EG V
wrote EG IV's page on 2026-10-15, because EG IV left no record and its lanes' findings list was never saved, and its own
(`01-Overview/audits/Audit-EG-V.md`, 2026-10-15: nine cold lanes, 158 findings, eight fix groups, the followups and the merge
of main past the host split). **A record
names another record's departure by its number when it closed**: a list renumbered later keeps the pointer to the
departure as it then stood, so read such a pointer against the record's own date. **Versions** are
named as they stood too: the arc ships under one relay version, one account version and one migration (section 23's
Versions), so a record's `world195`-`world205`, `acct116`-`acct136` and migrations 0111 to 0123 are `world213`, `acct149` and
0124 since the merges of main. EG-E1, EG-E2, EG-E3 and EG15's records stand in sections 19 and 20, beside the law they
built.

**EG-L10N, owed**: the arc's own words reach a player in English, whatever language they chose - its record, below the
slice table's last row, says what is routed and what is owed.

| slice | what | moves |
|---|---|---|
| **EG0** | this page | the bible |
| **EG0a** | AUDIT EG0 | the bible |
| **EG0b** | the fragments (sections 11 and 8.8 as first written) | the bible |
| **EG0c** | AUDIT EG II, the polish pass | the bible |
| **EG-PLAY** | THE ELITE BREACH, PLAYABLE: the slice the user asked for before the rest - the smallest Elite Breach that plays online end to end, cut through EG2, EG5, EG8, EG9-EG12 and EG14's `w` arm (its record, below, says what each piece took and left) | client, relay (world205), service (acct136) |
| **EG1** | THE GATE'S TIERS: `systems/gateTier.js`, `GATE_TIER_TEXT`, the Regular tier's words unchanged; THE REGISTRY: `world/eliteGates/pseudoArchives.js`, every port archive in it, and its collision test | client |
| **EG2** | THE WEIR KEY: template 575 and its art; the balance (migration); the rolls in `claimGate` (which gains `rand`) and `claimSd`; the pity; `/v1/eg/find`, the killer's ask and the caps; `/v1/eg/keys`; the restack, new; the launch gift (a send migration) | client, service |
| **EG3** | THE BOSS SEAM: `net/bossSeam.js`; the gate, the Remnant and the serpent re-plugged, frames and pins unchanged; the trails keep y | relay (a version) |
| **EG4** | THE COURSE AS DATA: `courseOf`, with the Hour's course byte for byte, and every reader fed; the platform clock moved into `net/eliteGates/egSpanLaw.js`; `orreryOf` widened and `orreryJudge` extracted, with the Hour's draw and judge unchanged | client, relay (a version) |
| **EG5** | THE HALL LAW: `net/eliteGates/egLaw.js` (the record, the clock and its holds, the rhythm, the circle, the variants, the bands, the spec, the decrees, the recast trials and their effects, `egFightProfile` and its validator, the waves); the law's integers, `lawSin`/`lawCos`, the source sweep and the spec's digest; `sdSeed` exported; `arenaWeekOf`; the standing decrees and the frames' nine | client, relay bundle |
| **EG6a** | THE SPAN GENERATOR AND THE TIMED SOLVER: `egSpanOf`, the solver in the law (windows, no queues, the median, ceilings, shafts, the crossing's bound at the fast build), `egSpanSolve.mjs`, the Drop and the other Galleries pieces, the toll, the Galleries' sweep (25 seeds a pull request, 500 nightly) | client |
| **EG6b** | THE FRAGMENTS: `net/eliteGates/egFragLaw.js`, the sockets and the volumes; the Oblivion Caverns kit (passage, chamber, shaft) with its art; the dressed platforms and their tells; THE EDGE LINE; THE FORK (its foes from EG11); the Collapsing Tube; `world/eliteGates/meshKit.js`; the instanced moving-piece pass; the cull; telegraphs per fight floor; THE WIDTH RULE; the fragment's clamp; the camera in rock; the reverb's hold and crossfade; `GetFireWallColors32`, with audit39 re-pinned; the budgets measured on SwiftShader and a reference phone | client, relay bundle |
| **EG6c** | HERO FRAGMENTS: `fragBake.mjs` (under tools/), and each fragment Mac authors with its law markers and its byte-for-byte test | client |
| **EG7** | THE MADE LEVEL'S RULES: `madeLevelOf`, `MADE_LEVEL_RULES` (THE POTION LAW, AvoidDeath, technique flights and the jump buffer among them) and the sweep test; the Burning Court and the Hour re-plugged unchanged | client |
| **EG8a** | THE ROOM AND ITS ORDERS: the `eg:` family, the orders (`ORDER_KINDS`, `EG_ORDER_FIELDS`), the hub's open (`EG_INTERNAL_OPEN` retried, `eglive`, `egrc`, the signed call), presence, the tick, the Rehearsal's `rh` | relay (a version), service |
| **EG8b** | STAKES AND `eg_live`: stakes, voids, the first breach's mercy, `eg_live`, `claimEg`'s `x` and `v` arms (a void returns a key from this slice on), the key-loss paths | service, relay (a version) |
| **EG8c** | THE DIRECTOR AND THE WAVES: `net/eliteGates/egBrain.js` (the stages, the count and its holds, the closing, the pull, the company's word), `net/egHost.js` with the gate's three kinds lifted, THE GOLD RUN, the numerals, the secret receipt seeds, and an INTERIM Court lord (the Proving champion's kit) so a Redoubt can be reached before EG13 | relay (a version) |
| **EG8d** | INTEGRITY: THE FAIR TRAIL and its time law, `judgeShapes` and the full shape stamp, the hazards judged, `net/eliteGates/egFloor.js` (THE UNION FLOOR in time), RIDDEN POSES (`pl` in `validPose`), the clock's correction, the feint's `cut`, `untell` | relay (a version), client |
| **EG8e** | DURABILITY: saves to storage, THE HOLD, THE DRAIN, the law pin (seven days of `EG_SPEC`, `{k:'spec'}`), time across a restart | relay (a version), deploy |
| **EG9** | THE ARCH AND THE CALL: the arm, the refusals, the start window (`/v1/eg/starts`, the ticks, the Wager, the Rehearsal's choice), the arch pool, the pass's per-draw membrane and beacon and `GATE_PASS_MAX`, the clear sweep's keys, the signed cell word, the call's prompt and horn, the portal, the landings, the Timers row, the sight line, the map mark | client, service |
| **EG10** | THE HALLS ON THE PAGE: `world/eliteGates/egHall.js`, `scenes/egHall.js`, `egHallParts`, THE SWAP (the build during the closing, the free pins), the stair and reduced motion, arrival, gather, closing and pull, the HUD's layouts and THE COUNT CHIP, the arrival card and the objective, the flight bans and the technique refusal, the jump buffer, the cast-back, THE FALL, DEATH-PENALTY exempted, *Return to the Spire*, the fixed first circle and the first-time lines, the Rehearsal, touch and the pad, `EG_BEATS`, the modal contract's pin, frame-synced probes | client |
| **EG11** | THE HALL KINDS, THE TWISTS AND THE LEGION: the Rift-Yard and the Wellspring, the Span, the Rampart and the Falling Wall (bastions, waystones), the Athenaeum, the Proving Walk and its champions, the Deepway, the chambers and their play; kinds 3, 4 and 6 and ROLE READS; the push; haven, lanes and tether; the callers' 24 shapes, THE TELEGRAPH BUDGET, THE QUIET COMPANY, THE SPIRE DANGER EDGE; caches, Cantrips, lumen and the Sutler; the Caverns' sluice and the alcoves; the potion pip | client, relay (a version) |
| **EG12** | THE REDOUBT: receipts, the spoils (`systems/eliteGates/egSpoils.js`), Reliquaries, the sequence, the rest, the pressed way home, the Vestiges (law, offers, Masteries, Accords, shards, effects, the relay's half, the caps, resonance, the death saves), the fallen (the recall, the Memento and the niches, THE WITNESS VIEW, the bequest, forsaking), the company's word and the living ping, the surplus and the respite budget, the party rows, the receipts' fields (`fl`, `lb`, `ft`, `td`, `wg`), THE RECAP | client, relay (a version) |
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

### EG-L10N - owed (written at AUDIT EG V, 2026-10-15)

The Elite Breach was built beside the localization arc (L10N4) and met its ratchet at the merge of main past it
(0b9991ffc2, 2026-10-13; until AUDIT EG V the debt was named only in that merge's message and in the ratchet's
comment): every line it says reaches a player in English, whatever language they chose - 848 hard-coded literals across
the 33 `eg*` files of `src/` at 9a862e8d. `test/systems/l10n4_hardcoded.test.js` counts its files' English as it arrived and
holds each count from rising. Routed so far, each with the thirteen whole languages' rows drafted
in-session (`tools/l10nInSession.mjs`): the Accessibility tab's three Spire rows and the palettes' names
(`ui/enhanced/enhancedMenu.js` `spireAccessRows`, `ui/eliteGates/egAccess.js`), the refusals the account's catalog holds
(`scenes/eliteGates/egClient.js` `egRefusalText` reads `net/accountClient.js` `REFUSALS`), and every line AUDIT EG V added (the
`eg.*`, `chat.help.breach` and `menu.spire.*` keys). Owed: the rest - `EG_PRES_TEXT`, `EG_TEXT_FIRST`, `EG_BAND_LINES`
(`ui/eliteGates/egBeats.js`), the client's own constants and inline lines (`scenes/eliteGates/egClient.js`, `scenes/eliteGates/egFight.js`, `ui/eliteGates/egHud.js`,
`ui/eliteGates/egSpireHud.js`, `ui/eliteGates/egBoardWindow.js`, `ui/eliteGates/egStartWindow.js`), and `EG_TEXT` (`net/eliteGates/egLaw.js`), whose words are the
relay's bundle's: a screen reads each through `t()` at the place it says it, the law's English the key's, so the relay's
law never moves. The ratchet's counts are the debt's measure.

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

### EG-PLAY - 2026-10-11 (Mac: "Do not come back until this is done") - THE ELITE BREACH, PLAYABLE

**What this is, said plainly.** EG0 to EG0c wrote the design and built nothing. EG-PLAY is CODE: the smallest Elite
Breach that plays online end to end, from the key to the claim, cut through the slices above. Where a slice was to
build a piece whole, EG-PLAY builds the part the loop needs and lists what it leaves; the slices above stay the plan
for the rest. A player can now turn a Weir Key (or open the day's Rehearsal), call their party, step into the Spire,
fight down a circle of five halls - a Rift-Yard, a Span through an Oblivion Caverns passage, a Proving Walk, a Rampart
and a Court - under THE COUNT and one life, take the circle's Redoubt, rest, and walk home with its receipt or descend
to the next circle.

**What shipped, by piece.**

- **The key** (EG2's core): template 575 (`systems/eliteGates/weirKey.js`), bound and stacked; its picture DFU's Talisman's
  (TEXTURE.211 record 50). The count is the account's (`players.eg_keys`, migration 0111 - 0117 since the merges past NAME-AS, SEAT-FACTS, LAMP-KEEPER II, FIRMAMENT-ON, KG6 and POI-1) and the pack's stack its face,
  restacked by every answer that carries it. Rolled at a recorded gate claim (the first certain, then one in six, one in
  four with the rite broken, the pity after five misses) and an Hour claim (one in three) - `server-account/src/eg.js`
  `rollWeirKey`, answered as `weir` on both claims. `/v1/eg/keys`. The launch gift: one key to every account with a
  gate kill that was not a rite's.
- **The open, the stake, the admission, the claim** (EG8a, EG8b, EG14's `w` arm): `/v1/eg/open` stakes a key
  (idempotent on its request id; one live breach an account; the Rehearsal once a real day with no key);
  `/v1/eg/admit` signs a member's admission; `/v1/eg/claim` takes the `e1` receipts - a Redoubt (`w`, which fills the
  INT5 spoils budget), an end (`x`; the opener's own end settles the stake, the first breach's mercy returns it once
  when no Redoubt was taken), a void (`v`, the stake back). The orders `egopen` and `egadmit` (`net/identityToken.js`);
  the receipt (`net/eliteGates/egReceipt.js`).
- **The law** (EG5's core): `net/eliteGates/egLaw.js` - the room key `eg:<16hex>`; the clock (rising 20 s, sealed to five minutes,
  open five more, the last word); THE COUNT (thirty minutes from the first wake, fifteen more a Redoubt, thirty in hand
  at most, held through a rest and a pull); the circle's rhythm (the first circle fixed); the hall spec in whole
  centimetres off the port's seeded die and an integer sine table (`lawSin`), with its digest; the floors' queries; the
  Rampart's vents.
- **The room and the director** (EG8a, EG8c): the hub opens a breach on the service's order, freezes the company from
  the opener's party and says the call; the breach's room admits its company alone, each with its own admission, and
  runs the halls (`net/eliteGates/egBrain.js`): the gather on the arrival plate, the trial by kind, the door, the closing and the
  pull, the Redoubt and the rest, the next circle, the end (`tear`, `wipe`, `last`, `empty`, `gone`, `rehearsal`);
  one life (a death, or three minutes absent in a trial, is a member's fall). The legion (`net/egHost.js` - the gate's
  Harriers and Ward-Bearers about a hall's own spots); the champion's kit (`net/egLord.js` - the Warden's cleave, slam
  and charge) for the Proving Walk's champion, *The Kynreeve*, and the INTERIM Court lord, *The Kynreeve Castellan*.
  The receipts minted with the relay's key and re-handed at a hello. `RELAY_VERSION` `world195` (`world196` since the merge past COATS1, `world197` since the merge past CHAT-LANG, `world198` since the merge past BAL8, `world199` since the merge past SPAWN-REBIRTH, `world200` since the merge past AUDIT ETHER-OW, `world201` since the merge past PEER-ACTS, `world203` since the merge past CHAT-TRADE and FIVE-ASKS, `world205` since the merge past KG-SET and KG5).
- **The call and the step in** (EG9's core): the call said in chat and on the tracker; `/breach` answers it once the
  breach opens (and a Weir Key used while one stands does the same), `/breach rehearse` opens the day's Rehearsal,
  `/breach home` takes a Redoubt's way home.
- **The halls** (EG10's core): `world/eliteGates/egHall.js` - a circle is one made level, its five halls side by side 500 m apart,
  dressed in the Hour's art; its plates, discs, bands, the Oblivion Caverns passage (a basalt tunnel over a chasm
  crossed on ledges, fire channels, a fire-fall at the lip) and a Rampart's portcullis. `scenes/eliteGates/egSpan.js` - the spans'
  steps (the Unmoored Steps' Drift, Beat, Riser and Crumble, and still slabs and ledges) as moving collider buckets;
  the void casts a body back to the floor it last stood on for a tenth of its health, never below a quarter. The pull
  is a teleport to the next hall's plate under the veil's flash; a new circle steps out and in under the veil.
  `ui/eliteGates/egHud.js` - the tracker: the call, THE COUNT (gold while it holds, red under five minutes), the circle and hall,
  what the stage asks, the company standing.
- **The fights** (EG11's core): `scenes/eliteGates/egFight.js` - the gate's own client pieces about the hall's centre: the foe's
  body (the Warden's sprite at 2.5), its telegraph and the verdict on my feet, its bar and title card; the legion
  through `scenes/gate/gateHost.js` (which gains a `centre`, the court's by default); a Rift-Yard's rifts as the Reckoning's
  crystals; a Rampart's vents, told a second before they erupt.
- **The Redoubt and the ways out** (EG12's core): the Court's fall takes the circle's Redoubt for every earner (a share
  of its damage, or a part in three of its halls); the company is healed; the way home stands at the Court's heart (the
  level's exit door, with the Portal Stone's portal) - pressed once it asks, again it walks. The end, a fall, a closed
  socket and the way home each walk the member out to where it answered from; a death wakes there.
- **The receipts carried** (`scenes/eliteGates/egClient.js`): kept on the device until the service has counted them.

**Where EG-PLAY departs from this page** (the departures later slices closed are gone from this list: the arch, EG-F;
the circle stood in one level, EG-H3; the band art, EG-G2; the key's picture, EG-ZH; the lords, EG-FULL; the rest of
the loop, EG-FULL to EG-ZS; the hub's held receipts, EG-ZA; the Wager on the order, EG-F; DEATH-PENALTY, EG-H2; the
week's pay, EG-E1):

1. The `e1` receipt's kind rides `q`, not `k`.
2. A member answers from open ground; indoors the answer is refused (*Answer from open ground.*).
3. A member the room already counts (a reload, a new circle's room) is never asked to spend its admission again.

**The four hosts.**

- `src/scenes/world.js` - WIRED: the client built online (`createEgClient`), the breach's words on the presence
  socket and the hub's, the room key, `egFrame` every online frame, the key's opener, `/breach`, the respawn's branch
  for a death in the Spire, the Levitate ward (a second one beside the one - `characters/playerEntity.js`
  `registerSpireLevitateWard`), the court's law (no regeneration), the companions kept out, Mark, Recall and `/unstuck`
  refused, the hosts' `eg*` seams, and a gate or Hour claim's Weir Key restacked.
- `src/scenes/worldModes.js` - WIRED: `enterEgHall`, `standEgHall`, `egPlace`, `egLeave`, `egHallReturn`,
  `egHallBreach`, `egHallCircle`; the spans before the motor and the void's cast-back; the Spire's light, haze, lamps and
  sky; the portcullises; the gate's six combat seams routed to the hall's fight inside a hall; the room identity; the
  way home's press; arrival facing down the course.
- `src/scenes/dungeonContext.js` - WIRED: the circle's flag; no veteran placed; no map, rest or save; a detached
  automap; the spans' set and its ride.
- `src/scenes/exterior.js` - FLAGGED as section 28 has it: the `?exterior` bench is offline and the key says *The key
  is cold here.*

**Pins.** `test/net/eliteGates/egplay_law.test.js` (5), `test/net/eliteGates/egplay_service.test.js` (7), `test/net/eliteGates/egplay_relay.test.js` (5) and
`test/net/eliteGates/egplay_client.test.js` (11 - the client played against the relay's real Room, from the key to the Redoubt, the
way home and the next circle). Mutants: `tools/mutants/egplay.json` (20), every one dead. Records of other arcs whose
quoted lines moved, re-aimed by content: the bound list's (`auditrealm`, `cards8`, `loot9`, `portal1`, `wallet1` - 575
joins it), the account version's (`br5`, `crafthold`, `fb1004d_knight_house`, `tech1`, `gatekeys` - acct116, acct118,
acct119, acct121 then acct122
on the branch; acct136 since the merges, past main's slices up to POI-1's acct135), the order kinds'
(`guild1c`, `seat2a2`) and the relay version's (`soc1` - world195, then world196 past COATS1, then world197 past CHAT-LANG, then world198 past BAL8, then world199 past SPAWN-REBIRTH, then world200 past AUDIT ETHER-OW, then world201 past PEER-ACTS, then world203 past CHAT-TRADE and FIVE-ASKS, then world205 past KG-SET and KG5). The Ledger: section A's ELITE-GATES row
(`01-Overview/Port-Ledger.md`), naming every file.

### EG-FULL, LAYER ONE - 2026-10-11 (Mac: "I said I want everything") - THE SPIRE'S OWN FIGHT, THE RUN, THE WITNESS

**What this is, said plainly.** EG-PLAY was the smallest breach that plays. EG-FULL builds the rest of the page, in
layers. Layer one is CODE for EG4's widened Orrery, EG5 and EG7's depth law, EG11 and EG13's fights (the hall kinds,
variants and twists, the legion's sixteen kinds, all thirteen lords and the champions), EG12's Redoubt systems and the
run (Vestiges, Masteries, Accords, decrees, the company's word, the recall, the Memento and the witness, caches,
Cantrips, lumen and the Sutler, Reliquaries, the respite, the Surplus, pings) and THE POTION LAW. It retires the gate's
borrowed host and attacks for the Spire's own words. What layer one leaves is listed below, and the later layers build it.

**What shipped, by piece.**

- **The law** (`net/eliteGates/egLaw.js`, EG_SPEC 2). The four bands by circle (the Galleries, the Soul Cairn, the Shade
  Perilous, the Havoc Wellhead) and their Brinks at circles 6, 11 and 16. The full rhythm: a fight, the traverse (the
  Span, or from circle 3 the Deepway one time in three), the mixed (the Proving Walk or the Athenaeum), a second fight,
  the Court. The five Yard and five Rampart variants are unlocked by band, and a variant is never one of its kind's last
  min(2, unlocked - 1) draws. The nine twists fall about one hall in four (one trial hall in five, as laid - from spec law 8 one
  in four, AUDIT EG V lane3 #11), never on a Court or a Brink, never two
  running, and at most one Bargain a circle. The lords are drawn by band (the band's own at weight 2, earlier bands' at
  1), with Grath first, a Valkynaz every fifth Court, and never one of the last drawn. The nineteen decrees come in five
  families, with the week's Proclamation. The span decrees fold into the ground as `geo` (Gale-Swept's rank plus three
  times Crumbling Halls'), and their sections are never dropped for room: the runs before them shorten. Each band's span
  pieces include the Gust, Rail, Pendulum, Vent and Drop. Every lord's ground is laid: Grath's isles, the discs, the
  rotunda, the crypt, the twin courts, the soul bridge, the glade, the vault, the forge, the perches and the pit. The
  generator calls integers alone: `lawIsqrt` replaced the two `Math.hypot` calls it had grown, so the spec stays the same
  bytes on every machine.
- **THE SHAPES** (`net/eliteGates/egShape.js`, which imports nothing). The six FULL stamps (disc, lane, cone, ring, the whole floor,
  outside the havens), bounded on the wire. THE WIND-UP FLOOR at THE ESCAPE BUILD's run (pinned to the motor's
  `runSpeed(40, 20)`) lengthens a wind-up and never shortens it; a CHECK keeps its own. Also here: THE WIDTH RULE, the
  verdict on the struck member's screen, THE UNION FLOOR in time (a blow that would leave a member no floor is held)
  and THE TELEGRAPH BUDGET.
- **The fight** (`net/eliteGates/egBodies.js`, `net/eliteGates/egLegion.js`, `net/eliteGates/egLords.js`). Generic bodies: role 0 a lord, 1 an add, 2 an
  object. Blows carry their stamps, tethers and marks; zones are burn, void, soul and haven. The legion has sixteen
  kinds with their behaviours, affixes and decrees. Every lord and champion has a kit: phases, errands, fury, the
  Covenant's Patience, and a lord on a borrowed ground keeps its main disc and spots. Health is seconds of reference
  damage, shared over a team, times the depth.
- **The run** (`net/eliteGates/egVestige.js`, `net/eliteGates/egRun.js`). Twenty-seven Vestiges in families, five Masteries, the Accords and the
  capstones, with the declared factor capped. The rest's offer goes to each member alone (`to`), and the Surplus's card
  or reroll likewise. Also in the run: the company's word (asks, votes and tallies), the next circle's decrees asked by
  family, the Ready and the respite, the Bargain, caches and gifts, Cantrips, lumen and the Sutler, and the relay's
  Vestiges on a blow.
- **The director** (`net/eliteGates/egBrain.js`, brain law 2). Every kind, variant and twist stood and closed, and the doors.
  A fall is a witness's: final with no recall in hand or at the second fall, a Memento laid otherwise, and the member's
  own `fell` word counts like the pose's `dd`. The Redoubt sequence: the recalls at 4.5 s, then at 6 s the window with
  the heal, the offers, the decree asks and the Ready. Forsaking, the way home after the window, and the Gold Run.
- **The wire and the room** (`net/wire.js`, `server/src/index.js`). A member's words: `hit` (by body number), `pick`,
  `surplus`, `vote`, `cant`, `buy`, `lping`, `ping`, `bequest`, `forsake`, `pz` and `fell`. The fight's words run from
  `efs` to `erail`, and the run's from `offer` to `eheal`. A frame with `to` goes to that member's sockets alone. A
  reloaded member is told any open offer and the company's asks.
- **The client** (`scenes/eliteGates/egClient.js`, `scenes/eliteGates/egFight.js`, `net/eliteGates/egLink.js`, `ui/eliteGates/egHud.js`, `world/eliteGates/egHall.js`,
  `systems/eliteGates/spireKit.js`). The fight draws bodies as billboards, struck objects as crystals, and blows, zones and tethers
  in the telegraph pass. It judges each blow on its own screen and applies the push, the drain, burn ticks and void
  cast-backs.
  - THE WITNESS (section 16.5): the death save (`registerPlayerDeathSave`) turns a killing blow into a fall. The room is
    told once, the damage door's mod answers 0, and the body is put away and held under the hall. The eye rides behind a
    living companion (Q and E change whom), and the recall's word stands the member back at its share of their health.
  - THE PANEL: the Vestige cards and the company's word, by key (1-6, Y and N) or by `/breach pick`, `vote`, `cant`,
    `buy`, `surplus`, `ping`, `watch`, `forsake` and `bequest`.
  - THE POTION LAW: two restoring potions a hall, through `useItem.js`'s potion arm. The bottle is kept on a refusal, and
    the count refills at each wake and at the rest.
  - The push follows the Steps' breath: the collider's own move, no edge stop, Iron Footing taking its share. The cage
    holds the motor, and a challenge's ring keeps the challenged inside and everyone else out.
  - The room's heals (a lash never past 1), THE RECAP, the HUD's run line, the decrees, the marks and the potion pip.

**Where layer one departs from this page** (its first six departures - the pieces' motion, Grath's isles, the
economy, the arch, the look and sound, the made level's one law and integrity - were closed by layer two to EG-H; its
record keeps only what still holds):

1. Nothing here has run in a browser. There is no Daggerfall data in the build container, so every client piece is
   tested headless against the relay's real Room and the director's own frames. The relay side is tested by an
   auto-player that walks and fights whole breaches, and none of it is played by hand.

**The four hosts.** `src/scenes/world.js` WIRED: the fight's new deps (the push, the cage, the ring, a void zone's
cost, companions' poses by account), the witness's eye at the camera override, the panel's keys under KEY-BOOT's latch,
the death save, the damage mod and THE POTION LAW's registration. `src/scenes/worldModes.js` WIRED: a circle built at
its `geo`, and the span ride skipped for a witness. `src/scenes/dungeonContext.js` WIRED: the spans built at the
circle's `geo`. `src/scenes/exterior.js`: unchanged (offline, as section 28 has it).

**Pins.** `test/net/eliteGates/egfull_law.test.js` (9), `test/net/eliteGates/egfull_relay.test.js` (5 - six circles played, every lord fought to its
fall, the fall and the recall, the Redoubt's choices, forsaking) and `test/net/eliteGates/egfull_client.test.js` (5). The EG-PLAY pins
were rewritten to the Spire's own words: `test/net/eliteGates/egplay_law.test.js`, `test/net/eliteGates/egplay_relay.test.js` and
`test/net/eliteGates/egplay_client.test.js`. Mutants: `tools/mutants/egfull.json` (31). Records whose quoted lines moved were re-aimed
by content: `egplay`, `sd6a` and `sd18a` (the Orrery widened with defaults equal to the Hour's bytes). `RELAY_VERSION`
stays `world195` (`world196` since the merge past COATS1, `world197` past CHAT-LANG, `world198` past BAL8, `world199` past SPAWN-REBIRTH, `world200` past AUDIT ETHER-OW, `world201` past PEER-ACTS, `world203` past CHAT-TRADE and FIVE-ASKS, `world205` past KG-SET and KG5), unshipped, with its hash and graph recomputed. The account Worker bundles `net/eliteGates/egShape.js` through the
wire, so `account-deploy.yml` lists it. A real defect was found and fixed on the way: the rest's offers were fanned to the
whole company, so every screen showed the last member's cards.

### EG-FULL, LAYER TWO (first part) - 2026-10-11 - THE PIECES MOVE, THE TIMED SOLVER

Closes layer one's first departure for the pieces.

- **The one law** (`net/eliteGates/egSpanLaw.js`, in the relay bundle, importing nothing). Every piece on the shared clock (the
  anchored clock's seconds, which the relay's milliseconds equal): `egPieceAt` (a Drift across, a Rail along, a Beat on
  the Steps' cycle), `egPendAt` and `egPendHits` (a Pendulum's weight over the middle of the gap before its step,
  `EG_PEND_REACH` 2.6 m either side), and `egVentState` and `egInVentDisc` (a Vent's disc, `EG_VENT_R` 1.5 m, told over
  its last `EG_VENT_TELL_S` 1.0 s and erupting `EG_VENT_FIRE_S` 0.5 s at the Rampart's `EG_VENT_PCT`). Every step now
  carries the `gap` before it (`EG_SPEC` 3).
- **THE TIMED SOLVER** (section 10.5). THE SPAN BUILD's running jump from each piece's far edge to the next, over both
  pieces' positions at the launch and the landing. A pair must have a window of `EG_WINDOW_MIN` 0.5 s in every 12 s and
  never wait more than `EG_WAIT_MAX` 4 s. Also checked: a Pendulum's gap clear for `EG_PEND_CLEAR_MIN` 0.8 s, a Crumble
  left inside its delay, a Rail's travel never closing on its neighbours (`EG_RAIL_CLEAR`), a Vent's platform at least
  4 m, a Drop's landing at least 6 m. `egHallOf` re-lays a refused course from the next sub-seed, at most
  `EG_RELAY_MAX` 8 times, then lays it from the band's first two pieces alone; the spec's `laid` says how often. Over 40
  seeds, 20 circles and three grounds, 271 of 7,560 courses were re-laid and none fell to the last resort (AUDIT EG V, lane5 #5: wider, the Brink into the Cairn fell to it in 13.5% of draws - seeds 1-200, every ground - until spec law 8 stood its island at its last leap's height, section 10.5).
- **The reach is measured, never guessed.** The page's span build crosses 3.2 m in SD7b's real-motor run. The motor's
  closed form at 95%, as SD7a takes it, gave 2.43 m, which would have refused every honest course. So the reach is the
  closed form plus the capsule over both edges, a drop's gain held to `EG_DROP_GAIN` 0.45 m a metre. That is 3.26 m on
  the flat, where the real motor clears 3.44 m. `test/net/eliteGates/egfull_span.test.js` crosses every reach the solver allows (level,
  a metre down, a Drop's 4.5 m, 0.4 m up) with the real `PlayerMotor`, so the solver can never be generous.
- **On the screen** (`scenes/eliteGates/egSpan.js`):
  - a Rail travels along the course and carries its rider;
  - a Pendulum's brass weight swings on its chain, and a touch is a cast-back unless the member has Iron Footing III
    (`systems/eliteGates/spireKit.js` `spireFooting`, registered from the breach's client);
  - a Gust section pushes as the Steps' breath does (`world/superDungeon/sdSteps.js` `gustAt`), Iron Footing taking its share;
  - a Drop's landing stands walled on its far side and flanks to `EG_DROP_WALL_H` 7.5 m, so a body that carries too
    far drops onto it.
- **The place pass** (`scenes/eliteGates/egFight.js`), on every screen alike: a span Vent's ring closing in fire and its eruption
  judged on the member's feet once a cycle; a Pendulum's lane over its gap, white and brightening over its last
  0.8 s.
- **A regression closed.** Layer one's rewrite of the fight had dropped EG-PLAY's Rampart vents, which are told 1.0 s and
  judged on the member's feet. The place pass draws and judges them again.

- **The Rampart's ground, closed.** Layer one had laid the Falling Wall and the Forge Bridge in the law
  (`egWallFallenZ`, the `belt` band) but nothing acted on them. Now a Falling Wall's walkway stands as `EG_WALL_SEG_M`
  2 m segments (`world/eliteGates/egHall.js` `egWallBand` leaves it out of the circle's mesh and collider). They fall behind the
  company from 20 s after the hall's wake at 1.5 m/s (`systems/eliteGates/spireKit.js` `spireWake`, registered from the breach's
  client), and a member caught is cast to the nearest segment wholly ahead of the edge. A Forge Bridge's walkway carries
  whoever stands on it toward the arrival plate at `EG_BELT_MPS` 1.0 m/s.

**The four hosts** (AUDIT EG V: this record named none; read off its two commits).
- `src/scenes/world.js` - WIRED: `registerSpireFooting` (Iron Footing against the spans' Gust and Pendulum, from the
  breach client's `footing`) and `registerSpireWake` (the hall's wake, which a Falling Wall falls from), beside layer
  one's registrations. Nothing was added to `function frame(now)`.
- `src/scenes/dungeonContext.js` - FLAGGED, untouched: the moving pieces, the Pendulum, the Gust, the Drop's walls and
  the Falling Wall's segments ride its existing `egSpan` (`scenes/eliteGates/egSpan.js`), stood and ridden as layer one left it.
- `src/scenes/worldModes.js` - FLAGGED, untouched: the circle reaches it through its existing build; `world/eliteGates/egHall.js`
  `egWallBand` leaves the Falling Wall's walkway out of the circle's mesh and collider there.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Pins.** `test/net/eliteGates/egfull_span.test.js` (6) and `tools/mutants/egspan.json` (19, every one dead). `RELAY_VERSION` stays
`world196` (renumbered past main's COATS1 `world195` at the merge; `world197` past CHAT-LANG's `world196` at the next, `world198` past BAL8's `world197` at a later one, `world199` past SPAWN-REBIRTH's `world198` at the next, `world200` past AUDIT ETHER-OW's `world199` at a later one, `world201` past PEER-ACTS' `world200` at the next, `world203` past CHAT-TRADE's `world201` and FIVE-ASKS' `world202` at the one after, `world205` past KG-SET's `world203` and KG5's `world204` at the next),
unshipped, rehashed with `net/eliteGates/egSpanLaw.js` in its graph.

### EG-FULL, LAYER THREE - 2026-10-11 - THE FRAGMENTS, THE FORK, THE SET PIECES

Closes the fragments EG-D owed: section 11's library, THE FORK, the set pieces, the engines, the alcoves, the Annals,
Grath's falling isles, and the solver's median check.

- **The fragments' law** (`net/eliteGates/egFragLaw.js`, in the relay bundle; it imports `egShape.js` and `egSpanLaw.js`). The ten
  of section 11.2 in `EG_FRAGS`, each with its band, classes, reverb, light, engine and signature. `egFragPassage`,
  `egFragChamber` and `egSetPiece` plan a fragment in whole centimetres and milliseconds off the hall's own die, with no
  transcendental in the generator (pinned by a source sweep). `net/eliteGates/egLaw.js` lays the plan into the spec: `caves` (each
  with its kit, its far floor's height `yB`, `open` for a fragment with no walls), `frags`, `hazards`, `ramps`,
  `engines`, `alcoves`, `vignettes`, `lights`, `tube` and `fork` (`EG_SPEC` 4).
- **The passages, kit by kit**:
  - the Oblivion Caverns (a fire fall at the chasm's lip, a magma surge along the far floor, falling basalt on the near
    one, three ledges across the chasm);
  - the Fallen Stacks (bookcase ledges; THE CASCADE across both floors);
  - the Broken Colonnade (open over the void; two Drums rolling along the course);
  - the Ossuary (three Bone bridges; soul-wisps over its floors);
  - the Mist Stair (four flights down, each under a metre; mist surges);
  - the Gloam Thicket (four Moon branches under a walking train of moonbeams);
  - the Forge Gut (two conveyors; hammer drops on both floors);
  - the Oblivion Caverns, deep (wider, two fire falls, two surges).
  A passage's floors are its fight floors (section 11.1), so its Lurkers and a Low Road's foes fight there.
- **The hazards on the shared clock** (`egHazardParts`, `egHazardBites`):
  - a fire fall burns 2 s of every 5, a white shimmer the 1 s before, 15% fire, judged wherever a body stands in it;
  - a surge's 4 m lane, told 1.0 s, 20% fire;
  - the basalt's disc r 2.5, told 1.2 s;
  - the cascade's 4 m lanes told 1.2 s, 1.5 s apart;
  - the hammers' disc r 3, told 1.4 s;
  - the Eclipse every 40 s, told 6 s, 30% outside its three moon-shafts (r 3, walking 1.5 m/s);
  - the tide over a chamber's low floor, 15 s of every 60, told 5 s, ticking 10% a second;
  - a soul-wisp drains a member within 3 m by 3% a second, letting go at 6 m or after 4 s, then not again for 6 s.
  `egHazardLawful` holds every laid hazard to THE WIDTH RULE and THE WIND-UP FLOOR, and the hazards' clocks are the
  same at every depth.
- **The fragments' own pieces** (`net/eliteGates/egSpanLaw.js`):
  - Moon: solid while a beam lies on it, the beams walking at `EG_MOON_MPS` 2.5 m/s, one every 4 s, each lit 3.5 m
    either side;
  - Drum: rolling out and back at a fixed `EG_DRUM_MPS` 2.0 m/s, ridden as a Rail;
  - Bone: the Crumble's law (`EG_CRUMBLE_KINDS`);
  - Sink: sinks 0.5 m/s under a foot and is gone 3 m down. The jump off it is taken 0.5 m low, and a wait on it is
    never longer than 2 s.
- **The solver, deeper**:
  - THE MEDIAN (`egRoadCross`): a road's median crossing over start phases is at most 1.6 times its fastest.
  - THE GROUND AFTER EACH RUN: each step that ends a run carries `after`, the gap to the next still ground, and the
    solver jumps that real gap. Before this, it had assumed the ground began at the step's edge.
  - Proofs run road by road; an alcove's side way (road 2) is never asked of anyone.
  - Over 5 seeds, 20 circles and three grounds, 47 of 1,500 courses were re-laid and none fell back (AUDIT EG V, lane5 #5: wider, the Brink into the Cairn fell to it in 13.5% of draws - seeds 1-200, every ground - until spec law 8 stood its island at its last leap's height, section 10.5).
- **THE FORK** (section 11.4). From circle 2 every span that carries no set piece forks at an island:
  - **The High Road** (road 0) runs two sections, the span decrees' among them. Its Reliquary cache stands on an island
    at its hardest point, and it meets the end plate's height by one Drop.
  - **The Low Road** (road 1) bridges `EG_LOW_X_CM` 15 m across, drops 4.5 m and runs through a passage of the band's
    kit. It passes its Battlemage's niche (15% once, a shard each, and a Memento niche) and runs still ground to its
    bridge onto the plate.
  - The spec's `fork` carries each road's fastest crossing (`hi`, `lo`). A door opened from the High Road while a
    member is still on the Low Road waits their difference.
- **The set pieces** (section 11.3; `egSetPieceOf`, `egTubeCircle`):
  - the Collapsing Tube, in the Galleries' first span from circle 3. It is 60-80 m long and its floor and vault fall at
    `EG_TUBE_MPS` 4.0 m/s from 18 s after the wake. THE SPAN BUILD outruns it with 37% to spare, and a member caught
    is cast forward to the nearest standing segment ahead;
  - the Sinking Stair, the Moon Path and the Forge Line (three conveyors under hammers), in the Brinks into the Cairn,
    the Shade and the Wellhead.
- **The chambers** (section 11.4). A yard or proving court in a chamber from circle 2 takes its band's chamber kit and
  names its play:
  - a second floor 3-4 m up, its stair a ramp;
  - a chokepoint arch 6 m wide;
  - the channels surging in thirds every 20 s;
  - an engine.
  It then carries its kit's signature: the basalt, the wisp, the hammers, the Eclipse, the tide (three dry floors, no
  point of the low floor more than 24 m from a stair), or the Clan Pit's horn. The Athenaeum and the Scriptorium stay
  plain walls.
- **The relay's half** (`net/eliteGates/egBrain.js`):
  - **Engines** (`use`, within 2 m, once in 30 s; the Shelf once): the Sluice, the Shelf and the Drop-Hammer tell a
    blow of the place 1.5 s (20% to a member caught) and take 40-50% from the adds caught. The Drop-Hammer stuns a lord
    once a phase. The Soul-Bell stuns Wraiths and Binders 4 s, the Moon-Mirror the Divers.
  - **The alcoves.** A seam alcove's false wall is a struck object, `fwall`, that falls to one blow. Behind it, each
    member takes its lumen, its shard or a page of the Annals, once.
  - **THE FORK's half**: the High Road's cache, the Low Road's niche, and the Low Road's two Harriers rising as the
    first member takes it.
  - **The Clan Pit's Honour Horn**, 20 s after the wake and again 40 s after each call. Answered alone, every member
    gets a Reliquary. Fouled, Ashfall falls in the Pit for the rest of the hall: fire pools every 6 s.
  - **The fragments' Lurkers**, dormant in the walls: the Low Road's every one, one a passage from circle 3, one a
    chamber from circle 4.
  - **A lord's page.** Its first fall adds its page of the Annals to every living member at the Redoubt.
- **The Annals of 3E 398** (`net/eliteGates/egAnnals.js`): thirty pages of two sentences each, seventeen found behind the false
  walls and thirteen the lords'.
- **On the screen**:
  - `world/eliteGates/egHall.js`: the passages' walls and vaults in their kit's dress, each wall broken at its alcove with the
    niche floored behind it; the Colonnade open; the Gloam Thicket under the sky; the chambers' arches, stairs and
    vignettes; each fragment's lights.
  - `scenes/eliteGates/egSpan.js`:
    - the new pieces;
    - the Collapsing Tube's floor and vault as segments;
    - Grath's islands as buckets, shaking while cracked and sinking when fallen as the relay's `eob` says
      (`systems/eliteGates/spireKit.js` `spireObjs`), a cast-back from a fallen one landing on a standing one;
    - the false walls standing until they fall;
    - the activation ray's Orrery handles and engines (`spireAct`).
  - `scenes/eliteGates/egFight.js`: every hazard drawn and judged on the member's own feet once a part.
  - `scenes/eliteGates/egClient.js`: `/breach use` and `/breach annals`.
- **Fixed on the way**:
  - **the Athenaeum could not be solved.** No client ever sent the Orrery's `pz`; the stones now stand in the
    activation ray and a press sends the turn;
  - **a Drop's far wall closed the road** (layer two): it was walled whole across, and now keeps a doorway 2.4 m wide
    and 3.0 m high on the course's line;
  - **the Colossus's forge chamber stood 3 m past the approach's gap.** The solver's real gap after each run found it;
  - **a decree's crumbles climbed back up** after a course that had gone below the plates;
  - **the Forge's hammers were laid with no reach**, caught by the hazard law's own test.

**Departures, said plainly** (the rest of this list was closed by later slices: the Sluice's 6 s flood, the
Moon-Mirror's lit branch, the slag's crust and the Low Road's closing, EG-ZC; the Annals on the account, EG-E2; the band
art, the mist, the batched pieces, the cull, the measured draws, `world/eliteGates/meshKit.js` and `world/eliteGates/pseudoArchives.js`,
EG-G2; the authored hero fragments laid into the halls, EG-HERO-LAY's spec law 7):
- a code-built fragment's law lives in the spec's own fields, not a separate record with `sockets`, polygon `floors` and
  a legion `graph` (an authored fragment's law is that record since EG6c - `net/eliteGates/egFragLaw.js` `egFragRecordFault` - and
  spec law 7 lays one since EG-HERO-LAY, its polygon floors and graph in the spec). A passage's mouth and exit are its
  `z0` and `z1`; its floors are rectangles.

**The four hosts** (AUDIT EG V: this record named none; read off its commit).
- `src/scenes/world.js` - WIRED: `registerSpireObjs` (Grath's islands and the false walls, as the relay's `eob` says) and
  `registerSpireAct` (an Orrery stone turned, an engine worked), from the breach client's `objs` and `act`. Nothing was
  added to `function frame(now)`.
- `src/scenes/worldModes.js` - WIRED: the press ladder's `egstone:` and `egengine:` arm, which hands the press to the
  context's `egPress`.
- `src/scenes/dungeonContext.js` - WIRED: `egPress`; the activation ray's targets take `egSpan.targets()` (an Athenaeum's
  Orrery stones, a chamber's engine) and its namer `egSpan.hoverName`.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Pins.**
- `test/net/eliteGates/egfrag_law.test.js` (9), `test/net/eliteGates/egfrag_relay.test.js` (5), `test/net/eliteGates/egfrag_client.test.js` (6).
- `tools/mutants/egfrag.json` (51, every one dead). Re-aimed and judged again: `egfull.json` (31), `egspan.json` (19)
  and `egplay.json` (20), every one dead.
- `RELAY_VERSION` `world197` (renumbered past main's CHAT-LANG `world196` at this layer's merge), unshipped, rehashed with
  `net/eliteGates/egFragLaw.js` and `net/eliteGates/egAnnals.js` in its graph.

### EG-E (first part) - 2026-10-12 - THE LORDS' FEATS

The economy layer's first piece, the one the relay must judge: **FEATS OF THE SPIRE** (section 19), in `net/eliteGates/egFeats.js`
(relay bundle, importing nothing).
- **Three feats a lord**:
  - **Unbroken**: no member fell in the Court;
  - **Swift**: felled within `EG_FEAT_SWIFT_MS` (3 minutes) of its wake;
  - **its own signature**, read off the Court's beats as the relay counts them (`tallySays` in `net/eliteGates/egBrain.js`, over
    the lords' step and the members' blows). Grath felled with no member caught by a burning bridge (EG-ZB's); the
    Spellmaster's Examinations passed with
    none failed; two of the Armsmaster's Challenges met; three of Ilthys' banners broken; the Cairn-Keeper laid bare
    twice; the Twin Lords falling within 3 s of each other; two of Morvayn's soul-chainings endured; the Mother of
    Dusk dragged down twice; two Blood Tethers broken; two of Seyth's Eclipses endured; the Colossus into its
    Breakdown with no heart relit; the Wyrm landed twice; Garoth felled before the Covenant pressed.
- **On the receipt.** At a Redoubt each earner's `w` receipt names the lord (`lk`) and its feats (`ft`, three bits).
  `net/eliteGates/egReceipt.js` refuses either out of shape. A band's lords' feats, all held, are its Master
  (`egBandMastered`): the title is the service's, with the rest of the economy.
- **Departure.** Each signature is a beat the relay already counts, not the page's examples (the Examination with no
  rune missed at *n* = 8). Grath's became the page's own once the relay kept who a place's blow caught (EG-ZB:
  *Unsinged*, `EG_FEAT_BRIDGE`).

**The four hosts** (AUDIT EG V: this record named none; read off its commit, which carried PERF-V8 beside the feats).
- `src/scenes/world.js` - WIRED for PERF-V8, not for the feats: the host frame's breach lines moved out of
  `function frame(now)` into two host functions of the same lines, `egCourtFrame` (the breach's fight and tracker put
  away with no online frame; the court's law in a breach) and `egWitnessEye` (the witness's eye), because the frame stood
  over three quarters of V8's ceiling.
- `src/scenes/worldModes.js` and `src/scenes/dungeonContext.js` - FLAGGED, untouched: the feats are the relay's
  (`net/eliteGates/egFeats.js`) and the receipt's, and no host reads them.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Pins.** `test/net/eliteGates/egeco_feats.test.js` (2) and `tools/mutants/egeco.json` (6, every one dead). `RELAY_VERSION` `world197`,
rehashed with `net/eliteGates/egFeats.js` in its graph.

### EG-E (the rest) - 2026-10-12 - WHAT A REDOUBT PAYS, THE SPOILS, THE LORDS' ARMS AND CARDS, THE HOST WIRING

The economy layer's client and host half (Mac: "I said I want everything"), beside the account service's half recorded
in sections 19 and 20 (EG-E1, EG-E2, EG-E3) and EG15's Panoply. Four commits, one record (AUDIT EG III found them with
none).

**What shipped, by piece.**

- **THE PAY LAW** (`net/eliteGates/egPay.js`, new; relay bundle). The one law the account service and the client's spoils both
  read: the Valkynaz's Redoubt every fifth (two spoils passes), the Panoply's odds on a stream of its own (the service
  reads the pity's misses without the loot ladder), the Legendary's share, the embers. `net/arena/arenaLaw.js` `arenaWeekOf`
  joins it, and the Proclamation is drawn by the arena week.
- **THE LORDS' ARMS AND CARDS.** `systems/eliteGates/egLordArms.js` (new) `EG_LORD_ARMS`: each of the thirteen lords' named
  Legendary (The Houndfang to The Clan-Breaker), a fixed base Legendary on the spoils' draws. `net/iliac/iliacCards.js` gains
  thirteen aetheric lord cards, found only in their Redoubt's spoils (their rules and flavor read through the text core
  from `systems/iliac/iliacCardWords.js` since the merge of main past KG-SET, as every card's are); `systems/bossCards.js` `BOSS_CARDS` and
  `BOSS_CARD_PER_MILLE` take them by lord at the gate's 200.
- **A REDOUBT'S SPOILS** (`systems/eliteGates/egSpoils.js` `rollEgSpoils`, `egSpoilsList`). Rolled on the receipt's seed and paid
  by the service's word: gold growing with the Redoubt, one Rare or Legendary piece, one to three of `magicOrBetter`,
  the
  Panoply by its own draw or the service's pity, the lord's named arm one in eight, its card, the sockets, gem and
  technique pass; twice at a Valkynaz's; gold alone for a Redoubt taken again this week. `scenes/eliteGates/egClient.js` hears the
  claim's answer (`paid`) and the Court's heart (`beaconAt`).
- **THE HOST WIRING.**
  - The claim carries the claiming character and restacks its Weir Key.
  - The Broker's Panoply sink (`panoplySale`, minted by `panoplyPieceById`); `/breach board` opens the three boards.
  - EG15's two doors: `setSetPowersAllies` (party mates within the Reprieve's reach, an ALLY-CAST Shield each) and
    `setSpireRecovery`, with `spireRedoubtTaken` once a rest (`scenes/eliteGates/egClient.js` `redoubt`).
  - The find (`registerEgFind`, with the dungeon's tier), the owner's death naming its striker and the joiner's record
    door asking through `egFindStruck`.
  - THE QUIET COMPANY's first half: no cosmetic aura in a Spire's trial (`egClient.quiet`).
  - The fight on the breach's corrected clock.
  - The spoils thrown from the Court's heart into the Hour's pool, or straight into the pack, with the Marks and the
    deed
    as a haul card (`egSpoilsPaid`).

**The four hosts.**

- `src/scenes/world.js` - WIRED: everything in THE HOST WIRING but the find's two dungeon doors, and `egSpoilsPaid`.
- `src/scenes/dungeonContext.js` - WIRED: the owner's death names its striker (`by: foe._killedBy`); the joiner's record
  door asks `egFindStruck`.
- `src/scenes/worldModes.js` - FLAGGED: nothing to wire; the breach's halls reach the client through the mode machine's
  doors as before.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach and no Broker.

**Pins.** `test/net/eliteGates/egeco_pay.test.js` (3), `test/systems/eliteGates/egeco_spoils.test.js` (5), `test/scenes/eliteGates/egeco_hosts.test.js` (2);
`tools/mutants/egeco.json` (25 today, with the feats', every one dead - none of them on the pay law itself: `net/eliteGates/egPay.js`'s
mutants and `arenaWeekOf`'s are AUDIT EG V's, in `tools/mutants/egaudit5_d.json`). Records of other arcs re-aimed by content:
`surv2`, `audit625`, `sd9e`, `cards9`. `RELAY_VERSION` `world197` re-hashed (unshipped). `net/eliteGates/egPay.js` is in no relay's
graph: the account service (`server-account/src/eg.js`, `egEconomy.js`) and the client import it.

### EG-H1 - 2026-10-12 - INTEGRITY: WHAT THE RELAY JUDGES

EG8d, built (Mac: "I said I want everything"), and EG14's `BOSS_BODY` on in `eg:` rooms after it. It closes EG-PLAY's
departure 6 for THE FAIR TRAIL and the body count in `eg:` rooms, and layer one's departure 6 for THE FAIR TRAIL, the
clock's correction and the ridden poses (HOLD and DRAIN are the durability slice's).

**What shipped, by piece.**

- **THE TIME LAW** (`net/eliteGates/egFair.js` `egPoseShared`, new, in the relay bundle). Every `eg:` pose is placed at its shared
  time on its socket's trail (`[t, x, y, z, h]`, the hall's own frame): its `ts` unwrapped mod `POSE_TS_MOD`, plus the
  least `arrival - ts` over its last 32 poses, less the one-way delay the member's corrected clock says with its `clk`
  ping. A pose is never later than it arrived, never before its socket's last, and never more than `EG_TS_LAG_MAX_MS`
  (300 ms) before it arrived. A stamp that runs backwards judges nothing. The judge's readers (`egTrailAt`,
  `egTrailAfter`, `egTrailNear`, `egTrailReady`) take where a body stood at a landing from the last pose sent at or
  before it, and after it from the first pose sent after it, waited for up to `EG_POSE_WAIT_MS` (800 ms). A body with no
  pose within `EG_POSE_NEAR_MS` (300 ms) of the landing is not counted. Pinned in the room: a dodge sent 50 ms before
  the landing at a 300 ms round trip is never counted; the same dodge from a clock that said no delay is.
- **THE CLOCK CORRECTED** (`net/eliteGates/egClock.js`, new, the client's). In the Spire the client pings the room (`clk`) five
  times 250 ms apart, again every 30 s. Each answer is a sample: the relay's `now` less the midpoint of the ping's send
  and the answer's arrival. The offset is their median; the delay is half the median round trip, said with each later
  ping. `scenes/eliteGates/egClient.js` reads the shared clock through it (`sharedNow`); the breach's link and its fight run on it
  (`scenes/eliteGates/egFight.js` takes the link's clock where it keeps one). The room answers a ping at once, to its socket alone.
- **THE FAIR TRAIL** (`spanFair` - `egFairPose`, fed by `net/eliteGates/egBrain.js` `egPoseIn` on every `eg:` pose). It is an
  online accumulator per member, a hall, a life:
  - support: a disc, a band, a lane or a ramp of the spec at its height, a piece's top at its clock (`egPieceAt`) with
    the capsule and 0.15 s of its travel, an alcove, a ride its piece holds, or a climb's hold (`cl`) beside a floor;
  - speed: over stretches of 0.5 s, THE FAST BUILD's run (`runSpeed(100, 100)` with Fleetfoot III, pinned to the motor)
    times 1.1, plus 4 m/s for a push or a carry, plus 2.5 m for the game's own snaps. A stretch that outruns its whole
    window is judged at once. A cast-back onto still ground behind, or back where the member last stood, is no step;
  - air: an airborne stretch past `EG_AIR_MAX_S` (2.5 s) that is no fall;
  - blindness: a `ts` gap over 0.4 s judges nothing. A crossing more than 30% blind opens no door;
  - the last island: a fair pose on still ground (a plate, an island, a passage's floor, a bridge, a ramp - never the end
    plate) ends the window. The trail begins on the arrival plate, or where a recall stood the member;
  - repeats: a second break in a hall refuses the member's hits for 5 s;
  - the crossing: its time at the end plate, its blind share and its road, against `egCrossMinMs`
    (`egFairMeasure`, kept on the member's record).
  The door of a span, a Brink or the Deepway's way down opens to a fair arrival (`doorOpener`). The same holds for
  `down`, a cache (and so THE GOLD RUN's arrival), the Low Road's niche, a Memento carried and set, the Reliquary Vault and
  the High Road's cache. After the room is woken mid-hall (`egFairWoke`), the first arrival opens the door when no saved
  trail is fair, its measure saying `wake`.
- **ONE JUDGE FOR EVERY SHAPE** (`net/bossRef.js` `judgeShapes`, beside the gate's, the Remnant's and the serpent's). Every
  blow the Spire says carries its FULL stamp, so one judge tests a lane, a cone, a ring, a disc, the whole floor or
  outside the havens. It judges each blow per fight floor (`egFightFloorAt`, section 11.7's band), deep in it (THE WIDTH
  RULE's margin) both before and after the landing on the shared-time trail, each blow once a body. A plain blow's
  share is counted; an element's is seen (the member's save is its own). The hall's own hazards are judged at their
  landing on a fight floor (`judgePlace`): a Rampart's vents, the fragments' live parts aimed at a fight floor, the
  Eclipse. The basalt, the cascade and the hammers count; fire is seen.
- **THE BODY COUNTED, ENFORCED** (`net/eliteGates/egBrain.js` `egCount`, `EG_BODY_ENFORCE`). The Spire enforces whatever the gate's
  `BOSS_BODY` line says, with the hub's depth and pace. The judge's hits, the hazards' and each cast-back (a tenth, never
  below a quarter) are taken off the member's count (`net/bossBody.js` `bodyStruck`) and kept in its census (`cs`).
  A count at nothing is the member's fall: one life, the witness, the Memento, said `bd` to it alone. Its own word
  (`vt`, `egBodyWord`) is believed out of its budget, and the room's heals restore it (`egCountHeals`: a rest whole, a
  Rally, a Mending or a niche healed, the fray's lash never the last, a recall a new life). The client says its body at
  INT15's pace. It hears `bd` as a fall, never a death (`countFell`, the Hour's `bossCountFell`'s twin, through
  `egClient.word`).
- **THE UNION FLOOR, IN TIME** (`net/eliteGates/egFloor.js`, new). `egUnionHolds` moved whole from `net/eliteGates/egShape.js`, where layer one
  had built it, under the page's name. It is widened by the place: a Rampart vent's every eruption and a fragment's live
  parts on a fight floor land in the set beside the blows (`egPlaceLandings`). Pinned: a vent erupting first holds the
  ring that alone would leave a way out.
- **RIDDEN POSES** (`pl` in `net/wire.js` `validPose`; `egRideOf`, `egRideAt`, `egRideHolds`). A pose on a Drift, a Rail
  or a Drum carries `[i, dx, dy, dz]`: the piece and its offset from the piece's top. The relay judges it at the piece's
  clock position at the pose's shared time, its offset held to the piece's top. A screen draws a peer's ride on its piece
  at its own clock (`net/online.js` `rideAt`, set by `egClient`), and lays its own on each pose (`poseRide`).
- **THE FEINT'S CUT, WATCHFIRE'S TELL, THE UNTELL** (`net/eliteGates/egBodies.js`, `net/eliteGates/egLords.js`). Every lord's chosen blow is
  committed `EG_TELL_LEAD_MS` (400 ms) before its wind-up begins. Meanwhile it is told (`tell`) to a Watchfire holder
  and each member within 12 m of it, at the rank's lead (Far Watch's 50 ms more, never past the 400). It is said to all
  with no feint flag. A feint is cut at `EG_FEINT_AT` of its own wind-up (`ecut`, pinned to `ai/tells.js` `TELL.FEINT_AT`).
  A told blow that THE UNION FLOOR holds is untold (`untell`) to each it was told. A screen sounds a blow's WIND only
  past FEINT_AT and uncut, and draws a told blow as a pulsing red outline until its word.

**Fixed on the way.** A wind-up floored by THE WIND-UP FLOOR kept its old landing, so a screen saw only the unfloored
wait. A blow's word now never shows less than its whole wind-up, however late it is said.

**Departures, said plainly.**

1. The time law subtracts the delay the member's own clock says (`h`, at most 300 ms). The page's "`ts` plus the
   socket's offset" alone places a pose at its send time plus the quickest way here, which counts the very dodge the
   page pins. The delay is the member's word, held to the judge's own 300 ms window.
2. A backdated stamp is dropped as out of order, not clamped.
3. Support is the spec's law geometry, never the collider. A belt carries under the push's allowance, and is
   not ridden.
4. The lead is every lord's chosen blow, its fury chain and its extras. The errands' place-tied blows (the Twins'
   Crossing, a Burning Perch) and every CHECK keep their own time; the legion's and the place's blows are never told.
   A tell goes at the beat its lead comes due, and its `sh` lets a screen draw it from the lead.
5. The fight's words keep layer one's `e` prefix: the page's `{k:'cut', i}` is `ecut`. `tell` and `untell` keep the
   page's names.
6. The span's own Pendulums and Vents stand on traversal ground no aimed blow reaches, so they share no union set.
7. A plain blow's whole `p` is counted, its points never.
8. `bd` is said once, never told again (AUDIT INT11's `bodyTellOwed` is the three game-held fights'). A breach's fall
   is the director's own (`egFall`): the company (`co`) it sends carries it, and a screen that missed `bd` enters its
   witness from its own record there. `int_lane3_audit`'s pin of the body's word bucket counts four rooms now.

**The four hosts.**

- `src/scenes/world.js` - FLAGGED: it needs no wiring, since `bd` reaches `egClient.word` through `online.onEg`.
- `src/scenes/worldModes.js`, `src/scenes/dungeonContext.js` - unchanged.
- `src/scenes/exterior.js` - unchanged (offline, section 28).

**Pins.**

- `test/net/eliteGates/egint_relay.test.js` (11) and `test/net/eliteGates/egint_client.test.js` (5).
- `tools/mutants/egint.json` (64, every one dead).
- Moved: `egplay_relay`'s `EG_KINDS` (`vt`, `clk`), and its door and `egplay_client`'s now walked to (THE FAIR TRAIL
  refuses a teleport); `egfull_law` imports the union floor from `net/eliteGates/egFloor.js`; `egfull.json`'s union mutant
  re-aimed there, and `egfrag.json`'s High Road cache re-aimed by content (the fair trail's ask on its line) - both
  judged again, both dead. `int_lane3_audit`'s count of the rooms that keep a body's word on its own bucket: four.
- `RELAY_VERSION` `world197`, rehashed with `net/eliteGates/egFair.js` and `net/eliteGates/egFloor.js` in its graph.

### EG-H3 - 2026-10-12 - THE BOSS SEAM, THE COURSE AS DATA, THE SWAP'S BUILD

EG3, EG4 and EG10's THE SWAP, built (Mac: "I said I want everything"). The relay's three bosses now run through one
contract, the Unmoored Steps' course is data that every reader takes, the Hour and the Spire keep one platform clock and
one Orrery judge, and a new circle is stood in place from a level built while the Court rests.

**What shipped, by piece.**

- **THE BOSS SEAM** (`net/bossSeam.js`, in the relay bundle). The contract is section 13.1's seven members: `new`,
  `join`, `hit`, `step`, `stateOf`, `judge` and `earned`. `bossSeam(name, members)` refuses a boss that lacks one and
  carries nothing else. `GATE_SEAM`, `SD_SEAM` and `SERPENT_SEAM` re-plug the Warden, the Brass Remnant and the Sea
  Serpent.
  - Where a brain's shape already was the contract's, the member IS the brain's own function (the same reference).
  - Where it was not, a thin map hands the brain exactly the arguments the host handed it before: the births (`new`
    takes the brain's own birth record), the gate's and the serpent's refusals (`o.admits`, the serpent's `o.hl` and
    `o.near`), and the serpent's zone (`o.z`) and a hand's own weapons (the blow's kind 1).
  - `server/src/index.js` calls every boss's birth, join, blow, beat, state, judge and earning through its seam.
- **THE GOLDEN FRAMES** (`test/net/eliteGates/egseam_law.test.js`). A gate's court, an Abyss Dungeon's realm, its Orrery and a
  serpent's cell are played through the real Room, on a seeded clock and a seeded die, with the count enforced. Every
  word each says is hashed whole. The four hashes were taken on the tree before the seam (4f0e71965) and stand
  unchanged after it.
- **THE TRAILS KEEP Y.** The relay's `_trailOf` hands its judges `[t, x, z, y]`: the height follows the frame's two, so
  `posAt` and `posAfter` read what they read before. `posYAt` (`net/bossRef.js`) reads the height where a body stood,
  for section 11.7's per-floor judge.
- **THE COURSE AS DATA** (EG4).
  - `courseOf(spec)` (`net/eliteGates/egSpanLaw.js`) lays a course record, `{ steps, checkpoints, end }`, the Steps' one step
    shape, from sections of pieces: a gap, a size, a riser's rise, a checkpoint after its section, a descent to nought.
  - The Hour's course is `SD_COURSE = courseOf(SD_COURSE_SPEC)` (`world/superDungeon/sdSteps.js`), byte for byte the course
    `layCourse` froze at import. `SD_STEPS_COURSE`, `SD_CHECKPOINTS` and `SD_COURSE_END` are its fields.
  - Every reader takes a course, the Hour's by default:
    - the ghosts (`sdGhostStepsOf`, `sdGhostVertices`, `SdStepsPass`). The pass's uniform count is now a maximum,
      `SD_GHOSTS_MAX` (the Hour's fifteen), and a course with more draws its first fifteen;
    - the waystones (`sdWaystonesOf`) and the vane (`sdVaneAt`);
    - the checkpoints' islands and floors and the breath (`buildChecksModel`, `checkFloorTris`, `buildBreathModel`);
    - the rewind's edges and eye (`sdRewindEdgesOf`, `sdCastBackSeen`, `createSdFx`'s `course`);
    - the hang (`sdHangIslandsOf`, `buildHangModel`'s `islands`, `createSdHang`'s `course`);
    - `spanAt`, `inBreath`, `castBackTo`, the riders (`createSdSteps`'s `course`) and `abyssLab`.
  - The record's byte-for-byte pin hashes the course and every reader's output, taken before.
- **THE PLATFORM CLOCK, ONE HOME** (section 29). `stepAt`, `beatStands`, `beatBlinks` and `beatWarned` moved whole into
  `net/eliteGates/egSpanLaw.js`, on the two laws the Spire's pieces already moved by: `egDriftDx` (a Drift's swing) and `egBeatAt`
  (a Beat's place in its cycle). `egPieceAt` reads the same two. The Beat's blink joined the Beat's and the Crumble's
  numbers there (`EG_BEAT_BLINK_S`), and `world/superDungeon/sdSteps.js` re-exports all of them as it always named them.
- **THE ORRERY'S ONE JUDGE.** `orreryJudge` (`net/superDungeon/sdBrain.js`) is the realm's judge, extracted whole: the settle, the
  Concord, THE STONES' RIGHTS (a turner held is told to wait), and the turn and its turner counted by the road. The
  Hour's realm (`_sdTurn`) and the Spire's Athenaeum (`net/eliteGates/egBrain.js`'s `pz`, with no rights) both judge by it. The
  Hour's every hall word is pinned by the golden Orrery. `orreryOf`'s widening was layer one's.
- **THE SWAP'S BUILD** (EG10).
  - `world/eliteGates/egCircleParts.js` builds a circle's made level apart from the screen: its halls' mesh, the collider's
    triangles, its lamps and its portcullises, under the mode machine's own key (`egCircleKey`). The builders are the
    stand's own, so the build is byte for byte the level the stand makes.
  - `world/eliteGates/egCircleWorker.js` runs that build off the main thread (a circle's mesh is 30-70 ms in one task, and its hall
    law's solver as long again) and transfers its buffers.
  - `scenes/eliteGates/egSwap.js` schedules it, one build at a time keyed by the circle: asked, building, ready, handed over once.
    Asking for another drops the one held. A worker that errors, or answers another circle, offers no build again until
    the breach's end.
- **THE SWAP IN PLACE.**
  - While the Court rests, the client asks for the next circle's level (`egPrebuild`).
  - When the step is due, the mode machine stands the built circle in the same level (`egSwapCircle`): the old mesh,
    portcullises, floors and draws go first (the slot emptied before what was in it is freed); then the new circle is
    uploaded, laid and lit, and the level takes its circle's number.
  - The dungeon host stands the new circle's spans (`egRecircle`). The spans' draws and buckets are tracked at their
    stand, so they leave whole.
  - The client puts my feet on the new circle's first plate under the veil it closed.
  - No exterior pixel, no landing, no world-cell hello and no new context: the presence socket stays the breach's.
  - THE FREE PINS: after twenty swaps and back, the live meshes, the collider's buckets, the hall's triangles and the
    draws are at their baseline, and no texture was uploaded again.
- **THE FALLBACK.** A build still in flight holds the step `EG_SWAP_WAIT_MS` (1.5 s). A build not ready by then, no
  module Worker, or a failed worker each step the old way: out under the veil and in again. The build is never made on
  the main thread, because a hitch in the rest is worse than the step it would save. Walking out of the breach forgets
  the build and ends the worker (`egSwapDrop`).

**Where EG-H3 departs from this page, said plainly** (numbered as they now stand: its departure 3, closed by EG5 +
EG-ZK,
is gone, and the later ones moved up one).

1. The seam's `judge` is `(f, bodies, now)`: each body carries its trail (`tr`), so the page's `judge(f, blow,
   trails)` is that call. `new` takes the brain's own birth record, not a `profile`. `hit` answers each brain's own
   answer (the damage taken, or the serpent's words).
2. The gate's crystals, host and heals and the Remnant's Echoes and Hearts stay each brain's own blows beside the seam.
3. The trails keep y, which section 11.7's per-floor judge reads (`net/eliteGates/egFair.js` `egFightFloorAt`, from
   `net/bossRef.js` - EG-H1). `posAt` and `posAfter` still hand the judges two coordinates, and `posYAt` has no reader.
4. The motes (`render/superDungeon/sdMotes.js`) still read the Hour's `SD_COURSE_END`, baked into their shader. Their sky is the
   Hour's own, over its own void.
5. The Spire's spans ride `scenes/eliteGates/egSpan.js`, not the Hour's riders (`createSdSteps`).
6. **THE SWAP is still a circle a level** (EG-PLAY's second departure, narrowed). The five halls of a circle stand in
   one
   level, and the pull between them is still a teleport under the veil's flash.
   - What is new is the step into a NEW circle: a swap in place of a level built during the Court's rest. That is the
     window before a new circle; a hall's closing builds nothing, because a circle is the unit.
   - At most two circles are resident: the stood one and the built one.
   - The 4 ms slicing is not needed, because the build runs off the main thread.
   - The new circle's hall specs come with the build: the worker lays them and the page takes them as given
     (`net/eliteGates/egLaw.js` `egSpecGive`), a hall a frame of the Court's rest (AUDIT EG V).
7. Nothing of the swap has run in a browser: there is no Daggerfall data in the build container. The swap in place is
   run from `scenes/worldModes.js`'s and `scenes/dungeonContext.js`'s own source over a counting renderer and the real
   collider. The client is played against the relay's real Room, with the worker run in-process.

**The four hosts.**

- `src/scenes/worldModes.js` - WIRED: the swap's build (`createEgSwap`), `egPrebuild`, `egSwapCircle`, `egSwapDrop`,
  and one portcullis stand for the stand and the swap (`egGateStand`).
- `src/scenes/dungeonContext.js` - WIRED: `egRecircle`, the spans' draws and buckets tracked at their stand.
- `src/scenes/world.js` - FLAGGED: untouched and needs nothing; the client reaches the swap through the mode machine's
  doors.
- `src/scenes/exterior.js` - FLAGGED: untouched (offline, as section 28 has it).

`scenes/eliteGates/egClient.js` asks the build at the rest, swaps in place and falls back. It is a helper the hosts call, not a
fifth host.

**Pins.**

- `test/net/eliteGates/egseam_law.test.js` (8) and `test/world/eliteGates/egswap_client.test.js` (8).
- `tools/mutants/egseam.json` (66, every one dead).
- Records of other arcs whose quoted lines moved, re-aimed by content and judged again, every one dead (39): `egspan`,
  `int_lane3`, `int_lane3_audit`, `sd6b`, `sd7a`, `sd7b`, `sd8b`, `sd8c`, `sd9a`, `sd10b`, `sd11a`, `sd11b`, `sd18a`,
  `sd25_steps`, `serpent1`, `serpent1_audit`, `serpent4`, `wb3` and `wb8b`.
- Source pins moved to the seam's calls, each `PIN MOVED`: `auditwbx`, `sd8b_fight` (and the relay graph's order),
  `sd8c_remnant_page`, `sd9a_receipt`, `sd18a_marks`, `sd20a_fight`, `serpent4` and `wb8c_gate_detail`.
- `RELAY_VERSION` `world197`, unshipped, rehashed: `net/bossSeam.js` joins its graph where `net/bossRef.js` walked, and
  `net/eliteGates/egSpanLaw.js`, `net/superDungeon/sdBrain.js`, `net/bossRef.js` and `net/eliteGates/egBrain.js` changed.

### EG-G1 - 2026-10-12 - THE HUD, THE BEATS AND THE FIRST BREACH

Closes the HUD's half of layer one's fifth departure: the arrival card, the first-time lines, the accessibility settings
and touch and the pad, with the HUD, the panel and the recap no longer plain DOM text. The score, the mix and the band
art stay the look's (EG16, EG17).

**What shipped, by piece.**

- **The HUD by form factor** (`ui/eliteGates/egSpireHud.js`, section 27.1). `egFormFactor` reads the screen: a short side of 560 px
  or less is a phone, upright or sideways. It is pinned at 1280x720, 390x844 and 844x390. `EG_LAYOUTS` gives each
  layout its parts:
  - a desk: the count's chip and the Reliquaries' beside the compass, the decrees under them, the potion pip, how many
    stand, and the objective chip;
  - a phone held upright: one 18 px tabular chip (the count and the Reliquaries), and the decrees folded to a tappable
    *2 decrees*;
  - a phone held sideways: the count's chip and a 44 px lord's bar, with the decrees on the arrival card.

  The hall and its band are on the arrival card alone, and the company's state on the party rows. Every part reads
  `--hud-scale`, copied off `.hud` as the arena's bar does. The HUD is DOM in both skins, like the gate's bar, the
  arena's and the sea's: it is a readout, not one of DFU's windows. The classic skin dresses it in DFU's own text colour
  and shadow (`ui/native/nativePanel.js` DEFAULT_TEXT_COLOR and DEFAULT_SHADOW_COLOR) over the gate's classic face. The
  enhanced skin uses its pixel face on the kit's plates. Inside a breach the old tracker (`ui/eliteGates/egHud.js`) gives way to it,
  and stays the call's outside.
- **THE COUNT CHIP** (`egCountChip`, section 27.2).
  - mm:ss in tabular figures: gold above 10:00, white to 2:00, red below, and a 1 Hz pulse in a running count's last
    30 s.
  - *Held* with a pause glyph while the count holds. The reason is shown on the chip and never said: the Redoubt, a
    respite (the room's `respite` line still running), the door or the stair (`egHoldWhy`). The Redoubt's rest no longer
    says *The Redoubt holds the count* on the screen.
  - The last word's figure with a seal glyph when it is nearer than the count.
  - Gains fly in for 2.6 s (`egGainText`): *+15:00*, *+10:00 - the Covenant's Press* while the Press stands, *+3:00 -
    the last word* when the last word cut it, *+1:00* for THE GOLD RUN, and *Surplus +1* in blue.
  - The warnings come once a count, and a Redoubt that raises the count never arms one again (`egChipWarnings`): *The
    Covenant presses. Five minutes.* at 5:00, a toll at 1:00 and at 0:10, and *The count will not hold through the next
    Court.* `egCourtNeedMs` takes section 18's model for the last one: 140 s for each trial left (this one counted
    whole), 26 s for the Court's approach, and the lord's `ttkRef`.
- **The arrival card, the objective, the door, the lord's bar** (section 27.3).
  - The card (`egArrivalCard`): the hall's name over *Hall 12 - the Broken Galleries*, the objective beneath, the
    twist's line, and the decrees in force. A band's first hall (or the breach's own first) shows its band's name and
    line. A Court shows *Hall 15 - the Court* and the lord's card. It stands 4.8 s on the gate title card's own sheet,
    on a node of its own: the gate's card belongs to the fight (a lord's wake and fall).
  - The objective chip carries its progress (`egProgressText`).
  - The door's marker (`egDoorMarker`): the way down's bearing off my facing, on the screen's edge while it is not ahead,
    with its metres (*The way down - 42 m*), shown through the closing.
  - The lord's bar (`egLordBar`): the first true lord awake (never a mirror or a friend), its health and its phase.
- **The party rows** (`ui/eliteGates/egParty.js`; `ui/partyPanel.js` gains `setSpire`, section 27.4). Each member's row shows:
  - their numeral, I to VIII, in Battlemage blue;
  - a cracked gold sigil on the portrait once their recall is spent;
  - a grey row with an eye for a witness, an arch for home, and a struck-through name for the forsaken;
  - an amber ring draining the 180 s for a body this screen holds no pose of in a trial (`egAbsentStep`);
  - a mote where their Memento lies, and on whoever carries one;
  - *High Road* or *Low Road* in the place line while the company stands split at a fork (`egRoadOf`, by the steps'
    own `road`);
  - Fire-touched and Frost-touched as sigils.

  The panel is told the rows in its own terms (`egPartyDeco`: a numeral, the classes, a mark, a title, the ring's share
  and a place line). It paints only what moved, and gives its own place line back when the split ends.
- **Every event seen, heard and said** (`ui/eliteGates/egBeats.js` `EG_BEATS`, section 27.5).
  - The table is pinned: its seventeen events in order, each with its sight, its sound and its words, and who already
    says them (the fight's beat line, the client's chat line, the veil's own close, the score's SPIRREDT), so no line is
    said twice.
  - The sounds are Daggerfall's own records, played as the Hour plays them: the bell 107 (pitched for a toll, a low toll
    and a bell), the chime 364 (the Rare chime, `playRareDrop`'s MakeItem), the drums 374, the fanfare 32, the door 25,
    the cauldron's chord 365, and the void's moan 66 for the Steps' rewind.
  - THE WATCH (`egBeatWatch`) hears what the room newly said and replays nothing it saw at its first look: the beat
    lines, the falls, a gift, a Redoubt, a wake's twist and fork, and the last word.
  - A cast-back shows *-10%* where it cost anything. A Weir Key found rings the Rare chime.
- **THE RECAP, whole** (`ui/eliteGates/egHud.js` `egRecapModel`, section 27.6).
  - The depth (the hall, the Redoubt, the band) and the time from Hall 1's wake.
  - Why it ended, in the client's end words.
  - A strip per circle: its halls' glyphs, its lord and its falls.
  - Each member: numeral, falls, the recall kept or spent, and how they left.
  - The Vestiges, and the Accords held with any companion.
  - The Reliquaries open only by walking home or the last word, one each 400 ms with the Rare chime (AUDIT EG III: THE
    SEAL and a void open them too, `EG_OPEN_ENDS`, and the count is the service's once the end's claim answers it).
  - A member who walks home reads it too, not only the end's company.
  - The last five runs are kept on the device (`eg.recaps`).
- **The first breach** (section 27.7). `EG_TEXT_FIRST` holds the nine lines verbatim. Each is said at its first occurrence
  and never before it applies:
  - the count's at the first running trial;
  - the door's at a span's closing;
  - the void's at the first cast-back;
  - the fork's at a forked span's wake;
  - fury's at a lord's;
  - the decrees' at the first decree ask;
  - the recall's at the first fall that is not final;
  - the Memento's when one first lies;
  - home's at the first Redoubt's rest.

  Each is said once a device, in the chat and under the objective (`egFirstDue`, the bits kept as `eg.first`). The
  Rehearsal's own teaching line is said once: *A Rehearsal: Halls 1 to 5, the count and one life. Nothing is won here,
  and nothing is lost.*
- **Touch and the pad** (section 27.8).
  - While the panel, a witness's eye or the recap stands, the pad's d-pad is theirs (`egPadAct`): left and right choose
    a card or an option (the panel marks it), up takes, and down says no. A witness's left and right change whom they
    watch, and a held down forsakes (asked twice). Any press closes the recap.
  - The classic skin's pad sends its own codes. On Enhanced Plus the world host composes the gamepad's helm door, so the
    prompt bar says the Spire's rows (`egPadPrompts`).
  - Touch buttons for the witness's eye and forsaking, and for the way home at a rest (`egTouchButtons`). The panel's
    cards and choices were buttons already.
  - Haptics behind the touch layer's own `touchHaptics`: 15 ms as the Beat underfoot enters its last 0.4 s, 30 ms on a
    blow newly aimed at my feet, and a pad's dual rumble for the same two (`egBeatUnder`, `egPerilsNew`, `egBuzz`).
- **Accessibility** (`ui/eliteGates/egAccess.js`, section 25.7). Three of the port's own rows sit on the prefs shelf, under Settings >
  Accessibility:
  - `port:reducedMotion` in Motion: the row or the system's setting stills the chip's pulse, the gains' flight and the
    card's rise;
  - `port:dangerPalette` in a new Danger shapes section: Standard; High contrast (the danger edge magenta [1.0, 0.15,
    0.75], safety white-gold, the hazard cyan); Deutan-Protan; and Tritan. Each colour-blind preset is pinned to separate
    every pair by 40 delta E under its simulation (Machado 2009 at full severity, `egCvd`), where Standard does not;
  - `port:telegraphFill` in the same section: the fill's light 50-100%, with the line kept whole.

  All three are each player's own online (`systems/online/onlineLane.js` ONLINE_PLAYERS_OWN_PREFS names the one switch).

  The fight lays the palette and the fill on every shape before its telegraph pass (EG-G2's `egLookShapes` in
  `scenes/eliteGates/egFight.js`, reading `egAccessNow` - this module is the palettes' one home), and the chip's red is the
  palette's danger. The
  Examination's runes chime as each lights, pitched up its numeral (`egRuneChime`), and the numeral goes to the HUD's
  polite live region, where every beat's words go for a screen reader.
- **Words** (section 27.9). Every new line is worded once in `EG_PRES_TEXT`, `EG_TEXT_FIRST` and `EG_BAND_LINES`. The
  last word's end line is now the table's *The last word. The breach closes.*

**Where EG-G1 departs from this page, said plainly** (numbered as they now stand; closed and gone: the first-time
lines on the account and the recap's shares, chart and board line, EG-ZF; the door's compass mark, beam and ring and the
stair's reduced motion, EG-ZE; touch's three motor changes, EG-ZH; the Surplus on the pad and the beats on the critical
bus, EG-ZD; the High-contrast shapes, EG-G2; the shakes' reduced motion, EG-ZG):

1. The new words are not in `EG_TEXT`. `net/eliteGates/egLaw.js` is in the relay's bundle, so a client's word there would move the
   relay's law hash for nothing the relay reads. They are in `ui/eliteGates/egBeats.js` instead.
2. The arrival card wears `ui/gate/gateTitleCard.js`'s sheet on a node of its own, because that module's one card is the
   fight's.
3. The absent ring reads this screen's silence: no pose of theirs in my room, the same silence the relay counts. The
   wire carries no absence word, and `net/eliteGates/egBrain.js` is unchanged.
4. `port:allyEffects` (THE QUIET COMPANY) is not built: it governs allies' hit numbers alone, and the port draws none
   (`ui/hitNumbers.js`). The allies' spell effects are quieted in a trial by another seam since EG-ZG (`ui/eliteGates/egAccess.js`
   `egAllyLook`).
5. The party rows decorate the party panel's cards, so a company member who has left the party is not on them. My own
   recall shows on my chip.
6. A Weir Key found rings the Rare chime. The *Weir Key* banner is the loot banner's, and a restacked key does not pass
   through it.
7. Nothing here has run in a browser, because the build container holds no Daggerfall data. The drawing is pinned
   against a fake document, and the client against the director's own words.

**The four hosts.**
- `src/scenes/world.js` - WIRED. The party panel's `setSpire` seam, the pad's d-pad composed into the gamepad's helm door
  (`inputHooks.helm`), and a Weir Key found's chime. Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED. It has nothing to wire: the HUD is the breach client's, drawn from the online
  frame in every mode.
- `src/scenes/dungeonContext.js` - FLAGGED, for the same reason.
- `src/scenes/exterior.js` - FLAGGED as section 28 has it: offline, no breach.

**Pins.** `test/net/eliteGates/egpres_hud.test.js` (10) and `tools/mutants/egpres_hud.json` (68, every one dead). The EG-PLAY, EG-FULL
and fragment pins pass unchanged. The tracker's inside reading (`egHudModel` with `inSpire`) is kept as their words, and
the Spire's HUD draws the same facts in their own places. No other record's quoted line moved. `RELAY_VERSION` is
unchanged, because nothing in the relay's graph moved. The Ledger's ELITE-GATES row (section A) names
`ui/eliteGates/egSpireHud.js`,
`ui/eliteGates/egBeats.js`, `ui/eliteGates/egParty.js` and `ui/eliteGates/egAccess.js`.

### EG-F - 2026-10-12 - THE ARCH AND THE CALL

**What this is, said plainly.** EG9's slice, built whole: the key's eight refusals, THE START WINDOW, THE ARCH and THE
CALL. It closes EG-PLAY's departure 1 (no arch: the call and `/breach` were the door) and EG-FULL layer one's departure 4,
and the Wager half of EG-PLAY's departure 8 (the order's `wg` omitted). A Weir Key now asks where in the Spire before
any key is staked, an arch of the gate's own stone rises at the opener's feet, everyone on the opener's cell sees it, and
the company scattered across the Bay is called by a horn and a prompt and answers through a portal at its own feet.

**What shipped, by piece.**

- **The key's refusals** (section 5, in the page's order - `scenes/eliteGates/egArch.js` `egKeyRefusal`, each a line of `EG_TEXT`):
  cold; open sky; the Portal Stone's holds (`portalHold`'s five words, each worded for the key), the water and a boat;
  inside a location's footprint (*Not within Daggerfall.*); another breach near (a Dagon's Breach within
  `EG_ARCH_GATE_NEAR_M` 300 m, an arch within `EG_ARCH_NEAR_M` 150 m); a breach held (or an open in flight); the road
  shut; no room for the arch. EG-PLAY's arm had cold, sky, held and shut; the rest are the host's facts
  (`egClient`'s `keyFacts`). A guest's refusal stands second, after cold - the service's own refusal said before it asks.
- **Where the arch stands** (`egArchPlace`): the Portal Stone's `portalPlace` ahead of the opener (`PORTAL_AHEAD`), turned
  to face them, then `EG_ARCH_CLEAR_M` 8 m clear across it either way and before and behind it a metre up, with ground
  under both its feet; anything else is *There is no room for it here.* Its site on the wire (`egArchSite`) is its pixel
  and its foot in that pixel's own frame (the gate's spot's frame, the height the world frame's) and its turn, so every
  client stands it the same in its own scene.
- **The start window** (`ui/eliteGates/egStartWindow.js`): the stake (*Weir Keys: 3 - one will be staked.*; no key, the Rehearsal
  alone), the quest warning (a tracked quest's clock inside the 36 game hours of the last word), the choices - *Hall 1*
  and every Redoubt the opener may start at, deepest first, each named with the band its first hall stands in
  (*Redoubt 12 - the Shade Perilous*) and a `+` or an `x` for each member of the party in its order - the Wager's own
  list (each decree with its family; a second of a family or a fourth refused and said; *Done*), and *Rehearse - Halls
  1-5, no key*. A start some member cannot make asks once, *Go without Mara?* (DFU's YesNo box, `ui/yesNoBox.js`); a
  choice closes the list before it is acted on, and is made once. On both skins the lists are DFU's
  DaggerfallListPickerWindow (`ui/listPicker.js` - the boat variant picker's way, on the mode machine's window slot),
  which draws itself in the enhanced skin (`ui/enhanced/enhancedPicker.js`).
  STAKE-ROW (`01-Overview/bugs/Field-Bugs-2026-10-18c.md`): the stake, the keyless line and the quest warning are words;
  picked, the port's picker has already closed itself, so the main list is asked again - never no window and the key
  answering that the Spire already asks. AUDIT STAKE-ROW (`01-Overview/audits/Audit-Stake-Row.md`): the list's doors
  are the window's own (`egStartWindow.js` egStartListDoors) - a finished window in the slot (the question's box,
  answered No) given up before the list mounts, a list put off the screen unpicked a cancel; and the key used from the
  pack closes the pack, so the window has the screen when its preflight lands.
- **The preflight** (`/v1/eg/starts`, `server-account/src/egStarts.js`): for the opener and each member it names (at most
  8), the starts they may make - `src/net/eliteGates/egStartLaw.js` `egStartsFrom`, the one law both ends read: Hall 1, this
  season's Redoubts (the arena's season, `arenaSeasonOf`), else half the all-time best; null for a guest. With it the
  opener's keys, the day's Rehearsal and the relay's public half (`rk`).
- **The open carries the choice**: `/v1/eg/open` takes `ew` and `wg`, refuses `start` (a start the opener may not make:
  no carries, its own included) and `wager` (not up to three decrees of three families - `egWagerOf`, its families
  copied by number and held equal to `EG_DECREES`), and writes both into the stake (migration 0111's EG-F block, 0117
  since the merges:
  `eg_stakes.ew`, `eg_stakes.wg`) and the order (`ew`, `ewg`). Every admission is held to the breach's start (`start`,
  403), and its order names it; the three new refusal words (`start`, `wager`, `subs`) each have a sentence in
  `net/accountClient.js` `REFUSALS`. The hub hands the order's Wager to the room (`wg` on the open's tell), and a breach that
  starts at Redoubt `w` begins at the next circle's first hall (`src/net/eliteGates/egLaw.js` `egStartHall`).
- **The arch** (`scenes/eliteGates/egArch.js` `createEgArchPool`, drawn through the gate's pool - `scenes/gate/gatePool.js` `arches`):
  the gate's model at `EG_ARCH_SCALE` 0.62 (10.04 m tall, 4.79 m a side) on the gate's records' twins
  (`EG_ARCH_RECORD_OF`: 5, 6, 7 in `GATE_ARCHIVE`), its skin painted in code (`world/gate/gateArt.js` `archArt` - white marble,
  a gold inlay lattice gleaming faintly by night, the gate's own basalt veins laid through it as cracks with an ember
  banked in them; the rim's gold twice as close; the spines gold to basalt). It climbs out of the ground over
  `GATE_RISE_MS` from the opening, stands sealed, burns open, and sinks over `GATE_COLLAPSE_MS` when the first hall wakes
  (or at its end, or the open window's end - `egArchLife`); sunk whole before it rises, a beacon alone off the built
  ground. Its collider stands while it stands risen; a body it stands up around is set down before it.
- **The pass, per draw** (`render/gate/gatePass.js`): the membrane's tint and scale and the beacon's height, foot under the
  ground, light's start and colour are set inside the loop (`gatePassValues`); `GATE_PASS_MAX` is 4. The arch's beacon
  is gold, 400 m over its foot, its light from its own lintel. THE GATE'S OWN DRAW IS WHAT IT WAS: its record names none
  of them and takes the gate's (scale exactly 1, tint exactly white, 400 under, 1200 tall, the literal's own foot,
  `BEACON_COLOR`), and the per-draw sources are the gate's own templated - written back with the gate's values they are
  `MEMBRANE_VS` ... `BEACON_FS` byte for byte, which the Hollow's omen still builds from.
- **The clear sweep's keys** (`world/gate/gateClearance.js`): a clearing is the gate's or a set (`gateClearSet` - the gate's
  and every standing arch's, `EG_ARCH_ROCK_M` 14 m about each foot, keyed by breach id); a built pixel is built again only
  for what changed - an arch come that its pieces reach, a clearing gone that cost it something - and the gate alone
  keeps its one key, sweeping as it did.
- **The call** (section 6.4): the hub signs the call's arch fields with the receipts' key (`src/net/eliteGates/egCallSig.js` -
  `ec1` leading the signed bytes) and says `ew`, `wg` and `sg` with it. Each member's client sounds a horn (`scenes/eliteGates/egCall.js`
  `buildEgHorn`, a war horn's rising call made in code), writes the one line *<opener> opens an Elite Breach.*, and shows
  the prompt (`createEgCallPrompt`, the duel challenge's strip's shape): *The breach opens in 4:12.* while sealed,
  *Answer the call - 4:12* while open (Enter, the pad's A, or the strip's button), *Answer from open ground.* indoors,
  gone under any window and back when it closes, gone once answered or the window over. Answering asks `/v1/eg/admit`;
  the order in hand, the Portal Stone's portal opens at the member's feet for `PORTAL_OPEN_MS`
  (`createEgCallPortal`, the Portal Stone's own pool, its holds keeping it shut), and stepping into it is the admission.
  A portal that closes unused leaves the prompt to stand again. The opener steps through the arch itself (or presses it);
  anyone outside the company is told *The breach answers only to <opener>'s company.* Late: *The breach has closed
  behind <opener>'s company.* - after the window, and when the room refuses an answer after the first hall woke.
- **Strangers see it** (section 23): the opener's foes frame carries the signed arch fields (`ea`) while the opener
  stands within `EG_ARCH_SAY_M` of it; a stranger believes one only near the opener's own feet, one an opener, at most
  `EG_ARCH_PER_CELL` two, and only once the hub's signature verifies against the relay's public half. A forged one stands
  nothing.
- **The landing**: the opener lands before the arch (`world/gate/gateArena.js` `gateLandingFor`, widened to take an arch
  record - its site and its turn), `EG_ARCH_LANDING_M` out; everyone else where they answered (the portal's step is the
  mode machine's own `from`). The room keeps the arch's site, and its whole state (`st`) carries it.
- **The Timers row, the sight line, the map mark** (section 2): `systems/eventTimers.js` gains the kind `'elite'`, the
  company's alone - *Elite Breach opens* while sealed, the window to answer, then *Hall 17* and what is left on the count;
  *You see an Elite Breach 140 metres to the North!* once an arch, by the Elite Dungeon's own law (`world/spawnedDungeons.js`
  `sightLineOf`); the company's arch on the held map (`ui/eliteGates/egArchMapMark.js`, the gate's ring's painter in the arch's gold)
  and on the enhanced compass (the gate's diamond in gold).

**Where EG-F departs from this page** (said plainly):

1. **The order's Wager rides `ewg`, not `wg`.** `wg` is INT9's remains order's guild (`REMAINS_FIELDS`), and the order
   fields are exclusive by kind; the room's tell, the `st` frame and the receipts keep `wg`.
2. **The relay's public half reaches the clients through the account service** (`rk` on `/v1/eg/keys` and
   `/v1/eg/starts`, its `GATE_PUBLIC_KEY`): the page says peers check `sg` and not with what, and the relay holds its key
   non-extractable. A guest asks neither and so stands no stranger's arch.
3. **The cell word rides the opener's foes frame** (`ea`, as the Portal Stone's `pg` does), not a frame of its own; the
   call and the word carry the opening `op`, from which `riseAt` and `openAt` are the clock's (`egTimes`).
4. **A stranger's arch sinks at the open window's end**: only the company hears the first hall's wake, so only its arch
   sinks then.
5. **The band a start is named with is its first hall's.** The page's example names *Redoubt 12 - the Soul Cairn*; a
   breach started there begins Hall 61, in the Shade Perilous, and the window says so.
6. **A deeper start's first circle stands under the Proclamation and the Wager alone**: no circle's decrees were chosen
   for it (the rest that chooses them is a Redoubt this breach never stood).
7. **The prompt is a strip, not a native window**: the duel challenge's precedent, on both skins.
8. **Refusal 7 is the hub's `egOk`** on the client; the hub's live cap and drain are its own refusal of the open.
9. **Found, not fixed (another arc's)**: `ui/hud/hud.js` hands the enhanced compass neither the sea serpent's mark nor the
   Abyss Dungeon's - world.js passes `serpent` and `sd` and the classic HUD's options drop them. The arch's `arch` is
   passed through.
10. Nothing here has run in a browser: there is no Daggerfall data in the build container. The pieces are tested headless,
    the client against the relay's real Room.

**The four hosts.**

- `src/scenes/world.js` - WIRED: the arch pool made beside the client and handed to the gate's pool (its frame, world pass,
  foreign pass, lights, eye boxes, plaques and presses); the key's facts (`portalHoldNow`, the water, a boat, the location
  rect, the gate's place, `egArchPlace` over the collider's probes); the start window's three doors; the call's portal
  (drawn with the Portal Stone's, `scenes/portalGates.js` `drawAlso`, PORTAL1's flats line unmoved) and its prompt; my arch on my foes frame (`portalWord`) and a peer's
  through the street's pool (`exteriorFoes.setOnEgArch`); the Timers row, the held map, the compass (`frameHud`'s own
  object); the clearing's set (`_gateClearNow`). No statement joins `function frame(now)`.
- `src/scenes/worldModes.js` - WIRED: `enterEgHall` takes the opener's `landing` as the way out's (`dungeonReturn.from`).
- `src/scenes/dungeonContext.js` - FLAGGED: the arch stands in the open world alone; a dungeon has none and asks nothing.
- `src/scenes/exterior.js` - FLAGGED: the `?exterior` bench is offline; the key says *The key is cold here.*

**Pins.** `test/net/eliteGates/egarch_law.test.js` (8), `test/net/eliteGates/egarch_client.test.js` (7) and `test/net/eliteGates/egarch_service.test.js` (3).
`tools/mutants/egarch.json` (75, every one dead). Records of other slices whose quoted lines moved, re-aimed by content
and judged again: `gateclear.json` (the sweep's turn), `auditwb_world.json`, `gateseen.json` and `wb2.json` (the gate
pool's doors). Pins moved, each said so: `test/net/eliteGates/egplay_service.test.js` (the keys' answer carries `rk`; `EG_ORDER_FIELDS`
gains `ewg`) and `test/world/gate/wb2_gate.test.js` (the cap, now 4, met by six gates). `RELAY_VERSION` stays `world197`,
unshipped, rehashed with `net/eliteGates/egCallSig.js` in its graph. `ACCOUNT_VERSION` stays `acct121` (`acct136` since the
merges); migration 0111 (0117 since) gains the
EG-F block; `.github/workflows/account-deploy.yml` lists `src/net/eliteGates/egStartLaw.js`, which the account Worker bundles.

### EG-H2 - 2026-10-12 - THE MADE LEVEL'S RULES AND DURABILITY

Layer six's first part (EG-H): EG7 (section 24) and EG8e (section 22), with EG10's DEATH-PENALTY exemption, the flight
bans and the technique refusal, and the jump buffer. Closes layer one's departure 6 for `madeLevelOf`, `MADE_LEVEL_RULES`,
the jump buffer, the technique refusal, the slowfall ban, AvoidDeath refused, THE HOLD and THE DRAIN.

**THE MADE LEVEL'S RULES** (`systems/madeLevel.js`). One law in place of the per-level checks at every rule's door:
- `madeLevelOf(loc)` answers `'court'`, `'hour'`, `'spire'` or null off each made location's own predicate (`isGateArena`,
  `isSdRealm`, `isEgHall`), and the mode machine says it (`madeLevel` in scenes/worldModes.js, the dungeon mode's alone).
- `MADE_LEVEL_RULES` is section 24's table as data, twenty rules a row (null where a level leaves the game as it is):
  saves, rest, the map, the Mark, the Recall, the Portal Stone, companions, regeneration, THE POTION LAW (`'counted'`),
  Levitate, Slowfall, a technique's flight, the jump buffer and the late press (0.12 s each in the Spire, 0 elsewhere),
  Resurrect, AvoidDeath, what a death is, DEATH-PENALTY, /unstuck, and the voice a refusal is said in. `MADE_LEVEL_TEXT` is
  each level's refusals in its own home's words (COURT_TEXT, SD_REALM_TEXT, EG_TEXT), unchanged.
- `registerMadeLevelHere` is the world host's word on where the player stands, and whether its feet are on the Spire's
  traversal ground (scenes/eliteGates/egClient.js `onTraverse`: in a hall of the circle and off its fight floor, or over the void
  between the halls). Doors with no host in reach read it: the potion law, a technique, the motor's forgiveness.

**The doors, re-plugged.**
- `scenes/dungeonContext.js` reads `madeLevelRule(_made, ...)` once per rule: the save door and the pause's Save, the M
  key and the map's record, the rest, the slow fall (written false in the Spire - the effect runs on), the avoid-death
  consult, and the death screen's `penalty`.
- `scenes/world.js` reads `madeRuleHere(...)`: both companion doors, the Mark and the Recall (said through `madeSay`, the
  Hour's voice or the mid-screen line), the respawn's DEATH-PENALTY and its death branches, /unstuck, the ONE Levitate
  ward (section 10.7 - EG-PLAY's second seam, `registerSpireLevitateWard`, is retired), the frame's one
  `setCourtRules`, Resurrect, and the Portal Stone's door. It registers the law's word and THE FORGIVENESS.
- `systems/eliteGates/spireKit.js` (THE POTION LAW) and `combat/techniques.js` (the flight's refusal) ask it too.

**The Burning Court and the Hour, unchanged.** Every value in their two columns is what their doors did at 4f0e71965,
pinned rule by rule (test/systems/eliteGates/egmade_law.test.js) and by their own suites, whose pins moved to the law with `PIN MOVED` notes:
sd5a, wb3b, sd21, gatecrowd, gatefbx, sd11c, sd12, sd20f, sd26, sd27, sd7b, audit_seats_client, auditwatchkit_net,
arena2_hosts, mapkeep, wbx_gate_fixes, deathpenalty and donline1_respawn. Twenty-nine of their mutant records were
re-aimed by content, every one dead.

**The Spire's rules, built.**
- **THE FORGIVENESS** (section 10.8; `player/motor.js` `registerJumpForgiveness`). A jump pressed in the air up to the
  buffer before landing fires on the landing, past DFU's 0.1 s gate. A plain jump pressed up to the late press after
  walking off an edge still leaps. With nothing registered, or 0, the gate is DFU's verbatim. Measured on the real motor:
  a tap 0.08 s before landing fires on it, and a press 0.05 s off an edge rises. Both are swallowed in the court and the
  Hour.
- **The technique's flight refused** (section 10.7). A leap or a dash on the Spire's traversal ground is refused in the
  Spire's words (*The Spire's spans are walked, not flown.*), with nothing paid. On a fight floor it is a technique.
- **The slow fall banned**, and **AvoidDeath refused**: Stendarr does not reach into the Spire.
- **DEATH-PENALTY exempted** (EG10). EG-FULL's death save makes a killing blow a fall, so only a death no save is asked
  of reaches the death screen in the Spire (the exhaustion collapse, a drowning's SetHealth(0)). Its screen states no
  loss, and its respawn takes none. EG-PLAY's departure 9 is closed.
- The pause's Save now refuses in the Spire, as the save door always did (it had never asked the Spire). A Resurrect is
  refused there, and the frame's court law covers the Spire's whole frame.

**DURABILITY** (`net/eliteGates/egDurable.js`, in the relay bundle; `server/src/index.js` `_egOf`, `_egResume`, `_egTick`).
- **Saves to storage** were already at the open, every admission, stage, fall, pick and end, and every CHECKPOINT_MS. But
  **every trial's checkpoint threw**: the director kept its beat's closures on the fight (`F.legionCtx`), so the record
  could not be structured-cloned, and storage held the hall as it woke. The context is now unenumerated, and a trial's
  save lands (pinned). At a Redoubt the receipts are kept in storage before they go out.
- **Time across a restart.** The room stamps each beat (`tk`). A room woken from storage, or a beat that comes late, gives
  the gap back (`egGiveBack`): every instant the record holds after its first wake moves forward. That covers the count,
  the stage and hall clocks, the lords' and the legion's timers, and each member's absence. The open never moves (the
  last word is the wall clock's, as the service's live window is), and nothing moves before the first wake.
- **THE HOLD.** A room woken between trials (a closing, the swap, a rest) holds from its last beat: the count frozen, the
  director still. It waits until every living member's body stands in the room again or EG_REJOIN_MS (180 s) has passed,
  then gives the whole gap back and runs on.
- **THE DRAIN and THE COST.** The hub keeps its live list (`eglive`: each breach's law and last word) and answers the
  public `/v1/eg/live` (counts, `between`, `laws`, `until`, `drain`, no breach named). With the relay setting `egDrain`
  'on' (a developer's `/relay egDrain on`, or the `EG_DRAIN` var), or EG_LIVE_MAX (64) live, the hub refuses an open with
  *the road is shut*. It mints the opener a `v` receipt at once, so the stake the service took comes straight back. The
  relay deploy (.github/workflows/relay-deploy.yml) reads `/v1/eg/live` after the siege blackout: a live breach under a
  law the build does not draw is THE DRAIN (it waits five minutes at a time for none live or the longest's last word);
  otherwise THE HOLD (it waits up to twenty minutes for every breach to stand between trials).
- **THE LAW PIN.** `EG_LAWS` (`{ 4: '2026-10-11' }`, a law kept EG_LAW_KEEP_DAYS) names the laws this build draws. A
  woken room whose `egv` is not among them ends its breach with `why: 'void'`: the entered members' end receipts return
  the stake, the opener who never entered is handed a `v`, and the Redoubts taken stay. A member's `spec` is answered
  with that hall in the breach's own law's bytes (this circle or the next). A client whose law is not its breach's asks
  each hall of its circle once and is told once, and while the Court rests the next circle's too (AUDIT EG V, E NEW-2).
  A hall given is its ground's: asked and counted under the ground it was laid on. The halls given are read before any draw (net/eliteGates/egLaw.js `egSpecGive`),
  and the circle standing is built again once all five have come. They are forgotten on every way out of the breach -
  the walk out, the frame's way out and away (`egSpecForget`, `scenes/eliteGates/egClient.js` lawForget; AUDIT EG V).
- **Secret, deterministic receipts.** The room draws `rs` (32 bytes) at the open and never sends it. A receipt's seed is
  HMAC-SHA-256(rs, sub|R|kind)'s first 32 bits, so a room woken before its save mints the same roll again. A breach opened
  before this keeps the CSPRNG's seed.

**Departures, said plainly.**
1. **Section 24's table had the court refusing a Recall.** It never has: the court refuses the Mark alone (World-Bosses.md:
   "Recall's mark"). Re-plugged unchanged, the law says so.
2. **The deploy does not ask a room to hold.** An unauthenticated ask would let anyone freeze a breach. The room holds
   itself on the restart it wakes from, so the deploy only waits for every breach to stand between trials. That keeps the
   page's rules of the count held and the gap given back.
3. **THE DRAIN's road is shut by a developer** (`/relay egDrain on`, and `off` after the deploy - the hub keeps it across
   one). The deploy cannot sign a hub frame, so it waits on `/v1/eg/live` and says the setting in its log. The hub refuses
   the open after the service has staked the key, so each refusal hands the stake back as a void at once.
4. **Every law's generator is kept.** `net/eliteGates/egLaw.js` `egHallOf(seed, h, geo, law)` builds each law in `EG_LAWS`
   (`net/eliteGates/egDurable.js`: law 4 then; EG-ZC kept law 4's beside law 5, AUDIT EG III's law 6 joined them, EG-HERO-LAY's law
   7 after it, and every law since joins the same way), so a breach keeps its own halls through a later spec. A client
   that does not know its breach's law rebuilds a circle drawn before its given halls came, under the veil. Its next circle draws from them at once. Under another law the swap's
   worker builds a circle only from its five halls as the room gave them, handed over with the ask (AUDIT EG V, E NEW-2:
   `world/eliteGates/egCircleParts.js` egCircleBuild takes them as given before anything is laid - the worker's module holds no hall
   this thread was given), so the next circle, its halls asked while the Court rests, swaps in place as a circle of this
   build's own law does. A circle whose five are not all given under its ground (the next circle's span decrees moved it)
   steps the old way, from this thread's halls. A circle stood from its five given halls is the breach's own and is never
   built again; the rebuild is counted done only once its step has run.

(Its fifth and sixth departures are closed and gone: THE FAIR TRAIL, the clock correction and the ridden poses by EG-H1;
the open's retry, the client's void, the unknown room's tombstone and the `force` deploy by EG-ZA; the Ledger row names
THE FORGIVENESS - the jump buffer and late press - and AvoidDeath refused.)

**The four hosts.** `src/scenes/world.js` WIRED: the doors above, the law's word and THE FORGIVENESS registered, the
one ward. `src/scenes/worldModes.js` WIRED: `madeLevel`. `src/scenes/dungeonContext.js` WIRED: the doors above.
`src/scenes/exterior.js`: unchanged - the fixed city stands no made level and registers no word, so every door there is
the game's own.

**Pins.** `test/systems/eliteGates/egmade_law.test.js` (5) and `test/net/eliteGates/egdur_relay.test.js` (5). `tools/mutants/egmade.json` (58, every one
dead), with twenty-nine records of other arcs re-aimed (`audit27h`, `audit_seats_client`, `auditclimb1`, `auditcrew`,
`bounty1`, `egplay`, `fb1011b`, `gatecrowd`, `gatefbx`, `macd`, `sd11c`, `sd12_onelife`, `sd20f`, `sd21_alone`,
`sd27_audit`, `sd5a`, `sd7b`, `wb3b`), every one dead. `RELAY_VERSION` `world197`, unshipped, rehashed with
`net/eliteGates/egDurable.js` in its graph.

### EG-G2 - 2026-10-12 - THE LOOK AND THE SOUND

Closes EG1's two rows, EG16 (all but the arch's skin, which is the arch's slice's), EG17, and what EG-D still owed the
screen: the band art, `world/eliteGates/meshKit.js`, `world/eliteGates/pseudoArchives.js`, the moving pieces' pass with its cull and measured
budgets, the Rail's dashed track, the Gust's streamers, the waystones lit, the mist drawn, and the band's dress where
the Hour's records stood. Section 25.7's settings rows are the HUD slice's (EG-G1): this slice reads their shelf keys
and draws what they choose.

- **THE GATE'S TIERS** (`systems/gateTier.js`, a leaf importing nothing). `GATE_TIERS`, `GATE_TIER_TEXT` (Regular
  *Dagon's Breach*, the words it always had; Elite *Elite Breach*; Super *Abyss Breach*, reserved), `GATE_TIER_SUB`
  (*The Battlespire*), `gateTier(x)` (an `eg:` room key, a record of kind `eg` or one with a band is Elite; a record of
  kind `gate` or one with a day is Regular; nothing reads as Super), `gateTierText`, `eliteBreachPlaque({ opener, mine
  })` (another's company named, never your own), `gateSightLine(metres, direction)` (to the nearest 10 m, never under
  10), `eliteTimerText`. No reader of the Regular gate's words moved to it: the HUD's and the arch's slices are its
  readers.
- **THE REGISTRY** (`world/eliteGates/pseudoArchives.js`). Every archive the port numbers past TEXTURE.511 - 34 numbered blocks and
  8 string keys - with its owner, its kind (port, mod, data or synthetic) and what it holds; `pseudoArchiveCollisions`,
  `pseudoArchiveOwner`, `pseudoArchiveFree`. Its test sweeps `src/` both ways: every `*ARCHIVE*` number past 511 is
  registered at its own value under its own owner, every registered block is found in its owner, and no two collide. The
  Spire's own: `EG_BAND_ARCHIVES` (38241, 38251, 38261, 38271, a block of 9 a band) and `EG_ARCH_ARCHIVES` (38281 to
  38289, held for the arch's skin).
- **THE BAND ART** (`world/eliteGates/egBandArt.js`). Each band's ramps (stone, vein, metal, accent, liquid; five steps each)
  painted in code with SD-LOOK's kit (ordered dither, bevels, quantised ramps) into eight records under the band's
  archive: floor (0), brass (1), root (2), arena (4), cobble (31), edge (32), molten (33), pillar (56). The Galleries
  are marble and gold leaf with Battlemage blue over the fire-sea; the Cairn slate violet and bone in soul-light; the
  Shade black glass and moon-silver over quicksilver; the Wellhead SD-LOOK's basalt and iron over the molten. The gold
  edge glows at `SD_EDGE_GLOW` and the brass at `SD_BRASS_EDGE_GLOW`. The liquid's light is held at or under luma 0.45
  in every band (`egMoltenGlow`, section 11.9: magma never outshines a telegraph). `egBandDress(model, band)` moves only
  those eight records' sub-meshes from the Hour's archive to the band's. It dresses the circle's model, the gate's parts
  and every span piece, batched or drawn alone. The magma floor (Grath's Court) and the Caverns' fire channels moved
  from the edge gold (32) to the band's liquid (33). The dungeon arm uploads a band's art the first time a session
  stands one of its halls, its light white.
- **THE MESH KIT** (`world/eliteGates/meshKit.js`). `createMeshKit()`: `tri`, `quad`, `box`, `prism`, `extrude`, `lathe` and
  `sweep`, every face wound to face out, one sub-mesh a record, 32-bit indices, `pack(archive)`;
  `meshKitBounds(positions)` (box, centre, radius). Its first reader is the waystones' model.
- **THE PIECES' PASS** (`scenes/eliteGates/egPieceBatch.js`, read by `scenes/eliteGates/egSpan.js`). Each kind of moving piece (a slab, a
  pendulum, a tube, a lid, a wall) is one mesh holding every copy, drawn through the renderer's own mesh program
  (`createMesh`, `updateMeshVertices`). Each slot reads the pose the law already writes (`object.matrix`, `hidden`; a
  matrix of zeros is a gone piece), so not one line of the law's posing changed. Each frame `cull(planes)` re-lays only
  the copies whose place or sight changed, uploads a kind only when one did, parks a copy out of sight 4000 m below and
  hides a kind with nothing in view. Every piece is `noShadow`, so a cull never moves the shadow record. Grath's islands
  and the seals keep their own draws, now culled by their bounding spheres. The dungeon arm calls the cull
  (`dungeonContext.egSpanCull`) on the frame's own view and projection, before it draws the level and its movers.
  **Measured** (node, 60 circles: seeds 7, 99 and 12345, circles 1 to 20):
  - the circle's dynamic draws fell from a mean of 53.4 (worst 152) to 8.4 (worst 13);
  - its GL draw calls (a sub-mesh each, the islands and seals counted) from 115.5 (worst 343) to 17.6 (worst 32), every
    copy in view;
  - the ride and the cull together cost 0.19 ms a frame on average and 0.32 ms at worst (seven circles, hall 2's eye).
- **THE EDGE LINE** (`world/eliteGates/egLook.js` `egCircleEdges`, `render/eliteGates/egLinePass.js`). Screen-width quads, 2 px wide (3 px on
  a screen 720 px tall or less), gold at luma 0.38 (under any danger palette but the Standard, its safety at that luma,
  and the tracks and streamers its hazard - AUDIT EG III), lifted 0.02 m. They run along every disc's rim, every band's long
  edges (not a cave's, a wall's or a tube's) and the lanes; a falling island's disc has none. The Rail's dashed track
  (0.5 m dashes, under its run) and the Drum's are drawn in the same pass. Every line keeps section 25.6's fog floor.
- **THE LAST TELLS.**
  - The Gust's streamers (`egGustSections`, `egStreamersAt`): from the breath law, only while the wind blows, flowing
    its way, at most 64.
  - The waystones lit (`buildEgLookModel`): a post beside each walkway, its cap in the edge's gold, in the band's dress.
  - The mist drawn (`egMistSheets`, `egMistSheetsAt`, `render/eliteGates/egMistPass.js`): a pale sheet from 0.3 m under the walk,
    rising to its law's line, feathered at its rim, dithered, in the fog.
- **THE SKIES** (`render/eliteGates/egSkyPass.js`, `EG_SKIES`). Each band's zenith, horizon and deep, the Galleries' and the
  Wellhead's embers, the Shade's moon and its stars, and the Spire's underside overhead: a black mass leaning toward the
  course, its ragged rim lit from below by the deep, smaller each band (0.34, 0.22, 0.13 and 0.07 radians). It is drawn
  in the dungeon arm's sky slot, where the Hour's sky stood, in the Spire's haze (`drawEgSky`, world.js).
- **THE STAIR.** The law alone: `egStairOf(h, reduced)` - the band's first hall and each Brink fall, every other hall
  veils, and reduced motion cuts.
- **THE TELEGRAPH PASS** (`render/gate/gateTelegraph.js`). `GateTelegraphRenderer(gl, { spire: true })` builds the Spire's
  shader from the gate's text by asserted swaps; the gate's own shader is unchanged byte for byte. The swaps add:
  - section 25.6's fog floor: 0.85 within 30 m, eased out over 4 m;
  - the fill's scale (`port:telegraphFill`, 50 to 100%);
  - the double keyline and the hatch, as a palette asks;
  - THE HAVEN GRAMMAR (`TELEGRAPH_POOL_HAVEN`, pool 3): gold and lit, its line bright, a dark keyline outside, chevrons
    flowing in to its heart.
  The fight (`egLookShapes` in `scenes/eliteGates/egFight.js`) draws the danger edge in the palette's colour, brighter on a shape
  aimed at you, and draws your shapes last. In a trial it fills a shape aimed at another member at 0.55. It draws a
  haven in the palette's safety and the place's own hazard in the palette's hazard colour.
- **THE DANGER PALETTES** (EG-G1's `EG_DANGER_PALETTES` in `ui/eliteGates/egAccess.js`, their one home - the merge folded this
  slice's own table into it, and its style bits are `egPaletteBits`): Standard, High contrast (magenta, a double keyline
  and a hatch), Deutan-Protan and Tritan. The lab check (`egLab`, `egSeen`, `egThroughFog`) tells apart the danger edge from the magma
  and from a burning pool, a haven from a danger fill, and the place's white from gold and from the void: at least ΔE 12
  apart at 10 m and 30 m of each band's fog, in colour and under the colour-blind simulation (Machado 2009) each palette
  is meant for. In grey the place's white stands at least 8 apart in L* from the danger edge; the shelf's colour-blind
  pins (40 delta E under each preset's own simulation) hold on the same colours. The look reads the shelf's
  `dangerPalette` and `telegraphFill` (`egAccessNow`, the fill 0.5-1 as the row stores it). `port:allyEffects` is not
  on the shelf: the port draws no allies' hit numbers to hide (`ui/hitNumbers.js` draws only the player's own), so the
  row would govern nothing.
- **THE QUIET COMPANY** (`egQuietCompany(stage, full)`). In a trial no cosmetic aura is gathered, drawn or lit (the
  client's `quiet`, which world.js's `auraFrame` asks - one seam with EG-E2's), and a shape aimed at another member is
  filled at 0.55.
- **THE SCORE** (`systems/eliteGates/egScore.js`). Fourteen made songs at section 26's tempos and lengths, made as the Hour's and
  the Warden's are (`makeSong`, 60 ticks a beat, looping on the bar line). They are in E Phrygian, the Redoubt's hymn in
  E major. The fanfare is broken and mended; each band's motif is in its yard's brass, and each lord's four bars run in
  its Court's three songs and its Valkynaz's. The halls play their three variants in the seed's order.
  `spireScoreFor(place)` is the law, and THE PRIORITY TABLE (`EG_SCORE_PRIORITY`) is pinned: the end, a Valkynaz, a
  Redoubt, the count's last two minutes, a lord's wake, a Court, a set piece, a yard, a hall, then the ambience alone.
  `createSpireScoreHost` is the world host's seam: `hourScoreFrame` asks it first. It registers a breach's songs when
  the breach's context changes, plays the law's song or fades to the band's ambience, and times the end from its first
  note. Measured by `tools/egScoreProbe.mjs` through the real SongPlayer (25 checks, every one passed): every song
  sounding, and pressed through one player with a duck under a Court; peaks under the -1 dBFS ceiling at the highest
  MusicVolume; the war louder by phase (the Courts -16.0, -14.9 and -14.3 dBFS, the Valkynaz -15.1, the count -14.4);
  the Galleries' halls -19.1 and the Redoubt -17.9, under the fights; the end -17.7, decaying to -43 in its last
  seconds. The first run found the end song looping before the law let it go, so `SPIRE_END_MS` came down to 36 s and
  `SPIRE_WAKE_MS` to 3.4 s, each inside its song (pinned).
- **THE SPIRE MIX** (`systems/eliteGates/egMix.js`, `SongPlayer.duck`, `music.duck`).
  - A personal sting for a lord's blow or a CHECK on your feet always, for an add's at most once each 1.5 s, judged once
    a blow.
  - The critical bus ducks the score 6 dB for 300 ms. The duck rides the song's own level, back over 0.12 s, so it never
    fights a fade.
  - The barks are capped at four a kind, nearest first; a critical one is never culled.
- **THE LAB** (`spire.html`, `src/tools/spireLab.js`, registered with Vite). It draws a circle as the dungeon arm does
  (the cull before the draws, the sky, the mist, the telegraphs, the lines), each band from the plate, the course, the
  Court, over the pieces, at the rim, at the sky and down a misted shaft, in any palette and fill, with the line pass
  off (`?lines=off`) or the shapes off (`?shape=off`) for a probe's comparison. `tools/spireLabProbe.mjs` (Chromium on
  SwiftShader, waiting on the lab's frame counter, 33 checks) holds:
  - every view of every band lit, with no GL error. The Shade's views are held to a third of the others' lit share: its
    floors are the page's black glass under a dark sky, and from afar only its lines and its silver read;
  - the pieces in a handful of draws, the other halls culled from the plate;
  - from over the circle, THE EDGE LINE's gold where the frame without the line pass has none (957 to 2,186 pixels a
    band);
  - the underside darkening the zenith (90 to 99%);
  - the mist covering its shaft;
  - the danger disc in each palette's own hue, where the frame with no shapes has none.
  Every check passed here, each part in its last run: the views, the skies and the mist in the first run; the Shade's
  views, the lines and the palettes after the changes their first runs asked for. The first runs failed the Shade's far
  views on the lit share and the Tritan disc on a colour test too narrow for a blended edge; the line check, made at the
  rim, found the line gold on the gilt and was moved to the view from above.

**The four hosts.**
- `src/scenes/world.js` - WIRED:
  - the Spire's score first in `hourScoreFrame`;
  - `drawEgSky` beside the fight's pass;
  - the auras quiet in a trial;
  - the music handed to the fight for THE SPIRE MIX.
  Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - WIRED:
  - a band's art uploaded once a session;
  - the waystones' mesh among the circle's draws;
  - the cull before the dynamic draws;
  - the Spire's sky in the sky slot (the Hour's no more over the Spire).
- `src/scenes/dungeonContext.js` - WIRED: `egSpanCull(proj, view)`.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach.

**Departures, said plainly** (its "not built" list is closed and gone: the slag's crust, EG-ZC; the stair drawn,
EG-ZE; THE QUIET COMPANY's allies, the Vestige ring and the Shade's rim lights, EG-ZG; the mix's peers, Watchfire's
tell,
the reverb's crossfade and TEXTURE.356, EG-ZH; the arch's skin, EG-F):
- **Done another way:**
  - the moving pieces are batched on the CPU (only moved copies re-laid), not drawn with per-instance matrices on the
    GPU: the renderer has no instanced path, and the batch measured inside the budget;
  - the cull covers the pieces, islands and seals (all `noShadow`), not the circle's one static mesh;
  - a haven is a pool (`TELEGRAPH_POOL_HAVEN`), not a new telegraph kind;
  - a lord's wake is its own 2-bar song (SPIRWAKE), a fourteenth name beside the page's table;
  - the Steps' own pieces (the Crumble, the Beat with its twelve dial frames, the Drift and the riser) keep the Hour's
    art: their faces are tells, swapped frame by frame through the Hour's archive.
- **Not verified without a browser and the game's data:**
  - nothing was played in the live game with ARENA2. The look was seen only in the lab on SwiftShader: plates, courses,
    Courts, skies, rims, mist and palettes;
  - the draw budget was measured on node's counts and the lab's batch stats, not as frame time on a phone;
  - the songs were measured through the real player in Chromium, not heard on a sound card.

**Pins.**
- `test/world/eliteGates/eglook_registry.test.js` (4), `test/world/eliteGates/eglook_art.test.js` (4), `test/net/eliteGates/eglook_pieces.test.js` (5),
  `test/world/eliteGates/eglook_lines.test.js` (8), `test/systems/eliteGates/eglook_score.test.js` (6), `test/scenes/eliteGates/eglook_hosts.test.js` (4).
- `tools/mutants/eglook.json` (82, and 85 with the three its merge added, every one dead; six survived the first run and
  were killed by new assertions: the
  fight's pass built as the Spire's, the barks through the cap, every critical bark kept past it, a Valkynaz's song only
  in its Court, the lords' brass harder each phase, a band's art uploaded once a session).
- Judged again over the files this slice touched: `egspan.json`, `egfull.json`, `egplay.json`, `egfrag.json` and
  `wb13a.json` (143, every one dead). `wb13a.json`'s WB13a-the-last-moment-flooding-the-shape was re-aimed by content,
  since the Spire's swap quotes its line; `SongPlayer.duck` stands above `fadeTo`, so DISC20-B's record applies as
  written.
- `test/render/tv4_weather_above.test.js`'s AUDIT DEEP R-1 names the three new fogged passes as drawn in an Elite Breach alone,
  never under the travel view.
- PIN MOVED for the Spire's sky, one more foreign pass and one more seam in the world host:
  `test/bible/audit18_bible_docs.test.js` (36 passes), `test/ui/farring.test.js`, `test/render/glstate.test.js` and `test/render/perf2.test.js`
  (29 seams). PIN MOVED for the lab: `test/tree/moduleload_smoke.test.js` lists `src/tools/spireLab.js` among the browser
  tools that read `location` at load (14). PIN MOVED for the score: `test/systems/superDungeon/sd13_score.test.js` and
  `test/scenes/superDungeon/sd20d_audio.test.js` run `hourScoreFrame` from world.js's text with the Spire's host beside it, holding nothing
  out of an Elite Breach. Systems.md counts 512 modules.
- The whole suite, run here (26,732 tests): every failure this slice caused is fixed - the pins above, a reversed
  smoothstep in the sky's shader (SD20c's sweep) and a registry line that named the Oblivion Gate (WB12a's guard). One
  failure stands at the base commit, not this slice's: doctrine's Ledger-row check names `src/net/eliteGates/egPay.js` and
  `src/systems/eliteGates/egLordArms.js`, left to the Ledger's owner.
- `RELAY_VERSION` untouched: nothing in the relay's import graph moved. `ACCOUNT_VERSION` stays `acct121` (`acct136`
  since
  the merges).
- The Port-Ledger's ELITE-GATES row names this slice's files.

**The merge (EG-G2 into the arc beside EG-G1, EG-H1, EG-H2 and EG-H3).**

- One home for the shelf. EG-G1 and this slice each built the danger palettes. The palettes, the fill and reduced
  motion are EG-G1's (`ui/eliteGates/egAccess.js`, the rows under Settings > Accessibility); this slice's own table and
  `egLookPrefs` are gone. The fight lays them on through `egLookShapes(shapes, egAccessNow(), stage)`. The fill goes
  to the Spire stage's `uFillK` (the row stores 0.5-1, never 50-100), and EG-G1's `egAccessShape` is gone with it.
  Both labs (EG-G1's 40 delta E under each preset's own simulation, this slice's fog-and-magma check) hold on the
  shelf's colours, and the colour-vision matrices are `ui/eliteGates/egAccess.js`'s `EG_CVD`, read by both.
- One seam for the quiet company. EG-E2's `quiet()` and this slice's `quietAuras()` were the same rule twice. The
  client's `quiet` now reads `egQuietCompany`, and `auraFrame` asks it, so a trial's auras are not gathered, drawn or lit.
- THE SWAP (EG-H3) stands a new circle in place, without `standEgHall`. It now uploads the new circle's band dress
  (`egBandUp`) and builds its waystones (`egLookBuild`). The old circle's look mesh is freed with its circle mesh.
- The fight's wind-up barks keep EG-H1's feint gate (the wind once the wind-up is past `EG_FEINT_AT`, never on a
  feint), and Watchfire's early outlines draw after the ordered blows. The fight's clock is the breach's corrected one.

### EG-ZE - 2026-10-12 - THE STAIR, THE DOOR AND THE LIGHTS

The last wave's slice for what EG-G1 and EG-G2 left the screen (Mac: "I said I want everything"). It closes EG-G2's "the
stair's fall and veil are law only; drawing them is the swap's screen" and EG-G1's fifth departure (the door's compass
mark, its beam and the closing's ring). It also draws what no record had named: the witness's and the living's pings
(the `eping` words were folded into the link's `pings` and read by nothing), the Redoubt's beacon, the recall's blue
pillar and the witness's sight.

**What shipped, by piece.**

- **THE STAIR DRAWN** (section 7; `world/eliteGates/egLights.js` `egStairStep`, `ui/gate/gateVeil.js`, `render/eliteGates/egStairPass.js`).
  - `world/eliteGates/egLook.js` `egStairOf` is the law, read now by the screen. `egStairStep(h, reduced, again)` gives the step its
    look as a veil theme: `egFall` at a band's first hall and each Brink, `egVeil` elsewhere, `egCut` under reduced
    motion (the port's row or the system's - `ui/eliteGates/egAccess.js` `egReducedMotion`).
  - It hands the veil the band the step falls into, the hall held centred (*Hall 13*), and the band's chime. The chime
    is the Concord's chime (clip 364) on the first note of the band's motif (`systems/eliteGates/egScore.js`), pitched as the
    Hour's quarters are.
  - A circle built again under the breach's own law (EG-H2's THE LAW PIN) never falls: the company has not moved.
  - THE VEIL'S THREE THEMES: the veil keeps the fire's law (`render/gate/gateVeil.js` `veilAt`) and runs it at the stair's
    pace, 0.8 s each way (`EG_STAIR_VEIL`). A veil half open and asked to close again closes from where it stands, at
    that pace.
  - The stair's own pass draws at a third of the pixels, pixelated. Every pixel goes and comes back in the ordered
    dither, posterized in the band's own sky (`world/eliteGates/egLook.js` `EG_SKIES`):
    - THE FALL: the band's void opening under the faller, the camera falling past the Spire's modelled underside
      (EG-ZO's `world/eliteGates/egUnderside.js`, which replaced the picture first painted here). Embers streak up past the eye and
      the deep rises to meet it.
    - THE VEIL: the band's void, dim, its motes drifting up.
    - THE CUT: the same void, standing still.
  - The band's chime sounds as the veil closes and at a pull's flash, with the deep wind under the fall.
  - The hall is a label of the veil's own, centred over its canvas. It comes and goes with the dither and goes with the
    veil.
  - The fall stands shut at least `EG_STAIR_VEIL.fallHold` (1.2 s), so the underside is seen to fall away.
  - WHERE IT IS DRAWN (`scenes/eliteGates/egClient.js`):
    - the step into the breach: the stair of its own first hall (`egStartHall`), so Hall 1 and a Brink start fall;
    - THE SWAP, in place (`scenes/worldModes.js` `egSwapCircle`) and its fallback alike, through `stepThroughFire`'s own
      look;
    - every pull's flash.
  - NEVER SLOWER: the swap closes in 0.8 s where the Hour's veil it used took 1.2, and opens in 0.8 where it took 1.7.
    The fall's close, hold and open (2.8 s) stay inside the Hour's veil's 2.9 (pinned). The swap's own work runs inside
    the hold, never after it.
- **THE DOOR** (sections 7 and 27.3).
  - Through the closing, a gold beam stands over the END PLATE in the palette's safety. It is 48 m tall, climbs in
    0.6 s (whole at once under reduced motion), and keeps 0.6 of itself through any haze, so it is seen hall-wide.
  - The closing's ring lies at the door's reach (`EG_DOOR_REACH_M` 3 m, where `down` is heard), in every hall kind. Its
    arc is the closing's seconds left, from the relay's own stage word (`sa`, `su`); the spent arc stays at a quarter.
  - The door's mark on the enhanced compass is `egDoorCompass`, through the client's `archCompass` (departure 5).
- **THE REDOUBT'S LIGHTS** (sections 16.2 and 27.5).
  - THE BEACON climbs at the court's heart 1.5 s after the Redoubt's word (`rd`'s `at` - the relay says it on the step
    the lords fell). It stands at the place the spoils are thrown from (`beaconAt`'s own), 90 m tall, climbing over
    1.2 s, and stands through the rest. It burns wider and brighter for 0.8 s as each recall lands.
  - THE RECALL'S PILLAR is blue, 6 m, where the called-back rise (the room's `rise`). It rises in 0.4 s, stands 3 s and
    fades over its last 0.6.
- **THE COMPANY'S WORD** (sections 16.4 and 16.5).
  - Every ping is a Battlemage-blue pillar 6 m tall with its kind's glyph: *here* a ring, *danger* a triangle with its
    bar, *mine* or a witness's *cache* a diamond. It rises in 0.25 s, stands 5 s and fades over its last second.
  - Each newly heard ping chimes once (the beats' chime).
  - The wire carries a ping's x and z alone. The floor it stands on is the one under it nearest its pinger's own height
    (`egFloorUnder` - mine, or the company's poses), else the highest.
  - A witness's ping now stands where the member it watches stands. Before, it stood on the arrival plate, because a
    witness's own body is held under the hall.
- **THE WITNESS'S SIGHT** (section 16.5): for a witness alone, a blue ring and an eye at each dormant Lurker's anchor,
  and a ring and a diamond at each alcove on its own floor. The next hall's twist is said once a hall: *Beyond the
  door: A Battlemage hangs in chains.*
- **THE LIGHTS' PASS** (`render/eliteGates/egLightPass.js`, through `scenes/eliteGates/egLookDraw.js` `drawLights`).
  - It draws beams and pillars facing the eye about their upright axis, rings flat on the floor and glyph squares facing
    the screen. They are written on the CPU each frame into one kept buffer and blended additively.
  - THE FOG FLOOR keeps them within 30 m, and a beam has its own floor past that.
  - The pass is depth-tested and never writes depth. It draws after THE EDGE LINE in the fight's pass, and gives back
    its state.
  - Every light is the way's gold (the shelf palette's `safety`) or Battlemage blue, never a warning.
  - A trial with nothing said stands no light, and the law makes nothing for it: the draw asks every frame.

**Where EG-ZE departs from this page, said plainly.**

1. **The pull keeps the veil's flash** (section 27.5's table). It goes shut at once in the stair's own look, with the
   hall held and the band's chime, and opens in the 0.8 s dither. It never closes first, because the pull is the
   room's, taken at once.
2. **The fall's least hold can keep a fast swap waiting** by the difference between its work and 1.2 s. It is never
   longer than the Hour's veil every step used before (pinned).
3. **The hall held is a DOM label over the veil**, in the classic face (Cormorant, the arrival card's gold) on both
   skins, and hidden from screen readers (the arrival card's words reach the live region).
4. **A witness's stair does not cross-dissolve with the member it watches.** A witness sees the company's stair.
5. **The door's compass mark rides the arch's gold slot.** The world host's frame already hands the enhanced compass
   `arch: egClient?.archCompass()`, the gate's diamond in the Spire's gold. The arch stands only in the open world, so
   in the Spire the slot is the door's, and no host line moved. The classic compass carries neither, because EG-F's
   ninth departure stands: the classic HUD's options drop the arch.
6. **The beacon's 1.5 s is timed from the Redoubt's word, not from SPIRREDT's chord.** The score's own clock is
   EG-G2's.
7. **The witness's sight speaks the twist in the chat**, with no HUD line. A ping's cooldown is not shown: the relay
   refuses a ping inside 3 s, and the screen says nothing.
8. **Blue is the same in every palette.** The palettes move the danger, the safety and the hazard only.
9. **Nothing here has run in a browser**, because the build container holds no Daggerfall data. The two shaders were
    evaluated through `test/glsl.mjs`, the passes run over a recording GL, and the client played against the relay's
    own words through the wire.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED: untouched. The compass's slot (`arch: egClient?.archCompass()`) and the client's
  `drawPass` already reach it. Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: untouched. `stepThroughFire(go, look, opts)` already hands the veil the step's
  look, and the swap in place runs inside it unchanged.
- `src/scenes/dungeonContext.js` - FLAGGED: it has nothing to wire.
- `src/scenes/exterior.js` - FLAGGED, as section 28 has it: offline, no breach.

**Pins.**
- `test/net/eliteGates/egz_stair.test.js` (9).
- `tools/mutants/egz_stair.json` (85 at the slice, every one dead; 86 at EG-ZD's merge, with
  EGZ-the-way-back-under-the-hour, and 84 since EG-ZO took the underside's two). Two survived the first run:
  - a witness's compass during a closing - a pin was added;
  - the client's own guard on the lights outside the halls - redundant with the draw's own and the law's, so it was
    removed.
- Records of other slices whose quoted line moved: `sd25_look.json`'s SD25-the-hold-dropped, re-aimed by content (the
  veil's hold now reads the stair's too).
- Judged again over the three shared files this slice touched (`ui/gate/gateVeil.js`, `scenes/eliteGates/egClient.js`,
  `scenes/eliteGates/egLookDraw.js`): 84 records in fourteen lists (`auditwb_sound`, `egarch`, `egeco`, `egfrag`, `egfull`,
  `egint`, `eglook`, `egmade`, `egplay`, `egpres_hud`, `egseam`, `sd11d`, `sd25_look`, `wb6c`), every one dead.
- PIN MOVED: `test/render/tv4_weather_above.test.js` names `render/eliteGates/egLightPass.js` as drawn in an Elite Breach alone, never
  under the travel view. `bible/07-Rendering/Rendering.md` lists the two new passes.
- `RELAY_VERSION` untouched: nothing in the relay's graph moved. `ACCOUNT_VERSION` stays `acct121`.
- The Ledger's ELITE-GATES row gains `world/eliteGates/egLights.js`, `render/eliteGates/egStairPass.js` and `render/eliteGates/egLightPass.js` at the
  lead's merge.

### EG-ZD - 2026-10-12 - BACK INTO THE SPIRE, AND THE FALL

The last wave's (EG-Z) slice for section 22's way back (EG10's return), section 16.5's FALL screen, section 10.8's clock
on the host, section 13.2's dashed feint, section 27.8's Surplus on the pad and section 26's critical bus for the beats
(Mac: "I said I want everything"). It closes EG-H1's world.js host flag (`egNow` and the spans' anchored clock on the
welcome's offset), its departure 8 (the feint's fade), and EG-G1's departures 7 (the Surplus's two buttons) and 9 (the
beats on `audio.playOneShot`).

**What shipped, by piece.**

- **THE WAY BACK** (`scenes/eliteGates/egClient.js`, section 22).
  - The breach I stood in is kept on the device (`EG_BACK_KEY` `eg.back`, read by `egBackOf`): its id, its seed, its
    opening, its geometry, its start, the hall the company last stood in, whether the room counted me (`in`), my last
    island (`li`, `[h, x, y, z]` in the hall's frame) and the falls whose screen this device has shown (`wf`). It is
    written at the first step in, again whenever the room's word moves any of it, and the island at most each
    `EG_BACK_WRITE_MS` (1 s, the last one kept for the next write).
  - The client now reads the account's `live` breach from the account service's keys answer (`/v1/eg/keys`, which has
    always answered it). A record of another breach, or of none, is let go on that word. A live breach the device holds no record of is kept as one, with
    its seed the room's to say.
  - Once the service says the breach lives, a member outside it is offered *Your breach still stands. Type /breach to
    return to the Spire.* once, in the chat. The call's strip (`scenes/eliteGates/egCall.js`) says *Your breach still stands -
    return to the Spire* with a *Return* button. Enter, the pad's A, the strip's button, `/breach` and the Weir Key's
    use all answer it.
  - Answering is never refused as late (`returnIn`). It asks no admission of the service and sends no order: it is a
    hello as an entrant, which the room answers by re-admitting a member it counts (`net/eliteGates/egBrain.js` egAdmitWord,
    unchanged). The step goes under the veil into the circle of the hall the record last stood in.
  - A call still open, to a member the room never counted, stays the call's own door, never the way back.
  - In the circle, the room's word puts me where the company stands. A circle or a seed the record had wrong is rebuilt
    in place at once, by EG-H3's swap, whatever the stage. I resume on my last island in a trial (still ground under
    my feet in the company's hall, by `net/eliteGates/egFair.js` egSupportAt: a plate, an island, a passage's floor, a bridge, a
    ramp or a fight floor). Between trials I resume on the hall's arrival plate. A witness's body is held as it was.
  - The record is let go at the breach's end, at my way home, at forsaking, and when the room refuses me back (its
    refusal's words). The breach is then marked over on the device (`{ b, x: 1 }`), so the service's `live`, which
    stands until my end receipt is claimed or lapses, never offers it again. A socket merely lost keeps the record, and
    the service is asked again at once, so the way back is offered on the walk out.
  - The keys are asked once the account is signed in. A reloaded page signs in after its first frame, and the ask
    used to wait ten minutes from that frame.
- **THE FALL** (`ui/eliteGates/egSpireHud.js` `egFallModel`, `drawEgFall`, `egDitherCss`; section 16.5). A fall in the Spire is now
  its own screen, not mid-screen text:
  - the camera sinks 1.2 m (`EG_FALL_SINK_M`) over 1.2 s from my eye where I fell, eased, as the screen drains to a
    fifth of its colour (`EG_FALL_SAT`, a backdrop's saturation over the world - the HUD above it keeps its colour);
  - the gate's title card's sheet, on a node of its own, reads *FALLEN* over *The next Redoubt can call you back.* or
    *The Spire will not take you back.* (no recall left, or the room's `fall` saying `fin`), and *Reliquaries lost: N*
    in the palette's red (the Reliquaries held while I stood) only when any were held;
  - 2.5 s later the witness view dithers in: an ordered 2x2 dither through black in quarters over 0.6 s, the eye handed
    to the witness's orbit at its darkest;
  - reduced motion (`egReducedMotion`): no sink, the colour cut at once, the card still, the witness view cut in;
  - the card's words go to the HUD's live line (the card is aria-hidden), and a fall this device has shown is not shown
    again after a reload;
  - the company's low toll is clip 107 at the page's pitch 0.42 (EG-G1's table had 0.55).
- **THE SPANS' CLOCK** (section 10.8). The breach's client hands the host the corrected shared clock while I stand in
  the breach and the room has answered a ping: `breachNow()` in ms and `spanSeconds()` as anchored seconds
  (render/deadlands.js anchoredClock's law, taken again when the corrected offset moves past `EG_SPAN_REANCHOR_MS`,
  5 ms). The world host reads them first, `deadlandsSeconds` (the dungeon arm's `sdClock` - the spans and the Spire's
  sky) and `egNow`, with the welcome's offset elsewhere and before an answer. Both are host functions beside the old
  ones, outside `function frame(now)`.
- **THE FEINT'S DASHED FADE** (`scenes/eliteGates/egFight.js`, `render/gate/gateTelegraph.js`, section 13.2). A cut blow's fill stays
  where the cut found it, and its mark fades over `EG_FEINT_FADE_MS` (ai/blowShapes.js TELL_FEINT_FADE, Feud-Arc section
  7.3's one number, in place of a literal 150). It is drawn dashed: the Spire stage's `uLook` 4 (`world/eliteGates/egLook.js`
  `EG_LOOK_BIT.dash`), TELL5's stripes across the court's axes. An honest blow, or a zone in a slot a feint held, is
  never dashed.
- **THE PAD AND THE SURPLUS** (section 27.8). With a Surplus to spend, the pad's left and right run past the offer's
  cards to the Surplus's two buttons: up on the first spends a fourth card, on the second a reroll. The panel
  (`ui/eliteGates/egHud.js`) marks the one chosen.
- **THE BEATS ON THE CRITICAL BUS** (`systems/eliteGates/egMix.js` `beat`, section 26). Every HUD beat's sound (a door, a fall's
  toll, the count's tolls, a rune's chime, the recap's Rare chime, a Weir Key found) is played through THE SPIRE MIX:
  the one-shot, and the score ducked 6 dB for 300 ms, never culled. In the breach it is the fight's mix, over the host's
  music (the fight hands it on, `mix()`). Elsewhere it is the client's own, with no music to duck.

**Where EG-ZD departs from this page, said plainly.**

1. The world host's offer is the call's strip, its chat line and `/breach`, not a button of its own: the strip already
   stands for the call, and the way back is answered the call's way.
2. "A counted member" is the device's record of the room's count. A device with no record (another browser, cleared
   storage) is offered the way back on the service's word alone, and the room decides: a member it never counted is
   refused at the hello past the window, and that refusal lets the record go.
3. The last island is the client's own record of still ground, written at most each second, not the relay's last
   pose. A page whose socket only dropped never left the circle, and stays where its own motor holds it.
4. The drain is a backdrop's saturation (the HUD keeps its colour), and the dither goes through black. Neither is a
   cross-dissolve of two frames. The sink starts from the first-person eye where I fell (`cam.pos`), in either view.
5. THE FALL's words are the client's (`EG_FALL_TEXT` in ui/eliteGates/egSpireHud.js). `net/eliteGates/egLaw.js` is in the relay's bundle, so
   only the final line is `EG_TEXT.fallen`.
6. The spans' clock is taken again past 5 ms. anchoredClock's own slack (1 s) would never take the correction, which is
   a one-way latency of tens of milliseconds.

**The four hosts.**
- `src/scenes/world.js` - WIRED: `deadlandsSeconds` (now `deadlandsShared` with the breach's seconds first) and
  `egNow` read the breach's corrected clock. Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: it has nothing to wire. The spans read the host's seconds through its `sdClock`,
  and the way back stands the circle through its own `enterEgHall`, `egSwapCircle`, `egPrebuild` and `egPlace`.
- `src/scenes/dungeonContext.js` - FLAGGED, for the same reason (`egSpanRide` reads `opts.sdClock`).
- `src/scenes/exterior.js` - FLAGGED as section 28 has it: offline, no breach.

**Pins.**
- `test/net/eliteGates/egz_return.test.js` (7).
- `tools/mutants/egz_return.json` (71, every one dead). Four survived earlier runs. The island's write kept for the
  next survived until a pin wrote two islands within one spacing. The breach's end, my way home and forsaking each
  guarded the record a second time, after the over mark already guarded it; those three guards were redundant code,
  and they were removed with their records.
- Moved, each with a PIN MOVED note: `egfull_client` (the witness's eye read after THE FALL has run), `wb6b_deadlands_life`
  and `sd5b_sky` (the Deadlands' anchored clock is `deadlandsShared`, with an Elite Breach's corrected clock read first).
- Re-aimed by content and judged again: `egplay.json`'s EGPLAY-the-next-circle-never-built (the swap's line now also
  takes a return) and `egpres_hud.json`'s EGPRES-a-yes-or-no-one-option (the choices now say their cards).
- Judged again over the files this slice touched (`scenes/eliteGates/egClient.js`, `scenes/eliteGates/egFight.js`, `ui/eliteGates/egSpireHud.js`,
  `systems/eliteGates/egMix.js`, `render/gate/gateTelegraph.js`, `world/eliteGates/egLook.js`, `ui/eliteGates/egHud.js`, `ui/eliteGates/egBeats.js`, `scenes/eliteGates/egCall.js`):
  180 records of `egpres_hud`, `eglook`, `egarch`, `wb13a`, `egfull`, `egint`, `egplay`, `audit_wb9`, `wb4`, `egseam`,
  `egfrag`, `egmade`, `wb8c`, `egspan`, `sd8d`, `wb9e`, `auditwbx`, `egeco`, `sd11d`, `wb9b` and `wbx`. Every one is dead.
- `RELAY_VERSION` untouched: nothing in the relay's import graph moved. `ACCOUNT_VERSION` stays `acct121`, with no
  migration.
- The Port-Ledger's ELITE-GATES row is the lead's. No new src file.

### EG-ZA - 2026-10-12 - A KEY IS NEVER LOST, AND THE RECEIPTS SAY EVERYTHING

The last wave (Mac: *"I said I want everything"*). Sections 21, 22 and 23, with section 20's boards. It closes EG-PLAY's
departure 7 (the hub keeps no receipts) and EG-H2's departure 5 (the hub retrying `EG_INTERNAL_OPEN`, `{k:'void', z}`,
the unknown room's tombstone, a `force` deploy voiding live breaches). It also closes three of EG-E2's departures: the
relay minting no `td`, a company being the claimers rather than the receipt's `co`, and THE SEAL's ranking. And it builds
section 22's tick.

**What shipped, by piece.**

- **The open, retried** (`server/src/index.js` `_egOpen`). The hub tells the breach's room its open `EG_OPEN_HUB_TRIES`
  (3) times while the room does not answer. The room answers the same order with the record it kept, so a retry is
  harmless. Once the hub has kept the call for the company's hellos, it tells the room the call went out (a new internal
  door, `EG_INTERNAL_CALLED`; the room keeps `B.called`).
- **An end with no hall woken is a void** (`net/eliteGates/egBrain.js` `egEnd`). It is never the opener's `'empty'` unless the
  room was told its call went out. A voided breach's opener who never entered is owed the `v` by the end itself. The
  law pin's void (EG-H2) now gets its `v` the same way.
- **A void is the room's** (`EG_INTERNAL_VOID`, `_egVoidInternal`). The hub asks for it in three cases:
  - an open the room refused (another order holds the room, or the room voided this one);
  - an open the room never answered after its tries;
  - THE DRAIN's refusal. Before, the hub minted that void itself, and the order could still open a breach once the road
    reopened.
  An order the room never took is written into the room's tombstone first (`egdone`, `net/eliteGates/egDurable.js` `egDoneWith`).
  Only then is its `v` minted, once: asked again, the room answers the same receipt, and the order is never opened
  after. If the signing fails, the order is still spent, and its void is minted when asked again.
  The breach the room took is voided only while nothing has begun (`egVoidable`: no call out, no hall woken, no member
  in). Otherwise the hub says *the breach took the key*, because its own receipts settle the stake.
- **A client's void** (`{k:'void', z}`, to the hub - `_egVoid`). The hub checks the open order whatever its age
  (`net/identityToken.js` `verifyEgOpenAnyAge`, `verifyStakeOrderAnyAge`'s way) and that it is this socket's account's.
  A void more than `EG_VOID_MAX_S` (7 days) after the order's issue is refused (*the void is too old*), by the hub and
  by the room's own door. Then the hub asks the room.
- **The tombstone** is kept `EG_VOID_MAX_S` (EG_DONE_MAX orders at most). An ended breach's own order is written into
  it at the end. The room's one alarm is then the tombstone's end, after which the room forgets the breach and the
  tombstone (`_egDoneTick`). A room the hub never opened writes nothing but a void's tombstone, and arms only its end.
- **The receipts, held at the hub** (`egrc:<sub>`; `EG_INTERNAL_RCPT`, `_egRcInternal`). Every receipt a room mints is
  told to the hub, with the accounts whose socket stands in the room:
  - a member online at the hub but out of the room is handed theirs at once; one in the room only by the room;
  - every hello is handed the held ones (`_egReceiptTo`) until the account says the service counted it
    (`{k:'claimed', b, q, w}`). The copy is then remembered as spent for the receipt's own life (`egRcSpent` - the gate's
    AUDIT WBX2 M3 law), so a tell that comes after revives nothing;
  - one entry per receipt (`egRcId`: breach, kind, Redoubt), the newest kept, at most `EG_RC_KEEP` (16), each for its
    own life (`egRcFold`); the hub's sweep is the gate's, widened by one prefix.
  The room keeps each owed receipt (`B.rq`) until the hub has it, tells again `EG_RC_TELL_MS` (5 s) later when the hub
  did not answer, and an ended breach beats on for it.
- **THE FORCE VOID** (`.github/workflows/relay-deploy.yml`). A `force` dispatch deploys with
  `--var EG_VOID_BEFORE:<epoch ms>`. A breach's room woken under that stamp whose breach opened before it ends the
  breach as a void, the law pin's way (`egForceVoided` in `egResume`): the entered members' ends say `void`, the opener
  who never entered is handed the `v`, and the Redoubts taken stay. The next deploy carries no stamp.
- **THE TICK** (`egTickAt`, `egTrialRuns`). The room's beat is `EG_BEAT_TRIAL_MS` (BRAIN_TICK_MS, pinned equal) only while
  a trial runs with its company in the room. Otherwise it is `EG_BEAT_SLOW_MS` (1 s), or sooner at the stage's own end
  (`su`), so no stage ends late. There is no beat while the arch rises: the room's first beat is the open. Every gap
  stays under `EG_GAP_MS`, so THE TIME law gives nothing back for it (pinned: no `gv` over a slow stretch).
- **The receipts' table, whole** (`net/eliteGates/egReceipt.js`, `net/eliteGates/egBrain.js`).
  - An end (`x`) carries `td` once a hall is cleared, and `co`.
  - A Redoubt (`w`) carries `sh`, the member's share of the circle's damage in thousandths of the living members'
    whole.
  - It carries `m`, THE FAIR TRAIL's measures over the circle (`measureFold`). Each hall's trail is folded as it closes,
    and the Court's own at the fall; a crossing keeps its bound (`cmin`) as it reaches the end plate. The six numbers:
    crossings, the quickest crossing as a share of its bound (%), the most blind share (%), breaks, the fastest
    stretch (cm/s), and crossings whose door was the room's wake's.
  - It carries `co`.
  - `egReceiptValid` reads each field on its own kind and refuses any other shape.
  - The worst case of every field (a 40-character account, every list full) stays inside `EG_RECEIPT_MAX`. Only the
    Vestiges and the Reliquaries are trimmed.
- **THE COMPANY'S PACKING, said plainly.** Eight 40-character accounts would be about 460 characters on the wire, and a
  worst-case Redoubt has about 170 to spare. So `co` is `[n, tag]`: the entrants' count and the first twelve hex
  (48 bits) of a 64-bit FNV-1a over their accounts, sorted and comma-joined (`egCompanyTag`). Every member's receipt
  of one breach says the same tag.
- **The service** (`server-account/src/eg.js` `egReceiptRest`; migration 0111 extended - `eg_runs.co_n`, `co_h`,
  `eg_redoubts.sh`, `m`; `ACCOUNT_VERSION` stays `acct121`).
  - A recorded `w` keeps its share and its measures on its row. The measures are for staff and gate nothing until EG21.
  - A recorded `x` keeps its company.
  - The boards read `td` where the receipt says it (EG-E2 already did; the relay now mints it).
  - The Descent keys a company by `co` (`egHonours.js` `egDescentCompanies`). The same company is one row whoever of it
    claimed; two companies that share their claimers are two rows; the company's size is the company's own. An end
    from before this is keyed by its claimers, as before.
- **This screen's half** (`scenes/eliteGates/egClient.js`, `net/online.js`).
  - The stake an open takes is kept on the device (`EG_STAKES_KEY`) until a call or a receipt answers it.
  - If neither comes within `EG_VOID_WAIT_MS` (60 s - the hub's own tries are done by then), its void is asked of the
    hub, again every `EG_VOID_ASK_MS`, across reloads. A void refused is let go.
  - Its `v`, claimed, restacks the key: *The Spire did not open. Your key is returned.*
  - Each receipt the service has counted is said to the hub (`claimed`).
  - The presence link now hears a receipt from the hub, and says `void` and `claimed` to the hub alone.

**Where it departs from the page, said plainly.**

1. The page's frame table has `{k:'void', z}` going client -> room. It goes to the hub, which asks the room by an
   internal door. A room the hub never opened admits no hello, and the hub holds the void for the opener's hellos.
2. The room trusts the claims the hub verified (`{ s, eb, ez, i }`), as it trusts the hub's verified open. The room
   checks the age again itself.
3. `co` is a count and a tag, not the subs (above). The Descent row names the members who claimed. It cannot name one
   who never did.
4. `m` is the circle's six measures, not one hall's. `sh` is thousandths of the living members' damage that circle.
5. The hub holds every receipt, not only those for members with no socket in the room. It hands a member in the room
   nothing (the room did), but holds the receipt for their hellos.
6. A member's word still arms a beat at once (a vote, a step through the door); only the room's own tick keeps the
   law. A closing with a foe standing in it (a Kyn Mimic's Lurker) beats as a trial.
7. THE FORCE VOID is a Worker variable the deploy sets, not an asked door. EG-H2's departure 2 gives the reason: an
   unauthenticated ask would let anyone void a breach.
8. THE SEAL's ranking needs no case of its own. A sealed run ends at the sealed Redoubt's Court, its `td` the seconds to
   that Court's fall, so the Descent's order (the deepest hall, then the fewest seconds) ranks sealed runs by their
   seconds. The relay mints no `'seal'` end while `EG_OPEN` is 4.

**The four hosts.**

- `src/scenes/world.js` - unchanged, nothing owed. The client's hub and presence links are wired already (`online.onEg`,
  the hub link's `onEg`), and everything here runs inside `egClient.frame` and `word`.
- `src/scenes/worldModes.js`, `src/scenes/dungeonContext.js` - unchanged; they stand no stake and no receipt.
- `src/scenes/exterior.js` - unchanged; the bench is offline (section 28).

**Pins.**

- `test/net/eliteGates/egz_keys.test.js` (9). `tools/mutants/egz_keys.json` (64, every one dead).
- PIN MOVED:
  - `egplay_relay`'s `EG_KINDS` (`void`, `claimed`), and its ended breach's alarm (its tombstone's end, a week on);
  - `egdur_relay`'s drain and cap (the room holds the order's tombstone and no breach);
  - `egeco_herald`'s ended room (its tombstone's alarm);
  - `auditwbx2`'s sweep cursors (seven, `sweep:egrc`; eight since AUDIT EG IV's `sweep:egcall`, moved on the merged head
    by 9a862e8d - the merge note at this section's end).
- Eleven records of other slices re-aimed by content, every one judged again and dead: `egeco`, `egeco_honours` (two),
  `egeco_relay` (four), `egmade` (three) and `egplay`.
- `RELAY_VERSION` `world197`, unshipped, rehashed: `net/eliteGates/egBrain.js` imports `net/eliteGates/egReceipt.js`, so the graph's walk
  swaps it ahead of `net/eliteGates/egDurable.js`. No `EG_SPEC` change, so no new `EG_LAWS` entry. No new src module.

### EG-ZC - 2026-10-12 - THE LAST FRAGMENTS

Closes what layer three and EG-G2 left of sections 11.1, 11.2 and 11.10: the Cooling Slag laid, the shafts (the Slag Chute
and the Hollow Trunk among them), and the engines as the page wrote them. Spec law 5.

- **THE COOLING SLAG** (`net/eliteGates/egSpanLaw.js`, the crust's one home - `EG_HAZARDS.slag` reads its numbers):
  - a spill is told `EG_SLAG_TELL_S` 1.2 s, molten `EG_SLAG_MOLTEN_S` 6 s, then a crust `EG_SLAG_CRUST_S` 10 s, every
    `EG_SLAG_CYCLE_S` 20 s (`egSlagState`);
  - a `slag` step is a crossing poured by `EG_SLAG_SPOUTS` two spouts side by side, `amp` (2.05 m) either side of its
    line, each lane 4 m wide (`EG_SLAG_STEP`), the second half a cycle behind the first. One crust always stands
    (`egSlagLane`), and the piece stands on that crust's lane (`egPieceAt`), so THE FAIR TRAIL's support
    (`net/eliteGates/egFair.js egSupportAt`) and the floor test know it unchanged;
  - THE TIMED SOLVER believes a landing on a crust only while that lane holds through its crossing (its depth at THE
    SPAN BUILD's run, and the Crumble's slack). The window shuts about 0.7 s at each change of lane, never a queue. A crust
    is left onto still ground (`EG_SLAG_AFTER` - the ground, a still step, a ledge or a Drop), never onto a timed piece;
  - the spill's lanes are the place's hazard (kind `slag`, 4 m wide, told over the wind-up floor, 20% fire). They pour
    over the crust and `EG_SLAG_LIP_CM` onto the floor beyond, so a member waiting at the lip stands aside. The
    director judges them as it judges every fragment hazard (`net/bossRef.js judgePlace`). A body that stays on a crust
    as it breaks falls, and owes the count its cast-back (`egPoseIn`'s void rule).
- **THE FORGE KIT LAYS IT** (`net/eliteGates/egFragLaw.js`, from `EG_SLAG_LAW` 5). The Forge Gut's chasm runs two conveyors, then a
  slag crossing that is left onto the far floor. The passage is 3 m longer for its crust, so its floors and hammers stand
  where they stood, and its walls 0.7 m wider for the two lanes. It is laid in the Wellhead's spans, on its Low Roads
  (whose passage is the band's first kit) and in its Deepways.
- **THE SHAFTS** (`egFragShaft`, `EG_SHAFT_KITS`). The Deepway goes down by a shaft of its band's kit in place of its three
  bare ledges:
  - every shaft: a 3 m rim, three or four flights each `EG_SHAFT_FLIGHT_CM` 0.9 m down (THE ENVELOPE's step under a
    metre), one Drop of 3-4.5 m onto the Drop's walled landing, and a 3 m foot;
  - by band: the Caverns' throat under a fire fall across its rim; the Mist Stair's pit with the mist under its foot;
    **the Hollow Trunk**'s black-glass branches on the Moon's law, the beam walking down the trunk, open to the moon;
    **the Slag Chute**'s iron ledges, its Drop, then a slag crossing onto the foot (three flights, so a Deepway stays
    inside `EG_HALL_LEN_MAX`); the deep Caverns' throat;
  - its floors are traversal ground (blows land on none). The law marks its walls `shaft` in `caves` and names it a
    fragment of class `shaft`;
  - THE TIMED SOLVER holds each shaft's own crossing to `EG_SHAFT_MAX_S` 15 s at its median (section 10.5). Measured over
    12,200 halls (61 seeds, twenty circles, two grounds): every course proven, none on the plain fallback (AUDIT EG V, lane5 #5: wider, the Brink into the Cairn fell to it in 13.5% of draws - seeds 1-200, every ground - until spec law 8 stood its island at its last leap's height, section 10.5), the longest
    shaft 7.7 s, the longest hall 153.5 m.
- **THE ENGINES AS WRITTEN** (`net/eliteGates/egBrain.js`):
  - **the Sluice floods its lane for 6 s** (`EG_ENGINES.sluice.flood`). Its ring tells the flood 1.5 s and bites
    nothing itself (`p` 0, the place's fire). From the landing the channel is burning ground on every screen for 6 s: the
    place's 20% fire a tick on a member in it, and every add in it, whenever it walks in, losing its 40% once a flood;
  - **the Moon-Mirror lights a branch** (`EG_ENGINES.mirror.lit`) as well as blinding the Divers. It lights the Moon
    branch nearest it within `EG_MIRROR_REACH_M` (30 m) for 6 s, with a haven over its top (`EG_MIRROR_LIT_R`, THE HAVEN
    GRAMMAR: gold on what you stand on means it holds). The branch stands on every screen while lit
    (`scenes/eliteGates/egClient.js` `objs().lit`, `systems/eliteGates/spireKit.js` `spireObjs`), and THE FAIR TRAIL holds a body on it
    (`egPoseIn`). In the Shade's Deepways that is the Hollow Trunk's first branch, 17-21 m from the chamber's mirror;
  - **the Low Road's closing waits on either road** (`forkClosing`). It begins at the first Low Road arrival at the door
    (`B.lw` - a member whose trail took the Low Road) or at the door's opening plus the roads' difference, whichever comes
    first. A member who takes the Low Road after the door opened is waited for, and a door opened by the Low Road closes
    as the High Road's. The stage word carries the moved end.
- **THE LAW PIN** (section 22, EG-H2's departure 4). `EG_SPEC` is 5 and `EG_LAWS` keeps law 4 (`{ 4: '2026-10-11', 5:
  '2026-10-12' }`) WITH its generator: `egHallOf(seed, h, geo, law)` and `egCircleSpecs(..., law)` draw either law, and
  law 4's halls stand byte for byte as they were (800 halls hashed whole, pinned). Each hall says its law (`v`). The
  director draws every hall in its breach's own law (`specOf` reads `egv`), and the relay answers a `spec` in that law.
  Law 4 may leave the table from 2026-10-19.
- **On the screen:**
  - `scenes/eliteGates/egSpan.js`: each slag lane is its crust (`egSlagCrustModel` - the cooled crust on sides of the band's
    liquid, THE EDGE LINE round it; a bucket up only while it holds, shaking its last `EG_SLAG_WARN_S`) and its molten
    sheet (`egSlagMoltenModel`, `EG_DRESS.molten`, drawn only while it pours, no collider - magma is the void), batched
    with the other pieces; a lit Moon branch stands while lit;
  - `world/eliteGates/egHall.js`: a shaft's walls run 6 m under its foot (`egWallFoot`) in the drawn mesh and the collider, the
    Hollow Trunk unvaulted; each slag lane's spout on its wall over the crust's near edge, its lip the band's liquid
    (`egSlagSpouts`, draw-only);
  - `scenes/eliteGates/egFight.js`: a crust's last second told in white over its lane ("every piece shows what it will do next");
    the spill's bite judged on my own feet by the fragments' hazard pass, as every hazard is.

**Departures, said plainly.**
- **Two spouts, not one.** Section 11.2 says a spill and its crust. A lone crust holds the company 10 s at its lip, past
  section 10.5's no-queue bound (`EG_WAIT_MAX` 4 s). So every crossing pours from two spouts in turn, each keeping the
  page's numbers, one crust always standing.
- **The Sluice's share moved to its flood.** Layer three's told blow took a plain 20% (counted). The flood now takes the
  place's 20% fire each tick a member stands in it (an element's share - seen in the census, never counted), and the ring
  bites nothing.
- **The Moon-Mirror's branch is the nearest within 30 m**, the port's number. Only a Shade Deepway's chamber stands a
  branch in reach today. A mirror elsewhere blinds the Divers alone.
- **One pull.** The page pulls each road at its own closing's end (the door frame's `ul`). The company is pulled once, at
  the later road's end, and the stage word's `su` says it - no `ul` on the wire.
- **The shafts are the Deepway's.** The Low Road still goes down by its Drop (section 11.4 allows "a Drop or a shaft").
  A shaft keeps no alcoves or vignettes.
- **Not verified without a browser and the game's data:** the crusts, sheets, spouts and shafts were checked by their
  meshes, colliders and draws in node, never seen in the live game.

**The four hosts.** `src/scenes/world.js` - WIRED through its existing `registerSpireObjs` (the lit branches ride the
breach client's `objs()`); no line changed, nothing added to `function frame(now)`. `src/scenes/worldModes.js` - WIRED:
the circle's mesh and collider it already stands carry the shafts' walls and the spouts, and the spans it already stands
carry the slag's lanes; no line changed. `src/scenes/dungeonContext.js` - WIRED: `egSpanRide` and `egSpanCull` move and
cull the lanes; no line changed. `src/scenes/exterior.js` - FLAGGED: the bench holds no Elite Breach.

**Pins.**
- `test/net/eliteGates/egz_frag.test.js` (9). `tools/mutants/egz_frag.json` (48, every one dead).
- PIN MOVED: `test/net/eliteGates/egdur_relay.test.js` (EG_LAWS: law 5 the law since 2026-10-12, law 4 kept); `test/net/eliteGates/egseam_law.test.js`
  (EG4's record reads the Spire's pieces off law 4's courses, kept byte for byte); `test/net/eliteGates/egfrag_law.test.js` (a shaft's
  floors are no fight floors); `test/net/eliteGates/egfrag_client.test.js` (the client's `objs()` names its lit branches). Re-aimed by
  content: `egfrag.json`'s EGFRAG-a-closing-that-leaves-the-low-road, onto `forkClosing`'s end. Judged again over the
  files this slice touched: the records of `egfrag.json`, `egfull.json`, `egspan.json`, `egplay.json`, `eglook.json`,
  `egint.json`, `egseam.json` and `egmade.json` on them (178, every one dead).
- `RELAY_VERSION` `world197`, unshipped, rehashed (net/eliteGates/egLaw.js, egFragLaw.js, egSpanLaw.js, egBrain.js, egDurable.js
  and server/src/index.js moved). `ACCOUNT_VERSION` stays `acct121`.

### EG-ZB - 2026-10-12 - THE LEGION HUNTS

Mac: "I said I want everything". The last wave's legion slice: sections 8.2, 11.7, 19 and 21, all relay law. It closes
EG-PLAY's departure 6 for the span Harriers, layer three's "the legion walks straight to its mark ... an arch's walls do
not yet turn it", EG-H1's departures 3, 10 and 11, and EG-E's departure for the feats.

**What shipped, by piece.**

- **THE FIGHT GROUND** (`net/eliteGates/egWalkGraph.js` `egFightView`, `egGroundAt`, new, in the relay bundle). The spec gains no
  field: `EG_SPEC` stays 4 and `net/eliteGates/egDurable.js` `EG_LAWS` is untouched. Every reading is derived at runtime from the
  spec's own geometry and cached on the frozen spec.
  - The fight ground is `spec.fl` and, beside it, the ground the page fights on that the spec lays as plain discs: a
    span's islands and its two plates (section 8.2), and in any hall a Rampart's caster pillars (section 8.3, "reach them
    by short side spans") and its winch plates.
  - `egGroundAt` is section 11.7's band: with a height, the highest floor at or below the feet plus 0.5 m whose top is
    at most 3 m under them; with none, the lowest that holds the plan.
- **THE WALK GRAPH** (`egWalkGraph`, `egWalkNext`):
  - its REGIONS are the fight ground's pieces (a disc, a lane's capsule, each convex). A chamber's chokepoint arch
    (`deco` `arch`) splits its disc into two halves;
  - its NODES are where two pieces at one height overlap or touch (a portal, both ways), where a higher piece borders a
    lower one within 4.6 m (a lip stepped off, one way), a stair's foot and top (`spec.ramps`, both ways), and the arch's
    gap. Within a region every node sees every other;
  - a walker keeps its region (`b.fr`) and the node it walks to (`b.wn`), and goes by the shortest way over a dozen
    nodes (Dijkstra). With no way (a chasm between a passage's floors, the void between a span's islands, a perch with
    no stair up) it walks to the point of its own region nearest its goal;
  - `egArchCut`: a straight run that meets an arch's wall ends there.
- **THE AIR** (`egAirOf`, `egAirNext`, `egAirKeep`). The rock a flier cannot pass is a covered passage's rock mass
  (`EG_ROCK_M` either side of its tunnel), an arch's wall, and a chamber's wall ring (open only where the course comes in
  and goes on). A flier goes straight when the air is clear, else by the fewest metres over the mouths, the rock's corners
  and the gaps.
- **THE LEGION WALKS THE GRAPH** (`net/eliteGates/egLegion.js`):
  - every ground walker goes over the graph (`walkGraph`): the Harrier, which hovers along it, the Sapper, Breaker, Daedra
    Lord, Kynval, Caster, Lurker, Binder, the Ghost, the Deserter and the Standard;
  - the fliers (a Diver circling, a Wraith, a Shade, a span's and a hunt's Harriers) go about the rock (`walkAir`);
  - a Breaker's charge run into an arch's wall ends at it;
  - a pinned Caster's pillar is a region with no way off, so it now stays on its pillar.
- **THE SPAN'S LEGION** (`net/eliteGates/egBrain.js` `spanLegion`; section 8.2, with section 12's numbers):
  - the first wave rises 4 s after the wake (14 s after a Stillness), then one every `egWaveEveryMs(c)`, each of
    `egWaveSize(n)`, within the legion's cap. Hunting Pack adds its own wave on its own clock;
  - the Harriers rise in the air beside the members in turn (`EG_SHADOW_SIDE_M` out, `EG_SHADOW_AHEAD_M` ahead, kept out of
    a passage's rock). Each shadows the member nearest it (every member in the hall) and flies about the rock. Over a
    platform it hovers at its member and never bites; it bites only a member on an island or a plate;
  - from the Shade every other wave is led at half by Divers. They rise over the island or plate the leading member
    stands on or comes to next (`egIsleAhead`), circle it `EG_DIVER_WAIT_R` out, and dive their member once that member
    stands on it: ground at least `EG_DIVE_GROUND_M` (6 m) across, within the Dive's 10 m;
  - no die is drawn, so the breach's rolls after a span stay where they were;
  - on a span a member is aimed at only standing on the fight ground (`EG_SPAN_GROUND_PAD_M`). The span stage now ends as
    every trial does: its blows stepped and its words said (`ehp`, `etx`, `emk`, the whole fight every 2 s).
- **A BLOW FROM THE FIGHT GROUND** (`egBlow`; sections 11.7 and 21). A pose off it (`EG_STRIKE_PAD_M` about its plan, by
  the feet's height) strikes nothing: a step, a ledge, a side span, the top of an arch's wall. An object standing off the
  floor (a false wall in its alcove) is struck from beside it, as before. The relay now reads a pose's height:
  `server/src/index.js` `_egPose` and `_egBodies` carry `y`.
- **THE HUNT** (`huntStep`; section 11.7):
  - in a hall whose trial is one fight on its floor (`EG_HUNT_KINDS`: a Rift-Yard, a Rampart, a Proving Walk, an
    Athenaeum, a Court), a member who has stood on the fight ground this hall and is off it for more than
    `EG_HUNT_AFTER_MS` (6 s) is HUNTED;
  - the member is marked (mark 7, *Hunted* - the HUD's `EG_MARK_NAMES` held its word unread) for `EG_HUNT_MARK_MS` at a
    time, and unmarked back on the floor or at the door;
  - every Harrier goes to the hunted first: along the graph to the floor's edge nearest them, then through the air. Where
    no Harrier stands, a pair (`EG_HUNT_RAISE`) rises there, once a hunt;
  - a hunting Harrier's Bite carries `hn`, and the census judges it off the floors for that member alone.
- **THE CENSUS** (section 21; EG-H1's departures 3, 10 and 11 closed):
  - a Falling Wall's and the Collapsing Tube's fallen segments hold nobody (`net/eliteGates/egFair.js` `egSupportAt`'s `hw`; a fair
    trail keeps its hall's wake). Feet on one (`egFallenAt`) owe the count a cast-back, the screen's cast forward;
  - a traversal hazard is judged while its part burns, at the feet, wherever a body stands (`net/bossRef.js`
    `judgePlace`). A fire fall is seen (fire, nought counted); the Forge Line's hammers are counted at the screens' 20%;
  - THE DRAINS (`censusDrains`): a soul-wisp binds a member on a fight floor within 3 m and drains 3% a tick from a second
    in. It lets go at 6 m or after 4 s and binds again only `EG_WISP_AGAIN_MS` (6 s) later - the screens' `wispStep`. A
    Wraith's tether drains its member each tick within its 8 m;
  - THE CENSUS'S VESTIGES (`egCensusDr`): Challenger's Oath on a lord's blow (`EG_OATH_DR`); Bastion within 6 m (the
    strongest, 2% more for each other holder, 6% over it at most); Steadfast Line with three allies within 8 m; Immovable
    still a second on a fight floor (25%). Together they are capped at 30% (`EG_DR_MAX`), on blows. Featherstep's lighter
    cast-back (`egCastBackCost`, `EG_FEATHER_CAST`);
  - a lingering blow (a charge's run, a burning bridge - its `sp`) catches a body that steps in while it lasts, the
    screens' own verdict (`judgeShapes`). Before, it was judged at its landing alone;
  - every hit says its landing, thrower and name (`at`, `o`, `nm`), and the census keeps who each blow caught by its name
    on the fight (`F.cg`).
- **THE FEATS** (`net/eliteGates/egFeats.js`; section 19's examples). Grath's signature is the page's own: *Unsinged*, felled with
  no member caught by a burning bridge (`EG_FEAT_BRIDGE`, `egCaughtBy`) once the bridges have burned.

**Departures, said plainly.**

1. A code-built hall's walk graph is derived from the spec, not carried as the fragment record's `graph` (section 11.5).
   At this slice the spec gained no field, so `EG_SPEC` and `EG_LAWS` stood. EG-ZC's bump for the fragments is its own,
   and nothing here asked for one. Its nodes are only those the geometry implies. A passage's two floors are two regions;
   a chamber's ring has no node inside its floor. A hero's own `graph` is carried since EG-HERO-LAY (spec law 7's
   `heroes`) and joined to the hall's (`net/eliteGates/egWalkGraph.js`).
2. The Harriers' body-block is a Harrier hovering at its member, not a collider: the motor collides with no add.
3. The fight ground beyond `spec.fl` is a span's islands and plates and a Rampart's pillars and winch plates. Bridges
   and side spans stay traversal ground. On a span a member is aimed at within 0.5 m of it; elsewhere the fight's old
   4 m stands.
4. The hunt is for the halls whose trial is one fight on its floor, and only after the member has stood on the fight
   ground this hall:
   - an approach crossed is never hunted;
   - a Deepway (its passages crossed between floors) and a Brink are not hunted;
   - a span has its shadows instead.
   The mark's 30 s is renewed while the hunt lasts.
5. An object standing off the fight floor (a false wall) is still struck from beside it: a seal in a wall is no fight.
6. The census's Vestiges:
   - the reductions are summed and capped at 30%, on blows alone (not hazards, drains or cast-backs);
   - Featherstep is applied though section 21 leaves it to "the rest restores it": its cost is a number the relay holds;
   - Iron Footing needs no term: a push it resists makes no cast-back, and the poses say so.
7. The Forge Line's hammers count their 20% (the screens' share), not a cast-back's cost.
8. Only Grath's signature reads a catch: the page gives no other place's example. The Spellmaster's "no rune missed"
   is its none-failed. The others keep their beats.
9. A span's Divers dive ground 6 m across within their lane. A Diver in any other hall keeps its old rule (its member
   3 m inside the floor).

**The four hosts.**

- `src/scenes/world.js` - FLAGGED: not touched. This is relay law, and the screens draw what the relay says (the span's
  bodies, the `Hunted` mark on the HUD's marks line). Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: unchanged.
- `src/scenes/dungeonContext.js` - FLAGGED: unchanged.
- `src/scenes/exterior.js` - FLAGGED: offline (section 28).

**Pins.**

- `test/net/eliteGates/egz_legion.test.js` (7): the span's legion, the Divers, the walk graph, the fight ground and the hunt, the census,
  the feats, and the real Room.
- `tools/mutants/egz_legion.json` (56, every one dead). Two survived the first run and were killed by new assertions:
  - a lip climbed: both drop branches folded into one line, and a walker from under a balcony's lip;
  - the view without its islands: the span test's island moved to one no passage floor reaches.
- Re-aimed by content and judged again, every one dead:
  - `egint.json`'s six (the census's cast-back, the judge's stamp, an element's share, the wait, the floor, a hazard's
    element);
  - `egeco.json`'s Grath record (EGECO-a-bridges-catch-forgiven);
  - `int_lane3.json`'s INT11-CHARGE-TWICE (its own line made the only copy).
- Judged again over the files this slice touched: `egint.json`, `egfull.json`, `egfrag.json`, `egeco.json`,
  `egplay.json` and `egspan.json` (210, every one dead).
- PIN MOVED: `test/net/eliteGates/egeco_feats.test.js` (Grath's signature).
- `RELAY_VERSION` `world197` was rehashed with `net/eliteGates/egWalkGraph.js` in its graph. `ACCOUNT_VERSION` stays `acct121`.
- New in `src/`: `src/net/eliteGates/egWalkGraph.js`. The Port-Ledger's row is the lead's.

### EG-ZF - 2026-10-12 - THE RECAP WHOLE AND THE ACCOUNT'S MEMORY

(Mac: *"I said I want everything"*.) Closes EG-G1's first and fourth departures, EG-E2's mailbox send, and the gap
audit's rows 12, 13, 15 and 21: the damage chart at a lord's fall, each member's share and healing on the recap, the
recap's board line, the first-time lines once an account, and First of the Spire's letter.

**What shipped, by piece.**

- **The director's count** (`net/eliteGates/egTally.js`, new, in the relay's bundle; section 27.6). Every number is the relay's
  own count, never a screen's:
  - A Court's wake lays a chart on its fight (`F.tl`, `egTallyWake`). Each member's row holds what they dealt in the
    Court, the lord's part of it, the blows that landed, the heaviest, their falls there and what they healed in
    others. A blow is counted as egBlow believed it (`got`, after the gate's hand and purse and the lord's weight).
  - Each member's damage and healing over the whole breach sit on the member's record (`m.dt`, `m.ht`).
  - A companion's heal is said by its receiver. The healer is named by its peer id, which the room turns into the
    healer's account. It is credited to the healer, never to the receiver itself, a stranger, or one who never
    entered. It is believed within the receiver's heal bucket, which is the gate's (GATE-HEAL: a whole reference health
    refilled over `HEAL_REFILL_S`, `HEAL_DEPTH_X` deep). A fallen member's word is still heard; a forsaken one's, and
    any after the end, are not.
  - What was believed also mends the receiver's count, as an ally's mend and never out of its own budget
    (`net/eliteGates/egBrain.js` `egHeal` - `bodyHealed`, the gate's AUDIT INT11 law).
  - At this slice none of it bought anything: no receipt, no share of a Redoubt's earners (the director kept its own
    `dc`), no threat. It buys no threat still. But a believed heal has since become its healer's part in a hall for the
    earner rule (AUDIT EG III lane2 #3 - `hh`, `net/eliteGates/egBrain.js` `egActiveIn`), and since AUDIT EG IV (lane3 #3) it counts
    only where the room relayed that healer's cast to its receiver (`EG_HEAL_CAST_MS`). Section 16.1 holds the rule.
- **On the wire** (`net/wire.js`).
  - The Redoubt carries the chart (`rd`'s `dm`): `[sub, level, dealt, on the lord, blows, heaviest, falls, healed]`,
    at most a company's rows, most dealt first, ties in the company's order. Every member with a part, and every member
    standing in the Court at the fall, has a row.
  - An end that came at the lord's fall (a Rehearsal's, at Redoubt 1) carries its chart on the `end`. An end anywhere
    else (a tear, say) carries none.
  - Every `st` and the `end` carry each member's part (`ds`, `[sub, dealt, healed]`).
  - A bad chart is no chart, never no Redoubt. A state with bad tallies is no state, as its runs are.
  - The member's `heal` is the gate's own word, validated by `validGateIn`'s law. The breach's room hears it
    (`server/src/index.js` `_egFrame`).
  - `net/eliteGates/egLink.js` keeps `ds` and the last fall's `chart`.
- **The chart at a lord's fall** (`scenes/eliteGates/egClient.js`, `ui/eliteGates/egHud.js` `egChartFell`).
  - It is the gate's own chart (`ui/gate/gateDamageChart.js`), shown a beat after the Redoubt for its minute, to the side,
    in its one slot.
  - The crystals' column is the lord's part (*Lord*). The Healed column shows where anyone healed. My row is marked.
    The sub line names the lord: *Grath has fallen - a company of 3*, or *The Twin Lords have fallen*.
  - It is drawn from the online frame in every mode, so an end's chart outlives the walk out. Once its minute is up it
    is drawn no more, so it never takes the slot from a gate court's chart.
- **The recap's share and healing** (`ui/eliteGates/egHud.js` `egRecapModel`, `egRecapMemberLine`). Each member's row shows their
  share of the company's damage, in the gate chart's words, and what they healed where any:
  *II Ann - stood to the end, 1 fall, recall spent - 25% of the damage, 1,250 healed*.
- **The heal word out** (`scenes/eliteGates/egClient.js` `healedBy`). What my companions' spells healed in me is owed to each
  caster by peer id. It goes to the room once a second (`EG_HEAL_SEND_MS`) in whole points, the fractions kept for the
  next, inside the Spire alone.
- **The recap's board line** (`server-account/src/egHonours.js` `egStandingOf`; `ui/eliteGates/egHud.js` `egBoardLine`).
  - An end's claim answers the member's standing (`board`). Where the breach ranks on the Descent, that is its
    company's bracket and rank this season: `{ k: 'descent', br, rank }`. The company is the accounts that have
    claimed an end of the breach so far; if the same company has a better breach, that breach's place is given.
  - Otherwise it is the account's own rank on the Depths this season: `{ k: 'depths', rank }`.
  - A Rehearsal, or an end with no hall cleared, answers none. A re-claim answers the same.
  - The client puts the line on that breach's recap, the one standing or the one kept (`egRecapBoardKeep`), and on
    one still to be made: *The Descent, the Few: 14th*, *The Depths: 31st*.
- **The first-time lines once an account** (section 27.7).
  - The account keeps the lines it has been shown (`players.eg_first`, a bit a line in `EG_FIRST_KEYS`' order, the
    Rehearsal's after them). `POST /v1/eg/first { bits }` ORs them (`egFirstSay`) and answers `{ first }`; a guest is
    refused `guest` (403), and anything outside sixteen bits `bits` (400). `/v1/eg/keys` answers `first`.
  - The client reads the account's bits over the device's own (`ui/eliteGates/egBeats.js` `egFirstOver`), together with the lines
    this screen showed since. A line newly shown is kept on the device and told to the account; the next balance's
    answer carries a word that was lost.
  - Where no account answers, the device's `eg.first` holds.
- **First of the Spire's letter** (`server-account/src/egHonours.js` `EG_FIRST_POST`, `egFirstPost`; section 19).
  Hour's First's letter was the operator's send to names frozen the day they were known (`tools/sendServerPost.mjs`
  HOURS_FIRST, migration 0094). First of the Spire's names are not known until its company comes, so the list is the
  send:
  - an account `EG_FIRST_HANDLES` names is written its letter at its next balance's read, once (0093's one-a-send
    index);
  - the words are fixed, the developers', with no item: *Your company was the first ever to take Redoubt 10 of the
    Battlespire. The Spire remembers.* (*You were the first ever...* since AUDIT FB1020d L1-4: the first company came
    alone, `01-Overview/bugs/Field-Bugs-2026-10-20d.md`). The title and Firstlight are the account's by the list;
  - `post.js`, `net/postLaw.js` and the Accounts arc's SERVER-POST record now say so.

**Where it departs from this page, said plainly.**

1. The chart shows at a Court's fall (the Redoubt, or a Rehearsal's end) and nowhere else. A Proving Walk's champion
   and a Deepway chamber's are not lords, and no chart is laid for them.
2. The chart's sub line is the Spire's own words over the gate's model. The gate's *n challengers* has no Spire
   meaning.
3. The board line is the end's claim's answer, not the herald's: the herald posts to Discord and hands the client
   nothing. A recap made before its claim answers shows the line when the answer lands.
4. First of the Spire's letter is written by a route a player reaches (`/v1/eg/keys`), not by the operator's
   workflow. Only the operator's list chooses who gets it, and its words are fixed here.
5. A first-time line shown on a device signed in as a guest stays the device's. A guest holds no Weir Key and enters
   no breach, so none is ever said.

**The four hosts.**
- `src/scenes/world.js` - WIRED at this slice's merge: `online.onCast` hands the Spire the ally cast's healing
  (`egClient?.healedBy?.(id, healed)`, beside the gate court's `gateCourt?.healedBy`). The chart and the recap draw from
  the client's own online frame, and the account door (`accountEg(...).first`) is the client's. Nothing was added to
  `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED. It has nothing to wire: the chart is drawn from the online frame in every mode.
- `src/scenes/dungeonContext.js` - FLAGGED, for the same reason.
- `src/scenes/exterior.js` - FLAGGED as section 28 has it: offline, no breach.

**Pins.** `test/net/eliteGates/egz_recap.test.js` (10). `tools/mutants/egz_recap.json` (99, every one dead). PIN MOVED:
`test/net/eliteGates/egplay_relay.test.js` (`EG_KINDS` gains `heal`), `test/net/eliteGates/egplay_service.test.js` (the keys' answer carries
`first`) and `test/server/accountworker.test.js` (`players.eg_first`). Two records re-aimed by content, both still dead:
`egarch.json`'s EGF-the-relay-key-withheld (the keys' route hands `env` on) and `eglook.json`'s EGLOOK-client-look-kept
(`away()` puts the chart away after the look). `RELAY_VERSION` `world197` is re-hashed with
`net/eliteGates/egTally.js` in its graph (unshipped). `ACCOUNT_VERSION` stays `acct121`: 0111 is extended, unshipped. The
Ledger's ELITE-GATES row names `net/eliteGates/egTally.js`.

### EG-ZG - 2026-10-12 - THE TELEGRAPHS AS WRITTEN

Mac: "I said I want everything". It closes EG6b's telegraphs per fight
floor (section 11.7), section 25.5's grammars and section 25.2's Spire pools, what THE QUIET COMPANY still owed
(section 25.4), the Shade's rim lights (section 25.6) and WEIGHT (section 25.8) - EG-G2's "not built" for the allies,
the Vestige ring and the rim lights, EG-G1's eighth departure for the shakes, and EG-H1's ninth for the client's
arrow. The law is one new module, `world/eliteGates/egTelegraph.js`; the gate's own telegraph draw is unchanged byte for byte.

**What shipped, by piece.**

- **THE TELEGRAPHS PER FIGHT FLOOR** (`world/eliteGates/egTelegraph.js` `egFightFloors`, `egClipTris`,
  `egFloorPlan`; `render/gate/gateTelegraph.js` `drawFloors`).
  - Each fight floor (`spec.fl`) is triangulated once a hall: a disc into its drawn rim's 48 sides, a lane into its
    rectangle and two round ends, the floor test's own capsule (`net/eliteGates/egLaw.js` `egOnFight`).
  - Each frame, each shape goes on every floor it covers. The floor's triangles are clipped on the CPU to the shape's
    bounds (`telegraphBounds`, Sutherland-Hodgman, fanned back to triangles) into one buffer, uploaded once.
  - A shape lands only at the heights the relay judges it at: the floors whose plan holds its anchor within 1 m (its
    centre, a lane's two ends, each of a discs' points - `net/bossRef.js` `floorsUnder`'s rule). A blow on the court
    never draws on the balcony 3.6 m over it, whatever its bounds cover. The whole floor's and the spokes' draw on every
    floor.
  - At most 32 shape-floor draws a frame (`EG_FLOOR_DRAWS_MAX`), taken in THE TELEGRAPH BUDGET's order: mine and every
    shape whose field holds my feet first, then the blows by `egShapeOrder`'s rank (`sh.order` - a CHECK's havens keep
    their CHECK's), then the nearest my feet. Mine draw last, on top.
  - The Spire's vertex stage (`TELEGRAPH_VS_SPIRE`) is made from the gate's text by asserted swaps, as EG-G2's fragment
    stage is: a floor's triangle is read in the court's frame at `uFloorY` plus the lift. With nothing set it lays the
    gate's quad where the gate lays it.
  - `drawFloors` lends each floor's triangles to the gate's own `draw` for the call (its vertex array, its count, and
    the floor's circle as its court), so the line, the fill, the fog floor and every grammar are the gate's code. The
    quad and the uniforms are put back after.
  - A shape with its own surface draws its quad at that height (`sh.y`): a span's Vent and Pendulum, a traversal hazard
    (a fire fall, the hammer line), a Vestige's ring, a Drop's dust. In a hall with no fight floor every shape is the
    quad over the hall's court, as before.
- **THE GRAMMARS** (`TELEGRAPH_POOL_SPIRE`, pools laid into the Spire's fragment stage by one more asserted swap).
  - *A Spire pool* (pool 4): burning ground takes the band's ramp darkened (`egPoolRgb` - the fire-sea's, the Cairn's
    slate violet, the Shade's quicksilver, the Wellhead's molten, at half), its element's grain, the floor darkened
    under it, and a dashed rim in the palette's danger. Never `POOL_COLOR`, never blue.
  - *The pull-apart tether* (pool 5): the Wraith's Drain, the Blood Tether and a soul-wisp's hold on me. A red line the
    pair's length, chevrons pointing out from its middle and flowing outward, and a tick across it at the break. It
    thins toward the break (`egPullLook`). One of mine gone at 85% of its break or more snaps with the crystals'
    shatter, pitched high.
  - *The stay-close tether* (pool 6): Morvayn's Chaining. Chain links, every other turned; slack and dim under 6 m, taut
    and throbbing from 6 to 8 m (at most 3 Hz - `egChainLook`). Pinned: the two patterns never share a lit place.
  - *Chained*: *Chained to Mira - 6.8/8 m* stands under the crosshair (`egChainWords`).
  - *The peril arrow* (`egPerilOf`). It finds the soonest blow still to land on my feet - the relay's blows, a Rampart's
    told vents and the fragments' told hazards - never a whole floor's. Its way out is searched along the gate's 24
    bearings over MY fight floor only; a bearing stops at a wall, an open edge or another floor's height. A bearing that
    also clears every other pending shape is preferred over a nearer one that does not. It draws through the gate's own
    readout (`ui/gate/gateGroundView.js`): *Smash - move!*, the rim rising in the palette's danger, the arrow turned as the
    screen is. Under a CHECK with no light in reach the words are its order, *Stand in the light!*, with no arrow.
    Nothing shows on traversal ground, where no blow lands.
  - *The marks over heads*: each mark is its own sigil in Dagon red (`EG_SIGILS`, `ui/eliteGates/egSpireHud.js`
    `EG_SIGIL_PATHS`): a hound's tooth, a gem with its seconds, a flame and a snowflake with their rims tinted, a chain,
    a cage, the challenge's ring, an eye, a knot.
    - A companion's sigils hang over their head where the camera sees it (`drawEgSigils`, placed by the fight).
    - Mine stand on my HUD as sigils, their names given to a screen reader. The HUD's line of text is gone.
  - *The Eclipse*: each moon-shaft is a haven from 6 s out (as before). The HUD's chips show *The Eclipse - 5*
    (`egEclipseChip`). A wind rises once from 3 s out (Daggerfall's AmbientWindBlow1), and the toll sounds once at the
    strike. Over the last 2 s every fight floor darkens, to 62% at the strike, the moon-shafts kept (pool 8,
    `egEclipseDark`).
- **THE QUIET COMPANY'S REST**. During a trial the Spire's client says so through one seam (`ui/eliteGates/egAccess.js`
  `egAllyLookSet` / `egAllyLook`, from `egQuietCompany`'s 60% and no light). The spell engine every host shares reads it
  for another player's spell (`scenes/hostMagic.js` `spellVisual`):
  - the Morrowind casting effects and bolt draw at 60% (`scenes/mwMagicFx.js`; `render/vfxGpu.js` `vfxFade` - the
    quads' alpha where the blend reads it, all four where it adds the source as it is);
  - the classic missile flat draws translucent (the billboards' blended phase, `CONCEAL_MODE.reveal`);
  - its impact is the classic flash alone, translucent (`scenes/hitEffects.js` `showImpactFlash`'s `conceal`) - no
    bloom, no chunks, no burst in light, no camera kick;
  - a touch throws no spray of light, and a peer's Light spell is put out (`peerCandles`).
  - A Vestige aura (Bastion, the Spire's Standard - `egAuraHolders`) is one thin Battlemage-blue ring of 0.6 m at each
    living holder's feet, on the ground they stand on (pool 7).
- **THE SHADE'S RIM LIGHT** (`egRimOf`): in the Shade every foe's outline glows moon-silver. The glint is the wind-up
  glint's own (`systems/hitFlash.js` `setBatchGlint`): the sprite's outline, and the body lifted a little toward it. The
  dormant Lurker and any friend are left dark.
- **WEIGHT**.
  - The heavy blows shake the screen at their landing (`EG_HEAVY_SHAKE`, `egHeavyShake`): Savage, Gore and Whirl within
    10 m, Smash and the Maul within 8, by the gate's `LAND_SHAKE` law, never for a feint.
  - The shake goes through the port's one shaker (`betterAmbience.weaponKick`, under the player's maxShake). Reduced
    motion (the row or the system's) stills it, and Technique camera motion scales it (`egShakeMotion`).
  - My own hits flash a foe fully, anyone else's at 0.4 (`egBodyFlash`, the gate's `GATE_FLASH_COURT`). The relay's word
    of a drop within 400 ms of my own blow is my blow's echo, never a second flash.
  - A Drop the course asked for lands on a designed thud and dust, never on a hop on its landing (`egDropUnder`). The
    thud is Daggerfall's BodyFall and DungeonDoorClose, pitched down; the dust is a broken ring thrown out across the
    landing. While I fall onto one, the span says so (`scenes/eliteGates/egSpan.js` `overDrop`) and the dungeon arm plays no
    FallHard grunt for that landing.

**The four hosts.**
- `src/scenes/dungeonContext.js` - WIRED: its hard-landing branch asks the span's `overDrop` first. Nothing else moved:
  the fight's floor plan, the grammars and the HUD are the breach client's, drawn in the pass the arm already calls
  (`egClient.drawPass`).
- `src/scenes/world.js` - FLAGGED, nothing to wire: the fight's two new seams default to what world.js would hand it.
  `shake` is the port's one shaker (`betterAmbience.weaponKick`, imported by the fight as `scenes/hostMagic.js` imports
  it). `yaw` is read off the view the world pass already hands `drawPass` (`egViewYaw`, world/mat4.js lookAt's -z).
  Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED, nothing to wire: the span rides before the motor there already, so `overDrop`
  is set before the landing it speaks for.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Departures, said plainly.**
- **Done another way:**
  - a code-built hall's fight floors are discs and lanes in the law (`spec.fl`), not polygons, so such a floor is
    triangulated as the floor test reads it: a disc's 48 sides and a lane's capsule. A hero's fight floors are polygons
    (`{ t: 'p' }`) since EG-HERO-LAY, and are cut by ear clipping (`world/eliteGates/egTelegraph.js` `earCut`);
  - a lane floor's circle (the court the pass clips by and the whole floor's line follows) is the one through its ends,
    so on a lane floor the whole floor's line stands only at its two ends;
  - "the screen darkens" is the fight floors darkening, every moon-shaft kept. Walls and sky stay as they are: that is
    the telegraph pass's own floor, and no new pass was added;
  - the chain's chip, *6.8/8 m*, stands in the words under the crosshair beside *Chained to Mira*, not as a chip of its
    own;
  - an ally's impact is its classic flash alone, translucent. The bloom, the chunks and the burst in light are not drawn
    at 60% but left out, since they are the impact's own light;
  - an ally's Morrowind particles that blend nothing (opaque streams) stay whole: their alpha is never read.
- **Not built:**
  - `port:allyEffects` stays off the shelf. It governs allies' hit numbers alone, and the port draws none
    (`ui/hitNumbers.js`).
  - The Eclipse's toll is the bell's, not a band's own made sound.
- **Not verified without a browser and the game's data:** nothing was played in the live game. The shaders were run
  through `test/glsl.mjs`, the pass through a recording GL, and the fight against the director's own words.

**Pins.**
- `test/world/eliteGates/egz_telegraph.test.js` (13).
- `tools/mutants/egz_telegraph.json` (74 at the slice, every one dead; 75 since the merge of main #880-#899 below).
  One survived the first run - the sigils hung at a companion's eye rather than over the head - and was killed by
  pinning their height (EG_SIGIL_UP_M over the eye).
- At the merge of main #880-#899 (a43a033e63, 2026-10-14): main's AOE-PERF lays a path's or a tether's telegraph on a
  strip of its own (`render/gate/gateTelegraph.js` `telegraphStrip`, the walkways' quad laid along it). `drawFloors` lends the
  gate's `draw` a fight floor's own triangles, and a strip read as one of them (`uOnFloor`) would lie at the court's
  origin. So `draw` lays no strip while it holds a floor's triangles, and a path on a fight floor is drawn on that floor.
  Pinned in `test/world/eliteGates/egz_telegraph.test.js` (the floors' draws), mutant EGZ-floor-no-strip dead.
- Judged again over the files this slice touched: every record of `eglook.json` (12), `egpres_hud.json` (34),
  `egfrag.json` (11), `egspan.json` (9), `egint.json` (3), `mwspellfx1.json` (4), `fieldgun20.json` (2) and
  `egplay.json` (1) aimed at the fight, the HUD, the shelf, the span, the Morrowind effects or the flashes (76, every
  one dead).
- PIN MOVED: `test/scenes/audit26_render.test.js` F033 reads the impact flash's spawn, its entry and `showImpactFlash` with
  `conceal` in their tails (null by default - an ally's flash translucent in a trial); the blood defaults and the
  unscaled, unnudged flash are pinned as they were.
- No other pin moved. EG-G2's lab (`src/tools/spireLab.js`) still draws through the pass's plain `draw`, which is
  unchanged. `RELAY_VERSION` is untouched (nothing in the relay's graph moved), and `ACCOUNT_VERSION` stays `acct121`.
- New src module for the Ledger's ELITE-GATES row: `src/world/eliteGates/egTelegraph.js`.

### EG-ZH - 2026-10-12 - THE HALL'S SOUND, THE CAMERA, THE ART AND TOUCH

Closes the last of sections 11.6-11.9, 15, 25.1, 25.8, 26 and 27.8 that no layer built: the hall's reverb, the mix's peers
and Watchfire's tell, the camera in rock and the fragment's own clamp, Daggerfall's own fire in the Caverns, the death saves
that are no timers in the Spire, the Weir Key's own picture, and touch on the spans. EG-G2's "not built" lines for the
peers, the tell, the reverb's crossfade and TEXTURE.356 are closed here.

- **THE HALL'S REVERB** (`systems/eliteGates/egReverb.js`, new; `systems/audio.js`; `systems/betterAmbience.js`; read by
  `scenes/eliteGates/egClient.js`).
  - The law: each fragment's `reverb` (`net/eliteGates/egFragLaw.js` EG_FRAGS, carried on the hall spec's `frags`) as the engine's
    preset (`EG_REVERB_PRESETS` - Cave, Stoneroom, Quarry); a hall's own open ground Quarry (`EG_REVERB_OPEN`); a
    fragment's footprint its z-span and its reach across (a passage its cave's half width, a chamber half its span);
    `egReverbZoneAt` enters a zone at its edge and leaves it only `EG_REVERB_HYST_M` (1 m) past it.
  - The engine: `holdReverb(owner)` takes the zone (Better Ambience's zone off the send, and `setReverb` refused while it
    is held); `reverbZone(live, idle)` makes two convolvers behind the veil, each preset's impulse made once for the hold
    and a slot already holding its preset kept; `reverbFade(preset, seconds)` crossfades them over `EG_REVERB_FADE_S`
    (0.4 s), a third preset taking the idle slot on its cached impulse; `releaseReverb(owner)` (the holder's word alone)
    frees both convolvers and every impulse.
  - Better Ambience yields while the zone is held and forgets its cache, so its first frame after the release asserts its
    wish again.
  - The client holds it while I stand in the breach, and through a swap or an answer's step under way; the hall my feet
    stand in is made as it changes (a swap, a pull) and turned at a fragment's mouth; it is let go on the walk out and the
    first frame out of the breach.
- **THE SPIRE MIX'S PEERS AND WATCHFIRE** (`systems/eliteGates/egMix.js`, `net/peer/peerFx.js`, `scenes/eliteGates/egFight.js`; the scope in
  `systems/audio.js`).
  - The engine's `scaled(gain, fn)`: every one-shot (`playOneShot`, `play3d`) made inside it at `gain` times its own
    volume, nested scopes multiplying.
  - `net/peer/peerFx.js` `peerHeard(run)` and `setPeerSoundScope(fn)`: every peer sound plays inside it - the peers' blows and
    hurts (the fx player), the walkers' steps, swings and cries (`net/remotePlayers.js` `peerSound` and the cry), their
    climbs (`net/peer/peerClimb.js`).
  - The mix's `peers(on)` hands the scope in at `peerVolume` (4 dB down); the fight turns it on while a hall's fight runs
    and off on `leave`.
  - WATCHFIRE'S TELL (`EG_TELL_CUE`): the gate's sting (the parry's ring) at `EG_MIX.watchfirePitch` 1.4, played once a
    told blow as its outline first shows, where it will land (`egToldAt` - its first stamp with an origin, else my feet).
- **THE CAMERA IN ROCK** (`player/mwView.js`): `spireCameraEase` and `spireCameraFrame` laid on both lanes' eyes - in at
  once against a wall, back out at most the free distance each `SPIRE_CAMERA_EASE_S` (0.25 s), never past where the lane's
  own casts allow, along the line from the focal; a first-person frame a cut. The lanes' casts still decide the distance
  over the fragments' collider proxy (the drawn rock's inner envelope), so the camera never stands in visible rock. The
  client says when (`setSpireCamera` - alive in the Spire).
- **THE FRAGMENT'S OWN CLAMP** (`world/eliteGates/egHall.js` `egFragZones`, `egFragZoneAt`, `egFragKeep`, `egFragArena`; set by
  `scenes/eliteGates/egClient.js`). Each passage's cave and each fragment chamber's ring (a trial's own walled floor is never a
  fragment) extruded to its ceiling: the walls hold the feet a capsule inside, the head under the vault (the motor's
  `ceilAbove`); the mouths, an alcove's doorway, an open passage's sides and a ring's gaps are open edges; a body is a
  zone's within 1.5 m of its footprint (`EG_CLAMP_SLACK_M`). The client sets it as `player.arena` while I stand in a
  fragment and no other arena holds me (the world host sets those first each frame), and takes back only its own.
- **DAGGERFALL'S OWN FIRE** (`formats/baseImageFile.js`, `world/emissiveTextures.js`, `scenes/dataPipeline.js`).
  - `getFireWallColors32` ported verbatim from DFU's BaseImageFile.cs, on Unity's Color32 law in single precision
    (`unityColor32` - the Color to Color32 conversion, `Mathf.Round` half to even; `unityColor32Lerp` - Color32.Lerp, t
    clamped, the byte cast truncating), read from UnityCsReference 2019.4 (DFU builds on 2019.4.41).
  - `FIRE_WALL_COLOR` (0.706, 0.271, 0.086 - "Average of dim frame (0)") and `FIRE_WALL_SCALE` (0.3), TextureReader.cs:312
    and :315.
  - Both upload arms take it for TEXTURE.356 over the classic albedo (TextureReader.cs:303 and :309 - a pack's picture
    over the record still lights from the reference texture), and never on a stand-in. `test/render/audit39_render.test.js`
    re-pinned (PIN MOVED).
  - Tested on synthetic bytes - through a TextureFile's own palette and getColor32, and through the real pipeline with a made
    TEXTURE.356 in its archive table: Daggerfall's data is not here.
- **THE CAVERNS' FIRE FALLS** (`world/eliteGates/egHall.js` `egFireFallFlames`, `EG_FIRE_FALL`; drawn by `scenes/eliteGates/egFight.js`).
  TEXTURE.356 record 0 stands on each fire fall's line across its passage, 2 m wide a flame and as tall as the passage,
  while the fall burns; its frames turn at the billboards' rate (`render/flatAnimation.js` GENERAL_FPS), each uploaded once
  through the pipeline's frame door. The archive is asked once; with no data there are no flames and the telegraph still
  tells the fall.
- **THE DEATH SAVES AT A REDOUBT** (`systems/loot/lootPowers.js`; the door in `systems/sigil/sigilSetPowers.js`). Divine Grace and
  the Ghost-King's Vigil spent in an `eg:` room are held past their timers to the next Redoubt taken, as EG15 held the sets'
  (`lootSpireHeld`, `LOOT_SPIRE_SAVES`). Their chips read *Redoubt* and the round says nothing. The Redoubt recovers both,
  held or still on a timer, through `registerSpireRedoubt` (called by `spireRedoubtTaken`); the breach is the same host
  word (`spireRoomNow`). Out of the breach, or in another, their own timers govern.
- **THE WEIR KEY'S OWN PICTURE** (`world/eliteGates/egKeyArt.js`, new; `world/eliteGates/pseudoArchives.js` `EG_ARCH_BLOCK`;
  `systems/eliteGates/weirKey.js`). A Battlemage's key in the Galleries' gold leaf, its bow ringing a Battlemage-blue stone lit from
  within, a collar, a shaft and a two-step bit, 32 x 22, painted in code with the Hour's paint box. It is kept at the
  arch's block's second number (38282 - the page's "the arch, the key and the beacon": 38281, 38282, 38283), registered in
  the block's entry. The key's row names it in place of TEXTURE.211 record 50, and `systems/eliteGates/weirKey.js` puts it on the
  texture door at its import as its archive's stand-in, so every item door draws it.
- **TOUCH ON THE SPANS** (`ui/touch/touch.js`; the client's word, `setTouchSpire`). Inside an Elite Breach alone:
  - a Jump press that keeps sliding past the tap radius looks, with the drag's own gain;
  - an upward flick on the look half (`EG_FLICK_PX` 40 px within `EG_FLICK_MS` 150 ms) jumps, once a finger (the Jump key
    held two frames so the host's frame reads it);
  - on the spans (the Spire's traversal ground, `onTraverse`) the stick runs at full throw: Run at any push past the dead
    zone, and the analog reading at length 1.
  Out of the Spire the layer is TI2's.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED: untouched. Every seam is the breach client's (`scenes/eliteGates/egClient.js`, built there) or a
  registry its modules set (`setSpireCamera`, `setTouchSpire`, the sets' door). The clamp rides the online frame's order:
  the duel's frame sets `player.arena` before `egFrame` runs. Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: untouched. The fire falls are the fight's billboards, and the camera's ease rides
  `mwViewFrame`, which the dungeon arm already calls.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach. Its `mwViewFrame` and touch layer
  meet neither Spire branch.

**Departures, said plainly.**
- **Done another way:**
  - a hall with no fragment of its own is heard as open ground (Quarry), where the page names only the fragments'
    presets;
  - the reverb's two slots take a third preset by rebuilding the idle convolver on the hold's cached impulse - nothing is
    synthesised within a hall, but a convolver node is made at that mouth;
  - the reverb is let go on the first frame out of the breach or on the walk out, never during a swap's own step;
  - the fire falls are billboards (camera-facing, the fight's own batches) standing on the fall's line, not a mesh curtain
    in the circle's model, so they burn only while the fall does;
  - the Weir Key's picture is a stand-in of its archive on the texture door (its build answers the painted picture), the
    port's other painted art's way.
- **Not built:** the haptics and the pad's rumble of section 27.8 stand as EG-G1 built them. (The relay's half of
  section 11.7 - a blow refused off the fight floors, and the Harriers' hunt - was EG-ZB's.)
- **Not verified without a browser and the game's data:** the reverb was heard by no ear (driven against a recording Web
  Audio graph); the fire falls were never seen with a real TEXTURE.356 (its frames' count and look are the player's data's);
  the key's picture was checked as texels, not in the inventory; the touch branch was driven on the stub DOM, not a phone.

**Pins.**
- `test/net/eliteGates/egz_sound.test.js` (7), `test/systems/eliteGates/egz_art.test.js` (8), `test/systems/eliteGates/egz_body.test.js` (9).
- `tools/mutants/egz_sound.json` (115, every one dead). Five survived the first run and were killed by new assertions: an
  impulse synthesised again, TEXTURE.356 asked twice in flight, the ground's colour, a trial's wall as a fragment's, and the
  flick's Jump never lifted. One record was re-aimed to a mutant the tests can see: the key's ground alpha, which `image()`
  already leaves clear, became the ground's colour.
- Re-aimed by content (mutantdrift): `audit0928_input.json`'s two U3 records (the stick's Run line), `egint.json`'s
  EGINT-the-told-never-drawn, `loot5.json`'s grace and vigil gates; `cardstouch.json`'s CT-gyro kept one site by this
  slice's own line's order. All six re-run, dead.
- PIN MOVED: `test/render/audit39_render.test.js` (the fire walls take GetFireWallColors32). `bible/06-Systems/Systems.md` counts
  517 modules. `bible/07-Rendering/Rendering.md` and `Rendering-Arc.md` say GetFireWallColors32 shipped.
- `RELAY_VERSION` untouched: nothing in the relay's import graph moved. `ACCOUNT_VERSION` stays `acct121`; no migration.

### EG-ZI - 2026-10-12 - THE DIRECTOR'S LAST RULES: THE TOLL, THE LATE WAKE, LIFELINE

Mac: "I said I want everything". The director's three rules no slice had built: section 10.6's toll (the pull moved
everyone at no cost), section 7's late wake (the gather waited `EG_ARRIVE_MAX_MS` for everyone, always) and section 21's
Lifeline in the census. It closes EG-ZB's departure 8 for Lifeline and the last of EG-H1's departure 10 (the census now
applies every Vestige section 21 names); both sentences are deleted above.

**What shipped, by piece.**

- **THE PULL'S TOLL** (`net/eliteGates/egBrain.js` `egTollOf`, `tollStep`; `net/eliteGates/egLaw.js` `EG_TOLL_STEP`, `EG_TOLL_QUARTERS`,
  `EG_TOLL_WAIVE_MS`, `EG_TOLL_KINDS`; section 10.6).
  - At a crossed hall's pull (`EG_TOLL_KINDS`: the Span, the Deepway, a Brink, the Proving Walk - the halls whose closing
    is the span's 45 s), each living member is told its toll before the pull's stage: `{k:'toll', q, h}`, to it alone.
  - `q` is the quarters of its road still ahead of its furthest fair point, every quarter begun counted whole, 5% of its
    health each, at most four. The road is the hall's +z from the arrival plate to the end plate, in whole centimetres.
  - Nothing is owed by a member who stepped through the door (`downH`), who stood at it on a fair trail (`A.atEnd`, set
    by `egPoseIn` where the crossing is measured), or who reached new ground in its last 15 s (`A.fnew`). Only the idle
    pay, and trying and falling short costs less than standing still.
  - A member the relay judged no fair pose of in the hall stands at the arrival plate: the whole road.
- **THE FURTHEST FAIR POINT** (`net/eliteGates/egFair.js` `farther`, `groundAt`; the trail's `far`, `fnew`, `seen`, `atEnd`).
  - After every pose of a fair trail, a held pose (still ground, a piece, the end plate) with no break since the last
    island moves `far`. A pose in the air, or one a broken stretch reached, moves nothing.
  - Still ground first stood on so this hall is new ground, `fnew` its instant: an island, a court, a balcony, a
    passage's floor, a walkway, a bridge, a stair. The arrival plate, a piece and the end plate are never new ground.
  - `groundAt` is `egSupportAt`'s own first reads, keyed (`a` the arrival plate, `e` the end plate, `d<i>`, `b<i>`,
    `l<i>`, `r<i>`), and `egSupportAt` now asks it. Its answers are unchanged, and the client's last island
    (`islandFrame`) reads them as before.
- **THE TOLL COUNTED** (`egCountHeals`). The room's census reads `toll` as it fans it, as it reads the fray's lash. The
  share is taken off the member's count as a blow is (`bodyStruck`, into the census's thousandths `cs[3]`), never the
  last of it. A witness's count is untouched.
- **THE TOLL PAID AND SAID** (`scenes/eliteGates/egClient.js` `payToll`, beside the void's `castBack`; `ui/eliteGates/egBeats.js`
  `EG_PRES_TEXT.toll`, `tollLine`; section 27.5's row: *The Spire pulls you down.* and the toll).
  - The screen pays it as it pays the void's cost: its share of my health through the host's hurt door, never the last
    of it, once a hall, and only inside the Spire.
  - It says it: *-15%* on the screen, as the cast-back's *-10%*, and *The Spire takes its toll: 15% of your health.* in
    the chat beside the pull's own line.
- **THE WIRE** (`net/wire.js`): `toll` joins `EG_RUN_KINDS`, its quarters held to 1..`EG_TOLL_WIRE_MAX` (4, pinned equal
  to the law's `EG_TOLL_QUARTERS` - wire.js imports no law of the Spire's) and its hall to the hall bound. It is never a
  member's word.
- **THE LATE WAKE** (`net/eliteGates/egBrain.js` `wake`, `arriveWait`; `net/eliteGates/egLaw.js` `EG_LATE_HALLS`, `EG_LATE_ARRIVE_MS`;
  section 7).
  - Each wake counts a living member late (`m.late`) when the hall woke before its `here`; a hall it said `here` in
    begins the count again.
  - The gather waits `EG_LATE_ARRIVE_MS` (10 s) after the pull, not 30 s, once every living member still owed has woken
    late in the two halls before. A member owed who is not late keeps the whole wait for the company.
  - The stage's end (`su`) is said as it moves: at the pull, at the next circle's first hall, and in the arrive stage as
    members arrive and only the late are left.
  - **A late `here`, heard.** A member the hall woke without says `here` when it reaches the arrival plate in the trial
    or the closing, and its trail is judged from there. Before, the director heard `here` only in the arrive stage, so
    a member who woke late was never judged in that hall: its door, its caches and its toll read no trail of it.
- **LIFELINE IN THE CENSUS** (`net/eliteGates/egBrain.js` `egHeal`, `egCensusDr`, `EG_LIFELINE_UNDER`, `EG_LIFELINE_MS`,
  `EG_HEAL_WORD_MS`, `EG_LIFELINE_LOOK_MS`; sections 15 and 21).
  - The room hears `heal` since EG-ZF (`egHeal`). A believed heal of a Lifeline holder's on a member under 30% opens a
    window on that member's blows (`m.ll`: `[from, until, share]`), at the healer's rank: 20, 30 or 40% (AUDIT EG III:
    20, 25 or 30% since - III's 40% never applied under the census's 30%).
  - "Under 30%" is read three ways: its count now, the count seen so at a beat (`egCount` notes `m.lowAt`), or its own
    word of its body saying so (`egBodyWord` notes it too). The look back is the heal word's second and a beat
    (`EG_LIFELINE_LOOK_MS`). The word comes up to `EG_HEAL_SEND_MS` (pinned equal to `EG_HEAL_WORD_MS`) after the heal,
    by when the member's own word may have stood its count up.
  - A healer counts only where its own credit rose: a heal not believed, the member's own heal, or a healer of no
    breach opens nothing.
  - `egCensusDr` spares a blow landing inside a window by the strongest window's share, inside the census's 30%. Windows
    a blow can no longer be judged in (`EG_TRAIL_MS`) are let go, and four are kept at most.
  - The stale comment ("the ALLY-CAST frame, which the relay forwards unread") is gone.

**Departures, said plainly.**

1. **The road** is measured along the hall's +z, on either road of a fork. The Low Road's bridges across and back (which
   `egCrossMinMs` adds to its bound) are no length of the toll's.
2. **Every quarter begun is counted whole.** "Each quarter of their road still ahead" is read as the page's first clause
   asks: a member pulled a step short of the end pays one quarter.
3. **The toll never takes the last of a member's health**: the screen keeps a point and the census a hundredth, as the
   fray's lash does. The page names no floor, and a toll that killed would be a fall mid-stair, which belongs to no hall.
4. **"A new island, or a fragment's node"** is new still ground of the support law, first stood on fairly this hall. A
   code-built fragment carries no record `graph` (EG-ZB's departure 1), so its floors and stairs stand for its nodes. A
   hero's floors stand for its nodes too since EG-HERO-LAY (`net/eliteGates/egFair.js` `groundAt`'s `h<i>`): the graph its law
   carries is the legion's, never the toll's.
5. **The halls tolled** are those whose closing is the span's (`door`'s own group): the Span (section 7), the Deepway
   (section 8.8), a Brink and the Proving Walk, whose roads are crossed in the same 45 s. A fight's and a Court's pull
   costs nothing.
6. **A member never judged in the hall** (a socket that sent no pose there since its `here`) pays from the arrival
   plate. The fair trail believes such a member for a credit; the toll, which is a cost, does not.
7. **"Woke late"** is the hall woken before the member's `here`. "The wait for them" is 10 s once every member still owed
   is such a one. The count runs on across a Redoubt: a Court is a hall.
8. **The late `here`** is a change to integrity, done here because the toll reads the trail. A member who woke late is
   now judged from the plate, where before nothing it did in that hall was.
9. **Lifeline's window** runs from the heal word's second back (`now - EG_HEAL_WORD_MS`) to 3 s past the word: every blow
   that could land inside the 3 s of a heal the word says, 4 s at most, in the struck member's favour as every judge of
   the relay's is (`BODY_MARGIN`). The word carries no heal's instant.
10. **Two Lifelines at once** take the strongest, never a sum. Section 15's stacking is for auras, and Lifeline is none.
11. **The toll's words** are `EG_PRES_TEXT`'s (the client's), not `EG_TEXT`'s, as EG-G1's beats are. A word in `EG_TEXT`
    would move the relay's law hash for a line the relay never says. The toll plays no sound of its own: the pull's row's
    sound is the veil's close.

**The four hosts.**

- `src/scenes/world.js` - FLAGGED, nothing to wire. The toll is paid through the `hurt` seam world.js already hands the
  client (*the void is a setback, never a death*), and said through its `say` and `mid`. Nothing was added to
  `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: unchanged. The toll is paid where the client hears the room's word, in every
  mode, and the pull's step to the next plate is the client's own, as before.
- `src/scenes/dungeonContext.js` - FLAGGED: unchanged.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Not verified without a browser and the game's data:** nothing was played in the live game. The toll was paid on the
stub screen of `test/net/eliteGates/egz_recap.test.js`'s harness. The pull, its frames and the census's share ran in the relay's real
Room (`test/fakeRoom.mjs`), and the late wake and Lifeline against the director.

**Pins.**

- `test/net/eliteGates/egz_rules.test.js` (7): the furthest fair point, the toll's law, the pull's toll, the wire and the screen, the
  late wake, Lifeline in the census, and the real Room.
- `tools/mutants/egz_rules.json` (78, every one dead).
- Re-aimed by content, both dead: `egint.json`'s EGINT-the-end-plate-an-island and `egz_legion.json`'s
  EGZ-a-fallen-segment-holding. `egSupportAt`'s still ground is now `groundAt`'s, read by key.
- Judged again over the files this slice touched: every record of `egint.json` (33), `egz_legion.json` (30),
  `egz_recap.json` (31), `egplay.json` (9), `egpres_hud.json` (23), `egfull.json` (15), `egeco.json` (3) and
  `egz_return.json` (43) aimed at `net/eliteGates/egFair.js`, `net/eliteGates/egBrain.js`, `scenes/eliteGates/egClient.js` or `ui/eliteGates/egBeats.js` (187, every
  one dead). No record of any list aims at a changed line of `net/eliteGates/egLaw.js` or `net/wire.js`.
- No pin moved. `RELAY_VERSION` `world198` is rehashed in place (unshipped): `net/eliteGates/egLaw.js`, `net/eliteGates/egFair.js`,
  `net/eliteGates/egBrain.js` and `net/wire.js` moved, and nothing joined the bundle. `ACCOUNT_VERSION` stays `acct121`; no
  migration. No new file in `src/`, so the Ledger's ELITE-GATES row is unchanged.

### EG-ZO - 2026-10-12 - THE FALL PAST THE SPIRE'S UNDERSIDE

Mac: "I said I want everything". Section 7's stair, the full fall a company sees at a band's first hall (Hall 1, each Brink
and a Brink start), is now a camera falling past a modelled underside of the Spire. EG-ZE painted it as a picture on the
veil's canvas. This closes EG-ZE's departure 2: its sentence is deleted, the departures after it are renumbered, and the
record's own pointer to its old sixth moves with them. The 0.8 s veil at every other step, the plain cut under reduced
motion, the hall held centred and the band's chime are unchanged.

**What shipped, by piece.**

- **THE UNDERSIDE MODELLED** (`world/eliteGates/egUnderside.js`, new).
  - It is built with the arc's one mesh kit (`world/eliteGates/meshKit.js`: its quads, triangles, prisms, lathes and extrusions).
    It has 2,660 triangles and a sub-mesh for each of its four records (`EG_UNDERSIDE_RECORDS`): the floor's flags, the
    band's metal, the undersides' strata and the walls' ashlar. Each sits under the band's own archive
    (`world/eliteGates/egBandArt.js`), the band the step falls into.
  - THE PLAN (`egUndersidePlan`) is seeded and the same for every band, because the Spire is one:
    - the torn floor, 44 m across its ragged rim (32 corners, 10% either way) and 4.5 m thick, its broken edge the walls'
      ashlar;
    - the rock torn up with it, hanging 40 m under it in eight rings. The rings narrow by the rock's taper
      (`egUndersideRockR`), are jittered, and are cake-stepped, each ledge facing down into the deep's light. The top
      ring follows the rim inward, so the floor's underside never folds;
    - ten spires of rock, 14 to 30 m long, bent away and broken at the tip by the islands' own law
      (`egUndersideSpireRing`, after `world/superDungeon/sdIslandModel.js` spireRing);
    - six galleries' broken floors jutting from the flank;
    - the colonnade of the hall above, seven columns hanging upside down under the rim;
    - six girders of the band's metal welded through the rock.
  - Nothing stands over the floor, and nothing is wider than its rim. The strata run by depth (the undersides' record
    top to tip: the torn lip, the courses, the works, the haze), and every broken tip is in the haze.
  - `egBandArtOf(band, rec)` (`world/eliteGates/egBandArt.js`) paints one of a band's pictures alone, the same pixels as its whole
    dress (`egBandArt` now reads it record by record). The fall paints four. It never paints the walkways' tesserae, which
    took 92 ms of a band's ~100 ms dress, measured in node.
- **THE FALL'S CAMERA** (`EG_FALL`, `egFallDepth`, `egFallPitch`, `egFallEye`, `egFallCamera`).
  - The eye steps off the torn floor's rim (58 m from the axis, an eye's height over the floor) and faces the axis.
  - It falls from rest toward 44 m/s against the void's drag, v (t - tau (1 - e^(-t/tau))) with tau 0.7 s, and drifts
    0.8 m outward for each metre fallen.
  - Its eyes rise from 11.5 degrees down (the void opening under it) to 24 degrees up (the underside climbing away
    overhead). The raise is eased over the stair's own 2.8 s: 0.8 s in, the 1.2 s least hold, 0.8 s out
    (`world/eliteGates/egLights.js` EG_STAIR_VEIL, `EG_FALL_SPAN`). It is still at both ends, and nothing else turns.
  - As timed, the eye is among the spires as the veil shuts (0.8 s, 14 m fallen) and below the last stone as the least
    hold ends (2.0 s, 57 m down against the main tip's 46). It never comes within 10 m of the rock, and the underside
    stays on the screen, climbing it, through the longest hold the veil allows (20 s).
- **THE STAIR'S PASS** (`render/eliteGates/egStairPass.js`).
  - In the fall, the triangle paints the band's void along the falling camera's rays (`fallRay`; the ray basis is
    `render/superDungeon/sdSky.js` sdSkyBasisInto's): the deep below rising to meet the faller, and embers streaking up past the eye.
  - The painted underside (`undersideEdge` and its black) is gone. With it went the picture's own reversed edge,
    `smoothstep(edge + 0.03, edge, e)`, which SD20c's sweep could not read because its edges were not literals.
  - EG-ZE's fix stands as written: `c += DEEP[b] * 0.35 * k * smoothstep(0.0, 1.0, -e);`.
  - THE UNDERSIDE'S PROGRAM (`EG_UNDERSIDE_VS`, `EG_UNDERSIDE_FS`) draws the model through the camera, depth-tested and
    written, with back faces culled.
  - It is lit by the place alone (`EG_UNDERSIDE_LOOK`): the deep from below, the horizon all round, the zenith from above,
    and the Shade's moon where `render/eliteGates/egSkyPass.js` stands it.
  - It melts into the band's void with distance (0.004 a metre). Both programs paint the same void (`EG_VOID_GLSL`). It is
    dithered in and out with the veil and posterized as the stair is.
  - `upload(parts)` builds the program the first time and keeps it with the pass. A program that will not build is never
    tried again, and the void is drawn alone.
  - The upload makes a vertex array, three vertex buffers, the pack's Uint32 index buffer and a picture a record (nearest
    up close, mipmapped, the strata clamped top to tip). An `EgUnderside` owns them, and its `destroy` frees every one,
    once. An upload that fails part way frees what it made.
- **THE VEIL** (`ui/gate/gateVeil.js`).
  - Its canvas asks for a depth buffer. The fire's and the Hour's looks never test against it.
  - A fall taken starts its own underside (`fallTake`). The underside is made a slice a tick (`fallSlice`: the rock, the
    spires, the wreck, the pack, then four pictures), from the stair's first frame. That is eight ticks, about 0.13 s of
    the 0.8 s closing, and the upload is one more slice.
  - No slice runs in the tick the veil shuts in, because that tick's end runs the step's own work: THE SWAP.
  - The fall is drawn every frame through the falling camera on the stair's own clock, with the hall held centred over it.
  - EVERY ALLOCATION HAS AN OWNER. `fallFree` empties the slot first, then frees the underside, on every exit:
    - the veil opened;
    - a look that is not this fall taken (a flash);
    - another band's fall;
    - the veil destroyed, before the pass that drew it.
- **THE SWAP UNDER IT** (`scenes/eliteGates/egClient.js`, unchanged). The step into Hall 26 is EG-H3's circle swap in place (the next
  circle built during the rest, `egSwapCircle`) under the full fall. Played with a real veil, the swap stands while the
  veil is shut, after the underside stood, in a tick that made none of it, and the underside is drawn on through the hold.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED: untouched. The veil is the world host's (`host.gateVeil`), and the fall needs nothing of
  its frame.
- `src/scenes/worldModes.js` - FLAGGED: untouched. `stepThroughFire(go, look, opts)` hands the veil the step's look, and
  the swap in place runs inside it as before.
- `src/scenes/dungeonContext.js` - FLAGGED: it has nothing to wire.
- `src/scenes/exterior.js` - FLAGGED, as section 28 has it: offline, no breach.

**Departures, said plainly.**
- **The fall's camera is the stair's own, on the veil's canvas** (its own GL context, a third of the pixels), not the
  world's camera. Under the veil the world's place is being torn down and stood again (THE SWAP), and the veil keeps
  drawing while the place beyond is built. A fall in the world's renderer would draw the hall being swapped, and would
  need the hosts' frames.
- **The fall is faster than a body falls**: from rest at v/tau (63 m/s per second) toward 44 m/s, so the underside is
  passed inside the 1.2 s least hold.
- **The underside has no light of its own.** Its metal's rubbed glint (the band's emission picture) is not uploaded, so
  the deep alone lights it, as SD-LOOK's structure is lit.
- **One underside for every band**, dressed in each band's stone. The hall's sky (`render/eliteGates/egSkyPass.js`) still paints the
  underside as a shape, smaller each band, once the step lands.
- **The fall's first frames show the void alone**: about eight frames, while the dither has taken a sliver of the screen.
  Nothing of the fall is made during the rest. Its parts are made in the closing's first frames, which no swap's work
  shares, and freed as it ends.
- **Not verified without a browser and the game's data.** Nothing here has run in a browser. The shaders were evaluated
  through `test/glsl.mjs`, the pass and the veil ran over a recording GL, and the client was played with a real veil
  against the relay's own words. The fall's look (the stone in the deep's light, the haze, the motion's comfort) has not
  been seen.

**Pins.**
- `test/world/eliteGates/egz_fall.test.js` (7).
- `tools/mutants/egz_fall.json` (79, every one dead). Two survived the first run, a freed underside drawn and one freed
  twice. Both were hidden by `destroy` clearing its lists, which also left `live` meaning nothing. `destroy` now rests on
  `live` alone, and the draw's pin reads that nothing of a freed underside is drawn.
- PIN MOVED: `test/net/eliteGates/egz_stair.test.js`. The stair's build is refused by the stair's own text (`stairScene`), and its shader
  test no longer holds the picture's underside. `tools/mutants/egz_stair.json` loses the two records aimed at that
  picture (EGZ-the-underside-never-falls, EGZ-the-underside-never-black).
- Judged again over the three files this slice touched that other lists aim at (`render/eliteGates/egStairPass.js`,
  `ui/gate/gateVeil.js`, `world/eliteGates/egBandArt.js`): 51 records in six lists (`auditwb_sound` 3, `eglook` 5, `egz_stair` 21, `sd11d` 4, `sd25_look` 10, `wb6c` 8), every
  one dead.
- `bible/07-Rendering/Rendering.md`'s row for the stair's pass says the fall is modelled.
- `RELAY_VERSION` untouched: nothing in the relay's graph moved. `ACCOUNT_VERSION` stays `acct121`; no migration.
- New in `src/`: `src/world/eliteGates/egUnderside.js`, named in the Ledger's ELITE-GATES row.

### EG6c - 2026-10-12 - HERO FRAGMENTS: THE BAKE AND ONE REFERENCE FRAGMENT

Mac authors the hero fragments in Blender (section 11.6, "Authored hero fragments (EG6c, as Mac authors them)"). This slice
builds what turns his scene into a fragment: the bake, the law half's reader, where a baked fragment is registered, and
one reference fragment of the port's own standing in for his until they arrive. It keeps section 10.5's ceiling clamp and
section 11.5's volumes-apart rejection as far as one fragment's bake can keep them. Two of layer three's sentences are
narrowed. "Still owed by EG-D: the authored hero fragments" now owes only their laying, which waits for his (EG-HERO-LAY:
built - spec law 7 lays every registered hero but the reference). Its departure
that "a fragment's law lives in the spec's own fields, not a separate record" now holds for the code-built kits alone.

**What shipped, by piece.**

- **THE BAKE** (`tools/fragBake.mjs`, new). `bakeFrag(fbxBytes, spec)` turns one fragment's scene into its two halves:
  - it walks the scene with `tools/shipBake.mjs` `sceneObjects`, which refuses by name an export in other axes, any
    transform past T*R*S and a mirroring one;
  - it cuts each polygon with `fillFace` (Blender 5.1's cut, or refused) and welds each art object's normals and UVs on the
    authored triple with `tools/fbxMesh.mjs` `layerReader` and `cornerWelder`, so a UV seam or a hard edge keeps its split;
  - it writes one sub-mesh for each band dress record, lowest first, and bakes the named markers to section 11.5's record.
  The record must pass `net/eliteGates/egFragLaw.js` `egFragRecordFault`, and THE TIMED SOLVER must prove its inner course. Its spec
  (`{ id, kit, class, variant, play, source }`) names the fragment, its library kit, its class, which hero of the kit it is
  and a chamber's play; its band, reverb, light and engine follow from the kit (`EG_FRAGS`). Each half is written one key
  a line (`fragJson`), and a re-bake gives the same bytes. `node tools/fragBake.mjs --list <in.fbx>` prints every object
  as the bake reads it.
- **ONE DFU MEMBER, ONE EXPORT** (the page's "export from them what you need"):
  - `tools/fbxMesh.mjs` exports `layerReader` and the weld it used inline, `cornerWelder`. `bakeMesh` welds through it,
    and every Morrowind bake keeps its bytes;
  - `tools/shipBake.mjs` `sceneObjects` gives each object it reads its Geometry (`geo`) and `normal`, which places a normal
    as the object's vertices are placed (the inverse transpose of its T*R*S and the file's frame). The ships and the gate
    never ask for either;
  - the binary FBX writer moved whole out of `test/tooling/fbxmesh.test.js` into `tools/fbxWrite.mjs`, so the fixture and the
    reference are written by one writer.
- **THE FRAME.** A scene point (X, Y, Z) is the fragment's (X, Z, Y), measured from the middle of the mouth's bottom edge.
  The swap is a mirror in the numbers, the same one `tools/bakeGate.mjs` uses to keep Mac's model his own in the
  left-handed world: each triangle is wound back through it, so (b - a) x (c - a) faces out along its normals, and each
  normal goes through it as a vector. The law half is in whole centimetres, rounded half away from zero, so a mouth stands
  exactly at its own middle. The mesh is in metres to 0.1 mm.
- **THE LAW HALF, READ** (the EG6c section of `net/eliteGates/egFragLaw.js`, at its end). Section 11.5's record (the header lists its
  fields), with this reader:
  - `egFragRecordFault` checks the version, whole numbers, the kit's band, class and reverb, a chamber's play and fight
    floor, the sockets, floors, ramps, open edges, ceilings, the walk graph, the anchors, every hazard's shape
    (`EG_HAZARD_SHAPES`) and law (`egHazardLawful`: THE WIDTH RULE, THE WIND-UP FLOOR), the course, alcoves, lights, the
    budget (`EG_FRAG_BUDGET`, section 11.9's starting bounds) and the proof;
  - `egFragCeilAt`, `egFragApart`, `egFragBoxAt` and `egFragSwept` answer what a laying asks;
  - `egFragSteps` and `egFragHazards` give the record as a hall spec's steps and hazards, in metres and seconds and placed
    at an origin.
  The section decides in integers and calls none of section 9's banned functions (a source sweep). Nothing the relay runs
  calls it yet.
- **THE CEILING CLAMP AT BAKE TIME** (sections 10.5, 11.7 and 11.8). Every floor stands either wholly under a ceiling or
  wholly open to the sky, because the motor's clamp extrudes a floor to one ceiling.
  - The ceiling over a floor keeps its class's headroom (`EG_FRAG_HEADROOM_CM`): 3.5 m in a passage or a shaft, 6 m in a
    chamber. A ramp keeps 3.5 m at every corner.
  - The ceiling over every inner piece's whole travel keeps THE FAST BUILD's flight clear: its 2.68 m apex and the
    capsule's 1.8 m, 4.5 m together. So the clamp never cuts short a flight the solver proved. Pinned at 4.4 m (refused)
    and 4.5 m (stands).
- **VOLUMES STAND APART AT BAKE TIME** (section 11.5).
  - The record's `box` covers every drawn vertex, every marker, every opening's snapped width, every hazard's plan (an
    Eclipse's havens' reach among them) and every inner piece's travel. The reader refuses a record whose law stands
    outside it, so a laying that keeps boxes `EG_FRAG_APART_CM` (2 m) apart (`egFragApart`) keeps the whole fragment
    apart.
  - The mouth is the box's -Z face and every exit its +Z face, to `EG_FRAG_SOCKET_TOL_CM` (10 cm), so the course meets
    the fragment at its sockets.
  - An inner course with no ground before or after it is refused.
- **THE REFERENCE FRAGMENT**:
  - `tools/egRefFragScene.mjs` writes it from numbers alone: no game data, no third-party art, no trigonometry. It is
    written as Blender's FBX exporter writes a scene: object origins at their middles, -90 degrees about X, a scale of
    100, normals and UVs by polygon vertex, and materials by polygon. Its SceneInfo names its writer (`FRAG_REF_WRITER`),
    never a Blender;
  - it is a 30 m Oblivion Caverns passage whose vault is open to the burning sky over its chasm. It has a threshold and a
    fight floor of two faces before the chasm, two ledges and a Drift across it, and a fight floor after it with a stair
    up to a Caster's balcony. Its two exits are one from the floor and one from the balcony, 1.5 m up. It also has a fire
    fall, a surge, falling basalt, an alcove behind the west wall, three lights, a seven-node walk graph that does not
    cross the chasm, and an 18-triangle collider proxy;
  - every marker kind and every anchor kind stand in it. Its art is 128 triangles in seven dress records (including smooth
    posts with a UV seam);
  - `tools/bakeEgRefFrag.mjs` is its own bake script, which every fragment of Mac's will copy. The .fbx and both halves are
    committed under `src/assets/egfrags/`.
- **WHERE A BAKED FRAGMENT IS REGISTERED** (decided with section 11.6):
  - its **pictures** take no number of their own. Each art face wears a record of its band's dress (`world/eliteGates/egBandArt.js`
    `EG_DRESS`), and the bake refuses any other material. It draws under its band's archive, which the one registry already
    holds (`world/eliteGates/pseudoArchives.js` `EG_BAND_ARCHIVES` - its header says so), so an authored fragment cannot collide
    with anything;
  - its **mesh** goes through the one mesh kit: `world/eliteGates/meshKit.js` gains `mesh`, which writes a baked mesh's triangles
    into a record's bucket, moved to where the fragment is laid, with its own normals and UVs. A hero fragment packs with
    the hall's code-built shapes into one model. `world/eliteGates/egHeroFragModel.js` (new) registers the mesh halves beside their
    own bake's law (`egHeroFragMeshes`), and `egHeroFragInto`, `egHeroFragModel` and `egHeroFragCollider` lay them;
  - its **law** is registered in `net/eliteGates/egHeroFrags.js` (new). `egHeroFragRegistry` holds every record to the reader at
    import, and `egHeroFragLaws(kit)` gives the fragments a hall may lay: none today, because the reference (variant
    `reference`) is laid by no hall.

**How Mac authors a fragment** (the bake accepts exactly this - `tools/fragBake.mjs`'s header says it too):

- **The file.** One fragment per `.fbx`, exported from Blender 5.1 with the FBX exporter's defaults (binary, Forward -Z,
  Up Y). Export the markers too: do not limit the export to visible or selected objects if they are hidden. Objects are
  root objects (no parent), their rotation mode XYZ Euler, with no negative scale (apply it with Ctrl+A).
- **The frame.** 1 Blender unit is 1 m and Z is up. The course runs along +Y: the mouth at the -Y end, the exits at the +Y
  end, X across. Nothing of the fragment may stand more than 10 cm behind its mouth or past its exits.
- **The art.** Any object whose name is not a marker word is art. Every face wears a material named for one of its band's
  dress records: `floor`, `brass`, `root`, `arena`, `cobble`, `edge`, `molten` or `pillar` (a Blender copy suffix such as
  `pillar.001` is fine). Every art object has normals and a UV map; it is smooth where he smooths it and mapped as he maps
  it. At most 12,000 triangles and 12 draws.
- **The markers.** Each is a mesh object; its name says what it is and its geometry says where. A label is letters,
  digits, `_` and `-`, and any name may end in Blender's `.001`.

  | name | geometry | what it says |
  |---|---|---|
  | `floor.<label>`, `floor.fight.<label>` | a flat plane, any faces (its outline is the floor), one outline, no hole | a traversal floor; a fight floor |
  | `ramp.<label>` | a sloped plane | a stair or slope, each corner at its own height |
  | `ceil.<label>` | a flat plane over the floors it roofs | a ceiling (a floor under none is open to the sky; never half under one) |
  | `open.<label>` | a box over floor edges (to 10 cm) | those edges open (to the void, a ramp, a lower floor); every other edge is a wall, except where one floor runs on into another at its height |
  | `socket.in` | an upright plane across the course | the mouth (one) - its width and height the opening's, at least 3.5 m high |
  | `socket.out.<label>` | the same | an exit (one or more; one may stand higher - a Low Road goes down) |
  | `node.<label>` | a disc on the ground | a walk-graph node (its middle; half its width its reach) |
  | `edge.<label>` | a strip from one node's disc to another's (its ends within a metre of their heights) | a walk-graph edge |
  | `anchor.<kind>.<label>` | a small box | `rift`, `caster`, `lurker`, `niche`, `engine` or `hazard` - the middle of its foot |
  | `hazard.<kind>.<label>[.per<ms>][.ph<ms>]` | its kind's shape: one rectangle along its length (`fall`, `surge`, `slag`); one disc each, one size (`basalt`, `hammer`, `hammerline`); one rectangle each, falling along +Y (`cascade`); the swing's rectangle (`wisp`, `per` required); a plane at its line (`mist`); a disc (`tide`); the moon-shafts' ring as a disc (`eclipse`) | a hazard on the shared clock; a lane's bite the capsule inside its rectangle |
  | `course.<kind>.<label>[.amp<cm>][.per<ms>][.ph<ms>][.beat<n>]` | a box, its top the piece's top | an inner piece: a Drift and a Rail say `amp` and `per`; a Pendulum, a Vent and a Gust `per`; a Drum `amp` (it rolls at the law's 2.0 m/s); a Moon branch `ph` and `beat` (cm); a Beat `beat` (ms); a slag crossing's clock is the law's; a ledge or still piece says none |
  | `alcove.<seam\|jump>.<lumen\|shard\|page>.<label>` | a box to one side of the course | an alcove (its floor's middle) |
  | `light.<band\|lava\|moon>.<label>` | a small box | a light (its middle) - at most four |
  | `collider.<label>` | low-poly faces | the collider's proxy (at most 3,000 triangles), never the drawn mesh |
- **Its bake.** Copy `tools/bakeEgRefFrag.mjs` and give it its spec (`id`, its kit in `EG_FRAGS`, a class the kit has, a
  `variant` of its own, a chamber's `play`, its `source`). Commit the .fbx under `src/assets/egfrags/source/` with its two
  halves beside it, and add a byte-for-byte test (the reference's is `test/tooling/eg6c_bake.test.js`'s first). Register the law
  in `net/eliteGates/egHeroFrags.js` and the mesh in `world/eliteGates/egHeroFragModel.js`, and name the three files in `test/tooling/doctrine.test.js`'s
  allow-list.
- **What the bake refuses, by name.** It refuses:
  - an export no Blender 5.1 wrote;
  - a marker name it cannot read;
  - a floor or ceiling that is not flat, is not one outline, or has a hole;
  - a socket that is not upright, or a second mouth;
  - an edge that misses its nodes;
  - an open marker that opens no edge, or an alcove on the course's line;
  - a hazard not in its kind's shape, or of two sizes;
  - art without the band's dress, normals or a UV map;
  - a record its reader faults: THE CEILING CLAMP, the volume and its faces, THE WIDTH RULE, the budget;
  - an inner course the solver does not prove.
  A refused scene is fixed in Blender, never patched by the bake.

**Departures, said plainly.**

1. A hazard's record is in the hall spec's own fields (`sh`, `spots`, `lanes`, `path`, `ring`, `r`, with `period` and
   `phase`), not section 11.5's `{ kind, shape, size, at, period, windup, pct }`. Its wind-up, share and element are its
   kind's law (`EG_HAZARDS`) and are never copied into a record that could disagree.
2. A ramp's `poly` carries each corner's height (`[x, y, z]`): `{ poly, y0, y1 }` cannot say which way a slope rises.
   Anchors are `[x, y, z]` (a code-built plan's are `[x, z]`).
3. The record adds `kit` (its band, reverb, light and engine follow), `box` (its volume) and `bake` (its source and the
   source's sha256). `play` is a list (a chamber's "at least one of").
4. `proof.crossSlow` is the median crossing over start phases at THE SPAN BUILD (THE MEDIAN's measure), not a slowest
   crossing. The crossing's bound at THE FAST BUILD (section 10.5's `EG_CROSS_MIN`) is not in the record.
5. The ceiling clamp at bake time is a refusal, not a clamp. THE TIMED SOLVER models no ceiling, so a ceiling lower than
   the fast build's 4.5 m over any inner piece's travel is refused instead, and no flight the solver proved is cut short.
   The page names no headroom for a shaft; a shaft keeps a passage's 3.5 m.
6. A lane's rectangle is the capsule inside it. The law's lanes are capsules (`net/eliteGates/egShape.js` `egInShape`), so the line
   is drawn in by half the width at each end and the bite never passes what Mac drew.
7. Section 11.5 names `open` edges without saying how they are authored. An edge is opened by an `open.*` box over it, or
   by one floor running on into another at its height. A ramp meeting a floor needs an `open` marker.
8. Volumes stand apart as far as one fragment can be held to it: the box holds everything, and the sockets stand on its
   faces. Laying it is left to the laying (below): the 2 m test against the hall's other boxes (`egFragApart`), a Low
   Road's vault 3 m under the lowest underside above it, and a piece's hanging underside (`SD_ROOT_DEPTH`).
9. The collider proxy is authored (`collider.*`), not derived. Section 11.6's "no drawn vertex inside the proxy" is not
   checked at bake time.
10. The reference's file names the port's own writer, which the bake accepts by name without asking a Blender's cut.
    Every other file must be Blender 5.1's.
11. `EG_FRAG_BUDGET` is section 11.9's starting bounds; EG6b's measurement on SwiftShader and a reference phone has not
    fixed them.
12. An inner piece's size is as authored (not `EG_STEP`'s), and its clock is the name's wherever the law leaves it free.

**Not built - the owner item, for when Mac's fragments arrive.** (EG-HERO-LAY: built, as spec law 7 - `EG_SPEC` 6 went to
AUDIT EG III's span decrees; its record says where each item below landed.) Laying an authored fragment into a hall, which needs:
- `net/eliteGates/egLaw.js` to choose one (`egHeroFragLaws`) in place of a kit's passage or chamber;
- its polygon fight floors in the spec (`spec.fl` is discs and lanes today, and `net/eliteGates/egFair.js`, `net/eliteGates/egFloor.js` and
  `net/eliteGates/egWalkGraph.js` read no polygon);
- its sockets joined to the course (a joined piece's w and h within 0.1 m), its box kept 2 m from every other volume and a
  Low Road's vault 3 m under the lowest underside;
- its steps and hazards laid (`egFragSteps`, `egFragHazards`) and its walk graph walked by the legion;
- its own clamp from its floors and ceilings (`world/eliteGates/egHall.js` `egFragZones`), its mesh laid through `egHeroFragInto`, and
  its proxy in the hall's collider buckets.
That is a spec law (`EG_SPEC` 6) and a relay version. Law 4 and law 5 lay what they laid: the 800-hall hashes in
`test/net/eliteGates/egz_frag.test.js` and `test/net/eliteGates/egseam_law.test.js` stand. The reference is laid by none.

**Not verified without a browser and the game's data:**
- the reference's mesh was never drawn. It was checked in node only: its triangles' winding against its normals, its
  sub-meshes, and the kit's pack;
- whether Blender's UVs (v up) lie on the band's painted records as a modeller expects was never checked; the port's own
  meshes run v up too;
- no export of Mac's was baked, because none exists yet. The reference is written the way his exports are (the ships',
  the gate's), and the bake reads them through the same `sceneObjects`.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED: untouched. No authored fragment is laid yet, so no host draws one; nothing was added to
  `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: untouched.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach.

**Pins.**
- `test/tooling/eg6c_bake.test.js` (12), `test/net/eliteGates/eg6c_law.test.js` (6).
- `tools/mutants/eg6c.json` (203, every one dead). Eleven survived the first run. New assertions killed ten of them:
  - a flat ramp;
  - a floor's edge midpoints left unasked (now a ceiling notched over one);
  - a node standing on a ramp;
  - a piece past the box's far end;
  - a corner meeting four edges (a bow-tie floor);
  - a four-cornered marker that is not a rectangle (a trapezoid);
  - a spec naming no kit;
  - an edge end meeting two nodes;
  - a material Blender copied (`molten.001`);
  - a baked mesh's normals (now every corner is compared, not only the first).
  The eleventh was an equivalent mutant (the crossing test turned: a point's crossings to its left and to its right have
  the same parity), re-aimed at the crossings' count, which a point whose line crosses the outline twice now pins.
- Judged again over the files this slice touched: every record aimed at `tools/fbxMesh.mjs`, `tools/shipBake.mjs`,
  `src/net/eliteGates/egFragLaw.js`, `src/world/eliteGates/meshKit.js` and `src/world/eliteGates/pseudoArchives.js` in `egfrag.json`, `egz_frag.json`,
  `eglook.json`, `egz_sound.json`, `galleon.json`, `auditgalleon_bake.json`, `auditgalleon2_bake.json`, `gatefbx.json`,
  `ships2_bake.json` and `mwebony1.json` (106, every one dead).
- PIN MOVED: `test/tooling/fbxmesh.test.js` imports its writer from `tools/fbxWrite.mjs` (its 12 tests and every bake's bytes
  unchanged); `test/tooling/doctrine.test.js`'s allow-list names the reference's three files.
- `RELAY_VERSION` `world198`, unshipped, rehashed in place (`net/eliteGates/egFragLaw.js` moved). `ACCOUNT_VERSION` stays `acct121`;
  no migration.
- The Port-Ledger's ELITE-GATES row names `net/eliteGates/egHeroFrags.js` and `world/eliteGates/egHeroFragModel.js`: the doctrine gate (every
  Ledger A cite in `src/` has a Ledger row naming its file) failed without them.

### EG5 + EG-ZK - 2026-10-12 - THE FIGHT PROFILE, AND THE LORDS ON THE SEAM AND THE GRAPH

Mac: "I said I want everything". EG5's last piece of the hall law, the fight's profile (section 14, "The merge" and "The
profile"), and the Spire's lords as sections 11.7 and 13.1 write them: on the boss seam, and walking the hall's graph. All
relay law. It closes EG-H3's departure 3 and EG-ZB's departure 2; both sentences are deleted.

**What shipped, by piece.**

- **THE MERGE** (`net/eliteGates/egLaw.js`, `EG_DECREES`). The lord family's four decrees carry a `law`: rank I's and rank II's,
  each number in thousandths (`EG_LAW_UNIT`, 1000), so the law file still decides in integers.
  - Rank I is read off the gate's own trials (`net/gate/gateMods.js` `gateTrialOf`, imported and never copied):
    - Colossal's `sizeX` and `hpX`;
    - Unyielding's `hitX`;
    - Vengeful's `dmgX`;
    - Grudge-Bearer's `threatPick` and `threatDecay`.
  - Unyielding's `shieldX` 2 is the trial's 6 s over the gate's `SHIELD_MS`, in place of its `shieldMs`.
  - Colossal's `radiusX` 1.2 is the page's own: the Slam becomes 8.4 m, not the gate's 8.5.
  - Rank II's numbers are the page's.
  - No other family carries a law. The other families are read by rank where they act (the legion, the director, the
    spans).
- **THE FOLD** (`egLawFold`). `net/superDungeon/sdMarks.js` `sdMarksLaw`'s rule, over laws in thousandths: a key ending in X
  multiplies (rounded to the thousandth), and any other key is the last law's that names it. Every X-keyed number is x1
  where no law names it (`EG_LAW_X_KEYS`, from the table).
- **THE PROFILE** (`egFightProfile`, `validEgDecrees`).
  - `egFightProfile(decrees)` folds a circle's decrees (`[[id, rank], ...]`, the state's word) in the order of their
    numbers. It answers `{ dc, key, law }`: the decrees sorted, the cache's key (the sorted decree string, `id:rank,...`)
    and the law as numbers. It is frozen.
  - The validator takes at most `EG_DECREES_MAX` (9) pairs, each a known decree at rank 1 or 2, none twice, and answers
    a fresh copy. Anything else is the fight with no decree.
  - The cache is bounded at `EG_PROFILE_CACHE_MAX` (256) and drops the least recently asked.
  - The gate's `validGateMods` is not touched. The wire's own nine (`net/wire.js` `egDecreesW`) stand as EG-PLAY laid
    them.
- **THE LORDS' LAW READS IT** (`net/eliteGates/egLords.js` `egLordLaw`). The ranks in force (`F.D`) become the profile's list, and
  the gate's `THREAT_PICK` and `THREAT_DECAY` stand where no decree names a threat.
  - Before the change, every one of the 81 rank sets of the four was checked against the hand fold it replaces: each
    number is the same double.
  - Nothing else in the lords moved. Colossal's radii and health, Unyielding's ward and its blows, Vengeful's share
    inside the one `EG_SHARE_X_MAX` with depth and fury, and Grudge-Bearer's threat were all already applied, and are
    now pinned in a fight the director stands.
- **THE LORDS ON THE SEAM** (`net/eliteGates/egLords.js` `EG_SEAM`, `egLordsFight`; section 13.1). There is ONE plug of
  `net/bossSeam.js` for every lord and champion, never a seam per lord. Its fight is the lords' view of the hall's one
  fight: `{ F, spec, ctx, now }`, made by the director for each call.
  - `new`: a Court's lord (the Twins, both) or a champion, stood asleep (`egLordsNew`), with the bodies stood as
    `stood`.
  - `join`: the director's admission (`o.admits`) while a lord stands. The company is the hall's, sized at its wake
    (`egFightNew`).
  - `hit`: the gate's hand and purse (`egHitBody`) times the lord's own weight (`egLordHitX`), and what lands is told to
    the lord (`egLordHit`).
  - `step`: the lords' beat (`egLordsStep`).
  - `stateOf`: the whole fight at the view's clock (`egFightState`).
  - `judge`: the fight's blows on the shared-time trails (`net/bossRef.js` `judgeShapes`). These are the lords' and
    their legion's blows on one floor, as the gate's judge takes its host's.
  - `earned`: a Redoubt's receipt at the lords' fall, for half an even share of the circle's damage (`EG_EARN_SHARE`)
    or a part in three of its halls (`EG_EARN_HALLS`) among the living company.
  - The director (`net/eliteGates/egBrain.js`) calls each member inside its one beat with the legion and the hazards. It never
    calls a lord's own function past the seam:
    - six births;
    - the join and the hit of a member's blow on a lord (`egBlow`);
    - the Court's beat and the other halls' beats (`trial`);
    - the state at a hello, at the wake and every `EG_STATE_EVERY_MS`;
    - the census's judge (`egCount`);
    - the Redoubt's earners (`redoubt`).
  - The seam is a contract the director calls, not a second host. `net/eliteGates/egLords.js` imports the board, so
    `RELAY_GRAPH`'s walk is unchanged.
- **THE FRAMES, BYTE FOR BYTE.** Every frame the director says was hashed on the tree before (b4af2365) and again after
  the seam, with test/net/eliteGates/egfull_relay.test.js's own auto-player:
  - the thirteen lords, each met at its own Court and fought to its fall;
  - the six-circle breach.
  All fourteen hashes were unchanged.
- **THE LORDS WALK THE GRAPH** (`lordWalk`, `runTo`, `oneLevel`; section 11.7). The legion's `walkGraph` and `walkAir`
  are exported from `net/eliteGates/egLegion.js`.
  - Within the region of the fight ground it stands in (a disc, a lane, an arch's half), a lord walks straight, as it
    always walked: `egWalk`, stopped short and kept on the floor.
  - To a goal past that region (an island across a bridge, a floor up its stair, the far side of an arch's wall) it
    walks over the hall's walk graph as the legion does: through the gap, up the stair, along the bridge.
  - This holds for the approach, Grath's Scent and the Colossus's route. The Mother of Dusk flies about the rock.
  - The node a graph walk headed to is a way on only while the lord still walks to it. A blow's stop, a run's end, a
    leap or a straight walk since leaves no way on, so a lord set down beside an arch's wall never walks straight to the
    far gap node. A node it stands at is reached.
  - A lord's RUN (a row's `run`: the champions' Charge, the Armsmaster's Lunge, the Night-Stalker's Night Lunge) ends at
    an arch's wall with its body clear, as the Breaker's does. A run that would end on a floor of another height ends on
    the region it began in. No run is chosen at a member on another floor's height (`oneLevel`); the lord walks the
    graph to them instead.
  - After the graph, eight lords say the same frames as before: the Spellmaster, the Armsmaster, the Cairn-Keeper, the
    Mother of Dusk, the Night-Stalker, Seyth, the Colossus and Garoth. Their grounds are one region each.
  - The other five walk the graph now, and every one still falls: Grath's islands, Ilthys's balconies, the Twins'
    courts and walkway, Morvayn's soul-bridge and the Wyrm's perches.
  - test/net/eliteGates/egfull_relay.test.js is green, unchanged.

**Departures, said plainly.**

1. `egFightProfile` keys and folds the lord family alone. The other families' decrees are in its key, but carry no law.
2. A lord walks straight within its region, kept on the fight floor as before, not to the region's own inset as a
   legion walker is. This is why eight lords' frames are byte for byte.
3. A run's stamp (its lane) still spans an arch's wall as the Breaker's does: the run ends at the wall, but the shape
   is the blow's.

**The four hosts.**

- `src/scenes/world.js` - FLAGGED: not touched. This is relay law, and the screens draw what the relay says.
- `src/scenes/worldModes.js` - FLAGGED: unchanged.
- `src/scenes/dungeonContext.js` - FLAGGED: unchanged.
- `src/scenes/exterior.js` - FLAGGED: offline (section 28).

**Not verified without a browser and the game's data:** the lords' new walks were checked as the relay's frames on real
specs, not watched on a screen; the screens carry each walk as they always have.

**Pins.**

- `test/net/eliteGates/eg5_profile.test.js` (5): the merge, the fold, the validator and the cache, the lords' law, and the laws on a
  lord in a real fight.
- `test/net/eliteGates/egz_lords.test.js` (5): the seam and the director's calls, every member frame for frame on real fights, a
  champion through an arch, Grath along his bridges, and a champion up a stair with no run up a ledge.
- `tools/mutants/eg5.json` (40, every one dead). Two survived the first run and were killed by new assertions:
  - the cache first-in-first-out: the oldest asked again must stay;
  - Grudge-Bearer forgetting: its record was re-aimed at the whole decay (the guard alone is equivalent under a law of
    no decay).
- `tools/mutants/egz_lords.json` (35: 33 dead, 2 equivalent - the Colossus's route over a one-lane forge and the Mother's
  flight over a glade with no rock). Survivors of the first run were killed by new assertions:
  - a blow through the seam on a body that is no lord (a fresh purse, so the seam and not the hand refuses it);
  - a node kept after the lord was set down.
  Two records on a level-only keep were dropped with the keep: the straight walk keeps the old floor.
- Judged again over the files this slice touched: `egz_legion.json`, `egz_recap.json`, `egint.json` and `egseam.json`
  (285, every one dead).
- `RELAY_VERSION` `world198` was rehashed in place; no file joined its graph. `ACCOUNT_VERSION` stays `acct121`.

### EG-ZM - 2026-10-12 - THE LOOSE ENDS: THE RETURN'S SEED, THE BOARD'S DOORS, THE STAKE'S CLOCK, THE LEDGER ROW

Four loose ends of the last wave (Mac: *"I said I want everything"*). It closes EG-ZD's departure for a device with no
record (its way back stood circle 1 of seed 0 under the veil until the room's word), section 20's board window *"reached
from the Timers row and from the start window"* (EG14's window had one door, `/breach board`), EG-ZA's departure for the
service's clock (a stake no receipt settles stayed `held`), and the ELITE-GATES row of the Port-Ledger, which still
named a retired ward and the Hour's art.

**What shipped, by piece.**

- **THE RETURN'S SEED** (`scenes/eliteGates/egClient.js`, section 22).
  - A way back the device knows only from the account service's `live` is a record with no opening (`op` 0), so no seed
    and no hall. Its step goes under the veil and is held there until the room's first word.
  - The word is heard by a listener on my own identity (`egSeedListen`). It is an `OnlineSession` made of my primary
    session's url, id, secret, name, look and token minter, with `presence: false`: no pose, so it stands no body in the
    breach and sends nothing but its hello and its heartbeat (`net/caravanVisitLink.js`'s way). The room answers its
    hello as it answers any member's, with the breach's `st`, or refuses it in words (`net/eliteGates/egBrain.js` egAdmitWord).
  - The `st` is folded as the link folds it (`net/eliteGates/egLink.js` foldEg) and kept on the record (`backFrame`): the seed, the
    opening, the geometry, the hall. The circle stood is the record's, so it is the room's: for a breach begun at
    Redoubt 1 under a Crumbling Wager, Hall 6's circle 2 in the Wager's geometry, never circle 1 of seed 0, and nothing is
    rebuilt once my own socket says hello.
  - The step waits under the plain veil held over *The Spire* (AUDIT EG III: it fell as Hall 1, the Galleries' fall and
    its name, whatever hall the company held). The veil keeps the first band's tint, since the record knows no band.
  - The listener is left at its answer, before the circle stands. The relay keeps one socket an account in a breach's
    room (`server/src/index.js:"if (egRoom && who.subject) for"`), so my own socket's hello is never refused as a
    replacement of it.
  - A refusal in the room's own words (the order, the company, the fallen, home, a breach closed - `roomRefused`, now the
    one law spireFrame's terminal close reads too) is said, and the way back is let go and marked over. A refusal that
    is not the room's (the relay's, for want of a sign-in) says the road is shut and keeps the way back.
  - No word within `EG_BACK_SEED_WAIT_MS` (12 s: the listener's own wait for its token, `TOKEN_WAIT_MS`, and four seconds
    for the socket, the hello and the answer) opens the veil where I stood: *The Spire does not answer. Try the return
    again.* (AUDIT EG III: it told a touch or pad player to type `/breach`.) The way back is kept, and asked again it
    waits again. The online frame gone (`away`) ends the wait the same way, and a session with no relay address is silent
    at once.
  - The frame settles the wait (`seedFrame`), the wait's slot emptied before the step is told.
- **THE BOARD'S DOORS** (section 20).
  - **One door.** `ui/eliteGates/egBoardWindow.js` `createEgBoardDoor`, the world host's `egBoardDoor`, opens the boards in the skin
    worn (the enhanced panel; the classic skin's DFU pickers on the mode's slot), one at a time: asked again, the boards
    standing are closed and out of the slot before the next go in. A window on its way out of the mode's slot - a pause
    face handed off, done but not yet drained - gives the slot up to the classic picker; a live window keeps it.
    `/breach board` goes through it.
  - **The Timers row** (`systems/eventTimers.js`, `ui/enhanced/enhancedTimers.js`, `ui/enhanced/enhancedMenu.js`). The timers source carries
    the door (`doors.board`). Where it does, every Elite row carries `door: 'board'`: my breach's, and the boards' own
    season, an Elite row of its own (*The Spire's season 2 ends*, at the arena season's end - `net/arena/arenaLaw.js` - when
    each Descent bracket's top ten are kept as Spire Champions), so the door stands with no breach of mine. The window
    draws it as a *Boards* button beside the row's clock, a button as the window's Close is, so a tap and the pad's walk
    of the pause face reach it alike. A press reads the source's door at the press, and the pause face hands its place on
    first, as the sheet's doors do (`handoff`; a door that opened nothing resumes).
  - **The start window** (`ui/eliteGates/egStartWindow.js`). Its last row is *The Boards of the Spire* (`EG_BOARD_TEXT.title`), with
    keys or with the Rehearsal alone. Picked, the list leaves the slot before the boards open, and comes back once they
    close (once, however often their close is told; at once where none opened; never after the window ended). It is a row
    of DFU's list picker on the classic skin and of the skin's own picker on the enhanced, with their own touch and pad.
- **THE STAKE'S CLOCK** (`server-account/src/eg.js` spendLapsedStakes, `server-account/src/cron.js` `eg-stakes`; section
  23).
  - **When.** A stake still `held` `EG_STAKE_CLOCK_S` past its `until` is spent by the service's hourly clock. That is
    the void's window (`EG_VOID_WINDOW_S`, the relay's `EG_VOID_MAX_S` pinned equal) and a receipt's life
    (`EG_RECEIPT_TTL_S`): an order is signed at the latest at its stake's `until` (an open asked again re-signs it only
    while the stake holds), its void may be minted a week after, and that void is carried a week more. Past the bound
    nothing can name the stake.
  - **What the key becomes.** Spent: it stays taken, as any spent stake's does. A clock never returns a key.
  - **What the player is told.** A letter in the mailbox (`server_post`, the post the pause face's envelope reads), from
    the developers, one a stake (`spire-stake-<order id>`, INSERT OR IGNORE over 0093's index, so a letter already there
    never holds the clock): *The Weir Key you staked on 2027-01-15 opened a breach that never sent word back: no Redoubt,
    no end and no void reached the Spire's ledger in the time a key waits for one. That key is spent. It does not
    return.* A Rehearsal's stake held no key: it is spent and says nothing.
  - **How.** The stakes due are asked in one statement, a page of `SWEEP_ROWS`, the oldest first (a quiet hour asks no
    more), then spent with their letters in one transaction, each only while it is still held: a receipt claimed between
    the ask and the spending settles its stake its own way. The job asks again while a page is full. The held stakes are
    asked by their own index (migration 0111 extended: `idx_eg_stakes_held` on `(state, until)`), never a walk of every
    stake ever staked.
- **THE LEDGER ROW** (`bible/01-Overview/Port-Ledger.md`, ELITE-GATES). `characters/playerEntity.js` holds one Levitate
  ward (EG-H2 retired `registerSpireLevitateWard`); `world/eliteGates/egHall.js` wears its band's dress (EG-G2's
  `world/eliteGates/egBandArt.js`), not the Hour's art; `server-account/src/egEconomy.js` and `server-account/src/egStarts.js` are
  named, and the stake's clock on `server-account/src/cron.js`.

**Departures, said plainly.**

1. The clock waits fourteen days past the stake's end (`EG_STAKE_CLOCK_S`), not the page's seven days
   (`EG_VOID_MAX_S`). A void can be minted up to seven days past its order's issue and carried seven days more, so a
   stake spent at seven would lose the key such a void returns, and a key is never lost to an infrastructure fault.
2. The service keeps its own void window (`EG_VOID_WINDOW_S`), pinned equal to the relay's: `net/eliteGates/egDurable.js` is the
   relay's and outside the account Worker's bundle (`EG_LAST_WORD_S`'s precedent in the same file).
3. The player is told by a letter in the mailbox, not a line in the game: the clock runs on the service, days after the
   player last played, and the post is the one place the service speaks to an account between sessions. The words are
   fixed here, as First of the Spire's are.
4. The way back's veil is chosen before the room has spoken, so a device with no record steps under the stair of the
   record's start (Hall 1's full fall) whatever hall the room says. A record that knows its seed waits for nothing, as
   before, and a circle it had wrong is still rebuilt in place.
5. For the length of the wait a second socket stands on my identity in the breach's room. It holds no pose, so the room
   counts no body of it; it is gone before my own socket says hello.
6. The Timers row's door hangs on the boards' own season as well as on my breach's row: a Timers window with no breach of
   mine had no Elite row to carry it. The season row stands only where the door does.
7. The Timers window is the enhanced pause face's (TIMERS1). On the classic skin it is reached where the enhanced pause
   opens on either skin (the mailbox's door, the family's pages); its door opens the boards in the skin worn.

**The four hosts.**
- `src/scenes/world.js` - WIRED: `egBoardDoor` (`createEgBoardDoor` over `openEgBoard` and the mode's slot -
  `topWindow`, `mountWindow`, `closeWindow`), and through it `/breach board`'s `board`, the timers source's `doors` and
  the start window's `board`. The return's listener is the breach client's own (it builds from the `online` it is
  already handed). Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: untouched. Its interiors' pause face reads the world host's timers source, which
  carries the door; the classic boards mount through its own `mountWindow`, `closeWindow` and `topWindow`.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched; its pause face reads the same source through worldModes, and its
  slot takes the boards' pickers as it takes any window.
- `src/scenes/exterior.js` - FLAGGED: offline - no timers source, no breach, no boards (section 28).

**Not verified without a browser and the game's data:** the listener's hello ran against the relay's real Room through
a bridged socket, not a deployed relay; the Timers button and the start window's row were driven on a stub DOM and fake
pickers, not seen on either skin; the letter was read through the real Worker's mailbox routes, not the pause face's
envelope.

**Pins.**
- `test/net/eliteGates/egz_ends_return.test.js` (3), `test/ui/eliteGates/egz_ends_board.test.js` (3), `test/net/eliteGates/egz_ends_stake.test.js` (2).
- `tools/mutants/egz_ends.json` (73: 71 dead, 2 equivalent as recorded - the wait's slot emptied before its step is
  told, and the Timers shape naming a row's door, which the season row's coming and going moves anyway). Six survived the
  first run and were answered: three were the return's target read twice (the room's word written into the record and
  then into the step), so the step now stands the record's circle, as it always did, and the record is pinned; a
  settled stake long due and a page of one were pinned; the shape's became the second equivalent.
- PIN MOVED: `test/net/eliteGates/egz_return.test.js` (EG-ZD's device with no record is now a record whose seed is not the room's -
  still rebuilt in place); `test/scenes/eliteGates/egeco_hosts.test.js` (`/breach board` through the one door); `test/net/auditscale.test.js`
  D7 (a quiet world's hour is twenty-three statements, the stake clock's one ask the twenty-third).
- Re-aimed by content: `egz_stair.json`'s EGZ-the-way-back-under-the-hour (the way back's step now waits under its veil
  before it stands the circle).
- Judged again over the files this slice touched (`scenes/eliteGates/egClient.js`, `systems/eventTimers.js`, `ui/eliteGates/egStartWindow.js`,
  `ui/eliteGates/egBoardWindow.js`, `ui/enhanced/enhancedTimers.js`, `server-account/src/eg.js`, `cron.js` and `post.js`): 232 records of
  `auditlwii2_service`, `auditscale`, `cap_off`, `egarch`, `egeco`, `egeco_honours`, `egeco_pay`, `egeco_relay`,
  `egfrag`, `egfull`, `egint`, `eglook`, `egmade`, `egplay`, `egpres_hud`, `egseam`, `egz_frag`, `egz_keys`,
  `egz_recap`, `egz_return`, `egz_sound`, `egz_stair`, `lw15`, `scale4b`, `sd19`, `sd2c`, `serpent2` and `serverpost`.
  Every one is dead.
- `RELAY_VERSION` untouched: nothing in the relay's import graph moved. `ACCOUNT_VERSION` stays `acct121`; migration 0111
  extended (unshipped).
- No new src module. The ELITE-GATES ledger row corrected (above).

### EG-ZN - 2026-10-12 - THE CAMERA IN THE SPIRE, AND THE BAND TEXTURES' OWNER

(Mac: *"I said I want everything"*.) Closes the last two lines of section 11.8 that no layer built - the occluders between
the camera and the body dithered out, and the shaft ledge's pitch bias with the camera's rise over the drop - and section
29's owner of the band textures. EG-ZH's two "Not built" lines for the camera, EG-ZC's "the camera's 20-degree bias over a
shaft's drop is not built" and EG-G2's "a band's textures stay up for the session once stood" are retired here.

**What shipped, by piece.**

- **THE OCCLUDERS MARKED** (`world/eliteGates/egHall.js` `buildEgCircleModel`, `egOccluderRuns`; section 11.6's mesh half). The
  circle stays one mesh, one upload and one draw of a sub-mesh a record. As it is laid, every piece of rock the camera may
  stand behind is marked (`occluderMarker`):
  - a passage's or a shaft's every wall run and its vault;
  - each box of its kit's dress (the Stacks' bookcases, the Colonnade's drums, the Ossuary's ribs and arches, the Gloam's
    trunks, the Forge's pipes and anvils);
  - a niche's walls and lid (never its floor), each vignette, a ring wall (a chamber's, a court's, a pit's tiers) a segment
    at a time, the Forge's long walls a side at a time, an arch's walls, the end plate's posts and lintel, and each slag
    spout with its lip.
  Each piece is `{ b, r }` - its box, and its runs of the mesh's own indices (`model.occluders`) - read off the packed
  mesh. The floors, bands, lanes, plates, islands, ramps and the magma stay the circle's ground. A circle holds 18 to 141
  pieces, about a thousand of its 21,000 to 28,600 triangles. The swap's worker build carries them with the model
  (`world/eliteGates/egCircleParts.js`, which builds through `buildEgCircleModel`, unchanged).
- **THE DITHER PASS** (`scenes/eliteGates/egOcclude.js`, new - a helper the mode machine calls, not a fifth host; `render/renderer.js`
  `meshView`; `scenes/worldModes.js` `egOccludeFrame`, `egCircleDraw`):
  - THE RAY: each frame in third person, a segment from the eye to the body's pivot (the lane's own focal) and one to its
    chest (`EG_OCCLUDE_CHEST_M`, 0.9 m over the render feet), each stopped `EG_OCCLUDE_BODY_M` (0.3 m) short of the body,
    is tried against every piece's box and then against its own triangles, from either face (`egSegBox`, `egSegTri`,
    `egOccludersHit`). Only the occluders' own triangles are kept for it.
  - THE EASE (`egOccludeEase`): a piece the ray crosses dithers out to `EG_OCCLUDE_KEEP` (a quarter - 4 of bayer4's 16)
    over `EG_OCCLUDE_FADE_S` (0.2 s), and back the same way once the ray is clear.
  - THE DRAW: while nothing dithers, the circle's draw is the dungeon loop's own, untouched. While pieces dither, the pass
    runs after the frame's beginFrame and the cull, before the dynamic draws:
    - it takes the circle's draw for the frame (`hidden`);
    - it records the whole mesh's shadow as the loop would (`recordShadowMesh` - the lanterns' caches see the record they
      always saw);
    - it draws the rest of the mesh as a view of its own buffers with the pieces' runs cut out;
    - it draws each share's pieces as one view under `setDissolve` (SHIP-FADE's ordered dither), adjacent runs as one
      range, and sets the dissolve back to whole after.
  - Nothing is uploaded. A view (`meshView`) is its mesh's VAO with no buffer of its own, never handed to destroyMesh, and
    none is made of a dead mesh or of a view. The pass keeps its views per set (at most `EG_OCCLUDE_VIEWS_MAX`, 64) and
    lets them go with the circle.
  - First person, a witness's eye (`host.egWitness`) and the decorator's free camera try nothing; whatever dithered comes
    back whole.
  - THE SWAP keeps its shape. The stand and the swap hand the pass the circle's mesh and its model (`egOcc.set`) and push
    the circle's one draw (`egCircleDraw`). The slot is emptied first: the pass lets the old circle go (`egOcc.clear`)
    before its mesh is freed, and a circle that will not build leaves the pass holding nothing.
- **THE BUDGET, MEASURED** (node, 60 circles: seeds 7, 99 and 12345, circles 1 to 20, as EG-G2 measured the pieces):
  - while nothing stands between, the circle is one draw of a sub-mesh a record, as before: a mean of 7.15 GL draws, at
    worst 8;
  - with any one piece dithering, it costs at most two draws more for each record the piece touches: a mean of 9.15, at
    worst 12;
  - the frame's circle and batched pieces together (`scenes/eliteGates/egPieceBatch.js` through `scenes/eliteGates/egSpan.js`, every copy in
    view) run a mean of 20.7 GL draws, at worst 30, whole, and at most 34 with the worst single piece dithering - under
    the Hour's 82 (23.8, 35 and 39 since the merge with EG-ZL, whose tells are kinds of the batch).
- **THE SHAFT'S LEDGE** (`world/eliteGates/egHall.js` `egShaftLedgeAt`, `EG_SHAFT_LEDGE_M`, `EG_SHAFT_WAY`; `egFragZones` now carries
  a zone's `shaft`, `zB` and `yB`). A body stands on a shaft's ledge facing a drop while its feet are in a zone the law
  marks `shaft`, short of the foot and at least 0.5 m over the foot's height: the rim, every flight down to the Drop, and
  the air between them. The Drop's landing, the Slag Chute's crust, the foot and every other zone are none. Every shaft
  leaves facing +Z (`net/eliteGates/egFragLaw.js` egFragShaft), so its way down is +z in the hall's frame and the dungeon's.
- **THE SHAFT'S CAMERA** (`player/mwView.js` `setSpireShaft`, `spireShaftFacing`, `spireShaftEase`, `spireShaftPitch`,
  `spireShaftPivot`, `spireShaftLook`; told by `scenes/eliteGates/egClient.js` `shaftWay`):
  - facing the way down (the look's bearing within 60 degrees, `SPIRE_SHAFT_FACE_IN`, and held to 75,
    `SPIRE_SHAFT_FACE_OUT`), the camera's pitch biases `SPIRE_SHAFT_PITCH` (20 degrees) under the look's, and its pivot
    rises `SPIRE_SHAFT_RISE_M` (1 m) by the bias's share, eased over `SPIRE_SHAFT_EASE_S` (0.5 s) as the facing comes and
    goes. The orbit carries the eye up its arc too: the real Morrowind camera's eye stands the metre and its distance times
    sin 20 degrees higher, looking down the shaft;
  - both lanes lay it on their own eye before their casts (the Morrowind camera's focal, Eye Of The Beholder's head), so
    the casts guard the leaned eye;
  - reduced motion (the shelf's row or the system's - `ui/eliteGates/egAccess.js` egReducedMotion, the client's `stillNow`) lays none
    (AUDIT EG III: it laid it whole at once, a snap section 11.8 refuses); first person and out of the Spire take none, at
    once; the pitch never passes the camera's own limit (`PITCH_LIMIT`);
  - the frame's eye answers the camera's own forward (`look`), and the dungeon arm's view looks along it after the aim is
    taken (`aimView`, AUDIT CLIMB-ARC F10's order), so the player's aim, the listener and the casts keep the player's look.
- **THE BAND TEXTURES' OWNER** (`scenes/worldModes.js` `egBandsDown`; section 29: "band textures are cached per band and
  freed at the breach's end"):
  - each band's dress goes up once a breach - at a circle's stand (EG-G2's `egBandUp`), or, for the next circle's new
    band, painted in the swap's worker and put up a record a frame of the Court's rest (`egSwapFeed`, AUDIT EG V); the
    swap in place puts up only what the rest left;
  - at the breach's end every band it put up is freed: each record's albedo (`releaseTexture`, every variant) and its
    emission (`evictEmissionTexture`), from GL. It is refused while a circle stands, since its draws still wear them. The
    Hour's own art (`SD_REALM_ARCHIVE` - the Steps' faces, and the Hour's) is kept for the session;
  - the breach client says when (`scenes/eliteGates/egClient.js`): on the first frame out of the Spire that is no swap's or answer's
    step under way (`!swapping && !answering`, the reverb's own rule). So the way home, the tear, the last fall's walk out,
    forsaking, a void, a refused or lost socket and leaving the Spire any other way all free it, and the old step under
    the veil (out and in again) keeps it. A reload ends the page's GL context with every texture in it; a reload's return
    uploads again at its stand and frees again at its end.

**The four hosts.**

- `src/scenes/worldModes.js` - WIRED:
  - the dither pass after the cull (`egOccludeFrame`), before the dynamic draws;
  - the circle's draw through `egCircleDraw` at its stand and its swap;
  - the pass handed each circle and cleared first;
  - the view along the camera's own forward after the aim;
  - `egBandsDown`, and the doors `egBandsDown` and `egOccluders`.
- `src/scenes/world.js` - FLAGGED: untouched. The breach client it builds carries both words. Its exterior frame's
  `mwViewFrame` answers no `look`, since the client's word is null outside the Spire. Nothing was added to
  `function frame(now)`.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched. The circle's draw rides its `dynamicDraws` as it did; the pass runs
  in the mode machine's dungeon arm.
- `src/scenes/exterior.js` - FLAGGED: the bench holds no Elite Breach, and its `mwViewFrame` never meets a Spire word.

**Departures, said plainly.**

- **Done another way:**
  - the occluders are runs of the circle's one mesh drawn through views, not meshes of their own. A draw of their own
    would cost each piece's records in every frame; the views cost them only while something dithers;
  - a piece is one solid the builder lays (a wall run, a vault, a bookcase, a ring wall's segment), not a whole fragment,
    so the ray dithers what it crosses and the rest of the rock stands;
  - a dithering piece keeps a quarter of its fragments, not none, so the rock still reads as rock with the body through it;
  - a dithering piece's shadow stays whole (it is recorded with the whole mesh), so no lantern redraws as the camera turns;
  - the facing's cone, the ease and the rise are the port's numbers: the page gives the 20 degrees alone;
  - "a shaft's ledge" is the rim, every flight down to the Drop and the air between them: each has a drop before it;
  - reduced motion leaves the bias off (AUDIT EG III), so a still screen never sees the landing over a shaft's edge
    unless the player looks;
  - the band textures are freed on the client's first frame out of the Spire, not by the room's end word, so a member who
    leaves early frees them early; the Hour's art the Spire also wears is the session's.
- **Not verified without a browser and the game's data:** the dither was drawn on a recording GL (its draws and
  `uDissolveCut` read), never seen; the shaft's camera was never flown (the Morrowind camera's eye computed in node, the
  sprite lane's by its source); the frees were read off the renderer's own maps and GL's `deleteTexture`.

**Pins.**

- `test/world/eliteGates/egz_camera.test.js` (3), `test/world/eliteGates/egz_camera_host.test.js` (2), `test/scenes/eliteGates/egz_camera_budget.test.js` (1),
  `test/net/eliteGates/egz_camera_shaft.test.js` (4).
- `tools/mutants/egz_camera.json` (103: 98 dead, 5 kept as equivalent, each with its why - two prefilters of the ray,
  Moller-Trumbore's early out, the marker's empty-piece guard and a share forgotten at whole). Four survived the first run;
  two were killed by new assertions (a niche's floor marked; a ray past a triangle's far edge) and two are the equivalents
  above.
- Re-aimed by content (mutantdrift): `eglook.json`'s EGLOOK-hall-circle-undressed, onto the circle's `const model`. Judged
  again over the text this slice changed: `benchcam1.json` (2), `eglook.json` (2), `egseam.json` (4), `egz_frag.json` (1)
  and `egz_sound.json` (2) - 11, every one dead; and every record of every list on `world/eliteGates/egHall.js` and
  `player/mwView.js` (82), every one dead.
- PIN KEPT by order: the shaft's two lines stand above the Morrowind lane's saddle line, and the view's lean below the
  climb's feel, so COATS3D's and CLIMB4's source pins read their lines as they were.
- PIN MOVED: `test/world/eliteGates/egswap_client.test.js` (the swap's rig hands the stand's own source `createEgOccluders` and
  `EG_DRESS_RECORDS`); `test/systems/eliteGates/egz_body.test.js` (a zone carries `shaft`, `zB` and `yB`).
- `RELAY_VERSION` untouched: nothing in the relay's import graph moved. `ACCOUNT_VERSION` stays `acct121`; no migration.
- New in `src/`: `src/scenes/eliteGates/egOcclude.js`, named in the Port-Ledger's ELITE-GATES row.

### EG-ZL - 2026-10-12 - THE PIECES' TELLS ON THE SPANS

(Mac: *"I said I want everything"*.) Section 10.3's tells for the pieces the Spire lays, section 10.8's ghost slab, and
section 25's look on them (the five lights, THE EDGE LINE's gold, the fog floor, reduced motion and the danger palettes).
It closes what `scenes/eliteGates/egSpan.js`'s header said EG-PLAY left - "the Steps' look parts (the pendulums, the dissolve, the
chunks, the ghosts' pass, the waystones); a Beat shows its glyph frames, a Crumble falls whole" - and the stale "still
owed" lines for the pieces' tells in layer two's and layer three's records, which EG-G2's tracks, streamers and Rampart
waystones had already answered. All of it is client-only: nothing in the relay's graph moved.

**What shipped, by piece.**

- **A KIND THAT TURNS** (`scenes/eliteGates/egPieceBatch.js` `add(..., { turns })`, `remap`, `copyVertex`). A Drift's hang, a
  Crumble's chunks and a Gust island's banner turn as well as move. A kind added `turns` writes each copy through its
  slot's whole matrix: every vertex turned and moved, every normal turned. Its cull sphere's centre is turned with it,
  and a copy is re-laid when any of its twelve numbers moves. A kind that only moves keeps EG-G2's law, line for line.
  A kind's draw takes one picture map (`remap`, before the build or after), so the copies one frame of law shows alike
  share one draw.
- **THE GHOSTS, A CIRCLE'S** (`render/superDungeon/sdStepsPass.js` `sdStepsPassVs`, `sdStepsPassFs`, `SdStepsPass(gl, ghosts, { max,
  slab, fogFloor })`; `scenes/eliteGates/egSpan.js` `drawPass`). The Hour's own pass draws the circle's gone Beats and my fallen
  Crumbles (a bone bridge's too), outlined where they return, each with its hand running back to the return. Its count is
  the circle's (`EG_GHOSTS_MAX` 48; the most any of 640 circles measured lays is 31). It keeps the Spire's fog floor
  (`world/eliteGates/egLook.js` `EG_FOG_FLOOR`, section 25.6). Built without the three, its text and its buffer are the Hour's byte
  for byte. The pass is built the first time it draws and freed at the span's clear. The breach client draws it in its
  own pass under the lines (`scenes/eliteGates/egClient.js` `drawPass`, through `dungeonContext.egSpanDraw`).
- **A BEAT** (section 10.3: "a sector sweeping through the solid time; the last 0.4 s white, faltering at most 2.5 Hz; a
  gold ghost while it is gone").
  - A kind a beat (`beatKind`). The pieces of one beat show one frame, so their one draw wears one picture map.
  - Across its solid time the Steps' dial runs frame by frame (`scenes/superDungeon/sdSteps.js` `SD_BEAT_FRAMES`): its hand goes back
    to XII and the ticks still ahead stay lit.
  - Over its last 0.4 s it burns the place's own white and dissolves out a stage each `SD_BEAT_OUT_STAGE_S`. Over its
    first `SD_BEAT_IN_S` it dithers back in.
  - THE DISSOLVE IS MADE IN THE PICTURE (`world/eliteGates/egBandArt.js` `egBeatWarnArt`, `egBeatBackArt`, `egDissolveArt`,
    `egBeatTellMaps`). Each stage is the Steps' dial with exactly the cells its stage keeps (`SD_BEAT_DISSOLVE.keep` of
    16, by the ordered dither, cells of the Steps' own three texels). The rest is a hole and dark. They are uploaded as
    cutouts (the renderer's RW1 holes) under the band block's second archive (`egTellArchive`, 38242 for the Galleries -
    the block's "own later records").
  - The warning's light is the danger palette's hazard (`ui/eliteGates/egAccess.js`): white, or High contrast's cyan with its rim
    line dashed four texels on and four off (`world/superDungeon/sdStepsArt.js` `beatArt`'s `warn` and `dash`; the Hour's own art is
    unchanged byte for byte). Its falter is the Steps' blink law's - shown 0.2 s, then out.
  - Gone, its gold ghost.
- **MY CRUMBLE** (and a bone bridge, the Crumble's law; section 10.3: "three crack stages, and the rewind as it
  returns"). The Steps' own look (`scenes/superDungeon/sdSteps.js` `crumbleLook`) on the Spire's Crumbles:
  - my foot on it grinds where it stands (`AmbientGrind`);
  - its three crack stages flare across the shake (a kind a stage, `SD_CRUMBLE_STAGES`), and its grit pours;
  - fallen, its plate is gone and its chunks (two on a phone) fall, drift and tumble by the Steps' own law
    (`sdChunkWays`, `sdChunkMatrix` - exported, the Hour reads them too), out of sight past `SD_CRUMBLE_SEEN`;
  - its ghost counts the return; in the last `SD_CHUNK.rewind` the chunks fly back up, eased out;
  - whole again, they click home (the clunk pitched 2.6) and it shudders.
- **A DRIFT'S HANG** (`egHangModel(band)`; section 10.3: "hangs on two chains from an anchor 18 m up (an arch rib, a
  ribcage, a moon-shard, a crane hook), leaning as it swings").
  - Two chains of links, every other turned a quarter, hang on the Steps' pendulum's own line (`SD_PENDULUM.foot` either
    side of the deck's middle, clear of a body at its edge) from brackets on the deck's sides up to the pivot
    `SD_PENDULUM.len` over it, in the band's metal.
  - The band's anchor: the Galleries' broken marble arch rib with gold leaf on its crown, the Cairn's bone ribcage, the
    Shade's moon-shard, the Wellhead's iron crane hook on its cable.
  - The whole turns about the pivot by `pendulumAngle` of the law's own swing, as the Hour's pendulums do. A kind a
    hall, so only the halls in view re-lay their swinging copies.
- **THE ISLANDS' WAYSTONES** (section 10.3: "Islands carry the Steps' waystone, lit gold while it is a member's cast-back
  point"). The Steps' waystone stands on every island at the Steps' own place beside its landing
  (`world/superDungeon/sdStepsModel.js` `sdWaystonesOf`). Its rune is lit while my cast-back point (`safe`, a pull's landing too)
  stands on its island, edge to edge, and dark otherwise (`SD_WAYSTONE_DARK`) - one at a time, none on a plate.
- **THE GUST'S BANNERS AND ITS WIND** (section 10.3: "a streamer banner on every island pointing the push 1 s ahead; the
  wind rising (`AmbientWindMoanDeep`)"). The Steps' vane stands on each island of a Gust section (`sdVaneAt`'s place on
  it), swung by the breath's own clock (`vaneYawInto`) to point the coming push a second ahead. The wind and the vane's
  clack sound once a gust while I stand over the section or its islands, and nowhere else.
- **A GHOST SLAB** (section 10.8: "A peer on a crumble the viewer has seen fall is drawn on a ghost slab").
  - `net/online.js` tells `rideAt` of every drawn peer in the Spire. A peer on no ride is told and never moved; a
    ridden one is still moved on its copy.
  - The breach client hands a peer on no ride to the spans (`scenes/eliteGates/egClient.js` `rideDraw`,
    `dungeonContext.egSpanPeer`, `scenes/eliteGates/egSpan.js` `peerOn`).
  - A peer whose drawn feet stand on a Crumble fallen under my own foot - on its top within the capsule, within the
    ride's height band (`net/eliteGates/egFair.js` `EG_RIDE_DOWN_M`, `EG_RIDE_UP_M`) - lights that ghost's top (`EG_GHOST_SLAB`:
    0.35 of the ghost's light, held 0.3 s past the peer's last word). The peer is drawn standing on it, not on air.
- **THE RAIL'S TRACK TICKED AT EACH END** (`world/eliteGates/egLook.js` `egCircleEdges`; section 10.3: "a dashed gold track between
  its plates, ticked at each end"). Across each side's track, at each end of its travel, a tick one dash long at the
  track's own depth, in the same gold. A Drum's track is ticked the same.
- **A DROP'S WALL LIT** (`world/eliteGates/egHall.js` `EG_DROP_LAMP`; section 10.3: "the landing's edge line, gold; the wall's face
  lit"). A lamp of the circle's own light stands over each Drop's landing, 1.5 m before its far wall's face and 4.5 m up
  it, so the wall a body carried too far meets is seen from the takeoff.
- **REDUCED MOTION** (section 25.7: "It, or the system's setting, governs ... the shakes"). The row or the system's
  setting stills every piece's shake the spans draw: a Crumble's shake and its shudder home, a slag crust's last second,
  Grath's cracked isles. The cracks, the falter, the dissolve and the light still tell.
- **Measured** (EG-G2's measure: node, 60 circles - seeds 7, 99 and 12345, circles 1 to 20; before at b4af2365):
  - a circle's GL draws with every copy in view: 13.5 on average (worst 23) before, 16.6 (worst 28) after. With the tells
    at their worst - every Crumble of a circle fallen under my foot, its chunks in the air - 18.8 (worst 31). EG-G2's own
    bound, at most 48 a circle, holds;
  - from Hall 2's plate down its course (seven circles, 300 frames each): 11.0 GL draws on average (worst 15) before, 12.8
    (worst 19) after - the new kinds are a beat's second draw, a hall's hang, the waystones lit and dark, and a Crumble's
    stages, chunks and grit only while they show;
  - the dynamic draws a circle stands (each kind one, drawn or not): 9.1 (worst 14) before, 19.5 (worst 29) after. A
    Falling Wall's circle stands 21 where a draw a piece would stand 208 (about a tenth, EG-G2's bound held: at most a
    tenth of the pieces plus one);
  - the ride and the cull together (seven circles, Hall 2's eye, the two trees run in turn five times): a median frame of
    0.006 ms before and 0.011 ms after, a mean of 0.015 ms and 0.036 ms (node, on a machine shared with other work).

**The four hosts.**
- `src/scenes/dungeonContext.js` - WIRED: `egSpanDraw(proj, view, fog)` (the spans' ghosts and slabs) and
  `egSpanPeer(x, y, z)` (a peer's drawn feet), beside EG-G2's `egSpanCull`. The ghosts' pass is freed by the span's
  clear on every path that clears it (its teardown, `egRecircle`'s swap).
- `src/scenes/world.js` - FLAGGED: untouched. The ghosts draw in the breach client's pass, which `drawEgFight` already
  calls. The peer's word rides net/online.js's `rideAt`, which the client sets.
- `src/scenes/worldModes.js` - FLAGGED: untouched. Its cull before the dynamic draws (`egSpanCull`) already culls the
  new kinds.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach.

**Departures, said plainly.**
- **Done another way:**
  - the Beat's dissolve is made in its picture (cutouts), not by swapping in the Hour's cut meshes. A kind of Beats stays
    one batched draw; the four stage meshes would have cost about 13,000 vertices a copy;
  - a Beat's frames run a kind a beat. Every circle measured lays its Beats on two beats, half a cycle apart, so a
    circle's Beats are two draws where they were one;
  - a Beat's warning frames (its frame 10 and its falter) are painted for the Spire with the palette's hazard; frames 0
    to 9 stay the Hour's own, their dim ember inlay with them (EG-G2's "the Steps' own pieces keep the Hour's art");
  - the anchor rocks with its chains, as the Hour's gear rocks with its rods, so a Drift's hang is one turning copy;
    its tilt is at most asin(2 / 18), 6.4 degrees;
  - the Gust's "streamer banner" is the Steps' own vane on each Gust island (the Hour's tell for the same breath), beside
    EG-G2's streamers across the section;
  - "the wall's face lit" is a lamp of the circle's own light before it, not a lit face: gold on a wall would say "it
    holds" (section 25.2);
  - the Beat's pictures are the breach's: uploaded once a renderer for each band and palette, never freed at a clear - the
    band dress's own law, so a swap uploads nothing again - and freed with that dress at the breach's end (AUDIT EG III:
    `scenes/eliteGates/egSpan.js` `egBeatTellDown`, called by `egBandsDown`; EG-ZN had retired the session law this line cited). The
    ghosts' pass, the batch's meshes and every tell's slot are the span's and are freed at its clear;
  - the ghost slab is the ghost's own top, filled in its gold at 0.35 of its light, while the peer's word holds (0.3 s);
  - the Gust's wind is the page's AmbientWindMoanDeep (66), where the Hour's breath blows AmbientWindBlow1 (70).
- **Not built:**
  - the band's glyph on a Beat's face: the page names no glyph a band, so the Steps' dial stands for "a sector
    sweeping through the solid time";
  - the Gust's "streaks at the screen's edge": a screen-space overlay; the streamers and the banners carry its tell;
  - a peer on a Sinking Stair flight I have sunk: the page names the Crumble alone.
- **Not verified without a browser and the game's data:** nothing was seen on a screen. The shaders were run through
  `test/glsl.mjs`, the passes through a recording GL, and the pieces through a counting renderer. The cutout dissolve,
  the chains and the anchors were never looked at, and the frame times are node's, not a phone's.

**Pins.**
- `test/world/eliteGates/egz_tells.test.js` (9).
- `tools/mutants/egz_tells.json` (65, every one dead on the first run).
- Re-aimed by content (mutantdrift): `egseam.json`'s EGSEAM-the-ghosts-past-the-most (`ghosts.slice(0, max)`) and
  `sd25_steps.json`'s SD25-S9-every-ghost-a-beat-plate (the ghost's `edges`).
- Judged again over the files this slice touched: `egfrag.json`, `eglook.json`, `egplay.json`, `egseam.json`,
  `egz_frag.json`, `egz_stair.json`, `sd25_steps.json`, `egspan.json`, `egz_telegraph.json` and `sd25_look.json` (592: 591
  dead, and `sd25_look.json`'s SD25-the-street-off-its-palette equivalent as recorded).
- PIN MOVED: `test/world/eliteGates/egswap_client.test.js` - a band's Beats' pictures go up once a session with its dress, never by a swap.
- `RELAY_VERSION` is untouched (nothing in the relay's graph moved), and `ACCOUNT_VERSION` stays `acct121`; no migration.
- No new src module.

### EG6a - 2026-10-12 - THE SPAN GENERATOR, THE SWEEP AND THE CROSSING'S BOUND

Mac: "I said I want everything". Section 31's EG6a row, as this slice was cut: the span generator (sections 9 and 10.1),
the real-motor course sweep (section 10.5, "The sweep") and the crossing's bound at THE FAST BUILD (section 10.5). It
retires EG-H1's departure 4 and narrows EG-H3's departure 6 to the riders.

**What shipped, by piece.**

- **THE SPAN GENERATOR** (`net/eliteGates/egSpanLaw.js` `egSpanOf`, new, in the relay bundle). The envelope moved there with it
  (`EG_GAP_MIN_CM`, `EG_GAP_MAX_CM`, `EG_RISER_CM`, `EG_BEAT_HALF_MS`, `EG_STEP_DOWN_CM`, `EG_DROP_CM`, and the die's
  `egDieBetween`); `net/eliteGates/egLaw.js` says them as it always did.
  - `egSpanOf(seed, hall, band, { r, sizes, start, checkR })` draws a hall's every course off the hall's own die (the hall
    law makes it from the seed and the hall, a sub-seed a try - section 10.5's redraw), in the law's integers. It draws each
    piece's numbers at the Steps' own timing (`run`: one riser a hall, Crumbles stepping down, a Drop or still ground under
    2 m), a gap of the envelope (`gap`), an island (`check`, a checkpoint and the next span), a piece placed (`step`), and
    THE FORK's two roads, each its own course spec (`road`). The hall tells it where the hall stands before each piece it
    asks for (`at`: still ground run over, a climb or a fall, said into the road's spec).
  - `courseOf` lays the Spire's specs too. A spec that says its `road` carries the hall law's fields (`gap`, `road`, `kit`,
    `after`); a piece carries its own `x` and its number in the hall's one count (`i`); a `ground` entry is still ground run
    over; a section says its `span`. The Hour's spec still lays the Hour's course byte for byte (EG4's pin).
  - `layHall` calls it. Its `step`, `gap`, `island` and `run` are the generator's, and its passages, set pieces, shafts and
    THE FORK lay their courses through it. The hall's steps ARE its courses laid (`P.steps = S.lay()`, every road's steps in
    the hall's one count).
  - Spec laws 4 and 5 lay byte for byte the halls they laid before: each law's 800-hall hash, and 25,200 halls (24 seeds,
    five grounds, 105 halls, both laws) hashed whole before and after.
  - `egCourseOf(spec, road)` reads a road back off the spec as the Steps' readers take it (`{ road, steps, checkpoints,
    end }`, in metres).
- **THE STEPS' READERS ON THE SPIRE'S COURSES** (`scenes/eliteGates/egSpan.js`). The islands' waystones are read off the courses
  the generator laid: `sdWaystonesOf` over each road's course (`egCourseOf`), the arrival plate none, the Low Road's
  island its own. Over 9,000 halls that is every island of the hall, so each island has exactly one stone. The stones'
  look and the ghosts are EG-ZL's (see "At the merge" below).
- **THE SWEEP** (`tools/egSpanSolve.mjs`, new; `.github/workflows/eg-sweep.yml`, new).
  - The CLI reads a hall's courses through the solver: each pair's windows, the proof, the road's crossing at THE SPAN
    BUILD and at THE FAST BUILD, and `EG_CROSS_MIN`.
  - `--sweep` crosses every course of a seed's circle in each band (each hall's every road, THE FORK's two) STEP BY STEP BY
    THE REAL MOTOR. That is `PlayerMotor` at THE SPAN BUILD (Speed 10, Running 0, Jumping 0; the online page's parkour at
    skill 0 only to run up a riser) on the real `Collider`, over the circle's floors (`egCircleColliderTris`, the one bucket
    the dungeon stands) and its pieces as `createEgSpan` rides them (the Steps' `stepTris` slabs on the shared clock,
    carrying, crumbling, a Pendulum's touch casting back, a Gust pushing). SD7b's harness is the model.
  - A pilot plays each pair as a player would:
    - it stands where it will run from, held there against a push;
    - it takes a launch the solver says lands (`egJumpLands`, now exported), held 0.06 s either side: its own piece standing
      under it to the last, no gust in the flight, a Pendulum's weight clear of the flight's whole line, the two tops lined
      up best within the window;
    - while what it lands on keeps time, it looks ahead: the launch from there must come in time too, the landing allowed
      0.2 s late;
    - it runs at the landing and jumps at the edge itself (pressed 0.3 m short the motor falls short of 3.19 m to a round
      island; 0.1 m short, as SD7b presses it, is within the motor's own margin - it clears 3.44 m); late to its run-up it
      never jumps short of the edge: it runs on while the solver's launch from the edge still lands, else it plans the pair
      again from where it stands (THE ASCENT's sweep, 2026-10-16: a band 3 hall it once fell in);
    - what slides under it on the way to the edge it stands on (two Rails' travels meeting), and the hall's own ground at
      the step's height it lands on (a vault's side lane laid across the gap before a step);
    - it runs off a still step a short way down (a running jump flies past a stair), runs up a riser, and leaps the gaps
      the hall leaves in its still ground.
  - A course not crossed fails the run, naming it (`FAIL seed <s> hall <h> road <r> step <i>`), and the exit code is 1.
  - CI: `verify.yml`'s new `sweep` input (25) and its `sweep` job call `eg-sweep.yml` on the commit it verifies: four band
    jobs beside the test shards, the law pin's golden seeds with them. `eg-sweep.yml` runs 500 nightly (06:41 UTC) and on a
    dispatch. `relay-deploy.yml`'s verify asks 500 before a deploy drops a player.
  - Measured on a four-core machine, the four bands side by side: the pull request's 25 seeds and the golden four in
    16-19 s a band (95-111 courses), beside test shards that run minutes; the nightly's 500 and the golden four in
    166-197 s a band. Every one of those 7,582 courses (seeds 1 to 500 of every band, THE FORK's Low Roads among them) is
    crossed.
  - The first 500-seed sweep failed 9 of 5,669 courses past seed 125, every one the pilot's: the jump pressed short of
    the edge, a Rail it jumped past, a side lane it refused. Each is fixed and pinned (the pins below).
- **THE CROSSING'S BOUND** (`net/eliteGates/egSpanLaw.js` `egFastReach`, `egFastCrossAt`, `egFastCross` and `egCrossMin`, new;
  `EG_FAST_RUN_MPS` moved here from `net/eliteGates/egFair.js`, which says it; `EG_FAST_JUMP_X`, `EG_CROSS_SLACK`, `EG_FAST_LEAP_M`).
  - THE FAST BUILD's jump is the motor's 4.5 m/s times 2.3 (Jumping 100, the Jump spell, athleticism improved - pinned to
    `systems/skills.js` `jumpSpeedMultiplier`), a 2.68 m apex; its run is `runSpeed(100, 100)` times Fleetfoot III's 1.1.
  - A road's crossing at it is the earliest arrival over the road's chain (the Low Road's: the trunk, the bridges across and
    back, its own). Every launch is the first that lands; any piece within the build's jump may be leapt past
    (`EG_FAST_LEAP_M`). The crossing is the least over 72 start phases.
  - `EG_CROSS_MIN` is that less 15% (`egCrossMin`, ms). `net/eliteGates/egFair.js` `egCrossMinMs` reads it, and it stays a measure on
    the member's record that gates nothing until EG21.
  - Measured over the 366 roads of seeds 1, 2, 3 and 77: the fast build never waits, leaping past whatever it cannot land
    on. So on every one the bound equals the road's length at the fast run less 15%, the number it measured before - now
    as the solver's answer. It differs where a timed piece holds even the fast build.

**Fixed on the way.** A Gust's breath (`scenes/eliteGates/egSpan.js`, `EG_GUST_REACH_M`) blew over the whole hall's width and from a
hall's first Gust piece to its last. The sweep found a Low Road walker, 15 m across and 4.5 m under, blown off its bridge by
the High Road's breath, and the Crumbles between two runs of Gusts blown as though the runs were one. Each run of Gust
pieces is now its own section, on its own road's line, 6 m either side: `world/eliteGates/egLook.js` `egGustSections`, the streamers'
sections, is the breath's one home, and the screen blows over it. At the merge EG-ZL's banners and wind came to read the
same sections. A banner stands on a run's own islands, never on THE FORK's other road's island beside the run (seed 1's
circle 9, hall 42). The wind is heard over the run's stretch.

**Departures, said plainly.**

1. `egSpanOf` takes no `budget`. Section 9's `egBudget` is EG21's knob and unbuilt, and any budget draw would move every
   hall of laws 4 and 5, which this slice keeps byte for byte. The die is the hall's, handed in, so `net/eliteGates/egSpanLaw.js` stays
   a leaf that imports nothing.
2. The hall law still picks each run's piece and count (the two pieces, the counts by circle and decree). The generator
   draws each piece's own numbers, places it and lays it. The spec gains no field (`egCourseOf` reads a road back off it),
   so `EG_SPEC` stays 5.
3. THE TIMED SOLVER is unchanged, since changing it would move the halls. The sweep found six places where it is looser
   than the motor, and the pilot covers each as a player does:
   - the solver treats still ground as one ground, but the hall law leaves gaps of 2.0-3.2 m in it (a passage's floor and
     the island after it, a Collapsing Tube's end). No piece keeps their time, and the sweep leaps every one;
   - it judges a Pendulum's weight at the flight's middle alone;
   - it never asks what a Beat or a Crumble does under a member standing on it before the next launch;
   - it reads a round island's edge as straight across;
   - its sideways reach counts the capsule over both edges, so at the widest gap the pilot waits for the tops to line up;
   - THE FORK's High Road tail is chained through a ground of no length (the roads' steps are laid apart in the one count);
   - the proof measures a Rail's travel against its neighbours at rest, so two Rails side by side may roll into one
     another (seed 470's band 2, hall 52), their slabs overlapping, and the next is walked onto.
   None has failed a course in the sweep. Each is a solver change for a later spec law.
4. The pilot plays with the solver's windows in hand, so a course that fails can name a wrong guess of the pilot's as
   surely as an uncrossable course. Every failure found while building it was the pilot's or the screen's (the gust),
   none the generator's. One of its readings is unpinned: which spout's crust it stands on (a slag crossing's lane, read
   off the key it landed on). Forgetting it crosses all 7,582 courses still, so no mutant of it can die.
5. The ghosts are EG-ZL's circle-wide ones (its `EG_GHOSTS_MAX`, a Bone bridge among them), not the Hour's reader
   `sdGhostStepsOf` over the course I am on. That reader still takes only the Hour's course; the Spire's courses feed it
   nothing yet.
6. The fast build's crossing reads the pieces' tops as the solver does: a leap over a riser or through a Pendulum's lane is
   not refused. A lower bound may only err fast.
7. The page's "every changed golden spec" is the law pin's four golden seeds, swept on every pull request.

**The four hosts.**

- `src/scenes/world.js` - FLAGGED: untouched at the merge. The breach client's pass (`scenes/eliteGates/egClient.js`, EG-ZL) draws
  the spans' ghosts. This slice's second draw in `drawEgFight` was deleted, or every ghost was drawn twice a frame.
  Nothing was added to `function frame(now)`.
- `src/scenes/dungeonContext.js` - WIRED by EG-ZL's door: `egSpanDraw(proj, view, fog)` (and `egSpanPeer`), the one
  kept of the two this slice and EG-ZL each wrote.
- `src/scenes/worldModes.js` - FLAGGED: untouched; it already calls `host.drawEgFight` for every Elite hall.
- `src/scenes/exterior.js` - FLAGGED: offline, no Elite Breach (section 28).

**Not verified without a browser and the game's data:** the waystones and the banners read off the courses were never
drawn. They were checked as slots and matrices, not pixels. The sweep crossed with the real motor and collider in node, never with a person at the keys. The workflows have
not run yet: the nightly runs only from main.

**Pins.**

- `test/net/eliteGates/eg6a_span.test.js` (5), `test/tooling/eg6a_sweep.test.js` (4), `test/world/eliteGates/eg6a_screen.test.js` (3 since the merge). The sweep's file crosses
  the hard courses by name: seed 295's Drum and seed 147's round island (band 0), seed 362's vault lane (band 0), seed
  470's meeting Rails (band 2).
- `tools/mutants/eg6a.json` (71 at the slice, 62 since the merge, every one dead; judged on the merged tree beside `egz_tells.json`'s 65 and `eg5.json`'s 40 - 167 dead). Six were judged again after the gust
  sections moved to `world/eliteGates/egLook.js` and the die's draw was renamed - dead.
- Re-aimed by content and judged again: `egseam.json`'s EGSEAM-the-line-lost (courseOf's line now names the Spire's
  road). Judged again over the five files whose text moved (`net/eliteGates/egSpanLaw.js`, `net/eliteGates/egLaw.js`, `net/eliteGates/egFair.js`,
  `scenes/eliteGates/egSpan.js`, `world/eliteGates/egLook.js`): the 113 records the other lists aim at them (egarch, egfrag, egfull, egint,
  eglook, egmade, egplay, egseam, egspan, egz_frag, egz_legion, egz_telegraph, sd10b, sd7a) - every one dead.
- `RELAY_VERSION` `world198`, unshipped, rehashed in place: `net/eliteGates/egSpanLaw.js`, `net/eliteGates/egLaw.js` and `net/eliteGates/egFair.js`
  changed. Rehashed again on the merged tree, its note after every other slice's. `ACCOUNT_VERSION` stays `acct121`;
  no migration.
- New: `tools/egSpanSolve.mjs` and `.github/workflows/eg-sweep.yml`; `src/` gains no module. The Port-Ledger's
  ELITE-GATES row names them (at the merge).

**At the merge** (the pull request's head 17491139: EG-ZI, EG-ZO, EG6c, main, EG5 with EG-ZK, EG-ZM, EG-ZN and EG-ZL).

- EG-ZL built the same two things this slice built in `scenes/eliteGates/egSpan.js` and `render/superDungeon/sdStepsPass.js`: the Steps' waystone
  on every island, lit at the cast-back point, and the gold ghosts for gone Beats and fallen Crumbles. EG-ZL's is the
  more complete, so it is the one kept:
  - its ghosts are the circle's (up to 48, a Bone bridge among them), each with a slab for a peer standing on a Crumble I
    have seen fall, under the Spire's fog floor;
  - its stones are batched slots, lit and dark;
  - its seams are `egSpanDraw` and `egSpanPeer`.
- DELETED from this slice:
  - the course window of ghosts (`poseGhosts`, `SD_GHOSTS_MAX` nearest ahead);
  - `SdStepsPass.setGhosts`;
  - the stones' own mesh and `poseStones`;
  - the `stones` and `ghosts` getters;
  - `scenes/superDungeon/sdSteps.js`'s `WAYSTONE_DARK` export (EG-ZL's `SD_WAYSTONE_DARK` is the one);
  - the second ghost draw in `world.js`'s `drawEgFight`.
- FOLDED INTO EG-ZL's:
  - its stones are read off `egCourseOf`;
  - its gust (push, banners, wind) reads `egGustSections`' runs on their road's line.
- PIN MOVED: `test/world/eliteGates/eg6a_screen.test.js`.
  - Its waystones test reads EG-ZL's `marks.stones`, standing two frames because the marks are posed at the frame's start.
  - Its ghosts test is deleted: `test/world/eliteGates/egz_tells.test.js` pins the kept ghosts.
  - Its hosts test now pins one ghost draw a frame.
  - Its gust test adds the banner on the run's own line.
- Mutants:
  - eleven `eg6a.json` records went with the code they mutated;
  - two are new: the banner on the other road; the world host drawing the ghosts again;
  - `egz_tells.json`'s EGZL-banner-none was re-aimed by content (the banner's test now names the run's line).
- EG5's change to `net/eliteGates/egLaw.js` (the fight profile) merged clean. The merged tree's 25,200 halls (laws 4 and 5) hash as
  the pull request's head's do, and each law's 800-hall hash holds.
- The sweep on the merged tree: the 25 seeds a band and the golden four, all crossed. Seeds 1 to 500 of every band,
  7,582 courses, all crossed.

### EG-ZJ - 2026-10-12 - THE FIGHT WHOLE ON THE WIRE

Mac: "I said I want everything". Closes what sections 11.7, 22 and 23 left of the fight's own words: every body's height on
the wire and on every screen, the whole fight handed to a member who joins or reloads mid-fight, and the shaft's
telegraphs on the slag's own surface. It closes EG-ZB's departure 3 (the wire carried no body's height), layer three's look
departure (a joiner saw Grath's islands standing until the next `eob`) and EG-ZC's departure for the telegraphs of a
shaft. Each sentence is deleted where it stood.

**What shipped, by piece.**

- **A BODY'S FEET** (`net/eliteGates/egWalkGraph.js` `egFeetAt`, `egWalkFeet`; `net/eliteGates/egLegion.js` `egAirY`, `walkGraph`, `walkAir`).
  - `egFeetAt` gives the fight ground under a body (`egGroundAt`, 0.3 m about its plan). It looks first in section 11.7's
    band about where the body stood. With nothing in that band it takes the lowest floor that holds the plan: a leap up past
    a floor's rim, a fall off a lip. With no fight ground under it at all (the void, a wall's alcove) the body keeps its own
    height. Heights are whole centimetres, the law's.
  - A graph walker's feet are its region's floor (`egWalkFeet`: the region it stands in, and the one its next walk ends
    in). `walkGraph` sets its feet on a region it has just entered, so a lip stepped off is a drop at the lip and never a
    glide. Its walk ends on its next node's floor, so a stair is climbed as it goes. `egWalkNext` now reads the walker's own
    region by its feet (`b.y`), where it read the plan alone. A Caster on a pillar whose plan shares a bastion's now stands
    on the pillar.
  - A flier's height is its mark's (`egAirY`). It keeps the floor under the mark while the mark's feet stand in that
    floor's band, so a jump never lifts it. Past the band it keeps the mark's own feet: a member on a span's platform, a
    hunted member held high. Every flier is given its mark: a span's shadow its member, a span's Diver the island ahead, a
    Diver elsewhere its member, a hunting Harrier the hunted, a Wraith coming or tethered, a Shade its slayer.
- **THE BODY'S WORD** (`net/eliteGates/egBodies.js`; `net/wire.js`).
  - A body carries its feet (`y`). `egBodyNew` takes a height it is given, else `egFeetAt`. A raise's spot may carry a
    height (`egRaise`, `egLegionRaise`: `[x, z, y]`). The director raises a span's shadows at their member's height and its
    Divers at the island's (`spanLegion`), a false wall on its alcove's own floor (`fragStand`), and a Rampart's pinned
    Casters on their pillars' tops (`standFight`'s `onPillar`).
  - A walk carries its height and its end's (`mv.y`, `mv.ty`). `egWalkY` carries the height along its place and `egCarry`
    carries it with the place. `egWalk` says a walk again when its end's height moves past `EG_Y_RESAY_M` (0.6 m, a level's
    own band), or when the body's feet have left the walk's line (a lip stepped off). A standing body whose ground moves
    under it is said again too. `egStop` keeps its feet. `egPlace` sets a body down on the ground at its landing, by the
    band about where it stood.
  - On the wire a body's row is seventeen, `[i, role, k, pt, x, z, hp, max, fl, tx, tz, v, at, y, ty, st, sa]`, and a walk
    (`emv`) is nine, `[i, x, z, tx, tz, v, at, y, ty]`. `validEgOut` bounds both heights at the hall's coordinate bound
    (`EG_XZ_MAX`, 400 m) and the state at 0-99.
  - THE FIGHT'S GROUND. `egFightBind` keeps the hall's fight view (`egFightView`) on the fight unenumerated, because storage
    keeps the fight and never its hall. `egFightNew` binds it. The director's `specOf` binds it again on every word it takes,
    a beat's or a blow's. So a woken room's restored fight stands what it raises, places and walks on its ground from its
    first word.
- **THE JOINER'S STATE** (section 22; `net/eliteGates/egBodies.js`, `net/eliteGates/egLords.js`, `net/eliteGates/egLink.js`).
  - Every object's state word goes through `egObSay`, which keeps the state on the object as said (`egSaid`: `ws`, and
    since when, `wsAt`). That covers Grath's islands cracked, fallen and risen, the soul-gems' souls laid and emptied, and the
    runes lit and stood on. A lord keeps its phase from its wake and its fall's instant. On the wire that is the row's `st`
    and `sa`: a lord's `st` is its phase once awake (0 asleep), and a fallen lord's `sa` is its fall.
  - THE WHOLE FIGHT (`egFightState`) carries every body at its instant, with its walk carried to that instant (its place,
    its height and its `at` then), its feet and its state. It also carries the zones still to burn (`zs`): burning ground,
    a fallen island's void, a Soul-Pool, a haven (which stands the Moon-Mirror's lit branch). `server/src/index.js`
    `_egHello` already handed `st` and the whole fight. It now hands all of this, and needed no change.
  - THE SCREEN'S FOLD (`egBodyOf`, `foldEg`). The whole fight folds over what the screen already holds:
    - a body it knows keeps when it rose, its hurt and my blow on it (`born`, `hurtAt`, `mineAt`);
    - a body first heard whole has stood all along (`born` 0) and never rises;
    - its state is the room's: an object's `st`/`stAt`, a lord's `ph`, its `fellAt` from its fall's word;
    - the zones are the room's.
    A lord's flags fallen lay it down at once (`efl` - a Twin's first fall says no `efell`), and raised again it stands.
  - Engines' cooldowns are not carried: no screen draws one (the engine's subtitle says "once in 30 seconds" whatever its
    cooldown, and the Shelf's says only "Work it" - AUDIT EG III: it topples once). The Gutterdark, the Rails and a gust
    are not carried either: no screen draws the first two, and a gust is a moment's push.
- **THE SHAFT'S TELEGRAPHS** (`world/eliteGates/egTelegraph.js` `egHazardSurface`; `scenes/eliteGates/egFight.js`).
  - A fragment hazard's own surface is its height when it is of the traversal ground (`aim` 'trav') or the Cooling Slag's
    spill. The spill's lanes pour over a crossing's crust, which is a step of the course and never a fight floor, and over
    its lip. The fight draws the spill told and pouring at that height as one quad of its own (`egFloorPlan`'s own-surface
    draw), as EG-ZG drew the `'trav'` shapes. A crust's last second, told in white, is drawn on the crust's own surface
    (`sh.y` the step's).
  - Checked against the law, before and after. The test finds the first Wellhead Deepway that goes down by the Slag Chute
    (Seed 1's Hall 82: its crust at -5.9 m, no fight floor under it). Before, the floors' plan drew the spill, and the
    crust's tell, only where it clipped them onto the passage floor past the lip (an anchor within 1 m of it), and nothing
    over the crust. After, each is one quad on the crust's surface. A Forge Gut's spill over its chasm is one quad too,
    where before only its lip drew on the far floor.
- **Fixed on the way** (found while building it, each pinned):
  - the whole fight, said every two seconds, stood every body anew on every screen. Every add rose out of the floor again,
    Grath's islands stood again, a fallen lord stood up, a lord's phase was forgotten, and each walk ran ahead by its head
    start (its `at` was the walk's start, its place the room's carried one). The folds above end all of it;
  - the lord's bar never showed in a lord's first phase. `egLordBar` reads a lord awake by its phase, and no word said
    phase 1. The whole fight now says it within 2 s of the wake;
  - bodies stood off the hall's own height were drawn at it, and struck at by the screen's own targets there: the Last
    Armsmaster's Court laid at 2.3 m (Seed 1's Hall 30), the Lurkers past a Deepway's shaft (its floors 5.7-8.1 m down), a
    false wall in an alcove under the course.

**At the merge** (the PR's head at 17491139: EG-ZI, EG-ZO, EG6c, main's #840-#851, EG5 + EG-ZK, EG-ZM, EG-ZN and EG-ZL):
- **THE LORDS ON THE SEAM WALK ON THEIR FEET.** EG5 + EG-ZK put every lord and champion on the boss seam (`EG_SEAM`) and
  walking the hall's graph by the legion's own `walkGraph` and `walkAir`, now exported from `net/eliteGates/egLegion.js` with this
  slice's heights in them. So a lord's feet ride the wire as a legion walker's do:
  - a straight walk within its region ends on the ground there (`egWalk`'s `egFeetAt`): a lord on a raised Court walks
    at the Court's height;
  - a walk over the graph climbs its stair and drops at its lip (`walkGraph`'s `egWalkFeet`): Grath along his bridges on
    islands laid at 2.3 m (Seed 1's Hall 60), a champion up a chamber's stair (Seed 31337's Hall 43);
  - a leap, a run's end or a blink lands on the ground there (`egPlace`), and the Mother of Dusk circles at the ground
    under her goal (`walkAir` with no mark: the flier's own rule).
  One line was changed for it (`lordWalk`). EG-ZK takes a node as reached within `EG_NODE_REACH_M` (0.7 m) even when a
  blow stopped the lord short of it. That lord's region became the floor above while its feet stayed on the stair. Its
  feet are now set on that region's floor (`egWalkFeet`), as `walkGraph` sets a legion walker's. Without it, the
  Kynmarcher stopped 0.4 m short of its stair's top at 3.71 m and then walked the floor above at 3.84 m and 3.96 m,
  never at 4.
- **THE OBJECTS' WORDS THROUGH THE SEAM.** The seven `egObSay` words and a lord's wake, phase and fall (`egSaid`) sit in
  the lords' own law, which the seam plugs. The seam's `stateOf` is `egFightState`, so the whole fight the director says
  (`egFightStateOf`) carries every row at its instant, its feet, its state and the zones still to burn. The joiner's
  test runs Grath's Court through the seam unchanged.
- **EG-ZK'S FRAMES, BYTE FOR BYTE, DO NOT HOLD.** EG-ZK hashed every frame the director says, with
  test/net/eliteGates/egfull_relay.test.js's auto-player (the thirteen lords each to its fall, and the six-circle breach), and found
  all fourteen unchanged against b4af2365. Eight lords whose grounds are one region each said the same frames as before.
  Over this slice that cannot hold: every body's row is seventeen and every walk nine, and the whole fight's walks are
  carried to its instant. What holds was measured at the merge with the same auto-player, on EG-ZK's head and on the
  merged tree. With the heights taken off (a row's `y`, `ty`, `st` and `sa`, a walk's `y` and `ty`, the whole fight's
  `zs` and its walks' `at`), all fourteen runs say the same frames, as many, word for word. Every lord's walk, blow,
  place and fall is EG-ZK's own. test/net/eliteGates/egz_lords.test.js (each seam member the lords' own law, frame for frame) is
  unchanged and green.
- **EG-ZB'S DEPARTURES.** EG-ZK closed its departure 2 (the lords walking as before), this slice its 3 and EG-ZI its 8's
  Lifeline. All three sentences are deleted, and the departures left are renumbered 1 to 9. The records name each by its
  number when it closed.
- EG-ZC's shaft sentence lost its camera clause to EG-ZN (the camera's bias over a shaft's drop, built) and its
  telegraphs to this slice. "A shaft keeps no alcoves or vignettes." stands.
- EG-ZI's `toll` word rides beside the fight's words in `net/wire.js`, and its toll, late wake and Lifeline sit in
  `net/eliteGates/egBrain.js` beside this slice's `specOf` and spots. Nothing of either moved the other.
- `ACCOUNT_VERSION` is `acct122`, renumbered by the lead's merge of main's #840-#851. This slice touches no account law.

**Departures, said plainly.**
1. The heights ride the words the fight already says, the body's row and the walk, with no frame of their own. A row grows
   by its four fields: 8 bytes at a floor's 0, at most 33 at the wire's bounds. A walk grows by its two. Over 60 s of a
   Rift-Yard fought by four with its legion up, the room's frames weighed 75,068 bytes before and 83,043 after (+10.6%), in
   the same number of frames. Section 23 names no per-frame number, and no cap binds the room's own frames
   (`MAX_FRAME_BYTES`, 16 KiB, bounds what a client sends): a 64-body fight's rows at their bounds weigh 8.3 KB at this
   slice's seventeen fields a row (eighteen since EG-ZQ's size).
2. A walk's height runs in a straight line from its start to its end: a stair's own line, a flier's climb to its mark. A lip
   stepped off is a drop at the lip. A leap, a blink and a charge's end land on the ground at the landing, by the band about
   where the body stood, or on the lowest floor there when the band holds none.
3. A body raised at a spot with no height of its own stands on the lowest floor that holds it, so a spot inside two floors'
   plans (a balcony's rim over its chamber) raises it on the lower one. The Rampart's pinned Casters are raised at their
   pillar's own height.
4. A flier keeps its mark's floor while the mark stands in that floor's band, so a jump never lifts it. A Diver over a span
   circles at its island's height. One with no island or plate ahead circles at nought, but such a member stands off the
   hall.
5. The lord's phase rides the whole fight, not a word of its own at the wake, so the bar shows within the next whole fight
   (2 s) of the wake. An `eph` at the wake would have been heard as a phase's growl.
6. Engines' cooldowns, the Gutterdark, the Rails and a gust are not handed to a joiner: no screen draws them.
7. A blow Watchfire told a member before its word (`tell`, at most 400 ms ahead) is not told again to one who joins in that
   instant.
8. `server/src/index.js` is unchanged: its hello already sent `st` and the whole fight.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED, nothing to wire: the fight draws its bodies in the pass the host already calls, and
  `feet`, `peerAt` and the link are as they were. Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: untouched.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched (the breach client's `drawPass` it already calls draws the bodies).
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Not verified without a browser and the game's data:** the bodies' heights, the joiner's screen and the slag's quads were
checked against the director's own words, the screen's batches, targets and sounds, and the floor plan in node. None was
seen in the live game.

**Pins.**
- `test/net/eliteGates/egz_state.test.js` (7): the feet's law, the director, the lords on the seam (added at the merge), the screen, the
  joiner, a reload in the real Room, the shaft's telegraphs.
- `tools/mutants/egz_state.json` (96, every one dead; two added at the merge: a lord's straight walk at the hall's 0, and
  its feet left on the stair at its top; 97 since AUDIT EG IV's AUDIT-EG-IV-region-hint-pad-short, a walker up a rim
  stair - `01-Overview/audits/Audit-EG-IV.md`). One survived the first run - the pinned Casters raised at a spot's height
  again - and was killed by finding a Rampart whose pillars given to a company of two share a bastion's plan.
- Re-aimed by content (mutantdrift): `egz_frag.json`'s EGZ-the-breach-s-law-forgotten (onto `specOf`'s own line) and
  `egz_legion.json`'s EGZ-ground-walkers-straight (onto `walkGraph`'s). Judged again, every record of the lists aimed at
  the fight's modules this slice touched (`net/eliteGates/egBodies.js`, `egLegion.js`, `egLords.js`, `egWalkGraph.js`, `egLink.js`,
  `scenes/eliteGates/egFight.js`, `world/eliteGates/egTelegraph.js`) and those within ten lines of its changes in `net/eliteGates/egBrain.js` and `net/wire.js`:
  `egz_telegraph.json` (52), `egz_legion.json` (21), `egint.json` (15), `egz_sound.json` (12), `eglook.json` (6),
  `egz_recap.json` (6), `egz_return.json` (6), `egfrag.json` (5), `egpres_hud.json` (4), `egz_frag.json` (3) and
  `egspan.json` (2) - 132, every one dead.
- PIN MOVED: `test/net/eliteGates/egplay_relay.test.js` (a body's row of seventeen, cut short at sixteen); `test/net/eliteGates/egz_stair.test.js` (its
  two hand-built rows of seventeen).
- At the merge: `egz_lords.json`'s EGZK-a-reached-node-forgotten re-aimed by content onto `lordWalk`'s line, which now
  sets the feet too. Judged again on the merged tree: `egz_state.json` (96), `eg5.json` (40), `egz_lords.json` (35: 33
  dead, its 2 equivalent as recorded) and `egz_rules.json` (78) - every one as recorded.
- `RELAY_VERSION` `world198`, unshipped, rehashed in place: `net/eliteGates/egWalkGraph.js` now walks before `net/eliteGates/egLegion.js` in the
  relay's graph, since `net/eliteGates/egBodies.js` imports it. Rehashed in place again at the merge, over EG-ZI's `toll` and EG5 +
  EG-ZK's seam. `ACCOUNT_VERSION` is untouched (`acct121` when this slice was cut, `acct122` since the lead's merge of
  main), and there is no migration.
- No new src module. The Port-Ledger's ELITE-GATES row is the lead's.

### EG-ZP - 2026-10-12 - THE CLIENT'S LAST DEBTS

Mac: "I said I want everything". Three debts the screen still owed. The member's own client applied no team Vestige to a
blow it took, while the relay's census did (EG-ZI's "Not built"). The Spire's circle kept its meshes after the player left
(section 29, found by EG-ZN). And the page kept sentences the code had closed: EG-H1's departures 3, 10 and 11 and layer
three's straight-walking legion, which EG-ZB said it retired. This slice closes EG-ZI's departure 12; that sentence, and
each stale one below, is deleted above.

**What shipped, by piece.**

- **THE RECEIVER'S VESTIGES** (`scenes/eliteGates/egFight.js` `egShieldDr`, `egShieldBreach`, `spared`; sections 15 and 21).
  - A blow of the fight that lands on me (`F.blows`, the census's `k` 0) is now spared on my screen by the share the
    relay's census spares the same blow: Bastion within 6 m (the strongest, and 2% for each other holder, 6% over it at
    most), my Steadfast Line with three allies within 8 m, my Challenger's Oath on a lord's blow, my Immovable still a
    second on a fight floor, and my Lifeline windows. Together they never pass 30%.
  - The law is not copied. The screen calls the census itself (`net/eliteGates/egBrain.js` `egCensusDr`) on what it holds:
    - the breach as the census reads it, built from the room's own words (`egShieldBreach`): each company row's `in`,
      `alive` and `home`, each run's Vestiges and Mastery (`ms`), and my windows on mine;
    - the fight's lords (`F.bodies`) and the hall's fight floors (`net/eliteGates/egWalkGraph.js` `egFightView`);
    - my trail, kept each frame in the census's own shape (`[t, x, y, z, h]` in the hall's frame, its last `EG_TRAIL_MS`
      and the one before);
    - each companion where the screen draws it at the blow's landing, at its feet (the pose stands at the eye,
      `PEER_EYE_M`). A companion the screen does not draw is unseen, as the census counts no member it holds no pose of.
  - `landShare` takes the share (`dr`). The blow's share of my health and its points are both spared by it before the
    saving throw, so its share is the census's to the thousandth: a 0.4 blow beside a Bastion III holder takes 352 of
    1,000 health on the screen and 352 thousandths off the count.
- **LIFELINE, THE RECEIVER'S HALF** (`scenes/eliteGates/egClient.js` `lifelineSaid`, `egLifelineOf`; `scenes/eliteGates/egFight.js`
  `egLifelineOpen`, the fight's `lifeline(v, at)`).
  - Each heal word the screen says (`heal`, EG-ZF's) is read as the census reads it (`egHeal`). If I stood under 30%
    within `EG_LIFELINE_LOOK_MS`, the strongest Lifeline among its healers opens a window on my blows. Healers are named
    by account (`accountOf`, the host's `net/social.js` `accountOfPeer`, as `egPeers` names the company), read by the
    runs the room says, and never mine.
  - "Under 30%" (`lowAt`) is my body seen so at a frame in the Spire, or before the heal that lifted me (my body less
    the heal, as the census reads the count before it).
  - The window is the census's own: `[from, until, share]`, from `EG_HEAL_WORD_MS` before the word's arrival to
    `EG_LIFELINE_MS` after it. The arrival is the word's send on the shared clock plus the half round trip
    (`net/eliteGates/egClock.js` `egClockHalfRtt`). Windows no blow can still be judged in are let go, four are kept, and the
    strongest window's share applies. The numbers are imported from `net/eliteGates/egBrain.js` and `net/eliteGates/egFair.js`, never declared
    again.
- **THE CIRCLE'S MESHES FREED** (`scenes/worldModes.js` `egCircleDown`; `scenes/dungeonContext.js` `addTeardown`; section
  29: "every exit path ... frees the hall's meshes, colliders, riders").
  - `egCircleDown(ctx)` lets the whole circle go from the context it stands in:
    - the slots are emptied first: the mesh, its key, the portcullises, the waystones' mesh and the lamps;
    - the dither pass is told next (`egOcc.clear`, its views of the mesh let go);
    - the circle's draws leave the context's list, and its floors' bucket and each portcullis's moving bucket leave the
      collider;
    - the meshes are freed last, the circle's, the waystones' (`world/eliteGates/egLook.js`) and every portcullis's, so a second
      call frees nothing twice.
  - THE SWAP now lets the old circle go through it: the same lines, moved into the one teardown.
  - The stand hands the context the circle's teardown (`ctx.addTeardown`). The dungeon host keeps its teardowns and runs
    each once in its own `destroy()`, beside the spans' clear. Every road out of the Spire destroys the context: the
    exit (the way home, the tear, a fall's walk out, forsaking, a void, a refused or lost socket), the forced exit (a
    load, a teleport, a respawn) and the two builds abandoned after the stand. So each frees the circle once, and the
    old step under the veil frees it before the next circle stands.
  - The circle goes at the context's end, before the mode turns. The band dress it wore goes on the client's first frame
    out of the Spire (EG-ZN's `egBandsDown`, still refused while a circle stands), so the dress always goes after the
    circle.
  - A way back into the same circle builds it anew, where it once found the old mesh still standing.
- **THE PAGE'S STALE SENTENCES**, each checked against the code (RETIRING A FLAG DELETES THE SENTENCE):
  - EG-ZI's departure 12 (*Not built*: the receiver's client) is deleted.
  - EG-H1's departures:
    - its 3 loses the fallen segments, which EG-ZB made hold nobody (`net/eliteGates/egFair.js` `bandFallen`). The belt's sentence
      stands: belts are still carried under the push's allowance and never ridden (`EG_RIDE_KINDS`);
    - its 11 (the fire fall, the hammer line, the soul-wisp's drain) is deleted. EG-ZB judges the traversal hazards
      (`net/bossRef.js` `judgePlace`) and counts the drains (`censusDrains`);
    - its 10, whose Vestige half EG-ZB and EG-ZI had already closed, stands as it was: the census counts a plain blow's
      share and never its points, since the relay holds no member's maximum health (`judgeShapes`).

    Found on the way, closed by later slices and deleted with them:
    - its 5: EG-ZA's Redoubt receipt carries THE FAIR TRAIL's measures (`m`);
    - its 8: EG-ZD built the feint's dashed fade;
    - its 9's second sentence: EG-ZG built the peril arrow (`world/eliteGates/egTelegraph.js` `egPerilOf`);
    - its 12: EG-H2 put the fight's closures off the saved record, so a trial checkpoints;
    - its world.js host flag's clock sentence: EG-ZD put `egNow` and the spans' anchored clock on the corrected clock.

    The rest are renumbered: old 4, 6, 7, 9, 10 and 13 are now 4, 5, 6, 7, 8 and 9. (EG6a's merge then retired the new
    4, so old 6, 7, 9, 10 and 13 stand as 4 to 8.)
  - Layer three's "The legion walks straight to its mark ... an arch's walls do not yet turn it" is deleted, with its
    pointer in the chambers' bullet ("the relay's walkers do not yet route through it - see the departures"). EG-ZB's walk
    graph routes every ground walker through an arch's gap (`net/eliteGates/egLegion.js` `walkGraph`, `net/eliteGates/egWalkGraph.js`
    `egArchCut`).

**The four hosts.**

- `src/scenes/world.js` - WIRED: the breach client's `accountOf`, a heal word's healer by account (`social.accountOfPeer`,
  the way `egPeers` names the company). Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - WIRED: `egCircleDown`, the stand's teardown handed to its context, and THE SWAP through it.
- `src/scenes/dungeonContext.js` - WIRED: `addTeardown`, and the teardowns run once in `destroy()`.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach (section 28).

**Departures, said plainly.**

1. **The screen applies the census's whole reduction**, Challenger's Oath and Immovable with the three team Vestiges: one
   sum under one cap. With three of the five the screen would disagree with the census whenever the cap binds. Section
   15's table gives both to the client as well.
2. **"Under 30%"** is read off my own body, where the census reads its count and my body's word. They agree when the word
   and the count do.
3. **Lifeline's window opens when the word goes.** A blow already taken inside its back second is not given back. The
   census also judges each blow once, so a blow it judged before the word arrived is not spared there either. The two
   can differ only within the one-way delay.
4. **The heal bucket is not mirrored.** The screen believes a companion's heal that reached it. A heal the room's bucket
   refuses (more healing than an honest company casts) opens a window on the screen alone.
5. **The places are each side's own.** A companion stands where the screen draws it, and the census reads where its
   trail stood. My trail is kept each frame, so Immovable's stillness is judged on more samples than the poses the
   census reads.
6. **A blow's points are spared by the same share.** The census counts none (EG-H1's departure 7, as renumbered once
   EG6a's merge retired its 4). Zones, hazards, drains, the toll and cast-backs are spared nothing, which is the
   census's
   own rule (EG-ZB's census departure: its 8 when this was written, its 6 since EG-ZJ closed its 3).
7. **The circle goes with its context**, not with the client's word as the band dress does. A way back into the same
   circle builds it again. The fight's telegraph and crystal passes go as the breach is left (AUDIT EG V). The
   spans' riders and meshes are the dungeon host's own and go at its clear, as before.
8. **The page's numbers.** Code comments that name a retired EG-H1 departure by number name it as its closing slice found
   it ("EG-H1's departure 3 closed" in `net/eliteGates/egFair.js`, its 11 in `net/bossRef.js`, its 10 and 11 in `net/eliteGates/egBrain.js`).
   The two tags renumbering would have pointed at another sentence (`scenes/eliteGates/egFight.js` and `render/gate/gateTelegraph.js`,
   "EG-H1's departure 8") now read "an EG-H1 departure retired". EG-ZB's departures were renumbered once EG-ZJ closed
   its 3 (its 2 was EG5 + EG-ZK's); EG-ZI's pointer to its 8 is read as the list stood then (section 31's rule).

**Not verified without a browser and the game's data:** nothing was played. Each blow was counted on the director's own
breach and fight (`egCount`, `egHeal`) and on `createEgFight` with no renderer, and the heal word on `createEgClient`
against a stub host. The circle's frees were counted on a counting renderer over the real collider, not on GL.

**Pins.**

- `test/net/eliteGates/egz_debts.test.js` (6) and `test/world/eliteGates/egz_debts_circle.test.js` (3).
- `tools/mutants/egz_debts.json` (49, every one dead on the first run).
- Re-aimed by content (mutantdrift), all dead: `egseam.json`'s EGSWAP-the-old-circle-kept, -the-old-floors-kept,
  -the-old-gates-kept and -a-freed-mesh-drawn, `eglook.json`'s EGLOOK-swap-old-waystones-kept and `egz_camera.json`'s
  EGZN-swap-keeps-the-old. They now aim at `egCircleDown`'s lines, which the swap goes through.
- Judged again: the eleven records of other lists aimed at or beside a line this slice changed (`egint.json`,
  `eglook.json`, `egseam.json`, `egz_camera.json`, `egz_ends.json`, `egz_recap.json`), every one dead; and every record
  of the arc's lists aimed at `scenes/eliteGates/egFight.js`, `scenes/eliteGates/egClient.js`, `scenes/worldModes.js` or
  `scenes/dungeonContext.js` (276: 275 dead, and `egz_ends.json`'s EGZM-slot-emptied-after equivalent as recorded).
- No pin moved. `RELAY_VERSION` and `ACCOUNT_VERSION` are untouched (nothing in the relay's graph moved); no migration.
  No new src module, so the Port-Ledger's ELITE-GATES row is unchanged.

### EG-ZQ - 2026-10-12 - THE RELAY'S LAST DEBTS

Mac: "I said I want everything". Six debts the relay's slices found and recorded, each built to the page: the legion's stale
node (EG5 + EG-ZK's departure 7), the Rampart's pinned Casters (EG-ZJ's finding), the lords' shares (section 13.2; EG5 +
EG-ZK's departure 1), Colossal's size (EG5 + EG-ZK's departure 3), the Markynaz's decree (EG5 + EG-ZK's departure 6) and the
spots' heights (EG-ZJ's finding). All relay law but the size, which every screen draws. Each sentence is deleted where it
stood: EG5 + EG-ZK's departures 1, 3, 6 and 7, its "so a join brings no share", and EG-ZJ's "Found, not changed" with both
its bullets. EG5 + EG-ZK's departures left are renumbered 1 to 3.

**What shipped, by piece.**

- **THE WAY ON, KEPT ONLY WHILE IT IS WALKED** (`net/eliteGates/egWalkGraph.js` `egWayOn`; section 11.7).
  - EG-ZK's rule for the lords is the graph's own now, in one function. The node a walker headed to (`b.wn`) is a way on
    only while its walk (`b.mv`) still goes to it. A walker set down since keeps none: a Breaker's charge cut at an arch's
    wall (`net/eliteGates/egBodies.js` `egPlace`), a push, a pull, a lord's blow, leap or blink, or a straight walk elsewhere. A node
    it stands at (within `EG_NODE_REACH_M`) is reached: its region and its floor are the walker's.
  - Both walkers ask it. The legion asks before each step over the graph (`net/eliteGates/egLegion.js` `walkGraph`). The lords ask
    before they choose a straight walk or the graph (`net/eliteGates/egLords.js` `lordWalk`), and the function replaces their inline
    copy, line for line, feet included.
  - `egWalkNext` itself is unchanged. A walker handed a node with no walk keeps it, as EG-ZB's graph test walks one by hand.
  - Checked on seed 77's Hall 14, a Rift-Yard's chamber whose arch splits its floor. A Lurker walks to a member past the
    arch, through the gap, and heads for the gap's far node. Set down back beside the wall on its own half, its next walk
    went before straight to that node, across the wall. It now goes back to the gap's near node and on through the gap.
- **A PINNED CASTER KEEPS TO ITS PILLAR** (`egWalkNext`'s `b.pinned`; sections 8.3 and 12).
  - A pinned walker's goal is kept inside the region it stands in, and no way off is walked, whatever the region's edge
    overlaps or overlies. The pin is the director's own (`net/eliteGates/egBrain.js` `standFight`, every Rampart Caster stood on a
    pillar). The lip stays the graph's: an unpinned walker on such a pillar still steps off it.
  - Measured with the director over every Rampart of seeds 1-6, the company marching the walkway end to end for 50 s.
    Before, with a company of two, all 22 pinned Casters on a pillar whose plan meets a bastion's walked off it (237 pinned
    in all; none of the rest left). With a company of eight, all 51 of 474 did. After, none of either. EG-ZJ's count (19
    of 69 over 23 Ramparts) was taken with another company and walk.
- **THE LORDS' SHARES** (`net/eliteGates/egLords.js` `egLordsShare`, through `EG_SEAM.join`; section 13.2).
  - A lord's health is its fighters' shares. Each lord's share for a member is `per` x the member's reference damage
    (`dpsRef`, the gate's level claim). `per` is the lord's health per unit of the company's reference damage as it was
    stood: `ttkRef(c)`, a champion's `EG_PROVE_HP_S` x the depth, Colossal's health, a twin's part, a stratum's 0.6.
  - The fight keeps the company it woke with by account (`F.subs`, `net/eliteGates/egBodies.js` `egFightNew`). Each lord seeds its
    shares from it when it first moves one, so its shares sum to its health.
  - The seam's `join` moves a member's share. Admitted, a member the hall did not wake with brings its share at the
    fraction the lord stands at: a share brought as a retired one and restored, the gate's `joinFight` law through its own
    `restoreShare`. A retired share comes back the same way. Refused, a member's share is retired (`retireShare`), at the
    fraction. The last share in a lord is never retired.
  - The director joins members three times (`net/eliteGates/egBrain.js`): at a blow on a lord (EG-ZK's join); in the seen-and-restore
    step, every living member in the hall each beat of a trial while a lord stands (the fallen are never in it); and at a
    fall (`egFall`), unadmitted.
  - A member who can join a hall's lords mid-fight is one a Memento calls back into it after it fell before the wake. The
    breach admits nobody after its open window (section 6.1).
  - A mirror or an image carries no share. An errand's held threshold (the Spellmaster's Examination) keeps its fraction of
    its lord's health. A share moved says the whole fight at the beat's end, so every bar's health and its max move
    together.
  - Pinned on a Proving Walk of the first circle, with members of levels 40, 20 and 30 (reference damage 45, 25 and 35).
    The champion stood for the first two is 2800 (shares 1800 and 1000). Bled to 60%, the third is called back by a
    Memento and brings its 1400 at 60%: 4200, and the whole fight is said again at once. The second falls: 3200, still 60%.
    Seen as a witness for two seconds, nothing comes back. Recalled, it is 4200 again.
- **THE COLOSSAL'S SIZE ON THE WIRE** (section 14).
  - A lord is stood at the fight's law's `sizeX` (`net/eliteGates/egLords.js` `stand`), and so are its mirrors and images. Its body's
    radius is `bodyR` of its look's scale times the size, and its size rides its body (`sz`, thousandths of its look's; 0 at
    its look's own).
  - On the wire a body's row is eighteen, `[..., st, sa, sz]` (`net/eliteGates/egBodies.js` `egBodyWire`). `validEgOut` takes 0, or
    `EG_SIZE_WIRE_MIN` to `EG_SIZE_WIRE_MAX` (500 to 2000). Colossal's rank II, 1400, is the most the law folds, pinned under
    the bound.
  - The screen keeps a lord's size (`net/eliteGates/egLink.js` `egBodyOf`, 1 at its look's own) and draws it at its look's scale times
    it (`scenes/eliteGates/egFight.js` `egLookOf`, the one read in that file). Its reach to the lord (the target's radius from the
    look's scale) is the radius the relay judges by.
  - The first Court's Grath stands at 3.0 with no decree, 3.75 under Colossal (1250, radius 2.25) and 4.2 under Colossal II
    (1400, radius 2.52). The Slam's radius already followed `radiusX`.
- **THE GRAND DUKE'S DECREE FOLDS** (`net/eliteGates/egLords.js` `egMarkynazDecree`; sections 8.5 and 14).
  - The Markynaz lays the lord-family decree his hall draws: the four in their order (`EG_DECREES`, never a second list)
    from his hall's number, or the next his fight does not already bear, round the four, or none when it bears all four.
    One decree is never borne twice, and his card names one the company does not already face.
  - It folds with the circle's lord decrees through the fight's profile (`egFightProfile`), and he is stood under the fold,
    its health and its size with it. Before, his decree replaced the circle's, and his health was the circle's law's alone
    (he was born before his decree).
  - Seed 1's Hall 68, the Shade's Proving Walk, under Vengeful II: he lays Colossal, his hall's own, and his fight runs by
    both (shares x1.4, health x1.25, size x1.25). Under Colossal he lays Unyielding.
- **A SPOT'S HEIGHT, SAID** (section 9; `net/eliteGates/egLaw.js`'s `spot`). Decided: documented at the producer and in section 9, not
  mended under a new spec law. A spot's `y` stays the law's centimetres while its `x` and `z` are said in metres. The reasons:
  - Nothing reads the field. Every body's feet are the fight ground's (EG-ZJ), so no hall a player stands in changes.
  - A law of its own would be a third kept seven days beside laws 4 and 5 (section 22), every pin of the law's number would
    move, and parallel slices would contend for the next number. It would buy nothing.
  - It would not spare the first reader the centimetres either. Breaches opened under laws 4 and 5 are kept for their
    seven days, and their spots stay centimetres, so that reader handles both units whatever this slice did.
  - So the slice that first reads a spot's height mends it under its own law, in the same change. Until then a reader
    divides by 100, as `spot`'s comment and section 9 now say.

**Departures, said plainly.**
1. The shares move the lords' health alone. The legion's waves, the errands' objects and a Valkynaz's mirrors stay sized by
   the company the hall woke with (`F.team`, `F.n`).
2. In a Clan Feud the Markynaz stands after the Court's lord. His decree folds into the one fight's law from his birth, so
   every lord's blows, ward and threat bear it, while the Court's lord keeps the health and size it was stood with.
3. A share brought or restored moves the beat after its member is first seen in the hall: within 250 ms of its rising at
   the niche, not at the recall's own word. A fall's moves at once.
4. The last share in a lord is never retired. The gate keeps the fraction in `idle` for that case, but the Spire's lord
   would stand at nought and read as fallen; the company's wipe ends the breach first.
5. A spot's `y` stays in centimetres, said so at the producer and in section 9 (decided above).
6. The way-on rule is asked by the walkers, not inside `egWalkNext`, which a hand-walked test body calls with no walk.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED, nothing to wire: the fight draws its bodies in the pass the host already calls.
  Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED: untouched.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).
`scenes/eliteGates/egFight.js` is no host; its one line is the size's read.

**Not verified without a browser and the game's data:** a Colossal lord drawn larger, and a lord's bar as a share moves,
were checked through the wire, the screen's fold and `egLookOf` in node, not seen in the live game.

**Pins.**
- `test/net/eliteGates/egz_relay.test.js` (6): the way on, the pillar, the shares, the size on the wire, the Grand Duke's decree, a spot's
  height.
- `tools/mutants/egz_relay.json` (45, every one dead).
- Re-aimed by content (mutantdrift), and judged again:
  - `egz_lords.json`: EGZK-a-witness-joined and EGZK-joined-to-the-fallen onto the seam's join's answer;
    EGZK-the-graphs-walk-kept and EGZK-a-reached-node-forgotten onto `egWayOn`.
  - `egz_state.json`: EGZJ-row-height-unrounded, EGZJ-row-walk-end-height-dropped and EGZJ-row-state-unsaid onto the row
    of eighteen; EGZJ-wire-row-of-thirteen onto the validator's eighteen; EGZJ-link-lord-phase-dropped onto the lord's
    branch, which now reads its size; EGZJ-lord-top-reached-feet-left-on-the-stair onto `egWayOn`.
- Judged again: `eg5.json` (40), `egz_lords.json` (35: 33 dead, its 2 equivalent as recorded), `egz_state.json` (96
  then), `egz_legion.json` (56) and `egz_rules.json` (78) - every one as recorded. And every record of the lists aimed at the fight's
  modules this slice touched (`net/eliteGates/egBodies.js`, `egLords.js`, `egLegion.js`, `egWalkGraph.js`, `egLink.js`,
  `scenes/eliteGates/egFight.js`) or within ten lines of its changes in `net/eliteGates/egBrain.js`, `net/eliteGates/egLaw.js` and `net/wire.js`:
  `egint.json` (14), `egz_recap.json` (5), `egz_frag.json` (3), `egfull.json` (2), `eg6a.json` (1) and `egplay.json` (1) - 26,
  every one dead.
- PIN MOVED:
  - `test/net/eliteGates/egz_lords.test.js`: the director's joins, three;
  - `test/net/eliteGates/egz_state.test.js`: a body's row of eighteen, in eight assertions, two titles and a comment;
  - `test/net/eliteGates/egplay_relay.test.js`: a body's eighteen, cut short at seventeen;
  - `test/net/eliteGates/egz_stair.test.js`: its two hand-built rows.
- `RELAY_VERSION` `world198`, unshipped, rehashed in place; no file joined its graph. `ACCOUNT_VERSION` is untouched
  (`acct122`), and there is no migration. `EG_SPEC` is 5 and `EG_LAWS` are as they were.
- The 25-seed sweep (`tools/egSpanSolve.mjs --sweep --golden`, bands 0-3): every course crossed (95, 111, 108 and 109).
- No new src module. The Port-Ledger's ELITE-GATES row is the lead's.

### EG-ZR - 2026-10-12 - THE VESTIGES ON THEIR HOLDER

Mac: "I said I want everything". EG-ZP found two debts of section 15 and left them, said in its departures 1 and 9: Shield-Hymn
was applied by neither the census nor any screen, and of the Vestiges section 15 gives the holder's own client, Iron Footing
alone was applied on a screen, Immovable's push half not at all. Checked against section 15 and `net/eliteGates/egVestige.js` (every
`by: 'client'` row, and the `word` rows a receiver applies), the list is EG-ZP's twelve and one more: Featherstep, whose
crumbles waited Daggerfall's delay on every screen and whose cast-back the screen charged a tenth while the census charged
8, 6 or 4%. This slice applies all thirteen on their holder, Shield-Hymn on both halves and Immovable's push half. Both of
EG-ZP's sentences are deleted above.

**What shipped, by piece.**

- **THE HOLDER** (`systems/eliteGates/spireVestiges.js` `spireHolderStep`, new; `scenes/eliteGates/egClient.js` `holderNow`).
  - Every frame, the breach client hands its holder to the Vestiges' doors: my run's Vestiges and Mastery as the room says
    them (`egRunOfMember`), the breach and its hall. It does so only while I stand alive in the breach the room counts me
    in (in, alive, not gone home, the breach not ended, not a witness); otherwise the holder is null.
  - With no holder every door answers as if nothing were held. The client's `away` (online gone) and the first frame out
    of the Spire let go. So does a fall (a witness holds nothing) and the way home.
  - Each door is the one the port already has for its kind, registered once at the module's import (as
    `systems/loot/lootPowers.js` and `systems/sigil/sigilSetPowers.js` register theirs). Every number is `net/eliteGates/egVestige.js`'s.
- **STONESKIN** (+10 / 18 / 25% maximum health; `systems/renownLayer.js` `setSpireHp`, `spireHpOf`, `spireBodyMax`;
  `systems/chargen.js` `defineLiveMaxHealth`).
  - A third online term on the live maximum, beside Renown's: its rank's share of the body without it, in whole points
    (rounded). It goes on and comes off as Renown's layer does, the fraction kept: 500 of 1000 is 625 of 1250 at rank III,
    and 500 of 1000 again once let go. Only a live maximum carries it (every player's: chargen's and the load arm's).
  - THE CUSHION: every share the room takes of a body is a share of the body without Stoneskin, which is the census's whole.
    That covers a blow, a zone, a hazard and a drain (`scenes/eliteGates/egFight.js` `landShare`), and the void, the toll and the lash
    (`scenes/eliteGates/egClient.js`). A 0.4 blow takes 400 of a Stoneskin III holder's 1250, and the census counts 400 thousandths.
- **SECOND WIND** (once a hall, falling under 30% heals 15 / 25 / 35%; a hurt listener on the one damage door,
  `characters/playerEntity.js` `registerPlayerHurtListener`, the Ghost-King's Vigil's way).
  - A hurt that takes me from 30% of my maximum or over to under it heals its rank's share of the maximum
    (`systems/playerHeal.js` `healMine`), once in each hall of each breach.
  - Never on a hurt that leaves me at 30%, nor on one already under. Never on a killing blow a death save turned aside
    (the hurt's `saved`).
- **SPELLBANE** (every resistance +10 / 18 / 25; the resist channel's fold, `systems/entityMods.js`
  `registerEntityFold`). Every element the saving throw names (`systems/loot/lootRarity.js` `RESIST_ELEMENTS`) gets its rank,
  as the Battlemage's Bearing rides the same channel. The entity is folded again the frame the value moves, so the throw
  reads it at once and stops at once. A fire save of 55 is 80 at rank III.
- **BATTLEMAGE'S FOCUS** (spell cost -10 / 18 / 25%; `systems/spellcost.js` `registerSpellCostMod`). My cast's spell
  points less its share. The cost door rounds and never goes under 1, and another caster's price is untouched.
- **SHIELDWEAVER** (my Shield spell soaks +20 / 35 / 50%; `characters/playerEntity.js` `registerShieldSoakMod`,
  `damageShieldPool`).
  - A new named registry on the Shield pool: a point of a live Shield entry's pool soaks `k` of a blow. The pool spends
    dmg / k, and the excess that gets through is whole points. With no modifier, or every one answering 1, the pool is
    X1's exactly.
  - Shieldweaver answers 1 + its share for a Shield I cast on myself (`bundleSelfCast`). A party mate's gift (ALLY-CAST
    lands with no caster) soaks as Daggerfall's. At rank III a 120 blow on a 100 pool is soaked whole, 20 left, and the
    next 60 passes 30.
- **FLEETFOOT** (run speed +4 / 7 / 10%; `player/motor.js` `registerRunSpeedMod`, `runSpeedMult`). A new named registry of
  run modifiers beside the walk's swim scale, read every step. With none, the run is Daggerfall's exactly. Fleetfoot
  multiplies the run on foot; the walk and a horse's gallop are as they were. THE FAST BUILD's run (`net/eliteGates/egSpanLaw.js`
  `EG_FAST_RUN_MPS`) is now pinned to Fleetfoot III's own number.
- **FEATHERSTEP** (crumbles wait +0.2 / 0.35 / 0.5 s; cast-backs cost 8 / 6 / 4%).
  - A Crumble (or a Bone bridge) my foot sets waits Daggerfall's delay and the holder's seconds (`scenes/eliteGates/egSpan.js`, the
    step's `wait`, set from `spireCrumbleWait` as the foot lands). Its three crack stages spread across the wait, its
    chunks fall after it, and the fall, the return and the click home keep their own lengths after it.
  - The void's cost on my screen is the census's own law (`net/eliteGates/egBrain.js` `egCastBackCost`, imported), so a cast-back
    costs 8, 6 or 4% on the screen as in the count. It is said as it is (`ui/eliteGates/egBeats.js` `EG_PRES_TEXT.castBackCost`,
    `EG_BEATS.castBack` taking the cost): *-8%* at rank I, *-4%* at III, *-10%* unheld.
- **THE BLOW** (`systems/eliteGates/spireVestiges.js` `egHolderBlow`; `scenes/eliteGates/egFight.js` `hostHit`, `EG_ECHO_Q`). Every blow of mine
  on a Spire body leaves through `hostHit`: a swing, an arrow, a spell, as the dungeon host's `landOnHost` sends it. The
  Vestiges I hold are laid on the claim there, where the relay's bucket, grown by their declared factor
  (`egDeclaredX`), takes it.
  - SEARING EDGE: a melee blow +3 / 6 / 9.
  - MOMENTUM: +4% a stack on one body, to 3 / 4 / 5 stacks. A blow builds one stack, on the first body it meets, and a blow
    on another body starts again. A blow the wire refused builds none. A new hall starts again.
  - BLOODIED FURY: under half my health +10 / 18 / 25%.
  - OVERCHARGE: a spell +8 / 14 / 20%.
  - The fire is added first and the factors multiply it: (d + fire) x Momentum x Bloodied Fury x Overcharge.
  - ARCANE ECHO: a damage spell repeats at half on each body it met, 10 / 16 / 22% of casts. There is one roll a cast (the
    blow's sequence), and the repeat is a blow of its own on the relay, numbered `EG_ECHO_Q` past the cast's. A melee
    blow or an arrow never rolls.
- **MENDER'S GRACE, THE RECEIVER'S HALF** (heals you cast on allies +15 / 25 / 35%; `scenes/eliteGates/egClient.js` `menderGrace`,
  `egMenderOf`; `scenes/world.js` `onCast`).
  - Another's heal on me (ALLY-CAST) heals its caster's rank's share of the health it moved more. The caster's run is read
    by account (`accountOf`), as the room says it.
  - Never my own heal, a stranger's or an unnamed peer's, as a witness, or out of the Spire. The host hands every ally
    cast's heal to it before the heal is told, so the line, the chart's Healed column and the heal word carry the whole.
- **SHIELD-HYMN** (Bastion with Rally: "Rally's heal also gives the company 4 s of Bastion's protection"; `net/eliteGates/egVestige.js`
  `egHymnOf`; `net/eliteGates/egBrain.js` `egHymnStep`, `egCensusDr`; `scenes/eliteGates/egFight.js` `rally`, `egShieldBreach`'s and
  `egShieldDr`'s `hy`; `scenes/eliteGates/egClient.js` the word).
  - ONE LAW FOR THE PAIR (`egHymnOf`): the Bastion holders among the living company within `EG_ACCORD_M` (10 m) of another
    member who holds Rally. An Accord is two members', so one member holding both is no pair.
  - THE CENSUS'S HALF: as the door says Rally's heal (`door`), `egHymnStep` reads the pair off each living member's pose in
    this hall. Each pose now carries its hall, so a pose of the last hall pairs nobody. It mints `B.hy`:
    `[the door, the door + EG_HYMN_MS, the Bastion holders]`.
  - `egCensusDr` reads the window. Inside it, from the door to 4 s past it with both ends in, the hymn's Bastion holders
    stand by every other living member wherever it stands. They are one aura with any Bastion holder near, each holder
    counted once and stacked as Bastion is (the strongest, +2% each other), inside the census's 30%.
  - THE SCREEN'S HALF: Rally's word (`eheal`, `why: 'rally'`) opens the same window on my fight at the door's opening (the
    word's arrival less the half round trip), over the company where my screen draws it (`rally`). `egShieldDr` hands it
    to the census's own law. A 0.4 blow far from the hymn's Bastion III holder takes 352 on the screen and 352 off the
    count.
- **IMMOVABLE'S PUSH HALF** ("pushes do nothing until you move"; `scenes/eliteGates/egFight.js` `immovable`; `scenes/eliteGates/egClient.js`
  `footing`; `systems/eliteGates/spireKit.js` `spireFooting`).
  - The fight asks the census's own law of my trail with my Mastery alone (`egCensusDr`, whose Immovable is then its only
    answer): am I still a second on a fight floor?
  - While it holds, the share off a push is the whole of it, so a blow's push moves me not at all and the spans' Gust and
    Pendulum read the whole off. Moved, short of the second, off a fight floor, or without the Mastery, Iron Footing's
    share stands as before.
- **THE LAW'S NUMBERS** (`net/eliteGates/egVestige.js`, declared once): `EG_MOMENTUM_STEP` (0.04), `EG_SECOND_WIND_UNDER` (0.3),
  `EG_BLOODIED_UNDER` (0.5), `EG_ECHO_SHARE` (0.5), `EG_HYMN_MS` (4000), `EG_ACCORD_M` (10). Momentum's and Second Wind's
  lines read them.

**The four hosts.**

- `src/scenes/world.js` - WIRED: one statement in `onCast`, on the cast's own line (ALLY-CAST's source pin holds the
  cast and the healed points' line together): an ally cast's heal handed to Mender's Grace before it is told.
  Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED, nothing to wire: every door the Vestiges ride is one every host already shares:
  - the motor's run (`player/motor.js`);
  - the one damage door's hurt and Shield pool (`characters/playerEntity.js`);
  - the cast's price, the resist fold and the live maximum;
  - a blow on a Spire body, which reaches `hostHit` through the mode machine's gate-to-hall seams unchanged.
- `src/scenes/dungeonContext.js` - FLAGGED, unchanged: its `landOnHost` sends the game's own blow as before, and the spans
  it stands (`scenes/eliteGates/egSpan.js`) read Featherstep.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Departures, said plainly.**

1. **Stoneskin is a cushion.** The room's shares are of the body without it; the room's heals (a rest, Rally, a Mending)
   and a recall's share are of the whole maximum, the cushion with it. With shares of the whole, Stoneskin would buy
   nothing against a blow of the Spire's, every one of which is a share.
2. **The blow's Vestiges are laid at `hostHit`**, not on the formulas' blow and spell-power modifiers:
   - a fist is no weapon blow (`handToHandAttackDamage` reads no blow modifier);
   - a spell's power modifier runs a damage effect at a time and knows no blow, so it can count no stack and roll no
     echo;
   - every foe in the Spire is the relay's, and every blow on one leaves by `hostHit`.

   The number a blow pops on the screen (HN1) is the game's own blow, the Vestiges not in it; the relay counts the claim
   with them.
3. **Searing Edge's fire is whole on every body.** The relay keeps no element, and its stand-ins take fire whole. The page
   gives the Vestiges no order, so the fire is added first and the three factors multiply it.
4. **Momentum's stacks never lapse** inside a hall: the page names no window. An Echo's repeat builds none: it is the
   cast's own, not a blow I struck.
5. **An Echo is sent at once, as a blow of its own**, so it spends a hand of the relay's rate (`spendBlow`).
6. **Second Wind** reads and heals the screen's body (its live maximum, Stoneskin's points in it). The census hears the
   heal only as the member's own word of its body.
7. **Spellbane** rides the resist channel's five names. A throw that reads two of them reads it twice, as a worn affix's
   line would.
8. **Shieldweaver** makes a point soak more rather than the pool larger: the same soak. A Shield carried out of the breach
   soaks as Daggerfall's at once.
9. **Featherstep's wait** is read as the foot lands; a rank taken mid-shake changes the next crumble. The Sinking Stair is
   no crumble.
10. **Mender's Grace** is on the health that moved, so a heal stopped at the maximum gives nothing more. The room's heal
    bucket may refuse the excess the heal word carries; the screen believes it (EG-ZP's departure 4).
11. **Shield-Hymn's places are each side's own** (EG-ZP's departure 5): the census's pair is read on its poses at the door,
    the screen's where it draws the company as the word lands. A Bastion holder's own blows are never spared by its own
    Bastion, which shields allies. A door with no pair leaves the last window to lapse.
12. **Immovable's push half** is judged on the screen's trail, a sample a frame (EG-ZP's departure 5). The spans read it a
    frame late at most.

**Not verified without a browser and the game's data:** nothing was played. Each Vestige was driven through its own door
headless: `hurtPlayer`, `savingChance`, `calculateCastCost`, a `PlayerMotor` on a real collider, `createEgSpan` with a
counting renderer, `createEgFight` and `createEgClient` against a stub host. Every blow was counted by the director's own
census on the same inputs. Shield-Hymn's door was opened by the director's own beat (a fair crossing of a span).

**Pins.**

- `test/net/eliteGates/egz_vestiges.test.js` (12) and `test/net/eliteGates/egz_vestiges_hymn.test.js` (4).
- `tools/mutants/egz_vestiges.json` (100, every one dead; four survived the first run, and each now dies on a pin added for
  it: a refused blow's stack, the chunks' fall a wait later, a saved killing blow at 40%, and a Shield whose excess is
  fractional).
- Re-aimed by content (mutantdrift):
  - `renown1.json`'s RENOWN1-layer-in-the-stored-health and `auditrenown1.json`'s
    AUDIT-RENOWN1-limiter-caps-the-layer, on the live maximum's line;
  - `egz_debts.json`'s EGZP-share-unspared and -points-unspared, `egfull.json`'s EGFULL-the-lash-kills, `egz_rules.json`'s
    EGZI-client-toll-the-step and -the-last-taken, on the shares of the body without the cushion;
  - `egpres_hud.json`'s EGPRES-the-cost-shown-without-a-cost and -the-rewind-silent-without-a-cost, on the cast-back's
    cost;
  - `egz_ends.json`'s EGZM-wait-outlives-the-frame, on `away`;
  - `egz_tells.json`'s EGZL-crumble-stage-frozen, on the wait.
- Judged again: the 51 records of other lists aimed at or within two lines of a line this slice changed, every one dead
  (`allycast.json`, `audit27d.json`, `auditrenown1.json`, `disc10.json`, `egfrag.json`, `egfull.json`, `eglook.json`,
  `egplay.json`, `egpres_hud.json`, `egz_debts.json`, `egz_ends.json`, `egz_legion.json`, `egz_rules.json`, `egz_sound.json`,
  `egz_telegraph.json`, `egz_tells.json`, `giftquiet.json`, `renown1.json`, `steed1.json`). `steed1.json`'s
  STEED1-the-gallop-unscaled no longer parsed: it took out the line the run's modifiers now hang an `else` on. It is
  re-aimed by content to unapply the gallop's scale in place, and dies.
- No test pin moved. `RELAY_VERSION` `world198` is rehashed in place (unshipped): `net/eliteGates/egBrain.js` and `net/eliteGates/egVestige.js` moved,
  and nothing joined the bundle. `ACCOUNT_VERSION` stays `acct122`; no migration.
- `src/systems/eliteGates/spireVestiges.js` is a new module, so `06-Systems/Systems.md` counts 519. Its header cites Ledger A
  (ELITE-GATES), as the arc's files do, and the Port-Ledger's ELITE-GATES row names it.

### EG-ZS - 2026-10-12 - THE MASTERIES AND THE ACCORDS

Mac: "I said I want everything". EG-ZR left three lists of section 15 unbuilt, in its departure 14: the capstones' client halves
(Rooted's immunity to push, Spellweave's free fourth damage spell, Rallying Cry's Second Wind refreshed at a door), the relay's
Bladestorm and Deadeye, and five Accords (Hammer and Anvil, Ambush, Kindled Steel, Living Wall, War-Chorus). It left one open
issue for EG14 in its departure 2: the census counted a Stoneskin holder fallen at the plain body's worth. EG-ZQ left one
debt of section 8.5: the Markynaz's decree named on no card. This slice builds all of them, and the one line of section 15
nobody had built or flagged, the offer card naming its Accord. EG-ZR's departures 2 and 14 are deleted and the rest
renumbered 1 to 12; EG-ZQ's "Found, not changed" is deleted. Section 15's Stoneskin row and section 21's census say what the
census now counts.

**What shipped, by piece.**

- **THE LAW'S NUMBERS AND THE PAIR LAW** (`net/eliteGates/egVestige.js`, declared once beside EG-ZR's `egHymnOf`).
  - `EG_STORM_N` (5) and `EG_STORM_M` (3 m), Bladestorm's; `EG_WEAVE_N` (4), Spellweave's; `EG_FAR_M` (12 m), "beyond 12 m",
    which Long Sight now reads in place of its literal (`net/eliteGates/egRun.js` `egVestigeX`) and Deadeye reads with it;
    `EG_HAMMER_X` (0.08), `EG_AMBUSH_X` (0.15), `EG_WALL_X` (0.1), `EG_KINDLED_M` (2 m).
  - `EG_ECHO_Q` moved here from `scenes/eliteGates/egFight.js` (which says it as before): the relay knows an Echo by it now.
  - THE PAIR LAW, `egAccordMates(ms, me, key, as)`: the members within `EG_ACCORD_M` of `me`, never `me` itself, holding the
    other half of Accord `key` while `me` holds the side `as` names. The relay and the screen read every new Accord by it,
    each on the places it holds.
  - `egCardAccords(card, vs, co)`: the Accords a card would take - a Vestige not yet held, with each companion holding the
    other half.
- **ROOTED, THE CLIENT'S HALF** (Stone's capstone: "immune to push"; `scenes/eliteGates/egClient.js` `footing`). Resonating in Stone,
  the share off a push is the whole, as Immovable's is. A blow's push moves me not at all, and the spans' Gust and Pendulum
  read the whole off through `systems/eliteGates/spireKit.js` `spireFooting`. The doubled threat was already the relay's
  (`net/eliteGates/egRun.js` `egThreatX`).
- **SPELLWEAVE, THE CLIENT'S HALF** (Arcana's: "every fourth damage spell costs nothing"; `systems/eliteGates/spireVestiges.js`
  `weaveFree`, `weaveCast`; `systems/spellcost.js` `registerSpellFreeCast`).
  - A new named door on the cast's one price: asked after the cost modifiers, under their law (a player's own cast, never a
    foe's), one that answers true prices the cast at nothing. It is the one cost under the modifiers' floor of 1.
  - While I resonate in Arcana, each damage spell of mine (a Damage Health effect or its continuous twin -
    `systems/spellcast.js` `isDamageHealthEffect`) that leaves the hands is counted, as the one cast engine tells it
    (`systems/playerCasts.js` `tellPlayerCast`). The count runs over the breach and starts again in another.
  - The fourth, the eighth, the twelfth are priced at nothing. The ready captures that price (`scenes/hostMagic.js`
    `readySpell`), so the spend is nothing and the book shows 0. A spell that is no damage spell is neither counted nor free.
- **RALLYING CRY, THE CLIENT'S HALF** (Fellowship's: "Rally's heal and every Second Wind in the company refresh when a
  hall's door opens"; `scenes/eliteGates/egClient.js` `holderNow`; `systems/eliteGates/spireVestiges.js` `spireHolderStep`).
  - The holder now comes with the hall's door's instant (the room's `dn`, said by its stage word) and `cry`: whether a living
    member of the company resonates in Fellowship.
  - With both, a Second Wind spent in this hall is mine again from the door, once a door. It applies to every Second Wind
    holder in the company, the Cry's holder's own among them.
  - Rally's heal already comes at every door (`net/eliteGates/egBrain.js` `door`), so the capstone's Rally half needs nothing more.
- **BLADESTORM AND DEADEYE, THE RELAY'S HALVES** (`net/eliteGates/egBrain.js` `hostHits`, `hostStrike`, `egBehind`; called by `egBlow`
  after every landed blow).
  - BLADESTORM ("every fifth melee blow strikes every foe within 3 m (relay host hits)"): every `EG_STORM_N`-th landed melee
    blow of a member resonating in Blade (`mm.storm`, counted over the breach) strikes every other foe within `EG_STORM_M`
    of where the member struck from. Each takes the points the blow landed on its target.
  - DEADEYE ("an arrow from beyond 12 m pierces the add behind its target"): a landed arrow of a member resonating in Hunt,
    from beyond `EG_FAR_M` of its target, strikes the first add the line from the striker through the target meets past it,
    one whose centre lies within its own radius of the line (`egBehind`). It takes the points the arrow landed.
  - A HOST HIT is the room's own stroke. An add takes it as Sweeping Arc's splash does, its fall the striker's.
  - A lord takes it through THE BOSS SEAM's one `hit` (`net/eliteGates/egLords.js` `EG_SEAM`), as every blow on a lord goes
    (section 13.1). It rides the blow's own token (its number) and comes out of the member's purse. The lord's own weight
    applies (a ward, a flyer out of a blade's reach, Unyielding's x0.85), and what lands is told to it: its threat by
    `egThreatX`, its kit, its fall.
  - A friend, a ward, a hidden body and an errand's object take none.
- **THE ACCORDS ON THE RELAY** (every one the relay's, inside the caps).
  - HAMMER AND ANVIL (Challenger's Oath + Hunter's Mark; `net/eliteGates/egRun.js` `egVestigeX`). A mark now keeps who laid it
    (`egMarkFoe`'s `by`, named by `egBlow`). A foe marked by a mate holding Hunter's Mark, the pair standing together, takes
    `EG_HAMMER_X` more from the oath's holder, on top of the mark's own share. The mark's holder's own blows take the mark
    alone.
  - AMBUSH (Fade + Spire's Standard; `egFadeOn`, `egVestigeX`, `egBlow`). A Fade begun arms it (`m.amb`), and the holder's
    next landed blow spends it. That blow, within `EG_ACCORD_M` of a mate holding the Standard, takes `EG_AMBUSH_X` more over
    the Standard's own aura.
  - KINDLED STEEL (Searing Edge + Overcharge; `hostHits`). A landed melee blow of a Searing Edge holder standing with a mate
    holding Overcharge splashes the Edge's fire - its points, 3 / 6 / 9 - on every other foe within `EG_KINDLED_M` of the
    target, as host hits.
  - WAR-CHORUS (Arcane Echo + Spire's Standard; `net/eliteGates/egRun.js` `egEchoShare`, `egCompanyAt`).
    - The screen now claims an Echo at its cast's whole (`scenes/eliteGates/egFight.js` `hostHit`).
    - The room takes the Echo's share: `EG_ECHO_SHARE`, or the whole while its holder stands within `EG_ACCORD_M` of a mate
      holding the Standard. It is never a factor above 1, so it stays inside the caps, and a client that claims an Echo
      whole gains nothing the room does not see.
    - The room knows an Echo by its number: from `EG_ECHO_Q` to twice it, where no cast is numbered, as the wire's `q` holds.
    - The share is the claim's, the Binder's raise included (`egBlow`'s `dm`).
- **LIVING WALL, BOTH HALVES** (Stoneskin + Mender's Grace: "heals on the Stoneskin holder +10%").
  - THE CENSUS'S HALF (`net/eliteGates/egBrain.js` `egWallOf`, `egCountHeals`): a room's heal (Rally, a Mending, a niche, the
    Scriptorium, a rest's part) on a Stoneskin holder standing within `EG_ACCORD_M` of a mate holding Mender's Grace is
    counted at `EG_WALL_X` more, read on the places the director holds of this hall.
  - THE SCREEN'S HALF (`scenes/eliteGates/egClient.js` `applyHeal`, `menderGrace`, `wall`; `scenes/eliteGates/egFight.js` `accordMates`): the same
    heal on the holder's screen, read on the places it draws the company. A companion's heal spell on the holder heals the
    Accord's share of the whole more, Mender's Grace in it ((1 + grace) x 1.1). The heal word carries it to the census as it
    carries Mender's Grace. Shield-Hymn's `rally` and the new `accordMates` read the company through one helper
    (`companyHere`).
- **STONESKIN IN THE CENSUS'S COUNT** (EG-ZR's open issue for EG14; `net/eliteGates/egBrain.js` `egCountWhole`).
  - A holder's count is a share of its WHOLE body, the cushion in it: 1 and its rank's share, 1.25 at III. That is what its
    screen's maximum, its own word (`vt`), the room's heals and a recall already were.
  - Every share the room takes is of the body without the cushion, and now comes off the count over the whole. That covers
    a blow, a hazard, a drain, the void (its floor a quarter of the plain body, as the screen's), the toll and the lash. An
    ally's believed heal is counted over the whole too (`egHeal`).
  - So under enforcement - on in `eg:` rooms (`EG_BODY_ENFORCE`) - a Stoneskin III holder stands three 0.4 blows and falls at
    the fourth, as its 1250 do. A plain body and Stoneskin I fall at the third. Its own word of its body, as its screen says
    it, claims no mend.
  - Enforcement is unchanged. The census's thousandths (`cs`) stay the plain body's.
- **THE MARKYNAZ'S DECREE ON HIS CARD** (section 8.5; `ui/eliteGates/egSpireHud.js` `egMarkynazLine`, `egArrivalLive`;
  `ui/eliteGates/egBeats.js` `EG_PRES_TEXT.champDecree`).
  - In a hall the law stands him in (a Proving Walk, a Deepway's champion's chamber - the spec's `champ`), the arrival card
    names the decree he lays: *The Grand Duke's Decree: Colossal*.
  - The screen reckons it with the relay's own pure `egMarkynazDecree`, from the decrees the room says in force (`st`'s `dc`,
    the ranks the fight takes at its wake) and the hall. No new word.
  - The card draws it on a line of its own, hidden when empty. The screen reader's line says it with the card's words
    (`scenes/eliteGates/egClient.js`).
- **THE OFFER'S CARD NAMES ITS ACCORD** (section 15: "*Takes an Accord with Mira's Hunter's Mark.*"; `ui/eliteGates/egHud.js`
  `egPanelModel`, `drawEgPanel`; `EG_PRES_TEXT.takesAccord`). A card whose Vestige I do not hold, with a living companion
  holding the other half, says so under its line in the Vestiges' blue: each companion, each Accord.

**The four hosts.**

- `src/scenes/world.js` - FLAGGED, nothing to wire. Every door the new halves ride is one the hosts already share:
  - the breach client's footing, holder and heals (`scenes/eliteGates/egClient.js`);
  - the cast's one price (`systems/spellcost.js` - every host's `castCost` reads `calculateCastCost`);
  - the one cast engine's word (`scenes/hostMagic.js` `tellPlayerCast`).

  Nothing was added to `function frame(now)`.
- `src/scenes/worldModes.js` - FLAGGED, untouched: its interiors take world.js's cast engine and price.
- `src/scenes/dungeonContext.js` - FLAGGED, untouched: its `landOnHost` sends the game's own blow, and the relay strikes the
  host hits.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach (section 28).

**Departures, said plainly.**

1. **Bladestorm's 3 m is measured from where its holder struck.** Section 15 says "within 3 m", where Sweeping Arc says "of
   the target". Its count is of landed melee blows over the breach, and it never lapses. Each foe takes what the blow landed
   on its target, the target's own weight in it.
2. **Deadeye reads an arrow alone**, as section 15 says (section 21 groups it with spells). Past the target, the line has no
   end.
3. **Kindled Steel's fire is the Edge's points whole**, never scaled by the blow's factors. The relay keeps no element.
4. **A host hit on an add spends no hand and no purse**, as Sweeping Arc's splash does. One on a lord goes through the
   seam, the one plug every blow on a lord takes (EG-ZK), so it rides the blow's token and draws on the member's purse.
   AUDIT EG IV (lane1 #25): what either lands is its member's, as a blow's is - the hall's and the circle's damage and the
   recap's and a Court's chart.
5. **An Echo's share is the relay's now.** The screen claims the cast's whole. The bucket grows by Arcane Echo's own declared
   factor, not by War-Chorus's doubled expectation.
6. **Hammer and Anvil reads any mark its mate laid**, its Hunter's Mark or its Spotter's: "a foe the mark's holder marked".
7. **Ambush has no window**: the first blow after a Fade is the next one that lands, whenever it lands.
8. **Living Wall's heals are the ones another gives the holder**: the room's and a companion's spell. The holder's own potion,
   spell or Second Wind is not one. It multiplies Mender's Grace. Each side reads its own places, as Shield-Hymn does
   (EG-ZR's departure 11).
9. **Spellweave counts every damage spell that leaves my hands while I resonate**, an item's free cast among them. A spell
   readied at nothing stays priced so until it leaves the hands.
10. **The Markynaz's card is reckoned at its minting.** A Dagon's Bargain passed in his own hall, after he laid his decree,
    is in the `dc` a reload mid-trial reckons from. The Markynaz that Kyn's Vigil or a Clan Feud brings is named on no card:
    the page names the Proving Walk's.
11. **An ally's heal is counted over the gate's reference body** (INT11's law), not the holder's own, and now over the
    whole.

**Not verified without a browser and the game's data:** nothing was played.
- Every relay half was driven through `egBlow` and `egCount` in the director's own Court, the company stood by its beat.
- Every screen half went through `createEgClient` and `createEgFight` against a stub host: footing, the holder, `applyHeal`,
  `menderGrace` and the arrival card's DOM.
- Spellweave went through `calculateCastCost` and `tellPlayerCast`, not a live cast.

**Pins.**

- `test/net/eliteGates/egz_mastery.test.js` (9) and `test/net/eliteGates/egz_mastery_accords.test.js` (6).
- `tools/mutants/egz_mastery.json` (105: 104 dead, and 1 equivalent as recorded - an errand's object let in among
  Bladestorm's foes, which the boss seam's `hit` refuses as no lord). Two survived the first run, and each now dies on a pin
  added for it: a member holding neither half of an Accord, and a Cry rising mid-hall with no door.
- Re-aimed by content (mutantdrift), each dying on its own tests again:
  - `egint.json`'s EGINT-a-heal-ignored and EGINT-the-cast-back-uncapped, `egz_recap.json`'s EGZ-brain-the-count-unmended
    and `egz_rules.json`'s EGZI-brain-census-toll-unread and -the-last, onto the count's whole;
  - `egz_vestiges.json`'s EGZR-footing-immovable-unread and -share onto Rooted's footing;
  - EGZR-mender-share onto Living Wall's share;
  - EGZR-echo-full onto the screen's whole claim (the screen halving it);
  - EGZR-echo-q onto `net/eliteGates/egVestige.js`.
- Judged again, every one as recorded:
  - `egz_vestiges.json` (100), `egz_debts.json` (49), `egz_rules.json` (78) and `egz_relay.json` (45), every one dead;
  - `egz_lords.json` (35: 33 dead, its 2 equivalent as recorded);
  - the 29 records of other lists aimed within ten lines of a line this slice changed, every one dead (`egeco.json`,
    `egfull.json`, `egint.json`, `egplay.json`, `egpres_hud.json`, `egz_legion.json`, `egz_recap.json`, `egz_return.json`,
    `egz_sound.json`, `egz_telegraph.json`, `fieldbugs1012c.json`, `loot15.json`, `set2.json`).
- PIN MOVED:
  - `test/net/eliteGates/egz_vestiges.test.js`: the Echo's claim - 117 and 108 where 59 and 54 were - and its title;
  - `test/net/eliteGates/egz_lords.test.js`: the director calls the seam's `hit` twice - a member's blow, and a host hit on a lord.
- `RELAY_VERSION` `world198`, unshipped, is rehashed in place: `net/eliteGates/egBrain.js`, `net/eliteGates/egRun.js` and `net/eliteGates/egVestige.js`
  moved, and no file joined the bundle. `ACCOUNT_VERSION` stays `acct122`, with no migration. `EG_SPEC` and `EG_LAWS` are as
  they were.
- The 25-seed sweep is not run: no course, span law or hall spec moved.
- No new src module; the Port-Ledger's ELITE-GATES row is unchanged.

### EG-HERO (the Soul Cairn) - 2026-10-13 - THE OSSUARY AND THE MIST STAIR

The owner, 2026-10-13: *"You have to author the fragments"*. The hero fragments section 11.6 left to Mac in Blender are the
port's to author, in code. This record is the Soul Cairn's two (section 11.2's row is each one's brief). Each is a scene written
from numbers by a script, as `tools/egRefFragScene.mjs` writes the reference: no game data, no third-party art, no
trigonometry, IEEE arithmetic alone. Each is written as the `.fbx` that `tools/fragBake.mjs` bakes, baked by its own bake
script, registered beside the reference, and held to its bytes and its laws by `test/tooling/eghero_cairn.test.js`. Laying them into
the halls is another slice's (spec law 7). This one makes them layable.

**THE OSSUARY** (`egheroOssuary`; kit `ossuary`, class passage, variant `ossuary`; Stoneroom, its engine the soul-bell).

- **What it is.** "The vaults of the dead: ribcage bridges, skull pillars, soul-gem niches where Binders stand." A nave of
  slate under a segmental barrel vault, springing at 5.9 m with its crown at 7.94 m and ribbed in bone over each pair of
  skull pillars. The pillars are octagonal piers girt with two bulging courses of skulls. Between them are burial bays with
  skulls on their sills and shelves:
  - four bays hold soul-gems in halos of soul-light, a Binder's place before each (`anchor.caster`);
  - one holds the soul-bell, hung from a bone yoke (`anchor.engine`);
  - one holds the sealed loculus (the alcove);
  - one holds the Battlemage's bier (`anchor.niche`).

  Over the chasm the vault is broken open to the sky. Out of the chasm's walls the ribcage of something vast arches over the
  bridges to a bone sternum, and the bone bridges are its spine. Soul-light pools 9 m down. The whole is a block of slate
  hung in the void. It has buttresses behind its piers and a recessed face at each end with a bone portal standing proud of
  it. Its root hangs below.
- **Its envelope** is `net/eliteGates/egFragLaw.js` `egFragPassage('ossuary')`'s, so a hall can lay it where it lays the code-built one:
  - 6 m across and 28 m long;
  - the mouth and its one exit are each 6 m by the kit's 5.6 m, at the floor's height (yB 0);
  - its fight floors are Y 0..9 and 19..28 (zA, zB), each wholly under a 5.6 m ceiling;
  - three bone bridges cross the chasm: 2.6 m across, 2.4 m deep and 70 cm apart. Each is crossed inside the Crumble's
    0.7 s (0.59 s at the span build);
  - its two soul-wisps are on the kit's own clocks, 9 s and 11 s, each a figure of eight over a fight floor;
  - its box is 12.7 m by 24.9 m by 28 m.
- **Its art.** 9,830 triangles in seven draws: floor, brass (bone), root, cobble, edge, molten (soul-light) and pillar. The
  collider is a 20-triangle proxy: the floors, the walls' plane, the chasm's faces, and the vault as two planes over each
  floor.
- **Its law.**
  - Two fight floors, two ceilings at 5.6 m, and four open edges: the mouth, both lips and the exit.
  - A walk graph of ten nodes and eight edges, a spine and a cross on each floor, none over the chasm.
  - Anchors: four casters, two lurkers, the niche, the engine, and the wisps' two hazard anchors.
  - One alcove, a seam holding a page of the Annals. Three band lights: one over each floor and one in the chasm.
  - Its proof: crossFast 1,701 ms, crossSlow 1,701 ms, 4 moves.
- **Its files:**
  - `tools/egHeroOssuaryScene.mjs` and `tools/bakeEgHeroOssuary.mjs`;
  - `src/assets/egfrags/source/egheroOssuary.fbx`;
  - `src/assets/egfrags/egheroOssuary.law.json` and `.mesh.json`.

**THE MIST STAIR** (`egheroMistStair`; kit `mist`, class shaft, variant `mist-stair`; Cave, no engine).

- **What it is.** "Stairs wound down a pit of mist." From a vaulted threshold the shaft opens into an oval pit, 13 m across
  at its widest:
  - its walls are lined in slate ashlar down to the mist's line, and below it raw rock falls to a pool of soul-light 14 m
    under the rim;
  - the four flights stand on stone piers that rise out of the deep, each strutted to its wall and banded in bone at its
    neck;
  - round the walls wind the stubs of an older stair, down the west wall from the rim and back along the east wall into the
    mist;
  - a ring of soul-crystals marks the mist's own line;
  - at the foot, a low tunnel leads on to the exit.

  The whole is a crag of slate whose sides bow with the pit, mapped as an island's underside from its rim to its keel. It has
  a bone portal at each end in a recessed face.
- **Its envelope** is `egFragShaft('mist')`'s:
  - 8 m across (its halfW 400);
  - its rim is `EG_SHAFT_RIM_CM` (3 m) deep under `EG_SHAFT_HEIGHT_CM` (6.5 m), and the mouth is 8 m by 6.5 m;
  - four flights (the kit lays three or four), each `EG_SHAFT_FLIGHT_CM` 0.9 m under the last and 2.6 m after it (inside
    the kit's 2.4-2.8 m). The ledges are 2.4 m by 2 m and swing 1.5 m to each side of the line;
  - a Drop of 4 m (inside `EG_SHAFT_DROP_CM`'s 3-4.5 m) onto its 6 m landing;
  - the foot is `EG_SHAFT_FOOT_CM` (3 m) at the landing's height, 7.6 m down;
  - the exit is 8 m by 4.6 m, in a tunnel whose ceiling stands 4.6 m over the foot. That is the fast build's 4.5 m over the
    landing, which the foot's ceiling touches;
  - the mist's line is 3 m under the foot, the kit's own;
  - its floors are traversal ground, because a shaft's blows land on none of it;
  - its box is 17 m by 30.3 m by 33 m.
- **Its art.** 5,542 triangles in the same seven draws. The collider is an 18-triangle proxy: the rim, the foot, the
  shaft's walls' plane, the pit's ends and both ceilings. The pit is open to the sky, so no proxy roofs it.
- **Its law.**
  - Two floors, two ceilings (6.5 m over the rim, 4.6 m over the foot), and four open edges: the mouth, the pit's lip, the
    foot's edge onto the landing and the exit.
  - A walk graph of six nodes and four edges, on the rim and on the foot, never down the pit.
  - One hazard anchor at the pit's deep.
  - The mist (`hazard.mist`, its phase 6 s).
  - One alcove, a seam holding lumen in the rim's east wall. Four band lights: the rim, the pit, the foot and the deep.
  - Its proof: crossFast 4,937 ms, crossSlow 4,937 ms, 6 moves, well inside `EG_SHAFT_MAX_S`.
- **Its files:**
  - `tools/egHeroMistStairScene.mjs` and `tools/bakeEgHeroMistStair.mjs`;
  - `src/assets/egfrags/source/egheroMistStair.fbx`;
  - `src/assets/egfrags/egheroMistStair.law.json` and `.mesh.json`.

**Shared by both.**

- `tools/egHeroKit.mjs` gains the Cairn's shared pieces, one block at its end: `mirrorX`/`onSide` (a west twin wound back),
  `boxOn`, `faceTo` (a face wound to a wanted side), `octahedron`, `cuts` (the rows surfaces that meet are cut at, so their
  edges meet vertex to vertex) and `walkStrip`.
- The registries:
  - `net/eliteGates/egHeroFrags.js` `EG_HERO_FRAGS` and `world/eliteGates/egHeroFragModel.js` `EG_HERO_FRAG_MESHES` register both;
  - `egHeroFragLaws('ossuary')` and `egHeroFragLaws('mist')` now answer each kit's hero;
  - `test/tooling/doctrine.test.js`'s allow-list names the six asset files.
- **THE EDGE LINE** runs on every walkable rim: every open edge of every floor carries the edge record's strip, 15 cm wide,
  1 cm over its floor. The inner pieces are the span's own, edged by its own set (`scenes/eliteGates/egSpan.js`).
- Every wall pushes outward from the envelope, never inward and never onto a floor.

**Departures, said plainly.**

1. **Written in code, not modelled in Blender.** The cost is the kit's shapes and nothing past them. There is no sculpted
   detail: a skull is an eight-sided lump of two rings, the skull courses are bulges on an octagonal lathe, rock is fbm
   pushed outward, and no face is hand-shaped. The Ossuary's broken edge is noise on a cut, not a fracture someone drew.
2. **No drawn vertex inside the proxy** is read, in the test, as no drawn vertex inside the walk the proxy bounds:
   - walled on both sides, floored below and roofed above by a proxy face;
   - nothing drawn in a floor's prism up to its ceiling, on an inner piece's 4.5 m flight, or over a gap between pieces.

   A chasm or a pit is floored by no proxy face, so it bounds no walk. The Ossuary's ribcage stands there, clear of the
   bridges' flight (no rib nearer than 1.88 m to the line under 4.5 m).
3. **The Ossuary's vault springs at 5.9 m, over the kit's 5.6 m.** The ceiling clamp keeps 5.6 m, so the bone ribs under
   the barrel stay over the floor's prism. The drawn headroom is 5.73 m over the floors and 6.2 m over the bridges, measured
   on the drawn mesh.
4. **UVs run as the reference's do** (v up, a tile every 2 m on stone; the band's painted rows meet v 0 at a face's foot),
   except on rock that falls into the void. There the root's picture runs from its lip, at v 0 under the floor's level or
   the mist's line, to its tip. The Hour's undersides lay it the same way. The preview tool's `1 - v` shows those faces
   upside down.
5. **The registry pin moved.** `test/net/eliteGates/eg6c_law.test.js` held `Object.keys(EG_HERO_FRAGS)` to the reference alone. It now
   holds the reference first, and each band's test pins its own heroes.
6. **The proxy is authored, not derived** (EG6c departure 9). Neither fragment is laid by any hall yet.

**The four hosts.** `scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js`: none is
touched. No hall lays a hero fragment until the laying slice does, so no host draws one.

**Pins.**

- `test/tooling/eghero_cairn.test.js` (9):
  - bytes and re-bakes; read and registered;
  - each envelope against the code-built planner;
  - THE TIMED SOLVER's proof and THE ENVELOPE's gaps and steps;
  - the budget;
  - the edge line on every rim, and gold on nothing else;
  - no drawn vertex inside the proxy or the walk, and the drawn headroom;
  - the kit's shared pieces.
- `tools/mutants/eghero_cairn.json` (25, every one dead). Among them: a rib swung into the bridges' flight, a pillar stood
  in the nave, the vault let down, a lip left unlined, a bridge too deep for the Crumble, a fifth light, a flight past the
  step down, a gap stretched, a pier wider than its flight, the foot's tunnel let down. Also the specs' variant and class,
  each registry left without its fragment, the kit's pieces, and the code-built kit's own numbers (`EG_SHAFT_FLIGHT_CM`,
  the Ossuary's height and piece, the mist's line).
- `RELAY_VERSION` stays the arc's (`world200` since the merge of main past AUDIT ETHER-OW, `world201` past PEER-ACTS, `world203` past CHAT-TRADE and FIVE-ASKS, `world205` past KG-SET and KG5, `world206` past PVP-LOOT + QUEST-HOME). At
  this slice no relay byte moved, because `net/eliteGates/egHeroFrags.js` was then in no relay import graph. Since EG-HERO-LAY every
  hero's law JSON is in the relay's graph (that record's "The relay's bytes"). `ACCOUNT_VERSION` stays the arc's
  (`acct133`; `acct134` since the merge past LAMP-KEEPER II, `acct135` past KG6, `acct136` past POI-1, `acct137` past SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME).
- The Port-Ledger's ELITE-GATES row names the new files.

### EG-HERO (the Shade Perilous) - 2026-10-13 - THE GLOAM THICKET AND THE ECLIPSE VAULT

The owner, 2026-10-13: *"You have to author the fragments"*. The hero fragments section 11.6 left to Mac's Blender are the
port's to author, in code. This record is the Shade Perilous's two: the Gloam Thicket's passage and the Eclipse Vault's
chamber. Each is a scene written from numbers by a script, exactly as `tools/egRefFragScene.mjs` writes the reference. Each
is written as Blender's exporter writes one, baked by `tools/fragBake.mjs` as one of Mac's would be, registered beside the
reference, and held to its bytes. Laying them into the halls (spec law 7) is another record's; the four authoring records
and that one are merged by the coordinator.

**What shipped, by piece.**

- **THE GLOAM THICKET** (`egheroGloam`: kit `gloam`, class `passage`, variant `gloam`, no play). *"A wood of black glass,
  its branches the platforms, moonbeams the only light."*
  - **Its envelope** is the kit's code-built passage (`net/eliteGates/egFragLaw.js` `egFragPassage('gloam')`):
    - a mouth 7 m wide and 6.5 m high on the course's line (`halfW` 350, `height` 650), 28 m long (`len` 2800);
    - one exit at its far end, at the floor's height (`yB` 0);
    - open to the moon, as the kit's Thicket is (no vault - its `ceil` is null);
    - its chasm crossed on Moon branches alone (`EG_FRAG_PIECES.gloam`), the beams' origin at the chasm's near lip (the
      kit's `beat`, its `zA`).
    - Its box is [-658, -940, -5, 687, 1312, 2800] cm: no wider than 14 m, so a Low Road's passage 15 m off the High Road
      keeps its 2 m.
  - **Its art** is 10,354 triangles in 7 draws, in the Shade's dress (`world/eliteGates/egBandArt.js` `EG_DRESS`):
    - two landings in glades of the thicket, widening from the mouth's 7 m to 9.2 m. Their floors are black-glass flags
      (floor), their torn undersides hang into the dark (root, its lip at v 0 as `world/superDungeon/sdRealm.js` maps the Hour's);
    - the thicket's walls on both sides, a mass of black-glass shards (cobble). They are pushed OUTWARD by noise from the
      floors' outlines, never inward and never onto a floor, down past the chasm into the deep and up to 7.4-9.8 m, and
      broken once for the alcove's hollow;
    - seventeen black-glass trunks (floor's flags stretched along them into bark, its hairlines their grain). The
      landings' trunks stand behind their outlines with roots hanging under the landings; the chasm's stand in the mere,
      clear of the course;
    - each trunk forks at its crown into limbs. One arches in over the passage (a vault of boughs at 9-12 m, its middle
      left open to the moon), one rises, and the landings' trunks reach one out over the thicket. Moon-glass leaves (silver
      shards, brass) hang at the limbs' tips, and the mouth's and the exit's trunks are bound in moon-silver;
    - four boughs reach from the chasm's trunks up into the outer third of each Moon branch, under its top. The branch
      itself is the scenes' to stand (`net/eliteGates/egSpanLaw.js` `moon`, the gold rim the lit one's);
    - a mere of quicksilver 9.2 m down in the chasm (molten, under its luminance law, `egMoltenGlow`);
    - the Moon-Mirror (the kit's engine, `EG_ENGINES.mirror`) on its pedestal against the near landing's east wall;
    - THE EDGE LINE (edge) on the mouth, both lips and the exit - the landings' only open edges.
  - **Its law** is two fight floors (the landings, 5.5 m and 5 m deep). Their mouth, lips and exit are opened. Beyond
    them:
    - four Moon branches alternate sides (`ph` 2000, `beat` 550), proven by THE TIMED SOLVER: crossed in 3,681 ms at
      best and 5,081 ms at the median, in 5 moves. Each branch is solid 2.8 s of every 4;
    - a walk graph of eight nodes and ten edges, none across the chasm;
    - two Lurkers, a Caster, the Battlemage's niche, and the Moon-Mirror's engine at its pedestal;
    - a seam alcove (a hollow between two trunks) holding a Vestige shard, and three moonlights - moonbeams the only light;
    - no hazard, because its signature is its course;
    - a 154-triangle collider proxy: the landings, the walls along their outlines and beside the chasm, the lips, and a
      box about each trunk standing inside the walls.
  - **Its files**: `tools/egHeroGloamScene.mjs` (the scene, and the shapes the Shade's two share - `sheet`, `tube`,
    `strip`, `moonMirror`), `tools/bakeEgHeroGloam.mjs`, `src/assets/egfrags/source/egheroGloam.fbx`,
    `src/assets/egfrags/egheroGloam.law.json`, `src/assets/egfrags/egheroGloam.mesh.json`.
- **THE ECLIPSE VAULT** (`egheroEclipse`: kit `eclipse`, class `chamber`, variant `eclipse`, play `balcony` and `engine`).
  *"A dark hall crossed by moving shafts of moonlight."*
  - **Its envelope** is the kit's code-built chamber as the Deepway lays it: `net/eliteGates/egLaw.js` calls
    `egFragChamber('eclipse', r, R)` with `R = 1600`.
    - Its fight floor is the court's disc of 16 m, its middle 20 m in - where the hall's `court` puts it, `edge + 400 + R`.
    - The mouth is at the slot's start and the exit 4 m past the floor's far rim, 40 m apart. Both are 6 m wide and 7 m
      high, on the course's line and the floor's height.
    - THE ECLIPSE stands on that floor in the kit's ring (`EG_ECLIPSE_RING_M`).
    - Its play is the balcony's second fight floor on two stairs where Casters stand, and the Moon-Mirror
      (`EG_PLAYS`, `EG_ENGINES.mirror`).
    - Its box is [-2090, -910, -5, 2090, 2025, 4005] cm.
  - **Its art** is 7,060 triangles in 7 draws:
    - a round hall of black-glass ashlar (pillar), its walls on the floors' outlines and worn outward a little by noise.
      Their outer face is solid from without at 18.1 m;
    - engaged columns at the rim's odd corners and the gatehouses' jambs, black glass fluted, their capitals moon-silver;
    - a dome (root) whose ring is OPEN: the moon-slot, an annulus from 7 to 11.2 m out, straight over the ring the
      moon-shafts walk, its lips moon-silver and moon-glass shards hung under them. The light the Eclipse spares falls
      from where the eye sees the moon;
    - twelve ribs spring from the walls and fly across the slot to the dome's cap. Under the cap hangs THE ECLIPSE itself:
      a black disc in a silver corona on three chains;
    - the fight floor in court plates (arena), a silver ring inlaid where the moon-shafts walk, the eclipse's emblem at
      its middle;
    - two gatehouses with pointed arches, the mouth's and the exit's;
    - two galleries in bays behind the rim, east and west, 3.5 m up. Each is reached by a stair of fourteen steps rising
      along the wall, the galleries' fronts and the stairs' stringers banded in silver so they read from the floor;
    - the Moon-Mirror in a recess of the north-east wall, the alcove's recess in the south-west, and the hall's torn
      underside hanging into the void (root).
  - **Its law** is three fight floors and two traversal ones:
    - the court's disc, its 24 corners on the 16 m circle except where the gatehouses' and the stairs' chords cut it,
      and the two galleries (350 cm);
    - the two thresholds under the gatehouses, traversal as the code-built court's bridge is, and two stairs (ramps, 0 to
      350 cm);
    - the vault's ceiling at 10 m and the gatehouses' at 7 m - a chamber's 6 m over every floor (THE CEILING CLAMP), and
      the galleries' 6.5 m;
    - fourteen open edges: the mouth and the exit, the galleries' fronts and stair-heads, the stairs' feet, and the
      thresholds running on into the disc;
    - THE ECLIPSE: its moon-shafts' ring a disc of 9 m about the floor's middle, phase 12 s. Its nearest haven's edge is
      at most 14.5 m from any point of any floor at any moment of its 40 s, inside section 11.2's 20 m;
    - four rifts set in the walls, two Lurkers, a Caster on each gallery, the Battlemage's niche, and the Moon-Mirror's
      engine in its recess;
    - a walk graph of nineteen nodes and twenty-four edges, one graph over the floor, up both stairs and onto both
      galleries;
    - a seam alcove holding a page of the Annals, and four lights: three moonlights under the slot, the band's own over
      the eclipse;
    - a 120-triangle proxy: the floors and the stairs, the walls along the outlines, the galleries' fronts, the stairs'
      inner sides and the two ceilings.
  - **Its files**: `tools/egHeroEclipseScene.mjs`, `tools/bakeEgHeroEclipse.mjs`,
    `src/assets/egfrags/source/egheroEclipse.fbx`, `src/assets/egfrags/egheroEclipse.law.json`,
    `src/assets/egfrags/egheroEclipse.mesh.json`.
- **REGISTERED**: both law halves in `net/eliteGates/egHeroFrags.js` `EG_HERO_FRAGS` (each held to the reader at import, laid by its
  kit's halls through `egHeroFragLaws` - a hero, never the reference), both mesh halves in `world/eliteGates/egHeroFragModel.js`
  `EG_HERO_FRAG_MESHES` beside them. `test/tooling/doctrine.test.js`'s allow-list names the six files.

**Departures, said plainly.**

1. **Written in code, not modelled in Blender.** Every shape is the kit's sheet, tube, lathe, sweep and level face, from
   tables and an integer hash, and that costs something:
   - no sculpted detail past those shapes - no carved capital, no hand-cut shard, no knot in a bough;
   - the noise is value noise: it pushes walls out in soft lumps, never chisels;
   - the UVs are the shapes' own (a tile every 1.25-2 m on the walls and floors, bark stretched along the trunks), never a
     hand-laid unwrap, so a seam falls where a shape closes and not always where the eye does not rest;
   - each file's SceneInfo names the reference's writer (`FRAG_REF_WRITER`), which wrote it - so the bake asks no
     Blender's cut of its faces.
2. **The Thicket's chasm is longer than the kit's.** It is 17.5 m between landings of 5.5 m and 5 m, where the kit's is
   13 m between landings of 7.5 m. THE MEDIAN refuses the kit's own 13 m crossed alone: its median, 3.7 s, is past 1.6 x its
   fastest, 2.2 s. The kit's course is proven only inside a hall's whole road. A hero's inner course is proven alone at bake
   time, and four branches over 17.5 m prove at 1.38.
3. **The Thicket's landings are glades.** They widen to 9.2 m inside the kit's 7 m mouth, and its box is 13.5 m across.
4. **The Vault is one size.** It is the Deepway's chamber, R 16 m. A Rift-Yard's court is 22-26 m and a proving court's
   14 m, and whether a laying fits it to either is the laying's.
5. **The Vault's galleries stand in bays behind the rim.** The code-built balcony is a disc overlapping the court; here
   the fight floor keeps its whole disc. The stairs' chords and the gatehouses' chords are cut from it, and the thresholds
   are traversal, as the code-built court's bridge is.
6. **The branches are the scenes'.** The art draws the boughs that hold the Moon branches, never the branches: a branch is
   solid only under its beam, and egSpan stands it so. The bough under a gone branch hangs as its stub.
7. **The Moon-Mirror stands off the floor.** Its pedestal is outside the floors' outlines (a recess in the Vault, against
   the east wall in the Thicket); its engine anchor is at the pedestal, within its 2 m reach of the floor's rim.
8. **"No drawn vertex inside the proxy" is measured, not derived** (the EG6c record's departure 9 left it unchecked). The
   test holds it as the space the proxy leaves a body:
   - each floor's outline 2 cm in, from 2 cm over it to 2 cm under its lowest ceiling (4.5 m where open);
   - each ramp's outline over its surface;
   - each inner piece's footprint and the gaps between, 4.5 m up.
9. **The Eclipse's 20 m is straight-line.** It is measured to the nearest haven's edge over every floor point every metre
   and every 2 s of the cycle. A gallery's member drops 3.5 m to the floor, under the fall's 5 m.
10. **THE EDGE LINE on a stair is drawn a tread at a time**, each one on its tread, at most a rise under the law's slope. A
    floor that runs on into another at its height carries none, because no member falls there.
11. **The preview flips v.** Its renderer (scratch tooling, not committed) samples v up; the art is authored with the
    game's v (0 the picture's first row - no `UNPACK_FLIP_Y`), as `world/superDungeon/sdRealm.js` maps its root record. Only the root
    record's undersides care.

**Not verified without a browser and the game's data:**
- neither mesh was drawn by the renderer. They were drawn by a software rasteriser in node with the band's own painted
  dress (its persp, exit, side, top and cutaway views, and eye-level views from the mouth, the near lip and the floor);
- whether the moonlights light the moon-slot's ring as the shafts walk it - they are static lights; the shafts are the
  telegraph's havens.

**The four hosts.**
- `src/scenes/world.js` - FLAGGED: untouched. No hero is laid here, so no host draws one.
- `src/scenes/worldModes.js` - FLAGGED: untouched.
- `src/scenes/dungeonContext.js` - FLAGGED: untouched.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach.

**Pins.**
- `test/tooling/eghero_shade.test.js` (4 declared, 14 run). Every rule reads the producer's own bake of its scene written again:
  - the scene and both halves are its committed bytes, twice;
  - the reader accepts it, and both registries hold it;
  - its winding and its budget;
  - THE EDGE LINE on every walkable rim, and no drawn vertex in the space the proxy leaves;
  - the Thicket's envelope, law and solver's proof, and the Vault's envelope, law and Eclipse.
- `tools/mutants/eghero_shade.json` (28, every one dead), aimed at:
  - the scenes - a branch, the beams' phase and origin, an edge line, the mirror onto a landing, a wall pushed inward, a
    walk edge across the chasm, a point folded to a sliver, normals unflipped, a trunk on a floor, a gallery's height, the
    vault's ceiling, the ring, the Eclipse's phase, a stair's lines, a gallery's line, a column on a gallery, a stair off
    the graph, the dome inside out;
  - the bake scripts' specs, and the registries;
  - the law's ring, a beam's reach and the budget, and the bake's moon clock;
  - the test's own 20 m sweep.
- PIN MOVED: `test/net/eliteGates/eg6c_law.test.js` - the registry's keys are the reference's and the two heroes'.
- `RELAY_VERSION` stays the arc's (`world200` since the merge of main past AUDIT ETHER-OW, `world201` past PEER-ACTS, `world203` past CHAT-TRADE and FIVE-ASKS, `world205` past KG-SET and KG5, `world206` past PVP-LOOT + QUEST-HOME). At
  this slice no file of the relay's bundle moved, and `net/eliteGates/egHeroFrags.js` was in no relay import graph yet. Since
  EG-HERO-LAY every hero's law JSON is in the relay's graph (that record's "The relay's bytes"). `ACCOUNT_VERSION` stays
  the arc's (`acct133`; `acct134` since the merge past LAMP-KEEPER II, `acct135` past KG6, `acct136` past POI-1, `acct137` past SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME), with no migration. `EG_SPEC` and `EG_LAWS` were as they were.
- The Port-Ledger's ELITE-GATES row names the four tools and the assets.

### EG-HERO (the Broken Galleries) - 2026-10-13 - THE OBLIVION CAVERNS, THE FALLEN STACKS, THE BROKEN COLONNADE

Mac, 2026-10-13: *"You have to author the fragments"*. The hero fragments this page said Mac authors in Blender
(section 11.6, "Authored hero fragments") are now the port's to author, in code. Each is a scene written from numbers by a
script, as `tools/egRefFragScene.mjs` writes the reference, and exported as the .fbx `tools/fragBake.mjs` bakes. Each is
baked by its own script, registered and pinned. This record is the Broken Galleries' three: one for each of the band's
kits (section 11.2), each in the class the brief named. Three other slices author the other bands' heroes, and laying any
hero into a hall is spec law 7's (EG-HERO-LAY).

**What shipped, by fragment.**

- **THE OBLIVION CAVERNS** (`egheroCaverns`: kit `caverns`, a passage, variant `caverns`).
  - *What it is:* the Deadlands' lava tubes under the torn halls. A floating mass of basalt is bored through by a lava
    tube, not a box: an elliptical bore 8.5 m across and 7.7 m to its crown. Its walls are pushed outward by noise (never
    inward, never the floor), with a lava bench along each wall. The underside of the mass is torn and hangs basalt spurs
    into the void, and two slabs of the torn hall's flagged floor lie across its crown, with the stumps of their
    colonnade. The Battlemages' marble portals are set into the rock at the mouth and the exit, each lintel filled to the
    bore's ellipse. Inside, under hanging basalt columns, is the near fight floor. A glowing fissure across the vault
    feeds the FIRE FALL at the chasm's lip. The chasm is the tube's floor gone into a magma lake 4.8 m down. Over it the
    vault is broken open onto the burning sky, crossed by one surviving rib. The way across is the planks of a CHAINED
    BRIDGE that fell: three ledges slung on chains from the vault and the rib, with the bridge's gilded posts at both lips
    trailing its broken chains. On the far fight floor a MAGMA CHANNEL is cut along the west wall. It is fed by a spout
    under a gilded sluice gate and spills into the lake, and a basalt kerb carries THE EDGE LINE along its lip (section
    11.9's kerb). An alcove behind a false wall in the east wall, framed by a marble portal, holds a page of the Annals.
  - *Envelope* (`net/eliteGates/egFragLaw.js` `egFragPassage`, the default kit; `net/eliteGates/egLaw.js` `EG_CAVE`): the mouth is 6 m by
    5.2 m (halfW 300, height 520), 28 m long, with one exit 6 m by 5.2 m on floor height 0 (yB 0). The kit's 10 m chasm is
    widened to 13 m (Y 8-21) for a real crossing. Box: x -10.62 to 10.61 m, y -17.26 to 19.21 m, z 0 to 28 m.
  - *Art:* 8,918 triangles in 6 draws, all the Galleries' dress: `floor` the flags; `root` the rock (its works band
    walked out and back for basalt; the lip and courses on the torn edges; its gradient on the underside); `pillar` the
    portals; `brass` the posts, chains and sluice; `molten` the lake, channel, fissure and spout; `edge`.
  - *Law:* two fight floors (notched round the posts) and two ceilings at 5.2 m. Hazards: the fire fall (a lane across the
    passage, 1.2 m deep, just short of the near lip), falling basalt (two discs r 2.5 on the near floor) and a magma surge
    (a 4 m lane along the channel over the far floor). The course is three ledges, gaps 1.7, 1.8, 1.8 and 1.7 m, sagging
    0.2-0.45 m. THE TIMED SOLVER proves it: 2.066 s fastest, 2.066 s median, four moves. The walk graph has ten nodes and
    twelve edges, none across the chasm. Anchors: two Lurkers, the Low Road's niche, the sluice's engine and two hazard
    sources. One seam alcove (a page). Three lights: two of the kit's own, one of the lava. A 76-triangle proxy.

- **THE FALLEN STACKS** (`egheroStacks`: kit `stacks`, a chamber, variant `stacks`, play `balcony` and `engine`).
  - *What it is:* the Athenaeum's rotunda, torn loose into the void.
    - Its marble drum is lined with gilded stacks.
    - Its gilded dome is broken open onto the burning sky round its oculus: a great rent over the east gallery (seen from
      the mouth) and a lesser one over the portal (seen from the approach). The drum's lower courses are torn off below.
    - Its reading-room floor (the court plates with their Battlemage-blue inlay) stands alone in the drum over the void,
      a root hanging under it.
    - Two galleries survive as balconies, east and west, 3.5 m up against the stacks. Each is reached by a marble stair
      fanning up from a slot in the floor across the gap. Their fronts are parapets: walls, so no edge line.
    - The company comes in through the rotunda's portal and crosses the gap on two bookcases that fell across it
      ("bookcases become platforms"). It leaves over a bridge to the far portal.
    - THE SHELF stands on its plinth at the floor's south-west rim.
    - The floor of the fallen wing stands on its edge before the drum's south-west ("floors become walls").
    - A seam alcove in the east gallery's back wall, its niche built out past the drum, holds a Vestige shard.
  - *Envelope* (`egFragChamber('stacks', r, R)`, with R the proving court's 14 m from `net/eliteGates/egLaw.js`: the page's "one
    proving court in three is a chamber (the Fallen Stacks' broken dome)"):
    - the fight floor has radius R about (0, 23.5 m), and its ring wall stands at R + 9 m (the drum's inner face, 22.5 m);
    - the two balconies are the kit's own: east and west, 3.5 m up, 15.5-22 m out (kept clear of the floor's 6 m of
      headroom), each on its stair from 6 m out;
    - THE SHELF stands where the kit stands it, toward the mouth;
    - the mouth and the exit are the doorways, 6.6 m by 8 m, on the drum's outer faces 47 m apart;
    - box: x -23.47 to 25.8 m, y -14 to 21.42 m, z 0 to 47 m.
  - *Art:* 5,176 triangles in 7 draws: `pillar` (the drum and the dome inside, the portals), `brass` (the gilded dome
    outside, the stacks, the bookcases), `root` (every broken edge's section, the books in shadow, the undersides), `arena`
    (the reading floor), `floor` (the galleries and stairs), `cobble` (the bridge) and `edge`.
  - *Law:* three fight floors (the reading floor with its two slots; the two galleries) and two traversal floors (the
    threshold, the bridge). Two ramps (the stairs), no ceiling (the dome is broken: open to the sky), and 66 open edges.
    THE CASCADE: four lanes 4 m deep across the floor, 5.5 m apart, the near first. The course is two bookcases, gaps 1.6,
    1.6 and 1.66 m (0.3 m up, then 0.5 m down). The solver proves it in 1.207 s fastest and 1.207 s median, three moves.
    (AUDIT EG IV: the second shelf 2.0 m deep, the last gap 1.26 m, proven in 1.280 s - EG-HERO-LAY's merge notes.)
    The walk graph has 21 nodes and 23 edges, up each stair to its gallery and never across the gap. Anchors: four rifts
    round the floor (for a Rift-Yard), a Caster on each gallery, three Lurkers, the engine and two hazard sources. One seam
    alcove (a shard), four lights of the kit's own, and a 260-triangle proxy.

- **THE BROKEN COLONNADE** (`egheroColonnade`: kit `colonnade`, a passage, variant `colonnade`).
  - *What it is:* the Galleries' great colonnade, come down across the void. The company enters under a standing arch
    onto a length of its entablature, which still rides two columns whose feet are gone into the dark. It crosses on a
    drum lying where it fell (the still piece), then on two drums ROLLING back and forth along fallen architraves at the
    law's fixed 2.0 m/s (the signature, ridden as Rails). It lands on the far entablature and leaves under the second
    arch, which is broken at its west haunch, its three voussoirs tumbling below. On either side the colonnade stands
    broken in the void, in two ranks: columns rise from nowhere to broken tops or gilded capitals, one lintel still
    bridges two, another has slipped to hang at a slant, one column has fallen right across under the course, and loose
    drums drift below. A capital standing clear of the near landing holds lumen past an optional hard jump (2.3 m, 0.4 m
    up): the alcove.
  - *Envelope* (`egFragPassage('colonnade')`): open (no wall, no vault, no ceiling), the mouth 5 m wide (halfW 250) with
    its opening 4.6 m to the arches' spring, 28 m long, one exit 5 m wide on floor height 0. The course is the kit's pieces
    (a still drum, two rolling drums at 1.2 m travel - the kit's 1.5 m, held clear). The landings are 4.6 m and 4.4 m (the
    kit's 3.9 m, for a fight). Box: x -11.2 to 11.05 m, y -13.1 to 8.45 m, z 0 to 28 m.
  - *Art:* 5,094 triangles in 5 draws: `pillar` (columns as ashlar drums, arches, entablature), `brass` (capitals, the
    architraves' gilded fillets), `floor` (the landings), `root` (their torn faces) and `edge`.
  - *Law:* two fight floors (the landings) and one traversal floor (the alcove's capital), every edge open but the mouth's
    and the exit's. No ceiling and no hazard: the drums are the signature. The course is the still drum (0.35 m up, gap
    2.2 m) and two drums (gaps 2.6 and 3.0 m, period 2.4 s, half a roll apart, so at their nearest they pass 0.6 m apart).
    The solver proves it in 2.999 s fastest and 3.099 s median, four moves. The walk graph has six nodes and six edges,
    three a landing. Anchors: two Lurkers and a Caster on the far landing. One jump alcove (lumen), three lights and an
    84-triangle proxy (the landings, the capital, the arches' columns).

**THE AUTHORING KIT, added to** (`tools/egHeroKit.mjs`'s own section at its end; numbers IEEE-only, as the kit's rule):
- `newell` and `planUv`: a face's normal, and the reference writer's own plan mapping;
- `flat`, `facing` and `block`: a hard face with its UVs (wound by its points, or to face a direction), and a box;
- `cells`: a level floor of cells with no T-junction. It draws every marker floor, ceiling and drawn ground of the three;
- `shell`: two grids on one lattice with a hole mask, every hole closed by rims from the inner face to the outer (the
  Caverns' sky over its chasm, the Stacks' rents and doorways and torn foot), and an inner-only `cut` for a framed
  doorway.

The Caverns and the Stacks share `shell`; all three share the rest.

**Files.**
- Scenes: `tools/egHeroCavernsScene.mjs`, `tools/egHeroStacksScene.mjs`, `tools/egHeroColonnadeScene.mjs`. Each exports
  its scene function and its writer (`writeHero*Fbx`, through `writeRefFragFbx`); `node tools/egHero*Scene.mjs` writes the
  committed .fbx.
- Bakes: `tools/bakeEgHeroCaverns.mjs`, `tools/bakeEgHeroStacks.mjs`, `tools/bakeEgHeroColonnade.mjs`, each the
  reference's shape with its SPEC.
- Assets: `src/assets/egfrags/source/eghero{Caverns,Stacks,Colonnade}.fbx` (1.13 MB, 0.82 MB and 0.62 MB) and their halves
  `src/assets/egfrags/eghero*.law.json` and `.mesh.json`.
- Registered: the laws in `net/eliteGates/egHeroFrags.js` `EG_HERO_FRAGS`, the meshes in `world/eliteGates/egHeroFragModel.js`
  `EG_HERO_FRAG_MESHES`. `egHeroFragLaws(kit)` now gives each kit's hero.
- `test/tooling/doctrine.test.js`'s allow-list names the nine files. The Port-Ledger's ELITE-GATES row names the scenes, the
  bakes and the assets.

**Departures, said plainly.**

1. **Written in code, not modelled in Blender.** No sculpted detail past the kit's shapes:
   - the rock is value noise on a lattice, pushed outward, smooth-shaded; there is no hand-placed crack or strata;
   - columns are 16-sided lathes, chains are boxes turned link by link, and the stacks are a stepped profile, not books;
   - there is no hand UV unwrap: plan, arc-length and per-face maps, a tile a 2 m on the whole;
   - there is no baked light, AO or vertex colour.
   The dark basalt is `root`'s own works band, its v walked out and back between v 0.235 and 0.32 so a long face never
   leaves it. That is a reading of the record's picture, not a record of its own.
2. **What a hero does not draw.** The course's pieces are the span's to stand (`scenes/eliteGates/egSpan.js` - they move, and wear
   their tells), so the scenes draw only what hangs under them or holds them: the bookcases under the Stacks' ledges, the
   chains to the Caverns' planks, the architraves under the drums. Each assumes the span's slab, 0.6 m thick
   (`SD_STEP_THICK`). The Caverns' fire fall is Daggerfall's own TEXTURE.356, the client's to draw on the fall's line
   (section 11.6), so the scene draws only its fissure. False walls are `scenes/eliteGates/egSpan.js`'s; the niches behind them are
   drawn to `world/eliteGates/egHall.js` `egNicheBoxes`' box.
3. **The envelopes bent where the hero needed room**, each said in its scene's header:
   - the Caverns' chasm is 13 m, not 10 m;
   - the Colonnade's landings are 4.6 m and 4.4 m, not 3.9 m;
   - the Stacks' doorways are 6.6 m (the code-built court has no mouth: the hall's bridge band meets it);
   - the Stacks is R 14 m: it fits a proving court, not a yard's 22-26 m or the Deepway's 16 m.
4. **The Stacks is open to the sky** (its dome broken), so no ceiling clamps it and Divers may dive there (section 11.7).
   Its galleries' fronts are parapets, so a member comes down by the stairs, never off the edge.
5. **The Colonnade has no hazard record.** Its signature is its course, as the code-built kit's is, and section 11.2's
   "arches climbed as Risers" is not taken: `EG_FRAG_PIECES.colonnade` lays no Riser. Its arches are the gates it passes
   under.
6. **THE TIMED SOLVER takes the ground level** with the first and last pieces (`net/eliteGates/egSpanLaw.js` `jumpLands`). The band's
   test holds each hero's real rise onto its first piece and off its last inside THE SPAN BUILD's reach (`egJumpReach`).
7. **THE EDGE LINE and the proxy are held by the band's test, not by the bake.** The bake does not check them (EG6c
   departure 9).
   - The edge line test asks a strip of the `edge` record just inside every point of every open edge, except where the
     edge runs on into another floor or a ramp, or lies on a socket's face.
   - The proxy test asks that no drawn vertex stands in the room over any floor or ramp (5 cm in, 3 cm over it, up to its
     ceiling or its class's headroom). It also asks that the proxy floors every floor and walls every edge that is not open.
   - The stairs' treads lie under their ramp (their nosings on it), and their edge line runs tread by tread.
8. **Not verified in the game.** Each was looked at only in a software preview, from without and within (the band's
   painted dress, a sun, back faces culled). Nothing is laid yet: laying a hero is spec law 7's.

**The four hosts.** `src/scenes/exterior.js`, `src/scenes/world.js`, `src/scenes/worldModes.js` and
`src/scenes/dungeonContext.js` are none of them touched. A hero is registered, not laid, and nothing draws one until
EG-HERO-LAY lays it.

**Pins.**
- `test/tooling/eghero_galleries.test.js` (10): for each fragment,
  - the bytes: the scene, the bake twice;
  - the reader and both registries;
  - THE ENVELOPE, deepEqual: spec, sockets, box, floors, ceilings, open edges, course, graph, alcove and hazards;
  - THE TIMED SOLVER's proof, and the ground's real rise;
  - the signatures, lawful;
  - the budget;
  - THE EDGE LINE on every rim;
  - the proxy as the room's envelope;
  - the walk graph on its ground;
  - no engine-rounded function in a scene.
- `tools/mutants/eghero_galleries.json` (41, every one dead). Each scene mutant was judged again with the scene re-written
  and re-baked under it, so the bytes could not be what killed it: every one dies on its law test.
  - The one gap that judging found is now held: a first piece too high off the ground, which the solver takes level.
- PIN MOVED: `test/net/eliteGates/eg6c_law.test.js` no longer pins the registry to the reference alone. Its first entry is the reference,
  and no kit's layable heroes include it (the reference's "laid by no hall", kept failing).
- `RELAY_VERSION` stays `world199`. At this slice `net/eliteGates/egHeroFrags.js` was not in the relay's bundle, and no file of it
  moved (`test/net/relayversion.test.js` stood). Since EG-HERO-LAY every hero's law JSON is in the relay's graph (that
  record's "The relay's bytes"). `ACCOUNT_VERSION` stays `acct124`; there is no migration. `EG_SPEC` and `EG_LAWS` were as
  they were.

### EG-HERO-LAY - 2026-10-13 - SPEC LAW 7: THE HEROES LAID

The owner (2026-10-13): *"You have to author the fragments"*. Four slices author the ten hero fragments beside this one, one
kit at a time, each a baked record in `net/eliteGates/egHeroFrags.js` and a mesh in `world/eliteGates/egHeroFragModel.js`. This slice lays them:
any registered hero but the reference, generically, by its law record alone. EG6c left the laying as its owner item ("Not
built - the owner item, for when Mac's fragments arrive"); it is built here as spec law 7, since `EG_SPEC` 6 went to AUDIT EG
III's span decrees. Narrowed: section 11.4 (a hero in a kit's place), section 11.6 ("laying his into the halls waits for
them"), layer three's departure and its still-owed item, EG6c's "laying waits" sentence and its owner item, and
`net/eliteGates/egHeroFrags.js`'s header ("NO HALL LAYS IT ... when they arrive").

**What shipped, by piece.**

- **THE LAW** (`net/eliteGates/egLaw.js`):
  - `EG_SPEC` 7 and `EG_HERO_LAW` 7. `egHallOf` lays law 6's hall first, on the try its solver takes, as before; from law 7,
    `heroHall` then tosses its coins over that hall's fragments;
  - `heroHall` lays the hall again on the same try with the hero at its slot. `layHall`'s fragment makers (`cave`, `shaft`
    and a court's chamber) take it there in the kit's place, through `heroAt`, which holds it to `egHeroStatic`;
  - `heroLay` lays the record at its origin, the foot of its mouth:
    - its fight floors go into `fl` as polygons (`{ t: 'p', poly, y }`), and its stairs into `ramps` in the code-built
      ramp's shape;
    - its hazards go on the shared clock, and its anchors become the legion's places (an engine anchor stands its kit's
      engine);
    - its alcoves and lights are laid, and its inner course goes through the span generator at its authored places and
      sizes (`net/eliteGates/egSpanLaw.js`: a step's `size` may name its own);
    - the course then runs on from its exit at the exit's height. The next bridge begins at the box's end, with no
      half-metre lap back over its floor;
  - a hero chamber's court (`heroCourtAt`, `egHeroCourtOf`) is laid at the hero's own size:
    - its mouth is the court's near edge, its middle the court's, and its reach the court's radius. No code-built disc or
      ring wall is laid;
    - a Rift-Yard's rifts are its own rift anchors where it names five, and a Deepway's where it names three. Otherwise the
      hall law sets them on its floor;
    - the Clan Pit's Honour Horn is its kit's, and a captive's chains stand about its middle;
  - `heroFit` holds the laid hall to the fit rule (below), and `egHeroTrials(seed, h, geo, law)` says every slot's coin and
    why its hero did or did not stand. That is for the pins, a tool, and an author asking where theirs would stand;
  - the spec's new field `heroes` (in metres) carries each laid hero's id, kit, class, fragment, road, origin, exit, box,
    sockets, floors, ramps, open edges, ceilings and walk graph: the clamp, the fair trail's ground and the legion's graph
    read them there;
  - polygons are read in `egOnFloor`, `egOnFight`, `egFightPieceAt` and `egKeepOnFight`.
- **THE SEAM**: `egHeroSeam(frags)` swaps the registry the law lays from (`EG_HERO_FRAGS` by default) and forgets every
  hall kept. It is for a test or a tool's sweep, never a breach. `world/eliteGates/egHall.js` `egHeroMeshSeam` is its client twin.
- **THE POLYGONS** (`net/eliteGates/egShape.js`): `egPolyIn`, `egPolyEdgeDist`, `egPolyDist`, `egPolyKeep` and `egPieceIn`. A disc, a
  lane and a polygon are each a fight-floor piece. These are read by:
  - `net/eliteGates/egFair.js` (`egFightFloorAt`, and the fair trail's ground over a hero's floors);
  - `net/bossRef.js` (the floors under a body);
  - `world/eliteGates/egTelegraph.js` (a polygon cut by ear clipping for the telegraph pass).
- **THE LEGION** (`net/eliteGates/egWalkGraph.js`):
  - a hero's fight floors are regions, with portals where their plans meet;
  - its law's nodes and edges join the hall's graph, with a node at each socket's foot;
  - inside a region a walker goes straight only where it sees through (`egSeesIn`, `EG_SEE_STEP_M`), so it goes round a
    notch. The nearest point and the keep are the polygon's;
  - its walls (every floor edge its law does not open) stand in the fliers' air.
- **THE CLIENT** (`world/eliteGates/egHall.js`, `world/eliteGates/egHeroFragModel.js`, `systems/eliteGates/egReverb.js`):
  - the hero's mesh half is laid into the circle's one mesh at its origin through `egHeroFragInto` (now given an `at`). Its
    ground is laid plainly: each triangle whose top stands within a hand (`EG_HERO_GROUND_HAND_M`, 0.2 m) of a height its
    law lays ground at, a floor or a stair's corner (`egHeroGroundYs`). Every other triangle is its rock, whatever record it
    wears, cut a record's 6 m cell at a time (`EG_HERO_ROCK_CELL_M`), each cell an occluder of its own (EG-ZN). This was
    changed at the merge of the ten heroes (below);
  - its proxy goes into the circle's one collider bucket through `egHeroFragCollider` (an `at` too), so it is freed with
    the circle and owns no buffer;
  - its lights join the circle's in its kit's colours;
  - no code-built stair, niche or slag spout is drawn or collided inside its box: its own mesh holds them;
  - its clamp is `egFragZones`' `hero` zone:
    - its law's floors are extruded to its ceilings, or open to the sky where it has none;
    - each edge its law does not open is a wall, and its stairs are free;
    - a hero shaft is marked as a code-built one is;
  - its reverb zone's half-width reaches the farther side of its box.
- **THE SWEEP** (`tools/egSpanSolve.mjs`): the sweep's ground reads a hero's floors, so the real motor's sweep crosses a hero
  hall over its proxy and its floors.
- **THE LAW PIN** (`net/eliteGates/egDurable.js`): `EG_LAWS` is `{ 4, 5, 6, 7 }`, law 7 dated 2026-10-13. Laws 4, 5 and 6 keep their
  800-hall hashes byte for byte. A breach records law 7, and a breach of law 6 draws law 6's halls with no hero in any.

**The odds.**

- **The slots.** A hall's slots are its code-built fragments, in order: a passage, a chamber or a shaft, never a set piece
  (the Collapsing Tube, the Sinking Stair, the Moon Path, the Forge Line). A fragment is a slot only where a hero of its kit
  and class is registered (`egHeroCands`; `egHeroFragLaws` leaves the reference out).
- **The die.** The hall's own hero die is `sdRng(egSeed(seed, 0x0e6e40 + h))`. It is a die of its own, so the hall's stream
  never feels the coin.
- **The coin.** Each slot takes one draw `u`, in order:
  - `u` of one half or more is tails;
  - heads picks the slot's hero at `floor(u * 2 * count)`;
  - the first heads whose hero fits is laid. A hero that does not fit hands the turn to the next slot's coin.
- **At most one hero a hall.** No heads, or no fit, and law 6's hall stands byte for byte except its `v`.
- **The pins' tally.** With the test registry (the reference re-labelled `test`, and a chamber and a shaft fixture), 49
  halls held 54 coins between them: 33 passage, 15 chamber and 6 shaft. 19 heroes were laid and two did not fit. No hall
  laid two.

**The fit rule** (a hero is laid only when all of these hold).

- **At its slot** (`egHeroStatic`):
  - its box runs along +Z from its mouth;
  - its mouth is at least `EG_HERO_WAY_CM` (a ledge, 240 cm) wide, with a floor at its foot;
  - its course leaves by its lowest exit on the course's line (`egHeroExit`: its middle within half its width of x = 0,
    and at least a ledge wide), with a floor under it;
  - that exit stands at the height its slot keeps:
    - a passage's is at its mouth's height, or as far under it as its kit's own code-built passage descends (the Mist
      Stair's 3.6 m; every other kit 0). On the Low Road it is at its mouth's height alone;
    - a shaft's is 1 cm to `EG_HERO_SHAFT_CM` (810 cm: four flights and the deepest Drop) under its mouth;
    - a chamber's is at its mouth's height. A chamber's middle (half its length along the line) must also stand on a fight
      floor at its mouth's height that reaches more than a rift's 3 m inset from it;
  - a chamber is never laid in a Proving Walk's Reliquary Vault, whose side span leaves the court through its wall.
- **Over the hall laid** (`heroFit`):
  - the hall stays inside `EG_HALL_LEN_MAX` (158 m) and its cap of four fragments;
  - its box stands `EG_FRAG_APART_CM` (2 m) from every other fragment's volume, and from every piece's swept box with
    the piece's hanging underside (`EG_HANG_CM`, 22 m). Its own inner course is excepted, and so is a volume joined at its
    mouth or exit face, overlapping no more than the socket's 10 cm;
  - its vault stands `EG_VAULT_UNDER_CM` (3 m) under any underside over it;
  - in a chamber, every place the hall set inside its box (a rift, a spot, the foe) stands on one of its fight floors. Its
    own anchors are excepted.
- **Its inner course landed** (`egHeroLanding`, THE LANDING ROOM - added at the merge of the ten heroes):
  - THE SPAN BUILD's running jump onto each piece comes down at least `EG_HERO_LAND_ROOM_CM` (40 cm since AUDIT EG IV, 20
    cm before) before the piece's far edge. The jump is pressed at the launch edge: the run and the jump's forward push over its time in the air, at the
    height between;
  - a piece that moves along the course (a Drift, a Rail, a Drum, a Pendulum - from spec law 8 a Rail and a Drum alone:
    a Drift swings across the course and a Pendulum's step stands still, so each is landed on as still ground, AUDIT EG V
    lane5 #17) is excepted, and so is a step down of more
    than 30 cm that the build's run carries it off onto;
  - every code-built landing a piece launches onto leaves at least 0.44 m (measured over the law pin's 800 halls); only one
    launched from still ground, after its run-up, leaves less (0.24 m). The real motor stood on a hero landing 32 cm short
    of its edge in 5 of 37 crossings over 200 seeds, and on one 42 cm short in none (AUDIT EG IV).
- **Whole**:
  - THE TIMED SOLVER proves the whole hall;
  - its spec stays inside `EG_SPEC_SAID_MAX` (32,768 characters, `net/wire.js` `EG_SPEC_WIRE_MAX`, pinned equal).

**The relay's bytes.**

- `net/eliteGates/egHeroFrags.js` (2,543 B) and the reference's law half (`assets/egfrags/egRefFrag.law.json`, 2,559 B) join the
  relay's graph after `net/eliteGates/egFragLaw.js`, which takes it from 88 files to 90. No mesh half joins, and no `world/`,
  `scenes/` or `render/` file.
- Each hero adds its law JSON and one import line. The two fixtures run 1,572 and 1,651 characters, and the reference
  2,559 B.
- A hall a hero stands in grows by its `heroes` entry: 482 to 1,092 characters in the pins.
- `RELAY_VERSION` `world199`, unshipped, is rehashed in place.
- As merged with the ten heroes:
  - the graph holds `net/eliteGates/egHeroFrags.js` (4,888 B) and eleven law JSONs (28,826 B: 1,768 B for the Colonnade's up to
    4,206 B for the Stacks'), 100 files;
  - `RELAY_VERSION` is `world200` (main took `world199`; `world201` since main's PEER-ACTS took `world200`, `world203` since CHAT-TRADE and FIVE-ASKS took `world201` and `world202`, `world205` since KG-SET and KG5 took `world203` and `world204`, `world206` since PVP-LOOT + QUEST-HOME took `world205`), rehashed in place.

**The four hosts.**

- `src/scenes/world.js` - FLAGGED, untouched. The hero rides doors the hosts already share: the circle's one mesh and
  collider bucket, and the breach client's clamp (`scenes/eliteGates/egClient.js` `egFragArena`). Nothing was added to
  `function frame(now)`.
- `src/scenes/worldModes.js` - WIRED through its existing path, no line changed. Its `buildEgCircleModel` and
  `egCircleColliderTris` carry the hero, and it frees them with the circle as before.
- `src/scenes/dungeonContext.js` - FLAGGED, untouched.
- `src/scenes/exterior.js` - FLAGGED: the bench is offline and holds no Elite Breach.

**Departures, said plainly.**

1. **The registry is part of law 7.** A hero registered after law 7 ships moves law 7's halls, so it is a new spec law
   (a new `EG_SPEC`, with the laws before kept - law 8 is AUDIT EG V's) and a relay version. The ten heroes must land before law 7 ships, or come with a law of
   their own.
2. A hall a hero stands in is laid again with it. Past the hero's slot, its stream draws what the code-built fragment's
   own draws would have moved, so its later pieces are not law 6's. Only a hall with no hero is law 6's byte for byte.
3. A hero the solver refuses is not laid again on another try. Law 6's hall stands (in the pins, seed 77's hall
   26: laid again with the hero, its sinking flight asks a wait of 36 s).
4. A hero never stands in a set piece's place, nor in a Reliquary Vault's court.
5. Each code-built fragment's volume for VOLUMES STAND APART is its cave's floors and vault, its court's square up to a
   chamber's headroom, or a set piece's flights' strip. These are boxes, not the code-built mesh.
6. A hero's stair is said in `ramps` in the code-built ramp's shape (from the middle of its low corners to the middle of its
   high ones, half its widest side across) for the fair trail and the walk graph. `heroes` carries its corners whole for
   the floor and the clamp.
7. A client that does not carry a hero's mesh (a law-foreign build given the relay's bytes) draws and collides nothing
   there. The law stands all the same.
8. No pin fails these three on a registered hero: the refusal for another fragment's box, the hanging underside alone, and
   the vault rule. None of the pins' halls presents one. They are pure and said here.

**Not verified without a browser and the game's data:** no hero hall was drawn or played. Its mesh, clamp and collider were
checked in node: its triangles at their origin, its occluder runs, its proxy in the bucket, and the real motor crossing it
over that proxy.

**Pins.**

- `test/net/eliteGates/eghero_lay.test.js` (11) drives the law through the seam. Its fixtures (`test/fixtures/egheroLay.mjs`: a Caverns
  chamber with a balcony and an L-shaped fight floor, and a shaft) are written and baked by the port's own writer and bake,
  so the law a shipped hero does not yet exercise is proven.
- `tools/mutants/eghero_lay.json` (98, every one dead). Two survived the first run, and new assertions killed both:
  - a hero laid at an earlier fragment of its class (now a Deepway's last passage, laid after a Broken Colonnade's);
  - a stair read as floor only where a floor lies under it (now the stair with its floors taken away).
- PIN MOVED: `test/net/eliteGates/egaudit3_law.test.js`, `test/net/eliteGates/egdur_relay.test.js` and `test/net/eliteGates/egz_frag.test.js` (law 7 is the law, with
  law 6 kept beside it).
- Re-aimed by content and judged again: eight records of `egaudit3_law.json`, `egz_frag.json`, `egz_legion.json` and
  `egz_sound.json`, every one dead.
- The 25-seed sweep with the golden seeds, all four bands, under law 7 with the shipped registry (the reference alone, laid
  by none): 95, 111, 108 and 109 courses, every one crossed. Law 7 is law 6 then, and its 800 halls are law 6's but their
  number. With the test registry in band 0, 100 seeds and the golden: 57 hero halls, 351 courses, every one crossed.
- `ACCOUNT_VERSION` is untouched, with no migration. The account Worker bundles the hero law all the same, since
  `net/eliteGates/egLaw.js` imports `net/eliteGates/egHeroFrags.js` and its law tables; its deploy's path filter has listed them since
  9a862e8d (the merge note at this section's end). No new `src/` module (the fixture is the test's), and the
  Port-Ledger's ELITE-GATES row is unchanged.

**At the merge of the ten heroes (2026-10-13).** The four bands' heroes, merged onto this law, made the registry real: law-7
halls lay them, and 24 tests went red. Each failure was decided at its root.

- **The law refuses what the real motor cannot cross.** All six failing courses in the sweep were the Stacks' chamber. Its
  second shelf (`course[1]`: a 1.6 m gap after the first shelf, 1.6 m deep, 0.5 m lower) takes THE SPAN BUILD's running jump
  3.09 m on. That leaves 12 cm before the shelf's far edge, and the motor jumps again only after a body has stood
  `GROUNDED_JUMP_GATE_S` (0.1 s). So the pilot stood on the shelf's lip, unable to leap. THE TIMED SOLVER had proven it,
  because it judges reach and not where a jump comes down. The law now holds a hero's inner course to THE LANDING ROOM (the
  fit rule, above):
  - the Stacks' chamber is refused at every slot and laid by no hall (until AUDIT EG IV - below);
  - its author's change: deepen the second shelf to 1.8 m, keeping its near edge (`course[1]` z 704 -> 714, d 160 -> 180,
    `after` 166 -> 146, the shelf `b` running 6.24-8.04 m in tools/egHeroStacksScene.mjs's `SHELVES`). That leaves 32 cm.
    Alternatively, stand it level with the first (`y` -20 -> +30), which leaves 64 cm. Either is a rebake
    (tools/bakeEgHeroStacks.mjs) and its own pins moved (test/tooling/eghero_galleries.test.js's course). AUDIT EG IV took neither:
    the 1.8 m shelf passed the law's 20 cm and still failed the real motor (5 of 37 crossings), so THE LANDING ROOM rose to
    40 cm and the shelf was deepened to 2.0 m (`course[1]` z 724, d 200, `after` 126, the shelf `b` running 6.24-8.24 m),
    which leaves 52 cm. The Stacks is laid in 6 of the law pin's 800 halls, and the sweep crosses every course;
  - every other hero leaves 54 cm or more (the Ossuary's bone bridges), or lands only on pieces that move.
- **The client tells ground by the law, not the record.** Heroes dress rock in their ground's records: the Gloam's trunks
  in its floor's, the Clan Pit's tiers in its cobbles', the Ossuary's and the Forge Gut's falls in molten. So the camera
  could not see through them (EG-ZN's "nothing rises from the ground unmarked"). The ground is now where the law lays
  ground, and the rock is cut a record's cell at a time, so a ray dithers what it crosses and not the whole fragment. Its
  budget, measured: one piece dithering costs at most 12 draws, as before.
- **Readers that did not know a hero's shape learned it** (each a PIN MOVED beside the test's own words):
  - a Proving Walk's court may be a hero chamber's floors (`test/net/eliteGates/egaudit3_law.test.js`);
  - the Low Road's passage may be a hero's (`test/net/eliteGates/egfrag_law.test.js`);
  - a hero chamber names its plays as a list, and its stair climbs to a polygon fight floor (`test/net/eliteGates/egfrag_law.test.js`);
  - a Rift-Yard's course is its hero chamber's alone (`test/net/eliteGates/eg6a_span.test.js`);
  - a hero's rift and hazard anchors stand where its record sets them, in centimetres (`test/net/eliteGates/egz_relay.test.js`);
  - a hero Forge Gut's crust and a hero shaft are their own records', and the kit's law is held over the code-built ones
    (`test/net/eliteGates/egz_frag.test.js`);
  - a Deepway now laid around the Colonnade's hero brings a surge's lane into the union floor's set
    (`test/net/eliteGates/egint_relay.test.js`);
  - the widest Drum is found at seed 10's Hall 2, since seed 295's lays the Colonnade's hero (`test/tooling/eg6a_sweep.test.js`);
  - a hero's ground heights are the occluder test's ground (`test/world/eliteGates/egz_camera.test.js`);
  - the budget was measured again (`test/scenes/eliteGates/egz_camera_budget.test.js`: 7.48, 9.61, 25.2, 39 and 43, where 7.15, 9.15, 23.8,
    35 and 39 stood; worst one piece 12, as before - AUDIT EG IV, the Stacks laid: 7.52, 9.64 and 25.5).
- **Of the merge, not of the heroes:**
  - `test/systems/eliteGates/egmade_law.test.js`'s avoid-death door ends at main's `avoidDeathText()`;
  - `tools/egHeroKit.mjs` carried Newell's normal twice (the Galleries' `newell`, the Wellhead's `wellNormal`, line for
    line), so MUT-AIM found `EGHERO-GALLERIES-kit-newell-misread` naming two sites. `wellNormal` is `newell` now, and the
    bakes are byte for byte;
  - `test/systems/l10n4_hardcoded.test.js`: `net/eliteGates/egLaw.js` holds 189 (it held 173). The 16 added are the fit's refusals (the
    `why` that `egHeroTrials` says), which a test and an author read and a player never does. They are kept the way
    `net/eliteGates/egFragLaw.js`'s record faults are.
- **How often each hero is laid.** Every circle of each band was laid, for 25 seeds and the golden seeds (2,800 halls, at
  the sweep's ground). The table gives each hero's fillable slots, heads and halls laid - under law 7 as it lays since
  AUDIT EG IV deepened the Stacks' second shelf and raised THE LANDING ROOM to 40 cm, and under spec law 8 (AUDIT EG V,
  lane5 #13 and lane9 #2: the Stacks' row read 32 heads and none laid, THE LANDING ROOM refusing all 32, until AUDIT EG V
  measured it again):

  | hero | law 7: slots | heads | laid | law 8: slots | heads | laid |
  |---|---|---|---|---|---|---|
  | the Ossuary (passage) | 152 | 82 | 81 | 160 | 88 | 87 |
  | the Gloam Thicket (passage) | 184 | 95 | 93 | 228 | 119 | 106 |
  | the Forge Gut (passage) | 121 | 59 | 44 | 146 | 69 | 53 |
  | the Oblivion Caverns (passage) | 104 | 43 | 34 | 108 | 45 | 41 |
  | the Clan Pit (chamber) | 35 | 23 | 23 | 35 | 23 | 23 |
  | the Eclipse Vault (chamber) | 39 | 20 | 20 | 39 | 20 | 20 |
  | the Oblivion Caverns, deep (chamber) | 27 | 16 | 15 | 27 | 16 | 16 |
  | the Mist Stair (shaft) | 29 | 14 | 14 | 29 | 14 | 14 |
  | the Broken Colonnade (passage) | 33 | 13 | 13 | 36 | 14 | 14 |
  | the Fallen Stacks (chamber) | 55 | 32 | 30 | 55 | 32 | 30 |

  Law 8's passages from circle 3 (section 11.4) give the passages more slots. The refusals, by reason, law 7's then law
  8's:
  - the Stacks' 2 under both: 1 by a Reliquary Vault, 1 by the hall past 158 m;
  - by a box meeting a step's swept box and its hanging underside: the Forge Gut's 15 and the Caverns' 2 (law 7), the
    Forge Gut's 11 and the Caverns' 4 (law 8);
  - by THE TIMED SOLVER (a sinking flight's wait, a window too narrow; from law 8 a set piece's margin too): the Caverns'
    7, the Gloam's 2 and the Ossuary's 1 (law 7); the Gloam's 13 (7 of them by the margin of the Forge Line after a
    Brink's hero), the Forge Gut's 5 and the Ossuary's 1 (law 8);
  - the deep Caverns' 1, by a Reliquary Vault (law 7).
- **The sweep**, 25 seeds and the golden seeds on all four bands with the ten heroes: 95, 111, 108 and 109 courses, every
  one crossed.
- **Pins:**
  - `test/net/eliteGates/eghero_lay.test.js` (11). THE LAW PIN, moved: law 7's 800 halls hashed whole (2018192008 since AUDIT EG IV
    deepened the Stacks' shelf; 1273544078 at this merge), each with no hero
    laid law 6's but its number, the heroes laid counted, and the Stacks' refusal named. THE FIT AT ITS SLOT now holds THE
    LANDING ROOM;
  - `tools/mutants/eghero_lay.json` (108, every one dead): two records re-aimed by content and ten new. One new survived its
    first run (a moving piece judged as a still one), and a Drift drawn 1.9 m back now kills it;
  - `EGHERO-GALLERIES-kit-newell-misread` judged again, dead.

### EG-HERO (the Havoc Wellhead) - 2026-10-13 - THE FORGE GUT, THE CLAN PIT, THE OBLIVION CAVERNS, DEEP

The owner, 2026-10-13: *"You have to author the fragments"*. Section 11.6 says Mac authors the hero fragments in Blender;
now the port authors them in code. Each is a scene a script writes from numbers, exactly as `tools/egRefFragScene.mjs`
writes the reference, exported as the .fbx `tools/fragBake.mjs` bakes, then baked, registered and tested. This record is
the Havoc Wellhead's three. The other bands' heroes, and laying them all into the halls (spec law 7), have records of their
own.

**What shipped, by fragment.** Each fragment has:
- a scene module, `tools/egHero<Name>Scene.mjs`: its scene function and its writer, reusing `writeRefFragFbx`;
- its own bake script, `tools/bakeEgHero<Name>.mjs`, in the reference's shape;
- its committed .fbx under `src/assets/egfrags/source/`, with its law and mesh halves beside it;
- its law registered in `net/eliteGates/egHeroFrags.js` and its mesh in `world/eliteGates/egHeroFragModel.js`.

- **THE FORGE GUT** (`egheroForgeGut`, kit `forge`, a passage, variant `forgegut`). Dagon's war-forges, built as a gut of
  riveted basalt ringed in iron.
  - *Its envelope*: `egFragPassage('forge')` from `EG_SLAG_LAW`.
    - The mouth and exit are 8.4 m wide and 6.5 m high (halfW 420, height 650), on the box's faces.
    - It is 31 m long (len 2800, plus the slag's 300).
    - Its landings are 0-6.8 m and 24.2-31 m along the course, under one 6.5 m clamp.
    - Its box is x -9.86 to 10.32 m, height -16.65 to 16.40 m (the rock mass's torn keel up
      to its chimneys), and 0 to 31 m along the course.
  - *Its place*:
    - Each end has a portal of ashlar framed in iron. A forge-eye of molten iron is set into the mouth's gable.
    - Ten iron ribs ring the gut, one every 3.1 m. The ashlar walls between them are pushed outward by noise, under a
      vault of rough rock that rises to 9.7 m.
    - A molten channel runs along each wall's foot, behind a 0.6 m kerb. Furnace grates glow between the ribs.
    - Four hearth bays are cut into the walls: a hearth with its anvil, a rack of blades, the Drop-Hammer's winch, and
      the alcove's niche.
    - The chasm drops 5.5 m to a river of molten iron. Over it stand:
      - the conveyors' beds: girders, rollers, drums and cog-wheels on iron trestles;
      - the slag weir, under its two crucibles' spouts;
      - hanging chains.
    - Six drop-hammers hang over the spots they strike.
    - Outside, the rock mass carries three chimneys glowing at their mouths, and hangs a torn keel.
    - THE EDGE LINE runs along the mouth, both lips and the exit.
    - Cost: 8,137 triangles in 7 draws (floor, brass, root, arena, edge, molten, pillar), on a 30-triangle proxy.
  - *Its law*: two fight floors, and one ceiling at 6.5 m.
    - Its course uses the kit's pieces (`EG_FRAG_PIECES.forge`): two conveyors and the cooling slag's crust
      (`EG_SLAG_STEP`). The conveyors are Rails 3 by 3 m, `amp` 200, on a 6 s cycle, in step. Each piece stands 2.8 m
      past the one before it.
    - THE TIMED SOLVER proves the course: crossFast 3,382 ms, crossSlow 4,882 ms, 4 moves. It stays proven at every slag
      phase, with every window at least 5.5 s in 12 and no wait past 2.7 s.
    - Its hazards:
      - the hammers, striking each landing's two spots in turn: r 3, told 1.4 s, each landing on its own clock;
      - the hammer line over each conveyor's middle, as the Forge Line has it;
      - the slag's two lanes, 4 m wide, `EG_SLAG_LANE_CM` either side of the course. Each runs from the crust's near edge
        onto 1.5 m of the far landing. The east spout runs half a cycle behind the west, on the crust's own clock.
    - Its places: Lurkers on each landing, a Battlemage's niche, the Drop-Hammer's winch (`engine`), the two spouts
      (`hazard`), and a seam alcove holding a shard.
    - Its lights: four, two band and two lava.
- **THE CLAN PIT** (`egheroClanPit`, kit `clanpit`, a chamber, variant `clanpit`, play `balcony`). The Wellhead's arena of
  honourable fights between clans, sunk in basalt.
  - *Its envelope*: `egFragChamber('clanpit', r, R)` at the Deepway's R of 16 m.
    - The pit's floor is that circle about (0, 18 m), open to the sky.
    - The court's 4 m bridge becomes its gates, 4 by 6 m, at 0 and 36 m along the course, through the south and north
      towers.
    - Its box is x -22.5 to 22.5 m, height -14.1 to 12.92 m, and 0 to 36 m along the course.
  - *Its place*:
    - The pit's wall is dressed basalt, 3.2 m high, with furnace grates.
    - Five tiers of grandstand rise east and west to an iron-capped parapet at 8 m. 165 Kyn stand on the tiers, with the
      clans' banners over them and braziers where the stands meet the towers.
    - The gate towers are 9.5 m high, battlemented and grated.
    - The chieftains' dais is a second fight floor, 3.2 m up (R 12 to 19, 22.5 degrees either way), on two stepped stairs.
      The box's wall and banners stand behind it.
    - The Honour Horn sits on the north tower with its bell over the pit. Its ring is set in iron at r 6 about the pit's
      middle.
    - A shrine niche in the west wall is the alcove. A torn keel hangs underneath.
    - Gold runs along the mouth, the exit, the dais's open front and sides, and the open end of every stair tread.
    - Cost: 5,614 triangles in 8 draws (all eight records), on a 212-triangle proxy.
  - *Its law*:
    - The pit and the dais are fight floors, joined by two ramps from 0 to 320 cm.
    - It has no ceiling, no hazard and no course. The kit has no pieces in `EG_FRAG_PIECES`; the Honour Horn is the hall's
      spot and the Ashfall is the crowd's.
    - Its places: five rifts by the walls, two Casters on the dais, three Lurkers, and a seam alcove holding a page.
    - Its lights: four band lights at the braziers.
- **THE OBLIVION CAVERNS, DEEP** (`egheroDeepCaverns`, kit `deep`, a chamber, variant `deepcaverns`, play `balcony`). The
  Wellhead's own magma caverns: wider, brighter, the magma higher.
  - *Its envelope*: `egFragChamber('deep', r, R)` at R 16 m.
    - The low floor is that circle: a basalt shelf 0.8 m over a lake of magma.
    - The court's 4 by 6 m gates run 2 m deep through the cavern's face at each end.
    - Two dry ledges stand east and west, 2.5 m up, from R 13 to 19.5, each on two stepped stairs. They are
      `egFragChamber`'s deep balconies: two, as section 11.2 names them, not the code-built three.
    - The clamp's ceilings are 9 m over the cavern and 6 m in the gates.
    - Its box is x -27.5 to 27.2 m, height -15.23 to 22.02 m, and 0 to 36 m along the course.
  - *Its place*:
    - A vaulted cavern of rough basalt rises to 16 m, pushed out by noise and coursed where the lake laps it.
    - Six lava falls pour into the lake. Four basalt columns and four stumps stand out of it, and stalactites hang
      overhead.
    - The Sluice's iron drum stands at the lake's edge.
    - The low floor carries its plates and an iron tide-gauge ring at 9 m. A 0.6 m kerb of dressed stone runs round its
      rim (section 11.9), and gold runs round every open rim.
    - The ledges' rock rises out of the lake.
    - The gates wear iron frames in a cliff of rock. The south gate's wall holds a niche, which is the alcove.
    - Cost: 4,258 triangles in 7 draws, on a 192-triangle proxy.
  - *Its law*:
    - The low floor and both ledges are fight floors. There are two gate floors (traversal) and four ramps.
    - THE MAGMA TIDE is a disc of r 16 m over the low floor, which covers it to within 15 cm at the gates' slivers. The
      ledges, 2.5 m up, are out of its bite.
    - The farthest point of the low floor is 14.5 m from a stair, inside the 24 m that the tide's 5 s tell allows.
    - It has no course.
    - Its places: five rifts, a Caster on each ledge, three Lurkers, the Sluice (`engine`), and a seam alcove holding lumen.
    - Its lights: four, two band over the ledges and two lava at the falls.

**THE AUTHORING KIT** (`tools/egHeroKit.mjs`). I appended one block at its end, using names no other band's shapes share:
shapes at least two of the three scenes use, and the helpers under them:
- `planeFace`, `boxFaces`: faces that carry their own Newell normals, so the writer's hypotenuse never reaches the bytes;
- `walkEdge`, `levelDisc`: the markers;
- `ringBand`, `ringWall`: tiers, the dais, rims and walls on the fixed rings;
- `earcut`, `levelPolygon`: a notched floor's art, its marker and its proxy;
- `rockFaceLoops`, `rockEllipseAt`, `rayHit`, `outlineLoops`, `rockFace`, `rockHull`: a rock mass round a mouth, with its
  face and its keel.
Every number in the block and in the scenes comes from IEEE arithmetic and `Math.sqrt` alone.

**Departures, said plainly.**

1. **Written in code, not modelled in Blender.** Every surface is a shape from the kit or a scene: grids pushed by hash
   noise, lathes, sweeps, boxes and ring bands. So there is no sculpted detail beyond those shapes: no worn edges, no carved
   reliefs, no organic Kyn (the crowd is 165 boxed figures), and no hand-painted UV islands. The pictures are the band's
   code-painted records, at a planar tile every 2 m.
2. **The files name the reference's writer.** Each .fbx is written by `writeRefFragFbx`, so its SceneInfo and Creator name
   `tools/egRefFragScene.mjs` (`FRAG_REF_WRITER`). That is the only non-Blender name the bake accepts, and the bake was not
   to be changed. The mesh half's `creator` names the same writer.
3. **The Forge Gut's gaps are 2.8 m, not the code-built 3.2 m.** At 3.2 m the timed solver passes only at a few rail
   phases, with waits near 4 s. At 2.8 m it proves at every slag phase, with no wait past 2.7 s. The landings grow to 6.8 m
   deep instead of 6.2 m; the length is unchanged.
4. **The chambers' radius is chosen, not the halls'.** The halls call `egFragChamber` at R 14 m (a proving court), 16 m (the
   Deepway) and 22-26 m (a Rift-Yard). The heroes take the Deepway's 16 m and run 36 m from mouth to exit: the disc's 32 m
   plus 2 m gates. The code-built chamber's bridge and disc take 36.5 m. Whether a slot fits them is the laying's call.
5. **The deep Caverns has two ledges where the code-built deep chamber has three.** Section 11.2 says two. Two still keep
   the 24 m rule, at 14.5 m. They stand 2.5 m up but are deeper (R 13 to 19.5) than the code-built r 4.5 discs.
6. **The Honour Horn's ring is art only.** The record has no anchor word for it. The ring of iron sits at the pit floor's
   middle, (0, 18 m), where the code-built chamber's `horn` spot stands. The laying places the spot.
7. **The chambers carry no inner course.** `EG_FRAG_PIECES` names none for the Clan Pit, and the code-built deep chamber
   lays none, so their proofs are nought.
8. **Never drawn by the game.** I looked at each mesh in a software rasteriser with the band's own painted records (scratch
   tooling, not committed): from the mouths, from above, cut away under the clamp, and from the floors. None was drawn in
   the port's renderer or under its lights. So it is not verified whether the in-game lights light the Wellhead's dark
   basalt as well as the molten does.

**The four hosts.**
- `src/scenes/exterior.js` - untouched.
- `src/scenes/world.js` - untouched.
- `src/scenes/worldModes.js` - untouched.
- `src/scenes/dungeonContext.js` - untouched.
At this slice no host drew a hero. It was merged in the same merge as EG-HERO-LAY, whose spec law 7 lays it: the hero
rides the circle's one mesh and collider bucket through `scenes/worldModes.js`'s existing path, and the hosts stand as
that record's four hosts say.

**Pins.**
- `test/tooling/eghero_wellhead.test.js` (10 tests) holds, for each fragment:
  - its scene to its .fbx, and its bake to both halves, twice;
  - its spec and the registries;
  - its envelope, by deepEqual;
  - the Forge Gut's proof at every slag phase;
  - its signature;
  - its budget, and the proxy's floors matching the law's by area;
  - THE EDGE LINE on every open edge that falls away (4, 6 and 38 of them);
  - no drawn vertex inside a floor's envelope, an inner piece's travel, or the air over its gaps;
  - its walk graph over floors and stairs only, and its anchors counted;
  - its scene and the kit's block free of transcendentals.
- `tools/mutants/eghero_wellhead.json`: 25 mutants, every one dead.
- PIN MOVED: `test/net/eliteGates/eg6c_law.test.js`'s registry pin now holds the reference as the first key, not the only one.
- `test/tooling/doctrine.test.js`'s allow-list names the nine new files.
- `RELAY_VERSION` stays `world199`. On its own branch no relay import reached `net/eliteGates/egHeroFrags.js`, so the relay's bytes
  did not move. Merged onto EG-HERO-LAY, its three law JSONs joined the relay's graph with the other heroes' (that
  record's "The relay's bytes"). `ACCOUNT_VERSION` stays `acct124`. `EG_SPEC` and `EG_LAWS` were unchanged by this slice.
- The Port-Ledger's ELITE-GATES row names the new files.

### After AUDIT EG IV - 2026-10-14 - THE MERGE OF MAIN #880-#899, AND WHAT CI'S WHOLE GATE FOUND

Two commits came after AUDIT EG IV (`01-Overview/audits/Audit-EG-IV.md`) and before AUDIT EG V. This note records what each
one changed in the arc.

- **The merge of main #880 to #899** (a43a033e63):
  - main's REVIVE took `acct132` and SEAT-FACTS took migration 0112, so the arc ships as `acct133` and
    `0113_elite_breach.sql`. The relay stays `world201`, because main's is still `world200`. Every version pin, the
    wrangler.toml line and the mutant records aimed at the version line moved to `acct133`;
  - SCHOOLS3 and EG15 had both moved the one magicka gift into `systems/playerHeal.js`. Main's `manaMine` is its one home
    (ONE EXPORT), and the Battlemage's Discipline (`systems/sigil/sigilSetPowers.js`) returns its magicka through it.
    `eg15_panoply`'s pins and its EG15-return-share mutant were re-aimed (`11-Multiplayer/Sigil-Sets.md` EG15);
  - main's AOE-PERF lays a path's telegraph on a strip of its own. The Spire's per-floor draw keeps a fight floor's own
    triangles for it, pinned in `egz_telegraph` with EGZ-floor-no-strip (EG-ZG's record);
  - `egz_telegraph` and `eg15` were run on the merged tree: 166 dead, none survived.
- **What CI's whole gate found on the merged head** (9a862e8d). CI had not run the whole suite on the arc since AUDIT EG
  IV and EG-HERO-LAY, because the pushes in between conflicted with their base and ran no workflow. Its first run found
  three pins those slices had left unmoved:
  - `.github/workflows/account-deploy.yml` did not list `net/eliteGates/egHeroFrags.js` and its eleven law tables, which EG-HERO-LAY's
    `net/eliteGates/egLaw.js` brings into the account Worker's bundle. Its path filter now lists them (`test/server/accountdeploy.test.js`
    ACC1-CI);
  - AUDIT EG IV's `none` refusal (*The Spire took no key for that.*, `account.refusal.none`) was missing from the
    catalogs. It is now in the English catalog (`tools/l10nExtract.mjs`), and drafted in-session for the thirteen whole
    catalogs (`tools/l10nInSession.mjs`, recorded as the machine's);
  - `test/net/gate/auditwbx2.test.js` M9: the hub's one cursor read carries AUDIT EG IV's `sweep:egcall`, an eighth cursor, beside
    EG-ZA's `sweep:egrc` (PIN MOVED).
- **The four hosts**: `scenes/world.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js` were
  not touched for the arc. The merge resolved no conflict in any of them, and 9a862e8d touches no `src/` file.

### EG-ROAR - 2026-10-18 - THE SCORE ROARS, AND THE SPIRE'S AIR

Mac: "I think the music and ambience of the elite breach needs to be insanely better. Its way too tame".

**What was tame, measured.** Two things. THE VOICE: the FM bank plays one oscillator pair a note and one sine or band of
noise a drum (`systems/gmSynth.js`), so a brass section was one thin player and a taiko a sine blip. THE WRITING: the halls'
drums were a low tom every other bar under whole-note pads, and `tools/egScoreProbe.mjs` read every second of SPIREGAL at
the same loudness, -19 dBFS. In a 20 s render of each song the onsets stood at 0.9 to 2.1 a second, the stereo image at
0.12 to 0.15 (side over mid), nothing over 4 kHz. And there was no ambience at all: the Spire's "band's ambience alone"
was DFU's dungeon drips and doors (`systems/ambientEffects.js`), a crypt's, over halls hung in the void.

**What shipped.**
- **A song's own voices** (`systems/song/songPlayer.js`): `songVoices`, `songKit`, `unisonCents`, `VOICE_RANGE`,
  `KIT_RANGE`, `SONG_FLOOR_HZ`, `SongPlayer._drumLayers` and `_makeFloor` (INTRO3c, 2026-10-24: the bowed voice `_bow`, a
  channel's `_insert`, `_vibrato`, `_breath`, a song's `_routeTone` - `10-UI/UI-Arc.md` INTRO3c) - unison pairs as loud as the one pair, a sub, a
  spread laid either side of the channel, a drum's click and body, a bend keeping the spread, and THE FLOOR, a 30 Hz
  high-pass under a voiced song before its press (a 1:1 FM pair's first lower sideband lands on 0 Hz; a quarter of the
  spiccato's energy stood under 40 Hz, and the press answered it by pressing the whole song). Every song MIDI.BSA holds
  carries neither and plays as before (`08-Audio/Audio.md` EG-ROAR).
- **The score rewritten on them** (`systems/eliteGates/egScore.js`): `SPIRE_VOICES`, `SPIRE_KIT`, the channels `trem`,
  `swell` and `chant` (programs 44, 119 and 53 on channels 13 to 15), the spiccato, the chant, the shrieks, the harp's
  ripple, the braam, the swell (`SPIRE_SWELL_S`, 1.7 s to its downbeat), THE LEGION'S DRUMS at four drives with hats and a
  shaker, the count's clock; each song in rising parts (section 26). The names, tempos, lengths, motifs, the priority
  table and the host are unchanged. The press's attack 12 ms (from 3) and its ratio 3 (from 4); the Valkynaz's `out` 6.3
  (from 5.9 - its quiet first tier stood 0.3 dB under the second phase in the probe).
- **The Spire's air** (`scenes/eliteGates/egAir.js`, section 26): `buildSpireVoid`, `buildSpireDrone`, `buildSpireBand`,
  `buildLordBreath`, `egAirEvents`, `egAirMoment`, `createEgAir`; played by the breach client from the score's own place
  (`scenes/eliteGates/egClient.js` - `air.frame` in the Spire's frame, `air.stop` on every way out the reverb is and on
  `away()`). The made sounds are built one a frame (10 to 20 ms each in node), the void and the drones at 11,025 Hz. The
  Hour's `layBed` is exported for it (`scenes/superDungeon/sdAir.js`, its one home).

**Measured** (`tools/egScoreProbe.mjs`, all four bands, 25/25 each): the war by phase -15.6 / -14.5 / -13.5 dBFS, the
count -13.6, the Valkynaz -14.4, the halls -19.4 and the hymn -18.1 under them, every peak under the ceiling, the end
decaying to -48 dBFS inside its time. Over the same 20 s renders (the Galleries): onsets 3.2 to 8.0 a second in every
song but the end's and the hymn's (from 0.9 to 1.9), the stereo image 0.22 to 0.32 (from 0.12 to 0.15), the spectral
centroid up 12 to 56% in all but the hymn's. The press still holds the loudness level second by second (a 2 s window
moves 1 to 2 dB through the trial's break and height); the parts are heard in their density, not their level. The air could be heard here only in part - no DAGGER.SND stands in this tree - so its beds of synthesis and the
legion's horns were rendered; its DAGGER.SND voices and events are pinned in node and owed an ear in the field.

**Pins.** `test/systems/eliteGates/egroar_score.test.js` (the voices' law and graph, the Spire's songs voiced, the
writing) and `test/scenes/eliteGates/egroar_air.test.js` (the beds, the events, the moment, the seam, the wiring), with
`tools/mutants/egroar.json` - 33 dead and one equivalent recorded with its reason (the guard against a note before the
first bar, which no song reaches). PINS MOVED: the drip pins of `test/world/gate/wb6b_deadlands_life.test.js`,
`test/scenes/arena2_hosts.test.js` and `test/world/superDungeon/sd5a_realm.test.js` take the Spire beside the court and the
Hour (the last two found by CI's whole gate), and `tools/mutants/wb6b.json`'s record its new line.

**The four hosts.** `scenes/world.js`, `scenes/worldModes.js` and `scenes/exterior.js` untouched; `scenes/dungeonContext.js`
one condition on its drip line (`&& !_egHall`), no line added (HOST-SPLIT). The air is wired in the breach client, a module.

**The Ledger.** Section A's ELITE-GATES row names `scenes/eliteGates/egAir.js` and the silenced AmbientEffectsPlayer; the
GM VOICE BANK row names a song's own voices.

**Departures from this page**: none from its law. THE COUNT, the wake and the end are timed as before; the Valkynaz's
level moved (above).


### EG-PERFECT - 2026-10-18 - THE LORDS' BLOWS FAIR AND WHOLE, AND SPEC LAW 10: THE BROKEN WAY

Mac: "On top of this work lets do a detailed pass on the Elite Breaches. I want to ensure the boss attacks, the design of
the halls, and everything is absolutely perfect. Traversing between sections should present a challenge, platforming should
be detailed". Four read-only audits came first (the boss attacks, the hall design, the spans and the traversal between
sections - 20,000 halls laid, the real motor on the real collider), then the fixes in three parts: this record (the lords,
and the halls' draw as spec law 10), THE HALLS AS THE RELAY READS THEM and THE WAYS AS PROVEN (the two records after it - the
relay's and the screens' reads of laws 4-9, no draw moved).

**THE LORDS** (`net/eliteGates/egLords.js`, `egBodies.js`, `egFloor.js`; the screens' `scenes/eliteGates/egFight.js`,
`world/eliteGates/egTelegraph.js`, `ui/eliteGates/egSpireHud.js`). Each finding of the boss audit, fixed where it stood:
- THE UNION FLOOR (section 13.2) sees what it missed: a haven CHECK is a landing of the set (`egHavenCheck` - a member in the
  only near haven is never thrown a blow that takes it before the CHECK lands); the pool a pending blow leaves and a blow live
  past its landing (`sp`) burn at every later landing (`egUnionHeld` - `F.mem.pools`, a new blow's own pool its `nextBurns`);
  a duelist's floor is its ring (`EG_RING_KEEP_M` inside it). A lord weighs a blow as its word will be weighed before it
  chooses it (`wouldHold`, up to `EG_CHOOSE_TRIES` draws, then it walks) - Ilthys had thrown eight Meteors at a member on a
  balcony, each held and dropped.
- A feint's cut says its own instant (`ecut`'s `at` - `egCut`; the screens close it there) and never glints; fury's chained
  blow is said only with its first (`after` - held while its first waits).
- Every phase a burst of damage crosses is turned in that beat, each turn's card and kit call in order (a burst past two lines
  turned one a beat before, its second skipped); a held line is set only while the health stands above it.
- THE VALKYNAZ' SIGNATURES at their second phase (section 13.4 - the page's "at the phase turn"), the line held until the
  signature's first round resolves (`sigHolds`): the Conquest's banners planted in turn (`EG_CONQUEST_EVERY_MS`, each told
  `EG_CONQUEST_TELL_MS`), each third burning to the fight's end until its banner breaks, again `EG_CONQUEST_AGAIN_MS` after
  a round; the Chaining's pairs, a Wraith's chain snapping on the pair it names (`EG_SNAP_NM`); the Eclipse's mirrors. Garoth's
  third phase borrows the older signature as theirs is called.
- Blows that read their ground: Hellfire, Moonshatter and the Meteor fall on members drawn from the whole company (its target first, the rest at random - a company no larger than the blow's marks takes one each); the Wyrm's
  perched breath reaches its mark (`EG_WYRM_REACH_M`), its pillars rise again at its second phase (`perches`), its Burning
  Perch the place's own fire (`o.place` - never held); a Scorch stops Grath's hunt and frees its mark; an island's crack voids
  it as it falls; the Last Lesson's rings told `EG_LESSON_TELL_MS` before they burn; the Twins swap only on the Crossing said
  (`EG_CROSS_AGAIN_MS`); a vanish ends the Stalker's swing; every kit's place drops a stale run (`kitPlace`); a run carried
  from its landing at its lane's pace (`EG_RUN_MS`, under `EG_RUN_V_MAX` - the wire's walks stop at 30 m/s); a duel's blows
  aimed at its duelists (`duelNo` - the gate's Slam, the Meteor and Kyn's Due stand aside); Grath's Gore alone at melee
  (`minGap1`).
- The screens: the wind-up's grace a trial beat and more (`EG_WIND_GRACE_MS`); the Armsmaster's guard glints once a rising
  (`EG_GUARD_GLINT`, `EG_GUARD_SOUND`); the Wingbeat's lane told 1 s (`EG_GUST_TELL_MS`, `EG_GUST_SOUND`); Seyth's own Eclipse
  dark, chipped and tolled as a hall's is (`egEclipseOfBlows`, `EG_ECLIPSE_BLOW_LIVE_MS`).
- The audit's upgrades taken: the Arcane Lattice a SWEEP (`EG_LATTICE_W` strips side by side over the whole floor, each
  `EG_LATTICE_STEP_MS` after the last, from the side farthest from its mark - the four fixed strips left 4 m gaps never
  struck); THE FINAL EXAMINATION again `EG_CAGE_AGAIN_MS` after the last resolved (it closed once a fight); Garoth's Wellfire
  laid over its mark, one arm along his bearing (the axes' cross about himself struck only who stood on the axes). Left for a
  later slice: a feint-Lunge, Grath's burning trail at two members and under, the Colossus's flank stamps, a champion's
  escalation by rank.

**SPEC LAW 10 - THE BROKEN WAY** (`bible/11-Multiplayer/Elite-Gates-Ascent.md` section 11, which states the law; `net/eliteGates/
egAscent.js` EG_BROKEN_LAW, `egLaw.js`, `egSpanLaw.js`, `egFragLaw.js`; `egDurable.js` EG_LAWS from 2026-10-18 - law 4's seventh
day, so laws 4-9 stay kept). A bridge the way takes breaks onto its band's pieces in every heading (a turned course read in
its heading's own frame - `egStepLocal`, `egAlongOf`, `egRouteSpanSteps` along x, the sweep's pilot turned with it); THE FORK's
Low Road linked by its own spans and its course laid first and bounded (`EG_FORK_COURSE_CM`); the plan's own tries
(`EG_BROKEN_TRIES`, `lean`) and a stretch's rooms fewer before a hall is laid again; a fight hall's rooms before its trial and
its door after it (the relay holding its clocks until its company stands on its floor - `egTrialAwaits`, `EG_AWAIT_CLOCKS`;
its closing's walk from its trial's own ground, a broken bridge's never - `egTrialEndAt`); two of its band's kinds an approach;
THE ENVELOPE in the passages; a Drop below its road's floor (`EG_DROP_LAW10_CM`); the High Road's padding Beats; Rails apart
through their travels, the Forge's one belt, a Pendulum over the whole flight (`EG_SOLVE_FLIGHT_LAW`); the fittings where a
body reaches them (an alcove at its court's rim and its ring open there - `egRingSideOpen` in every reader of a ring; a
balcony 4 m up; a pillar off its bastions, its Gauntlet plate on its top; the winch plates against the walkway; a Glade's
braziers on its ground; a Captive's chains on its hero chamber's line; a Vault off its island's rim or a side span's length
off its court); rooms from the whole fresh pool.

**Measured** (at the audit's head - the EG-PERFECT audit record below). Over 204 halls (seeds 1-6, every third hall) against
law 9 on the same: the longest stretch the main way walks unbroken, at its median, a Rift-Yard 400 m to 173 m, a span 181 to
124, a Court 254 to 164, a Proving Walk 192 to 177, a Deepway 249 to 142, an Athenaeum 263 to 207, a Brink 237 to 95, a Rampart
269 to 176; spans from circle 2 forked 25% to 96% and laid plainest 75% to 4%; a fight hall's door 190-215 m past its trial to
10 m. Over the law pin's 800 halls: none laid plainest, 756 break a bridge turned, the longest unbroken walk a median 164 m
(p90 232), the worst spec 29,598 characters (a try past EG_SPEC_SAID_MAX, 32,768, is laid again). The real motor crosses
seed 77's first circle and seed 3's seventh, turned bridges and all (`tools/egSpanSolve.mjs`), and every one of the 692 roads
of 100 circles (seeds 3, 4, 5 and 77's circles 1-20, and seed 77's on ground 4).

**Pins.** `test/net/eliteGates/egperfect_lords.test.js` (21 - each lord finding and upgrade on fights the real producers stand),
`test/net/eliteGates/egperfect_broken.test.js` (12 - law 10's pin, its 400 halls of the law pin's seeds 77 and 3 laid, proven and
measured, the real motor) and `test/net/eliteGates/egperfect_broken_unit.test.js` (6 - each law 10 change on a hall or two that shows
it and on its pieces alone). Mutants: `tools/mutants/egperfect_lords.json` (47) and `tools/mutants/egperfect_broken.json` (30),
every one dead. PINS MOVED: the law pins of `egaudit3_law`, `egaudit5_f`, `eghero_lay`, `egz_frag` and `egdur_relay` (spec law 10
the build's, law 9 kept); `law9_rooms` holds law 9 by the seam (`egLawSeam(9)` - its 800 halls hashed as before); `egHallTry`'s
law unnamed is the seam's, as `egHallOf`'s. The lords' pins moved with their findings: `egaudit3_client_fight`, `egaudit3_lords`,
`egaudit4_legion`, `egaudit4_lords`, `egaudit4_lords_errands` and `egaudit5_b` (a lord at 0.6 of its health, so a signature fires at
the second phase; the Clan Muster's cards; Burning Perch said at once; the perches risen; the Last Lesson's tell), each with its
PIN MOVED note. Under law 10 the suite's pins measured on law 9's halls name law 9 and its sweeps run over law 10's own
(Elite-Gates-Ascent.md section 11, "The pins under law 10"); forty-four mutant records the change moved were re-aimed BY CONTENT
(`eg5`, `eg6a`, `egaudit3_law`, `egaudit3_lords`, `egaudit4_lords`, `egaudit5_b`, `egaudit5_f`, `egfrag`, `eghero_lay`, `egint`,
`egspan`, `egz_frag`, `egz_lords`, `egz_state`, `egz_telegraph`, `law9_height`, `law9_proofs`, `law9_rooms`, `soc1`): each applies
again at one site and still dies.

**The relay.** `net/eliteGates/egLords.js`, `egBodies.js`, `egBrain.js`, `egLaw.js`, `egAscent.js`, `egSpanLaw.js` and `net/wire.js`
are in the relay's bundle: `RELAY_VERSION` moves to `world219` (`world218` on its branch, renumbered past GRANT2's `world218` at the
merge; its `LAW` row in `test/net/relayversion.test.js`, re-hashed in place
while unshipped). The wire's additions are optional and bounded: `ecut` carries the instant its feint was cut at (`at`), the
stage's say set gains `perches` (the Wyrm's perches risen at its second phase), `sg`/`st` carry a routed tube's `tm` (the ways
record below) - an old screen ignores each. A breach records its law (`egv`) and draws its own: a law 9 breach open at the
deploy runs law 9's halls to its end. The deploy order is the relay's, then the client's.

**The four hosts.** None touched by this record (HOST-SPLIT): the law in its own modules, the relay's await in the brain's wake
and trial, the pilot's frame in the tool (the ways record below names its one line in `scenes/world.js`).

**The Ledger.** Section A's ELITE-GATES row names EG-PERFECT: the lords' blows and spec law 10 (EG_LAWS).

**Departures from this page**: section 8.2's "18 platforms in four sections" and 8.9's Brink of 132-151 m were law 8's (law 9
and 10's ways run 300-640 m); section 8.6's approach is two of the band's kinds; section 13.4's signatures stand at the second
phase as section 13.2 asks; section 13.4's Conquest plants its thirds in turn and burns each to its banner's fall.

### EG-PERFECT (the halls) - 2026-10-18 - THE CLOSING'S WALK, THE FIGHT FLOOR, THE CHAINS, THE STANDS

EG-PERFECT (2026-10-18; the owner: "I want to ensure ... the design of the halls, and everything is absolutely perfect").
An audit swept LAW 9's halls as the relay reads them. Five findings were measured, four were fixed, and the fifth was
audited and pinned. No hall is drawn otherwise: `egHallOf` gives the same bytes for laws 4-9, and `egaudit5_f` and
`law9_rooms` still pass. The relay reads the halls differently, and that is all. RELAY_VERSION moves with the arc's (section 23).

- **THE CLOSING'S WALK** (section 7's stages, section 17.1's cache). THE ASCENT lays a fight hall's door far past its
  trial's end along the way. Over 500 halls the median from the trial's end to the door was 177 m for a Rift-Yard, 188 m
  for an Athenaeum and 243 m for a Rampart. The closing after a fight stayed `EG_CLOSING_FIGHT_MS` (20 s), so the door was
  out of reach in 76-100% of those halls and in 88% of Proving Walks (on their 45 s). The cache can be taken only in the
  closing (`cacheStep`), so it was lost, and the pull came before the company reached the door.
  - A door that a trial's end opens now closes, in a hall laid as a way (`egRouted`), in `EG_CLOSING_FIGHT_MS` plus the walk
    from the trial's end to the door. The walk is timed at THE SPAN BUILD and multiplied by `EG_CLOSING_WALK_X` (1.25), and
    the result is rounded up to the whole second (`egBrain.js:"export function egClosingMs(spec) {"`).
  - The trial's end is the last node of road 0's path that stands on the hall's first course's own ground, 0.5 m about
    (`egBrain.js:"export function egTrialEndAt(spec) {"`). For a Rift-Yard that is its court, for a Rampart its walk, for an
    Athenaeum its lock, for a Scriptorium its court and for a Proving Walk its champion's court.
  - The walk is road 0's legs from there by each kind's law (`egRouteSolved`,
    `egBrain.js:"export function egClosingWalk(spec) {"`). Before a climb, it waits back the grip the last climb spent, as `egRouteCross` does. Each timed
    pair of a span leg is counted at `EG_WAIT_MAX`. Only +, -, x, / and the square root are used, so the relay and the pins
    get the same answer on every engine.
  - The closing's end is said with the stage word, its `su`, which every screen counts
    (`egBrain.js:"B.su = now + egClosingMs(spec);"`).
  - The doors that an arrival opens are unchanged: a span's, a Brink's and the Deepway's close in `EG_CLOSING_SPAN_MS`,
    because the company stands at them. Laws 4-8 keep the closings they had: a Proving Walk 45 s, every other fight 20 s.
  - Seed 1's hall 1 (a Rift-Yard, its door 244 m past its court) now closes in 76 s, and hall 4 (a Rampart, 192 m past its
    gate) in 71 s. Over seeds 1-20, circles 1-8, LAW 9's fight closings run 26-142 s for a Rift-Yard (median 63), 54-115 s
    for a Rampart, 45-90 s for an Athenaeum and 62-174 s for a Proving Walk, which is never under the 45 s it had. THE
    ESCAPE BUILD reaches the door inside the closing from the trial's far side in every such hall of seeds 1-2, circles 1-6.
    The count is held after `EG_CLOSING_COUNT_MS` of the closing (`egCountHold`), so a longer closing costs the company no
    count.
- **THE DESERTER ON THE COURT** (section 8.7). The relay raised the Deserter at `spec.fight.z - spec.fight.r + 3`.
  `spec.fight` is the fight floor's bounding disc, and its `r` is half the box's diagonal (a court disc's R x 1.41). The spot
  therefore stood 7-14 m past the court's rim in every Deserter hall of seeds 1-60 (all eleven under LAW 9, all eight under law 8): on the
  bridge in, or off every floor (seed 38's hall 16, seed 46's hall 86). It now rises on the fight floor, 1 m in, at the
  point nearest that spot
  (`egBrain.js:"egKeepOnFight(spec, spec.fight.x, spec.fight.z - spec.fight.r + 3, 1)"`).
- **THE ASHFALL IN THE PIT** (section 11.2's Honour Horn). A foul horn's Ashfall threw its pools about the same bounding
  disc. That put 15-34% of them past a kit or hero Clan Pit's rim and about 80% past a Deepway's, whose bounding disc
  covers its whole hall. The pools are now thrown about the fight piece under the horn and kept on it
  (`egBrain.js:"const pit = egFightPieceAt(spec, at.x, at.z, 0, spotY(spec, at))"`). A disc Pit's pools stand whole on
  it.
- **THE CAPTIVE'S CHAINS ABOUT A HERO CHAMBER** (section 8.7). LAW 9 lays a hero chamber's three chains about the hall's
  origin line, so where the way turns the chamber aside they hung off every fight floor (seed 40's hall 66, seed 6's
  hall 22, seed 60's hall 99). The relay now takes the law's three only where each hangs on a fight floor at its own
  height (`egBrain.js:"three.every((q) => egOnFight(spec, q.x, q.z, 0, spotY(spec, q)))"`). Otherwise it hangs them about the chamber's court: the fight polygon under its chamber's spot, or else
  the hall's widest, centred on its box, a quarter of its narrower side out, each kept on it. Over seeds 1-40, 55 halls
  keep the law's three byte for byte and 2 are refused, and in every one of the 124 Captive halls each chain hangs on
  the fight ground. Laws 4-8's chains are unchanged (`law9_route`'s 450 halls).
- **A CHAMBER'S CASTERS ON ITS RAISED ANCHORS** (sections 11.4 and 11.7: "Casters stand at `anchors.caster`"). The law
  lays a kit chamber's caster anchors on its balconies (3-4 m up, 2.5 m for the deep tide), and a hero's records name
  theirs on its galleries. The relay read none of them. It now lays them as the fight's stands at the wake
  (`egBrain.js:"export function egCasterStands(spec) {"`). Each stand is an anchor of a chamber fragment (never a
  passage's) and carries:
  - the anchor's plan, `x` and `z`;
  - its raised floor's height, `y` (`egFeetAt`);
  - the height its spot names, `ov` (the floor a kit balcony overlooks);
  - its chamber's reach, `box`: a hero's own box, or else the kit chamber's court and balconies, 1 m under its floor to
    5 m over.

  A Caster that rises in that chamber takes the nearest free stand there
  (`egLegion.js:"export function egStandFree(F, x, z, y = NaN) {"`) at the raised floor's height, pinned to it as a Rampart's Caster is to its pillar. Where every stand is
  held, or the Caster rises outside the chamber (a Vigil's escort on the arrival plate), it rises at its wave's spot.
  These are the same bodies the waves raise, so THE LEGION'S CAP holds. The Bolt (r 3, THE WIDTH RULE) lands at its
  mark's feet on its mark's floor (`egStoreyY`). A stand 4.0 m up is a storey apart by `EG_STACK_M`, and it still bolts
  the floor its balcony overlooks (`egLegion.js:"const overlooks = (m) =>"`). Over seeds 1-6, every one of the 78 stands
  stands on a fight floor inside its own reach, and every Rift-Yard's rifts, Deepway's chamber spot and Proving Walk's
  champion lie in a stand's reach. No arrival plate lies in one. Laws 4-8 stand their Casters on the balconies too, read in
  plan.
- **THE GAUNTLET'S PLATES** (section 8.3). This finding was audited and nothing was changed. Each plate stands 5.5 m out
  from the walkway's line. That is 3 m up its pillar's side stair (0.6-1.3 m high there), off the pillar (its rim 7-15 m
  out) and off the fight floor. The relay reads a pose of any member in the hall within `EG_TOUCH_M` of the plate in plan
  (`egBrain.js:"const pl = g.p.plate, on = pl &&"`), so a member on the stair holds it. That read is now pinned.

Pins: `egperfect_halls_closing` (3), `egperfect_halls_floor` (2), `egperfect_halls_chains` (2), `egperfect_halls_casters`
(3) and `egperfect_halls_plates` (1). The mutants are in `tools/mutants/egperfect_halls.json`: 20 records, 19 dead and one
equivalent as recorded. That one is EGP-closing-grip-unwaited: before a climb, the closing's walk waits back the grip the last
climb spent, as `routeCrossAt` does, but no LAW 9 closing walk climbs again inside its grip's recovery (twelve walks of two
climbs over seeds 1-12, none waits), so no pin can fail it. Of the three older records this slice moved, two were re-aimed by content: `EGA3L-fade-caster` (the Caster's storey filter
now reads its overlook) and `EGA5A2-captive-law-ignored` (the law's three now read). The third, `EGA4L-mingled-unread`, was
kept in place by laying the stands after `F.still`. All three still die.

RELAY: the slice changes `net/eliteGates/egBrain.js` and `net/eliteGates/egLegion.js`, both in the relay's bundle; the relay's
version moved with EG-PERFECT's (the EG-PERFECT record above).

HOSTS: none touched (`scenes/world.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js`, `scenes/exterior.js`). The new
behaviour lives in the brain's own functions (`egClosingMs`, `egCasterStands`, `egStandFree`), and no Room method changed.

### EG-PERFECT (the ways) - 2026-10-18 - THE WAYS AS PROVEN: THE LEAP, THE TUBE'S CLOCK, THE VOIDS, THE TOLL'S ROOMS, THE VENT, THE PENDULUM, THE HANG

Mac: *"I want to ensure the boss attacks, the design of the halls, and everything is absolutely perfect. Traversing between
sections should present a challenge, platforming should be detailed"*. The audit that followed walked LAW 9's halls with the
real motor and the relay's judge side by side and found seven places where what the screen did, what the relay judged and
what the law proved had come apart. No hall's DRAW moved: spec laws 4-9 lay every hall to the byte they did (the goldens -
`test/net/eliteGates/egaudit5_f.test.js`, `test/net/eliteGates/law9_rooms.test.js` - green); what changed is how the relay and the
screens READ them.

Daggerfall Unity is the reference for the motor alone (AcrobatMotor's plain jump); DFU has no running leap, no Spire, no
relay. The one departure this record names is from our own enhanced climb (CLIMB3), not from DFU: in the made levels whose
ways are proven gap by gap, the running leap is refused and the press is DFU's plain jump again.

**What shipped, by piece.**

- **THE RUNNING LEAP REFUSED ON THE PROVEN WAYS** (`src/systems/madeLevel.js` `runLeap`; `src/scenes/shared.js` `parkourDeps`'
  `leap`; `src/player/motor.js:"_pkMayLeap() { return !this.slowFalling && !this.onExteriorWater && this.parkour?.leap?.() !== false; }"`).
  - The enhanced climb is forced on online (`systems/features.js` `enhanced-climbing`, `scenes/shared.js` `parkourSwitchOn`),
    so a running Jump within `PARKOUR_RUNLEAP_EDGE` of an edge became CLIMB3's running leap (`_pkRunLeapSpeeds`): ~3.9 m at
    Jumping 0, ~8.4 m at Jumping 100 - past the platform THE TIMED SOLVER proved THE SPAN BUILD's plain jump lands on. The
    sweep with the online page's parkour on every frame and the leap allowed: 50 of 308 courses not crossed (11 seeds a
    band); with it refused: none.
  - The made level's law gains `runLeap: 'refused'` on the Spire's row and the Hour's (its Unmoored Steps are the Spire's
    pieces' own record, proven with the same plain jump, and its online page forces the same lane); the court has no course
    and keeps the leap. The one door is the motor's `_pkMayLeap` - the leap at the edge and its late press
    (`PARKOUR_COYOTE_S`) both ask it - through the four hosts' one parkour deps
    (`src/scenes/shared.js:"leap: () => madeRuleHere('runLeap') !== 'refused',"`). Refused, the late press is the made
    level's own forgiveness (`latePress`, section 10.8): the plain jump. The wall run, the mantle, the vault and the free
    climb are untouched (a Riser is still run up at Climbing 0).
  - THE ONE CONSTRUCTION SEAM's sweep (`test/systems/eliteGates/egmade_law.test.js`, THE SWEEP) reads the new door:
    `parkourDeps` is the rule's reader, and asks no made level itself.
  - THE SWEEP'S PILOT (`tools/egSpanSolve.mjs` `pilotOf`) now crosses with the online page's parkour on in every frame, as
    the game does - it had it on for a riser and a climb alone, so it never met the running leap - with the leap refused as
    the Spire refuses it (`tools/egSpanSolve.mjs:"const parkour = { enabled: () => true, leap: () => madeLevelRule('spire', 'runLeap') !== 'refused',"`).
    At the branch's head, 3 seeds a band (every fix below in): 20, 19, 23 and 21 courses, every one of 83 crossed.
- **THE COLLAPSING TUBE'S CLOCK IN A ROUTED HALL** (`src/net/eliteGates/egFair.js:"export function egTubeEdgeIn(spec, hw, tm, tMs) {"`;
  section 11.3).
  - Its fall began a fixed `EG_TUBE_START_MS` (18 s) after the hall's wake (`net/eliteGates/egFragLaw.js` `egTubeEdge`) - the
    slowest fair arrival at a mouth a straight run from the plate (laws 4-8). LAW 9 stands the mouth 34-82 s of THE SPAN
    BUILD's fastest walking along THE ROUTE: in 13 of the 14 routed tubes of seeds 1-14 the mouth was already gone at the
    fastest arrival, and the hall could not be finished.
  - In a routed hall (`egRouted`) the tube now falls from the instant the room records the company at its mouth: the first
    FAIR pose within `EG_TUBE_MOUTH_M` (3 m, in three dimensions - a floor 6 m over the mouth is not at it) of its first
    metre (`egTubeAtMouth`; `src/net/eliteGates/egBrain.js:"if (!A.tm && egFairOk(A) && egTubeAtMouth(spec, x, y, z)) {"`), kept
    with its wake (`B.tm = { hw, at, said }` - a hall woken again starts its tube afresh, nothing to reset) and said ONCE to
    every screen with the stage (`tubeSaid`, `egStageWord`'s `tm`; `st` carries it to a screen joining late).
  - **The start, and why**: `EG_TUBE_MOUTH_S = EG_WAIT_MAX + EG_SET_MARGIN x EG_TUBE_MOUTH_M / EG_SPAN_RUN_MPS` = 4 +
    1.25 x 3 / 5.47 = 4.69 s after that instant. The fall then runs at its fixed 4.0 m/s. A member at the trigger's reach
    running at THE SPAN BUILD (5.47 m/s) reaches tube metre z at (z + 3) / 5.47 s, the edge at start + z / 4 s; the set
    piece's margin (`egTubeFair` - the edge no sooner than 1.25 x the runner) holds everywhere once it holds at the mouth,
    since 1.25 / 5.47 < 1 / 4 - so 0.69 s is the least start. The other 4 s is THE TIMED SOLVER's no-queue law
    (`EG_WAIT_MAX`, section 10.5): the member right behind may have missed the launch the first took at the gap before and
    waits at most 4 s for the next - it keeps the same margin from its own arrival. A member who stands about at the mouth
    is caught and cast forward (section 11.3's own rule), so the fall still chases the company - never a tube fallen before
    it came, nor one that waits so long nobody sees it go (18 s from the mouth would be past the end of a 60-80 m tube at the
    run). No hazard or step stands in a tube, so nothing slows the runner inside it.
  - ONE LAW, READ TWICE: the relay's judge (`bandFallen`, `egFallenAt`, `egSupportAt`, the fair trail's `tm`) and the
    screen's segments (`src/scenes/eliteGates/egSpan.js` `tubeEdgeOf`, through `systems/eliteGates/spireKit.js` `spireWake`'s new `tm` and
    `net/eliteGates/egLink.js` `stageOf`) both read `egTubeEdgeIn`. Laws 4-8 keep the wake's clock to the byte.
  - THE WIRE (`src/net/wire.js` `egStage`): the stage's word keeps `tm` when it is a relay instant, and only then - a word
    without one is the word it was, and a bad one is no instant, never no stage.
- **THE VOID ZONES ENFORCED** (`src/net/eliteGates/egFair.js:"export function egVoidCrossed(spec, fromY, a, b) {"`, `egVoidStep`;
  Elite-Gates-Ascent.md section 2).
  - LAW 9 lays a void zone "wherever a fall would skip ahead along the route" (`net/eliteGates/egAscent.js` `voidsOf` -
    `spec.voids`), and nothing read them. In seed 3's hall 27 a run off the 49 m bridge 18.3 m up landed 10.5 m down on bridge
    13: the route read 315 -> 601 of 622 m, the fair trail credited it, and the screen cast nobody back.
  - THE LAW (one, for both sides): a stretch going down, by a body whose last ground stood over the zone's foot, that meets
    the zone's heights over its footprint - tested where the stretch crosses the zone's top and foot, and at its end - passes
    the zone; once the feet are `EG_VOID_DROP_M` (3 m) under the ground they left with a zone passed, the fall is the void's.
    The footprint is read widened by the step-off reach, `egStepOffReach(dy)` = 5.47 x sqrt(2 dy / 20) + 0.35 m (THE SPAN
    BUILD's run over the fall to the zone's foot, the capsule beside): the zone is the lower way's plan under the upper's 3 m
    about it, and a running step-off from 10 m carries 6 m. Every zone stands over a way at least 5 m under the one it was
    left from, so a fall through one passes the 3 m mark in the air.
  - THE SCREEN (`src/scenes/eliteGates/egSpan.js` `intoVoid`, `ride`): judged before the frame's ground can become the cast-back's
    place, the fall into a void zone is cast back to the last floor stood on at the void's cost (section 8) -
    `src/scenes/eliteGates/egSpan.js:"if (voided && safe) { play(107, 0.6, 0.6); const p = wallSafe(safe, t); return [p[0], p[1] + 0.2, p[2]]; }"`.
    A stretch wider in plan than any frame's run (a cast-back, a pull, a recall) is a place given, never a fall; `setSafe`
    and the circle's clear forget the fall.
  - THE RELAY (`egFairPose`): the void's fall breaks the fair trail (`why` 'void'), marks the pose (`vz` - the census owes
    exactly one cast-back, `egPoseIn`), and credits nothing past the ground it left (`vd`): the break holds until the member
    stands on still ground no further along the route than that (the screen's cast-back stands it there). A body that landed
    on the way further on - an old screen, a forged one - is still the void's however far it walks on.
  - Over the sweep's halls (3 seeds a band, 26 of 60 halls laying 95 zones) the real motor walked every road along its route
    and was never cast back by a zone.
- **THE TOLL'S NEW GROUND KEYED BY ITS HERO** (`egFair.js` `groundAt`; section 10.6). A hero's floor was keyed by its index
  within its own hero, `h<i>` - and LAW 9 lays a hero a room, so floor 0 of every room after the first had been "seen"
  already, and a member who ran on into the next room was tolled as if idle. From spec law 9 the key is `h<hero>:<floor>`
  (`src/net/eliteGates/egFair.js:"const H = spec?.heroes ?? [], byHero = (spec?.law ?? 0) >= 9;"`); laws 4-8 keep `h<i>`. Seed 1 hall 2: the Tower's
  floor `h0:0`, then the Stair Hall's `h1:0` - new ground, the waiver its own.
- **A VENT BITES THROUGH ITS WHOLE FIRE** (`src/scenes/eliteGates/egFight.js` `place`, `ventJudged`; sections 8.3 and 10.3). The
  eruption was judged on the fire's first frame alone and marked judged whether my feet were in it or not: a body that walked
  into a span Vent's disc (or a Rampart vent's lane) a beat later stood in the flame unhurt. Now feet in it at any frame of
  the fire are bitten, once an eruption per member (each screen judges its own feet), again the next; the Rampart's quake
  cue still sounds once an eruption.
- **THE PENDULUM'S TOUCH IS ITS DRAWN WEIGHT'S** (`src/net/eliteGates/egSpanLaw.js` `egPendHits`, `EG_PEND_BODY_H`; section 10.3). The
  judge took feet from 0.6 m under the step to 2.2 m over it while the screen draws the weight from the step's top to
  2 x `EG_PEND_HALF` (1 m) over it (`egPendModel`): a jump that cleared the drawn block by a metre was cast back, and a head
  in it from below never was. Now the body's height (its feet to `CAPSULE_HEIGHT`, 1.8 m - `EG_PEND_BODY_H`, pinned equal;
  the motor's own height where the screen asks, so a crouch passes under) meets the weight's drawn height. THE TIMED SOLVER
  asks it of a body at the step's own height mid-flight, where the old band and this one agree, so every answer it gives and
  every course drawn is the one it was; the relay judges no touch.
- **A DRIFT'S HANG UNDER A FLOOR ABOVE** (`src/scenes/eliteGates/egSpan.js:"export function egHangReach(spec, s, band) {"`,
  `standTells`, `hangLook`, `egHangModel(band, len, over)`; section 10.3: "hangs on two chains from an anchor 18 m up").
  LAW 9 stacks its ways, and its drifts' 18 m chains and anchors passed through floors over them (3.1% of the drifts the audit
  swept, 12.9-17 m up). The screen now hangs the anchor `EG_HANG_TOP` (each band's own anchor height, pinned to its model)
  under the lowest underside of any floor its chains would pass (about the deck's travel) or its anchor would (its wider
  reach, where it hangs) - a plate, a passage's floor, a bridge, a stair, a room's floor or whole box, a closed passage's
  vault - on chains that long (never under 2.4 m), the crane's cable run to the floor; it leans by its own length, so its
  brackets stay beside the deck the law swings. The deck's swing is the law's (stepAt), untouched; a hang with nothing over
  it is the 18 m model, byte for byte. Over the 891 drifts of 40 seeds' circles a band, 36 hang shorter (4.0%), 4.05-17.72 m.
  Each capped hang is its own model in its hall's batch kind - no new kind.

**The pins** (each fails without its fix - the records in `tools/mutants/egperfect.json`, 19 mutants):
`test/player/egperfect_runleap.test.js` (the leap refused at Jumping 0 and 100, pressed at the edge or short of it; the late
press the forgiven plain jump; the wall run kept), `test/net/eliteGates/egperfect_tube.test.js` (every routed tube of seeds 1-14:
the fastest arrival finds it standing, the runner never overtaken with the margin, one launch behind keeps it, a waiter
caught, laws 4-8's clock to the byte; the room's instant said once, through the wire, the client's state and the spans'
wake, the census from it), `test/net/eliteGates/egperfect_voids.test.js` (seed 3 hall 27 on the relay's trail, in the relay's own
room, and on the real motor over the circle's real collider and the screen's own spans), `test/net/eliteGates/egperfect_toll.test.js`
(seed 1 hall 2; law 8's keys), `test/net/eliteGates/egperfect_vent.test.js` (a span Vent and a Rampart vent entered mid-fire),
`test/net/eliteGates/egperfect_pend.test.js` (the drawn band, the motor's body), `test/world/eliteGates/egperfect_hang.test.js` (seed 2 hall
12's drifts under their bridge; the open sky's hang to the byte; the screen's pivot and lean).

**Pins moved**: `test/systems/eliteGates/egmade_law.test.js` (the law's table gains `runLeap`; THE SWEEP reads `parkourDeps`'s door);
`test/net/eliteGates/egfrag_client.test.js` (a routed hall's Tube falls from `tm`, not the wake). Eighteen mutant records the
change moved were re-aimed BY CONTENT (`auditclimbarc`, `eg6a`, `eghero_lay`, `egint`, `egmade`, `egspan`, `egz_legion`,
`egz_rules`, `egz_tells`, `law9_proofs`): each applies again and still dies.

**The relay.** `net/eliteGates/egBrain.js`, `egFair.js`, `egSpanLaw.js` and `net/wire.js` are in the relay's bundle, so this is a relay
change: the relay's version moved with EG-PERFECT's (`world219` - the EG-PERFECT record above). The wire's change is additive (`tm` on `sg`/`st`, optional): an old screen ignores it and
keeps the wake's clock for a routed tube - the deploy order is the relay's, then the client's.

**The four hosts.** `scenes/world.js` carries one line changed, none added (`test/scenes/hostceiling.test.js` holds its ceiling):
bootWorld's Spire wake getter hands the tube's instant beside the hall and its wake
(`src/scenes/world.js:"registerSpireWake(egClient ? () => { const E = egClient.state(); return { h: E.h | 0, hw: E.hw || 0, tm: E.tm || 0 }; } : null);"`).
`scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js` are untouched, and no Room method changed.

**What it does not do, said so.**
- No hall's draw moved (laws 4-9 - spec law 10 is the EG-PERFECT record's), no proof, no generator: THE TIMED SOLVER's answers are its own. Every read here holds for law 10's routed halls as for law 9's.
- The running leap is refused in the Spire and the Hour only; the court and the open world keep CLIMB3's leap.
- The relay does not judge the Pendulum's touch or the Vent's bite (each screen judges its own feet); a void fall's cast-back
  is the screen's, the relay's part the break, the progress and the census.
- A capped hang is the screen's alone; the relay never knew a chain.

### EG-PERFECT (the audit) - 2026-10-18 - SIX LANES READ THE PASS, AND WHAT THEY FOUND

Mac: *"Lets audit this and ensure perfection"*. Six read-only lanes read the three EG-PERFECT records above against the code
at their head - the lords, the halls under spec law 10, the ways' proofs, the relay's judgement, the screen, and the records
themselves. Each finding was reproduced on the real producers (the law's own halls, the brain's own breach, THE TIMED
SOLVER's own answer, the real motor on the real collider) before it was fixed; what was weighed and left is said at the end.
Daggerfall Unity has no Elite Breach, no Spire and no relay: every fix here is to our own law, and none departs from DFU.

**THE LORDS** (`net/eliteGates/egLords.js`, `egBodies.js`; the screens' `scenes/eliteGates/egFight.js`, `world/eliteGates/egTelegraph.js`).
- The Wyrm grounded for good in its first phase never flew again from the perches its second phase raised: its landing's
  run now ends at once where they rise (`groundedUntil`). A burst past both lines turns the third at once - it raises no
  perches, and the Spellmaster lays no Examination's runes she could never hold (they stood the rest of the fight).
- THE FINAL EXAMINATION's cage holds its member's feet on every screen, yet THE UNION FLOOR planned that member's escape:
  a caged member's ground is the cage alone (`egUnionHeld` - mark 5), and a blow said over it before the cage closed is cut
  as it closes.
- Fury's chained shape held past its first's landing was said with `ol: 0`, which the wire refuses: a shape carries a lead
  only while its first is still to land.
- A lord weighed a blow without the pool it leaves (`wouldHold` now weighs it - Dusk's Hellfire left a member no ground
  before a haven CHECK).
- A Binder raising the fallen is lit too, and read as a raised guard's glint - the glint and its sound are a lord's alone
  (`egRimOf`'s `lord`). The WIND's beat-wide grace belonged to a feint's mirror alone (`egWindGraceMs`; every other body
  EG_WIND_WAY_MS, 150 ms).
- A law 10 Wyrm's perch stands 30 m off its court's heart and its far rim 52 m off (seed 1's hall 85): EG_WYRM_REACH_M 40 to
  64. The Arcane Lattice's strips ran a metre short of the rim and its 12 s cooldown overlapped a sweep of ten strips: its
  strips now cover the floor rim to rim (`Math.ceil`) and its cooldown runs from the last strip's landing. The Conquest's
  tell covered a lone third's 20.8 m, not the court's whole 24 m with its neighbour burning: EG_CONQUEST_TELL_MS 3500 to 4000.
  A burst past both lines that skipped the second phase's card shows it before the third's (the screen's beat queue).
- A lord whose every draw THE UNION FLOOR held against its target only walked at it, its target kept: a member off the
  floor's rim (as on a balcony) stalled the Kyn Reeve - always at the top of its threat - at one blow a minute. Such a
  member is now let be for EG_SHUN_MS (6 s, past a target's 4 s keep) while the company has another (`L.shun`); the Kyn
  Reeve threw 13 blows in that minute. A company of one is still its target.
  The record's "fall on some of the company, never all" was untrue of a company no larger than a blow's marks - said so above.

**THE RELAY'S JUDGEMENT** (`net/eliteGates/egFair.js`, `egBrain.js`, `egAscent.js`).
- A BLOCKER: a law 10 Drop falls 3-4.5 m and a void zone about a Gale fork's plate held the Drop past its edge - at
  EG_VOID_DROP_M 3 every way down it was the void's, and seed 3's hall 7 (both roads), 12's hall 7 and 12's hall 22's Low
  Road could not be crossed. EG_VOID_DROP_M is now the deepest Drop and a quarter metre (EG_DROP_CM / 100 + 0.25, 4.75 m).
- A Scriptorium's quiet ran from the hall's wake while law 10 lays its rooms first: seed 7's hall 8 pulled the company at
  53 s, before THE SPAN BUILD reached its door (57.8 s). Its trial awaits its company like a Rift-Yard's (`quietUntil` in
  EG_AWAIT_CLOCKS), released when a member stands on its trial's own ground (`egOnTrialGround`).
- The Deserter closed rifts unopposed while its trial's clocks were held: it waits with the trial (`deserterGoal`).
- Law 10 lays a void zone under its arrival plate too (`voidsOf`): in seed 2's hall 3 a step off the plate fell 19.3 m onto
  the way 166 m along it, credited.
- A pose already down a routed tube starts its fall as one at its mouth does (`egTubeAtMouth`): a pose that skipped the
  mouth's 3 m left the tube standing for good.

**THE WAYS' PROOFS** (`net/eliteGates/egSpanLaw.js`, `egRouteProof.js`, `egLaw.js`).
- THE TIMED SOLVER took a Pendulum over the reach's path - the body 27% faster than the motor flies, its feet at the
  landing's height: 7% of the launches it called clear met the weight. It now takes the body's own path, its middle on the
  edge and a body's radius past it at the run's pace, its feet on the jump's arc, at EG_SOLVE_FLIGHT_N (24) instants -
  under 2% of its clear launches graze it. LAW10_HASH moves (laws 4-9 hash as they did).
- A run of Rails was set "half a cycle apart" as half the period in ms - `egPieceAt` reads a phase as its angle, so they
  stood 172-258 degrees apart: π now.
- A z link took a piece turned along x standing on its line (`egRouteSpanSteps` reads the link's own heading); the
  Molten Rim's landing and the ruin's air read a turned piece along its own heading (`egMoltenRim`, `world/eliteGates/egRuin.js`).
- The refused late press in the Shattered Hour does nothing at all, as DFU's motor (it gives no late press); said in
  `systems/madeLevel.js`, not changed.

**THE HALLS UNDER LAW 10** (`net/eliteGates/egAscent.js`, `egLaw.js`; Elite-Gates-Ascent.md section 11 states each rule).
- A Gust run laid straight on after a Crumble run: THE TIMED SOLVER reads no gust and the real motor fell on 1.9% of the
  roads - a Gust is never an approach's kind.
- Bridges of 30 m and more were walked whole (a centred break that met anything left the bridge whole; a 136 m approach
  broke once): a break now tries its pieces down to one, at EG_BROKEN_SLIDES along the bridge, more pieces the longer it
  runs (EG_BROKEN_MOST at most), and an approach's long run is laid as bridges of 18-25 m, each broken on its own.
- A fork's High Road drew a Drop that barely fell (it draws none); a Drift swung within a centimetre of a room's wall
  reached through a landing (a break stands EG_BROKEN_CLEAR_CM clear of every leg, the two it joins too); two halls asked
  no jump at all (a try with no span link is laid again); the fork laid first cost three halls their fork (the plan's own
  tries lay it second); 15% of the broken bridges stood one still slab (a lone piece is never still).

**THE SCREEN** (`scenes/eliteGates/egSpan.js`, `render/superDungeon/sdStepsPass.js`, `world/eliteGates/egHall.js`, `egLook.js`,
`egGround.js`, `egPlatformModel.js`, `net/eliteGates/egWalkGraph.js`).
- A drift's hang read a room's box off its origin a second time, though a spec's hero box is the hall's frame already:
  14 of 23 capped hangs were phantoms over open sky, and a real room over a drift was missed (`egHangReach`). Its anchor's
  reach under the pivot was 1.4 m where the first band's rib hangs 1.57 m: EG_HANG_HALF.down 1.6, pinned to each band's
  model with its reach across and along.
- A broken bridge's ends over the void were drawn open - no end face, no edge line: a lane's end no floor meets is closed
  (`egLaneOpenEnds` - the lane's model, its edges' segment across it).
- A turned slab's broken column stood on its jump line (`egPiecePlan` - a z side for a turned piece).
- A chamber's ring opened a whole 32-gon side, 3.4-5.4 m, about a 2 m niche, and a passage's alcove beside it opened it
  too: a doorway EG_RING_DOOR wide about the ring's own chamber's alcove, its side's wall kept either side
  (`egRingSideWalls` - the collider, the arcade, the air and the clamp, `egFragKeep` by the alcove's own floor).
- Found while re-measuring the records: a circle's ghosts (the gone Beat's and the fallen Crumble's outline where it
  returns - section 10.8) are EG_GHOSTS_MAX, 48, slots, and law 10 lays up to 72 Beats and Crumbles a circle (21 of seeds
  1-4's 320 circles past 48; 24 in seed 7's circle 5 drew no ghost). Never more than 29 stood in one hall of them, so a circle past
  its slots now ghosts the hall I am in and the halls nearest it, aimed again as I cross into another (`aimGhosts`; the
  pass's boxes laid again - `SdStepsPass` `ghosts`). A circle within its slots is drawn as it was.

**THE RECORDS.** The lords record's figures are re-measured at this head (its **Measured**); its relay paragraph names
`world219`, its pins and the forty-four re-aimed records; the ways record names its one `scenes/world.js` line; the
Port-Ledger's ELITE-GATES row names law 10; Testing.md's rows say law 10's counts (the Captive's chains: 56 kept, none
refused); sixteen relay pins carry their PIN MOVED note; stale comments said so (`egAscent.js` breakLeg's heading,
`egSpanLaw.js` the flight's instants, `egSpan.js` EG_GHOSTS_MAX's measure).

**Measured** at this head: the figures in the lords record above; the real motor over 100 circles' 692 roads, every one
crossed (1.9% fell before the Gust fix); the relay's drop walk over 704 zones, no false void; no long skip of the skip scan
left without its zone; of 1,507 drifts over 40 seeds' first circle of bands 0-3, 35 hang shorter (2.3%, 4.28-17.96 m - the
ways record's 36 of 891 was law 9's, its phantoms among them).

**The pins** (each fails without its fix - `tools/mutants/egperfect_audit.json`, 44 records, every one dead):
`test/net/eliteGates/egperfect_lords.test.js` (AUDIT A1-A8; 29 in the file), `test/net/eliteGates/egperfect_audit.test.js` (6 - R1-R4,
P1-P2: the relay's and the ways' halves), `test/world/eliteGates/egperfect_audit_screen.test.js` (5 - S1-S5: the screen's) and
`test/net/eliteGates/egperfect_broken.test.js`'s THE AUDIT'S HALLS (13 in the file). The 156 records of the earlier lists that
stand on a line the fixes moved, or whose pin moved, were run again: every one dead - the duel's setting-aside
(`EGPERFECT-duel-ring-fillers-thrown`) once its pin stood Garoth's outsider beside his ring.

**Pins moved**: `egperfect_broken` (LAW10_HASH 650998388; `quietUntil` among the await's clocks; the Rails at π),
`egperfect_broken_unit` (the Rails at π; the plan's own try is 77:37's ninth - 77:57 lays on law 9's eighth now its long
bridges break in parts), `egperfect_lords` (a duel's ring: a member outside it beside it is not held, inside is; Garoth's duel read with its
outsider beside the ring, where his setting-aside alone keeps Kyn's Due off them),
`egperfect_tube` (a pose in the tube starts it), `egperfect_hang` (the box in the hall's frame), `egperfect_halls_chains`
(56 kept), `egaudit5_h` (the Scriptorium's member on its trial's ground), `egaudit5_a2_client` (the law before law 10 that
parts this Deepway's floors is 9), `egaudit5_b` (the mirrors over a minute - the Lattice's cooldown moves the draws),
`egint_client` (the hall's first Drift - law 10's first piece is a broken bridge's still slab), `eglook_air` (a mist sheet
touching a floor's edge meets none, as `egRimMists` reads it), `egz_telegraph` (`egRimOf`'s `lord`), each with its note.

**The relay.** `net/eliteGates/egLords.js`, `egBodies.js`, `egBrain.js`, `egFair.js`, `egLaw.js`, `egAscent.js`, `egSpanLaw.js`, `egRouteProof.js`
and `egWalkGraph.js` are in the relay's bundle: `world219` (`world218` until GRANT2 took it on main) is unshipped, so its `LAW` row in `test/net/relayversion.test.js` is
re-hashed in place. The wire is unchanged (a chained shape simply omits `ol` where it had sent 0, which every screen
already refused).

**The four hosts.** None touched (HOST-SPLIT): `scenes/eliteGates/egSpan.js` is a module the hosts wire, and no Room method
changed.

**Weighed and left, said so.**
- The relay reads a lane's end as a capsule and the screen as a box: a body 2.3 m into a turned break's 3.1 m gap is still
  held on the island by the relay; an alcove's support disc covers a little void beside its niche. Both lean toward the
  player and are as they were.
- The Deserter's clamp, the Ashfall's disc and the Casters' stands run under laws 4-8 as well (the halls record's choice).
- A Rift-Yard's exit plate on its perimeter ring's radius (26 of 1,400 law 10 halls): the ring stands open along the
  way's axis there, and no standing segment of it (`egRingSideWalls`) comes within the plate's radius - nothing to fix.
- A turned Beat's dial reads XII along +z, as its model's own does: left as drawn.
- Rooms: towers stand in 76% of law 10's halls (drawn from the whole fresh pool; law 9's 82%).

### EG-SWEEP-RED - 2026-10-19 - THE FOUR COURSES THE DEPLOY'S SWEEP DID NOT CROSS

The relay's deploy for `world219` (EG-PERFECT, #1030) was refused three times - relay deploys 784, 786 and 788 - by the
500-seed sweep it runs before it drops a player (section 10.5, "The sweep"), on the same four courses each time: 2 of 3,529 in
band 1, 2 of 3,482 in band 3. The pull request had swept 25 seeds a band and none of the four (seeds 140, 342, 464 and 500)
is among them. The relay stood at `world218`, the account deploy behind it waited on `world219`, and the site behind that on
the account service's `acct156`. Each of the four seeds' circles crossed whole on the tree before EG-PERFECT (`cfff653`), its
halls laid by law 9, and failed on every tree after: the courses are spec law 10's, the pilot and the screen are not new. One
failure was the game's, three the pilot's.

**THE BREATH KEPT TO ITS OWN SPAN LINK** (`world/eliteGates/egLook.js` egGustSections - the screen's breath, its
streamers and the pilot's gust read). Seed 342's Hall 37 (band 1, ground 0) lays two Gust links one after the other on road 0:
span link 0's three Gusts at y 0 on the hall's line, span link 1's three 12 m up on x 14.85. A section was a run of Gust
steps on one road with no other piece between, so the six were one run: the first course's line, its height stretched to 12 m
over z 4.11-29.47. The bridge the way takes back over the first course (link 20, x -1.15, 12 m up) stood inside it and was
blown - the pilot pushed off it at 2.7 m/s - and span link 1's own Gusts, 14.85 m off the section's line, past
`EG_GUST_REACH_M`, never blew at all. A run is one span link's now (`span` on the section): 797 of 6,000 law 10 halls over
seeds 1-60 laid a Gust run straight on into another link's. The laws before lay no `span`, and draw as they did.

**A PLAN'S CHAIN HELD FOR A LAUNCH A HOLD LATE** (`tools/egSpanSolve.mjs` launch). Seed 464's Hall 47 (band 1, ground 5)
turns a bridge onto one Beat (link 8, heading -x). The first launch into the Beat's window was taken with the launch off it
possible at one moment only - 21.966 s into the road, the Beat gone at 22.038 s - and the pilot's run-up reaches an edge a frame late
(0.03 s, its own acceleration): it landed on the lip, stepped up, and no launch came before the Beat went. A launch is taken
only where it lands `HOLD_S` either side; its chain is now asked of a launch `HOLD_S` late too, and the plan waits for a
Beat it can leave.

**A RAIL RUNNING AWAY LANDED ON WITHIN THE REACH UNCAUGHT** (`tools/egSpanSolve.mjs` lands). Seed 140's Hall 76 (two Rails
in one phase, 2.4 m apart, running apart) and seed 500's Hall 77 (a Rail running away from the ground) were jumped at the last
of the solver's window, the gap at landing 3.09-3.21 m against the reach's 3.26. `egJumpReach` counts the capsule over both
edges, and the far one is a corner caught and stepped up onto (seed 464's landing above, 0.33 m under the top, was such a
catch); a face moving away from the body gives none - the body was pinned to the Rail's face and fell. Onto a piece receding
at the landing, the pilot takes a launch only where the reach less one capsule's radius (`EG_BODY_R`, 2.91 m on the level)
still lands.

**The pins** (`test/tooling/egsweep_red.test.js`, 3; `tools/mutants/egsweep_red.json`, 4 records, every one dead): the two
sections of seed 342's Hall 37 on their own lines and storeys, its bridge in no breath, every Gust of it blowing, the course
crossed; seed 464's Hall 47 crossed; seeds 140's and 500's Rails crossed. Each course is crossed from the deploy's own start.

**Weighed and left, said so.** THE TIMED SOLVER's window (`egJumpLands`) counts the far edge's catch onto a receding piece
as onto a still one, so the last few hundredths of a Rail's window as it runs away over-promise the span build by up to a
capsule's radius. No course is left uncrossed by it - the pilot finds the launch with the radius to spare in every course
of the sweep - but a player of the span build who jumps at the last of such a window falls short. Mending it is the law's
(`egSpanLaw.js` is in the relay's bundle: every hall laid again, and the relay's version with it), and the owner's call.

**The relay.** Nothing in the relay's bundle moved (`world/eliteGates/egLook.js` and `tools/` are the client's and the
sweep's): `world219` stands as EG-PERFECT left it, and this is what lets its deploy through.

**The four hosts.** None touched (HOST-SPLIT).

### EG-PLUS - 2026-10-19 - THE BREACH'S WINDOWS IN THE STONE-AND-BRASS KIT

The owner: *"We also need to improve the elite breach UI as its not enhanced plus UI standard."*

**What was wrong (FACT, at da3bb0d5c).** Every Elite Breach window wore a look of its own. The panel at a rest (the
Vestige offer, the company's word, the recap - `src/ui/eliteGates/egHud.js` `drawEgPanel`) and the call's tracker
(`drawEgHud`) were Cormorant and Georgia on hand-picked browns with rounded corners; the boards
(`src/ui/eliteGates/egBoardWindow.js`) were Georgia on a dark plate. None of their surfaces was in the kit
(`src/ui/enhanced/enhancedFrame.js` FRAME_ROLES), so the Plus themes, DFO Grimoire and the pixel face never reached them -
the state CARDS-PLUS took off the card tables (`Tavern-Cards.md` section 38). The start window on the enhanced skin was
DFU's list picker drawn in the skin: the stake and the quest warning stood among the choices as rows, each member's
readiness was spelt `[+x]`, and the Wager was a second list of twenty rows. A decree's choice at a rest was a press
reading *Chained Blows - The legion's blows chain a second shape.*; Dagon's Bargain and the respite were one long title
each; the panel's foot was a line of keys and chat commands.

**What changed.**

- **THE CHROME** (`src/ui/eliteGates/egKit.js`, new): one sheet every breach window wears (`.eg-win`) - the header band
  (`.eg-k-head`, its title in brass capitals, chips beside it, a close), the body that scrolls inside a box the screen
  bounds, sections (`.eg-k-sec`, a head over an engraved line), reading lines at 15px and their tones (dim, warn, gold,
  the Vestiges' blue), tiles, presses, chips, list rows, tabs, the dock (`.eg-k-dock`, the band the presses stand on,
  never scrolled away) and the foot. Geometry and words only, the card tables' law; the kit paints by role. The kit names
  them (FRAME_ROLES: the window, the tracker and a section a panel, the presses and the close buttons, Open the breach and
  a recap's Close primary, a choice a tile, a readout a chip, the head a header, a section's head a headerRule, the dock a
  footer, the foot a ruleTop, a board's line a listRow, its tabs tabs) - so the Plus themes, Stone's lifted words and
  DFO Grimoire (`src/ui/grimoireDress.js` INK_ROOTS and WOOD_ROOTS, read off the roles) reach every one. On the classic
  skin `dressEgKit` lays the kit cut to the breach's selectors (`scopeRules`), as the Broker, the naval readout and the
  card tables do; on every skin it asks for the face.
- **THE PANEL**: a breach window. Its head says what it shows - *Choose a Vestige* (or *Choose 2 Vestiges*), *The company
  decides*, *The breach is over* - with the keys and the Surplus as chips. Each Vestige a tile: its key, its name, its line,
  the capstone it completes and the Accord it takes in blue. A decree's choice is tiles, each decree's name over what it
  does (`egAskText` - the options their names and `lines` what each does); Dagon's Bargain and the respite a short title
  with what a yes does on a line under it (*The rest runs 2 minutes longer and the count holds.*, read off
  EG_RESPITE_STEP_MS); the choice I voted for pressed; each choice's seconds a chip; *The majority of those who answer
  decides.* once; the keys in the foot (*1-6 to choose, Y for Ready, R for a respite*). The recap: its depth, time, why,
  Reliquaries and board line, then Circles, Company and Vestiges as sections, its Close in brass on the dock.
- **THE CALL'S TRACKER**: a plate over the world (the kit's panel) in the pixel face.
- **THE BOARDS**: a breach window - the season a chip on the head, the six tabs a tablist, each row its parts
  (`egBoardView`, new, pure: a rank, who, where - the hall and its band, the start, the Wager, the Proclamation - and the
  time or the depth), the Unfallen and the reader as chips, the reader's row brass. `egBoardLines` stays the classic
  picker's.
- **THE START WINDOW on Enhanced Plus** (`src/ui/eliteGates/egStartPanel.js`, new): the head (*Elite Breach*, the Weir Keys
  held as a chip), the stake in one line (or none held, and the Rehearsal the way in), the quest warning as a warning line;
  *Where to start* - a tile per start (deepest first, Hall 1 last), its band, each member's mark as a chip (and *Without
  Mara* where one cannot make it); *The Wager* folded until opened or while it holds a decree, its rule in one line, every
  decree a tile by family; the dock - *Open the breach* (a start taken first; a refusal said on the dock), *Rehearse Halls
  1-5*, *Boards*, *Cancel*. It is an overlay of the generic shape (`src/ui/brokerDoor.js`'s) on the mode machine's window
  slot the list used (`scenes/world.js` `egWindowSlot`), and keeps the list's laws: the slot emptied before a choice is
  acted on, before its question (*Go without Mara?*, the host's box) and before the boards; a window put out of its slot
  cancels it once; a choice is handed on once. The host hands its doors on Enhanced Plus alone (`panel:` beside the
  list's doors - one entry, HOST-SPLIT), and `openEgStartWindow` opens it in the list's place; the classic skin keeps
  DFU's list (THE NATIVE-WINDOW RULE).
- **THE SPIRE HUD** on Enhanced Plus: its chips, its decrees press and its touch buttons are the kit's to paint; the
  classic skin keeps DFU's text colour and shadow.

**New words** go through the text core (`eg.panel.*`, `eg.start.*`, `eg.ask.*`, `eg.board.fromRedoubt`); the hard-coded
count of `egHud.js` fell by six (`test/systems/l10n4_hardcoded.test.js`).

**The four hosts.** `src/scenes/world.js` WIRED (the start window's `panel:` doors). `src/scenes/worldModes.js`,
`src/scenes/dungeonContext.js` and `src/scenes/exterior.js` build no Elite Breach window of their own: the breach is
online's, opened through the world host.

**Proof.** `test/ui/eliteGates/egplus_ui.test.js` (8): the roles, the cut, the sheets' paint and face, the classic skin's
dress, the panel, the boards, the start window's model and its whole flow, and the doors. `tools/mutants/egplus.json`: 19
records, every one dead (with the nine re-aimed: 442 dead, 0 survived). Pins moved: `egaudit3_pres` (the recap's capstones are a line), `egaudit5_c_hud` (the touch note is the foot; the
last runs are rows), `egeco_board` (a row's parts); nine mutant records re-aimed by content (`cardsplus`,
`egaudit3_pres`, `egaudit5_c`, `egz_mastery`, `egz_return`). `test/ui/font3_readable.test.js` holds the breach's five sheets
to the type floor. `tools/egPlusProbe.mjs` draws each window through its real painter on Enhanced Plus, Stone, the classic
skin and DFO Grimoire at 1280x800 and 390x844 and checks the face, the carved frame, the fit and 44px presses under a
finger: 244 of 244.

**The relay.** Nothing of this is in its bundle.

### SPIRE-FIRST - 2026-10-20 - FIRST OF THE SPIRE GRANTED, AND FIRSTLIGHT REBUILT AS SERVERIDE'S OWN

The player, on Discord: *"Would it be possible for you to make a First of the Spire title for me? I achieved it Saturday
night."* - the herald's post beside it: *First of the Spire: Severide's company is the first ever to take Redoubt 10 of
the Battlespire (Hall 50), in 1:17:40 - Severide.* The owner: *"Since hes world first. He should get this title plus a
custom aura"*.

**What was there (FACT, at fc2a29e0c).** The title and its aura were built at EG-E2 and waiting: `spirefirst` First of the
Spire and `firstlight` Firstlight, held by name off `EG_FIRST_HANDLES` (`server-account/src/titles.js` `isSpireFirst`),
which was empty "until the first company takes Redoubt 10", with its letter written at the named account's next balance's
read (EG-ZF, `egFirstPost`). One name in the herald's post, and the Descent's *Alone* bracket, say the company was one.
(This record first read the post's *Severide* as the account's handle. It is not: the herald says the name the room reads,
the token's `n`, which since NAME-AS may be the character's - SPIRE-FIRST-NAME, below, corrected it.)

**The grant.** `server-account/wrangler.toml` reads `EG_FIRST_HANDLES = "Serveride"` (SPIRE-FIRST-NAME; this slice wrote
the herald's `Severide`). Read off the config at every token and every call, case-folded (`handleList`), so once the
account worker deploys, the account holds the title and Firstlight and is written the letter once; a near name is
another account. No column, no migration, no version:
both ids have been in the token's vocabulary since EG-E2.

**The custom aura: Firstlight, rebuilt.** EG-E2 drew it as one dawn-white ring with a sunrise circling it and a veil to
the shin - the plainest of the auras. A second aura beside it would have been a new id in the token's vocabulary (a relay
version, the hello's body bound, every positional pin) for the same honour; Firstlight is held only by the first company
and that company is Severide, so Firstlight IS his own, and it was rebuilt to say what he did. `src/render/auraRing.js`,
the eleventh look, still added whole, in the Spire's dawn (`ui/playerBadge.js` `SPIRE_DAWN`, `SPIRE_DAWN_GOLD`, and
`SPIRE_DAWN_ROSE`, new: the sky low at sunrise):
- **THE CLIMB** (`dawnClimb`, node's law, the shader's `dawnTaken`/`dawnFlare` its copy): every twelve seconds the ten
  Redoubts are taken one after another, I to X, each flaring as it is; X held - the dawn broken - for some four seconds;
  then all of it back down, and again (`DAWN_CLIMB`).
- **THE GROUND**: the dial - the dawn-white ring and a thinner gold line inside it - with the climb's lane between them lit
  round from I to where the climb has come, its head bright; the ten Redoubts on the ring as lozenges (`dawnMarkAngle`),
  an outline until taken and filled with the dawn after, X the larger and a star of four points once the dawn breaks; the
  sunrise still circling the ring; and past it a sunburst of twenty rays, long and short by turns, gold at the ring and
  rose at their tips, turning slowly - faint until X is taken, when the dawn's light runs out along them across the
  ground and they brighten.
- **THE WALL**, the pass's strip at the ring, now 1.9 m (`DAWN_H`): ten spires of light, one off each Redoubt, I the
  lowest (0.16 m) and X the tallest (0.74 m), each a third of itself until its Redoubt is taken and standing whole after
  (`dawnSpireH`) - rose at the foot, gold up it, white at its point, a star there; as X is taken a shaft of first light
  shoots up off its point past the head and stands faint while the dawn holds; dawn-white motes rising off the ring, more
  once it has broken; the veil to the shin kept. The shaft and the motes are not drawn from inside the ring, so the
  wearer's own first person is never veiled by them (the radiance's law).
- Every rate whole over the clock (`spireRatesWhole`, the motes' two paces too); the Redoubts, the lane and the rays whole
  round, so no seam behind the wearer nor where the sunburst's own round closes as it turns. No third draw, no host
  changed (THE FOUR HOSTS: `scenes/world.js` draws every look through the pass by its key; `scenes/worldModes.js` and
  `scenes/dungeonContext.js` draw through world.js's pass; `scenes/exterior.js` draws no aura - FLAGGED, unchanged).
- Not a DFU member: Daggerfall Unity has no accounts, titles or auras (Ledger A's EG-PLAY row).

**Seen** in headless Chromium's WebGL2 with a stand-in body: it compiles, links and draws with no GL error; from the
wearer's third-person eye the ten spires stand round the feet and climb, the tenth crowned; from above the dial, the climb's
lane and the sunburst; from X's side its spire and its shaft. `tools/auraProbe.mjs` reads it (94/94): the ring whole and
warm from above, the lane lit behind the climb and dark ahead (node's law), X's spire whole once taken and a third
before, the shaft as X is taken and none before, no seam where the ring closes, no jump at the wrap, nothing before it
kindles (shots `firstlight.png`, `firstlight_top.png`, `firstlight_side.png`).

**Pins.** `test/net/eliteGates/egeco_honours.test.js`: the config pin moved - `EG_FIRST_HANDLES` reads `Serveride` since SPIRE-FIRST-NAME (`Severide` here first; it read
empty), held in any case, near names refused; Firstlight's crisp ring moved to read two centimetres either side of its
line (PIN MOVED - the lit lane now lies inside the old hand's reach, and EGECO2-dawn-ring-gone survived the old pin);
three new tests - the climb's law, the ground RUN, the wall RUN, each through the interpreter (`test/glsl.mjs`) on the
code the GPU runs, the seam a hair either side of atan's wrap and of the sunburst's own. `tools/mutants/egeco_honours.json`:
SPIRE-FIRST's 23 (the account left off the list; the law's taken-at-once, never-down, flare-held and a whole spire before; the
shader's taken-at-once, order reversed, never down, lane unlit, lane lit whole, faces never filled, star always, rays
flat, rays all long, wave gone, spires one height, spires never rise, shaft from inside, shaft never, veil past the shin,
the wall kindled at once, the rays' seam and the wall's seam) and the list's 63 before them - 86, every one dead. The
first run of the new pins found two survivors (a taken lozenge was told from an untaken one only by the flare and the
lane beside it; a spire's rise only by its brightness) and the rays' seam a third (a non-whole ray count closes where the
sunburst's own round does, which turns, not behind the wearer); each pin was aimed at what it claims.

**Left as it is, said.** Not seen in a running game client - the probe and the interpreter are its readers. Like every
aura it stands on a wearer turned beast and on a rider. The climb runs on the shared clock, not the wearer's seed: one
company ever holds it.

### SPIRE-FIRST-NAME - 2026-10-20 - THE LIST NAMES THE ACCOUNT, NOT THE NAME THE HERALD READ

The owner, after SPIRE-FIRST merged (#1083): *"Its Serveride. You did the wrong name"*.

**What was wrong (FACT, at d883d3778).** SPIRE-FIRST put `EG_FIRST_HANDLES = "Severide"`, the name off the herald's post,
on the reading that the herald names an earner by the account's handle. It names them by the token's `n`, the name the
room reads (`server/src/index.js` `_egOpen`: each member's `sanitizeName` of the hello's verified name), and since NAME-AS
(acct122, `06-Systems/Accounts-And-Cloud-Saves-Arc.md`) that is the account's name OR the realm character's, as the
account chose. `isSpireFirst` matches the list against `player.handle`. So the list named a handle that is not his: the
account Serveride wears his character's name, Severide, and held nothing - and nobody else did either: NAME-AS refuses
to sign a one-word character's name that is another account's handle (`wornNameRefusal`, `taken`), so a `Severide` worn
in the room was no account's handle when its token was minted.

**The fix.** `server-account/wrangler.toml` reads `EG_FIRST_HANDLES = "Serveride"`, on the owner's word; its comment, and
`titles.js` beside `isSpireFirst`, now say the list is accounts' handles and never a name off the herald. The record
above is corrected where it read the post's name as the handle.

**Pins.** `test/net/eliteGates/egeco_honours.test.js`: the list reads `Serveride` (PIN MOVED), held in any case; `Severide`,
the character's name, refused as another account beside the near names. `tools/mutants/egeco_honours.json`:
SPIRE-FIRST-severide-not-granted re-aimed as SPIRE-FIRST-serveride-not-granted, and SPIRE-FIRST-NAME-the-character-listed
(the list naming the character) - both dead.

**Left as it is, said.** The herald still posts the name the room reads - it is the room's word, and a player who chose to
be seen by their character is seen so in Discord too. A list in config is still a person's edit: Hour's First's names
came from the clears' claims (`sd-clears.yml`), which carry the account; the Spire's company has no such workflow, so
the next name put on a handle list off the herald is checked against the account first.

### EG-FALL - 2026-10-21 - A LORD'S FALL IS THE GATE'S

The owner: *"I notice in the Elite Breaches, when the boss dies it freezes in place. Oblivion gates do the boss death the
best way"*. Audited cold the same day at the owner's word, *"Audit this"* (AUDIT EG-FALL,
`01-Overview/audits/Audit-EG-FALL.md`: three lanes on a frozen head, 32 findings, 30 distinct, 2 of them bugs); this record reads as
the audit left it, each correction marked with its finding's id.

**What was there (FACT, at 8089d374f).** A felled lord stays in its hall's fight on the relay's word: `egLordHit`
(`net/eliteGates/egLords.js`) sets `EG_FL.fell` and the fall's instant, and keeps the body, so the Twins' fifteen seconds
can raise one (`egLink.js` `fellOf` clears it again). The screen drew that body through `egBodyAct`
(`scenes/eliteGates/egFight.js`), whose fallen branch read `frame: Math.min(3, ...)` over 1.2 s with `sink: 0` and had no
end: the lord played four hurt frames and then stood on the fourth, upright and full size, for as long as the hall stood.
Section 16.2 promised "the gate's fall beats (WB13e): *FELLED*, the body down"; the card shipped (`beats`), the body
never went down, and none of the gate's other beats had been carried over - no cry, no thud, no light, no shake.
(EG-ZJ's record says "a lord's flags fallen lay it down at once": the fold's state, never the picture - AUDIT EG-FALL L3-12.)

**The fall.** `scenes/eliteGates/egLordFall.js` (new; `egFight.js` wires it) gives every lord the Warden's fall from the
Burning Court (`world/gate/gateBoss.js` `bossAct`, `scenes/gate/gateCourt.js` `fallEvent`, `drawCorpse` and `lights`).
It is on the gate's own numbers - `FALL_MS`, `THUD_AT_MS`, `FALL_FLASH_MS`, `FALL_SHAKE`, `COLUMN_BURSTS`,
`COLUMN_STEP_MS`, `FALL_CRY_LATE_MS`, and the ones the court had written in line, now named there and read here
(`FALL_BURST_UP`, `FALL_FLASH_Y`, `FALL_FLASH_K`, `FALL_FLASH_RANGE`, `FALL_NEWS_MS` in `gateCourt.js`, `GLOW_UP_SHARE` and
`FALL_GLOW_K` in `gateBoss.js` - AUDIT EG-FALL L2-9, L3-9). Three of them grow with the lord's drawn size over the
Warden's 3 (`EG_FALL_PER` - Grath at 4.8 sinks 2.4 m): its sink, its corpse's scale, and the height its beats stand at
(`egFallTallM`, the Warden's `BOSS_H` grown - not the drawn sprite's height); the flash, the glow's reach, the shake and the
bursts' size are the gate's as they are (AUDIT EG-FALL L3-1, L3-7):
- **The body** (`egLordFallAct`, which `egBodyAct` answers for a fallen lord): its hurt picture to the floor by 1.5 s -
  Daggerfall's hurt records hold one frame each (TEXTURE.270 and 280-291, records 10-14), so the frame index the gate's
  formula runs is one held picture, as the gate's own is (AUDIT EG-FALL L1-5) - then sunk into the stone over the rest of
  2.4 s, then gone. A winged body falls beating its wings (the Mother of Dusk aloft: her winged table looped at the flyers'
  ten a second, as the gate's host's winged fall - L1-5), and a flyer drops out of its hover by the thud (`aloft`). It lies
  where it fell: the place first seen fallen is held (`placeOf`), never carried on by a walk said before the fall nor moved
  by a later word, and the relay stops a felled lord's walk at its fall (`egStop` in `egLordHit`, relay world248), so the
  place the room says once its whole fight is heard is taken and every screen lays it in one place (AUDIT EG-FALL L1-2,
  L2-2).
- **The kill**: its death cry (the gate's `fall` cue in the lord's own bark - `egFallCry`; a Daedra Lord's is the gate's
  own), a burst of Dagon's size out of its chest - a flyer's in the air it fell from (L1-4) - whose sparks rest on its
  floor, the hall's light white for 0.4 s, and the camera shaken 4 under the Spire's motion law (`egShakeMotion`: reduced
  motion none, Technique camera motion its share).
- **The thud** at 1.5 s, and three embers rising off the floor a quarter second apart; its ember's glow at its chest dies
  over the fall, dropping with a flyer. The ember is the gate's own under the lord's element's aspect (`egLordEmber`: fire
  the Burning's, frost the Rime's, shock the Storm's, poison the Venom's; Vael the fire and Isk the frost; no element, its
  band's).
- **Its body left**: its mobile's own corpse (`enemyBasics.js` `corpseTexture`; every lord's mobile has one, and every one
  stands in Daggerfall's files - TEXTURE.096, 306, 400 and 405) where it fell, grown as the lord is - Grath's 9.0 by 4.2 m -
  with no giant's shadow (OW-BIG's law). It lies there while the fight keeps the lord, and is put away when the Twin is
  raised (her next fall plays again from its own instant, also when the screen never saw her stand), when the lord leaves
  the fight, at a new hall even before its fight is heard, and when the breach is left.
- **One fall is one fall** (AUDIT EG-FALL L1-1, L2-1): a lord that is not its fight's last to fall (a Twin's first, the
  Old Masters', Clan Feud's) is told by `efl` alone, which the link stamps at its arrival, and the next whole fight (`efs`,
  every 2 s) brings the relay's own instant. The moved instant re-anchors the fall (`EG_FALL_SAME_MS`, a fall's span: no
  lord is raised and felled again inside one), where before it played the whole fall a second time - a second cry, shake,
  burst, thud and column in five of the eight timings the audit swept.
- Each beat plays once a fall, and only while news, as the gate's do: a screen that comes to the hall later sees the
  corpse on the floor and hears nothing.
- The sparks are drawn by the gate's spark pass (`render/gate/gateFx.js`) in the fight's world pass, after the telegraph
  floors (`egFight.js` `drawPass`), sized by the world image's height as the Hour sizes them (L1-7). The pass is warmed while
  a lord stands, so the kill's frame links nothing, and freed with the breach (`GateFxRenderer.destroy`, new - L1-6). The
  corpses ride the fight's batches, and the flash and glow - each a record refilled in place - ride its lights: at most two
  a fall, the flash's 0.4 s and the glow's 2.4 s (AUDIT EG-FALL L3-2). Neither casts a shadow: the Spire's light seam
  (`world/eliteGates/egHall.js` `egLightsWith`) now honours a light's `carried` mask as the gate's does; it had dropped it,
  and the fall's two lights took shadow casters' slots (L1-3).

**The four hosts.** None touched (HOST-SPLIT): the fall rides the fight's own batches, lights and world pass, which
`scenes/eliteGates/egClient.js` hands on (AUDIT EG-FALL L3-11).

**DFU, and the departures.** Not a DFU member. Daggerfall Unity's foe has no fall of its own: `EnemyDeath.CompleteDeath`
sets it inactive at once (`gameObject.SetActive(false)`), lays a lootable corpse marker in its corpse picture
(`GameObjectHelper.CreateLootableCorpseMarker`) and plays `SoundClips.BodyFall` where it lies. The gate's fall (WB13e) is
the port's own and departs from that - the fall itself, the corpse laid at 2.4 s, BodyFall at the thud pitched for his size
- and this follows the gate (AUDIT EG-FALL L3-3: the record said DaggerfallEnemy, and none of the beats DFU does have).
It departs from the gate four times: the cry is the lord's own voice where the gate's is always the Warden's; the kill's
sparks rest on the floor where the gate's rest at his chest's height; the corpse casts no shadow where the gate's does; and
a Colossal lord's sink and corpse grow with its size where the gate's Colossal Warden keeps 1.5 m and 3 (L1-8, L3-5).
Ledger A's ELITE-GATES row names the file; no row of its own (the lords are no DFU foes - WB13's precedent).

**The relay.** world248 (`src/net/wire.js` `RELAY_VERSION`; NOT YET DEPLOYED - world240 on its branch, renumbered past
main's world240 to world247 at the merge): `egLordHit` stops a felled lord's walk. No word changes and no client gate: a
page facing an older relay holds the fall's place itself, and an older page reads the stop as any walk's. Its law row in
`test/net/relayversion.test.js` (796f8ce9...; 89a91c15... as world240 on the branch); the version pins of 43 test files
moved to it (PIN MOVED), and `tools/mutants/soc1.json`'s S38 re-aimed.

**Pins.** `test/net/eliteGates/eg_lordfall.test.js` (20 - fourteen through `egFight.js`'s own draw path over a recording
renderer and audio engine, the others the module's law, its pass over a recording WebGL, and the Spire's light seam; the
last, Daggerfall's own pictures, runs where ARENA2 stands - `tools/fetch-data.sh` - and skips where it does not) and
`test/net/eliteGates/eg_lordfall_relay.test.js` (2, the relay's own words: the director runs the Twin Court, `egLordHit`
fells the lord, each word crosses the wire's check and folds at its own arrival - the two bugs, each failing at the audited
head). `test/scenes/nudedecor.test.js` names the new billboard host (NUDE-HOSTS: a corpse, never a person).
`tools/mutants/eg_fall.json`: 78 (the first run's 37, twelve re-aimed where the audit moved their lines; one a fix; L2's
21 surviving gaps on the new code; the first run of the audit's own records left five alive - the flash moved at a
re-anchor, the stopped and the walking row's place, the fight's warm, a destroyed pass's draw - and each was pinned), all dead. `tools/mutants/wb13e.json` and `wb8c.json`: one record each re-aimed at the
gate's named numbers.

**Left as it is, said.** Not seen on a running screen: a breach needs a relay and a company. What was read instead is the
draw path, the renderer's, the audio's and the GL's calls, and Daggerfall's own pictures measured where ARENA2 stands - the
reason is the relay, never the data (AUDIT EG-FALL L3-4: this record first gave ARENA2 as the reason, against CLAUDE.md's
freeware rule). The FELLED card still stands at the word's arrival (the gate's waits 1.7 s, over his spoils). The legion's
adds fall as they did (1.2 s, `edie`), and a mirror still crumbles. A raised Twin stands at once; she does not climb up out
of the floor. Under a relay before world248, a screen that comes to the hall after a walking lord fell lays the corpse where
that relay carried it.

### EG-SPANS-HELD - 2026-10-22 - THE SPANS' CLOCK PIN ON A HELD PAGE CLOCK

The site's deploy 1592 (#1126's merge, `d4c96bea7`) was refused by `verify / tests 8/8`, on the one failure among that
shard's 3,948 tests: EG-ZD's THE SPANS' CLOCK in `test/net/eliteGates/egz_return.test.js`, *not re-anchored for a wander
under the step*. The tree was #1126's head's to the byte (`fb8bde413`), whose check had passed the same pin, and AUDIT
QUESTLINES had seen it fail once under load and pass alone (`01-Overview/audits/Audit-Questlines.md`, "Not this arc's") -
named there for this arc.

**Why it failed.** `spanSeconds` reads render/deadlands.js `anchoredClock`, which carries the seconds on the page's clock
(`performance.now()`) from an anchor on the wall. The pin held the wall (`Date.now`) and not the page's clock: between the
two reads it compared, the wall stepped the round trip's 100 ms and the page's clock moved by whatever the runner spent on
a frame and a ping's answer - and the pin allowed that 50 ms. A busy runner spent more, and the seconds moved by it, as
the law says they should: the pin was wrong, not the clock. Reproduced: a 60 ms stall between the two reads fails it on
that assertion.

**The fix** is 52aff580b's (#1124, the staff panel's branch, which had reproduced it under load on its own): the pin holds
the page's clock still as well, so the seconds move only when the anchor is taken again - a wander under the step leaves
them where they stood, where taking the anchor again moves them 103 ms, either side of the pin's 50. This record's branch
made the same fix after the deploy failed and withdrew it at the merge (main's is the file). The same stall passes it.

**The pins.** `tools/mutants/egz_return.json` - 71, every one dead on the held clock, the spans' five among them
(EGZ-spans-clock-outside, EGZ-reanchor-every-sample, EGZ-reanchor-never, EGZ-host-spans-on-the-welcome and
EGZ-host-egnow-on-the-welcome).

**Left, said.** `prof3_client`, the other test the audit named, strikes the Anvil on real 400 ms timers; it is the
Anvil's arc's, and not touched here.

**The game.** Nothing in `src/` moved. **The four hosts.** None touched (HOST-SPLIT).
