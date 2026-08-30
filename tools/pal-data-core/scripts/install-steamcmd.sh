#!/usr/bin/env bash
set -euo pipefail

destination="${1:?destination directory required}"
mkdir -p "$destination"
archive="$destination/steamcmd_linux.tar.gz"

curl --fail --location --retry 3 --retry-delay 2 \
  https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
  -o "$archive"

tar -xzf "$archive" -C "$destination"
test -x "$destination/steamcmd.sh"
