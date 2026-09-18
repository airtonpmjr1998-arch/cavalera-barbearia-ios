import Foundation

enum AppConfiguration {
    static var webAppURL: URL? {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "WebAppURL") as? String
        else {
            return nil
        }

        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)

        guard
            value.hasPrefix("https://"),
            let url = URL(string: value),
            url.host != nil,
            url.host != "example.invalid"
        else {
            return nil
        }

        return url
    }
}
