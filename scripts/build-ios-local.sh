#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project_root="$(pwd -P)"
mkdir -p "$project_root/local-builds"
# Avoid macOS /var and /tmp aliases in generated absolute widget imports.
export EAS_LOCAL_BUILD_WORKINGDIR="$project_root/local-builds/work"
exec eas build --platform ios --profile testflight --local \
  --output "$project_root/local-builds/pulse-testflight.ipa" "$@"
