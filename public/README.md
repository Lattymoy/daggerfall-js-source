# public/ — the port's OWN assets

Vite serves this directory at the site root, so `public/logo.png` is
fetched as `logo.png`.

Nothing here is game data - and AUDIT 21 found that sentence FALSE, so it
is now enforced rather than asserted. Fourteen before/after gallery frames
lived under `public/visual-changes/`, twelve of them carrying classic
`WEAPON*.CIF` sprites upscaled onto the probe's magenta clear, and because
Vite serves this directory verbatim every one of them shipped to GitHub
Pages. A RENDER OF GAME DATA IS GAME DATA: the galleries are generated
locally by `tools/fpsWeaponProbe.mjs` - the probe that draws the real
`WEAPON*.CIF` overlay, silver and steel frames included - and they are
gitignored, so they do not live here.
`test/doctrine.test.js` fails the suite if a tracked file under `public/`
is not on the allow-list below.

Port-Doctrine keeps ARENA2 out of the repo permanently: the readers load the user's own files at runtime (dev via
the vite middleware in `vite.config.js`, production via the folder
picker persisted in IndexedDB). What lives here is artwork that is
*ours*, which is a different thing entirely and does ship with the
build.

## logo.png — the title screen (U21c)

`src/ui/titleScreen.js` draws this ahead of the main menu. It is the
port's own branding, in the slot classic fills with TITL00I0.IMG —
which DFU does not draw either, having replaced classic's title with
its own. Recorded in Port-Ledger section A.

Any size or aspect works: `logoRect` centres it, preserves its aspect
against both axes and caps it at 86% of the canvas. Alpha is a 1-bit
cutout, not a blend — `drawScreenQuad` discards texels under 0.5 alpha,
which is the port's law for every screen quad — so a soft-edged logo
hardens at that threshold. A fully opaque banner is unaffected.

**The file is optional and its absence is not an error** — and today it
is absent, so the fallback is what you actually see. When `logo.png` is
missing the title screen draws CLASSIC's own title, `TITL00I0.IMG`,
straight out of the user's ARENA2 at runtime. Nothing to ship, nothing
to install, and it swaps to ours the moment the file lands. If neither
is available the boot goes straight to the menu: a missing asset costs
a splash, never a game. `node tools/titleProbe.mjs` shoots both arms.
