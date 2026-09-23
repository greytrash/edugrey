"""Download every source in sources.csv, build lightweight proxies + contact sheets + manifest.

Runs inside GitHub Actions (open internet). Outputs go to ./proxies (mp4 360p), ./sheets (jpg), manifest.json.
"""
import csv, json, os, subprocess, sys, zipfile, re, hashlib, shutil
from concurrent.futures import ThreadPoolExecutor

SRC = sys.argv[1] if len(sys.argv) > 1 else "alizza/sources.csv"
MEDIA, PROX, SHEETS = "media", "proxies", "sheets"
for d in (MEDIA, PROX, SHEETS):
    os.makedirs(d, exist_ok=True)

rows = list(csv.DictReader(open(SRC, encoding="utf-8")))

def dl(row):
    url = row["url"]; key = row["key"]
    ext = os.path.splitext(url.split("?")[0])[1] or ".bin"
    dst = os.path.join(MEDIA, key + ext)
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return key, dst, "cached"
    r = subprocess.run(["curl", "-fsSL", "--retry", "3", "--retry-delay", "2", "-m", "900", url, "-o", dst], capture_output=True, text=True)
    if r.returncode != 0:
        if os.path.exists(dst): os.remove(dst)
        return key, None, f"fail {r.returncode} {r.stderr.strip()[:120]}"
    return key, dst, "ok"

with ThreadPoolExecutor(8) as ex:
    results = list(ex.map(dl, rows))
log = {k: st for k, p, st in results}
files = {k: p for k, p, st in results if p}
print("downloaded", len(files), "failed", sum(1 for k, p, st in results if not p))

# unzip archives, register members
extra = []
for key, path in list(files.items()):
    if path.endswith(".zip"):
        d = os.path.join(MEDIA, key + "_x"); os.makedirs(d, exist_ok=True)
        with zipfile.ZipFile(path) as z:
            z.extractall(d)
        for root, _, fs in os.walk(d):
            for f in fs:
                if f.lower().endswith((".mp4", ".mov", ".webm")):
                    p = os.path.join(root, f)
                    k = key + "_" + re.sub(r"[^A-Za-z0-9]+", "_", os.path.splitext(f)[0])[:60]
                    extra.append((k, p, {"key": k, "group": "ZIP " + key, "desc": f, "url": ""}))
for k, p, r in extra:
    files[k] = p; rows.append(r)
meta = {r["key"]: r for r in rows}

def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", path],
                       capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
        st = (j.get("streams") or [{}])[0]; fmt = j.get("format", {})
        num, den = st.get("r_frame_rate", "24/1").split("/")
        return dict(w=st.get("width"), h=st.get("height"), fps=round(float(num) / float(den), 3), dur=float(fmt.get("duration", 0)))
    except Exception:
        return None

def has_audio(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path], capture_output=True, text=True)
    return "audio" in r.stdout

manifest = {}
def make_proxy(item):
    key, path = item
    if path.endswith((".mp3", ".wav", ".html", ".zip")):
        info = None
        if path.endswith((".mp3", ".wav")):
            r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
            info = dict(dur=float(r.stdout.strip() or 0), audio=True)
            shutil.copy(path, os.path.join(PROX, os.path.basename(path)))
        return key, info
    info = probe(path)
    if not info or not info.get("dur"):
        return key, None
    info["audio"] = has_audio(path)
    out = os.path.join(PROX, key + ".mp4")
    vf = "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", path, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
           "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", out]
    if not info["audio"]:
        cmd = cmd[:cmd.index("-c:a")] + ["-an"] + cmd[cmd.index("-movflags"):]
    subprocess.run(cmd, check=False)
    # contact sheet: 8 frames across the clip
    n = 8; dur = info["dur"]
    sheet = os.path.join(SHEETS, key + ".jpg")
    step = max(dur / n, 0.04)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vf",
                    f"fps=1/{step:.4f},scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile={n}x1",
                    "-frames:v", "1", "-q:v", "5", sheet], check=False)
    info["src"] = os.path.basename(path)
    return key, info

with ThreadPoolExecutor(4) as ex:
    for key, info in ex.map(make_proxy, list(files.items())):
        if info:
            m = dict(meta.get(key, {})); m.pop("url", None); m.update(info); manifest[key] = m
json.dump({"clips": manifest, "download_log": log}, open("manifest.json", "w"), indent=1, ensure_ascii=False)
print("proxies", len(manifest))
