# FIELD BUGS 2026-09-27e - the Discord batch after RISE-STUCK

(Field-Bugs-2026-09-27d on its branch; main's CURSE-SYNC page took that name first, and the merge renamed this one.)

Mac, with screenshots from the Discord's bug reports and suggestions. This page is the batch's record; each fix
has its own section below as it lands.

1. *"Potion seller restock instantly - You only have to close the shopping window and the potions are available to
   purchase again. I dont know if its a bug, but you could buy infinite amount of potions this way"* (Bagneres)
2. An Android thread (jessman212's; Triage on an AYN Thor): *"i can login get to the main screen but im unable to
   select online, load game anything. What is the chance of getting an actual android apk?"* - *"doesnt seem to let
   me change controller sensitivity either, i press the 1.0 to try and change it but it doesnt register"* - *"I
   luckily have a tiny, tiny space under the title I can use to scroll but it's quite annoying. I've managed to
   figure out resting, and spell casting but I haven't been able to remap the android "buttons" on the bottom right
   of the screen. I would much rather use a button to attack rather than the touchscreen personally."*
3. Tabitha's suggestions: *"Allow us to see buff timers or SOME sort of indicator that we have placed a buff on a
   party teammate [preferably on their party portrait, maybe?] ... Touch spells say "You cast the [SPELL] on [PLAYER
   NAME]", but Area at Range & Area around Caster don't have good tooltips or UI elements. I'd also like floating Heal
   numbers"*; *"Allow party members to choose not to rest with their party"*; *"General Trade Improvements"* (magic
   item stats on the trade hover, enchantments in the inventory and trade, "Link in chat / Post in chat");
   *"CRAFTABLE / PURCHASABLE CRAFT / GUILD STATIONS [Spellmaking, Alchemy, Enchanting] FOR HOMES / SHIPS"*; *"Fix
   sharing Guild & Temple quests - It says the quests don't match up, can't share, etc."*; *"Allow casting of buffs on
   players outside party"*, with an initial whitelist (Heal, Regeneration, Spell Absorption, Cure, Fortify Attribute,
   Shield, Elemental Resist, Jumping, Water Breathing) and blacklist (Slow Falling, Paralyze); *"I'm not certain "Area
   around Caster" or "Area at Range" actually work for buff spells on other players ... I think Shield is also
   hard-coded as a self-only"* - and her clarification: *"After testing, a LARGE amount of buffs & spells just don't
   work when cast on another person, even with touch. Normal regen seems okay, but Regen + Anything, Fortify
   Attributes, etc. Kinda wonky. It may be multi-effects in general?"*
4. *"being able to see where party members are on compass? - just lil green marks that point in that direction"*
   (Ashley; Satranath: "Party members show up on the map but not compass")

## GUILD-SHELF: a guild's Buy shelf is the day's (1)

The "potion seller" is a guild's Buy Potions service (the Temples' and the Mages Guild's), and the same law
stocks Buy Magic Items and Buy Soulgems. DFU mints each of those shelves on every open of the service - the magic
and soul gem shelves from the day's seed, so what was just bought is back at the next open, and the potions from
the walking random stream, a fresh lot at every open. Either way the shop never runs out. The port had recorded the
first as a quirk it kept, and seeded the potions on the day as well - which turned them into the first kind: close
the window, and every potion just bought was back.

Each service's shelf is now minted once a game day and kept on the building (`systems/shopStock.js` `dayShelf`,
`scenes/worldModes.js` `guildShelf`). The trade window buys out of that same array, so a closed window finds the
shelf as it was left, and it rides the scene cache beside the shop shelves' own stock - a walk out of the hall and
back, and a save and a load, keep what was bought gone. The next day restocks it. A world move clears the ordinary
scene cache, so a visit after one mints the day's shelf again, as a shop's shelves re-roll. Offline and online
alike; a recorded departure (Port-Ledger section A, GUILD-SHELF). Pinned: `test/guildshelf.test.js` (6),
`tools/mutants/guild_shelf.json` (9, all dead).

## SHORT-TOUCH: a short landscape touch screen keeps the two columns (2)

The taps registered. The coarse-pointer layout stacks the section screen's brand, pane and rail in one column -
right for a phone held upright - and a handheld held sideways is 393 to 411 CSS px tall: the logo spans the width
and stands about 250 px, the rail wraps to two rows, and the pane between them, where every Continue, Load, Begin
and Play online button lives, came to 5 px (0 on a 393 px screen). The title and the rail drew; each rail press
opened a pane nobody could see, and its sliver was the "tiny space" that scrolled. Where height is the constraint
and width is not, the desk's two columns come back - the rail down the side with 44 px rows, the pane the whole
height (`ui/enhancedStyle.js`, not the chargen wizard, whose phone strip is its own). The first visit's sign-in
window opened 270 px down the screen with its Close off the bottom and the menu under it; on a short screen it
takes the height now. Measured: `tools/shortTouchProbe.mjs` (four handheld viewports - 24 failures before, none
after: every door's pane shows the whole height and its first button can be reached). Pinned:
`test/shorttouch.test.js` (3), `tools/mutants/short_touch.json` (5, all dead).

## PAD-DOOR and PAD-SETTINGS: the front door answers a controller, and its speeds can be set (2)

The AYN Thor has its controller built in, and the game's pad layer (`ui/gamepadInput.js`) attaches with a scene -
so the intro, the menu, its sign-in window and the boot settings answered a finger or a mouse and never the pad.
`ui/menuPad.js` is the door's own small loop over the page's own controls: the d-pad or the left stick moves the
focus to the nearest control that way (the one in line before the one off to the side), A or Start presses it, B
is Escape - the menu's own back - and left and right step a list box or a slider. A control under something drawn
over it (the sign-in scrim over the home) is not a place the focus goes; a press that redraws the menu puts the
focus back on the control now standing where it stood. `main.js` starts it with the front door and stops it when a
game is chosen, before the scene's pad starts - the two never read one press. Walked in a real page with a fake
standard pad by `tools/menuPadProbe.mjs`: the intro, the sign-in window closed with B, the home walked to Load Game,
the rail walked to Online, into its pane, and back home.

The "1.0" was a readout. The four gamepad settings (Gamepad Look Speed, Cursor Speed, Movement Threshold, Stick
Deadzone) went live at GP1 and never got a row in `ui/settingsLaw.js` NUMBER_LAW, so each fell through to the
honest readout for a number with no stated range - a bare value with nothing to press. They are numbers with
steppers now, over their consumer's own clamps (`systems/gamepad.js` controllerSettings - the range-equals-clamp
law), shown as x1.0 and percentages. Pinned: `test/menupad.test.js` (9; 13 with the AUDIT's), `tools/mutants/pad_door.json` (13, all dead).

## TOUCH-BUTTONS: the bottom-right corner is the player's, and Attack is one of its choices (2)

TI1 fixed the corner at two buttons - Jump and Ready Weapon - and took the sword away for the swipe (hold a finger
still, then stroke), and nothing on the Touch card could change either. The corner is three slots now
(`ui/touchButtons.js`), each any of eighteen actions or none, chosen with steppers on Settings > Controls > Touch
and re-laid live as soon as no finger holds a corner button; TI1's two stay the defaults. A HOLD slot keeps its
action's key down while the finger is, a TAP slot presses it once, and ATTACK swings through the swipe's own seam -
a readied spell fires first, as the swipe's press fires it, and the stroke is drawn from DFU's click-to-attack table
(six directions - the first cut drew eight; AUDIT A7). Every key is the registry's, so a rebind in Controls moves what the button
presses. A host with no attack (the fly-cam) is offered no Attack slot. The layout keeps TI1's default corner at the
16 to 280 px the HUD's model was drawn against (Jump and the F button where they stood), and the model now keeps
clear of the widest corner a player can choose. On a handheld with a controller, the pad's own attack (RT) works
in-game as it always did - the missing piece there was the front door (PAD-DOOR). Pinned:
`test/touchbuttons.test.js` (8; 9 with the AUDIT's), `tools/mutants/touch_buttons.json` (12, all dead); four older pins re-aimed at the
slots (TI1's held pair, SOC C9's F button, AUDIT 39 F127, RENOWN4b's corner).

**The Android app.** There is no APK and none is planned in this batch: the game is a web app, and on Android it can
be added to the home screen from the browser, where it opens fullscreen (`public/manifest.webmanifest`). A store
package (a Trusted Web Activity or a wrapper) is Mac's call.

## SPELL-GIFT: a buff readied near a mate waits for the aim, and a stranger may be given the safe list (3)

Not multi-effects: every effect of a three-effect gift crosses the wire and lands. The aim was the fault. A healer's
buffs are mostly CasterOnly - DFU's spellbook is, and the spell maker snaps a spell to CasterOnly for one self-only
effect, so "Regen + anything" usually is one - and a CasterOnly spell went off on the caster the moment it was
readied unless the friend already stood under the crosshair. It arms now while a mate is within 10 m (a mate - the
first cut armed for any stranger near too; AUDIT B2), says where the
click will land, and the click decides (the mate under the crosshair, or the caster). The stock Shield is that same
case, not a hard-coded self-only. A gift sorts with the receiver's buffs (it went to the debuff row); a readied spell
aimed at a player raises "Cast Heal on Bran" without the peer menu; a blast names everyone it reached in one line.
Her whitelist is the stranger's list: a spell made only of it may be cast on any player, and the receiver applies
it from a stranger only while their "Spells from strangers" switch is on (default on). `06-Systems/Online-Arc.md`
SPELL-GIFT; `test/spellgift.test.js` (7; 9 with the AUDIT's), `tools/mutants/spell_gift.json` (13).

## PARTY-BUFFS: a mate's live effects sit on their card, and heals float (3)

Each member's party pose now carries its own live spell effects, the way their own HUD shows them (at most eight):
the icon, the rounds left, the name, and whether it is harmful. Every other member's card draws them as a row of
16 px tiles under the bars. So a buff I place on a friend shows on their card (under the bars, beside the portrait) with their next pose, counts down
on their clock, and disappears when it ends there. That holds whoever cast it, for touch and area spells alike. A
curse or disease shows too, outlined in red, so a healer can see it before curing it. A held item's constant
effects stay off the card. When a member gains health between two poses, a green "+N" floats off their card. It
does not float while they rest (the pose's new `rs` covers their own rest and one they follow), for a first pose,
or for a rise from death. On the enhanced skin, a heal I take floats "+N" in green just under the reticle, beside
the damage numbers. That heal can come from my spell, a potion or a friend. What a window restores (a rest, a
level-up, a load) is not floated, nor a heal taken while a window hides the HUD (AUDIT B10). `06-Systems/Online-Arc.md`
PARTY-BUFFS; `test/partybuffs.test.js` (8; 9 with the AUDIT's),
`tools/mutants/party_buffs.json`.

## COMPASS-PARTY: party members are green marks on the compass (4)

Each party member is now a small green mark on the compass, on both skins, pointing the way to them (the Large HUD's
needle compass draws none, as it draws no Detect markers). The marks use
the Detect markers' bearing law, so a member behind you stands at the end of the compass on the side to turn toward.
Where a member's body is drawn in your area, the mark points at them. Outdoors, members elsewhere are marked from
their pose: the leader's own position, or the middle of the member's map pixel. A member in your own pixel whose body
is not drawn here (inside a building, say) gets no mark, because the middle of the town is not where they are.
Indoors and in dungeons, only the members standing in the same place are marked. `06-Systems/Online-Arc.md`
COMPASS-PARTY; `test/compassparty.test.js` (4), `tools/mutants/compass_party.json` (14).

## REST-OPT: a party member may rest alone (3)

The Features pane's "Other players" card has a new switch, "Rest with my party" (on by default; it is the player's own
setting online). When a
member turns it off, their party pose says so (`nr`, RELAY_VERSION world120), and the party's rest goes on without
them:

- they are no voter, and the leader does not have to gather them;
- nobody mirrors their rest, and they are never pulled into the party's night;
- their own Rest opens a rest of their own, as in a tavern, and `/ready` tells them they rest on their own.

A leader who turns it off leaves everyone to rest for themselves, because only the leader can open the party's vote.
`06-Systems/Online-Arc.md` REST-OPT; `test/restopt.test.js` (3), `tools/mutants/rest_opt.json` (17).

## SHARE-MEND: guild and temple quests share, and a refusal says why once (3)

"It says the quests don't match up, can't share" was three separate faults.

1. **Can't share.** A guild's or a temple's quest usually sends the party to a dungeon, and a dungeon Place carries
   every quest marker in it, about 240 bytes each. Three hundred markers were 71 KB, over the share's cap on their
   own, so the Share button said "This quest is too complex to share." Markers now travel without the four fields
   the site already says (its uid, its symbol, and two defaults) and are put back on receipt. That halves them,
   and a receiver on an older build still reads the rest.
2. **Don't match up.** SHARE-COPY (2026-09-26) fixed the refusal every share got. A player whose page predated it
   still got that refusal, and nothing said so. The envelope now names its build. A refusal that says the copies
   disagree adds "You are on different versions of the game - both of you should reload the page." when the
   builds differ, or "Their game is out of date - they should reload the page." when the sender's build is too old
   to say. A restore that failed on the receiver's side is now its own reason ("could not rebuild it in your
   world"), not "did not match your own copy".
3. **Every few seconds.** A quest kept in step with the party is re-shared on every change, so a member refused
   by the guild gate, or holding their own quest of that name, read the same refusal each time. A sync's refusal
   is now said once per sharer, quest and reason. A deliberate share is always answered.

Every refusal now reads in the second person: the receiver's "... but you That quest is no longer active." is
gone. The guild gate itself stands (DISC25-D): a Fighters, Mages, Thieves or Dark Brotherhood quest still needs its
guild. Temple and knightly-order quests never had a gate. `06-Systems/Online-Arc.md` SHARE-MEND;
`test/sharemend.test.js` (6; 8 with the AUDIT's), `tools/mutants/share_mend.json` (15).

## TRADE-INFO and TRADE-FIT: an item's magic in words, and an offer too big says so (3)

The Enhanced item card listed enchantments only for items rolled by the loot tiers (`item.rarity`). DFU's own magic
items and the item maker's said "Magic" and nothing more, and with the tiers off they said nothing. The card now
reads one list (`ui/enhancedInventory.js` itemPowerLines): the tier's lines, then, for an enchanted item the tiers do
not name, DFU's own Info-box powers ("Potent vs Daedra", "Feather weight"), or "Powers unknown." until it is
identified. The player trade window reads the same list on each row's hover (mine and theirs) and in its detail.

An offer is one trade frame. An offer over the wire's cap was never sent, so the trade ended "timed out" with no reason
given (about nine richly enchanted items were enough). It is now refused in words ("That is more than one trade can
carry - offer fewer items."), and the offer already on the table stands. It is measured by the COMMIT its goods will
ride at the wire's own data cap (AUDIT D1 - the first cut measured the offer's frame against the relay's, 43
characters looser, and a commit refused after the peer's had left stranded the peer's goods). `06-Systems/Online-Arc.md` TRADE-INFO;
`test/tradeinfo.test.js` (3; 5 with the AUDIT's), `tools/mutants/trade_info.json` (8).

## CHAT-POST: an item posted in chat (3)

Online, the pack's card and its right-click menu have a "Post in chat" button. It says the item on the chat's open
tab as one line: its name in brackets, its damage or armour, and its magic in the card's own words (TRADE-INFO's
list). For example: "[Longsword] Damage 2 - 16 · Potent vs Daedra · Feather weight" (a steel one). A line too long for the chat is cut
at a whole word and ends "...". The relay carries text alone, so the item travels as words, not as a live link. It
goes through the tab's own door, so the Party tab still needs a party. `06-Systems/Online-Arc.md` CHAT-POST;
`test/chatpost.test.js` (2), `tools/mutants/chat_post.json` (8).

## HOME-STATIONS: crafting stations in a home, a house or a ship (3)

In the decorator's "In this room" view, a placed piece (not one of your own items, and not one that holds things)
can be made a crafting station. "Station: Alchemy >" chooses the craft (Alchemy, Spellmaking, Enchanting) at no cost,
and "Make station" pays a licence once: 5,000, 10,000 or 20,000 gold. Nothing comes back when the piece is unmade,
removed or the room sold. Pressed by its owner, a station opens that craft's own maker, the same window the Mages
Guild and the temples offer, with no guild membership needed. The maker's own rules still apply: the potion maker
needs ingredients, the spell maker needs a spellbook, and each charges what it charges.

A station is kept with the piece in the save, and in an online home by the account service (ACCOUNT_VERSION acct16 - acct15 on its branch; main's FOUNDER3 took acct15
first).
An online home whose service predates this is paid nothing, and the player is told. The prices are a first pass for
Mac to tune (net/decorLaw.js DECOR_STATION_FEES). `06-Systems/Online-Arc.md` HOME-STATIONS;
`test/homestations.test.js` (4; 8 with the AUDIT's), `tools/mutants/home_stations.json` (14).

## THE FOUR HOSTS

Named here, as `Home.md`'s law asks of every slice (the audit found none of the batch's records did): the compass
marks, the rest switch, Post in chat, the spell gift's `sp` and the stations are carried by `world.js` (the open
world), `worldModes.js` (a building, and the dungeon it hands `dungeonContext.js`) and `dungeonContext.js`; `exterior.js`
- the offline map viewer - passes none of the online seams, every consumer is optional-chained, and it draws the
classic compass with no party. GUILD-SHELF and HOME-STATIONS live in the `worldModes.js` interior alone (no other host
has a guild counter or a decorator).

## AUDIT (2026-09-27, "Lets do a comprehensive audit on these changes")

Six lenses read the twelve slices - the Android and shop four, SPELL-GIFT and PARTY-BUFFS, COMPASS-PARTY and REST-OPT,
the quest share, trade and chat three, HOME-STATIONS, and a cross-cutting one (the wire and the servers, the four
hosts, the docs against the code, the pins' own strength: the batch's 152 mutants re-run, 151 dead and 1 equivalent
as recorded). Every finding was checked against the code before anything moved; the real ones are fixed
and pinned (`test/audit27d.test.js` and the slices' own suites), and every fix has a mutant that its pin kills
(`tools/mutants/audit27d.json`, 58, all dead). RELAY_VERSION world120 at the merge with main (world121 on its branch; the wire names two constants; the relay does
nothing new).

**Fixed.**

- **Trade (D1, high).** An offer was measured as the relay's FRAME (12288) while the socket refuses the DATA past
  TRADE_DATA_MAX (12224), and the commit - the offer's items plus the peer's revision - was never measured. An offer
  in the gap timed out again; one just under it went through, both confirmed, the peer's commit left their pack and
  mine was refused: their goods reached nobody. `setOffer` now measures the commit at its longest (the peer's
  revision at TRADE_REV_MAX) against the wire's own cap.
- **Home stations.** A moved station was stripped (S1: neither the ghost nor the placer carried the craft, and the move
  wrote a place without it - online, the service too). A double press paid the licence twice, or wrote the piece
  back over the one just paid for (S2: one change at a time now, read from the room as it stands, and a roll-back
  says so). The view did not repaint on an unmake (no gold moved, and the craft was not in its signature), and the
  stale "Unmake" button re-made the station and charged (S3: the craft is in the signature, and the button acts as it
  is painted). Unmaking now asks twice (S4); a second craft reads "Change station - N gold (no refund)" and a
  station's Remove says its licence does not come back (S6); the side scrolls on a landscape phone (S5); a maker's
  refusal with no record still speaks (S7); the hover names the craft (S8); the chooser has a reader's name (S9).
- **Spells on others.** A caster-only heal readied in a DUEL went to the opponent (B1, high - the crosshair is always on
  them): a gift never lands on the duel's opponent now, and the receiver refuses one. The ready's arm counted strangers,
  so every online player's self-buff in a town waited for an aim (B2): it counts mates. A concealed stranger was named
  and given to (B3). A stranger's 0% Spell Absorption, first in the list, switched off the receiver's own (B4): the best
  live entry counts. An area gift's burst went to the room's first strangers before a mate (B5): mates first. A
  stranger's Cure Disease took an incubating vampirism or lycanthropy (B6): it leaves an infection. A stranger's gift
  needs them standing where the receiver can see them, and its lines are said once in three seconds (B7). A mate's
  rest that ended under my window floated a false "+N" (B8).
- **Rest alone.** The switch is honoured only through a hub that carries `nr` (C1, REST_OPT_RELAY_MIN world120) - through
  an older one the party counted the member a voter while their own client refused every rest. A mate's night beside
  mine that is not one with it is another camp to STRANGER-REST's gate (C2) - two nights side by side each rolled the
  night's foes for the whole party. A night granted alone says `nr` to its end (C3), so a leader who turns the switch
  back on mid-night pulls nobody into it. The switch is named where it is, Features > Other players (F4).
- **Compass.** A concealed leader was marked at their exact feet (C4); out of a party the room's players were walked each
  frame for it (C6).
- **Quest share.** A malformed envelope threw out of the receipt (D3: the markers are made whole after the shape check);
  a resync the restore choked on said "you no longer have a copy" (D4: 'restore', with its build hint); the once-law
  now counts a deliberate refusal and keys on the copy (D5).
- **Items.** The trade window showed an artifact no powers (D2: it reads TEXT.RSC through `rows` as the card does); two
  like powers were one line (D6).
- **Android and controllers.** A quick tap on the Attack slot swung nothing (A1: the lift waits two frames); B on a text
  field did nothing (A2); the Stick Deadzone walked to 100%, where both sticks die (A3: DFU's 0.9); a redraw left the
  pad walking the page every frame (A5); a stick near a diagonal fired every frame (A6); the Attack stroke drew eight
  ways, not DFU's click table (A7); the movement threshold was labelled a deadzone (A9); the kept Magic Items shelf kept
  the rank and level of the day's first open (A10).
- **The pins.** The hub attachment's size pin now sends the widest pose (F6: 1371 bytes before the batch, 1865 at the
  widest after - under the runtime's 2048); own1 holds OWN_RELAY_MIN at 118 again (F7); the account service's station
  round trip is driven (F8).

**Standing, and why.**

- **A4 - a guild shelf restocks after a map pixel is left.** The hall's scene (and the day's shelf on it) goes with the
  pixel (`world.js` clearSceneCache); keeping shelves apart from the scene cache is a save-format change for a LOW.
- **B9 - a drunk potion is a "(harmful)" effect on the party card.** The HUD has filed potions in its debuff row since
  U46 (`drinkPotion` passes no caster); the card only shows what the HUD rows. Making a potion self-cast reaches the
  absorption gate, which the audit would not move unverified against DFU's DrinkPotion.
- **B10 - a heal taken under a window does not float.** Deliberate: a hidden frame forgets the health it saw, since a
  rest's restoring is no heal.
- **C5 - compass marks sit at the Detect markers' scale.** DFU's own marker law (`compassMarkerLerp`, ±90° across the
  box); the Detect and gate marks beside them use it, and one scale on one compass is the rule.
- **B7's other half, A8, A11 and F6's write.** A sender is still told "You cast Heal on Y." when Y refuses strangers (the
  pose would have to advertise the switch); the pad reaches neither the classic start nor a pad-button binding at the
  door (A8); landscape phones under 600 px wide and punch-hole insets (A11, from the stylesheet's arithmetic, not
  rendered); the hub ignores a failed attachment write (`server/src/index.js`), unreachable at today's widest pose.
- **The branch's world119 LAW row** said an older relay leaves "the cards bare"; the heal floats are the client's own, so
  they still show (and float during rests) behind a relay without `rs`. The merge folded the branch's three rows into
  one world120 row, which says only that an older relay strips the pose fields.
