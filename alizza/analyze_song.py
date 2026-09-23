"""Beat / bar / section analysis of the song -> song.json

usage: python3 analyze_song.py song.mp3 song.json
"""
import sys, json
import numpy as np, librosa

path, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(path, sr=22050, mono=True)
dur = len(y) / sr
hop = 512
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beat_frames = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, trim=False)
tempo = float(np.atleast_1d(tempo)[0])
beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
# fill leading gap with extrapolated beats so the intro also has a grid
period = 60.0 / tempo
pre = []
t = beats[0] - period
while t > 0.2:
    pre.append(t); t -= period
beats = np.concatenate([np.array(sorted(pre)), beats])
# downbeats: choose the phase (0..3) whose beats carry the most onset energy + low-frequency energy
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
low = S[: int(2048 * 150 / sr)].sum(axis=0)
lowe = librosa.util.normalize(low)
bframes = librosa.time_to_frames(beats, sr=sr, hop_length=hop)
bframes = np.clip(bframes, 0, len(oenv) - 1)
score = [float(np.mean(oenv[bframes[p::4]]) + np.mean(lowe[bframes[p::4]])) for p in range(4)]
phase = int(np.argmax(score))
downbeats = beats[phase::4]
# energy envelope (RMS) per beat, and per second
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
rms_t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
beat_energy = [float(np.mean(rms[(rms_t >= b) & (rms_t < b + period)]) if np.any((rms_t >= b) & (rms_t < b + period)) else 0) for b in beats]
# onsets (for accent cuts)
onsets = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=hop, units="time", backtrack=False, delta=0.25)
onset_str = oenv[np.clip(librosa.time_to_frames(onsets, sr=sr, hop_length=hop), 0, len(oenv) - 1)]
# structural segmentation: agglomerative on chroma+mfcc, ~10 sections, snapped to downbeats
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
feat = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
feat_sync = librosa.util.sync(feat, bframes, aggregate=np.median)
k = max(4, min(14, int(dur / 25)))
bounds = librosa.segment.agglomerative(feat_sync, k)
bound_times = [float(beats[min(b, len(beats) - 1)]) for b in bounds] + [dur]
sections = []
for i in range(len(bound_times) - 1):
    a, b = bound_times[i], bound_times[i + 1]
    m = (rms_t >= a) & (rms_t < b)
    sections.append(dict(start=round(a, 3), end=round(b, 3), energy=float(np.mean(rms[m])) if m.any() else 0.0))
emax = max(s["energy"] for s in sections) or 1
for s in sections:
    s["rel"] = round(s["energy"] / emax, 3)
    s["kind"] = "high" if s["rel"] > 0.8 else ("mid" if s["rel"] > 0.55 else "low")
json.dump(dict(file=path, duration=round(dur, 3), tempo=round(tempo, 2), period=round(period, 4), phase=phase,
               beats=[round(float(b), 4) for b in beats], downbeats=[round(float(b), 4) for b in downbeats],
               beat_energy=[round(e, 5) for e in beat_energy],
               onsets=[[round(float(t), 4), round(float(s), 3)] for t, s in zip(onsets, onset_str)],
               sections=sections), open(out, "w"), indent=1)
print(f"dur {dur:.1f}s tempo {tempo:.1f} bpm beats {len(beats)} downbeats {len(downbeats)} sections {len(sections)}")
for s in sections:
    print(f"  {s['start']:7.2f} - {s['end']:7.2f}  {s['kind']:4s} rel={s['rel']}")
