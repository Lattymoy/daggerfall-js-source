# Cape Toggle - a player's cloak, shown or hidden (CAPE-TOGGLE, 2026-10-29)

> As built. Not a DFU member: Daggerfall Unity draws no body of the player in the world and has no such switch
> (Port-Ledger section A, CAPE-TOGGLE). Where this page and the code disagree, the code's headers and pins run.

## 1. What was asked

The owner (2026-10-29), after the ARMORY-SEEN reports (`01-Overview/bugs/Field-Bugs-2026-10-29.md`): *"Also let's add a
cape/helmet toggle option in the inventory for people."* Asked three questions:

| Question | Answer |
| --- | --- |
| What does hiding the cape hide? | Worn cloaks plus any aura (the aura since left drawn - section 4) |
| Who sees it hidden? | Everyone |
| The helmet too? | Cape toggle only for now |

The helmet waits on art: Layered Gearing has no bare head - an empty helmet slot is drawn as leather
(`04-Characters/Layered-Gearing.md` What it draws) - so a hidden helmet there would still draw one.

## 2. The law

`src/systems/capeShown.js`. One device pref, `capeShown` (`systems/uiPrefs.js` PREF_DEFAULTS, true): the switch is
this player's, on this machine, and the online lane leaves it to them (`systems/online/onlineLane.js`
ONLINE_PLAYERS_OWN_PREFS). `drawnEquipTable(entity)` is the equip table AS THE BODY IS DRAWN -
the player's own with Cloak1 and Cloak2 empty while capes are hidden, a copy made only when a cloak is taken out; anyone
else's, a foe's or a townsperson's, is the table itself.

What is worn does not change. The cloak stays in its slot, on the paper doll and in the Cloaks panel; its warmth, a
raised hood and the vampire's shade (`survival/temperature.js` cloakState) read the real table, as every rule does.
Only the drawers read the drawn one.

## 3. The drawers - one door

Every drawer of the player's own body reads `drawnEquipTable`, never `equipTableOf`:

- the Eye of the Beholder sprite's outfit (`player/eyeOfTheBeholder/eotbBody.js` wornOutfit) - no cape layer and no
  hood, which is the cloak's;
- the Morrowind body (`combat/weapon/weaponRig.js`, armBuildOptsOf and the frame tick's `setWorn`) - no cloak mesh; slung
  gear sits as it does with no cloak (`04-Characters/Cloak.md`);
- the pack's figure (`ui/enhanced/enhancedInventory.js` refresh), the frame tick's table, or the two would dress the body
  by turns;
- the look (`net/remotePlayers.js` composeLook) - the cloak is left out, so a peer draws none.

`test/ui/capetoggle.test.js` "one door" holds the four to it.

## 4. The aura - left drawn (CAPE-AURA, 2026-10-30)

The owner, 2026-10-30, reporting the switch as built: "the cape toggle in the inventory also toggles off your aura". So
the switch hides the cloak alone. `scenes/auraHost.js` gathers my aura and every peer's as it did before CAPE-TOGGLE.
The look no longer says `hc`, `net/wire.js` validLook drops it (relay world293), and `net/online.js` lookOf, its only
reader's door, is gone. An older build's `hc` reaches no one, and is ignored if it does.

Aura Armory pieces are not capes: they stay drawn (`04-Characters/Aura-Armory.md`). The profile's character stage
(`render/characterStage.js`) is unchanged: it is the wardrobe's preview of what is worn and tried on, not the world.

## 5. The wire

Relay world285 kept a look's `hc` 1; world293 drops it again (section 4). A hidden cloak needs nothing of the wire: the
look leaves it out.

## 6. The switch

An eye in the Cloaks panel's bottom-right corner (`enhancedInventory.js` capeSwitch): pressed (`aria-pressed`) and gold
while shown, struck through while hidden; its words in its label and title (`inventory.cape.label`,
`inventory.cape.title`, every language). A filled panel is itself a button, so the eye is a sibling in the panel's grid
cell. A press turns the pref, dresses the body again, redraws the figure and the panel, as HOOD-SAID's press does.

It is a tile of the frame (`enhancedFrame.js` FRAME_ROLES), so each dress paints it as the panel it stands on; in the
Grimoire's ink it was invisible until then. On a phone the cloak's name keeps clear of it (`enhancedPlusStyle.js`, the
coarse-pointer query). `tools/enhancedPackLayoutProbe.mjs` measures it on desk, phone and the figure, shown and hidden
(`DRESS=grimoire` for that dress): every check passes in Plus; in the Grimoire, two checks of its own tab strip fail,
not the switch's. HOOD-SAID's raised-hood chip already touches the word CLOAKS on 360 and 740 px phones, before this.

## 7. Past the Bay

The switch reads no place (TAMRIEL-WIDE, `01-Overview/Port-Doctrine.md`): the pref, the drawn table and the look are
the same in every province, and a peer is drawn by the look they send wherever they stand. The look's pin
joins a room on the Bay and one past it, Whiterun's cell.

## 8. Pins

`test/ui/capetoggle.test.js` (5: the law, the look and the wire, the auras, the one door, the pack's switch);
`tools/mutants/capetoggle.json` (19, all dead). Relay world285's and world293's LAW rows: `test/net/relayversion.test.js`.
