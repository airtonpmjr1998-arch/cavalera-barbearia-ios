import SwiftUI
import WebKit
import UIKit

struct CavaleraWebView: UIViewRepresentable {
    let url: URL
    @ObservedObject var model: WebViewModel
    let reloadToken: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.allowsInlineMediaPlayback = true
        configuration.applicationNameForUserAgent = "CavaleraBarbeariaIOS/1.0"

        let webView = WKWebView(frame: .zero, configuration: configuration)

        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.scrollView.keyboardDismissMode = .interactive
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 8/255, green: 9/255, blue: 11/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        context.coordinator.webView = webView
        context.coordinator.lastReloadToken = reloadToken

        model.beginLoading()
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            model.beginLoading()
            webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let model: WebViewModel
        weak var webView: WKWebView?
        var lastReloadToken: UUID?

        init(model: WebViewModel) {
            self.model = model
        }

        private func normalizedHost(_ url: URL) -> String {
            (url.host ?? "").lowercased()
        }

        private func isAppsScriptHost(_ url: URL) -> Bool {
            let host = normalizedHost(url)

            return host == "script.google.com"
                || host.hasSuffix(".script.google.com")
                || host == "script.googleusercontent.com"
                || host.hasSuffix(".script.googleusercontent.com")
        }

        private func shouldOpenExternally(_ url: URL) -> Bool {
            let scheme = (url.scheme ?? "").lowercased()
            let host = normalizedHost(url)
            let path = url.path.lowercased()

            if ["tel", "mailto", "sms", "smsto", "geo", "maps", "whatsapp"].contains(scheme) {
                return true
            }

            if scheme != "http" && scheme != "https" {
                return true
            }

            if host == "wa.me"
                || host.hasSuffix(".wa.me")
                || host == "api.whatsapp.com"
                || host == "web.whatsapp.com"
                || host.hasSuffix(".whatsapp.com") {
                return true
            }

            if host == "maps.google.com"
                || host == "maps.app.goo.gl"
                || ((host == "google.com" || host == "www.google.com") && path.contains("/maps")) {
                return true
            }

            return !isAppsScriptHost(url)
        }

        private func openExternal(_ url: URL) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if shouldOpenExternally(url) {
                openExternal(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard navigationAction.targetFrame == nil,
                  let url = navigationAction.request.url
            else {
                return nil
            }

            if shouldOpenExternally(url) {
                openExternal(url)
            } else {
                webView.load(navigationAction.request)
            }

            return nil
        }

        func webView(
            _ webView: WKWebView,
            didStartProvisionalNavigation navigation: WKNavigation!
        ) {
            model.beginLoading()
        }

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            model.finishLoading()
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            model.showError("Não foi possível carregar a Cavalera Barbearia. Verifique sua internet e tente novamente.")
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            let nsError = error as NSError

            if nsError.code == NSURLErrorCancelled {
                return
            }

            model.showError("Não foi possível carregar a Cavalera Barbearia. Verifique sua internet e tente novamente.")
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            model.showError("O conteúdo foi interrompido. Toque em Tentar novamente.")
        }
    }
}
