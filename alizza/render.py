"""Render an EDL to mp4 with the song as master audio.

usage: python3 render.py edl.json media_map.json song.mp3 out.mp4 [WxH] [crf]
media_map.json: {"key": "path/to/source.mp4", ...}
Each segment is cut and normalised separately (exact frame counts on a 24 fps grid), then concatenated.
"""
import sys, json, os, subprocess, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor

edl = json.load(open(sys.argv[1]))
media = json.load(open(sys.argv[2]))
song = sys.argv[3]; out = sys.argv[4]
size = sys.argv[5] if len(sys.argv) > 5 else "1920x1080"
crf = sys.argv[6] if len(sys.argv) > 6 else "17"
W, H = size.split("x")
FPS = 24
tmp = tempfile.mkdtemp(prefix="render_")
segs = edl["segments"]

def frames(d):
    return max(2, int(round(d * FPS)))

def cut(i_s):
    i, s = i_s
    src = media[s["clip"]]
    n = frames(s["dur"])
    o = os.path.join(tmp, f"seg_{i:04d}.mp4")
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p,setsar=1")
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{s['in']:.3f}", "-i", src, "-frames:v", str(n), "-vf", vf,
           "-an", "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-g", "48", "-bf", "0",
           "-avoid_negative_ts", "make_zero", "-video_track_timescale", "24000", o]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(o):
        # fallback: black frames so timing never drifts
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}", "-frames:v", str(n),
                        "-c:v", "libx264", "-crf", "20", o], check=False)
        print("WARN fallback black for", s["clip"], r.stderr[-200:])
    return o

with ThreadPoolExecutor(4) as ex:
    parts = list(ex.map(cut, list(enumerate(segs))))
lst = os.path.join(tmp, "concat.txt")
with open(lst, "w") as f:
    for p in parts:
        f.write(f"file '{p}'\n")
pic = os.path.join(tmp, "picture.mp4")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-fflags", "+genpts", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
                "-video_track_timescale", "24000", pic], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", pic, "-i", song, "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out], check=True)
shutil.rmtree(tmp, ignore_errors=True)
print("rendered", out, len(parts), "segments")
