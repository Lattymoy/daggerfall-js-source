# INSTANCES - a place of your own, for you and your party

Opened 2026-10-15. Mac, after the main-quest audit below: *"Instead of one room for houses, dungeons, etc - for quests
and other uses, including future work, lets implement an instanced system. For example, take privateers hold. Currently,
players cant revisit it even if theres a quest there. The player approaches, should be met with an enhanced UI popup
that lets them select public or instanced (if applicable)."* Asked, Mac chose:

- **Who:** "You and your party". The relay admits an instance's owner, staff, and anyone in the owner's party.
- **Where:** "Dungeons with your quest", "Privateer's Hold", "Building interiors". A building's door asks as a dungeon's
  does, where a quest of yours names the building. The death quest is a quest of yours (HEIR-WHOLE, section 4): a
  dungeon the line's remains lie in whole, where the world lays its public room smaller.
- **What it remembers:** "Kept per owner, 30-min respawn" and "Kept until quest ends". The room keeps its memory as a
  public room does, under RESPAWN-30's half-hour, and a quest that ends never keys its room again.
- **The size hotfix:** "Fold into instancing". There is no interim fix. A quest's dungeon is the dungeon whole inside its
  instance, and whole in its public room only where no instance can be had (an older relay).

Not a DFU member: DFU has one player and no rooms. Ledger A, INSTANCES.

## 1. Why - the main quest's mummy, and the sizes

A streamer was stuck on the main quest, unable to find an enemy, after QREPAIR, QUEST-VOID, QUEST-CAPS and QUEST-RESET
had all shipped for S0000018's mummy (`06-Systems/Quest-Arc.md`). The audit (2026-10-15) read the quest's path end to
end and walked the real dungeons with the game's own collider (`player/collider.js` move, from the start marker, every
door and moving wall left open, so "unreachable" is a lower bound):

- S0000018 is started at Direnni Tower (S0000003's `start quest 18 18`), so its `remote dungeon0` is drawn from the Isle
  of Balfiera's seven crypts. Online the world builds each at the size its map id draws (SD-ONLINE: a quarter small, half
  medium, a quarter whole).
- **Ruins of The Hold of Coppering**, built medium online, starts the player in a pocket of 293 standing spots that leads
  only into a border cap. In the whole dungeon the same start marker (block N0000040) walks on through its south neighbour
  N0000059 into the rest. None of the medium build's four quest markers is reachable from its entrance, yet each one
  exists in the build, so QUEST-VOID never fires and QUEST-CAPS (interior blocks only) does not help.
- Ruins of Old Barbara's Place (the 2026-10-12 report) and The Masoleum of Darkivaron, both small online, reach their
  markers.

So a re-laid dungeon - the interior block a random one, its four sides caps - can seal a quest's marker away from its
entrance, and every safeguard asks "is the marker in the build", never "can the player walk to it". Mac's first answer
was "1" - a quest's dungeon built whole - and then the instances, which carry it.

## 2. The room (net/instanceRoom.js)

An instance is its place's public world room with an owner and an epoch after it:

    <public room>.i<owner>.<epoch>        dungeon:m187853213.i0f1e2d3c4b5a6978.89abcdef

- **The public room** is a dungeon whole (`dungeon:m<id>` - never `.m` or `.s`) or a building
  (`interior:m<id>.<key>`, its key in its town's layout, WD3). `instanceRoomOf` refuses anything else.
- **owner**, 16 hex: eight bytes of SHA-256 over `instance:account:<account>` (instanceOwnerOf). The relay checks it
  against the subject its token verified.
- **epoch**, 8 hex - what opened the room:
  - **a quest's own**, eight random hex minted the first time its instance opens and kept on the quest
    (`instanceEpoch`, in its save: `quest.js` getSaveData; systems/instancePlaces.js questInstanceEpoch). Every entry of
    its life keys one room, and no other quest's ever does. NEVER its uid: `quest.js` nextUid restarts past the uids a
    save still holds and an ended quest leaves the machine, so a later quest is minted a finished one's uid - and walked
    into its room (the audit, section 10). A party member's copy mints its own (machine.js receiveSharedQuest,
    NO_INSTANCE); a resync keeps the copy's; a quest set aside and reclaimed keeps its own. When several quests name a
    place, the oldest running one (the lowest uid) opens it.
  - **the Hold's**, four bytes over `instance:epoch:<character>:hold` (holdEpochOf): the character's, for good.
  - **the remains'** (HEIR-WHOLE), four bytes over `instance:epoch:<line>:<remains>:remains` (systems/instancePlaces.js
    remainsInstanceEpoch - the line's id and its row's, `r<person>`): one room a death, the same on every device the line
    is played on, opened while no quest of mine names the place.
- **A world room** (net/wire.js WORLD_ROOM composes INSTANCE_TAG_SOURCE, the tag's one home): its host's simulation, its
  acts, its loot, its memory and RESPAWN-30 exactly as its public twin's. Its memory is forgotten INSTANCE_TTL_MS (seven
  days) after it last drained (worldTtlMsFor), where a public room's is WORLD_TTL_MS: the public world is a bounded set
  of places; a character's quests are not.
- **roomKeyFor** (net/online.js) keys an identity's `instance` in place of its public room. One that cannot be keyed is
  no room - never the public one.
- **A zone hall keeps none** (net/wire.js wdunHallOfRoom): its PvP, its locks and the hub's reset
  (WDUN_INTERNAL_RESET) are its public room's, and a private copy would stand outside all three.

## 3. The relay's door (server/src/index.js, world208)

- **The hello** of an instance room: `_instanceHello`, asked before anything is written (the owned room's law).
  - Its gate is spent AFTER the token, by account (`_battleHelloGate`, a Super dungeon realm's - AUDIT SD II L7 M1):
    every member an instance ever had knows its key, and the room's own bucket, spent before the token, was a door any of
    them could hold shut with junk. A public room's bucket is the room's, as it was.
  - A zone hall's instance is refused to everyone.
  - Its owner and staff come in (instanceAdmission: 'owner', 'staff'). Anyone else is asked of the hub - `_instanceKinOf`,
    a POST to INSTANCE_INTERNAL_KIN with the subject and the owner's digest. A yes is kept INSTANCE_KIN_KEEP_MS a pair; a
    no never is, so a member just invited comes in at once. The hub (`_instanceKinInternal`) reads the subject's party AS
    IT STANDS (`_myParty`, which walks its lapsed seats out as every hub reading of the party does) and answers whether
    another member's digest is the owner's (partyHoldsOwner).
  - A stranger is refused INSTANCE_DOOR_WORD (`private instance`); the hub silent is `busy` (CLOSE_BUSY - the page tries
    again), never a way in.
- **A member let in as the party is asked again while it stays** (`ip` on its attachment, `_instanceRecheck` off its
  pose, at most every INSTANCE_KIN_KEEP_MS, never awaited by the pose): kicked, lapsed, or its party no longer the owner's,
  it is refused out (its leave said, the host's seat handed on). The hub silent leaves it in.
- **The party pose** carries `ins` - the instance ROOM the member stands in (its key), inside only - so a partner at
  that very place, matched by the room itself, is offered to join it.
- **A staff destination** (net/staffTeleport.js) names the instance (`ins`) and the whole layout (`whole`) a player stands
  in; staff land in that room (the relay admits staff).
- **RELAY_VERSION world208** (NOT YET DEPLOYED; world206 then world207 on its branch, renumbered past main's SERPENT5 and
  ONE-BODY at the merges). net/instanceRoom.js joins the bundle. A page offers an instance only to a relay whose welcome
  says INSTANCE_RELAY_MIN (208) or later (`online.instanceOk`): an older one keeps no memory for the key, gates nobody
  out of it, and drops `ins`.

## 4. The door (systems/instancePlaces.js, scenes/instanceDoor.js)

THE LAW is pure (instancePlaces.js):

- **questsAtSite**: the running quests (not ended, not tombstoned, not set aside) one of whose Places names the site - a
  dungeon by its map id, a building by its map id and key. A Place names its site before anything stands there:
  S0000018 reveals its crypt thirty days before its mummy is placed. A site unseated from its key (RESEAT-GAPS) names
  none.
- **remainsWholeAt** (HEIR-WHOLE, FIELD BUGS 2026-10-19f, `01-Overview/bugs/Field-Bugs-2026-10-19f.md`; a player's
  ancestor died in another player's instance, and the inheritance never appeared at the spot): the line's remains still
  lying (`scenes/legacyHost.js` remainsWhere) whose dungeon was built whole, at a dungeon the world builds smaller in
  public (`dungeonSite`'s `relaid`), by its map id. `relaid` is the size BUILT (AUDIT FB1019f B1,
  `smallerDungeons.js:"export function builtSizeFor(dfLocation, deps = {}) {"`): it read the size the world draws, and a
  dungeon at or under its size's threshold - the five-block plus, the eight-block shape - is never laid anew, so its
  public room is the dungeon whole. Online the world draws 3,133 of MAPS.BSA's 4,232 dungeons smaller and builds 2,005
  of them smaller; at the other 1,128 a death in the public room was offered an instance, under a line that said the
  shared dungeon had none of it. A death records the size its dungeon was built at and its remains stand only
  in a build of that size (`06-Systems/Legacy-Arc.md` section 7, AUDIT FB1013d B1), so a death in an instance lies in
  the dungeon whole, which that public room never is - and the instance it fell in admits only its owner's party. The
  door counts the death quest's place as a quest's (the instance door's `questHere`): its popup, its line before the
  choice and every other way in, as a quest's. A whole build of a dungeon is the location's own blocks, drawn from
  nothing, so the heir's instance stands them on the floor under where they fell. Remains laid in the public room's own
  size (smaller or whole), or in a row from before the size was kept, are the public room's, as they always were.
- **instanceOffer**: offline or at an older relay, nothing. Otherwise the rows:
  - Public - never Privateer's Hold online (HOLD-ONCE).
  - Your instance - where a quest of mine names the place (the death quest's whole dungeon among them, HEIR-WHOLE: the
    quest's room where a quest names it too - the dungeon whole as well, so it stands the remains), and at the Hold.
  - `<owner>`'s instance - for each room a party member stands in at THIS place (partnerInstances: the pose's `ins`, its
    public room this place's - never a pixel, which Castle Daggerfall and the arena share) whose owner is in the party,
    the relay's own law, so nothing is offered that the relay would refuse. Named by its owner; one row a room.

  A place with nothing but its public room has no popup: the door opens as it always did.
- **questMountsHere**: online, a quest's things stand only in a dungeon whole - an instance, a main-story keep, a dungeon
  the world gives its whole size. Offline, as DFU's frozen size builds.
- **questDungeonWhole**: online, at a relay with no instances, a dungeon a quest of mine names is entered whole - in its
  existing whole room `dungeon:m<id>`. That is Mac's first answer, kept as the fallback.

THE PAGE (instanceDoor.js, HOST-SPLIT's shape - built once in world.js, asked by worldModes.js):

- **THE POPUP IS A PLAYER'S DOOR'S ALONE.** `atDoor` asks `choose` when the player takes a door - worldModes.js
  enterDungeonDoor and enterBuildingDoor, from activateStaticDoor and the greeting box's close - and AWAITS the answer; the
  entry (tryEnterDungeon, enterInteriorCore) is handed the entry decided, `{ instance, whole }`, and never asks. A Leave
  spends the press; a world moved while the popup stood up - another mode, or the door gone from the live doors (a
  teleport) - enters nothing (doorStands).
- **Every other way in** - a quest's `teleport pc` and `transfer pc`, a Recall, a load, a staff landing, the cemetery,
  the Abyss, the arena - asks `entryFor`, which never shows anything:
  - what a save, an anchor or a staff landing RECORDED of the place (`{ ins, whole, staff }`) where it may still be had
    (stillHeld: a staff landing's always; mine while what opened it runs - the Hold's for good, a quest's while a running
    quest that names the place holds its epoch, the remains' while they lie there whole; a partner's while its owner is in
    my party), else the public room laid as
    it was - an instance's place whole, so the position stands in the blocks it was taken in;
  - nothing recorded: a quest's place its instance - a partner's standing there first, the party together, else mine -
    and where none can be had (an older relay, no account yet) its public room whole; the Hold mine; anywhere else the
    public room.
  - The new game's start (`holdOpen`, nothing recorded) is the Hold's public room, never asked.
- **The popup** is `ui/talkWindow.js` ChoiceWindow laid over whatever is open (townTalk.pushOverlay) - the enhanced dialog
  on the Plus skin and the panel on the classic. It is a redesigned window, not a DFU one (Port-Doctrine, Scope). Its rows
  are numbered (`1 - Public`, `2 - Your instance`, ... nine at most - a full party's seven others with public and mine),
  and Leave is the Escape key's row (`Esc - Leave`: a keyed menu takes its codes alone). The window closed any other way -
  replaced, disposed - answers Leave: never a door left waiting on nothing.
- **Its two lines**: the place's name (localized, getLocalizedLocationName), then the question. At the Hold: "Privateer's
  Hold is closed to the public. You may enter an instance of your own, for you and your party."
- **A home keeps none**: a building the account service names a player's home, or a house of mine (houseOwnedAt), is its
  owner's room - never asked, never an instance. **Nor does the open zone** (WILD1, the door's `wild`): its real dungeons
  are sealed and its halls the relay refuses one, so no popup stands ahead of the seal's refusal.
- **A re-laid public room** stands none of a quest's things. `questElsewhere` says once a build: "Your quest's business
  here waits in your instance."
- **The relay's refusal** (`refused`, the realm's door's own shape - systems/realmSaves.js realmDoorShut): an instance's
  door shut on this page is said once a room ("That instance is closed to you. Only its owner and their party can
  enter.") and the player is taken out (world.js onlineFrame, forceExitToExterior) - never left inside an unconnected
  build.
- **The party pose's word** (`poseWord`): inside, the instance room the relay JOINED me to, never the one I meant to enter -
  a private room wins the key, a refused one is none.

## 5. The sizes (world/smallerDungeons.js, systems/quest/questRepair.js)

- **dungeonSizeFor** takes `whole`: online, the dungeon as Daggerfall lays it, whatever size the world gives it. An
  instance's build asks it, and so does a quest's dungeon where no instance can be had (dungeonTransition, the entry's
  `whole`).
- **The quest's world** (world.js questWorld `getLocation`/`getLocationByName`) asks it too online: a quest's markers
  are chosen on the dungeon whole, the layout its instance builds.
- **smallerDungeonsStateNow** stamps a quest started online with DFU's `Disabled` - the whole dungeon's, as its markers
  know it. A copy taken offline builds that layout.
- **relayQuestOnline** (the load's re-lay) re-lays any quest stamped otherwise - the world's sizes'
  ONLINE_DUNGEONS_STATE among them - on the whole dungeon, and stamps it `Disabled`.
- **The dungeon's mount** (worldModes.js mountQuestResources) asks questMountsHere before QUEST-VOID. QUEST-VOID's
  re-lay would otherwise carry the markers into the re-laid public room's blocks, back where the audit found them sealed.

## 6. Privateer's Hold

HOLD-ONCE stands for its PUBLIC room: online a character walks out of the Hold for good, and its door, a Recall and a
quest's transfer to its public room are refused. Its instance is entered any time: the door offers "Your instance" (and
any partner's), never Public; a Recall, a quest's transfer and a load take the instance by the door's rule (an anchor or a
save made in the public Hold recorded the public room - its door, HOLD-ONCE refuses). The instance opens on the Hold's own
word, so a character's Hold is one room for good (seven days of memory after it drains). The new game's start is
`holdOpen` and never asked: the public Hold, as before; a staff landing is `holdOpen` and lands in the room the player
stands in.

## 7. THE FOUR HOSTS

- **scenes/worldModes.js** - WIRED. A player's door asks (enterDungeonDoor, enterBuildingDoor); the entries
  (tryEnterDungeon before HOLD-ONCE, enterInteriorCore) take the entry decided or the door's rule. `placeInstance` is the
  mode's own - set as a dungeon or a building is built (dungeonTransition, interiorTransition), gone with the mode
  (setMode) - and roomIdentity reads it. The interior's identity (save and anchor), the dungeon's anchor context (kept on
  the anchor: systems/teleportAnchor.js makeAnchor `dungeon`) and the dungeon save (`placeRecord`, dungeonContext.js dungeonHome) record it; restoreInterior and startInDungeon hand it back.
  dungeonTransition builds by the entry's `whole`; mountQuestResources asks questMountsHere.
- **scenes/world.js** - WIRED. It constructs the door (HEIR-WHOLE: one dep more, `remains` - where the line's remains
  lie, the Legacy host's remainsWhere), keys the room by the identity's instance, sends the party pose's
  `ins` (the door's poseWord), takes the player out on the relay's refusal, hands a Recall, a load and a staff landing
  what they recorded, and its quest world asks for the dungeon whole online.
- **scenes/exterior.js** - NAMED, not wired: the offline fixed city keeps no relay room and offers no instance.
- **scenes/dungeonContext.js** - its save's dungeon home carries the instance word (`placeRecord`); it enters no place.

## 8. Pinned

- `test/net/instances1.test.js` (8): the law - the owner's and the Hold's digests and the epoch's spelling, the key both
  ways, a world room on its own clock, roomKeyFor, the relay's door with the hub's word, the party word, the relay
  version.
- `test/net/instances2_relay.test.js` (11): the real Room's hello with signed tokens - the owner, a party member by the hub
  (a real Room over its own storage), a stranger refused before anything is written, the hub silent is busy, a relay of
  one room, the public room untouched, the alarm's clock; the party pose's `ins` a room key; the audit's: a member kicked
  refused out by the re-ask and never asked more often, the party as it stands (a lapsed owner) and no no kept, a zone
  hall refused to all, the gate by account, a member gone on its own while the hub was asked never refused after.
- `test/systems/quest/instances3_door.test.js` (15): the door's law over the real QuestMachine and Place, a quest's epoch for its life
  (its save, a copy's, a resync's), the sizes and the load's re-lay, partners by their room, the offer; the door's popup
  awaited (its rows, Esc, the window closed any way), no popup where nothing is chosen, the Hold, a partner, a building, a
  home; entryFor's rule and what was recorded; atDoor, refused, poseWord, questElsewhere; the funnel and the doors
  executed from their source; the hosts by source; the Recall anchor's dungeon record.
- `test/net/staffTeleport.test.js`: a staff landing in the player's instance.
- `test/systems/legacy/fb1019f_heirwhole.test.js` (4, HEIR-WHOLE): a death in another player's instance of a ruin the
  world lays medium, and the heir's door - its popup, their own instance, its build standing the remains under where
  they fell; the room kept while they lie, a quest's room first, the older relay's whole public room; public-room
  remains as they were; one whole layout whoever builds it. `tools/mutants/fb1019f_heirwhole.json` (13), all dead.
- `tools/mutants/instances.json` (51), all dead; the lists re-aimed by content where this arc moved their lines.
- PIN MOVED: RELAY_VERSION world208 in every file that names it, and `test/net/relayversion.test.js`'s row and graph; the
  quest stamp and the re-lay; the funnels', the doors' and the identity's shapes; the relay's hello gate; the account
  Worker's deploy filter (`.github/workflows/account-deploy.yml`: net/instanceRoom.js is in its bundle).
- HOST-SPLIT: bootWorld's ceiling stands at 21,676 (LOWERED from 21,679 as the arc moved homeYardWallet to
  scenes/homeYards.js); the audit's wiring fit by moving the party pose's word into the door (poseWord).

## 9. Open

- **The relay deploy.** world208 is NOT YET DEPLOYED. Until it is, no page offers an instance, and a quest's dungeon is
  entered whole in its public room (the fallback). In that window a party member without the quest enters the world's
  size of it (`.m`/`.s`) and stands apart from the quest's holder - an older relay drops every word that could say which
  room a partner is in.
- **Two members choosing at once.** Each member's instance is its owner's: two who both choose "Your instance" in the
  same second stand in two rooms (a join row appears once a partner's pose says its room, within PARTY_SEND_MS). The one
  who leaves and comes back is offered the other's.
- **Every dungeon.** Mac chose quests', the Hold's and buildings' (the death quest's whole dungeon is a quest's -
  HEIR-WHOLE). A door at any dungeon is one row of instanceOffer away.
- **A re-laid public room's own quests.** A player who chooses Public at a quest's dungeon finds its things in the
  instance only. The choice is theirs; QUEST-ELSEWHERE (2026-10-16, `01-Overview/bugs/Field-Bugs-2026-10-16c.md` - MD-Geist:
  "the Objective just did not want to spawn (I tried the dungeon in 'Public' mode) even after 'Quest Repair'") says it
  BEFORE the choice, in the popup, where the world builds the public room smaller (`dungeonSite`'s `relaid` - the size
  built, which the mount reads too; AUDIT FB1019f B1), and Quest
  Repair in that room says where the things are instead of "Nothing was missing". The automap keeps each layout's map
  (LAYOUT-KEEP): exploring one room no longer wipes the other's.
- **Reachability.** The public world's re-laid dungeons can still seal an area from their entrance - the Hold of
  Coppering's medium build does - for anyone exploring them. A reachability pass over every dungeon's small and medium
  builds (the audit's walker, `player/collider.js`) is the measure, and is not this arc.

## 10. The audit (2026-10-16)

Mac: *"Lets audit this and ensure its perfection. No band aids."* Two independent passes (the relay and the page) and
this one found, and the arc fixed at their roots:

- **The popup in the entry.** It was asked inside tryEnterDungeon and enterInteriorCore, which every way in shares, and
  answered "not entered" while it stood up. A quest's `transfer pc inside` (S0000016 into the Mantellan Crux, the main
  quest's last dungeon) then stood the player at dungeon coordinates outside; a Recall lost its anchor; the cemetery, the
  Abyss and the arena took the popup's "no" for a failure. Now the popup is a player's door's alone and awaited there;
  every other way in takes the door's rule (section 4).
- **A quest's room by its uid** - reused by a later quest after a reload (section 2).
- **The instance forgotten** by a load, an anchor and a staff landing, and a stale one read after a door asked and the
  build failed: the instance is the mode's own, recorded and handed back (section 7).
- **Partners by pixel** - Castle Daggerfall's and the arena's shared one cross-offered rooms; a room offered whose owner
  had left the party, which the relay refused; a shared room named by whoever stood in it.
- **A home asked**, its owner keyed into an instance its visitors were not in; the pose's `ins` advertised the meant room
  where the private one won the key.
- **The relay**: admission never asked again (a kicked member kept the host's seat and the memory), the stored party read
  (lapsed seats admitted), a no kept fifteen seconds, a zone hall copyable, the door's bucket before the token.
- **The refusal** was final and unhandled - the player left inside a build with no room; now said and taken out.
- **The popup**: Esc did nothing and a full party's Leave was `Digit10`, which no key sends; the place's name unlocalized.
