// PY1 - THE PARITY PINS WERE BLIND (2026-08-28).
//
// Nine of the strongest pins in this suite do not assert a remembered
// value - they REGENERATE the port's table from Daggerfall Unity's own
// C# and compare cell for cell: ENEMY_BASICS off EnemyBasics.cs,
// LOOT_MATRICES off LootTables.cs, the ingredient ITEM_GROUPS off
// ItemEnums.cs, MAGIC_ONLY_KEYS off the effect classes, and wave 31's
// sweep of every CalculateAttackDamage caller. They are the only pins
// that can catch the port drifting from a DFU the reader never re-read.
//
// Every one of them resolved the clone as a HARDCODED
// `tools/parity/dfu/...` and skipped when it was absent - which is
// every environment where the reference checkout lives somewhere else,
// including the one this project is developed in (the clone sits at
// /home/user/interkarma/daggerfall-unity). So the suite reported them
// green by never running them: `# skipped 9`, indistinguishable at a
// glance from `# pass 9`.
//
// tools/parity/prepare.sh has honoured `DFU_PATH` since AUDIT 18 ("Point
// it at a checkout you already have with DFU_PATH=/path/to/
// daggerfall-unity") - the tests simply never learned the same
// convention. This is that one home:
//
//   DFU_PATH=/path/to/daggerfall-unity npm test
//
// falling back to the in-tree sparse clone prepare.sh creates. With no
// checkout at all the pins still skip, loudly and correctly - CI has no
// DFU tree and Port-Doctrine keeps it an EXTERNAL reference, never
// vendored.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The reference checkout's root, as a directory URL ending in '/'.
 *  prepare.sh's own precedence: the env var first, the in-tree sparse
 *  clone second. */
export const DFU_ROOT = process.env.DFU_PATH
  ? pathToFileURL(process.env.DFU_PATH.replace(/\/?$/, '/'))
  : new URL('../tools/parity/dfu/', import.meta.url);

/** A file inside the checkout, by its repo-relative path
 *  ('Assets/Scripts/Utility/EnemyBasics.cs'). */
export const dfuFile = (rel) => new URL(rel, DFU_ROOT);

/** True when the named files are NOT all present - the `skip` value
 *  every regeneration pin gates on. */
export const missingDfu = (...rels) => rels.some((r) => !existsSync(dfuFile(r)));
