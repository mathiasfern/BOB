"""Original 15 s festive-EDM score for the Bundle of Brave Fete teaser.

128 BPM, D major, 8 bars = exactly 15.0 s. Every visual cue in src/teaser.js is
locked to this grid (BEAT = 60/128 s).

  bars 1-2  intro   : celesta hook, sleigh bells, pad swell, snare-roll riser
  bars 3-6  drop    : four-on-the-floor, pumping bass + supersaw, bell/saw lead
  bar  7    finale  : title slam, brass stabs, fill
  bar  8    button  : final chord, sparkle gliss, last hit + ring-out

Run:  python3 tools/compose.py  ->  build/music.wav
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000
BPM = 128.0
BEAT = 60.0 / BPM
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

BUS = {k: [np.zeros(N), np.zeros(N)] for k in ('drums', 'music', 'fx')}
send_L = np.zeros(N)   # reverb send
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


# ---------------------------------------------------------------- instruments
def kick(big=False):
    n = int(SR * (0.55 if big else 0.32))
    t = np.arange(n) / SR
    f = 44 + 150 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (5 if big else 9))
    click = filt(rng.standard_normal(n), 'highpass', 3000) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6) * 0.95


def clap():
    n = int(SR * 0.3)
    t = np.arange(n) / SR
    noise = filt(rng.standard_normal(n), 'bandpass', [900, 5200])
    env = np.zeros(n)
    for k, off in enumerate([0, 0.009, 0.018, 0.027]):
        tt = t - off
        env += np.where(tt >= 0, np.exp(-np.clip(tt, 0, None) * (160 if k < 3 else 14)), 0)
    return noise * env * 0.55


def snare(g=1.0):
    n = int(SR * 0.18)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.5
    noise = filt(rng.standard_normal(n), 'bandpass', [1500, 9000]) * np.exp(-t * 28)
    return (tone + noise) * 0.45 * g


def hat(open_=False):
    n = int(SR * (0.22 if open_ else 0.05))
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'highpass', 7500)
    return x * np.exp(-t * (14 if open_ else 90)) * (0.22 if open_ else 0.16)


def sleigh(accent=1.0):
    """Jingle-bell shake: inharmonic metal partials + bright noise."""
    n = int(SR * 0.16)
    t = np.arange(n) / SR
    out = filt(rng.standard_normal(n), 'bandpass', [5000, 13000]) * 0.5
    for _ in range(6):
        f = rng.uniform(3200, 9500)
        out += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * rng.uniform(0.2, 0.5)
    # a few jingles rattling slightly after one another
    env = np.zeros(n)
    for off in rng.uniform(0, 0.02, 4):
        tt = t - off
        env += np.where(tt >= 0, np.exp(-np.clip(tt, 0, None) * 45), 0)
    return out * env * 0.05 * accent


def bell(m, dur=1.2, bright=1.0):
    """FM celesta / glockenspiel."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = midi(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * (2.2 * bright) * np.exp(-t * 7)
    car = np.sin(2 * np.pi * f * t + mod)
    shimmer = np.sin(2 * np.pi * f * 2 * t) * 0.25 * np.exp(-t * 5)
    return (car + shimmer) * np.exp(-t * 3.2) * np.minimum(1, t / 0.002) * 0.32


def supersaw(notes, dur, cutoff=5000, voices=7, detune=0.18, a=0.01, r=0.08):
    n = int(SR * dur)
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            out += saw(f * 2 ** (d / 12), n, rng.uniform())
    out /= (voices * len(notes)) ** 0.5
    out = filt(out, 'lowpass', cutoff)
    return out * env_adsr(n, a, 0.15, 0.8, r) * 0.22


def lead(m, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = midi(m)
    x = saw(f, n) + saw(f * 1.005, n, 0.3) * 0.7 + np.sin(2 * np.pi * f * 2 * t) * 0.2
    cut = 1800 + 5000 * np.exp(-t * 10)
    # cheap time-varying filter: blend two static filters
    lo, hi = filt(x, 'lowpass', 1800), filt(x, 'lowpass', 6800)
    k = (cut - 1800) / 5000
    x = lo * (1 - k) + hi * k
    return x * env_adsr(n, 0.004, 0.08, 0.7, 0.05) * 0.10


def bass(m, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = midi(m)
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * t) * 0.8
    x = filt(x, 'lowpass', 700 + 900 * 0.5)
    return np.tanh(x * 1.8) * env_adsr(n, 0.003, 0.06, 0.8, 0.03) * 0.34


def brass(notes, dur=0.35):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = midi(m)
        for d in (-0.08, 0, 0.08):
            out += saw(f * 2 ** (d / 12), n, rng.uniform())
    lo, hi = filt(out, 'lowpass', 900), filt(out, 'lowpass', 5200)
    k = np.exp(-t * 9)
    out = lo * (1 - k) + hi * k
    return out * env_adsr(n, 0.006, 0.12, 0.5, 0.08) * 0.12


def riser(beats):
    n = int(SR * beats * BEAT)
    t = np.arange(n) / SR
    p = t / t[-1]
    x = rng.standard_normal(n)
    # sweep a bandpass upward in chunks
    out = np.zeros(n)
    chunks = 24
    for i in range(chunks):
        s, e = i * n // chunks, (i + 1) * n // chunks
        fc = 400 * (12000 / 400) ** (i / chunks)
        seg = filt(x[max(0, s - 2000):e], 'bandpass', [fc * 0.7, min(fc * 1.5, 22000)])
        out[s:e] = seg[-(e - s):]
    tone = saw(1, n) * 0
    ph = 2 * np.pi * np.cumsum(220 * 2 ** (p * 2.5)) / SR
    tone = np.sin(ph) * 0.15 + np.sin(ph * 1.5) * 0.08
    return (out * 0.35 + tone) * p ** 2.2


def impact():
    n = int(SR * 2.2)
    t = np.arange(n) / SR
    f = 30 + 90 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crash = filt(rng.standard_normal(n), 'highpass', 4000) * np.exp(-t * 2.8) * 0.25
    return np.tanh(boom * 1.4) * 0.8 + crash


def reverse_cymbal(beats):
    n = int(SR * beats * BEAT)
    t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'highpass', 5000) * np.exp(-t * 3)
    return x[::-1] * 0.25


def sub_drop():
    n = int(SR * 1.2)
    t = np.arange(n) / SR
    f = 80 * np.exp(-t * 1.6) + 30
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2) * 0.7


# ---------------------------------------------------------------- arrangement
kicks = []  # beats where kick lands (for sidechain)

CHORDS = {  # pad voicings
    'D': [62, 66, 69, 74], 'A': [61, 64, 69, 73], 'Bm': [62, 66, 71, 74], 'G': [62, 67, 71, 74],
}
ROOT = {'D': 38, 'A': 33, 'Bm': 35, 'G': 31}

# ----- intro (beats 0-8)
place(impact(), 0, gain=0.9, send=0.3, bus='fx')
place(reverse_cymbal(0.5), 0, bus='fx')  # tiny swell at the top (starts at 0)
# celesta hook
intro_hook = [(0, 86), (0.5, 81), (1, 78), (1.5, 81), (2, 86), (2.5, 88), (3, 90),
              (4, 88), (4.5, 86), (5, 83), (5.5, 86), (6, 85), (6.5, 81), (7, 88)]
for b, m in intro_hook:
    place(bell(m, 1.4), b, pan=0.35 if (b * 2) % 2 else -0.35, gain=0.9, send=0.5)
    place(bell(m + 12, 0.8, 0.6), b, pan=0.0, gain=0.18, send=0.6)
# pad swell
pad = supersaw(CHORDS['D'], 4 * BEAT, cutoff=1400, a=0.8, r=0.2)
place(pad, 0, pan=-0.2, gain=0.9, send=0.4)
place(supersaw(CHORDS['G'], 2 * BEAT, cutoff=1800, a=0.3, r=0.1), 4, gain=0.9, send=0.4)
place(supersaw(CHORDS['A'], 2 * BEAT, cutoff=2600, a=0.2, r=0.05), 6, gain=0.9, send=0.4)
# sleigh bells 16ths through the intro, getting louder
for i in range(32):
    b = i * 0.25
    place(sleigh((1.0 if i % 2 == 0 else 0.6) * (0.6 + 0.5 * b / 8)), b, pan=0.5, send=0.2)
# heartbeat kicks in bar 2 (beats 4..6), then snare roll 6..8
for b in (4, 5):
    place(kick(), b, gain=0.7, bus='drums')
    kicks.append(b)
roll = [6 + i * 0.25 for i in range(4)] + [7 + i * 0.125 for i in range(7)]
for i, b in enumerate(roll):
    place(snare(0.4 + 0.7 * i / len(roll)), b, pan=0.1, send=0.15, bus='drums')
place(riser(4), 4, gain=0.7, send=0.2, bus='fx')
place(reverse_cymbal(1.5), 6.5, gain=0.9, bus='fx')

# ----- drop (beats 8-24) + finale bar 7 (24-28)
prog = ['D', 'A', 'Bm', 'G', 'D']  # bars 3,4,5,6,7
lead_rhythm = [(0, 0.5), (0.5, 0.5), (1.0, 0.75), (1.75, 0.75), (2.5, 0.5), (3.0, 1.0)]
lead_notes = {
    'D': [81, 86, 90, 88, 86, 81], 'A': [81, 85, 88, 85, 83, 81],
    'Bm': [83, 86, 90, 88, 86, 83], 'G': [79, 83, 86, 88, 90, 93],
}
for bi, ch in enumerate(prog):
    b0 = 8 + bi * 4
    for k in range(4):
        b = b0 + k
        place(kick(big=(k == 0)), b, gain=1.0, bus='drums')
        kicks.append(b)
        place(hat(True), b + 0.5, pan=0.2, send=0.05, bus='drums')
        place(hat(), b + 0.25, pan=-0.3, bus='drums')
        place(hat(), b + 0.75, pan=-0.3, bus='drums')
        if k in (1, 3):
            place(clap(), b, pan=0.0, send=0.25, bus='drums')
        # pumping offbeat bass + root on the ‘and’ of every beat
        place(bass(ROOT[ch], 0.45 * BEAT), b + 0.5)
        place(bass(ROOT[ch] + 12, 0.2 * BEAT), b + 0.75, gain=0.5)
    for i in range(16):
        place(sleigh(1.0 if i % 2 == 0 else 0.5), b0 + i * 0.25, pan=0.55, send=0.1)
    place(supersaw(CHORDS[ch], 4 * BEAT, cutoff=5200 if bi < 4 else 7000), b0, pan=0.0, gain=1.0, send=0.25)
    place(supersaw([n + 12 for n in CHORDS[ch][:3]], 4 * BEAT, cutoff=6000, voices=5), b0, gain=0.35, send=0.3)
    notes = lead_notes['D' if ch == 'D' else ch]
    for (rb, rd), m in zip(lead_rhythm, notes):
        place(lead(m, rd * BEAT * 0.95), b0 + rb, pan=0.1, gain=1.0, send=0.25)
        place(bell(m, 1.0), b0 + rb, pan=-0.25, gain=0.55, send=0.4)
    # crash on each downbeat of the drop sections
    if bi in (0, 4):
        place(impact(), b0, gain=0.55, send=0.35, bus='fx')
        place(sub_drop(), b0, gain=0.8, bus='fx')

# bar 6 build (beats 20-24): 8th brass stabs + riser + snare fill into finale
for i in range(8):
    b = 20 + i * 0.5
    place(brass([74, 78, 81] if i < 4 else [79, 83, 86], 0.18), b, gain=0.8, send=0.2)
place(riser(4), 20, gain=0.55, send=0.2, bus='fx')
for i, b in enumerate([22 + j * 0.25 for j in range(4)] + [23 + j * 0.125 for j in range(8)]):
    place(snare(0.5 + 0.6 * i / 12), b, pan=-0.1, send=0.1, bus='drums')
place(reverse_cymbal(2), 22, bus='fx')

# finale bar 7 (24-28): brass stab hits on the title slams
for b, notes in [(24, [74, 78, 81, 86]), (25.5, [74, 78, 81, 86]), (26, [76, 79, 83, 88]), (27, [78, 81, 85, 90]), (27.5, [81, 85, 88, 93])]:
    place(brass(notes, 0.3), b, gain=1.1, send=0.3)
for i, b in enumerate([27 + j * 0.125 for j in range(8)]):
    place(snare(0.4 + 0.5 * i / 8), b, send=0.1, bus='drums')

# ----- button bar 8 (28-32)
place(kick(big=True), 28, gain=1.1, bus='drums')
kicks.append(28)
place(impact(), 28, gain=0.9, send=0.4, bus='fx')
place(sub_drop(), 28, gain=0.9, bus='fx')
place(supersaw([62, 66, 69, 73, 76], 4 * BEAT, cutoff=6500, a=0.005, r=1.2), 28, gain=1.1, send=0.5)
place(brass([74, 78, 81, 86], 0.8), 28, gain=1.2, send=0.4)
# sparkle glissando down then up
gliss = [98, 97, 95, 93, 90, 88, 86, 85, 83, 81, 86, 90, 93, 98]
for i, m in enumerate(gliss):
    place(bell(m, 1.6, 0.7), 28.25 + i * 0.125, pan=np.sin(i) * 0.6, gain=0.5, send=0.7)
for i in range(8):
    place(sleigh(0.9 - i * 0.08), 28 + i * 0.25, pan=0.5, send=0.4)
# last button: "hey!" hit on beat 30
place(kick(big=True), 30, gain=1.1, bus='drums')
place(clap(), 30, gain=1.2, send=0.5, bus='drums')
place(brass([74, 78, 81, 86, 90], 1.2), 30, gain=1.3, send=0.6)
place(bell(98, 2.5), 30, gain=0.6, send=0.8)
place(bell(86, 2.5), 30, gain=0.6, send=0.8)

# ---------------------------------------------------------------- mix
# sidechain pump: only the music bus ducks, so kicks keep their full punch
t = np.arange(N) / SR
duck = np.ones(N)
for b in kicks:
    tk = b * BEAT
    m = t >= tk
    duck[m] = np.minimum(duck[m], 1 - 0.5 * np.exp(-(t[m] - tk) / 0.11))

# reverb: synthetic stereo IR
irn = int(SR * 1.8)
it = np.arange(irn) / SR
ir_l = filt(rng.standard_normal(irn), 'lowpass', 7000) * np.exp(-it * 3.6)
ir_r = filt(rng.standard_normal(irn), 'lowpass', 7000) * np.exp(-it * 3.6)
ir_l[: int(SR * 0.012)] = 0
ir_r[: int(SR * 0.017)] = 0


def conv(x, h):
    n = len(x) + len(h)
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]


rev = [conv(send_L, ir_l) * 0.08, conv(send_R, ir_r) * 0.08]

# section gain on the music bus: intro sits back so the drop lands
sec = np.interp(t, [0, 3.70, 3.75, 15], [0.55, 0.62, 1.0, 1.0])
mix = []
for c in (0, 1):
    m = (BUS['music'][c] + rev[c]) * duck * sec
    x = BUS['drums'][c] * 1.15 + m + BUS['fx'][c] * 0.9
    mix.append(filt(x, 'highpass', 28))


def limiter(ch, ceiling=0.88, drive=2.2, release=0.08):
    from scipy.ndimage import maximum_filter1d
    x = [c * drive for c in ch]
    env = maximum_filter1d(np.maximum(np.abs(x[0]), np.abs(x[1])), size=int(SR * 0.004))
    g = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    # instant attack (look-ahead via max filter), smooth release
    a = np.exp(-1.0 / (SR * release))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    return [np.clip(c * out, -ceiling, ceiling) for c in x]


peak = max(np.abs(mix[0]).max(), np.abs(mix[1]).max())
mix = [c / peak for c in mix]
mixL, mixR = limiter(mix)
fade = np.ones(N)
fs = int(SR * 0.6)
fade[-fs:] = np.linspace(1, 0, fs) ** 2
mixL *= fade
mixR *= fade

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'build'), exist_ok=True)
out = np.stack([mixL, mixR], 1)
wavfile.write(os.path.join(os.path.dirname(__file__), '..', 'build', 'music.wav'), SR,
              (out * 32767).astype(np.int16))
print('music.wav written', out.shape, 'beat', BEAT)
