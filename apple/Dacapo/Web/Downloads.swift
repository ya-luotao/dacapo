import Foundation
import WebKit
#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// Files the page saves through a `download` link (the backup export, lib/download.ts). Each one
/// is written to its own temporary folder first, then handed to the user: a save panel on the
/// Mac, the share sheet on iPhone and iPad (Save to Files, AirDrop, Mail, …). The temporary copy
/// is removed afterwards.
@MainActor
final class Downloads: NSObject, WKDownloadDelegate {
    weak var webView: WKWebView?
    private var files: [ObjectIdentifier: URL] = [:]

    #if DEBUG
    /// Harness: called with each finished file instead of showing the panel or the share sheet.
    var onFinished: ((URL) -> Void)?
    /// Harness: what happened.
    private(set) var log: [String] = []
    #endif

    func start(_ download: WKDownload) {
        download.delegate = self
    }

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String
    ) async -> URL? {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("downloads", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        } catch {
            return nil
        }
        // WKDownload refuses a destination that exists; the folder is new.
        let name = Self.safeFileName(suggestedFilename)
        let url = folder.appendingPathComponent(name)
        files[ObjectIdentifier(download)] = url
        record("destination \(name) (\(response.mimeType ?? "?"))")
        return url
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = files.removeValue(forKey: ObjectIdentifier(download)) else { return }
        record("finished \(url.lastPathComponent)")
        #if DEBUG
        if let onFinished {
            onFinished(url)
            return
        }
        #endif
        present(url)
    }

    func download(_ download: WKDownload, didFailWithError error: any Error, resumeData: Data?) {
        record("failed: \(error.localizedDescription)")
        if let url = files.removeValue(forKey: ObjectIdentifier(download)) { Self.discard(url) }
    }

    private func record(_ line: String) {
        #if DEBUG
        log.append(line)
        print("[dacapo] download \(line)")
        #endif
    }

    /// A file name without path separators; the page names its exports itself.
    nonisolated static func safeFileName(_ name: String) -> String {
        let cleaned = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: ".")))
        return trimmed.isEmpty ? "dacapo-export" : trimmed
    }

    /// Removes a temporary download and its folder.
    nonisolated static func discard(_ url: URL) {
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    #if os(macOS)
    private func present(_ file: URL) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = file.lastPathComponent
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        let finish = { (response: NSApplication.ModalResponse) in
            defer { Self.discard(file) }
            guard response == .OK, let target = panel.url else { return }
            do {
                // The panel already asked whether to replace an existing file.
                _ = try? FileManager.default.removeItem(at: target)
                try FileManager.default.copyItem(at: file, to: target)
            } catch {
                NSAlert(error: error).runModal()
            }
        }
        if let window = webView?.window {
            panel.beginSheetModal(for: window, completionHandler: finish)
        } else {
            finish(panel.runModal())
        }
    }
    #else
    private func present(_ file: URL) {
        guard let webView, let presenter = Self.topViewController(from: webView.window?.rootViewController) else {
            Self.discard(file)
            return
        }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.completionWithItemsHandler = { _, _, _, _ in Self.discard(file) }
        // On iPad the sheet is a popover and needs an anchor: the middle of the page, no arrow.
        if let popover = sheet.popoverPresentationController {
            popover.sourceView = webView
            popover.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        presenter.present(sheet, animated: true)
    }

    private static func topViewController(from root: UIViewController?) -> UIViewController? {
        var top = root
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
    #endif
}
