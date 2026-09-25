#if DEBUG
import CoreMIDI
import Foundation

/// A virtual MIDI source and destination, both named "dacapo Test Port", so the page sees a
/// keyboard with an input and an output of the same name (as with a USB instrument). The source
/// plays scripted notes at exact host times; the destination records what the page sends.
/// Debug harness only.
final class TestPorts: @unchecked Sendable {
    static let name = "dacapo Test Port"

    private(set) var source = MIDIEndpointRef()
    private(set) var destination = MIDIEndpointRef()
    let sourceStatus: OSStatus
    let destinationStatus: OSStatus

    private let sink = SinkLog()

    init(client: MIDIClientRef) {
        var src = MIDIEndpointRef()
        sourceStatus = MIDISourceCreateWithProtocol(client, Self.name as CFString, ._1_0, &src)
        var dst = MIDIEndpointRef()
        let sink = sink
        let status = MIDIDestinationCreateWithProtocol(client, Self.name as CFString, ._1_0, &dst) {
            list, _ in
            let received = HostClock.now()
            var entries: [(bytes: [UInt8], stamp: UInt64, received: UInt64)] = []
            for packet in list.unsafeSequence() {
                let stamp = packet.pointee.timeStamp
                UMP.forEachMessage(in: MIDIEngine.words(of: packet)) { entries.append(($0, stamp, received)) }
            }
            sink.append(entries)
        }
        destinationStatus = status
        source = src
        destination = dst
    }

    deinit {
        if source != 0 { MIDIEndpointDispose(source) }
        if destination != 0 { MIDIEndpointDispose(destination) }
    }

    /// Sends one message from the virtual source, stamped now; returns the stamp.
    @discardableResult
    func emit(_ bytes: [UInt8]) -> UInt64 {
        let stamp = HostClock.now()
        if let word = UMP.word(for: bytes) {
            MIDIEngine.send(word, time: stamp) { MIDIReceivedEventList(source, $0) }
        }
        return stamp
    }

    /// Plays `messages` at `start + offset` (ms) each, on a real-time-ish thread, waiting with
    /// `mach_wait_until`. Returns the host time each one was stamped with.
    func play(_ messages: [(offsetMs: Double, bytes: [UInt8])], startingIn leadMs: Double = 100) async -> [UInt64] {
        await withCheckedContinuation { continuation in
            let thread = Thread {
                let start = HostClock.now() + HostClock.ticks(milliseconds: leadMs)
                var stamps: [UInt64] = []
                stamps.reserveCapacity(messages.count)
                for message in messages {
                    mach_wait_until(start + HostClock.ticks(milliseconds: message.offsetMs))
                    stamps.append(self.emit(message.bytes))
                }
                continuation.resume(returning: stamps)
            }
            thread.qualityOfService = .userInteractive
            thread.start()
        }
    }

    func takeSinkLog() -> [SinkLog.Entry] { sink.take() }
}

/// What the virtual destination received, shared with CoreMIDI's thread.
final class SinkLog: @unchecked Sendable {
    typealias Entry = (bytes: [UInt8], stamp: UInt64, received: UInt64)
    private let lock = NSLock()
    private var entries: [Entry] = []

    func append(_ more: [Entry]) { lock.withLock { entries.append(contentsOf: more) } }

    func take() -> [Entry] {
        lock.withLock {
            defer { entries.removeAll() }
            return entries
        }
    }
}
#endif
