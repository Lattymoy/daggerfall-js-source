# The launcher's two faces - the brand's, on disk

The launcher (DA8, `app/launcher/`) is set in the same two faces as the
landing page and the Enhanced skin: **Jacquard 12** for the wordmark and
**Pixelify Sans** for everything else. The game and the site fetch them
from Google Fonts at run time; the launcher cannot, because it is the
window that runs *before* anything is known about the network - offline,
behind a proxy, on the first launch - and because the shell's own
network use stays what DA6 recorded: the update check and nothing else.

So the Latin subsets are shipped here, byte for byte as Google Fonts
serves them (the files `ENHANCED_FONTS_URL` resolves to for Latin text):

| file | face | source | sha256 |
| --- | --- | --- | --- |
| `Jacquard12-latin.woff2` | Jacquard 12, 400 | fonts.gstatic.com/s/jacquard12/v8/vm8ydRLuXETEweL79J4rGf3OWHs.woff2 | `41e240a6612fc41979467e614efb14ae2647a7cfb988cee032fdfcc3cd63cac5` |
| `PixelifySans-latin.woff2` | Pixelify Sans, variable 400-700 | fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9Jn0Eiw.woff2 | `4a5633a0c9c1b73abd133a56d3716c2d8df2ed03cb987346f72194aeb224f382` |

Both are licensed under the SIL Open Font License 1.1 - Jacquard 12
Copyright 2023 The Soft Type Project Authors (`OFL-Jacquard12.txt`),
Pixelify Sans Copyright 2021 The Pixelify Sans Project Authors
(`OFL-PixelifySans.txt`). The OFL permits bundling them with software;
they are not sold on their own and keep their names.

The digit five is Silkscreen's, as everywhere else in the brand (FIX-D,
`vendor/silkscreen-five/`): the launcher's stylesheet carries the same
520-byte data URI the landing page does, and
`test/tooling/da8_launcher.test.js` holds the two equal.
