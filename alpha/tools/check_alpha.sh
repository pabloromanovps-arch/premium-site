#!/usr/bin/env bash
# Check every out/alpha/*.mov really carries alpha: an alpha pixel format, a transparent corner,
# and an opaque subject. Prints one line per file.
cd "$(dirname "$0")/../.."
for f in out/alpha/*.mov; do
  pf=$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "$f")
  # alpha plane of the last frame, 1/8 size, as grey: min (background) and max (subject)
  read mn mx < <(ffmpeg -v error -sseof -0.1 -i "$f" -frames:v 1 -vf "alphaextract,scale=240:135,format=gray" -f rawvideo - \
    | python3 -c "import sys; b=sys.stdin.buffer.read(); print(min(b), max(b))")
  ok=$([[ $pf == yuva* && $mn -eq 0 && $mx -ge 250 ]] && echo OK || echo FAIL)
  printf '%-4s %-22s %-14s alpha min %3s max %3s\n' "$ok" "$(basename "$f")" "$pf" "$mn" "$mx"
done
