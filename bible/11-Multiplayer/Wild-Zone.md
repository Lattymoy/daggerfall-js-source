# The Open Zone

Cyrodiil, whole, is the open PvP zone online, and the Eltheric Ocean past Veilhaven's peace is a second ground under the
same laws. Foes are four times as strong and loot pays more the deeper a player goes; strangers are marked red on the
Overworld; a death at another player's hand can cost a worn piece or gold. Settlements are safe streets. A player meets
it crossing the province's border, with a line on the map and a tile on the HUD. Offline the province is the world's own.
How the fights between players work is `PvP-Rework.md`.

## How it works

**Where** (`src/systems/wild/wildZone.js`, `src/systems/wild/cyrodiilZone.js`). Every map pixel the world grid puts in
the Imperial Province (`WILD_REGION`, theatre 9), and water it encloses, is the zone's (`cyrodiilMask`). The mask keeps
cells of `CYRODIIL_CELL_PX` pixels; the maps draw one line for zone and province (`zoneLineOf`). Near is within
`WILD_NEAR_PX` of the edge. The world host sets the zone flag each frame from the pixel under the player; a dungeon
reads its own pixel. At sea (`src/systems/wild/etherWild.js`) the depth bands are the rings; the Veil refuses every
teleport across it.

**Rings and foes.** A pixel's depth from the edge sets its ring (`wildRingAt`): the Foothills, the Passes, the High
Crags and the Heart, paying `WILD_RING_LOOT` (+25% to +100%). A zone foe has `WILD_FOE_HEALTH_MULT` health and
`WILD_FOE_DAMAGE_MULT` damage over whatever it is (elites and champions too), times its ring's share more
(`applyWildFoe`, `wildTierMult`). Encounter packs are `WILD_PACK_MULT` times the usual cap
(`src/scenes/exteriorFoes.js`). Loot's drop chances, rarity odds and gold run at the ring's multiplier; a dungeon pile
rolls the ring's share of a second roll.

**Death.** Only a death at another player's hand takes anything: one random uninsured worn piece, else one policy's
gold, else a tenth of coin and letters (`PvP-Rework.md`). A death to a foe, a ship or the sea drops nothing and pays the
usual death penalty at the rise. Potions, lights, camp kit, food, ammunition, the wallet, the spellbook, vehicles,
deeds and quest pieces are never taken (`src/systems/wild/wildDropLaw.js`); the horse, the wagon and companions' packs
are storage no death takes (`WILD_NEVER_GROUPS`). The referee's signed fall (`src/net/wild/wildReceipt.js`, `f1`) is the
only kill; the account service takes the reward off the fallen's record (`server-account/src/wild.js`). A zone death
rises at the nearest town or temple outside it.

**Insurance** (`src/systems/wild/wildInsureLaw.js`, `server-account/src/wildInsure.js`, `/v1/wild/insure`). Any piece of
gear (`WILD_GEAR_GROUPS`) a kill could take may be insured for a fifth of its worth (`WILD_INSURE_DIVISOR`), plus the
gold its maker-laid powers cost. A policy is in force `WILD_INSURE_SETTLE_S` after it is written, is written only
outside the zone, and keeps its piece at a kill, spent only when it saved the piece. A character holds `WILD_INSURE_MAX`;
a policy whose piece is gone lapses. A villain holds no insurance.

**The same hand twice.** A kill by the same killer within `WILD_REPEAT_S` of the last takes nothing and spends no policy
(`wildShielded`).

**Safe passage.** For `WILD_GRACE.ms` after a fighter enters from away and quiet, no player's blow lands on it; its own
blow or a take from remains ends it. A rise grants none; only a walk in from the edge does (`src/systems/wild/zoneEdge.js`).
Ships' guns keep it too.

**Combat lock on storing** (`src/systems/wild/wildStoreLock.js`). For `WILD_STORE_LOCK_MS` after a player's blow, nothing
may be stored away.

**The remains** (`src/net/wild/wildLaw.js`, `src/net/wild/wildRemains.js`). The room keeps them `WILD_REMAINS_MS`, an
ordinary ground pile in whatever host they lie in. The first take of a record wins it. A fallen's own remains wear a
red line and a map mark (`src/systems/wild/wildRemainsWaypoint.js`). A fallen's party and guild cannot take them.

**Safe streets** (`src/systems/wild/zoneSafe.js` `settledAt`). In a city's, town's or village's streets (`SETTLEMENT_TYPES`,
within the location rect widened one block) no player's blow lands and none struck from there lands - except that a
non-villain there may strike a red villain. Farms, manors, inns and temples in the open country are not settlements.
Banks work in settlements (`zoneBankOpen`).

**Travel.** No fast journey goes into or out of the zone. Inside, one may go every `WILD_TRAVEL_COOLDOWN_MS` for the fee of
the ring it lands in (`WILD_TRAVEL_FEES`, `wildJourney`). A teleport - Recall, guild, Portal Stone, party, cabin - passes
only where each end is outside the zone or in a settlement (`zonePortFree`). Travel dials are capped at `WILD_PACE_CAP`
(`src/systems/travel/travelPace.js`). Houses are for sale throughout the zone.

**Strangers.** Every player outside my party and guild is a stranger: a red great helm on the Overworld within
`WILD_STRANGER_SEE_M`, said within `WILD_STRANGER_M`, and holding a journey within `WILD_STRANGER_SLOW_M`. The nearest
stranger sets the journey's pace (x10 at 600 m down to x1 at 100 m), and within 100 m both drop to 3D. On the Overworld a
stranger's name is hidden; in 3D it shows.

**The halls** (`src/systems/wild/wildDungeons.js`). Every real dungeon in the zone is sealed; each day the relay's clock
(`wdunDay`) stands `WILD_DUNGEONS_PER_RING` (10, 8, 6, 4) elite halls on empty pixels in each ring's middle band, at
least `WILD_HALL_SPACING` apart, never a graveyard. Their foes are swapped for the ring's high-tier ones
(`WILD_HALL_FOES`). The hub keeps the halls' locks, piles and who is inside (`WDUN_KEY`). Halls keep no instance.

**The Greater Giants** (`src/systems/wild/wildGiants.js`). `WILD_GIANTS_PER_RING` per ring, each wandering a pure walk of
the relay's clock from a day's home on low, open ground, never out of the zone. Each stands `WILD_GIANT_SIZE` times a
giant's size, calls `GREATER_GIANT_CALL` giants at `GREATER_GIANT_CALL_AT` health, and is marked as a skull on the
maps; its death is the hub's, kept down `WDUN_GIANT_DOWN_MS` (`src/net/wild/wildLaw.js`).

**Other laws.** No world events, at most `WILD_REVENANTS_MAX` revenant, no `/unstuck` outdoors, and a party left is no
fight for `WILD_PARTY_TRUCE_MS`.

## Rules

- Cyrodiil is the open PvP area; the Wrothgarian Mountains are Daggerfall's own again (the owner).
- Foes four times stronger; loot twice the gold, drop chance and rarity at the heart, less in the outer rings (the owner).
- Only PvP deaths drop; a foe's death pays the usual tenth (the owner).
- No one loses the wagon, the horse or anything stored at death (the owner).
- Insurance keeps the piece at a fifth of its worth; the policy is spent only when it saved the piece (the owner).
- A repeat-kill shield and entry grace; any take ends passage (the owner).
- Every settlement is a safe zone (the owner); teleports work in and out of settlements (the owner).
- Banks work in settlements (the owner); houses may be bought anywhere in the zone (the owner).
- Elite halls only, ten, eight, six and four a ring, moved every real day; only high-tier foes in them (the owner).
- Two Greater Giants a ring, shown on the map, the same for everyone (the owner).
- No world events in the zone (the owner).
- Only parties and guilds see each other on the maps (the owner); a guildmate is never hittable (Mac).
- A stranger within 100 m brings both players into 3D (`wildStrangersFrame`).

## Daggerfall Unity

DFU has no other players and no zone; every rule is a departure. The settlement test is DFU's location rect
(`PlayerGPS.PlayerLocationRectCheck`) with three town kinds; DFU's `IsPlayerInTown` also counts farms, manors, inns and
temples, which here stay open country.

## Code and tests

- `src/systems/wild/` - the zone's laws: mask, rings, drops, insurance, halls, giants, safe streets, grace, sea
- `src/net/wild/` - the relay's referee, remains, receipts, linger
- `server-account/src/wild.js`, `server-account/src/wildInsure.js` - falls, rewards, policies
- `test/systems/wild/` - the zone's tests: foe keeps, insurance, safe streets, city ports, homes, zone line, halls, giants
