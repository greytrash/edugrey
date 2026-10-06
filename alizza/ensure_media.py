"""Download only the sources referenced by the given EDLs and write media_map.json {key: path}.

usage: python3 ensure_media.py sources.csv media_map.json edl1.json [edl2.json ...]
Zip members are addressed as <zipkey>_<sanitised member name> (same rule as fetch_proxies.py).
Keys vfx_A / vfx_B map to the repo files clipA_trash_vfx.mp4 / clipB_trash_vfx.mp4.
"""
import sys, csv, json, os, re, subprocess, zipfile

src_csv, out = sys.argv[1], sys.argv[2]
need = set()
for e in sys.argv[3:]:
    for s in json.load(open(e))["segments"]:
        need.add(s["clip"])
rows = {r["key"]: r for r in csv.DictReader(open(src_csv, encoding="utf-8"))}
os.makedirs("media", exist_ok=True)
mmap = {}
local = {"vfx_A": "clipA_trash_vfx.mp4", "vfx_B": "clipB_trash_vfx.mp4"}
for k, p in local.items():
    if k in need and os.path.exists(p):
        mmap[k] = os.path.abspath(p)

def fetch(key):
    r = rows[key]; url = r["url"]
    ext = os.path.splitext(url.split("?")[0])[1] or ".bin"
    dst = os.path.join("media", key + ext)
    if not (os.path.exists(dst) and os.path.getsize(dst) > 0):
        subprocess.run(["curl", "-fsSL", "--retry", "4", "--retry-delay", "3", "-m", "1200", url, "-o", dst], check=True)
    return dst

zips_needed = set()
for k in sorted(need):
    if k in mmap:
        continue
    m = re.match(r"(zip_[a-z]+)_(.+)$", k)
    if m and m.group(1) in rows:
        zips_needed.add(m.group(1)); continue
    if k in rows:
        mmap[k] = os.path.abspath(fetch(k))
    else:
        print("WARN unknown key", k)
for zk in zips_needed:
    zp = fetch(zk); d = os.path.join("media", zk + "_x"); os.makedirs(d, exist_ok=True)
    with zipfile.ZipFile(zp) as z:
        z.extractall(d)
    for root, _, fs in os.walk(d):
        for f in fs:
            if f.lower().endswith((".mp4", ".mov", ".webm")):
                k = zk + "_" + re.sub(r"[^A-Za-z0-9]+", "_", os.path.splitext(f)[0])[:60]
                if k in need:
                    mmap[k] = os.path.abspath(os.path.join(root, f))
missing = [k for k in need if k not in mmap]
print("media ready", len(mmap), "missing", missing)
json.dump(mmap, open(out, "w"), indent=1)
