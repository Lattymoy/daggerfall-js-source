# Wagons: timber, wheels & guild heraldry (`wagon-texture-add`)

Playtestable now via `npm run dev`. Everything below is on this branch, unpushed until you say go. One deploy when it ships: **relay first → account service → clients** (`world212`; `world207`/`world208` on the branch, never deployed, renumbered past main's `world207`-`world211` at the merge — still a single deploy).

## 1. Wood & wheel customization (in game now)

- The Stable card's wagon section has five new rows: **Floor, Inner, Beams, Bench, Wheels**. Each offers six choices as color swatches.
- Six woods (oak, pine, walnut, mahogany, ebony, ash) and six wheel finishes. Wood is dyed **over Daggerfall's grain** — the grain, knots and light survive; nothing is flat-filled.
- Your pick is saved on the wagon, is visible to other players online, and survives reloads.
- Rows are filtered per wagon type: carts don't show Bench (they have none), open wagons don't show Inner (no visible effect). Caravans are **completely untouched**.
- Cart paint colors were painting flat and wiping the grain — fixed, they now dye over the wood like everything else.

## 2. Guild heraldry on open wagons (in game now)

- An open wagon now wears **its owner's guild arms** on both sides.
- No guild → plain cloth, nothing overlaid. No fallback emblem, no invented arms.
- One new setting: **"Guild's Heraldry on Wagon by xarop_pa_toss"** (on by default), in Settings → World → Travel with the same segmented Off/On control as the neighboring rows. Off means your wagon shows plain cloth to everyone. There is deliberately no "hide other people's" option — if someone broadcasts, you see it.
- Other players' wagons resolve their guild's arms live; wagons you already see update without a reload. A guild that *changes* its arms mid-session rebuilds on the arms epoch — no reload (the pool's upload key carries the epoch, so the new arms paint over the old).

## 3. Under the hood (for the technically curious)

- Park record carries three new fields beside paint: `ww` (wood), `wr` (wheels), `og` (owner's guild tag, presence = broadcast). All gated; the relay refuses malformed records whole rather than half-applying them.
- New account endpoint `POST /v1/guilds/arms` so any client can resolve any guild's arms by tag (needed because the old incidental sources only cover guilds with seats/halls/notices).
- Relay version `world207`/`world208` on the branch → `world212` on main. **No growth in the relay bundle** — no new files, no reshaped network frames; an older client reads a customized wagon as plain built, never broken.
- Two live bugs your testing caught, both fixed and pinned by tests: selectors that changed nothing (the pool was reading through a paint-only lens that discarded timber), and a menu that could dye a wagon you weren't driving.

## 4. Verification (merge of main at world211 -> world212)

- Targeted suites green: wagontimber (8), wagontimber2 (8), wagonheraldry (9, incl. the new PASS B tag-resolution test), wagonarms_passa (7), wagons2 (+visit, +wheels), wagons1 (64x64 pin now exempts the four-cell open side), relayversion (world212 LAW row, freshly hashed over the merged bundle), manifest, tidy1_codemap, mutantdrift; lint clean; types clean.
- Full suite: 28617 tests, 28279 pass, 3 fail - `own1` and `allocchild` (both known pre-existing failures on this machine) and one `guild2_service` AUDIT G4 timing flake (passes the file standalone and 4/4 in isolation; the take/revoke path it pins is untouched by this branch).
- Mutants: 456 dead, 0 survived, 2 equivalent as recorded (both pre-existing, recorded as such) - one invocation, `node tools/mutate.mjs --jobs 4` over the 15 lists covering every file this merge touched; exit 0.
- No image files added anywhere - all art is code-drawn or dyed painted boards (DF-LOOK's palette-and-grain pipeline; port doctrine held).

## 5. Known items / not in this branch

- Ships untouched (heraldry/art scoping deferred, your call).
- ASK-MAC open items unchanged: caravan roof record question, mutant-record practice question, galleon flags, rowboat/galley art coverage.
