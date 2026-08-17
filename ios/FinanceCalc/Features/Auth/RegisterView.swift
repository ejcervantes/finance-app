import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var session: Session
    @Binding var showRegister: Bool

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var country = "CR"
    @State private var currency = "CRC"
    @State private var errorMessage: String?
    @State private var isLoading = false

    private var canSubmit: Bool {
        !firstName.isEmpty && !lastName.isEmpty && !email.isEmpty
            && password.count >= 8 && country.count == 2 && currency.count == 3
    }

    var body: some View {
        Form {
            Section("Tus datos") {
                TextField("Nombre", text: $firstName)
                    .textContentType(.givenName)
                TextField("Apellido", text: $lastName)
                    .textContentType(.familyName)
            }
            Section("Cuenta") {
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Contraseña (mín. 8)", text: $password)
            }
            Section("Preferencias") {
                TextField("País (ISO, ej. CR)", text: $country)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                TextField("Divisa (ISO, ej. CRC)", text: $currency)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }

            if let errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }

            Section {
                Button(action: { Task { await submit() } }) {
                    if isLoading {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Crear cuenta").frame(maxWidth: .infinity)
                    }
                }
                .disabled(isLoading || !canSubmit)
            }
        }
        .navigationTitle("Registro")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Ya tengo cuenta") { showRegister = false }
            }
        }
    }

    private func submit() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        let payload = RegisterRequest(
            email: email,
            password: password,
            firstName: firstName,
            lastName: lastName,
            country: country.uppercased(),
            baseCurrency: currency.uppercased()
        )
        do {
            try await session.register(payload)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
