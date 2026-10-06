#!/bin/bash
# assemble.sh <clip A|B> <output.mp4>: untouched frames come straight from the source PNGs,
# VFX frames from out/<clip>/, then encode with the original audio track muxed back unchanged.
set -e
CLIP=$1; OUT=$2
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
S=/tmp/claude-0/-home-user-edugrey/c0e163aa-faf3-5e88-996b-6e71480725a9/scratchpad
cd $S
mkdir -p final/$CLIP
N=$(ls full$CLIP | wc -l)
for i in $(seq -f "%04g" 1 $N); do
  if [ -f out/$CLIP/$i.png ]; then ln -sf $S/out/$CLIP/$i.png final/$CLIP/$i.png; else ln -sf $S/full$CLIP/$i.png final/$CLIP/$i.png; fi
done
$FF -v error -y -framerate 24 -i final/$CLIP/%04d.png -i clip$CLIP.mp4 -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a copy -movflags +faststart "$OUT"
$FF -i "$OUT" 2>&1 | grep -E "Duration|Stream"
