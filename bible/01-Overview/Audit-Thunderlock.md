# AUDIT-THUNDERLOCK (2026-09-19) — the gun lab, the weapon, and what a green suite was hiding

Mac: *"Lets fo a comprehensive audit over everything"* — over ten
commits: the gun lab, its sounds and art, the Dwarven Thunderlock, the
enchanted variant and the unique find, plus the Weapon Widget motion
extraction underneath them.

**Eight findings, all fixed.** Seven were defects; one was me being
wrong.

## The shape of it

Every one of the first six is the same species: **the tests imported
the module under test, and the game imported nothing.** A suite that
says `import { createThunderlock } from '../src/systems/thunderlock.js'`
brings every side effect in that module with it — the template
registration, the loot find, the legendary. So the suite was green and
the weapon did not exist in the running game.

That is worth stating plainly because it is not a Thunderlock problem.
It is what a registration-at-import module does to any test that names
it, and the fix is the pin shape F1 now carries: **import a host, not
the module**, and ask the registries.

## The findings

| | what | why it mattered |
| --- | --- | --- |
| **F1** | Nothing in `src/` imported `systems/thunderlock.js` | The weapon had **no template row, could never drop, and had no icons** in the running game. Everything else below was downstream of a weapon that did not exist. |
| **F2** | `machine.ranged` was written and read nowhere | `machineStep` only set `cooldownUntil` under `m.isBow`, so the gun had **no cooldown and no reload pause** — fire as fast as you can click. |
| **F3** | The **fourth host** was not converted | `exterior.js` kept `=== WEAPON_TYPES.Bow` and `spendArrow`, so in the open world the gun fell to the **melee arc** and spent arrows. The repo has a FOUR HOSTS RULE for exactly this. |
| **F4** | The Dwemer Pellet was rarity-eligible | A found stack could roll Magic, which **enchants** it — and an enchanted item does not stack. A find of twenty becomes twenty rows to carry. |
| **F5** | The out-of-ammo guard was bow-only | At zero pellets the weapon **never auto-sheathed and said nothing**: a trigger that does nothing and gives no reason. |
| **F6** | `deploy.yml` checked out the feature branch **by name** | Deleting that branch after the merge fails the step and takes the **whole Pages deploy** down with it — the game's, not only the lab's. |
| **F7** | Assets resolved against `document.baseURI` | The game's document is `/play/index.html`, so the sheet and icons would have been fetched from `/play/art/…` and **the weapon would have drawn nothing**. This is not hypothetical: it is MAP-FIELD, four weeks earlier, on Mac's own held-map sprite. |
| **F8** | The game never played the weapon's sounds | The clips were baked, allow-listed, documented and wired into the **lab** — and `machineStep` emits `bowSound` only for a bow, so the weapon fired **in silence** in all four hosts. The lab having them made this harder to notice, not easier. |

### Not a finding

The review flagged the Pellet's `playerTextureArchive: 0` as resolving
its inventory icon to the Arrow's art. It does not: `usesWorldTexture`
returns true for **any** custom template, so both new items take the
world-texture arm and the pellet draws archive 561 — `gun-ammo.png`, as
intended. Recorded because a wrong finding that goes unrecorded gets
re-found.

## What changed beyond the fixes

- **`systems/appRoot.js`** — the site-root law, moved out of a
  700-line window module (`ui/heldMap.js`, which re-exports it) so
  `combat/` can afford to import it. Twice is a law.
- **`hostCombat.js`'s weapon-to-skill table** was a second copy — the
  duplicate `audit24`'s ratchet had been naming — and it answered
  `null` for the new weapon, which is what sent the gun down the melee
  arc before F3 was even reachable. One table now.
- **`lootRarity.js` gained two registration doors** (`registerAmmunition`,
  and the unique find's) rather than learning what a gun is.
- **The lab's `SFX` was renamed `SFX_CANDIDATES`** — it is a list of
  audition candidates, and the weapon's `SFX` is three clip keys. One
  name for two things is what the ratchet is for.

## The pins

`test/thunderlock.test.js` is 17 tests now, seven of them the audit's
own. The rule they follow: **pin the question the way the game asks
it**. F1 imports a host. F3/F5 read the four hosts' source. F7 drives
the root resolver with the URLs both lanes actually produce.

Suite 9108, 0 fail. `npm run gunproto` 20/20.
