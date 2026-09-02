# Audit 49 - Roads 14-18, the calibrated network, before continuing

Mac, 2026-09-02: "Lets do a comprehensive audit before continuing."
Sweep first; then the two things only the real map can show, which
this container now has.

## The sweep

Six mutants over ROADS 14-18. R14 the squared turn, R15 tracks aiming
at the road pixel, R16 the track set, R18 the wide join: DEAD. R16's
neighbours dial: ALIVE, expected - a dial is a number, not a law. R17
the through-road merge: ALIVE, and that became A2.

## A1 - HIGH, FIXED. Half the build was spent proving the sea is wet.

7.25 seconds on the real map, and 3.46 of them - 48% - were the 44
unrouted pairs, all but one with water between them, each paying the
12-, 40- and 120-pixel A* boxes at eight headings before giving up.
Land is flood-filled once into 4-connected components (the
conservative match for a router that will not cut a water corner), and
a pair on different components is named unrouted without a search.
Build 7.25s -> 4.44s, the network byte-identical, the same 44 named.
Pinned with a one-pixel strait and a COUNT - stats.islands - because the first pin used a clock and a fast failure looked like a skip to it; the mutant survived until the count replaced the clock.

The remaining 4.4 seconds are 2,222 road routes and 6,362 track routes
at roughly half a millisecond each. That is what caching (item 8,
parked on this number) would remove for every boot after the first,
and the number now says it is worth it.

## A2 - LOW, RECORDED. The merge is real, small, and invisible to any fixture.

Disabling R17's through-road merge left every pin green. On every flat
fixture tried, the wide join steers an approach by itself, and a route
that rides the existing road into town leaves the same pixels whether
it stops three pixels early or not. On the REAL map it is measurable:
junctions 7.0% -> 6.5%, 118 duplicate spur pixels removed, right
angles unchanged. The hairpin and right-angle win credited to ROADS
17/18 was the WIDE JOIN's, and the record now says so. The merge stays,
pinned at the source, with the measurement that justifies it.

## Cleared

The calibration table reproduces from the uploaded archives to the
pixel on every run. The 44 unrouted pairs are islands and the far
north by name (Millitor -> Paponirea across water, Chestertower ->
Penwall Derry across water, ...); one land pair, Atruza -> Baghada, is
walled by blocked pixels and the no-corner rule and is the only
candidate for a wider fallback.

## Standing

Right angles 0.9% (his 1.7%), hairpins 0 (his 0), junctions 6.5% (his
4.4%), bends 25% (his 30%), road pixels 14.0k (his 21.5k). Two
structural gaps remain from ROADS 16, unchanged: the track webs
(dead-ends 29% vs 7%) and road length. They are the next slices.
