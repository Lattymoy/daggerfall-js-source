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
| `spell-heal.wav` | heal impact | `02_Heal_02.wav`, supplied by the project owner (2026-10-05) | TO FILL IN | TO FILL IN | the heal the player picked as perfect, softened and smoothed; kept at 22050 Hz 16-bit so its shimmer survives |
