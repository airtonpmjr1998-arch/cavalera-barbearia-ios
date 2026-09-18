import Foundation

@MainActor
final class WebViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var hasError = false
    @Published var errorMessage = ""

    func beginLoading() {
        isLoading = true
        hasError = false
        errorMessage = ""
    }

    func finishLoading() {
        isLoading = false
    }

    func showError(_ message: String) {
        isLoading = false
        hasError = true
        errorMessage = message
    }

    func clearError() {
        hasError = false
        errorMessage = ""
    }
}
