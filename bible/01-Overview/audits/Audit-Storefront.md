# AUDIT STOREFRONT (2026-10-29) - the shop, the effects, the Battle Pass and the season in the world, audited before they merge

The owner, of STOREFRONT (`06-Systems/Storefront.md`, `06-Systems/Battle-Pass.md`): **"Please audit this deeply, ensure
its perfection along with exceptional design for all assets"**, and of the profile slots' pictures: **"The profile images
leave a lot to be desired"**. This page is the findings, each with its verdict. What the audit changed is written into
the record's sections as they now stand, and the code says the same at every site under AUDIT-STOREFRONT or its lane's
own word (AUDIT PASS, AUDIT LANE 5, AUDIT STOREFRONT RENDER).

## How it was run

Five lanes, each a cold reader of the branch at f44a61723, told to reproduce every finding before reporting it, to cite
the code by its text, and to fix nothing. A sixth lane is the assets themselves: every picture the change draws was
rendered and looked at - the shop's panels shot in time (`tools/storefrontGalleryProbe.mjs`), the try-on stage frame by
frame, every horse sprite in each mount look, the portraits large. No fix was made until the lanes had reported. The
fixes were made in seven lanes of their own (A to G), each on its own branch off f44a61723, then merged.

| Lane | Over | Fixed in |
|---|---|---|
| 1 - the shop | the purchase path: the price, the order, the webhook, the card, the window | A (the service), B (the window) |
| 2 - the wire | the effects kit on the token, the pose's kill fields, peers' effects | E |
| 3 - the render | the kill-effects engine, the portal skins, the stage, the shaders | F |
| 4 - the pass | the finds, the pass's card and client, the season's wares in the shop | C, and A for the wares |
| 5 - the season in the world | Dwemer's Breach: the fissures, the Colossus, the Resonant Maul | G |
| V - the assets | every picture: portraits, emblems, wares' art, stages, mount looks | D |

Severity: BLOCKER a dupe, a loss, a crash or a hole any player can use; HIGH a broken promise or a likely bug; MED a
wrong result a player meets; LOW an edge, a risk, a word or the record alone. Every FIXED is pinned in the test its
verdict names, and where it changed code it has a mutant in the lane's list (`tools/mutants/storefront_shopaudit.json`,
`storefront_passaudit.json`, `storefront_renderaudit.json`, `storefront_seasonaudit.json`, `storefront_portraits.json`,
`storefront_mountpoints.json`, `storefront_mountlooks.json`, `storefront_seasontamriel.json`, and lane 2's).

## Findings

### 1 - the shop

| # | Sev | Finding | Verdict |
|---|---|---|---|
| S1 | HIGH | A ware refunded or disputed stayed held when a bundle bought later for less also gave it: the Pyre disputed after the Daedric Champion left all four wares for the bundle's cut price | FIXED: an order keeps its credit, the ids its price took off; a ware taken back that a giver held with credit for it is marked lost (`-<id>` in `shop_held`) and no giver gives it; a payment that covers it again clears the mark. `test/server/storefront_audit.test.js` S1 |
| S2 | MED | Every ware not yet dropped stood on the window as "No longer sold", which also told each coming drop; Collections said "In the shop" before the drop and after a window shut | FIXED: the card carries no ware before its drop (`shopDropped`), and Collections reads the card. S2 |
| S3 | MED | A replaced checkout page still took the old price, and a page paid for a ware already held took the money | FIXED: a replaced page is closed at Stripe; a grant closes the pages it made wrong; a page paid anyway is refunded by the service under the order's own key, owed until Stripe takes it (Storefront.md 3.2). S3 |
| S4 | MED | A malformed `SHOP_FEATURED` line opened its ware's sale for ever, and a rolled date (13th month, 31 November) read as another | FIXED: dates read strictly; a bad line naming a ware shuts its sale; a pin reads every line of the deploy's schedule. `storefront_service.test.js` S4 |
| S5 | MED | A booster a stronger one makes worth nothing was sold to that account (lane 4 #5) | FIXED: the card marks it spent, its page refuses it, the window offers no Buy. S5 |
| S6 | LOW | The season's wares were sold while `PASS_OPEN` shut the finds (lane 4 #4) | FIXED: a season's ware needs the pass on. S6 |
| S7 | LOW | Two overlapping orders landing together added the Deluxe's levels twice (lane 4 #7) | FIXED: the grant is guarded on the row as read and decided again on a fresh read. S7 |
| S8 | LOW | The demand's "opened" counted presses that never reached Stripe | FIXED. S8 |
| S9 | LOW | A panel's featured and limited words were drawn once, wrong after its window shut or past midnight | FIXED: drawn with the panel's state, the day counted again at UTC midnight. `test/ui/storefront_audit_window.test.js` S9 |
| S10 | LOW | A season's ware paid after its season was granted (lane 4 #10) | FIXED: refunded instead; the season's wares stop selling SHOP_CHECKOUT_MS before its end, a Stripe page's life. S10 |
| S11 | MED | The Premium Pass said "twenty more rewards"; its track has twelve (lane 4 #6) | FIXED: counted off the track, in each language's plural. S11 |
| S12 | LOW | A cut for a ware held inside a giver the bundle gives was never said | FIXED: the confirm page and the window say a giver held in part. S12 |
| S13 | LOW | The carousel's dots were 14 px targets, under WCAG 2.2's 24 px | FIXED: 24 px targets, the 14 px mark inside. S13 |

### 4 - the pass

| # | Sev | Finding | Verdict |
|---|---|---|---|
| P1 | HIGH | Riding the Sky-Ketch's lift and banking a cell paid as endgame finds, with no cooldown | FIXED: the acts no find pays are one list (`qlActs.js` ACT_NOT_FOUND), read by the pass and the Witches' Festival alike - each had kept its own copy. `test/server/storefront_passaudit.test.js`, `ql11_acts` |
| P2 | MED | A page loaded before the opening, or before `PASS_OPEN` turned on, never asked a find | FIXED: the card's `open` is the switch's word alone; a page told the pass is shut rests, then reads again. `passclient` |
| P3 | MED | `/v1/pass/find` was no progression claim: no seated character, no play behind it | FIXED: a progression route on a stream of its own (`pass`); a line staff stored before the stream was added reads its first line for it. `int16_progress` (PIN MOVED) |
| P8 | LOW | A find's answer had no tracks, so a level notice went stale after a purchase | FIXED |
| P9 | LOW | The bind's read ran beside the finds, so a late answer rolled the level back | FIXED: one queue |
| P11 | LOW | The client never backed off a refusal | FIXED: PASS_REST_MS, each refusal its rest |
| P12 | LOW | The record and the comments said what the code did not | FIXED in Battle-Pass.md sections 5, 7 and 8 |

| P2b, P3b | MED | The Witches' Festival's find had the same two gaps: a stale shut read vetoed it, and it was no progression claim | FIXED with them: one rest rule for both pages (`net/askRest.js`); `/v1/festival/find` a progression route on a stream of its own. `storefront_passaudit.test.js`, `witch1_client` |

Lane 4's #4, #5, #6, #7 and #10 are lane 1's S6, S5, S11, S7 and S10.

### 2 - the wire

| # | Sev | Finding | Verdict |
|---|---|---|---|
| E1 | MED | A peer could place its kill effects anywhere, 700 m off in another's face | FIXED: a kill farther than KILL_FX_PEER_M from the peer's drawn feet is dropped, a blow past BLOW_PEER_M. `test/net/storefront_wireaudit.test.js` |
| E2 | MED | The effects kit was lost from peer memory: a re-stood peer and an absent owner wore nothing | FIXED: the remembered row carries `fx` |
| E3 | LOW | The "Others' effects" setting did not reach the mount looks, though its note said so (lane 3's #4) | FIXED: one law (`othersEffectShown`); the horse's dye and its beat asked it |
| E4 | LOW | A kill's fields rode every pose for the rest of the session | FIXED: carried KILL_FX_RIDE_S, the longest a far listener waits for a pose |
| E5 | LOW | A kill the killer's own screen did not draw was never told | FIXED: told by the wire's reach from the killer's feet, never by the draw |
| E6 | LOW | An older relay drops a `gb` token's glyphs, or refuses it | FIXED in the record: the rollback floor (Storefront.md section 10) |
| E7 | LOW | The glyphs' order became a wire contract with no guard | FIXED: a pin over the 33 the mask was first signed over |
| E8 | LOW | My own glyphs' order differed from what peers see | FIXED: one order on both ends (`glyphsInOrder`) |
| E9 | LOW | The pose's kill fields were misnamed in two places | FIXED: `xk`, `xp`, `xh` |
| E10 | LOW | The attachment pins did not measure what they claimed | FIXED: the widest socket measured (1,704 and 1,760 bytes), the pins moved |

### 3 - the render

| # | Sev | Finding | Verdict |
|---|---|---|---|
| R1 | HIGH | A skinned Portal Stone gate stood its pieces on world X, not across the view | FIXED: the portal set reads the camera itself (`portalFx.js` portalBasis), so no caller can forget it. `test/render/killfx.test.js`, `portalskins` |
| R2 | MED | The portal-skin bursts assumed every portal faces ±Z; the fissure's wake too | FIXED: the burst carries the portal's facing and every recipe lays its parts on the portal's own axes |
| R3 | MED | The kill effects were drawn before the opaque world was whole, so foes and grass behind a burst painted over it | FIXED: drawn after the last opaque pass in each host - moved lines, no host grew |
| R5 | MED | GLSL `pow` of a negative base in the new shaders (undefined) | FIXED: written as products; a sweep holds every new shader to it |
| R6 | LOW | The stage applied its fit twice on y, sinking the Daedric arch and the Aetheric shards | FIXED |
| R7 | LOW | Per-frame allocation in the effects' hot path (2.7 kB a frame in `build`) | FIXED: 0 bytes a frame, measured |
| R8 | LOW | The pass rewrote one instance-buffer range twice a frame | FIXED: each layer its own range |
| R9 | LOW | A full pool popped bursts out, and other bursts took the kills' slots | FIXED: each kind its own pool (KFX_POOL_OF), the oldest faded out over KFX_FADE_S |
| R10 | LOW | Less motion was not honoured on the try-on stage, and was read once | FIXED: the stage plays once and holds; read live |

Lane 3's #4 is lane 2's #3.

### 5 - the season in the world

| # | Sev | Finding | Verdict |
|---|---|---|---|
| W1 | HIGH | The fissures' clearings made every pixel build and the clearing sweep about 100 times slower for the season | FIXED: asked by pixel (`gateClearance.js` setNear): 4,000 flats 53 ms to 0.7 ms, the season's sweep 453 ms to 11 ms. `test/world/gate/seasonclear.test.js` |
| W2 | HIGH | The Resonant Maul was minted on the page alone; its once a day was the device's | FIXED: the service's (`POST /v1/season/maul`, `seasonClaim.js`), once a UTC day an account, a lost answer a yes again; a progression claim on the pass's stream, so a session's secret alone is refused. `seasonmaul_service.test.js` |
| W3 | HIGH | Every reader's copy of the Colossus lost Blade-turning: blades and arrows did double damage but on the owner's screen | FIXED: one trait cap for every reader (`bossTraitsMost`). `seasonaudit_world.test.js` |
| W4 | MED | One Colossus in twenty stood with one random elite trait instead of the season's three | FIXED: never the street's elite roll |
| W5 | MED | No Colossus bar but on the owner's screen | FIXED |
| W6 | MED | A Colossus taken down, not killed, counted as fallen and gave the Maul | FIXED: a fall needs a body |
| W7 | MED | A cleared camp's quiet held only on the stander's page, and only in memory | FIXED: every screen whose last foes there are bodies, kept across a reload |
| W8-W12 | LOW | `who()` never named the account; the fall line said to a striker alone; fissures on roads; the waking said before anything stood; a race lost read as a clear | FIXED, each (Battle-Pass.md section 6) |
| W13 | LOW | A camp's stander walking off takes the fight away | KEPT: the Starfall's leash; the reason in Battle-Pass.md section 6 |
| W14 | HIGH | The season stood in the Bay alone: its fissures read the Bay's gate scan and its regions, so a player in a province met no tremor's fissure, no construct and no Colossus (TAMRIEL-WIDE) | FIXED: a few fissures an area in every theatre a star night stands in (Cyrodiil none, as the Starfall), on each theatre's scan, off its roads once they are laid, giving way to its own gate; the Bay's byte for byte as before; no relay change. `season_tamriel` |

### V - the assets

| # | Sev | Finding | Verdict |
|---|---|---|---|
| V1 | HIGH | The profile portraits read as flat clip art (the owner) | FIXED: all twelve drawn again on a renderer with shared materials, a clip and a bezel. `test/ui/storefront_badges.test.js` |
| V2 | MED | An effect had no picture where it cannot play: a bundle's pieces, the profile's choices, the pass's track | FIXED: an emblem each (`ui/effectEmblems.js`) |
| V3 | MED | A bundle's stage, a booster's and a pass's showed a name and no picture | FIXED: one door for a ware's picture (`ui/wareArt.js`); a bundle lays out its pieces; a booster's and a pass's banner is built round the season's art |
| V4 | MED | The stages wore a stand-in, never the player; the Pyre burned a shadow behind its pillar | FIXED: the player's own body, asked once a window |
| V5 | LOW | A long title's big plate ran out of its stage | FIXED: fitted with container units at every width |
| V6 | MED | A mount look dyed the hide alone: the Spectral Steed kept a black mane, tail and far legs, on the sprites and on the 3D horse | FIXED: the look shades the horse's points (`horseCoats.js` pointsOf) and the 3D horse's hair (`horseRig.js` HAIR_ROWS); no rider's bow, steel or cloak moves. `mountlook` (PIN MOVED) |
| V9 | HIGH | "The horse designs are awful" (the owner): each look laid flat patterns in the picture's box - a grid of holes, rows of scales, stripes - over head and legs alike | FIXED: each look painted by the horse's own shape (`systems/horse/mountPaint.js`: its ramp by the art's light, its rim, legs and strands), the riding view's mane and the 3D horse's chest and legs included; the views said by their callers. `mountlook` (PIN MOVED), `mountpaint` |
| V10 | HIGH | A coat or a look dyed Eye of the Beholder's riders: a face joined to the neck by an arm on the reins took the hide, dark hair the points, in every view (COATS1's, seen when the looks made it blue) | FIXED: each picture's rider found by the other four sets and baked (`tools/bakeEotbRiders.mjs`, `eotbRiderMasks.js`), spared by the dye. `eotbriders` |
| V7 | MED | The effects kit was written to the stored session and dropped by it, so a reload wore none until the service spoke (found when main's ARMORY-SEEN pin met it at the merge) | FIXED: `keepSession` keeps it. `armorylive` |
| V8 | - | The pass-only wares (the Tonal kill, the Brass gate, the Automaton, the season's titles, glyphs and auras) | Seen in time on the stage after R1-R10: sound, nothing changed |

## AUDIT-STOREFRONT II (2026-10-29)

The owner, of the same arc: **"1. Audit everything 2. Ensure the new UI is perfect and enhanced ui plus 3. Ensure the
reward tracks make sense. No overbundence of titles and profile icons. 4. Implement a currency ... 5. For profile icons
no figures should be used."** Five cold lanes read the branch at 4d881139d, each told to reproduce a finding before
reporting it and to fix nothing: A the payments, B the pass, C the effects, D the season in the world, E the window and
the profile on the Enhanced Plus kit. The track, the icons and Aurum are their own pages' (`06-Systems/Battle-Pass.md`
section 3, `06-Systems/Aurum.md`). Each FIXED is pinned in the test it names and guarded by a mutant
(`tools/mutants/aurum.json` for lane A, `storefront_audit2_ui.json` for E, and each other lane's below).

### A - the payments

Stripe tells a payment's words in no order and retries a refused one for days. Pins: `test/server/storefront_audit2_pay.test.js`.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | A refund or a dispute told before the paid word was forgotten: the paid word, retried later, granted the ware on a payment already gone back | FIXED: every word on a payment is kept by its payment intent (`shop_charge_words`, migration 0196), whatever its order's state; the paid word reads them before it grants and ends the order refunded or disputed |
| A2 | HIGH | A giver's price was trusted at the grant: a bundle paged with credit for a ware whose own payment went back after gave that ware unpaid; a bundle won back from a dispute did the same | FIXED: a giver whose credit no longer matches the row is refunded for its price, never granted; a giver given again marks each credited ware it no longer holds lost (`-<id>`) |
| A3 | MED | A refund while an inquiry stood was ignored, and the inquiry's close gave the ware back on a refunded payment | FIXED: a refund ends a disputed order refunded; a dispute's close restores only with no refund kept and no other dispute open |
| A4 | LOW | A paid word told twice at once: the late copy acted on a refund it had computed from the order as it stood before the first landed, and returned a good sale | FIXED: an attempt answers only the refund it wrote; one refused by the order's guard answers none |
| A5 | LOW | Two pages paid at once ended differently by which landed first | FIXED by A2: whichever lands second no longer matches what the row holds and is refunded, the same either way |

### B - the pass

Pins: `test/server/storefront_audit2_pass.test.js`, `test/scenes/storefront_audit2_world.test.js`; mutants
`tools/mutants/storefront_audit2_season.json`. The record is `06-Systems/Battle-Pass.md` section 9.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | HIGH | A Colossus's fall was kept on its fissure's record, made again by a relay blip, a walk off and back or a new day: the fall said again, the Maul asked again, a second given after midnight | FIXED with D1: the fall kept by the foe pool's record, one for the body's life |
| B2 | MED | A find dropped offline or on a 5xx was lost, and with no id could not be asked again safely | FIXED: each find carries its own id and is asked again with it; the service keeps the id with its answer (`pass_asks`, migration 0196) in the find's own batch, so a repeat is answered as it was and counted once |
| B4 | LOW | The 'make' challenge said "Make or find" where it counts crafting, socketing and reforging | FIXED: its words, in every language that held the row |

### C - the effects

Pins: `storefront_audit2_fx_veil.test.js`, `storefront_audit2_fx_magic.test.js`, `storefront_audit2_fx_dye.test.js`,
`storefront_audit2_fx_stage.test.js`; mutants `tools/mutants/storefront_audit2_fx.json`.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | MED | A concealed peer's mount beat was still thrown - at an empty saddle, or bright over a translucent rider | FIXED: the peers' effects take each peer's veil with its pose (`peerFx.js` update) and give a veiled or hidden rider no mount look |
| C2 | MED | The magic torn down before its idle warm-up built a kill pass and an impact pass on the dead engine, never freed | FIXED: `destroy()` marks both broken first, so a warm after it builds nothing |
| C3 | LOW | One failed load of the rider masks broke every mounted sprite for the session | FIXED: a failure clears the memo and answers none, and the next asks again |
| C4 | LOW | A mane's flicker read the seed the last horse dyed left behind | FIXED: the hair's dye sets its own |
| C5 | LOW | A profile stage started again never played the effect its slot was trying on | FIXED: the stage is told the effect as it starts |
| C6 | LOW | The mount preview read less motion once, and stopped its clock for good under it | FIXED: read every frame, the clock kept |

### D - the season in the world

Pins: `test/scenes/storefront_audit2_world.test.js`, `test/systems/online/onlineCheckpointClock.test.js`; mutants
`tools/mutants/storefront_audit2_season.json`.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | The same as B1, read from the world's side | FIXED by B1 |
| D2 | HIGH | A Maul lost with its page: the claim spent at the service's yes, the piece safe only once a save held it | FIXED: kept on the device from the mint until a save made after it lands, asked again by its id at the next stand-up, the service answering a kept id with its own day; the mint asks a checkpoint of the next standing frame (`onlineCheckpointClock.js` askCheckpoint), with no host binding |
| D3 | LOW | The map's held poll made every fissure's card again, four times a second | FIXED: made once while the stage, each theatre's gate of the day and the language stand: 0.8 ms a poll to 0.005 |
| D4 | MED | The camp's ring was laid in the world's frame, off by twice the model's yaw: one construct in eleven and half the Colossi stood in the wreckage | FIXED: the camp stands on the model's own free ground, constructs 0.6 m clear, the Colossus 1 m clear past the crack's end |

### E - the window and the profile

Pins: `test/ui/storefront_audit2_window.test.js`, `shop_window.test.js`.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| E1 | HIGH | The shop was not on the Enhanced Plus kit: no surface carried a role, its sheet painted its own violet grounds and borders, so no theme reached it | FIXED: every surface carries its role (`enhancedFrame.js` FRAME_ROLES) and the sheet keeps geometry and words; a pin reads the sheet and refuses a role painted |
| E2 | MED | The Grimoire dress could not reach the presses and tabs | FIXED by E1: its presses and tab plates read the roles |
| E3 | MED | A title's paint on a panel's page stayed light on the Grimoire's parchment | FIXED: inked where it stands on a page (`grimoireDress.js` inkPaintedWord, one home with the Collections page); on a well's wood it keeps its paint |
| E4 | MED | The effects' colour words matched no rule outside the profile card | FIXED: one ink table (`effectText.js` effectInkCss) for the profile and the shop |
| E5 | MED | A challenge done and the foot's payment line shared one class, so the payment line read green | FIXED: `sh-cdone` and `sh-stripe` |
| E6 | MED | On a short screen the tabs stood below the fold; a tab pressed redrew panels out of sight | FIXED: the head, disclaimer and tabs stand over a scrolled part; a tab brings its panels into sight; short and wide layouts |
| E7 | MED | On a narrow profile card the effect picker stood far under the stage it tries choices on | FIXED: the stage first, the picker under it; the window keeps no scroll anchor, which, chosen in markup order, moved a row from under the pointer as its choice's words grew |
| E8 | MED | A locked effect never said how it is had | FIXED: each effect's words of how, read off the wares and the season's law |
| E9 | LOW | The pass track's rows were named only in a legend, its overflow had no sign, the player's place was unmarked, a cell said nothing to a screen reader | FIXED: the rows named at the left as it scrolls, the last reward reached marked and scrolled to, a padlock on a locked cell, each cell said whole |
| E10 | LOW | The challenges' meters stood ragged, each row its own grid | FIXED: one set of columns |
| E11 | LOW | The window wiped the kit's ground with its own | FIXED by E1 |
| E12 | LOW | A held or spent ware kept its price at full weight | FIXED: dimmed under its state |
| E13 | LOW | For less motion the Pause press stood disabled | FIXED: hidden |
| E14 | LOW | The first slide slid in on opening | FIXED: on a turn alone |
| E15 | LOW | A long title in a bundle's tile shrank past reading | FIXED: never under 11 px; a long one wraps |
| E16 | LOW | Every stage started on opening, and the carousel turned out of sight | FIXED: a stage starts in sight; the carousel stops scrolled away |

### P - the owner's word on the pictures and the prices

The owner, 2026-10-29: **"the glyphs for the horse and the general art of those icons is so bad. Plus the most expensive
anything should be is $30"**. Pins: `storefront_badges.test.js`, `shop_service.test.js`, `aurum_law.test.js`.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| P1 | HIGH | The effect emblems were flat line glyphs on a dark disc, the horses a stiff profile that ran past the rim | FIXED: all twelve drawn by the profile icons' engine (`profileIcons.js` drawnIconNode) - a bezel, a shaded field, modelled relief, motion that stops for less; the horses one head inside the rim; the daily wares' medallions on the same bezel |
| P2 | HIGH | The Deluxe Pass, three effects, all four bundles and the largest Aurum pack cost over $30 (the Lord of Oblivion $119.99) | FIXED: every price about half the sheet's and under `SHOP_PRICE_CAP`, the tiers kept (`Storefront.md` section 2); a pin holds every ware to it |
| P3 | LOW | The Dawnbringer cost 400 Aurum, more than its $3.99 buys at the smallest pack's rate - no pin held a daily ware under its money | FIXED: 300; a pin holds each daily ware sold for money to between three quarters of its money and its money |

## Known, and not changed

- A concealed peer who is struck still shows the hit's splash at their body (lane C): a blow lands only on someone
  found, so the splash tells no more than the blow did. C1 is the mount's beat alone.
- A bridle drawn in the horse's black takes the look's shade with the mane: across the hide it is drawn as the shading
  is, a dark band, and a rule that spared it blacked the small sprites' shading (V6; Storefront.md section 7).
- A few horse pixels that every other set's rider covers keep the coat's colour under a look: no set shows them, so
  none can say they are the horse's (V10; trusting one set's word brought the riders' skin back).
- A kill past 45 m of its killer is told to nobody (E5): peers refuse it under E1's tie, and a reach a shot's length
  would let a peer lay effects in anyone's face again.
- A blow's fields (`hk`, `hp`) still ride every pose, as PEERFX1 made them: dropping `hk` would read to the lone sleep as
  a fight's end.
- "Others' effects" gates the kill effects and the mount looks, not the portal skins: its note names those two.
- `tools/storefrontProbe.mjs` reads the carousel's first slide after the window loads; on a machine slow enough that
  the carousel turns first, its arrow check fails though the arrow steps exactly one.
