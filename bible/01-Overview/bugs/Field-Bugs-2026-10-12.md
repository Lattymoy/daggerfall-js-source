# FIELD BUGS 2026-10-12 - eight threads from the bug-reports channel

Eight Discord threads from the evening of 2026-10-11, handed over as screenshots. Read on the code as it stands at
main's `e18e54322`. Five are fixed here; one was a switch, thrown on Mac's word; two are not defects this tree can show.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Guild Chapters stuff never appears" - "The stuff described in the 'The Chapters' update never seems to appear on any noticeboards" | `server-account/wrangler.toml` still reads `CHAPTERS_OPEN = "dev"`: only DEVELOPER_HANDLES witness halls, list chapters or post hall and member writs; #734's patch notes told everyone | switched on (CHAPTERS-ON; Mac: "Turn them on") |
| 2 | "Docks Crossing - In Penwall Derry there are two docks crossing over and blocking each other" | each berth's quay planned alone; round a point of land two berths' jetties, walked landward up to JETTY_MAX over the shelf, crossed | fixed (QUAY-CROSSING) |
| 3 | "Decorating Issue - Room 3 is bugged - clip through wall, cant place" | the room finder took the void between two storeys (a ceiling's top under the next floor) for a room; its tab's flight began inside the gap | fixed (VOID-ROOM) |
| 4 | "Possible key press parsing glitch (sound stuttering only when holding down a button)" | no keydown path touches audio, and every one filters auto-repeat; the likeliest cause is walking (streaming hitches past the music's 0.25 s lookahead), not the keys | not changed - questions to the reporter (KEY-STUTTER, below) |
| 5 | "I was with a trade lock because of a Ring, I got rid of the ring and now it says only 'something'" | the third law hold stands for staff once the piece is gone, and the answer said nothing of it; the trade refusal never named the piece the session had heard | fixed (RING-HOLD); the player's hold is staff's to clear |
| 6 | "Decorating Issue - My property... This house has no property lines, can't place anything - only on inside" | a terraced house with neighbours flush on three sides and the street at its door has no free ground in its lot; the house's own exterior is the house (FB1009 HOME-FOOT) | not a defect - a design limit (NO-LOT, below) |
| 7 | "Water not working as water should in new region west of the bay" - "Cannot swim back to boat" | Deep Waters carved the Eltheric Ocean's floor through the pump's deferred builds; TAMRIEL2 held only the near promote | fixed (ETHER-HOLD) |
| 8 | "Underwater torch/lantern/candle issue" - "almost total blindness" | the lane's fog in-scatter integrated at the underwater murk's own density, ten times its tuning point | fixed (UW-GLOW) |

## QUAY-CROSSING: a harbour's quays never cross (2)

`src/systems/naval/quays.js` planQuay `others`, pierOutline; `src/scenes/quayPool.js` lay, frame;
`src/systems/naval/shipLife.js` quayBox, boxesMeet, BERTH_QUAY_IN, BERTH_QUAY_ENDS, findHarbour.

FOUND. `findHarbour` kept berths apart by their centres alone (`length * BERTH_SPACING`), and `quayPool` planned each
berth's quay alone. A jetty is walked from the deck's back along its own berth's landward normal, up to JETTY_MAX (200 m
since HARBOUR-BOOK widened it for Deep Waters' shelf). Round a cape or a bay's horn, berths 65 m apart face each other
landward, and their jetties met over the water in an X. Synthetic bays reproduce it; a fuzz of 294 capes and islands
crossed piers in 20 towns (12 jetty over jetty, 8 deck over deck); straight coasts never. Penwall Derry's own shore is
not readable without ARENA2.

FIXED. A later berth's jetty ends where it first meets an earlier berth's pier - their decks stand at one height, so the
walk is a T and every quay still reaches land. The pool lays berths in order, each only once every earlier one has its
plan, so every client plans it against the same piers. `findHarbour` refuses a berth whose ship and quay overlap an
earlier one's (separating axes). The fuzz: 20 towns to 0, berth count unchanged. test/systems/naval/quaycrossing.test.js.

## VOID-ROOM: the void between storeys is no room (3)

`src/systems/decor/decorRooms.js` cast, sample.

FOUND. `sample()` took any surface with DECOR_ROOM_HEADROOM above it for a floor and never asked which side of a face
its rays struck. The collider is two-sided: the ray down met the top of the lower room's ceiling, the ray up the
underside of the floor above, and a gap of 1.7 m or more passed. Floors sort lowest first, so in a two-storey house
with two rooms downstairs the gap was "Room 3", and its flight began between the storeys - `roomPick` holds until the
interior changes, so every placement after began there, behind faces the flight cannot cross. AUDIT REST II F4 found
the same shape in the dungeon's fires.

FIXED. A spot whose ray below and ray above both struck a face's back (`hit.back`) is outside every room. Both, not
the one: an upstairs floor laid on the ceiling below is met from behind going down and is a room. test/scenes/decor/homedoors.test.js
built its boxes inside out and is re-wound (as auditrestparty_fires was); test/systems/decor/decorrooms.test.js's VOID-ROOM pins the
four tabs down to three.

## RING-HOLD: the hold that stays says whose it is, and a refusal names the piece (5)

`server-account/src/verdict.js` verdictOn's `why`; `src/net/realm/realmTradeLaw.js` TRADE_HELD_NOTICES.review,
realmTradeRefusalText `said`; `src/systems/item/itemIds.js` tradeHeldNotice; `src/systems/realmSaves.js` heard,
tradeHeldWhy, settleRealmTradeHalf `heldSaid`; `src/scenes/world.js` the escrow's `heldSaid`.

FOUND. A strike counts each time a law hold rises, and dropping the ring lifts it - the ring's notice ("Trading is
frozen until it is gone") invites exactly that. At STRIKES_FOR_REVIEW the hold stands for staff with nothing found,
and the answer carried no `why`: the same `tradeHeld: 'law'` as a piece still carried, and no notice (law to law). The
trade refusal was built from the reason key alone, so even with the Ring carried it said TRADE_HELD_NOTICES.law's
"something it carries". Reproduced through the real Worker: carry, drop, three times, then drop - held, no word.

FIXED. A law hold with no finding answers `why: { code: 'review' }`; the client stores the `why` it heard and says the
review notice ("until staff have looked") when it comes; a refusal over my own hold says the notice the session last
said, the piece named.

RING-WARN (Mac, asked whether taking the same piece up again should be a new strike: "Your call"). The rule stands:
a strike a hold, the same piece's included. A piece parked on the ground while its carrier trades and taken up again
after is exactly what the strikes are for - counting a signature once would let it be parked forever. What trapped the
player was the notice, which offered "until it is gone" as the way out and never said the holds were counting. Every
law hold's notice now ends `TRADE_HELD_STRIKES` (`net/realm/realmTradeLaw.js`): "Each time the law holds it counts: the third
time, trading stays frozen until staff have looked." - the generic one and the one naming the piece; test/systems/item/ringhold.test.js
pins it on both and pins the words' "third" to the service's STRIKES_FOR_REVIEW. test/systems/item/ringhold.test.js. The reporter's hold is staff's: `node tools/realmReview.mjs holds`,
`findings <id>`, `clear`.

## ETHER-HOLD and UW-GLOW (7, 8)

Recorded on their pages: `03-World/Eltheric-Ocean.md` "Recorded departures" (test/world/ethersea_dwhold.test.js) and
`07-Rendering/Enhanced-Lighting-Arc.md` UW-GLOW (test/render/uw_glow.test.js).

## CHAPTERS-ON: the switch #734 never threw (1)

The client path is whole - the board's Work tab, `/v1/writs/list`, the witness reports. Every route of the Chapters
asks `chaptersOpenFor` (`server-account/src/npcRoll.js`), and production's `CHAPTERS_OPEN` is `"dev"`: an ordinary
player's witness answers 403 `chapters-closed`, the board lists no chapter, no hall writ, no member's writ. Measured
over the real migrations with production's vars: `dev` gives `chapters=[]`; `on` gives both halls' chapters and the
member's writ. Throwing it gives the Roll every online character's guild standing, so it waited on Mac's word.

SWITCHED ON (2026-10-12, Mac: "Turn them on"). `CHAPTERS_OPEN = "on"`; the two pins that held `"dev"` moved
(chap1_roll, chap2_halls); CHAPTER_TITLES is its own switch and stays off. test/server/chapterson.test.js stands the service
under the toml's own vars: three ordinary week-old accounts witness a town's halls, and a member's board lists both
chapters, a hall writ and the member's own writ (at `dev` the witness answers 403). What follows the deploy: boards fill region by
region as three week-old accounts witness each town - a client refused today stamped today's date for that town, so it
reports again the next UTC day - and the first week settled `on` starts every chapter's Strength from 50 (AUDIT CHAP3
S2). The service carries no code change, so its version is unchanged; the account service deploys the line.

## KEY-STUTTER: no key reaches the audio (4)

Every keydown listener of the live hosts was read: the gesture resumes act only on a suspended context, the music's
gesture start only before a song is pending, and every ladder arm filters `e.repeat`. Nothing synthesises audio on the
main thread (the rain and wind are native loops). What the main thread does drive is the song scheduler
(`songPlayer.js` LOOKAHEAD_SECONDS 0.25, a 100 ms tick): a hitch over ~150 ms starts notes late. Holding a movement key
is walking, and walking outdoors streams. Not changed: the reporter is asked which sound stutters (music, rain or
steps), whether holding an unbound key standing still does it, and whether holding a key in another program does.

## NO-LOT: a house with no ground of its own (6)

`src/scenes/homeYards.js` yardWhyNot. The lot is the house's box and YARD_MARGIN; another building's ground, the
neighbour's side of the midline, roads and anything over DECOR_YARD_HIGH are taken out. A terraced house (an 8 x 10 m
model, neighbours flush on three sides, the street at the door) keeps 0 placeable cells of its lot, and its drawn edge
runs inside the neighbours' houses. Its balconies are the house (HOME-FOOT). Decorating the house's own up-facing
exterior is a new rule, not a fix.
