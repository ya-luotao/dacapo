import Foundation
import SwiftUI
#if os(macOS)
import AppKit
#else
import AVFoundation
import UIKit
#endif

/// Keeps the screen on while the page asks for it (a Read session, a piece run or a demo is
/// active) and the app is on screen.
@MainActor
final class KeepAwake {
    /// What the page asked for last (`keepAwake` message); reset when a new page loads.
    var requested = false { didSet { apply() } }
    /// The app is on screen. On the Mac a hidden or covered window must not keep the display on.
    var visible = true { didSet { apply() } }
    private(set) var isOn = false

    #if os(macOS)
    private var activity: (any NSObjectProtocol)?
    #endif

    private func apply() {
        let on = requested && visible
        guard on != isOn else { return }
        isOn = on
        #if os(macOS)
        if on {
            activity = ProcessInfo.processInfo.beginActivity(
                options: [.idleDisplaySleepDisabled, .userInitiated], reason: "Practising")
        } else if let activity {
            ProcessInfo.processInfo.endActivity(activity)
            self.activity = nil
        }
        #else
        UIApplication.shared.isIdleTimerDisabled = on
        #endif
    }
}

#if os(iOS)
/// The rhythm click is Web Audio, which WebKit plays through the app's audio session. As
/// `.playback` it is heard with the silent switch on; `.mixWithOthers` leaves other apps' audio
/// playing. app-shell.js also sets the page's `navigator.audioSession.type` to `playback`.
enum AudioSession {
    static func configure() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        } catch {
            MIDIEngine.log.error("audio session: \(error.localizedDescription)")
        }
    }
}
#endif

#if os(macOS)
/// Tells the host when the window stops or starts being visible: minimised, fully covered, on
/// another Space, or the app hidden. That is when WebKit reports the page hidden.
@MainActor
final class WindowVisibility {
    private weak var host: WebHost?
    private var observers: [any NSObjectProtocol] = []
    private var lastVisible = true

    init(host: WebHost) {
        self.host = host
        let center = NotificationCenter.default
        for name in [NSWindow.didChangeOcclusionStateNotification, NSApplication.didHideNotification,
                     NSApplication.didUnhideNotification]
        {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.update() }
            })
        }
    }

    private func update() {
        guard let host else { return }
        let visible = !NSApp.isHidden && (host.webView.window?.occlusionState.contains(.visible) ?? false)
        guard visible != lastVisible else { return }
        lastVisible = visible
        host.setVisible(visible)
    }
}
#endif

extension Color {
    /// The page's paper colour (`--bg`), light and dark: the launch screen and the web view's
    /// background before the page draws.
    static let paper = Color("Paper")
}

#if os(macOS)
extension NSColor {
    static var paper: NSColor { NSColor(named: "Paper") ?? .windowBackgroundColor }
}
#else
extension UIColor {
    static var paper: UIColor { UIColor(named: "Paper") ?? .systemBackground }
}
#endif
