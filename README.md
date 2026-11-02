# DFO Online: open-source edition

This is the source of DFO Online as it stood on 2026-11-02. It is released under the MIT License (`LICENSE`), with
Daggerfall Unity's notice beside it. Work on DFO Online continues in a private repository.

DFO Online is an independent, unofficial project. It is not affiliated with or endorsed by Bethesda Softworks or
ZeniMax Media. The Elder Scrolls and Daggerfall are trademarks of ZeniMax Media Inc.

Play the live game at https://daggerfalljs.dev/.

## The desktop app

The desktop app's releases are published here, and installed copies update from them:
https://github.com/Lattymoy/daggerfall-js-source/releases

## Reporting a bug

Open an issue here. Report an exploit or a security problem privately, as `SECURITY.md` says.

## Building this edition

Node 20.19+ or 22.12+.

- `npm ci`
- `npm run dev`: the development server
- `npm run build`: a production build

The game reads your own copy of The Elder Scrolls II: Daggerfall (its `ARENA2` folder), which is never committed.
`sh tools/fetch-data.sh <folder>` downloads the free release of it into that folder.

This edition does not follow the live game, so its client may not connect to the live servers.
