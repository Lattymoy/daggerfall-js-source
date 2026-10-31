# Storefront - the shop's second build, kill effects, portal skins, mount looks and bundles (STOREFRONT)

> Design page and record (2026-10-29). Where the page and the code disagree, the code's headers and the pins are what
> runs. Not a DFU member: Daggerfall Unity has no accounts, no shop and no cosmetic effects (Port-Ledger section A,
> STOREFRONT). The season and its pass have their own page: `06-Systems/Battle-Pass.md`.

## 1. What was asked

The owner, 2026-10-29, with a developer's monetization showcase (a price sheet, five bundles, a pass card and three
portal stones) and the developer's notes from the Discord:

> *"One of my developers gave me these shots and descriptions for something that I want to develop. Alongside this would
> be an overhaul to the ingame shop menu, a rotating panel carousel with limited featured items. I really want to develop
> this in bulk end to end and make it the best that it can be. Portal effects would influence both companion and portal
> stone portals and kill effects would be a brand new feature, both that will need to be added to the new character
> profile menu we integrated."*

The developer's notes: the pass themed per season with the world changed a little for it; demand controlled, every step
in the shop weighed before it ships and timed to its launch window; and sales tracked by day to see how demand changes.

## 2. What is built, and what is not

| The sheet's row | Here |
| --- | --- |
| Kill Effects ($9.99 / $19.99 / $29.99) | Built: Ashen Shatter, Voidrend, Daedric Pyre (section 4) |
| Name Visuals ($6.99 / $12.99 / $24.99) | Built: Dawnbringer, Voidwalker, Eternal Champion - titles on animated plates (section 6) |
| Portal Stone Skins ($14.99 / $29.99 / $49.99) | Built: Runic Stone, Daedric Stone, Aetheric Stone - every portal of mine (section 5) |
| Mounts ($19.99 / $34.99 / $59.99) | Built as mount looks on the horse I ride: Spectral Steed, Dawnfire Charger, Daedric Warhorse (section 7) |
| Battle Pass ($29.99 / $49.99) | Built, then reworked (PASS-PANELS) as the Folios: two folios of pages bought with Aurum, no money pass (`Battle-Pass.md`) |
| EXP Boosters ($4.99 / $12.99 / $24.99) | Built as Pass Boosters, then retired with the pass's levels (PASS-PANELS) |
| Bundles | Built: Daedric Champion, Portal Master, Lord of Oblivion (section 8) |
| Housing Furniture, Interior / Exterior Textures, Complete Housing Themes, Holiday Decorations, Noble Estate | Not built (section 11) |
| Name Change | Not built: the owner's open question (section 11) |
| Consumable Bundles | Not built: every consumable in the game is power (section 11) |

**Nothing over $30** (the owner, 2026-10-29: *"the most expensive anything should be is $30"*). The table quotes the
sheet's prices. Ours keep its three tiers and are about half of them. **AURUM-ONLY** (the owner, 2026-10-30: *"nothing
should cost money money anymore"*): every ware is bought with Aurum at $1 = 100 Aurum, to the whole dollar, and money
buys the Aurum packs alone (`06-Systems/Aurum.md` sections 4 and 5). So a kill effect is 500 to 1,500 Aurum, a portal
skin 800 to 2,000, a mount look 1,000 to 2,500, a name visual 400 to 1,000, a bundle 2,000 to 3,000, and an Aurum pack
$4.99 to $29.99. `test/server/shop_service.test.js` holds every ware to the cap, `SHOP_AURUM_CAP` and `SHOP_PRICE_CAP`.

**Cosmetic, always.** The shop's own line is "Every item is cosmetic. It gives no power in the game." and the Terms of
Service section 9 is "No pay-to-win rights". Renown is power (it raises health and magicka a level), so the sheet's EXP
Boosters were built as Pass Boosters, which sped the pass's track alone; PASS-PANELS retired them. THE CEILING HOLDS
(`Home.md`) is untouched.

## 3. The catalogue (`src/net/shopLaw.js`)

The window's sections, in order: the Folios (the pass), the Daily Deals (AURUM-ONLY: the day's five wares a quarter off,
while Aurum is open to the account - `06-Systems/Aurum.md`), Kill Effects, Portal Skins, Mounts, Name Visuals (titles and
glyphs), Profile Icons, Auras, Aura Armory, Bundles and Aurum (its four packs, the only thing sold for money). Every ware
and the Folios' pages are bought with Aurum (`Battle-Pass.md` section 3). A ware has a **tier** - Standard, Premium or Exclusive, the sheet's
three columns - shown as a mark on its panel; the pre-alpha wares keep their Pre-alpha mark instead.

**Held by id.** The first nine wares are bits on `players.shop_wares`; the bits stay, since a stored bit is a sale that
happened. Every later ware is held by its id in `players.shop_held`, space-separated in sale order (migration 0201): a
32-bit mask had room for 22 more. `shopHeldIds` reads both. The pass's items are not shop wares: they are held on
`players.pass_items`.

**A ware that gives others.** A bundle and the Eternal Set each give a list of wares. Holding one holds everything it
gives, read at every ask. A ware is not sold again once it, or everything it gives, is held. Its price for an account is
its price times the share of its worth not yet held, never under 50 Aurum: a Daedric Champion bought by someone who
holds the Daedric Pyre costs less by the Pyre's share. The Eternal Set follows the same law, a departure from ARMORY's
full price for a buyer who held pieces (`04-Characters/Aura-Armory.md`).

**What a payment covers** (AUDIT-STOREFRONT S1; since AURUM-ONLY, an order made before the switch). An order keeps its **credit** - what of its ware the account held at
checkout, which its price took off (`shopCreditOf`). It covers the rest (`orderCovers`). A payment taken back - a refund,
a dispute - takes off what it alone covered: its ware, and each ware a giver still held would give that no other paid
order covers. Those are marked `-<id>` in `shop_held` (`shopLostOf`), so the giver no longer gives them; a payment that
covers one again takes its mark off. So a Pyre bought, then a Champion bought for less, then the Pyre disputed, leaves
no Pyre.

**Bundle-only wares.** The Daedric Dominion aura and two glyphs (the Oblivion Sigil and the Gate Sigil) are sold only
inside a bundle. PASS-PANELS: the Brass Crown, the Seasonal Collector's, is a premium track item now. Each has a worth,
so a bundle's price can be weighed, and is never sold alone.

## 3.1 Featured, and limited

The owner times every ware. `SHOP_ON_SALE` (wrangler.toml) still names what is sold. `SHOP_FEATURED` names what the
carousel shows and when: an entry a line, `<ware> <from> <to>`, the days in UTC, and `limited` after it for a ware sold
ONLY inside that window. Nothing is featured outside its window, and nothing upcoming is told: a drop is news when it
lands.

A ware whose first window has not opened is not on the account's card at all, and Collections says it is not yet
available (AUDIT-STOREFRONT S2). The dates read strictly: 31 November is no date, never 1 December. A line that names a
ware but does not read whole shuts that ware's sale (S4), and a test reads every line of the deploy's own schedule.
PASS-PANELS retired the season's wares, and with them S6 and S10 (sold only while `PASS_OPEN` is on; stopped before the
season ends).

## 3.2 Payments the service returns

A press of Buy at a new price closes the account's older page for that ware at Stripe, and a grant closes each open page
it left wrong - a ware now held, a price that moved (AUDIT-STOREFRONT S3). A page paid anyway is refunded in full, by
the service itself, under the order's own key: a ware held by then (`held`), or a price that moved (`price`).
PASS-PANELS retired `spent` (S5, a booster a stronger one made worth nothing) and `late` (S10). The order says why
(`refund`) and stays `refund_owed` until Stripe takes it; Stripe's next word on the order asks again, and the demand
lists what is still owed.

## 3.3 The demand

`/v1/staff/econ/shop` (Admins, the staff panel's economy reads) answers each day's sales a ware: orders opened (a press
that reached Stripe), paid, refunded and disputed, and the money, over up to 90 days, with each day's featured windows
beside them, and the refunds the service still owes (`refundsOwed`). It is the developer's chart: how much sold on which
day, and how a launch window moved it.

## 4. Kill effects

A kill effect plays where a foe my own blow killed falls (`systems/playerKills.js` - every pool's word, a remote foe's
`slain` and a dungeon joiner's `v` among them). The standing body burns away in the effect's colour while the effect
bursts out of it; the corpse lies under it as before, its loot untouched. A Morrowind body plays its death and the
burst stands over it. The other players see mine: my pose carries a kill counter, the place and the body's height (`xk`,
`xp`, `xh`), and my token carries which effect (`fx`), so nobody can show one they do not own.

| Effect | Tier | What plays |
| --- | --- | --- |
| Ashen Shatter | Standard | the body crumbles to ash from the feet up, bone-white shards and flakes fall, a grey dust rolls out over the ground |
| Voidrend | Premium | a rift tears open in the chest, the body's shards are drawn into it on spirals, it snaps shut in a ring of violet light |
| Daedric Pyre | Exclusive | a Daedric sigil burns into the ground, a pillar of crimson fire takes the body, embers storm upward, a scorch sigil fades |
| Tonal Shatter | the pass | brass cogs and gear teeth burst out, steam jets, a blue tonal ring rolls out over the ground |

`render/killFx.js` holds the simulation (`KillFx`) and its pass (`KillFxPass`). Each host's magic engine
(`scenes/hostMagic.js`) owns one, so all four hosts step, shift, clear and draw it with the impact sparks. Each look rings
its own sound (`tools/storefrontSfx.mjs`, `public/sfx/fx-kill-*.wav`). "Others' effects" (Features: all, near, none)
chooses whose kill effects and mount looks are drawn (`net/peer/peerEffects.js` othersEffectShown). Where the browser asks
for less motion (`prefers-reduced-motion`), the flashes are dimmer.

## 5. Portal skins

A portal skin is every portal of mine: my companions' arrivals, leavings and catch-ups (COMPANION-PORTAL), my spared
revenant's rise, my Portal Stone's gate (PORTAL1) and an Elite Breach call's portal at my feet. A peer's wear the peer's
own, by its token (`net/peer/peerEffects.js`): its gate, and its spared revenant's rise. Drawn on the pools' own
billboards (`scenes/portalFx.js`, the skins' art `scenes/portalSkins.js`), so every host draws it as it drew the violet
one. A skin opens with its own burst and sound (`fx-portal-*.wav`), and the Daedric, Aetheric and Brass skins breathe
embers, motes and steam while they stand.

| Skin | Tier | The sheet's words | What stands |
| --- | --- | --- | --- |
| Runic Stone | Standard | new stone textures, colours and rune patterns | an ice-blue vortex inside a ring of carved runes that glow as it turns |
| Daedric Stone | Premium | custom geometry, animated runes, particles and activation effects | a jagged arch of black iron thrusts up round a crimson vortex, its runes crawl, embers rise, it opens in a burst |
| Aetheric Stone | Exclusive | floating stones, transformations, unique sounds, opening animations | crystal shards rise off the ground, gather into a turning ring and open it with their own chime |
| Brass Gate | the pass | | a ring of brass cogs turns about a blue aetherium core, steam vents at its foot |

## 6. Name visuals

Three titles on animated plates, each its own painter (`ui/titleFlame.js` grew a plate per style): **Dawnbringer** (gold
rays rising behind the word), **Voidwalker** (a violet void with stars drawn into it), **Eternal Champion** (crimson
fire under a gold edge). The bundle glyphs: the Oblivion Sigil, the Gate Sigil and the Brass Crown.

## 7. Mount looks

A mount look is the account's and is laid over the horse I ride: the riding view, Eye of the Beholder's riders, the 3D
horse and my standing horse. It is a fifth part of the horse's look, dyed as a coat is dyed (`systems/horse/horseCoats.js`,
COATS1). The coat stays the player's free choice on the Stable card and comes back when the look is taken off.

A look also dyes the horse's points: the near-black of its mane, tail and far legs, joined to the hide, and the grey
shine among them (AUDIT-STOREFRONT, `horseCoats.js:"function pointsOf("`). A rider's bow rising off the neck is not a
point, and a line hanging in the air is not one. The saddle is never one. A bridle drawn in the same black is one: across
the hide it is drawn as the shading is, and a rule that kept it blacked the small sprites' shading. The 3D horse's mane
and tail are their own picture, shaded the same a few rows a frame (`world/horseRig.js` HAIR_ROWS).

Each look is painted by the horse's own shape (`systems/horse/mountPaint.js`; the owner: "the horse designs are awful"):
a ramp of its own colours laid by the art's light, so the art's shading stays its shading, and its marks where the horse
has them - its rim, its legs, a strand's way out from the hide. The first looks laid flat patterns in the picture's box,
a grid of holes, rows of scales and stripes, over head and legs alike. A picture's view (the five every horse sprite is
drawn in) says which way it faces and whether its chest is seen. The 3D horse's chest is read off its texel map.

Eye of the Beholder's riders are spared (`player/eyeOfTheBeholder/eotbRiderMasks.js`, baked by
`tools/bakeEotbRiders.mjs`). The five mounted sets are one horse under five riders, so a pixel the other four disagree
on is its rider's. The dye took a rider's skin for hide and its hair for points, in every view; a rule read off one
picture flickered from frame to frame. A few horse pixels that every other set's rider covers keep the coat's colour.

| Look | Tier | What it is |
| --- | --- | --- |
| Spectral Steed | Standard | a pale blue ghost lit from within, mist through it, its rim glowing, its legs dissolving toward the hooves; a mane and tail of glowing wisps |
| Dawnfire Charger | Premium | radiant gold, a sheen along its back, its legs burning white from the hooves; a mane and tail of fire |
| Daedric Warhorse | Exclusive | obsidian, lit red from below by its own fire, embers on its hide, its hooves burning; a mane and tail of fire |
| Brass Automaton | the premium track | polished brass in riveted plates, its joints ringed, an aetherium heart at its chest; a steel mane |

The look rides no wire of its own: the horse's code on the wire is the item's four parts (`wireHorseLook`), and each
screen lays a rider's look on from its token (`systems/horse/mountLook.js`). The beat - hoofprints, a mane, steam - is the
kill effects' engine's, as ambient bursts that never take a kill's place (`systems/horse/mountFx.js`). A peer's look, its
dye and its beat, is drawn by the viewer's "Others' effects" choice, as its kill effects are (section 4).

## 8. Bundles

| Bundle | Price | Gives | Worth alone |
| --- | --- | --- | --- |
| Daedric Champion | 2,800 Aurum | the Daedric Dominion aura, the Daedric Pyre, Eternal Champion, the Oblivion Sigil | 4,300 Aurum |
| Portal Master | 2,000 Aurum | the Daedric Stone, the Daedric Dominion aura, the Gate Sigil | 3,100 Aurum |
| Lord of Oblivion | 3,000 Aurum | the Daedric Warhorse, the Daedric Stone, the Daedric Dominion aura, the Daedric Pyre | 6,800 Aurum |

Each costs well under its worth (section 2's cap, AUDIT-STOREFRONT II). The sheet's Seasonal Collector was built and
then retired with the money passes (PASS-PANELS); its Brass Crown is on the premium track. The sheet's Lord of Oblivion
priced a Standard mount; its mount is the Exclusive Daedric Warhorse, and the cap holds it at 3,000 Aurum.

## 9. The window

The shop's window (`ui/enhanced/enhancedShop.js`): the title, the proceeds' disclaimer first, then **the carousel** - a
panel a featured ware, large, live, with how long it stays featured and whether it is limited. It turns every eight
seconds (`carouselTurns`), never while pointed at, focused, paused (its Pause button), scrolled out of sight or for
less motion, when its Pause is not shown. Its arrows, its dots, the arrow keys and a swipe step it; a slide slides in on
a turn, never on opening. Only the panel shown runs its stage. Then each section's panels, the account's line and the
foot.

**On the Enhanced Plus kit** (AUDIT-STOREFRONT II, lane E). Every surface carries its kit role
(`ui/enhanced/enhancedFrame.js` FRAME_ROLES): the panels, the disclaimer, the presses, Buy, the tabs, the chips, the
stages and meters, the head and the foot. So each theme and the Grimoire dress the shop as they dress the pause window,
and the shop's own sheet never paints a role - a border there is its width and style alone. The head, the disclaimer and
the tabs stand; the carousel and the section scroll under them, and a tab pressed brings its panels into sight. A live
stage starts once it is in sight. A short screen tightens the standing part; from 1440 pixels wide the wares stand two
to a row. A title's paint on a page is inked under the Grimoire (`grimoireDress.js` inkPaintedWord).

A panel's stage is live: a title on its plate, a glyph, an aura or a piece worn, a kill effect or a portal skin played on
the character's stage (`render/effectStage.js`), a horse in its mount look (`ui/mountPreview.js`). The figure is the
player's own - the profile's body (`ui/profileBody.js`, asked once a window), the stand-in only with no character
(AUDIT-STOREFRONT). A bundle's stage lays out its pieces, each in its picture (`ui/wareArt.js`, one door for every picture shown without playing: an effect's emblem, `ui/effectEmblems.js`; a
glyph, an aura or a title in its medallion). The profile's effect choices and the pass's track show the same pictures.

An emblem and a medallion are drawn by the profile icons' engine (`profileIcons.js` drawnIconNode): a metal bezel, a
shaded field and modelled relief, with motion that stops for less motion (`ui/icons/effectEmblemArt.js`). The four
horses share one head, shaded and kept inside the rim, each with its own armour, mane and light.

A panel says its tier, its featured window and the price this account pays, the list price struck through beside it
where it is less. A bundle's panel lists what it gives, each held one marked, and its worth. A featured window's tag and days left are told only beside its
sale, and counted again at UTC midnight. An effect's
sound is heard when the player points at its stage or chooses its slide, never on every loop.

**The profile** (`ui/characterSlots.js`, PROFILE-SLOTS) has three more slots under its stage: Kill effect, Portals and
Mount. A kill effect pointed at plays on the character, which burns away in its colour and comes back; a portal skin
opens behind the character (none worn: the violet vortex); a mount look stands on its horse over the choices. One not
held is tried on and told how it is had (AUDIT-STOREFRONT II, lane E 8: `wardrobeCatalogue.js` EFFECT_WARDROBE, read off
the wares and the season's law); one held is worn through the flow's own door. On a narrow card the stage stands first
and the picker right under it (lane E 7), so a choice pointed at is tried on in sight.

**Hide the shop** (SHOP-HIDE, 2026-10-30, the owner: "a settings toggle that disables the shop interface ingame. Off by
default"). The Interface tab's Shop section holds it (`port:shopHidden`, `src/systems/uiPrefs.js`), off as the game ships.
On, the pause screen draws no gem (`enhancedMenu.js` shopGem), so the window has no door. It is the device's choice: the
account's Aurum, its items and the Folios are untouched, and a coffer or a gift still pays. `test/ui/shop_hide.test.js`;
`tools/mutants/shop_hide.json`.

**Read again at every open** (SHOP-REREAD, 2026-10-31). A pause visit reads the account once, at the shop's first open.
At the launch the game's new build went out 13 minutes before the account service, and a player who opened the shop in
that gap was shown the older service's card - no Aurum, no Folios ("The Folios are not open yet"). Every press of the
gem now reads the account again, as the window's focus does (`enhancedShop.js` shopReread), so a card from a deploy's
gap mends at the next open. `test/ui/shop_hide.test.js`; `tools/mutants/shop_hide.json`.

**Only the card's wares** (SHOP-UNTOLD, 2026-10-31, a player's report: portal skins, mounts and bundles "vanish after a
second of opening up the shop"). With no card read - the account still reading, the service out of reach, or no one
signed in - the window listed every ware, drops not out yet among them, then took them away when the card landed. The
client cannot see `SHOP_FEATURED`, so it lists only the card's wares (`enhancedShop.js` shopListed). With no card the
Folios stand alone, and a signed-in window says the shop could not be read. `test/ui/shop_untold.test.js`;
`tools/mutants/shop_untold.json`.

## 10. Online

The token's new claim is `fx`, the effects kit: three characters, the kill effect, the portal skin and the mount look,
`0` for none, omitted when none is worn (`net/effectLaw.js`). The relay badges it on a peer's row beside the aura and
the armory kit. The pose carries `xk` (my kills with an effect, a count), `xp` (the last one's place) and `xh` (the body's
height, in tenths of a metre).

**The wire audit** (2026-10-29). A kill is told while it falls within 45 m of my feet, my own draw's reach
(`render/killFx.js` KFX_FAR_M), whatever my screen drew. A peer's kill plays only within that and 8 m of ease of its drawn
feet, the ease a peer's portal has (`net/peer/peerFx.js` KILL_FX_PEER_M), so a modified client's pyre in a stranger's
face is refused. A kill farther away is not told: no peer would play it. A peer's blow plays only within its farthest
shaft (BLOW_PEER_M).

A kill rides one second of poses (GAP_MAX_MS) and then leaves them, and the second wire rounds its place and a blow's as
the pose's own (`slimPose`). The session keeps a peer's kit with its id, so a peer stood again from memory wears its
effects. The service answers glyphs in GLYPHS' order, the order the mask gives the room, and GLYPHS grows only at its
end. Pinned by `test/net/storefront_wireaudit.test.js`.

**Deploy, and the rollback floor.** The relay (world297) goes before the account service (acct230) that mints `gb`, and
`account-deploy.yml` waits for it, before its migrations too (AUDIT lane 3 F1: 0202's letter waits for the service that
shows its gift). A relay before world297 drops a `gb` token's glyphs, or refuses one that also carries `gx`. Its
claimsValid also refuses the whole token of anyone wearing the Crystal Spurs (`ak` code `d`, which every account made
before the update holds), the Vampiric Haze or the Blood of Coldharbour title: they could not say a hello.
So world297 is the relay's floor while acct230 or later mints: to roll the relay back, roll the service back first and
wait MAX_TTL_S (five minutes) for its tokens to lapse. A dungeon room of an older relay signs no cache proof, so no coffer
pays until world297 is back (Aurum.md section 3a).

**An Admin holds it all** (ADMIN-ALL, main's, at the merge of 2026-10-30; the owner: "give staff all in shop items" -
"everything" - "always"). An Admin holds every kill effect, portal skin and mount look, the Folios' items with both
folios open, and the daily wares, derived at every ask (`titles.js` holdsAll, `effectsHeld`; `battlePass.js` passOf).
The Folios' glyphs are paint, so an Admin holds them too. None of it is sold to an Admin: the shop's card and checkout
(`shop.js` shopHolds), a daily ware (`aurum-held`), the unlock and an item (`pass-held`). A pack of Aurum is a currency,
never held, so it still sells. Pinned by `test/server/admin_all_storefront.test.js`.

## 11. Not built, and why

- **Housing furniture, textures, themes, holiday decorations, Noble Estate.** The decorator furnishes from Daggerfall's
  own models and flats; a sold piece needs new art and an entitlement the decor service does not check yet, and a home's
  exterior look is free by design (HOME-LOOK). Selling it would take back what is free.
- **Name Change.** "Rename cost" is an open question on the owner's list (`Accounts-And-Cloud-Saves-Arc.md`); a handle's
  rename rewrites some forty columns and needs the owner's rules on cost and abuse.
- **Consumable Bundles.** Every consumable in the pack moves play - potions, Portal Stones, shards - so selling one is
  pay-to-win under the Terms.

## 12. AUDIT STOREFRONT RENDER (2026-10-29)

The effects' rendering read cold (lane 3). Each finding fixed at its cause, pinned in `test/render/killfx.test.js`,
`test/scenes/portalskins.test.js` and `test/ui/storefront_badges.test.js`, its mutants in
`tools/mutants/storefront_renderaudit.json`, all dead.

- **L1, the portal's basis.** A pool that ticked its portals with no eye (the Portal Stone's gate, the Elite Breach
  call's) stood a skin's cogs and arch on world X: from the east the cogs were one column. The set now reads the
  camera off the renderer's own view (`portalFx.js:"export function portalBasis("`), so no pool can forget it.
- **L2, the bursts' facing.** The portal bursts placed their rims and feet on world X. The burst door carries the
  portal's facing (`dir`), and every portal recipe places and throws its parts on its own axes
  (`killFx.js:"const onAxes = "`). A fissure's waking had the same fault and takes its crack's facing.
- **L3, the draw order.** The kill effects and the impact sparks write no depth, and three hosts drew them before
  their street's people, grass, banners or a building's characters, which painted over them. Each draws them once its
  last opaque pass is done, as RAIN-OVER-GRASS and GRASS-PORTAL do; the dungeon already did.
- **L5, pow of a negative.** The Daedric sigil, the Voidrend rim and the coils' ground ring squared by `pow`, which
  GLSL leaves undefined. Each is a product now, under SHADOW-CLOAK's pin.
- **L6 and L7, the frame's cost.** The build, the light, a skinned portal's tick and its batches allocated 2.7 KB, 264
  B, 2 KB and 940 B a frame; now 0, 0, 16 and 0. The pass wrote one buffer range twice a frame; each layer has its own.
- **L8, the budget.** A burst's pool is its recipe's (`killFx.js:"export const KFX_POOL_OF"`): kills, events (a
  portal's opening, a fissure's waking), places' breaths and horses' beats, each its own cap, the old 52 split. A full
  pool fades its oldest burst out over a quarter second, never cutting it whole.
- **L9 and L10, the try-on stage.** It applied the fit twice on y and sank the arch under the floor. Under less motion
  it now plays once and holds, as the window's other previews stop, and the setting is followed mid-session there and
  in the world's engine (`systems/hitFlash.js` `prefersReducedMotion`).
