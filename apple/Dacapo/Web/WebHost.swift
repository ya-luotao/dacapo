import Foundation
import WebKit
#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// Owns the web view: the dacapo:// scheme, the scripts injected before the page's own (the app
/// shell marker and the Web MIDI bridge), the page → native messages, and the delegates the page
/// needs (links out of the app, downloads, file input on the Mac, a crashed web process).
@MainActor
final class WebHost: NSObject {
    let webView: WKWebView
    let schemeHandler: SchemeHandler
    let midi: MIDIEngine
    let bridge: MIDIBridge
    let keepAwake = KeepAwake()
    let downloads = Downloads()

    /// Crashes of the web content process in a row, to stop reloading a page that keeps crashing.
    private var recentCrashes: [Date] = []
    private var loadWaiters: [CheckedContinuation<Void, Never>] = []
    private(set) var loaded = false

    #if DEBUG
    /// What happened, for the debug harness.
    private(set) var events: [String] = []
    /// When set, the next file input is answered with these files instead of a panel (harness).
    var automaticOpenPanelFiles: [URL]?
    #endif

    override init() {
        let webRoot = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
        schemeHandler = SchemeHandler(root: webRoot)
        midi = MIDIEngine()
        bridge = MIDIBridge(engine: midi)

        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: SchemeHandler.scheme)
        configuration.websiteDataStore = .default()
        // The rhythm click (Web Audio) must start without a tap on the page first.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        #if os(iOS)
        configuration.allowsInlineMediaPlayback = true
        configuration.dataDetectorTypes = []
        #endif
        let content = configuration.userContentController
        content.addUserScript(AppMessages.userScript())
        content.addUserScript(MIDIBridge.userScript())
        content.addScriptMessageHandler(bridge, contentWorld: .page, name: MIDIBridge.handlerName)

        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        content.add(AppMessages(host: self), contentWorld: .page, name: AppMessages.handlerName)
        bridge.webView = webView
        downloads.webView = webView
        webView.navigationDelegate = self
        webView.uiDelegate = self
        #if DEBUG
        webView.isInspectable = true
        #endif
        webView.underPageBackgroundColor = .paper
        #if os(iOS)
        webView.isOpaque = false
        webView.backgroundColor = .paper
        webView.scrollView.backgroundColor = .paper
        // The page pads itself with env(safe-area-inset-*) (viewport-fit=cover).
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #endif
        webView.load(URLRequest(url: SchemeHandler.origin))
    }

    func log(_ line: String) {
        #if DEBUG
        events.append(line)
        print("[dacapo] \(line)")
        #endif
    }

    /// Shows a route of the page, e.g. `#/settings`.
    func show(_ hash: String) {
        guard hash.hasPrefix("#/"), hash.allSatisfy({ $0.isLetter || $0.isNumber || "#/-_".contains($0) })
        else { return }
        if loaded {
            webView.evaluateJavaScript("location.hash = '\(hash)'")
        } else {
            webView.load(URLRequest(url: URL(string: hash, relativeTo: SchemeHandler.origin)!.absoluteURL))
        }
    }

    /// The app went off screen (iOS: background; Mac: hidden or its window fully covered) or
    /// came back. WebKit tells the page itself (`visibilitychange`), and the page stops and
    /// silences what plays; the page may be suspended before its messages go out, so the output
    /// is silenced from here too.
    func setVisible(_ visible: Bool) {
        keepAwake.visible = visible
        if !visible {
            let silenced = midi.panic()
            log("hidden; silenced \(silenced)")
        }
    }

    /// Resolves once the first page has finished loading.
    func waitUntilLoaded() async {
        if loaded { return }
        await withCheckedContinuation { loadWaiters.append($0) }
    }

    /// Opens a link outside the app in the system browser (or mail).
    func openExternally(_ url: URL) {
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #else
        UIApplication.shared.open(url)
        #endif
    }
}

extension WebHost: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        bridge.pageWillLoad()
        // A new document has asked for nothing yet.
        keepAwake.requested = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        bridge.pageDidLoad()
        let waiters = loadWaiters
        loadWaiters.removeAll()
        for waiter in waiters { waiter.resume() }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor action: WKNavigationAction,
        preferences: WKWebpagePreferences
    ) async -> (WKNavigationActionPolicy, WKWebpagePreferences) {
        // A `download` link (the backup export): WebKit's default would navigate the whole app
        // to the blob: URL. As a download it goes to the share sheet or a save panel.
        if action.shouldPerformDownload {
            log("download requested")
            return (.download, preferences)
        }
        guard let url = action.request.url else { return (.cancel, preferences) }
        if SchemeHandler.isAppURL(url) || url.scheme == "about" {
            return (.allow, preferences)
        }
        // Everything else leaves the app: links open in the browser, never in the app's view.
        if action.navigationType == .linkActivated, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            openExternally(url)
        }
        return (.cancel, preferences)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        downloads.start(download)
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        downloads.start(download)
    }

    /// The web content process ended (on iOS, usually the system reclaiming memory while the app
    /// was in the background). The page is reloaded at the route it showed; IndexedDB keeps the
    /// practice data. After three crashes within a minute it starts from the first page instead.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        let now = Date()
        recentCrashes = recentCrashes.filter { now.timeIntervalSince($0) < 60 } + [now]
        let last = webView.url
        let restore = recentCrashes.count < 3 && SchemeHandler.isAppURL(last) ? last! : SchemeHandler.origin
        log("web content process terminated; loading \(restore.absoluteString)")
        loaded = false
        keepAwake.requested = false
        bridge.pageWillLoad()
        webView.load(URLRequest(url: restore))
    }
}

extension WebHost: WKUIDelegate {
    /// `target="_blank"` links: open outside the app, never in a second web view.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = action.request.url, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            openExternally(url)
        }
        return nil
    }

    #if os(macOS)
    /// WKWebView on macOS shows nothing for `<input type="file">` unless the app answers this.
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo
    ) async -> [URL]? {
        #if DEBUG
        if let files = automaticOpenPanelFiles {
            automaticOpenPanelFiles = nil
            log("open panel answered by the harness")
            return files
        }
        #endif
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        let response: NSApplication.ModalResponse
        if let window = webView.window {
            response = await panel.beginSheetModal(for: window)
        } else {
            response = await panel.begin()
        }
        return response == .OK ? panel.urls : nil
    }
    #endif
}
