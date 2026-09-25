#!/bin/sh
# Xcode build phase (the target's last): builds the web app and copies it into the app bundle as
# web/, served through the dacapo:// scheme (Dacapo/Web/SchemeHandler.swift). For Release builds it
# then checks that nothing of the Debug test harness reached the bundle.
set -eu

repo="${DACAPO_REPO_ROOT:-${SRCROOT}/..}"
out="${DERIVED_FILE_DIR}/web"
bundle="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
dest="${bundle}/web"

if [ "${DACAPO_SKIP_WEB_BUILD:-NO}" = "YES" ]; then
  src="${repo}/dist"
  [ -f "${src}/index.html" ] || { echo "error: ${src} has no build; run pnpm build"; exit 1; }
else
  # Xcode starts build phases with a minimal PATH.
  cd "${repo}"
  export PATH="${HOME}/Library/pnpm:${HOME}/.local/share/pnpm:/opt/homebrew/bin:/usr/local/bin:${PATH}"
  if [ -s "${HOME}/.nvm/nvm.sh" ] && ! command -v node >/dev/null 2>&1; then
    . "${HOME}/.nvm/nvm.sh" >/dev/null
    nvm use --silent >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
  fi
  command -v pnpm >/dev/null 2>&1 || { echo "error: pnpm not found (see CONTRIBUTING.md)"; exit 1; }
  # Type checking is pnpm check's job; the app only needs the production bundle.
  pnpm exec vite build --logLevel warn --outDir "${out}" --emptyOutDir
  src="${out}"
fi

mkdir -p "${dest}"
rsync -a --delete "${src}/" "${dest}/"
echo "Embedded web app from ${src} ($(du -sh "${dest}" | cut -f1))"

# Release: the Debug-only Info.plist keys (Config/Info.plist, DACAPO_DEBUG_HARNESS) and the
# harness files (Dacapo/Debug) must not be in the product. The audio background mode in
# particular must never reach the App Store (guideline 2.5.4).
if [ "${CONFIGURATION}" = "Release" ]; then
  plist="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"
  [ -f "${plist}" ] || { echo "error: ${plist} not found for the Release check"; exit 1; }
  for key in UIBackgroundModes UIFileSharingEnabled LSSupportsOpeningDocumentsInPlace; do
    if /usr/libexec/PlistBuddy -c "Print :${key}" "${plist}" >/dev/null 2>&1; then
      echo "error: Release Info.plist declares the Debug-only key ${key}"
      exit 1
    fi
  done
  leaked=$(find "${bundle}" -path "${dest}" -prune -o \( -name 'probe.js' -o -name 'probe.wasm' \
    -o -name '*.musicxml' -o -name '*.mxl' \) -print)
  if [ -n "${leaked}" ]; then
    echo "error: Debug harness files in the Release bundle: ${leaked}"
    exit 1
  fi
  if strings "${TARGET_BUILD_DIR}/${EXECUTABLE_PATH}" | grep -q 'dacapoAuto'; then
    echo "error: the Debug harness is compiled into the Release executable"
    exit 1
  fi
  echo "Release check: no Debug-only keys or harness files"
fi
