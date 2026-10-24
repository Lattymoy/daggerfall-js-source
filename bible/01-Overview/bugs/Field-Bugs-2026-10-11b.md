# FIELD BUGS 2026-10-11b - ten Discord bug reports

(Named 2026-10-11 until main's #773 took that wave's name, `01-Overview/bugs/Field-Bugs-2026-10-11.md`; its pages, pins and
records renamed with it, as FIELD BUGS 2026-10-09g was.)

Ten threads from the Discord's #bug-reports, handed over as screenshots on the evening of 2026-10-10. Each was traced
through the code first. Seven changes ship (CAMP-FIRE, CART-SLOT, OFFER-ID, JUMP-SLOW, LEGEND-HELD, HOME-LINE,
FULL-GUARD). Four of them are the owner's calls, put to the owner as questions: three are departures from DFU and one
changes the yard rule HOME-FOOT left. The owner chose each one, and on the Legendary's bill said: "I dont care about DFU
parity wtf". Three reports have no code to change: one is Daggerfall's own talk law, one was fixed on main the day before
it was posted, and one does not reproduce. The Morrowind foes that could not be hit could not be pinned from the code,
and the questions the reporter is owed are written below.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "NPCs having massively negative opinion after 'Word travels' update" - not a criminal, Commoners +9, "even the members of my guilds wont answer questions" (BunnyHoppin') | DFU's talk law: whether a person answers is the player's Personality, the tone and its skill roll against the person's own seeded roll (TalkManager GetReactionToPlayer_0_1_2). No reputation is in it, in DFU or here, and LW16's repute never reaches the talk window | no change (below) |
| 2 | "The caravan became a cart after the update" (Biorat) | the Enhanced inventory's Cart cell named the FIRST wagon owned - a Small Cart kept beside a Caravan bought after it - while the world drove the Caravan | fixed (CART-SLOT) |
| 3 | "Unidenitified items" - "If you trade someone unidentified items and they identify them, They will not be identified when traded back" (Masta_Fu, again 10-10: "Has this been fixed?") | does not reproduce: TRADE-KNOWN's guard pin (FIELD BUGS 2026-10-01) holds both ways a trade settles. Found beside it: a realm trade of a piece looted since the last checkpoint was refused whole | OFFER-ID fixed; the report open (below) |
| 4 | "Morrowind model enemies don't take damage" - 2 in 4 fast-travel encounters, can't hit them and they can't hit me, only with the Morrowind models on (Masta_Fu) | the Morrowind bodies are draw-only - no hit test reads them. Not pinned from the code | open: the reporter's facts asked for (below) |
| 5 | "The Morrowind Model For a Caravan Campfire is a Dead Dude" (Rook) | a road camp's fire went to the sprite lane as a still flat nobody talks to - the shape MWNPC10c reads as the fallen | fixed (CAMP-FIRE) |
| 6 | "One shot bug" - "I get one hit killed several times a day" (YeetMaster64) | BAL2's crit for every striker, BAL4's offline elites (x3) and the Enhanced AI's telegraphed slams (x1.75) stacked with nothing to cap them | done (FULL-GUARD), a departure |
| 7 | "Equipping legendary shield Aegis of Dawn damage it by 1/3 of its durability" (Boar) | DFU's Cast-When-Held equip bill (CastWhenHeld.cs) - the Aegis's Spell Resistance costs a leather buckler a third of its condition | done (LEGEND-HELD), a departure |
| 8 | "Some materials im holding are not being counted for in-house crafting" - no copper, silver lower (SaberGGaming) | the old station count (`book.held`: the Stores and the service's counted units). BAG-CRAFT (FIELD BUGS 2026-10-09d) made every station read `workable` the day before | fixed on main already (below) |
| 9 | "Fix slowfalling" - "you cant jump with slowfalling", and the falls into corners (BigOOF) | DFU's own jump cancel (AcrobatMotor.cs:64-70), and its rise set to the spell's fall speed from the first airborne step | done (JUMP-SLOW), a departure |
| 10 | "Property Problem" - "I can't place in front of my door but I can place in front of another's home" (ShikiX3); "my property line goes a little far into the property beside me" (afjiz) | the first half was HOME-FOOT's (FIELD BUGS 2026-10-09). The second was the lot's own rule: a house grown 6 m, never shared, so two lots overlapped | done (HOME-LINE) |

## CAMP-FIRE: a road camp's fire is its flame, never one of the fallen (5)

`scenes/livingWorld/livingRoads.js`, `world/travellerSprites.js` drawBodies. The roads' layer (LW9) hands the traveller sprites a
lit camp's fire as an entry like a person's: `{ res: { id: 'fire:<trip>', name: '' }, talk: false, flat: FIRE_FLAT }`.
MWNPC10c's Morrowind lane stands a body for every entry on the ground and draws it dead where it is "a flat no one talks
to" - the road's fallen are exactly that (`corpseLook`). So with the Morrowind bodies on, every camp's fire stood as a
dead Breton (residentLook of an empty resident), and its flame's billboard was left `castOnly`: the shadow drew and the
fire did not. The two slices were each right alone and met when #749 merged.

Now the fire says it is nobody (`body: false`), the sprite keeps the word (`b.body`), and drawBodies stands no body for
it: the flame draws as it does with the Morrowind bodies off. The fallen beside it still lie dead. THE FOUR HOSTS: the
roads' layer is world.js's alone (the streaming host); exterior.js, worldModes.js and dungeonContext.js stand no road.
Pinned by `test/systems/livingWorld/fb1011b_campfire.test.js` (2, on the real roads' layer's own fire through the real sprites over a
recording lane); `tools/mutants/fb1011b.json`.

## CART-SLOT: the Cart cell is the wagon driven (2)

`systems/inventorySession.js` transportItem. Every wagon is the Small Cart's template (WAGONS1 marks the kind on the
item), and the Enhanced inventory's Cart cell drew `transportItem(items, 'cart')`, the first item of that template. A
player who kept their Small Cart and bought a Caravan after it (WAGONS1: "the cart left over is an empty cart to sell")
saw "Small Cart" and the cart's picture in the cell, while the world drew, drove and parked the Caravan
(`wagonKinds.js` activeWagonItem - the best owned). Nothing in the save changed. Now the cell asks the same law the world
asks. The Mount cell is unmoved.

Two other readings were checked and are not this. The living world's merchant parties draw the Small Cart by design
(`world/road/roadTeams.js` ROAD_WAGON_KIND, Living-World-II.md section 3.3). A peer's parked Caravan comes back as the Small
Cart from a relay older than world187 (Wagons.md). The reporter can be asked which wagon it was, but the cell was wrong
either way. Pinned by `test/systems/fb1011b_cartslot.test.js` (3); `tools/mutants/fb1011b.json`.

## OFFER-ID: an offered piece carries its id from the offer (3)

`systems/tradePack.js` wire. INT4 gives every valuable piece its id at the realm's checkpoint (`world.js` realmCheckpoint
-> `itemIds.js` stampItemIds). A trade's offer is written for the wire when it is made (`tradeSession.js` setOffer), and
the trade's hold checkpoints after that. So a piece looted since the last checkpoint stood in the realm's record with an
id its offer did not carry. `uid` is not one of the fields a trade lets differ (`realmTradeLaw.js` recordIsOffered over
TRADE_VOLATILE_FIELDS), so the whole trade was refused: "The realm could not find the goods offered - nothing was
traded." It was reproduced on the real account Worker. Now the offer stamps the pieces it holds out with the id the
checkpoint would give them, and a piece that already has one keeps it. The stamp is handed to the pack by the host
(world.js passes `stampItemIds`) rather than imported: itemIds.js reads the item law, and importing the law installs it
into the wire's clamp for every reader of tradePack.js - CI's first run of this branch found it, when a Soulbound pin's
own fixture stopped passing the clamp (`test/systems/soulbound_break_once.test.js`).

The report itself - a piece identified by its new holder coming back unknown - still does not reproduce. TRADE-KNOWN
(`01-Overview/bugs/Field-Bugs-2026-10-01.md`) pinned the round trip hand to hand and through the realm, and both pins pass
here with the mods on and with ids stamped. The one way left is the one TRADE-KNOWN named: identifying a piece is not a
realm act. It rides the identifier's next checkpoint, so a tab that joins again before one lands plays the older record.
The reporter is owed the same two questions: did the trade window show the known name, and is the piece known after a
relog? Pinned by `test/systems/fb1011b_offerid.test.js` (3, the realm round through the real Worker, and the host's hand-off by
source); realm0's pin on the host's pack line moved (PIN MOVED) and its record re-aimed by content;
`tools/mutants/fb1011b.json`.

## JUMP-SLOW: the jump given back under Slowfall (9)

`player/motor.js`. DFU refuses a jump while the player is slow falling. It is one clause of HandleJumpInput's four-clause
cancel (AcrobatMotor.cs:64-70, `IsSlowFalling`), and the port carried it. Dropping the clause alone gave a rise of one
tick (0.069 m), because DFU's ApplyGravity sets the fall speed rather than adding to it, from the first airborne step
(F032). Now neither holds a jump: the clause is gone, and ApplyGravity leaves a jump's rise alone (`!(this.jumping &&
this.velY > 0)`). The jump reaches the plain jump's 0.47 m, the spell takes the descent from the apex at its 2.1 m/s, and
the landing bills no fall. It is still ground-gated (the 0.1 s bunny-hop clock), so Jump in the air does nothing and the
spell is no stair. A ledge walked off is unchanged. The parkour leap and the techniques' leaps stay refused under the
spell (`_pkMayLeap`). [SUPERSEDED BY LEAP-SLOW (Field-Bugs-2026-10-18d): the techniques' leaps go from the ground
under the spell; the parkour leap stays refused.]

"Always fall into these corners" is DFU's frozen air momentum (`airControl = false`): the speed the body left the ground
with is replayed through the fall, and the spell makes every drop of more than a metre five times longer. Into a 3 m pit
at a walk, the body glides to the far wall and SLOW-PRESS (FIELD BUGS 2026-10-01) holds it there. Giving the glide air
control is a larger departure, and it rewrites four of fb1001_slowaudit's pins. It was offered to the owner, who chose
the jump alone. THE FOUR HOSTS: the motor is every host's. A departure, Port-Ledger A. Pinned by
`test/player/fb1011b_jumpslow.test.js` (3); `tools/mutants/fb1011b.json` (and AUDITCLIMB1-F7's record re-aimed by content: the
gate's line lost its slowfall clause).

## LEGEND-HELD: a Legendary goes on at the condition it had (7)

`systems/enchantments.js` heldEquipBill. DFU bills a Cast-When-Held spell's whole casting cost in condition when the piece
goes on (CastWhenHeld.cs InstantiateSpellBundle). HELD-REWEAR (FIELD BUGS 2026-10-09f) made a re-wear inside six hours
free and stopped the bill at 1 condition, but the first wear still paid the whole cost. The Aegis of Dawn's held Spell
Resistance is the dearest of the Legendaries' (LOOT3 kept it as LR2 shipped it, `06-Systems/Loot-Arc.md`), and on a
leather Buckler (512 condition, 1.00 kg, the card's "+1") its bill was about a third: the card's "Slightly Used 66%". Now a
Legendary's equip bills nothing. That holds for every piece already minted, because the law reads the piece's tier, not
its record. Its wear while worn (DFU's MagicRound arm) is unmoved, and every other held piece keeps the bill. THE FOUR
HOSTS: the equip table's door. A departure, Port-Ledger A (HELD-REWEAR's row narrowed beside it). Pinned by
`test/systems/fb1011b_legendheld.test.js` (2, the ladder's own Aegis on a Buckler); `tools/mutants/fb1011b.json`.

## HOME-LINE: the ground between two houses split down its middle (10)

`scenes/homeYards.js` yardWhyNot, `yardGapTo`. Half of ShikiX3's report was HOME-FOOT's (FIELD BUGS 2026-10-09): the
step before an L-shaped house's door read as inside the house. The other half was the lot's own rule. A lot is the house
grown YARD_MARGIN (6 m) and is never shared with a neighbour, so two houses closer than 12 m overlapped, and the owner
could decorate before a neighbour's door. HOME-FOOT wrote that down as the rule ("A stranger's door within the owner's lot
may still be decorated before"), and afjiz's "my property line goes a little far into the property beside me" is the
same overlap. Now no part of a piece - its middle or any corner of its ground - may stand nearer another building's
ground than the house's own. A tie goes to the house. A piece that meets another building's ground is refused as it was,
wherever its points stand. The marked edge is still the lot's rectangle: the bar's word ("That is another building's
ground.") is where the line shows. THE FOUR HOSTS: the yards' law is world.js's (the streaming host, yardHost);
exterior.js stands no yard (FB1001), and worldModes.js and dungeonContext.js have none outdoors. Not a departure from DFU
(the yards are the port's, HOME-YARD). Pinned by `test/scenes/fb1011b_homeline.test.js` (3); three pins moved by intent
(`fb1009_yardfoot` twice, `fb1001_yard` once, each a PIN MOVED note); `tools/mutants/fb1011b.json`, and the two neighbour
records (YARD-CORNER's and HOME-YARD's) now name this file too.

## FULL-GUARD: no foe's one blow from full health (6)

`characters/playerEntity.js` hurtPlayer, `setFoeBlowProbe`; `systems/sigil/sigilSetPowers.js`. The Balance arc (BAL1-BAL4,
2026-10-10) raised the threat on purpose. BAL2 gave every striker the player's crit (`crit / (4 - luck)`, up to x2.0),
and BAL4 put the elites (x3) and the Enhanced AI's telegraphed blows (a lunge x1.5, a slam x1.75) in the offline game by
default. Nothing capped the stack. Simulated through the real `calculateAttackDamage` under PCAAO, against a level-12
player with 110 health: a level-12 elite Barbarian's claymore slam killed from full in 9.9% of landed slams (as much as
173 damage), and its lunge in 7.2%. A level-20 elite's slam killed in 14.1%.

Now a foe's one blow never takes a player at full health to dead. The damage door leaves them at 1 and tells the hurt as
what it took. It runs before every death save, so Malacath's Unbroken and the Hour Turns are not spent on such a blow
and are there for the next. A blow is what the set powers' law says one is: the attack formula's struck tail marks it,
and the door takes the mark as it opens (`pendingPlayerBlow`, handed to the door as a probe so the leaf imports none of
it). So a fall, a spell, a poison's round, a trap and a world boss's strike are not blows and kill from full as they did
(the gate boss's blows are its own law, `gateBrain.js`), and the next blow at 1 kills as it always has. The door is not asked on
a duel's blow (`spare`) or on a SetHealth(0) door, as for every set power. BAL2 and BAL4 are unmoved: the owner chose
the guard over reverting BAL2's crit. THE FOUR HOSTS: the one damage door every host's foes reach (world.js's foes,
guards and arrows; exterior.js's the same; worldModes.js's interior foes, guards and arrows; dungeonContext.js's melee
and arrows) - no host seam. A departure, Port-Ledger A. Pinned by `test/systems/sigil/fb1011b_fullguard.test.js` (3, on the real
attack formula's tail, the real door and Malacath's real Unbroken); six pins moved by intent, each a PIN MOVED note: a
killing blow that was dealt from full now starts a point short of it (`revenant`, `revenant_card`, `sd9d_numidium`
four times); `tools/mutants/fb1011b.json`.

## The three that are not the code's to change

**Repute and the talk window (1).** LW16 (the word travels) moves only a stranger's regard in the Living World, read and
never stored. That regard has one reader in the game, Project Legacy's courting topic, and it never reaches the court
because the repute stops short of a friend's. The talk window's answer tier is DFU's, cited at TalkManager.cs:663-667:
`Personality / 5`, the question's modifier and the tone's (Polite reads Etiquette, Blunt reads Streetwise, each with a
skill roll that adds 5 or takes 10), against a 0-20 roll seeded by the person. It is cached per tone for the
conversation. Faction and social-group reputation decides only the greeting and whether the person talks at all.
Simulated over 4,000 seeds at Personality 35 and Etiquette 15, a Polite question to a Commoner is refused 98% of the time
(Commoners take Etiquette's -10 and the failed roll's -10). The same player asking a Merchant Blunt is refused far less.
The screenshot's answer is ANSWERS_TO_DIRECTIONS row 18, a Merchant's refusal: a shopkeeper or a guild's member. Nothing
in the 10-10 deploy touched the tier, the reaction or Personality, and a walker's seed is drawn again each load, which
is why the morning could read differently. The reply to the reporter: answers follow Personality and the tone's skill,
not reputation - Blunt with commoners, Polite with nobles and scholars.

**The crafting count (8).** The screenshot's numbers are the old station count's exactly. `book.held` read the Stores
and only the units the account service counted out, so looted, bought or traded Copper read 0 and Silver read the
service's 47. BAG-CRAFT (FIELD BUGS 2026-10-09d, merged 2026-10-09) made every station read `book.workable` - the Stores
and everything the bag, the pack and the wagon hold - and `test/systems/fb1009d_bagcraft.test.js` pins it. The likeliest reading
is a client from before it, so the reporter can be asked for their update number. What main still does not count is a
house chest: `materialsBag.js` heldOf reads the pack, the bag and the wagon. Counting the house's storage at a home
station is a feature for the owner to ask for.

**The Morrowind foes that could not be hit (4).** The Morrowind bodies are draw-only on the encounter path. The ambush
spawns through `world.js` `_standEncounterFoe` into exteriorFoes, the player's swing and the foe's blow read the foe's
own `ai.feet` (`exteriorFoes.js` resolvePlayerHit), and the body is drawn from that same array. No commit of the week's
Morrowind work touches combat. So the three figures were likely not live foes of the local pool. The candidates, in
order:
- a beset road party's foes, drawn striking at it (`livingRoads.js`, a fight not stood);
- a road fight's allies (`shipmate`, the PlayerAlly team), which look exactly like foes when armed;
- the fast traveller's "unaware" gate (WILD-ALERT), which explains "they don't hit me" but not "I can't hit them".

What pins it, captured when it happens: whether each figure is in `exteriorFoes.foes` and its `puppet`, `shipmate`,
team and health before and after a swing; the roads' parties; online or not; and a try with the living world off.

## Records

Port-Ledger A: JUMP-SLOW, LEGEND-HELD, FULL-GUARD (and HELD-REWEAR's row narrowed). `03-World/Player-Arc.md` (the jump's
cancel list), `04-Characters/Morrowind-NPCs.md` section 15c (the fallen and the fire), `05-Combat/Balance-Arc.md` (the
guard beside BAL2), `06-Systems/Loot-Arc.md` (the Aegis's bill), `10-UI/UI-Arc.md` (PX21a's transportItem),
`01-Overview/bugs/Field-Bugs-2026-10-09.md` (HOME-FOOT's lot sentence retired), `09-Testing/Testing.md` (seven rows and the
Suite line). The tests: `fb1011b_campfire`, `fb1011b_cartslot`, `fb1011b_offerid`, `fb1011b_jumpslow`, `fb1011b_legendheld`,
`fb1011b_homeline`, `fb1011b_fullguard` (19). The mutants: `tools/mutants/fb1011b.json`.
