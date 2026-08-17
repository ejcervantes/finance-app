import SwiftUI

struct AuthView: View {
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            if showRegister {
                RegisterView(showRegister: $showRegister)
            } else {
                LoginView(showRegister: $showRegister)
            }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var session: Session
    @Binding var showRegister: Bool

    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "wallet.pass.fill")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            Text("Finanzas")
                .font(.largeTitle.bold())
            Text("Lleva el control de tus gastos e ingresos")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                SecureField("Contraseña", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)
            }
            .padding(.top, 8)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button(action: { Task { await submit() } }) {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Iniciar sesión").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isLoading || email.isEmpty || password.isEmpty)

            Button("¿No tienes cuenta? Regístrate") { showRegister = true }
                .font(.footnote)

            Spacer()
        }
        .padding()
    }

    private func submit() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.login(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
