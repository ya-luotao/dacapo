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
        Double(ticks) * Double(timebase.numer) / Double(timebase.denom) / 1_000_000
    }

    static func ticks(milliseconds ms: Double) -> UInt64 {
        guard ms > 0 else { return 0 }
        return UInt64((ms * 1_000_000 * Double(timebase.denom) / Double(timebase.numer)).rounded())
    }

    static func nowMilliseconds() -> Double { milliseconds(now()) }
}
