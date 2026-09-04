# AUDIT 35 - THE CLOSING TOOLTIP, BOTH SIDES (2026-08-31)

Mac's call: a comprehensive audit on PX24 (an action taken closes the
tooltip), ensuring the same when looting containers, bodies, and the
rest. Method: every action button the tooltip can carry, traced to
the state it leaves `picked` in, on the pack side and the loot side.

## The actions, traced

| action | side | after PX24 | after this audit |
| --- | --- | --- | --- |
| wear | pack | clears on success; 3 refusals keep the tip | unchanged |
| take off | pack | clears | unchanged |
| use (read, drink, light, quest) | pack | clears before its final render; window-closing uses exit | unchanged |
| stow (to wagon / ground / container) | pack -> remote | clears; the arriving item no longer stays picked | unchanged |
| **take** (from container, body, pile, wagon) | remote -> pack | **cleared only in the loot-only flow; with the pack open the TAKEN item stayed selected**, raising the tooltip on the bag side after every take | **cleared on both sides (F1)** |
| choose one (G6's gift) | remote | closes the window | unchanged |
| wagon toggle | pack | clears a remote pick when the list goes | unchanged |

## Finding

**F1 - THE TAKE RE-RAISED THE TOOLTIP ON THE OTHER SIDE.** PX28 had
made looting "just take" in the loot-only flow, but with the pack
open the take kept the taken item selected in the bag - useful once,
and exactly PX24's quirk: every take from a corpse or a chest popped
the card over the bag. The take clears the pick on both sides now;
the tab still follows the arrival so the player sees where it landed.
The PX28 pin was re-taught and a mutant that restores the selection
dies.

## Verified

- The tooltip is ONE node for both frames (detailCol under `.packtip`,
  anchored into the pack when open and the loot window when alone),
  so clearing `picked` closes it wherever it stood.
- The click-away on either frame still puts the tip away; buttons and
  the tip itself are excluded from it.
- The in-world loot hover (lootHover.js) is a crosshair READOUT with
  nothing to dismiss; it is not the tooltip and takes no action.
- Refusals keep the tip open with the notice on every side (refuse()
  renders without touching `picked`), which is the right shape: the
  player is still looking at the thing that refused.
