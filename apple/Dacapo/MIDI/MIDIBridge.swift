import Foundation
import WebKit

/// Connects midi-bridge.js in the page with CoreMIDI (`MIDIEngine`).
///
/// Page → native (`webkit.messageHandlers.dacapoMidi.postMessage`, answered through the reply
/// handler): `hello` (the endpoint list), `clock` (host time now, in ms, for the clock sync),
/// `send` (messages with a host time) and `clear`. Native → page: `__dacapoMidi.receive(batch)`
/// and `__dacapoMidi.ports(list)` through `evaluateJavaScript`.
@MainActor
final class MIDIBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let handlerName = "dacapoMidi"

    let engine: MIDIEngine
    weak var webView: WKWebView?
    /// The current page asked for MIDI access; reset on every navigation.
    private(set) var pageListening = false

    init(engine: MIDIEngine) {
        self.engine = engine
        super.init()
        engine.onMessages = { [weak self] batch in self?.deliver(batch) }
        engine.onEndpoints = { [weak self] list in self?.announce(list) }
    }

    static func userScript() -> WKUserScript {
        WKUserScript(
            source: BundledScript.source("midi-bridge"), injectionTime: .atDocumentStart,
            forMainFrameOnly: true, in: .page)
    }

    /// A new document is loading: it has not asked for MIDI yet.
    func pageWillLoad() { pageListening = false }

    /// The document finished loading. If it already listens, it gets the endpoint list again:
    /// A0 once saw a fresh install miss a port that appeared while the page was starting.
    func pageDidLoad() {
        guard pageListening else { return }
        engine.refresh()
        announce(engine.endpoints)
    }

    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        let now = HostClock.nowMilliseconds()
        // Only the app's own page, in the main frame.
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == SchemeHandler.scheme,
              let body = message.body as? [String: Any], let type = body["type"] as? String
        else {
            return replyHandler(nil, "bad message")
        }
        switch type {
        case "clock":
            replyHandler(now, nil)
        case "hello":
            if engine.setupError != noErr {
                return replyHandler(["error": "CoreMIDI error \(engine.setupError)"], nil)
            }
            engine.refresh()
            pageListening = true
            replyHandler(["ports": engine.endpoints.map(Self.json)], nil)
        case "send":
            for item in body["items"] as? [[Any]] ?? [] {
                guard item.count == 3, let id = item[0] as? String, let data = item[1] as? [NSNumber],
                      let at = item[2] as? NSNumber
                else { continue }
                // The page validated the message; UMP.word(for:) refuses anything else again.
                guard data.allSatisfy({ (0...255).contains($0.intValue) }) else { continue }
                engine.send(data.map(\.uint8Value), to: id, at: HostClock.ticks(milliseconds: at.doubleValue))
            }
            replyHandler(nil, nil)
        case "clear":
            if let id = body["id"] as? String { engine.flushOutput(id) }
            replyHandler(nil, nil)
        default:
            replyHandler(nil, "unknown message \(type)")
        }
    }

    static func json(_ info: MIDIEndpointInfo) -> [String: Any] {
        [
            "id": info.id, "type": info.kind.rawValue, "name": info.name,
            "manufacturer": info.manufacturer, "version": info.version, "online": info.online,
        ]
    }

    private func announce(_ list: [MIDIEndpointInfo]) {
        guard pageListening, let webView,
              let data = try? JSONSerialization.data(withJSONObject: list.map(Self.json))
        else { return }
        webView.evaluateJavaScript("__dacapoMidi.ports(\(String(decoding: data, as: UTF8.self)))")
    }

    /// One script call per burst.
    private func deliver(_ batch: [MIDIInbound]) {
        guard pageListening, let webView else { return }
        webView.evaluateJavaScript(Self.receiveScript(batch, flushed: HostClock.nowMilliseconds()))
    }

    /// `__dacapoMidi.receive([[id, stampMs, [bytes…], receivedMs], …], flushedMs)`. Built by hand
    /// for speed: it holds only numbers and the port ids, which are CoreMIDI unique ids (digits).
    static func receiveScript(_ batch: [MIDIInbound], flushed: Double) -> String {
        var script = "__dacapoMidi.receive(["
        for (i, m) in batch.enumerated() {
            if i > 0 { script += "," }
            script += "[\"\(m.port)\",\(HostClock.milliseconds(m.stamp)),["
            script += m.bytes.map(String.init).joined(separator: ",")
            script += "],\(HostClock.milliseconds(m.received))]"
        }
        script += "],\(flushed))"
        return script
    }
}

/// A JavaScript file shipped in the app bundle.
enum BundledScript {
    static func source(_ name: String) -> String {
        guard let url = Bundle.main.url(forResource: name, withExtension: "js"),
              let source = try? String(contentsOf: url, encoding: .utf8)
        else { fatalError("\(name).js is missing from the app bundle") }
        return source
    }
}
