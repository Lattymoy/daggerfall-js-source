# The King's Gambit 1 - an unnamed author (ported off the assembly)

**The King's Gambit** for Daggerfall Unity 1.1.1 - the manifest's ModTitle `TheKingsGambit`, ModVersion `1`, GUID
`e3406109-b550-43e4-ae70-51e32850e225`. The bundle names no author, and carries no licence and no readme; its manifest
lists `Scripts/TheKingsGambit.cs`, which the bundle does not carry. The mod's own words for itself: "A game of armies
and kings. Protect yours."

The owner (Lattymoy) handed the bundle over on 2026-10-13 - `thekingsgambit.dfmod`, 52,512 bytes, sha256
`60b9400b1a8ea93cfdf140ff11d44af713188244f4a262d58a122983171539cd` - and asked: "How can we implement this using the
illiac bay card system. A new minigame"; and, answering the design record's six questions: "Make the best and most
detailed decisions. We also have permission".

**Permission: [Mac: record the author's permission, or the link to it, here - the owner confirmed on 2026-10-13 that it
was given ("We also have permission"). The bundle names no author to credit; the credits say so until one is named.]**

## What the mod is

One MonoBehaviour, `TheKingsGambit` - the whole game, its IMGUI and its network link (`NetLink`) - and an empty 320 x
200 `TheKingsGambitWindow`, a `DaggerfallPopupWindow` the game pushes so Daggerfall Unity pauses under it, then draws
over. A two-player tactics game on a board fifteen columns by thirteen rows: each side a free king and up to twelve
units bought with 300 points from Daggerfall's own bestiary, two actions a turn - move, strike, or drink a potion -
fire, spikes and poison laid in pairs as the rounds pass, and a side whose king falls loses. Played against the
innkeeper (four tiers, for a gold stake) or online against a friend, over public MQTT brokers.

## What is here

- `TheKingsGambit.dfmod.json` - the bundle's manifest TextAsset, verbatim (its CRLF line ends kept).
- `TheKingsGambit.dll` - the shipped assembly, byte for byte (89,600 bytes, sha256
  `e1eb5e05747e31bb51e09486f380bded2961d8b04a23b18104a91955fe723036`), and `il/TheKingsGambit.il.txt` - every method
  body as CIL (`tools/ilDump.py`). The bundle carries no C# source: the port cites the assembly by class and member
  (`TheKingsGambit.AiAction`), and the static tables the C# view cannot show were read off the IL.
- Not here: the bundle itself (UnityFS 7, one LZ4HC block), and the C# a decompiler reads off the assembly (ilspycmd
  9.1, read, never run and never vendored). The mod's five particle textures were never in the bundle - the shipped
  game draws its own procedural blob, and the port paints the board's marks in code.

## The port

`bible/11-Multiplayer/Kings-Gambit.md` is the record: the mod read off its assembly (sections 1-2), the decisions
(section 10), and each slice. The game is the tavern card table's third, beside Hold'em and Iliac Hand:

- the law (`src/net/kingsGambit.js`, KG1) and the innkeeper's play, a regular's (`src/systems/gambit/gambitPatrons.js`, KG2),
  ported verbatim - every table and every float32 comparison the mod's own;
- its units the Iliac set's faces (KG-SET painted the nine with no card), its kings the Bay deck's four;
- the evening at the table offline (KG3): the stake, a regular's night, the panel in the house's coat and words, the
  board on the cloth;
- online, the relay deals and rolls every die (KG5) - the mod's client-settled MQTT link is refused.
