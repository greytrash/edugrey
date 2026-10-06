"""Per-clip features from the proxies -> catalog.json

For each proxy: duration, per-half-second motion energy and brightness, internal hard cuts (scene changes),
so the EDL builder can pick stable sub-ranges and avoid crossing an internal cut.
usage: python3 catalog.py proxies manifest.json catalog.json
"""
import sys, os, json, subprocess, re
import numpy as np, cv2
from concurrent.futures import ProcessPoolExecutor

PROX, MAN, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
man = json.load(open(MAN))["clips"]

def analyze(key):
    p = os.path.join(PROX, key + ".mp4")
    if not os.path.exists(p):
        return key, None
    cap = cv2.VideoCapture(p)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    prev = None; motion = []; bright = []; cuts = []; i = 0
    step = 2  # analyse every 2nd frame (12/s)
    while True:
        ok, fr = cap.read()
        if not ok: break
        if i % step == 0:
            g = cv2.cvtColor(cv2.resize(fr, (160, 90)), cv2.COLOR_BGR2GRAY).astype(np.float32)
            if prev is not None:
                d = np.abs(g - prev).mean()
                motion.append(float(d))
                # hard cut: big change vs local level
                if d > 38 and (len(motion) < 3 or d > 3.5 * (np.mean(motion[-7:-1]) + 3)):
                    cuts.append(round(i / fps, 3))
            else:
                motion.append(0.0)
            bright.append(float(g.mean()))
            prev = g
        i += 1
    cap.release()
    dur = i / fps
    # aggregate per half second
    per = max(1, int(round(fps / step * 0.5)))
    def agg(a):
        return [round(float(np.mean(a[j:j + per])), 2) for j in range(0, len(a), per)]
    return key, dict(dur=round(dur, 3), motion=agg(motion), bright=agg(bright), cuts=cuts,
                     motion_mean=round(float(np.mean(motion)) if motion else 0, 2))

if __name__ == "__main__":
    keys = [k for k, v in man.items() if not v.get("audio") is True or v.get("w")]
    keys = [k for k in keys if os.path.exists(os.path.join(PROX, k + ".mp4"))]
    cat = {}
    with ProcessPoolExecutor(4) as ex:
        for key, info in ex.map(analyze, keys):
            if info:
                m = dict(man[key]); m.update(info); cat[key] = m
    json.dump(cat, open(OUT, "w"), indent=0, ensure_ascii=False)
    print("catalog", len(cat))
