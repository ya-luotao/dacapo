import CoreMIDI
import Foundation
import Testing
@testable import Dacapo

/// The CoreMIDI side of the bridge (MIDI/MIDIEngine.swift, MIDI/MIDIBridge.swift).
@MainActor
struct MIDIEngineTests {
    /// CoreMIDI calls the receive block on its own real-time thread. Under Swift 6 a block that
    /// was accidentally inferred main-actor isolated traps there (A0 found it: SIGTRAP on the
    /// first message). Called here from a plain thread, it must deliver one burst on the main
    /// thread with the messages, their stamps and the source's id.
    @Test func receiveBlockRunsOffTheMainThread() async throws {
        let engine = MIDIEngine()
        #expect(engine.setupError == noErr)
        let block = MIDIEngine.receiveBlock(engine)
        var bursts: [[MIDIInbound]] = []
        var onMain = true

        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            engine.onMessages = { batch in
                onMain = onMain && Thread.isMainThread
                bursts.append(batch)
                if bursts.count == 1 { done.resume() }
            }
            nonisolated(unsafe) let receive = block
            let thread = Thread {
                #expect(!Thread.isMainThread)
                Self.withEventList([(stamp: 1000, words: [0x2090_3C64, 0x2090_3C00]), (stamp: 0, words: [0x10F8_0000])]) {
                    receive($0, MIDIEngine.refCon(-1234))
                }
            }
            thread.start()
        }
        // Anything else still queued arrives within a main-queue turn.
        try await Task.sleep(for: .milliseconds(50))

        #expect(onMain)
        #expect(bursts.count == 1)
        let batch = try #require(bursts.first)
        #expect(batch.map(\.bytes) == [[0x90, 60, 100], [0x90, 60, 0], [0xF8]])
        #expect(batch.map(\.port) == ["-1234", "-1234", "-1234"])
        #expect(batch[0].stamp == 1000 && batch[1].stamp == 1000)
        // A packet without a timestamp is stamped when it arrived.
        #expect(batch[2].stamp == batch[2].received && batch[2].received > 0)
    }

    @Test func refConCarriesTheUniqueID() {
        for uid: MIDIUniqueID in [0, 1, -1, .max, .min, 123_456] {
            #expect(MIDIEngine.refCon(uid) != nil)
            #expect(MIDIEngine.uniqueID(MIDIEngine.refCon(uid)) == uid)
        }
    }

    @Test func panicWithoutPlayingSilencesNothing() {
        #expect(MIDIEngine().panic().isEmpty)
    }

    @Test func receiveScriptHoldsOnlyNumbersAndIDs() {
        let script = MIDIBridge.receiveScript(
            [MIDIInbound(port: "-42", bytes: [0x90, 60, 0], stamp: 0, received: 0)], flushed: 2.5)
        #expect(script == "__dacapoMidi.receive([[\"-42\",0.0,[144,60,0],0.0]],2.5)")
    }

    /// Builds a MIDI 1.0 event list with one packet per entry.
    nonisolated static func withEventList(
        _ packets: [(stamp: MIDITimeStamp, words: [UInt32])], _ body: (UnsafePointer<MIDIEventList>) -> Void
    ) {
        let size = 1024
        let raw = UnsafeMutableRawPointer.allocate(byteCount: size, alignment: 8)
        defer { raw.deallocate() }
        let list = raw.bindMemory(to: MIDIEventList.self, capacity: 1)
        var packet = MIDIEventListInit(list, ._1_0)
        for entry in packets {
            var words = entry.words
            packet = MIDIEventListAdd(list, size, packet, entry.stamp, words.count, &words)
        }
        body(list)
    }
}

/// What a virtual destination receives, from CoreMIDI's thread.
final class ReceivedLog: @unchecked Sendable {
    private let lock = NSLock()
    private var entries: [(stamp: MIDITimeStamp, bytes: [UInt8])] = []

    var all: [(stamp: MIDITimeStamp, bytes: [UInt8])] { lock.withLock { entries } }

    /// Made outside the main actor: CoreMIDI calls it on its own thread.
    nonisolated func block() -> MIDIReceiveBlock {
        { [self] list, _ in
            for packet in list.unsafeSequence() {
                let stamp = packet.pointee.timeStamp
                UMP.forEachMessage(in: MIDIEngine.words(of: packet)) { bytes in
                    lock.withLock { entries.append((stamp, bytes)) }
                }
            }
        }
    }
}

@MainActor
struct MIDIPanicTests {
    /// The panic sends the page's reset sequence now and releases notes scheduled for later,
    /// without MIDIFlushOutput (which reaches a virtual destination as a System Reset, 0xFF).
    @Test func panicResetsAndReleasesScheduledNotes() async throws {
        let engine = MIDIEngine()
        let log = ReceivedLog()
        var destination = MIDIEndpointRef()
        let status = MIDIDestinationCreateWithProtocol(
            engine.clientRef, "dacapo panic test" as CFString, ._1_0, &destination, log.block())
        try #require(status == noErr)
        defer { MIDIEndpointDispose(destination) }
        try await Task.sleep(for: .milliseconds(200))
        engine.refresh()
        let id = try #require(engine.endpoints.first { $0.name == "dacapo panic test" && $0.kind == .output }?.id)

        let later = HostClock.now() + HostClock.ticks(milliseconds: 300)
        engine.send([0x90, 60, 100], to: id, at: 0)
        engine.send([0x91, 62, 90], to: id, at: later)
        #expect(engine.panic() == [id])
        try await Task.sleep(for: .milliseconds(600))

        let received = log.all
        #expect(!received.contains { $0.bytes == [0xFF] })
        #expect(received.filter { $0.bytes[0] & 0xF0 == 0xB0 }.map(\.bytes) == UMP.resetAllChannels)
        // The scheduled note still arrives at its time, then its note-off right after it.
        let on = try #require(received.first { $0.bytes == [0x91, 62, 90] })
        let off = try #require(received.first { $0.bytes == [0x81, 62, 64] })
        #expect(on.stamp == later)
        #expect(off.stamp > on.stamp)
        // A second panic has nothing left to silence.
        #expect(engine.panic().isEmpty)
    }
}
