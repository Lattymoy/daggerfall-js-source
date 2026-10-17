-- FIELD BUGS 2026-10-16b STALL-SHAPE - A YARD'S SAVED STALLS AND BOULDERS, RE-SEATED WHERE THEIR OWNERS PUT THEM.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- WRITTEN BY tools/yardReseat.mjs (node tools/yardReseat.mjs --write) - its header says why; test/world/fb1016b_stallshape.test.js
-- holds this file to it, and runs it over the real service's own rows.
--
-- A yard's piece records where its model's origin stands, worked out against the model as it stood the day it was placed.
-- TEMPLE-STEPS (FIELD BUGS 2026-10-15f; the web's deploy done 2026-10-16T00:43:25Z, 1792111405 below) rebuilt the market stalls
-- about another origin, a quarter smaller, and the boulders two to eight times bigger about another middle; STALL-SHAPE
-- rebuilt the second stall (53113 on) 0.26 m further back again. Each piece is put back: its model's box as it was (`was`)
-- and as it is (`now`), turned by its own turn and times its scale - its origin moved so the box's middle and its foot
-- stand where they stood, and its scale divided by what the model grew (`k`), never under 0.25 or over 4
-- (net/decorLaw.js), never past its yard's +-48 m on any axis (decorPlaceOf drops a place past it) nor up past
-- 4 m. A piece placed before the deploy was placed by WD3's stand-ins (`before` 1); one since, by TEMPLE-STEPS'
-- (only the second stall has moved since). A re-seated place carries "reseat": "STALL-SHAPE", and no place that
-- carries it is moved again. Rooms (`yard` 0) hold neither. A place that is not JSON is passed over, whatever order
-- the terms are read in (0109's care: json_extract would throw).
-- The turn's cosine and sine are their series (|turn| <= 180 degrees): arithmetic alone, no extension asked. The scale is
-- divided as a REAL - a scale of 1 over a rock's 6 is a sixth, never SQLite's integer 0.
WITH f(model, before, wx, wz, wy, nx, nz, ny, k) AS (VALUES
  (53100, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53101, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53102, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53103, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53104, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53106, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53107, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53108, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53109, 1, 1.175, 0.025, 0, -0.88125, -0.03, 0, 0.75),
  (53113, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53115, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53117, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53118, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53121, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53122, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53123, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53124, 1, 1.175, 0.025, 0, -1.137, 0.0195, 0, 0.75),
  (53113, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53115, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53117, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53118, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53121, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53122, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53123, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53124, 0, -0.88125, -0.03, 0, -1.137, 0.0195, 0, 1),
  (53006, 1, 0.02603, 0.022616, -0.12, 0.063013, 0.01597, -0.738, 6),
  (53012, 1, -0.021231, -0.001146, -0.13, -0.100969, -0.040674, -0.65, 5),
  (53014, 1, -0.070907, 0.033817, -0.05, 0.151672, 0.361326, -0.05, 4),
  (53017, 1, 0.007426, 0.000671, -0.05, 0.387931, 0.30543, -0.05, 6),
  (53020, 1, 0.021857, 0.021995, -0.05, 0.216389, 0.396626, -0.05, 4),
  (53023, 1, -0.014909, 0.036057, -0.25, -0.294839, 0.00045, -0.51, 2),
  (53029, 1, -0.019085, 0.014573, -0.09, -0.464707, -0.202249, -0.552, 6),
  (53030, 1, -0.018914, -0.009388, -0.07, -0.631748, -0.101028, -0.552, 8),
  (53031, 1, 0.012082, -0.019044, -0.09, -0.220834, -0.089342, -0.51, 6),
  (53032, 1, -0.009574, 0.012913, -0.12, -0.014233, -0.036154, -0.372, 3),
  (53033, 1, -0.00379, 0.00608, -0.1, -0.042332, -0.140734, -0.408, 4),
  (53035, 1, 0.037084, 0.011146, -0.4, 0.221471, 0.038554, -0.36, 4),
  (53036, 1, 0.014143, 0.004643, -0.1, 0.123251, 0.088772, -0.618, 6),
  (53037, 1, 0.015713, -0.022638, -0.14, 0.341992, 0.305047, -0.564, 4),
  (53038, 1, -0.096046, 0.000307, -0.18, -0.308639, 0.547836, -0.704, 4),
  (53039, 1, 0.088843, 0.012316, -0.16, 0.01513, -0.268424, -0.656, 4),
  (53040, 1, -0.029847, 0.038716, -0.19, 0.256848, 0.347105, -0.567, 3),
  (53042, 1, -0.000716, 0.017151, -0.11, 0.119387, -0.17072, -0.456, 4),
  (53054, 1, 0.043558, 0.00311, -0.05, 0.681548, -0.241124, -0.05, 8),
  (53064, 1, 0.006502, -0.00965, -0.05, 0.018377, -0.200536, -0.05, 6),
  (53083, 1, -0.035806, 0.006264, -0.05, -0.129572, 0.022729, -0.05, 6),
  (53085, 1, -0.01528, -0.023038, -0.05, 0.508959, -0.766656, -0.05, 8),
  (53086, 1, -0.022317, 0.008255, -0.05, -0.881464, 0.097829, -0.05, 4)
)
UPDATE home_decor SET place = (
  SELECT json_set(home_decor.place,
    '$.pos[0]', ROUND(MIN(48, MAX(-48, x + c * dx + sn * dz)), 3),
    '$.pos[1]', ROUND(MIN(4, MAX(-48, y + dy)), 3),
    '$.pos[2]', ROUND(MIN(48, MAX(-48, z - sn * dx + c * dz)), 3),
    '$.scale', s2,
    '$.reseat', 'STALL-SHAPE')
  FROM (SELECT x, y, z, s2, (1 - r2 / 2 * (1 - r2 / 12 * (1 - r2 / 30 * (1 - r2 / 56 * (1 - r2 / 90 * (1 - r2 / 132 * (1 - r2 / 182 * (1 - r2 / 240 * (1 - r2 / 306 * 1))))))))) AS c, r * (1 - r2 / 6 * (1 - r2 / 20 * (1 - r2 / 42 * (1 - r2 / 72 * (1 - r2 / 110 * (1 - r2 / 156 * (1 - r2 / 210 * (1 - r2 / 272 * (1 - r2 / 342 * 1))))))))) AS sn,
          s * wx - s2 * nx AS dx, s * wz - s2 * nz AS dz, s * wy - s2 * ny AS dy
        FROM (SELECT x, y, z, s, r, r * r AS r2, MIN(4, MAX(0.25, ROUND(CAST(s AS REAL) / k, 3))) AS s2, wx, wz, wy, nx, nz, ny
              FROM (SELECT json_extract(home_decor.place, '$.pos[0]') AS x, json_extract(home_decor.place, '$.pos[1]') AS y,
                      json_extract(home_decor.place, '$.pos[2]') AS z, json_extract(home_decor.place, '$.scale') AS s,
                      json_extract(home_decor.place, '$.rot[0]') * 3.141592653589793 / 180 AS r, f.*
                    FROM f WHERE f.model = home_decor.model AND f.before = (home_decor.placed_at < 1792111405)))))
WHERE yard = 1 AND json_valid(place) AND (CASE WHEN json_valid(place) THEN json_extract(place, '$.reseat') END) IS NULL
  AND EXISTS (SELECT 1 FROM f WHERE f.model = home_decor.model AND f.before = (home_decor.placed_at < 1792111405));
