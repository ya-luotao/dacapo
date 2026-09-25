import SwiftUI

/// The menu bar on the Mac, and the ⌘ shortcut overlay on iPad with a hardware keyboard: About
/// and Settings open the page's own views; Help opens the project page.
struct AppCommands: Commands {
    let host: WebHost
    let harness: Harness?

    static let helpURL = URL(string: "https://github.com/ya-luotao/dacapo#readme")!

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("About dacapo") { host.show("#/about") }
        }
        CommandGroup(replacing: .appSettings) {
            Button("Settings…") { host.show("#/settings") }
                .keyboardShortcut(",", modifiers: .command)
        }
        // One window only (DacapoApp).
        CommandGroup(replacing: .newItem) {}
        CommandGroup(replacing: .help) {
            Button("dacapo Help") { host.openExternally(Self.helpURL) }
        }
        #if DEBUG
        if let harness {
            CommandMenu("Debug") {
                Button("Run Web Probe") { Task { await harness.probe() } }
                Button("Run MIDI Timing Test") { Task { await harness.timing() } }
                Button("Play Ode to Joy (Wait Mode)") { Task { await harness.waitDemo() } }
                Button("Save Snapshot") { Task { await harness.snapshot("manual") } }
                Divider()
                Button("Reload") { host.webView.reload() }
                    .keyboardShortcut("r")
            }
        }
        #endif
    }
}
