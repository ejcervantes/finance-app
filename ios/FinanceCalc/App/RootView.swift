import SwiftUI

/// Muestra la app principal si hay sesión, o la pantalla de auth si no.
struct RootView: View {
    @EnvironmentObject var session: Session

    var body: some View {
        Group {
            if session.isAuthenticated {
                MainTabView()
            } else {
                AuthView()
            }
        }
        .animation(.default, value: session.isAuthenticated)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Resumen", systemImage: "chart.pie.fill") }

            TransactionsView()
                .tabItem { Label("Movimientos", systemImage: "list.bullet") }

            AssistantView()
                .tabItem { Label("Asesor", systemImage: "sparkles") }

            ProfileView()
                .tabItem { Label("Perfil", systemImage: "person.crop.circle") }
        }
    }
}
