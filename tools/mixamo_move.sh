#!/usr/bin/env bash
# Move Mixamo downloads (browser's Downloads folder) into assets/characters/mixamo/<Name>/src/<key>.fbx.
# usage: tools/mixamo_move.sh <Name> <skinKey|-> "<Download file name>=<key>" ...
set -e
DL="C:/Users/Tejas/Downloads"
dest="/d/RaceUltimate/assets/characters/mixamo/$1/src"; skin="$2"; shift 2
mkdir -p "$dest"
for pair in "$@"; do
  f="${pair%=*}"; key="${pair##*=}"
  for i in $(seq 1 60); do   # wait for the browser to finish writing it
    if [ -f "$DL/$f" ] && ! ls "$DL"/*.crdownload >/dev/null 2>&1; then break; fi
    timeout 2 tail -f /dev/null 2>/dev/null || true
  done
  mv "$DL/$f" "$dest/$key.fbx"
done
[ "$skin" != "-" ] && echo "$skin.fbx" > "$dest/with_skin.txt"
ls -la "$dest" | tail -n +2
