#!/bin/bash
# stream a Drive file to stdout in 8 MB ranged requests (Drive answers ranges when a whole-file GET hits its quota)
id=$1; size=$2; step=$((8*1024*1024)); off=0
url="https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t"
while [ $off -lt $size ]; do
  end=$((off+step-1)); [ $end -ge $size ] && end=$((size-1))
  for try in $(seq 1 30); do
    tmp=$(mktemp); curl -sS -f -r $off-$end "$url" -o "$tmp"
    if [ "$(stat -c %s "$tmp")" -eq $((end-off+1)) ]; then cat "$tmp" || { rm -f "$tmp"; exit 0; }; rm -f "$tmp"; break; fi
    rm -f "$tmp"; sleep $(( try < 6 ? try*5 : 60 )); [ $try -eq 30 ] && { echo "range $off failed" >&2; exit 1; }
  done
  off=$((end+1))
done
