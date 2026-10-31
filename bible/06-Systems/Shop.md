# Shop

The pause screen's shop: a violet gem at the end of the pause screen's row of marks opens a window of cosmetic wares
for the account. Every ware is bought with Aurum; money buys only Aurum packs, through Stripe. This page covers the
shop's window, its first nine pre-alpha wares and how a payment lands. The full catalogue (tiers, bundles, the
featured carousel) is on `06-Systems/Storefront.md`, and Aurum on `06-Systems/Aurum.md`. Daggerfall Unity has no
accounts and no shop.

## How it works

**The window** (`src/ui/enhanced/enhancedShop.js`). Top to bottom: the title; the disclaimer, before any ware, in a
gold frame ("All proceeds go to the costs of developing DFO Online." and "Every item is cosmetic. It gives no power in
the game."); a tab a category; a panel a ware; the account's line; and the foot (Stripe takes payment, no card details
reach the game, the Terms of Service). A panel shows the ware live: a title on its plate over the player's name, a glyph
moving, an aura on a stand-in figure drawn by the game's own aura pass (`src/render/auraPreview.js`). The press is Buy,
Owned with Wear or Take off, or why not (sign in, needs a username, not on sale, no longer sold).

**The pre-alpha nine** (`src/net/shopLaw.js` `SHOP_WARES`), each with a fixed bit on `players.shop_wares`:

| Ware | Kind | Aurum | Look |
|---|---|---|---|
| Genesis | title | 500 | the name on a plate of blue-violet fire (`src/ui/titleFlame.js`) |
| Origin | glyph | 200 | an ouroboros dragon biting its tail, a spark at its heart |
| Eternal | aura | 2,000 | a cape of blue-violet fire flowing on the back (`src/render/auraRing.js`) |
| The Eternal Set | armory | 2,000 | all five Eternal pieces below |
| Eternal halo, sigil, armlets, greaves, edge | armory | 600 each | the Aura Armory's Eternal line (`04-Characters/Aura-Armory.md`) |

A ware's bit is never renumbered: a stored bit is a sale that happened. What is on sale is the service's config,
`SHOP_ON_SALE` in `server-account/wrangler.toml`; taking an id off ends its sale, and buyers keep it.

**Buying an Aurum pack** (`server-account/src/shop.js`). The account read carries a Buy link with a sealed ticket for
that account and ware. The link opens the service's own confirm page, which names the game account before anything is
paid. Its button writes an order (`shop_orders`) and asks Stripe for a Checkout Session priced by the service, the order
its idempotency key. Stripe's signed webhook (`/v1/shop/webhook`) grants: a paid checkout moves its order from open to
paid and writes the receipt to the mailbox, in one guarded batch, so a webhook told twice grants once. The amount must
be the order's. A full refund or a dispute takes the grant back with a letter; a dispute won gives it back.

**Ways to pay.** Each checkout asks for Stripe's Adaptive Pricing, so the buyer sees their own currency. The deploy turns
on the methods in `SHOP_PAY_METHODS` (iDEAL, Wero, Bancontact, EPS, BLIK, Przelewy24, PayPal, Revolut Pay) with
`tools/stripeMethods.mjs`; cards are taken either way. SEPA Debit and Klarna are left out.

**Switching it on.** The shop takes payments only while the account Worker holds `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`; without them the window shows "Not on sale yet".

## Rules

- **A shop panel beside the timer and mailbox, organised in categories, with a strict disclaimer that all proceeds go
  to development** (the owner).
- **Nothing costs real money but Aurum itself** (the owner): every ware is priced in Aurum at $1 = 100 Aurum
  (`SHOP_AURUM_PER_DOLLAR`).
- **The most expensive anything is $30** (the owner): `SHOP_PRICE_CAP`, and its Aurum equal.
- **The Eternal Set at $20 worth, each piece at $6 worth** (the owner).
- **The buyer's own currency and local ways to pay** (the owner).
- **Every ware is cosmetic**; what is held is read off the account's row at every ask, never the client's word.
- An order paid in money before Aurum-only is still granted, refunded and taken back as above.

## Code and tests

- `src/net/shopLaw.js` - the wares, prices, categories, caps
- `server-account/src/shop.js` - the confirm page, checkout, webhook, grants and refunds
- `src/ui/enhanced/enhancedShop.js` - the window
- `src/ui/titleFlame.js`, `src/render/auraPreview.js`, `src/render/auraRing.js` - the faces
- `test/server/shop_service.test.js`, `test/ui/shop_window.test.js`, `test/server/shoplocal.test.js`
- `tools/pauseShopProbe.mjs` - the window in a browser

## Open

- The Terms of Service and Privacy Policy do not name the shop; their words are the owner's.
- Stripe Tax, a refund policy and emailed receipts are the owner's Stripe settings.
- iDEAL's scheme asks a seller outside the Netherlands to show its business registration on its site.
- The shop's words are English in every language until the translation pipeline drafts them.
