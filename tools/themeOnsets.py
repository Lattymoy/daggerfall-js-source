#!/usr/bin/env python3
# THE THEME'S ONSETS, MEASURED - the analysis introCue.js's grid came
# from, committed this time. U65 ran this ad hoc and shipped only its
# conclusions, which is how "the first big beat" became a thing to
# argue from memory instead of read off a table. Never again: this file
# IS the table's source, and re-running it is how any future re-time
# starts.
#
#   ffmpeg -i src/assets/intro/theme.mp3 -ac 1 -ar 12000 -f f32le /tmp/theme.pcm
#   python3 tools/themeOnsets.py /tmp/theme.pcm [seconds]
#
# Spectral flux onset detection: 1024-pt FFT, 128-sample hop at 12 kHz,
# half-wave rectified frame-to-frame magnitude difference, normalised
# by a +-0.5 s local mean, peak-picked over +-90 ms. Same parameters as
# the U65 analysis, so its measured constants reproduce.
import sys
import numpy as np

SR, N, HOP = 12000, 1024, 128
BPM, PHASE = 127.26, 0.255
BAR = 60 / BPM * 4

pcm = np.fromfile(sys.argv[1], dtype=np.float32)
limit = float(sys.argv[2]) if len(sys.argv) > 2 else 75.0
pcm = pcm[: int(limit * SR)]

win = np.hanning(N)
frames = 1 + (len(pcm) - N) // HOP
mags = np.empty((frames, N // 2 + 1), dtype=np.float32)
for i in range(frames):
    mags[i] = np.abs(np.fft.rfft(pcm[i * HOP: i * HOP + N] * win))

flux = np.maximum(mags[1:] - mags[:-1], 0).sum(axis=1)
flux = np.concatenate([[0.0], flux])

# local-mean normalisation, +-0.5 s
w = int(0.5 * SR / HOP)
kernel = np.ones(2 * w + 1) / (2 * w + 1)
local = np.convolve(flux, kernel, mode='same')
norm = flux / np.maximum(local, 1e-9)

# peak pick: a frame that beats every neighbour within +-90 ms
r = int(0.09 * SR / HOP)
peaks = []
for i in range(r, len(norm) - r):
    if norm[i] >= norm[i - r: i + r + 1].max() and norm[i] > 1.4:
        t = (i * HOP + N / 2) / SR
        bar = (t - PHASE) / BAR + 1
        peaks.append((t, norm[i], bar))

# strength scaled the way ONSET_STRENGTH was published (0..~0.8)
top = max(p[1] for p in peaks)
print(f'{len(peaks)} onsets in the first {limit:.0f}s; grid {BPM} BPM, phase {PHASE}s, bar {BAR:.4f}s')
print(f'{"time":>8}  {"strength":>8}  {"bar":>7}  {"grid err ms":>11}')
for t, s, bar in peaks:
    err = (bar - round(bar)) * BAR * 1000
    mark = ' <- on the grid' if abs(err) < 40 and abs(bar - round(bar)) < 0.03 else ''
    print(f'{t:8.3f}  {s / top * 0.8:8.2f}  {bar:7.2f}  {err:11.1f}{mark}')
