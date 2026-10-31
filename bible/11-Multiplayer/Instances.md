# Instances

A place of your own, for you and your party. At a dungeon or a building one of your quests names, at Privateer's Hold,
at the dungeon your line's remains lie in, and at a guild's castle, the door asks whether to enter the public room or
an instance. An instance is its place's world room with an owner and an epoch after it, so it keeps its own foes, loot,
doors and memory, and only its owner's party may enter.

## How it works

**The room** (`src/net/instanceRoom.js`). An instance key is `<public room>.i<owner>.<epoch>`. The public room is a
dungeon whole (`dungeon:m<id>`) or a building (`interior:m<id>.<key>`); `instanceRoomOf` refuses anything else. The
owner is 16 hex of SHA-256 over the account (`instanceOwnerOf`) or a guild (`instanceGuildOwnerOf`). The epoch is 8 hex:

- a quest's own, minted at random the first time its instance opens and kept in its save
  (`src/systems/instancePlaces.js` `questInstanceEpoch`) - never its uid, which a later quest can reuse. A party
  member's copy of a quest mints its own. When several quests name a place, the oldest running one opens it.
- the Hold's, a digest of the character (`holdEpochOf`): one room for good.
- the remains', a digest of the line and its row (`remainsInstanceEpoch`): one room a death.

An instance is a world room (`isWorldRoom`) like its public twin: the host's simulation, acts, loot and memory. Its
memory is forgotten `INSTANCE_TTL_MS` after it drains (`worldTtlMsFor`), where a public room keeps `WORLD_TTL_MS`. A zone
hall keeps no instance (`wdunHallOfRoom`). `roomKeyFor` (`src/net/online.js`) keys an identity's instance in place of
its public room; one that cannot be keyed is no room, never the public one.

**The relay's door** (`server/src/index.js` `Room`). The hello of an instance room spends its gate after the token, by
account. `instanceAdmission` lets in the owner, staff, a castle's guild by its verified token, and anyone the hub says
is in the owner's party (`INSTANCE_INTERNAL_KIN`, `partyHoldsOwner` over the party as it stands). A yes is kept
`INSTANCE_KIN_KEEP_MS`; a no is never kept. A stranger is refused `INSTANCE_DOOR_WORD`; a silent hub is `busy`, never a
way in. A member let in as the party is asked again off its pose at most every `INSTANCE_KIN_KEEP_MS` and refused out
when no longer in the owner's party. A castle guest who changes guild is refused out. The party pose carries `ins`, the
instance room a member stands in, so partners at that place can join it.

**The offer** (`instanceOffer`). Offline, or at a relay older than `INSTANCE_RELAY_MIN`, there is nothing to choose.
Otherwise the rows are, in order: Public (never at the Hold or a province start's own dungeon), my guild's castle, each
partner's instance at this place whose owner is in my party (`partnerInstances`, matched by room, never by map pixel),
then the instance room I last stood in here, then Your instance. Where a quest of mine names the place and the world
builds its public room smaller (`dungeonSite` `relaid`), Public moves to the last row. At most `INSTANCE_ROWS_MAX` rows.
A place with nothing but its public room has no popup.

**The door** (`src/scenes/instanceDoor.js` `createInstanceDoor`, built in `world.js`, asked by `worldModes.js`). The
popup is a player's door's alone: `atDoor` shows a numbered `ChoiceWindow` (`src/ui/talkWindow.js`) with Escape as
Leave, awaits the answer and hands the entry `{ instance, whole }`. A closed window answers Leave. Every other way in -
a quest's `teleport pc` or `transfer pc`, a Recall, a load, a staff landing, the cemetery, the Abyss, the arena - asks
`entryFor`, which shows nothing: it takes what the save or anchor recorded while that may still be had (`stillHeld`),
else a quest's place's instance (a partner's first), else the public room. A home is never an instance, and the open
zone offers none.

**Sizes.** Online, a quest's things stand only in a dungeon whole (`questMountsHere`): an instance, a main-story keep,
or a dungeon the world gives its whole size. An instance's build asks `dungeonSizeFor` for the whole layout
(`src/world/smallerDungeons.js`), and so do the quest's markers. At a relay with no instances, a dungeon a quest of mine
names is entered whole in its public room (`questDungeonWhole`). In a public room built smaller, the game says once:
"Your quest's business here waits in your instance."

**Refusal and wipes.** A relay refusal says "That instance is closed to you. Only its owner and their party can enter."
and takes the player out. The door keeps the instance room the relay last joined the page to (`poseWord`) and offers
it after a death, so a party that falls together is offered the same room back. A refused room or a public room is
never kept.

## Rules

- Who may enter: you and your party (Mac). Where: quests' dungeons and buildings, Privateer's Hold, and building
  interiors (Mac); a guild's castle (the owner, `bible/11-Multiplayer/Domains.md`).
- What it remembers: kept per owner under the half-hour respawn, until its quest ends (Mac). A quest that ends never
  keys its room again.
- A quest's dungeon is whole inside its instance; there is no smaller-dungeon hotfix outside it (Mac).
- Privateer's Hold: online a character leaves its public room for good (HOLD-ONCE); its instance is entered any time.
  The new game's start is the Hold's public room, never asked (`holdOpen`).
- The page offers only what the relay admits: a partner's room is offered only while its owner is in my party.
- The popup is the redesigned `ChoiceWindow`, not a DFU window (Port-Doctrine, Scope); its words live in
  `INSTANCE_TEXT`.

## Daggerfall Unity

DFU has one player and no rooms, so it has no instances. Offline the game builds dungeons at DFU's frozen size.

## Code and tests

- `src/net/instanceRoom.js` - keys, digests, admission, relay minimums
- `src/systems/instancePlaces.js` - quests at a site, epochs, partners, the offer, size rules
- `src/scenes/instanceDoor.js` - the popup, `entryFor`, `poseWord`, refusals
- `server/src/index.js` `Room` - the hello, the hub's kin ask, re-asks, guild refusals
- `src/world/smallerDungeons.js` - built sizes; `src/systems/quest/questRepair.js` - the quest re-lay
- `test/net/instances1.test.js` - keys, digests, room clocks, `roomKeyFor`
- `test/net/instances2_relay.test.js` - the real Room's door with signed tokens
- `test/systems/quest/instances3_door.test.js` - the door over the real quest machine, including wipes
- `test/systems/legacy/fb1019f_heirwhole.test.js` - a death in another's instance and the heir's door
- `tools/mutants/instances.json`, `tools/mutants/wipereturn.json` - mutant lists

## Open

- Two members who both choose Your instance in the same second stand in two rooms; the popup reads its rows once.
- A partner's room whose quest has ended is still offered while its owner is in my party; the page cannot see the
  owner's quest.
- Instances at every dungeon: one row of `instanceOffer` away, not chosen.
- Public re-laid dungeons can still seal an area from their entrance; no reachability pass covers them.
- A dungeon death still wakes outside the door; waking inside the instance is the owner's call.
