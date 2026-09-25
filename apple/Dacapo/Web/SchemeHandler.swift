import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled web build at `dacapo://app/`. One fixed origin, so IndexedDB and
/// localStorage persist across launches; explicit MIME types, so ES modules (`.js`, `.mjs`),
/// WebAssembly and fonts load as they do from a web server. No network.
@MainActor
final class SchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "dacapo"
    static let origin = URL(string: "dacapo://app/")!

    private let root: URL
    private var stopped = Set<ObjectIdentifier>()

    #if DEBUG
    /// Extra files for the debug probe, served under `/__probe/` from the app bundle.
    private let probeFiles: Set<String> = ["probe.wasm"]
    /// Every request served, for the probe: path → (status, MIME type, bytes).
    private(set) var served: [(path: String, status: Int, type: String, bytes: Int)] = []
    #endif

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    /// Whether `url` is a page of the app itself.
    static func isAppURL(_ url: URL?) -> Bool {
        url?.scheme == scheme && url?.host == origin.host
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        stopped.remove(ObjectIdentifier(task))
        guard let url = task.request.url, Self.isAppURL(url) else {
            return task.didFailWithError(URLError(.badURL))
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }

        guard let file = file(for: path), let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            respond(task, url: url, status: 404, type: "text/plain", data: Data("Not found".utf8), path: path)
            return
        }
        respond(task, url: url, status: 200, type: Self.mimeType(file.pathExtension), data: data, path: path)
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }

    /// The file for a request path, never outside the web root whatever the path says.
    func file(for path: String) -> URL? {
        #if DEBUG
        if path.hasPrefix("/__probe/"), probeFiles.contains(String(path.dropFirst(9))) {
            return Bundle.main.url(forResource: String(path.dropFirst(9)), withExtension: nil)
        }
        #endif
        let candidate = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        return candidate.path.hasPrefix(root.path + "/") ? candidate : nil
    }

    private func respond(_ task: any WKURLSchemeTask, url: URL, status: Int, type: String, data: Data, path: String) {
        #if DEBUG
        served.append((path, status, type, data.count))
        #endif
        guard !stopped.contains(ObjectIdentifier(task)) else { return }
        let headers = [
            "Content-Type": type,
            "Content-Length": String(data.count),
            // Hashed assets never change within a build; index.html is re-read on every launch.
            "Cache-Control": path.hasPrefix("/assets/") ? "max-age=31536000, immutable" : "no-cache",
        ]
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "json": "application/json"
        case "wasm": "application/wasm"
        case "svg": "image/svg+xml"
        case "woff2": "font/woff2"
        case "woff": "font/woff"
        case "txt", "": "text/plain; charset=utf-8"
        case "md": "text/markdown; charset=utf-8"
        case "musicxml", "xml": "application/xml"
        default: UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
