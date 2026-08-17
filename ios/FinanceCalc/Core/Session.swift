import Foundation

/// Estado global de autenticación. La app observa `isAuthenticated`.
@MainActor
final class Session: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: UserRead?

    private let keychain = KeychainStore()

    init() {
        if let token = keychain.read(.accessToken) {
            APIClient.shared.accessToken = token
            isAuthenticated = true
            Task { await loadCurrentUser() }
        }
    }

    func login(email: String, password: String) async throws {
        let body = try APIClient.shared.jsonBody(
            LoginRequest(email: email, password: password)
        )
        let tokens: TokenPair = try await APIClient.shared.request(
            Endpoint(path: "auth/login", method: .post, body: body, authorized: false)
        )
        store(tokens)
        await loadCurrentUser()
        isAuthenticated = true
    }

    func register(_ payload: RegisterRequest) async throws {
        let body = try APIClient.shared.jsonBody(payload)
        let _: UserRead = try await APIClient.shared.request(
            Endpoint(path: "auth/register", method: .post, body: body, authorized: false)
        )
        // Tras registrarse, inicia sesión automáticamente.
        try await login(email: payload.email, password: payload.password)
    }

    func loadCurrentUser() async {
        currentUser = try? await APIClient.shared.request(Endpoint(path: "users/me"))
    }

    func logout() {
        keychain.delete(.accessToken)
        keychain.delete(.refreshToken)
        APIClient.shared.accessToken = nil
        currentUser = nil
        isAuthenticated = false
    }

    private func store(_ tokens: TokenPair) {
        keychain.save(tokens.accessToken, for: .accessToken)
        keychain.save(tokens.refreshToken, for: .refreshToken)
        APIClient.shared.accessToken = tokens.accessToken
    }
}
