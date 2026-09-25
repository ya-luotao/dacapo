import Testing
@testable import Dacapo

/// MIDI 1.0 bytes ↔ UMP words (MIDI/UMP.swift).
struct UMPTests {
    @Test(arguments: [
        ([0x90, 60, 100], 0x2090_3C64),
        ([0x9F, 21, 1], 0x209F_1501),
        // Note-on with velocity 0 stays a note-on: the page reads it as a note-off itself.
        ([0x90, 60, 0], 0x2090_3C00),
        ([0x83, 108, 64], 0x2083_6C40),
        ([0xB0, 64, 127], 0x20B0_407F),
        ([0xC5, 7], 0x20C5_0700),
        ([0xD0, 99], 0x20D0_6300),
        ([0xE0, 0, 64], 0x20E0_0040),
        ([0xF8], 0x10F8_0000),
        ([0xFE], 0x10FE_0000),
        ([0xF2, 0x10, 0x20], 0x10F2_1020),
        ([0xF1, 0x33], 0x10F1_3300),
    ] as [([UInt8], UInt32)])
    func bytesToWord(bytes: [UInt8], word: UInt32) {
        #expect(UMP.word(for: bytes) == word)
    }

    @Test(arguments: [
        [],
        [60, 100, 0], // running status: no status byte
        [0x90, 60], // partial
        [0x90, 60, 100, 1], // too long
        [0x90, 0x80, 100], // data byte with the high bit set
        [0xC0, 5, 0], // program change is two bytes
        [0xF0, 0x7E, 0x7F, 0xF7], // SysEx
        [0xF7],
        [0xF4], [0xF5], [0xF9], [0xFD], // undefined system messages
    ] as [[UInt8]])
    func refusesAnythingElse(bytes: [UInt8]) {
        #expect(UMP.word(for: bytes) == nil)
    }

    @Test func wordsToBytesRoundTrip() {
        let messages: [[UInt8]] = [
            [0x90, 60, 100], [0x90, 60, 0], [0x80, 60, 64], [0xB3, 64, 0], [0xC0, 5], [0xD2, 40],
            [0xE1, 0x7F, 0x7F], [0xF8], [0xFA], [0xF2, 1, 2], [0xF3, 9],
        ]
        let words = messages.compactMap(UMP.word(for:))
        #expect(words.count == messages.count)
        #expect(UMP.messages(in: words) == messages)
    }

    @Test func skipsOtherMessageTypesByTheirLength() {
        let words: [UInt32] = [
            0x0000_0000, // utility (NOOP), 1 word
            0x3016_7E7F, 0x0601_0000, // 7-bit SysEx, 2 words
            0x2090_3C64,
            0x4090_3C00, 0xFFFF_0000, // MIDI 2.0 note-on, 2 words
            0x5000_0000, 0, 0, 0, // 8-bit data, 4 words
            0x10F8_0000,
        ]
        #expect(UMP.messages(in: words) == [[0x90, 60, 100], [0xF8]])
    }

    @Test func stopsAtAPacketCutShort() {
        #expect(UMP.messages(in: [0x2090_3C64, 0x4090_3C00]) == [[0x90, 60, 100]])
    }

    @Test func dropsUndefinedStatusesInWords() {
        #expect(UMP.messages(in: [0x10F4_0000, 0x10F0_0000, 0x2070_3C64]).isEmpty)
    }

    @Test func masksDataBytesToSevenBits() {
        #expect(UMP.messages(in: [0x2090_BCE4]) == [[0x90, 0x3C, 0x64]])
    }

    @Test func resetAllChannelsMatchesThePage() {
        // src/output/messages.ts resetAllChannels(): per channel, sustain off, all notes off,
        // all sound off.
        #expect(UMP.resetAllChannels.count == 48)
        #expect(Array(UMP.resetAllChannels.prefix(3)) == [[0xB0, 64, 0], [0xB0, 123, 0], [0xB0, 120, 0]])
        #expect(UMP.resetAllChannels.last == [0xBF, 120, 0])
        #expect(UMP.resetAllChannels.allSatisfy { UMP.word(for: $0) != nil })
    }
}
