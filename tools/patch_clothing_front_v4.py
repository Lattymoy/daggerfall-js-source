from pathlib import Path

p = Path('src/tools/paperdoll/clothingTexture.js')
s = p.read_text()

old = """  // Preserve each row's local lean correction, but hold the anatomical axis at\n  // one constant displacement from the silhouette centre. This separates\n  // \"paperdoll pose shear\" from \"which half of the torso is actually front\".\n  const axisShift = anatomicalAxis - sourceCentre;\n  const leftExtents = [], rightExtents = [];\n  let leftOpaque = 0, rightOpaque = 0;\n  for (const y of occupied) {\n    const [x0, x1] = spans[y];\n    const rowCentre = (x0 + x1) * 0.5;\n    const rowAxis = Math.max(x0, Math.min(x1, rowCentre + axisShift));\n    if (rowAxis - x0 > 0.5) leftExtents.push(rowAxis - x0);\n    if (x1 - rowAxis > 0.5) rightExtents.push(x1 - rowAxis);\n    for (let x = x0; x <= x1; x++) {\n      if (!src.data[(y * src.width + x) * 4 + 3]) continue;\n      if (x < rowAxis) leftOpaque++;\n      else if (x > rowAxis) rightOpaque++;\n    }\n  }\n"""
assert s.count(old) == 1
new = """  // V4: estimate perspective from the CHEST, not the whole sprite. The top\n  // shoulder/neck cutout and the lower hem are presentation-heavy and were\n  // polluting the side-bias decision. Use the central vertical band to decide\n  // which authored half is trustworthy, while still applying the correction to\n  // every row so belts/trim keep their original Y placement.\n  const bandLoIndex = Math.floor((occupied.length - 1) * 0.18);\n  const bandHiIndex = Math.ceil((occupied.length - 1) * 0.82);\n  const analysisRows = occupied.slice(bandLoIndex, bandHiIndex + 1);\n  const analysisCentres = analysisRows.map((y) => (spans[y][0] + spans[y][1]) * 0.5).sort((a, b) => a - b);\n  const analysisSourceCentre = analysisCentres[Math.floor(analysisCentres.length * 0.5)] ?? sourceCentre;\n  const axisShift = anatomicalAxis - analysisSourceCentre;\n  const leftExtents = [], rightExtents = [];\n  let leftOpaque = 0, rightOpaque = 0;\n  for (const y of analysisRows) {\n    const [x0, x1] = spans[y];\n    const rowCentre = (x0 + x1) * 0.5;\n    const rowAxis = Math.max(x0, Math.min(x1, rowCentre + axisShift));\n    if (rowAxis - x0 > 0.5) leftExtents.push(rowAxis - x0);\n    if (x1 - rowAxis > 0.5) rightExtents.push(x1 - rowAxis);\n    for (let x = x0; x <= x1; x++) {\n      if (!src.data[(y * src.width + x) * 4 + 3]) continue;\n      if (x < rowAxis) leftOpaque++;\n      else if (x > rowAxis) rightOpaque++;\n    }\n  }\n"""
s = s.replace(old, new, 1)
s = s.replace("mode: 'paperdoll-surface-v3',", "mode: 'paperdoll-surface-v4',", 1)
s = s.replace("registration: 'paperdoll-axis-front-reconstruct',", "registration: 'paperdoll-axis-chest-weighted-front-reconstruct',", 1)
meta_anchor = """    anatomicalAxis,\n    axisShift,\n    leftExtent,\n"""
assert s.count(meta_anchor) == 1
s = s.replace(meta_anchor, """    anatomicalAxis,\n    analysisSourceCentre,\n    analysisBand: [analysisRows[0], analysisRows[analysisRows.length - 1]],\n    analysisRowCount: analysisRows.length,\n    axisShift,\n    leftExtent,\n""", 1)
p.write_text(s)

p = Path('tools/clothingCanonicalProbe.mjs')
s = p.read_text()
assert s.count("assert.equal(torso.canonicalMeta.mode, 'paperdoll-surface-v3');") == 1
s = s.replace("assert.equal(torso.canonicalMeta.mode, 'paperdoll-surface-v3');",
              "assert.equal(torso.canonicalMeta.mode, 'paperdoll-surface-v4');")
anchor = "assert.equal(torso.canonicalMeta.sourceAxis, 'paperdoll-offset');\n"
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + "assert.equal(torso.canonicalMeta.registration, 'paperdoll-axis-chest-weighted-front-reconstruct');\nassert.ok(torso.canonicalMeta.analysisRowCount < th, 'torso orientation must ignore noisy top/bottom rows');\n", 1)
p.write_text(s)
