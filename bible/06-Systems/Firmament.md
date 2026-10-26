# The Firmament - a passive tree for everything you can do online (FIRM1)

> Design page and record (2026-10-13). One pull request, five parts: the sky and the law (`src/net/firmament/firmamentTree.js`,
> `src/net/firmament/firmamentLaw.js`), the account service (`server-account/src/firmament.js`, migration 0114), the client's book
> and powers (`src/net/firmament/firmamentBook.js`, `src/systems/firmamentLive.js`, `src/systems/firmamentPowers.js`), the window
> (`src/ui/firmamentWindow.js`; its door in `firmamentOver.js` taken out by GROWTH3, `10-UI/Growth.md` - the file keeps RVN-STARS' revenant door) and the lab (`firmament.html`). Where this page and the code
> disagree, the code's own headers and the pins are what runs.

## 1. What was asked

The lead dev, on Discord (2026-10-13):

> *"with the POE tree stuff, i would recommend almost 1to1 copy pasting its structure and then attach everything you can
> do in daggerfall online to it, Magic, Phys based attacks and skills, trading, gathering, hunting, ship controls/ocean
> stuff in general and all that. So ppl can be a awesome trader, or a better gatherer crafter etc. guilds will also
> benefit from it ... make sure the tree looks awesome and investing points in there feels rewarding. Must suit DFO
> Grimoire and Enhanced plus ui. Albion online also uses this idea aswell and its also an sandbox mmorpg."*

And the one condition put beside it: **without destroying the balance of PvE.**

## 2. What was measured

- **Renown is online's own level, the service's word** (`net/renown.js`): derived by the account service, signed into the
  identity token, never in the save, 1 to 50. It is the one level a modified client cannot raise - so it pays for the
  sky.
- **The professions are the service's** (`net/professionLaw.js`, `server-account/src/professions.js`): ten tracks of 0 to
  100, every harvest's yield and XP the service's own dice. A gatherer's and a crafter's progress is already counted
  where nobody can print it - so it pays for the life ring, Albion's way: you become a better miner by mining.
- **The seams already exist.** The Sigil Sets, the loot powers and the Arcane paths opened a named registry for every
  place the port may say something DFU does not: the entity fold (`entityMods.js` - attributes, skills, saving throws,
  armour, the carry, standing, the wardrobe's warmth and fatigue), the weapon blow, the spell's power, pierce, price and
  pace, the damage door and its blow evasion, the absorption chance, the kill and the magic round. Each of them already
  answers only MY entity at a foe, sleeps in a refereed fight (`sigil.js sigilDueling`) and never touches a blow or a
  spell at another player. The sky rides those seams and inherits every one of those guarantees.

## 3. The sky (`src/net/firmament/firmamentTree.js`)

Path of Exile's shape, one for one, laid on Tamriel's sky. **518 stars, 589 lines.**

| PoE | The Firmament | Attributes | Its fight | Its life wedge |
|---|---|---|---|---|
| Witch (top) | **The Mage** | Intelligence | destruction, magicka, the price and pace of a spell, wards; *Atronach's Pact* | Enchanting, Physician, Alchemy; *Scholar's Seclusion* |
| Shadow | **The Shadow** | Agility, Intelligence | stealth, the unseen blow, illusion, the short blade; *Night Mother's Embrace* | Trading, the caravan, the fence, the courts; *Merchant Prince* |
| Ranger | **The Thief** | Agility | the bow, the dodge, the run, the beast-hunter; *Wind Runner* | Hunting, Outfitting, climbing; *Lord of the Hunt* |
| Duelist (foot) | **The Steed** | Speed, Strength | the long blade, the charge, the fist, stamina; *Steed's Charge* | Seafaring, Fishing, the road; *Master and Commander* |
| Marauder | **The Warrior** | Strength, Endurance | the axe, the hammer, armour, health, fury; *Berserker's Fury* | Mining, Smithing, Building, Logging; *Stonebreaker's Oath* |
| Templar | **The Ritual** | Willpower, Strength | restoration, the undead and the daedra, the spellsword, wards; *Martyr's Vow* | Herbalism, Provisioning, the weather; *Hermit's Covenant* |
| Scion (middle) | **The Serpent** | Luck | walks to every sign | - |

- **The inner sky (to r 800) is combat.** Each sign's spoke of its attributes runs out to the ring road at r 400, its
  radial on to its keystone at r 800. Seven clusters a sign - wheels round two notables, a fork, a chain, and its own
  small wheel by its spoke - 72 named combat notables in all.
- **The outer sky (r 900 on) is the life ring** - Albion's destiny board laid round PoE's. Each sign's wedge holds the
  trades that sit with it, four clusters and a life keystone, 42 named life notables.
- **The Wayfarer's Roads** run between the signs (each sign's bearing plus 30) from the inner ring out to the life ring.
  They are life stars (the carry, the road's fatigue, the fall), so a character with Craft points and no Stars can walk
  out to the trades.
- **The battle keystones trade**: each gives much and costs a little (*Atronach's Pact*: +12% spell damage, spells 8%
  cheaper, blows land 7% harder; *Night Mother's Embrace*: +30% against unaware foes, -5% in an open fight). Their
  prices were halved on the lead dev's word (2026-10-13: "halve all negative damage traits"), rounded toward the
  smaller price.
- **The trades take nothing away**: no star of the life ring - its keystones included (*Merchant Prince*: +20
  Mercantile, +10 Etiquette) - carries a negative (the lead dev, same day: "the crafting and gathering nodes shouldnt
  have negatives"); the law's suite pins it.
- **Persisted data**: an allocation is a list of star keys (`wr.c1.3`). A key never changes once shipped; a star taken out
  of the sky is refunded by the law (`cleanKeys` drops a key no table holds), and every star that reached the start only
  through it drops with it, free (`unpackTree` keeps the stars still joined - AUDIT UICALM-FIRM1 L1 L4: the orphans had
  stayed in the row paying their stats, and a later refund billed them). The keys are pinned by hash
  (`test/net/firmament/firm1_law.test.js`), so a layout change that would move one fails the suite.

## 4. The purses and the law (`src/net/firmament/firmamentLaw.js`)

- **Stars**: 2 for every Renown level past the first (98 at Renown 50 - the lead dev: "make it 1 point per renown level", then "make it 2 points per level up"). Spent anywhere. With the Craft purse full beside it (125) a character holds at most 223 of the 518 stars: nobody ever fills the sky, and the caps (section 4.1) hold however many are spent.
- **Craft points**: 1 for every 8 profession ranks, summed over the ten tracks (125 at ten Masters). Spent on the life
  ring alone. An allocation **fits** when its combat stars cost no more than the Stars and all of it no more than both
  purses together - the life ring takes Craft first.
- **A tree is judged whole** (`treeFault`): one start, every star joined to it through stars held, no key the sky has not,
  within the purses. A keystone ends its road; another sign's start is never walked through. `pathTo` is PoE's path
  preview (the shortest way from what is held); `refundTakes` is a refund's cascade (the star and everything that only
  reached the sign through it).
- **A refund is free below Renown 10**, so a new character learns the sky by trying it; after that it costs **10 silver a
  star** (Marks - the one currency a client cannot print - burnt in the change's own batch). Changing sign takes every
  star back.
- **Build sharing** (the lead dev, 2026-10-13: "Build sharing. A short build code you can paste in Discord and load
  into the tree"): the Share press in the bar shows the stars as they stand in the window as a code -
  `FIRM-<sky>-<stars>` (`firmamentLaw.js buildCode`: a bitmask over the sky's sorted keys, base64 with `-+`, runs of
  empty letters written `.` and their length; a one-sign build is some twenty letters) - with a Copy press, and a field
  to paste one in. A code loads as the window's changes, to accept like any other, once the law judges it against this
  character's purses (`treeOfCode`, `treeFault`): a build that needs more Stars or Craft says how many. `<sky>` is four
  hex of the sky's own key list, so a code made before stars were added is refused, never read as another build.
- **A Renown level is said as an Ascend is** (the lead dev, 2026-10-13: "when leveling up a renown give the player the
  same message as he would ascend"): the level's fanfare, and on the enhanced skin the HUD strip's gold row - "You have
  risen", the Renown and its new Stars (`ui/levelUp/levelNotice.js announceRenownRise`); the classic skin says it in a line. It
  owes nothing, so the row goes as news goes. Every road a rise is heard by (a report's answer, a writ's) says it through
  `scenes/world.js renownRose`, once.
- **The respec** (the lead dev, 2026-10-13: "let the player respec for 10k gold add an respec button to this in the upper
  block"): the whole sky back at once - every star and the birthsign, to choose again - for **10,000 gold**
  (`FIRM_RESPEC_GOLD`), whatever the Renown, and no silver. The Respec press stands in the window's bar.
- **Raw points on the key stars, percentages on the small** (the lead dev, same day: "combined with the ascend system
  you will get waaay to many stat points just add stats with raw numbers to the key nodes and percentages to the
  smaller ones"): the starts, the notables and the keystones keep their raw points; every small star and road says its
  attribute, skill, Health and Spell Points as a share of the character's own (`pct.<attribute>`, `skillPct.<skill>`,
  `hpPct`, `mpPct` - one for one since FIRM2 (they were doubled), Health and Spell Points half over; `firmamentTree.js
  smallStats`), and its Armor Rating as a percent less damage from blows. A share is of the permanent value - Ascend's
  points in it - floored, so Ascend's points are never matched point for point. Resistances read as the percent chance
  they are on the saving throw's hundred.

- **FIRM2 (2026-10-15) - every star counts, and the sky may lift a stat past 100** (the lead dev: "lower the values"): the caps stay; the stars came down. Summed over one sign's whole sky (`tools/firmamentRebalance.mjs` prints the check), 43 channels passed their cap, 29 of them still once the small stars went one for one - a path star at +6% and a chain at +4% meant a Mage's `pct.intelligence` stood at 36 against a 15 cap, so a third of its stars bought nothing. Small stars' attribute and skill shares are now one for one - a star's authored points as a percent, where they had been doubled (+1% to +4% a star) - and the notables, keystones and life stars were scaled down in whole numbers until no channel of any sign sums past its cap (`test/net/firmament/firm2_balance.test.js` holds it). And the sky's attribute bonus lifts the attribute ceiling by what it adds - FIRM-MAX's `statMax` (4.1 below): a 100 Strength with the sky's whole +15 reads 115 (`test/systems/audit_uicalm_firm1.test.js`), and Ascend's points alone stop at 100.

- **BAL10 (2026-10-17) - every weapon family two notables of its own** (`05-Combat/Balance-Arc.md` section 16; the owner chose "Firmament weapon keystones" of the martial pass, `05-Combat/Martial-Specialisations.md`): Blade Dancer, Iron Knuckles, Headsman and Bonebreaker each raise their family's skill beside every stat they had (AUDIT MARTIAL L2 F9: the first cut traded a stat for the skill line), Carnage turns to the axe, and the Ritual's Battlemage's Focus is its Templar's Mace (the Ritual stands in PoE's Templar's place - and the Elite Gates' Vestige keeps the old name its own). Stats moved, never a key nor a star: the layout, the keys' hash and every build code stand, FIRM2's caps hold. And the fist channel acts at last: no blow modifier had reached a bare-handed blow, so Pankration's and Iron Knuckles' fist damage did nothing until BAL10 made both cores read them.

### 4.1 The budget - why PvE stays where it is

1. **Every channel is capped** for the whole sky, however it is spent (`STAT_DEFS`), a key star's raw points and a small
   star's share of the same attribute, skill, Health or Spell Points held TOGETHER to its one budget
   (`firmamentPowers.js` capAt - AUDIT UICALM-FIRM1 L1 H1: capped apart they made +21 Strength and +86 Health): an
   attribute +15, a combat skill +15, a spell's damage +30%, its price 25% off at most, casting speed +15%, blows at most 15% lighter, +75 health and
   magicka, a 10% chance to evade a blow ...
   **An attribute's gain lands on a maxed stat** (FIRM-MAX, 2026-10-15, asked of the port: "normaly nodes like +6% speed
   and someone has 100speed already should count additionally to 100 speed ... all nodes should also work on maxed out
   stats"): the gain lifts that attribute's live ceiling by itself (`firmamentPowers.js` firmamentFold writes it on
   `entityMods.js` statMax, which `statMods.js liveStat` reads into its maxValue as it reads DFU's StatMaxMods), so The
   Steed's +2 Speed and the Path of the Sign's +2% (FIRM2's one for one; +6% before it) on a 100 read 104. A Fortify fills the lift and never passes it, and
   with the sky asleep the ceiling is `MaxStatValue` again. Skills needed nothing: their mods already sat on top of the
   softcap unclamped. A departure from `DaggerfallStats.GetLiveStatValue`'s ceiling for the sky's own gains alone. The siege's
   run ceiling still holds it: 115 Speed, the sky's whole +15, runs 15.3 m/s under `siegeRef.js` SIEGE_SPEED's 18 (its
   own comment derives 18 from a Speed of 100 and is left alone: `siegeRef.js` is in the relay's bundle, and a comment
   there is a new RELAY_VERSION).
2. **The blow's channels are capped again as a group** at the moment of the blow (`blowPct`): any weapon, melee, the
   weapon's family and the foe's kind together at most +30%; its conditions (an unaware foe, a wounded wielder) after
   that, and the whole at most +50%. The spell's price likewise (`castCostPct`).
3. **Keystones count against the same caps** - their gains with every other star's, and their PRICE paid after the
   cap, per channel (`treeStats`) and per group at the blow and the cast (`blowPct`, `castCostPct`), so a build already
   past a cap still pays it (AUDIT UICALM-FIRM1 L1 M2). The whole sky allocated at once - every one of its 518 stars - is still
   held to the budget; the pin allocates it and checks every channel.
4. **The Craft purse can never reach a fight**: every life star's stats are life channels (pinned star by star).
5. **The sky sleeps** offline (Daggerfall is exactly as it was), in a refereed fight (the duel, the arena), while
   mentoring, and never answers a blow or a spell at a player - the seams' own law. **In the Wrothgarian Mountains it
   fights the beasts** (the lead dev, 2026-10-13: "this should help in the wrotgarian zone against pve"): every channel
   acts against the zone's foes, and a player there is never struck harder for it - every strike or spell at a player
   (a duel's, a siege's, the zone's) is rolled on a sheet with the sky taken off (`firmamentPowers.js withoutFirmament`,
   `scenes/world.js` the seven sheets - four strikes and three spells), a player's blow lands on the referee's vitality and never through the sky's damage
   door, and a player felled feeds no kill star.
6. **Points are scarce and slow**: the Stars come with Renown, which the service bounds an hour, and Renown 50 is
   hundreds of hours. A Renown 20 character has 38 Stars against 295 combat stars to buy (302 with the seven free starts) - a
   specialisation, not a god. The Craft purse may pay the road to a combat star where the r400 ring's life crossroads lie
   on it (AUDIT UICALM-FIRM1 L1 N2, KEPT: the letter of "life ring alone" - a Craft point buys a life star, never a
   combat one).

The numbers are a first cut, every one named in one table (`STAT_DEFS`, the stars' own stats), so a balance pass moves
one number. The existing balance levers beside it are untouched: Renown's own health and magicka, Master Skills' foe
edge (`skillSoftcap.js combatEdge`), the loot's and the sets' caps.

## 5. The account service (`server-account/src/firmament.js`, migration 0114)

- `POST /v1/firmament/state { character }` - the tree, the purses read off the Renown track and the profession tracks,
  what is left, the refund's price.
- `POST /v1/firmament/set { character, tree, rid }` - **the whole tree** the character wants, judged by the law against
  the purses the service counts. One change is one request id (`firmament_sets`): asked twice it is answered from its
  row and charged once; made over a tree another change already replaced, it is refused (`firm-stale`).
- Behind **`FIRMAMENT_OPEN`** (`off` / `dev` / `on`) in `wrangler.toml`, shipped at `dev` (AUDIT UICALM-FIRM1 L2 M5: the
  drop had set `on` under this line's own comment), then opened: **`on`** (FIRMAMENT-ON, 2026-10-15, the owner at the
  audit's merge: "switch it on for players") - everyone's. The switch is the tree's WHOLE hand: shut, its stars move no trade
  either (`firmStatsFrom` - L2 M4), and the client's book holds no tree in force on a shut read.
- **The tree's hand on the trades is the service's**: a harvest reads the tree in its own round trip
  (`professions.js harvestNode`) - `yield.<profession>` on the quantity (the service's own die for the fraction, drawn
  only for a tree that moves it, so every other die falls as it did) and `xp.<profession>` on the XP. A smelt, a craft,
  a temper, a brew and a disenchant read it for their XP (`xp.smithing`, `xp.building`, `xp.outfitting`,
  `xp.provisioning`, `xp.enchanting`; the temper's AUDIT UICALM-FIRM1 L2 L3). A motherlode's strike and a writ's
  delivery do not (KEPT: a strike's share is the event's own, the same for every striker).
- A realm character's delete takes its sky with it (`realm.js deleteRealm`; its `firmament_sets` stay, the ids' memory -
  L2 L2).
- Refunds burn into the one ledger as `firmament` (`marksLaw.js MARKS_KINDS`).
- `POST /v1/firmament/respec { character, rid, realm?, region? }` - **the whole sky back for 10,000 gold**. A realm
  character's record pays it in the respec's own batch (`realm.js prepareRealmRecord`, `realmGoldLaw.js payFromSave` -
  the purse, its letters, then the Empire's account), asked first where the record stands (`realmActFirst`), so a respec
  whose answer was lost is read as landed and charged once; short of gold it is refused (`realm-gold`) and nothing
  moves. The client reserves the gold first and a refusal gives back exactly what it took (`firmamentBook.js respec`,
  `realmSaves.js realmGoldAct`). With no realm record there is no respec (`realm-needed` - AUDIT UICALM-FIRM1 L2 L1: it
  had been made free, answering `gold` it never took).

## 6. The client (`firmamentBook.js`, `firmamentLive.js`, `firmamentPowers.js`)

- **The book** reads the state when Renown is first heard and at every rise, when the window opens and when the seat is
  taken back (`world.js takeSeat`). A change is coalesced (ASYNC NEVER DROPS: the newest tree waits behind the one in
  flight), kept with its id when its answer does not come (`offline`, `server`, `no-session`, `firm-rate`, and the
  Worker's own `rate` and `maintenance`) and asked again at the next read; a kept change the service then refuses is
  said, not dropped. AN ID NAMES ONE TREE: a kept change's id is asked again for that tree alone, a newer tree is its
  own request, and the service refuses another tree under a made change's id (`firm-rid`). No change is taken while a
  respec is on its way (`firm-busy`). (AUDIT UICALM-FIRM1 L2 M1-M3, L4.)
- **A read the service never answered is read again by the book itself** (FIRM-RETRY, 2026-10-25, from a player's
  report: "Firmament fully bugged and im not getting any benefits from it"): after a read or a change that got one of the
  unheard words above, the book reads again after `FIRM_READ_RETRY_MS` (15 seconds), the wait doubling to
  `FIRM_READ_RETRY_MAX_MS` (2 minutes), until a read is answered; that read asks a kept change again. One retry waits at
  a time, and a refusal the service gave after it looked (`firm-closed`, a 404) is not read again. The tree in force
  comes only from a read, and the world host reads once, at the first Renown: when that read failed, only the enhanced
  HUD's star tile asked again (`hudAdvance.js`, its own two-minute retry, taken out), so on the classic HUD the
  character played with no stars until a Renown rise or the Growth tab.
- **`firmamentLive.js`** is a leaf: the tree in force, online alone, and asleep while mentoring (`setFirmamentMentoring`,
  from `world.js` partyFrame - the fold and the layer move that frame). The gathering acts read it there (the herb's
  window, `act.herbalism`; the tug's, `act.fishing`) and so does the sail under either helm (`comeSailAway.js` firmSail:
  `sailSpeed` on SAIL-FREE's pace and on the Classic drive).
- **`firmamentPowers.js`** lays the channels on the seams (registered at import with the one cast engine,
  `scenes/hostMagic.js`): the fold, the blow, the spell's power, pierce, price and pace, the damage door, the blow
  evasion, the absorption chance, the kill and the magic round's regeneration, and the health and magicka on
  **Renown's own online layer** (`renownLayer.js setOnlineLayerExtra` - never saved, its fraction kept).
- `spellPower.js` now lets a modifier's percent be negative (a keystone's price), floored at x0.5 (`SPELL_POWER_FLOOR`);
  every other modifier was positive, so nothing else moved.
- Trading is DFU's own price formula reading Mercantile and Personality, which the fold raises; swimming, climbing,
  lockpicking, pickpocketing and the courts' standing the same.

## 7. The window (`ui/firmamentWindow.js`)

The whole sky, drawn in the pause window's **Growth tab** on its Firmament page (GROWTH3, 2026-10-17, the owner: "give
the firmament, level up page, and specializations its own tab within the pause menu"; `10-UI/Growth.md` section 6) - the
window widened to nearly the screen's, a press to full screen, and on a phone a door that opens it over everything. It
was the Stats page's Firmament button beside Ascend, swapped in over the window (`firmamentOver.js`, that door taken out). Online
alone - offline the page says what the sky is and why it waits.

- Choose a sign (the seven great stars breathe until one is chosen); hover a star to read it and see the way to it lit;
  press to allocate the way; right-press (or long-press on a phone) to take a star back with everything beyond it; drag
  to pan, wheel or pinch to zoom, F for your sign, a search that lights every star whose words match.
- **Every change is pending** - free to try - until Confirm, which says what it allocates, what it refunds and the
  silver; the purses on the bar move as you plan. A tree that moves under the open window (a change accepted in
  another window, tab or device, heard through the book) starts the pending sky again from it - a birthsign alone
  included (FIRM-SIGNPANEL, 2026-10-25: a sign-only change had left the panel saying no birthsign was chosen).
- The side panel sums the sky as it stands, in a fight and in a life, and marks a channel held at its cap.
- **Above the sums, the side panel says whether the stars act now, and the first reason they do not** (FIRM-STATUS,
  2026-10-25, the same report as FIRM-RETRY: the sums are the stars held whether or not they act, so a sleeping sky
  looked like a broken one). `firmamentLive.js firmamentStatus` answers, in this order (the duel handed in from
  `sigil.js sigilDueling`, the word `firmamentPowers.js firmamentAwake` sleeps on, so the window does not load the powers): another tab or device holds the
  online seat (`seat`); the book has no answer from the service yet (`unread`); no birthsign accepted (`no-sign`);
  mentoring, the whole sky asleep (`mentoring`); a duel or an Arena bout, the combat stars asleep and the crafting and
  trade stars acting (`duel`); else every accepted star acts (`active`). The line moves with the book and with the
  online and mentoring words (`firmamentLive.js onFirmamentChange`). A lab sky (`preview`) says none.
- **Two dresses, one window.** Its frames are the kit's roles (`enhancedFrame.js FRAME_ROLES`: the bar and the side
  panel windows, the tip a panel, the presses buttons), so Enhanced Plus carves them in stone and brass and DFO Grimoire
  turns them into its pages, planks and red Exit with no rule of this file's. The sky is a canvas that reads the dress:
  on Plus a night of brass and gold, the life ring in verdigris, a still field of dust and glowing held stars; under
  the Grimoire a star-chart inked on the page - brown ink, gold leaf on a held star's rim, green ink for the life ring -
  at full resolution so every name reads. **A learned line is red** in both dresses, and the line a press would learn
  is the same red, fainter; nothing in the sky moves (no running dashes, no turning keystones, no breathing starts).
  **The sky is clean** (the lead dev, 2026-10-13: "those node circles should not overlap with lines ... dont show the
  names everywhere"): no line runs through a star it does not join (518 stars, none crossed - checked when the
  layout moves), no figure or lettering is drawn among the stars, and **only the six great keystones of the outer
  ring are named**, each outward into the dark; every other star names itself on its card. **The view holds the sky**:
  a wheel or a pinch stops at the whole sky in the frame, and a drag stops while the middle of the screen still
  looks at it, so it can never be pushed out of sight.
- **Under the DFO Grimoire the star's card and the word under the bar are scrolls** (the lead dev, 2026-10-13: "give
  the tooltips when hovering a scroll look the upper message also a scroll look"): parchment and ink between two wooden
  rods - once its art is read, the pack's own item scroll (REPR01I0), as the shelves' hover card is. Enhanced Plus keeps
  its stone panels ("dont use a scroll tooltip for enhanced plus").

## 8. Guilds

A guild gains from the sky the way Albion's do: its members specialise. A guild with a Merchant Prince, a Stonebreaker
and a Master Brewer fills its writs, its Stores and its halls faster than one of generalists; the Building and Smithing
XP stars (*Hall-Raiser*, *Lorekeeper*) feed the halls' and the seats' works directly. Guild-wide stars (a bonus a member
lends the whole guild) are the next slice (section 10).

## 9. Hosts and flags

- THE FOUR HOSTS RULE: the powers register in `scenes/hostMagic.js`, the cast engine every host builds, so all four
  read them; the tree is in force only where the page is online, which is `scenes/world.js` and the interiors and
  dungeons it streams (`worldModes.js`, `dungeonContext.js`). `scenes/exterior.js` - the single-town bench, offline -
  FLAGGED by name here: no sky on the bench, as no Renown.
- The seat's own: `world.js` `leaveSeat` takes the sky offline with the sigils, `takeSeat` brings it back.

## 10. What is next

- Guild-wide stars (an officer's bonus to the guild's writs or Stores) - the service's writs read the tree as the
  harvest does.
- The market's fee and tax (`marketLaw.js`) and the courier's - a trader's stars on the service's own numbers.
- Riding (the horse's pace) and naval gunnery (`naval/`) - seams to open.
- Jewel-like sockets: a Sigil set in the sky.
- A hotkey (P is the quick loot's).

## 11. Pins

`test/net/firmament/firm1_law.test.js` (16: the build code, the trades take nothing away, the sky's shape and spacing, the keys'
hash, the law, the purses, the budget whole), `test/net/firm1_service.test.js` (8: the respec, the switch, the purses, a
change judged whole, Craft for the life ring alone, a repeat, the refund's silver, the harvest's XP),
`test/systems/firm1_powers.test.js` (10: raw on the key stars, a maxed stat (FIRM-MAX), the Wrothgarian zone, offline, the fold, the duel and the mentor,
the blow, the spell, the damage and the layer, the acts), `test/net/firmament/firm1_book.test.js` (4: the respec, the read, a change
coalesced, a lost answer kept), `test/net/firmament/firm_book_retry.test.js` (5: FIRM-RETRY - the wait doubling to its
ceiling, one retry at a time, no retry over a refusal, a lost change asked again), `test/systems/firm_status.test.js`
(5: FIRM-STATUS - each status against what the stars fold), `test/ui/firm_signpanel.test.js` (2: FIRM-SIGNPANEL - a
birthsign accepted outside the open window is named on its side panel), `test/net/firmament/firm2_balance.test.js` (3: FIRM2 - no channel of a sign sums past its cap, a small star
one for one, the lift past 100), and the audit's `test/systems/audit_uicalm_firm1.test.js` (`01-Overview/audits/Audit-UICalm-Firm1.md`). The lab: `firmament.html`
(`?dress=grimoire` for the Grimoire, `?fresh=1`, `?renown=`, `?ranks=`).
