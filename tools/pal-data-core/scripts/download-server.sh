#!/usr/bin/env bash
set -euo pipefail

steamcmd="${1:?steamcmd path required}"
install_dir="${2:?server install directory required}"
mkdir -p "$install_dir"

for attempt in 1 2 3; do
  echo "Palworld Dedicated Server download attempt $attempt/3"

  # Warm/update app metadata first. SteamCMD can transiently return
  # "Missing configuration" if app metadata is not ready yet.
  "$steamcmd" +login anonymous +app_info_update 1 +app_info_print 2394010 +quit >/dev/null 2>&1 || true

  if "$steamcmd" \
      +force_install_dir "$install_dir" \
      +login anonymous \
      +app_update 2394010 validate \
      +quit; then
    pak="$install_dir/Pal/Content/Paks/Pal-LinuxServer.pak"
    if [[ -f "$pak" ]]; then
      printf 'Downloaded PAK: %s\n' "$pak"
      exit 0
    fi
  fi

  if [[ "$attempt" -lt 3 ]]; then
    sleep $((attempt * 3))
  fi
done

echo "Palworld Dedicated Server download failed after three attempts." >&2
exit 1
