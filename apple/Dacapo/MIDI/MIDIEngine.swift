import CoreMIDI
import Foundation
import os

/// A MIDI endpoint as the page sees it. `id` is CoreMIDI's unique id, stable across launches and
/// hot-plugging for a given device.
struct MIDIEndpointInfo: Equatable, Sendable {
    enum Kind: String, Sendable { case input, output }
    let id: String
    let kind: Kind
    let name: String
    let manufacturer: String
    let version: String
    /// False when the driver reports the device offline (it stays listed, like a Web MIDI port
    /// in the "disconnected" state).
    let online: Bool
    let ref: MIDIEndpointRef
}

/// One complete MIDI 1.0 message from a source, with its CoreMIDI timestamp and when this
/// process received it (both mach host time).
struct MIDIInbound: Sendable, Equatable {
    let port: String
    let bytes: [UInt8]
    let stamp: UInt64
    let received: UInt64
}

/// The CoreMIDI side of the bridge: one client, one input port connected to every source, one
/// output port. Uses the UMP API (`MIDIInputPortCreateWithProtocol`, `MIDISendEventList`) with
/// the MIDI 1.0 protocol; the packet-list API is deprecated since iOS 14 / macOS 11 and our floor
/// is iOS 17 / macOS 14.
///
/// Threading: CoreMIDI calls the receive block on its own real-time thread. It only parses and
/// appends to `pending` under a lock; delivery happens on the main thread, one hop per burst.
/// Everything else runs on the main actor.
final class MIDIEngine: @unchecked Sendable {
    static let log = Logger(subsystem: "dacapo", category: "midi")

    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()
    private var outputPort = MIDIPortRef()
    private(set) var setupError: OSStatus = noErr

    // Main actor only.
    @MainActor private(set) var endpoints: [MIDIEndpointInfo] = []
    @MainActor private var connected: [MIDIUniqueID: MIDIEndpointRef] = [:]
    /// Destinations the page has sent to since the last panic: the ones to silence.
    @MainActor private var played: Set<String> = []
    /// Note-ons handed to CoreMIDI for later, per destination: channel and key → the latest time.
    @MainActor private var scheduledOns: [String: [UInt16: UInt64]] = [:]
    /// Called on the main thread with every burst of messages.
    @MainActor var onMessages: (([MIDIInbound]) -> Void)?
    /// Called on the main thread when the endpoint list changed.
    @MainActor var onEndpoints: (([MIDIEndpointInfo]) -> Void)?

    // Shared with the receive thread, under `lock`.
    private let lock = NSLock()
    private var pending: [MIDIInbound] = []
    private var flushScheduled = false
    private var sourceIds: [MIDIUniqueID: String] = [:]

    @MainActor
    init() {
        var status = MIDIClientCreateWithBlock("dacapo" as CFString, &client, Self.notifyBlock(self))
        guard status == noErr else { fail(status, "MIDIClientCreateWithBlock"); return }
        status = MIDIInputPortCreateWithProtocol(
            client, "dacapo in" as CFString, ._1_0, &inputPort, Self.receiveBlock(self))
        guard status == noErr else { fail(status, "MIDIInputPortCreateWithProtocol"); return }
        status = MIDIOutputPortCreate(client, "dacapo out" as CFString, &outputPort)
        guard status == noErr else { fail(status, "MIDIOutputPortCreate"); return }
        refresh()
    }

    deinit {
        if client != 0 { MIDIClientDispose(client) }
    }

    // CoreMIDI calls these blocks on its own threads. They are made outside the main actor: a
    // closure written in a @MainActor initializer is inferred main-actor isolated, and Swift 6
    // traps when CoreMIDI calls it from another thread (found in A0; DacapoTests covers it).
    private nonisolated static func notifyBlock(_ engine: MIDIEngine) -> MIDINotifyBlock {
        { [weak engine] note in
            let id = note.pointee.messageID
            guard id == .msgSetupChanged || id == .msgObjectAdded || id == .msgObjectRemoved
                || id == .msgPropertyChanged
            else { return }
            DispatchQueue.main.async { MainActor.assumeIsolated { engine?.refresh() } }
        }
    }

    nonisolated static func receiveBlock(_ engine: MIDIEngine) -> MIDIReceiveBlock {
        { [weak engine] list, refCon in engine?.receive(list, refCon) }
    }

    private func fail(_ status: OSStatus, _ call: String) {
        setupError = status
        Self.log.error("\(call) failed: \(status)")
    }

    var clientRef: MIDIClientRef { client }

    // MARK: Endpoints

    /// Reads the endpoint list again, connects the input port to every source and reports a
    /// change through `onEndpoints`.
    @MainActor
    func refresh() {
        var next: [MIDIEndpointInfo] = []
        for i in 0..<MIDIGetNumberOfSources() {
            if let info = Self.info(MIDIGetSource(i), kind: .input) { next.append(info) }
        }
        for i in 0..<MIDIGetNumberOfDestinations() {
            if let info = Self.info(MIDIGetDestination(i), kind: .output) { next.append(info) }
        }
        // Listen to every source; a source that went away needs nothing (CoreMIDI drops it).
        var keep: [MIDIUniqueID: MIDIEndpointRef] = [:]
        var ids: [MIDIUniqueID: String] = [:]
        for info in next where info.kind == .input {
            guard let uid = MIDIUniqueID(info.id) else { continue }
            ids[uid] = info.id
            if connected[uid] != info.ref {
                let status = MIDIPortConnectSource(inputPort, info.ref, Self.refCon(uid))
                if status != noErr { Self.log.error("connect \(info.name): \(status)") }
            }
            keep[uid] = info.ref
        }
        connected = keep
        lock.withLock { sourceIds = ids }
        guard next != endpoints else { return }
        endpoints = next
        onEndpoints?(next)
    }

    /// The source's unique id travels as the connection's refCon (never dereferenced). Bit 32 is
    /// set so that a unique id of 0 still gives a non-null pointer.
    static func refCon(_ uid: MIDIUniqueID) -> UnsafeMutableRawPointer? {
        let bits: Int = Int(UInt32(bitPattern: uid)) | (1 << 32)
        return UnsafeMutableRawPointer(bitPattern: bits)
    }

    static func uniqueID(_ refCon: UnsafeMutableRawPointer?) -> MIDIUniqueID {
        MIDIUniqueID(truncatingIfNeeded: Int(bitPattern: refCon))
    }

    private static func info(_ ref: MIDIEndpointRef, kind: MIDIEndpointInfo.Kind) -> MIDIEndpointInfo? {
        guard ref != 0 else { return nil }
        var uid: Int32 = 0
        guard MIDIObjectGetIntegerProperty(ref, kMIDIPropertyUniqueID, &uid) == noErr else { return nil }
        var offline: Int32 = 0
        MIDIObjectGetIntegerProperty(ref, kMIDIPropertyOffline, &offline)
        var version: Int32 = 0
        MIDIObjectGetIntegerProperty(ref, kMIDIPropertyDriverVersion, &version)
        return MIDIEndpointInfo(
            id: String(uid),
            kind: kind,
            name: string(ref, kMIDIPropertyDisplayName) ?? string(ref, kMIDIPropertyName) ?? "",
            manufacturer: string(ref, kMIDIPropertyManufacturer) ?? "",
            version: version == 0 ? "" : String(version),
            online: offline == 0,
            ref: ref
        )
    }

    private static func string(_ ref: MIDIObjectRef, _ property: CFString) -> String? {
        var value: Unmanaged<CFString>?
        guard MIDIObjectGetStringProperty(ref, property, &value) == noErr, let value else { return nil }
        return value.takeRetainedValue() as String
    }

    // MARK: Input

    /// On CoreMIDI's receive thread.
    private func receive(_ list: UnsafePointer<MIDIEventList>, _ refCon: UnsafeMutableRawPointer?) {
        let received = HostClock.now()
        let uid = Self.uniqueID(refCon)
        let port = lock.withLock { sourceIds[uid] } ?? String(uid)
        var batch: [MIDIInbound] = []
        for packet in list.unsafeSequence() {
            let stamp = packet.pointee.timeStamp == 0 ? received : packet.pointee.timeStamp
            UMP.forEachMessage(in: Self.words(of: packet)) { bytes in
                batch.append(MIDIInbound(port: port, bytes: bytes, stamp: stamp, received: received))
            }
        }
        guard !batch.isEmpty else { return }
        let schedule = lock.withLock {
            pending.append(contentsOf: batch)
            defer { flushScheduled = true }
            return !flushScheduled
        }
        if schedule {
            DispatchQueue.main.async { MainActor.assumeIsolated { self.flush() } }
        }
    }

    @MainActor
    private func flush() {
        let batch = lock.withLock {
            flushScheduled = false
            defer { pending.removeAll(keepingCapacity: true) }
            return pending
        }
        if !batch.isEmpty { onMessages?(batch) }
    }

    /// The UMP words of one packet.
    static func words(of packet: UnsafePointer<MIDIEventPacket>) -> UnsafeBufferPointer<UInt32> {
        let count = min(Int(packet.pointee.wordCount), 64)
        let offset = MemoryLayout<MIDIEventPacket>.offset(of: \MIDIEventPacket.words)!
        let start = (UnsafeRawPointer(packet) + offset).assumingMemoryBound(to: UInt32.self)
        return UnsafeBufferPointer(start: start, count: count)
    }

    // MARK: Output

    /// Sends one MIDI 1.0 message to a destination, at a host time (0: now). CoreMIDI holds
    /// messages with a future timestamp and delivers them on time.
    @MainActor
    func send(_ bytes: [UInt8], to id: String, at time: UInt64) {
        guard let endpoint = destination(id), let word = UMP.word(for: bytes) else { return }
        played.insert(id)
        let kind: UInt8 = bytes[0] & 0xF0
        if kind == 0x90, bytes[2] > 0, time > HostClock.now() {
            let channel: UInt16 = UInt16(bytes[0] & 0x0F)
            let key: UInt16 = (channel << 8) | UInt16(bytes[1])
            let latest: UInt64 = scheduledOns[id]?[key] ?? 0
            scheduledOns[id, default: [:]][key] = max(latest, time)
        }
        Self.send(word, time: time) { MIDISendEventList(outputPort, endpoint.ref, $0) }
    }

    /// Drops what is still scheduled for a destination (Web MIDI's `clear()`, which dacapo does
    /// not call). CoreMIDI tells a virtual destination about the flush with a System Reset
    /// message (0xFF, seen in A1), so the panic below does not flush.
    @MainActor
    func flushOutput(_ id: String) {
        guard let endpoint = destination(id) else { return }
        scheduledOns[id] = nil
        MIDIFlushOutput(endpoint.ref)
    }

    /// Silences every destination the page has played since the last panic, as the page's own
    /// panic does (output/scheduler.ts): sustain up, all notes off and all sound off on every
    /// channel now, and for the note-ons CoreMIDI still holds for later, a note-off just after the
    /// last of them. For when the app leaves the screen, in case the page is suspended before its
    /// own panic goes out. Returns the destinations silenced.
    @MainActor
    @discardableResult
    func panic() -> [String] {
        let ids = played.sorted()
        let now = HostClock.now()
        played.removeAll()
        defer { scheduledOns.removeAll() }
        for id in ids {
            guard let endpoint = destination(id) else { continue }
            let deliver = { (list: UnsafePointer<MIDIEventList>) in MIDISendEventList(self.outputPort, endpoint.ref, list) }
            for message in UMP.resetAllChannels {
                guard let word = UMP.word(for: message) else { continue }
                Self.send(word, time: 0, deliver)
            }
            let late = (scheduledOns[id] ?? [:]).filter { $0.value > now }
            guard let latest = late.values.max() else { continue }
            // A millisecond later, so no port has to keep equal timestamps in order.
            let off = latest + HostClock.ticks(milliseconds: 1)
            for key in late.keys.sorted() {
                let status: UInt8 = 0x80 | UInt8(truncatingIfNeeded: key >> 8)
                let note: UInt8 = UInt8(truncatingIfNeeded: key)
                let message: [UInt8] = [status, note, 64]
                if let word = UMP.word(for: message) { Self.send(word, time: off, deliver) }
            }
        }
        return ids
    }

    @MainActor
    private func destination(_ id: String) -> MIDIEndpointInfo? {
        endpoints.first { $0.id == id && $0.kind == .output }
    }

    static func send(_ word: UInt32, time: UInt64, _ deliver: (UnsafePointer<MIDIEventList>) -> OSStatus) {
        var list = MIDIEventList()
        var words = [word]
        let packet = MIDIEventListInit(&list, ._1_0)
        _ = MIDIEventListAdd(&list, MemoryLayout<MIDIEventList>.size, packet, time, 1, &words)
        let status = deliver(&list)
        if status != noErr { log.error("send failed: \(status)") }
    }
}
