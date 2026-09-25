#!/bin/sh
# Fails when project.pbxproj has build settings of its own. Every setting belongs in Config/*.xcconfig
# (plain text, reviewable); Xcode's build settings editor writes into the project file instead, so
# a change made there shows up here. Run by CI (.github/workflows/apple.yml).
set -eu
project="$(dirname "$0")/../Dacapo.xcodeproj/project.pbxproj"
# Each configuration must read "buildSettings = {" immediately followed by "};".
inline=$(awk '
  /buildSettings = \{/ { open = 1; next }
  open && /^[[:space:]]*\};/ { open = 0; next }
  open { print FILENAME ":" NR ": " $0 }
' "${project}")
if [ -n "${inline}" ]; then
  echo "error: build settings in project.pbxproj; move them to apple/Config/*.xcconfig:" >&2
  echo "${inline}" >&2
  exit 1
fi
echo "project.pbxproj has no inline build settings"
