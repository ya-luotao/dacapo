import Darwin

/// CoreMIDI's clock: mach host time (`mach_absolute_time`), the clock MIDI timestamps are in.
/// The page gets it in milliseconds and maps it onto its `performance.now()` timeline itself
/// (midi-bridge.js keeps the offset, measured by round trips).
enum HostClock {
    private static let timebase: mach_timebase_info_data_t = {
        var info = mach_timebase_info_data_t()
        mach_timebase_info(&info)
        return info
    }()

    static func now() -> UInt64 { mach_absolute_time() }

    static func milliseconds(_ ticks: UInt64) -> Double {
        let nanoseconds: Double = Double(ticks) * Double(timebase.numer) / Double(timebase.denom)
        return nanoseconds / 1_000_000
    }

    static func ticks(milliseconds ms: Double) -> UInt64 {
        guard ms > 0 else { return 0 }
        let nanoseconds: Double = ms * 1_000_000
        let ticks: Double = nanoseconds * Double(timebase.denom) / Double(timebase.numer)
        return UInt64(ticks.rounded())
    }

    static func nowMilliseconds() -> Double { milliseconds(now()) }
}
