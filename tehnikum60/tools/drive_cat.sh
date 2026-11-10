#!/bin/bash
# stream a Drive file to stdout in 32 MB ranged requests (Drive answers ranges when a whole-file GET hits its quota)
id=$1; size=$2; step=$((32*1024*1024)); off=0
url="https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t"
while [ $off -lt $size ]; do
  end=$((off+step-1)); [ $end -ge $size ] && end=$((size-1))
  for try in 1 2 3 4 5 6; do
    tmp=$(mktemp); curl -sS -f -r $off-$end "$url" -o "$tmp"
    if [ "$(stat -c %s "$tmp")" -eq $((end-off+1)) ]; then cat "$tmp" || { rm -f "$tmp"; exit 0; }; rm -f "$tmp"; break; fi
    rm -f "$tmp"; sleep $((try*5)); [ $try -eq 6 ] && { echo "range $off failed" >&2; exit 1; }
  done
  off=$((end+1))
done
