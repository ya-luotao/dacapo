#!/usr/bin/env python3
"""Checks the Debug harness's results (scripts/run-harness.sh) for facts that must hold on any
machine: the page is served and runs, MIDI arrives complete and with its native timestamps, ports
come and go. It does not check latencies, which depend on the machine (a CI runner is slow and
shared); those are measured by hand and reported (see apple/README.md).

    scripts/check-harness.py <results dir>
"""
import json
import sys
from pathlib import Path

failures = []


def check(condition, message):
    if not condition:
        failures.append(message)


def load(directory, name):
    path = directory / f"{name}.json"
    if not path.exists():
        failures.append(f"{name}.json is missing")
        return None
    return json.loads(path.read_text())


def main():
    directory = Path(sys.argv[1])
    done = load(directory, "done")
    modes = set(done["modes"].split(",")) if done else set()

    if "probe" in modes and (probe := load(directory, "probe")):
        page = probe.get("page")
        check(isinstance(page, dict), f"probe: the page script failed: {page}")
        if isinstance(page, dict):
            check(page["page"]["isSecureContext"] is True, "probe: not a secure context")
            check(page["page"]["origin"] == "dacapo://app", f"probe: origin {page['page']['origin']}")
            check(page["wasm"]["streaming"] == 5, f"probe: WebAssembly streaming: {page['wasm']}")
            check(page["fetch"]["/missing.js"]["status"] == 404, "probe: a missing file is not a 404")
            check(page["fetch"]["/../../etc/hosts"]["status"] == 404, "probe: path escapes the web root")
            check(page["readRoute"]["loaded"] is True, "probe: the Read page did not load")

    if "hotplug" in modes and (hotplug := load(directory, "hotplug")):
        check(hotplug["createStatus"] == 0, f"hotplug: virtual source status {hotplug['createStatus']}")
        check(hotplug["connectedEventMs"] > 0, "hotplug: no statechange for the new port")
        check(hotplug["disconnectedEventMs"] > 0, "hotplug: no statechange for the removed port")
        check("dacapo Hotplug" in hotplug["statusDuring"], "hotplug: the Play page did not show the port")

    if "timing" in modes and (timing := load(directory, "timing")):
        check("error" not in timing, f"timing: {timing.get('error')}")
        for run in ("idle", "busy"):
            result = timing.get(run, {})
            sent = result.get("sent")
            check(sent == 192, f"timing {run}: sent {sent}")
            check(result.get("receivedByListener") == sent, f"timing {run}: listener got {result.get('receivedByListener')} of {sent}")
            check(result.get("bytesIdentical") is True, f"timing {run}: bytes changed on the way")
            # Intervals come from the native timestamps, so they hold whatever the delivery delay:
            # exactly on iOS 26 and macOS, within 0.04 ms on the iOS 18 simulator. The page's own
            # clock ticks in 1 ms steps; a bridge that stamped on arrival errs by tens of ms.
            error = result.get("intervalErrorWithTimeStamp", {})
            check(abs(error.get("max", 1)) <= 0.1 and abs(error.get("min", 1)) <= 0.1,
                  f"timing {run}: interval error {error}")
        output = timing.get("output", {})
        check(output.get("arrived") == output.get("planned") == 100,
              f"timing output: {output.get('arrived')} of {output.get('planned')} notes arrived")

    if failures:
        print("Harness check failed:")
        for failure in failures:
            print(f"  - {failure}")
        sys.exit(1)
    print(f"Harness check passed ({', '.join(sorted(modes))})")


main()
