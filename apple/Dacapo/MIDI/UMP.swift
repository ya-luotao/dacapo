/// MIDI 1.0 byte messages ↔ Universal MIDI Packet words, for the MIDI 1.0 protocol: channel voice
/// messages as UMP type 2, system common and real-time messages as type 1, always group 0. Only
/// what dacapo exchanges; SysEx (UMP types 3 and 5) is neither requested nor sent.
enum UMP {
    /// Words per packet, by message type (the top four bits of the first word).
    static let wordCounts = [1, 1, 1, 2, 2, 4, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4]

    /// Length in bytes of a MIDI 1.0 message with this status byte, or nil when dacapo does not
    /// carry it: data bytes, SysEx (F0, F7) and the undefined system statuses (F4, F5, F9, FD).
    static func messageLength(status: UInt8) -> Int? {
        switch status {
        case 0x80...0xBF, 0xE0...0xEF: 3
        case 0xC0...0xDF: 2
        case 0xF1, 0xF3: 2
        case 0xF2: 3
        case 0xF6, 0xF8, 0xFA, 0xFB, 0xFC, 0xFE, 0xFF: 1
        default: nil
        }
    }

    /// One complete MIDI 1.0 message as one UMP word; nil for anything else (running status, a
    /// partial message, a data byte with the high bit set, SysEx).
    static func word(for bytes: [UInt8]) -> UInt32? {
        guard let status = bytes.first, let length = messageLength(status: status),
              bytes.count == length, bytes.dropFirst().allSatisfy({ $0 < 0x80 })
        else { return nil }
        let data1 = UInt32(length > 1 ? bytes[1] : 0)
        let data2 = UInt32(length > 2 ? bytes[2] : 0)
        let type: UInt32 = status >= 0xF0 ? 0x1 : 0x2
        return type << 28 | UInt32(status) << 16 | data1 << 8 | data2
    }

    /// The MIDI 1.0 messages in a run of UMP words, in order. Other message types (utility,
    /// SysEx, MIDI 2.0 channel voice, …) are skipped by their length; a packet cut short ends
    /// the run.
    static func forEachMessage(in words: UnsafeBufferPointer<UInt32>, _ body: ([UInt8]) -> Void) {
        var i = 0
        while i < words.count {
            let word = words[i]
            let type = Int(word >> 28)
            let size = wordCounts[type]
            guard i + size <= words.count else { return }
            i += size
            let status = UInt8(truncatingIfNeeded: word >> 16)
            let data1 = UInt8(truncatingIfNeeded: word >> 8) & 0x7F
            let data2 = UInt8(truncatingIfNeeded: word) & 0x7F
            switch type {
            case 0x2 where status >= 0x80 && status < 0xF0, 0x1 where status >= 0xF0:
                guard let length = messageLength(status: status) else { continue }
                body(Array([status, data1, data2].prefix(length)))
            default:
                continue
            }
        }
    }

    static func messages(in words: [UInt32]) -> [[UInt8]] {
        var out: [[UInt8]] = []
        words.withUnsafeBufferPointer { forEachMessage(in: $0) { out.append($0) } }
        return out
    }

    /// Sustain up, all notes off and all sound off on every channel: the same panic sequence as
    /// the page's `resetAllChannels()` (src/output/messages.ts).
    static let resetAllChannels: [[UInt8]] = (0..<16).flatMap { (channel: UInt8) -> [[UInt8]] in
        [[0xB0 | channel, 64, 0], [0xB0 | channel, 123, 0], [0xB0 | channel, 120, 0]]
    }
}
