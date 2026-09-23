"""Additive airborne-rubbish VFX layer compositor.

Usage: python3 vfx.py <clip A|B> [shot ids...]   (renders out/<clip>/<frame>.png for the configured shots)
Everything is additive: the original frame is only ever composited *under* new sprites.
"""
import os, sys, glob, math, random, json
import numpy as np, cv2

FPS = 24.0
W, H = 854, 480
DT = 1.0 / FPS
SHUTTER = 0.5  # 180 degree shutter

# ---------------------------------------------------------------- sprites
def load_sprites():
    lib = []
    for f in sorted(glob.glob("sprites/*.png")):
        s = cv2.imread(f, cv2.IMREAD_UNCHANGED)
        if s is None or s.ndim != 3 or s.shape[2] != 4:
            continue
        h, w = s.shape[:2]
        a = s[:, :, 3].astype(np.float32) / 255.0
        area = float(a.sum())
        if area < 40:
            continue
        rgb = s[:, :, :3].astype(np.float32)
        lum = float((rgb.mean(axis=2) * a).sum() / area)
        hsv = cv2.cvtColor(s[:, :, :3], cv2.COLOR_BGR2HSV)
        sat = float((hsv[:, :, 1].astype(np.float32) * a).sum() / area)
        hue = float((hsv[:, :, 0].astype(np.float32) * a).sum() / area)
        aspect = max(w, h) / max(1, min(w, h))
        if aspect > 2.3 and area > 120:
            cls = "bottle"
        elif lum < 80 and area > 250:
            cls = "darkbag"
        elif 8 <= hue <= 25 and 40 <= sat <= 150 and 80 <= lum <= 190 and area > 300:
            cls = "cardboard"
        elif lum > 150 and area > 500 and sat < 60:
            cls = "bag"
        elif sat > 70 and area > 120:
            cls = "wrapper"
        elif area > 400 and sat < 60:
            cls = "bag"
        else:
            cls = "paper"
        # premultiplied float RGBA, edge-decontaminated a little
        pre = np.dstack([rgb * a[..., None], a])
        lib.append(dict(img=pre, cls=cls, w=w, h=h, area=area, lum=lum))
    return lib

CLS = {
    "bag":       dict(term=(35, 90),   k=2.5, spin=(0.5, 2.5), flip=(1.0, 3.0), turb=(30, 70)),
    "darkbag":   dict(term=(70, 130),  k=1.8, spin=(0.5, 2.0), flip=(0.8, 2.0), turb=(20, 50)),
    "paper":     dict(term=(50, 110),  k=3.0, spin=(2.0, 7.0), flip=(2.0, 6.0), turb=(40, 90)),
    "wrapper":   dict(term=(80, 150),  k=2.2, spin=(2.0, 8.0), flip=(2.0, 5.0), turb=(30, 70)),
    "cardboard": dict(term=(140, 240), k=1.2, spin=(1.0, 3.0), flip=(0.5, 1.5), turb=(10, 30)),
    "bottle":    dict(term=(240, 400), k=0.6, spin=(3.0, 8.0), flip=(0.0, 0.0), turb=(5, 15)),
}
DEFAULT_MIX = dict(bag=0.28, paper=0.25, wrapper=0.2, darkbag=0.08, cardboard=0.10, bottle=0.09)

# ---------------------------------------------------------------- camera motion
def estimate_camera(clip, s, e, maskdir=None, ignore=None):
    """Per-frame background shift for a far band and a near band -> list of (dxf,dyf,dxn,dyn)."""
    orb = cv2.ORB_create(3000, fastThreshold=10)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    shifts = [(0, 0, 0, 0)]
    prev = None
    prev_occ = None
    for f in range(s, e + 1):
        g = cv2.cvtColor(cv2.imread(f"full{clip}/{f:04d}.png"), cv2.COLOR_BGR2GRAY)
        occ = None
        if maskdir and os.path.exists(f"{maskdir}/{f:04d}.png"):
            m = cv2.imread(f"{maskdir}/{f:04d}.png", 0)
            occ = cv2.dilate((m > 100).astype(np.uint8), np.ones((15, 15), np.uint8))
        if ignore is not None:
            occ = (ignore > 0.5).astype(np.uint8) if occ is None else np.maximum(occ, (ignore > 0.5).astype(np.uint8))
        if prev is not None:
            res = []
            for (y0, y1) in ((0, int(0.5 * H)), (int(0.5 * H), H)):
                band = np.zeros((H, W), np.uint8); band[y0:y1] = 255
                m1 = band.copy(); m2 = band.copy()
                if prev_occ is not None: m1[prev_occ > 0] = 0
                if occ is not None: m2[occ > 0] = 0
                k1, d1 = orb.detectAndCompute(prev, m1)
                k2, d2 = orb.detectAndCompute(g, m2)
                dx = dy = None
                if d1 is not None and d2 is not None and len(k1) > 12 and len(k2) > 12:
                    ms = bf.match(d1, d2)
                    if len(ms) >= 12:
                        p1 = np.float32([k1[m.queryIdx].pt for m in ms])
                        p2 = np.float32([k2[m.trainIdx].pt for m in ms])
                        M, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=2.0)
                        if M is not None and inl is not None and inl.sum() >= 10:
                            c = np.array([W / 2, (y0 + y1) / 2, 1.0])
                            q = M @ c
                            dx, dy = float(q[0] - c[0]), float(q[1] - c[1])
                if dx is None:
                    dx, dy = (shifts[-1][0], shifts[-1][1]) if not res else (res[0][0], res[0][1])
                res.append((dx, dy))
            shifts.append((res[0][0], res[0][1], res[1][0], res[1][1]))
        prev, prev_occ = g, occ
    # light smoothing
    arr = np.array(shifts, np.float32)
    if len(arr) > 3:
        k = np.array([0.25, 0.5, 0.25], np.float32)
        for c in range(4):
            arr[1:, c] = np.convolve(np.pad(arr[1:, c], 1, mode="edge"), k, mode="valid")
    return arr

# ---------------------------------------------------------------- particle sim
class Sim:
    def __init__(self, cfg, lib, seed):
        self.cfg = cfg
        self.rng = random.Random(seed)
        self.np_rng = np.random.RandomState(seed)
        mix = cfg.get("mix", DEFAULT_MIX)
        self.by_cls = {c: [s for s in lib if s["cls"] == c] for c in CLS}
        self.classes = [c for c in mix if self.by_cls.get(c)]
        self.weights = [mix[c] for c in self.classes]
        self.parts = []
        self.t = 0.0
        self.gust_phase = [self.rng.uniform(0, 6.28) for _ in range(4)]
        self.spawn_acc = 0.0

    def wind(self, t):
        bw = self.cfg["wind"]; ga = self.cfg.get("gust", 0.35)
        p = self.gust_phase
        gx = math.sin(0.6 * t + p[0]) + 0.5 * math.sin(1.7 * t + p[1])
        gy = 0.5 * math.sin(0.9 * t + p[2]) + 0.3 * math.sin(2.3 * t + p[3])
        return (bw[0] * (1 + ga * gx), bw[1] + ga * gy * max(40.0, abs(bw[0])) * 0.5)

    def scale_of(self, d):
        sf, sn = self.cfg.get("scale", (0.3, 2.0))
        return sf * (sn / sf) ** d

    def sample_depth(self):
        w = self.cfg.get("depth_w", (0.35, 0.4, 0.25))
        band = self.rng.choices([0, 1, 2], weights=w)[0]
        lo, hi = ((0.0, 0.35), (0.35, 0.7), (0.7, 1.0))[band]
        return self.rng.uniform(lo, hi)

    def spawn(self, prerolling=False):
        cfg = self.cfg; r = self.rng
        cls = r.choices(self.classes, weights=self.weights)[0]
        spr = r.choice(self.by_cls[cls])
        d = self.sample_depth()
        sc = self.scale_of(d) * r.uniform(0.8, 1.2)
        P = CLS[cls]
        wx, wy = self.wind(self.t)
        size = max(spr["w"], spr["h"]) * sc
        mode = r.random()
        side_p = cfg.get("side_p", 0.45)
        xr = cfg.get("xrange", (-0.15, 1.15))
        yr = cfg.get("yrange_side", (-0.1, 0.65))
        if mode < side_p and abs(wx) > 5:
            x = -size if wx > 0 else W + size
            y = r.uniform(yr[0], yr[1]) * H
        else:
            x = r.uniform(xr[0], xr[1]) * W - (wx * r.uniform(0.0, 1.5) if abs(wx) > 5 else 0)
            y = -size - r.uniform(0, 60)
        if prerolling:
            # fill the volume: put some particles already inside the frame
            if r.random() < 0.6:
                x = r.uniform(xr[0], xr[1]) * W; y = r.uniform(-0.05, 0.6) * H
        vx = wx * r.uniform(0.5, 0.95) * sc + r.uniform(-20, 20) * sc
        vy = r.uniform(0.2, 0.7) * r.uniform(*P["term"]) * sc
        p = dict(cls=cls, spr=spr, d=d, sc=sc, x=x, y=y, vx=vx, vy=vy,
                 ang=r.uniform(0, 6.28), spin=r.uniform(*P["spin"]) * r.choice((-1, 1)),
                 fph=r.uniform(0, 6.28), fw=r.uniform(*P["flip"]) * r.choice((-1, 1)),
                 term=r.uniform(*P["term"]), k=P["k"],
                 tph=(r.uniform(0, 6.28), r.uniform(0, 6.28)), tw=(r.uniform(2, 6), r.uniform(2, 6)),
                 tamp=r.uniform(*P["turb"]), landed=False, age=0.0, mirror=r.random() < 0.5,
                 seed=r.random())
        self.parts.append(p)

    def ground_y(self, d):
        g = self.cfg.get("ground")
        if g is None:
            return None
        yf, yn = g
        return yf + (yn - yf) * d

    def spawn_wake(self, bbox, car_v):
        """Pieces kicked up behind a moving car: spawned at its trailing edge, swirling upward."""
        r = self.rng
        x0, y0, x1, y1 = bbox
        cls = r.choices(["paper", "wrapper", "bag", "paper"], weights=[3, 2, 1, 2])[0]
        if not self.by_cls.get(cls):
            return
        spr = r.choice(self.by_cls[cls])
        d = self.cfg.get("wake_depth", 0.62) + r.uniform(-0.05, 0.08)
        sc = self.scale_of(d) * r.uniform(0.7, 1.1)
        P = CLS[cls]
        trailing_right = car_v[0] < 0  # car moving left -> wake on its right
        x = (x1 + r.uniform(0, 50)) if trailing_right else (x0 - r.uniform(0, 50))
        y = y1 - r.uniform(0, 0.35 * (y1 - y0))
        vx = -car_v[0] * r.uniform(0.1, 0.4) + (r.uniform(20, 90) if trailing_right else -r.uniform(20, 90))
        vy = -r.uniform(60, 220) * sc
        p = dict(cls=cls, spr=spr, d=d, sc=sc, x=x, y=y, vx=vx, vy=vy,
                 ang=r.uniform(0, 6.28), spin=r.uniform(3, 10) * r.choice((-1, 1)),
                 fph=r.uniform(0, 6.28), fw=r.uniform(*P["flip"]) * 1.5 * r.choice((-1, 1)),
                 term=r.uniform(*P["term"]), k=P["k"] * 1.3,
                 tph=(r.uniform(0, 6.28), r.uniform(0, 6.28)), tw=(r.uniform(3, 8), r.uniform(3, 8)),
                 tamp=r.uniform(*P["turb"]) * 1.5, landed=False, age=0.0, mirror=r.random() < 0.5,
                 seed=r.random())
        self.parts.append(p)

    def step(self, cam=(0, 0, 0, 0), prerolling=False, bbox=None, car_v=(0, 0)):
        cfg = self.cfg; t = self.t
        rate = cfg["rate"]
        self.spawn_acc += rate * DT
        while self.spawn_acc >= 1.0:
            self.spawn_acc -= 1.0
            self.spawn(prerolling)
        if bbox is not None and cfg.get("wake", 0) > 0 and not prerolling:
            self.wake_acc = getattr(self, "wake_acc", 0.0) + cfg["wake"] * DT
            while self.wake_acc >= 1.0:
                self.wake_acc -= 1.0
                self.spawn_wake(bbox, car_v)
        wx, wy = self.wind(t)
        alive = []
        for p in self.parts:
            p["age"] += DT
            sc = p["sc"]
            if not p["landed"]:
                tx = p["tamp"] * math.sin(p["tw"][0] * t + p["tph"][0])
                ty = p["tamp"] * 0.7 * math.cos(p["tw"][1] * t + p["tph"][1])
                lwx = (wx + tx) * sc; lwy = (wy + ty) * sc
                k = p["k"]
                ax = k * (lwx - p["vx"])
                ay = k * (lwy - p["vy"]) + p["term"] * k * sc
                p["vx"] += ax * DT; p["vy"] += ay * DT
                p["ang"] += p["spin"] * DT
                p["fph"] += p["fw"] * DT
            else:
                # sliding along the ground with wind, strong friction
                p["vx"] += (0.15 * wx * sc - p["vx"]) * 3.0 * DT
                p["vy"] = 0.0
                p["ang"] += p["spin"] * 0.15 * DT
            p["x"] += p["vx"] * DT + cam[0] + (cam[2] - cam[0]) * p["d"]
            p["y"] += p["vy"] * DT + cam[1] + (cam[3] - cam[1]) * p["d"]
            gy = self.ground_y(p["d"])
            half = p["spr"]["h"] * sc * 0.45
            if gy is not None and not p["landed"] and p["y"] + half > gy and p["vy"] > 0:
                if cfg.get("kill_on_ground", False) and p["d"] < 0.35:
                    continue
                p["y"] = gy - half
                p["landed"] = True
                p["vx"] *= 0.35
                p["spin"] *= 0.2
            if p["x"] < -300 or p["x"] > W + 300 or p["y"] > H + 200:
                continue
            alive.append(p)
        self.parts = alive
        self.t += DT

# ---------------------------------------------------------------- rendering
def line_kernel(dx, dy):
    L = math.hypot(dx, dy)
    n = int(math.ceil(L))
    if n < 2:
        return None
    k = np.zeros((n * 2 + 1, n * 2 + 1), np.float32)
    c = n
    cv2.line(k, (int(round(c - dx / 2)), int(round(c - dy / 2))), (int(round(c + dx / 2)), int(round(c + dy / 2))), 1.0, 1, cv2.LINE_AA)
    s = k.sum()
    return k / s if s > 0 else None

def render_particle(out, p, cam, shot, occ, excl, ambient, noise_rng):
    spr = p["spr"]; img = spr["img"]
    sc = p["sc"]
    fx = 1.0
    if p["fw"] != 0:
        c = math.cos(p["fph"])
        fx = 0.3 + 0.7 * abs(c)
        mirror = (c < 0) != p["mirror"]
    else:
        mirror = p["mirror"]
    sw = max(1, int(round(spr["w"] * sc * fx))); sh = max(1, int(round(spr["h"] * sc)))
    if sw < 2 and sh < 2:
        return
    interp = cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR
    s = cv2.resize(img, (sw, sh), interpolation=interp)
    if s.ndim == 2:
        return
    if mirror:
        s = s[:, ::-1]
    D = int(math.ceil(math.hypot(sw, sh))) + 4
    M = cv2.getRotationMatrix2D((sw / 2, sh / 2), math.degrees(p["ang"]), 1.0)
    M[0, 2] += D / 2 - sw / 2; M[1, 2] += D / 2 - sh / 2
    s = cv2.warpAffine(s, M, (D, D), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    # grade
    gain = shot.get("gain", (1, 1, 1)); expo = shot.get("expo", 1.0)
    rgb = s[:, :, :3] * np.array(gain, np.float32) * expo
    a = s[:, :, 3]
    # contrast/desat towards ambient (atmospheric haze, stronger for far pieces)
    hz = shot.get("haze", 0.35) * (1.0 - p["d"]) ** 1.5
    if hz > 0:
        rgb = rgb * (1 - hz) + ambient[None, None, :] * a[..., None] * hz
    # defocus
    df = shot.get("focus", 0.5); bk = shot.get("blur_k", 4.0)
    sig = bk * abs(p["d"] - df) * (0.4 + 0.6 * p["d"])
    sig = max(sig, shot.get("blur_min", 0.4))
    rgba = np.dstack([rgb, a])
    if sig > 0.3:
        ks = int(sig * 3) * 2 + 1
        rgba = cv2.GaussianBlur(rgba, (ks, ks), sig)
    # motion blur along total screen velocity
    vx = p["vx"] * DT + cam[0] + (cam[2] - cam[0]) * p["d"]
    vy = p["vy"] * DT + cam[1] + (cam[3] - cam[1]) * p["d"]
    k = line_kernel(vx * SHUTTER * shot.get("mb", 1.0), vy * SHUTTER * shot.get("mb", 1.0))
    if k is not None:
        pad = k.shape[0] // 2
        rgba = cv2.copyMakeBorder(rgba, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
        rgba = cv2.filter2D(rgba, -1, k, borderType=cv2.BORDER_CONSTANT)
    Dh, Dw = rgba.shape[:2]
    x0 = int(round(p["x"] - Dw / 2)); y0 = int(round(p["y"] - Dh / 2))
    x1 = x0 + Dw; y1 = y0 + Dh
    cx0, cy0 = max(0, x0), max(0, y0); cx1, cy1 = min(W, x1), min(H, y1)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    sub = rgba[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
    rgb = sub[:, :, :3]; a = sub[:, :, 3]
    opac = shot.get("opacity", 1.0)
    if opac != 1.0:
        rgb = rgb * opac; a = a * opac
    if occ is not None and p["d"] < shot.get("occ_depth", 0.0):
        m = occ[cy0:cy1, cx0:cx1]
        rgb = rgb * (1 - m)[..., None]; a = a * (1 - m)
    if excl is not None:
        m = excl[cy0:cy1, cx0:cx1]
        rgb = rgb * (1 - m)[..., None]; a = a * (1 - m)
    # grain on the new layer only
    g = shot.get("grain", 3.0)
    if g > 0:
        n = noise_rng.normal(0, g, rgb.shape).astype(np.float32) * a[..., None]
        rgb = rgb + n
    region = out[cy0:cy1, cx0:cx1]
    region *= (1 - a)[..., None]
    region += rgb

def paint_key(frame_bgr, ymin=110, down=48):
    """Cream car paint / white clothing key (bright, low saturation), holes filled, small blobs dropped."""
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    key = ((hsv[:, :, 2] > 135) & (hsv[:, :, 1] < 75)).astype(np.uint8)
    key[:ymin] = 0
    key = cv2.morphologyEx(key, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    key = cv2.morphologyEx(key, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(key, 8)
    keep = np.zeros_like(key)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] > 2500:
            keep[lab == k] = 1
    inv = (1 - keep).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for k in range(1, n2):
        x, y, w, h, a = st2[k]
        if a < 20000 and x > 0 and y > 0 and x + w < W and y + h < H:
            keep[lab2 == k] = 1
    # extend the keyed body downward to cover the dark sill / bumper under the cream paint
    if down > 0:
        ext = keep.copy()
        for dy in range(4, down + 1, 4):
            ext[dy:] = np.maximum(ext[dy:], keep[:-dy])
        keep = ext
    return keep.astype(np.float32)

def render_shot(clip, sid, shot, lib, seed=7):
    s, e = shot["frames"]
    os.makedirs(f"out/{clip}", exist_ok=True)
    maskdir = shot.get("mask")
    excl = None
    if shot.get("excl_poly"):
        excl = np.zeros((H, W), np.float32)
        for poly in shot["excl_poly"]:
            cv2.fillPoly(excl, [np.array(poly, np.int32)], 1.0)
        excl = cv2.GaussianBlur(excl, (7, 7), 2)
    # keyframed exclusion polygon (same vertex count per key), linearly interpolated per frame
    excl_frames = None
    cam_ignore = excl
    if shot.get("excl_keys"):
        keys = sorted(shot["excl_keys"].items())
        excl_frames = {}
        union = np.zeros((H, W), np.float32)
        for f in range(s, e + 1):
            if f <= keys[0][0]:
                poly = keys[0][1]
            elif f >= keys[-1][0]:
                poly = keys[-1][1]
            else:
                for (fa, pa), (fb, pb) in zip(keys, keys[1:]):
                    if fa <= f <= fb:
                        t = (f - fa) / float(fb - fa)
                        poly = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in zip(pa, pb)]
                        break
            m = np.zeros((H, W), np.float32)
            cv2.fillPoly(m, [np.array(poly, np.int32)], 1.0)
            union = np.maximum(union, m)
            excl_frames[f] = cv2.GaussianBlur(m, (7, 7), 2)
        cam_ignore = union if cam_ignore is None else np.maximum(cam_ignore, union)
    cam = estimate_camera(clip, s, e, maskdir, cam_ignore) if shot.get("cam", True) else np.zeros((e - s + 2, 4), np.float32)
    sim = Sim(shot, lib, seed + sid * 101)
    pre = shot.get("preroll", 3.0)
    for _ in range(int(pre * FPS)):
        sim.step(prerolling=True)
    noise_rng = np.random.RandomState(seed)
    ambient = None
    prev_bbox = None
    for i, f in enumerate(range(s, e + 1)):
        frame = cv2.imread(f"full{clip}/{f:04d}.png").astype(np.float32)
        if ambient is None or i % 6 == 0:
            top = frame[: int(H * 0.45)]
            ambient = top.reshape(-1, 3).mean(axis=0)
        occ = None; bbox = None; car_v = (0.0, 0.0)
        if maskdir and os.path.exists(f"{maskdir}/{f:04d}.png"):
            m = cv2.imread(f"{maskdir}/{f:04d}.png", 0).astype(np.float32) / 255.0
            if shot.get("key"):
                m = np.maximum(m, paint_key(frame.astype(np.uint8), shot.get("key_ymin", 110)))
            m = cv2.GaussianBlur(m, (5, 5), 1.2)
            if shot.get("mask_ymin"):
                m[: shot["mask_ymin"]] = 0.0
            occ = np.clip((m - 0.25) / 0.5, 0, 1)
            ys, xs = np.where(m > 0.5)
            if len(xs) > 200:
                bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
                if prev_bbox is not None:
                    cx, pcx = (bbox[0] + bbox[2]) / 2, (prev_bbox[0] + prev_bbox[2]) / 2
                    car_v = ((cx - pcx) * FPS, 0.0)
                prev_bbox = bbox
        c = cam[i] if i < len(cam) else cam[-1]
        if i > 0:
            sim.step(cam=tuple(c), bbox=bbox, car_v=car_v)
        out = frame.copy()
        ex = excl
        if excl_frames is not None:
            ex = excl_frames[f] if excl is None else np.maximum(excl, excl_frames[f])
        for p in sorted(sim.parts, key=lambda q: q["d"]):
            render_particle(out, p, tuple(c), shot, occ, ex, ambient, noise_rng)
        cv2.imwrite(f"out/{clip}/{f:04d}.png", np.clip(out, 0, 255).astype(np.uint8))
    return len(sim.parts)

if __name__ == "__main__":
    from shots import SHOTS
    clip = sys.argv[1]
    ids = [int(x) for x in sys.argv[2:]] or sorted(SHOTS[clip].keys())
    lib = load_sprites()
    from collections import Counter
    print("sprites:", Counter(s["cls"] for s in lib))
    for sid in ids:
        shot = SHOTS[clip][sid]
        n = render_shot(clip, sid, shot, lib)
        print(f"{clip} shot {sid} frames {shot['frames']} done, alive at end {n}", flush=True)
