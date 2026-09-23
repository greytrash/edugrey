"""EDL builder: four beat-synced montage strategies for SE ACABÓ.

usage: python3 montage.py song.json catalog.json <strategy> out.json [seed]
strategies: narrativa | pelea | secuencia | collage
EDL = {"song": ..., "fps": 24, "segments": [{"t": start, "dur": d, "clip": key, "in": in_point}]}
"""
import sys, json, random, math, re

song = json.load(open(sys.argv[1]))
cat = json.load(open(sys.argv[2]))
strategy = sys.argv[3]
out = sys.argv[4]
seed = int(sys.argv[5]) if len(sys.argv) > 5 else 7
rng = random.Random(seed)

D = song["duration"]
beats = song["beats"]; downbeats = song["downbeats"]; sections = song["sections"]
period = song["period"]
onsets = song["onsets"]

ACTS = ["01 PROLOGO COCHE", "02 LA CAIDA", "03 EL FUEGO", "04 EL DILUVIO", "05 EL FONDO", "06 LA GALERIA",
        "07 EL MERCADO", "08 LA SUBIDA", "09 LA CARRERA", "10 LA SEMILLA", "11 CLIMAX", "12 AMANECER"]

# ---------------------------------------------------------------- clip pools
def is_bad(k, v):
    if v.get("dur", 0) < 1.2: return True
    if k.startswith("a_") or k == "html_dossier": return True
    if v.get("w") and v["w"] < v["h"]: return True  # vertical
    return False

clips = {k: v for k, v in cat.items() if not is_bad(k, v)}
brutos = sorted([k for k in clips if re.match(r"b\d\d_", k)])
def act_of(k):
    return clips[k].get("group", "")
by_act = {a: [k for k in brutos if act_of(k) == a] for a in ACTS}
key_shots = {k: v for k, v in clips.items() if v.get("group") == "KEY"}
wall = [k for k in clips if k.startswith("zip_nave_")]          # concrete wall / car / graffiti set
lucha = [k for k in clips if k.startswith("zip_lucha_")]        # white wall LUCHA series
gens = [k for k in clips if k.startswith("g")]
uploads = [k for k in clips if k.startswith("u_")]
vfx = [k for k in clips if k.startswith("vfx_")]
long_takes = [k for k in clips if clips[k]["dur"] >= 12 and not k.startswith(("b", "u_"))]

# ---------------------------------------------------------------- helpers
usage = {k: 0.0 for k in clips}      # cursor of used material (seconds)
uses = {k: 0 for k in clips}

def safe_ranges(k, need):
    """windows [in, in+need] not crossing internal cuts, with 0.15s margins"""
    v = clips[k]; dur = v["dur"]; cuts = [0.0] + [c for c in v.get("cuts", []) if 0.3 < c < dur - 0.3] + [dur]
    rs = []
    for a, b in zip(cuts, cuts[1:]):
        a2, b2 = a + (0.15 if a > 0 else 0.0), b - (0.15 if b < dur else 0.0)
        if b2 - a2 >= need:
            rs.append((a2, b2))
    return rs

def pick_in(k, need, energy):
    """in-point inside a safe range; prefer high-motion windows for energetic sections, advance a cursor on reuse"""
    rs = safe_ranges(k, need)
    if not rs:
        return None
    v = clips[k]; mot = v.get("motion") or [1.0]
    cands = []
    for a, b in rs:
        span = b - a - need
        for j in range(0, 6):
            ip = a + span * (j / 5.0) if span > 0 else a
            i0 = int(ip * 2); i1 = max(i0 + 1, int((ip + need) * 2))
            m = sum(mot[i0:i1]) / max(1, len(mot[i0:i1]))
            score = m if energy >= 0.55 else -m
            # discourage overlapping already-used material
            score -= 3.0 * (1.0 if ip < usage[k] < ip + need or (usage[k] > 0 and abs(ip - usage[k]) < need * 0.5) else 0.0)
            cands.append((score + rng.uniform(-0.3, 0.3), ip))
    cands.sort(reverse=True)
    ip = cands[0][1]
    usage[k] = max(usage[k], ip + need); uses[k] += 1
    return ip

def choose(pool, need, energy, avoid=(), max_uses=3):
    p = [k for k in pool if k not in avoid and uses[k] < max_uses and safe_ranges(k, need)]
    if not p:
        p = [k for k in pool if safe_ranges(k, need)]
    if not p:
        return None, None
    # least used first, then random
    p.sort(key=lambda k: (uses[k], rng.random()))
    k = p[0]
    return k, pick_in(k, need, energy)

def section_at(t):
    for s in sections:
        if s["start"] <= t < s["end"]:
            return s
    return sections[-1]

def grid_cuts(unit_low=8, unit_mid=4, unit_high=2, accent=False):
    """cut times following the beat grid; unit = beats per shot depending on section energy"""
    cuts = [0.0]
    i = 0
    while i < len(beats):
        t = beats[i]
        s = section_at(t)
        unit = {"low": unit_low, "mid": unit_mid, "high": unit_high}[s["kind"]]
        if accent and s["kind"] == "high" and rng.random() < 0.35:
            unit = max(1, unit // 2)
        # snap to downbeat phase for long units
        if unit >= 4:
            while i < len(beats) and beats[i] not in downbeats:
                i += 1
            if i >= len(beats): break
            t = beats[i]
        if t > cuts[-1] + 0.2:
            cuts.append(t)
        i += unit
    cuts = [c for c in cuts if c < D - 0.4]
    return cuts + [D]

def make_segments(cuts, pick_fn):
    segs = []
    prev_key = None
    for a, b in zip(cuts, cuts[1:]):
        need = b - a
        k, ip = pick_fn(a, need, prev_key)
        if k is None:
            k, ip = choose(list(clips), need, 0.5, avoid=(prev_key,), max_uses=99)
        if k is None:
            continue
        segs.append(dict(t=round(a, 4), dur=round(need, 4), clip=k, **{"in": round(ip, 3)}))
        prev_key = k
    return segs

# ---------------------------------------------------------------- narrative allocation
def act_timeline():
    """assign the 12 acts to the song timeline proportionally to their raw material, prologue first"""
    weights = {a: sum(clips[k]["dur"] for k in by_act[a]) for a in ACTS}
    weights["01 PROLOGO COCHE"] += 20  # room for the wall / car shots
    tot = sum(weights.values())
    t = 0.0; spans = []
    for a in ACTS:
        d = D * weights[a] / tot
        spans.append((a, t, t + d)); t += d
    return spans

spans = act_timeline()
def act_at(t):
    for a, s, e in spans:
        if s <= t < e:
            return a
    return ACTS[-1]

extra_for_act = {
    "01 PROLOGO COCHE": wall + lucha + [k for k in key_shots if k in ("b62_interior_coche_noche", "b64_oneshot_coche", "b63_LUCHA_toma2", "b67_muro_repintado", "b68_prologo_B_lucha")] + vfx,
    "02 LA CAIDA": [k for k in key_shots if k == "b65_conector_caida_aerea"],
    "04 EL DILUVIO": [k for k in key_shots if k == "b61_FPV_granvia"],
    "10 LA SEMILLA": [k for k in key_shots if k == "b66_semilla_invernadero"],
}

# ---------------------------------------------------------------- strategies
if strategy == "narrativa":
    cuts = grid_cuts(8, 4, 2, accent=False)
    cursor = {a: 0 for a in ACTS}
    def pick(t, need, prev):
        a = act_at(t); s = section_at(t)
        pool = by_act[a] + extra_for_act.get(a, [])
        # walk the act's shots in order, fall back to extras
        for _ in range(len(pool)):
            k = pool[cursor[a] % len(pool)]; cursor[a] += 1
            if k != prev and safe_ranges(k, need) and uses[k] < 2:
                return k, pick_in(k, need, s["rel"])
        return choose(pool, need, s["rel"], avoid=(prev,), max_uses=6)
    segs = make_segments(cuts, pick)

elif strategy == "pelea":
    cuts = grid_cuts(4, 2, 1, accent=True)
    motif = wall + lucha + vfx
    def pick(t, need, prev):
        a = act_at(t); s = section_at(t)
        # every chorus starts with the wall/car motif for two shots
        if s["kind"] == "high" and (t - s["start"]) < 2 * period + 0.05 and motif:
            return choose(motif, need, s["rel"], avoid=(prev,), max_uses=4)
        pool = by_act[a] + extra_for_act.get(a, []) + (gens if s["kind"] != "low" else [])
        return choose(pool, need, s["rel"], avoid=(prev,), max_uses=4)
    segs = make_segments(cuts, pick)

elif strategy == "secuencia":
    # backbone: long takes laid end to end (snapped to downbeats), inserts of 1-2 beats in high sections
    backbone = sorted(long_takes, key=lambda k: (0 if k in key_shots else 1, -clips[k]["dur"]))
    backbone = [k for k in backbone if not clips[k].get("cuts")]  # true single takes only
    segs = []; t = 0.0; bi = 0
    while t < D - 0.5 and backbone:
        k = backbone[bi % len(backbone)]; bi += 1
        s = section_at(t)
        take = min(clips[k]["dur"] - 0.2, rng.uniform(6, 14) if s["kind"] != "low" else rng.uniform(10, 20))
        # end on a downbeat
        end = t + take
        db = [d for d in downbeats if d > t + 2]
        if db:
            end = min(db, key=lambda d: abs(d - end))
        end = min(end, D)
        segs.append(dict(t=round(t, 4), dur=round(end - t, 4), clip=k, **{"in": 0.0}))
        uses[k] += 1
        t = end
        # inserts in high sections: 2 x one-beat cuts
        s = section_at(t)
        if s["kind"] == "high" and t < D - 3:
            for _ in range(2):
                kk, ip = choose(wall + gens + brutos, period, 1.0, avoid=(k,), max_uses=3)
                if kk is None: break
                segs.append(dict(t=round(t, 4), dur=round(period, 4), clip=kk, **{"in": round(ip, 3)}))
                t += period

elif strategy == "collage":
    # cut on strong onsets (min gap 1 beat/2 in high, 1 beat in mid, 2 beats in low); sections rotate through acts
    strong = [t for t, s in onsets if s > 2.0]
    cuts = [0.0]
    for t in strong:
        s = section_at(t)
        gap = {"low": 2 * period, "mid": period, "high": period / 2}[s["kind"]]
        if t - cuts[-1] >= gap - 0.02:
            cuts.append(t)
    cuts = [c for c in cuts if c < D - 0.4] + [D]
    order = ACTS[:]
    sec_act = {i: order[i % len(order)] for i in range(len(sections))}
    def pick(t, need, prev):
        s = section_at(t); si = sections.index(s)
        a = sec_act[si]
        pool = by_act[a] + extra_for_act.get(a, []) + (vfx + wall if s["kind"] == "high" else [])
        if rng.random() < 0.25:
            pool = pool + gens + uploads
        return choose(pool, need, s["rel"], avoid=(prev,), max_uses=5)
    segs = make_segments(cuts, pick)
else:
    raise SystemExit("unknown strategy")

# tidy: fill gaps / clamp to D
segs.sort(key=lambda s: s["t"])
fixed = []
for i, s in enumerate(segs):
    nxt = segs[i + 1]["t"] if i + 1 < len(segs) else D
    s["dur"] = round(max(0.05, min(s["dur"], nxt - s["t"])), 4)
    if s["dur"] >= 0.08:
        fixed.append(s)
json.dump(dict(song=song["file"], fps=24, strategy=strategy, seed=seed, duration=D, segments=fixed), open(out, "w"), indent=0)
lens = [s["dur"] for s in fixed]
print(f"{strategy}: {len(fixed)} segments, mean {sum(lens)/len(lens):.2f}s, min {min(lens):.2f}, max {max(lens):.2f}, distinct clips {len(set(s['clip'] for s in fixed))}")
