# The Materials Bag

A bag a gatherer buys at any General Store and carries as DFU carries the wagon: a second list beside the pack, with a
weight it may not pass. Online, every harvest goes into the bag, then the pack; the Stores are the character's storage,
reached in any town. The player meets it on General Store shelves, as a pane in the enhanced inventory, on the Stores
page, and at every crafting station. It is the port's own (DFU has no professions) and online only.

## How it works

**The bag** (`src/net/bagLaw.js`). Template `BAG_TEMPLATE` (600), "Materials Bag", DFU's Backpack picture, weightless
like the Small Cart, one to a slot. Owning one is holding one. Base price `BAG_BASE_PRICE` (250), about 500 gold at a
middling shop. It holds `BAG_KG_LIMIT` (300 kg) and only materials: the item-to-material map is built by minting every
material once, so the bag and the mint cannot disagree. A quest, summoned, worn or enchanted piece is never a
material. Its list is `entity.bagItems`, saved, swept for orphans, counted by the realm with the pack and wagon; its
food rots as the pack's does.

**Bought** on every General Store shelf, online. It never sells out: a bag bought is put back on its shelf
(`src/systems/shopStock.js` `restockEndless`), and online no shop buys one back (`shopBuysItem`). One to a character:
a second is refused by the take ladder and the keyed shelf ("You already have a Materials Bag.").

**Never leaves while loaded.** A bag holding anything is not dropped, stored, sold or given ("Empty your Materials Bag
first."), and a bag is never traded to another player or the guild vault at all.

**The window.** The enhanced inventory's remote pane shows the bag as it shows the wagon: a **Materials Bag** button,
the bag's list, its 300 kg on the weight line, **Put in bag** on a material's menu, a move past the weight refused. The
bag and the wagon never show together; no gold goes in; it never opens over a reward tray. `REMOTE_TARGET_TYPES.Bag`
(4) is the port's own. The classic skin's inventory is DFU's own window, so there the bag is reached from the Stores
page.

**Where a harvest goes.** The bag first, as far as its weight allows; then the pack within the carry limit; then the
pack past its weight. Every unit the service counted is made and said. With no bag, the pack alone. A node with no room
for one unit refuses before it starts ("No room in your bag or pack"). The first harvest of a session says where goods
go. A Motherlode's strike is the same.

**The Stores, in town.** Put in and take out in any town, on its streets or in its buildings, never below ground
(`src/scenes/world.js` `_storesReached`). The town is the client's convention, not the service's law. The Stores page
(Holdings tab) shows each material's Stores count and what is carried, with **Take out** (into bag, then pack), **Put
in**, **Put everything in** (one press, naming each material refused), and **Empty your bag into your pack** anywhere.
A material stores up to `STORES_MAX` (5,000). Units held but not counted by the service (looted, bought at a shop,
traded) show as "N unstorable" and can be put in as **loose**.

**The carried count** (`prof_carried`, `server-account/src/professions.js`). Per character and material, by origin
(own, bought, gold): what the service handed to the save that has not come back. A carried harvest adds to it; a
carried withdrawal moves units into it; a deposit moves them back. Every act first cuts it to what the client says it
holds (`held`), gold's units first, then bought, then own (`CLAMP_ORDER`); it is never raised. The cut applies only
against the count the client last heard (`seen`), and not while another carried act is pending, so a lost answer
never loses units. A carried harvest's row is kept `CARRIED_ROW_DAYS` (30).

**Loose units** (`LOOSE_ORIGIN`). A station's put-in (`DEPOSIT_ORDERS.work`) moves counted units first, then units the
pack holds past the count, into the Stores as loose; the Stores page's Put in does the same. Loose units serve every
crafting station and nothing else: never a writ, the guild Stores or a Drakes listing (`WRIT_ORIGINS`), and what a
station makes of them stays walled.

**Stations, writs and the potion maker.** A station works the Stores plus everything carried, counted or not, except
gold-bought units (`src/net/profBook.js` `workable`). It puts any shortfall in first (`ensureInStores`), all inputs
covered before any move; a shortfall nothing covers says "You do not have that many - in your Stores, your Materials Bag
and your pack together." A smelt's product comes out carried. A writ and the market move the counted units alone; a
writ's card names held units that cannot fill it. DFU's potion maker reads the bag after the cart
(`src/scenes/worldModes.js`); the campfire's Cook food reads the pack's raw food, then the bag's, and puts the cooked
food in the pack.

**One save a batch** (`depositMany`). Every take in a batch is stamped in the save (`entity.bagTakes`), one realm
checkpoint lands, then each deposit is asked. A refused checkpoint gives every take back. A deposit whose answer never
comes is kept and asked again by its id; a later page reads the stamp and gives back a refused deposit's units once.
Two tabs mint a kept harvest once.

## Rules

- A materials bag handled like the cart, carrying a lot but not unlimited, sold in every General Store for about 500
  gold; without a bag, materials go into the pack (Mac).
- Players may craft from their inventory, not just the Stores (Mac): stations work carried goods, counted or not.
- Unlimited bag purchases in stores; it never runs out (Mac).
- One bag per character (Mac).
- Law 3 stands for the economy: nothing edited into a save reaches the server's economy. Only counted units reach a writ,
  the guild Stores or the market; a lie about `held` can only cut the count, never raise it.
- Counting looted or bought units toward a writ, and letting the count travel with a trade, are the owner's calls,
  not made.
- Hosts: `world.js` holds the book's hands, the Stores page and the save; `exterior.js` and `dungeonContext.js` show
  the bag pane; `worldModes.js`'s potion maker reads the bag.

## Code and tests

- `src/net/bagLaw.js` - the bag's law, origins and deposit orders
- `src/systems/materialsBag.js` - the save's hands, what is held
- `src/net/profBook.js` - the book's flows: harvests, deposits, `workable`, `depositMany`
- `server-account/src/professions.js` - the service's count and deposits
- `test/net/bag1_service.test.js`, `test/systems/bag1_client.test.js` - the service and the client
- `test/net/fb1004_packover.test.js` - harvests past the pack's weight
- `test/systems/fb1004_endless.test.js`, `test/systems/professions/fb1004_onebag.test.js` - endless stock, one bag
- `test/systems/professions/fb1009c_uncounted.test.js`, `test/systems/professions/fb1013e_writwall.test.js` -
  uncounted and walled units
- `test/systems/fb1009d_bagcraft.test.js`, `test/net/auditbagcraft.test.js` - crafting from carried goods, the
  stations' wall
- `test/systems/fb1020c_bagcook.test.js`, `test/systems/professions/fb1020c_onesave.test.js` - cooking from the bag,
  one save a batch

## Open

- A modified client can craft from goods it never had and earn the craft's XP; nothing it makes reaches the economy.
- A craft refused after its put-in leaves the moved goods loose in the Stores.
