"""Original 20 s cosy-Christmas score for the Bundle of Brave Fete invitation film.

96 BPM, G major, 8 bars of 4/4 = exactly 20.0 s (BEAT = 0.625 s).
Chords: G | Em | C | D | G | Em | C-D | G

  b0-8    intro   : glint, music-box melody alone over a soft pad, swell b6-8
  b8-16   groove  : round soft kick, brushed shaker, pizzicato bass, felt piano,
                    polaroid "tick" plucks on b8, b9.5, b11, b12.5
  b16-24  fuller  : sleigh bells, soft claps on 2 & 4, glockenspiel counter-line,
                    word-tag bell accents on b17, b18.5, b20, b21.5, b23;
                    gentle build b22-24 (reverse cymbal + pad swell)
  b24-30  arrival : warm full chord + soft crash, light groove, rising harp-ish
                    arpeggio as the card slides up (b25-26)
  b30-32  button  : celesta/bell chime + final G major chord, fade to silence

Run:  python3 tools/compose_invite.py  ->  build/invite-music.wav
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, lfilter, resample_poly
from scipy.ndimage import maximum_filter1d
from scipy.io import wavfile

SR = 48000
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625 s
DUR = 20.0
N = int(SR * DUR)          # 960000
TARGET_LUFS = -14.0
TP_CEIL_DB = -1.3
rng = np.random.default_rng(1225)

BUS = {k: [np.zeros(N), np.zeros(N)] for k in ('drums', 'music', 'fx')}
send_L = np.zeros(N)
send_R = np.zeros(N)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def at(beat):
    return int(round(beat * BEAT * SR))


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        sos = butter(order, [v / (SR / 2) for v in f], btype=kind, output='sos')
    else:
        sos = butter(order, f / (SR / 2), btype=kind, output='sos')
    return sosfilt(sos, x)


def fades(x, a=0.003, r=0.03):
    """Declick: short linear attack + raised-cosine release on every note."""
    n = len(x)
    na, nr = max(1, int(SR * a)), max(1, int(SR * r))
    na, nr = min(na, n // 2), min(nr, n // 2)
    x = x.copy()
    x[:na] *= np.linspace(0, 1, na)
    x[n - nr:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nr))
    return x


def place(sig, beat, pan=0.0, gain=1.0, send=0.0, bus='music'):
    s = at(beat)
    if s >= N:
        return
    e = min(N, s + len(sig))
    seg = sig[: e - s] * gain
    gl = np.cos((pan + 1) * np.pi / 4)
    gr = np.sin((pan + 1) * np.pi / 4)
    BUS[bus][0][s:e] += seg * gl
    BUS[bus][1][s:e] += seg * gr
    if send:
        send_L[s:e] += seg * gl * send
        send_R[s:e] += seg * gr * send


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    t = np.arange(n) / SR
    total = n / SR
    hold = total - r if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6),
                 np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-6), s))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return e * (1 - rel)


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    ph = (freq * t + phase) % 1.0
    return 2 * ph - 1


def partials(f, n, spec, attack=0.002):
    """spec: list of (ratio, amp, decay_rate)."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, dec in spec:
        fr = f * ratio
        if fr > 16000:
            continue
        out += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) * amp * np.exp(-t * dec)
    return fades(out, attack, 0.04)


# ---------------------------------------------------------------- instruments
def musicbox(m, dur=1.8):
    """Music box / celesta tine: sine body, soft octave, faint beam modes."""
    f = midi(m)
    x = partials(f, int(SR * dur), [
        (1.0, 1.0, 2.4), (2.0, 0.22, 4.5), (3.0, 0.06, 8.0),
        (5.93, 0.035, 22.0), (1.003, 0.35, 2.6)], attack=0.0025)
    return filt(x, 'lowpass', 7500) * 0.30


def glock(m, dur=1.6, g=1.0):
    """Glockenspiel bar (free-free bar mode ratios)."""
    f = midi(m)
    x = partials(f, int(SR * dur), [
        (1.0, 1.0, 2.8), (2.756, 0.22, 7.0), (5.404, 0.05, 16.0)], attack=0.0015)
    return filt(x, 'lowpass', 8000) * 0.26 * g


def fm_bell(m, dur=2.5, bright=0.6):
    """Soft FM bell for chimes (from the teaser, lower index)."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = midi(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * (1.6 * bright) * np.exp(-t * 6)
    car = np.sin(2 * np.pi * f * t + mod)
    shimmer = np.sin(2 * np.pi * f * 2 * t) * 0.2 * np.exp(-t * 4)
    x = (car + shimmer) * np.exp(-t * 1.6)
    return filt(fades(x, 0.002, 0.08), 'lowpass', 8000) * 0.26


def felt_piano(notes, dur, vel=1.0):
    """Felt piano: detuned string pair, gentle inharmonic partials, dark tone."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        B = 0.0003
        for k in range(1, 9):
            fk = k * f * np.sqrt(1 + B * k * k)
            if fk > 9000:
                break
            amp = 1.0 / k ** 1.8
            dec = 1.2 + 0.9 * k + f / 600
            for det in (-0.6, 0.6):
                out += np.sin(2 * np.pi * (fk + det * k * 0.25) * t + rng.uniform(0, 6.28)) \
                    * amp * np.exp(-t * dec) * 0.5
    # felt "thump"
    out += filt(rng.standard_normal(n), 'lowpass', 900) * np.exp(-t * 60) * 0.05
    out = filt(out, 'lowpass', 2600)
    out /= max(1.0, len(notes)) ** 0.5
    return fades(out, 0.004, 0.12) * 0.22 * vel


def pizz(m, dur=0.9, bright=1.0):
    """Pizzicato string: plucked harmonic stack with faster-decaying highs."""
    f = midi(m)
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 12):
        if k * f > 6000:
            break
        out += np.sin(2 * np.pi * k * f * t) * (1 / k ** 1.3) * np.exp(-t * (5 + 3.2 * k * bright))
    out += np.sin(2 * np.pi * f * t) * np.exp(-t * 4) * 0.4  # body
    out = filt(out, 'lowpass', 1800 + 1200 * bright)
    return fades(out, 0.003, 0.08) * 0.30


def tick_pluck(m):
    """Polaroid-drop accent: a small pizz pluck + a soft paper tick."""
    x = pizz(m, 0.7, bright=1.4) * 0.8
    n = int(SR * 0.04)
    t = np.arange(n) / SR
    tk = filt(rng.standard_normal(n), 'bandpass', [1800, 5000]) * np.exp(-t * 180) * 0.12
    x[:n] += fades(tk, 0.001, 0.01)
    return x


def pad(notes, dur, cutoff=1100, a=0.8, r=0.8, voices=3, detune=0.09):
    """Warm pad: few detuned saws + sine layer, dark lowpass."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        for v in range(voices):
            d = (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune
            out += saw(f * 2 ** (d / 12), n, rng.uniform()) * 0.5
        out += np.sin(2 * np.pi * f * t) * 0.7
    out /= (voices * len(notes)) ** 0.5
    out = filt(filt(out, 'lowpass', cutoff), 'lowpass', cutoff * 1.4)
    trem = 1 + 0.05 * np.sin(2 * np.pi * 4.6 * t / 4)
    return out * env_adsr(n, a, 0.3, 0.9, r) * trem * 0.16


def soft_kick():
    n = int(SR * 0.42)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    thud = filt(rng.standard_normal(n), 'lowpass', 400) * np.exp(-t * 50) * 0.15
    return fades(np.tanh((body + thud) * 1.1), 0.002, 0.05) * 0.8


def shaker(acc=1.0):
    n = int(SR * 0.11)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [2500, 7500])
    env = (t / 0.025).clip(0, 1) ** 2 * np.exp(-np.clip(t - 0.025, 0, None) * 45)
    return fades(x * env, 0.001, 0.02) * 0.07 * acc


def brush(g=1.0):
    """Brushed snare: soft tone + swishy noise."""
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    noise = filt(rng.standard_normal(n), 'bandpass', [900, 6000])
    env = np.minimum(1, t / 0.008) * np.exp(-t * 11)
    tone = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 30) * 0.25
    return fades(noise * env * 0.4 + tone, 0.002, 0.05) * 0.35 * g


def soft_clap():
    n = int(SR * 0.3)
    t = np.arange(n) / SR
    noise = filt(rng.standard_normal(n), 'bandpass', [800, 4200])
    env = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022, 0.034]):
        tt = t - off
        env += np.where(tt >= 0, np.exp(-np.clip(tt, 0, None) * (130 if k < 3 else 16)), 0)
    return fades(noise * env, 0.001, 0.05) * 0.30


def sleigh(accent=1.0):
    """Jingle shake from the teaser, but darker and gentler."""
    n = int(SR * 0.18)
    t = np.arange(n) / SR
    out = filt(rng.standard_normal(n), 'bandpass', [4000, 9000]) * 0.4
    for _ in range(6):
        f = rng.uniform(3000, 7200)
        out += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * rng.uniform(0.2, 0.5)
    env = np.zeros(n)
    for off in rng.uniform(0, 0.025, 4):
        tt = t - off
        env += np.where(tt >= 0, np.minimum(1, np.clip(tt, 0, None) / 0.002)
                        * np.exp(-np.clip(tt, 0, None) * 38), 0)
    return fades(filt(out * env, 'lowpass', 9000), 0.001, 0.03) * 0.035 * accent


def reverse_cymbal(beats):
    n = int(SR * beats * BEAT)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [3000, 9000]) * np.exp(-t * 2.2)
    x = x[::-1]
    return fades(x, 0.05, 0.004) * 0.12


def soft_crash():
    n = int(SR * 3.0)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [2500, 9000])
    for _ in range(10):
        x += np.sin(2 * np.pi * rng.uniform(3000, 7000) * t) * 0.15 * np.exp(-t * rng.uniform(1, 3))
    env = np.minimum(1, t / 0.012) * np.exp(-t * 1.6)
    return fades(x * env, 0.002, 0.3) * 0.08


def glint():
    """Opening sparkle: quick soft celesta run up to a chime + airy shimmer."""
    n = int(SR * 3.0)
    out = np.zeros(n)
    run = [86, 88, 91, 93, 95, 98]
    for i, m in enumerate(run):
        s = int(SR * i * 0.045)
        x = glock(m, 1.8, 0.35 + 0.1 * i)
        out[s:s + len(x)] += x[: n - s]
    s = int(SR * 0.27)
    x = fm_bell(91, 2.6, 0.5) * 0.7
    out[s:s + len(x)] += x[: n - s]
    t = np.arange(n) / SR
    air = filt(rng.standard_normal(n), 'bandpass', [5000, 10000]) * np.exp(-t * 2.5) * np.minimum(1, t / 0.2)
    out += air * 0.008
    return fades(out, 0.002, 0.2)


# ---------------------------------------------------------------- harmony
CHORD_AT = []  # (beat_start, beats, name)
for bi, ch in enumerate(['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'G']):
    if bi == 6:
        CHORD_AT += [(24, 2, 'C'), (26, 2, 'D')]
    else:
        CHORD_AT.append((bi * 4, 4, ch))

PAD_V = {'G': [55, 62, 67, 71], 'Em': [52, 59, 64, 67], 'C': [48, 55, 64, 71],
         'D': [50, 57, 62, 66]}
PIANO_V = {'G': [55, 59, 62, 67], 'Em': [55, 59, 64], 'C': [55, 60, 64, 71],
           'D': [54, 57, 62, 64]}
ROOT = {'G': 43, 'Em': 40, 'C': 36, 'D': 38}
FIFTH = {'G': 50, 'Em': 47, 'C': 43, 'D': 45}

# ---------------------------------------------------------------- melody
MEL = [  # (beat, midi, beats)
    # bar 1 G  ("every brave little heart" b2-4)
    (1.0, 74, .5), (1.5, 79, .5), (2.0, 83, .5), (2.5, 81, .5), (3.0, 79, .5), (3.5, 81, .5),
    # bar 2 Em ("has a wish" b4-6)
    (4.0, 83, .5), (4.5, 79, .5), (5.0, 88, 1.5), (6.5, 86, .5), (7.0, 83, 1.0),
    # bar 3 C
    (8.0, 76, 1.0), (9.0, 79, .5), (9.5, 84, 1.0), (10.5, 83, .5), (11.0, 81, 1.0),
    # bar 4 D
    (12.0, 78, 1.0), (13.0, 81, .5), (13.5, 86, 1.0), (14.5, 84, .5), (15.0, 81, 1.0),
    # bar 5 G
    (16.0, 83, 1.0), (17.0, 86, .5), (17.5, 88, .5), (18.0, 86, 1.0), (19.0, 83, 1.0),
    # bar 6 Em
    (20.0, 79, 1.0), (21.0, 83, .5), (21.5, 88, 1.0), (22.5, 86, .5), (23.0, 83, 1.0),
    # bar 7 C-D (arrival)
    (24.0, 88, 1.5), (25.5, 86, .5), (26.0, 86, 1.0), (27.0, 84, .5), (27.5, 81, .5),
    # bar 8 G
    (28.0, 83, 1.5), (29.5, 81, .5),
]
HARM = {5.0: 79, 7.0: 79, 9.5: 76, 13.5: 78, 17.5: 79, 21.5: 79, 24.0: 79, 26.0: 78, 28.0: 79}

# ---------------------------------------------------------------- arrangement
kicks = []

# ----- intro b0-8: glint, music box alone over pad, swell b6-8
place(glint(), 0, pan=0.0, gain=0.9, send=0.6, bus='fx')
for b, m, d in MEL:
    g = 0.85 if b < 8 else 0.75
    place(musicbox(m, max(1.4, d * BEAT + 1.0)), b, pan=-0.12, gain=g, send=0.45)
    if b in HARM:
        place(musicbox(HARM[b], 1.6), b, pan=0.25, gain=0.35, send=0.5)
    if b >= 8:  # soft piano doubling an octave below once the groove is in
        place(felt_piano([m - 12], d * BEAT + 0.6, 0.55), b, pan=0.1, send=0.25)

for b, d, ch in CHORD_AT:
    if b < 8:
        cut = 900 if b < 6 else 900
        place(pad(PAD_V[ch], d * BEAT + 0.6, cutoff=cut, a=1.0 if b == 0 else 0.4, r=0.6),
              b, pan=-0.15, gain=0.85, send=0.3)
    elif b < 28:
        place(pad(PAD_V[ch], d * BEAT + 0.5, cutoff=1300 if b < 16 else 1600, a=0.25, r=0.5),
              b, pan=0.0, gain=0.7 if b < 24 else 0.9, send=0.3)
# swell b6-8: second pad layer rising into the groove
sw = pad([62, 66, 69, 74], 2 * BEAT + 0.3, cutoff=1500, a=1.1, r=0.25)
sw *= np.linspace(0.2, 1, len(sw)) ** 1.5
place(sw, 6, pan=0.2, gain=1.5, send=0.5)
place(reverse_cymbal(2) * 0.9, 6, pan=0.3, bus="fx")

# ----- groove b8-30
for b, d, ch in CHORD_AT:
    if b < 8 or b >= 30:
        continue
    for k in range(int(d)):
        bb = b + k
        if bb >= 30:
            break
        # kick: every beat b8-23, then on 1 & 3 after the arrival; drop out b23 for the build
        if bb < 23 or (bb >= 24 and (bb - 24) % 2 == 0):
            place(soft_kick(), bb, gain=0.8 if bb < 16 else 0.9, bus='drums')
            kicks.append(bb)
        # brushed shaker 8ths
        for h in (0, 0.5):
            acc = 1.0 if h else 0.6
            if bb >= 24:
                acc *= 0.75
            place(shaker(acc), bb + h, pan=0.35, send=0.08, bus='drums')
        if (bb % 4) in (1, 3):
            place(brush(0.8 if bb < 16 else 0.6), bb, pan=-0.1, send=0.2, bus='drums')
            if 16 <= bb < 22:
                place(soft_clap(), bb, pan=0.05, gain=0.8, send=0.35, bus='drums')
            elif bb >= 24:
                place(soft_clap(), bb, pan=0.05, gain=0.5, send=0.35, bus='drums')
    # pizzicato bass: root on 1, fifth on 3 (+ a little pickup)
    place(pizz(ROOT[ch], 1.2), b, pan=-0.05, gain=1.0, send=0.1)
    if d == 4:
        place(pizz(FIFTH[ch], 1.0), b + 2, pan=-0.05, gain=0.8, send=0.1)
        place(pizz(ROOT[ch] + 12, 0.6), b + 3.5, pan=-0.05, gain=0.55, send=0.1)
    else:
        place(pizz(ROOT[ch] + 12, 0.6), b + 1.5, pan=-0.05, gain=0.55, send=0.1)
    # felt piano comp: chord on 1, upper dyad on 2&, chord on 3 (soft), dyad on 4&
    v = PIANO_V[ch]
    place(felt_piano(v, 2.2), b, pan=0.2, gain=1.0, send=0.3)
    place(felt_piano(v[-2:], 1.0, 0.6), b + 1.5, pan=0.25, send=0.3)
    if d == 4:
        place(felt_piano(v, 1.4, 0.65), b + 2, pan=0.2, send=0.3)
        place(felt_piano(v[-2:], 1.0, 0.55), b + 3.5, pan=0.25, send=0.3)

# polaroid drops b8, b9.5, b11, b12.5
for b, m in [(8, 86), (9.5, 83), (11, 88), (12.5, 86)]:
    place(tick_pluck(m), b, pan=0.45 if b in (8, 11) else -0.45, gain=0.9, send=0.35)
    place(tick_pluck(m - 12), b, pan=0.0, gain=0.35, send=0.2)

# ----- fuller section b16-24: sleigh bells, glock counter-melody, word-tag accents
for i in range(int((24 - 16) / 0.5)):
    b = 16 + i * 0.5
    place(sleigh(1.3 if i % 2 else 0.85), b, pan=0.55, send=0.15)
    place(sleigh(0.5), b + 0.25, pan=-0.5, send=0.15)
for i in range(int((30 - 24) / 0.5)):
    b = 24 + i * 0.5
    place(sleigh(0.55 if i % 2 else 0.35), b, pan=0.55, send=0.2)
# glock counter-line (soft, answering the melody)
for b, m in [(16.5, 91), (19.5, 91), (20.5, 88), (22.0, 91), (23.5, 90)]:
    place(glock(m, 1.4, 0.45), b, pan=0.4, send=0.5)
# word tags b17, b18.5, b20, b21.5, b23
for b, m in [(17, 95), (18.5, 91), (20, 95), (21.5, 91), (23, 98)]:
    place(glock(m, 1.8, 0.8), b, pan=-0.35 if b in (17, 20, 23) else 0.35, send=0.55)
    place(fm_bell(m - 12, 1.5, 0.4), b, pan=0.0, gain=0.35, send=0.5)

# ----- build b22-24
place(reverse_cymbal(2), 22, pan=0.0, gain=1.0, bus='fx')
bl = pad([62, 66, 69, 74, 78], 2 * BEAT + 0.05, cutoff=1400, a=0.05, r=0.05)
bl *= np.linspace(0, 1, len(bl)) ** 2
place(bl, 22, pan=-0.2, gain=0.9, send=0.4)
for i, m in enumerate([74, 78, 81, 86, 90, 93]):  # rising celesta run into the arrival
    place(musicbox(m, 1.0), 23 + i * (1 / 6), pan=-0.3 + 0.12 * i, gain=0.3 + 0.06 * i, send=0.5)

# ----- arrival b24: warm full chord + soft crash
place(soft_crash(), 24, pan=0.15, gain=1.0, send=0.3, bus='fx')
place(pad([36, 48, 55, 64, 67, 71, 76], 2 * BEAT + 0.8, cutoff=1800, a=0.02, r=0.8), 24,
      gain=0.9, send=0.4)
place(felt_piano([36, 48, 55, 64, 71, 76], 3.0, 1.1), 24, pan=0.1, send=0.35)
place(fm_bell(88, 2.5, 0.4), 24, pan=-0.2, gain=0.4, send=0.6)
place(pad([38, 50, 57, 62, 66, 69], 2 * BEAT + 0.6, cutoff=1700, a=0.08, r=0.6), 26,
      gain=0.75, send=0.4)
# card slides up b25-26: rising harp-like pizz arpeggio
for i, m in enumerate([67, 71, 74, 79, 83, 86, 91]):
    place(pizz(m, 1.0, 1.2), 25 + i / 7, pan=-0.5 + i / 6, gain=0.45, send=0.5)

# ----- bar 8 b28-30: G chord, then the button at b30
place(pad(PAD_V['G'] + [74], 2 * BEAT + 0.4, cutoff=1400, a=0.05, r=0.4), 28, gain=0.75, send=0.35)

# ----- button b30: chime + final G major chord ringing out
place(fm_bell(91, 3.0, 0.5), 30, pan=0.0, gain=0.55, send=0.7)
place(glock(95, 2.0, 0.55), 30.02, pan=0.3, send=0.7)
place(musicbox(83, 2.4), 30, pan=-0.25, gain=0.6, send=0.6)
place(musicbox(79, 2.4), 30, pan=0.25, gain=0.5, send=0.6)
place(felt_piano([43, 55, 59, 62, 67, 71], 2.5, 1.0), 30, pan=0.05, send=0.4)
place(pizz(31, 1.5), 30, gain=0.8, send=0.1)
place(pad([43, 55, 62, 67, 71, 74], 2.0, cutoff=1500, a=0.02, r=1.2), 30, gain=0.9, send=0.45)
for i, m in enumerate([86, 91, 95, 98]):  # tiny sparkle after the chime
    place(glock(m, 1.4, 0.25), 30.5 + i * 0.12, pan=0.5 - 0.3 * i, send=0.8)

# ---------------------------------------------------------------- mix
t = np.arange(N) / SR
duck = np.ones(N)  # very gentle kick ducking so the groove breathes
for b in kicks:
    tk = b * BEAT
    m = t >= tk
    duck[m] = np.minimum(duck[m], 1 - 0.12 * np.exp(-(t[m] - tk) / 0.12))

irn = int(SR * 2.6)
it = np.arange(irn) / SR
ir = []
for pre in (0.015, 0.021):
    x = filt(rng.standard_normal(irn), 'lowpass', 5500) * np.exp(-it * 2.4)
    x[: int(SR * pre)] = 0
    ir.append(x)


def conv(x, h):
    n = len(x) + len(h)
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]


rev = [conv(send_L, ir[0]) * 0.07, conv(send_R, ir[1]) * 0.07]

# section dynamics on the music bus: intimate intro, lifts at b8 / b16 / b24
sec = np.interp(t, [0, 3.6, 4.95, 5.0, 9.95, 10.0, 14.9, 15.0, 20],
                [0.36, 0.40, 0.50, 0.66, 0.70, 0.88, 0.92, 1.05, 1.05])
mix = []
for c in (0, 1):
    m = (BUS['music'][c] + rev[c]) * duck * sec
    x = BUS['drums'][c] * 0.75 + m + BUS['fx'][c] * 0.9
    x = filt(x, 'highpass', 30)
    x = filt(x, 'lowpass', 14000)  # tame air
    mix.append(x)

# ending: fade gently to digital silence at 20.0 s
fade = np.ones(N)
f0, f1 = int(SR * 18.9), int(SR * 19.94)
fade[f0:f1] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, f1 - f0))
fade[f1:] = 0.0
mix = [c * fade for c in mix]
mix = [c - np.mean(c) * fade for c in mix]  # remove any DC (fade keeps the ends at 0)


def k_weight(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x))


def lufs(ch):
    w = [k_weight(c) for c in ch]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = []
    for s in range(0, N - blk + 1, hop):
        ms.append(sum(np.mean(c[s:s + blk] ** 2) for c in w))
    ms = np.array(ms)
    L = -0.691 + 10 * np.log10(np.maximum(ms, 1e-12))
    g = ms[L > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g = ms[(L > -70) & (L > rel)]
    return -0.691 + 10 * np.log10(np.mean(g))


def true_peak(ch):
    return max(np.abs(resample_poly(c, 4, 1)).max() for c in ch)


def compress(ch, thr_db=-16, ratio=1.6, att=0.01, rel=0.18):
    """Gentle glue compressor (stereo-linked, RMS-ish detector)."""
    lvl = np.sqrt(filt((ch[0] ** 2 + ch[1] ** 2) / 2, 'lowpass', 20, 1).clip(1e-12))
    ldb = 20 * np.log10(lvl)
    gr = np.minimum(0, (thr_db - ldb) * (1 - 1 / ratio))
    # smooth gain reduction
    a_a, a_r = np.exp(-1 / (SR * att)), np.exp(-1 / (SR * rel))
    out = np.empty_like(gr)
    cur = 0.0
    for i in range(len(gr)):
        cur = a_a * cur + (1 - a_a) * gr[i] if gr[i] < cur else a_r * cur + (1 - a_r) * gr[i]
        out[i] = cur
    g = 10 ** (out / 20)
    return [c * g for c in ch]


def limiter(ch, ceiling, release=0.12, look=0.003):
    la = int(SR * look)
    env = maximum_filter1d(np.maximum(np.abs(ch[0]), np.abs(ch[1])), size=2 * la + 1)
    g = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    a = np.exp(-1.0 / (SR * release))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    out = np.convolve(out, np.hanning(2 * la + 1) / np.hanning(2 * la + 1).sum(), 'same')
    return [c * out for c in ch]


peak = max(np.abs(mix[0]).max(), np.abs(mix[1]).max())
mix = [c / peak * 0.5 for c in mix]
mix = compress(mix)
ceil = 10 ** (TP_CEIL_DB / 20)
gain = 1.0
for it_ in range(6):
    out = limiter([c * gain for c in mix], ceil * 0.97)
    L = lufs(out)
    tp = true_peak(out)
    if tp > ceil:
        out = [c * ceil / tp for c in out]
        L = lufs(out)
        tp = true_peak(out)
    print(f'pass {it_}: gain {gain:.3f}  LUFS {L:.2f}  TP {20 * np.log10(tp):.2f} dBTP')
    if abs(L - TARGET_LUFS) < 0.15:
        break
    gain *= 10 ** ((TARGET_LUFS - L) / 20)

outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')
os.makedirs(outdir, exist_ok=True)
st = np.stack(out, 1)
st[-int(SR * 0.05):] = 0.0
pcm = np.round(np.clip(st, -1, 1) * 32767).astype(np.int16)
assert pcm.shape == (960000, 2)
wavfile.write(os.path.join(outdir, 'invite-music.wav'), SR, pcm)
print('invite-music.wav written', pcm.shape, 'beat', BEAT)
