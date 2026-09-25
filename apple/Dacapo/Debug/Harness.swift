import CoreMIDI
import Foundation
import UniformTypeIdentifiers
import WebKit
#if os(iOS)
import AVFoundation
#endif
#if os(macOS)
import AppKit
#else
import UIKit
#endif

#if DEBUG
/// Debug harness (never in Release: compiled out here and excluded by Dacapo-Release.xcconfig).
/// A web probe (hosting checks), MIDI timing with a virtual source and destination, hot-plugging,
/// a wait-mode demo, the export and import paths, lifecycle checks and snapshots. Driven from the
/// Debug menu on the Mac, or by launch arguments on every platform:
///
///     -dacapoAuto probe,hotplug,timing   what to run, in order (see runLaunchArguments)
///     -dacapoFileInput YES               the probe clicks the Pieces import (Mac: answered with
///                                        a bundled file; iOS: the picker stays open)
///     -dacapoQuit YES                    exit when done
///     -dacapoOut <dir>                   where results go (default Documents/harness)
///
/// Results go to Documents/harness/*.json and are printed as "[dacapo] …" lines. CI runs
/// `probe,hotplug,timing` on the simulator and checks the JSON (apple/scripts/check-harness.py).
@MainActor
final class Harness {
    let host: WebHost
    private var ports: TestPorts?
    private let outDir: URL

    init(host: WebHost) {
        self.host = host
        setvbuf(stdout, nil, _IOLBF, 0)
        outDir = UserDefaults.standard.string(forKey: "dacapoOut").map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("harness", isDirectory: true)
        try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
    }

    func runLaunchArguments() async {
        let defaults = UserDefaults.standard
        guard let modes = defaults.string(forKey: "dacapoAuto") else { return }
        await host.waitUntilLoaded()
        host.log("results in \(outDir.path)")
        for mode in modes.split(separator: ",") {
            switch mode {
            case "probe": await probe()
            case "timing": await timing()
            case "wait": await waitDemo()
            case "verovio": await verovio()
            case "ports": await listPorts()
            case "file": await fileInput()
            case "download": await exportData()
            case "timers": await timers()
            case "hotplug": await hotplug()
            case "export": await exportData()
            case "lifecycle": await lifecycle()
            case "audio": await audio()
            case "seed": seedDocuments()
            case "shell": await shell()
            case "rhythm": await rhythmDemo()
            case "frame":
                // The piece page's score frame and the staff size drawn in it.
                var report = environment()
                report["frame"] = await js("""
                    const f = document.querySelector('.score-frame');
                    return JSON.stringify({ viewport: [innerWidth, innerHeight], frame: [f?.clientWidth, f?.clientHeight],
                      scale: Number(document.querySelector('.score-svg')?.dataset.scale),
                      oneScreen: matchMedia('(min-width: 48rem) and (min-height: 36rem)').matches });
                    """) ?? NSNull()
                write("frame", report)
            case "licences":
                // Every licence text the About page offers, fetched through the scheme handler.
                var report = environment()
                report["licences"] = await js("""
                    location.hash = '#/about';
                    await new Promise((r) => setTimeout(r, 800));
                    const out = {};
                    for (const s of document.querySelectorAll('.licence-text summary')) {
                      s.click();
                      await new Promise((r) => setTimeout(r, 300));
                      const pre = s.parentElement.querySelector('pre');
                      out[s.textContent] = pre ? pre.textContent.length : s.parentElement.textContent;
                    }
                    return JSON.stringify(out);
                    """) ?? NSNull()
                write("licences", report)
            case "bgprep":
                // For a background test by hand: a held note and one scheduled 8 s ahead.
                if await ensurePorts() {
                    _ = ports!.takeSinkLog()
                    _ = await js("""
                        const a = await navigator.requestMIDIAccess();
                        const out = [...a.outputs.values()].find(p => p.name === name);
                        out.send([0x90, 72, 60]);
                        out.send([0x90, 74, 60], performance.now() + 8000);
                        """, ["name": TestPorts.name])
                    host.log("bgprep: sent")
                }
            case "bgcheck":
                let sink = ports?.takeSinkLog().map(\.bytes) ?? []
                var report = environment()
                report["received"] = sink.map { $0.map(String.init).joined(separator: " ") }
                report["resetMessages"] = sink.filter { $0.count == 3 && $0[0] & 0xF0 == 0xB0 }.count
                report["scheduledNoteReleased"] = sink.contains([0x80, 74, 64])
                report["systemReset"] = sink.contains([0xFF])
                report["events"] = host.events
                report["visibility"] = await js("return document.visibilityState") ?? NSNull()
                write("background", report)
            case "url":
                var report = environment()
                report["url"] = host.webView.url?.absoluteString ?? NSNull()
                report["events"] = host.events
                report["shown"] = await js("return document.querySelector('main h1')?.textContent ?? ''") ?? NSNull()
                write("url", report)
            case "utypes": uniformTypes()
            case let mode where mode.hasPrefix("route:"):
                location(String(mode.dropFirst(6)))
                try? await Task.sleep(for: .seconds(2))
            case let mode where mode.hasPrefix("sleep:"):
                try? await Task.sleep(for: .seconds(Double(mode.dropFirst(6)) ?? 1))
            case let mode where mode.hasPrefix("shot:"):
                await snapshot(String(mode.dropFirst(5)))
            case let mode where mode.hasPrefix("window:"):
                resizeWindow(String(mode.dropFirst(7)))
                try? await Task.sleep(for: .seconds(1))
            case let mode where mode.hasPrefix("orient:"):
                await orient(String(mode.dropFirst(7)))
            case "idle": try? await Task.sleep(for: .seconds(3600))
            default: host.log("unknown mode \(mode)")
            }
        }
        write("done", ["modes": modes])
        host.log("auto run done")
        if defaults.bool(forKey: "dacapoQuit") { exit(0) }
    }

    // MARK: Output

    private func write(_ name: String, _ object: Any) {
        let url = outDir.appendingPathComponent("\(name).json")
        if let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: url)
            host.log("wrote \(url.path)")
        }
    }

    func snapshot(_ name: String) async {
        do {
            let image = try await host.webView.takeSnapshot(configuration: nil)
            #if os(macOS)
            guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                  let png = rep.representation(using: .png, properties: [:]) else { return }
            #else
            guard let png = image.pngData() else { return }
            #endif
            let url = outDir.appendingPathComponent("\(name).png")
            try png.write(to: url)
            host.log("snapshot \(url.path)")
        } catch {
            host.log("snapshot failed: \(error)")
        }
    }

    private func js(_ script: String, _ arguments: [String: Any] = [:]) async -> Any? {
        do {
            return try await host.run(script, arguments: arguments)
        } catch {
            host.log("script failed: \(error)")
            return nil
        }
    }

    private func waitFor(_ condition: String, seconds: Double = 20) async -> Bool {
        let end = Date().addingTimeInterval(seconds)
        while Date() < end {
            if await js("return Boolean(\(condition))") as? Bool == true { return true }
            try? await Task.sleep(for: .milliseconds(50))
        }
        return false
    }

    private func environment() -> [String: Any] {
        var info: [String: Any] = [:]
        #if os(macOS)
        info["platform"] = "macOS \(ProcessInfo.processInfo.operatingSystemVersionString)"
        info["sandboxed"] = ProcessInfo.processInfo.environment["APP_SANDBOX_CONTAINER_ID"] != nil
        #else
        info["platform"] = "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion) \(UIDevice.current.model)"
        #if targetEnvironment(simulator)
        info["simulator"] = ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] ?? "yes"
        #endif
        #endif
        info["webProcess"] = host.webProcessIdentifier ?? -1
        return info
    }

    // MARK: Probe

    func probe() async {
        let url = Bundle.main.url(forResource: "probe", withExtension: "js")!
        // One function expression (Prettier ends it with a semicolon).
        var body = try! String(contentsOf: url, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
        if body.hasSuffix(";") { body.removeLast() }
        let assetsDir = Bundle.main.resourceURL!.appendingPathComponent("web/assets")
        let files = (try? FileManager.default.contentsOfDirectory(atPath: assetsDir.path)) ?? []
        let assets = files.filter { $0.hasSuffix(".mjs") || $0.hasSuffix(".woff2") || $0.hasPrefix("index-") }
            .sorted().map { "/assets/\($0)" }
        let defaults = UserDefaults.standard
        let fileInput = defaults.bool(forKey: "dacapoFileInput")
        #if os(macOS)
        if fileInput {
            host.automaticOpenPanelFiles = [Bundle.main.url(forResource: "a0-probe-tune", withExtension: "musicxml")!]
        }
        #endif
        let eventsBefore = host.events.count
        let result = await js("return await (\(body)\n)({ assets, fileInput, download });", [
            "assets": assets, "fileInput": fileInput, "download": defaults.bool(forKey: "dacapoDownload"),
        ])
        var report: [String: Any] = environment()
        if let text = result as? String, let data = text.data(using: .utf8),
           let object = try? JSONSerialization.jsonObject(with: data) {
            report["page"] = object
        } else {
            report["page"] = "probe failed: \(String(describing: result))"
        }
        report["nativeEvents"] = Array(host.events[eventsBefore...])
        report["served"] = host.schemeHandler.served.map { "\($0.status) \($0.type) \($0.bytes) \($0.path)" }
        write("probe", report)
    }

    /// The Pieces import through `<input type=file>`, clicked from native code:
    /// `evaluateJavaScript` counts as a user gesture, `callAsyncJavaScript` does not.
    func fileInput() async {
        // -dacapoImportMXL YES imports the compressed test score (probe-tune.mxl) instead.
        let compressed = UserDefaults.standard.bool(forKey: "dacapoImportMXL")
        let (name, ext, title) = compressed
            ? ("probe-tune", "mxl", "A1 Compressed Tune") : ("a0-probe-tune", "musicxml", "A0 Probe Tune")
        #if os(macOS)
        host.automaticOpenPanelFiles = [Bundle.main.url(forResource: name, withExtension: ext)!]
        #endif
        let eventsBefore = host.events.count
        location("#/pieces")
        _ = await waitFor("document.querySelector('input[type=file]')")
        try? await Task.sleep(for: .milliseconds(500))
        let present = "document.body.textContent.includes('\(title)')"
        let before = await js("return \(present)")
        do {
            _ = try await host.webView.evaluateJavaScript("document.querySelector('input[type=file]').click(); true")
        } catch {
            host.log("file click failed: \(error)")
        }
        let imported = await waitFor(present, seconds: 8)
        await snapshot("file-input-\(ext)")
        write("file-input-\(ext)", [
            "file": "\(name).\(ext)", "presentBefore": before ?? NSNull(), "importedAfterClick": imported,
            "nativeEvents": Array(host.events[eventsBefore...]),
        ])
    }

    /// The backup export from Settings, through the app's download handling: the page must stay
    /// where it is, and the file must be the export. `-dacapoPresent YES` shows the real share
    /// sheet or save panel instead of capturing the file.
    func exportData() async {
        location("#/settings")
        _ = await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent === 'Export data' || b.textContent === '导出数据')")
        try? await Task.sleep(for: .milliseconds(500))
        let before = host.webView.url?.absoluteString ?? ""
        var captured: URL?
        let present = UserDefaults.standard.bool(forKey: "dacapoPresent")
        if !present { host.downloads.onFinished = { captured = $0 } }
        defer { host.downloads.onFinished = nil }
        // evaluateJavaScript counts as a user gesture; the button is the first of the data section.
        _ = try? await host.webView.evaluateJavaScript(
            "document.querySelector('.data-actions button').click(); true")
        let end = Date().addingTimeInterval(8)
        while captured == nil && !present && Date() < end { try? await Task.sleep(for: .milliseconds(100)) }
        if present { try? await Task.sleep(for: .seconds(2)) }
        let after = host.webView.url?.absoluteString ?? ""
        var report: [String: Any] = environment()
        report["urlBefore"] = before
        report["urlAfter"] = after
        report["stayedOnPage"] = before == after
        report["downloadLog"] = host.downloads.log
        if let captured, let data = try? Data(contentsOf: captured),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        {
            report["fileName"] = captured.lastPathComponent
            report["bytes"] = data.count
            report["format"] = json["format"] ?? NSNull()
            report["keys"] = json.keys.sorted()
            Downloads.discard(captured)
        }
        if present {
            #if os(macOS)
            let sheet = host.webView.window?.attachedSheet
            report["savePanelShown"] = sheet is NSSavePanel
            report["savePanelName"] = (sheet as? NSSavePanel)?.nameFieldStringValue ?? NSNull()
            sheet.map { host.webView.window?.endSheet($0) }
            #endif
            await snapshot("export-presented")
        }
        write("export", report)
    }

    /// Keep-awake around a Read session, and the native panic when the app leaves the screen.
    func lifecycle() async {
        var report = environment()
        location("#/read")
        _ = await waitFor("document.querySelector('.read-setup button[type=submit], .read-setup .button-primary, main form button')")
        try? await Task.sleep(for: .milliseconds(500))
        report["beforeSession"] = host.keepAwake.isOn
        _ = try? await host.webView.evaluateJavaScript("""
            [...document.querySelectorAll('main button')].find(b => /^(Start|开始)$/.test(b.textContent.trim()))?.click(); true
            """)
        try? await Task.sleep(for: .seconds(1))
        report["duringSession"] = host.keepAwake.isOn
        host.setVisible(false)
        report["duringSessionHidden"] = host.keepAwake.isOn
        host.setVisible(true)
        report["duringSessionVisibleAgain"] = host.keepAwake.isOn
        _ = try? await host.webView.evaluateJavaScript("""
            [...document.querySelectorAll('main button')].find(b => /^(Stop|停止)$/.test(b.textContent.trim()))?.click(); true
            """)
        try? await Task.sleep(for: .seconds(1))
        report["afterStop"] = host.keepAwake.isOn

        // Panic: the page plays a note to the test port's output, then the app is hidden.
        if await ensurePorts() {
            _ = ports!.takeSinkLog()
            _ = await js("""
                const a = await navigator.requestMIDIAccess();
                const out = [...a.outputs.values()].find(p => p.name === name);
                out.send([0x90, 72, 60]);
                out.send([0x90, 74, 60], performance.now() + 500);
                """, ["name": TestPorts.name])
            try? await Task.sleep(for: .milliseconds(200))
            let silenced = host.midi.panic()
            try? await Task.sleep(for: .milliseconds(800))
            let sink = ports!.takeSinkLog().map(\.bytes)
            report["silenced"] = silenced
            report["panicMessages"] = sink.filter { $0.count == 3 && $0[0] & 0xF0 == 0xB0 }.count
            report["scheduledNoteReleased"] = sink.contains([0x80, 74, 64])
            report["systemReset"] = sink.contains([0xFF])
            report["firstNote"] = sink.first ?? []
        } else {
            report["panic"] = "test port unavailable"
        }
        write("lifecycle", report)
    }

    /// The audio session before and after the page plays a click (Settings → Play a click).
    func audio() async {
        var report = environment()
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        report["categoryAtLaunch"] = session.category.rawValue
        report["mixWithOthersAtLaunch"] = session.categoryOptions.contains(.mixWithOthers)
        #endif
        location("#/settings")
        try? await Task.sleep(for: .seconds(1))
        report["pageAudioSession"] = await js("return navigator.audioSession?.type ?? null") ?? NSNull()
        _ = try? await host.webView.evaluateJavaScript("""
            [...document.querySelectorAll('button')].find(b => /^(Play a click|播放一下节拍声)$/.test(b.textContent.trim()))?.click(); true
            """)
        try? await Task.sleep(for: .seconds(1))
        #if os(iOS)
        report["categoryAfterClick"] = session.category.rawValue
        report["mixWithOthersAfterClick"] = session.categoryOptions.contains(.mixWithOthers)
        report["outputRoute"] = session.currentRoute.outputs.map { "\($0.portType.rawValue) \($0.portName)" }
        #endif
        write("audio", report)
    }

    /// Copies test scores into Documents, which the Debug build shares with the Files app (On My
    /// iPhone / iPad → Dacapo), to try the document picker by hand.
    func seedDocuments() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        for (name, ext) in [("a0-probe-tune", "musicxml"), ("probe-tune", "mxl")] {
            guard let source = Bundle.main.url(forResource: name, withExtension: ext) else { continue }
            let target = documents.appendingPathComponent("\(name).\(ext)")
            try? FileManager.default.removeItem(at: target)
            try? FileManager.default.copyItem(at: source, to: target)
        }
        // A plain .xml copy as well: the third extension the import accepts.
        if let source = Bundle.main.url(forResource: "a0-probe-tune", withExtension: "musicxml") {
            let target = documents.appendingPathComponent("probe-tune-plain.xml")
            try? FileManager.default.removeItem(at: target)
            try? FileManager.default.copyItem(at: source, to: target)
        }
        host.log("seeded \(documents.path)")
    }

    /// The app-shell marker, and every page's visible text checked for browser-only wording.
    func shell() async {
        var report = environment()
        report["marker"] = await js("return document.documentElement.dataset.shell ?? null") ?? NSNull()
        report["languages"] = await js("return [...navigator.languages].join(',') + ' / html lang ' + document.documentElement.lang") ?? NSNull()
        report["preferredLocalizations"] = Bundle.main.preferredLocalizations
        var pages: [String: Any] = [:]
        for hash in ["#/", "#/read", "#/pieces", "#/pieces/beethoven-ode-to-joy", "#/progress", "#/settings", "#/about"] {
            location(hash)
            try? await Task.sleep(for: .seconds(hash.contains("ode") ? 3 : 1.2))
            let hits = await js("""
                const text = document.querySelector('main')?.innerText ?? '';
                const words = /\\b(browser|Chrome|Edge|Safari|Firefox|tab|tabs|download|downloads|site data|site settings|reload the page)\\b|浏览器|标签页|网站数据/gi;
                return JSON.stringify({ chars: text.length, hits: [...new Set(text.match(words) ?? [])] });
                """)
            pages[hash] = hits ?? NSNull()
        }
        report["pages"] = pages
        write("shell", report)
    }

    // MARK: MIDI

    private func ensurePorts() async -> Bool {
        if ports == nil {
            let created = TestPorts(client: host.midi.clientRef)
            host.log("virtual source: \(created.sourceStatus), destination: \(created.destinationStatus)")
            ports = created
        }
        guard ports?.sourceStatus == noErr else { return false }
        // The page must list the port before anything is played.
        return await waitFor("""
            await navigator.requestMIDIAccess().then(a => [...a.inputs.values()].some(p => \
            p.name === '\(TestPorts.name)' && p.state === 'connected'))
            """, seconds: 10)
    }

    func listPorts() async {
        let ok = await ensurePorts()
        let list = await js("""
            const a = await navigator.requestMIDIAccess();
            return JSON.stringify({
              inputs: [...a.inputs.values()].map(p => [p.id, p.name, p.manufacturer, p.state, p.connection]),
              outputs: [...a.outputs.values()].map(p => [p.id, p.name, p.manufacturer, p.state, p.connection]),
            });
            """)
        var report = environment()
        report["testPortsVisibleToPage"] = ok
        report["sourceStatus"] = Int(ports?.sourceStatus ?? 0)
        report["destinationStatus"] = Int(ports?.destinationStatus ?? 0)
        report["native"] = host.midi.endpoints.map { "\($0.kind.rawValue) \($0.id) \($0.name) online=\($0.online)" }
        report["page"] = list ?? NSNull()
        write("ports", report)
    }

    /// Input: a scripted sequence from the virtual source, measured at every stage. Output: the
    /// page schedules notes to the virtual destination with send(data, timestamp).
    func timing() async {
        guard await ensurePorts() else {
            host.log("timing: test port not visible to the page")
            return write("timing", ["error": "test port unavailable", "status": Int(ports?.sourceStatus ?? 0)])
        }
        location("#/settings")
        try? await Task.sleep(for: .milliseconds(800))
        var report = environment()
        report["idle"] = await inputRun(busy: false)
        report["busy"] = await inputRun(busy: true)
        report["output"] = await outputRun()
        report["clock"] = await clockReport()
        write("timing", report)
    }

    private func location(_ hash: String) {
        host.webView.evaluateJavaScript("location.hash = '\(hash)'")
    }

    /// 192 messages: note on/off pairs 20 ms apart (C8 and B7, out of the way of any piece), with
    /// a three-note chord every tenth step.
    private func inputRun(busy: Bool) async -> [String: Any] {
        var messages: [(offsetMs: Double, bytes: [UInt8])] = []
        for i in 0..<80 {
            let t = Double(i) * 20
            if i % 10 == 9 {
                for key: UInt8 in [104, 105, 106] { messages.append((t, [0x90, key, 90])) }
                for key: UInt8 in [104, 105, 106] { messages.append((t + 10, [0x80, key, 0])) }
            } else {
                let key: UInt8 = i % 2 == 0 ? 108 : 107
                messages.append((t, [0x90, key, 80]))
                messages.append((t + 10, [0x90, key, 0]))
            }
        }
        _ = await js("""
            const a = await navigator.requestMIDIAccess();
            const input = [...a.inputs.values()].find(p => p.name === name);
            globalThis.__a0 = { got: [], busy: 0 };
            globalThis.__a0.listener = (e) => __a0.got.push([e.timeStamp, performance.now(), ...e.data]);
            input.addEventListener('midimessage', __a0.listener);
            __dacapoMidi.trace.events.length = 0;
            __dacapoMidi.trace.on = true;
            if (busy) __a0.busy = setInterval(() => { const end = performance.now() + 40; while (performance.now() < end); }, 50);
            """, ["name": TestPorts.name, "busy": busy])
        let stamps = await ports!.play(messages)
        try? await Task.sleep(for: .milliseconds(600))
        let raw = await js("""
            clearInterval(__a0.busy);
            __dacapoMidi.trace.on = false;
            const a = await navigator.requestMIDIAccess();
            [...a.inputs.values()].find(p => p.name === name).removeEventListener('midimessage', __a0.listener);
            const c = __dacapoMidi.clock;
            return JSON.stringify({ got: __a0.got, trace: __dacapoMidi.trace.events.filter(e => e.id === id),
              offset: c.offset, width: c.hi - c.lo, tick: c.tick });
            """, ["name": TestPorts.name, "id": host.midi.endpoints.first { $0.name == TestPorts.name && $0.kind == .input }?.id ?? ""])
        guard let text = raw as? String, let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let got = object["got"] as? [[Double]], let trace = object["trace"] as? [[String: Any]],
              let offset = object["offset"] as? Double
        else { return ["error": "no data"] }

        let sent = stamps.map { HostClock.milliseconds($0) - offset } // page ms
        var result: [String: Any] = ["sent": sent.count, "receivedByListener": got.count, "traced": trace.count]
        guard got.count == sent.count, trace.count == sent.count else { return result }
        let stampError = zip(got, sent).map { $0[0] - $1 }
        let received = trace.map { $0["received"] as! Double }
        let flushed = trace.map { $0["flushed"] as! Double }
        let arrived = trace.map { $0["arrived"] as! Double }
        let dispatched = got.map { $0[1] }
        result["timeStampMinusSent"] = Stats(stampError).json
        result["coreMidiRouting"] = Stats(zip(received, sent).map { $0 - $1 }).json
        result["mainThreadHop"] = Stats(zip(flushed, received).map { $0 - $1 }).json
        result["evaluateJavaScript"] = Stats(zip(arrived, flushed).map { $0 - $1 }).json
        result["nativeReceiptToListener"] = Stats(zip(dispatched, received).map { $0 - $1 }).json
        result["sentToListener"] = Stats(zip(dispatched, sent).map { $0 - $1 }).json
        // Intervals between messages as the page sees them, against the intervals at which the
        // source really sent them: with the bridge's timeStamp, and if the page stamped messages
        // on arrival instead (what a bridge without native timestamps would give).
        func intervalError(_ times: [Double]) -> [Double] {
            (1..<times.count).map { (times[$0] - times[$0 - 1]) - (sent[$0] - sent[$0 - 1]) }
        }
        result["intervalErrorWithTimeStamp"] = Stats(intervalError(got.map { $0[0] })).json
        result["intervalErrorIfStampedOnArrival"] = Stats(intervalError(dispatched)).json
        // How precisely the test source itself kept to its script (mach_wait_until on a thread).
        let intended = messages.map(\.offsetMs)
        result["senderJitter"] = Stats((1..<sent.count).map {
            (sent[$0] - sent[$0 - 1]) - (intended[$0] - intended[$0 - 1])
        }).json
        let bytesOK = zip(got, messages).allSatisfy { g, m in g.dropFirst(2).map { UInt8($0) } == m.bytes }
        result["bytesIdentical"] = bytesOK
        return result
    }

    /// 100 notes scheduled by the page 20 ms apart, sent 80 ms ahead as the scheduler does.
    private func outputRun() async -> [String: Any] {
        _ = ports!.takeSinkLog()
        let raw = await js("""
            const a = await navigator.requestMIDIAccess();
            const out = [...a.outputs.values()].find(p => p.name === name);
            const start = performance.now() + 200;
            const plan = [];
            for (let i = 0; i < 100; i++) plan.push([start + i * 20, i % 2 ? 0x80 : 0x90, 100, i % 2 ? 0 : 70]);
            let next = 0;
            await new Promise((resolve) => {
              const timer = setInterval(() => {
                while (next < plan.length && plan[next][0] - performance.now() < 80) {
                  const [at, status, key, velocity] = plan[next++];
                  out.send([status, key, velocity], at);
                }
                if (next >= plan.length) { clearInterval(timer); resolve(); }
              }, 25);
            });
            await new Promise((r) => setTimeout(r, 400));
            return JSON.stringify({ plan: plan.map(p => p[0]), offset: __dacapoMidi.clock.offset });
            """, ["name": TestPorts.name])
        guard let text = raw as? String, let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let plan = object["plan"] as? [Double], let offset = object["offset"] as? Double
        else { return ["error": "no data"] }
        // Only the test's notes: the app itself also sends to this output (it is named like the
        // input, so "auto" picks it) and silences it when a piece page closes.
        let sink = ports!.takeSinkLog().filter { $0.bytes.count == 3 && $0.bytes[1] == 100 && $0.bytes[0] & 0xe0 == 0x80 }
        var result: [String: Any] = ["planned": plan.count, "arrived": sink.count]
        guard sink.count == plan.count else { return result }
        let stamps = sink.map { HostClock.milliseconds($0.stamp) - offset }
        let arrivals = sink.map { HostClock.milliseconds($0.received) - offset }
        result["stampMinusPlanned"] = Stats(zip(stamps, plan).map { $0 - $1 }).json
        result["raw"] = (0..<min(12, plan.count)).map { [plan[$0], stamps[$0], arrivals[$0]] }
        result["arrivalMinusPlanned"] = Stats(zip(arrivals, plan).map { $0 - $1 }).json
        return result
    }

    private func clockReport() async -> [String: Any] {
        // Independent check of the round-trip offset: performance.timeOrigin (wall clock) against
        // the native wall clock ↔ host time relation.
        let raw = await js("""
            await __dacapoMidi.sync(50);
            const c = __dacapoMidi.clock;
            return JSON.stringify({ offset: c.offset, lo: c.lo, hi: c.hi, tick: c.tick, samples: c.samples,
              resets: c.resets, minRtt: c.minRtt, timeOrigin: performance.timeOrigin });
            """)
        let epochMinusHost = Date().timeIntervalSince1970 * 1000 - HostClock.nowMilliseconds()
        guard let text = raw as? String, let data = text.data(using: .utf8),
              var object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let offset = object["offset"] as? Double, let origin = object["timeOrigin"] as? Double
        else { return ["error": "no data"] }
        object["width"] = (object["hi"] as! Double) - (object["lo"] as! Double)
        object["timeOriginOffsetMinusRoundTripOffset"] = (origin - epochMinusHost) - offset
        return object
    }

    /// How regularly a 25 ms setInterval fires in this page, for 3 s.
    func timers() async {
        let raw = await js("""
            const gaps = [];
            let last = performance.now();
            await new Promise((resolve) => {
              const id = setInterval(() => {
                const now = performance.now();
                gaps.push(now - last);
                last = now;
                if (gaps.length >= 120) { clearInterval(id); resolve(); }
              }, 25);
              setTimeout(() => { clearInterval(id); resolve(); }, 3000);
            });
            return JSON.stringify({ ticks: gaps.length, visibility: document.visibilityState, focus: document.hasFocus(),
              max: Math.max(...gaps), over40: gaps.filter((g) => g > 40).length, gaps: gaps.map(Math.round) });
            """)
        host.log("timers: \(raw ?? "nil")")
    }

    /// A second virtual source appears and goes away while the page listens: the statechange
    /// events, the port's state, and the app's own device status line.
    func hotplug() async {
        location("#/")
        _ = await js("""
            const a = await navigator.requestMIDIAccess();
            globalThis.__hot = [];
            a.addEventListener('statechange', (e) => __hot.push(
              [Math.round(performance.now()), e.port.name, e.port.type, e.port.state, e.port.connection]));
            """)
        try? await Task.sleep(for: .seconds(1))
        let status = "return document.querySelector('main')?.textContent?.slice(0, 60) ?? ''"
        let before = await js(status)
        var source = MIDIEndpointRef()
        let created = MIDISourceCreateWithProtocol(host.midi.clientRef, "dacapo Hotplug" as CFString, ._1_0, &source)
        let addedAt = Date()
        let seen = await waitFor("__hot.some((e) => e[1] === 'dacapo Hotplug' && e[3] === 'connected')", seconds: 5)
        let addMs = Date().timeIntervalSince(addedAt) * 1000
        try? await Task.sleep(for: .seconds(1))
        let during = await js(status)
        MIDIEndpointDispose(source)
        let removedAt = Date()
        let gone = await waitFor("__hot.some((e) => e[1] === 'dacapo Hotplug' && e[3] === 'disconnected')", seconds: 5)
        let removeMs = Date().timeIntervalSince(removedAt) * 1000
        try? await Task.sleep(for: .seconds(1))
        let after = await js(status)
        let events = await js("return JSON.stringify(__hot)")
        let ports = await js("""
            const a = await navigator.requestMIDIAccess();
            return JSON.stringify([...a.inputs.values()].map((p) => [p.name, p.state, p.connection]));
            """)
        var report = environment()
        report["createStatus"] = Int(created)
        report["connectedEventMs"] = seen ? addMs : -1
        report["disconnectedEventMs"] = gone ? removeMs : -1
        report["statusBefore"] = before ?? NSNull()
        report["statusDuring"] = during ?? NSNull()
        report["statusAfter"] = after ?? NSNull()
        report["events"] = events ?? NSNull()
        report["inputsAfter"] = ports ?? NSNull()
        write("hotplug", report)
    }

    // MARK: Wait mode demo

    /// Opens Ode to Joy and plays its first notes (right hand) from the virtual source.
    func waitDemo() async {
        guard await ensurePorts() else { return host.log("wait: no test port") }
        location("#/pieces/beethoven-ode-to-joy")
        let drawn = await waitFor("document.querySelector('.score-svg')", seconds: 30)
        host.log("wait: score drawn \(drawn)")
        try? await Task.sleep(for: .milliseconds(800))
        await snapshot("wait-start")
        let melody: [UInt8] = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60]
        for key in melody {
            ports!.emit([0x90, key, 80])
            try? await Task.sleep(for: .milliseconds(180))
            ports!.emit([0x80, key, 0])
            try? await Task.sleep(for: .milliseconds(350))
        }
        try? await Task.sleep(for: .milliseconds(500))
        let status = await js("return document.querySelector('.piece-status, [role=status]')?.textContent ?? ''")
        host.log("wait: played \(melody.count) notes; status: \(status ?? "")")
        await snapshot("wait-after-\(melody.count)")
        host.log("WAIT DEMO READY")
    }

    /// A rhythm-mode run of Ode to Joy (right hand) played by the virtual source on the beat.
    func rhythmDemo() async {
        guard await ensurePorts() else { return host.log("rhythm: no test port") }
        location("#/pieces/beethoven-ode-to-joy")
        _ = await waitFor("document.querySelector('.score-svg')", seconds: 30)
        try? await Task.sleep(for: .milliseconds(800))
        let click = { (labels: String) in
            _ = try? await self.host.webView.evaluateJavaScript("""
                [...document.querySelectorAll('main button, main label')].find(b => /^(\(labels))$/.test(b.textContent.trim()))?.click(); true
                """)
        }
        await click("Rhythm|节奏")
        try? await Task.sleep(for: .milliseconds(500))
        await click("Start|开始")
        try? await Task.sleep(for: .milliseconds(500))
        // The first run offers a calibration first.
        await click("Start without calibrating|不校准，直接开始")
        let bpm = await js("return Number(document.querySelector('.piece-controls')?.textContent.match(/= ?(\\d+)/)?.[1] ?? 90)") as? Double ?? 90
        let beat = 60_000 / bpm
        // One bar of count-in (4/4), then eight quarter notes on the beat.
        let melody: [UInt8] = [64, 64, 65, 67, 67, 65, 64, 62]
        var messages: [(offsetMs: Double, bytes: [UInt8])] = []
        for (i, key) in melody.enumerated() {
            messages.append((Double(i) * beat, [0x90, key, 80]))
            messages.append((Double(i) * beat + beat * 0.6, [0x80, key, 0]))
        }
        _ = await ports!.play(messages, startingIn: 4 * beat)
        try? await Task.sleep(for: .milliseconds(300))
        let status = await js("return document.querySelector('.piece-status')?.textContent ?? ''")
        host.log("rhythm: bpm \(bpm); status: \(status ?? "")")
        await snapshot("rhythm-running")
        host.log("RHYTHM DEMO READY")
    }

    /// What the system makes of the Pieces import's accept list (`.musicxml,.xml,.mxl` and the
    /// MusicXML MIME type): WebKit hands the document picker these types.
    func uniformTypes() {
        var report = environment()
        var types: [String: Any] = [:]
        for ext in ["musicxml", "mxl", "xml", "json"] {
            let type = UTType(filenameExtension: ext)
            types[".\(ext)"] = [
                "identifier": type?.identifier ?? "none", "dynamic": type?.isDynamic ?? true,
                "conformsToData": type?.conforms(to: .data) ?? false,
            ]
        }
        let mime = UTType(mimeType: "application/vnd.recordare.musicxml+xml")
        types["application/vnd.recordare.musicxml+xml"] = mime?.identifier ?? "none"
        report["types"] = types
        write("utypes", report)
    }

    /// Mac: sets the window's content size, e.g. `1376x1032` (the CSS viewport of an iPad Pro 13"
    /// in landscape).
    func resizeWindow(_ size: String) {
        #if os(macOS)
        let parts = size.split(separator: "x").compactMap { Double($0) }
        guard parts.count == 2, let window = host.webView.window else { return }
        window.setContentSize(NSSize(width: parts[0], height: parts[1]))
        host.log("window content \(window.contentLayoutRect.size)")
        #endif
    }

    /// Turns an iPhone to portrait or landscape. iPadOS refuses programmatic rotation in its
    /// windowing modes ("The current windowing mode does not allow…"); rotate an iPad by hand.
    func orient(_ orientation: String) async {
        #if os(iOS)
        guard let scene = host.webView.window?.windowScene else { return }
        let mask: UIInterfaceOrientationMask = orientation == "portrait" ? .portrait : .landscapeRight
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: mask)) { error in
            print("[dacapo] orientation: \(error.localizedDescription)")
        }
        try? await Task.sleep(for: .seconds(2))
        #endif
    }

    // MARK: Verovio in the app

    /// Load and draw times from the bundle, and the WebContent process to measure memory on.
    func verovio() async {
        var report = environment()
        let assetsDir = Bundle.main.resourceURL!.appendingPathComponent("web/assets")
        let files = (try? FileManager.default.contentsOfDirectory(atPath: assetsDir.path)) ?? []
        let module = files.first { $0.hasPrefix("verovio-module-") } ?? ""
        let glue = files.first { $0.hasPrefix("verovio-") && !$0.hasPrefix("verovio-module-") } ?? ""
        let size = (try? FileManager.default.attributesOfItem(atPath: assetsDir.appendingPathComponent(module).path)[.size]) ?? 0
        report["moduleFile"] = module
        report["moduleBytes"] = size
        stage("baseline")
        try? await Task.sleep(for: .seconds(4))

        // The app's own path: route → lazy chunk → Verovio → drawn score, per piece.
        var pages: [[String: Any]] = []
        for id in ["beethoven-ode-to-joy", "bach-prelude-in-c", "beethoven-fur-elise"] {
            location("#/pieces")
            _ = await waitFor("document.querySelector('main h1, main h2')", seconds: 10)
            try? await Task.sleep(for: .milliseconds(500))
            // Timed in the page, checked every 5 ms (not per frame: a Mac window that is covered gets
            // no animation frames): from the route change to the drawn score.
            let timing = await js("""
                const t0 = performance.now();
                location.hash = hash;
                while (!document.querySelector('.score-svg')) {
                  await new Promise((r) => setTimeout(r, 5));
                  if (performance.now() - t0 > 60000) return JSON.stringify({ drawn: false });
                }
                const ms = performance.now() - t0;
                return JSON.stringify({ drawn: true, routeToScoreMs: ms,
                  svgElements: document.querySelector('.score-svg').querySelectorAll('*').length });
                """, ["hash": "#/pieces/\(id)"])
            pages.append(["piece": id, "result": timing ?? NSNull()])
            stage("drawn-\(id)")
            try? await Task.sleep(for: .seconds(4))
        }
        report["pages"] = pages
        await snapshot("verovio-last")
        location("#/settings")
        try? await Task.sleep(for: .seconds(3))
        stage("left-pieces")
        try? await Task.sleep(for: .seconds(4))

        // Engine alone, twice more (after the app's own load, so the module is cached; each run
        // compiles the WebAssembly and makes a toolkit again).
        let engine = await js("""
            const xml = (await import(piece)).default;
            const runs = [];
            for (let i = 0; i < 2; i++) {
              const t0 = performance.now();
              const [{ VerovioToolkit }, { default: createModule }] = await Promise.all([import(glue), import(module)]);
              const t1 = performance.now();
              const tk = new VerovioToolkit(await createModule());
              const t2 = performance.now();
              tk.setOptions({ pageWidth: 2400, scale: 42, adjustPageHeight: true, breaks: 'auto', font: 'Bravura' });
              tk.loadData(xml);
              const svg = tk.renderToSVG(1);
              const t3 = performance.now();
              runs.push({ importMs: t1 - t0, instantiateMs: t2 - t1, loadAndRenderMs: t3 - t2, svgBytes: svg.length });
            }
            return JSON.stringify(runs);
            """, ["glue": "/assets/\(glue)", "module": "/assets/\(module)", "piece": "/assets/\(files.first { $0.hasPrefix("bach-prelude-in-c-") } ?? "")"])
        report["engine"] = engine ?? NSNull()
        stage("engine-bench-two-more-toolkits")
        try? await Task.sleep(for: .seconds(4))

        write("verovio", report)
    }

    private func stage(_ name: String) {
        host.log("STAGE \(name) webpid=\(host.webProcessIdentifier ?? -1) apppid=\(ProcessInfo.processInfo.processIdentifier)")
    }
}

/// Summary statistics in ms.
struct Stats {
    let values: [Double]
    init(_ values: [Double]) { self.values = values.sorted() }

    private func quantile(_ q: Double) -> Double {
        guard !values.isEmpty else { return .nan }
        return values[min(values.count - 1, Int((Double(values.count - 1) * q).rounded()))]
    }

    var json: [String: Any] {
        guard !values.isEmpty else { return ["n": 0] }
        let round = { (x: Double) in (x * 1000).rounded() / 1000 }
        return [
            "n": values.count, "min": round(values.first!), "median": round(quantile(0.5)),
            "p95": round(quantile(0.95)), "p99": round(quantile(0.99)), "max": round(values.last!),
            "mean": round(values.reduce(0, +) / Double(values.count)),
        ]
    }
}
extension WebHost {
    /// Runs `script` as the body of an async function in the page and returns its result.
    func run(_ script: String, arguments: [String: Any] = [:]) async throws -> Any? {
        try await webView.callAsyncJavaScript(script, arguments: arguments, in: nil, contentWorld: .page)
    }

    /// The WebContent process id (private API; debug measurements only).
    var webProcessIdentifier: Int? {
        webView.value(forKey: "_webProcessIdentifier") as? Int
    }
}
#endif
