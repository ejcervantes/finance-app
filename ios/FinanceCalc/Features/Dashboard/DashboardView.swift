import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var session: Session
    @StateObject private var vm = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let summary = vm.summary {
                        balanceCard(summary)
                        incomeExpenseRow(summary)
                        if !vm.byCategory.isEmpty {
                            categoriesCard()
                        }
                    } else if vm.isLoading {
                        ProgressView().padding(.top, 60)
                    } else if let error = vm.errorMessage {
                        errorState(error)
                    }
                }
                .padding()
            }
            .navigationTitle("Resumen")
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
    }

    private var currency: String { session.currentUser?.baseCurrency ?? "" }

    private func balanceCard(_ s: SummaryReport) -> some View {
        VStack(spacing: 6) {
            Text("Balance del mes").font(.subheadline).foregroundStyle(.secondary)
            Text(Money.format(s.balance, currency: currency))
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(balanceColor(s.balance))
            if let rate = s.savingsRate {
                Text("Tasa de ahorro: \(Int((rate * 100).rounded()))%")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func incomeExpenseRow(_ s: SummaryReport) -> some View {
        HStack(spacing: 12) {
            statTile("Ingresos", s.totalIncome, .green, "arrow.down.circle.fill")
            statTile("Gastos", s.totalExpense, .red, "arrow.up.circle.fill")
        }
    }

    private func statTile(_ title: String, _ amount: String, _ color: Color, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.subheadline).foregroundStyle(color)
            Text(Money.format(amount, currency: currency))
                .font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }

    private func categoriesCard() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Gasto por categoría").font(.headline)
            ForEach(vm.byCategory.prefix(6)) { item in
                HStack {
                    Text(item.categoryName)
                    Spacer()
                    Text(Money.format(item.total, currency: currency))
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle").font(.largeTitle)
            Text(message).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("Reintentar") { Task { await vm.load() } }
                .buttonStyle(.bordered)
        }
        .padding(.top, 60)
    }

    private func balanceColor(_ raw: String) -> Color {
        (Decimal(string: raw) ?? 0) < 0 ? .red : .primary
    }
}
