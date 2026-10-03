# Daggerfall Online

**Daggerfall Online** - an open-source reimplementation of The Elder Scrolls
II: Daggerfall. Data layer and game logic translated from Daggerfall Unity
(MIT, Interkarma and contributors); presentation rebuilt on hand-rolled WebGL2.
MIT licensed, with Daggerfall Unity's notice alongside (LICENSE). The project's
working name in the docs and the code is `project-dagger`, and the repository,
the live domain and the desktop app's identifier still carry the old
`daggerfall-js` spelling - renaming those is a move outside this tree (BR1).

Play it: https://daggerfalljs.dev/

The site is `index.html` (what it is, how to play, credits); the game is
`play/index.html`, served at `/play/`. Both deploy from `main` to GitHub
Pages. The landing page takes its palette and fonts from the enhanced skin
at build (`scripts/landingHtml.mjs`) and carries no game data or imagery.

Docs live in `bible/` - start at `bible/Home.md`.

Original game data (ARENA2) is required and never committed. Point tests at it
with `ARENA2_PATH`.

## Support development

Daggerfall Online is free and open source. Active development currently
costs about **$600 per month** to sustain across development tooling,
multiplayer infrastructure, testing, builds, releases, and mod compatibility
work.

Support on Patreon: https://www.patreon.com/c/dfenhanced

The monthly goal, suggested support levels, and funding breakdown are in
[`SUPPORT.md`](SUPPORT.md). Sponsorship does not lock gameplay, source code,
or normal releases behind a paywall.

## Scripts

- `npm run dev` - Vite dev server
- `npm test` - Node test runner
- `npm run build` - production build
- `npm run lint` - eslint over `src/` (no-undef, no-dupe-keys, ...)
- `npm run check` - lint + test + build (pre-push gate)
- `npm run cites [-- --apply]` - re-resolve line cites into files you changed (tools/citeShift.mjs)
- `npm run shot [out.png]` - headless render proof (needs ARENA2_PATH + provisioned Chromium)
- `node tools/landingProbe.mjs` - the landing page and `/play/` in a real browser, no ARENA2 needed
- `node tools/verify-deploy.mjs` - after a push: proves the live `/play/` serves your commit

## Desktop app

`app/` is the downloadable build: an Electron shell that loads the
same `dist/` the website deploys and adds what a browser can't -
**saves as real files** (DFU's own layout: `Saves/SAVE<n>/SaveData.txt`
+ `SaveInfo.txt` + `Screenshot.jpg`, settings under `Prefs/`) and
**ARENA2 read straight from your folder on disk** (found for you on
first run, or picked once - no ingest, no diet, full sky sets). The browser build
is unchanged; the storage seam is `src/systems/appStorage.js`.

```
npm run build && cd app && npm install && npm start
```

The app opens on a **launcher** (`app/launcher/`), the game's front
door: the latest patch notes (what came since you last played marked
NEW), your game files, saves and update settings, and a big **Play**. It
checks for an update and installs it before you play (the Windows
`-setup` install and the Linux AppImage replace themselves; macOS and
the portable exe are offered their own download), and on first run finds
Daggerfall - on Steam, GOG, in Daggerfall Unity's settings, or an
unpacked DaggerfallGameFiles.zip. An update that lands mid-session is
told in the game and waits under File > Restart to Update (on macOS and
the portable exe, File > Download v...).

`npm run dist` in `app/` packages installers. Every push to main
builds them for all three OSes and publishes them as ONE GitHub Release
(`.github/workflows/release-desktop.yml`: staged as a draft, published
whole once every OS built) at `app-v<major>.<minor>.<commit count>` -
the version is derived from the commit, never bumped by hand - with the
`## Patch notes` of every pull request it brings as its notes (written in
the PR description, never as a file in the tree). The files carry no version in
their names, so `releases/latest/download/DaggerfallOnline-win-x64-setup.exe`
(and `-mac-arm64.dmg`, `-linux-x86_64.AppImage`) is always the newest,
and the landing page links each directly. Pushing a tag shaped `app-v*`
cuts one by hand. Details
in `bible/01-Overview/Desktop-App.md`; headless proof:
`xvfb-run -a node tools/appShellProbe.mjs` (point `DAGGER_SHELL_EXE`
at a packaged binary to prove an installer's payload). The packaged
app bundles NO game data - same doctrine as the site.
