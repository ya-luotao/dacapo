import SwiftUI
import WebKit

@main
struct DacapoApp: App {
    #if os(macOS)
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate
    #endif
    @Environment(\.scenePhase) private var scenePhase
    @State private var host: WebHost
    #if os(macOS)
    @State private var visibility: WindowVisibility
    #endif
    #if DEBUG
    @State private var harness: Harness
    #endif

    init() {
        #if os(iOS)
        AudioSession.configure()
        #endif
        let host = WebHost()
        _host = State(initialValue: host)
        #if os(macOS)
        _visibility = State(initialValue: WindowVisibility(host: host))
        #endif
        #if DEBUG
        _harness = State(initialValue: Harness(host: host))
        #endif
    }

    var body: some Scene {
        // One window: the app has one web view and one practice state. On iPhone and iPad the
        // Info.plist turns multiple scenes off.
        #if os(macOS)
        Window("dacapo", id: "main") { content }
            .defaultSize(width: 1280, height: 820)
            .windowResizability(.contentMinSize)
            .commands { AppCommands(host: host, harness: debugHarness) }
        #else
        WindowGroup { content }
            .commands { AppCommands(host: host, harness: debugHarness) }
        #endif
    }

    private var content: some View {
        WebContainer(webView: host.webView)
            .background(Color.paper)
            #if os(macOS)
            .frame(minWidth: 720, minHeight: 560)
            #else
            .ignoresSafeArea()
            #endif
            .onChange(of: scenePhase) { _, phase in
                #if os(iOS)
                // Inactive (Control Center, the app switcher) keeps the page on screen; only
                // leaving for the background hides it.
                if phase == .background { host.setVisible(false) }
                if phase == .active { host.setVisible(true) }
                #endif
            }
            #if DEBUG
            .task { await harness.runLaunchArguments() }
            #endif
    }

    private var debugHarness: Harness? {
        #if DEBUG
        harness
        #else
        nil
        #endif
    }
}

#if os(macOS)
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
#endif

#if !DEBUG
/// Release builds have no test harness (Dacapo/Debug is excluded from them).
typealias Harness = Never
#endif
