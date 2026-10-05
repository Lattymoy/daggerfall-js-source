# AUDIT PRE-MERGE 0929 - PR 418 read before it merges, 2026-09-29

Mac: *"Audit this"*, of PR 418 (`claude/discord-link-update-wa7ur0`) as it stood green and waiting at `0b778974`: TERMS1
(the Terms of Service and the Privacy Policy, ticked before an account exists), the DISC29 Discord batch (A-H), SWING-LAW
(the player's swing) and WB8 (the Oblivion Gate's Warden - never swayed, marked every gate, and in more detail), with
main merged in six times on the way (#413-#427, #416). Seven lenses read it, the branch against `origin/main`, each over
a frozen tree (Home.md, 17l - the fixes were made in a worktree of their own until the last lens had reported, then
brought over whole), each reproducing what it reported with the repo's own code:

- **T** TERMS1 - every route that makes an account, the deploy's own calls, the form on a real browser, the build;
- **D** DISC29 A, B, D, F and H - the walk-on pass on every collision-trigger object in BLOCKS.BSA, the rarity names
  across a load, the draw watchdog, the gallop, Info mode;
- **E** DISC29-E - the lamps' shadows on the real ShadowPass (a fake GL, and headless Chromium for the programs);
- **S** SWING-LAW - every clock the player's swing is read by, on the real rig;
- **W1** WB8, the relay's half - the draw, the brain, the wire, the checkpoint, on the real Room;
- **W2** WB8, the client's half - the court, the strike, the bar, the sways;
- **M** the merges - every line the branch differs from main by, against the lines its own commits wrote.

Every finding below was checked against the code before it was fixed, pinned by a test that FAILED on the unfixed tree
for the finding's reason, and mutation-proven: `tools/mutants/audit0929_terms.json` 14, `audit0929_gate.json` 11,
`audit0929_actions.json` 11, `audit0929_render.json` 4, `audit0929_swing.json` 8 - all 48 dead. Each fix carries an
`AUDIT PRE-MERGE 0929 <ID>` comment.

## Fixed

**TERMS1** (`.github/workflows/account-deploy.yml`, `.github/workflows/deploy.yml`, `server-account/src/accounts.js`,
`src/net/accountClient.js`, `src/ui/enhancedAccount.js`; the pins in `test/audit0929_terms.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T-CI | high | THE ACCOUNT DEPLOY WOULD HAVE GONE RED THE MOMENT ITS WORKER WENT LIVE, and stayed so. Its own checks open a throwaway guest (the gate's half) and name one (a password route on the platform) with `{"label":"deploy-smoke"}` alone - TERMS1 refuses both with 400 `terms-unaccepted`, `curl -f` exits, and every check after it (the gate's public half, a registration on Cloudflare - the PBKDF2 outage's own detector - the public key, the relay's copy of it) never ran on this deploy or any after it. No test read those calls. | The smoke agrees as a player does: one step reads TERMS_VERSION and PRIVACY_VERSION off `src/net/legalLaw.js` (never typed) into the job's environment, and all three calls send them. The pin runs the step and every body through bash. |
| T1 | med | A game from before the boxes - every shipped build, and the desktop app's bundled copy until it is updated - sent no versions, was answered `terms-unaccepted`, a word it has no sentence for, and said "The account service had a problem. Try again." at every press, for ever (the desktop app's reload brings back the same game). | A request that names neither document is answered `not-found`, which every shipped build renders "The game may need updating" - the truth; the form itself never sends one (its own check stops a press with a box unticked). `terms-stale` says "Reload the game (or update the app)". |
| T2 | med | The site's deploy waited for nothing: live before the account service, the new form ticked both boxes against the old Worker, which named the account and recorded no agreement - a row that says "never asked" for a player who agreed - and the account job itself waits up to twenty minutes on the relay, or deploys nothing. The PR said "a minute or two". | `deploy.yml` publishes only once the account service's `/v1/health` serves the version the tree names (or a later one), up to thirty minutes, and not at all if it never does - AUDIT B1's law, the account service's own for the relay. A push that changed no account behaviour finds it served: one request. |
| T3 | med | The card's redraw took the keyboard: a refusal is cleared by the first keystroke or tick that answers it, and that repaint rebuilt the card under the player's fingers - after "Type your username" the rest of "Nystul" went nowhere but its N, and a Space on the Terms box (the one answer its refusal has) left the next Tab on Username (pre-existing since ACC1e for the fields; TERMS1 made it every tick). | Every control is built under a name, and the one the keyboard was on - with its caret - has it back after the redraw, on a card of the same stage; one the redraw disabled (a button while its press is out) gets it back when the card after has it again. Real Chromium: "Nystul" whole, the box kept, Tab on to its link. |
| T4 | low | Two comments said what the code does not: the route table's `POST /v1/auth/guest { label? }` (that body is refused), and legalLaw.js's "a relative link would open nothing" in the desktop app (it opens the bundled copy in a window of the app). | Corrected; the absolute URL stays, for the live text. |

**DISC29 A and B** (`src/world/actionSystem.js`, `src/player/collider.js`, `src/scenes/dungeonContext.js`,
`src/player/motor.js`, `src/systems/save.js`; the pins in `test/audit0929_actions.test.js`, `test/disc29_throne.test.js`,
`test/disc29_rarity.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | high | DISC29-A's standing ray missed stairs, steep ramps and a seat between arms: DFU's WalkOn is the contact's DIRECTION from the controller's centre (`dir.y < -0.9`, DaggerfallActionCollision.cs:68-71, every flag) and the ray (:74-85) only Collision01's second test - the port read "beneath" as "within 0.15 of the box's top" and added a ray under the capsule's centre, where a body on a staircase rides the treads' edges. N0000007's Hurt22 staircase (in 69 dungeons) bit 2 times walking all sixteen steps down, 4 up. | OnCharacterCollided whole (`actionContact`): the contact is the collider's (`capsuleContact`, the nearest point of the object's own triangles within the skin of the chain the motor resolves the capsule as), beneath is WalkOn for every flag, a Collision01 casts its ray, else WalkInto; a box touched with nothing of the object touched hears nothing. Every collision-trigger model's triangles in `triggerSurfaces`. The staircase: 9 bites down, 13 up. |
| D2 | high | PRE-EXISTING, kept by DISC29-A and called harmless: standing on a MultiTrigger, Collision03 or Collision09 object was WalkInto, and fired - Orsinium's castle floor (S0000020 object 10406, a DoorText with a trespass on it) turned the castle hostile at the first steps across it; 51 trespass DoorTexts in Orsinium, Wayrest and Castle Daggerfall, the Mantellan Crux's ten movers, Castle Daggerfall's seven CastSpell corridor pieces. | D1's contact: a floor is beneath, WalkOn, refused. And a side is heard only while the body moves INTO it (the pass hands the contact the direction the body presses - the motor's own sin and cos of forward and strafe, from the yaw the motor moved it by - its own word, `moveYaw`, in the one motion bag), as a ControllerColliderHit only comes of a Move into its collider: walking along a wall bumps nothing. Over the 1,546 resting spots of BLOCKS.BSA the port now agrees with DFU on 1,537 (983 before); the nine left are a lip or an arm beside the body, where DFU's answer too depends on which way the body moves. |
| D3 | low | The load's rarity-name repair (and DISC21-A's condition repair beside it) walked the pack, the wagon and the repairer's alone: a piece kept in a house chest, a dropped pile, a dead foe's pack or a boat's hold loaded with the name its make had lost, and kept it once carried out. | One walk: every list of the character's own things the save carries (`net/realmGoldLaw.js stashedItemLists`, customs' own), repaired in the save before the scene cache is restored from it and before the world and the mods' data go back to their hosts. |

**DISC29-E** (`src/render/shadowPass.js`, `src/render/renderer.js`, `src/render/contract.js`; the pins in
`test/disc29_lamps.test.js`, `test/lightnear1.test.js`, `test/hard3_types.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | high | "Animating in place" was a flat whose place had been still for a second - every flat an origin places: a dungeon foe, a peer, the Warden, the moment it stood. The lo tier's maps are rebuilt two faces a frame, nearest the eye first, so each time one walked on, the lamps outside the eight - the maps they read - kept its silhouette where it had stood: a ghost on 4.7% of the frames of a fight of three under fourteen lamps, 49% under thirty with six; every stop and start rebuilt every lo map in its reach (+20% script time). Main: none. | Only a flat that cannot walk - its centre baked into its vertices, no origin - is in place; a flat an origin places stays the eight's, as before DISC29-E. `_shPlacedAt` has no reader and is gone (39 fields a batch). |
| E2 | low | Finding the player's card walked every batch of every record, every frame, lamp or none (5.7 us of the pass's 7.6 over two thousand batches). | recordBillboards notes it as it passes it; the lamps read it only when one casts. |
| E3 | low | The card's two lamps were ranked among the eight nearest the EYE: with the camera 4 m or more away (the setting runs to 10) the lamps nearest a still player were often not casters, and his silhouette still hopped as the camera circled (MAGEAA00: 12 of 39 spots at 6 m). | The two casting lights nearest the card, by the pick's own measure and DISC6's hold, are made casters (`reserveSelfCasters`), each in place of the eye's farthest pick. |

**SWING-LAW** (`src/player/eotbBody.js`, `src/combat/weaponRig.js`, `src/combat/swingLaw.js`, `src/systems/rrRealism.js`,
`src/systems/rrInstall.js`, `src/characters/weaponStates.js`; the pins in `test/audit0929_swing.test.js`,
`test/rr1_realism.test.js`, `test/swinglaw.test.js`, `test/disc28_speed.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | high | The report's own werewolf clawed two and three times a claw blow on the Eye of the Beholder body (on by default), where every peer saw one: the IL polls IsAttacking and starts a clip whenever none plays, the claws' clip is its fixed 0.375 s, and a SWING-LAW claw blow is 0.54 s at the least; a melee clip's frame rounding left a phantom second one too. | ONE SWING A BLOW: the rig says which blow it is in (`swingN`, MAC7's count), and a blow's melee or claw clip starts once; a new rig's count starts over. A bow keeps the IL's poll. |
| S3 | low | With Roleplay & Realism's weaponSpeed answering alone, the weapon's weight counted nowhere: a 2 kg shortsword, a 4.5 kg longsword and a 5 kg broadsword all swung at 0.995 s - heavy blades quicker than with no mod. | The blend is the Speed; the heft is the port's (`swingHeft`, the weapon's base weight against the Strength) - weight counted once in every configuration (Items' weaponBalance has its own). |
| S5 | low | The reader of the weapon in the hand was registered by one boot call (ensureAudio): a rig built without it swung with no weight and no second hand. | `combat/swingLaw.js` registers it as it loads, and `combat/weaponRig.js` - the one maker of a swing's ctx - imports it. DISC28-D's first-person pins run on the weapon as the rig builds it. |
| S6 | low | The reader asked for the hand through `equipTableOf`, which grows an empty equip table on a body that has none - a reader that wrote. A rig whose body had none (a suite's, a probe's) had its hand emptied by its own syncWorn the next frame, and the unsheathe went silent: the rig's shieldItem names the same trap. The rig suite found it once S5 put the reader in every rig. | The reader reads the table the way syncWorn does (`entity.equip?.slots`) and writes nothing. |
| S2, S4 | low | The handling table said "Dagger (and the tanto)" (DFU draws the tanto as a long blade) and that a staff "sweeps a little quicker" (every staff is two-handed: quicker than the other two-handers, not than a sword); the record's saber row gave 0.83 s mods off at Strength 50 (0.92 there - 0.83 from 56 up), and the PR's warhammer row left out the Strength. | The words corrected. |

**WB8** (`src/net/gateBrain.js`, `src/net/gateMods.js`, `src/net/wire.js`, `src/net/gateLink.js`, `src/scenes/gateCourt.js`,
`src/ui/gateBossBar.js`, `src/systems/gateOmen.js`, `src/net/gateLaw.js`; the pins in `test/audit0929_gate.test.js`,
`test/wb8b_gate_marks.test.js`, `test/wb8c_gate_detail.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1-1 | high | A SOUL-HUNGRY WARDEN HEALED BY THROWAWAY GUESTS, FOR GOOD. A fall is the fighter's own word (the pose's `dd`), and it fed him 3% of his WHOLE health - more than the fallen brought - and outlived that fighter's share (AUDIT WBX R1's "a share leaves with its fighter"): twenty-five guests that said `in` dead and went took him from a fifth to all but full, on 28 of every 112 gates. | Only a fall with a real part behind it feeds him (`hasPart`, AUDIT WBX R2's bar: the blows or the time a seat is kept by), and no more than GATE_FEEDS_MAX (5) feedings a fight, however many accounts come. The same twenty-five now feed him nothing. |
| W1-2, W2-1 | high | A COLOSSAL WARDEN CLEAVED AIR ALL PHASE ONE. The Cleave is chosen at a gap of its range past his body, and Colossal grows the body (2.25 m) and not the cone (9 m from his centre): a fighter standing 9.0-9.25 m off was cleaved at 39 times in two minutes and struck by none, and he never walked in (24 of 112 gates; a quarter of all walk-ins stopped in the band). | A cone reaches from his body as far past it as it ever did (9.45 m under Colossal); R3's law is pinned for every one of the 112 sets. |
| W1-3 | low | Two challengers who fell in one beat were two `fed` words with one moment, and the court said the first name alone. | One word a beat, naming every one (`ns`): "feeds on the souls of Ann and Bran". |
| W2-2 | low | The profile was cached and finding it was not: every call copied and read the marks and joined a key (~1.9 KB), and the court asks every frame - a marked court's frame made 8.9 KB of garbage to an unmarked one's 2.5; the card's marks line was worded every exterior frame a gate stood. | The profile is kept by its marks array (a WeakMap - the fight's and the fold's stand as long as their states); its trials line is joined once on the profile; the card's marks line once a day. |
| W2-3 | low | A feeding heard late was said, and growled, whenever an earlier one had been heard this entry - "first of the entry" stood in for "stale". | Judged by its age alone (`FED_LATE_MS`). |
| W1-4 | low | "Every four gates bring all four aspects and all eight trials" is true of each ROUND (gates 4k to 4k+3), not of any four running (and could not be of 112 different sets); "a pair comes back every 28 gates" - 25 is the least. | The words corrected. |

**The merges** (`test/relayversion.test.js`, `src/net/wire.js`, fourteen version pins, `bible/06-Systems/Online-Arc.md`,
`server-account/src/service.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| M1 | low | The merge of #416 dropped main's revert note from the relay law's world125 row - Mac's own words, "Do not merge voice chat". | Restored. |
| M2 | med | The branch's record said world125 "was reverted on main before it deployed" - in wire.js's RELAY_VERSION, fourteen suites' version pins, Online-Arc and the PR. It deployed: relay-deploy run 265 (PR #427's merge, 22:59 UTC) ran its Deploy and its /health check, and run 266 (#416's merge, 23:39) put world124's bytes back. | Every one says so. |
| M3 | low | The account service's version history carried a double full stop of this branch's, and - main's own merge's - the acct16-acct9 history twice with "Main's acct18: acct18:" between. | One history, acct20 down to acct9, each once. |

Everything else the merges met is what the branch's own commits wrote: of the 317 files that differ from main, the lines
no feature commit explains are the renumbered migration, the account suites ticking the boxes and the version pins.

## What the whole suite and the re-run found

With every lens's fix in, the whole suite and a re-run of every committed mutant record on a file the audit changed
(2,264 records) found what the lenses had not:

- **S6** (above): `test/weaponrig.test.js`'s silent drag went silent in the wrong place - the swing law's reader had
  grown an equip table on the rig's bare body, and the unsheathe lost its sound.
- D2's press first rode a second argument at the dungeon lanes' two `motionBagOf` calls, and five older pins of the
  one motion bag (WW1, WW2, MW-D39, PX26 F4) failed: they hold that every host reads the bag as `motionBagOf(player)`,
  so no host can hand the rig a partial one. They were right about the home. The yaw is the motor's own word now
  (`moveYaw`, written beside moveForward and moveStrafe as it moves), the bag carries it, and every host call is
  `motionBagOf(player)` again - no host can forget it. `test/disc21.test.js` reads the load's one walk (D3), and runs it
  now, over a house chest's dagger.
- Of the 2,264 records, 2,226 died and 17 stand equivalent as recorded. Nineteen no longer applied - the audit had moved
  their source - and were re-aimed by content, each at its law where it now stands. Two survived.
  `DISC29-E-card-in-place` was made equivalent by E1 - the player's card always has an origin, so `o == null` keeps it
  out of the lo tier - and is recorded so; the clause stays, DISC24-C's law said where the class is decided.
  `MWCROUCH-the-levitate-descent-takes-the-EDGE` survives on main too: its pin asked only whether a host read the held
  crouch anywhere, and dungeon.js and worldModes.js feed two descents (the motor's and Deep Waters' swim's). It holds
  every one now (`test/mwcrouch_edges.test.js`).
- The 19 re-aimed, the equivalence, MWCROUCH's and the 45 whose tests the whole suite had first caught red (their
  verdicts then said nothing) were judged again on a green baseline: 64 dead, the one equivalent standing.
- `tools/accountProbe.mjs` (`npm run account`, the Worker in a real workerd) still asked the bare request for
  `terms-unaccepted`: it asks T1's `not-found` now, and a body with one document ticked for `terms-unaccepted`. Its four
  records were judged again on a passing probe - all dead.

## Not faults

- **T:** no route makes or names an account without the current versions (createGuest is the only INSERT into players;
  guest and register ask first); the paths filter of the account deploy is exactly the Worker's import closure; the
  migration applies over 0001-0021; a malformed agreement (numbers, objects, `__proto__`, 3,000 characters) writes
  nothing; the documents build and serve with no script; the desktop app hands only http(s) links to the system browser.
- **D:** WalkOn fires once a 0.12 s window while a move key is held, as the C# does; `triggerSurfaces` is the context's own
  and keyed per block instance; the repair is idempotent and skips legendaries, artifacts and renamed pieces; the draw
  watchdog releases nothing still drawn; every transport-mode write goes through mountRig.setMode; Info mode now returns
  before the click, for people and items, as PlayerActivate does.
- **E:** uFacePoint is the shadow program's alone (no program shares BB_VS's uniforms; the main pass reads its link-time
  default); every batch mints its fields in one literal (one hidden class); first person "Shadows Only", no card, one lamp
  and none all take the right path.
- **S:** the machine, the Weapon Widget and the AttackMelee clip ask one law with one ctx; the hit, fatigue, skill and wire
  clocks are the machine's events; the mods apply once; the bounds hold on every path; two-handed detection is DFU's
  GetItemHands; the bow, the Thunderlock and spellcasting keep their own clocks.
- **W1:** one set per 2-hour gate (gateModsOf is indexed by the game day, which is two real hours): 61 distinct sets in
  five real days; the cycle's claims hold across its wrap and at any base; the profile is a pure function of the marks;
  md, the feedings and a pending echo survive a checkpoint, and a pre-WB8 checkpoint reads unmarked on both ends; the
  echo never echoes and is cleared by a turn and the Wrath; every attack stays escapable under all 112 sets.
- **W2:** every sway reaches his one door (touch, missiles, both areas, Cast When Used and Strikes); the saving throw by
  element is DFU's SavingThrow (fire, frost, shock, poison as DiseaseOrPoison); no damage path still assumes fire; every
  Colossal measure on the client reads the profile; no marks falls back to BASE_PROFILE whole.

## Not changed, and why

- **The acting flats keep the box.** DFU gives a flat's action a BoxCollider with `isTrigger` (RDBLayout.cs:977-987),
  which the port has always read as a box; D1/D2's contact is for the models, which have triangles. [FLAT-RELAY, FIELD
  BUGS 2026-10-05c: kept for the effects and the moving flats, lost for the RELAYS - `addRelay` never carried the flat's
  mark, so a flat Teleport (Collision03) walked into asked triangles it has none of and never fired: the "red brick"
  teleporters that only sometimes worked. It carries it now (`01-Overview/Field-Bugs-2026-10-05c.md`).]
- **The claws' clip keeps the IL's fixed tick.** S1 plays it once a blow; stretching it over the blow (a second departure
  from the IL) was left for Mac.
- **The nine direction-dependent spots** (D2): a lip or an arm beside the body, where DFU's hit order decides too.
- **E's four measured figures** (0.05% of lamp light through a wall, and the three that followed it) have no probe in the
  tree to re-measure them; they stand as measured at DISC29-E.
- **Info mode's 6.4 m reach** for people (D, pre-existing): DFU has no distance limit there.
- **The terms-stale case where the SERVICE is behind** cannot arise from the site now (T2); a desktop build ahead of
  the service still reads "reload or update".

## The deploy

The relay is world126 (undeployed; its row restated with the audit's bytes) - world128 at the merge with #428-#432, one relay past main's OW6L (world127), the two laws in one relay. The account service is acct20, migration
0023 (0022 until the merge with #428-#432, where main's CUSTOMS-CARRY holds it), and its deploy's smoke now agrees to the documents it serves. The site waits for the account service. Players
reload for the gate (GATE-RELOAD's words), and desktop players on a build from before TERMS1 are told to update.
