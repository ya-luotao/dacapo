import WebKit

/// Page → native messages other than MIDI, sent by src/lib/shell.ts through
/// `webkit.messageHandlers.dacapoApp.postMessage(…)`:
///
/// - `{ type: 'keepAwake', on: Bool }`: a Read session, a piece run or a demo started or ended;
///   the screen stays on while one is active.
///
/// app-shell.js, injected before the page's own scripts, marks the document as running in the
/// app (`<html data-shell="apple">`).
@MainActor
final class AppMessages: NSObject, WKScriptMessageHandler {
    static let handlerName = "dacapoApp"

    private weak var host: WebHost?

    init(host: WebHost) {
        self.host = host
    }

    static func userScript() -> WKUserScript {
        WKUserScript(
            source: BundledScript.source("app-shell"), injectionTime: .atDocumentStart,
            forMainFrameOnly: true, in: .page)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only the app's own page, in the main frame.
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == SchemeHandler.scheme,
              let body = message.body as? [String: Any], let type = body["type"] as? String
        else { return }
        switch type {
        case "keepAwake":
            let on = body["on"] as? Bool ?? false
            host?.keepAwake.requested = on
            host?.log("keep awake: \(on)")
        default:
            host?.log("unknown app message \(type)")
        }
    }
}
