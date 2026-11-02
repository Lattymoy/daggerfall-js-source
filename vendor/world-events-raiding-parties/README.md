# World Events - Raiding Parties 1.1 - Kamer (made for this port; ported off its IL with the mod's own bugs fixed)

**World Events - Raiding Parties 1.1** for Daggerfall Unity 1.1.0, by
**Kamer** (GUID `0c4a7cde-e3bd-4060-a371-6910a8625eac`; contact "DFU
Discord"). The mod's own description: "Selects Random Cities/Hamlets/Towns
for Raids from enemies." Kamer is also the author of Windmills of
Daggerfall (`vendor/windmills-kamer/`), World of Daggerfall
(`vendor/world-of-daggerfall/`) and Warm Ashes - Ships
(`vendor/warm-ashes-ships/`).

Mac (Lattymoy) handed the shipped bundle
(`world_events_-_raiding_parties.dfmod`, 11,820 bytes, sha256
`3129926f4ac72774c1b866caf76030b687f3625f50d8b986c62fd0d5b9815988`) over
on 2026-09-27: "World event mod was specially built for us. I want to talk
about how this can properly be integrated into online in a detailed way" -
and, asked whether to port it offline with its bugs fixed: "Yes".

**Licence.** The bundle states none, and the manifest names Kamer and
nobody else.

**Permission: granted by the author, who made the mod for this port -
Mac, 2026-09-27: "Kamer made this for us."**

## What the mod is

One compiled script (`World Events - Raiding Parties.dll` - the manifest
names `TownRaids.cs`, and the bundle carries its build, not the source).
No settings, textures, sounds or quests.

- At each game day's first frame it rolls 23 raids across the Iliac Bay:
  a region picked evenly among the travel map's regions that have a
  city, hamlet or village, a town picked evenly within it (a town at most
  once a day), a start between 00:00 and 22:00, two hours long, one of
  three raiding parties (knights; bandits - Rogues, Thieves, Burglars;
  orcs - Orcs, Sergeants, the odd Warlord), and 15 to 25 kills to drive
  it off.
- A raid in the player's region is announced ("{town} in {region} is
  under attack by orcs!"). While the player stands outdoors in the raided
  town, raiders come every one to ten seconds (orcs: one to eight), up to
  25 alive, placed ten to 35 units off just outside the view, and the
  town's defenders beside them, up to eight.
- Any raider death counts. At the target the town "has been cleansed",
  every raider and defender is gone, and a player on the town's map pixel
  gains +5 legal reputation in the region, +5 with its People, +3 with a
  knightly order of the region and +3 with the Fighters Guild. A raid
  that runs out its two hours says "The attackers have withdrawn".

## What is here

- `world-events-raiding-parties.dfmod.json` - the shipped manifest,
  verbatim (the bundle names it `World Events - Raiding Parties.dfmod`;
  sha256 `43397dc9...8d904e1`).
- `World Events - Raiding Parties.dll` - the shipped assembly, byte for
  byte (sha256 `11e17af7...077719e`), and
  `il/World_Events_Raiding_Parties.il.txt` - every method body as CIL,
  dumped by `tools/ilDump.py`. The port (`src/systems/raidingParties.js`)
  cites the IL offsets it restates.
- **Not here:** the C# source, which the bundle does not carry.

To re-derive the dump:

    python3 tools/ilDump.py "vendor/world-events-raiding-parties/World Events - Raiding Parties.dll" \
      > vendor/world-events-raiding-parties/il/World_Events_Raiding_Parties.il.txt

## The port

`bible/03-World/Raiding-Parties.md` is the page: what is ported as the IL
has it, the mod's own bugs and what each became here, and the online
plan (the world's event - the same raids for every player, one runner,
the relay keeping the count).
