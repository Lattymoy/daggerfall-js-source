# Shop - the pause screen's shop, its pre-alpha wares and how a purchase lands (SHOP)

> Design page and record (2026-10-28). Where the page and the code disagree, the code's own headers
> (`src/net/shopLaw.js`, `server-account/src/shop.js`, `src/ui/enhanced/enhancedShop.js`) and the pins are what runs.
> Not a DFU member: Daggerfall Unity has no accounts and no shop, so nothing here departs from it (Port-Ledger section
> A, SHOP).
> STOREFRONT (2026-10-29) rebuilt the catalogue, the window and the purchase path on this one - tiers, wares held by
> id, bundles priced against what is held, the featured carousel: `06-Systems/Storefront.md`. This page stays SHOP's record.
> AURUM-ONLY (2026-10-30, the owner: "nothing should cost money money anymore"): every ware, the pre-alpha nine with them,
> is bought with Aurum at $1 = 100 Aurum, and money buys the Aurum packs alone (`06-Systems/Aurum.md` sections 4 and 5).
> An order paid before the switch is still granted, refunded and taken back as this page says.

## 1. What was asked

The owner, 2026-10-28:

> *"A new glyph panel alongside the timer and mailbox that will be used for our monetization shop. This needs to be
> detailed and panel based when open showing the purchasable items organized in categories with a strict disclaimer
> that all.proceeds go towards development costs. The first items we will be adding are titles, glyphs, and auras. When
> purchased are granted to the player and their mailbox."*

The three wares: **Genesis**, a title, pre-alpha only and "sold until I dictate to remove it", on "a blueish purple
animated flame effect that acts as the background", $5; **Origin**, a glyph, pre-alpha only, "an extremely detailed
animated dragon", $2; **Eternal**, an aura, pre-alpha only, "an extremely detailed flaming cape aura that attachs and
flows on the back of your character", $20.

## 2. The window

A violet gem stands at the end of the pause screen's row of marks - the hourglass, the envelope and the laurel - and
beside the profile mark where those are not drawn (offline): the account is the shop's, not the relay's. It opens a
window on the hourglass's own stage (`enhancedShop.js` shopWindow; `enhancedMenu.js` shopGem).

Top to bottom: the title and its Pre-alpha mark; **the disclaimer**, first and before any ware, in a gold frame - "All
proceeds go to the costs of developing DFO Online." and "Every item is cosmetic. It gives no power in the game."; a tab a
category (Titles, Glyphs, Auras, each with its count; the arrow keys step between them); a panel a ware; the account's line; and the foot - Stripe takes the
payment (prices in US dollars, which Stripe can show in the buyer's own currency - SHOP-LOCAL), no card details reach
the game, and the Terms of Service.

A panel is the ware seen live beside its words: Genesis on its fire at full size and over the player's own name;
the Origin at 140 pixels, moving, and beside the name at a name's size; Eternal on a stand-in figure on its own small
stage (`src/render/auraPreview.js`), drawn by the game's own aura pass, the camera swaying round behind it while the
figure strolls, turns and stops so the cape swings as it does in the world. Then its name and kind, a sentence of what
it looks like, its tags (Pre-alpha only, every character on the account), its price and its press.

The press follows the account read (`ui/accountFlow.js` `shop`, `shopWareState`): **Buy**, a plain link to the service's
own page in a new tab or the system browser (Patreon's way: a window opened after an await is a popup a phone blocks);
**Owned** with Wear or Take off (Show or Hide for the glyph), the flow's own presses; or why not - Sign in to buy, Needs
a username, Not on sale yet, No longer sold. After Buy the line says "Finish paying in your browser, then come back
here."; when the window has the focus again the account is read, and a ware that landed says "Genesis is on your
account. A receipt is in your mailbox."

The aura's stage and its module load when an aura's panel is first shown, so the renderer's shaders stay out of the
menu's own load; every stage is let go (its WebGL context lost on purpose) when its panel goes.

## 3. The wares (`src/net/shopLaw.js` SHOP_WARES)

| Ware | Kind | Price | Bit | Look |
| --- | --- | --- | --- | --- |
| `title:genesis` | title | $5.00 | 1 | "Genesis" in the flame's pale violet heart on a plate of blue-violet fire |
| `glyph:origin` | glyph | $2.00 | 2 | an ouroboros dragon biting its tail, a spark at its heart |
| `aura:eternal` | aura | $20.00 | 4 | a cape of blue-violet fire on the back, flowing, wisps trailing |
| `armory:eternalset` | armory | $20.00 | 256 | The Eternal Set: all five pieces below, worn at one press |
| `armory:eternalhalo` | armory | $6.00 | 8 | a band of blue-violet fire over the head, runes round it, the Origin's spark at its front |
| `armory:eternalsigil` | armory | $6.00 | 16 | the Origin's ouroboros, a dragon of light in scales, on the chest and the back |
| `armory:eternalarmlets` | armory | $6.00 | 32 | engraved bands of blue-violet fire round the upper arms and the wrists |
| `armory:eternalgreaves` | armory | $6.00 | 64 | blue-violet fire round the legs from the knee to the foot, under a lattice of light |
| `armory:eternaledge` | armory | $6.00 | 128 | a blue-violet line along every weapon in hand, a light running along it |

**ARMORY** (2026-10-28, `04-Characters/Aura-Armory.md`): the Aura Armory's Eternal line, in a section of its own (Aura
Armory, last). The owner: *"The store set should be $20"* - the set whole, and each piece at $6. The set's bit gives
all five (`shopKeysOf`), and a ware had through either way is not sold again (`shopOwns`). Its stage shows the piece or
the set on the stand-in figure (`render/auraPreview.js`, the kit option); a weapon piece on its own weapon stage. The
Dagonfire line is the Sigil Broker's, for embers, never sold for money.

Each is pre-alpha only. **What is on sale is the service's config**, `SHOP_ON_SALE` in `server-account/wrangler.toml`:
the owner ends a sale by taking an id off it, and those who bought it keep it. A ware's bit on the row is never
renumbered - a stored bit is a sale that happened.

## 4. How a purchase lands (`server-account/src/shop.js`)

The account read carries the shop's card: each ware on sale, held or not, and for a registered account a **Buy link**
to `/v1/shop/buy` with a ticket sealed for that account and ware (AES-GCM under a key HKDF derives from the Stripe
secret, an hour - `sealed.js`, lifted out of Patreon's link so both doors share one copy).

`/v1/shop/buy` writes nothing. It shows the ware, its price, the game account it is for, the pre-alpha and cosmetic
lines and the proceeds' disclaimer, and one button. Naming the account is Patreon's law: a link someone else sent is
read before anything is paid. The button posts the ticket to `/v1/shop/checkout`, which checks again (on sale, not held,
registered), writes an **order** (`shop_orders`, migration 0189) and asks Stripe for a Checkout Session priced by the
service - never by the client - with the order on its metadata and the payment's, the account and the disclaimer on
the line the buyer reads, the order as its idempotency key; then it sends the browser on (303). A second press while
that page is open goes back to it.

**Stripe's signed word grants**, at `/v1/shop/webhook` (HMAC-SHA256 over `t.body`, five minutes' tolerance). A paid
checkout moves its order from open to paid, sets the ware's bit on `players.shop_wares`, and writes the receipt into the
server's post - one batch, guarded on the order moving, so a webhook told twice grants once. The amount and currency
must be the order's. A delayed payment method waits for its own event. A full refund or a dispute takes the bit off
(unless another paid order holds the ware) with a letter saying so; a part refund keeps it; a dispute won gives it back.
Since STOREFRONT the grant is guarded on the row as read too, and a payment taken back takes what it alone covered, a
giver's credited wares with it (`Storefront.md` sections 3 and 3.2).

The amount checked is Stripe's subtotal, the price before any tax Stripe adds. A paid amount that is not the order's
grants nothing and is logged: the money is taken, so it is the owner's to refund or grant. A grant the database failed
to write throws, so the service answers 5xx and Stripe sends the word again; only the guard tripping by another word on
the same order counts as done. Each turn is its own letter - the receipt, a dispute, a refund, the ware back - and only
the receipt and the return carry the ware. An inquiry (a dispute with no chargeback) takes the ware off as a dispute
does, and gives it back when it closes. The page Stripe sends the buyer back to tells the order as it stands.

What is held is still **read off the row at every ask** (ACC3's law): `titles.js` titlesHeld, aurasHeld and glyphsOf
read the bits through `shopKeys`, a registered account's alone. A ware held reaches the token at its next mint, and the
room at its next hello, as every grant does.

The receipt is a letter in the mailbox ("Thank you: Genesis", what was bought, where it is worn, the price paid and the
day, the order, the disclaimer). Its `ware` column (0189) names the ware, so the mailbox draws it in its own paint - the
title on its fire, the glyph's dragon, the aura's word - with "On your account": there is nothing to claim.

## 5. Switching it on

The shop takes payments only while the Worker holds both secrets (`shopOn`); without them the window shows the wares
with "Not on sale yet" and the doors answer `shop-closed`. The owner's steps, once:

1. A Stripe account, and its secret API key as the repository secret `STRIPE_SECRET_KEY`.
2. A webhook endpoint at `<service>/v1/shop/webhook` (the deploy's summary prints the address) sending
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`; its signing
   secret as `STRIPE_WEBHOOK_SECRET`.
3. Deploy the relay first (`world276`: the vocabulary's three words), then the account service (`acct206`, migration
   0189). ARMORY's wares need the relay at `world278` and the account service at `acct209` (migration 0191), in that
   order. The account deploy puts both secrets on every run (`account-deploy.yml`, step 4d).

**SHOP-LOCAL** (2026-10-28, a player in the Discord's feature-feedback: "Allow for iDeal payment options (or better ones)
for MTX ... i either have to be; german - have iphone - have credit card"; the owner: "Do it"). The checkout lists no
payment method, so Stripe offers the account's, but it charged in dollars and iDEAL takes euros only. Now:

- **The buyer's own currency.** Each checkout asks for Stripe's Adaptive Pricing (`checkoutFields`:
  `adaptive_pricing[enabled]`), which shows the price in the buyer's currency and unlocks the methods that need it. The
  buyer pays Stripe's 2-4% conversion, or chooses dollars. The session and its events still read USD and the order's
  amount (Stripe's docs, "Event destinations and reporting"), so the webhook grants as before. A session Stripe refuses
  (400) with it is asked again without it, in dollars, under a key of its own (`stripeCheckout`). The confirm page says
  Stripe can show the price in the buyer's currency; so does the window's foot.
- **The ways to pay, set by the deploy.** `SHOP_PAY_METHODS` (iDEAL, Wero, Bancontact, EPS, BLIK, Przelewy24, PayPal,
  Revolut Pay) is turned on in the account's default payment method configuration by `tools/stripeMethods.mjs`, which
  the account deploy runs (`account-deploy.yml`, "Turn on the shop's ways to pay"). One ask a method, only where off; the
  summary says which Stripe has active, refused or does not offer the account. Never red: cards are taken either way.
- **Left out:** SEPA Debit (it confirms days later and can be pulled back for weeks) and Klarna (credit, for a $2 glyph).
- **The list is the law, as Discord's commands are.** A listed method the Dashboard turns off is turned on again by the
  next deploy, and its line says "turned on by this deploy". To drop one, take it off the list, then turn it off in the
  Dashboard. The configuration is the Stripe account's default, so a Payment Link on the account offers the same.
- **The owner's:** iDEAL's scheme asks a seller outside the Netherlands to show its business registration number on its
  site.

Pins: `test/server/shoplocal.test.js`. Mutants: `tools/mutants/shoplocal.json`.

**AUDIT SHOP-LOCAL** (2026-10-28, the owner: "You need to audit this"; an independent read of the merged change):

1. The step went red on its first deploy and every later step was skipped. The job's shell is `bash -e`, so a bare
   `out=$(...)` that failed ended the step with its reason unsaid. The exit is now read in an `if`, as Discord's step
   reads it. The pin runs the step's own bash as GitHub does, with a stand-in `node`.
2. Stripe echoes a bad key masked to its last four ("sk_live_****1234"); `said` takes it out before the log.
3. A method the deploy turned on is said so (above).
4. A thrown fetch is one line ("Stripe could not be reached"), not a stack.
5. Checked and kept: the webhook's USD check (Stripe's docs), the 400 retry (a refused request saves no idempotent
   result), the Connect-child filter, the eight methods' confirmation, the 13 translations. Dutch and Polish stay
   drafting, offered only by a pack; Stripe's own page follows the browser's language.

## 6. The faces

- **Genesis** (`ui/titleFlame.js`): the fire is painted once off seeded, periodic noise into 24 frames of 128 by 48
  pixels (`flameSheetPixels`, pure; the page paints a frame an idle moment, `flameFramePixels`, so a name coming into
  view never stalls the game) - blue roots, violet tongues curling as they rise, embers, over a smoke of the fire's
  deep so the letters read on any sky - and every DOM face shows it as one CSS background stepped a frame at a time: no
  script a frame however many names burn, still where the player asks for less motion. The letters are the heart,
  `#d6b8ff`, 44 from the nearest title's colour. The plate is a class (`setTitleFlame`), so the account card - which may
  not style itself - wears it too. The classic bitmap face draws the letters in the fire's gradient.
- **Origin** (`playerBadge.js` GLYPH_PATH, GLYPH_DETAIL, GLYPH_MOTION): one outline round the ring, never crossing
  itself, in M, L, Q and Z; five details (the wing's panes, the belly's plates, the eye, the spark and its halo). It moves
  in the SVG itself - the light turning round its scales, the eye breathing, the spark swelling - and stands still for
  less motion. `Q` on the classic face: a ring with its tail.
- **Eternal** (`render/auraRing.js`, the pass's sixteenth look, kind 15): the Holo Shadow Cloak's cloth and pose seams
  (cloakPoint, auraCapeStep, auraMotionStep) cut to a cape behind the arms with no hood, a wave flowing down it, a flare
  at the hem and a swing larger than the cloak's; a dark mantle burning down into tongues of blue fire, flame veins, the
  Origin's ring and spark on the back; wisps and embers the third draw; a glow pool. No cloth from its wearer's own eye,
  none on a rider, burned away in beast form. The hosts already pose and swing any look with a `mesh`: none changed.
- **ETERNAL-FIT** (2026-10-28, the owner, with a shot of the cape over a Beholder sprite: "The new aura isnt properly
  positioned. It needs to follow the same law as the wing aura"). A sprite is a flat card through its feet, so a cape
  hung on the axis stood in front of the card and drew over the body from the side. The cape now takes WINGS-FIT's law:
  `eternalPoint` moves its cloth back along the facing by the pose's `wingBack` (`uWingBack`: WING_SPRITE_BACK on a
  sprite, 0 on a rig), and its wisps and embers fly from the moved cloth. From the front round to either side none of it
  lies over the body. From behind it covers the back, as a cape does.
- **CAPE-CARD** (2026-10-30, the owner, with a shot of the cape on a player's front: "Did we learn nothing from the
  angel wings aura?"; `01-Overview/bugs/Field-Bugs-2026-10-30.md`). A peer drawn as a paperdoll or a class sprite now
  says how its picture faces (`net/remotePlayers.js` faceOf), so the cape hangs on its back; both are cards, and the
  cape stands behind them as on a sprite. AUDIT CAPE-CARD (`01-Overview/audits/Audit-Cape-Card.md`): every peer's
  picture turns to the camera that draws it, and a doll's swing stays behind it. The straight cut (CAPE-FLAT) was
  reverted at the owner's word: the cape keeps the shape above.

## 7. Seen

`tools/pauseShopProbe.mjs` (Chromium, the dev server, the service answered by the probe): the gem just left of the laurel
and on the screen, the disclaimer above the wares, a tab a category, each price, Buy only signed in and as the service's
own link, the aura's stage drawing its fire, nothing wider than the screen, Buy's line, the payment landing as Owned with
Wear and its sentence, Escape back to the gem - at 1280 and on a 390 phone, signed in and out: 72 of 72.

## 8. Not done, and the owner's to decide

- The Terms of Service and the Privacy Policy already cover supporter recognition and payments through a provider
  (sections 7-8 and 5); neither names the shop. Their words are the owner's.
- Taxes (Stripe Tax), a refund policy and receipts by email are Stripe's settings and the owner's choice. A refund
  issued from Stripe's dashboard takes the ware back on its own.
- A ware cannot be bought as a gift for another account.
- The shop's new words are English in every language until the translation pipeline drafts them.
- The Collections page still draws an aura as a ring of its colours; `auraPreview.js` could show it in the round there.

Pins: `test/server/shop_service.test.js` (the law, the service end to end), `test/ui/shop_window.test.js` (the
window, the faces, the catalogue's entries, ETERNAL-FIT), `test/render/capecard.test.js` (CAPE-CARD),
`test/render/auditcapecard.test.js` (AUDIT CAPE-CARD). Mutants: `tools/mutants/shop.json`, `tools/mutants/eternalfit.json`,
`tools/mutants/capecard.json`, `tools/mutants/auditcapecard.json`.
