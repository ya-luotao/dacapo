#!/usr/bin/env python3
"""Prints the UDID of an available simulator: the first iPad Pro (else any iPad, else any iPhone)
on the newest installed iOS runtime. CI runners come with different runtimes and devices, so the
workflow asks instead of naming one.

    scripts/pick-simulator.py
"""
import json
import subprocess
import sys

listing = json.loads(
    subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"])
)
runtimes = []
for runtime, devices in listing["devices"].items():
    if ".iOS-" not in runtime or not devices:
        continue
    version = tuple(int(part) for part in runtime.rsplit(".iOS-", 1)[1].split("-"))
    runtimes.append((version, devices))
if not runtimes:
    sys.exit("error: no iOS simulator available")
_, devices = max(runtimes, key=lambda entry: entry[0])
for prefix in ("iPad Pro", "iPad", "iPhone"):
    for device in devices:
        if device["name"].startswith(prefix):
            print(device["udid"])
            sys.exit(0)
sys.exit("error: no iPad or iPhone simulator on the newest runtime")
