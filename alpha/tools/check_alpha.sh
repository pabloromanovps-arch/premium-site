#!/usr/bin/env bash
# Check every out/alpha/*.mov really carries alpha: an alpha pixel format, a transparent corner,
# and an opaque subject. Prints one line per file.
cd "$(dirname "$0")/../.."
for f in out/alpha/*.mov; do
  pf=$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "$f")
  # alpha plane of the last frame, 1/8 size, as grey: min (background), max (subject) and the share of
# faint pixels (1..39): a soft halo there shows up as colour blotches wherever alpha is ignored
  read mn mx faint < <(ffmpeg -v error -sseof -0.1 -i "$f" -frames:v 1 -vf "alphaextract,format=gray" -f rawvideo - \
    | python3 -c "import sys; b=sys.stdin.buffer.read(); print(min(b), max(b), round(100*sum(1 for v in b if 0<v<40)/len(b), 2))")
  ok=$([[ $pf == yuva* && $mn -eq 0 && $mx -ge 250 ]] && python3 -c "exit(not $faint < 0.5)" && echo OK || echo FAIL)
  printf '%-4s %-22s %-14s alpha min %3s max %3s faint %5s%%\n' "$ok" "$(basename "$f")" "$pf" "$mn" "$mx" "$faint"
done
