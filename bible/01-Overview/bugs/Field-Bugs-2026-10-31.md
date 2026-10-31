# FIELD FEEDBACK 2026-10-31 - twelve asks from #feature-feedback, and the bench's Stores

The owner handed over three Discord #feature-feedback threads ("new window light is weird", "Feedback Doc 2") and a
patch, with "Also implement the file". Each ask is a slice below, built on its own record and pinned there. The change
was then read cold (the owner: "Audit this"): `../audits/Audit-FB1031.md` holds every finding and what became of it.
Read and measured with the freeware's data (`tools/fetch-data.sh`).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | its_WiKeD: "when you open up a bench you need to scroll all the way down, click stores, then scroll all the way up top just to store stuff" | Since CRAFT-HALL a station opened the Crafting page, the Stores' put-in at the foot of another page | STORES-AT-BENCH |
| 2 | moonkehh: "It gets way to bright at night for me. I still want to see outside but not be blasted by the light" | The moon lit a room through its glass at a gain above the sun's, and every pane glowed at half the night's ambient | WINDOW-NIGHT |
| 3 | "Overworld packs ambushing you spawn way too far away" | A band met with the view down stood 140 m off, past its own 60 m sight | BAND-NEAR |
| 4 | "Decoration restriction need to be looser on the exterior of houses ... the walls better, and balconies" | Every yard piece stood at most 4 m up, and a picture on a wall stood off it | YARD-WALLS |
| 5 | "Jungle trees need better or more collision, enemies just hide in them" | Only the player was kept out of a tree; a foe stood in a trunk, seeing and shooting out | TRUNK-FOES |
| 6 | "Red Mountain doesn't always render" | The far views were not drawn under any weather fog, and ash falls on the volcano half its hours | RED-MOUNTAIN-SEEN |
| 7 | "Soulbound items need to be disposable, certain aetheric sets and hearth offerings" | No way out for the Wyrd's Raiment, unpriced Broker wares, Soul Cakes or Hearth Offerings | BOUND-DESTROY |
| 8 | Sammy: "Add a sort button to the inventory!" and "sort things in my carriage inventory or any side inventory" | No sort anywhere; a drag moved one pack row at a time | PACK-SORT |
| 9 | Sammy: "Display on the world map 'witnessed areas' for stuff like ores and pearls" | Witnessed ground showed nowhere but the ORE-MAP card, a pixel at a time | WITNESS-MAP |
| 10 | Sammy: "Add missing weapon types to be smithable (Light flail etc)" | Every DFU weapon was made; RRI's Light Flail and Archer's Axe were not | SMITH-RRI |
| 11 | Sammy: "The game should not add meat to your inventory when you skin animals" | The Materials Bag carried every harvest, the butchery's meat too | BUTCHER-STORES |
| 12 | Sammy: "Daedric is way too common, I think it should drop but very rarely" | From level 20 every granted Daedra drop was Daedric (METAL-RAMP) | DAEDRIC-RARE |

## 1. The bench's Stores (STORES-AT-BENCH)

Built from the handed-over patch, its STORES-AT-BENCH hunks alone: the rest of it reverted newer main. The Crafting
page at a station draws Put everything in and Your Stores over the station worked there, and a press lands on them
(`06-Systems/Professions-Arc.md` 56.6). AUDIT FB1031 P1-P3: at a forge the bar now stays over the Anvil through its own
repaint, its answer is never lost, and its mutants are recorded.

## 2. The windows by night (WINDOW-NIGHT)

FOUND. A full Masser's patch added 4.2 times a room's ambient on the Enhanced lane, and the only switch, Real windows
Off, also took the view out. FIXED. The moon's gain is 0.3 and the panes' night glow 0.1: the patch adds 1.1 times the
ambient, 0.4 on the classic set. The Real windows card has a Window light part: On, Day only, Off; the view out stays
under each (`07-Rendering/Real-Windows.md`). AUDIT FB1031 L1: the glow and Day only ease through dusk and dawn.

## 3. A band near enough to come (BAND-NEAR)

FOUND. A band that caught the traveller with the view down stood at 140 m, past its members' 60 m sight, and came on
blind. FIXED. It stands at 45 m: every member 33 to 57 m off, inside its sight and past DFU's 10-20 m wilderness ring
(`06-Systems/Travel-View.md`). AUDIT FB1031 B1: it stands just outside the view, never mid-screen. NOT CHANGED: the
camps' 100-150 m (CAMP-FAR), and the Overworld's 30 m contact.

## 4. A house's walls and roofs (YARD-WALLS)

FOUND. YARD-HEIGHT held every yard piece to 4 m; half the Bay's 6,016 houses have walls to 6.45 m and 1,633 a flat roof
there. FIXED. A piece stands to 8 m on or against its house, never above its roof; free of it the 4 m holds. A
picture set on a yard's wall hangs flat (`06-Systems/Online-Arc.md` YARD-WALLS; acct233). AUDIT FB1031 Y1-Y8: "against
its house" reads the house's own ground, roofs and faces, not its box; a duplicate hangs upright; no tree hangs.
OPEN (Y4): the service knows no lots, so a crafted client can stand a free piece to 8 m. NOT CHANGED: roads; the deck
minimum, since every smaller level roof inside the walls is a stair tread.

## 5. Trees that hold foes out (TRUNK-FOES)

FOUND. Only the player's clamp read a tree's body, so a foe walked into a trunk, saw and shot out, and the player's
arrows stopped at the bark. FIXED. Every pool's spacing pass puts a foe in a nature body at its edge, a lone foe too
(`03-World/Player-Arc.md` TRUNK-FOES). AUDIT FB1031 F1-F6 and II K1: a ray hides only where it crosses the cover's middle inside it, so a body in front is struck
and one behind is hidden both ways; each flight lists only what it may strike; a foe steps round a trunk.
NOT CHANGED: barrels, statues and carts hold no foe, since no foe's steering reads a body.

## 6. Red Mountain in the weather (RED-MOUNTAIN-SEEN)

FOUND. Past the streamed grid the volcano stands only in the far views, and they were drawn only under linear fog;
every weather fog, ash among them, took the land's shape off the sky. FIXED. Under a weather fog the far views draw
in its colour (`03-World/Red-Mountain.md`). AUDIT FB1031 L2-L4: they fog by the weather's own law, so no seam stands at
the grid's edge, and DFU's grey eases in. The cone shows by day in rain, snow and ash; at night in rain nothing does.

## 7. A bound piece let go (BOUND-DESTROY)

FOUND. A bound piece went only to the wagon or the player's storage, and only a priced Broker ware was dismantled.
The cakes and bowls are the account service's counts, so a removal in the pack came back. FIXED. Both packs offer
Destroy where Dismantle pays nothing, and ask first (`systems/item/itemDiscard.js`); the service lets cakes and bowls
go once per request (`/v1/festival/discard`, migration 0204, acct235; `11-Multiplayer/Sigil-Sets.md`). AUDIT FB1031
D1, D5: a lost let-go is never replayed, and a copy the realm locked is never paid for. NOT CHANGED: the coin, the
Wallet, the Card Binder, the Dwarven Dragon, Weir Keys and main's Portal Book, given once.

## 8. Sort (PACK-SORT)

FOUND. The pack listed items as they came; only a drag moved a row. FIXED. One Sort press orders the pack, the wagon,
the Materials Bag or the player's storage by page, rarity, name and value, quest items first (`ui/packSort.js`;
`10-UI/UI-Arc.md` PACK-SORT). The order is saved and a drag still works after it. AUDIT FB1031 P4: horses keep their
order, the first being the one ridden. NOT CHANGED: a container, a body, the ground, a shared chest; the classic skin
draws no control.

## 9. Witnessed ground on the map (WITNESS-MAP)

FOUND. Witnessed ground stands every vein, gem and pearl, and the map showed it nowhere. FIXED. The held map tints it
in copper from the middle zoom in, in every province and on the sea past the Bay, with a legend row and a Ground switch
(`06-Systems/Professions-Arc.md` 61). AUDIT FB1031 W1-W7 rebuilt its read: the day's ground is laid once as 64-pixel
tiles (migration 0205, acct238), the map reads every tile in view by its key from a replica, the wash is kept on the
sheet's layer, and a pixel heard confirmed shows at once. NOT CHANGED: the classic region map and the farthest zoom;
ground other players confirm today shows the next UTC day.

## 10. The mod's two weapons at the anvil (SMITH-RRI)

FIXED. The anvil makes the Light Flail (3 ingots, Copper, Cured Leather) and the Archer's Axe (2 ingots, Copper, Oak
Plank) in every metal; the other crafts' first-make shares were derived again (`06-Systems/Professions-Arc.md` 59).
AUDIT FB1031 C3: a sworn revenant wields them.

## 11. The meat to the Stores (BUTCHER-STORES)

FIXED. A skinned body's meat goes to the Stores, never the bag or pack, when the client says it reads it there
(migration 0203, acct234; `06-Systems/Materials-Bag.md` 17). Older clients and services keep the carried path. AUDIT
FB1031 C1: a Stores row asked again by an older build names it no meat. NOT CHANGED: Climates & Calories' corpse meat,
which the player takes from the body.

## 12. Daedric, rarely (DAEDRIC-RARE)

FIXED. A granted Daedra drop that METAL-RAMP makes Daedric is Daedric one draw in ten at any level, Ebony otherwise
(AUDIT FB1031 III: below level 20 the ramp's own metals stand as before); how often Daedra drop is unchanged (`06-Systems/Unleveled-Loot.md`). OPEN (AUDIT FB1031 C2, III X1): the gate Warden's kill (its
Regalia and its ordinary pieces) and main's Delve vault are Daedric sources DAEDRIC-RARE does not reach; it is the owner's call.

## Deploy

The account service before the site: acct233 to acct238 (YARD-WALLS, BUTCHER-STORES, BOUND-DESTROY, the AUDIT's
hung tree, WITNESS-MAP, its AUDIT's tiles), migrations 0203, 0204 and 0205. No relay change.
They were acct231 to acct236 on the branch, renumbered past main's MUSIC-BOX (acct231) and PORTAL-BOOK (acct232) at
the merge of main at 8d1563b4c.
