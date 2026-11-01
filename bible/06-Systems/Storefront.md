# Storefront

The in-game shop: cosmetic wares bought with Aurum (`06-Systems/Aurum.md`) - kill effects, portal skins, mount looks,
name visuals (titles and glyphs), profile icons, auras, the Aura Armory's Eternal set and bundles - with a rotating
carousel of featured wares. Money buys only Aurum packs. The player opens it from the pause screen's gem; wares are
worn from the profile's slots. The season pass (the Folios) is the shop's first section and has its own page
(`06-Systems/Battle-Pass.md`). DFU has no accounts, shop or cosmetic effects.

## How it works

**The catalogue** (`src/net/shopLaw.js` `SHOP_WARES`). Sections in order: Folios, Daily Deals, Kill Effects, Portal
Skins, Mounts, Name Visuals, Profile Icons, Auras, Aura Armory, Bundles, Aurum. Each ware has a tier (Standard, Premium,
Exclusive) shown on its panel; the pre-alpha wares keep a Pre-alpha mark. Prices in Aurum:

| Ware | Standard | Premium | Exclusive |
| --- | --- | --- | --- |
| Kill effect | Ashen Shatter 500 | Voidrend 1,000 | Daedric Pyre 1,500 |
| Portal skin | Runic Stone 800 | Daedric Stone 1,300 | Aetheric Stone 2,000 |
| Mount look | Spectral Steed 1,000 | Dawnfire Charger 1,500 | Daedric Warhorse 2,500 |
| Title | Dawnbringer 400 | Voidwalker 700 | Eternal Champion 1,000 |

| Bundle | Price | Gives |
| --- | --- | --- |
| Daedric Champion | 2,800 | Daedric Dominion aura, Daedric Pyre, Eternal Champion, Oblivion Sigil |
| Portal Master | 2,000 | Daedric Stone, Daedric Dominion aura, Gate Sigil |
| Lord of Oblivion | 3,000 | Daedric Warhorse, Daedric Stone, Daedric Dominion aura, Daedric Pyre |

The Daedric Dominion aura, the Oblivion Sigil and the Gate Sigil are sold only inside a bundle (`alone: false`).

**Held wares.** The first nine wares are bits on `players.shop_wares`; every later one is held by id in
`players.shop_held` (`shopHeldIds` reads both). A bundle or the Eternal Set holds everything it gives. A ware is not
sold again once it, or everything it gives, is held. A giver costs its price times the share of its worth not yet held,
never under 50 Aurum.

**Payments taken back.** An order made for money keeps its credit (`shopCreditOf`). A refund or dispute takes off what
that order alone covered, marking it `-<id>` in `shop_held` (`shopLostOf`). A Stripe page left open at a price that
moved, or for a ware now held, is refunded in full by the service (`server-account/src/shop.js` `refundPost`); the
order stays `refund_owed` until Stripe takes it. An Admin gives back a ware bought with Aurum from the staff panel (`06-Systems/Aurum.md`).

**Featured and limited.** `SHOP_ON_SALE` (`server-account/wrangler.toml`) names what sells. `SHOP_FEATURED` names what
the carousel shows and when: `<ware> <from> <to>` in UTC, with `limited` for a ware sold only inside its window. A
window only features; only `limited` holds a sale back (`shopSellable`), and the deploy marks none limited. A limited
ware before its first window is not on the card (`shopDropped`). Dates read strictly; a line that does not read whole
shuts that ware's sale.

**Kill effects** (`src/render/killFx.js`). Where a foe the player's own blow killed falls, the body burns away in the
effect's colour while the effect bursts; the corpse and loot stay. Each host's magic engine (`src/scenes/hostMagic.js`)
steps and draws it. Each look has its own sound.

**Portal skins** (`src/scenes/portalFx.js`, art `src/scenes/portalSkins.js`). Every portal of the player's: companions'
arrivals and leavings, a spared revenant's rise, the Portal Stone's gate and an Elite Breach call. A peer's portals
wear the peer's skin, from its token.

**Mount looks.** Laid over the horse the player rides - the riding view, Eye of the Beholder's riders, the 3D horse and
the standing horse - as a fifth part of the horse's look, dyed like a coat (`src/systems/horse/horseCoats.js`). Each
look is painted by the horse's own shading (`src/systems/horse/mountPaint.js`). Eye of the Beholder's riders are masked
so only the horse is dyed. The coat stays the player's choice and returns when the look is removed. A look rides no
wire of its own: each screen lays a rider's look from its token (`src/systems/horse/mountLook.js`); its ambient bursts
use the kill effects' engine (`src/systems/horse/mountFx.js`).

**Name visuals.** Three titles on animated plates (`src/ui/titleFlame.js`), and the bundle glyphs.

**The window** (`src/ui/enhanced/enhancedShop.js`). The proceeds' disclaimer, then the carousel: a featured ware large
and live, turning every `CAROUSEL_TURN_MS` (8 s), never while pointed at, focused, paused, out of sight or under reduced
motion. Then each section's panels with live stages: the player's own figure wearing the ware
(`src/render/effectStage.js`, `src/ui/mountPreview.js`), or a bundle's pieces as emblems (`src/ui/wareArt.js`). A panel
shows tier, featured window and the price this account pays, with the list price struck where it is less. Every surface
carries its Enhanced Plus kit role, so themes and the Grimoire dress it. The account is read again at every open
(`shopReread`), and only the card's wares are listed (`shopListed`); with no card the Folios stand alone.

**The profile** has Kill effect, Portals and Mount slots. A ware not held can be tried on; one held is worn.

**Others' effects** (Features: all, near, none) chooses whose kill effects and mount looks are drawn
(`src/net/peer/peerEffects.js` `othersEffectShown`).

## Rules

- Nothing costs more than $30 (the owner): `SHOP_PRICE_CAP`, and `SHOP_AURUM_CAP` at `SHOP_AURUM_PER_DOLLAR` (100).
- Nothing costs money but Aurum packs (the owner).
- Every item is cosmetic and gives no power in the game; renown is power, so nothing sells it.
- Portal skins apply to both companion and Portal Stone portals; kill effects are worn from the profile (the owner).
- A setting hides the shop, off by default (the owner): `port:shopHidden` in `src/systems/uiPrefs.js`. On, the pause
  screen draws no gem. Aurum, items and the Folios are untouched.
- Admins hold every shop item, always (the owner): `server-account/src/titles.js` `holdsAll`. Nothing held is sold to
  an Admin; Aurum packs still sell.
- Every ware is timed by the owner through `SHOP_FEATURED`; open all: a window never holds a sale back (the owner).
- Online, the token carries `fx`, the effects kit: kill, portal and mount, `0` for none (`src/net/effectLaw.js`), so
  nobody can show an effect they do not own. The pose carries the kill count, place and body height (`xk`, `xp`, `xh`).
  A kill is told within `KFX_FAR_M` (45 m) and a peer's plays only within `KILL_FX_PEER_M` of its drawn feet.
- Reduced motion dims the flashes and stops the try-on loop.

## Code and tests

- `src/net/shopLaw.js` - wares, prices, holding, sale and featuring
- `server-account/src/shop.js` - checkout, grants, refunds
- `server-account/src/staffAurum.js` - an Aurum buy given back by an Admin (`test/server/staff_aurum_refund.test.js`)
- `src/ui/enhanced/enhancedShop.js` - the window and carousel
- `src/render/killFx.js`, `src/scenes/portalFx.js`, `src/scenes/portalSkins.js` - effects and skins
- `src/systems/horse/mountPaint.js`, `src/systems/horse/mountLook.js`, `src/systems/horse/mountFx.js` - mount looks
- `src/net/effectLaw.js`, `src/net/peer/peerEffects.js`, `src/net/peer/peerFx.js` - the effects on the wire
- `test/server/shop_service.test.js` - every ware under the cap; checkout and holding
- `test/server/storefront_service.test.js` - featured windows, open all, the demand
- `test/net/storefront_wireaudit.test.js` - kills and kits on the wire
- `test/render/killfx.test.js`, `test/scenes/portalskins.test.js`, `test/ui/storefront_badges.test.js` - rendering
- `test/ui/shop_hide.test.js`, `test/ui/shop_untold.test.js` - hiding, re-reading, only the card's wares
- `test/server/admin_all_storefront.test.js` - Admins hold it all

## Open

- Not built: housing furniture, textures, themes and decorations (they need new art and an entitlement the decor
  service does not check, and a home's look is free by design); Name Change (an open question for the owner); consumable
  bundles (every consumable is power).
- The relay floor: a relay older than the one that reads the current tokens' glyph and effect claims refuses some
  tokens; roll the account service back first and wait for its tokens to lapse.
