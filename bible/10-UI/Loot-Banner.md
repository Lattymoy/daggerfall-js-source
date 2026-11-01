# The Loot Banner

A banner slides in at the right edge of the screen when a Rare-or-better piece arrives in the player's keeping. It
shows the piece's picture framed in its tier, the tier label, the name in the tier's color and what the piece is. The
top tiers stand bigger and play a fanfare. A new title or aura gets the same banner. Enhanced Plus only.

## How it works

**The watcher** (`src/systems/acquireWatch.js` `createAcquireWatch`). Items enter the pack through many doors (loot,
shops, quests, crafts, trades, the market, cards), so the pack is watched, not the doors. Once a frame, from the HUD's
`drawLootBanners`, it reads the player's pack, wagon and Materials Bag. It runs on every skin.

- A piece that could announce (`markable`: a weapon that is not ammunition, armor, clothing, jewelry, an artifact, a
  card) gets `acquired: true` the first frame it is in one of those lists. An unmarked piece there is an arrival.
- The mark is a saved item field, so a piece taken back from the player's own storage is not new.
- The mark is a receiver's mark (`src/net/realm/realmTradeLaw.js` `RECEIVER_MARKS`): it is stripped off the wire and
  off a zone's death record, so a piece another player hands over is new to its taker.
- Cards stack, so a card's arrival is its count rising across the three lists. Moving between the lists is never an
  arrival.
- The first frame of an entity, a load, and character creation are read and marked, and announce nothing.
- A piece announces at Rare or above (`BANNER_MIN_TIER`). A card's tier is its catalog's; any other piece's is the
  tier the pack shows, so nothing announces with loot rarity off.

**The banner** (`src/ui/lootBanner.js`). The kicker is the pack's tier label ("Perfect Rare", "Rare Card"), the name
carries a count when more than one came, and the line under it is the template's name or the card's kind. Aetheric
and above (`BANNER_BIG_TIER`) stand taller, hold longer and play the Arena fanfare once, behind the port's sounds
switch (`src/systems/enhancedSounds.js`).

**The queue** (`createBannerQueue`, pure): at most three stand (`LOOT_BANNERS_MAX`), the newest on top. Each holds
4.5 s, a big one 7 s. Arrivals wait best tier first, at most twelve. A second card of a kind already shown adds to its
count. Under a window (loot, a shop, the Broker) the stack is hidden and nothing ages, so a piece bought there is
announced when the window closes. A piece no longer held when its turn comes never stands.

**Where.** The right edge, 60% down the window, stepping under the notice stack and never past the window's foot
(`bannerLayout`). The HUD layout editor moves it like any HUD piece (`src/ui/hud/hudLayout.js`, "Loot banners").
Reduced motion drops the slide, sweep and glow.

**Titles and auras** are not pack items, so the grant's own door calls `announceHonour`: the Hour's claims
(`src/net/superDungeon/sdClaims.js`), the Old Coil's (`src/net/serpent/serpentClaims.js`), the lamp keeper
(`src/systems/lampKeeper.js`) and a questline's title (`src/scenes/quest/questBridge.js`). The entry (`honourEntry`)
reads "New Title" or "New Aura" and "Wear it from your account card", ranks as the top tier, and wears the title's own
color (`honourVars`). The chat line for the grant stays on every skin.

**The pickup feed and the codex.** The pickup feed (`src/ui/pickupFeed.js`) does not card a piece the banner will
announce. A first Legendary find for the codex is said by the banner, as a "New to your codex" chip, through
`presentCodexFind`; on the classic skin the codex says its own line (`src/systems/loot/lootCodex.js`).

## Rules

- Rare and up get the banner; Common and Magic keep the pickup feed (Mac).
- Every way a piece becomes the player's counts: loot, spoils, quest rewards, crafts, the Sigil Broker, shops, trades,
  the market, cards (Mac).
- The banner stands at the right edge by the notices (Mac).
- The top tiers stand out with a bigger banner and a sound (Mac).
- A title or aura grant gets a loot popup (Mac).
- On the classic skin nothing is built; the watcher still marks.

## Code and tests

- `src/systems/acquireWatch.js` - the watcher, the mark and the tier gate
- `src/ui/lootBanner.js` - the queue, layout, face and honour entries
- `test/systems/lootbanner.test.js` - watcher, cards, baselines, wire, queue, face, codex and honour doors
- `test/server/lampkeeper2.test.js` - the lamp's door
- `test/systems/pickupfeed.test.js` - the pickup feed's hand-off
- `tools/lootBannerProbe.mjs` - the banners over the real HUD in Chromium at three screen sizes

## Open

- Pieces already in a house chest or other storage before the mark existed announce once, the first time they are
  taken out.
- A card stack taken from storage onto the same card in the pack reads as a risen count and is announced.
- A piece put into an online room's chest comes back through the wire without its mark and is announced when taken out.
