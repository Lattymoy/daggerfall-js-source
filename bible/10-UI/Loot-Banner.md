# The Loot Banner (LOOT-BANNER, ACQUIRE1)

**Status: built (2026-10-09).** Mac: "So with the introduction of new card items. I want to develop a popup for when you
obtain something of rarity including weapons, armor, the new cards, etc. Something akin to a destiny loot popup
notification."

A banner slides in at the right edge of the screen whenever a Rare-or-better piece arrives in the player's keeping. It
shows the piece's picture framed in its tier, its tier label and pips, its name in the tier's colour, and what it is. The
three top tiers stand bigger and play a fanfare. Enhanced Plus only.

## 1. Mac's four answers

| Question | Answer |
|---|---|
| Which tiers get the banner? | **Rare and up** - Rare, Legendary, Aetheric, Artifact, Gilded. Common and Magic keep the small pickup feed under the crosshair (`01-Overview/Field-Bugs-2026-10-01d.md`, PICKUP-FEED). |
| Which ways of getting an item? | **Everything new to you** - loot, a gate's or a raid's spoils, a quest's reward, a craft, the Sigil Broker, a shop, a trade, the market, a card. |
| Where? | **The right edge, by the notices.** |
| How do the top tiers stand out? | **A bigger banner and a sound** - Aetheric, Artifact and Gilded. |

## 2. What arrived - the watcher (`src/systems/acquireWatch.js`)

There is no single door an item comes through. A take from a body or a chest tells the LOOT8 listeners
(`inventory.js:"export function tellTaken(item) {"`), but a purchase, the Broker's sale, a quest's reward, the spoils, a
craft, a trade, the market and a card all `addItem` straight into the pack - and a take out of the wagon or the
Materials Bag tells the listeners as if it were new. So the pack is watched, not the doors.

- **Once a frame**, on drawHud's one call (`hud.js:"drawLootBanners({ entity: vitals,"`) - every host hands drawHud the
  player entity as `vitals` - the watcher (`acquireWatch.js:"export function createAcquireWatch()"`) reads the player's
  three own lists: the pack, the wagon and the Materials Bag. It runs on every skin, so a piece found on the classic skin
  is not announced if the player switches to Enhanced Plus later.
- **The mark.** A piece that could ever announce (`markable` - a weapon that is not ammunition, armour, clothing,
  jewellery, an artifact, a card) gets `acquired: true` the first frame it stands in one of the lists. An unmarked one
  there is an arrival. The mark is a declared item field (`itemFields.js:"acquired: bool(),"`), so it rides the save and
  the house's chests: a piece taken back out of the player's own storage, or picked back up off the ground, is not new.
- **The receiver's mark.** Like `equipSlot` and `questItem`, the mark is stripped off the wire
  (`systems/loot.js:"for (const k of RECEIVER_MARKS) delete out[k];"`) and off the zone's death record
  (`wildDeath.js:"for (const k of RECEIVER_MARKS) delete copy[k];"`). A piece another player hands over - a trade, the
  zone's remains, the market, a room's chest - is new to its taker.
- **And the realm's trade law reads the same list (MARK-WIRE, FIELD BUGS 2026-10-09b).** The three receiver's marks are
  ONE list, `realmTradeLaw.js:"export const RECEIVER_MARKS = Object.freeze(['equipSlot', 'questItem', 'acquired', 'wagonEntry']);"`,
  which the realm's volatile fields spread and its moved record strips. ACQUIRE1 first added the mark to the wire's clamp
  and the death record and not there: the pack's record carried it, the List form's offer did not, and the market, a
  stall and a realm trade refused every marked piece ("The realm does not hold that piece where your pack had it" -
  `01-Overview/Field-Bugs-2026-10-09b.md`).
- **Cards** stack, and a card that lands on a stack the player already holds merges into it and is gone as a record. So a
  card's arrival is its count rising: the three lists' total of that card, frame to frame, less what a marked record new
  to the lists brought (a stack of the player's own back from a chest).
- **Moving between the three lists is never an arrival.** A whole move carries the same marked record; a split mints a
  record of a card whose total did not rise.
- **New baselines, not floods.** The first frame of an entity, a load (save.js restorePlayer replaces the lists), and
  every frame of character creation up to and including the frame it ends (its kit and the starter deck) are read and
  marked, and announce nothing.
- **What announces:** a tier at or over Rare. A card's tier is its catalog's (`net/iliacCards.js` - printed on its face,
  whatever loot rarity's switch says); any other piece's is the tier the pack shows (lootRarity.js rarityAttr - nothing
  with loot rarity off, nothing for Common).

## 3. The banner (`src/ui/lootBanner.js`)

- **The face.** The piece's picture in a well framed in its tier - a card's own painted face
  (`render/iliacCardFaces.js` paintIliacCard); a kicker in the tier's light with its pips (the pack's tier label:
  "Exalted Legendary", "Perfect Rare"; a card's "Rare Card"); the name in the tier's colour, with a count when more than
  one came ("x2"); what it is under it (the template's name - "Longsword", "Helm" - or a card's kind - "Unit card").
  The tier's edge runs down its right side and a light sweeps it once as it lands. A screen reader is handed the whole
  line at once.
- **The top tiers** (Aetheric, Artifact, Gilded) stand taller, their picture larger, the edge wider, with a glow that
  breathes twice, and hold longer. The frame they land in plays the Arena's fanfare (SOUND.ArenaFanfareLevelUp) once,
  behind the port's own sounds switch (`systems/enhancedSounds.js`).
- **The law** (`lootBanner.js:"export function createBannerQueue("`, pure): three stand at most, the newest on top. Each
  holds 4.5 s (a big one 7 s) and slides out; a banner sliding out holds no place. What arrives while three stand waits,
  the best tier first, at most twelve. A second card of a kind whose banner stands or waits adds to its count.
- **The HUD's hide gate.** Under a window - the loot window, a shop's counter, the Broker's - the stack stands hidden and
  nothing ages, so a piece bought or taken there is announced when the window closes. A piece no longer held when its
  turn comes (zone remains the room gave to another player) never stands.
- **Where.** The right edge, 60% down the window. When the notice stack is in the way the banners step under it, and
  never pass the window's foot - a band too short for every banner shows the newest (`bannerLayout`). The HUD-MOVE
  layer moves the stack like any HUD piece (`hudLayout.js:"{ id: 'loot', sel: '.lootbanner-stack'"`, "Loot banners",
  with a preview while the UI is unlocked); moved, it fades where it stands rather than sliding from the edge.
- **The dress** is the pickup feed's - its veil, stone bevel and ring, tinted per Plus theme through the shared veil law
  (`enhancedFrame.js:"export const hudVeil = (th) =>"`, moved there from the pickup feed, its first reader). The tier
  colours are the RARITY-UI table's.
- **Classic skin.** Nothing is built - no node, no sheet (AUDIT 39's law). The watcher still reads and marks.
- **Reduced motion:** no slide, no sweep, no glow.

## 4. The pickup feed and the codex

- **The pickup feed** (`ui/pickupFeed.js`) no longer cards a piece the banner will announce - one new to the player in
  Rare or better (`pickupFeed.js:"const fresh = (m) =>"`). Its take still says no line for it. A Rare piece of the
  player's own, picked back up, is carded in its tier as before.
- **The codex.** LOOT10's first find of a Legendary record (`06-Systems/Loot-Arc.md` section 12) said "<name> - a
  Legendary! It joins your codex." and chimed. On Enhanced Plus the banner announcing the same piece says it instead -
  a "New to your codex" chip and the codex's own chime - through a presenter slot in the watcher, so the HUD never
  imports the codex and the codex never imports a face
  (`lootCodex.js:"if (!quiet && !presentCodexFind(item, key.kind)) {"`). The banner declines, and the codex says its line
  as before, on the classic skin, for a piece already read whose banner has gone, and for one no frame will read.

## 5. Known limits

- Pieces already sitting in a house chest, the guild vault or another storage that is not the pack, wagon or bag when
  this ships carry no mark. Each announces once, the first time it is taken out.
- A stack of cards of the player's own taken back from storage onto a stack of the same card already in the pack merges
  as it lands, so its count reads as risen and it is announced.
- A piece of the player's own put into an online room's chest comes back through the wire, which strips the mark; taken
  out after the room is rebuilt, it is announced.

## Pins

`test/lootbanner.test.js` (the watcher, the cards, the baselines and the wire, the law, the face, the top tiers, the
codex, the wiring); the pickup feed's hand-off in `test/pickupfeed.test.js`. `tools/mutants/lootbanner.json`: 33, all dead.
PROBE: `node tools/lootBannerProbe.mjs` - the real banners over the real HUD and a notice toast in Chromium at a desktop,
a laptop and a phone: at the right edge, under the notices, no sideways scroll, every name in its tier's colour, the top
tiers big and taller, the best of a burst standing first. 183 checks.
