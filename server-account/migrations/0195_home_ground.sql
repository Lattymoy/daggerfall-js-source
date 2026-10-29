-- DECOR-ROOMY (FIELD BUGS 2026-10-29f): the ground a home stands on, square metres - the measure its online price was
-- set from (src/net/homeLaw.js homeGroundOk), so a wider house holds more pieces (src/net/decorLaw.js decorCapOf).
-- NULL until a claim or its owner names it: such a home holds DECOR_CAP, as every home did.
ALTER TABLE homes ADD COLUMN ground REAL;
