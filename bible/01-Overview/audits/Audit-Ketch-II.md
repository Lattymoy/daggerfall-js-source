# AUDIT KETCH II - the airship raid read cold again, 2026-10-26

The owner: *"Can you audit the airship raid. Its a buggy mess"*, of the Sky-Ketch as it stands on main
(`11-Multiplayer/Sky-Ketch.md`; Port-Ledger A, KETCH), two days after AUDIT KETCH (`Audit-Ketch.md`) and after four
slices that had only spot checks since it: AUDIT SHIP (section 17), KETCH-FIX (18), KETCH-PELLETS and KETCH-LONGER (19),
and AUDIT WORLD-EVENTS' "raise before the fall" (section 11). Five cold lanes read the tree at `acebeb704`. Each lane was
given the ask, its files and what AUDIT KETCH had fixed, never a conclusion, and had to reproduce every finding with a
probe on the real code before reporting it:

| Lane | Read | Found |
|---|---|---|
| L1 | the relay and the voyage's law (the real Room over `test/fakeRoom.mjs`, the pure director) | 8 - 1 BLOCKER once enforced, 2 MAJOR, 5 MINOR |
| L2 | the page (the real `createKetchClient` on fakes of its host - no test had ever stood it) | 5 - 1 BLOCKER, 4 MAJOR |
| L3 | the rewards end to end (the real client fed the real brain's frames through the wire) | 6 - 2 MAJOR, 4 MINOR |
| L4 | the ship in the world (the real ship, Collider, PlayerMotor, deck host and Sailwalk Steps, in the game's frame order) | 9 - 1 BLOCKER, 3 MAJOR, 5 MINOR |
| L5 | the voyage run whole at crews of 1, 2, 3, 5 and 8 at reference damage, and every KETCH-LONGER number's consumers | 8 - 4 MAJOR, 4 MINOR |

36 reported. Five were the same defect seen from two lanes (L2-2 = L1-2 = L5-2, L2-3 = L1-1, L2-4 = L4-3, L2-5 = L3-2),
which leaves 30 defects. 26 are fixed. Each fix is pinned by a test that fails on the code as it stood, with a mutant in
`tools/mutants/ketch_audit2.json` that the pin kills (33 records, all dead). Two are left with their reasons, and one is
the owner's call (below). Each fix in code carries an `AUDIT KETCH II L<lane>-<n>` comment.

The two that broke the raid outright both came from the slices after AUDIT KETCH. **"Raise before the fall" put a
statement between `if (aboard)` and its `else`**, so the sky, the anchor-lift's ride up and the fall's waking ran only
while aboard, where the mode is never the exterior: she was never drawn over Daggerfall and nobody could board her.
**KETCH-FIX shut her hull's bottom**, so a body standing on a section of the bridge's ring when it fell landed in her
belly, 15 to 20 m down in the dark, short of the void that casts it back.

## Fixed - the page (L2)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L2-1 | BLOCKER | **Nobody could board.** `if (!aboard) down = null; else if (mode === 'exterior') { sky.frame(); ... }` ran the sky aboard alone. The fall's waking never ran either: a solo who fell woke at 1 HP, and `falling` was never cleared, so the next death aboard never fell (unkillable at 1 HP, the room's `bd` ignored). | The off-ship branch is the sky's and the waking's again. | `test/scenes/ketch_audit2_page.test.js` (the real client: the lift ridden up, a fall woken at a quarter, the next death falls) |
| L2-2 | MAJOR | **"The Watch is waiting" through waves four and five.** The `st` word's `wv` stayed bounded at three when KETCH-LONGER made five, so every state word (every five seconds, and every hello) folded the wave to 0. | `intIn(m.wv, 0, KT_WATCH_WAVES)` - the wire imports the one number, for `wave` too. | `test/net/ketch/ketch_audit2_relay.test.js` |
| L2-3 | MAJOR | **The page told the room its health in the Warden's fight alone**, while the room counts every blow on a member from the Watch on. A heal before the bridge never reached the count. With `BOSS_BODY` enforcement off this recorded false falls in every receipt's measure; with it on, an honest crew fell mid-raid (L1-1). | The body's word whenever aboard and alive. | `ketch_audit2_page` |
| L2-4 | MAJOR | **The lid's cast-back stood nobody anywhere** when the body's last ground was the main top or the Sailwalk: the exclusion is the Steps' (their void has already moved the body), but nothing moves a body on the lid. Every grounded frame cost 15% of health, down to 1 HP, with the line said each time. (= L4-3, which also found the main mast climbed and a 45 m drop onto the lid.) | `castBack(own)`: the lid and the roof always stand the body somewhere (`ketchSkyLanding` - where it stood on the main top, its span's checkpoint off the Sailwalk, the arrival with none). | `test/world/ketch_audit2_walk.test.js` |
| L2-5 | MAJOR | = L3-2. | | |

## Fixed - the rewards (L3)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L3-1 | MAJOR | **The construct-Pellet cap was a page's and a room's.** It lived in memory under the room's key: three reloads farmed 281 Pellets at the vents, and a page that helped two crews' ships in one voyage got 90 from each. | The cap is her voyage's, kept on the device (`KT_PELLETS_KEY`, `{ n, given }`); each body is counted once per ship. The relay does not count it: a second device is not closed. | `ketch_audit2_page` |
| L3-2 | MAJOR | **The cap was spent before the bosses.** The Watch's five waves and the two Hammer Wardens pay about 98 to one screen; from a crew of four on, the Watch-Captain, the Hammer Wardens and the Tonal Warden (15 to 25) paid nothing. | `KT_PELLETS_OWN`: the Hammer Wardens, the Watch-Captain and the Tonal Warden pay their own, once per ship. The cap holds the rest. | `ketch_audit2_page` |
| L3-3 | MINOR | **Pellets for bodies nobody felled**: the engine fed (every spider), a fight lost and the Warden's fall take bodies off with an empty name, which the wire reads as "Traveller". | The room says them `sw` on their `dn`, the wire carries it, and the fight lays nothing for one. | `ketch_audit2_page`, `ketch_audit2_relay` |
| L3-4 | MINOR | **A pile could lie under the deck where no press reaches**: it was laid at the falling body's drawn height, which sinks after 0.6 of its fall. | It is laid on the body's floor (the bridge's, for the Tonal Warden). | `ketch_audit2_page` (the construct's pile; the Warden's shares the line, unpinned) |
| L3-5 | MINOR | **A pile at the walk's start**, up to 23 m from where the body fell: the link's `dn` dropped the walk without stepping it. | The walk is stepped to the fall's moment. | `ketch_audit2_page` |
| L3-6 | MINOR | The Ketchmaster's hold's owed "spent" word was never said again (no pay lost: the hub handed the receipt at every hello, and the claim id answered it). | The world host resends it with the other pools'. | `ketch_audit2_page` |

## Fixed - the ship in the world (L4)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L4-1 | BLOCKER | **A fallen section dropped a body into her shut belly** (KETCH-FIX made her bilge-to-keel and her bottom solid). It landed at y -15 to -20, and the void is at -30. The only way out was about 180 m through the unlit hull to the bow's open run, under an invisible ceiling. | Her bilge to her keel and her bottom are drawn only again. Her sides stay solid from the deck to the bilge, so KETCH-FIX's "sides" pin holds. | `ketch_audit2_walk` (every section of eight cast back to the core) |
| L4-2 | MAJOR | **The Sailwalk could be skipped**: over the main top's aft net onto the engine house's solid roof, along its ridge to the bridge in 17 s (the step law believes a crossing the course's length), or off its eave into the void, which cast the body on to the last checkpoint. Audit-Ketch's "Left" had said no climb reaches the decks aft of the quarter wall. | The roof is the sky's (`ketchOnRoof`), cast back as the lid is, to the main top it came from. | `ketch_audit2_walk` |
| L4-3 | MAJOR | = L2-4. | | |
| L4-4 | MAJOR | **The Watch walked the Anchor Deck's box, not its bow**: a Sentry backing off ended 2.6 m out over the bow's nets, where no blade reached it. | `KT_BOW` and `ketchBowHalf` (net/ketch/ketchDeck.js) are one outline for the model's deck and bulwark and for `keepOnFloor`. | `ketch_audit2_relay` (PIN MOVED: `ketch_constructs`, the Anchor Deck's beam) |
| L4-6 | MINOR | **The Rotten Rigging blew by z alone**: a body on the aft deck, beside the house or by the bridge's rail was blown up to 3 m, and the gust's wind sounded on the bridge and in the cabin all through the Warden's fight. | A course beside a ship's decks breathes inside its steps' band (`sdBreathBand`, `SD_BREATH_BAND_M`). The Hour's course breathes everywhere, as before. | `ketch_audit2_walk` |
| L4-7 | MINOR | A 0.84 m gap where the waist's bulwark ended at z 179, short of the bridge's disc (179.83): a walk off her side with no jump. | The bulwark runs on to where her side meets the disc. | `ketch_audit2_walk` |
| L4-8 | MINOR | Spiders walked through the hold's cradles, posts, sockets and the lift's tower: the hold's obstacles were the drum alone. | The engine with its socket ring, the tower, the six cradles and the six posts. | `ketch_audit2_relay` |
| L4-9 | MINOR | The engine's flywheel was drawn through socket 1 and the cell set in it, and could be walked through. | On the drum's fore face, where no socket stands, as a thin solid. | `ketch_audit2_walk` |

## Fixed - the relay and the voyage's law (L1)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L1-1 | BLOCKER (enforced) | = L2-3, from the relay's count. | | |
| L1-2 | MAJOR | = L2-2. | | |
| L1-3 | MAJOR | **A construct's health and the engine's need were counted from whoever posed in the last 25 s**: seven of a crew of eight stepping off before the Watch's last fall had the Hammer Wardens born 76 times weaker, at their alt's share. | The crew counts as aboard for `KT_PLACE_KEEP_MS`, the time its place is kept anyway (a reload, a death, the lift again). | `ketch_audit2_relay` |
| L1-4 | MINOR | A fall's receipts died with the voyage if the first tell to the hub failed in her last half-minute. | At her end, the receipts are told before her record goes. Her record is kept, and told again every `KT_TELL_RETRY_MS`, while a receipt lives. | `ketch_audit2_relay` (the real Room) |
| L1-5 | MINOR | Under enforcement, a raised member was read dead again for one beat (its pose from before the raise) and held out for 15 s. | The room keeps the raise's moment (`rzAt`). A dying pose stamped no later than that speaks for no death. | `ketch_audit2_relay` (the real Room; PIN MOVED: `auditwe_down`) |
| L1-6 | MINOR | A Sentry never shot a member inside half its range, whether chased in the open or pinned in a corner. | It backs off for `KT_KEEP_BACK_MS` (2.5 s), then shoots where it stands, then backs off again. | `ketch_audit2_relay` |
| L1-7 | MINOR | The fourth wave at a crew of six to eight asked for five or six Sentries of four posts, so two stood on one post. | Six posts, each clear of the waist's cover. | `ketch_audit2_relay` |
| L1-8 | MINOR | `KT_VOYAGE_N_MAX` (10,000, "two centuries of Saturdays") would run out in 2038 at a voyage every ten hours. | Set to a receipt's own bound (`KT_RECEIPT_VOYAGE_MAX`). | `ketch_audit2_relay` |

## Fixed - the voyage run whole (L5)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L5-1 | MAJOR | **Her crews' last twenty minutes were shorter than a voyage**: KETCH-LONGER made the Warden's own clock 22 minutes. A solo with no deaths that boarded two minutes before she weighed anchor was shut out with the Warden at 16% and no receipt. | `KT_LAST_MS` is 45 minutes, which still fits the ten-hour round (away an hour and a quarter). | `ketch_audit2_relay` (PIN MOVED: `ketch_law`, `ketch_words`) |
| L5-2 | MAJOR | = L2-2. | | |
| L5-4 | MAJOR | **One death reset a solo's eleven-minute Warden fight.** With no crewmate to raise it, the body falls, and the fastest way back up takes at least some forty seconds against `KW_LOST_MS` 30 s. | `KW_LOST_MS` is two minutes. | `ketch_audit2_relay` (PIN MOVED: `ketch_warden`) |
| L5-5 | MINOR | The raise's window (`KT_DOWN_MS`, a minute) outlived the fight: a raise at 40 s stood a body on a fight lost at 30. | The same: the window is now inside the fight. | `ketch_audit2_relay` |
| L5-6 | MINOR | The lab's `?wv` stopped at three, and its engine stood at the old appetite. | `KT_WATCH_WAVES`, and `engineNeeds` for the lab's crew. | `ketch_audit2_page` |
| L5-7 | MINOR | The harness's fight loops were capped at the old 14 minutes. | `KW_ENDS_MS + KW_LOST_MS`. | `ketchSim.mjs`, `ketch_brain` |
| L5-8 | MINOR | The record carried the old numbers (three waves, the engine's four to seven, twenty seconds, 300 s, fourteen minutes). | `Sky-Ketch.md` sections 2, 4, 6 and 7 and the code's comments say the numbers that run. | the record |

## Asked after - the constructs' health bar (STAND-IN-BAR)

The owner, after the audit: *"Also, the additional enemies dont have health bars, unless this is already fixed"*. It was
not, and it was not the Ketch's alone. The enhanced HUD's target bar (`ui/hud/hudFoeTarget.js`, PX30) is marked by the
foe-damage paths of the dungeon and the exterior. A body an event's relay keeps the health of is struck through the
dungeon host's `landOnHost`, which never marked it. That covers the gate's legion, the Spire's, the Hour's Echoes and
the Ketch's constructs, all of them stand-ins (`world/gate/gateBoss.js` hostStandIn), so none of them ever had the bar.
A stand-in's own health is a count nothing empties (`STAND_IN_WHOLE`), so marking it alone would have drawn a bar that
never moved.

- `markHostStruck(hb, went)`: `landOnHost` hands its answer through it, so a blow that went marks the body. The host's
  return stays one statement (no logical line added).
- `foeTarget`: a relay's body (`relayHealth`) reads its health from the relay's word (`relayShare`). With no word heard,
  or nothing left after its fall, there is no bar.

Pinned by `ketch_audit2_page` (one of her constructs struck: named and whole, then at the relay's 40%, gone at its fall;
a blow that did not go marks nothing; the host's line). PIN MOVED: `fb1019f_bossdot` and `wb11_gate_host`, which read
`landOnHost`'s line. Mutants: `ketch_audit2.json` +4. THE FOUR HOSTS: `scenes/dungeonContext.js`, its one return wrapped;
`scenes/world.js`, `scenes/worldModes.js` and `scenes/exterior.js` are FLAGGED, since a host body is the dungeon
context's alone.

## Left, recorded

- **L5-3, the owner's call: a solo takes about 24 minutes against the design's "about fifteen"**, and is slower than
  every crew (crews of 2 to 8 take 19 to 21 minutes, on the "twenty"). This is measured at one swing a second of
  reference damage (`dpsRef`). A player's real damage lies between that and the purse's cap (about three times as much:
  the live run's bot went in six minutes). The solo's time is in the Watch (wave one is four spheres for one hand, eight
  minutes alone) and in the Warden's 600 s share, which every crew size meets in about eleven minutes. Retuning it means
  choosing how hard a solo should be, and that is a design choice, so nothing was changed. Options measured: thin the Watch
  for a crew of one or two, and give a lone fighter a smaller share (about 400 s).
- **L4-5** - the helm's console stands on sections 7 and 0 and floats over them when they fall away, so a body on it rides
  out the fall. Left: it is a refuge from a fall that costs only a cast-back, and moving the console or the lodestone off
  the ring moves the bridge's whole set.
- **A second device's construct Pellets** (L3-1) - the cap is the device's. The relay keeps no per-member count of them.
- **L3-4, the Tonal Warden's pile** - laid on the bridge's floor by the same rule as a construct's, but not pinned by its
  own test: the page test stands no Warden's fall.

## The mutants

`tools/mutants/ketch_audit2.json`: 37 records (33 for the audit, 4 for STAND-IN-BAR), each a fix undone, and all dead.

## The relay

`RELAY_VERSION` world266 (world265 on its branch, renumbered past GATE-COURTS' world265 at the merge - `net/wire.js`, `test/net/relayversion.test.js` - its law re-hashed, `net/ketch/ketchLaw.js`
now walked from `net/wire.js`), NOT YET DEPLOYED. The page's fixes ship with the site. The relay's ship with its deploy:
the `st` word's wave, the sweep's `sw`, the voyage's number, her last minutes, the fight's two minutes, the crew's count,
the Sentries, the bow and the hold, the end's tell and the raise.

## Where the record moved

`11-Multiplayer/Sky-Ketch.md` (sections 2, 4, 6, 7 and 20), `01-Overview/Active-Arcs.md`, `01-Overview/Audit-Log.md`.
THE FOUR HOSTS: `scenes/world.js` - one line, the owed words' resend (no logical line added); `scenes/worldModes.js` - the
deck host it constructs changed inside its own module; `scenes/dungeonContext.js` - the Steps it builds changed inside
their own module (`scenes/superDungeon/sdSteps.js`); `scenes/exterior.js` - FLAGGED, nothing of this passes through it.
