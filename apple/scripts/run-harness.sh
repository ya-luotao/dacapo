#!/bin/sh
# Runs the Debug app's test harness on an iOS simulator and copies its results out.
#
#   scripts/run-harness.sh <simulator udid> <path to Dacapo.app> <modes> <results dir>
#
# The app must be a Debug build for the simulator. Modes are the harness's (Dacapo/Debug/
# Harness.swift), e.g. probe,hotplug,timing. The results are the harness's JSON files;
# scripts/check-harness.py checks them.
set -eu
udid="$1"
app="$2"
modes="$3"
out="$4"
bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${app}/Info.plist")

xcrun simctl boot "${udid}" 2>/dev/null || true
xcrun simctl bootstatus "${udid}" -b >/dev/null
xcrun simctl install "${udid}" "${app}"
data=$(xcrun simctl get_app_container "${udid}" "${bundle_id}" data)
results="${data}/Documents/harness"
rm -rf "${results}"

xcrun simctl launch --terminate-running-process "${udid}" "${bundle_id}" \
  -dacapoAuto "${modes}" -dacapoQuit YES >/dev/null

# The harness writes done.json last, then quits.
waited=0
while [ ! -f "${results}/done.json" ]; do
  if [ "${waited}" -ge 300 ]; then
    echo "error: the harness did not finish within 300 s" >&2
    ls -l "${results}" >&2 2>/dev/null || true
    exit 1
  fi
  sleep 2
  waited=$((waited + 2))
done
mkdir -p "${out}"
cp "${results}"/*.json "${out}/"
echo "harness results in ${out}: $(ls "${out}" | tr '\n' ' ')"
