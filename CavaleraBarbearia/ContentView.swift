import SwiftUI

struct ContentView: View {
    @StateObject private var model = WebViewModel()
    @State private var reloadToken = UUID()

    private let background = Color(
        red: 8.0 / 255.0,
        green: 9.0 / 255.0,
        blue: 11.0 / 255.0
    )

    var body: some View {
        ZStack {
            background
                .ignoresSafeArea()

            if let url = AppConfiguration.webAppURL {
                CavaleraWebView(
                    url: url,
                    model: model,
                    reloadToken: reloadToken
                )
                .ignoresSafeArea(edges: .bottom)
            } else {
                configurationError
            }

            if model.isLoading && AppConfiguration.webAppURL != nil {
                loadingOverlay
            }

            if model.hasError {
                errorOverlay
            }
        }
        .tint(Color(red: 210/255, green: 180/255, blue: 119/255))
    }

    private var loadingOverlay: some View {
        VStack {
            ProgressView()
                .controlSize(.large)
                .tint(Color(red: 210/255, green: 180/255, blue: 119/255))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(background.opacity(0.34))
        .allowsHitTesting(false)
    }

    private var errorOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Color(red: 210/255, green: 180/255, blue: 119/255))

            Text("Sem conexão")
                .font(.title3.bold())
                .foregroundStyle(.white)

            Text(model.errorMessage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)

            Button {
                model.clearError()
                reloadToken = UUID()
            } label: {
                Text("Tentar novamente")
                    .fontWeight(.bold)
                    .frame(maxWidth: 220)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 210/255, green: 180/255, blue: 119/255))
            .foregroundStyle(.black)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(background.opacity(0.97))
    }

    private var configurationError: some View {
        VStack(spacing: 14) {
            Image(systemName: "gear.badge.xmark")
                .font(.system(size: 36))
                .foregroundStyle(Color(red: 210/255, green: 180/255, blue: 119/255))

            Text("Configuração pendente")
                .font(.title3.bold())
                .foregroundStyle(.white)

            Text("Configure WEB_APP_URL no GitHub com a URL /exec do Google Apps Script.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
        }
        .padding(28)
    }
}
