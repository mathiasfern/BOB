"""Original 20 s score for the Bundle of Brave Fete youth cut (group chat -> gig poster).

Minimal UK garage / 2-step house. 120 BPM, BEAT = 0.5 s, 40 beats = 10 bars = 20.0 s.
Key: D minor, lifting to F major for the return and ending.

  b0-3    hook    : hard kick on b0, pitched "message pop" plucks on the 8ths
                    b0..b2.5 over a dry, sparse beat (kick, rim, a few hats)
  b3-5    typing  : hats + typing-dot ticks, filtered A-sus tension swell
  b5      link    : Rhodes/organ stab + pop; reaction blips b5.5, b5.75
  b6-8    build   : filtered kicks, reverse cymbal, riser, a 16th of silence
  b8-20   drop    : 2-step kick + clap, shuffled hats, round sub, detuned bell
                    hook, swung chord stabs  (Dm9 | Bbmaj9 | Gm9 | A7sus-A7)
                    word accents b9, b11, b13, b15, b17 (bell + stab)
                    b19 "this christmas": clap/hat fill + bell run into b20
  b20-26  breath  : drums out. Bbmaj9 -> Gm9 Rhodes + pad, vinyl texture
  b25-26  riser   : gentle noise/pitch riser back in
  b26-32  return  : groove + major lift (Fmaj9 | Bbmaj9 | C9sus-C)
                    "in." pops b26, 27, 28, 29, 29.5; bell flourish b31
  b32     end card: biggest hit - kick, crash, full Fmaj9 chord, sub
  b36     button  : final hit, F6/9 rings out, fade to silence by 20.0 s

Run:  python3 tools/compose_youth.py  ->  build/youth-music.wav
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, lfilter, resample_poly
from scipy.ndimage import maximum_filter1d
from scipy.io import wavfile

SR = 48000
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
DUR = 20.0
N = int(SR * DUR)          # 960000
TARGET_LUFS = -13.0
TP_CEIL_DB = -1.3
SWING = 0.155              # swung 16th offset in beats (straight = 0.125)
rng = np.random.default_rng(2012)

BUS = {k: [np.zeros(N), np.zeros(N)] for k in ('drums', 'music', 'fx', 'sub')}
send_L = np.zeros(N)
send_R = np.zeros(N)
kicks = []   # (beat, depth) for sidechain


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def at(beat):
    return int(round(beat * BEAT * SR))


def swb(b):
    """Swing a beat position that sits on a 16th offbeat (x.25 / x.75)."""
    fr = round(b % 1, 3)
    if fr in (0.25, 0.75):
        return int(b) + (0.5 if fr == 0.75 else 0.0) + SWING
    return b


def s16(step):
    """Swung 16th position (in beats) within a bar."""
    return (step // 2) * 0.5 + (step % 2) * SWING


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        sos = butter(order, [v / (SR / 2) for v in f], btype=kind, output='sos')
    else:
        sos = butter(order, f / (SR / 2), btype=kind, output='sos')
    return sosfilt(sos, x)


def fades(x, a=0.003, r=0.03):
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


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.1):
    t = np.arange(n) / SR
    hold = n / SR - r
    e = np.where(t < a, t / max(a, 1e-6),
                 np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-6), s))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return e * (1 - rel)


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    ph = (freq * t + phase) % 1.0
    return 2 * ph - 1


# ---------------------------------------------------------------- drums
def kick(hard=1.0, dur=0.38, tone=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 47 + 115 * np.exp(-t * 38) + 30 * np.exp(-t * 220)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (7.5 / tone))
    click = filt(rng.standard_normal(n), 'bandpass', [1500, 6000]) * np.exp(-t * 420) * 0.35 * hard
    x = np.tanh((body * (1.2 + 0.6 * hard) + click))
    return fades(x, 0.0008, 0.04) * 0.9


def clap(g=1.0):
    n = int(SR * 0.32)
    t = np.arange(n) / SR
    noise = filt(rng.standard_normal(n), 'bandpass', [900, 5500])
    env = np.zeros(n)
    for k, off in enumerate([0, 0.009, 0.019, 0.028]):
        tt = t - off
        env += np.where(tt >= 0, np.exp(-np.clip(tt, 0, None) * (160 if k < 3 else 17)), 0)
    body = np.sin(2 * np.pi * 195 * t) * np.exp(-t * 38) * 0.35
    snap = filt(rng.standard_normal(n), 'highpass', 4000) * np.exp(-t * 60) * 0.25
    return fades(noise * env * 0.8 + body + snap, 0.0008, 0.05) * 0.42 * g


def rim(g=1.0):
    n = int(SR * 0.08)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1650 * t) * np.exp(-t * 90) + np.sin(2 * np.pi * 520 * t) * np.exp(-t * 70) * 0.6
    x += filt(rng.standard_normal(n), 'highpass', 3000) * np.exp(-t * 200) * 0.3
    return fades(x, 0.0005, 0.02) * 0.16 * g


def hat(open_=False, g=1.0):
    n = int(SR * (0.22 if open_ else 0.05))
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'highpass', 7200)
    for fr in (5270, 7430, 8910, 10630):  # metallic partials
        x += np.sign(np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28))) * 0.08
    x = filt(x, 'highpass', 6500)
    env = np.exp(-t * (16 if open_ else 95))
    return fades(x * env, 0.0008, 0.015 if not open_ else 0.05) * 0.075 * g


def shaker(g=1.0):
    n = int(SR * 0.09)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [3500, 9500])
    env = (t / 0.018).clip(0, 1) ** 2 * np.exp(-np.clip(t - 0.018, 0, None) * 60)
    return fades(x * env, 0.001, 0.015) * 0.05 * g


def crash(g=1.0, dur=3.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [3000, 12000])
    for _ in range(14):
        x += np.sin(2 * np.pi * rng.uniform(3200, 9000) * t) * 0.12 * np.exp(-t * rng.uniform(0.8, 2.5))
    env = np.minimum(1, t / 0.004) * np.exp(-t * 1.25)
    return fades(x * env, 0.001, 0.4) * 0.11 * g


def reverse_cymbal(beats, g=1.0):
    n = int(SR * beats * BEAT)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'bandpass', [2800, 11000]) * np.exp(-t * 2.6)
    return fades(x[::-1], 0.05, 0.004) * 0.13 * g


def riser(beats, lo=300, hi=6000, g=1.0):
    """Noise riser: crossfade through bandpassed bands + rising filtered saw."""
    n = int(SR * beats * BEAT)
    t = np.arange(n) / SR
    p = t / t[-1]
    noise = rng.standard_normal(n)
    bands = np.geomspace(lo, hi, 7)
    out = np.zeros(n)
    for i, fc in enumerate(bands):
        w = np.clip(1 - np.abs(p * (len(bands) - 1) - i), 0, 1)
        out += filt(noise, 'bandpass', [fc * 0.7, fc * 1.4]) * w
    f = midi(57) * 2 ** (p * 1.0)  # up an octave
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)
    x = out * 0.5 + tone * 0.12
    return fades(x * p ** 2, 0.02, 0.01) * 0.35 * g


# ---------------------------------------------------------------- tonal
def sub(m, dur, g=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = midi(m)
    x = np.sin(2 * np.pi * f * t) + 0.12 * np.sin(2 * np.pi * 2 * f * t)
    x = np.tanh(x * 1.3) / np.tanh(1.3)
    return fades(x * env_adsr(n, 0.006, 0.12, 0.7, 0.06), 0.006, 0.06) * 0.30 * g


def rhodes(notes, dur, vel=1.0, bright=1.0):
    """FM electric piano: tine (1:1 FM with decaying index) + bark + tremolo."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m) * 2 ** (rng.uniform(-3, 3) / 1200)
        idx = (1.4 * bright * vel) * np.exp(-t * 5) + 0.25
        mod = np.sin(2 * np.pi * f * t) * idx
        car = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * (1.1 + f / 1400))
        tine = np.sin(2 * np.pi * f * 13.9 * t) * np.exp(-t * 55) * 0.05 * bright
        out += car + tine
    out /= max(1, len(notes)) ** 0.6
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * t)
    out = filt(out, 'lowpass', 4200 * bright + 800)
    return fades(out * trem, 0.002, 0.12) * 0.30 * vel


def organ(notes, dur, g=1.0):
    """Short drawbar-ish organ stab (house organ colour)."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        for h, a in ((1, 1.0), (2, 0.55), (3, 0.3), (4, 0.25), (6, 0.1)):
            if f * h < 9000:
                out += np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28)) * a
    out /= max(1, len(notes)) ** 0.6
    env = env_adsr(n, 0.003, 0.08, 0.45, min(0.06, dur / 2))
    return filt(fades(out * env, 0.002, 0.04), 'lowpass', 3000) * 0.10 * g


def stab(notes, dur=0.22, g=1.0):
    """UKG chord stab: Rhodes + organ layer, short."""
    r = rhodes(notes, dur + 0.35, 0.9, 1.1) * g
    o = organ(notes, dur, g)
    r[:len(o)] += o
    return r


def bell(m, dur=2.0, g=1.0, bright=1.0):
    """Detuned FM bell synth; returns (L, R) pair with voices detuned +/- 9 cents."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    outs = []
    for cents in (-9, 9):
        f = midi(m) * 2 ** (cents / 1200)
        idx = 2.2 * bright * np.exp(-t * 5.5) + 0.4
        mod = np.sin(2 * np.pi * f * 1.4 * t) * idx      # inharmonic ratio -> bell, not jingle
        car = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.2)
        sub8 = np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 3.5) * 0.18
        x = filt(car + sub8, 'lowpass', 7000)
        outs.append(fades(x, 0.0015, 0.1) * 0.17 * g)
    return outs


def place_bell(m, beat, dur=2.0, g=1.0, bright=1.0, send=0.5, width=0.55):
    L, R = bell(m, dur, g, bright)
    place(L, beat, pan=-width, send=send)
    place(R, beat, pan=width, send=send)


def pop(m, g=1.0):
    """Message pop: tiny pitch-dropping blip + plucked sine/triangle tone."""
    n = int(SR * 0.32)
    t = np.arange(n) / SR
    f = midi(m) * (1 + 0.9 * np.exp(-t * 140))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.25 * np.sin(2 * ph) * np.exp(-t * 30)
    x = tone * np.exp(-t * 14)
    bub = np.sin(2 * np.pi * np.cumsum(1400 * (1 + 2 * np.exp(-t * 300))) / SR) * np.exp(-t * 120) * 0.25
    return fades(filt(x + bub, 'lowpass', 7500), 0.0008, 0.05) * 0.24 * g


def blip(m, g=1.0):
    n = int(SR * 0.09)
    t = np.arange(n) / SR
    f = midi(m) * (1 + 0.5 * np.exp(-t * 200))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)
    return fades(x, 0.0008, 0.02) * 0.16 * g


def pad(notes, dur, cutoff=1400, a=0.6, r=0.8, g=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        for d in (-0.08, 0.0, 0.08):
            out += saw(f * 2 ** (d / 12), n, rng.uniform()) * 0.45
        out += np.sin(2 * np.pi * f * t) * 0.7
    out /= (3 * len(notes)) ** 0.5
    out = filt(filt(out, 'lowpass', cutoff), 'lowpass', cutoff * 1.5)
    return out * env_adsr(n, a, 0.3, 0.9, r) * 0.13 * g


def vinyl(dur, g=1.0):
    n = int(SR * dur)
    hiss = filt(rng.standard_normal(n), 'bandpass', [1500, 9000]) * 0.02
    cr = np.zeros(n)
    idx = rng.integers(0, n - 200, int(dur * 22))
    cr[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.2, 1.0, len(idx))
    cr = filt(cr, 'bandpass', [900, 7000])
    x = hiss + cr * 0.7
    return fades(x, 0.4, 0.6) * 0.09 * g


# ---------------------------------------------------------------- harmony
DM9 = [50, 57, 60, 64, 65]        # D A C E F
BBM9 = [46, 57, 60, 62, 65]       # Bb A C D F
GM9 = [43, 58, 62, 65, 69]        # G Bb D F A
A7S = [45, 55, 59, 62, 64]        # A G B D E  (sus)
A7 = [45, 55, 61, 64, 67]         # A G C# E G
FM9 = [41, 57, 60, 64, 67]        # F A C E G
C9S = [48, 58, 62, 65, 67]        # C Bb D F G
C7 = [48, 58, 60, 64, 67]
F69 = [41, 57, 62, 64, 67, 69]    # F A D E G A
STAB = {'Dm9': [60, 64, 65, 69], 'Bbm9': [60, 62, 65, 69], 'Gm9': [58, 62, 65, 69],
        'A7s': [59, 62, 64, 67], 'A7': [61, 64, 67, 69], 'Fm9': [60, 64, 67, 69],
        'C9s': [58, 62, 65, 67], 'C7': [58, 60, 64, 67]}
ROOTS = {'Dm9': 38, 'Bbm9': 34, 'Gm9': 31, 'A7s': 33, 'A7': 33, 'Fm9': 29, 'C9s': 36, 'C7': 36}
BAR_CH = {8: 'Dm9', 12: 'Bbm9', 16: 'Gm9', 26: 'Fm9', 28: 'Bbm9', 30: 'C9s', 32: 'Fm9', 34: 'Bbm9'}


def chord_at(b):
    if 18 <= b < 20:
        return 'A7s' if b < 19 else 'A7'
    if 30 <= b < 32:
        return 'C9s' if b < 31 else 'C7'
    keys = [k for k in BAR_CH if k <= b]
    return BAR_CH[max(keys)] if keys else 'Dm9'


# 2-step bar pattern (16th steps). kick: 1, (2.75 ghost), 3.5 ; clap on 2 & 4
KICK_STEPS = {0: 1.0, 10: 0.85}
KICK_VAR = {0: 1.0, 7: 0.5, 10: 0.85}     # second bar of each pair adds the skip
CLAP_STEPS = (4, 12)
STAB_STEPS = (3, 6, 11)                    # swung offbeat stabs


def groove_bar(b0, variant=0, stop_after=None, kick_g=1.0, lite=False):
    """One bar of 2-step from beat b0. stop_after: beat offset after which nothing plays."""
    ks = KICK_VAR if variant else KICK_STEPS
    for st in range(16):
        pos = s16(st)
        if stop_after is not None and pos >= stop_after:
            break
        b = b0 + pos
        if st in ks and not (lite and st == 7):
            place(kick(ks[st], tone=1.0 if ks[st] > 0.9 else 0.8), b, gain=0.95 * ks[st] * kick_g,
                  bus='drums')
            kicks.append((b, 0.45 * ks[st]))
        if st in CLAP_STEPS:
            place(clap(), b, pan=0.03, send=0.18, bus='drums')
        # shuffled hats: open-ish on the 8th offbeats, closed swung 16ths
        if st % 4 == 2:
            place(hat(True, 0.9), b, pan=0.25, send=0.05, bus='drums')
        elif st % 2 == 1:
            place(hat(False, 0.8 if st % 4 == 3 else 0.55), b, pan=-0.3, bus='drums')
        if st % 2 == 0 and not lite:
            place(shaker(0.7 if st % 4 else 0.4), b, pan=0.45, bus='drums')
        if st == 14 and variant and not lite:
            place(rim(0.8), b, pan=-0.4, send=0.2, bus='drums')


def bass_bar(b0, ch, stop_after=None, alt=None):
    """Round sub following the 2-step kick with a little octave pickup."""
    r = ROOTS[ch]
    notes = [(0.0, r, 1.1), (s16(7), r + 12, 0.25), (s16(10), r, 0.9), (s16(14), r + 12 if alt is None else alt, 0.3)]
    for pos, m, d in notes:
        if stop_after is not None and pos >= stop_after:
            continue
        place(sub(m, d * BEAT), b0 + pos, bus='sub')


def stabs_bar(b0, ch, stop_after=None, g=1.0):
    for st in STAB_STEPS:
        pos = s16(st)
        if stop_after is not None and pos >= stop_after:
            continue
        place(stab(STAB[chord_at(b0 + pos)], 0.14, 1.0), b0 + pos, pan=0.18 if st != 6 else -0.18,
              gain=0.7 * g, send=0.25)


# ================================================================ arrangement
# ----- b0-3: the hook. hard kick + message pops on 8ths over a dry sparse beat
place(kick(1.4, dur=0.5, tone=1.2), 0, gain=1.1, bus='drums')
kicks.append((0, 0.3))
place(sub(38, 0.45, 1.0), 0, bus='sub')
POPS0 = [(0.0, 74), (0.5, 77), (1.0, 81), (1.5, 76), (2.0, 84), (2.5, 81)]
for i, (b, m) in enumerate(POPS0):
    place(pop(m, 1.0 + 0.05 * i), b, pan=(-0.3 if i % 2 else 0.3), send=0.12)
for b in (1.0, 2.0):  # dry beat: rims + a couple of closed hats
    place(rim(1.0), b, pan=-0.2, send=0.05, bus='drums')
for b in (0.5, 1.5, 2.5):
    place(hat(False, 0.9), b, pan=0.3, bus='drums')
place(kick(0.8, tone=0.8), s16(10), gain=0.7, bus='drums')
kicks.append((s16(10), 0.2))

# ----- b3-5: typing indicator. hats + typing-dot ticks + tension swell
for i in range(8):
    place(hat(False, 0.45 + 0.25 * (i % 2)), 3 + i * 0.25 + (SWING - 0.125) * (i % 2), pan=0.3,
          bus='drums')
for k in range(2):  # the three bouncing dots, twice
    for j, m in enumerate((93, 95, 96)):
        place(blip(m, 0.35), 3 + k + j / 3, pan=-0.2 + 0.2 * j, send=0.2)
ten = pad([57, 62, 64, 69], 2 * BEAT + 0.2, cutoff=700, a=0.8, r=0.15, g=1.0)
ten *= np.linspace(0.3, 1, len(ten))
place(ten, 3, gain=1.1, send=0.3)
place(rhodes([88], 1.2, 0.35, 0.6), 3.5, pan=0.4, send=0.5)

# ----- b5: link card drops (stab + pop), reaction blips b5.5 / b5.75
place(stab(STAB['Bbm9'], 0.18), 5, pan=0.0, gain=1.2, send=0.35)
place(pop(81, 1.2), 5, send=0.2)
place(kick(0.9, tone=0.9), 5, gain=0.75, bus='drums')
kicks.append((5, 0.3))
place(sub(34, 0.7), 5, bus='sub')
place(blip(88, 0.9), 5.5, pan=0.35, send=0.25)
place(blip(91, 0.9), 5.75, pan=-0.35, send=0.25)

# ----- b6-8: build into the drop (filtered groove, reverse cymbal, riser, gap)
for b in (6, 6.5, 7, 7.5):
    kk = filt(kick(0.6, tone=0.7), 'lowpass', 900)
    place(kk, b, gain=0.55 + 0.1 * (b - 6), bus='drums')
for i in range(8):
    bb = 6 + i * 0.25 + (SWING - 0.125) * (i % 2)
    if bb < 7.75:
        place(hat(i % 2 == 0, 0.5 + 0.06 * i), bb, pan=0.25, bus='drums')
place(clap(0.5), 7, send=0.4, bus='drums')
place(reverse_cymbal(1.75, 1.0), 6, pan=0.0, bus='fx')
rz = riser(1.75, 300, 7000, 0.8)
place(rz, 6, bus='fx')
bl = pad([57, 61, 64, 67], 1.75 * BEAT, cutoff=1100, a=0.9, r=0.03, g=1.2)
place(bl * np.linspace(0.2, 1, len(bl)), 6, send=0.3)

# ----- b8-20: THE DROP
place(crash(0.8, 2.5), 8, pan=0.2, send=0.2, bus='fx')
for bi, b0 in enumerate(range(8, 16, 4)):
    ch = chord_at(b0)
    groove_bar(b0, variant=bi % 2)
    bass_bar(b0, ch)
    stabs_bar(b0, ch)
    place(pad([n + 12 for n in (STAB[ch])], 4 * BEAT + 0.3, cutoff=1500, a=0.08, r=0.3, g=0.8),
          b0, send=0.3)
# bar 4 (b16-20): Gm9 two beats, A7sus b18, A7 b19, fill on b19
groove_bar(16, variant=1, stop_after=3.0)
bass_bar(16, 'Gm9', stop_after=2.0)
place(sub(33, 0.9), 18, bus='sub')
place(sub(45, 0.35), 19, bus='sub')
stabs_bar(16, 'Gm9', stop_after=3.0)
place(pad([n + 12 for n in STAB['Gm9']], 2 * BEAT + 0.2, cutoff=1500, a=0.08, r=0.2, g=0.8), 16, send=0.3)
place(pad([n + 12 for n in STAB['A7s']], BEAT + 0.1, cutoff=1500, a=0.05, r=0.1, g=0.8), 18, send=0.3)
place(pad([n + 12 for n in STAB['A7']], BEAT, cutoff=1800, a=0.05, r=0.15, g=0.9), 19, send=0.3)

# bell hook (words land on b9, 11, 13, 15, 17 -> accented)
HOOK = [(8, 81, .75), (8.75, 84, .25), (9, 86, 1), (10, 81, .75), (10.75, 79, .25), (11, 81, .75),
        (11.75, 84, .25), (12, 86, .75), (12.75, 84, .25), (13, 81, 1), (14, 77, .75),
        (14.75, 79, .25), (15, 81, .75), (15.75, 86, .25), (16, 86, .75), (16.75, 84, .25),
        (17, 82, 1), (18, 81, .75), (18.75, 79, .25)]
WORDS = (9, 11, 13, 15, 17)
for b, m, d in HOOK:
    acc = b in WORDS
    place_bell(m, swb(b), 1.6 if acc else 1.1, 1.15 if acc else 0.75, 1.1 if acc else 0.8, 0.45)
for b in WORDS:  # word accent: stab + higher bell octave glint
    place(stab(STAB[chord_at(b)], 0.2, 1.0), b, pan=0.0, gain=0.8, send=0.35)
    L, R = bell(98 if b != 17 else 94, 1.2, 0.35, 0.7)
    place(L, b, pan=-0.7, send=0.6)
    place(R, b + 0.01, pan=0.7, send=0.6)

# b19 "this christmas": clap/hat roll + bell run into b20
for i in range(4):
    place(clap(0.45 + 0.15 * i), 19 + i * 0.25, pan=-0.1 + 0.07 * i, send=0.3, bus='drums')
    place(hat(False, 0.9), 19 + i * 0.25 + 0.125, pan=0.3, bus='drums')
place(kick(1.0), 19, gain=0.8, bus='drums')
kicks.append((19, 0.35))
for i, m in enumerate((81, 85, 88, 91)):
    place_bell(m, 19 + i * 0.25, 1.4, 0.55 + 0.1 * i, 0.9, 0.6, 0.3 + 0.1 * i)
place(reverse_cymbal(1.0, 0.7), 19, bus='fx')

# ----- b20-26: breath. drums out; warm Rhodes + pad + vinyl
place(vinyl(6.4, 1.0), 19.8, pan=0.0, bus='fx')
place(rhodes([46, 57, 62, 65, 69, 72], 4 * BEAT + 1.2, 0.75, 0.8), 20, pan=-0.1, send=0.5)
place(pad([46, 53, 57, 62, 65, 72], 4 * BEAT + 0.8, cutoff=1100, a=0.5, r=0.9, g=1.1), 20, send=0.45)
place(rhodes([81], 1.6, 0.4, 0.6), 21.5, pan=0.3, send=0.6)
place(rhodes([79], 1.6, 0.35, 0.6), 22.5, pan=0.3, send=0.6)
place(rhodes([43, 58, 62, 65, 69], 2 * BEAT + 1.0, 0.65, 0.8), 24, pan=-0.1, send=0.5)
place(pad([43, 50, 58, 62, 65, 69], 2 * BEAT + 0.6, cutoff=1100, a=0.3, r=0.6, g=1.0), 24, send=0.45)
place(rhodes([48, 58, 62, 65, 67], 1.2, 0.55, 0.8), 25, pan=0.1, send=0.5)
# b25-26: gentle riser back in
place(riser(1.0, 400, 8000, 0.7), 25, bus='fx')
place(reverse_cymbal(1.0, 0.8), 25, pan=0.1, bus='fx')
sw = pad([60, 64, 67, 72], BEAT + 0.02, cutoff=1600, a=0.4, r=0.02, g=1.0)
place(sw * np.linspace(0.1, 1, len(sw)), 25, send=0.3)

# ----- b26-32: groove returns with the major lift
place(crash(0.55, 2.0), 26, pan=-0.2, send=0.2, bus='fx')
for bi, b0 in enumerate((26, 28)):
    ch = chord_at(b0)
    groove_bar(b0, variant=bi % 2, stop_after=2.0)
    bass_bar(b0, ch, stop_after=2.0)
    stabs_bar(b0, ch, stop_after=2.0)
    place(pad([n + 12 for n in STAB[ch]], 2 * BEAT + 0.2, cutoff=1700, a=0.05, r=0.2, g=0.85), b0, send=0.3)
    place(rhodes(FM9 if ch == 'Fm9' else BBM9, 2 * BEAT + 0.4, 0.6, 0.9), b0, pan=-0.15, send=0.35)
groove_bar(30, variant=1)
bass_bar(30, 'C9s', stop_after=3.0)
place(sub(36, 0.4), 31, bus='sub')
stabs_bar(30, 'C9s', stop_after=3.0)
place(pad([n + 12 for n in STAB['C9s']], BEAT + 0.1, cutoff=1700, a=0.05, r=0.1, g=0.85), 30, send=0.3)
place(pad([n + 12 for n in STAB['C7']], BEAT, cutoff=2000, a=0.05, r=0.1, g=0.9), 31, send=0.3)
# "in." pops b26, 27, 28, 29, 29.5
for i, (b, m) in enumerate([(26, 81), (27, 84), (28, 86), (29, 89), (29.5, 91)]):
    place(pop(m, 1.05), b, pan=0.3 if i % 2 else -0.3, send=0.15)
# light bell answers between the pops
for b, m in [(26.75, 76), (27.75, 79), (28.75, 81), (30, 84), (30.75, 82)]:
    place_bell(m, swb(b), 1.1, 0.55, 0.8, 0.45)
# b31: group renamed -> bell flourish up to the end card
for i, m in enumerate((84, 86, 88, 91, 93, 96)):
    place_bell(m, 31 + i / 6, 1.2, 0.5 + 0.08 * i, 0.9, 0.55, 0.2 + 0.1 * i)
place(reverse_cymbal(1.0, 0.9), 31, bus='fx')
place(clap(0.6), 31.5, send=0.3, bus='drums')
place(clap(0.8), 31.75, send=0.3, bus='drums')

# ----- b32: END CARD SLAM (biggest hit)
place(kick(1.6, dur=0.55, tone=1.3), 32, gain=1.15, bus='drums')
kicks.append((32, 0.3))
place(clap(1.3), 32, send=0.4, bus='drums')
place(crash(1.4, 3.6), 32, pan=0.1, send=0.3, bus='fx')
place(sub(29, 1.6, 1.15), 32, bus='sub')
place(stab(STAB['Fm9'] + [72], 0.35, 1.3), 32, gain=1.1, send=0.45)
place(rhodes(FM9 + [72, 76], 2.2, 1.0, 1.0), 32, pan=0.1, send=0.45)
place(pad(FM9 + [72, 76], 2 * BEAT + 0.5, cutoff=2200, a=0.01, r=0.5, g=1.2), 32, send=0.45)
place_bell(89, 32, 2.4, 1.2, 1.0, 0.6)
place_bell(96, 32.01, 2.0, 0.5, 0.8, 0.6, 0.8)
# b32-36: groove rides out lighter under the end card
groove_bar(32, variant=0, lite=True)
bass_bar(32, 'Fm9', stop_after=4.0)
groove_bar(34, variant=0, stop_after=1.5, lite=True, kick_g=0.9)   # to b35.5 then gap
place(sub(34, 0.6), 34, bus='sub')
stabs_bar(34, 'Bbm9', stop_after=1.5, g=0.9)
place(pad([n + 12 for n in STAB['Bbm9']], 1.5 * BEAT + 0.2, cutoff=1700, a=0.05, r=0.2, g=0.8), 34, send=0.3)
for b, m in [(33.5, 84), (34, 86), (34.75, 84), (35, 81)]:
    place_bell(m, swb(b), 1.2, 0.6, 0.8, 0.5)

# ----- b36: final button, F6/9 rings out
place(kick(1.3, dur=0.5, tone=1.2), 36, gain=1.0, bus='drums')
kicks.append((36, 0.25))
place(clap(0.9), 36, send=0.5, bus='drums')
place(crash(0.8, 3.5), 36, pan=-0.1, send=0.3, bus='fx')
place(sub(29, 2.2, 1.0), 36, bus='sub')
place(stab(STAB['Fm9'], 0.3, 1.1), 36, gain=1.0, send=0.5)
place(rhodes(F69 + [72, 76], 4.0, 0.95, 0.9), 36, pan=0.0, send=0.55)
place(pad(F69 + [72], 4.0, cutoff=1600, a=0.02, r=2.0, g=1.1), 36, send=0.5)
place_bell(93, 36, 3.5, 1.0, 0.9, 0.8)
place_bell(86, 36.02, 3.5, 0.6, 0.7, 0.7, 0.3)
place(vinyl(4.0, 0.7), 36, bus='fx')

# ================================================================ mix
t = np.arange(N) / SR
duck = np.ones(N)
for b, depth in kicks:
    tk = b * BEAT
    s = int(tk * SR)
    e = min(N, s + int(SR * 0.4))
    tt = t[s:e] - tk
    duck[s:e] = np.minimum(duck[s:e], 1 - depth * np.exp(-tt / 0.09) * np.minimum(1, tt / 0.004 + 0.3))
sub_duck = np.ones(N)
for b, depth in kicks:  # keep sub out of the kick's way for a punchy, un-boomy low end
    tk = b * BEAT
    s = int(tk * SR)
    e = min(N, s + int(SR * 0.2))
    tt = t[s:e] - tk
    sub_duck[s:e] = np.minimum(sub_duck[s:e], 1 - 0.6 * np.exp(-tt / 0.05))

irn = int(SR * 2.2)
it = np.arange(irn) / SR
ir = []
for pre in (0.012, 0.019):
    x = filt(rng.standard_normal(irn), 'lowpass', 6500) * np.exp(-it * 2.8)
    x = filt(x, 'highpass', 250)
    x[: int(SR * pre)] = 0
    ir.append(x)


def conv(x, h):
    n = len(x) + len(h)
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]


rev = [conv(send_L, ir[0]) * 0.08, conv(send_R, ir[1]) * 0.08]

mix = []
for c in (0, 1):
    subm = filt(BUS['sub'][c], 'lowpass', 180) * sub_duck
    music = BUS['music'][c] * duck + rev[c] * (0.6 + 0.4 * duck)
    x = BUS['drums'][c] * 0.9 + music + BUS['fx'][c] * 0.9 + subm * 0.95
    x = filt(x, 'highpass', 28)
    x = filt(x, 'lowpass', 16000)
    mix.append(x)

fade = np.ones(N)
f0, f1 = int(SR * 18.6), int(SR * 19.95)
fade[f0:f1] = (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, f1 - f0))) ** 1.3
fade[f1:] = 0.0
mix = [c * fade for c in mix]
mix = [c - np.mean(c) * fade for c in mix]


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


def compress(ch, thr_db=-18, ratio=2.0, att=0.008, rel=0.15):
    lvl = np.sqrt(filt((ch[0] ** 2 + ch[1] ** 2) / 2, 'lowpass', 25, 1).clip(1e-12))
    ldb = 20 * np.log10(lvl)
    gr = np.minimum(0, (thr_db - ldb) * (1 - 1 / ratio))
    a_a, a_r = np.exp(-1 / (SR * att)), np.exp(-1 / (SR * rel))
    out = np.empty_like(gr)
    cur = 0.0
    for i in range(len(gr)):
        cur = a_a * cur + (1 - a_a) * gr[i] if gr[i] < cur else a_r * cur + (1 - a_r) * gr[i]
        out[i] = cur
    g = 10 ** (out / 20)
    return [c * g for c in ch]


def limiter(ch, ceiling, release=0.08, look=0.003):
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
for it_ in range(8):
    out = limiter([c * gain for c in mix], ceil * 0.95)
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
wavfile.write(os.path.join(outdir, 'youth-music.wav'), SR, pcm)
print('youth-music.wav written', pcm.shape, 'beat', BEAT)
