# public/sfx — where these came from

The gun lab’s shooting and reloading sounds. Every file here is
**CC0** (public domain) from [Freesound](https://freesound.org), found with
`tools/freesoundPick.mjs` and baked to Daggerfall’s own format —
11025 Hz unsigned 8-bit mono, DAGGER.SND’s parameters
(`src/formats/sndFile.js`) — by `tools/sndify.mjs`. Re-run
`tools/gunSfxInstall.mjs` to rebuild them from the same sources.

The `*-synth.wav` files are ours outright: `tools/gunSfx.mjs` builds them
from noise and sine through the same bake, deterministically.

The `naval-*.wav` files are ours outright too: the sea fight's guns, strikes,
barrels, grapnels and gun carriages (bible/03-World/Naval-Combat.md), built by `tools/navalSfx.mjs`
from the same kit (`tools/sfxSynth.mjs`) and the same bake. DAGGER.SND has the
splashes, the bell and the fire the naval host also plays; it has no cannon.

The `climb-*.wav` files are ours outright as well: the climb's hands on stone,
boots on the wall, the haul over a sill, the rush of a leap and the grit coming
away (bible/03-World/Parkour-Arc.md, CLIMB4), built by `tools/climbSfx.mjs` from
the same kit and the same bake. DAGGER.SND has a body falling and the stride; it
has no hand on stone.

The `gather-*.wav` files are ours outright as well: the gathering professions' axe in a trunk, the tree's groan and its
fall, a pick on stone and on ore, a vein's rubble, hands among leaves, a herb pulled, the knife through hide, the net
thrown, landing, tugged and hauled, and the chimes of a clean finish and a rank (bible/06-Systems/Professions-Arc.md
section 44, GATHER-FEEL), built by `tools/gatherSfx.mjs` from the same kit and the same bake. DAGGER.SND has hits, a
parry, a splash and a lock's click, which the acts borrowed; it has no axe in wood, no pick on stone, no leaves and no
tree coming down.

The `spell-heal.wav` file is the heal spell's landing (IMPACTFX, HEAL-FILE): the project owner's chosen heal sound
(`02_Heal_02.wav`), softened for the game - its top tilted down 4.5 dB from 4.5 kHz and rolled off over 9 kHz, a soft
diffuse bloom mixed under it, its sparkle's flicker evened out with a slow 3:1 compressor, a 25 ms fade in and a
450 ms fade out. It is kept at **22050 Hz 16-bit mono** rather than baked to 11025 Hz 8-bit: 84% of its energy lies
over 5 kHz, which DAGGER.SND's format cannot hold. **Source and license: to be filled in by the owner before merge.**

| file | slot | source | by | license | why |
| --- | --- | --- | --- | --- | --- |
| `fire-shotgun.wav` | fire | [Shotgun Shot 03.wav](https://freesound.org/people/LilMati/sounds/473846/) | LilMati | CC0 | a 6ms transient - the cleanest crack in the set, and the reason it is the default |
| `fire-20gauge.wav` | fire | [20 gauge shotgun gunshot](https://freesound.org/people/michorvath/sounds/427595/) | michorvath | CC0 | a real 20-gauge, and the most trusted file on the site (4.7 from 116 ratings, 12k downloads) |
| `fire-musket.wav` | fire | [Musket Explosion](https://freesound.org/people/Willlewis/sounds/244345/) | Willlewis | CC0 | black powder - the most Elder Scrolls thing here; slow, huge, and it wants the big room |
| `fire-blast.wav` | fire | [shotgun shoot](https://freesound.org/people/MrGungus/sounds/773873/) | MrGungus | CC0 | short tail and a 25dB crest: the one to use if the trigger is held |
| `fire-dry.wav` | fire | [Shotgun Shot sfx](https://freesound.org/people/lumikon/sounds/564480/) | lumikon | CC0 | drier and closer - no room on it at all, for when the lab’s own room does the work |
| `open-winchester.wav` | reload-open | [Winchester Rifle Cock Reload.wav](https://freesound.org/people/SpliceSound/sounds/153560/) | SpliceSound | CC0 | a lever cocking: two events, hard and wooden, and it ends |
| `open-rack.wav` | reload-open | [SXP_SHOTGUN_RACK_01](https://freesound.org/people/dasBUTCHER84/sounds/449614/) | dasBUTCHER84 | CC0 | a clean shotgun rack, dark enough to survive the bake whole |
| `open-gunrack.wav` | reload-open | [GunRack3.mp3](https://freesound.org/people/AKkingStudio/sounds/679878/) | AKkingStudio | CC0 | the darkest of the racks (914Hz) - the most Daggerfall-sounding of them |
| `open-shell.wav` | reload-open | [shell load.ogg](https://freesound.org/people/CeebFrack/sounds/108793/) | CeebFrack | CC0 | the shell itself going in, if the break should be quieter than the lock-up |
| `close-ready.wav` | reload-close | [Shotgun, Ready 01.wav](https://freesound.org/people/LilMati/sounds/383933/) | LilMati | CC0 | 30ms of tail and a 26dB crest: it stops dead, which is what "ready" sounds like |
| `close-rack2.wav` | reload-close | [SXP_SHOTGUN_RACK_02](https://freesound.org/people/dasBUTCHER84/sounds/449613/) | dasBUTCHER84 | CC0 | the rack’s second half, for a pair that matches its opening |
| `close-rack3.wav` | reload-close | [SXP_SHOTGUN_RACK_03](https://freesound.org/people/dasBUTCHER84/sounds/449612/) | dasBUTCHER84 | CC0 | the same, a shade brighter |
| `close-shell.wav` | reload-close | [shell load.ogg](https://freesound.org/people/CeebFrack/sounds/108793/) | CeebFrack | CC0 | the shell home, for a break-action that closes softly |
| `gun-fire-synth.wav` | fire | `tools/gunSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - nothing recorded, nothing to attribute |
| `gun-reload-open-synth.wav` | reload-open | `tools/gunSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - nothing recorded, nothing to attribute |
| `gun-reload-close-synth.wav` | reload-close | `tools/gunSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - nothing recorded, nothing to attribute |
| `naval-cannon.wav` | naval: cannon | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a long gun near: crack, a body falling 2.4 kHz to 180 Hz, a 75 to 34 Hz thump, and a roll over open water with its slap back |
| `naval-cannon-far.wav` | naval: cannon, past 260 m | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a broadside across the bay: the top gone in the air (all under 500 Hz), two thumps rolled together, a long rumble |
| `naval-swivel.wav` | naval: swivel gun | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the swivel on a rail: sharper, higher and shorter than a long gun |
| `naval-hit.wav` | naval: a ball strikes a hull | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the thud through the frames, the splinters (uneven ticks, loudest first), the timbers' groan |
| `naval-blast.wav` | naval: a fire barrel goes up | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the deepest thump in the set, a slow body, and the debris crackling down for a second and more |
| `naval-grapple.wav` | naval: grapnels thrown | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a rope's whoosh, two iron hooks biting a rail, the hawsers creaking taut |
| `naval-runout.wav` | naval: a battery running out (the tell before a broadside) | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - four gun carriages' trucks rumbling over the deck seams one after another, the tackles creaking, the carriages brought up hard against the sills (AUDIT NAV1) |
| `naval-ready.wav` | naval: a battery of the player's loaded and ready | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the rammer's head rapped twice on the muzzle, then the gun captain's iron tapped on the breech: a small bright ring (AUDIT NAV1) |
| `naval-sinking.wav` | naval: a ship going down (a loop) | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the sea rushing into her, her timbers groaning, the air leaving her in bubbles; its tail crossfaded into its head so it loops (AUDIT NAV1) |
| `naval-whistle.wav` | naval: a ball going by close (COMBAT-FEEL NEAR-MISS) | `tools/navalSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the air a ball tears going by: a rush through a narrow band that falls as it passes (its Doppler), swelling to its nearest and gone just after, a faint tone riding it |
| `climb-grab-1.wav` | climb: a hand takes a lip | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a palm's slap on stone (1.3 kHz), the fingers' knock under it, the grip tightening (a short rough rub), a little grit coming away (CLIMB4) |
| `climb-grab-2.wav` | climb: a hand takes a lip (the other) | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a darker palm (1.1 kHz) and a lower knock - two, so no grab is the one just heard (CLIMB4) |
| `climb-catch.wav` | climb: both hands catch a lip with the body's weight | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - two slaps a hand's beat apart, the body meeting the wall (120 to 60 Hz) and the clothes taking it, the boots scuffing for the face, grit pattering down (CLIMB4) |
| `climb-step-1.wav` | climb: hand over hand | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a lighter slap, a smaller knock, a breath of rub and two or three grains of grit (CLIMB4) |
| `climb-step-2.wav` | climb: hand over hand | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, darker - three, so a climb's rhythm never repeats one sample (CLIMB4) |
| `climb-step-3.wav` | climb: hand over hand | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, brighter (CLIMB4) |
| `climb-scrape-1.wav` | climb: boots scrabbling | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - three scuffs on stone, each a rough rub through a leather band with the grit's band over it, the last ending in the toe's knock (CLIMB4) |
| `climb-scrape-2.wav` | climb: boots scrabbling (the other) | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a lower leather band (CLIMB4) |
| `climb-pull.wav` | climb: the haul over a lip | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the leathers stretching (a swelling rustle with a flutter in it), the body sliding over the stone edge, a buckle's clink, a knee set down on top (CLIMB4) |
| `climb-whoosh.wav` | climb: a body through the air (a leap, the eject, a wall run) | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - wind through a band sweeping 350 to 1100 to 450 Hz, the clothes fluttering in it (CLIMB4) |
| `climb-crumble.wav` | climb: the grip failing | `tools/climbSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a dense crumble of grit, then four pebbles ticking down the wall away from the ear (each bounce quieter and duller), and the sand's hiss (CLIMB4) |
| `gather-swing-1.wav` | gathering: a tool swung (the axe) | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a heavy tool through the air before its blow: a band rising and falling with the swing over a low push (GATHER-FEEL) |
| `gather-swing-2.wav` | gathering: a tool swung (the other) | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, lower and a breath longer - two, so no swing is the one just heard (GATHER-FEEL) |
| `gather-chop-1.wav` | gathering: an axe bites a trunk | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the edge cracking on the bark, the bite through the fibres, the wood's own short note (four damped modes from 380 Hz), the trunk's weight, fibres tearing and chips landing (GATHER-FEEL) |
| `gather-chop-2.wav` | gathering: an axe bites a trunk | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a darker trunk (350 Hz) (GATHER-FEEL) |
| `gather-chop-3.wav` | gathering: an axe bites a trunk | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a brighter trunk (410 Hz) - three, so a tree's chops never repeat one sample (GATHER-FEEL) |
| `gather-chop-clean.wav` | gathering: a Clean Cut | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the chop fuller and longer-ringing, the chip splitting off, the whole tree taking it (GATHER-FEEL) |
| `gather-creak.wav` | gathering: the tree groans at half its chops | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a stick-slip train gliding from 70 to 40 pulses a second, ringing a trunk's bands (180, 410, 760, 1300 Hz), a fibre or two giving at its end (GATHER-FEEL) |
| `gather-fall.wav` | gathering: the tree comes down | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the hinge cracking over a groan, the crown's rush and its leaves louder to the ground, struck 1.5 s after the first crack (the felled tree lies flat then): the trunk's boom, the earth's thump, branches breaking, the bounce and the wood settling (GATHER-FEEL) |
| `gather-logs.wav` | gathering: logs gathered up | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - three or four hollow wooden knocks (GATHER-FEEL) |
| `gather-pick-1.wav` | gathering: a pick on stone | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the steel point's crack, the rock's brief ring, the pick head's own, chips flying and pebbles skittering, a breath of dust (GATHER-FEEL) |
| `gather-pick-2.wav` | gathering: a pick on stone | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a duller rock (GATHER-FEEL) |
| `gather-pick-3.wav` | gathering: a pick on stone | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a harder rock - three, so a vein's strikes never repeat one sample (GATHER-FEEL) |
| `gather-pick-glint.wav` | gathering: a strike on the glint | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the ore rings: a bright note that hangs (1960 Hz and its partials), two of them a breath apart so it shimmers (GATHER-FEEL) |
| `gather-rubble.wav` | gathering: a vein worked out | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the face cracking, chunks clonking down, grit and dust (GATHER-FEEL) |
| `gather-rustle-1.wav` | gathering: hands among the leaves | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - short grains through a leaf's band, a few louder, a knee among the stems (GATHER-FEEL) |
| `gather-rustle-2.wav` | gathering: hands among the leaves (the other) | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, a lower band and a little longer (GATHER-FEEL) |
| `gather-pluck.wav` | gathering: a herb pulled | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the hand closing on it, the stem's snap, the roots letting go, soil falling off them (GATHER-FEEL) |
| `gather-bruise.wav` | gathering: a herb bruised | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - leaves crunched soft and wet (GATHER-FEEL) |
| `gather-find.wav` | gathering: the Basket's find | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a stalk's tiny snap, and the wicker's hollow tock as it drops in (GATHER-FEEL) |
| `gather-sparkle.wav` | gathering: a glint shows | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - two soft high pings (GATHER-FEEL) |
| `gather-slice-1.wav` | gathering: the knife through hide | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a band rising under an uneven drag, a wet body under it (GATHER-FEEL) |
| `gather-slice-2.wav` | gathering: the knife through hide | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, lower (GATHER-FEEL) |
| `gather-slice-3.wav` | gathering: the knife through hide | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, higher - three, so a line's points never repeat one sample (GATHER-FEEL) |
| `gather-tear.wav` | gathering: the knife slips | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a ragged rip (GATHER-FEEL) |
| `gather-peel.wav` | gathering: the pelt comes away | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a long rip falling in pitch, and the pelt laid down wet (GATHER-FEEL) |
| `gather-throw.wav` | gathering: the net thrown | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a rush through the air with the mesh fluttering in it, the cord paying out (GATHER-FEEL) |
| `gather-net-land.wav` | gathering: the net lands on the water | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the mesh's slaps a few hundredths apart, the floats bobbing up, the water settling (GATHER-FEEL) |
| `gather-plip-1.wav` | gathering: the water by the floats | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a drop's plip (GATHER-FEEL) |
| `gather-plip-2.wav` | gathering: the water by the floats (the other) | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, higher (GATHER-FEEL) |
| `gather-tug.wav` | gathering: the floats dragged under | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a deep gulp in a splash (GATHER-FEEL) |
| `gather-thrash-1.wav` | gathering: the haul | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - fish fighting in the mesh, a tail's slap (GATHER-FEEL) |
| `gather-thrash-2.wav` | gathering: the haul (the other) | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - the same, another fight (GATHER-FEEL) |
| `gather-net-out.wav` | gathering: the net hauled in | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - water streaming off it, the catch flopping in the mesh (GATHER-FEEL) |
| `gather-clean.wav` | gathering: a clean finish | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - two soft bell notes a fourth apart (E6, A6) (GATHER-FEEL) |
| `gather-haul.wav` | gathering: the goods into the bag | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - a leather satchel's thump, its flap, the goods settling (GATHER-FEEL) |
| `gather-rank.wav` | gathering: a rank risen | `tools/gatherSfx.mjs` | ours | n/a | synthesised from noise and sine, deterministically - three bell notes rising (C6, E6, G6) and a fourth above them (GATHER-FEEL) |
| `spell-heal.wav` | heal impact | `02_Heal_02.wav`, supplied by the project owner (2026-10-05) | TO FILL IN | TO FILL IN | the heal the player picked as perfect, softened and smoothed; kept at 22050 Hz 16-bit so its shimmer survives |
