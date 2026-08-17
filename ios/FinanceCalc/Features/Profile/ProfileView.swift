import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var session: Session

    var body: some View {
        NavigationStack {
            List {
                if let user = session.currentUser {
                    Section("Cuenta") {
                        LabeledContent("Nombre", value: "\(user.firstName) \(user.lastName)")
                        LabeledContent("Email", value: user.email)
                        LabeledContent("País", value: user.country)
                        LabeledContent("Divisa", value: user.baseCurrency)
                    }
                }
                Section {
                    Button("Cerrar sesión", role: .destructive) {
                        session.logout()
                    }
                }
            }
            .navigationTitle("Perfil")
        }
    }
}
