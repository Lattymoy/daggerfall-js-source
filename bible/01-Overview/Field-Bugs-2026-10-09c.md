# FIELD BUGS 2026-10-09c - five Discord threads

Five threads from the Discord's bug-reports, handed over as screenshots.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Card Table blocking" - "This table is oddly placed, it's in 'The Gold Dungeon' in Menakat. I've seen this in other locations aswell. (same tavern layout)" (æther) | the table stood at the walk's nearest clear cell - past an entry room too small for its ring, the mouth of the doorway the walk left it by | fixed (WALK-WHOLE) - not seen in Menakat, below |
| 2 | "Some ingredients won't let you store them" - Troll's Blood and Orc's Blood from a dungeon, and ingredients traded to a friend (axelento; Cayoken: "I also don't understand how it works") | law 3: the Stores take back only what the service handed this character - a looted, shop-bought or traded unit is held and never counted. The page listed none of them and said nothing | the law kept; the page names them (UNCOUNTED) |
| 3 | "Ghost companion isn't showing health bar - clipping into ceiling" (BigOOF) | a following flyer's floor lift read a leader a hair below it as a descent and climbed it into the ceiling; its bar stood over the ceiling and the sight test hid it | fixed (CEIL-GHOST) |
| 4 | "Stuff pvp zone" - died in the zone, crashed on the way back, "my gear was no longer visible on the map ... ended up losing all of my equipment" (hamzon) | the room held the pile its twelve minutes; the client's one record of it was memory alone, and a crash took the map's mark, the pile's claim and the hall's way back in with it | fixed for the next crash (WILD-KEEP); the lost gear cannot be read back - below |
| 5 | "Touching anywhere onscreen in mobile opens the system menu" - Firefox and Waterfox on Android (NOPper; upthedrunx: replicated on Fennec/Ironfox, "The game does work on Chrome") | Gecko grants a tap's pointer lock and ends it on the next touch; ESC-LOCK read every such loss as the player's swallowed Escape | fixed (TOUCH-UNLOCK) - not proven on a device |

## WALK-WHOLE: a card table never cuts the walk (1)

`11-Multiplayer/Tavern-Cards.md` section 28. TAVERN-TABLE's walk stands the table at the first cell at least 3 m in,
by the walk's own steps, whose table and ring are clear floor. A closed door stops the walk, so past an entry room too
small or too cluttered for the ring the walk goes on only through an open doorway - and the nearest cell that fits is
the doorway's mouth, the ring touching it, the stools across the way (the screenshot). A spot is passed over now when
its table, its ring and a lane of one cell round them (`PLACE_LANE_CELLS`), taken out of the walk, leave a walked cell
outside them unreachable from the entrance (`world/placedCardTable.js` cutsWalk) - the walk again on its own grid, so
every client stands the same table. The first spot that leaves the walk whole stands it; a room with no such spot
stands it where it stood, so no tavern loses its table. In the report's shape (a 4 m entry room, a 1.2 m doorway into a
hall) it stands 1.38 m from the doorway's wall to its nearest stool, where it stood 0.38 m - square in the doorway's
mouth, narrower than a body (0.7 m).

NOT SEEN IN MENAKAT: there is no ARENA2 data here, so the walk is pinned on built rooms. The Gold Dungeon's own layout,
and every tavern whose table moved, is the owner's first eye. A peer on an older build sees a moved table where it
stood. Pinned by `test/fb1009c_walkwhole.test.js` (the real prop, the player's capsule flooded round it to the hall's
far end) and four spots moved in `test/taverntable.test.js`; `tools/mutants/fb1009c_walkwhole.json` (5, all dead).

## UNCOUNTED: the Stores name what they will not take (2)

`06-Systems/Materials-Bag.md` section 4. Troll's Blood (template 42) and Orc's Blood (61) are the alchemist's reagents
and are materials - a looted one is the very item the mint makes - but law 3 (Professions-Arc 1, restated in
Materials-Bag 5) counts only what the service handed out: "a save-edited Red Rose, a looted one and a gathered one are
one item in the pack - and only the gathered one is counted". A deposit answers `carried-short` past the count. A realm
trade moves save records and no count, so a friend's traded units are held and never counted on the receiving side
too. Eleven other creature ingredients (Wraith Essence, Lich Dust, Daedra's Heart and the rest) are no material at all,
and the bag refuses them as it always did - no potion recipe of DFU's uses them.

The fault was the page: it built its rows from the counted materials alone, so a pack full of looted blood showed
nothing and nothing said why. Every material held has its card now (`systems/materialsBag.js` heldKeysOf), its units
past the count "N unstorable", and the picked bar says why in the player's words (`BAG_PAGE_WORDS.uncounted`). Put in
and Put everything in move only the count, as before. NOT DONE, and the owner's: letting the count travel with a realm
trade (it changes law 3). Pinned by `test/fb1009c_uncounted.test.js` (Troll's Blood from DFU's own loot roll);
`tools/mutants/fb1009c_uncounted.json` (7, all dead).

## CEIL-GHOST: a following flyer keeps the leader's level, and its bar the room (3)

`03-World/Naval-Combat.md` CREW-COMPANIONS. A ghost is mobile 18, Spectral, and the motor flies it with its whole 2.6 m
body. A following companion steers its feet at the leader's (`enemyMotor.js` _followTicks); the flying branch then ran
DFU's combat clause - "Stop fliers from moving too near the floor during combat": a descent with the floor near turns
up to `FLYER_FLOOR_LIFT` - so a leader a millimetre lower climbed the ghost until its feet were a metre up or its body
met the ceiling, and at heel it hovered there. Its bar stood 0.3 m over its top, over the ceiling, and the crew's sight
test (the place's collider) hid it. The lift is combat's now and never runs while following, and the bar stands under
the ceiling over the body (`ui/navalHud.js` crewBarPoint). THE FOUR HOSTS: world.js owns the one bar drawer and both
companion layers; worldModes.js and dungeonContext.js call it and step the companion on the shared motor; exterior.js
stands no companion. A ghost may still sit up to a jump's height above the floor at heel after the player jumps while
it walks; its next walk brings it down. Pinned by `test/fb1009c_ceilghost.test.js` (a Spectral EnemyAI over a real
Collider); `tools/mutants/fb1009c_ceilghost.json` (4, all dead).

## WILD-KEEP: my remains' record survives a crash (4)

`11-Multiplayer/Wild-Zone.md` section 5. The relay's place room keeps a fallen player's pile for twelve minutes whatever
the client does, and re-announces it only to a player standing in that cell. The client's one record of it - where it
lies, the room, its end, the hall (`world.js` `_wildMine`) - lived in memory alone: after a crash the world map's
pulsing mark was gone, the pile was known for mine only by the account, and a hall's lock refused the hall my pile is
my way back into. WILD-WAYPOINT's flag is kept on the device, but the flag is not the record. The record is kept on the
device now too, for the character that fell, read back once by the zone's frame, forgotten at its end and at the room's
"gone" (`systems/wildRemainsWaypoint.js` keepMine / keptMine / forgetMine). Pinned by `test/fb1009c_wildkeep.test.js`;
`tools/mutants/fb1009c_wildkeep.json` (7, all dead).

THE REPORTER'S GEAR: not recoverable from anything this tree keeps. The relay logs no fall's records and deletes the
pile at its end; the account service keeps a character's last two saves, and the checkpoint every two minutes has long
since replaced the save before the death; `tools/realmRestore.mjs` restores houses, guild places and Renown alone. A
grant from what the player names is the owner's, through the server post. NOT DONE, and the owner's: a record the
account keeps (a second device, cleared storage), a clock that waits for a disconnected owner (section 5: "the despawn
does not wait for the rise"), and a relay log of a fall's records - each a relay deploy.

## TOUCH-UNLOCK: a lock a finger ended is no Escape (5)

`10-UI/UI-Arc.md` ESC-LOCK, its third rule. The hosts' canvas arm asks for the pointer lock on every pointerdown, a
finger's too ("a finger can never hold the pointer lock" - true in Blink). Gecko grants it, a tap being a user
activation, and ends any lock on the next touch event (`PresShell.cpp`, `PointerLockManager::Unlock("TouchEvent")`),
posting the change after that touch's dispatch. ESC-LOCK reads a lock lost with nothing up, not released by the page,
as the Escape the browser swallowed and delivers it - so every tap opened the pause, and the pause relocked on its
close for the next tap to end. `player/pointerLock.js` bindCursorToggle hears the four touch events on the document's
capture phase, and a loss within `TOUCH_UNLOCK_MS` (500 ms) of one is the finger's: nothing is delivered. A mouse and a
keyboard fire no touch events, so the desktop is untouched. Pinned by `test/fb1009c_touchunlock.test.js`;
`tools/mutants/fb1009c_touchunlock.json` (4, all dead).

NOT PROVEN ON A DEVICE: no Android browser here; the mechanism is read from Gecko's source and MDN's data. The second
player's "I have to paste around the lack of keyboard" is a separate thread - the touch layer's text entry - and not
taken here.
