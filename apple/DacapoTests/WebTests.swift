import Foundation
import Testing
@testable import Dacapo

@MainActor
struct SchemeHandlerTests {
    let root = URL(fileURLWithPath: "/tmp/dacapo-web-root", isDirectory: true)

    @Test func servesOnlyInsideTheWebRoot() {
        let handler = SchemeHandler(root: root)
        #expect(handler.file(for: "/index.html")?.path == "/tmp/dacapo-web-root/index.html")
        #expect(handler.file(for: "/assets/a.js")?.path == "/tmp/dacapo-web-root/assets/a.js")
        #expect(handler.file(for: "/../../etc/hosts") == nil)
        #expect(handler.file(for: "/assets/../../secret") == nil)
        #expect(handler.file(for: "/") == nil)
    }

    @Test func recognisesTheAppOrigin() {
        #expect(SchemeHandler.isAppURL(URL(string: "dacapo://app/#/settings")))
        #expect(!SchemeHandler.isAppURL(URL(string: "dacapo://other/")))
        #expect(!SchemeHandler.isAppURL(URL(string: "https://app/")))
        #expect(!SchemeHandler.isAppURL(nil))
    }

    @Test(arguments: [
        ("js", "text/javascript; charset=utf-8"), ("mjs", "text/javascript; charset=utf-8"),
        ("wasm", "application/wasm"), ("woff2", "font/woff2"), ("css", "text/css; charset=utf-8"),
        ("html", "text/html; charset=utf-8"), ("svg", "image/svg+xml"), ("json", "application/json"),
        ("", "text/plain; charset=utf-8"),
    ])
    func mimeTypes(ext: String, type: String) {
        #expect(SchemeHandler.mimeType(ext) == type)
    }
}

struct DownloadsTests {
    @Test func fileNamesStayInTheirFolder() {
        #expect(Downloads.safeFileName("dacapo-2026-09-26.json") == "dacapo-2026-09-26.json")
        #expect(Downloads.safeFileName("../../evil.json") == "-..-evil.json")
        #expect(Downloads.safeFileName("a/b:c.json") == "a-b-c.json")
        #expect(Downloads.safeFileName(" .. ") == "dacapo-export")
        #expect(Downloads.safeFileName("") == "dacapo-export")
    }
}
