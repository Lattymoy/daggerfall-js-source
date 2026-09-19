# public/sfx — where these came from

The gun lab’s shooting and reloading sounds. Every file here is
**CC0** (public domain) from [Freesound](https://freesound.org), found with
`tools/freesoundPick.mjs` and baked to Daggerfall’s own format —
11025 Hz unsigned 8-bit mono, DAGGER.SND’s parameters
(`src/formats/sndFile.js`) — by `tools/sndify.mjs`. Re-run
`tools/gunSfxInstall.mjs` to rebuild them from the same sources.

The `*-synth.wav` files are ours outright: `tools/gunSfx.mjs` builds them
from noise and sine through the same bake, deterministically.

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
