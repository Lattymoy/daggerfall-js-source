# Breach Portents

Night modifiers for Dagon's Breach (`World-Bosses.md`). About two breaches in five carry a portent, announced with the
night's marks: the Vanguard (waves to clear before the Warden), the Sundering (he splits in two), the Captive (a knight
to free), or the Dire Breach (Vanguard and Sundering together). Every night also has the Warden's newer attacks, and on
some nights an unannounced Tithe-Imp runs. Each portent adds to the court; none changes the gate's clock, marks or
claim.

## How it works

**The draw** (`src/net/gate/gateLaw.js`, `src/net/gate/gateMods.js` `GATE_PORTENTS`). Every other night that is not a
Legion-Lord night draws from a shuffle bag, `PORTENT_BAG`: the Vanguard twice, the Sundering twice, the Captive once and
the Dire Breach once. So no two gates running both carry one. The omen, the map card, the marks card and Discord all
name the night's portent.

**The floor plan** (`src/net/gate/gateBrain.js` `FLOOR`, `COURTS`, `WALKS`). Every night has three courts (the
Warden's, the Burning Court, Dagon's Champion's). The Vanguard adds the Bridgehead (where its fighters arrive) and the
Muster; the Captive adds the Pen. Walkways rise as each stage is won.

**The new arsenal** (every night, `ATTACKS` ids 11-18). Chains of the Warden (outrun the chain), Dagon's Brand (the
branded run clear of others), Shared Torment (stand together to split it), the Scything Wheel, the Burning Gaze (look
away from him - the one blow answered by turning the camera), and the Unmaking (step into the dark wedge, then back).
The Sundering and the Rejoining are his split's own. Each new attack has a cooldown and may need a court of a given size.
The relay does not count blows it cannot judge from the poses it holds, such as a facing or a pull.

**The Vanguard.** He waits in the first court, unreachable, his fight not begun. Waves rise on the Bridgehead, then the
Muster, a new one when a quarter or fewer of the last stand or after `VG_WAVE_MAX_MS`. A wave's health is team seconds
of the platform's fighters' reference damage, its bodies counted by `vanguardCountFor`, at most `VG_STANDING_MAX`
standing. The Muster's last wave brings the Markynaz; its fall lays the walkway to him. His own health on a Vanguard
night is less by the waves' share, so the night costs no more of the clock.

**The Sundering.** At his second phase he calls the Sundering and tears in two: Ruhn's Blade and Ruhn's Flame. With
`SUNDER_SPLIT_MIN` (4) or more fighters they fight in separate courts; with fewer, together. They share his health above
`SUNDER_LAST` (26%), each with its own kit (`SUNDER_KITS`). A half brought down kneels, and the other has
`SUNDER_PAIR_MS` (20 s) to follow; a half left kneeling past that rises level with the other, at most `SUNDER_RISE` of
its share. Both down, they fall back together (the Rejoining) for his last stand.

**The Captive.** A named knight of the Covenant kneels chained in the Pen, held by gaolers. Freed, the knight's ward takes
the next Dagon's Reckoning in the court's place, once.

**The Tithe-Imp** (any night, unannounced). On one night in five, in his first or second phase, a gold Imp rises at the
court's rim and flees. Caught within `TITHE_LIFE_MS`, every fighter who struck it gets the tithe - gold and a gem from
the relay's seed, outside the receipt.

**What it pays.** The receipt's `p` carries the night's portents as bits (the Captive only if freed;
`RECEIPT_PORTENTS_MAX`). The spoils roll one more Magic-or-better piece for each bit, after every earlier draw
(`src/systems/gate/gateSpoils.js`). The account service rolls the Weir Key at `EG_KEY_ODDS_PORTENT` for a receipt with
`p` (`server-account/src/eg.js`).

## Rules

- Gates may carry wave-based platforms before the boss, a split boss to beat on both sides, and new movesets (Mac).
- Portents are always announced; only the Tithe-Imp is a surprise.
- The Wrath keeps its clock; no night is made longer.
- The Sundering forgives: a half left too long rises rather than wiping the court.
- Nothing gets faster: no existing wind-up, pace or cadence moves (Mac).
- Every wind-up can be outrun from its middle at a run, the Burning Gaze excepted.
- Every blow on any body of the fight goes through the one hand and purse (`spendBlow`, `spendPurse`).
- New behaviour lives in modules the hosts wire (HOST-SPLIT).

## Code and tests

- `src/net/gate/gateMods.js`, `src/net/gate/gateLaw.js` - portents and the bag
- `src/net/gate/gateBrain.js` - floors, walkways, the arsenal, the Vanguard, the Sundering, the Captive, the Tithe-Imp
- `src/net/gate/gateReceipt.js`, `src/systems/gate/gateSpoils.js` - the receipt's portents, the extra pieces
- `src/scenes/gate/gateArsenal.js`, `src/scenes/gate/gateVanguard.js`, `src/scenes/gate/gateCaptive.js` - the page's arsenal, Vanguard and Captive
- `test/net/gate/wb14a_arsenal.test.js`, `test/net/gate/wb14b_portents.test.js` - the arsenal, the draw and floors
- `test/net/gate/wb14c_vanguard.test.js`, `test/net/gate/wb14d_sundering.test.js`, `test/net/gate/wb14f_captive.test.js` - Vanguard, Sundering, Captive
- `test/net/gate/wb14e_tithe.test.js`, `test/net/gate/wb14g_pays.test.js` - the Tithe-Imp, what it pays
