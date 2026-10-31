# Holdings

The pause menu's Holdings tab and what it governs: the Stable (horse and wagon), the Fleet (every ship the player holds
title to, kept in a ledger instead of a deed item), repairs made away, refits, a ship's name, the ports' quays with
docking and gangways, and crew roles. It is the port's own, over Come Sail Away (`Come-Sail-Away.md`), Horse Cart and
Cargo (`06-Systems/Horse-Cart-And-Cargo.md`) and the sea fight (`Naval-Combat.md`), whose laws it calls.

## How it works

- **The tab.** The enhanced pause window's tabs include Holdings (`src/ui/enhanced/enhancedMenu.js` `PAUSE_TABS`). Its
  rail holds the Stable (`src/ui/holdingsPages.js`), the Fleet (`src/ui/fleetPage.js`, while Come Sail Away runs) and
  the Captain page (`src/ui/captainPage.js`, `Captains-Sea.md`), each while it has something to show.
- **The Stable.** The horse and the wagon, each a card: owned or not, where it is (Riding, Driving, Following, Waiting,
  Hitched, Parked, With you, Stabled) and the wagon's load. Summon and send away are Horse Cart and Cargo's own
  (`HandleSummonTransport`).
- **The Fleet** (`src/systems/fleet.js`, host half `src/scenes/fleetHost.js`). A ledger keeps every ship by Come Sail
  Away's UID: hull and rig, worth, name, refits, the port she was last laid up at; its own save slot, `Fleet`, at most
  `FLEET_MAX` (256) records. A deed rides in the book, not the pack, and every mod law that asked
  the pack for a deed finds it there. From the page a ship is brought round, laid up, repaired or renamed.
- **Repairs made away** (`src/scenes/naval/navalHost.js` `repairAway`). A crewed ship with a hand aboard, not fighting,
  is mended where she lies: free to the field-mending cap, the rest from her carpenter's stores. Her First Mate answers.
- **Refits.** Four lines (Hold, Rigging, Hull, Guns), three shipwright tiers each and nine of metal past them
  (`Naval-Refit.md`), bought at a port's shipwright for gold and materials, all or nothing.
- **A ship's name.** Printable ASCII, at most `SHIP_NAME_MAX` (24), through the player-name filter. Shown on her card,
  her plaque and to every other player on the boats' word (`n`).
- **Quays** (`src/systems/naval/quays.js` `planQuay`, `src/world/quayModel.js`, pool `src/scenes/quayPool.js`). Each
  berth along a harbour's shore stands a quay sounded for the Carrack: a plank deck on piles, a railed jetty to the
  bank. The world's harbour book (`src/systems/naval/harbourBook.js`) keeps the harbours. A harbour town whose own shore
  gives no berth is sounded out further; berths stand only where a ship can, never inside walls.
- **Docking.** At the helm with sails struck, no oar pulling, slow and with no hostile ship near, a ship within 25 m of
  a free berth's place and lined up with it is warped in by her hands and made fast: "Made fast at Sentinel's quay." The
  Fleet records it. A sail set or an oar pulled casts her off.
- **The gangway.** While made fast at a laid quay, a plank runs square from her waist down to the quay's deck, measured
  off her own colliders.
- **Crew roles** (`src/systems/naval/shipCrew.js` `assign`, `src/systems/naval/crewLife.js` `ROLE_POSTS`). Named hands
  take posts: First Mate (aft by the helm), Bosun, Gunner, Carpenter, Lookout, Cook, Deckhand, and a Bard's calling.
  One First Mate a ship. An idle hand returns to his post most of the time. Roles are the owner's alone and ride no
  word.

## Rules

- A Holdings tab to see and summon or send away mounts, carts and ships, with ships' values, health and repairs even
  while away; a ship upgrade system using gathered materials; loaned ships not upgraded until paid off; ship names
  others see; deeds replaced by the tab (Mac).
- Port towns get real piers and docking, alive and connected to the sea, shown when sailing near (Mac).
- Named crew are assigned roles and stand by them (Mac).
- Tamriel: harbours are found off the terrain at every port, on the Bay and past it.

## Daggerfall Unity

Nothing here is DFU's or a mod's. Daggerfall's port towns stand no piers and its data names no dock; Come Sail Away has
no quays and keeps titles as deed items.

## Code and tests

- `src/systems/fleet.js`, `src/scenes/fleetHost.js`, `src/ui/holdingsPages.js`, `src/ui/fleetPage.js` - the tab
- `src/systems/naval/quays.js`, `src/world/quayModel.js`, `src/scenes/quayPool.js`,
  `src/systems/naval/harbourBook.js` - quays and harbours
- `test/systems/horse/holdings.test.js` - the tab and the Stable
- `test/systems/naval/fleet.test.js` - the ledger, book, refits, away repairs
- `test/systems/naval/crewroles.test.js` - posts and the First Mate
- `test/systems/naval/quays.test.js` - quays, docking, gangway
- `test/systems/naval/harbourbook.test.js`, `test/systems/naval/portships.test.js` - harbours and berths
- `tools/mutants/holdings.json` - the mutants
