#!/bin/sh
set -eu

# Railway mounts volumes as root. Initialize ownership, then run the API as studio.
# Ordinary Docker/Compose starts directly as studio and skips this branch.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R studio:studio "${DATA_DIR:-/data}"
  exec setpriv --reuid=studio --regid=studio --init-groups "$@"
fi
exec "$@"
