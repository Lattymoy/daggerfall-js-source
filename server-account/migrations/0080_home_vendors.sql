-- HOME-VENDOR (2026-10-03): a hired trader in a home - a decor piece made the `vendor` station (net/decorLaw.js) - sells
-- its owner's pieces from the pack, for gold, to whoever walks in. Its stock is market listings carried AT it: the
-- home's town (`vendor_map`) and the piece's id (`vendor_id`, home_decor.id) - bought at that piece alone, never from a
-- regional board (market.js marketBuy, marketRead's goods view). Both NULL for every other listing.
ALTER TABLE market_listings ADD COLUMN vendor_map INTEGER;
ALTER TABLE market_listings ADD COLUMN vendor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_market_vendor ON market_listings (vendor_map, vendor_id, state);
