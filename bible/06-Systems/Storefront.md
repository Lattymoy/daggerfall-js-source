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
| Battle Pass ($29.99 / $49.99) | Built: `Battle-Pass.md` |
| EXP Boosters ($4.99 / $12.99 / $24.99) | Built as Pass Boosters: they speed the pass's track, never a character |
| Bundles | Built: Daedric Champion, Portal Master, Lord of Oblivion, Seasonal Collector (section 8) |
| Housing Furniture, Interior / Exterior Textures, Complete Housing Themes, Holiday Decorations, Noble Estate | Not built (section 11) |
| Name Change | Not built: the owner's open question (section 11) |
| Consumable Bundles | Not built: every consumable in the game is power (section 11) |

**Cosmetic, always.** The shop's own line is "Every item is cosmetic. It gives no power in the game." and the Terms of
Service section 9 is "No pay-to-win rights". Renown is power (it raises health and magicka a level), so the sheet's EXP
Boosters are built as Pass Boosters: they speed the pass's track, whose every reward is a cosmetic. THE CEILING HOLDS
(`Home.md`) is untouched.

## 3. The catalogue (`src/net/shopLaw.js`)

The window's sections, in order: the Battle Pass, Kill Effects, Portal Skins, Mounts, Name Visuals (titles and glyphs),
Auras, Aura Armory, Bundles and Pass Boosters. A ware has a **tier** - Standard, Premium or Exclusive, the sheet's three
columns - shown as a mark on its panel; the pre-alpha wares keep their Pre-alpha mark instead.

**Held by id.** The first nine wares are bits on `players.shop_wares`; the bits stay, since a stored bit is a sale that
happened. Every later ware is held by its id in `players.shop_held`, space-separated in sale order (migration 0192): a
32-bit mask had room for 22 more, and a season alone adds five. `shopHeldIds` reads both.

**A ware that gives others.** A bundle, the Deluxe Pass and the Eternal Set each give a list of wares. Holding one holds
everything it gives, read at every ask. A ware is not sold again once it, or everything it gives, is held. Its price for
an account is its price times the share of its worth not yet held, never under Stripe's fifty cents: a Daedric
Champion bought by someone who holds the Daedric Pyre costs less by the Pyre's share. The Eternal Set follows the same
law, a departure from ARMORY's full $20 for a buyer who held pieces (`04-Characters/Aura-Armory.md`).

**Bundle-only wares.** The Daedric Dominion aura and three glyphs (the Oblivion Sigil, the Gate Sigil and the Brass
Crown) are sold only inside a bundle. Each has a worth, so a
bundle's price can be weighed, and is never sold alone.

## 3.1 Featured, and limited

The owner times every ware. `SHOP_ON_SALE` (wrangler.toml) still names what is sold. `SHOP_FEATURED` names what the
carousel shows and when: an entry a line, `<ware> <from> <to>`, the days in UTC, and `limited` after it for a ware sold
ONLY inside that window. The live season's Battle Pass leads the carousel while its season runs. Nothing is featured
outside its window, and nothing upcoming is told: a drop is news when it lands.

## 3.2 The demand

`/v1/staff/econ/shop` (Admins, the staff panel's economy reads) answers each day's sales a ware: orders opened, paid,
refunded and disputed, and the money, over up to 90 days, with each day's featured windows beside them. It is the
developer's chart: how much sold on which day, and how a launch window moved it.

## 4. Kill effects

A kill effect plays where a foe my own blow killed falls (`systems/playerKills.js` - every pool's word, a remote foe's
`slain` and a dungeon joiner's `v` among them). The standing body burns away in the effect's colour while the effect
bursts out of it; the corpse lies under it as before, its loot untouched. A Morrowind body plays its death and the
burst stands over it. The other players see mine: my pose carries a kill counter and the place (`kc`, `kp`, `ks`), and
my token carries which effect (`fx`), so nobody can show one they do not own.

| Effect | Tier | What plays |
| --- | --- | --- |
| Ashen Shatter | Standard | the body crumbles to ash from the feet up, bone-white shards and flakes fall, a grey dust rolls out over the ground |
| Voidrend | Premium | a rift tears open in the chest, the body's shards are drawn into it on spirals, it snaps shut in a ring of violet light |
| Daedric Pyre | Exclusive | a Daedric sigil burns into the ground, a pillar of crimson fire takes the body, embers storm upward, a scorch sigil fades |
| Tonal Shatter | the pass | brass cogs and gear teeth burst out, steam jets, a blue tonal ring rolls out over the ground |

`render/killFx.js` holds the simulation (`KillFx`) and its pass (`KillFxPass`). Each host's magic engine
(`scenes/hostMagic.js`) owns one, so all four hosts step, shift, clear and draw it with the impact sparks. Each look rings
its own sound (`tools/storefrontSfx.mjs`, `public/sfx/fx-kill-*.wav`). "Others' kill effects" (Features: all, near, none)
chooses whose are drawn. Where the browser asks for less motion (`prefers-reduced-motion`), the flashes are dimmer.

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

| Look | Tier | What it is |
| --- | --- | --- |
| Spectral Steed | Standard | a pale blue ghost, light flowing along it, see-through at its legs; glowing prints and wisps |
| Dawnfire Charger | Premium | radiant gold, the legs burning up from the hooves; a mane of golden fire, sun motes, burning prints |
| Daedric Warhorse | Exclusive | black and crimson under scaled barding with burning edges; a burning mane, smoke and embers off the hooves |
| Brass Automaton | the Deluxe Pass | riveted brass plates set with aetherium studs; sparks off the hooves, steam from the chest |

The look rides no wire of its own: the horse's code on the wire is the item's four parts (`wireHorseLook`), and each
screen lays a rider's look on from its token (`systems/horse/mountLook.js`). The beat - hoofprints, a mane, steam - is the
kill effects' engine's, as ambient bursts that never take a kill's place (`systems/horse/mountFx.js`).

## 8. Bundles

| Bundle | Price | Gives | Worth alone |
| --- | --- | --- | --- |
| Daedric Champion | $59.99 | the Daedric Dominion aura, the Daedric Pyre, Eternal Champion, the Oblivion Sigil | $84.96 |
| Portal Master | $49.99 | the Daedric Stone, the Daedric Dominion aura, the Gate Sigil | $59.97 |
| Lord of Oblivion | $119.99 | the Daedric Warhorse, the Daedric Stone, the Daedric Dominion aura, the Daedric Pyre | $144.96 |
| Seasonal Collector | $64.99 | the Deluxe Pass, the Heart Booster, the Brass Crown | $79.97 |

The sheet's Seasonal Collector was $79.99 with seasonal housing decorations; without them it is priced under its worth.
The sheet's Lord of Oblivion priced a Standard mount; its mount is the Exclusive Daedric Warhorse, so the bundle is
under its worth too.

## 9. The window

The shop's window (`ui/enhanced/enhancedShop.js`): the title, the proceeds' disclaimer first, then **the carousel** - a
panel a featured ware, large, live, with how long it stays featured and whether it is limited. It turns every eight
seconds (`carouselTurns`), never while pointed at, focused or paused (its Pause button), never for less motion. Its
arrows, its dots, the arrow keys and a swipe step it. Only the panel shown runs its stage. Under it the sections' tabs
(a section with nothing on the card is not shown), each section's panels, the account's line and the foot.

A panel's stage is live: a title on its plate, a glyph, an aura or a piece on the stand-in, a kill effect or a portal
skin played on the character's stage with the stand-in figure (`render/effectStage.js`), a horse in its mount look
(`ui/mountPreview.js`). A panel says its tier, its featured window and the price this account pays, the list price
struck through beside it where it is less. A bundle's panel lists what it gives, each held one marked, and its worth.
An effect's sound is heard when the player points at its stage or chooses its slide, never on every loop.

**The profile** (`ui/characterSlots.js`, PROFILE-SLOTS) has three more slots under its stage: Kill effect, Portals and
Mount. A kill effect pointed at plays on the character, which burns away in its colour and comes back; a portal skin
opens behind the character (none worn: the violet vortex); a mount look stands on its horse over the choices. One not
held is tried on and told how it is had; one held is worn through the flow's own door.

## 10. Online

The token's new claim is `fx`, the effects kit: three characters, the kill effect, the portal skin and the mount look,
`0` for none, omitted when none is worn (`net/effectLaw.js`). The relay badges it on a peer's row beside the aura and
the armory kit. The pose carries `xk` (my kills with an effect, a count), `xp` (the last one's place) and `xh` (the body's
height, in tenths of a metre).

## 11. Not built, and why

- **Housing furniture, textures, themes, holiday decorations, Noble Estate.** The decorator furnishes from Daggerfall's
  own models and flats; a sold piece needs new art and an entitlement the decor service does not check yet, and a home's
  exterior look is free by design (HOME-LOOK). Selling it would take back what is free.
- **Name Change.** "Rename cost" is an open question on the owner's list (`Accounts-And-Cloud-Saves-Arc.md`); a handle's
  rename rewrites some forty columns and needs the owner's rules on cost and abuse.
- **Consumable Bundles.** Every consumable in the pack moves play - potions, Portal Stones, shards - so selling one is
  pay-to-win under the Terms.
